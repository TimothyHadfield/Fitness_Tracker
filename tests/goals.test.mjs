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
//   3. Nothing about a goal may reach the WEIGHT SUGGESTION. Same section, same
//      reason, and this is the half that can actually hurt somebody: a
//      suggestion that read the deadline would hand heavier weights to the
//      person coming back from two weeks off.
//   4. And the same harm from the other side: TIME MAY ONLY EVER SUPPRESS A
//      SUGGESTION, never create or increase one. Handing somebody a heavier
//      weight than they have touched in a month is §3.1's failure arriving
//      through a gap rather than through a deadline. That one is asserted as a
//      swept PROPERTY rather than as cases, so it holds whatever threshold is
//      chosen.
//
// All three are asserted directly, and all three are asserted so they FAIL if
// the behaviour is reintroduced — a test that passes either way is worse than
// none. Each carries a vacuity guard: something that DOES move the answer, so
// the refusal cannot pass by looking in the wrong place.

const {
  AMBITIONS, ambitionFor, ambitionByKey, requirementsFor, candidateGoals, buildGoal,
  goalProgress, stallReasons, rankSystems, addDays, daysBetween, parseDay, formatDay,
  HORIZON_WEEKS, MINUTES_PER_SET, SLEEP_LINE, EFFORT_LINE,
} = await import('../js/goals.js');
const {
  LOAD_BAND, ISOLATION_MAX, LAYOFF_DAYS, REP_BANDS, repRangeFor, trainingRange,
  isCompound, loadCeiling,
  smallestHonestIncrement, sessionSummary, historyFor, lastSessionDate,
  suggestProgression, applySuggestion, PROGRESSION_EXPLAINER,
} = await import('../js/progression.js');
const { LEVELS, weightForPercentile, percentileFor } = await import('../js/strength-standards.js');
const { totalResistance } = await import('../js/e1rm.js');
const { HYPERTROPHY_TIERS } = await import('../js/volume-map.js');
const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');

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

/* ⚠️ A ROW THAT IS BEING MET MUST NOT BE HEADLINED WITH THE THING THAT GOES
   WRONG. Found by the UX review, 2026-08-22: somebody doing 10.9 sets a week
   against a 7–10 target read "Not enough sets on this muscle" in bold, with the
   number beside it in green and the sub-line underneath correctly saying they
   were over. The row's own class was already `is-ok` — only the headline had
   not been told. Rule 6 forbids unearned opinions, and an unearned NEGATIVE one
   is the same fault; this was the single screen in the app holding measured
   proof that a user was doing the work. */
ok(fineReasons.find((r) => r.key === 'volume').heading === 'Enough sets on this muscle'
   && fineReasons.find((r) => r.key === 'frequency').heading === 'Training it often enough',
   '⚠️ a user who is MEETING the target is told so, not told the opposite in bold');
ok(shortReasons.find((r) => r.key === 'volume').heading === 'Not enough sets on this muscle',
   'and somebody genuinely short still reads that they are short');
ok(unknown.filter((r) => r.visible).every((r) => !/^Not /.test(r.heading)),
   'and "not measured yet" is never headlined as a failure either');

// ⚠️ `reason` survives untouched, because the OTHER screen needs it. On "Why
// progress stalls" a row names a CAUSE, and a cause is called by its name
// whether or not it is happening to you.
ok(fineReasons.every((r) => typeof r.reason === 'string' && r.reason)
   && fineReasons.find((r) => r.key === 'volume').reason === 'Not enough sets on this muscle',
   'while the cause name is unchanged, so the stalls screen still reads as a list of causes');

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

/* ================================================================== *
 * PROGRESSION — docs/goals-plan.md §8, docs/research.md §12
 *
 * ⚠️ This is the only part of the app that could cause physical harm, so the
 * assertions below are the most load-bearing in the file. Two shapes of them:
 * the rule reproduces the published numbers, and the rule REFUSES to hear about
 * anything except the last two sessions of the lift in front of it.
 * ================================================================== */

const exOf = (name) => {
  const e = BUILT_IN_EXERCISES.find((x) => x.name === name);
  if (!e) throw new Error(`test fixture missing exercise: ${name}`);
  return e;
};
const BENCH = exOf('Barbell Bench Press');      // Chest, three muscles — compound
const PUSHDOWN = exOf('Triceps Pushdown');      // Triceps, one muscle — isolation
const PEC_DECK = exOf('Pec Deck');              // big muscle, worked alone
const RUNNING = exOf('Running');                // distance + time, no load at all

// n sets of w x r.
const S = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r }));

/* ---- the rep ladder ---- */

ok(repRangeFor(10).join('-') === '8-12', '10 reps sits in the 8–12 range');
ok(repRangeFor(8).join('-') === '6-8',
   'a rep count ON a boundary is the TOP of the lower band, not the bottom of the higher one');
ok(repRangeFor(12).join('-') === '8-12', 'and 12 is the top of 8–12 for the same reason');
ok(repRangeFor(2).join('-') === '3-5',
   'under three reps falls into 3–5 — no band may end low enough to drop somebody to a single');
ok(repRangeFor(30).join('-') === '15-20', 'and anything very high clamps to the top band');
ok(REP_BANDS.every((b, i) => i === 0 || b[1] > REP_BANDS[i - 1][1]),
   'the ladder rises, so walking up it can never send somebody back down a band');

/* ---- the §12.2 table, pinned exactly ---- */

// ⚠️ research.md §12.2 IS this table, and it is the finding the whole rule
// turns on: a 5 lb jump only enters the recommended band at 50 lb and above.
const inc = (w, ceil = LOAD_BAND.max) => smallestHonestIncrement(w, 5, ceil);
ok(inc(20) === null, '20 lb: a 5 lb jump is 25 % — no honest increment exists');
ok(inc(30) === null, '30 lb: 16.7 %, still none — this is the §8.2 example');
ok(inc(40) === null, '40 lb: 12.5 %, still none');
ok(inc(50) === 5, '50 lb: exactly 10 %, and it enters the band here and not before');
ok(inc(100) === 5, '100 lb: 5 %, comfortably inside');
ok(inc(225) === 5, '225 lb: 2.2 %, at the bottom of the band');
ok(inc(300) === 10,
   '300 lb: 5 lb is 1.7 % and below the floor, so the smallest HONEST step is 10 lb');
ok(LOAD_BAND.min === 0.02 && LOAD_BAND.max === 0.10,
   'the band is the position stand\'s 2–10 %, not a rounder pair of numbers');

/* ---- sized by the lift, which is the other half of the position stand ---- */

ok(isCompound(BENCH) === true && isCompound(PUSHDOWN) === false,
   'a bench press is sized as a compound and a pushdown is not');
ok(isCompound(PEC_DECK) === false,
   'a big muscle worked ALONE is not a compound — involvement matters as well as size');
ok(loadCeiling(BENCH) === LOAD_BAND.max && loadCeiling(PUSHDOWN) === ISOLATION_MAX,
   'so the compound may take the top of the band and the isolation lift half of it');
ok(loadCeiling({ name: 'Something nobody has seen', muscle: 'Other', fields: ['weight', 'reps'] })
   === ISOLATION_MAX,
   'and an exercise the app does not recognise gets the SMALLER step, never the larger');
ok(inc(60, LOAD_BAND.max) === 5 && inc(60, ISOLATION_MAX) === null,
   'at 60 lb that is the difference between a 5 lb step and no honest step at all');

/* ---- reading a session ---- */

const ramped = sessionSummary([
  { weight: 135, reps: 5 }, { weight: 225, reps: 12 }, { weight: 225, reps: 9 },
]);
ok(ramped.topWeight === 225 && ramped.setsAtTop === 2,
   'a warm-up set is not the working weight');
ok(ramped.repsAtTop === 9,
   'and the WEAKEST set at the working weight decides — one good set must not drag the load up');
ok(ramped.bestAtTop === 12, 'while the BEST set is kept too, because it says which range this is');
ok(sessionSummary([{ weight: 0, reps: 0 }]) === null, 'an empty session summarises to nothing');

// ⚠️ REGRESSION, and it was found by driving the demo account in a real browser
// rather than by any of the assertions above. Reps almost always FALL across the
// sets of a working weight — 190 x 6, 6, 4, 3 is an ordinary bench session. The
// first build anchored the rep range on the weakest set, so it told a lifter who
// had just pressed 190 for 6 that "the weight moves once you have hit 5", a
// target they had beaten in that same session — and a load increase would then
// have dropped them to 3 reps. The range comes from the best set; only the GATE
// comes from the weakest.
const descending = suggestProgression({
  history: [[{ weight: 190, reps: 6 }, { weight: 190, reps: 6 },
             { weight: 190, reps: 4 }, { weight: 190, reps: 3 }]],
  exercise: BENCH, step: 5,
});
ok(descending.range.join('-') === '6-8',
   'a session of 6, 6, 4, 3 is training in the 6–8 range — read off the best set, not the worst');
ok(!/hit 5/.test(descending.why) && /every set reaches 8/.test(descending.why),
   'so the target named is one the lifter has NOT already beaten in that same session');
ok(descending.kind === 'reps' && descending.reps === 4,
   'and the suggestion is a rep on the set that fell short, not a load increase');
ok(applySuggestion([{ weight: 190, reps: 6 }, { weight: 190, reps: 3 }], descending)
   .map((s) => s.reps).join(',') === '6,4',
   'laid over the sets, only the short one moves — the 6 keeps its own number');

/* ---- the walk: reps, then reps again, then the weight ---- */

const belowTop = suggestProgression({ history: [S(100, 10)], exercise: BENCH, step: 5 });
ok(belowTop.kind === 'reps' && belowTop.weight === 100 && belowTop.reps === 11,
   'below the top of the range the load is HELD and one rep is added');

const topOnce = suggestProgression({ history: [S(100, 12)], exercise: BENCH, step: 5 });
ok(topOnce.kind === 'repeat' && topOnce.weight === 100 && topOnce.reps === 12,
   '⚠️ at the top of the range ONCE the answer is to repeat it — the rule asks for two sessions');
ok(topOnce.why.includes('the rule asks for two sessions, because one is noise'),
   'and it says why, at the moment of use, rather than silently holding the weight');

const topTwice = suggestProgression({
  history: [S(100, 12), S(100, 12)], exercise: BENCH, step: 5,
});
ok(topTwice.kind === 'load' && topTwice.weight === 105 && topTwice.reps === 8,
   'the top of the range on TWO consecutive sessions adds the load and drops reps to the bottom');
ok(topTwice.pct === 5 && topTwice.addedWeight === 5, 'a 5 % step, which is inside the band');

const heavy = suggestProgression({
  history: [S(300, 12), S(300, 12)], exercise: BENCH, step: 5,
});
ok(heavy.addedWeight === 10 && heavy.weight === 310,
   'on a heavy lift 5 lb is under the band, so the smallest honest step is 10');

// Two sessions at the top but at DIFFERENT weights is not two consecutive
// sessions at the same workload, which is what the position stand asks for.
const movedWeight = suggestProgression({
  history: [S(100, 12), S(95, 12)], exercise: BENCH, step: 5,
});
ok(movedWeight.kind === 'repeat',
   'and the two sessions have to be at the SAME weight — otherwise it is not the same workload');

/* ---- when no honest increment exists, SAY SO (§8.2 rule 4) ---- */

const tooSmall = suggestProgression({
  history: [S(30, 12), S(30, 12)], exercise: PUSHDOWN, step: 5,
});
ok(tooSmall.kind === 'noIncrement' && tooSmall.weight === 30 && tooSmall.reps === 13,
   'at 30 lb it refuses to add weight and proposes another rep instead');
ok(tooSmall.smallestPct === 16.7,
   'naming the jump it declined — 16.7 %, which is the figure in research.md §12.2');
ok(/microplates/.test(tooSmall.why) && /extra set/.test(tooSmall.why),
   'and it names the three real ways up: a rep, a set, or microplates');

// ⚠️ Two different refusals, and they must not share a sentence. 8.3 % is
// INSIDE the published 2–10 %; it is refused only because this app sizes the
// step by the lift. A message quoting "2–10 % is the recommended step" while
// refusing 8.3 % would contradict itself on screen.
const isoRefusal = suggestProgression({
  history: [S(60, 12), S(60, 12)], exercise: PUSHDOWN, step: 5,
});
const compoundOK = suggestProgression({
  history: [S(60, 12), S(60, 12)], exercise: BENCH, step: 5,
});
ok(isoRefusal.kind === 'noIncrement' && compoundOK.kind === 'load',
   'the same 60 lb and the same sessions: a compound takes the step, a single-muscle lift does not');
ok(/sized by the lift/.test(isoRefusal.why) && !/past the recommended/.test(isoRefusal.why),
   'and the isolation refusal explains the LIFT — it never claims 8.3 % is outside a band it is '
   + 'plainly inside');
ok(/past the recommended/.test(tooSmall.why) && !/sized by the lift/.test(tooSmall.why),
   'while 16.7 % is refused for the plain reason that it is past the band');

/* ---- microplates change the answer, so "no honest increment" is not a dead end ---- */

const withMicro = suggestProgression({
  history: [S(30, 12), S(30, 12)], exercise: PUSHDOWN, step: 1.25,
});
ok(withMicro.kind === 'load' && withMicro.addedWeight === 1.25,
   'with microplates the same lifter at the same 30 lb DOES get a load increase — 4.2 %');

/* ================================================================== *
 * ⚠️⚠️ REFUSAL 3 — the suggestion cannot hear about the goal
 *
 * docs/goals-plan.md §3.1. Load that follows a deadline pushes hardest at
 * exactly the wrong moment: somebody who has missed two weeks is "behind", and
 * handing them a HEAVIER weight for it is backwards. This is the only failure
 * mode in this app that could hurt a person rather than merely be wrong on a
 * screen.
 *
 * The refusal is structural — js/progression.js imports nothing from Goals and
 * has no clock — but a later session could wire one in through the options bag
 * without noticing, so this feeds every goal-shaped field there is straight
 * into the call and requires the answer not to move by one byte.
 * ================================================================== */

const HISTORY = [S(100, 12), S(100, 12)];
const pressure = [
  // No goal at all.
  {},
  // A goal just set, twelve weeks of room, nothing gained yet.
  { goal: freshGoal, today: '2026-08-20', daysLeft: 84, behindBy: 0, progress: goalProgress(freshGoal, 200, '2026-08-20') },
  // ⚠️ The dangerous one. Four days left, not a pound added, and a bigger goal
  // than they started with. This is the person a calendar-driven rule would
  // load up, and it is exactly the person who should not be.
  { goal: freshGoal, today: '2026-11-07', daysLeft: 4, behindBy: 25, progress: goalProgress(freshGoal, 200, '2026-11-07') },
  { goal: bigger, today: '2026-11-07', daysLeft: 4, behindBy: 60, ambition: 'ambitious' },
  // And somebody who has already been away — the lay-off case the plan names.
  { goal: staleGoal, today: '2026-11-07', daysLeft: 4, behindBy: 25, weeksMissed: 2 },
];

const suggestions = pressure.map((extra) =>
  suggestProgression({ history: HISTORY, exercise: BENCH, step: 5, ...extra }));
const baseline = JSON.stringify(suggestions[0]);

ok(suggestions.every((s) => JSON.stringify(s) === baseline),
   '⚠️ identical training gives an identical suggestion whether there is no goal at all or four '
   + 'days left on one nothing has been added to');
ok(suggestions[0].kind === 'load' && suggestions[0].weight === 105,
   'and the answer is the one the last two sessions earn — +5 lb, from the training and nothing else');

// ⚠️ VACUITY GUARD, and the same shape as the one on refusal 1. If this
// function returned a constant, everything above would pass and mean nothing.
// Three things that DO move it, each of them a fact about the TRAINING.
const oneFewerSession = suggestProgression({ history: [S(100, 12)], exercise: BENCH, step: 5 });
const lighterPlates = suggestProgression({ history: HISTORY, exercise: BENCH, step: 2.5 });
const otherLift = suggestProgression({ history: HISTORY, exercise: PUSHDOWN, step: 5 });
ok(JSON.stringify(oneFewerSession) !== baseline,
   'one session at the top instead of two DOES change the answer — so the test above is not vacuous');
ok(JSON.stringify(lighterPlates) !== baseline, 'and so do the plates available');
ok(JSON.stringify(otherLift) !== baseline, 'and so does which lift it is');

// The refusal at the level of the module rather than the call: it cannot read a
// goal because it cannot see one.
const progressionSource = await import('node:fs')
  .then((fs) => fs.readFileSync(new URL('../js/progression.js', import.meta.url), 'utf8'));
const imports = progressionSource.match(/^import .*$/gm) || [];
ok(!imports.some((line) => /goals\.js|store\.js/.test(line)),
   'js/progression.js imports neither the goals model nor the store — the refusal is structural');
ok(!/Date\.now|new Date\(/.test(progressionSource),
   'and it has no clock of its own — the one temporal fact it takes is a day count measured by the '
   + 'caller, so there is nothing in here for a deadline to be compared against');

/* ================================================================== *
 * The safety envelope — swept, not spot-checked
 * ================================================================== */

// ⚠️ THE ONE ASSERTION THAT WOULD CATCH ANYTHING GOING WRONG HERE. Whatever the
// rule computes, for any lift at any weight from any history, it may never
// propose more than the top of the published band. If a future change breaks
// the increment logic in a way the examples above miss, this is what fires.
let worstJump = 0;
let unearned = 0;
let repsFell = 0;
for (let w = 10; w <= 500; w += 5) {
  for (const ex of [BENCH, PUSHDOWN, PEC_DECK]) {
    for (const hist of [[S(w, 10)], [S(w, 12)], [S(w, 12), S(w, 12)], [S(w, 20), S(w, 20)]]) {
      const s = suggestProgression({ history: hist, exercise: ex, step: 5 });
      if (!s) continue;
      worstJump = Math.max(worstJump, s.weight / w - 1);
      // A load increase may ONLY come from two consecutive sessions at the top.
      if (s.weight > w && !(hist.length === 2 && s.kind === 'load')) unearned++;
      if (s.kind !== 'load' && s.reps < sessionSummary(hist[0]).repsAtTop) repsFell++;
    }
  }
}
ok(worstJump <= LOAD_BAND.max + 1e-9,
   `over every lift from 10 to 500 lb the heaviest jump proposed is ${(worstJump * 100).toFixed(1)} %, `
   + 'inside the 10 % ceiling');
ok(unearned === 0,
   'and not one of them raises the weight without two consecutive sessions at the top of the range');
ok(repsFell === 0,
   'nor lowers the rep target while the load is being held — reps only fall when the weight rises');

/* ================================================================== *
 * ⚠️⚠️ THE CLOSED LOOP — the rule must survive its OWN advice
 *
 * Every test above hands the module a history somebody else wrote. None of them
 * asked the question that actually matters in the app: if a lifter does exactly
 * what the app tells them, session after session, does the app still agree with
 * itself?
 *
 * It did not. `REP_BANDS` share their boundaries (8 tops 6–8 and bottoms 8–12;
 * so do 12 and 15) and `repRangeFor` resolves a boundary DOWNWARDS on purpose.
 * So "+5 lb and back to 8 reps", said with range 8–12, came back next session as
 * 8 reps read cold — the top of 6–8 — and the lifter was already at the top of a
 * range they had never chosen. Two sessions later, another load increase.
 *
 * Measured: an obedient lifter starting at 185 × 10 in the 8–12 range was
 * carried to 200 × 6 in twelve sessions, taking weight every second session and
 * never seeing 8–12 again. Not a display bug — a module whose stated bias is to
 * err small was adding load roughly twice as often as double progression says.
 *
 * The fix is `trainingRange()`: read the range across the recent history, so the
 * app's own instruction cannot erase the range that produced it.
 * ================================================================== */

// Drive the loop the way the app does: suggest, obey, feed it back.
const walk = (startWeight, startReps, n = 12) => {
  const setsOf = (w, r) => S(w, r);
  const hist = [setsOf(startWeight, startReps)];
  const seen = [];
  for (let i = 0; i < n; i++) {
    const s = suggestProgression({ history: hist, exercise: BENCH, step: 5 });
    if (!s) break;
    seen.push(s);
    hist.unshift(setsOf(s.weight, s.reps));      // the lifter does exactly as told
  }
  return seen;
};

const obedient = walk(185, 10);
ok(obedient.every((s) => s.range.join('-') === '8-12'),
   '⚠️ a lifter who does exactly what the app says stays in the range the app put them in — '
   + 'over twelve sessions the range never once moves off 8–12');
ok(obedient.filter((s) => s.kind === 'load').length === 2,
   'and takes two load increases in twelve sessions, not six — one full walk up the range each time');

// ⚠️ VACUITY GUARD. If `range` were pinned to a constant the assertion above
// would pass and mean nothing. A lifter genuinely training in a different range
// must still get a different one.
ok(walk(300, 4)[0].range.join('-') === '3-5',
   'somebody training in fours is read as 3–5, so the walk above is not asserting a constant');
ok(walk(60, 16)[0].range.join('-') === '15-20', 'and somebody training in sixteens as 15–20');

/* ==================================================================
 * ⚠️ PLAY EVERY BRANCH FORWARD, NOT THE ONE THAT BROKE — 2026-08-22
 *
 * The walk above exists because of the 2026-08-20 bug, and it walks the BENCH,
 * which is the branch that bug was in. The edge-case review played the other
 * two forward and found both ratcheting reps with no terminal state at all:
 *
 *   Lateral Raise 20 lb, obeyed 30 times  →  20 × 37     (kind: noIncrement)
 *   Barbell Curl 60 lb, obeyed 30 times   →  60 × 34     (kind: noIncrement)
 *   Push-Up, obeyed 30 times              →  45 reps     (kind: repsOnly)
 *
 * Both branches returned `repsAtTop + 1` unconditionally. Past 20 there is no
 * REP_BAND left, so the suggestion printed a range it was already outside of;
 * and past MAX_EVIDENCE_REPS the app's own D5 gate refuses the set as evidence,
 * so its advice walked the exercise out of its own muscle map.
 *
 * The fix is a ceiling that REFUSES rather than steps smaller — the same shape
 * as the lay-off branch and as `noIncrement` itself.
 * ================================================================== */
{
  // A 20 lb dumbbell: 5 lb is a 25 % jump, so `noIncrement` is the only branch
  // this lift can ever reach, forever. That is what made it ratchet.
  const DUMBBELL = { id: 'x-lat', name: 'Lateral Raise', muscle: 'Shoulders', fields: ['weight', 'reps'] };
  const PUSHUP = { id: 'x-push', name: 'Push-Up', muscle: 'Chest', fields: ['reps'] };

  const walkEx = (exercise, w, r, n = 40) => {
    const hist = [S(w, r)];
    let last = null;
    for (let i = 0; i < n; i++) {
      const s = suggestProgression({ history: hist, exercise, step: 5 });
      if (!s) break;
      last = s;
      hist.unshift(S(s.weight == null ? 0 : s.weight, s.reps));
    }
    return { last, reps: last && last.reps, weight: last && last.weight };
  };

  const lat = walkEx(DUMBBELL, 20, 10);
  ok(lat.reps <= 20,
     `⚠️ forty obedient sessions on a 20 lb lateral raise end at ${lat.reps} reps, not 37 — `
     + 'the rep ladder has a top');
  ok(lat.last.kind === 'repCeiling' && lat.weight === 20,
     'and it stops by REFUSING — last time\'s numbers and a reason, never a smaller step it cannot justify');
  ok(/microplates|extra set|harder variation/i.test(lat.last.why),
     'and it names the ways on from there rather than leaving somebody stuck at the top of a range');

  const push = walkEx(PUSHUP, 0, 15);
  ok(push.reps <= 20 && push.last.kind === 'repCeiling',
     `⚠️ and so does the reps-only branch — push-ups end at ${push.reps}, not 45`);

  // ⚠️ THE CEILING MUST NOT BLOCK A REAL LOAD STEP. A bench at the top of its
  // range with an honest increment available must still get the weight, or the
  // fix would have replaced a runaway with a dead end — which is worse, because
  // it would stop progression for everybody who can actually progress.
  // Two sessions at the top, because the 2-for-2 rule is what earns the step.
  const heavy = suggestProgression({ history: [S(185, 20), S(185, 20)], exercise: BENCH, step: 5 });
  ok(heavy.kind === 'load' && heavy.weight > 185,
     'a lift with an honest increment available still takes the weight at 20 reps — '
     + 'the ceiling stops the rep ladder, not progression');

  // ⚠️ And the ceiling's advice must fit the lift it is talking about. A
  // dumbbell holder is not to be told to weigh themselves and buy a belt.
  const dumbbellCeiling = suggestProgression({ history: [S(20, 20), S(20, 20)], exercise: DUMBBELL, step: 5 });
  ok(!/weigh-in|belt/i.test(dumbbellCeiling.why),
     'and a loaded lift at the ceiling is not given the bodyweight advice');

  // Vacuity guard: below the ceiling the rep step is untouched.
  const below = suggestProgression({ history: [S(20, 12), S(20, 12)], exercise: DUMBBELL, step: 5 });
  ok(below.kind === 'noIncrement' && below.reps === 13,
     'and below the ceiling another rep is still exactly what it asks for');
}

// The property underneath, swept: history may only ever WIDEN the range upward.
// That is what makes this fix incapable of causing harm — a higher range makes
// the top harder to reach and drops the reps less far when it is reached, so it
// can only ever withhold a load increase, never bring one forward. Same
// asymmetry as the lay-off rule.
let narrowed = 0;
let broughtForward = 0;
for (let w = 20; w <= 400; w += 10) {
  for (let r = 3; r <= 20; r++) {
    for (const older of [3, 6, 8, 10, 12, 15, 20]) {
      const alone = suggestProgression({ history: [S(w, r)], exercise: BENCH, step: 5 });
      const withPast = suggestProgression({
        history: [S(w, r), S(w - 5, older)], exercise: BENCH, step: 5,
      });
      if (!alone || !withPast) continue;
      if (withPast.range[1] < alone.range[1]) narrowed++;
      if (withPast.weight > alone.weight) broughtForward++;
    }
  }
}
ok(narrowed === 0,
   '⚠️ over every weight, rep count and past session, adding history never NARROWS the range');
ok(broughtForward === 0,
   'and never produces a heavier suggestion than the same session read alone — so reading the '
   + 'history can only ever hold the weight back, which is the only safe direction');

ok(trainingRange([S(190, 8), S(185, 12)]).join('-') === '8-12',
   'the range is read across sessions: 8 reps today after 12 last time is still 8–12 training');
ok(trainingRange([S(190, 8)]).join('-') === '6-8',
   'while 8 reps with no history behind it reads cold as the top of 6–8, unchanged');
ok(trainingRange([]) === repRangeFor(0) && trainingRange(null).join('-') === '3-5',
   'and an empty history falls to the lowest band rather than throwing');

/* ================================================================== *
 * ⚠️⚠️ REFUSAL 4 — time may SUPPRESS a suggestion, never create or raise one
 *
 * §3.1's objection was never that clocks are forbidden — it was that time must
 * not make the app ask for MORE. A gap does exactly the same harm a deadline
 * would: handing somebody a heavier weight than they have touched in a month is
 * the failure this feature exists to avoid, arriving from the other side.
 *
 * The threshold is ours (research.md §12.4 records that the position stand says
 * nothing about coming back from a missed block), so the assertions below are
 * mostly a PROPERTY rather than cases — the property holds whatever number is
 * picked, and it is the thing that actually keeps anybody safe.
 * ================================================================== */

const AT_TOP_TWICE = [S(100, 12), S(100, 12)];
const noGapCall = suggestProgression({ history: AT_TOP_TWICE, exercise: BENCH, step: 5 });
const longGap = suggestProgression({
  history: AT_TOP_TWICE, exercise: BENCH, step: 5, daysSinceLast: 40,
});

ok(noGapCall.kind === 'load' && longGap.kind === 'layoff',
   'the same two sessions earn a load increase today and do NOT after six weeks away');
ok(longGap.weight === 100 && longGap.reps === 12,
   'what comes back is last time\'s numbers — the app\'s behaviour before progression existed');
ok(/rather than a step up/.test(longGap.why),
   'and it says so in one sentence rather than silently withholding');
ok(!/%|lighter|drop|reduce|deload/i.test(longGap.why),
   '⚠️ and prescribes NO reduction — nobody has measured one, so it refuses rather than inventing');
// ⚠️ Tested against a set list the lay-off's own numbers would OVERWRITE, not
// against the history it came from. Handed [100 x 3] with a lay-off carrying 12
// reps, the general path's "never lower the reps" rule would happily write 12 —
// so this is the case that proves the refusal is a refusal rather than an
// arithmetic coincidence. An earlier version of this test used the matching
// history and passed with the guard deleted.
ok(JSON.stringify(applySuggestion([{ weight: 100, reps: 3 }], longGap))
   === JSON.stringify([{ weight: 100, reps: 3 }]),
   'laid over the sets it changes nothing at all, even where it plainly could');
ok(JSON.stringify(applySuggestion([{ weight: 100, reps: 12 }], longGap))
   === JSON.stringify([{ weight: 100, reps: 12 }]),
   'and leaves an untouched list untouched, which is what makes it a refusal');

ok(LAYOFF_DAYS === 21, 'the threshold is a round three weeks');
ok(suggestProgression({ history: AT_TOP_TWICE, exercise: BENCH, step: 5,
  daysSinceLast: LAYOFF_DAYS - 1 }).kind === 'load',
   'a fortnight is inside plenty of people\'s normal cadence and does not trip it');
ok(suggestProgression({ history: AT_TOP_TWICE, exercise: BENCH, step: 5,
  daysSinceLast: LAYOFF_DAYS }).kind === 'layoff', 'three weeks does');
for (const unknown of [null, undefined, NaN, 'soon', -30]) {
  ok(suggestProgression({ history: AT_TOP_TWICE, exercise: BENCH, step: 5,
    daysSinceLast: unknown }).kind === 'load',
     `an unusable gap (${String(unknown)}) suppresses nothing rather than guessing`);
}

// ⚠️ THE PROPERTY, swept. Whatever the threshold, whatever the lift, whatever
// the history: adding a gap can never come back with more weight than the same
// call with no gap at all. This is what makes the asymmetry a rule rather than
// a condition on one branch.
let heavierWithGap = 0;
let raisedByGap = 0;
let suppressed = 0;
let gapCalls = 0;
for (let w = 10; w <= 500; w += 5) {
  for (const ex of [BENCH, PUSHDOWN, PEC_DECK]) {
    for (const hist of [[S(w, 10)], [S(w, 12)], [S(w, 12), S(w, 12)], [S(w, 20), S(w, 20)]]) {
      const plain = suggestProgression({ history: hist, exercise: ex, step: 5 });
      for (const gap of [0, 1, 6, 13, 20, 21, 30, 400, 5000]) {
        const g = suggestProgression({ history: hist, exercise: ex, step: 5, daysSinceLast: gap });
        gapCalls++;
        if (!plain && g) raisedByGap++;                       // created from nothing
        if (plain && g && g.weight > plain.weight + 1e-9) heavierWithGap++;
        if (plain && g && JSON.stringify(g) !== JSON.stringify(plain)) suppressed++;
      }
    }
  }
}
ok(heavierWithGap === 0,
   `⚠️ over ${gapCalls} calls, a gap NEVER produces a heavier suggestion than the same history `
   + 'with no gap');
ok(raisedByGap === 0, 'and never conjures a suggestion where there was none');
// Vacuity guard: if the gap argument were ignored entirely the property above
// would hold trivially, so it has to actually change some of them.
ok(suppressed > 0,
   `and it does change ${suppressed} of them — so the property is a result, not an unread argument`);

/* ================================================================== *
 * Movements with no weight to add
 * ================================================================== */

// ⚠️ Bodyweight work stopped being second-class in this app the day pull-ups
// started rating a muscle, and "one more rep" is just this rule with the load
// step removed — it is the only progression a push-up has.
const PUSHUP = exOf('Push-Up');       // reps only, no weight field at all
const PULLUP = exOf('Pull-Up');       // weight + reps, but the weight is ADDED load

const bw = suggestProgression({ history: [S(0, 8)], exercise: PUSHUP, step: 5 });
ok(bw && bw.kind === 'repsOnly' && bw.reps === 9 && bw.weight === null,
   'a push-up gets one more rep than last time, and no weight at all');
ok(Boolean(bw) && /no weight to add/.test(bw.why),
   'and says why that is the only step available');

// ⚠️ The trap: a pull-up records weight + reps and the weight is zero, so
// filtering sessions on `weight > 0` threw away every bodyweight movement in
// the library and returned "nothing to say" for a session that plainly happened.
const chin = suggestProgression({
  history: [[{ weight: 0, reps: 10 }, { weight: 0, reps: 8 }]], exercise: PULLUP, step: 5,
}) || {};
ok(chin.kind === 'repsOnly' && chin.reps === 9,
   'an unweighted pull-up is the same case even though it HAS a weight field — it is 0');
ok(Boolean(sessionSummary([{ weight: 0, reps: 10 }])
   && sessionSummary([{ weight: 0, reps: 10 }]).weightless === true),
   'the summary says outright that there is no load here');
ok((suggestProgression({ history: [S(90, 12), S(90, 12)], exercise: PULLUP, step: 5 }) || {}).kind
   === 'load',
   'while a WEIGHTED pull-up goes back to the ordinary rule — there is a load to step now');

/* ---- ⚠️ the band is a percentage of what you ACTUALLY lift ---- */

// This is the interaction with the body-weight work that landed alongside this
// feature, and it is the difference between a useful rule and a broken one on
// every pull-up, chin-up and dip in the library. `totalResistance()` in
// e1rm.js is imported rather than copied — one body-weight table, sourced line
// by line, not two that drift.
const beltBlind = suggestProgression({
  history: [S(25, 12), S(25, 12)], exercise: PULLUP, step: 5,
});
const beltSeeing = suggestProgression({
  history: [S(25, 12), S(25, 12)], exercise: PULLUP, step: 5, bodyWeight: 180,
});
ok(beltBlind.kind === 'noIncrement' && beltBlind.smallestPct === 20,
   'without a body weight, 5 lb on a 25 lb dip belt reads as a 20 % jump and is refused');
ok(beltSeeing.kind === 'load' && beltSeeing.addedWeight === 5 && beltSeeing.pct === 2.4,
   '⚠️ with one, the same 5 lb is 2.4 % of ~205 lb of real resistance and is exactly the step the '
   + 'position stand describes');
ok(beltSeeing.resistance > 200 && beltSeeing.resistance < 210,
   'and the suggestion carries what it measured against, so the number can be checked');
ok(/205 lbs you really lift/.test(beltSeeing.why),
   'and the sentence NAMES the 205 lbs, so 2.4 % can be checked rather than taken on trust — '
   + 'otherwise 2.4 % of a 25 lb belt reads as nonsense');

// A pull-up at body weight is not "no load", it is a load the app can now name.
const bwPull = suggestProgression({
  history: [S(0, 12), S(0, 12)], exercise: PULLUP, step: 5, bodyWeight: 180,
}) || {};
ok(bwPull.kind === 'load' && bwPull.weight === 5,
   'twelve strict pull-ups twice over earns a belt rather than a fourteenth rep');
ok(/a belt or a dumbbell between your feet/.test(bwPull.why || ''),
   'and says how you actually add five pounds to a pull-up, which is not obvious (D8)');
ok(!/belt/.test(beltSeeing.why),
   'while somebody already wearing one is not told what a belt is');
ok(/at body weight/.test((suggestProgression({
  history: [[{ weight: 0, reps: 10 }, { weight: 0, reps: 8 }]],
  exercise: PULLUP, step: 5, bodyWeight: 180,
}) || {}).why || ''),
   'and mid-range it says "at body weight" rather than the nonsense "at 0 lbs"');

// ⚠️ ISOLATION CHECK. Everything that is not one of the seven body-weight
// movements must be completely unaffected — `totalResistance` returns null for
// them, so knowing a body weight cannot move a barbell suggestion by a byte.
for (const ex of [BENCH, PUSHDOWN, PEC_DECK]) {
  const blind = suggestProgression({ history: [S(100, 12), S(100, 12)], exercise: ex, step: 5 });
  const seeing = suggestProgression({
    history: [S(100, 12), S(100, 12)], exercise: ex, step: 5, bodyWeight: 180,
  });
  ok(JSON.stringify(blind) === JSON.stringify(seeing),
     `body weight changes nothing at all for ${ex.name} — it is not part of that lift`);
}

/* ================================================================== *
 * AN ASSIST MACHINE RUNS THE OTHER WAY
 * ================================================================== */
//
// ⚠️ THIS SECTION REPLACES TWO ASSERTIONS THAT PASSED WHILE THE BUG WAS LIVE.
// They said "no shipped exercise is flagged as assisted today, so that branch is
// unreachable" and "the guard is in place for when one is" — both true, both
// green, and both about a guard keyed on a flag that `Assisted Pull-Up` could
// never set because it had no fraction entry. The exercise was in the app the
// whole time, going through the ORDINARY load rule, where adding weight reads as
// a harder set. Tim did 70 lb assisted pull-ups in a gym on 2026-08-24 and was
// two good sessions from being told "+5 lb and back to 6 reps".
//
// ⚠️ SO NOTHING HERE ASSERTS ON THE SOURCE ANY MORE. A regex proving a guard
// exists cannot tell you whether anything reaches it; only driving the real
// function with the real exercise can. Same lesson as the rep ceiling, arriving
// from the other side: the earlier test was watching the wrong thing entirely.
const ASSISTED = exOf('Assisted Pull-Up');
const assistedFlagged = BUILT_IN_EXERCISES
  .map((e) => ({ e, r: totalResistance(e, 10, 180) }))
  .filter((x) => x.r && x.r.assist)
  .map((x) => x.e.name);
ok(assistedFlagged.join() === 'Assisted Pull-Up',
   '⚠️ exactly one shipped exercise is flagged assisted, so the branch below is REACHABLE');

const assistTop = suggestProgression({
  history: [S(70, 12), S(70, 12)], exercise: ASSISTED, step: 5, bodyWeight: 180,
});
ok(assistTop && assistTop.kind === 'load' && assistTop.weight === 65,
   '⚠️ top of the range twice takes 5 lbs OFF the stack — 70 becomes 65, never 75');
ok(assistTop && assistTop.weight < 70,
   'which is the whole assertion: the number in the box goes DOWN as the lifter gets stronger');
ok(assistTop && /less help/.test(assistTop.headline) && /115/.test(assistTop.why),
   'and the sentence names the resistance that ROSE — 110 to 115 — not just the setting that fell');
ok(assistTop && !/\bat 70\b/.test(assistTop.why + assistTop.headline),
   '⚠️ and never calls the assistance a weight lifted: "at 70 lbs" is a lie on this machine');

// Mid-range and at-the-top-once hold the help steady and ask for a rep, exactly
// like every other lift. Only the direction of the load step is special.
const assistMid = suggestProgression({
  history: [S(70, 9)], exercise: ASSISTED, step: 5, bodyWeight: 180,
});
ok(assistMid && assistMid.weight === 70 && assistMid.reps === 10,
   'below the top of the range the help is held and a rep is added, as anywhere else');
ok(assistMid && /with 70 lbs of help/.test(assistMid.why),
   'and it is described as help rather than as load');

// ⚠️ THE FLOOR. `inc` is sized against the resistance, so on a lifter down to
// their last few pounds of assistance it is bigger than the assistance itself —
// and 3 minus 5 is not a −2 lb setting, it is an unassisted pull-up.
const assistFloor = suggestProgression({
  history: [S(3, 12), S(3, 12)], exercise: ASSISTED, step: 5, bodyWeight: 180,
});
ok(assistFloor && assistFloor.weight === 0,
   '⚠️ 3 lbs of help minus a 5 lb step is clamped to ZERO, never to a negative setting');
ok(assistFloor && /no help/.test(assistFloor.headline),
   'and it says so, because taking the last of it off is the thing being proposed');

// And the terminal state, which names another exercise rather than inventing a
// number — the same shape as the rep ceiling and the lay-off branch.
const assistGone = suggestProgression({
  history: [S(0, 12), S(0, 12)], exercise: ASSISTED, step: 5, bodyWeight: 180,
});
ok(assistGone && assistGone.kind === 'assistGone' && assistGone.weight === 0,
   '⚠️ at zero help twice at the top there is no step left, and it refuses rather than inventing one');
ok(assistGone && /Pull-Up/.test(assistGone.why) && /belt|dumbbell/.test(assistGone.why),
   'and it names the way on — log these as Pull-Up, then add a belt');

// ⚠️ PLAYED FORWARD THROUGH FORTY SESSIONS, obeying it every time. This is the
// test the rep-ceiling bug taught this project to write, applied to the branch
// that did not exist when that lesson was learned: a rule that reads its own
// output has to be walked to its terminal state, not sampled once.
let assistAt = 120;
let assistReps = 12;
let assistSaw = 0;
let assistWentUp = false;
for (let i = 0; i < 40; i++) {
  const s = suggestProgression({
    history: [S(assistAt, assistReps), S(assistAt, assistReps)],
    exercise: ASSISTED, step: 5, bodyWeight: 180,
  });
  if (!s) break;
  if (s.weight != null && s.weight > assistAt) assistWentUp = true;
  if (s.kind === 'assistGone') { assistSaw = i; break; }
  assistAt = s.weight == null ? assistAt : s.weight;
  assistReps = Math.max(s.reps, 12);
}
ok(!assistWentUp,
   '⚠️ over forty obeyed sessions it NEVER proposes more assistance — not once, on any branch');
ok(assistAt === 0 && assistSaw > 0,
   `and it walks 120 lbs of help down to zero and then stops (${assistSaw} sessions), rather than going negative`);
ok(assistAt >= 0, 'the setting is never negative at any point on that walk');

// The swept property again, in the units that matter here: the step is never
// more than the ceiling of what is really being lifted, at any body weight.
let bwWorst = 0;
let bwChecked = 0;
for (const ex of [PULLUP, exOf('Chin-Up'), exOf('Chest Dip')]) {
  for (const bwt of [110, 150, 180, 240, 300]) {
    for (const added of [0, 10, 25, 45, 90]) {
      const s = suggestProgression({
        history: [S(added, 12), S(added, 12)], exercise: ex, step: 5, bodyWeight: bwt,
      });
      if (!s || s.kind !== 'load') continue;
      bwChecked++;
      bwWorst = Math.max(bwWorst, s.addedWeight / s.resistance);
    }
  }
}
ok(bwChecked > 0 && bwWorst <= LOAD_BAND.max + 1e-9,
   `across ${bwChecked} body-weight cases the heaviest step is `
   + `${(bwWorst * 100).toFixed(1)} % of real resistance, still inside the band`);

const bwApplied = applySuggestion([{ reps: 10 }, { reps: 8 }], bw);
ok(bwApplied.map((s) => s.reps).join(',') === '10,9',
   'laid over the sets, only the short one moves — with no weight to match on, every set is a '
   + 'working set');
ok((suggestProgression({ history: [S(0, 8)], exercise: PUSHUP, step: 5, daysSinceLast: 40 })
   || {}).kind === 'layoff',
   'and a lay-off suppresses this one too, for the same reason');

/* ---- laying the suggestion over the pre-filled sets ---- */

const prefilled = [
  { weight: 135, reps: 5 },      // warm-up
  { weight: 225, reps: 10 },
  { weight: 225, reps: 12 },
];
const held = applySuggestion(prefilled, suggestProgression({
  history: [S(225, 10)], exercise: BENCH, step: 5,
}));
ok(held.length === 3 && held[0].weight === 135 && held[0].reps === 5,
   'a warm-up set is left exactly as it was — only the working weight is touched');
ok(held[1].reps === 11, 'the set that fell short gets the extra rep');
ok(held[2].reps === 12,
   '⚠️ and the set that already beat the suggestion KEEPS its own number — holding the load never '
   + 'proposes fewer reps than last time');
ok(prefilled[1].reps === 10, 'the original list is not mutated');

const raised = applySuggestion(prefilled, suggestProgression({
  history: [S(225, 12), S(225, 12)], exercise: BENCH, step: 5,
}));
ok(raised[0].weight === 135 && raised[1].weight === 230 && raised[2].weight === 230,
   'a load increase moves the working sets and leaves the warm-up alone');
ok(raised[1].reps === 8 && raised[2].reps === 8,
   'and reps DO come down on a load increase, which is the other half of double progression');
ok(JSON.stringify(applySuggestion(prefilled, null)) === JSON.stringify(prefilled),
   'no suggestion changes nothing');

/* ---- when there is nothing honest to say ---- */

ok(suggestProgression({ history: [], exercise: BENCH, step: 5 }) === null,
   'the first time an exercise is logged there is no suggestion at all');
ok(suggestProgression({ history: [S(100, 10)], exercise: RUNNING, step: 5 }) === null,
   'and an exercise measured in distance and time has no double progression to offer');
ok(suggestProgression({ history: [[{ weight: 0, reps: 0 }]], exercise: BENCH, step: 5 }) === null,
   'nor does a session with no numbers in it');
ok(suggestProgression({ history: [S(100, 12), S(100, 12)], exercise: BENCH, step: 0 }).kind
   === 'noIncrement',
   'and with no usable increment at all it says so rather than dividing by zero');

/* ---- history: this workout first, the exercise anywhere second ---- */

const SESSIONS = [
  { workoutId: 'w2', entries: [{ exerciseId: 'bench', sets: S(999, 1) }] },
  { workoutId: 'w1', entries: [{ exerciseId: 'bench', sets: S(100, 12) }] },
  { workoutId: 'w1', entries: [{ exerciseId: 'bench', sets: S(95, 12) }] },
];
const ownHistory = historyFor(SESSIONS, { exerciseId: 'bench', workoutId: 'w1' });
ok(ownHistory.length === 2 && ownHistory[0][0].weight === 100,
   'history prefers this workout\'s own sessions, newest first');
ok(historyFor(SESSIONS, { exerciseId: 'bench', workoutId: 'nope' }).length === 3,
   'and falls back to the exercise anywhere only when this workout has none');
ok(historyFor(SESSIONS, { exerciseId: 'nothing', workoutId: 'w1' }).length === 0,
   'an exercise never logged has no history rather than somebody else\'s');

// The date comes back as the stored string and is never turned into a gap here
// — that needs today, and today is a clock.
const DATED = [
  { workoutId: 'w1', date: '2026-08-01', entries: [{ exerciseId: 'bench', sets: S(100, 12) }] },
  { workoutId: 'w1', date: '2026-07-01', entries: [{ exerciseId: 'bench', sets: S(95, 12) }] },
];
ok(lastSessionDate(DATED, { exerciseId: 'bench', workoutId: 'w1' }) === '2026-08-01',
   'the last day this exercise was done comes back as the stored day, unparsed');
ok(lastSessionDate(DATED, { exerciseId: 'nothing', workoutId: 'w1' }) === null,
   'and is null when it has never been done, which suppresses nothing');

/* ---- what the goals screen is allowed to say about weights ---- */

ok(PROGRESSION_EXPLAINER.some((t) => /never touches that number/.test(t)),
   'the goals screen states outright that the goal does not set the weights');
ok(PROGRESSION_EXPLAINER.some((t) => /deadline/.test(t) && /backwards/.test(t)),
   'and says why — a deadline-driven suggestion would push hardest on somebody coming back');
ok(PROGRESSION_EXPLAINER.some((t) => /only ever proposes/.test(t)),
   'and that it proposes rather than imposes, which is the other half of §8.2');
ok(PROGRESSION_EXPLAINER.some((t) => /only ever take a step away/.test(t)
   && /nobody has measured by how much/.test(t)),
   'and that time can only withhold — including that it will not tell you to go lighter, because '
   + 'that would be a number nobody has measured');

console.log(`\n${fails === 0 ? 'All checks passed.' : fails + ' FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
