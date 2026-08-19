// Headless tests for the demo account's generated year. No dependencies.
//   node tests/demo.test.mjs
//
// ⚠️ Two of these matter more than the rest, and neither is about the data
// looking nice:
//
//   DETERMINISM. Tim asked for the demo to reset to the same default every
//   time. That is only true if nothing in the generator reads a real clock or
//   Math.random(), so the same day is asserted to produce a byte-identical
//   year. A demo that quietly differed run to run would make every bug report
//   about it unreproducible.
//
//   PLAUSIBILITY. Invented data that the app's own analysis reads as nonsense
//   is worse than no demo: somebody would judge the muscle map, the rating or
//   the goal on numbers no human produced. So the year is checked against the
//   app's real modules — the estimates rank, the volume lands in a sane band,
//   and the progression neither stalls flat nor arrives somewhere absurd.

const { buildDemoData, unresolvedDemoExercises, DEMO_WEEKS } = await import('../js/demo.js');
const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { e1rm } = await import('../js/e1rm.js');
const { percentileFor, levelFor } = await import('../js/strength-standards.js');
const { weeklyVolume } = await import('../js/volume-map.js');
const { goalProgress, HORIZON_WEEKS } = await import('../js/goals.js');
const { contributionsFor, totalLoad, rateMuscle } = await import('../js/muscle-evidence.js');
const { isRankableSet } = await import('../js/e1rm.js');
const { suggestNext } = await import('../js/next-workout.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const TODAY = '2026-08-19';
const data = buildDemoData({ today: TODAY });
const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name, e]));

/* ================================================================== *
 * Determinism — "resets back to the default" has to be literal
 * ================================================================== */

const again = buildDemoData({ today: TODAY });
ok(JSON.stringify(data) === JSON.stringify(again),
   'the same day produces a byte-identical year — nothing reads a clock or Math.random()');

const tomorrow = buildDemoData({ today: '2026-08-20' });
ok(JSON.stringify(data) !== JSON.stringify(tomorrow),
   'and a different day does move it, so the check above is not passing vacuously');
ok(tomorrow.sessions[tomorrow.sessions.length - 1].date > data.sessions[data.sessions.length - 1].date
   || tomorrow.sessions.length !== data.sessions.length,
   'the year slides with today rather than being a fixed window a year in the past');

/* ================================================================== *
 * It only refers to exercises that exist
 * ================================================================== */

ok(unresolvedDemoExercises().length === 0,
   `every exercise the demo names resolves (${unresolvedDemoExercises().join(', ') || 'none missing'})`);

const badIds = new Set();
for (const w of data.workouts) for (const e of w.exercises) if (!exMap.has(e.exerciseId)) badIds.add(e.exerciseId);
for (const s of data.sessions) for (const e of s.entries) if (!exMap.has(e.exerciseId)) badIds.add(e.exerciseId);
for (const b of data.benchmarks) if (!exMap.has(b.exerciseId)) badIds.add(b.exerciseId);
ok(badIds.size === 0, 'and every stored exercise id points at a real exercise');

/* ================================================================== *
 * The shape the store expects
 * ================================================================== */

ok(data.systems.length === 2, 'two systems — a year of training is not one programme');
ok(data.workouts.length === 7, 'seven workouts across them');
ok(data.workouts.every((w) => data.systems.some((s) => s.id === w.systemId)),
   'every workout belongs to a system that exists (D22)');
ok(data.workouts.every((w) => Number.isInteger(w.order)),
   'and every one carries its programme order');

// ⚠️ Without `order` the store sorts alphabetically and Push Pull Legs comes
// back Legs, Pull, Push — so Home would read the rotation backwards.
const ppl = data.workouts.filter((w) => w.systemId === 'demo-sys-ppl')
  .sort((a, b) => a.order - b.order).map((w) => w.name);
ok(JSON.stringify(ppl) === JSON.stringify(['Push', 'Pull', 'Legs']),
   `the split is in programme order, not alphabetical (${ppl.join(', ')})`);

ok(data.sessions.every((s) => data.workouts.some((w) => w.id === s.workoutId)),
   'every session points at a workout that still exists');
ok(data.sessions.every((s) => s.date && s.startedOn === s.date),
   'every session carries a local startedOn, which is what day logic runs off');
ok(data.sessions.every((s) => s.date <= TODAY), 'and nothing is dated in the future');

/* ================================================================== *
 * A year that looks like a year
 * ================================================================== */

ok(data.sessions.length > 150 && data.sessions.length < 240,
   `${data.sessions.length} sessions over ${DEMO_WEEKS} weeks — about four a week`);

const weeks = new Set(data.sessions.map((s) => s.date.slice(0, 7)));
ok(weeks.size >= 12, `spread across ${weeks.size} calendar months`);

// ⚠️ The gaps are the point. A year with no missed weeks is the tell that data
// is fabricated, and the "why progress stalls" screen has nothing to measure
// against a perfect record.
const dates = data.sessions.map((s) => s.date).sort();
let longestGap = 0;
for (let i = 1; i < dates.length; i++) {
  const a = new Date(dates[i - 1] + 'T00:00:00'), b = new Date(dates[i] + 'T00:00:00');
  longestGap = Math.max(longestGap, Math.round((b - a) / 86400000));
}
ok(longestGap >= 14, `there is a real break in it — ${longestGap} days at the longest`);
ok(longestGap < 30, 'but not one so long the year reads as abandoned');

ok(data.bodyWeight.length >= 50, `${data.bodyWeight.length} weigh-ins, about one a week`);
const bwFirst = data.bodyWeight[0].weight, bwLast = data.bodyWeight[data.bodyWeight.length - 1].weight;
ok(bwLast > bwFirst + 6, `body weight trends up over the year (${bwFirst} to ${bwLast} lbs)`);
ok(data.bodyWeight.every((b, i) => i === 0 || Math.abs(b.weight - data.bodyWeight[i - 1].weight) < 6),
   'without a jump that would read as a typo rather than a person');

ok(data.benchmarks.length >= 16, `${data.benchmarks.length} benchmarks, tested every couple of months`);
ok(data.benchmarks.every((b) => b.values.reps <= 5),
   'each taken for few reps, as a deliberate test is');

/* ================================================================== *
 * The progression is real, and lands somewhere a human could be
 * ================================================================== */

const benchId = byName.get('Barbell Bench Press').id;
const benchSets = [];
for (const s of [...data.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
  for (const e of s.entries) {
    if (e.exerciseId === benchId) benchSets.push({ date: s.date, ...e.sets[0] });
  }
}
ok(benchSets.length > 60, `the bench press appears ${benchSets.length} times across the year`);

const firstBench = benchSets[0].weight, lastBench = benchSets[benchSets.length - 1].weight;
ok(lastBench > firstBench, `and it goes up — ${firstBench} to ${lastBench} lbs`);
// ⚠️ Both bounds matter. Too little and the graphs are flat and the demo shows
// nothing; too much and it is a year no natural lifter has, which discredits
// every number the app then derives from it.
ok(lastBench - firstBench >= 25, 'by enough to be visible on a chart');
ok(lastBench < firstBench * 1.75,
   `and not by so much that no real person could have done it (${Math.round((lastBench / firstBench - 1) * 100)} %)`);

// It must not be a clean ramp either — double progression is a sawtooth, and a
// straight line is the other giveaway of invented data.
const dropped = benchSets.some((s, i) => i > 0 && s.weight < benchSets[i - 1].weight);
ok(dropped, 'and it is not a monotone ramp — there are deloads in it');
const repsVary = new Set(benchSets.map((s) => s.reps)).size;
ok(repsVary >= 3, `reps move up the range and reset (${repsVary} distinct top-set rep counts)`);

/* ================================================================== *
 * The app's own analysis reads it as a plausible lifter
 * ================================================================== */

const profile = {
  gender: 'male',
  bodyWeight: data.bodyWeight[data.bodyWeight.length - 1].weight,
  age: 30,
  compare: null,
};

const bestBench = Math.max(...benchSets.map((s) => e1rm(s.weight, s.reps) || 0));
const pct = percentileFor(bestBench, 'Chest', profile);
const level = levelFor(pct);
ok(level !== null, `the demo lifter ranks rather than falling off the bottom (${level && level.name})`);
ok(pct > 20 && pct < 95,
   `and lands somewhere with room above and below — ${Math.round(pct)}th percentile`);

// Weekly volume from what was actually logged in the last four weeks, the same
// way the goal screen measures it.
const recent = data.sessions.filter((s) => s.date > '2026-07-22');
const asWorkouts = recent.map((s) => ({
  exercises: s.entries.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.length })),
}));
const vol = weeklyVolume(asWorkouts, exMap, 4);
ok(vol.get('Chest') >= 4 && vol.get('Chest') <= 30,
   `chest gets a believable ${Math.round(vol.get('Chest') * 10) / 10} sets a week`);
ok(vol.get('Quads') >= 4, `and legs are actually trained (${Math.round(vol.get('Quads') * 10) / 10} quad sets)`);

/* ================================================================== *
 * Set types are stored the way the app stores them
 * ================================================================== */

const superset = data.workouts.find((w) => w.name === 'Push')
  .exercises.filter((e) => e.group != null);
ok(superset.length === 2, 'the Push day has a real superset in it, so the runner has one to walk');

const dropWorkout = data.workouts.find((w) => w.name === 'Pull')
  .exercises.find((e) => e.setType === 'drop');
ok(Boolean(dropWorkout) && dropWorkout.minis === 2, 'and the Pull day plans a drop set');

const dropSession = data.sessions.find((s) => s.entries.some((e) => e.setType === 'drop'));
const dropEntry = dropSession && dropSession.entries.find((e) => e.setType === 'drop');
ok(Boolean(dropEntry), 'which is recorded as a drop set in the sessions too');
// ⚠️ D23: drops live INSIDE the set, never as extra rows. If the demo flattened
// them it would inflate every set count and every weekly volume figure the app
// displays, and the demo would be quietly teaching the wrong number.
ok(dropEntry.sets.every((s) => Array.isArray(s.minis) && s.minis.length === 2),
   'with the drops nested inside each set rather than added as extra sets');
ok(dropEntry.sets.length === 3, 'so a three-set drop-set exercise still counts as three sets');
ok(dropEntry.sets.every((s) => s.minis.every((m) => m.weight < s.weight)),
   'and each drop is lighter than the set it came off');

/* ================================================================== *
 * The goal is one the app itself would have computed
 * ================================================================== */

ok(data.goals.length === 1, 'the demo account is already running one goal');
const goal = data.goals[0];
ok(goal.status === 'active' && goal.muscle === 'Chest', 'an active chest goal');
ok(goal.targetWeight > goal.startWeight, 'aiming at more than it started from');
ok(goal.endDate > TODAY, 'with time still left on it');

// ⚠️ Measured against the estimate the APP will show, not against the bench
// press alone — the two are different numbers, and an earlier version of the
// generator conflated them. The app rates Chest from every exercise that trains
// it, converted by a ratio, and for this lifter the incline dumbbell press
// converts higher than the bench does. Building the goal off the bench meant
// the demo opened on a goal already reading "Target reached", with the muscle
// map beside it disagreeing. This assertion is what would catch that again.
const chestNow = rateChest(TODAY);
ok(chestNow > 0, `the app's own Chest estimate today is ${Math.round(chestNow)} lb`);

const prog = goalProgress(goal, chestNow, TODAY);
ok(prog.weeksLeft > 0 && prog.weeksLeft < HORIZON_WEEKS,
   `${prog.weeksLeft} weeks left — part-way through, which is the interesting state to look at`);
ok(prog.gained > 0,
   `and real progress has been made against it (+${Math.round(prog.gained)} lb since it was set)`);
ok(!prog.reached,
   'without it already being finished, which would open the demo on a completed goal');
ok(prog.fraction > 0.02 && prog.fraction < 0.9,
   `part of the way there — ${Math.round(prog.fraction * 100)} %, which is the state worth looking at`);

// The goal's own starting figure has to BE the app's estimate on the day it was
// set, or the two screens are telling the demo user different things.
const chestThen = rateChest(goal.startDate);
ok(Math.abs(chestThen - goal.startWeight) < 0.5,
   'and the goal started from exactly what the muscle map said that day, not from one lift');

function rateChest(asOfISO) {
  const asOf = new Date(asOfISO + 'T00:00:00');
  const obs = [];
  const add = (exerciseId, weight, reps, date, isBenchmark) => {
    if (date > asOfISO || !isRankableSet(reps)) return;
    const ex = exMap.get(exerciseId);
    if (!ex) return;
    const load = totalLoad(weight, ex.loadType);
    if (load === null) return;
    const raw = e1rm(load, reps);
    if (raw === null) return;
    for (const c of contributionsFor(ex)) {
      if (c.muscle !== 'Chest') continue;
      obs.push({
        estimate: raw / c.ratio, rawE1rm: raw, quality: c.quality, kind: c.kind, ratio: c.ratio,
        reps, weight, loadType: ex.loadType, date,
        ageDays: Math.max(0, Math.round((asOf - new Date(date + 'T00:00:00')) / 86400000)),
        isBenchmark, exerciseId, exerciseName: ex.name,
        source: isBenchmark ? 'benchmark' : 'workout',
      });
    }
  };
  for (const b of data.benchmarks) add(b.exerciseId, b.values.weight, b.values.reps, b.date, true);
  for (const s of data.sessions) {
    for (const e of s.entries) for (const st of e.sets) add(e.exerciseId, st.weight, st.reps, s.date, false);
  }
  const r = rateMuscle(obs);
  return r ? r.estimate : 0;
}

/* ================================================================== *
 * Home has something to suggest
 * ================================================================== */

const next = suggestNext({
  systems: data.systems,
  workouts: [...data.workouts].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name)),
  sessions: data.sessions,
  today: TODAY,
});
ok(next && next.workout, `Home can read the rotation and offer "${next && next.workout.name}"`);
ok(next && next.system && next.system.id === 'demo-sys-ppl',
   'from the programme the demo lifter is actually on, not the one they left behind');

/* ================================================================== *
 * Settings follow the real account rather than overriding it
 * ================================================================== */

const kg = buildDemoData({ today: TODAY, units: 'kg', theme: 'light' });
ok(kg.settings[0].units === 'kg' && kg.settings[0].theme === 'light',
   'units and theme are carried in, so entering the demo does not flip either');
ok(kg.settings[0].gender === 'male' && kg.settings[0].birthYear === 1996,
   'while the demo person keeps their own profile, which the rankings need');
ok(JSON.stringify(kg.sessions) === JSON.stringify(data.sessions),
   'and changing the display unit does not change a single recorded number');

console.log(`\n${fails === 0 ? 'All checks passed.' : fails + ' FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
