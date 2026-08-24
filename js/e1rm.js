// Rep normalisation.
//
// The problem: 45 lbs x 4 reps and 25 lbs x 10 reps are not comparable as raw
// weight, so a benchmark chart that plots weight alone is misleading.
//
// The fix is indirect. Convert every entry to an estimated one-rep max — a
// rep-count-free common currency — then convert back down to whichever rep
// count we want to display at. Both directions use the same curve, so an entry
// already at the target rep count round-trips to exactly itself.
//
// Formula: Marzagao (2026), fitted on 303,494 near-failure sets across 388
// exercises. It generalises Epley by letting the rep-to-1RM conversion factor
// vary with the weight lifted instead of being fixed:
//
//   1RM  = w * (1 + (r - 1)^0.85 / k(w))
//   k(w) = -2.55 + 4.58 * ln(w)              w in KILOGRAMS
//
// Why weight-dependent: the reps<->%1RM curve genuinely differs by exercise
// (Nuzzo et al. 2024 found exercise type is the ONLY meaningful moderator —
// not sex, age, or training status). Weight stands in for exercise type, since
// light lifts tend to be small-muscle isolation work with a steep curve and
// heavy lifts are large compound movements with a flat one. Every classical
// formula (Epley, Brzycki, Mayhew, Wathen) uses one fixed factor for every
// exercise, which is why they misfire across a 265-exercise library.
//
// See docs/research.md section 1 for the evidence and the limits.

import { bodyWeightFractionFor } from './exercises.js';

const ALPHA = 0.85;   // sub-linear rep scaling
const A = -2.55;      // k intercept
const B = 4.58;       // k slope on ln(weight)

export const LB_PER_KG = 2.2046226218;

// k is floored at B rather than the paper's 0.5. Below k = B the published
// curve is DECREASING in weight — a heavier lift would score a lower 1RM,
// which is nonsense and would break the inverse. The turning point sits at
// exactly k = B (w ~ 4.74 kg / 10.5 lbs), below which the paper has almost no
// data anyway. Holding k constant there keeps the curve strictly increasing
// everywhere, so the inversion below always has a unique answer.
export const K_FLOOR = B;

export function kFactor(weightKg) {
  return Math.max(K_FLOOR, A + B * Math.log(weightKg));
}

// Estimated 1RM, in whatever unit `weight` came in — the conversion to kg is
// internal to k(w), and the result scales linearly with the input.
export function e1rm(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!(w > 0) || !(r >= 1)) return null;
  if (r === 1) return w;
  return w * (1 + Math.pow(r - 1, ALPHA) / kFactor(w / LB_PER_KG));
}

// Inverse: the weight that would produce this e1RM at `reps`.
// e1rm() is strictly increasing in weight (see K_FLOOR), so bisection is safe.
export function weightForReps(target, reps) {
  const t = Number(target);
  const r = Number(reps);
  if (!(t > 0) || !(r >= 1)) return null;
  if (r === 1) return t;
  let lo = 0, hi = t;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (e1rm(mid, r) < t) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Same lift expressed at a different rep count.
export function normalizeWeight(weight, fromReps, toReps) {
  if (Number(fromReps) === Number(toReps)) {
    const w = Number(weight);
    return w > 0 ? w : null;
  }
  const t = e1rm(weight, fromReps);
  return t === null ? null : weightForReps(t, toReps);
}

/* ------------------------------------------------------------------ *
 * Body weight as resistance
 * ------------------------------------------------------------------ *
 *
 * A bodyweight movement logs the ADDED load and an assisted one logs the
 * SUBTRACTED load, so neither number is the load on the muscle and neither is
 * comparable to a barbell's. That is why both were refused outright — see the
 * old comment preserved under canNormalize().
 *
 * ⚠️ THE ASSIST HALF OF THIS WAS DEAD CODE UNTIL 2026-08-24. The `spec.assist`
 * branch below was written with the bodyweight work and no exercise could set
 * the flag — `Assisted Pull-Up` had no fraction entry, and bodyWeightFractionFor()
 * hardcoded `assist: false`. So the one assist machine in the app went through
 * the ordinary weighted path instead, where more weight reads as a harder set.
 * If you are adding an assisted exercise, the flag goes on the TABLE ENTRY in
 * exercises.js; nothing here needs changing.
 *
 * What changed is that body weight is recorded as a dated series, so the
 * missing term is available:
 *
 *   total resistance = fraction x body weight + added        (bodyweight)
 *   total resistance = fraction x body weight - assistance   (assisted)
 *
 * TWO NUMBERS, HELD TO DIFFERENT STANDARDS, and keeping them apart is the whole
 * honesty of this feature:
 *
 *   `fraction` — how much of your body weight the movement actually carries.
 *     PUBLISHED BIOMECHANICS ONLY. It lives in exercises.js with a source on
 *     every entry, and an exercise with no published figure gets no entry and
 *     stays unrankable. This is not a place to reason from first principles.
 *
 *   `ratio`    — what that resistance is worth against the muscle's key lift.
 *     A reasoned estimate, exactly like every other entry in the RATIOS table
 *     in muscle-evidence.js, and carrying a quality that says so.
 *
 * ⚠️ THE BODY WEIGHT MUST BE THE ONE FROM THE DATE OF THE SET. Somebody who has
 * lost 20 lb must not have last year's pull-ups re-scored at today's weight —
 * that would rewrite their history every time they stood on a scale, and it
 * would move in the wrong direction (losing weight would make their old
 * pull-ups look easier). bodyWeightOn() is what enforces it.
 */

// A weigh-in carried FORWARD is what your weight was; a weigh-in carried
// BACKWARD is an assumption. Both are usable, one is worth less.
export const EXTRAPOLATED_BW_QUALITY = 0.70;

function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  // Date.UTC on both sides, so this is a pure day count with no local/UTC mix
  // and no DST hole. Both operands are bare calendar dates, never instants.
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

/**
 * What you weighed on `date`, from the dated weigh-in series.
 *
 * @param {Array} rows  [{ date: 'YYYY-MM-DD', weight }] in any order, POUNDS
 * @param {string} date the day of the SET, not today
 * @returns null if there is not a single weigh-in on record, else
 *   { weight, date, basis, gapDays, quality }
 *     basis 'carried'      — the newest weigh-in at or before that day
 *     basis 'extrapolated' — every weigh-in is LATER, so the earliest one is
 *                            carried backward. An assumption, and priced as one.
 *
 * Returning null rather than falling back to today's weight is the point. "We
 * don't know" has to survive all the way to the screen; a silently guessed body
 * weight would make up a number and show it in the same colour as a measured
 * one, which is Rule 5 in reverse.
 */
export function bodyWeightOn(rows, date) {
  const day = dayNumber(date);
  const usable = (Array.isArray(rows) ? rows : [])
    .map((r) => ({ weight: Number(r && r.weight), date: r && r.date, day: dayNumber(r && r.date) }))
    .filter((r) => r.weight > 0 && r.day !== null)
    .sort((a, b) => a.day - b.day);
  if (!usable.length || day === null) return null;

  let best = null;
  for (const r of usable) { if (r.day <= day) best = r; else break; }
  if (best) {
    return {
      weight: best.weight, date: best.date, basis: 'carried',
      gapDays: day - best.day, quality: 1,
    };
  }
  const first = usable[0];
  return {
    weight: first.weight, date: first.date, basis: 'extrapolated',
    gapDays: first.day - day, quality: EXTRAPOLATED_BW_QUALITY,
  };
}

/**
 * The load actually resisted by one set of a bodyweight or assisted movement.
 *
 * @returns null when this exercise has no published fraction, or when no body
 *   weight is known. Null means UNRANKABLE and must stay visible as such.
 *   Otherwise { load, fraction, quality, base, added, assist }.
 */
export function totalResistance(exercise, loggedWeight, bodyWeight) {
  const spec = bodyWeightFractionFor(exercise);
  if (!spec) return null;
  const bw = Number(bodyWeight);
  if (!(bw > 0)) return null;

  const base = spec.fraction * bw;
  // A reps-only exercise logs no weight at all, which is not a missing number —
  // it is zero added load, and the resistance is fully determined without it.
  const extra = Number(loggedWeight);
  const added = Number.isFinite(extra) && extra > 0 ? extra : 0;

  const load = spec.assist ? base - added : base + added;
  // More assistance than your own body weight is not a lighter lift, it is a
  // nonsense entry. Refuse rather than produce a negative resistance.
  if (!(load > 0)) return null;

  return { load, fraction: spec.fraction, quality: spec.quality, base, added, assist: Boolean(spec.assist) };
}

/* ------------------------------------------------------------------ *
 * Which exercises this can honestly be applied to
 * ------------------------------------------------------------------ */

// The original reasoning, kept because it is still true of every bodyweight
// exercise WITHOUT a published fraction:
//
//   Bodyweight movements are excluded because the logged weight is the ADDED
//   load, not the total resistance — a dip logged at 25 lbs is really bodyweight
//   plus 25, and the ratio between the two shifts as the added weight changes,
//   so the distortion is not a constant offset that cancels out. The source
//   study excluded these outright for the same reason.
//
//   Assisted movements are worse: there the logged weight is assistance, so more
//   weight means an easier lift. Normalising would inverse the whole chart.
//
// What has changed is only that the missing term is now computable — for the
// exercises somebody has actually measured. The rest stay refused.
//
// ⚠️ Note what the paragraph above is and is not saying, because the assist
// entry added on 2026-08-24 does not contradict it. Normalising the RAW number
// would still invert the chart; nothing normalises the raw number. What is
// charted is `fraction × body weight − assistance`, which rises as the
// assistance falls. The regex below is now only a fallback for an assisted
// exercise with no fraction entry, and it must stay: the day somebody adds
// "Assisted Dip" to the library without adding a fraction for it, this is what
// stops the stack setting being read as a load.
//
// ⚠️ `opts` is not optional decoration. Called with one argument this returns
// exactly what it always did, because one argument means "I have not looked up
// a body weight" — which is the true state of any caller that has not been
// wired up, and of any user with no weigh-in at all. A bodyweight movement
// becomes normalisable only when a caller hands over a real body weight.
export function canNormalize(exercise, opts) {
  if (!exercise || !Array.isArray(exercise.fields)) return false;
  const spec = bodyWeightFractionFor(exercise);
  if (spec) {
    if (!exercise.fields.includes('reps')) return false;
    return Number(opts && opts.bodyWeight) > 0;
  }
  if (!exercise.fields.includes('weight') || !exercise.fields.includes('reps')) return false;
  if (exercise.equipment === 'Bodyweight') return false;
  if (/^assisted\b/i.test(exercise.name || '')) return false;
  return true;
}

// Why normalisation is unavailable, for the caption. Null when it is available.
//
// Same arity rule as canNormalize(), for the same reason: with one argument the
// wording is unchanged, because a caller that has not looked up a body weight
// really is still charting added load. With `opts` it can say the true and far
// more useful thing — that a weigh-in is the missing piece.
export function normalizeBlockedReason(exercise, opts) {
  if (!exercise || !Array.isArray(exercise.fields)) return null;
  const spec = bodyWeightFractionFor(exercise);
  if (spec) {
    if (!opts) {
      if (!exercise.fields.includes('weight')) return null;
      return spec.assist
        ? 'the logged weight is assistance, not resistance'
        : 'the logged weight is added load, not your total resistance';
    }
    if (!exercise.fields.includes('reps')) return null;
    if (!(Number(opts.bodyWeight) > 0)) {
      return 'we don’t know what you weighed — log a weigh-in and this becomes chartable';
    }
    return null;
  }
  if (!exercise.fields.includes('weight') || !exercise.fields.includes('reps')) return null;
  if (/^assisted\b/i.test(exercise.name || '')) {
    return 'the logged weight is assistance, not resistance';
  }
  if (exercise.equipment === 'Bodyweight') {
    return 'nobody has measured how much of your body weight this one carries';
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Choosing the rep count to compare at
 * ------------------------------------------------------------------ */

export const MIN_TARGET_REPS = 1;
export const MAX_TARGET_REPS = 20;

/**
 * The most reps a set may have and still count as EVIDENCE of a maximum (D5:
 * "don't normalise above 15").
 *
 * MAX_TARGET_REPS is a different thing — it caps the rep count a chart may be
 * *displayed* at, where the user has asked for it explicitly. This caps what
 * the app is willing to infer a 1RM from on its own.
 *
 * Worth stating why it matters, because leaving it unenforced was a real bug:
 * the formula happily extrapolates 135x25 to 258 lb, which beat a genuine
 * 205x5 top set and promoted a muscle a whole level on the strength of a
 * burnout set.
 */
export const MAX_EVIDENCE_REPS = 15;

/** Is this set something a maximum can honestly be inferred from? */
export function isRankableSet(reps) {
  const r = Number(reps);
  return Number.isFinite(r) && r >= 1 && r <= MAX_EVIDENCE_REPS;
}

// Returns null for anything that is not a usable rep count. The explicit type
// guard matters: Number(null) and Number('') are both 0, which would otherwise
// clamp up to 1 and turn missing data into a silent "1 rep".
export function clampReps(n) {
  if (typeof n !== 'number' && typeof n !== 'string') return null;
  if (typeof n === 'string' && n.trim() === '') return null;
  const r = Math.round(Number(n));
  if (!Number.isFinite(r)) return null;
  return Math.min(MAX_TARGET_REPS, Math.max(MIN_TARGET_REPS, r));
}

// The rep count that appears most often in what was actually recorded.
// Ties go to the one used most recently — that tracks what you are doing now
// rather than what you did a year ago.
//
// Deliberately computed over ALL observations, never over the plotted series:
// the plotted series depends on the target, so deriving the target from it
// would be circular and the chart could not settle.
export function modalReps(observations) {
  const tally = new Map();
  for (const o of observations || []) {
    const r = clampReps(o && o.reps);
    if (r === null) continue;
    const prev = tally.get(r);
    const date = (o && o.date) || '';
    if (!prev) tally.set(r, { reps: r, count: 1, latest: date });
    else {
      prev.count++;
      if (date > prev.latest) prev.latest = date;
    }
  }
  if (!tally.size) return null;
  return [...tally.values()].sort(
    (a, b) => b.count - a.count || b.latest.localeCompare(a.latest) || b.reps - a.reps,
  )[0].reps;
}

// Prediction quality degrades above roughly 10 reps, and past ~15 the set is
// limited by breathing, grip, and pain tolerance rather than strength.
export function repConfidence(reps) {
  const r = Number(reps);
  if (r <= 10) return 'good';
  if (r <= 15) return 'fair';
  return 'poor';
}
