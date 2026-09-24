// The runner / save screen / edit screen bugs found by the 2026-09-24 review.
//
//   node tests/review-runnerA.test.mjs      (needs jsdom, like render.test.mjs)
//
// Each block is one bug, and each was seen FAILING against the unfixed code
// before the fix went in. Same harness as render.test.mjs, trimmed to what
// these screens need.
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

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store, todayISO } = await import(BASE + 'store.js');
const { SessionView } = await import(BASE + 'views-session.js');
const { EditSessionView } = await import(BASE + 'views-edit-session.js');
const { liveSessionBar } = await import(BASE + 'live-session.js');
const { loadDraft, saveDraft, clearDraft, liveDraft } = await import(BASE + 'session-draft.js');
const { ownBestSet, repPrediction } = await import(BASE + 'exercise-estimate.js');
const units = await import(BASE + 'units.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
const findBtn = (re) => [...app().querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
const lastSheet = () => { const s = document.querySelectorAll('.sheet'); return s[s.length - 1] || null; };
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}
const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = todayISO();
const [ty, tm, td] = today.split('-').map(Number);
const yesterday = localISO(new Date(ty, tm - 1, td - 1));
const daysAgo = (n) => localISO(new Date(ty, tm - 1, td - n));

/* ============ 1. a workout open past midnight is not wiped ============ */
{
  clearDraft();
  await store.clearAll();
  const w = await store.saveWorkout({
    name: 'Late one', exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' }],
  });
  const run = await mount(SessionView(w.id));
  type(run.querySelectorAll('.step-value')[0], 185); await settle();
  type(run.querySelectorAll('.step-value')[1], 5); await settle();
  const real = loadDraft();

  // Pure rule, with the clock passed in: started 23:00 yesterday, now 00:30.
  const startedAt = new Date(ty, tm - 1, td - 1, 23, 0).toISOString();
  saveDraft({ ...real, startedOn: yesterday, date: yesterday, startedAt });
  const halfPast = new Date(ty, tm - 1, td, 0, 30).getTime();
  ok(Boolean(liveDraft(today, halfPast)),
     '🚨 a workout started at 23:00 is still live at 00:30 — the midnight wipe');
  const lateNext = new Date(ty, tm - 1, td, 11, 30).getTime();
  ok(!liveDraft(today, lateNext), '⚠️ but 12½ hours on it is not');
  saveDraft({ ...real, startedOn: '2020-01-01', date: '2020-01-01' });
  ok(!liveDraft(today), '⚠️ and a years-old start date is never live, whatever startedAt says');

  // Through the real runner (real clock): started two hours ago, yesterday's date.
  saveDraft({ ...real, startedOn: yesterday, date: yesterday,
    startedAt: new Date(Date.now() - 2 * 3600e3).toISOString() });
  ok(Boolean(liveSessionBar({ route: 'home', today })), 'the bar still shows the workout');
  await mount(SessionView(w.id));
  const after = loadDraft();
  ok(Boolean(after) && Boolean(app().querySelector('.set-list')),
     '🚨 opening the runner resumes it instead of clearDraft()-ing it');
  ok(after && after.date === yesterday, 'and it keeps the day it was started for');
  ok(after && after.entries[0].sets[0].weight === 185, 'with its sets intact');
  clearDraft();
}

/* ============ 2. joint workout: save screen + discard count everyone ============ */
{
  clearDraft();
  await store.clearAll();
  const benchId = byName('Barbell Bench Press').id;
  const w = await store.saveWorkout({ name: 'Pair', exercises: [{ exerciseId: benchId, sets: 2, notes: '' }] });
  await mount(SessionView(w.id));
  const d = loadDraft();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const owner = clone(d.entries);
  owner[0].sets = [{ weight: 185, reps: 5 }, { weight: 0, reps: 0 }];
  const guest = clone(d.entries);
  guest[0].sets = [{ weight: 95, reps: 8 }, { weight: 95, reps: 8 }];
  saveDraft({ ...d, forName: 'Alex', guestNames: ['Alex'], personMeta: { Alex: {} },
    entries: guest, others: [{ name: null, entries: owner, index: 0, bodyWeight: null }] });
  await mount(SessionView(w.id));
  findBtn(/Finish workout/).click();
  await settle();
  const stats = [...app().querySelectorAll('.save-stat-value')].map((n) => n.value || n.textContent);
  ok(stats[1] === '3', `🚨 the save screen counts everyone's sets (1 yours + 2 Alex's), not just Alex's (${stats.join(' / ')})`);
  ok(stats[2] === '1', `and one exercise, not one per person (${stats.join(' / ')})`);
  findBtn(/Discard workout/).click();
  await settle();
  ok(/3 recorded sets will be deleted/.test(lastSheet().textContent),
     `🚨 the discard warning names every set clearDraft() deletes (${lastSheet().textContent.slice(0, 80)})`);
  [...lastSheet().querySelectorAll('button')].find((b) => /^Cancel$/.test(b.textContent)).click();
  await settle();

  // Saving: the owner row gets 1 set, Alex's row 2 — the 3 the screen promised.
  findBtn(/Save workout/).click();
  await settle(); await settle();
  const mine = await store.getSessions();
  const theirs = await store.getGuestSessions().catch(() => []);
  const n = mine.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.length, 0), 0)
    + theirs.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.sets.length, 0), 0);
  ok(n === 3, `and 3 sets are what actually got saved (${n})`);
  clearDraft();
}

/* ============ 3. rep caption reads the exercise's own column ============ */
{
  clearDraft();
  await store.clearAll();
  const lp = byName('Leg Press');
  await store.saveSession({ workoutId: 'hist', workoutName: 'Legs', date: daysAgo(3),
    entries: [{ exerciseId: lp.id, exerciseName: lp.name, sets: [{ weight: 400, reps: 5 }] }] });
  const w = await store.saveWorkout({ name: 'Legs', exercises: [{ exerciseId: lp.id, sets: 1, notes: '' }] });
  const run = await mount(SessionView(w.id));
  for (let i = 0; i < 5; i++) await settle();
  const rows = { sessions: await store.getSessions(), benchmarks: [], bodyWeights: [] };
  const own = ownBestSet(lp, rows, today);
  const wNow = Number(loadDraft().entries[0].sets[0].weight) || 0;
  const totalW = lp.loadType === 'per_side' ? wNow * 2 : wNow;
  const want = repPrediction(own.e1rm, totalW, { exercise: lp });
  const general = repPrediction(own.e1rm, totalW);
  const cap = run.querySelectorAll('.step-est')[1];
  const txt = cap ? cap.textContent : '';
  ok(want && general && want.low !== general.low,
     `(guard) the leg-press column really differs here (${want && want.low}-${want && want.high} vs ${general && general.low}-${general && general.high})`);
  ok(txt.includes(`${want.low}–${want.high}`),
     `🚨 the rep caption uses the leg-press column (${JSON.stringify(txt)})`);
  clearDraft();
}

/* ============ 4 + 5. finish screen: weighted pull-up PR, and kg rounding ============ */
{
  clearDraft();
  await store.clearAll();
  units.setUnits('kg');
  const pu = byName('Pull-Up');
  const bench = byName('Barbell Bench Press');
  await store.logBodyWeight(180, daysAgo(10));
  await store.saveSession({ workoutId: 'h', workoutName: 'Old', date: daysAgo(5), entries: [
    { exerciseId: pu.id, exerciseName: pu.name, sets: [{ weight: 20, reps: 5 }] },
    { exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 200, reps: 5 }] },
  ] });
  const w = await store.saveWorkout({ name: 'PR day', exercises: [
    { exerciseId: pu.id, sets: 1, notes: '' }, { exerciseId: bench.id, sets: 1, notes: '' }] });
  await mount(SessionView(w.id));
  const d = loadDraft();
  d.entries[0].sets = [{ weight: 30, reps: 5 }];
  // 215 × 5 → an estimate of 252.9 lb: rounded in pounds then converted it
  // prints "114.8 kg"; rounded in kilos, "115 kg".
  d.entries[1].sets = [{ weight: 215, reps: 5 }];
  saveDraft(d);
  await mount(SessionView(w.id));
  for (let i = 0; i < 6 && !findBtn(/Finish workout/); i++) {
    const next = findBtn(/Next exercise|Straight into|Round/);
    if (!next) break;
    next.click();
    await settle();
  }
  findBtn(/Finish workout/).click();
  await settle();
  findBtn(/Save workout/).click();
  for (let i = 0; i < 4; i++) await settle();
  const t = app().textContent;
  const puBlock = [...app().querySelectorAll('.finish-pr')]
    .find((n) => n.firstChild && n.firstChild.textContent === 'Pull-Up');
  ok(puBlock && /estimated/i.test(puBlock.textContent),
     `🚨 the finish screen shows the weighted pull-up's estimated-max record (${puBlock ? puBlock.textContent : 'no Pull-Up block'})`);
  const e1 = (t.match(/[\d.]+ kg from [\d.]+ kg × 5, up from [\d.]+ kg/g) || []);
  ok(e1.length > 0, `(guard) an estimated-max line is on screen (${e1.join(' | ')})`);
  ok(e1.length > 0 && e1.every((s) => /^\d+ kg from/.test(s) && /up from \d+ kg$/.test(s)),
     `🚨 kg estimates print whole kilos, no decimal (${e1.join(' | ')})`);
  units.setUnits('lb');
  clearDraft();
}

/* ============ 6. a typo weight hides the plate list ============ */
{
  clearDraft();
  await store.clearAll();
  const bench = byName('Barbell Bench Press');
  await store.saveSession({ workoutId: 'h', workoutName: 'Old', date: daysAgo(3),
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 200, reps: 5 }] }] });
  const w = await store.saveWorkout({ name: 'Bench', exercises: [{ exerciseId: bench.id, sets: 1, notes: '' }] });
  const run = await mount(SessionView(w.id));
  for (let i = 0; i < 4; i++) await settle();
  const hint = () => app().querySelector('.stepper .step-unit');
  ok(hint() && hint().classList.contains('is-plates') && !hint().hidden,
     '(guard) a normal bench weight shows its plates');
  type(app().querySelectorAll('.step-value')[0], 2000);
  for (let i = 0; i < 3; i++) await settle();
  ok(Boolean(app().querySelector('.typo-warn')), '(guard) 2000 lb raises the typo warning');
  ok(hint() && hint().hidden, '🚨 and the plate list for that weight is hidden');
  type(app().querySelectorAll('.step-value')[0], 205);
  for (let i = 0; i < 3; i++) await settle();
  ok(hint() && !hint().hidden && hint().classList.contains('is-plates'),
     'fixing the typo brings the plates back');
  void run;
  clearDraft();
}

/* ============ 7 + 8. save-failed words; minutes box clamps ============ */
{
  clearDraft();
  await store.clearAll();
  const bench = byName('Barbell Bench Press');
  const w = await store.saveWorkout({ name: 'Box', exercises: [{ exerciseId: bench.id, sets: 1, notes: '' }] });
  const run = await mount(SessionView(w.id));
  type(run.querySelectorAll('.step-value')[0], 135); await settle();
  type(run.querySelectorAll('.step-value')[1], 5); await settle();
  findBtn(/Finish workout/).click();
  await settle();
  const box = app().querySelector('.save-dur');
  ok(Boolean(box), '(guard) the minutes box is there');
  box.value = '6000';
  box.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok(box.value === '600', `🚨 6000 minutes is clamped to 600 in the box (${box.value})`);

  const realSave = store.saveSession;
  store.saveSession = async () => { throw new Error('Your browser storage may be full.'); };
  findBtn(/Save workout/).click();
  await settle(); await settle();
  store.saveSession = realSave;
  const err = app().querySelector('.save-error');
  ok(err && !err.hidden && /Not saved/.test(err.textContent), '(guard) the failure is on screen');
  ok(err && /Save workout/.test(err.textContent) && !/Finish/.test(err.textContent),
     `🚨 it names the button that is actually there (${err && err.textContent})`);

  findBtn(/Save workout/).click();
  await settle(); await settle();
  const s = (await store.getSessions())[0];
  const mins = s ? (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000 : null;
  ok(mins === 600, `and 600 minutes is what gets saved (${mins})`);
  clearDraft();
}

/* ============ 9. edit screen: orphan superset, failed save ============ */
{
  await store.clearAll();
  const a = byName('Barbell Bench Press'), b = byName('Barbell Row');
  const rec = await store.saveSession({ workoutId: 'w', workoutName: 'SS', date: daysAgo(2), entries: [
    { exerciseId: a.id, exerciseName: a.name, group: 1, sets: [{ weight: 185, reps: 5 }] },
    { exerciseId: b.id, exerciseName: b.name, group: 1, sets: [{ weight: 135, reps: 8 }] },
  ] });
  await mount(EditSessionView(rec.id));
  app().querySelector(`[aria-label="Remove ${b.name}"]`).click();
  await settle();
  [...lastSheet().querySelectorAll('button')].filter((x) => !/^Cancel$/.test(x.textContent)).pop().click();
  await settle();

  const realSave = store.saveSession;
  let unhandled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('unhandledRejection', onUnhandled);
  store.saveSession = async () => { throw new Error('Your browser storage may be full.'); };
  const saveBtn = findBtn(/Save changes/);
  saveBtn.click();
  await settle(); await settle();
  store.saveSession = realSave;
  const toasts = [...document.querySelectorAll('.toast')].map((x) => x.textContent);
  ok(unhandled === 0, `🚨 a failed save is caught, not an unhandled rejection (${unhandled})`);
  ok(toasts.some((x) => /storage may be full/.test(x)), `and it says so (${toasts.join(' | ')})`);
  ok(!saveBtn.disabled, 'and the button works again for a retry');
  process.off('unhandledRejection', onUnhandled);

  saveBtn.click();
  await settle(); await settle();
  const saved = await store.getSession(rec.id);
  ok(saved && saved.entries.length === 1, '(guard) the row went away');
  ok(saved && saved.entries[0].group == null,
     `🚨 the survivor no longer claims a superset (group ${saved && saved.entries[0].group})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
