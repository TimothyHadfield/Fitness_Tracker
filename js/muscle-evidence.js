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
//
// ── 2026-09-13, THE STRENGTH-ACCURACY BUILD (docs/strength-accuracy-plan.md) ──
//
// Seven read-only agents audited this pipeline and Tim said build it. What
// changed in THIS file, each with the plan section it answers:
//
//   · A ratio may now be a PAIR, `{ m, f }`, and `contributionsFor()` takes
//     `opts.sex` (§3.6, decision g). Pulls, body-weight lifts and machines
//     differ between the sexes by 20–40 % on Strength Level's own pages; a
//     dumbbell swap does not. Unknown sex → the mean of the two, which is what
//     `crossMuscleRatio()` always did. The body-weight FRACTION table stays
//     sex-neutral: it is biomechanics, and only the ratio carries the sex.
//   · ~Twenty-five entries were more than 10 % off (§2.3) — every one a reasoned
//     or carried number, or a regex family covering two load conventions. All
//     re-derived from Strength Level male-180 / female-140, the sweep's own
//     method, and the families split where the convention differs.
//   · The fallback floor is strict (`>`, §2.4), so a deadlift no longer chains
//     into a curl through a row median because its q lands exactly on 0.45.
//   · ~~One seat per exercise went to its BEST-EVER day~~. It goes to a WINDOWED
//     estimate of that exercise — `estimateAt()` from strength-estimate.js,
//     84 days widening to 180 then all, with its 2 %/week fall limit (§3.1,
//     decision a: the map may fall) — anchored on the exercise's MOST CREDIBLE
//     day, not its largest (§3.4, decision d). Ties break on credibility, then
//     on the newest date, so walk order no longer matters (§2.5).
//   · `screenDaily()` runs per exercise before rating (§3.2, decision b). A day
//     no training could have produced is set aside, named on the rating as
//     `quarantined`, never deleted, and released the moment another day agrees.
//   · Where an exercise has any ≤ 8-rep set in the window, only ≤ 8-rep sets
//     compete for it (§3.8, decision i), and confidence is priced by rep count
//     (`repPrecision`).
//   · A rating built only from fallbacks cannot read better than Fair (§3.9,
//     decision j).
//   · A flat rep run — 8, 8, 8 at one load — is evidence the set was not near
//     failure; the observation carries `notToFailure` and is discounted
//     (§5.3, FLAT_RUN_DISCOUNT). Withhold only; nothing here raises a number.
//   · An observation's `rawE1rm` arrives from `setE1rm()` in set-e1rm.js — per
//     hand into the curve, then doubled (§2.8, decision e). `totalLoad()` and
//     `setLoad()` stay exported for the callers that still hold a load.

import { e1rm, isRankableSet, totalResistance } from './e1rm.js';
import { bodyWeightFractionFor, standInFor } from './exercises.js';
import { DEFAULTS, robustAggregate, estimateAt, screenDaily, dailyValues } from './strength-estimate.js';
import { MUSCLE_LIFTS, standardQualityFor } from './strength-standards.js';

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

  /* ⚠️ THE CUSTOM CASE COMES FIRST, and the ordering is load-bearing: a custom
   * exercise created with equipment "Bodyweight" would otherwise fall into the
   * branch below and be told its body-weight fraction has never been measured,
   * which is true of every exercise nobody has measured and is not the reason
   * THIS one is not counted. Say the reason that can be acted on. */
  if (exercise.isCustom) {
    /* 🚨 THE 2026-08-31 WORDING IS UNCHANGED AND STILL FIRES, and this is the
     * path that stops the stand-in becoming that bug again. A custom exercise
     * with nothing chosen is refused in exactly the same words it has been
     * refused in since the incident — the sentence is the design, not a
     * leftover. */
    const target = standInFor(exercise);
    if (!target) {
      return 'it is your own exercise, so there is no published way to compare it '
        + 'with a barbell — it still counts toward your volume';
    }
    /* ⚠️ ASKED OF THE REAL FUNCTION, for the same reason the weighted branch at
     * the bottom of this function is. A match is not a guarantee of a rating:
     * somebody can pick a library exercise that has no ratio of its own
     * (Machine Dip, Wrist Roller), and a sentence saying their exercise cannot
     * be converted would leave them wondering what the match did. Name the
     * exercise they picked, because that is the thing they can change. */
    if (contributionsFor(exercise, opts).length) return null;
    return `you matched this with ${target.name}, and that one can’t be converted `
      + 'into a barbell lift either — it still counts toward your volume';
  }

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

  /* 🚨 AND THE SILENT CASE, CLOSED 2026-08-31. A LIBRARY exercise that matches no
   * ratio rule contributes nothing and, until now, said nothing — six of them
   * were sitting in the library like that (Larsen Press, Cable Press Around,
   * Kroc Row, Cross-Body Cable Triceps Extension, Wrist Roller, Banded Hip
   * Abduction), found by walking the whole library through contributionsFor()
   * rather than by anybody noticing. A set that vanishes without a word is the
   * exact fault the blocked list was built to end. */
  /* ⚠️ A BAND IS NOT A WEIGHT, and it was the last silent one left after the
   * 2026-08-31 sweep (Banded Hip Abduction, which logs reps and no load at all).
   * The generic message below would have said "nobody has published a
   * conversion", which invites somebody to go looking for one — the real
   * obstacle is that a band's resistance depends on how far it is stretched and
   * on the band, and neither is recorded or recordable here. */
  if (exercise.equipment === 'Band') {
    return 'a band’s resistance depends on how far it is stretched, so it cannot be '
      + 'compared with a weight';
  }

  /* 🚨 AND THE LAST SILENT SHAPE, CLOSED 2026-09-04 BY MAKING CORE RANKABLE.
   *
   * An exercise that records NO LOAD AT ALL and has no measured body-weight
   * fraction — the Ab Wheel Rollout is the only one in the library — used to
   * fall straight out of the bottom of this function saying nothing. It went
   * unnoticed for as long as it did because the branch below returns null for
   * anything without a `weight` field, and every such exercise happened to sit
   * under Core, which was not rated, so nothing ever asked.
   *
   * ⚠️ THE MOMENT CORE BECAME RANKABLE THAT STOPPED BEING TRUE, and the
   * data-layer assertion that walks the whole library caught it in the same
   * commit. Worth recording: the rankability change did not create this hole,
   * it revealed one — and the test that found it was written for a different
   * sweep entirely, which is the argument for that kind of test.
   *
   * ⚠️ IT NAMES THE REAL OBSTACLE. The generic message further down says nobody
   * has published a conversion, which invites somebody to go and look for one.
   * For a rollout there is nothing to convert: the resistance is a lever, set by
   * how far out you go, and the app records neither that nor a weight. */
  const noLoad = !Array.isArray(exercise.fields) || !exercise.fields.includes('weight');
  if (noLoad && !bodyWeightFractionFor(exercise)) {
    return 'this one records no weight, and how hard it is depends on leverage the app '
      + 'cannot see — so it can’t be compared with a barbell. It still counts toward your volume';
  }

  if (noLoad) return null;
  // ⚠️ ASKED OF THE REAL FUNCTION, not re-derived from the rules table. The first
  // version of this branch returned the message for EVERY weighted exercise and
  // told the barbell row it could not be converted — caught immediately by
  // "an ordinary lift is never blocked". contributionsFor() is the one place
  // that knows, and it cannot call back into here, so there is no recursion.
  if (contributionsFor(exercise, opts).length) return null;
  return 'nobody has published a way to convert this one into a barbell lift yet';
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
//
// ⚠️ ENTRY SHAPE SINCE 2026-09-13: `[regex, ratio, q]` where `ratio` is a
// NUMBER (the same for both sexes) or a PAIR `{ m, f }` (male / female).
// `resolveRatio()` picks by `opts.sex`; with no sex known it takes the mean of
// the two, which is exactly what crossMuscleRatio() has always done. A scalar
// is a claim that the sexes agree within 10 % on that page; a pair is a
// measurement that they do not. The provenance comment on a pair says which
// Strength Level rows each side came from.
//
// ⚠️ AND THE LOAD CONVENTION IS HALF OF EVERY ENTRY. Each ratio was derived on
// ONE reading of the number a user types — a per-side entry doubled, or the
// whole load — as `loadTypeFor()` in exercises.js decides it. Two names in one
// regex family with different conventions is how a machine lateral raise came
// to be doubled and then divided by the two-dumbbell ratio (a 3.7× inflation).
// Where the conventions differ the family is split, and the split entry sits
// FIRST. Moving a name between FORCE_PER_SIDE and FORCE_TOTAL is a ratio
// change and has to be made here too.
//
// ⚠️ THE 2026-09-13 CORRECTION ROUND (plan §2.3, agent C's 108-page audit).
// Every entry the 2026-08-26/28 sweep DERIVED reproduced to the rounding.
// Every miss over 10 % was a reasoned or carried number, or a regex family
// covering two load conventions — the sweep's own fourth lesson, again. Each
// corrected entry below says "derived 2026-09-13 from SL m180/f140", quotes
// the five levels, and takes the median of the five, honouring the app's
// convention for that name. Machine pages are 2020-era with small samples
// (Cable Shrug 1,288 results, Machine Shrug 2,786, Landmine Press 4,132), so
// their q sits at 0.30–0.40 however flat the drift.
//
// ⚠️ THE 2026-08-26 SWEEP (Open work 0h, closing pass). Every remaining
// reasoned entry with a published Strength Level standard was derived by the
// established technique — one population, both lifts, a 180 lb male, divide,
// take the median of the five levels — 28 lifts fetched in one day. Three
// findings worth keeping:
//
//   1. THE ERRORS STILL RUN MOSTLY ONE WAY — TOO LOW, WHICH FLATTERS (the
//      estimate divides by the ratio). The worst: Pec Deck 0.55 → 0.90,
//      Concentration Curl 0.62 → 0.92, Good Morning 0.60 → 0.95, Sumo
//      Deadlift 1.52 → 1.97, Upright Row 0.70 → 0.94, Preacher Curl
//      0.82 → 0.96. But NOT all: Leg Press 2.00 → 1.73, Hip Thrust
//      1.15 → 0.96 and Dumbbell Shrug 0.95 → 0.70 ran the other way and had
//      been UNDER-crediting those lifters. A sweep that assumed the direction
//      would have "fixed" those three backwards.
//   2. AND THEY ARE STILL NOT A CONSTANT — 0 % (Hack Squat, confirmed exactly)
//      to ~60 % (Pec Deck). No blanket factor could have fixed this table,
//      which is why each entry carries its own derivation.
//   3. WHERE NO STANDARD EXISTS, THE ENTRY NOW SAYS SO — "reasoned, no
//      published standard" or "carried across a corrected anchor" — so the
//      next sweep can see at a glance what is measured and what is not.
//
// ⚠️ THE SWEEP FINISHED ON 2026-08-28 AND 0h IS CLOSED. The last four names on
// it were decline dumbbell bench, seated dumbbell shoulder press, Arnold press
// and spider curl. Three were derived; spider curl is closed as NOT DERIVABLE
// and labelled, because SL's table is for a barbell and this library's lift is
// a dumbbell. A fourth finding joins the three above, and it is a different
// kind from all of them:
//
//   4. ⚠️ THE WORST ENTRIES WERE NOT THE UNCHECKED ONES — THEY WERE THE ONES
//      SOMEBODY HAD REASONED ABOUT. Every earlier finding was a guess nobody
//      had tested. These three were all ARGUED FOR in comments, and two of
//      them inverted an ordering the argument was specifically trying to get
//      right: decline was raised above flat because "a decline moves more
//      load" (true of a barbell, false of dumbbells), and seated shoulder
//      press was left below standing, which says a back support makes you
//      weaker. A confident mechanism in a comment is not evidence, and it
//      reads exactly like evidence to the next person. Where an entry carries
//      an argument and no numbers, check the argument FIRST.
//
// ⚠️ WHAT IS STILL A GUESS, so the next reader does not have to re-derive it:
// the entries that say so. ~~Machine Row,~~ Single-Leg Extension, Machine Hip
// Thrust, Glute Bridge, the cable fly family and Spider Curl are all labelled
// "no published standard" and were each checked at least once. They are not
// open work; they are answered, and the answer is that no honest division
// exists.
//
// ⚠️ "NO PUBLISHED STANDARD" HAS A SHELF LIFE. On 2026-09-03 agent C found
// pages for Machine Row, the horizontal leg press, Machine Curl, the shrug
// variants and the seated dip machine — every one added by Strength Level in
// 2020 or later, after the entries that said "checked, nothing published" were
// written. Those entries were true when written and are derived now. The rule
// "where no standard exists the entry says so" needs a date beside it, and
// from this round on it carries one: every URL is
// https://strengthlevel.com/strength-standards/<slug>/lb and the slug is named
// in the entry, so the next sweep can re-fetch rather than re-argue.
//
// Where a derivation's five ratios drift widely across levels, `q` went DOWN
// or stayed low even though the median is now sourced — a fixed ratio still
// compresses everybody toward the middle. Where the drift is nearly flat
// (Seated Cable Row 0.98–0.99, Seated Calf 0.65–0.67, Rack Pull 2.07–2.11),
// `q` went UP, because there the single number really is the population.
const RATIOS = {
  Chest: [ // key: Barbell Bench Press
    [/^Barbell Bench Press$/, 1.00, 1.00],
    // 2026-08-26 sweep: Strength Level close-grip 124/163/208/260/314 over
    // bench 127/169/220/277/339 → 0.98/0.96/0.95/0.94/0.93, median 0.95.
    // Was a reasoned 0.88 — the grip costs about half what was assumed.
    [/^Close-Grip Bench Press$/, 0.95, 0.80],
    [/^Incline Barbell Bench Press$/, 0.85, 0.80],
    // Both handicaps at once: 0.95 for the grip × 0.85 for the incline ≈ 0.81.
    // Quality below either parent because that product is reasoned rather than
    // measured — no standards are published for the combined lift. Recomputed
    // 2026-08-26 when the grip anchor moved.
    [/^Close-Grip Incline Bench Press$/, 0.81, 0.65],
    [/^Decline Barbell Bench Press$/, 1.03, 0.75],
    [/^Floor Press$/, 0.92, 0.70],
    [/Smith Machine Bench Press/, 1.00, 0.50],
    // ⚠️ THE PER-SIDE DUMBBELL SWEEP, 2026-08-24. See the note above the Back
    // table's Dumbbell Row entry for how this class of error was found. Every
    // reasoned per-side dumbbell ratio checked so far has been too LOW, which
    // inflates the lifter, because the estimate divides by it.
    //
    // Strength Level publish the dumbbell bench PER DUMBBELL; this app logs it
    // per side and doubles. Against their barbell bench at a 180 lb male — the
    // same five numbers the Chest Dip derivation above already uses:
    //     beginner (43x2)/127 = 0.68   novice (64x2)/169 = 0.76
    //     intermediate (89x2)/220 = 0.81
    //     advanced (119x2)/277 = 0.86  elite (152x2)/339 = 0.90
    // Median 0.81, against a reasoned 0.72 — a 12 % inflation.
    //
    // ⚠️ The drift from 0.68 to 0.90 is real and runs the same way as the dip's:
    // two dumbbells demand stabilisation a bar does not, and that costs a novice
    // proportionally more. A fixed ratio therefore still understates strong
    // dumbbell pressers and overstates weak ones, which is why `q` does not rise
    // now that the number is sourced.
    //
    /* ⚠️ INCLINE IS MEASURED NOW (2026-08-27). SL incline dumbbell press
     * 49/66/88/113/139 per dumbbell, doubled, over bench 127/169/220/277/339 →
     * 0.772/0.781/0.800/0.816/0.820, median 0.800, against a carried 0.70 —
     * so it had been flattering incline pressers by about 14 %.
     *
     * ⚠️ THIS IS THE FLAT SIDE OF THE DRIFT RULE AND q GOES UP. The five ratios
     * span 0.772 to 0.820 — a 1.1x sweep, the flattest thing in this whole
     * table. Where the per-level ratios are nearly identical the ratio really
     * is a population constant, so a single number costs a lifter almost
     * nothing and deserves to be believed: 0.55 → 0.72, just under the flat
     * press's own 0.65... and above it, because a flatter source is a better
     * source. It also lands just below the flat press's 0.81, which is the
     * ordering an incline has to keep.
     *
     * ⚠️ DECLINE IS MEASURED NOW (2026-08-28), AND THE REASONING THIS COMMENT
     * USED TO CARRY WAS WRONG — 0h's last chest entry, closed. SL decline
     * dumbbell press 36/57/84/117/153 per dumbbell, doubled, over bench
     * 127/169/220/277/339 → 0.567/0.675/0.764/0.845/0.903, median 0.764.
     *
     * ⚠️ THAT IS THE NUMBER THAT WAS HERE BEFORE SOMEBODY REASONED IT UPWARD.
     * This entry read 0.76 originally; on 2026-08-24 it was raised to 0.86 on
     * the argument that "a decline genuinely moves more load", so sitting below
     * the flat press was "backwards". The argument is sound for a BARBELL —
     * Decline Barbell Bench Press is 1.03 against a flat 1.00 above, and that
     * ordering survives — and it does not transfer to dumbbells, because what
     * limits a heavy decline dumbbell press is getting the bells into position
     * on a declined bench, not the press. SL's own population declines LESS
     * than it flat presses at every level but elite.
     *
     * ⚠️ THE LESSON IS THE ONE 0h KEEPS TEACHING FROM A NEW ANGLE. Every
     * previous finding was a guess that had never been checked. This was a
     * measurement-shaped number OVERWRITTEN by a plausible mechanism, and the
     * mechanism was real but belonged to a different implement. A reasoned
     * override of an unexplained number should be the thing that gets checked
     * first, not the thing that gets trusted.
     *
     * The error under-credited decline pressers by ~12 %, which is the rarer
     * direction here and the harmless one. q rises off the floor now the median
     * is sourced, but only a step: the 1.59x drift is the widest in the
     * pressing family, so a single number still compresses badly.
     */
    [/Incline Dumbbell Bench Press/, 0.80, 0.72],
    // Female side derived 2026-09-13 from SL f140 decline-dumbbell-bench-press
    // 14/28/46/70/96 ×2 over bench 44/72/108/152/201 → median 0.85: women
    // decline nearly as much as they flat press, men do not. The male 0.76 is
    // the 2026-08-28 figure, unchanged.
    [/Decline Dumbbell Bench Press/, { m: 0.76, f: 0.85 }, 0.55],
    /* ⚠️ CARRIED, NOT MEASURED (2026-08-31, the library sweep). Nobody publishes
     * a squeeze-press standard. Two dumbbells pressed hard together the whole
     * way up cost real load — the pecs are fighting the adduction as well as the
     * press — so it sits a step under the flat dumbbell press's 0.81 rather than
     * beside it, and q is low because the discount is judgement. */
    [/Dumbbell Squeeze Press/, 0.65, 0.30],
    [/Dumbbell Bench Press/, 0.81, 0.65],
    // Carried across the Incline Barbell anchor (0.85) with the Smith discount
    // the flat version already takes. Not separately sourced.
    [/Smith Machine Incline Bench Press/, 0.85, 0.40],
    [/Incline Machine Press/, 0.82, 0.45],
    // 2026-08-26 sweep: SL machine chest press 88/137/200/274/356 over bench
    // → 0.69/0.81/0.91/0.99/1.05, median 0.91. The drift is machine gearing
    // across brands, which is exactly what a low q prices — it goes DOWN a
    // step now that the spread has been seen rather than guessed at.
    // Female side derived 2026-09-13 (slug chest-press, f140 25/48/81/122/169
    // over bench 44/72/108/152/201 → median 0.75): women press relatively
    // LESS on the machine, so the male 0.91 was under-crediting them ~18 %.
    [/Machine Chest Press/, { m: 0.91, f: 0.75 }, 0.35],
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
    /* ⚠️ THE ASSISTED DIP RIDES WITH THE FREE ONE, exactly as Assisted Pull-Up
     * rides with the pull-ups in Back below. It is the same movement at a
     * lighter load: `assist: true` has already turned the stack number into
     * "body weight minus help" by the time this ratio is applied, so what
     * arrives here is a dip's total resistance either way. The extra
     * uncertainty about the machine's linkage is priced in the BODY_WEIGHT
     * FRACTION's own q (0.65 against the free hang's 0.95), which is where the
     * unknown actually lives. */
    // Female side derived 2026-09-13 (slug dips, f140 added −33/0/39/84/131 +
    // 140 lb of body, over bench 44/72/108/152/201 → 2.43/1.94/1.66/1.47/1.65,
    // median 1.66). Body weight is a bigger share of a woman's dip than of a
    // man's, so the male 1.35 was flattering women's chest by ~19 %.
    [/^(Chest Dip|Assisted Dip)$/, { m: 1.35, f: 1.66 }, 0.45],
    // Push-up resistance is FIXED at 0.75 x body weight, so unlike a barbell it
    // cannot be loaded — the rep count carries all of the information. Above 15
    // reps the set stops being evidence of a maximum at all (D5), and Strength
    // Level put the median 180 lb male at 38 push-ups, so in practice this rule
    // only ever fires for relative beginners. That is exactly where it was
    // calibrated: at 180 lb the resistance is 135, which at their beginner
    // standard of 6 reps estimates 167 against a 127 lb bench (1.32), and at
    // the 15-rep ceiling estimates 213 against roughly 154 (1.38).
    [/^Push-Up$/, 1.35, 0.35],
    /* 🆕 THE KNEE PUSH-UP CARRIES THE PUSH-UP'S RATIO — 2026-09-06 — and the
     * reason it may is that the two differ ONLY in the load, which is already
     * handled a step earlier. `totalResistance()` reads the body-weight fraction
     * (0.62 against 0.75, both measured in the same protocol), so what arrives
     * here is a horizontal press against a known load in both cases, and the
     * ratio's job from that point is identical.
     *
     * ⚠️ IT IS CARRIED, NOT CALIBRATED, AND THAT IS WHY q DROPS to 0.30. There
     * are no published knee push-up standards to fit against — the push-up's
     * 1.35 was checked against Strength Level's own beginner and 15-rep figures
     * and this one cannot be. §0h's lesson is exactly this: **the worst entries
     * in this table were the ones somebody had REASONED about**, so a carried
     * ratio is priced below its anchor rather than beside it.
     *
     * ⚠️ THE ORDERING WAS CHECKED RATHER THAN ASSUMED, because getting it
     * backwards would rate a beginner above somebody stronger. At 180 lb: a knee
     * push-up estimates 104 / 117 / 133 lb of bench at 6 / 10 / 15 reps against a
     * full push-up's 124 / 140 / 158 — strictly below at every rep count, which
     * is the only relationship between these two that could be obviously wrong. */
    [/^Knee Push-Up$/, 1.35, 0.30],
    [/Dumbbell Pullover/, 0.35, 0.35],
    // ⚠️ 0.55 UNTIL 2026-08-26, AND IT WAS THE WORST ERROR THE SWEEP FOUND —
    // inflating every pec-deck user's chest by ~60 %. SL machine chest fly
    // (pec deck) 96/142/199/266/339 over bench → 0.76/0.84/0.90/0.96/1.00,
    // median 0.90: the machine's lever arm means the stack number runs nearly
    // as high as a bench press, not half of one.
    // ⚠️ "Machine Fly" is the same machine under the other name in common use,
    // and it must be caught HERE rather than by the generic /Fly/ three lines
    // down — that one is 0.30, a third of this, and would have under-rated every
    // pec-deck user who happened to log it under the machine's other name.
    // Female side derived 2026-09-13 (slug machine-chest-fly, f140
    // 30/53/84/123/167 over bench → median 0.78; was under-crediting ~14 %).
    [/Pec Deck|Machine Fly/, { m: 0.90, f: 0.78 }, 0.35],
    // ⚠️ REASONED, AND STUCK THAT WAY FOR AN UNUSUAL REASON: SL publish cable
    // fly standards (19/44/82/131/189) but never say whether the number is
    // one stack or both, and the two readings give 0.37 or 0.75 — a source
    // that cannot answer the per-side question is not a source for a per-side
    // lift. Checked 2026-08-26, left reasoned.
    [/Cable Fly|Cable Crossover|Low-to-High|High-to-Low/, 0.40, 0.30],
    // ⚠️ TWO OF THE SIX SILENT ONES, CLOSED 2026-08-31. Walking the whole
    // library through contributionsFor() found six exercises that matched no
    // rule, contributed nothing and said nothing about it. These two are the
    // Chest pair. A press-around is a fly that finishes as a press, so it takes
    // the cable-fly number with a lower q; a Larsen press is a bench press with
    // the legs off the floor, which costs the leg drive and nothing else.
    [/Cable Press Around/, 0.40, 0.25],
    [/Larsen Press/, 0.90, 0.40],
    /* ⚠️ SPLIT OUT OF THE GENERIC /Fly/ 2026-09-13 (plan §2.3). Derived from SL
     * m180 dumbbell-fly 18/33/53/78/106 per dumbbell, doubled, over bench
     * 127/169/220/277/339 → 0.28/0.39/0.48/0.56/0.63, median 0.48; f140
     * 9/16/26/38/52 ×2 over 44/72/108/152/201 → median 0.48. Sex-neutral to the
     * second decimal, like every other dumbbell swap. The generic 0.30 below
     * was flattering every dumbbell fly by ~38 % (30 × 12 read Chest 87th).
     * Incline Dumbbell Fly rides on the same rule — no incline page exists —
     * and the drift (2.2×) keeps q at the cable grade. */
    [/Dumbbell Fly/, 0.48, 0.30],
    [/Fly/, 0.30, 0.30],
    [/Svend Press/, 0.12, 0.20],
    /* ⚠️ MACHINE DIP CONVERTS NOW — 2026-09-13. ~~No ratio for MACHINE DIP on
     * purpose … a seated dip machine's leverage is unpublished~~ was true on
     * 2026-08-31 and stopped being true when agent C found Strength Level's
     * "Seated Dip Machine" page (slug seated-dip-machine, 2020-era). Derived
     * m180 126/182/251/332/419 over bench 127/169/220/277/339 →
     * 0.99/1.08/1.14/1.20/1.24, median 1.14; f140 over bench → median 1.20.
     * The same page gives 1.21 (m) / 1.23 (f) against the CLOSE-GRIP bench —
     * that is the triceps figure, and the library files this exercise under
     * Chest, so the bench figure is the one this table can use. Machine-grade
     * q: a stack whose lever nobody standardises, on a page with a small
     * sample. Tim's friend's 60 × 10 now reads ~40th, Novice, instead of
     * nothing — or, through the custom-exercise guess it replaced, Advanced. */
    [/^Machine Dip$/, { m: 1.14, f: 1.20 }, 0.40],
  ],
  Back: [ // key: Barbell Row
    [/^Barbell Row$/, 1.00, 1.00],
    // Derived 2026-09-13 from SL m180/f140 (slug pendlay-row): m 120/158/204/
    // 255/310 over row 108/149/198/255/315 → 1.11/1.06/1.03/1.00/0.98, median
    // 1.03; f 58/83/113/148/186 over 41/66/97/134/175 → median 1.17. Was a
    // reasoned 0.95 — a dead-stop row is not weaker than a touch-and-go one,
    // and women's is relatively stronger still.
    [/^Pendlay Row$/, { m: 1.03, f: 1.17 }, 0.75],
    [/^Yates Row$/, 1.10, 0.70],
    // Derived 2026-09-13 (SL "Bench Pull", slug seal-row): m 106/146/195/250/
    // 310 over row → 0.98 at every level (drift 0.98–0.985, flat as the seated
    // cable row); f 58/80/105/135/166 → median 1.08. Was a reasoned 0.85 —
    // flattering ~13 %. q rises a step for the flat drift.
    [/^Seal Row$/, { m: 0.98, f: 1.08 }, 0.75],
    // Derived 2026-09-13 (slug t-bar-row): m 86/130/185/250/321 over row →
    // 0.80/0.87/0.93/0.98/1.02, median 0.93; f 34/61/96/140/189 → median 0.99.
    // Was a reasoned 1.05 — under-crediting ~12 %. The drift (1.28×) is a
    // plate-loaded lever's, so q drops a step.
    [/^T-Bar Row$/, { m: 0.93, f: 0.99 }, 0.55],
    // Derived 2026-09-13 (slug chest-supported-dumbbell-row): m 33/55/84/119/
    // 158 ×2 over row → 0.61/0.74/0.85/0.93/1.00, median 0.85; f 17/29/46/67/
    // 91 ×2 → median 0.95. Was a reasoned 0.80. Still below the free dumbbell
    // row's 0.98 on both sides, which is the ordering the entry has to keep.
    [/Chest-Supported Dumbbell Row/, { m: 0.85, f: 0.95 }, 0.55],
    [/Chest-Supported Row/, 0.95, 0.45],
    [/Meadows Row/, 0.55, 0.45],
    // Carried across the T-Bar anchor (1.05): a landmine row is a T-bar row
    // without the pad and without the machine, so it moves a little less.
    [/Landmine Row/, 1.00, 0.40],
    // One of the six silent ones (2026-08-31). A Kroc row is a dumbbell row done
    // heavy and loose for high reps — the same lift with body english, so it
    // takes the dumbbell row's own sourced 0.98 with q dropped for the looseness.
    [/Kroc Row/, 0.98, 0.35],
    // ⚠️ 0.85 UNTIL 2026-08-24, AND IT WAS FLATTERING EVERY DUMBBELL ROW BY ~15 %.
    // Tim asked whether his lats were really as weak as the app said; this was
    // the other half of the answer, and it ran the other way from the fatigue
    // finding — one of his three back lifts was reading too HIGH.
    //
    // ⚠️ NOW DERIVED FROM PUBLISHED STANDARDS rather than reasoned, by the same
    // technique as the dip and pull-up entries: one population, both lifts, all
    // at a 180 lb male, divide. Strength Level publish the dumbbell row PER
    // DUMBBELL, so the total is doubled — which is what this app logs it as.
    //     beginner  (44x2)/108 = 0.81   novice (67x2)/149 = 0.90
    //     intermediate (97x2)/198 = 0.98
    //     advanced (132x2)/255 = 1.04   elite (171x2)/342... /315 = 1.09
    // Median 0.98. The barbell row denominators are the SAME five numbers the
    // pull-up derivation below already uses, so the two are not spliced from
    // different populations.
    //
    // ⚠️ The drift from 0.81 to 1.09 is real, in the same way the dip's is, and
    // it is why `q` stays at 0.60 rather than rising now that the ratio is
    // sourced: a fixed ratio compresses everybody toward the middle, so this
    // still overstates weak lifters and understates strong ones.
    //
    // ⚠️ ORDERING PRESERVED, which is why this entry could move alone: a
    // chest-supported row removes the torso english, so less weight moves and a
    // lower ratio is correct — 0.80 still sits below this, as it must.
    [/Dumbbell Row/, 0.98, 0.60],
    /* ⚠️ "Smith Machine Row" MUST stay ahead of the machine-row rule: a Smith
     * row is a barbell row on a fixed bar, which is what the 1.00 says, and the
     * machine-row page below is a chest-supported plate-loaded machine — not
     * the same lift. Carried, as it was. */
    [/Smith Machine Row/, 1.00, 0.45],
    // ~~Reasoned — SL publish NO machine-row standard (checked 2026-08-26)~~.
    // They have since 2020 (slug machine-row). Derived 2026-09-13: m 106/162/
    // 234/318/410 over row → 0.98/1.09/1.18/1.25/1.30, median 1.18; f 47/77/
    // 116/163/215 → median 1.20. The reasoned 1.00 was flattering ~15 %. q at
    // the machine grade — and BELOW the fallback floor now, so a machine row
    // no longer stands in for Biceps, Traps and Forearms; only a real row does.
    [/Machine Row|Hammer Strength Row/, { m: 1.18, f: 1.20 }, 0.40],
    // 2026-08-26 sweep: SL seated cable row 106/146/195/251/312 over barbell
    // row 108/149/198/255/315 → 0.98 at EVERY level (drift 0.98–0.99, the
    // flattest in the file). q rises: here the single number really is the
    // population. Female side derived 2026-09-13: 49/73/103/140/179 over
    // 41/66/97/134/175 → median 1.06 (women's cable row is relatively stronger
    // than their barbell row, the pattern of every pull on this page).
    [/Seated Cable Row|Wide-Grip Seated Row/, { m: 0.98, f: 1.06 }, 0.60],
    // Carried across the corrected pulldown anchor (× 0.95/0.90), not measured.
    [/Single-Arm Lat Pulldown/, 0.84, 0.40],
    // Same treatment for the one-arm row, carried across the seated cable row's
    // sourced 0.98 by the same 0.86 the pulldown pair implies. It is logged per
    // side and doubled, so the comparison is like for like.
    [/Single-Arm Cable Row/, 0.84, 0.35],
    // Carried across Cable Pullover, which is the same movement on a different
    // machine and is itself reasoned rather than sourced.
    [/Machine Pullover/, 0.45, 0.25],
    /* ⚠️ SPLIT OUT OF THE PULLDOWN FAMILY 2026-09-13, and it is the entry Tim's
     * Back rating was being held down by (plan §2.3, agent C's D4). A
     * straight-arm pulldown is a lat isolation on a cable, not a pulldown, and
     * the family's 0.95 read 100 × 10 as a 151 lb barbell row — 17th, Beginner
     * — while still clearing the fallback floor and dragging Biceps, Traps and
     * Forearms down with it. Derived from SL (slug straight-arm-pulldown):
     * m180 44/77/120/173/232 over row → 0.41/0.52/0.61/0.68/0.74, median 0.61;
     * f140 25/43/67/97/131 over 41/66/97/134/175 → median 0.69. 2020-era cable
     * page with a 1.8× drift, so q is the cable grade — and below the fallback
     * floor, so it rates Back and nothing else. */
    [/Straight-Arm Pulldown/, { m: 0.61, f: 0.69 }, 0.35],
    // 2026-08-26 sweep: SL lat pulldown 106/143/189/241/296 over barbell row
    // → 0.98/0.96/0.95/0.95/0.94, median 0.95. Nearly flat, so q rises a step.
    // Female side derived 2026-09-13: 52/75/103/136/172 over 41/66/97/134/175
    // → 1.27/1.14/1.06/1.01/0.98, median 1.06.
    [/Lat Pulldown|Pulldown/, { m: 0.95, f: 1.06 }, 0.55],
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
    // ⚠️ At 0.45 this lands ON the fallback floor, and the floor is strict
    // (`>` since 2026-09-13), so a pull-up rates Back and nothing else — it
    // will not stand in for Biceps, Traps or Forearms the way a barbell row
    // does. ~~"just under" the floor~~ — it was never under it; it only cleared
    // the old `>=` because the fraction's q multiplied it down to 0.4275, and
    // the Deadlift entry below at the same 0.45 with no fraction to shrink it
    // DID chain into a curl. That is deliberate now rather than lucky. A
    // chin-up genuinely does train biceps, but the conversion would be a
    // body-weight fraction times a ratio that already drifts 1.10-1.63 times a
    // cross-muscle ratio, and three estimates multiplied together is how the
    // "machine for confidently wrong numbers" gets built.
    //
    // ⚠️ SEX-SPECIFIC SINCE 2026-09-13, and it is the largest sex effect in the
    // file after the face pull. SL f140 pull-ups −36/−10/19/52/86 added, plus
    // 140 lb of body, over row 41/66/97/134/175 → 2.54/1.97/1.64/1.43/1.29,
    // median 1.64 (chin-ups 1.67, within the rounding, so one rule still
    // covers the family). At the male 1.28 six strict pull-ups at 140 lb read
    // Back 79th, Proficient; at 1.64 they read ~55th. Body weight is simply a
    // bigger share of a woman's pull than of a man's.
    // ⚠️ ASSISTED IS IN THE SAME FAMILY AT THE SAME RATIO, and it belongs here
    // rather than in a line of its own: the ratio converts RESISTANCE to the
    // muscle's key lift, and by the time it is applied the assistance has
    // already been subtracted — 110 lb of assisted pull-up is the same 110 lb of
    // pulling as a lifter who weighs 110. What is less certain about it is the
    // 110 itself, and that is priced once, in the fraction table's `q`, rather
    // than twice. Added 2026-08-24; without it the exercise had a fraction and
    // still rated nothing, because this regex is anchored.
    [/^(Pull-Up|Chin-Up|Neutral-Grip Pull-Up|Wide-Grip Pull-Up|Assisted Pull-Up|Assisted Chin-Up)$/, { m: 1.28, f: 1.64 }, 0.45],
    // Deadlift family. These are tagged Back in the library and are genuinely
    // back work, but they are pulls, not rows — hence the wide conversions and
    // the low quality. Deadlift itself is ALSO the key lift for Glutes, which
    // the key-lift rule in contributionsFor() handles separately.
    //
    // ⚠️ ALL FIVE DERIVED 2026-08-26 (were reasoned), over the same barbell
    // row denominators the pull-up entry uses. Every one was TOO LOW —
    // flattering deadlifters' back ratings by 13–30 %:
    //   Deadlift 201/268/348/438/535 → 1.86/1.80/1.76/1.72/1.70, median 1.76
    //   Sumo     230/303/390/488/592 → 2.13/2.03/1.97/1.91/1.88, median 1.97
    //   Trap bar 223/291/372/464/560 → 2.06/1.95/1.88/1.82/1.78, median 1.88
    //   Deficit  216/281/358/444/535 → 2.00/1.89/1.81/1.74/1.70, median 1.81
    //   Rack pull 224/310/415/535/664 → 2.07/2.08/2.10/2.10/2.11, median 2.10
    // Rack pull's drift is nearly flat, so its q rises a step; the rest keep
    // theirs — the drift is real and a fixed ratio still compresses.
    // The family now orders sensibly on its own: rack pull (part range) >
    // sumo > trap bar > deficit ≈ conventional, all above 1.
    //
    // ⚠️ FEMALE SIDES DERIVED 2026-09-13, all over SL f140 row 41/66/97/134/175:
    //   Deadlift  93/139/196/264/338 → 2.27/2.11/2.02/1.97/1.93, median 2.02
    //   Sumo     108/153/210/275/345 → median 2.17
    //   Trap bar 110/155/211/274/343 → median 2.18
    //   Deficit  116/157/207/264/324 → median 2.13
    //   Rack pull 121/176/246/328/416 → median 2.54
    // Women's rows are relatively weaker than their pulls by 10–21 %, so the
    // male ratios were flattering a woman's Back off every deadlift variant.
    // The ordering survives on the female side: rack > trap ≈ sumo > deficit
    // > conventional.
    [/^Rack Pull$/, { m: 2.10, f: 2.54 }, 0.40],
    [/^Trap Bar Deadlift$/, { m: 1.88, f: 2.18 }, 0.40],
    [/^Sumo Deadlift$/, { m: 1.97, f: 2.17 }, 0.40],
    [/^Deficit Deadlift$/, { m: 1.81, f: 2.13 }, 0.40],
    // ⚠️ q 0.45 sits ON the fallback floor and, with the floor strict since
    // 2026-09-13, a deadlift rates Back and no longer chains into Biceps, Traps
    // and Forearms. It did until then — a pull converted through a row median
    // into a curl, giving a deadlift-only lifter Biceps 75th off 405 × 3 (plan
    // §2.4) — because `>=` let 0.45 through. It is still Glutes' key lift at
    // 1.00 via the key-lift rule, which is unaffected.
    [/^Deadlift$/, { m: 1.76, f: 2.02 }, 0.45],
    // 2026-08-26: SL good morning 68/119/189/274/370 over barbell row →
    // 0.63/0.80/0.95/1.07/1.17, median 0.95. Was 0.60 — a 37 % flatter. The
    // drift is the widest of the barbell entries (novices barely load it,
    // strong lifters treat it as a real pull), so q goes DOWN a step even
    // though the median is now sourced.
    // Paired 2026-09-15: 0.955 male / 1.041 female.
    [/Good Morning/, { m: 0.96, f: 1.04 }, 0.30],
    [/Reverse Hyperextension/, 0.55, 0.25],
  ],
  Quads: [ // key: Back Squat
    [/^Back Squat$/, 1.00, 1.00],
    [/^High-Bar Squat$/, 0.98, 0.85],
    [/^Low-Bar Squat$/, 1.04, 0.85],
    [/^Box Squat$/, { m: 1.16, f: 1.15 }, 0.70],
    // Raised 2026-09-15: SL gives 0.990 male / 0.994 female — the sexes agree,
    // so it stays a single number, but 0.90 was 9 % low for both.
    [/^Pause Squat$/, 0.99, 0.75],
    [/^Front Squat$/, 0.83, 0.75],
    // Raised 2026-09-15: 1.040 male / 1.067 female. A safety bar is not the
    // 5 % penalty on a back squat this assumed; it is roughly par.
    [/^Safety Bar Squat$/, 1.05, 0.65],
    [/^Zercher Squat$/, { m: 0.85, f: 0.81 }, 0.50],
    // ⚠️ The Smith squat runs the OTHER way — 1.05 was over-crediting the bar,
    // not under. SL: 0.89 male, 0.84 female.
    [/Smith Machine Squat/, { m: 0.89, f: 0.84 }, 0.45],
    // 2026-08-26 sweep: SL hack squat 143/230/342/477/626 over squat
    // 169/228/298/377/462 → 0.85/1.01/1.15/1.27/1.35 — median 1.15, EXACTLY
    // the reasoned number. Kept, now sourced; the huge drift (novices hack
    // less than they squat, strong lifters far more) is why q stays low.
    [/Hack Squat/, 1.15, 0.40],
    [/Pendulum Squat/, 1.05, 0.35],
    [/Belt Squat/, { m: 1.40, f: 1.50 }, 0.35],
    [/Single-Leg Press/, { m: 0.95, f: 0.97 }, 0.30],
    // 2026-08-26 sweep, and one of the three that ran the OTHER way: SL sled
    // leg press 246/366/516/692/884 over squat → 1.46/1.61/1.73/1.84/1.91,
    // median 1.73. The reasoned 2.00 was UNDER-crediting every leg press by
    // ~15 %. Drift stays wide (sled angle and brand), q unchanged.
    /* ⚠️ BEFORE /Leg Press/, AND THE ORDERING IS THE WHOLE POINT (2026-08-31).
     * The 1.73 above is the 45° SLED, where you also push your own body up the
     * rails; the horizontal seated machine moves you nowhere and the stack is
     * the whole story, so the same number on the pin means a much smaller lift.
     * Reasoned from that mechanism, not published — anyone finding a horizontal
     * leg press standard should replace this rather than trust it. Falling into
     * the sled's rule would have over-rated every seated leg press by ~57 %. */
    // ⚠️ The horizontal/seated leg press HAS a page now (it did not when this
    // entry was written, and the comment asking somebody to find one is struck
    // through above): 1.32 male, 1.47 female.
    [/Seated Leg Press/, { m: 1.32, f: 1.47 }, 0.25],
    [/Leg Press/, { m: 1.73, f: 1.94 }, 0.35],
    // Reasoned — no published single-leg standard (checked 2026-08-26). Still
    // ordered below the bilateral entry, which is all the guess claims.
    [/Single-Leg Extension/, 0.55, 0.25],
    // 2026-08-26 sweep: SL leg extension 107/162/231/313/402 over squat →
    // 0.63/0.71/0.78/0.83/0.87, median 0.78. Was 0.60 — flattering by ~23 %.
    [/Leg Extension/, 0.78, 0.30],
    [/Goblet Squat/, { m: 0.31, f: 0.35 }, 0.40],
    // One end of a bar in a corner, held at the chest — a goblet squat with a
    // longer lever and a little more load. Carried, not published.
    [/Landmine Squat/, 0.40, 0.25],
    // ⚠️ The barbell versions added 2026-08-31 fall into these two family rules
    // deliberately. The ratios were set for the dumbbell versions, and a barbell
    // split squat or lunge is the same movement with the load on the back — what
    // changes is how much you can hold, not the fraction of a squat it
    // represents, and the load is what gets logged either way.
    // Paired 2026-09-15: 0.503 male / 0.558 female.
    [/Bulgarian Split Squat|Split Squat/, { m: 0.50, f: 0.56 }, 0.40],
    /* ⚠️ SPLIT 2026-09-13. The 0.45 was derived from SL's DUMBBELL lunge (two
     * bells, doubled) and the family then applied it to a BARBELL lunge, whose
     * own page gives 0.62 male / 0.68 female — a 28 % flattery on a 135 x 8.
     * Two load conventions, one regex: the fourth lesson of the 2026-08-26
     * sweep, found again. The barbell rule sits first. */
    [/Barbell Lunge/, { m: 0.62, f: 0.68 }, 0.35],
    [/Lunge/, 0.45, 0.35],
    [/Step-Up/, 0.45, 0.30],
  ],
  Hamstrings: [ // key: Romanian Deadlift
    [/^Romanian Deadlift$/, 1.00, 1.00],
    [/^Stiff-Leg Deadlift$/, 0.98, 0.80],
    // 2026-08-26 sweep: SL dumbbell RDL per dumbbell 43/67/98/136/177,
    // doubled, over RDL 147/207/280/364/455 → 0.59/0.65/0.70/0.75/0.78,
    // median 0.70. The reasoned 0.75 was slightly UNDER-crediting.
    [/Dumbbell Romanian Deadlift/, { m: 0.70, f: 0.81 }, 0.60],
    // Standing on a plate or a block: more range, a little less weight. Carried
    // off the RDL anchor by the same reasoning the deficit deadlift uses in
    // Back (1.81 against a 1.76 conventional pull, in the other direction
    // because that one is a floor pull).
    [/Deficit Romanian Deadlift/, 0.95, 0.35],
    /* 🛑 NOT DERIVABLE FROM STRENGTH LEVEL'S PAGE, CHECKED 2026-09-15 — and the
     * check is recorded so nobody "corrects" this against it a third time.
     * Their single-leg RDL standards are for a BARBELL; this library's is a
     * DUMBBELL lift logged per side and doubled. Dividing a doubled per-hand
     * load by a barbell population is precisely the mistake the spider curl
     * entry refuses, and it would read 13 % low for a woman while looking like
     * a fix. Stays reasoned and labelled until a dumbbell table exists. */
    [/Single-Leg Romanian Deadlift/, 0.45, 0.35],
    // 2026-08-26 sweep: SL lying leg curl 68/103/148/201/259 over RDL →
    // 0.46/0.50/0.53/0.55/0.57, median 0.53. Was 0.45 — flattering ~18 %.
    // One number covers the seated/lying/standing family; SL's seated table
    // was not separately derived.
    /* ⚠️ SPLIT 2026-09-13. The lying curl's 0.53 was derived and is right; the
     * SEATED curl was carrying it, and the note beside it admitted "SL's seated
     * table was not separately derived". It exists: 87/131/185/250/320 (m),
     * 44/71/107/150/198 (f) over the RDL → median 0.66 / 0.71. Seated is the
     * commoner machine, and at 0.53 a 150 x 10 read Hamstrings 93rd rather than
     * ~70th. It sits first, because /Leg Curl/ would otherwise take it. */
    [/Seated Leg Curl/, { m: 0.66, f: 0.71 }, 0.35],
    [/Leg Curl/, 0.53, 0.35],
    [/Cable Pull-Through/, { m: 0.49, f: 0.59 }, 0.30],
    [/Kettlebell Swing/, 0.35, 0.25],
  ],
  Glutes: [ // key: Deadlift
    [/^Deadlift$/, 1.00, 1.00],
    // Carried across the corrected hip-thrust anchor (× 0.96/1.15), not
    // measured — SL publish no machine hip thrust standard (checked
    // 2026-08-26).
    [/Machine Hip Thrust/, 1.00, 0.35],
    // 2026-08-26 sweep, the second entry that ran the OTHER way: SL hip
    // thrust 129/218/335/478/639 over deadlift 201/268/348/438/535 →
    // 0.64/0.81/0.96/1.09/1.19, median 0.96. The reasoned 1.15 was
    // UNDER-crediting hip thrusters by ~17 % at the median. The drift is the
    // widest of any barbell lift in the file — novices thrust far less than
    // they pull, strong lifters far more — so q goes DOWN a step even though
    // the median is now sourced.
    [/Hip Thrust/, { m: 0.96, f: 1.16 }, 0.40],
    // Carried across the corrected hip-thrust anchor (× 0.96/1.15). SL's
    // glute bridge page publishes REP standards, not 1RM — checked
    // 2026-08-26, not derivable.
    [/Glute Bridge/, 0.83, 0.40],
    /* 🛑 SAME REFUSAL, SAME DATE. Strength Level's sumo squat page is the
     * BARBELL powerlifting stance (their median is 0.70 of a back squat); this
     * library's Sumo Squat is a dumbbell held in two hands, FORCE_TOTAL — a
     * different exercise wearing the same name, which is why the raw comparison
     * reads 36 % low. ⚠️ Do not "fix" it to 0.70: that would treat one goblet-
     * style dumbbell as a loaded barbell and inflate every set logged on it. */
    [/Sumo Squat/, 0.45, 0.30],
    /* 🚨 CORRECTED 2026-09-13, AND THESE WERE THE WORST TWO ENTRIES IN THE
     * TABLE. Both were "reasoned" numbers with no published standard behind
     * them, and both are the ONLY glute work many people log — so the low q
     * that normally protects a shaky ratio protects nothing here, because
     * there is no second reading to out-rank it.
     *
     *   Cable Kickback  0.18 -> 0.63. It is FORCE_PER_SIDE (one leg at a time),
     *     so the stack is doubled before the ratio; SL's cable kickback page
     *     read on that same doubled convention gives 0.63 for both sexes. At
     *     0.18 a 60 lb x 12 kickback implied a 991 lb deadlift.
     *   Hip Abduction / Adduction  0.35 -> 0.61/0.66 male, 0.79/0.74 female,
     *     from SL's own pages (abduction 86/141/213/300/398 m,
     *     60/101/155/221/295 f; adduction 92/151/228/322/426 m,
     *     51/91/145/211/286 f). At 0.35 a 140 lb woman's 150 x 12 abduction
     *     implied a 625 lb deadlift and rated her glutes Elite. They are split
     *     because they are two different pages and two different numbers.
     *
     * q rises to 0.30 — these are real pages now — but stays low: they are
     * 2020-era with small samples, and a machine's leverage is its own. */
    [/Kickback/, 0.63, 0.30],
    [/Hip Abduction Machine/, { m: 0.61, f: 0.79 }, 0.30],
    [/Hip Adduction Machine/, { m: 0.66, f: 0.74 }, 0.30],
  ],
  Shoulders: [ // key: Overhead Press
    [/^Overhead Press$/, 1.00, 1.00],
    // Corrected 2026-09-13 from SL m180/f140 (seated shoulder press): 1.14 male,
    // 1.00 female — seated is a HARDER press for a man relative to his standing
    // one than 1.00 allowed.
    [/^Seated Barbell Overhead Press$/, { m: 1.14, f: 1.00 }, 0.85],
    [/^Push Press$/, { m: 1.27, f: 1.41 }, 0.65],
    // Paired and raised 2026-09-15: SL over OHP is 0.971 male / 1.057 female;
    // 0.90 was low for a man and 15 % low for a woman.
    [/^Behind-the-Neck Press$/, { m: 0.97, f: 1.06 }, 0.55],
    [/^Z Press$/, 0.85, 0.50],
    [/Smith Machine Overhead Press/, 1.05, 0.45],
    // 2026-08-26 sweep: SL machine shoulder press 67/112/172/244/325 over
    // OHP 75/104/140/181/226 → 0.89/1.08/1.23/1.35/1.44, median 1.23. Was
    // 1.10, flattering ~12 % — and the drift is the widest of any machine
    // here (gearing plus a seat that removes the stabilising work novices
    // fail on), so q drops a step.
    // ⚠️ 2026-09-13: the sexes run OPPOSITE ways here — 1.23 male, 0.97 female.
    // Machine pressing is relatively weaker for women where machine pulling is
    // stronger, so the single male-derived number was under-crediting every
    // woman by about 20 %. Same for the chest press and pec deck above.
    [/Machine Shoulder Press/, { m: 1.23, f: 0.97 }, 0.35],
    // ⚠️ Same sweep, and the largest error found in it — 15 %. Strength Level's
    // dumbbell shoulder press, per dumbbell and doubled, against their barbell
    // shoulder press at a 180 lb male:
    //     beginner (34x2)/75 = 0.91   novice (50x2)/104 = 0.96
    //     intermediate (71x2)/140 = 1.01
    //     advanced (94x2)/181 = 1.04  elite (120x2)/226 = 1.06
    // Median 1.01, against a reasoned 0.88.
    //
    // ⚠️ A RATIO ABOVE 1.00 IS NOT A MISTAKE HERE, and the Chest table's
    // bodyweight note already explains the direction: it means two dumbbells
    // total MORE than the bar this lifter could press overhead, so dividing by
    // it brings the number back down. Getting that direction wrong is the error
    // that once gave a dumbbell row a 429 lb wrist curl.
    //
    /* ⚠️ SEATED AND ARNOLD ARE MEASURED NOW (2026-08-28) — 0h's last two
     * shoulder entries, closed. Both were carried offsets, and both were wrong
     * in the direction that matters most, because BOTH inverted an ordering
     * rather than merely mis-sizing one:
     *
     *   seated  40/56/76/98/122 x2 over OHP 75/104/140/181/226
     *           -> 1.067 1.077 1.086 1.083 1.080   median 1.08 (was 0.98)
     *   Arnold  23/37/54/75/98  x2 over the same
     *           -> 0.613 0.712 0.771 0.829 0.867   median 0.77 (was 0.90)
     *
     * ⚠️ SEATED USED TO SIT BELOW STANDING, WHICH SAID YOU PRESS LESS WITH A
     * BACK SUPPORT THAN WITHOUT ONE. It is 1.08 against standing's 1.01: a
     * bench takes the legs and the bracing out, so the same dumbbells overhead
     * seated imply a SMALLER standing press than they would done standing.
     * That is the ordering the carried 0.98 had upside down.
     *
     * ⚠️ AND ARNOLD USED TO SIT ABOVE IT, which said the rotation is free. At
     * 0.77 it sits well below both, so pressing a given weight through the
     * rotation implies a bigger straight press — which is what the rotation
     * costing something means, expressed as a ratio.
     *
     * ⚠️ SEATED'S DRIFT IS 1.02x, THE FLATTEST THING IN THIS FILE — flatter
     * than the incline dumbbell bench's 1.06x, which earned its q on exactly
     * this argument. Five ratios spanning 1.067 to 1.086 really are a
     * population constant, so a single number costs a lifter almost nothing:
     * 0.55 -> 0.70. It stops SHORT of the incline press's 0.72 for a caveat
     * worth stating rather than burying: a table that flat could also be one SL
     * derived from another rather than measured independently, and there is no
     * way to tell from outside. The numbers are not quite constant, which
     * argues against that — but "not quite" is not evidence, so the last step
     * is not taken.
     *
     * Arnold drifts 1.41x, so its q rises only a step (0.45 -> 0.50): the
     * rotation gates novices hard and the median is still a bad single answer.
     */
    [/Seated Dumbbell Shoulder Press/, 1.08, 0.70],
    [/Dumbbell Shoulder Press/, 1.01, 0.60],
    [/Arnold Press/, 0.77, 0.50],
    // ⚠️ CORRECTED 2026-09-13 from SL m180/f140. Derived 2026-09-13: SL landmine
    // press 40/72/117/172/236 (m) over OHP → median 0.90 on the app's doubled
    // reading, and 0.89 (f). Was 0.60, a reasoned number, flattering by a third:
    // a 70 lb landmine press read Shoulders 99.6th percentile.
    [/Landmine Press/, { m: 0.90, f: 0.89 }, 0.35],
    // 2026-08-26 sweep: SL upright row 53/87/132/187/248 over OHP →
    // 0.71/0.84/0.94/1.03/1.10, median 0.94. Was 0.70 — flattering ~26 %.
    //
    // ⚠️ SPLIT 2026-09-13: the DUMBBELL version is a different load convention
    // (two bells, doubled) and a different number — SL dumbbell upright row
    // over OHP is 0.79 (m) / 0.84 (f), not the barbell's 0.94. It sits first,
    // because /Upright Row/ would otherwise swallow it.
    [/Dumbbell Upright Row/, { m: 0.79, f: 0.84 }, 0.35],
    [/Upright Row/, 0.94, 0.35],
    // ⚠️ SPLIT OUT OF THE RAISE FAMILY 2026-08-26, because it turned out to be
    // measurable: SL face pull 35/64/105/155/211 over OHP →
    // 0.47/0.62/0.75/0.86/0.93, median 0.75 — not 0.30. The §9 poster child
    // (a 50 lb face pull converting to 167 lb of press) now converts to 67,
    // which is the sane answer the winsoriser and the credibility sort were
    // having to impose from outside. Rope-and-stack leverage varies, hence
    // the cable-grade q.
    // ⚠️ AND IT IS THE SHARPEST SEX SPLIT IN THE TABLE (2026-09-13). The same
    // pull at 140 lb female is 0.62/0.79/1.04/1.22/1.36, median 1.04 — a woman's
    // face pull is a THIRD more of her press than a man's is of his. Tim
    // reported this one from Autumn's map: her 40 lb x 10 read Shoulders 84th,
    // nearly Advanced, beside beginner ratings everywhere else. At 1.04 it is
    // ~44th. The single number was never right for either of them.
    [/Face Pull/, { m: 0.75, f: 1.04 }, 0.35],
    /* ⚠️ THE RAISE FAMILY IS SOURCED NOW (2026-08-27), AND 0.30 WAS FLATTERING
     * EVERY RAISE BY ABOUT 80 %. Same technique as the rest of the sweep — SL's
     * per-dumbbell figures at a 180 lb male, doubled, over this muscle's key
     * lift (OHP 75/104/140/181/226), median of the five:
     *
     *   lateral raise  12/22/37/55/76  -> 0.32 0.42 0.53 0.61 0.67  median 0.53
     *   front raise    10/22/38/60/86  -> 0.27 0.42 0.54 0.66 0.76  median 0.54
     *   rear delt fly   8/20/39/64/94  -> 0.21 0.38 0.56 0.71 0.83  median 0.56
     *
     * ⚠️ THE THREE MEDIANS AGREE TO WITHIN 0.03, which is the useful finding:
     * one number for the family was the right SHAPE all along and only the
     * value was wrong. They are split anyway, because they are now three
     * measurements rather than one guess.
     *
     * ⚠️ AND q DOES NOT RISE, DESPITE THE SOURCING — the 2026-08-26 rule about
     * drift, arriving in its sharpest form yet. These ratios sweep 2.1x, 2.9x
     * and 3.9x across the five levels, so there is no population constant here
     * to find: a beginner's raise is a fifth of their press and an elite's is
     * five sixths. A fixed ratio compresses everybody toward the middle, and
     * the rear delt fly drifts most, so it keeps the lowest q of the three.
     * The median is the best single answer available and is still a bad one,
     * which is exactly what a low q is for.
     */
    /* 🚨 THE MACHINE LATERAL RAISE IS NOT A PAIR OF DUMBBELLS, AND UNTIL
     * 2026-09-13 THIS TABLE TREATED IT AS ONE. It sat in FORCE_PER_SIDE, so a
     * 100 lb stack was doubled to 200, and then divided by the two-dumbbell
     * 0.53 — a 3.7x inflation that rated Shoulders Elite, 99.9th percentile,
     * off one ordinary set. It is one stack: exercises.js now files it
     * FORCE_TOTAL, and SL's own machine lateral raise page (58/92/136/189/248
     * at 180 lb male) over OHP gives 0.77/0.88/0.97/1.04/1.10, median 0.97;
     * 0.84 female. Both halves of that fix are required — moving the name
     * between conventions IS a ratio change, which is why the note at the top
     * of this table says so. It sits before /Lateral Raise/. */
    [/Machine Lateral Raise/, { m: 0.97, f: 0.84 }, 0.30],
    /* ⚠️ THE CABLE VERSION IS CAUGHT HERE AND THE 0.53 IS RIGHT FOR IT — checked
     * 2026-09-15, because a raw comparison says it is 106 % too high and it is
     * not. Strength Level's cable lateral raise page (7/18/36/59/87 at 180 lb
     * male) carries NO equipment note, and the app logs this one FORCE_PER_SIDE
     * and doubles it. Read as one stack, 36 lb becomes 72 lb of total load —
     * which lands on their own DUMBBELL page's 37 lb per hand almost exactly.
     * Read as both arms it would mean people are half as strong on a cable as
     * on dumbbells, which is not a thing. 🛑 REASONED, not sourced: the page
     * does not say, and this is the reading the two pages agree under. */
    [/Lateral Raise/, 0.53, 0.25],
    // Paired 2026-09-15: SL over OHP gives 0.543 male / 0.600 female, a 10 %
    // gap, so the single 0.54 was a male number being read to women.
    [/Front Raise/, { m: 0.54, f: 0.60 }, 0.25],
    /* ⚠️ SPLIT 2026-09-13, same shape as the lateral raise and the other way
     * round. The dumbbell rear delt fly's 0.56 was being applied to a REVERSE
     * PEC DECK's single stack, which under-credits it by about half — SL's
     * machine reverse fly over OHP is 1.07 (m) / 0.94 (f). Tim reported the
     * consequence from the other end: his 70 lb x 10 read Shoulders 87th,
     * Advanced, beside beginner ratings elsewhere, because the estimate DIVIDES
     * by the ratio and 0.56 was less than half of 1.07. At the derived number
     * the same set is ~18th. */
    [/Reverse Pec Deck|Machine Rear Delt Fly/, { m: 1.07, f: 0.94 }, 0.35],
    // Paired 2026-09-15: 0.557 male / 0.629 female over OHP, a 13 % gap.
    [/Rear Delt Fly/, { m: 0.56, f: 0.63 }, 0.22],
    // Cable and machine versions carry the derived number for the movement
    // they copy — the leverage is not the dumbbell's and nothing is published
    // for them, so they are labelled rather than separately claimed.
    [/Y-Raise|Raise|Fly|Pec Deck/, 0.54, 0.20],
  ],
  Biceps: [ // key: Barbell Curl
    [/^Barbell Curl$/, 1.00, 1.00],
    [/^EZ-Bar Curl$/, 1.02, 0.80],
    [/^Drag Curl$/, 0.85, 0.55],
    [/^21s$/, 0.55, 0.35],
    // ⚠️ THE DUMBBELL BICEPS FAMILY, DERIVED 2026-08-26 (0h's top-named gap).
    // Same technique throughout: SL per-dumbbell numbers doubled, over their
    // barbell curl 49/73/104/140/180 at a 180 lb male. Every derived entry
    // was TOO LOW — the whole family was flattering, worst of all the
    // concentration curl at ~48 %.
    //
    // Machine and dumbbell preacher have NO published standard (checked) and
    // are carried across the corrected barbell-preacher anchor (× 0.96/0.82),
    // keeping the shape somebody chose while resting on a sourced number.
    [/Machine Preacher Curl/, 1.05, 0.40],
    // ⚠️ AFTER the preacher entry above, which is more specific. A seated curl
    // machine without the pad is carried across it at a small discount; nothing
    // is published for either.
    // Corrected 2026-09-13: the note said "nothing is published for either".
    // SL's machine bicep curl page (57/88/128/176/228 m) over the barbell curl
    // gives 1.23; 1.09 female.
    [/Machine Curl/, { m: 1.23, f: 1.09 }, 0.35],
    [/Dumbbell Preacher Curl/, 0.84, 0.45],
    // SL preacher curl (barbell) 46/70/100/136/175 → 0.94/0.96/0.96/0.97/0.97,
    // median 0.96 — nearly flat, was a reasoned 0.82.
    [/Preacher Curl/, 0.96, 0.60],
    // Carried across the corrected hammer anchor (× 1.04/0.98), not measured.
    [/Cross-Body Hammer Curl/, 0.98, 0.45],
    [/Cable Rope Hammer Curl/, 1.01, 0.45],
    // SL hammer curl 24/37/54/73/95 ×2 → 0.98/1.01/1.04/1.04/1.06, median
    // 1.04. The neutral grip really is the strongest curl, now by measurement.
    [/Hammer Curl/, 1.04, 0.55],
    // SL 22/32/44/58/74 ×2 → 0.90/0.88/0.85/0.83/0.82, median 0.85 (was 0.72).
    // The only curl whose drift runs DOWNWARD with strength.
    // 🆕 PAIRED 2026-09-15: 0.846 male / 0.943 female. The dumbbell biceps
    // family is where the 2026-09-13 pass stopped, and it is the family with
    // the most consistent gap — a woman's dumbbell curl is worth ~10 % more of
    // her barbell curl than a man's is of his, on every variant below.
    [/Incline Dumbbell Curl/, { m: 0.85, f: 0.94 }, 0.45],
    // SL 20/33/48/67/88 ×2 → 0.82/0.90/0.92/0.96/0.98, median 0.92 (was 0.62
    // — the family's biggest flatter).
    [/Concentration Curl/, { m: 0.92, f: 1.02 }, 0.40],
    // ⚠️ REASONED, AND NOW CLOSED AS NOT DERIVABLE RATHER THAN LEFT OPEN.
    // Re-checked 2026-08-28, the last name on 0h's list: SL's spider curl
    // standards are 29/50/78/111/149 and the page's own equipment note is
    // "Barbell weights include the weight of the bar" — so they are for the
    // BARBELL version, while this library's Spider Curl is a dumbbell lift
    // logged per side. There is no dumbbell spider curl table to divide by,
    // and dividing a per-side dumbbell load by a barbell population would be
    // the mistake this whole sweep exists to undo. It stays a labelled guess,
    // which is the honest outcome the sweep's own rule 3 asks for. Do not
    // re-open this without a NEW SOURCE; the arithmetic has been tried twice.
    [/Spider Curl/, 0.70, 0.40],
    // SL 11/23/41/64/90 ×2 → 0.45/0.63/0.79/0.91/1.00, median 0.79 (was
    // 0.72). The widest drift of any dumbbell lift in the file — the rotation
    // gates novices hard — so q drops a step despite the sourced median.
    [/Zottman Curl/, { m: 0.79, f: 0.87 }, 0.30],
    // Carried across the corrected cable-curl anchor (× 1.11/0.95).
    [/Bayesian Cable Curl/, 0.93, 0.35],
    // SL cable curl 44/75/115/164/218 → 0.90/1.03/1.11/1.17/1.21, median
    // 1.11 (was 0.95). Stack-and-pulley leverage varies by machine, so the
    // cable-grade q drops a step rather than rising with the source.
    [/Cable Curl/, 1.11, 0.40],
    // ⚠️ Same sweep, and the SMALLEST error in it — 7 %, which is worth noting
    // as much as the largest: the reasoned numbers were not uniformly wrong by a
    // fixed amount, so no blanket correction factor would have fixed the table.
    // Each anchor has to be derived on its own.
    //     beginner (19x2)/49 = 0.78   novice (32x2)/73 = 0.88
    //     intermediate (49x2)/104 = 0.94
    //     advanced (71x2)/140 = 1.01  elite (95x2)/180 = 1.06
    // Median 0.94, against a reasoned 0.88.
    //
    // ⚠️ Hammer Curl stays at 0.98 and is now BELOW this pair's implied
    // relationship rather than above it — a neutral grip is stronger than a
    // supinated one, so 0.98 against a corrected 0.94 still orders correctly and
    // is left alone rather than scaled on top of a number nobody measured. The
    // rest of the dumbbell biceps entries are unchanged for the same reason and
    // stay open in 0h.
    // Paired 2026-09-15: 0.942 male / 1.026 female — the anchor of the family
    // corrected above, so the pair belongs here rather than only on the
    // variants carried off it.
    [/Dumbbell Curl/, { m: 0.94, f: 1.03 }, 0.55],
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
    [/^Triceps Dip$/, { m: 1.43, f: 1.69 }, 0.35],
    // Carried across the corrected skull-crusher anchor (× 0.47/0.50), not
    // measured — SL's lying-extension standard does not separate equipment.
    [/Dumbbell Skull Crusher/, 0.39, 0.40],
    // 2026-08-26 sweep: SL lying tricep extension 45/69/98/132/170 over
    // close-grip bench 124/163/208/260/314 → 0.36/0.42/0.47/0.51/0.54,
    // median 0.47. The reasoned 0.50 was nearly right.
    [/Skull Crusher/, 0.47, 0.50],
    [/Tate Press/, 0.35, 0.30],
    // 2026-08-26 sweep: SL tricep pushdown 49/82/126/179/238 over close-grip
    // bench → 0.40/0.50/0.61/0.69/0.76, median 0.61 (was 0.55). The drift is
    // the cable story again — novices barely load a stack, strong lifters
    // ride its leverage — so q drops a step.
    // ⚠️ BEFORE the family rule below, and only to lower `q`. The ratio is the
    // same 0.61 — the set is logged per side and doubled, so one arm at 30
    // arrives as the 60 a two-arm pushdown would — but one arm at a time is a
    // different enough animal from the population that was measured to be worth
    // believing a step less.
    [/Single-Arm Cable Pushdown/, 0.61, 0.30],
    [/Pushdown/, 0.61, 0.40],
    // 2026-08-26 sweep: SL cable overhead extension 33/60/97/142/194 over
    // close-grip bench → 0.27/0.37/0.47/0.55/0.62, median 0.47 (was 0.45).
    // ⚠️ "Rope Overhead Extension" joined the same rule on 2026-08-31 — it is
    // the same movement under the name half the gym uses, and without it the
    // exercise would have matched nothing at all.
    [/Overhead Cable Extension|Rope Overhead Extension/, 0.47, 0.35],
    // One of the six silent ones (2026-08-31), carried across the entry above:
    // same cable, same extension, one arm across the body.
    [/Cross-Body Cable Triceps Extension/, 0.47, 0.25],
    /* 🚨 ONE BELL IN TWO HANDS, AND IT WAS BEING DOUBLED. Equipment 'Dumbbell'
     * meant per_side by default, so a 50 lb overhead extension was scored as
     * 100 lb of load and then divided by a reasoned 0.40 — 358 lb of close-grip
     * bench, 98th percentile, off one set. exercises.js now files it
     * FORCE_TOTAL (the same treatment Goblet Squat and Dumbbell Pullover
     * already had), and SL's dumbbell tricep extension read as ONE bell gives
     * 0.24 male / 0.25 female. Both halves are required. */
    [/Overhead Dumbbell Extension/, { m: 0.24, f: 0.25 }, 0.35],
    // ⚠️ REASONED, NO PUBLISHED STANDARD — checked 2026-08-27 and the note that
    // used to sit here was WRONG. It said "SL publish a machine extension
    // standard a later pass can use"; they do not. They publish a machine
    // tricep PUSHDOWN, which is a different movement from a seated machine
    // extension and already has its own entry. This is now in the same class as
    // Machine Row and the shrug variants: labelled rather than left looking
    // derivable, so nobody spends another pass looking for it.
    [/Machine Triceps Extension/, 0.60, 0.35],
    // Corrected 2026-09-13: SL dumbbell tricep kickback, doubled, over the
    // close-grip bench → 0.39 male / 0.43 female. Was a reasoned 0.20, so a
    // 20 lb x 12 kickback rated Triceps 97th, Elite.
    [/Kickback/, { m: 0.39, f: 0.43 }, 0.25],
  ],
  Traps: [ // key: Barbell Shrug
    [/^Barbell Shrug$/, 1.00, 1.00],
    // Reasoned — no published trap-bar shrug standard (checked 2026-08-26).
    // Paired 2026-09-15: 1.042 male / 1.203 female, a 15 % gap.
    [/^Trap Bar Shrug$/, { m: 1.04, f: 1.20 }, 0.75],
    // 2026-08-26 sweep, the third entry that ran the OTHER way: SL dumbbell
    // shrug per dumbbell 38/64/99/141/188, doubled, over barbell shrug
    // 121/192/284/394/515 → 0.63/0.67/0.70/0.72/0.73, median 0.70. The
    // reasoned 0.95 was UNDER-crediting dumbbell shrugs by ~26 % — grip, not
    // traps, is what caps a dumbbell shrug, and the reasoned number assumed
    // the two moved together.
    //
    // ── added 2026-08-31 with the library sweep. ⚠️ THE LINE THAT USED TO SIT
    //    HERE — "Strength Level publish no shrug variants beyond the two above"
    //    — WAS FALSE and was acted on for a fortnight: they publish dumbbell,
    //    machine, Smith, cable and hex-bar shrug pages, and four of the rules
    //    below now carry numbers derived from them. Only the two behind-the-back
    //    and snatch-grip entries are still carried rather than derived.
    // Behind the back the bar rests against the glutes over a shorter range.
    [/Behind-the-Back Barbell Shrug/, 0.90, 0.35],
    // A snatch grip is wider and starts lower, for the same reason it is weaker
    // on a deadlift.
    [/Snatch-Grip Barbell Shrug/, 0.85, 0.35],
    // ⚠️ BEFORE /Dumbbell Shrug/, and it has to be. Chest on an incline bench
    // takes away every bit of standing leverage, so this moves far less weight
    // than a standing shrug — the family's 0.70 would have over-rated it by
    // about 40 %. Same ordering discipline the biceps preacher entries follow.
    [/Incline Dumbbell Shrug/, 0.50, 0.30],
    [/Dumbbell Shrug/, 0.70, 0.60],
    // Both reasoned — no published standard for either (checked 2026-08-26).
    [/Cable Shrug/, { m: 0.81, f: 0.83 }, 0.50],
    /* 🚨 SPLIT 2026-09-15, AND THE COMMENT THAT USED TO BE HERE HAD OUTLIVED
     * ITS OWN NUMBER TWICE. It read: *"Smith Machine Shrug is caught here on
     * purpose: a fixed bar shrug is a barbell shrug, which is what the 1.00
     * says"* — and the entry had not said 1.00 since 2026-09-13, when it was
     * corrected to the MACHINE shrug page. So a Smith shrug was deliberately
     * routed to a rule that had stopped describing it: a plate-loaded machine
     * moves more than a fixed bar, and it was reading 18 % male / 21 % female
     * high.
     *
     * Strength Level publish BOTH pages. Smith: 131/197/280/378/485 male over
     * the barbell shrug's 121/192/284/394/515 → median 0.986; 1.101 female.
     * The machine page keeps its own numbers below. ⚠️ Ordering matters and the
     * name demands it — /Machine Shrug/ matches "Smith Machine Shrug" too, so
     * this rule has to sit first, the same discipline the incline dumbbell
     * shrug and the machine lateral raise already follow. */
    [/Smith Machine Shrug/, { m: 0.99, f: 1.10 }, 0.50],
    // Corrected 2026-09-13 — the "no published standard" note was stale; the
    // machine shrug page gives 1.16 male / 1.33 female.
    [/Machine Shrug/, { m: 1.16, f: 1.33 }, 0.45],
    // Every carry, including the trap-bar one added 2026-08-31.
    [/Carry/, 0.75, 0.25],
  ],
  Calves: [ // key: Standing Calf Raise
    [/^Standing Calf Raise$/, 1.00, 1.00],
    // Seated is the outlier people assume is equivalent and is not: a bent knee
    // takes gastrocnemius out and leaves soleus, so the load is far lower for
    // the same person. Treating them as the same lift would read as a big loss
    // of calf strength the week someone switches machines.
    //
    // 2026-08-26 sweep: SL seated 71/129/209/308/420 over machine standing
    // 110/198/317/463/629 → 0.65/0.65/0.66/0.67/0.67, median 0.66 — the
    // second-flattest derivation in the file, so q RISES a step: this ratio
    // really is a population constant.
    // Paired 2026-09-15: 0.659 male / 0.746 female, a 13 % gap.
    [/^Seated Calf Raise$/, { m: 0.66, f: 0.75 }, 0.65],
    [/Smith Machine Calf Raise/, 1.00, 0.45],
    // A bar on the back over a block: the same load path as the Smith version
    // with the balance to manage yourself, so a small discount. Carried.
    [/Barbell Calf Raise/, 0.95, 0.35],
    // Raised 2026-09-15: 1.451 male / 1.487 female; the sexes agree within
    // 3 %, so one number, but 1.35 was ~8 % low for both.
    [/Leg Press Calf Raise/, 1.47, 0.35],
    [/Donkey Calf Raise/, 1.05, 0.35],
    // Trimmed 2026-09-15: 0.524 male / 0.508 female.
    [/Dumbbell Calf Raise/, 0.52, 0.35],
  ],
  Forearms: [ // key: Wrist Curl
    [/^Wrist Curl$/, 1.00, 1.00],
    // Two dumbbells, logged per side and doubled, so the total is the same load
    // the barbell version carries — 1.00 is the claim that neither hand helps
    // the other, which is true of a wrist curl in a way it is not of a press.
    [/Dumbbell Wrist Curl/, { m: 1.22, f: 1.27 }, 0.40],
    [/Behind-the-Back Wrist Curl/, 1.05, 0.55],
    // Corrected 2026-09-13: 0.92, from SL's own page. The reasoned 0.55 was
    // flattering by 40 % — a 45 x 12 read Forearms 88th.
    [/Reverse Wrist Curl/, 0.92, 0.50],
    [/Cable Reverse Curl/, 0.78, 0.35],
    [/Reverse Curl/, { m: 0.92, f: 0.90 }, 0.40],
    [/Plate Pinch Hold/, 0.45, 0.20],
  ],

  /* 🚨 CORE — NEW 2026-09-04, AND WHAT IS *ABSENT* FROM IT IS THE DESIGN.
   *
   * Only two entries, out of thirty core exercises in the library. Eight of
   * those thirty record a weight at all; six of the eight are still refused
   * here, on purpose, and the reasons are worth having because the obvious next
   * change is to add them.
   *
   * ✅ Cable Crunch — the key lift. docs/research.md §14.
   * ✅ Machine Crunch — the cleanest ratio in this whole table. Strength Level's
   *    Machine Seated Crunch at 180 lb male (65/110/170/243/325) over Cable
   *    Crunch (58/98/151/216/288) gives 1.121 / 1.122 / 1.126 / 1.125 / 1.128 —
   *    five levels agreeing to the third decimal, which is flatter than any
   *    entry the 2026-08-26 sweep produced.
   *    🚨 AND ITS QUALITY IS STILL ONLY 0.55, BECAUSE THE WOMEN'S TABLES SAY
   *    0.89. Same method, same site, same day: female Machine Seated Crunch over
   *    female Cable Crunch is 0.833/0.877/0.887/0.892/0.897 — internally just as
   *    flat, and 27 % away from the male answer. Both cannot be the population
   *    ratio. This table has no sex dimension, so the larger male sample is used
   *    and the disagreement is priced in rather than averaged away.
   *
   * 🛑 REFUSED, and each for its own reason rather than out of caution:
   *
   *   Decline Sit-Up — the logged weight is a plate held at the chest, so the
   *     real resistance is that plate PLUS a fraction of the torso, and the
   *     fraction moves with the decline angle. That is the inverted-row problem
   *     exactly (37–79 % of body weight depending on a parameter the app does
   *     not record), and it is already refused there. Adding the plate weight
   *     alone would read a 25 lb sit-up as a 25 lb cable crunch and rate a
   *     genuinely strong lifter Beginner.
   *   Russian Twist · Cable Woodchop · Landmine Twist — ROTATION, not spinal
   *     flexion. A different movement, and no published table maps either onto
   *     a crunch. The load is also mostly a lever-arm choice.
   *   Pallof Press — ANTI-rotation: the measure is resisting a stack, not moving
   *     one, so the number is not the same kind of quantity.
   *   Suitcase Carry — anti-lateral-flexion, and time-based; there is no 1RM.
   *
   * ⚠️ THE HONEST CONSEQUENCE, AND IT IS NOT SMALL: somebody whose ab training
   * is planks, hanging leg raises and an ab wheel gets NO rating from this, and
   * that is most people. Their Core is hatched instead of coloured — the
   * 2026-09-04 "trained, can't be ranked" state — which is a true statement
   * about what the app knows, not a hole. */
  Core: [ // key: Cable Crunch
    [/^Cable Crunch$/, 1.00, 1.00],
    // ⚠️ The one sex split the file already knew about (research.md §14.4), now
    // written in the same shape as the rest: 1.13 male / 0.89 female.
    [/^Machine Crunch$/, { m: 1.13, f: 0.89 }, 0.55],
  ],
};

/* 🚨 A CUSTOM EXERCISE NO LONGER RATES ANYTHING — 2026-08-31, AND THIS REVERSES
 * WHAT THIS FILE DID.
 *
 * It used to admit one, at quality 0.20, with the conversion GUESSED FROM THE
 * EQUIPMENT DROPDOWN: Barbell 0.90, Machine 0.80, Cable 0.65, Dumbbell 0.70,
 * Kettlebell 0.60. The stated reason was that a custom name should not be
 * silently ignored, and that the low quality stopped it outweighing a known
 * lift.
 *
 * ⚠️ WHAT THAT MISSED: the low quality only protects a muscle that has other
 * evidence. Tim's friend could not find a dip machine in the library, made a
 * custom one, filed it under Triceps and logged 60 lbs × 10. Nothing else in her
 * account trains triceps, so the guess was the only voice in the room and it led
 * outright. The arithmetic, run on her real numbers:
 *
 *     60 × 10        → e1RM 90.9 lbs on that machine
 *     90.9 ÷ 0.80    → 113.6 lbs "close-grip bench press"    ← the guess
 *     113.6 vs the female median of 85 → 82nd percentile → ADVANCED
 *
 * beside a column of Beginners. The number is not a bug in the code; it is the
 * guess doing exactly what it said it would. **"Machine" is not a measurement.**
 * It cannot tell an assisted dip machine (where the 60 lbs is HELP, and she
 * pressed her body weight minus 60) from a plate-loaded one, and no dropdown
 * ever could.
 *
 * ⚠️ THE SAME ARGUMENT `bodyWeightFractionFor()` HAS ALWAYS MADE, applied one
 * level up. That function refuses to guess a body-weight fraction for a custom
 * exercise from its equipment — *"guessing one from its equipment is exactly
 * what this table refuses to do"* — while this file went ahead and guessed a
 * strength ratio from the same dropdown. Only one of those two positions can be
 * right.
 *
 * Tim, 2026-08-31: *"expand the library of exercises instead of trying to
 * calculate the input of a custom exercise. Still allow the user to create a
 * custom lift, but don't let it contribute to the score."*
 *
 * ⚠️ SO A CUSTOM EXERCISE IS STILL A FIRST-CLASS EXERCISE EVERYWHERE ELSE — it
 * is logged, charted, counted in weekly volume and coloured on the volume map.
 * What it cannot do is set a strength LEVEL, and `rankBlockedReason()` says so
 * on the muscle panel rather than leaving the sets looking uncounted.
 *
 * ⚠️ AND SINCE 2026-09-05 THERE IS EXACTLY ONE WAY PAST THAT, WHICH IS THE USER
 * SAYING SO — see STAND_IN_QUALITY below. Nothing above is reversed: the
 * equipment dropdown is still not a measurement and still converts nothing.
 * ⚠️ Note this comment used to run on unterminated into the banner below, so
 * the whole "Fallback" heading was inside it. Closed here. */

/* ------------------------------------------------------------------ *
 * The stand-in a person chose
 * ------------------------------------------------------------------ */

/* 🚨 HOW MUCH A USER-CHOSEN MATCH IS WORTH, AND WHY IT IS 0.40.
 *
 * `standInFor()` in exercises.js resolves a custom exercise to the LIBRARY
 * exercise its owner said it was closest to. That exercise's ratio is then used
 * unchanged — the arithmetic of "a machine chest press converts at 0.91" does
 * not become worse because of who invoked it — and its QUALITY is multiplied by
 * this. Quality is the only place the discount belongs: `q` is defined at the
 * top of this file as how much the conversion is worth believing, and a match
 * somebody made by eye is a strictly weaker claim than the library's own entry
 * for the exercise they pointed at.
 *
 * ⚠️ IT IS A MULTIPLIER BELOW 1, WHICH IS WHAT MAKES THE ORDERING UNBREAKABLE.
 * `rateMuscle()` ranks on `evidenceWeight`, which is linear in quality, so a
 * stand-in is worth strictly less than the very exercise it points at, at every
 * rep count, on every date, forever. A stand-in can never out-rank its own
 * target, and no future ratio edit can change that — it is arithmetic, not a
 * threshold somebody has to maintain.
 *
 * ⚠️ 0.40 IS PICKED SO THE HIGHEST POSSIBLE STAND-IN LANDS UNDER
 * FALLBACK_MIN_QUALITY (0.45). The best case is a key lift: ratio 1.00 at
 * quality 1.00, the strongest evidence this app holds — and 1.00 x 0.40 = 0.40,
 * below the floor a contribution must clear to stand in for a SECOND muscle.
 * So even if the explicit refusal in contributionsFor() below were deleted, a
 * user's match could never chain outward into a cross-muscle inference. Two
 * independent guards on the same wrong number, and the second one is a
 * consequence of the constant rather than a line of code to remember.
 *
 * ⚠️ AND IT SITS BESIDE THE TABLE'S OWN "CARRIED, NOT MEASURED" DISCOUNTS, which
 * is the honest comparison. When a maintainer of this file reasons an entry
 * across a near-relative — Cable Press Around 0.25 off the cable fly's 0.30,
 * Kroc Row 0.35 off the dumbbell row's 0.60, Machine Pullover 0.25 off 0.30 —
 * the anchor keeps 40-80 % of its credibility. A user's match is the same KIND
 * of claim made with less information, so it takes the bottom of that band.
 *
 * 🛑 WHAT THIS DOES NOT FIX, recorded rather than glossed. History H's finding
 * was that *"the low quality only protects a muscle that has other evidence"* —
 * Tim's friend had no other triceps lift, so a 0.20 guess led outright. That is
 * still true of 0.40, and no number can make it false. What has changed is the
 * thing being weighted: not a dropdown the app interpreted, but a claim a person
 * made about their own equipment. It can still be wrong; it can no longer be
 * wrong without somebody having said it. The remaining defence is Rule 5 — the
 * rating says whose match it came through, in `raiseConfidenceHint()`.
 */
export const STAND_IN_QUALITY = 0.40;

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
// medians.
//
// ⚠️ SINCE 2026-09-13 IT TAKES A SEX, and the old comment here said the opposite
// — ~~the mean of the two is used, because which one applies depends on a
// profile field this module deliberately does not take~~. It always took
// `opts.bodyWeight`; taking the sex as well was never the obstacle the sentence
// claimed. With a sex it uses that sex's medians; with none it keeps the mean,
// which is exactly what it did before, so an unwired caller is unchanged.
//
// It matters most where the sexes disagree: a woman's bench-to-squat runs
// 0.64-0.67 against a man's flat 0.74, so the averaged figure was ~5 % wrong for
// both of them and never right for either.
export function crossMuscleRatio(fromMuscle, toMuscle, sex) {
  const a = MUSCLE_LIFTS[fromMuscle];
  const b = MUSCLE_LIFTS[toMuscle];
  if (!a || !b) return null;
  if (sex === 'male') return a.median.male / b.median.male;
  if (sex === 'female') return a.median.female / b.median.female;
  return ((a.median.male / b.median.male) + (a.median.female / b.median.female)) / 2;
}

/**
 * One RATIOS entry's ratio, for one person.
 *
 * The entry is a NUMBER when the sexes agree within about 10 % on the published
 * page, and a PAIR `{ m, f }` when they do not — see the ENTRY SHAPE note at the
 * top of the table. With no sex known a pair collapses to the mean of its two
 * sides, which is the same thing crossMuscleRatio() does and for the same
 * reason: it is the least wrong single number when the question has not been
 * answered.
 *
 * 🚨 EVERYTHING DOWNSTREAM OF matchRule() SEES A NUMBER. The fallback chain
 * multiplies `base.ratio` by a cross-muscle ratio, and `add()` guards on
 * `ratio > 0` — which a pair fails silently, dropping the contribution
 * altogether. That is not hypothetical: it is what a half-finished version of
 * this change did on 2026-09-13, and the symptom was every pull-up, chin-up and
 * dip in the library rating nothing at all, with no error anywhere.
 */
export function resolveRatio(ratio, sex) {
  if (typeof ratio === 'number') return ratio;
  if (!ratio || typeof ratio !== 'object') return null;
  const m = Number(ratio.m);
  const f = Number(ratio.f);
  if (sex === 'male') return m > 0 ? m : null;
  if (sex === 'female') return f > 0 ? f : null;
  if (!(m > 0) || !(f > 0)) return m > 0 ? m : (f > 0 ? f : null);
  return (m + f) / 2;
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

// ⚠️ RESOLVES THE RATIO HERE, so every caller below works in plain numbers.
// `sex` is 'male' | 'female' | anything else, which means "not known".
function matchRule(muscle, name, sex) {
  const rules = RATIOS[muscle];
  if (!rules) return null;
  for (const [re, ratio, q] of rules) {
    if (!re.test(name)) continue;
    const r = resolveRatio(ratio, sex);
    return r === null ? null : { ratio: r, quality: q };
  }
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

  /* ── The stand-in a person chose (2026-09-05) ─────────────────────────────
   *
   * 🚨 FIRST, AND NOTHING ELSE IN THIS FUNCTION MAY SEE A CUSTOM EXERCISE. Every
   * branch below reads `exercise.equipment`, `exercise.name` or the muscle the
   * library filed it under, and on a custom exercise all three are things
   * somebody typed. The refusal at the top of buildContributions() still stands
   * behind this as the backstop; this branch is the ONLY route by which a custom
   * exercise reaches a ratio, and it needs an explicit id to take it.
   *
   * ⚠️ NO STAND-IN, NO CONTRIBUTION — unchanged since 2026-08-31, and this is
   * the line that keeps that true. `standInFor()` returns null for a custom
   * exercise with no `standInId`, for one whose id no longer resolves, and for
   * one pointed at something that may not be a stand-in. All three return [].
   *
   * ⚠️ RECURSION IS SAFE AND IS ONE LEVEL DEEP. The target came out of
   * BUILT_IN_EXERCISES, so `isCustom` is false and this branch cannot be taken
   * again — see the argument in standInFor(). `opts` is passed through for
   * shape, and carries nothing that matters: a target with a body-weight
   * fraction is refused by canStandIn() precisely so the two load models can
   * never be spliced.
   *
   * 🚨 DIRECT ONLY. A stand-in rates the muscles the library exercise trains and
   * nothing further. Chaining a user's match into the cross-muscle FALLBACK
   * table would be their judgement, times a ratio, times a population
   * conversion — three estimates deep, which is the thing this project names as
   * the machine for confidently wrong numbers. STAND_IN_QUALITY is chosen so
   * this filter is belt to that constant's braces.
   *
   * 🚨 IT CARRIES THE TARGET'S NAME IN ITS OWN FIELD, `standInName`, AND THAT
   * IS DELIBERATE. The first version put it in `via`, which already exists and
   * already means "the muscle a fallback came through" — two meanings in one
   * field, disambiguated by reading a DIFFERENT field (`kind`) first.
   *
   * ⚠️ THAT IS SAFE TODAY AND IS THE SHAPE OF A BUG THIS PROJECT HAS ALREADY
   * WRITTEN DOWN TWICE. `firestore.rules` keeps `invites` and `requests` apart
   * for exactly this reason — *"an invite is a capability I issued, a request is
   * something asked OF me, and two meanings in one collection is how a read rule
   * ends up wrong"* — and D9/D28 were cited interchangeably for weeks because
   * nothing depended on the number being right. A field whose meaning depends on
   * a neighbouring field is correct until somebody reads it without the
   * neighbour, and `exercise-estimate.js` already reads `via` bare inside its
   * fallback branch.
   *
   * So: `via` still means one thing, `standInName` means the other, and neither
   * needs a guard. strength-observations.js copies both onto every observation,
   * which is what makes the panel's Rule 5 caveat reachable. */
  if (exercise.isCustom) {
    const target = standInFor(exercise);
    if (!target) return [];
    return contributionsFor(target, opts)
      .filter((c) => c.kind === 'direct')
      .map((c) => ({ ...c, quality: c.quality * STAND_IN_QUALITY, standInName: target.name }))
      .filter((c) => c.quality > 0);
  }

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
    return buildContributions(exercise, scale, opts && opts.sex);
  }

  // Anything bodyweight or assisted WITHOUT a published fraction is refused
  // exactly as before. Equipment is never used to guess one.
  if (exercise.equipment === 'Bodyweight' || /^Assisted /.test(exercise.name)) return [];
  if (!Array.isArray(exercise.fields) || !exercise.fields.includes('weight')) return [];
  return buildContributions(exercise, 1, opts && opts.sex);
}

// `qualityScale` discounts every contribution this exercise makes — 1 for an
// ordinary weighted lift, less for a bodyweight one whose fraction or whose
// body weight is imperfectly known.
function buildContributions(exercise, qualityScale, sex) {
  // 🚨 THE REFUSAL, AND IT IS AT THE TOP FOR A REASON. Putting it on the muscle
  // branch alone would leave `keyLiftMuscle(exercise.name)` below still matching
  // a custom exercise somebody happened to name "Barbell Bench Press" — and that
  // path awards ratio 1.00 at quality 1.00, which is the strongest evidence this
  // app can hold. One line, before anything can match.
  if (exercise.isCustom) return [];

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
  const rule = matchRule(exercise.muscle, exercise.name, sex);
  if (rule) add(exercise.muscle, rule.ratio, rule.quality, 'direct');

  // 3. Everything this lift can stand in for. Chained off the DIRECT reading it
  //    already produced, so the conversion is (this exercise → its own key
  //    lift → the other muscle's key lift).
  // ⚠️ STRICTLY GREATER SINCE 2026-09-13, and the one entry it moves is the
  // deadlift. Its Back quality is exactly 0.45, so `>=` let a pull stand in for
  // biceps, traps and forearms — a deadlift-only lifter read 75th on curls they
  // had never done. The pull-up's comment claims its own 0.45 "lands just under"
  // the floor, and it only does because the body-weight fraction multiplies it
  // to 0.4275; the deadlift had nothing to bring it under. The floor is a
  // threshold to CLEAR, not to touch.
  const direct = out.filter((c) => c.kind === 'direct' && c.quality > FALLBACK_MIN_QUALITY);
  for (const [target, sources] of Object.entries(FALLBACK)) {
    if (seen.has(target)) continue;
    for (const src of sources) {
      const base = direct.find((c) => c.muscle === src.from);
      if (!base) continue;
      const cross = crossMuscleRatio(src.from, target, sex);
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

// The same calendar-day count `dailyValues()` uses, so a quarantine verdict
// keyed on its day numbers can be matched back to an observation's date.
// Date.UTC on both sides: a pure day count, no local/UTC mix, no DST hole.
function dayNumberOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

// How far out of line a flagged reading must ALSO be before the rating will set
// it aside — see the argument at the call site. 🛑 OURS, judged, and it can only
// ever withhold: a mistyped number is a factor of ten out, a hard PR is a
// fraction. Nothing between 1.0 and 2.0 is touched, which is the winsoriser's
// territory and always was.
const QUARANTINE_MIN_RATIO = 2.0;

// How far back a representative may come from before the seat widens. 84 days
// is `strength-estimate.js`'s own window, and 180 its first widening — the two
// numbers were fitted there against lag and flap rate, so reusing them keeps
// one answer to "how old is too old" rather than inventing a second.
const WINDOW_DAYS = 84;
const WIDEN_DAYS = 180;

// A set at or below this many reps is preferred for the seat, because the curve
// extrapolates least from it. Not a gate: 8 is where docs/research.md §16.2 puts
// the knee (SEE ~4 % at 5 reps, ~8-10 % at 10), and D5 still refuses 16+.
const LOW_REP_PREFERENCE = 8;

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
/**
 * @param {object[]} observations
 * @param {string|null} [muscle] which muscle these are FOR.
 *
 * ⚠️ `muscle` IS OPTIONAL AND ONLY ONE THING USES IT: the standard's own
 * reliability (2026-09-04). Every other input to this function is evidence the
 * lifter produced; `standardQualityFor()` is the opposite — how much the
 * PUBLISHED TABLE for that muscle is worth, which no amount of logging can
 * improve. Core is the only muscle that is not 1.
 *
 * It is a parameter rather than a lookup inside the loop because the caller is
 * the only thing that knows which muscle a bag of observations belongs to, and
 * because leaving it out has to keep working: `demo.js` rates a muscle without
 * naming one, and defaulting to 1 means it gets the old behaviour exactly.
 */
export function rateMuscle(observations, muscle = null) {
  let admissible = (observations || []).filter((o) => o && o.estimate > 0 && repFactor(o.reps) > 0);
  if (!admissible.length) return null;

  /* ── The typo quarantine (2026-09-13, plan §3.2, Tim's decision b) ────────
   *
   * `screenDaily()` was fitted on 2026-08-19, measured (a x10 slip caught 100 %
   * of the time, +25 % 77 %, false positives 0.09 %), tested — and never
   * called. §9 read as though it had shipped. Until today one mistyped set
   * rated a chest 1,958 lb, p99.9, Elite, at "Good" confidence, because the
   * winsoriser centres on the median and a single observation IS its own
   * median.
   *
   * It QUARANTINES, never deletes, and releases the moment another day inside
   * three weeks agrees — so a real PR costs at most one session of patience,
   * and two genuine consecutive PRs release each other (the release pass takes
   * a quarantined day as a witness for exactly that reason).
   *
   * 🚨 THE SCREEN IS MUSCLE-WIDE, NOT PER EXERCISE, AND THIS COMMENT CLAIMED
   * THE OPPOSITE UNTIL 2026-09-15. It said "the screen compares a lift against
   * its own past, never against another lift, so the scale cancels", and the
   * code has never done that: `dailyValues()` emits one row per (exercise,
   * day) and `screenDaily()` sorts ALL of them into ONE running series. So a
   * lift is screened against other lifts, in BOX numbers rather than converted
   * ones — a 250 lb bench arriving after a history of 40 lb flies clears the
   * ceiling by miles and is flagged. Measured, not reasoned.
   *
   * 🚨 WHICH MAKES THE 2.0x RULE BELOW THE WHOLE SAFETY ARGUMENT RATHER THAN A
   * REFINEMENT OF ONE. It is stated in CONVERTED estimates, where exercises are
   * comparable by construction, and that is what stops the flag becoming a
   * verdict. Measured on the demo year: the worst cross-exercise disagreement
   * inside a muscle is 1.12x (Shoulders) and every other muscle sits between
   * 1.00 and 1.09, so ordinary training has about half the headroom it would
   * need to trip this. The `sets left out` line on the panel is the other half
   * — nothing is deleted and the reader is told.
   *
   * ⚠️ WHAT IS LEFT, STATED RATHER THAN QUIETLY FIXED: a first heavy test on a
   * muscle whose other work is much lighter can cross 2.0x honestly, and is
   * then held until a second day agrees (measured at the boundary: kept at
   * 1.99x, set aside at 2.01x). Screening each exercise against its own past
   * would fix that — and would let a x10 slip on a BRAND-NEW exercise straight
   * through, because a first reading has no past to fail against. That is a
   * judged threshold whose error runs BOTH ways, which this file does not get
   * to decide on its own; the same standing as the warm-up question in
   * `docs/social-plan.md` §12.16. Tim has been told. */
  let quarantined = [];
  try {
    const screened = screenDaily(dailyValues(admissible.map((o) => ({
      date: o.date,
      exerciseId: o.exerciseId,
      weight: o.weight,
      reps: o.reps,
      isBenchmark: o.isBenchmark,
    }))));
    /* ⚠️ AND A SECOND CONDITION ON TOP OF THE SCREEN'S OWN, because the screen
     * alone is too eager HERE.
     *
     * `screenDaily()` was fitted to catch mistyped numbers and its ceiling sits
     * about 12 % above the running estimate — which is right for the job it was
     * built for (a smooth per-exercise series) and wrong as a gate on the
     * rating, where a real 245 lb bench test followed by a real 275 x 2 a week
     * later clears the ceiling by 19 % and is not a typo at all. Measured on
     * the suite's own fixtures: the bare screen held back a legitimate PR, a
     * legitimate face-pull outlier the winsoriser exists to handle, and a
     * genuine goal-sized gain.
     *
     * So a reading is only held back if it ALSO stands at QUARANTINE_MIN_RATIO
     * times the best OTHER credible reading this muscle has. A x10 slip is ten
     * times; a hard PR is one-point-something. That is a wide, deliberately
     * uncrossable gap, and it keeps this mechanism doing the one thing it was
     * measured to do rather than quietly becoming a second opinion about
     * progress. The winsoriser still handles everything below the line, which
     * is what it is for.
     *
     * 🛑 The constant is OURS and it can only ever WITHHOLD — the same standing
     * as FATIGUE_HALF_SETS and LAYOFF_DAYS, and it says so here. */
    const bad = new Set();
    const flaggedDays = new Set();
    for (const r of screened) {
      if (r && r.quarantined) flaggedDays.add(`${r.exerciseId}|${r.day}`);
    }
    if (flaggedDays.size) {
      const rest = admissible
        .filter((o) => {
          const d = dayNumberOf(o.date);
          return d === null || !flaggedDays.has(`${o.exerciseId}|${d}`);
        })
        .map((o) => Number(o.estimate) || 0)
        .sort((a, b) => b - a);
      const reference = rest.length ? rest[0] : 0;
      for (const r of screened) {
        if (!r || !r.quarantined) continue;
        const key = `${r.exerciseId}|${r.day}`;
        const worst = admissible
          .filter((o) => dayNumberOf(o.date) === r.day && o.exerciseId === r.exerciseId)
          .reduce((a, o) => Math.max(a, Number(o.estimate) || 0), 0);
        if (reference > 0 && worst >= reference * QUARANTINE_MIN_RATIO) bad.add(key);
      }
    }
    if (bad.size) {
      /* ⚠️ THE VERDICT IS PER DAY; THE PENALTY IS PER SET, and the difference
       * matters. `dailyValues()` collapses a day to its best reading, so a
       * flagged day names one number — but a session holding a mistyped 1,800
       * usually holds three perfectly good sets beside it. Holding the whole
       * day would throw those away to punish one, and they are the evidence
       * that would have carried the muscle anyway.
       *
       * So only the reading that TRIGGERED the flag is held back: the day's
       * highest, which is the one `dailyValues()` screened. Everything lighter
       * on that day stays in. */
      const dayMax = new Map();
      for (const o of admissible) {
        const day = dayNumberOf(o.date);
        if (day === null) continue;
        const key = `${o.exerciseId}|${day}`;
        if (!bad.has(key)) continue;
        const v = Number(o.rawE1rm) || 0;
        if (!dayMax.has(key) || v > dayMax.get(key)) dayMax.set(key, v);
      }
      const keep = [];
      for (const o of admissible) {
        const day = dayNumberOf(o.date);
        const key = day === null ? null : `${o.exerciseId}|${day}`;
        const top = key !== null && dayMax.has(key)
          && (Number(o.rawE1rm) || 0) >= dayMax.get(key) - 1e-9;
        if (top) {
          quarantined.push({
            exerciseId: o.exerciseId,
            exerciseName: o.exerciseName || null,
            date: o.date,
            weight: o.weight,
            reps: o.reps,
          });
        } else keep.push(o);
      }
      // 🛑 NEVER EMPTY THE POOL. If every reading a muscle has looks
      // implausible, the honest answer is the rating it always gave plus the
      // flag — not silence. One bad day out of one is not evidence of a typo,
      // it is the only thing the app knows.
      if (keep.length) admissible = keep;
      else quarantined = [];
    }
  } catch (_) { quarantined = []; }

  // Direct evidence decides the rating. A compound only stands in when there is
  // none — Tim's call, and what keeps a grey muscle meaningful.
  const direct = admissible.filter((o) => o.kind === 'direct');
  const pool = direct.length ? direct : admissible;
  const kind = direct.length ? 'direct' : 'fallback';

  /* One value per exercise per day. Every other set that day is a warm-up, a
   * back-off or a repeat.
   *
   * ⚠️ IT USED TO KEEP THE BIGGEST ESTIMATE AND THAT WAS THE SAME CREDIBILITY
   * INVERSION AS THE SEAT BELOW, ONE LEVEL FURTHER DOWN — and it fired first,
   * so it decided the answer before anything else could. A bench day holding a
   * 215x3 benchmark and a 185x12 back-off set kept the BACK-OFF SET, because
   * twelve reps extrapolate to a bigger number than three; the benchmark was
   * discarded here and never reached the seat rule at all. That is what told a
   * lifter their tested 215 was "at or above" a max inferred from their
   * back-off set.
   *
   * The day's representative is now its most CREDIBLE set — a deliberate test
   * over a working set, a heavy triple over a long set — with the same total
   * ordering as the seat below, so this cannot depend on walk order either.
   * `betterSameDay` is the seat comparison without the estimate tie-break's
   * precedence: within one day, credibility first, then the bigger showing. */
  const betterSameDay = (o, prev) => (o.quality * repFactor(o.reps) - prev.quality * repFactor(prev.reps))
    || (o.estimate - prev.estimate)
    || String(prev.exerciseName || '').localeCompare(String(o.exerciseName || ''));
  const perDay = new Map();
  for (const o of pool) {
    const key = o.exerciseId + '|' + o.date;
    const prev = perDay.get(key);
    if (!prev || betterSameDay(o, prev) > 0) perDay.set(key, o);
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

  /* ── One representative per EXERCISE ──────────────────────────────────────
   *
   * An exercise gets ONE seat. Three things decide which of its sets takes it,
   * and all three changed on 2026-09-13 (plan §3.1, §3.4, §3.8).
   *
   * 1. ⚠️ A WINDOW, BECAUSE THE NUMBER COULD NEVER FALL. The seat used to go to
   *    the best set EVER. Recency discounted the seat's weight but never its
   *    value, so twenty weeks at 300x3 followed by twenty at 250x5 still read
   *    300 — and a year of nothing read the same number at slightly lower
   *    confidence. The seat now comes from the last WINDOW_DAYS; with nothing
   *    in that window it widens to WIDEN_DAYS, and only then to all of history,
   *    so a lifter who has genuinely not trained the lift keeps their record
   *    rather than losing the muscle. Measured on the demo year: nothing moves,
   *    because a training account always has something recent. What it fixes is
   *    the account that has drifted — and the stale-seat case, where a
   *    300-day-old bench benchmark out-ranked a fresh 260x5 that was never even
   *    a candidate.
   *
   *    🛑 THIS IS NOT "HALF OF DECISION (a)", WHICH IS WHAT THIS COMMENT SAID
   *    UNTIL 2026-09-15 — AND THE WORDING SENT A SESSION OFF TO FINISH IT.
   *    `docs/strength-accuracy-plan.md` §3.1 offered decision (a) as a CHOICE of
   *    two: *(a)* a windowed representative here, or *(b)* wire `estimateAt()`
   *    per exercise so the map is a smoothed series with the fall limit and
   *    hysteresis. **(a) is what shipped.** The fall limit is not a missing half
   *    of it; it is the other option, and taking it means replacing the seat
   *    rule below with a replayed per-exercise series — every rating moves, the
   *    golden table re-baselines, and hysteresis has to come with it or the map
   *    flickers. ⚠️ **A design change and a re-baseline, which are Tim's.**
   *
   *    What is true and worth keeping: the number STEPS when a set ages out of
   *    the window rather than declining, and `strength-estimate.js` holds the
   *    2 %/week limit fitted and tested against exactly that.
   *
   * 2. ⚠️ HEAVY SETS FIRST, NOT LONG ONES (decision i). Where an exercise has
   *    any set at LOW_REP_PREFERENCE reps or fewer inside the chosen window,
   *    only those compete for the seat. The curve extrapolates furthest from a
   *    long set and its error roughly doubles from 5 reps to 10 to 20, so a
   *    12-rep set taking the seat over a 5-rep set of the same exercise is the
   *    model choosing its own worst evidence. It is a PREFERENCE and not a gate:
   *    with nothing under the threshold, the long sets compete as before.
   *
   * 3. ⚠️ THE MOST CREDIBLE SET, NOT THE BIGGEST (decision d). Within whatever
   *    survives 1 and 2, the seat goes to the highest evidence weight. It used
   *    to go to the largest ESTIMATE, which is the same credibility inversion
   *    the candidate sort below was written to fix — left in place one level
   *    down, where it chose which of an exercise's own sets got to speak. On a
   *    bench with a 215x3 benchmark and a 185x12 back-off set, the back-off set
   *    held the seat, so the runner told a lifter that 215 was above their max.
   *
   * ⚠️ AND THE TIE-BREAK IS TOTAL, WHICH IT WAS NOT. `>` alone kept whichever
   * row the walk happened to reach first, so the same history read Fair with a
   * year-old leader walked oldest-first and High with today's leader walked
   * newest-first. The store walks newest-first and hid it; the demo generator,
   * the golden test and a friend's published rows walk the other way. Every
   * comparison below falls through to the date and then to the id, so the
   * answer cannot depend on the order rows arrive in. */
  const newest = scored.reduce((a, o) => (o.ageDays < a ? o.ageDays : a), Infinity);
  const windowCut = newest + WINDOW_DAYS <= WIDEN_DAYS ? WINDOW_DAYS : WIDEN_DAYS;

  /* ⚠️ THE SEAT COMPARISON DROPS THE BENCHMARK BONUS, AND THAT IS DELIBERATE.
   * `evidenceWeight` carries it because a deliberate test IS worth more when
   * several readings are averaged. But choosing which of one exercise's own
   * sets speaks is a different question — it is "what is the best showing of
   * this lift?" — and there the bonus does harm: a 245 lb benchmark from six
   * weeks ago would out-rank a 275 x 2 done since, which is precisely the
   * evidence that the lifter has moved on. The bonus is worth 1.25 and a
   * 30 lb PR is worth more than that.
   *
   * What still separates a test from a back-off set is `repFactor`, which is
   * the term that actually describes how far the curve is extrapolating: a
   * 215 x 3 benchmark scores 1.00 against a 185 x 12's 0.45 and takes the seat
   * on its own merits. Recency is kept, so a stale reading loses to a current
   * one of equal quality. */
  const seatCredit = (o) => o.quality * repFactor(o.reps) * recencyWeight(o.ageDays) * fatigueOf(o);
  const better = (o, prev) => (seatCredit(o) - seatCredit(prev))
    || (o.estimate - prev.estimate)
    || (prev.ageDays - o.ageDays)
    || String(prev.date || '').localeCompare(String(o.date || ''));

  const perExercise = new Map();
  for (const o of scored) {
    const key = o.exerciseId;
    const bucket = perExercise.get(key);
    if (!bucket) { perExercise.set(key, { inWindow: [], all: [] }); }
    const b = perExercise.get(key);
    b.all.push(o);
    if (o.ageDays <= windowCut) b.inWindow.push(o);
  }
  const representatives = [];
  for (const b of perExercise.values()) {
    const pool = b.inWindow.length ? b.inWindow : b.all;
    const low = pool.filter((o) => o.reps <= LOW_REP_PREFERENCE);
    const field = low.length ? low : pool;
    let best = null;
    for (const o of field) if (!best || better(o, best) > 0) best = o;
    if (best) representatives.push(best);
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
  // ⚠️ ACROSS exercises the full evidence weight decides, benchmark bonus and
  // all — that is the 2026-08-19 credibility sort and it is unchanged. Only the
  // WITHIN-exercise seat above drops the bonus, for the reason written there.
  // The tie-break falls through to the date and then the id so that this, too,
  // cannot depend on the order the rows arrived in.
  const candidates = representatives.sort((a, b) =>
    (b.evidenceWeight - a.evidenceWeight)
    || (b.estimate - a.estimate)
    || (a.ageDays - b.ageDays)
    || String(a.exerciseId || '').localeCompare(String(b.exerciseId || '')));

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
    // ⚠️ TWO DOUBTS, MULTIPLIED, AND THEY ARE NOT THE SAME DOUBT. The first term
    // is how good this lifter's evidence is — fixable by logging more. The
    // second is how good the published standard is — fixable by nobody. Keeping
    // them as one number is what lets the map fade a Core rating honestly
    // without implying the user did anything wrong, and `raiseConfidenceHint()`
    // says which of the two is in play.
    confidence: confidenceOf(used, scored) * standardQualityFor(muscle),
    used,
    kind,
    contributorCount: scored.length,
    // How many DIFFERENT exercises had a say. One is not a failure — plenty of
    // people bench and do nothing else for chest — but it is the difference
    // between a corroborated reading and an uncorroborated one, so the panel
    // gets to say which it is looking at.
    exerciseCount: perExercise.size,
    newestAgeDays: Math.min(...scored.map((o) => o.ageDays)),
    // Days held back as implausible, so the panel can say so by name. Empty on
    // every ordinary history — measured on the demo year, which quarantines
    // nothing. A set here is NOT deleted and NOT edited: it is waiting for a
    // second day to agree with it, and the screen says that rather than
    // implying the lifter mistyped.
    quarantined,
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

/* 🚨 RULE 5, FOR THE ONE RATING THAT CAME THROUGH SOMEBODY'S OWN MATCH.
 *
 * The muscle panel names the sets an estimate was converted from — "from Dip
 * Machine 60 lbs×10" — and that line cannot tell a library exercise from a
 * custom one standing in for a library exercise. Rule 5 is that an inference
 * must never look like a measurement, and a match a person made by eye is the
 * softest inference in the whole pipeline, so it must say so where the number
 * is read.
 *
 * ⚠️ IT RIDES ON THE HINT RATHER THAN REPLACING IT. The old advice is still
 * true and still worth acting on, so the caveat is prefixed rather than
 * substituted: whichever line raiseConfidenceHint() would have returned still
 * follows. That also means the caveat cannot be lost to a branch ordering,
 * which is the failure the other caveats on that panel have each had once.
 *
 * ⚠️ IT READS `standInName`, WHICH ONLY A USER'S MATCH EVER SETS. It used to
 * read `via` and check `kind` first, because `via` means the muscle on a
 * fallback contribution — see contributionsFor() for why that was separated
 * into its own field instead. There is nothing to disambiguate now, so this
 * function cannot be broken by somebody reordering the branches above it.
 */
function standInNote(rating) {
  const used = (rating && (rating.used || rating.contributors) || [])
    .filter((u) => u && u.standInName);
  if (!used.length) return null;
  // `used` is credibility-sorted, so this is the match that mattered most.
  const led = used[0];
  return `${led.exerciseName} is rated as ${led.standInName} because you matched them — `
    + 'your own match, not a published conversion.';
}

// The single most useful thing to log next, in plain words. This is what turns
// the map from a scoreboard into a to-do list.
export function raiseConfidenceHint(muscle, rating) {
  const note = standInNote(rating);
  const rest = confidenceHint(muscle, rating);
  if (!note) return rest;
  return rest ? `${note} ${rest}` : note;
}

function confidenceHint(muscle, rating) {
  const spec = MUSCLE_LIFTS[muscle];
  const keyLift = spec ? spec.lift : null;
  if (!rating) return keyLift ? `Record any ${muscle.toLowerCase()} exercise to rate this.` : null;

  /* 🚨 THE HINT MUST NOT ASK FOR WORK THAT CANNOT HELP — 2026-09-04.
   *
   * Every line below tells the user to log something, because every line below
   * answers a shortage of THEIR evidence. Core's confidence is held down partly
   * by `standardQuality`, which is a shortage of the WORLD's evidence: one
   * measured source and a 17 %-adrift cross-check. Telling somebody to do
   * another set to fix that would be a small lie, repeated on every visit, and
   * it would never come true however many sets they did.
   *
   * ⚠️ It is checked FIRST but only fires once the ordinary reasons are gone —
   * otherwise it would mask a genuinely stale or single-source reading, which
   * are fixable and worth saying. So: fall through the real advice, and if none
   * of it applies and the rating still is not confident, say why. */
  const standardBound = spec && typeof spec.standardQuality === 'number' && spec.standardQuality < 1;

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

  // Nothing the lifter can do is left, and the reading is still not confident.
  // Say what is actually holding it down rather than returning null and leaving
  // a faded colour unexplained. See the note at the top of this function.
  if (standardBound) {
    return 'Nothing more to log — this one is held back by the standards, not by '
      + 'your training. Fewer people publish core numbers, so the placing is rougher.';
  }
  return null;
}
