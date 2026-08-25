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

  // ⚠️ ORDERING WITHIN EACH FAMILY, which is what forced the un-measured
  // neighbours to move with their anchor. Decline HAD to: at its old 0.76 it
  // would have sat below the corrected flat press, saying a decline dumbbell
  // press is harder to load than a flat one, which is backwards.
  ok(ratio('Decline Dumbbell Bench Press', 'Chest') > ratio('Dumbbell Bench Press', 'Chest'),
     '⚠️ decline still allows MORE than flat — the inversion the anchor move would have created');
  ok(ratio('Incline Dumbbell Bench Press', 'Chest') < ratio('Dumbbell Bench Press', 'Chest'),
     'and incline still allows less');
  ok(ratio('Arnold Press', 'Shoulders') < ratio('Dumbbell Shoulder Press', 'Shoulders'),
     'an Arnold press still allows less than a straight dumbbell press');
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
    ok(s.reason === 'rotation', 'and it says it read that off the rotation');
    ok(s.daysSince === 2, 'it knows how long ago the last one was');
    ok(s.lastName === 'Push', 'and what the last one was');
    ok(/Push Pull Legs/.test(describeSuggestion(s)) && /Push/.test(describeSuggestion(s)),
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

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
