// The demo account — a year of invented training you can poke at.
//
// Tim, 2026-08-19: *"it's hard for me to really test out the website because I
// don't personally have very much information or actual data recorded and it's
// a lot of effort to do so."* So: a button in Account that fills the app with a
// realistic year, lets you change anything, and throws it all away.
//
// ── THE SAFETY MODEL, WHICH IS THE WHOLE POINT ───────────────────────────────
//
// ⚠️ Demo data NEVER touches storage. Not localStorage, not Firestore. While
// the demo is on, `store.js` swaps its backend for an in-memory Map and every
// read and write goes there. That is a stronger guarantee than "we write it to
// a separate namespace and clean up afterwards", because there is no cleanup
// step that can fail and nothing left behind if the tab is closed mid-session.
//
// Three consequences, all deliberate:
//
//   1. **A reload starts the demo over.** The flag lives in sessionStorage so
//      the tab remembers it is in the demo, but the DATA is regenerated from
//      scratch on every boot. Tim asked for exactly this ("any time they login
//      onto the demo account it resets back to the default"); the banner says
//      so, so nobody loses work they thought was saved.
//   2. **A new tab is your real account.** sessionStorage is per-tab. The demo
//      cannot follow you around.
//   3. **Your real data is untouched and still there when you leave.** Exiting
//      is a reload with the flag cleared. Nothing was ever overwritten.
//
// ⚠️ SOCIAL IS HARD-DISABLED IN THE DEMO, and this is not tidiness. `republish()`
// in store.js builds a friend-visible projection out of `store.getSessions()` —
// which in the demo is invented data — and writes it to the REAL Firestore for
// real friends to read. Anything that publishes must refuse while the demo is
// on, and store.js guards it at the write itself rather than relying on the
// screen to stay out of the way.
//
// ── WHY THE DATA IS GENERATED AND NOT A FIXTURE FILE ─────────────────────────
//
// The dates have to be relative to today or the calendar opens on an empty
// month and "recent activity" is a year stale. So it is generated — from a
// SEEDED pseudo-random source, never Math.random(), so that "resets back to
// the default" is literally true: the same day always produces the same year.
//
// Pure: no DOM, no store, no clock — `today` is passed in. Same shape as
// e1rm.js and goals.js, and testable the same way. The SWITCH that turns the
// demo on lives in store.js, because which backend you are talking to is a
// store concern and splitting it across two files is how the two would drift.

import { BUILT_IN_EXERCISES } from './exercises.js';
import { e1rm, isRankableSet } from './e1rm.js';
import { contributionsFor, totalLoad, rateMuscle } from './muscle-evidence.js';
import {
  LEVELS, percentileFor, levelFor, nextLevelAfter, weightForPercentile,
} from './strength-standards.js';
import { buildGoal, addDays, parseDay } from './goals.js';

/* ------------------------------------------------------------------ *
 * Determinism
 * ------------------------------------------------------------------ */

// mulberry32 — small, fast, and good enough for jitter. The constant seed is
// what makes the demo reproducible; ⚠️ do not replace this with Math.random(),
// or "reset to the default" stops meaning anything and two people comparing
// notes about the demo will be looking at different data.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

/* ------------------------------------------------------------------ *
 * The person
 * ------------------------------------------------------------------ */

export const DEMO_WEEKS = 52;
const DEMO_SEED = 20260819;

/** Weeks from the start at which each thing happens. Week 0 is a year ago. */
const SWITCH_WEEK = 26;      // Upper/Lower -> Push Pull Legs
const DELOAD_WEEKS = [17, 35];
const HOLIDAY_WEEKS = [21, 22];
const ILLNESS_WEEK = 40;
const BENCHMARK_WEEKS = [6, 14, 22, 30, 38, 46];
const GOAL_WEEKS_AGO = 5;

const START_BODY_WEIGHT = 172;
const END_BODY_WEIGHT = 184;
const AGE = 30;

/* ------------------------------------------------------------------ *
 * The lifts
 *
 * One entry per exercise, NOT per workout, because the progression state is
 * shared: the bench press carries straight across the programme switch at week
 * 26, which is both what really happens and what makes the graphs continuous
 * instead of restarting halfway through the year.
 *
 * `start` is the working weight on day one, in POUNDS and in whatever the
 * exercise's own load type means — so a dumbbell press starting at 45 is 45 per
 * side, exactly as the app would store it.
 *
 * ⚠️ `stall` is the chance a session does NOT move the lift on, and it is the
 * most important number in this table. Without it — one shared stall rate — the
 * isolation work outgrows the compounds, because a curl with a five-rep range
 * and a 5 lb step climbs the same number of times as a bench press with a
 * four-rep range and the same step, and 55 -> 105 is a far bigger *proportional*
 * jump than 135 -> 185. The first version of this file produced a demo lifter
 * with an Expert barbell curl and a Novice bench, which is not a person, and
 * every rating the app derived from it would have inherited the nonsense.
 *
 * So: compounds stall rarely, machine and dumbbell work more, isolation most.
 * That is also the right way round in reality — small muscles have less room.
 * ------------------------------------------------------------------ */

// ⚠️ THE STALL RATES ARE CALIBRATED, NOT CHOSEN. Each one is derived from how
// many times that lift actually comes up in this year and where a real lifter
// would finish — solve for the stall rate that lands there, rather than picking
// a number that felt about right. Two rounds of getting it wrong by eye are why:
// the first put an Expert barbell curl next to a Novice bench, and the second
// finished the year on a 295x8 squat, which is not a first year of training.
//
// The end weights below are a coherent lifter: benches 190 for 6, squats 245,
// pulls 305, presses 115 overhead, curls 80, and inclines 65s. Everything the
// app then derives — the muscle map, the goal, the ratings — is only as sane as
// that set of numbers is, so they are stated in the comments and can be argued
// with.
const LIFTS = {
  'Barbell Bench Press':          { reps: [5, 8],   start: 135, inc: 5,  stall: 0.30 }, // -> 190
  'Barbell Row':                  { reps: [6, 10],  start: 115, inc: 5,  stall: 0.10 }, // -> ~145, dropped at the switch
  'Overhead Press':               { reps: [5, 8],   start: 75,  inc: 5,  stall: 0.49 }, // -> 115
  'Lat Pulldown':                 { reps: [8, 12],  start: 100, inc: 10, stall: 0.60 }, // -> 150
  'Barbell Curl':                 { reps: [8, 12],  start: 55,  inc: 5,  stall: 0.60 }, // -> 80
  'Triceps Pushdown':             { reps: [10, 14], start: 40,  inc: 5,  stall: 0.60 }, // -> 65
  'Back Squat':                   { reps: [5, 8],   start: 165, inc: 10, stall: 0.48 }, // -> 245
  'Romanian Deadlift':            { reps: [6, 10],  start: 135, inc: 10, stall: 0.44 }, // -> 205
  'Leg Press':                    { reps: [10, 14], start: 230, inc: 20, stall: 0.35 }, // -> 390
  'Lying Leg Curl':               { reps: [10, 14], start: 70,  inc: 10, stall: 0.72 }, // -> 105
  'Standing Calf Raise':          { reps: [10, 15], start: 120, inc: 10, stall: 0.42 }, // -> 180
  'Incline Dumbbell Bench Press': { reps: [8, 12],  start: 45,  inc: 5,  stall: 0.68 }, // -> 65/side
  'Seated Cable Row':             { reps: [8, 12],  start: 110, inc: 10, stall: 0.60 }, // -> 160
  'Dumbbell Shoulder Press':      { reps: [8, 12],  start: 35,  inc: 5,  stall: 0.32 }, // -> 50/side, dropped at the switch
  'Lateral Raise':                { reps: [12, 16], start: 15,  inc: 5,  stall: 0.88 }, // -> 20/side
  'Hammer Curl':                  { reps: [8, 12],  start: 25,  inc: 5,  stall: 0.84 }, // -> 35/side
  'Overhead Cable Extension':     { reps: [10, 14], start: 45,  inc: 5,  stall: 0.60 }, // -> 70
  'Deadlift':                     { reps: [4, 6],   start: 205, inc: 10, stall: 0.52 }, // -> 305
  'Bulgarian Split Squat':        { reps: [8, 12],  start: 30,  inc: 5,  stall: 0.20 }, // -> ~45/side, dropped at the switch
  'Leg Extension':                { reps: [12, 16], start: 90,  inc: 10, stall: 0.20 }, // -> ~125, dropped at the switch
  'Seated Leg Curl':              { reps: [10, 14], start: 80,  inc: 10, stall: 0.32 }, // -> 110, dropped at the switch
  'Seated Calf Raise':            { reps: [12, 16], start: 90,  inc: 10, stall: 0.20 }, // -> ~125, dropped at the switch
  'Face Pull':                    { reps: [12, 16], start: 40,  inc: 5,  stall: 0.63 }, // -> 55
};
/* ------------------------------------------------------------------ *
 * The two programmes
 *
 * Two rather than one because a year of training is not one programme, and
 * because it is the only way the demo shows what the Workouts tab looks like
 * with more than one system in it. The old one is KEPT rather than deleted —
 * D22 says history survives, and deleting it would leave six months of sessions
 * pointing at workouts that no longer exist.
 * ------------------------------------------------------------------ */

const PROGRAMMES = [
  {
    id: 'demo-sys-ul',
    name: 'Upper / Lower',
    notes: 'Four days a week, alternating upper and lower. What I ran for the first half of the '
      + 'year before switching to a push/pull/legs split.',
    daysPerWeek: 4,
    minutes: 65,
    // Mon, Tue, Thu, Fri.
    trainDays: [1, 2, 4, 5],
    workouts: [
      { id: 'demo-w-ua', name: 'Upper A', exercises: [
        { name: 'Barbell Bench Press', sets: 4 },
        { name: 'Barbell Row', sets: 4 },
        { name: 'Overhead Press', sets: 3 },
        { name: 'Lat Pulldown', sets: 3 },
        { name: 'Barbell Curl', sets: 3 },
        { name: 'Triceps Pushdown', sets: 3 },
      ] },
      { id: 'demo-w-la', name: 'Lower A', exercises: [
        { name: 'Back Squat', sets: 4 },
        { name: 'Romanian Deadlift', sets: 3 },
        { name: 'Leg Press', sets: 3 },
        { name: 'Lying Leg Curl', sets: 3 },
        { name: 'Standing Calf Raise', sets: 4 },
      ] },
      { id: 'demo-w-ub', name: 'Upper B', exercises: [
        { name: 'Incline Dumbbell Bench Press', sets: 4 },
        { name: 'Seated Cable Row', sets: 4 },
        { name: 'Dumbbell Shoulder Press', sets: 3 },
        { name: 'Lateral Raise', sets: 4 },
        { name: 'Hammer Curl', sets: 3 },
        { name: 'Overhead Cable Extension', sets: 3 },
      ] },
      { id: 'demo-w-lb', name: 'Lower B', exercises: [
        { name: 'Deadlift', sets: 3 },
        { name: 'Bulgarian Split Squat', sets: 3 },
        { name: 'Leg Extension', sets: 3 },
        { name: 'Seated Leg Curl', sets: 3 },
        { name: 'Seated Calf Raise', sets: 4 },
      ] },
    ],
  },
  {
    id: 'demo-sys-ppl',
    name: 'Push Pull Legs',
    notes: 'Five days a week. Switched to this in the second half of the year for more volume per '
      + 'muscle without any session running long.',
    daysPerWeek: 5,
    minutes: 70,
    // Mon, Tue, Wed, Fri, Sat.
    trainDays: [1, 2, 3, 5, 6],
    workouts: [
      // The superset and the drop set are here on purpose: they are the only
      // way the demo shows what the runner, the day view and the edit form do
      // with set types, and a demo of a feature nobody can see is no demo.
      { id: 'demo-w-push', name: 'Push', exercises: [
        { name: 'Barbell Bench Press', sets: 4 },
        { name: 'Incline Dumbbell Bench Press', sets: 3 },
        { name: 'Overhead Press', sets: 3 },
        { name: 'Lateral Raise', sets: 4 },
        { name: 'Triceps Pushdown', sets: 3, group: 0,
          notes: 'Straight into the overhead extension — no rest between them.' },
        { name: 'Overhead Cable Extension', sets: 3, group: 0 },
      ] },
      { id: 'demo-w-pull', name: 'Pull', exercises: [
        { name: 'Deadlift', sets: 3 },
        { name: 'Lat Pulldown', sets: 4 },
        { name: 'Seated Cable Row', sets: 3 },
        { name: 'Face Pull', sets: 3 },
        { name: 'Barbell Curl', sets: 3, setType: 'drop', minis: 2,
          notes: 'Two drops after every set, stripping about 30 % each time.' },
        { name: 'Hammer Curl', sets: 3 },
      ] },
      { id: 'demo-w-legs', name: 'Legs', exercises: [
        { name: 'Back Squat', sets: 4 },
        { name: 'Romanian Deadlift', sets: 3 },
        { name: 'Leg Press', sets: 3 },
        { name: 'Lying Leg Curl', sets: 3 },
        { name: 'Standing Calf Raise', sets: 4 },
      ] },
    ],
  },
];

/** The lifts a benchmark day tests. The big four, as most people would. */
const BENCHMARK_LIFTS = ['Barbell Bench Press', 'Back Squat', 'Deadlift', 'Overhead Press'];

/* ------------------------------------------------------------------ *
 * Building the year
 * ------------------------------------------------------------------ */

function exerciseIndex() {
  const byName = new Map();
  for (const e of BUILT_IN_EXERCISES) byName.set(e.name, e);
  return byName;
}

/** Every lift and programme name resolves to a real exercise. Asserted in tests. */
export function unresolvedDemoExercises() {
  const byName = exerciseIndex();
  const missing = new Set();
  for (const name of Object.keys(LIFTS)) if (!byName.has(name)) missing.add(name);
  for (const p of PROGRAMMES) {
    for (const w of p.workouts) {
      for (const item of w.exercises) if (!byName.has(item.name)) missing.add(item.name);
    }
  }
  return [...missing];
}

/**
 * A year of training, ending today.
 *
 * @param {object} opts
 * @param {string} opts.today  YYYY-MM-DD — passed in, never read from a clock
 * @param {string} opts.units  carried over from the real account, so entering
 *                             the demo does not silently switch somebody from
 *                             kg to lbs
 * @param {string} opts.theme  same reasoning — a demo that flips you to dark
 *                             mode reads as a bug
 */
export function buildDemoData({ today, units = 'lbs', theme = 'dark' } = {}) {
  const byName = exerciseIndex();
  const random = rng(DEMO_SEED);

  const start = addDays(today, -(DEMO_WEEKS * 7));
  const weekOf = (iso) => Math.floor(daysApart(start, iso) / 7);

  /* ---- systems and workouts ---- */

  const systems = PROGRAMMES.map((p, i) => ({
    id: p.id,
    name: p.name,
    notes: p.notes,
    daysPerWeek: p.daysPerWeek,
    minutes: p.minutes,
    createdAt: `${addDays(start, i * SWITCH_WEEK * 7)}T09:00:00.000Z`,
    updatedAt: `${addDays(start, i * SWITCH_WEEK * 7)}T09:00:00.000Z`,
  }));

  const workouts = [];
  for (const p of PROGRAMMES) {
    p.workouts.forEach((w, order) => {
      workouts.push({
        id: w.id,
        name: w.name,
        systemId: p.id,
        // `order` is what keeps a rotation a rotation — without it getWorkouts()
        // sorts alphabetically and Push Pull Legs comes back Legs, Pull, Push,
        // which would make Home's "what's next" read the sequence backwards.
        order,
        isBenchmark: false,
        exercises: w.exercises.map((item) => {
          const ex = byName.get(item.name);
          return ex ? {
            exerciseId: ex.id,
            sets: item.sets,
            notes: item.notes || '',
            ...(item.group == null ? {} : { group: item.group }),
            ...(item.setType ? { setType: item.setType, minis: item.minis || 1 } : {}),
          } : null;
        }).filter(Boolean),
        createdAt: `${start}T09:00:00.000Z`,
        updatedAt: `${start}T09:00:00.000Z`,
      });
    });
  }

  /* ---- the progression state machine ----
   *
   * Double progression, which is the rule the app itself recommends
   * (docs/research.md §12): hold the weight and add reps up the range, then
   * take the smallest increment and drop back to the bottom. Stalls and two
   * deloads are what stop a year of it arriving somewhere absurd — without
   * them a 5 lb step every five sessions puts a 135 lb bench at 300.
   */
  const state = new Map();
  for (const [name, spec] of Object.entries(LIFTS)) {
    state.set(name, { weight: spec.start, reps: spec.reps[0] });
  }

  const advance = (name) => {
    const spec = LIFTS[name];
    const s = state.get(name);
    // Plenty of sessions do not move at all. Real training is not monotone, and
    // a graph that only ever goes up is the tell that data is fabricated.
    if (random() < spec.stall) return;
    if (s.reps < spec.reps[1]) s.reps += 1;
    else { s.weight += spec.inc; s.reps = spec.reps[0]; }
  };

  /* ---- walk the year, day by day ---- */

  const sessions = [];
  const benchmarks = [];
  const rotation = new Map(PROGRAMMES.map((p) => [p.id, 0]));
  const benchmarksDone = new Set();

  const totalDays = DEMO_WEEKS * 7;
  for (let d = 0; d <= totalDays; d++) {
    const date = addDays(start, d);
    const week = Math.floor(d / 7);
    const dow = parseDay(date).getDay();

    // Two weeks away and a week ill. Gaps are not decoration — they are what
    // makes the calendar look like somebody's year rather than a grid, and they
    // are what the "why progress stalls" screen has something to measure.
    if (HOLIDAY_WEEKS.includes(week) || week === ILLNESS_WEEK) continue;

    const programme = PROGRAMMES[week < SWITCH_WEEK ? 0 : 1];
    if (!programme.trainDays.includes(dow)) continue;
    if (random() < 0.08) continue; // an ordinary missed day

    const at = rotation.get(programme.id);
    const spec = programme.workouts[at % programme.workouts.length];
    rotation.set(programme.id, at + 1);
    const workout = workouts.find((w) => w.id === spec.id);

    // ⚠️ A DELOAD WEEK LOGS LIGHTER; IT DOES NOT SET THE PROGRESSION BACK.
    // The first version modelled a deload as a permanent 10 % cut to the state
    // machine, which is not what a deload is — you back off for a week and pick
    // up roughly where you left off. It also quietly ate about half the year's
    // progress, which is how a twelve-month demo ended with a 165 lb bench.
    // Logging the week light gives the charts the dip that makes them look like
    // a real training year, and costs nothing.
    const light = DELOAD_WEEKS.includes(week);

    const entries = [];
    for (const item of spec.exercises) {
      const ex = byName.get(item.name);
      if (!ex) continue;
      const s = state.get(item.name);
      const weight = light ? round5(s.weight * 0.85) : s.weight;
      const setsOut = [];
      for (let i = 0; i < item.sets; i++) {
        // Later sets give up a rep or two. Fatigue is real and a session where
        // every set is identical is the other tell of invented data.
        const reps = Math.max(LIFTS[item.name].reps[0] - 2, s.reps - (i > 0 ? i - (random() < 0.4 ? 1 : 0) : 0));
        const set = { weight, reps };
        if (item.setType === 'drop') {
          // ⚠️ Drops live INSIDE the set, never as extra rows (D23). That is
          // what keeps "a drop set is one hard set" true by construction, and
          // the demo has to store them the way the app does or every volume
          // number it displays would be wrong.
          set.minis = [
            { weight: round5(weight * 0.7), reps: Math.max(5, reps - 3) },
            { weight: round5(weight * 0.5), reps: Math.max(4, reps - 5) },
          ];
        }
        setsOut.push(set);
      }
      entries.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        ...(item.group == null ? {} : { group: item.group }),
        ...(item.setType ? { setType: item.setType } : {}),
        sets: setsOut,
      });
      if (!light) advance(item.name);
    }

    const startedAt = `${date}T17:${String(10 + Math.floor(random() * 40)).padStart(2, '0')}:00.000Z`;
    sessions.push({
      id: `demo-s-${d}`,
      workoutId: workout.id,
      workoutName: workout.name,
      date,
      startedOn: date,
      startedAt,
      finishedAt: startedAt,
      isBenchmark: false,
      entries,
      createdAt: startedAt,
    });

    /* ---- a benchmark day, every eight weeks ---- */
    if (BENCHMARK_WEEKS.includes(week) && !benchmarksDone.has(week) && !light) {
      benchmarksDone.add(week);
      for (const name of BENCHMARK_LIFTS) {
        const ex = byName.get(name);
        if (!ex) continue;
        const s = state.get(name);
        benchmarks.push({
          id: `demo-b-${week}-${ex.id}`,
          date,
          exerciseId: ex.id,
          exerciseName: ex.name,
          // ⚠️ A benchmark is a deliberate test taken fresh, so it has to come
          // out ABOVE the working set it is measured against — that is D14's
          // whole reason for never charting the two as one line. At 1.12x it
          // did not: a 3-rep test at 175 estimates lower than a 5-rep working
          // set at 165, which would have made the demo's benchmarks look like
          // the lifter got weaker every time they tested.
          values: { weight: round5(s.weight * 1.22), reps: 3 },
          createdAt: `${date}T18:00:00.000Z`,
        });
      }
    }
  }

  /* ---- body weight, weekly ---- */

  const bodyWeight = [];
  for (let w = 0; w <= DEMO_WEEKS; w++) {
    const date = addDays(start, w * 7);
    if (daysApart(date, today) < 0) break;
    const trend = START_BODY_WEIGHT + (END_BODY_WEIGHT - START_BODY_WEIGHT) * (w / DEMO_WEEKS);
    const weight = Math.round((trend + (random() - 0.5) * 2.4) * 10) / 10;
    bodyWeight.push({ id: `demo-bw-${w}`, date, weight, createdAt: `${date}T07:30:00.000Z` });
  }
  const latest = bodyWeight[bodyWeight.length - 1];

  /* ---- settings ---- */

  const birthYear = Number(String(today).slice(0, 4)) - AGE;
  const settings = {
    id: 'settings',
    // ⚠️ Carried over from the real account rather than fixed. A demo that
    // flips somebody from kg to lbs, or from light mode to dark, reads as the
    // app breaking rather than as a demo starting.
    units,
    theme,
    gender: 'male',
    birthYear,
  };

  /* ---- an active goal, five weeks in ---- */

  const goals = [];
  const goalStart = addDays(today, -(GOAL_WEEKS_AGO * 7));
  const profile = { gender: 'male', bodyWeight: latest ? latest.weight : END_BODY_WEIGHT, age: AGE, compare: null };
  const goal = buildChestGoal({ sessions, benchmarks, byName, exMap: new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e])), goalStart, profile });
  if (goal) goals.push(goal);

  return {
    settings: [settings],
    systems,
    workouts,
    sessions,
    benchmarks,
    bodyWeight,
    goals,
    customExercises: [],
  };
}

/**
 * The goal the demo account is already running.
 *
 * ⚠️ BUILT WITH THE APP'S OWN PIPELINE, not with a shortcut, and the first
 * version got this wrong in a way worth recording. It took the best BENCH PRESS
 * e1RM as the starting estimate — but the app does not rate a muscle from one
 * lift. It rates Chest from every exercise that trains it, converted by a ratio
 * (js/muscle-evidence.js), and for this lifter the incline dumbbell press
 * converts to a HIGHER bench-equivalent than the bench itself does. So the goal
 * started at 227 while the muscle map said 288, and the demo opened on a goal
 * that read "Target reached" before anybody had touched it.
 *
 * Running the real ranking — contributions, ratios, confidence weighting,
 * recency, all of it — as of the day the goal was set is the only way the two
 * screens can agree. A demo whose goal disagreed with its own muscle map would
 * be the first thing anybody noticed and the last thing they trusted.
 */
function buildChestGoal({ sessions, benchmarks, byName, exMap, goalStart, profile }) {
  const bench = byName.get('Barbell Bench Press');
  if (!bench) return null;

  // The same observation-building loop store.muscleStrength() runs, restricted
  // to what had been recorded by the day the goal was set.
  const asOf = parseDay(goalStart);
  const obs = [];
  const record = (exerciseId, weight, reps, date, isBenchmark) => {
    if (date > goalStart) return;
    if (!isRankableSet(reps)) return;               // D5: 15 reps is the limit
    const ex = exMap.get(exerciseId);
    if (!ex) return;
    const load = totalLoad(weight, ex.loadType);    // per-side lifts are doubled
    if (load === null) return;
    const raw = e1rm(load, reps);
    if (raw === null) return;
    for (const c of contributionsFor(ex)) {
      if (c.muscle !== 'Chest') continue;
      obs.push({
        estimate: raw / c.ratio,
        rawE1rm: raw,
        quality: c.quality,
        kind: c.kind,
        ratio: c.ratio,
        reps,
        weight,
        loadType: ex.loadType,
        date,
        ageDays: Math.max(0, Math.round((asOf - parseDay(date)) / 86400000)),
        isBenchmark: Boolean(isBenchmark),
        exerciseId,
        exerciseName: ex.name,
        source: isBenchmark ? 'benchmark' : 'workout',
      });
    }
  };

  for (const b of benchmarks) record(b.exerciseId, b.values.weight, b.values.reps, b.date, true);
  for (const s of sessions) {
    for (const entry of s.entries || []) {
      for (const set of entry.sets || []) record(entry.exerciseId, set.weight, set.reps, s.date, false);
    }
  }

  const rating = rateMuscle(obs);
  if (!rating || !(rating.estimate > 0)) return null;
  const best = rating.estimate;

  const pct = percentileFor(best, 'Chest', profile);
  if (pct === null) return null;

  // ⚠️ The NEXT level is not always a goal worth showing. The demo lifter can
  // easily be sitting a pound under a threshold, and an earlier version produced
  // a goal of "+1 %" — technically correct, and a screen nobody would learn
  // anything from. So: walk up until the target is a real step. Everything else
  // still comes from the app's own functions; only which level is picked is
  // chosen for the demo's sake.
  const MEANINGFUL = 0.08;
  let level = nextLevelAfter(levelFor(pct)) || LEVELS[0];
  let target = level && weightForPercentile(level.percentile, 'Chest', profile);
  while (target && target < best * (1 + MEANINGFUL)) {
    const up = nextLevelAfter(level);
    if (!up) break;
    level = up;
    target = weightForPercentile(level.percentile, 'Chest', profile);
  }
  if (!level || !(target > best)) return null;

  return {
    ...buildGoal({
      id: 'demo-goal-chest',
      muscle: 'Chest',
      level,
      targetWeight: target,
      startWeight: best,
      startPercentile: pct,
      startLevelKey: levelFor(pct) ? levelFor(pct).key : null,
      startDate: goalStart,
      liftName: bench.name,
      comparison: 'men who lift — 183 lbs · around 30',
    }),
    createdAt: `${goalStart}T09:00:00.000Z`,
  };
}

// Days between two YYYY-MM-DD dates, LOCAL. Kept here rather than reaching for
// Date(iso), which reads a bare date as UTC and lands a day early west of
// Greenwich — the same trap next-workout.js and goals.js document.
function daysApart(fromISO, toISO) {
  const a = parseDay(fromISO), b = parseDay(toISO);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

/* ------------------------------------------------------------------ *
 * The demo's FRIENDS — invented people, for the Home feed
 *
 * ⚠️ ADDED 2026-08-25 WITH THE FEED, AND THE REASON IS THE DEMO'S OWN PURPOSE.
 * It exists so every screen can be judged without logging anything. Home became
 * a feed of other people's workouts on the same day, and `social.state()`
 * refuses in the demo — correctly — so Home would have shown an empty state in
 * the one account built for looking at screens, forever, including to the
 * accessibility audit, which drives the demo.
 *
 * ⚠️ THIS DOES NOT WEAKEN THE SAFETY MODEL. The hazard the demo guards against
 * is PUBLISHING invented training to real friends, and `republish()` still
 * refuses. Nothing here is written anywhere, read from anywhere, or sent to
 * anybody — it is a list of objects shaped exactly like what `projectSession()`
 * returns, so the feed renders the real shape rather than a lookalike.
 *
 * ⚠️ DETERMINISTIC, like everything else in this file. Same day in, same feed
 * out — see the note on `rng()`. Never Math.random().
 *
 * ⚠️ ONE OF THEM SHARES AT THE LOWEST TIER, on purpose. "Just that I trained"
 * publishes no exercise list at all, and a card for that person is the one case
 * most likely to be built wrong and never noticed — it has to read as complete
 * rather than as a card that failed to load.
 * ------------------------------------------------------------------ */

const DEMO_FRIENDS = [
  { uid: 'demo-friend-1', name: 'Marcus Webb', tier: 'mid', location: 'Ironworks Gym' },
  { uid: 'demo-friend-2', name: 'Priya Raman', tier: 'mid', location: 'Home garage' },
  // No entries are published for this one, whatever the generator picks.
  { uid: 'demo-friend-3', name: 'Sam Okafor', tier: 'light' },
];

const DEMO_FEED_WORKOUTS = [
  ['Push', ['Barbell Bench Press', 'Overhead Press', 'Incline Dumbbell Bench Press', 'Triceps Pushdown']],
  ['Pull', ['Deadlift', 'Pull-Up', 'Barbell Row', 'Dumbbell Curl']],
  ['Legs', ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Standing Calf Raise']],
  ['Upper A', ['Barbell Bench Press', 'Lat Pulldown', 'Lateral Raise', 'Hammer Curl']],
  ['Full Body', ['Front Squat', 'Dip', 'Barbell Row', 'Plank']],
];

/**
 * A fortnight of invented friend activity, newest first.
 *
 * The shape matches `projectSession()` exactly — `{ id, date, name, entries }`
 * with `entries` only at mid tier and above — plus the `startedAt` the feed uses
 * for its time-of-day line and to break ties within a day.
 *
 * @param {string} today  YYYY-MM-DD
 */
export function buildDemoFeed(today) {
  const rand = rng(DEMO_SEED ^ 0x5EED);
  const out = [];

  for (let back = 0; back < 14; back++) {
    const date = addDays(today, -back);
    for (const f of DEMO_FRIENDS) {
      // Roughly four sessions a week each, so the feed is busy but not solid.
      if (rand() > 0.55) continue;

      const [name, exercises] = DEMO_FEED_WORKOUTS[Math.floor(rand() * DEMO_FEED_WORKOUTS.length)];
      const hour = 6 + Math.floor(rand() * 14);
      const minute = Math.floor(rand() * 60);

      const act = { id: `${f.uid}-${date}`, date, name };

      /* ⚠️ THE LIGHT-TIER FRIEND GETS NEITHER `entries` NOR `startedAt`, and
       * both omissions matter for the same reason: this fixture has to be the
       * shape the NETWORK really returns, not a convenient lookalike.
       *
       * `projectSession()` publishes both only at MID and above — the start
       * time because sixty of them describe a person's weekly schedule, which
       * is a different fact from "they trained on Tuesday", and LIGHT is the
       * tier everybody is on by default.
       *
       * ⚠️ AND THE KEYS ARE ABSENT RATHER THAN NULL OR EMPTY. An empty
       * `entries` array would let a card rendering "" pass for one rendering
       * the honest "they share that they trained" line, and a null `startedAt`
       * would hide a card that prints "Invalid Date". This project has already
       * been bitten once by a fixture that was tidier than the wire — the
       * expired-invite bug lived in exactly that gap, because the old tests fed
       * an ISO string where Firestore returns a Timestamp.
       */
      if (f.tier !== 'light') {
        act.startedAt = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
        act.entries = exercises.map((n) => ({ exerciseId: null, name: n, sets: [] }));
        // Location rides the same gate as startedAt (0m — a typed label,
        // published at mid and above). Only SOME sessions carry one, because
        // that is the live shape: it is optional and people forget it.
        if (rand() > 0.4) act.location = f.location;
      }

      out.push({ uid: f.uid, name: f.name, tier: f.tier, act });
    }
  }

  return out.sort((x, y) =>
    y.act.date.localeCompare(x.act.date)
    // `startedAt` is absent on light-tier rows, so this coerces to '' for them
    // rather than to the string "undefined", which would sort above every real
    // time and float the one friend who shares least to the top of every day.
    || String(y.act.startedAt || '').localeCompare(String(x.act.startedAt || '')));
}
