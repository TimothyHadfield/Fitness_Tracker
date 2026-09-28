// The Edit record screen's dirty guard, and the import screen's reshape.
//
//   node tests/edit-guard.test.mjs      (needs jsdom, like render.test.mjs)
//
// Overhaul I-6 (2026-09-27). Measured before: change the name → Back → the edit
// was gone with no question; the edge swipe clicks the same arrow, so it lost
// them too. Now: unchanged → Back leaves at once; changed → "Discard changes?".
// Overhaul W-20: the import intro was 123 words of paragraphs.
// Seen FAILING against the code before it (no sheet; 4 long paragraphs), then passing.
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
const { EditSessionView } = await import(BASE + 'views-edit-session.js');
const { ImportView } = await import(BASE + 'views-import.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}
const discardSheets = () => [...document.querySelectorAll('.sheet')]
  .filter((s) => /Discard changes\?/.test(s.textContent));
const backOf = (screen) => screen.querySelector('.topbar > .icon-btn[aria-label="Back"]');
const unloadBlocked = () => {
  const ev = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
};

social.state = async () => ({ available: false });

// A real-shaped record, as views-session.js's finish() writes it.
const bench = BUILT_IN_EXERCISES.find((e) => e.name === 'Barbell Bench Press');
await store.clearAll();
const rec = await store.saveSession({
  workoutId: 'w', workoutName: 'Push', date: '2026-09-20',
  startedAt: '2026-09-20T17:00:00.000Z', finishedAt: '2026-09-20T18:00:00.000Z',
  entries: [{ exerciseId: bench.id, exerciseName: bench.name,
    sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }, { weight: 185, reps: 4 }] }],
});

/* ---- unchanged: Back leaves at once ---- */
{
  location.hash = '#/edit/' + rec.id; await settle();
  const ed = await mount(EditSessionView(rec.id));
  ok(!unloadBlocked(), 'an untouched form does not hold the page on unload');
  const before = discardSheets().length;
  backOf(ed).click(); await settle();
  ok(discardSheets().length === before, 'unchanged → Back opens no sheet');
  ok(location.hash === '#/day/2026-09-20', `and leaves for the record's day (${location.hash})`);
}

/* ---- changed: Back asks; Cancel stays; Discard leaves ---- */
{
  location.hash = '#/edit/' + rec.id; await settle();
  const ed = await mount(EditSessionView(rec.id));
  const name = ed.querySelector('input[type="text"]');
  name.value = 'Push (fixed)';
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok(unloadBlocked(), 'a changed form holds the page on unload');

  const before = discardSheets().length;
  backOf(ed).click(); await settle();
  const sheets = discardSheets();
  ok(sheets.length === before + 1, 'changed → Back opens "Discard changes?"');
  ok(location.hash === '#/edit/' + rec.id, 'and stays put until answered');
  const sheet = sheets[sheets.length - 1];
  const discard = [...sheet.querySelectorAll('button')].find((b) => /^Discard$/.test(b.textContent));
  ok(Boolean(discard), 'the sheet\'s button says Discard');
  [...sheet.querySelectorAll('button')].find((b) => /^Cancel$/.test(b.textContent)).click();
  await settle();
  ok(location.hash === '#/edit/' + rec.id, 'Cancel keeps the edit on screen');
  ok(name.value === 'Push (fixed)', 'with the typing intact');

  backOf(ed).click(); await settle();
  const again = discardSheets();
  [...again[again.length - 1].querySelectorAll('button')].find((b) => /^Discard$/.test(b.textContent)).click();
  await settle();
  ok(location.hash === '#/day/2026-09-20', 'Discard leaves');
  ok((await store.getSession(rec.id)).workoutName === 'Push', 'and nothing was written');
  ok(!unloadBlocked(), 'the unload hold is gone with the screen');
}

/* ---- a change undone is no change ---- */
{
  location.hash = '#/edit/' + rec.id; await settle();
  const ed = await mount(EditSessionView(rec.id));
  const name = ed.querySelector('input[type="text"]');
  name.value = 'X'; name.dispatchEvent(new window.Event('input', { bubbles: true }));
  name.value = 'Push'; name.dispatchEvent(new window.Event('input', { bubbles: true }));
  const before = discardSheets().length;
  backOf(ed).click(); await settle();
  ok(discardSheets().length === before && location.hash === '#/day/2026-09-20',
     'typing then restoring the name leaves without asking');
}

/* ---- a set edit counts; Save is not asked about ---- */
{
  location.hash = '#/edit/' + rec.id; await settle();
  const ed = await mount(EditSessionView(rec.id));
  const w = ed.querySelector('.edit-set .step-value');
  w.value = '190'; w.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  ok(unloadBlocked(), 'a changed set weight counts as a change');
  [...ed.querySelectorAll('button')].find((b) => /Save changes/.test(b.textContent)).click();
  await settle(); await settle();
  ok((await store.getSession(rec.id)).entries[0].sets[0].weight === 190, 'Save still saves');
  ok(!unloadBlocked(), 'and after Save nothing is held');
}

/* ---- the edit screen's help lines stay short (words.md P7) ---- */
{
  const ed = await mount(EditSessionView(rec.id));
  const long = [...ed.querySelectorAll('.field-help')].map((n) => n.textContent.trim())
    .filter((t) => t.split(/\s+/).length >= 15);
  ok(long.length === 0, `every help line under 15 words (${long.join(' | ') || 'none'})`);
}

/* ---- import screen: one short line, the ? beside it, a list of sources ---- */
{
  location.hash = '#/import'; await settle();
  const im = await mount(ImportView());
  const lines = [...im.querySelectorAll('.field-help')].map((n) => n.textContent.trim());
  // Menu paths (with ›) are directions, not sentences, and are exempt.
  const long = lines.filter((t) => !/›/.test(t) && t.split(/\s+/).length >= 15);
  ok(long.length === 0, `no import sentence reaches 15 words (${long.join(' | ') || 'none'})`);
  const dot = im.querySelector('.field-help .help-dot');
  ok(Boolean(dot), 'the "what comes in" caveat sits behind a ? beside the intro');
  for (const name of ['Strava', 'MacroFactor', 'Cronometer', 'Apple Health', 'Spreadsheet']) {
    ok([...im.querySelectorAll('strong')].some((s) => s.textContent === name), `${name} is listed`);
  }
  ok(/activities\.csv/.test(im.textContent), 'Strava\'s file name is still given');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
