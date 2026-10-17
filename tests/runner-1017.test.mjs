// Runner fixes 2026-10-17 (in-depth audit at 393×659, headless WebKit). Every
// check below was seen FAILING on 151b08b before its fix.
//
//   node tests/runner-1017.test.mjs      (needs jsdom, like render.test.mjs)
//
//   1. Hold-to-repeat ran away (205 → 315 on its own) when the finger lifted
//      over another element: the button had moved, and only the button
//      listened for the lift. Now the pointer is captured and the WINDOW's
//      pointerup / pointercancel / blur, or the button leaving the page, stop it.
//      (The 53px jump that moved the button — warm-up rows added above set 1 —
//      is anchored in refreshWarmRows(); jsdom has no layout, so that half is
//      measured in the headless browser, see chat.md 2026-10-17.)
//   2. Tapping the weight box did not select the old number (WebKit refuses
//      select() on type=number): typing 1800 over 180 gave 1180080. Now the box
//      is type=text (the keypad comes from inputmode) and the number is selected.
//      A typed weight over 5000 lb is refused as a keypad slip.
//   3. "Today's exercises": tapping an exercise's name goes to it and closes.
//   4. Person chips: the strip clipped their 44px hit area (40 measured).
//   5. Auto-guide: the ± buttons dropped 23px from the last warm-up to set 1
//      because only set 1 had a caption row.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

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
const { stepper } = await import(BASE + 'ui.js');
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const { SessionView } = await import(BASE + 'views-session.js');
const CSS = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ptr = (type, id = 1) => {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  e.pointerId = id; e.button = 0;
  return e;
};

/* ---------- 1. hold-to-repeat stops wherever the finger lifts ---------- */
{
  let last = 180;
  const s = stepper({ field: 'weight', value: 180, onChange: (v) => { last = v; } });
  document.body.append(s.node);
  const plus = s.node.querySelector('[aria-label="Increase Weight"]');
  plus.dispatchEvent(ptr('pointerdown'));
  await wait(650);   // 420ms to start repeating, then every 90ms
  const climbing = last;
  ok(climbing > 185, `holding + repeats (${climbing})`);
  // The lift lands on ANOTHER element (the button slid out from under it).
  document.body.dispatchEvent(ptr('pointerup'));
  const atLift = last;
  await wait(400);
  ok(last === atLift, `a lift over another element stops the repeat (${atLift} → ${last})`);

  // A hold whose button leaves the page (the list re-rendered) stops too.
  plus.dispatchEvent(ptr('pointerdown'));
  await wait(560);
  s.node.remove();
  await wait(100);
  const gone = last;
  await wait(400);
  ok(last === gone, `a button taken off the page stops repeating (${gone} → ${last})`);
  document.body.dispatchEvent(ptr('pointerup'));

  // And a window blur (the app is left mid-hold).
  document.body.append(s.node);
  plus.dispatchEvent(ptr('pointerdown'));
  await wait(560);
  window.dispatchEvent(new window.Event('blur'));
  const blurred = last;
  await wait(400);
  ok(last === blurred, `leaving the app mid-hold stops repeating (${blurred} → ${last})`);
  document.body.dispatchEvent(ptr('pointerup'));
  s.node.remove();
}

/* ---------- 2. tapping the box selects the old number ---------- */
{
  let changes = [];
  const s = stepper({ field: 'weight', value: 180, onChange: (v) => changes.push(v) });
  document.body.append(s.node);
  const box = s.node.querySelector('.step-value');
  ok(box.type === 'text', `the number box is type=text, which WebKit can select (got ${box.type})`);
  ok(box.getAttribute('inputmode') === 'decimal', 'weight keeps the decimal keypad');
  box.focus();
  box.dispatchEvent(new window.Event('focus'));
  await wait(20);
  ok(box.selectionStart === 0 && box.selectionEnd === box.value.length && box.value === '180',
     `focus selects the whole "180" (selection ${box.selectionStart}–${box.selectionEnd})`);

  // A slip of the keypad is refused; the box goes back to what it held.
  box.value = '1180080';
  box.dispatchEvent(new window.Event('blur'));
  ok(box.value === '180' && changes.length === 0,
     `a weight over 5000 lb is refused (${box.value}, ${changes.length} change)`);
  box.value = '1800';
  box.dispatchEvent(new window.Event('blur'));
  ok(changes[changes.length - 1] === 1800, `1800 lb is still accepted (got ${changes[changes.length - 1]})`);
  box.value = '62,5';
  box.dispatchEvent(new window.Event('blur'));
  ok(changes[changes.length - 1] === 62.5, `a decimal comma reads as a point (got ${changes[changes.length - 1]})`);

  const reps = stepper({ field: 'reps', value: 8, onChange: () => {} });
  const rbox = reps.node.querySelector('.step-value');
  ok(rbox.type === 'text' && rbox.getAttribute('inputmode') === 'numeric', 'reps: type=text, numeric keypad');
  s.node.remove();
}

/* ---------- 3–5. the real runner ---------- */
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const settle = () => new Promise((r) => setTimeout(() => { skew += 450; r(); }, 30));
const app = () => document.getElementById('app');
const DRAFT = 'ftrack:v1:draftSession';
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}

{
  localStorage.removeItem(DRAFT);
  await store.saveSettings({ runnerView: 'list' });
  const ids = ['Barbell Bench Press', 'Overhead Press', 'Lateral Raise'].map((n) => byName(n).id);
  const w = await store.saveWorkout({ name: 'Sheet day', exercises: ids.map((id) => ({ exerciseId: id, sets: 2, notes: '' })) });
  await mount(SessionView(w.id));
  const exName = () => (app().querySelector('.session-ex-name') || {}).textContent || '';
  ok(/Bench Press/.test(exName()), `starts on the bench press ("${exName().trim()}")`);
  const opener = app().querySelector('[title^="See every exercise"]');
  if (opener) opener.click();
  await settle();
  const rowMains = [...document.querySelectorAll('.reorder-row .row-main')];
  ok(rowMains.length === 3, `the sheet lists the three exercises (${rowMains.length})`);
  if (rowMains[2]) rowMains[2].click();
  await settle(); await settle();
  ok(/Lateral Raise/.test(exName()), `tapping a name goes to that exercise ("${exName().trim()}")`);
  const stillOpen = [...document.querySelectorAll('.sheet')].some((s) => s.querySelector('.reorder-list') && !s.classList.contains('is-closing'));
  ok(!document.querySelector('.reorder-list') || !stillOpen, 'and the sheet closes');
  document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
  localStorage.removeItem(DRAFT);
}

{
  // Auto-guide: a warm-up holds the caption row set 1 fills.
  localStorage.removeItem(DRAFT);
  const bench = byName('Barbell Bench Press');
  await store.saveSession({
    workoutName: 'Earlier', date: '2026-10-01', startedAt: '2026-10-01T18:00:00.000Z',
    finishedAt: '2026-10-01T19:00:00.000Z', isBenchmark: false,
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 185, reps: 5 }] }],
  });
  const w = await store.saveWorkout({ name: 'Guide day', exercises: [{ exerciseId: bench.id, sets: 2, notes: '' }] });
  await store.saveSettings({ runnerView: 'list' });
  await mount(SessionView(w.id));
  app().querySelector('.guide-toggle').click();
  await settle(); await settle();
  const where = (app().querySelector('.guide-where') || {}).textContent || '';
  ok(/Warm-up/.test(where), `the guide opens on a warm-up ("${where.trim()}")`);
  const caps = [...app().querySelectorAll('.guide .step-est')];
  ok(caps.length === 2 && caps.every((c) => c.textContent.trim() === ''),
     `a warm-up keeps both caption slots, empty (${caps.length})`);
  ok(/\.guide \.step-est\s*\{[^}]*min-height:\s*2\.6em/.test(CSS), 'app.css holds two caption lines in the guide');
  localStorage.removeItem(DRAFT);
}

/* ---------- 4. person chips keep their 44px ---------- */
{
  const block = (CSS.match(/\n\.people-bar \{[^}]*\}/) || [''])[0];
  ok(/overflow-y:\s*hidden/.test(block), 'the people strip never scrolls up and down');
  const pb = block.match(/padding-bottom:\s*(\d+)px/), mb = block.match(/margin-bottom:\s*-(\d+)px/);
  ok(pb && mb && pb[1] === mb[1] && Number(pb[1]) >= 7,
     `room under the chips for the 44px hit area, given back so nothing moves (${pb && pb[1]} / -${mb && mb[1]})`);
}

/* ---------- 1b. the warm-up swap keeps set 1 still (source; layout is measured headless) ---------- */
{
  const src = readFileSync(new URL('../js/views-session.js', import.meta.url), 'utf8');
  const fn = (src.match(/function refreshWarmRows\(\) \{[\s\S]*?\n {4}\}/) || [''])[0];
  ok(/editor\.getBoundingClientRect\(\)\.top/.test(fn) && /pane\.scrollTop \+= moved/.test(fn),
     'refreshWarmRows() scrolls the pane by however far the open set moved');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
