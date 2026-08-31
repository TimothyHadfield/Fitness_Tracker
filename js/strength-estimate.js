// Estimating strength from ordinary workout sets.
//
// docs/strength-estimate-plan.md, Phase 0. Nothing in this file is wired to a
// screen — it is pure maths with the clock passed in, the same shape as
// e1rm.js, strength-standards.js and units.js, which is the pattern that has
// caught real bugs in this project because it is fully testable headlessly.
//
// ── THE ONE FACT THE WHOLE DESIGN RESTS ON ───────────────────────────────────
//
// The noise is ONE-SIDED. A set can be easier than maximal — submaximal effort,
// fatigue, a warm-up, a bad night's sleep. It can never be harder than what the
// lifter was actually capable of that day. So every observed e1RM is a LOWER
// BOUND on true strength, and three things follow:
//
//   · averaging is wrong — the mean of a day's sets is dragged down by every
//     warm-up in it, so two equally strong lifters read differently purely from
//     how they happen to structure a session;
//   · the right family of estimator is the UPPER ENVELOPE, not the centre;
//   · a dip is weak evidence and a peak is strong evidence, so the estimate
//     should rise readily and fall reluctantly.
//
// ── THE THREE THINGS THIS REFUSES TO DO ──────────────────────────────────────
//
// 1. ⚠️ IT DOES NOT REPORT A POINT. Every estimate leaves here as a value AND a
//    fractional band, and `displayLevel()` will not assert a level unless the
//    whole band sits inside it. That is not decoration: the honest answer to a
//    single twelve-rep seated calf raise is "somewhere between Advanced and
//    Elite" (measured: ±21.3 % off one set), and an app that says "Elite"
//    instead is lying with a straight face.
//    ⚠️ THOSE TWO FIGURES WERE WRONG HERE UNTIL 2026-09-02 — this said ±28.6 %
//    and "Proficient to Elite", where `tools/strength-fit.mjs` prints ±21.3 %
//    and `tests/strength-estimate.test.mjs` computes ±21.33 % from the shipped
//    constants and reports the span as levels 4–6. Reaching Proficient needs
//    about ±25 %. Neither number was ever asserted, which is why a prose slip
//    survived: the test pins the CONCLUSION (`certain: false`, three levels
//    spanned) and interpolates the value into its message.
// 2. ⚠️ IT DOES NOT LET ONE NUMBER RUN AWAY WITH THE ANSWER. The aggregate is
//    winsorised (see winsorK), so a low-credibility outlier at twice the
//    credible reading moves the result by a bounded amount rather than by its
//    full weight — measured on progress.md §9's shoulders case, +3.9 % becomes
//    +1.0 %, and across 200 simulated muscles the worst error halves.
// 3. ⚠️ IT DOES NOT TREAT AN IMPOSSIBLE JUMP AS A PR. An observation above what
//    training could plausibly have delivered since the last reading is
//    QUARANTINED — held, named, and admitted the moment something agrees with
//    it — rather than either trusted or thrown away. Measured, that turns a
//    single ×10 fat finger from a 343 % error into a 0.6 % one and costs
//    nothing at all on clean logs. It cannot separate a SMALL typo from a real
//    PR and does not pretend to; see PLAUSIBLE_GAIN.
//
// ── WHERE THE CONSTANTS COME FROM ────────────────────────────────────────────
//
// Everything in DEFAULTS below was fitted against `tools/strength-sim.mjs` — a
// virtual lifter with a KNOWN true 1RM curve (build, plateau, deload, rebuild)
// logging realistic sessions off it: warm-up ramps, top sets, back-offs, RIR
// 0–4, missed sessions and occasional 12–15 rep days. `tools/strength-fit.mjs`
// re-runs the sweeps and prints the tables. Where a constant could NOT be
// honestly fitted the comment says so outright and names what it would take.
//
// The quantity optimised is FLAP RATE — how often the displayed level changes
// while true strength did not — because that is the failure Tim actually
// reported ("mostly accurate and not all over the place"), and because bias and
// RMSE can both be made to look good by an estimator that never moves.

import { e1rm, isRankableSet, MAX_EVIDENCE_REPS } from './e1rm.js';

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

/**
 * A stored `YYYY-MM-DD` as an integer day number.
 *
 * ⚠️ Parsed by SPLITTING, never `new Date(iso)`. A bare date string is read as
 * UTC midnight, which lands a day early for everyone west of Greenwich — the
 * trap already recorded in progress.md §4 for `daysBetween()`. Date.UTC on the
 * split parts is pure calendar arithmetic with no zone in it at all, so the
 * difference between two day numbers is exactly the number of calendar days.
 */
export function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso == null ? '' : iso));
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000);
}

/* ------------------------------------------------------------------ *
 * The constants
 * ------------------------------------------------------------------ */

export const DEFAULTS = Object.freeze({
  /* — §3.2 f_load — how near a real effort was this set? ————————————— */
  // Compared against the lifter's own best e1RM on that exercise over the
  // trailing LOAD_REF_DAYS. 90 days rather than the window: the reference is
  // "what do we already believe you can do", and shortening it makes a lifter
  // who deloads for a month look like they are back at top effort.
  loadRefDays: 90,

  /* — §3.2 f_position — fatigue ————————————————————————————————————— */
  // 0.97 per set and per exercise into the session. Flagged in the plan as the
  // weakest-justified factor and the first to drop; the simulator agrees it is
  // nearly inert (removing it moved RMSE by 0.1 pp and flap rate not at all),
  // so it is kept ONLY because it is cheap and directionally certain, and its
  // decay is deliberately gentle enough that it cannot decide anything.
  positionDecay: 0.97,

  /* — §3.3 corroboration ———————————————————————————————————————————— */
  // Repeated performance is the closest thing available to the RIR field the
  // app deliberately does not have (D9): you do not hit your top load three
  // times if the first one was maximal. Within 3 % of the best set's e1RM
  // counts as agreeing; two such sets is the most that can be earned.
  corroborationBonus: 0.15,
  corroborationTolerance: 0.03,
  corroborationMax: 2,

  /* — §5 the window ————————————————————————————————————————————————— */
  // 42 days, widening to 84 then 180 when fewer than 3 daily values are in it.
  // Fitted: 28 days lags a genuine build by 6 more days for no gain in flap
  // rate; 84 days as the FIRST window raises lag by 11 days. 42 is the flat
  // part of the curve.
  windowDays: 42,
  widenTo: [84, 180],
  minDaily: 3,

  // Recency half-life inside the window. Swept 14/21/28/42/56 — see
  // tools/strength-fit.mjs. 28 was the joint best on flap rate and within
  // 0.2 pp of the best RMSE; shorter half-lives chase noise, longer ones lag.
  halfLifeDays: 28,

  // Best-of-N. N = 1 is a plain maximum, which lets one mistyped number define
  // a lifter forever; N = 5 flattens genuine peaks. Measured, N = 3 was the
  // best flap rate of 1/2/3/4/5 and it is also the one that can be explained in
  // one sentence, which this app requires of anything it ships.
  topN: 3,

  /* — bounding what one observation may do ——————————————————————————— */
  // ⚠️ THE ANSWER TO THE FIRST OF THE THREE RESIDUALS IN progress.md §9.
  //
  // A plain weighted mean lets an outlier at twice the credible reading move
  // the answer by its weight share, which for a 15-rep face pull beside an
  // overhead press benchmark is ~9 %. Winsorising first — clipping every
  // contributing value into [median/(1+k), median×(1+k)] before the weighted
  // mean — bounds that at a cost of nothing on clean data.
  //
  // k = 0.25 is fitted, not chosen, and two measurements pin it from opposite
  // sides. The FLOOR: the honest spread of a single lift's daily bests around
  // their own window median runs to ×1.204 at the 99.99th percentile
  // (n = 16,203), so anything below k = 0.21 starts clipping days a lifter
  // genuinely had. The CEILING: across 200 simulated muscles rated by three
  // exercises against a known truth, the worst error falls 19.8 % → 7.5 % at
  // k = 0.25 and only to 9.2 % at k = 0.35, while RMSE improves 4.54 % → 3.76 %.
  // ⚠️ It costs nothing on clean data — with no outlier present, winsorising at
  // 0.25 still improved RMSE (4.59 % → 3.86 %). That is the result that makes
  // this a free change rather than a trade.
  winsorK: 0.25,

  /* — §5 rising vs falling —————————————————————————————————————————— */
  // Rises immediately, falls at most 2 % a week of unconfirmed decline.
  //
  // ⚠️ MEASURED EFFECT: SMALL, AND KEPT FOR A STRUCTURAL REASON RATHER THAN A
  // NUMERICAL ONE. Across the deload the estimate reads 1.28 % below truth at
  // 2 %/week against 1.64 % with no limit at all — a third of a percentage
  // point. The window and the best-of-3 were already doing most of the work the
  // plan expected this to do. What settles it is the other end of the sweep:
  // 0 %/week (never falls) is a RATCHET — it reads 2.05 % high across the year
  // and could never report a genuine detraining loss at all. 2 %/week is the
  // slowest rate that is still a rate.
  fallLimitPerWeek: 0.02,

  /* — §6 the band ——————————————————————————————————————————————————— */
  // u = uBase/sqrt(effective_n) + u_stale + u_reps.
  //
  // uBase is fitted for CALIBRATION, not for looking confident: it is the value
  // at which the ±u band contains the true 1RM about 95 % of the time across
  // the simulated ensemble. Measured at uBase = 0.10 with uReps = 0.07:
  // coverage 95.2 %, mean band ±12.2 %.
  // ⚠️ That calibration is against a simulator whose e1RM formula is correct by
  // construction. research.md §1.3 says the formula's ABSOLUTE accuracy was
  // never validated, so the real band is wider than this by an unknown amount.
  // 95 % rather than 90 % is a deliberate lean in that direction; it is still
  // certainly too narrow, and §11.2's backtest is the only thing that can say
  // by how much.
  uBase: 0.10,

  // Staleness, applied only past the window: 0.4 % per week beyond 42 days
  // since the newest contributing observation, capped at 10 %.
  //
  // Measured by freezing an estimate on the last day a lifter trained and
  // walking it forward against a truth that keeps moving. Mean absolute error
  // goes 4.62 % at one week, 4.25 % at four — it IMPROVES, because the
  // estimator's own low bias is briefly cancelled by real gains — then 6.02 %
  // at twelve. So the growth is not linear: ~0.13 pp a week averaged over the
  // whole twelve, and 0.39 pp a week between weeks eight and twelve. 0.4 %/week
  // is the LATE figure, on purpose: staleness only matters in the tail, and
  // fitting it to the average would make it useless exactly where it is needed.
  // ⚠️ Still an underestimate. In the simulator a lifter who stops logging goes
  // on training the same programme; a real one has usually changed something,
  // which is often the reason they stopped logging.
  uStalePerWeek: 0.004,
  uStaleCap: 0.10,

  // How much wider the band gets when the estimate leans on high-rep sets.
  // Scaled by ln(r)/ln(15) so it is 0 at a single and 1 at the top of the
  // rankable range.
  //
  // ⚠️ THIS ONE COULD NOT BE HONESTLY FITTED, AND SAYING SO IS THE RESULT.
  // Measured as the extra log-SD of e1RM/true at 15 reps over 1 rep, it comes
  // out at 0.01, 0.07 or 0.12 depending entirely on how wide one assumes an
  // individual's own reps↔%1RM curve strays from the population's — an input
  // nobody has published for a library this size. 0.07 is the middle
  // assumption (σ15 = 0.10). It is a placeholder with a measurement attached,
  // not a fitted constant, and §11.2's backtest against real held-out
  // benchmarks is what would replace it.
  uReps: 0.07,

  /* — §6.1 hysteresis ——————————————————————————————————————————————— */
  // Once a level is displayed it only changes when the estimate clears the
  // boundary by more than `hysteresis` × the band half-width.
  //
  // ⚠️ 0.25, NOT THE PLAN'S 0.5, AND THE DIFFERENCE IS A MEASURED TRADE. Two
  // things are wanted at once and they pull opposite ways: flaps per lifter-
  // year on the boundary ensemble, and how long a REAL level change takes to
  // appear on screen.
  //
  //     hysteresis   flaps/yr   days to show a real level change
  //         0          3.67                15.0
  //         0.25       0.38                23.2
  //         0.50       0.00                32.5
  //
  // 0.38 flaps a year is one spurious colour change every three years for
  // somebody sitting exactly on a boundary — and that ensemble is the worst
  // case by construction; an ordinary lifter flaps zero times at any of these.
  // Buying the last 0.38 costs nine more days of silence when something
  // genuinely happened, and a goal in this app is twelve weeks long, so a month
  // of not noticing is a third of it. The shipping rule is therefore "under
  // half a flap per lifter-year, then minimise lag", and 0.25 is what it picks.
  hysteresis: 0.25,

  /* — §3 the gate ——————————————————————————————————————————————————— */
  // Above 15 reps nothing is evidence of a maximum. Inherited from D5 and
  // isRankableSet(), never re-implemented, so the two cannot drift.
  maxReps: MAX_EVIDENCE_REPS,
});

/* ------------------------------------------------------------------ *
 * §3.2 — the three factors
 * ------------------------------------------------------------------ */

/**
 * f_reps — how far the e1RM formula is being asked to extrapolate.
 *
 * The Marzagão curve is trustworthy at low reps and degrades above ~10 (D11,
 * research.md §1). Above 15 the set is limited by breathing, grip and pain
 * tolerance rather than by strength, and isRankableSet() rejects it outright.
 *
 * ⚠️ This is deliberately the SAME table as `repFactor()` in muscle-evidence.js
 * rather than an import. They answer the same question and today they agree —
 * but that module weighs an observation for a *muscle* rating built on
 * conversion ratios, and this one weighs it for a *lift* estimate with no ratio
 * in it, so they are entitled to diverge once both are fitted. A test asserts
 * they currently agree, which is what would catch a silent drift.
 */
export function repFactor(reps) {
  const r = Number(reps);
  if (!isRankableSet(r)) return 0;
  if (r <= 3) return 1.00;
  if (r <= 6) return 0.95;
  if (r <= 8) return 0.85;
  if (r <= 10) return 0.70;
  if (r <= 12) return 0.45;
  return 0.25;
}

/**
 * f_load — was this anywhere near a real effort?
 *
 * `ratio` is this set's e1RM over the lifter's own recent best on the same
 * exercise. A set at 80 % of what you did last week is not evidence that you
 * got weaker; it is simply not evidence.
 *
 * With no recent best to compare against this returns 1 rather than 0. The
 * alternative punishes the first session on a new exercise, which is precisely
 * the case where the app has least to say and most needs to say something.
 */
export function loadFactor(ratio) {
  const x = Number(ratio);
  if (!Number.isFinite(x)) return 1;
  if (x >= 0.97) return 1.00;
  if (x >= 0.92) return 0.75;
  if (x >= 0.85) return 0.40;
  return 0.10;
}

/**
 * f_position — fatigue, from set index within the exercise and exercise index
 * within the session. Both are zero-based; set 1 of exercise 1 is 1.0.
 */
export function positionFactor(setIndex, exerciseIndex, P = DEFAULTS) {
  const s = Math.max(0, Number(setIndex) || 0);
  const e = Math.max(0, Number(exerciseIndex) || 0);
  return Math.pow(P.positionDecay, s) * Math.pow(P.positionDecay, e);
}

/** Clamp for a per-set confidence. Never zero: an admissible set always says
 *  something, and a zero would silently drop it out of effective_n. */
export const MIN_CONFIDENCE = 0.02;

/* ------------------------------------------------------------------ *
 * §3.1 + §4 — from raw sets to one value per exercise per day
 * ------------------------------------------------------------------ */

/**
 * Group raw sets into per-exercise-per-day values.
 *
 * @param {Array} sets each { exerciseId, day|date, weight, reps, setIndex,
 *                            exerciseIndex, isBenchmark }
 *   `day` is an integer day number (see dayNumber()); `date` is accepted as a
 *   YYYY-MM-DD alternative. `weight` is in POUNDS and already total load —
 *   converting a per-side entry is the caller's job, exactly as it is in
 *   muscle-evidence.js, because this module never sees an exercise record.
 * @returns {Array} one row per exercise per day, ascending by day:
 *   { day, exerciseId, x, c, reps, corroborating, admissible, rejected,
 *     isBenchmark }
 *   `x` is the day's best admissible e1RM in pounds; `c` is its confidence.
 */
export function dailyValues(sets, P = DEFAULTS) {
  const rows = [];
  for (const s of sets || []) {
    if (!s) continue;
    const day = Number.isFinite(s.day) ? s.day : dayNumber(s.date);
    const weight = Number(s.weight);
    const reps = Number(s.reps);
    if (!Number.isFinite(day) || !(weight > 0) || !(reps >= 1)) continue;
    rows.push({
      day,
      exerciseId: s.exerciseId == null ? '' : String(s.exerciseId),
      weight,
      reps,
      setIndex: Number(s.setIndex) || 0,
      exerciseIndex: Number(s.exerciseIndex) || 0,
      isBenchmark: Boolean(s.isBenchmark),
      x: e1rm(weight, reps),
    });
  }

  // Group by exercise and day.
  const groups = new Map();
  for (const r of rows) {
    const key = r.exerciseId + '|' + r.day;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(r);
  }

  // Days ascending, so the running "recent best" only ever sees the past.
  const keys = [...groups.keys()].sort((a, b) => {
    const ga = groups.get(a)[0], gb = groups.get(b)[0];
    return ga.day - gb.day;
  });

  const history = new Map();   // exerciseId → [{ day, x }]
  const out = [];

  for (const key of keys) {
    const g = groups.get(key);
    const day = g[0].day;
    const exerciseId = g[0].exerciseId;

    // ── §3.1 the gate ────────────────────────────────────────────────────
    // A warm-up ramp set is one that comes BEFORE the day's heaviest set for
    // this exercise and is LIGHTER than it. Exact for normal ramping, and
    // correctly inert for reverse-pyramid training, where the heaviest set is
    // first so nothing precedes it — the later lighter sets there are
    // back-offs, which f_load down-weights rather than rejecting.
    let heaviest = -Infinity, heaviestAt = 0;
    g.forEach((r, i) => { if (r.weight > heaviest) { heaviest = r.weight; heaviestAt = i; } });

    const admissible = [];
    let rejected = 0;
    g.forEach((r, i) => {
      if (!isRankableSet(r.reps)) { rejected++; return; }
      if (i < heaviestAt && r.weight < heaviest) { rejected++; return; }
      admissible.push(r);
    });
    if (!admissible.length) continue;

    // ── §3.2 f_load's reference: this exercise's best over the trailing
    //    window of PRIOR days only. Using today's own sets would make every
    //    top set score 1.00 by construction.
    const past = history.get(exerciseId) || [];
    let recentBest = 0;
    for (const h of past) {
      if (day - h.day <= P.loadRefDays && h.x > recentBest) recentBest = h.x;
    }

    for (const r of admissible) {
      const fr = repFactor(r.reps);
      if (r.isBenchmark) {
        // A benchmark bypasses f_load and f_position entirely. That is what a
        // benchmark IS: a deliberate, fresh, chosen-rep-count test. It is also
        // how benchmarks stay the gold standard with no separate code path and
        // no separate chart.
        r.c = Math.min(1, Math.max(MIN_CONFIDENCE, fr));
      } else {
        const fl = recentBest > 0 ? loadFactor(r.x / recentBest) : 1;
        const fp = positionFactor(r.setIndex, r.exerciseIndex, P);
        r.c = Math.min(1, Math.max(MIN_CONFIDENCE, fr * fl * fp));
      }
    }

    // ── §4 one value per day: the admissible set with the highest e1RM ────
    let best = admissible[0];
    for (const r of admissible) if (r.x > best.x) best = r;

    // ── §3.3 corroboration ───────────────────────────────────────────────
    let corroborating = 0;
    for (const r of admissible) {
      if (r === best) continue;
      if (r.x >= best.x * (1 - P.corroborationTolerance)) corroborating++;
    }
    const c = Math.min(1, best.c
      * (1 + P.corroborationBonus * Math.min(corroborating, P.corroborationMax)));

    out.push({
      day,
      exerciseId,
      x: best.x,
      c,
      weight: best.weight,
      reps: best.reps,
      corroborating,
      admissible: admissible.length,
      rejected,
      isBenchmark: best.isBenchmark,
    });

    const h = history.get(exerciseId) || [];
    h.push({ day, x: best.x });
    history.set(exerciseId, h);
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * §5 — the windowed estimate
 * ------------------------------------------------------------------ */

function weightedMean(items) {
  let n = 0, d = 0;
  for (const it of items) { n += it.x * it.w; d += it.w; }
  return d > 0 ? n / d : null;
}

/** Weighted median, used only as the winsorising centre. */
export function weightedMedian(items) {
  const xs = [...items].sort((a, b) => a.x - b.x);
  const total = xs.reduce((a, b) => a + b.w, 0);
  if (!(total > 0)) return null;
  let run = 0;
  for (const it of xs) {
    run += it.w;
    if (run >= total / 2) return it.x;
  }
  return xs[xs.length - 1].x;
}

/**
 * ⚠️ THE ROBUST AGGREGATE — the answer to residual 1 in progress.md §9.
 *
 * Clip every contributing value into [m/(1+k), m×(1+k)] around the weighted
 * median m, THEN take the weighted mean. An outlier keeps its direction and
 * keeps its vote; what it loses is the ability to drag the answer an unbounded
 * distance because it happens to be enormous.
 *
 * Why winsorise rather than trim: trimming throws the observation away, and a
 * genuine PR is indistinguishable from a typo at the moment it arrives (see
 * PLAUSIBLE_GAIN). Clipping keeps it pushing in the right direction while it
 * waits to be corroborated, which is the behaviour a lifter would expect.
 *
 * Why not the median outright: §1 of the plan — the estimator wants the upper
 * envelope, and a median of the top three is a step toward the centre.
 */
export function robustAggregate(items, P = DEFAULTS) {
  const live = items.filter((it) => it.w > 0 && it.x > 0);
  if (!live.length) return null;
  if (!(P.winsorK > 0)) return weightedMean(live);
  const m = weightedMedian(live);
  if (!(m > 0)) return weightedMean(live);
  const hi = m * (1 + P.winsorK);
  const lo = m / (1 + P.winsorK);
  return weightedMean(live.map((it) => ({
    x: Math.min(hi, Math.max(lo, it.x)),
    w: it.w,
  })));
}

/**
 * Estimate strength at day `at`.
 *
 * @param {Array}  daily  output of dailyValues(), any number of exercises
 * @param {number} at     day number to estimate at
 * @param {Object} opts   { exerciseId, prev: { value, day }, params }
 * @returns null when there is nothing admissible, else
 *   { value, raw, u, lo, hi, effectiveN, used[], windowDays, widened,
 *     newestAgeDays, stale, meanRepLoad }
 */
export function estimateAt(daily, at, opts = {}) {
  const P = opts.params || DEFAULTS;
  const id = opts.exerciseId;
  const pool = (daily || []).filter((d) => d.day <= at
    && (id == null || d.exerciseId === id));
  if (!pool.length) return null;

  // ── the window, widening when it is too thin to say anything ───────────
  const spans = [P.windowDays, ...P.widenTo];
  let windowDays = spans[spans.length - 1];
  let inWindow = [];
  for (const span of spans) {
    inWindow = pool.filter((d) => at - d.day < span);
    if (inWindow.length >= P.minDaily) { windowDays = span; break; }
    windowDays = span;
  }
  if (!inWindow.length) {
    // Nothing at all inside 180 days. The estimate is not dropped — it is the
    // most recent thing known, flagged stale, exactly as §5 requires.
    inWindow = [pool[pool.length - 1]];
  }

  // ── confidence × recency ───────────────────────────────────────────────
  const scored = inWindow.map((d) => ({
    ...d,
    w: d.c * Math.pow(0.5, (at - d.day) / P.halfLifeDays),
  })).filter((d) => d.w > 0);
  if (!scored.length) return null;

  // ── best-of-N ──────────────────────────────────────────────────────────
  const used = [...scored].sort((a, b) => b.x - a.x).slice(0, P.topN);
  const raw = robustAggregate(used, P);
  if (!(raw > 0)) return null;

  // ── rise readily, fall reluctantly ─────────────────────────────────────
  let value = raw;
  const prev = opts.prev;
  if (prev && prev.value > 0 && Number.isFinite(prev.day) && raw < prev.value) {
    const weeks = Math.max(0, (at - prev.day) / 7);
    const floor = prev.value * Math.pow(1 - P.fallLimitPerWeek, weeks);
    value = Math.max(raw, Math.min(prev.value, floor));
  }

  // ── §6 the band ────────────────────────────────────────────────────────
  const effectiveN = used.reduce((a, u) => a + u.c, 0);
  const newestAgeDays = at - Math.max(...scored.map((d) => d.day));
  const uStale = Math.min(P.uStaleCap,
    P.uStalePerWeek * Math.max(0, newestAgeDays - P.windowDays) / 7);
  // Rep load: 0 at a single, 1 at the top of the rankable range, weighted by
  // what each contributor is actually worth.
  const wsum = used.reduce((a, u) => a + u.w, 0);
  const meanRepLoad = wsum > 0
    ? used.reduce((a, u) => a + repLoad(u.reps) * u.w, 0) / wsum
    : 0;
  const u = P.uBase / Math.sqrt(Math.max(1e-6, effectiveN))
    + uStale + P.uReps * meanRepLoad;

  return {
    value,
    raw,
    u,
    lo: value * (1 - u),
    hi: value * (1 + u),
    effectiveN,
    used,
    windowDays,
    widened: windowDays !== P.windowDays,
    newestAgeDays,
    // §5: nothing admissible for six weeks and the estimate stops claiming to
    // describe today. It keeps its value and gets labelled "as of <date>" —
    // never silently dropped, never silently held forever either.
    stale: newestAgeDays > 42,
    meanRepLoad,
  };
}

/** 0 at one rep, 1 at the top of the rankable range. Logarithmic because that
 *  is how the formula's extrapolation error grows — each doubling of reps costs
 *  about the same, not each extra rep. */
export function repLoad(reps) {
  const r = Math.min(MAX_EVIDENCE_REPS, Math.max(1, Number(reps) || 1));
  return Math.log(r) / Math.log(MAX_EVIDENCE_REPS);
}

/* ------------------------------------------------------------------ *
 * §6.1 — levels that do not flap
 * ------------------------------------------------------------------ */

/** Index of the level a weight falls in, given ascending boundary weights.
 *  -1 means below the first boundary, which is a real answer: "Untrained"
 *  would be a rude thing to call somebody who just started. */
export function levelIndexAt(boundaries, w) {
  let i = -1;
  for (let k = 0; k < boundaries.length; k++) if (w >= boundaries[k]) i = k;
  return i;
}

/**
 * What level to display, and whether to assert it at all.
 *
 * Two rules, and they do different jobs:
 *
 *   BAND-AWARE — a level is only asserted when the whole band sits inside it.
 *   When the band straddles a boundary the caller is handed both indices and
 *   should say "Intermediate, close to Proficient". This is the rule that stops
 *   one twelve-rep set reading Elite.
 *
 *   HYSTERESIS — once a level is displayed it changes only when the estimate
 *   clears the boundary by more than `hysteresis` × the band half-width. This
 *   is the rule that stops the body map changing colour every week.
 *
 * @param {Object} est        an estimateAt() result
 * @param {Array}  boundaries ascending level boundary weights
 * @param {Object} prev       { index } previously displayed, or null
 * @returns { index, certain, low, high, asserted }
 */
export function displayLevel(est, boundaries, prev, P = DEFAULTS) {
  if (!est || !(est.value > 0)) return null;
  const low = levelIndexAt(boundaries, est.lo);
  const high = levelIndexAt(boundaries, est.hi);
  let index = levelIndexAt(boundaries, est.value);

  if (prev && Number.isFinite(prev.index) && prev.index !== index) {
    // The boundary being crossed is the top of the lower of the two levels.
    const k = Math.min(prev.index, index);
    const boundary = boundaries[k + 1] !== undefined && index > prev.index
      ? boundaries[prev.index + 1]
      : boundaries[prev.index];
    if (boundary !== undefined && boundary > 0) {
      const margin = P.hysteresis * est.u * est.value;
      if (Math.abs(est.value - boundary) < margin) index = prev.index;
    }
  }

  return {
    index,
    low,
    high,
    // The whole band inside one level. Anything else and the UI must name two.
    certain: low === high,
    asserted: low === high ? index : null,
  };
}

/* ------------------------------------------------------------------ *
 * ⚠️ A mistyped number, or a PR?
 * ------------------------------------------------------------------ */

/**
 * The most a lifter's 1RM could plausibly have gained in `days`, as a ratio.
 *
 * ⚠️ READ THIS BEFORE USING IT. It is a ONE-SIDED screen, not a lie detector,
 * and the simulator says plainly where it stops working:
 *
 * Measured across the simulated ensemble at a 0.09 % false-positive rate on
 * genuine training days (n = 3,202):
 *
 *   ×10 fat finger (225 → 2250)   caught 100 %
 *   +40 %                         caught  99 %
 *   +25 %                         caught  77 %
 *   +15 %                         caught  19 %
 *   +10 %                         caught   5 %
 *
 * So a slip inside about 15 % is INDISTINGUISHABLE from a good day and is not
 * screened at all. There is no model that separates them, because there is
 * nothing in the data that differs. That is a result, not a gap to fill.
 *
 * The intercept is not slack: it absorbs the estimator's own downward bias.
 * The estimate is an upper envelope of submaximal work, so a genuinely maximal
 * set arrives above it even with no strength gain at all. Measured, a genuine
 * daily best sits at ×0.948 of the standing estimate at the median and ×1.124
 * at the 99.9th percentile; an intercept of 0.12 (= ×1.127) is exactly that
 * 99.9th percentile, which is where the 0.09 % false-positive rate comes from.
 *
 * The rate is measured off the simulator's own true curves: the fastest 28-day
 * stretch any of them runs is 0.00134 in ln-1RM per day, about 0.94 % a week.
 * ⚠️ 0.0019 is deliberately MORE generous than that (1.34 % a week), because
 * every curve in the simulator is a trained lifter's and a genuine novice gains
 * faster than any of them. It is a floor on plausibility for a trained lifter
 * and would need widening again before it could gate a beginner's first three
 * months. Nothing here does that yet, and nothing should until it is measured.
 */
export const PLAUSIBLE_GAIN = Object.freeze({
  perDay: 0.0019,
  intercept: 0.12,
  cap: 0.45,
});

export function plausibleCeiling(prior, days, G = PLAUSIBLE_GAIN) {
  const p = Number(prior);
  if (!(p > 0)) return null;
  const d = Math.max(0, Number(days) || 0);
  return p * Math.exp(Math.min(G.cap, G.intercept + G.perDay * d));
}

/**
 * Should this observation be allowed to lead, or held until something agrees?
 *
 * Quarantine is NOT rejection. The observation stays in the record, the UI can
 * name it, and a single corroborating set inside `withinDays` releases it. That
 * is the difference between "we do not believe you" and "one more set and we
 * will" — and it is the only honest position, because at the moment a PR
 * arrives it looks exactly like a typo.
 */
export function screenObservation(obs, prior, opts = {}) {
  const G = opts.gain || PLAUSIBLE_GAIN;
  if (!obs || !(obs.x > 0)) return { admit: false, reason: 'empty' };
  if (!prior || !(prior.value > 0)) return { admit: true, reason: 'no-prior' };
  const days = Math.max(0, obs.day - prior.day);
  const ceiling = plausibleCeiling(prior.value, days, G);
  if (obs.x <= ceiling) return { admit: true, reason: 'plausible', ceiling };
  const corroborated = Number(opts.corroborating) > 0;
  return {
    admit: corroborated,
    quarantined: !corroborated,
    reason: corroborated ? 'corroborated' : 'implausible',
    ceiling,
    excess: obs.x / ceiling - 1,
  };
}

// How a quarantined day gets released by LATER evidence. A real PR is almost
// always repeated — you do not hit a number once and never again — and a typo
// almost never is. 21 days is three sessions for most people; 0.9 is loose on
// purpose, because the second attempt at a new best is usually a little under
// it and demanding an exact match would quarantine real progress forever.
export const RELEASE_WINDOW_DAYS = 21;
export const RELEASE_TOLERANCE = 0.9;

/**
 * Walk a set of daily values in order and mark the implausible ones.
 *
 * Two passes, and the second is the one that makes this honest. The first pass
 * asks "could training have produced this since the last reading?"; the second
 * asks "did anything ever agree with it?" — same-day corroboration, or another
 * day within three weeks reaching 90 % of it. A quarantined row is kept in the
 * output with `quarantined: true` so the UI can name it. Nothing is deleted.
 */
export function screenDaily(daily, opts = {}) {
  const P = opts.params || DEFAULTS;
  const G = opts.gain || PLAUSIBLE_GAIN;
  const rows = [...(daily || [])].sort((a, b) => a.day - b.day);
  const out = [];
  let prev = null;

  for (const d of rows) {
    const v = screenObservation(d, prev, { gain: G, corroborating: d.corroborating });
    out.push({ ...d, quarantined: Boolean(v.quarantined), screenReason: v.reason, ceiling: v.ceiling });
    const live = out.filter((r) => !r.quarantined);
    const est = estimateAt(live, d.day, { params: P, prev });
    if (est) prev = { value: est.value, day: d.day };
  }

  // Pass 2 — release anything another day corroborated.
  //
  // ⚠️ A CORROBORATING DAY MAY ITSELF BE QUARANTINED, and the first version of
  // this got that wrong. A lifter who genuinely jumps has the second session
  // flagged too — both are above a ceiling computed from the estimate before
  // either — so requiring the witness to be clean meant two consecutive real
  // PRs held each other under and neither ever came out. Two independent days
  // agreeing IS the corroboration; that one number was typed twice is a much
  // smaller claim than that it was typed once.
  const released = new Set();
  for (const r of out) {
    if (!r.quarantined) continue;
    const agreed = out.some((o) => o !== r
      && Math.abs(o.day - r.day) <= RELEASE_WINDOW_DAYS
      && o.x >= r.x * RELEASE_TOLERANCE);
    if (agreed) released.add(r);
  }
  for (const r of released) { r.quarantined = false; r.screenReason = 'released'; }
  return out;
}
