// Headless tests for the 2026-09-27 overhaul of the progression engine and its
// neighbours (builder PROG). No dependencies.
//   node tests/prog-overhaul.test.mjs
//
// Each block names the analyst finding it pins (scratchpad overhaul/estimates.md,
// systems.md, words.md). Every block was run against the code BEFORE the fix and
// failed there; the vacuity guards next to them pass on both.

const P = await import('../js/progression.js');
const { suggestProgression, historyFor, lastSessionDate, trainingRange, PROGRESSION_EXPLAINER,
  PROGRESSION_WHY } = P;
const SR = await import('../js/set-reps.js');
const { weightForTarget } = await import('../js/set-targets.js');
const { leadingRun, flatRun } = await import('../js/rep-decrement.js');
const { observedDaysPerWeek } = await import('../js/optimal.js');
const SCH = await import('../js/schedule.js');
const G = await import('../js/goals.js');
const { e1rm } = await import('../js/e1rm.js');
const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const safe = (name, fn) => { try { fn(); } catch (e) { ok(false, `${name} threw: ${e && e.message}`); } };

const KG = 2.2046226218;
const exOf = (name) => {
  const e = BUILT_IN_EXERCISES.find((x) => x.name === name);
  if (!e) throw new Error(`fixture missing exercise: ${name}`);
  return e;
};
const S = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r }));
const BENCH = exOf('Barbell Bench Press');
const OHP = exOf('Overhead Press');
const ASSIST = exOf('Assisted Pull-Up');

/* ---- EA-2: the one real step at the bottom of the range, when no harder ---- */
safe('EA-2', () => {
  // Measured by the analyst: OHP 65 lb walked 8 → 20 reps and froze.
  const s = suggestProgression({ history: [S(65, 8), S(65, 8)], exercise: OHP, step: 5 });
  ok(s && s.kind === 'load' && s.bigStep === true && s.weight === 70 && s.reps === 6,
     `EA-2: OHP 65 × 8 twice takes the real step, 70 × 6 (got ${s && `${s.kind} ${s.weight}×${s.reps}`})`);
  ok(s && e1rm(70, 6) <= e1rm(65, 8), 'EA-2: and 70 × 6 is no harder than 65 × 8 on the app\'s curve');
  // kg dumbbell bench, 22 kg a hand, 8–12.
  const db = exOf('Dumbbell Bench Press');
  const k = suggestProgression({ history: [S(22 * KG, 12), S(22 * KG, 12)], exercise: db, step: 2.5 * KG });
  ok(k && k.kind === 'load' && Math.abs(k.weight / KG - 24.5) < 1e-6 && k.reps === 8,
     `EA-2: kg DB bench 22 kg × 12 twice → 24.5 kg × 8 (got ${k && `${k.kind} ${(k.weight / KG).toFixed(2)}×${k.reps}`})`);
  // Where the step WOULD be harder, hold at the top — never a rep past it.
  const lat = { id: 'x-lat', name: 'Lateral Raise', muscle: 'Shoulders', fields: ['weight', 'reps'] };
  const h = suggestProgression({ history: [S(20, 15), S(20, 15)], exercise: lat, step: 5 });
  ok(h && h.kind === 'noIncrement' && h.reps === 15 && h.weight === 20,
     `EA-2: 20 × 15 twice in 12–15 holds at 15, not 16 (got ${h && `${h.kind} ${h.weight}×${h.reps}`})`);
  // Vacuity: an in-band step is untouched and carries no bigStep flag.
  const b = suggestProgression({ history: [S(100, 12), S(100, 12)], exercise: BENCH, step: 5 });
  ok(b.kind === 'load' && b.weight === 105 && !b.bigStep, 'EA-2 guard: an in-band step is unchanged');
});

/* ---- EA-4: a weigh-in must never remove the assisted step ---- */
safe('EA-4', () => {
  const hist = [S(40 * KG, 8), S(40 * KG, 8)];
  const withBw = suggestProgression({ history: hist, exercise: ASSIST, step: 2.5 * KG, bodyWeight: 55 * KG });
  const noBw = suggestProgression({ history: hist, exercise: ASSIST, step: 2.5 * KG });
  ok(withBw && withBw.kind === 'load' && Math.abs(withBw.weight / KG - 37.5) < 1e-6 && withBw.reps === 6,
     `EA-4: 55 kg lifter, 40 kg help × 8 twice, with a weigh-in → 37.5 kg help × 6 (got ${withBw && `${withBw.kind} ${(withBw.weight / KG).toFixed(2)}×${withBw.reps}`})`);
  ok(noBw && withBw && noBw.weight === withBw.weight,
     'EA-4: the same plate comes off whether or not she has weighed in');
  ok(withBw && withBw.bigStep === true && withBw.weight < 40 * KG, 'EA-4: and it is marked as a big step, never more help');
});

/* ---- EA-9: singles and doubles repeat ---- */
safe('EA-9', () => {
  const sq = exOf('Back Squat');
  const one = suggestProgression({ history: [S(405, 1)], exercise: sq, step: 5 });
  const two = suggestProgression({ history: [S(500, 2)], exercise: exOf('Deadlift'), step: 5 });
  ok(one && one.kind === 'repeat' && one.weight === 405 && one.reps === 1,
     `EA-9: 405 × 1 → the same again, not 405 × 2 (got ${one && `${one.kind} ${one.weight}×${one.reps}`})`);
  ok(two && two.kind === 'repeat' && two.weight === 500 && two.reps === 2,
     `EA-9: 500 × 2 → the same again, not 500 × 3 (got ${two && `${two.kind} ${two.weight}×${two.reps}`})`);
  const three = suggestProgression({ history: [S(300, 3)], exercise: sq, step: 5 });
  ok(three && three.kind === 'reps' && three.reps === 4, 'EA-9 guard: a triple still gets one more rep');
});

/* ---- EA-3 (progression half) and EA-8: a typo in the newest session ---- */
safe('EA-3/EA-8', () => {
  const typo = suggestProgression({ history: [S(1350, 5), S(135, 5), S(135, 5)], exercise: BENCH, step: 5 });
  ok(typo === null, 'EA-3: 1350 × 5 after 135 × 5 gets no suggestion — plain last time instead');
  const fine = suggestProgression({ history: [S(185, 5), S(135, 5)], exercise: BENCH, step: 5 });
  ok(fine !== null, 'EA-3 guard: a big but under-2× jump still gets one');
  const repTypo = suggestProgression({ history: [S(225, 50), S(225, 5)], exercise: BENCH, step: 5 });
  ok(repTypo === null, 'EA-8: 225 × 50 after 225 × 5 gets no suggestion');
  // The typo one session back must not hold the range at 15–20.
  const after = [S(225, 5), S(225, 5), S(225, 50), S(225, 5)];
  ok(trainingRange(after).join('-') === '3-5',
     `EA-8: a 50-rep typo among 5s leaves the range at 3–5 (got ${trainingRange(after).join('-')})`);
  const s = suggestProgression({ history: after, exercise: BENCH, step: 5 });
  ok(s && s.kind === 'load' && s.weight === 230 && s.reps === 3,
     `EA-8: so two clean 225 × 5 earn +5 lb, as with no typo (got ${s && `${s.kind} ${s.weight}×${s.reps}`})`);
  ok(trainingRange([S(190, 8), S(185, 12)]).join('-') === '8-12',
     'EA-8 guard: with only two sessions nothing is dropped (8 after 12 still reads 8–12)');
  ok(trainingRange([S(100, 12), S(100, 8), S(100, 8), S(100, 10)]).join('-') === '8-12',
     'EA-8 guard: a real 12 among 8s is not more than twice the median, so it counts');
});

/* ---- EA-1: the optional `range` argument ---- */
safe('range', () => {
  const hist = [S(50, 8), S(50, 8)];
  const plain = suggestProgression({ history: hist, exercise: BENCH, step: 5 });
  const planned = suggestProgression({ history: hist, exercise: BENCH, step: 5, range: [8, 8] });
  ok(plain.range.join('-') === '6-8' && plain.reps === 6, 'range guard: history alone reads 6–8 and drops to 6');
  ok(planned && planned.range.join('-') === '8-8' && planned.kind === 'load' && planned.weight === 55
     && planned.reps === 8,
     `range: a plan's "8 reps" keeps reps at 8 after the step (got ${planned && `${planned.weight}×${planned.reps}`})`);
  const asObj = suggestProgression({ history: hist, exercise: BENCH, step: 5, range: { lo: 8, hi: 8 } });
  ok(JSON.stringify(asObj) === JSON.stringify(planned), 'range: {lo, hi} means the same as [lo, hi]');
  const bad = suggestProgression({ history: hist, exercise: BENCH, step: 5, range: ['x', null] });
  ok(JSON.stringify(bad) === JSON.stringify(plain), 'range: an unusable range is ignored, not guessed at');
  const src = String(suggestProgression);
  ok(/range: planRange/.test(src), 'range: exported through suggestProgression\'s own options bag');
});

/* ---- S-08b / S-09: which past sessions feed the prefill ---- */
safe('historyFor', () => {
  const MACH = 'mach';
  const sess = (id, loc, w, extra = {}) => ({ workoutId: 'w1', date: id, location: loc,
    entries: [{ exerciseId: MACH, sets: S(w, 10) }], ...extra });
  const two = [sess('2026-09-20', 'Home Gym', 100), sess('2026-09-18', 'LA Fitness', 150),
    sess('2026-09-15', 'Home Gym', 95)];
  const h = historyFor(two, { exerciseId: MACH, workoutId: 'w1', location: 'la fitness', equipment: 'Machine' });
  ok(h.length === 1 && h[0][0].weight === 150,
     `S-08b: a machine at LA Fitness reads LA Fitness history first (got ${h.map((x) => x[0].weight)})`);
  const bar = historyFor(two, { exerciseId: MACH, workoutId: 'w1', location: 'LA Fitness', equipment: 'Barbell' });
  ok(bar[0][0].weight === 100 && bar.length === 3, 'S-08b: a barbell ignores the gym — plates weigh the same');
  const viaEx = historyFor(two, { exerciseId: MACH, workoutId: 'w1', location: 'LA Fitness',
    exercise: { equipment: 'Cable' } });
  ok(viaEx[0][0].weight === 150, 'S-08b: cable counts too, read off the exercise');
  const newGym = historyFor(two, { exerciseId: MACH, workoutId: 'w1', location: 'Planet', equipment: 'Machine' });
  ok(newGym[0][0].weight === 100, 'S-08b: a gym with no history falls back to any gym');
  const oneGym = [sess('2026-09-20', 'Home Gym', 100), sess('2026-09-18', '', 150)];
  ok(historyFor(oneGym, { exerciseId: MACH, workoutId: 'w1', location: 'Home Gym', equipment: 'Machine' })
    .length === 2, 'S-08b guard: with one gym on the account the old precedence stands');
  ok(lastSessionDate(two, { exerciseId: MACH, workoutId: 'w1', location: 'LA Fitness', equipment: 'Machine' })
    === '2026-09-18', 'S-08b: the gap is measured from the session the prefill reads (safer direction)');

  const dl = [sess('2026-09-20', '', 60, { deload: true }), sess('2026-09-13', '', 100)];
  const d = historyFor(dl, { exerciseId: MACH, workoutId: 'w1' });
  ok(d.length === 1 && d[0][0].weight === 100, 'S-09: a lighter-week session is skipped');
  const onlyDl = historyFor([dl[0]], { exerciseId: MACH, workoutId: 'w1' });
  ok(onlyDl.length === 1 && onlyDl[0][0].weight === 60, 'S-09: unless nothing else exists');
  ok(historyFor([sess('2026-09-20', '', 60, { deload: false }), dl[1]], { exerciseId: MACH, workoutId: 'w1' })[0][0]
    .weight === 60, 'S-09 guard: deload false is an ordinary session');
});

/* ---- S-10: "5+" and 28-day cycles ---- */
safe('S-10', () => {
  const p = SR.parseRepText('5+');
  ok(p && JSON.stringify(p) === '[5,5]' && p.plus === true, 'S-10: "5+" parses to [5, 5] with plus');
  ok(SR.describeRepSpec(p) === '5+ reps', `S-10: and reads "5+ reps" (got ${SR.describeRepSpec(p)})`);
  const stored = SR.normalizeReps([p, 3], 3);
  ok(JSON.stringify(stored) === '[{"lo":5,"hi":5,"plus":true},{"lo":3,"hi":3},{"lo":3,"hi":3}]',
     `S-10: stored flat as {lo, hi, plus} — never a nested array (got ${JSON.stringify(stored)})`);
  ok(SR.describeRepSpec(stored[0]) === '5+ reps' && SR.repSpecToStored(stored[0]).plus === true,
     'S-10: and it round-trips from the stored map');
  const back = SR.expandRepSpec(stored, 3);
  ok(JSON.stringify(back) === JSON.stringify(stored), 'S-10: re-reading a stored list keeps the plus');
  const a = SR.weightRangeForReps(p, 300, 5);
  const b = SR.weightRangeForReps(5, 300, 5);
  ok(a && b && a.weight === b.weight, 'S-10: "5+" prefills the same weight as "5"');
  ok(SR.parseRepText('8-10+') === null && SR.parseRepText('+') === null, 'S-10: only "N+" is accepted');
  ok(SR.parseRepText('8').plus === undefined, 'S-10 guard: plain "8" carries no plus');
  ok(SCH.MAX_CYCLE_DAYS === 28 && SCH.newSchedule(SCH.CYCLE, 28).slots.length === 28,
     'S-10: a 28-slot cycle is allowed');
});

/* ---- EA-6: kg floor rounding ---- */
safe('EA-6', () => {
  let low = 0;
  let n = 0;
  for (let kg = 20; kg <= 200; kg += 2.5) {
    for (const pct of [50, 60, 70, 75, 80, 90, 100]) {
      const r = weightForTarget(pct, kg * KG, 2.5 * KG);
      if (!r) continue;
      n++;
      const want = Math.floor((kg * pct / 100) / 2.5 + 1e-6) * 2.5;
      if (r.weight / KG < want - 1e-6) low++;
    }
  }
  ok(n > 400 && low === 0, `EA-6: no kg % target lands a whole plate low (${low} of ${n})`);
  const t = weightForTarget(100, 35 * KG, 2.5 * KG);
  ok(t && Math.abs(t.weight / KG - 35) < 1e-6, `EA-6: 100 % of 35 kg is 35 kg (got ${t && (t.weight / KG).toFixed(2)})`);
  // A max built so the heavy end of "r reps at 2 in reserve" is exactly a whole
  // kg plate: the answer must be that plate, not one below it.
  let lowR = 0;
  let nR = 0;
  for (let kg = 20; kg <= 200; kg += 2.5) {
    for (const r of [3, 5, 8]) {
      const w = SR.weightRangeForReps(r, e1rm(kg * KG, r + 2), 2.5 * KG);
      if (!w) continue;
      nR++;
      if (Math.abs(w.weight / KG - kg) > 1e-6) lowR++;
    }
  }
  ok(nR > 200 && lowR === 0, `EA-6: rep-prescription rounding shares the fix (${lowR} of ${nR} a plate low)`);
});

/* ---- EA-7: kg weights differing in the last float bits are one weight ---- */
safe('EA-7', () => {
  const run = leadingRun([{ weight: 55.115565544999995, reps: 10 }, { weight: 55.115565545, reps: 8 },
    { weight: 55.115565545, reps: 7 }]);
  ok(run.join(',') === '10,8,7', `EA-7: 25 kg suggested and typed is one run (got ${run.join(',')})`);
  ok(flatRun([{ weight: 55.115565544999995, reps: 10 }, { weight: 55.115565545, reps: 10 },
    { weight: 55.115565545, reps: 10 }]) === true, 'EA-7: and a flat kg run is still flat');
  ok(leadingRun([{ weight: 100, reps: 10 }, { weight: 105, reps: 8 }]).join(',') === '10',
     'EA-7 guard: a real weight change still ends the run');
});

/* ---- EA-10: % optimal does not move with the day of the week ---- */
safe('EA-10', () => {
  // Steady Mon/Wed/Fri for six months, read on each day of one week.
  const dates = [];
  const start = Date.UTC(2026, 2, 2); // a Monday
  for (let d = 0; d < 190; d++) {
    const dow = new Date(start + d * 86400000).getUTCDay();
    if (dow === 1 || dow === 3 || dow === 5) dates.push(new Date(start + d * 86400000).toISOString().slice(0, 10));
  }
  const reads = [];
  for (let d = 180; d < 187; d++) {
    const today = new Date(start + d * 86400000).toISOString().slice(0, 10);
    const r = observedDaysPerWeek(dates, today);
    reads.push(r ? r.daysPerWeek : null);
  }
  const spread = Math.max(...reads) - Math.min(...reads);
  ok(reads.every((x) => x !== null) && spread < 0.2,
     `EA-10: a steady 3-day lifter reads ${reads.map((x) => x.toFixed(2)).join('/')} across a week`);
  const fresh = observedDaysPerWeek(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08', '2026-09-10',
    '2026-09-12', '2026-09-15'], '2026-09-16');
  ok(fresh && fresh.spanDays === 16, 'EA-10 guard: a new account is still measured from its first session');
});

/* ---- EA-12: "Reached" needs two days at the target ---- */
safe('EA-12', () => {
  const goal = G.buildGoal({ muscle: 'Chest', level: { key: 'x', name: 'Proficient', percentile: 50 },
    targetWeight: 225, startWeight: 200, startPercentile: 30, startDate: '2026-08-19' });
  const once = G.goalProgress(goal, 230, '2026-09-20', { daysAtTarget: 1 });
  ok(once.reached === false && once.hitOnce === true && once.atTarget === true,
     'EA-12: one day at the target is not "Reached" — it is hit once');
  const twice = G.goalProgress(goal, 230, '2026-09-20', { daysAtTarget: 2 });
  ok(twice.reached === true && twice.hitOnce === false, 'EA-12: two different days are');
  const legacy = G.goalProgress(goal, 230, '2026-09-20');
  ok(legacy.reached === true && legacy.hitOnce === false,
     'EA-12 guard: a caller with no day count keeps the old reading');
  ok(G.REACHED_MIN_DAYS === 2, 'EA-12: the rule is two days');
  const series = [{ date: '2026-09-01', estimate: 226 }, { date: '2026-09-01', estimate: 228 },
    { date: '2026-08-01', estimate: 240 }, { date: '2026-09-10', estimate: 224 }, { date: '2026-09-12', estimate: 225 }];
  ok(G.daysAtOrAbove(series, 225, '2026-08-19') === 2,
     'EA-12: daysAtOrAbove counts distinct days since the start, at or above target');
});

/* ---- words (P2): short lines, with the long ones kept for the ? ---- */
safe('words', () => {
  const words = (s) => String(s).trim().split(/\s+/).length;
  const req = G.requirementsFor('committed', { bodyWeight: 180 });
  ok(req.rows.every((r) => r.key === 'effort' ? r.short === null
    : typeof r.short === 'string' && words(r.short) <= 7 && r.detail.length > r.short.length),
     'W-1: every requirement row has a ≤7-word short line, and its detail is kept');
  const reasons = G.stallReasons({ requirements: req, muscle: 'Chest',
    measured: { weeklySets: 8, sessionsPerWeek: 2, spanDays: 28, sessions: 8 } });
  ok(reasons.every((r) => typeof r.short === 'string' && words(r.short) <= 12 && r.detail),
     'W-11/W-15: every stall row has a short line (≤12 words), detail kept');
  ok(reasons.find((r) => r.key === 'volume').short === '8 sets a week · goal 7–10',
     `W-15: measured volume row reads "8 sets a week · goal 7–10" (got ${reasons.find((r) => r.key === 'volume').short})`);
  const short = G.stallReasons({ requirements: req, muscle: 'Chest',
    measured: { enough: false, totalSets: 6, daysTrained: 2, spanDays: 9, sessions: 3, weeklySets: 4.7, sessionsPerWeek: 1.5 } });
  ok(short.every((r) => typeof r.short === 'string' && words(r.short) <= 14),
     'W-15: short-window rows too');
  ok(G.FIT_SHORT && G.FIT_SHORT.fits === 'fits' && G.FIT_SHORT.more === 'more than asked',
     'W-10: FIT_SHORT gives the row form');
  ok(PROGRESSION_EXPLAINER.length === 2 && PROGRESSION_WHY.some((t) => /last two sessions/.test(t)),
     'W-14: the explainer is two lines; the mechanism line moved behind the ?');
});

console.log(`\n${fails === 0 ? 'All checks passed.' : fails + ' FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
