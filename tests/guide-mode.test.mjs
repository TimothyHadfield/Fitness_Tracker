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
  // 🔄 2026-09-27 review: the runner's own superset words — the step is a
  // round, and the button says "Straight into B" / "Round 2 of 2".
  const want = [
    'A Round 1 of 2 → Straight into B',
    'B Round 1 of 2 → Round 2 of 2',
    'A Round 2 of 2 → Straight into B',
    'B Round 2 of 2 → Next exercise',
    'C Set 1 of 1 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'superset: A1, B1, A2, B2, in the runner\'s words (warm-ups stay hidden in a superset)\n      ' + seq.join('\n      '));
}

{
  // A superset, two people: a person does their whole round, then hands over.
  const mk = () => [ent('a', Sx(2), { group: 1 }), ent('b', Sx(2), { group: 1 })];
  const d = { forName: null, guestNames: ['Rae'], index: 0, entries: mk(), others: [{ name: 'Rae', index: 0, entries: mk() }] };
  const seq = walk(d, G.startStep(d)).map(fmt);
  const want = [
    'You A Round 1 of 2 → Straight into B',
    'You B Round 1 of 2 → Next: Rae',
    'Rae A Round 1 of 2 → Straight into B',
    'Rae B Round 1 of 2 → Next: You',
    'You A Round 2 of 2 → Straight into B',
    'You B Round 2 of 2 → Next: Rae',
    'Rae A Round 2 of 2 → Straight into B',
    'Rae B Round 2 of 2 → Finish workout',
  ];
  ok(JSON.stringify(seq) === JSON.stringify(want), 'superset with two people: a whole round each, then swap\n      ' + seq.join('\n      '));
}

{
  // A blank set cannot be marked done.
  const d = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', [{ weight: 0, reps: 0 }, { weight: 100, reps: 10, prefilled: true },
      { weight: 100, reps: 10, prefilled: true, fromPlan: true }])] };
  ok(G.markDone(d, { name: null, entryIndex: 0, kind: 'set', index: 0 }) === false && !d.entries[0].sets[0].done,
     'a blank set is refused, and nothing changes');
  // 🔄 2026-09-27 review: the runner's Finished rule (`setIsRecorded`). A
  // number the app only worked out is refused, exactly as Finished is hidden
  // on it; the plan's numbers pass, as they do there.
  ok(G.markDone(d, { name: null, entryIndex: 0, kind: 'set', index: 1 }) === false
     && !d.entries[0].sets[1].done && d.entries[0].sets[1].prefilled === true,
     'Next under an app-worked-out number is refused (the runner\'s Finished rule)');
  ok(G.markDone(d, { name: null, entryIndex: 0, kind: 'set', index: 2 }) === true
     && d.entries[0].sets[2].done === true && !('prefilled' in d.entries[0].sets[2]),
     'Next under the PLAN\'s numbers accepts them: done, and no longer `prefilled`');
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

/* ============ 0c. the 2026-09-27 review (pure) ============
 * Tim: "could you analyze the auto-guide system and really think if we're
 * missing anything there?" — each block names the review item it pins. */
{
  const allDone = (d) => [d.entries, ...(d.others || []).map((o) => o.entries)]
    .every((es) => es.every((e) => e.sets.every((s) => s.done)));
  const one = (id) => ent(id, Sx(1));
  // 5. "Just for": a different exercise list per person — everybody's work is visited.
  const d1 = { forName: null, guestNames: ['Rae'], index: 0, entries: [one('a'), one('b')],
    others: [{ name: 'Rae', index: 0, entries: [one('a'), one('c')] }] };
  const s1 = walk(d1, G.startStep(d1)).map(fmt);
  ok(allDone(d1), 'Just for: You [A,B] / Rae [A,C] — every set on both lists is walked\n      ' + s1.join('\n      '));
  const d2 = { forName: null, guestNames: ['Rae'], index: 0, entries: [one('a'), one('b'), one('a')],
    others: [{ name: 'Rae', index: 0, entries: [one('b'), one('a'), one('a')] }] };
  const s2 = walk(d2, G.startStep(d2)).map(fmt);
  ok(allDone(d2), 'Just for: You [A,B,A] / Rae [B,A,A] — every set on both lists is walked\n      ' + s2.join('\n      '));
  const d3 = { forName: null, guestNames: ['Rae'], index: 0, entries: [one('a')],
    others: [{ name: 'Rae', index: 0, entries: [one('a'), ent('c', Sx(2))] }] };
  walk(d3, G.startStep(d3));
  ok(allDone(d3), 'Just for: Rae has an exercise You do not — it is still walked');

  // 6. Unfinished work BEFORE where the guide opened is visited before Finish.
  const d4 = { forName: null, guestNames: [], others: [], index: 1, entries: [ent('a', Sx(1)), ent('b', Sx(2))] };
  const s4 = walk(d4, G.startStep(d4)).map(fmt);
  ok(allDone(d4) && /^B /.test(s4[0]) && /Finish workout/.test(s4[s4.length - 1]),
     'opened on exercise 2: its sets, then back to exercise 1, then Finish\n      ' + s4.join('\n      '));

  // 7. A drop set: each planned drop is its own step, in the runner's words.
  const d5 = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', Sx(2), { setType: 'drop', plannedMinis: 2 })] };
  const s5 = walk(d5, G.startStep(d5)).map(fmt);
  const want5 = [
    'A Set 1 of 2 → Strip the weight',
    'A Drop 1 of 2 → Drop again',
    'A Drop 2 of 2 → Next set',
    'A Set 2 of 2 → Strip the weight',
    'A Drop 1 of 2 → Drop again',
    'A Drop 2 of 2 → Finish workout',
  ];
  ok(JSON.stringify(s5) === JSON.stringify(want5), 'drop set: set, Drop 1 of 2, Drop 2 of 2 — one step each\n      ' + s5.join('\n      '));
  ok(d5.entries[0].sets.every((s) => s.done && Array.isArray(s.minis) && s.minis.length === 2),
     'each set is Finished with its last drop, and both drops are its own `minis` rows');
  const items5 = G.blockItems([ent('a', Sx(1), { setType: 'drop', plannedMinis: 2 })], 0);
  ok(items5.map((x) => x.turnEnd).join() === 'false,false,true',
     'the turn (and so the rest) ends on the last drop, not the top set');
  const d6 = { forName: null, guestNames: [], others: [], index: 0,
    entries: [ent('a', Sx(1), { setType: 'myo', plannedMinis: 2 })] };
  const s6 = walk(d6, G.startStep(d6)).map(fmt);
  ok(JSON.stringify(s6) === JSON.stringify([
    'A Set 1 of 1 → Rest 10–15 seconds', 'A Mini-set 1 of 2 → Another mini-set', 'A Mini-set 2 of 2 → Finish workout']),
  'myo-reps: the mini-sets, in the runner\'s words\n      ' + s6.join('\n      '));

  // 10. Everything done: there is still a last step to go Back to.
  const d7 = { forName: null, guestNames: [], others: [], index: 0, entries: [ent('a', Sx(2)), ent('b', Sx(1))] };
  walk(d7, G.startStep(d7));
  const last = typeof G.lastStep === 'function' ? G.lastStep(d7) : null;
  ok(G.startStep(d7) === null && last && last.entryIndex === 1 && last.kind === 'set' && last.index === 0,
     'all done: nothing to start on, and lastStep() is the last set walked');
}

/* ============ 1+. the real runner ============ */
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
// Next ignores a second tap within NEXT_GUARD_MS of the last (2026-09-27), so
// the clock moves on half a second with every settle(): a test's taps are
// separate taps. A double tap is two clicks with no settle between them.
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const settle = () => new Promise((r) => setTimeout(() => { skew += 450; r(); }, 30));
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

/* The two captions (2026-09-27, Tim: "the % of 1RM and estimated number of
 * reps should also be shown in the auto-guide") — the runner's own, word for
 * word, and none on a warm-up. */
{
  localStorage.removeItem(DRAFT);
  const bench = byName('Barbell Bench Press');
  await store.saveSession({
    workoutName: 'Earlier', date: '2026-09-01', startedAt: '2026-09-01T18:00:00.000Z',
    finishedAt: '2026-09-01T19:00:00.000Z', isBenchmark: false,
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 185, reps: 5 }] }],
  });
  const w = await store.saveWorkout({ name: 'Caption day', exercises: [{ exerciseId: bench.id, sets: 2, notes: '' }] });
  await mount(SessionView(w.id));
  toggle().click();
  await settle(); await settle();
  const caps = () => [...app().querySelectorAll('.guide .step-est')].map((n) => n.textContent.trim());
  if (/Warm-up/i.test(where())) {
    ok(caps().every((t) => t === ''), `no "% of max" or "to failure" on a warm-up (${JSON.stringify(caps())})`);
  }
  for (let g = 0; g < 8 && !/Set 1 of 2/.test(where()); g++) { nextBtn().click(); await settle(); }
  ok(/Set 1 of 2/.test(where()), `reached set 1 ("${where().trim()}")`);
  type(app().querySelector('.guide .step-value'), 175);
  await settle(); await settle();
  const [wCap, rCap] = caps();
  ok(/^\d+% of your estimated max/.test(wCap || ''), `the weight shows its % of max ("${wCap}")`);
  ok(/^maybe \d+(–\d+)?\+? to failure/.test(rCap || ''), `the reps show the estimate to failure ("${rCap}")`);
  type(app().querySelector('.guide .step-value'), 135);
  await settle();
  const [wCap2, rCap2] = caps();
  ok(wCap2 !== wCap && rCap2 !== rCap, `a new weight moves both lines ("${wCap2}" / "${rCap2}")`);
  // Edit: the runner's pane says exactly the same about the same set.
  toggle().click();
  await settle(); await settle();
  const paneCaps = [...app().querySelectorAll('.pane-scroll .step-est')].map((n) => n.textContent.trim());
  ok(paneCaps[0] === wCap2 && paneCaps[1] === rCap2, `the normal view agrees (${JSON.stringify(paneCaps)})`);
  localStorage.removeItem(DRAFT);
}

/* ============ 3. the 2026-09-27 review, in the real runner ============
 * Tim: "could you analyze the auto-guide system and really think if we're
 * missing anything there?" The guide must do what the normal runner does. */
const val = (i = 0) => app().querySelectorAll('.guide .step-value')[i];
// Type into box i if it is there — a missing box fails the check after it
// rather than stopping the file (so every check runs on the unfixed code too).
const put = (i, v) => { const n = val(i); if (n) type(n, v); };
// Same for the two buttons: gone (the save screen opened early) is a failed
// check, not a crash. Each block below shadows nextBtn / backBtn with these.
const GONE = { click() {}, textContent: '', disabled: true };
const safeNext = () => app().querySelector('.guide-next') || GONE;
const safeBack = () => app().querySelector('.guide-back') || GONE;
const noteText = () => {
  const n = app().querySelector('.guide-note');
  return n && !n.hidden ? n.textContent : '';
};
const exText = () => (app().querySelector('.guide-ex') || {}).textContent || '';
const onSave = () => /Save workout/.test((app().querySelector('.topbar h1') || {}).textContent || '');
/** Next until `re` matches the step, putting numbers in on the way. */
async function walkTo(re, w = 100, r = 5) {
  for (let g = 0; g < 16 && !re.test(`${exText()} ${where()}`) && !onSave(); g++) {
    if (!/Warm-up/.test(where())) { put(0, w); put(1, r); }
    safeNext().click(); await settle();
  }
  return re.test(`${exText()} ${where()}`);
}
const { MANIFEST } = await import(BASE + 'exercise-images.js');
const GM = await import(BASE + 'guide-mode.js');

/* 1, 13, 15, 16, 19: warm-ups on EVERY exercise, and the pane's lines. */
{
  const nextBtn = safeNext;
  localStorage.removeItem(DRAFT);
  const squat = byName('Back Squat'), dl = byName('Deadlift');
  await store.saveSession({
    workoutName: 'Earlier legs', date: '2026-09-02', startedAt: '2026-09-02T18:00:00.000Z',
    finishedAt: '2026-09-02T19:00:00.000Z', isBenchmark: false,
    entries: [
      { exerciseId: squat.id, exerciseName: squat.name, sets: [{ weight: 225, reps: 5 }] },
      { exerciseId: dl.id, exerciseName: dl.name, sets: [{ weight: 315, reps: 5 }] },
    ],
  });
  const w = await store.saveWorkout({ name: 'Warm day', exercises: [
    { exerciseId: squat.id, sets: 1, notes: 'Brace hard' },
    { exerciseId: dl.id, sets: 1, notes: '' },
  ] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  ok(/Warm-up 1 of/.test(where()) && exText() === 'Back Squat', `opens on Back Squat's first warm-up ("${where().trim()}")`);
  ok(/Brace hard/.test(noteText()), `13. the coach's note is under the name ("${noteText()}")`);
  ok(/Last time: 225/.test(noteText()), '15. "Last time" is there');
  ok(/Dynamic stretch/.test(noteText()), '19. the dynamic stretch line is on the first warm-up');
  const prog = app().querySelector('.session-progress');
  ok(prog && !prog.hidden && prog.querySelector('.current'), '16. the thin workout progress bar stays on show');
  nextBtn().click(); await settle();
  ok(/Warm-up 2 of/.test(where()) && !/Dynamic stretch/.test(noteText()), '19. …and only on the first warm-up');
  const seen = [];
  for (let g = 0; g < 12 && exText() !== 'Deadlift' && !onSave(); g++) { nextBtn().click(); await settle(); }
  seen.push(`${exText()} ${where().trim()}`);
  ok(exText() === 'Deadlift' && /Warm-up 1 of/.test(where()),
     `1. the SECOND exercise opens on its warm-ups too ("${seen[0]}")`);
  ok(!/Brace hard/.test(noteText()), '13. the note belongs to its own exercise');
  localStorage.removeItem(DRAFT);
}

/* 2, 19: a number the app only guessed is refused; "No opening weight". */
{
  const nextBtn = safeNext;
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({ name: 'Press day', exercises: [{ exerciseId: byName('Leg Press').id, sets: 2, notes: '' }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  await walkTo(/Set 1 of 2/);
  ok(/No opening weight/.test(noteText()), `19. "No opening weight — …" is in the note slot ("${noteText()}")`);
  const before = JSON.stringify(entriesOf(null)[0].sets[0]);
  nextBtn().click(); await settle();
  ok(/Set 1 of 2/.test(where()) && !entriesOf(null)[0].sets[0].done,
     `2. Next on numbers nobody typed is refused, like Finished (${before} → still "${where().trim()}")`);
  put(0,200); put(1,10);
  nextBtn().click(); await settle();
  ok(/Set 2 of 2/.test(where()) && entriesOf(null)[0].sets[0].done === true, '2. with a number in, Next goes on');
  localStorage.removeItem(DRAFT);
}

/* 14: the plan's sentence. (Bench has 185 × 5 on 2026-09-01, above.) */
{
  const nextBtn = safeNext;
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({ name: 'Plan day', exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 3, targets: [70, 80, 90] }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  ok(/Plan: 70\/80\/90 %/.test(noteText()), `14. the plan's line is there ("${noteText()}")`);
  await walkTo(/Set 1 of 3/);
  nextBtn().click(); await settle();
  ok(/Set 2 of 3/.test(where()), '2. the plan\'s own numbers pass Next untouched (as they pass Finished)');
  localStorage.removeItem(DRAFT);
}

/* 4: in a joint workout no warm-up is kept that nobody walked. */
{
  const nextBtn = safeNext;
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({ name: 'Pair RDL', exercises: [{ exerciseId: byName('Romanian Deadlift').id, sets: 2, notes: '' }] });
  await mount(SessionView(w.id));
  await addGuest('Rae');
  chip('You').click(); await settle();
  toggle().click(); await settle();
  const seq = [];
  for (let g = 0; g < 20 && !onSave(); g++) {
    seq.push(where().trim());
    if (!/Warm-up/.test(where())) { put(0,/Rae/.test(where()) ? 135 : 225); put(1,5); }
    nextBtn().click(); await settle(); await settle();
  }
  const unseen = [null, 'Rae'].flatMap((n) => ((entriesOf(n) || [])[0].warmups || [])
    .filter((x) => (Number(x.weight) > 0 || Number(x.reps) > 0) && !x.done).map((x) => `${n || 'You'} ${x.weight}×${x.reps}`));
  ok(onSave() && unseen.length === 0, `4. no warm-up with numbers is left that the guide never showed (${JSON.stringify(unseen)})\n      ${seq.join(' → ')}`);
  localStorage.removeItem(DRAFT);
}

/* 7: a drop set in the guide — each drop a step, rest after the last. */
{
  const nextBtn = safeNext;
  localStorage.removeItem(DRAFT);
  await store.saveSettings({ restTimer: true, restTarget: 90 });
  const w = await store.saveWorkout({ name: 'Drop day', exercises: [{ exerciseId: byName('Barbell Curl').id, sets: 2, notes: '', setType: 'drop', minis: 2 }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  await walkTo(/Set 1 of 2/);
  put(0,60); put(1,10);
  ok(/Strip the weight/.test(nextBtn().textContent), `7. the button before a drop: "${nextBtn().textContent.trim()}"`);
  nextBtn().click(); await settle();
  ok(/Drop 1 of 2/.test(where()), `7. → "Drop 1 of 2" ("${where().trim()}")`);
  ok(!draft().restStartedAt && !entriesOf(null)[0].sets[0].done, '7. no rest yet, and the set is not Finished before its drops');
  ok(/Drop again/.test(nextBtn().textContent), `7. then "${nextBtn().textContent.trim()}"`);
  put(0,40);
  nextBtn().click(); await settle();
  ok(/Drop 2 of 2/.test(where()) && /Next set/.test(nextBtn().textContent), '7. → "Drop 2 of 2", then "Next set"');
  put(0,25);
  nextBtn().click(); await settle();
  const s0 = entriesOf(null)[0].sets[0];
  ok(/Set 2 of 2/.test(where()) && s0.done === true && (s0.minis || []).map((m) => m.weight).join() === '40,25',
     `7. the set is Finished with its drops as its own minis (${JSON.stringify(s0.minis)})`);
  ok(draft().restStartedAt > 0, '7. rest starts after the last drop');
  await store.saveSettings({ restTimer: false });
  localStorage.removeItem(DRAFT);
}

/* 8, 9, 20: the rest timer and a double tap. */
{
  const nextBtn = safeNext, backBtn = safeBack;
  localStorage.removeItem(DRAFT);
  await store.saveSettings({ restTimer: true, restTarget: 90 });
  const w = await store.saveWorkout({ name: 'Rest day', exercises: [{ exerciseId: byName('Pendlay Row').id, sets: 3, notes: '' }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  await walkTo(/Set 1 of 3/);
  const rb = app().querySelector('.guide .rest-bar');
  ok(rb && rb.nextElementSibling === app().querySelector('.guide-footer'), '20. the rest bar sits right above Back / Next');
  put(0,135); put(1,5);
  nextBtn().click(); await settle();
  const r1 = draft().restStartedAt;
  ok(/Set 2 of 3/.test(where()) && r1 > 0, 'rest starts after set 1');
  backBtn().click(); await settle();
  nextBtn().click(); await settle();
  ok(/Set 2 of 3/.test(where()) && draft().restStartedAt === r1, '8. Back → Next over a finished set does not restart the rest');
  put(0,135); put(1,5);
  nextBtn().click(); nextBtn().click();
  await settle();
  ok(/Set 3 of 3/.test(where()) && !entriesOf(null)[0].sets[2].done, `9. a double tap on Next finishes one set, not two ("${where().trim()}")`);
  toggle().click(); await settle();
  const home = app().querySelector('.screen > .rest-bar');
  ok(home && !app().querySelector('.guide .rest-bar'), '20. Edit: the rest bar is back in the normal view\'s place');
  await store.saveSettings({ restTimer: false });
  localStorage.removeItem(DRAFT);
}

/* 10: everything done — Back still goes somewhere. */
{
  const backBtn = safeBack;
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({ name: 'Done day', exercises: [{ exerciseId: byName('Pendlay Row').id, sets: 1, notes: '' }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  await walkTo(/Set 1 of 1/);
  put(0,135); put(1,5);
  const d = draft();
  d.entries[0].sets.forEach((s) => { s.done = true; });
  (d.entries[0].warmups || []).forEach((x) => { x.done = true; });
  localStorage.setItem(DRAFT, JSON.stringify(d));
  await mount(SessionView(w.id));
  ok(exText() === 'Nothing left to do' && !backBtn().disabled, `10. "Nothing left to do" with Back enabled (disabled=${backBtn().disabled})`);
  backBtn().click(); await settle();
  ok(/Set 1 of 1/.test(where()), `10. Back → the last set ("${where().trim()}")`);
  localStorage.removeItem(DRAFT);
}

/* 3, 11, 18: a long number fits, a typo hides the bar, the name opens the picture. */
{
  localStorage.removeItem(DRAFT);
  const bench = byName('Barbell Bench Press');
  MANIFEST[bench.id] = 'webp';
  const w = await store.saveWorkout({ name: 'Box day', exercises: [{ exerciseId: bench.id, sets: 2, notes: '' }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle(); await settle();
  ok(Boolean(app().querySelector('.guide-name .ex-label-btn')), '18. the name is the button that opens its picture');
  await walkTo(/Set 1 of 2/);
  await settle(); await settle();
  const barNode = () => app().querySelector('.guide .guide-bar') || { hidden: 'gone' };
  put(0, 2250); await settle(); await settle();
  ok(Boolean(app().querySelector('.guide .typo-warn')), 'setup: 2250 raises the typo warning');
  ok(barNode().hidden === true, '11. and the big bar is hidden, not a wall of plates');
  put(0, 185); await settle();
  ok(barNode().hidden === false, '11. a real number brings the bar back');
  const cls = () => (val(0) ? val(0).className : 'no box');
  put(0, 1102.5); await settle();
  ok(val(0) && val(0).value === '1102.5' && /fit-xs/.test(cls()), `3. "1102.5" gets the smallest box font (${cls()})`);
  put(0, 1000); await settle();
  ok(/fit-md/.test(cls()) && !/fit-(sm|xs)/.test(cls()), '3. "1000" a size down');
  put(0, 185); await settle();
  ok(!/fit-|no box/.test(cls()), '3. "185" at full size');
  ok(typeof GM.boxFit === 'function' && GM.boxFit('1102.5') === 'fit-xs' && GM.boxFit('187.5') === 'fit-sm'
     && GM.boxFit('99.5') === 'fit-md' && GM.boxFit('225') === '',
     '3. boxFit() by character count (the sizes themselves are measured in WebKit, not here)');
  delete MANIFEST[bench.id];
  localStorage.removeItem(DRAFT);
}

/* 17: the assisted-lift line, and its warning. */
{
  localStorage.removeItem(DRAFT);
  const { todayISO: today } = await import(BASE + 'store.js');
  await store.logBodyWeight(180, today());
  const w = await store.saveWorkout({ name: 'Assist guide', exercises: [{ exerciseId: byName('Assisted Pull-Up').id, sets: 2, notes: '' }] });
  await mount(SessionView(w.id));
  toggle().click(); await settle();
  await walkTo(/Set 1 of 2/, 70, 8);
  put(0,70); await settle();
  const line = () => { const n = app().querySelector('.guide .assist-readout'); return n && !n.hidden ? n.textContent : ''; };
  ok(/110/.test(line()) && /70 of help|70 lbs of help/.test(line()), `17. the assist line: "${line()}"`);
  put(0,250); await settle();
  ok(/more help than you weigh/.test(line()), `17. and its warning: "${line()}"`);
  localStorage.removeItem(DRAFT);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
