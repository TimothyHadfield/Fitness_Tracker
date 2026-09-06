/* ------------------------------------------------------------------ *
 * PLANNED SETS AS A PERCENTAGE OF A MAX — 2026-09-18, Tim's ask.
 *
 * > "when you make a workout, you say how much the suggested weight should be
 * >  relative to that user's max for each set, and then when that user starts a
 * >  workout that suggested weight is automatically put into the weight."
 *
 * Pure: no DOM, no store, no clock. The workout template carries `targets` —
 * one percentage per planned set — and this module is the whole of what those
 * percentages MEAN.
 *
 * ------------------------------------------------------------------
 * 🚨 WHAT "MAX" IS, AND THE THREE CANDIDATES THAT WERE REJECTED
 *
 * The percentage is of **the best estimated 1RM this person has recorded on
 * THIS exercise**, through `setE1rm()` — which is D30, the one place in the app
 * a logged set becomes a 1RM, and which already enforces D5's 15-rep ceiling.
 * The caller does that lookup; this module takes the number.
 *
 * ⚠️ NOT the muscle map's cross-muscle estimate, and this is the load-bearing
 * refusal. `deriveOpening()` in views-session.js can estimate a weight for a
 * lift you have NEVER done, by converting from a muscle rating — and it is
 * gated four ways (ratio quality, confidence, the two multiplied, and no
 * fallback rating) precisely because that number gets walked up to a bar. A
 * percentage of it would be two inferences stacked: an estimate of a max, times
 * a prescription. **A target must not become a back door around those gates**,
 * so when there is no recorded set on this exact lift there is no target
 * weight — and the screen says so rather than filling the field.
 *
 * ⚠️ NOT a max the user types in either. A stored max is a number that goes
 * stale in silence — the same argument `safeAge()` makes about a birth year,
 * and the same one D20 makes about a goal's frozen target weight. Their own
 * best set is a fact with a date on it.
 *
 * ⚠️ AND NOT A BODY-WEIGHT OR ASSISTED LIFT AT ALL. `setE1rm()` returns
 * `bodyIncluded: true` for those, meaning the max is the whole load — body plus
 * anything added. The weight FIELD on those exercises holds only the added (or
 * assisting) weight, so 75 % of a 250 lb body-inclusive pull-up max is not 187
 * lb of added weight; it is not a number at all. Two different quantities, and
 * putting one in the other's field is exactly the class of mistake D30 was
 * recorded to end. `targetsApply()` refuses them.
 *
 * ------------------------------------------------------------------
 * ⚠️ ROUNDING GOES DOWN, NEVER UP, and it is the rule `startingSet()` already
 * follows: the smallest pair of plates in the room is the resolution this
 * number can honestly claim, and rounding up hands somebody more than the
 * prescription said. So the achieved percentage is at or below the target, and
 * `weightForTarget()` returns what it actually came to — a screen that prints
 * "75 %" over a weight that is really 73.6 % is inventing precision.
 *
 * 🛑 NOTHING HERE ROUNDS THE PERSON'S OWN NUMBER. This module proposes; the
 * moment somebody types, the field is theirs (Rule: propose, never impose —
 * docs/goals-plan.md §8.2 rule 5).
 * ------------------------------------------------------------------ */

/** The coarsest granularity anybody prescribes in. 5 % steps, 30–100 %. */
export const TARGET_STEP = 5;
export const MIN_TARGET = 30;

/* 🛑 100 IS THE CEILING AND IT IS A DELIBERATE REFUSAL, not an oversight.
 * Real programmes do prescribe above a max — 105 % rack pulls, overload
 * lockouts — and this app will not, because the max it is a percentage OF is an
 * ESTIMATE that no human has ever checked against an actual attempt (Open work
 * 19, and `docs/research.md` §1.3). Prescribing 105 % of a number that might
 * already be 10 % high is the one thing on this screen that could hurt
 * somebody. The lifter can always type a heavier number themselves; the app
 * does not put it there. */
export const MAX_TARGET = 100;

/** Is this a percentage the app will carry? */
export function isTarget(v) {
  return Number.isFinite(v) && v >= MIN_TARGET && v <= MAX_TARGET;
}

/** Snap to the nearest 5 % and into range. */
export function clampTarget(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const snapped = Math.round(n / TARGET_STEP) * TARGET_STEP;
  return Math.min(MAX_TARGET, Math.max(MIN_TARGET, snapped));
}

/**
 * The stored `targets` for an exercise, reconciled against its planned set
 * count — or null, which means "no prescription" and is the default every
 * workout in the app has today.
 *
 * ⚠️ PADDING REPEATS THE LAST VALUE AND TRUNCATION DROPS FROM THE END. Adding a
 * fourth set to 70/75/80 gives 70/75/80/**80**, because a ramp's last rung is
 * the working weight and repeating it is what somebody adding a set means.
 * Padding with a default would silently prescribe a weight nobody chose.
 *
 * ⚠️ A row that is not a usable percentage does not become a default — the
 * WHOLE prescription is dropped. Half a ramp is not a ramp, and a set quietly
 * given a made-up percentage is the app inventing a weight (Rule 6).
 */
export function normalizeTargets(targets, sets) {
  const n = Number(sets) > 0 ? Math.floor(Number(sets)) : 0;
  if (!n || !Array.isArray(targets) || !targets.length) return null;
  const clean = targets.map(clampTarget);
  if (clean.some((v) => v === null)) return null;
  const out = clean.slice(0, n);
  while (out.length < n) out.push(out[out.length - 1]);
  return out;
}

/**
 * Does a percentage prescription mean anything for this exercise?
 *
 * Both halves are refusals rather than gates: an exercise with no weight field
 * has nothing to fill in, and a body-weight or assisted lift's max is a
 * different quantity from its weight field (see the header).
 */
export function targetsApply(exercise) {
  if (!exercise || !Array.isArray(exercise.fields)) return false;
  return exercise.fields.includes('weight');
}

/**
 * The weight to put in the field, and what percentage it really came to.
 *
 * @param {number} percent  the prescribed target, 30–100
 * @param {number} max      the person's own best estimated 1RM, in the SAME
 *   quantity the weight field holds — per side for a per-side lift, which is
 *   what `shownMax()` in set-e1rm.js returns
 * @param {number} step     the smallest real increment (units.js), in pounds
 * @returns {{weight:number, percent:number, achieved:number}|null}
 *   null when there is no honest answer — no max, or a target so low that the
 *   nearest real increment below it is zero. ⚠️ Returning null rather than
 *   rounding UP to one plate is the same choice `stepFor()` makes in
 *   progression.js: at the bottom of the range there is nothing to be done
 *   about the plates in the room, and saying so beats inventing a jump.
 */
export function weightForTarget(percent, max, step) {
  if (!isTarget(Number(percent))) return null;
  const m = Number(max);
  if (!(m > 0)) return null;
  const raw = m * (Number(percent) / 100);
  const s = Number(step);
  const weight = s > 0 ? Math.floor(raw / s) * s : raw;
  if (!(weight > 0)) return null;
  return {
    weight,
    percent: Number(percent),
    // What the rounded number actually is, as a percentage of the same max.
    // A screen may print the target; it may not print the target OVER a weight
    // that is a different percentage without knowing the difference.
    achieved: (weight / m) * 100,
  };
}

/**
 * The chip label — "75 %" when every set is the same, "70/75/80 %" when they
 * are not, and a run of four or more collapses so the chip stays a chip.
 */
export function summariseTargets(targets) {
  if (!Array.isArray(targets) || !targets.length) return null;
  const all = new Set(targets);
  if (all.size === 1) return `${targets[0]} %`;
  if (targets.length <= 4) return `${targets.join('/')} %`;
  return `${targets[0]}–${targets[targets.length - 1]} %`;
}
