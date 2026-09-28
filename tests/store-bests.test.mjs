// Data's bests, charts, volume and the kept ratings — 2026-09-27 (overhaul
// EB-5, EB-6 store half, EB-13, R-8a, and the store's new contracts).
//   node tests/store-bests.test.mjs
//
// Runs on the demo backend (memory only, a year of invented training) and on
// rows handed in by hand. Never touches localStorage data or Firestore.
import { isDeepStrictEqual } from 'node:util';

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
const S = await import('../js/store.js');
const { store } = S;

const exercises = await store.getExercises();
const idOf = (name) => (exercises.find((e) => e.name === name) || {}).id;
const BENCH = idOf('Bench Press') || idOf('Barbell Bench Press');
const PLANK = idOf('Plank');
const RUN = idOf('Running');
const CARRY = idOf('Farmer Carry');
ok(BENCH && PLANK && RUN && CARRY, `the exercises exist (${[BENCH, PLANK, RUN, CARRY].join(', ')})`);

const today = S.todayISO();
const daysAgo = (n) => {
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const sessionOf = (n, exerciseId, sets) => ({
  id: 's' + n + exerciseId, date: daysAgo(n), workoutName: 'T', entries: [{ exerciseId, sets }],
});

/* ---------- EB-5: what "best" means without reps ---------- */
{
  const sessions = [
    sessionOf(30, PLANK, [{ time: 90 }]), sessionOf(20, PLANK, [{ time: 30 }]), sessionOf(10, PLANK, [{ time: 120 }]),
    sessionOf(29, RUN, [{ distance: 5, time: 1500 }]), sessionOf(19, RUN, [{ distance: 1, time: 420 }]),
    sessionOf(9, RUN, [{ distance: 3, time: 900 }]), sessionOf(8, RUN, [{ distance: 5, time: 1440 }]),
    sessionOf(28, CARRY, [{ weight: 50, time: 40 }]), sessionOf(18, CARRY, [{ weight: 70, time: 30 }]),
    sessionOf(7, CARRY, [{ weight: 70, time: 35 }]), sessionOf(6, CARRY, [{ weight: 60, time: 60 }]),
  ];
  const bests = await S.currentBests({ sessions, benchmarks: [], bodyWeights: [] });
  const row = (id) => bests.find((b) => b.id === id) || {};
  ok(row(PLANK).best && row(PLANK).best.time === 120, `plank 90/30/120 s → best is the longest hold (${row(PLANK).best && row(PLANK).best.time} s)`);
  ok(row(RUN).best && row(RUN).best.distance === 5 && row(RUN).best.time === 1440,
     `running → the longest distance, then the faster time (${JSON.stringify(row(RUN).best && { d: row(RUN).best.distance, t: row(RUN).best.time })})`);
  ok(row(CARRY).best && row(CARRY).best.weight === 70 && row(CARRY).best.time === 35,
     `farmer carry → the heaviest load, then the longest time, and the load is kept (${JSON.stringify(row(CARRY).best && { w: row(CARRY).best.weight, t: row(CARRY).best.time })})`);
  ok(!('scored' in row(PLANK)) && !('plain' in row(PLANK)), 'no working fields leak onto the rows');
}

/* ---------- EB-6: a typo is held out of bests and charts ---------- */
{
  // 135×5 for three weeks, a slip to 1350×5, then 135–140×5 again.
  const sets = (w) => [{ weight: w, reps: 5 }, { weight: w, reps: 5 }, { weight: w, reps: 5 }];
  const sessions = [
    sessionOf(40, BENCH, sets(135)), sessionOf(37, BENCH, sets(135)), sessionOf(33, BENCH, sets(135)),
    sessionOf(30, BENCH, [{ weight: 1350, reps: 5 }, { weight: 135, reps: 5 }]),
    sessionOf(26, BENCH, sets(135)), sessionOf(23, BENCH, sets(140)), sessionOf(19, BENCH, sets(140)),
  ];
  const rows = { sessions, benchmarks: [], bodyWeights: [] };
  const bests = await S.currentBests(rows);
  const b = bests.find((x) => x.id === BENCH);
  ok(b && b.best.weight === 140 && b.best.reps === 5, `Data's best bench is 140×5, not the 1350 slip (${b && b.best.weight}×${b && b.best.reps})`);
  ok(b && b.e1rm < 200, `and its estimated max is believable (${b && b.e1rm && b.e1rm.toFixed(1)})`);
  ok(b && Array.isArray(b.held) && b.held.some((h) => h.weight === 1350), 'the held set is listed on the row, not deleted');

  const weight = await S.seriesForExercise(BENCH, 'weight', null, rows);
  ok(weight.length === 7 && Math.max(...weight.map((p) => p.value)) === 140,
     `the weight chart has no 1350 spike (max ${Math.max(...weight.map((p) => p.value))}, ${weight.length} days)`);
  ok(weight.find((p) => p.date === daysAgo(30)).value === 135, 'the slip day still plots its real 135 set');
  ok(Array.isArray(weight.held) && weight.held.length === 1 && weight.held[0].weight === 1350, 'the chart gets the held set on `.held`');

  const norm = await S.normalizedSeries(BENCH, 5, null, rows);
  ok(norm.length === 7 && Math.max(...norm.map((p) => p.value)) < 200,
     `the normalized chart has no spike (max ${Math.max(...norm.map((p) => p.value)).toFixed(1)})`);
  ok(Array.isArray(norm.held) && norm.held.length === 1 && norm.held[0].weight === 1350, 'and lists the held set');

  // A clean history holds nothing and is unchanged.
  const clean = { sessions: sessions.filter((s) => s.date !== daysAgo(30)), benchmarks: [], bodyWeights: [] };
  const cb = (await S.currentBests(clean)).find((x) => x.id === BENCH);
  ok(cb && cb.best.weight === 140 && !cb.held, 'a clean history holds nothing');
}

/* ---------- EB-13: a new account's weekly volume ---------- */
{
  // 3 sets of bench once a week for four weeks: days −1, −8, −15, −22.
  const sessions = [1, 8, 15, 22].map((n) => sessionOf(n, BENCH, [
    { weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }]));
  const vol = await S.weeklyVolumeByMuscle(28, today, sessions);
  const chest = vol && vol.muscles.find((m) => m.muscle === 'Chest');
  ok(chest && Math.abs(chest.weeklySets - 3.0) < 0.05, `4 weeks of 3 sets reads 3.0/wk, not 3.65 (${chest && chest.weeklySets.toFixed(2)})`);
  ok(vol && vol.enough === true, 'the two-week floor is unchanged (23 days measured)');

  // Nine days of training is still not enough to call a rate.
  const young = await S.weeklyVolumeByMuscle(28, today, [1, 4, 8].map((n) => sessionOf(n, BENCH, [{ weight: 135, reps: 8 }])));
  ok(young && young.enough === false, 'a nine-day-old account is still "not enough yet"');
}

/* ---------- R-8a: the kept ratings survive writes they do not read ---------- */
{
  await S.muscleStrength();     // warms every collection the ratings read
  const realMap = store.getExerciseMap.bind(store);
  let mapReads = 0;
  store.getExerciseMap = (...a) => { mapReads++; return realMap(...a); };
  S.__clearStrengthMemosForTest();

  const r1 = await S.muscleRatings();
  const s1 = await S.muscleStrength();
  const n0 = mapReads;
  // What the runner and Settings write between two runner opens.
  await store.saveSettings({ runnerView: 'list', theme: 'light', keepAwake: false });
  const r2 = await S.muscleRatings();
  const s2 = await S.muscleStrength();
  ok(mapReads === n0, `a settings write no rating reads keeps both answers (${mapReads - n0} recomputes)`);
  ok(isDeepStrictEqual(r1, r2) && isDeepStrictEqual(s1, s2), 'the kept answers are the same values');

  // Byte-identical to a fresh computation.
  S.__clearStrengthMemosForTest();
  const r3 = await S.muscleRatings();
  const s3 = await S.muscleStrength();
  ok(mapReads > n0, 'clearing the memo really recomputes');
  const bytes = (m) => JSON.stringify([...m.entries()]);
  ok(bytes(r2) === bytes(r3), `kept ratings are byte-identical to a fresh walk (${r3.size} muscles)`);
  ok(bytes(s2.muscles) === bytes(s3.muscles) && JSON.stringify(s2.profile) === JSON.stringify(s3.profile),
     'kept strength map is byte-identical too');

  // A field the ratings DO read still invalidates.
  const n1 = mapReads;
  const cur = await store.getSettings();
  await store.saveSettings({ gender: cur.gender === 'female' ? 'male' : 'female' });
  await S.muscleRatings();
  ok(mapReads > n1, 'changing gender recomputes');
  const n2 = mapReads;
  await store.saveSettings({ birthYear: 1990 });
  await S.muscleStrength();
  ok(mapReads > n2, 'changing birth year recomputes the strength map');
  store.getExerciseMap = realMap;
}

/* ---------- normalizeSession keeps `deload` ---------- */
{
  const saved = await store.saveSession({ date: today, workoutName: 'Light', entries: [], deload: true });
  ok((await store.getSession(saved.id)).deload === true, 'a deload session keeps deload: true');
  const odd = await store.saveSession({ date: today, workoutName: 'X', entries: [], deload: 'yes' });
  ok(!('deload' in (await store.getSession(odd.id))), 'anything but true is not a deload');
  ok(!('deload' in S.normalizeSession({ id: 'a', deload: false })), 'false is simply absent');
}

/* ---------- the rep spec's `plus` survives normalizeWorkout ---------- */
{
  const w = S.normalizeWorkout({ id: 'w', name: 'W', exercises: [
    { exerciseId: BENCH, sets: 3, reps: [{ lo: 8, hi: 12 }, { lo: 5, hi: 5, plus: true }] },
    { exerciseId: PLANK, sets: 2, reps: [{ lo: 5, hi: 8 }] },
  ] });
  const reps = w.exercises[0].reps;
  ok(reps && reps.length === 3 && !reps[0].plus && reps[1].plus === true && reps[2].plus === true,
     `"5+" keeps plus, and padding repeats it (${JSON.stringify(reps)})`);
  ok(w.exercises[1].reps.every((r) => !('plus' in r)), 'a spec without plus gains none');
  const again = S.normalizeWorkout(w);
  ok(isDeepStrictEqual(again.exercises, w.exercises), 'normalizing twice changes nothing');
}

/* ---------- updateWorkoutExercises ---------- */
{
  ok(typeof store.updateWorkoutExercises === 'function', 'store.updateWorkoutExercises exists');
  const all = await store.getWorkouts();
  const w = all.find((x) => x.exercises.length >= 3);
  const [a, b, c] = w.exercises;
  const swapIn = exercises.find((e) => !w.exercises.some((x) => x.exerciseId === e.id)).id;
  const added = exercises.filter((e) => !w.exercises.some((x) => x.exerciseId === e.id) && e.id !== swapIn)[3].id;
  const rest = w.exercises.slice(3);
  // Today: a kept, b swapped for swapIn, c removed, one added, the rest kept.
  const today2 = [
    { exerciseId: a.exerciseId },
    { exerciseId: swapIn, swappedFrom: b.exerciseId },
    ...rest.map((e) => ({ exerciseId: e.exerciseId, sets: 99 })),
    { exerciseId: added, sets: 4 },
  ];
  await store.updateWorkoutExercises(w.id, today2);
  const after = await store.getWorkout(w.id);
  ok(after.exercises.length === w.exercises.length, `one removed, one added (${w.exercises.length} → ${after.exercises.length})`);
  ok(isDeepStrictEqual(after.exercises[0], a), 'a kept exercise keeps every planned field');
  const swapped = after.exercises[1];
  ok(swapped.exerciseId === swapIn && swapped.sets === b.sets
     && isDeepStrictEqual(swapped.reps, b.reps) && isDeepStrictEqual(swapped.targets, b.targets),
     'a swap takes over the old exercise\'s plan');
  ok(!after.exercises.some((e) => e.exerciseId === c.exerciseId) || rest.some((e) => e.exerciseId === c.exerciseId),
     'the removed exercise is gone');
  ok(rest.every((e, i) => after.exercises[2 + i].sets === e.sets), 'kept exercises keep their set counts (today\'s 99 ignored)');
  const last = after.exercises[after.exercises.length - 1];
  ok(last.exerciseId === added && last.sets === 4, 'an added exercise gets today\'s set count');
  ok(after.name === w.name && after.systemId === w.systemId, 'the workout itself is otherwise unchanged');
  ok((await store.updateWorkoutExercises(w.id, [])) === null, 'an empty list never empties a workout');
  ok((await store.updateWorkoutExercises('nope', today2)) === null, 'an unknown workout is null');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
