// Overhaul 2026-09-27, builder WORKOUTS: the Record/Start/Workouts/Home/card
// changes (systems S-01 S-02 S-04 S-11, interaction I-6 I-9 I-14 I-16 I-17,
// screens S-7 S-8, the Empty workout row). Same jsdom harness as render.test.
//
//   node tests/workouts-overhaul.test.mjs
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
const { store, social } = await import(BASE + 'store.js');
const NW = await import(BASE + 'next-workout.js');
const WC = await import(BASE + 'workout-card.js');
const VW = await import(BASE + 'views-workouts.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = () => new Promise((r) => setTimeout(r, 30));
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
async function mount(viewPromise) {
  const node = await viewPromise;
  document.getElementById('app').replaceChildren(node);
  await settle();
  return node;
}
const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const isoDaysAgo = (d) => {
  const t = new Date(); t.setDate(t.getDate() - d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/* ============ S-02: one short fact under the suggestion ============ */
{
  const d = NW.describeSuggestion;
  ok(d({ nextNeverDone: true, system: { name: 'PPL' } }) === 'Not done yet.',
     `S-02 never-done reads "Not done yet." (${d({ nextNeverDone: true, system: { name: 'PPL' } })})`);
  const four = d({ nextNeverDone: false, nextDaysSince: 4, lastName: 'Push', daysSince: 1 });
  ok(/^Last done 4 days ago\.$/.test(four), `S-02 reads "Last done 4 days ago." (${four})`);
  ok(four.split(/\s+/).length < 15, 'S-02 under 15 words');
  ok(/First workout in PPL/.test(d({ isStart: true, system: { name: 'PPL' } })), 'S-02 keeps the start line');
}

/* ============ S-11: a run logged on its own ticks off a cardio day ============ */
{
  const run = byName('Running');
  const bench = byName('Barbell Bench Press');
  ok(run && bench, 'fixture exercises exist (a non-rep one and a lifting one)');
  const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
  const systems = [{ id: 's1', name: 'Hybrid' }];
  const workouts = [
    { id: 'w1', systemId: 's1', name: 'Lift', exercises: [{ exerciseId: bench.id, sets: 3 }] },
    { id: 'w2', systemId: 's1', name: 'Conditioning', exercises: [{ exerciseId: run.id, sets: 1 }] },
  ];
  const today = isoDaysAgo(0);
  const sessions = [
    // The run went through Record → Run: no workoutId.
    { id: 'a', date: isoDaysAgo(1), entries: [{ exerciseId: run.id, sets: [{ time: 1800, distance: 5 }] }] },
    { id: 'b', date: isoDaysAgo(2), workoutId: 'w1', workoutName: 'Lift', entries: [] },
  ];
  const withMap = NW.suggestNext({ systems, workouts, sessions, today, exMap });
  ok(withMap && withMap.workout.id === 'w1',
     `S-11 with the exercise map, the loose run counts: next is Lift (${withMap && withMap.workout.name})`);
  const noMap = NW.suggestNext({ systems, workouts, sessions, today });
  ok(noMap && noMap.workout.id === 'w2', 'S-11 without the map nothing changes (Conditioning stays next)');
  // A lifting day is never ticked off by a loose row.
  const loose = [{ id: 'c', date: isoDaysAgo(1), entries: [{ exerciseId: bench.id, sets: [{ weight: 100, reps: 5 }] }] }];
  const s3 = NW.suggestNext({ systems, workouts, sessions: loose, today, exMap });
  ok(s3 && s3.isStart, 'S-11 a loose LIFTING session never counts toward a workout');
}

/* ============ SC-8: the heaviest set on each exercise row ============ */
{
  const e = { sets: [{ weight: 225, reps: 8 }, { weight: 245, reps: 3 }, { weight: 245, reps: 5 }, { weight: 0, reps: 20 }] };
  ok(JSON.stringify(WC.topSetOf(e)) === '{"weight":245,"reps":5}', 'SC-8 top set = heaviest, ties to more reps');
  ok(/^245 × 5$/.test(WC.topSetLabel(e)), `SC-8 label "245 × 5" (${WC.topSetLabel(e)})`);
  ok(WC.topSetLabel({ sets: [{ time: 60 }] }) === null, 'SC-8 no label on a set without weight');
  const card = WC.workoutCard({ id: 'x1', date: isoDaysAgo(0), name: 'Push',
    entries: [{ name: 'Bench Press', sets: e.sets }] });
  const top = card.querySelector('.feed-ex .feed-ex-top');
  ok(top && top.textContent === '245 × 5', 'SC-8 the card row carries .feed-ex-top');
}

/* ============ SC-7: your own card has no author row; paging by 20 ============ */
{
  const head = document.createElement('div'); head.className = 'feed-head';
  const a = { id: 'x2', date: isoDaysAgo(1), name: 'Legs', location: 'Home gym',
    entries: [{ name: 'Squat', sets: [{ weight: 100, reps: 5 }] }] };
  const mine = WC.workoutCard(a, { self: true, head });
  ok(!mine.querySelector('.feed-head') && mine.querySelector('.feed-self-meta'),
     'SC-7 self: no author row, the meta line leads instead');
  ok(/Yesterday/.test(txt(mine.querySelector('.feed-self-meta'))) && /Home gym/.test(txt(mine.querySelector('.feed-self-meta'))),
     'SC-7 self meta says when and where');
  const theirs = WC.workoutCard(a, { head });
  ok(theirs.querySelector('.feed-head'), 'SC-7 a friend card keeps its head');

  // No IntersectionObserver: draw everything (nothing lost).
  const list0 = document.createElement('div');
  WC.renderPaged(list0, Array.from({ length: 45 }, (_, i) => i), (i) => { const d = document.createElement('p'); d.textContent = i; return d; });
  ok(list0.querySelectorAll('p').length === 45, 'SC-7 without an observer every card draws');

  // A fake observer: page 1 is 20, each hit adds 20, the end removes the sentinel.
  let cb = null;
  globalThis.IntersectionObserver = class { constructor(f) { cb = f; } observe() {} unobserve() {} disconnect() {} };
  const list = document.createElement('div');
  const pg = WC.renderPaged(list, Array.from({ length: 45 }, (_, i) => i), (i) => { const d = document.createElement('p'); d.textContent = i; return d; });
  ok(list.querySelectorAll('p').length === 20 && list.querySelector('.feed-sentinel'), 'SC-7 first page is 20 with a sentinel');
  cb([{ isIntersecting: true }]);
  ok(list.querySelectorAll('p').length === 40 && list.lastElementChild.classList.contains('feed-sentinel'), 'SC-7 the sentinel adds 20 more, in order');
  cb([{ isIntersecting: true }]);
  ok(list.querySelectorAll('p').length === 45 && !list.querySelector('.feed-sentinel') && pg.shown() === 45,
     'SC-7 the last page ends the paging');
  ok(txt(list.children[44]) === '44', 'SC-7 order kept');
  delete globalThis.IntersectionObserver;
}

/* ============ I-16: count-ups only when the number changed ============ */
{
  WC.__resetShownForTest();
  const a = { id: 'rep1', date: isoDaysAgo(0), name: 'Pull', minutes: 45,
    entries: [{ name: 'Row', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }] };
  const first = WC.workoutCard(a);
  ok([...first.querySelectorAll('.feed-stat-value')].every((n) => !n.dataset.mSeen), 'I-16 first showing rolls (no data-m-seen)');
  const again = WC.workoutCard(a);
  ok([...again.querySelectorAll('.feed-stat-value')].length > 0
     && [...again.querySelectorAll('.feed-stat-value')].every((n) => n.dataset.mSeen === '1'),
     'I-16 the same numbers again are marked seen (drawn final)');
  const changed = WC.workoutCard({ ...a, entries: [{ name: 'Row', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }] });
  const sets = [...changed.querySelectorAll('.feed-stat')].find((n) => /Sets/.test(n.textContent));
  ok(sets && !sets.querySelector('.feed-stat-value').dataset.mSeen, 'I-16 a number that moved rolls again');
}

/* ============ I-14: the last feed, per account, for offline ============ */
{
  const entries = Array.from({ length: 25 }, (_, i) => ({
    uid: 'f1', name: 'Wes', avatar: null,
    act: { id: 'p' + i, date: isoDaysAgo(i), name: 'Push', photo: { w: 3, h: 4 },
      entries: [{ name: 'Bench Press', sets: [{ weight: 100, reps: 5 }] }] },
  }));
  VW.saveFeedCache({ uid: 'u-me', user: { email: 'me@example.com' } }, entries);
  localStorage.setItem('ftrack:v1:lastAccount', JSON.stringify({ email: 'me@example.com' }));
  const got = await VW.cachedFeedFor();
  ok(got && got.length === 20, `I-14 at most 20 cards are kept (${got && got.length})`);
  ok(got && got.every((e) => !e.act.photo), 'I-14 no photo size kept (no picture read offline)');
  localStorage.setItem('ftrack:v1:lastAccount', JSON.stringify({ email: 'someone.else@example.com' }));
  ok((await VW.cachedFeedFor()) === null, 'I-14 another account never sees this feed');
  localStorage.setItem('ftrack:v1:lastAccount', JSON.stringify({ email: 'me@example.com' }));

  const realState = social.state;
  social.state = async () => ({ available: false, reason: 'offline', user: null });
  const home = await mount(VW.HomeView());
  await settle();
  ok(/Offline — showing the last feed/.test(txt(home.querySelector('.feed-offline'))), 'I-14 offline Home says it is the last feed');
  ok(home.querySelectorAll('.feed-card').length === 20, `I-14 offline Home draws the saved cards (${home.querySelectorAll('.feed-card').length})`);
  const acts = [...home.querySelectorAll('.feed-card')][0].querySelectorAll('.feed-act');
  ok(acts.length === 3 && acts[0].disabled && acts[1].disabled && !acts[2].disabled, 'I-14 Kudos and Comment are off, Share stays');

  mem.delete('ftrack:v1:feedCache:last');
  const bare = await mount(VW.HomeView());
  await settle();
  ok(/Not connected/.test(txt(bare)) && !bare.querySelector('.feed-card'), 'I-14 nothing saved: the old Not connected screen');
  social.state = realState;
}

/* ============ fixture: two programmes ============ */
const bench = byName('Barbell Bench Press');
const squat = byName('Back Squat');
const pA = await store.saveSystem({ name: 'Program A' });
const a1 = await store.saveWorkout({ name: 'Alpha One', systemId: pA.id, exercises: [{ exerciseId: bench.id, sets: 3 }] });
await store.saveWorkout({ name: 'Alpha Two', systemId: pA.id, exercises: [{ exerciseId: squat.id, sets: 3 }] });
const pB = await store.saveSystem({ name: 'Program B' });
await store.saveWorkout({ name: 'Bravo One', systemId: pB.id, exercises: [{ exerciseId: squat.id, sets: 3 }] });
await store.saveWorkout({ name: 'Bravo Two', systemId: pB.id, exercises: [{ exerciseId: bench.id, sets: 3 }] });
await store.saveSession({ workoutId: a1.id, workoutName: 'Alpha One', date: isoDaysAgo(2),
  entries: [{ exerciseId: bench.id, exerciseName: 'Bench Press', sets: [{ weight: 100, reps: 5 }] }] });

/* ============ S-01 + I-9: Record names and starts what Start would ============ */
for (const pick of [pA, pB]) {
  await store.setCurrentSystem(pick.id);
  const rec = await mount(VW.RecordChooserView());
  const big = rec.querySelector('.btn.primary.lg');
  const start = await mount(VW.StartPickerView());
  const startNext = txt(start.querySelector('.btn.primary.lg'));
  const bigName = txt(big);
  ok(bigName && bigName === startNext,
     `S-01 with ${pick.name} current, Record's button (${bigName}) names Start's suggestion (${startNext})`);
  ok(pick === pA ? /Alpha/.test(bigName) : /Bravo/.test(bigName), `S-01 Record stays inside ${pick.name}`);
}
{
  const rec = await mount(VW.RecordChooserView());
  const other = [...rec.querySelectorAll('a.row')].find((r) => /Other workout/.test(r.textContent));
  ok(other && other.getAttribute('href') === '#/start', 'I-9 "Other workout" row goes to #/start');
  rec.querySelector('.btn.primary.lg').click();
  await settle();
  ok(/^#\/session\//.test(location.hash), `I-9 the big button starts the workout (${location.hash})`);
  location.hash = '#/home';
}

/* ============ Empty workout row: hidden until the runner side lands ============ */
{
  ok(VW.EMPTY_WORKOUT === false && VW.EMPTY_WORKOUT_ROUTE === '#/session/new-empty', 'Empty workout flag is off, route named');
  const start = await mount(VW.StartPickerView());
  ok(!/Empty workout/.test(txt(start)), 'Empty workout row is not shown while the flag is off');
}

/* ============ S-04: "Find me a program" in the switcher ============ */
{
  const w = await mount(VW.WorkoutsView());
  const head = w.querySelector('.sys-head');
  if (head) head.click();
  await settle();
  ok(/Find me a program/.test(txt(document.body)), 'S-04 the program switcher has "Find me a program"');
  document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-wrap').forEach((n) => n.remove());
}

/* ============ I-17: phone Workouts folds notes + rating into one row ============ */
{
  const w = await mount(VW.SystemRouteView(pA.id));
  const more = w.querySelector('.sys-more');
  ok(more && !w.querySelector('.own-rating'), `I-17 phone: one row (${txt(more)}), rating not on the page`);
  if (more) more.click();
  await settle();
  ok(document.querySelector('.sys-more-body'), 'I-17 the row opens notes and rating in a sheet');
  document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-wrap').forEach((n) => n.remove());
}

/* ============ I-6: "Discard changes?" in the editors ============ */
{
  const backOf = (n) => [...n.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Back');
  location.hash = '#/system/new';
  let ed = await mount(VW.SystemRouteView('new'));
  backOf(ed).click();
  await settle();
  ok(!/Discard changes\?/.test(txt(document.body)), 'I-6 untouched program editor: back leaves with no question');

  location.hash = '#/system/new';
  ed = await mount(VW.SystemRouteView('new'));
  const name = ed.querySelector('input.input');
  name.value = 'Half typed';
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  backOf(ed).click();
  await settle();
  ok(/Discard changes\?/.test(txt(document.body)), 'I-6 typed in the program editor: back asks "Discard changes?"');
  ok(location.hash === '#/system/new', 'I-6 and does not leave until answered');
  document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-wrap').forEach((n) => n.remove());

  /* 🚨 WITH A SCREEN BEHIND IT — the real browser case. screenShell's arrow
     goes back through history when it can and only calls `back` when it
     cannot; jsdom normally has no history position, which is how the first
     version (no backExact) passed here and never asked in WebKit. */
  location.hash = '#/system/new';
  history.replaceState({ navIndex: 3 }, '');
  ed = await mount(VW.SystemRouteView('new'));
  const n2 = ed.querySelector('input.input');
  n2.value = 'Typed with history behind';
  n2.dispatchEvent(new window.Event('input', { bubbles: true }));
  backOf(ed).click();
  await settle();
  ok(/Discard changes\?/.test(txt(document.body)),
     'I-6 with a screen behind it (history back available), back still asks first');
  document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-wrap').forEach((n) => n.remove());
  history.replaceState(null, '');

  location.hash = `#/workout/${a1.id}/edit`;
  const wb = await mount(VW.WorkoutBuilderView(`${a1.id}/edit`));
  const wname = wb.querySelector('input.input');
  if (wname) { wname.value = 'Alpha Renamed'; wname.dispatchEvent(new window.Event('input', { bubbles: true })); }
  backOf(wb).click();
  await settle();
  ok(/Discard changes\?/.test(txt(document.body)), 'I-6 typed in the workout builder: back asks too');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
