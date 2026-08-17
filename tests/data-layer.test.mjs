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
  normalizedSeries, defaultTargetReps, weightRepObservations, ageFromBirthYear,
  bodyWeightSeries,
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

/* ---------- strength standards ---------- */
const ss = await import('../js/strength-standards.js');
const bm = await import('../js/body-map.js');

ok(ss.LEVELS.length === 7, 'seven levels');
ok(ss.LEVELS.map((l) => l.percentile).join() === '5,20,50,65,80,90,95', 'level percentiles as decided');
ok(ss.LEVELS.every((l, i) => i === 0 || l.percentile > ss.LEVELS[i - 1].percentile),
   'levels strictly increase');

// Every key lift must resolve to a real exercise, or that muscle silently never
// ranks — the failure would be invisible in the UI.
for (const muscle of Object.keys(ss.MUSCLE_LIFTS)) {
  const lift = ss.keyLiftFor(muscle);
  ok(lift && lift.id, `${muscle} key lift "${ss.MUSCLE_LIFTS[muscle].lift}" resolves to a real exercise`);
}
ok(ss.muscleForLift(byName('Barbell Bench Press').id) === 'Chest', 'reverse lookup works');
ok(!ss.canRank('Core') && !ss.canRank('Neck'), 'Core and Neck are deliberately unrankable');

// Every muscle drawn on the body must either be rankable or explicitly
// unrankable — otherwise a region would be permanently grey for no stated reason.
for (const m of bm.MAPPED_MUSCLES) {
  ok(ss.canRank(m) || ss.UNRANKABLE.includes(m), `drawn muscle "${m}" is rankable or declared unrankable`);
}
// And the converse. The figure is generated from an illustration by
// tools/build-body-art.py; if a regeneration lost a group, the app would rank
// that muscle and then have nowhere to show it — silently, and only on a screen
// nobody thinks to re-check. Cardio is the one lift-less group and is not drawn.
for (const m of Object.keys(ss.MUSCLE_LIFTS)) {
  ok(bm.MAPPED_MUSCLES.includes(m), `rankable muscle "${m}" is drawn on the body`);
}
// Every drawn muscle carries real geometry in at least one view.
const art = await import('../js/body-art.js');
for (const m of bm.MAPPED_MUSCLES) {
  const drawn = Object.values(art.ART)
    .map((v) => v.muscles[m] || '')
    .filter((d) => d.length > 200);
  ok(drawn.length >= 1, `"${m}" has a traced path (${drawn.length} view(s))`);
}

const male180 = { gender: 'male', bodyWeight: 180, age: 30 };
ok(near(ss.medianFor('Chest', male180), 225, 1), `median bench at 180 lb = 225 (${ss.medianFor('Chest', male180).toFixed(1)})`);

// Allometric scaling, not a flat ratio. A flat ratio would say 187 at 150 lb;
// the surface law says ~199, which is what published standards actually show.
const male150 = { gender: 'male', bodyWeight: 150, age: 30 };
ok(near(ss.medianFor('Chest', male150), 199, 1.5), `median scales allometrically (${ss.medianFor('Chest', male150).toFixed(1)} at 150 lb)`);
ok(ss.medianFor('Chest', male150) > 225 * (150 / 180), 'allometric beats a flat bodyweight ratio');
ok(ss.medianFor('Chest', { gender: 'female', bodyWeight: 140, age: 30 }) === 100,
   'female standards are their own numbers, not a blanket multiplier');
ok(ss.medianFor('Chest', { gender: 'male' }) === null, 'no body weight means no standard');
ok(ss.medianFor('Core', male180) === null, 'unrankable muscle has no standard');

// Percentiles round-trip against the thresholds.
for (const l of ss.LEVELS) {
  const w = ss.weightForPercentile(l.percentile, 'Chest', male180);
  const p = ss.percentileFor(w, 'Chest', male180);
  ok(near(p, l.percentile, 0.2), `${l.name}: ${Math.round(w)} lb round-trips to the ${l.percentile}th`);
}
ok(near(ss.percentileFor(225, 'Chest', male180), 50, 0.2), 'the median lift is the 50th percentile');

// Boundary: the normal CDF is an approximation, so an exactly-median lift comes
// back as 49.999999947. A strict >= showed that person Novice while the screen
// beside it read "50th percentile" — and hitting the exact weight the targets
// panel asked for failed to grant the level.
ok(ss.percentileFor(225, 'Chest', male180) < 50, 'the CDF really does undershoot at the boundary');
ok(ss.levelFor(ss.percentileFor(225, 'Chest', male180)).key === 'intermediate',
   'an exactly-median lift still lands in Intermediate, not the level below');
for (const l of ss.LEVELS) {
  const exact = ss.weightForPercentile(l.percentile, 'Chest', male180);
  ok(ss.levelFor(ss.percentileFor(exact, 'Chest', male180)).key === l.key,
     `lifting exactly the ${l.name} target grants ${l.name}`);
}
ok(ss.percentileFor(400, 'Chest', male180) > ss.percentileFor(300, 'Chest', male180),
   'more weight is a higher percentile');

// The published tier weights, which are the whole feature.
const tiers = ss.LEVELS.map((l) => Math.round(ss.weightForPercentile(l.percentile, 'Chest', male180)));
ok(tiers.join() === '133,172,225,255,295,339,381', `bench tiers at 180 lb: ${tiers.join(' / ')}`);
ok(tiers.every((v, i) => i === 0 || v > tiers[i - 1]), 'tier weights strictly increase');

ok(ss.levelFor(50).key === 'intermediate', 'the 50th is Intermediate');
ok(ss.levelFor(96).key === 'elite', 'above the top threshold stays Elite');
ok(ss.levelFor(3) === null, 'below the first threshold has no level');
ok(ss.nextLevelAfter(ss.levelFor(96)) === null, 'nothing comes after Elite');
ok(ss.nextLevelAfter(null).key === 'beginner', 'the first goal is Beginner');
ok(near(ss.levelProgress(65, ss.levelFor(50)), 1, 0.001), 'progress fills at the next threshold');
ok(near(ss.levelProgress(50, ss.levelFor(50)), 0, 0.001), 'progress is empty at the current threshold');

// Age grading. Without it a 55-year-old is measured against 25-35 year olds.
ok(ss.ageCoefficient(30) === 1 && ss.ageCoefficient(40) === 1, 'no adjustment in the 23-40 prime');
ok(near(ss.ageCoefficient(50), 1.13, 0.001), 'McCulloch coefficient at 50');
ok(near(ss.ageCoefficient(60), 1.381, 0.001), 'McCulloch coefficient at 60');
ok(ss.ageCoefficient(55) > ss.ageCoefficient(50), 'the coefficient rises with age');
ok(ss.ageCoefficient(18) > 1, 'juniors are graded up too (Foster)');
ok(ss.ageCoefficient(null) === 1, 'no age means no adjustment');
ok(ss.medianFor('Chest', { gender: 'male', bodyWeight: 180, age: 60 })
   < ss.medianFor('Chest', male180), 'a 60-year-old is held to a lower bar than a 30-year-old');
ok(ss.percentileFor(225, 'Chest', { gender: 'male', bodyWeight: 180, age: 60 }) > 50,
   'the same lift ranks higher for an older lifter');

// General-population readout.
ok(near(ss.generalPopulationPercentile(50), 84, 0.5), 'the median lifter is ~84th of all adults');
ok(near(ss.generalPopulationPercentile(5), 69.7, 0.5), 'even a beginner lifter is ~70th of all adults');
ok(ss.generalPopulationPercentile(95) < 100, 'the general readout never reaches 100');
ok(ss.generalPopulationPercentile(95) - ss.generalPopulationPercentile(5) < 30,
   'the whole scale compresses into a narrow band of the general population — why levels stay lifter-based');

/* ---------- profile + body weight ---------- */
// Needed before the Muscle Groups map can rank anything: standards are ratios
// to body weight and differ by sex.
const blank = await store.getProfile();
ok(blank.gender === null && blank.bodyWeight === null, 'a fresh profile is empty');
ok(blank.missing.includes('gender') && blank.missing.includes('body weight'),
   'the profile reports exactly what the map is still waiting on');

await store.saveProfile({ gender: 'male', birthYear: 1994 });
await store.logBodyWeight(181.5, '2026-08-10');
const filled = await store.getProfile();
ok(filled.gender === 'male', 'gender saved');
ok(filled.birthYear === 1994, 'birth year saved');
ok(filled.age === new Date().getFullYear() - 1994, `age derived from birth year (${filled.age})`);
ok(filled.bodyWeight === 181.5, 'latest body weight surfaced on the profile');
ok(filled.missing.length === 0, 'nothing missing once gender and weight exist');

// Age is DERIVED, never stored — a stored age silently goes stale and quietly
// moves someone into the wrong comparison band.
ok(ageFromBirthYear(1994) === new Date().getFullYear() - 1994, 'ageFromBirthYear works');
ok(ageFromBirthYear(null) === null && ageFromBirthYear('abc') === null, 'junk birth year yields no age');
ok(ageFromBirthYear(1500) === null, 'implausible birth year rejected');
ok((await store.getSettings()).age === undefined, 'age is never persisted, only birth year');

// Body weight is a dated series, so the Tier 1 trend comes free.
await store.logBodyWeight(179, '2026-08-14');
await store.logBodyWeight(178, '2026-08-15');
const weights = await store.getBodyWeights();
ok(weights.length === 3, `body weight keeps every weigh-in (${weights.length})`);
ok(weights[0].date === '2026-08-10' && weights[2].date === '2026-08-15', 'weigh-ins sorted by date');
ok((await store.latestBodyWeight()).weight === 178, 'latest weigh-in wins for the profile');

// A second weigh-in on the same day replaces the first rather than making the
// trend jagged with intra-day noise.
await store.logBodyWeight(177.5, '2026-08-15');
const afterSameDay = await store.getBodyWeights();
ok(afterSameDay.length === 3, 'same-day weigh-in replaces rather than appends');
ok((await store.latestBodyWeight()).weight === 177.5, 'the replacement is what counts');

let badWeight = false;
try { await store.logBodyWeight(0); } catch { badWeight = true; }
ok(badWeight, 'a non-positive weight is refused');

await store.saveProfile({ birthYear: 3000 });
ok((await store.getProfile()).birthYear === null, 'a future birth year is rejected');
await store.saveProfile({ birthYear: 1994 });

const toDelete = (await store.getBodyWeights())[0];
await store.deleteBodyWeight(toDelete.id);
ok((await store.getBodyWeights()).length === 2, 'a weigh-in can be deleted');

// The chart takes {date, value} like every other series, so the view never
// touches the storage shape.
const bwSeries = await bodyWeightSeries();
ok(bwSeries.length === 2, `body weight charts as a series (${bwSeries.length} points)`);
ok(bwSeries.every((p) => typeof p.value === 'number' && typeof p.date === 'string'),
   'every point is {date, value} — the shape the line chart takes');
ok(bwSeries[0].date < bwSeries[1].date, 'the series is in date order');
ok(bwSeries[bwSeries.length - 1].value === 177.5, 'the last point is the latest weigh-in');
ok(bwSeries.every((p) => p.actual !== false),
   'no body-weight point is an estimate — a scale reading is always a measurement');

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

/* ---------- what to do when a Google sign-in fails ---------- */
// Reported by Tim: "sometimes when I sign in using google, it says Your browser
// blocked the sign-in window". The popup was not the problem. Linking an
// anonymous account to a Google account that ALREADY EXISTS throws
// credential-already-in-use, and the recovery opened a SECOND popup — by which
// point the gesture that authorised the first one is spent, so the browser
// blocks it. Being thrown from inside the catch, nothing handled it.
{
  const plan = (code, anon) => fb.planAfterGoogleFailure({ code }, { anon });

  ok(plan('auth/credential-already-in-use', true) === 'credential',
     'an already-registered Google account signs in with the credential from the failed link');
  ok(plan('auth/email-already-in-use', true) === 'credential',
     'and so does an already-registered email');
  ok(plan('auth/account-exists-with-different-credential', true) === 'credential',
     'and an account held with a different provider');

  ok(plan('auth/popup-blocked', false) === 'redirect', 'a blocked popup goes full-page instead');
  ok(plan('auth/cancelled-popup-request', false) === 'redirect', 'so does a superseded popup');
  ok(plan('auth/operation-not-supported-in-this-environment', false) === 'redirect',
     'and an environment that cannot pop up at all');

  // Closing the window is a decision, not a failure. It used to be treated as
  // a popup failure, which bounced the user to Google's full-page redirect
  // immediately after they had deliberately backed out.
  ok(plan('auth/popup-closed-by-user', false) === 'cancelled',
     'closing the window does nothing, rather than redirecting');
  ok(plan('auth/popup-closed-by-user', true) === 'cancelled', 'the same while anonymous');
  ok(!fb.isPopupFailure({ code: 'auth/popup-closed-by-user' }),
     'a user-closed window is no longer counted as the browser refusing one');
  ok(fb.isUserCancelled({ code: 'auth/popup-closed-by-user' }), 'and is named for what it is');

  ok(plan('auth/wrong-password', false) === 'rethrow', 'anything else is reported to the user');
  ok(plan('auth/network-request-failed', true) === 'rethrow', 'including a dropped connection');

  // Not anonymous means there is nothing to link, so there is no credential
  // recovery to attempt — the error is real and belongs on screen.
  ok(plan('auth/credential-already-in-use', false) === 'rethrow',
     'already-in-use while signed in is a genuine error, not a link failure');

  ok(fb.planAfterGoogleFailure(null, { anon: true }) === 'rethrow', 'no error still yields a plan');
}

/* ---------- and the flow that acts on it ---------- */
// The decision above is only half of it; the bug was in which SDK call got
// made. This drives the real flow against a recording stub, so "never open a
// second popup" is asserted rather than assumed.
{
  const fakeAuth = (opts = {}) => {
    const calls = [];
    const record = (name) => (...args) => {
      calls.push(name);
      if (opts.throwOn === name) throw Object.assign(new Error(name), { code: opts.code });
      if (name === 'signInWithRedirect' || name === 'linkWithRedirect') return undefined;
      return { user: { uid: 'u1', email: 'tim@example.com', isAnonymous: false } };
    };
    return {
      calls,
      linkWithPopup: record('linkWithPopup'),
      signInWithPopup: record('signInWithPopup'),
      linkWithRedirect: record('linkWithRedirect'),
      signInWithRedirect: record('signInWithRedirect'),
      signInWithCredential: record('signInWithCredential'),
      GoogleAuthProvider: {
        credentialFromError: () => (opts.noCredential ? null : { providerId: 'google.com' }),
      },
    };
  };
  const run = (auth, extra = {}) => fb.googleSignInFlow({
    auth, authClient: {}, provider: {}, currentUser: { uid: 'anon' },
    anon: true, preferRedirect: false, ...extra,
  });

  // The plain success path — which the first version of these tests never
  // covered, every case having been an error case.
  let a = fakeAuth();
  let out = await run(a, { anon: false });
  ok(a.calls.join() === 'signInWithPopup' && out.user,
     `a normal sign-in opens one popup and returns the user (${a.calls.join(' → ')})`);
  a = fakeAuth();
  out = await run(a, { anon: true });
  ok(a.calls.join() === 'linkWithPopup' && out.user,
     `an anonymous upgrade links, and does not sign in separately (${a.calls.join(' → ')})`);

  // THE BUG: anonymous user, Google account already registered.
  a = fakeAuth({ throwOn: 'linkWithPopup', code: 'auth/credential-already-in-use' });
  out = await run(a);
  ok(a.calls.filter((c) => /Popup/.test(c)).length === 1,
     `only ONE popup is ever opened (${a.calls.join(' → ')})`);
  ok(!a.calls.includes('signInWithPopup'),
     'the recovery never opens a second popup — that is what the browser blocked');
  ok(a.calls.includes('signInWithCredential'),
     'it signs in with the credential from the failed link instead');
  ok(out.user && out.user.email === 'tim@example.com', 'and comes back signed in');

  // Same, but Firebase gave us no credential to reuse.
  a = fakeAuth({ throwOn: 'linkWithPopup', code: 'auth/credential-already-in-use', noCredential: true });
  out = await run(a);
  ok(!a.calls.includes('signInWithPopup'), 'with no credential it still does not reopen a popup');
  ok(a.calls.includes('linkWithRedirect') || a.calls.includes('signInWithRedirect'),
     'it redirects, which a popup blocker cannot stop');
  ok(out.redirected === true, 'and reports that the page is navigating away');

  // A genuinely blocked popup.
  a = fakeAuth({ throwOn: 'signInWithPopup', code: 'auth/popup-blocked' });
  out = await run(a, { anon: false });
  ok(a.calls.includes('signInWithRedirect') && out.redirected,
     'a blocked popup falls back to a redirect');

  // A user who closed the window is left alone.
  a = fakeAuth({ throwOn: 'signInWithPopup', code: 'auth/popup-closed-by-user' });
  out = await run(a, { anon: false });
  ok(out.cancelled === true, 'closing the window reports cancelled');
  ok(!a.calls.some((c) => /Redirect/.test(c)),
     'and does NOT bounce them to a full-page Google redirect');

  // An installed PWA never tries a popup at all.
  a = fakeAuth();
  out = await run(a, { preferRedirect: true });
  ok(!a.calls.some((c) => /Popup/.test(c)) && out.redirected,
     'in a standalone PWA it goes straight to redirect');

  // Real errors still surface.
  a = fakeAuth({ throwOn: 'signInWithPopup', code: 'auth/network-request-failed' });
  let threw = null;
  try { await run(a, { anon: false }); } catch (e) { threw = e; }
  ok(threw && threw.code === 'auth/network-request-failed', 'unrelated failures are still thrown');
}

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

/* ================= benchmark workouts ================= */
// A workout can be marked a benchmark; every exercise it records then becomes a
// benchmark for that day. The rows are DERIVED from the session, so the risk is
// not creating them — it is leaving stale ones behind when the session changes.
{
  const { store: st, pickBenchmarkSet } = await import('../js/store.js');
  await st.clearAll();

  const benchId = byName('Barbell Bench Press').id;
  const rowId = byName('Barbell Row').id;

  // --- which set counts ---
  ok(pickBenchmarkSet([{ weight: 135, reps: 8 }, { weight: 225, reps: 2 }], ['weight', 'reps'])
       .weight === 225, 'the heaviest e1RM set is the benchmark, not the last one');
  ok(pickBenchmarkSet([{ weight: 225, reps: 2 }, { weight: 185, reps: 8 }], ['weight', 'reps'])
       .weight === 185, 'and e1RM, not raw weight — 185x8 beats 225x2');
  ok(pickBenchmarkSet([{ reps: 12 }, { reps: 20 }], ['reps']).reps === 20,
     'bodyweight work goes on reps');
  ok(pickBenchmarkSet([{ time: 45 }, { time: 90 }], ['time']).time === 90,
     'a hold goes on the longest time');
  // A fixed-distance run: furthest wins, and among equals the FASTEST.
  const run = pickBenchmarkSet(
    [{ distance: 1, time: 500 }, { distance: 1, time: 430 }, { distance: 0.5, time: 200 }],
    ['distance', 'time']);
  ok(run.distance === 1 && run.time === 430, `a mile benchmark is the fastest one (${run.time}s)`);
  ok(pickBenchmarkSet([{ weight: 0, reps: 0 }], ['weight', 'reps']) === null,
     'an empty set is not a benchmark');
  ok(pickBenchmarkSet([], ['weight', 'reps']) === null, 'and neither is no set at all');

  // --- a normal workout makes none ---
  const plain = await st.saveSession({
    workoutId: 'w1', workoutName: 'Push', date: '2026-08-10',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 185, reps: 5 }] }],
  });
  ok((await st.getBenchmarks()).length === 0, 'a normal workout records no benchmarks');

  // --- a benchmark workout makes one per exercise ---
  const test = await st.saveSession({
    workoutId: 'w2', workoutName: 'Test day', date: '2026-08-12', isBenchmark: true,
    entries: [
      { exerciseId: benchId, exerciseName: 'Barbell Bench Press',
        sets: [{ weight: 185, reps: 5 }, { weight: 225, reps: 2 }] },
      { exerciseId: rowId, exerciseName: 'Barbell Row',
        sets: [{ weight: 155, reps: 8 }] },
    ],
  });
  let marks = await st.getBenchmarks();
  ok(marks.length === 2, `every exercise becomes a benchmark (${marks.length})`);
  ok(marks.every((m) => m.date === '2026-08-12'), 'filed on the day of the workout');
  ok(marks.every((m) => m.sourceSessionId === test.id), 'and tagged with the session that made them');
  ok(marks.find((m) => m.exerciseId === benchId).values.weight === 225,
     'each takes that exercise\'s best set');

  // --- editing must not duplicate ---
  await st.saveSession({ ...test, entries: [
    { exerciseId: benchId, exerciseName: 'Barbell Bench Press',
      sets: [{ weight: 185, reps: 5 }, { weight: 235, reps: 2 }] },
    { exerciseId: rowId, exerciseName: 'Barbell Row', sets: [{ weight: 155, reps: 8 }] },
  ] });
  marks = await st.getBenchmarks();
  ok(marks.length === 2, `re-saving updates rather than piling up (${marks.length})`);
  ok(marks.find((m) => m.exerciseId === benchId).values.weight === 235,
     'and the benchmark follows the corrected set');

  // --- moving the date moves the benchmarks with it ---
  await st.saveSession({ ...test, date: '2026-07-04', entries: [
    { exerciseId: benchId, exerciseName: 'Barbell Bench Press', sets: [{ weight: 235, reps: 2 }] },
    { exerciseId: rowId, exerciseName: 'Barbell Row', sets: [{ weight: 155, reps: 8 }] },
  ] });
  marks = await st.getBenchmarks();
  ok(marks.length === 2 && marks.every((m) => m.date === '2026-07-04'),
     'moving the record moves its benchmarks — none stranded on the old day');

  // --- dropping an exercise drops its benchmark ---
  await st.saveSession({ ...test, date: '2026-07-04', entries: [
    { exerciseId: benchId, exerciseName: 'Barbell Bench Press', sets: [{ weight: 235, reps: 2 }] },
  ] });
  marks = await st.getBenchmarks();
  ok(marks.length === 1 && marks[0].exerciseId === benchId,
     `removing an exercise removes its benchmark (${marks.length} left)`);

  // --- clearing the flag clears them ---
  await st.saveSession({ ...test, date: '2026-07-04', isBenchmark: false, entries: [
    { exerciseId: benchId, exerciseName: 'Barbell Bench Press', sets: [{ weight: 235, reps: 2 }] },
  ] });
  ok((await st.getBenchmarks()).length === 0, 'turning the flag off removes the derived benchmarks');

  // --- a hand-entered benchmark is never touched by any of this ---
  await st.saveBenchmark({ date: '2026-08-01', exerciseId: benchId,
    exerciseName: 'Barbell Bench Press', values: { weight: 250, reps: 1 } });
  await st.saveSession({ ...test, date: '2026-07-04', isBenchmark: true, entries: [
    { exerciseId: benchId, exerciseName: 'Barbell Bench Press', sets: [{ weight: 235, reps: 2 }] },
  ] });
  marks = await st.getBenchmarks();
  ok(marks.length === 2, 'a hand-entered benchmark survives a derived rebuild');
  ok(marks.filter((m) => !m.sourceSessionId).length === 1,
     'and stays distinguishable from a derived one');

  // --- deleting the record takes its benchmarks with it ---
  await st.deleteSession(test.id);
  marks = await st.getBenchmarks();
  ok(marks.length === 1 && !marks[0].sourceSessionId,
     'deleting the record deletes its benchmarks, and only those');

  await st.deleteSession(plain.id);
  await st.clearAll();
}

/* ================= pounds and kilograms ================= */
// Everything is STORED in pounds. Switching units is a display choice and must
// never rewrite a recorded number — this is the check that protects that.
{
  const u = await import('../js/units.js');

  u.setUnits('lbs');
  ok(u.units() === 'lbs', 'defaults to pounds');
  ok(u.toDisplay(135) === 135 && u.fromDisplay(135) === 135, 'pounds pass straight through');
  ok(u.weightStep() === 5, '5 lb steps');
  ok(u.withUnit(225) === '225 lbs', `pounds render plainly (${u.withUnit(225)})`);

  u.setUnits('kg');
  ok(u.units() === 'kg', 'switches to kilograms');
  ok(near(u.toDisplay(220.46), 100, 0.01), `220.46 lb reads as 100 kg (${u.toDisplay(220.46).toFixed(3)})`);
  ok(near(u.fromDisplay(100), 220.46, 0.01), '100 kg stores as 220.46 lb');
  ok(u.weightStep() === 2.5, '2.5 kg steps — the smallest pair of plates most gyms own');
  ok(u.withUnit(220.46) === '100 kg', `kilograms render to one decimal (${u.withUnit(220.46)})`);

  // The round trip is the whole promise: flip to kg and back, get the same lb.
  let worst = 0;
  for (const lb of [45, 95, 135, 185, 225, 315, 405, 500, 137.5, 182.3]) {
    u.setUnits('kg');
    const roundTripped = u.fromDisplay(u.toDisplay(lb));
    worst = Math.max(worst, Math.abs(roundTripped - lb));
  }
  ok(worst < 1e-9, `lb -> kg -> lb is lossless (worst drift ${worst})`);

  // A round number typed in kg must read back as that round number, not as
  // 59.99999 — it is stored as pounds underneath.
  u.setUnits('kg');
  ok(u.withUnit(u.fromDisplay(60)) === '60 kg', `60 kg round-trips through storage (${u.withUnit(u.fromDisplay(60))})`);
  ok(u.withUnit(u.fromDisplay(102.5)) === '102.5 kg', 'and so does a half-plate figure');

  ok(u.toDisplay('nonsense') === 0 && u.fromDisplay(undefined) === 0,
     'junk converts to zero rather than NaN');

  u.setUnits('lbs');   // leave the module as the rest of the suite expects
}

/* ========= the muscle map reads workouts, not just benchmarks ========= */
// Ranking on benchmarks alone left the best screen in the app permanently grey
// for anyone who only logs their workouts.
{
  const { store: st, muscleStrength } = await import('../js/store.js');
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-08-01');

  const benchId = BUILT_IN_EXERCISES.find((e) => e.name === 'Barbell Bench Press').id;
  const squatId = BUILT_IN_EXERCISES.find((e) => e.name === 'Back Squat').id;

  // A workout only — no benchmarks anywhere.
  await st.saveSession({
    workoutId: 'w1', workoutName: 'Push', date: '2026-08-10',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 185, reps: 5 }, { weight: 205, reps: 3 }] }],
  });
  let r = await muscleStrength();
  ok(r.ready, 'ranking is ready once the profile is complete');
  const chest = r.muscles.get('Chest');
  ok(Boolean(chest), 'a muscle ranks from workout sets alone, with no benchmark');
  ok(chest && chest.best.source === 'workout', `the source is recorded (${chest && chest.best.source})`);
  ok(chest && chest.best.weight === 205 && chest.best.reps === 3,
     'the best set wins, not the last or the heaviest-by-reps');

  // Add a stronger benchmark: it should take over, and say so.
  await st.saveBenchmark({ date: '2026-08-12', exerciseId: benchId,
    exerciseName: 'Barbell Bench Press', values: { weight: 245, reps: 1 } });
  r = await muscleStrength();
  const chest2 = r.muscles.get('Chest');
  ok(chest2.best.source === 'benchmark' && chest2.best.weight === 245,
     'a stronger benchmark takes over from the workout set');
  ok(chest2.e1rm !== chest.e1rm || chest2.best.e1rm > chest.best.e1rm,
     'and the estimate goes up with it');

  // A workout set that genuinely beats a stale benchmark must win — that is
  // real evidence the lifter has moved on since they last tested.
  await st.saveSession({
    workoutId: 'w2', workoutName: 'Push', date: '2026-08-14',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 275, reps: 2 }] }],
  });
  r = await muscleStrength();
  ok(r.muscles.get('Chest').best.source === 'workout'
     && r.muscles.get('Chest').best.weight === 275,
     'a workout set that beats a stale benchmark wins, and is labelled as such');

  // Untouched muscles stay unranked rather than guessing.
  ok(!r.muscles.has('Quads'), 'a muscle with nothing logged is not ranked');
  await st.saveSession({
    workoutId: 'w3', workoutName: 'Legs', date: '2026-08-15',
    entries: [{ exerciseId: squatId, exerciseName: 'Back Squat',
                sets: [{ weight: 315, reps: 5 }] }],
  });
  r = await muscleStrength();
  ok(r.muscles.has('Quads'), 'and starts ranking as soon as its key lift is logged');

  // D5: a maximum is not inferred from a very high-rep set. Found live — a
  // 135x25 burnout set extrapolated to 258 lb, beat a genuine 205x5 top set,
  // and promoted Chest a whole level. The least informative set of the week
  // was deciding the ranking.
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-08-01');
  await st.saveSession({
    workoutId: 'w9', workoutName: 'Push', date: '2026-08-10',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 205, reps: 5 }] }],
  });
  const beforeBurnout = (await muscleStrength()).muscles.get('Chest');
  await st.saveSession({
    workoutId: 'w9', workoutName: 'Push', date: '2026-08-11',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 135, reps: 25 }] }],
  });
  const afterBurnout = (await muscleStrength()).muscles.get('Chest');
  ok(afterBurnout.best.reps === 5 && afterBurnout.best.weight === 205,
     `a 25-rep burnout set is not evidence of a max (${afterBurnout.best.weight}x${afterBurnout.best.reps})`);
  ok(afterBurnout.level.name === beforeBurnout.level.name,
     `and does not move the level (${beforeBurnout.level.name} → ${afterBurnout.level.name})`);
  ok(e1rm(135, 25) > e1rm(205, 5),
     'even though the raw formula does rate it higher — which is why the gate exists');

  // 15 reps is the documented boundary and is still admitted.
  await st.saveSession({
    workoutId: 'w9', workoutName: 'Push', date: '2026-08-12',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 185, reps: 15 }] }],
  });
  ok((await muscleStrength()).muscles.get('Chest').best.reps === 15,
     '15 reps is still admissible — the cut is above it, not at it');

  // A benchmark gets no exemption: a 25-rep test is no more informative.
  await st.saveBenchmark({ date: '2026-08-13', exerciseId: benchId,
    exerciseName: 'Barbell Bench Press', values: { weight: 155, reps: 25 } });
  ok((await muscleStrength()).muscles.get('Chest').best.reps !== 25,
     'and a high-rep BENCHMARK is refused too — deliberate does not mean informative');

  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-08-01');

  // Sets with no weight or no reps must not fabricate a ranking.
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-08-01');
  await st.saveSession({
    workoutId: 'w4', workoutName: 'Push', date: '2026-08-10',
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 0, reps: 0 }, { weight: 135 }] }],
  });
  r = await muscleStrength();
  ok(!r.muscles.has('Chest'), 'empty or repless sets do not produce a ranking');

  await st.clearAll();
}

/* ================= the offline shell (D6) ================= */
// sw.js hand-lists the files to precache, because there is no build step to
// generate one. A file added and not listed is invisible until someone opens
// the app in a basement with no signal — which is the exact case the service
// worker exists for, and the exact case nobody tests. So the list is checked
// against the repo instead.
{
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  // fileURLToPath, not pathname: the repo lives under "Code Projects" and the
  // space comes back percent-encoded otherwise.
  const up = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), '..');

  const sw = fsMod.readFileSync(pathMod.join(up, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean));

  const shipped = [];
  const walk = (dir, prefix) => {
    for (const f of fsMod.readdirSync(pathMod.join(up, dir))) {
      shipped.push(prefix + f);
    }
  };
  walk('js', 'js/');
  walk('css', 'css/');
  walk('img', 'img/');
  shipped.push('index.html', 'icon.svg', 'manifest.webmanifest');

  const missing = shipped.filter((f) => !listed.has(f));
  ok(missing.length === 0,
     missing.length ? `sw.js precache is missing: ${missing.join(', ')}`
                    : `sw.js precaches all ${shipped.length} shipped assets`);

  const gone = [...listed].filter((f) => f && !fsMod.existsSync(pathMod.join(up, f)));
  ok(gone.length === 0,
     gone.length ? `sw.js precaches files that do not exist: ${gone.join(', ')}`
                 : 'every file sw.js precaches actually exists');

  // Cross-origin must be left alone: Firestore streams over long-polling and
  // the SDK comes from gstatic. Caching either would break sync to no purpose.
  ok(/url\.origin !== self\.location\.origin/.test(sw),
     'sw.js ignores cross-origin requests');
  ok(/req\.method !== 'GET'/.test(sw), 'sw.js never intercepts a write');
}

/* ================= muscle evidence: many exercises, one rating ================= */
// The change this suite exists for: before 2026-08-17 a muscle was ranked by ONE
// named lift, so 11 of 265 exercises could move the body map. A full week of
// training produced a single reading because the work was done with dumbbells
// and machines rather than the exact barbell lift.
{
  const me = await import('../js/muscle-evidence.js');

  // ---- load ----
  ok(me.totalLoad(80, 'per_side') === 160, 'a per-side entry is doubled to total load');
  ok(me.totalLoad(185, 'total') === 185, 'a total entry is left alone');
  ok(me.totalLoad(0, 'total') === null, 'a zero load is not a load');

  // ---- the exercises Tim actually did ----
  // Every one of these was in the library, tagged to the right muscle, and
  // contributed nothing. This is the regression that must never come back.
  const wasIgnored = [
    ['Hammer Curl', 'Biceps'],
    ['Dumbbell Shrug', 'Traps'],
    ['Dumbbell Row', 'Back'],
    ['Seated Calf Raise', 'Calves'],
    ['Machine Shoulder Press', 'Shoulders'],
  ];
  for (const [name, muscle] of wasIgnored) {
    const c = me.contributionsFor(byName(name));
    const hit = c.find((x) => x.muscle === muscle);
    ok(hit && hit.kind === 'direct', `${name} is direct evidence for ${muscle}`);
    ok(hit && hit.ratio > 0 && hit.quality > 0, `${name} converts to the ${muscle} standard`);
  }

  // Coverage, stated as a number so a regression is loud rather than subtle.
  const weighted = BUILT_IN_EXERCISES.filter((e) => e.fields.includes('weight'));
  const contributing = weighted.filter((e) => me.contributionsFor(e).length);
  ok(contributing.length >= 150,
     `${contributing.length}/${weighted.length} weighted exercises now rate a muscle (was 11)`);

  // ---- ordering of the rules ----
  // First match wins, so a specific name placed after a general one would be
  // shadowed and silently take the wrong ratio.
  const specificity = [
    ['Chest-Supported Dumbbell Row', 'Dumbbell Row'],
    ['Cross-Body Hammer Curl', 'Hammer Curl'],
    ['Dumbbell Preacher Curl', 'Preacher Curl'],
    ['Incline Dumbbell Bench Press', 'Dumbbell Bench Press'],
    ['Single-Leg Press', 'Leg Press'],
  ];
  for (const [specific, general] of specificity) {
    const a = me.contributionsFor(byName(specific)).find((x) => x.kind === 'direct');
    const b = me.contributionsFor(byName(general)).find((x) => x.kind === 'direct');
    ok(a && b && a.ratio !== b.ratio,
       `"${specific}" is not shadowed by "${general}" (${a && a.ratio} vs ${b && b.ratio})`);
  }

  // ---- the key lift always wins, wherever the library files it ----
  const cg = me.contributionsFor(byName('Close-Grip Bench Press'));
  const cgTri = cg.find((x) => x.muscle === 'Triceps');
  ok(cgTri && cgTri.ratio === 1 && cgTri.quality === 1,
     'Close-Grip Bench Press is the triceps standard even though it is filed under Chest');
  const dl = me.contributionsFor(byName('Deadlift'));
  const dlGlutes = dl.find((x) => x.muscle === 'Glutes');
  ok(dlGlutes && dlGlutes.ratio === 1 && dlGlutes.kind === 'direct',
     'Deadlift is the glute standard even though it is filed under Back');

  // ---- fallback ----
  const bench = me.contributionsFor(byName('Barbell Bench Press'));
  ok(bench.find((x) => x.muscle === 'Chest').kind === 'direct', 'bench is direct for chest');
  const benchTri = bench.find((x) => x.muscle === 'Triceps');
  ok(benchTri && benchTri.kind === 'fallback', 'and only a fallback for triceps');
  ok(benchTri.quality < bench.find((x) => x.muscle === 'Chest').quality,
     'a fallback is always worth less than the direct reading it came from');
  // An isolation movement must never stand in for another muscle.
  const fly = me.contributionsFor(byName('Cable Fly'));
  ok(!fly.some((x) => x.kind === 'fallback'),
     'a cable fly says nothing about triceps and is not allowed to pretend otherwise');

  // DIRECTION of the cross-muscle conversion. Standing in for a WEAKER muscle
  // has to produce a SMALLER estimate, not a larger one. Getting this backwards
  // rated a dumbbell row as a 429 lb wrist curl and painted Forearms Elite off a
  // single set, which no test caught because every test only checked that a
  // number existed.
  {
    const rowContribs = me.contributionsFor(byName('Barbell Row'));
    const toBack = rowContribs.find((x) => x.muscle === 'Back');
    const toBiceps = rowContribs.find((x) => x.muscle === 'Biceps');
    ok(toBiceps && toBiceps.ratio > toBack.ratio,
       `a row is a bigger multiple of a curl than of a row (${toBiceps && toBiceps.ratio.toFixed(2)} > ${toBack.ratio})`);
    const raw = 250;
    ok(raw / toBiceps.ratio < raw / toBack.ratio,
       'so the biceps estimate it implies is smaller than the back one, as it must be');
    // Same check the other way: bench standing in for triceps, whose standard is
    // lower, must come out lower.
    const b = me.contributionsFor(byName('Barbell Bench Press'));
    const bChest = b.find((x) => x.muscle === 'Chest');
    const bTri = b.find((x) => x.muscle === 'Triceps');
    ok(300 / bTri.ratio < 300 / bChest.ratio,
       'a 300 lb bench implies a close-grip bench BELOW it, never above');
    ok(near(300 / bTri.ratio, 300 / (((225 / 185) + (100 / 85)) / 2), 1e-9),
       'and lands exactly where the published medians say it should');
  }

  // Bodyweight and assisted work logs added or subtracted load, not the load on
  // the muscle, so it cannot be converted at all yet.
  ok(me.contributionsFor(byName('Pull-Up')).length === 0, 'bodyweight work is not rated');
  ok(me.contributionsFor(byName('Assisted Pull-Up')).length === 0, 'assisted work is not rated');

  // ---- cross-muscle conversion comes from the published medians ----
  ok(near(me.crossMuscleRatio('Chest', 'Triceps'), ((225 / 185) + (100 / 85)) / 2, 1e-9),
     'the muscle-to-muscle conversion is derived from the medians, not a second hard-coded table');

  // ---- rep gate and rep weighting ----
  ok(me.repFactor(25) === 0, 'a 25-rep set is not evidence of a maximum');
  ok(me.repFactor(16) === 0, 'and neither is 16');
  ok(me.repFactor(15) > 0, 'but 15 is, which is where the documented cut sits');
  let repMonotone = true;
  for (let r = 2; r <= 15; r++) if (me.repFactor(r) > me.repFactor(r - 1)) repMonotone = false;
  ok(repMonotone, 'the rep factor never rises as reps go up');

  // ---- recency ----
  ok(near(me.recencyWeight(0), 1, 1e-9), 'today counts fully');
  ok(near(me.recencyWeight(120), 0.5, 1e-9), 'and halves over 120 days');
  ok(me.freshness(60) < me.recencyWeight(60),
     'freshness decays faster than weight — old evidence still sets the number, it just stops claiming to be current');
  ok(me.freshness(10000) >= 0.12, 'freshness has a floor, so ancient evidence is not literally worthless');

  // ---- rating ----
  const obs = (o) => ({ estimate: 200, quality: 1, kind: 'direct', reps: 5, ageDays: 0,
                        isBenchmark: false, exerciseId: 'x', date: '2026-08-17', ...o });

  ok(me.rateMuscle([]) === null, 'nothing in, nothing out');
  ok(me.rateMuscle([obs({ reps: 30 })]) === null, 'a single 30-rep set produces no rating');

  // Direct evidence decides; a fallback only fills a gap. Tim's call.
  const mixed = me.rateMuscle([
    obs({ estimate: 100, kind: 'direct', exerciseId: 'direct' }),
    obs({ estimate: 400, kind: 'fallback', quality: 0.4, exerciseId: 'fall' }),
  ]);
  ok(mixed.kind === 'direct' && near(mixed.estimate, 100, 1e-9),
     'a fallback never outvotes direct evidence, however big its number');
  ok(me.rateMuscle([obs({ estimate: 400, kind: 'fallback', quality: 0.4 })]).kind === 'fallback',
     'but it does stand in when there is nothing direct');

  // One value per exercise per day: the best set. Warm-ups and back-offs on the
  // same day must not each count as separate evidence.
  const oneDay = me.rateMuscle([
    obs({ estimate: 100, exerciseId: 'a' }), obs({ estimate: 120, exerciseId: 'a' }),
    obs({ estimate: 90, exerciseId: 'a' }),
  ]);
  ok(oneDay.contributorCount === 1, 'three sets of one exercise on one day are one observation');
  ok(near(oneDay.estimate, 120, 1e-9), 'and it is the best of them');

  // Confidence responds to the four things it claims to.
  const lonely = me.rateMuscle([obs({ estimate: 200, quality: 0.35, exerciseId: 'a' })]);
  const solid = me.rateMuscle([
    obs({ estimate: 200, quality: 1, exerciseId: 'a' }),
    obs({ estimate: 202, quality: 1, exerciseId: 'b' }),
    obs({ estimate: 198, quality: 1, exerciseId: 'c' }),
  ]);
  ok(solid.confidence > lonely.confidence,
     `agreeing high-quality evidence beats one loose reading (${solid.confidence.toFixed(2)} > ${lonely.confidence.toFixed(2)})`);

  const disagreeing = me.rateMuscle([
    obs({ estimate: 120, quality: 1, exerciseId: 'a' }),
    obs({ estimate: 260, quality: 1, exerciseId: 'b' }),
    obs({ estimate: 400, quality: 1, exerciseId: 'c' }),
  ]);
  ok(disagreeing.confidence < solid.confidence,
     'evidence that contradicts itself is less trustworthy than evidence that agrees');

  const stale = me.rateMuscle([
    obs({ estimate: 200, quality: 1, exerciseId: 'a', ageDays: 400 }),
    obs({ estimate: 202, quality: 1, exerciseId: 'b', ageDays: 400 }),
    obs({ estimate: 198, quality: 1, exerciseId: 'c', ageDays: 400 }),
  ]);
  ok(stale.confidence < solid.confidence, 'and year-old evidence is less trustworthy than fresh');

  const machineish = me.rateMuscle([
    obs({ estimate: 200, quality: 0.35, exerciseId: 'a' }),
    obs({ estimate: 202, quality: 0.35, exerciseId: 'b' }),
    obs({ estimate: 198, quality: 0.35, exerciseId: 'c' }),
  ]);
  ok(machineish.confidence < solid.confidence,
     'and evidence that needed a shaky conversion is less trustworthy than the standard lift');

  for (const r of [lonely, solid, disagreeing, stale, machineish]) {
    ok(r.confidence >= 0 && r.confidence <= 1, 'confidence stays inside 0..1');
  }

  // A benchmark is worth more than the same numbers logged mid-workout.
  ok(me.rateMuscle([obs({ estimate: 200, isBenchmark: true, exerciseId: 'a' })]).confidence
     >= lonely.confidence,
     'a deliberate test is worth at least as much as an ordinary set');

  // ---- tint ----
  ok(me.tintFor(1) === 1, 'full confidence paints the full colour');
  ok(near(me.tintFor(0), me.MIN_TINT, 1e-9), 'and no confidence still paints something');
  ok(me.MIN_TINT > 0.25,
     'the floor is high enough that "unsure" never collapses into "never trained"');
  ok(me.tintFor(0.8) > me.tintFor(0.3), 'tint rises with confidence');

  // ---- bands ----
  ok(me.confidenceBand(0.01).key === 'low' && me.confidenceBand(0.99).key === 'high',
     'confidence bands run low to high');
  ok(me.confidenceBand(NaN).key === 'low', 'a broken confidence reads as low, never as high');
}

/* ================= the whole path, through the store ================= */
{
  const { store: st, muscleStrength } = await import('../js/store.js');
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-08-01');

  const id = (n) => byName(n).id;
  const today = new Date().toISOString().slice(0, 10);

  // Tim's week: not one barbell key lift in it.
  await st.saveSession({
    workoutId: 'wk', workoutName: 'Everything', date: today,
    entries: [
      { exerciseId: id('Hammer Curl'), exerciseName: 'Hammer Curl',
        sets: [{ weight: 40, reps: 8 }] },
      { exerciseId: id('Dumbbell Shrug'), exerciseName: 'Dumbbell Shrug',
        sets: [{ weight: 90, reps: 10 }] },
      { exerciseId: id('Dumbbell Row'), exerciseName: 'Dumbbell Row',
        sets: [{ weight: 100, reps: 8 }] },
      { exerciseId: id('Seated Calf Raise'), exerciseName: 'Seated Calf Raise',
        sets: [{ weight: 200, reps: 10 }] },
      { exerciseId: id('Machine Shoulder Press'), exerciseName: 'Machine Shoulder Press',
        sets: [{ weight: 140, reps: 8 }] },
    ],
  });

  const r = await muscleStrength();
  for (const m of ['Biceps', 'Traps', 'Back', 'Calves', 'Shoulders']) {
    ok(r.muscles.has(m), `${m} rates from a non-standard exercise — the whole point of the change`);
  }
  // Per-side conversion has to survive the whole path, not just the unit test:
  // a 100 lb/side dumbbell row is 200 lb on the body.
  const back = r.muscles.get('Back');
  ok(back.estimate > e1rm(100, 8),
     `a per-side row is rated on its total load, not the number typed (${Math.round(back.estimate)})`);

  // Every rating carries a confidence, and none of them claims certainty off one
  // loose session.
  for (const [muscle, m] of r.muscles) {
    ok(m.confidence > 0 && m.confidence < 1, `${muscle} carries a real confidence`);
    ok(m.tint >= 0.38 && m.tint <= 1, `${muscle} tint is inside the painted range`);
    ok(Boolean(m.band && m.band.name), `${muscle} names its confidence in words`);
  }
  ok(r.muscles.get('Biceps').confidence < 0.72,
     'one hammer-curl set does not produce high confidence in a biceps rating');

  // The standard lift, done properly, must be trusted more than a converted
  // machine number.
  const rateAlone = async (name, weight) => {
    await st.clearAll();
    await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
    await st.logBodyWeight(180, '2026-08-01');
    await st.saveSession({
      workoutId: 'k', workoutName: 'Press', date: today,
      entries: [{ exerciseId: id(name), exerciseName: name, sets: [{ weight, reps: 5 }] }],
    });
    return (await muscleStrength()).muscles.get('Shoulders');
  };
  const direct = await rateAlone('Overhead Press', 135);
  const converted = await rateAlone('Machine Shoulder Press', 148);
  ok(direct.confidence > converted.confidence,
     `the standard lift is trusted more than a machine converted to it (${direct.confidence.toFixed(2)} > ${converted.confidence.toFixed(2)})`);

  // Fallback: bench and nothing else should still say something about triceps,
  // clearly labelled, and it must not be mistaken for direct evidence.
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-08-01');
  await st.saveSession({
    workoutId: 'b1', workoutName: 'Push', date: today,
    entries: [{ exerciseId: id('Barbell Bench Press'), exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 225, reps: 5 }] }],
  });
  const fb = await muscleStrength();
  ok(fb.muscles.get('Chest').basis === 'direct', 'bench rates chest directly');
  ok(fb.muscles.get('Triceps') && fb.muscles.get('Triceps').basis === 'fallback',
     'and stands in for triceps, marked as inferred');
  ok(fb.muscles.get('Triceps').confidence < fb.muscles.get('Chest').confidence,
     'with less confidence than the muscle it actually trained');
  ok(!fb.muscles.has('Quads'), 'and says nothing at all about a muscle it does not touch');
  ok(typeof fb.muscles.get('Triceps').hint === 'string'
     && /direct/i.test(fb.muscles.get('Triceps').hint),
     'the panel is told how to turn that inference into a real rating');

  // Adding a direct triceps exercise must take over from the inference.
  await st.saveSession({
    workoutId: 'b2', workoutName: 'Arms', date: today,
    entries: [{ exerciseId: id('Skull Crusher'), exerciseName: 'Skull Crusher',
                sets: [{ weight: 95, reps: 8 }] }],
  });
  ok((await muscleStrength()).muscles.get('Triceps').basis === 'direct',
     'a direct triceps exercise takes over from the bench inference');

  await st.clearAll();
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
