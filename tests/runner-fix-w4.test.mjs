// Wave 4 RUNNER-FIX (2026-09-27): the reviewer's verified runner bugs.
//
//   node tests/runner-fix-w4.test.mjs      (needs jsdom, like render.test.mjs)
//
//   1. Undo from a runner that is no longer on screen does not overwrite the live one.
//   2. The storage-full retry writes the NEWEST draft, not the oldest.
//   3. "Equipment today" keeps an Other exercise that takes no weight.
//   4. A finer weight step still gives bar warm-ups the plates can load.
//   5. session-draft.js exports the Empty workout's id (for the Record screen).
//   7. Auto-guide keeps the stretch line's space on warm-ups after the first.
//   8. The save screen shows the date in words, and the input still edits it.
//
// Seen FAILING against HEAD's js/ (JS_BASE pointed at a `git archive` copy)
// before the fixes went in.
import { createRequire } from 'module';
const require = createRequire('C:/Users/timha/OneDrive/Desktop/my-website/Code Projects/Fitness_Tracker/package.json');
const { JSDOM } = require('jsdom');

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

const DRAFT = 'ftrack:v1:draftSession';
let draftFull = false;
function makeStorage() {
  const mem = new Map();
  return {
    get length() { return mem.size; },
    key: (i) => [...mem.keys()][i] ?? null,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      if (draftFull && k === DRAFT) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      mem.set(k, String(v));
    },
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
}
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

const BASE = process.env.JS_BASE
  || 'file:///C:/Users/timha/OneDrive/Desktop/my-website/Code%20Projects/Fitness_Tracker/js/';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = () => new Promise((r) => setTimeout(r, 30));
const settleN = async (n) => { for (let i = 0; i < n; i++) await settle(); };

/* ============ 2. storage-full retry (FIRST: before any draft save loads the clearer) ============ */
const SD = await import(BASE + 'session-draft.js');
{
  draftFull = true;
  const r1 = SD.saveDraft({ v: 1 });
  SD.saveDraft({ v: 2 });
  SD.saveDraft({ v: 3 });
  ok(r1 === false && SD.draftStorageFull(), '2. a failed save reports storage full');
  draftFull = false;                     // clearing the caches made room
  await settleN(10);                     // the clearer (firebase-backend.js) lands
  const disk = JSON.parse(localStorage.getItem(DRAFT) || 'null');
  ok(disk && disk.v === 3, `2. the retry wrote the NEWEST draft (on disk: ${JSON.stringify(disk)})`);
  ok(!SD.draftStorageFull(), '2. and the full line is cleared');
  SD.clearDraft();
}

/* ============ 5. the Empty workout id ============ */
ok(SD.EMPTY_SESSION_ID === 'new-empty', '5. session-draft.js exports EMPTY_SESSION_ID');
ok(typeof SD.isEmptyDraft === 'function' && SD.isEmptyDraft({ workoutId: 'new-empty' })
  && !SD.isEmptyDraft({ workoutId: 'w1' }) && !SD.isEmptyDraft(null), '5. isEmptyDraft(draft)');

const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store, todayISO } = await import(BASE + 'store.js');
const vs = await import(BASE + 'views-session.js');
const { SessionView } = vs;
const { alternativesFor } = await import(BASE + 'exercise-families.js');
const units = await import(BASE + 'units.js');
const { warmupRamp } = await import(BASE + 'warmup.js');
const { plateLoad, inventoryFor } = await import(BASE + 'plates.js');
const { fmtDateLong } = await import(BASE + 'ui.js');
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);

/* ============ 3. Equipment today ============ */
{
  const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
  const names = ['Sprint Intervals', 'Shadow Boxing', 'Tire Flip', 'Barbell Bench Press', 'Sled Push'];
  const entries = names.map((n) => ({ exerciseId: byName(n).id }));
  for (const kind of ['none', 'dumbbells']) {
    const swaps = vs.equipmentSwaps(entries, exMap, kind, alternativesFor);
    const swapped = swaps.map((s) => names[s.index]);
    ok(!swapped.some((n) => ['Sprint Intervals', 'Shadow Boxing', 'Tire Flip'].includes(n)),
      `3. "${kind}": no-weight Other exercises stay (swapped: ${swapped.join(', ') || 'none'})`);
    ok(swapped.includes('Barbell Bench Press'), `3. "${kind}": a barbell lift is still swapped`);
  }
  const none = vs.equipmentSwaps(entries, exMap, 'none', alternativesFor).map((s) => names[s.index]);
  ok(none.includes('Sled Push'), '3. an Other exercise that takes a weight (sled) still needs its kit');
}

/* ============ 4. warm-ups the plates can load ============ */
{
  const bench = byName('Barbell Bench Press');
  const show = (r) => r.map((s) => `${s.weight}x${s.reps}`).join(', ');
  const loadable = (r, u) => r.every((s) => plateLoad(u === 'kg' ? s.weight * units.LB_PER_KG : s.weight,
    { inventory: inventoryFor(u) }).exact);
  units.setWeightPrefs({});
  const def185 = warmupRamp({ exercise: bench, weight: 185, reps: 5, unit: 'lbs' });
  const def225 = warmupRamp({ exercise: bench, weight: 225, reps: 5, unit: 'lbs' });
  const def100 = warmupRamp({ exercise: bench, weight: 100, reps: 5, unit: 'kg' });
  ok(show(def185) === '45x10, 95x8, 150x3' && show(def225) === '45x10, 90x8, 135x5, 180x3'
    && show(def100) === '20x10, 40x8, 60x5, 80x3', `4. default settings: the old ramps (${show(def185)} | ${show(def100)})`);
  units.setWeightPrefs({ weightStep: { lbs: 2.5, kg: 1.25 } });
  for (const [w, u] of [[185, 'lbs'], [225, 'lbs'], [135, 'lbs'], [82.5, 'kg'], [105, 'kg']]) {
    const r = warmupRamp({ exercise: bench, weight: w, reps: 5, unit: u });
    ok(r.length && loadable(r, u), `4. ${w} ${u} with a finer step: every warm-up loads (${show(r)})`);
  }
  // Tiny plates: the finer step is honoured where the plates allow it.
  units.setWeightPrefs({ weightStep: { lbs: 2.5 }, plates: { lbs: { bar: 45, have: [45, 25, 10, 5, 2.5, 1.25] } } });
  const fine = warmupRamp({ exercise: bench, weight: 185, reps: 5, unit: 'lbs' });
  ok(loadable(fine, 'lbs') && fine.some((s) => s.weight % 5 !== 0), `4. with 1.25s owned, 2.5 lb targets are used (${show(fine)})`);
  units.setWeightPrefs({});
}

/* ============ DOM helpers ============ */
const app = () => document.getElementById('app');
const findBtn = (re, root = document) => [...root.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const lastSheet = () => [...document.querySelectorAll('.sheet')].pop() || document.createElement('div');
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settleN(2);
  return node;
}
const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const [ty, tm, td] = todayISO().split('-').map(Number);
const daysAgo = (n) => localISO(new Date(ty, tm - 1, td - n));
async function fresh(settings = {}) {
  SD.clearDraft();
  document.querySelectorAll('.sheet, .sheet-backdrop, .toast').forEach((n) => n.remove());
  await store.clearAll();
  await store.saveSettings({ ...settings });
}
async function workoutWith(exs, { name = 'Push', w = 135, r = 8, sets = 3 } = {}) {
  const wk = await store.saveWorkout({ name, exercises: exs.map((ex) => ({ exerciseId: ex.id, sets, notes: '' })) });
  await store.saveSession({ workoutId: wk.id, workoutName: name, date: daysAgo(3),
    entries: exs.map((ex) => ({ exerciseId: ex.id, exerciseName: ex.name,
      sets: Array.from({ length: sets }, () => ({ weight: w, reps: r })) })) });
  return wk;
}

/* ============ 1. Undo from a runner no longer on screen ============ */
{
  await fresh({ runnerView: 'list' });
  const w = await workoutWith([byName('Barbell Bench Press')]);
  const run1 = await mount(SessionView(w.id));
  run1.querySelectorAll('.set-item:not(.set-warm) .set-del')[0].click(); await settleN(2);
  const undo = document.querySelector('.toast-action');
  ok(Boolean(undo) && SD.loadDraft().entries[0].sets.length === 2, '1. deleting a set offers Undo');
  // Leave with ↓ and come back from the live bar: a NEW runner on the same draft.
  const run2 = await mount(SessionView(w.id));
  findBtn(/Add set/, run2).click(); await settleN(1);
  findBtn(/Add set/, app()).click(); await settleN(1);
  const before = SD.loadDraft().entries[0].sets.length;
  if (undo) { undo.click(); await settleN(2); }
  const after = SD.loadDraft().entries[0].sets.length;
  ok(before === 4 && after >= before, `1. the old runner's Undo keeps the newer sets (${before} → ${after})`);
  // …and Undo on the runner still on screen still works.
  const run3 = app().querySelector('.screen') || run2;
  run3.querySelectorAll('.set-item:not(.set-warm) .set-del')[0].click(); await settleN(2);
  const undo2 = [...document.querySelectorAll('.toast-action')].pop();
  const mid = SD.loadDraft().entries[0].sets.length;
  if (undo2) { undo2.click(); await settleN(2); }
  ok(mid === after - 1 && SD.loadDraft().entries[0].sets.length === after, `1. Undo on the live runner puts the set back (${mid} → ${SD.loadDraft().entries[0].sets.length})`);
}

/* ============ 7. Auto-guide: the stretch line keeps its space ============ */
{
  await fresh({ runnerView: 'guide', autoWarmups: true });
  const squat = byName('Back Squat');
  const w = await workoutWith([squat], { name: 'Legs', w: 225, r: 5, sets: 1 });
  await mount(SessionView(w.id));
  const where = () => (app().querySelector('.guide-where') || {}).textContent || '';
  const general = () => app().querySelector('.guide-note .warm-general');
  const onWarm1 = /Warm-up 1 of/.test(where());
  ok(onWarm1 && general() && /Dynamic stretch/.test(general().textContent), `7. warm-up 1 shows the stretch line ("${where().trim()}")`);
  const skip = findBtn(/^Skip$/, app()) || app().querySelector('.guide-next');
  if (skip) { skip.click(); await settleN(2); }
  const g2 = general();
  ok(/Warm-up 2 of/.test(where()) && g2 && !/Dynamic stretch/.test(g2.textContent) && g2.textContent.length === 1,
    `7. warm-up 2 keeps an empty line in its place ("${where().trim()}", ${g2 ? JSON.stringify(g2.textContent) : 'none'})`);
}

/* ============ 8. Save screen date in words ============ */
{
  await fresh({ runnerView: 'list' });
  const w = await workoutWith([byName('Barbell Bench Press')]);
  const run = await mount(SessionView(w.id));
  findBtn(/^Exercises$/, run).click(); await settleN(1);
  const f = findBtn(/^Finish workout$/, lastSheet());
  if (f) f.click();
  await settleN(2);
  const onSave = app().querySelector('.topbar h1') && /Save workout/.test(app().querySelector('.topbar h1').textContent);
  const shown = app().querySelector('.save-date-text');
  ok(onSave && shown && shown.textContent === fmtDateLong(todayISO()), `8. the date reads "${shown && shown.textContent}", not ${todayISO()}`);
  const input = app().querySelector('input.session-date');
  if (input) {
    input.value = daysAgo(1);
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await settleN(1);
  }
  ok(input && SD.loadDraft().date === daysAgo(1) && shown && shown.textContent === fmtDateLong(daysAgo(1)),
    `8. the input still edits it, and the words follow ("${shown && shown.textContent}")`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
