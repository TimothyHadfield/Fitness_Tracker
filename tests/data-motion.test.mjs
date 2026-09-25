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
    const hid = pts.filter((c) => c.classList.contains('pt-hid'));
    const shown = pts.filter((c) => !c.classList.contains('pt-hid'));
    ok(pts.length > 30 && hid.length > 0, `the dense demo squat hides crowded markers at 420px (${hid.length} of ${pts.length})`);
    ok(!pts[pts.length - 1].classList.contains('pt-hid'), 'the last marker is never hidden');
    // 2026-09-25 review: mixed sizes still overlapped in clusters. Every drawn
    // marker is now one size and ≥12px (centre to centre) from every other.
    const c = (n) => ({ x: +n.getAttribute('cx'), y: +n.getAttribute('cy') });
    let touching = 0;
    shown.forEach((a, i) => shown.slice(i + 1).forEach((b) => {
      if (Math.hypot(c(a).x - c(b).x, c(a).y - c(b).y) < 12) touching++;
    }));
    ok(touching === 0, `no two drawn markers overlap (${touching} pairs under 12px)`);
    ok(hid.every((h) => shown.some((s) => Math.hypot(c(h).x - c(s).x, c(h).y - c(s).y) < 12)),
      'every hidden marker sits under a drawn one (a cluster still reads as measured)');
    // The last point was centred ON the plot's right edge, half outside it.
    const grid = svg.querySelector('.grid-line');
    const right = +grid.getAttribute('x2'), left = +grid.getAttribute('x1');
    const lastC = c(pts[pts.length - 1]), firstC = c(pts[0]);
    ok(lastC.x + 7 <= right && firstC.x - 5.25 >= left,
      `the end markers sit wholly inside the plot (last ${lastC.x} + 7 ≤ ${right}, first ${firstC.x} ≥ ${left} + 5.25)`);
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

/* ---------- 6. review 2026-09-25: switch, best-lift line, superset line ---------- */
{
  const src = read('js/views-data.js');
  const m = src.match(/function slideIn[\s\S]*?from: \{ x: 24 \* dir, opacity: ([\d.]+) \}/);
  ok(Boolean(m) && Number(m[1]) >= 0.6,
    `a sub-tab switch starts its new pane visible (opacity ${m && m[1]}, ≥.6) — from 0 its first frame was an empty screen`);
  const PS = await import(new URL('js/profile-shape.js', root).href);
  const row = PS.liftRow({ name: 'Barbell Curl', sub: 'Hammer Curl 35 lbs/side × 12 · Sep 12', oneRM: 120, shown: 122,
    days: 0, level: null, percentile: null, band: { name: 'Good' } });
  const bits = [...row.querySelectorAll('.me-best-bit')].map((b) => b.textContent);
  ok(bits.length === 2 && bits[1] === 'Sep 12',
    `a friend's published line breaks at its " · " seams like our own rows (${JSON.stringify(bits)})`);
  const css = read('css/app.css');
  const lay = css.slice(css.indexOf('/* === Motion 2 · Layout === */'), css.indexOf('/* === end Motion 2 · Layout === */'));
  ok(/\.me-best-bit\s*\{[^}]*max-width:\s*100%/.test(lay),
    'a sub-line piece is capped at its column, so a long one cannot run under the numbers');
  ok(/@media \(min-width: 860px\)\s*\{\s*\.builder-group > \.list \{ margin-inline: 0; \}/.test(lay),
    'on a laptop the superset\'s list keeps inside its line (it bled 22px through it)');

  // Profile, laptop: Months landed by scrolling the WHOLE pane (left column
  // 6,000px out of view). It now scrolls the nearest scroller.
  ok(typeof D.scrollerOf === 'function', 'views-data.js exports scrollerOf()');
  if (typeof D.scrollerOf === 'function') {
    const pane = document.createElement('div'); pane.className = 'pane-scroll';
    const col = document.createElement('div'); const host = document.createElement('div');
    col.append(host); pane.append(col); document.body.append(pane);
    ok(D.scrollerOf(host) === pane, 'a host that does not scroll lands the pane, as before (phone, Data, Calendar)');
    host.style.overflowY = 'auto';
    ok(D.scrollerOf(host) === host, 'a host that scrolls on its own lands itself, and the page stays put');
    pane.remove();
  }
  const land = src.slice(src.indexOf('function landOnCurrentMonth('), src.indexOf('export function scrollerOf('));
  ok(/const pane = scrollerOf\(container\)/.test(land), 'landOnCurrentMonth() lands on the nearest scroller');
  ok(/@media \(min-width: 1200px\)[\s\S]*?\.me-cal-host\s*\{[^}]*overflow-y:\s*auto/.test(lay),
    'on the two-column Profile the calendar column is its own scroller');
}

console.log(fails ? `\n${fails} FAIL` : '\nall passed');
process.exit(fails ? 1 : 0);
