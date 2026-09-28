// Wave 4 MISC-FIX (2026-09-27): four verified bugs, each seen FAILING on the
// code before the fix.
//
//   node tests/misc-fix-w4.test.mjs      (needs jsdom, like render.test.mjs)
//
//   1. "Find me a program" must not switch an lbs account to kg on a kg-locale
//      phone. Untouched, the toggle writes nothing.
//   2. A preset only added (not chosen, not trained) gets no one-tap Start on
//      Record.
//   3. An open Empty workout reads "Resume workout" on Record and on #/start.
//   4. The Find screen points at Account, where "Findable by name" now lives.
//   +  Laptop layout hooks: the Record/Start lists carry `pick-grid`.
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
// An en-GB phone: the locale's guess is kg.
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['en-GB'], language: 'en-GB', userAgent: 'node' }, configurable: true,
});
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

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { readFileSync } = await import('node:fs');

const BASE = new URL('../js/', import.meta.url).href;
const { store, todayISO } = await import(BASE + 'store.js');
const { openOnboarding } = await import(BASE + 'onboarding.js');
const { RecordChooserView, StartPickerView } = await import(BASE + 'views-workouts.js');
const { saveDraft, clearDraft } = await import(BASE + 'session-draft.js');
const { PRESET_SYSTEMS } = await import(BASE + 'preset-systems.js');

const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const current = () => q('.ob-screen.is-current');
const title = () => (current() && current().querySelector('.ob-q') ? current().querySelector('.ob-q').textContent : '');
const chip = (label) => [...current().querySelectorAll('.chip')].find((c) => c.textContent.trim() === label);
const nextBtn = () => [...current().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next');
async function tapChoice(label) {
  const b = qa('.ob-screen.is-current .ob-choice').find((x) => x.textContent.trim().startsWith(label));
  b.click();
  await settle(320);
}
async function reopenToAbout() {
  location.hash = '#/home';
  openOnboarding({});
  await settle();
  await tapChoice('Just log workouts');
}

/* ============ 1. Units: an existing lbs account on an en-GB phone ============ */
{
  await store.clearAll();
  // An existing account: onboarded before, a settings row with NO unit (lbs by
  // absence), the way every account made before units existed looks.
  localStorage.setItem('ftrack:v1:onboarded', '2026-09-01');
  await store.saveSettings({ displayName: 'Existing' });
  ok(!(await store.getSettings()).units, '(guard) the account has no unit saved');

  await reopenToAbout();
  ok(title() === 'About you', `(guard) reopened from Settings, About you shows (${title()})`);
  ok(chip('lbs') && chip('lbs').getAttribute('aria-pressed') === 'true',
     `the toggle shows the account's lbs, not the en-GB guess (lbs ${chip('lbs') && chip('lbs').getAttribute('aria-pressed')}, kg ${chip('kg') && chip('kg').getAttribute('aria-pressed')})`);
  nextBtn().click();
  await settle(320);
  const s = await store.getSettings();
  ok(s.units !== 'kg', `Next with the toggle untouched leaves the account on lbs (units: ${s.units})`);
  ok(s.units === undefined, `and writes no unit at all (units: ${s.units})`);
  ok(s.intro && s.intro.path === 'log', '(guard) the rest of About you was still saved');

  // Tapping the toggle still changes it.
  await reopenToAbout();
  chip('kg').click();
  nextBtn().click();
  await settle(320);
  ok((await store.getSettings()).units === 'kg', 'tapping kg then Next still saves kg');
  // …and a kg account keeps kg untouched.
  await reopenToAbout();
  ok(chip('kg').getAttribute('aria-pressed') === 'true', 'a kg account reopens on kg');
  nextBtn().click();
  await settle(320);
  ok((await store.getSettings()).units === 'kg', 'and stays kg');
}
{
  // First run on this phone: the locale's guess still pre-selects.
  await store.clearAll();
  mem.delete('ftrack:v1:onboarded');
  await reopenToAbout();
  ok(chip('kg') && chip('kg').getAttribute('aria-pressed') === 'true', 'a first run on an en-GB phone starts on kg (O-2 kept)');
  q('.ob-overlay .ob-skip').click();
  await settle(320);
}

/* ============ 2. A browsed preset gets no one-tap Start ============ */
const app = () => document.getElementById('app');
async function mount(p) { const n = await p; app().replaceChildren(n); await settle(); return n; }
const bigBtn = (root) => root.querySelector('.pane-scroll .btn.primary.lg, .btn.primary.lg');
{
  clearDraft();
  await store.clearAll();
  const ppl = PRESET_SYSTEMS.find((p) => /push/i.test(p.name)) || PRESET_SYSTEMS[0];
  const added = await store.addPresetSystem(ppl);
  const s = await store.getSettings();
  ok(!s.currentSystemId, `(guard) adding a preset does not make it current (${s.currentSystemId})`);
  ok((await store.getWorkouts()).length > 0, `(guard) the preset brought workouts (${ppl.name})`);
  const rec = await mount(RecordChooserView());
  const txt = bigBtn(rec) ? bigBtn(rec).textContent.trim() : '';
  ok(txt === 'Weightlifting', `Record's big button is the plain Weightlifting door, not a one-tap Start (${txt})`);

  // Chosen → the one-tap Start is back.
  await store.setCurrentSystem(added.id || (await store.getSystems())[0].id);
  const rec2 = await mount(RecordChooserView());
  const txt2 = bigBtn(rec2) ? bigBtn(rec2).textContent.trim() : '';
  ok(txt2 !== 'Weightlifting' && txt2.length > 0, `once chosen, the button starts its next workout (${txt2})`);

  // Trained but never chosen → also yes.
  await store.saveSettings({ currentSystemId: null });
  const w = (await store.getWorkouts())[0];
  await store.saveSession({ date: todayISO(), workoutId: w.id, entries: [] });
  const rec3 = await mount(RecordChooserView());
  const txt3 = bigBtn(rec3) ? bigBtn(rec3).textContent.trim() : '';
  ok(txt3 !== 'Weightlifting', `a program actually trained keeps its one-tap Start (${txt3})`);
}

/* ============ 3. An open Empty workout says Resume ============ */
{
  clearDraft();
  await store.clearAll();
  const ppl = PRESET_SYSTEMS.find((p) => /push/i.test(p.name)) || PRESET_SYSTEMS[0];
  const added = await store.addPresetSystem(ppl);
  await store.setCurrentSystem(added.id || (await store.getSystems())[0].id);
  const today = todayISO();
  saveDraft({ workoutId: 'new-empty', date: today, startedOn: today, startedAt: new Date().toISOString(), entries: [] });

  const rec = await mount(RecordChooserView());
  const b = bigBtn(rec);
  ok(b && b.textContent.trim() === 'Resume workout', `Record says Resume workout (${b && b.textContent.trim()})`);
  let went = null;
  const was = location.hash;
  b.click(); await settle();
  went = location.hash; location.hash = was;
  ok(went === '#/session/new-empty', `and it goes back into the Empty workout (${went})`);

  const pick = await mount(StartPickerView());
  const pb = bigBtn(pick);
  ok(pb && pb.textContent.trim() === 'Resume workout', `#/start's top button says Resume workout (${pb && pb.textContent.trim()})`);
  const emptyRow = [...pick.querySelectorAll('.row')].find((r) => /Empty workout/.test(r.textContent));
  const lab = emptyRow && emptyRow.querySelector('.row-start').textContent.trim();
  ok(lab === 'Resume', `the Empty workout row says Resume (${lab})`);
  const others = [...pick.querySelectorAll('.row-start')].filter((n) => n !== (emptyRow && emptyRow.querySelector('.row-start')));
  ok(others.length > 0 && others.every((n) => n.textContent.trim() === 'Start'), 'the program rows still say Start');

  /* Laptop hooks: the lists that go two-column on a laptop (css .pick-grid). */
  ok(pick.querySelectorAll('.list.pick-grid').length >= 2, 'the Start workout list and Empty workout row carry pick-grid');
  ok(rec.querySelectorAll('.list.pick-grid .row').length === 6, 'Record\'s six activities carry pick-grid');
  clearDraft();
}

/* ============ 4. The Find screen points at Account ============ */
{
  const src = readFileSync(new URL('../js/views-social.js', import.meta.url), 'utf8');
  ok(!/turn this off in Settings/.test(src), 'the Find screen no longer says "in Settings"');
  ok(/turn this off in Account/.test(src), 'it names Account, where "Findable by name" lives');
  const acct = readFileSync(new URL('../js/views-account.js', import.meta.url), 'utf8');
  ok(/'Findable by name'/.test(acct) && /'Who can see you'/.test(acct), '(guard) and Account really holds that switch under Who can see you');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
