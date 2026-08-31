/* ==========================================================================
   exercise-estimate.js — what could you lift on ONE named exercise?

   Pure. Takes a muscle rating that somebody else computed and converts it into
   a named lift. No DOM, no store, no clock.

   ── THIS IS NOT A NEW MODEL ────────────────────────────────────────────────
   🚨 IT IS THE BODY MAP'S OWN ARITHMETIC RUN BACKWARDS, and that matters more
   than it sounds. `muscleStrength()` converts every recorded set into an
   estimate of a muscle's key lift by DIVIDING by a published ratio
   (`estimate: raw / c.ratio` in store.js); this MULTIPLIES back out. Nothing
   about the person is invented — the input is their own sets, and the same
   ratio table, in the same direction it was measured in.

   The session runner has done exactly this since 2026-08-26 to suggest an
   opening weight for an exercise you have never performed. This module is that
   code, lifted out so three more screens can use it, plus the parts it did not
   need: a confidence, the sets it came from, and the inverse rep prediction.

   ── WHY IT IS ALLOWED TO EXIST, GIVEN D14 ─────────────────────────────────
   ⚠️ D14 says graphs never mix benchmarks with workout sets. This mixes them,
   because `rateMuscle()` mixes them, and that was ruled not a breach on
   2026-08-16 for a reason that applies here word for word: **D14 is about
   charting a TREND** — two sources on one line, one point per day silently
   discarding the loser — **and a single best estimate has neither problem**.
   The body map has shipped on that basis for weeks. This is the same number
   wearing a different exercise's units. It is NOT the D18 question, which is
   about the estimator's chart mode and is still Tim's to answer.

   ── THE LINE THIS MODULE DRAWS, AND IT IS THE IMPORTANT ONE ───────────────
   🚨 AN ESTIMATE YOU READ IS NOT AN ESTIMATE YOU LIFT.

   The runner's opening-weight suggestion is gated hard — ratio quality ≥ 0.45
   and muscle confidence ≥ 0.35 — because it PUTS A NUMBER IN A FIELD SOMEBODY
   THEN WALKS UP TO A BAR AND ATTEMPTS. Those gates are correct there and are
   left exactly as they are.

   This module answers a different question, asked by a person looking at a
   screen: *roughly where am I on this lift?* A wide answer with its width
   stated is a useful answer to that; silence is not. So there is no quality
   gate here — instead every result carries a `confidence`, the band it falls
   in, and the exercises it was converted from, and the caller is required to
   show them. That is the same trade the body map already makes: colour
   everything, desaturate by confidence, and name the source in the panel
   (docs/strength-estimate-plan.md §6.1 — the band sits inside one level only
   8.5 % of the time, so refusing to speak until certain means saying nothing
   nine times in ten).

   ⚠️ WHAT IT STILL REFUSES, and why the list is short but absolute:
     • No direct contribution → nothing. A fallback is one muscle standing in
       for another and is the weakest reading in the table; running it through
       a second conversion is the third multiplication that muscle-evidence.js
       calls "how the machine for confidently wrong numbers gets built".
     • No rating for that muscle → nothing. This is Tim's own rule: *"If the
       user has no exercises recorded on a certain muscle group at all, then
       you can say that you can't compare."*
     • A custom exercise → nothing, because `contributionsFor()` refuses one
       and this module never looks at the ratio table directly.
   ========================================================================== */

import { contributionsFor, confidenceBand } from './muscle-evidence.js';
import { e1rm, weightForReps, repsForWeight, MAX_EVIDENCE_REPS } from './e1rm.js';

/**
 * An estimated one-rep max for one exercise.
 *
 * @param {object} exercise   the library entry
 * @param {Map}    muscles    muscle name -> rating, from `muscleStrength()`
 * @param {number} [bodyWeight]  latest weigh-in, for bodyweight/assisted lifts
 *
 * @returns {null | {
 *   oneRM: number,        // TOTAL load, pounds — both dumbbells, body included
 *   shown: number,        // what to print: halved for a per-side lift
 *   confidence: number,   // 0..1
 *   band: object,         // CONFIDENCE_BANDS entry
 *   muscle: string,       // the muscle it was converted through
 *   ratio: number,
 *   ratioQuality: number,
 *   from: string[],       // the exercises whose sets produced it
 *   exerciseCount: number,
 *   perSide: boolean,
 * }}
 */
export function estimateOneRM(exercise, muscles, bodyWeight) {
  if (!exercise || !muscles) return null;
  if (!Array.isArray(exercise.fields) || !exercise.fields.includes('weight')) return null;

  const contribs = contributionsFor(
    exercise,
    bodyWeight > 0 ? { bodyWeight } : undefined,
  );

  /* ⚠️ DIRECT ONLY, AND THE BEST-QUALITY DIRECT ONE. An exercise can train two
   * muscles directly — a chin-up is Back and Biceps — and the conversion is
   * only as good as the ratio it goes through, so the choice is the ratio
   * worth believing most, not the muscle the library happens to list first. */
  const best = contribs
    .filter((c) => c.kind === 'direct' && c.ratio > 0 && c.quality > 0)
    .sort((a, b) => b.quality - a.quality)[0];
  if (!best) return null;

  const rating = muscles.get(best.muscle);
  if (!rating || !(rating.estimate > 0)) return null;

  /* 🚨 A RATING THAT IS ITSELF A STAND-IN CANNOT BE CONVERTED OUTWARD, and this
   * was missed in the first version — found on 2026-09-02 by an agent reading
   * this module against its own header, which is the best kind of bug report.
   *
   * The check above rejects a FALLBACK CONTRIBUTION: the target exercise may not
   * reach its muscle through one. But `rateMuscle()` has a fallback of its own —
   * `kind: 'fallback'` means that muscle had NO direct evidence at all and a
   * compound stood in for it, converted across by a published cross-muscle
   * ratio. Reading `rating.estimate` without looking at `rating.kind` let the
   * exact chain this file says it refuses through the back door: an observation,
   * times a cross-muscle ratio, times this exercise's ratio. Three estimates
   * multiplied together is what `muscle-evidence.js` calls the machine for
   * confidently wrong numbers, and the confidence degrading is not a defence —
   * it is the same defence that let a made-up dip machine rate somebody's
   * triceps on 2026-08-31, because a low number is still the only number in the
   * room when there is nothing to argue with it.
   *
   * ⚠️ It is also what Tim's own boundary describes: a muscle with only a
   * fallback rating is a muscle whose owner has recorded nothing that trains it
   * directly — *"If the user has no exercises recorded on a certain muscle group
   * at all, then you can say that you can't compare."* */
  if (rating.kind === 'fallback') return null;

  const oneRM = rating.estimate * best.ratio;
  if (!(oneRM > 0)) return null;

  /* ⚠️ TWO CREDENCES MULTIPLIED, NOT A NEW CONSTANT. `rating.confidence` is how
   * much the muscle's own number is worth believing; `best.quality` is how much
   * the conversion into this exercise is worth believing — the ratio table's
   * header defines `q` as exactly the width of the population spread in that
   * ratio. Both are already on 0..1 and already mean "believe this much", and
   * multiplying them is the idiom this app already uses when a contribution
   * passes through a second hop (`base.quality * src.q` in muscle-evidence.js).
   *
   * ⚠️ IT IS NOT A MEASURED PERCENTAGE AND MUST NOT BE PRINTED AS ONE. There is
   * no fitted constant anywhere in this project for "how much error a ratio of
   * quality q adds" — `RATIO_ERROR_AT_Q0` in tools/strength-sim.mjs is labelled
   * assumed, not measured. So this produces a BAND NAME, never a ± figure. A
   * guessed ± would be a guess wearing a measurement's clothes, which is the
   * exact thing §15.2 of the estimate plan refused to ship. */
  const confidence = Math.max(0, Math.min(1, rating.confidence * best.quality));

  /* ⚠️ TWO KEYS FOR ONE LIST, AND BOTH ARE REAL. `rateMuscle()` returns the
   * observations it used as `used`; `muscleStrength()` re-publishes the same
   * array to its callers as `contributors`. This module is handed whichever of
   * the two the caller happens to have — the raw rating in a test, the screen's
   * version in the app — and reading only one of them is how the sources line
   * silently came out empty the first time this shipped. */
  const from = (rating.contributors || rating.used || [])
    .map((u) => u && u.exerciseName)
    .filter(Boolean);

  return {
    oneRM,
    shown: exercise.loadType === 'per_side' ? oneRM / 2 : oneRM,
    confidence,
    band: confidenceBand(confidence),
    muscle: best.muscle,
    ratio: best.ratio,
    ratioQuality: best.quality,
    from: [...new Set(from)],
    exerciseCount: rating.exerciseCount || new Set(from).size,
    perSide: exercise.loadType === 'per_side',
    // True when the number really is about this lift rather than converted from
    // its neighbours — the key lift's own ratio is 1.00 at quality 1.00.
    isKeyLift: best.ratio === 1 && best.quality === 1,
  };
}

/**
 * What fraction of the estimated one-rep max a weight is. Plain arithmetic,
 * here rather than at three call sites so the rounding is the same on all of
 * them.
 */
export function percentOfMax(oneRM, weight) {
  const max = Number(oneRM);
  const w = Number(weight);
  if (!(max > 0) || !(w > 0)) return null;
  return (w / max) * 100;
}

/**
 * The rep prediction as it may be PUT ON A SCREEN — clamped, rounded, and with
 * the two cases the raw number cannot express.
 *
 * ⚠️ THE CEILING IS `MAX_EVIDENCE_REPS`, AND IT IS THE SAME 15 AS EVERYWHERE
 * ELSE (D5). Above fifteen reps this app refuses to infer a maximum FROM a set,
 * on the grounds that the curve is not trustworthy out there; predicting a
 * 30-rep set with the same curve would be that refusal held in one hand and
 * ignored in the other. So past the ceiling it says "15+" and stops counting.
 *
 * ⚠️ AND IT IS THE SAME REFUSAL `progression.js` ALREADY MAKES, which matters
 * because the two now appear on adjacent screens. That module used to answer
 * "add a rep" forever and walked a 20 lb lateral raise to 37 reps over thirty
 * sessions; its fix was a ceiling that REFUSES with a reason rather than
 * printing a bigger number. A rep prediction that sailed past 20 while
 * progression's own range stopped at 20 would put the app back in the position
 * of contradicting itself on one screen.
 *
 * ⚠️ THERE IS NO ZERO CASE. At or above the estimated max the honest answer is
 * not "0 reps" — it is that this weight is at the top of what the app thinks
 * you have, which is a different sentence and gets one.
 *
 * @returns {null | { reps: number|null, atLeast: boolean, over: boolean }}
 */
export function repPrediction(oneRM, weight) {
  const raw = repsForWeight(oneRM, weight);
  if (raw === null) {
    const max = Number(oneRM);
    const w = Number(weight);
    if (max > 0 && w >= max) return { reps: null, atLeast: false, over: true };
    return null;
  }
  if (raw >= MAX_EVIDENCE_REPS) return { reps: MAX_EVIDENCE_REPS, atLeast: true, over: false };
  return { reps: Math.max(1, Math.round(raw)), atLeast: false, over: false };
}

/** Re-exported so a caller needs one import to convert the other way too. */
export { weightForReps, repsForWeight, e1rm };
