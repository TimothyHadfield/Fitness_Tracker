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

   ── THE ONE THAT IS NOW OPT-OUT-ABLE, AND BOTH SIDES OF IT ────────────────
   🚨 A FALLBACK *RATING* — the second bullet's neighbour, `rating.kind ===
   'fallback'` — CAN NOW BE LET THROUGH BY A CALLER THAT ASKS FOR IT BY NAME
   (`{ allowFallback: true }`). The default is unchanged and is still refusal;
   exactly one caller passes it. Both halves of the argument belong here,
   because the half that lost is still true.

   ⚠️ THE ARGUMENT AGAINST, WHICH IS NOT WITHDRAWN. A fallback rating means the
   muscle had NO direct evidence and a compound stood in for it across a
   published cross-muscle ratio. Converting that outward is an observation,
   times a cross-muscle ratio, times this exercise's ratio: three estimates
   multiplied, which is precisely what muscle-evidence.js calls the machine for
   confidently wrong numbers. Degrading the confidence is not a defence on its
   own — that was the defence that let a made-up dip machine rate somebody's
   triceps on 2026-08-31, because a low number is still the only number in the
   room when there is nothing to argue with it. The block below (2026-09-02)
   was a real bug fix and it stays the default for every caller.

   ⚠️ WHY IT IS OFFERED ANYWAY, ON ONE SCREEN. Tim, 2026-09-04 (docs/direction.md
   §3.1): *"It's about getting the BEST numbers we can… When our numbers aren't
   as perfect, have a way to be upfront about it but something is always better
   than nothing."* That recalibrates the honesty rule but keeps the half he
   named: **have a way to be upfront about it.** Three things make this a
   legitimate use of it rather than a hole in the refusal:

     1. **It is a READ-ONLY screen.** The benchmark form's estimate is looked at,
        not loaded onto a bar. The line at the top of this header — an estimate
        you read is not an estimate you lift — is the line this respects: the
        runner's opening weight, the one number somebody walks up to a bar with,
        does NOT pass the option and is not offered one.
     2. **It arrives labelled with BOTH hops.** The caller prints which muscle
        stood in and which exercise the number was then converted into, so a
        reader can see it is an estimate built on an estimate. Rule 5 is not
        waived by §3.1 — Tim endorsed it. A number presented as something it is
        not is still wrong.
     3. **It cannot wear a confident label.** The confidence is multiplied down
        a THIRD time by the stand-in's own quality, and the reported band is
        capped at the second-lowest — a three-hop number may never read "good"
        or "high" however kind the arithmetic is to it.

   🛑 If a fourth screen wants this, that is a new decision and not this one.
   The option exists so the refusal has exactly one named exception, visible at
   the call site, rather than becoming a default nobody re-argued.
   ========================================================================== */

import {
  contributionsFor, confidenceBand, CONFIDENCE_BANDS, FALLBACK_MIN_QUALITY,
} from './muscle-evidence.js';
import { e1rm, weightForReps, repsForWeight, MAX_EVIDENCE_REPS } from './e1rm.js';

/**
 * An estimated one-rep max for one exercise.
 *
 * @param {object} exercise   the library entry
 * @param {Map}    muscles    muscle name -> rating, from `muscleStrength()`
 * @param {number} [bodyWeight]  latest weigh-in, for bodyweight/assisted lifts
 * @param {object} [opts]
 * @param {boolean} [opts.allowFallback=false]  let a muscle rating that is
 *   itself a stand-in convert outward. ⚠️ OPT-IN, BY ONE CALLER, ON A READ-ONLY
 *   SCREEN — see the header. Anything that puts a weight in a field somebody
 *   loads must leave this alone.
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
 *   viaFallback: boolean, // true when the MUSCLE was itself a stand-in
 *   standIn: string|null, // and which muscle stood in for it
 * }}
 */
export function estimateOneRM(exercise, muscles, bodyWeight, opts) {
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
  /* ⚠️ …AND THE ONE CALLER THAT MAY OPT OUT OF THAT REFUSAL DOES IT HERE, BY
   * NAME. `allowFallback` is checked as `=== true` rather than for truthiness:
   * this is the one line in the module that turns the refusal off, and it must
   * not be switchable by an options object that happened to carry a stray
   * value. Everything below prices the extra hop; the header argues both sides
   * of whether the hop should be available at all. */
  const viaFallback = rating.kind === 'fallback';
  if (viaFallback && !(opts && opts.allowFallback === true)) return null;

  /* ⚠️ TWO KEYS FOR ONE LIST, AND BOTH ARE REAL. `rateMuscle()` returns the
   * observations it used as `used`; `muscleStrength()` re-publishes the same
   * array to its callers as `contributors`. This module is handed whichever of
   * the two the caller happens to have — the raw rating in a test, the screen's
   * version in the app — and reading only one of them is how the sources line
   * silently came out empty the first time this shipped. */
  const used = rating.contributors || rating.used || [];

  /* The observation that LED the rating, which for a fallback rating is the
   * stand-in worth believing most. `rateMuscle()` sorts `used` by credibility
   * (`evidenceWeight`) before slicing, so element 0 is not "the first one we
   * found" — it is the one that decided the number. Its `via` is the muscle
   * that stood in and its `quality` is `base.quality * src.q`, the credibility
   * of the cross-muscle hop itself (muscle-evidence.js's `add(...)` call). */
  const lead = used[0] || null;

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
  let confidence = Math.max(0, Math.min(1, rating.confidence * best.quality));
  let band = confidenceBand(confidence);
  let standIn = null;

  /* ⚠️ A THIRD MULTIPLICATION IS PRICED AS A THIRD MULTIPLICATION. Two hops
   * above cost two credences; a stand-in rating is a hop the two terms above
   * do not price, so it costs a third. `lead.quality` is that hop's own
   * credibility — the same number `muscle-evidence.js` computed as
   * `base.quality * src.q` when it decided the compound could stand in at all.
   *
   * ⚠️ YES, THIS DOUBLE-COUNTS, AND THAT IS THE POINT. `rating.confidence`
   * already contains the observations' quality, but at a FOURTH ROOT
   * (`Math.pow(quality * depth * agreement * fresh, 0.25)`), which damps a poor
   * stand-in to almost nothing. A cross-muscle ratio at q = 0.25 arriving as a
   * ~0.7 multiplier is not a punishment, it is a rounding error. The full
   * multiplication is the deliberate over-penalty owed to a chain this module
   * spent its header arguing against.
   *
   * ⚠️ AND WHEN THE STAND-IN'S QUALITY IS UNKNOWN, ASSUME THE WORST IT COULD
   * LEGALLY BE. `FALLBACK_MIN_QUALITY` is the floor a contribution must clear
   * to stand in for another muscle at all, so it is the most pessimistic value
   * consistent with this rating existing — never 1, which would silently make a
   * rating with no provenance the best-treated of the three. */
  if (viaFallback) {
    const q = lead && lead.quality > 0 ? Math.min(1, lead.quality) : FALLBACK_MIN_QUALITY;
    confidence = Math.max(0, Math.min(1, confidence * q));
    standIn = (lead && lead.via) || null;

    /* 🚨 AND A HARD CEILING ON THE WORD, NOT ONLY ON THE NUMBER. The band is
     * what a reader actually reads — "good confidence" is a sentence, 0.58 is
     * not — so the arithmetic being kind is not allowed to produce a confident
     * label. Capped at the SECOND-LOWEST band: three estimates multiplied may
     * read "low" or "fair" and nothing better, ever. Not the lowest, because
     * "low" is the honest word for a genuinely poor two-hop estimate too, and
     * flattening every three-hop number onto it would stop the band saying
     * anything at all. */
    const cap = CONFIDENCE_BANDS[1];
    const at = confidenceBand(confidence);
    const rank = (b) => CONFIDENCE_BANDS.findIndex((x) => x.key === b.key);
    band = rank(at) > rank(cap) ? cap : at;
  }

  const from = used.map((u) => u && u.exerciseName).filter(Boolean);

  return {
    oneRM,
    shown: exercise.loadType === 'per_side' ? oneRM / 2 : oneRM,
    confidence,
    band,
    muscle: best.muscle,
    ratio: best.ratio,
    ratioQuality: best.quality,
    from: [...new Set(from)],
    exerciseCount: rating.exerciseCount || new Set(from).size,
    perSide: exercise.loadType === 'per_side',
    // True when the number really is about this lift rather than converted from
    // its neighbours — the key lift's own ratio is 1.00 at quality 1.00.
    //
    // ⚠️ IT IS ABOUT THE LAST HOP ONLY, and `viaFallback` can be true beside it:
    // an exercise can BE a muscle's key lift while that muscle's rating is
    // itself a stand-in. A caller printing "nothing was converted for this"
    // off `isKeyLift` alone would then be wrong in the worst available
    // direction, so `viaFallback` is checked FIRST wherever the two meet.
    isKeyLift: best.ratio === 1 && best.quality === 1,
    // Flagged, never inferred from the shape of the other fields — the caller
    // is required to say so on screen, and a caller that forgot would otherwise
    // print a three-hop number in a two-hop sentence.
    viaFallback,
    // Which muscle stood in. Null when the rating carried no provenance; the
    // caller has a wording for that case and must not invent a muscle name.
    standIn,
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
