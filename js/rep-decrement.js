// How reps fall from set to set at one load — the fatigue the caption can honestly carry.
//
// Written 2026-09-13 (docs/strength-accuracy-plan.md §5; the evidence is docs/research.md §16.5).
// The literature cannot give the muscle RATING a fatigue correction — nobody has measured a 1RM
// after prior work on the same muscle — so nothing here touches a rating. What it CAN give is
// exactly what the runner's "maybe N to failure" caption prints: reps at a fixed load, per set,
// by rest interval. Willardson & Burkett 2006 showed the decline is PROPORTIONAL — the same
// fraction of set 1 at 50 % and at 80 % 1RM (p = 0.849) — so it is a multiplier on the fresh
// prediction with no rep→1RM conversion at all.
//
// Two rules that make this safe to ship:
//   1. Every multiplier is ≤ 1. A wrong constant means the lifter beats the caption, which is
//      the harmless direction. Nothing here can make a number bigger.
//   2. Nothing here reaches the bar. The caption is a note beside a number the lifter typed.
//
// THE TABLE — fraction of set-1 reps, bench at ~75–80 % 1RM, trained men (🟢 that reps fall set
// on set and that rest sets the plateau, across eight or more acute studies; 🟡 the constants).
// Sources opened in full: Richmond & Godard 2004, Rahimi 2005, Willardson & Burkett 2006,
// Miranda 2009, Senna 2009, Ratamess 2012, de Salles 2009 review. Set 5 and beyond hold set 4.
//
//   rest      set 2        set 3        set 4
//   1 min     0.50–0.60    0.35–0.40    0.25–0.30
//   2 min     0.70–0.75    ≈0.55        0.40–0.50
//   3 min     0.75–0.80    ≈0.65        0.50–0.55
//   5 min     ≈0.90        0.80–0.85    ≈0.75
//
// ⚠️ What the table assumes and the app cannot check: set 1 was taken to failure (D28), and the
// rest was what the column says. The app records no per-set rest; the rest TIMER's target is the
// only proxy, and only for users who turn it on — so 2 min is the default, which is the
// defensible central assumption for a lifter who is trying (docs/research.md §16.5). Stronger
// men decline MORE at short rest and women far less (Ratamess 2012, one study) — not enough to
// branch on. Free squat declines less than bench; leg press does not. Not modelled.
//
// THE LIFTER'S OWN DECREMENT (plan §5.2). Any exercise logged with three or more sets at one
// load already records how THIS person's reps fall. A shrinkage blend with the table as prior —
// w = n / (n + K), K ≈ 2.6 from within-person noise ≈ 0.13 and between-person SD ≈ 0.08 — beats
// the population number from the first session and is never worse. It is clamped at 1.0: a
// sandbagged first set must never raise set 2 above the fresh prediction.
//
// FLAT REPS (plan §5.3). At ≤ 2 min, sets to failure lose a quarter of their reps by set 2. So
// 8, 8, 8 at one load is evidence that set 1 was NOT near failure and its e1RM is an
// under-estimate. The app may use that ONE way: to withhold the near-max credit `repFactor`
// would otherwise give that exercise. Raising the number would be a load multiplier in a new
// coat, which Rule 5 forbids. flatRun() is the detector; the discount lives in muscle-evidence.js.

export const REST_COLUMNS = Object.freeze({
  60:  Object.freeze([1, 0.55, 0.38, 0.28]),
  120: Object.freeze([1, 0.72, 0.55, 0.45]),
  180: Object.freeze([1, 0.78, 0.65, 0.52]),
  300: Object.freeze([1, 0.90, 0.82, 0.75]),
});
export const DEFAULT_REST_SECONDS = 120;
export const SHRINK_K = 2.6;
export const MIN_RUN = 3;
export const FLAT_R2 = 0.95;
export const FLAT_R3 = 0.90;

/** The column whose rest is nearest to `restSeconds`; 2 min when unknown or 0 (timer off). */
export function restColumn(restSeconds) {
  const s = Number(restSeconds);
  const keys = Object.keys(REST_COLUMNS).map(Number);
  if (!(s > 0)) return REST_COLUMNS[DEFAULT_REST_SECONDS];
  let best = keys[0];
  for (const k of keys) if (Math.abs(k - s) < Math.abs(best - s)) best = k;
  return REST_COLUMNS[best];
}

/** Population multiplier for the set at `setIndex` (0-based). Always ≤ 1; index 0 is 1. */
export function setIndexMultiplier(setIndex, restSeconds) {
  const col = restColumn(restSeconds);
  const i = Math.max(0, Math.min(col.length - 1, Math.floor(Number(setIndex) || 0)));
  return col[i];
}

function repsOf(set) {
  const r = Number(set && set.reps);
  return Number.isFinite(r) && r >= 1 && r <= 15 ? r : null;
}
function weightOf(set) {
  const w = Number(set && set.weight);
  return Number.isFinite(w) ? w : 0;
}

/**
 * The longest LEADING run of recorded sets at one weight with usable reps. A weight change ends
 * it (a back-off set resets freshness); a blank or prefilled set ends it; drops and myo-reps
 * nested in `minis` do not count as sets. Returns the rep counts, possibly empty.
 */
export function leadingRun(sets) {
  const out = [];
  let w = null;
  for (const s of Array.isArray(sets) ? sets : []) {
    if (!s || s.prefilled) break;
    const r = repsOf(s);
    if (r === null) break;
    const sw = weightOf(s);
    if (w === null) w = sw;
    else if (sw !== w) break;
    out.push(r);
  }
  return out;
}

/** reps[k] / reps[1] for one run. Null unless the run has at least two sets. Ratios are raw (may exceed 1). */
export function runDecrement(sets) {
  const run = leadingRun(sets);
  if (run.length < 2) return null;
  const r1 = run[0];
  return {
    n: run.length,
    r2: run[1] / r1,
    r3: run.length > 2 ? run[2] / r1 : null,
    r4: run.length > 3 ? run[3] / r1 : null,
  };
}

/**
 * This lifter's own decrement on one exercise, from every recorded session with a run of at
 * least MIN_RUN sets at one load. Means over runs, each ratio clamped at 1.0. `n` is the number
 * of runs that contributed to r2 (r3/r4 carry their own counts).
 *
 * @param {Array} sessions  the person's OWN sessions, newest or oldest first — order is irrelevant
 * @param {string} exerciseId
 */
export function personalDecrement(sessions, exerciseId) {
  const acc = { r2: [], r3: [], r4: [] };
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (!s || s.isBenchmark) continue;
    for (const e of Array.isArray(s.entries) ? s.entries : []) {
      if (!e || e.exerciseId !== exerciseId) continue;
      if (e.setType || e.group) continue;
      const run = leadingRun(e.sets);
      if (run.length < MIN_RUN) continue;
      acc.r2.push(Math.min(1, run[1] / run[0]));
      acc.r3.push(Math.min(1, run[2] / run[0]));
      if (run.length > 3) acc.r4.push(Math.min(1, run[3] / run[0]));
    }
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return { n: acc.r2.length, r2: mean(acc.r2), r3: mean(acc.r3), n4: acc.r4.length, r4: mean(acc.r4) };
}

/**
 * The multipliers a caption should use for sets 1..4+: the population column blended with the
 * lifter's own decrement by w = n / (n + K). Always ≤ 1 at every index and non-increasing.
 */
export function blendedMultipliers(personal, restSeconds, k = SHRINK_K) {
  const col = restColumn(restSeconds);
  const out = [1];
  const blend = (own, n, pop) => {
    if (!(n > 0) || !Number.isFinite(own)) return pop;
    const w = n / (n + k);
    return Math.min(1, w * Math.min(1, own) + (1 - w) * pop);
  };
  const p = personal || {};
  out.push(blend(p.r2, p.n, col[1]));
  out.push(blend(p.r3, p.n, col[2]));
  out.push(blend(p.r4, p.n4, col[3]));
  for (let i = 1; i < out.length; i++) out[i] = Math.min(out[i], out[i - 1]);
  return out;
}

/** The predicted reps for a later set, from the fresh prediction. Whole reps, never below 1. */
export function repsAtSet(freshReps, setIndex, multipliers) {
  const f = Number(freshReps);
  if (!(f >= 1)) return null;
  const m = Array.isArray(multipliers) ? multipliers : restColumn(null);
  const i = Math.max(0, Math.min(m.length - 1, Math.floor(Number(setIndex) || 0)));
  return Math.max(1, Math.round(f * m[i]));
}

/**
 * Was this entry probably NOT taken to failure? True when a leading run of at least MIN_RUN sets
 * at one load kept its reps: set 2 at or above FLAT_R2 of set 1 and set 3 at or above FLAT_R3.
 * One-sided by design: flat ⇒ probably not to failure (strong); falling ⇒ says nothing.
 */
export function flatRun(sets) {
  const run = leadingRun(sets);
  if (run.length < MIN_RUN) return false;
  return run[1] / run[0] >= FLAT_R2 && run[2] / run[0] >= FLAT_R3;
}
