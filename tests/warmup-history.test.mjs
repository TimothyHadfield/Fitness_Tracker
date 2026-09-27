// Warm-ups in the workout history, the day view and the edit screen.
//
//   node tests/warmup-history.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim, 2026-09-27: "Also add the warm-up sets in the workout history and day
// view." Warm-ups live in `entry.warmups`, never `sets` (views-session.js), so
// every screen that shows a finished workout must SHOW them and must NOT count
// them. Seen FAILING against the code before it (no warm rows anywhere), then
// passing. Same harness as review2-record.test.mjs.
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
const { DayView } = await import(BASE + 'views-data.js');
const { MeRouteView } = await import(BASE + 'views-me.js');
const { EditSessionView } = await import(BASE + 'views-edit-session.js');
const { workoutCard, sessionToCard } = await import(BASE + 'workout-card.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
const text = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}

social.state = async () => ({ available: false });

// A real-shaped record: what views-session.js's finish() writes — warm-ups as
// picked `{weight, reps}` rows in their own list, three working sets.
const bench = byName('Barbell Bench Press');
const squat = byName('Back Squat');
await store.clearAll();
const rec = await store.saveSession({
  workoutId: 'w', workoutName: 'Push', date: '2026-09-20',
  startedAt: '2026-09-20T17:00:00.000Z', finishedAt: '2026-09-20T18:00:00.000Z',
  entries: [
    { exerciseId: bench.id, exerciseName: bench.name,
      warmups: [{ weight: 45, reps: 10 }, { weight: 135, reps: 5 }],
      sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }, { weight: 185, reps: 4 }] },
    // No warm-ups on this one: it must look exactly as before.
    { exerciseId: squat.id, exerciseName: squat.name,
      sets: [{ weight: 225, reps: 5 }, { weight: 225, reps: 5 }] },
  ],
});

/* ============ 1. The day view ============ */
{
  const day = await mount(DayView('2026-09-20'));
  const exs = [...day.querySelectorAll('.detail-ex')];
  ok(exs.length === 2, `(guard) the day lists both exercises (${exs.length})`);
  const warm = exs[0] ? [...exs[0].querySelectorAll('.detail-set.is-warm')] : [];
  ok(warm.length === 2, `the bench shows its 2 warm-ups (${warm.length})`);
  ok(warm.length > 0 && warm.every((w) => text(w.querySelector('b')) === 'W'), 'each is marked W, not given a set number');
  ok(/45/.test(text(warm[0])) && /10/.test(text(warm[0])), `the first reads 45 × 10 (${text(warm[0])})`);
  ok(/135/.test(text(warm[1])), `the second reads 135 × 5 (${text(warm[1])})`);
  const all = exs[0] ? [...exs[0].querySelectorAll('.detail-set')] : [];
  ok(all.length >= 3 && all[0].classList.contains('is-warm') && all[1].classList.contains('is-warm')
     && /Set 1/.test(text(all[2])), 'warm-ups come BEFORE set 1');
  ok(!/Set 4|Set 5/.test(text(exs[0])), 'working sets are still numbered 1–3');
  ok(exs[1] && !exs[1].querySelector('.is-warm'), 'an exercise with no warm-ups shows none');
  ok(/2 exercises · 5 sets/.test(text(day)), `the "N sets" line leaves warm-ups out (${text(day.querySelector('.day-head'))})`);
}

/* ============ 2. The workout history (#/me/workouts) ============ */
{
  const list = await mount(MeRouteView('workouts'));
  await settle();
  const card = list.querySelector('.feed-card');
  ok(Boolean(card), '(guard) the history draws the workout as a card');
  const rows = card ? [...card.querySelectorAll('.feed-ex')] : [];
  ok(rows.length === 2, `(guard) one row per exercise (${rows.length})`);
  const w = rows[0] && rows[0].querySelector('.feed-ex-warm');
  ok(Boolean(w), 'the bench row mentions its warm-ups');
  ok(w && /2 warm-ups/.test(text(w)), `and says how many (${text(w)})`);
  ok(rows[0] && /3 sets/.test(text(rows[0].querySelector('.feed-ex-sets'))),
     `the set count stays 3, not 5 (${text(rows[0] && rows[0].querySelector('.feed-ex-sets'))})`);
  ok(rows[1] && !rows[1].querySelector('.feed-ex-warm'), 'the squat row, with none, says nothing extra');
  const stat = card ? [...card.querySelectorAll('.feed-stat')].find((s) => /Sets/.test(text(s))) : null;
  ok(stat && /^Sets\s*5$/.test(text(stat)), `the Sets stat stays 5 (${text(stat)})`);
}

/* ============ 3. A friend's card (no warm-ups in the projection) ============ */
{
  const projected = { id: 'x', date: '2026-09-20', name: 'Push', minutes: 60,
    entries: [{ exerciseId: bench.id, name: bench.name, sets: [{ weight: 185, reps: 5 }] }] };
  let card = null, threw = null;
  try { card = workoutCard(projected, { href: '#/friend/u/x' }); } catch (e) { threw = e; }
  ok(!threw && Boolean(card), 'a card with no warm-up field anywhere still draws');
  ok(card && !card.querySelector('.feed-ex-warm'), 'and shows no warm-up line');
  const empty = workoutCard(sessionToCard({ date: '2026-09-20', workoutName: 'Push',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, warmups: [], sets: [{ weight: 185, reps: 5 }] }] }), {});
  ok(!empty.querySelector('.feed-ex-warm'), 'an empty warm-up list shows nothing');
  const blank = workoutCard(sessionToCard({ date: '2026-09-20', workoutName: 'Push',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, warmups: [{ weight: 0, reps: 0 }], sets: [{ weight: 185, reps: 5 }] }] }), {});
  ok(!blank.querySelector('.feed-ex-warm'), 'a warm-up row with no numbers is not counted as one');
}

/* ============ 4. The edit screen ============ */
{
  const edit = await mount(EditSessionView(rec.id));
  const exs = [...edit.querySelectorAll('.edit-ex')];
  ok(exs.length === 2, `(guard) the edit screen lists both exercises (${exs.length})`);
  const warm = exs[0] ? [...exs[0].querySelectorAll('.is-warm')] : [];
  ok(warm.length === 2, `the bench shows its 2 warm-ups there too (${warm.length})`);
  const firstSet = exs[0] && exs[0].querySelector('.edit-set');
  ok(warm[0] && firstSet
     && (warm[0].compareDocumentPosition(firstSet) & window.Node.DOCUMENT_POSITION_FOLLOWING),
     'above Set 1');
  ok(exs[1] && !exs[1].querySelector('.is-warm'), 'the squat shows none');

  const save = [...edit.querySelectorAll('button')].find((b) => /Save changes/.test(b.textContent));
  ok(Boolean(save), '(guard) Save is there');
  if (save) { save.click(); await settle(); await settle(); }
  const after = await store.getSession(rec.id);
  const e0 = after && after.entries.find((e) => e.exerciseId === bench.id);
  ok(e0 && Array.isArray(e0.warmups) && e0.warmups.length === 2, 'saving an edit keeps the warm-ups');
  ok(e0 && e0.sets.length === 3, 'and they never join the working sets');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
