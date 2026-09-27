// Auto-guide: one step at a time, one button (2026-09-27).
//
//   node tests/guide-mode.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: *"make a "auto-guide" button you could press which would just show you
// the single set you should be on and you can change the weight and reps, and
// then just a single button at the bottom that says "next ____ (either set or
// exercise)" … If you are in a group workout, it will automatically do the
// next set on the next person … It will also take you through warmup sets. If
// you want to change anything, there will be an edit button in the top corner
// and it will take you to the main view, and you can switch between views."*
//
// Part 0 pins the ORDER (js/guide-steps.js, pure). Part 1+ drive the real
// runner: the button, typing kept across a view switch, Edit landing on the
// same set, a reload staying in the guide, the person hand-over, Finish.
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
const G = await import(BASE + 'guide-steps.js');
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const { SessionView } = await import(BASE + 'views-session.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };

/* ============ 0. the order (pure) ============ */
const W = (n, done = false) => Array.from({ length: n }, () => ({ weight: 45, reps: 8, ...(done ? { done: true } : {}) }));
const Sx = (n) => Array.from({ length: n }, () => ({ weight: 100, reps: 5 }));
const ent = (id, sets, extra = {}) => ({ exerciseId: id, exerciseName: id.toUpperCase(), fields: ['weight', 'reps'], sets, ...extra });
/** Walk a draft from `start` to the end, marking each step done; the words and the labels. */
function walk(d, start) {
  const out = [];
  let cur = start;
  for (let guard = 0; cur && guard < 60; guard++) {
    const w = G.stepWords(d, cur);
    const label = G.nextLabel(d, cur, G.peekNext(d, cur));
    out.push({ who: w.who, ex: w.exerciseName, set: w.set, label });
    G.markDone(d, cur);
    cur = G.nextStep(d, cur);
  }
  return out;
}
const fmt = (r) => `${r.who ? r.who + ' ' : ''}${r.ex} ${r.set} → ${r.label}`;

{
  // Solo: warm-ups, then sets, then the next exercise, then Finish.
  const d = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', Sx(3), { warmups: W(2) }), ent('b', Sx(2))] };
  const start = G.startStep(d);
  ok(start && start.kind === 'warm' && start.index === 0, 'opens on warm-up 1, not set 1');
  const seq = walk(d, start).map(fmt);
  const want = [
    'A Warm-up 1 of 2 → Next warm-up',
    'A Warm-up 2 of 2 → Next set',
    'A Set 1 of 3 → Next set',
    'A Set 2 of 3 → Next set',
    'A Set 3 of 3 → Next exercise',
    'B Set 1 of 2 → Next set',
    'B Set 2 of 2 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'solo: warm-ups → sets → next exercise → Finish\n      ' + seq.join('\n      '));
  ok(d.entries[0].sets.every((s) => s.done) && d.entries[0].warmups.every((w) => w.done && !w.auto),
     'every step walked is marked done (warm-ups on their own rows)');
  ok(!d.entries[0].sets.some((s) => Array.isArray(s.done)), 'no array appears where a flag should be');
}

{
  // Two people alternate every set, warm-ups included, then move on together.
  const d = { forName: null, guestNames: ['Rae'], index: 0,
    entries: [ent('a', Sx(2), { warmups: W(1) }), ent('b', Sx(1))],
    others: [{ name: 'Rae', index: 0, entries: [ent('a', Sx(2), { warmups: W(1) }), ent('b', Sx(1))] }] };
  const seq = walk(d, G.startStep(d)).map(fmt);
  const want = [
    'You A Warm-up 1 of 1 → Next: Rae',
    'Rae A Warm-up 1 of 1 → Next: You',
    'You A Set 1 of 2 → Next: Rae',
    'Rae A Set 1 of 2 → Next: You',
    'You A Set 2 of 2 → Next: Rae',
    'Rae A Set 2 of 2 → Next exercise',
    'You B Set 1 of 1 → Next: Rae',
    'Rae B Set 1 of 1 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'joint: alternate every step, then the next exercise\n      ' + seq.join('\n      '));
}

{
  // Three people; Kai has finished; wrap from Rae to You; uneven set counts.
  const kai = ent('a', Sx(2)); kai.sets.forEach((s) => { s.done = true; });
  const d = { forName: 'Rae', guestNames: ['Rae', 'Kai'], index: 0,
    entries: [ent('a', Sx(3))],
    others: [{ name: null, index: 0, entries: [ent('a', Sx(1))] }, { name: 'Kai', index: 0, entries: [kai] }] };
  const seq = walk(d, G.startStep(d)).map(fmt);
  const want = [
    'Rae A Set 1 of 3 → Next: You',
    'You A Set 1 of 1 → Next: Rae',
    'Rae A Set 2 of 3 → Next set',
    'Rae A Set 3 of 3 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'skips a finished person, wraps to You, and nobody left → same person\n      ' + seq.join('\n      '));
}

{
  // A superset, solo: round by round, the runner's order.
  const d = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', Sx(2), { group: 1 }), ent('b', Sx(2), { group: 1 }), ent('c', Sx(1))] };
  const seq = walk(d, G.startStep(d)).map(fmt);
  const want = [
    'A Set 1 of 2 → Next exercise',
    'B Set 1 of 2 → Next exercise',
    'A Set 2 of 2 → Next exercise',
    'B Set 2 of 2 → Next exercise',
    'C Set 1 of 1 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'superset: A1, B1, A2, B2 (warm-ups stay hidden in a superset)\n      ' + seq.join('\n      '));
}

{
  // A superset, two people: a person does their whole round, then hands over.
  const mk = () => [ent('a', Sx(2), { group: 1 }), ent('b', Sx(2), { group: 1 })];
  const d = { forName: null, guestNames: ['Rae'], index: 0, entries: mk(), others: [{ name: 'Rae', index: 0, entries: mk() }] };
  const seq = walk(d, G.startStep(d)).map(fmt);
  const want = [
    'You A Set 1 of 2 → Next exercise',
    'You B Set 1 of 2 → Next: Rae',
    'Rae A Set 1 of 2 → Next exercise',
    'Rae B Set 1 of 2 → Next: You',
    'You A Set 2 of 2 → Next exercise',
    'You B Set 2 of 2 → Next: Rae',
    'Rae A Set 2 of 2 → Next exercise',
    'Rae B Set 2 of 2 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'superset with two people: a whole round each, then swap\n      ' + seq.join('\n      '));
}

{
  // A blank set cannot be marked done; a prefilled one loses the flag when it is.
  const d = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', [{ weight: 0, reps: 0 }, { weight: 100, reps: 10, prefilled: true }])] };
  ok(G.markDone(d, { name: null, entryIndex: 0, kind: 'set', index: 0 }) === false && !d.entries[0].sets[0].done,
     'a blank set is refused, and nothing changes');
  ok(G.markDone(d, { name: null, entryIndex: 0, kind: 'set', index: 1 }) === true
     && d.entries[0].sets[1].done === true && !('prefilled' in d.entries[0].sets[1]),
     'Next under an app-worked-out number accepts it: done, and no longer `prefilled`');
  // Where it opens: a finished first set is skipped to the first unfinished one.
  const e = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', [{ weight: 1, reps: 1, done: true }, { weight: 1, reps: 1 }], { warmups: W(1, true) })] };
  const s = G.startStep(e);
  ok(s && s.kind === 'set' && s.index === 1, 'opens on the first UNFINISHED step (done warm-up and set 1 skipped)');
  // A ramp suggested AFTER set 1 was finished is behind you, not ahead.
  const f = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', [{ weight: 1, reps: 1, done: true }, { weight: 1, reps: 1 }], { warmups: W(3) })] };
  const s2 = G.startStep(f);
  ok(s2 && s2.kind === 'set' && s2.index === 1, 'unfinished warm-ups are skipped once a working set is finished');
}

/* ============ 0b. Back: prevStep (pure) ============
 * Tim: "Also there's no back button for the auto-guide like there should be."
 * The screen keeps a trail of the steps it showed; prevStep is what Back does
 * when that trail is empty (just entered, or a reload): the step before this
 * one in guide order, walked the way the guide itself walks. */
if (typeof G.prevStep !== 'function') {
  ok(false, 'guide-steps.js exports prevStep()');
} else {
  const same = (a, b) => a && b && (a.name ?? null) === (b.name ?? null) && a.entryIndex === b.entryIndex && a.kind === b.kind && a.index === b.index;
  const show = (s) => (s ? `${s.name ?? 'You'} e${s.entryIndex} ${s.kind}${s.index + 1}` : 'null');
  /** Walk forward; at every step, prevStep must name the step just before it. */
  const backWalk = (label, d) => {
    let cur = G.startStep(d);
    let prev = null;
    const bad = [];
    for (let guard = 0; cur && guard < 60; guard++) {
      const got = G.prevStep(d, cur);
      if (prev ? !same(got, prev) : got !== null) bad.push(`${show(cur)} → ${show(got)} (want ${show(prev)})`);
      G.markDone(d, cur);
      prev = cur;
      cur = G.nextStep(d, cur);
    }
    ok(bad.length === 0, `prevStep, ${label}: every step's Back is the step before it${bad.length ? '\n      ' + bad.join('\n      ') : ''}`);
  };
  backWalk('solo with warm-ups, two exercises', { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', Sx(3), { warmups: W(2) }), ent('b', Sx(2))] });
  backWalk('two people alternating', { forName: null, guestNames: ['Rae'], index: 0,
    entries: [ent('a', Sx(2), { warmups: W(1) }), ent('b', Sx(1))],
    others: [{ name: 'Rae', index: 0, entries: [ent('a', Sx(2), { warmups: W(1) }), ent('b', Sx(1))] }] });
  backWalk('two people, uneven set counts', { forName: null, guestNames: ['Rae'], index: 0,
    entries: [ent('a', Sx(4))], others: [{ name: 'Rae', index: 0, entries: [ent('a', Sx(2))] }] });
  backWalk('superset, solo', { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', Sx(2), { group: 1 }), ent('b', Sx(2), { group: 1 }), ent('c', Sx(1))] });
  const mk = () => [ent('a', Sx(2), { group: 1 }), ent('b', Sx(2), { group: 1 })];
  backWalk('superset, two people', { forName: null, guestNames: ['Rae'], index: 0, entries: mk(), others: [{ name: 'Rae', index: 0, entries: mk() }] });
  // After Back, Next carries on from there: prevStep is read-only.
  const d = { forName: null, guestNames: [], others: [], index: 0, entries: [ent('a', Sx(3))] };
  G.markDone(d, { name: null, entryIndex: 0, kind: 'set', index: 0 });
  const snap = JSON.stringify(d);
  const p = G.prevStep(d, { name: null, entryIndex: 0, kind: 'set', index: 1 });
  ok(same(p, { name: null, entryIndex: 0, kind: 'set', index: 0 }) && JSON.stringify(d) === snap,
     'prevStep changes nothing on the draft (set 1 stays done, its numbers kept)');
}

/* ============ 1+. the real runner ============ */
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
const DRAFT = 'ftrack:v1:draftSession';
const draft = () => JSON.parse(localStorage.getItem(DRAFT) || '{}');
const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
const killSheets = () => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}
const toggle = () => app().querySelector('.guide-toggle');
const guide = () => app().querySelector('.guide');
const guideOn = () => Boolean(guide() && !guide().hidden);
const where = () => (app().querySelector('.guide-where') || {}).textContent || '';
const nextBtn = () => app().querySelector('.guide-next');
const backBtn = () => app().querySelector('.guide-back');
const rows = () => [...app().querySelectorAll('.set-list .set-item:not(.set-warm)')];
const openAt = () => { const o = app().querySelector('.set-open'); return o ? rows().indexOf(o.closest('.set-item')) : -1; };
async function addGuest(name) {
  app().querySelector('.person-add').click();
  await settle(); await settle();
  [...document.querySelector('.sheet').querySelectorAll('button')].find((b) => /Someone new/.test(b.textContent)).click();
  await settle();
  const inner = [...document.querySelectorAll('.sheet')].pop();
  inner.querySelector('input').value = name;
  [...inner.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click();
  await settle(); await settle();
  killSheets();
}
const chip = (name) => [...app().querySelectorAll('.person-chip')].find((b) => b.textContent.trim() === name);
const entriesOf = (name) => {
  const d = draft();
  if ((d.forName ?? null) === name) return d.entries;
  return ((d.others || []).find((o) => (o.name ?? null) === name) || {}).entries;
};

/* 1. The button, the view, typing kept, Edit on the same set, reload. */
{
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({
    name: 'Guide day',
    exercises: [
      { exerciseId: byName('Pendlay Row').id, sets: 3, notes: '' },
      { exerciseId: byName('Back Squat').id, sets: 1, notes: '' },
    ],
  });
  await mount(SessionView(w.id));
  ok(Boolean(toggle()) && /Auto-guide/.test(toggle().textContent), 'the runner has an Auto-guide button');
  ok(!guideOn(), 'and opens in the normal view');
}
if (!toggle()) {
  ok(false, 'no Auto-guide button — the rest of the runner checks cannot run');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}
{
  const w = { id: draft().workoutId };
  toggle().click();
  await settle();
  ok(guideOn(), 'Auto-guide shows the guide');
  ok(app().querySelector('.pane-scroll').hidden && app().querySelector('.session-footer:not(.guide-footer)').hidden,
     'and hides the set list and the runner footer');
  ok(/Edit/.test(toggle().textContent), 'the top-corner button now reads Edit');
  ok(/Set 1 of 3/.test(where()), `one step: "${where().trim()}"`);
  ok(app().querySelector('.guide-ex').textContent === 'Pendlay Row', 'the exercise name is on it');
  ok(app().querySelectorAll('.guide .stepper').length === 2, 'weight and reps steppers (the shared ui.js control)');
  ok(/Next set/.test(nextBtn().textContent), `bottom button: "${nextBtn().textContent.trim()}"`);
  ok(draft().view === 'guide', 'the view is remembered on the draft');

  ok(Boolean(backBtn()) && backBtn().disabled, 'Back is there on the first step, and disabled (nothing before it)');

  type(app().querySelector('.guide .step-value'), 135);
  await settle();
  ok(entriesOf(null)[0].sets[0].weight === 135, 'typing in the guide lands in the draft');

  // The big bar: exactly ONE drawing on the guide, labelled with the sentence.
  const bars = app().querySelectorAll('.guide .guide-bar');
  ok(bars.length === 1 && !bars[0].hidden, 'the guide draws the big bar');
  ok(app().querySelectorAll('.guide svg.plate-draw').length === 0, 'and the small in-stepper drawing is not there too');
  ok(app().querySelectorAll('.guide svg').length - app().querySelectorAll('.guide .btn svg, .guide .step-btn svg').length === 1,
     'exactly one drawing in the guide');
  ok(bars[0].getAttribute('aria-label') === 'bar + 45 each side', `its label is the plate sentence ("${bars[0].getAttribute('aria-label')}")`);
  app().querySelectorAll('.guide .step-btn')[1].dispatchEvent(new window.Event('pointerdown', { cancelable: true }));
  app().querySelectorAll('.guide .step-btn')[1].dispatchEvent(new window.Event('pointerup'));
  await settle();
  ok(/bar \+ 45, 2\.5 each side/.test(bars[0].getAttribute('aria-label') || ''), `+ redraws the bar ("${bars[0].getAttribute('aria-label')}")`);
  type(app().querySelector('.guide .step-value'), 135);
  await settle();
  ok(app().querySelector('.guide .guide-bar') === bars[0], 'the same drawing is kept across changes (so plates can move)');

  nextBtn().click();
  await settle();
  ok(entriesOf(null)[0].sets[0].done === true, 'Next marks set 1 Finished (the runner\'s own flag)');
  ok(/Set 2 of 3/.test(where()), 'and moves to set 2');
  ok(app().querySelectorAll('.guide .guide-bar').length === 1, 'still one bar on the next step');

  // Back: to set 1, its number kept, still Finished; Next carries on to set 2.
  ok(!backBtn().disabled, 'Back is enabled on set 2');
  backBtn().click();
  await settle();
  ok(/Set 1 of 3/.test(where()), `Back → set 1 ("${where().trim()}")`);
  ok(app().querySelector('.guide .step-value').value === '135' && entriesOf(null)[0].sets[0].done === true,
     'set 1 keeps its 135 and its Finished flag');
  ok(backBtn().disabled, 'Back is disabled again on the first step');
  ok(/Next set/.test(nextBtn().textContent), `and Next still reads "${nextBtn().textContent.trim()}"`);
  nextBtn().click();
  await settle();
  ok(/Set 2 of 3/.test(where()), 'Next from there → set 2 again');
  // Warm-ups: set 1 now has a weight, so the runner's suggested ramp exists.
  const warms = (entriesOf(null)[0].warmups || []).length;
  ok(!entriesOf(null)[0].warmups || entriesOf(null)[0].warmups.every((x) => !x.done),
     'no warm-up was marked done by a working set');

  // A number still in the box (focused, not blurred) is kept through Edit.
  const box = app().querySelector('.guide .step-value');
  box.focus();
  box.value = '140';
  toggle().click();
  await settle();
  ok(!guideOn() && !app().querySelector('.pane-scroll').hidden, 'Edit returns to the normal view');
  ok(entriesOf(null)[0].sets[1].weight === 140, '⚠️ a number still being typed is kept across the switch');
  ok(openAt() === 1, 'Edit lands with the SAME set open (set 2)');
  ok(rows()[0].classList.contains('is-done'), 'set 1 shows Finished in the normal view');
  ok(!draft().view, 'and the draft says normal view');

  // Back into the guide, then a reload keeps it there.
  toggle().click();
  await settle();
  ok(guideOn() && /Set 2 of 3/.test(where()), 'Auto-guide again: back on set 2');
  await mount(SessionView(w.id));
  ok(guideOn() && /Set 2 of 3/.test(where()), 'a reload resumes in the guide, on the same step');

  // Through to the next exercise and Finish.
  nextBtn().click(); await settle();
  ok(/Set 3 of 3/.test(where()) && /Next exercise/.test(nextBtn().textContent), 'set 3: "Next exercise"');
  nextBtn().click(); await settle();
  const exNow = app().querySelector('.guide-ex').textContent;
  ok(exNow === 'Back Squat', `next exercise: ${exNow} (${where().trim()})`);
  ok(draft().index === 1, 'the runner\'s walk moved with it');
  // Back Squat may open on a suggested warm-up; walk to the last step.
  for (let g = 0; g < 8 && !/Finish workout/.test(nextBtn().textContent); g++) {
    type(app().querySelector('.guide .step-value'), 185);
    nextBtn().click(); await settle();
  }
  ok(/Finish workout/.test(nextBtn().textContent), 'the last step says "Finish workout"');
  const setsBefore = entriesOf(null)[1].sets.length;
  type(app().querySelector('.guide .step-value'), 185);
  nextBtn().click();
  await settle(); await settle();
  const h1 = app().querySelector('.topbar h1');
  ok(h1 && h1.textContent === 'Save workout', 'Finish workout opens the save screen');
  ok(setsBefore === 1, 'setup sanity: Back Squat had one set');
  void warms;
  localStorage.removeItem(DRAFT);
}

/* 2. Joint workout: the guide hands over to the next person. */
{
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({
    name: 'Pair guide',
    exercises: [{ exerciseId: byName('Pendlay Row').id, sets: 2, notes: '' }],
  });
  await mount(SessionView(w.id));
  await addGuest('Rae');
  chip('You').click();
  await settle();
  toggle().click();
  await settle();
  ok(/You/.test(where()) && /Set 1 of 2/.test(where()), `joint: starts on You, set 1 ("${where().trim()}")`);
  ok(/Next: Rae/.test(nextBtn().textContent), `button names the next person: "${nextBtn().textContent.trim()}"`);
  type(app().querySelector('.guide .step-value'), 155);
  nextBtn().click();
  await settle();
  ok(/Rae/.test(where()) && /Set 1 of 2/.test(where()), `→ Rae, set 1 ("${where().trim()}")`);
  ok(draft().forName === 'Rae', 'the runner\'s active person is Rae');
  type(app().querySelector('.guide .step-value'), 95);
  nextBtn().click();
  await settle();
  ok(/You/.test(where()) && /Set 2 of 2/.test(where()), `→ back to You, set 2 ("${where().trim()}")`);
  ok(entriesOf(null)[0].sets[0].weight === 155 && entriesOf('Rae')[0].sets[0].weight === 95,
     'each number landed on the right person');
  // Back hands the turn back to the person before.
  backBtn().click();
  await settle();
  ok(/Rae/.test(where()) && /Set 1 of 2/.test(where()) && draft().forName === 'Rae'
     && app().querySelector('.guide .step-value').value === '95', `Back → Rae, set 1, her 95 kept ("${where().trim()}")`);
  backBtn().click();
  await settle();
  ok(/You/.test(where()) && /Set 1 of 2/.test(where()) && draft().forName == null, 'Back again → You, set 1');
  nextBtn().click(); await settle();
  nextBtn().click(); await settle();
  ok(/You/.test(where()) && /Set 2 of 2/.test(where()), 'Next, Next → You, set 2 again');
  // A reload empties the trail: Back falls back to guide order (prevStep).
  await mount(SessionView(draft().workoutId));
  backBtn().click();
  await settle();
  ok(/Rae/.test(where()) && /Set 1 of 2/.test(where()), `after a reload Back still goes to Rae, set 1 ("${where().trim()}")`);
  nextBtn().click(); await settle();
  toggle().click();
  await settle();
  const pressed = [...app().querySelectorAll('.person-chip')].find((b) => b.getAttribute('aria-pressed') === 'true');
  ok(pressed && pressed.textContent.trim() === 'You' && openAt() === 1, 'Edit: the normal view on You, set 2 open');
  localStorage.removeItem(DRAFT);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
