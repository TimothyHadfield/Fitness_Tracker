// Layout pass 2 (2026-09-25) — the parts of it a screenshot cannot pin.
//   node tests/laptop-layout.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: *"Really analyze all the design layouts and everything... Impress me."*
//
// 1. The Graph's date labels are evenly spaced in TIME, not every Nth session
//    (they bunched where sessions did).
// 2. The Graph's Start / Now / Change figures are static — never counted up
//    from 0 ("Start 0 → 165" read as a glitch on a phone).
// 3. Data › Muscles no longer recomputes every rating on every tap: the last
//    answer is kept while nothing it came from has changed, handed out as a
//    copy, and a write makes it recompute.
// Layout itself (columns, widths, Years cells) is measured in WebKit and
// Chrome, not here: jsdom lays nothing out.
import { JSDOM } from 'jsdom';

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

const D = await import(new URL('js/views-data.js', root).href);
const S = await import(new URL('js/store.js', root).href);

/* ---------- 1 + 2. the Graph: date labels and static figures ---------- */
{
  const app = document.getElementById('app');
  const node = await D.GraphView();
  app.replaceChildren(node);
  await settle(120);
  [...node.querySelectorAll('.seg')].find((b) => b.textContent === 'Graph').click();
  for (let i = 0; i < 20 && !node.querySelector('svg.chart'); i++) await settle(60);
  const svg = node.querySelector('svg.chart');
  ok(Boolean(svg), 'the Graph tab draws its chart (demo squat, 420px)');
  if (svg) {
    const dates = [...svg.querySelectorAll('text.axis-text')]
      .filter((t) => !t.classList.contains('axis-title') && !/^-?[\d.,]+$/.test(t.textContent.trim()));
    const xs = dates.map((t) => +t.getAttribute('x'));
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    const spread = gaps.length ? Math.max(...gaps) - Math.min(...gaps) : Infinity;
    ok(dates.length >= 3, `the chart has at least three date labels (${dates.map((t) => t.textContent).join(' · ')})`);
    // ≤2px: each label is rounded to its nearest day, a fraction of a pixel here.
    ok(spread <= 2, `the date labels are evenly spaced along the time axis (gaps ${gaps.map((g) => g.toFixed(1)).join(', ')})`);
    ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), 'and run left to right with none on top of another');
  }
  const values = [...node.querySelectorAll('.summary-grid .stat-value')];
  ok(values.length === 4, `the summary shows its four figures (${values.map((v) => v.textContent).join(' | ')})`);
  ok(values.length > 0 && values.every((v) => v.dataset.mSeen === '1'),
    'the summary figures are marked as handled, so the arrival pass never counts them up from 0');
  ok(values.length > 0 && values.every((v) => /\d/.test(v.textContent) && !/^\s*\+?\s*0(\.0)?%?\s*$/.test(v.textContent)),
    'and they read their real values straight away');
}

/* ---------- 3. muscleStrength keeps its last answer, safely ---------- */
{
  S.clearReadCache();
  await S.muscleStrength();                     // warms the read cache
  let t = performance.now();
  const a = await S.muscleStrength();
  const cold = performance.now() - t;           // cache warm, memo filled here
  t = performance.now();
  const b = await S.muscleStrength();
  const warm = performance.now() - t;
  ok(a.ready && a.muscles.size > 0, `the demo account is rated (${a.muscles.size} muscles)`);
  ok(a !== b && a.muscles !== b.muscles, 'each caller gets its own copy');
  ok(JSON.stringify([...a.muscles]) === JSON.stringify([...b.muscles]), 'and the two copies are the same answer');
  ok(warm < cold / 3, `the second ask does not recompute every rating (${cold.toFixed(1)}ms, then ${warm.toFixed(1)}ms)`);

  // A caller editing its copy must not reach the next caller.
  const key = [...b.muscles.keys()][0];
  b.muscles.get(key).percentile = -999;
  b.muscles.delete(key);
  const c = await S.muscleStrength();
  ok(c.muscles.has(key) && c.muscles.get(key).percentile !== -999, 'editing a copy does not change the kept answer');

  // A write makes it recompute: a stronger bench takes Chest over.
  const exMap = await S.store.getExerciseMap();
  const bench = [...exMap.values()].find((e) => /^barbell bench press$/i.test(e.name));
  const before = c.muscles.get('Chest');
  await S.store.saveBenchmark({ date: S.todayISO(), exerciseId: bench.id,
    exerciseName: bench.name, values: { weight: 250, reps: 1 } });
  const d = await S.muscleStrength();
  const after = d.muscles.get('Chest');
  ok(Boolean(bench) && after && after.best && after.best.weight === 250
    && (!before || !before.best || before.best.weight !== 250),
  `a saved benchmark is in the next answer (Chest best ${before && before.best && before.best.weight} → ${after && after.best && after.best.weight})`);
}

console.log(fails ? `\n${fails} FAIL` : '\nall passed');
process.exit(fails ? 1 : 0);
