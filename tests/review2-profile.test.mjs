// Profile / Goals / Account fixes from the second pass of the 2026-09-24 review.
// Renders the real views over the DEMO account in jsdom.
//   node tests/review2-profile.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "for all fo the 42 items you're leaving me to decide, you just choose
// what to do based on what you know and recommend".
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
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

const BASE = new URL('../js/', import.meta.url).href;
const { store, demo, todayISO, muscleRatings } = await import(BASE + 'store.js');
const { GraphView } = await import(BASE + 'views-data.js');
const { MeView } = await import(BASE + 'views-me.js');
const { GoalsView, GoalRouteView } = await import(BASE + 'views-goals.js');
const { AccountView } = await import(BASE + 'views-account.js');
const { fmtDateShort } = await import(BASE + 'ui.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function mount(p, ms = 120) {
  const node = await p;
  document.getElementById('app').replaceChildren(node);
  await settle(ms);
  return node;
}
const flat = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const closeSheets = () => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());

ok(demo.active(), 'the demo is on, so nothing below passes by having no data');

/* ---- Profile: best lifts, goal row, body row, tiles ---- */
{
  const me = await mount(MeView(), 250);
  const rows = [...me.querySelectorAll('.me-bests > .list > .me-best')];
  const bench = rows.find((r) => /^Barbell Bench Press/.test(flat(r.querySelector('.row-title'))));
  ok(Boolean(bench), 'the demo profile has a Barbell Bench Press row');

  // 1. The figure says it is a BEST.
  ok(/^Best\b/.test(flat(bench && bench.querySelector('.me-best-est'))),
     `1. the best-lift figure is labelled "Best" (${flat(bench && bench.querySelector('.me-best-est'))})`);

  // 3. The set's own date beside the set, and "trained N days" — not "last <day>".
  const sub = flat(bench && bench.querySelector('.row-sub'));
  const { rankedLifts } = await import(BASE + 'profile-ranking.js');
  const [sessions, benchmarks, exMap, bodyWeights, profile] = await Promise.all([
    store.getSessions(), store.getBenchmarks(), store.getExerciseMap(), store.getBodyWeights(),
    store.getProfile()]);
  const muscles = await muscleRatings({ sessions, benchmarks, bodyWeights });
  const r = rankedLifts({ sessions, benchmarks, exMap, muscles, profile });
  const rb = r.core.find((l) => l.name === 'Barbell Bench Press');
  const setDay = fmtDateShort(rb.best.date);
  ok(sub.includes(setDay) && /trained \d+ days?/.test(sub) && !/\blast\b/.test(sub),
     `3. the row names the set's own date (${setDay}) and "trained N days" (${sub})`);
  console.log(`      (set ${rb.best.date}, last trained ${rb.lastDate})`);

  // 2. Each trained row is a way into that lift's graph.
  const link = bench && (bench.tagName === 'A' ? bench : bench.querySelector('a'));
  ok(Boolean(link) && link.getAttribute('href') === '#/graphs',
     `2. the bench row links to the Data graph (${link ? link.getAttribute('href') : 'no link'})`);
  const untrained = rows.filter((row) => row.classList.contains('is-none'));
  ok(untrained.every((row) => row.tagName !== 'A'), '   and a row with nothing recorded is not a link');
  if (link) {
    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const data = await mount(GraphView(), 250);
    const sel = data.querySelector('select[aria-label="What to chart"]');
    const picked = sel && sel.options[sel.selectedIndex];
    ok(Boolean(picked) && picked.textContent === 'Barbell Bench Press',
       `   and the graph opens on that lift (${picked ? picked.textContent : 'no picker — wrong tab'})`);
  }

  // 6. The goal row shows progress, not only the deadline.
  const goalRow = [...me.querySelectorAll('.me-section')]
    .find((s) => /Your goal/i.test(flat(s.querySelector('.section-label'))));
  const goalSub = flat(goalRow && goalRow.querySelector('.row-sub'));
  ok(/^\d+ of \d+ (lbs|kg)\b|^Reached|^Ended /.test(goalSub),
     `6. the goal row says how far along it is (${goalSub})`);

  // 9a. No capital "Today" mid-sentence.
  const body = [...me.querySelectorAll('.me-section')]
    .find((s) => /Your body/i.test(flat(s.querySelector('.section-label'))));
  const bodySub = flat(body && body.querySelector('.row-sub'));
  ok(!/Last weighed (Today|Yesterday)/.test(bodySub), `9. "Last weighed" is lower-case after it (${bodySub})`);
}

/* ---- 7. The stat tiles draw no box ---- */
{
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
  const rule = (css.match(/\n\.me-stat \{[^}]*\}/) || [''])[0];
  ok(rule && !/border(-radius)?\s*:/.test(rule), '7. .me-stat has no border or radius (Rule 2)');
  ok(/\.me-stat \+ \.me-stat\s*\{[^}]*border-left/.test(css), '   and a thin divider separates the two');
}

/* ---- Goals screen ---- */
{
  const screen = await mount(GoalsView(), 250);
  const txt = flat(screen);

  // 5. The refusal leads with what it is.
  ok(/Not judged yet/.test(txt) && !/Not yet —/.test(txt), '5. "On track?" answers "Not judged yet"');

  // 9b. higher + to go = asks for.
  const higher = txt.match(/(\d+) (lbs|kg) higher/);
  const togo = txt.match(/(\d+) (lbs|kg) to go of the (\d+) (lbs|kg)/);
  ok(Boolean(higher && togo), `   the demo goal prints both figures (${higher && higher[0]} | ${togo && togo[0]})`);
  if (higher && togo) {
    ok(Number(higher[1]) + Number(togo[1]) === Number(togo[3]),
       `9. gained + to go = what the goal asks (${higher[1]} + ${togo[1]} vs ${togo[3]})`);
  }
}

/* ---- 1. The goal picker calls its figure "now" ---- */
{
  const pick = await mount(GoalRouteView(''), 250);
  const subs = [...pick.querySelectorAll('button.row .row-sub')].map(flat);
  ok(subs.length > 0 && subs.every((s) => /\d+ (lbs|kg) now$/.test(s)),
     `1. the goal picker labels the estimate "now" (${subs[0]})`);
}

/* ---- 4. A tap on a level always confirms, even with no goal running ---- */
{
  const g = await store.activeGoal();
  if (g) await store.endGoal(g.id, 'ended');
  ok(!(await store.activeGoal()), '   (no goal running now)');
  closeSheets();
  const lv = await mount(GoalRouteView('new/Chest'), 250);
  const opt = lv.querySelector('.goal-option');
  ok(Boolean(opt), '   the Chest level screen has options');
  opt.click();
  await settle(80);
  const sheet = document.querySelector('.sheet');
  ok(Boolean(sheet) && !(await store.activeGoal()),
     '4. tapping a level opens a sheet and sets nothing yet');
  const st = flat(sheet);
  ok(/\d+ (lbs|kg)/.test(st) && /by \w+ \d+/i.test(st) && /hard sets .* a week/.test(st),
     `   the sheet names the target, the date and what it asks (${st.slice(0, 160)})`);
  const btns = sheet ? [...sheet.querySelectorAll('button')].map(flat) : [];
  ok(btns.includes('Set goal') && btns.includes('Cancel'), `   with Set goal / Cancel (${btns.join(', ')})`);
  const setBtn = sheet && [...sheet.querySelectorAll('button')].find((b) => flat(b) === 'Set goal');
  if (setBtn) { setBtn.click(); await settle(150); }
  ok(Boolean(await store.activeGoal()), '   and Set goal sets it');
  closeSheets();
}

/* ---- 8. Settings reachable from Account ---- */
{
  const acc = await mount(AccountView(), 150);
  ok(Boolean(acc.querySelector('a[href="#/settings"]')), '8. the Account screen has a Settings row');
  const src = readFileSync(new URL('../js/views-account.js', import.meta.url), 'utf8');
  // One builder, called from the demo screen AND from personalSections(),
  // which every non-demo Account screen (local, anonymous, signed-in) uses.
  ok((src.match(/settingsRow\(\)/g) || []).length >= 3
      && /async function personalSections[\s\S]*?settingsRow\(\)/.test(src),
     '   on the signed-in screens too, not only the demo one');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
