// Project-lead batch 2026-10-17: the sweep's still-open findings plus one gap
// in how a phone picks up a new build. Every check below was seen FAILING on
// d25fab3 before its fix.            node tests/lead-1017.test.mjs  (no browser)
//
//   1. Import: a "Time" column next to Date + Weight (a scale export) was read as
//      a DURATION, so a weigh-in file also created fake ~7-minute activities.
//   2. Import: a weigh-in on a day you already logged by hand silently replaced
//      yours, while the confirm sheet said "Nothing is deleted".
//   3. Goals → Programs that fit: a copied Bumstead programme (6 workouts, an
//      8-day cycle) read its goal-muscle sets ~14 % high, because that screen
//      counted weeks its own way instead of the rating's weeksForRotation().
//   4. Compare: a set holding only {done: true} counted as a recorded set.
//   5. Keep-screen-on: turning it off left the release() promise's rejection
//      unhandled.
//   6. Notes inbox: a note's day was its UTC day (an evening note in Utah showed
//      as tomorrow).
//   7. Program/workout editors: a failed save threw away silently (no toast).
//   8. CSS: `.just-for` used an undefined `--line`, so its dashed edge never drew.
//      Now a guard: every var(--x) the stylesheet reads must be defined.
//   9. Service worker: after a deploy the update bar's Refresh could load the NEW
//      app.js beside OLD copies of screens that had not been opened yet (only
//      the files the page had requested were refreshed). Now every shell file is
//      brought up to date, and Refresh waits for that before reloading.
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;

/* ---------- 1. "Time" in a weigh-in file is the time of day ---------- */
{
  const imp = await import('../js/import-file.js');
  const scale = imp.detectColumns(['Date', 'Time', 'Weight (lb)']);
  ok(scale.date === 'Date' && scale.weight === 'Weight (lb)', 'a scale export: date and weight found');
  ok(!scale.duration, `its "Time" column is not read as a duration (got ${scale.duration || 'none'})`);
  const records = [
    { Date: '2026-10-01', Time: '07:15', 'Weight (lb)': '181.2' },
    { Date: '2026-10-02', Time: '07:09', 'Weight (lb)': '180.8' },
  ];
  const acts = scale.duration ? imp.readActivities(records, scale).rows : [];
  ok(acts.length === 0, `so it creates no activities (got ${acts.length})`);
  ok(imp.readWeights(records, scale).rows.length === 2, 'and still both weigh-ins');

  // A run log keeps its "Time" as the run's duration.
  const run = imp.detectColumns(['Date', 'Time', 'Distance (mi)']);
  ok(run.duration === 'Time', 'a run log (Date, Time, Distance) still reads Time as the duration');
  ok(imp.readDuration('7:15 AM') === null, 'a clock time with AM/PM is never a duration');
}

/* ---------- 2. an import never replaces a weigh-in already on that day ---------- */
{
  const imp = await import('../js/import-file.js');
  const mine = [{ id: 'bw-hand', date: '2026-10-01', weight: 182 }];
  const rows = [
    { id: 'imp_bw_x', date: '2026-10-01', weight: 181.2 },
    { id: 'imp_bw_y', date: '2026-10-02', weight: 180.8 },
  ];
  const plan = imp.planImport(rows, mine, (r) => r.date, { keepSameDay: true });
  ok(plan.fresh.length === 1 && plan.fresh[0].date === '2026-10-02',
     `only the new day is imported (fresh: ${plan.fresh.map((r) => r.date).join(', ')})`);
  ok(plan.kept === 1, `the hand-logged day is counted as kept (got ${plan.kept})`);
  const view = read('js/views-import.js');
  ok(/planImport\(read\.rows, weights, \(r\) => r\.date, \{ keepSameDay: true \}\)/.test(view),
     'the import screen plans weigh-ins with keepSameDay');
}

/* ---------- 3. Programs that fit: one week count, the rating's ---------- */
{
  const { rateUserSystem, weeksForRotation } = await import('../js/optimal.js');
  const six = Array.from({ length: 6 }, () => ({ exercises: [] }));
  const r = rateUserSystem(six, new Map(), {
    sessionDates: [], todayISO: '2026-10-17', declaredDaysPerWeek: 6, cycleDays: 8,
  });
  ok(Math.abs((r.weeks || 0) - weeksForRotation(6, 6, 8)) < 1e-9,
     `the rating reports the weeks it used (${r.weeks} vs ${weeksForRotation(6, 6, 8)})`);
  const goals = read('js/views-goals.js');
  ok(!/own\.length \/ rating\.daysPerWeek/.test(goals) && !/built\.length \/ p\.daysPerWeek/.test(goals),
     'Programs that fit no longer counts weeks its own way');
  ok((goals.match(/weeklyVolume\([^)]*rating\.weeks\)/g) || []).length === 2,
     'both rows (yours and the ready-made) read the rating\'s weeks');
}

/* ---------- 4. a {done:true}-only set is not a recorded set ---------- */
{
  const { compareExercise } = await import('../js/compare.js');
  const side = (sets) => [{ date: '2026-10-01', entries: [{ exerciseId: 'bench', exerciseName: 'Bench', sets }] }];
  const res = compareExercise({
    mine: side([{ weight: 135, reps: 5, done: true }, { done: true }]),
    theirs: side([{ weight: 155, reps: 5 }]),
    exerciseId: 'bench', exercise: { name: 'Bench', fields: ['weight', 'reps'] },
  });
  ok(res.counts.mine.sets === 1, `an empty ticked set is not counted (counted ${res.counts.mine.sets})`);
}

/* ---------- 5. wake-lock release rejection is handled ---------- */
{
  let unhandled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('unhandledRejection', onUnhandled);
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    wakeLock: { request: async () => ({
      release: () => Promise.reject(new Error('already released')),
      addEventListener() {},
    }) },
  } });
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const wl = await import('../js/wake-lock.js');
  wl.keepAwake(true);
  await tick(5);
  wl.keepAwake(false);
  await tick(20);
  ok(unhandled === 0, `turning the lock off leaves no unhandled rejection (${unhandled})`);
  process.off('unhandledRejection', onUnhandled);
  if (saved) Object.defineProperty(globalThis, 'navigator', saved); else delete globalThis.navigator;
  delete globalThis.document;
}

/* ---------- 6. a note's day is the local day ---------- */
{
  process.env.TZ = 'America/Denver';
  const { localDayOf } = await import('../js/store.js');
  ok(typeof localDayOf === 'function' && localDayOf('2026-10-17T03:30:00.000Z') === '2026-10-16',
     'a note sent 9:30 pm in Utah is dated that day, not the UTC day');
  ok(typeof localDayOf === 'function' && localDayOf('2026-10-16') === '2026-10-16',
     'a bare day passes through unchanged');
  const acct = read('js/views-account.js');
  ok(/fmtDateShort\(localDayOf\(n\.createdAt\)\)/.test(acct) && !/n\.createdAt\.slice\(0, 10\)/.test(acct),
     'the notes inbox prints localDayOf(createdAt)');
}

/* ---------- 7. the two editors say when a save fails ---------- */
{
  const src = read('js/views-workouts.js');
  for (const [what, call] of [['program', 'store.saveSystem({ ...draft'], ['workout', 'store.saveWorkout({ ...draft']]) {
    const at = src.indexOf(call);
    const before = src.slice(Math.max(0, at - 300), at);
    const after = src.slice(at, at + 900);
    ok(at > 0 && /try \{/.test(before) && /catch \(err\) \{[\s\S]*toast\(friendlyError\(err/.test(after),
       `the ${what} editor's save catches a failure and says so`);
  }
}

/* ---------- 8. every CSS variable read is defined ---------- */
{
  const css = read('css/app.css') + read('index.html');
  const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  // Set from JS at run time (element.style.setProperty), never in the stylesheet.
  const js = readdirSync(new URL('../js/', import.meta.url))
    .filter((f) => f.endsWith('.js')).map((f) => read(`js/${f}`)).join('\n');
  for (const m of js.matchAll(/['"`](--[\w-]+)['"`]/g)) defined.add(m[1]);
  const used = [...new Set([...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1]))];
  const missing = used.filter((v) => !defined.has(v));
  ok(missing.length === 0, `every var(--x) without a fallback is defined (missing: ${missing.join(', ') || 'none'})`);
}

/* ---------- 9. after a deploy, every shell file is refreshed before Refresh reloads ---------- */
{
  const SRC = read('sw.js');
  const ORIGIN = 'https://timothyhadfield.github.io';
  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN + '/app/').href;
  const server = { tag: 'v1' };
  const store = new Map();   // url -> etag
  const resp = (tag, type = 'basic') => ({
    ok: true, type, headers: new Map([['etag', tag]]), clone() { return this; },
  });
  const cache = {
    async match(u) { const k = abs(u); return store.has(k) ? resp(store.get(k)) : undefined; },
    async put(u, res) { store.set(abs(u), res.headers.get('etag')); },
    async add(req) { store.set(abs(req), server.tag); },
  };
  const listeners = {};
  const posted = [];
  const ctx = {
    self: {
      location: new URL(ORIGIN + '/app/sw.js'),
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [{ postMessage: (m) => posted.push(m) }] },
      registration: { scope: ORIGIN + '/app/', unregister: async () => {} },
    },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      await tick(1);
      return resp(url.startsWith(ORIGIN) ? server.tag : 'sdk', url.startsWith(ORIGIN) ? 'basic' : 'cors');
    },
    Request: class { constructor(url, init = {}) { this.url = abs(url); this.cache = init.cache; this.method = 'GET'; this.mode = init.mode || 'cors'; } },
    Response: { error: () => ({ error: true }) }, URL, console, Promise, Date, setTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  let p; listeners.install({ waitUntil: (x) => { p = x; } }); await p;

  const shellUrls = [...store.keys()].filter((u) => u.startsWith(ORIGIN));
  ok(shellUrls.length > 50 && shellUrls.every((u) => store.get(u) === 'v1'), 'installed: the whole shell at v1');

  server.tag = 'v2';                    // a deploy
  // The page loads and asks for app.js (stale-while-revalidate serves v1).
  let served; listeners.fetch({ request: new ctx.Request('./js/app.js'), respondWith: (x) => { served = x; } });
  await served;
  await tick(60);
  ok(posted.includes('assets-updated'), 'the page is told a new version is ready');
  const never = abs('./js/views-workouts.js');
  ok(store.get(never) === 'v2', `a screen the page never opened is brought up to date too (${store.get(never)})`);

  // Refresh asks first and reloads on the answer.
  const replies = [];
  let wait = null;
  listeners.message({ data: 'prepare-reload', source: { postMessage: (m) => replies.push(m) }, waitUntil: (x) => { wait = x; } });
  if (wait) await wait;
  await tick(5);
  ok(replies.includes('reload-ready'), "the worker answers 'reload-ready' to 'prepare-reload'");
  ok(shellUrls.every((u) => store.get(u) === 'v2'), 'and by then every shell file is the new build');
  const app = read('js/app.js');
  ok(/postMessage\('prepare-reload'\)/.test(app) && /'reload-ready'/.test(app),
     "the update bar's Refresh waits for 'reload-ready' (with a time limit) before reloading");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
