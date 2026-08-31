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

// ⚠️ 'Activity' joins these the day it exists, not later. A group that is not
// in this list is a group the map will try to RANK — and there is no published
// standard that turns a 40-minute hike into a percentile. D27.
export const UNRANKABLE = ['Core', 'Neck', 'Cardio', 'Activity'];

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

// The two presets the sheet offers at the top. "Like me" writes the user's own
// sex, so it needs the profile.
export function comparePreset(name, profile) {
  const own = profile && profile.gender === 'female' ? 'female' : 'male';
  if (name === 'everyone') return { pool: 'everyone', sex: 'all', weight: 'any', age: 'any' };
  return { pool: 'lifters', sex: own, weight: 'own', age: 'own' };
}

export function matchesPreset(compare, name, profile) {
  const a = normalizeCompare(compare);
  const b = comparePreset(name, profile);
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

// "Any body weight" is not a missing value — it means compare against lifters of
// every size, which is exactly the reference median with no allometric scaling
// applied. Same for age: "any age" is the ungraded standard, not age zero.
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

// What the median UNTRAINED adult lifts, as a fraction of the median lifter.
//
// ⚠️ WEAKEST NUMBER IN THIS FILE. Nobody has measured what the median adult can
// bench, because the median adult has never tried. It is anchored on untrained
// baselines from training studies — first-session loads typically land around
// half to two-thirds of a trained lifter's median — and it is one number for
// every lift, which is certainly wrong in detail.
//
// It exists because the alternative was worse. The previous general-population
// readout assumed every non-lifter sits BELOW every lifter, which forced any
// lifter at all above the 68th percentile and made the seven levels collapse
// into the top three — the exact objection in D15. Giving untrained people their
// own overlapping distribution lets a beginner read as a beginner. The estimate
// is rough; the SHAPE is much closer to right.
const UNTRAINED_FRACTION = 0.55;

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
  return (scaled / ageCoefficient(age)) * (trained ? 1 : UNTRAINED_FRACTION);
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
export function percentileFor(oneRepMax, muscle, profile) {
  const v = Number(oneRepMax);
  if (!(v > 0)) return null;
  let p = 0;
  for (const pop of populations(profile)) {
    const median = medianForPopulation(muscle, pop.gender,
      refBodyWeight(profile, pop.gender), refAge(profile), pop.trained);
    if (!median) return null;
    p += pop.share * normalCdf((Math.log(v) - Math.log(median)) / SIGMA);
  }
  return Math.min(99.9, Math.max(0.1, p * 100));
}

// The weight needed to reach a given percentile — the "targets" panel.
export function weightForPercentile(percentile, muscle, profile) {
  const p = Number(percentile);
  if (!(p > 0) || !(p < 100)) return null;
  const pops = populations(profile);
  const medians = pops.map((pop) =>
    medianForPopulation(muscle, pop.gender,
      refBodyWeight(profile, pop.gender), refAge(profile), pop.trained));
  if (medians.some((m) => !m)) return null;

  // One population still has a closed form, and it is kept: the targets panel
  // and levelFor() are held together by a round-trip whose error budget was
  // measured against exactly this expression (see BOUNDARY_EPSILON).
  if (pops.length === 1) return medians[0] * Math.exp(normalInv(p / 100) * SIGMA);

  // A mixture has no closed-form inverse. Its CDF is strictly increasing in
  // weight, so bisection always converges, and 80 halvings take the bracket
  // below 1e-18 of a pound — far tighter than the closed form's own error.
  const target = p / 100;
  let lo = 1e-6, hi = 1e6;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    let cdf = 0;
    for (let j = 0; j < pops.length; j++) {
      cdf += pops[j].share * normalCdf((Math.log(mid) - Math.log(medians[j])) / SIGMA);
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
  bits.push(c.weight === 'any' ? 'any body weight'
    : (profile && profile.bodyWeight ? `${Math.round(profile.bodyWeight)} lbs` : `${whose} body weight`));
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
