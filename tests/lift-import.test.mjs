// Lifting-history import (O-19, docs/import-plan.md, 2026-09-27).
//
//   node tests/lift-import.test.mjs        (needs jsdom, like render.test.mjs)
//
// Fixtures are generated here with the REAL header rows of each export
// (Strong classic, Strong 6.x with semicolons, Hevy kg and lbs, a spreadsheet),
// 1000+ rows each, deterministic. The demo half re-runs this file in a child
// process with LIFT_DEMO=1, because the store picks its backend once.
//
// LIFT_BASE=<dir with js/> points the test at another copy of the code — used
// to watch it fail against HEAD before the change.
import { JSDOM } from 'jsdom';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEMO = process.env.LIFT_DEMO === '1';
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
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
if (DEMO) sess.set('ftrack:v1:demo', '1');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const done = () => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };

const BASE = process.env.LIFT_BASE
  ? pathToFileURL(process.env.LIFT_BASE.replace(/[\\/]?$/, '/') + 'js/').href
  : new URL('../js/', import.meta.url).href;

let lift = null;
try { lift = await import(BASE + 'lift-import.js'); }
catch (e) { ok(false, `js/lift-import.js loads (${e.message.split('\n')[0]})`); done(); }
const imp = await import(BASE + 'import-file.js');
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');

/* ------------------------------------------------------------------ *
 * Fixtures — real headers, realistic sizes
 * ------------------------------------------------------------------ */
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pad = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

// ~155 workouts x 7 sets ≈ 1085 rows.
const LIFTS = [
  ['Bench Press (Barbell)', 60], ['Squat (Barbell)', 80], ['Deadlift (Barbell)', 100],
  ['Overhead Press (Barbell)', 40], ['Pull Up', 0], ['Bicep Curl (Dumbbell)', 12],
  ['Zercher Carry (Barbell)', 60],                 // not in the library → unmatched
];
function days(n, start = Date.UTC(2021, 0, 4)) {
  const out = [];
  let t = start;
  for (let i = 0; i < n; i++) { out.push(new Date(t)); t += (2 + Math.floor(rnd() * 2)) * 86400000; }
  return out;
}
const WORKOUTS = 155;
const DAYS = days(WORKOUTS);
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function strongClassic() {
  const rows = ['Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'];
  DAYS.forEach((d, i) => {
    const date = `${ymd(d)} 18:${pad(10 + (i % 40))}:11`;
    const name = i % 2 ? 'Evening Workout' : 'Push, heavy';   // a comma inside quotes
    for (const [ex, base] of LIFTS) {
      const w = base + Math.floor(i / 10) * 2.5;
      rows.push([date, q(name), '1h 2m', q(ex), 1, w.toFixed(1), 5, 0, 0, '""', '""', ''].join(','));
    }
  });
  return rows.join('\n') + '\n';
}

function strong6() {
  const rows = ['"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"'];
  DAYS.forEach((d, i) => {
    const date = `${ymd(d)} 07:05:00`;
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Squat (Barbell)'), q('W'), '40', 8, '', '', '', '', ''].join(';'));
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Squat (Barbell)'), q('1'), '62,5', 5, '8', '', '', '', ''].join(';'));
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Squat (Barbell)'), q('2'), '62,5', 5, '8', '', '', '', ''].join(';'));
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Rest Timer'), q('Rest Timer'), '', '', '', '', '90', '', ''].join(';'));
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Bench Press (Barbell)'), q('1'), '50', 8, '', '', '', '', ''].join(';'));
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Plank'), q('1'), '', '', '', '', '60', '', ''].join(';'));
    rows.push([i + 1, q(date), q('Morning'), 3600, q('Running'), q('1'), '', '', '', '5000', '1500', '', ''].join(';'));
  });
  return rows.join('\r\n');
}

function hevy(unitCol = 'weight_kg') {
  const rows = [`"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","${unitCol}","reps","distance_km","duration_seconds","rpe"`];
  DAYS.forEach((d, i) => {
    const st = `${pad(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, 09:${pad(i % 60)}`;
    const t = 'Upper A';
    const add = (ex, idx, type, w, reps) => rows.push([q(t), q(st), q(st), q(''), q(ex), '', q(''), idx, q(type), w, reps, '', '', ''].join(','));
    add('Bench Press (Barbell)', 0, 'warmup', 40, 10);
    add('Bench Press (Barbell)', 1, 'normal', 80, 6);
    add('Bench Press (Barbell)', 2, 'failure', 80, 5);
    add('Lat Pulldown (Cable)', 0, 'normal', 55, 10);
    add('Lat Pulldown (Cable)', 1, 'dropset', 40, 8);
    add('Pull Up (Assisted)', 0, 'normal', 20, 8);
    add('Cable Kickback', 0, 'normal', 10, 12);   // two library rows → unmatched
  });
  return rows.join('\n');
}

function generic(dates) {
  const rows = ['date,exercise,weight,reps,set,unit,rpe'];
  dates.forEach((dt, i) => {
    rows.push(`${dt},Barbell Row,${135 + i},8,1,lb,8`);
    rows.push(`${dt},Barbell Row,${60 + i},8,2,kg,8`);
  });
  return rows.join('\n');
}

const exercises = BUILT_IN_EXERCISES;
const text = { classic: strongClassic(), s6: strong6(), hevyKg: hevy('weight_kg'), hevyLb: hevy('weight_lbs') };
const rowsIn = (t) => t.trim().split(/\r?\n/).length - 1;
ok(rowsIn(text.classic) >= 1000 && rowsIn(text.s6) >= 1000 && rowsIn(text.hevyKg) >= 1000,
  `fixtures are real-sized (${rowsIn(text.classic)}, ${rowsIn(text.s6)}, ${rowsIn(text.hevyKg)} rows)`);

/* ------------------------------------------------------------------ *
 * Recognising the files
 * ------------------------------------------------------------------ */
const files = Object.fromEntries(Object.entries(text).map(([k, t]) => [k, lift.readLiftFile(t)]));
ok(files.classic.format && files.classic.format.kind === 'strong', 'Strong classic is recognised');
ok(files.s6.format && files.s6.format.kind === 'strong' && files.s6.delimiter === ';', 'Strong 6 is recognised, semicolons and all');
ok(files.hevyKg.format && files.hevyKg.format.kind === 'hevy', 'Hevy is recognised');
ok(files.classic.format.weightUnit === null, 'a bare "Weight" header states no unit');
ok(files.s6.format.weightUnit === 'kg' && files.hevyKg.format.weightUnit === 'kg' && files.hevyLb.format.weightUnit === 'lb',
  'kg / lb read from "Weight (kg)", weight_kg, weight_lbs');
const strava = lift.readLiftFile('Activity ID,Activity Date,Activity Name,Activity Type,Distance\n1,"Aug 26, 2026, 10:17:33 AM",Run,Run,5.02\n');
ok(!strava.format, 'a Strava activities file is NOT lifting (it keeps the old path)');
ok(files.classic.records.length === rowsIn(text.classic), 'the quoted "Push, heavy" did not split a row');

/* ------------------------------------------------------------------ *
 * Units — asked, never guessed
 * ------------------------------------------------------------------ */
{
  const r = lift.readLifting(files.classic.records, files.classic.format, { exercises });
  ok(r.needsWeightUnit === true, 'Strong classic with a bare Weight asks for the unit');
  const kg = lift.readLifting(files.classic.records, files.classic.format, { exercises, weightUnit: 'kg' });
  const bench = kg.sessions.flatMap((s) => s.entries).find((e) => e.exerciseName === 'Barbell Bench Press');
  const first = kg.sessions[kg.sessions.length - 1].entries.find((e) => e.exerciseName === 'Barbell Bench Press');
  ok(bench && Math.abs(first.sets[0].weight - 60 * imp.LB_PER_KG) < 0.01,
    `60 kg is stored as ${first && first.sets[0].weight} lb`);
  const lb = lift.readLifting(files.classic.records, files.classic.format, { exercises, weightUnit: 'lb' });
  const firstLb = lb.sessions[lb.sessions.length - 1].entries.find((e) => e.exerciseName === 'Barbell Bench Press');
  ok(firstLb.sets[0].weight === 60, 'and 60 lb stays 60');
  ok(kg.workouts === WORKOUTS, `one workout per date + time + name (${kg.workouts} of ${WORKOUTS})`);
  ok(kg.unmatched.length === 1 && kg.unmatched[0].name === 'Zercher Carry (Barbell)' && kg.unmatched[0].sets === WORKOUTS,
    `the unknown lift is listed unmatched with its set count (${JSON.stringify(kg.unmatched)})`);
  ok(kg.exercises === 6, `six exercises matched (${kg.exercises})`);
  ok(/^155 workouts, 6 exercises, 1 unmatched$/.test(lift.previewLine(kg)), `the preview line: "${lift.previewLine(kg)}"`);
  const pull = kg.sessions[kg.sessions.length - 1].entries.find((e) => e.exerciseName === 'Pull-Up');
  ok(pull && pull.sets[0].weight === 0 && pull.sets[0].reps === 5, 'a body-weight Pull Up at 0 comes in as 0 added');
  ok(kg.sessions.every((s) => !s.workoutId && s.isBenchmark === false && s.importedFrom), 'rows look like quick-log sessions, marked importedFrom');
  ok(kg.sessions[0].date > kg.sessions[kg.sessions.length - 1].date, 'newest first');
}

/* ------------------------------------------------------------------ *
 * Strong 6: decimal commas, warm-ups, rest timers, time and distance
 * ------------------------------------------------------------------ */
{
  const r = lift.readLifting(files.s6.records, files.s6.format, { exercises, delimiter: ';' });
  ok(!r.needsWeightUnit, 'no unit question when the header says kg');
  const sq = r.sessions[0].entries.find((e) => e.exerciseName === 'Back Squat');
  ok(sq && sq.sets.length === 2 && Math.abs(sq.sets[0].weight - 62.5 * imp.LB_PER_KG) < 0.01,
    `"62,5" in a semicolon file is 62.5 kg (${sq && sq.sets[0].weight} lb), two working sets`);
  ok(sq && sq.warmups && sq.warmups.length === 1, 'Set Order "W" goes to warm-ups, never rated');
  ok(r.problems.skipped === WORKOUTS, `every "Rest Timer" row is skipped (${r.problems.skipped})`);
  const plank = r.sessions[0].entries.find((e) => e.exerciseName === 'Plank');
  ok(plank && plank.sets[0].time === 60, 'a timed Plank keeps its 60 s');
  const run = r.sessions[0].entries.find((e) => e.exerciseName === 'Running');
  ok(run && Math.abs(run.sets[0].distance - 3.11) < 0.01 && run.sets[0].time === 1500, 'a 5000 m run is 3.11 mi, 25 min');
}

/* ------------------------------------------------------------------ *
 * Hevy: named-month dates, set types, assisted
 * ------------------------------------------------------------------ */
{
  const r = lift.readLifting(files.hevyKg.records, files.hevyKg.format, { exercises });
  ok(r.workouts === WORKOUTS, `Hevy workouts counted (${r.workouts})`);
  ok(r.sessions[r.sessions.length - 1].date === ymd(DAYS[0]), `"04 Jan 2021, 09:00" reads as ${ymd(DAYS[0])}`);
  const b = r.sessions[0].entries.find((e) => e.exerciseName === 'Barbell Bench Press');
  ok(b.warmups.length === 1 && b.sets.length === 2, 'warmup → warm-ups; normal and failure → sets');
  const lat = r.sessions[0].entries.find((e) => e.exerciseName === 'Lat Pulldown');
  ok(lat.sets.length === 1 && lat.sets[0].minis && lat.sets[0].minis.length === 1, 'a dropset rides on the set before it (D23)');
  ok(r.sessions[0].entries.some((e) => e.exerciseName === 'Assisted Pull-Up'), '"Pull Up (Assisted)" → Assisted Pull-Up');
  ok(r.unmatched.some((u) => u.name === 'Cable Kickback'), 'an ambiguous name (two library rows) is unmatched, not guessed');
  const lb = lift.readLifting(files.hevyLb.records, files.hevyLb.format, { exercises });
  ok(lb.sessions[0].entries[0].sets[0].weight === 80, 'weight_lbs stays pounds');

  // A pick for an unmatched name brings its sets in.
  const glute = BUILT_IN_EXERCISES.find((e) => e.name === 'Cable Kickback' && e.muscle === 'Glutes');
  const picked = lift.readLifting(files.hevyKg.records, files.hevyKg.format, { exercises, picks: { 'Cable Kickback': glute.id } });
  ok(!picked.unmatched.length && picked.sessions[0].entries.some((e) => e.exerciseId === glute.id), 'a pick-list choice brings the name in');
  const skipped = lift.readLifting(files.hevyKg.records, files.hevyKg.format, { exercises, picks: { 'Cable Kickback': '' } });
  ok(!skipped.sessions[0].entries.some((e) => e.exerciseName === 'Cable Kickback'), 'Skip leaves it out');
}

/* ------------------------------------------------------------------ *
 * Odd dates
 * ------------------------------------------------------------------ */
{
  const dmy = lift.readLiftFile(generic(['13/05/2024', '02/06/2024', '2024/06/09']));
  ok(lift.liftDateOrder(dmy.records, dmy.format) === 'dmy', '13/05/2024 settles the column as day/month');
  const r = lift.readLifting(dmy.records, dmy.format, { exercises, dateOrder: 'dmy' });
  ok(r.sessions.map((s) => s.date).join(' ') === '2024-06-09 2024-06-02 2024-05-13', `slash and yyyy/mm/dd dates read right (${r.sessions.map((s) => s.date)})`);
  const row = r.sessions[0].entries[0].sets;
  ok(row[0].weight === 137 && Math.abs(row[1].weight - 62 * imp.LB_PER_KG) < 0.01, 'a per-row unit column wins: lb stays, kg converts');
  ok(!r.needsWeightUnit, 'a unit column answers the unit question');
  const amb = lift.readLiftFile(generic(['03/04/2024', '05/06/2024']));
  ok(lift.liftDateOrder(amb.records, amb.format) === 'ambiguous', '03/04/2024 alone is asked, not guessed');
}

/* ------------------------------------------------------------------ *
 * Common names → library
 * ------------------------------------------------------------------ */
{
  const m = lift.makeMatcher(exercises);
  const want = {
    'Bench Press (Barbell)': 'Barbell Bench Press', 'Squat (Barbell)': 'Back Squat', 'Pull Up': 'Pull-Up',
    'Incline Bench Press (Dumbbell)': 'Incline Dumbbell Bench Press', 'Lat Pulldown - Wide Grip (Cable)': 'Wide-Grip Lat Pulldown',
    'Seated Row (Cable)': 'Seated Cable Row', 'Romanian Deadlift (Dumbbell)': 'Dumbbell Romanian Deadlift',
    'Deadlift (Trap bar)': 'Trap Bar Deadlift', 'Skullcrusher (Barbell)': 'Skull Crusher', 'Squat (Smith Machine)': 'Smith Machine Squat',
    'Chest Dip (Weighted)': 'Chest Dip', 'Hip Thrust (Machine)': 'Machine Hip Thrust', 'Barbell Row': 'Barbell Row',
  };
  const miss = Object.entries(want).filter(([k, v]) => (m(k) || {}).name !== v);
  ok(!miss.length, `Strong/Hevy names match (${miss.map(([k]) => `${k}→${(m(k) || {}).name}`).join(', ') || 'all'})`);
  const custom = { id: 'custom-sled-x', name: 'Prowler Sprint', fields: ['weight', 'reps'], equipment: 'Other', isCustom: true };
  ok(lift.makeMatcher([...exercises, custom])('Prowler Sprint') === custom, 'the person\'s own custom exercises match too');
}

/* ------------------------------------------------------------------ *
 * Speed and size
 * ------------------------------------------------------------------ */
{
  const big = strongClassic().repeat(1);
  const t0 = Date.now();
  const f = lift.readLiftFile(big);
  lift.readLifting(f.records, f.format, { exercises, weightUnit: 'kg' });
  const ms = Date.now() - t0;
  ok(ms < 1500, `a 1085-row file parses and reads in ${ms} ms`);
  const r = lift.readLifting(f.records, f.format, { exercises, weightUnit: 'kg' });
  const bytes = JSON.stringify(r.sessions).length / r.sessions.length;
  ok(bytes < 2000, `an imported workout is ~${Math.round(bytes)} bytes (Firestore shard: one doc each)`);
  ok(lift.MAX_WORKOUTS === 5000 && lift.MAX_FILE_BYTES === 20 * 1024 * 1024, 'limits: 5000 workouts, 20 MB');
}

/* ------------------------------------------------------------------ *
 * Duplicates — re-importing adds nothing
 * ------------------------------------------------------------------ */
{
  const a = lift.readLifting(files.hevyKg.records, files.hevyKg.format, { exercises, sourceName: 'workouts' });
  const b = lift.readLifting(files.hevyKg.records, files.hevyKg.format, { exercises, sourceName: 'workouts (1)' });
  ok(a.sessions.map((s) => s.id).join() === b.sessions.map((s) => s.id).join(), 'ids do not depend on the file name');
  ok(new Set(a.sessions.map((s) => s.id)).size === a.sessions.length, 'and no two workouts share one');
  const plan = imp.planImport(b.sessions, a.sessions, (r) => r.date);
  ok(plan.fresh.length === 0 && plan.repeat === a.sessions.length, 'planned against itself: 0 new');
}

/* ------------------------------------------------------------------ *
 * Through the store, and the screen
 * ------------------------------------------------------------------ */
const lsHas = (needle) => [...mem.values()].some((v) => String(v).includes(needle));

if (!DEMO) {
  await store.clearAll();
  const { ImportView } = await import(BASE + 'views-import.js');
  location.hash = '#/import'; await settle();
  const screen = await ImportView();
  document.getElementById('app').replaceChildren(screen);
  await settle();
  ok(/Strong/.test(screen.textContent) && /Hevy/.test(screen.textContent), 'the import screen names Strong and Hevy');
  const input = screen.querySelector('input[type="file"]');
  const pick = async (name, body) => {
    Object.defineProperty(input, 'files', { value: [{ name, size: body.length, text: async () => body }], configurable: true });
    input.dispatchEvent(new window.Event('change'));
    await settle(80);
  };
  await pick('workouts.csv', text.hevyKg);
  const line = screen.querySelector('.lift-preview');
  ok(line && line.textContent === '155 workouts, 3 exercises, 1 unmatched', `the preview line reads "${line && line.textContent}"`);
  const btn = [...screen.querySelectorAll('button')].find((x) => /^Import \d+ workouts$/.test(x.textContent));
  ok(btn && btn.textContent === 'Import 155 workouts', `one Import button (${btn && btn.textContent})`);
  const sel = screen.querySelector('select[aria-label="Match for Cable Kickback"]');
  ok(sel && sel.value === '', 'the unmatched name has a pick-list on Skip');
  const glute = BUILT_IN_EXERCISES.find((e) => e.name === 'Cable Kickback' && e.muscle === 'Glutes');
  sel.value = glute.id; sel.dispatchEvent(new window.Event('change'));
  ok(line.textContent === '155 workouts, 4 exercises', `a pick updates the line in place (${line.textContent})`);
  btn.click(); await settle(120);
  const saved = await store.getSessions();
  ok(saved.length === WORKOUTS, `Import wrote ${saved.length} workouts`);
  ok(saved.some((s) => s.entries.some((e) => e.exerciseId === glute.id)), 'including the picked exercise');
  ok(lsHas('imp_lift'), 'off the demo they ARE stored (the control for the demo check)');

  // Same file again: nothing new.
  const again = await ImportView();
  document.getElementById('app').replaceChildren(again);
  await settle();
  const input2 = again.querySelector('input[type="file"]');
  Object.defineProperty(input2, 'files', { value: [{ name: 'workouts.csv', size: 1, text: async () => text.hevyKg }], configurable: true });
  input2.dispatchEvent(new window.Event('change'));
  await settle(80);
  const btn2 = [...again.querySelectorAll('button')].find((x) => /^Import \d+/.test(x.textContent));
  ok(!btn2 || btn2.style.display === 'none', 're-importing the same file offers nothing to import');
  ok(/Nothing new/.test(again.textContent) && /155 already imported/.test(again.textContent), 'and says so');
  ok((await store.getSessions()).length === WORKOUTS, 'the count is unchanged');

  // The strength map no longer starts from zero.
  const { muscleStrength } = await import(BASE + 'store.js');
  await store.logBodyWeight(180);
  await store.saveProfile({ gender: 'male', birthYear: 1995 });
  const ms = await muscleStrength();
  const chest = ms.muscles && (ms.muscles.get ? ms.muscles.get('Chest') : ms.muscles.Chest);
  ok(Boolean(chest), 'the imported bench press rates Chest on the strength map');

  // The intro's link.
  const onboarding = await import(BASE + 'onboarding.js');
  onboarding.openOnboarding({});
  await settle();
  const link = document.querySelector('.ob-start a[href="#/import"]');
  ok(link && link.textContent === 'Bring my history', 'the start screen has a "Bring my history" link to the import');

  // The demo half, in its own process (the store picks its backend once).
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, LIFT_DEMO: '1' }, encoding: 'utf8',
  });
  const out = (child.stdout || '') + (child.stderr || '');
  for (const l of out.split('\n').filter((x) => /^(PASS|FAIL) {2}\[demo\]/.test(x))) ok(l.startsWith('PASS'), l.replace(/^(PASS|FAIL) {2}/, ''));
  ok(child.status === 0 && /\[demo\]/.test(out), `the demo run finished clean (exit ${child.status})`);
  done();
} else {
  const before = (await store.getSessions()).length;
  ok(before > 50, `[demo] the demo year is loaded (${before} sessions)`);
  const r = lift.readLifting(files.hevyKg.records, files.hevyKg.format, { exercises });
  const keys = [...mem.keys()].join();
  await store.importRows('sessions', r.sessions);
  const after = (await store.getSessions()).length;
  ok(after === before + WORKOUTS, `[demo] the import shows while the demo is open (${after})`);
  ok(!lsHas('imp_lift'), '[demo] nothing imported reaches localStorage');
  ok([...mem.keys()].join() === keys, '[demo] no new storage keys were written');
  done();
}
