// Headless tests for the Goals model. No dependencies.
//   node tests/goals.test.mjs
//
// docs/goals-plan.md · docs/research.md §6, §12.
//
// ⚠️ The most valuable tests in here are the REFUSALS, and they are the same
// shape as the ones in tests/optimal.test.mjs. This feature's two serious
// failure modes are things it must decline to do rather than things it must
// compute:
//
//   1. Nothing may read the DEADLINE to decide what is asked of somebody.
//      goals-plan §3.1 — a requirement that grows because you are behind
//      schedule pushes hardest on the person who has just missed two weeks,
//      which is backwards and is the only thing in this app that could cause
//      physical harm rather than merely be wrong on a screen.
//   2. Nothing may emit an on-track / behind verdict. That is gated on the
//      strength estimator, and a verdict off raw session numbers would call a
//      bad Tuesday a failure.
//
// Both are asserted directly, and both are asserted so they FAIL if the
// behaviour is reintroduced — a test that passes either way is worse than none.

const {
  AMBITIONS, ambitionFor, ambitionByKey, requirementsFor, candidateGoals, buildGoal,
  goalProgress, stallReasons, rankSystems, addDays, daysBetween, parseDay, formatDay,
  HORIZON_WEEKS, MINUTES_PER_SET, SLEEP_LINE, EFFORT_LINE,
} = await import('../js/goals.js');
const { LEVELS, weightForPercentile, percentileFor } = await import('../js/strength-standards.js');
const { HYPERTROPHY_TIERS } = await import('../js/volume-map.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const PROFILE = { gender: 'male', bodyWeight: 180, age: 30, compare: null };
const LB_PER_KG = 2.2046226218;

/* ================================================================== *
 * Dates — local, never UTC
 * ================================================================== */

ok(addDays('2026-08-19', HORIZON_WEEKS * 7) === '2026-11-11',
   'twelve weeks from 19 Aug 2026 is 11 Nov 2026');
ok(daysBetween('2026-08-19', '2026-11-11') === 84, 'and that is 84 days');
ok(addDays('2026-12-30', 7) === '2027-01-06', 'adding days crosses a year end');
ok(addDays('2026-02-27', 2) === '2026-03-01', 'and a short month');

// The trap next-workout.js documents: new Date('2026-08-19') is parsed as UTC
// and lands a day early for everyone west of Greenwich. Splitting the string is
// the fix, and this asserts the fix rather than the bug.
const d = parseDay('2026-08-19');
ok(d.getFullYear() === 2026 && d.getMonth() === 7 && d.getDate() === 19,
   'a YYYY-MM-DD is parsed as LOCAL midnight, not UTC');
ok(formatDay(d) === '2026-08-19', 'and formats back to the same day');
ok(daysBetween('bad', '2026-08-19') === null, 'a malformed date is null, not NaN days');

/* ================================================================== *
 * Ambition is derived from the size of the jump
 * ================================================================== */

ok(ambitionFor(0.02).key === 'steady', '2 % more is a Steady goal');
ok(ambitionFor(0.10).key === 'committed', '10 % more is Committed');
ok(ambitionFor(0.30).key === 'ambitious', '30 % more is Ambitious');
ok(ambitionFor(NaN).key === 'steady', 'and an unusable number falls to the lightest band');

// Monotone, so a bigger goal can never ask for less than a smaller one.
const setsMin = AMBITIONS.map((a) => a.sets[0]);
const setsMax = AMBITIONS.map((a) => a.sets[1]);
ok(setsMin[0] < setsMin[1] && setsMin[1] < setsMin[2],
   'the set requirement rises with every band');
ok(setsMax[0] < setsMax[1] && setsMax[1] < setsMax[2], 'at both ends of the band');
ok(AMBITIONS.every((a, i) => i === 0 || a.sessions[0] >= AMBITIONS[i - 1].sessions[0]),
   'and sessions a week never fall as the goal grows');

/* ================================================================== *
 * Every requirement traces to a published number
 * ================================================================== */

// The set bands are not invented: each one must sit inside the efficiency tiers
// of Pelland et al.'s Table 3, and none may reach past the top of the evidence.
const tierOf = (v) => HYPERTROPHY_TIERS.find((t) => v <= t.max);
for (const a of AMBITIONS) {
  ok(a.sets[0] >= 4,
     `${a.name} asks for at least the minimum effective dose of 4 sets (${a.sets[0]})`);
  ok(a.sets[1] <= 42,
     `${a.name} never asks past 42 sets, the top of the evidence (${a.sets[1]})`);
}
ok(AMBITIONS[0].sets[0] === 4,
   'Steady starts exactly at the minimum effective dose — the published figure, not a round number');
ok(tierOf(AMBITIONS[1].sets[0]).key === 'higher' && tierOf(AMBITIONS[1].sets[1]).key === 'higher',
   'Committed sits wholly inside the higher-efficiency tier, 5–10 sets');
ok(tierOf(AMBITIONS[2].sets[0]).key === 'intermediate'
   && tierOf(AMBITIONS[2].sets[1]).key === 'intermediate',
   'Ambitious sits wholly inside the intermediate tier, 11–18 sets');
// Only Steady straddles a boundary, and it does so deliberately: the
// minimum-effective-dose tier is the single value 4, so a band that stayed
// inside it would not be a band at all.
ok(tierOf(AMBITIONS[0].sets[0]).key === 'minimum' && tierOf(AMBITIONS[0].sets[1]).key === 'higher',
   'and Steady runs from that dose into the best-value band, which is what its own text says');
ok(AMBITIONS[0].sets[1] < AMBITIONS[1].sets[0] && AMBITIONS[1].sets[1] < AMBITIONS[2].sets[0],
   'the three bands never overlap, so one set count never means two different ambitions');

// Frequency: the 1 -> 2 sessions step is the big one for strength, so every
// band clears 2, and only the most ambitious goes past it.
ok(AMBITIONS.every((a) => a.sessions[0] >= 2),
   'every band asks for at least 2 sessions a week — the step the evidence is clearest on');
ok(AMBITIONS[2].sessions[0] === 3 && AMBITIONS[0].sessions[0] === 2,
   'and only the ambitious band goes past it, where returns are already flattening');

/* ---- protein is a THRESHOLD, and the test says so ---- */

const steady = requirementsFor('steady', { bodyWeight: 180 });
const committed = requirementsFor('committed', { bodyWeight: 180 });
const ambitious = requirementsFor('ambitious', { bodyWeight: 180 });

// ⚠️ LOAD-BEARING. goals-plan §10.1: framing protein as "ambitious -> more"
// would imply more protein buys more muscle, which is exactly what Morton et
// al. found NOT to be true above the breakpoint. Two of the three bands sitting
// at the same figure is what proves it is not a dial.
ok(steady.proteinPerLb === committed.proteinPerLb,
   'protein does not step up between Steady and Committed — it is a bar, not a dial');
ok(near(steady.proteinPerLb, 0.73, 0.001),
   'and it sits at 0.73 g/lb, the breakpoint above which more did nothing detectable');
ok(near(steady.proteinPerLb * LB_PER_KG, 1.62, 0.02),
   'which is the published 1.62 g/kg exactly');
ok(near(ambitious.proteinPerLb, 1.0, 0.001),
   'the ambitious band asks for 1.0 g/lb — the TOP of the confidence interval');
ok(near(ambitious.proteinPerLb * LB_PER_KG, 2.2, 0.02),
   'which is the published 2.2 g/kg — so it buys certainty about where the bar is, not growth');
ok(steady.proteinGrams === Math.round(180 * 0.73) && ambitious.proteinGrams === 180,
   `and the daily figure follows body weight (${steady.proteinGrams} g and ${ambitious.proteinGrams} g at 180 lb)`);

const proteinRow = (r) => r.rows.find((x) => x.key === 'protein');
ok(proteinRow(ambitious).scales === false,
   'the protein row is never labelled as growing with the goal');
ok(proteinRow(ambitious).threshold === true, 'it is labelled a threshold instead');
ok(requirementsFor('x', {}).ambition.key === 'steady',
   'an unrecognised ambition degrades to the lightest requirements, not the heaviest');

/* ---- sleep and effort do not scale at all ---- */

// ⚠️ No dose-response between habitual hours slept and gains exists (§6.10), so
// "8 hours for the ambitious goal" would be an invented curve. Identical text
// at every band is the assertion that none was invented.
const sleepOf = (r) => r.rows.find((x) => x.key === 'sleep').detail;
ok(sleepOf(steady) === sleepOf(ambitious) && sleepOf(steady) === SLEEP_LINE,
   'sleep gets the same sentence at every ambition — no dose-response exists to scale it by');
ok(SLEEP_LINE.includes('fifth'),
   'and it carries the measured number rather than a vague warning');

const effortOf = (r) => r.rows.find((x) => x.key === 'effort').detail;
ok(effortOf(steady) === effortOf(ambitious) && effortOf(steady) === EFFORT_LINE,
   'effort likewise — strength is largely indifferent to reps in reserve');
ok(EFFORT_LINE.includes('indifferent'),
   'and the row says so, rather than quietly omitting the requirement');

// Time follows from sets, so it must be exactly the arithmetic and nothing else.
ok(ambitious.minutes[0] === ambitious.sets[0] * MINUTES_PER_SET
   && ambitious.minutes[1] === ambitious.sets[1] * MINUTES_PER_SET,
   'minutes are derived from the set count, not chosen separately');
ok(steady.rows.find((r) => r.key === 'minutes').source === 'Arithmetic, not a finding',
   'and the row says outright that it is arithmetic — the rest-interval evidence is not pulled');
ok(steady.rows.every((r) => r.source === null || typeof r.source === 'string'),
   'every requirement names where it came from');

/* ================================================================== *
 * REFUSAL 1 — nothing reads the calendar to decide what is asked
 *
 * goals-plan §3.1, and the only failure mode here that could hurt somebody.
 * Two goals with identical numbers and wildly different start dates — one
 * eleven weeks old and nearly out of time — must produce byte-identical
 * requirements. This test fails the moment anything starts scaling a
 * requirement by how far behind schedule a person is.
 * ================================================================== */

const level = LEVELS.find((l) => l.key === 'proficient');
const freshGoal = buildGoal({
  muscle: 'Chest', level, targetWeight: 225, startWeight: 200,
  startPercentile: 50, startLevelKey: 'intermediate', startDate: '2026-08-19',
  liftName: 'Barbell Bench Press',
});
const staleGoal = buildGoal({
  muscle: 'Chest', level, targetWeight: 225, startWeight: 200,
  startPercentile: 50, startLevelKey: 'intermediate', startDate: '2026-05-27',
  liftName: 'Barbell Bench Press',
});

ok(freshGoal.ambition === staleGoal.ambition,
   'a goal eleven weeks old lands in the same ambition band as one set today');
ok(JSON.stringify(requirementsFor(freshGoal.ambition, { bodyWeight: 180 }))
   === JSON.stringify(requirementsFor(staleGoal.ambition, { bodyWeight: 180 })),
   'and asks for exactly the same thing — running out of time NEVER raises the demand');

// The same in the other direction: the requirement depends on the size of the
// jump and on nothing else about the goal.
const bigger = buildGoal({
  muscle: 'Chest', level, targetWeight: 260, startWeight: 200,
  startPercentile: 50, startLevelKey: 'intermediate', startDate: '2026-08-19',
});
ok(bigger.ambition !== freshGoal.ambition,
   'a bigger jump does move the band — so the test above is not passing vacuously');

/* ================================================================== *
 * REFUSAL 2 — no verdict
 * ================================================================== */

// Somebody four days from the end having added nothing at all. A verdict would
// fire here if there were one; there must not be.
const desperate = goalProgress(freshGoal, 200, '2026-11-07');
const keys = Object.keys(desperate).join(' ').toLowerCase();
ok(!/verdict|ontrack|on_track|behind|ahead|status/.test(keys),
   'goalProgress reports the measured gap and emits no verdict of any kind');
ok(desperate.fraction === 0 && desperate.remaining === 25,
   'it says 0 % of the way and 25 lb to go, which is a measurement and not a judgement');
ok(desperate.daysLeft === 4 && desperate.weeksLeft === 1,
   'and how long is left, so the reader can draw their own conclusion');

/* ================================================================== *
 * Progress arithmetic
 * ================================================================== */

const half = goalProgress(freshGoal, 212.5, '2026-09-16');
ok(near(half.fraction, 0.5, 1e-9), 'halfway to the target reads as 0.5');
ok(half.gained === 12.5 && near(half.remaining, 12.5, 1e-9), 'with the gap stated both ways');
ok(half.weeksElapsed === 4, 'four weeks elapsed');

const over = goalProgress(freshGoal, 240, '2026-10-01');
ok(over.reached === true && over.fraction === 1 && over.remaining === 0,
   'passing the target clamps the bar at full and leaves nothing to go');
ok(over.rawFraction > 1, 'though the raw figure still shows how far past it is');

// ⚠️ A muscle can genuinely go backwards, and the bar clamping must not hide it.
const back = goalProgress(freshGoal, 190, '2026-09-16');
ok(back.fraction === 0 && back.gained === -10,
   'going backwards draws an empty bar but still reports the loss as -10 lb');

const late = goalProgress(freshGoal, 210, '2026-11-20');
ok(late.expired === true && late.weeksLeft === 0,
   'past the end date the goal reads as expired rather than as negative weeks left');

ok(goalProgress(freshGoal, null, '2026-09-16').fraction === null,
   'with nothing recorded since, there is no fraction rather than a fake zero');

/* ================================================================== *
 * The goal freezes what it was set with
 * ================================================================== */

ok(freshGoal.endDate === '2026-11-11', 'a goal is twelve weeks long');
ok(typeof freshGoal.targetWeight === 'number' && freshGoal.targetWeight === 225,
   'the TARGET WEIGHT is stored as a number, never as a percentile to look up again');
ok(freshGoal.targetLevelName === 'Proficient' && freshGoal.targetPercentile === 65,
   'alongside the level it came from, so the screen can name it without recomputing');
ok(near(freshGoal.gainPct, 12.5, 0.01), 'and how far it reaches, frozen at 12.5 %');

// Why that matters: the weight behind a level moves with body weight and with
// the comparison group. A goal that recomputed it would get harder because
// somebody gained four pounds.
const lightTarget = weightForPercentile(65, 'Chest', { ...PROFILE, bodyWeight: 170 });
const heavyTarget = weightForPercentile(65, 'Chest', { ...PROFILE, bodyWeight: 200 });
ok(heavyTarget > lightTarget + 5,
   'the weight behind a level genuinely moves with body weight — which is why it is frozen');

/* ================================================================== *
 * Choosing a goal
 * ================================================================== */

const current = weightForPercentile(50, 'Chest', PROFILE);
const pct = percentileFor(current, 'Chest', PROFILE);
const options = candidateGoals('Chest', current, pct, PROFILE);

ok(options.length === 4,
   `a median lifter is offered the four levels above them (${options.map((o) => o.level.name).join(', ')})`);
ok(options.every((o) => o.targetWeight > current),
   'every one of them is heavier than where they are now');
ok(options.every((o, i) => i === 0 || o.targetWeight > options[i - 1].targetWeight),
   'and they arrive in ascending order');
ok(options.every((o, i) => i === 0
   || AMBITIONS.indexOf(o.ambition) >= AMBITIONS.indexOf(options[i - 1].ambition)),
   'and the ambition never falls as the target rises');

// ⚠️ Worth pinning, because it is counter-intuitive and the screen must not
// paper over it: one level is a 12–31 % jump in estimated max, so from the
// exact median there is no cheap goal on offer at all. The app says Committed
// rather than inventing a gentler option that does not exist.
ok(options[0].ambition.key === 'committed',
   `even the NEXT level from the median is a Committed goal (+${Math.round(options[0].gainPct)} %)`);
ok(options[3].ambition.key === 'ambitious', 'and the furthest is Ambitious');

// Somebody already most of the way to the next level does get a Steady one, so
// the band is reachable rather than dead code.
const nearly = weightForPercentile(63, 'Chest', PROFILE);
const nearlyOpts = candidateGoals('Chest', nearly, percentileFor(nearly, 'Chest', PROFILE), PROFILE);
ok(nearlyOpts[0].ambition.key === 'steady',
   `two percentiles short of Proficient, the same goal is Steady (+${Math.round(nearlyOpts[0].gainPct)} %)`);
ok(candidateGoals('Chest', current, 99.9, PROFILE).length === 0,
   'somebody already at the top is offered nothing rather than an unreachable goal');
ok(candidateGoals('Chest', 0, 50, PROFILE).length === 0,
   'and a muscle with no estimate yields no goals rather than dividing by zero');

/* ================================================================== *
 * Why progress stalls — the split IS the feature
 * ================================================================== */

const req = requirementsFor('committed', { bodyWeight: 180 });
const shortReasons = stallReasons({
  requirements: req,
  measured: { weeklySets: 3, sessionsPerWeek: 1, spanDays: 28, sessions: 8 },
  muscle: 'Chest',
});

ok(shortReasons.length === 6, 'six reasons progress stalls');
ok(shortReasons.filter((r) => r.visible).length === 2,
   'the app can measure exactly two of them');
ok(shortReasons.filter((r) => !r.visible).length === 4,
   'and has to admit it cannot see the other four');
ok(shortReasons.filter((r) => !r.visible).every((r) => r.status === 'invisible' && r.value === null),
   'the four it cannot see show no number at all rather than a zero');
ok(shortReasons.find((r) => r.key === 'volume').status === 'short'
   && shortReasons.find((r) => r.key === 'frequency').status === 'short',
   '3 sets a week against a 7-10 requirement reads as short, and so does 1 session');
ok(shortReasons.find((r) => r.key === 'volume').detail.includes('minimum effective dose'),
   'and below 4 sets it names the minimum effective dose rather than only the goal');

// ⚠️ VACUITY GUARD, the same one tests/social.test.mjs leans on. If "short"
// came back for every input the assertions above would be meaningless, so the
// identical call with adequate training has to come back OK.
const fineReasons = stallReasons({
  requirements: req,
  measured: { weeklySets: 9, sessionsPerWeek: 2, spanDays: 28, sessions: 8 },
  muscle: 'Chest',
});
ok(fineReasons.find((r) => r.key === 'volume').status === 'ok'
   && fineReasons.find((r) => r.key === 'frequency').status === 'ok',
   'the same walk over adequate training reads OK — so "short" is a result, not the only answer');
ok(fineReasons.filter((r) => !r.visible).length === 4,
   'and training well does not make the four invisible reasons go away');

const unknown = stallReasons({ requirements: req, measured: null, muscle: 'Chest' });
ok(unknown.filter((r) => r.visible).every((r) => r.status === 'unknown' && r.value === null),
   'with too little history the two measurable rows say "not enough yet", never zero');

/* ================================================================== *
 * Matching a programme to the goal
 * ================================================================== */

// ⚠️ THE POINT OF §5. A programme with a much higher headline strength rating
// must still lose to one that actually trains the goal muscle — the headline is
// an average over eleven muscles and the goal is about one of them.
const ranked = rankSystems([
  { id: 'broad', name: 'Great overall', sets: 2, rating: { raw: { strength: 95 }, strength: 95 } },
  { id: 'focused', name: 'Trains the muscle', sets: 8, rating: { raw: { strength: 60 }, strength: 60 } },
  { id: 'heavy', name: 'Far more than needed', sets: 26, rating: { raw: { strength: 80 }, strength: 80 } },
], [7, 10]);

ok(ranked[0].id === 'focused',
   'a programme inside the goal\'s set band beats one rated 35 points higher overall');
ok(ranked[1].id === 'heavy',
   'more work than the goal needs ranks second — a cost, not a failure');
ok(ranked[2].id === 'broad', 'and the one that barely trains the muscle ranks last');
ok(ranked[0].fit === 'fits' && ranked[1].fit === 'more' && ranked[2].fit === 'under',
   'each row carries a plain-language fit rather than only a position in the list');
ok(rankSystems([{ id: 'a', sets: 5, rating: null }], [7, 10])[0].fit === 'light',
   'a programme over the minimum effective dose but under the goal reads as light, not as under');

/* ================================================================== *
 * The band boundaries are ours, and the module has to admit it
 * ================================================================== */

ok(AMBITIONS.every((a) => typeof a.blurb === 'string' && a.blurb.length > 10),
   'every band explains itself in a sentence');
ok(requirementsFor('steady', {}).rows.find((r) => r.key === 'consistency').source
   === 'Our judgement',
   'the consistency threshold is labelled as our judgement, not dressed up as a citation');
ok(ambitionByKey('nope') === null, 'an unknown ambition key is null rather than a silent default');

console.log(`\n${fails === 0 ? 'All checks passed.' : fails + ' FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
