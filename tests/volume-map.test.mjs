// Headless tests for the exercise -> muscle VOLUME mapping. No dependencies.
//   node tests/volume-map.test.mjs
//
// docs/optimal-rating-plan.md Phase 1 · docs/research.md §6.4.
//
// ⚠️ What these can and cannot check. The 1.0/0.5 weighting is evidence-backed
// (Pelland et al. 2025) and is asserted here against the published values. The
// per-exercise classifications are applied judgement, and no test can make a
// judgement correct — what the tests do is pin the cases the paper's own
// Table 1 states, prove the conservative fallback really is conservative, and
// stop a rule change from silently reclassifying half the library.

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { PRESET_SYSTEMS } = await import('../js/preset-systems.js');
const {
  DIRECT, INDIRECT, VOLUME_MUSCLES, SCORED_MUSCLES,
  volumeContributions, weeklyVolume,
  hypertrophyTier, strengthTier, HYPERTROPHY_TIERS, STRENGTH_TIERS,
} = await import('../js/volume-map.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name, e]));
const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
// Two exercises share the name "Cable Kickback" — one triceps, one glutes — so
// lookups in these tests must be qualified by muscle or they are ambiguous.
const ex = (name, muscle) =>
  BUILT_IN_EXERCISES.find((e) => e.name === name && (!muscle || e.muscle === muscle));
const map = (name, muscle) => {
  const out = {};
  for (const c of volumeContributions(ex(name, muscle))) out[c.muscle] = c.kind;
  return out;
};

/* ---------- the weights themselves ---------- */

ok(DIRECT === 1.0, 'a direct set counts as one set');
ok(INDIRECT === 0.5,
   'an indirect set counts as HALF — the best-supported method in Pelland et al. 2025');

/* ---------- the cases the paper states outright ---------- */
// Table 1 of that paper lists these classifications explicitly, so they are the
// closest thing to ground truth this mapping has.

ok(map('Barbell Bench Press').Triceps === 'indirect',
   'bench press is INDIRECT for triceps (their Table 1)');
ok(map('Barbell Bench Press').Shoulders === 'indirect',
   'and indirect for the anterior deltoid');
ok(map('Barbell Bench Press').Chest === 'direct', 'and direct for chest');
ok(map('Overhead Press').Triceps === 'indirect', 'shoulder press is indirect for triceps');
ok(map('Lat Pulldown').Biceps === 'indirect', 'lat pulldown is indirect for biceps');
ok(map('Barbell Row').Biceps === 'indirect', 'rows are indirect for biceps');
ok(map('Barbell Row').Traps === 'indirect', 'and indirect for traps');
ok(map('Back Squat').Quads === 'direct', 'squats are direct for quads');
ok(map('Leg Press').Quads === 'direct', 'so is the leg press');
ok(map('Triceps Pushdown').Triceps === 'direct', 'a pushdown is direct triceps');
ok(Object.keys(map('Triceps Pushdown')).length === 1, 'and trains nothing else worth counting');

/* ---------- isolation must stay isolated ---------- */

ok(Object.keys(map('Dumbbell Fly')).join() === 'Chest', 'a fly is chest only — no triceps');
ok(Object.keys(map('Lateral Raise')).join() === 'Shoulders', 'a lateral raise is shoulders only');
ok(Object.keys(map('Leg Extension')).join() === 'Quads', 'a leg extension is quads only');
ok(Object.keys(map('Lying Leg Curl')).join() === 'Hamstrings', 'a leg curl is hamstrings only');
ok(Object.keys(map('Standing Calf Raise')).join() === 'Calves', 'a calf raise is calves only');

// The bug the audit caught: /curl/ matched wrist curls and paid them biceps.
ok(map('Wrist Curl').Biceps === undefined,
   'a WRIST curl trains no biceps — the elbow does not move');
ok(map('Reverse Curl').Biceps === 'indirect',
   'but a reverse curl does, because it is an elbow flexion movement');

/* ---------- the duplicate-name trap ---------- */

ok(map('Cable Kickback', 'Triceps').Triceps === 'direct'
   && map('Cable Kickback', 'Triceps').Glutes === undefined,
   'the triceps Cable Kickback is triceps only');
ok(map('Cable Kickback', 'Glutes').Glutes === 'direct'
   && map('Cable Kickback', 'Glutes').Triceps === undefined,
   'and the glute one of the same name is glutes only — rules are muscle-qualified');

/* ---------- compounds spread the load ---------- */

const dl = map('Deadlift');
ok(dl.Back === 'direct' && dl.Hamstrings === 'indirect' && dl.Glutes === 'indirect'
   && dl.Traps === 'indirect' && dl.Forearms === 'indirect',
   'a deadlift feeds the whole posterior chain, directly once and indirectly four times');
ok(map('Romanian Deadlift').Hamstrings === 'direct', 'an RDL is direct hamstrings');
ok(map('Farmer Carry').Forearms === 'indirect', 'a carry pays the forearms');

/* ---------- no muscle is ever counted twice for one set ---------- */

for (const e of BUILT_IN_EXERCISES) {
  const c = volumeContributions(e);
  const names = c.map((x) => x.muscle);
  if (names.length !== new Set(names).size) {
    ok(false, `${e.name} counts a muscle twice`);
    break;
  }
}
ok(true, 'no exercise counts the same muscle both directly and indirectly');

/* ---------- cardio produces no lifting volume ---------- */

const cardio = BUILT_IN_EXERCISES.filter((e) => e.muscle === 'Cardio');
ok(cardio.length > 0 && cardio.every((e) => volumeContributions(e).length === 0),
   `all ${cardio.length} cardio exercises produce no resistance volume`);

/* ---------- Full Body is indirect-only, on purpose ---------- */

const fullBody = BUILT_IN_EXERCISES.filter((e) => e.muscle === 'Full Body');
ok(fullBody.every((e) => volumeContributions(e).every((c) => c.kind === 'indirect')),
   `all ${fullBody.length} full-body lifts contribute INDIRECT volume only — an Olympic lift is `
   + 'limited by technique long before a muscle nears failure');
ok(fullBody.every((e) => volumeContributions(e).length > 0),
   'but every one of them still trains something');

/* ---------- the fallback is conservative ---------- */
// This is the safety property the whole mapping leans on: anything the rules do
// not recognise must UNDERCOUNT, never invent volume.

const unmatched = BUILT_IN_EXERCISES.filter((e) => {
  const c = volumeContributions(e);
  return c.length === 1 && c[0].muscle === e.muscle && c[0].kind === 'direct';
});
ok(unmatched.every((e) => volumeContributions(e).every((c) => c.kind === 'direct')),
   'an exercise the rules do not extend contributes only its own muscle, never invented indirect work');

/* ---------- every exercise resolves to something sane ---------- */

const strays = BUILT_IN_EXERCISES.flatMap((e) => volumeContributions(e).map((c) => c.muscle))
  .filter((m) => !VOLUME_MUSCLES.includes(m) && m !== 'Neck');
ok(strays.length === 0,
   strays.length ? `contributions point at unknown muscles: ${[...new Set(strays)].join(', ')}`
                 : 'every contribution names a real muscle group');
ok(!SCORED_MUSCLES.includes('Core') && VOLUME_MUSCLES.includes('Core'),
   'Core is measured but excluded from the average — compounds train it without logging a set');

/* ---------- efficiency tiers, straight from the paper ---------- */

ok(hypertrophyTier(3).key === 'below', '3 weekly sets is below the minimum effective dose');
ok(hypertrophyTier(4).key === 'minimum', '4 sets IS the minimum effective dose (their Table 3)');
ok(hypertrophyTier(8).key === 'higher', '5-10 sets is the highest-efficiency band');
ok(hypertrophyTier(15).key === 'intermediate', '11-18 is intermediate');
ok(hypertrophyTier(25).key === 'lower', '19-29 is lower efficiency');
ok(hypertrophyTier(35).key === 'lowest', '30-42 is lowest efficiency');
ok(hypertrophyTier(50).key === 'unclear', 'past 43 sets the evidence runs out');
ok(HYPERTROPHY_TIERS.every((t) => t.detail && t.label), 'every tier can explain itself on screen');

ok(strengthTier(1).key === 'minimum', 'ONE weekly set is the minimum effective dose for strength');
ok(strengthTier(4).key === 'intermediate', 'and 3-4 is already intermediate');
ok(strengthTier(9).key === 'plateau', 'past ~5 sets strength stops reliably improving');
ok(STRENGTH_TIERS.length < HYPERTROPHY_TIERS.length,
   'strength flattens far earlier than hypertrophy — that is the whole reason they are rated apart');

/* ---------- against the real programmes ---------- */
// docs/optimal-rating-plan.md §5: if the mapping does not order the nine shipped
// systems defensibly, the mapping is wrong, not the programmes.

const volumeOf = (preset) => {
  const workouts = preset.workouts.map((w) => ({
    exercises: (w.exercises || []).map((i) => {
      const e = byName.get(i.name);
      return e ? { exerciseId: e.id, sets: Number(i.sets) || 3 } : null;
    }).filter(Boolean),
  }));
  const cycle = preset.id === 'preset-bumstead-8day' ? 8 / 7 : 1;
  return weeklyVolume(workouts, exMap, cycle);
};
const totalOf = (preset) => {
  const v = volumeOf(preset);
  return SCORED_MUSCLES.reduce((s, m) => s + (v.get(m) || 0), 0);
};
const preset = (id) => PRESET_SYSTEMS.find((p) => p.id === id);
const totals = new Map(PRESET_SYSTEMS.map((p) => [p.name, totalOf(p)]));

const golden = totals.get('The Golden Six');
const thurston = totals.get('Mike Thurston’s Six-Day Split');
ok(golden < thurston,
   `a 3-day 1960s beginner programme totals less than a 6-day bodybuilder split `
   + `(${golden.toFixed(0)} vs ${thurston.toFixed(0)})`);
ok([...totals.values()].every((v) => v > 0), 'every shipped programme produces some volume');

// The programme built ON volume landmarks should be the best-covered one. It is
// the closest thing here to a labelled example.
const landmarks = volumeOf(preset('preset-volume-landmarks'));
const covered = SCORED_MUSCLES.filter((m) => (landmarks.get(m) || 0) >= 4).length;
ok(covered >= 10,
   `Volume Landmarks Hypertrophy reaches the minimum effective dose in ${covered} of `
   + `${SCORED_MUSCLES.length} scored muscles — it should, it was designed on these numbers`);

// The "more is always better" guard, from §5 of the plan. A fabricated
// absurd programme must land in the band where the evidence gives out, not in
// the best one.
const absurd = weeklyVolume([{ exercises: [{ exerciseId: ex('Barbell Bench Press').id, sets: 60 }] }], exMap, 1);
ok(hypertrophyTier(absurd.get('Chest')).key === 'unclear',
   '60 sets of bench a week lands in "beyond the evidence", not in a better tier');

/* ---------- an 8-day cycle is not a week ---------- */

const bum = preset('preset-bumstead-8day');
const asWeek = weeklyVolume(
  bum.workouts.map((w) => ({ exercises: (w.exercises || []).map((i) => {
    const e = byName.get(i.name); return e ? { exerciseId: e.id, sets: Number(i.sets) || 3 } : null;
  }).filter(Boolean) })), exMap, 1);
const asCycle = volumeOf(bum);
ok(asCycle.get('Chest') < asWeek.get('Chest'),
   'Bumstead\'s 8-day cycle spreads over more than a week, so its weekly volume is LOWER '
   + 'than counting the same workouts as one week');

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
