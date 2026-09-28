// Lifting-history import, wave-4 fixes (2026-09-27):
//   1. a day already logged (same date + workout name) is SKIPPED by default,
//      and the preview says so — it used to be silently doubled;
//   2. Strong's bare "Distance" column is ASKED (miles or km), not dropped;
//   3. a spreadsheet "Sets" column repeats the row (3 × 5 = three sets), capped;
//   4. the preview's buttons sit inside the card (the phone gutter).
//
//   node tests/lift-import-fix.test.mjs
//   LIFT_BASE=<dir with js/> node tests/lift-import-fix.test.mjs   (old code)
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/import', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
const sess = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const BASE = process.env.LIFT_BASE
  ? pathToFileURL(process.env.LIFT_BASE.replace(/[\\/]?$/, '/') + 'js/').href
  : new URL('../js/', import.meta.url).href;
const lift = await import(BASE + 'lift-import.js');
const { BUILT_IN_EXERCISES: exercises } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');

/* ------------------------------------------------------------------ *
 * Fixtures: Strong classic's real header, ~1000 rows, with runs in it
 * ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const WORKOUTS = 140;
const dayOf = (i) => { const d = new Date(Date.UTC(2023, 0, 2) + i * 2 * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
function strongWithRuns() {
  const rows = ['Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'];
  for (let i = 0; i < WORKOUTS; i++) {
    const date = `${dayOf(i)} 18:${pad(i % 60)}:11`;
    const name = 'Evening Workout';
    for (let s = 1; s <= 3; s++) rows.push([date, q(name), '1h', q('Bench Press (Barbell)'), s, '60', 5, 0, 0, '""', '""', ''].join(','));
    for (let s = 1; s <= 3; s++) rows.push([date, q(name), '1h', q('Squat (Barbell)'), s, '80', 5, 0, 0, '""', '""', ''].join(','));
    rows.push([date, q(name), '1h', q('Running'), 1, 0, 0, 5, 1500, '""', '""', ''].join(','));
  }
  return rows.join('\n') + '\n';
}
const classicText = strongWithRuns();
const classic = lift.readLiftFile(classicText);
ok(classic.records.length >= 900, `fixture is real-sized (${classic.records.length} rows)`);

/* 2. Distance: asked, never dropped ---------------------------------- */
{
  const r = lift.readLifting(classic.records, classic.format, { exercises, weightUnit: 'lb' });
  ok(r.needsDistanceUnit === true, 'a bare "Distance" column with runs in it asks miles or km');
  const km = lift.readLifting(classic.records, classic.format, { exercises, weightUnit: 'lb', distanceUnit: 'km' });
  const run = km.sessions[0] && km.sessions[0].entries.find((e) => e.exerciseName === 'Running');
  ok(run && Math.abs(run.sets[0].distance - 3.11) < 0.01 && run.sets[0].time === 1500,
    `5 km + 1500 s → ${run && JSON.stringify(run.sets[0])} (3.11 mi, 1500 s)`);
  const mi = lift.readLifting(classic.records, classic.format, { exercises, weightUnit: 'lb', distanceUnit: 'mi' });
  const run2 = mi.sessions[0] && mi.sessions[0].entries.find((e) => e.exerciseName === 'Running');
  ok(run2 && run2.sets[0].distance === 5, '5 miles stays 5');
  // An all-zero Distance column (a lifts-only Strong export) asks nothing.
  const liftsOnly = lift.readLiftFile(classicText.split('\n').filter((l) => !/Running/.test(l)).join('\n'));
  const r0 = lift.readLifting(liftsOnly.records, liftsOnly.format, { exercises, weightUnit: 'lb' });
  ok(r0.needsDistanceUnit === false, 'an all-zero Distance column is not asked about');
}

/* 3. A "Sets" count repeats the row ---------------------------------- */
{
  const rows = ['date,exercise,sets,reps,weight,unit'];
  for (let i = 0; i < 300; i++) {
    rows.push(`${dayOf(i)},Barbell Row,3,5,135,lb`);
    rows.push(`${dayOf(i)},Back Squat,${i === 0 ? 50 : 4},8,185,lb`);
  }
  const f = lift.readLiftFile(rows.join('\n'));
  const r = lift.readLifting(f.records, f.format, { exercises });
  const newest = r.sessions[0].entries.find((e) => e.exerciseName === 'Barbell Row');
  ok(newest && newest.sets.length === 3 && newest.sets.every((s) => s.reps === 5 && s.weight === 135),
    `3 × 5 @ 135 is three sets (${newest && newest.sets.length})`);
  ok(newest && newest.sets[0] !== newest.sets[1], 'each repeated set is its own object');
  const oldest = r.sessions[r.sessions.length - 1].entries.find((e) => e.exerciseName === 'Back Squat');
  ok(oldest && oldest.sets.length === 20, `a "Sets" of 50 is capped at 20 (${oldest && oldest.sets.length})`);
  // Strong's "Set Order" still means the set's number, not a count.
  const s = lift.readLifting(classic.records, classic.format, { exercises, weightUnit: 'lb', distanceUnit: 'km' });
  const b = s.sessions[0].entries.find((e) => e.exerciseName === 'Barbell Bench Press');
  ok(b && b.sets.length === 3, `Strong's Set Order 1..3 is still three sets (${b && b.sets.length})`);
}

/* 1 + 4. The screen -------------------------------------------------- */
await store.clearAll();
// Two workouts already logged by hand, on days the file also has.
await store.saveSession({ date: dayOf(WORKOUTS - 1), workoutName: 'Evening Workout', isBenchmark: false,
  entries: [{ exerciseId: exercises[0].id, exerciseName: exercises[0].name, sets: [{ weight: 100, reps: 5 }] }] });
await store.saveSession({ date: dayOf(WORKOUTS - 3), workoutName: 'evening workout', isBenchmark: false,
  entries: [{ exerciseId: exercises[0].id, exerciseName: exercises[0].name, sets: [{ weight: 100, reps: 5 }] }] });

const { ImportView } = await import(BASE + 'views-import.js');
const screen = await ImportView();
document.getElementById('app').replaceChildren(screen);
await settle();
const input = screen.querySelector('input[type="file"]');
Object.defineProperty(input, 'files', { value: [{ name: 'strong.csv', size: classicText.length, text: async () => classicText }], configurable: true });
input.dispatchEvent(new window.Event('change'));
await settle(100);
const tap = async (label) => {
  const b = [...screen.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
  if (b) b.click();
  await settle(100);
  return b;
};
await tap('Pounds');
ok(/Miles or kilometres\?/.test(screen.textContent) && Boolean([...screen.querySelectorAll('button')].find((x) => x.textContent === 'Kilometres')),
  'the screen asks "Miles or kilometres?" after the weight unit');
const qBtn = [...screen.querySelectorAll('button')].find((x) => x.textContent === 'Choose a different file');
ok(qBtn && qBtn.closest('.card'), 'on the question screen, "Choose a different file" sits inside the card');
await tap('Kilometres');

const line = screen.querySelector('.lift-preview');
ok(line && /^140 workouts/.test(line.textContent), `the preview shows (${line && line.textContent})`);
const collide = screen.querySelector('.lift-collides');
ok(collide && collide.style.display !== 'none' && /^2 days already logged — skipped\./.test(collide.textContent.trim()),
  `collisions are said: "${collide && collide.textContent.trim()}"`);
ok(collide && collide.querySelector('.help-dot, [aria-label="Why skipped"], button[aria-label]'), 'with a ? beside it');
const importBtn = () => [...screen.querySelectorAll('button')].find((x) => /^Import \d+ workouts?$/.test(x.textContent));
ok(importBtn() && importBtn().textContent === 'Import 138 workouts', `collisions are skipped by default (${importBtn() && importBtn().textContent})`);
ok(importBtn() && importBtn().closest('.card') && importBtn().closest('.card') === line.closest('.card'),
  'the Import button sits in the summary card (the phone gutter)');
const again = [...screen.querySelectorAll('button')].find((x) => x.textContent === 'Choose a different file');
ok(again && again.closest('.card') === line.closest('.card'), '"Choose a different file" sits in the same card');

await tap('Add them anyway');
ok(importBtn() && importBtn().textContent === 'Import 140 workouts', `"Add them anyway" brings them in (${importBtn() && importBtn().textContent})`);
ok(/added too/.test(collide.textContent), 'and the line says so');
await tap('Skip them');
ok(importBtn() && importBtn().textContent === 'Import 138 workouts', 'and "Skip them" goes back');

importBtn().click();
await settle(150);
const saved = await store.getSessions();
ok(saved.length === 2 + 138, `the import wrote 138, keeping the 2 hand-logged ones (${saved.length} total)`);
const perDay = saved.filter((s) => s.date === dayOf(WORKOUTS - 1)).length;
ok(perDay === 1, `the day already logged is not doubled (${perDay} on ${dayOf(WORKOUTS - 1)})`);
const run = saved.find((s) => s.importedFrom && s.entries.some((e) => e.exerciseName === 'Running'));
const rs = run && run.entries.find((e) => e.exerciseName === 'Running').sets[0];
ok(rs && rs.distance > 3 && rs.time === 1500, `the saved run keeps its distance (${rs && JSON.stringify(rs)})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
