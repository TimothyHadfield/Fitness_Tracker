// Profile + Account overhaul — 2026-09-27 (builder ME).
//   node tests/me-overhaul.test.mjs      (needs jsdom, like render.test.mjs)
//
// Pins what a screenshot cannot see:
//   S-5  "This week" maths (7 days, workouts, sets, "usual"), the Profile order
//        (week, goal, best lifts … body details last) and the compact head;
//   SC-1 "now 228" beside a best that differs from the muscle's own estimate;
//   I-16 the count-up runs only for a number that changed since last shown;
//   S-7  Your workouts draws 20 cards, then 20 more as the end comes near;
//   O-12 no tour / program rows on Account; ST-13 the Settings row's line;
//   R-13 a backup is shared as a file on a phone, downloaded elsewhere;
//   R-3  the Home Screen line is for iOS Safari outside the home-screen app.
import { JSDOM } from 'jsdom';

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
let nav = window.navigator;
Object.defineProperty(globalThis, 'navigator', { get: () => nav, configurable: true });
let coarse = false;
window.matchMedia = (q) => ({ matches: /pointer: coarse/.test(q) ? coarse : false, media: q,
  addEventListener() {}, removeEventListener() {} });
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

let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (c) passes++; else fails++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const root = new URL('../', import.meta.url);

const M = await import(new URL('js/motion.js', root).href);
M.__setMotionForTest(true);
const me = await import(new URL('js/views-me.js', root).href);
const acct = await import(new URL('js/views-account.js', root).href);

/* ---------- S-5: this week ---------- */
{
  const e = (n) => [{ exerciseId: 'x', exerciseName: 'Back Squat',
    sets: Array.from({ length: n }, () => ({ weight: 135, reps: 5 })) }];
  // 2026-09-27 is a Sunday. This week: Mon 21 (3 sets), Wed 23 (2 sets).
  // The four weeks before: 2, 3, 4, 5 workouts → usual round(14/4) = 4.
  const sessions = [
    { date: '2026-09-21', entries: e(3) }, { date: '2026-09-23', entries: e(2) },
    ...['2026-09-15', '2026-09-17'].map((date) => ({ date, entries: e(1) })),
    ...['2026-09-08', '2026-09-09', '2026-09-11'].map((date) => ({ date, entries: e(1) })),
    ...['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-04'].map((date) => ({ date, entries: e(1) })),
    ...['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28'].map((date) => ({ date, entries: e(1) })),
    { date: '2026-06-01', entries: e(1) },
  ];
  const w = me.weekSummary(sessions, '2026-09-27');
  ok(JSON.stringify(w.days) === '[true,false,true,false,false,false,false]', `Mon and Wed lit (${w.days})`);
  ok(w.todayIndex === 6, `Sunday is the 7th dot (${w.todayIndex})`);
  ok(w.workouts === 2 && w.sets === 5, `2 workouts · 5 sets (${w.workouts} · ${w.sets})`);
  ok(w.usual === 4, `usual is the 4 weeks before (${w.usual})`);
  const fresh = me.weekSummary([{ date: '2026-09-22', entries: e(1) }], '2026-09-27');
  ok(fresh.usual === null, 'a first week has no "usual"');
  const mon = me.weekSummary([{ date: '2026-09-28', entries: e(1) }], '2026-09-28');
  ok(mon.todayIndex === 0 && mon.days[0] === true, 'Monday starts the week');
}

/* ---------- SC-1: "now 228" ---------- */
{
  const muscles = new Map([['Chest', { estimate: 228, lift: { id: 'bench', name: 'Barbell Bench Press' } }]]);
  const row = { oneRM: 236, shown: 236, muscle: 'Chest', exerciseId: 'bench', name: 'Barbell Bench Press' };
  ok(me.nowTag(row, muscles) === 'now 228', `best 236, estimate 228 → "now 228" (${me.nowTag(row, muscles)})`);
  ok(me.nowTag({ ...row, shown: 228.2 }, muscles) === 'Best', 'the same whole number → "Best"');
  ok(me.nowTag({ ...row, perSide: true }, muscles) === 'Best', 'a per-side row keeps "Best"');
  ok(me.nowTag({ ...row, exerciseId: 'incline' }, muscles) === 'Best', 'another lift than the key lift keeps "Best"');
}

/* ---------- EB-3 / EB-7 / EB-8 on a lift row ---------- */
{
  const { liftRow } = await import(new URL('js/profile-shape.js', root).href);
  const base = { name: 'Leg Press', muscle: 'Quads', exerciseId: 'lp', estimated: true, oneRM: null, shown: null,
    perSide: false, bodyIncluded: false, level: null, percentile: null, band: null, days: 0, lastDate: null,
    best: null, source: null, from: [], why: 'high-reps-only', bestEver: null, addedLoad: null };
  const none = liftRow(base);
  ok(/Only high-rep sets/.test(none.textContent), `high-reps-only says so (${none.querySelector('.me-best-none').textContent})`);
  const dot = none.querySelector('.me-best-none .help-dot');
  ok(Boolean(dot), 'with a ? beside it');
  const rec = { ...base, why: null, oneRM: 300, shown: 300, days: 12, source: 'recorded',
    best: { weight: 270, reps: 4, date: '2026-09-20' }, band: { name: 'High' }, percentile: 50,
    level: { key: 'int', name: 'Intermediate' },
    bestEver: { value: 320, total: 320, date: '2026-03-02' }, addedLoad: '+ bar' };
  const row = liftRow(rec, { link: () => ({ href: '#/x' }) });
  const ever = row.querySelector('.me-best-ever');
  ok(ever && /^Best ever 320 lbs · Mar 2$/.test(ever.textContent), `a dated "Best ever" line (${ever && ever.textContent})`);
  ok(/^300 lbs \+ bar$/.test(row.querySelector('.me-best-top').textContent),
    `"+ bar" after the number (${row.querySelector('.me-best-top').textContent})`);
  ok(!liftRow({ ...rec, bestEver: null, addedLoad: null }).querySelector('.me-best-ever'), 'no line when the two agree');
}

/* ---------- SC-1 on the real Profile (the demo): ratings carry no `lift` ---------- */
{
  M.__setMotionForTest(false);
  const node = await me.MeView();
  document.getElementById('app').replaceChildren(node);
  for (let i = 0; i < 80 && !node.querySelector('.me-best'); i++) await settle(50);
  await settle(100);
  const bench = [...node.querySelectorAll('.me-best')].find((r) => /Barbell Bench Press/.test(r.textContent));
  const goal = node.querySelector('a.row[href="#/goals"]');
  const est = goal && /(\d+) of \d+/.exec(goal.textContent);
  ok(Boolean(bench && est), 'the demo has a bench row and a bench goal (fixture)');
  const tag = bench && /(now \d+|Best) · /.exec(bench.textContent);
  ok(tag && (tag[1] === `now ${est[1]}` || (tag[1] === 'Best' && new RegExp(`\\b${est[1]} lbs`).test(bench.textContent))),
    `the bench row says the goal's number, "now ${est && est[1]}" (${tag && tag[1]})`);
}

/* ---------- Profile: order, compact head, week row, quiet counts ---------- */
async function mountMe() {
  const app = document.getElementById('app');
  const node = await me.MeView();
  app.replaceChildren(node);
  for (let i = 0; i < 80 && !node.querySelector('.me-stat-n'); i++) await settle(50);
  await settle(100);
  return node;
}
{
  // Motion off, so the only data-m-seen on a count is the one Profile sets.
  M.__setMotionForTest(false);
  sess.delete('ftrack:v1:meShown');
  const a = await mountMe();
  ok(Boolean(a.querySelector('.me-head.is-compact .me-face.is-sm')), 'the head is the compact one');
  ok(Boolean(a.querySelector('.me-head .me-who .me-stats')), 'the counts sit beside the face, under the name');
  const week = a.querySelector('a.me-week-row[href="#/calendar"]');
  ok(Boolean(week), 'a "This week" row that opens the Calendar');
  ok(week && week.querySelectorAll('.me-week-dot').length === 7, 'with 7 day dots');
  ok(week && /^\d+ workouts? · \d+ sets?$|^Nothing yet$/.test(week.querySelector('.row-title').textContent),
    `saying "N workouts · M sets" (${week && week.querySelector('.row-title').textContent})`);
  const goal = a.querySelector('a.row[href="#/goals"]');
  const labels = [...a.querySelectorAll('.section-label')].map((n) => n.textContent);
  const before = (x, y) => x && y && Boolean(x.compareDocumentPosition(y) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  const bestLabel = [...a.querySelectorAll('.section-label')].find((n) => /best lifts/i.test(n.textContent));
  ok(before(week, goal) && before(goal, bestLabel), `week, then goal, then best lifts (${labels.join(' | ')})`);
  const sections = [...a.querySelectorAll('.me-section')];
  const last = sections[sections.length - 1];
  ok(last && Boolean(last.querySelector('a[href="#/profile"]')), 'body details are the last section');
  const firstPass = [...a.querySelectorAll('.me-stat-n')];
  ok(firstPass.length > 0 && firstPass.every((n) => !n.dataset.mSeen), 'first Profile this session: every count rolls');
  const b = await mountMe();
  const again = [...b.querySelectorAll('.me-stat-n')];
  ok(again.length > 0 && again.every((n) => n.dataset.mSeen === '1'),
    'a second Profile with the same numbers does not count up again');
  const shown = JSON.parse(sess.get('ftrack:v1:meShown') || '{}');
  shown[Object.keys(shown)[0]] = '-1';
  sess.set('ftrack:v1:meShown', JSON.stringify(shown));
  const c = await mountMe();
  const changed = [...c.querySelectorAll('.me-stat')].find((t) => t.querySelector('.me-stat-l').textContent === Object.keys(shown)[0]);
  ok(changed && changed.querySelector('.me-stat-n').dataset.mSeen !== '1', 'a number that changed counts up again');
  const others = [...c.querySelectorAll('.me-stat')].filter((t) => t !== changed);
  ok(others.length > 0 && others.every((t) => t.querySelector('.me-stat-n').dataset.mSeen === '1'), 'the unchanged ones stay still');
  M.__setMotionForTest(true);
}

/* ---------- S-7: your own cards, paged ---------- */
{
  let cb = null;
  globalThis.IntersectionObserver = class {
    constructor(fn) { cb = fn; }
    observe() {} disconnect() { cb = null; }
  };
  const node = await me.MeWorkoutsView();
  document.getElementById('app').replaceChildren(node);
  for (let i = 0; i < 80 && !node.querySelector('.feed-card'); i++) await settle(50);
  const n1 = node.querySelectorAll('.feed-card').length;
  ok(n1 === 20, `20 cards first (${n1})`);
  ok(Boolean(node.querySelector('.feed-card .feed-self-meta')) && !node.querySelector('.feed-card .feed-author, .feed-card .me-face'),
    'your own card: date line on top, no author row');
  if (cb) cb([{ isIntersecting: true }]);
  await settle();
  const n2 = node.querySelectorAll('.feed-card').length;
  ok(n2 === 40, `20 more as the end comes near (${n2})`);
  delete globalThis.IntersectionObserver;
}

/* ---------- Account (demo): rows ---------- */
{
  const node = await acct.AccountView();
  document.getElementById('app').replaceChildren(node);
  await settle(100);
  const text = node.textContent;
  ok(!/Take the tour/.test(text) && !/Find me a program/.test(text), 'no tour or program rows on Account');
  ok(/Theme, units, workout/.test(text), 'the Settings row says "Theme, units, workout"');
}

/* ---------- R-13: backup file ---------- */
{
  const shared = [];
  window.URL.createObjectURL = globalThis.URL.createObjectURL = () => 'blob:x';
  window.URL.revokeObjectURL = globalThis.URL.revokeObjectURL = () => {};
  nav = { userAgent: 'iPhone', share: async (d) => { shared.push(d); }, canShare: (d) => Boolean(d && d.files) };
  coarse = true;
  const r1 = await acct.saveBackupFile('{"a":1}', 'backup.json');
  ok(r1 === 'shared' && shared.length === 1 && shared[0].files[0].name === 'backup.json',
    `a phone gets the share sheet with the file (${r1})`);
  nav = { ...nav, share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } };
  ok(await acct.saveBackupFile('{}', 'b.json') === 'cancelled', 'cancelling the sheet downloads nothing');
  coarse = false;
  let clicked = 0;
  const realClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () { if (this.download) clicked++; };
  ok(await acct.saveBackupFile('{}', 'b.json') === 'downloaded' && clicked === 1, 'a laptop downloads it');
  nav = { userAgent: 'x' };
  coarse = true;
  ok(await acct.saveBackupFile('{}', 'b.json') === 'downloaded' && clicked === 2, 'no share sheet → downloads');
  window.HTMLAnchorElement.prototype.click = realClick;
  coarse = false;
}

/* ---------- R-3: Home Screen line ---------- */
{
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
  const noSa = { matchMedia: () => ({ matches: false }) };
  const sa = { matchMedia: () => ({ matches: true }) };
  ok(acct.wantsHomeScreenHint({ userAgent: iphone }, noSa) === true, 'iPhone Safari in a tab: shown');
  ok(acct.wantsHomeScreenHint({ userAgent: iphone, standalone: true }, noSa) === false, 'home-screen app: not shown');
  ok(acct.wantsHomeScreenHint({ userAgent: iphone }, sa) === false, 'standalone display mode: not shown');
  ok(acct.wantsHomeScreenHint({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }, noSa) === true, 'iPad (reports a Mac): shown');
  ok(acct.wantsHomeScreenHint({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, noSa) === false, 'Windows: not shown');
}

console.log(`\n${passes} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
