// Workouts-tab decisions from the 2026-09-24 review, second pass (builder R2).
//
//   node tests/review2-workouts.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "for all of the 42 items you're leaving me to decide, you just choose
// what to do based on what you know and recommend". Each block is one of the
// decisions, and each was seen FAILING against the old code first
// (FT_JS_BASE can point the imports at a copy of the old js/ folder).
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/workouts',
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

const BASE = process.env.FT_JS_BASE
  ? pathToFileURL(process.env.FT_JS_BASE.replace(/[\\/]?$/, '/')).href
  : new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const views = await import(BASE + 'views-workouts.js');
const { PRESET_SYSTEMS } = await import(BASE + 'preset-systems.js');
const setReps = await import(BASE + 'set-reps.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
const lastSheet = () => { const s = document.querySelectorAll('.sheet'); return s[s.length - 1] || null; };
const clearSheets = () => document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-scrim, .toast').forEach((n) => n.remove());
const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const buttons = (root) => [...root.querySelectorAll('button')];
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}
async function safe(label, fn) {
  try { await fn(); } catch (err) { ok(false, `${label} threw: ${err && err.stack}`); }
}
const NIPPARD = PRESET_SYSTEMS.find((p) => p.id === 'preset-nippard-ppl-2023');
const BUMSTEAD = PRESET_SYSTEMS.find((p) => p.id === 'preset-bumstead-8day');

/* ============ 1. the Added panel starts the first workout ============ */
await safe('added panel', async () => {
  await store.clearAll();
  clearSheets();
  // Somebody already running another programme, so the copy is NOT current —
  // the case with the most on the panel.
  const mine = await store.saveSystem({ name: 'Mine' });
  await store.saveWorkout({ name: 'Day', systemId: mine.id, exercises: [{ exerciseId: byName('Back Squat').id, sets: 3 }] });
  await store.setCurrentSystem(mine.id);

  let screen = await mount(views.ExploreDetailView(NIPPARD.id));
  buttons(screen).find((b) => b.textContent.trim() === 'Add to my programs').click();
  for (let i = 0; i < 12; i++) await settle();
  ok(![...document.querySelectorAll('.toast')].some((t) => /Added to your programs/.test(t.textContent)),
     '1a: no toast repeating the panel heading');

  screen = await mount(views.ExploreDetailView(NIPPARD.id));
  const copy = (await store.getSystems()).find((s) => s.presetId === NIPPARD.id);
  const first = (await store.getWorkouts(copy.id))[0];
  const bottom = screen.querySelector('.pane-bottom');
  const bb = buttons(bottom);
  ok(bb[0] && bb[0].classList.contains('primary') && /^Start Push 1$/.test(txt(bb[0])),
     `1b: the main pinned button is "Start Push 1" (got "${txt(bb[0])}")`);
  ok(bb.some((b) => /Make it my current program/.test(b.textContent)),
     '1c: "Make it my current program" is still pinned');
  ok(!/Add another copy|Remove from my programs|Open it/.test(txt(bottom)),
     `1d: Add another copy, Open it and Remove left the pinned bottom (bottom: "${txt(bottom)}")`);
  const scroll = screen.querySelector('.pane-scroll');
  const remove = buttons(scroll).find((b) => /Remove from my programs/.test(b.textContent));
  ok(Boolean(remove) && !remove.classList.contains('primary'),
     '1e: Remove is in the page content and is not a primary button');
  ok(buttons(scroll).some((b) => /Add another copy/.test(b.textContent)), '1f: Add another copy is in the content');
  location.hash = '#/explore';
  bb[0].click();
  ok(location.hash === '#/session/' + first.id, `1g: Start goes straight into the runner (got ${location.hash})`);

  /* ---- the programme page starts a workout from its row ---- */
  const prog = await mount(views.SystemRouteView(copy.id));
  const starts = buttons(prog.querySelector('.pane-scroll')).filter((b) => /^Start\b/.test(txt(b)));
  ok(starts.length === 6, `1h: every workout row on the programme page has a Start (got ${starts.length})`);
  location.hash = '#/x';
  starts[0] && starts[0].click();
  ok(location.hash === '#/session/' + first.id, `1i: a row's Start opens the runner (got ${location.hash})`);
});

/* ============ 2. the workout page shows planned reps, and notes by their exercise ============ */
await safe('workout page', async () => {
  const copy = (await store.getSystems()).find((s) => s.presetId === NIPPARD.id);
  const push1 = (await store.getWorkouts(copy.id)).find((w) => w.name === 'Push 1');
  const screen = await mount(views.WorkoutRouteView(push1.id));
  const rows = [...screen.querySelectorAll('.pane-scroll .row')];
  const bench = rows.find((r) => /Barbell Bench Press/.test(r.textContent));
  ok(bench && /1 × 3–5/.test(txt(bench.querySelector('.row-meta'))),
     `2a: the bench row reads "1 × 3–5" (got "${txt(bench && bench.querySelector('.row-meta'))}")`);
  const larsen = rows.find((r) => /Larsen Press/.test(r.textContent));
  ok(larsen && /2 × 10/.test(txt(larsen.querySelector('.row-meta'))), '2b: a single rep count reads "2 × 10"');
  ok(bench && /One heavy set of 3–5, after working up to it\./.test(bench.textContent),
     '2c: the bench note sits under the bench row');
  ok(![...screen.querySelectorAll('.section-label')].some((n) => n.textContent.trim() === 'Notes'),
     '2d: no separate Notes pile at the bottom');
  // A workout with no reps still says sets.
  const plain = await store.saveWorkout({ name: 'Plain', systemId: copy.id, exercises: [{ exerciseId: byName('Back Squat').id, sets: 3 }] });
  const p = await mount(views.WorkoutRouteView(plain.id));
  ok(/3 sets/.test(txt(p.querySelector('.row-meta'))), '2e: no reps stored still reads "3 sets"');
  await store.deleteWorkout(plain.id);
});

/* ============ 3. a copied programme keeps its author ============ */
await safe('byline', async () => {
  const copy = (await store.getSystems()).find((s) => s.presetId === NIPPARD.id);
  const screen = await mount(views.SystemRouteView(copy.id));
  const scroll = screen.querySelector('.pane-scroll');
  ok(/By Jeff Nippard/.test(txt(scroll)), '3a: "By Jeff Nippard" on the copied programme');
  const a = scroll.querySelector('a.text-link');
  ok(a && a.getAttribute('href') === NIPPARD.sourceUrl, '3b: the source is a text-link to the source URL');
  ok(Boolean(scroll.querySelector('.preset-warning')) && /Not official/.test(txt(scroll.querySelector('.preset-warning'))),
     '3c: the "Not official" warning comes with it');
  const own = await store.saveSystem({ name: 'Typed by me' });
  const o = await mount(views.SystemRouteView(own.id));
  ok(!/\bBy\b/.test(txt(o.querySelector('.pane-scroll'))) && !o.querySelector('.preset-warning'),
     '3d: a system you typed yourself has neither');
});

/* ============ 4. reps in the builder ============ */
ok(typeof setReps.parseRepText === 'function', '4a: set-reps.js exports parseRepText');
if (typeof setReps.parseRepText === 'function') {
  const p = setReps.parseRepText;
  ok(JSON.stringify(p('8')) === '[8,8]', '4b: "8" → [8, 8]');
  ok(JSON.stringify(p('8–10')) === '[8,10]' && JSON.stringify(p('8-10')) === '[8,10]'
     && JSON.stringify(p(' 8 to 10 ')) === '[8,10]', '4c: "8–10", "8-10", "8 to 10" → [8, 10]');
  ok(JSON.stringify(p('10-8')) === '[8,10]', '4d: an inverted range is sorted');
  ok(p('') === null && p('abc') === null && p('0') === null && p('8-') === null && p('51') === null,
     '4e: nonsense, zero, half a range and past 50 are refused');
}
await safe('reps chip', async () => {
  clearSheets();
  const sys = await store.saveSystem({ name: 'Built' });
  const w = await store.saveWorkout({ name: 'Bench day', systemId: sys.id,
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 3 }] });
  const screen = await mount(views.WorkoutRouteView(w.id + '/edit'));
  const chip = screen.querySelector('.builder-controls .chip.set-reps');
  ok(chip && chip.textContent.trim() === 'Reps', `4f: a "Reps" chip in the builder (got "${txt(chip)}")`);
  const pct = screen.querySelector('.builder-controls .chip.set-target');
  ok(chip && pct && chip.previousElementSibling === pct, '4g: it sits right after "% of max"');
  if (!chip) return;
  chip.click();
  await settle();
  const sheet = lastSheet();
  const all = sheet && sheet.querySelector('input[aria-label="Reps, all sets"]');
  ok(Boolean(all), '4h: the sheet has an all-sets reps field');
  if (!all) return;
  all.value = '8–10';
  all.dispatchEvent(new window.Event('input', { bubbles: true }));
  await settle();
  ok(/8–10 reps/.test(txt(screen.querySelector('.chip.set-reps'))), `4i: the chip now says 8–10 reps (got "${txt(screen.querySelector('.chip.set-reps'))}")`);
  const set2 = sheet.querySelector('input[aria-label="Reps, set 2"]');
  set2.value = '6';
  set2.dispatchEvent(new window.Event('input', { bubbles: true }));
  await settle();
  clearSheets();
  buttons(screen.querySelector('.pane-bottom')).find((b) => /Save changes/.test(b.textContent)).click();
  for (let i = 0; i < 6; i++) await settle();
  const saved = await store.getWorkout(w.id);
  ok(JSON.stringify(saved.exercises[0].reps) === JSON.stringify([{ lo: 8, hi: 10 }, { lo: 6, hi: 6 }, { lo: 8, hi: 10 }]),
     `4j: saved as {lo, hi} per set (got ${JSON.stringify(saved.exercises[0].reps)})`);
  ok(!saved.exercises[0].reps.some(Array.isArray), '4k: never an array inside an array (§0.22)');
  // And cleared again.
  const again = await mount(views.WorkoutRouteView(w.id + '/edit'));
  again.querySelector('.chip.set-reps').click();
  await settle();
  const none = buttons(lastSheet()).find((b) => /No rep target/.test(b.textContent));
  ok(Boolean(none), '4l: the sheet offers "No rep target"');
  none && none.click();
  clearSheets();
  buttons(again.querySelector('.pane-bottom')).find((b) => /Save changes/.test(b.textContent)).click();
  for (let i = 0; i < 6; i++) await settle();
  ok(!(await store.getWorkout(w.id)).exercises[0].reps, '4m: clearing it saves no reps');
});

/* ============ 5. the workout checker is shown ============ */
await safe('lint', async () => {
  clearSheets();
  const sys = await store.saveSystem({ name: 'Chest heavy' });
  const w = await store.saveWorkout({ name: 'Chest', systemId: sys.id, exercises: [
    { exerciseId: byName('Barbell Bench Press').id, sets: 6 },
    { exerciseId: byName('Incline Dumbbell Bench Press').id, sets: 6 },
  ] });
  const screen = await mount(views.WorkoutRouteView(w.id + '/edit'));
  const lint = screen.querySelector('.lint-notes');
  ok(lint && /Chest: 12 sets here/.test(txt(lint)), `5a: the builder shows the 12-set finding (got "${txt(lint)}")`);
  const order = [...screen.querySelector('.pane-scroll').children];
  ok(lint && order.indexOf(lint) === order.indexOf(lint.previousElementSibling) + 1
     && lint.previousElementSibling && lint.previousElementSibling.classList.contains('field-help'),
     '5b: it sits right under the exercise-order note');
  const prog = await mount(views.SystemRouteView(sys.id));
  const pl = prog.querySelector('.lint-notes');
  ok(pl && /Chest/.test(txt(pl)) && /12 sets/.test(txt(pl)), `5c: the programme screen shows it too (got "${txt(pl)}")`);
  const quiet = await store.saveWorkout({ name: 'Light', systemId: sys.id, exercises: [{ exerciseId: byName('Back Squat').id, sets: 3 }] });
  const q = await mount(views.WorkoutRouteView(quiet.id + '/edit'));
  const ql = q.querySelector('.lint-notes');
  ok(!ql || ql.hidden || !txt(ql), '5d: nothing is shown when there is no finding');
});

/* ============ 6. ready-made programmes come with their plan ============ */
await safe('plans', async () => {
  const { presetPlan } = await import(BASE + 'preset-systems.js');
  ok(typeof presetPlan === 'function', '6: preset-systems.js exports presetPlan');
  const plan = typeof presetPlan === 'function' ? presetPlan : () => null;
  const b = plan(BUMSTEAD);
  ok(b && b.kind === 'cycle' && b.slots.length === 8, '6a: Bumstead carries his 8-day cycle');
  const n = plan(NIPPARD);
  ok(n && n.slots.length === 7 && n.slots[6] === 'rest', '6b: Nippard carries six on, one off');
  const floating = PRESET_SYSTEMS.find((p) => p.id === 'preset-israetel-floating-split');
  ok(!plan(floating), '6c: the floating split, which has no fixed days, gets none');
  for (const p of PRESET_SYSTEMS.filter((x) => plan(x))) {
    const keys = new Set(p.workouts.map((w) => w.key));
    ok(plan(p).slots.every((s) => s === 'rest' || keys.has(s)), `6d: ${p.name}'s plan names only its own workouts`);
  }
  await store.clearAll();
  const { system } = await store.addPresetSystem(BUMSTEAD);
  const sys = await store.getSystem(system.id);
  const ws = await store.getWorkouts(system.id);
  const name = (id) => (id === 'rest' ? 'Rest' : (ws.find((w) => w.id === id) || {}).name);
  const got = sys.schedule ? sys.schedule.slots.map(name) : null;
  ok(sys.schedule && sys.schedule.kind === 'cycle'
     && JSON.stringify(got) === JSON.stringify(['Quads & Calves', 'Chest & Triceps', 'Back & Biceps', 'Rest',
       'Shoulders & Chest', 'Hamstrings & Back', 'Arms', 'Rest']),
     `6e: adding Bumstead copies the plan with the new workout ids (got ${JSON.stringify(got)})`);
  const screen = await mount(views.SystemRouteView(system.id));
  ok(Boolean(screen.querySelector('.plan-grid')), '6f: and the boxes show on the copy');
});

/* ============ 7. the checker shows two lines, then "N more" ============ */
// 2026-09-24 wording pass: five findings on one program was too wordy. The two
// most important lines show (a 'warn' before a 'note'); the rest fold into a
// small "N more" that opens downward, in place.
await safe('lint cap', async () => {
  clearSheets();
  await store.clearAll();
  const { SESSION_CEILING } = await import(BASE + 'volume-map.js');
  const sys = await store.saveSystem({ name: 'Wordy' });
  const days = [
    ['Barbell Bench Press', 12], ['Back Squat', 12], ['Barbell Curl', 12],
    ['Overhead Press', 12], ['Barbell Row', SESSION_CEILING + 2],
  ];
  for (const [n, sets] of days) {
    await store.saveWorkout({ name: n, systemId: sys.id, exercises: [{ exerciseId: byName(n).id, sets }] });
  }
  const screen = await mount(views.SystemRouteView(sys.id));
  const box = screen.querySelector('.lint-notes');
  const all = box ? [...box.querySelectorAll('.lint-line')] : [];
  const shown = box ? [...box.children].filter((c) => c.classList.contains('lint-line')) : [];
  ok(all.length >= 5, `7a: the fixture really has 5+ findings (got ${all.length})`);
  ok(shown.length === 2, `7b: only 2 lines show before "more" (got ${shown.length})`);
  ok(shown[0] && shown[0].classList.contains('is-warn'), '7c: the warning comes first');
  const more = box && box.querySelector('details > summary');
  ok(more && txt(more) === `${all.length - 2} more`, `7d: a "${all.length - 2} more" control (got "${txt(more)}")`);
  ok(more && !more.parentNode.open, '7e: closed until tapped');
  ok(more && more.parentNode.parentNode === box && box.lastElementChild === more.parentNode,
     '7f: it sits at the end of the lines, so opening it only grows downward');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
