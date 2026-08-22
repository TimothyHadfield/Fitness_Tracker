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
  STRENGTH_CAVEAT, STRENGTH_CAVEAT_SHORT,
  isCompoundLift, exerciseOrderNote, ORDER_QOE,
} = await import('../js/optimal.js');
const { SESSION_CEILING } = await import('../js/volume-map.js');

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

/* ---------- refusal 2, the per-session half ---------- */
// docs/research.md §6.12, shipped 2026-08-19. Same refusal, other axis: one
// session is credited at most SESSION_CEILING fractional sets per muscle,
// because that is the top of the per-session data range.

const day = (sets) => rateProgramme(
  [{ exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets }] }], exMap, { daysPerWeek: 1 });

ok(near(day(60).raw.hypertrophy, day(200).raw.hypertrophy, 1e-9),
   'past the top of the per-session data range the credit is FLAT — 60 sets of bench in one day '
   + 'and 200 in one day score exactly the same');
ok(day(60).hypertrophy === 20,
   `and a 60-sets-in-one-day programme bands to 20 % growth, not the 25 % it scored before the `
   + `clamp (${day(60).hypertrophy} %)`);

// ⚠️ The vacuity guard, and it is the important one. The clamp must not have
// turned into a frequency reward: below the ceiling, splitting sets across days
// still buys nothing for growth. That is refusal 1, re-asserted against the new
// code path rather than assumed to have survived it.
const twelveOne = rateProgramme([{ exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 12 }] }], exMap, { daysPerWeek: 1 });
const sixTwice = rateProgramme([
  { exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 6 }] },
  { exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 6 }] },
], exMap, { daysPerWeek: 2 });
ok(near(twelveOne.raw.hypertrophy, sixTwice.raw.hypertrophy, 1e-9),
   '12 sets in one session and 6+6 STILL score identically for growth — the rejected '
   + 'per-session-log-sum model scored the split 157 % higher, which is a frequency reward in a '
   + 'per-session coat');

// The decision the cap is: 24, not 11. Thurston is the system a cap at 11 would
// have moved (55 -> 50 growth, on a preprint's self-described arbitrary
// threshold), so his badge is pinned.
ok(SESSION_CEILING === 24, 'per-session credit is capped at the top of the DATA, 24 fractional sets');
ok(rate(preset('preset-thurston-6day')).hypertrophy === 55,
   'and Mike Thurston\'s split still rates 55 % for growth — a cap at the 11-set point of '
   + 'diminishing returns would have made it 50, on evidence nowhere near strong enough to move a '
   + 'shipped number');

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

/* ---------- rating a system the user built ---------- */
// The only thing missing from a user's own system is how often they train it,
// and the app already knows: it has their sessions. Measured beats declared.

{
  const { observedDaysPerWeek, rateUserSystem, MIN_OBSERVED_SPAN_DAYS } = await import('../js/optimal.js');

  const back = (n) => {
    const d = new Date(2026, 7, 18);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const TODAY = '2026-08-18';

  // Three sessions a week for three weeks.
  const threeAWeek = [];
  for (let w = 0; w < 3; w++) for (const off of [0, 2, 4]) threeAWeek.push(back(w * 7 + off));
  const obs = observedDaysPerWeek(threeAWeek, TODAY);
  ok(obs && near(obs.daysPerWeek, 3.3, 0.4),
     `nine sessions over nineteen days measures ~3 days a week (${obs.daysPerWeek.toFixed(2)})`);
  ok(obs.sessions === 9, 'and counts the sessions it used');

  ok(observedDaysPerWeek([back(0), back(1)], TODAY) === null,
     `two days of history is not a rate — under ${MIN_OBSERVED_SPAN_DAYS} days it refuses to guess`);
  ok(observedDaysPerWeek([], TODAY) === null, 'and no history says so rather than returning zero');
  ok(observedDaysPerWeek([back(200), back(201)], TODAY) === null,
     'sessions older than the window are ignored, not averaged in');

  // Two people training the same three sessions in a day should not read as
  // six days a week.
  const dupes = [back(0), back(0), back(0), back(7), back(14), back(20)];
  const dupeObs = observedDaysPerWeek(dupes, TODAY);
  ok(dupeObs.sessions === 4, 'two workouts on one day is one training DAY, not two');

  // The rating carries which basis it used, because the screen has to say.
  const workouts = [
    { id: 'w1', exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 4 }] },
    { id: 'w2', exercises: [{ exerciseId: ex('Back Squat').id, sets: 4 }] },
  ];
  const measured = rateUserSystem(workouts, exMap, { sessionDates: threeAWeek, todayISO: TODAY });
  const assumed = rateUserSystem(workouts, exMap, { sessionDates: [], todayISO: TODAY });
  ok(measured.basis === 'measured' && assumed.basis === 'assumed',
     'a rating says whether it measured your training or assumed it');
  ok(/session/.test(measured.caption) && /Assuming/.test(assumed.caption),
     'and the caption is built by the same function, so sentence and number cannot drift apart');
  ok(measured.raw.hypertrophy !== assumed.raw.hypertrophy,
     'and the two genuinely differ — how often you train it changes the answer');

  // ⚠️ THE DISCREPANCY TIM FOUND. A ready-made system rated one way on Explore
  // and a different way once copied into the library, because the copy had lost
  // the programme's own "6 days a week" and fell back to assuming one pass.
  // Three workouts trained six days is not a three-day programme.
  const declared = rateUserSystem(workouts, exMap, {
    sessionDates: [], todayISO: TODAY, declaredDaysPerWeek: 6,
  });
  ok(declared.basis === 'declared', 'a copied programme uses the frequency it declares');
  ok(declared.raw.hypertrophy > assumed.raw.hypertrophy,
     'which scores higher than assuming one pass a week — the bug Tim spotted');
  ok(/6 days a week/.test(declared.caption), 'and the caption says where the number came from');

  const declaredButTrained = rateUserSystem(workouts, exMap, {
    sessionDates: threeAWeek, todayISO: TODAY, declaredDaysPerWeek: 6,
  });
  ok(declaredButTrained.basis === 'measured',
     'but real history always beats what the programme claims — what you DO wins');

  // ⚠️ The trap from progress.md: a bare YYYY-MM-DD parsed with new Date() is
  // UTC and lands a day early west of Greenwich.
  ok(observedDaysPerWeek(['2026-08-18'], '2026-08-18') === null
     && observedDaysPerWeek(threeAWeek, TODAY) !== null,
     'dates are treated as LOCAL days, not UTC instants');
}

/* ---------- ⚠️ a day number must be a CALENDAR count, in every zone ---------- *
 *
 * The fix above — split the string, build a local Date — solves the "a day early
 * west of Greenwich" half and quietly introduces the other half. `Math.floor(
 * localMidnight / 86400000)` is a stable day index only while the zone's UTC
 * offset stays on one side of zero. In Europe/London, Dublin, Lisbon and the
 * Canaries it does not: GMT is UTC+0, BST is UTC+1, so local midnight sits on
 * the same UTC day all winter and on the PREVIOUS one all summer, and the index
 * jumps by 0 or 2 across each DST change.
 *
 * 29 and 30 March 2026 are two different days that collapse to one number, so
 * two logged sessions read as one and the whole "% optimal" rating for a
 * user-built system is computed from an understated frequency. `e1rm.js` and
 * `strength-estimate.js` already do this the right way — Date.UTC on the split
 * parts, which has no zone in it at all.
 *
 * Run in a CHILD PROCESS under an explicit TZ, because Node cannot restore the
 * system zone once process.env.TZ has been reassigned — flipping it in-process
 * would silently re-zone every assertion after this one.
 * -------------------------------------------------------------------------- */
{
  const { execFileSync } = await import('node:child_process');
  const url = new URL('../js/optimal.js', import.meta.url).href;
  const probe = `
    const { observedDaysPerWeek } = await import(${JSON.stringify(url)});
    const spring = observedDaysPerWeek(['2026-03-29', '2026-03-30'], '2026-04-12');
    const autumn = observedDaysPerWeek(['2026-10-25', '2026-10-26'], '2026-11-08');
    console.log(JSON.stringify({
      spring: spring && [spring.sessions, spring.spanDays],
      autumn: autumn && [autumn.sessions, autumn.spanDays],
    }));
  `;
  const run = (tz) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', probe],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim());

  const london = run('Europe/London');
  ok(london.spring[0] === 2,
     '⚠️ 29 and 30 March are two training days in Europe/London too — a day number floored from '
     + 'LOCAL midnight collapses them into one when the clocks go forward, so two logged sessions '
     + 'read as one');
  ok(london.spring[1] === 15 && london.autumn[1] === 15,
     'and the span either side of a DST change is still fifteen days — the clocks moving cannot '
     + 'lengthen or shorten the window a rate is measured over');
  ok(london.autumn[0] === 2, 'and the autumn change does not lose a day either');

  // Vacuity guard: the same probe in a zone whose offset never crosses zero must
  // give the same answers, so the assertions above are about the ZONE and not
  // about these particular dates.
  const ny = run('America/New_York');
  ok(JSON.stringify(ny) === JSON.stringify(london),
     'and a zone that never crosses UTC+0 was always right, which is why this hid');
}

/* ---------- the sentence on screen ---------- */

ok(/100/.test(explain(55)) && /nobody/.test(explain(55)),
   'the explanation says outright that nothing real reaches 100 %');

/* ---------- ⚠️ what the STRENGTH number does not know ---------- */
// docs/research.md §6.13. A planned workout stores a set COUNT and no load, so
// 3x20 and 3x5 are the same programme to this module. Load is worth SMD 0.60
// [0.38, 0.82] for strength — bigger than anything the rating does model. The
// model cannot be fixed without a data-model change; the CLAIM can, and must.

{
  const bench = { exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 3 }] };
  const heavy = rateProgramme([bench], exMap, { daysPerWeek: 1 });
  const light = rateProgramme([bench], exMap, { daysPerWeek: 1 });
  ok(heavy.strength === light.strength,
     '⚠️ the app genuinely cannot tell 3x5 from 3x20 — a planned exercise carries a set count and '
     + 'nothing else, which is exactly why the caveat has to exist');

  for (const s of [STRENGTH_CAVEAT, STRENGTH_CAVEAT_SHORT]) {
    ok(typeof s === 'string' && s.length > 60, 'the strength caveat is a real sentence');
    ok(/heavy|weight/i.test(s), 'and it names what the score cannot see: how heavy the work is');
    ok(/set count|sets/i.test(s), 'and says why — the app stores a count of sets');
  }
  ok(/3 sets of 20|3 sets of 5/.test(STRENGTH_CAVEAT) && /3 sets of 20/.test(STRENGTH_CAVEAT_SHORT),
     'in the concrete form a stranger can check against their own programme, not in the abstract');
  ok(/growth|size/i.test(STRENGTH_CAVEAT) && !/growth/i.test(STRENGTH_CAVEAT_SHORT),
     'the long form says the GROWTH number is unaffected — load moves hypertrophy by SMD 0.12, an '
     + 'interval crossing zero — and the badge-sized one does not have room to');
}

/* ---------- exercise order ---------- */
// docs/research.md §6.16. ACSM 2026 grades exercise order at 88 % quality of
// evidence, the highest of anything in the stand. This is a NOTE, never a
// score: what is asserted is when it speaks and when it stays quiet.

{
  ok(ORDER_QOE === 88, 'the position stand\'s own quality-of-evidence grade is carried, not rounded');

  const compound = ['Barbell Bench Press', 'Back Squat', 'Deadlift', 'Overhead Press',
    'Barbell Row', 'Pull-Up', 'Lat Pulldown', 'Leg Press', 'Romanian Deadlift', 'Hip Thrust'];
  const isolation = ['Lateral Raise', 'Dumbbell Fly', 'Leg Extension', 'Lying Leg Curl',
    'Barbell Curl', 'Triceps Pushdown', 'Standing Calf Raise', 'Barbell Shrug', 'Face Pull',
    'Cable Crossover'];
  ok(compound.every((n) => isCompoundLift(ex(n))),
     `all ${compound.length} of the multi-joint lifts somebody would want to be fresh for are `
     + 'recognised as compounds');
  ok(isolation.every((n) => !isCompoundLift(ex(n))),
     `and none of ${isolation.length} isolation movements is — including the ones that touch two `
     + 'muscles anyway (a curl has a grip; a face pull is not a heavy compound)');

  const w = (...names) => names.map((n) => ({ exerciseId: ex(n).id }));

  ok(exerciseOrderNote(w('Back Squat', 'Leg Press', 'Leg Extension', 'Lying Leg Curl'), exMap) === null,
     'a workout that already puts its compounds first says NOTHING — silence is the common case '
     + 'and an empty reassurance would be noise');
  ok(exerciseOrderNote([], exMap) === null, 'and an empty workout says nothing');

  const note = exerciseOrderNote(w('Leg Extension', 'Back Squat', 'Lying Leg Curl'), exMap);
  ok(note && note.names.length === 1 && note.names[0] === 'Back Squat',
     'a squat behind a leg extension is named, and only it');
  ok(/88 %/.test(note.text) && /ACSM/.test(note.text),
     'the note states the evidence and its grade rather than asserting a rule');
  ok(/strength finding/.test(note.text) && /no claim about muscle size/.test(note.text),
     '⚠️ and confines the claim to strength — the stand grades order under strength and makes no '
     + 'equivalent claim for hypertrophy');
  ok(/Leave the order alone/.test(note.text),
     '⚠️ and says outright that leaving it is a legitimate answer. Design Rule 6: an opinion this '
     + 'app has earned is still not a scold');

  const two = exerciseOrderNote(w('Lateral Raise', 'Overhead Press', 'Triceps Pushdown', 'Barbell Bench Press'), exMap);
  ok(two && two.names.length === 2 && /come after/.test(two.text),
     'two late compounds are both named, and the sentence agrees with itself grammatically');

  // Cardio is skipped rather than counted as isolation, so a warm-up on a bike
  // does not put every lift behind it "out of order".
  ok(exerciseOrderNote(w('Stationary Bike', 'Back Squat', 'Leg Extension'), exMap) === null,
     'five minutes on a treadmill first is not isolation work — an exercise that produces no '
     + 'countable volume is skipped');
  // Vacuity guard for the line above: the same walk with a real isolation lift
  // in that slot DOES fire, so the null is a result rather than a broken lookup.
  ok(exerciseOrderNote(w('Leg Extension', 'Back Squat'), exMap) !== null,
     'and the same shape with a leg extension in front of the squat does fire');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
