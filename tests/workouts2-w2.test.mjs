// Overhaul wave 2, builder WORKOUTS-2: "5+" rep specs in the workout editor
// and preset updates, the Empty workout row switched on, and the wording sweep
// on views-workouts.js. Same jsdom harness as workouts-overhaul.test.
//
//   node tests/workouts2-w2.test.mjs
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
for (const [prop, value] of [['clientWidth', 420], ['clientHeight', 320]]) {
  Object.defineProperty(window.HTMLElement.prototype, prop, { get: () => value, configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const sess = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const PU = await import(BASE + 'preset-updates.js');
const VWmod = await import(BASE + 'views-workouts.js');
// `setsByReps` is exported since wave 2; on older code it reads as "missing".
const VW = { ...VWmod, setsByReps: VWmod.setsByReps || (() => '(not exported)') };
const fs = await import('node:fs');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = () => new Promise((r) => setTimeout(r, 30));
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const closeSheets = () => document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-wrap').forEach((n) => n.remove());
const type = (input, v) => { input.value = v; input.dispatchEvent(new window.Event('input', { bubbles: true })); };

const squat = byName('Barbell Back Squat') || byName('Back Squat') || BUILT_IN_EXERCISES.find((e) => /Squat/.test(e.name));
const bench = byName('Barbell Bench Press');
ok(squat && bench, `fixture exercises exist (${squat && squat.name}, ${bench && bench.name})`);

/* ============ 1a. The editor keeps "5+" and shows it ============ */
{
  ok(VW.setsByReps({ sets: 3, reps: [{ lo: 5, hi: 5 }, { lo: 5, hi: 5 }, { lo: 5, hi: 5, plus: true }] }) === '5 / 5 / 5+',
     `setsByReps shows the "+" on the last set (${VW.setsByReps({ sets: 3, reps: [{ lo: 5, hi: 5 }, { lo: 5, hi: 5 }, { lo: 5, hi: 5, plus: true }] })})`);
  ok(VW.setsByReps({ sets: 3, reps: { lo: 5, hi: 5, plus: true } }) === '3 × 5+',
     `setsByReps groups an all-"5+" exercise as "3 × 5+" (${VW.setsByReps({ sets: 3, reps: { lo: 5, hi: 5, plus: true } })})`);
  ok(VW.setsByReps({ sets: 3, reps: [{ lo: 5, hi: 5 }, { lo: 5, hi: 5 }, { lo: 5, hi: 5 }] }) === '3 × 5',
     'setsByReps without plus is unchanged ("3 × 5")');
  ok(VW.setsByReps({ sets: 2, reps: [{ lo: 8, hi: 10 }, { lo: 8, hi: 10 }] }) === '2 × 8–10', 'setsByReps ranges unchanged');

  // The reps sheet: type "5+" into All sets, then "5" into set 1.
  const item = { exerciseId: squat.id, sets: 3 };
  let changes = 0;
  VW.openRepsSheet(item, squat, () => { changes++; });
  await settle();
  const inputs = [...document.querySelectorAll('input.rep-input')];
  ok(inputs.length === 4, `reps sheet has All sets + 3 set fields (${inputs.length})`);
  type(inputs[0], '5+');
  ok(Array.isArray(item.reps) && item.reps.length === 3 && item.reps.every((r) => r.lo === 5 && r.hi === 5 && r.plus === true),
     `"5+" in All sets saves {lo:5,hi:5,plus:true} on every set (${JSON.stringify(item.reps)})`);
  ok(inputs.slice(1).every((i) => i.value === '5+'), `the per-set fields show "5+" (${inputs.slice(1).map((i) => i.value)})`);
  type(inputs[1], '5');
  type(inputs[2], '5');
  ok(item.reps[0].plus !== true && item.reps[1].plus !== true && item.reps[2].plus === true,
     `per-set "5" clears plus on that set only (${JSON.stringify(item.reps)})`);
  ok(item.reps.every((r) => !Array.isArray(r)), 'stored shape stays a map per set, never a nested array');
  closeSheets();
  // Reopen: the field shows what was saved.
  VW.openRepsSheet(item, squat, () => {});
  await settle();
  const again = [...document.querySelectorAll('input.rep-input')];
  ok(again[3] && again[3].value === '5+', `reopened sheet shows "5+" on set 3 (${again[3] && again[3].value})`);
  ok(again[1] && again[1].value === '5', 'and "5" on set 1');
  closeSheets();

  // Save through the store: plus survives normalizeWorkout both ways.
  const sys = await store.saveSystem({ name: 'Wave Two' });
  const saved = await store.saveWorkout({ name: 'Five Plus', systemId: sys.id, exercises: [{ ...item }] });
  const back = await store.getWorkout(saved.id);
  const r = back && back.exercises[0].reps;
  ok(r && r[2] && r[2].plus === true && r[0].plus !== true,
     `saved workout keeps plus on set 3 only (${JSON.stringify(r)})`);
  ok(VW.setsByReps(back.exercises[0]) === '5 / 5 / 5+', 'and the saved row reads "5 / 5 / 5+"');
}

/* ============ 1b. Preset updates ignore plus ============ */
{
  const preset = (version, reps) => ({
    id: 'p-w2', name: 'W2 Preset', version,
    workouts: [{ key: 'a', name: 'Day A', exercises: [
      { name: squat.name, sets: 3, reps },
      { name: bench.name, sets: 3, reps: 8 },
    ] }],
  });
  const names = new Map([[squat.name, squat], [bench.name, bench]]);
  const stored = (lo, plusLast) => [{ lo, hi: lo }, { lo, hi: lo }, plusLast ? { lo, hi: lo, plus: true } : { lo, hi: lo }];
  const originSquat = { sets: 3, notes: '', reps: stored(5, false) };
  const originBench = { sets: 3, notes: '', reps: stored(8, false) };
  const mineW = (squatReps) => [{
    id: 'w-a', systemId: 's-w2', name: 'Day A', presetKey: 'a',
    exercises: [
      { exerciseId: squat.id, sets: 3, notes: '', reps: squatReps, origin: originSquat },
      { exerciseId: bench.id, sets: 3, notes: '', reps: stored(8, false), origin: originBench },
    ],
  }];
  const stamped = { id: 's-w2', presetId: 'p-w2', presetVersion: 1 };
  const unstamped = { id: 's-w2', presetId: 'p-w2' };

  // Same numbers, only "+" differs: nothing to report, stamped or not.
  const p2same = preset(2, 5);
  const planS = PU.presetUpdatePlan({ preset: p2same, system: stamped, workouts: mineW(stored(5, true)), byName: names });
  ok(planS === null, `stamped copy: "5/5/5+" vs preset "5" is not an update (${planS && JSON.stringify(planS.changes)})`);
  const unW = mineW(stored(5, true)).map((w) => ({ ...w, presetKey: undefined,
    exercises: w.exercises.map(({ origin, ...e }) => e) }));
  const planU = PU.presetUpdatePlan({ preset: p2same, system: unstamped, workouts: unW, byName: names });
  ok(planU === null, `unstamped copy: "5+" vs "5" is not a difference (${planU && JSON.stringify(planU.changes)})`);
  // The reverse: preset authors plus, the copy doesn't.
  const planR = PU.presetUpdatePlan({ preset: preset(2, { lo: 5, hi: 5, plus: true }), system: stamped,
    workouts: mineW(stored(5, false)), byName: names });
  ok(planR === null, 'preset "5+" vs copy "5" is not an update either');

  // A real change (5 → 3): the "+" the lifter added does not make it "edited",
  // and applying it keeps their "+" on set 3.
  const p2real = preset(2, 3);
  const plan = PU.presetUpdatePlan({ preset: p2real, system: stamped, workouts: mineW(stored(5, true)), byName: names });
  const rc = plan && plan.changes.find((c) => c.kind === 'reps');
  ok(rc && rc.status === 'ready', `a real rep change is 'ready' despite the lifter's "+" (${rc && rc.status})`);
  const applied = PU.applyPresetPlan({ plan, preset: p2real, workouts: mineW(stored(5, true)), byName: names });
  const newReps = applied.workouts[0] && applied.workouts[0].exercises[0].reps;
  ok(newReps && newReps.map((r) => r.lo).join() === '3,3,3', `applied target is 3/3/3 (${JSON.stringify(newReps)})`);
  ok(newReps && newReps[2].plus === true && newReps[0].plus !== true,
     `applying keeps the lifter's "+" on set 3 only (${JSON.stringify(newReps)})`);
  // After applying, the restamped copy reports nothing more.
  const after = PU.presetUpdatePlan({ preset: p2real, system: { ...stamped, presetVersion: 2 },
    workouts: applied.workouts, byName: names });
  ok(after === null, 'restamped copy reports nothing');
}

/* ============ 2. Empty workout row is on and targets the runner route ============ */
{
  ok(VW.EMPTY_WORKOUT === true, 'EMPTY_WORKOUT is on');
  ok(VW.EMPTY_WORKOUT_ROUTE === '#/session/new-empty', 'route is #/session/new-empty');
  const start = document.createElement('div');
  start.append(await VW.StartPickerView());
  document.getElementById('app').replaceChildren(start);
  await settle();
  const row = [...start.querySelectorAll('.row')].find((r) => /Empty workout/.test(r.textContent));
  ok(Boolean(row), 'Start picker shows an "Empty workout" row');
  location.hash = '#/home';
  if (row) row.click();
  await settle();
  ok(location.hash === '#/session/new-empty', `tapping it goes to #/session/new-empty (${location.hash})`);
  // app.js routes `#/<name>/<rest>` → SessionView(rest), so the runner gets 'new-empty'.
  const appSrc = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  ok(/case 'session':\s*return \(await session\(\)\)\.SessionView\(route\.param\)/.test(appSrc),
     'app.js hands the session route param to SessionView (so it receives "new-empty")');
  location.hash = '#/home';
}

/* ============ 3. Wording sweep ============ */
{
  const src = fs.readFileSync(new URL('../js/views-workouts.js', import.meta.url), 'utf8');
  for (const gone of [
    'which is the least that produces a measurable change: ',
    'This is your current program — it is what the Workouts tab and Record show.',
    'Percent of your best recorded set on this lift',
    'Set a target for every set',
    'How are these sets done?',
    'How is the weight counted?',
    'What do you want to track?',
    'Reps for each set',
    'Weight for each set',
    'Build my own instead',
    'Open the first one',
    'around ${preset.minutes} minutes a',
  ]) ok(!src.includes(gone), `wording: "${gone.slice(0, 40)}" is gone`);
  ok(src.includes("helpDot('4 sets a week is the least that produces a measurable change.'"),
     'the 4-sets caveat moved behind a ? (not deleted)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
