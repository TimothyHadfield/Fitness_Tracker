// Headless tests for COMPARING TWO PEOPLE ON ONE EXERCISE. No DOM, no store.
//   node tests/compare.test.mjs
//
// social-plan §13 Step 6. The arithmetic here is four lines of max(); what is
// worth testing is everything the module REFUSES to do, because every one of
// those refusals is a thing the obvious implementation gets wrong:
//
//   THE WINDOW is the load-bearing one. Their side is 60 published sessions
//     and mine is my whole life, so an unwindowed comparison hands me my best
//     ever against their best recent — silently, and in my favour every time.
//     The fixture below is built so the two answers DIFFER: unwindowed I win,
//     windowed they do, and only a real cut can make the assertion pass. A
//     fixture where the answer came out the same either way would prove
//     nothing at all, which is why the widened control runs beside it.
//
//   THE REP GATE (D5) must be this app's gate, not a second looser one.
//
//   BODY WEIGHT cannot be known for a friend, so a bodyweight lift has to come
//     back as a stated refusal — not a zero, which reads as somebody who lifts
//     nothing, and not a guess.
//
//   NO VERDICT. Rule 6. A per-row "this number is larger" is allowed; anything
//     that adds the rows up into a winner is not, and the last block below
//     walks the whole result looking for one.

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { e1rm } = await import('../js/e1rm.js');
const { compareExercise, NO_VERDICT_HEADER } = await import('../js/compare.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const BENCH = byName('Barbell Bench Press');
const DB_BENCH = byName('Dumbbell Bench Press');
const PULLUP = byName('Pull-Up');

// A session, shortened. `mine` uses exerciseName, `theirs` uses name — that is
// the real difference between store.getSessions() and a projection's activity.
const mySession = (date, sets) => ({
  date, entries: [{ exerciseId: BENCH.id, exerciseName: BENCH.name, sets }],
});
const theirSession = (date, sets) => ({
  date, entries: [{ exerciseId: BENCH.id, name: BENCH.name, sets }],
});
const rest = (date) => ({ date, entries: [] });
const metricOf = (res, key) => res.metrics.find((m) => m.key === key) || null;

/* ================================================================== *
 * 1. THE SHARED WINDOW — the whole reason this module exists
 * ================================================================== */

// My 315 x 1 is from last year. They only publish back to June.
const MY_OLD_PR = [
  mySession('2025-01-10', [{ weight: 315, reps: 1 }]),
  mySession('2026-07-04', [{ weight: 185, reps: 5 }]),
  rest('2026-08-15'),
];
const THEIR_RECENT = [
  rest('2026-06-01'),
  theirSession('2026-06-20', [{ weight: 225, reps: 5 }]),
  rest('2026-08-12'),
];

const windowed = compareExercise({
  mine: MY_OLD_PR, theirs: THEIR_RECENT, exerciseId: BENCH.id, exercise: BENCH,
});

ok(windowed.window.start === '2026-06-01' && windowed.window.end === '2026-08-12',
  `the window is the overlap, not either history (${windowed.window.start} to ${windowed.window.end})`);
ok(near(metricOf(windowed, 'e1rm').mine, e1rm(185, 5)),
  'my 315 from last year is OUTSIDE what they publish and does not count');
ok(metricOf(windowed, 'e1rm').better === 'theirs',
  'inside the shared window their 225 x 5 is the bigger estimate — and it says so');
ok(metricOf(windowed, 'top-weight').mine === 185,
  'the heaviest set follows the same window: 185, not 315');

// ⚠️ THE CONTROL. Same fixture, except they publish back past my old PR. If the
// window were not really being applied, this would come back identical to the
// block above — so the two answers differing is the proof.
const widened = compareExercise({
  mine: MY_OLD_PR,
  theirs: [rest('2024-12-01'), ...THEIR_RECENT],
  exerciseId: BENCH.id,
  exercise: BENCH,
});
ok(widened.window.start === '2025-01-10',
  'widen their history and the window opens to where MY data starts');
ok(metricOf(widened, 'e1rm').mine === 315 && metricOf(widened, 'e1rm').better === 'mine',
  'the same 315 counts once it is inside the shared window — the cut was the window, nothing else');
ok(metricOf(windowed, 'e1rm').better !== metricOf(widened, 'e1rm').better,
  'the two runs disagree, so the windowed assertion above is really testing the window');

ok(windowed.caveats.some((c) => c.key === 'window' && /publish/.test(c.text)),
  'and the result says out loud what period it covers, and whose limit set it');

/* ================================================================== *
 * 2. THE REP GATE — D5, once, not twice
 * ================================================================== */

const gate = compareExercise({
  mine: [
    mySession('2026-07-01', [{ weight: 135, reps: 20 }, { weight: 205, reps: 5 }]),
    rest('2026-08-01'),
  ],
  theirs: [rest('2026-06-01'), theirSession('2026-07-02', [{ weight: 200, reps: 5 }])],
  exerciseId: BENCH.id,
  exercise: BENCH,
});

ok(near(metricOf(gate, 'e1rm').mine, e1rm(205, 5)),
  'a 20-rep set is not evidence of a maximum — 135 x 20 would have extrapolated past a real top set');
ok(metricOf(gate, 'top-weight').mine === 205,
  'and the heaviest-set row reads the same pool, so the two rows describe the same sets');
ok(metricOf(gate, 'sets').mine === 2,
  'the 20-rep set still HAPPENED — it counts as a set, it just proves nothing about a max');
ok(gate.caveats.some((c) => c.key === 'rep-gate' && c.text.includes('15')),
  'and the set that was left out is admitted to, rather than quietly dropped');

/* ================================================================== *
 * 3. PER SIDE — 50 lbs in each hand is 100 lbs
 * ================================================================== */

const dbEntry = (date, sets, key) => ({
  date, entries: [{ exerciseId: DB_BENCH.id, [key]: DB_BENCH.name, sets }],
});
const perSide = compareExercise({
  mine: [dbEntry('2026-07-01', [{ weight: 50, reps: 10 }], 'exerciseName'), rest('2026-08-01')],
  theirs: [rest('2026-06-01'), dbEntry('2026-07-02', [{ weight: 45, reps: 10 }], 'name')],
  exerciseId: DB_BENCH.id,
  exercise: DB_BENCH,
});
ok(metricOf(perSide, 'top-weight').mine === 100 && metricOf(perSide, 'top-weight').theirs === 90,
  'a dumbbell set is doubled to the load the body actually carried — both sides identically');
ok(metricOf(perSide, 'top-weight').mineSet.weight === 50,
  'and the set behind it keeps the number that was typed, so the screen can print both');
ok(perSide.caveats.some((c) => c.key === 'per-side'),
  'per-side doubling is stated, not left for somebody to notice');

/* ================================================================== *
 * 4. BODY WEIGHT — a refusal, not a zero
 * ================================================================== */

const pullSession = (date, sets, key) => ({
  date, entries: [{ exerciseId: PULLUP.id, [key]: PULLUP.name, sets }],
});
const bw = compareExercise({
  mine: [pullSession('2026-07-01', [{ reps: 12 }, { reps: 10 }], 'exerciseName'), rest('2026-08-01')],
  theirs: [rest('2026-06-01'), pullSession('2026-07-02', [{ reps: 8 }], 'name')],
  exerciseId: PULLUP.id,
  exercise: PULLUP,
});

ok(bw.common === true, 'two people who both do pull-ups have something in common');
ok(!metricOf(bw, 'e1rm') && !metricOf(bw, 'top-weight'),
  'no load row for a pull-up: their body weight is theirs to publish, and most people do not');
ok(bw.metrics.every((m) => m.mine !== 0 && m.theirs !== 0),
  'and the refusal is a missing row, never a zero — a zero reads as somebody who lifts nothing');
ok(bw.caveats.some((c) => c.key === 'no-load' && /body weight/i.test(c.text)),
  'the refusal says why, in words a person can act on');
ok(metricOf(bw, 'top-reps') && metricOf(bw, 'top-reps').mine === 12,
  'reps are still comparable — a pull-up rep is a pull-up rep');
ok(metricOf(bw, 'top-reps').estimate === false,
  'and that row is a measurement, so nothing labels it an estimate');

// The rep gate is about inferring a maximum. Twenty press-ups is a recorded
// number, and this row infers nothing from it.
const bwLong = compareExercise({
  mine: [pullSession('2026-07-01', [{ reps: 22 }], 'exerciseName'), rest('2026-08-01')],
  theirs: [rest('2026-06-01'), pullSession('2026-07-02', [{ reps: 8 }], 'name')],
  exerciseId: PULLUP.id,
  exercise: PULLUP,
});
ok(metricOf(bwLong, 'top-reps').mine === 22,
  'a 22-rep set of pull-ups is still 22 pull-ups — the D5 gate caps inference, not counting');

/* ================================================================== *
 * 5. RULE 5 — an estimate is flagged as one
 * ================================================================== */

const est = metricOf(windowed, 'e1rm');
ok(est.estimate === true, 'the 1RM row is marked as an estimate, because nobody lifted it');
ok(metricOf(windowed, 'top-weight').estimate === false,
  'the heaviest set is not — it is a number somebody actually put on a bar');
ok(windowed.caveats.some((c) => c.key === 'estimate'),
  'and the caption has the sentence to go with the flag');

/* ================================================================== *
 * 6. RULE 6 — no winner, anywhere in the output
 * ================================================================== */

ok(/no overall result/i.test(windowed.header),
  'the result carries a header saying there is no overall answer here');
ok(windowed.metrics.every((m) => m.better === null || ['mine', 'theirs', 'tie'].includes(m.better)),
  'every per-row claim is one of mine / theirs / tie, and bounded to its row');

// Nothing outside a metric row may name a side. This walks the whole object.
const sideNaming = [];
(function walk(node, path) {
  if (node === null || typeof node !== 'object') {
    if ((node === 'mine' || node === 'theirs') && !/^metrics\[\d+\]\.better$/.test(path)) {
      sideNaming.push(path);
    }
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    walk(v, Array.isArray(node) ? `${path}[${k}]` : (path ? `${path}.${k}` : k));
  }
})(windowed, '');
ok(sideNaming.length === 0,
  `only a metric row ever names a side — nothing sums them up (${sideNaming.join(', ') || 'none'})`);

const keyNames = JSON.stringify(windowed).match(/"[a-zA-Z]+":/g) || [];
ok(!keyNames.some((k) => /winner|verdict|score|rank|badge|stronger|champion/i.test(k)),
  'and no field is called a winner, a score or a rank');

ok(metricOf(windowed, 'sets').judged === false && metricOf(windowed, 'sets').better === null,
  'sets logged is NOT judged — more sets is more time available, not better training (Rule 6)');
ok(metricOf(windowed, 'e1rm').judged === true,
  'strength is judged, because bigger genuinely is stronger there');

/* ================================================================== *
 * 7. NO COMMON GROUND IS AN ANSWER
 * ================================================================== */

const oneSided = compareExercise({
  mine: MY_OLD_PR,
  theirs: [rest('2026-06-01'), rest('2026-07-02'), rest('2026-08-12')],
  exerciseId: BENCH.id,
  exercise: BENCH,
});
ok(oneSided.common === false && oneSided.metrics.length === 0,
  'if they have never done it there are no rows — not rows of zero');
ok(oneSided.reason === 'they-have-not-logged-it' && /not recorded/i.test(oneSided.message),
  'and it comes back with a reason and a sentence the screen can print');
ok(oneSided.counts.theirs.sets === 0 && oneSided.counts.mine.sets > 0,
  'the counts still say who has what, which is the thing worth knowing');

const mineOutside = compareExercise({
  mine: [mySession('2025-01-10', [{ weight: 315, reps: 1 }]), rest('2026-08-15')],
  theirs: THEIR_RECENT,
  exerciseId: BENCH.id,
  exercise: BENCH,
});
ok(mineOutside.reason === 'yours-is-outside-the-window',
  '"you did it, but before the period we can compare over" is its own answer');

const noOverlap = compareExercise({
  mine: [mySession('2019-01-10', [{ weight: 315, reps: 1 }])],
  theirs: THEIR_RECENT,
  exerciseId: BENCH.id,
  exercise: BENCH,
});
ok(noOverlap.common === false && noOverlap.reason === 'windows-do-not-overlap',
  'two histories that never overlap have no period to compare over, and say so');

const lightTier = compareExercise({
  mine: MY_OLD_PR,
  theirs: [{ date: '2026-06-01', name: 'Workout' }, { date: '2026-08-12', name: 'Workout' }],
  exerciseId: BENCH.id,
  exercise: BENCH,
});
ok(lightTier.reason === 'they-do-not-publish-the-detail',
  'a light-tier friend publishes days, not sets — a different answer from "they never did it"');

const empty = compareExercise({ mine: [], theirs: THEIR_RECENT, exerciseId: BENCH.id, exercise: BENCH });
ok(empty.common === false && empty.metrics.length === 0 && empty.window === null,
  'nothing recorded on my side is not a comparison I lose, it is no comparison');

/* ================================================================== *
 * 8. SHAPE — what the caller can rely on
 * ================================================================== */

ok(windowed.header === NO_VERDICT_HEADER, 'the header is exported so a test can pin it');
ok(typeof windowed.window.label === 'string' && windowed.window.days === 73,
  `the window is handed over ready to print (${windowed.window.label}, ${windowed.window.days} days)`);
ok(oneSided.header === windowed.header && Object.keys(oneSided).length === Object.keys(windowed).length,
  'one shape whether or not there is anything to compare, so the view has one branch');
ok(compareExercise().common === false,
  'called with nothing at all it refuses rather than throws');
ok(compareExercise({ mine: MY_OLD_PR, theirs: { activity: THEIR_RECENT }, exerciseId: BENCH.id, exercise: BENCH })
  .metrics.length === windowed.metrics.length,
  'the whole projection document works as well as its activity array — the likeliest wiring slip');

const noLibrary = compareExercise({
  mine: MY_OLD_PR, theirs: THEIR_RECENT, exerciseId: BENCH.id, exercise: null,
});
ok(!metricOf(noLibrary, 'e1rm') && !metricOf(noLibrary, 'top-weight')
  && noLibrary.caveats.some((c) => c.key === 'unknown-exercise'),
  'an exercise missing from my library gets counts only — per side and body weight cannot be guessed');

/* ---------- matching by name where a friend's row predates ids ---------- */
const noIds = compareExercise({
  mine: MY_OLD_PR,
  theirs: [
    rest('2026-06-01'),
    { date: '2026-07-02', entries: [{ exerciseId: null, name: BENCH.name, sets: [{ weight: 225, reps: 5 }] }] },
    rest('2026-08-12'),
  ],
  exerciseId: BENCH.id,
  exercise: BENCH,
});
ok(metricOf(noIds, 'e1rm').theirs !== null,
  'their old rows carry no exercise id, and matching those by name beats telling me they never did it');

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
