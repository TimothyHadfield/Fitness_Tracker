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
  // 🔄 2026-09-27 (second pass): the Smith bench moved onto its own Strength
  // Level page, so it adds the page's 44 like the squat; the OHP stays reasoned.
  const bench = contrib('Smith Machine Bench Press', 'Chest');
  ok(bench && bench.lever && bench.lever.A === mech.SMITH_BAR_SL,
     `Smith bench (now from Strength Level's Smith bench page) adds ${mech.SMITH_BAR_SL} lb`);
  const ohp = contrib('Smith Machine Overhead Press', 'Shoulders');
  ok(ohp && ohp.lever && ohp.lever.A === mech.SMITH_BAR_EFFECTIVE,
     `Smith OHP (a reasoned ratio, no page) adds the bar's effective ${mech.SMITH_BAR_EFFECTIVE} lb`);
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

// ── 9. The second pass: every reasoned machine entry re-checked ─────────────
// Tim: *"Yes rework the other exercises if you think they should be."* Each
// changed entry below is pinned to ITS OWN arithmetic — a Strength Level median
// over the key lift's median, or a carry whose factor is itself measured —
// never to one machine factor. Key-lift medians (m180 / f140): bench 220/108,
// row 198/97, squat 298/165, RDL 280/151, OHP 140/70, curl 104/53,
// close-grip 208/106, wrist curl 98/52.
{
  const { EXERCISE_STANDARDS } = await import('../js/exercise-standards.js');
  const KEY = { Chest: [220, 108], Back: [198, 97], Quads: [298, 165], Hamstrings: [280, 151],
    Shoulders: [140, 70], Biceps: [104, 53], Triceps: [208, 106], Forearms: [98, 52] };
  const r = (n, muscle, sex) => contrib(n, muscle, sex)?.ratio;
  const both = (n, muscle, m, f, tol = 0.006) => {
    const gm = r(n, muscle, 'male'), gf = r(n, muscle, 'female');
    ok(near(gm, m, tol) && near(gf, f, tol), `${n}: ${m} male / ${f} female (got ${gm} / ${gf})`);
  };
  // A sourced entry's row must be in exercise-standards.js AND reproduce the ratio.
  const sourced = (n, muscle, { doubled = false } = {}) => {
    const row = EXERCISE_STANDARDS.get(n);
    ok(row && row.muscle === muscle, `${n}: its Strength Level row is shipped (${row && row.slug})`);
    if (!row) return;
    const k = doubled ? 2 : 1;
    const [km, kf] = KEY[muscle];
    return { m: k * row.m[2] / km, f: k * row.f[2] / kf };
  };

  // Smith bench — SL smith-machine-bench-press 212/220 m, 100/108 f: 0.964 /
  // 0.926, within 10 % → one number, 0.95, on the page's bar-included scale.
  {
    const d = sourced('Smith Machine Bench Press', 'Chest');
    ok(d && near(d.m, 0.964, 0.001) && near(d.f, 0.926, 0.001), 'Smith bench row: 0.964 m / 0.926 f');
    both('Smith Machine Bench Press', 'Chest', 0.95, 0.95);
    const c = contrib('Smith Machine Bench Press', 'Chest');
    ok(near(toKeyLift({ ...c, level: undefined }, 100), 144 / 0.95, 1e-9),
       '100 lb of plates on a Smith bench = 144 lb on the page\'s scale ÷ 0.95 = 151.6 lb bench (was 120 ÷ 1.00)');
  }
  // Smith incline — carried: Smith bench × SL's incline-over-flat barbell
  // factor (195/220 = 0.886 m, 90/108 = 0.833 f) → 0.854 / 0.771, a pair.
  both('Smith Machine Incline Bench Press', 'Chest', 0.85, 0.77);
  ok(contrib('Smith Machine Incline Bench Press', 'Chest')?.lever?.A === mech.SMITH_BAR_SL,
     'the Smith incline is carried off the bar-included Smith bench, so it adds the same 44');

  // The landmine family — SL's T-bar and landmine squat pages both say "include
  // the bar, normally 44 lb"; the app logs plates only, so the conversion adds it.
  for (const [n, muscle] of [['T-Bar Row', 'Back'], ['Landmine Row', 'Back'], ['Landmine Squat', 'Quads']]) {
    const c = contrib(n, muscle);
    ok(c?.lever?.k === 1 && c.lever.A === mech.LANDMINE_BAR_SL, `${n}: plates + the page's 44 lb bar (k 1, A ${c?.lever?.A})`);
  }
  both('T-Bar Row', 'Back', 0.93, 0.99);
  both('Landmine Row', 'Back', 0.93, 0.99);
  {
    const d = sourced('Landmine Squat', 'Quads');
    ok(d && near(d.m, 0.658, 0.001) && near(d.f, 0.655, 0.001), 'landmine squat row: 196/298 = 0.658 m, 108/165 = 0.655 f');
    both('Landmine Squat', 'Quads', 0.66, 0.66);
    const o = readSet('T-Bar Row', 'Back', 135, 8);
    const c = contrib('T-Bar Row', 'Back');
    ok(o && near(o.estimate, toKeyLift({ ...c, lever: undefined }, e1rm(135 + 44, 8)), 1e-6),
       `135 × 8 on a T-bar reads the page's own conversion of 179 lb with the bar (${o && o.estimate.toFixed(1)})`);
  }

  // One arm at a time — SL one-arm-lat-pulldown, per arm, DOUBLED (the app's
  // convention): 128×2/198 = 1.29 m, 70×2/97 = 1.44 f. One arm pulls ~68 % of
  // what two arms do (the bilateral deficit), so a doubled number runs 1.36×
  // the two-arm pulldown's — the same 1.36 on both sexes.
  {
    const d = sourced('Single-Arm Lat Pulldown', 'Back', { doubled: true });
    ok(d && near(d.m, 1.293, 0.001) && near(d.f, 1.443, 0.001), 'one-arm pulldown row doubled: 1.293 m / 1.443 f');
    both('Single-Arm Lat Pulldown', 'Back', 1.29, 1.44);
    ok(near(1.29 / 0.95, 1.44 / 1.06, 0.01), 'the one-arm factor is the same for men and women (1.36)');
    // Carried onto the one-arm cable row: seated cable row 0.98 / 1.06 × 1.36.
    both('Single-Arm Cable Row', 'Back', 1.33, 1.44);
    ok(contrib('Single-Arm Cable Row', 'Back').quality < contrib('Single-Arm Lat Pulldown', 'Back').quality,
       'the carried cable row is believed less than the sourced pulldown');
  }

  // One leg at a time — SL standing-leg-curl 102/280 = 0.364 m, 67/151 = 0.444 f.
  {
    const d = sourced('Standing Leg Curl', 'Hamstrings');
    ok(d && near(d.m, 0.364, 0.001) && near(d.f, 0.444, 0.001), 'standing leg curl row: 0.364 m / 0.444 f');
    both('Standing Leg Curl', 'Hamstrings', 0.36, 0.44);
    both('Cable Leg Curl', 'Hamstrings', 0.36, 0.44);
    both('Lying Leg Curl', 'Hamstrings', 0.53, 0.53);
  }

  // Cable and machine pages that were not being read.
  {
    const up = sourced('Cable Upright Row', 'Shoulders');
    ok(up && near(up.m, 1.000, 0.001) && near(up.f, 1.114, 0.001), 'cable upright row row: 140/140 m, 78/70 f');
    both('Cable Upright Row', 'Shoulders', 1.00, 1.11);
    both('Upright Row', 'Shoulders', 0.94, 0.94);
    const rh = sourced('Cable Rope Hammer Curl', 'Biceps');
    ok(rh && near(rh.m, 0.933, 0.001) && near(rh.f, 1.075, 0.001), 'rope hammer row: 97/104 m, 57/53 f');
    both('Cable Rope Hammer Curl', 'Biceps', 0.93, 1.08);
    const te = sourced('Machine Triceps Extension', 'Triceps');
    ok(te && near(te.m, 0.788, 0.001) && near(te.f, 0.830, 0.001), 'machine triceps extension row: 164/208 m, 88/106 f');
    both('Machine Triceps Extension', 'Triceps', 0.81, 0.81);
    const rg = sourced('Reverse-Grip Pushdown', 'Triceps');
    ok(rg && near(rg.m, 0.519, 0.001) && near(rg.f, 0.585, 0.001), 'reverse-grip pushdown row: 108/208 m, 62/106 f');
    both('Reverse-Grip Pushdown', 'Triceps', 0.52, 0.58);
    both('Triceps Pushdown', 'Triceps', 0.61, 0.61);
  }

  // Carried machines, each off a sourced anchor by a measured factor.
  both('Incline Machine Press', 'Chest', 0.81, 0.62);          // chest press 0.91/0.75 × 0.886/0.833
  both('Chest-Supported Row', 'Back', 1.18, 1.20);             // the machine-row page's own machine
  both('Machine Preacher Curl', 'Biceps', 1.15, 1.15);         // machine curl 1.23/1.09 × preacher 0.96/1.02
  both('Cable Reverse Curl', 'Forearms', 0.98, 0.98);          // reverse curl 0.92/0.90 × cable 1.106/1.057

  // Left as they were, on purpose.
  both('Pendulum Squat', 'Quads', 1.05, 1.05);
  both('Reverse Hyperextension', 'Back', 0.55, 0.55);
  both('Donkey Calf Raise', 'Calves', 1.05, 1.05);
  both('Meadows Row', 'Back', 0.55, 0.55);
  ok(!contrib('Meadows Row', 'Back')?.lever, 'a per-side landmine lift gets no bar offset (see machine-mechanics.js)');
  ok(contrib('Smith Machine Overhead Press', 'Shoulders')?.ratio === 1.05, 'Smith OHP keeps its reasoned 1.05');
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
