// Record / runner decisions from the 2026-09-24 review picks.
//
//   node tests/review2-record.test.mjs      (needs jsdom, like render.test.mjs)
//
// Each block was seen FAILING against the code before it, then passing.
// Same harness as review-runnerA.test.mjs.
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
const { SessionView, ActivityLogView } = await import(BASE + 'views-session.js');
const { EditSessionView } = await import(BASE + 'views-edit-session.js');
const { StartPickerView } = await import(BASE + 'views-workouts.js');
const { loadDraft, clearDraft } = await import(BASE + 'session-draft.js');
const { parseTime, stepper } = await import(BASE + 'ui.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
const findBtn = (re, root = app()) => [...root.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}

/* ============ 1. "Save Legs first" on the open-workout screen ============ */
{
  clearDraft();
  await store.clearAll();
  const bench = byName('Barbell Bench Press').id;
  const squat = byName('Back Squat').id;
  const legs = await store.saveWorkout({ name: 'Legs', exercises: [{ exerciseId: squat, sets: 2, notes: '' }] });
  const push = await store.saveWorkout({ name: 'Push', exercises: [{ exerciseId: bench, sets: 2, notes: '' }] });

  const run = await mount(SessionView(legs.id));
  type(run.querySelectorAll('.step-value')[0], 225); await settle();
  type(run.querySelectorAll('.step-value')[1], 5); await settle();

  const clash = await mount(SessionView(push.id));
  ok(/Legs is still open/.test(clash.textContent), '(guard) the conflict screen is up');
  const saveFirst = findBtn(/^Save Legs first$/, clash);
  ok(Boolean(saveFirst), 'the conflict screen offers "Save Legs first"');
  ok(saveFirst && !saveFirst.closest('.pane-bottom'),
     'it sits with Discard, not in the footer where Back to Legs is');
  if (saveFirst) saveFirst.click();
  await settle();
  ok(location.hash === '#/session/' + legs.id, `it goes to the Legs workout (${location.hash})`);

  // The router would now mount the Legs session; it must open on its save screen.
  const saveScr = await mount(SessionView(legs.id));
  ok(Boolean(saveScr.querySelector('.save-dur')) && Boolean(findBtn(/^Save workout$/)),
     'and that opens straight on Legs\' save screen');
  ok((loadDraft() || {}).workoutId === legs.id, 'with Legs\' draft untouched');
  const saveBtn = findBtn(/^Save workout$/);
  if (saveBtn) saveBtn.click();
  await settle(); await settle();
  const saved = await store.getSessions();
  ok(saved.length === 1 && saved[0].workoutName === 'Legs', 'saving it writes the Legs session');
  ok(!loadDraft(), 'and clears the draft');
  const fresh = await mount(SessionView(push.id));
  ok(Boolean(fresh.querySelector('.set-list')) && !/still open/.test(fresh.textContent),
     'so Push now starts with no question');

  // The request is used once: a later open of the runner is the runner.
  await mount(SessionView(legs.id));
  ok(!app().querySelector('.save-dur'), 'opening a workout later lands in the runner, not on Save');
  clearDraft();
}

/* ============ 2. #/start says Resume for the open workout ============ */
{
  clearDraft();
  await store.clearAll();
  const bench = byName('Barbell Bench Press').id;
  const squat = byName('Back Squat').id;
  const legs = await store.saveWorkout({ name: 'Legs', exercises: [{ exerciseId: squat, sets: 2, notes: '' }] });
  await store.saveWorkout({ name: 'Push', exercises: [{ exerciseId: bench, sets: 2, notes: '' }] });

  const before = await mount(StartPickerView());
  const labelsBefore = [...before.querySelectorAll('.row-start')].map((n) => n.textContent.trim());
  ok(labelsBefore.length === 2 && labelsBefore.every((t) => t === 'Start'),
     `(guard) with nothing open every row says Start (${labelsBefore.join(', ')})`);

  const run = await mount(SessionView(legs.id));
  type(run.querySelectorAll('.step-value')[0], 225); await settle();
  const pick = await mount(StartPickerView());
  const rowOf = (name) => [...pick.querySelectorAll('.row')]
    .find((r) => r.querySelector('.row-title') && r.querySelector('.row-title').textContent === name);
  const legsLabel = rowOf('Legs') && rowOf('Legs').querySelector('.row-start').textContent.trim();
  const pushLabel = rowOf('Push') && rowOf('Push').querySelector('.row-start').textContent.trim();
  ok(legsLabel === 'Resume', `the open workout's row says Resume (${legsLabel})`);
  ok(pushLabel === 'Start', `the other still says Start (${pushLabel})`);

  // The suggestion is Legs here (nothing recorded yet → first in rotation).
  const sugBtn = pick.querySelector('.btn.primary.lg');
  ok(sugBtn && /Legs/.test(sugBtn.textContent), '(guard) the suggestion is the open workout');
  ok(sugBtn && /^Resume Legs$/.test(sugBtn.textContent.trim()),
     `and its button says Resume Legs (${sugBtn && sugBtn.textContent.trim()})`);
  ok(!/Next in your rotation/.test(pick.textContent),
     'and it no longer reads as the next fresh start');
  clearDraft();
}

/* ============ 3. activity time: a bare number is minutes ============ */
{
  ok(parseTime('30', { bareMinutes: true }) === 1800, `"30" on a duration is 30 min (${parseTime('30', { bareMinutes: true })})`);
  ok(parseTime('1:05:00', { bareMinutes: true }) === 3900, `"1:05:00" is an hour and five (${parseTime('1:05:00', { bareMinutes: true })})`);
  ok(parseTime('1:05:00') === 3900, 'h:mm:ss reads the same on a set too');
  ok(parseTime('25:30', { bareMinutes: true }) === 1530, '"25:30" is m:ss');
  ok(parseTime('45') === 45, 'a set-level hold still reads a bare number as seconds');
  ok(parseTime('1:30') === 90, 'and m:ss on a set is unchanged');

  clearDraft();
  await store.clearAll();
  const scr = await mount(ActivityLogView('Running'));
  const time = [...scr.querySelectorAll('.stepper')].find((s) => /Time/.test(s.textContent));
  ok(Boolean(time), '(guard) the Running screen has a time stepper');
  const input = time && time.querySelector('.step-value');
  ok(input && input.getAttribute('inputmode') === 'text',
     `its keyboard can type a colon (inputmode ${input && input.getAttribute('inputmode')})`);
  input.dispatchEvent(new window.Event('focus'));
  type(input, '30');
  ok(input.value === '30:00', `typing 30 reads 30:00 (${input.value})`);
  // Focus then blur untouched must not turn 30:00 into 30 hours.
  input.dispatchEvent(new window.Event('focus'));
  input.dispatchEvent(new window.Event('blur'));
  ok(input.value === '30:00', `and focusing it again changes nothing (${input.value})`);
  time.querySelectorAll('.step-btn')[1].dispatchEvent(new window.Event('pointerdown'));
  time.querySelectorAll('.step-btn')[1].dispatchEvent(new window.Event('pointerup'));
  ok(input.value === '31:00', `+ steps one minute (${input.value})`);
  ok(/1 min steps/.test(time && time.textContent), 'and the hint says so');
  type(input, '1:05:00');
  ok(input.value === '1:05:00', `an hour and five reads back as typed (${input.value})`);

  // A timed hold in a workout (plank) keeps seconds.
  const hold = stepper({ field: 'time', value: 30, onChange: () => {} });
  const hi = hold.node.querySelector('.step-value');
  hi.dispatchEvent(new window.Event('focus'));
  type(hi, '45');
  ok(hi.value === '45s', `a set's 45 is still 45 seconds (${hi.value})`);
  ok(/10 sec steps/.test(hold.node.textContent), 'with 10 sec steps');
}

/* ============ 4. edit screen: fix a saved workout's length ============ */
{
  await store.clearAll();
  const bench = byName('Barbell Bench Press');
  const startedAt = '2026-09-20T17:00:00.000Z';
  const rec = await store.saveSession({
    workoutId: 'w', workoutName: 'Long one', date: '2026-09-20',
    startedAt, finishedAt: '2026-09-20T20:30:00.000Z',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 185, reps: 5 }] }],
  });
  await mount(EditSessionView(rec.id));
  const box = app().querySelector('input[aria-label="Workout length in minutes"]');
  ok(Boolean(box), 'the Edit screen has a minutes box');
  ok(box && box.value === '210', `prefilled from the record (${box && box.value})`);
  if (box) {
    box.value = '6000';
    box.dispatchEvent(new window.Event('input', { bubbles: true }));
    ok(box.value === '600', `clamped to 600 (${box.value})`);
    box.value = '55';
    box.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  findBtn(/Save changes/).click();
  await settle(); await settle();
  const s = await store.getSession(rec.id);
  const mins = (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000;
  ok(mins === 55 && s.startedAt === startedAt, `saved as startedAt + 55 min (${mins})`);

  // Untouched, the record's own end is kept to the millisecond.
  const rec2 = await store.saveSession({
    workoutId: 'w', workoutName: 'Kept', date: '2026-09-21',
    startedAt, finishedAt: '2026-09-20T17:47:31.123Z',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 185, reps: 5 }] }],
  });
  await mount(EditSessionView(rec2.id));
  findBtn(/Save changes/).click();
  await settle(); await settle();
  ok((await store.getSession(rec2.id)).finishedAt === '2026-09-20T17:47:31.123Z',
     'an untouched box leaves finishedAt alone');

  // A record with no start time (old rows) gets no box.
  const rec3 = await store.saveSession({
    workoutId: 'w', workoutName: 'Old', date: '2026-09-19',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 185, reps: 5 }] }],
  });
  const got3 = await store.getSession(rec3.id);
  await mount(EditSessionView(rec3.id));
  const box3 = app().querySelector('input[aria-label="Workout length in minutes"]');
  ok(typeof got3.startedAt === 'string' ? Boolean(box3) : !box3,
     'no start time, no box (there is nothing to add minutes to)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
