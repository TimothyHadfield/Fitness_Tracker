// Headless tests for routine-from-session.js. No DOM, no store, no jsdom.
//   node tests/routine.test.mjs
//
// The one this file exists for is the first block: a friend's weights must not
// be able to reach a workout template. Everything else is arithmetic.

// routine-from-session.js needs nothing to run. store.js is imported only for
// normalizeWorkout(), so the copy is checked through the REAL save path rather
// than against a hand-copy of its rules — and store.js wants a localStorage.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { routineFromSession } = await import('../js/routine-from-session.js');
const { normalizeWorkout } = await import('../js/store.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

// My library, as store.getExerciseMap() hands it over.
const MY = new Map([
  ['bb-bench', { id: 'bb-bench', name: 'Barbell Bench Press' }],
  ['bb-row', { id: 'bb-row', name: 'Barbell Row' }],
  ['db-fly', { id: 'db-fly', name: 'Dumbbell Fly' }],
  ['pull-up', { id: 'pull-up', name: 'Pull-Up' }],
]);

const set = (weight, reps) => ({ weight, reps });
const entry = (exerciseId, name, sets, extra = {}) => ({ exerciseId, name, sets, ...extra });

/* ---------- the whole point: a record is not a plan ---------- */
{
  const session = {
    date: '2026-08-30',
    name: 'Push',
    entries: [entry('bb-bench', 'Barbell Bench Press', [set(185, 8), set(185, 7), set(185, 6)])],
  };
  const { workout } = routineFromSession(session, MY, { from: 'Autumn' });
  const json = JSON.stringify(workout);

  ok(!/185/.test(json),
     '🚨 their 185 is nowhere in the copy — a fact about them would be a prescription to me');
  ok(!/weight/i.test(json) && !/\breps\b/.test(json),
     '🚨 no weight and no rep field exists in a workout template, so there is nowhere to put one');
  ok(Object.keys(workout.exercises[0]).sort().join(',') === 'exerciseId,notes,sets',
     'a copied exercise is exactly { exerciseId, sets, notes } — the shape saveWorkout stores');

  // The structural guarantee, checked through the real gate rather than by
  // eye: normalizeWorkout() rebuilds field by field, so if a weight ever did
  // sneak in above, this is where it would have to survive to matter.
  const saved = normalizeWorkout({ ...workout, id: 'w1' });
  ok(!/185/.test(JSON.stringify(saved)),
     '🚨 and it is still not there after normalizeWorkout — the guard is the shape, not a check');

  ok(workout.exercises[0].sets === 3, 'set counts DO carry — three sets in, three sets out');
}

/* ---------- counting sets the way the rest of the app counts them ---------- */
{
  const session = {
    date: '2026-08-30',
    name: 'Push',
    entries: [entry('bb-bench', 'Barbell Bench Press', [set(185, 8), {}, { weight: 0, reps: 0 }])],
  };
  const { workout } = routineFromSession(session, MY, { from: 'Autumn' });
  ok(workout.exercises[0].sets === 1,
     'an empty set row was never done, so it plans nothing — recordedSetCount decides that, not this module');
}

{
  // progress.md §6, and the oldest resolved-without-asking decision here.
  const session = {
    date: '2026-08-30',
    name: 'Arms',
    entries: [entry('db-fly', 'Dumbbell Fly', [
      { weight: 40, reps: 10, minis: [{ weight: 30, reps: 6 }, { weight: 20, reps: 6 }] },
    ], { setType: 'drop' })],
  };
  const { workout } = routineFromSession(session, MY, {});
  ok(workout.exercises[0].sets === 1,
     '🚨 a drop set plans ONE hard set, not one plus its two drops — else every copy inflates');
  ok(workout.exercises[0].setType === 'drop' && workout.exercises[0].minis === 2,
     'the drop set itself carries across — how a set is performed is a plan, not a number of theirs');
}

{
  const session = {
    date: '2026-08-30',
    name: 'Back',
    entries: [entry('pull-up', 'Pull-Up', [{ reps: 10 }, { reps: 8 }, { reps: 6 }])],
  };
  const { workout, warnings } = routineFromSession(session, MY, { from: 'Autumn' });
  ok(workout.exercises[0].sets === 3, 'a bodyweight set is a set — three of them copy as three');
  ok(!warnings.some((w) => /weights are not copied/i.test(w)),
     'and no line about weights not copying on a session that had none — that would be noise');
}

/* ---------- an exercise I do not have ---------- */
{
  const session = {
    date: '2026-08-30',
    name: 'Pull',
    entries: [
      entry('bb-row', 'Barbell Row', [set(135, 10), set(135, 10)]),
      entry('their-custom-93', 'Nordic Hamstring Curl (band)', [{ reps: 6 }, { reps: 5 }]),
      entry(null, 'Sled Push', [{ distance: 40 }]),
    ],
  };
  const { workout, dropped } = routineFromSession(session, MY, { from: 'Autumn' });

  ok(workout.exercises.length === 1 && workout.exercises[0].exerciseId === 'bb-row',
     'an exercise my library has nothing to point at cannot go in — the runner would open an empty row');
  ok(dropped.length === 2, 'both of them come back rather than vanishing');
  ok(dropped.map((d) => d.name).join(' · ') === 'Nordic Hamstring Curl (band) · Sled Push',
     'and they come back BY NAME, so the screen can say what it could not bring');
  ok(dropped[1].exerciseId === null && dropped[1].sets === 1,
     'a null id is dropped like any other unresolvable one, with its set count intact');
}

/* ---------- supersets ---------- */
{
  const session = {
    date: '2026-08-30',
    name: 'Upper',
    entries: [
      entry('bb-bench', 'Barbell Bench Press', [set(185, 8)], { group: 7 }),
      entry('bb-row', 'Barbell Row', [set(135, 10)], { group: 7 }),
      entry('db-fly', 'Dumbbell Fly', [set(30, 12)]),
    ],
  };
  const { workout, warnings } = routineFromSession(session, MY, {});
  ok(workout.exercises[0].group === 0 && workout.exercises[1].group === 0,
     'a superset survives the copy — a workout template has a `group`, so nothing had to be invented');
  ok(!('group' in workout.exercises[2]),
     'and the exercise that was not part of it does not acquire one');
  ok(!warnings.some((w) => /superset/i.test(w)), 'an intact superset says nothing');
}

{
  // The tri-set with a member I do not have.
  const session = {
    date: '2026-08-30',
    name: 'Upper',
    entries: [
      entry('bb-bench', 'Barbell Bench Press', [set(185, 8)], { group: 2 }),
      entry('their-custom-93', 'Band Pull-Apart (theirs)', [{ reps: 20 }], { group: 2 }),
      entry('bb-row', 'Barbell Row', [set(135, 10)], { group: 2 }),
    ],
  };
  const { workout, warnings } = routineFromSession(session, MY, {});
  ok(workout.exercises.length === 2 && workout.exercises.every((e) => e.group === 0),
     'the two I do have are still a block — they are genuinely back to back now');
  ok(warnings.some((w) => /superset/i.test(w)),
     '⚠️ but it is not the block they did, and the copy says so instead of passing it off as theirs');
}

{
  // normalizeGroups' own rule, reached through this module: a group of one is
  // not a group, whatever the id said.
  const session = {
    date: '2026-08-30',
    name: 'Upper',
    entries: [
      entry('bb-bench', 'Barbell Bench Press', [set(185, 8)], { group: 4 }),
      entry('their-custom-93', 'Whatever (theirs)', [{ reps: 20 }], { group: 4 }),
    ],
  };
  const { workout } = routineFromSession(session, MY, {});
  ok(workout.exercises.length === 1 && !('group' in workout.exercises[0]),
     'the last exercise standing is not a one-man superset');
}

/* ---------- the name ---------- */
{
  const s = { date: '2026-08-30', name: 'Push', entries: [entry('bb-bench', 'Bench', [set(185, 8)])] };
  ok(routineFromSession(s, MY, { from: 'Autumn' }).workout.name === 'Push (from Autumn)',
     'the name says where it came from — six months on, "Push" beside my own "Push" is a puzzle');
  ok(routineFromSession(s, MY, {}).workout.name === 'Push',
     'no name to credit, no parentheses');
  ok(routineFromSession({ ...s, name: '' }, MY, { from: 'Autumn' }).workout.name === 'Workout (from Autumn)',
     'an unnamed session is still a copy of somebody');

  const long = { ...s, name: 'Chest and Shoulders and Arms and Everything Else Besides' };
  const capped = routineFromSession(long, MY, { from: 'Autumn' }).workout.name;
  ok(capped.length <= 60, `a copied name fits the builder's own 60-char input (${capped.length})`);
  ok(capped.endsWith(' (from Autumn)'),
     '⚠️ and the credit is the half that survives the cap — trimming it off would lose the reason for the suffix');
}

/* ---------- the ragged cases, none of which throw ---------- */
{
  const empty = routineFromSession({ date: '2026-08-30', name: 'Push' }, MY, { from: 'Autumn' });
  ok(empty.workout.exercises.length === 0 && empty.dropped.length === 0,
     'entries: undefined is an empty routine, not a crash');

  const none = routineFromSession({ name: 'Push', entries: [] }, MY, {});
  ok(none.workout.exercises.length === 0 && none.warnings.length === 1,
     'a session with no entries says so once and stops');

  const allUnknown = routineFromSession({
    name: 'Their Split',
    entries: [
      entry('their-1', 'Reverse Nordic', [{ reps: 8 }]),
      entry('their-2', 'Jefferson Curl', [{ weight: 45, reps: 10 }]),
    ],
  }, MY, { from: 'Autumn' });
  ok(allUnknown.workout.exercises.length === 0 && allUnknown.dropped.length === 2,
     'a session where I have none of the exercises returns an empty workout rather than throwing');
  ok(allUnknown.workout.name === 'Their Split (from Autumn)',
     'an empty copy still knows whose it was — the caller can offer it or bin it');
  ok(allUnknown.warnings.some((w) => /library/i.test(w)),
     'and it says why it is empty rather than looking like a bug');

  ok(routineFromSession(null, MY, {}).workout.exercises.length === 0,
     'no session at all is an empty routine, not a throw');
  ok(routineFromSession({ name: 'Push', entries: [entry('bb-bench', 'Bench', [set(185, 8)])] },
                        undefined, {}).dropped.length === 1,
     'no library means nothing resolves — everything is reported, nothing is guessed');

  const ragged = routineFromSession({
    name: 'Push',
    entries: [null, entry('bb-bench', 'Bench', [set(185, 8)]), undefined],
  }, MY, {});
  ok(ragged.workout.exercises.length === 1, 'a hole in entries[] is stepped over');
}

/* ---------- duplicates stay separate ---------- */
{
  const session = {
    date: '2026-08-30',
    name: 'Push',
    entries: [
      entry('bb-bench', 'Barbell Bench Press', [set(185, 8), set(185, 7), set(185, 6)]),
      entry('db-fly', 'Dumbbell Fly', [set(30, 12)]),
      entry('bb-bench', 'Barbell Bench Press', [set(135, 12), set(135, 12)]),
    ],
  };
  const { workout } = routineFromSession(session, MY, {});
  ok(workout.exercises.length === 3 && workout.exercises.map((e) => e.sets).join(',') === '3,1,2',
     '⚠️ bench twice copies as 3 sets then 2, not one row of 5 — the order somebody trained in is information');
}

/* ---------- what a plain object library does ---------- */
{
  const obj = { 'bb-bench': { id: 'bb-bench', name: 'Barbell Bench Press' } };
  const { workout, dropped } = routineFromSession({
    name: 'Push',
    entries: [entry('bb-bench', 'Bench', [set(185, 8)]), entry('bb-row', 'Row', [set(135, 8)])],
  }, obj, {});
  ok(workout.exercises.length === 1 && dropped.length === 1,
     'a plain object works as a library too, and inherited keys are not exercises');
  ok(routineFromSession({ name: 'x', entries: [entry('toString', 'Odd', [{ reps: 5 }])] }, obj, {})
       .dropped.length === 1,
     'and "toString" is not in my library, whatever Object.prototype thinks');
}

/* ---------- the whole thing, end to end, through the real gate ---------- */
{
  const session = {
    id: 's_abc', date: '2026-08-30', name: 'Push', startedAt: '2026-08-30T18:40:00.000Z',
    minutes: 55, location: "Gold's Gym", note: 'Felt strong.',
    entries: [
      entry('bb-bench', 'Barbell Bench Press', [set(185, 8), set(185, 7), set(185, 6)], { group: 1 }),
      entry('db-fly', 'Dumbbell Fly', [set(30, 12), set(30, 12)], { group: 1 }),
      entry('their-custom-93', 'Landmine Press (theirs)', [set(90, 10)]),
    ],
  };
  const { workout, dropped, warnings } = routineFromSession(session, MY, { from: 'Autumn' });
  const saved = normalizeWorkout({ ...workout, id: 'w_new', systemId: 'sys_1' });

  ok(saved.exercises.length === 2 && saved.exercises.every((e) => e.group === 0),
     'saveWorkout gets a two-exercise superset back');
  ok(saved.exercises.map((e) => e.sets).join(',') === '3,2', 'with their set counts intact');
  ok(saved.exercises.every((e) => e.notes === ''),
     'and no notes — a coaching cue nobody wrote is worse than an empty field');
  ok(!/185|30|90/.test(JSON.stringify(saved.exercises)),
     '🚨 and not one of their numbers, all the way through the save path');
  ok(dropped.length === 1 && warnings.length === 1,
     'one exercise named as missing, one line about weights, nothing else invented');
  ok(!('date' in workout) && !('note' in workout) && !('id' in workout),
     'their session id, date and note stay theirs — a template is not a record');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
