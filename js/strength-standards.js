// Strength standards — where a lift sits against other people who lift.
//
// ⚠️ THE REFERENCE POPULATION IS **PEOPLE WHO LIFT AND LOG**, NOT EVERYONE.
// This must reach the user in words. "Stronger than 80 % of people" is false;
// "stronger than 80 % of people who lift" is true. Competition data would put
// most of the population below its own 50th percentile, and true
// general-population data would make every user Elite — see docs/research.md §11.
//
// Everything here is pure. No DOM, no store, no network — so it is fully
// testable headlessly, which is how the e1RM module caught a real bug.

import { BUILT_IN_EXERCISES } from './exercises.js';

/* ------------------------------------------------------------------ *
 * Levels
 * ------------------------------------------------------------------ */

// The five anchors (5/20/50/80/95) are exactly Strength Level's and Gravitus's,
// so our tier names agree with the calculators users will check us against.
// Proficient and Expert are inserted into the two widest gaps: without them the
// worst step is +86 lb and someone can train a year without the colour moving.
export const LEVELS = [
  { key: 'beginner',     name: 'Beginner',     percentile: 5 },
  { key: 'novice',       name: 'Novice',       percentile: 20 },
  { key: 'intermediate', name: 'Intermediate', percentile: 50 },
  { key: 'proficient',   name: 'Proficient',   percentile: 65 },
  { key: 'advanced',     name: 'Advanced',     percentile: 80 },
  { key: 'expert',       name: 'Expert',       percentile: 90 },
  { key: 'elite',        name: 'Elite',        percentile: 95 },
];

/* ------------------------------------------------------------------ *
 * The model
 * ------------------------------------------------------------------ */

// Reference body weights the median lifts below are quoted at.
const REF_BW = { male: 180, female: 140 };

// Strength scales with roughly bodyweight^(2/3) — the surface law — not
// linearly. A plain lb-per-lb ratio would systematically flatter light lifters
// and punish heavy ones. Checked against published standards: 225 lb at 180 lb
// predicts 199 at 150 lb, which matches the published figure to within a pound.
const ALLOMETRIC = 0.67;

// Log-space spread. Fitting σ = 0.32 to a 225 lb median reproduces the published
// tier anchors closely (see docs/research.md §11). One value for every lift is a
// simplification — isolation work is probably wider — and is worth revisiting
// once real data exists.
const SIGMA = 0.32;

// Fraction of US adults doing muscle-strengthening activity 2+ days/week
// (NHIS 2020). Used only for the optional general-population readout.
const TRAINING_RATE = 0.319;

/* ------------------------------------------------------------------ *
 * Muscle group → key lift
 * ------------------------------------------------------------------ */

// One lift lights one muscle. A bench press will not colour Triceps even though
// it trains them — guessing at contributions would be less honest than leaving
// a group grey, and it matches the "grey if no recordings" rule. The weighted
// primary/secondary mapping is a separate, larger change (D3).
//
// `median` is the 50th-percentile 1RM among people who lift, at REF_BW.
export const MUSCLE_LIFTS = {
  Chest:      { lift: 'Barbell Bench Press',    median: { male: 225, female: 100 } },
  Back:       { lift: 'Barbell Row',            median: { male: 205, female: 105 } },
  Quads:      { lift: 'Back Squat',             median: { male: 275, female: 155 } },
  Hamstrings: { lift: 'Romanian Deadlift',      median: { male: 245, female: 140 } },
  // Deadlift belongs to glutes, hamstrings and back at once. It fills Glutes
  // because hip-thrust standards are the thinnest of the three, and because it
  // is the best-documented lift in existence. Revisit with the weighted map.
  Glutes:     { lift: 'Deadlift',               median: { male: 320, female: 185 } },
  Shoulders:  { lift: 'Overhead Press',         median: { male: 130, female: 65 } },
  Biceps:     { lift: 'Barbell Curl',           median: { male: 85,  female: 45 } },
  Triceps:    { lift: 'Close-Grip Bench Press', median: { male: 185, female: 85 } },
  Traps:      { lift: 'Barbell Shrug',          median: { male: 225, female: 125 } },
  Calves:     { lift: 'Standing Calf Raise',    median: { male: 240, female: 150 } },
  Forearms:   { lift: 'Wrist Curl',             median: { male: 95,  female: 50 } },
  // Core and Neck have no usable published standards — Core's best exercises are
  // time-based or bodyweight, and nobody publishes neck norms. They stay grey
  // permanently, and the UI says so rather than letting it look like a bug.
};

export const UNRANKABLE = ['Core', 'Neck', 'Cardio'];

let liftIdCache = null;
function liftIds() {
  if (liftIdCache) return liftIdCache;
  liftIdCache = new Map();
  for (const [muscle, spec] of Object.entries(MUSCLE_LIFTS)) {
    const ex = BUILT_IN_EXERCISES.find((e) => e.name === spec.lift);
    if (ex) liftIdCache.set(muscle, ex.id);
  }
  return liftIdCache;
}

export function keyLiftFor(muscle) {
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  return { muscle, name: spec.lift, id: liftIds().get(muscle) || null };
}

export function muscleForLift(exerciseId) {
  for (const [muscle, id] of liftIds()) if (id === exerciseId) return muscle;
  return null;
}

/* ------------------------------------------------------------------ *
 * Age grading
 * ------------------------------------------------------------------ */

// Strength peaks roughly 23–40. Powerlifting age-grades with the McCulloch
// coefficients above 40 and Foster below 23; these are those published tables,
// linearly interpolated. Without this a 55-year-old is silently measured against
// a population of 25–35 year olds and reads as permanently weak.
const AGE_COEFFICIENTS = [
  [14, 1.23], [16, 1.13], [18, 1.06], [20, 1.03], [23, 1.00],
  [40, 1.00], [50, 1.13], [60, 1.381], [70, 1.786], [80, 2.549],
];

export function ageCoefficient(age) {
  // Type-guard before Number(): Number(null) and Number('') are both 0, which is
  // finite and would fall through to the youngest bracket — grading anyone
  // without a birth year as a 14-year-old and inflating every level they see.
  if (typeof age !== 'number' && typeof age !== 'string') return 1;
  if (typeof age === 'string' && age.trim() === '') return 1;
  const a = Number(age);
  if (!Number.isFinite(a) || a <= 0) return 1;
  if (a <= AGE_COEFFICIENTS[0][0]) return AGE_COEFFICIENTS[0][1];
  const last = AGE_COEFFICIENTS[AGE_COEFFICIENTS.length - 1];
  if (a >= last[0]) return last[1];
  for (let i = 1; i < AGE_COEFFICIENTS.length; i++) {
    const [x1, y1] = AGE_COEFFICIENTS[i - 1];
    const [x2, y2] = AGE_COEFFICIENTS[i];
    if (a <= x2) return y1 + ((a - x1) / (x2 - x1)) * (y2 - y1);
  }
  return 1;
}

/* ------------------------------------------------------------------ *
 * The lookup
 * ------------------------------------------------------------------ */

// Normal CDF via erf — no dependencies, accurate to ~1e-7.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937
    + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

// Inverse normal CDF (Acklam's rational approximation).
function normalInv(p) {
  if (p <= 0 || p >= 1) return NaN;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// The median 1RM for this muscle's key lift, at this person's body weight,
// age-graded. Everything else is derived from this.
export function medianFor(muscle, { gender, bodyWeight, age } = {}) {
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  const g = gender === 'female' ? 'female' : 'male';
  const bw = Number(bodyWeight);
  if (!(bw > 0)) return null;
  const scaled = spec.median[g] * Math.pow(bw / REF_BW[g], ALLOMETRIC);
  // Age grading raises the bar for people in their prime and lowers it for
  // masters — dividing, because the coefficient scales a lift UP toward a
  // 23–40-year-old equivalent.
  return scaled / ageCoefficient(age);
}

// Percentile among people who lift, 0–100.
export function percentileFor(oneRepMax, muscle, profile) {
  const median = medianFor(muscle, profile);
  const v = Number(oneRepMax);
  if (!median || !(v > 0)) return null;
  const z = (Math.log(v) - Math.log(median)) / SIGMA;
  return Math.min(99.9, Math.max(0.1, normalCdf(z) * 100));
}

// The weight needed to reach a given percentile — the "targets" panel.
export function weightForPercentile(percentile, muscle, profile) {
  const median = medianFor(muscle, profile);
  const p = Number(percentile);
  if (!median || !(p > 0) || !(p < 100)) return null;
  return median * Math.exp(normalInv(p / 100) * SIGMA);
}

// Which level a percentile falls in. Below the first threshold is `null` —
// "Untrained" would be a rude thing to call somebody who just started.
export function levelFor(percentile) {
  const p = Number(percentile);
  if (!Number.isFinite(p)) return null;
  let found = null;
  for (const l of LEVELS) if (p >= l.percentile) found = l;
  return found;
}

export function nextLevelAfter(level) {
  if (!level) return LEVELS[0];
  const i = LEVELS.findIndex((l) => l.key === level.key);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}

// Progress through the current level, 0–1, for the bar that supplies the near
// goal. Five levels alone left +86 lb gaps; this is what makes the target close
// even when the colour has not moved.
export function levelProgress(percentile, level) {
  const next = nextLevelAfter(level);
  if (!next) return 1;
  const from = level ? level.percentile : 0;
  const span = next.percentile - from;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (percentile - from) / span));
}

// Rough percentile among ALL adults, not just people who lift. There is no
// dataset for this — nobody has measured what fraction of adults can bench 225 —
// so it is approximated from participation, treating non-trainers as sitting
// below trainers. That assumption is false at the margins (plenty of untrained
// people are naturally strong), so it OVERSTATES and must be shown rounded,
// never as a decimal.
export function generalPopulationPercentile(lifterPercentile) {
  const p = Number(lifterPercentile);
  if (!Number.isFinite(p)) return null;
  return ((1 - TRAINING_RATE) + TRAINING_RATE * (p / 100)) * 100;
}

export function canRank(muscle) {
  return Boolean(MUSCLE_LIFTS[muscle]);
}
