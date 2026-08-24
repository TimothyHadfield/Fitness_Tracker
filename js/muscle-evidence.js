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

import { e1rm, isRankableSet, totalResistance } from './e1rm.js';
import { bodyWeightFractionFor } from './exercises.js';
import { robustAggregate } from './strength-estimate.js';
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

/**
 * The load one set actually put on the body, whatever kind of exercise it is.
 * This is the single entry point a caller wants: it routes a bodyweight or
 * assisted movement through the body-weight arithmetic and everything else
 * through totalLoad().
 *
 * @param {object} exercise
 * @param {number} weight   what was LOGGED — added load, assistance, or the
 *                          weight on the bar. May be absent on a reps-only
 *                          exercise, which is zero added load, not missing data.
 * @param {object} opts     { bodyWeight } in pounds, ON THE DATE OF THE SET.
 * @returns pounds, or null when the set cannot be converted to a load at all.
 *
 * Every bodyweight exercise in the library is loadType 'total', so there is no
 * per-side doubling to apply on that branch — asserted in tests/bodyweight.test.mjs
 * so that adding a per-side bodyweight exercise cannot pass silently.
 */
export function setLoad(exercise, weight, opts) {
  if (bodyWeightFractionFor(exercise)) {
    const r = totalResistance(exercise, weight, opts && opts.bodyWeight);
    return r ? r.load : null;
  }
  return totalLoad(weight, exercise ? exercise.loadType : 'total');
}

/**
 * Why this exercise cannot rate a muscle, in words for the panel. Null when it
 * can. The muscle map's counterpart to normalizeBlockedReason() in e1rm.js.
 *
 * The distinction it draws is the one that matters to somebody looking at a
 * grey muscle: "log a weigh-in and this starts working" is a thing they can act
 * on, and "nobody has measured this exercise" is a thing they cannot. Rolling
 * both into one message would waste the first and overclaim the second.
 */
export function rankBlockedReason(exercise, opts) {
  if (!exercise || !exercise.name) return null;
  const spec = bodyWeightFractionFor(exercise);
  if (spec) {
    if (!Array.isArray(exercise.fields) || !exercise.fields.includes('reps')) return null;
    if (!(Number(opts && opts.bodyWeight) > 0)) {
      return 'this one lifts your own body weight, and we don’t know what you weigh — '
        + 'log a weigh-in and it starts counting';
    }
    return null;
  }
  if (exercise.equipment === 'Bodyweight' || /^Assisted /.test(exercise.name)) {
    return 'how much of your body weight this one carries has never been measured, '
      + 'so it can’t be compared with a barbell';
  }
  return null;
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
    // ── Bodyweight pressing ──────────────────────────────────────────────
    // These are the only entries in this file whose `ratio` is above 1.00 for a
    // reason worth stating: the load is your own body, which is far heavier
    // than the bar most people bench. A ratio over 1 means "this exercise's
    // resistance exceeds the key lift you could do", so dividing by it brings
    // the number back down. Getting the direction wrong here is the same
    // mistake that once gave a dumbbell row a 429 lb wrist curl.
    //
    // ⚠️ DERIVED FROM PUBLISHED STANDARDS, NOT FROM FEEL, and by the same
    // technique crossMuscleRatio() already uses: take one population, read both
    // lifts off it, divide. Strength Level publish 1RM standards for the dip in
    // ADDED weight and for the bench press outright, both for a 180 lb male —
    // the same reference body weight strength-standards.js quotes its medians
    // at. Total dip resistance is 1.00 x 180 + added:
    //     beginner (180+11)/127 = 1.50   novice (180+60)/169 = 1.42
    //     intermediate (180+117)/220 = 1.35
    //     advanced (180+180)/277 = 1.30  elite (180+247)/339 = 1.26
    // The median is taken. ⚠️ The drift from 1.50 to 1.26 is NOT noise — it is
    // real, and it is why `q` is down at machine level: body weight is a floor
    // under a dip, so the weaker you are the more the dip flatters you. A fixed
    // ratio therefore compresses everybody toward the middle, which understates
    // strong lifters and overstates weak ones. That is the safe direction for
    // the failure this rating most has to avoid — nobody gets rated Elite for
    // dips they could always do — but it is a known bias, not a solved problem.
    [/^Chest Dip$/, 1.35, 0.45],
    // Push-up resistance is FIXED at 0.75 x body weight, so unlike a barbell it
    // cannot be loaded — the rep count carries all of the information. Above 15
    // reps the set stops being evidence of a maximum at all (D5), and Strength
    // Level put the median 180 lb male at 38 push-ups, so in practice this rule
    // only ever fires for relative beginners. That is exactly where it was
    // calibrated: at 180 lb the resistance is 135, which at their beginner
    // standard of 6 reps estimates 167 against a 127 lb bench (1.32), and at
    // the 15-rep ceiling estimates 213 against roughly 154 (1.38).
    [/^Push-Up$/, 1.35, 0.35],
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
    // ── Bodyweight pulling ───────────────────────────────────────────────
    // Same derivation as the dip above, off Strength Level's pull-up standards
    // (added weight) and barbell row standards, both male at 180 lb. Total
    // pull-up resistance is 1.00 x 180 + added:
    //     beginner (180-4)/108 = 1.63   novice (180+32)/149 = 1.42
    //     intermediate (180+74)/198 = 1.28
    //     advanced (180+120)/255 = 1.18  elite (180+168)/315 = 1.10
    // The median is taken, and their row median of 198 sits within 4 % of this
    // app's own 205, so the two populations are not being spliced.
    //
    // ONE RULE FOR THE WHOLE FAMILY. Grip width is not separately calibrated
    // and does not need to be: Strength Level's pull-up and chin-up 1RMs differ
    // by under 1 % at every level (+74 vs +76 at the median), which is direct
    // evidence that grip barely moves the maximum even though it plainly moves
    // how the set feels.
    //
    // ⚠️ At 0.45 this lands just under FALLBACK_MIN_QUALITY, so a pull-up rates
    // Back and nothing else — it will not stand in for Biceps, Traps or
    // Forearms the way a barbell row does. That is deliberate. A chin-up
    // genuinely does train biceps, but the conversion would be a body-weight
    // fraction times a ratio that already drifts 1.10-1.63 times a cross-muscle
    // ratio, and three estimates multiplied together is how the "machine for
    // confidently wrong numbers" gets built.
    // ⚠️ ASSISTED IS IN THE SAME FAMILY AT THE SAME RATIO, and it belongs here
    // rather than in a line of its own: the ratio converts RESISTANCE to the
    // muscle's key lift, and by the time it is applied the assistance has
    // already been subtracted — 110 lb of assisted pull-up is the same 110 lb of
    // pulling as a lifter who weighs 110. What is less certain about it is the
    // 110 itself, and that is priced once, in the fraction table's `q`, rather
    // than twice. Added 2026-08-24; without it the exercise had a fraction and
    // still rated nothing, because this regex is anchored.
    [/^(Pull-Up|Chin-Up|Neutral-Grip Pull-Up|Wide-Grip Pull-Up|Assisted Pull-Up)$/, 1.28, 0.45],
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
    // Same dip resistance as the Chest entry, converted against the triceps key
    // lift instead: (180 + 117) / 208 = 1.43 at the median, using Strength
    // Level's close-grip bench standard for a 180 lb male.
    //
    // ⚠️ `q` is a step below the Chest entry and the reason is a SOURCING
    // mismatch, not a maths one. Strength Level publish one dip standard and do
    // not separate the upright, elbows-in triceps dip from the forward-leaning
    // chest dip, so this converts a chest-dip-flavoured population figure to a
    // triceps lift. The library treats them as two exercises; the source does
    // not.
    [/^Triceps Dip$/, 1.43, 0.35],
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
export const FALLBACK_MIN_QUALITY = 0.45;

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
export function contributionsFor(exercise, opts) {
  if (!exercise || !exercise.name) return [];

  // ── Bodyweight and assisted work ─────────────────────────────────────────
  //
  // This used to be one line refusing the lot, and the reason was sound: the
  // logged weight is ADDED or SUBTRACTED load, not the load on the muscle, so
  // it is not comparable to a barbell's. The cost was that a pull-up rated no
  // muscle at all, which for anyone whose back training is chin-ups meant a
  // grey body map for work they had actually done.
  //
  // Body weight is now a dated series, so the missing term is computable — for
  // the exercises with a published fraction (exercises.js) and for a user with
  // a weigh-in. Both conditions are real gates, not formalities:
  //
  //   no fraction  -> still refused, permanently. See the exclusion list in
  //                   exercises.js: an inverted row's fraction spans 37-79 %
  //                   with the bar height, and the app records no bar height.
  //   no weigh-in  -> refused for now, and rankBlockedReason() says so. NOT
  //                   filled in from today's weight or from an average adult.
  //
  // ⚠️ `opts.bodyWeight` MUST be the weight on the date of the SET. Called with
  // one argument this behaves exactly as it always did, because one argument
  // means the caller has not looked one up — which is the honest state of both
  // an unwired caller and a user who has never weighed in.
  const bwSpec = bodyWeightFractionFor(exercise);
  if (bwSpec) {
    const bw = Number(opts && opts.bodyWeight);
    if (!(bw > 0)) return [];
    if (!Array.isArray(exercise.fields) || !exercise.fields.includes('reps')) return [];
    // How well the FRACTION is known multiplies into every contribution, on top
    // of how well the ratio converts. A push-up's 0.75 is a judgement between
    // three force-plate figures measuring different things; a pull-up's 1.00 is
    // statics. They must not arrive at the rating carrying the same weight.
    //
    // A body weight carried BACKWARD from a later weigh-in is an assumption and
    // is priced here too — see bodyWeightOn() in e1rm.js.
    const bwQuality = Number(opts && opts.bodyWeightQuality);
    const scale = bwSpec.quality * (Number.isFinite(bwQuality) && bwQuality > 0 ? Math.min(1, bwQuality) : 1);
    return buildContributions(exercise, scale);
  }

  // Anything bodyweight or assisted WITHOUT a published fraction is refused
  // exactly as before. Equipment is never used to guess one.
  if (exercise.equipment === 'Bodyweight' || /^Assisted /.test(exercise.name)) return [];
  if (!Array.isArray(exercise.fields) || !exercise.fields.includes('weight')) return [];
  return buildContributions(exercise, 1);
}

// `qualityScale` discounts every contribution this exercise makes — 1 for an
// ordinary weighted lift, less for a bodyweight one whose fraction or whose
// body weight is imperfectly known.
function buildContributions(exercise, qualityScale) {
  const out = [];
  const seen = new Set();
  const add = (muscle, ratio, quality, kind, via) => {
    if (!MUSCLE_LIFTS[muscle] || seen.has(muscle)) return;
    const q = quality * qualityScale;
    if (!(ratio > 0) || !(q > 0)) return;
    seen.add(muscle);
    out.push({ muscle, ratio, quality: q, kind, via: via || null });
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

  // ⚠️ THE EFFECTIVE QUALITY, fatigue included, and that is the fix for the
  // sharpest half of the 2026-08-24 finding. Adding a fatigued third exercise
  // to Tim's back session made the estimate 32 % WORSE and the confidence
  // HIGHER — 0.40 to 0.44 — because `depth` counts admissible evidence and
  // nothing told this function that some of it was worth less. An observation
  // you have reason to distrust must never make the app more certain.
  //
  // Both paths are closed by one term: `depth` sums evidenceWeight, which now
  // carries fatigue, and the quality term reads it directly here.
  const quality = used.reduce((a, u) => a + u.quality * fatigueOf(u) * u.evidenceWeight, 0) / wsum;

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

/* ------------------------------------------------------------------ *
 * Within-session fatigue
 * ------------------------------------------------------------------ */

/**
 * Prior work on a muscle, in sets, at which an observation of it is worth half
 * as much.
 *
 * ⚠️ THIS NUMBER IS OURS AND NOTHING SUPPORTS IT, in the same way LAYOFF_DAYS
 * and the rep ladder in progression.js are ours. The ACSM 2026 stand grades
 * exercise order at 88 % quality of evidence — the highest of anything in it —
 * but publishes a GRADE and not an effect size, so there is nothing to fit to.
 * See docs/fatigue-plan.md §4.
 *
 * ⚠️ IT IS ACCEPTABLE HERE FOR THE REASON A GUESSED DELOAD PERCENTAGE IS NOT:
 * it can only ever DISCOUNT. At any value it withholds credibility from an
 * observation; at no value can it make a muscle read stronger than the sets
 * recorded, and at no value can it put weight on a bar. That asymmetry is what
 * lets a judged constant stand in for a measured one.
 *
 * Five sets rather than three or ten, and the argument is at least stateable:
 * this app's own volume model puts a muscle's whole WEEKLY target near 7–10
 * sets, so five in a single session before another exercise even starts is a
 * lot of prior work. Measured consequence, which is the real check: across the
 * demo account's year every muscle moves under 2 % at this value, and 0 of 11
 * change which lift leads them. It bites on badly-ordered sessions and leaves
 * well-ordered ones alone, which is exactly the job.
 */
export const FATIGUE_HALF_SETS = 5;

/**
 * How much an observation is discounted for work already done on that muscle
 * earlier in the same session.
 *
 * @param {number} priorVolume  sets on this muscle already logged that day,
 *   counted with volume-map.js's own weights — direct 1.0, indirect 0.5.
 * @returns 1 for a fresh observation, falling toward 0. Never above 1: a
 *   fatigued reading is never worth MORE, and this function is the only place
 *   that could accidentally say otherwise.
 */
export function fatigueFactor(priorVolume) {
  const v = Number(priorVolume);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return 1 / (1 + v / FATIGUE_HALF_SETS);
}

// ⚠️ Absent means FRESH, and every caller that has not been wired up gets
// exactly the behaviour it had before this existed. Same arity contract as
// contributionsFor()'s `opts`: an observation with no fatigue field is one
// nobody has measured fatigue for, and inventing a discount for it would
// quietly re-rate every history in the app.
const fatigueOf = (o) => (Number.isFinite(o.fatigueFactor) ? o.fatigueFactor : 1);

/**
 * Rate one muscle from its observations.
 *
 * @param {Array} observations  { estimate, quality, kind, reps, ageDays,
 *                                isBenchmark, exerciseId, exerciseName, date,
 *                                fatigueFactor? }
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
    // ⚠️ THE FATIGUE TERM IS HERE BECAUSE THE DEFECT IS HERE. `repFactor`
    // rewards low reps, on the premise that few reps means the weight was near
    // a limit — and that premise is FALSE for a lifter who stopped early
    // because the muscle was already spent. Measured on Tim's 2026-08-24
    // session: a lat pulldown done third scored 0.50 x repFactor(8) = 0.425 and
    // out-ranked his dumbbell row at 0.60 x repFactor(10) = 0.420. It led the
    // whole rating BY 0.005, entirely because fatigue held him to 8 reps
    // instead of 10.
    //
    // ⚠️ So fatigue did not merely depress the reading — it PROMOTED the
    // depressed reading. A fatigued set and a heavy near-max set are
    // indistinguishable to a rep count; this is the term that tells them apart,
    // and it is the whole reason the rating moved 32 % on one exercise.
    // docs/fatigue-plan.md §1.
    evidenceWeight: o.quality * repFactor(o.reps) * recencyWeight(o.ageDays)
      * fatigueOf(o) * (o.isBenchmark ? BENCHMARK_BONUS : 1),
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

  // ── ⚠️ WINSORISED, NOT A PLAIN WEIGHTED MEAN ─────────────────────────────
  //
  // The credibility sort above decided which evidence gets to LEAD. It did not
  // stop a low-credibility outlier from still dragging the answer, because a
  // weighted mean moves by an observation's weight share however implausible
  // the observation is. §9's shoulders case survived the sort fix in exactly
  // that reduced form: the face pull no longer set the rating but still added
  // ~4 % to it, because it sat at twice the credible estimate.
  //
  // robustAggregate() clips every value into [median/(1+k), median x (1+k)]
  // around the credibility-weighted median before averaging, at k = 0.25.
  // The outlier keeps its direction and its vote; what it loses is the ability
  // to pull an unbounded distance simply because it is large.
  //
  // WINSORISE RATHER THAN TRIM, and the reason is the third residual: a genuine
  // PR and a typo are indistinguishable at the moment either arrives, so
  // throwing the observation away would discard real progress. Clipping keeps
  // it pushing the right way while it waits for something to corroborate it.
  //
  // ⚠️ THIS IS FITTED, NOT CHOSEN — docs/strength-estimate-plan.md §15.1, and
  // k is pinned from both sides. Floor: the honest spread of one lift's daily
  // bests around its own window median reaches x1.204 at the 99.99th percentile
  // (n = 16,203), so below k ~ 0.21 it starts clipping days a lifter genuinely
  // had. Ceiling: across 200 simulated muscles against a known truth the worst
  // error falls 19.8 % -> 7.5 % at k = 0.25, and only to 9.2 % at k = 0.35.
  // It is FREE rather than a trade: with no outlier present at all it still
  // improved RMSE, 4.59 % -> 3.86 %.
  //
  // ⚠️ WHAT THIS DOES NOT FIX, so the two never get conflated. A x10 fat-finger
  // arrives with HIGH credibility, so clipping toward the median of the top
  // three barely touches it (measured: 343 % bias, unchanged). That is a
  // different failure needing a different mechanism — a sequential per-exercise
  // walk, which rateMuscle() does not do. §15.3.
  const estimate = robustAggregate(used.map((u) => ({ x: u.estimate, w: u.evidenceWeight })));
  if (!(estimate > 0)) return null;

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
  // ⚠️ THE HIGHEST-VALUE LINE IN THIS FUNCTION, and it is worth saying why.
  // Every re-weighting scheme measured against Tim's 2026-08-24 session moved
  // his Back rating by under 5 lb. Doing the same lat pulldown FIRST, at the
  // weight he could actually use fresh, moved it by 60.
  //
  // ⚠️ A FATIGUED SET IS MISSING INFORMATION, NOT CORRUPTED INFORMATION. There
  // is no weighting that recovers a number nobody recorded, so the only real
  // fix is another observation — and this is the one place in the app that can
  // ask for one. docs/fatigue-plan.md §3.
  //
  // ⚠️ And it is not a one-session problem. rateMuscle() keeps the BEST-EVER
  // estimate per exercise, which sounds like it heals itself and does not:
  // programme order is fixed, so a lift that is always third is always
  // understated, for as long as that programme runs. One fresh session fixes it
  // permanently, and nothing else does.
  // ⚠️ TWO SETS, because below that the line is not worth its own space. At one
  // set of prior work the discount is 17 % and the advice would be noise on a
  // phone; at two it is 29 % and the reading really is being held back. This is
  // a DISPLAY threshold, not a model one — the discount itself applies from the
  // first set either way, and nothing about the rating depends on this number.
  const HINT_MIN_PRIOR_SETS = 2;
  const led = rating.used[0];
  if (led && fatigueOf(led) < 1 && led.priorVolume >= HINT_MIN_PRIOR_SETS) {
    // ⚠️ Says what was measured and nothing more. An earlier draft read "it says
    // more about how tired you were than how strong you are", which is a claim
    // about a cause nobody measured — and at a 29 % discount it is simply
    // false. What is true is that the set came after other work and that doing
    // it earlier would read better. Rule 5.
    return `Your best reading here is ${led.exerciseName}, done after about `
      + `${Math.round(led.priorVolume)} sets of ${muscle.toLowerCase()} work that session. `
      + 'Doing it earlier in a session once would give it a cleaner reading.';
  }

  const bestQuality = Math.max(...rating.used.map((u) => u.quality));
  if (bestQuality < 0.8 && keyLift) {
    return `Based on close matches rather than the standard lift. A heavy set of ${keyLift} would confirm it.`;
  }
  return null;
}
