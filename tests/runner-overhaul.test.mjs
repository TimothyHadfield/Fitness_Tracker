// The runner's overhaul wave-1 items (docs/overhaul-plan.md, RUNNER-1), 2026-09-27.
//
//   node tests/runner-overhaul.test.mjs      (needs jsdom, like render.test.mjs)
//
// Each block was seen FAILING against the files at HEAD (git show HEAD:…)
// before the change went in. Same harness as review-runnerA.test.mjs, with a
// storage that has `length`/`key()` and a quota switch (R-2).
import { JSDOM } from 'jsdom';

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

/* A Storage with a quota switch: `full` makes every write throw, and
 * `fullWhileShards` makes writes throw only while a cloud shard cache is still
 * stored — the case clearing the caches is there to rescue. */
const SHARD = 'ftrack:v1:shardCache:';
function makeStorage() {
  const mem = new Map();
  const s = {
    full: false,
    fullWhileShards: false,
    get length() { return mem.size; },
    key: (i) => [...mem.keys()][i] ?? null,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      if (s.full || (s.fullWhileShards && [...mem.keys()].some((x) => x.startsWith(SHARD)))) {
        const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
      }
      mem.set(k, String(v));
    },
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  return s;
}
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

/* The Screen Wake Lock API, counted. */
const wake = { requests: 0, releases: 0 };
Object.defineProperty(window.navigator, 'wakeLock', {
  configurable: true,
  value: {
    request: async () => {
      wake.requests++;
      const t = new window.EventTarget();
      t.release = async () => { wake.releases++; t.dispatchEvent(new window.Event('release')); };
      return t;
    },
  },
});

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store, todayISO } = await import(BASE + 'store.js');
const vs = await import(BASE + 'views-session.js');
const { SessionView } = vs;
const sd = await import(BASE + 'session-draft.js');
const { loadDraft, saveDraft, clearDraft } = sd;

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const settleN = async (n) => { for (let i = 0; i < n; i++) await settle(); };
const app = () => document.getElementById('app');
const text = (n) => (n || app()).textContent.replace(/\s+/g, ' ');
const findBtn = (re, root = document) => [...root.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}
const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const [ty, tm, td] = todayISO().split('-').map(Number);
const daysAgo = (n) => localISO(new Date(ty, tm - 1, td - n));
const bench = byName('Barbell Bench Press');

async function fresh(settings = {}) {
  clearDraft();
  await store.clearAll();
  await store.saveSettings({ runnerView: 'list', ...settings });
}
async function benchWorkout({ sets = 3, targets, history = [[185, 5]], ago = 3, name = 'Push' } = {}) {
  const w = await store.saveWorkout({
    name, exercises: [{ exerciseId: bench.id, sets, notes: '', ...(targets ? { targets } : {}) }],
  });
  if (history && history.length) {
    await store.saveSession({ workoutId: w.id, workoutName: name, date: daysAgo(ago),
      entries: [{ exerciseId: bench.id, exerciseName: bench.name,
        sets: history.map(([weight, reps]) => ({ weight, reps })) }] });
  }
  return w;
}

/* ============ E-8: the typo ratio is 1.25 ============ */
ok(vs.TYPO_WARN_RATIO === 1.25, `E-8: TYPO_WARN_RATIO is 1.25 (was ${vs.TYPO_WARN_RATIO})`);

/* ============ EB-10: a 1RM record's "from" is the set as logged ============ */
{
  const f = typeof vs.loggedAs === 'function' ? vs.loggedAs : () => '';
  ok(/^185 lbs × 5$/.test(f({ weight: 185, reps: 5 })), `EB-10: plain lift "${f({ weight: 185, reps: 5 })}"`);
  ok(/^60 lbs each × 10$/.test(f({ weight: 60, reps: 10, perSide: true })),
    `EB-10: per-side "${f({ weight: 60, reps: 10, perSide: true })}"`);
  ok(/^bodyweight × 8$/.test(f({ weight: null, reps: 8, bodyIncluded: true })),
    `EB-10: a pull-up with nothing added "${f({ weight: null, reps: 8, bodyIncluded: true })}"`);
  ok(/^bodyweight \+ 25 lbs × 5$/.test(f({ weight: 25, reps: 5, bodyIncluded: true })),
    `EB-10: weighted pull-up "${f({ weight: 25, reps: 5, bodyIncluded: true })}"`);
  ok(/^8 reps with 70 lbs help$/.test(f({ weight: 70, reps: 8, bodyIncluded: true, assisted: true })),
    `EB-10: assisted "${f({ weight: 70, reps: 8, bodyIncluded: true, assisted: true })}"`);
}

/* ============ I-4: how far back the screen Record rose over is ============ */
{
  const f = typeof sd.stepsBackPastRecord === 'function' ? sd.stepsBackPastRecord : () => NaN;
  const trail = { 0: '#/home', 1: '#/record', 2: '#/start/abc', 3: '#/session/w1' };
  ok(f(3, trail) === 3, `I-4: Home → Record → Start → runner goes back 3 (${f(3, trail)})`);
  ok(f(2, { 0: '#/workouts', 1: '#/session/w1', 2: '#/session/w1' }) === 2,
    'I-4: a second runner entry is skipped too');
  ok(f(0, { 0: '#/session/w1' }) === 0, 'I-4: a cold deep link has nothing behind it → Home');
  ok(f(2, { 0: '#/record', 1: '#/start', 2: '#/session/w' }) === 0, 'I-4: only the Record flow behind → Home');
  ok(f(3, { 3: '#/session/w' }) === 1, 'I-4: an entry the trail never saw → one step, as before');
}

/* ============ R-2: a draft that cannot be written says so ============ */
{
  await fresh();
  const w = await benchWorkout();
  const run = await mount(SessionView(w.id));
  await settleN(6); // the cache-clearer loads after the first good write
  const line = () => run.querySelector('.draft-full');
  ok(Boolean(line()) && line().hidden, 'R-2: the storage line exists and is hidden while writes work');
  localStorage.full = true;
  const r = saveDraft({ ...loadDraft(), note: 'x' });
  ok(r === false, `R-2: saveDraft returns false when storage is full (${r})`);
  ok(Boolean(line()) && !line().hidden && /Phone storage is full — save this workout now\./.test(line().textContent),
    'R-2: the runner shows "Phone storage is full — save this workout now."');
  localStorage.full = false;
  ok(saveDraft(loadDraft()) === true && line().hidden, 'R-2: a write that works again returns true and hides the line');

  // Full only because of the cloud caches: they are cleared and the write retried.
  localStorage.setItem(SHARD + 'u1:sessions:0', 'x'.repeat(2000));
  localStorage.fullWhileShards = true;
  const r2 = saveDraft({ ...loadDraft(), note: 'y' });
  ok(r2 === true && loadDraft().note === 'y', `R-2: clearAllShardCaches() made room and the retry saved (${r2})`);
  ok(localStorage.getItem(SHARD + 'u1:sessions:0') === null, 'R-2: the shard cache was the thing cleared');
  localStorage.fullWhileShards = false;
}

/* ============ ST-6: Auto warm-ups off → none suggested ============ */
{
  await fresh();
  const w = await benchWorkout({ history: [[185, 5], [185, 5], [185, 5]] });
  await mount(SessionView(w.id)); await settleN(3);
  const on = (loadDraft().entries[0].warmups || []).length;
  ok(on > 0, `ST-6 control: warm-ups are suggested by default (${on})`);
  await fresh({ autoWarmups: false });
  const w2 = await benchWorkout({ history: [[185, 5], [185, 5], [185, 5]] });
  await mount(SessionView(w2.id)); await settleN(3);
  const off = (loadDraft().entries[0].warmups || []).length;
  ok(off === 0, `ST-6: with autoWarmups false none are suggested (${off})`);
}

/* ============ ST-7: Set hints off → no % / reps captions; typo stays ============ */
{
  await fresh();
  const w = await benchWorkout({ history: [[205, 5], [205, 5], [205, 5]] });
  let run = await mount(SessionView(w.id)); await settleN(8);
  ok(/of your estimated max/.test(text(run)), 'ST-7 control: the % caption shows by default');
  await fresh({ setHints: false });
  const w2 = await benchWorkout({ history: [[205, 5], [205, 5], [205, 5]] });
  run = await mount(SessionView(w2.id)); await settleN(8);
  ok(!/of your estimated max/.test(text(run)) && !/to failure/.test(text(run)),
    'ST-7: with setHints false neither caption shows');
  type(run.querySelector('.set-open .step-value'), 600); await settleN(3);
  ok(/typo\?/.test(text(run)), 'ST-7: the typo warning still shows with hints off');
}

/* ============ E-8: no estimate → held against the Elite line ============ */
{
  await fresh();
  const w = await benchWorkout({ history: [] , name: 'First bench' });
  const run = await mount(SessionView(w.id)); await settleN(8);
  const boxes = run.querySelectorAll('.set-open .step-value');
  type(boxes[0], 900); await settleN(2);
  type(boxes[1], 3); await settleN(4);
  ok(/Above an Elite lifter's max — typo\?/.test(text(run)),
    'E-8: 900 lbs on a never-done bench says "Above an Elite lifter\'s max — typo?"');
  type(run.querySelector('.set-open .step-value'), 95); await settleN(4);
  ok(!/Elite/.test(text(run)), 'E-8: and 95 lbs says nothing');
}

/* ============ EA-5: after a lay-off the plan's weights are capped ============ */
{
  await fresh();
  const w = await benchWorkout({ sets: 2, targets: [100, 100], history: [[225, 5], [225, 5]], ago: 99 });
  const run = await mount(SessionView(w.id)); await settleN(4);
  const ws = loadDraft().entries[0].sets.map((s) => s.weight);
  ok(ws.every((x) => x <= 225), `EA-5: 99 days off after 225 × 5, a 100 % plan stays ≤ 225 (${ws})`);
  ok(/held at last time's 225 lbs after the break/.test(text(run)), 'EA-5: and the plan line says why');
}

/* ============ R-4 / I-5: a deleted set can be put back ============ */
{
  await fresh();
  const w = await benchWorkout({ history: [[185, 5], [195, 4], [205, 3]] });
  const run = await mount(SessionView(w.id)); await settleN(3);
  const before = loadDraft().entries[0].sets.map((s) => `${s.weight}x${s.reps}`);
  run.querySelector('.set-del[aria-label="Delete set 2"]').click(); await settle();
  ok(loadDraft().entries[0].sets.length === 2, 'R-4 setup: set 2 deleted');
  const t = document.querySelector('.toast');
  ok(Boolean(t) && /Set 2 deleted/.test(t.textContent), `R-4: toast "Set 2 deleted" (${t ? t.textContent : 'none'})`);
  const undo = t && t.querySelector('.toast-action');
  ok(Boolean(undo) && undo.textContent === 'Undo', 'R-4: with an Undo action');
  if (undo) undo.click();
  await settle();
  const after = loadDraft().entries[0].sets.map((s) => `${s.weight}x${s.reps}`);
  ok(JSON.stringify(after) === JSON.stringify(before), `R-4: Undo puts it back at its index (${after} vs ${before})`);
  document.querySelectorAll('.toast').forEach((n) => n.remove());
}

/* ============ ST-15: the last runner view is remembered ============ */
{
  await fresh();
  const w = await benchWorkout();
  await mount(SessionView(w.id));
  app().querySelector('.guide-toggle').click(); await settleN(3);
  const s = await store.getSettings();
  ok(s.runnerView === 'guide', `ST-15: tapping Auto-guide saves runnerView "guide" (${s.runnerView})`);
  clearDraft();
  const w2 = await store.saveWorkout({ name: 'Pull', exercises: [{ exerciseId: bench.id, sets: 2, notes: '' }] });
  await mount(SessionView(w2.id)); await settle();
  ok(loadDraft().view === 'guide', 'ST-15: the next new workout opens in Auto-guide');
}

/* ============ ST-8: the screen is kept on while the runner is open ============ */
{
  // The runners above never left; leaving now lets their lock go first.
  location.hash = '#/record'; await settleN(2);
  await fresh();
  const w = await benchWorkout();
  const r0 = wake.requests, l0 = wake.releases;
  location.hash = '#/session/' + w.id; await settle();
  await mount(SessionView(w.id)); await settle();
  ok(wake.requests > r0, 'ST-8: opening the runner asks for a screen wake lock');
  location.hash = '#/home'; await settleN(2);
  ok(wake.releases > l0, 'ST-8: leaving the runner lets it go');
  await fresh({ keepAwake: false });
  const w2 = await benchWorkout();
  const r1 = wake.requests;
  location.hash = '#/session/' + w2.id; await settle();
  await mount(SessionView(w2.id)); await settle();
  ok(wake.requests === r1, 'ST-8: with keepAwake false it never asks');
  location.hash = '#/home'; await settle();
}

/* ============ I-4 / I-10 / I-3 / I-20 through the runner ============ */
{
  await fresh();
  const w = await benchWorkout({ history: [[185, 5]] });
  // History as the router leaves it: each entry stamped with its navIndex.
  const realGo = window.history.go.bind(window.history);
  const realBack = window.history.back.bind(window.history);
  const calls = [];
  window.history.go = (n) => calls.push(['go', n]);
  window.history.back = () => calls.push(['back']);
  window.history.replaceState({ navIndex: 0 }, '', '#/home'); sd.stampTrail && sd.stampTrail();
  window.history.pushState({ navIndex: 1 }, '', '#/record'); sd.stampTrail && sd.stampTrail();
  window.history.pushState({ navIndex: 2 }, '', '#/start'); sd.stampTrail && sd.stampTrail();
  window.history.pushState({ navIndex: 3 }, '', '#/session/' + w.id); sd.stampTrail && sd.stampTrail();
  const run = await mount(SessionView(w.id)); await settleN(2);
  run.querySelector('button[aria-label="Leave this workout open and go back"]').click(); await settle();
  ok(JSON.stringify(calls[0]) === JSON.stringify(['go', -3]),
    `I-4: ↓ from Home → Record → Start → runner goes back 3, to Home (${JSON.stringify(calls[0])})`);

  // I-10: Finish from the Exercises sheet.
  app().replaceChildren(run); await settle();
  findBtn(/^Exercises$/, run).click(); await settle();
  const sheetFinish = findBtn(/^Finish workout$/, document.querySelector('.sheet') || document.createElement('div'));
  ok(Boolean(sheetFinish), 'I-10: the Exercises sheet ends with "Finish workout"');
  if (sheetFinish) sheetFinish.click();
  await settleN(2);
  const h1 = app().querySelector('.topbar h1');
  ok(h1 && h1.textContent === 'Save workout', 'I-10: it opens the save screen');

  // I-3: saving re-points this entry at the saved workout.
  const l0 = wake.releases;
  findBtn(/Save workout/, app()).click(); await settleN(6);
  ok(/^#\/me\/workouts\/.+/.test(location.hash), `I-3: after Save the address is the saved workout (${location.hash})`);
  ok(window.history.state && window.history.state.navIndex === 3, 'I-3: same entry, same navIndex (replaced, not pushed)');
  ok(wake.releases > l0, 'ST-8: Finish lets the wake lock go');

  // I-20: "Back to home" goes where ↓ goes.
  calls.length = 0;
  findBtn(/^Back to home$/, app()).click(); await settle();
  ok(JSON.stringify(calls[0]) === JSON.stringify(['go', -3]),
    `I-20: "Back to home" goes back past the Record flow (${JSON.stringify(calls[0])})`);
  window.history.go = realGo; window.history.back = realBack;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
