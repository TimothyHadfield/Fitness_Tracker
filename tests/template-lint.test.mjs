// Headless tests for the workout linter. No DOM required.
//   node tests/template-lint.test.mjs
//
// ⚠️ THE ASSERTION THIS FILE EXISTS FOR IS THE EMPTY ONE. A linter is judged on
// what it stays quiet about, and "a sensible plan produces no findings" is the
// only test here that cannot be satisfied by writing more checks.
//
// ⚠️ AND THE SECOND ONE IS THE SCOPE. The coverage check was per-day once, it
// fired on 10 of the 36 days in preset-systems.js, and every one of those was
// structurally bogus — "Chest day, no direct triceps" in a split with an Arms
// day on it. The split-covers-it / split-does-not-cover-it pair below is the
// regression test for that, and the last block re-runs the measurement against
// the app's own presets so the number cannot quietly climb back.
//
// Check 2's data comes from js/exercise-evidence.js. Most tests inject a STUB
// through `opts.evidence` — so the wording and the scope logic are tested
// against data this file controls, and so shapes the real module can never be
// made to produce on demand (absent, empty, throwing) can be tested at all.

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { SOURCES: RESEARCH_SOURCES } = await import('../js/research-topics.js');
const { SESSION_CEILING } = await import('../js/volume-map.js');
const { PRESET_SYSTEMS } = await import('../js/preset-systems.js');
const { lintWorkout, lintProgramme, SETS_PER_SESSION_LIMIT, INDIRECT_ONLY_MIN_SETS } =
  await import('../js/template-lint.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const byName = (n) => {
  const e = BUILT_IN_EXERCISES.find((x) => x.name === n);
  if (!e) throw new Error('no such exercise in the library: ' + n);
  return e;
};

/** A workout in the real saved shape — see WorkoutBuilderView in views-workouts.js. */
const workout = (name, pairs) => ({
  id: 'w-' + name.toLowerCase().replace(/\s+/g, '-'),
  name,
  exercises: pairs.map(([exName, sets]) => ({
    exerciseId: exName.startsWith('ghost-') ? exName : byName(exName).id,
    sets,
    notes: '',
  })),
});

const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

/* The stub. Biceps is the classic case and the only muscle it speaks for —
 * everything else must come back null, which is what proves a finding is the
 * DATA talking and not this module having opinions about shoulders. */
const stub = {
  MUSCLE_COVERAGE: {
    Biceps: {
      needsDirectWork: true,
      claim: 'Rows and pulldowns load the elbow flexors, but direct curling adds growth on top.',
      sources: ['stub2026'],
      confidence: 'good',
    },
    Chest: { needsDirectWork: false, claim: 'Chest is trained directly by every press.', sources: ['stub2026'], confidence: 'strong' },
  },
  coverageFor(m) { return this.MUSCLE_COVERAGE[m] || null; },
};

const codes = (list) => list.map((f) => f.code).sort();
const find = (list, code) => list.find((f) => f.code === code);

/* ---------- the quiet case ---------- */
{
  const clean = workout('Full Body', [
    ['Barbell Bench Press', 3], ['Barbell Row', 3], ['Barbell Curl', 3], ['Back Squat', 3],
  ]);
  ok(lintWorkout(clean, exMap).length === 0, 'a sensible day returns [] — the normal answer');
  ok(lintProgramme([clean], exMap, { evidence: stub }).length === 0, 'and so does the same day as a one-day programme');

  ok(lintWorkout(null, exMap).length === 0, 'no workout at all returns []');
  ok(lintWorkout({ exercises: [] }, exMap).length === 0, 'an empty workout returns []');
  ok(lintWorkout({ name: 'x' }, exMap).length === 0, 'a workout with no exercises array returns []');
}

/* ---------- check 1: sets on one muscle in one session, PER DAY ---------- */
{
  const heavy = workout('Chest', [['Barbell Bench Press', 7], ['Incline Barbell Bench Press', 7]]);
  const out = lintWorkout(heavy, exMap);
  const f = find(out, 'SETS_PER_SESSION');

  ok(codes(out).join() === 'SETS_PER_SESSION', `14 chest sets trips exactly one finding (${codes(out).join() || 'none'})`);
  ok(f && f.muscle === 'Chest', 'and it names the muscle it counted');
  ok(f && f.workoutId === 'w-chest', 'and the day it counted, because a session ceiling is answerable to one day');
  ok(f && f.severity === 'note', 'severity is a note — past 11 the research stops separating sets, it does not stop working');
  ok(f && f.exerciseIds.length === 2, 'it names both exercises that contributed the sets');
  ok(f && f.sources.join() === 'acsm2026,remmert2025', `cited to the sets-and-reps sources (${f && f.sources.join()})`);
  ok(f && f.confidence === 'limited',
     'confidence is `limited`, not the topic’s `strong` — the 11 rests on a preprint, and the confidence travels with the claim');
  ok(f && f.message === 'Chest: 14 sets here — past about 11 in one session the research stops separating them.',
     `the sentence, verbatim: "${f && f.message}"`);

  const light = workout('Chest', [['Barbell Bench Press', 4], ['Incline Barbell Bench Press', 4]]);
  ok(lintWorkout(light, exMap).length === 0, '8 chest sets says nothing');

  const at = workout('Chest', [['Barbell Bench Press', SETS_PER_SESSION_LIMIT]]);
  const over = workout('Chest', [['Barbell Bench Press', SETS_PER_SESSION_LIMIT + 1]]);
  ok(lintWorkout(at, exMap).length === 0, `exactly ${SETS_PER_SESSION_LIMIT} sets is silent — the finding is PAST the number`);
  ok(codes(lintWorkout(over, exMap)).includes('SETS_PER_SESSION'), `${SETS_PER_SESSION_LIMIT + 1} sets trips it`);
  ok(SETS_PER_SESSION_LIMIT === 11, 'the threshold is exported, and it is the 11 the Research tab already prints');

  const absurd = workout('Chest', [['Barbell Bench Press', 28]]);
  const w = find(lintWorkout(absurd, exMap), 'SETS_PER_SESSION');
  ok(w && w.severity === 'warn', `past ${SESSION_CEILING} sets the severity rises to warn`);
  ok(w && w.message === 'Chest: 28 sets here — past 24 in one session no study has measured anything.',
     `and the sentence changes with it: "${w && w.message}"`);

  const spread = workout('Upper', [['Barbell Bench Press', 8], ['Barbell Row', 8], ['Barbell Curl', 4]]);
  ok(lintWorkout(spread, exMap).length === 0,
     '16 sets spread over chest and back trips nothing — the check is per muscle, not per session');

  const shelf = workout('Conditioning', [['Running', 20]]);
  ok(lintWorkout(shelf, exMap).length === 0,
     '20 sets on the Activity shelf says nothing — "Activity has 20 sets" is not a sentence about a muscle');
}

/* ---------- ⚠️ THE SCOPE FIX: coverage is a question about the SPLIT ---------- */
{
  const push = workout('Push', [['Barbell Bench Press', 4], ['Overhead Press', 4]]);
  const pull = workout('Pull', [['Barbell Row', 4], ['Lat Pulldown', 4]]);
  const arms = workout('Arms', [['Barbell Curl', 3], ['Triceps Pushdown', 3]]);

  /* The bug, stated as a test: the Pull day ON ITS OWN never trains biceps
   * directly, and that used to be a finding. It is a fact about a Tuesday, not
   * about a programme. */
  const aloneCodes = codes(lintProgramme([pull], exMap, { evidence: stub }));
  ok(aloneCodes.join() === 'NEEDS_DIRECT_WORK',
     'the pull day AS A ONE-DAY PROGRAMME does flag biceps — a one-day programme really never curls');

  const covered = lintProgramme([push, pull, arms], exMap, { evidence: stub });
  ok(covered.length === 0,
     'but the same pull day inside a split with an ARMS DAY is silent — 10-of-36 noise, gone');

  const uncovered = lintProgramme([push, pull], exMap, { evidence: stub });
  const f = find(uncovered, 'NEEDS_DIRECT_WORK');
  ok(codes(uncovered).join() === 'NEEDS_DIRECT_WORK',
     `a split with no direct biceps work anywhere still reports it (${codes(uncovered).join() || 'none'})`);
  ok(f && f.muscle === 'Biceps', 'and the muscle is Biceps — rows and pulldowns are indirect for it, per volume-map');
  ok(f && f.workoutId === null,
     '⚠️ workoutId is null: no single day is answerable for "this split never curls", so none is blamed');
  ok(f && f.severity === 'note', 'a note: it reports what the evidence says, it does not correct the plan');
  ok(f && f.exerciseIds.length === 2 && new Set(f.exerciseIds).size === 2,
     'it names the exercises that did the indirect work, across every day, deduplicated');
  ok(f && f.sources.join() === 'stub2026' && f.confidence === 'good',
     'sources and confidence come from the coverage entry, unaltered — this module adds no citations of its own');
  ok(f && f.message === 'Biceps: worked only indirectly in this plan — the evidence says it responds to direct sets.',
     `the sentence, verbatim: "${f && f.message}"`);

  /* ONE direct set anywhere settles it. Not a proportion, not a threshold — the
   * question is whether the programme trains that muscle directly at all. */
  const oneCurl = lintProgramme([push, pull, workout('Arms Lite', [['Barbell Curl', 1]])], exMap, { evidence: stub });
  ok(oneCurl.length === 0, 'a single direct set on any day settles the question — the check asks "ever", not "enough"');

  // Day ORDER cannot matter: the arms day covers the pull day whichever comes first.
  ok(lintProgramme([arms, pull, push], exMap, { evidence: stub }).length === 0, 'and the day order makes no difference');

  /* ⚠️ lintWorkout NO LONGER ANSWERS THIS QUESTION AT ALL, and not by accident.
   * Handed perfect stub data and a day that would obviously trip, it returns
   * nothing — because a day cannot answer it. This is the assertion that keeps
   * the check from creeping back into the per-day path. */
  ok(lintWorkout(pull, exMap, { evidence: stub }).length === 0,
     'lintWorkout never returns NEEDS_DIRECT_WORK, even handed the evidence that would trip it');
  ok(lintWorkout(pull, exMap, { evidence: stub }).every((x) => x.code === 'SETS_PER_SESSION'),
     'lintWorkout returns SETS_PER_SESSION and nothing else, ever');

  // needsDirectWork: false is a real answer and is honoured as one.
  const noWork = { coverageFor: () => ({ needsDirectWork: false, sources: [], confidence: 'strong' }) };
  ok(lintProgramme([pull], exMap, { evidence: noWork }).length === 0, '`needsDirectWork: false` is silence, not a finding');

  // Muscles the data does not speak for produce nothing, however worked.
  ok(!uncovered.some((x) => x.muscle === 'Forearms' || x.muscle === 'Traps' || x.muscle === 'Triceps'),
     'muscles the coverage data does not speak for stay silent, however indirectly they were worked');

  /* The floor, now measured over the whole programme. */
  const legsPlusRows = [workout('Legs', [['Back Squat', 4]]), workout('Extras', [['Barbell Row', INDIRECT_ONLY_MIN_SETS - 1]])];
  ok(lintProgramme(legsPlusRows, exMap, { evidence: stub }).length === 0,
     `${INDIRECT_ONLY_MIN_SETS - 1} indirect sets across the whole programme is below the floor and stays quiet`);
  const atFloor = [workout('Legs', [['Back Squat', 4]]), workout('Extras', [['Barbell Row', INDIRECT_ONLY_MIN_SETS]])];
  ok(codes(lintProgramme(atFloor, exMap, { evidence: stub })).includes('NEEDS_DIRECT_WORK'),
     `${INDIRECT_ONLY_MIN_SETS} reaches it — and the floor is now summed over days, not within one`);
  // Two days of two sets each clear a floor neither day clears alone.
  const split = [workout('A', [['Barbell Row', 2]]), workout('B', [['Lat Pulldown', 2]])];
  ok(codes(lintProgramme(split, exMap, { evidence: stub })).includes('NEEDS_DIRECT_WORK'),
     'and 2 + 2 across two days clears a floor neither day clears alone');
}

/* ---------- SETS_PER_SESSION inside a programme stays per day ---------- */
{
  const heavyPush = workout('Push', [['Barbell Bench Press', 7], ['Incline Barbell Bench Press', 7]]);
  const heavyPull = workout('Pull', [['Barbell Row', 7], ['Lat Pulldown', 7]]);
  const arms = workout('Arms', [['Barbell Curl', 3], ['Triceps Pushdown', 3]]);

  const out = lintProgramme([heavyPush, heavyPull, arms], exMap, { evidence: stub });
  const sets = out.filter((f) => f.code === 'SETS_PER_SESSION');
  ok(sets.length === 2, `both heavy days report separately (${sets.length})`);
  ok(sets[0].workoutId === 'w-push' && sets[0].muscle === 'Chest', 'the chest finding carries the Push day’s id');
  ok(sets[1].workoutId === 'w-pull' && sets[1].muscle === 'Back', 'the back finding carries the Pull day’s id');
  ok(sets.every((f) => f.message.includes(' here ')),
     'and both still say "here" — a session ceiling points at the day on screen');
  ok(!out.some((f) => f.code === 'NEEDS_DIRECT_WORK'),
     'while the covered biceps stay silent: the two checks run at their own scopes, independently');

  /* 14 chest sets ACROSS two days is not 14 sets in a session. */
  const spreadOut = lintProgramme(
    [workout('Chest A', [['Barbell Bench Press', 7]]), workout('Chest B', [['Incline Barbell Bench Press', 7]])],
    exMap, { evidence: stub },
  );
  ok(!spreadOut.some((f) => f.code === 'SETS_PER_SESSION'),
     '⚠️ 7 + 7 over two days trips nothing — the per-day check must never pool, which is the mirror of the coverage bug');

  // A day with no id still reports; it just cannot be attributed.
  const anon = lintProgramme([{ exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 14 }] }], exMap, { evidence: stub });
  ok(anon.some((f) => f.code === 'SETS_PER_SESSION' && f.workoutId === null),
     'a day with no id of its own still reports, with workoutId null');
}

/* ---------- programmes of nothing, and of one ---------- */
{
  const one = workout('Chest', [['Barbell Bench Press', 14]]);
  for (const [label, input] of [
    ['an empty array', []],
    ['null', null],
    ['undefined', undefined],
    ['a non-array', { exercises: [] }],
    ['an array of nulls', [null, undefined]],
    ['days with no exercises', [{ id: 'a' }, { id: 'b', exercises: [] }]],
  ]) {
    let out = null; let threw = null;
    try { out = lintProgramme(input, exMap, { evidence: stub }); } catch (e) { threw = e; }
    ok(!threw && Array.isArray(out) && out.length === 0, `a programme of ${label}: [] , no crash`);
  }
  ok(lintProgramme([one], exMap, { evidence: stub }).length === 1, 'a programme of one day reports that day’s finding');
  ok(lintProgramme([one], exMap, { evidence: stub })[0].workoutId === 'w-chest', 'and still attributes it to the day');
  ok(JSON.stringify(lintProgramme([one], exMap, { evidence: stub }))
     === JSON.stringify(lintWorkout(one, exMap).map((f) => f)),
     'a one-day programme and lintWorkout agree on the SETS_PER_SESSION half');
}

/* ---------- ⚠️ the missing dependency, in every shape it can arrive in ---------- */
{
  const pull = workout('Pull', [['Barbell Row', 4], ['Lat Pulldown', 4]]);
  const heavy = workout('Chest', [['Barbell Bench Press', 14]]);

  const shapes = [
    ['null (the module could not be loaded)', null],
    ['an empty module', {}],
    ['a module with an empty table', { MUSCLE_COVERAGE: {} }],
    ['coverageFor() returning null for everything', { coverageFor: () => null }],
    ['coverageFor() returning undefined', { coverageFor: () => undefined }],
    ['an entry with no needsDirectWork field', { coverageFor: () => ({ claim: 'half written' }) }],
    ['coverageFor() that THROWS', { coverageFor: () => { throw new Error('mid-edit'); } }],
  ];

  for (const [label, evidence] of shapes) {
    let out = null; let threw = null;
    try { out = lintProgramme([pull], exMap, { evidence }); } catch (e) { threw = e; }
    ok(!threw && out && out.length === 0, `${label}: no findings, no crash`);
  }

  // ⚠️ And the half that must NOT go quiet with it. Check 1 cites
  // research-topics.js and owes nothing to exercise-evidence.js.
  const stillCounts = lintProgramme([heavy], exMap, { evidence: null });
  ok(codes(stillCounts).join() === 'SETS_PER_SESSION',
     'with no evidence module at all, the set count still reports — the two checks fail independently');

  ok(lintProgramme([pull], exMap).length >= 0, 'called with no opts at all it does not throw');
  ok(lintProgramme([pull], exMap, {}).length >= 0, 'called with an empty opts it does not throw');
}

/* ---------- exercises the map does not hold ---------- */
{
  const ghosts = {
    id: 'w-ghosts',
    name: 'Deleted customs',
    exercises: [
      { exerciseId: 'ghost-one', sets: 5, notes: '' },
      { exerciseId: null, sets: 5, notes: '' },
      null,
      { exerciseId: byName('Barbell Bench Press').id, sets: 14, notes: '' },
      { exerciseId: byName('Barbell Row').id, sets: 0, notes: '' },
      { exerciseId: byName('Lat Pulldown').id, notes: '' },
    ],
  };
  let out = null; let threw = null;
  try { out = lintProgramme([ghosts], exMap, { evidence: stub }); } catch (e) { threw = e; }
  ok(!threw, 'an id the map does not hold is skipped, not thrown on — a deleted custom exercise cannot break the builder');
  ok(out && codes(out).join() === 'SETS_PER_SESSION' && find(out, 'SETS_PER_SESSION').muscle === 'Chest',
     'and the rows it CAN read are still read: the 14 chest sets report');
  ok(out && !out.some((f) => f.exerciseIds.includes('ghost-one')),
     'no finding ever names an exercise the map could not resolve');

  ok(lintProgramme([workout('Nothing', [])], {}, { evidence: stub }).length === 0, 'an empty plain-object exMap returns []');
  ok(lintProgramme([workout('Chest', [['Barbell Bench Press', 14]])], null, { evidence: stub }).length === 0,
     'no exMap at all returns [] rather than throwing');

  const objMap = Object.fromEntries(exMap);
  const heavy = [workout('Chest', [['Barbell Bench Press', 14]])];
  ok(JSON.stringify(lintProgramme(heavy, objMap, { evidence: stub }))
     === JSON.stringify(lintProgramme(heavy, exMap, { evidence: stub })),
     'a plain object exMap gives the same answer as a Map');
}

/* ---------- ⚠️ the wording, which is a shipped surface ---------- */
{
  const all = [
    ...lintWorkout(workout('Chest', [['Barbell Bench Press', 14]]), exMap),
    ...lintWorkout(workout('Chest', [['Barbell Bench Press', 28]]), exMap),
    ...lintProgramme([workout('Pull', [['Barbell Row', 4], ['Lat Pulldown', 4]])], exMap, { evidence: stub }),
  ];
  ok(all.length === 3, 'three distinct messages to check');

  for (const f of all) {
    const words = f.message.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
    ok(words.length <= 15, `"${f.message}" is ${words.length} words — the budget is 15`);
    ok(/^[A-Z].*\.$/.test(f.message) && f.message.split('.').filter(Boolean).length === 1,
       'one sentence, ending in a full stop');
  }

  /* ⚠️ RULE 5 OF research-topics.js, ASSERTED. "No exercise prescriptions for a
   * person." The moment one of these sentences tells somebody their plan is
   * wrong, this app is in a business its own caveat says it has no standing in. */
  const prose = all.map((f) => f.message).join(' ');
  ok(!/\b(should|must|need to|too many|too much|wrong|bad|fix|avoid|recommend|add more|reduce)\b/i.test(prose),
     'not one verdict or instruction anywhere in the wording — it reports, it does not prescribe');
  ok(!/\b(optimal|ideal|best|perfect)\b/i.test(prose), 'and no claim that some other number would have been optimal');

  const cited = all.filter((f) => f.code === 'SETS_PER_SESSION');
  ok(cited.length > 0 && cited.every((f) => f.sources.length === 2 && f.sources.every((id) => RESEARCH_SOURCES[id])),
     'every SETS_PER_SESSION source id resolves in research-topics.js SOURCES');

  for (const f of all) {
    ok(['SETS_PER_SESSION', 'NEEDS_DIRECT_WORK'].includes(f.code)
       && ['note', 'warn'].includes(f.severity)
       && typeof f.muscle === 'string' && f.muscle
       && ('workoutId' in f)
       && Array.isArray(f.exerciseIds) && Array.isArray(f.sources)
       && ['strong', 'good', 'limited'].includes(f.confidence),
       `${f.code} has every field the renderer needs, including workoutId, with a confidence from the three-level scale`);
  }
}

/* ---------- purity ---------- */
{
  const days = [
    workout('Pull', [['Barbell Row', 4], ['Lat Pulldown', 4]]),
    workout('Chest', [['Barbell Bench Press', 14]]),
  ];
  const before = JSON.stringify(days);
  const mapBefore = JSON.stringify([...exMap.entries()]);
  const a = lintProgramme(days, exMap, { evidence: stub });
  const b = lintProgramme(days, exMap, { evidence: stub });
  ok(JSON.stringify(days) === before, 'it mutates nothing in the plan it was handed');
  ok(JSON.stringify([...exMap.entries()]) === mapBefore, 'nor anything in the exercise map');
  ok(JSON.stringify(a) === JSON.stringify(b), 'and two runs agree — no clock, no store, no order dependence');

  a[0].exerciseIds.push('tampered');
  ok(JSON.stringify(lintProgramme(days, exMap, { evidence: stub })) === JSON.stringify(b),
     'the arrays it returns are copies — a caller cannot reach back into the data');
}

/* ---------- ⚠️ THE MEASUREMENT, AGAINST THE APP'S OWN PRESETS ---------- */
/* This is the block that caught the design error, run here against the REAL
 * evidence module rather than the stub. Every preset system is linted as a
 * PROGRAMME, which is what it is. The assertions are deliberately loose caps
 * rather than exact counts — a new preset or a new coverage entry should be
 * free to move these numbers, and should not be free to make the linter noisy
 * again. If a preset does trip a coverage finding, that is worth reading: it
 * may be a real gap in that programme. */
{
  const idFor = (n) => {
    const e = BUILT_IN_EXERCISES.find((x) => x.name === n);
    return e ? e.id : 'unresolved-' + n;
  };
  // Presets key exercises by NAME (see the header of preset-systems.js).
  const asProgramme = (sys) => (sys.workouts || []).map((w) => ({
    id: `${sys.id}/${w.key}`,
    name: w.name,
    exercises: (w.exercises || []).map((e) => ({ exerciseId: idFor(e.name), sets: e.sets })),
  }));

  const programmes = PRESET_SYSTEMS.map(asProgramme);
  const days = programmes.reduce((n, p) => n + p.length, 0);
  ok(days >= 30, `linting ${PRESET_SYSTEMS.length} preset systems, ${days} days in total`);

  const all = programmes.flatMap((p) => lintProgramme(p, exMap));
  const sets = all.filter((f) => f.code === 'SETS_PER_SESSION');
  const cover = all.filter((f) => f.code === 'NEEDS_DIRECT_WORK');
  const daysHit = new Set(sets.map((f) => f.workoutId)).size;
  const systemsHit = new Set(cover.flatMap((f) => programmes
    .filter((p) => p.some((d) => f.exerciseIds.some((id) => d.exercises.some((e) => e.exerciseId === id))))
    .map((p) => p[0] && p[0].id))).size;

  console.log(`      → SETS_PER_SESSION ${sets.length} on ${daysHit} of ${days} days`);
  for (const f of sets) console.log(`        · ${f.workoutId}: ${f.message}`);
  console.log(`      → NEEDS_DIRECT_WORK ${cover.length} across ${PRESET_SYSTEMS.length} systems`);
  for (const f of cover) console.log(`        · ${f.message} [${f.exerciseIds.length} exercises]`);

  ok(sets.length >= 1, `the genuine per-session findings survive the rescope (${sets.length})`);
  ok(cover.length <= 4,
     `⚠️ coverage findings across every shipped programme: ${cover.length} — was 10 at day scope, and the cap here is 4`);
  ok(daysHit / days < 0.2,
     `and the share of days carrying a per-session finding is ${(100 * daysHit / days).toFixed(0)}%, under the 20% cap`);
  ok(systemsHit >= 0, 'measurement ran to completion against the real evidence module');
  ok(all.every((f) => typeof f.message === 'string' && f.message.length < 120),
     'every message the presets produce is still one short sentence');

  /* ⚠️ THE ONE SURVIVOR, PINNED, BECAUSE IT IS TRUE. Arnold's Golden Six is a
   * single full-body day of six lifts: bench press and behind-the-neck press
   * drive the triceps hard and nothing in it extends the elbow directly. The
   * programme is from 1960s bodybuilding and predates every trial in
   * MUSCLE_COVERAGE.Triceps, which found pressing grows the lateral and medial
   * heads and barely touches the long head. That is a genuine gap in a real
   * programme and reporting it is the linter working, not the linter being
   * noisy — so it is asserted rather than suppressed, and a future change that
   * silences it has to come and delete this line on purpose. */
  const golden = PRESET_SYSTEMS.find((s) => s.id === 'preset-arnold-golden-six');
  const goldenOut = golden ? lintProgramme(asProgramme(golden), exMap) : [];
  const gf = goldenOut.find((f) => f.code === 'NEEDS_DIRECT_WORK');
  ok(gf && gf.muscle === 'Triceps',
     'the Golden Six still reports triceps — a one-day full-body plan of presses with no elbow extension, which is true of it');
  ok(gf && gf.confidence === 'good' && gf.sources.length > 0,
     'and it arrives with the real evidence module’s own sources and confidence, not this file’s');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
