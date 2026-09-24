// Workouts / Home / picker bugs found by the 2026-09-24 review (builder D).
//
//   node tests/review-workouts.test.mjs      (needs jsdom, like render.test.mjs)
//
// Each block is one bug, and each was seen FAILING against the unfixed code
// before the fix went in (FT_JS_BASE can point the imports at a copy of the
// old js/ folder to repeat that). Same harness as review-runnerA.test.mjs.
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';

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

const BASE = process.env.FT_JS_BASE
  ? pathToFileURL(process.env.FT_JS_BASE.replace(/[\\/]?$/, '/')).href
  : new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store, social, todayISO } = await import(BASE + 'store.js');
const views = await import(BASE + 'views-workouts.js');
const { presetUpdatePlan } = await import(BASE + 'preset-updates.js');
const { STRENGTH_CAVEAT, STRENGTH_CAVEAT_SHORT } = await import(BASE + 'optimal.js');
const { stepper } = await import(BASE + 'ui.js');
const units = await import(BASE + 'units.js');
const { PRESET_SYSTEMS } = await import(BASE + 'preset-systems.js');
const { buildDemoFeed } = await import(BASE + 'demo.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));
const app = () => document.getElementById('app');
const lastSheet = () => { const s = document.querySelectorAll('.sheet'); return s[s.length - 1] || null; };
const clearSheets = () => document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-scrim').forEach((n) => n.remove());
async function mount(viewPromise) {
  const node = await viewPromise;
  app().replaceChildren(node);
  await settle(); await settle();
  return node;
}
async function safe(label, fn) {
  try { await fn(); } catch (err) { ok(false, `${label} threw: ${err && err.message}`); }
}

/* ============ 1. exercise search finds everyday spellings ============ */
await safe('search', async () => {
  const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
  clearSheets();
  await views.openExercisePicker({ exMap, onPick: () => true });
  await settle();
  const sheet = lastSheet();
  const input = sheet.querySelector('input[type="search"]');
  const results = (q) => {
    input.value = q;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    return [...sheet.querySelectorAll('.search-results .row-title')].map((n) => n.textContent.trim());
  };
  const cases = [
    ['pullup', 'Pull-Up'], ['pull up', 'Pull-Up'], ['chinup', 'Chin-Up'], ['pushup', 'Push-Up'],
    ['dips', 'Chest Dip'], ['bicep', 'Barbell Curl'], ['abs', 'Plank'], ['rdl', 'Romanian Deadlift'],
    ['ohp', 'Overhead Press'], ['db bench', 'Dumbbell Bench Press'],
    ['bench dumbbell', 'Dumbbell Bench Press'], ['t bar', 'T-Bar Row'],
  ];
  for (const [q, want] of cases) {
    const got = results(q);
    ok(got.slice(0, 8).some((t) => t.startsWith(want)),
       `"${q}" lists ${want} near the top (got: ${got.slice(0, 3).join(' | ') || 'nothing'})`);
  }
  const run = results('run');
  const tr = run.findIndex((t) => t.startsWith('Treadmill Run'));
  const cr = run.findIndex((t) => /Crunch/.test(t));
  ok(tr !== -1 && tr < 5 && (cr === -1 || tr < cr),
     `"run" lists Treadmill Run in the top five, above every crunch (got ${run.slice(0, 5).join(' | ')})`);
  ok(results('pullup')[0].startsWith('Pull-Up'), '"pullup" puts Pull-Up itself first');
  ok(results('zzzqqq').length === 0, 'a nonsense query still finds nothing');
  clearSheets();
});

/* ============ 2. "Keep my version" clears a notice nothing can be applied from ============ */
await safe('keep my version', async () => {
  await store.clearAll();
  const preset = PRESET_SYSTEMS.find((p) => p.id === 'preset-nippard-ppl-2023');
  await store.addPresetSystem(preset);
  const sys = (await store.getSystems()).find((s) => s.presetId === preset.id);
  // Unstamped (a copy from before 2026-09-20) and edited: every row is 'manual'.
  await store.saveSystem({ ...sys, presetVersion: null });
  const ws = (await store.getWorkouts()).filter((w) => w.systemId === sys.id);
  const w0 = ws[0];
  await store.saveWorkout({ ...w0, exercises: w0.exercises.map((e, i) => (i === 0 ? { ...e, sets: e.sets + 1 } : e)) });
  const before = JSON.stringify((await store.getWorkouts()).map((w) => w.exercises));

  clearSheets();
  const screen = await mount(views.SystemRouteView(sys.id));
  const notice = screen.querySelector('.preset-update');
  ok(Boolean(notice), 'the "original changed" notice shows on an edited, unstamped copy');
  notice && notice.click();
  await settle();
  const sheet = lastSheet();
  const keep = sheet && [...sheet.querySelectorAll('button')].find((b) => /Keep my version/.test(b.textContent));
  ok(Boolean(keep), 'the review sheet has a "Keep my version" button');
  if (keep) {
    keep.click();
    await settle(); await settle();
    const after = await store.getSystem(sys.id);
    ok(Number(after.presetVersion) === Number(preset.version), 'it stamps the copy at the current version');
    ok((await store.presetUpdateFor(after, await store.getWorkouts())) === null, 'so the notice has nothing left to say');
    ok(JSON.stringify((await store.getWorkouts()).map((w) => w.exercises)) === before, 'and no workout was written');
  }
  clearSheets();
});

/* ============ 3. a set-count change is not reported as a rep change ============ */
await safe('sameReps', async () => {
  const larsen = byName('Larsen Press');
  const ten2 = [{ lo: 10, hi: 10 }, { lo: 10, hi: 10 }];
  const preset = { id: 'p1', version: 2, workouts: [{ key: 'a', name: 'Push', exercises: [{ name: 'Larsen Press', sets: 4, reps: 10 }] }] };
  const system = { id: 's1', presetId: 'p1', presetVersion: 1 };
  const workouts = [{ id: 'w1', systemId: 's1', presetKey: 'a', name: 'Push', exercises: [{
    exerciseId: larsen.id, sets: 2, reps: ten2, notes: '', origin: { sets: 2, notes: '', reps: ten2 },
  }] }];
  const plan = presetUpdatePlan({ preset, system, workouts, byName: new Map([['Larsen Press', larsen]]) });
  const kinds = plan ? plan.changes.map((c) => c.kind) : [];
  ok(kinds.includes('sets'), 'going from 2 sets to 4 is reported as a set change');
  ok(!kinds.includes('reps'), `and NOT as "now asks for 10 reps" (got ${kinds.join(', ')})`);
  // A real rep change still shows.
  const preset8 = { ...preset, workouts: [{ ...preset.workouts[0], exercises: [{ name: 'Larsen Press', sets: 4, reps: 8 }] }] };
  const plan8 = presetUpdatePlan({ preset: preset8, system, workouts, byName: new Map([['Larsen Press', larsen]]) });
  ok(plan8 && plan8.changes.some((c) => c.kind === 'reps'), 'a real change from 10 reps to 8 is still reported');
});

/* ============ 4. the strength caveat tells the truth ============ */
for (const s of [STRENGTH_CAVEAT, STRENGTH_CAVEAT_SHORT]) {
  ok(!/not a weight or a rep range|stores a set count, not/.test(s),
     'the caveat no longer says the app stores no rep range (it has since 2026-09-20)');
  ok(/rep/i.test(s) && /3 sets of 20/.test(s), 'it says the score does not read the rep counts, with the 3×20 example');
}

/* ============ 5. programme notes keep their paragraphs ============ */
await safe('notes', async () => {
  await store.clearAll();
  const sys = await store.saveSystem({ name: 'Mine', notes: 'First paragraph.\n\nSecond paragraph.' });
  const screen = await mount(views.SystemRouteView(sys.id));
  const ps = screen.querySelectorAll('.preset-notes p');
  ok(ps.length === 2, `two paragraphs of notes are two <p> (got ${ps.length})`);
});

/* ============ 6. the source link is styled, not browser blue ============ */
await safe('link', async () => {
  const screen = await mount(views.ExploreDetailView('preset-nippard-ppl-2023'));
  const a = screen.querySelector('a[target="_blank"]');
  ok(a && a.classList.contains('text-link'), 'the external source link carries text-link');
});

/* ============ 7. ± lands back on a loadable weight ============ */
{
  const press = (btn) => {
    btn.dispatchEvent(new window.Event('pointerdown', { cancelable: true }));
    btn.dispatchEvent(new window.Event('pointerup'));
  };
  units.setUnits('kg');
  let out = null;
  const lb = units.fromDisplay(111.1);
  const s = stepper({ field: 'weight', value: lb, onChange: (v) => { out = v; } });
  const [minus, plus] = s.node.querySelectorAll('.step-btn');
  const shown = () => Number(s.node.querySelector('.step-value').value);
  press(plus);
  ok(shown() === 112.5, `kg: 111.1 + → 112.5, the next loadable weight (got ${shown()})`);
  press(plus);
  ok(shown() === 115, `and then steps by 2.5 → 115 (got ${shown()})`);
  s.set(units.fromDisplay(111.1));
  press(minus);
  ok(shown() === 110, `111.1 − → 110 (got ${shown()})`);
  s.set(units.fromDisplay(60));
  press(minus);
  ok(shown() === 57.5, `a round 60 kg (59.999… underneath) still steps to 57.5 (got ${shown()})`);
  ok(out != null, 'onChange fired');
  units.setUnits('lbs');
  const t = stepper({ field: 'weight', value: 132, onChange: () => {} });
  const [, plusLb] = t.node.querySelectorAll('.step-btn');
  press(plusLb);
  ok(Number(t.node.querySelector('.step-value').value) === 135, 'lb: 132 + → 135');
  const r = stepper({ field: 'reps', value: 7, onChange: () => {} });
  press(r.node.querySelectorAll('.step-btn')[1]);
  ok(Number(r.node.querySelector('.step-value').value) === 8, 'reps still step by one');
}

/* ============ 8. the Home feed ============ */
const original = {};
for (const k of ['state', 'friend', 'reactionsFor', 'processDisconnects', 'processAcceptedRequests']) original[k] = social[k];
const template = buildDemoFeed(todayISO()).map((e) => e.act).filter((a) => a.entries && a.entries.length);
const pad = (n) => String(n).padStart(2, '0');
const [ty, tm, td] = todayISO().split('-').map(Number);
const daysAgo = (n) => { const d = new Date(ty, tm - 1, td - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const acts = (uid, n, from = 0) => Array.from({ length: n }, (_, i) => ({
  ...template[i % template.length], id: `${uid}-s${i}`, date: daysAgo(from + i), startedAt: undefined,
}));
async function home() {
  const node = await mount(views.HomeView());
  for (let i = 0; i < 6; i++) await settle();
  return node;
}

await safe('feed', async () => {
  await store.clearAll();
  // 8a. A request accepted elsewhere counts on Home without opening Friends.
  let accepted = false;
  const calls = [];
  social.state = async () => ({ available: true, reason: null, uid: 'me', name: 'Me', connections: accepted ? [{ uid: 'f1', name: 'Marcus' }] : [] });
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => { accepted = true; return 1; };
  social.friend = async (uid) => ({ audience: 'friends', doc: { profile: { name: uid === 'f1' ? 'Marcus' : 'Ana' }, activity: uid === 'f1' ? acts('f1', 70) : acts('f2', 5, 100) } });
  social.reactionsFor = async (uid) => { calls.push(uid); return new Map(); };
  let screen = await home();
  ok(screen.querySelectorAll('.feed-card').length > 0, '8a: an accepted request shows its workouts on Home straight away');

  // 8c. Thirty at a time, and reactions only for friends on screen.
  accepted = true;
  social.state = async () => ({ available: true, reason: null, uid: 'me', name: 'Me', connections: [{ uid: 'f1', name: 'Marcus' }, { uid: 'f2', name: 'Ana' }] });
  social.processAcceptedRequests = async () => 0;
  calls.length = 0;
  screen = await home();
  ok(screen.querySelectorAll('.feed-card').length === 30, `8c: the feed draws 30 cards, not 75 (got ${screen.querySelectorAll('.feed-card').length})`);
  ok(!calls.includes('f2'), '8c: reactions are not fetched for a friend whose cards are not shown yet');
  const more = [...screen.querySelectorAll('button')].find((b) => /Show more/.test(b.textContent));
  ok(Boolean(more), '8c: a "Show more" button');
  if (more) {
    more.click(); await settle(); await settle();
    ok(screen.querySelectorAll('.feed-card').length === 60, '8c: Show more reveals 30 more');
    more.click(); await settle(); await settle();
    ok(screen.querySelectorAll('.feed-card').length === 75, '8c: and then the rest');
    ok(!screen.contains(more), '8c: and the button goes when there is nothing left');
    ok(calls.includes('f2'), '8c: reactions for the newly shown friend were fetched then');
  }

  // 8d. Share text names a readable date.
  let shared = null;
  window.navigator.share = async (d) => { shared = d; };
  const shareBtn = [...screen.querySelectorAll('.feed-act')].find((b) => /Share/.test(b.textContent));
  shareBtn.click(); await settle();
  ok(shared && !/\d{4}-\d{2}-\d{2}/.test(shared.text), `8d: share text has no raw date (got "${shared && shared.text}")`);
  delete window.navigator.share;

  // 8e. The empty line no longer claims friends may hide what they did.
  social.friend = async () => ({ audience: 'friends', doc: { profile: { name: 'Marcus' }, activity: [] } });
  screen = await home();
  const txt = screen.textContent;
  ok(/Nothing from anyone yet/.test(txt), '8e: the empty feed state shows');
  ok(!/only show that they trained/.test(txt), '8e: without the false "some may only show that they trained"');

  // 8b. "On your workouts" follows the newest reaction.
  const origSessions = store.getSessions;
  store.getSessions = async () => [
    { id: 'm1', date: daysAgo(1), workoutName: 'Newest workout' },
    { id: 'm2', date: daysAgo(2), workoutName: 'Middle workout' },
    { id: 'm3', date: daysAgo(3), workoutName: 'Third workout' },
    { id: 'm4', date: daysAgo(20), workoutName: 'Old workout' },
  ];
  social.friend = async () => ({ audience: 'friends', doc: { profile: { name: 'Marcus' }, activity: acts('f1', 1) } });
  social.reactionsFor = async (uid) => (uid !== 'me' ? new Map() : new Map([
    ['m1', { kudos: ['f1'], myKudosId: null, comments: [] }],
    ['m2', { kudos: ['f1'], myKudosId: null, comments: [] }],
    ['m3', { kudos: ['f1'], myKudosId: null, comments: [] }],
    ['m4', { kudos: [], myKudosId: null, comments: [{ id: 'c', from: 'f1', fromName: 'Marcus', text: 'Nice', at: Date.now(), mine: false }] }],
  ]));
  screen = await home();
  const first = screen.querySelector('.feed-mine-row .feed-mine-what');
  ok(first && /Old workout/.test(first.textContent), `8b: a comment today on an old workout is listed first (got ${first && first.textContent})`);
  store.getSessions = origSessions;
});
Object.assign(social, original);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
