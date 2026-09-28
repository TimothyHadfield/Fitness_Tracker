// The muscle map's maths — overhaul 2026-09-27 (builder MAP).
//   node tests/map-maths.test.mjs
//
// Each block is one finding from the estimates review, replayed through the
// app's own pipeline (buildObservations → rateMuscle), and each was watched
// failing on the code before its fix:
//   EB-4  the 84-day window is measured from the NEWEST set, not from today
//   E-7   a performed single is a floor under the muscle's number
//   E-3b  one session reads at most Fair, two at most Good; `sessionCount`
//   E-9   evidence older than the window reads at most Fair
//   E-2   a stand-in-only reading reads at most Fair
//   E-4   age grading from the app's own Harbo 2012 chart

const mem = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { buildObservations } = await import('../js/strength-observations.js');
const { rateMuscle, confidenceBand } = await import('../js/muscle-evidence.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const idOf = (name) => {
  const e = BUILT_IN_EXERCISES.find((x) => x.name === name);
  if (!e) throw new Error('no exercise ' + name);
  return e.id;
};
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
let seq = 0;
const session = (date, entries) => ({
  id: 's' + (++seq), date,
  entries: entries.map(([name, sets]) => ({
    exerciseId: idOf(name), exerciseName: name,
    sets: sets.map(([w, r]) => ({ weight: w, reps: r })),
  })),
});
const T = '2026-09-27';
const bodyWeights = [{ date: addDays(T, -300), weight: 180 }];
const rate = (sessions, muscle, today = T, benchmarks = []) => {
  const { byMuscle } = buildObservations({ sessions, benchmarks, exMap, bodyWeights, today, sex: 'male' });
  return rateMuscle(byMuscle.get(muscle) || [], muscle);
};
const r1 = (x) => (x == null ? '-' : Number(x).toFixed(1));

/* ================================================================== *
 * EB-4 — THE WINDOW RUNS BACK FROM THE NEWEST SET
 *
 * Trained up to ~220×5 over 100 days, then a break, two return sessions at
 * 165 and 170, and nothing after. The map faded smoothly for 80 days and then,
 * at +85, JUMPED back to the old best, undecayed (201.8 → 258.6, measured):
 * the window was measured from today, went empty once the newest set was 85
 * days old, and the code fell back to all history.
 * ================================================================== */
{
  const sessions = [];
  for (let d = -200; d <= -100; d += 7) {
    sessions.push(session(addDays(T, d), [['Barbell Bench Press', [[185 + Math.floor((d + 200) / 14) * 5, 5]]]]));
  }
  sessions.push(session(addDays(T, -5), [['Barbell Bench Press', [[165, 5]]]]));
  sessions.push(session(addDays(T, -1), [['Barbell Bench Press', [[170, 5]]]]));
  const line = [];
  for (let d = 0; d <= 100; d += 5) {
    const r = rate(sessions, 'Chest', addDays(T, d));
    line.push([d, r ? r.estimate : null]);
  }
  const at = (d) => line.find(([x]) => x === d)[1];
  ok(at(85) <= at(80) + 1e-9,
     `🚨 with no training, +85 days never reads above +80 (${r1(at(80))} → ${r1(at(85))}; was 201.8 → 258.6)`);
  const rises = line.filter(([, v], i) => i > 0 && v > line[i - 1][1] + 1e-9).map(([d]) => '+' + d);
  ok(rises.length === 0,
     `and it never rises anywhere in 100 idle days${rises.length ? ' — rose at ' + rises.join(', ') : ''}`
     + ` (${line.map(([d, v]) => `+${d}:${r1(v)}`).join(' ')})`);
}

/* ================================================================== *
 * E-7 — A PERFORMED SINGLE IS A FLOOR
 *
 * A powerlifter's last day: 460×1 and 440×2. The per-day pick keeps the double
 * (est 460.3), the pool averages it with a week-old 435×2 (455.1), and the map
 * read 455.08 — below the 460 the lifter actually stood up with. Measured.
 * ================================================================== */
{
  const sessions = [];
  for (let wk = 0; wk < 12; wk++) {
    const p = wk * 5;
    sessions.push(session(addDays(T, -84 + wk * 7), [['Back Squat', [[405 + p, 1], [385 + p, 2]]]]));
  }
  const r = rate(sessions, 'Quads');
  ok(r && r.estimate >= 460 - 1e-9,
     `🚨 the map never reads below the heaviest single performed in the window (${r1(r && r.estimate)}; was 455.1 under a 460×1)`);

  // Only the window's singles count: a 500×1 from a year ago is history, not a floor.
  const old = [session(addDays(T, -365), [['Back Squat', [[500, 1]]]]), ...sessions];
  const o = rate(old, 'Quads');
  ok(o && o.estimate < 500,
     `a single from outside the 84-day window is not a floor (${r1(o && o.estimate)})`);

  // A stand-in single is a conversion, not a performed max of the key lift.
  const fb = rate([session(addDays(T, -3), [['Barbell Bench Press', [[315, 1]]]]),
    session(addDays(T, -10), [['Barbell Bench Press', [[275, 5]]]])], 'Triceps');
  ok(fb && fb.kind === 'fallback',
     'a bench-only history rates Triceps as a stand-in (the floor below must not apply to it)');
}

/* ================================================================== *
 * E-3b — ONE SESSION IS AT MOST FAIR, TWO AT MOST GOOD
 *
 * One workout with four back exercises read High 0.821 and "4 sessions" (it
 * counted exercise-days). One set of 135×5 read Good 0.713 beside its own hint
 * "Only one session counts so far". Measured.
 * ================================================================== */
{
  const backDay = [session(addDays(T, -2), [
    ['Barbell Row', [[155, 8], [155, 8]]], ['Lat Pulldown', [[140, 10]]],
    ['Seated Cable Row', [[150, 10]]], ['Pull-Up', [[0, 8]]]])];
  const b = rate(backDay, 'Back');
  ok(b && b.sessionCount === 1,
     `\`sessionCount\` counts distinct DATES, not exercise-days (${b && b.sessionCount}; contributorCount ${b && b.contributorCount})`);
  ok(b && confidenceBand(b.confidence).key !== 'high' && confidenceBand(b.confidence).key !== 'good',
     `🚨 one workout, four exercises reads at most Fair (${b && b.confidence.toFixed(3)} ${b && confidenceBand(b.confidence).name}; was High 0.821)`);

  const one = rate([session(addDays(T, -1), [['Barbell Bench Press', [[135, 5]]]])], 'Chest');
  ok(one && confidenceBand(one.confidence).key === 'fair' || (one && confidenceBand(one.confidence).key === 'low'),
     `one set of 135×5 reads at most Fair (${one && one.confidence.toFixed(3)}; was Good 0.713)`);

  const two = rate([
    session(addDays(T, -8), [['Barbell Bench Press', [[135, 5]]], ['Dumbbell Bench Press', [[50, 8]]], ['Incline Dumbbell Bench Press', [[45, 8]]]]),
    session(addDays(T, -1), [['Barbell Bench Press', [[140, 5]]], ['Dumbbell Bench Press', [[55, 8]]], ['Incline Dumbbell Bench Press', [[45, 9]]]]),
  ], 'Chest');
  ok(two && two.sessionCount === 2 && confidenceBand(two.confidence).key !== 'high',
     `two sessions read at most Good (${two && two.confidence.toFixed(3)} ${two && confidenceBand(two.confidence).name}, ${two && two.sessionCount} sessions)`);
}

/* ================================================================== *
 * E-9 — NOTHING INSIDE THE WINDOW IS AT MOST FAIR
 *
 * Sixteen weeks of steady training, then a break. Measured: still High 0.723
 * at 60 days and Good at 120, while the summary already said "old" at 42.
 * ================================================================== */
{
  const last = addDays(T, -1);
  const sessions = [];
  for (let wk = 0; wk < 16; wk++) {
    sessions.push(session(addDays(last, -7 * wk), [
      ['Barbell Bench Press', [[185, 5], [185, 5]]], ['Dumbbell Bench Press', [[70, 8]]],
      ['Incline Dumbbell Bench Press', [[60, 8]]]]));
  }
  const fresh = rate(sessions, 'Chest', T);
  const at = (days) => rate(sessions, 'Chest', addDays(last, days));
  ok(fresh && confidenceBand(fresh.confidence).key === 'high',
     `a steady lifter reads High while training (${fresh && fresh.confidence.toFixed(3)})`);
  const d84 = at(84);
  ok(d84 && confidenceBand(d84.confidence).key !== 'fair' && confidenceBand(d84.confidence).key !== 'low',
     `and at exactly 84 days off is not capped yet (${d84 && d84.confidence.toFixed(3)} ${d84 && confidenceBand(d84.confidence).name})`);
  const d85 = at(85), d120 = at(120);
  ok(d85 && d120 && d85.confidence <= 0.5499 && d120.confidence <= 0.5499,
     `🚨 past the 84-day window it reads at most Fair (85 d ${d85 && d85.confidence.toFixed(3)}, 120 d ${d120 && d120.confidence.toFixed(3)}; was Good at 120)`);
}

/* ================================================================== *
 * E-2 — A READING INFERRED ONLY FROM OTHER LIFTS IS AT MOST FAIR
 *
 * Tim approved it 2026-09-14 (plan §3.9 decision j) and three comments claimed
 * it existed; it was never coded. Stand-in-only Triceps read Good. Measured.
 * ================================================================== */
{
  const sessions = [];
  for (let wk = 0; wk < 10; wk++) {
    sessions.push(session(addDays(T, -1 - 7 * wk), [
      ['Barbell Bench Press', [[185, 5], [185, 5]]], ['Overhead Press', [[115, 5]]],
      ['Incline Dumbbell Bench Press', [[60, 8]]]]));
  }
  const tri = rate(sessions, 'Triceps');
  ok(tri && tri.kind === 'fallback', `bench and press alone rate Triceps as a stand-in (${tri && tri.kind})`);
  ok(tri && tri.confidence <= 0.5499,
     `🚨 and a stand-in-only reading is at most Fair (${tri && tri.confidence.toFixed(4)} ${tri && confidenceBand(tri.confidence).name})`);
  const chest = rate(sessions, 'Chest');
  ok(chest && chest.kind === 'direct' && chest.confidence > 0.5499,
     `while the same sessions' direct Chest reading is not capped (${chest && chest.confidence.toFixed(3)})`);
}

/* ================================================================== *
 * E-4 — AGE GRADING FROM THE APP'S OWN CITED DATA
 *
 * The McCulloch rows (×1.381 at 60, ×1.786 at 70, ×2.549 at 80) have no
 * published derivation (research.md §16.9). The app's own Harbo 2012 chart
 * (research-data.js, men, eight groups) reads ×1.17 at 64 and ×1.44 at 74.
 * Measured before: a 185 lb 75-year-old benching 155×5 read Elite p98.5.
 * ================================================================== */
{
  const SS = await import('../js/strength-standards.js');
  const rd = await import('../js/research-data.js');
  ok(Math.abs(SS.ageCoefficient(60) - 1.17) < 1e-9 && Math.abs(SS.ageCoefficient(70) - 1.35) < 1e-9,
     `🚨 the coefficients above 40 are Harbo's, not McCulloch's (60: ${SS.ageCoefficient(60)}, 70: ${SS.ageCoefficient(70)})`);
  // Against the measured bands: the male eight-group mean, as % of each group's peak.
  const series = rd.ageStrengthSeries('male');
  const bandMean = (i) => series.reduce((t, s) => t + s.points[i].pct, 0) / series.length / 100;
  const off = [4, 5].map((i) => {
    const age = rd.AGE_BANDS.male[i];
    return Math.abs(SS.ageCoefficient(age) * bandMean(i) - 1);
  });
  ok(off.every((d) => d < 0.08),
     `and they land within 8 % of the measured 64- and 74-year-old bands (${off.map((d) => (d * 100).toFixed(1) + ' %').join(', ')})`);
  ok(SS.ageCoefficient(18) === 1.06 && SS.ageCoefficient(30) === 1,
     'Foster below 23 and the flat 23–40 prime are unchanged');

  const sessions = [];
  for (let wk = 0; wk < 8; wk++) {
    sessions.push(session(addDays(T, -1 - 7 * wk), [['Barbell Bench Press', [[155, 5]]]]));
  }
  const bw185 = [{ date: addDays(T, -300), weight: 185 }];
  const { byMuscle } = buildObservations({ sessions, benchmarks: [], exMap, bodyWeights: bw185, today: T, sex: 'male' });
  const r = rateMuscle(byMuscle.get('Chest'), 'Chest');
  const profile = SS.withAssumptions({ gender: 'male', bodyWeight: 185, age: 75 });
  const pct = SS.percentileFor(r.estimate, 'Chest', profile);
  const lvl = SS.levelFor(pct);
  ok(r && lvl && lvl.name !== 'Elite' && pct < 95,
     `a 75-year-old's 155×5 bench is no longer Elite (p${pct.toFixed(1)} ${lvl ? lvl.name : '-'}; was p98.5 Elite)`);
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
