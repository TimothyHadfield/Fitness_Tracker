// Weight steps, bar and plates the user owns (settings ST-4 / ST-5, 2026-09-27).
//
//   node tests/weight-prefs.test.mjs      (no dependencies: pure arithmetic)
//
// Tim: *"If it just comes down to preference, maybe add it to the settings menu
// and make the default the most smooth and best."*
//
// Pinned here:
//   · an account that never touched the settings gets EXACTLY today: 5 lb /
//     2.5 kg steps, the same frozen inventories, the same labels, the same ramp;
//   · the bar the user picks is the warm-up's first row and the label's bar;
//   · a user's non-canonical plates (35s) get the FEWEST plates, not greedy's;
//   · a 1.25 kg step lands the warm-up on 1.25 kg targets;
//   · the label never rounds the user's number to fit their plates;
//   · anything off the option lists falls back to the default.

const BASE = new URL('../js/', import.meta.url).href;
const U = await import(BASE + 'units.js');
const P = await import(BASE + 'plates.js');
const { warmupRamp } = await import(BASE + 'warmup.js');
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const squat = BUILT_IN_EXERCISES.find((e) => e.name === 'Back Squat');
const bb = { bar: true, points: 2 };
const KG = (kg) => kg * U.LB_PER_KG;
const labelNow = (lb, unit = 'lbs', o = bb) => P.plateLabel(P.plateLoad(lb, { inventory: P.inventoryFor(unit), ...o }));
const show = (r) => r.map((s) => `${s.weight}x${s.reps}`).join(', ') || 'none';

/* ============ 1. untouched account = today, byte for byte ============ */
{
  U.setUnits('lbs');
  ok(U.weightStep() === 5, 'lbs step is 5 before any prefs are seeded');
  ok(P.inventoryFor('lbs') === P.LB_INVENTORY && P.inventoryFor('kg') === P.KG_INVENTORY,
     'unseeded: inventoryFor() hands back the very same frozen inventories');

  // What app.js seeds for an old account: a settings doc with neither key.
  const kept = U.setWeightPrefs({ units: 'lbs', theme: 'dark' });
  ok(kept.weightStep.lbs === 5 && kept.weightStep.kg === 2.5, 'no weightStep key -> 5 lb / 2.5 kg');
  ok(P.inventoryFor('lbs') === P.LB_INVENTORY && P.inventoryFor('kg') === P.KG_INVENTORY && !P.LB_INVENTORY.custom,
     'no plates key -> the same default inventories, so greedy still runs');
  U.setWeightPrefs({ weightStep: { lbs: 5, kg: 2.5 }, plates: U.DEFAULT_PLATES });
  ok(P.inventoryFor('lbs') === P.LB_INVENTORY && P.inventoryFor('kg') === P.KG_INVENTORY,
     'the defaults written out explicitly are still the default inventories');
  U.setWeightPrefs(null);
  ok(P.inventoryFor('lbs') === P.LB_INVENTORY, 'null settings are the defaults too');

  ok(labelNow(275) === 'bar + 45, 45, 25 each side', `275 lb label unchanged (${labelNow(275)})`);
  ok(labelNow(KG(100), 'kg') === 'bar + 25, 15 each side', `100 kg label unchanged (${labelNow(KG(100), 'kg')})`);

  // The DP, handed the default plates, must agree with greedy on every weight
  // — that is what lets the default inventories keep greedy with no change.
  const asCustom = (inv) => Object.freeze({ ...inv, custom: true });
  let diffLb = 0, diffKg = 0;
  for (let lb = 45; lb <= 1045; lb += 2.5) {
    const a = P.plateLabel(P.plateLoad(lb, { inventory: P.LB_INVENTORY, ...bb }));
    const b = P.plateLabel(P.plateLoad(lb, { inventory: asCustom(P.LB_INVENTORY), ...bb }));
    if (a !== b) diffLb++;
  }
  for (let kg = 20; kg <= 520; kg += 1.25) {
    const a = P.plateLabel(P.plateLoad(KG(kg), { inventory: P.KG_INVENTORY, ...bb }));
    const b = P.plateLabel(P.plateLoad(KG(kg), { inventory: asCustom(P.KG_INVENTORY), ...bb }));
    if (a !== b) diffKg++;
  }
  ok(diffLb === 0 && diffKg === 0, `fewest-plates agrees with greedy on the default sets (lb diffs ${diffLb}, kg diffs ${diffKg})`);

  const r = warmupRamp({ exercise: squat, weight: 225, reps: 4, unit: 'lbs' });
  ok(show(r) === '45x10, 90x8, 135x4, 180x3', `225 x 4 squat ramp unchanged (${show(r)})`);
  const rk = warmupRamp({ exercise: squat, weight: 100, reps: 5, unit: 'kg' });
  ok(rk[0] && rk[0].weight === 20 && rk.every((s) => s.weight % 2.5 === 0), `100 kg ramp starts at 20 in 2.5s (${show(rk)})`);
}

/* ============ 2. a 35 lb bar ============ */
{
  U.setWeightPrefs({ plates: { lbs: { bar: 35, have: [45, 25, 10, 5, 2.5] } } });
  const inv = P.inventoryFor('lbs');
  ok(inv.bar === 35 && inv.custom === true && inv.unit === 'lbs', 'the chosen 35 lb bar is the inventory bar');
  ok(P.inventoryFor('kg') === P.KG_INVENTORY, 'and kg is untouched');
  ok(P.inventoryFor('lbs') === inv, 'the same choice gives the same inventory object');
  ok(labelNow(35) === 'bar only', `35 lb is the empty bar (${labelNow(35)})`);
  ok(labelNow(125) === 'bar + 45 each side', `125 lb = 35 bar + 45 a side (${labelNow(125)})`);
  const r = warmupRamp({ exercise: squat, weight: 135, reps: 5, unit: 'lbs' });
  ok(r[0] && r[0].weight === 35 && r[0].reps === 10, `warm-up first row is the 35 lb bar x 10 (${show(r)})`);
  const pinned = warmupRamp({ exercise: squat, weight: 135, reps: 5, unit: 'lbs', bar: 45 });
  ok(pinned[0] && pinned[0].weight === 45, `a caller can still pin the bar (${show(pinned)})`);
}

/* ============ 3. 35s on the rack: fewest plates ============ */
{
  U.setWeightPrefs({ plates: { lbs: { bar: 45, have: [45, 35, 25, 10, 5, 2.5] } } });
  ok(labelNow(165) === 'bar + 35, 25 each side', `60 a side with 35s -> 35 + 25 (${labelNow(165)})`);
  ok(labelNow(185) === 'bar + 45, 25 each side', `70 a side: tie goes to the heavier first plate (${labelNow(185)})`);
  ok(labelNow(275) === 'bar + 45, 45, 25 each side', `275 still 45, 45, 25 (${labelNow(275)})`);

  // Exhaustive: exact everywhere greedy is, and never more plates.
  const inv = P.inventoryFor('lbs');
  let worse = 0, inexact = 0, better = 0;
  for (let side = 2.5; side <= 500; side += 2.5) {
    const total = 45 + 2 * side;
    const dp = P.plateLoad(total, { inventory: inv, ...bb });
    const greedy = P.plateLoad(total, { inventory: { ...inv, custom: false }, ...bb });
    if (!dp.exact) inexact++;
    if (dp.each.length > greedy.each.length) worse++;
    if (dp.each.length < greedy.each.length) better++;
  }
  ok(inexact === 0 && worse === 0, `every 2.5 lb step to 500 a side is exact and never more plates (inexact ${inexact}, worse ${worse})`);
  ok(better > 0, `and some are fewer plates than greedy (${better} weights)`);
}

/* ============ 4. the label never rounds the user's number ============ */
{
  U.setWeightPrefs({ plates: { kg: { bar: 20, have: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] } } });
  ok(labelNow(KG(101), 'kg') === 'bar + 25, 15, 0.5 each side', `101 kg with 0.5s (${labelNow(KG(101), 'kg')})`);
  // 1.25 and 0.5 together make any quarter kilo: 40.25 a side is 25+10+2.5+1.25+0.5+0.5+0.5.
  ok(labelNow(KG(100.5), 'kg') === 'bar + 25, 10, 2.5, 1.25, 0.5, 0.5, 0.5 each side',
     `100.5 kg is exact with 1.25s and 0.5s (${labelNow(KG(100.5), 'kg')})`);
  ok(labelNow(KG(100.25), 'kg') === null, 'but 100.25 kg (40.125 a side) prints nothing rather than a near miss');
  const miss = P.plateLoad(KG(100.25), { inventory: P.inventoryFor('kg'), ...bb });
  ok(!miss.exact && miss.loaded < 100.25 && miss.short > 0, `and it undershoots, never over (${miss.loaded} kg, short ${miss.short})`);

  U.setWeightPrefs({ plates: { kg: { bar: 15, have: [25, 20, 15, 10] } } });   // bumpers only
  ok(labelNow(KG(55), 'kg') === 'bar + 20 each side', `bumper gym, 15 kg bar: 55 kg (${labelNow(KG(55), 'kg')})`);
  ok(labelNow(KG(60), 'kg') === null, 'bumper gym: 60 kg (22.5 a side) cannot be built, so no label');

  U.setWeightPrefs({ plates: { lbs: { bar: 45, have: [] } } });
  ok(labelNow(45) === 'bar only' && labelNow(95) === null, 'no plates at all: only the empty bar is a label');
}

/* ============ 5. steps ============ */
{
  U.setWeightPrefs({ weightStep: { lbs: 2.5, kg: 1.25 } });
  U.setUnits('lbs');
  ok(U.weightStep() === 2.5, 'lbs step 2.5 when chosen');
  U.setUnits('kg');
  ok(U.weightStep() === 1.25, 'kg step 1.25 when chosen');
  ok(U.weightStepFor('lbs') === 2.5 && U.weightStepFor('kg') === 1.25, 'weightStepFor() is keyed by the unit named');

  const r = warmupRamp({ exercise: squat, weight: 105, reps: 5, unit: 'kg' });
  ok(r.length > 1 && r[0].weight === 20 && r.every((s) => Math.abs(s.weight / 1.25 - Math.round(s.weight / 1.25)) < 1e-9),
     `kg ramp with 1.25 steps lands on 1.25 kg targets (${show(r)})`);
  ok(r.some((s) => s.weight % 2.5 !== 0), 'and at least one target is only reachable in 1.25s (the step really is used)');
  const r2 = warmupRamp({ exercise: squat, weight: 105, reps: 5, unit: 'kg', step: 2.5 });
  ok(r2.every((s) => s.weight % 2.5 === 0), `a caller can still pin the step (${show(r2)})`);

  U.setWeightPrefs({ weightStep: { kg: 1 } });
  ok(U.weightStepFor('kg') === 1 && U.weightStepFor('lbs') === 5, 'kg 1 chosen, lbs left at its default');
  U.setUnits('lbs');
}

/* ============ 6. junk falls back ============ */
{
  const kept = U.setWeightPrefs({
    weightStep: { lbs: 3, kg: '2.5' },
    plates: { lbs: { bar: 50, have: [45, 'x', 33, 25, 25, -5] }, kg: { bar: '15', have: 'lots' } },
  });
  ok(kept.weightStep.lbs === 5, 'a 3 lb step is not an option -> 5');
  ok(kept.weightStep.kg === 2.5, 'a numeric string on the list is read as its number');
  ok(kept.plates.lbs.bar === 45 && kept.plates.lbs.have.join(',') === '45,25', `junk plates dropped, bar 50 -> 45 (${kept.plates.lbs.have})`);
  ok(kept.plates.kg.bar === 15 && kept.plates.kg.have.join(',') === '25,20,15,10,5,2.5,1.25', 'kg: bar "15" kept, a non-array have -> default plates');
  ok(Object.isFrozen(kept.plates.lbs.have), 'what is kept is frozen, so no caller can edit the live prefs');
}

/* ============ 7. the option lists the Settings sheet shows ============ */
{
  ok(U.WEIGHT_STEP_OPTIONS.lbs.join(' ') === '2.5 5' && U.WEIGHT_STEP_OPTIONS.kg.join(' ') === '1 1.25 2.5', 'step chips');
  ok(U.BAR_OPTIONS.lbs.join(' ') === '45 35 15' && U.BAR_OPTIONS.kg.join(' ') === '20 15 10', 'bar chips');
  ok(U.PLATE_OPTIONS.lbs.join(' ') === '55 45 35 25 10 5 2.5 1.25' && U.PLATE_OPTIONS.kg.join(' ') === '25 20 15 10 5 2.5 1.25 0.5', 'plate chips');
  ok(U.DEFAULT_PLATES.lbs.have.join(',') === P.LB_INVENTORY.plates.join(',') && U.DEFAULT_PLATES.lbs.bar === P.LB_INVENTORY.bar
     && U.DEFAULT_PLATES.kg.have.join(',') === P.KG_INVENTORY.plates.join(',') && U.DEFAULT_PLATES.kg.bar === P.KG_INVENTORY.bar,
     'the defaults in units.js are exactly plates.js\'s inventories');
  ok(U.DEFAULT_PLATES.lbs.have.every((p) => U.PLATE_OPTIONS.lbs.includes(p)) && U.DEFAULT_PLATES.kg.have.every((p) => U.PLATE_OPTIONS.kg.includes(p)),
     'every default plate is on the option list');
}

U.setWeightPrefs({});
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
