// The Auto-guide's big bar (2026-09-27).
//
//   node tests/bar-view.test.mjs      (needs jsdom)
//
// Tim: *"For the Auto-guide, show a much larger and more detailed display of
// the bar with weights on it on both sides rather than the tiny display on the
// main screen. also annimate the plates moving on and off the bar as you
// change the weight."*
//
// Part 1 pins the pure layout (js/plates.js `barLayout`): both sides mirrored,
// heaviest at the collars, real diameters, a peg for machines, a fixed box.
// Part 2 pins the diff (`plateDiff`): unchanged plates are kept, not redrawn.
// Part 3 drives the view (js/bar-view.js): the sentence as its label, plates
// sliding on from the sleeve end and off it, and reduced motion = instant.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;

const BASE = new URL('../js/', import.meta.url).href;
const P = await import(BASE + 'plates.js');
const S = await import(BASE + 'spring.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;

if (typeof P.barLayout !== 'function' || typeof P.plateDiff !== 'function') {
  ok(false, 'plates.js exports barLayout() and plateDiff()');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

/* ============ 1. the layout (pure) ============ */
const lb = (total, o = {}) => P.plateLoad(total, { inventory: P.LB_INVENTORY, ...o });
const kg = (totalKg, o = {}) => P.plateLoad(totalKg * P.KG_INVENTORY.lbPer, { inventory: P.KG_INVENTORY, ...o });

{
  const L = P.barLayout(lb(275));
  ok(L && L.kind === 'bar', '275 lb on a barbell: a two-sided bar');
  ok(L.label === 'bar + 45, 45, 25 each side', `its label is the plate sentence ("${L.label}")`);
  const R = L.plates.filter((p) => p.side === 'R');
  const Lt = L.plates.filter((p) => p.side === 'L');
  ok(R.length === 3 && Lt.length === 3, 'three plates on EACH side');
  ok(R.map((p) => p.plate).join() === '45,45,25' && Lt.map((p) => p.plate).join() === '45,45,25',
     'each side lists heaviest first (slot 0 = at the collar)');
  // Mirrored: a left plate sits where the right one would, reflected about the centre.
  const mirrored = R.every((p, i) => near(Lt[i].x, L.width - p.x - p.w) && Lt[i].w === p.w && Lt[i].y === p.y && Lt[i].h === p.h);
  ok(mirrored, 'the left side is the right side mirrored about the centre');
  // Heaviest nearest the collars: right side goes outward (x rising), left inward (x falling).
  ok(R[0].x < R[1].x && R[1].x < R[2].x && Lt[0].x > Lt[1].x && Lt[1].x > Lt[2].x,
     'plates run from the collar outward on both sides');
  const collars = L.parts.filter((p) => p.part === 'collar');
  ok(collars.length === 2, 'two collars');
  const rc = collars.reduce((a, b) => (a.x > b.x ? a : b));
  ok(R[0].x >= rc.x + rc.w, 'the first right plate sits against the right collar, not on it');
  for (const part of ['shaft', 'knurl', 'sleeve', 'cap']) {
    ok(L.parts.some((p) => p.part === part), `the whole bar is drawn: ${part}`);
  }
  ok(L.parts.filter((p) => p.part === 'sleeve').length === 2 && L.parts.filter((p) => p.part === 'cap').length === 2,
     'both sleeves and both end caps');
  ok(L.clips.length === 2 && L.clips.every((c) => c.w > 0), 'a clip on each side');
  const rClip = L.clips.find((c) => c.side === 'R');
  ok(rClip.x >= R[2].x + R[2].w, 'the right clip is outside the last plate');
  // Real diameters: a 45 (450 mm) is taller than a 25 (325 mm) by that ratio.
  ok(near(R[2].h / R[0].h, 325 / 450, 0.01), `diameters to scale: 25/45 = ${(R[2].h / R[0].h).toFixed(3)} ≈ ${(325 / 450).toFixed(3)}`);
  ok(R[0].w > R[2].w, 'a 45 is thicker than a 25');
  // Plates are centred on the bar's axis.
  ok(R.every((p) => near(p.y + p.h / 2, L.height / 2, 0.05)), 'every plate is centred on the bar');
  // Every plate has its number.
  ok(L.plates.every((p) => p.label && p.label.text === String(p.plate)), 'every plate carries its number');
  ok(L.plates.every((p) => p.x >= 0 && p.x + p.w <= L.width), 'everything fits in the box');
  // Keys: position + denomination, per side.
  ok(R.map((p) => p.key).join() === 'R0:45,R1:45,R2:25' && Lt.map((p) => p.key).join() === 'L0:45,L1:45,L2:25',
     `plates are keyed by side, slot and denomination (${R.map((p) => p.key).join()})`);
  // Enter / leave points: beyond the sleeve ends.
  const caps = L.parts.filter((p) => p.part === 'cap');
  const rightEnd = Math.max(...caps.map((c) => c.x + c.w));
  const leftEnd = Math.min(...caps.map((c) => c.x));
  ok(R.every((p) => p.offX >= rightEnd) && Lt.every((p) => p.offX + p.w <= leftEnd),
     'a plate enters and leaves beyond its own sleeve end');
}

{
  // The box never changes size: that is what keeps the screen from jumping.
  const a = P.barLayout(lb(45)), b = P.barLayout(lb(495)), c = P.barLayout(lb(1000));
  ok(a.width === b.width && b.width === c.width && a.height === b.height && b.height === c.height,
     `one box size for every weight (${a.width}×${a.height})`);
  ok(a.label === 'bar only' && a.plates.length === 0 && a.clips.length === 0, 'an empty bar: no plates, no clips');
  // A crowded sleeve thins its plates rather than running off the end.
  const C = c.plates.filter((p) => p.side === 'R');
  const rcap = c.parts.filter((p) => p.part === 'cap').reduce((x, y) => (x.x > y.x ? x : y));
  ok(C.length > 5 && C[C.length - 1].x + C[C.length - 1].w <= rcap.x, `1000 lb: ${C.length} plates a side, all on the sleeve`);
  // Unloadable: the frame, no plates, no label (the stepper hint says the rest).
  const u = P.barLayout(lb(137));
  ok(u && u.label === null && u.plates.length === 0 && u.parts.some((p) => p.part === 'shaft'),
     'a weight no plates make: the bare bar, no plates, no label');
  ok(P.barLayout(lb(20)).label === null, 'below the empty bar: no label');
}

{
  // kg: the kilo inventory's colours and small change plates.
  const K = P.barLayout(kg(142.5));
  const R = K.plates.filter((p) => p.side === 'R');
  ok(R.map((p) => p.plate).join() === '25,25,10,1.25', `142.5 kg: 25, 25, 10, 1.25 a side (${R.map((p) => p.plate).join()})`);
  ok(R.map((p) => p.colour).join() === 'red,red,green,chrome', 'IPF colours (PLATE_COLOURS)');
  ok(R[3].w < R[2].w && R[3].h < R[2].h, 'the 1.25 is a small, thin change plate');
}

{
  // Machines / landmines: a bigger peg, not a two-sided bar.
  const peg = P.barLayout(lb(90, { bar: false, points: 1 }));
  ok(peg && peg.kind === 'peg', 'a landmine / T-bar: a peg');
  ok(peg.plates.every((p) => p.side === 'R') && peg.plates.map((p) => p.plate).join() === '45,45',
     'one horn, loaded from the post outward');
  ok(peg.parts.some((p) => p.part === 'frame') && !peg.parts.some((p) => p.part === 'collar') && peg.clips.length === 0,
     'post + horn; no collar, no clip');
  ok(peg.label === '45, 45 on one end', `its label: "${peg.label}"`);
  const sled = P.barLayout(lb(180, { bar: false, points: 2 }));
  ok(sled.kind === 'peg' && sled.label === '45, 45 each side', 'a sled: the same peg, labelled "each side"');
  ok(peg.width === P.barLayout(lb(45)).width && peg.height === P.barLayout(lb(45)).height, 'the peg uses the same box');
  ok(P.barLayout(lb(0, { bar: false, points: 2 })) && P.barLayout(lb(0, { bar: false, points: 2 })).label === null,
     'an empty machine: the frame and no label');
}

{
  // Dumbbells and anything without plates: nothing to draw.
  ok(P.barLayout(null) === null, 'no load (a dumbbell): null');
}

{
  // plateDrawing and plateLabel are untouched by any of this.
  const d = P.plateDrawing(lb(275));
  ok(d && d.height === 48 && d.kind === 'bar', 'the small drawing is still 48 px, one sleeve');
}

/* ============ 2. the diff (pure) ============ */
{
  const keys = (L) => L.plates.map((p) => p.key);
  const a = keys(P.barLayout(lb(225))), b = keys(P.barLayout(lb(235)));
  let d = P.plateDiff(a, b);
  ok(d.keep.length === 4 && [...d.add].sort().join() === 'L2:5,R2:5' && d.remove.length === 0,
     `225 → 235: keep the four 45s, add a 5 on each side (${JSON.stringify(d)})`);
  d = P.plateDiff(b, keys(P.barLayout(lb(245))));
  ok(d.keep.length === 4 && d.remove.sort().join() === 'L2:5,R2:5' && d.add.sort().join() === 'L2:10,R2:10',
     '235 → 245: the 5s come off, 10s go on, the 45s stay');
  d = P.plateDiff(keys(P.barLayout(lb(315))), keys(P.barLayout(lb(135))));
  ok(d.keep.sort().join() === 'L0:45,R0:45' && d.remove.length === 4 && d.add.length === 0, '315 → 135: two plates off each side');
  d = P.plateDiff([], keys(P.barLayout(lb(135))));
  ok(d.add.length === 2 && d.keep.length === 0, 'from nothing: everything is added');
}

/* ============ 3. the view (DOM) ============ */
const V = await import(BASE + 'bar-view.js');
const plateEls = (v) => [...v.node.querySelectorAll('.bv-plate')];
const liveKeys = (v) => plateEls(v).filter((g) => !g.classList.contains('is-leaving')).map((g) => g.dataset.key).sort();
const tx = (g) => Number((/translate\(([-\d.]+)/.exec(g.getAttribute('transform') || '') || [])[1]);

{
  S.__setReducedMotionForTest(true);
  const v = V.barView();
  v.update(lb(275));
  ok(v.node.getAttribute('role') === 'img' && v.node.getAttribute('aria-label') === 'bar + 45, 45, 25 each side',
     'the drawing is labelled with the plate sentence');
  ok(!v.node.hidden && v.node.querySelectorAll('svg').length === 1, 'one svg');
  ok(plateEls(v).length === 6, 'six plates drawn');
  ok(v.node.querySelectorAll('.bv-plate text').length === 6, 'each with its number');
  const before = new Map(plateEls(v).map((g) => [g.dataset.key, g]));
  v.update(lb(235));
  ok(plateEls(v).length === 6 && liveKeys(v).join() === 'L0:45,L1:45,L2:5,R0:45,R1:45,R2:5',
     'reduced motion: 275 → 235 swaps instantly (no leaving plates linger)');
  ok(before.get('R0:45') === v.node.querySelector('[data-key="R0:45"]'), 'an unchanged plate is the SAME element (not re-drawn)');
  const r2 = v.node.querySelector('[data-key="R2:5"]');
  ok(r2.getAttribute('opacity') === null || r2.getAttribute('opacity') === '1', 'a new plate is fully there at once');
  v.update(lb(137));
  ok(plateEls(v).length === 0 && !v.node.hasAttribute('aria-label') && v.node.classList.contains('is-empty'),
     'a weight no plates make: the bare bar, dimmed, no label');
  v.update(null);
  ok(v.node.hidden, 'no plates for this lift (a dumbbell): the drawing is hidden');
  v.update(lb(90, { bar: false, points: 1 }));
  ok(!v.node.hidden && v.node.querySelector('svg').classList.contains('is-peg'), 'a landmine: the peg drawing');
  S.__setReducedMotionForTest(null);
}

{
  // With motion: a plate slides on from the sleeve end and one slides off it.
  S.__setReducedMotionForTest(false);
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 8);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  const v = V.barView();
  document.body.appendChild(v.node);
  v.update(lb(225));
  await new Promise((r) => setTimeout(r, 450));
  const rest = tx(v.node.querySelector('[data-key="R1:45"]'));
  v.update(lb(235));
  const added = v.node.querySelector('[data-key="R2:5"]');
  const layout = P.barLayout(lb(235));
  const target = layout.plates.find((p) => p.key === 'R2:5');
  const x0 = added ? tx(added) : NaN;
  ok(added && x0 >= target.offX - 0.5 && x0 > target.x + 5 && Number(added.getAttribute('opacity')) < 0.5,
     `a new plate starts beyond the sleeve end, faded (x ${x0.toFixed(1)} vs slot ${target.x}, opacity ${added && added.getAttribute('opacity')})`);
  const leftAdded = v.node.querySelector('[data-key="L2:5"]');
  const lt = layout.plates.find((p) => p.key === 'L2:5');
  ok(leftAdded && tx(leftAdded) < lt.x - 5, 'and on the left it comes in from the left end (symmetric)');
  await new Promise((r) => setTimeout(r, 60));
  const mid = tx(added);
  ok(mid < x0 - 0.5 && mid > target.x + 0.5, `mid-slide at ~60 ms: between the end (${x0.toFixed(1)}) and the slot (${target.x}) at ${mid.toFixed(1)}`);
  await new Promise((r) => setTimeout(r, 450));
  ok(near(tx(added), target.x, 0.3) && (added.getAttribute('opacity') === null || Number(added.getAttribute('opacity')) > 0.99),
     'lands in its slot, fully opaque, within ~500 ms');
  ok(near(tx(v.node.querySelector('[data-key="R1:45"]')), rest, 0.01), 'the 45s never moved');
  const t0 = performance.now();
  v.update(lb(225));
  const leaving = v.node.querySelector('[data-key="R2:5"]');
  ok(leaving && leaving.classList.contains('is-leaving') && leaving.isConnected, 'the 5 is leaving, not snatched away');
  await new Promise((r) => setTimeout(r, 60));
  const midOff = tx(leaving), midOp = Number(leaving.getAttribute('opacity'));
  ok(leaving.isConnected && midOff > target.x + 0.5 && midOff < target.offX && midOp > 0 && midOp < 1,
     `~60 ms later it is on its way off: x ${midOff.toFixed(1)}, opacity ${midOp}`);
  let gone = -1;
  for (let i = 0; i < 80 && gone < 0; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (!leaving.isConnected) gone = performance.now() - t0;
  }
  ok(gone > 100 && gone < 600, `it slides off and is removed (${Math.round(gone)} ms, timer-driven jsdom)`);
  S.__setReducedMotionForTest(null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
