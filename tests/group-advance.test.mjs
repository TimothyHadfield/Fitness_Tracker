// Finished hands the turn to the next person in a group workout (2026-09-27).
//
//   node tests/group-advance.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: *"Also, if you're in a group workout and you click finish for one set
// for one person, have it automatically go to the next person's details on
// their next set, makeing the alternating between the two people really easy."*
//
// Rules pinned here: the next person in pill order (You, then guests as added),
// wrapping; skip anybody with nothing left on this exercise; nobody left →
// today's behaviour (this person's next unfinished set); solo unchanged; Edit
// never switches; a number still in the box is kept; a superset hands over on
// the same member. Same harness as review-runnerA.test.mjs.
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
const { SessionView } = await import(BASE + 'views-session.js');
const draftMod = await import(BASE + 'session-draft.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
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
// Working sets only: suggested warm-ups sit above set 1 and never count.
const rows = () => [...app().querySelectorAll('.set-list .set-item:not(.set-warm)')];
const openAt = () => { const o = app().querySelector('.set-open'); return o ? rows().indexOf(o.closest('.set-item')) : -1; };
const who = () => {
  const c = [...app().querySelectorAll('.person-chip')].find((b) => b.getAttribute('aria-pressed') === 'true');
  return c ? c.textContent.trim() : null;
};
const chip = (name) => [...app().querySelectorAll('.person-chip')].find((b) => b.textContent.trim() === name);
const finishOpen = async (weight) => {
  type(app().querySelector('.set-open .step-value'), weight);
  await settle();
  const row = app().querySelector('.set-open').closest('.set-item');
  row.querySelector('.set-done-btn').click();
  await settle();
};
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
// The owner's entries and each guest's, whoever is on screen right now.
const entriesOf = (name) => {
  const d = draft();
  if ((d.forName ?? null) === name) return d.entries;
  return ((d.others || []).find((o) => (o.name ?? null) === name) || {}).entries;
};

/* ============ 0. the pure rule ============ */
{
  const { nextPersonTurn } = draftMod;
  ok(typeof nextPersonTurn === 'function', 'session-draft exports nextPersonTurn');
  if (typeof nextPersonTurn === 'function') {
    const ent = (id, doneFlags, extra = {}) => ({ exerciseId: id, sets: doneFlags.map((d) => (d ? { reps: 5, done: true } : { reps: 5 })), ...extra });
    const A = [{ entries: [ent('x', [true, false])] }, { entries: [ent('x', [false, false])] }];
    const t = nextPersonTurn(A, 0, 'x', 0);
    ok(t && t.pos === 1 && t.entryIndex === 0 && t.set === 0, 'two people: the other person, their first unfinished set');
    const B = [{ entries: [ent('x', [true, false])] }, { entries: [ent('x', [true, true])] }, { entries: [ent('x', [true, false])] }];
    const t2 = nextPersonTurn(B, 0, 'x', 0);
    ok(t2 && t2.pos === 2 && t2.set === 1, 'skips a person with nothing left on this exercise');
    const t3 = nextPersonTurn(B, 2, 'x', 0);
    ok(t3 && t3.pos === 0 && t3.set === 1, 'wraps round from the last pill to You');
    const C = [{ entries: [ent('x', [true, false])] }, { entries: [ent('x', [true, true])] }];
    ok(nextPersonTurn(C, 0, 'x', 0) === null, 'nobody else has a set left → null (the caller keeps today\'s behaviour)');
    ok(nextPersonTurn([{ entries: [ent('x', [false])] }], 0, 'x', 0) === null, 'solo → null');
    const D = [{ entries: [ent('y', [false]), ent('x', [true])] }, { entries: [ent('x', [false, false], { warmups: [{ reps: 8 }] })] }];
    const t4 = nextPersonTurn(D, 0, 'x', 1);
    ok(t4 && t4.pos === 1 && t4.entryIndex === 0 && t4.set === 0,
       'a different list ("Just for") finds their entry of the same exercise; warm-ups never count');
    const E = [{ entries: [ent('x', [true])] }, { entries: [ent('x', [true], { locked: false })] }];
    E[1].entries[0].sets[0] = { reps: 5, locked: true };
    ok(nextPersonTurn(E, 0, 'x', 0) === null, 'an old draft\'s `locked` counts as finished');
  }
}

/* ============ 1. two people: finish hands over, both ways, then stays ============ */
{
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({
    name: 'Alternate day',
    exercises: [{ exerciseId: byName('Pendlay Row').id, sets: 2, notes: '' }],
  });
  await mount(SessionView(w.id));
  await addGuest('Rae');
  chip('You').click();
  await settle();
  ok(who() === 'You' && openAt() === 0, 'setup: You, set 1 open');

  await finishOpen(155);
  ok(who() === 'Rae', '🚨 You finish set 1 → the runner is on Rae');
  ok(openAt() === 0, 'with Rae\'s set 1 open, ready to type');
  ok(entriesOf(null)[0].sets[0].done === true && !entriesOf('Rae')[0].sets[0].done,
     'You\'s set 1 is finished; Rae\'s is not (never broadcast)');

  await finishOpen(95);
  ok(who() === 'You' && openAt() === 1, '🚨 Rae finishes set 1 → back to You, on set 2');

  await finishOpen(160);
  ok(who() === 'Rae' && openAt() === 1, 'You finish set 2 → Rae\'s set 2');

  await finishOpen(100);
  ok(who() === 'Rae', 'Rae finishes the last set and nobody has one left → stays on Rae');
  ok(openAt() === -1, 'and nothing is open (every set of hers is finished)');
  ok(entriesOf(null)[0].sets[0].weight === 155 && entriesOf('Rae')[0].sets[0].weight === 95
     && entriesOf(null)[0].sets[1].weight === 160 && entriesOf('Rae')[0].sets[1].weight === 100,
     'every number landed on the right person');

  /* Edit never switches. */
  rows()[0].querySelector('.set-done-btn').click();
  await settle();
  ok(who() === 'Rae' && openAt() === 0, '⚠️ Edit reopens Rae\'s set 1 and does NOT switch people');

  /* A number still in the box (no blur yet — iOS keeps focus on a tapped
   * button) is committed before the handover, not lost. */
  const box = app().querySelector('.set-open .step-value');
  box.focus();
  box.value = '97';
  rows()[0].querySelector('.set-done-btn').click();
  await settle();
  ok(entriesOf('Rae')[0].sets[0].weight === 97, '⚠️ an unsaved number in the box is kept when Finished is tapped');
  ok(who() === 'Rae', 'and with nobody else left, it stays on Rae');
  localStorage.removeItem(DRAFT);
}

/* ============ 2. three people: skip somebody done, wrap ============ */
{
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({
    name: 'Three way day',
    exercises: [{ exerciseId: byName('Meadows Row').id, sets: 2, notes: '' }],
  });
  await mount(SessionView(w.id));
  await addGuest('Rae');
  await addGuest('Kai');
  // Kai has already finished both sets of this exercise.
  const d = draft();
  const kai = d.forName === 'Kai' ? d : d.others.find((o) => o.name === 'Kai');
  for (const s of kai.entries[0].sets) { s.weight = 50; s.reps = 10; delete s.prefilled; s.done = true; }
  localStorage.setItem(DRAFT, JSON.stringify(d));
  await mount(SessionView(w.id));
  chip('Rae').click();
  await settle();
  ok(who() === 'Rae' && openAt() === 0, 'setup: three people, on Rae, set 1 open');
  await finishOpen(80);
  ok(who() === 'You', '🚨 Rae finishes → Kai has nothing left, so it skips to You (wrapping round)');
  ok(openAt() === 0, 'You\'s set 1 open');
  await finishOpen(120);
  ok(who() === 'Rae' && openAt() === 1, 'You finish → Rae, on her set 2');
  localStorage.removeItem(DRAFT);
}

/* ============ 3. superset: the same member, the next person ============ */
{
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({
    name: 'Group superset',
    exercises: [
      { exerciseId: byName('Triceps Pushdown').id, sets: 2, notes: '', group: 0 },
      { exerciseId: byName('Overhead Cable Extension').id, sets: 2, notes: '', group: 0 },
    ],
  });
  await mount(SessionView(w.id));
  await addGuest('Rae');
  chip('You').click();
  await settle();
  const title = () => (app().querySelector('.session-ex-name') || {}).textContent || '';
  ok(/Triceps Pushdown/.test(title()), 'setup: superset, You on member A');
  await finishOpen(40);
  ok(who() === 'Rae', 'superset: You finish member A set 1 → Rae');
  ok(/Triceps Pushdown/.test(title()) && openAt() === 0, 'on the SAME member (A), her set 1');
  const d = draft();
  ok(d.index === 0, `her walk points at A round 1 (index ${d.index})`);
  localStorage.removeItem(DRAFT);
}

/* ============ 4. solo is unchanged ============ */
{
  localStorage.removeItem(DRAFT);
  const w = await store.saveWorkout({
    name: 'Solo finish',
    exercises: [{ exerciseId: byName('Pendlay Row').id, sets: 3, notes: '' }],
  });
  await mount(SessionView(w.id));
  ok(!app().querySelector('.person-chip[aria-pressed="true"]') || who() === 'You', 'setup: solo');
  await finishOpen(135);
  ok(openAt() === 1 && (draft().forName ?? null) === null, 'solo: Finished opens this person\'s next set, as before');
  localStorage.removeItem(DRAFT);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
