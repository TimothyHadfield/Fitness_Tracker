// How a MACHINE turns the plates you logged into the load your body moved —
// 2026-09-27, docs/machine-conversion-plan.md.
//
// Tim: *"the 45lbs for the machine hip thrust matches to a lot more than 45lbs
// with a barbell … the machanical advantage with the lever and extending the
// weight further away from the pivot point makes it harder to move … I don't
// want you to do a single conversion like 'machine weights are 60% of free
// weight counterparts' … Really think about why something converts to a
// different weight and by a certain amount."*
//
// THE MODEL, and it is a torque balance, not a fitted factor. On a rigid arm
// with the pivot at one end, the pad at distance d_pad and the plates at
// d_plate, the force at the pad is
//
//     effective = k × plates + A          k = d_plate / d_pad
//
// where A is what the machine itself puts on you with no plates loaded (the
// arm's own weight felt at the pad, a sled's carriage, a Smith bar). Both points
// ride the same arm, so the angle cancels and k holds through the rep. The
// effective load is then an ordinary FREE-WEIGHT load, converted by the free
// lift's own sourced ratio (a barbell hip thrust, a back squat). Nothing here
// is a percentage of anything.
//
// ⚠️ ONLY WHERE THE GEOMETRY IS VISIBLE AND VARIES BETWEEN MACHINES OF ONE NAME
// (plan §4): the hip thrust designs and the Smith bar. A stack machine whose
// gearing is hidden in a cam stays on its Strength Level median in
// muscle-evidence.js, because nobody can measure anything better.
//
// 🔒 REASONED, NOT MEASURED. No manufacturer publishes a hip-thrust lever ratio;
// every k and A below is geometry read off typical machines (plan §6). The
// quality numbers stay low for exactly that reason.
//
// Pure except for one small registry (the user's own leverage picks, seeded at
// boot from settings — see the bottom of the file).

import { e1rm } from './e1rm.js';

/* The Smith bar.
 *
 * ⚠️ TWO NUMBERS, BECAUSE THE RATIOS THEY FEED WERE BUILT TWO WAYS. The app
 * logs a Smith lift as plates only (Tim, 2026-09-23 — kept). What the bar adds
 * depends on what the ratio it meets was made from:
 *   · A ratio derived from Strength Level's Smith pages was divided from
 *     numbers whose lifters were told to "include the bar, normally 44 lb"
 *     (strength-standards/smith-machine-squat). To land on that page's scale a
 *     plates-only number needs the same 44 — a convention match, not physics.
 *   · A REASONED ratio claims a Smith pound is roughly a barbell pound, so what
 *     matters is the bar's real effective weight. Smith bars are counterbalanced
 *     to about 5–45 lb depending on the make and nobody publishes it; 20 is a
 *     middle, reasoned. */
export const SMITH_BAR_SL = 44;
export const SMITH_BAR_EFFECTIVE = 20;
// The Smith entries whose ratio came off Strength Level's own Smith page.
const SMITH_SL_SOURCED = new Set(['Smith Machine Squat', 'Smith Machine Shrug']);

/* The leverage a person can pick for their own lever machine: "the plates sit
 * this many times as far from the pivot as the pad". 1 = the same distance.
 * Not picked ("not sure") → the design's default below. */
export const LEVERAGE_OPTIONS = [1, 1.5, 2, 2.5, 3];

/* One row per machine DESIGN. `k` and `A` as above; `q` the conversion's
 * quality for the rating (the RATIOS table's meaning), `qPicked` when the user
 * has told us their machine's leverage — a step up, not more, because the
 * pick is by eye and range of motion still differs from the barbell.
 *
 * All three convert against the BARBELL hip thrust (Strength Level 0.96 male /
 * 1.16 female of the deadlift — the ratio lives in muscle-evidence.js RATIOS). */
const DESIGNS = new Map([
  /* Plates on horns at the far end of a long arm, past the hip pad — Tim's
   * machine (*"a long extended rod"*). The pegs typically sit 1.5–3 pad
   * lengths from the pivot; 2.5 is the middle of the long-lever range, which is
   * what Tim chose for "not sure" (2026-09-27). A ≈ 20 lb: an empty arm's weight
   * at the pad, a typical 10–30 lb, not published. Keeps the original library
   * id, so every set he has logged re-reads as this design. */
  ['Machine Hip Thrust', { design: 'lever', k: 2.5, A: 20, q: 0.30, qPicked: 0.35, pickable: true }],
  /* Plates on a carriage or belt right at the hips (Nautilus Glute Drive and
   * its kind: horns on the carriage). k ≈ 1 read off the product photo; A = 15,
   * the Glute Drive's PUBLISHED starting resistance. The best-known design of
   * the three, so the highest q. */
  ['Machine Hip Thrust (Plates at Hips)', { design: 'hips', k: 1, A: 15, q: 0.35 }],
  /* A pin in a weight stack. The cam or pulley is typically a 2:1 reduction or
   * less, so a stack pound is 0.5–1 lb at the hips; 0.8 sits inside that. The
   * machine's own resistance is part of the stack number, so A = 0. Hidden
   * gearing → the lowest q. */
  ['Machine Hip Thrust (Weight Stack)', { design: 'stack', k: 0.8, A: 0, q: 0.25 }],
]);

/** The design row for one exercise name, or null. */
export function designFor(name) {
  return DESIGNS.get(String(name || '')) || null;
}

/** Can the person pick their own leverage for this exercise? */
export function isLeveragePickable(exercise) {
  if (!exercise || exercise.isCustom) return false;
  const d = designFor(exercise.name);
  return Boolean(d && d.pickable);
}

/**
 * The mechanics of one exercise as the conversion needs them, or null for an
 * exercise the table above does not describe (it then converts exactly as it
 * always has).
 *
 * @param {object} exercise   a library exercise
 * @param {number|null} [picked]  the user's leverage for it, if any
 * @returns {{ k, A, q: number|null, picked: boolean, design }} — `q` null means
 *   "keep the RATIOS rule's own quality" (the Smith family).
 */
export function mechanicsFor(exercise, picked) {
  if (!exercise || !exercise.name || exercise.isCustom) return null;
  const name = exercise.name;
  const d = DESIGNS.get(name);
  if (d) {
    const p = d.pickable ? validLeverage(picked) : null;
    return {
      design: d.design,
      k: p === null ? d.k : p,
      A: d.A,
      q: p === null ? d.q : d.qPicked,
      picked: p !== null,
    };
  }
  if (/^Smith Machine /.test(name)) {
    return {
      design: 'smith', k: 1,
      A: SMITH_SL_SOURCED.has(name) ? SMITH_BAR_SL : SMITH_BAR_EFFECTIVE,
      q: null, picked: false,
    };
  }
  return null;
}

/** A picked leverage, or null when it is not one of the offered values. */
export function validLeverage(v) {
  const n = Number(v);
  return v !== null && v !== '' && LEVERAGE_OPTIONS.includes(n) ? n : null;
}

/** Logged plates → the load the body moved. */
export function effectiveLoad(lever, logged) {
  const x = Number(logged);
  if (!lever || !(x > 0)) return null;
  return lever.k * x + lever.A;
}

/** And back: the load the body moved → plates. Null below the machine's own A. */
export function loggedFromEffective(lever, effective) {
  const y = Number(effective);
  if (!lever || !(y > 0) || !(lever.k > 0)) return null;
  const x = (y - lever.A) / lever.k;
  return x > 0 ? x : null;
}

/**
 * One set's one-rep max IN PLATES, worked out on the load the body really moved.
 *
 * ⚠️ WHY NOT e1rm(plates, reps). The rep curve (Marzagão, e1rm.js) depends on
 * the weight being moved, and on a lever machine that is k × plates + A, not
 * the plates: 45 × 10 on a 2.5× arm is 132.5 lb at the hips for ten reps, and
 * e1rm(132.5, 10) = 185 where 2.5 × e1rm(45, 10) + 20 = 197. The curve belongs
 * to the real resistance. The answer is handed back in PLATES so that the one
 * linear mapping in `toKeyLift()` (k × plates + A, then the ratio) turns it into
 * exactly e1rm(effective, reps) ÷ ratio — the plan's arithmetic — and so the
 * observation's own units stay what the lifter typed.
 */
export function plateE1rm(lever, logged, reps) {
  const eff = effectiveLoad(lever, logged);
  if (eff === null) return null;
  const top = e1rm(eff, reps);
  if (!(top > 0)) return null;
  return (top - lever.A) / lever.k;
}

/* ── The user's own picks ─────────────────────────────────────────────────
 *
 * ⚠️ A SMALL MODULE-LEVEL REGISTRY, SEEDED AT BOOT, for the same reason
 * `setUnits()` is (js/units.js): the rating walk is synchronous and pure and
 * cannot await the store for one setting. It is stored in settings as
 * `leverage: { <exerciseId>: 2.5, … }` — a map of numbers, no arrays, so
 * Firestore's nested-array refusal (handbook §0.22) cannot bite. app.js seeds
 * it from `store.getSettings()` before the first screen; the runner's picker
 * updates it and saves. A settings write also invalidates the store's strength
 * memo (its key includes the settings rows), so the map re-rates.
 *
 * 🚩 ONE DEVICE, ONE SET OF PICKS. A friend's sets rated ON THIS DEVICE (the
 * compare screen, a joint workout's partner) use this device's pick — for a
 * partner on the same machine that is right; a friend's PUBLISHED map was
 * rated on their device with their own picks. */
let picks = Object.create(null);

export function setLeverageChoices(obj) {
  const next = Object.create(null);
  if (obj && typeof obj === 'object') {
    for (const [id, v] of Object.entries(obj)) {
      const n = validLeverage(v);
      if (n !== null) next[id] = n;
    }
  }
  picks = next;
}

/** The pick for one exercise id, or null ("not sure" / never picked). */
export function leverageChoice(exerciseId) {
  const v = picks[String(exerciseId || '')];
  return v === undefined ? null : v;
}

/** The whole map as it should be saved, with one pick changed (null removes it). */
export function withLeverageChoice(current, exerciseId, value) {
  const out = {};
  if (current && typeof current === 'object') {
    for (const [id, v] of Object.entries(current)) {
      const n = validLeverage(v);
      if (n !== null) out[id] = n;
    }
  }
  const n = validLeverage(value);
  if (n === null) delete out[exerciseId];
  else out[exerciseId] = n;
  return out;
}
