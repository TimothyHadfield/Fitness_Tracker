// RANKING THE ABS — Core's key lift, its own spread, and what it still refuses.
//   node tests/core-rating.test.mjs
//
// No DOM, no store. Built 2026-09-04 on Tim's instruction: *"set a good 1RM
// estimator for the ab muscle group for a specific exercise… This makes the ab
// muscle group nearly identical to any other muscle group and how it operates
// but with a little less reliability."*
//
// 🚨 THE POINT OF THIS FILE IS THE SECOND HALF OF THAT SENTENCE. Making Core
// rank at all is four lines of table. Making it rank *and say how much less it
// should be trusted* is the work, and it is the part that silently rots if
// nobody pins it — a later session tidying `standardQuality` away would leave a
// number that looks exactly as authoritative as the bench press and is not.

const S = await import('../js/strength-standards.js');
const ME = await import('../js/muscle-evidence.js');
const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { e1rm } = await import('../js/e1rm.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);

const MALE = { gender: 'male', bodyWeight: 180, age: 30 };
const FEMALE = { gender: 'female', bodyWeight: 140, age: 30 };

/* ================= Core is a ranked muscle now ================= */
{
  ok(Boolean(S.MUSCLE_LIFTS.Core), 'Core has a key lift');
  ok(S.MUSCLE_LIFTS.Core.lift === 'Cable Crunch',
     `and it is the Cable Crunch (${S.MUSCLE_LIFTS.Core.lift})`);
  ok(Boolean(byName('Cable Crunch')),
     '⚠️ which exists in the library — a key lift naming an exercise nobody can log rates nothing');
  ok(!S.UNRANKABLE.includes('Core'), 'Core has left UNRANKABLE');
  ok(S.UNRANKABLE.includes('Neck'),
     '🛑 and Neck has NOT — there are still no published neck norms, and this was not a general loosening');
  ok(S.canRank('Core') && !S.canRank('Neck'), 'canRank() agrees with both');
}

/* ================= the published anchors, reproduced =================
 *
 * 🚨 THE LOAD-BEARING TEST IN THIS FILE. It pins the median and the spread
 * TOGETHER, against the numbers they were pulled from — Strength Level's Cable
 * Crunch table, 12,596 qualifying results (docs/research.md §14). A wrong median
 * moves the middle; a wrong sigma moves the tails; and either one alone would
 * still let a casual "does it produce a level?" check pass.
 *
 * ⚠️ THE TOLERANCE IS THE MODEL'S, NOT A FUDGE. A log-normal cannot pass exactly
 * through five published anchors, so the bar is that Core's error is no worse
 * than the error the app already accepts on a lift nobody disputes — the bench
 * press, whose own anchors miss by up to 5 points. Measured, not assumed: the
 * bench figures are computed right here and Core is held to them.
 */
{
  const CORE_M = [[58, 5], [98, 20], [151, 50], [216, 80], [288, 95]];
  const CORE_F = [[36, 5], [65, 20], [106, 50], [157, 80], [214, 95]];
  const BENCH_M = [[127, 5], [169, 20], [220, 50], [277, 80], [339, 95]];

  const err = (rows, muscle, profile) => Math.max(...rows.map(([w, p]) =>
    Math.abs(S.percentileFor(w, muscle, profile) - p)));

  const benchErr = err(BENCH_M, 'Chest', MALE);
  const coreErrM = err(CORE_M, 'Core', MALE);
  const coreErrF = err(CORE_F, 'Core', FEMALE);

  ok(coreErrM <= benchErr + 0.5,
     `Core reproduces its published anchors as well as the bench does (worst miss `
     + `${coreErrM.toFixed(1)} points vs the bench's ${benchErr.toFixed(1)})`);
  ok(coreErrF <= benchErr + 0.5,
     `and the same for women (worst miss ${coreErrF.toFixed(1)} points)`);
  ok(Math.abs(S.percentileFor(151, 'Core', MALE) - 50) < 0.6,
     'the median lands exactly on the 50th, which is what a median is');
  ok(Math.abs(S.percentileFor(106, 'Core', FEMALE) - 50) < 0.6,
     'for women too');
}

/* ================= the spread is Core's own =================
 *
 * 🚨 THIS IS THE ONE THAT WOULD NOT HAVE BEEN NOTICED. Core would produce
 * plausible-looking levels under the app's global sigma and be badly wrong at
 * the edges, where the people who most want to know are.
 */
{
  ok(S.sigmaFor('Core') !== S.sigmaFor('Chest'),
     `Core carries its own log-spread (${S.sigmaFor('Core')} vs ${S.sigmaFor('Chest')})`);
  ok(S.sigmaFor('Chest') === S.sigmaFor('Quads') && S.sigmaFor('Nonsense') === S.sigmaFor('Chest'),
     '⚠️ and nothing else moved — every other muscle, and an unknown one, still get the default');

  // The counterfactual, computed rather than asserted from memory: under the
  // global sigma a lifter sitting exactly on the published Beginner mark reads
  // as the weakest person alive.
  const globalSigma = S.sigmaFor('Chest');
  const z = Math.log(58 / 151) / globalSigma;
  const wouldBe = 100 * 0.5 * (1 + erf(z / Math.SQRT2));
  const actual = S.percentileFor(58, 'Core', MALE);
  ok(wouldBe < 1 && actual > 1.5,
     `🚨 a real Beginner (58 lb) reads p${actual.toFixed(1)} — under the shared spread it would have `
     + `been p${wouldBe.toFixed(2)}, i.e. the model calling a published beginner the weakest lifter alive`);
}

function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
    a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  return s * (1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
}

/* ================= which core exercises count, and which do not ================= */
{
  const contrib = (name) => {
    const ex = byName(name);
    return ex ? ME.contributionsFor(ex, { bodyWeight: 180 }) : null;
  };

  const cable = contrib('Cable Crunch');
  ok(cable.length === 1 && cable[0].muscle === 'Core' && cable[0].ratio === 1
     && cable[0].kind === 'direct',
     'a Cable Crunch rates Core directly, at ratio 1 — it is the standard');

  const machine = contrib('Machine Crunch');
  ok(machine.length === 1 && machine[0].muscle === 'Core' && machine[0].ratio === 1.13,
     `a Machine Crunch converts at 1.13 (${machine[0] && machine[0].ratio})`);
  ok(machine[0].quality < cable[0].quality,
     `⚠️ at a REDUCED quality (${machine[0].quality}) though its five published levels agree to three `
     + 'decimals — because the men\'s and women\'s tables give 1.13 and 0.89 for the same conversion, '
     + 'and this table has no sex dimension to hold both');

  /* 🛑 THE REFUSALS, AND EACH IS A DIFFERENT REASON. These are the six weighted
     core exercises that are NOT admitted, and the temptation for a later session
     is to "finish the table" by adding them. They are not missing. */
  for (const [name, why] of [
    ['Decline Sit-Up', 'the load is a plate PLUS a fraction of the torso, and the fraction moves with the angle'],
    ['Russian Twist', 'rotation, not spinal flexion, and the load is mostly a lever-arm choice'],
    ['Cable Woodchop', 'rotation again'],
    ['Landmine Twist', 'rotation again'],
    ['Pallof Press', 'ANTI-rotation — resisting a stack is not the same quantity as moving one'],
    ['Suitcase Carry', 'anti-lateral-flexion, and timed — there is no 1RM'],
  ]) {
    const c = contrib(name);
    ok(c !== null && c.length === 0, `🛑 ${name} rates nothing — ${why}`);
  }

  ok(contrib('Plank').length === 0,
     '🛑 and a Plank rates nothing, which is the honest limit of this whole feature: '
     + 'most people\'s ab training is not weighted, and they get the hatch instead');
}

/* ================= "a little less reliability", as arithmetic ================= */
{
  const obs = (name, muscle, quality) => ({
    exerciseId: name, exerciseName: name, muscle, kind: 'direct',
    estimate: 170, quality, reps: 8, ageDays: 5, date: '2026-08-26',
    weight: 140, priorVolume: 0, isBenchmark: true,
  });

  const core = ME.rateMuscle([obs('Cable Crunch', 'Core', 1)], 'Core');
  const chest = ME.rateMuscle([obs('Barbell Bench Press', 'Chest', 1)], 'Chest');

  ok(core.estimate === chest.estimate,
     'identical evidence gives an identical ESTIMATE — the penalty is not a thumb on the number');
  ok(core.confidence < chest.confidence,
     `🚨 but a lower CONFIDENCE (${core.confidence.toFixed(3)} vs ${chest.confidence.toFixed(3)}) — `
     + 'the doubt is about the standard, not about the lifter, so it lands on how sure rather than on how strong');
  ok(Math.abs(core.confidence / chest.confidence - S.standardQualityFor('Core')) < 1e-9,
     'and it is exactly the muscle\'s standardQuality, not a coincidence of rounding');
  ok(S.standardQualityFor('Chest') === 1 && S.standardQualityFor('Nonsense') === 1,
     '⚠️ every other muscle is untouched at 1');

  ok(ME.tintFor(core.confidence) < ME.tintFor(chest.confidence),
     'so Core is painted less vividly than the same evidence on any other muscle');

  // Called without a muscle — demo.js does this — must behave exactly as before.
  const unnamed = ME.rateMuscle([obs('Cable Crunch', 'Core', 1)]);
  ok(unnamed.confidence === chest.confidence,
     '⚠️ rateMuscle() with no muscle named is unpenalised, so the callers that never named one did not change');
}

/* ================= the hint must not ask for work that cannot help ================= */
{
  const obs = (name, ageDays, date) => ({
    exerciseId: name, exerciseName: name, muscle: 'Core', kind: 'direct',
    estimate: 170, quality: name === 'Cable Crunch' ? 1 : 0.55, reps: 8,
    ageDays, date, weight: 140, priorVolume: 0, isBenchmark: true,
  });
  const rating = ME.rateMuscle([
    obs('Cable Crunch', 5, '2026-08-26'),
    obs('Machine Crunch', 6, '2026-08-25'),
    obs('Cable Crunch', 11, '2026-08-20'),
  ], 'Core');

  const hint = ME.raiseConfidenceHint('Core', rating);
  ok(rating.confidence < 0.72,
     `the reading is still not "High" confidence (${rating.confidence.toFixed(3)}) even with corroborated, `
     + 'recent, benchmarked evidence — because the standard is what is holding it');
  ok(hint && /standards, not by your training/.test(hint),
     `🚨 and the hint says so rather than asking for another set (${hint})`);
  ok(hint && !/Record|Train it again|would confirm/.test(hint),
     '⚠️ it asks for nothing — every other hint in this app is an instruction, and an instruction here '
     + 'would be a small lie repeated on every visit, because no amount of logging can move it');

  // But a genuinely fixable shortage still wins: the standard-bound line must
  // not mask advice somebody could act on.
  const thin = ME.rateMuscle([obs('Cable Crunch', 90, '2026-06-01')], 'Core');
  const thinHint = ME.raiseConfidenceHint('Core', thin);
  ok(thinHint && !/standards, not by your training/.test(thinHint),
     `⚠️ a stale single reading still gets the ordinary, actionable advice (${thinHint})`);
}

/* ================= the caveat travels with the number ================= */
{
  const caveat = S.standardCaveatFor('Core');
  ok(Boolean(caveat), 'Core carries a caveat');
  ok(/rough placing/.test(caveat),
     `and it says what to do with the number rather than only how it was made (${caveat})`);
  ok(S.standardCaveatFor('Chest') === null && S.standardCaveatFor('Neck') === null,
     'no other muscle has one, so it can never read as boilerplate');
}

/* ================= end to end, on a plausible lifter ================= */
{
  // 120 x 10 on a cable stack — an ordinary working set, not a stunt.
  const est = e1rm(120, 10);
  const pct = S.percentileFor(est, 'Core', MALE);
  const level = S.levelFor(pct);
  ok(est > 150 && est < 190, `120x10 estimates a ${est.toFixed(0)} lb max`);
  ok(level && level.name === 'Intermediate',
     `and reads ${level && level.name} at p${pct.toFixed(0)} — an ordinary set producing an ordinary level, `
     + 'which is the whole test of whether the median is in the right place');

  // Somebody genuinely strong, and somebody genuinely not.
  //
  // ⚠️ THE TOP OF THE SCALE IS ASSERTED AS A RANGE, NOT A TIER, and the reason
  // is the residual measured further up this file: a log-normal cannot pass
  // exactly through five published anchors, and the miss is largest in the
  // tails. 250x8 estimates 318 lb — above the published Elite mark of 288 — and
  // reads p94, one tier short. Pinning it to "Elite" would be pinning the
  // model's error, so what is pinned is what actually matters: a very strong
  // cable crunch reads near the top, and the tiers go up in the right order.
  const strong = S.percentileFor(e1rm(250, 8), 'Core', MALE);
  const stronger = S.percentileFor(e1rm(275, 8), 'Core', MALE);
  ok(strong > 90 && stronger > strong,
     `250x8 reads p${strong.toFixed(0)} and 275x8 p${stronger.toFixed(0)} — near the top, in order`);
  ok(S.levelFor(stronger).key === 'elite', 'and the strongest of them does reach Elite');
  ok(S.levelFor(S.percentileFor(e1rm(40, 12), 'Core', MALE)).key === 'beginner',
     'while 40x12 reads Beginner rather than falling off the bottom of the scale');
}

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
