// The first-run questions (docs/onboarding-plan.md part A, 2026-09-25).
//
//   node tests/onboarding.test.mjs      (needs jsdom, like render.test.mjs)
//
// Three things are pinned here:
//   1. buildProgram() — every answer combination yields a real, runnable
//      programme made only of exercises in js/exercises.js that the person's
//      equipment allows.
//   2. shouldOnboard() — the first-run gate. Brand-new cloud account only;
//      never the demo, never anyone with data, never twice.
//   3. openOnboarding() — the flow itself, driven by clicks in a DOM, ending in
//      a saved programme that is the current one.
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

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { PRESET_SYSTEMS } = await import(BASE + 'preset-systems.js');

let builder = null;
try { builder = await import(BASE + 'program-builder.js'); }
catch (e) { ok(false, `js/program-builder.js loads (${e.message})`); }
let onboarding = null;
try { onboarding = await import(BASE + 'onboarding.js'); }
catch (e) { ok(false, `js/onboarding.js loads (${e.message})`); }

if (!builder || !onboarding) {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

const { buildProgram, matchingPresets, EQUIPMENT_ALLOWED } = builder;
const byId = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

/* ================= 1. the generator ================= */
const GOALS = ['muscle', 'strength', 'both', 'general'];
const EXPERIENCE = ['new', 'under1', '1to3', '3plus'];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75];
const EQUIPMENT = ['gym', 'dumbbells', 'barbell', 'bodyweight'];
const FOCUS = [[], ['chest'], ['back'], ['shoulders'], ['arms'], ['legs'], ['glutes'], ['core'],
  ['chest', 'arms'], ['legs', 'glutes']];

const problems = [];
const note = (answers, msg) => { if (problems.length < 25) problems.push(`${JSON.stringify(answers)}: ${msg}`); };
let combos = 0;
for (const goal of GOALS) for (const experience of EXPERIENCE) for (const days of DAYS)
for (const minutes of MINUTES) for (const equipment of EQUIPMENT) for (const focus of FOCUS) {
  const answers = { goal, experience, days, minutes, equipment, focus };
  combos++;
  let p;
  try { p = buildProgram(answers); } catch (e) { note(answers, 'threw ' + e.message); continue; }
  if (!p || !Array.isArray(p.workouts) || !p.workouts.length) { note(answers, 'no workouts'); continue; }
  if (!p.name || !/^Your \d-day /.test(p.name)) note(answers, `name "${p.name}"`);
  if (p.daysPerWeek !== days) note(answers, `daysPerWeek ${p.daysPerWeek}`);
  const allowed = EQUIPMENT_ALLOWED[equipment];
  for (const w of p.workouts) {
    if (!w.name) note(answers, 'unnamed workout');
    if (!w.exercises || !w.exercises.length) { note(answers, `${w.name} is empty`); continue; }
    const cap = experience === 'new' ? 5 : 8;
    if (w.exercises.length > cap) note(answers, `${w.name} has ${w.exercises.length} exercises`);
    if (w.exercises.length < 3) note(answers, `${w.name} has only ${w.exercises.length} exercises`);
    const ids = w.exercises.map((e) => e.exerciseId);
    if (new Set(ids).size !== ids.length) note(answers, `${w.name} repeats an exercise`);
    let total = 0;
    for (const e of w.exercises) {
      const lib = byId.get(e.exerciseId);
      if (!lib) { note(answers, `${e.exerciseId} is not in the exercise list`); continue; }
      if (lib.name !== e.name) note(answers, `${e.exerciseId} named "${e.name}"`);
      if (!allowed.includes(lib.equipment)) note(answers, `${lib.name} needs ${lib.equipment}`);
      if (!lib.fields.includes('reps')) note(answers, `${lib.name} is not a reps exercise`);
      if (!(Number.isInteger(e.sets) && e.sets >= 1 && e.sets <= 5)) note(answers, `${lib.name} sets ${e.sets}`);
      if (experience === 'new' && e.sets > 3) note(answers, `beginner gets ${e.sets} sets of ${lib.name}`);
      if (!Array.isArray(e.reps) || e.reps.length !== 2 || !(e.reps[0] >= 1 && e.reps[0] <= e.reps[1] && e.reps[1] <= 20)) {
        note(answers, `${lib.name} reps ${JSON.stringify(e.reps)}`);
      }
      total += e.sets;
    }
    if (/^Full Body/.test(w.name)) {
      const ms = w.exercises.map((e) => (byId.get(e.exerciseId) || {}).muscle);
      const has = (list) => ms.some((m) => list.includes(m));
      if (!has(['Back']) || !has(['Chest', 'Shoulders']) || !has(['Quads', 'Hamstrings', 'Glutes'])) {
        note(answers, `${w.name} lacks a leg, push or pull (${ms})`);
      }
    }
    // About 2.5 minutes a set including rest, with a little slack.
    if (total * 2.5 > minutes + 12) note(answers, `${w.name}: ${total} sets will not fit ${minutes} min`);
  }
}
ok(problems.length === 0,
   `every one of ${combos} answer sets builds a valid programme from the real exercise list`
   + (problems.length ? `\n      ${problems.join('\n      ')}` : ''));

const split = (days) => buildProgram({ goal: 'muscle', experience: '1to3', days, minutes: 60, equipment: 'gym', focus: [] })
  .workouts.map((w) => w.name);
ok(JSON.stringify(split(2)) === '["Full Body A","Full Body B"]', `2 days = full body A/B (${split(2)})`);
ok(JSON.stringify(split(3)) === '["Full Body A","Full Body B","Full Body C"]', `3 days = full body A/B/C (${split(3)})`);
ok(JSON.stringify(split(4)) === '["Upper A","Lower A","Upper B","Lower B"]', `4 days = upper/lower (${split(4)})`);
ok(JSON.stringify(split(5)) === '["Upper","Lower","Push","Pull","Legs"]', `5 days = upper/lower + push/pull/legs (${split(5)})`);
ok(JSON.stringify(split(6)) === '["Push","Pull","Legs"]', `6 days = push/pull/legs, run twice (${split(6)})`);
ok(buildProgram({ goal: 'muscle', experience: '1to3', days: 4, minutes: 60, equipment: 'gym', focus: [] }).name
   === 'Your 4-day Upper/Lower', 'the name says the days and the split');

const exNames = (p) => p.workouts.flatMap((w) => w.exercises.map((e) => byId.get(e.exerciseId)));
for (const days of DAYS) {
  const bw = exNames(buildProgram({ goal: 'muscle', experience: 'under1', days, minutes: 60, equipment: 'bodyweight', focus: [] }));
  ok(bw.every((e) => e.equipment === 'Bodyweight'), `${days} days, bodyweight only: no barbell, dumbbell, cable or machine`);
  const db = exNames(buildProgram({ goal: 'muscle', experience: 'under1', days, minutes: 60, equipment: 'dumbbells', focus: [] }));
  ok(db.every((e) => ['Dumbbell', 'Bodyweight'].includes(e.equipment)) && db.some((e) => e.equipment === 'Dumbbell'),
     `${days} days, dumbbells only: dumbbells (and body weight), nothing else`);
  const bb = exNames(buildProgram({ goal: 'strength', experience: '1to3', days, minutes: 60, equipment: 'barbell', focus: [] }));
  ok(!bb.some((e) => ['Cable', 'Machine'].includes(e.equipment)) && bb.some((e) => e.equipment === 'Barbell'),
     `${days} days, barbell at home: barbell work, no cables or machines`);
}

// Reps follow the goal.
const repsOf = (goal) => buildProgram({ goal, experience: '1to3', days: 4, minutes: 60, equipment: 'gym', focus: [] })
  .workouts.map((w) => w.exercises.map((e) => e.reps));
// 🔄 2026-09-27 (O-8): the deadlift is never prescribed above 8 reps, so it is
// the one lift a muscle program does not give 8–12.
const muscleEx = buildProgram({ goal: 'muscle', experience: '1to3', days: 4, minutes: 60, equipment: 'gym', focus: [] })
  .workouts.flatMap((w) => w.exercises);
ok(muscleEx.every((e) => (e.exerciseId === 'deadlift' || /^Deadlift$/.test(e.name)
  ? e.reps[1] <= 8 : e.reps[0] === 8 && e.reps[1] === 12)),
   `build muscle: 8–12 reps throughout, the deadlift capped at 8 (${muscleEx.filter((e) => e.reps[1] !== 12).map((e) => `${e.name} ${e.reps}`)})`);
const strength = repsOf('strength');
ok(strength.every((day) => day[0][0] === 3 && day[0][1] === 6), 'get stronger: each day opens on a 3–6 main lift');
ok(strength.every((day) => day.slice(2).every(([lo, hi]) => lo === 6 && hi === 10)), 'get stronger: 6–10 after the main lifts');
const both = repsOf('both');
ok(both.every((day) => day[0][1] <= 8) && both.some((day) => day.some(([, hi]) => hi >= 12)),
   'both: heavier main lifts, higher-rep accessories');

// Sets scale with time and experience.
const totalSets = (a) => buildProgram(a).workouts.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets, 0), 0);
const baseA = { goal: 'muscle', days: 3, equipment: 'gym', focus: [] };
ok(totalSets({ ...baseA, experience: '1to3', minutes: 30 }) < totalSets({ ...baseA, experience: '1to3', minutes: 75 }),
   'more time → more sets');
ok(totalSets({ ...baseA, experience: 'new', minutes: 60 }) < totalSets({ ...baseA, experience: '3plus', minutes: 60 }),
   'more experience → more sets');
const beginner = buildProgram({ ...baseA, experience: 'new', minutes: 45 });
ok(beginner.workouts.every((w) => w.exercises.length >= 4 && w.exercises.length <= 5
   && w.exercises.every((e) => e.sets >= 2 && e.sets <= 3)),
   `a beginner at 45 min gets 4–5 exercises of 2–3 sets (${beginner.workouts.map((w) => w.exercises.length + 'x').join(' ')})`);

// Focus muscles get a set more.
const plain = buildProgram({ goal: 'muscle', experience: 'under1', days: 4, minutes: 60, equipment: 'gym', focus: [] });
const chest = buildProgram({ goal: 'muscle', experience: 'under1', days: 4, minutes: 60, equipment: 'gym', focus: ['chest'] });
const chestSets = (p) => p.workouts.flatMap((w) => w.exercises)
  .filter((e) => byId.get(e.exerciseId).muscle === 'Chest').map((e) => e.sets);
ok(chestSets(chest).length > 0 && chestSets(chest).every((s, i) => s >= (chestSets(plain)[i] || 0))
   && chestSets(chest).reduce((a, b) => a + b, 0) > chestSets(plain).reduce((a, b) => a + b, 0),
   `focus on chest adds a set to chest work (${chestSets(plain)} → ${chestSets(chest)})`);
const glutes = buildProgram({ goal: 'muscle', experience: 'under1', days: 2, minutes: 30, equipment: 'gym', focus: ['glutes'] });
ok(glutes.workouts.some((w) => w.exercises.some((e) => byId.get(e.exerciseId).muscle === 'Glutes')),
   'focus on glutes puts glute work in even a short programme');

// Matching ready-made programmes.
const m3 = matchingPresets({ days: 3, experience: 'new', equipment: 'gym' });
ok(m3.length >= 1 && m3.length <= 2 && m3.every((p) => PRESET_SYSTEMS.some((x) => x.id === p.id)),
   `1–2 real presets offered (${m3.map((p) => p.name).join(', ')})`);
ok(m3[0] && PRESET_SYSTEMS.find((x) => x.id === m3[0].id).daysPerWeek === 3, 'the first one trains the same days a week');
// 🔄 2026-09-27 (S-15): a bodyweight ready-made program now exists, and it is
// the only kind a bodyweight answer may be offered.
{
  const bwOffers = matchingPresets({ days: 4, experience: '1to3', equipment: 'bodyweight' });
  const bwOnly = (p) => PRESET_SYSTEMS.find((x) => x.id === p.id).workouts
    .every((w) => w.exercises.every((e) => (BUILT_IN_EXERCISES.find((x) => x.name === e.name) || {}).equipment === 'Bodyweight'));
  ok(bwOffers.every(bwOnly), `bodyweight only: never offered a program that needs a gym (${bwOffers.map((p) => p.name)})`);
}

/* ================= 2. the gate ================= */
const { shouldOnboard, ONBOARDED_KEY } = onboarding;
ok(ONBOARDED_KEY === 'ftrack:v1:onboarded', 'the flag lives at ftrack:v1:onboarded');
const fresh = () => ({
  demoActive: () => false,
  authState: async () => ({ mode: 'cloud', degraded: false }),
  getSettings: async () => ({}),
  getSessions: async () => [],
  getSystems: async () => [],
  getWorkouts: async () => [],
  hash: '#/home',
});
mem.delete('ftrack:v1:onboarded');
ok(await shouldOnboard(fresh()) === true, 'a brand-new cloud account on Home sees the questions');
ok(await shouldOnboard({ ...fresh(), demoActive: () => true }) === false, 'never in the demo');
ok(await shouldOnboard({ ...fresh(), getSessions: async () => [{ id: 's1', date: '2026-01-01' }] }) === false,
   'never for anyone who has trained');
ok(await shouldOnboard({ ...fresh(), getSystems: async () => [{ id: 'sys1', name: 'Mine' }] }) === false,
   'never for anyone with a program');
ok(await shouldOnboard({ ...fresh(), getWorkouts: async () => [{ id: 'w1' }] }) === false,
   'never for anyone with a workout');
ok(await shouldOnboard({ ...fresh(), getSettings: async () => ({ onboardedAt: '2026-09-25' }) }) === false,
   'never when the account says it has seen them (another device)');
ok(await shouldOnboard({ ...fresh(), authState: async () => ({ mode: 'local', degraded: true }) }) === false,
   '🚨 never when the cloud failed and the empty data is only this device (Tim offline on a new phone)');
ok(await shouldOnboard({ ...fresh(), authState: async () => ({ mode: 'demo' }) }) === false, 'never on the demo backend');
ok(await shouldOnboard({ ...fresh(), hash: '#/invite/u1/tok' }) === false,
   'never over a link somebody followed in (invite, add, sign in)');
ok(await shouldOnboard({ ...fresh(), getSessions: async () => { throw new Error('offline'); } }) === false,
   'a read that fails means no — never shown on a guess');
localStorage.setItem('ftrack:v1:onboarded', '2026-09-25');
ok(await shouldOnboard(fresh()) === false, 'never twice on this device');
mem.delete('ftrack:v1:onboarded');

// The default gate in THIS harness (node: the Firebase SDK cannot load, so the
// store falls back to this device) must say no — which is what keeps every
// other suite that boots on an empty store free of the overlay.
ok(await shouldOnboard() === false, 'the real gate says no when the cloud is not really connected');

// The hook in app.js — asserted on the source, because app.js boots on import.
{
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const fr = app.slice(app.indexOf('async function firstRun('));
  ok(/firstRun\(\);/.test(app.slice(app.indexOf('(async function boot()'))), 'boot calls firstRun()');
  ok(fr.indexOf('shouldOnboard()') > 0 && fr.indexOf('shouldOnboard()') < fr.indexOf('openOnboarding('),
     'firstRun asks the gate before opening anything');
  ok(/import\('\.\/tour\.js'\)[\s\S]{0,80}startTour[\s\S]{0,40}\.catch\(/.test(fr),
     'and starts the tour when the questions end, tolerating tour.js being absent');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  ok(sw.includes("'./js/onboarding.js'") && sw.includes("'./js/program-builder.js'"), 'both files are precached for offline');
}

/* ================= 3. the flow, in a DOM ================= */
const { store } = await import(BASE + 'store.js');
const { openOnboarding } = onboarding;
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const tapChoice = async (label) => {
  const b = qa('.ob-screen.is-current .ob-choice').find((x) => x.textContent.trim().startsWith(label));
  if (!b) throw new Error('no choice ' + label + ' in ' + qa('.ob-screen.is-current .ob-choice').map((x) => x.textContent).join('|'));
  b.click();
  await settle(320);
};
const current = () => q('.ob-screen.is-current');
const title = () => (current() && current().querySelector('.ob-q') ? current().querySelector('.ob-q').textContent : '');

// Words, not symbols: "Barbell + rack at home" is Tim's own label (the plan) and reads as four.
const words = (s) => s.trim().split(/\s+/).filter((w) => /\w/.test(w)).length;
const skipBtn = () => qa('.ob-overlay .ob-skip')[0];

// The pure helpers: the unit a locale starts on (O-2), the week line (O-7).
{
  const { defaultUnitsFor, planLine, PATHS, ABOUT_WHY } = onboarding;
  const cases = [['en-US', 'lbs'], ['en-GB', 'kg'], ['de-DE', 'kg'], ['en-LR', 'lbs'], ['my-MM', 'lbs'],
    ['fr', 'kg'], ['en', 'lbs'], ['', 'lbs'], ['es-MX', 'kg'], ['en-AU', 'kg']];
  const wrong = cases.filter(([l, u]) => defaultUnitsFor(l) !== u);
  ok(wrong.length === 0, `kg is pre-selected outside the US, Liberia and Myanmar (${wrong.map(([l]) => `${l}→${defaultUnitsFor(l)}`).join(', ') || 'all right'})`);
  const fb = buildProgram({ goal: 'muscle', experience: '1to3', days: 3, minutes: 60, equipment: 'gym', focus: [] });
  ok(planLine(fb) === 'A · rest · B · rest · C · rest · rest', `the week line drops the shared "Full Body " (${planLine(fb)})`);
  const ul = buildProgram({ goal: 'muscle', experience: '1to3', days: 4, minutes: 60, equipment: 'gym', focus: [] });
  ok(planLine(ul) === 'Upper A · Lower A · rest · Upper B · Lower B · rest · rest', `names that differ stay whole (${planLine(ul)})`);
  ok(PATHS.length === 4 && PATHS.every(([, label]) => words(label) <= 4), 'four ways in, each ≤4 words');
  // 🚨 The ? must not promise more privacy than the code keeps (store.js publishes
  // gender and age; body weight only behind settings.shareBodyWeight).
  ok(/Gender and age show/.test(ABOUT_WHY) && /Body weight stays private unless you share it/.test(ABOUT_WHY),
     'the About-you ? says gender and age are shown and body weight is private unless shared');
  const storeSrc = (await import('node:fs')).readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  ok(/gender: mine\.gender,\s*\n\s*age: mine\.age,/.test(storeSrc) && /shareBodyWeight: Boolean\(settings\.shareBodyWeight\)/.test(storeSrc),
     'and store.js still publishes exactly that (gender, age; body weight behind its switch)');
}

// Skip — one Skip ends the whole intro, and says so to app.js (O-9)
{
  let done = [];
  openOnboarding({ onDone: (r) => { done.push(r); } });
  await settle();
  ok(Boolean(q('.ob-overlay')), 'the questions open as a full-screen overlay');
  ok(localStorage.getItem('ftrack:v1:onboarded'), 'and mark themselves seen the moment they open');
  ok(title() === 'How do you want to start?', `the first screen asks how to start (${title()})`);
  const startLabels = qa('.ob-screen.is-current .ob-choice').map((b) => b.textContent.trim());
  ok(JSON.stringify(startLabels) === JSON.stringify(['Build me a program', 'Pick a ready-made one', 'Use my own program', 'Just log workouts']),
     `four ways in (${startLabels.join(' | ')})`);
  const icon = q('.ob-screen.is-current img.ob-icon');
  ok(icon && icon.getAttribute('src') === 'icon.svg' && icon.getAttribute('width') === '48', 'the app icon sits on the start screen at 48px');
  const skip = qa('.ob-overlay button').find((b) => b.textContent.trim() === 'Skip');
  ok(Boolean(skip), 'Skip is there from the first screen');
  skip.click();
  await settle(320);
  ok(!q('.ob-overlay'), 'Skip closes it');
  ok(done.length === 1 && done[0] && done[0].skipped === true, `and calls onDone once, with skipped: true (${JSON.stringify(done)})`);
}

// "I already have an account" → Sign in, closed, no tour (O-4)
{
  let done = [];
  openOnboarding({ onDone: (r) => { done.push(r); } });
  await settle();
  const link = qa('.ob-screen.is-current a').find((a) => a.textContent.trim() === 'I already have an account');
  ok(link && link.getAttribute('href') === '#/signin', 'a sign-in link sits under the choices');
  link.click();
  await settle(320);
  ok(!q('.ob-overlay'), 'it closes the intro');
  ok(done.length === 1 && done[0].skipped === true, 'and asks for no tour');
  ok((await store.getSystems()).length === 0, 'having saved nothing');
}

// Word limits and the full flow
{
  let done = [];
  openOnboarding({ onDone: (r) => { done.push(r); } });
  await settle();
  const titles = [];
  const back = () => qa('.ob-overlay .ob-back')[0];
  ok(back() && (back().disabled || back().style.visibility === 'hidden'), 'no Back on the start screen');
  const progress = () => qa('.ob-progress .is-done').length;
  titles.push(title());
  await tapChoice('Build me a program');
  ok(/goal/i.test(title()), `Build me a program opens the questions (${title()})`);
  ok(qa('.ob-progress .ob-seg').length === 7, `the bar counts 6 questions + About you (${qa('.ob-progress .ob-seg').length})`);
  titles.push(title());
  await tapChoice('Build muscle');
  ok(progress() === 1, `one tap advances, and the progress shows it (${progress()})`);
  titles.push(title());
  back().click();
  await settle(320);
  ok(/goal/i.test(title()), `Back returns to the previous question (${title()})`);
  await tapChoice('Get stronger');
  await tapChoice('1–3 years');
  titles.push(title());
  await tapChoice('4');
  titles.push(title());
  await tapChoice('60');
  titles.push(title());
  const equip = qa('.ob-screen.is-current .ob-choice').map((b) => b.textContent.trim());
  ok(equip.includes('Bodyweight + pull-up bar') && !equip.includes('Bodyweight only'),
     `the bodyweight choice is honest about the bar (${equip.join(' | ')})`);
  await tapChoice('Full gym');
  titles.push(title());
  const labels = qa('.ob-overlay .ob-choice').map((b) => b.textContent.trim());
  ok(labels.every((l) => words(l) <= 4), `choice labels are short (${labels.filter((l) => words(l) > 4)})`);
  // Focus: multi-select, up to two, then Next.
  await tapChoice('Chest');
  ok(current().querySelector('.ob-choice[aria-pressed="true"]'), 'focus is a toggle, and does not advance by itself');
  await tapChoice('Arms');
  const legs = qa('.ob-screen.is-current .ob-choice').find((b) => b.textContent.trim() === 'Legs');
  ok(legs.disabled, 'a third focus cannot be picked');
  const next = qa('.ob-screen.is-current button').find((b) => b.textContent.trim() === 'Next');
  ok(Boolean(next), 'the focus step has Next');
  next.click();
  await settle(320);
  // About you (O-1, O-2): every path passes through it.
  titles.push(title());
  ok(title() === 'About you', `after the questions: About you (${title()})`);
  ok(Boolean(current().querySelector('.ob-title .help-dot')), 'with a ? right beside its title');
  const chip = (label) => [...current().querySelectorAll('.chip')].find((c) => c.textContent.trim() === label);
  ok(chip('lbs') && chip('lbs').getAttribute('aria-pressed') === 'true', 'this harness is en-US, so lbs starts selected');
  ok(chip('Male') && chip('Female') && chip('Male').getAttribute('aria-pressed') === 'false', 'gender is two chips, neither assumed');
  ok(progress() === 6, `the bar shows the six questions done (${progress()})`);
  chip('Female').click();
  const [yearIn, weightIn] = current().querySelectorAll('input');
  const born = new Date().getFullYear() - 64;
  yearIn.value = String(born); yearIn.dispatchEvent(new window.Event('input'));
  weightIn.value = '70'; weightIn.dispatchEvent(new window.Event('input'));
  chip('kg').click();
  ok(chip('kg').getAttribute('aria-pressed') === 'true' && chip('lbs').getAttribute('aria-pressed') === 'false', 'the unit toggle flips');
  qa('.ob-screen.is-current button').find((b) => b.textContent.trim() === 'Next').click();
  await settle(50);
  ok(/Building your program/.test(document.querySelector('.ob-overlay').textContent), 'a short "Building your program" moment');
  await settle(900);
  const result = current();
  ok(/Your 4-day Upper\/Lower/.test(result.textContent), `the result names the program (${result.querySelector('.ob-q') && result.querySelector('.ob-q').textContent})`);
  ok(qa('.ob-screen.is-current .ob-day').length === 4, 'and lists its four days');
  ok(/\d+ exercises/.test(result.textContent), 'each with an exercise count');
  const exLines = qa('.ob-screen.is-current .ob-day-ex').map((n) => n.textContent);
  ok(exLines.length === 4 && exLines.every((t) => t.split(' · ').length >= 3 && t.split(' · ').every((n) => BUILT_IN_EXERCISES.some((e) => e.name === n))),
     `each day names its exercises (${exLines[0]})`);
  const plan = q('.ob-screen.is-current .ob-plan');
  ok(plan && plan.textContent === 'Week: Upper A · Lower A · rest · Upper B · Lower B · rest · rest', `the week is one line (${plan && plan.textContent})`);
  ok(skipBtn().textContent === 'Not now', `Skip reads "Not now" on the result (${skipBtn().textContent})`);
  back().click();
  await settle(320);
  ok(title() === 'About you' && current().querySelector('.chip[aria-pressed="true"]') && current().querySelector('input').value === String(born),
     'Back from the result returns to About you with the answers kept');
  qa('.ob-screen.is-current button').find((b) => b.textContent.trim() === 'Next').click();
  await settle(1000);
  ok(titles.every((t) => t && words(t) <= 15), `every question is ≤15 words (${titles.join(' | ')})`);
  const alt = qa('.ob-screen.is-current a[href^="#/explore/"]');
  ok(alt.length >= 1 && alt.length <= 2, `1–2 ready-made alternatives link to Explore (${alt.map((a) => a.textContent)})`);
  const start = qa('.ob-screen.is-current button').find((b) => b.textContent.trim() === 'Start with this');
  ok(Boolean(start), 'Start with this is the primary action');
  start.click();
  await settle(400);
  const systems = await store.getSystems();
  const cur = await store.currentSystem();
  ok(systems.length === 1 && cur && cur.name === 'Your 4-day Upper/Lower', `saved and made current (${cur && cur.name})`);
  const ws = await store.getWorkouts(cur.id);
  ok(ws.map((w) => w.name).join(',') === 'Upper A,Lower A,Upper B,Lower B', `its workouts in order (${ws.map((w) => w.name)})`);
  ok(ws.every((w) => w.exercises.every((e) => Array.isArray(e.reps) && e.reps.every((r) => r && typeof r === 'object' && !Array.isArray(r)))),
     'reps are stored as {lo, hi} per set, never an array inside an array (Firestore refuses those)');
  ok(ws.every((w) => w.exercises.every((e) => e.reps.length === e.sets)), 'one rep target per planned set');
  ok(!q('.ob-overlay') || q('.ob-overlay').classList.contains('is-leaving'), 'the overlay closes');
  ok(done.length === 1 && done[0].skipped === false, `and onDone runs once, asking for the tour (${JSON.stringify(done)})`);
  const s = await store.getSettings();
  ok(s.onboardedAt, 'the account remembers it was shown');
  // About you, saved through the store's public methods (O-1, O-17).
  const prof = await store.getProfile();
  ok(prof.gender === 'female' && prof.birthYear === born, `gender and birth year saved (${prof.gender}, ${prof.birthYear})`);
  ok(prof.bodyWeight && Math.abs(prof.bodyWeight - 70 * 2.2046226218) < 0.01, `70 kg stored as pounds (${prof.bodyWeight})`);
  ok(s.units === 'kg', `the unit chosen becomes the account's (${s.units})`);
  const intro = s.intro || {};
  ok(intro.path === 'build' && intro.goal === 'strength' && intro.experience === '1to3' && intro.days === 4
     && intro.minutes === 60 && intro.equipment === 'gym' && JSON.stringify(intro.focus) === '["chest","arms"]'
     && intro.age === 64 && intro.at,
     `settings.intro keeps the answers and the age (${JSON.stringify(intro)})`);
}

// The other three ways in: About you, then straight there (O-3). Kept apart
// from the program path: nothing is built.
for (const [label, dest, skipIt] of [['Just log workouts', '#/record', false], ['Use my own program', '#/system/new', false],
  ['Pick a ready-made one', '#/explore', true]]) {
  location.hash = '#/home';
  const before = (await store.getSystems()).length;
  let done = [];
  openOnboarding({ onDone: (r) => { done.push(r); } });
  await settle();
  await tapChoice(label);
  ok(title() === 'About you', `${label} → About you first (${title()})`);
  ok(qa('.ob-progress .ob-seg').length === 1, 'with a one-step bar');
  // Reopened by someone who already chose kg: the toggle keeps it, not the locale's guess.
  const kg = [...current().querySelectorAll('.chip')].find((c) => c.textContent.trim() === 'kg');
  ok(kg && kg.getAttribute('aria-pressed') === 'true', 'the saved unit is pre-selected over the locale');
  if (skipIt) skipBtn().click();
  else qa('.ob-screen.is-current button').find((b) => b.textContent.trim() === 'Next').click();
  await settle(320);
  ok(location.hash === dest, `${skipIt ? 'Skip' : 'Next'} lands on ${dest} (${location.hash})`);
  ok(done.length === 1 && done[0].skipped === skipIt, `onDone skipped: ${skipIt}`);
  ok((await store.getSystems()).length === before, 'no program was made');
}
{
  const src = (await import('node:fs')).readFileSync(new URL('../js/onboarding.js', import.meta.url), 'utf8');
  ok(/buildProgram\(\{[^)]*age/.test(src), 'the builder is handed the age (older beginners get easier lifts, O-8)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
