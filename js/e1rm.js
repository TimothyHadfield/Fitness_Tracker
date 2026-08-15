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
 * Which exercises this can honestly be applied to
 * ------------------------------------------------------------------ */

// Bodyweight movements are excluded because the logged weight is the ADDED
// load, not the total resistance — a dip logged at 25 lbs is really bodyweight
// plus 25, and the ratio between the two shifts as the added weight changes, so
// the distortion is not a constant offset that cancels out. The source study
// excluded these outright for the same reason.
//
// Assisted movements are worse: there the logged weight is assistance, so more
// weight means an easier lift. Normalising would inverse the whole chart.
//
// Both become tractable once body-weight tracking exists (Tier 1) — total
// resistance would then be computable.
export function canNormalize(exercise) {
  if (!exercise || !Array.isArray(exercise.fields)) return false;
  if (!exercise.fields.includes('weight') || !exercise.fields.includes('reps')) return false;
  if (exercise.equipment === 'Bodyweight') return false;
  if (/^assisted\b/i.test(exercise.name || '')) return false;
  return true;
}

// Why normalisation is unavailable, for the caption. Null when it is available.
export function normalizeBlockedReason(exercise) {
  if (!exercise || !Array.isArray(exercise.fields)) return null;
  if (!exercise.fields.includes('weight') || !exercise.fields.includes('reps')) return null;
  if (/^assisted\b/i.test(exercise.name || '')) {
    return 'the logged weight is assistance, not resistance';
  }
  if (exercise.equipment === 'Bodyweight') {
    return 'the logged weight is added load, not your total resistance';
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Choosing the rep count to compare at
 * ------------------------------------------------------------------ */

export const MIN_TARGET_REPS = 1;
export const MAX_TARGET_REPS = 20;

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
