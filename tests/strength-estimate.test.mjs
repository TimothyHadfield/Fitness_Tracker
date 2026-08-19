// Headless tests for the strength estimator. No dependencies.
//   node tests/strength-estimate.test.mjs
//
// docs/strength-estimate-plan.md Phase 0 · §3, §5, §6, §11.
//
// ⚠️ THE MOST VALUABLE TESTS IN HERE ASSERT MEASURED SIMULATOR OUTCOMES, not
// that the code runs. Anyone can write an estimator that returns a number; the
// question this file answers is whether that number tracks a KNOWN true 1RM
// curve, how far off it is, and how often the displayed level moves while the
// truth stands still. The simulator is deterministic, so those figures are
// exact and a change to any constant will move them.
//
// The three refusals in the module header are asserted directly, each with a
// VACUITY GUARD alongside it — a companion assertion showing the same check
// fails when the mechanism is switched off, so that "it passed" means the
// mechanism did something rather than that the test was looking the wrong way.

const {
  DEFAULTS, dayNumber, repFactor, loadFactor, positionFactor, repLoad,
  dailyValues, estimateAt, robustAggregate, weightedMedian,
  levelIndexAt, displayLevel, plausibleCeiling, screenObservation, screenDaily,
  PLAUSIBLE_GAIN, MIN_CONFIDENCE,
} = await import('../js/strength-estimate.js');
const { e1rm } = await import('../js/e1rm.js');
const sim = await import('../tools/strength-sim.mjs');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pc = (x) => (x * 100).toFixed(2) + ' %';
const P = (over) => ({ ...DEFAULTS, ...over });

/* ================= §3.1 the gate ================= */

{
  // A normal ramp: three warm-ups, a top set, two back-offs.
  const day = [
    { day: 0, exerciseId: 'bp', weight: 135, reps: 8, setIndex: 0 },
    { day: 0, exerciseId: 'bp', weight: 185, reps: 5, setIndex: 1 },
    { day: 0, exerciseId: 'bp', weight: 225, reps: 3, setIndex: 2 },
    { day: 0, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 3 },   // top
    { day: 0, exerciseId: 'bp', weight: 225, reps: 7, setIndex: 4 },   // back-off
    { day: 0, exerciseId: 'bp', weight: 205, reps: 8, setIndex: 5 },   // back-off
  ];
  const [d] = dailyValues(day);
  ok(d.rejected === 3, `three warm-up ramp sets rejected, ${d.rejected} found`);
  ok(d.admissible === 3, 'the top set and both back-offs survive — a back-off is weak evidence, not none');
  ok(near(d.x, e1rm(250, 5), 1e-9), 'the day carries the best admissible e1RM, not the mean');

  // Reverse pyramid: the heaviest set is FIRST, so nothing precedes it.
  const rp = [
    { day: 0, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 0 },
    { day: 0, exerciseId: 'bp', weight: 225, reps: 7, setIndex: 1 },
    { day: 0, exerciseId: 'bp', weight: 205, reps: 8, setIndex: 2 },
  ];
  const [r] = dailyValues(rp);
  ok(r.rejected === 0,
     'reverse-pyramid training loses NOTHING — the ramp rule is "before AND lighter", '
     + 'so a session with the heavy set first has no warm-ups to find');

  // D5's rep gate, inherited rather than re-implemented.
  const burnout = dailyValues([
    { day: 0, exerciseId: 'bp', weight: 135, reps: 25, setIndex: 0 },
  ]);
  ok(burnout.length === 0, 'a 25-rep burnout set is not evidence of a maximum at all (D5)');
  ok(repFactor(16) === 0 && repFactor(15) === 0.25, 'the gate sits exactly at 15 reps');
}

/* ================= §3.2 the three factors ================= */

ok(repFactor(1) === 1 && repFactor(5) === 0.95 && repFactor(12) === 0.45,
   'f_reps follows the plan §3.2 table');
ok(loadFactor(1.0) === 1 && loadFactor(0.94) === 0.75 && loadFactor(0.8) === 0.10,
   'f_load: a set at 80 % of your recent best is not evidence you got weaker, it is just not evidence');
ok(loadFactor(undefined) === 1,
   'with no recent best to compare against f_load is 1, not 0 — the first session on a new '
   + 'exercise is when the app has least to say and most needs to say something');
ok(near(positionFactor(0, 0), 1, 1e-12) && positionFactor(4, 1) < positionFactor(0, 0),
   'f_position costs something for being set 5 of exercise 2');

{
  // f_load is measured against PRIOR days only. Using today's own sets would
  // make every top set score 1.00 by construction.
  const sets = [
    { day: 0, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 0 },
    { day: 7, exerciseId: 'bp', weight: 185, reps: 5, setIndex: 0 },   // a light day
  ];
  const out = dailyValues(sets);
  ok(out[1].c < out[0].c * 0.5,
     `a day at 74 % of last week's load carries far less confidence (${out[1].c.toFixed(3)} `
     + `vs ${out[0].c.toFixed(3)})`);
}

{
  // A benchmark bypasses f_load and f_position: that is what a benchmark IS.
  const ordinary = dailyValues([
    { day: 0, exerciseId: 'bp', weight: 250, reps: 3, setIndex: 4, exerciseIndex: 2 },
  ]);
  const bench = dailyValues([
    { day: 0, exerciseId: 'bp', weight: 250, reps: 3, setIndex: 4, exerciseIndex: 2, isBenchmark: true },
  ]);
  ok(bench[0].c === 1 && ordinary[0].c < 1,
     'a benchmark takes c = f_reps flat, so a fresh deliberate test is never docked for fatigue');
}

/* ================= §3.3 corroboration ================= */

{
  const one = dailyValues([
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
  ]);
  const three = dailyValues([
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 1 },
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 2 },
  ]);
  ok(three[0].corroborating === 2, 'two other sets inside 3 % count as corroborating');
  ok(three[0].c > one[0].c,
     'and three sets at 225x5 is stronger evidence than one — the closest thing available '
     + 'to the RIR field the app deliberately does not have (D9)');
  const four = dailyValues([
    ...[0, 1, 2, 3].map((i) => ({ day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: i })),
  ]);
  ok(four[0].c === three[0].c, 'and the bonus is capped at two — a fourth repeat buys nothing');
}

/* ================= §4/§5 the windowed estimate ================= */

{
  const sets = [];
  for (let w = 0; w < 12; w++) {
    sets.push({ day: w * 7, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 });
  }
  const daily = dailyValues(sets);
  const est = estimateAt(daily, 77, {});
  ok(est && est.windowDays === DEFAULTS.windowDays && !est.widened,
     'twelve weekly sessions fill the 42-day window without widening it');
  ok(near(est.value, e1rm(225, 5), 1.5),
     `a flat lifter estimates flat (${est.value.toFixed(1)} vs ${e1rm(225, 5).toFixed(1)})`);

  const thin = estimateAt(dailyValues([
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 30, exerciseId: 'bp', weight: 230, reps: 5, setIndex: 0 },
    { day: 60, exerciseId: 'bp', weight: 235, reps: 5, setIndex: 0 },
  ]), 70, {});
  ok(thin.widened && thin.windowDays === 84,
     'three readings a month apart widen the window to 84 days rather than reporting from one');
  const emptier = estimateAt(dailyValues([
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 60, exerciseId: 'bp', weight: 230, reps: 5, setIndex: 0 },
  ]), 70, {});
  ok(emptier.windowDays === 180,
     'and two readings widen all the way to 180 rather than stopping short — the widening is '
     + 'driven by how much evidence is in the window, not by how far back the oldest one sits');

  const stale = estimateAt(daily, 77 + 60, {});
  ok(stale.stale && stale.u > est.u,
     'and an estimate nobody has fed for two months is flagged stale AND carries a wider band '
     + '— kept, labelled, never silently dropped and never silently held forever');
}

{
  // §1's central claim, as a test: averaging is wrong because the noise is
  // one-sided. The estimator must sit at the TOP of a session, not its middle.
  const day = [
    { day: 0, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 0 },
    { day: 0, exerciseId: 'bp', weight: 205, reps: 8, setIndex: 1 },
    { day: 0, exerciseId: 'bp', weight: 185, reps: 10, setIndex: 2 },
  ];
  const [d] = dailyValues(day);
  const meanOfDay = day.reduce((a, s) => a + e1rm(s.weight, s.reps), 0) / 3;
  ok(d.x > meanOfDay,
     `the day reads its upper envelope (${d.x.toFixed(0)}), not its mean (${meanOfDay.toFixed(0)}) `
     + '— every back-off in a session drags a mean down, so two equally strong lifters would '
     + 'read differently purely from how they structure a session');
}

{
  // Rise readily, fall reluctantly.
  const daily = dailyValues([
    { day: 0, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 0 },
    { day: 7, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 0 },
    { day: 14, exerciseId: 'bp', weight: 250, reps: 5, setIndex: 0 },
    { day: 21, exerciseId: 'bp', weight: 185, reps: 5, setIndex: 0 },   // deload week
  ]);
  const before = estimateAt(daily, 14, {});
  const after = estimateAt(daily, 21, { prev: { value: before.value, day: 14 } });
  ok(after.value >= before.value * Math.pow(1 - DEFAULTS.fallLimitPerWeek, 1) - 1e-9,
     'a deload week cannot drop the estimate more than the fall limit allows');
  const unlimited = estimateAt(daily, 21, {
    prev: { value: before.value, day: 14 }, params: P({ fallLimitPerWeek: 1 }),
  });
  ok(unlimited.value <= after.value,
     'VACUITY GUARD: with the limiter switched off the same week does fall further');
}

/* ================= §ROBUST · Q1 ================= */

{
  // progress.md §9's shoulders case: an overhead press benchmark, a dumbbell
  // press, and a 15-rep face pull converting to twice the credible reading.
  const credible = { x: 130, w: 1.00 };
  const second = { x: 122, w: 0.55 };
  const outlier = { x: 260, w: 0.06 };
  const plainMean = (items) => {
    let n = 0, d = 0; for (const i of items) { n += i.x * i.w; d += i.w; } return n / d;
  };
  const cleanPlain = plainMean([credible, second]);
  const dirtyPlain = plainMean([credible, second, outlier]);
  const cleanRobust = robustAggregate([credible, second]);
  const dirtyRobust = robustAggregate([credible, second, outlier]);
  const plainNudge = dirtyPlain / cleanPlain - 1;
  const robustNudge = dirtyRobust / cleanRobust - 1;

  ok(plainNudge > 0.03,
     `a plain weighted mean lets a 6 %-credibility outlier nudge the answer ${pc(plainNudge)} — `
     + 'the first residual in progress.md §9');
  ok(robustNudge < plainNudge / 2.5,
     `winsorising at k = ${DEFAULTS.winsorK} cuts that to ${pc(robustNudge)}`);
  ok(near(cleanRobust, cleanPlain, 0.5),
     'VACUITY GUARD: with no outlier present the two aggregates agree, so the winsoriser '
     + 'is not simply lowering everything');
  ok(robustAggregate([credible, second, outlier], P({ winsorK: 0 })) === dirtyPlain,
     'and winsorK = 0 reproduces the plain mean exactly, so the comparison is like for like');
  ok(weightedMedian([{ x: 1, w: 1 }, { x: 5, w: 1 }, { x: 100, w: 1 }]) === 5,
     'the winsorising centre is a weighted median, which the outlier cannot move');
}

{
  // The ensemble version, against a KNOWN truth. This is the measurement the
  // recommendation to js/muscle-evidence.js rests on.
  const repF = (r) => (r <= 3 ? 1 : r <= 6 ? 0.95 : r <= 8 ? 0.85 : r <= 10 ? 0.7 : r <= 12 ? 0.45 : 0.25);
  const items = (m) => {
    const perEx = new Map();
    for (const o of m.observations) {
      const prev = perEx.get(o.exerciseId);
      if (!prev || o.estimate > prev.estimate) perEx.set(o.exerciseId, o);
    }
    return [...perEx.values()].map((o) => ({
      x: o.estimate,
      w: o.quality * repF(o.reps) * Math.pow(0.5, o.ageDays / 120) * (o.isBenchmark ? 1.25 : 1),
    })).sort((a, b) => b.w - a.w || b.x - a.x).slice(0, 3);
  };
  const muscles = [];
  for (let i = 0; i < 200; i++) muscles.push(sim.simulateMuscle(30000 + i * 131));
  const score = (agg) => {
    let sq = 0, worst = 0;
    for (const m of muscles) {
      const e = (agg(items(m)) - m.truth) / m.truth;
      sq += e * e; worst = Math.max(worst, Math.abs(e));
    }
    return { rmse: Math.sqrt(sq / muscles.length), worst };
  };
  const plain = score((it) => { let n = 0, d = 0; for (const i of it) { n += i.x * i.w; d += i.w; } return n / d; });
  const robust = score((it) => robustAggregate(it));
  ok(robust.worst < plain.worst * 0.55,
     `across 200 simulated muscles the WORST error halves, ${pc(plain.worst)} → ${pc(robust.worst)}`);
  ok(robust.rmse < plain.rmse,
     `and RMSE improves too, ${pc(plain.rmse)} → ${pc(robust.rmse)} — so this is a free change, `
     + 'not a trade');
}

/* ================= §6 the band, §6.1 levels ================= */

{
  const boundaries = [100, 150, 200, 250, 300];
  ok(levelIndexAt(boundaries, 90) === -1,
     'below the first boundary is -1, a real answer — "Untrained" would be a rude thing to call '
     + 'somebody who just started');
  ok(levelIndexAt(boundaries, 250) === 3 && levelIndexAt(boundaries, 249) === 2,
     'and a level starts exactly at its boundary');

  const est = { value: 275, u: 0.02, lo: 275 * 0.98, hi: 275 * 1.02 };
  const tight = displayLevel(est, boundaries, null);
  ok(tight.certain && tight.asserted === 3, 'a narrow band inside one level asserts that level');
  const straddle = { value: 252, u: 0.02, lo: 252 * 0.98, hi: 252 * 1.02 };
  ok(!displayLevel(straddle, boundaries, null).certain,
     'and a band only 2 % wide still asserts nothing when it happens to sit on a boundary — '
     + 'the rule is about where the band lands, never about how narrow it is');

  const wide = { value: 252, u: 0.20, lo: 252 * 0.8, hi: 252 * 1.2 };
  const hedged = displayLevel(wide, boundaries, null);
  ok(!hedged.certain && hedged.asserted === null && hedged.low === 2 && hedged.high === 4,
     'a wide band asserts NOTHING and names the range it actually spans');

  // Hysteresis: an estimate a hair over the boundary does not move the display.
  const nudge = { value: 251, u: 0.05, lo: 251 * 0.95, hi: 251 * 1.05 };
  const held = displayLevel(nudge, boundaries, { index: 2 });
  ok(held.index === 2,
     'a level already on screen holds until the estimate clears the boundary by more than '
     + `${DEFAULTS.hysteresis} × the band half-width`);
  const noHyst = displayLevel(nudge, boundaries, { index: 2 }, P({ hysteresis: 0 }));
  ok(noHyst.index === 3,
     'VACUITY GUARD: with hysteresis off the same estimate does move the display');
  const clear = { value: 290, u: 0.05, lo: 290 * 0.95, hi: 290 * 1.05 };
  ok(displayLevel(clear, boundaries, { index: 2 }).index === 3,
     'and a genuine move past the boundary is not blocked — hysteresis is a hair-trigger guard, '
     + 'not a freeze');
}

{
  // The band shrinks with evidence, which is the whole reason it is a band.
  const thin = estimateAt(dailyValues([
    { day: 0, exerciseId: 'bp', weight: 185, reps: 12, setIndex: 0 },
  ]), 0, {});
  const thick = estimateAt(dailyValues([
    ...[0, 3, 7, 10, 14, 17, 21].map((d) => ({ day: d, exerciseId: 'bp', weight: 250, reps: 3, setIndex: 0 })),
  ]), 21, {});
  ok(thin.u > thick.u * 2,
     `one twelve-rep set carries a ±${pc(thin.u)} band against ±${pc(thick.u)} for seven `
     + 'three-rep sessions — the band IS the honesty');
  ok(repLoad(1) === 0 && near(repLoad(15), 1, 1e-12),
     'rep load runs 0 at a single to 1 at the top of the rankable range');
}

/* ================= Q2 · the high-rep case from progress.md §9 ================= */

{
  // A seated calf raise at 180x12, converted to a standing calf raise at the
  // 0.62 ratio muscle-evidence.js uses. It currently reads Elite off one set.
  const estimate = e1rm(180, 12) / 0.62;
  const boundaries = sim.levelBoundaries('Calves');
  ok(estimate > boundaries[6],
     `the unshrunk conversion is ${estimate.toFixed(0)} lb, above the Elite boundary of `
     + `${boundaries[6].toFixed(0)} — reproduced exactly as progress.md §9 describes it`);

  const one = estimateAt(dailyValues([
    { day: 0, exerciseId: 'calf', weight: estimate * 0.62 / 1, reps: 12, setIndex: 0 },
  ]), 0, {});
  // The band this module puts on a single high-rep set, applied to the
  // converted number.
  const shown = displayLevel({ value: estimate, u: one.u, lo: estimate * (1 - one.u), hi: estimate * (1 + one.u) },
    boundaries, null);
  ok(!shown.certain,
     `⚠️ THE ANSWER TO RESIDUAL 2: off one twelve-rep set the band is ±${pc(one.u)}, which spans `
     + `levels ${shown.low} to ${shown.high}. The honest display is a RANGE, not "Elite"`);
  ok(shown.high - shown.low >= 2,
     'and it spans at least three levels, so no single level can be asserted at all');
  const lowRep = estimateAt(dailyValues([
    { day: 0, exerciseId: 'calf', weight: 400, reps: 2, setIndex: 0 },
  ]), 0, {});
  ok(lowRep.u < one.u,
     `VACUITY GUARD: a two-rep set off the same history carries a narrower band (±${pc(lowRep.u)}), `
     + 'so the width is coming from the rep count and not from having one observation');
}

/* ================= Q3 · a typo, or a PR ================= */

{
  ok(plausibleCeiling(300, 0) > 300 && plausibleCeiling(300, 0) < 350,
     'the plausibility ceiling starts above the standing estimate — the estimate is an upper '
     + 'envelope of submaximal work, so a genuinely maximal set clears it with no gain at all');
  ok(plausibleCeiling(300, 90) > plausibleCeiling(300, 30),
     'and it grows with time since the last reading');
  ok(plausibleCeiling(300, 10000) === 300 * Math.exp(PLAUSIBLE_GAIN.cap),
     'capped, so a five-year gap does not licence any number at all');

  const prior = { value: 300, day: 100 };
  ok(screenObservation({ x: 320, day: 107 }, prior).admit,
     'a 7 % jump in a week is admitted — that is a good day, not a typo');
  const huge = screenObservation({ x: 3000, day: 107 }, prior);
  ok(!huge.admit && huge.quarantined,
     'a 10x fat finger is quarantined, not deleted — the record keeps it and the UI can name it');
  ok(screenObservation({ x: 3000, day: 107 }, prior, { corroborating: 1 }).admit,
     'and one set that day agreeing with it releases it immediately');
  ok(screenObservation({ x: 3000, day: 107 }, null).admit,
     'with no prior estimate nothing is screened — there is nothing to screen against');
}

{
  // Release by LATER evidence, which is what tells a PR from a typo.
  const pr = screenDaily(dailyValues([
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 7, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 14, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 21, exerciseId: 'bp', weight: 315, reps: 5, setIndex: 0 },   // a big jump
    { day: 28, exerciseId: 'bp', weight: 310, reps: 5, setIndex: 0 },   // ...repeated
  ]));
  ok(!pr[3].quarantined && pr[3].screenReason === 'released',
     'a jump repeated a week later is RELEASED — a real PR gets hit twice, a typo does not');

  const typo = screenDaily(dailyValues([
    { day: 0, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 7, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 14, exerciseId: 'bp', weight: 225, reps: 5, setIndex: 0 },
    { day: 21, exerciseId: 'bp', weight: 2250, reps: 5, setIndex: 0 },  // fat finger
    { day: 28, exerciseId: 'bp', weight: 230, reps: 5, setIndex: 0 },
  ]));
  ok(typo[3].quarantined, 'and one that nothing ever agrees with stays quarantined');
  ok(typo.length === 5, 'nothing is deleted — every day is still in the output');
}

/* ================= §11.1 · THE SIMULATOR ================= */
// ⚠️ These are the assertions that make this file worth having. Everything
// above checks a rule; these check the ANSWER, against a true 1RM curve the
// simulator wrote and the estimator never sees.

const LIFTERS = sim.ensemble(24);
const EDGE = sim.boundaryEnsemble(21);
const base = sim.scoreEnsemble(LIFTERS);
const edge = sim.scoreEnsemble(EDGE);

console.log(`\n  measured: bias ${pc(base.bias)} · rmse ${pc(base.rmse)} · lag `
  + `${base.lagDays.toFixed(1)} d · level lag ${base.levelLagDays.toFixed(1)} d · coverage `
  + `${pc(base.coverage)} · band ±${pc(base.meanU)} · flaps/lifter-year `
  + `${(base.flaps / LIFTERS.length).toFixed(2)} (ordinary) `
  + `${(edge.flaps / EDGE.length).toFixed(2)} (on a level boundary)\n`);

{
  const fewest = Math.min(...LIFTERS.map((l) => l.sets.length));
  ok(base.each.every((e) => e.n > 250) && fewest > 250,
     `24 simulated lifters logged a year each — ${fewest} sets for the thinnest, `
     + `${Math.max(...LIFTERS.map((l) => l.sets.length))} for the busiest`);
}

ok(base.bias > 0 && base.bias < 0.015,
   `BIAS ${pc(base.bias)} — small, and POSITIVE by design. An estimator that read unbiased off `
   + 'submaximal work would have to be inventing the reps the lifter left in reserve');
ok(base.rmse < 0.06, `RMSE ${pc(base.rmse)} against a known truth`);
ok(base.lagDays < 15,
   `LAG ${base.lagDays.toFixed(1)} days to recognise a genuine gain (mean over +3/+6/+9 % thresholds)`);
ok(base.coverage > 0.93 && base.coverage < 0.97,
   `BAND COVERAGE ${pc(base.coverage)} — the ±${pc(base.meanU)} band contains the truth about `
   + '95 % of the time, which is what makes it a claim rather than decoration');

ok(edge.flaps / EDGE.length < 0.5,
   `FLAP RATE ${(edge.flaps / EDGE.length).toFixed(2)} per lifter-year for somebody sitting `
   + 'EXACTLY on a level boundary — the worst case by construction');
{
  const noHyst = sim.scoreEnsemble(EDGE, { params: P({ hysteresis: 0 }) });
  ok(noHyst.flaps > edge.flaps * 3,
     `VACUITY GUARD: with hysteresis off the same lifters flap `
     + `${(noHyst.flaps / EDGE.length).toFixed(2)} times a year instead — so the low number above `
     + 'is the rule working, not the measurement being blind');
}
{
  // And the other half of that trade, so nobody tunes hysteresis to zero flaps
  // and calls it an improvement.
  const sticky = sim.scoreEnsemble(LIFTERS, { params: P({ hysteresis: 0.5 }) });
  ok(sticky.levelLagDays > base.levelLagDays + 5,
     `stickier hysteresis costs real lag: 0.5 takes ${sticky.levelLagDays.toFixed(1)} days to show `
     + `a genuine level change against ${base.levelLagDays.toFixed(1)} at ${DEFAULTS.hysteresis}`);
}

{
  // ⚠️ THE HEADLINE RESULT ON RESIDUAL 3.
  const dirty = LIFTERS.map((l) => sim.withTypo(l, { day: 150, kind: 'x10' }));
  const unscreened = sim.scoreEnsemble(dirty);
  const screened = sim.scoreEnsemble(dirty, { screen: true });
  ok(unscreened.bias > 1,
     `one ×10 fat finger in a year of logs biases the estimate by ${pc(unscreened.bias)} — `
     + 'a single mistyped number owns the lifter for months, because f_load then measures every '
     + 'real set against it');
  ok(Math.abs(screened.bias) < 0.015,
     `the plausibility screen brings that to ${pc(screened.bias)}`);
  const cleanScreened = sim.scoreEnsemble(LIFTERS, { screen: true });
  ok(near(cleanScreened.rmse, base.rmse, 1e-9) && near(cleanScreened.bias, base.bias, 1e-9),
     'and it costs EXACTLY nothing on clean logs — byte-identical bias and RMSE, so it is not '
     + 'buying accuracy on typos by quietly discarding good days');
}

{
  // What the screen CANNOT do, asserted so nobody later assumes it can.
  const small = LIFTERS.map((l) => sim.withTypo(l, { day: 150, kind: 'pct', magnitude: 0.12 }));
  const screened = sim.scoreEnsemble(small, { screen: true });
  const unscreened = sim.scoreEnsemble(small);
  ok(near(screened.bias, unscreened.bias, 0.004),
     `⚠️ A 12 % SLIP IS NOT SEPARABLE FROM A GOOD DAY and the screen barely touches it `
     + `(${pc(unscreened.bias)} → ${pc(screened.bias)}). There is no model that tells them apart, `
     + 'because there is nothing in the data that differs');
}

{
  // The estimator must beat the obvious naive alternative, or none of this
  // earns its complexity.
  let naiveSq = 0, naiveN = 0;
  for (const l of LIFTERS) {
    for (let day = 63; day < l.days; day++) {
      const win = l.sets.filter((s) => s.day <= day && day - s.day < 42 && s.reps <= 15);
      if (!win.length) continue;
      const mean = win.reduce((a, s) => a + e1rm(s.weight, s.reps), 0) / win.length;
      const err = (mean - l.trueMax(day)) / l.trueMax(day);
      naiveSq += err * err; naiveN++;
    }
  }
  const naive = Math.sqrt(naiveSq / naiveN);
  ok(naive > base.rmse * 2,
     `the naive "average every set in the last six weeks" reads ${pc(naive)} RMSE against `
     + `${pc(base.rmse)} — that gap is what the warm-up gate, the per-day best and the `
     + 'confidence weighting are all for');
}

/* ================= drift guards ================= */

{
  // The rep table is duplicated in muscle-evidence.js on purpose (see the note
  // on repFactor). This is the check that would catch it drifting silently.
  const me = await import('../js/muscle-evidence.js');
  const same = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 20]
    .every((r) => me.repFactor(r) === repFactor(r));
  ok(same,
     'js/muscle-evidence.js and js/strength-estimate.js still agree on what a set of N reps is '
     + 'worth. If this fails, one of them was fitted and the other was not — decide which, '
     + 'and say so in both headers');
}

ok(MIN_CONFIDENCE > 0,
   'an admissible set never carries zero confidence — zero would silently drop it out of '
   + 'effective_n and make the band look narrower than the evidence deserves');

{
  // The UTC/local trap from progress.md §4.
  ok(dayNumber('2026-08-19') - dayNumber('2026-08-18') === 1, 'day numbers are calendar days apart');
  ok(dayNumber('2026-01-01') - dayNumber('2025-12-31') === 1, 'across a year boundary too');
  ok(dayNumber('not a date') === null && dayNumber(null) === null,
     'and anything that is not a date is null rather than a silent 1970');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
