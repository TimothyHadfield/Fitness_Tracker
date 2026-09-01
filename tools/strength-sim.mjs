// The strength-estimator simulator — docs/strength-estimate-plan.md §11.1.
//
// DEV-ONLY. Nothing in the app imports this; it is not in the service worker's
// precache list and must never be, because it ships nothing to a user. It lives
// beside tools/build-body-art.py for the same reason: it exists to produce a
// number that then gets written into the app by hand, with its derivation
// recorded.
//
// ── WHY A SIMULATOR AT ALL ───────────────────────────────────────────────────
//
// Every constant in js/strength-estimate.js is a claim about how much a set of
// eight reps is worth. There is no way to check such a claim against real logs,
// because real logs have no ground truth in them — nobody knows what a lifter's
// true 1RM was on a Tuesday in March. So: invent a lifter whose true 1RM curve
// we WROTE, generate the logs that lifter would plausibly have produced, and
// measure what the estimator says against the curve we wrote.
//
// ── WHAT IS HONEST ABOUT THIS AND WHAT IS NOT ────────────────────────────────
//
// ⚠️ Read this before quoting any number out of it.
//
// HONEST. The one-sided noise structure is real and is the thing being tested:
// warm-ups, back-offs, reps in reserve, missed sessions and readiness all push
// an observation BELOW the truth and never above it. Everything the estimator
// exists to survive is generated here, so bias, RMSE, flap rate and lag are
// measuring what they claim to measure. The relative comparisons — this half
// life against that one, winsorised against plain mean — are as sound as the
// generator, and the generator's structure is not in doubt.
//
// NOT HONEST IF QUOTED AS AN ABSOLUTE. Two inputs are assumptions:
//
//   1. The e1RM formula is CORRECT BY CONSTRUCTION here — the same Marzagão
//      curve generates the weights and reads them back. research.md §1.3 says
//      its absolute accuracy was never validated. So "typically within X %" is
//      a statement about this model, not about a human, and §11.2's backtest
//      against real held-out benchmarks is the only thing that could make it a
//      statement about a human.
//   2. REP_CURVE_SIGMA — how much an individual's own reps↔%1RM relationship
//      departs from the population curve — is a guess. Nuzzo 2024 says exercise
//      type is the only meaningful moderator, which tells us the spread is real
//      and roughly how it is structured, but nobody has published its width for
//      a 272-exercise library. Anything that scales with it (the u_reps term,
//      the high-rep shrinkage) is reported here as a SENSITIVITY, never as a
//      fitted value.
//
// Deterministic throughout. Never Math.random(), for the same reason js/demo.js
// never uses it: a fit you cannot reproduce is a fit you cannot check.

import { e1rm, weightForReps } from '../js/e1rm.js';
import { LEVELS, weightForPercentile } from '../js/strength-standards.js';
import {
  dailyValues, estimateAt, displayLevel, levelIndexAt, screenDaily, DEFAULTS,
} from '../js/strength-estimate.js';

/* ------------------------------------------------------------------ *
 * Randomness you can reproduce
 * ------------------------------------------------------------------ */

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller, so the normals are as reproducible as the uniforms.
  next.normal = () => {
    const u = Math.max(1e-12, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  next.pick = (xs) => xs[Math.floor(next() * xs.length) % xs.length];
  return next;
}

/* ------------------------------------------------------------------ *
 * The true 1RM curve — the thing the estimator does not get to see
 * ------------------------------------------------------------------ */

// A year with all four shapes in it, because each one breaks a different naive
// estimator: a BUILD catches lag, a PLATEAU catches flap (the display must sit
// still while the truth does), a DELOAD catches an estimator that reads a light
// week as a regression, and a REBUILD catches one that has smoothed so hard it
// can no longer move.
export const DEFAULT_PHASES = [
  { days: 98, to: 1.14 },   // build   — +14 % over fourteen weeks
  { days: 84, to: 1.14 },   // plateau — twelve weeks of exactly nothing
  { days: 21, to: 1.09 },   // deload/layoff — three weeks, −4.4 %
  { days: 162, to: 1.26 },  // rebuild — past the old peak
];

export const TOTAL_DAYS = DEFAULT_PHASES.reduce((a, p) => a + p.days, 0);

/** True 1RM on a given day. Log-linear inside each phase, so a "flat" phase is
 *  exactly flat — which is what makes flap rate mean anything. */
export function trueMaxCurve(base, phases = DEFAULT_PHASES) {
  const knots = [{ day: 0, mult: 1 }];
  let d = 0, m = 1;
  for (const p of phases) { d += p.days; m = p.to; knots.push({ day: d, mult: m }); }
  return (day) => {
    if (day <= 0) return base;
    for (let i = 1; i < knots.length; i++) {
      if (day <= knots[i].day) {
        const a = knots[i - 1], b = knots[i];
        const t = (day - a.day) / (b.day - a.day);
        return base * Math.exp(Math.log(a.mult) + t * (Math.log(b.mult) - Math.log(a.mult)));
      }
    }
    return base * knots[knots.length - 1].mult;
  };
}

/* ------------------------------------------------------------------ *
 * The lifter
 * ------------------------------------------------------------------ */

// How far one person's own reps↔%1RM relationship strays from the population
// curve, expressed as log-SD at 15 reps and scaled by ln(r)/ln(15) below it —
// zero at a single, because a single needs no conversion at all.
//
// ⚠️ THE ONE NUMBER IN THIS FILE NOBODY HAS MEASURED. 0.10 means a typical
// person's true weight at 15 reps sits ~10 % either side of what the formula
// predicts from their 1RM. It is anchored on nothing firmer than the observation
// that exercise type moves the curve enough to be the only significant moderator
// in a meta-analysis. Every result that depends on it is reported as a sweep.
export const REP_CURVE_SIGMA = 0.10;

export function repCurveSpread(reps, sigma15 = REP_CURVE_SIGMA) {
  const r = Math.max(1, Number(reps) || 1);
  return sigma15 * (Math.log(r) / Math.log(15));
}

// Reps in reserve on an ordinary working set. Skewed toward 1–2: most people
// leave a rep or two most of the time, occasionally grind one out, occasionally
// have a bad day and stop early. Mean 1.79.
const RIR_DISTRIBUTION = [
  [0, 0.12], [1, 0.30], [2, 0.33], [3, 0.17], [4, 0.08],
];

function drawRir(rand) {
  let u = rand();
  for (const [v, p] of RIR_DISTRIBUTION) { u -= p; if (u <= 0) return v; }
  return 2;
}

export const LIFTER_DEFAULTS = Object.freeze({
  base: 225,               // true 1RM on day 0, pounds
  daysPerWeek: 3,
  missRate: 0.15,          // sessions skipped — illness, work, life
  repScheme: [5, 8, 5],    // rotates session to session
  highRepRate: 0.10,       // days that turn into a 12–15 rep burnout
  backoffMin: 1,
  backoffMax: 3,
  warmupFractions: [0.45, 0.62, 0.80],
  warmupReps: [8, 5, 3],
  readinessSigma: 0.035,   // sleep, food, stress — day to day
  benchmarkEvery: 0,       // 0 = this lifter never tests; 56 = every 8 weeks
  sigma15: REP_CURVE_SIGMA,
  secondExerciseRate: 0.25, // how often the lift is not first in the session
  roundTo: 5,
});

/**
 * Generate a virtual lifter and the log they would have produced.
 * @returns { trueMax, sets, opts, base }
 */
export function simulateLifter(seed, overrides = {}) {
  const o = { ...LIFTER_DEFAULTS, ...overrides };
  const rand = rng(seed);
  const trueMax = trueMaxCurve(o.base, o.phases || DEFAULT_PHASES);
  const days = o.totalDays || TOTAL_DAYS;

  // Fixed per lifter: their own departure from the population rep curve.
  const eps = rand.normal();
  const round = (w) => Math.max(45, Math.round(w / o.roundTo) * o.roundTo);
  // The weight this person can actually do for n reps, given today's capability.
  const canDo = (cap, n) => weightForReps(cap, n) * Math.exp(eps * repCurveSpread(n, o.sigma15));

  const sets = [];
  let scheme = 0;
  const spacing = [0, 2, 4, 1, 3, 5, 6].slice(0, Math.max(1, o.daysPerWeek));

  for (let week = 0; week * 7 < days; week++) {
    for (const off of spacing) {
      const day = week * 7 + off;
      if (day >= days) continue;
      if (rand() < o.missRate) continue;

      const readiness = Math.exp(rand.normal() * o.readinessSigma - (o.readinessSigma ** 2) / 2);
      const cap = trueMax(day) * readiness;

      const highRep = rand() < o.highRepRate;
      const targetReps = highRep ? 12 + Math.floor(rand() * 4) : o.repScheme[scheme % o.repScheme.length];
      scheme++;

      const rir = drawRir(rand);
      const top = round(canDo(cap, targetReps + rir));
      const exerciseIndex = rand() < o.secondExerciseRate ? 1 : 0;
      let setIndex = 0;

      // Warm-up ramp. Real, logged, and pure poison to a naive average.
      for (let i = 0; i < o.warmupFractions.length; i++) {
        sets.push({
          day, exerciseId: 'main', weight: round(top * o.warmupFractions[i]),
          reps: o.warmupReps[i], setIndex: setIndex++, exerciseIndex,
        });
      }

      // The top set.
      sets.push({
        day, exerciseId: 'main', weight: top, reps: targetReps,
        setIndex: setIndex++, exerciseIndex,
      });

      // Back-offs, at a lighter weight and a couple more reps.
      const backoffs = o.backoffMin
        + Math.floor(rand() * (o.backoffMax - o.backoffMin + 1));
      for (let i = 0; i < backoffs; i++) {
        const reps = Math.min(15, targetReps + 2);
        sets.push({
          day, exerciseId: 'main', weight: round(top * (0.86 + rand() * 0.06)),
          reps, setIndex: setIndex++, exerciseIndex,
        });
      }
    }
  }

  // Benchmarks: a deliberate test, fresh, low reps, no reps in reserve.
  if (o.benchmarkEvery > 0) {
    for (let day = o.benchmarkEvery; day < days; day += o.benchmarkEvery) {
      const reps = 1 + Math.floor(rand() * 3);
      sets.push({
        day, exerciseId: 'main', weight: round(canDo(trueMax(day), reps)),
        reps, setIndex: 0, exerciseIndex: 0, isBenchmark: true,
      });
    }
  }

  sets.sort((a, b) => a.day - b.day || a.exerciseIndex - b.exerciseIndex || a.setIndex - b.setIndex);
  return { trueMax, sets, opts: o, base: o.base, days };
}

/* ------------------------------------------------------------------ *
 * Levels — what the user actually sees change colour
 * ------------------------------------------------------------------ */

export const SIM_PROFILE = { gender: 'male', bodyWeight: 180, age: 30 };

export function levelBoundaries(muscle = 'Chest', profile = SIM_PROFILE) {
  return LEVELS.map((l) => weightForPercentile(l.percentile, muscle, profile));
}

/* ------------------------------------------------------------------ *
 * The measurements — §11.1
 * ------------------------------------------------------------------ */

/**
 * Run the estimator across a simulated year and score it.
 *
 * @returns { bias, rmse, flapRate, flaps, lagDays, coverage, assertRate,
 *            meanU, points }
 *
 *   bias       mean signed relative error. Negative = reads low, which is the
 *              expected direction: the estimator sees submaximal work.
 *   rmse       root-mean-square relative error.
 *   flapRate   ⚠️ THE ONE TO OPTIMISE. Share of consecutive evaluation days on
 *              which the DISPLAYED level moved while the TRUE level did not.
 *              This is Tim's "all over the place", measured.
 *   lagDays    mean days between the truth crossing a threshold above baseline
 *              and the estimate crossing the same threshold.
 *   coverage   share of days on which the band actually contained the truth.
 *              What uBase is fitted to, and the only thing that makes the band
 *              a claim rather than a decoration.
 *   assertRate share of days on which the whole band sat inside one level, so a
 *              level could be asserted rather than hedged.
 */
export function evaluate(lifter, opts = {}) {
  const P = opts.params || DEFAULTS;
  const boundaries = opts.boundaries || levelBoundaries();
  const from = opts.from == null ? 63 : opts.from;
  const to = opts.to == null ? lifter.days - 1 : opts.to;
  let daily = dailyValues(opts.sets || lifter.sets, P);
  if (opts.screen) daily = screenDaily(daily, { params: P }).filter((d) => !d.quarantined);

  let prev = null;
  let prevDisplay = null;
  let prevTrueLevel = null;
  let n = 0, sum = 0, sumsq = 0, covered = 0, asserted = 0, uSum = 0;
  let flaps = 0, steps = 0;
  const points = [];

  for (let day = from; day <= to; day++) {
    const est = estimateAt(daily, day, { params: P, prev });
    if (!est) continue;
    prev = { value: est.value, day };

    const truth = lifter.trueMax(day);
    const err = (est.value - truth) / truth;
    n++; sum += err; sumsq += err * err; uSum += est.u;
    if (est.lo <= truth && truth <= est.hi) covered++;

    const shown = displayLevel(est, boundaries, prevDisplay, P);
    if (shown.certain) asserted++;
    const trueLevel = levelIndexAt(boundaries, truth);

    if (prevDisplay !== null) {
      steps++;
      // A flap is the display moving while the truth stood still. The display
      // moving BECAUSE the truth moved is the feature working.
      if (shown.index !== prevDisplay.index && trueLevel === prevTrueLevel) flaps++;
    }
    prevDisplay = { index: shown.index };
    prevTrueLevel = trueLevel;
    points.push({ day, est: est.value, truth, u: est.u, level: shown.index, trueLevel });
  }

  return {
    n,
    bias: n ? sum / n : NaN,
    rmse: n ? Math.sqrt(sumsq / n) : NaN,
    flaps,
    flapRate: steps ? flaps / steps : NaN,
    coverage: n ? covered / n : NaN,
    assertRate: n ? asserted / n : NaN,
    meanU: n ? uSum / n : NaN,
    lagDays: lagOf(points, lifter),
    levelLagDays: levelLagOf(points),
    deload: deloadOf(points, lifter),
    points,
  };
}

/**
 * The OTHER half of the flap trade. Hysteresis and smoothing both buy stability
 * by refusing to move, so any of them can be pushed until the flap rate is zero
 * and the display is simply frozen. This measures the price: when the TRUE
 * level changes, how many days before the display agrees?
 */
export function levelLagOf(points) {
  const lags = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].trueLevel === points[i - 1].trueLevel) continue;
    const target = points[i].trueLevel;
    let hit = null;
    let last = points[i];
    for (let j = i; j < points.length; j++) {
      if (points[j].trueLevel !== target) break;      // the truth moved on again
      last = points[j];
      if (points[j].level === target) { hit = points[j].day; break; }
    }
    // ⚠️ CENSORED CASES COUNT. Dropping the runs where the display never
    // catches up is exactly the bias that made a heavy-handed hysteresis look
    // like it had zero lag: the only runs it scored were the ones it happened
    // to be sitting on already. A run that never resolves is scored at its
    // full length, which is the least it could honestly be.
    lags.push((hit === null ? last.day : hit) - points[i].day);
  }
  return lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : NaN;
}

/**
 * What happens across the deload. The plan's whole argument for a fall-rate
 * limit is that a light block must not read as a regression — so measure it
 * where it happens rather than in the year-long average: the worst the estimate
 * reads relative to the truth over the deload and the fortnight after it.
 */
export function deloadOf(points, lifter, from = 182, to = 217) {
  const win = points.filter((p) => p.day >= from && p.day <= to);
  if (!win.length) return { bias: NaN, worst: NaN };
  let sum = 0, worst = 0;
  for (const p of win) {
    const e = (p.est - p.truth) / p.truth;
    sum += e;
    if (e < worst) worst = e;
  }
  void lifter;
  return { bias: sum / win.length, worst };
}

/**
 * How long the estimate takes to notice a genuine gain.
 *
 * Measured at three thresholds above the day-0 truth. For each, the day the
 * TRUTH first reaches it and the day the ESTIMATE first reaches it and stays
 * there for a week — "and stays" matters, or a single lucky top set counts as
 * having recognised a gain that had not happened yet.
 *
 * The thresholds sit well inside the build phase's +14 %. Putting one at 1.12
 * measures something else entirely: the estimate approaching an asymptote, so
 * a 1 % bias turns into fifty days of apparent lag.
 */
export function lagOf(points, lifter, thresholds = [1.03, 1.06, 1.09]) {
  if (!points.length) return NaN;
  const base = lifter.trueMax(0);
  const lags = [];
  for (const t of thresholds) {
    const target = base * t;
    const truthDay = points.find((p) => p.truth >= target);
    if (!truthDay) continue;
    let estDay = null;
    for (let i = 0; i < points.length; i++) {
      if (points[i].est < target) continue;
      const hold = points.slice(i, i + 7);
      if (hold.length && hold.every((p) => p.est >= target)) { estDay = points[i]; break; }
    }
    if (!estDay) continue;
    lags.push(estDay.day - truthDay.day);
  }
  return lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : NaN;
}

/* ------------------------------------------------------------------ *
 * The ensemble
 * ------------------------------------------------------------------ */

// One lifter is an anecdote. Twenty-four with different strengths, rep schemes,
// session counts, adherence and personal rep curves is a measurement — and it
// stops a constant being fitted to one person's programme style, which is the
// exact failure §1 of the plan warns about ("two lifters equally strong would
// read differently purely from programme style").
export function ensemble(count = 24, overrides = {}) {
  const bases = [135, 185, 205, 225, 245, 275, 315, 365];
  const schemes = [[5, 8, 5], [8, 12, 8], [3, 5, 3], [6, 10, 6], [10, 12, 10]];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(simulateLifter(1000 + i * 7717, {
      base: bases[i % bases.length],
      repScheme: schemes[i % schemes.length],
      daysPerWeek: 2 + (i % 3),
      missRate: 0.08 + 0.04 * (i % 4),
      benchmarkEvery: i % 4 === 0 ? 56 : 0,
      ...overrides,
    }));
  }
  return out;
}

/** Mean of `evaluate` across an ensemble, with per-lifter results kept. */
export function scoreEnsemble(lifters, opts = {}) {
  const each = lifters.map((l) => evaluate(l, opts));
  const mean = (k) => {
    const xs = each.map((e) => e[k]).filter((x) => Number.isFinite(x));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  };
  return {
    bias: mean('bias'),
    rmse: mean('rmse'),
    flapRate: mean('flapRate'),
    lagDays: mean('lagDays'),
    coverage: mean('coverage'),
    assertRate: mean('assertRate'),
    meanU: mean('meanU'),
    levelLagDays: mean('levelLagDays'),
    deloadWorst: (() => {
      const xs = each.map((e) => e.deload.worst).filter(Number.isFinite);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
    })(),
    flaps: each.reduce((a, e) => a + e.flaps, 0),
    lifters: lifters.length,
    each,
  };
}

/* ------------------------------------------------------------------ *
 * Contamination — the three questions Phase 0 exists to answer
 * ------------------------------------------------------------------ */

/**
 * Inject a mistyped weight into a lifter's log.
 *
 * @param kind 'x10'    fat finger on the keypad — 225 becomes 2250
 *             'digit'  a slipped digit — 135 becomes 185, 225 becomes 275
 *             'pct'    a proportional slip of `magnitude`
 */
export function withTypo(lifter, { day, kind = 'x10', magnitude = 0.25 }) {
  const sets = lifter.sets.map((s) => ({ ...s }));
  // The first ordinary session on or after `day`, then that session's top set.
  const candidates = sets.filter((s) => s.day >= day && !s.isBenchmark);
  if (!candidates.length) return { ...lifter, sets, typo: null };
  const hitDay = Math.min(...candidates.map((s) => s.day));
  const same = candidates.filter((s) => s.day === hitDay);
  const target = same.reduce((a, b) => (b.weight > a.weight ? b : a), same[0]);

  const before = target.weight;
  if (kind === 'x10') target.weight = before * 10;
  else if (kind === 'digit') target.weight = before + 50;
  else target.weight = Math.round(before * (1 + magnitude));
  return { ...lifter, sets, typo: { day: hitDay, before, after: target.weight } };
}

/* ------------------------------------------------------------------ *
 * The stress case: a lifter sitting on a level boundary
 * ------------------------------------------------------------------ */

// ⚠️ FLAP RATE CANNOT BE FITTED ON AN ORDINARY ENSEMBLE, and finding that out
// was worth the run. Level bands are 15–25 % wide in pounds and an ordinary
// lifter spends most of a year in the middle of one, so a whole simulated year
// produces a handful of level changes and every candidate constant scores
// "about zero". The measurement only has power where the failure actually
// happens: somebody whose true strength sits ON a boundary, where a 3 % wobble
// is the difference between two colours on the body map.
//
// So the flap ensemble is built by construction: each lifter's base 1RM is
// placed exactly on a level boundary and their build is small enough that the
// truth stays there. Every level change such a lifter sees is a flap.
export function boundaryEnsemble(count = 21, muscle = 'Chest') {
  const bounds = levelBoundaries(muscle).filter((b) => b > 0);
  const schemes = [[5, 8, 5], [8, 12, 8], [3, 5, 3], [6, 10, 6], [10, 12, 10]];
  // A near-flat year: ±2 %, so the TRUE level essentially never changes and
  // anything the display does is noise being rendered as a fact.
  const phases = [
    { days: 98, to: 1.02 }, { days: 84, to: 1.02 },
    { days: 21, to: 1.00 }, { days: 162, to: 1.02 },
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(simulateLifter(7000 + i * 4409, {
      base: bounds[i % bounds.length] * (1 + ((i % 3) - 1) * 0.01),
      repScheme: schemes[i % schemes.length],
      daysPerWeek: 2 + (i % 3),
      missRate: 0.08 + 0.04 * (i % 4),
      phases,
    }));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Q1's real shape: several exercises rating ONE muscle
 * ------------------------------------------------------------------ */

// The residual in docs/handbook.md §9 is not about one lift's history — it is about
// the AGGREGATE ACROSS EXERCISES that js/muscle-evidence.js computes. A face
// pull and an overhead press both rate Shoulders; each is converted to the key
// lift by a ratio; the ratios are population averages and one person's own
// ratio departs from them. The exercise with the loosest ratio is also the one
// whose personal departure is largest, which is exactly how a 15-rep face pull
// came to outweigh a benchmark.
//
// `q` is the conversion quality from muscle-evidence.js, and RATIO_ERROR_AT_Q0
// is how far one person's own ratio strays when q = 0: 40 % log-SD, tapering to
// zero at q = 1 where the exercise IS the key lift and there is no conversion.
// ⚠️ Assumed, like REP_CURVE_SIGMA — muscle-evidence.js's own header says the
// machine ratios are the shaky ones without putting a number on how shaky.
export const RATIO_ERROR_AT_Q0 = 0.40;

/**
 * Observations rating one muscle, already converted to key-lift pounds — the
 * shape rateMuscle() takes.
 *
 * @returns { truth, observations[] } where each observation carries the
 *          `evidenceWeight` muscle-evidence.js would have given it.
 */
export function simulateMuscle(seed, spec = {}) {
  const rand = rng(seed);
  const truth = spec.truth || 130;                 // true key-lift 1RM, pounds
  const exercises = spec.exercises || [
    { id: 'press', ratio: 1.00, q: 1.00, reps: 3, isBenchmark: true, days: [4] },
    { id: 'db-press', ratio: 0.85, q: 0.60, reps: 8, days: [2, 9, 16, 23] },
    { id: 'face-pull', ratio: 0.30, q: 0.25, reps: 15, days: [2, 9, 16, 23] },
  ];
  const observations = [];
  for (const ex of exercises) {
    // One personal ratio departure per exercise, fixed — a person is not a
    // different shape from week to week.
    const err = Math.exp(rand.normal() * RATIO_ERROR_AT_Q0 * (1 - ex.q));
    for (const day of ex.days) {
      const rir = ex.isBenchmark ? 0 : drawRir(rand);
      // What they could lift on this exercise, in the exercise's own pounds.
      const own = truth * ex.ratio * err;
      const w = Math.round(weightForReps(own, ex.reps + rir) / 5) * 5;
      // Converted back to the key lift the way muscle-evidence.js does it.
      const estimate = e1rm(w, ex.reps) / ex.ratio;
      observations.push({
        exerciseId: ex.id,
        day,
        ageDays: day,
        reps: ex.reps,
        quality: ex.q,
        isBenchmark: Boolean(ex.isBenchmark),
        estimate,
      });
    }
  }
  return { truth, observations };
}
