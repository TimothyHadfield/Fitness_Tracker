// Review round 4 (2026-09-25): Profile and Data stop recomputing ratings from
// unchanged rows.   node tests/perf-memo.test.mjs   (needs jsdom)
//
// Tim: *"Put professional level annimation and physics into this cite...
// Impress me."* Measured (Chrome, iPhone size, 4x CPU throttle): Profile froze
// 450-600ms on every open inside `muscleRatings()`, and the first open of Data
// spent ~80ms in `weeklyVolumeByMuscle()`, both during the screen's crossfade.
//
// What is pinned here: a kept answer is IDENTICAL to a fresh computation; each
// caller gets its own copy; any write makes it recompute; rows that are not this
// device's cached rows (a friend's, the famous lifters') are never served from
// the memo; and a background revalidation that found nothing new keeps it.
import { JSDOM } from 'jsdom';
import { isDeepStrictEqual } from 'node:util';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/me', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.HTMLElement.prototype.scrollIntoView = function () {};
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const sess = new Map([['ftrack:v1:demo', '1']]);
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const root = new URL('../', import.meta.url);
const S = await import(new URL('js/store.js', root).href);
const { store } = S;
const clearMemo = () => { if (typeof S.__clearStrengthMemosForTest === 'function') S.__clearStrengthMemosForTest(); };
const timed = async (fn) => { const t = performance.now(); const v = await fn(); return [v, performance.now() - t]; };
// Every computation reads the exercise map through `store.getExerciseMap()`; a
// kept answer does not. Counting those calls tells a hit from a recompute
// without trusting a clock. (Profile's rows are read BEFORE the count starts.)
const realMap = store.getExerciseMap.bind(store);
let mapReads = 0;
store.getExerciseMap = (...a) => { mapReads++; return realMap(...a); };
const timedCount = async (fn) => {
  const n0 = mapReads; const t = performance.now();
  const v = await fn();
  return [v, performance.now() - t, mapReads - n0];
};
// Exactly Profile's call (js/views-me.js fill()).
const profileRows = async () => {
  const [sessions, benchmarks, bodyWeights] = await Promise.all([
    store.getSessions(), store.getBenchmarks(), store.getBodyWeights()]);
  return { sessions, benchmarks, bodyWeights };
};

S.clearReadCache();
await S.muscleStrength();   // warms every collection the ratings read
const sessions0 = await store.getSessions();
ok(sessions0.length >= 50, `the demo account is a real-sized history (${sessions0.length} sessions)`);

/* ---------- 1. muscleRatings() as Profile calls it ---------- */
{
  clearMemo();
  const [fresh, cold, n1] = await timedCount(async () => S.muscleRatings(await profileRows()));
  const [a, warm, n2] = await timedCount(async () => S.muscleRatings(await profileRows()));
  const [b] = await timed(async () => S.muscleRatings(await profileRows()));
  ok(fresh.size > 5, `Profile's ratings exist (${fresh.size} muscles)`);
  ok(isDeepStrictEqual(a, fresh), 'a kept answer is deep-equal to the fresh computation');
  ok(a !== b && a.get([...a.keys()][0]) !== b.get([...b.keys()][0]), 'each caller gets its own copy');
  ok(n1 > 0 && n2 === 0, `the second open does not recompute (computed ${n1}×, then ${n2}×; ${cold.toFixed(1)}ms, then ${warm.toFixed(1)}ms)`);

  const k = [...b.keys()][0];
  b.get(k).estimate = -999; b.delete([...b.keys()][1]);
  const c = await S.muscleRatings(await profileRows());
  ok(isDeepStrictEqual(c, fresh), 'editing a copy does not change the kept answer');

  // Against a computation with no memo at all.
  clearMemo();
  const again = await S.muscleRatings(await profileRows());
  ok(isDeepStrictEqual(again, fresh), 'and it equals a recomputation from scratch');
}

/* ---------- 2. muscleRatings() with no rows (the runner's call) ---------- */
{
  clearMemo();
  const [fresh, cold, n1] = await timedCount(() => S.muscleRatings());
  const [a, warm, n2] = await timedCount(() => S.muscleRatings());
  ok(isDeepStrictEqual(a, fresh) && a !== fresh, 'no-rows: the kept answer is the same answer, a new copy');
  ok(n1 > 0 && n2 === 0, `no-rows: the second ask does not recompute (${cold.toFixed(1)}ms, then ${warm.toFixed(1)}ms)`);
  // Both callers are kept side by side — neither evicts the other.
  await S.muscleRatings(await profileRows());
  const [, , pn] = await timedCount(async () => S.muscleRatings(await profileRows()));
  const [, , nn] = await timedCount(() => S.muscleRatings());
  ok(pn === 0 && nn === 0, `Profile's and the runner's answers are both kept (recomputed ${pn}×, ${nn}×)`);
}

/* ---------- 3. rows that are not this device's cache are never memoised ---------- */
{
  // A friend's rows arrive as their own objects. Change one IN PLACE between two
  // calls with the SAME arrays: a memo keyed on those rows would hand back the
  // first answer.
  const theirs = structuredClone(await profileRows());
  const first = await S.muscleRatings(theirs);
  const exMap = await store.getExerciseMap();
  const bench = [...exMap.values()].find((e) => /^barbell bench press$/i.test(e.name));
  theirs.benchmarks.push({ id: 'bx', date: S.todayISO(), exerciseId: bench.id,
    exerciseName: bench.name, values: { weight: 405, reps: 1 } });
  const second = await S.muscleRatings(theirs);
  const c1 = first.get('Chest'), c2 = second.get('Chest');
  ok(c1 && c2 && c2.estimate > c1.estimate,
    `a friend's changed rows are recomputed (Chest ${c1 && Math.round(c1.estimate)} → ${c2 && Math.round(c2.estimate)})`);

  // The famous lifters pass their own `today`: always computed, as before.
  const rowsT = { ...(await profileRows()), today: '2020-01-01' };
  const t1 = await S.muscleRatings(rowsT);
  const t2 = await S.muscleRatings(rowsT);
  ok(isDeepStrictEqual(t1, t2), "a caller's own `today` still gives one answer");
}

/* ---------- 4. any write makes it recompute ---------- */
{
  const exMap = await store.getExerciseMap();
  const bench = [...exMap.values()].find((e) => /^barbell bench press$/i.test(e.name));
  const before = (await S.muscleRatings(await profileRows())).get('Chest');
  const beforeOwn = (await S.muscleRatings()).get('Chest');
  await store.saveBenchmark({ date: S.todayISO(), exerciseId: bench.id,
    exerciseName: bench.name, values: { weight: 330, reps: 1 } });
  const after = (await S.muscleRatings(await profileRows())).get('Chest');
  const afterOwn = (await S.muscleRatings()).get('Chest');
  ok(after && before && after.estimate > before.estimate,
    `a saved benchmark is in Profile's next answer (Chest ${Math.round(before.estimate)} → ${Math.round(after.estimate)})`);
  ok(afterOwn && beforeOwn && afterOwn.estimate > beforeOwn.estimate, 'and in the no-rows answer');
  clearMemo();
  ok(isDeepStrictEqual(await S.muscleRatings(await profileRows()), (await S.muscleRatings(await profileRows()))),
    'after the write, kept and fresh agree again');
}

/* ---------- 5. weeklyVolumeByMuscle() ---------- */
{
  for (const days of [365, 28]) {
    clearMemo();
    const [fresh, cold, n1] = await timedCount(() => S.weeklyVolumeByMuscle(days));
    const [a, warm, n2] = await timedCount(() => S.weeklyVolumeByMuscle(days));
    ok(fresh && isDeepStrictEqual(a, fresh) && a !== fresh && a.muscles !== fresh.muscles,
      `volume (${days} days): the kept answer is the same answer, a new copy`);
    ok(n1 > 0 && n2 === 0, `volume (${days} days): the second ask does not recompute (${cold.toFixed(2)}ms, then ${warm.toFixed(2)}ms)`);
    a.muscles[0].totalSets = -1;
    ok(isDeepStrictEqual(await S.weeklyVolumeByMuscle(days), fresh), `volume (${days} days): editing a copy changes nothing`);
  }
  const vol = await S.weeklyVolumeByMuscle(28);
  const ss = await store.getSessions();
  const recent = ss.find((s) => (s.entries || []).length);
  const copy = { ...structuredClone(recent), id: undefined, date: S.todayISO() };
  delete copy.id;
  await store.saveSession(copy);
  const vol2 = await S.weeklyVolumeByMuscle(28);
  const total = (v) => v.muscles.reduce((t, m) => t + m.totalSets, 0);
  ok(total(vol2) > total(vol), `a saved workout is in the next volume answer (${total(vol).toFixed(1)} → ${total(vol2).toFixed(1)} sets)`);
  // Somebody else's sessions are never served from the memo.
  const theirs = structuredClone(await store.getSessions());
  const f1 = await S.weeklyVolumeByMuscle(28, null, theirs);
  theirs.unshift({ ...structuredClone(recent), id: 'zz', date: S.todayISO() });
  const f2 = await S.weeklyVolumeByMuscle(28, null, theirs);
  ok(total(f2) > total(f1), "a friend's changed sessions are recomputed");
}

/* ---------- 6. a revalidation that found nothing new keeps the answer ---------- */
{
  // Jump past the 30s revalidation window; the next getters re-read in the background.
  const realNow = Date.now;
  Date.now = () => realNow() + 60_000;
  try {
    await profileRows(); await store.getSettings(); await store.getExerciseMap();
    await settle(50);
    clearMemo();
    const [fresh, cold] = await timed(async () => S.muscleRatings(await profileRows()));
    await profileRows(); await store.getSettings(); await store.getExerciseMap();
    await settle(50);
    Date.now = () => realNow() + 120_000;
    await profileRows(); await store.getSettings(); await store.getExerciseMap();
    await settle(50);
    const [kept, warm, n] = await timedCount(async () => S.muscleRatings(await profileRows()));
    ok(isDeepStrictEqual(kept, fresh), 'after an unchanged revalidation the answer is the same');
    ok(n === 0, `and it is still kept rather than recomputed (${cold.toFixed(1)}ms, then ${warm.toFixed(1)}ms)`);
  } finally { Date.now = realNow; }
}

/* ---------- 7. Profile's ranked best lifts, kept the same way (views-me.js) ---------- */
{
  const { MeView } = await import(new URL('js/views-me.js', root).href);
  const flat = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
  const mount = async () => {
    const node = await MeView();
    document.getElementById('app').replaceChildren(node);
    for (let i = 0; i < 40 && !node.querySelector('.me-bests'); i++) await settle(25);
    return node;
  };
  const benchRow = (me) => [...me.querySelectorAll('.me-bests .me-best')]
    .find((r) => /^Barbell Bench Press/.test(flat(r.querySelector('.row-title'))));
  const first = await mount();
  const second = await mount();
  ok(Boolean(first.querySelector('.me-bests')) && flat(first.querySelector('.me-bests')) === flat(second.querySelector('.me-bests')),
    'Profile opened twice shows the same best lifts, word for word');
  const before = flat(benchRow(second));
  const exMap = await store.getExerciseMap();
  const bench = [...exMap.values()].find((e) => /^barbell bench press$/i.test(e.name));
  await store.saveBenchmark({ date: S.todayISO(), exerciseId: bench.id,
    exerciseName: bench.name, values: { weight: 425, reps: 1 } });
  const third = await mount();
  const after = flat(benchRow(third));
  ok(before && after && before !== after && /425/.test(after),
    `a saved benchmark changes the bench row on the next open ("${before.slice(0, 40)}" → "${after.slice(0, 40)}")`);
}

console.log(fails ? `\n${fails} FAIL` : '\nall passed');
process.exit(fails ? 1 : 0);
