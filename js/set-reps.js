/* ------------------------------------------------------------------ *
 * A PLANNED SET AS A REP PRESCRIPTION — 2026-09-20, Tim's ask.
 *
 * > "while the Nippard guidelines don't necessarily suggest the % weight of max
 * >  you should be lifting, it does often suggest the number of reps the user
 * >  should do, which can be associated as the same thing."
 *
 * He is right, and the coverage is the argument: of the 41 exercises in
 * Nippard's PPL, **39 carry a rep prescription** and exactly **one** carries a
 * percentage `targets` can express. This is how a ready-made programme actually
 * tells you how heavy to go.
 *
 * Pure: no DOM, no store, no clock. Sibling of `set-targets.js`, and everything
 * that file refuses, this file refuses too — it goes through the same door.
 *
 * ------------------------------------------------------------------
 * 🚨 THE PRESCRIPTION IS ASSUMED TO CARRY 1–2 REPS IN RESERVE, AND THAT IS
 * TIM'S CALL, MADE EXPLICITLY:
 *
 * > "maybe assume when it perscribes reps, it's assuming 1-2 RIR (reps in
 * >  reserve)? this might mean we're providing them with a little bit of a range
 * >  that is good, but I think that could be alright."
 *
 * ⚠️ **THIS IS NOT THE RIR FIELD D28 REFUSES, AND THE DIFFERENCE IS THE WHOLE
 * REASON THIS COMMENT IS LONG.** D28 refuses to ASK A LIFTER how many reps they
 * left in the tank — a self-report the app would then do arithmetic on, and the
 * largest single source of error it deliberately cannot see. Nothing here asks
 * anybody anything. This is one fixed assumption about what a COACH MEANS when
 * he writes "10 reps", applied in one place, to convert his words into a weight.
 * A future session hitting D28 must not read it as forbidding this, and must not
 * read this as licence to add the field.
 *
 * 🛑 AND THE ALTERNATIVE WAS WORSE, WHICH IS WHY THIS IS THE SAFE DIRECTION.
 * Assuming a prescription is taken to FAILURE is also an assumption about
 * effort — an invisible one — and it errs by making the bar HEAVIER. "10 reps"
 * meaning "10 with a couple left" converted as failure-at-10 hands somebody a
 * weight they cannot do for 10. Every assumption here can only take weight OFF.
 *
 * ⚠️ **THE RANGE IS MOSTLY THE AUTHOR'S, NOT OURS.** Measured at a 275 lb max:
 * the RIR shift alone is 3–5 % of the weight. A "3–5 reps" prescription spans
 * 220–242 lb because HE wrote a two-rep range, not because this conversion is
 * vague. That is worth keeping true — the app is passing on somebody's own
 * spread, not adding its own on top.
 *
 * ------------------------------------------------------------------
 * 🛑 WHAT IS REFUSED, and each one is the same refusal `set-targets.js` makes
 *
 *   NO OWN RECORDED SET ON THIS EXACT LIFT, NO WEIGHT. The max is `ownBestSet()`
 *   run through `setE1rm()` (D30) — never the muscle map's cross-muscle
 *   estimate, which is gated four ways precisely because its number gets walked
 *   up to a bar. The caller does that lookup; this module takes the number.
 *
 *   NO BODY-WEIGHT OR ASSISTED LIFT. Their max is body-inclusive and the weight
 *   field is not; `targetsApply()` in set-targets.js is the shared gate.
 *
 *   NOTHING ABOVE THE CURVE'S HONEST RANGE. D5 stops at 15 reps, and the
 *   failure-equivalent of a prescription is the prescription PLUS the reserve —
 *   so "12–15 reps" asks the curve about 13–17, which is past it. Those get a
 *   weight with `confidence: 'poor'` and the caller may not print one silently.
 *
 *   ROUNDING GOES DOWN, NEVER UP. Same rule, same reason: rounding up hands
 *   somebody more than the prescription said.
 * ------------------------------------------------------------------ */

import { weightForReps, repConfidence } from './e1rm.js';

/* 🚨 THE ASSUMPTION, IN ONE PLACE, NAMED. A prescription of N reps is read as
 * "N reps with 1 to 2 left", so the lifter could have done N+1 to N+2. Those are
 * the two rep counts the curve is asked about, and they are what makes the
 * answer a range rather than a number. Changing these two constants changes
 * every prescribed weight in the app, which is why they are here and not
 * inlined. */
export const RIR_LOW = 1;
export const RIR_HIGH = 2;

/* 🚨 A PRESCRIPTION IS A QUOTATION, NOT EVIDENCE, AND IT IS NOT CLAMPED TO D5's
 * FIFTEEN. The first version of this file ran the number through `clampReps()`
 * — the right function for a set somebody RECORDED, because above fifteen reps
 * a set is not evidence of a maximum. It is the wrong function here, and the
 * bug it caused was found by an agent transcribing Nippard: he prescribes
 * "20 reps" on the machine lateral raise and "15–20" on both calf raises, and
 * the app quietly stored and displayed **15**. Putting a number in a coach's
 * mouth that he did not say is worse than any of the things D5 protects
 * against, and it fails silently in the one direction nobody would check.
 *
 * The D5 gate still exists — it just belongs on the WEIGHT rather than on the
 * words. `repsAreUsable()` refuses to price anything the curve cannot vouch
 * for, and the rep target is shown anyway, because it needed no curve. */
export const MAX_PRESCRIBED_REPS = 50;
export const MIN_PRESCRIBED_REPS = 1;

/** A rep count as WRITTEN, bounded but never folded down to the D5 ceiling. */
function prescribedReps(n) {
  if (typeof n !== 'number' && typeof n !== 'string') return null;
  if (typeof n === 'string' && n.trim() === '') return null;
  const r = Math.round(Number(n));
  if (!Number.isFinite(r)) return null;
  if (r < MIN_PRESCRIBED_REPS || r > MAX_PRESCRIBED_REPS) return null;
  return r;
}

/**
 * One prescription, normalised to `[lo, hi]`.
 *
 * A single number is a range of one — `10` and `[10, 10]` mean the same thing
 * and are stored the same way, so nothing downstream has to ask which shape it
 * was given. ⚠️ An inverted pair is SORTED rather than refused: "8–5 reps" is a
 * typo with an obvious intent, and refusing the whole prescription over it would
 * drop a whole workout's plan for a transposition.
 */
export function normalizeRepSpec(spec) {
  const pair = Array.isArray(spec) ? spec : [spec, spec];
  if (pair.length !== 2) return null;
  const lo = prescribedReps(pair[0]);
  const hi = prescribedReps(pair[1]);
  if (lo === null || hi === null) return null;
  return lo <= hi ? [lo, hi] : [hi, lo];
}

/**
 * The stored `reps` for an exercise, reconciled against its planned set count.
 *
 * ⚠️ THE SAME PADDING RULE AS `targets`, AND IT HAS TO BE: padding repeats the
 * LAST value and truncation drops from the END. Adding a fourth set to 5/5/8
 * gives 5/5/8/**8**. And one unusable row drops the WHOLE prescription rather
 * than defaulting that set — half a plan is not a plan, and a set quietly given
 * a made-up rep target is the app writing somebody's programme for them.
 */
export function normalizeReps(reps, sets) {
  const n = Number(sets) > 0 ? Math.floor(Number(sets)) : 0;
  if (!n || !Array.isArray(reps) || !reps.length) return null;
  const clean = reps.map(normalizeRepSpec);
  if (clean.some((v) => v === null)) return null;
  const out = clean.slice(0, n);
  while (out.length < n) out.push(out[out.length - 1]);
  return out;
}

/**
 * One prescription for a whole exercise, spread over its planned sets.
 *
 * ⚠️ THE TWO SHAPES ARE AMBIGUOUS AND THIS IS THE ONE PLACE THAT RESOLVES IT.
 * A ready-made programme writes what its author said about the EXERCISE —
 * `reps: 8`, or `reps: [3, 5]` for a range — while what gets stored is one
 * entry per SET. `[3, 5]` is therefore a single range across every set and
 * `[[3, 5], [8, 8]]` is two sets prescribed differently, and the only thing
 * separating them is whether the first element is itself an array. Written down
 * once, here, rather than as a condition inlined at each call site, because the
 * two readings differ silently: a "3–5 reps" exercise read the other way
 * becomes set 1 at 3 reps and set 2 at 5.
 */
export function expandRepSpec(spec, sets) {
  const n = Number(sets) > 0 ? Math.floor(Number(sets)) : 0;
  if (!n || spec == null) return null;
  const perSet = Array.isArray(spec) && spec.length && Array.isArray(spec[0]);
  return normalizeReps(perSet ? spec : Array(n).fill(spec), n);
}

/**
 * What to put in the weight field for a prescribed rep count, and the honest
 * spread around it.
 *
 * @param {number|number[]} spec  the prescription — `10` or `[3, 5]`
 * @param {number} max   the person's own best estimated 1RM, in the SAME
 *   quantity the weight field holds (per side for a per-side lift)
 * @param {number} step  the smallest real increment, in pounds
 * @returns {{weight:number, low:number, high:number, reps:number[],
 *            failureReps:number[], confidence:string}|null}
 *
 * 🚨 `weight` IS THE BOTTOM OF THE RANGE, not its middle, and that is the
 * safety choice rather than a rounding one. It is the number that goes in the
 * field before anybody types, and of the three candidates it is the only one
 * nobody can be hurt by: the lightest weight consistent with the prescription,
 * for the most reps they might have left in reserve. The lifter adds to it; the
 * app does not start them above what the coach asked for.
 */
export function weightRangeForReps(spec, max, step) {
  const reps = normalizeRepSpec(spec);
  if (!reps) return null;
  const m = Number(max);
  if (!(m > 0)) return null;

  /* The heavy end comes from the FEWEST failure-equivalent reps (the bottom of
   * the prescription with the smallest reserve) and the light end from the
   * most. Two ends, two rep counts, and they cross the prescription rather than
   * sitting inside it — which is correct: "3–5 reps at 1–2 RIR" really does
   * include a weight heavier than a true 5-rep max. */
  const hardest = reps[0] + RIR_LOW;
  const easiest = reps[1] + RIR_HIGH;
  const round = (raw) => {
    const s = Number(step);
    return s > 0 ? Math.floor(raw / s) * s : raw;
  };
  const heavy = weightForReps(m, hardest);
  const light = weightForReps(m, easiest);
  if (!(heavy > 0) || !(light > 0)) return null;
  const high = round(heavy);
  const low = round(light);
  if (!(low > 0)) return null;

  return {
    weight: low,
    low,
    high,
    reps,
    failureReps: [hardest, easiest],
    /* ⚠️ GRADED ON THE EASIEST END, which is the one furthest out on the curve
     * and therefore the one the doubt belongs to. Grading on the average would
     * report "fair" for a prescription whose light end the curve cannot vouch
     * for at all. */
    confidence: repConfidence(easiest),
  };
}

/** Is this prescription one the app will put a weight against? */
export function repsAreUsable(spec) {
  const r = normalizeRepSpec(spec);
  if (!r) return false;
  return repConfidence(r[1] + RIR_HIGH) !== 'poor';
}

/** "8 reps", or "3–5 reps" — the prescription in the author's own terms. */
export function describeRepSpec(spec) {
  const r = normalizeRepSpec(spec);
  if (!r) return null;
  if (r[0] !== r[1]) return `${r[0]}–${r[1]} reps`;
  // "1 reps" is the kind of thing that makes a screen look machine-written, and
  // a single is a real prescription — Nippard's bench opens on one heavy set.
  return r[0] === 1 ? '1 rep' : `${r[0]} reps`;
}

/**
 * The chip label. Same shape as `summariseTargets()` so the builder's two chips
 * read as siblings rather than as two unrelated features.
 */
export function summariseReps(reps) {
  if (!Array.isArray(reps) || !reps.length) return null;
  const words = reps.map(describeRepSpec).filter(Boolean);
  if (!words.length) return null;
  const all = new Set(words);
  if (all.size === 1) return words[0];
  if (words.length <= 3) return words.join(' · ');
  return `${words[0]} … ${words[words.length - 1]}`;
}
