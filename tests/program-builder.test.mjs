// The intro's program builder and the ready-made presets it offers — overhaul
// 2026-09-27: S-05a (equipment tag), S-05b (Dumbbell Home, Bodyweight),
// S-15 (plan is a week), O-5 (passes its own checker), O-6 (no pull-ups with
// dumbbells only), O-8 (easier lifts for beginners and 60+).
//
// Run: node tests/program-builder.test.mjs
// PB_JS=<folder> points it at another copy of js/ (used to watch it fail on
// the code before the change).

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };

const BASE = process.env.PB_JS
  ? pathToFileURL(process.env.PB_JS.replace(/[\\/]?$/, '/')).href
  : new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const presets = await import(BASE + 'preset-systems.js');
const { PRESET_SYSTEMS, presetById, presetPlan } = presets;
const presetEquipment = presets.presetEquipment || (() => null);
const { buildProgram, matchingPresets } = await import(BASE + 'program-builder.js');
const { lintProgramme } = await import(BASE + 'template-lint.js');

const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const byName = new Map();
for (const e of BUILT_IN_EXERCISES) if (!byName.has(e.name)) byName.set(e.name, e);

/* ================= S-05a: the equipment tag ================= */
ok(typeof presets.presetEquipment === 'function', 'preset-systems.js exports presetEquipment()');
const OLD_NINE = ['preset-nippard-ppl-2023', 'preset-israetel-floating-split', 'preset-arnold-golden-six',
  'preset-thurston-6day', 'preset-bumstead-8day', 'preset-volume-landmarks', 'preset-ppl',
  'preset-upper-lower', 'preset-full-body'];
ok(OLD_NINE.every((id) => presetById(id) && presetEquipment(presetById(id)) === 'Full gym'),
   'the nine existing presets all read "Full gym"');
const fake = (names) => ({ workouts: [{ key: 'x', name: 'X', exercises: names.map((name) => ({ name, sets: 3 })) }] });
ok(presetEquipment(fake(['Push-Up', 'Inverted Row'])) === 'No equipment', 'body weight only → "No equipment"');
ok(presetEquipment(fake(['Push-Up', 'Goblet Squat'])) === 'Dumbbells', 'dumbbells and body weight → "Dumbbells"');
ok(presetEquipment(fake(['Goblet Squat', 'Back Squat'])) === 'Full gym', 'one barbell lift → "Full gym"');
ok(presetEquipment(fake(['Goblet Squat', 'Not A Real Lift'])) === 'Full gym',
   'a name the library does not know never claims less gear');
// Derived, never typed: swapping one exercise moves the tag with it.
const home = presetById('preset-dumbbell-home');
if (home) {
  const swapped = JSON.parse(JSON.stringify(home));
  swapped.workouts[0].exercises[0].name = 'Back Squat';
  ok(presetEquipment(swapped) === 'Full gym', 'swap a barbell lift into Dumbbell Home and its tag follows');
}

/* ================= S-05b: the two new presets ================= */
const bw = presetById('preset-bodyweight');
ok(Boolean(home && bw), 'Dumbbell Home and Bodyweight exist');
const wordsOf = (s) => String(s).split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
const sentences = (s) => String(s || '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
for (const p of [home, bw].filter(Boolean)) {
  ok(p.author === 'Fitness Tracker' && !p.basedOn && !p.unofficial && p.sourceUrl === null,
     `${p.name} is the app's own`);
  ok(p.version === 1, `${p.name} starts at version 1`);
  ok(p.daysPerWeek === 3 && p.workouts.length === 3, `${p.name} is three days, three workouts`);
  const names = p.workouts.flatMap((w) => w.exercises.map((e) => e.name));
  ok(names.every((n) => byName.has(n)), `every exercise in ${p.name} is in the library`);
  ok(new Set(p.workouts.map((w) => w.key)).size === 3, `${p.name}'s workout keys are unique`);
  const long = [p.summary, p.notes, ...p.workouts.map((w) => w.notes)].flatMap(sentences)
    .filter((s) => wordsOf(s).length > 15);
  ok(long.length === 0, `${p.name}: no sentence over 15 words${long.length ? ' — ' + long.join(' | ') : ''}`);
  const plan = presetPlan(p);
  ok(plan && plan.kind === 'week' && plan.slots.length === 7
     && plan.slots.filter((s) => s !== 'rest').every((k) => p.workouts.some((w) => w.key === k)),
     `${p.name}'s notes name Monday, Wednesday, Friday, so its plan is a week`);
}
if (home) ok(presetEquipment(home) === 'Dumbbells', 'Dumbbell Home derives to "Dumbbells"');
if (bw) ok(presetEquipment(bw) === 'No equipment', 'Bodyweight derives to "No equipment"');

const idFor = (n) => (byName.get(n) || {}).id;
const asProgramme = (p) => p.workouts.map((w) => ({
  id: `${p.id}/${w.key}`, name: w.name,
  exercises: w.exercises.map((e) => ({ exerciseId: idFor(e.name), sets: e.sets })),
}));
if (home) {
  const f = lintProgramme(asProgramme(home), exMap);
  ok(f.length === 0, `template-lint has nothing to say about Dumbbell Home (${f.map((x) => x.message).join(' | ')})`);
}
if (bw) {
  const f = lintProgramme(asProgramme(bw), exMap);
  ok(f.length === 1 && f[0].muscle === 'Biceps',
     `Bodyweight's one finding is the true one — biceps, with no curl possible (${f.map((x) => x.muscle).join(', ')})`);
  ok(!BUILT_IN_EXERCISES.some((e) => e.equipment === 'Bodyweight' && e.muscle === 'Biceps'),
     'and the library really has no body-weight biceps exercise (add one and this preset should use it)');
}

// The existing presets' content is untouched (the version guard's hashes).
const contentHash = (p) => {
  const { version, changes, ...content } = p;
  void version; void changes;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12);
};
const HASHES = {
  'preset-nippard-ppl-2023': '0a818ca6788a', 'preset-israetel-floating-split': '7ce8ce4e7625',
  'preset-arnold-golden-six': 'c20c0568b820', 'preset-thurston-6day': '418e3081b80b',
  'preset-bumstead-8day': 'bf445901d3f7', 'preset-volume-landmarks': '069013667ac0',
  'preset-ppl': 'c0df6f59fb08', 'preset-upper-lower': '76964db4627b', 'preset-full-body': '6068a42841bb',
};
const moved = Object.entries(HASHES).filter(([id, h]) => !presetById(id) || contentHash(presetById(id)) !== h);
ok(moved.length === 0, `the nine existing presets are byte-for-byte unchanged${moved.length ? ': ' + moved.map(([id]) => id) : ''}`);
ok(OLD_NINE.every((id) => (presetById(id).version || 1) === (id === 'preset-nippard-ppl-2023' ? 3 : 1)),
   'and none of them was bumped');
ok(PRESET_SYSTEMS.slice(0, 9).map((p) => p.id).join() === OLD_NINE.join(), 'the new two come after the nine, in list order');

/* ================= matchingPresets ================= */
const ids = (a) => matchingPresets(a).map((p) => p.id);
for (const days of [2, 3, 4, 5, 6]) {
  const db = ids({ days, experience: 'under1', equipment: 'dumbbells' });
  ok(db[0] === 'preset-dumbbell-home', `dumbbells, ${days} days → Dumbbell Home first (${db})`);
  const b = ids({ days, experience: '1to3', equipment: 'bodyweight' });
  ok(b.length === 1 && b[0] === 'preset-bodyweight', `bodyweight, ${days} days → Bodyweight only (${b})`);
  ok(ids({ days, experience: 'new', equipment: 'barbell' }).length === 0, `barbell at home, ${days} days → none fits`);
  for (const experience of ['new', 'under1', '1to3', '3plus']) {
    const g = matchingPresets({ days, experience, equipment: 'gym' });
    if (!g.every((p) => presetEquipment(presetById(p.id)) === 'Full gym')) {
      ok(false, `gym, ${days} days, ${experience}: a no-gym preset was offered (${g.map((p) => p.id)})`);
    }
  }
}
ok(ids({ days: 3, experience: 'new', equipment: 'gym' }).join() === 'preset-full-body,preset-arnold-golden-six',
   'a full gym is offered what it was before (3 days, new: Full Body, Golden Six)');

/* ================= the generator, every answer set ================= */
const GOALS = ['muscle', 'strength', 'both', 'general'];
const EXPERIENCE = ['new', 'under1', '1to3', '3plus'];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75];
const EQUIPMENT = ['gym', 'dumbbells', 'barbell', 'bodyweight'];
const FOCUS = [[], ['chest'], ['back'], ['shoulders'], ['arms'], ['legs'], ['glutes'], ['core'],
  ['chest', 'arms'], ['legs', 'glutes']];
const MAJOR = ['Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders'];
const PULL_UPS = new Set(['Pull-Up', 'Chin-Up', 'Neutral-Grip Pull-Up', 'Wide-Grip Pull-Up']);

let inScope = 0;
const indirect = [], noArm = [], pullUps = [], notWeek = [], heavyDeadlift = [];
const keep = (list, x) => { if (list.length < 8) list.push(x); };
for (const goal of GOALS) for (const experience of EXPERIENCE) for (const days of DAYS)
for (const minutes of MINUTES) for (const equipment of EQUIPMENT) for (const focus of FOCUS) {
  const a = { goal, experience, days, minutes, equipment, focus };
  const p = buildProgram(a);
  const tag = JSON.stringify(a);
  if (!(p.plan && p.plan.kind === 'week' && p.plan.slots.length === 7)) keep(notWeek, tag);
  const exs = p.workouts.flatMap((w) => w.exercises);
  if (equipment === 'dumbbells' && exs.some((e) => PULL_UPS.has(e.name))) keep(pullUps, tag);
  if (exs.some((e) => e.name === 'Deadlift' && e.reps[1] > 8)) keep(heavyDeadlift, tag);
  if ((goal === 'muscle' || goal === 'both') && minutes >= 45) {
    inScope++;
    const found = lintProgramme(p.workouts, exMap)
      .filter((f) => f.code === 'NEEDS_DIRECT_WORK' && MAJOR.includes(f.muscle))
      // ⚠️ The one exemption: with no weights the library has no biceps
      // exercise at all (asserted above), so nothing could fix it.
      .filter((f) => !(equipment === 'bodyweight' && f.muscle === 'Biceps'));
    if (found.length) keep(indirect, `${tag}: ${found.map((f) => f.muscle)}`);
    if (equipment !== 'bodyweight') {
      for (const w of p.workouts) {
        if (/Lower|Legs/.test(w.name)) continue;
        const arm = w.exercises.some((e) => ['Biceps', 'Triceps'].includes(exMap.get(e.exerciseId).muscle));
        if (!arm) keep(noArm, `${tag}: ${w.name}`);
      }
    }
  }
}
ok(inScope === 4800, `walked ${inScope} build-muscle/both answer sets at 45 min or more`);
ok(indirect.length === 0,
   'O-5: none draws "worked only indirectly" for a major muscle from template-lint'
   + (indirect.length ? '\n      ' + indirect.join('\n      ') : ''));
ok(noArm.length === 0,
   'O-5: every upper or full-body day keeps a direct arm exercise' + (noArm.length ? '\n      ' + noArm.join('\n      ') : ''));
ok(pullUps.length === 0, 'O-6: no dumbbells-only programme has a pull-up, chin-up or any bar hang'
   + (pullUps.length ? '\n      ' + pullUps.join('\n      ') : ''));
ok(notWeek.length === 0, 'S-15: every programme\'s seven-box plan is a week' + (notWeek.length ? ' — ' + notWeek[0] : ''));
ok(heavyDeadlift.length === 0, 'O-8: the Deadlift is never prescribed above 8 reps'
   + (heavyDeadlift.length ? ' — ' + heavyDeadlift[0] : ''));

// Biceps and triceps take turns: a two-day plan gets one of each.
const two = buildProgram({ goal: 'muscle', experience: 'new', days: 2, minutes: 45, equipment: 'gym', focus: [] });
const armOf = (w) => w.exercises.map((e) => exMap.get(e.exerciseId).muscle).filter((m) => m === 'Biceps' || m === 'Triceps');
ok(armOf(two.workouts[0]).includes('Biceps') && armOf(two.workouts[1]).includes('Triceps'),
   `O-5: beginner 2 days at 45 min — A has a curl, B a triceps exercise (${two.workouts.map(armOf).join(' / ')})`);

// O-6: the pull day still pulls, and the pullover is the stand-in.
const dbPull = buildProgram({ goal: 'muscle', experience: '1to3', days: 6, minutes: 75, equipment: 'dumbbells', focus: [] });
const pullDay = dbPull.workouts.find((w) => w.name === 'Pull');
ok(pullDay && pullDay.exercises.some((e) => e.name === 'Dumbbell Pullover'),
   `O-6: a dumbbells pull day uses the Dumbbell Pullover for its vertical pull (${pullDay && pullDay.exercises.map((e) => e.name)})`);
const dbFull = buildProgram({ goal: 'muscle', experience: 'under1', days: 2, minutes: 30, equipment: 'dumbbells', focus: [] });
ok(dbFull.workouts.every((w) => w.exercises.some((e) => exMap.get(e.exerciseId).muscle === 'Back')),
   'O-6: and a dumbbells full-body day with no other pull gets a row, never a day without a back exercise');

/* ================= O-8: the easier start ================= */
const firstOf = (p, day) => p.workouts.find((w) => w.name === day).exercises.map((e) => e.name);
const g3 = (extra) => buildProgram({ goal: 'muscle', days: 3, minutes: 60, equipment: 'gym', focus: [], ...extra });
const newbie = g3({ experience: 'new' });
ok(firstOf(newbie, 'Full Body A')[0] === 'Goblet Squat', `a beginner squats with a goblet squat (${firstOf(newbie, 'Full Body A')[0]})`);
ok(firstOf(newbie, 'Full Body A').includes('Dumbbell Bench Press') && !firstOf(newbie, 'Full Body A').includes('Barbell Bench Press'),
   'and presses dumbbells, not a barbell');
ok(firstOf(newbie, 'Full Body C')[0] === 'Dumbbell Romanian Deadlift', `and hinges with dumbbells (${firstOf(newbie, 'Full Body C')[0]})`);
const older = g3({ experience: '3plus', age: 64 });
ok(firstOf(older, 'Full Body A')[0] === 'Goblet Squat' && firstOf(older, 'Full Body C')[0] === 'Dumbbell Romanian Deadlift',
   'someone 64 with years of lifting gets the same easier start');
const younger = g3({ experience: '3plus', age: 40 });
ok(firstOf(younger, 'Full Body A')[0] === 'Back Squat' && firstOf(younger, 'Full Body C')[0] === 'Deadlift',
   'someone 40 with years of lifting keeps the barbell lifts');
ok(JSON.stringify(g3({ experience: '3plus' })) === JSON.stringify(younger), 'no age given changes nothing');
ok(firstOf(g3({ experience: '3plus', age: 'abc' }), 'Full Body A')[0] === 'Back Squat', 'a nonsense age is ignored');
const bbNew = buildProgram({ goal: 'strength', experience: 'new', days: 3, minutes: 60, equipment: 'barbell', focus: [] });
ok(firstOf(bbNew, 'Full Body A')[0] === 'Back Squat', 'a barbell-only beginner still squats with the bar (no dumbbells to use)');
const dl = buildProgram({ goal: 'general', experience: '1to3', days: 4, minutes: 60, equipment: 'gym', focus: [] })
  .workouts.find((w) => w.name === 'Lower B').exercises[0];
ok(dl.name === 'Deadlift' && dl.reps[1] === 8, `general fitness: the deadlift tops out at 8 reps (${dl.reps})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
