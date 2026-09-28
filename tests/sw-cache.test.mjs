// The service worker's install mode and its Firebase SDK cache — 2026-09-27
// (overhaul R-1a, R-9).   node tests/sw-cache.test.mjs   (no browser needed)
//
// sw.js runs here inside a vm with fake `self`, `caches` and `fetch`, so what
// is pinned is what the worker ASKS for, not what a browser does with it:
//   R-9  every shell file is precached with `cache: 'no-cache'` (a conditional
//        GET that GitHub Pages answers 304), never 'reload' (a second download).
//   R-1a the three versioned firebasejs 10.12.2 files are precached at install
//        and served cache-first, so a cold start with no signal can load the
//        SDK. Every other cross-origin request (Firestore) is left alone.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const SRC = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://timothyhadfield.github.io';
const SDK = ['app', 'auth', 'firestore'].map((n) => `https://www.gstatic.com/firebasejs/10.12.2/firebase-${n}.js`);

function makeWorker() {
  const listeners = {};
  const store = new Map();          // url -> body
  const netLog = [];                // every Request the worker sent to the network
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN + '/app/').href;
  const cache = {
    async match(u) { const k = abs(u); return store.has(k) ? { body: store.get(k), headers: new Map(), fromCache: true } : undefined; },
    async put(u, res) { store.set(abs(u), res.body); },
    async add(req) { netLog.push(req); store.set(abs(req), 'net:' + req.url); },
  };
  class Req {
    constructor(url, init = {}) { this.url = abs(url); this.cache = init.cache || 'default'; this.mode = init.mode || 'cors'; this.method = 'GET'; }
  }
  const ctx = {
    self: {
      location: new URL(ORIGIN + '/app/sw.js'),
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      registration: { unregister: async () => {} },
    },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (req) => {
      netLog.push(req);
      const url = typeof req === 'string' ? req : req.url;
      return { ok: true, type: 'cors', body: 'net:' + url, headers: new Map(), clone() { return this; } };
    },
    Request: Req, Response: { error: () => ({ error: true }) }, URL, console, Promise, Date,
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { listeners, store, netLog, Req };
}

async function install(w) {
  let p;
  w.listeners.install({ waitUntil: (x) => { p = x; } });
  await p;
}

/* ---------- R-9: the install mode ---------- */
{
  const w = makeWorker();
  await install(w);
  const shell = w.netLog.filter((r) => r.url.startsWith(ORIGIN));
  ok(shell.length > 50, `install precaches the whole shell (${shell.length} files)`);
  const modes = [...new Set(shell.map((r) => r.cache))];
  ok(modes.length === 1 && modes[0] === 'no-cache',
     `every shell file is fetched with cache 'no-cache', a conditional GET (saw ${modes.join(', ')})`);
  ok(!shell.some((r) => r.cache === 'reload'), "no shell file bypasses the HTTP cache with 'reload'");

  /* ---------- R-1a: the SDK is precached ---------- */
  for (const u of SDK) ok(w.store.has(u), `install precaches ${u.split('/').pop()}`);
  ok(w.store.has(ORIGIN + '/app/js/wake-lock.js') && w.store.has(ORIGIN + '/app/js/first-save.js'),
     'wake-lock.js and first-save.js are in the offline shell');
}

/* ---------- R-1a: served cache-first, with no network ---------- */
{
  const w = makeWorker();
  await install(w);
  w.netLog.length = 0;
  let responded = null;
  w.listeners.fetch({ request: new w.Req(SDK[2]), respondWith: (p) => { responded = p; } });
  const res = responded ? await responded : null;
  ok(res && res.fromCache, 'firebase-firestore.js is answered from the cache');
  ok(w.netLog.length === 0, 'and the network is never asked (a cold start in a basement)');

  // Not cached yet (the install had no signal): fetched once, then kept.
  w.store.delete(SDK[0]);
  responded = null;
  w.listeners.fetch({ request: new w.Req(SDK[0]), respondWith: (p) => { responded = p; } });
  const res2 = responded ? await responded : null;
  await new Promise((r) => setTimeout(r, 0));
  ok(res2 && res2.ok && w.store.has(SDK[0]), 'a missing SDK file is fetched and then kept');

  // Firestore itself, and any other gstatic file, are untouched.
  for (const other of [
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js',
    'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js',
  ]) {
    let touched = false;
    w.listeners.fetch({ request: new w.Req(other), respondWith: () => { touched = true; } });
    ok(!touched, `left alone: ${other.replace('https://', '').slice(0, 60)}`);
  }
}

/* ---------- the URLs agree with what the app imports ---------- */
{
  const fb = readFileSync(new URL('../js/firebase-backend.js', import.meta.url), 'utf8');
  const base = (fb.match(/const SDK = '([^']+)'/) || [])[1];
  ok(base === 'https://www.gstatic.com/firebasejs/10.12.2/',
     `firebase-backend.js imports the SDK version the worker caches (${base})`);
  const imported = [...fb.matchAll(/SDK\s*\+\s*'([^']+)'|`\$\{SDK\}([^`]+)`/g)].map((m) => m[1] || m[2]);
  ok(imported.length === 0 || imported.every((f) => SDK.includes(base + f)),
     `every SDK file the app imports is one the worker caches (${imported.join(', ') || 'by constant'})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
