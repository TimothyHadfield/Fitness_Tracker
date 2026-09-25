// Motion 2 · Additions (docs/motion2-plan.md). jsdom + the real modules, demo account.
//   node tests/additions.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim, 2026-09-25: *"Think about the potential for any additions and where they
// could be. Impress me."* Two plain, visual additions on data already on screen:
//   #6 Profile's "Your goal" row carries the Goals screen's own thin fill bar.
//   #8 Data › Muscles: the names in "Strongest: … Furthest behind: …" are buttons
//      that pick that muscle exactly as a tap on the figure does.
// Layout (bar height on screen, tap target size, nothing moving) is checked in
// WebKit screenshots; this pins the wiring a screenshot cannot see.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/me', pretendToBeVisual: true,
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
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
// A phone: the Muscles pane shows the summary sentence (no laptop default pick).
window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
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

const M = await import(new URL('js/motion.js', root).href);
const { store, muscleRatings, todayISO } = await import(new URL('js/store.js', root).href);
const { goalProgress } = await import(new URL('js/goals.js', root).href);
const { MeView } = await import(new URL('js/views-me.js', root).href);
const { muscleGroupsPane } = await import(new URL('js/views-muscles.js', root).href);

/* ---------- #6: the goal bar on Profile ---------- */
async function meGoalRow() {
  const app = document.getElementById('app');
  const node = await MeView();
  app.replaceChildren(node);
  for (let i = 0; i < 60 && !node.querySelector('a.row[href="#/goals"]'); i++) await settle(50);
  return node.querySelector('a.row[href="#/goals"]');
}

{
  M.__setMotionForTest(false);
  const goal = await store.activeGoal();
  ok(Boolean(goal), 'the demo has an active goal (fixture)');
  const row = await meGoalRow();
  ok(Boolean(row), 'Profile draws the "Your goal" row');
  if (row && goal) {
    const sessions = await store.getSessions();
    const benchmarks = await store.getBenchmarks();
    const bodyWeights = await store.getBodyWeights();
    const muscles = await muscleRatings({ sessions, benchmarks, bodyWeights });
    const m = muscles.get(goal.muscle);
    const p = goalProgress(goal, m ? m.estimate : null, todayISO());
    const bar = row.querySelector('.to-next-bar');
    const fill = bar && bar.querySelector('.to-next-fill');
    ok(Boolean(bar && fill), 'the row carries the Goals screen\'s own .to-next-bar / .to-next-fill');
    ok(bar && bar.classList.contains('me-goal-bar'), 'marked .me-goal-bar (the thin Profile size)');
    ok(bar && row.querySelector('.row-main').contains(bar)
       && bar.previousElementSibling && bar.previousElementSibling.classList.contains('row-sub'),
      'it sits under the "N of M lbs · by <date>" line, inside the row text');
    const want = `${((p.fraction || 0) * 100).toFixed(1)}%`;
    ok(fill && fill.style.width === want,
      `the fill is the goal's own fraction, same as Goals (${fill && fill.style.width} vs ${want})`);
    ok(row.querySelectorAll('a, button').length === 0, 'the row stays ONE tap target (nothing interactive inside it)');
    ok(bar && bar.getAttribute('aria-hidden') === 'true', 'the bar is decoration for a screen reader; the line already says it');
    ok(!fill || !fill.dataset.mSeen, 'with motion off nothing springs (no data-m-seen, width set at once)');
  }

  // Motion on: springs from 0 once per session, never again on a re-render.
  M.__setMotionForTest(true);
  const row2 = await meGoalRow();
  const f2 = row2 && row2.querySelector('.to-next-fill');
  ok(f2 && f2.dataset.mSeen === '1', 'with motion on the bar is handed to the spring (data-m-seen)');
  const row3 = await meGoalRow();
  const f3 = row3 && row3.querySelector('.to-next-fill');
  ok(f3 && !f3.dataset.mSeen, 'the second Profile render this session does not spring again');
  M.__setMotionForTest(false);
}

/* ---------- #8: tappable strongest / furthest behind ---------- */
{
  const host = document.createElement('div');
  const top = document.createElement('div');
  document.body.append(host);
  await muscleGroupsPane(host, top);
  const line = [...host.querySelectorAll('.field-help')].find((n) => /^Strongest:/.test(n.textContent));
  ok(Boolean(line), 'the summary sentence is on the phone pane');
  const btns = line ? [...line.querySelectorAll('button')] : [];
  ok(btns.length === 2, `both muscle names are buttons (${btns.length})`);
  ok(btns.every((b) => b.type === 'button' && b.classList.contains('m-name-btn')),
    'plain type="button" (keyboard: Tab + Enter/Space), class .m-name-btn');
  const text = line ? line.textContent : '';
  ok(/^Strongest: \S.* \(.+\)\. Furthest behind: \S.* \(.+\)\.$/.test(text),
    `the sentence reads exactly as before (${text})`);
  const names = btns.map((b) => b.textContent);
  ok(names.length === 2 && names.every((n) => !/[()]/.test(n)), `only the muscle name is the button (${names.join(', ')})`);

  if (btns.length === 2) {
    const target = names[1];
    btns[1].click();
    await settle(60);
    const svg = host.querySelector('svg.body-map');
    ok(svg && svg.dataset.selected === target, `tapping "${target}" selects it on the figure (${svg && svg.dataset.selected})`);
    const on = svg ? [...svg.querySelectorAll('.body-region.is-selected')] : [];
    ok(on.length > 0 && on.every((r) => r.dataset.muscle === target), 'its regions carry .is-selected, like a tap on the map');
    const foot = host.querySelector('.body-foot');
    ok(foot && foot.classList.contains('has-pick') && foot.textContent.includes(target)
       && ![...foot.querySelectorAll('.field-help')].some((n) => /^Strongest:/.test(n.textContent)),
      'the same detail panel opens in place of the summary (has-pick, the muscle\'s own numbers)');
  }

  // Motion on: the same selection pulse as a tap on the figure.
  M.__setMotionForTest(true);
  const host2 = document.createElement('div');
  document.body.append(host2);
  // Close whatever the last block opened, so the summary is back.
  const svgPrev = host.querySelector('svg.body-map');
  const openRegion = svgPrev && svgPrev.querySelector('.body-region.is-selected');
  openRegion && openRegion.dispatchEvent(new window.Event('click', { bubbles: true }));
  await settle(30);
  await muscleGroupsPane(host2, document.createElement('div'));
  const line2 = [...host2.querySelectorAll('.field-help')].find((n) => /^Strongest:/.test(n.textContent));
  const b2 = line2 && line2.querySelector('button');
  ok(Boolean(b2), 'the summary is back after closing the muscle');
  if (b2) {
    const name = b2.textContent;
    b2.click();
    let glowed = false;
    for (let i = 0; i < 20 && !glowed; i++) {
      await settle(20);
      glowed = [...host2.querySelectorAll('.body-region')]
        .some((r) => r.dataset.muscle === name && /drop-shadow/.test(r.style.filter || ''));
    }
    ok(glowed, `the picked muscle pulses (drop-shadow on its regions), as a map tap does`);
  }
  M.__setMotionForTest(false);
}

/* ---------- CSS: its own section, bar ≤ 4px, tap target ≥ 44px ---------- */
{
  const css = read('css/app.css');
  const a = css.indexOf('/* === Motion 2 · Additions === */');
  const b = css.indexOf('/* === end Motion 2 · Additions === */');
  ok(a > 0 && b > a, 'css/app.css has the Motion 2 · Additions section');
  const sec = a > 0 && b > a ? css.slice(a, b) : '';
  const h = sec.match(/\.me-goal-bar\s*\{[^}]*height:\s*(\d+(?:\.\d+)?)px/);
  ok(h && Number(h[1]) <= 4, `the Profile bar is ≤ 4px tall (${h && h[1]})`);
  ok(/\.m-name-btn::after\s*\{[^}]*inset:/.test(sec), 'the name button widens its hit area with ::after, not with layout');
  const ins = sec.match(/\.m-name-btn::after\s*\{[^}]*inset:\s*(-?\d+)px/);
  ok(ins && -Number(ins[1]) * 2 + 18 >= 44, `the hit area is ≥ 44px tall around an ~18px line (inset ${ins && ins[1]})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
