// Group workouts apply on their own — 2026-09-27.
//   node tests/handoff-auto.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "I also want you change the group workouts so it automatically applies to
// the friend's workout system, and they don't need to accept it, however, also
// make a setting (that is off by default) that makes it so the user does have to
// accept the workout before it is automatically applied to their system."
//
// What this file pins:
//   1. setting off (the default): a waiting offer from a friend is added to my
//      sessions, once, with the same shape Add gives, and the offer is deleted;
//   2. two appliers (two tabs / devices, or auto + a tap on Add) never make two
//      copies — including one that read the offer before the other deleted it;
//   3. setting on: nothing is added; the offer waits and Add still works;
//   4. an offer from somebody who is not a friend waits for Add;
//   5. declined or retracted before the look: nothing is added;
//   6. the notice (a toast) says a workout was added; Home stops counting it;
//      Settings has the switch, off by default; boot/resume call the apply.
//
// 🔒 NO CLOUD. `js/firebase-backend.js` is swapped for an in-memory fake with a
// module hook BEFORE the store loads (the pattern compare-publish.test.mjs uses).
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const FAKE = `
const db = new Map();
const shared = new Map();
const handoffs = new Map();
const g = globalThis.__fakeCloud = { db, shared, handoffs, staleList: null,
  graph: { connections: [{ uid: 'autumn', name: 'Autumn' }], pending: [] } };
const copy = (v) => JSON.parse(JSON.stringify(v));
export const SHARDED_COLLECTIONS = [];
export function mergeRows(a, b) { return [...(a || []), ...(b || [])]; }
export const FirebaseBackend = {
  async ready() { return true; },
  currentUid() { return 'tim'; },
  currentUser() { return { uid: 'tim', isAnonymous: false }; },
  onUserChange() { return () => {}; },
  async read(c) { return copy(db.get(c) || []); },
  async write(c, rows) { db.set(c, copy(rows || [])); return true; },
  async readGraph() { return copy(g.graph); },
  async writeGraph(x) { g.graph = copy(x); return true; },
  async readShared(uid, audience) { return uid === 'tim' && shared.has(audience) ? copy(shared.get(audience)) : null; },
  async publishShared(audience, doc) { shared.set(audience, copy(doc)); return true; },
  async unpublishShared(audience) { shared.delete(audience); return true; },
  async writeBackup() { return true; },
  async listHandoffs(owner) {
    if (owner !== 'tim') return [];
    if (g.staleList) return copy(g.staleList);
    return [...handoffs.entries()].map(([id, d]) => ({ id, ...copy(d) }));
  },
  async writeHandoff(owner, id, data) { handoffs.set(id, { ...copy(data), at: Date.now() }); return true; },
  async deleteHandoff(owner, id) { handoffs.delete(id); return true; },
};
`;
registerHooks({
  resolve(specifier, context, next) {
    if (/firebase-backend\.js$/.test(specifier)) {
      return { url: 'data:text/javascript,' + encodeURIComponent(FAKE), shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
mem.set('ftrack:v1:lastCloudRollBackup', String(Date.now()));
const sess = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (c) passes++; else fails++; };
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const BASE = new URL('../js/', import.meta.url).href;
const { store, social } = await import(BASE + 'store.js');
await store.getSettings();
const cloud = globalThis.__fakeCloud;
if (!cloud) { console.log('FAIL  the fake cloud did not load — refusing to run'); process.exit(1); }
ok(true, 'the store is on the in-memory fake cloud, not Firestore');

const has = (name) => typeof social[name] === 'function';
const apply = () => (has('autoApplyHandoffs') ? social.autoApplyHandoffs() : Promise.resolve([]));
const offer = (id, from, workoutName, date = '2026-09-26') => cloud.handoffs.set(id, {
  from, fromName: from === 'autumn' ? 'Autumn' : 'Stranger',
  session: { date, workoutName, entries: [{ exerciseId: 'x', exerciseName: 'Back Squat', sets: [{ weight: 135, reps: 5 }] }] },
});
const mine = async (name) => (await store.getSessions()).filter((s) => s.workoutName === name);
const reset = async () => { cloud.handoffs.clear(); cloud.staleList = null; await store.saveSettings({ askBeforeGroupWorkouts: false }); };

/* ---- 1. setting off (default): applied, once, offer deleted ---- */
{
  ok((await store.getSettings()).askBeforeGroupWorkouts !== true, 'the setting is off by default');
  offer('h_g-1', 'autumn', 'Legs with Autumn');      // sent BEFORE this shipped: same shape
  const added = await apply();
  const rows = await mine('Legs with Autumn');
  ok(added.length === 1, `one offer applied on the look (${added.length})`);
  ok(rows.length === 1, `it is in my sessions (${rows.length})`);
  ok(rows[0] && rows[0].acceptedFrom === 'autumn', 'saved with acceptedFrom, the shape Add gives');
  ok(!cloud.handoffs.has('h_g-1'), 'and the offer is deleted');
  ok((await apply()).length === 0 && (await mine('Legs with Autumn')).length === 1, 'looking again adds nothing');
}

/* ---- 2. two appliers never double-apply ---- */
{
  await reset();
  offer('h_g-2', 'autumn', 'Push with Autumn');
  const [a, b] = await Promise.all([apply(), apply()]);
  ok(a.length + b.length === 1, `two concurrent looks in one tab apply it once (${a.length}+${b.length})`);
  ok((await mine('Push with Autumn')).length === 1, 'one copy in my sessions');

  // Another device read the offer BEFORE this one deleted it, and saves after.
  offer('h_g-3', 'autumn', 'Pull with Autumn');
  cloud.staleList = [{ id: 'h_g-3', ...cloud.handoffs.get('h_g-3') }];
  await apply();
  let late = null;
  try { late = await social.acceptHandoff('h_g-3'); } catch (e) { late = e; }
  cloud.staleList = null;
  const pulls = await mine('Pull with Autumn');
  ok(pulls.length === 1, `🚨 a second applier holding a stale copy of the offer makes no second copy (${pulls.length})`);

  // The same through acceptHandoff alone (two devices, each with the stale
  // list) — this is the dedupe itself, independent of the auto path.
  offer('h_g-3b', 'autumn', 'Core with Autumn');
  cloud.staleList = [{ id: 'h_g-3b', ...cloud.handoffs.get('h_g-3b') }];
  await social.acceptHandoff('h_g-3b').catch(() => null);
  await social.acceptHandoff('h_g-3b').catch(() => null);
  cloud.staleList = null;
  ok((await mine('Core with Autumn')).length === 1,
    `🚨 two devices accepting the same offer one after the other: one copy (${(await mine('Core with Autumn')).length})`);
  offer('h_g-3c', 'autumn', 'Calves with Autumn');
  await Promise.all([social.acceptHandoff('h_g-3c').catch(() => null), social.acceptHandoff('h_g-3c').catch(() => null)]);
  ok((await mine('Calves with Autumn')).length === 1,
    `two accepts at the same moment: one copy (${(await mine('Calves with Autumn')).length})`);

  // Manual Add and the auto look racing each other.
  offer('h_g-4', 'autumn', 'Arms with Autumn');
  await Promise.all([social.acceptHandoff('h_g-4').catch(() => null), apply()]);
  ok((await mine('Arms with Autumn')).length === 1, 'a tap on Add racing the auto look: still one copy');
}

/* ---- 3. setting on: nothing auto-applied, manual Add unchanged ---- */
{
  await reset();
  await store.saveSettings({ askBeforeGroupWorkouts: true });
  offer('h_g-5', 'autumn', 'Chest with Autumn');
  const added = await apply();
  ok(added.length === 0 && (await mine('Chest with Autumn')).length === 0, 'setting on: nothing is added by itself');
  ok(cloud.handoffs.has('h_g-5'), 'the offer still waits');
  const listed = await social.handoffs();
  ok(listed.some((o) => o.id === 'h_g-5'), 'and is listed for Add, as before');
  await social.acceptHandoff('h_g-5');
  ok((await mine('Chest with Autumn')).length === 1 && !cloud.handoffs.has('h_g-5'), 'tapping Add still adds it and clears the offer');
  await store.saveSettings({ askBeforeGroupWorkouts: false });
}

/* ---- 4. not a friend: waits for Add ---- */
{
  await reset();
  offer('h_g-6', 'stranger', 'Legs with an ex-friend');
  const added = await apply();
  ok(added.length === 0 && (await mine('Legs with an ex-friend')).length === 0,
    'an offer from somebody not on my friends list is not added by itself');
  ok(cloud.handoffs.has('h_g-6'), 'it waits for Add (not dropped)');
}

/* ---- 5. declined / retracted before the look ---- */
{
  await reset();
  offer('h_g-7', 'autumn', 'Declined one');
  await social.declineHandoff('h_g-7');
  offer('h_g-8', 'autumn', 'Retracted one');
  await social.retractHandoff('tim', 'g-8');
  const added = await apply();
  ok(added.length === 0, 'nothing applied after decline/retract');
  ok((await mine('Declined one')).length === 0 && (await mine('Retracted one')).length === 0,
    'neither is in my sessions');
}

/* ---- 6. the notice, Home, Settings, boot wiring ---- */
const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ');
const clearToasts = () => document.querySelectorAll('.toast').forEach((t) => t.remove());
const V = await import(BASE + 'views-social.js');
{
  await reset();
  clearToasts();
  offer('h_g-9', 'autumn', 'Back Day');
  ok(typeof V.applyOfferedWorkouts === 'function', 'views-social exports applyOfferedWorkouts');
  if (typeof V.applyOfferedWorkouts === 'function') await V.applyOfferedWorkouts();
  await settle();
  ok(/Added Back Day from Autumn/.test(toasts()), `a toast says it was added ("${toasts()}")`);
  clearToasts();
  if (typeof V.applyOfferedWorkouts === 'function') await V.applyOfferedWorkouts();
  await settle();
  ok(toasts() === '', 'nothing added → no toast');
}
{
  await reset();
  clearToasts();
  offer('h_g-10', 'autumn', 'Home Legs');
  const { HomeView } = await import(BASE + 'views-workouts.js');
  const original = { ...social };
  social.state = async () => ({ available: true, reason: null, user: { uid: 'tim' }, uid: 'tim',
    name: 'Tim H', shareBodyWeight: false, connections: [] });
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;
  social.requests = async () => [];
  social.invites = async () => [];
  social.reactionsFor = async () => new Map();
  const home = await HomeView();
  document.getElementById('app').replaceChildren(home);
  await settle(200);
  const line = home.querySelector('.feed-waiting');
  ok(!line || !/recorded for you/.test(line.textContent), `Home does not list it as waiting (${line && line.textContent})`);
  ok((await mine('Home Legs')).length === 1, 'opening Home added it');
  ok(/Added Home Legs from Autumn/.test(toasts()), `and said so ("${toasts()}")`);
  Object.assign(social, original);
}
{
  const { SettingsView } = await import(BASE + 'views-data.js');
  await store.saveSettings({ askBeforeGroupWorkouts: false });
  const scr = await SettingsView();
  document.getElementById('app').replaceChildren(scr);
  await settle();
  const sw = [...scr.querySelectorAll('.switch-row')].find((r) => /Ask before adding group workouts/.test(r.textContent));
  ok(Boolean(sw), 'Settings has an "Ask before adding group workouts" switch');
  const btn = sw && sw.querySelector('[role="switch"]');
  ok(btn && btn.getAttribute('aria-checked') === 'false', 'off by default');
  if (btn) btn.click();
  await settle(120);
  ok((await store.getSettings()).askBeforeGroupWorkouts === true, 'turning it on saves the setting');
  await store.saveSettings({ askBeforeGroupWorkouts: false });
}
{
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  ok(/watchGroupWorkouts\(\);/.test(app) && /applyOfferedWorkouts\(\)/.test(app),
    'boot calls the apply (app.js)');
  ok(/visibilitychange[\s\S]{0,200}look\(\)/.test(app) && /auth\.onChange\(/.test(app),
    'and so do resume and sign-in');
}

console.log(`\n${passes} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
