// plateDrawing() — the picture of one sleeve that replaced the plate sentence.
//
//   node tests/plates-visual.test.mjs      (no dependencies: pure geometry)
//
// 2026-09-26, Tim: *"instead of having the measurement below the weight be
// bar+10,10 each side, you should just have a visual of one side of the bar
// that has 2 10 plates visually on it, and whatnot, depending on the excersize.
// Color them differently aswell."*
//
// The arithmetic is plateLoad()'s and is pinned in data-layer.test.mjs; the
// wiring (the stepper draws it, keeps the sentence as its label) is in
// render.test.mjs. What is pinned HERE is that the drawing tells the same story
// as the sentence and still fits the slot:
//
//   · one plate drawn per plate in the list, in the list's order, biggest
//     nearest the collar;
//   · a bigger plate is never drawn smaller, and every denomination has its
//     own colour in each unit;
//   · a barbell has a bar, a machine or a landmine does not;
//   · no drawing whenever there is no sentence — the stepper's old hint stays;
//   · a silly-heavy bar still fits the width instead of wrapping.
import { plateLoad, plateLabel, plateDrawing, PLATE_COLOURS, LB_INVENTORY, KG_INVENTORY }
  from '../js/plates.js';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
}

const LB = { inventory: LB_INVENTORY };
const KG = { inventory: KG_INVENTORY };
const KG_TO_LB = (kg) => kg * 2.2046226218;
const platesOf = (d) => d.parts.filter((p) => p.part === 'plate');
const has = (d, part) => d.parts.some((p) => p.part === part);

/* ---- one plate per plate in the list, biggest nearest the collar ---- */
for (const [lb, opts, why] of [
  [135, LB, '135 lb bench'], [225, LB, '225 lb'], [315, LB, '315 lb'], [405, LB, '405 lb'],
  [280, LB, '280 lb (45, 45, 25, 2.5)'], [270, LB, '270 lb (45, 45, 10, 10, 2.5)'],
  [KG_TO_LB(85), KG, '85 kg (25, 5, 2.5)'],
  [KG_TO_LB(177.5), KG, '177.5 kg (25, 25, 25, 2.5, 1.25)'],
]) {
  const load = plateLoad(lb, opts);
  const d = plateDrawing(load);
  ok(Boolean(d), `${why}: there is a drawing`);
  if (!d) continue;
  const ps = platesOf(d);
  ok(ps.length === load.each.length && ps.every((p, i) => p.plate === load.each[i]),
     `${why}: it draws exactly the plates the sentence lists, in order (${ps.map((p) => p.plate)} vs ${load.each})`);
  ok(ps.every((p, i) => i === 0 || p.x > ps[i - 1].x + ps[i - 1].w - 1e-9),
     `${why}: left to right from the collar, never overlapping`);
  ok(ps.every((p, i) => i === 0 || p.h <= ps[i - 1].h),
     `${why}: a lighter plate is never drawn taller than the one inside it`);
  ok(has(d, 'shaft') && has(d, 'collar') && has(d, 'sleeve') && !has(d, 'frame'),
     `${why}: a barbell shows a bar stub, a collar and the sleeve`);
  const collar = d.parts.find((p) => p.part === 'collar');
  ok(ps[0].x >= collar.x + collar.w, `${why}: the first plate sits outside the collar`);
  const sleeve = d.parts.find((p) => p.part === 'sleeve');
  ok(ps[ps.length - 1].x + ps[ps.length - 1].w <= sleeve.x + sleeve.w,
     `${why}: every plate is ON the sleeve`);
  ok(d.parts.every((p) => p.x >= 0 && p.y >= 0 && p.x + p.w <= d.width + 1e-9 && p.y + p.h <= d.height + 1e-9),
     `${why}: nothing is drawn outside its own box`);
}

/* ---- sizes follow the real plates ---- */
{
  // plateLoad()'s exact shape, hand-built: greedy never puts every kg plate on
  // one sleeve (78.75 a side is 25, 25, 25, 2.5, 1.25), and this compares them all.
  const allKg = { unit: 'kg', bar: 20, points: 2, each: [25, 20, 15, 10, 5, 2.5, 1.25],
    exact: true, short: 0, loaded: 177.5, belowBar: false };
  const d = plateDrawing(allKg);
  const h = Object.fromEntries(platesOf(d).map((p) => [p.plate, p.h]));
  ok(h[25] === d.height && h[20] === d.height,
     `the 25 and 20 kg are full height, as real 450 mm plates are (${h[25]}, ${h[20]} of ${d.height})`);
  ok(h[20] > h[15] && h[15] > h[10] && h[10] > h[5] && h[5] > h[2.5] && h[2.5] > h[1.25],
     `and from 15 kg down every plate is smaller than the last (${JSON.stringify(h)})`);
  const w = Object.fromEntries(platesOf(d).map((p) => [p.plate, p.w]));
  ok(w[25] > w[20] && w[20] > w[10] && w[10] > w[1.25], `and heavier plates are thicker (${JSON.stringify(w)})`);
}

/* ---- the colours: one per denomination, the documented convention ---- */
{
  const kg = PLATE_COLOURS.kg, lb = PLATE_COLOURS.lbs;
  ok(kg[25] === 'red' && kg[20] === 'blue' && kg[15] === 'yellow' && kg[10] === 'green'
     && kg[5] === 'white' && kg[2.5] === 'black' && kg[1.25] === 'chrome',
     'kg follows the calibrated-plate colours: 25 red, 20 blue, 15 yellow, 10 green, 5 white, 2.5 black, 1.25 chrome');
  ok(lb[55] === 'red' && lb[45] === 'blue' && lb[35] === 'yellow' && lb[25] === 'green'
     && lb[10] === 'white' && lb[5] === 'black' && lb[2.5] === 'chrome',
     'lb plates take the colour of the kg plate closest in weight: 55 red, 45 blue, 35 yellow, 25 green, 10 white, 5 black, 2.5 chrome');
  for (const [inv, map] of [[LB_INVENTORY, lb], [KG_INVENTORY, kg]]) {
    const cs = inv.plates.map((p) => map[p]);
    ok(cs.every(Boolean) && new Set(cs).size === cs.length,
       `every ${inv.unit} plate the app can recommend has a colour of its own (${cs})`);
  }
  const d = plateDrawing(plateLoad(280, LB));
  ok(platesOf(d).map((p) => p.colour).join() === 'blue,blue,green,chrome',
     `280 lb draws blue, blue, green, chrome (${platesOf(d).map((p) => p.colour)})`);
}

/* ---- depending on the exercise ---- */
{
  const sled = plateDrawing(plateLoad(270, { ...LB, bar: false, points: 2 }));
  ok(Boolean(sled) && platesOf(sled).length === 3 && has(sled, 'frame') && has(sled, 'sleeve')
     && !has(sled, 'shaft') && !has(sled, 'collar'),
     'a plate-loaded sled draws its plates on a peg, with NO bar');
  const tbar = plateDrawing(plateLoad(135, { ...LB, bar: false, points: 1 }));
  ok(Boolean(tbar) && platesOf(tbar).length === 3 && !has(tbar, 'shaft'),
     'a T-bar / landmine ("on one end") draws three 45s on a post, with NO bar');
  const empty = plateDrawing(plateLoad(45, LB));
  ok(Boolean(empty) && platesOf(empty).length === 0 && has(empty, 'shaft') && has(empty, 'sleeve'),
     '"bar only" is the empty sleeve');
  const kgEmpty = plateDrawing(plateLoad(KG_TO_LB(20), KG));
  ok(Boolean(kgEmpty) && platesOf(kgEmpty).length === 0, 'and so is an empty 20 kg bar');
}

/* ---- 🛑 no sentence, no drawing ---- */
for (const [load, why] of [
  [plateLoad(271, LB), '271 lb (no plates make it)'],
  [plateLoad(30, LB), '30 lb (below the bar)'],
  [plateLoad(0, { ...LB, bar: false }), 'an empty machine'],
  [null, 'no load at all'],
]) {
  ok(plateLabel(load) === null && plateDrawing(load) === null,
     `${why}: no sentence and no drawing, so the stepper keeps its steps hint`);
}

/* ---- a silly-heavy bar still fits: thinner plates, never a wrap ---- */
for (const [lb, maxWidth, why] of [[900, 160, '900 lb deadlift (12 plates a side)'],
  [1500, 160, '1500 lb (18 plates a side)'], [1500, 120, '1500 lb in a 120px slot']]) {
  const load = plateLoad(lb, LB);
  const d = plateDrawing(load, { maxWidth });
  ok(Boolean(d) && d.width <= maxWidth && platesOf(d).length === load.each.length,
     `${why}: all ${load.each.length} plates drawn in ${d && d.width.toFixed(1)}px ≤ ${maxWidth}px`);
  ok(Boolean(d) && platesOf(d).every((p) => p.w >= 1),
     `${why}: and each is still at least a pixel thick`);
}
{
  const few = plateDrawing(plateLoad(135, LB));
  const many = plateDrawing(plateLoad(1500, LB), { maxWidth: 120 });
  ok(platesOf(many)[0].w < platesOf(few)[0].w,
     'a crowded sleeve draws its 45s thinner than an uncrowded one — the width gives, not the line');
}

/* ---- 🆕 2026-09-27 every plate carries its number, and the bar has an END ----
 * Tim: *"the plate visual … is colored but extreamly unclear. Could you
 * instead make it so that it takes up some more space and each plate actually
 * has the label on it (45, 35, 25, 10, 5, etc)? Also make the design more
 * clear its the end of a plate."* */
{
  const labelsOf = (d) => d.parts.filter((p) => p.part === 'label');
  const overlap = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
  const inside = (a, b) => a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9;
  const CASES = [
    [135, LB, '135 lb'], [225, LB, '225 lb'], [315, LB, '315 lb'], [405, LB, '405 lb'],
    [495, LB, '495 lb'], [600, LB, '600 lb (45 x6, 5, 2.5)'], [280, LB, '280 lb (45, 45, 25, 2.5)'],
    [270, LB, '270 lb (45, 45, 10, 10, 2.5)'], [255, LB, '255 lb (45, 45, 10, 5)'],
    [900, LB, '900 lb (12 plates a side)'],
    [270, { ...LB, bar: false }, 'a 270 lb sled'], [135, { ...LB, bar: false, points: 1 }, 'a 135 lb T-bar'],
    [KG_TO_LB(85), KG, '85 kg (25, 5, 2.5)'], [KG_TO_LB(177.5), KG, '177.5 kg (25, 25, 25, 2.5, 1.25)'],
    [KG_TO_LB(20 + 2 * 78.75), KG, '177.5 kg again'], [KG_TO_LB(20 + 2 * (20 + 15 + 10)), KG, '110 kg (20, 15, 10)'],
  ];
  for (const [lb, opts, why] of CASES) {
    const load = plateLoad(lb, opts);
    const d = plateDrawing(load);
    const ps = platesOf(d);
    const ls = labelsOf(d);
    ok(d.height >= 40, `${why}: the drawing takes more room than the old 22px line (${d.height}px)`);
    ok(ls.length === ps.length && ls.every((l, i) => l.plate === ps[i].plate && Number(l.text) === ps[i].plate),
       `${why}: every plate has its own number, in order (${ls.map((l) => l.text)} for ${ps.map((p) => p.plate)})`);
    ok(ls.every((l, i) => (l.place === 'across' || l.place === 'along') ? inside(l, ps[i]) : !overlap(l, ps[i])),
       `${why}: a number is either written on its plate (inside it) or beside it (clear of it) (${ls.map((l) => l.place)})`);
    ok(ls.every((a, i) => ls.every((b, j) => i === j || !overlap(a, b))),
       `${why}: no two numbers overlap`);
    ok(ls.every((l, i) => (l.place === 'above' || l.place === 'below')
         ? l.tone === 'ink'
         : l.tone === ({ red: 'light', blue: 'light', black: 'light' }[ps[i].colour] || 'dark')),
       `${why}: white on red/blue/black, dark on yellow/green/white/chrome, the page's ink beside a plate`);
  }
  // The common lifts get their numbers written straight across the plate.
  for (const [lb, why] of [[135, '135'], [225, '225'], [315, '315'], [405, '405'], [255, '255 (…10, 5)']]) {
    const ls = labelsOf(plateDrawing(plateLoad(lb, LB)));
    ok(ls.every((l) => l.place === 'across'), `${why} lb: every number reads across its plate (${ls.map((l) => l.place)})`);
  }
  {
    const ls = labelsOf(plateDrawing(plateLoad(280, LB)));
    ok(ls[3].place === 'above' || ls[3].place === 'below',
       `a 2.5 is too thin to write on, so its number sits beside it (${ls[3].place})`);
  }
  {
    // Two thin plates side by side (kg 2.5 then 1.25) alternate above / below.
    const ls = labelsOf(plateDrawing(plateLoad(KG_TO_LB(177.5), KG)));
    ok(ls[3].place !== ls[4].place && ['above', 'below'].includes(ls[3].place) && ['above', 'below'].includes(ls[4].place),
       `the kg 2.5 and 1.25 write their numbers on opposite sides (${ls[3].place}, ${ls[4].place})`);
  }
  // The end of the bar: clip after the last plate, bare sleeve past it, a cap.
  for (const [lb, why] of [[135, '135 lb'], [405, '405 lb'], [600, '600 lb']]) {
    const d = plateDrawing(plateLoad(lb, LB));
    const ps = platesOf(d);
    const last = ps[ps.length - 1];
    const clip = d.parts.find((p) => p.part === 'clip');
    const cap = d.parts.find((p) => p.part === 'cap');
    const sleeve = d.parts.find((p) => p.part === 'sleeve');
    ok(clip && clip.x >= last.x + last.w && cap && sleeve.x + sleeve.w > clip.x + clip.w + 4
       && cap.x >= sleeve.x + sleeve.w - 1e-9 && Math.abs(cap.x + cap.w - d.width) < 1e-6,
       `${why}: a clip holds the plates, the bare sleeve runs on past it, and a cap ends the bar`);
  }
  {
    const sled = plateDrawing(plateLoad(270, { ...LB, bar: false }));
    ok(!sled.parts.some((p) => p.part === 'clip' || p.part === 'cap'),
       'a machine\'s horn has no barbell clip or cap — the peg drawing is unchanged in kind');
  }
  // 405–600 lb fits a phone's slot (~166px at 375–393 wide) with nothing squeezed off.
  for (const lb of [405, 495, 600]) {
    const d = plateDrawing(plateLoad(lb, LB));
    ok(d.width <= 166, `${lb} lb fits the 166px slot (${d.width}px)`);
  }
}

/* ---- and the sentence is untouched (it is the drawing's label now) ---- */
ok(plateLabel(plateLoad(275, LB)) === 'bar + 45, 45, 25 each side', 'plateLabel still reads "bar + 45, 45, 25 each side"');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
