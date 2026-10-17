// Calculation audit 2026-10-17 (fix-calc). Every check below was seen FAILING
// on main (151b08b) before its fix.     node tests/calc-1017.test.mjs  (needs jsdom)
//
//   1. The runner's "maybe N to failure" contradicted the max and the plan next
//      to it: the max and the plan's weight come from the Marzagão curve
//      (e1rm.js), the caption read a different curve (Nuzzo's lab table). A
//      Dumbbell Curl done 25/side × 10 then captioned 25/side "maybe 15+", and a
//      bench plan of 8–10 reps (prefilled 180 off a 225 × 5) captioned 180
//      "15+" while the plan's own arithmetic says 12 to failure there.
//   2. optimal.js observedDaysPerWeek lacked volumeWindow's fencepost (EB-13):
//      9 sessions in 19 days read 3.32 days a week; same rule now, same span.
//   3. trainingForMuscle counted an entry with no recorded sets as a session
//      for that muscle; weeklyVolumeByMuscle skipped it.
//   4. The Graph's set walk (weightRepObservations, seriesForExercise) skipped
//      drop-set / myo-rep minis that the personal bests count (allSetsOf).
//   5. Profile → This week "usual": a partial first week counted as a whole
//      one (Math.ceil), and a true 0 was hidden (`usual || null`).
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
const S = await import(BASE + 'store.js');
const { store, todayISO } = S;
const { SessionView } = await import(BASE + 'views-session.js');
const { clearDraft, loadDraft } = await import(BASE + 'session-draft.js');
const { repPrediction } = await import(BASE + 'exercise-estimate.js');
const { setE1rm } = await import(BASE + 'set-e1rm.js');
const { weightRangeForReps } = await import(BASE + 'set-reps.js');
const { repsForWeight } = await import(BASE + 'e1rm.js');
const { observedDaysPerWeek } = await import(BASE + 'optimal.js');
const { allSetsOf } = await import(BASE + 'personal-bests.js');
const me = await import(BASE + 'views-me.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
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
const daysAgo = (n) => localISO(new Date(ty, tm - 1, td - n));
const inBand = (p, r) => p && !p.over && !p.atLeast && p.low <= r && r <= p.high;
const bandText = (p) => (!p ? 'null' : p.over ? 'over' : p.atLeast ? `${p.reps}+` : `${p.low}–${p.high} (${p.reps})`);

/* ============ 1a. the caption at a set's own weight gives that set's reps back ============ */
{
  const curl = byName('Dumbbell Curl');
  const bench = byName('Barbell Bench Press');
  const cases = [
    [curl, 25, 10], [bench, 225, 5], [bench, 185, 10], [byName('Back Squat'), 275, 8],
    [byName('Leg Extension'), 100, 12], [byName('Barbell Curl'), 65, 10],
    [byName('Dumbbell Bench Press'), 60, 10], [byName('Leg Press'), 400, 5],
  ];
  for (const [ex, w, r] of cases) {
    const own = setE1rm(ex, w, r);
    const total = own.perSide ? w * 2 : w;
    const p = repPrediction(own.e1rm, total, { exercise: ex });
    ok(p && p.reps === r && inBand(p, r),
      `${ex.name} done ${w}${own.perSide ? '/side' : ''} × ${r}: the caption at ${w} says ${r} (got ${bandText(p)})`);
  }
}

/* ============ 1b. the plan's weights and the caption agree ============ */
{
  const bench = byName('Barbell Bench Press');
  const own = setE1rm(bench, 225, 5);
  const plan = weightRangeForReps([8, 10], own.e1rm, 5);
  ok(plan && plan.low === 180 && plan.high === 195, `(guard) bench 225 × 5 → an 8–10 plan reads 180–195 (${plan && plan.low}–${plan && plan.high})`);
  const atLow = repPrediction(own.e1rm, plan.low, { exercise: bench });
  const atHigh = repPrediction(own.e1rm, plan.high, { exercise: bench });
  ok(inBand(atLow, 12), `at the plan's light end (180) the caption includes the plan's 12 to failure (got ${bandText(atLow)})`);
  ok(inBand(atHigh, 9), `at the plan's heavy end (195) it includes the plan's 9 (got ${bandText(atHigh)})`);
  ok(atLow.reps === Math.round(repsForWeight(own.e1rm, 180)),
    `and its middle number is the max's own curve read backwards (${atLow.reps} vs ${repsForWeight(own.e1rm, 180).toFixed(2)})`);

  const curl = byName('Dumbbell Curl');
  const c = setE1rm(curl, 25, 10);
  const cp = weightRangeForReps([8, 10], c.e1rm / 2, 5);
  const capAt = repPrediction(c.e1rm, cp.low * 2, { exercise: curl });
  ok(cp && inBand(capAt, 12),
    `a per-side plan (${cp.low}–${cp.high}/side) agrees with the caption at ${cp.low}/side (got ${bandText(capAt)})`);
  ok(repPrediction(c.e1rm, 25 * 2, { exercise: curl }).atLeast === false,
    '🚨 Dumbbell Curl 25/side after a 25/side × 10: no "15+"');
  // Unchanged: at the max it still says so, nothing reads 0, and long sets still stop at 15+.
  ok(repPrediction(225, 225).over === true, 'at the max it still says "at or above"');
  ok(repPrediction(225, 60).atLeast === true && repPrediction(225, 60).reps === 15, 'a very light weight still reads 15+');
  ok(repPrediction(225, 223).low >= 1, 'just under the max it never reads 0');
}

/* ============ 1c. the runner itself (jsdom) ============ */
async function runnerCaption(ex, hist, item) {
  clearDraft();
  await store.clearAll();
  await store.saveSession({ workoutId: 'hist', workoutName: 'Old', date: daysAgo(3),
    entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: [hist] }] });
  const w = await store.saveWorkout({ name: 'Test', exercises: [{ exerciseId: ex.id, sets: 1, notes: '', ...item }] });
  const run = await mount(SessionView(w.id));
  for (let i = 0; i < 6; i++) await settle();
  const caps = [...run.querySelectorAll('.step-est')].map((n) => n.textContent);
  const weight = Number(loadDraft().entries[0].sets[0].weight) || 0;
  clearDraft();
  return { caps, weight };
}
{
  const curl = byName('Dumbbell Curl');
  const r1 = await runnerCaption(curl, { weight: 25, reps: 10 }, {});
  const m1 = /maybe (\d+)(?:–(\d+))?(\+)? to failure/.exec(r1.caps[1] || '');
  ok(r1.weight === 25 && m1 && !m1[3] && Number(m1[1]) <= 10 && 10 <= Number(m1[2] || m1[1]),
    `runner: Dumbbell Curl at 25/side after 25/side × 10 reads a band holding 10 (${JSON.stringify(r1.caps[1])})`);

  const bench = byName('Barbell Bench Press');
  const r2 = await runnerCaption(bench, { weight: 225, reps: 5 }, { reps: [{ lo: 8, hi: 10 }] });
  const m2 = /maybe (\d+)(?:–(\d+))?(\+)? to failure/.exec(r2.caps[1] || '');
  ok(r2.weight === 180 && m2 && !m2[3] && Number(m2[1]) <= 12 && 12 <= Number(m2[2] || m2[1]),
    `runner: a bench plan of 8–10 prefilled ${r2.weight} reads a band holding the plan's 12 (${JSON.stringify(r2.caps[1])})`);
}

/* ============ 2. observedDaysPerWeek has volumeWindow's fencepost ============ */
{
  const T = '2026-08-18';
  const back = (n) => { const d = new Date(Date.UTC(2026, 7, 18 - n)); return d.toISOString().slice(0, 10); };
  const three = [];
  for (let w = 0; w < 3; w++) for (const off of [0, 2, 4]) three.push(back(w * 7 + off));
  const o = observedDaysPerWeek(three, T);
  ok(o && o.daysPerWeek < 3.2, `9 sessions in 19 days (3 a week) no longer reads 3.32 (got ${o && o.daysPerWeek.toFixed(2)})`);
  const eb13 = observedDaysPerWeek([back(1), back(8), back(15), back(22)], T);
  ok(eb13 && Math.abs(eb13.daysPerWeek - 1) < 1e-9, `EB-13's own case: once a week for 4 weeks reads 1.00 (got ${eb13 && eb13.daysPerWeek.toFixed(2)})`);

  // Same span as the store's volume window, on the same dates.
  await store.clearAll();
  const bench = byName('Barbell Bench Press');
  for (const date of three) {
    await store.saveSession({ workoutId: 'w', workoutName: 'Push', date,
      entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 135, reps: 8 }] }] });
  }
  const tfm = await S.trainingForMuscle('Chest', 28, T);
  ok(tfm && o && Math.abs(tfm.spanDays - o.spanDays) < 1e-9,
    `and the span is the volume window's (${o && o.spanDays} vs ${tfm && tfm.spanDays})`);
}

/* ============ 3. an entry with no recorded sets is not a session for the muscle ============ */
{
  await store.clearAll();
  const T = today;
  const bench = byName('Barbell Bench Press');
  const squat = byName('Back Squat');
  for (const n of [21, 14, 7, 0]) {
    await store.saveSession({ workoutId: 'w', workoutName: 'Push', date: daysAgo(n),
      entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }] }] });
  }
  // A leg day that also opened bench and logged nothing on it (a zeroed plan row).
  await store.saveSession({ workoutId: 'w2', workoutName: 'Legs', date: daysAgo(3),
    entries: [
      { exerciseId: squat.id, exerciseName: squat.name, sets: [{ weight: 185, reps: 5 }] },
      { exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 0, reps: 0, fromPlan: true }] },
    ] });
  const tfm = await S.trainingForMuscle('Chest', 28, T);
  const vol = await S.weeklyVolumeByMuscle(28, T);
  const chest = vol && vol.muscles.find((m) => m.muscle === 'Chest');
  ok(tfm && chest && Math.abs(tfm.sessionsPerWeek - chest.sessionsPerWeek) < 1e-9,
    `Goals and Volume agree on chest sessions a week (${tfm && tfm.sessionsPerWeek.toFixed(3)} vs ${chest && chest.sessionsPerWeek.toFixed(3)})`);
  ok(tfm && Math.abs(tfm.sessionsPerWeek - 4 / (tfm.spanDays / 7)) < 1e-9,
    `the empty bench entry is not a chest session (4 sessions, got ${tfm && (tfm.sessionsPerWeek * tfm.spanDays / 7).toFixed(2)})`);
}

/* ============ 4. the Graph reads drop-set and myo-rep minis like the bests do ============ */
{
  await store.clearAll();
  const ext = byName('Leg Extension');
  const sets = [
    { weight: 120, reps: 10 },
    { weight: 110, reps: 9, minis: [{ weight: 130, reps: 4 }, { weight: 90, reps: 8 }] },
  ];
  await store.saveSession({ workoutId: 'w', workoutName: 'Legs', date: daysAgo(2),
    entries: [{ exerciseId: ext.id, exerciseName: ext.name, setType: 'drop', sets }] });
  const obs = await S.weightRepObservations(ext.id);
  ok(obs.length === allSetsOf(sets).length,
    `every set the bests read is an observation (${obs.length} of ${allSetsOf(sets).length})`);
  const wSeries = await S.seriesForExercise(ext.id, 'weight');
  ok(wSeries.length === 1 && wSeries[0].value === 130,
    `the heaviest-weight line reaches the 130 drop the bests count (got ${wSeries.map((p) => p.value)})`);
}

/* ============ 5. Profile → This week "usual" ============ */
{
  const e = [{ exerciseId: 'x', exerciseName: 'Back Squat', sets: [{ weight: 135, reps: 5 }] }];
  // 2026-09-27 is a Sunday, so this week's Monday is 09-21.
  // First ever workout Thu 09-10: one whole week before this one (09-14..20) and a partial one.
  const partial = me.weekSummary([
    { date: '2026-09-10', entries: e }, { date: '2026-09-11', entries: e },
    { date: '2026-09-15', entries: e }, { date: '2026-09-22', entries: e },
  ], '2026-09-27');
  ok(partial.usual === 1, `a partial first week is not counted as a whole one (usual ${partial.usual}, want 1)`);
  // Trained once, long ago, nothing in the last four weeks: usual is a real 0.
  const zero = me.weekSummary([{ date: '2026-06-01', entries: e }, { date: '2026-09-22', entries: e }], '2026-09-27');
  ok(zero.usual === 0, `four empty weeks read usual 0, not nothing (got ${zero.usual})`);
  const fresh = me.weekSummary([{ date: '2026-09-22', entries: e }], '2026-09-27');
  ok(fresh.usual === null, 'a first week still has no "usual"');
  const { weekBlock } = await import(BASE + 'profile-shape.js');
  const node = weekBlock({ ...zero, onOpen: () => {} });
  ok(/usual 0/.test(node.textContent), `and the block prints "usual 0" (${JSON.stringify(node.textContent)})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
