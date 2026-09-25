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
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const M = await import(new URL('js/motion.js', root).href);
const S = await import(new URL('js/spring.js', root).href);
const {
  arriveScreen, arrivePane, staggerIn, countUp, parseCount, celebrate, tabPop, motionAllowed, __setMotionForTest,
  __resetVisitsForTest, STAGGER_STEP, STAGGER_MAX, STAGGER_LEAD, STAGGER_RISE, COUNT_MS, QUIET_ROUTES, POP_PEAK,
} = M;
S.__setReducedMotionForTest(false);

const h = (html) => { const d = document.createElement('div'); d.className = 'screen'; d.innerHTML = html; return d; };
const rows = (n) => `<div class="list">${Array.from({ length: n }, (_, i) => `<a class="row">Row ${i}</a>`).join('')}</div>`;
const arriving = (s) => [...s.querySelectorAll('.m-arriving')];

/* ---------- the numbers Rule 7 cares about ---------- */
// 🆕 Pass 2 (2026-09-25): rows follow the screen on a spring rather than fading
// with it. The whole cascade — the lead, 7 gaps, the last row's 90% — is <450ms.
const snap90 = (() => {
  const s = S.simulate({ from: 0, to: 100, preset: 'snap', ms: 800 });
  let t = 0; for (const p of s) if (Math.abs(p.x - 100) > 10) t = p.t; return t;
})();
ok(STAGGER_STEP === 35, `stagger step is 35ms (${STAGGER_STEP})`);
ok(STAGGER_MAX === 8, `only the first 8 rows stagger (${STAGGER_MAX})`);
ok(STAGGER_RISE >= 10 && STAGGER_RISE <= 14, `rows rise 10–14px, distinct from the screen's own 6px (${STAGGER_RISE})`);
const cascade = STAGGER_LEAD + STAGGER_STEP * (STAGGER_MAX - 1) + snap90;
ok(STAGGER_LEAD > 0 && cascade < 450,
   `the screen moves first, and the whole cascade has arrived in <450ms (${STAGGER_LEAD} + ${STAGGER_STEP}×7 + ${snap90.toFixed(0)} = ${cascade.toFixed(0)}ms)`);
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
  ok(!s.querySelector('.m-arriving') && !s.querySelector('[style*="opacity"]'), 'reduced motion: no row staggers');
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

/* ---------- stagger: first 8 rows in view, on springs, once per session ---------- */
{
  const s = h(rows(12));
  document.getElementById('app').replaceChildren(s);
  ok(arriveScreen(s, { key: '#/settings', route: 'settings' }) === true, 'arriving on a screen plays its motion');
  const r = [...s.querySelectorAll('.row')];
  const staggered = r.filter((x) => x.classList.contains('m-arriving'));
  ok(staggered.length === 8, `exactly the first 8 of 12 rows stagger (${staggered.length})`);
  ok(staggered.every((x, i) => x === r[i]), 'and they are the FIRST 8, in order');
  ok(staggered.every((x) => Number(x.style.opacity) === 0 && x.style.transform.includes(`${STAGGER_RISE}.00px`)),
     `each starts hidden, ${STAGGER_RISE}px down, before its spring moves it (${staggered[7].style.transform})`);
  await settle(STAGGER_LEAD + 20);
  ok(Number(staggered[0].style.opacity) > 0 && Number(staggered[7].style.opacity || 0) === 0,
     'the first row is on its way while the eighth is still waiting its turn');
  await settle(900);
  ok(r.every((x) => x.style.transform === '' && x.style.opacity === '' && !x.classList.contains('m-arriving')),
     '🚨 at rest every row is left with NO inline transform or opacity (a press or a class never fights one)');

  // A re-render of the same route (refreshRoute, a demo toggle) is NOT a visit.
  const s2 = h(rows(12));
  document.getElementById('app').replaceChildren(s2);
  ok(arriveScreen(s2, { key: '#/settings', route: 'settings' }) === false, 'a re-render of the same hash plays nothing');
  ok(!s2.querySelector('.m-arriving'), '🚨 and no row staggers on the re-render');

  // 🆕 Pass 2: leaving and coming back is NOT news — once per route per session.
  const s3 = h(rows(3));
  document.getElementById('app').replaceChildren(s3);
  arriveScreen(s3, { key: '#/home', route: 'home' });
  const s4 = h(rows(3));
  document.getElementById('app').replaceChildren(s4);
  arriveScreen(s4, { key: '#/settings', route: 'settings' });
  ok(arriving(s4).length === 0, '🚨 coming back to a screen already shown this session does not stagger again');

  // Only rows the reader can see.
  const s5 = h(rows(6));
  document.getElementById('app').replaceChildren(s5);
  const below = [...s5.querySelectorAll('.row')].slice(3);
  below.forEach((x) => { x.getBoundingClientRect = () => ({ top: 5000, bottom: 5046, left: 0, right: 300 }); });
  arriveScreen(s5, { key: '#/below', route: 'x' });
  ok(arriving(s5).length === 3 && below.every((x) => !x.classList.contains('m-arriving')),
     `rows below the fold are left alone (${arriving(s5).length} of 6 moved)`);
  await settle(700);
}

/* ---------- a Data sub-tab's pane arrives like a screen ---------- */
{
  const pane = h(rows(4));
  document.getElementById('app').replaceChildren(pane);
  ok(arrivePane(pane, 'data:volume') === true && arriving(pane).length === 4, 'a freshly painted sub-tab pane staggers its rows');
  const again = h(rows(4));
  document.getElementById('app').replaceChildren(again);
  ok(arrivePane(again, 'data:volume') === false && arriving(again).length === 0, 'the same pane a second time does not');
  const detached = h(rows(4));
  ok(arrivePane(detached, 'data:graph') === false, 'a pane painted before its screen is in the document is left to the screen');
  const later = h(rows(4));
  document.getElementById('app').replaceChildren(later);
  ok(arrivePane(later, 'data:graph') === false, '…and is remembered, so switching back to it later stays still');
  await settle(700);
}

/* ---------- staggerIn: any batch (Home's Show more) ---------- */
{
  const box = document.createElement('div');
  box.innerHTML = rows(10);
  document.getElementById('app').replaceChildren(box);
  const n = staggerIn(box.querySelectorAll('.row'));
  ok(n === 8 && arriving(box).length === 8, `staggerIn moves at most 8 of a batch (${n})`);
  await settle(800);
  ok(arriving(box).length === 0, 'and lets go of them at rest');
}

/* ---------- the logging path and a rising screen stay still ---------- */
{
  const s = h(rows(6));
  document.getElementById('app').replaceChildren(s);
  ok(arriveScreen(s, { key: '#/session/abc', route: 'session' }) === false && !s.querySelector('.m-arriving'),
     '🚨 the runner never staggers (Rule 7: nothing on the logging path)');
  const r = h(rows(6));
  document.getElementById('app').replaceChildren(r);
  ok(arriveScreen(r, { key: '#/record', route: 'record', rising: true }) === false && !r.querySelector('.m-arriving'),
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
  ok(s.querySelectorAll('.feed-card.m-arriving').length === 4, 'the feed filling in after the screen arrived staggers once');
  // 🆕 A second batch while the first rows are still arriving (Profile paints
  // its body row, then its lifts) joins the same cascade.
  const second = document.createElement('div');
  second.className = 'feed-card';
  feed.append(second);
  await settle();
  ok(second.classList.contains('m-arriving'), 'a second batch landing during the arrival joins the cascade');
  await settle(600);
  const more = document.createElement('div');
  more.className = 'feed-card';
  feed.append(more);
  await settle();
  ok(!more.classList.contains('m-arriving'), '🚨 a card added later (Show more, a kudos re-draw) does not stagger');
}

/* ---------- count-up ---------- */
ok(parseCount('137').num === 137, 'parseCount reads a bare number');
ok(parseCount('164.6 lbs').decimals === 1 && parseCount('164.6 lbs').post === ' lbs', 'keeps decimals and the unit');
ok(parseCount('+12.3%').pre === '+', 'keeps a sign prefix');
ok(parseCount('1h 4min').count === 2, '🆕 two numbers (1h 4min) are BOTH counted, like "50 min" beside them');
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
  const { n: n4, seen: s4 } = await runCount('1h 45min', [0, 120, 240]);
  ok(s4[0] !== '1h 45min' && s4.slice(0, -1).every((s) => s.length === 8) && n4.textContent === '1h 45min',
     `"1h 45min" counts both parts at one width and lands exactly (${s4.map((s) => JSON.stringify(s)).join(' ')})`);
  const { n: n5, seen: s5 } = await runCount('1:05', [0, 120, 240]);
  ok(/^\d:\d\d$/.test(s5[1]) && n5.textContent === '1:05', `a clock pads with zeros, like a clock (${s5.join(' | ')})`);
}
{
  // 🆕 A return visit counts only a number that CHANGED since that route last
  // showed it — a saved workout moved the total; nothing else is news.
  const mk = (a, b) => h(`<span class="me-stat-n">${a}</span><span class="me-stat-n">${b}</span>`);
  const s1 = mk('12', '340');
  document.getElementById('app').replaceChildren(s1);
  arriveScreen(s1, { key: '#/me-counts', route: 'me' });
  ok(s1.querySelectorAll('.me-stat-n')[0].textContent !== '12', 'first visit: the numbers count');
  await settle(400);
  const away = h('');
  arriveScreen(away, { key: '#/elsewhere', route: 'x' });
  const s2 = mk('12', '355');
  document.getElementById('app').replaceChildren(s2);
  arriveScreen(s2, { key: '#/me-counts', route: 'me' });
  const [u, c] = s2.querySelectorAll('.me-stat-n');
  ok(u.textContent === '12', 'return visit: an unchanged number is shown as-is');
  ok(c.textContent !== '355', 'return visit: the number that changed counts');
  await settle(400);
  ok(c.textContent === '355', 'and lands on its new value');
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
  document.body.append(a);
  ok(celebrate(a, 'pb:Bench:2026-09-25', { storage }) === true, 'a new win celebrates');
  ok(!a.classList.contains('m-celebrate'), 'on the NEXT frame — the callers build the node before it is in the document');
  await settle(30);
  ok(a.classList.contains('m-celebrate'), 'and then it shines');
  ok(a.classList.contains('m-celebrate-pos') && !/overflow/.test(a.getAttribute('style') || ''),
     '🚨 a static host is only given position: relative — never overflow: hidden (it clipped popovers)');
  let peak = 1;
  for (let i = 0; i < 20; i++) {
    const m = /scale\(([\d.]+)\)/.exec(a.style.transform);
    if (m) peak = Math.max(peak, Number(m[1]));
    await settle(8);
  }
  ok(peak > 1.03 && peak <= POP_PEAK + 0.002, `it pops on a spring, peaking near ${POP_PEAK} (${peak.toFixed(3)})`);
  await settle(700);
  ok(!a.classList.contains('m-celebrate') && !a.classList.contains('m-celebrate-pos') && a.style.transform === '',
     'and leaves nothing behind');
  const b = document.createElement('div');
  ok(celebrate(b, 'pb:Bench:2026-09-25', { storage }) === false,
     '🚨 the same win never celebrates twice (a re-render or a second visit)');
  const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  let threw = false;
  try { celebrate(document.createElement('div'), 'k', { storage: broken }); } catch (_) { threw = true; }
  ok(!threw, 'storage that throws (private mode) never breaks a screen');
}
{
  // 🆕 A row still rising in with its list waits for it, then shines.
  const s = h(rows(3));
  document.getElementById('app').replaceChildren(s);
  const last = s.querySelectorAll('.row')[2];
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) || null, setItem: (k, v) => mem.set(k, v) };
  celebrate(last, 'win:row', { storage });
  arriveScreen(s, { key: '#/celebrate-row', route: 'me' });
  await settle(30);
  ok(last.classList.contains('m-arriving') && !last.classList.contains('m-celebrate'),
     '🚨 a celebrating row finishes arriving before it shines (it used to skip its fade-in)');
  await settle(900);
  ok(!last.classList.contains('m-arriving'), 'and it did arrive');
}
{
  // 🚨 THE DEMO SAVES NOTHING TO THE DEVICE — not even which invented win shone.
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.localStorage = window.localStorage;
  window.sessionStorage.setItem('ftrack:v1:demo', '1');
  window.localStorage.removeItem('ftrack:v1:celebrated');
  celebrate(document.createElement('div'), 'demo:win');
  ok(window.localStorage.getItem('ftrack:v1:celebrated') === null,
     '🚨 in the demo, a celebration writes NOTHING to localStorage');
  ok(/demo:win/.test(window.sessionStorage.getItem('ftrack:v1:celebrated') || ''),
     'it remembers the win in sessionStorage, gone with the tab like the rest of the demo');
  window.sessionStorage.removeItem('ftrack:v1:demo');
  celebrate(document.createElement('div'), 'real:win');
  ok(/real:win/.test(window.localStorage.getItem('ftrack:v1:celebrated') || ''), 'outside the demo it is remembered on the device');
  window.localStorage.removeItem('ftrack:v1:celebrated');
  await settle(700);
}
{
  // Source check: celebrate() is called from the three wins and nowhere else.
  const files = ['js/app.js', 'js/ui.js', ...['account', 'data', 'edit-session', 'goals', 'import', 'me', 'muscles',
    'profile', 'session', 'social', 'workouts'].map((v) => `js/views-${v}.js`)];
  const calls = Object.fromEntries(files.map((f) => [f, (read(f).match(/\bcelebrate\(/g) || []).length]));
  const where = Object.entries(calls).filter(([, n]) => n).map(([f, n]) => `${f}×${n}`).join(', ');
  // Motion 2: the check, then each personal-best row in turn (motion on and off paths).
  ok(calls['js/views-session.js'] >= 2, `the finish screen celebrates the save and the personal bests (${calls['js/views-session.js']})`);
  ok(calls['js/views-me.js'] === 2, `Profile celebrates a best lift set today and a reached goal (${calls['js/views-me.js']})`);
  ok(calls['js/views-goals.js'] === 1, `Goals celebrates a reached target (${calls['js/views-goals.js']})`);
  ok(Object.entries(calls).every(([f, n]) => !n || ['js/views-session.js', 'js/views-me.js', 'js/views-goals.js'].includes(f)),
     `🚨 no other file celebrates anything (${where})`);
  const sess = read('js/views-session.js');
  ok(/celebrate\(check/.test(sess) && /celebrate\(r, `\$\{winKey\}:pb:/.test(sess), 'on the finish screen: the check and each personal-best row');
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
  const live = sec.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.m-celebrate::after\s*\{[^}]*background-size:\s*300%/.test(live)
     && /@keyframes m-shine\s*\{[\s\S]*background-position/.test(live),
     'the shine is a band moved INSIDE its pseudo-element (so the pseudo-element is the clip)');
  ok(!/\.m-celebrate\s*\{[^}]*overflow/.test(live), '🚨 and the host is never given overflow: hidden');
  ok(!/@keyframes m-pop/.test(live) && POP_PEAK <= 1.06, `the pop is a spring now (peak ${POP_PEAK}), not a keyframe`);
  ok(/prefers-reduced-motion: reduce[\s\S]*\.m-celebrate::after[\s\S]*animation:\s*none/.test(live),
     '🚨 under reduced motion the shine is OFF, not just fast');
  ok(/\.m-arriving\s*\{[^}]*transition:\s*none/.test(live),
     '🚨 no CSS transition may chase a spring\'s inline writes while a row arrives');
  ok(/\.btn:active\s*\{[^}]*scale\(\.97\)/.test(live) && !/\.btn[^{]*:active[^{]*\{[^}]*filter/.test(live),
     'a button press: scale .97 and NO brightness lift');
  ok(/\.btn:not\(\.primary\)[^{]*:active\s*\{[^}]*--raised-hi/.test(live),
     'a raised button presses to --raised-hi in both themes');
  ok(/\.row:active, \.vol-row:active[^{]*\{[^}]*transform:\s*none/.test(live) && !/\.row[^{]*:active[^{]*\{[^}]*(filter|scale)/.test(live),
     '🚨 a pressed row only changes colour — no scale, no filter (content never moves on tap)');
  ok(/addEventListener\('touchstart',\s*\(\)\s*=>\s*\{\},\s*\{\s*passive:\s*true\s*\}\)/.test(read('js/app.js')),
     '⚠️ app.js adds the passive touchstart listener iOS Safari needs before :active fires at all');
  ok(/@keyframes m-tab-pop[\s\S]*scale\(1\.12\)/.test(sec), 'the tab icon pops to 1.12');
  ok(/tabular-nums/.test(sec), 'counted numbers are tabular, so a count never changes their width');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
