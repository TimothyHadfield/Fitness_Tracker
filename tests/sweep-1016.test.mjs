// Bug sweep 2026-10-16: verified defects, each seen FAILING on the code before
// the fix (scratchpad run against e8c5b41), then passing after it.
//
//   node tests/sweep-1016.test.mjs      (needs jsdom, like render.test.mjs)
//
//   1. Data → Volume printed the span unrounded ("last 13.333333333333334 days").
//   2. Goals' short-window rows printed the same raw span.
//   3. Custom exercise: the "Closest library exercise" pick carried over into
//      the NEXT custom-exercise sheet instead of starting on "None".
//   4. A custom exercise made from the picker was missing from the screen's own
//      exercise map ("Unknown exercise" in the builder; wrong fields in Edit).
//   5. Editing an old record: deleting its last drop brought every drop back
//      (minisOf() fell back to the legacy `drops` key).
//   6. The service worker stored ANY in-scope page (another .html, a 404) as the
//      offline copy of the app.
//   7. A navigation that arrived while a screen was still loading was dropped:
//      the address said one screen, the app showed another.
//   8. Source checks for three one-line fixes that need a live account to drive:
//      the display-name screen no longer jumps to #/social, the "Equipment
//      today" toast counts with the same rule as the swap, and the offline
//      Account screen's 'online' listener goes once the screen has gone.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const INDEX = read('index.html');

const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#0F1214"></head><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
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

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const safe = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name} threw: ${e && e.stack}`); } };

const BASE = new URL('../js/', import.meta.url).href;
const { store, todayISO } = await import(BASE + 'store.js');
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const exOf = (name) => {
  const e = BUILT_IN_EXERCISES.find((x) => x.name === name);
  if (!e) throw new Error(`fixture missing exercise: ${name}`);
  return e;
};
const daysAgo = (n) => {
  const d = new Date(todayISO() + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DECIMAL_DAYS = /\d\.\d+ days?/;

/* ============ 1. Volume: the span is a whole number of days ============ */
await safe('volume span', async () => {
  const { renderVolumePane } = await import(BASE + 'views-data.js');
  const bench = exOf('Barbell Bench Press');
  // A new account, four sessions on uneven gaps (11, 8, 4 and 1 days ago):
  // the span the store measures is 4 × the mean gap = 13.33… days.
  const rows = [11, 8, 4, 1].map((n) => ({
    id: 'v' + n, date: daysAgo(n), workoutName: 'Push',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }] }],
  }));
  const { weeklyVolumeByMuscle } = await import(BASE + 'store.js');
  const v = await weeklyVolumeByMuscle(28, null, rows);
  ok(v && !Number.isInteger(v.spanDays), `(guard) the fixture's measured span is fractional (${v && v.spanDays})`);
  const host = document.createElement('div');
  const top = document.createElement('div');
  document.body.append(top, host);
  await renderVolumePane(host, top, { rows });
  const intro = host.querySelector('.vol-intro-main');
  const text = intro ? intro.textContent : '';
  ok(/sessions · last \d+ days$/.test(text), `the Volume intro shows whole days ("${text}")`);
  ok(!DECIMAL_DAYS.test(host.textContent), 'no fractional day count anywhere on the pane');
  host.remove(); top.remove();
});

/* ============ 2. Goals: the same span, rounded ============ */
await safe('goals span', async () => {
  const G = await import(BASE + 'goals.js');
  const req = G.requirementsFor('committed', { bodyWeight: 180 });
  const rows = G.stallReasons({ requirements: req, muscle: 'Chest',
    measured: { enough: false, totalSets: 6, daysTrained: 2, spanDays: 13.333333333333334, sessions: 4, weeklySets: 4.7, sessionsPerWeek: 1.5 } });
  const all = rows.map((r) => `${r.short} ${r.detail}`).join(' ');
  ok(/over [\d.]+ days/.test(all), '(guard) the short-window rows do state the span');
  ok(/over 13 days/.test(all), 'as a whole number of days ("over 13 days")');
  ok(!DECIMAL_DAYS.test(all), `no fractional day count in the Goals rows (${(all.match(DECIMAL_DAYS) || ['none'])[0]})`);
});

/* ============ 3 + 4. The custom-exercise sheet ============ */
const W = await import(BASE + 'views-workouts.js');
const noneSelects = () => [...document.querySelectorAll('select')]
  .filter((s) => s.options.length > 1 && s.options[0].textContent === 'None');
const button = (label) => [...document.querySelectorAll('button')].reverse().find((b) => b.textContent.trim() === label);
const closeSheets = () => document.querySelectorAll('.sheet-backdrop, .sheet, .sheet-wrap, [role="dialog"]').forEach((n) => n.remove());

await safe('stand-in default', async () => {
  await store.clearAll();
  W.openCustomExerciseSheet(() => {});
  await settle();
  const first = noneSelects().pop();
  ok(first && first.value === '', '(guard) the first sheet opens on "None"');
  first.value = first.options[5].value;
  ok(first.value !== '', '(guard) a library exercise was picked in the first sheet');
  closeSheets();
  W.openCustomExerciseSheet(() => {});
  await settle();
  const second = noneSelects().pop();
  ok(second && second !== first, '(guard) a second, new sheet');
  ok(second && second.value === '', `the next custom exercise starts on "None" again (got "${second && second.value}")`);
  closeSheets();
});

await safe('exMap after create', async () => {
  await store.clearAll();
  const exMap = await store.getExerciseMap();
  let picked = null;
  await W.openExercisePicker({ exMap, onPick: (ex) => { picked = ex; } });
  await settle();
  button('Create custom').click();
  await settle(150);
  const name = [...document.querySelectorAll('input')].reverse().find((i) => i.placeholder === 'Exercise name');
  name.value = 'Sweep Test Press';
  button('Create exercise').click();
  await settle(150);
  ok(picked && picked.isCustom, `(guard) the new custom exercise reached onPick (${picked && picked.name})`);
  ok(picked && exMap.has(picked.id), 'and it is in the exercise map the screen is holding');
  ok(picked && exMap.get(picked.id) && exMap.get(picked.id).name === 'Sweep Test Press', 'with its own name, so the row is not "Unknown exercise"');
  closeSheets();
});

/* ============ 5. Editing an old record with legacy `drops` ============ */
await safe('legacy drops', async () => {
  await store.clearAll();
  const bench = exOf('Barbell Bench Press');
  await store.saveSession({
    id: 'legacy-drops', date: daysAgo(3), workoutName: 'Old',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, setType: 'drop',
      sets: [{ weight: 135, reps: 8, drops: [{ weight: 95, reps: 6 }, { weight: 65, reps: 6 }] }] }],
  });
  const saved = await store.getSession('legacy-drops');
  ok(saved && Array.isArray(saved.entries[0].sets[0].drops), '(guard) the record really carries the old `drops` key');
  const { EditSessionView } = await import(BASE + 'views-edit-session.js');
  const screen = await EditSessionView('legacy-drops');
  document.getElementById('app').replaceChildren(screen);
  await settle();
  const drops = () => [...screen.querySelectorAll('.edit-set.is-drop')];
  ok(drops().length === 2, `(guard) both drops are shown (${drops().length})`);
  drops()[1].querySelector('.set-del').click();
  await settle();
  ok(drops().length === 1, `deleting one drop leaves one (${drops().length})`);
  drops()[0].querySelector('.set-del').click();
  await settle();
  ok(drops().length === 0, `deleting the last drop leaves none — they do not all come back (${drops().length})`);
  document.getElementById('app').replaceChildren();
});

/* ============ 6. The service worker's offline copy of the app ============ */
await safe('sw navigate cache', async () => {
  const SRC = read('sw.js');
  const ORIGIN = 'https://timothyhadfield.github.io';
  const listeners = {};
  const stored = new Map();
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN + '/app/').href;
  const cache = {
    async match(u) { const k = abs(u); return stored.has(k) ? { body: stored.get(k), headers: new Map() } : undefined; },
    async put(u, res) { stored.set(abs(u), res.body); },
    async add(req) { stored.set(abs(req), 'net:' + req.url); },
  };
  class Req { constructor(url, init = {}) { this.url = abs(url); this.mode = init.mode || 'cors'; this.method = 'GET'; this.cache = init.cache || 'default'; } }
  const ctx = {
    self: {
      location: new URL(ORIGIN + '/app/sw.js'),
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      registration: { scope: ORIGIN + '/app/', unregister: async () => {} },
    },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      const missing = /nope/.test(url);
      return { ok: !missing, status: missing ? 404 : 200, type: 'basic', body: 'net:' + url, headers: new Map(), clone() { return this; } };
    },
    Request: Req, Response: { error: () => ({ error: true }) }, URL, console, Promise, Date,
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const nav = async (path) => {
    let p = null;
    listeners.fetch({ request: new Req(ORIGIN + path, { mode: 'navigate' }), respondWith: (x) => { p = x; } });
    const res = await p;
    await settle(5);
    return res;
  };
  const shell = () => stored.get(ORIGIN + '/app/index.html');
  await nav('/app/');
  ok(shell() === 'net:' + ORIGIN + '/app/', '(guard) opening the app keeps it as the offline copy');
  await nav('/app/docs/running-costs.html');
  ok(shell() === 'net:' + ORIGIN + '/app/', `another page in scope does not replace the offline app (${shell()})`);
  await nav('/app/nope.html');
  ok(shell() === 'net:' + ORIGIN + '/app/', 'nor does a 404 page');
  await nav('/app/index.html');
  ok(shell() === 'net:' + ORIGIN + '/app/index.html', '(guard) index.html itself still refreshes it');
});

/* ============ 7. A navigation during a render is not lost ============ */
await safe('render queue', async () => {
  const skel = INDEX.match(/<div id="app" data-skel>[\s\S]*?<\/nav><div class="screen boot-shell"><\/div><\/div>/)[0];
  document.body.innerHTML = skel;
  localStorage.setItem('ftrack:v1:onboarded', '2026-09-01');
  await store.saveSettings({ displayName: 'Sweep', units: 'lbs', onboardedAt: '2026-09-01' });
  history.replaceState(null, '', '#/home');
  await import(BASE + 'app.js');
  await settle(600);
  const lit = () => {
    const a = document.querySelector('#app .navbar a[aria-current="page"]');
    return a ? a.textContent.trim() : '';
  };
  ok(lit() === 'Home', `(guard) the app booted on Home (${lit()})`);
  // Two taps in quick succession: Data, then Profile before Data has drawn.
  history.pushState(null, '', '#/graphs');
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  history.pushState(null, '', '#/me');
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await settle(2500);
  ok(location.hash === '#/me', '(guard) the address is Profile');
  ok(lit() === 'Profile', `and the screen drawn is Profile too, not the one tapped first (lit: ${lit()})`);
});

/* ============ 8. Source checks ============ */
{
  const soc = read('js/views-social.js');
  const fn = soc.slice(soc.indexOf('function nameSetupScreen('), soc.indexOf('return screenShell(', soc.indexOf('function nameSetupScreen(')));
  ok(fn.length > 50 && /refreshRoute\(\)/.test(fn) && !/\brefresh\(\)/.test(fn),
     'the display-name screen re-renders where it is (#/add, #/find), not #/social');
  const ses = read('js/views-session.js');
  const eq = ses.slice(ses.indexOf('async function setEquipmentToday('), ses.indexOf('/** The empty workout'));
  ok(eq.length > 50 && /fitsEquipment\(ex, EQUIPMENT_TODAY\[kind\]\)/.test(eq),
     'the "Equipment today" toast counts leftovers with fitsEquipment(), the swap\'s own rule');
  const acc = read('js/views-account.js');
  const on = acc.slice(acc.indexOf('const onOnline ='), acc.indexOf("window.addEventListener('online', onOnline)"));
  ok(on.length > 10 && /retryBtn\.isConnected/.test(on) && /removeEventListener\('online', onOnline\)/.test(on),
     "the offline Account screen's 'online' handler removes itself once the screen is gone");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
