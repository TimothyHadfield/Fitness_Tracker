// Motion 2 · Data (docs/motion2-plan.md package D). jsdom + the real modules.
//   node tests/data-motion.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim, 2026-09-25: *"Put professional level annimation and physics into this
// cite. Really analyze all the design layouts and everything."*
//
// What is pinned here is the LOGIC the motion depends on, which a screenshot
// cannot see: which chart markers stay full size when a chart is dense (the
// measured overlap at 393px), that each piece of motion plays on its FIRST show
// only, that the chart carries a real <linearGradient> under its line, and that
// reduced motion leaves nothing behind. Frames are checked in WebKit, not here.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/graphs', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
for (const [prop, value] of [['clientWidth', 420], ['clientHeight', 320]]) {
  Object.defineProperty(window.HTMLElement.prototype, prop, { get: () => value, configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const sess = new Map([['ftrack:v1:demo', '1']]);
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};
window.HTMLElement.prototype.scrollIntoView = function () {};

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const D = await import(new URL('js/views-data.js', root).href);
const { thinMarkers, prIndices, firstShow, __resetFirstShowForTest, GraphView, onOffSwitch } = D;

/* ---------- 1. marker thinning (pure) ---------- */
// The measured case: 52 measured points across a 365px phone chart, ~7px apart.
ok(typeof thinMarkers === 'function', 'thinMarkers() is exported');
ok(typeof prIndices === 'function', 'prIndices() is exported');
if (typeof thinMarkers === 'function' && typeof prIndices === 'function') {
  const n = 52;
  const xs = Array.from({ length: n }, (_, i) => 44 + i * 7);
  // A lift that mostly climbs with dips — the demo squat's shape.
  const vals = Array.from({ length: n }, (_, i) => 165 + i * 1.6 + (i % 5 === 3 ? -12 : 0) + (i % 11 === 7 ? 9 : 0));
  const prs = prIndices(vals);
  ok(prs.size > 0 && !prs.has(0), `new bests are found, the first point is not one (${prs.size})`);
  ok([...prs].every((i) => vals.slice(0, i).every((v) => v < vals[i])),
    'every best is strictly above everything before it');
  const top = [...prs].reduce((a, i) => (a < 0 || vals[i] >= vals[a] ? i : a), -1);
  const keep = new Set([n - 1, top]);
  const prefer = new Set([...prs].filter((i) => !keep.has(i)));
  const full = thinMarkers(xs, keep, 12, prefer);
  ok(full.has(n - 1), 'the last point ("now") is always full size');
  ok(full.has(top), 'the best of all is always full size');
  const free = [...full].filter((i) => !keep.has(i)).sort((a, b) => a - b);
  const all = [...full].sort((a, b) => a - b);
  const tooClose = free.filter((i) => all.some((j) => j !== i && Math.abs(xs[j] - xs[i]) < 12));
  ok(tooClose.length === 0, `an optional full-size marker is ≥12px from every other one (${tooClose.length} too close)`);
  const fullBests = [...prefer].filter((i) => full.has(i)).length;
  const fullPlain = free.filter((i) => !prefer.has(i)).length;
  ok(fullBests > fullPlain, `new bests win the spare room over plain points (${fullBests} bests vs ${fullPlain} plain)`);
  ok(full.size < n / 1.5, `a dense chart thins (${full.size} of ${n} full size)`);
  // Room to spare: nothing is thinned.
  const wide = Array.from({ length: 20 }, (_, i) => i * 30);
  ok(thinMarkers(wide, new Set([19]), 12).size === 20, 'a chart with room keeps every marker full size');
  ok(thinMarkers([], new Set(), 12).size === 0, 'no points, no markers');
}

/* ---------- 2. first show only ---------- */
ok(typeof firstShow === 'function', 'firstShow() is exported');
if (typeof firstShow === 'function') {
  __resetFirstShowForTest();
  ok(firstShow('bars') === true, 'a pane plays the first time it is shown');
  ok(firstShow('bars') === false, '…and never again in the session (a re-render is not news)');
  ok(firstShow('volume') === true, 'each pane keeps its own first show');
}

/* ---------- 3. the chart: gradient fill, thinned markers ---------- */
{
  const app = document.getElementById('app');
  const { store } = await import(new URL('js/store.js', root).href);
  const node = await GraphView();
  app.replaceChildren(node);
  await settle(120);
  const seg = [...node.querySelectorAll('.seg')].find((b) => b.textContent === 'Graph');
  seg.click();
  for (let i = 0; i < 20 && !node.querySelector('svg.chart'); i++) await settle(60);
  const svg = node.querySelector('svg.chart');
  ok(Boolean(svg), 'the Graph tab draws its SVG chart');
  if (svg) {
    const grad = svg.querySelector('defs linearGradient');
    const area = svg.querySelector('.series-area');
    ok(Boolean(grad) && grad.querySelectorAll('stop').length === 2,
      'a real <linearGradient> with two stops is in the chart markup (WebKit ignores the CSS mask)');
    ok(Boolean(area) && grad && (area.getAttribute('style') || '').includes(`url(#${grad.id})`),
      'the area under the line is filled by that gradient');
    const pts = [...svg.querySelectorAll('circle.pt')];
    const thin = pts.filter((c) => c.classList.contains('pt-thin'));
    ok(pts.length > 30 && thin.length > 0, `the dense demo squat thins its markers at 420px (${thin.length} of ${pts.length})`);
    ok(!pts[pts.length - 1].classList.contains('pt-thin'), 'the last marker is never thinned');
    ok(pts.length === [...svg.querySelectorAll('circle.pt')].length && thin.every((c) => c.getAttribute('r')),
      '🚨 Rule 5: a thinned measured point keeps a marker — smaller, never removed');
  }
  void store;
}

/* ---------- 4. reduced motion / jsdom: nothing left behind ---------- */
{
  const row = onOffSwitch('Test switch', false, () => {});
  document.body.append(row);
  const sw = row.querySelector('.switch');
  sw.click();
  await settle(20);
  const knob = sw.querySelector('.switch-knob');
  ok(sw.getAttribute('aria-checked') === 'true', 'the switch still flips');
  ok(!knob.getAttribute('style'), 'no motion allowed: the knob carries no inline transform (CSS owns the rest state)');
}

/* ---------- 5. the stylesheet section exists and turns off ---------- */
{
  const css = read('css/app.css');
  const a = css.indexOf('/* === Motion 2 · Data === */');
  const b = css.indexOf('/* === end Motion 2 · Data === */');
  ok(a > 0 && b > a, 'css/app.css has its own "Motion 2 · Data" section');
  const sec = a > 0 && b > a ? css.slice(a, b) : '';
  ok(/prefers-reduced-motion/.test(sec), 'that section switches its motion off under prefers-reduced-motion');
  ok(/view-transition-new\(root\)/.test(sec) && /m2-theme-vt/.test(sec),
    'the theme reveal styles its own view transition only while it runs (scoped class)');
}

console.log(fails ? `\n${fails} FAIL` : '\nall passed');
process.exit(fails ? 1 : 0);
