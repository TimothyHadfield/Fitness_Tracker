// Data-safety audit, the screen half — 2026-10-17.
//   node tests/datasafety-ui-1017.test.mjs      (needs jsdom)
//
// 4. After a deploy a lazily loaded screen can fail to import against the old
//    store.js in memory; the loader now reloads the page ONCE (per minute, per
//    tab), and never while offline.
// 7. #/day/garbage printed "Invalid Date Invalid Date"; it reads Not found.
//
// Seen FAILING on main (151b08b) before the fix, then passing.
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
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const sess = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const text = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');

/* ---- 7. a day that is not a date ---- */
console.log('\n--- 7. #/day/<not a date> ---\n');
const { DayView } = await import(new URL('../js/views-data.js', import.meta.url).href);
for (const bad of ['garbage', '2026-13-45', '2026-02-30', '']) {
  const node = await DayView(bad);
  const t = text(node);
  ok(!/Invalid Date/.test(t) && /Not found/.test(t), `#/day/${bad || '(empty)'} reads Not found, never "Invalid Date" ("${t.slice(0, 60)}")`);
}
const good = text(await DayView('2026-10-17'));
ok(!/Not found/.test(good) && /Nothing recorded on this day/.test(good), 'a real day with nothing on it is unchanged');

/* ---- 4. the lazy screen loader reloads once after a failed import ---- */
// app.js boots the whole app on import, so the function is lifted out of the
// source and run against a fake window (the same text the browser runs).
console.log('\n--- 4. A failed screen load after a deploy ---\n');
const src = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const start = src.indexOf('export function reloadOnceForNewBuild');
ok(start > 0, 'app.js has reloadOnceForNewBuild()');
ok(/load\(\)\.catch\(\(err\) => \{ p = null; reloadOnceForNewBuild\(\); throw err; \}\)/.test(src),
  'the lazy loader calls it when a screen import fails');
const fnSrc = src.slice(start, src.indexOf('\n}\n', start) + 2).replace('export function', 'function');
const keyLine = src.match(/const RELOAD_KEY = '[^']+';/)[0];
const reloadOnce = new Function(`${keyLine}\n${fnSrc}\nreturn reloadOnceForNewBuild;`)();
const fakeEnv = (online) => {
  const store = new Map();
  let reloads = 0;
  return {
    navigator: { onLine: online },
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    location: { reload: () => { reloads++; } },
    get reloads() { return reloads; },
    store,
  };
};
const env = fakeEnv(true);
ok(reloadOnce(env) === true && env.reloads === 1, 'online: the first failure reloads the page');
ok(reloadOnce(env) === false && env.reloads === 1, 'a second failure within a minute does not (no loop)');
env.store.set('ftrack:v1:lazyReloadAt', String(Date.now() - 61000));
ok(reloadOnce(env) === true && env.reloads === 2, 'a later deploy can reload again');
const off = fakeEnv(false);
ok(reloadOnce(off) === false && off.reloads === 0, 'offline: no reload (the error is shown instead)');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
