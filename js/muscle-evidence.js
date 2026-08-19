// Which exercises count as evidence for which muscle, and how much.
//
// THE PROBLEM THIS SOLVES. Until now a muscle was ranked by exactly ONE lift —
// Biceps by Barbell Curl and nothing else. 11 of the app's 265 exercises could
// move the body map. Tim trained every muscle for a week and the map recorded a
// single number, because he had done hammer curls rather than barbell curls,
// dumbbell rows rather than barbell rows, seated calf raises rather than
// standing. Every one of those was in the library, tagged to the right muscle,
// and thrown away.
//
// THE TRADE. Scoring a hammer curl means knowing what a good hammer curl is,
// and published standards exist only for the 11 key lifts. Everything else is
// converted with a RATIO, and those ratios are estimates: solid for a dumbbell
// swap of a barbell lift, shaky for machines, where gearing varies by brand and
// two "machine shoulder press" numbers may not describe the same resistance at
// all. So coverage went up and per-observation accuracy went down. What pays
// for that is `confidence`: every rating carries one, the body map fades toward
// grey as it drops, and the panel says what would raise it.
//
// Everything here is pure — no DOM, no store, no network — the same shape as
// e1rm.js and strength-standards.js, which is the pattern that has caught real
// bugs in this project because it is fully testable headlessly.

import { e1rm, isRankableSet } from './e1rm.js';
import { MUSCLE_LIFTS } from './strength-standards.js';

/* ------------------------------------------------------------------ *
 * Load
 * ------------------------------------------------------------------ */

// Every ratio below is in TOTAL load, so a per-side entry has to be doubled
// first. Without this a dumbbell row at 80/side is compared against a barbell
// row as though it were 80 lb, and dumbbell work reads as universally feeble.
export function totalLoad(weight, loadType) {
  const w = Number(weight);
  if (!(w > 0)) return null;
  return loadType === 'per_side' ? w * 2 : w;
}

/* ------------------------------------------------------------------ *
 * Ratios
 * ------------------------------------------------------------------ */

// `ratio` answers: for one person, what does this exercise's TOTAL load come to
// as a fraction of the muscle's key lift? Barbell Row 1.00, Dumbbell Row 0.85 —
// so a 100 lb/side dumbbell row (200 total) implies a 235 lb barbell row.
//
// `q` is how much that conversion is worth believing — NOT how hard the
// exercise is. It is the width of the population spread in that ratio. A
// low-bar squat converts to a back squat almost exactly (q .85); a leg press
// depends entirely on the machine's leverage (q .35).
//
// Rules are ordered and FIRST MATCH WINS, so specific patterns must precede
// general ones — "Chest-Supported Dumbbell Row" before "Dumbbell Row", and
// "Cross-Body Hammer Curl" before "Hammer Curl".
const RATIOS = {
  Chest: [ // key: Barbell Bench Press
    [/^Barbell Bench Press$/, 1.00, 1.00],
    [/^Close-Grip Bench Press$/, 0.88, 0.80],
    [/^Incline Barbell Bench Press$/, 0.85, 0.80],
    // Both handicaps at once: 0.88 for the grip × 0.85 for the incline ≈ 0.75.
    // Quality below either parent because that product is reasoned rather than
    // measured — no standards are published for the combined lift.
    [/^Close-Grip Incline Bench Press$/, 0.75, 0.65],
    [/^Decline Barbell Bench Press$/, 1.03, 0.75],
    [/^Floor Press$/, 0.92, 0.70],
    [/Smith Machine Bench Press/, 1.00, 0.50],
    [/Incline Dumbbell Bench Press/, 0.62, 0.60],
    [/Decline Dumbbell Bench Press/, 0.76, 0.55],
    [/Dumbbell Bench Press/, 0.72, 0.65],
    [/Incline Machine Press/, 0.82, 0.45],
    [/Machine Chest Press/, 0.95, 0.45],
    [/Dumbbell Pullover/, 0.35, 0.35],
    [/Pec Deck/, 0.55, 0.35],
    [/Cable Fly|Cable Crossover|Low-to-High|High-to-Low/, 0.40, 0.30],
    [/Fly/, 0.30, 0.30],
    [/Svend Press/, 0.12, 0.20],
  ],
  Back: [ // key: Barbell Row
    [/^Barbell Row$/, 1.00, 1.00],
    [/^Pendlay Row$/, 0.95, 0.80],
    [/^Yates Row$/, 1.10, 0.70],
    [/^Seal Row$/, 0.85, 0.70],
    [/^T-Bar Row$/, 1.05, 0.65],
    [/Chest-Supported Dumbbell Row/, 0.80, 0.55],
    [/Chest-Supported Row/, 0.95, 0.45],
    [/Meadows Row/, 0.55, 0.45],
    [/Dumbbell Row/, 0.85, 0.60],
    [/Machine Row|Hammer Strength Row/, 1.00, 0.45],
    [/Seated Cable Row|Wide-Grip Seated Row/, 1.00, 0.50],
    [/Single-Arm Lat Pulldown/, 0.80, 0.40],
    [/Lat Pulldown|Pulldown/, 0.90, 0.50],
    [/Cable Pullover/, 0.45, 0.30],
    // Deadlift family. These are tagged Back in the library and are genuinely
    // back work, but they are pulls, not rows — hence the wide conversions and
    // the low quality. Deadlift itself is ALSO the key lift for Glutes, which
    // the key-lift rule in contributionsFor() handles separately.
    [/^Rack Pull$/, 1.85, 0.35],
    [/^Trap Bar Deadlift$/, 1.60, 0.40],
    [/^Sumo Deadlift$/, 1.52, 0.40],
    [/^Deficit Deadlift$/, 1.40, 0.40],
    [/^Deadlift$/, 1.56, 0.45],
    [/Good Morning/, 0.60, 0.35],
    [/Reverse Hyperextension/, 0.55, 0.25],
  ],
  Quads: [ // key: Back Squat
    [/^Back Squat$/, 1.00, 1.00],
    [/^High-Bar Squat$/, 0.98, 0.85],
    [/^Low-Bar Squat$/, 1.04, 0.85],
    [/^Box Squat$/, 1.02, 0.70],
    [/^Pause Squat$/, 0.90, 0.75],
    [/^Front Squat$/, 0.83, 0.75],
    [/^Safety Bar Squat$/, 0.95, 0.65],
    [/^Zercher Squat$/, 0.72, 0.50],
    [/Smith Machine Squat/, 1.05, 0.45],
    [/Hack Squat/, 1.15, 0.40],
    [/Pendulum Squat/, 1.05, 0.35],
    [/Belt Squat/, 1.10, 0.35],
    [/Single-Leg Press/, 1.30, 0.30],
    [/Leg Press/, 2.00, 0.35],
    [/Single-Leg Extension/, 0.55, 0.25],
    [/Leg Extension/, 0.60, 0.30],
    [/Goblet Squat/, 0.35, 0.40],
    [/Bulgarian Split Squat|Split Squat/, 0.50, 0.40],
    [/Lunge/, 0.45, 0.35],
    [/Step-Up/, 0.45, 0.30],
  ],
  Hamstrings: [ // key: Romanian Deadlift
    [/^Romanian Deadlift$/, 1.00, 1.00],
    [/^Stiff-Leg Deadlift$/, 0.98, 0.80],
    [/Dumbbell Romanian Deadlift/, 0.75, 0.60],
    [/Single-Leg Romanian Deadlift/, 0.45, 0.35],
    [/Leg Curl/, 0.45, 0.35],
    [/Cable Pull-Through/, 0.45, 0.30],
    [/Kettlebell Swing/, 0.35, 0.25],
  ],
  Glutes: [ // key: Deadlift
    [/^Deadlift$/, 1.00, 1.00],
    [/Machine Hip Thrust/, 1.20, 0.35],
    [/Hip Thrust/, 1.15, 0.50],
    [/Glute Bridge/, 1.00, 0.40],
    [/Sumo Squat/, 0.45, 0.30],
    [/Kickback/, 0.18, 0.20],
    [/Hip Abduction Machine|Hip Adduction Machine/, 0.35, 0.15],
  ],
  Shoulders: [ // key: Overhead Press
    [/^Overhead Press$/, 1.00, 1.00],
    [/^Seated Barbell Overhead Press$/, 1.00, 0.85],
    [/^Push Press$/, 1.25, 0.65],
    [/^Behind-the-Neck Press$/, 0.90, 0.55],
    [/^Z Press$/, 0.85, 0.50],
    [/Smith Machine Overhead Press/, 1.05, 0.45],
    [/Machine Shoulder Press/, 1.10, 0.45],
    [/Seated Dumbbell Shoulder Press/, 0.85, 0.60],
    [/Dumbbell Shoulder Press/, 0.88, 0.60],
    [/Arnold Press/, 0.78, 0.50],
    [/Landmine Press/, 0.60, 0.35],
    [/Upright Row/, 0.70, 0.35],
    // Raises and rear-delt work load a fraction of a press and vary hugely with
    // technique. They are admitted because they are real shoulder work, at a
    // quality that stops them ever outvoting a press.
    [/Raise|Fly|Face Pull|Pec Deck/, 0.30, 0.25],
  ],
  Biceps: [ // key: Barbell Curl
    [/^Barbell Curl$/, 1.00, 1.00],
    [/^EZ-Bar Curl$/, 1.02, 0.80],
    [/^Drag Curl$/, 0.85, 0.55],
    [/^21s$/, 0.55, 0.35],
    [/Machine Preacher Curl/, 0.90, 0.40],
    [/Dumbbell Preacher Curl/, 0.72, 0.45],
    [/Preacher Curl/, 0.82, 0.60],
    [/Cross-Body Hammer Curl/, 0.92, 0.45],
    [/Cable Rope Hammer Curl/, 0.95, 0.45],
    [/Hammer Curl/, 0.98, 0.55],
    [/Incline Dumbbell Curl/, 0.72, 0.45],
    [/Concentration Curl/, 0.62, 0.40],
    [/Spider Curl/, 0.70, 0.40],
    [/Zottman Curl/, 0.72, 0.35],
    [/Bayesian Cable Curl/, 0.80, 0.35],
    [/Cable Curl/, 0.95, 0.45],
    [/Dumbbell Curl/, 0.88, 0.55],
  ],
  Triceps: [ // key: Close-Grip Bench Press
    [/^Close-Grip Bench Press$/, 1.00, 1.00],
    [/^California Press$/, 0.80, 0.45],
    [/^JM Press$/, 0.75, 0.50],
    [/Dumbbell Skull Crusher/, 0.42, 0.40],
    [/Skull Crusher/, 0.50, 0.50],
    [/Tate Press/, 0.35, 0.30],
    [/Pushdown/, 0.55, 0.45],
    [/Overhead Cable Extension/, 0.45, 0.35],
    [/Overhead Dumbbell Extension/, 0.40, 0.35],
    [/Machine Triceps Extension/, 0.60, 0.35],
    [/Kickback/, 0.20, 0.20],
  ],
  Traps: [ // key: Barbell Shrug
    [/^Barbell Shrug$/, 1.00, 1.00],
    [/^Trap Bar Shrug$/, 1.05, 0.75],
    [/Dumbbell Shrug/, 0.95, 0.60],
    [/Cable Shrug/, 0.90, 0.50],
    [/Machine Shrug/, 1.00, 0.45],
    [/Carry/, 0.75, 0.25],
  ],
  Calves: [ // key: Standing Calf Raise
    [/^Standing Calf Raise$/, 1.00, 1.00],
    // Seated is the outlier people assume is equivalent and is not: a bent knee
    // takes gastrocnemius out and leaves soleus, so the load is far lower for
    // the same person. Treating them as the same lift would read as a big loss
    // of calf strength the week someone switches machines.
    [/^Seated Calf Raise$/, 0.62, 0.55],
    [/Smith Machine Calf Raise/, 1.00, 0.45],
    [/Leg Press Calf Raise/, 1.35, 0.35],
    [/Donkey Calf Raise/, 1.05, 0.35],
    [/Dumbbell Calf Raise/, 0.55, 0.35],
  ],
  Forearms: [ // key: Wrist Curl
    [/^Wrist Curl$/, 1.00, 1.00],
    [/Behind-the-Back Wrist Curl/, 1.05, 0.55],
    [/Reverse Wrist Curl/, 0.55, 0.50],
    [/Cable Reverse Curl/, 0.78, 0.35],
    [/Reverse Curl/, 0.80, 0.40],
    [/Plate Pinch Hold/, 0.45, 0.20],
  ],
};

// A user-created exercise has no rule and no way to acquire one. It is admitted
// so a custom name is not silently ignored, at a quality low enough that it can
// never outweigh a known lift, and with a conversion guessed from equipment.
const CUSTOM_RATIO = { Barbell: 0.90, Machine: 0.80, Cable: 0.65, Dumbbell: 0.70, Kettlebell: 0.60 };
const CUSTOM_QUALITY = 0.20;

/* ------------------------------------------------------------------ *
 * Fallback: what a big lift says about the muscles it also works
 * ------------------------------------------------------------------ */

// Tim's call, 2026-08-17: a compound rates a secondary muscle ONLY when that
// muscle has no direct evidence at all. That keeps grey meaningful — grey still
// answers "what am I not training" — while stopping a full week of work from
// leaving muscles blank.
//
// The conversion between two muscles is not written down here. It falls out of
// the published medians in strength-standards.js: if the median lifter benches
// 225 and close-grip benches 185, then bench → triceps is 185/225 by
// construction. Hard-coding a second set of numbers would let the two drift
// apart silently.
const FALLBACK = {
  Triceps:    [{ from: 'Chest', q: 0.40 }, { from: 'Shoulders', q: 0.35 }],
  Shoulders:  [{ from: 'Chest', q: 0.30 }],
  Biceps:     [{ from: 'Back', q: 0.30 }],
  Back:       [{ from: 'Glutes', q: 0.35 }],
  Glutes:     [{ from: 'Quads', q: 0.40 }, { from: 'Hamstrings', q: 0.40 }],
  Hamstrings: [{ from: 'Glutes', q: 0.40 }, { from: 'Quads', q: 0.25 }],
  Traps:      [{ from: 'Back', q: 0.25 }],
  Forearms:   [{ from: 'Back', q: 0.25 }, { from: 'Biceps', q: 0.30 }],
};

// Only a genuine compound may stand in for another muscle. A cable fly says
// nothing about triceps, and letting it through would be the "machine for
// confidently wrong numbers" the estimate plan warns about.
const FALLBACK_MIN_QUALITY = 0.45;

// The population conversion between two muscles' key lifts, taken from the
// medians. Male and female medians differ slightly in ratio; the mean of the
// two is used, because which one applies depends on a profile field this
// module deliberately does not take.
export function crossMuscleRatio(fromMuscle, toMuscle) {
  const a = MUSCLE_LIFTS[fromMuscle];
  const b = MUSCLE_LIFTS[toMuscle];
  if (!a || !b) return null;
  return ((a.median.male / b.median.male) + (a.median.female / b.median.female)) / 2;
}

/* ------------------------------------------------------------------ *
 * Exercise → contributions
 * ------------------------------------------------------------------ */

let keyLiftByName = null;
function keyLiftMuscle(name) {
  if (!keyLiftByName) {
    keyLiftByName = new Map();
    for (const [muscle, spec] of Object.entries(MUSCLE_LIFTS)) keyLiftByName.set(spec.lift, muscle);
  }
  return keyLiftByName.get(name) || null;
}

function matchRule(muscle, name) {
  const rules = RATIOS[muscle];
  if (!rules) return null;
  for (const [re, ratio, q] of rules) if (re.test(name)) return { ratio, quality: q };
  return null;
}

// What this exercise says, and about which muscles.
//
//   kind 'direct'   — the exercise trains this muscle. Decides the rating.
//   kind 'fallback' — a big lift standing in for a muscle with nothing direct.
//
// Returns [] for anything that cannot be converted to a load at all.
export function contributionsFor(exercise) {
  if (!exercise || !exercise.name) return [];
  // Bodyweight and assisted work logs ADDED or SUBTRACTED load, not the load on
  // the muscle, so its number is not comparable to a barbell's. Wiring body
  // weight in is a known gap and is what would unlock these.
  if (exercise.equipment === 'Bodyweight' || /^Assisted /.test(exercise.name)) return [];
  if (!Array.isArray(exercise.fields) || !exercise.fields.includes('weight')) return [];

  const out = [];
  const seen = new Set();
  const add = (muscle, ratio, quality, kind, via) => {
    if (!MUSCLE_LIFTS[muscle] || seen.has(muscle)) return;
    if (!(ratio > 0) || !(quality > 0)) return;
    seen.add(muscle);
    out.push({ muscle, ratio, quality, kind, via: via || null });
  };

  // 1. A muscle's own key lift is always its best possible evidence, wherever
  //    the library happens to file it — Close-Grip Bench Press is tagged Chest
  //    but IS the triceps standard, and Deadlift is tagged Back but IS the
  //    glute standard.
  const owns = keyLiftMuscle(exercise.name);
  if (owns) add(owns, 1.00, 1.00, 'direct');

  // 2. The muscle the library files it under.
  const rule = matchRule(exercise.muscle, exercise.name);
  if (rule) {
    add(exercise.muscle, rule.ratio, rule.quality, 'direct');
  } else if (exercise.isCustom && MUSCLE_LIFTS[exercise.muscle]) {
    add(exercise.muscle, CUSTOM_RATIO[exercise.equipment] || 0.75, CUSTOM_QUALITY, 'direct');
  }

  // 3. Everything this lift can stand in for. Chained off the DIRECT reading it
  //    already produced, so the conversion is (this exercise → its own key
  //    lift → the other muscle's key lift).
  const direct = out.filter((c) => c.kind === 'direct' && c.quality >= FALLBACK_MIN_QUALITY);
  for (const [target, sources] of Object.entries(FALLBACK)) {
    if (seen.has(target)) continue;
    for (const src of sources) {
      const base = direct.find((c) => c.muscle === src.from);
      if (!base) continue;
      const cross = crossMuscleRatio(src.from, target);
      if (!cross) continue;
      // MULTIPLY, and the direction matters. `ratio` is always "this exercise's
      // load as a fraction of the TARGET muscle's key lift", so standing in for
      // a weaker muscle makes the ratio BIGGER, not smaller. Dividing here gave
      // a dumbbell row a 429 lb wrist curl and an Elite forearm rating off one
      // set — caught by reading the numbers, not by any test.
      add(target, base.ratio * cross, base.quality * src.q, 'fallback', base.muscle);
      break;
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * How much one set is worth
 * ------------------------------------------------------------------ */

// How far the e1RM formula is extrapolating. Marzagao is trustworthy at low
// reps and degrades above ~10 — see docs/research.md §1. Above 15 the set is
// not evidence of a maximum at all, which isRankableSet() already enforces.
export function repFactor(reps) {
  const r = Number(reps);
  if (!isRankableSet(r)) return 0;
  if (r <= 3) return 1.00;
  if (r <= 6) return 0.95;
  if (r <= 8) return 0.85;
  if (r <= 10) return 0.70;
  if (r <= 12) return 0.45;
  return 0.25;
}

// Two different half-lives, on purpose.
//
// WEIGHT decays slowly: a 4-month-old heavy single is still the best evidence
// available about someone's strength, and discounting it hard would make the
// map swing on whatever happened to be logged last week — the instability this
// whole design is trying to avoid.
//
// FRESHNESS decays fast, and feeds confidence only. Old evidence still sets the
// number; it just stops claiming to describe today.
const WEIGHT_HALF_LIFE_DAYS = 120;
const FRESH_HALF_LIFE_DAYS = 60;

export function recencyWeight(ageDays) {
  const a = Math.max(0, Number(ageDays) || 0);
  return Math.pow(0.5, a / WEIGHT_HALF_LIFE_DAYS);
}

export function freshness(ageDays) {
  const a = Math.max(0, Number(ageDays) || 0);
  return Math.max(0.12, Math.pow(0.5, a / FRESH_HALF_LIFE_DAYS));
}

// A deliberate test bypasses nothing about reps or ratios — it is still a
// hammer curl if that is what was tested — but it IS a fresh maximal attempt
// rather than set 4 of an ordinary session, so it is worth more.
const BENCHMARK_BONUS = 1.25;

/* ------------------------------------------------------------------ *
 * Rating a muscle
 * ------------------------------------------------------------------ */

// How many exercises the estimate is built from. One would let a single
// mistyped number define a muscle forever; averaging everything would be
// dragged down by every warm-up and every easy day.
//
// ⚠️ THREE EXERCISES, NOT THREE SETS, and that distinction was a real bug for
// two months. This comment used to end "averaging across DIFFERENT exercises is
// also what cancels out error in any one ratio" — and nothing in the code made
// the three different. Running a year of ordinary training through it, EIGHT of
// eleven muscles had all three slots filled by the same exercise on three
// different days, so the error in that one ratio was never cancelled by
// anything; it was averaged with itself. See rateMuscle().
const TOP_N = 3;

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

// Confidence, 0–1. Four things, combined as a geometric mean so that no single
// term can be quietly compensated for by the others — a pile of stale evidence
// stays low-confidence no matter how much of it there is.
//
//   quality   — how believable the conversions are (a key lift vs a machine)
//   depth     — how much admissible evidence there is
//   agreement — do the contributing exercises tell the same story?
//   freshness — how long ago was the newest of them?
function confidenceOf(used, all) {
  if (!used.length) return 0;
  const wsum = used.reduce((a, u) => a + u.evidenceWeight, 0);
  if (!(wsum > 0)) return 0;

  const quality = used.reduce((a, u) => a + u.quality * u.evidenceWeight, 0) / wsum;

  // ⚠️ DEPTH IS MEASURED OVER EVERYTHING ADMISSIBLE, not over the three that
  // set the number. Its own definition is "how much admissible evidence there
  // is", and computing it from the top three never measured that — somebody who
  // has squatted sixty times scored the same as somebody who squatted three
  // times, because both had three slots filled. It saturates, and saturating is
  // right: past a certain amount of history, "more of it" stops being the thing
  // holding the estimate back.
  const total = (all || used).reduce((a, u) => a + u.evidenceWeight, 0);
  const depth = 1 - Math.exp(-total / 1.5);

  // Spread of the estimates in log space, so it reads as a percentage
  // disagreement rather than an absolute one.
  //
  // ⚠️ This term is only meaningful because `used` now holds DIFFERENT
  // exercises. Before that it was routinely handed the same exercise three
  // times, which agrees with itself perfectly — so the term that exists to ask
  // "do independent readings corroborate each other?" was reporting near-perfect
  // corroboration precisely when there was none, and pushing confidence UP. One
  // exercise cannot corroborate itself, so it is capped rather than scored, and
  // that is the closest thing available to the RIR field the app deliberately
  // does not have.
  let agreement = 0.55;
  if (used.length > 1) {
    const logs = used.map((u) => Math.log(u.estimate));
    const m = mean(logs);
    const sd = Math.sqrt(mean(logs.map((x) => (x - m) * (x - m))));
    agreement = Math.max(0.15, 1 - Math.min(1, sd / 0.30));
  }

  const fresh = freshness(Math.min(...used.map((u) => u.ageDays)));

  return Math.min(1, Math.pow(quality * depth * agreement * fresh, 0.25));
}

/**
 * Rate one muscle from its observations.
 *
 * @param {Array} observations  { estimate, quality, kind, reps, ageDays,
 *                                isBenchmark, exerciseId, exerciseName, date }
 *   `estimate` is already converted to the muscle's KEY LIFT in pounds.
 * @returns null when nothing is admissible, else
 *   { estimate, confidence, used[], kind, contributorCount, newestAgeDays }
 */
export function rateMuscle(observations) {
  const admissible = (observations || []).filter((o) => o && o.estimate > 0 && repFactor(o.reps) > 0);
  if (!admissible.length) return null;

  // Direct evidence decides the rating. A compound only stands in when there is
  // none — Tim's call, and what keeps a grey muscle meaningful.
  const direct = admissible.filter((o) => o.kind === 'direct');
  const pool = direct.length ? direct : admissible;
  const kind = direct.length ? 'direct' : 'fallback';

  // One value per exercise per day: the best set. Every other set that day is
  // a warm-up, a back-off or a repeat, and none of them raise the ceiling.
  const perDay = new Map();
  for (const o of pool) {
    const key = o.exerciseId + '|' + o.date;
    const prev = perDay.get(key);
    if (!prev || o.estimate > prev.estimate) perDay.set(key, o);
  }

  const scored = [...perDay.values()].map((o) => ({
    ...o,
    // NOT `weight`. An observation already carries `weight` — the pounds on the
    // bar — and overwriting it here silently replaced every displayed lift with
    // its own confidence score. Caught by the test asserting a 205 lb set; it
    // read 0.91.
    evidenceWeight: o.quality * repFactor(o.reps) * recencyWeight(o.ageDays)
      * (o.isBenchmark ? BENCHMARK_BONUS : 1),
  })).filter((o) => o.evidenceWeight > 0);
  if (!scored.length) return null;

  // ── One representative per EXERCISE ──────────────────────────────────────
  // Its best showing: within a single exercise, the heaviest honest set is the
  // thing worth knowing, and that has always been the intent. What is new is
  // that an exercise now gets ONE seat rather than as many as it has days.
  const perExercise = new Map();
  for (const o of scored) {
    const prev = perExercise.get(o.exerciseId);
    if (!prev || o.estimate > prev.estimate) perExercise.set(o.exerciseId, o);
  }

  // ── ⚠️ RANKED BY CREDIBILITY, NOT BY SIZE ────────────────────────────────
  //
  // This line is the fix. It used to sort by `estimate`, which meant the single
  // most FLATTERING conversion set the rating no matter how little it was worth
  // believing — and `evidenceWeight`, the number this module computes precisely
  // to say how much an observation is worth, was used only to average the
  // winners afterwards.
  //
  // What that did in practice, measured on a year of ordinary training: a
  // 50 lb face pull for 15 reps (quality 0.25, extrapolated from the very top of
  // the rankable rep range, evidence weight 0.06) beat an overhead press
  // BENCHMARK (quality 1.00, three reps, weight ~1.00) and rated the lifter's
  // shoulders Elite, 99th percentile, next to a Proficient chest. A sixteen-fold
  // credibility inversion, and it was not a shoulders quirk — the same thing
  // happened to eight of eleven muscles.
  //
  // The rule this restores is one the file already claimed on line 157 about
  // raises and rear-delt work: admitted "at a quality that stops them ever
  // outvoting a press". They were outvoting the press. Now they cannot: the
  // press is ranked first because it is more credible, and the raise still
  // contributes, weighted by what it is worth.
  //
  // Ties break on the larger estimate, so between two equally credible readings
  // the better showing still wins — the upper-estimator character is kept where
  // it belongs, WITHIN a level of credibility rather than across it.
  const candidates = [...perExercise.values()]
    .sort((a, b) => (b.evidenceWeight - a.evidenceWeight) || (b.estimate - a.estimate));

  const used = candidates.slice(0, TOP_N);
  const wsum = used.reduce((a, u) => a + u.evidenceWeight, 0);
  const estimate = used.reduce((a, u) => a + u.estimate * u.evidenceWeight, 0) / wsum;

  return {
    estimate,
    confidence: confidenceOf(used, scored),
    used,
    kind,
    contributorCount: scored.length,
    // How many DIFFERENT exercises had a say. One is not a failure — plenty of
    // people bench and do nothing else for chest — but it is the difference
    // between a corroborated reading and an uncorroborated one, so the panel
    // gets to say which it is looking at.
    exerciseCount: perExercise.size,
    newestAgeDays: Math.min(...scored.map((o) => o.ageDays)),
  };
}

/* ------------------------------------------------------------------ *
 * Presenting confidence
 * ------------------------------------------------------------------ */

export const CONFIDENCE_BANDS = [
  { key: 'low', name: 'Low', min: 0 },
  { key: 'fair', name: 'Fair', min: 0.35 },
  { key: 'good', name: 'Good', min: 0.55 },
  { key: 'high', name: 'High', min: 0.72 },
];

export function confidenceBand(confidence) {
  const c = Number(confidence);
  if (!Number.isFinite(c)) return CONFIDENCE_BANDS[0];
  let found = CONFIDENCE_BANDS[0];
  for (const b of CONFIDENCE_BANDS) if (c >= b.min) found = b;
  return found;
}

// How much of the level's colour survives on the body map. Floored well above
// zero: at 0 the muscle would be indistinguishable from "no data", and "we are
// unsure" and "you have never trained this" are completely different messages.
export const MIN_TINT = 0.38;

export function tintFor(confidence) {
  const c = Math.min(1, Math.max(0, Number(confidence) || 0));
  return MIN_TINT + (1 - MIN_TINT) * c;
}

// The single most useful thing to log next, in plain words. This is what turns
// the map from a scoreboard into a to-do list.
export function raiseConfidenceHint(muscle, rating) {
  const spec = MUSCLE_LIFTS[muscle];
  const keyLift = spec ? spec.lift : null;
  if (!rating) return keyLift ? `Record any ${muscle.toLowerCase()} exercise to rate this.` : null;

  if (rating.kind === 'fallback') {
    return `This is inferred from other lifts. Any direct ${muscle.toLowerCase()} exercise would rate it properly.`;
  }
  if (rating.newestAgeDays > 42) {
    return `Nothing recent — the newest set is ${Math.round(rating.newestAgeDays)} days old. Train it again to refresh this.`;
  }
  if (rating.contributorCount < 2) {
    return 'Only one session counts so far. A second would confirm it.';
  }
  // ⚠️ This one only became sayable once `used` held distinct exercises. Before
  // that, three days of the same lift filled every slot and looked — to the
  // agreement term and to anyone reading the panel — like three independent
  // readings corroborating each other. Now the panel can name the real
  // limitation: plenty of evidence, none of it a second opinion.
  if (rating.exerciseCount < 2) {
    const only = rating.used[0] && rating.used[0].exerciseName;
    return only
      ? `Everything here comes from ${only}. A different ${muscle.toLowerCase()} exercise would `
        + 'give it something to agree with.'
      : `Only one exercise counts toward this. A different ${muscle.toLowerCase()} exercise would confirm it.`;
  }
  const bestQuality = Math.max(...rating.used.map((u) => u.quality));
  if (bestQuality < 0.8 && keyLift) {
    return `Based on close matches rather than the standard lift. A heavy set of ${keyLift} would confirm it.`;
  }
  return null;
}
