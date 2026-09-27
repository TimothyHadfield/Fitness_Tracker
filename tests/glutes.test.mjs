// Glutes are rated from ALL the work that trains them — 2026-09-26.
//   node tests/glutes.test.mjs
//
// Tim, from his own training: *"I used the hip thrust machine today and put
// 45lbs on the end … my glutes are '121 lbs to begginner'. This machine hip
// thrust set is the only thing the glutes are getting based off of, even though
// I've done Romanian deadlifts, stiff-leg deadlifts, squats, and lunges. My
// romanian deadlift is estimated 225lbs, so normal deadlift being 76lbs makes
// no sense."* And on the machine: *"The one we used had a long extended rod
// which made the machanical advantage more for the weight … Maybe the app
// thinks the weight is held on your hip."*
//
// Three causes, all in js/muscle-evidence.js, each pinned below:
//   1. rateMuscle() dropped every stand-in once ANY direct reading existed, so
//      one light machine set (q 0.35) silenced a key-lift RDL and squat.
//      → stand-ins stay in the 1/σ² blend (Glutes 2026-09-26, every muscle 2026-09-27).
//   2. Lunges / split squats / leg press are Quads q 0.35–0.40, under the 0.45
//      floor, so they never reached the glutes. → `minQuality` 0.30 on the
//      Glutes←Quads hop only (isolations stay out).
//   3. Machine Hip Thrust read lever plates as a deadlift at 1.00.
//      → 0.60 at q 0.25 (reasoned; Smith kept at 1.00).
//
// Measured on this synthetic case (male, 175 lb, 8 sessions over 4 weeks):
// Glutes 70.9 → 291.3, confidence 0.413 → 0.654. Demo year: only the Glutes row
// of the golden table moves (353.40 → 350.42, −0.8 %).
//
// 🔄 2026-09-27 — MADE GENERAL AT TIM'S WORD ("Every muscle"). Measured on the
// demo year first (no sex / male): Triceps +12.0 % / +5.4 % (bench stands in
// beside pushdowns), Hamstrings +0.8 % / +1.1 %, Biceps 0 / +0.8 %, Shoulders
// ±0.1 %, the rest 0. The triceps and hamstrings cases at the bottom pin it.

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { buildObservations } = await import('../js/strength-observations.js');
const { rateMuscle, contributionsFor } = await import('../js/muscle-evidence.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name, e]));
const id = (n) => { const e = byName.get(n); if (!e) throw new Error('no exercise ' + n); return e.id; };
const TODAY = '2026-09-26';
const day = (off) => {
  const d = new Date(TODAY + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - off);
  return d.toISOString().slice(0, 10);
};
const entry = (n, sets) => ({
  exerciseId: id(n), exerciseName: n, sets: sets.map(([weight, reps]) => ({ weight, reps })),
});
const rate = (sessions, muscle, sex = 'male', bw = 175) => {
  const { byMuscle } = buildObservations({
    sessions, benchmarks: [], exMap, bodyWeights: [{ date: day(60), weight: bw }], today: TODAY, sex,
  });
  return { rating: rateMuscle(byMuscle.get(muscle) || [], muscle), obs: byMuscle.get(muscle) || [] };
};
const contrib = (n, muscle, sex = 'male') =>
  contributionsFor(byName.get(n), { sex, bodyWeight: 175 }).find((c) => c.muscle === muscle) || null;

// ── Tim's month: RDL ~225 e1RM, stiff-leg, squats, lunges, one machine day ──
const TIM = [
  { date: day(26), entries: [entry('Back Squat', [[135, 8], [135, 8], [135, 7]]), entry('Romanian Deadlift', [[175, 8], [175, 8]])] },
  { date: day(23), entries: [entry('Walking Lunge', [[30, 10], [30, 10]]), entry('Stiff-Leg Deadlift', [[165, 8], [165, 8]])] },
  { date: day(19), entries: [entry('Back Squat', [[145, 8], [145, 7]]), entry('Romanian Deadlift', [[185, 8], [185, 7]])] },
  { date: day(16), entries: [entry('Walking Lunge', [[35, 10], [35, 10]]), entry('Stiff-Leg Deadlift', [[175, 8], [175, 8]])] },
  { date: day(12), entries: [entry('Back Squat', [[155, 6], [155, 6]]), entry('Romanian Deadlift', [[185, 8], [185, 8]])] },
  { date: day(9), entries: [entry('Walking Lunge', [[35, 12], [35, 10]]), entry('Stiff-Leg Deadlift', [[185, 8], [185, 7]])] },
  { date: day(5), entries: [entry('Back Squat', [[155, 8], [155, 7]]), entry('Romanian Deadlift', [[195, 6], [195, 6]])] },
  { date: day(0), entries: [entry('Machine Hip Thrust', [[45, 10], [45, 10], [45, 9]]), entry('Walking Lunge', [[35, 10]])] },
];
{
  const { rating: ham } = rate(TIM, 'Hamstrings');
  ok(ham && ham.estimate > 215 && ham.estimate < 265,
     `fixture sanity: his hamstrings (RDL-based) read ~225-240 like his app (${ham && ham.estimate.toFixed(1)})`);

  const { rating: g } = rate(TIM, 'Glutes');
  const names = new Set((g && g.pooled || []).map((p) => p.exerciseName));
  ok(g && g.estimate > 200,
     `🚨 his glutes read what the hinge and squat work implies, not a 71 lb deadlift off one machine day (${g && g.estimate.toFixed(1)})`);
  ok(['Romanian Deadlift', 'Stiff-Leg Deadlift', 'Back Squat', 'Walking Lunge', 'Machine Hip Thrust'].every((n) => names.has(n)),
     `every lift he named moves the number: ${[...names].join(', ')}`);
  ok(g && g.kind === 'direct', 'the rating is still direct (the machine set is direct evidence), so no Fair cap applies');
  const rdl = g && g.pooled.find((p) => p.exerciseName === 'Romanian Deadlift');
  ok(rdl && g.estimate > rdl.value * 0.75 && g.estimate < rdl.value * 1.25,
     `and it lands near what his RDL alone says about glutes (${rdl && rdl.value.toFixed(1)})`);
  const mach = g && g.pooled.find((p) => p.exerciseName === 'Machine Hip Thrust');
  ok(mach && mach.share < 0.2, `the light machine set still counts, at a small share (${mach && (mach.share * 100).toFixed(0)} %)`);
}

// ── The machine itself ──────────────────────────────────────────────────────
{
  const m = contrib('Machine Hip Thrust', 'Glutes');
  ok(m && Math.abs(m.ratio - 0.60) < 1e-9 && Math.abs(m.quality - 0.25) < 1e-9,
     `a lever hip thrust machine converts at 0.60 and q 0.25, not as a deadlift at 1.00 (${m && m.ratio}, ${m && m.quality})`);
  const s = contrib('Smith Machine Hip Thrust', 'Glutes');
  ok(s && s.ratio === 1 && s.quality === 0.35,
     'the Smith hip thrust (plates over the hips) keeps its own 1.00 / 0.35 rather than falling into the lever rule');
  const bar = contrib('Hip Thrust', 'Glutes');
  ok(bar && bar.ratio > m.ratio, 'and a barbell hip thrust is still the heavier conversion per pound logged');
}

// ── What may and may not reach the glutes ───────────────────────────────────
{
  for (const n of ['Walking Lunge', 'Bulgarian Split Squat', 'Split Squat', 'Leg Press', 'Goblet Squat', 'Hack Squat']) {
    const c = contrib(n, 'Glutes');
    ok(c && c.kind === 'fallback' && c.quality < 0.2,
       `${n} now reaches the glutes as a low-weight stand-in (q ${c && c.quality.toFixed(2)})`);
  }
  for (const n of ['Leg Extension', 'Single-Leg Extension', 'Lying Leg Curl', 'Seated Leg Curl']) {
    ok(!contrib(n, 'Glutes'), `🛑 ${n} (an isolation) still says nothing about glutes`);
  }
  const sumo = contrib('Sumo Deadlift', 'Glutes');
  ok(sumo && sumo.kind === 'direct' && Math.abs(sumo.ratio - 1.12) < 1e-9,
     `a sumo deadlift rates glutes directly against the deadlift (${sumo && sumo.ratio})`);
  ok(contrib('Trap Bar Deadlift', 'Glutes') && contrib('Good Morning', 'Glutes'),
     'so do the trap bar deadlift and the good morning');
  ok(contrib('Sumo Deadlift', 'Back') && contrib('Sumo Deadlift', 'Back').ratio > 1.9,
     'and the sumo deadlift still rates Back exactly as before');
  ok(!contrib('Barbell Row', 'Glutes') && !contrib('Lat Pulldown', 'Glutes'),
     '🛑 rows and pulldowns do not reach the glutes');
}

// ── What did not change ─────────────────────────────────────────────────────
{
  // Grey still means "nothing trains this".
  const bench = [{ date: day(3), entries: [entry('Barbell Bench Press', [[185, 5]])] }];
  ok(rate(bench, 'Glutes').obs.length === 0, 'a bench-only lifter still has NO glute evidence (grey stays meaningful)');

  // A real deadlift still carries the glutes almost alone.
  const dl = [{ date: day(3), entries: [entry('Deadlift', [[315, 5]])] }];
  const dlOnly = rate(dl, 'Glutes').rating.estimate;
  const withSquat = rate([...dl, { date: day(2), entries: [entry('Back Squat', [[185, 5]])] }], 'Glutes').rating.estimate;
  ok(Math.abs(withSquat / dlOnly - 1) < 0.03,
     `a Deadlift (σ 0.05) is barely moved by a lighter squat stand-in (${dlOnly.toFixed(1)} → ${withSquat.toFixed(1)})`);

  // Stand-ins only rated → still flagged as such.
  const squatOnly = rate([{ date: day(3), entries: [entry('Back Squat', [[225, 5]])] }], 'Glutes').rating;
  ok(squatOnly && squatOnly.kind === 'fallback', 'a squat-only lifter\'s glutes are still a stand-in-only rating');

  // 🔄 2026-09-27, Tim: "Every muscle" — the blend is general now. A leg curl no
  // longer shuts the squat out of Hamstrings.
  const ham = rate([
    { date: day(4), entries: [entry('Back Squat', [[315, 5]])] },
    { date: day(3), entries: [entry('Lying Leg Curl', [[60, 10]])] },
  ], 'Hamstrings').rating;
  const hamNames = (ham && ham.pooled || []).map((p) => p.exerciseName);
  ok(hamNames.includes('Lying Leg Curl') && hamNames.includes('Back Squat') && ham.kind === 'direct',
     `Hamstrings blend the squat beside the leg curl, still a direct rating (${hamNames.join(', ')})`);
}

// ── Every muscle (2026-09-27): a heavy bench counts beside light pushdowns ──
{
  const tri = [
    { date: day(6), entries: [entry('Barbell Bench Press', [[225, 5], [225, 5]]), entry('Triceps Pushdown', [[40, 12], [40, 12]])] },
    { date: day(2), entries: [entry('Barbell Bench Press', [[230, 4]]), entry('Triceps Pushdown', [[45, 10]])] },
  ];
  const { rating, obs } = rate(tri, 'Triceps');
  const names = (rating && rating.pooled || []).map((p) => p.exerciseName);
  const push = rating && rating.pooled.find((p) => p.exerciseName === 'Triceps Pushdown');
  const bench = rating && rating.pooled.find((p) => p.exerciseName === 'Barbell Bench Press');
  ok(obs.some((o) => o.kind === 'fallback') && names.includes('Barbell Bench Press') && names.includes('Triceps Pushdown'),
     `🚨 Triceps: the bench stands in beside the pushdowns instead of being dropped (${names.join(', ')})`);
  ok(rating && push && bench && rating.estimate > push.value && rating.estimate < bench.value,
     `and the number lands between what each says (${push && push.value.toFixed(1)} < ${rating && rating.estimate.toFixed(1)} < ${bench && bench.value.toFixed(1)})`);
  ok(rating && rating.kind === 'direct', 'still a direct rating, so no stand-in-only cap');
}

// ── Autumn's case (2026-09-23): one abduction day no longer shuts out her RDL ─
{
  const autumn = [
    { date: day(10), entries: [entry('Romanian Deadlift', [[95, 8], [95, 8]])] },
    { date: day(3), entries: [entry('Hip Abduction Machine', [[150, 12]])] },
  ];
  const { rating } = rate(autumn, 'Glutes', 'female', 140);
  const names = (rating && rating.pooled || []).map((p) => p.exerciseName);
  ok(names.includes('Romanian Deadlift') && names.includes('Hip Abduction Machine'),
     `her RDL and her abduction both count (${names.join(', ')})`);
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
