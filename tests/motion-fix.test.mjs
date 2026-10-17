// Motion/speed audit fixes, 2026-10-17. Each check was seen FAILING against the
// code before the fix (MF_ROOT=<export of main 3ffe3c3>), then passing on it.
//
//   node tests/motion-fix.test.mjs
//
//   1. sw.js: a slow network no longer holds the app's first paint hostage —
//      after ~2 s the cached app is served and the network copy still lands.
//   2. e1rm bodyWeightOn: the weigh-ins are sorted once per list, not per call,
//      and an in-place edit of a weigh-in still changes the answer.
//   3. Source checks for the parts only a browser can lay out (measured in the
//      report instead): idle chunking, cached phone query, update bar spring,
//      pressed states, the steady Data controls row, the 16px date box, the
//      Profile switch kept under the finger.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = process.env.MF_ROOT ? pathToFileURL(process.env.MF_ROOT.replace(/[\\/]?$/, '/')) : new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const safe = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name} threw: ${e && e.stack || e}`); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============ 1. Slow network: the cached app within ~2 s ============ */
await safe('sw slow network', async () => {
  const SRC = read('sw.js');
  const ORIGIN = 'https://timothyhadfield.github.io';
  const listeners = {};
  const stored = new Map();
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN + '/app/').href;
  stored.set(ORIGIN + '/app/index.html', 'cached-shell');
  const cache = {
    async match(u) { const k = abs(u); return stored.has(k) ? { body: stored.get(k), headers: new Map(), clone() { return this; }, text: async () => stored.get(k) } : undefined; },
    async put(u, res) { stored.set(abs(u), res.body); },
    async add(req) { stored.set(abs(req), 'net:' + req.url); },
  };
  class Req { constructor(url, init = {}) { this.url = abs(url); this.mode = init.mode || 'cors'; this.method = 'GET'; this.cache = init.cache || 'default'; } }
  const NET_MS = 3500;
  const ctx = {
    self: {
      location: new URL(ORIGIN + '/app/sw.js'),
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      registration: { scope: ORIGIN + '/app/', unregister: async () => {} },
    },
    caches: { open: async () => cache, match: async (u) => cache.match(u), keys: async () => [], delete: async () => true },
    fetch: (req) => new Promise((r) => setTimeout(() => {
      const url = typeof req === 'string' ? req : req.url;
      r({ ok: true, status: 200, type: 'basic', body: 'net:' + url, headers: new Map(), clone() { return this; }, text: async () => 'net:' + url });
    }, NET_MS)),
    Request: Req, Response: { error: () => ({ error: true }) }, URL, console, Promise, Date, setTimeout, clearTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  let p = null;
  const kept = [];
  const t0 = Date.now();
  listeners.fetch({
    request: new Req(ORIGIN + '/app/', { mode: 'navigate' }),
    respondWith: (x) => { p = x; },
    waitUntil: (x) => { kept.push(x); },
  });
  const res = await p;
  const took = Date.now() - t0;
  ok(took < 2800, `a 3.5 s network: the app is answered in ${took} ms (cap 2800)`);
  ok(res && res.body === 'cached-shell', `and the answer is the cached app (${res && res.body})`);
  await wait(NET_MS + 300);
  await Promise.all(kept.map((k) => Promise.resolve(k).catch(() => {})));
  ok(stored.get(ORIGIN + '/app/index.html') === 'net:' + ORIGIN + '/app/',
    `the network copy still replaces the offline app once it arrives (${stored.get(ORIGIN + '/app/index.html')})`);
});

/* ============ 2. bodyWeightOn sorts once per list ============ */
await safe('bodyWeightOn memo', async () => {
  const { bodyWeightOn } = await import(new URL('js/e1rm.js', ROOT).href);
  // Real shape: one weigh-in every few days for ~3 years, out of order.
  const rows = [];
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2023, 0, 1 + i * 3));
    rows.push({ date: d.toISOString().slice(0, 10), weight: 170 + (i % 23) * 0.4 });
  }
  rows.reverse();
  const brute = (date) => {
    let best = null;
    for (const r of rows) if (r.date <= date && (!best || r.date >= best.date)) best = r;
    if (best) return best;
    // Before every weigh-in: the earliest one is carried backward.
    for (const r of rows) if (!best || r.date < best.date) best = r;
    return best;
  };
  const dates = ['2023-01-01', '2023-06-15', '2024-02-29', '2025-12-31', '2022-12-31'];
  const realSort = Array.prototype.sort;
  let sorts = 0;
  Array.prototype.sort = function (...a) { sorts++; return realSort.apply(this, a); };
  let agree = true;
  try {
    for (let k = 0; k < 40; k++) {
      for (const d of dates) {
        const got = bodyWeightOn(rows, d);
        const want = brute(d);
        const gw = got && typeof got === 'object' ? got.weight : got;
        if ((want ? want.weight : null) !== (gw == null ? null : gw)) agree = false;
      }
    }
  } finally { Array.prototype.sort = realSort; }
  ok(agree, 'the newest weigh-in on or before each day, same as a full scan');
  ok(sorts <= 2, `200 calls on one list sort it at most twice (${sorts})`);
  // An in-place edit (the store edits rows it already handed out) is noticed.
  const target = rows.find((r) => r.date === brute('2024-02-29').date);
  target.weight = 999;
  const after = bodyWeightOn(rows, '2024-02-29');
  ok((after && typeof after === 'object' ? after.weight : after) === 999, 'an edited weigh-in changes the answer');
});

/* ============ 3. Source checks ============ */
await safe('sources', async () => {
  const store = read('js/store.js');
  const app = read('js/app.js');
  const css = read('css/app.css');
  const gestures = read('js/gestures.js');
  const motion = read('js/motion.js');
  const data = read('js/views-data.js');
  const sw = read('sw.js');
  ok(/computeMuscleStrength\(\{\s*pause/.test(store), 'the strength warm-up yields between muscles');
  ok(/export function idleTask/.test(store), 'warm-up jobs run one per idle slot');
  ok(/function warmScreensWhenIdle/.test(app) && /prewarmProfile/.test(app), 'screens and the profile ranking are prepared when idle');
  ok(/matchMedia\(`\(max-width/.test(gestures), 'isPhone reads a cached media query, not innerWidth per touch');
  ok(/inView\(n, view\)/.test(motion), 'motion reads the viewport once per pass');
  ok(/NAV_WAIT_MS\s*=\s*2000/.test(sw), 'the navigation waits 2 s for the network');
  ok(/Updating…/.test(app) && /function dismissUpdateBar/.test(app) && /SURFACE_SPRINGS\.toast/.test(app),
    'the update bar springs in and out like a toast and says Updating… on Refresh');
  ok(/\.seg:active\s*\{/.test(css) && /\.set-del:active\s*\{/.test(css) && /\.help-dot:active\s*\{/.test(css),
    'pressed states for the switch segments, the set delete and the ? dots');
  ok(/\.graph-controls\s*\{\s*min-height:\s*44px/.test(css), 'the Data controls row keeps a steady height');
  ok(/input\.session-date\s*\{\s*font-size:\s*16px/.test(css), "the runner's date box is 16px (no iOS zoom)");
  ok(/function holdSwitchStart/.test(data) && /glide:\s*!land/.test(data), 'Profile keeps the Months/Years switch under the finger');
});

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nall passed');
