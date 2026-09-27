// Machines convert by their MECHANICS, not by one factor — 2026-09-27.
//   node tests/machine-conversion.test.mjs
//
// Tim: *"the 45lbs for the machine hip thrust matches to a lot more than 45lbs
// with a barbell … the machanical advantage with the lever and extending the
// weight further away from the pivot point makes it harder to move … I wouldn't
// be supprised if the equivilant weight was over 2-3x the actual weight used for
// the machine. Additionally I don't want you to do a single conversion like
// 'machine weights are 60% of free weight counterparts' … Really think about why
// something converts to a different weight and by a certain amount."*
//
// His answers (2026-09-27): split entries per hip-thrust design AND a one-time
// leverage pick on the lever machine; his own machine "not sure" → 2.5×; Smith
// keeps "plates only" and the app adds the bar; old sets re-read as the lever.
// The plan: docs/machine-conversion-plan.md. The model: js/machine-mechanics.js.

const { BUILT_IN_EXERCISES, loggingNoteFor } = await import('../js/exercises.js');
const { buildObservations } = await import('../js/strength-observations.js');
const ev = await import('../js/muscle-evidence.js');
const { e1rm } = await import('../js/e1rm.js');
const mech = await import('../js/machine-mechanics.js');
const { contributionsFor, toKeyLift, fromKeyLift } = ev;

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol = 0.05) => Number.isFinite(a) && Math.abs(a - b) <= tol;

const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name, e]));
const ex = (n) => { const e = byName.get(n); if (!e) throw new Error('no exercise ' + n); return e; };
const TODAY = '2026-09-27';
const contrib = (n, muscle, sex = 'male') =>
  contributionsFor(ex(n), { sex, bodyWeight: 180 }).find((c) => c.muscle === muscle) || null;
// One set, rated through the REAL walk (strength-observations.js), male, 180 lb.
const readSet = (n, muscle, weight, reps, sex = 'male') => {
  const { byMuscle } = buildObservations({
    sessions: [{ date: TODAY, entries: [{ exerciseId: ex(n).id, exerciseName: n, sets: [{ weight, reps }] }] }],
    benchmarks: [], exMap, bodyWeights: [{ date: '2026-09-01', weight: 180 }], today: TODAY, sex,
  });
  return (byMuscle.get(muscle) || []).find((o) => o.exerciseName === n) || null;
};

// ── 1. The lever arithmetic (a torque balance, nothing fitted) ───────────────
{
  const lever = { k: 2.5, A: 20 };
  ok(mech.effectiveLoad(lever, 45) === 132.5, '45 lb on a 2.5× arm with a 20 lb arm is 132.5 lb at the hips');
  ok(near(mech.loggedFromEffective(lever, 132.5), 45, 1e-9), 'and back again: 132.5 at the hips is 45 lb of plates');
  ok(mech.loggedFromEffective(lever, 15) === null, 'a load below the empty arm needs no plates — null, never negative');
  const p = mech.plateE1rm(lever, 45, 10);
  ok(near(lever.k * p + lever.A, e1rm(132.5, 10), 1e-9),
     `the rep curve runs on the load the body moved: k × plate-1RM + A = e1rm(132.5, 10) = ${e1rm(132.5, 10).toFixed(1)}`);
  ok(p < e1rm(45, 10),
     `so the plate 1RM (${p.toFixed(1)}) is below the curve on bare plates (${e1rm(45, 10).toFixed(1)}) — the light-weight rep bonus is not given to a 132 lb effort`);
  ok(mech.effectiveLoad(null, 45) === null && mech.effectiveLoad(lever, 0) === null, 'no lever or no load → nothing');
}

// ── 2. Tim's case: male, 45 × 10 on the long-lever machine ──────────────────
// Plan §2: k 2 → 153, 2.5 → 184, 3 → 215 lb deadlift with Epley. The app's own
// curve (Marzagão) gives e1rm(k×45+20, 10) ÷ 0.96.
{
  mech.setLeverageChoices({});
  const o = readSet('Machine Hip Thrust', 'Glutes', 45, 10);
  const want = e1rm(2.5 * 45 + 20, 10) / 0.96;
  ok(o && near(o.estimate, want, 0.01),
     `🚨 not sure → 2.5×: 45 × 10 reads a ${o && o.estimate.toFixed(1)} lb deadlift (e1rm(132.5, 10) ÷ 0.96 = ${want.toFixed(1)})`);
  ok(o && o.estimate > 153 && o.estimate < 215,
     `inside the plan's 2–3× range of 153–215 lb, where 0.60 read ${(e1rm(45, 10) / 0.60).toFixed(1)}`);
  ok(o && o.weight === 45, 'the logged number is untouched: the observation still says 45 lb');

  const id = ex('Machine Hip Thrust').id;
  const at = (k) => { mech.setLeverageChoices({ [id]: k }); return readSet('Machine Hip Thrust', 'Glutes', 45, 10).estimate; };
  const k2 = at(2), k25 = at(2.5), k3 = at(3), k1 = at(1);
  mech.setLeverageChoices({});
  ok(k1 < k2 && k2 < k25 && k25 < k3, `more leverage, more credit: 1× ${k1.toFixed(0)} < 2× ${k2.toFixed(0)} < 2.5× ${k25.toFixed(0)} < 3× ${k3.toFixed(0)}`);
  ok(near(k2, e1rm(110, 10) / 0.96, 0.01) && near(k3, e1rm(155, 10) / 0.96, 0.01),
     'each pick is exactly e1rm(k × 45 + 20, 10) ÷ 0.96');
  ok(Math.abs(k25 - (k2 + k3) / 2) < 0.05 * (k3 - k2) + 1,
     `2.5× sits in the middle of 2× and 3× (${k25.toFixed(1)} vs ${((k2 + k3) / 2).toFixed(1)})`);
  ok(near(k25, o.estimate, 1e-9), 'and picking 2.5× reads the same number as "not sure" (the default IS 2.5×)');

  const f = readSet('Machine Hip Thrust', 'Glutes', 45, 10, 'female');
  ok(f && near(f.estimate, e1rm(132.5, 10) / 1.16, 0.01), `a woman's set converts against her own hip thrust ratio, 1.16 (${f && f.estimate.toFixed(1)})`);
}

// ── 3. The picker changes k (and only on the lever machine) ─────────────────
{
  const id = ex('Machine Hip Thrust').id;
  mech.setLeverageChoices({});
  const dflt = contrib('Machine Hip Thrust', 'Glutes');
  ok(dflt && dflt.lever && dflt.lever.k === 2.5 && dflt.lever.A === 20 && near(dflt.quality, 0.30, 1e-9),
     `not sure: k 2.5, A 20, q 0.30 (${dflt && JSON.stringify(dflt.lever)}, q ${dflt && dflt.quality})`);
  ok(dflt && near(dflt.ratio, 0.96, 1e-9), 'converted against the BARBELL hip thrust ratio (0.96 male), not a machine percentage');
  mech.setLeverageChoices({ [id]: 2 });
  const picked = contrib('Machine Hip Thrust', 'Glutes');
  ok(picked?.lever?.k === 2 && near(picked.quality, 0.35, 1e-9),
     `picked 2×: k 2 and q a step higher, 0.35 (${picked?.lever?.k}, ${picked?.quality})`);
  mech.setLeverageChoices({ [id]: 7 });
  ok(contrib('Machine Hip Thrust', 'Glutes')?.lever?.k === 2.5, 'a value that is not on the list (7×) is ignored → the default');
  mech.setLeverageChoices({ [id]: '1.5' });
  ok(contrib('Machine Hip Thrust', 'Glutes')?.lever?.k === 1.5, 'a stored string "1.5" still reads as 1.5×');
  mech.setLeverageChoices({ [id]: 3 });
  ok(byName.has('Machine Hip Thrust (Plates at Hips)') && contrib('Machine Hip Thrust (Plates at Hips)', 'Glutes')?.lever?.k === 1,
     'a pick belongs to one exercise: the plates-at-hips design keeps its own k');
  mech.setLeverageChoices({});

  ok(mech.isLeveragePickable(ex('Machine Hip Thrust')), 'the lever machine offers the pick');
  ok(!['Machine Hip Thrust (Plates at Hips)', 'Machine Hip Thrust (Weight Stack)', 'Smith Machine Squat', 'Hip Thrust', 'Leg Press']
    .some((n) => mech.isLeveragePickable(ex(n))), 'nothing else does (the design already says where the plates sit)');
  ok(!mech.isLeveragePickable({ ...ex('Machine Hip Thrust'), isCustom: true }), 'nor a custom exercise wearing its name');

  // What gets saved: a flat map of numbers — Firestore refuses nested arrays (§0.22).
  const saved = mech.withLeverageChoice({ other: 2, junk: 'x' }, id, 2.5);
  ok(JSON.stringify(saved) === JSON.stringify({ other: 2, [id]: 2.5 }), `saved as a flat map of numbers (${JSON.stringify(saved)})`);
  ok(!(id in mech.withLeverageChoice(saved, id, null)), '"not sure" removes the pick rather than storing a null');
}

// ── 4. Old sets re-read as the long lever ───────────────────────────────────
{
  ok(ex('Machine Hip Thrust').id === 'machine-hip-thrust--glutes',
     'the original entry keeps its id, so every set already logged on it is read as the long-lever design');
  ok(byName.has('Machine Hip Thrust (Plates at Hips)') && byName.has('Machine Hip Thrust (Weight Stack)'),
     'the two other designs are their own library entries');
}

// ── 5. Each design by its own mechanics ─────────────────────────────────────
{
  mech.setLeverageChoices({});
  const lever = contrib('Machine Hip Thrust', 'Glutes');
  const hips = contrib('Machine Hip Thrust (Plates at Hips)', 'Glutes');
  const stack = contrib('Machine Hip Thrust (Weight Stack)', 'Glutes');
  const bar = contrib('Hip Thrust', 'Glutes');
  ok(hips && hips.lever.k === 1 && hips.lever.A === 15 && near(hips.quality, 0.35, 1e-9),
     'plates at the hips: k 1, A 15 (the Glute Drive\'s published starting resistance), q 0.35');
  ok(stack && stack.lever.k === 0.8 && stack.lever.A === 0 && near(stack.quality, 0.25, 1e-9),
     'weight stack: k 0.8 (a cam/pulley reduction), A 0 (in the stack), q 0.25');
  const per = (c) => toKeyLift(c, 100);
  ok(per(lever) > per(hips) && per(hips) > per(stack),
     `100 lb logged: lever ${per(lever).toFixed(0)} > at the hips ${per(hips).toFixed(0)} > stack ${per(stack).toFixed(0)} lb deadlift`);
  // Per EXTRA pound logged, at the barbell's median ratio (its level curve set aside).
  const flatBar = { ...bar, level: undefined };
  const slope = (c) => (toKeyLift(c, 200) - toKeyLift(c, 100)) / 100;
  ok(near(slope(lever) / slope(flatBar), 2.5, 1e-9),
     `🚨 each lever pound is worth 2.5 barbell pounds, inside Tim's "2-3x" (${slope(lever).toFixed(2)} vs ${slope(flatBar).toFixed(2)} lb of deadlift per lb)`);
  for (const [n, c] of [['lever', lever], ['hips', hips], ['stack', stack]]) {
    ok(near(fromKeyLift(c, toKeyLift(c, 80)), 80, 1e-6), `${n}: fromKeyLift undoes toKeyLift (80 lb round trip)`);
  }
  ok(loggingNoteFor(ex('Machine Hip Thrust')) === 'Plates only' && loggingNoteFor(ex('Machine Hip Thrust (Plates at Hips)')) === 'Plates only',
     'the two plate-loaded designs say "Plates only"');
  ok(loggingNoteFor(ex('Machine Hip Thrust (Weight Stack)')) === null, 'the stack needs no note (the pin is the number)');
}

// ── 6. Smith: plates only in, the bar added in the conversion ───────────────
{
  const sq = contrib('Smith Machine Squat', 'Quads');
  ok(sq && sq.lever && sq.lever.k === 1 && sq.lever.A === mech.SMITH_BAR_SL,
     `Smith squat (ratio from Strength Level's Smith page, whose lifters include the bar) adds ${mech.SMITH_BAR_SL} lb`);
  const bench = contrib('Smith Machine Bench Press', 'Chest');
  ok(bench && bench.lever && bench.lever.A === mech.SMITH_BAR_EFFECTIVE,
     `Smith bench (a reasoned ratio) adds the bar's effective ${mech.SMITH_BAR_EFFECTIVE} lb`);
  const smithNames = BUILT_IN_EXERCISES.filter((e) => /^Smith Machine /.test(e.name)).map((e) => e.name);
  const bare = smithNames.filter((n) => contributionsFor(ex(n), { sex: 'male' }).some((c) => c.kind === 'direct' && !(c.lever && c.lever.A > 0)));
  ok(smithNames.length >= 8 && bare.length === 0, `every Smith entry (${smithNames.length}) adds a bar (${bare.join(', ') || 'none without'})`);

  const o = readSet('Smith Machine Squat', 'Quads', 225, 5);
  const noBar = toKeyLift({ ...sq, lever: undefined }, e1rm(225, 5));
  ok(o && o.estimate > noBar, `🚨 225 × 5 on a Smith now reads ${o && o.estimate.toFixed(1)} lb squat, up from ${noBar.toFixed(1)} with no bar`);
  ok(o && o.weight === 225, 'and the logged 225 is untouched (plates only, as Tim chose)');
  ok(o && near(o.estimate, toKeyLift({ ...sq, lever: undefined }, e1rm(225 + 44, 5)), 1e-6),
     'exactly the Smith page\'s own conversion of 269 lb with the bar');

  const ht = contrib('Smith Machine Hip Thrust', 'Glutes');
  ok(ht && near(ht.ratio, 0.96, 1e-9) && ht.lever.k === 1 && ht.lever.A === mech.SMITH_BAR_EFFECTIVE,
     'the Smith hip thrust is plates over the hips + the bar, against the barbell hip thrust (0.96)');
  const glute = contrib('Smith Machine Squat', 'Glutes');
  ok(glute && glute.kind === 'fallback' && glute.lever && glute.lever.A === mech.SMITH_BAR_SL,
     'a Smith squat standing in for the glutes carries its bar into the stand-in too');
}

// ── 7. Machine Glute Kickback: one leg, not doubled ─────────────────────────
{
  const m = contrib('Machine Glute Kickback', 'Glutes');
  const c = contrib('Cable Kickback', 'Glutes');
  ok(m && near(m.ratio, 0.32, 1e-9), `the machine kickback has its own ratio, 0.32 (${m && m.ratio})`);
  ok(m && c && Math.abs(toKeyLift(m, 60) / toKeyLift(c, 120) - 1) < 0.02,
     'so 60 lb on one leg reads like the cable kickback\'s 60 per side (doubled to 120), not half of it');
}

// ── 8. Nothing else moved ───────────────────────────────────────────────────
{
  for (const [n, muscle] of [['Leg Press', 'Quads'], ['Hip Thrust', 'Glutes'], ['Pendulum Squat', 'Quads'], ['Machine Chest Press', 'Chest']]) {
    const c = contrib(n, muscle);
    ok(c && !c.lever, `${n} has no lever (unchanged)`);
  }
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
