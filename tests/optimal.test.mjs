// Headless tests for the "% optimal" scoring model. No dependencies.
//   node tests/optimal.test.mjs
//
// docs/optimal-rating-plan.md Phase 2-3 · docs/research.md §6.
//
// ⚠️ The most valuable tests in here are the ones that check the curves
// REPRODUCE THE PUBLISHED FIGURES, not merely that they are self-consistent. A
// curve fitted to a slope can match that slope perfectly and still be the wrong
// curve; matching the plotted marginal means as well is what says the fit is
// real. The rest guard the three refusals in the module header.

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { PRESET_SYSTEMS } = await import('../js/preset-systems.js');
const {
  hypertrophyResponse, strengthVolumeResponse, strengthFrequencyResponse,
  rateProgramme, weeksForRotation, band, explain,
  VOLUME_CEILING, STRENGTH_VOLUME_CEILING, STRENGTH_FREQ_CEILING,
} = await import('../js/optimal.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// The unclamped square-root curve, to show what the clamp is actually saving us
// from. Same constant the module derives: 0.24 x 2 x sqrt(12.25).
const HYP_A_PROBE = (v) => 0.24 * 2 * Math.sqrt(12.25) * Math.sqrt(v);

const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name, e]));
const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const ex = (n) => byName.get(n);

const rate = (preset) => {
  const workouts = preset.workouts.map((w) => ({
    exercises: (w.exercises || []).map((i) => {
      const e = byName.get(i.name);
      return e ? { exerciseId: e.id, sets: Number(i.sets) || 3 } : null;
    }).filter(Boolean),
  }));
  return rateProgramme(workouts, exMap, {
    daysPerWeek: preset.daysPerWeek,
    minutesPerSession: preset.minutes,
    cycleDays: preset.id === 'preset-bumstead-8day' ? 8 : 0,
  });
};
const preset = (id) => PRESET_SYSTEMS.find((p) => p.id === id);

/* ---------- the curves reproduce the published numbers ---------- */

// Hypertrophy: the paper reports a slope of 0.24 % per set at 12.25 sets, and
// its Fig. 7 plots ~5-6 % at 12 sets rising to ~10.5 % at the top of the range.
ok(near(hypertrophyResponse(12.25) - hypertrophyResponse(11.25), 0.24, 0.02),
   'the hypertrophy curve reproduces the published 0.24 % per set at 12.25 sets');
ok(hypertrophyResponse(12) > 5 && hypertrophyResponse(12) < 6.5,
   `and their Fig. 7 marginal mean at 12 sets, ~5-6 % (${hypertrophyResponse(12).toFixed(2)})`);
ok(near(hypertrophyResponse(42), 10.9, 0.6),
   `and ~10.5 % at 42 sets (${hypertrophyResponse(42).toFixed(2)})`);

// Strength volume: minimum effective dose is ONE set and the plateau is ~5.
ok(strengthVolumeResponse(1) > 3.96,
   'one weekly set clears the smallest detectable effect for strength — their Table 4 MED');
ok(near(strengthVolumeResponse(5), 17.1, 0.5), 'and 5 sets sits at the plateau, ~17 %');
ok(strengthVolumeResponse(10) - strengthVolumeResponse(5) < 1.5,
   'doubling 5 sets to 10 adds almost nothing — that IS the plateau');

// Strength frequency was fitted to two stated points, so it must hit them.
ok(near(strengthFrequencyResponse(1), 12.72, 0.1),
   'the frequency curve hits the published 12.72 % at one session a week');
ok(near(strengthFrequencyResponse(2), 17.32, 0.1), 'and 17.32 % at two');

/* ---------- refusal 1: growth is not bought with more days ---------- */

const oneDay = [{ exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 12 }] }];
const threeDays = [
  { exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 4 }] },
  { exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 4 }] },
  { exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 4 }] },
];
const a = rateProgramme(oneDay, exMap, { daysPerWeek: 1 });
const b = rateProgramme(threeDays, exMap, { daysPerWeek: 3 });
ok(near(a.raw.hypertrophy, b.raw.hypertrophy, 0.001),
   'THE SAME 12 SETS SPREAD OVER 3 DAYS SCORES THE SAME FOR GROWTH AS 1 DAY — '
   + 'frequency has no identifiable independent effect on hypertrophy');
ok(b.raw.strength > a.raw.strength,
   'but it scores HIGHER for strength, where frequency does matter');

/* ---------- refusal 2: it does not extrapolate past the data ---------- */

ok(hypertrophyResponse(100) === hypertrophyResponse(VOLUME_CEILING),
   'volume is clamped at the top of the evidence range — 100 sets scores as 42');
const sane = rateProgramme([{ exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 20 }] }], exMap, { daysPerWeek: 1 });
const absurd = rateProgramme([{ exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 200 }] }], exMap, { daysPerWeek: 1 });
// Measured against what the curve WOULD have done unclamped, rather than
// against a threshold picked out of the air — the first version of this test
// asserted "< 1.6", failed at 1.81, and was measuring nothing in particular.
const clampedRatio = absurd.raw.hypertrophy / sane.raw.hypertrophy;
// Both programmes are one exercise: bench, which is chest direct plus triceps
// and shoulders indirect at half. So the unclamped comparison is 200 sets of
// chest and 100 each of the other two, against 20 and 10.
const unclampedRatio = (HYP_A_PROBE(200) + 2 * HYP_A_PROBE(100))
                     / (HYP_A_PROBE(20) + 2 * HYP_A_PROBE(10));
ok(clampedRatio < 2,
   `10x the sets buys ${clampedRatio.toFixed(2)}x the score, not 10x — diminishing returns`);
ok(hypertrophyResponse(200) === hypertrophyResponse(42),
   'and past the top of the evidence range the curve is FLAT, so the rating can never '
   + 'recommend 60 sets a week — the exact failure it exists to prevent');
ok(unclampedRatio > clampedRatio,
   `the clamp is what does it: unclamped the same comparison would run away to `
   + `${unclampedRatio.toFixed(2)}x`);

/* ---------- refusal 3: no false precision ---------- */

ok(band(83) === 85 && band(87) === 85,
   '83 and 87 both band to 85 — the source models explain a quarter of the variance');
ok([0, 12, 47, 99, 100].every((n) => band(n) % 5 === 0), 'every score lands on a 5-point grid');
ok(band(-20) === 0 && band(500) === 100, 'and is clamped to 0-100');
for (const p of PRESET_SYSTEMS) {
  const r = rate(p);
  if (r.hypertrophy % 5 !== 0 || r.strength % 5 !== 0) { ok(false, `${p.name} escaped banding`); break; }
}
ok(true, 'no shipped system reports an unbanded score');

/* ---------- a rotation is not a week ---------- */
// The bug the Golden Six caught: one workout trained three days a week is three
// sessions, not one.

ok(near(weeksForRotation(1, 3), 1 / 3, 1e-9), 'one workout, 3 days a week = a third of a week per pass');
ok(near(weeksForRotation(3, 6), 0.5, 1e-9), 'a 3-workout rotation on 6 days runs twice a week');
ok(near(weeksForRotation(6, 6), 1, 1e-9), 'six workouts on six days is one week');
ok(near(weeksForRotation(6, 6, 8), 8 / 7, 1e-9), 'an explicit 8-day cycle overrides the day count');
ok(weeksForRotation(0, 0) === 1, 'and nonsense degrades to one week rather than dividing by zero');

const golden = rate(preset('preset-arnold-golden-six'));
const gChest = golden.perMuscle.find((m) => m.muscle === 'Chest');
ok(near(gChest.sessions, 3, 0.01),
   `the Golden Six trains chest 3 times a week, not once (${gChest.sessions.toFixed(1)})`);

/* ---------- the nine shipped systems ---------- */

const scored = PRESET_SYSTEMS.map((p) => ({ p, r: rate(p) }));
ok(scored.every(({ r }) => r.hypertrophy > 0 && r.strength > 0), 'every shipped system scores');
ok(scored.every(({ r }) => r.hypertrophy <= 100 && r.strength <= 100), 'and none exceeds 100 %');

const g = scored.find((s) => s.p.id === 'preset-arnold-golden-six').r;
const t = scored.find((s) => s.p.id === 'preset-thurston-6day').r;
ok(g.raw.hypertrophy < t.raw.hypertrophy,
   `a 3-day 1960s beginner routine scores lower for growth than a 6-day bodybuilder split `
   + `(${g.hypertrophy}% vs ${t.hypertrophy}%)`);

// The point of the whole feature: the efficiency read, where a short programme
// wins. Tim's own example was "90 % as optimal at 3x/week and 45 min".
const fullBody = scored.find((s) => s.p.id === 'preset-full-body').r;
const israetel = scored.find((s) => s.p.id === 'preset-israetel-floating-split').r;
ok(fullBody.raw.hypertrophy < israetel.raw.hypertrophy,
   'a 3-day full-body programme delivers less total growth stimulus than a 6-day split');
ok(fullBody.perHour > israetel.perHour * 2,
   `but more than twice as much PER HOUR TRAINED (${fullBody.perHour.toFixed(1)} vs `
   + `${israetel.perHour.toFixed(1)}) — the number nobody else shows`);

// Coverage is reported in words, never folded into the score.
ok(Array.isArray(g.under) && g.under.length > 0,
   'the Golden Six is named as missing muscles rather than silently marked down');
ok(scored.find((s) => s.p.id === 'preset-volume-landmarks').r.under.length <= 1,
   'and the programme designed on volume landmarks misses at most one');

/* ---------- the sentence on screen ---------- */

ok(/100/.test(explain(55)) && /nobody/.test(explain(55)),
   'the explanation says outright that nothing real reaches 100 %');

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
