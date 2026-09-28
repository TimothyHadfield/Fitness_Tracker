// "Keep your training" — the account nudge after the FIRST saved workout
// (js/first-save.js, overhaul O-13, 2026-09-27).
//
//   node tests/first-save.test.mjs      (needs jsdom, like onboarding.test.mjs)
//
// Pinned: when it may show (once, never in the demo, only to an anonymous
// cloud account on its first workout), the iOS-Safari-tab test, and the sheet.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

let F = null;
try { F = await import('../js/first-save.js'); } catch (e) { ok(false, `js/first-save.js loads (${e.message})`); }
if (!F) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }
const { shouldNudge, maybeFirstSaveNudge, isIosSafariTab, NUDGE_KEY, NUDGE } = F;

ok(NUDGE_KEY === 'ftrack:v1:saved-nudge', 'the flag lives at ftrack:v1:saved-nudge');
ok(typeof maybeFirstSaveNudge === 'function', 'maybeFirstSaveNudge() is exported for the runner');

/* ---- when ---- */
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const anon = (extra = {}) => ({
  storage: store(),
  demoActive: () => false,
  authState: async () => ({ mode: 'cloud', user: { uid: 'u1', isAnonymous: true } }),
  getSessions: async () => [{ id: 's1', date: '2026-09-27' }],
  ...extra,
});
ok(await shouldNudge(anon()) === true, 'an anonymous account that just saved its first workout: yes');
ok(await shouldNudge(anon({ demoActive: () => true })) === false, 'never in the demo');
{
  const d = anon({ authState: async () => ({ mode: 'cloud', user: { uid: 'u1', isAnonymous: false, email: 'a@b.c' } }) });
  ok(await shouldNudge(d) === false && d.storage.m.has(NUDGE_KEY), 'a real account: no, and never asked again');
}
{
  const d = anon({ getSessions: async () => [{ id: 's1' }, { id: 's2' }] });
  ok(await shouldNudge(d) === false && d.storage.m.has(NUDGE_KEY), 'a second workout is not the first: no, for good');
}
ok(await shouldNudge(anon({ authState: async () => ({ mode: 'local', degraded: true }) })) === false,
   'offline / cloud not reached: no account can be made now, so no');
ok(await shouldNudge(anon({ getSessions: async () => [] })) === false, 'nothing saved yet: no');
{
  const d = anon();
  d.storage.setItem(NUDGE_KEY, 'x');
  ok(await shouldNudge(d) === false, 'shown once: never twice');
}
ok(await shouldNudge(anon({ getSessions: async () => { throw new Error('offline'); } })) === false,
   'a read that fails means no');

/* ---- iOS Safari tab ---- */
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const CRIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const noMM = { matchMedia: () => ({ matches: false }) };
ok(isIosSafariTab({ userAgent: IPHONE }, noMM) === true, 'iPhone Safari in a tab: yes');
ok(isIosSafariTab({ userAgent: IPHONE, standalone: true }, noMM) === false, 'installed to the home screen: no');
ok(isIosSafariTab({ userAgent: IPHONE }, { matchMedia: () => ({ matches: true }) }) === false, 'display-mode standalone: no');
ok(isIosSafariTab({ userAgent: IPAD, maxTouchPoints: 5 }, noMM) === true, 'iPad (reports as a Mac with touch): yes');
ok(isIosSafariTab({ userAgent: IPAD, maxTouchPoints: 0 }, noMM) === false, 'a real Mac: no');
ok(isIosSafariTab({ userAgent: CRIOS }, noMM) === false, 'Chrome on iPhone: no');
ok(isIosSafariTab({ userAgent: WIN }, noMM) === false, 'Windows: no');

/* ---- the sheet ---- */
{
  const d = anon({ ios: true });
  const shown = await maybeFirstSaveNudge(d);
  await settle(50);
  ok(shown === true && d.storage.m.has(NUDGE_KEY), 'it shows, and marks itself shown');
  const text = document.body.textContent;
  ok(text.includes('Keep your training'), 'titled "Keep your training"');
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
  ok(['Continue with Google', 'Use email', 'Later'].every((l) => btns.includes(l)), `three choices (${btns.join(' | ')})`);
  ok(text.includes(NUDGE.ios) && document.querySelector('.first-save-ios svg'), 'the iOS tab gets the Add to Home Screen line, with the share glyph');
  const words = (s) => s.trim().split(/\s+/).length;
  ok(Object.values(NUDGE).every((s) => words(s) <= 15), 'every line is under 15 words');
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Use email').click();
  await settle(50);
  ok(location.hash === '#/account', `Use email goes to the Account screen (${location.hash})`);
  ok(await maybeFirstSaveNudge(d) === false, 'and it never shows again');
}
{
  const d = anon({ ios: false });
  await maybeFirstSaveNudge(d);
  await settle(50);
  const sheets = document.querySelectorAll('.first-save');
  const last = sheets[sheets.length - 1];
  ok(sheets.length >= 1 && last.textContent.includes('Later') && !last.querySelector('.first-save-ios'),
     'anywhere else: no Add to Home Screen line');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
