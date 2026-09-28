// The runner's overhaul wave-2 items (docs/overhaul-plan.md, RUNNER-2), 2026-09-27.
//
//   node tests/runner2-w2.test.mjs      (needs jsdom, like render.test.mjs)
//
// EA-1 prefill, S-06 Equipment today, S-07 save screen (not opened + Update),
// S-08a gym names, S-09 Lighter week, S-13 "You" sits out, the empty workout,
// and friendlyError on a failed save. Seen FAILING against the HEAD runner
// (RUNNER_FILE=views-session.old.js) before the change went in.
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

function makeStorage() {
  const mem = new Map();
  return {
    get length() { return mem.size; },
    key: (i) => [...mem.keys()][i] ?? null,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
}
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store, todayISO } = await import(BASE + 'store.js');
const vs = await import(BASE + (process.env.RUNNER_FILE || 'views-session.js'));
const { SessionView } = vs;
const { loadDraft, saveDraft, clearDraft } = await import(BASE + 'session-draft.js');
const { alternativesFor } = await import(BASE + 'exercise-families.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const settleN = async (n) => { for (let i = 0; i < n; i++) await settle(); };
const app = () => document.getElementById('app');
const text = (n) => (n || app()).textContent.replace(/\s+/g, ' ');
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
const bench = byName('Barbell Bench Press');
const legPress = byName('Leg Press');
const row = byName('Barbell Row');

async function fresh(settings = {}) {
  clearDraft();
  document.querySelectorAll('.sheet, .sheet-backdrop, .toast').forEach((n) => n.remove());
  await store.clearAll();
  await store.saveSettings({ runnerView: 'list', ...settings });
}
/** A workout of `exs` ({ex, reps?}) with one past session of each at `w`×`r`. */
async function workoutWith(exs, { name = 'Push', w = 135, r = 8, sets = 3, location } = {}) {
  const wk = await store.saveWorkout({
    name, exercises: exs.map(({ ex, reps }) => ({ exerciseId: ex.id, sets, notes: '', ...(reps ? { reps } : {}) })),
  });
  await store.saveSession({ workoutId: wk.id, workoutName: name, date: daysAgo(3),
    ...(location ? { location } : {}),
    entries: exs.map(({ ex }) => ({ exerciseId: ex.id, exerciseName: ex.name,
      sets: Array.from({ length: sets }, () => ({ weight: w, reps: r })) })) });
  return wk;
}
async function toSaveScreen(run) {
  findBtn(/^Exercises$/, run).click(); await settle();
  const f = findBtn(/^Finish workout$/, lastSheet());
  if (f) f.click();
  await settleN(2);
  return app().querySelector('.topbar h1') && app().querySelector('.topbar h1').textContent === 'Save workout';
}
async function save() {
  const b = findBtn(/Save workout/, app());
  if (b) b.click();
  await settleN(8);
}

/* ============ pure helpers ============ */
{
  const f = typeof vs.pastGyms === 'function' ? vs.pastGyms : () => [];
  const g = f([{ date: '2026-01-02', location: 'LA Fitness' }, { date: '2026-01-01', location: 'la fitness ' },
    { date: '2026-01-03', location: 'Home' }, { date: '2026-01-04' }]);
  ok(JSON.stringify(g) === '["Home","LA Fitness"]', `S-08a: past gyms, newest first, one per spelling (${JSON.stringify(g)})`);

  const t = typeof vs.templateChanges === 'function' ? vs.templateChanges : () => 'missing';
  ok(t([{ exerciseId: 'a', plannedSets: 3 }, { exerciseId: 'b', plannedSets: 3 }], ['a', 'b']) === null,
    'S-07b: an unchanged list offers no update');
  const sw = t([{ exerciseId: 'a', plannedSets: 2 }, { exerciseId: 'c', plannedSets: 3, swappedFromId: 'a' }], ['a', 'b']);
  ok(Array.isArray(sw) && sw.length === 1 && sw[0].exerciseId === 'c' && sw[0].swappedFrom === 'a',
    `S-07b: a split swap writes only the new lift, claiming the old plan (${JSON.stringify(sw)})`);

  const e = typeof vs.equipmentSwaps === 'function' ? vs.equipmentSwaps : () => [];
  const exMap = new Map(BUILT_IN_EXERCISES.map((x) => [x.id, x]));
  const plan = e([{ exerciseId: bench.id }, { exerciseId: legPress.id }], exMap, 'dumbbells', alternativesFor);
  ok(plan.length === 2 && plan.every((p) => ['Dumbbell', 'Bodyweight'].includes(p.to.equipment)),
    `S-06: dumbbells-only swaps both to dumbbell/bodyweight (${plan.map((p) => p.to.name).join(', ')})`);
  ok(e([{ exerciseId: bench.id }], exMap, 'full', alternativesFor).length === 0, 'S-06: full gym swaps nothing');
}

/* ============ EA-1: a plan's weight rises with the lifter ============ */
{
  await fresh();
  // 185×8 on every set, plan 8–10. The curve from that best prices the plan at
  // 180 (rounded down); the old runner prefilled 180×8 forever.
  const w = await workoutWith([{ ex: bench, reps: [{ lo: 8, hi: 10 }, { lo: 8, hi: 10 }, { lo: 8, hi: 10 }] }], { w: 185, r: 8 });
  await mount(SessionView(w.id));
  const d = loadDraft();
  const s0 = d && d.entries[0] && d.entries[0].sets[0];
  ok(s0 && s0.weight >= 185, `EA-1: with history the plan's weight is not below last time (${s0 && s0.weight})`);
  ok(s0 && s0.reps === 9, `EA-1: progression takes a rep inside the plan's 8–10 (${s0 && s0.reps})`);
  const sug = d && d.entries[0] && d.entries[0].suggestion;
  ok(sug && Array.isArray(sug.range) && sug.range[0] === 8 && sug.range[1] === 10,
    `EA-1: progression works in the plan's range (${sug && JSON.stringify(sug.range)})`);
}

/* ============ S-07a / S-09: not opened, Leave out, Lighter week ============ */
{
  await fresh();
  const w = await workoutWith([{ ex: bench }, { ex: row }, { ex: legPress }]);
  const run = await mount(SessionView(w.id));
  ok(await toSaveScreen(run), 'save screen opens');
  ok(/2 exercises not opened/.test(text()), `S-07a: "2 exercises not opened" is said (${/not opened[^.]*/.exec(text())})`);
  const leave = findBtn(/^Leave out$/, app());
  ok(Boolean(leave), 'S-07a: a "Leave out" tap sits on that line');
  if (leave) leave.click();
  await settle();
  ok(/left out/.test(text()), 'S-07a: after Leave out the line says they are left out');
  const lighter = app().querySelector('[role="switch"][id^="sw-save-lighter"]');
  ok(Boolean(lighter) && lighter.getAttribute('aria-checked') === 'false', 'S-09: a "Lighter week" switch, off by default');
  if (lighter) lighter.click();
  await save();
  const saved = (await store.getSessions()).find((s) => s.date === todayISO());
  ok(saved && saved.entries.length === 1 && saved.entries[0].exerciseId === bench.id,
    `S-07a: Leave out saves only the opened exercise (${saved && saved.entries.map((e) => e.exerciseName)})`);
  ok(saved && saved.deload === true, 'S-09: Lighter week saves deload: true');
}

/* ============ S-07b: Update <Workout> ============ */
{
  await fresh();
  const w = await workoutWith([{ ex: bench }, { ex: row }]);
  const run = await mount(SessionView(w.id));
  findBtn(/^Remove$/, run).click(); await settleN(2);
  // Last time's numbers count as recorded, so the remove asks first.
  const confirm = findBtn(/^Remove$/, lastSheet());
  if (confirm) confirm.click();
  await settleN(2);
  ok(await toSaveScreen(app().querySelector('.screen')), 'save screen opens after a remove');
  const up = app().querySelector('[role="switch"][id^="sw-save-update"]');
  ok(Boolean(up) && /Update Push/.test(text()) && up.getAttribute('aria-checked') === 'false',
    'S-07b: "Update Push" switch appears after a change, off by default');
  if (up) up.click();
  await save();
  const after = await store.getWorkout(w.id);
  ok(after && after.exercises.length === 1 && after.exercises[0].exerciseId === row.id,
    `S-07b: the workout now holds today's list (${after && after.exercises.map((e) => e.exerciseId)})`);

  await fresh();
  const w2 = await workoutWith([{ ex: bench }, { ex: row }]);
  const run2 = await mount(SessionView(w2.id));
  ok(await toSaveScreen(run2), 'save screen opens with no change');
  ok(!app().querySelector('[id^="sw-save-update"]'), 'S-07b: no Update switch when nothing changed');
}

/* ============ S-08a: gym names ============ */
{
  await fresh();
  const w = await workoutWith([{ ex: bench }], { location: 'LA Fitness' });
  await store.saveSession({ date: daysAgo(9), workoutName: 'x', location: 'Home',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 100, reps: 5 }] }] });
  const run = await mount(SessionView(w.id));
  await toSaveScreen(run);
  const opts = [...app().querySelectorAll('datalist option')].map((o) => o.value);
  const input = app().querySelector('input[aria-label="Where this workout happened"]');
  ok(opts.includes('LA Fitness') && opts.includes('Home') && input && input.getAttribute('list') === 'gym-names',
    `S-08a: the gym box suggests past gyms (${JSON.stringify(opts)})`);
}

/* ============ S-13: "You" sits out ============ */
{
  await fresh();
  const w = await workoutWith([{ ex: bench }]);
  await mount(SessionView(w.id));
  const d = loadDraft();
  const clone = JSON.parse(JSON.stringify(d.entries));
  clone[0].sets.forEach((s) => { s.weight = 95; s.touched = true; });
  d.guestNames = ['Alex'];
  d.personMeta = { Alex: {} };
  d.others = [{ name: 'Alex', entries: clone, index: 0, bodyWeight: null }];
  saveDraft(d);
  const run = await mount(SessionView(w.id));
  const out = run.querySelector('button[aria-label^="Sit out"]');
  ok(Boolean(out), 'S-13: "You" has a Sit out control with somebody else in the workout');
  if (out) out.click();
  await settle();
  ok(/You · out/.test(text(run)), 'S-13: the You chip says out');
  await toSaveScreen(app().querySelector('.screen'));
  await save();
  const mine = (await store.getSessions()).filter((s) => s.date === todayISO());
  const theirs = (await store.getGuestSessions()).filter((s) => s.date === todayISO());
  ok(mine.length === 0 && theirs.length === 1, `S-13: only the guest's session saves (you ${mine.length}, Alex ${theirs.length})`);
}

/* ============ S-06: Equipment today, through the sheet ============ */
{
  await fresh();
  const w = await workoutWith([{ ex: bench }, { ex: legPress }]);
  const run = await mount(SessionView(w.id));
  findBtn(/^Exercises$/, run).click(); await settle();
  const chip = findBtn(/^Dumbbells$/, lastSheet());
  ok(Boolean(chip), 'S-06: the Exercises sheet has an Equipment row with Dumbbells');
  if (chip) chip.click();
  await settleN(6);
  const d = loadDraft();
  const kinds = (d ? d.entries : []).map((e) => byName(e.exerciseName) && byName(e.exerciseName).equipment);
  ok(kinds.length === 2 && kinds.every((k) => k === 'Dumbbell' || k === 'Bodyweight'),
    `S-06: every exercise now fits dumbbells (${d && d.entries.map((e) => e.exerciseName)})`);
}

/* ============ Empty workout ============ */
{
  await fresh();
  const run = await mount(SessionView('new-empty'));
  ok(!/Not found/.test(text(run)) && /No exercises yet/.test(text(run)), 'Empty: #/session/new-empty opens an empty runner');
  ok(Boolean(findBtn(/^Add exercise$/, run.querySelector('.session-footer:not(.guide-footer)') || run)), 'Empty: the footer offers Add exercise');
  const d = loadDraft();
  ok(d && d.workoutId === 'new-empty', 'Empty: the draft can be resumed from the bar');
  d.entries.push({ exerciseId: bench.id, exerciseName: bench.name, fields: bench.fields, loadType: bench.loadType,
    plannedSets: 1, group: null, setType: null, plannedMinis: 0, active: 0, activeDrop: null, notes: '',
    sets: [{ weight: 135, reps: 5, touched: true }], lastSets: [], suggestion: null, hadHistory: false });
  saveDraft(d);
  const again = await mount(SessionView('new-empty'));
  ok(/Barbell Bench Press/.test(text(again)), 'Empty: an added exercise resumes');
  await toSaveScreen(again);
  await save();
  const saved = (await store.getSessions()).find((s) => s.date === todayISO());
  ok(saved && !saved.workoutId && saved.workoutName === 'Workout', `Empty: saved with no workoutId (${saved && saved.workoutId})`);
}

/* ============ friendlyError on a failed save ============ */
{
  await fresh();
  const w = await workoutWith([{ ex: bench }]);
  const run = await mount(SessionView(w.id));
  await toSaveScreen(run);
  const real = store.saveSession;
  const raw = 'FirebaseError: [code=permission-denied]: Missing or insufficient permissions.';
  store.saveSession = async () => { const e = new Error(raw); e.code = 'permission-denied'; throw e; };
  await save();
  store.saveSession = real;
  const msg = (app().querySelector('.save-error') || {}).textContent || '';
  ok(/Not saved/.test(msg) && !/FirebaseError|\[code=/.test(msg), `errors: the failed save speaks plainly (${msg.slice(0, 90)})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
