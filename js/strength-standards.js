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
//
// 🔄 2026-09-13 — THE STRENGTH-ACCURACY BUILD (docs/strength-accuracy-plan.md
// §3.3, §3.5, §3.10; Tim's decisions c, f and k). Four things changed in here:
//
//   1. ONE POPULATION. Every median is now Strength Level 2026's Intermediate
//      row at 180 lb (men) / 140 lb (women). The medians used to be Gravitus
//      figures — 7–9 % lower on squat, deadlift and OHP, and far lower on the
//      isolation lifts (curl 85 vs 104, shrug 225 vs 284, calf 240 vs 317,
//      close-grip 185 vs 208) — while every ratio in muscle-evidence.js was
//      derived by DIVIDING Strength Level rows. A converted estimate is in
//      Strength Level's currency; ranking it against a lower median put a
//      median Strength Level lifter at ~68th on Biceps, ~74th on Traps and
//      ~78th on Calves. Same source on both sides, or the "one population"
//      method behind the ratio table does not cancel.
//   2. A TWO-PIECE SPREAD PER LIFT AND PER SEX (`sigma` below), fitted from the
//      same five anchors. One σ = 0.32 for everything put a 140 lb woman at the
//      published Beginner bench mark at the 0.25th percentile. She is the 5th.
//   3. THE UNTRAINED MULTIPLIER BY CLASS, not one 0.55 (`UNTRAINED_FRACTION`).
//   4. "Any body weight" is captioned as what the maths does — "as if 180 lb" —
//      instead of "lifters of every size", which it never was.
//
// D15 (rank against people who lift), D20 (the comparison group is four axes
// and a true mixture) and D21 (untrained adults get their own overlapping
// distribution) all still hold; the numbers under them moved.

import { BUILT_IN_EXERCISES } from './exercises.js';
import { withUnitRounded } from './units.js';

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

// Reference body weights the anchors below are quoted at — the rows Strength
// Level publishes at 180 lb (men) and 140 lb (women), which are also the rows
// every ratio in muscle-evidence.js was derived from. Exported so a test can
// pin "as if 180 lb" to the number the maths actually uses.
export const REF_BW = { male: 180, female: 140 };

// Strength scales with roughly bodyweight^(2/3) — the surface law — not
// linearly. A plain lb-per-lb ratio would systematically flatter light lifters
// and punish heavy ones.
//
// ⚠️ NOT REVISITED ON 2026-09-13, and the old claim here ("225 at 180 lb predicts
// 199 at 150 lb, within a pound of the published figure") went with the old
// median. Against Strength Level's own rows the exponent looks steeper in the
// 140–220 lb range: bench 170 / 220 / 265 at 140 / 180 / 220 lb implies ~0.9–1.0,
// where 0.67 predicts 185 and 251. Agent G (docs/research.md §16.9) calls 0.67
// adequate for 130–230 lb and better replaced by a GL/DOTS shape; that is plan
// §6.3 work, not this build's.
const ALLOMETRIC = 0.67;

/* ── THE SPREAD: A TWO-PIECE LOGNORMAL, PER LIFT AND PER SEX — 2026-09-13 ────
 *
 * Until today one σ = 0.32 served every lift and both sexes, with Core the one
 * exception at 0.48. Fitting σ to Strength Level's own five anchors —
 * σ_p = ln(anchor_p / median) / z_p — says three things, and each one is a
 * screen being wrong (docs/research.md §16.9, agent G §d.8):
 *
 *   1. WOMEN'S SPREAD IS ~45 % WIDER ON EVERY LIFT. With σ = 0.32 a 140 lb woman
 *      at the published Beginner bench mark (44 lb — the 5th percentile by
 *      construction) read z = −2.81, the 0.25th percentile: the model called a
 *      real beginner the weakest lifter alive. Core's §14 finding was the
 *      general case, not a special one.
 *   2. THE LEFT TAIL IS WIDER THAN THE RIGHT EVERYWHERE — σ at the 5th exceeds
 *      σ at the 95th by ~0.07 (men) to ~0.17 (women). One σ over-rates the weak
 *      end and under-rates the strong end at once.
 *   3. ISOLATION LIFTS ARE WIDER THAN THE BIG THREE: OHP ≈ 0.37 / 0.30 (men),
 *      cable crunch ≈ 0.55 / 0.41, and the shrug, calf and wrist-curl tables
 *      wider still.
 *
 * So each lift and sex carries TWO log-spreads: `below` (the mean of the p5 and
 * p20 fits) for values under the median, `above` (the mean of the p80 and p95
 * fits) for values over it. The curve is continuous at the median — both halves
 * give Φ(0) = 0.5 there — and reproduces every anchor within ~1.5 percentile
 * points, against misses of up to 30 points under the single σ. The inverse
 * (`weightForPercentile`) uses the same half the percentile falls in, so the
 * targets panel and `levelFor()` round-trip exactly as they always have.
 *
 * ⚠️ The fits are COMPUTED from the anchors at load, not typed in, so the table
 * cannot drift from its source; the numbers they come out to are quoted beside
 * each row so a reader can see them without running anything.
 */
const Z = {
  5: -1.6448536269514722, 20: -0.8416212335729143,
  80: 0.8416212335729143, 95: 1.6448536269514722,
};
function fitSigma(anchors) {
  const [p5, p20, p50, p80, p95] = anchors;
  const s = (w, z) => Math.log(w / p50) / z;
  return {
    below: (s(p5, Z[5]) + s(p20, Z[20])) / 2,
    above: (s(p80, Z[80]) + s(p95, Z[95])) / 2,
  };
}

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
// Each row: the key lift, and Strength Level's five published anchors for it —
// Beginner / Novice / Intermediate / Advanced / Elite, i.e. the 5th / 20th /
// 50th / 80th / 95th percentiles of their filtered self-reports — at 180 lb
// (men) and 140 lb (women). `median` is the middle anchor; `sigma` is the
// two-piece spread fitted from the other four (see `fitSigma` above). Both are
// DERIVED from the anchors by `keyLift()` so they cannot disagree with them.
//
// 🔄 SOURCE, 2026-09-13: every anchor is from
//   https://strengthlevel.com/strength-standards/<slug>/lb
// fetched 2026-09-03 (agent C's transcription, 108 pages; the slug is beside
// each row). They replace Gravitus medians that were 7–9 % lower on the big
// lifts and up to 30 % lower on the isolation lifts — see the file header for
// why that mattered. Core's row is the same table it has carried since
// 2026-09-04 (docs/research.md §14), now in the same shape as the rest.
//
// The fitted spreads (below / above the median), so nobody has to run it:
//                        men            women
//   bench               0.324 / 0.268   0.514 / 0.392
//   bent-over row       0.353 / 0.291   0.491 / 0.371
//   squat               0.331 / 0.273   0.463 / 0.360
//   Romanian deadlift   0.375 / 0.303   0.440 / 0.342
//   deadlift            0.322 / 0.267   0.431 / 0.343
//   shoulder press      0.366 / 0.298   0.505 / 0.386
//   barbell curl        0.439 / 0.343   0.610 / 0.443
//   close-grip bench    0.302 / 0.258   0.462 / 0.353
//   barbell shrug       0.492 / 0.375   0.703 / 0.482
//   machine calf raise  0.601 / 0.433   0.755 / 0.511
//   wrist curl          0.957 / 0.593   1.347 / 0.710
//   cable crunch        0.548 / 0.409   0.619 / 0.447
//
// ⚠️ THE WRIST CURL'S SPREAD IS ENORMOUS and it is the source, not a slip:
// Strength Level's Beginner wrist curl is 17 lb for a 180 lb man and 4 lb for a
// 140 lb woman, against medians of 98 and 52. That is a page where the light
// end is dominated by people logging an empty-handed movement or a single
// plate, and where the rep-to-1RM conversion of very light sets does the rest.
// The two-piece fit reproduces the page; whether the page deserves it is a
// question for the ratio re-derivation (plan §6.3), and Forearms already
// carries the lowest ratio qualities in muscle-evidence.js. The shrug and calf
// pages are wide for the same reason at a smaller scale.
//
// `untrained` is the class the untrained multiplier uses (see
// UNTRAINED_FRACTION): 'lower' for the squat, deadlift, RDL and calf raise,
// 'upper' (the default) for everything else.
const keyLift = (lift, male, female, extra = {}) => ({
  lift,
  anchors: { male, female },
  median: { male: male[2], female: female[2] },
  sigma: { male: fitSigma(male), female: fitSigma(female) },
  ...extra,
});

export const MUSCLE_LIFTS = {
  // bench-press
  Chest:      keyLift('Barbell Bench Press', [127, 169, 220, 277, 339], [44, 72, 108, 152, 201]),
  // bent-over-row
  Back:       keyLift('Barbell Row', [108, 149, 198, 255, 315], [41, 66, 97, 134, 175]),
  // squat
  Quads:      keyLift('Back Squat', [169, 228, 298, 377, 462], [74, 114, 165, 226, 292], { untrained: 'lower' }),
  // romanian-deadlift
  Hamstrings: keyLift('Romanian Deadlift', [147, 207, 280, 364, 455], [71, 106, 151, 203, 261], { untrained: 'lower' }),
  // Deadlift belongs to glutes, hamstrings and back at once. It fills Glutes
  // because hip-thrust standards are the thinnest of the three, and because it
  // is the best-documented lift in existence. Revisit with the weighted map.
  // deadlift
  Glutes:     keyLift('Deadlift', [201, 268, 348, 438, 535], [93, 139, 196, 264, 338], { untrained: 'lower' }),
  // shoulder-press
  Shoulders:  keyLift('Overhead Press', [75, 104, 140, 181, 226], [29, 47, 70, 98, 129]),
  // barbell-curl
  Biceps:     keyLift('Barbell Curl', [49, 73, 104, 140, 180], [18, 33, 53, 78, 107]),
  // close-grip-bench-press
  Triceps:    keyLift('Close-Grip Bench Press', [124, 163, 208, 260, 314], [48, 73, 106, 144, 186]),
  // barbell-shrug
  Traps:      keyLift('Barbell Shrug', [121, 192, 284, 394, 515], [41, 83, 143, 218, 306]),
  // machine-calf-raise — Strength Level's standing (machine) calf raise page,
  // which is the page the seated-calf ratio in muscle-evidence.js was divided
  // by, so it is the page this key lift has always meant.
  Calves:     keyLift('Standing Calf Raise', [110, 198, 317, 463, 629], [50, 108, 193, 303, 430], { untrained: 'lower' }),
  // wrist-curl
  Forearms:   keyLift('Wrist Curl', [17, 48, 98, 166, 246], [4, 20, 52, 98, 156]),

  /* 🚨 CORE — RANKABLE SINCE 2026-09-04, AND IT IS THE ONLY ENTRY IN THIS TABLE
   * THAT CARRIES ITS OWN RELIABILITY PENALTY.
   *
   * Tim: *"set a good 1RM estimator for the ab muscle group for a specific
   * exercise… This makes the ab muscle group nearly identical to any other
   * muscle group and how it operates but with a little less reliability."* This
   * is that, and the fields below are where "a little less reliability" stops
   * being a sentence and becomes arithmetic. docs/research.md §14 has the pull;
   * the short version:
   *
   * ⚠️ `median` IS MEASURED, NOT MODELLED. Strength Level's Cable Crunch table,
   * 12,596 qualifying results out of 211,507 logged lifts (Oct 2019 – Mar 2026):
   * at 180 lb male 58/98/151/216/288, at 140 lb female 36/65/106/157/214.
   *
   * 🚨 BUT IT HAS NO AGREEING SECOND SOURCE, WHICH EVERY OTHER ROW HERE DOES.
   * §11's whole argument for this table is that two independent methods land
   * within ~3 % lift by lift. The only cross-check for a cable crunch (Fitness
   * Volt, 178/123) is **17 % higher** — and it is not really independent, being
   * ratio-modelled off powerlifting anchors rather than measured for this lift.
   * So: the measured source wins, and the disagreement is carried as
   * `standardQuality` rather than hidden.
   *
   * 🔄 `sigma` — UNTIL 2026-09-13 THIS WAS THE ONE ROW WITH ITS OWN SPREAD, a
   * single 0.48 fitted to these anchors, because reusing the global 0.32 put a
   * lifter sitting exactly on the published Beginner mark at the 0.1st
   * percentile. Every row carries its own two-piece pair now (0.548 / 0.409 for
   * men, 0.619 / 0.447 for women here), so the special case became the rule.
   * The spread is still genuinely wider than a barbell lift's: this is a stack
   * on a pulley whose leverage depends on rope length, knee position and how
   * much of the movement is hip flexion.
   *
   * ⚠️ `standardQuality` MULTIPLIES THE RATING'S CONFIDENCE, so a Core reading
   * with flawless evidence still lands below one from a bench press. That is the
   * honest shape of "less reliable": it is not the lifter's evidence that is
   * thin, it is the standard, and no amount of extra logging can fix it — which
   * is exactly why it belongs on the muscle and not on the observation.
   */
  // cable-crunch
  Core: keyLift('Cable Crunch', [58, 98, 151, 216, 288], [36, 65, 106, 157, 214], {
    standardQuality: 0.6,
    // Shown under a Core rating, every time. Not a tooltip: the one thing a
    // user must not do with this number is treat it like the bench figure.
    caveat: 'Core standards are thinner than the rest — one measured source, and '
      + 'a cable stack depends on the machine. Treat it as a rough placing.',
  }),
  // Neck has no usable published standards — nobody publishes neck norms — so it
  // stays unranked permanently, and the UI says so rather than looking broken.
};

// ⚠️ 'Activity' joins these the day it exists, not later. A group that is not
// in this list is a group the map will try to RANK — and there is no published
// standard that turns a 40-minute hike into a percentile. D27.
//
// 🔄 CORE LEFT THIS LIST ON 2026-09-04. It is not a general loosening: Core left
// because a measured table for a weighted core lift was found and pulled, which
// is the same bar every other entry cleared. Neck is still here and there is no
// route out for it.
export const UNRANKABLE = ['Neck', 'Cardio', 'Activity'];

/**
 * The log-space spread to rank this muscle with: one number, for the sex and
 * the side of the median asked for.
 *
 * 🔄 PER LIFT, PER SEX AND PER SIDE SINCE 2026-09-13. Until 2026-09-04 there was
 * one σ; Core then got its own; now every row carries a { below, above } pair
 * for each sex, fitted from its anchors. The one-argument call still works —
 * `sigmaFor('Chest')` is the men's below-median spread — so the callers and
 * tests that only ever wanted "how wide is this lift" keep a number. Null for a
 * muscle that has no standard.
 */
export function sigmaFor(muscle, gender = 'male', side = 'below') {
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  const g = gender === 'female' ? 'female' : 'male';
  return spec.sigma[g][side === 'above' ? 'above' : 'below'];
}

/**
 * How much to trust the STANDARD for this muscle, 0–1, independent of how good
 * the lifter's own evidence is. Multiplied into the rating's confidence.
 *
 * ⚠️ TWO DIFFERENT DOUBTS, AND CONFLATING THEM WOULD BE THE BUG. "You logged one
 * set six weeks ago" is fixable by logging more; "no second source agrees about
 * where the middle is" is not, and telling somebody to record another set would
 * be answering the wrong question. `raiseConfidenceHint()` says so for Core.
 */
export function standardQualityFor(muscle) {
  const spec = MUSCLE_LIFTS[muscle];
  return spec && typeof spec.standardQuality === 'number' ? spec.standardQuality : 1;
}

/** The muscle-level caveat that must travel with the number, or null. */
export function standardCaveatFor(muscle) {
  const spec = MUSCLE_LIFTS[muscle];
  return spec && spec.caveat ? spec.caveat : null;
}

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

/* ------------------------------------------------------------------ *
 * Who you are being compared against
 * ------------------------------------------------------------------ */

// Tim, 2026-08-17: the comparison group should be the user's choice, defaulting
// to people like them. Three independent axes, each defaulting to `own`.
//
// Note what "all" means on the SEX axis: men and women together. It does NOT
// mean the general population — that is a separate, clearly-labelled readout
// (generalPopulationPercentile), and D15 still forbids re-tiering against it.
// FOUR axes (Tim, 2026-08-17, revising the first cut). "People like me" is gone
// as an option — it was doing two jobs, quietly meaning "your sex" while reading
// like a whole preset. It is a PRESET now, at the top of the sheet, alongside
// "Everyone", and each axis says one plain thing.
//
// `sex: 'own'` survives as the UNSET value only. It never appears in the UI; it
// resolves to the user's own sex so that someone who has never opened the sheet
// gets the sensible default, and picking a preset writes a concrete value.
export const COMPARE_DEFAULT = { pool: 'lifters', sex: 'own', weight: 'own', age: 'own' };

export const COMPARE_OPTIONS = {
  pool: [
    { key: 'lifters', name: 'People who lift' },
    { key: 'everyone', name: 'Everyone' },
  ],
  sex: [
    { key: 'male', name: 'Men' },
    { key: 'female', name: 'Women' },
    { key: 'all', name: 'Both' },
    // Not offered in the UI; the stored default before anything is chosen.
    { key: 'own', name: 'My sex', hidden: true },
  ],
  weight: [
    { key: 'own', name: 'My body weight' },
    { key: 'any', name: 'Any body weight' },
  ],
  age: [
    { key: 'own', name: 'My age' },
    { key: 'any', name: 'Any age' },
  ],
};

/* ── COMPARISON GROUPS AS KEYS — 2026-09-03 ──────────────────────────────────
 *
 * 🚨 WHY A COMPARISON GROUP NEEDS A NAME YOU CAN PUT IN A DOCUMENT. Tim asked
 * that a viewer be able to apply *"any comparison combination that is already
 * available"* to somebody ELSE's body map. A percentile is a ratio to that
 * person's own body weight and age, so the viewer's device cannot compute one
 * without both — and body weight is the one number the public document
 * deliberately does not carry (js/social.js).
 *
 * So the owner computes every combination on their own device, where those
 * numbers already are, and publishes the answers keyed by these strings. Both
 * sides of that exchange call the functions below, which is what stops a
 * publisher and a reader disagreeing about what "lifters|male|own|own" means.
 *
 * ⚠️ `own` ON THE WEIGHT AND AGE AXES MEANS "THE PERSON THE MAP IS ABOUT", not
 * the person reading it. That is already true of the label on your own screen
 * and it is what makes a published grid meaningful at all.
 */

/** The 24 concrete combinations the sheet can produce. `sex: 'own'` is resolved. */
export function allCompareCombos() {
  const out = [];
  for (const pool of COMPARE_OPTIONS.pool) {
    for (const sex of COMPARE_OPTIONS.sex) {
      if (sex.hidden) continue;
      for (const weight of COMPARE_OPTIONS.weight) {
        for (const age of COMPARE_OPTIONS.age) {
          out.push({ pool: pool.key, sex: sex.key, weight: weight.key, age: age.key });
        }
      }
    }
  }
  return out;
}

/**
 * A comparison group as one string.
 *
 * ⚠️ `ownSex` RESOLVES THE UNSET VALUE, and passing it is not optional when the
 * key has to match a published grid: `sex: 'own'` is the stored default for
 * anybody who has never opened the sheet, and no grid row is keyed on it.
 * Reading a friend's map, "own" means THEIR sex, which their document states in
 * `strength.defaultCompare`.
 */
export function compareKey(compare, ownSex) {
  const c = normalizeCompare(compare);
  const sex = c.sex === 'own'
    ? (ownSex === 'female' ? 'female' : ownSex === 'all' ? 'all' : 'male')
    : c.sex;
  return `${c.pool}|${sex}|${c.weight}|${c.age}`;
}

/** The other half — back into the four axes, normalised. */
export function parseCompareKey(key) {
  const [pool, sex, weight, age] = String(key || '').split('|');
  return normalizeCompare({ pool, sex, weight, age });
}

/* The presets the sheet offers at the top. "Like me" writes the user's own sex,
 * so it needs the profile.
 *
 * 🚨 `each` IS THE THIRD, ADDED 2026-09-05, AND IT IS THE ONE THAT KEEPS
 * `sex: 'own'` UNRESOLVED. Every other preset writes a concrete sex, which is
 * correct when one body is on screen and wrong when two are: resolving it means
 * both people get ranked against the SAME population, so a woman and a man are
 * both measured against whichever the viewer happens to be.
 *
 * Tim, 2026-09-05: *"when I said the default was comparing against people
 * similar to the users, I was meaning that each account would compare themselves
 * against people like them… Right now both people are being compared to the same
 * people."* That was his original instruction on 2026-09-03 and it was built one
 * reading off.
 *
 * ⚠️ WEIGHT AND AGE WERE ALREADY PER-PERSON AND ONLY SEX WAS NOT, which is why
 * the fault was easy to miss. `weight: 'own'` and `age: 'own'` are resolved by
 * the OWNER when they publish their grid — "at my body weight, my age" — so
 * those two axes have always meant each person's own. Sex is the only axis the
 * READER resolves, and `comparePreset()` was resolving it eagerly.
 */
export function comparePreset(name, profile) {
  const own = profile && profile.gender === 'female' ? 'female' : 'male';
  if (name === 'everyone') return { pool: 'everyone', sex: 'all', weight: 'any', age: 'any' };
  // ⚠️ 'own' IS KEPT LITERALLY. compareKey() resolves it per document against
  // that document's own `defaultCompare`, so the same object produces a
  // different key for each body it is applied to. That is the whole mechanism.
  if (name === 'each') return { pool: 'lifters', sex: 'own', weight: 'own', age: 'own' };
  return { pool: 'lifters', sex: own, weight: 'own', age: 'own' };
}

export function matchesPreset(compare, name, profile) {
  const a = normalizeCompare(compare);
  const b = comparePreset(name, profile);

  /* ⚠️ `each` MATCHES ON THE LITERAL 'own', NOT ON THE RESOLVED SEX, and that is
   * the difference between it and "Like me" — for the viewer's own body the two
   * describe the identical population, and only the unresolved form stays
   * per-person when it is applied to somebody else. */
  if (name === 'each') {
    return a.sex === 'own' && a.pool === b.pool && a.weight === b.weight && a.age === b.age;
  }

  /* ⚠️ AND "Like me" STILL MATCHES 'own' — deliberately, and this is load-bearing
   * for the screen that has only one body on it. `sex: 'own'` is the stored value
   * for anybody who has never opened the sheet, so tightening this to a concrete
   * sex would leave a brand-new user's own muscle map showing NO preset selected.
   * Where both presets are on offer, the sheet resolves the tie by testing
   * `each` first — see pressedPreset() in views-muscles.js. */
  const sexA = a.sex === 'own' ? (profile && profile.gender === 'female' ? 'female' : 'male') : a.sex;
  return sexA === b.sex && a.pool === b.pool && a.weight === b.weight && a.age === b.age;
}

// The share of people who lift and log who are men. Used ONLY to combine the
// two sexes into one population when the user asks to be compared against
// everyone — a mixture, so that no fictional "combined median" has to be
// invented for a distribution that is genuinely bimodal.
//
// ⚠️ THIS IS AN ASSUMPTION, not a measurement. US strength-training
// participation is close to even (NHIS), but barbell logging skews male. It
// affects only the `sex: 'all'` option, and only by shifting the percentile a
// few points; every other comparison is unaffected.
export const MALE_SHARE = 0.55;

export function normalizeCompare(compare) {
  const c = compare && typeof compare === 'object' ? compare : {};
  const pick = (axis) => (COMPARE_OPTIONS[axis].some((o) => o.key === c[axis])
    ? c[axis] : COMPARE_DEFAULT[axis]);
  return { pool: pick('pool'), sex: pick('sex'), weight: pick('weight'), age: pick('age') };
}

/* ------------------------------------------------------------------ *
 * RANKING SOMEBODY WHOSE PROFILE IS INCOMPLETE — 2026-09-06
 * ------------------------------------------------------------------ *
 *
 * 🚨 THE MAP USED TO REFUSE THE WHOLE BODY OVER TWO MISSING SETTINGS. No sex or
 * no weigh-in and `muscleStrength()` returned `ready: false`, so an account
 * holding a year of recorded sets was shown "Tell us about you first" and
 * nothing else. docs/direction.md §3.1 is the instruction that reverses that:
 * *"It's about getting the BEST numbers we can… When our numbers aren't as
 * perfect, have a way to be upfront about it but something is always better than
 * nothing."* The half he kept is the labelling, so this function's OTHER job —
 * the one it exists for as much as the substitution — is to return the list of
 * what it had to assume, so the screen can say it.
 *
 * The two gaps are NOT the same kind of gap, and that is the whole design:
 *
 * 🚨 BODY WEIGHT — NOTHING IS SAVED, AND WHAT IS ASSUMED IS SAID. A guessed
 * body weight would be a number with no source, and every percentile on the
 * screen is a ratio to it. So the weight AXIS is forced to `any` instead, and
 * `refBodyWeight()` reads that as the reference body weight — 180 lb for a man,
 * 140 lb for a woman — with no allometric scaling.
 *
 * ⚠️ CORRECTED 2026-09-13 (plan §3.3, decision c). This comment used to call
 * that "a real, nameable comparison group — lifters of every size", and the
 * caption said the same. It is not what the maths does. There is no
 * integration over body weights anywhere in this file: `any` ranks the lift
 * exactly as a 180 lb man's (or 140 lb woman's) would be ranked, and the demo's
 * 232 lb bench reads p54 under it whether the lifter really weighs 150 or 250.
 * So the sentence on screen now says "as if 180 lb". The profile field itself
 * is still never filled — see `bodyWeight` below — which is what keeps this an
 * assumption rather than a measurement.
 *
 * ⚠️ SEX — ASSUMED, AND IT MUST BE STATED. There is no ungraded option here to
 * fall back to: every entry in `MUSCLE_LIFTS` is a male/female PAIR, so a
 * percentile cannot be computed without picking one. Male is the modal answer
 * rather than a judgement — `MALE_SHARE` above already records that the people
 * who lift and log skew male — and it is what `populations()` has always
 * silently fallen back to when `gender` is null. This makes that fallback
 * explicit and, more to the point, REPORTABLE: silent was the fault.
 *
 * 🛑 NOTHING HERE IS WRITTEN BACK. This is a render-time overlay on a profile,
 * not a repair of one: `missing` is passed through untouched, so the account
 * screen still asks for the two settings and the note below the map still says
 * they are absent. An assumption that got saved would stop being an assumption.
 *
 * 🚨 AND A MAP BUILT ON ONE MUST NOT BE PUBLISHED — see `buildStrengthShare()`
 * in js/store.js, which refuses on `assumed`. A reader of somebody else's map
 * cannot check it against anything, and a silently-different comparison group is
 * the exact fault js/shared-map.js exists to prevent.
 *
 * @param {object} profile  as `store.getProfile()` returns it
 * @returns {object} the same profile, plus `assumed` — a subset of
 *   ['sex', 'body weight'], empty when nothing had to be assumed.
 */
export function withAssumptions(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const out = { ...p };
  const assumed = [];

  if (!p.gender) {
    out.gender = 'male';
    assumed.push('sex');
  }
  // Not `p.missing`: this module is pure and this is the condition that actually
  // breaks the arithmetic — `medianForPopulation()` refuses a body weight that
  // is not a positive number, whatever the store thought it had.
  if (!(Number(p.bodyWeight) > 0)) {
    out.compare = { ...normalizeCompare(p.compare), weight: 'any' };
    assumed.push('body weight');
  }

  out.assumed = assumed;
  return out;
}

/**
 * What had to be assumed, in words, or null.
 *
 * ⚠️ TWO SENTENCES RATHER THAN ONE LIST, because the two gaps are different
 * kinds of gap and one list would flatten that: "assumed male" is a value the
 * app picked and will use everywhere; "as if you weigh 180 lb" is a stand-in
 * the ranking used for this reading only, and the profile still has no weight.
 *
 * 🔄 2026-09-13: THE SECOND SENTENCE SAYS WHAT THE MATHS DOES. It used to read
 * "compared against lifters of every size", which described a comparison group
 * this file never computes — the reference weight is substituted and nothing
 * is integrated over. The reference is the sex's own (`REF_BW`), so a woman
 * with no weigh-in is told 140 lb, not 180. Through units.js, so a kilogram
 * user reads "82 kg".
 *
 * It lives in `comparisonLabel()`'s return rather than on the screen so that the
 * caption naming the comparison group and the line admitting how that group was
 * arrived at come out of one function and cannot drift apart.
 */
function assumptionNote(profile) {
  const assumed = (profile && Array.isArray(profile.assumed)) ? profile.assumed : [];
  if (!assumed.length) return null;
  const bits = [];
  if (assumed.includes('sex')) {
    bits.push('Assumed male — your sex is not on your profile.');
  }
  if (assumed.includes('body weight')) {
    const g = profile.gender === 'female' ? 'female' : 'male';
    bits.push(`Ranked as if you weigh ${withUnitRounded(REF_BW[g])} — no weigh-in on record.`);
  }
  return bits.join(' ');
}

// The reference population as a MIXTURE: a list of { gender, trained, share }.
// One entry for the simple case, up to four for "everyone, both sexes".
//
// The two axes multiply. Sex splits the population by sex; pool splits it into
// people who train and people who do not. Note the sex split DIFFERS between
// the two: lifters skew male, adults in general do not.
function populations(profile) {
  const c = normalizeCompare(profile && profile.compare);
  const own = profile && profile.gender === 'female' ? 'female' : 'male';
  const pools = c.pool === 'everyone'
    ? [{ trained: true, share: TRAINING_RATE }, { trained: false, share: 1 - TRAINING_RATE }]
    : [{ trained: true, share: 1 }];

  const out = [];
  for (const p of pools) {
    const maleShare = p.trained ? MALE_SHARE : 0.5;
    const sexes = c.sex === 'all'
      ? [{ gender: 'male', share: maleShare }, { gender: 'female', share: 1 - maleShare }]
      : [{ gender: c.sex === 'own' ? own : c.sex, share: 1 }];
    for (const s of sexes) {
      out.push({ gender: s.gender, trained: p.trained, share: p.share * s.share });
    }
  }
  return out;
}

// "Any body weight" is not a missing value — it is the reference body weight,
// 180 lb for a man and 140 lb for a woman, with no allometric scaling applied.
// ⚠️ It does NOT widen the comparison to lifters of every size (the old comment
// here said so, and was wrong — nothing in this file integrates over body
// weight); it ranks the lift as a 180 lb man's would be ranked, and the caption
// says exactly that. Same for age: "any age" is the ungraded standard, not age
// zero.
function refBodyWeight(profile, gender) {
  const c = normalizeCompare(profile && profile.compare);
  if (c.weight === 'any') return REF_BW[gender];
  return Number(profile && profile.bodyWeight);
}

function refAge(profile) {
  const c = normalizeCompare(profile && profile.compare);
  if (c.age === 'any') return null;
  return profile ? profile.age : null;
}

// What the median UNTRAINED adult lifts, as a fraction of the median lifter —
// by CLASS of lift and by sex, since 2026-09-13 (plan §3.10, decision k).
//
// ⚠️ STILL THE WEAKEST NUMBER IN THIS FILE, but for a corrected reason. D21's
// note used to say "nobody has measured what the median adult can bench,
// because the median adult has never tried". That is false: untrained cohorts
// have been measured repeatedly. What is missing is a REPRESENTATIVE sample —
// every cohort is college students or study volunteers, and none is a random
// draw of adults. The measured cohorts, each against the Strength Level median
// at that cohort's body weight (docs/research.md §16.10, agent G §e):
//
//   Mayhew 2008 (JSCR 22(5)), 103 untrained women, bench 28.7 kg → 0.60–0.64
//   Ribeiro 2024 (IUSCA), 62 untrained women, bench 29.4 kg   → 0.68
//   Ribeiro 2024, 57 untrained men, bench 68.9 kg             → 0.75
//   PMC10749963, 26 active non-lifting men: bench 71 kg → 0.70, bent-over
//     row 69 kg → 0.75, BACK SQUAT 111 kg → 0.91
//   PMC10630871, 22 untrained men, bench 54.8 kg              → 0.55–0.60
//   PMC9486837, 29 male students at 63 kg, bench 44.6 kg      → 0.52
//
// So: men's upper-body pressing and rows 0.52–0.75 (sedentary at the bottom,
// active non-lifters at the top) → 0.60; women's pressing 0.60–0.68 → 0.62;
// the lower body ~0.9 on the one free-weight squat measured → 0.85, held a
// little under the single reading. Nobody has measured an untrained deadlift,
// RDL or calf raise; those carry the squat's class figure and say so here.
// Biceps, triceps, traps, forearms and core have no untrained cohort at all
// and carry the upper-body figure.
//
// The untrained population keeps the SAME two-piece spread as the trained one
// for that lift and sex. There is no cohort large enough to fit a spread to,
// and the SDs the studies report (bench ±23 % in Mayhew, ±22 % in Ribeiro) sit
// inside the lifter spread rather than outside it.
//
// It exists because the alternative was worse. The previous general-population
// readout assumed every non-lifter sits BELOW every lifter, which forced any
// lifter at all above the 68th percentile and made the seven levels collapse
// into the top three — the exact objection in D15. Giving untrained people their
// own overlapping distribution lets a beginner read as a beginner.
const UNTRAINED_FRACTION = {
  upper: { male: 0.60, female: 0.62 },
  lower: { male: 0.85, female: 0.85 },
};

/** The untrained multiplier this muscle's key lift uses, by sex. */
export function untrainedFractionFor(muscle, gender) {
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  const g = gender === 'female' ? 'female' : 'male';
  return UNTRAINED_FRACTION[spec.untrained === 'lower' ? 'lower' : 'upper'][g];
}

function medianForPopulation(muscle, gender, bodyWeight, age, trained = true) {
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  const g = gender === 'female' ? 'female' : 'male';
  const bw = Number(bodyWeight);
  if (!(bw > 0)) return null;
  const scaled = spec.median[g] * Math.pow(bw / REF_BW[g], ALLOMETRIC);
  // Age grading raises the bar for people in their prime and lowers it for
  // masters — dividing, because the coefficient scales a lift UP toward a
  // 23–40-year-old equivalent.
  return (scaled / ageCoefficient(age)) * (trained ? 1 : untrainedFractionFor(muscle, g));
}

// The two-piece lognormal, forward and back. `sigma` is a { below, above }
// pair; the half used is the half the value (or the percentile) falls in, and
// the two halves meet at the median, so the CDF is continuous and strictly
// increasing — which is what lets the mixture inverse below bisect on it.
function lognormalCdf(v, median, sigma) {
  const z = Math.log(v / median) / (v < median ? sigma.below : sigma.above);
  return normalCdf(z);
}
function lognormalInv(p, median, sigma) {
  return median * Math.exp(normalInv(p) * (p < 0.5 ? sigma.below : sigma.above));
}

// The median 1RM for this muscle's key lift, at this person's body weight,
// age-graded. With a mixed reference population there is no single median that
// means anything, so this reports the one for the FIRST population — callers
// that need a true answer under mixing should ask weightForPercentile(50).
export function medianFor(muscle, profile = {}) {
  const pops = populations(profile);
  return medianForPopulation(muscle, pops[0].gender,
    refBodyWeight(profile, pops[0].gender), refAge(profile), pops[0].trained);
}

// Percentile among the chosen comparison group, 0–100.
//
// A mixture over populations (D20): each population's share × its own CDF,
// and each population uses ITS OWN SEX's two-piece spread — a man ranked
// against "both" is placed under the men's curve and the women's curve
// separately, then the two are share-weighted.
export function percentileFor(oneRepMax, muscle, profile) {
  const v = Number(oneRepMax);
  if (!(v > 0)) return null;
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  let p = 0;
  for (const pop of populations(profile)) {
    const median = medianForPopulation(muscle, pop.gender,
      refBodyWeight(profile, pop.gender), refAge(profile), pop.trained);
    if (!median) return null;
    p += pop.share * lognormalCdf(v, median, spec.sigma[pop.gender]);
  }
  return Math.min(99.9, Math.max(0.1, p * 100));
}

// The weight needed to reach a given percentile — the "targets" panel, and the
// weight a goal freezes (js/goals.js).
export function weightForPercentile(percentile, muscle, profile) {
  const p = Number(percentile);
  if (!(p > 0) || !(p < 100)) return null;
  const spec = MUSCLE_LIFTS[muscle];
  if (!spec) return null;
  const pops = populations(profile);
  const medians = pops.map((pop) =>
    medianForPopulation(muscle, pop.gender,
      refBodyWeight(profile, pop.gender), refAge(profile), pop.trained));
  if (medians.some((m) => !m)) return null;

  // One population still has a closed form, and it is kept: the targets panel
  // and levelFor() are held together by a round-trip whose error budget was
  // measured against exactly this expression (see BOUNDARY_EPSILON). It inverts
  // the same half of the curve percentileFor() would read the answer under.
  if (pops.length === 1) return lognormalInv(p / 100, medians[0], spec.sigma[pops[0].gender]);

  // A mixture has no closed-form inverse. Its CDF is strictly increasing in
  // weight, so bisection always converges, and 80 halvings take the bracket
  // below 1e-18 of a pound — far tighter than the closed form's own error.
  const target = p / 100;
  let lo = 1e-6, hi = 1e6;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    let cdf = 0;
    for (let j = 0; j < pops.length; j++) {
      cdf += pops[j].share * lognormalCdf(mid, medians[j], spec.sigma[pops[j].gender]);
    }
    if (cdf < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// How to describe the comparison on screen. The screen must never imply the
// comparison is against everyone alive, so the noun is always "who lift".
export function comparisonLabel(profile) {
  const c = normalizeCompare(profile && profile.compare);
  const own = profile && profile.gender === 'female' ? 'female' : 'male';
  const sex = c.sex === 'own' ? own : c.sex;
  /* ⚠️ ON EVERY BRANCH, INCLUDING THE PER-PERSON ONE. This is the sentence that
   * stops "vs. men who lift" reading as a fact about the reader when the app
   * picked the sex itself (withAssumptions above). Null for a complete profile,
   * which is every friend's map — theirs was computed on their own device from
   * their own settings, so nothing on that screen was ever assumed here. */
  const assumed = assumptionNote(profile);

  /* 🚨 THE PER-PERSON CASE HAS ITS OWN SENTENCE, because every other branch of
   * this function names ONE population and this one deliberately does not.
   *
   * It fires only where two bodies are on screen (`whose === 'each'`) AND the
   * sex axis is still the unresolved 'own' — i.e. the `each` preset. Falling
   * through would print "vs. men who lift" over a pair that includes a woman,
   * which is the exact fault this label exists to prevent: the caption naming a
   * population the colours were not computed against.
   *
   * ⚠️ IT NAMES ALL THREE AXES rather than only sex. Weight and age were always
   * per-person here; saying so is what stops somebody reading the change as
   * "sex is now handled" and assuming the other two are shared. */
  if (c.sex === 'own' && (profile && profile.whose) === 'each') {
    return {
      main: c.pool === 'lifters' ? 'vs. people like each of them' : 'vs. adults like each of them',
      sub: 'each against their own sex, body weight and age',
      pool: c.pool,
      assumed,
      isDefault: c.pool === 'lifters' && c.weight === 'own' && c.age === 'own',
    };
  }

  // The noun states the pool outright. This screen's oldest rule is that it must
  // never imply a ranking against everyone when it means lifters — so now that
  // ranking against everyone is genuinely on offer, the words have to carry the
  // difference every single time.
  const lifts = c.pool === 'lifters';
  const who = sex === 'all'
    ? (lifts ? 'men and women who lift' : 'all adults')
    : sex === 'female'
      ? (lifts ? 'women who lift' : 'all women')
      : (lifts ? 'men who lift' : 'all men');

  /* ⚠️ "whose" IS A PARAMETER SINCE 2026-09-03, and it is not cosmetic. This
   * label is now printed over SOMEBODY ELSE's body map, where the two `own` axes
   * mean their body weight and their age — neither of which this device has, and
   * body weight is deliberately not in a public document at all. Saying "your
   * body weight" over a friend's figure would name the wrong person's number as
   * the basis of what is on screen. */
  const whose = (profile && profile.whose) || 'your';
  const bits = [];
  /* 🔄 2026-09-13: "any body weight" SAYS WHAT IT DOES — "(as if 180 lbs)". The
   * option keeps its name so it matches the sheet, and the bracket is the
   * arithmetic: the reference weight is substituted, nothing is averaged over.
   * Against both sexes it names both references, because the men's curve is
   * read at 180 and the women's at 140 in the same mixture. Through units.js,
   * like the body-weight figure beside it, so a kilogram user reads kilograms. */
  const asIf = sex === 'all'
    ? `as if ${withUnitRounded(REF_BW.male)} for men, ${withUnitRounded(REF_BW.female)} for women`
    : `as if ${withUnitRounded(REF_BW[sex === 'female' ? 'female' : 'male'])}`;
  bits.push(c.weight === 'any' ? `any body weight (${asIf})`
    : (profile && profile.bodyWeight ? withUnitRounded(profile.bodyWeight) : `${whose} body weight`));
  /* ⚠️ AND THE AGE FALLBACK IS NOT THE SAME SENTENCE ON THE TWO SCREENS, which
   * looks like an inconsistency and is the opposite of one. On YOUR map, no
   * recorded age means no age grading was applied — "any age" is the literal
   * truth. On somebody else's, the axis says `own` and THEIR client applied
   * THEIR age; this device simply does not know what it was. Printing "any age"
   * there would state that a correction was skipped when it was not. */
  bits.push(c.age === 'any' ? 'any age'
    : (profile && profile.age
      ? `around ${profile.age}`
      : (whose === 'your' ? 'any age' : `${whose} age`)));

  return {
    main: `vs. ${who}`,
    sub: bits.join(' · '),
    pool: c.pool,
    assumed,
    isDefault: c.pool === 'lifters' && c.weight === 'own' && c.age === 'own'
      && (c.sex === 'own' || c.sex === own),
  };
}

// Which level a percentile falls in. Below the first threshold is `null` —
// "Untrained" would be a rude thing to call somebody who just started.
// The epsilon is not cosmetic. The normal CDF is a rational approximation, so a
// lift sitting exactly on a threshold comes back as 49.999999947 rather than 50
// — and a strict `>=` would show that person Novice while the screen beside it
// reads "50th percentile". Worse, hitting the exact weight the targets panel
// asked for would fail to grant the level, which reads as the app being broken.
// Sized from measurement, not guesswork. The Abramowitz–Stegun CDF used here
// has an absolute error around 7.5e-8 in probability — 7.5e-6 in percentage
// points — and composing it with the inverse pushes the observed round-trip
// error to ~6.6e-6 at the tails. 1e-4 clears that with room to spare while
// staying four orders of magnitude below any percentile difference a person
// could care about.
const BOUNDARY_EPSILON = 1e-4;

export function levelFor(percentile) {
  const p = Number(percentile);
  if (!Number.isFinite(p)) return null;
  let found = null;
  for (const l of LEVELS) if (p >= l.percentile - BOUNDARY_EPSILON) found = l;
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

// ⚠️ SUPERSEDED 2026-08-17 by the `pool` axis, and kept only so the difference
// is on the record. This treated every non-lifter as weaker than every lifter,
// which forced ANY lifter above the 68th percentile of adults and squashed the
// seven levels into the top three. The pool axis instead gives untrained adults
// their own overlapping distribution, so a beginner reads as a beginner. Nothing
// in the app calls this any more.
export function generalPopulationPercentile(lifterPercentile) {
  const p = Number(lifterPercentile);
  if (!Number.isFinite(p)) return null;
  return ((1 - TRAINING_RATE) + TRAINING_RATE * (p / 100)) * 100;
}

export function canRank(muscle) {
  return Boolean(MUSCLE_LIFTS[muscle]);
}
