// ONE set -> ONE estimated one-rep max, with the load convention decided once.
//
// Written 2026-09-13 for the strength-accuracy work (docs/strength-accuracy-plan.md §2.1, §2.8).
// Before this module existed, seven callers built the load that goes into e1rm() by hand, and
// four of them got it wrong in the same way: they fed the curve the BOX number — the assistance
// on an assisted pull-up, the added plate on a weighted one — so taking more help read as a
// heavier lift and a personal best. Two more disagreed about dumbbells. This is the single
// entry point; nothing outside it should call e1rm() on a logged set.
//
// THE THREE CONVENTIONS, decided by Tim on 2026-09-13 (plan §4.e):
//
//   per_side   The curve is applied to the PER-HAND weight and the result doubled:
//              2 × e1rm(w, r). Marzagão (2026) was fitted with dumbbells logged per hand
//              (docs/research.md §1.3), so that is what its coefficients mean; and the ratio
//              table was derived from Strength Level's per-dumbbell 1RM tables doubled, which is
//              the same convention. e1rm(2w, r) — what the rating pipeline did until today — is a
//              different number because k depends on the weight (about 9 % lower on 50 × 12).
//   bodyweight The resistance is fraction × body weight ± the logged number (totalResistance in
//              e1rm.js), then the curve on that total. `bodyIncluded` is true so a screen can
//              say "body weight included" rather than print it as the exercise's own max.
//   total      The curve on the logged number.
//
// D5 IS ENFORCED HERE. A set above MAX_EVIDENCE_REPS returns null — the app does not infer a
// maximum from a burnout set anywhere, not on the Data tab either. A caller that wants to say
// "dropped because it was 25 reps" checks isRankableSet() itself.

import { e1rm, totalResistance, isRankableSet } from './e1rm.js';
import { bodyWeightFractionFor, loadTypeFor } from './exercises.js';

function loadTypeOf(exercise) {
  if (!exercise) return 'total';
  if (exercise.loadType) return exercise.loadType;
  return loadTypeFor(exercise.name, exercise.equipment, exercise.fields) || 'total';
}

/**
 * @param {object} exercise       a library or custom exercise
 * @param {number} loggedWeight   what was typed — added load, assistance, or the weight on the bar
 * @param {number} reps
 * @param {object} [opts]         { bodyWeight } in pounds, ON THE DATE OF THE SET; bodyWeightQuality
 * @returns null when the set cannot honestly yield a maximum (no reps, more than 15 reps, a
 *   body-weight lift with no weigh-in, more assistance than body weight), else
 *   { e1rm, load, perSide, perSideWeight, bodyIncluded, assist, quality, reps }
 *   - e1rm    the TOTAL estimated one-rep max in pounds (both dumbbells; body included)
 *   - load    the total resistance the set was performed at (both dumbbells; body included)
 *   - quality 1, or the body-weight fraction's published quality × the weigh-in's quality
 */
export function setE1rm(exercise, loggedWeight, reps, opts) {
  const r = Number(reps);
  if (!isRankableSet(r)) return null;
  const bwSpec = bodyWeightFractionFor(exercise);
  if (bwSpec) {
    const res = totalResistance(exercise, loggedWeight, opts && opts.bodyWeight);
    if (!res) return null;
    const v = e1rm(res.load, r);
    if (v === null) return null;
    const bwQ = Number(opts && opts.bodyWeightQuality);
    return {
      e1rm: v, load: res.load, perSide: false, perSideWeight: null,
      bodyIncluded: true, assist: res.assist,
      quality: res.quality * (Number.isFinite(bwQ) && bwQ > 0 ? Math.min(1, bwQ) : 1),
      reps: r,
    };
  }
  const w = Number(loggedWeight);
  if (!(w > 0)) return null;
  if (loadTypeOf(exercise) === 'per_side') {
    const one = e1rm(w, r);
    if (one === null) return null;
    return { e1rm: one * 2, load: w * 2, perSide: true, perSideWeight: w, bodyIncluded: false, assist: false, quality: 1, reps: r };
  }
  const v = e1rm(w, r);
  if (v === null) return null;
  return { e1rm: v, load: w, perSide: false, perSideWeight: null, bodyIncluded: false, assist: false, quality: 1, reps: r };
}

/** The number a screen prints as "this exercise's max": per side for a dumbbell, total otherwise. */
export function shownMax(result) {
  if (!result) return null;
  return result.perSide ? result.e1rm / 2 : result.e1rm;
}
