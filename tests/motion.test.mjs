// The motion pass (docs/polish-plan.md, part M). jsdom + the real module.
//   node tests/motion.test.mjs
//
// Tim, 2026-09-25: *"could you really work on design and annimation improvements
// throughout the cite? Some cites have really good shading, reflection graphics,
// shining, smooth and creative annimation …"*
//
// What is pinned here is the BEHAVIOUR the look depends on, because a screenshot
// cannot see it: rows stagger in once per visit and never on a re-render, a
// counted number always ends exactly on its real value, reduced motion turns
// every piece off, and the celebration tier fires only on the three real wins.
// The motion itself (frames, timing) is checked in a browser with an in-page
// requestAnimationFrame probe, not here.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.MutationObserver = window.MutationObserver;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const M = await import(new URL('js/motion.js', root).href);
const {
  arriveScreen, countUp, parseCount, celebrate, tabPop, motionAllowed, __setMotionForTest,
  STAGGER_STEP, STAGGER_MAX, COUNT_MS, QUIET_ROUTES,
} = M;

const h = (html) => { const d = document.createElement('div'); d.className = 'screen'; d.innerHTML = html; return d; };
const rows = (n) => `<div class="list">${Array.from({ length: n }, (_, i) => `<a class="row">Row ${i}</a>`).join('')}</div>`;

/* ---------- the numbers Rule 7 cares about ---------- */
ok(STAGGER_STEP === 30, `stagger step is 30ms (${STAGGER_STEP})`);
ok(STAGGER_MAX === 8, `only the first 8 rows stagger (${STAGGER_MAX})`);
ok(STAGGER_STEP * STAGGER_MAX <= 240, `the whole cascade spreads over ≤240ms (${STAGGER_STEP * STAGGER_MAX})`);
ok(COUNT_MS <= 240, `a count-up takes ≤240ms (${COUNT_MS})`);
ok(['session', 'edit', 'activity'].every((r) => QUIET_ROUTES.includes(r)),
   '🚨 the logging path (runner, edit, activity log) is a quiet route');

/* ---------- reduced motion kills all of it ---------- */
window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q });
window.Element.prototype.animate = function () {};
__setMotionForTest(null);
ok(motionAllowed() === false, 'prefers-reduced-motion: motion is not allowed');
{
  const s = h(rows(5) + '<span class="me-stat-n">137</span><div class="to-next-bar"><div class="to-next-fill" style="width:40%"></div></div>');
  document.getElementById('app').replaceChildren(s);
  arriveScreen(s, { key: '#/rm' });
  await settle();
  ok(!s.querySelector('.m-stagger') && !s.querySelector('[style*="animation-delay"]'), 'reduced motion: no row staggers');
  ok(!s.querySelector('.m-fill'), 'reduced motion: no bar fills');
  ok(s.querySelector('.me-stat-n').textContent === '137', 'reduced motion: the number is shown as-is, never counted');
  const c = document.createElement('div');
  ok(celebrate(c, 'rm-key') === false && !c.classList.contains('m-celebrate'), 'reduced motion: no celebration');
  const a = document.createElement('a');
  tabPop(a);
  ok(!a.classList.contains('m-tabbed'), 'reduced motion: no tab pop');
}
window.matchMedia = (q) => ({ matches: false, media: q });
ok(motionAllowed() === true, 'with no preference and an engine that animates, motion is allowed');
delete window.Element.prototype.animate;
ok(motionAllowed() === false, 'jsdom without Element.animate: nothing animates (every other suite stays still)');
__setMotionForTest(true);

/* ---------- stagger: first 8 rows, 30ms apart, once per visit ---------- */
{
  const s = h(rows(12));
  document.getElementById('app').replaceChildren(s);
  ok(arriveScreen(s, { key: '#/settings', route: 'settings' }) === true, 'arriving on a screen plays its motion');
  const r = [...s.querySelectorAll('.row')];
  const staggered = r.filter((x) => x.classList.contains('m-stagger'));
  ok(staggered.length === 8, `exactly the first 8 of 12 rows stagger (${staggered.length})`);
  ok(staggered.every((x, i) => x === r[i]), 'and they are the FIRST 8, in order');
  ok(staggered.map((x) => x.style.animationDelay).join() === '0ms,30ms,60ms,90ms,120ms,150ms,180ms,210ms',
     `delays step by 30ms (${staggered.map((x) => x.style.animationDelay).join(' ')})`);

  // A re-render of the same route (refreshRoute, a demo toggle) is NOT a visit.
  const s2 = h(rows(12));
  document.getElementById('app').replaceChildren(s2);
  ok(arriveScreen(s2, { key: '#/settings', route: 'settings' }) === false, 'a re-render of the same hash plays nothing');
  ok(!s2.querySelector('.m-stagger'), '🚨 and no row staggers on the re-render');

  // Leaving and coming back IS a new visit.
  const s3 = h(rows(3));
  document.getElementById('app').replaceChildren(s3);
  arriveScreen(s3, { key: '#/home', route: 'home' });
  const s4 = h(rows(3));
  document.getElementById('app').replaceChildren(s4);
  ok(arriveScreen(s4, { key: '#/settings', route: 'settings' }) === true && s4.querySelectorAll('.m-stagger').length === 3,
     'coming back to a screen is a new visit and staggers again');
}

/* ---------- the logging path and a rising screen stay still ---------- */
{
  const s = h(rows(6));
  document.getElementById('app').replaceChildren(s);
  ok(arriveScreen(s, { key: '#/session/abc', route: 'session' }) === false && !s.querySelector('.m-stagger'),
     '🚨 the runner never staggers (Rule 7: nothing on the logging path)');
  const r = h(rows(6));
  document.getElementById('app').replaceChildren(r);
  ok(arriveScreen(r, { key: '#/record', route: 'record', rising: true }) === false && !r.querySelector('.m-stagger'),
     'a screen that rises as a whole does not also stagger its rows');
}

/* ---------- async fill: the first batch staggers, later ones do not ---------- */
{
  const s = h('<div class="feed"></div>');
  document.getElementById('app').replaceChildren(s);
  arriveScreen(s, { key: '#/home2', route: 'home' });
  const feed = s.querySelector('.feed');
  feed.innerHTML = Array.from({ length: 4 }, () => '<div class="feed-card"><div class="feed-stat-value">45 min</div></div>').join('');
  await settle();
  ok(s.querySelectorAll('.feed-card.m-stagger').length === 4, 'the feed filling in after the screen arrived staggers once');
  const more = document.createElement('div');
  more.className = 'feed-card';
  feed.append(more);
  await settle();
  ok(!more.classList.contains('m-stagger'), '🚨 a card added later (Show more, a kudos re-draw) does not stagger');
}

/* ---------- count-up ---------- */
ok(parseCount('137').num === 137, 'parseCount reads a bare number');
ok(parseCount('164.6 lbs').decimals === 1 && parseCount('164.6 lbs').post === ' lbs', 'keeps decimals and the unit');
ok(parseCount('+12.3%').pre === '+', 'keeps a sign prefix');
ok(parseCount('1h 4min') === null, 'two numbers (1h 4min, 1:05) are shown as-is, not counted');
ok(parseCount('—') === null && parseCount('0') === null, 'a dash or a zero has nothing to count');

async function runCount(text, frames) {
  const n = document.createElement('span');
  n.textContent = text;
  document.body.append(n);
  let t = 0;
  const queue = [];
  const seen = [];
  const raf = (fn) => queue.push(fn);
  countUp(n, { raf, now: () => t });
  for (const at of frames) {
    t = at;
    const fns = queue.splice(0);
    fns.forEach((f) => f(t));
    seen.push(n.textContent);
  }
  return { n, seen };
}
{
  const { n, seen } = await runCount('137', [0, 40, 80, 120, 160, 200, 240, 280]);
  ok(seen[0] !== '137', `it starts below the real value (${JSON.stringify(seen[0])})`);
  ok(seen.every((s) => s.length === 3), `🚨 every frame is the same width: padded with figure spaces (${seen.map((s) => JSON.stringify(s)).join(' ')})`);
  const vals = seen.map((s) => Number(s.replace(/ /g, '')));
  ok(vals.every((v, i) => i === 0 || v >= vals[i - 1]), 'it only counts up');
  ok(n.textContent === '137', `🚨 the final value is exact (${n.textContent})`);
}
{
  const { n } = await runCount('164.6 lbs', [0, 17, 1000]);
  ok(n.textContent === '164.6 lbs', `a skipped-frame finish still lands exactly (${n.textContent})`);
  const { n: n2 } = await runCount('1,234', [0, 120, 240]);
  ok(n2.textContent === '1,234', `thousands separators survive (${n2.textContent})`);
  const { n: n3, seen: s3 } = await runCount('+12.3%', [0, 120, 240]);
  ok(n3.textContent === '+12.3%' && s3[1].startsWith('+'), `a signed percentage counts and lands (${s3.join(' | ')})`);
  const { n: n4, seen: s4 } = await runCount('1h 4min', [0, 120, 240]);
  ok(s4.every((s) => s === '1h 4min') && n4.textContent === '1h 4min', 'two-number text is never touched');
}
{
  // The app writes the element mid-count (a kudos count changing): the count
  // backs off rather than overwriting the newer value with the old one.
  const n = document.createElement('span');
  n.textContent = '50';
  let t = 0; const q = [];
  countUp(n, { raf: (fn) => q.push(fn), now: () => t });
  t = 60; q.splice(0).forEach((f) => f(t));
  n.textContent = '51';
  t = 120; q.splice(0).forEach((f) => f(t));
  t = 400; q.splice(0).forEach((f) => f(t));
  ok(n.textContent === '51', `a value the app wrote mid-count wins (${n.textContent})`);
}

/* ---------- bars fill, once ---------- */
{
  const s = h('<div class="to-next-bar"><div class="to-next-fill" style="width:40%"></div></div>'
    + '<div class="bar-track"><div class="bar now" style="width:60%"></div></div>'
    + '<div class="split-bar"><div class="split-fill" style="width:20%"></div></div>');
  document.getElementById('app').replaceChildren(s);
  arriveScreen(s, { key: '#/goals', route: 'goals' });
  ok(s.querySelectorAll('.m-fill').length === 3, `goal, Bars and split bars fill from zero on arrival (${s.querySelectorAll('.m-fill').length})`);
  ok(s.querySelector('.to-next-fill').style.width === '40%', 'the bar keeps its real width — only the animation starts at 0');
}

/* ---------- celebration: once per win, and only where it is a win ---------- */
{
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const a = document.createElement('div');
  ok(celebrate(a, 'pb:Bench:2026-09-25', { storage }) === true && a.classList.contains('m-celebrate'), 'a new win celebrates');
  const b = document.createElement('div');
  ok(celebrate(b, 'pb:Bench:2026-09-25', { storage }) === false && !b.classList.contains('m-celebrate'),
     '🚨 the same win never celebrates twice (a re-render or a second visit)');
  const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  let threw = false;
  try { celebrate(document.createElement('div'), 'k', { storage: broken }); } catch (_) { threw = true; }
  ok(!threw, 'storage that throws (private mode) never breaks a screen');
}
{
  // Source check: celebrate() is called from the three wins and nowhere else.
  const files = ['js/app.js', 'js/ui.js', ...['account', 'data', 'edit-session', 'goals', 'import', 'me', 'muscles',
    'profile', 'session', 'social', 'workouts'].map((v) => `js/views-${v}.js`)];
  const calls = Object.fromEntries(files.map((f) => [f, (read(f).match(/\bcelebrate\(/g) || []).length]));
  const where = Object.entries(calls).filter(([, n]) => n).map(([f, n]) => `${f}×${n}`).join(', ');
  ok(calls['js/views-session.js'] === 2, `the finish screen celebrates the save and the personal bests (${calls['js/views-session.js']})`);
  ok(calls['js/views-me.js'] === 2, `Profile celebrates a best lift set today and a reached goal (${calls['js/views-me.js']})`);
  ok(calls['js/views-goals.js'] === 1, `Goals celebrates a reached target (${calls['js/views-goals.js']})`);
  ok(Object.entries(calls).every(([f, n]) => !n || ['js/views-session.js', 'js/views-me.js', 'js/views-goals.js'].includes(f)),
     `🚨 no other file celebrates anything (${where})`);
  const sess = read('js/views-session.js');
  ok(/celebrate\(check/.test(sess) && /celebrate\(prsBlock/.test(sess), 'on the finish screen: the check and the personal-best block');
  ok(/p\.reached[\s\S]{0,200}celebrate\(/.test(read('js/views-goals.js')), 'on Goals: only when p.reached');
}

/* ---------- tab pop ---------- */
{
  const a = document.createElement('a');
  a.innerHTML = '<svg></svg>';
  tabPop(a);
  ok(a.classList.contains('m-tabbed'), 'a tab becoming selected pops');
  const app = read('js/app.js');
  ok(/tabPop\(/.test(app) && /navKey\s*!==\s*lastNavKey/.test(app), 'app.js pops the tab only when the selected tab CHANGED');
  ok(/arriveScreen\(screen,/.test(app), 'the router hands every screen to arriveScreen()');
}

/* ---------- the stylesheet ---------- */
{
  const css = read('css/app.css');
  const a = css.indexOf('/* === Motion === */');
  const b = css.indexOf('/* === end Motion === */');
  ok(a > 0 && b > a, 'app.css has the Motion section');
  const sec = css.slice(a, b);
  const t = sec.match(/--t-celebrate:\s*(\d+)ms/);
  ok(t && Number(t[1]) <= 700, `--t-celebrate is ≤700ms (${t && t[1]})`);
  ok(/\.m-celebrate::after\s*\{[^}]*transform/.test(sec) && /@keyframes m-shine/.test(sec), 'the shine is a pseudo-element moved by transform');
  const pop = sec.match(/@keyframes m-pop\s*\{[\s\S]*?\n\}/);
  ok(Boolean(pop) && /scale\(1\.04\)/.test(pop[0]) && !/scale\(1\.(0[5-9]|[1-9])/.test(pop[0]), 'the pop peaks at 1.04, no higher');
  ok(/prefers-reduced-motion: reduce[\s\S]*\.m-stagger[\s\S]*animation:\s*none/.test(sec),
     '🚨 under reduced motion the stagger is OFF, not just fast (its delay would still hide rows)');
  ok(/\.btn:active\s*\{[^}]*scale\(\.97\)[^}]*filter/.test(sec), 'a button press: scale .97 plus a brightness lift');
  ok(/@keyframes m-tab-pop[\s\S]*scale\(1\.12\)/.test(sec), 'the tab icon pops to 1.12');
  ok(/tabular-nums/.test(sec), 'counted numbers are tabular, so a count never changes their width');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
