// Overhaul wave 2, FIXES builder — 2026-09-27.
//   node tests/fixes-w2.test.mjs
//
// Pins:
//   1. `sessionCount` (E-3b) travels on every path that builds or ships a
//      muscle rating: muscleStrength(), buildStrengthShare() with and without
//      rows, projectStrength(), and a friend's read (ratingsFromShared()).
//   2. A friend's map caps the way your own does, even on a document an older
//      build published without the cap: 1 session → Fair at most, 2 → Good.
//   3. The demo carries the glass switch (and the Auto theme) over from the
//      real settings on this device, the same way it carries units/palette.
//   4. updateWorkoutExercises() keeps the "or more" (`plus`) rep flag on kept
//      and swapped exercises — it goes through saveWorkout()'s normalisation.
//
// Runs on the demo backend (memory only). Never touches Firestore.

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
// The REAL settings on this device, read by the demo seed: glass off, Auto
// theme, a non-default palette, kg.
mem.set('ftrack:v1:settings', JSON.stringify([
  { id: 'settings', units: 'kg', theme: 'auto', palette: 'teal', glass: false },
]));
const sess = new Map([['ftrack:v1:demo', '1']]);
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const S = await import('../js/store.js');
const { store, muscleStrength, buildStrengthShare } = S;
const { buildDemoData } = await import('../js/demo.js');
const { projectStrength } = await import('../js/social.js');
const { ratingsFromShared } = await import('../js/shared-map.js');
const { COMPARE_DEFAULT, compareKey, standardQualityFor } = await import('../js/strength-standards.js');
const { tintFor } = await import('../js/muscle-evidence.js');

/* ---------- 3. demo carries glass + Auto theme ---------- */
{
  const s = await store.getSettings();
  ok(s.glass === false, `the demo keeps glass OFF when the real settings have it off (${s.glass})`);
  ok(s.theme === 'auto', `the demo keeps the Auto theme (${s.theme})`);
  ok(s.palette === 'teal' && s.units === 'kg', 'palette and units still carry over');
  const plain = buildDemoData({ today: '2026-09-27' }).settings[0];
  ok(!('glass' in plain), 'glass on is ABSENT in the demo settings row (the contract\'s "on")');
  const off = buildDemoData({ today: '2026-09-27', glass: false }).settings[0];
  ok(off.glass === false, 'buildDemoData({ glass: false }) writes glass: false');
}

/* ---------- 1. sessionCount on every path ---------- */
{
  const own = await muscleStrength();
  const list = own && own.muscles ? [...own.muscles.values()] : [];
  ok(list.length > 0 && list.every((m) => Number.isFinite(m.sessionCount) && m.sessionCount >= 1),
    `muscleStrength() carries sessionCount on every muscle (${list.length} muscles)`);
  ok(list.every((m) => m.sessionCount <= m.contributorCount),
    'and it is never more than the exercise-day count');

  const share = await buildStrengthShare();
  const pub = share && Array.isArray(share.muscles) ? share.muscles : [];
  ok(pub.length > 0 && pub.every((m) => Number.isFinite(m.sessionCount)),
    `buildStrengthShare() publishes sessionCount (${pub.length} muscles)`);
  const projected = projectStrength(share);
  ok(projected.muscles.length > 0 && projected.muscles.every((m) => Number.isFinite(m.sessionCount)),
    'projectStrength() keeps it in the public document');
  const read = ratingsFromShared(projected, COMPARE_DEFAULT);
  const readList = [...read.muscles.values()];
  ok(readList.length > 0 && readList.every((m) => Number.isFinite(m.sessionCount)),
    `a friend's read carries it through to the panel (${readList.length} muscles)`);

  // The rows branch (demo friends, famous lifters): ONE session of real sets.
  const exercises = await store.getExercises();
  const id = (n) => (exercises.find((e) => e.name === n) || {}).id;
  const set3 = (w, r) => [1, 2, 3].map(() => ({ weight: w, reps: r }));
  const date = S.todayISO();
  const rows = {
    sessions: [{
      id: 'one', date, entries: [
        { exerciseId: id('Bench Press'), exerciseName: 'Bench Press', sets: set3(185, 5) },
        { exerciseId: id('Incline Bench Press'), exerciseName: 'Incline Bench Press', sets: set3(155, 6) },
        { exerciseId: id('Dumbbell Bench Press'), exerciseName: 'Dumbbell Bench Press', sets: set3(70, 8) },
        { exerciseId: id('Back Squat'), exerciseName: 'Back Squat', sets: set3(225, 5) },
      ],
    }],
    benchmarks: [],
    bodyWeights: [{ date, weight: 180 }],
    sex: 'male',
  };
  const one = await buildStrengthShare(rows, { gender: 'male', birthYear: 1996 });
  const oneList = one && Array.isArray(one.muscles) ? one.muscles : [];
  ok(oneList.length > 0 && oneList.every((m) => m.sessionCount === 1),
    `the rows branch publishes sessionCount 1 for one session (${oneList.map((m) => m.sessionCount).join(',')})`);
  ok(oneList.every((m) => m.band !== 'High' && m.band !== 'Good'),
    `and one session reads Fair at most there (${oneList.map((m) => m.band).join(',')})`);
}

/* ---------- 2. a friend's map caps like your own, on an OLD document ---------- */
{
  const key = compareKey(COMPARE_DEFAULT, 'male');
  const muscle = (name, extra) => ({
    muscle: name, lift: null, estimate: 200, confidence: 0.86, band: 'High', basis: 'direct',
    contributors: [], exerciseCount: 3, ...extra,
  });
  const doc = {
    defaultCompare: key,
    muscles: [
      muscle('Chest', { contributorCount: 1 }), // old doc: no sessionCount, 1 exercise-day
      muscle('Back', { contributorCount: 6, sessionCount: 2 }),
      muscle('Quads', { contributorCount: 6, sessionCount: 1 }),
      muscle('Glutes', { contributorCount: 12 }), // old doc, nothing to go on: untouched
      muscle('Hamstrings', { contributorCount: 12, sessionCount: 9, basis: 'fallback' }),
      muscle('Shoulders', { contributorCount: 12, sessionCount: 9 }), // many sessions: untouched
    ],
    grid: { [key]: Object.fromEntries(['Chest', 'Back', 'Quads', 'Glutes', 'Hamstrings', 'Shoulders']
      .map((m) => [m, [60, 10]])) },
  };
  const r = ratingsFromShared(doc, COMPARE_DEFAULT).muscles;
  const band = (m) => r.get(m) && r.get(m).band && r.get(m).band.name;
  ok(band('Chest') === 'Fair' || band('Chest') === 'Low',
    `an old document with one exercise-day reads Fair at most on a friend's screen (${band('Chest')})`);
  ok(band('Back') === 'Good', `two sessions read Good at most (${band('Back')})`);
  ok(band('Quads') !== 'High' && band('Quads') !== 'Good', `one session reads Fair at most (${band('Quads')})`);
  ok(band('Hamstrings') !== 'High' && band('Hamstrings') !== 'Good',
    `a stand-in-only reading reads Fair at most (${band('Hamstrings')})`);
  ok(r.get('Glutes').confidence === 0.86 && r.get('Shoulders').confidence === 0.86,
    'many sessions, or nothing to go on, leaves the published number alone');
  ok(r.get('Chest').tint === tintFor(r.get('Chest').confidence)
     && r.get('Chest').confidence <= 0.5499 * standardQualityFor('Chest'),
    'the capped number is what the tint and band are built from');
  ok(r.get('Back').sessionCount === 2 && !('sessionCount' in r.get('Chest')),
    'sessionCount is carried when published and absent (not 0) when it was not');
}

/* ---------- 4. updateWorkoutExercises keeps `plus` ---------- */
{
  const all = await store.getWorkouts();
  const w = all.find((x) => x.exercises.length >= 3);
  const withPlus = w.exercises.map((e, i) => (i < 2
    ? { ...e, sets: 3, reps: [{ lo: 5, hi: 5 }, { lo: 5, hi: 5 }, { lo: 5, hi: 5, plus: true }], targets: undefined }
    : e));
  await store.saveWorkout({ ...w, exercises: withPlus });
  const before = await store.getWorkout(w.id);
  ok(before.exercises[0].reps && before.exercises[0].reps[2].plus === true, 'saveWorkout keeps "5+" (the baseline)');
  const exercises = await store.getExercises();
  const swapIn = exercises.find((e) => !w.exercises.some((x) => x.exerciseId === e.id)).id;
  await store.updateWorkoutExercises(w.id, [
    { exerciseId: w.exercises[0].exerciseId },
    { exerciseId: swapIn, swappedFrom: w.exercises[1].exerciseId },
  ]);
  const after = await store.getWorkout(w.id);
  ok(after.exercises[0].reps && after.exercises[0].reps[2].plus === true
     && !after.exercises[0].reps[0].plus,
    'a kept exercise keeps its "or more" last set, and only that set');
  ok(after.exercises[1].exerciseId === swapIn && after.exercises[1].reps
     && after.exercises[1].reps[2].plus === true,
    'a swapped exercise takes over the "or more" flag with the plan');
  const raw = JSON.stringify(after);
  ok(!/"plus":false/.test(raw), 'only true is ever written');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
