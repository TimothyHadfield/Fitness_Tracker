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

/* ------------------------------------------------------------------ *
 * The drawing — one sleeve with its plates on it
 * ------------------------------------------------------------------ */

/* 2026-09-26, Tim: *"instead of having the measurement below the weight be
 * bar+10,10 each side, you should just have a visual of one side of the bar
 * that has 2 10 plates visually on it, and whatnot, depending on the excersize.
 * Color them differently aswell."*
 *
 * THE COLOURS ARE THE CALIBRATED-PLATE CONVENTION (IWF / IPF): 25 kg red,
 * 20 blue, 15 yellow, 10 green, 5 white, 2.5 black, 1.25 chrome. Pound gyms
 * have no one standard, so each pound plate takes the colour of the kilo plate
 * nearest its weight — 55 lb (24.9 kg) red, 45 (20.4) blue, 35 (15.9) yellow,
 * 25 (11.3) green, 10 (4.5) white, 5 (2.3) black, 2.5 (1.1) chrome — which is
 * how colour-coded pound bumpers are sold. 55 and 35 are listed although the
 * inventory never recommends them (see the canonicity note above), so a plate
 * added later already has its colour. The hues themselves live in the
 * stylesheet ("Plate drawing"); this file only names them. */
export const PLATE_COLOURS = Object.freeze({
  kg: Object.freeze({ 25: 'red', 20: 'blue', 15: 'yellow', 10: 'green', 5: 'white', 2.5: 'black', 1.25: 'chrome' }),
  lbs: Object.freeze({ 55: 'red', 45: 'blue', 35: 'yellow', 25: 'green', 10: 'white', 5: 'black', 2.5: 'chrome' }),
});

/* Real calibrated plates: diameter in millimetres, by colour. A 25 and a 20
 * are both full 450 mm discs; below that each is smaller, and the drawing's
 * plate HEIGHTS follow these exactly.
 *
 * 🔄 2026-09-27 the THICKNESS is no longer real. Tim: *"the plate visual …
 * is colored but extreamly unclear. Could you instead make it so that it
 * takes up some more space and each plate actually has the label on it."* A
 * real 45 is 23 mm and a 2.5 is 9 mm; drawn to scale the 45 was 9px wide and
 * no number fits on that. `px` is the drawn thickness when there is room,
 * chosen so the weight's number fits ACROSS the plate on everything from a 5
 * up — heavier still means thicker, which is the ordering that matters. The
 * two thinnest (a 2.5 lb / 1.25 kg chrome and a 2.5 kg black) carry their
 * number just above or below the plate instead, where their small diameter
 * leaves room. */
const PLATE_SIZE = Object.freeze({
  red:    { dia: 450, px: 20 },
  blue:   { dia: 450, px: 19 },
  yellow: { dia: 400, px: 18 },
  green:  { dia: 325, px: 17 },
  white:  { dia: 230, px: 16 },
  black:  { dia: 190, px: 12 },
  chrome: { dia: 160, px: 9 },
});

/* Which ink the number on each plate takes: dark on the pale plates, white on
 * the deep ones — whichever has the higher contrast against that hue. */
const PLATE_TONE = Object.freeze({
  red: 'light', blue: 'light', black: 'light',
  yellow: 'dark', green: 'dark', white: 'dark', chrome: 'dark',
});

// The picture, in CSS pixels. 48 tall (was 22) so a number fits on a plate
// and a 1.25 still reads as a small disc beside a 25.
const DRAW_H = 48;
const GAP = 1.5;         // between plates, so two blues read as two
const MIN_SLEEVE = 34;   // an empty sleeve still looks like one
const round = (n) => Math.round(n * 100) / 100;

/* ⚠️ THE LABEL METRICS ARE THE STYLESHEET'S, COPIED. `.pd-label` is
 * var(--fs-sm) = 11.5px bold with tabular figures; a digit there is ≈ 0.6 em
 * and the figures stand ≈ 0.72 em tall. Only used to decide WHERE a number
 * goes (across the plate, along it, or beside it) — a pixel off either way
 * moves a borderline plate from one placement to the next, nothing worse. */
const LABEL_PX = 11.5;
const labelWidth = (t) => round([...t].reduce((s, ch) => s + (ch === '.' ? 0.3 : 0.6) * LABEL_PX, 0));
const LABEL_TALL = round(0.72 * LABEL_PX);

/**
 * The picture of ONE loading point, or null exactly when `plateLabel()` is
 * null — so the stepper's fallback is the same in both.
 *
 * @param load       plateLoad()'s answer
 * @param maxWidth   the most px the picture may take. A crowded sleeve draws
 *                   its plates THINNER rather than wider: a picture that wraps
 *                   or is cut off is a wrong plate count.
 *
 * Returns { width, height, kind: 'bar'|'peg', parts }, every part a rectangle
 * { part, x, y, w, h } in px, drawn in order:
 *   bar: shaft (a stub of the bar) · sleeve · collar (the sleeve's inner
 *        flange) · plates · clip (the spring collar holding them) · cap (the
 *        bar's end)
 *   peg: sleeve (the horn) · frame (the machine / landmine post) · plates
 *   then one `label` per plate, its box being where its number is written.
 * A plate part also carries { plate, colour }. Plates go from the collar
 * outward, biggest first, as `each` already is — that is how they are loaded.
 * A label carries { plate, text, tone: 'light'|'dark'|'ink', place:
 * 'across'|'along'|'above'|'below' } — `along` is written up the plate, for a
 * sleeve so crowded the number no longer fits across it; `ink` is the page's
 * own text colour, for a number written beside the plate rather than on it.
 *
 * ⚠️ The bar end is drawn on purpose: the sleeve runs on past the last plate
 * and the clip, and stops at a cap, so the picture reads as the END of a bar
 * with plates on it rather than a row of coloured blocks.
 *
 * ⚠️ No `bar` weight means no bar drawn: a sled's horn and a landmine's end
 * look alike here on purpose, and the sentence (the element's label) still
 * says which is "each side" and which is "on one end".
 */
export function plateDrawing(load, { maxWidth = 166 } = {}) {
  if (plateLabel(load) === null) return null;
  const colours = PLATE_COLOURS[load.unit] || PLATE_COLOURS.lbs;
  const cy = DRAW_H / 2;
  const hasBar = load.bar > 0;
  const under = [];      // drawn before the plates
  const over = [];       // drawn after them
  let x;

  if (hasBar) {
    under.push({ part: 'shaft', x: 0, y: round(cy - 2.5), w: 9, h: 5 });
    x = 9;
  } else {
    x = 4;
  }
  const inner = x;                     // where the sleeve starts
  if (hasBar) x += 6;                  // the collar flange
  const firstPlateX = x + (hasBar ? 1 : 1.5);

  const plates = load.each.map((plate) => {
    const colour = colours[plate] || 'chrome';
    const size = PLATE_SIZE[colour];
    return { plate, colour, h: round(DRAW_H * size.dia / 450), px: size.px };
  });
  // What sits past the plates: on a bar a gap, the clip, bare sleeve and the
  // cap; on a machine horn just its tip.
  const CLIP_W = 4, TAIL = 8, CAP_W = 3, LIP = 6;
  const after = hasBar ? (plates.length ? 1.5 + CLIP_W : 0) + TAIL + CAP_W : LIP;
  const room = maxWidth - firstPlateX - after;
  const natural = plates.reduce((s, p) => s + p.px, 0) + GAP * Math.max(0, plates.length - 1);
  const squeeze = natural > room ? room / natural : 1;
  const gap = GAP * squeeze;

  const drawn = [];
  let px = firstPlateX;
  for (const p of plates) {
    const w = round(Math.max(1, p.px * squeeze));
    drawn.push({ part: 'plate', plate: p.plate, colour: p.colour, x: round(px), y: round(cy - p.h / 2), w, h: p.h });
    px += w + gap;
  }
  const stackEnd = plates.length ? px - gap : firstPlateX;

  let sleeveEnd;
  if (hasBar) {
    let tail = stackEnd;
    if (plates.length) {
      over.push({ part: 'clip', x: round(stackEnd + 1.5), y: round(cy - 7), w: CLIP_W, h: 14 });
      tail = stackEnd + 1.5 + CLIP_W;
    }
    sleeveEnd = round(Math.max(inner + MIN_SLEEVE, tail + TAIL));
    over.push({ part: 'cap', x: sleeveEnd, y: round(cy - 5.5), w: CAP_W, h: 11 });
  } else {
    sleeveEnd = round(Math.max(inner + MIN_SLEEVE, stackEnd + LIP));
  }
  const width = round(sleeveEnd + (hasBar ? CAP_W : 0));

  under.push({ part: 'sleeve', x: inner, y: round(cy - 4.5), w: round(sleeveEnd - inner), h: 9 });
  if (hasBar) under.push({ part: 'collar', x: inner, y: round(cy - 9), w: 6, h: 18 });
  else under.push({ part: 'frame', x: 0, y: 2, w: 4, h: DRAW_H - 4 });

  return { width, height: DRAW_H, kind: hasBar ? 'bar' : 'peg', parts: [...under, ...drawn, ...over, ...plateLabels(drawn, width)] };
}

/* Every plate gets its number (Tim: "each plate actually has the label on it
 * (45, 35, 25, 10, 5, etc)"). In order of preference:
 *   across  — written normally on the plate, when it is wide enough;
 *   along   — written up the plate, when a crowded sleeve has thinned it but
 *             it is still tall and a figure's height wide;
 *   above / below — beside a plate too thin for either. Only small plates end
 *             up here, and a small plate is a short one, so the space above and
 *             below it is free. Consecutive ones alternate, so two thin plates
 *             side by side never write over each other.
 * A plate thinner than even that (a sleeve past ~900 lb in a phone's width) is
 * the one case left without a number, and the sentence still has it. */
function plateLabels(drawn, width) {
  const labels = [];
  let nextAbove = true;
  // Where a number written beside plate i may start, on one side, so that it
  // clears the bigger plate before it and any taller one after it; null if the
  // gap is too narrow. Centred on its plate when that already clears.
  const besideX = (i, tw, top, bottom) => {
    const p = drawn[i];
    const clashes = (q) => q && q.y < bottom && q.y + q.h > top;
    const lo = clashes(drawn[i - 1]) ? drawn[i - 1].x + drawn[i - 1].w + 0.5 : 0;
    const hi = clashes(drawn[i + 1]) ? drawn[i + 1].x - 0.5 : width;
    if (hi - lo < tw) return null;
    return Math.min(Math.max(lo, p.x + p.w / 2 - tw / 2), hi - tw);
  };
  for (let i = 0; i < drawn.length; i++) {
    const p = drawn[i];
    const text = fmtPlate(p.plate);
    const tw = labelWidth(text);
    const box = (place, x, y, w, h, tone) => labels.push({ part: 'label', plate: p.plate, text, place, tone,
      x: round(x), y: round(y), w: round(w), h: round(h) });
    const mid = p.x + p.w / 2;
    if (p.w >= tw + 2 && p.h >= LABEL_TALL + 4) {
      box('across', mid - tw / 2, DRAW_H / 2 - LABEL_TALL / 2, tw, LABEL_TALL, PLATE_TONE[p.colour]);
      continue;
    }
    if (p.w >= LABEL_TALL + 1 && p.h >= tw + 6) {
      box('along', mid - LABEL_TALL / 2, DRAW_H / 2 - tw / 2, LABEL_TALL, tw, PLATE_TONE[p.colour]);
      continue;
    }
    const aboveY = p.y - 2 - LABEL_TALL;
    const belowY = p.y + p.h + 2;
    const sides = [
      { place: 'above', y: aboveY, x: aboveY >= 0 ? besideX(i, tw, aboveY, aboveY + LABEL_TALL) : null },
      { place: 'below', y: belowY, x: belowY + LABEL_TALL <= DRAW_H ? besideX(i, tw, belowY, belowY + LABEL_TALL) : null },
    ].filter((s) => s.x !== null);
    if (!sides.length) continue;
    // Alternate, so two thin plates side by side write on opposite sides.
    const side = sides.find((s) => (s.place === 'above') === nextAbove) || sides[0];
    box(side.place, side.x, side.y, tw, LABEL_TALL, 'ink');
    nextAbove = side.place !== 'above';
  }
  return labels;
}
