// Fitting the estimator's constants — docs/strength-estimate-plan.md §11.1.
//
//   node tools/strength-fit.mjs
//
// DEV-ONLY, and slow (~40 s). Every number written into DEFAULTS in
// js/strength-estimate.js came out of a table printed here, so that a later
// session can re-derive it rather than trust it. Nothing here is a test — the
// assertions on these outcomes live in tests/strength-estimate.test.mjs.
//
// 🚨 AND NOTHING PINS THE PROVENANCE BLOCK. This header claimed until 2026-09-15
// that tests/strength-estimate.test.mjs pinned it "since 2026-09-13"; grep that
// file for `provenance` and there is nothing. That is precisely how it came to
// print "22 figure(s) outside tolerance" through a fully green suite for a
// session and a half — the guard it named does not exist.
//
// ⚠️ AND READ WHAT `quoted` ACTUALLY IS BEFORE BELIEVING A ✗. Every `quoted`
// value in `provenance()` is a NUMERIC LITERAL IN THIS FILE, hand-copied from a
// DEFAULTS comment. Nothing parses the comments. So a ✗ means "this file's copy
// disagrees with a fresh run", which can be a drifted comment, a drifted copy,
// or a figure whose comment was reworded away entirely — on 2026-09-15, 16 of
// the 22 were the last of those: the numbers appear nowhere in
// js/strength-estimate.js any more. **Check which before you edit either side.**
//
// ⚠️ WHAT WAS ACTUALLY OPTIMISED, STATED HONESTLY (2026-09-13). Until today this
// header said "the quantity being minimised is flap rate". That is not what the
// sweeps below show and it never was: on flap rate alone they favour a window of
// 84 days, a half-life of 56 and best-of-1, and none of those shipped. The
// shipped 42 / 28 / 3 were chosen on BIAS, LAG AND COVERAGE together — bias
// under 1 %, lag inside a fortnight, the band covering ~95 % — with flap rate
// WATCHED, and then taken under half a flap per lifter-year by hysteresis, which
// is a display rule and not an estimator constant. plan §5 says this; the
// DEFAULTS comments now say it too. Flap rate is the constraint hysteresis is
// fitted against, not the objective the estimator was.
//
// Bias is watched but never minimised: this estimator is DELIBERATELY biased
// low, because every observation it sees is a lower bound on the truth, and an
// unbiased reading of submaximal work would have to be inventing the effort the
// lifter left in reserve.
//
// ⚠️ AND FLAP RATE IS MEASURED ON THE BOUNDARY ENSEMBLE, not the ordinary one.
// See boundaryEnsemble() in strength-sim.mjs: an ordinary lifter spends a year
// in the middle of one level, so an ordinary ensemble scores every candidate
// constant at "about zero flaps" and discriminates nothing.
//
// ⚠️ EVERYTHING HERE IS CONDITIONAL ON THE CURVE. The simulator writes its truth
// with the same Marzagão curve the estimator inverts. §CURVE below re-runs the
// ensemble with the lifter's body following a different published curve and
// prints what the estimator then reads; that table is the honest error budget
// for any absolute claim, and it is why uBase was widened on 2026-09-13.

import { fileURLToPath } from 'node:url';
import {
  ensemble, boundaryEnsemble, scoreEnsemble, simulateLifter, simulateMuscle,
  evaluate, withTypo, levelBoundaries, REP_CURVE_SIGMA, RATIO_ERROR_AT_Q0,
  TRUE_CURVES,
} from './strength-sim.mjs';
import {
  DEFAULTS, dailyValues, estimateAt, robustAggregate, plausibleCeiling,
  PLAUSIBLE_GAIN,
} from '../js/strength-estimate.js';
import { e1rm } from '../js/e1rm.js';

const P = (over) => ({ ...DEFAULTS, ...over });
const pc = (x, d = 2) => (Number.isFinite(x) ? (x * 100).toFixed(d) + ' %' : '   —  ');
const num = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '  —');
const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

/* ================================================================== *
 * Shared measurements — used by the sweeps below AND by provenance()
 * ================================================================== */

/** The honest spread of one lift's daily bests around their own window
 *  median: the FLOOR winsorK must sit above. */
export function winsorFloor(lifters) {
  const ratios = [];
  for (const l of lifters) {
    const daily = dailyValues(l.sets);
    for (let day = 63; day < l.days; day += 7) {
      const win = daily.filter((d) => d.day <= day && day - d.day < DEFAULTS.windowDays);
      if (win.length < 4) continue;
      const xs = win.map((d) => d.x).sort((a, b) => a - b);
      const med = xs[Math.floor(xs.length / 2)];
      for (const x of xs) ratios.push(x / med);
    }
  }
  ratios.sort((a, b) => a - b);
  return {
    n: ratios.length,
    p90: quantile(ratios, 0.90), p975: quantile(ratios, 0.975),
    p99: quantile(ratios, 0.99), p9999: quantile(ratios, 0.9999),
  };
}

// muscle-evidence.js's own weighting, reproduced here so the comparison is
// against what SHIPS rather than against a straw man.
const repF = (r) => (r <= 3 ? 1 : r <= 6 ? 0.95 : r <= 8 ? 0.85 : r <= 10 ? 0.7 : r <= 12 ? 0.45 : 0.25);
const recency = (a) => Math.pow(0.5, a / 120);
const muscleItems = (m) => {
  const perEx = new Map();
  for (const o of m.observations) {
    const prev = perEx.get(o.exerciseId);
    if (!prev || o.estimate > prev.estimate) perEx.set(o.exerciseId, o);
  }
  return [...perEx.values()].map((o) => ({
    x: o.estimate,
    w: o.quality * repF(o.reps) * recency(o.ageDays) * (o.isBenchmark ? 1.25 : 1),
  })).sort((a, b) => b.w - a.w || b.x - a.x).slice(0, 3);
};
const plainMean = (items) => {
  let n = 0, d = 0; for (const i of items) { n += i.x * i.w; d += i.w; } return n / d;
};

/** 200 simulated muscles, three exercises each, scored against a known truth
 *  — the CEILING on winsorK, and the "free change" measurement. */
export function muscleEnsembleScores(ks = [0.2, 0.25, 0.35, 0.5]) {
  const withOutlier = [];
  const withoutOutlier = [];
  for (let i = 0; i < 200; i++) {
    const full = simulateMuscle(30000 + i * 131);
    withOutlier.push(full);
    withoutOutlier.push({
      truth: full.truth,
      observations: full.observations.filter((o) => o.exerciseId !== 'face-pull'),
    });
  }
  const score = (set, agg) => {
    let sum = 0, sq = 0, worst = 0;
    for (const m of set) {
      const v = agg(muscleItems(m));
      const e = (v - m.truth) / m.truth;
      sum += e; sq += e * e; worst = Math.max(worst, Math.abs(e));
    }
    return { bias: sum / set.length, rmse: Math.sqrt(sq / set.length), worst };
  };
  const out = {
    plainNoOutlier: score(withoutOutlier, plainMean),
    plainWithOutlier: score(withOutlier, plainMean),
    winsorWithOutlier: {},
    winsorNoOutlier: {},
  };
  for (const k of ks) {
    out.winsorWithOutlier[k] = score(withOutlier, (it) => robustAggregate(it, P({ winsorK: k })));
    out.winsorNoOutlier[k] = score(withoutOutlier, (it) => robustAggregate(it, P({ winsorK: k })));
  }
  return out;
}

/** Error growth after the evidence stops — what u_stale tracks. */
export function staleGrowth(lifters) {
  const byWeek = new Map();
  for (const l of lifters) {
    const daily = dailyValues(l.sets);
    for (const anchor of [120, 200, 260]) {
      const est = estimateAt(daily, anchor, {});
      if (!est) continue;
      for (let w = 1; w <= 12; w++) {
        const day = anchor + w * 7;
        if (day >= l.days) break;
        const err = Math.abs(est.value - l.trueMax(day)) / l.trueMax(day);
        if (!byWeek.has(w)) byWeek.set(w, []);
        byWeek.get(w).push(err);
      }
    }
  }
  const weeks = {};
  for (const [w, xs] of byWeek) weeks[w] = { mean: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length };
  const avgSlope = (weeks[12].mean - weeks[1].mean) / 11;
  const lateSlope = (weeks[12].mean - weeks[8].mean) / 4;
  return { weeks, avgSlope, lateSlope };
}

/** Extra log-SD of e1RM/truth at 15 reps over 1 rep, under an ASSUMED
 *  per-lifter rep-curve spread — the u_reps sensitivity. */
export function repErrorTable(sigma15) {
  const buckets = new Map();
  for (let i = 0; i < 48; i++) {
    const l = simulateLifter(500 + i * 2311, {
      base: [135, 185, 225, 275, 315][i % 5],
      repScheme: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
      highRepRate: 0,
      sigma15,
      missRate: 0.1,
    });
    for (const s of l.sets) {
      if (s.setIndex !== 3) continue;      // the top set only
      const truth = l.trueMax(s.day);
      if (!buckets.has(s.reps)) buckets.set(s.reps, []);
      buckets.get(s.reps).push(Math.log(e1rm(s.weight, s.reps) / truth));
    }
  }
  const out = [];
  for (const [reps, xs] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    out.push({ reps, n: xs.length, meanLog: m, sd });
  }
  return out;
}

export function extraLogSdAt15(sigma15) {
  const t = repErrorTable(sigma15);
  const one = t.find((x) => x.reps === 1), fifteen = t.find((x) => x.reps === 15);
  return Math.sqrt(Math.max(0, fifteen.sd ** 2 - one.sd ** 2));
}

/** The true ln-gain per day over 28-day windows — where PLAUSIBLE_GAIN.perDay
 *  was read from (and it is DEFAULT_PHASES' build slope; see strength-sim). */
export function trueGainQuantiles(lifters) {
  const gains = [];
  for (const l of lifters) {
    for (let d = 0; d + 28 < l.days; d++) gains.push(Math.log(l.trueMax(d + 28) / l.trueMax(d)) / 28);
  }
  gains.sort((a, b) => a - b);
  return { p50: quantile(gains, 0.5), p95: quantile(gains, 0.95), p995: quantile(gains, 0.995), max: quantile(gains, 1) };
}

/** How far a genuine daily best sits above the standing estimate — where
 *  PLAUSIBLE_GAIN.intercept was read from. */
export function genuineDayRatios(lifters) {
  const rs = [];
  for (const l of lifters) {
    const daily = dailyValues(l.sets);
    for (const d of daily) {
      const before = estimateAt(daily.filter((x) => x.day < d.day), d.day - 1, {});
      if (before) rs.push(d.x / before.value);
    }
  }
  rs.sort((a, b) => a - b);
  const fpAt = (ic) => rs.filter((r) => r > Math.exp(ic)).length / rs.length;
  return {
    n: rs.length,
    p50: quantile(rs, 0.5), p90: quantile(rs, 0.9), p99: quantile(rs, 0.99),
    p999: quantile(rs, 0.999), max: quantile(rs, 1), fpAt,
  };
}

/** Detection rate of a typo of a given size, screened against the standing
 *  estimate. */
export function typoDetection(lifters, spec, days = [90, 120, 150, 180, 240, 300]) {
  let caught = 0, total = 0;
  for (const l of lifters) {
    const clean = dailyValues(l.sets);
    for (const day of days) {
      const bad = withTypo(l, { day, ...spec });
      if (!bad.typo) continue;
      const hit = dailyValues(bad.sets).find((d) => d.day === bad.typo.day);
      const before = estimateAt(clean.filter((x) => x.day < bad.typo.day), bad.typo.day - 1, {});
      if (!hit || !before) continue;
      total++;
      if (hit.x > plausibleCeiling(before.value, 1)) caught++;
    }
  }
  return { caught: caught / total, n: total };
}

/* ================================================================== *
 * §CURVE — what if the lifter's body does not follow Marzagão?
 * ================================================================== */

/**
 * Re-run the ordinary ensemble with each TRUE curve and score the estimator
 * unchanged. `uBases` are the band widths to report coverage at, because the
 * band is the thing this table is used to size.
 *
 * @returns [{ key, label, bias, rmse, lag, coverage: {uBase: cov}, meanU: {uBase: u} }]
 */
export function curveMismatch({ uBases = [DEFAULTS.uBase], count = 24 } = {}) {
  const rows = [];
  for (const [key, curve] of Object.entries(TRUE_CURVES)) {
    const lifters = ensemble(count, { repMap: curve.repMap });
    const base = scoreEnsemble(lifters);
    const row = { key, label: curve.label, bias: base.bias, rmse: base.rmse, lagDays: base.lagDays, coverage: {}, meanU: {} };
    for (const uBase of uBases) {
      const s = uBase === DEFAULTS.uBase ? base : scoreEnsemble(lifters, { params: P({ uBase }) });
      row.coverage[uBase] = s.coverage;
      row.meanU[uBase] = s.meanU;
    }
    rows.push(row);
  }
  return rows;
}

/* ================================================================== *
 * PROVENANCE — every figure a DEFAULTS comment quotes, recomputed
 * ================================================================== */

/**
 * Recompute each number the comments in js/strength-estimate.js quote, from
 * the same ensembles the sweeps use, so tests/strength-estimate.test.mjs can
 * pin them and a comment can never drift from its tool again (the way three of
 * them had by 2026-09-13).
 *
 * `quoted` is what the comment SAYS; `computed` is what the tool finds now;
 * `tol` is how far apart they may sit before the pin fails. The tolerances are
 * deliberately tight — they are there to catch a comment that has stopped
 * being true, not to describe the simulator's noise.
 *
 * @param {Object} opts { lifters, edge } — override the ensembles (the test's
 *   vacuity guard passes a different one and expects the figures to move)
 * @returns { entries: [{ constant, value, figures: [{ name, quoted, computed, tol }] }] }
 */
export function provenance(opts = {}) {
  const lifters = opts.lifters || ensemble(24);
  const edge = opts.edge || boundaryEnsemble(21);
  const on = (params, set = lifters) => scoreEnsemble(set, { params });
  const flapsPerYear = (params) => { const e = on(params, edge); return e.flaps / e.lifters; };
  const OFF = { hysteresis: 0 };

  const base = on(DEFAULTS);
  const baseEdge = on(DEFAULTS, edge);
  const entries = [];
  const entry = (constant, value, figures) => entries.push({ constant, value, figures });
  const fig = (name, quoted, computed, tol) => ({ name, quoted, computed, tol });

  // positionDecay — "removing it moved RMSE by 0.1 pp and flap rate not at all"
  //
  // ⚠️ THE TWO FLAP FIGURES WERE 0.43 → 0.38 UNTIL 2026-09-15 AND THE COMMENT
  // NEVER SAID THAT. It says the flap rate does not move, so what belongs here
  // is the DIFFERENCE, which is what the sentence claims. Both sides now
  // compute 0.19048, so the old pair was flagging a comment that was right.
  {
    const off = on(P({ positionDecay: 1 }));
    entry('positionDecay', DEFAULTS.positionDecay, [
      fig('RMSE change when removed (pp)', 0.0, Math.abs(off.rmse - base.rmse) * 100, 0.1),
      fig('flap-rate change when removed ("not at all")', 0.0,
        Math.abs(flapsPerYear(P({ positionDecay: 1 })) - baseEdge.flaps / baseEdge.lifters), 0.05),
    ]);
  }

  // windowDays — lag and bias at 28 / 42 / 84, flaps at 84
  {
    const w28 = on(P({ ...OFF, windowDays: 28 }));
    const w42 = on(P({ ...OFF, windowDays: 42 }));
    const w84 = on(P({ ...OFF, windowDays: 84 }));
    entry('windowDays', DEFAULTS.windowDays, [
      // ⚠️ RE-COPIED 2026-09-15 from the rewritten comment, which argues from
      // bias, lag and RMSE rather than from flap rate. `coverage at 28` went
      // with the sentence that quoted it; the flap pair became the ratio the
      // comment actually claims ("halves the flap rate").
      fig('lag at 28 (days)', 15.4, w28.lagDays, 0.3),
      fig('lag at 42 (days)', 13.4, w42.lagDays, 0.3),
      fig('lag at 84 (days)', 12.8, w84.lagDays, 0.3),
      fig('bias at 28', -0.0012, w28.bias, 0.002),
      fig('bias at 42', 0.0067, w42.bias, 0.002),
      fig('bias at 84', 0.0172, w84.bias, 0.002),
      fig('RMSE at 42', 0.0466, w42.rmse, 0.002),
      fig('RMSE at 84 (worst in the sweep)', 0.0498, w84.rmse, 0.002),
      fig('flaps at 84 ÷ flaps at 42 ("halves it")', 0.5,
        flapsPerYear(P({ ...OFF, windowDays: 84 })) / flapsPerYear(P({ ...OFF, windowDays: 42 })), 0.1),
    ]);
  }

  // halfLifeDays — flaps across 14/21/28/42/56 and the RMSE spread
  {
    const hl = {};
    for (const h of [14, 21, 28, 42, 56]) hl[h] = { flaps: flapsPerYear(P({ ...OFF, halfLifeDays: h })), s: on(P({ ...OFF, halfLifeDays: h })) };
    const rmses = Object.values(hl).map((x) => x.s.rmse);
    entry('halfLifeDays', DEFAULTS.halfLifeDays, [
      // ⚠️ RE-COPIED 2026-09-15. The comment argues from LEVEL lag now — the
      // half-life at which a colour on the body map starts taking five more
      // days to move — so the plain lag figures went with the sentence that
      // quoted them, and 28's flap rate with the claim that it was the best.
      fig('flaps/yr at 14', 4.10, hl[14].flaps, 0.1),
      fig('flaps/yr at 56 (fewest)', 3.86, hl[56].flaps, 0.1),
      fig('RMSE spread across 14–56 (pp)', 0.06, (Math.max(...rmses) - Math.min(...rmses)) * 100, 0.05),
      fig('RMSE at 28 above the best of the sweep (pp)', 0.01,
        (hl[28].s.rmse - Math.min(...rmses)) * 100, 0.02),
      fig('level lag at 28 (days)', 16.1, hl[28].s.levelLagDays, 0.5),
      fig('level lag at 42 (days)', 20.8, hl[42].s.levelLagDays, 0.5),
    ]);
  }

  // topN — flaps 1..5, and what N = 1 costs on bias / band / a slipped digit
  {
    const n1 = on(P({ ...OFF, topN: 1 }));
    const n4 = on(P({ ...OFF, topN: 4 }));
    const n5 = on(P({ ...OFF, topN: 5 }));
    const slip = lifters.map((l) => withTypo(l, { day: 150, kind: 'digit' }));
    entry('topN', DEFAULTS.topN, [
      // ⚠️ RE-COPIED 2026-09-15. The comment no longer claims N = 3 is the best
      // on flap rate — it is the worst of the five — so the flap figures went
      // with that sentence and what is checked now is the case that replaced
      // it: bias, lag and coverage at N = 3, and what N = 1 and N = 5 cost.
      fig('bias at N=3', 0.0067, base.bias, 0.003),
      fig('lag at N=3 (days)', 13.4, base.lagDays, 0.3),
      fig('coverage at N=3', 0.979, base.coverage, 0.005),
      fig('bias at N=1', 0.0272, n1.bias, 0.003),
      fig('mean band at N=1 (±21 %)', 0.21, n1.meanU, 0.01),
      fig('coverage at N=1 (100 %, by being useless)', 1.0, n1.coverage, 0.005),
      fig('lag at N=4 (days)', 19.1, n4.lagDays, 0.5),
      fig('lag at N=5 (days)', 22.6, n5.lagDays, 0.5),
      fig('coverage at N=5 (comment: under 96 %)', 0.942, n5.coverage, 0.005),
      fig('+50 lb slip bias at N=1', 0.0686, on(P({ topN: 1 }), slip).bias, 0.005),
      fig('+50 lb slip bias at N=3', 0.0288, on(P({ topN: 3 }), slip).bias, 0.005),
    ]);
  }

  // winsorK — the floor, the ceiling, and the free change
  {
    const floor = winsorFloor(lifters);
    const m = muscleEnsembleScores([0.25, 0.35]);
    entry('winsorK', DEFAULTS.winsorK, [
      fig('honest spread p99.99 (×)', 1.204, floor.p9999, 0.01),
      fig('honest spread n', 16203, floor.n, 200),
      fig('worst error, plain mean + outlier', 0.198, m.plainWithOutlier.worst, 0.005),
      fig('worst error, k=0.25', 0.075, m.winsorWithOutlier[0.25].worst, 0.003),
      fig('worst error, k=0.35', 0.092, m.winsorWithOutlier[0.35].worst, 0.003),
      fig('RMSE plain, with outlier', 0.0454, m.plainWithOutlier.rmse, 0.001),
      fig('RMSE k=0.25, with outlier', 0.0376, m.winsorWithOutlier[0.25].rmse, 0.001),
      fig('RMSE plain, NO outlier', 0.0459, m.plainNoOutlier.rmse, 0.001),
      fig('RMSE k=0.25, NO outlier', 0.0386, m.winsorNoOutlier[0.25].rmse, 0.001),
    ]);
  }

  // fallLimitPerWeek — deload reading and the ratchet
  {
    const off = on(P({ fallLimitPerWeek: 1 }));
    const never = on(P({ fallLimitPerWeek: 0 }));
    entry('fallLimitPerWeek', DEFAULTS.fallLimitPerWeek, [
      fig('deload worst at 2 %/wk', -0.0128, base.deloadWorst, 0.002),
      fig('deload worst with no limit', -0.0164, off.deloadWorst, 0.002),
      fig('bias at 0 %/wk (ratchet)', 0.0205, never.bias, 0.002),
    ]);
  }

  // uBase — coverage and mean band as shipped, and at the old value
  {
    const old = on(P({ uBase: 0.10 }));
    entry('uBase', DEFAULTS.uBase, [
      fig('coverage as shipped', 0.981, base.coverage, 0.005),
      fig('mean band as shipped', 0.1445, base.meanU, 0.003),
      fig('coverage at 0.10', 0.952, old.coverage, 0.005),
      fig('mean band at 0.10', 0.122, old.meanU, 0.003),
    ]);
  }

  // uStalePerWeek — error growth after the evidence stops
  {
    const g = staleGrowth(lifters);
    entry('uStalePerWeek', DEFAULTS.uStalePerWeek, [
      fig('mean |error| +1 week', 0.0462, g.weeks[1].mean, 0.002),
      fig('mean |error| +4 weeks', 0.0425, g.weeks[4].mean, 0.002),
      fig('mean |error| +12 weeks', 0.0602, g.weeks[12].mean, 0.002),
      fig('growth per week, averaged (pp)', 0.13, g.avgSlope * 100, 0.03),
      fig('growth per week, weeks 8–12 (pp)', 0.39, g.lateSlope * 100, 0.05),
    ]);
  }

  // uReps — extra log-SD at 15 reps under three ASSUMED spreads
  entry('uReps', DEFAULTS.uReps, [
    fig('extra log-SD, σ15 = 0.05', 0.01, extraLogSdAt15(0.05), 0.005),
    fig('extra log-SD, σ15 = 0.10', 0.07, extraLogSdAt15(REP_CURVE_SIGMA), 0.005),
    fig('extra log-SD, σ15 = 0.15', 0.12, extraLogSdAt15(0.15), 0.005),
  ]);

  // hysteresis — the flap / level-lag trade
  {
    const rows = {};
    for (const h of [0, 0.25, 0.5]) rows[h] = { flaps: flapsPerYear(P({ hysteresis: h })), lag: on(P({ hysteresis: h })).levelLagDays };
    entry('hysteresis', DEFAULTS.hysteresis, [
      // ⚠️ These six were re-copied from the DEFAULTS comment on 2026-09-15,
      // after the strength rebuild moved the simulator and the comment was
      // brought back in line with it. They are the comment's numbers, not this
      // run's — that is the whole point of the check.
      fig('flaps/yr at 0', 3.90, rows[0].flaps, 0.1),
      fig('flaps/yr at 0.25', 0.19, rows[0.25].flaps, 0.05),
      fig('flaps/yr at 0.5', 0.00, rows[0.5].flaps, 0.05),
      fig('level lag at 0 (days)', 16.1, rows[0].lag, 0.5),
      fig('level lag at 0.25 (days)', 29.4, rows[0.25].lag, 0.5),
      fig('level lag at 0.5 (days)', 38.6, rows[0.5].lag, 0.5),
    ]);
  }

  // PLAUSIBLE_GAIN — the rate, the intercept, the detection table
  {
    const g = trueGainQuantiles(lifters);
    const r = genuineDayRatios(lifters);
    entry('PLAUSIBLE_GAIN', PLAUSIBLE_GAIN.perDay, [
      fig('fastest true 28-day ln-gain per day', 0.00134, g.max, 0.00005),
      fig('perDay ÷ that', 1.42, PLAUSIBLE_GAIN.perDay / g.max, 0.05),
      fig('genuine day ÷ estimate, p50', 0.948, r.p50, 0.005),
      fig('genuine day ÷ estimate, p99.9', 1.124, r.p999, 0.01),
      fig('false positives at intercept 0.12', 0.0009, r.fpAt(0.12), 0.001),
      fig('genuine days n', 3202, r.n, 50),
      fig('×10 caught', 1.00, typoDetection(lifters, { kind: 'x10' }).caught, 0.01),
      fig('+40 % caught', 0.99, typoDetection(lifters, { kind: 'pct', magnitude: 0.40 }).caught, 0.02),
      fig('+25 % caught', 0.77, typoDetection(lifters, { kind: 'pct', magnitude: 0.25 }).caught, 0.03),
      fig('+15 % caught', 0.19, typoDetection(lifters, { kind: 'pct', magnitude: 0.15 }).caught, 0.03),
      fig('+10 % caught', 0.05, typoDetection(lifters, { kind: 'pct', magnitude: 0.10 }).caught, 0.03),
    ]);
  }

  /* 🚨 THIS ENTRY IS NOT A COMMENT CHECK AND WAS LABELLED AS ONE UNTIL
   * 2026-09-15 ("the headline the module header quotes"). js/strength-estimate.js
   * quotes none of these three — grep it for 12.1, 4.63 or 0.68 and there is
   * nothing. It is the tool's own BASELINE RECORD: the three numbers the whole
   * fit was judged on, kept so that a later run notices the model moving under
   * it even when no comment mentions them.
   *
   * ⚠️ Which means a ✗ here means something different from a ✗ anywhere else in
   * this block — not "a comment drifted" but "the model moved". `lag (days)`
   * has been ✗ since the 2026-09-14 rebuild for exactly that reason, and it is
   * kept rather than re-copied so the next reader is told. Bias and RMSE
   * survived the rebuild inside tolerance. */
  entry('headline (the tool\'s own baseline, not a comment)', null, [
    fig('bias', 0.0068, base.bias, 0.002),
    fig('RMSE', 0.0463, base.rmse, 0.002),
    fig('lag (days) — moved in the 2026-09-14 rebuild', 12.1, base.lagDays, 0.3),
  ]);

  return { entries };
}

export function printProvenance(prov) {
  console.log('\n\n═══ PROVENANCE · every figure a DEFAULTS comment quotes, recomputed ═══');
  console.log('   quoted = what js/strength-estimate.js says · computed = this run · ✗ = outside tolerance');
  let bad = 0;
  for (const e of prov.entries) {
    console.log(`\n  ${e.constant}${e.value == null ? '' : ' = ' + e.value}`);
    for (const f of e.figures) {
      const okk = Math.abs(f.computed - f.quoted) <= f.tol;
      if (!okk) bad++;
      const fmt = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(3) : x.toFixed(5));
      console.log(`    ${okk ? '✓' : '✗'} ${f.name.padEnd(40)} quoted ${fmt(f.quoted).padStart(9)}   computed ${fmt(f.computed).padStart(9)}   ±${f.tol}`);
    }
  }
  console.log(bad ? `\n  ⚠️ ${bad} figure(s) outside tolerance — a comment has drifted from the tool.`
    : '\n  every quoted figure reproduces.');
  return bad;
}

/* ================================================================== *
 * The sweeps — run only when this file is the entry point
 * ================================================================== */

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const LIFTERS = ensemble(24);
  const EDGE = boundaryEnsemble(21);

  const row = (label, s, edge) => {
    console.log(
      `  ${label.padEnd(24)} bias ${pc(s.bias).padStart(8)}  rmse ${pc(s.rmse).padStart(8)}`
      + `  lag ${num(s.lagDays).padStart(5)}d  lvlLag ${num(s.levelLagDays).padStart(5)}d`
      + `  deload ${pc(s.deloadWorst).padStart(8)}  cov ${pc(s.coverage).padStart(7)}`
      + `  assert ${pc(s.assertRate).padStart(7)}  meanU ${pc(s.meanU).padStart(7)}`
      + (edge ? `  |  FLAPS/yr ${num(edge.flaps / edge.lifters, 2).padStart(5)}` : ''),
    );
  };

  // ⚠️ The estimator sweeps run with HYSTERESIS OFF, on purpose. Hysteresis is a
  // display rule, and at the default band width its margin is ~6 % of the
  // estimate — enough to hide every difference between candidate half-lives
  // behind it, so every row scores zero flaps and the sweep measures nothing.
  // With it off, the flap column is the ESTIMATOR's own volatility, which is the
  // thing being watched. The hysteresis sweep below then measures the display
  // rule on top of the estimator that shipped.
  const sweep = (title, key, values, base = { hysteresis: 0 }) => {
    console.log(`\n── ${title} ───────────────────────────────────────`);
    const rows = [];
    for (const v of values) {
      const params = P({ ...base, [key]: v });
      const s = scoreEnsemble(LIFTERS, { params });
      const e = scoreEnsemble(EDGE, { params });
      rows.push({ v, s, e });
      row(`${key} = ${JSON.stringify(v)}`, s, e);
    }
    const best = rows.reduce((a, b) => (b.e.flaps < a.e.flaps ? b : a));
    const bestR = rows.reduce((a, b) => (b.s.rmse < a.s.rmse ? b : a));
    console.log(`  → fewest flaps at ${key} = ${JSON.stringify(best.v)}`
      + ` · best RMSE at ${key} = ${JSON.stringify(bestR.v)}`
      + `   (shipped: ${JSON.stringify(DEFAULTS[key])} — chosen on bias, lag and coverage, see header)`);
    return rows;
  };

  console.log('═══ BASELINE (js/strength-estimate.js DEFAULTS) ═══');
  row('defaults', scoreEnsemble(LIFTERS), scoreEnsemble(EDGE));

  /* ---------- 1. window, half-life, N ---------- */

  sweep('Recency half-life (§5)', 'halfLifeDays', [14, 21, 28, 42, 56]);
  sweep('Window (§5)', 'windowDays', [21, 28, 42, 56, 84]);
  sweep('Best-of-N (§5)', 'topN', [1, 2, 3, 4, 5]);

  /* ---------- 2. the fall limit ---------- */

  sweep('Fall limit per week (§5)', 'fallLimitPerWeek', [0, 0.01, 0.02, 0.03, 0.05, 1]);

  /* ---------- 3. hysteresis ---------- */

  sweep('Hysteresis (§6.1)', 'hysteresis', [0, 0.25, 0.5, 0.75, 1.0, 1.5], {});

  /* ---------- 4. the band, fitted to COVERAGE ---------- */

  console.log('\n── The band (§6) — fitted to coverage, not to flap ─────────');
  console.log('   target: the +-u band contains the truth ~95 % of the time UNDER MARZAGÃO, and');
  console.log('   stays above ~90 % under the other published curves (§CURVE below). The e1RM');
  console.log('   formula is correct BY CONSTRUCTION in here and research.md §1.3 says it was');
  console.log('   never validated, which is why the shipped uBase sits above the 95 % row.');
  for (const uBase of [0.04, 0.06, 0.08, 0.10, 0.13, 0.16]) {
    for (const uReps of [0, 0.07, 0.10]) {
      const params = P({ uBase, uReps });
      const s = scoreEnsemble(LIFTERS, { params });
      const e = scoreEnsemble(EDGE, { params });
      row(`uBase ${uBase} uReps ${uReps}`, s, e);
    }
  }

  /* ---------- 4b. contamination decides topN and winsorK ---------- */

  console.log('\n── topN and winsorK under a ×10 typo at day 150 ────────────');
  {
    const dirty = LIFTERS.map((l) => withTypo(l, { day: 150, kind: 'x10' }));
    const slip = LIFTERS.map((l) => withTypo(l, { day: 150, kind: 'digit' }));
    for (const topN of [1, 2, 3, 4]) {
      row(`topN ${topN}, clean`, scoreEnsemble(LIFTERS, { params: P({ topN }) }));
      row(`topN ${topN}, ×10 typo`, scoreEnsemble(dirty, { params: P({ topN }) }));
      row(`topN ${topN}, +50 lb slip`, scoreEnsemble(slip, { params: P({ topN }) }));
    }
    console.log('  — and with the plausibility screen on —');
    for (const topN of [1, 3]) {
      row(`topN ${topN}, ×10 + screen`, scoreEnsemble(dirty, { params: P({ topN }), screen: true }));
    }
  }

  /* ---------- 4c. u_stale — how fast does a frozen estimate go wrong? ---------- */

  console.log('\n── u_stale (§6): error growth after the evidence stops ─────');
  {
    // Freeze the estimate on the last day the lifter trained, then walk forward
    // against a truth that keeps moving. This is exactly what the app does to
    // somebody who stopped logging, and u_stale has to track it.
    const g = staleGrowth(LIFTERS);
    for (const w of Object.keys(g.weeks)) {
      console.log(`      +${String(w).padStart(2)} weeks   mean |error| ${pc(g.weeks[w].mean).padStart(8)}   (n=${g.weeks[w].n})`);
    }
    console.log(`      → growth ${pc(g.avgSlope)} per week averaged, ${pc(g.lateSlope)} per week over weeks 8–12`
      + `   (uStalePerWeek is ${DEFAULTS.uStalePerWeek}, the LATE figure)`);
  }

  /* ---------- 5. is f_position worth keeping? ---------- */

  console.log('\n── f_position, the weakest-justified factor (§3.2) ─────────');
  for (const d of [1, 0.97, 0.92]) {
    row(`positionDecay = ${d}`, scoreEnsemble(LIFTERS, { params: P({ positionDecay: d }) }),
      scoreEnsemble(EDGE, { params: P({ positionDecay: d }) }));
  }

  /* ================================================================== *
   * QUESTION 1 — should the aggregate be robust to an outlier?
   * ================================================================== */

  console.log('\n\n═══ Q1 · ROBUST AGGREGATE vs PLAIN WEIGHTED MEAN ═══');

  // (a) docs/handbook.md §9's shoulders case, arithmetically.
  {
    const credible = { x: 130, w: 1.00 };   // overhead press benchmark
    const second = { x: 122, w: 0.55 };     // dumbbell shoulder press, 8 reps
    const outlier = { x: 260, w: 0.06 };    // 15-rep face pull, converted at 0.30
    const clean = [credible, second];
    const dirty = [credible, second, outlier];
    console.log('\n  (a) the shoulders case from docs/handbook.md §9, in key-lift pounds');
    console.log(`      plain weighted mean    clean ${plainMean(clean).toFixed(1)} → dirty `
      + `${plainMean(dirty).toFixed(1)}   (+${((plainMean(dirty) / plainMean(clean) - 1) * 100).toFixed(1)} %)`);
    for (const k of [0.2, 0.25, 0.35, 0.5, 0.75]) {
      const c = robustAggregate(clean, P({ winsorK: k }));
      const d = robustAggregate(dirty, P({ winsorK: k }));
      console.log(`      winsorised k = ${k.toFixed(2)}      clean ${c.toFixed(1)} → dirty `
        + `${d.toFixed(1)}   (+${((d / c - 1) * 100).toFixed(1)} %)`);
    }
  }

  // (b) the honest spread winsorK must sit above — and how much it depends on
  //     the simulator's GUESSED noise.
  {
    const f = winsorFloor(LIFTERS);
    console.log(`\n  (b) honest spread of daily bests around their window median (n=${f.n})`);
    console.log(`      p90 ${f.p90.toFixed(3)}   p975 ${f.p975.toFixed(3)}`
      + `   p99 ${f.p99.toFixed(3)}   p9999 ${f.p9999.toFixed(3)}   → k floor ≈ ${(f.p9999 - 1).toFixed(3)}`);
    console.log('      ⚠️ under the guesses the simulator cannot source (readiness σ, σ15):');
    for (const [label, ov] of [
      ['σ15 = 0', { sigma15: 0 }],
      ['σ15 = 0.15', { sigma15: 0.15 }],
      ['readiness σ = 0.06', { readinessSigma: 0.06 }],
      ['readiness σ = 0.06, σ15 0.15', { readinessSigma: 0.06, sigma15: 0.15 }],
      ['no high-rep days', { highRepRate: 0 }],
    ]) {
      const g = winsorFloor(ensemble(24, ov));
      console.log(`         ${label.padEnd(32)} p9999 ×${g.p9999.toFixed(3)}  → k floor ≈ ${(g.p9999 - 1).toFixed(3)}`);
    }
    console.log('      so "pinned from both sides" holds within 0.18–0.29, not at 0.204 exactly.');
  }

  // (c) the ensemble version: several exercises rating ONE muscle, which is the
  //     shape the residual actually has.
  {
    console.log('\n  (c) 200 simulated muscles, three exercises each, error vs KNOWN truth');
    console.log(`      (personal ratio departure ${(RATIO_ERROR_AT_Q0 * 100).toFixed(0)} % log-SD at q=0 — ASSUMED)`);
    const m = muscleEnsembleScores([0.2, 0.25, 0.35, 0.5]);
    const show = (label, r) => console.log(`      ${label.padEnd(34)} bias ${pc(r.bias).padStart(8)}`
      + `   rmse ${pc(r.rmse).padStart(8)}   worst ${pc(r.worst).padStart(8)}`);
    show('no outlier exercise, plain mean', m.plainNoOutlier);
    show('+ face pull, plain mean', m.plainWithOutlier);
    for (const k of [0.2, 0.25, 0.35, 0.5]) show(`+ face pull, winsorised k = ${k}`, m.winsorWithOutlier[k]);
    for (const k of [0.25, 0.35]) show(`no outlier, winsorised k = ${k}  (cost)`, m.winsorNoOutlier[k]);
    console.log('      ⚠️ note the no-outlier plain worst is no better than the with-outlier one: what');
    console.log('      winsorising buys here is shrinkage toward the benchmark press, not face-pull taming.');
  }

  /* ================================================================== *
   * QUESTION 2 — how far may a high-rep set honestly be extrapolated?
   * ================================================================== */

  console.log('\n\n═══ Q2 · HIGH-REP EXTRAPOLATION ═══');

  for (const sigma of [0.05, REP_CURVE_SIGMA, 0.15]) {
    console.log(`\n  per-lifter rep-curve spread σ15 = ${sigma}  ⚠️ ASSUMED — nobody has measured it`);
    const t = repErrorTable(sigma);
    const at = (r) => t.find((x) => x.reps === r);
    for (const r of [1, 3, 5, 8, 10, 12, 15]) {
      const b = at(r);
      if (!b) continue;
      console.log(`    ${String(r).padStart(2)} reps  n=${String(b.n).padStart(4)}  `
        + `bias ${pc(Math.exp(b.meanLog) - 1).padStart(9)}  log-SD ${b.sd.toFixed(4)}  `
        + `95 % interval  ×${Math.exp(-1.96 * b.sd).toFixed(3)} … ×${Math.exp(1.96 * b.sd).toFixed(3)}`);
    }
    const extra = extraLogSdAt15(sigma);
    console.log(`    → EXTRA log-SD at 15 reps over 1 rep: ${extra.toFixed(4)}   so u_reps = ${extra.toFixed(2)}`);
  }

  // What that means for the case in docs/handbook.md §9.
  {
    console.log('\n  the seated calf raise from docs/handbook.md §9: 180 lb × 12, ratio 0.62');
    const est = e1rm(180, 12) / 0.62;
    const bounds = levelBoundaries('Calves');
    const names = ['Beginner', 'Novice', 'Intermediate', 'Proficient', 'Advanced', 'Expert', 'Elite'];
    const lvl = (w) => { let i = -1; bounds.forEach((b, k) => { if (w >= b) i = k; }); return i < 0 ? 'below Beginner' : names[i]; };
    console.log(`      standing-calf-raise equivalent  ${est.toFixed(0)} lb   reads ${lvl(est)}`);
    console.log(`      level boundaries               ${bounds.map((b) => b.toFixed(0)).join('  ')}`);
    for (const u of [0.10, 0.18, 0.25, 0.32, 0.40]) {
      console.log(`      ±${(u * 100).toFixed(0).padStart(2)} % band   `
        + `${(est * (1 - u)).toFixed(0)}–${(est * (1 + u)).toFixed(0)} lb   `
        + `= ${lvl(est * (1 - u))} … ${lvl(est * (1 + u))}`);
    }
    // And what the module DOES say, end to end, off that single set.
    const one = dailyValues([{ day: 0, exerciseId: 'calf', weight: 290, reps: 12 }]);
    const e = estimateAt(one, 0, {});
    console.log(`      module's own band off one 12-rep set: ±${(e.u * 100).toFixed(1)} %`
      + `  (effective_n ${e.effectiveN.toFixed(2)})  = ${lvl(est * (1 - e.u))} … ${lvl(est * (1 + e.u))}`);
  }

  /* ================================================================== *
   * QUESTION 3 — a mistyped number, or a PR?
   * ================================================================== */

  console.log('\n\n═══ Q3 · A TYPO vs A GENUINE PR ═══');

  {
    const g = trueGainQuantiles(LIFTERS);
    console.log(`  (a) true ln-gain per day, 28-day windows:  p50 ${g.p50.toFixed(5)}`
      + `  p95 ${g.p95.toFixed(5)}  p995 ${g.p995.toFixed(5)}  max ${g.max.toFixed(5)}`);
    console.log(`      ⚠️ p95 = p99.5 = max: this is DEFAULT_PHASES' build slope ln(1.14)/98 read back,`
      + ' not a measurement of anybody');
    console.log(`      PLAUSIBLE_GAIN.perDay = ${PLAUSIBLE_GAIN.perDay}`
      + ` = ${((Math.exp(PLAUSIBLE_GAIN.perDay * 7) - 1) * 100).toFixed(2)} % a week, ×${(PLAUSIBLE_GAIN.perDay / g.max).toFixed(2)} the simulator's fastest`);
  }

  {
    console.log('\n  (b) how far a genuine daily best sits above the standing estimate');
    const r = genuineDayRatios(LIFTERS);
    console.log(`      p50 ${r.p50.toFixed(3)}  p90 ${r.p90.toFixed(3)}  p99 ${r.p99.toFixed(3)}`
      + `  p999 ${r.p999.toFixed(3)}  max ${r.max.toFixed(3)}   (n=${r.n})`);
    for (const ic of [0.08, 0.12, 0.16, 0.20]) {
      console.log(`      intercept ${ic.toFixed(2)} → ${pc(r.fpAt(ic))} of genuine days flagged`);
    }
  }

  {
    console.log('\n  (c) detection by typo size, screened against the standing estimate');
    const r = genuineDayRatios(LIFTERS);
    console.log(`      false positives on genuine days: ${pc(r.fpAt(PLAUSIBLE_GAIN.intercept))} (n=${r.n})`);
    for (const spec of [
      { label: '×10', kind: 'x10' },
      { label: '+50 lb', kind: 'digit' },
      { label: '+10 %', kind: 'pct', magnitude: 0.10 },
      { label: '+15 %', kind: 'pct', magnitude: 0.15 },
      { label: '+25 %', kind: 'pct', magnitude: 0.25 },
      { label: '+40 %', kind: 'pct', magnitude: 0.40 },
    ]) {
      const d = typoDetection(LIFTERS, spec);
      console.log(`      ${spec.label.padEnd(8)} caught ${pc(d.caught).padStart(8)}  (n=${d.n})`);
    }
  }

  {
    console.log('\n  (d) what a 10× typo does to the estimate, with and without the screen');
    const dirty = LIFTERS.map((l) => withTypo(l, { day: 150, kind: 'x10' }));
    row('clean logs', scoreEnsemble(LIFTERS), scoreEnsemble(EDGE));
    row('one ×10 typo, no screen', scoreEnsemble(dirty));
    for (const k of [0.25, 0.35, 0.5]) {
      row(`  + winsorised k = ${k}`, scoreEnsemble(dirty, { params: P({ winsorK: k }) }));
    }
    row('  + the plausibility screen', scoreEnsemble(dirty, { screen: true }));
    row('clean logs + the screen (cost)', scoreEnsemble(LIFTERS, { screen: true }),
      scoreEnsemble(EDGE, { screen: true }));
    const slip = LIFTERS.map((l) => withTypo(l, { day: 150, kind: 'digit' }));
    row('one +50 lb slip, no screen', scoreEnsemble(slip));
    row('one +50 lb slip + screen', scoreEnsemble(slip, { screen: true }));
    void evaluate;
  }

  /* ================================================================== *
   * §CURVE — the true curve is not Marzagão (strength-accuracy-plan §3.11)
   * ================================================================== */

  console.log('\n\n═══ §CURVE · WHEN THE LIFTER\'S BODY DOES NOT FOLLOW MARZAGÃO ═══');
  console.log('  The simulator writes its truth with the curve the estimator inverts, so every');
  console.log('  table above is a SELF-CONSISTENCY result. Here the lifter\'s true reps↔%1RM curve');
  console.log('  is swapped for each published alternative and the estimator is run unchanged.');
  console.log('  Coverage is shown at the old uBase (0.10) and the shipped one.');
  {
    const uBases = [0.10, 0.13, 0.16];
    const rows = curveMismatch({ uBases });
    console.log(`\n  ${'true curve'.padEnd(34)} ${'bias'.padStart(8)} ${'rmse'.padStart(8)} ${'lag'.padStart(7)}`
      + uBases.map((u) => `   cov@${u}`).join('') + uBases.map((u) => `  band@${u}`).join(''));
    for (const r of rows) {
      console.log(`  ${r.label.padEnd(34)} ${pc(r.bias).padStart(8)} ${pc(r.rmse).padStart(8)} ${(num(r.lagDays) + 'd').padStart(7)}`
        + uBases.map((u) => pc(r.coverage[u], 1).padStart(11)).join('')
        + uBases.map((u) => ('±' + pc(r.meanU[u], 1)).padStart(11)).join(''));
    }
    const worst = rows.reduce((a, b) => (Math.abs(b.bias) > Math.abs(a.bias) ? b : a));
    console.log(`\n  → the largest bias is ${pc(worst.bias)} (${worst.label}); the ±4.6 % RMSE claim is`);
    console.log('    Marzagão-conditional and the unconditional error budget is about ±8 % of bias on');
    console.log('    top of it. uBase 0.13 is where the worst-case coverage among the FLATTER curves');
    console.log('    (the ones the literature actually documents) is back near 95 %; the mirror-steep');
    console.log('    lifter is undocumented and stays under-covered at any width short of ±20 %.');
  }

  /* ================================================================== *
   * PROVENANCE
   * ================================================================== */

  printProvenance(provenance({ lifters: LIFTERS, edge: EDGE }));

  console.log('\nDone. These tables are what js/strength-estimate.js DEFAULTS were set from.');
}
