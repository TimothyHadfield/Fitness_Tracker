// Fitting the estimator's constants — docs/strength-estimate-plan.md §11.1.
//
//   node tools/strength-fit.mjs
//
// DEV-ONLY, and slow. Every number written into DEFAULTS in
// js/strength-estimate.js came out of a table printed here, so that a later
// session can re-derive it rather than trust it. Nothing here is a test — the
// assertions on these outcomes live in tests/strength-estimate.test.mjs.
//
// ⚠️ THE QUANTITY BEING MINIMISED IS FLAP RATE, with RMSE and lag as tie-breaks
// and band coverage as a hard constraint. Bias is watched but never minimised:
// this estimator is DELIBERATELY biased low, because every observation it sees
// is a lower bound on the truth, and an unbiased reading of submaximal work
// would have to be inventing the effort the lifter left in reserve.
//
// ⚠️ AND FLAP RATE IS MEASURED ON THE BOUNDARY ENSEMBLE, not the ordinary one.
// See boundaryEnsemble() in strength-sim.mjs: an ordinary lifter spends a year
// in the middle of one level, so an ordinary ensemble scores every candidate
// constant at "about zero flaps" and discriminates nothing.

import {
  ensemble, boundaryEnsemble, scoreEnsemble, simulateLifter, simulateMuscle,
  evaluate, withTypo, levelBoundaries, REP_CURVE_SIGMA, RATIO_ERROR_AT_Q0,
} from './strength-sim.mjs';
import {
  DEFAULTS, dailyValues, estimateAt, robustAggregate, plausibleCeiling,
  PLAUSIBLE_GAIN,
} from '../js/strength-estimate.js';
import { e1rm } from '../js/e1rm.js';

const P = (over) => ({ ...DEFAULTS, ...over });
const pc = (x, d = 2) => (Number.isFinite(x) ? (x * 100).toFixed(d) + ' %' : '   —  ');
const num = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '  —');

const LIFTERS = ensemble(24);
const EDGE = boundaryEnsemble(21);

function row(label, s, edge) {
  console.log(
    `  ${label.padEnd(24)} bias ${pc(s.bias).padStart(8)}  rmse ${pc(s.rmse).padStart(8)}`
    + `  lag ${num(s.lagDays).padStart(5)}d  lvlLag ${num(s.levelLagDays).padStart(5)}d`
    + `  deload ${pc(s.deloadWorst).padStart(8)}  cov ${pc(s.coverage).padStart(7)}`
    + `  assert ${pc(s.assertRate).padStart(7)}  meanU ${pc(s.meanU).padStart(7)}`
    + (edge ? `  |  FLAPS/yr ${num(edge.flaps / edge.lifters, 2).padStart(5)}` : ''),
  );
}

// ⚠️ The estimator sweeps run with HYSTERESIS OFF, on purpose. Hysteresis is a
// display rule, and at the default band width its margin is ~6 % of the
// estimate — enough to hide every difference between candidate half-lives
// behind it, so every row scores zero flaps and the sweep measures nothing.
// With it off, the flap column is the ESTIMATOR's own volatility, which is the
// thing being fitted. The hysteresis sweep below then measures the display rule
// on top of the estimator that won.
function sweep(title, key, values, base = { hysteresis: 0 }) {
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
    + ` · best RMSE at ${key} = ${JSON.stringify(bestR.v)}`);
  return rows;
}

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
console.log('   target: the +-u band contains the truth ~95 % of the time. Wider than');
console.log('   the RMSE alone would ask for, because the e1RM formula is correct BY');
console.log('   CONSTRUCTION in here and research.md §1.3 says it was never validated.');
for (const uBase of [0.04, 0.06, 0.08, 0.10, 0.13]) {
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
  const byWeek = new Map();
  for (const l of LIFTERS) {
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
  const rows = [...byWeek.entries()].sort((a, b) => a[0] - b[0]);
  for (const [w, xs] of rows) {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`      +${String(w).padStart(2)} weeks   mean |error| ${pc(m).padStart(8)}   (n=${xs.length})`);
  }
  const first = rows[0][1].reduce((a, b) => a + b, 0) / rows[0][1].length;
  const last = rows[rows.length - 1][1].reduce((a, b) => a + b, 0) / rows[rows.length - 1][1].length;
  const perWeek = (last - first) / (rows[rows.length - 1][0] - rows[0][0]);
  console.log(`      → growth ${pc(perWeek)} per week   (uStalePerWeek is ${DEFAULTS.uStalePerWeek})`);
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

const plain = (items) => {
  let n = 0, d = 0; for (const i of items) { n += i.x * i.w; d += i.w; } return n / d;
};

// (a) progress.md §9's shoulders case, arithmetically.
{
  const credible = { x: 130, w: 1.00 };   // overhead press benchmark
  const second = { x: 122, w: 0.55 };     // dumbbell shoulder press, 8 reps
  const outlier = { x: 260, w: 0.06 };    // 15-rep face pull, converted at 0.30
  const clean = [credible, second];
  const dirty = [credible, second, outlier];
  console.log('\n  (a) the shoulders case from progress.md §9, in key-lift pounds');
  console.log(`      plain weighted mean    clean ${plain(clean).toFixed(1)} → dirty `
    + `${plain(dirty).toFixed(1)}   (+${((plain(dirty) / plain(clean) - 1) * 100).toFixed(1)} %)`);
  for (const k of [0.2, 0.25, 0.35, 0.5, 0.75]) {
    const c = robustAggregate(clean, P({ winsorK: k }));
    const d = robustAggregate(dirty, P({ winsorK: k }));
    console.log(`      winsorised k = ${k.toFixed(2)}      clean ${c.toFixed(1)} → dirty `
      + `${d.toFixed(1)}   (+${((d / c - 1) * 100).toFixed(1)} %)`);
  }
}

// (b) the honest spread winsorK must sit above.
{
  const ratios = [];
  for (const l of LIFTERS) {
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
  const q = (p) => ratios[Math.min(ratios.length - 1, Math.floor(p * ratios.length))];
  console.log(`\n  (b) honest spread of daily bests around their window median (n=${ratios.length})`);
  console.log(`      p90 ${q(0.90).toFixed(3)}   p975 ${q(0.975).toFixed(3)}`
    + `   p99 ${q(0.99).toFixed(3)}   p9999 ${q(0.9999).toFixed(3)}`);
}

// (c) the ensemble version: several exercises rating ONE muscle, which is the
//     shape the residual actually has.
{
  console.log('\n  (c) 200 simulated muscles, three exercises each, error vs KNOWN truth');
  console.log(`      (personal ratio departure ${(RATIO_ERROR_AT_Q0 * 100).toFixed(0)} % log-SD at q=0)`);
  const withOutlier = [];
  const withoutOutlier = [];
  for (let i = 0; i < 200; i++) {
    const full = simulateMuscle(30000 + i * 131);
    const trimmed = {
      truth: full.truth,
      observations: full.observations.filter((o) => o.exerciseId !== 'face-pull'),
    };
    withOutlier.push(full);
    withoutOutlier.push(trimmed);
  }
  // muscle-evidence.js's own weighting, reproduced here so the comparison is
  // against what SHIPS rather than against a straw man.
  const repF = (r) => (r <= 3 ? 1 : r <= 6 ? 0.95 : r <= 8 ? 0.85 : r <= 10 ? 0.7 : r <= 12 ? 0.45 : 0.25);
  const recency = (a) => Math.pow(0.5, a / 120);
  const items = (m) => {
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
  const score = (set, agg) => {
    let sum = 0, sq = 0, worst = 0;
    for (const m of set) {
      const v = agg(items(m));
      const e = (v - m.truth) / m.truth;
      sum += e; sq += e * e; worst = Math.max(worst, Math.abs(e));
    }
    return { bias: sum / set.length, rmse: Math.sqrt(sq / set.length), worst };
  };
  const show = (label, r) => console.log(`      ${label.padEnd(34)} bias ${pc(r.bias).padStart(8)}`
    + `   rmse ${pc(r.rmse).padStart(8)}   worst ${pc(r.worst).padStart(8)}`);
  show('no outlier exercise, plain mean', score(withoutOutlier, plain));
  show('+ face pull, plain mean', score(withOutlier, plain));
  for (const k of [0.2, 0.25, 0.35, 0.5]) {
    show(`+ face pull, winsorised k = ${k}`,
      score(withOutlier, (it) => robustAggregate(it, P({ winsorK: k }))));
  }
  for (const k of [0.25, 0.35]) {
    show(`no outlier, winsorised k = ${k}  (cost)`,
      score(withoutOutlier, (it) => robustAggregate(it, P({ winsorK: k }))));
  }
}

/* ================================================================== *
 * QUESTION 2 — how far may a high-rep set honestly be extrapolated?
 * ================================================================== */

console.log('\n\n═══ Q2 · HIGH-REP EXTRAPOLATION ═══');

function repErrorTable(sigma15) {
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

const REP_TABLES = {};
for (const sigma of [0.05, REP_CURVE_SIGMA, 0.15]) {
  console.log(`\n  per-lifter rep-curve spread σ15 = ${sigma}  ⚠️ ASSUMED — nobody has measured it`);
  const t = repErrorTable(sigma);
  REP_TABLES[sigma] = t;
  const at = (r) => t.find((x) => x.reps === r);
  for (const r of [1, 3, 5, 8, 10, 12, 15]) {
    const b = at(r);
    if (!b) continue;
    console.log(`    ${String(r).padStart(2)} reps  n=${String(b.n).padStart(4)}  `
      + `bias ${pc(Math.exp(b.meanLog) - 1).padStart(9)}  log-SD ${b.sd.toFixed(4)}  `
      + `95 % interval  ×${Math.exp(-1.96 * b.sd).toFixed(3)} … ×${Math.exp(1.96 * b.sd).toFixed(3)}`);
  }
  const one = at(1), fifteen = at(15);
  const extra = Math.sqrt(Math.max(0, fifteen.sd ** 2 - one.sd ** 2));
  console.log(`    → EXTRA log-SD at 15 reps over 1 rep: ${extra.toFixed(4)}   so u_reps = ${extra.toFixed(2)}`);
}

// What that means for the case in progress.md §9.
{
  console.log('\n  the seated calf raise from progress.md §9: 180 lb × 12, ratio 0.62');
  const est = e1rm(180, 12) / 0.62;
  const bounds = levelBoundaries('Calves');
  const names = ['Beginner', 'Novice', 'Intermediate', 'Proficient', 'Advanced', 'Expert', 'Elite'];
  const lvl = (w) => { let i = -1; bounds.forEach((b, k) => { if (w >= b) i = k; }); return i < 0 ? 'below Beginner' : names[i]; };
  console.log(`      standing-calf-raise equivalent  ${est.toFixed(0)} lb   reads ${lvl(est)}`);
  console.log(`      level boundaries               ${bounds.map((b) => b.toFixed(0)).join('  ')}`);
  // The band this module would actually put on one 12-rep set with no history.
  const daily = dailyValues([{ day: 0, exerciseId: 'calf', weight: 180 * 0.62 * 0 + 290, reps: 12 }]);
  for (const u of [0.10, 0.18, 0.25, 0.32, 0.40]) {
    console.log(`      ±${(u * 100).toFixed(0).padStart(2)} % band   `
      + `${(est * (1 - u)).toFixed(0)}–${(est * (1 + u)).toFixed(0)} lb   `
      + `= ${lvl(est * (1 - u))} … ${lvl(est * (1 + u))}`);
  }
  // And what the module DOES say, end to end, off that single set.
  const one = dailyValues([{ day: 0, exerciseId: 'calf', weight: 290, reps: 12 }]);
  const e = estimateAt(one, 0, {});
  console.log(`      module's own band off one 12-rep set: ±${(e.u * 100).toFixed(1)} %`
    + `  (effective_n ${e.effectiveN.toFixed(2)})`);
}

/* ================================================================== *
 * QUESTION 3 — a mistyped number, or a PR?
 * ================================================================== */

console.log('\n\n═══ Q3 · A TYPO vs A GENUINE PR ═══');

{
  const gains = [];
  for (const l of LIFTERS) {
    for (let d = 0; d + 28 < l.days; d++) gains.push(Math.log(l.trueMax(d + 28) / l.trueMax(d)) / 28);
  }
  gains.sort((a, b) => a - b);
  const q = (p) => gains[Math.min(gains.length - 1, Math.floor(p * gains.length))];
  console.log(`  (a) true ln-gain per day, 28-day windows:  p50 ${q(0.5).toFixed(5)}`
    + `  p95 ${q(0.95).toFixed(5)}  p995 ${q(0.995).toFixed(5)}  max ${q(1).toFixed(5)}`);
  console.log(`      PLAUSIBLE_GAIN.perDay = ${PLAUSIBLE_GAIN.perDay}`
    + ` = ${((Math.exp(PLAUSIBLE_GAIN.perDay * 7) - 1) * 100).toFixed(2)} % a week`);
}

{
  console.log('\n  (b) how far a genuine daily best sits above the standing estimate');
  const rs = [];
  for (const l of LIFTERS) {
    const daily = dailyValues(l.sets);
    for (const d of daily) {
      const before = estimateAt(daily.filter((x) => x.day < d.day), d.day - 1, {});
      if (before) rs.push(d.x / before.value);
    }
  }
  rs.sort((a, b) => a - b);
  const q = (p) => rs[Math.min(rs.length - 1, Math.floor(p * rs.length))];
  console.log(`      p50 ${q(0.5).toFixed(3)}  p90 ${q(0.9).toFixed(3)}  p99 ${q(0.99).toFixed(3)}`
    + `  p999 ${q(0.999).toFixed(3)}  max ${q(1).toFixed(3)}   (n=${rs.length})`);
  for (const ic of [0.08, 0.12, 0.16, 0.20]) {
    const fp = rs.filter((r) => r > Math.exp(ic)).length / rs.length;
    console.log(`      intercept ${ic.toFixed(2)} → ${pc(fp)} of genuine days flagged`);
  }
}

{
  console.log('\n  (c) detection by typo size, screened against the standing estimate');
  const days = [90, 120, 150, 180, 240, 300];
  // False positives, measured once: the same screen over every genuine day.
  let fp = 0, fpTotal = 0;
  for (const l of LIFTERS) {
    const daily = dailyValues(l.sets);
    for (const d of daily) {
      const before = estimateAt(daily.filter((x) => x.day < d.day), d.day - 1, {});
      if (!before) continue;
      fpTotal++;
      if (d.x > plausibleCeiling(before.value, 1)) fp++;
    }
  }
  console.log(`      false positives on genuine days: ${pc(fp / fpTotal)} (n=${fpTotal})`);
  for (const spec of [
    { label: '×10', kind: 'x10' },
    { label: '+50 lb', kind: 'digit' },
    { label: '+10 %', kind: 'pct', magnitude: 0.10 },
    { label: '+15 %', kind: 'pct', magnitude: 0.15 },
    { label: '+25 %', kind: 'pct', magnitude: 0.25 },
    { label: '+40 %', kind: 'pct', magnitude: 0.40 },
  ]) {
    let caught = 0, total = 0;
    for (const l of LIFTERS) {
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
    console.log(`      ${spec.label.padEnd(8)} caught ${pc(caught / total).padStart(8)}  (n=${total})`);
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

console.log('\nDone. These tables are what js/strength-estimate.js DEFAULTS were set from.');
