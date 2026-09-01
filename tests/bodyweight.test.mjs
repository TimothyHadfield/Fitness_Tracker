// Headless tests for BODY WEIGHT AS RESISTANCE. No dependencies.
//   node tests/bodyweight.test.mjs
//
// docs/handbook.md §9 first gap / §10 item 5: a pull-up used to rate no muscle at
// all, because a bodyweight movement logs ADDED load and an assisted one logs
// SUBTRACTED load, so neither number was comparable to a barbell's. Body weight
// is now a dated series, so total resistance is computable.
//
// ⚠️ WHAT THESE CAN AND CANNOT CHECK, in the spirit of volume-map.test.mjs.
// Two numbers go into every bodyweight rating and they are held to completely
// different standards, so they are tested differently:
//
//   the FRACTION (exercises.js) — how much of your body weight the movement
//     carries. Force-plate measured, or fixed by statics. A test can pin the
//     published value and can prove that an exercise with no figure stays
//     refused. That second half is the one that matters: the failure mode this
//     feature invites is somebody adding a plausible number for an inverted row.
//
//   the RATIO (muscle-evidence.js) — what that resistance is worth against the
//     muscle's key lift. A reasoned estimate like every other entry in that
//     table, and no test can make a judgement correct. What the tests do is
//     pin the direction (a ratio above 1 must DEFLATE the estimate, and getting
//     that backwards once gave a dumbbell row a 429 lb wrist curl), and prove
//     the calibration lands an ordinary lifter somewhere ordinary.
//
// The load-bearing assertions are the REFUSALS and the DATE rule. Everything
// else is arithmetic.

const { BUILT_IN_EXERCISES, BODY_WEIGHT_FRACTION, bodyWeightFractionFor, loadTypeFor } =
  await import('../js/exercises.js');
const {
  e1rm, isRankableSet, bodyWeightOn, totalResistance,
  canNormalize, normalizeBlockedReason, EXTRAPOLATED_BW_QUALITY, MAX_EVIDENCE_REPS,
} = await import('../js/e1rm.js');
const {
  contributionsFor, setLoad, totalLoad, rateMuscle, rankBlockedReason,
  FALLBACK_MIN_QUALITY,
} = await import('../js/muscle-evidence.js');
const { MUSCLE_LIFTS, percentileFor, levelFor } = await import('../js/strength-standards.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name + '|' + e.muscle, e]));
const ex = (name, muscle) =>
  BUILT_IN_EXERCISES.find((e) => e.name === name && (!muscle || e.muscle === muscle));

/* ================================================================== *
 * 1. What you weighed ON THE DAY OF THE SET
 * ================================================================== */

const WEIGH_INS = [
  { date: '2025-01-10', weight: 200 },
  { date: '2025-06-10', weight: 190 },
  { date: '2025-12-10', weight: 180 },
];

ok(bodyWeightOn(WEIGH_INS, '2025-06-10').weight === 190,
   'a weigh-in on the exact day of the set is used as-is');
ok(bodyWeightOn(WEIGH_INS, '2025-08-01').weight === 190,
   'between weigh-ins, the most recent one BEFORE the set is carried forward');
ok(bodyWeightOn(WEIGH_INS, '2026-04-01').weight === 180,
   'after the last weigh-in, the last one is carried forward');
ok(bodyWeightOn(WEIGH_INS, '2025-08-01').basis === 'carried',
   'a weigh-in carried forward is labelled "carried"');
ok(bodyWeightOn(WEIGH_INS, '2025-08-01').gapDays === 52,
   'and it reports how stale it is (52 days)');
ok(bodyWeightOn(WEIGH_INS, '2025-08-01').quality === 1,
   'a carried-forward weigh-in is worth full quality — it is what you weighed');

// ⚠️ THE WHOLE POINT OF THE DATE RULE. Somebody who has lost 20 lb must not
// have last year's pull-ups re-scored at today's weight: that would rewrite
// their history every time they stood on a scale, and in the wrong direction —
// losing weight would make their old pull-ups retroactively easier.
ok(bodyWeightOn(WEIGH_INS, '2025-02-01').weight === 200
   && bodyWeightOn(WEIGH_INS, '2025-12-20').weight === 180,
   '⚠️ the SAME pull-up scores against 200 lb in February and 180 lb in December');

// Somebody who logged a year of training and only weighed in last week. Their
// history is not thrown away, but the assumption is priced.
const LATE = [{ date: '2026-08-01', weight: 175 }];
ok(bodyWeightOn(LATE, '2025-03-01').weight === 175,
   'with only LATER weigh-ins, the earliest is carried backward rather than refusing');
ok(bodyWeightOn(LATE, '2025-03-01').basis === 'extrapolated',
   'and it is labelled "extrapolated", because that is an assumption, not a record');
ok(bodyWeightOn(LATE, '2025-03-01').quality === EXTRAPOLATED_BW_QUALITY
   && EXTRAPOLATED_BW_QUALITY < 1,
   'a backward-carried weigh-in is worth LESS than one you actually stood on a scale for');

// ⚠️ The refusal. No weigh-in at all must not become an average adult.
ok(bodyWeightOn([], '2025-06-01') === null, 'no weigh-ins at all means no body weight — null');
ok(bodyWeightOn(null, '2025-06-01') === null, 'a missing series is not an empty guess');
ok(bodyWeightOn([{ date: '2025-01-01', weight: 0 }], '2025-06-01') === null,
   'a zero weigh-in is not a body weight');
ok(bodyWeightOn([{ date: 'not-a-date', weight: 180 }], '2025-06-01') === null,
   'an unparseable date is discarded rather than sorted somewhere arbitrary');
ok(bodyWeightOn(WEIGH_INS, null) === null, 'a set with no date cannot be matched to a weigh-in');

// Order must not depend on how the rows arrived from storage.
const SHUFFLED = [WEIGH_INS[2], WEIGH_INS[0], WEIGH_INS[1]];
ok(bodyWeightOn(SHUFFLED, '2025-08-01').weight === 190,
   'the series is sorted internally, so storage order cannot change the answer');

/* ================================================================== *
 * 2. Total resistance
 * ================================================================== */

const pullUp = ex('Pull-Up');
const pushUp = ex('Push-Up');
const chestDip = ex('Chest Dip');

ok(totalResistance(pullUp, 0, 180).load === 180,
   'an unweighted pull-up at 180 lb resists 180 lb — 1.00 of body weight');
ok(totalResistance(pullUp, 45, 180).load === 225,
   'a pull-up with 45 lb added resists 225 lb');
ok(near(totalResistance(pushUp, 0, 180).load, 135),
   'a push-up at 180 lb resists 135 lb — 0.75 of body weight (Suprak 2011, down position)');
ok(totalResistance(chestDip, 90, 200).load === 290, 'a 200 lb lifter dipping +90 resists 290 lb');

// A reps-only exercise logs no weight at all. That is zero added load, not a
// missing number, and the resistance is fully determined without it.
ok(pushUp.fields.includes('reps') && !pushUp.fields.includes('weight'),
   'the push-up in the library is reps-only — it has no weight field');
ok(near(totalResistance(pushUp, undefined, 180).load, 135),
   'so a push-up with NO logged weight still has a computable resistance');
ok(near(totalResistance(pushUp, null, 200).load, 150), 'and it scales with the person');

// ⚠️ Refusals.
ok(totalResistance(pullUp, 0, null) === null, 'no body weight means no resistance — null');
ok(totalResistance(pullUp, 0, 0) === null, 'a zero body weight is not a body weight');
ok(totalResistance(ex('Inverted Row'), 0, 180) === null,
   '⚠️ an inverted row has no published fraction, so it has no resistance either');
ok(totalResistance(ex('Barbell Bench Press'), 185, 180) === null,
   'a barbell lift is not a body-weight lift and does not go through this path');

/* ------------------------------------------------------------------ *
 * The assist branch — SUBTRACTION, and it was unreachable until 2026-08-24
 * ------------------------------------------------------------------ */
//
// ⚠️ This arithmetic has been in e1rm.js since the body-weight work landed and
// no exercise in the app could reach it, because `Assisted Pull-Up` had no
// fraction entry and bodyWeightFractionFor() hardcoded `assist: false`. The cost
// was not that the branch was untested — it is that the assist machine fell
// through to the ordinary weighted path, where MORE weight reads as a HARDER
// set. See tests/progression for what that did to the suggestion.
const assistedPullUp = ex('Assisted Pull-Up');
const assist70 = totalResistance(assistedPullUp, 70, 180);
ok(assist70 !== null && near(assist70.load, 110),
   '⚠️ 70 lbs of assistance at 180 lbs body weight is 110 lbs of resistance — SUBTRACTED, not added');
ok(assist70 !== null && assist70.assist === true && near(assist70.base, 180) && near(assist70.added, 70),
   'and the parts come back separately, so a screen can say 180 less 70 rather than just "110"');
ok(near(totalResistance(assistedPullUp, 0, 180).load, 180),
   'no assistance at all is a pull-up: the whole body weight, and no special case for it');
ok(near(totalResistance(assistedPullUp, 30, 200).load, 170),
   'and it tracks the person, not a constant — the same 30 lbs off a heavier lifter leaves more');

// ⚠️ THE ONE REFUSAL THIS BRANCH MUST KEEP. A negative resistance is not a very
// easy set, it is a nonsense entry, and printing "-20 lbs on you" would be worse
// than printing nothing.
ok(totalResistance(assistedPullUp, 180, 180) === null,
   '⚠️ assistance equal to body weight is refused, not reported as a zero-pound lift');
ok(totalResistance(assistedPullUp, 250, 180) === null, 'and more help than you weigh is refused too');
ok(totalResistance(assistedPullUp, 70, null) === null,
   'and with no weigh-in it is refused exactly like a pull-up — the 70 is never treated as the load');

/* ================================================================== *
 * 3. The fraction table — and above all, what is NOT in it
 * ================================================================== */

ok(BODY_WEIGHT_FRACTION['Pull-Up'].fraction === 1.00
   && BODY_WEIGHT_FRACTION['Pull-Up'].basis === 'statics',
   'a pull-up is 1.00 of body weight by STATICS — nothing but the hands is in contact');
ok(BODY_WEIGHT_FRACTION['Chest Dip'].basis === 'statics'
   && BODY_WEIGHT_FRACTION['Triceps Dip'].basis === 'statics',
   'both dips are free hangs too, so both are 1.00 on the same footing');
ok(BODY_WEIGHT_FRACTION['Push-Up'].fraction === 0.75
   && BODY_WEIGHT_FRACTION['Push-Up'].basis === 'measured',
   'a push-up is 0.75 and is MEASURED — the feet share the load, so statics cannot settle it');

// Every entry declares which kind of claim it is, and there are only two.
ok(Object.values(BODY_WEIGHT_FRACTION).every((s) => s.basis === 'statics' || s.basis === 'measured'),
   'every entry declares its basis, and there is no third kind of justification');
ok(Object.values(BODY_WEIGHT_FRACTION).every((s) => s.fraction > 0 && s.fraction <= 1),
   'no fraction exceeds the whole body, and none is zero');
// A fraction known by statics must be worth more than one that had to be
// measured through a lever — otherwise the two claims are being treated alike.
ok(BODY_WEIGHT_FRACTION['Pull-Up'].q > BODY_WEIGHT_FRACTION['Push-Up'].q,
   'statics beats a force plate: the pull-up\'s fraction outranks the push-up\'s');

// ⚠️ THE ASSIST ENTRY MUST BE THE LEAST TRUSTED THING IN THIS TABLE, and the
// ordering is the whole of how the admission stays honest. Its fraction is a
// pull-up's 1.00 and is not in doubt; what is assumed is that the machine's
// stack number is pounds taken off the lifter, and unlike the push-up — where
// the uncertainty is a JUDGEMENT between three published force-plate figures —
// there is nothing published on either side of this one. If a later session
// raises this q, the argument for raising it has to be a source.
ok(BODY_WEIGHT_FRACTION['Assisted Pull-Up'].assist === true,
   '⚠️ the assist flag lives on the TABLE ENTRY, so a name regex is never what decides the sign');
ok(BODY_WEIGHT_FRACTION['Assisted Pull-Up'].q < BODY_WEIGHT_FRACTION['Push-Up'].q,
   '⚠️ and an assisted set is the least-trusted evidence in the table — below even the push-up');
ok(BODY_WEIGHT_FRACTION['Assisted Pull-Up'].fraction === BODY_WEIGHT_FRACTION['Pull-Up'].fraction,
   'while its FRACTION is a pull-up\'s exactly — you hang from your hands either way');
// The flag is opt-in, not a default somebody could invert by accident.
/* ⚠️ THREE OF THEM SINCE 2026-08-31, AND THE LIST IS STILL PINNED. The
 * assertion used to read "and it is the ONLY assisted entry today — adding a
 * second is a deliberate line, not a side effect", and that is exactly what
 * happened: Tim's friend could not find a dip machine, so Assisted Dip and
 * Assisted Chin-Up were added on purpose. What must not happen is a FOURTH
 * arriving as a side effect of something else, so the list is named rather than
 * counted. Every one of them carries the same fraction and the same q for the
 * same reason — you hang from your hands, and what is unknown is the linkage
 * between the stack number and the pounds it takes off you. */
ok(Object.entries(BODY_WEIGHT_FRACTION)
     .filter(([, s]) => s.assist).map(([n]) => n).sort().join(', ')
     === 'Assisted Chin-Up, Assisted Dip, Assisted Pull-Up',
   'the assisted entries are exactly the three machine movements, named — a fourth is a '
   + 'deliberate line, not a side effect');
ok(['Assisted Chin-Up', 'Assisted Dip'].every((n) =>
     BODY_WEIGHT_FRACTION[n].q === BODY_WEIGHT_FRACTION['Assisted Pull-Up'].q
     && BODY_WEIGHT_FRACTION[n].fraction === BODY_WEIGHT_FRACTION['Assisted Pull-Up'].fraction),
   '⚠️ and the two added later carry the SAME fraction and q as the first — the unknown is the '
   + 'machine, which is identical, not the movement');
ok(bodyWeightFractionFor(ex('Pull-Up')).assist === false,
   '⚠️ an ordinary pull-up reports assist FALSE rather than undefined — the sign is always stated');

// ⚠️ THE EXCLUSION LIST. These are the ones a later session will be tempted to
// fill in, and each is out for a stated reason rather than for want of looking.
const MUST_STAY_UNRANKABLE = [
  // ⚠️ REASONS CORRECTED 2026-09-06 (docs/research.md §15). Both of these were
  // out for a stated reason that was the WEAKER one, and a rule guarded by its
  // weakest reason gets overturned by whoever solves that reason — a session
  // duly set out to build the hand-height field this list implied would work.
  ['Inverted Row', 'the varied parameter is BODY ANGLE, not bar height, is not self-reportable, '
    + 'and the only source is an unindexed predatory journal'],
  ['Incline Push-Up', 'Ebben\'s box heights ARE named — the figures are peak dynamic GRF, a '
    + 'different basis from the static 75 % this app uses for the push-up'],
  ['Decline Push-Up', 'measured on a different basis (peak dynamic GRF) from the standard push-up'],
  ['Diamond Push-Up', 'no percent-of-body-mass figure exists for hand placement'],
  ['Wide-Grip Push-Up', 'same — Gouvali & Boudolos reported EMG only for hand variants'],
  ['Bench Dip', 'the feet are on the floor and take an unrecorded share'],
  ['Handstand Push-Up', 'the wall takes an unrecorded share; the circulated figure is misattributed'],
  ['Pike Push-Up', 'the feet take an unrecorded share'],
  // ⚠️ 'Assisted Pull-Up' WAS on this list and was taken off on 2026-08-24, on
  // Tim's instruction, after he used the app in a gym and his back training
  // rated nothing. The objection that put it here — the counterweight linkage
  // is not standardised, so the stack's number is not proven to be pounds off
  // you — is still true and is now priced in `q` instead. That is a different
  // decision from the rest of this list, which stay out because their FRACTION
  // is unknown; here the fraction is a pull-up's and the SUBTRACTED term is the
  // assumption. Do not read its removal as licence to fill in the others.
  ['Bodyweight Squat', 'its key lift logs EXTERNAL load, so the conversion is degenerate'],
  ['Nordic Hamstring Curl', 'same — the Romanian deadlift logs the bar, not the body'],
  ['Glute-Ham Raise', 'same'],
  ['Back Extension', 'same'],
  ['Single-Leg Calf Raise', 'same'],
  ['Single-Leg Hip Thrust', 'same'],
  ['Cossack Squat', 'same'],
  ['Sissy Squat', 'same'],
];
for (const [name, why] of MUST_STAY_UNRANKABLE) {
  const e = ex(name);
  ok(Boolean(e) && bodyWeightFractionFor(e) === null,
     `⚠️ ${name} has NO fraction — ${why}`);
  ok(Boolean(e) && contributionsFor(e, { bodyWeight: 180 }).length === 0,
     `   …and rates nothing even with a body weight in hand`);
}

// A custom exercise can never acquire a fraction, however it is named.
ok(bodyWeightFractionFor({ name: 'Pull-Up', isCustom: true, muscle: 'Back', fields: ['reps'] }) === null,
   '⚠️ a CUSTOM exercise named "Pull-Up" gets no fraction — a name is not a measurement');

// Every entry in the table must correspond to a real library exercise, or it is
// a typo that silently does nothing.
for (const name of Object.keys(BODY_WEIGHT_FRACTION)) {
  ok(Boolean(ex(name)), `the table entry "${name}" resolves to a real exercise`);
}

/* ================================================================== *
 * 4. Load routing, and the per-side trap
 * ================================================================== */

// ⚠️ Every ratio in muscle-evidence.js is in TOTAL load, so a per-side entry has
// to be doubled. The body-weight branch does no doubling, which is only correct
// while no bodyweight exercise is per-side. If somebody adds one, this fails.
const bwExercises = BUILT_IN_EXERCISES.filter((e) => bodyWeightFractionFor(e));
ok(bwExercises.length > 0 && bwExercises.every((e) => e.loadType !== 'per_side'),
   `⚠️ all ${bwExercises.length} exercises with a fraction are TOTAL load, never per-side`);

ok(setLoad(pullUp, 45, { bodyWeight: 180 }) === 225,
   'setLoad routes a bodyweight lift through the body-weight arithmetic');
ok(setLoad(ex('Barbell Bench Press'), 185, { bodyWeight: 180 }) === 185,
   'and routes a barbell lift straight through, ignoring body weight');
ok(setLoad(ex('Dumbbell Row'), 80, { bodyWeight: 180 }) === 160,
   'and still doubles a per-side dumbbell entry');
ok(setLoad(pullUp, 45) === null,
   'setLoad with no body weight refuses a pull-up rather than treating 45 as the load');
// ⚠️ The one that decides whether the muscle map is right or inverted. Every
// rating in the app converts through setLoad(), so if this returned 70 the
// machine would rate a lifter STRONGER the more help they took.
ok(setLoad(assistedPullUp, 70, { bodyWeight: 180 }) === 110,
   '⚠️ setLoad on an assist machine returns 110, not 70 — the rating sees resistance, never the stack');
ok(setLoad(assistedPullUp, 70) === null,
   'and with no body weight it refuses, rather than falling back to the 70 it must never use');
ok(totalLoad(80, 'per_side') === 160 && totalLoad(185, 'total') === 185,
   'totalLoad itself is untouched');

/* ================================================================== *
 * 5. The arity contract — an unwired caller must see NO change
 * ================================================================== */
//
// store.js and views-data.js call these with one argument today and are owned
// by other work. One argument means "I have not looked up a body weight", which
// is the honest state of both an unwired caller and a user with no weigh-in, so
// the old behaviour is the correct behaviour for it.

ok(contributionsFor(pullUp).length === 0,
   '⚠️ contributionsFor(exercise) with ONE argument still rates nothing for a pull-up');
ok(contributionsFor(assistedPullUp).length === 0,
   'and nothing for an assisted pull-up — which since 2026-08-24 means "no weigh-in yet", not "never"');
// ⚠️ Asserted from the other side too, because the line above now passes for a
// DIFFERENT REASON than it used to and a passing test that has quietly changed
// its meaning is worth less than no test. Before, it held because the exercise
// was permanently unrankable; now it holds only because no body weight was
// handed over. Without this pair, deleting the assist entry altogether would
// leave the suite green.
const assistedContribs = contributionsFor(assistedPullUp, { bodyWeight: 180 });
ok(assistedContribs.length > 0,
   '⚠️ hand it a body weight and an assisted pull-up DOES rate a muscle');
ok(assistedContribs.length > 0 && assistedContribs.every((c) => c.quality < 1),
   'and every contribution it makes is discounted — the linkage assumption is paid for here');
// ⚠️ VACUITY GUARD ON THE LENGTHS, not just on one of them. `[].every()` is
// true, so without the equality this whole comparison passed while
// assistedContribs was empty — which is exactly the state it was in five
// minutes ago, and the assertion said nothing about it.
const realContribs = contributionsFor(pullUp, { bodyWeight: 180 });
ok(assistedContribs.length === realContribs.length && realContribs.length > 0
   && assistedContribs.every((c, i) => c.muscle === realContribs[i].muscle
        && c.quality < realContribs[i].quality),
   '⚠️ and discounted BELOW a real pull-up muscle for muscle, so it loses as evidence where they meet');
ok(assistedContribs.every((c, i) => near(c.ratio, realContribs[i].ratio)),
   'while the RATIO is identical — 110 lbs of pulling is 110 lbs of pulling, whoever is holding it up');
ok(contributionsFor(ex('Barbell Row')).length > 0, 'while an ordinary lift is unaffected');
ok(canNormalize(pullUp) === false && canNormalize(pushUp) === false,
   'canNormalize(exercise) with one argument still refuses bodyweight work');
ok(canNormalize(ex('Barbell Bench Press')) === true, 'and still allows a barbell lift');
ok(normalizeBlockedReason(pullUp) === 'the logged weight is added load, not your total resistance',
   'the one-argument caption is byte-identical to what it always said');
ok(normalizeBlockedReason(pushUp) === null,
   'and a reps-only push-up still produces no caption, exactly as before');

// With a body weight, all four change together.
ok(canNormalize(pullUp, { bodyWeight: 180 }) === true,
   'given a body weight, a pull-up BECOMES normalisable');
ok(canNormalize(pushUp, { bodyWeight: 180 }) === true,
   'and so does a reps-only push-up — its resistance needs no logged weight');
ok(canNormalize(ex('Inverted Row'), { bodyWeight: 180 }) === false,
   'but an inverted row does not, because no body weight can supply a missing fraction');
ok(canNormalize(ex('Plank'), { bodyWeight: 180 }) === false, 'nor a time-only plank');
ok(normalizeBlockedReason(pullUp, { bodyWeight: 180 }) === null,
   'and the caption clears once it is chartable');
ok(/log a weigh-in/.test(normalizeBlockedReason(pullUp, { bodyWeight: null }) || ''),
   '⚠️ with no weigh-in the caption SAYS SO rather than silently guessing a body weight');
ok(/never been measured/.test(rankBlockedReason(ex('Inverted Row')) || ''),
   'the muscle panel distinguishes "never measured" from "we don\'t know your weight"');
ok(/log a weigh-in/.test(rankBlockedReason(pullUp, {}) || ''),
   'and tells somebody with no weigh-in the one thing they can act on');
ok(rankBlockedReason(pullUp, { bodyWeight: 180 }) === null,
   'and says nothing once the exercise actually counts');
ok(rankBlockedReason(ex('Barbell Row')) === null, 'an ordinary lift is never blocked');

/* ================================================================== *
 * 6. Contributions, and the quality they arrive at
 * ================================================================== */

const pullContribs = contributionsFor(pullUp, { bodyWeight: 180 });
ok(pullContribs.length === 1 && pullContribs[0].muscle === 'Back',
   '⚠️ a pull-up now rates BACK — the gap this whole change exists to close');
ok(pullContribs[0].kind === 'direct', 'and it is direct evidence, not a fallback');
ok(near(pullContribs[0].ratio, 1.28),
   'converted at 1.28 — Strength Level\'s median 180 lb male: (180+74) / 198');

// ⚠️ A ratio ABOVE 1 must DEFLATE the estimate. Getting this backwards is the
// exact mistake that once gave a dumbbell row a 429 lb wrist curl.
const rawPull = e1rm(setLoad(pullUp, 0, { bodyWeight: 180 }), 8);
ok(rawPull / pullContribs[0].ratio < rawPull,
   '⚠️ a ratio above 1 DEFLATES: 180 lb of pull-up implies a lighter barbell row');

// The fraction's own quality multiplies in, so a measured fraction and a
// statics one cannot reach the rating carrying the same weight.
const pushContribs = contributionsFor(pushUp, { bodyWeight: 180 });
const rawPullQ = 0.45, rawPushQ = 0.35;
ok(near(pullContribs[0].quality, rawPullQ * BODY_WEIGHT_FRACTION['Pull-Up'].q, 1e-9),
   'a pull-up\'s contribution quality is its ratio quality TIMES its fraction quality');
ok(near(pushContribs[0].quality, rawPushQ * BODY_WEIGHT_FRACTION['Push-Up'].q, 1e-9),
   'and the same for a push-up, which is why the push-up ends up lower');
ok(pushContribs[0].quality < pullContribs[0].quality,
   'so the better-known fraction outranks the shakier one');

// A body weight carried backward is priced too.
const extrap = contributionsFor(pullUp, { bodyWeight: 180, bodyWeightQuality: EXTRAPOLATED_BW_QUALITY });
ok(extrap[0].quality < pullContribs[0].quality,
   '⚠️ a pull-up scored against a backward-carried weigh-in is worth less than one that is not');
ok(near(extrap[0].quality, pullContribs[0].quality * EXTRAPOLATED_BW_QUALITY, 1e-9),
   'and exactly proportionally so');

// ⚠️ No fallback chaining off a bodyweight lift. A chin-up genuinely trains
// biceps, but the conversion would be a fraction times a drifting ratio times a
// cross-muscle ratio, and three estimates multiplied is a machine for
// confidently wrong numbers.
ok(pullContribs[0].quality < FALLBACK_MIN_QUALITY,
   '⚠️ a pull-up sits below the fallback threshold, so it stands in for no other muscle');
ok(!pullContribs.some((c) => c.kind === 'fallback'), 'and produces no fallback contribution');
ok(contributionsFor(ex('Barbell Row'), {}).some((c) => c.kind === 'fallback'),
   'while a barbell row still does — the threshold was not simply raised for everyone');

// Every grip variant is covered by the one rule, and every fraction-bearing
// exercise actually reaches a muscle.
for (const e of bwExercises) {
  const c = contributionsFor(e, { bodyWeight: 180 });
  ok(c.length > 0, `${e.name} rates a muscle once a body weight is known`);
}
ok(contributionsFor(ex('Chin-Up'), { bodyWeight: 180 })[0].muscle === 'Back'
   && contributionsFor(ex('Chest Dip'), { bodyWeight: 180 })[0].muscle === 'Chest'
   && contributionsFor(ex('Triceps Dip'), { bodyWeight: 180 })[0].muscle === 'Triceps',
   'each family lands on the muscle the library files it under');

/* ================================================================== *
 * 7. End to end — does it produce a person?
 * ================================================================== */
//
// The pipeline store.js runs, reproduced here the same way demo.test.mjs does:
// set -> resistance -> e1RM -> divided by the ratio -> rateMuscle -> percentile.

function rateFrom(sets, { bodyWeights, muscle, profile }) {
  const obs = [];
  for (const s of sets) {
    if (!isRankableSet(s.reps)) continue;
    const bw = bodyWeightOn(bodyWeights, s.date);
    const contribs = contributionsFor(s.exercise, {
      bodyWeight: bw ? bw.weight : null,
      bodyWeightQuality: bw ? bw.quality : 1,
    });
    if (!contribs.length) continue;
    const load = setLoad(s.exercise, s.weight, { bodyWeight: bw ? bw.weight : null });
    if (load === null) continue;
    const raw = e1rm(load, s.reps);
    if (raw === null) continue;
    for (const c of contribs) {
      if (c.muscle !== muscle) continue;
      obs.push({
        estimate: raw / c.ratio, quality: c.quality, kind: c.kind, reps: s.reps,
        weight: Number(s.weight) || 0, date: s.date, ageDays: s.ageDays || 0,
        isBenchmark: false, exerciseId: s.exercise.id, exerciseName: s.exercise.name,
      });
    }
  }
  const rating = rateMuscle(obs);
  if (!rating) return null;
  const percentile = percentileFor(rating.estimate, muscle, profile);
  return { ...rating, percentile, level: levelFor(percentile) };
}

const MALE_180 = { gender: 'male', bodyWeight: 180, age: 30, compare: null };
const BW_STEADY = [{ date: '2025-01-01', weight: 180 }];

// Somebody whose entire back training is pull-ups. Before this change they got
// nothing at all; the question now is whether they get something SENSIBLE.
const pullOnly = [8, 8, 9, 8, 10].map((reps, i) => ({
  exercise: pullUp, weight: 0, reps, date: `2025-0${i + 3}-01`, ageDays: 30 - i * 5,
}));
const backRating = rateFrom(pullOnly, { bodyWeights: BW_STEADY, muscle: 'Back', profile: MALE_180 });

ok(backRating !== null, '⚠️ a lifter whose only back work is pull-ups now HAS a back rating');
ok(backRating.estimate > 100 && backRating.estimate < 260,
   `and it implies a plausible barbell row (${Math.round(backRating.estimate)} lb)`);

// ⚠️ THE HEADLINE RISK. Eight to ten strict pull-ups is ordinary training, and
// Strength Level put the median 180 lb male at 13 reps. It must NOT read Elite.
ok(backRating.level.key !== 'elite' && backRating.level.key !== 'expert',
   `⚠️ 8-10 bodyweight pull-ups does NOT rate Elite or Expert — it reads ${backRating.level.name} `
   + `(${backRating.percentile.toFixed(0)}th)`);
ok(backRating.percentile > 20 && backRating.percentile < 80,
   'it lands in the ordinary middle of the distribution, not at either extreme');

// And it moves the right way with actual strength.
const strongPull = pullOnly.map((s) => ({ ...s, weight: 90 }));
const strongRating = rateFrom(strongPull, { bodyWeights: BW_STEADY, muscle: 'Back', profile: MALE_180 });
ok(strongRating.estimate > backRating.estimate * 1.3,
   'adding 90 lb to every pull-up raises the rating substantially');
ok(strongRating.percentile > backRating.percentile, 'and moves it up the distribution');

// Confidence must reflect that this is one exercise, converted twice.
ok(backRating.confidence < 0.72,
   'confidence stays out of the "High" band — one exercise, and a converted one');

// ⚠️ THE DATE RULE, END TO END. The identical set of pull-ups, logged by the
// identical person, must score differently before and after a 20 lb loss —
// and the later, lighter ones must score LOWER, not be retro-fitted.
const LOST_20 = [{ date: '2025-01-01', weight: 200 }, { date: '2025-09-01', weight: 180 }];
const heavyDay = [{ exercise: pullUp, weight: 0, reps: 8, date: '2025-02-01', ageDays: 400 }];
const lightDay = [{ exercise: pullUp, weight: 0, reps: 8, date: '2025-10-01', ageDays: 200 }];
const heavyRating = rateFrom(heavyDay, { bodyWeights: LOST_20, muscle: 'Back', profile: MALE_180 });
const lightRating = rateFrom(lightDay, { bodyWeights: LOST_20, muscle: 'Back', profile: MALE_180 });
ok(heavyRating.estimate > lightRating.estimate,
   '⚠️ 8 pull-ups at 200 lb outranks 8 pull-ups at 180 lb — history is scored at the weight of the day');
ok(near(heavyRating.estimate / lightRating.estimate, 200 / 180, 0.02),
   'and the gap is exactly the body-weight ratio, not some blend with today\'s weight');

// The same sets with NO weigh-in at all produce nothing — not a guess.
ok(rateFrom(heavyDay, { bodyWeights: [], muscle: 'Back', profile: MALE_180 }) === null,
   '⚠️ with no weigh-in on record the muscle stays UNRATED rather than being guessed');

/* ================================================================== *
 * 8. Sanity against a real year of training (the demo account)
 * ================================================================== */
//
// docs/handbook.md §0.10: running the demo year through the real pipeline is what
// exposed the credibility inversion that 1069 assertions had missed. The demo
// year contains no bodyweight work at all, so the first thing to prove is that
// this change does NOTHING to it — and then that bolting pull-ups on top of a
// real year does not blow the ratings up.

const { buildDemoData } = await import('../js/demo.js');
const demo = buildDemoData({ today: '2026-08-19' });
const demoExMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

function ratingsFromSessions(sessions, bodyWeights, profile, extraSets = []) {
  const out = new Map();
  const asOf = new Date('2026-08-19T00:00:00Z');
  const obsByMuscle = new Map();
  const push = (exercise, weight, reps, date) => {
    if (!isRankableSet(reps)) return;
    const bw = bodyWeightOn(bodyWeights, date);
    const contribs = contributionsFor(exercise, {
      bodyWeight: bw ? bw.weight : null, bodyWeightQuality: bw ? bw.quality : 1,
    });
    if (!contribs.length) return;
    const load = setLoad(exercise, weight, { bodyWeight: bw ? bw.weight : null });
    if (load === null) return;
    const raw = e1rm(load, reps);
    if (raw === null) return;
    const ageDays = Math.max(0, Math.round((asOf - new Date(date + 'T00:00:00Z')) / 86400000));
    for (const c of contribs) {
      if (!obsByMuscle.has(c.muscle)) obsByMuscle.set(c.muscle, []);
      obsByMuscle.get(c.muscle).push({
        estimate: raw / c.ratio, quality: c.quality, kind: c.kind, reps: Math.round(reps),
        weight: Number(weight) || 0, date, ageDays, isBenchmark: false,
        exerciseId: exercise.id, exerciseName: exercise.name,
      });
    }
  };
  for (const s of sessions) {
    for (const entry of s.entries || []) {
      const e = demoExMap.get(entry.exerciseId);
      if (!e) continue;
      for (const set of entry.sets || []) push(e, set.weight, set.reps, s.date);
    }
  }
  for (const s of extraSets) push(s.exercise, s.weight, s.reps, s.date);
  for (const muscle of Object.keys(MUSCLE_LIFTS)) {
    const r = rateMuscle(obsByMuscle.get(muscle) || []);
    if (!r) continue;
    const p = percentileFor(r.estimate, muscle, profile);
    if (p === null) continue;
    out.set(muscle, { estimate: r.estimate, percentile: p, level: levelFor(p), used: r.used });
  }
  return out;
}

// buildDemoData() returns storage rows, not a resolved profile, so it is
// rebuilt here exactly as demo.js builds its own: male, 30, and the LAST
// weigh-in of the generated year.
const demoLatestBw = demo.bodyWeight[demo.bodyWeight.length - 1].weight;
const demoProfile = { gender: 'male', bodyWeight: demoLatestBw, age: 30, compare: null };
const before = ratingsFromSessions(demo.sessions, demo.bodyWeight, demoProfile);

ok(before.size >= 8, `the demo year rates ${before.size} muscles`);
ok([...before.values()].every((r) => r.level.key !== 'elite'),
   'and none of them reads Elite — the baseline this change must not disturb');

// The demo year contains no bodyweight exercises, so nothing may move.
const demoUsesBodyweight = demo.sessions.some((s) => (s.entries || []).some((e) => {
  const x = demoExMap.get(e.exerciseId);
  return x && bodyWeightFractionFor(x);
}));
ok(demoUsesBodyweight === false, 'the demo year logs no bodyweight exercises at all');

// Now bolt a year of pull-ups onto that same lifter, three a week at the rep
// counts an ordinary trainee actually hits.
const pullSets = [];
for (let w = 0; w < 52; w++) {
  const d = new Date(Date.UTC(2025, 7, 20 + w * 7));
  const date = d.toISOString().slice(0, 10);
  const reps = 6 + Math.floor(w / 12);          // 6 -> 10 over the year
  for (let i = 0; i < 3; i++) pullSets.push({ exercise: pullUp, weight: 0, reps, date });
}
const after = ratingsFromSessions(demo.sessions, demo.bodyWeight, demoProfile, pullSets);

ok(after.get('Back') !== undefined, 'with pull-ups added, Back is still rated');
ok(after.get('Back').level.key !== 'elite' && after.get('Back').level.key !== 'expert',
   `⚠️ a YEAR of pull-ups on top of a real year of training does not rate Back Elite — `
   + `${after.get('Back').level.name} (${after.get('Back').percentile.toFixed(0)}th)`);
ok(Math.abs(after.get('Back').percentile - before.get('Back').percentile) < 25,
   `and it moves Back by under 25 percentile points `
   + `(${before.get('Back').percentile.toFixed(0)} -> ${after.get('Back').percentile.toFixed(0)})`);

// Nothing else may move at all — a pull-up rates Back and only Back.
let movedOthers = 0;
for (const [muscle, r] of before) {
  if (muscle === 'Back') continue;
  if (!after.has(muscle) || Math.abs(after.get(muscle).estimate - r.estimate) > 1e-9) movedOthers++;
}
ok(movedOthers === 0,
   '⚠️ and no OTHER muscle moves by a single pound — a pull-up chains into nothing');

/* ================================================================== *
 * 9. The winsorised aggregate  (strength-estimate-plan.md §15.1)
 * ================================================================== */
//
// rateMuscle() used to finish with a plain credibility-weighted mean, so an
// outlier moved the answer by its weight share however implausible it was. The
// credibility sort fixed which evidence LEADS; it did not bound how far a
// low-credibility reading could still drag the result. robustAggregate() clips
// every value into [median/(1+k), median x (1+k)] at k = 0.25 first.
//
// ⚠️ These assertions are written against the BEHAVIOUR, not against k. The
// constant is fitted in js/strength-estimate.js and re-derivable with
// tools/strength-fit.mjs; pinning 0.25 here would just duplicate it in a place
// where nobody would think to re-fit it.

const { robustAggregate, weightedMedian, DEFAULTS } = await import('../js/strength-estimate.js');
const plainMean = (items) =>
  items.reduce((a, i) => a + i.x * i.w, 0) / items.reduce((a, i) => a + i.w, 0);

// A muscle rated by three exercises that broadly agree.
const CLEAN = [{ x: 200, w: 1.0 }, { x: 208, w: 0.5 }, { x: 194, w: 0.3 }];
ok(near(robustAggregate(CLEAN), plainMean(CLEAN), 1e-9),
   'with no outlier, winsorising changes the answer not at all');

// ⚠️ §9's shoulders case, which is still alive in the demo year: a 15-rep face
// pull converting to twice the credible reading, beside an overhead press.
const SHOULDERS = [{ x: 147.4, w: 0.845 }, { x: 156.7, w: 0.088 }, { x: 300.4, w: 0.063 }];
const shMedian = weightedMedian(SHOULDERS);
const shPlain = plainMean(SHOULDERS);
const shRobust = robustAggregate(SHOULDERS);
const nudgePlain = (shPlain - shMedian) / shMedian;
const nudgeRobust = (shRobust - shMedian) / shMedian;
ok(nudgeRobust < nudgePlain / 2,
   `⚠️ the face pull's nudge is more than halved (${(nudgePlain * 100).toFixed(1)} % `
   + `-> ${(nudgeRobust * 100).toFixed(1)} %)`);
ok(shRobust < shPlain, 'so the shoulder estimate comes down');
ok(shRobust > shMedian,
   '⚠️ but NOT to the median — the outlier keeps its vote and its direction, '
   + 'because a PR and a typo look identical on the day they arrive');

// The clip is exactly the documented window, and it is SYMMETRIC — a
// pessimistic outlier is pulled up just as a flattering one is pulled down.
const k = DEFAULTS.winsorK;
const LOW = [{ x: 200, w: 1.0 }, { x: 205, w: 0.5 }, { x: 60, w: 0.4 }];
ok(robustAggregate(LOW) > plainMean(LOW),
   'a LOW outlier is clipped upward — winsorising is not a one-way haircut');
const lowMed = weightedMedian(LOW);
const expected = plainMean(LOW.map((i) => ({ x: Math.min(lowMed * (1 + k), Math.max(lowMed / (1 + k), i.x)), w: i.w })));
ok(near(robustAggregate(LOW), expected, 1e-9),
   'and the window is exactly [median/(1+k), median x (1+k)] around the weighted median');

// Degenerate inputs must not produce a number out of nothing.
ok(robustAggregate([{ x: 180, w: 0.4 }]) === 180, 'one observation is its own aggregate');
ok(robustAggregate([]) === null, 'no observations produce no aggregate');
ok(robustAggregate([{ x: 180, w: 0 }]) === null, 'a zero-weight observation is not evidence');

// ⚠️ WHAT IT DOES NOT FIX. A x10 fat finger arrives with HIGH credibility, so
// it dominates the weighted median and clipping barely touches it. Recording
// this as a test so the two failures never get conflated: §15.1 bounds a
// low-credibility outlier, §15.3 is what would catch an impossible one.
const TYPO = [{ x: 2250, w: 1.0 }, { x: 225, w: 0.5 }, { x: 218, w: 0.3 }];
ok(robustAggregate(TYPO) > 1500,
   '⚠️ a x10 typo is NOT fixed by winsorising — it needs the quarantine walk (§15.3)');

/* ---- through rateMuscle() itself ---- */

const mkObs = (name, estimate, quality, reps) => ({
  estimate, quality, kind: 'direct', reps, weight: 100, date: '2026-08-01', ageDays: 10,
  isBenchmark: false, exerciseId: name, exerciseName: name,
});
const withOutlier = rateMuscle([
  mkObs('press', 147.4, 1.00, 3),
  mkObs('db-press', 156.7, 0.60, 8),
  mkObs('face-pull', 300.4, 0.25, 15),
]);
const withoutOutlier = rateMuscle([
  mkObs('press', 147.4, 1.00, 3),
  mkObs('db-press', 156.7, 0.60, 8),
]);
// ⚠️ The threshold is 2 %, not a comfortable 6 %, and the tightness is the
// point. §15.1 measured this exact case at +3.9 % before and +1.0 % after, so a
// loose bound would pass either way and would not notice the winsoriser being
// removed. Checked: at k = 0 this reads 4.0 %.
ok(withOutlier.estimate / withoutOutlier.estimate < 1.02,
   '⚠️ rateMuscle: adding a 15-rep face pull at twice the credible reading moves the '
   + `rating under 2 % (${((withOutlier.estimate / withoutOutlier.estimate - 1) * 100).toFixed(1)} %)`);
// Companion, so the number above is anchored rather than merely small: the
// plain weighted mean over the SAME three observations must be materially worse.
const wouldBe = plainMean(withOutlier.used.map((u) => ({ x: u.estimate, w: u.evidenceWeight })));
ok(wouldBe / withOutlier.estimate > 1.02,
   `⚠️ and the plain weighted mean over the same three would have read `
   + `${(((wouldBe / withoutOutlier.estimate) - 1) * 100).toFixed(1)} % high instead`);
ok(withOutlier.estimate > withoutOutlier.estimate,
   'it still moves it upward, so the observation is bounded rather than discarded');
ok(withOutlier.used.length === 3,
   'and all three still count as contributors — nothing was trimmed out of the record');

/* ---- the demo year ---- */
//
// ⚠️ The comparison has to be built from each rating's OWN contributors. Taking
// a "before" by calling ratingsFromSessions() twice would compare the winsorised
// pipeline with itself and pass no matter what — the shape of vacuous test this
// project has been bitten by before. rateMuscle() returns `used`, so the plain
// weighted mean it would have produced is recoverable exactly.

let worst = 0, engaged = 0;
for (const [muscle, r] of before) {
  const items = r.used.map((u) => ({ x: u.estimate, w: u.evidenceWeight }));
  const wouldHaveBeen = plainMean(items);
  const delta = Math.abs(r.estimate - wouldHaveBeen) / wouldHaveBeen;
  if (delta > 1e-9) engaged++;
  worst = Math.max(worst, delta);
}
ok(engaged > 0,
   `⚠️ the winsoriser actually ENGAGES on the demo year — ${engaged} of ${before.size} muscles `
   + 'differ from the plain weighted mean, so the bound below is not vacuous');
ok(worst < 0.06,
   `and no muscle moves more than 6 % (worst ${(worst * 100).toFixed(1)} %) — `
   + 'a bounded correction, not a re-scoring');
ok([...before.values()].every((r) => r.level.key !== 'elite' && r.level.key !== 'expert'),
   'on a year of ordinary training no muscle reads Elite or Expert');

/* ================= the knee push-up (2026-09-06) =================
 *
 * The one variant `docs/research.md` §15 could admit, and it is admitted for the
 * reason the rest of the family is refused: **no mixing of measurement bases.**
 * Suprak 2011 measured it on the same plate, with the same 28 men, in the same
 * static down position as the push-up — so the two numbers are directly
 * comparable, and a knee push-up sits below a full one because it is genuinely
 * lighter rather than because two labs disagreed. */
{
  const knee = ex('Knee Push-Up');
  ok(Boolean(knee), 'the library has a Knee Push-Up — the most likely FIRST chest exercise anybody '
     + 'logs, and the map was grey for exactly the people with least reason to trust it yet');

  const spec = BODY_WEIGHT_FRACTION['Knee Push-Up'];
  ok(spec && spec.fraction === 0.62 && spec.basis === 'measured',
     'its fraction is 0.62, MEASURED — Suprak 2011 gives 61.80 %');
  ok(spec.q === BODY_WEIGHT_FRACTION['Push-Up'].q,
     '⚠️ and it carries the push-up\'s own q, unchanged: the uncertainty priced there is the '
     + 'judgement about which published quantity belongs in a strength estimate, and it is the '
     + 'same judgement — not a second guess stacked on the first');
  ok(spec.fraction < BODY_WEIGHT_FRACTION['Push-Up'].fraction,
     'and it is lighter than a full push-up, which is the only thing about these two a reader '
     + 'already knows and would notice being wrong');

  /* 🚨 THE ORDERING, DRIVEN RATHER THAN REASONED. Getting this backwards would
     rate a beginner on knee push-ups ABOVE somebody doing full ones at the same
     rep count — the exact class of inversion §9 records as the worst defect this
     ranking model has ever had. It is checked at every rep count the app will
     accept as evidence, not at one convenient pair. */
  const opts = { bodyWeight: 180, bodyWeightQuality: 1 };
  const kneeRatio = contributionsFor(ex('Knee Push-Up'), opts)[0].ratio;
  const pushRatio = contributionsFor(ex('Push-Up'), opts)[0].ratio;
  // The estimate the map would actually show, through the whole pipeline: total
  // resistance -> e1RM at that rep count -> divided by the ratio. Comparing the
  // resistances alone would prove less, because a later ratio edit could invert
  // the result without moving either load.
  const estimateAt = (name, reps, ratio) =>
    e1rm(totalResistance(ex(name), 0, 180).load, reps) / ratio;
  const inverted = [3, 6, 10, 15].filter((reps) =>
    !(estimateAt('Knee Push-Up', reps, kneeRatio) < estimateAt('Push-Up', reps, pushRatio)));
  ok(inverted.length === 0,
     '🚨 a knee push-up estimates STRICTLY LESS than a full one at every rep count the app will use '
     + `as evidence${inverted.length ? ` — inverted at ${inverted.join(', ')}` : ' (104/117/133 lb '
     + 'against 124/140/158 at 6/10/15)'}. Getting this backwards would rate a beginner above `
     + 'somebody stronger, which is the class of inversion §9 records as the worst defect this '
     + 'ranking model has ever had');

  const kneeContribs = contributionsFor(knee, opts);
  ok(kneeContribs.length > 0 && kneeContribs[0].muscle === 'Chest',
     'it rates Chest rather than sitting in the blocked list — which is the entire point of adding it');
  ok(kneeContribs[0].quality < contributionsFor(ex('Push-Up'), opts)[0].quality,
     '⚠️ but is worth LESS than a full push-up: the ratio is CARRIED from it rather than calibrated '
     + 'against knee push-up standards, which do not exist. §0h\'s lesson — the worst entries in '
     + 'that table were the ones somebody had reasoned about');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
