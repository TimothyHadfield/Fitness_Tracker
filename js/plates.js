/**
 * WHAT PLATES GO ON THE BAR — the label under the weight stepper.
 *
 * Tim, 2026-09-18: *"I want to display the weight that is being used on certain
 * machines that use plates instead of numbers … replace [the steps hint] with a
 * label that says '45, 45, 25' or something like that which would associate with
 * 275, because 45 (bar) + 2x(45+45+25) = 275 lbs. Make this label automatically
 * adjust for the most optimal specific plates for that weight."*
 *
 * Pure. No DOM, no store, no clock. It is handed a number of pounds and an
 * inventory and it hands back a list; every judgement about WHICH exercises
 * deserve a list lives in `exercises.js`, and every judgement about how the
 * words are drawn lives in `ui.js`.
 *
 * 🛑 WHAT IT REFUSES TO DO
 *
 *   **It never rounds the user's number to make it fit.** A weight that cannot
 *   be built out of the inventory comes back `exact: false` with the shortfall
 *   stated, and `plateLabel()` then returns null so the caller prints nothing.
 *   The alternative — the closest list plus a qualifier — was rejected, and the
 *   reason is the slot rather than the arithmetic: this label sits under a
 *   40px number and is read mid-set with a bar in one hand. "45, 45, 25" beside
 *   275 is a *claim that those plates make that number*, and a near-miss list
 *   makes the same visual claim in the same place. The qualifying words are
 *   exactly the words a glance skips. That is Rule 5's general form — never let
 *   an inference look like a measurement — and printing "load 2 lb more than you
 *   asked for" would be Rule 6 besides. Falling back costs nothing: the old
 *   "5 lb steps" hint is still true, so nothing is lost by refusing.
 *
 *   **It never claims a bar it cannot weigh.** The bar comes from the inventory
 *   (45 lb / 20 kg) or it is zero; there is no table of specialty-bar weights,
 *   because an EZ bar is anywhere from 15 to 25 lb and a trap bar from 45 to 75.
 *   `plateLoadFor()` in exercises.js keeps those exercises out entirely.
 *
 *   **It never asks what unit the user is in.** `units.js` caches that as module
 *   state and reading it here would make this file's answer depend on something
 *   invisible to its arguments. The caller picks the inventory; the inventory
 *   carries its own unit.
 *
 * ⚠️ THE CONVERSION HAPPENS HERE, AND THIS IS ONE OF THE TWO EDGES `units.js`
 * NAMES. Everything is stored in pounds. A kilo gym does not own pound plates,
 * so a kg user must be handed 25/20/15/10/5/2.5/1.25 off a 20 kg bar — not a
 * pound breakdown with the numbers converted, which would read as "put 20.4 kg
 * on each side". `LB_PER_KG` is imported rather than copied: a second hand-typed
 * 2.2046226218 in this repository is a second thing that can drift.
 */

import { LB_PER_KG } from './units.js';

/* ------------------------------------------------------------------ *
 * The inventories
 * ------------------------------------------------------------------ */

/* 🚨 THERE ARE NO 35 lb PLATES IN THIS LIST, AND THAT IS THE ONE DELIBERATE
 * OMISSION — it is what makes largest-first greedy correct.
 *
 * Greedy is only minimal over a "canonical" coin system, and canonicity is a
 * property you have to CHECK rather than reason about. The tempting argument —
 * "each plate divides into the next one up, so greedy is optimal" — is false
 * twice over here: 25 does not divide 45 and greedy is still minimal, while
 * adding the 35 keeps every divisibility relation exactly as it was and breaks
 * it. Measured by exhaustive dynamic programming over every loadable per-side
 * weight up to 500 lb / 250 kg (2026-09-18):
 *
 *   [45,35,25,10,5,2.5]           20 weights where greedy is not minimal.
 *                                 First is 60 a side: greedy says 45 + 10 + 5,
 *                                 where 35 + 25 is two plates.
 *   [45,25,10,5,2.5]              greedy is minimal everywhere.
 *   [25,20,15,10,5,2.5,1.25]      greedy is minimal everywhere.
 *   [25,20,10,5,2.5,1.25]         36 failures — dropping the 15 BREAKS kg.
 *                                 First is 40 a side: greedy 25 + 10 + 5 against
 *                                 20 + 20.
 *
 * So the kg set is the full standard one and the lb set is the one every gym
 * actually owns. ⚠️ Dropping the 35 costs plate COUNT and never costs
 * correctness: 2.5 divides every plate in the list, so every multiple of 2.5 lb
 * is still built exactly — the 35 can only ever have made a list shorter, never
 * possible. And recommending a plate the gym may not stock is its own small
 * lie, which is the second reason it is out.
 *
 * `tests/data-layer.test.mjs` re-runs the DP, so a plate added here without
 * re-checking canonicity fails rather than quietly producing three-plate advice
 * where two would do. */
export const LB_INVENTORY = Object.freeze({
  unit: 'lbs',
  lbPer: 1,                                  // the identity, so lb never round-trips through a float
  bar: 45,
  plates: Object.freeze([45, 25, 10, 5, 2.5]),
});

export const KG_INVENTORY = Object.freeze({
  unit: 'kg',
  lbPer: LB_PER_KG,
  bar: 20,
  plates: Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25]),
});

/** The inventory for a `units.units()` value. Anything unrecognised is pounds, which is what is stored. */
export function inventoryFor(unit) {
  return unit === 'kg' ? KG_INVENTORY : LB_INVENTORY;
}

/* ⚠️ THE TOLERANCE IS ABOUT FLOATING POINT, NOT ABOUT UNCERTAINTY.
 *
 * A kg user's 100 kg is stored as 220.46226218 lb and converts back to
 * 99.99999999999999. Greedy on that leaves a residue of 1e-14, and a strict
 * `remaining === 0` would report "cannot be made" for every round kg weight in
 * the app — the label would simply never appear for half the users.
 *
 * 0.005 display units is five grams, four orders of magnitude above any
 * round-trip residue and two hundred times smaller than the smallest plate
 * either inventory holds, so it can never swallow a real shortfall: the
 * smallest genuine one is a 1.25 kg / 2.5 lb gap. */
const EPS = 0.005;

// Kill the residue that repeated subtraction accumulates, without rounding the
// answer: 1e-6 display units is a millionth of a plate.
const tidy = (n) => Math.round(n * 1e6) / 1e6;

/**
 * The plates for one loading point.
 *
 * @param totalLb  the whole load, in POUNDS, as everything in this app is stored
 * @param inventory  LB_INVENTORY / KG_INVENTORY — carries the unit, the bar and the plates
 * @param bar        true if a bar is part of the total, false for a plate-loaded machine
 * @param points     how many places plates go: 2 for a barbell or a leg-press sled, 1 for a landmine
 *
 * Returns, all weights in the INVENTORY's unit:
 *   { unit, bar, points, each, exact, short, loaded, belowBar }
 *
 *   each      the plates for ONE point, biggest first — [45, 45, 25]
 *   exact     did they come to the asked-for weight
 *   short     how much of one point could not be built (0 when exact)
 *   loaded    what `each` actually comes to, bar included — never above `total`
 *   belowBar  the ask is lighter than the empty bar, so there is nothing to load
 *
 * ⚠️ GREEDY CAN ONLY UNDERSHOOT. It never takes a plate heavier than what is
 * left, so `loaded` is always ≤ the weight asked for and `short` is always ≥ 0.
 * The label refuses to print either way, but it is worth knowing that the
 * failure direction is "not enough on the bar" and never "more than you asked".
 */
export function plateLoad(totalLb, { inventory = LB_INVENTORY, bar = true, points = 2 } = {}) {
  const inv = inventory;
  const barWeight = bar ? inv.bar : 0;
  const total = tidy(Number(totalLb) / inv.lbPer);
  const base = {
    unit: inv.unit, bar: barWeight, points,
    each: [], exact: false, short: 0, loaded: barWeight, belowBar: false,
  };

  if (!Number.isFinite(total) || points < 1) return base;

  const usable = tidy(total - barWeight);
  // An ask below the empty bar is not a hard weight to build, it is a weight
  // that cannot exist. Said plainly rather than clamped to zero, because
  // "bar only" would be an answer to a question nobody asked.
  if (usable < -EPS) return { ...base, belowBar: true, short: tidy(-usable) };
  if (usable <= EPS) return { ...base, exact: true };

  let remaining = tidy(usable / points);
  const each = [];
  for (const plate of inv.plates) {
    while (remaining >= plate - EPS) {
      each.push(plate);
      remaining = tidy(remaining - plate);
    }
  }

  // ⚠️ ABSOLUTE. The take-a-plate test above is itself EPS-tolerant, so a
  // remainder can end a hair BELOW zero on a weight that was a hair short of a
  // plate. Both directions are the same float noise and both are exact; only a
  // signed test would call one of them a failure and the other a success.
  const exact = Math.abs(remaining) <= EPS;
  const onePoint = each.reduce((a, b) => a + b, 0);
  return {
    ...base,
    each,
    exact,
    short: exact ? 0 : tidy(remaining),
    loaded: tidy(barWeight + onePoint * points),
  };
}

/**
 * The plate list as the one sentence that goes on screen, or null when there
 * is nothing honest to say and the caller should print its ordinary hint.
 *
 * The words live here rather than in `ui.js` so the sentence cannot drift from
 * the arithmetic that earned it — the same reason `next-workout.js` builds its
 * own caption.
 *
 * ⚠️ "bar +" IS NOT DECORATION. A barbell and a plate-loaded sled produce the
 * same list for different totals, and without the prefix a reader cannot tell
 * whether the 45 lb bar was already counted. Tim's own sentence spells the bar
 * out for exactly that reason. It also makes the label checkable: bar + 2 x
 * (45 + 45 + 25) is arithmetic somebody can do standing up, and a wrong
 * assumption about their bar shows itself immediately instead of hiding.
 */
export function plateLabel(load) {
  if (!load || !load.exact || load.belowBar) return null;
  if (!load.each.length) {
    // A loaded machine with nothing on it has nothing to say; an empty barbell
    // is a real and common weight and saying so is better than a steps hint.
    return load.bar > 0 ? 'bar only' : null;
  }
  const list = load.each.map((p) => fmtPlate(p)).join(', ');
  // One end of a landmine or a T-bar post: "each side" would be a lie about a
  // bar with one sleeve.
  if (load.points === 1) return `${list} on one end`;
  return load.bar > 0 ? `bar + ${list} each side` : `${list} each side`;
}

// Plates are literals out of the inventory, so this only has to drop the
// trailing zero on 2.5 and 1.25 — never a rounding decision.
function fmtPlate(p) {
  return String(Math.round(p * 100) / 100);
}
