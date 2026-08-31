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
  bodyWeightSeries, trainingForMuscle, weeklyVolumeByMuscle,
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
// ⚠️ LABEL CORRECTED 2026-08-24. This line used to read "assisted excluded" and
// it still passes, but for a completely different reason: the exercise now has a
// fraction, so what refuses it here is the missing body weight, exactly as for
// the pull-up above. A green assertion whose stated reason has quietly stopped
// being the real one is worth less than no assertion — the positive case is
// pinned in tests/bodyweight.test.mjs, which is where the arithmetic lives.
ok(!canNormalize(byName('Assisted Pull-Up')),
   'assisted needs a weigh-in like any other body-weight lift — one argument still refuses it');
ok(canNormalize(byName('Assisted Pull-Up'), { bodyWeight: 180 }),
   '⚠️ …and IS normalisable once a body weight is known, which is what changed');
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

/* ---------- which source a chart opens on ----------
   Tim, 2026-08-16: "default should be mostly workout measurements". The graph
   used to hard default to benchmarks whenever any existed, so an exercise with
   months of logged sets and two benchmarks opened on a two-point line. Each
   source now reports how many DISTINCT DAYS it can draw, and the view opens on
   whichever has more. Days, not readings — ten sets in one afternoon is still
   one point on a chart, and counting readings would have made any single heavy
   session outvote a year of benchmarks.                                      */
{
  const bch = chartable.find((c) => c.id === bench.id);
  ok(bch.sources.benchmark.days === 2,
     `bench has two benchmark days (${bch.sources.benchmark.days})`);
  ok(bch.sources.workout.days === 2,
     `and two workout days, from three sets across them (${bch.sources.workout.days})`);
  // The vacuity guard: without this the days count could be reading sets and
  // the assertion above would still pass by coincidence.
  const wObs = await weightRepObservations(bench.id, 'workout');
  ok(new Set(wObs.map((o) => o.date)).size === 2 && wObs.length === 3,
     `${wObs.length} workout sets fall on 2 days, so days and readings genuinely differ`);
}

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

/* ---------- ⚠️ restore: what it refuses, and what it replaces ---------- *
 *
 * Found by the edge-case review 2026-08-22, fixed 2026-08-24. `importAll()`
 * validated almost nothing, MERGED rather than replaced, and had no
 * confirmation while "Delete all data" two lines below it had one.
 */
const rejects = (bad, why) => {
  let threw = null;
  try { store.inspectBackup(bad); } catch (e) { threw = e; }
  ok(threw instanceof Error && threw.message.length > 10, why);
  return threw;
};
rejects(null, 'a null file is refused');
rejects('not json', 'a string is refused');
rejects([], 'a bare array is refused — a backup is an object of collections');
// ⚠️ This one used to toast "Backup restored" having restored nothing at all,
// which is worse than failing: the user walks away believing it worked.
rejects({ foo: 1 }, '⚠️ a file with no recognised collection is refused, not silently "restored"');
rejects({ workouts: 'oops' }, 'a collection that is not a list is refused');
// ⚠️ THE ONE THAT TOOK THE APP DOWN. `{sessions:[{id:'s1'}]}` stored fine and
// then getSessions() threw on `b.date.localeCompare`, killing every screen but
// Settings through the router's catch.
const dateless = rejects({ sessions: [{ id: 's1' }] },
  '⚠️ a session with no date is refused BEFORE it is written, not after it breaks every screen');
ok(/date/.test(dateless.message), 'and the message names the actual problem');
rejects({ sessions: [{ date: '2026-01-01' }] }, 'a row with no id is refused');
rejects({ bodyWeight: [{ id: 'b', date: '2026-01-01', weight: 0 }] }, 'a zero weigh-in is refused');
rejects({ benchmarks: [{ id: 'x', date: 'whenever' }] }, 'an unparseable benchmark date is refused');

// ⚠️ NOTHING IS WRITTEN WHEN ANYTHING IS WRONG. The old code wrote each
// collection as it walked, so a good `workouts` followed by a bad `sessions`
// left the account half-restored.
const before = (await store.getSessions()).length;
let halfThrew = false;
try {
  await store.importAll({ workouts: [{ id: 'wX', name: 'X', exercises: [] }], sessions: [{ id: 'bad' }] });
} catch { halfThrew = true; }
ok(halfThrew && (await store.getSessions()).length === before
   && !(await store.getWorkouts()).some((x) => x.id === 'wX'),
   '⚠️ a backup that is bad ANYWHERE writes nothing — no half-restore');

// ⚠️ A COLLECTION THE FILE DOES NOT CARRY IS CLEARED, NOT LEFT BEHIND. This is
// the dangling-foreign-key fix: restoring a pre-systems backup used to keep the
// CURRENT systems, so a restored workout could point at a system that was never
// in the file — on disk, returned by getWorkouts(), rendered by no screen, and
// never adopted by ensureSystems() because that only looks for workouts with NO
// systemId rather than a dead one.
await store.importAll(dump);
ok((await store.getSessions()).length === 4, 'a full backup still restores everything');
await store.importAll({ workouts: [] });
ok((await store.getSessions()).length === 0,
   '⚠️ and a partial backup CLEARS what it does not carry — a restore is a snapshot, not a merge');
await store.importAll(dump);
ok((await store.getSessions()).length === 4, 'and the full backup restores again afterwards');

// The counts the confirmation sheet is built from have to be real, or the sheet
// is asking somebody to approve a number nobody computed.
const summary = store.inspectBackup(dump);
ok(summary.counts.sessions === 4 && summary.total >= 4,
   `inspectBackup reports what is actually in the file (${summary.counts.sessions} sessions)`);

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

/* ---------- ⚠️ GOALS IS OFF THE TAB BAR, NOT DELETED ---------- *
 *
 * Tim, 2026-08-25: *"I want to remove the Goals section and replace it with the
 * Calendar details."* Goals is a built, tested feature (232 assertions) and the
 * instruction is about the bottom bar, not about the code — so the tab goes and
 * the route stays.
 *
 * ⚠️ AND A ROUTE WITH NO WAY IN IS DELETED IN EVERY SENSE THAT MATTERS TO A
 * USER, which is the half a "we kept the route" claim usually forgets. All
 * three halves are asserted together, because any one of them alone is
 * satisfiable while the feature is unreachable.
 *
 * ⚠️ ASSERTED ON THE SOURCE, for the reason firebase-backend.js's redirect
 * guard is: `app.js` is the boot script, exports nothing, and starts a router
 * against a real DOM on import. A structural assertion is worth more than none,
 * and what must not quietly come back is an unreachable screen.
 */
{
  const { readFileSync } = await import('node:fs');
  const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const navBlock = appSrc.slice(appSrc.indexOf('const NAV = ['), appSrc.indexOf('];', appSrc.indexOf('const NAV = [')));

  ok(/hash: '#\/calendar'/.test(navBlock), 'Calendar has a nav tab of its own');
  ok(!/hash: '#\/goals'/.test(navBlock), 'and Goals no longer has one');
  ok((navBlock.match(/hash: '#\//g) || []).length === 5,
     'still five tabs — the bar did not grow, Calendar took the slot Goals left');

  // Half two: the route still resolves.
  ok(/case 'goals':/.test(appSrc), '⚠️ but #/goals STILL RESOLVES — a bookmarked hash must not start 404ing');
  // Half three: something on screen still points at it.
  const settingsSrc = readFileSync(new URL('../js/views-data.js', import.meta.url), 'utf8');
  ok(/href: '#\/goals'/.test(settingsSrc),
     '⚠️ and something LINKS to it — a route nobody can reach is deleted in every sense that matters');
  // And it can be got out of again.
  const goalsSrc = readFileSync(new URL('../js/views-goals.js', import.meta.url), 'utf8');
  ok((goalsSrc.match(/back: \(\) => go\('#\/settings'\)/g) || []).length === 3,
     'all three Goals screens have a way back, since none of them has a tab any more');
}

/* ---------- ⚠️ how full the cloud is — Open work 0b(c) ---------- *
 *
 * The edge-case review found that nothing warns as the 1 MiB per-document cap
 * approaches, and that the project's own estimate of where that cap lands was
 * wrong by 3× (~300 bytes a session claimed, ~1,100 measured). `cloudUsage()`
 * replaces the constant with arithmetic over the account's real rows.
 *
 * ⚠️ THE SHARPEST ASSERTION HERE IS THAT A NUMBER COSTS 8 BYTES. Firestore
 * charges 8 for every number; `JSON.stringify(225)` is three characters. A
 * training history is mostly numbers, so a size check built on JSON length
 * UNDER-counts and would fire after the thing it warns about. Two assertions
 * below fail the moment anybody "simplifies" this to a stringify.
 */
const {
  firestoreValueBytes, firestoreDocBytes, FIRESTORE_DOC_LIMIT, CLOUD_WARN_AT,
} = await import('../js/store.js');

// The published charges, one per type (Firestore → Usage and limits → Storage size).
ok(firestoreValueBytes(null) === 1 && firestoreValueBytes(undefined) === 1, 'null costs 1 byte');
ok(firestoreValueBytes(true) === 1 && firestoreValueBytes(false) === 1, 'a boolean costs 1 byte');
ok(firestoreValueBytes(0) === 8 && firestoreValueBytes(-3.75) === 8 && firestoreValueBytes(1e9) === 8,
   'EVERY number costs 8 bytes, whatever it looks like written down');
ok(firestoreValueBytes('abc') === 4, 'a string costs its UTF-8 bytes + 1');
ok(firestoreValueBytes('é') === 3, 'and it is UTF-8 bytes, not characters');
ok(firestoreValueBytes(new Date()) === 8, 'a date is stored as a timestamp: 8 bytes');

// ⚠️ The two that stop this becoming JSON.stringify().length.
ok(firestoreValueBytes(225) === 8 && JSON.stringify(225).length === 3,
   '⚠️ a number costs MORE than its text — 8 against 3 — so JSON length under-counts');
ok(firestoreValueBytes({ weight: 225, reps: 5 }) > JSON.stringify({ weight: 225, reps: 5 }).length,
   '⚠️ and a set of numbers costs more in Firestore than it does as JSON');

// A map pays 32 for existing; an array pays for its contents and nothing more.
ok(firestoreValueBytes([]) === 0, 'an empty array is free');
ok(firestoreValueBytes({}) === 32, 'an empty map still costs 32');
ok(firestoreValueBytes([1, 2, 3]) === 24, 'an array is the sum of its values — no per-array overhead');
ok(firestoreValueBytes({ a: 1 }) === 32 + 2 + 8, 'a map is 32 + each key + each value');
ok(firestoreValueBytes([{ a: 1 }, { a: 1 }]) === 2 * firestoreValueBytes({ a: 1 }),
   'nesting composes rather than compounding');
ok(firestoreValueBytes({ a: 1, b: undefined }) === firestoreValueBytes({ a: 1 }),
   'an undefined field is not charged, because the SDK refuses to send one');

// The document wrapper: a name, the two fields the backend really writes, +32.
ok(firestoreDocBytes('sessions', []) > 0 && firestoreDocBytes('sessions', []) < 200,
   'an empty collection document is overhead only');
ok(firestoreDocBytes('sessions', [{ id: 's1' }]) > firestoreDocBytes('sessions', []),
   'and it grows with the rows');

ok(FIRESTORE_DOC_LIMIT === 1048576, 'the cap is Firestore\'s 1 MiB, not a number we chose');
ok(CLOUD_WARN_AT > 0.5 && CLOUD_WARN_AT < 1,
   'the warning threshold leaves runway rather than firing at the wall');

// ⚠️ CROSS-CHECK AGAINST THE INDEPENDENT MEASUREMENT — AND IT FOUND THAT
// MEASUREMENT SHORT. The edge-case review serialised 3,000 real-shaped sessions
// and got ~1,100 bytes each, giving a ceiling near 950. The demo year agrees
// with it exactly on JSON — ~1,200 bytes a session — so the two are measuring
// the same kind of data and the demo is not unusually fat. What the review's
// number leaves out is that Firestore does not charge JSON length. The ratio
// asserted below is the whole finding: **the ceiling is nearer 520 sessions
// than 950**, and the doc has been corrected to say so.
{
  const { buildDemoData } = await import('../js/demo.js');
  const demoData = buildDemoData({ today: '2026-08-24', units: 'lbs', theme: 'dark' });
  const sess = demoData.sessions;
  const bytes = firestoreDocBytes('sessions', sess);
  const jsonPer = Buffer.byteLength(JSON.stringify(sess), 'utf8') / sess.length;
  const per = bytes / sess.length;
  const ceiling = Math.floor(FIRESTORE_DOC_LIMIT / per);

  ok(sess.length > 100, `demo year has ${sess.length} sessions to measure`);
  ok(jsonPer > 900 && jsonPer < 1500,
     `demo sessions are ordinary-sized: ${jsonPer.toFixed(0)} JSON bytes each, vs the ~1,100 the review measured`);
  ok(per / jsonPer > 1.4 && per / jsonPer < 2.0,
     `⚠️ Firestore charges ${(per / jsonPer).toFixed(2)}× the JSON — 32 bytes a map and 8 a number is not a rounding error`);
  ok(ceiling > 400 && ceiling < 700,
     `⚠️ so the real ceiling is ~${ceiling} sessions, NOT the ~950 the JSON measurement implied`);
  // The set row that makes the case in one line.
  ok(firestoreValueBytes({ weight: 205, reps: 6 }) === 60
     && JSON.stringify({ weight: 205, reps: 6 }).length === 23,
     '⚠️ one recorded set: 23 bytes of JSON, 60 to Firestore');
}

// ⚠️ THE SAFETY CLAIM. This suite runs with the cloud configured and
// unreachable, so the store is on the local backend — where the limit is
// localStorage's, a different size and a different failure. Quoting a Firestore
// ceiling here would be a confident number about the wrong storage.
ok(await store.cloudUsage() === null,
   '⚠️ cloudUsage() says NOTHING unless the data really is in Firestore');

/* ---------- can the redirect flow even finish here? ---------- */
// ⚠️ Reported by Tim from an iPhone, 2026-08-21: the Google popup opens, closes
// a second later, and nothing happens. The part worth pinning is not the popup —
// it is that the app's RECOVERY was a redirect, and Firebase document
// signInWithRedirect as unable to complete whenever the authDomain is a
// different origin from the app, because Safari 16.1+, Firefox 109+ and Chrome
// M115+ all block the cross-origin storage the handler needs.
// (firebase.google.com/docs/auth/web/redirect-best-practices)
//
// This project is exactly that shape: served from timothyhadfield.github.io,
// authDomain fitness-tracker-th.firebaseapp.com. So the one route the UI called
// "the route that always works" was the one guaranteed not to.
//
// Asserted on ORIGINS rather than on a browser sniff, deliberately: the list of
// browsers that partition third-party storage only grows, and a sniff written
// today is wrong next year.
{
  const realWindow = globalThis.window;
  globalThis.window = { location: { hostname: 'timothyhadfield.github.io' }, navigator: {} };

  ok(fb.redirectCanComplete({ authDomain: 'fitness-tracker-th.firebaseapp.com' }) === false,
     'a cross-origin authDomain cannot complete a redirect — this project, on Tim’s phone');
  ok(fb.redirectCanComplete({ authDomain: 'timothyhadfield.github.io' }) === true,
     'and a same-origin one can, which is the fix if it is ever wanted');
  ok(fb.redirectCanComplete({}) === false, 'no authDomain is not a working redirect either');

  // ⚠️ THE REGRESSION THAT MATTERS. prefersRedirect() used to return true for an
  // iOS home-screen app on the reasoning that a popup there is usually blocked.
  // True — but it was choosing between a route that MIGHT fail and one that
  // CANNOT work, and picking the second.
  globalThis.window.navigator.standalone = true;
  ok(fb.prefersRedirect({ authDomain: 'fitness-tracker-th.firebaseapp.com' }) === false,
     'an installed iOS app is NOT sent to a redirect that cannot finish');
  ok(fb.prefersRedirect({ authDomain: 'timothyhadfield.github.io' }) === true,
     'but it still prefers one where the redirect genuinely works — the reasoning survives');

  globalThis.window = realWindow;
}

/* ⚠️ AND THE BOOT PATH ASKS THE SAME QUESTION — 2026-08-22.
 *
 * Tim opened the app on his iPhone and got Firebase's own page:
 *
 *   "Unable to process request due to missing initial state … 2) Using
 *    signInWithRedirect in a storage-partitioned browser environment."
 *
 * That is `auth/missing-initial-state`, and calling `getRedirectResult()` is
 * what asks for the state it complains about. In THIS configuration a redirect
 * could never legitimately have started — the app is on github.io and the
 * authDomain is not — so the question should never be asked at boot either.
 *
 * ⚠️ ASSERTED ON THE SOURCE, because `init()` cannot be unit-tested without the
 * live SDK, a network and a browser. It is the same shape as the sw.js precache
 * check: a structural assertion is worth more than no assertion, and what must
 * not silently come back is the UNGUARDED call. */
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/firebase-backend.js', import.meta.url), 'utf8');
  const call = src.indexOf('auth.getRedirectResult(');
  ok(call !== -1, 'the redirect result is still collected somewhere — the flow is not silently gone');

  // The guard must sit above the call, in the same function.
  const guard = src.lastIndexOf('if (redirectCanComplete(FIREBASE_CONFIG))', call);
  ok(guard !== -1 && call - guard < 400,
     '⚠️ getRedirectResult() is only called where a redirect could actually have completed — '
     + 'asking otherwise is what produced auth/missing-initial-state on an iPhone');
}

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

/* ---------- ⚠️ ONE DOCUMENT PER SESSION — the sharding, Open work 0b(c) ----
   The 1 MiB per-document cap put a ceiling at ~520 sessions. Sessions and
   guest sessions now live one document per row. Only the pure half is
   testable here — nothing in this project can execute a Firestore write —
   so the diff, the snapshot and the legacy merge are driven directly.      */
{
  ok(fb.SHARDED_COLLECTIONS.includes('sessions') && fb.SHARDED_COLLECTIONS.includes('guestSessions'),
     'the two collections that carry `entries` are the sharded ones');
  ok(!fb.SHARDED_COLLECTIONS.includes('settings') && !fb.SHARDED_COLLECTIONS.includes('bodyWeight'),
     'and the bounded ones are left whole');

  const rows = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }];
  const snap = fb.shardSnapshot(rows);

  // ⚠️ THE WHOLE POINT: saving one session writes ONE document, not the lot.
  const edited = [{ id: 'a', v: 1 }, { id: 'b', v: 99 }, { id: 'c', v: 3 }];
  const d1 = fb.shardDiff(snap, edited);
  ok(d1.writes.length === 1 && d1.writes[0].id === 'b',
     `editing one row writes one document (${d1.writes.length})`);
  ok(d1.deletes.length === 0, 'and deletes nothing');

  // Identity is not the test — the store hands back the same objects it was
  // given, so an identity check would call everything unchanged.
  const sameContentNewObjects = rows.map((r) => ({ ...r }));
  ok(fb.shardDiff(snap, sameContentNewObjects).writes.length === 0,
     '⚠️ re-saving identical content writes nothing, even as fresh objects');

  const d2 = fb.shardDiff(snap, [{ id: 'a', v: 1 }, { id: 'd', v: 4 }]);
  ok(d2.writes.length === 1 && d2.writes[0].id === 'd', 'a new row is one write');
  ok(d2.deletes.sort().join() === 'b,c', `and the rows that went away are deleted (${d2.deletes})`);

  // clearAll() is a write of [] — every document has to go.
  ok(fb.shardDiff(snap, []).deletes.length === 3, 'clearing the collection deletes every document');
  ok(fb.shardDiff(new Map(), rows).writes.length === 3, 'a first write creates all of them');

  // A row with no id has no document name it could occupy.
  ok(fb.shardDiff(new Map(), [{ v: 1 }]).writes.length === 0, 'a row with no id is dropped, not guessed at');

  /* ---- the migration read: shard + whatever is left in the old document ---- */
  const shardRows = [{ id: 'a', v: 1 }];
  const legacyRows = [{ id: 'a', v: 'stale' }, { id: 'z', v: 26 }];
  const m = fb.mergeShardAndLegacy(shardRows, legacyRows);
  ok(m.length === 2, `legacy rows the shard has never heard of are adopted (${m.length})`);
  ok(m.find((r) => r.id === 'a').v === 1,
     '⚠️ but the SHARD wins a collision — a stale cached copy must not revert a newer edit');
  ok(m.find((r) => r.id === 'z').v === 26, 'and the genuinely new row comes through');
  ok(fb.mergeShardAndLegacy([{ id: 'a' }], []).length === 1,
     'a shard-only merge stands alone — nothing requires the legacy document to hold anything');
  ok(fb.mergeShardAndLegacy(null, null).length === 0, 'and nothing merges to nothing');

  /* ---- batching, because Firestore refuses a batch over 500 ---- */
  const many = Array.from({ length: 1201 }, (_, i) => i);
  const chunks = fb.inBatches(many);
  ok(chunks.length === 3, `1,201 operations split into three batches (${chunks.length})`);
  ok(chunks.every((ch) => ch.length <= fb.BATCH_LIMIT), 'none of them over the limit');
  ok(chunks.reduce((n, ch) => n + ch.length, 0) === 1201, 'and nothing is lost in the splitting');
  ok(fb.inBatches([]).length === 0, 'no operations means no batches at all');

}

/* ================= ⚠️ THE SHARD DRIVEN AGAINST A FIRESTORE DOUBLE =========
   createShardIO() takes its Firestore surface as an argument so this can
   drive the whole thing against an in-memory double.

   ⚠️ REWRITTEN 2026-08-28, THE DAY AFTER THE DESIGN IT TESTED ERASED THE
   SESSIONS OFF TIM'S CALENDAR. The old block proved migrate → verify →
   empty, and the emptying was the mistake: old builds read only the legacy
   document, and a stale cached read could migrate the two rows it saw and
   then overwrite a fuller server document with an empty list — a hole
   verification cannot see, because verification can only check what was
   read. The design is now ADOPTION: the legacy document is NEVER written by
   the shard path, and the first assertions below are that prohibition.

   ⚠️ THIS IS NOT A TEST AGAINST FIRESTORE and must never be described as one.
   The double below implements the calls the shard uses and nothing about
   consistency, rules, batch semantics or partial failure. What it proves is
   that the ORDER and the ARITHMETIC are right — which is the half that loses
   data when it is wrong.                                                    */
{
  // A Firestore double: paths are strings, documents are plain objects.
  function fakeFirestore() {
    const docs = new Map();          // 'users/u1/sessions/a' → data
    const log = [];
    const path = (ref) => ref.__path;
    const fs = {
      doc: (...args) => {
        // Either doc(db, ...segments) or doc(collectionRef, id).
        const head = args[0];
        const rest = args.slice(1);
        const base = head && head.__path ? head.__path : '';
        return { __path: [base, ...rest].filter(Boolean).join('/') };
      },
      collection: (...args) => {
        const rest = args.slice(1);
        return { __path: rest.join('/') };
      },
      async getDoc(ref) {
        const data = docs.get(path(ref));
        log.push(['getDoc', path(ref)]);
        return { exists: () => data !== undefined, data: () => data };
      },
      async getDocs(ref) {
        const prefix = path(ref) + '/';
        log.push(['getDocs', path(ref)]);
        const hits = [...docs.entries()].filter(([k]) => k.startsWith(prefix));
        return {
          forEach(fn) {
            for (const [k, v] of hits) fn({ id: k.slice(prefix.length), data: () => v });
          },
        };
      },
      async setDoc(ref, data) { log.push(['setDoc', path(ref)]); docs.set(path(ref), data); },
      serverTimestamp: () => 'TS',
      writeBatch() {
        const ops = [];
        return {
          set: (ref, data) => ops.push(['set', path(ref), data]),
          delete: (ref) => ops.push(['delete', path(ref)]),
          async commit() {
            log.push(['commit', ops.length]);
            for (const [kind, p, data] of ops) {
              if (kind === 'set') docs.set(p, data);
              else docs.delete(p);
            }
          },
        };
      },
    };
    return { c: { fs, db: {} }, docs, log };
  }

  const LEGACY = 'users/u1/collections/sessions';
  const sess = (id, w) => ({ id, date: '2026-08-01', entries: [{ exerciseId: 'x', sets: [{ weight: w, reps: 5 }] }] });

  /* ---- ⚠️ THE PROHIBITION: adoption never touches the legacy document ---- */
  {
    const { c, docs, log } = fakeFirestore();
    docs.set(LEGACY, { rows: [sess('s1', 100), sess('s2', 200)], updatedAt: 'TS' });
    const io = fb.createShardIO(c, 'u1');

    const rows = await io.read('sessions', docs.get(LEGACY).rows);
    ok(rows.length === 2, `both sessions come back (${rows.length})`);
    ok(docs.has('users/u1/sessions/s1') && docs.has('users/u1/sessions/s2'),
       'and each is adopted into its own document');
    ok(docs.get('users/u1/sessions/s1').row.entries[0].sets[0].weight === 100,
       'carrying the whole row, entries and all');
    ok(docs.get(LEGACY).rows.length === 2,
       '⚠️ and the legacy document STILL HOLDS BOTH ROWS — it is the backup floor now');
    ok(!log.some((e) => e[0] === 'setDoc'),
       '⚠️ NO setDoc was issued AT ALL — the shard path cannot even address the legacy document');

    // Steady state: everything adopted, a read is read-only.
    const before = log.length;
    const again = await io.read('sessions', docs.get(LEGACY).rows);
    ok(again.length === 2, 'a second read returns the same two sessions');
    ok(!log.slice(before).some((e) => e[0] === 'commit' || e[0] === 'setDoc'),
       'and writes nothing — adoption is idempotent and has converged');

    // Editing a shard row: the shard wins over the frozen legacy copy.
    await io.write('sessions', [sess('s1', 105), sess('s2', 200)]);
    const merged = await io.read('sessions', docs.get(LEGACY).rows);
    ok(merged.find((r) => r.id === 's1').entries[0].sets[0].weight === 105,
       'the shard wins a collision with the frozen legacy copy');
    ok(docs.get(LEGACY).rows.find((r) => r.id === 's1').entries[0].sets[0].weight === 100,
       'which stays frozen at what it held — a backup does not follow the edits');
  }

  /* ---- ⚠️ THE STALE-CACHE SCENARIO THAT ERASED TIM'S CALENDAR ----
     A legacy read missing rows (a stale offline cache) used to migrate what
     it saw and then overwrite the fuller SERVER document with rows: []. The
     same partial read now adopts two rows and destroys nothing.             */
  {
    const { c, docs } = fakeFirestore();
    docs.set(LEGACY, { rows: [sess('s1', 100), sess('s2', 200), sess('s3', 300), sess('s4', 400)], updatedAt: 'TS' });
    const stale = [sess('s1', 100), sess('s2', 200)];   // what a stale cache saw
    const io = fb.createShardIO(c, 'u1');
    await io.read('sessions', stale);
    ok(docs.get(LEGACY).rows.length === 4,
       '⚠️ a STALE partial read cannot cost the server document a single row');
    const all = await io.read('sessions', docs.get(LEGACY).rows);
    ok(all.length === 4, 'and a later fresh read adopts the remaining rows');
  }

  /* ---- ⚠️ THE MASS-DELETE GUARD — "make it extremely difficult to erase
     data from people's accounts" (Tim, 2026-08-28) ---- */
  {
    const { c, docs } = fakeFirestore();
    const io = fb.createShardIO(c, 'u1');
    const ten = Array.from({ length: 10 }, (_, i) => sess('s' + i, 100 + i));
    await io.write('sessions', ten, { wholesale: true });
    ok([...docs.keys()].filter((k) => k.startsWith('users/u1/sessions/')).length === 10,
       'ten sessions stand');

    let threw = null;
    try { await io.write('sessions', ten.slice(0, 3)); } catch (e) { threw = e; }
    ok(Boolean(threw), '⚠️ a write that would delete 7 of 10 sessions is REFUSED outright');
    ok([...docs.keys()].filter((k) => k.startsWith('users/u1/sessions/')).length === 10,
       'and not one document was touched — a wrong delete half means no trustworthy halves');

    await io.write('sessions', ten.slice(0, 8));
    ok([...docs.keys()].filter((k) => k.startsWith('users/u1/sessions/')).length === 8,
       `deleting 2 — within MASS_DELETE_MAX (${fb.MASS_DELETE_MAX}) — still works, because ordinary deletes must`);

    let threw2 = null;
    try { await io.write('sessions', []); } catch (e) { threw2 = e; }
    ok(Boolean(threw2), 'and writing [] over 8 sessions without the wholesale flag is refused');

    await io.write('sessions', [], { wholesale: true });
    ok([...docs.keys()].filter((k) => k.startsWith('users/u1/sessions/')).length === 0,
       'while the declared wholesale path (Clear all, after its snapshot) still can');
  }

  /* ---- writing: one session saved is one document written ---- */
  {
    const { c, docs, log } = fakeFirestore();
    docs.set(LEGACY, { rows: [sess('s1', 100), sess('s2', 200), sess('s3', 300)], updatedAt: 'TS' });
    const io = fb.createShardIO(c, 'u1');
    const rows = await io.read('sessions', docs.get(LEGACY).rows);

    // Edit one, exactly as store.saveSession() does: read, change a row, write
    // the whole list back.
    const edited = rows.map((r) => (r.id === 's2' ? sess('s2', 225) : r));
    const before = log.length;
    await io.write('sessions', edited);
    const commits = log.slice(before).filter((e) => e[0] === 'commit');
    ok(commits.length === 1 && commits[0][1] === 1,
       `⚠️ saving one session costs ONE document write (${commits[0] && commits[0][1]}), not three`);
    ok(docs.get('users/u1/sessions/s2').row.entries[0].sets[0].weight === 225, 'and the edit landed');
    ok(docs.get('users/u1/sessions/s1').row.entries[0].sets[0].weight === 100, 'while the others sat still');

    // Deleting a session deletes its document.
    await io.write('sessions', edited.filter((r) => r.id !== 's1'));
    ok(!docs.has('users/u1/sessions/s1'), 'deleting a session deletes its document');
    ok(docs.has('users/u1/sessions/s2') && docs.has('users/u1/sessions/s3'), 'and only that one');

    // clearAll() writes [].
    await io.write('sessions', []);
    ok([...docs.keys()].filter((k) => k.startsWith('users/u1/sessions/')).length === 0,
       'clearing the collection removes every document');
  }

  /* ---- ⚠️ A WRITE WITH A COLD MEMO READS FIRST, OR IT DELETES NOTHING ----
     Restoring a backup replaces every collection wholesale, and on a fresh tab
     that write can be the first thing this code does to the collection.     */
  {
    const { c, docs } = fakeFirestore();
    docs.set('users/u1/sessions/old1', { row: sess('old1', 100), updatedAt: 'TS' });
    docs.set('users/u1/sessions/old2', { row: sess('old2', 200), updatedAt: 'TS' });
    const io = fb.createShardIO(c, 'u1');       // never read — memo is cold

    await io.write('sessions', [sess('new1', 300)]);
    ok(!docs.has('users/u1/sessions/old1') && !docs.has('users/u1/sessions/old2'),
       '⚠️ a cold write still clears what was there — otherwise a restore merges instead of replacing');
    ok(docs.has('users/u1/sessions/new1'), 'and writes the new row');
  }

  /* ---- an old client's NEW sessions are adopted on the next read ---- */
  {
    const { c, docs } = fakeFirestore();
    docs.set(LEGACY, { rows: [sess('s1', 100)], updatedAt: 'TS' });
    const io = fb.createShardIO(c, 'u1');
    await io.read('sessions', docs.get(LEGACY).rows);

    // An old client records a workout straight into the legacy document.
    docs.set(LEGACY, { rows: [sess('s1', 100), sess('sOld', 400)], updatedAt: 'TS' });
    const rows = await io.read('sessions', docs.get(LEGACY).rows);
    ok(rows.length === 2 && rows.some((r) => r.id === 'sOld'),
       `the old client's session is picked up (${rows.length} rows)`);
    ok(docs.has('users/u1/sessions/sOld'), 'and adopted into a document of its own');
    ok(docs.get(LEGACY).rows.length === 2,
       'while the legacy document keeps what the old client wrote — nothing empties it');
  }

  /* ---- guestSessions get the same treatment, on their own path ---- */
  {
    const { c, docs } = fakeFirestore();
    const io = fb.createShardIO(c, 'u1');
    await io.write('guestSessions', [{ id: 'g1', guestName: 'Alex', entries: [] }]);
    ok(docs.has('users/u1/guestSessions/g1'), 'a guest session shards under its own collection');
    ok(!docs.has('users/u1/sessions/g1'), 'and never lands in the owner\'s sessions');
  }

  /* ---- ⚠️ TWO ACCOUNTS NEVER SHARE A MEMO ----
     A memo carried across a sign-in would diff the new account's rows against
     the previous account's, and the DELETES out of that would land on the
     documents of whoever just signed in.                                    */
  {
    const { c, docs } = fakeFirestore();
    const a = fb.createShardIO(c, 'u1');
    await a.write('sessions', [sess('s1', 100), sess('s2', 200)]);

    const b = fb.createShardIO(c, 'u2');
    await b.write('sessions', [sess('t1', 300)]);
    ok(docs.has('users/u1/sessions/s1') && docs.has('users/u1/sessions/s2'),
       '⚠️ writing as a second account leaves the first account\'s documents alone');
    ok(docs.has('users/u2/sessions/t1'), 'and writes under its own uid');
  }

  /* ---- 1,200 legacy sessions still adopt, in batches Firestore accepts ---- */
  {
    const { c, docs, log } = fakeFirestore();
    const many = Array.from({ length: 1200 }, (_, i) => sess('s' + i, 100 + i));
    docs.set(LEGACY, { rows: many, updatedAt: 'TS' });
    const io = fb.createShardIO(c, 'u1');
    const rows = await io.read('sessions', many);
    ok(rows.length === 1200, `all 1,200 adopt (${rows.length})`);
    const commits = log.filter((e) => e[0] === 'commit');
    ok(commits.length === 3 && commits.every((e) => e[1] <= fb.BATCH_LIMIT),
       `in ${commits.length} batches, none over Firestore's limit of ${fb.BATCH_LIMIT}`);
    ok(docs.get(LEGACY).rows.length === 1200,
       '⚠️ and the legacy document still holds all 1,200 — nothing empties it, ever');
  }

  /* ---- the backup layer, pinned where it can be pinned ----
     The store's zero-guard and snapshot wiring are module-private, so they
     are pinned at source level; the backup document path is a one-liner in
     the backend. The rules tests prove the backups subtree's permissions. */
  {
    const { readFileSync } = await import('node:fs');
    const fbSrc = readFileSync(new URL('../js/firebase-backend.js', import.meta.url), 'utf8');
    ok(/writeBackup/.test(fbSrc) && /'backups'/.test(fbSrc),
       'the backend can write users/{uid}/backups/{id}');
    const storeSrc = readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
    ok(/Refusing to overwrite/.test(storeSrc),
       'the store refuses a non-wholesale write of [] over a substantial cached collection');
    ok(storeSrc.includes("snapshotBeforeWipe('pre-clear')")
       && storeSrc.includes("snapshotBeforeWipe('pre-restore')"),
       '⚠️ and BOTH wholesale wipers snapshot to the cloud before touching anything');
    const clearIdx = storeSrc.indexOf("snapshotBeforeWipe('pre-clear')");
    const wipeIdx = storeSrc.indexOf("backend.write(c, [], { wholesale: true })");
    ok(clearIdx > 0 && wipeIdx > 0 && clearIdx < wipeIdx,
       'in that order — the snapshot happens before the first collection is cleared');
  }
}

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

  /* ---- work the rating had to throw away is REPORTED, not silently dropped ----
     The pull-up unlock created a second way for a muscle to be grey, and the
     two are not interchangeable: "log a weigh-in and this starts counting" is
     something a person can act on, and "nobody has measured this exercise" is
     not. Before this the panel said "nothing recorded for this muscle yet" over
     thirty sets of pull-ups, which was true of the rating and a lie about the
     training.                                                                */
  {
    await st.clearAll();
    await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });

    // ⚠️ A weigh-in is logged here on purpose, and the reason is worth knowing:
    // WITHOUT one the map does not render at all. `profile.missing` includes
    // body weight and muscleStrength() returns ready:false, so "you have logged
    // pull-ups but we don't know what you weigh" is unreachable on this screen —
    // by the time there is a panel to read, every bodyweight exercise with a
    // published fraction is already counting. That message reaches the user on
    // the GRAPH instead, which has no profile gate. The blocked list on the map
    // therefore only ever carries the PERMANENT kind.
    await st.logBodyWeight(180, '2026-08-01');

    const pullId = BUILT_IN_EXERCISES.find((e) => e.name === 'Pull-Up').id;
    const invId = BUILT_IN_EXERCISES.find((e) => e.name === 'Inverted Row').id;
    await st.saveSession({
      workoutId: 'wp', workoutName: 'Pull', date: '2026-08-10',
      entries: [
        { exerciseId: pullId, exerciseName: 'Pull-Up',
          sets: [{ weight: 0, reps: 8 }, { weight: 0, reps: 7 }] },
        // Measured at 37–79 % of body weight depending on bar height, which the
        // app does not record. Permanently unrankable, and it must SAY so
        // rather than disappear.
        { exerciseId: invId, exerciseName: 'Inverted Row',
          sets: [{ reps: 12 }, { reps: 12 }, { reps: 10 }] },
      ],
    });

    const rb = await muscleStrength();
    ok(rb.muscles.has('Back'), 'pull-ups alone rank a muscle once a weigh-in exists');
    const bl = rb.blocked.get('Back');
    ok(Boolean(bl) && bl.sets === 3,
       `and the three inverted-row sets are reported rather than vanishing (${bl && bl.sets})`);
    ok(bl && !bl.fixable && /never been measured/.test(bl.exercises[0].reason),
       'named as the permanent kind, so no button promises a fix that does not exist');
    ok(bl && bl.exercises.every((e) => e.name !== 'Pull-Up'),
       'and the pull-ups are NOT in that list — they counted');

    // Vacuity guard. Without it the assertions above would pass just as well
    // over a rating that had quietly stopped admitting bodyweight work at all.
    const backOnly = rb.muscles.get('Back');
    ok(backOnly.contributors.some((c) => /Pull-Up/.test(c.exerciseName)),
       'the pull-up is genuinely among the evidence, not merely absent from the blocked list');
  }

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

/* ========= the observation walk is a module, and is pinned to the number =========
   `muscleStrength()` used to hold the walk that turns stored sets into evidence.
   It now calls js/strength-observations.js, so a FRIEND's rating can be computed
   the same way from rows this store never held. The extraction was supposed to
   change NOTHING, and "supposed to" is not a test — so the demo account's
   generated year is scored here and the numbers are written down.

   ⚠️ `today` is passed IN, which is the whole reason this can be a golden table
   at all. The old walk read the clock, so the same history scored differently
   every morning and nothing about it could be pinned. If these numbers move,
   something about how a set becomes evidence moved with them — the D5 gate, the
   body-weight-of-the-day rule, the prior-volume term or a ratio in
   muscle-evidence.js — and that is a decision, not a refactor.               */
{
  const { store: st, muscleStrength } = await import('../js/store.js');
  const { buildDemoData } = await import('../js/demo.js');
  const { buildObservations } = await import('../js/strength-observations.js');
  const { rateMuscle } = await import('../js/muscle-evidence.js');

  const TODAY = '2026-08-19';
  const demo = buildDemoData({ today: TODAY, units: 'lbs', theme: 'dark', palette: 'gold' });
  const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
  const args = {
    sessions: demo.sessions, benchmarks: demo.benchmarks, exMap,
    bodyWeights: demo.bodyWeight, today: TODAY,
  };
  const { byMuscle, blocked } = buildObservations(args);

  // muscle, observations, estimate, confidence, contributors, exercises —
  // captured from the walk as it stood inside store.js, before it moved.
  const GOLDEN = [
    ['Back', 720, 208.3807, 0.7798, 214, 4],
    ['Biceps', 1095, 109.9027, 0.6448, 125, 2],
    ['Calves', 332, 264.9498, 0.8707, 84, 2],
    ['Chest', 465, 238.7469, 0.9063, 129, 2],
    ['Forearms', 1095, 104.5091, 0.4832, 339, 6],
    ['Glutes', 630, 380.5382, 0.7628, 66, 1],
    ['Hamstrings', 882, 272.5143, 0.8855, 146, 3],
    ['Quads', 563, 323.3257, 0.8985, 170, 4],
    ['Shoulders', 1076, 142.6966, 0.7895, 191, 4],
    ['Traps', 720, 238.7407, 0.5526, 214, 4],
    ['Triceps', 1100, 168.1443, 0.4935, 125, 2],
  ];
  ok(byMuscle.size === GOLDEN.length,
     `the demo year is evidence for ${GOLDEN.length} muscles (${byMuscle.size})`);
  let goldenOk = true, firstBad = '';
  for (const [muscle, count, est, conf, contributors, exercises] of GOLDEN) {
    const obs = byMuscle.get(muscle) || [];
    const rating = rateMuscle(obs);
    const bad = !rating
      || obs.length !== count
      || !near(rating.estimate, est, 0.0001)
      || !near(rating.confidence, conf, 0.0001)
      || rating.contributorCount !== contributors
      || rating.exerciseCount !== exercises;
    if (bad && goldenOk) {
      goldenOk = false;
      firstBad = rating
        ? `${muscle}: ${obs.length} obs, est ${rating.estimate.toFixed(4)}, conf `
          + `${rating.confidence.toFixed(4)}, ${rating.contributorCount}/${rating.exerciseCount}`
        : `${muscle}: no rating at all`;
    }
  }
  ok(goldenOk,
     `every muscle scores exactly what it scored before the walk moved out of store.js${goldenOk ? '' : ' — ' + firstBad}`);

  // Vacuity guard: the table above would pass just as well over a walk that had
  // quietly stopped reading sessions, if the numbers had been captured from one.
  ok(byMuscle.get('Chest').some((o) => o.source === 'workout')
     && byMuscle.get('Chest').some((o) => o.source === 'benchmark'),
     'and both sources are genuinely in the evidence, not one of them silently gone');
  ok(byMuscle.get('Chest').some((o) => o.priorVolume > 0),
     'sets that came late in a session carry what the muscle had already taken');

  // Pure, in the sense that matters: same rows in, same numbers out, and the
  // clock is not one of the inputs.
  const again = buildObservations(args);
  ok(JSON.stringify([...again.byMuscle]) === JSON.stringify([...byMuscle]),
     'the same history walked twice produces the identical observations');
  const later = buildObservations({ ...args, today: '2026-09-19' });
  ok(later.byMuscle.get('Chest')[0].ageDays - byMuscle.get('Chest')[0].ageDays === 31,
     'and a different `today` ages it by exactly that many days — nothing reads a clock');

  // The demo year blocks nothing, so the bag needs its own fixture. An inverted
  // row is permanently unrankable — how much body weight it carries depends on
  // bar height, which the app does not record — and must be REPORTED rather
  // than vanishing, beside pull-ups from the same session that counted fine.
  ok(blocked.size === 0, 'the demo year has no unrankable work to report');
  const pullId = BUILT_IN_EXERCISES.find((e) => e.name === 'Pull-Up').id;
  const invId = BUILT_IN_EXERCISES.find((e) => e.name === 'Inverted Row').id;
  const fixture = buildObservations({
    exMap, benchmarks: [], bodyWeights: [{ date: '2026-08-01', weight: 180 }], today: TODAY,
    sessions: [{ date: '2026-08-10', entries: [
      { exerciseId: pullId, exerciseName: 'Pull-Up', sets: [{ weight: 0, reps: 8 }, { weight: 0, reps: 7 }] },
      { exerciseId: invId, exerciseName: 'Inverted Row', sets: [{ reps: 12 }, { reps: 12 }, { reps: 10 }] },
    ] }],
  });
  const bl = fixture.blocked.get('Back');
  ok(Boolean(bl) && bl.sets === 3 && bl.exercises.length === 1
     && bl.exercises[0].name === 'Inverted Row' && !bl.fixable,
     `the three inverted-row sets are reported, and as the permanent kind (${bl && bl.sets})`);
  ok(fixture.byMuscle.get('Back').some((o) => /Pull-Up/.test(o.exerciseName)),
     'while the pull-ups from the same session counted');

  // And the store still reaches the same answer through the module. This is the
  // join the extraction was for: `muscleStrength()` reading MY rows, and a
  // friend's page reading THEIRS, have to be the same arithmetic. Deliberately
  // scored at todayISO() rather than the fixed day above, because that is what
  // the store passes and the agreement must hold on any day the suite runs.
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: demo.settings[0].birthYear, units: 'lbs' });
  for (const b of demo.bodyWeight) await st.logBodyWeight(b.weight, b.date);
  for (const s of demo.sessions) await st.saveSession(s);
  for (const b of demo.benchmarks) await st.saveBenchmark(b);

  const stored = await muscleStrength();
  const direct = buildObservations({
    sessions: await st.getSessions(), benchmarks: await st.getBenchmarks(),
    exMap: await st.getExerciseMap(), bodyWeights: await st.getBodyWeights(),
    today: todayISO(),
  });
  let agree = stored.ready && stored.muscles.size === GOLDEN.length;
  for (const [muscle, v] of stored.muscles) {
    const r = rateMuscle(direct.byMuscle.get(muscle) || []);
    if (!r || !near(r.estimate, v.estimate, 1e-9) || !near(r.confidence, v.confidence, 1e-9)
        || r.contributorCount !== v.contributorCount || r.exerciseCount !== v.exerciseCount) {
      agree = false;
    }
  }
  ok(agree, 'muscleStrength() over the stored year equals the module run over the same rows');

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
    for (const f of fsMod.readdirSync(pathMod.join(up, dir), { withFileTypes: true })) {
      // ⚠️ Files only. `img/exercises/` arrived on 2026-08-30 as a DIRECTORY,
      // and a directory is not an asset — listing it here asked sw.js to
      // precache a folder. Its contents are precached by their own generated
      // block, which the exercise-picture section further down asserts.
      if (!f.isFile()) continue;
      shipped.push(prefix + f.name);
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

  /* ---- COLLECTIONS must agree with firestore.rules ---- */
  // ⚠️ Same shape of trap as the precache list, and worse. `progress.md` has
  // warned in prose since the beginning that a collection added to store.js and
  // not to knownCollection() has every cloud write DENIED while localStorage
  // keeps working — so it looks perfect on the machine it was written on and
  // silently loses data for anyone signed in. It had never been a test. Adding
  // `goals` on 2026-08-19 is what made that gap worth closing rather than
  // re-reading the warning.
  const storeSrc = fsMod.readFileSync(pathMod.join(up, 'js', 'store.js'), 'utf8');
  const rulesSrc = fsMod.readFileSync(pathMod.join(up, 'firestore.rules'), 'utf8');
  const names = (src, re) => {
    const m = src.match(re);
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort() : null;
  };
  const declared = names(storeSrc, /const COLLECTIONS = \[([^\]]*)\]/);
  const allowed = names(rulesSrc, /function knownCollection\(name\) \{\s*return name in \[([^\]]*)\]/);

  ok(declared && declared.length > 0, `store.js declares its collections (${declared && declared.length})`);
  ok(allowed && allowed.length > 0, 'firestore.rules lists the ones it will accept');
  ok(JSON.stringify(declared) === JSON.stringify(allowed),
     declared && allowed && JSON.stringify(declared) !== JSON.stringify(allowed)
       ? `COLLECTIONS and knownCollection() disagree: only in store.js `
         + `[${declared.filter((c) => !allowed.includes(c))}], only in rules `
         + `[${allowed.filter((c) => !declared.includes(c))}]`
       : 'every collection store.js writes is one firestore.rules will accept');

  // Cross-origin must be left alone: Firestore streams over long-polling and
  // the SDK comes from gstatic. Caching either would break sync to no purpose.
  ok(/url\.origin !== self\.location\.origin/.test(sw),
     'sw.js ignores cross-origin requests');
  ok(/req\.method !== 'GET'/.test(sw), 'sw.js never intercepts a write');
}

/* ================= "Compared to:" — the chosen comparison group ================= */
// Tim, 2026-08-17: the user picks who they are ranked against. Three independent
// axes, each defaulting to "like me". The colours, levels and targets all follow.
{
  const me180 = { gender: 'male', bodyWeight: 180, age: 30 };
  const withCompare = (c) => ({ ...me180, compare: c });

  // ---- a bad or missing setting must never throw, and must fall back ----
  for (const junk of [null, undefined, {}, 'nonsense', 42, { sex: 'martian' },
                      { sex: 'all', weight: 'banana' }]) {
    const n = ss.normalizeCompare(junk);
    ok(ss.COMPARE_OPTIONS.sex.some((o) => o.key === n.sex)
       && ss.COMPARE_OPTIONS.weight.some((o) => o.key === n.weight)
       && ss.COMPARE_OPTIONS.age.some((o) => o.key === n.age),
       `a stored comparison of ${JSON.stringify(junk)} degrades to something valid`);
  }
  ok(ss.normalizeCompare({ sex: 'all', weight: 'banana' }).sex === 'all',
     'and a half-valid setting keeps the half that is valid');

  // ---- the default must be exactly what it always was ----
  {
    const before = ss.percentileFor(225, 'Chest', me180);
    const after = ss.percentileFor(225, 'Chest', withCompare(ss.COMPARE_DEFAULT));
    ok(near(before, after, 1e-9), 'the default comparison changes nothing at all');
    ok(near(before, 50, 0.5), `and a 180 lb man benching 225 is still the 50th percentile (${before.toFixed(1)})`);
  }

  // ---- sex ----
  {
    const vsMen = ss.percentileFor(225, 'Chest', withCompare({ sex: 'male' }));
    const vsWomen = ss.percentileFor(225, 'Chest', withCompare({ sex: 'female' }));
    const vsAll = ss.percentileFor(225, 'Chest', withCompare({ sex: 'all' }));
    ok(vsWomen > vsMen, `the same bench ranks higher against women (${vsWomen.toFixed(1)} > ${vsMen.toFixed(1)})`);
    ok(vsAll > vsMen && vsAll < vsWomen,
       `and a mixed population lands between the two (${vsAll.toFixed(1)})`);
    ok(near(ss.percentileFor(225, 'Chest', withCompare({ sex: 'own' })), vsMen, 1e-9),
       'like me resolves to the user own sex');
    const her = { gender: 'female', bodyWeight: 140, age: 30 };
    ok(near(ss.percentileFor(100, 'Chest', { ...her, compare: { sex: 'own' } }),
            ss.percentileFor(100, 'Chest', { ...her, compare: { sex: 'female' } }), 1e-9),
       'and resolves to hers for a woman');
  }

  // The mixture is a real mixture, not a fudged single median: its percentile
  // must equal the share-weighted sum of the two populations' percentiles.
  {
    const v = 260;
    const m = ss.percentileFor(v, 'Chest', withCompare({ sex: 'male' }));
    const f = ss.percentileFor(v, 'Chest', withCompare({ sex: 'female' }));
    const all = ss.percentileFor(v, 'Chest', withCompare({ sex: 'all' }));
    ok(near(all, ss.MALE_SHARE * m + (1 - ss.MALE_SHARE) * f, 1e-6),
       'the combined population is the share-weighted mixture of the two, exactly');
  }

  // ---- body weight ----
  {
    const light = { gender: 'male', bodyWeight: 140, age: 30 };
    const ownWeight = ss.percentileFor(225, 'Chest', { ...light, compare: { weight: 'own' } });
    const anyWeight = ss.percentileFor(225, 'Chest', { ...light, compare: { weight: 'any' } });
    ok(ownWeight > anyWeight,
       `a light lifter ranks higher against his own weight class than against everyone (${ownWeight.toFixed(1)} > ${anyWeight.toFixed(1)})`);
    // "Any body weight" is the unscaled reference standard, not a missing value.
    ok(near(ss.percentileFor(225, 'Chest', { ...light, compare: { weight: 'any' } }),
            ss.percentileFor(225, 'Chest', { gender: 'male', bodyWeight: 180, age: 30 }), 1e-9),
       'and "any body weight" is exactly the reference standard, unscaled');
    const heavy = { gender: 'male', bodyWeight: 260, age: 30 };
    ok(ss.percentileFor(225, 'Chest', { ...heavy, compare: { weight: 'any' } })
       > ss.percentileFor(225, 'Chest', { ...heavy, compare: { weight: 'own' } }),
       'and a heavy lifter ranks higher once body weight stops being held against him');
  }

  // ---- age ----
  {
    const older = { gender: 'male', bodyWeight: 180, age: 62 };
    const graded = ss.percentileFor(225, 'Chest', { ...older, compare: { age: 'own' } });
    const ungraded = ss.percentileFor(225, 'Chest', { ...older, compare: { age: 'any' } });
    ok(graded > ungraded,
       `age grading helps a 62-year-old, and turning it off costs him (${graded.toFixed(1)} > ${ungraded.toFixed(1)})`);
    const prime = { gender: 'male', bodyWeight: 180, age: 30 };
    ok(near(ss.percentileFor(225, 'Chest', { ...prime, compare: { age: 'own' } }),
            ss.percentileFor(225, 'Chest', { ...prime, compare: { age: 'any' } }), 1e-9),
       'and it makes no difference at all in the 23–40 prime, where the coefficient is 1');
  }

  // ---- axes are independent ----
  {
    const both = ss.percentileFor(225, 'Chest', withCompare({ sex: 'female', weight: 'any' }));
    ok(Number.isFinite(both) && both > 0 && both < 100,
       'two axes can be changed at once and still produce a real percentile');
  }

/* ---- the population axis: people who lift, or everyone ---- */
// Tim, 2026-08-17, restructuring the first cut into four axes plus two presets.
// This is the one that touches D15 — "everyone" now RE-TIERS rather than being a
// footnote — so it is the one that needs the most holding to account.
{
  const me180 = { gender: 'male', bodyWeight: 180, age: 30 };
  const withCompare = (c) => ({ ...me180, compare: c });

  ok(ss.normalizeCompare({}).pool === 'lifters',
     'the default population is people who lift — the stricter comparison, not the flattering one');

  const vsLifters = ss.percentileFor(225, 'Chest', withCompare({ pool: 'lifters', sex: 'male' }));
  const vsEveryone = ss.percentileFor(225, 'Chest', withCompare({ pool: 'everyone', sex: 'male' }));
  ok(vsEveryone > vsLifters,
     `including people who do not lift raises the placing (${vsEveryone.toFixed(1)} > ${vsLifters.toFixed(1)})`);

  // THE D15 CHECK, stated as a test rather than as a warning in a comment.
  // The old general-population model assumed every non-lifter was weaker than
  // every lifter, which forced anyone who lifts at all above the 68th percentile
  // and squashed seven levels into three. Untrained adults now have their own
  // overlapping distribution, so the levels have to keep SPREADING.
  {
    const everyone = { pool: 'everyone', sex: 'all', weight: 'any', age: 'any' };
    const beginner = ss.weightForPercentile(5, 'Chest', withCompare({ pool: 'lifters', sex: 'male' }));
    const median = ss.weightForPercentile(50, 'Chest', withCompare({ pool: 'lifters', sex: 'male' }));
    const elite = ss.weightForPercentile(95, 'Chest', withCompare({ pool: 'lifters', sex: 'male' }));

    const lvB = ss.levelFor(ss.percentileFor(beginner, 'Chest', withCompare(everyone)));
    const lvM = ss.levelFor(ss.percentileFor(median, 'Chest', withCompare(everyone)));
    const lvE = ss.levelFor(ss.percentileFor(elite, 'Chest', withCompare(everyone)));

    ok(lvB && lvM && lvE, 'all three reference lifters still get a level against everyone');
    ok(lvB.percentile < lvM.percentile && lvM.percentile < lvE.percentile,
       `the levels still separate beginner/median/elite against everyone (${lvB.name} < ${lvM.name} < ${lvE.name})`);
    ok(lvB.key !== 'elite',
       `a beginner lifter does NOT read Elite against the general population (${lvB.name}) — the whole D15 objection`);
    const spread = ss.percentileFor(elite, 'Chest', withCompare(everyone))
      - ss.percentileFor(beginner, 'Chest', withCompare(everyone));
    ok(spread > 25,
       `and the percentile range across lifters stays wide (${spread.toFixed(1)} points, old model gave under 29)`);
  }

  // An untrained population must be WEAKER than a trained one, never stronger.
  ok(ss.weightForPercentile(50, 'Chest', withCompare({ pool: 'everyone', sex: 'male' }))
     < ss.weightForPercentile(50, 'Chest', withCompare({ pool: 'lifters', sex: 'male' })),
     'the median of everyone is below the median of people who lift');

  // The mixture identity holds on this axis too.
  {
    const v = 200;
    const all = ss.percentileFor(v, 'Chest', withCompare({ pool: 'everyone', sex: 'male' }));
    ok(all > 0 && all < 100 && Number.isFinite(all), 'the everyone mixture produces a real percentile');
    ok(all > ss.percentileFor(v, 'Chest', withCompare({ pool: 'lifters', sex: 'male' })),
       'and always sits above the lifters-only reading for the same weight');
  }

  /* ---- presets ---- */
  {
    const likeMe = ss.comparePreset('like-me', me180);
    ok(likeMe.pool === 'lifters' && likeMe.sex === 'male'
       && likeMe.weight === 'own' && likeMe.age === 'own',
       'the "Like me" preset is lifters of my sex, weight and age');
    const her = { gender: 'female', bodyWeight: 140, age: 30 };
    ok(ss.comparePreset('like-me', her).sex === 'female', 'and follows the user’s own sex');

    const everyone = ss.comparePreset('everyone', me180);
    ok(everyone.pool === 'everyone' && everyone.sex === 'all'
       && everyone.weight === 'any' && everyone.age === 'any',
       'the "Everyone" preset opens every axis at once');

    ok(ss.matchesPreset(likeMe, 'like-me', me180), 'a preset recognises itself');
    ok(!ss.matchesPreset(likeMe, 'everyone', me180), 'and does not recognise the other one');
    // The unset default IS "like me", so a new user sees that preset lit up
    // rather than neither of them.
    ok(ss.matchesPreset(ss.COMPARE_DEFAULT, 'like-me', me180),
       'a user who has never opened the sheet is already on "Like me"');
    ok(!ss.matchesPreset({ ...likeMe, weight: 'any' }, 'like-me', me180),
       'and changing one axis takes you off the preset');
  }

  /* ---- "People like me" is gone as a visible option ---- */
  ok(!ss.COMPARE_OPTIONS.sex.some((o) => !o.hidden && o.key === 'own'),
     '"my sex" is not offered as a choice — it is the stored default only');
  ok(ss.COMPARE_OPTIONS.sex.filter((o) => !o.hidden).map((o) => o.key).join() === 'male,female,all',
     'the sex axis offers exactly men, women and both');
  ok(ss.COMPARE_OPTIONS.pool.map((o) => o.key).join() === 'lifters,everyone',
     'and the population axis offers exactly lifters and everyone');

  /* ---- the label must carry the population every time ---- */
  for (const sex of ['male', 'female', 'all']) {
    for (const weight of ['own', 'any']) {
      for (const age of ['own', 'any']) {
        const lifters = ss.comparisonLabel(withCompare({ pool: 'lifters', sex, weight, age }));
        ok(/lifts?\b/i.test(lifters.main),
           `lifters/${sex}/${weight}/${age} says so in words ("${lifters.main}")`);

        const everyone = ss.comparisonLabel(withCompare({ pool: 'everyone', sex, weight, age }));
        ok(!/lifts?\b/i.test(everyone.main),
           `everyone/${sex}/${weight}/${age} must NOT claim a lifting population ("${everyone.main}")`);
        ok(/\ball\b/i.test(everyone.main),
           `and says it is all of them ("${everyone.main}")`);
        ok(everyone.pool === 'everyone', 'and reports which pool it used, for the panel caveat');
      }
    }
  }

  /* ---- the round trip, across every combination of all FOUR axes ---- */
  for (const pool of ['lifters', 'everyone']) {
    for (const sex of ['own', 'male', 'female', 'all']) {
      for (const weight of ['own', 'any']) {
        for (const age of ['own', 'any']) {
          const prof = withCompare({ pool, sex, weight, age });
          let worst = 0;
          let rising = true;
          let prev = 0;
          for (const lv of ss.LEVELS) {
            const w = ss.weightForPercentile(lv.percentile, 'Chest', prof);
            if (!(w > prev)) rising = false;
            prev = w;
            worst = Math.max(worst, Math.abs(ss.percentileFor(w, 'Chest', prof) - lv.percentile));
          }
          ok(worst < 1e-4,
             `${pool}/${sex}/${weight}/${age}: targets round-trip (${worst.toExponential(1)})`);
          ok(rising, `${pool}/${sex}/${weight}/${age}: targets rise with level`);
        }
      }
    }
  }
}


  // ---- the round trip has to hold for EVERY combination ----
  // levelFor() and the targets panel are held together by this: hitting the
  // weight the panel asks for must grant the level. A mixture has no closed-form
  // inverse, so this is the check that its bisection is good enough.
  for (const sex of ['own', 'male', 'female', 'all']) {
    for (const weight of ['own', 'any']) {
      for (const age of ['own', 'any']) {
        const prof = withCompare({ sex, weight, age });
        let worst = 0;
        for (const lv of ss.LEVELS) {
          const w = ss.weightForPercentile(lv.percentile, 'Chest', prof);
          const back = ss.percentileFor(w, 'Chest', prof);
          worst = Math.max(worst, Math.abs(back - lv.percentile));
          const level = ss.levelFor(back);
          ok(Boolean(level) && level.percentile >= lv.percentile - 1e-6,
             `${sex}/${weight}/${age}: hitting the ${lv.name} target actually grants ${lv.name}`);
        }
        ok(worst < 1e-4,
           `${sex}/${weight}/${age}: percentile round-trips to within 1e-4 (${worst.toExponential(1)})`);
      }
    }
  }

  // Targets must still rise with level under every comparison, or the panel
  // would list a harder level as needing less weight.
  for (const sex of ['own', 'male', 'female', 'all']) {
    const prof = withCompare({ sex });
    let rising = true;
    let prev = 0;
    for (const lv of ss.LEVELS) {
      const w = ss.weightForPercentile(lv.percentile, 'Chest', prof);
      if (!(w > prev)) rising = false;
      prev = w;
    }
    ok(rising, `targets increase with every level under sex=${sex}`);
  }

  // ---- the label ----
  // D15's rule survives the new setting: whatever group is chosen, the words on
  // screen say it is people who LIFT. The general-population figure stays a
  // separate, clearly-labelled readout.
  for (const sex of ['own', 'male', 'female', 'all']) {
    for (const weight of ['own', 'any']) {
      for (const age of ['own', 'any']) {
        const label = ss.comparisonLabel(withCompare({ sex, weight, age }));
        ok(/lifts?\b/i.test(label.main),
           `the caption for ${sex}/${weight}/${age} names a population that lifts ("${label.main}")`);
        ok(label.sub.length > 0, `and states the weight and age basis ("${label.sub}")`);
      }
    }
  }
  ok(ss.comparisonLabel(withCompare(ss.COMPARE_DEFAULT)).isDefault,
     'the default comparison knows it is the default');
  ok(!ss.comparisonLabel(withCompare({ sex: 'all' })).isDefault,
     'and a changed one knows it is not');
  ok(/any body weight/i.test(ss.comparisonLabel(withCompare({ weight: 'any' })).sub),
     'ignoring body weight is stated in words, never left implied');
  ok(/any age/i.test(ss.comparisonLabel(withCompare({ age: 'any' })).sub),
     'and so is ignoring age');
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

  // ---- the 2026-08-26 ratio sweep (0h) ----
  // Every pinned number below was DERIVED from Strength Level's published
  // 180 lb male standards (the derivation is a comment on each entry in
  // muscle-evidence.js). Reverting any entry to its old reasoned value flips
  // its line here — that is the point: these stopped being opinions.
  {
    const ratioOf = (name, muscle) => {
      const hit = me.contributionsFor(byName(name)).find((x) => x.muscle === muscle && x.kind === 'direct');
      return hit ? hit.ratio : null;
    };
    const pinned = [
      ['Pec Deck', 'Chest', 0.90],            // was 0.55 — the sweep's worst flatter
      // 2026-08-27: SL incline dumbbell press 49/66/88/113/139 doubled over
      // bench 127/169/220/277/339 → 0.772-0.820, median 0.800. Was a carried
      // 0.70. ⚠️ The flattest ratio in the table (1.1x across five levels),
      // which is why this is the one entry whose q went UP.
      ['Incline Dumbbell Bench Press', 'Chest', 0.80],
      ['Close-Grip Bench Press', 'Chest', 0.95],
      ['Machine Chest Press', 'Chest', 0.91],
      ['Lat Pulldown', 'Back', 0.95],
      ['Seated Cable Row', 'Back', 0.98],
      ['Deadlift', 'Back', 1.76],
      ['Sumo Deadlift', 'Back', 1.97],
      ['Rack Pull', 'Back', 2.10],
      ['Good Morning', 'Back', 0.95],
      ['Leg Press', 'Quads', 1.73],           // ran the OTHER way — was under-crediting
      ['Leg Extension', 'Quads', 0.78],
      ['Lying Leg Curl', 'Hamstrings', 0.53],
      ['Hip Thrust', 'Glutes', 0.96],         // the other way too
      ['Machine Shoulder Press', 'Shoulders', 1.23],
      ['Upright Row', 'Shoulders', 0.94],
      ['Face Pull', 'Shoulders', 0.75],       // split out of the 0.30 raise family
      ['Hammer Curl', 'Biceps', 1.04],
      ['Concentration Curl', 'Biceps', 0.92], // was 0.62 — the family's biggest flatter
      ['Preacher Curl', 'Biceps', 0.96],
      ['Cable Curl', 'Biceps', 1.11],
      ['Triceps Pushdown', 'Triceps', 0.61],
      ['Dumbbell Shrug', 'Traps', 0.70],      // the third counter-direction entry
      ['Seated Calf Raise', 'Calves', 0.66],
    ];
    for (const [name, muscle, want] of pinned) {
      const got = ratioOf(name, muscle);
      ok(got === want, `${name} → ${muscle} is the sourced ${want} (${got})`);
    }

    // Orderings the corrections must not have broken — each pair is a claim
    // about the world, not about the table.
    const lt = (a, am, b, bm, msg) => ok(ratioOf(a, am) < ratioOf(b, bm), msg);
    const qualityOf = (name, muscle) => {
      const hit = me.contributionsFor(byName(name)).find((x) => x.muscle === muscle && x.kind === 'direct');
      return hit ? hit.quality : null;
    };
    lt('Deadlift', 'Back', 'Sumo Deadlift', 'Back',
       'sumo moves more weight than conventional for the same person');
    lt('Sumo Deadlift', 'Back', 'Rack Pull', 'Back',
       'and a part-range rack pull more than either');
    lt('Dumbbell Curl', 'Biceps', 'Hammer Curl', 'Biceps',
       'a neutral grip is stronger than a supinated one — now by measurement');
    lt('Seated Calf Raise', 'Calves', 'Standing Calf Raise', 'Calves',
       'a bent knee takes gastrocnemius out, so the seated load is lower');
    lt('Single-Leg Extension', 'Quads', 'Leg Extension', 'Quads',
       'one leg moves less than two');
    lt('Face Pull', 'Shoulders', 'Overhead Press', 'Shoulders',
       'a face pull is still lighter work than a press');
    // ⚠️ THE RAISE FAMILY IS SOURCED SINCE 2026-08-27 and 0.30 was flattering
    // every raise by about 80 %. SL per-dumbbell figures at a 180 lb male,
    // doubled, over OHP 75/104/140/181/226 — the same technique as the rest of
    // the sweep. A revert of any of these three flips its own line.
    ok(ratioOf('Lateral Raise', 'Shoulders') === 0.53,
       'lateral raise 0.53 — SL 12/22/37/55/76 doubled over OHP, median of five');
    ok(ratioOf('Front Raise', 'Shoulders') === 0.54,
       'front raise 0.54 — SL 10/22/38/60/86');
    ok(ratioOf('Rear Delt Fly', 'Shoulders') === 0.56,
       'rear delt fly 0.56 — SL 8/20/39/64/94');
    // ⚠️ The ordering that has to survive: a raise is still a fraction of a
    // press, which is what stops 40 lb of lateral raise reading as a big press.
    lt('Lateral Raise', 'Shoulders', 'Overhead Press', 'Shoulders',
       'and a raise is still much lighter work than the press it converts to');
    // ⚠️ q does NOT rise on any of them despite the sourcing, because the five
    // per-level ratios sweep 2-4x — there is no population constant to find.
    ok(qualityOf('Rear Delt Fly', 'Shoulders') <= qualityOf('Lateral Raise', 'Shoulders'),
       'the rear delt fly drifts most across the levels, so it is trusted least');
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
  // the muscle, so with no body weight in hand it cannot be converted at all.
  ok(me.contributionsFor(byName('Pull-Up')).length === 0, 'bodyweight work is not rated');
  // ⚠️ Same correction as canNormalize above: this passes because no body weight
  // was passed, NOT because assisted work is unrankable. It stopped being
  // unrankable on 2026-08-24.
  ok(me.contributionsFor(byName('Assisted Pull-Up')).length === 0,
     'and neither is assisted work, until a weigh-in makes the subtraction possible');
  ok(me.contributionsFor(byName('Assisted Pull-Up'), { bodyWeight: 180 }).length > 0,
     '⚠️ …which it then does — the assist machine rates a muscle off resistance, not off the stack');

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

  /* ================================================================== *
   * ⚠️ CREDIBILITY, NOT SIZE — the bug the demo account exposed
   *
   * These are the tests that were missing. Every assertion above uses three
   * DIFFERENT exerciseIds with estimates a couple of pounds apart, so neither
   * half of the fault could ever show: not one exercise filling every slot, and
   * not a flattering conversion outvoting a credible one. 1051 assertions ran
   * green over both for two months.
   * ================================================================== */

  // The shoulders case, reduced to its bones. A face pull at the top of the
  // rankable rep range converts to a far bigger overhead press than the press
  // itself measures — and it is worth a sixteenth as much. The press has to win.
  const inversion = me.rateMuscle([
    obs({ estimate: 145, quality: 1.00, reps: 3, exerciseId: 'press', isBenchmark: true }),
    obs({ estimate: 324, quality: 0.25, reps: 15, exerciseId: 'facepull', date: '2026-08-16' }),
    obs({ estimate: 320, quality: 0.25, reps: 15, exerciseId: 'facepull', date: '2026-08-15' }),
    obs({ estimate: 318, quality: 0.25, reps: 15, exerciseId: 'facepull', date: '2026-08-14' }),
  ]);
  ok(inversion.used[0].exerciseId === 'press',
     'the most CREDIBLE observation leads the rating, not the biggest one');
  ok(inversion.estimate < 200,
     `so a 145 lb press is not rated 300 by a face pull (${Math.round(inversion.estimate)} lb)`);
  ok(inversion.estimate > 145,
     'though the raise still counts for something — it is weighted down, not thrown away');

  // The other half: one exercise may not occupy every seat. The whole reason
  // for averaging three is to cancel error in any one ratio, and three readings
  // of the same exercise cancel nothing.
  const crowded = me.rateMuscle([
    obs({ estimate: 300, quality: 0.3, exerciseId: 'iso', date: '2026-08-17' }),
    obs({ estimate: 299, quality: 0.3, exerciseId: 'iso', date: '2026-08-16' }),
    obs({ estimate: 298, quality: 0.3, exerciseId: 'iso', date: '2026-08-15' }),
    obs({ estimate: 200, quality: 1.0, exerciseId: 'key' }),
  ]);
  ok(new Set(crowded.used.map((u) => u.exerciseId)).size === crowded.used.length,
     'no exercise appears twice among the observations that set the rating');
  ok(crowded.used.some((u) => u.exerciseId === 'key'),
     'and an exercise cannot be crowded out by another one logged on more days');
  ok(crowded.exerciseCount === 2, 'the rating says how many different exercises had a say');

  // ⚠️ Repetition is not corroboration, and it used to read as though it were:
  // the agreement term compared an exercise against itself, found perfect
  // agreement, and pushed confidence UP for having no second opinion at all.
  const oneLiftManyDays = me.rateMuscle([
    obs({ estimate: 200, quality: 1, exerciseId: 'a', date: '2026-08-17' }),
    obs({ estimate: 200, quality: 1, exerciseId: 'a', date: '2026-08-16' }),
    obs({ estimate: 200, quality: 1, exerciseId: 'a', date: '2026-08-15' }),
  ]);
  const threeLifts = me.rateMuscle([
    obs({ estimate: 200, quality: 1, exerciseId: 'a' }),
    obs({ estimate: 200, quality: 1, exerciseId: 'b' }),
    obs({ estimate: 200, quality: 1, exerciseId: 'c' }),
  ]);
  ok(threeLifts.confidence > oneLiftManyDays.confidence,
     `three exercises agreeing beats one exercise repeated (${threeLifts.confidence.toFixed(2)} > ${oneLiftManyDays.confidence.toFixed(2)})`);
  ok(oneLiftManyDays.exerciseCount === 1 && oneLiftManyDays.contributorCount === 3,
     'while still reporting three sessions of one exercise as exactly that');

  // Depth means "how much evidence is there", so it has to count the sessions
  // that did not make the top three. Somebody who has squatted forty times
  // knows more about their squat than somebody who squatted once.
  const manyDays = me.rateMuscle(Array.from({ length: 40 }, (_, i) =>
    obs({ estimate: 200, quality: 1, exerciseId: 'a', date: `2026-0${1 + (i % 9)}-0${1 + (i % 9)}` })));
  const oneDayOnly = me.rateMuscle([obs({ estimate: 200, quality: 1, exerciseId: 'a' })]);
  ok(manyDays.confidence > oneDayOnly.confidence,
     `a long history of one lift beats a single session of it (${manyDays.confidence.toFixed(2)} > ${oneDayOnly.confidence.toFixed(2)})`);

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

/* ================= the dumbbell row ratio, now sourced ================= *
 *
 * ⚠️ 0.85 until 2026-08-24, and it inflated every dumbbell row by ~15 %. A
 * SMALLER ratio makes the estimate BIGGER, which is the direction that flatters,
 * and it was the second half of the answer to Tim's "are my lats really this
 * weak" — one of his three back lifts was reading too high.
 *
 * Derived from Strength Level at a 180 lb male, dumbbell row published PER
 * DUMBBELL and doubled, over the same five barbell row numbers the pull-up
 * entry already uses: 88/108, 134/149, 194/198, 264/255, 342/315 -> median 0.98.
 */
{
  const me2 = await import('../js/muscle-evidence.js');
  const dbRow = me2.contributionsFor(byName('Dumbbell Row')).find((c) => c.muscle === 'Back');
  ok(dbRow && near(dbRow.ratio, 0.98),
     `⚠️ a dumbbell row converts at 0.98 of a barbell row, from published standards (${dbRow && dbRow.ratio})`);
  // ⚠️ ORDERING, which is what let this entry move on its own. A chest-supported
  // row removes the torso english, so less weight moves and its ratio must stay
  // BELOW the free version. If somebody re-derives that one, this catches a
  // crossover rather than letting the family quietly invert.
  const csRow = me2.contributionsFor(byName('Chest-Supported Dumbbell Row')).find((c) => c.muscle === 'Back');
  ok(csRow && csRow.ratio < dbRow.ratio,
     'and a chest-supported row still sits below it, because bracing costs you weight');
  // The direction of the whole conversion, stated once so it cannot be inverted
  // by accident — this is the mistake that once produced a 429 lb wrist curl.
  ok(me2.contributionsFor(byName('Barbell Row')).find((c) => c.muscle === 'Back').ratio === 1.00,
     'while the key lift itself is 1.00 by definition');

  /* ⚠️ THE REST OF THE PER-SIDE DUMBBELL SWEEP, 2026-08-24. Three more anchors
     derived the same way, all reasoned too LOW, all therefore inflating their
     lifter — the estimate divides by the ratio.

       dumbbell bench press   0.72 -> 0.81   (43,64,89,119,152)x2 / (127,169,220,277,339)
       dumbbell shoulder press 0.88 -> 1.01  (34,50,71,94,120)x2 / (75,104,140,181,226)
       dumbbell curl          0.88 -> 0.94   (19,32,49,71,95)x2 / (49,73,104,140,180)

     ⚠️ 7 %, 12 % and 15 % — NOT a constant offset, which is the finding that
     matters most here: no blanket correction would have fixed this table, and
     every remaining reasoned entry has to be derived on its own. */
  const ratio = (name, muscle) => {
    const c = me2.contributionsFor(byName(name)).find((x) => x.muscle === muscle);
    return c ? c.ratio : null;
  };
  ok(near(ratio('Dumbbell Bench Press', 'Chest'), 0.81), 'a dumbbell bench converts at 0.81 of a barbell bench');
  ok(near(ratio('Dumbbell Shoulder Press', 'Shoulders'), 1.01),
     '⚠️ and a dumbbell shoulder press ABOVE 1.00 — two dumbbells outweigh the bar most people press');
  ok(near(ratio('Dumbbell Curl', 'Biceps'), 0.94), 'and a dumbbell curl at 0.94 of a barbell curl');

  /* ⚠️ THE LAST FOUR NAMES ON 0h, DERIVED 2026-08-28. Same technique, same
     population, same 180 lb male. All three that could be derived had been
     CARRIED across a corrected anchor rather than measured:

       decline dumbbell bench  0.86 -> 0.76  (36,57,84,117,153)x2 / bench
       seated dumbbell press   0.98 -> 1.08  (40,56,76,98,122)x2  / OHP
       Arnold press            0.90 -> 0.77  (23,37,54,75,98)x2   / OHP

     Spider curl is closed as NOT DERIVABLE: SL's table is for the barbell
     version and this library's lift is a dumbbell one.

     ⚠️ THE ASSERTION BELOW USED TO SAY THE OPPOSITE, AND THAT IS THE POINT.
     It read "decline still allows MORE than flat — the inversion the anchor
     move would have created", pinning an ORDERING that had been reasoned from
     "a decline moves more load". True of a barbell (Decline Barbell is 1.03
     against a flat 1.00, and that still holds below). False of dumbbells,
     because what caps a heavy decline dumbbell press is getting the bells
     into position. The measurement puts decline below flat at every level but
     elite. A test that encodes an argument rather than a measurement will
     defend the argument — this one did, for four days. */
  ok(near(ratio('Decline Dumbbell Bench Press', 'Chest'), 0.76),
     'decline dumbbell bench is 0.76, measured — the 0.86 it carried was reasoned');
  ok(ratio('Decline Dumbbell Bench Press', 'Chest') < ratio('Dumbbell Bench Press', 'Chest'),
     '⚠️ and it sits BELOW flat, which is what the source says and what the old assertion denied');
  ok(ratio('Decline Barbell Bench Press', 'Chest') > ratio('Barbell Bench Press', 'Chest'),
     'while the BARBELL decline still sits above its flat press — the mechanism was real, just not transferable');
  ok(ratio('Incline Dumbbell Bench Press', 'Chest') < ratio('Dumbbell Bench Press', 'Chest'),
     'and incline still allows less');

  ok(near(ratio('Seated Dumbbell Shoulder Press', 'Shoulders'), 1.08),
     'a seated dumbbell press is 1.08, measured');
  ok(ratio('Seated Dumbbell Shoulder Press', 'Shoulders') > ratio('Dumbbell Shoulder Press', 'Shoulders'),
     '⚠️ ABOVE standing — a bench takes out the legs and the bracing, so the same bells imply a smaller press');
  ok(near(ratio('Arnold Press', 'Shoulders'), 0.77), 'and an Arnold press is 0.77');
  ok(ratio('Arnold Press', 'Shoulders') < ratio('Dumbbell Shoulder Press', 'Shoulders'),
     'still below a straight dumbbell press, because the rotation costs you weight');

  ok(ratio('Hammer Curl', 'Biceps') > ratio('Dumbbell Curl', 'Biceps'),
     'and a neutral grip still allows more than a supinated one');

  // ⚠️ THE DIRECTION OF THE WHOLE CLASS OF ERROR, pinned once. Every reasoned
  // per-side dumbbell ratio checked so far was too LOW, and too low flatters.
  // If a later session "corrects" one downward, this is the sentence to reread.
  for (const [n, m] of [['Dumbbell Row', 'Back'], ['Dumbbell Bench Press', 'Chest'],
                        ['Dumbbell Shoulder Press', 'Shoulders'], ['Dumbbell Curl', 'Biceps']]) {
    ok(ratio(n, m) >= 0.80,
       `${n} converts at ${ratio(n, m)} — every measured per-side anchor sits far above the guesses they replaced`);
  }
}

/* ================= a custom exercise cannot set a level (2026-08-31) =========
 *
 * Tim's friend could not find a dip machine, made a custom exercise, filed it
 * under Triceps and logged 60 lbs × 10. The app rated her triceps ADVANCED, off
 * a ratio guessed from the equipment dropdown, beside a column of Beginners.
 *
 * Tim: *"expand the library of exercises instead of trying to calculate the
 * input of a custom exercise. Still allow the user to create a custom lift, but
 * don't let it contribute to the score."*
 *
 * 🚨 THE ARITHMETIC IS REPRODUCED HERE rather than described, because the number
 * is the whole argument: 90.9 e1RM ÷ a guessed 0.80 = 113.6 lbs of "close-grip
 * bench press" against a female median of 85.
 */
{
  const me3 = await import('../js/muscle-evidence.js');
  const { makeCustomExercise } = await import('../js/exercises.js');
  const custom = makeCustomExercise({ name: 'Dip Machine', muscle: 'Triceps', equipment: 'Machine' });

  ok(me3.contributionsFor(custom).length === 0,
     '🚨 a custom exercise contributes NOTHING to any muscle rating — the equipment dropdown is '
     + 'not a measurement, and "Machine" cannot tell an assisted dip machine from a plate-loaded one');

  // ⚠️ AND IT CANNOT BE TALKED INTO ONE BY ITS NAME EITHER. The refusal is at
  // the top of buildContributions() precisely so the key-lift branch — which
  // awards ratio 1.00 at quality 1.00, the strongest evidence the app holds —
  // cannot match a custom exercise somebody named after a real lift.
  const impostor = makeCustomExercise({ name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell' });
  ok(me3.contributionsFor(impostor).length === 0,
     '🚨 not even one NAMED after a key lift — that path is ratio 1.00 at quality 1.00');

  ok(/your own exercise/.test(me3.rankBlockedReason(custom) || ''),
     '⚠️ and the panel SAYS why rather than letting the sets vanish — "nothing recorded" over work '
     + 'somebody did is the fault the blocked list exists to end');
  ok(/volume/.test(me3.rankBlockedReason(custom) || ''),
     'and says what it still counts toward, because it is not being ignored');

  /* 🚨 NO LIBRARY EXERCISE IS SILENT. This is the assertion that found the
   * original six — Larsen Press, Cable Press Around, Kroc Row, Cross-Body Cable
   * Triceps Extension, Wrist Roller and Banded Hip Abduction all matched no
   * ratio rule, contributed nothing, and said nothing about it. Four now have
   * ratios and two have explanations. Any exercise added later either converts
   * or says why not; it can no longer do neither. */
  const { MUSCLE_LIFTS: LIFTS } = await import('../js/strength-standards.js');
  const silent = BUILT_IN_EXERCISES.filter((e) => {
    if (!LIFTS[e.muscle]) return false;                     // Core, Cardio: never rated
    if (me3.contributionsFor(e, { bodyWeight: 180, bodyWeightQuality: 1 }).length) return false;
    return !me3.rankBlockedReason(e, { bodyWeight: 180 });
  }).map((e) => e.name);
  ok(silent.length === 0,
     silent.length
       ? `🚨 these contribute nothing AND explain nothing: ${silent.join(', ')}`
       : 'every rankable library exercise either converts to its key lift or says why it cannot');
}

/* ================= the library expansion (2026-08-31) =================
 *
 * Tim: *"Could you look into all the potential exercises you might've missed and
 * add them to the library?"* — prompted by the dip machine his friend went
 * looking for and did not find.
 */
{
  const me4 = await import('../js/muscle-evidence.js');
  const { BODY_WEIGHT_FRACTION } = await import('../js/exercises.js');
  const { totalResistance } = await import('../js/e1rm.js');
  const ratioOf = (name, muscle) => {
    const c = me4.contributionsFor(byName(name), { bodyWeight: 180, bodyWeightQuality: 1 })
      .find((x) => x.muscle === muscle);
    return c ? c.ratio : null;
  };

  ok(BUILT_IN_EXERCISES.length >= 315,
     `${BUILT_IN_EXERCISES.length} exercises in the library, up from 275`);

  /* ---- the two dip machines, which are NOT the same thing ---- */
  ok(Boolean(byName('Assisted Dip')) && Boolean(byName('Machine Dip')),
     'both dip machines exist now — the assisted one and the seated stack');
  const dip = byName('Assisted Dip');
  const light = totalResistance(dip, 20, 180);
  const heavy = totalResistance(dip, 100, 180);
  ok(light && heavy && heavy.load < light.load,
     `🚨 MORE ON THE STACK IS A LIGHTER SET on the assisted dip (${light.load} → ${heavy.load} lbs) — `
     + 'the assist flag inverts the sign, which is the whole reason it needed a table entry rather '
     + 'than a library row');
  ok(near(ratioOf('Assisted Dip', 'Chest'), 1.35),
     'and it converts at the free dip\'s own ratio, because by then the help is already subtracted');
  ok(me4.contributionsFor(byName('Machine Dip')).length === 0
     && /published/.test(me4.rankBlockedReason(byName('Machine Dip')) || ''),
     '⚠️ while the SEATED machine gets no ratio at all and says so — its leverage is unpublished, '
     + 'and guessing one is exactly what the custom-exercise change removed the same day');

  /* ---- the orderings that would silently invert if a rule moved ---- */
  ok(ratioOf('Seated Leg Press', 'Quads') < ratioOf('Leg Press', 'Quads'),
     '🚨 a horizontal leg press converts BELOW the 45° sled — falling into the sled\'s rule would '
     + 'have over-rated every seated leg press by about 57 %');
  ok(ratioOf('Incline Dumbbell Shrug', 'Traps') < ratioOf('Dumbbell Shrug', 'Traps'),
     'an incline shrug below a standing one — no standing leverage, far less weight');
  ok(near(ratioOf('Machine Fly', 'Chest'), ratioOf('Pec Deck', 'Chest')),
     '⚠️ "Machine Fly" converts as a pec deck (0.90) and not as the generic fly (0.30) — it is the '
     + 'same machine under the other name in use');
  ok(ratioOf('Dumbbell Squeeze Press', 'Chest') < ratioOf('Dumbbell Bench Press', 'Chest'),
     'a squeeze press below a flat press, because the adduction costs load');

  /* ---- the six that used to be silent ---- */
  for (const [n, m] of [['Larsen Press', 'Chest'], ['Cable Press Around', 'Chest'],
                        ['Kroc Row', 'Back'], ['Cross-Body Cable Triceps Extension', 'Triceps']]) {
    ok(ratioOf(n, m) > 0, `${n} converts now (${ratioOf(n, m)}) — it matched no rule at all before`);
  }
  ok(/band/.test(me4.rankBlockedReason(byName('Banded Hip Abduction')) || ''),
     '⚠️ and a BAND says the honest thing — its resistance depends on the stretch, which is not a '
     + 'conversion anybody could publish');

  /* ---- and the assisted family is complete ---- */
  ok(['Assisted Pull-Up', 'Assisted Chin-Up', 'Assisted Dip']
       .every((n) => BODY_WEIGHT_FRACTION[n] && BODY_WEIGHT_FRACTION[n].assist === true),
     'all three assist-machine movements carry the flag on the table entry, never on a name regex');
}

/* ================= within-session fatigue ================= *
 *
 * ⚠️ TIM'S SESSION, 2026-08-24, and the defect it exposed. He did assisted
 * pull-ups, then dumbbell rows, then lat pulldowns, and was too worn out to load
 * the pulldown. The pulldown then LED his Back rating — not because the app
 * rates pulldowns highly (it does not; the row family outranks them) but because
 * `evidenceWeight` multiplies by `repFactor(reps)`, which rewards low reps on
 * the premise that few reps means the weight was near a limit.
 *
 *     Lat Pulldown   quality 0.50 x repFactor(8)  = 0.425   <- led
 *     Dumbbell Row   quality 0.60 x repFactor(10) = 0.420
 *
 * It led by 0.005, entirely because fatigue held him to 8 reps instead of 10.
 * ⚠️ So fatigue did not merely depress the reading, it PROMOTED the depressed
 * reading — and adding it moved his Back rating down 32 % while moving his
 * confidence UP. docs/fatigue-plan.md.
 */
{
  const { store: st, muscleStrength } = await import('../js/store.js');
  const { fatigueFactor, FATIGUE_HALF_SETS, rateMuscle } = await import('../js/muscle-evidence.js');

  /* ---------- the factor itself ---------- */
  ok(fatigueFactor(0) === 1 && fatigueFactor(undefined) === 1 && fatigueFactor(null) === 1,
     'no prior work means no discount, and so does not knowing');
  ok(fatigueFactor(-5) === 1, 'and negative prior volume is refused rather than becoming a BONUS');
  ok(near(fatigueFactor(FATIGUE_HALF_SETS), 0.5),
     `the constant means what it says: ${FATIGUE_HALF_SETS} prior sets halves the credibility`);
  ok(fatigueFactor(1) > fatigueFactor(3) && fatigueFactor(3) > fatigueFactor(9),
     'and it falls monotonically with prior work');
  // ⚠️ THE ONE PROPERTY THAT MAKES A JUDGED CONSTANT ACCEPTABLE HERE. At no
  // value of prior volume may this function return more than 1 — it can only
  // ever withhold credibility, never manufacture it. That asymmetry is the whole
  // argument for shipping a number nobody has measured.
  let everAbove = false;
  for (let v = 0; v <= 200; v += 0.25) if (fatigueFactor(v) > 1) everAbove = true;
  ok(!everAbove, '⚠️ and across 800 values it NEVER exceeds 1 — it can only discount');

  /* ---------- the arity contract ---------- */
  const base = (over) => ({
    estimate: 200, quality: 0.6, kind: 'direct', reps: 8, ageDays: 1,
    isBenchmark: false, exerciseId: 'a', exerciseName: 'A', date: '2026-08-01', ...over,
  });
  const noField = rateMuscle([base({}), base({ exerciseId: 'b', exerciseName: 'B', estimate: 180 })]);
  const explicitOne = rateMuscle([
    base({ fatigueFactor: 1 }),
    base({ exerciseId: 'b', exerciseName: 'B', estimate: 180, fatigueFactor: 1 }),
  ]);
  ok(near(noField.estimate, explicitOne.estimate) && near(noField.confidence, explicitOne.confidence),
     '⚠️ an observation with NO fatigue field rates identically to a fresh one — unwired callers unchanged');

  /* ---------- Tim's session, end to end through the store ---------- */
  await st.clearAll();
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs', compare: 'lifters' });
  await st.logBodyWeight(180, '2026-08-01');
  const eid = (n) => byName(n).id;
  const day = new Date().toISOString().slice(0, 10);
  const ent = (n, w, r, sets = 3) => ({
    exerciseId: eid(n), exerciseName: n,
    sets: Array.from({ length: sets }, () => ({ weight: w, reps: r })),
  });
  const AP = ent('Assisted Pull-Up', 70, 8);
  const DR = ent('Dumbbell Row', 70, 10);
  const LP = ent('Lat Pulldown', 90, 8);

  const rateOrder = async (entries) => {
    for (const s of await st.getSessions()) await st.deleteSession(s.id);
    await st.saveSession({ workoutId: 'bd', workoutName: 'Back day', date: day, entries });
    return (await muscleStrength()).muscles.get('Back');
  };

  const asDone = await rateOrder([AP, DR, LP]);
  ok(asDone.contributors[0].exerciseName !== 'Lat Pulldown',
     '⚠️ the lat pulldown he did third no longer LEADS his Back rating');
  ok(asDone.contributors.find((c) => c.exerciseName === 'Lat Pulldown'),
     'while still counting — it is discounted, not thrown away (dropping it outright measured WORSE)');

  const lp = asDone.contributors.find((c) => c.exerciseName === 'Lat Pulldown');
  const dr = asDone.contributors.find((c) => c.exerciseName === 'Dumbbell Row');
  const ap = asDone.contributors.find((c) => c.exerciseName === 'Assisted Pull-Up');
  ok(ap.priorVolume === 0 && ap.fatigueFactor === 1,
     '⚠️ the FIRST exercise is never discounted — an exercise does not fatigue itself');
  ok(dr.priorVolume === 3 && lp.priorVolume === 6,
     `prior volume counts the sets that came before: row ${dr.priorVolume}, pulldown ${lp.priorVolume}`);
  ok(lp.fatigueFactor < dr.fatigueFactor && dr.fatigueFactor < ap.fatigueFactor,
     'and the discount is GRADED, not a flag — the third lift is discounted harder than the second');

  /* ---------- ⚠️ ORDER NOW MATTERS AT ALL, which it did not before ---------- */
  const reversed = await rateOrder([LP, DR, AP]);
  ok(Math.abs(reversed.estimate - asDone.estimate) > 0.5
     || reversed.contributors[0].exerciseName !== asDone.contributors[0].exerciseName,
     '⚠️ the SAME three exercises in a different order now rate differently — before this they did not');
  ok(reversed.contributors[0].exerciseName === 'Lat Pulldown',
     'and done first, the pulldown leads again — the discount is about order, not about pulldowns');

  /* ---------- ⚠️ CONFIDENCE, AND A RULE THAT HAD TO BE WEAKENED ---------- *
   *
   * The original defect: adding the fatigued third exercise moved Tim's Back
   * estimate 32 % WORSE and his confidence UP, 0.40 -> 0.44, because `depth`
   * counted it like any other reading.
   *
   * ⚠️ "CONFIDENCE MUST NEVER RISE ON A FATIGUED READING" WAS THE FIRST RULE
   * WRITTEN HERE, AND IT IS WRONG. This test asserted it and failed, correctly.
   * A third reading that lands BETWEEN two that disagree genuinely does tighten
   * the picture — his three imply 115, 229 and 136, and the 136 sits in the
   * middle, so the `agreement` term rises on its own account and deserves to.
   * A fatigued reading is weaker evidence, not anti-evidence.
   *
   * So the provable property is the narrower one below, and the end-to-end rise
   * is recorded as the measured fact it is rather than legislated away.
   */
  const tiredObs = (f) => ([
    { estimate: 229, quality: 0.6, kind: 'direct', reps: 10, ageDays: 1, isBenchmark: false,
      exerciseId: 'dr', exerciseName: 'Dumbbell Row', date: day, fatigueFactor: 1 },
    { estimate: 136, quality: 0.5, kind: 'direct', reps: 8, ageDays: 1, isBenchmark: false,
      exerciseId: 'lp', exerciseName: 'Lat Pulldown', date: day, fatigueFactor: f },
  ]);
  const asFresh = rateMuscle(tiredObs(1));
  const asTired = rateMuscle(tiredObs(fatigueFactor(6)));
  ok(asTired.confidence < asFresh.confidence,
     `⚠️ the SAME reading taken tired yields less confidence than taken fresh `
     + `(${asFresh.confidence.toFixed(3)} -> ${asTired.confidence.toFixed(3)})`);
  ok(asTired.used[0].exerciseName === 'Dumbbell Row' && asFresh.used[0].exerciseName === 'Lat Pulldown',
     'and it stops leading, which is the same fact seen from the other side');

  // ⚠️ A SECOND ASSERTION WAS REMOVED HERE ON 2026-08-24, AND THE REASON IS THE
  // POINT. It read "the fatigued third exercise now barely moves confidence at
  // all (rise < 0.02)" and it passed — until the Dumbbell Row ratio was
  // corrected from 0.85 to 0.98 later the same day, when the rise went to
  // +0.059 and it failed.
  //
  // It was never measuring the fatigue term. With better-calibrated inputs his
  // three readings agree MORE, so a third one landing between them tightens the
  // picture MORE, so confidence rises MORE — which is correct behaviour and had
  // nothing to do with fatigue. A magnitude threshold pinned to numbers from a
  // different part of the system is a test that fails when something unrelated
  // gets better. What replaced it is a comparison the feature actually controls.
  ok(asDone.confidence < reversed.confidence,
     `⚠️ the same three exercises give LESS confidence when the leader is the tired one `
     + `(${asDone.confidence.toFixed(2)} as done, ${reversed.confidence.toFixed(2)} pulldown-first)`);

  /* ---------- the hint, which is worth more than the weighting ---------- */
  ok(/cleaner reading/.test(asDone.hint || '') && /Dumbbell Row/.test(asDone.hint || ''),
     '⚠️ the panel names the lift and says doing it earlier would read better');
  ok(!/tired you were/.test(asDone.hint || ''),
     'and does not claim to know how tired he was, which nobody measured');
  const freshFirst = await rateOrder([ent('Lat Pulldown', 140, 8), AP, DR]);
  ok(!/cleaner reading/.test(freshFirst.hint || ''),
     'and the hint is silent when the leading reading was taken fresh');
  // Measured 2026-08-24: doing that pulldown first at a weight he could actually
  // use is worth ~60 lb, where every re-weighting scheme measured was worth
  // under 5. A fatigued set is MISSING information, not corrupted information.
  ok(freshFirst.estimate > asDone.estimate + 40,
     `one fresh reading is worth far more than the discount ever is `
     + `(${Math.round(asDone.estimate)} -> ${Math.round(freshFirst.estimate)})`);

  /* ---------- a benchmark stands alone ---------- */
  for (const s of await st.getSessions()) await st.deleteSession(s.id);
  await st.saveBenchmark({ exerciseId: eid('Barbell Row'), exerciseName: 'Barbell Row',
    date: day, values: { weight: 225, reps: 5 } });
  const bm = (await muscleStrength()).muscles.get('Back');
  ok(bm.contributors[0].fatigueFactor === 1 && bm.contributors[0].priorVolume === 0,
     '⚠️ a benchmark is never fatigued — it is its own session, with nothing in front of it');

  await st.clearAll();
}

/* ================= current bests: numbers without a trend ================= */
// Tim, 2026-08-17: the chart modes need two days before they draw anything, so a
// new user who had logged a whole workout was told "Nothing to chart yet" while
// the app sat on every number they had entered.
{
  const { store: st, currentBests } = await import('../js/store.js');
  await st.clearAll();
  const id = (n) => byName(n).id;
  const today = new Date().toISOString().slice(0, 10);

  ok((await currentBests()).length === 0, 'nothing recorded, nothing listed');

  await st.saveSession({
    workoutId: 'cb', workoutName: 'Full body', date: today,
    entries: [
      { exerciseId: id('Barbell Bench Press'), exerciseName: 'Barbell Bench Press',
        sets: [{ weight: 185, reps: 8 }, { weight: 205, reps: 5 }, { weight: 135, reps: 12 }] },
      { exerciseId: id('Dumbbell Row'), exerciseName: 'Dumbbell Row',
        sets: [{ weight: 90, reps: 10 }] },
      { exerciseId: id('Plank'), exerciseName: 'Plank', sets: [{ time: 90 }, { time: 120 }] },
    ],
  });

  let rows = await currentBests();
  ok(rows.length === 3, `one row per exercise from a single workout (${rows.length})`);

  const benchRow = rows.find((r) => r.name === 'Barbell Bench Press');
  // Ranked by estimated max, not by raw weight and not by the last set entered:
  // 205x5 genuinely beats 185x8, and 135x12 beats neither.
  ok(benchRow.best.weight === 205 && benchRow.best.reps === 5,
     `the best set wins on estimated max (${benchRow.best.weight}x${benchRow.best.reps})`);
  ok(benchRow.e1rm > 205, 'and the estimate is above the weight actually lifted');
  ok(benchRow.days === 0 && benchRow.sessions === 1, 'recorded today, one day counted');

  // A per-side lift keeps the number the user typed. Doubling belongs to the
  // ranking model, not to a screen that is showing them what they logged.
  const rowRow = rows.find((r) => r.name === 'Dumbbell Row');
  ok(rowRow.best.weight === 90 && rowRow.loadType === 'per_side',
     'a per-side lift reports the entered weight and says it is per side');

  // A time-based exercise has no estimated max and must not invent one, and its
  // BEST is its fastest, not its longest.
  const plank = rows.find((r) => r.name === 'Plank');
  ok(plank.e1rm === null, 'a plank has no estimated one-rep max');
  ok(plank.best.time === 90, `and its best is the fastest time (${plank.best.time})`);

  // A benchmark on a later day should take over and be labelled.
  await st.saveBenchmark({ date: today, exerciseId: id('Barbell Bench Press'),
    exerciseName: 'Barbell Bench Press', values: { weight: 245, reps: 1 } });
  rows = await currentBests();
  const bench2 = rows.find((r) => r.name === 'Barbell Bench Press');
  ok(bench2.best.weight === 245 && bench2.best.source === 'benchmark',
     'a stronger benchmark takes over and says so');

  // Older work still appears, and is ordered behind more recent work.
  await st.saveSession({
    workoutId: 'cb2', workoutName: 'Old', date: '2026-01-05',
    entries: [{ exerciseId: id('Back Squat'), exerciseName: 'Back Squat',
                sets: [{ weight: 315, reps: 3 }] }],
  });
  rows = await currentBests();
  ok(rows[rows.length - 1].name === 'Back Squat', 'the oldest lift sorts last');
  ok(rows[rows.length - 1].days > 100, 'and reports how long ago it was');

  // Zero and blank sets must not create a row out of nothing.
  await st.saveSession({
    workoutId: 'cb3', workoutName: 'Empty', date: today,
    entries: [{ exerciseId: id('Overhead Press'), exerciseName: 'Overhead Press',
                sets: [{ weight: 0, reps: 0 }] }],
  });
  ok(!(await currentBests()).some((r) => r.name === 'Overhead Press'),
     'an empty set does not produce a row');

  await st.clearAll();
}


/* ================= workout systems ================= */
// A SYSTEM is a programme — a named group of workouts (Tim, 2026-08-17).
{
  const { store: st, clearReadCache } = await import('../js/store.js');
  const id = (n) => byName(n).id;

  /* ---- migration: workouts saved before systems existed ---- */
  await st.clearAll();
  // Written straight past the store, exactly as an older build left them: no
  // systemId at all, and one still in the ancient exerciseIds shape.
  localStorage.setItem('ftrack:v1:workouts', JSON.stringify([
    { id: 'w1', name: 'Push', exercises: [{ exerciseId: id('Barbell Bench Press'), sets: 4 }], createdAt: '2026-01-01' },
    { id: 'w2', name: 'Legs', exerciseIds: [id('Back Squat')], createdAt: '2026-01-02' },
  ]));
  // ⚠️ THE READ CACHE'S ONE CONTRACT: the store is the only writer. This test
  // deliberately breaks that to imitate rows an older build left on disk, so it
  // has to say so — otherwise it is asserting against a cached copy taken
  // before the line above ran. A real app never needs this: rows that predate
  // the store are read on a cold start, when the cache is empty. A second TAB
  // is the one case that can go briefly stale, and the background revalidation
  // catches it within 30 seconds.
  clearReadCache();

  let systems = await st.getSystems();
  ok(systems.length === 1, `orphaned workouts are adopted into one system (${systems.length})`);
  ok(systems[0].name === 'My Workouts', `and it is named for what it holds ("${systems[0].name}")`);
  let ws = await st.getWorkouts();
  ok(ws.length === 2 && ws.every((w) => w.systemId === systems[0].id),
     'every pre-existing workout ends up in it — nothing is lost or hidden');
  ok(ws.find((w) => w.name === 'Legs').exercises.length === 1,
     'and the older exerciseIds shape still upgrades on the way through');

  // Idempotent: running it again must not create a second system.
  await st.getSystems();
  await st.getSystems();
  ok((await st.getSystems()).length === 1, 'migrating twice does not create a second system');

  /* ---- the race that shipped ---- */
  // Read-modify-write across two collections is not atomic. Two callers running
  // the migration at once each saw "no systems", each created one, and the
  // second write clobbered the first — leaving the list pointing at a row that
  // no longer existed. It presented as an empty system list that said "Not
  // found" when tapped. WorkoutsView asking for both in one Promise.all is
  // exactly this case.
  await st.clearAll();
  localStorage.setItem('ftrack:v1:workouts', JSON.stringify([
    { id: 'r1', name: 'Push', exercises: [{ exerciseId: id('Barbell Bench Press'), sets: 3 }] },
  ]));
  clearReadCache();   // seeded past the store — see the note above
  const [raceSystems, raceWorkouts] = await Promise.all([st.getSystems(), st.getWorkouts()]);
  ok(raceSystems.length === 1,
     `concurrent callers produce exactly one system (${raceSystems.length})`);
  ok(raceWorkouts.every((w) => raceSystems.some((s) => s.id === w.systemId)),
     'and every workout points at a system that actually exists');
  // Four at once, for good measure.
  await st.clearAll();
  localStorage.setItem('ftrack:v1:workouts', JSON.stringify([
    { id: 'r2', name: 'Pull', exercises: [{ exerciseId: id('Barbell Row'), sets: 3 }] },
  ]));
  clearReadCache();   // seeded past the store — see the note above
  await Promise.all([st.getSystems(), st.getWorkouts(), st.getSystems(), st.getWorkouts()]);
  ok((await st.getSystems()).length === 1, 'four concurrent callers still produce one system');

  /* ---- create, rename, filter ---- */
  await st.clearAll();
  const ppl = await st.saveSystem({ name: 'Push Pull Legs', notes: '6 days' });
  const ul = await st.saveSystem({ name: 'Upper / Lower' });
  ok(ppl.id && ul.id && ppl.id !== ul.id, 'systems get their own ids');
  ok((await st.getSystems()).length === 2, 'and both are listed');

  await st.saveWorkout({ name: 'Push', systemId: ppl.id, exercises: [{ exerciseId: id('Barbell Bench Press'), sets: 3 }] });
  await st.saveWorkout({ name: 'Pull', systemId: ppl.id, exercises: [{ exerciseId: id('Barbell Row'), sets: 3 }] });
  await st.saveWorkout({ name: 'Upper', systemId: ul.id, exercises: [{ exerciseId: id('Overhead Press'), sets: 3 }] });

  ok((await st.getWorkouts(ppl.id)).length === 2, 'workouts filter by system');
  ok((await st.getWorkouts(ul.id)).length === 1, 'and each system sees only its own');
  ok((await st.getWorkouts()).length === 3, 'asking for all of them still returns all of them');
  // A workout created inside a system must not be adopted away by the migration.
  ok((await st.getWorkouts()).every((w) => w.systemId),
     'a workout saved with a system keeps it');

  const renamed = await st.saveSystem({ ...ppl, name: 'PPL' });
  ok(renamed.id === ppl.id, 'renaming keeps the id');
  ok((await st.getSystem(ppl.id)).name === 'PPL', 'and the new name sticks');
  ok((await st.getWorkouts(ppl.id)).length === 2, 'and its workouts are still in it');

  /* ---- names ---- */
  const blank = await st.saveSystem({ name: '   ' });
  ok((await st.getSystem(blank.id)).name === 'Untitled system',
     'a blank name falls back rather than rendering as an empty row');

  /* ---- deleting a system takes its workouts, but never history ---- */
  await st.saveSession({
    workoutId: 'gone', workoutName: 'Push', date: '2026-08-10',
    entries: [{ exerciseId: id('Barbell Bench Press'), exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 185, reps: 5 }] }],
  });
  const sessionsBefore = (await st.getSessions()).length;

  await st.deleteSystem(ppl.id);
  ok(!(await st.getSystem(ppl.id)), 'the system is gone');
  ok((await st.getWorkouts()).every((w) => w.systemId !== ppl.id),
     'its workouts go with it — they belong to it and have nowhere else to live');
  ok((await st.getWorkouts(ul.id)).length === 1, 'and another system is untouched');
  ok((await st.getSessions()).length === sessionsBefore,
     'recorded history is NOT touched — it is a record of what happened, not a plan');

  await st.clearAll();
}


/* ================= ready-made systems ================= */
{
  const { store: st } = await import('../js/store.js');
  const { PRESET_SYSTEMS, presetById, presetSetCount, presetExerciseNames } =
    await import('../js/preset-systems.js');

  ok(PRESET_SYSTEMS.length >= 1, 'there is at least one ready-made system to explore');

  // THE check. Presets reference exercises BY NAME, because ids are derived from
  // name+muscle and hard-coding them would rot silently the first time a name
  // changed. That trade only holds if a test catches a name that stops
  // resolving — otherwise the failure is a workout quietly missing an exercise.
  const names = new Set(BUILT_IN_EXERCISES.map((e) => e.name));
  for (const p of PRESET_SYSTEMS) {
    const missing = presetExerciseNames(p).filter((n) => !names.has(n));
    ok(missing.length === 0,
       `every exercise in "${p.name}" resolves${missing.length ? ': MISSING ' + missing.join(', ') : ''}`);
  }

  // Each one has to describe itself well enough to choose between.
  for (const p of PRESET_SYSTEMS) {
    ok(Boolean(p.id && p.name && p.summary && p.author),
       `"${p.name}" states its id, name, summary and author`);
    ok(p.daysPerWeek > 0 && p.minutes > 0, `"${p.name}" states days per week and session length`);
    ok(p.workouts.length > 0, `"${p.name}" has workouts`);
    ok(p.workouts.every((w) => w.name && w.exercises.length),
       `every workout in "${p.name}" is named and non-empty`);
    ok(p.workouts.every((w) => w.exercises.every((e) => Number(e.sets) > 0)),
       `every exercise in "${p.name}" has a planned set count`);
    ok(presetSetCount(p) > 0, `"${p.name}" reports a total set count`);
  }
  ok(new Set(PRESET_SYSTEMS.map((p) => p.id)).size === PRESET_SYSTEMS.length,
     'preset ids are unique');
  ok(presetById('does-not-exist') === null, 'an unknown preset id returns null, not a throw');

  // A third-party system must never be able to look like one the app wrote, so
  // the fields that carry attribution have to exist even when empty.
  for (const p of PRESET_SYSTEMS) {
    ok('sourceName' in p && 'sourceUrl' in p,
       `"${p.name}" carries attribution fields, so a third-party system has somewhere to say so`);
    // Anything credited to a real person has to link to where it came from AND
    // say plainly that it is not their own words. Getting this wrong is the
    // difference between citing someone and impersonating them.
    if (p.author && p.author !== 'Fitness Tracker') {
      ok(Boolean(p.sourceUrl), `"${p.name}" is credited to ${p.author} and links to the source`);
      ok(p.unofficial === true, `"${p.name}" is flagged as an unofficial transcription`);
      ok(/not from|transcribed/i.test(p.notes || ''),
         `"${p.name}" says in its own notes that it is not the author's own writing`);
    }

    // A METHOD system is the harder case to get right: the workouts are OURS,
    // written to follow somebody else's published idea. Borrowing a reputation
    // is easier to do by accident than plagiarising a programme, so the rules
    // are stricter — the person must NOT appear as the author, must be cited,
    // and the notes must disown the workouts in as many words.
    if (p.basedOn) {
      ok(p.author === 'Fitness Tracker',
         `"${p.name}" follows ${p.basedOn.person}'s method and does NOT claim them as author`);
      ok(Boolean(p.basedOn.person && p.basedOn.sourceUrl),
         `"${p.name}" names whose method it follows and links to it`);
      ok(p.unofficial === true, `"${p.name}" is flagged unofficial`);
      ok(/not written by|not .*(their|his|her)|are not theirs/i.test(p.notes || '')
         || /not\b[^.]*\b(transcribed|programme|program)\b/i.test(p.notes || ''),
         `"${p.name}" says in its notes that the workouts are not the named person's`);
      ok(/NOT|not/.test(p.warning || ''),
         `"${p.name}" carries its own warning rather than the transcription default`);
    }

    // The default warning on the detail screen says "transcribed from the free
    // VIDEOS". That is true of one system here and false of the rest, so
    // anything not transcribed from video has to override it. Caught by hand
    // once already: Arnold's Golden Six predates YouTube by forty years.
    if (p.unofficial && !/youtube|video/i.test(p.sourceName || '')) {
      ok(typeof p.warning === 'string' && p.warning.length > 0,
         `"${p.name}" is not a video transcription, so it states its own warning`);
    }
  }

  /* ---- the Nippard series is all six episodes, and they are six DIFFERENT
         workouts ----------------------------------------------------------
     Until 2026-08-19 this shipped three workouts while declaring six days a
     week, so the rating ran the same three twice and called it the programme.
     Two things need pinning, and the second is the one that matters: a count
     of six is trivially satisfiable by duplicating a day.                   */
  {
    const nip = presetById('preset-nippard-ppl-2023');
    const names = nip.workouts.map((w) => w.name);
    ok(names.join(' | ') === 'Push 1 | Pull 1 | Legs 1 | Push 2 | Pull 2 | Legs 2',
       'the Nippard series ships all six episodes, in the order they were published');
    ok(nip.workouts.length === nip.daysPerWeek,
       'and a six-day-a-week programme has six workouts, so the badge is not '
       + 'rating the same days twice');

    // The A/B pairs must be genuinely different sessions. Overlap is allowed —
    // it is the same muscle group — but a pair sharing MOST of its exercises
    // would mean somebody padded the count instead of transcribing the video.
    const exOf = (n) => new Set(nip.workouts.find((w) => w.name === n).exercises.map((e) => e.name));
    for (const day of ['Push', 'Pull', 'Legs']) {
      const a = exOf(`${day} 1`);
      const b = exOf(`${day} 2`);
      const shared = [...a].filter((x) => b.has(x)).length;
      ok(shared <= Math.min(a.size, b.size) / 2,
         `${day} 2 is a different session from ${day} 1, not a repeat `
         + `(${shared} exercise${shared === 1 ? '' : 's'} in common)`);
    }

    // The two exercises the second half of the series needed. Both are new, and
    // a preset naming an exercise the library lacks is caught above — but a
    // ranking model that silently ignores the main lift of a workout is not,
    // because contributionsFor() returns [] for anything it has no rule for.
    const { contributionsFor } = await import('../js/muscle-evidence.js');
    const cgi = BUILT_IN_EXERCISES.find((e) => e.name === 'Close-Grip Incline Bench Press');
    ok(Boolean(cgi), 'the library has the close-grip incline bench Push 2 opens on');
    ok(contributionsFor(cgi).some((c) => c.muscle === 'Chest'),
       'and it actually rates a muscle rather than being silently unrankable');

    // A two-stack cable movement: the number entered is one side. Getting this
    // wrong does not fail loudly, it halves every weight the exercise records.
    const bof = BUILT_IN_EXERCISES.find((e) => e.name === 'Bent-Over Cable Fly');
    ok(bof && bof.loadType === 'per_side',
       'the bent-over cable fly is counted per side, like every other cable fly');

    // Pull 1's lat pulldown is the series' only drop set. normalizeWorkout()
    // rebuilds each exercise field by field, so a set type survives a copy only
    // because it is named there — worth an assertion rather than an assumption.
    await st.clearAll();
    const copied = await st.addPresetSystem(nip);
    const pull1 = (await st.getWorkouts(copied.system.id)).find((w) => w.name === 'Pull 1');
    const { DROP } = await import('../js/set-types.js');
    const pulldown = pull1.exercises.find((e) => e.setType === DROP);
    ok(Boolean(pulldown) && pulldown.minis === 1,
       'copying the series brings Pull 1\'s drop set across, with its one drop');
    await st.clearAll();
  }

  /* ---- every one of them actually copies in ---- */
  // The name-resolution check above is static. This is the end-to-end version:
  // add each system for real and assert nothing was silently dropped. They are
  // not interchangeable — `skipped` counts exercises the STORE could not
  // resolve, which is a different failure from a name that is not in the
  // library at all.
  for (const p of PRESET_SYSTEMS) {
    await st.clearAll();
    const { system, skipped } = await st.addPresetSystem(p);
    ok(skipped === 0, `"${p.name}" copies in with nothing skipped (${skipped})`);
    const ws = await st.getWorkouts(system.id);
    ok(ws.length === p.workouts.length,
       `"${p.name}" brings all ${p.workouts.length} workouts`);
    const wanted = presetExerciseNames(p).length;
    const got = ws.reduce((n, w) => n + w.exercises.length, 0);
    ok(got === wanted, `"${p.name}" brings all ${wanted} exercises (${got})`);

    // IN PROGRAMME ORDER. Workouts otherwise sort by name, which shuffled
    // "Upper A, Lower A, Upper B, Lower B" into both Lowers first and turned
    // Thurston's week into an alphabetical list. The order is the author's,
    // and the notes tell you to follow it.
    ok(ws.map((w) => w.name).join(' → ') === p.workouts.map((w) => w.name).join(' → '),
       `"${p.name}" keeps programme order (${ws.map((w) => w.name).join(', ')})`);
  }

  // A workout the user adds afterwards has no order and lands at the END,
  // rather than wedging itself into someone's split by its initial letter.
  {
    await st.clearAll();
    const p = presetById('preset-volume-landmarks');
    const { system } = await st.addPresetSystem(p);
    await st.saveWorkout({ name: 'Arm day I added', systemId: system.id, exercises: [] });
    const names = (await st.getWorkouts(system.id)).map((w) => w.name);
    ok(names[names.length - 1] === 'Arm day I added',
       `a workout you add yourself goes last, not first (${names.join(', ')})`);
    ok(names.slice(0, 4).join(',') === p.workouts.map((w) => w.name).join(','),
       'and the copied programme keeps its own order around it');
  }

  /* ---- adding one to an account ---- */
  await st.clearAll();
  const preset = PRESET_SYSTEMS[0];
  const { system, skipped } = await st.addPresetSystem(preset);

  ok(skipped === 0, `adding "${preset.name}" skips nothing (${skipped})`);
  ok(system.id && system.name === preset.name, 'it becomes a real system with the same name');
  ok(system.presetId === preset.id, 'and remembers which ready-made system it came from');

  const made = await st.getWorkouts(system.id);
  ok(made.length === preset.workouts.length,
     `every workout is copied in (${made.length}/${preset.workouts.length})`);
  for (const w of preset.workouts) {
    const mine = made.find((m) => m.name === w.name);
    ok(Boolean(mine), `"${w.name}" was copied`);
    ok(mine && mine.exercises.length === w.exercises.length,
       `"${w.name}" kept all ${w.exercises.length} exercises`);
    ok(mine && mine.exercises.every((e) => e.exerciseId),
       `"${w.name}" resolved every exercise to a real id`);
    ok(mine && mine.exercises[0].sets === w.exercises[0].sets,
       `"${w.name}" kept the planned set counts`);
  }
  // The per-exercise coaching notes are the reason to use somebody's programme
  // rather than a list of names, so they must survive the copy.
  ok(made.some((m) => m.exercises.some((e) => e.notes)),
     'the exercise notes come across with it');

  ok((await st.addedPresetIds()).has(preset.id), 'the account knows it has this one');

  // It is a COPY. Editing it must not be able to reach back into the preset,
  // and the preset must not change under a user who has already taken it.
  const mine = made[0];
  mine.name = 'Renamed by me';
  mine.exercises.pop();
  await st.saveWorkout(mine);
  ok(presetById(preset.id).workouts[0].name !== 'Renamed by me',
     'editing your copy does not touch the original');
  ok(presetById(preset.id).workouts[0].exercises.length > 0, 'the original still has its exercises');

  // Adding twice gives two separate copies rather than merging or failing.
  const second = await st.addPresetSystem(preset);
  ok(second.system.id !== system.id, 'adding it again makes a second, separate system');
  ok((await st.getSystems()).length === 2, 'and both are listed');
  ok((await st.getWorkouts(second.system.id)).length === preset.workouts.length,
     'the second copy is complete even though the first was edited');

  // Deleting one copy leaves the other alone.
  await st.deleteSystem(system.id);
  ok((await st.getWorkouts(second.system.id)).length === preset.workouts.length,
     'deleting one copy does not touch the other');

  await st.clearAll();
  let threw = false;
  try { await st.addPresetSystem(null); } catch { threw = true; }
  ok(threw, 'adding a non-system throws rather than writing junk');
}


/* ================= which workout is next ================= */
{
  const { suggestNext, describeSuggestion, agoWords, daysBetween } =
    await import('../js/next-workout.js');

  const SYS = [{ id: 'sA', name: 'Push Pull Legs' }, { id: 'sB', name: 'Upper / Lower' }];
  // In DISPLAY order, which is what store.getWorkouts() returns.
  const PPL = [
    { id: 'wPush', name: 'Push', systemId: 'sA', order: 0, exercises: [] },
    { id: 'wPull', name: 'Pull', systemId: 'sA', order: 1, exercises: [] },
    { id: 'wLegs', name: 'Legs', systemId: 'sA', order: 2, exercises: [] },
  ];
  const sess = (workoutId, date, workoutName) => ({ id: 's' + date, workoutId, workoutName, date });
  const call = (o) => suggestNext({ today: '2026-08-17', systems: SYS, ...o });

  /* ---- the plain case ---- */
  {
    const s = call({ workouts: PPL, sessions: [sess('wPush', '2026-08-15', 'Push')] });
    ok(s && s.workout.id === 'wPull', 'after Push, the next workout is Pull');
    ok(s.reason === 'stalest', 'and it says it chose the workout waited on longest (2026-08-26 rule)');
  }

  /* ---- ⚠️ TIM'S COUNTER-EXAMPLE, 2026-08-26 — the reason the rule changed ----
   * Monday Pull, Tuesday Legs. The old next-in-list rule looked only at the
   * newest session, and on a self-built system with no `order` the list is
   * alphabetical — Legs, Pull, Push — so "after Legs" was Monday's Pull again.
   * The least-recently-done rule answers Push, which is the answer a person
   * gives instantly. */
  {
    const unordered = [
      { id: 'wLegs', name: 'Legs', systemId: 'sA', exercises: [] },
      { id: 'wPull', name: 'Pull', systemId: 'sA', exercises: [] },
      { id: 'wPush', name: 'Push', systemId: 'sA', exercises: [] },
    ];
    const s = call({ workouts: unordered, sessions: [
      sess('wLegs', '2026-08-16', 'Legs'),
      sess('wPull', '2026-08-15', 'Pull'),
      sess('wPush', '2026-08-10', 'Push'),
    ] });
    ok(s && s.workout.id === 'wPush',
       '⚠️ Pull Monday, Legs Tuesday → Push — not Monday\'s Pull again (the bug Tim reported)');
    ok(s.nextDaysSince === 7, `and it knows how long Push has waited (${s.nextDaysSince} days)`);

    // Never-done beats everything — do the thing you have not done.
    const s2 = call({ workouts: unordered, sessions: [
      sess('wLegs', '2026-08-16', 'Legs'),
      sess('wPull', '2026-08-15', 'Pull'),
    ] });
    ok(s2 && s2.workout.id === 'wPush' && s2.nextNeverDone === true,
       'a workout never done at all is the stalest of all');

    // Ties break by rotation order AFTER the last workout done, so a fresh
    // copy of an ORDERED programme still walks the author\'s sequence.
    const s3 = call({ workouts: PPL, sessions: [sess('wPush', '2026-08-15', 'Push')] });
    ok(s3.workout.id === 'wPull',
       'with Pull and Legs both never done, the author\'s order picks Pull — programme order survives as the tie-break');
    ok(s3.daysSince === 2, 'it knows how long ago the last one was');
    ok(s3.lastName === 'Push', 'and what the last one was');
    ok(/Push Pull Legs/.test(describeSuggestion(s3)) && /Push/.test(describeSuggestion(s3)),
       'the caption names the system and the last workout');
    // The button carries the name, so the sentence under it must not repeat it.
    ok(!/\bPull\b/.test(describeSuggestion(s).replace('Push Pull Legs', '')),
       'the caption does not repeat the name already on the button');
  }

  /* ---- it WRAPS. A rotation's last workout is followed by its first ---- */
  {
    const s = call({ workouts: PPL, sessions: [sess('wLegs', '2026-08-16', 'Legs')] });
    ok(s.workout.id === 'wPush', 'after the last workout it wraps back to the first');
  }

  /* ---- order, not alphabet ---- */
  // The whole feature rests on `order`. Alphabetically these are Legs, Pull,
  // Push, so a suggestion built on names would answer "Push" here and be wrong.
  {
    const s = call({ workouts: PPL, sessions: [sess('wPull', '2026-08-16', 'Pull')] });
    ok(s.workout.id === 'wLegs',
       'the rotation follows programme order, not alphabetical order');
  }

  /* ---- nothing recorded yet ---- */
  {
    const s = call({ workouts: PPL, sessions: [] });
    ok(s.workout.id === 'wPush' && s.isStart, 'with no history it starts at the top of the rotation');
    ok(/First workout/.test(describeSuggestion(s)), 'and says so rather than inventing a last session');
  }

  /* ---- two systems and no history: SAY NOTHING ---- */
  // Guessing which programme somebody meant to start is exactly the
  // confident-and-wrong this app is built against.
  {
    const both = [...PPL, { id: 'wUp', name: 'Upper', systemId: 'sB', order: 0, exercises: [] }];
    ok(call({ workouts: both, sessions: [] }) === null,
       'two systems and no history means no suggestion at all');
    // But one session is enough to know which programme they are on.
    const s = call({ workouts: both, sessions: [sess('wUp', '2026-08-16', 'Upper')] });
    ok(s && s.system.id === 'sB', 'one session picks the system out');
    ok(s.workout.id === 'wUp', 'and a one-workout system suggests itself again');
    ok(s.isOnlyWorkout && /only workout/i.test(describeSuggestion(s)),
       'saying it is the only one, so repeating it does not read as a bug');
  }

  /* ---- trained today: offer, never refuse ---- */
  {
    const s = call({ workouts: PPL, sessions: [sess('wPush', '2026-08-17', 'Push')] });
    ok(s.trainedToday && s.workout.id === 'wPull', 'training today still suggests the next one');
    ok(/already did Push today/.test(describeSuggestion(s)),
       'and says you already trained rather than telling you not to');
    ok(!/rest|too much|don.t/i.test(describeSuggestion(s)),
       'Rule 6: it never scolds — that would be an opinion it has not earned');
  }

  /* ---- a workout deleted after being run ---- */
  // D22 keeps the SESSION when a workout is deleted, so the newest row can point
  // at a workout that no longer exists. Dead-ending there would silence the
  // suggestion permanently for anyone who has ever deleted a workout.
  {
    const s = call({ workouts: PPL, sessions: [
      sess('wGone', '2026-08-16', 'Deleted day'),
      sess('wPush', '2026-08-14', 'Push'),
    ] });
    ok(s && s.workout.id === 'wPull',
       'a session pointing at a deleted workout is skipped, not fatal');
    ok(s.daysSince === 3, 'and the date read is the one it actually used');
  }

  /* ---- sessions handed over in the wrong order ---- */
  {
    const s = call({ workouts: PPL, sessions: [
      sess('wPush', '2026-08-10', 'Push'), sess('wPull', '2026-08-16', 'Pull'),
    ] });
    ok(s.workout.id === 'wLegs', 'the newest session wins whatever order they arrive in');
  }

  /* ---- nothing to suggest from ---- */
  ok(call({ workouts: [], sessions: [] }) === null, 'no workouts means no suggestion');
  ok(call({ workouts: [{ id: 'x', name: 'Loose', systemId: null, exercises: [] }], sessions: [] }) === null,
     'a workout in no system cannot be a rotation');

  /* ---- dates ---- */
  // Parsed as LOCAL midnight. `new Date('2026-08-17')` is UTC and lands on the
  // 16th for anyone west of Greenwich, which would put every suggestion a day
  // out for half the world.
  ok(daysBetween('2026-08-15', '2026-08-17') === 2, 'day arithmetic counts days');
  ok(daysBetween('2026-08-17', '2026-08-17') === 0, 'the same day is zero days');
  ok(daysBetween('2026-02-28', '2026-03-01') === 1, 'and crosses a month end');
  ok(agoWords(0) === 'today' && agoWords(1) === 'yesterday' && agoWords(3) === '3 days ago',
     'recent days are named, not dated');
  ok(agoWords(9) === 'a week ago' && agoWords(21) === '3 weeks ago', 'and longer gaps round to weeks');
  ok(describeSuggestion(null) === '', 'no suggestion describes as nothing, not "undefined"');

  /* ---- it works on a real preset, end to end ---- */
  {
    const { store: st } = await import('../js/store.js');
    const { presetById } = await import('../js/preset-systems.js');
    await st.clearAll();
    const preset = presetById('preset-israetel-floating-split');
    const { system } = await st.addPresetSystem(preset);
    const ws = await st.getWorkouts(system.id);
    const s = suggestNext({
      systems: await st.getSystems(), workouts: await st.getWorkouts(),
      sessions: [sess(ws[0].id, '2026-08-16', ws[0].name)], today: '2026-08-17',
    });
    ok(s.workout.name === 'Legs 1',
       `after Pull 1 the floating split says Legs 1 (${s.workout.name})`);
    await st.clearAll();
  }
}


/* ================= set types: supersets and drop sets ================= */
{
  const st = await import('../js/set-types.js');
  const { store: store2 } = await import('../js/store.js');

  const ex = (id, sets = 3, extra = {}) => ({ exerciseId: id, sets, notes: '', ...extra });

  /* ---- naming ---- */
  ok(st.groupLabel(2) === 'Superset' && st.groupLabel(3) === 'Tri-set' && st.groupLabel(5) === 'Giant set',
     'a block is named for how many exercises are in it');

  /* ---- linking ---- */
  {
    let list = [ex('a'), ex('b'), ex('c')];
    list = st.toggleLink(list, 0);
    ok(st.isLinked(list, 0) && !st.isLinked(list, 1), 'linking joins exactly one boundary');
    ok(st.blocksOf(list).length === 2, 'which makes two blocks out of three exercises');

    // Joining onto an existing block GROWS it — a superset becomes a tri-set
    // rather than splitting into two blocks that happen to be adjacent.
    list = st.toggleLink(list, 1);
    const blocks = st.blocksOf(list);
    ok(blocks.length === 1 && blocks[0].items.length === 3, 'joining again grows it into a tri-set');
    ok(st.groupLabel(blocks[0].items.length) === 'Tri-set', 'and it calls itself a tri-set');

    // Splitting a tri-set in the middle leaves a pair and a single; the single
    // must stop being a group at all.
    const split = st.toggleLink(list, 0);
    ok(st.blocksOf(split).length === 2, 'splitting a tri-set leaves two blocks');
    ok(split[0].group == null, 'and the exercise left on its own is no longer in a group');
    ok(split[1].group != null && split[1].group === split[2].group, 'while the other two stay joined');
  }

  /* ---- joining two blocks merges BOTH of them ---- */
  // Found in review. Stamping the id on only the exercise next to the boundary
  // left the rest of the right-hand block on its old id, so joining two
  // supersets produced [A0 B0 C0 D1] and D — a group of one — was dissolved.
  // Tapping "Superset with next" between two supersets silently un-supersetted
  // the last exercise.
  {
    const g = (n) => (n === undefined ? null : n);
    const four = [ex('a', 3, { group: 0 }), ex('b', 3, { group: 0 }),
      ex('c', 3, { group: 1 }), ex('d', 3, { group: 1 })];
    const joined = st.toggleLink(four, 1).map((e) => g(e.group));
    ok(joined.every((x) => x != null && x === joined[0]),
       `joining two supersets makes ONE block of four, losing nobody (${JSON.stringify(joined)})`);
    ok(st.blocksOf(st.toggleLink(four, 1))[0].items.length === 4,
       'and it is a giant set');

    // The same trap from the other side: a solo joined onto an existing block.
    const solo = st.toggleLink([ex('a'), ex('b', 3, { group: 0 }), ex('c', 3, { group: 0 })], 0);
    ok(st.blocksOf(solo).length === 1 && st.blocksOf(solo)[0].items.length === 3,
       'joining a lone exercise onto a superset grows it to a tri-set');
  }

  /* ---- an orphaned group is not a group ---- */
  // Both save paths drop entries with nothing in them, and the edit form can
  // remove one outright. Either leaves the survivor claiming to be in a
  // superset, and the day view would bracket it alone and label it "Superset" —
  // a false statement about what the user actually did.
  {
    const kept = st.dropOrphanGroups([
      { exerciseId: 'a', group: 0 },
      { exerciseId: 'b', group: 1 }, { exerciseId: 'c', group: 1 },
    ]);
    ok(kept[0].group === undefined, 'an entry left alone in its group loses the group');
    ok(kept[1].group === 1 && kept[2].group === 1, 'while a real pair keeps it');
    ok(st.dropOrphanGroups([]).length === 0 && st.dropOrphanGroups(null).length === 0,
       'and it copes with nothing at all');
  }

  /* ---- the banner only offers members that are IN this round ---- */
  {
    const steps = st.stepsFor([{ sets: 3, group: 0 }, { sets: 1, group: 0 }]);
    ok(steps[0].roundMembers.length === 2, 'round one has both members');
    ok(steps[2].roundMembers.length === 1 && steps[2].roundMembers[0] === 0,
       'and later rounds list only who is still in them — a button to a step that '
       + 'does not exist would do nothing and say nothing');
    ok(steps.every((s) => s.roundMembers.includes(s.entryIndex)),
       'every step is in its own round');
  }

  /* ---- a group of one is never a group ---- */
  {
    // Reached by deleting the other member, which is an ordinary thing to do.
    const orphan = st.normalizeGroups([ex('a', 3, { group: 7 }), ex('b')]);
    ok(orphan[0].group === undefined, 'a group with one member left dissolves');
    // And the same id appearing in two separate runs is two blocks, not one.
    const scattered = st.normalizeGroups([
      ex('a', 3, { group: 1 }), ex('b', 3, { group: 1 }),
      ex('c'), ex('d', 3, { group: 1 }), ex('e', 3, { group: 1 }),
    ]);
    ok(scattered[0].group !== scattered[3].group,
       'the same id in two non-adjacent runs is renumbered into two blocks');
  }

  /* ---- THE WALK. This is what makes a superset a superset ---- */
  {
    let list = [ex('a', 3), ex('b', 3), ex('c', 2)];
    list = st.toggleLink(list, 0);           // a+b supersetted, c on its own
    const steps = st.stepsFor(list);
    const shape = steps.map((s) => `${s.entryIndex}r${s.round == null ? '-' : s.round}${s.restsAfter ? '*' : ''}`);
    ok(shape.join(' ') === '0r0 1r0* 0r1 1r1* 0r2 1r2* 2r-*',
       `a superset alternates A,B,A,B — not all of A then all of B (${shape.join(' ')})`);

    // The rest rule IS the feature. Rest belongs after the last exercise of a
    // round; a timer that fired between them would be telling you to do the
    // opposite of what a superset is.
    ok(steps.filter((s) => s.restsAfter).length === 4,
       'rest comes once per round, plus once for the solo exercise');
    ok(steps[0].restsAfter === false, 'and never in the middle of a round');
    ok(steps[6].round === null && steps[6].restsAfter === true,
       'a solo exercise is still one step that rests after it');
  }

  /* ---- a short member drops out of the later rounds ---- */
  {
    let list = [ex('a', 3), ex('b', 1)];
    list = st.toggleLink(list, 0);
    const steps = st.stepsFor(list);
    ok(steps.length === 4, 'a member planned for fewer sets does not hold up the block');
    ok(steps[0].restsAfter === false && steps[1].restsAfter === true,
       'round one still has two exercises in it');
    ok(steps[2].restsAfter === true,
       'and from round two the remaining exercise rests after each set');
  }

  /* ---- DROP SETS: one drop set is ONE hard set ---- */
  {
    // progress.md §6 locks this. It is true here BY CONSTRUCTION — drops live
    // inside the set object — so every existing count of `sets.length` keeps
    // counting one without knowing drop sets exist. Flattening them into `sets`
    // would have inflated every volume figure in the app.
    const sets = [
      { weight: 185, reps: 8, minis: [{ weight: 135, reps: 6 }, { weight: 95, reps: 8 }] },
      { weight: 185, reps: 7 },
    ];
    ok(st.hardSetCount(sets) === 2, 'two sets with drops on one of them is TWO hard sets, not four');
    ok(st.miniSetCount(sets) === 4, 'but four mini-sets were actually performed');
    ok(st.minisOf(sets[1]).length === 0 && Array.isArray(st.minisOf(sets[1])),
       'a set with no drops reports an empty array, never undefined');
    ok(st.setTypeLabel({ setType: st.DROP, minis: 2 }) === 'Drop set · 2 drops'
       && st.setTypeLabel({}) === 'Straight sets', 'a set type says what it is in words');
    ok(st.plannedMinis({ setType: st.DROP }) === 1 && st.plannedMinis({}) === 0,
       'a drop set with no count planned means one drop');
    ok(st.plannedMinis({ setType: st.MYO }) === 3,
       'a myo-rep with no count planned means three mini-sets — the usual 3–5');
    ok(st.setTypeLabel({ setType: st.MYO }) === 'Myo-reps · 3 mini-sets',
       'and it calls them mini-sets, not drops');
    ok(st.miniLabel(st.MYO, 2) === 'Mini-set 2' && st.miniLabel(st.DROP, 2) === 'Drop 2',
       'the two nested types name their continuations differently');
    ok(st.isNested(st.DROP) && st.isNested(st.MYO) && !st.isNested(null),
       'both nested types are recognised as nested, and straight sets are not');

    // ⚠️ The stored key was `drops` for the few hours when drop sets were the
    // only nesting type. Records written then must keep working, or the rename
    // silently eats somebody's workout.
    ok(st.minisOf({ weight: 100, drops: [{ weight: 60, reps: 8 }] }).length === 1,
       'a record written under the old `drops` key still reads back');
    ok(st.miniSetCount([{ weight: 100, drops: [{}, {}] }]) === 3,
       'and still counts its mini-sets');

    // ⚠️ AND THE PLAN SIDE OF THE RENAME, WHICH minisOf() DOES NOT COVER.
    // `drops` was the key on BOTH shapes: an array of mini-sets inside a
    // recorded set, and a COUNT on a workout exercise. minisOf() reads the old
    // array; plannedMinis() read only `minis`, so a workout planned with four
    // drops came back as one — the default — and a backup taken in that window
    // restores as a different workout from the one that was saved. Silent, and
    // it looks exactly like the plan having always said one.
    ok(st.plannedMinis({ setType: st.DROP, drops: 4 }) === 4,
       'a workout planned under the old `drops` key keeps its four drops');
    ok(st.plannedMinis({ setType: st.MYO, drops: 5 }) === 5,
       'and the same for myo-rep match sets');
    // `minis` wins where both are present, and an ARRAY under `drops` — the
    // recorded-set shape arriving where a count belongs — falls to the default
    // rather than to NaN.
    ok(st.plannedMinis({ setType: st.DROP, minis: 2, drops: 6 }) === 2,
       'the current key wins where a row carries both');
    ok(st.plannedMinis({ setType: st.DROP, drops: [{}, {}] }) === 1,
       'and a mini-set ARRAY under `drops` is not a count — it falls back to the default');
  }

  /* ---- it SURVIVES a round trip through the store ---- */
  // normalizeWorkout() rebuilds each exercise field by field, so a new field is
  // dropped on every read unless it is named there. That is the exact way this
  // feature could have looked finished and silently done nothing.
  {
    await store2.clearAll();
    const sys = await store2.saveSystem({ name: 'Set types' });
    const exId = BUILT_IN_EXERCISES[0].id;
    const exId2 = BUILT_IN_EXERCISES[1].id;
    await store2.saveWorkout({
      name: 'Grouped', systemId: sys.id,
      exercises: [
        { exerciseId: exId, sets: 3, notes: '', group: 0 },
        { exerciseId: exId2, sets: 3, notes: '', group: 0 },
        { exerciseId: BUILT_IN_EXERCISES[2].id, sets: 3, notes: '', setType: 'drop', minis: 2 },
        { exerciseId: BUILT_IN_EXERCISES[3].id, sets: 3, notes: '', setType: 'myo' },
      ],
    });
    const back = (await store2.getWorkouts(sys.id))[0];
    ok(back.exercises[0].group != null && back.exercises[0].group === back.exercises[1].group,
       'a superset survives being written and read back');
    ok(back.exercises[2].setType === 'drop' && back.exercises[2].minis === 2,
       'and so does a drop set with its drop count');
    ok(back.exercises[3].setType === 'myo' && back.exercises[3].minis === 3,
       'a myo-rep survives too, defaulted to three mini-sets');
    ok(back.exercises[2].group === undefined, 'a solo exercise carries no group');

    // A recorded session keeps its drops, and they do not become extra sets.
    await store2.saveSession({
      workoutId: back.id, workoutName: 'Grouped', date: '2026-08-17',
      entries: [{
        exerciseId: exId, exerciseName: 'x', group: 0,
        sets: [{ weight: 185, reps: 8, minis: [{ weight: 135, reps: 6 }] }],
      }],
    });
    const saved = (await store2.getSessions())[0];
    ok(saved.entries[0].sets.length === 1, 'a recorded drop set is still one set');
    ok(st.minisOf(saved.entries[0].sets[0]).length === 1, 'with its drop kept alongside it');
    ok(saved.entries[0].group === 0, 'and the session remembers it was part of a superset');
    await store2.clearAll();
  }

  /* ---- the presets that document a superset now carry one ---- */
  {
    const { PRESET_SYSTEMS } = await import('../js/preset-systems.js');
    let found = 0;
    for (const p of PRESET_SYSTEMS) {
      for (const w of p.workouts) {
        for (const b of st.blocksOf(w.exercises)) if (b.group != null) found++;
      }
    }
    ok(found >= 2, `ready-made systems can express a superset and at least two do (${found})`);

    // And it survives being copied into an account — the thing that would
    // otherwise flatten somebody else's programme on the way in.
    await store2.clearAll();
    const { presetById } = await import('../js/preset-systems.js');
    const { system } = await store2.addPresetSystem(presetById('preset-nippard-ppl-2023'));
    const push = (await store2.getWorkouts(system.id)).find((w) => w.name === 'Push 1');
    const grouped = st.blocksOf(push.exercises).filter((b) => b.group != null);
    ok(grouped.length === 1 && grouped[0].items.length === 2,
       'copying Nippard\'s Push 1 brings its superset with it');
    await store2.clearAll();

    // THE POINT OF MYO-REPS. Dr. Mike's Floating Split is myo-reps almost end
    // to end, and until they existed it shipped with its structure flattened
    // and a warning saying so. Copying it must now bring them across.
    const iz = await store2.addPresetSystem(presetById('preset-israetel-floating-split'));
    const all = await store2.getWorkouts(iz.system.id);
    const myo = all.flatMap((w) => w.exercises).filter((e) => e.setType === st.MYO);
    ok(myo.length >= 8,
       `Dr. Mike's Floating Split copies in with its myo-reps intact (${myo.length} exercises)`);
    ok(myo.every((e) => e.minis >= 1), 'each with a mini-set count');
    // And the warning no longer claims the structure was stripped out, because
    // it is not — a warning that has stopped being true is worse than none.
    const preset = presetById('preset-israetel-floating-split');
    ok(!/only record straight sets|structure stripped/i.test(preset.warning),
       'and the warning no longer says the structure was removed');
    ok(/CUTTING split/.test(preset.warning),
       'while still leading with what IS still true of it');
    await store2.clearAll();

    // THE SYSTEM SET TYPES WERE BUILT FOR. Chris Bumstead's programme is drop
    // sets, a tri-set and a superset; as a flat list it would have been a list
    // of the exercises in his programme rather than his programme. Copying it
    // has to bring all three across or the feature bought nothing.
    const cb = await store2.addPresetSystem(presetById('preset-bumstead-8day'));
    const cbWorkouts = await store2.getWorkouts(cb.system.id);
    const cbAll = cbWorkouts.flatMap((w) => w.exercises);
    ok(cbAll.filter((e) => e.setType === st.DROP).length === 8,
       `Bumstead copies in with all eight drop sets (${cbAll.filter((e) => e.setType === st.DROP).length})`);

    const cbBlocks = cbWorkouts.flatMap((w) => st.blocksOf(w.exercises)).filter((b) => b.group != null);
    const sizes = cbBlocks.map((b) => b.items.length).sort();
    ok(sizes.join(',') === '2,3',
       `and with one superset and one tri-set intact (blocks of ${sizes.join(' and ')})`);
    ok(cbBlocks.some((b) => st.groupLabel(b.items.length) === 'Tri-set'),
       'the tri-set is recognised as a tri-set');
    await store2.clearAll();

    // ⚠️ A COPY MUST RATE THE SAME AS THE ORIGINAL. Tim, 2026-08-18: the
    // percentage on Explore differed from the same system in his library,
    // because addPresetSystem dropped the programme's own days-per-week and the
    // copy fell back to "one pass a week". Push Pull Legs is three workouts
    // trained six days — as a three-day programme it scores far lower.
    for (const id of ['preset-ppl', 'preset-bumstead-8day', 'preset-arnold-golden-six']) {
      const p = presetById(id);
      const { system } = await store2.addPresetSystem(p);
      const saved = await store2.getSystem(system.id);
      ok(saved.daysPerWeek === p.daysPerWeek,
         `${p.name} copies in carrying its ${p.daysPerWeek} days a week`);
      ok((saved.cycleDays || 0) === (p.cycleDays || 0),
         'and its cycle length, which is what makes an 8-day split an 8-day split');
      await store2.clearAll();
    }
  }
}

/* ================================================================== *
 * ⚠️ trainingForMuscle() counts CALENDAR days, in every timezone
 *
 * The "why progress stalls" numbers on the Goals screen — sets a week and
 * sessions a week on one muscle — are a rate, so they are only as good as the
 * day count underneath them.
 *
 * That day count used to be `Math.floor(localMidnight / 86400000)`, which is a
 * stable index only while the zone's UTC offset stays on one side of zero.
 * Europe/London, Dublin, Lisbon and the Canaries are UTC+0 in winter and UTC+1
 * in summer, so local midnight sits on the same UTC day all winter and on the
 * PREVIOUS one all summer — and the index steps by 0 or 2 across each DST
 * change. Measured before the fix: 28 consecutive training days spanning
 * 29 March 2026 reported a 27-day span and 14.52 sets a week instead of 14.00.
 *
 * Run in a CHILD PROCESS under an explicit TZ. Node cannot restore the system
 * zone once process.env.TZ has been reassigned, so flipping it in-process would
 * silently re-zone every assertion after this one.
 * ================================================================== */
{
  const { execFileSync } = await import('node:child_process');
  const storeUrl = new URL('../js/store.js', import.meta.url).href;
  const exUrl = new URL('../js/exercises.js', import.meta.url).href;
  const probe = `
    const mem = new Map();
    globalThis.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
    const { store, trainingForMuscle } = await import(${JSON.stringify(storeUrl)});
    const { BUILT_IN_EXERCISES } = await import(${JSON.stringify(exUrl)});
    const bench = BUILT_IN_EXERCISES.find((e) => e.name === 'Barbell Bench Press');
    // 28 consecutive days of two bench sets, straddling the spring DST change.
    const sessions = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(Date.UTC(2026, 2, 15) + i * 86400000).toISOString().slice(0, 10);
      sessions.push({ id: 's' + i, workoutId: 'w', workoutName: 'W', date: d,
        entries: [{ exerciseId: bench.id, exerciseName: bench.name,
          sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }] }] });
    }
    await store.importAll({ sessions });
    const t = await trainingForMuscle('Chest', 28, '2026-04-11');
    console.log(JSON.stringify([t.sessions, t.spanDays, Math.round(t.weeklySets * 100) / 100]));
  `;
  const run = (tz) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', probe],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim());

  const london = run('Europe/London');
  ok(london[1] === 28,
     '⚠️ 28 consecutive training days span 28 days in Europe/London too — the clocks going '
     + 'forward must not shorten the window a weekly rate is divided by');
  ok(london[2] === 14,
     'so two sets a day for four weeks is 14 sets a week, not 14.52 — a rate is only as good as '
     + 'the day count under it');

  // Vacuity guard: a zone whose offset never crosses UTC+0 was always right, so
  // the assertions above are about the ZONE rather than about these dates.
  const ny = run('America/New_York');
  ok(JSON.stringify(ny) === JSON.stringify(london),
     'and every zone agrees — a calendar day is not a local instant');
}

/* ==================================================================
 * THE READ CACHE — 2026-08-22
 *
 * Tim reported the nav bar feeling laggy on his iPhone on good signal.
 * Measured: building a screen costs 11-72 ms at 4x CPU throttling, and every
 * tab then asked the backend for whole collections it had already been given —
 * Workouts 5 reads, Goals 7, and `sessions` re-fetched by four of the six. On
 * Firestore each of those is a getDoc that waits for the server even with
 * offline persistence on. It was never Firebase being slow.
 *
 * ⚠️ The dangerous half is not the speed, it is WHICH reads may be cached. This
 * store does read-modify-write everywhere, and serving one of those from a
 * cache means writing a whole collection back from a stale copy — which erases
 * anything changed elsewhere. So: getters cached, mutations never.
 * ================================================================== */
{
  const { store: st, clearReadCache } = await import('../js/store.js');

  // Count trips to real storage, which is what a getDoc would be in the cloud.
  const realGet = localStorage.getItem;
  let hits = [];
  localStorage.getItem = (k) => { hits.push(k); return realGet(k); };
  const readsOf = (c) => hits.filter((k) => k === 'ftrack:v1:' + c).length;

  await st.clearAll();
  clearReadCache();

  hits = [];
  await st.getSessions();
  const firstReads = readsOf('sessions');
  await st.getSessions();
  await st.getSessions();
  ok(firstReads === 1 && readsOf('sessions') === 1,
     `three getSessions() calls hit storage once, not three times (${readsOf('sessions')})`);

  // ⚠️ Fast is worthless if it is wrong. A write must be visible immediately —
  // the cache records what was written rather than waiting to be told.
  const cw = await st.saveWorkout({ name: 'Cache test', exercises: [] });
  await st.saveSession({ workoutId: cw.id, workoutName: 'Cache test', date: '2026-08-22', entries: [] });
  const after = await st.getSessions();
  ok(after.length === 1 && after[0].workoutName === 'Cache test',
     'and a session saved a moment ago is in the very next read, not one refresh later');

  // ⚠️ THE SAFETY PROPERTY. saveSettings is a read-modify-write: it merges a
  // patch into the stored row and writes the whole row back. If it read through
  // the cache, a value changed anywhere else would be silently overwritten.
  await st.saveSettings({ units: 'lbs' });
  await st.getSettings();                       // warm the cache
  const raw = JSON.parse(localStorage.getItem('ftrack:v1:settings'));
  raw[0].gender = 'female';                     // changed behind the store's back
  localStorage.setItem('ftrack:v1:settings', JSON.stringify(raw));
  await st.saveSettings({ units: 'kg' });       // must NOT write from the cached copy
  const merged = JSON.parse(localStorage.getItem('ftrack:v1:settings'))[0];
  ok(merged.units === 'kg' && merged.gender === 'female',
     '⚠️ a read-modify-write reads FRESH — saving units does not erase a field set elsewhere');

  // The rows handed out are a copy of the list, so a caller sorting or
  // splicing them cannot reorder what everybody else is about to be given.
  clearReadCache();
  const listA = await st.getSessions();
  listA.length = 0;
  const listB = await st.getSessions();
  ok(listB.length === 1, 'emptying a returned array does not empty the cache behind it');

  clearReadCache();
  ok((await st.getSessions()).length === 1,
     'and clearing the cache re-reads from storage rather than returning nothing');

  localStorage.getItem = realGet;
}

/* ==================================================================
 * WORKOUT DURATION — the estimate on Record and the minutes on feed cards
 * (Tim, 2026-08-26). The timer he asked for already existed: startedAt and
 * finishedAt are on every session. These pin the read side.
 * ================================================================== */
{
  const { sessionMinutes, roundMinutes, estimateWorkoutMinutes } =
    await import('../js/next-workout.js');

  const s = (mins) => ({
    workoutId: 'w1',
    startedAt: '2026-08-20T10:00:00.000Z',
    finishedAt: new Date(Date.parse('2026-08-20T10:00:00.000Z') + mins * 60000).toISOString(),
  });

  ok(sessionMinutes(s(47)) === 47, 'a session knows how long it took');
  ok(sessionMinutes(s(2)) === null, 'under five minutes is not a workout — dropped');
  ok(sessionMinutes(s(14 * 60)) === null, 'a draft left open overnight is dropped, not averaged in');
  ok(sessionMinutes({ startedAt: 'x', finishedAt: 'y' }) === null, 'garbage stamps are dropped');
  ok(sessionMinutes({}) === null, 'sessions from before finishedAt existed are dropped');

  ok(roundMinutes(47) === 45 && roundMinutes(48) === 50, 'estimates round to the nearest 5 minutes');
  ok(roundMinutes(2) === 5, 'and never below 5');

  const w = { id: 'w1', exercises: [{ sets: 4 }, { sets: 3 }, { sets: 3 }] };
  const none = estimateWorkoutMinutes(w, []);
  ok(none && none.minutes === 30 && none.measured === false,
     `no history falls back to sets × 3 min (${none && none.minutes})`);
  const one = estimateWorkoutMinutes(w, [s(52)]);
  ok(one && one.minutes === 50 && one.measured === true && one.count === 1,
     'one recording replaces the guess with a measurement');
  const many = estimateWorkoutMinutes(w, [s(40), s(45), s(240), s(46)]);
  ok(many && many.minutes === 45,
     `the MEDIAN, so one four-hour outlier cannot drag the estimate (${many && many.minutes})`);
  ok(estimateWorkoutMinutes({ id: 'w2', exercises: [] }, []) === null,
     'a workout with no sets estimates nothing rather than "5 min"');
}

/* ==================================================================
 * GUEST SESSIONS — a name with no account (Open work 0e, guest half)
 *
 * The load-bearing property is SEPARATION: a guest's training is stored in
 * its own collection, so nothing that reads `sessions` — the muscle map, the
 * charts, volume, the social projection — can ever count it as the owner's.
 * These tests pin the separation from both sides, because a one-way check
 * would pass if both reads were accidentally pointed at the same rows.
 * ================================================================== */
{
  const { store: st, clearReadCache } = await import('../js/store.js');
  await st.clearAll();
  clearReadCache();

  const guestRow = await st.saveGuestSession({
    guestName: 'Alex',
    workoutId: 'w1', workoutName: 'Push',
    date: '2026-08-20',
    entries: [{ exerciseId: 'bench', exerciseName: 'Barbell Bench Press',
      sets: [{ weight: 95, reps: 8 }] }],
  });
  ok(Boolean(guestRow.id), 'a guest session gets an id');

  await st.saveSession({
    workoutId: 'w1', workoutName: 'Push', date: '2026-08-21',
    entries: [{ exerciseId: 'bench', exerciseName: 'Barbell Bench Press',
      sets: [{ weight: 185, reps: 5 }] }],
  });

  const mine = await st.getSessions();
  const theirs = await st.getGuestSessions();
  ok(mine.length === 1 && mine[0].entries[0].sets[0].weight === 185,
     '⚠️ the owner\'s sessions do not contain the guest\'s training');
  ok(theirs.length === 1 && theirs[0].guestName === 'Alex' && theirs[0].entries[0].sets[0].weight === 95,
     '⚠️ the guest\'s session is readable, under their name, with their numbers');

  // Newest first, same contract as getSessions.
  await st.saveGuestSession({ guestName: 'Alex', workoutId: 'w1', workoutName: 'Push',
    date: '2026-08-22', entries: [] });
  const sorted = await st.getGuestSessions();
  ok(sorted[0].date === '2026-08-22' && sorted[1].date === '2026-08-20',
     'guest sessions come back newest first');

  // Passing the id back is an UPSERT, not an insert — this is what makes
  // tapping Finish twice after a mid-save failure safe rather than doubling.
  await st.saveGuestSession({ ...guestRow, workoutName: 'Push (edited)' });
  ok((await st.getGuestSessions()).length === 2,
     '⚠️ re-saving with the same id updates in place rather than duplicating');

  await st.deleteGuestSession(guestRow.id);
  ok((await st.getGuestSessions()).length === 1
     && (await st.getSessions()).length === 1,
     'deleting a guest session leaves the owner\'s sessions alone');

  // A backup carries guests, and restore gatekeeps them like sessions: the
  // getter sorts on the date, so a dateless row would crash every read.
  const dump = await st.exportAll();
  ok(Array.isArray(dump.guestSessions) && dump.guestSessions.length === 1,
     'a backup carries guest sessions');
  let refused = null;
  // The row carries an id so the generic id gate cannot be the one that
  // fires — this pins the DATE gate specifically, the field whose absence
  // crashes getGuestSessions()'s sort.
  try { st.inspectBackup({ guestSessions: [{ id: 'g-1', guestName: 'Alex' }] }); }
  catch (e) { refused = e.message; }
  ok(Boolean(refused) && /date/.test(refused),
     `a guest row with no date is refused before anything is written (${refused})`);

  await st.clearAll();
  clearReadCache();
  ok((await st.getGuestSessions()).length === 0, 'clearAll clears guest sessions too');
}


/* ---------- the profile-photo cropper (js/image-crop.js) ----------
 *
 * Tim, 2026-08-26: the old centre-crop cut a square out of the middle of a
 * phone photo and hoped, so a face that was not dead centre became an avatar of
 * somebody's shoulder. What is asserted here is the ONE invariant the editor
 * rests on — the crop square never leaves the image — because the way that
 * fails is a stored avatar with a blank wedge in it, which the round display
 * renders as a broken picture rather than as a choice.
 */
{
  const crop = await import('../js/image-crop.js');

  const b = crop.cropBounds(3000, 4000);
  ok(b.maxSide === 3000, 'zoomed right out, the crop is the whole SHORT edge (3000 of 3000x4000)');
  ok(b.minSide === 750, 'zoomed right in, four times closer and no further');

  // A small image must stay usable rather than having no zoom range at all.
  ok(crop.cropBounds(200, 200).minSide === 64, 'a small photo keeps a 64px floor to zoom into');
  ok(crop.cropBounds(50, 50).minSide === 50, 'a photo smaller than the floor cannot zoom past itself');
  ok(crop.canZoom(3000, 4000) === true && crop.canZoom(50, 50) === false,
     'and the editor is told which of those it is, so the slider can say so');

  // ⚠️ THE INVARIANT, swept rather than sampled. Every zoom, every centre,
  // including centres far outside the image, must produce a rect inside it.
  let escaped = 0, swept = 0;
  for (const [w, h] of [[3000, 4000], [4000, 3000], [640, 640], [200, 300], [51, 90]]) {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      for (const cx of [-9999, -1, 0, w / 3, w / 2, w, w + 9999]) {
        for (const cy of [-9999, 0, h / 2, h, h + 9999]) {
          const r = crop.cropRect(w, h, t, cx, cy);
          swept++;
          if (r.x < 0 || r.y < 0 || r.x + r.side > w || r.y + r.side > h || r.side < 1) escaped++;
        }
      }
    }
  }
  ok(swept > 1000 && escaped === 0,
     `the crop square never leaves the image (${swept} combinations, ${escaped} escapes)`);

  // The sign. Dragging the picture RIGHT shows more of its LEFT, so the crop
  // centre moves left — get this backwards and the photo runs away from the
  // finger, which is the whole feel of the control.
  const mid = crop.panBy(1000, 1000, 0.5, 500, 500, 40, 0, 300);
  ok(mid.cx < 500, 'dragging the photo right moves the crop centre LEFT');
  ok(crop.panBy(1000, 1000, 0.5, 500, 500, 0, 40, 300).cy < 500, 'and the same downward');

  // Dragging is in SOURCE pixels, so the same swipe moves the same amount of
  // picture whatever size the phone rendered the stage at.
  const small = crop.panBy(2000, 2000, 0, 1000, 1000, 30, 0, 300);
  const large = crop.panBy(2000, 2000, 0, 1000, 1000, 60, 0, 600);
  ok(near(small.cx, large.cx, 1e-6), 'a drag is measured in the picture, not in screen pixels');

  // Zooming out at the edge slides back in rather than refusing to move.
  const corner = crop.zoomTo(1000, 1000, 1, 100, 100);
  const out = crop.zoomTo(1000, 1000, 0, corner.cx, corner.cy);
  ok(out.cx === 500 && out.cy === 500, 'zooming out from a corner re-centres rather than jamming');

  // layout() and cropRect() must describe the SAME rectangle, or the circle
  // shows one thing and the saved file is another — the exact complaint the
  // feature exists to fix.
  const FRAME = 300;
  for (const [zoom, cx, cy] of [[0, 1500, 2000], [0.5, 900, 1200], [1, 800, 3200]]) {
    const box = crop.layout(3000, 4000, zoom, cx, cy, FRAME);
    const rect = crop.cropRect(3000, 4000, zoom, cx, cy);
    const srcX = (0 - box.left) / box.scale;
    const srcY = (0 - box.top) / box.scale;
    ok(near(srcX, rect.x, 1.5) && near(srcY, rect.y, 1.5),
       `what the circle frames is what gets cut (zoom ${zoom})`);
    ok(near(FRAME / box.scale, rect.side, 1.5), `and at the same size (zoom ${zoom})`);
  }

  ok(crop.initialCrop(3000, 4000).zoom === 0,
     'a photo opens zoomed right out, showing the most of itself it can');
  const sq = crop.cropRect(4000, 4000, 0, 2000, 2000);
  ok(sq.side === 4000 && sq.x === 0 && sq.y === 0,
     'a square photo zoomed out is the whole photo, so nothing is cropped away by default');
}


/* ---------- the Activity group (docs/activities-plan.md §3 item 1) ----------
 *
 * A group added for the WORDS — "Rock Climbing · Cardio" read as though the app
 * thought a climb was a treadmill. ⚠️ The whole risk of the change is that it
 * splits things off the one shelf the model already refused, so the refusals
 * have to be inherited rather than re-earned. If Activity is missing from
 * either list below, a swim starts counting as training: weekly sets against a
 * muscle, a programme rating that moves, a percentile on a hike. That is D27
 * failing silently, which is the only way it could fail.
 */
{
  const { UNRANKABLE } = await import('../js/strength-standards.js');
  const { weeklyVolume } = await import('../js/volume-map.js');
  const { MUSCLE_GROUPS } = await import('../js/exercises.js');

  ok(MUSCLE_GROUPS.includes('Activity'), 'Activity is a group a user can filter the library by');
  ok(UNRANKABLE.includes('Activity'),
     '⚠️ and it is UNRANKABLE — no published standard turns a 40-minute hike into a percentile');
  ok(UNRANKABLE.includes('Cardio'), 'and Cardio still is too, which the split must not have moved');

  const activities = BUILT_IN_EXERCISES.filter((e) => e.muscle === 'Activity');
  ok(activities.length >= 8, `the things you go and do are on it (${activities.length})`);
  for (const name of ['Running', 'Swimming', 'Rock Climbing', 'Hiking', 'Walking']) {
    ok(activities.some((e) => e.name === name), `  ${name} is an Activity, not a muscle group`);
  }
  // The line between the two shelves is WHERE you do it, so the gym machines
  // must have stayed put — moving them would change what a treadmill interval
  // inside a real workout counts as.
  ok(byName('Treadmill Run').muscle === 'Cardio', 'a treadmill is still Cardio — it is training');
  ok(byName('Rowing Machine').muscle === 'Cardio', 'and so is the rower');

  // ⚠️ THE ONE THAT MATTERS. Driven through the real function rather than read
  // off the NO_VOLUME set, because the set being right is not the same claim as
  // the volume model consulting it.
  const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
  const sum = (m) => [...m.values()].reduce((a, v) => a + v, 0);
  const swimId = byName('Swimming').id;
  const climbId = byName('Rock Climbing').id;
  const total = sum(weeklyVolume([{
    name: 'Sunday', exercises: [{ exerciseId: swimId, sets: 3 }, { exerciseId: climbId, sets: 3 }],
  }], exMap, 1));
  ok(total === 0, '⚠️ six sets of swimming and climbing produce ZERO weekly volume on every muscle');

  // ⚠️ VACUITY GUARD. The zero above proves nothing unless the identical call
  // shape counts a real lift — and the first version of this test got the
  // signature wrong, totalled zero for the bench press too, and would have
  // shipped as a pass. That is the whole reason this line exists.
  const liftedTotal = sum(weeklyVolume([{
    name: 'Sunday', exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 3 }],
  }], exMap, 1));
  ok(liftedTotal > 0,
     `and the same call counts three sets of bench (${liftedTotal.toFixed(1)}), so the zero is a result`);

  // ⚠️ REP NORMALISATION MUST NEVER REACH AN ACTIVITY — activities-plan §3
  // item 3. It holds today because canNormalize() demands both a weight and a
  // reps field and a distance/time exercise has neither, so this is a
  // by-construction guarantee rather than a check somewhere. Pinned anyway:
  // the way it would break is somebody relaxing that condition for a reason
  // that has nothing to do with running, and a mile does not have a one-rep max.
  for (const name of ['Running', 'Swimming', 'Rock Climbing', 'Hiking']) {
    const ex = byName(name);
    ok(canNormalize(ex, { bodyWeight: 180 }) === false,
       `  ${name} is never converted to an equivalent load`);
  }
  ok(canNormalize(byName('Barbell Bench Press'), {}) === true,
     'while an ordinary lift still is, so the four above are a result and not a broken call');
}


/* ---------- importing a file from another app (js/import-file.js) ----------
 *
 * docs/integrations-plan.md Phase 1. ⚠️ NOTHING HERE HAS EVER SEEN A REAL
 * EXPORT FILE from Strava, MacroFactor or anyone else — the column names come
 * from published documentation. So what is asserted is not "we parse Strava
 * correctly", which would be a claim this project cannot back. It is the three
 * things that would corrupt somebody's history SILENTLY if they were wrong:
 * the date order, the weight unit, and whether importing twice duplicates.
 */
{
  const imp = await import('../js/import-file.js');

  /* --- CSV, the boring part that breaks everything downstream --- */
  const csv = imp.parseCSV('a,b,c\ntwo,"two, with comma",3\n4,"say ""hi""",6\n');
  ok(csv.length === 3, 'a header and two rows');
  ok(csv[1][1] === 'two, with comma',
     '⚠️ a comma INSIDE quotes is one field — splitting on "," shifts every column after it');
  ok(csv[2][1] === 'say "hi"', 'and an escaped quote comes back as one quote');
  ok(imp.parseCSV('﻿date,x\n2026-01-01,1\n')[0][0] === 'date',
     'a leading BOM is stripped — Excel writes one and it corrupts the first header');
  ok(imp.parseCSV('a,b\r\n1,2\r\n').length === 2, 'CRLF line endings read the same as LF');

  /* --- finding the columns --- */
  const cols = imp.detectColumns(['Activity Date', 'Activity Name', 'Distance', 'Moving Time', 'Elapsed Time']);
  ok(cols.date === 'Activity Date' && cols.name === 'Activity Name', 'headers are matched by name');
  ok(cols.duration === 'Moving Time',
     '⚠️ moving time wins over elapsed time — they are different numbers and a pace needs the first');
  ok(imp.detectColumns(['DATE', 'weight_kg']).date === 'DATE',
     'matching ignores case and punctuation');

  /* --- ⚠️ THE DATE ORDER. This is the one that would be wrong silently. --- */
  ok(imp.readDate('2026-08-26') === '2026-08-26', 'ISO is read as ISO');
  ok(imp.readDate('2026-08-26T10:17:33Z') === '2026-08-26', 'and an ISO timestamp keeps its day');
  ok(imp.readDate('Aug 26, 2026, 10:17:33 AM') === '2026-08-26', 'a named month cannot be ambiguous');
  ok(imp.readDate('26 Aug 2026') === '2026-08-26', 'in either order');
  ok(imp.readDate('26/08/2026') === '2026-08-26',
     '26/08 can only be day-first, because there is no 26th month, so it resolves without asking');
  ok(imp.readDate('08/26/2026') === '2026-08-26', 'and 08/26 can only be month-first');
  // The one that matters: both numbers under 13, so the cell cannot say.
  ok(imp.readDate('03/04/2026').ambiguous === true,
     '⚠️ 03/04/2026 REFUSES to resolve itself — it is 3 April or 4 March and nothing says which');
  ok(imp.readDate('03/04/2026', 'dmy') === '2026-04-03', 'told day-first, it is 3 April');
  ok(imp.readDate('03/04/2026', 'mdy') === '2026-03-04', 'told month-first, it is 4 March');

  // A whole column can usually settle it, and must say so honestly when it cannot.
  ok(imp.dateOrderOf(['03/04/2026', '26/08/2026']) === 'dmy',
     'one unambiguous cell settles the order for the whole column');
  ok(imp.dateOrderOf(['03/04/2026', '08/26/2026']) === 'mdy', 'and the other way');
  ok(imp.dateOrderOf(['03/04/2026', '05/06/2026']) === 'ambiguous',
     '⚠️ a column with no evidence in it reports ambiguous rather than picking one');
  ok(imp.dateOrderOf(['2026-01-01']) === 'none', 'and ISO dates need no ruling at all');

  /* --- durations and distances --- */
  ok(imp.readDuration('1:23:45') === 5025, 'h:mm:ss');
  ok(imp.readDuration('23:45') === 1425, 'mm:ss');
  ok(imp.readDuration('1800') === 1800, 'a bare number is seconds');
  ok(imp.readDuration('30', 'minutes') === 1800, 'unless the header said minutes');
  ok(Math.abs(imp.toMiles(5, 'km') - 3.106855) < 0.001, '5 km is 3.11 miles');
  ok(Math.abs(imp.toMiles(5000, 'm') - 3.106855) < 0.001, 'and 5000 m is the same distance');
  ok(imp.distanceUnitOf('Distance (km)') === 'km' && imp.distanceUnitOf('distance_mi') === 'mi',
     'the unit is read from the column header');

  /* --- ⚠️ THE WEIGHT UNIT, which is the other silent corruption --- */
  const wcols = { date: 'date', weight: 'weight' };
  const wrecs = [{ date: '2026-08-01', weight: '75' }];
  const noUnit = imp.readWeights(wrecs, wcols, {});
  ok(noUnit.needsUnit === true && noUnit.rows.length === 0,
     '⚠️ a weight column with no unit in its name imports NOTHING and asks — 75 kg read as 75 lb '
     + 'would record somebody at a third of their real weight');
  const asKg = imp.readWeights(wrecs, wcols, { weightUnit: 'kg' });
  ok(Math.abs(asKg.rows[0].weight - 165.35) < 0.02, 'told kg, 75 becomes 165.3 lbs');
  const asLb = imp.readWeights(wrecs, wcols, { weightUnit: 'lb' });
  ok(asLb.rows[0].weight === 75, 'told lbs, 75 stays 75 — everything is stored in pounds');
  ok(imp.readWeights([{ date: '2026-08-01', weight: '7' }], wcols, { weightUnit: 'lb' })
     .problems.implausible === 1,
     'a 7 lb body weight is refused rather than rewriting every pull-up on that day');

  /* --- ⚠️ RE-IMPORTING THE SAME FILE MUST NOT DOUBLE ANYTHING --- */
  const acols = { date: 'Date', name: 'Name', distance: 'Distance', duration: 'Time' };
  const arecs = [
    { Date: '2026-08-01', Name: 'Morning Run', Distance: '3.1', Time: '28:00' },
    { Date: '2026-08-03', Name: 'Swim', Distance: '', Time: '35:00' },
    { Date: '2026-08-04', Name: 'Nothing', Distance: '', Time: '' },
  ];
  // ⚠️ A bare "Distance" header does not say its unit, so nothing is read until
  // the caller says which. Strava exports kilometres; reading them as miles
  // makes every run 61 % long, silently. Caught by driving a Strava-shaped file
  // through the screen, not by reading the code.
  const noUnit2 = imp.readActivities(arecs, acols, {});
  ok(noUnit2.needsDistanceUnit === true && noUnit2.rows.length === 0,
     '⚠️ an unlabelled distance column imports NOTHING and asks, exactly like weight does');
  ok(imp.readActivities(arecs, { ...acols, distance: 'Distance (km)' }, {}).rows.length === 2,
     'while a header that names its unit needs no question');
  const asKm = imp.readActivities(arecs, acols, { distanceUnit: 'km' });
  ok(Math.abs(asKm.rows[0].entries[0].sets[0].distance - 1.93) < 0.02,
     'and 3.1 km comes in as 1.93 miles, not 3.1');
  const first = imp.readActivities(arecs, acols, { distanceUnit: 'mi' });
  ok(first.rows.length === 2, 'two readable activities');
  ok(first.problems.empty === 1, 'and a row recording neither a distance nor a time is skipped');
  const again = imp.readActivities(arecs, acols, { distanceUnit: 'mi' });
  ok(first.rows[0].id === again.rows[0].id,
     '⚠️ the SAME row produces the SAME id every time — this is what makes a re-import an upsert');
  ok(first.rows[0].id !== first.rows[1].id, 'and two different rows do not collide');

  const keyOf = (r) => `${r.date}|${(r.workoutName || '').toLowerCase()}`;
  const plan = imp.planImport(first.rows,
    [{ id: first.rows[0].id, date: '2026-08-01', workoutName: 'Morning Run' }], keyOf);
  ok(plan.fresh.length === 1 && plan.repeat === 1,
     'importing the same export twice adds only what is new');
  ok(imp.planImport(first.rows, [], keyOf).fresh.length === 2,
     'and a first import brings everything in');

  // Something logged by hand on the same day is FLAGGED, not silently dropped —
  // whether it is the same session is the user's call, not the parser's.
  const collide = imp.planImport(first.rows,
    [{ id: 'typed-by-hand', date: '2026-08-01', workoutName: 'morning run' }], keyOf);
  ok(collide.collides === 1 && collide.fresh.length === 2,
     'a same-day same-name record already there is counted and reported, not dropped');

  /* --- an imported activity is exactly what the quick log writes (D27) --- */
  const row = first.rows[0];
  ok(!row.workoutId,
     '⚠️ an imported activity has NO workoutId, so the rotation suggestion skips it');
  ok(row.entries.length === 1 && row.entries[0].sets.length === 1,
     'one entry, one set — the shape every existing screen already reads');
  ok(row.entries[0].sets[0].time === 1680 && row.entries[0].sets[0].distance === 3.1,
     'carrying the time and distance that were in the file');

  /* --- the batch write, which is the other half of "import twice is safe" --- */
  const { store: ist, clearReadCache: iclear } = await import('../js/store.js');
  await ist.clearAll();
  iclear();
  const r1 = await ist.importRows('sessions', first.rows);
  ok(r1.added === 2 && r1.replaced === 0, 'a first import adds both activities');
  const r2 = await ist.importRows('sessions', again.rows);
  ok(r2.added === 0 && r2.replaced === 2,
     '⚠️ and importing the identical file again REPLACES rather than adding — no doubled training');
  iclear();
  ok((await ist.getSessions()).length === 2, 'so the account still holds two sessions, not four');

  // Weigh-ins merge by DAY, because this store has always kept one per day.
  const w1 = await ist.importRows('bodyWeight', [
    { id: 'imp_bw_a', date: '2026-08-01', weight: 180 },
    { id: 'imp_bw_b', date: '2026-08-02', weight: 181 },
  ]);
  ok(w1.added === 2, 'two weigh-ins on two days');
  const w2 = await ist.importRows('bodyWeight', [{ id: 'imp_bw_c', date: '2026-08-01', weight: 179 }]);
  ok(w2.replaced === 1 && w2.added === 0,
     '⚠️ a second reading on a day already recorded REPLACES it — one weigh-in per day, as always');
  iclear();
  const bws = await ist.getBodyWeights();
  ok(bws.length === 2, 'so there are still two days');
  ok(bws.find((b) => b.date === '2026-08-01').id === 'imp_bw_a',
     'and the original row keeps its id, so nothing pointing at it is orphaned');
  await ist.clearAll();
  iclear();
}

/* ================= ⚠️ THE SAME EXERCISE TWICE IN ONE SESSION =================
   Fixed 2026-08-28. Four readers did `entries.find(e => e.exerciseId === id)`
   and stopped at the first hit, so a second entry for the same exercise was
   invisible to the chart, to the modal rep count and to the pre-fill.

   ⚠️ REACHABLE THROUGH THE SWAP, not through the editor. The workout editor
   refuses a duplicate outright; the runner splits an entry when sets are
   already logged, so swapping away from a lift and back again — the machine
   was taken, then it freed up — leaves two entries under one exerciseId.

   The shape below is exactly what that leaves behind:
     Leg Press  2 sets   (what you managed before the machine was taken)
     Hack Squat 1 set    (what you did instead)
     Leg Press  2 sets   (heavier, once it freed up)                          */
{
  const { store: st, seriesForExercise: series2, weightRepObservations: obs2 }
    = await import('../js/store.js');
  await st.clearAll();

  const press = byName('Leg Press');
  const hack = byName('Hack Squat');
  const swapped = {
    workoutId: 'wSwap', workoutName: 'Legs', date: '2026-09-01',
    entries: [
      { exerciseId: press.id, exerciseName: press.name, sets: [{ weight: 300, reps: 10 }, { weight: 300, reps: 9 }] },
      { exerciseId: hack.id, exerciseName: hack.name, sets: [{ weight: 200, reps: 8 }] },
      { exerciseId: press.id, exerciseName: press.name, sets: [{ weight: 360, reps: 6 }, { weight: 360, reps: 5 }] },
    ],
  };
  await st.saveSession(swapped);

  const sets = await obs2(press.id, 'workout');
  ok(sets.length === 4,
     `every set of both entries is an observation (${sets.length}) — the second entry used to vanish`);
  ok(sets.filter((o) => o.weight === 360).length === 2,
     'including the two heavy sets, which came after the swap back');

  const pts = await series2(press.id, 'weight', 'workout');
  ok(pts.length === 1 && pts[0].value === 360,
     `the day's best set is the best across BOTH entries (${pts[0] && pts[0].value}), not the first entry's 300`);

  // ⚠️ LAST rather than first. The pre-fill answers "what did you do on this
  // lift last time", and the first entry is the two sets you gave up on.
  const pre = await st.lastSetsFor('wSwap', press.id);
  ok(pre && pre.length === 2 && pre[0].weight === 360,
     `the pre-fill reads the entry you FINISHED (${pre && pre[0].weight}), not the abandoned stub`);

  // The other exercise in the session is untouched by any of this.
  const hackObs = await obs2(hack.id, 'workout');
  ok(hackObs.length === 1 && hackObs[0].weight === 200, 'an exercise logged once still reads once');

  /* ---------- progression sees the same thing ---------- */
  const { historyFor } = await import('../js/progression.js');
  const hist = historyFor([swapped], { exerciseId: press.id, workoutId: 'wSwap' });
  ok(hist.length === 1 && hist[0][0].weight === 360,
     `progression reads one row per session, and it is the finished entry (${hist[0][0].weight})`);

  /* ---------- and the muscle map was never wrong here ----------
     It walks every entry in order, because it has to for the fatigue
     discount. Asserted so a later refactor cannot quietly regress it to the
     `.find()` shape the other four had.                                     */
  const { muscleStrength } = await import('../js/store.js');
  await st.saveSettings({ gender: 'male', birthYear: 1994, units: 'lbs' });
  await st.logBodyWeight(180, '2026-09-01');
  const quads = (await muscleStrength()).muscles.get('Quads');
  const lp = quads && quads.contributors.find((c) => c.exerciseName === 'Leg Press');
  ok(lp && lp.weight === 360,
     `the leg press contributes its heaviest set (${lp && lp.weight}), which lives in the third entry`);
  // ⚠️ The sharpest evidence that the walk is ordered rather than grouped: the
  // set is charged for the two leg-press sets AND the hack squat that came
  // before it — 3 sets of prior Quads volume, not 0 and not 2.
  ok(lp && lp.priorVolume === 3,
     `and it is charged for everything done before it in the session (${lp && lp.priorVolume} sets)`);

  await st.clearAll();
}

/* ================= research data (the Research tab, 2026-08-28) ============
   js/research-data.js — Harbo 2012's measured means, normalised. The numbers
   here are transcribed from a published table, so what a test can catch is
   the ARITHMETIC (normalisation, ranges) and the honesty properties (peak is
   100, nothing extrapolated past the measured bands, no invented groups). */
{
  const rd = await import('../js/research-data.js');
  const { ageCoefficient } = await import('../js/strength-standards.js');

  for (const g of ['male', 'female']) {
    const series = rd.ageStrengthSeries(g);
    ok(series.length === 8, `${g}: eight muscle groups, no more — Chest/Back/Traps are refused, not faked`);
    ok(series.every((s) => Math.max(...s.points.map((p) => p.pct)) === 100),
       `${g}: every group's strongest band reads exactly 100%`);
    ok(series.every((s) => s.points.length === 6), `${g}: six measured bands per group`);
    const ages = series[0].points.map((p) => p.age);
    ok(ages[0] === rd.AGE_BANDS[g][0] && ages[5] === rd.AGE_BANDS[g][5],
       `${g}: the x range is the measured band means (${ages[0]}–${ages[5]}), not the study's extreme individuals`);
  }
  ok(rd.NOT_COVERED.join() === 'Chest,Back,Traps', 'the refused groups are exactly the unmeasured ones');

  // Spot-checks against the paper's Table 5 (male): Quads 146 Nm at ~74 over
  // a 215 peak; Shoulders peak in the SECOND band (67 at ~34), which is the
  // kind of shape one shared curve cannot produce and is why this source.
  const male = rd.ageStrengthSeries('male');
  const quads = male.find((s) => s.muscle === 'Quads');
  ok(near(quads.points[5].pct, 67.9, 0.1), `oldest Quads band is 146/215 = 67.9% (${quads.points[5].pct})`);
  const sh = male.find((s) => s.muscle === 'Shoulders');
  ok(sh.points[1].pct === 100 && sh.points[0].pct < 100,
     '⚠️ Shoulders peak in the 30s band, not the 20s — a per-group shape, the whole point of the chart');

  // The app's grading curve: flat 100 through the 23–40 plateau, lower after.
  const ref = rd.appGradingCurve(ageCoefficient, 24, 74);
  ok(ref.length === 51, 'one reference point per year of the measured range');
  ok(ref.find((p) => p.age === 30).pct === 100 && ref.find((p) => p.age === 24).pct === 100,
     'the plateau reads 100%');
  ok(ref.find((p) => p.age === 74).pct < ref.find((p) => p.age === 55).pct,
     'and it declines with age after it');
}

/* ================= publish follows the data (2026-08-28) =================
   Source-pinned because schedulePublish and the boot heal need the remote
   backend, which no test here can stand up. The pure brain (needsRepublish)
   is fully tested in social.test.mjs; these pin the WIRING — the half whose
   absence let Autumn's published muscle map freeze at connection time. */
{
  const { readFileSync } = await import('node:fs');
  const st = readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  for (const fn of ['saveSession', 'deleteSession', 'saveBenchmark', 'deleteBenchmark',
                    'logBodyWeight', 'deleteBodyWeight', 'importRows']) {
    const body = st.slice(st.indexOf(`async ${fn}(`), st.indexOf(`async ${fn}(`) + 2200);
    ok(body.includes('schedulePublish()'),
       `${fn} schedules a publish — friends' copies follow the data now`);
  }
  ok(!st.slice(st.indexOf('async saveGuestSession(')).slice(0, 700).includes('schedulePublish'),
     "and saveGuestSession does NOT — a guest's training is never published as the owner's");
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  ok(app.includes('social.healStalePublish()'),
     '⚠️ boot heals stale projections — the repair for accounts that trained before this wiring existed');
}

/* ================= the research topics (2026-08-30) =====================
   Tim: "before we put anything on here, we need to be confident… it's also
   important for this to be readable and understandable for the user, so make
   sure it doesn't get too wordy."

   ⚠️ BOTH HALVES OF THAT ARE ASSERTED HERE, and the second half is the one
   no other assertion can catch. Every check anybody would naturally write on
   this content checks something is PRESENT — a source, a caveat, a
   confidence — and none of them can see prose piling back up over the next
   six sessions. The word budgets are the muscle panel's 40-word cap applied
   to a screen that will be edited far more often than that one. */
{
  const rt = await import('../js/research-topics.js');
  const { TOPICS, SOURCES, CONFIDENCE, CONFIDENCE_ORDER, citedSourceKeys,
    topicSources, topicWordCount } = rt;

  ok(TOPICS.length >= 8, `${TOPICS.length} topics`);
  ok(new Set(TOPICS.map((t) => t.id)).size === TOPICS.length, 'topic ids are unique');

  // Tim's brief, item by item — each of his questions has a home.
  for (const id of ['growth-vs-strength', 'free-weights-vs-machines', 'warmup-and-stretching',
                    'time-of-day', 'misconceptions', 'failure-and-rir', 'sets-and-reps']) {
    ok(TOPICS.some((t) => t.id === id), `Tim asked for it and it is here: ${id}`);
  }

  for (const t of TOPICS) {
    ok(CONFIDENCE_ORDER.includes(t.confidence),
       `${t.id}: confidence is one of the three declared levels`);
    ok(Boolean(t.question && t.lead && t.answer), `${t.id}: has a question, a lead and an answer`);
    // ⚠️ EVERY topic admits a limit. A topic with nothing to admit is a topic
    // nobody checked — and this app's whole credibility is not overclaiming.
    ok(Boolean(t.caveat) && t.caveat.length > 40, `${t.id}: states its own limit`);
    ok(t.points.length >= 3, `${t.id}: at least three specifics`);
    // ⚠️ AND EVERY CLAIM CARRIES A SOURCE. This is the assertion that stops
    // somebody adding a plausible sentence they read somewhere.
    for (const [i, p] of t.points.entries()) {
      ok(Array.isArray(p.sources) && p.sources.length > 0,
         `${t.id}: point ${i + 1} cites something`);
      ok((p.sources || []).every((k) => SOURCES[k]),
         `${t.id}: point ${i + 1} cites a source that is actually defined`);
    }
  }

  // Word budgets. Answers get two sentences, a whole topic gets a screen.
  for (const t of TOPICS) {
    const answerWords = t.answer.trim().split(/\s+/).length;
    ok(answerWords <= 45, `${t.id}: the answer is ${answerWords} words (cap 45)`);
    const total = topicWordCount(t);
    ok(total <= 260, `${t.id}: ${total} words in total (cap 260)`);
    for (const [i, p] of t.points.entries()) {
      const w = `${p.myth || ''} ${p.text}`.trim().split(/\s+/).length;
      ok(w <= 48, `${t.id}: point ${i + 1} is ${w} words (cap 48)`);
    }
  }

  // Sources: defined once, cited by key, and every URL is a real https link.
  for (const [k, s] of Object.entries(SOURCES)) {
    ok(Boolean(s.label), `source ${k} has a label`);
    ok(!s.url || /^https:\/\/\S+$/.test(s.url), `source ${k}'s link is a plain https URL`);
    // `n` is what the study covered. "13 studies, 1,016 people" and "one trial
    // of 12 undergraduates" read identically once both are called "research".
    ok(Boolean(s.n), `source ${k} says what it actually covered`);
  }
  const cited = citedSourceKeys();
  ok(cited.length >= 15, `${cited.length} distinct sources cited`);
  const unused = Object.keys(SOURCES).filter((k) => !cited.includes(k));
  ok(unused.length === 0, `no source is defined and left uncited (${unused.join(', ') || 'none'})`);
  ok(Object.values(SOURCES).filter((s) => s.url).length === Object.keys(SOURCES).length,
     'every source resolved to a link that was opened during the pull');

  // topicSources dedupes and preserves first-use order — the source line under
  // a topic must not print the ACSM stand four times.
  const g = TOPICS.find((t) => t.id === 'growth-vs-strength');
  const gs = topicSources(g);
  ok(new Set(gs.map((s) => s.key)).size === gs.length, 'a topic lists each source once');
  ok(gs[0].key === 'lopez2021', 'and in the order the topic first uses them');

  /* ⚠️ THE THREE CLAIMS THAT WOULD BE WORST TO GET BACKWARDS, pinned as text.
     Each is a place where the popular version of the finding is the OPPOSITE
     of the finding, so a well-meaning edit is exactly how they would flip. */
  const text = (id) => {
    const t = TOPICS.find((x) => x.id === id);
    return `${t.answer} ${t.points.map((p) => p.text).join(' ')} ${t.caveat}`.toLowerCase();
  };
  ok(/does not reduce injury risk/.test(text('warmup-and-stretching')),
     '⚠️ stretching is stated NOT to prevent injury — the null result is the finding');
  ok(/closer to failure do grow more/.test(text('failure-and-rir')),
     '⚠️ "not to failure" is not stated as permission to stop early');
  ok(/no time of day/.test(text('time-of-day')) || /neither for nor against/.test(text('time-of-day')),
     '⚠️ time of day is stated as no difference, not as an optimum');
  ok(/cannot check/.test(text('growth-vs-strength')),
     '⚠️ the topic says the app cannot see how heavy the plan was — §6.13.3 on screen');
}

/* ================= movement families (2026-08-30) =======================
   Tim: "categorize similar exercises together, and when the user clicks on
   'swap' it will show them a few alternative exercises that will achieve the
   same or similar result."

   ⚠️ THE LOAD-BEARING ONE IS RESOLUTION. The table names exercises as strings,
   which is what makes it readable and what makes it able to rot: rename an
   exercise in the library and a family member silently points at nothing, and
   the only symptom is a slightly shorter list nobody counts. Same class of
   fault as `preset-systems.js` referencing exercises by name, and the same
   fix — assert every one resolves, to EXACTLY one exercise. */
{
  const ef = await import('../js/exercise-families.js');
  const { FAMILIES, familyOf, alternativesFor, allMembers } = ef;
  const LIB = BUILT_IN_EXERCISES;
  const matches = (m, ex) => {
    const bar = m.indexOf('|');
    return bar < 0 ? ex.name === m
      : (ex.name === m.slice(0, bar) && ex.muscle === m.slice(bar + 1));
  };

  ok(FAMILIES.length >= 30, `${FAMILIES.length} movement families`);
  ok(new Set(FAMILIES.map((f) => f.id)).size === FAMILIES.length, 'family ids are unique');
  ok(FAMILIES.every((f) => f.label && f.members.length >= 2),
     'every family has a label and at least two members — a family of one is not a family');

  let unresolved = 0;
  for (const f of FAMILIES) {
    for (const m of f.members) {
      const hits = LIB.filter((e) => matches(m, e));
      if (hits.length !== 1) { unresolved++; console.log(`   ↳ ${f.id}: "${m}" → ${hits.length} hits`); }
    }
  }
  ok(unresolved === 0, `all ${allMembers().length} family members resolve to exactly one exercise`);

  // ⚠️ ONE FAMILY PER EXERCISE. Without this, "alternatives" quietly becomes
  // "anything sharing a word", and the first row of the swap sheet stops being
  // a judgement anybody made.
  const multi = LIB.filter((e) => FAMILIES.filter((f) => f.members.some((m) => matches(m, e))).length > 1);
  ok(multi.length === 0, `no exercise is in two families (${multi.map((e) => e.name).join(', ') || 'none'})`);

  const covered = LIB.filter((e) => familyOf(e));
  ok(covered.length >= LIB.length - 8,
     `${covered.length} of ${LIB.length} exercises have a family`);

  /* 🚨 THE FOUR WITHOUT ONE ARE A DECISION, NOT A GAP, and this pins it. Hip
     Adduction is the OPPOSITE movement to Hip Abduction on a machine that
     looks the same; suggesting one for the other would be the most misleading
     row this feature could produce. Same for Neck Curl against Neck Extension
     and Tibialis Raise against the calf raises. If somebody "completes" the
     table later, this fails and they read the comment. */
  for (const name of ['Hip Adduction Machine', 'Tibialis Raise', 'Neck Curl']) {
    const ex = byName(name);
    ok(ex && !familyOf(ex),
       `⚠️ ${name} has NO family on purpose — it is the opposite movement to its lookalike`);
  }
  {
    const ab = byName('Hip Abduction Machine');
    const alts = alternativesFor(ab, LIB).items.map((i) => i.exercise.name);
    ok(!alts.includes('Hip Adduction Machine'),
       '🚨 and abduction never offers adduction as an alternative');
  }

  // The suggestions themselves.
  {
    const bench = byName('Barbell Bench Press');
    const r = alternativesFor(bench, LIB);
    ok(r.reason === 'family' && /pressing/i.test(r.familyLabel), 'a bench press knows its movement');
    ok(r.items.length === 5, `five alternatives by default (${r.items.length})`);
    ok(!r.items.some((i) => i.exercise.id === bench.id), 'and never itself');
    const names = r.items.map((i) => i.exercise.name);
    ok(names.includes('Dumbbell Bench Press') && names.includes('Machine Chest Press'),
       `the dumbbell and machine versions are offered (${names.join(', ')})`);
  }
  {
    // ⚠️ THE EQUIPMENT SPREAD, which is the whole feature. Ranked on score
    // alone a leg press offered five barbell squats — all correct, all the
    // same answer — while the hack squat and goblet squat sat below the cut.
    const lp = byName('Leg Press');
    const kinds = new Set(alternativesFor(lp, LIB).items.map((i) => i.exercise.equipment));
    ok(kinds.size >= 4, `a leg press offers ${kinds.size} different kinds of equipment`);
    const pull = new Set(alternativesFor(byName('Lat Pulldown'), LIB).items.map((i) => i.exercise.equipment));
    ok(pull.size >= 3, `a lat pulldown offers ${pull.size} different kinds of equipment`);
  }
  {
    // No family → same muscle group, and the caller is told which it got, so
    // the screen can say "same movement" or "other Glutes exercises" honestly.
    const r = alternativesFor(byName('Neck Curl'), LIB);
    ok(r.reason === 'muscle' && r.familyLabel === null, 'a family-less exercise falls back to its muscle group');
    ok(r.items.every((i) => i.exercise.muscle === 'Neck'), 'and the fallback stays inside that group');
  }
  {
    // Already in today's session: MARKED, never hidden. Swapping away and back
    // is the case the runner's split path exists for.
    const bench = byName('Barbell Bench Press');
    const db = byName('Dumbbell Bench Press');
    const r = alternativesFor(bench, LIB, { inSession: [db.id] });
    const row = r.items.find((i) => i.exercise.id === db.id);
    ok(Boolean(row), 'an exercise already in the session is still offered');
    ok(row && row.inSession === true, 'and it is flagged so the user can see it');
  }
  {
    // Deterministic: same inputs, same order, every time. Nothing here may use
    // Math.random(), for the reason demo.js states about its own year.
    const a = alternativesFor(byName('Lateral Raise'), LIB).items.map((i) => i.exercise.id);
    const b = alternativesFor(byName('Lateral Raise'), LIB).items.map((i) => i.exercise.id);
    ok(a.join() === b.join(), 'the order is deterministic');
  }
  {
    // A custom exercise has no family by construction — the table is written
    // against the built-in library. It must degrade to the muscle fallback
    // rather than throw or come back empty.
    const custom = makeCustomExercise({ name: 'My Weird Press', muscle: 'Chest', equipment: 'Other' });
    const r = alternativesFor(custom, [...LIB, custom]);
    ok(r.reason === 'muscle' && r.items.length > 0, 'a custom exercise still gets suggestions');
  }
}

/* ================= exercise pictures (2026-08-30) =======================
   Tim asked for a picture beside every exercise name. The ART is a purchase he
   has not made yet — the style he wants is a paid stock library — so the
   feature shipped ahead of it and these assertions guard the seam.

   ⚠️ THE MANIFEST IS GENERATED FROM THE DIRECTORY, and the whole reason to
   check it here is that the drift is SILENT: a filename typed wrong shows no
   picture, and "no picture" is the normal state of this feature, so nothing
   looks wrong. A forgotten `node tools/build-exercise-images.mjs` must fail
   loudly instead. */
{
  const { readdirSync, existsSync, readFileSync } = await import('node:fs');
  const ei = await import('../js/exercise-images.js');
  const { MANIFEST, IMAGE_DIR, imageFor, imageForId, hasImages, manifestPaths } = ei;
  const dir = new URL('../img/exercises/', import.meta.url);

  const ids = Object.keys(MANIFEST);
  const libIds = new Set(BUILT_IN_EXERCISES.map((e) => e.id));
  const strays = ids.filter((id) => !libIds.has(id));
  ok(strays.length === 0,
     `every picture is named for a real exercise id (${strays.join(', ') || 'none stray'})`);

  // ⚠️ Against the DIRECTORY, so a rebuild that was not run fails here.
  if (existsSync(dir)) {
    const onDisk = readdirSync(dir)
      .filter((f) => !f.startsWith('.') && f !== 'README.md');
    const expected = new Set(ids.map((id) => `${id}.${MANIFEST[id]}`));
    const missing = onDisk.filter((f) => !expected.has(f));
    ok(missing.length === 0,
       `⚠️ the manifest matches img/exercises/ (${missing.length ? `run tools/build-exercise-images.mjs — unlisted: ${missing.join(', ')}` : 'in step'})`);
    ok(ids.every((id) => onDisk.includes(`${id}.${MANIFEST[id]}`)),
       'and every manifest entry is a file that actually exists');
  }

  // 🚨 D6: a picture the worker was never told about is a picture that is
  // missing in a gym basement. The generator writes both lists; this proves it.
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  ok(sw.includes('// BEGIN EXERCISE IMAGES') && sw.includes('// END EXERCISE IMAGES'),
     'sw.js carries the generated block the tool writes into');
  const unprecached = manifestPaths().filter((p) => !sw.includes(`./${p}`));
  ok(unprecached.length === 0,
     `🚨 every picture is precached for offline (${unprecached.join(', ') || 'all of them'})`);

  // The resolver itself, which has to be right before there is any art at all.
  const bench = byName('Barbell Bench Press');
  ok(imageFor(null) === null && imageFor({}) === null, 'no exercise, no picture — and no throw');
  ok(imageForId('not-a-real-id') === null, 'and an unknown id resolves to nothing');
  ok(hasImages() === (ids.length > 0), 'hasImages() reflects the manifest');
  // Drive the "there is art" branch without inventing a file.
  MANIFEST[bench.id] = 'webp';
  try {
    ok(imageFor(bench) === `${IMAGE_DIR}${bench.id}.webp`,
       'a bought picture resolves to img/exercises/<id>.<ext>');
    ok(imageFor(bench) === imageForId(bench.id), 'by object and by id agree');
    /* ⚠️ KEYED BY ID, NOT BY NAME, and this is the assertion that pins why.
       "Cable Kickback" exists TWICE in the library — once for Triceps, once
       for Glutes — so a name-keyed manifest would eventually paint a triceps
       picture over a glute exercise and nobody would ever report it. */
    const kicks = BUILT_IN_EXERCISES.filter((e) => e.name === 'Cable Kickback');
    ok(kicks.length === 2, 'the library really does hold two "Cable Kickback"s');
    MANIFEST[kicks[0].id] = 'webp';
    ok(imageFor(kicks[0]) !== null && imageFor(kicks[1]) === null,
       '🚨 giving one of them a picture does not give the other one');
    delete MANIFEST[kicks[0].id];
  } finally {
    delete MANIFEST[bench.id];
  }
  ok(Object.keys(MANIFEST).length === ids.length, 'and the manifest is left as it was found');
}

/* ================================================================== *
 * WEEKLY SETS PER MUSCLE — Data → Volume (2026-08-31)
 *
 * D3's headline metric, for every muscle at once. Runs LAST because it calls
 * importAll(), which replaces every collection.
 *
 * ⚠️ THE FIRST ASSERTION IS THE LOAD-BEARING ONE: this and trainingForMuscle()
 * must return the same number for the same muscle on the same day. Two screens
 * quoting different weekly set counts for someone's chest would be worse than
 * either screen not existing, and the only structural defence is that both read
 * one window helper — which is what this pins.
 * ================================================================== */
{
  const bench = byName('Barbell Bench Press');
  const squat = byName('Back Squat');
  const sets = (n, w) => Array.from({ length: n }, () => ({ weight: w, reps: 8 }));
  const day = (date, ex, n, w) => ({
    id: 's' + date, workoutId: 'w', workoutName: 'W', date,
    entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: sets(n, w) }],
  });

  /* Four bench days and two squat days, the first on 2026-03-15 and read on
     2026-04-11 — a span of exactly 28 days, so the weeks divide cleanly and
     every number below is checkable by hand.
     ⚠️ THE BENCH DAYS ARE 4, 4, 2, 2 SETS RATHER THAN 3, 3, 3, 3, and that is
     what makes the "both screens agree" assertion below mean anything. An even
     fixture reports the same sets-a-week over ANY window inside it, so a mutation
     that had one of the two functions reading a different window passed
     unnoticed — the test was measuring nothing. Front-loading the sets makes the
     rate depend on where the window starts. */
  await store.importAll({ sessions: [
    day('2026-03-15', bench, 4, 185), day('2026-03-18', squat, 5, 275),
    day('2026-03-22', bench, 4, 185), day('2026-03-29', bench, 2, 185),
    day('2026-04-01', squat, 5, 275), day('2026-04-05', bench, 2, 185),
  ] });

  const v = await weeklyVolumeByMuscle(28, '2026-04-11');
  const m = (name) => v.muscles.find((x) => x.muscle === name);

  ok(v.spanDays === 28 && v.weeks === 4 && v.sessions === 6,
     `six sessions over a 28-day span, four weeks (${v.spanDays}/${v.sessions})`);
  ok(v.enough === true, 'and that is over the two-week floor, so a weekly rate may be stated');

  const solo = await trainingForMuscle('Chest', 28, '2026-04-11');
  ok(near(solo.weeklySets, m('Chest').weeklySets, 1e-9),
     '🚨 the Goals screen and this one report the SAME sets a week for the same muscle — one '
     + 'window helper, so they cannot drift apart');
  ok(near(solo.sessionsPerWeek, m('Chest').sessionsPerWeek, 1e-9),
     'and the same sessions a week, counted on direct work in both');

  ok(near(m('Chest').weeklySets, 3), `12 bench sets over four weeks is 3 a week (${m('Chest').weeklySets})`);
  ok(near(m('Quads').weeklySets, 2.5), `10 squat sets is 2.5 a week (${m('Quads').weeklySets})`);
  /* ⚠️ THE FRACTIONAL RULE IS THE WHOLE SCREEN. A bench press is DIRECT for
     chest and INDIRECT for triceps and the front delt (Pelland Table 1), so the
     same 12 sets are 12 for chest and 6 for each of those. A version counting
     any involvement as a whole set would read 12/12/12 here. */
  ok(near(m('Triceps').weeklySets, 1.5) && near(m('Shoulders').weeklySets, 1.5),
     `and the triceps and delts get HALF of every press — 1.5 a week (${m('Triceps').weeklySets})`);
  ok(near(m('Glutes').weeklySets, 1.25), 'a squat is half a set for glutes, so 1.25 a week');

  ok(near(m('Chest').sessionsPerWeek, 1) && m('Triceps').sessionsPerWeek === 0,
     '⚠️ frequency counts DIRECT work only — four press days are a chest day a week and never a '
     + 'triceps day, or every pressing session would be a back day because of the deadlift');

  /* ⚠️ EVERY MUSCLE IS LISTED, INCLUDING THE UNTRAINED ONES. "You have done no
     calf work for a month" is the finding; a screen that simply omitted calves
     would be answering a different question. */
  ok(v.muscles.length === 12, `all twelve volume muscles are listed (${v.muscles.length})`);
  ok(m('Calves').weeklySets === 0 && m('Calves').contributors.length === 0,
     'and a muscle with no work is present, on zero, rather than absent');

  ok(v.muscles.map((x) => x.weeklySets).every((n, i, a) => i === 0 || a[i - 1] >= n),
     'rows arrive sorted, most-trained first');

  /* ⚠️ THE CONTRIBUTORS MUST SUM TO THE TOTAL, or the panel naming them is a
     panel nobody can check against their own sessions. */
  ok(v.muscles.every((row) =>
    near(row.contributors.reduce((t, c) => t + c.sets, 0), row.totalSets, 1e-9)),
     '🚨 every muscle\'s named exercises add up to exactly its own total');
  ok(m('Chest').contributors[0].name === 'Barbell Bench Press'
    && m('Chest').contributors[0].kind === 'direct'
    && near(m('Chest').contributors[0].sets, 12),
     'the chest total names the lift that built it: 12 direct sets of bench');
  ok(m('Triceps').contributors[0].kind === 'indirect',
     'and the triceps line says its sets arrived indirectly');

  /* ---- under a fortnight: no rate, and it says so ---- */
  await store.importAll({ sessions: [day('2026-04-08', bench, 4, 185), day('2026-04-10', bench, 4, 185)] });
  const short = await weeklyVolumeByMuscle(28, '2026-04-11');
  ok(short.enough === false && short.spanDays === 4,
     '⚠️ four days of history is not a weekly rate, and the flag says so rather than the screen '
     + 'printing 14 sets a week off two sessions');
  ok(near(short.muscles.find((x) => x.muscle === 'Chest').totalSets, 8),
     'the raw count is still there for the screen to show instead (8 sets so far)');
  ok(await trainingForMuscle('Chest', 28, '2026-04-11') === null,
     'while the Goals screen, which puts that number in a sentence, still gets nothing at all');

  /* ---- the per-session ceiling, spread across the exercises that caused it ---- */
  await store.importAll({ sessions: [
    day('2026-03-15', bench, 30, 185), day('2026-04-11', bench, 1, 185),
  ] });
  const cl = await weeklyVolumeByMuscle(28, '2026-04-11');
  const chest = cl.muscles.find((x) => x.muscle === 'Chest');
  ok(cl.clamped === true, 'a 30-set chest session trips the per-session ceiling');
  ok(near(chest.totalSets, 25),
     `⚠️ and is credited with 24, not 30 — above the top of the measured range nothing further is `
     + `counted (${chest.totalSets} = 24 + the single set on the second day)`);
  ok(near(chest.contributors.reduce((t, c) => t + c.sets, 0), chest.totalSets, 1e-9),
     '🚨 and the named exercises still add up to it — the clamp is spread across them rather than '
     + 'left as a difference nobody can account for');
  await store.clearAll();
}

/* ---------- one session's own numbers (js/session-stats.js) ----------
 *
 * The feed card's stat row. ⚠️ VOLUME IS DELIBERATELY NOT HERE — Tim's call on
 * 2026-09-01 was to put the SET COUNT in that column, and the module header
 * records why that is also the honest choice for a friend's session (a
 * bodyweight set has no external load to total, and their body weight is
 * published only at the top tier). These assertions pin the count.
 */
{
  const { sessionStats, recordedSetCount, setsLabel } = await import('../js/session-stats.js');

  const s = sessionStats([
    { exerciseId: 'a', exerciseName: 'Bench Press', sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }] },
    { exerciseId: 'b', exerciseName: 'Pull-Up', sets: [{ reps: 10 }, { reps: 8 }, { reps: 6 }] },
    { exerciseId: 'c', exerciseName: 'Never Reached', sets: [{ weight: 0, reps: 0 }, {}] },
  ]);
  ok(s.sets === 5, `sets are counted across exercises (${s.sets})`);
  ok(s.exercises === 2,
     '🚨 an exercise nobody logged a set against is not counted as done — a workout finished early '
     + 'must not claim the exercises it never reached');
  ok(s.byExercise.length === 2 && s.byExercise[0].name === 'Bench Press',
     'the breakdown keeps the order they were done in');
  ok(s.byExercise[1].sets === 3, 'and carries each exercise\'s own count');

  ok(sessionStats([]).sets === 0 && sessionStats(undefined).sets === 0,
     'an empty session is 0 sets, not NaN and not a crash');

  // ⚠️ A bodyweight set counts exactly like a loaded one. It is the reason the
  // column is sets rather than volume: this session is 3 sets of real work, and
  // any external-load total would have called it zero.
  ok(sessionStats([{ exerciseName: 'Pull-Up', sets: [{ reps: 10 }, { reps: 8 }, { reps: 6 }] }]).sets === 3,
     '⚠️ a bodyweight set counts — which external-load volume could not have done for a friend');

  // The nesting rule, which is the oldest resolved-without-asking decision here.
  ok(recordedSetCount({ sets: [{ weight: 200, reps: 6, minis: [{ weight: 150, reps: 5 }, { weight: 100, reps: 5 }] }] }) === 1,
     '🚨 a drop set is ONE hard set, not one plus its minis — counting the drops would inflate '
     + 'every total the moment somebody used a set type');

  ok(setsLabel(1) === '1 set' && setsLabel(4) === '4 sets', 'one set is singular');
}

/* ---------- typed personal records (js/personal-bests.js) ----------
 *
 * Weight · Volume · 1RM, the way Hevy types them (social-plan §12.15/§13
 * Step 5). This arithmetic ran for five days as a private closure inside
 * views-session.js with no test on it at all; extracting it was half the job
 * and this block is the other half.
 *
 * ⚠️ The 1RM kind is the first thing this function has ever emitted that is an
 * ESTIMATE rather than a measurement, so the assertions below pin both halves
 * of the Rule 5 answer: the rep gate that decides what may be inferred FROM,
 * and the flag that tells a screen to say so.
 */
{
  const { personalBests, PB_LABEL } = await import('../js/personal-bests.js');

  const ent = (id, name, sets) => ({ exerciseId: id, exerciseName: name, sets });
  const was = (entries) => [{ id: 'old', entries }];
  const kindsOf = (list) => list.map((p) => p.kind).join(' ');
  const of = (list, kind) => list.find((p) => p.kind === kind) || null;

  /* ---- nothing to beat is not a record ---- */
  ok(personalBests([ent('a', 'Bench', [{ weight: 100, reps: 5 }])], [], []).length === 0,
     '🚨 the first time an exercise is ever logged is still not a personal best — every set of it '
     + 'is trivially a maximum and a trophy for that teaches that the trophy is noise');

  /* ---- all three kinds, in Hevy's order ---- */
  const three = personalBests(
    [ent('a', 'Bench', [{ weight: 105, reps: 5 }])],
    was([ent('a', 'Bench', [{ weight: 100, reps: 5 }])]), []);
  ok(kindsOf(three) === 'weight volume e1rm',
     `one better set can be three records, listed Weight · Volume · 1RM (${kindsOf(three)})`);
  ok(of(three, 'weight').now === 105 && of(three, 'weight').was === 100,
     'the weight record is the heaviest ever, and says what it beat');
  ok(of(three, 'volume').now === 525 && of(three, 'volume').was === 500,
     'the volume record is ONE set’s weight × reps (105 × 5), not the session total');
  ok(near(of(three, 'e1rm').now, e1rm(105, 5), 1e-9) && near(of(three, 'e1rm').was, e1rm(100, 5), 1e-9),
     'and the 1RM record is e1rm.js applied to the same two sets');

  /* ---- the kinds genuinely disagree, which is the whole reason for typing them ---- */
  const heavier = personalBests(
    [ent('a', 'Bench', [{ weight: 105, reps: 5 }])],
    was([ent('a', 'Bench', [{ weight: 100, reps: 10 }])]), []);
  ok(kindsOf(heavier) === 'weight',
     '⚠️ 105 × 5 after 100 × 10 is a WEIGHT record and nothing else — less total work and, by the '
     + 'curve, a smaller estimated max. One untyped PR could not have said that');

  const longer = personalBests(
    [ent('a', 'Bench', [{ weight: 100, reps: 8 }])],
    was([ent('a', 'Bench', [{ weight: 100, reps: 5 }])]), []);
  ok(kindsOf(longer) === 'volume e1rm',
     'and the same weight for more reps is a volume and a 1RM record with no weight record — '
     + 'matching the bar you actually walked up to, which had not moved');

  /* ---- D5: what may be inferred from, on BOTH sides of the comparison ---- */
  const gated = personalBests(
    [ent('a', 'Bench', [{ weight: 140, reps: 5 }])],
    was([ent('a', 'Bench', [{ weight: 100, reps: 5 }, { weight: 135, reps: 25 }])]), []);
  ok(near(of(gated, 'e1rm').was, e1rm(100, 5), 1e-9),
     '🚨 the 25-rep set is refused as 1RM evidence (D5, MAX_EVIDENCE_REPS) — the formula scores it '
     + 'at 258 lb and it would have stood in the way of a real 140 × 5 forever');
  ok(of(gated, 'volume') === null,
     '⚠️ but the same set still counts as VOLUME, which is measured rather than inferred — 3,375 lb '
     + 'of work happened, and 140 × 5 does not beat it');

  const burnout = personalBests(
    [ent('a', 'Bench', [{ weight: 60, reps: 20 }])],
    was([ent('a', 'Bench', [{ weight: 100, reps: 5 }])]), []);
  ok(kindsOf(burnout) === 'volume',
     'and a 20-rep burnout set today earns the volume record it deserves and no 1RM trophy at all');

  /* ---- the gate is PER KIND, so no record is ever "up from 0" ---- */
  const firstLoaded = personalBests(
    [ent('p', 'Pull-Up', [{ weight: 25, reps: 8 }])],
    was([ent('p', 'Pull-Up', [{ reps: 10 }, { reps: 12 }])]), []);
  ok(firstLoaded.length === 0,
     '🚨 the first time a bodyweight lift is ever loaded is not a weight record — there is no '
     + 'weight history to beat, and "up from 0 lbs" is not a thing that happened');

  /* ---- bodyweight stays on reps, and only where there is no weight ---- */
  const bw = personalBests(
    [ent('p', 'Pull-Up', [{ reps: 14 }])],
    was([ent('p', 'Pull-Up', [{ reps: 12 }])]), []);
  ok(kindsOf(bw) === 'reps' && bw[0].now === 14 && bw[0].was === 12,
     'a lift with no weight in it gets a reps record and no weight record');
  ok(personalBests([ent('a', 'Bench', [{ weight: 100, reps: 12 }])],
       was([ent('a', 'Bench', [{ weight: 100, reps: 5 }])]), [])
       .every((p) => p.kind !== 'reps'),
     '⚠️ and a loaded lift never gets one, because "more reps at less weight" is not a bigger '
     + 'number and the app must not imply it is');

  /* ---- MINI-SETS COUNT TOWARD TODAY, not just toward history ----
   * The decision: SYMMETRIC, both sides, minis included. The old closure read
   * `[set, ...minisOf(set)]` for history and the bare parent sets for today,
   * so a drop could raise the bar and never clear it. */
  const drop = personalBests(
    [ent('a', 'Bench', [{ weight: 200, reps: 3, minis: [{ weight: 120, reps: 12 }] }])],
    was([ent('a', 'Bench', [{ weight: 150, reps: 6 }])]), []);
  ok(of(drop, 'volume').now === 1440,
     '🚨 THE DECISION WENT SYMMETRIC: the 120 × 12 drop is today’s volume record (1,440), beating '
     + 'its own 200 × 3 parent — minis have always counted as history and now count as evidence '
     + 'today too, which is the only way a set can beat the bar it is allowed to set');
  ok(personalBests([ent('a', 'Bench', [{ weight: 100, reps: 5 }])],
       was([ent('a', 'Bench', [{ weight: 90, reps: 5, minis: [{ weight: 130, reps: 2 }] }])]), [])
       .every((p) => p.kind !== 'weight'),
     'and the same rule read backwards: a mini in the past is still something to beat');

  /* ---- per-side load ---- */
  const exMap = new Map([['d', { id: 'd', name: 'Dumbbell Press', loadType: 'per_side' }]]);
  const perSide = personalBests(
    [ent('d', 'Dumbbell Press', [{ weight: 50, reps: 10 }])],
    was([ent('d', 'Dumbbell Press', [{ weight: 45, reps: 10 }])]), [], exMap);
  ok(of(perSide, 'volume').now === 1000 && of(perSide, 'volume').was === 900,
     '⚠️ a per-side lift does DOUBLE work: 50 lb dumbbells for 10 is 1,000 lb, not 500. Volume is '
     + 'a sum and a sum has a right answer');
  ok(of(perSide, 'volume').perSide === true && of(three, 'volume').perSide === false,
     'and the record says the doubling happened, so the screen can print "(both sides)" — 50 × 10 '
     + 'does not multiply out to 1,000 and a total nobody can check is a total nobody should '
     + 'be asked to believe');
  ok(of(perSide, 'weight').now === 50 && near(of(perSide, 'e1rm').now, e1rm(50, 10), 1e-9),
     '⚠️ but the weight and 1RM records stay in the units the set was LOGGED in (50, not 100), '
     + 'because every other screen prints that lift as 50/side and a record must be a number the '
     + 'lifter recognises');
  ok(personalBests([ent('d', 'Dumbbell Press', [{ weight: 50, reps: 10 }])],
       was([ent('d', 'Dumbbell Press', [{ weight: 45, reps: 10 }])]), []).find((p) => p.kind === 'volume').now === 500,
     'with no exercise map the doubling simply does not happen — and `now` and `was` still go '
     + 'through the same rule, so the comparison stays honest even when the library does not');

  /* ---- an estimate is flagged as one ---- */
  ok(three.filter((p) => p.estimated).map((p) => p.kind).join() === 'e1rm',
     '🚨 exactly one kind is flagged `estimated` and it is the 1RM — this is the flag the finish '
     + 'screen turns into the word "estimated" beside it, because an inference may never look '
     + 'like a measurement (Rule 5)');
  ok(of(three, 'e1rm').weight === 105 && of(three, 'e1rm').reps === 5,
     'and it carries the real set it was estimated from, so the guess can be checked against '
     + 'something that actually happened');
  ok(PB_LABEL.weight === 'Weight' && PB_LABEL.volume === 'Volume' && PB_LABEL['e1rm'] === '1RM',
     'the four kinds have names a screen can print without inventing its own');

  /* ---- a record has to be big enough to see ---- */
  const hair = personalBests(
    [ent('a', 'Bench', [{ weight: 135, reps: 3 }])],
    was([ent('a', 'Bench', [{ weight: 105, reps: 10 }])]), []);
  ok(kindsOf(hair) === 'weight',
     '⚠️ 135 × 3 and 105 × 10 both estimate to 150 lb, so the 0.05 lb between them is not a 1RM '
     + 'record — the estimate is compared at the precision it is PRINTED at, or the screen would '
     + 'read "up from" a number identical to the one beside it');

  /* ---- benchmarks are history too ---- */
  ok(personalBests([ent('a', 'Bench', [{ weight: 150, reps: 5 }])], [],
       [{ exerciseId: 'a', values: { weight: 200, reps: 1 } }]).every((p) => p.kind !== 'weight'),
     'a benchmark counts as something to beat — a tested max is the most deliberate record there is');

  /* ---- Rule 6: no opinion on a mile ---- */
  ok(personalBests([ent('r', 'Run', [{ time: 300, distance: 2 }])],
       was([ent('r', 'Run', [{ time: 400, distance: 1 }])]), []).length === 0,
     'time and distance are left alone — the app has no opinion on which direction of a mile is '
     + 'better (Rule 6)');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
