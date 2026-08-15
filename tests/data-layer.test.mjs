// Headless tests for the data layer. No DOM required.
//   node tests/data-layer.test.mjs

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { BUILT_IN_EXERCISES, makeCustomExercise } = await import('../js/exercises.js');
const {
  store, auth, seriesForExercise, chartableExercises, activityByDate, todayISO,
  normalizeWorkout, DEFAULT_SETS, benchmarkComparison,
  normalizedSeries, defaultTargetReps, weightRepObservations,
} = await import('../js/store.js');
const {
  e1rm, weightForReps, normalizeWeight, modalReps, canNormalize,
  kFactor, clampReps, repConfidence, K_FLOOR, LB_PER_KG,
} = await import('../js/e1rm.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

/* ---------- library ---------- */
ok(BUILT_IN_EXERCISES.length > 200, `library has ${BUILT_IN_EXERCISES.length} exercises`);
ok(new Set(BUILT_IN_EXERCISES.map((e) => e.id)).size === BUILT_IN_EXERCISES.length, 'all ids unique');
ok(BUILT_IN_EXERCISES.every((e) => e.fields && e.fields.length), 'every exercise declares fields');

/* ---------- load types ---------- */
ok(byName('Dumbbell Bench Press').loadType === 'per_side', 'dumbbell press = per side');
ok(byName('Barbell Bench Press').loadType === 'total', 'barbell press = total');
ok(byName('Leg Press').loadType === 'total', 'machine leg press = total');
ok(byName('Lat Pulldown').loadType === 'total', 'single-stack cable pulldown = total');
ok(byName('Cable Crossover').loadType === 'per_side', 'cable crossover (two stacks) = per side');
ok(byName('Single-Arm Lat Pulldown').loadType === 'per_side', 'single-arm cable = per side');
ok(byName('Goblet Squat').loadType === 'total', 'goblet squat (one bell, two hands) = total');
ok(byName('Kettlebell Swing').loadType === 'total', 'kb swing (two hands) = total');
ok(byName('Farmer Carry').loadType === 'per_side', 'farmer carry = per side');
ok(byName('Plank').loadType === null, 'time-only exercise has no load type');
ok(byName('Running').loadType === null, 'cardio has no load type');
ok(
  BUILT_IN_EXERCISES.filter((e) => e.fields.includes('weight')).every((e) => e.loadType),
  'every weighted exercise has a load type',
);

/* ---------- e1RM math (Marzagao 2026) ---------- */
// 1RM = w * (1 + (r-1)^0.85 / k(w)),  k(w) = max(K_FLOOR, -2.55 + 4.58*ln(w_kg))
ok(e1rm(100, 1) === 100, 'a single rep is its own 1RM — no extrapolation');
ok(near(e1rm(135, 5), 161.92), `e1rm(135x5) = 161.9 (${e1rm(135, 5).toFixed(2)})`);
ok(near(e1rm(25, 10), 43.88), `e1rm(25x10) = 43.9 (${e1rm(25, 10).toFixed(2)})`);
ok(e1rm(0, 5) === null && e1rm(-10, 5) === null, 'non-positive weight has no e1RM');
ok(e1rm(100, 0) === null, 'zero reps has no e1RM');

// Published k values, converted from the paper's kg reference points.
ok(near(kFactor(70), 16.9, 0.05), `k(70kg barbell bench) = 16.9 (${kFactor(70).toFixed(2)})`);
ok(near(kFactor(150), 20.4, 0.05), `k(150kg deadlift) = 20.4 (${kFactor(150).toFixed(2)})`);
ok(kFactor(1) === K_FLOOR, 'k is floored below the turning point');

// The floor exists to keep the curve invertible. Above the turning point the
// published curve applies; below it, k is held constant so e1rm stays
// increasing in weight. Without this a heavier lift could score LOWER.
let prev = 0, monotonic = true;
for (let lb = 1; lb <= 400; lb += 1) {
  const v = e1rm(lb, 12);
  if (v <= prev) { monotonic = false; break; }
  prev = v;
}
ok(monotonic, 'e1rm is strictly increasing in weight across 1-400 lbs (invertible)');

// Inversion round-trips.
ok(near(weightForReps(e1rm(185, 6), 6), 185), 'weightForReps inverts e1rm');
ok(weightForReps(200, 1) === 200, 'inverting at 1 rep returns the 1RM itself');
ok(normalizeWeight(100, 5, 5) === 100, 'normalising to the same rep count is the identity');
ok(normalizeWeight(135, 5, 3) > 135, 'fewer reps means more weight');
ok(normalizeWeight(135, 5, 10) < 135, 'more reps means less weight');

// Tim's worked example: 25x10, 45x4, 35x10, 60x1, 45x10 -> compared at 10 reps.
ok(near(normalizeWeight(45, 4, 10), 33.34), `45x4 at 10 reps = 33.3 (${normalizeWeight(45, 4, 10).toFixed(2)})`);
ok(near(normalizeWeight(60, 1, 10), 36.92), `60x1 at 10 reps = 36.9 (${normalizeWeight(60, 1, 10).toFixed(2)})`);
const worked = [[25, 10], [45, 4], [35, 10], [60, 1], [45, 10]].map(([w, r]) => normalizeWeight(w, r, 10));
ok(worked.every((v, i) => i === 0 || v > worked[i - 1]), 'the worked example comes out monotonically rising');

/* ---------- choosing the rep count ---------- */
ok(modalReps([{ reps: 10, date: '2026-01-01' }, { reps: 4, date: '2026-02-01' }, { reps: 10, date: '2026-03-01' }]) === 10,
   'modal reps picks the most frequent');
ok(modalReps([{ reps: 5, date: '2026-01-01' }, { reps: 3, date: '2026-02-01' }]) === 3,
   'ties go to the most recently used');
ok(modalReps([]) === null, 'no observations means no default');
ok(modalReps([{ reps: 'x' }, { reps: null }]) === null, 'junk rep values ignored');
ok(clampReps(0) === 1 && clampReps(99) === 20, 'target reps clamped to 1-20');
ok(repConfidence(8) === 'good' && repConfidence(13) === 'fair' && repConfidence(18) === 'poor',
   'confidence degrades past 10 and 15 reps');

/* ---------- where normalising is honest ---------- */
ok(canNormalize(byName('Barbell Bench Press')), 'barbell bench can be normalised');
ok(canNormalize(byName('Dumbbell Curl')), 'dumbbell isolation work can be normalised');
ok(
  BUILT_IN_EXERCISES.filter((e) => e.equipment === 'Bodyweight').every((e) => !canNormalize(e)),
  'no bodyweight exercise is ever normalised',
);
ok(!canNormalize(byName('Pull-Up')),
   'bodyweight excluded — logged weight is added load, not total resistance');
ok(!canNormalize(byName('Assisted Pull-Up')),
   'assisted excluded — logged weight is assistance, so more weight is easier');
ok(!canNormalize(byName('Plank')), 'time-only exercise cannot be normalised');
ok(!canNormalize(byName('Push-Up')), 'reps-only exercise has no weight to normalise');
ok(!canNormalize(byName('Running')), 'cardio cannot be normalised');
ok(near(LB_PER_KG, 2.2046, 0.001), 'pound/kilogram constant');

/* ---------- workout: set counts + notes ---------- */
const bench = byName('Barbell Bench Press');
const squat = byName('Back Squat');
const plank = byName('Plank');

const w = await store.saveWorkout({
  name: 'Push',
  exercises: [
    { exerciseId: bench.id, sets: 4, notes: 'Pause on chest' },
    { exerciseId: byName('Cable Fly').id, sets: 3, notes: '' },
  ],
});
const loaded = await store.getWorkout(w.id);
ok(loaded.exercises[0].sets === 4, 'planned set count persisted');
ok(loaded.exercises[0].notes === 'Pause on chest', 'per-exercise note persisted');
ok(loaded.exerciseIds === undefined, 'legacy exerciseIds dropped on save');

/* ---------- migration ---------- */
const legacy = normalizeWorkout({ id: 'old', name: 'Legs', exerciseIds: ['a', 'b'] });
ok(legacy.exercises.length === 2, 'legacy workout migrated');
ok(legacy.exercises[0].sets === DEFAULT_SETS, `legacy defaults to ${DEFAULT_SETS} sets`);
ok(normalizeWorkout({ exercises: [{ exerciseId: 'x', sets: 0 }] }).exercises[0].sets === DEFAULT_SETS,
   'invalid set count falls back to default');

/* ---------- sessions + prefill ---------- */
await store.saveSession({
  workoutId: w.id, workoutName: 'Push', date: '2026-08-01',
  entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 7 }] }],
});
await store.saveSession({
  workoutId: w.id, workoutName: 'Push', date: '2026-08-08',
  entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 155, reps: 6 }] }],
});

const last = await store.lastSetsFor(w.id, bench.id);
ok(last && last[0].weight === 155, `prefill uses most recent session (${last && last[0].weight})`);

const build = (hist, planned) =>
  Array.from({ length: planned }, (_, i) => (hist.length ? hist[Math.min(i, hist.length - 1)] : null));
ok(build(last, 4).length === 4, 'builds the planned number of sets');
ok(build(last, 4)[3].weight === 155, 'repeats the last set when history is short');

/* ---------- benchmarks ---------- */
await store.saveBenchmark({ date: '2026-06-01', exerciseId: bench.id, exerciseName: bench.name, values: { weight: 135, reps: 5 } });
await store.saveBenchmark({ date: '2026-08-12', exerciseId: bench.id, exerciseName: bench.name, values: { weight: 175, reps: 3 } });
await store.saveBenchmark({ date: '2026-06-02', exerciseId: squat.id, exerciseName: squat.name, values: { weight: 225, reps: 5 } });
await store.saveBenchmark({ date: '2026-08-13', exerciseId: squat.id, exerciseName: squat.name, values: { weight: 315, reps: 3 } });
await store.saveBenchmark({ date: '2026-07-01', exerciseId: plank.id, exerciseName: plank.name, values: { time: 60 } });

/* ---------- line series (all sources) ---------- */
const series = await seriesForExercise(bench.id, 'weight');
ok(series.length === 4, `line series mixes sessions + benchmarks (${series.length} points)`);
ok(series[series.length - 1].value === 175, 'series ends at latest value');

const chartable = await chartableExercises(2);
ok(chartable.find((c) => c.id === bench.id), 'bench is chartable');
ok(chartable.find((c) => c.id === bench.id).loadType === 'total', 'chartable carries loadType');
ok(chartable.find((c) => c.id === bench.id).normalizable, 'bench is flagged normalisable');
ok(chartable.find((c) => c.id === plank.id) === undefined
   || !chartable.find((c) => c.id === plank.id).normalizable, 'plank is not normalisable');

/* ---------- rep-normalised series (line chart) ---------- */
// bench observations: 135x5 bench, 135x8 + 135x7 workout, 155x6 workout, 175x3 bench
const obs = await weightRepObservations(bench.id);
ok(obs.length === 5, `every SET is one observation, not one per day (${obs.length})`);
ok(obs.filter((o) => o.date === '2026-08-01').length === 2, 'both sets of a session are kept');

// Every rep count appears once except none repeat, so the tie goes to the most
// recent — 3 reps, logged 2026-08-12.
ok(await defaultTargetReps(bench.id) === 3, `default target reps = 3 (${await defaultTargetReps(bench.id)})`);

const norm8 = await normalizedSeries(bench.id, 8);
ok(norm8.length === 4, `one point per day (${norm8.length})`);
ok(norm8.every((p, i) => i === 0 || p.date >= norm8[i - 1].date), 'points ordered by date');

const aug1 = norm8.find((p) => p.date === '2026-08-01');
ok(aug1.actual === true, '135x8 is a real measurement at the 8-rep target');
ok(aug1.value === 135, 'a measured point is shown at its logged weight, untouched');

const jun1 = norm8.find((p) => p.date === '2026-06-01');
ok(jun1.actual === false, '135x5 is an estimate when compared at 8 reps');
ok(jun1.value < 135, `estimated down from 5 reps to 8 (${jun1.value.toFixed(1)})`);
ok(near(jun1.value, normalizeWeight(135, 5, 8)), 'series value matches the formula directly');

// Every point round-trips to its own logged weight when the target matches.
for (const r of [3, 5, 6, 7, 8]) {
  const s = await normalizedSeries(bench.id, r);
  ok(s.filter((p) => p.actual).every((p) => p.value === p.weight),
     `measured points untouched at a ${r}-rep target`);
}

// A real measurement at the target beats a higher-scoring estimate on the same
// day, so the chart never replaces a fact with an inference.
await store.saveSession({
  workoutId: w.id, workoutName: 'Push', date: '2026-08-20',
  entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 145, reps: 9 }, { weight: 200, reps: 2 }] }],
});
const aug20 = (await normalizedSeries(bench.id, 9)).find((p) => p.date === '2026-08-20');
ok(aug20.actual === true && aug20.value === 145,
   'measured 145x9 preferred over the stronger 200x2 estimate at a 9-rep target');
const aug20b = (await normalizedSeries(bench.id, 4)).find((p) => p.date === '2026-08-20');
ok(aug20b.actual === false && aug20b.value > 145,
   'with no measurement at the target, the best set that day is estimated instead');

/* ---------- one source at a time (Tim, 2026-08-15) ---------- */
// The bug he hit: a workout logged on the SAME DAY as a benchmark meant the
// point shown for that day flipped between the two depending on the rep target,
// because a real measurement at the target outranks an estimate. Mixing the
// sources also made the line lurch, since a mid-workout set and a fresh
// benchmark are not the same measurement.
await store.saveSession({
  workoutId: w.id, workoutName: 'Push', date: '2026-08-12',
  entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 95, reps: 12 }] }],
});

// Reproduce the flip on mixed data.
const mixedAt12 = (await normalizedSeries(bench.id, 12)).find((p) => p.date === '2026-08-12');
const mixedAt3 = (await normalizedSeries(bench.id, 3)).find((p) => p.date === '2026-08-12');
ok(mixedAt12.source === 'workout' && mixedAt3.source === 'benchmark',
   'mixed sources: the point for a day flips with the rep target — the reported bug');

// Filtering to one source removes it entirely.
const benchOnly12 = (await normalizedSeries(bench.id, 12, 'benchmark')).find((p) => p.date === '2026-08-12');
const benchOnly3 = (await normalizedSeries(bench.id, 3, 'benchmark')).find((p) => p.date === '2026-08-12');
ok(benchOnly12.source === 'benchmark' && benchOnly3.source === 'benchmark',
   'benchmarks only: the source no longer changes with the rep target');

const allBench = await normalizedSeries(bench.id, 5, 'benchmark');
ok(allBench.every((p) => p.source === 'benchmark'), 'benchmark series contains no workout points');
ok(allBench.length === 2, `benchmark series covers only benchmark days (${allBench.length})`);

const allWork = await normalizedSeries(bench.id, 5, 'workout');
ok(allWork.every((p) => p.source === 'workout'), 'workout series contains no benchmark points');
ok(allWork.length === 4, `workout series covers only workout days (${allWork.length})`);
// The mixed series is one point per DAY, so on 2026-08-12 — which has both a
// benchmark and a workout — one of the two readings is silently discarded.
// 2 + 4 separate days collapse to 5. That lost reading is a second reason to
// chart one source at a time, beyond the jaggedness.
const mixedAll = await normalizedSeries(bench.id, 5);
ok(mixedAll.length === 5, `mixing collapses the shared day (${mixedAll.length} points)`);
ok(allBench.length + allWork.length === mixedAll.length + 1,
   'mixing silently drops exactly one reading — the shared day loses whichever source lost');

// The plain (non-normalised) path filters too.
ok((await seriesForExercise(bench.id, 'weight', 'benchmark')).every((p) => p.source === 'benchmark'),
   'seriesForExercise filters by source as well');

// Each source keeps its own habitual rep count.
ok(await defaultTargetReps(bench.id, 'benchmark') !== await defaultTargetReps(bench.id, 'workout'),
   'the two sources can default to different rep counts');

// Availability is reported per source so the picker never offers an empty one.
const chart2 = await chartableExercises(2);
const benchOpt = chart2.find((c) => c.id === bench.id);
ok(benchOpt.sources.benchmark.normalizable && benchOpt.sources.workout.normalizable,
   'both sources reported as chartable for the bench');
ok(benchOpt.usableSources.length === 2, 'bench offers a source choice');

const soloOpt = chart2.find((c) => c.id === squat.id);
ok(soloOpt.usableSources.length === 1 && soloOpt.usableSources[0] === 'benchmark',
   'squat has benchmarks only, so no pointless source toggle');
ok(soloOpt.sources.workout.normalizable === false, 'squat reports no workout data');

/* ---------- benchmark comparison (bar chart) ---------- */
const cmp = await benchmarkComparison(2);

ok(cmp.fields.includes('weight'), 'weight is a comparable field');
ok(!cmp.fields.includes('time'), 'time excluded — plank has only one benchmark');
ok(!cmp.fields.includes('reps'),
   'reps dropped as a standalone comparison once weight is rep-normalised');

const weightRows = cmp.byField.weight;
ok(weightRows.length === 2, `two exercises comparable by weight (${weightRows.length})`);

const benchRow = weightRows.find((r) => r.id === bench.id);
// Benchmarks are 135x5 (June) and 175x3 (August); the modal count over those
// two ties and resolves to the more recent, 3.
ok(benchRow.atReps === 3, 'row reports the rep count it was compared at');
ok(benchRow.nowActual === true && benchRow.now === 175, 'latest benchmark was measured at 3 reps');
ok(benchRow.startActual === false, 'first benchmark (5 reps) is an estimate at 3 reps');
ok(near(benchRow.start, 146.11), `start normalised 135x5 -> 146.1 at 3 reps (${benchRow.start.toFixed(2)})`);
ok(near(benchRow.delta, 28.89), `delta uses normalised weights (${benchRow.delta.toFixed(2)})`);
ok(Math.round(benchRow.pct) === 20, `pct computed (${benchRow.pct.toFixed(1)}%)`);
// Raw weight would have claimed +40 / +30%. Normalising shows the smaller,
// honest gain: some of that 40 lbs was just doing fewer reps.
ok(benchRow.delta < 40, 'normalising deflates the apparent gain from dropping reps');

// The bench also has sets logged in SESSIONS. If sessions leaked in, the count
// would exceed the two benchmark days.
ok(benchRow.count === 2, 'session data excluded from the comparison (2 benchmark days only)');

ok(weightRows[0].id === squat.id, 'rows sorted by biggest mover (squat before bench)');
ok(cmp.incomplete.weight === 0, 'no incomplete weight exercises');

// An exercise with a single benchmark must not appear.
const solo = byName('Deadlift');
await store.saveBenchmark({ date: '2026-08-01', exerciseId: solo.id, exerciseName: solo.name, values: { weight: 405, reps: 1 } });
const cmp2 = await benchmarkComparison(2);
ok(!cmp2.byField.weight.find((r) => r.id === solo.id), 'single-benchmark exercise excluded');
ok(cmp2.incomplete.weight === 1, 'incomplete count reports the excluded exercise');

// Same-day duplicates collapse to one point. Adding 165x4 alongside 175x3 on
// 2026-08-12 makes 4 the most recent of the tied rep counts, so the target
// moves to 4 — and the day then resolves to the set actually done at 4 reps
// rather than an estimate off the 3-rep set.
await store.saveBenchmark({ date: '2026-08-12', exerciseId: bench.id, exerciseName: bench.name, values: { weight: 165, reps: 4 } });
const cmp3 = await benchmarkComparison(2);
const benchRow3 = cmp3.byField.weight.find((r) => r.id === bench.id);
ok(benchRow3.count === 2, 'same-day benchmarks collapse to one point');
ok(benchRow3.atReps === 4, 'target moves to the newly most-recent tied rep count');
ok(benchRow3.now === 165 && benchRow3.nowActual === true,
   'the measured 4-rep set wins the day over an estimate from the 3-rep set');

/* ---------- calendar ---------- */
const activity = await activityByDate();
ok(activity.get('2026-08-01').sessions.length === 1, 'session indexed on its date');
ok(activity.get('2026-08-12').benchmarks.length === 2, 'benchmarks indexed on their date');

// month-range math used by the scrolling calendar
const monthIdx = (y, m) => y * 12 + m;
const endIdx = monthIdx(2026, 7); // August 2026
const startIdx = Math.min(endIdx - 11, monthIdx(2026, 5)); // earliest activity June 2026
ok(endIdx - startIdx + 1 === 12, 'month range spans at least 12 months');
ok(Math.floor(startIdx / 12) === 2025 && startIdx % 12 === 8, 'range starts September 2025');

/* ---------- export / import ---------- */
const dump = await store.exportAll();
await store.clearAll();
ok((await store.getSessions()).length === 0, 'clearAll wipes sessions');
await store.importAll(dump);
ok((await store.getSessions()).length === 4, 'import restores sessions');
ok((await store.getWorkout(w.id)).exercises[0].sets === 4, 'import preserves planned set counts');

/* ---------- custom exercises ---------- */
const custom = makeCustomExercise({ name: 'Sled Sprint', muscle: 'Cardio', equipment: 'Other', fields: ['time'] });
ok(custom.loadType === null, 'custom time-only exercise gets no load type');
ok(makeCustomExercise({ name: 'Odd Lift', muscle: 'Back', equipment: 'Other', fields: ['weight', 'reps'], loadType: 'per_side' }).loadType === 'per_side',
   'custom weighted exercise keeps chosen load type');

ok(/^\d{4}-\d{2}-\d{2}$/.test(todayISO()), `todayISO format (${todayISO()})`);

/* ---------- accounts / cloud backend ---------- */
// Only the pure helpers are testable headlessly — anything touching the
// Firebase SDK needs a real project. Importing the module must NOT pull the SDK
// down; the network imports live inside init().
const fb = await import('../js/firebase-backend.js');

// Project fitness-tracker-th is configured, so the app WANTS the cloud. Node
// cannot load the Firebase SDK (it is imported over https from gstatic), which
// makes this suite an unintentionally perfect test of the D13 fallback: the
// cloud is wanted, unreachable, and must degrade instead of breaking.
ok(auth.configured() === true, 'cloud is configured');
const st = await auth.state();
ok(st.mode === 'local', 'unreachable cloud falls back to local storage rather than throwing');
ok(st.degraded === true, 'the fallback is reported as degraded, not passed off as normal');
ok(st.error !== null, 'the reason is kept so Settings can show it');
ok(st.user === null, 'no user while disconnected');

// The whole point of the fallback: logging still works with no cloud.
const offlineWorkout = await store.saveWorkout({ name: 'Offline test', exercises: [] });
ok((await store.getWorkout(offlineWorkout.id)).name === 'Offline test',
   'a workout still saves while the cloud is unreachable');

// Calling an account action without a cloud must fail loudly, not silently no-op.
let threw = false;
try { await auth.signOut(); } catch { threw = true; }
ok(threw, 'account actions refuse to run with no cloud configured');
ok(typeof auth.onChange(() => {}) === 'function', 'onChange returns an unsubscribe even when local');

// describeUser must never hand a raw Firebase user to a view.
ok(fb.describeUser(null) === null, 'no user describes as null');
const anon = fb.describeUser({ uid: 'a1', isAnonymous: true, providerData: [] });
ok(anon.isAnonymous && anon.secured === false, 'anonymous account is reported as NOT secured');
const real = fb.describeUser({ uid: 'a2', isAnonymous: false, email: 'x@y.z', providerData: [{ providerId: 'password' }] });
ok(real.secured === true && real.email === 'x@y.z', 'email account is reported as secured');
ok(real.providers.includes('password'), 'providers surfaced for the UI');
ok(fb.describeUser({ uid: 'a3', isAnonymous: false }).uid === 'a3', 'a user with no providerData still describes');

// Error codes must never reach the user raw.
ok(fb.authErrorMessage({ code: 'auth/wrong-password' }) === 'Wrong email or password.', 'known code maps to plain English');
ok(fb.authErrorMessage({ code: 'auth/email-already-in-use' }).includes('signing in'), 'duplicate email suggests signing in');
ok(!fb.authErrorMessage({ code: 'auth/some-new-code' }).includes('auth/'), 'unmapped codes never leak into the UI');
ok(fb.authErrorMessage(null) === 'Something went wrong.', 'a missing error still yields a message');
ok(fb.authErrorMessage({ code: 'unavailable' }).includes('saved on this device'),
   'offline is framed as safe, because it is');

ok(fb.isPopupFailure({ code: 'auth/popup-blocked' }), 'popup-blocked triggers the redirect fallback');
ok(!fb.isPopupFailure({ code: 'auth/wrong-password' }), 'unrelated errors do not trigger redirect');
ok(fb.isAlreadyLinked({ code: 'auth/credential-already-in-use' }), 'already-linked detected');
ok(fb.prefersRedirect() === false, 'no window (headless) means no redirect preference');

/* ---------- merging a device into an account ---------- */
// Uploading local data must never destroy something the cloud already had.
const remoteRows = [{ id: 'a', name: 'Cloud A', updatedAt: '2026-08-10T00:00:00Z' }];
const localRows = [
  { id: 'a', name: 'Local A newer', updatedAt: '2026-08-14T00:00:00Z' },
  { id: 'b', name: 'Local only' },
];
const merged = fb.mergeRows(remoteRows, localRows);
ok(merged.length === 2, 'merge keeps both sides, keyed by id');
ok(merged.find((r) => r.id === 'a').name === 'Local A newer', 'newer timestamp wins');
ok(merged.find((r) => r.id === 'b'), 'local-only rows are added');

const olderLocal = fb.mergeRows(
  [{ id: 'a', name: 'Cloud', updatedAt: '2026-08-20T00:00:00Z' }],
  [{ id: 'a', name: 'Local', updatedAt: '2026-08-01T00:00:00Z' }],
);
ok(olderLocal[0].name === 'Cloud', 'older local data never overwrites newer cloud data');
ok(fb.mergeRows([{ id: 'a', name: 'Cloud' }], [{ id: 'a', name: 'Local' }])[0].name === 'Cloud',
   'with no timestamps the cloud wins — other devices already agree on it');
ok(fb.mergeRows(null, null).length === 0, 'merging nothing yields nothing');
ok(fb.mergeRows([], [{ name: 'no id' }]).length === 0, 'rows without an id are skipped');
ok(fb.mergeRows([{ id: 'a' }], []).length === 1, 'an empty upload leaves the cloud intact');

// Idempotence: uploading the same device twice must not duplicate anything.
const once = fb.mergeRows(remoteRows, localRows);
ok(fb.mergeRows(once, localRows).length === once.length, 'uploading twice is a no-op');

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
