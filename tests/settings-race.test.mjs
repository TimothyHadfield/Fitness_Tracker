// Settings lost-update race — 2026-09-27.
//   node tests/settings-race.test.mjs
//
// Seen live (Wesley's account, set up by script right after sign-up):
// `await store.saveProfile({gender:'male'})` then `await store.saveSettings(
// {onboardedAt, shareBodyWeight:true})` — and a later read-back had NO gender
// while shareBodyWeight was there. A second saveProfile later stuck.
//
// Cause: `saveSettings` is a read-modify-write of ONE row (read the row, merge
// the patch, write the whole row back). Two of them in flight at once each
// read the same old row, and the one that lands last writes its stale copy
// over the other's field. The app fires plenty of them in the background — the
// 2.5 s publish's `sharedTiersCleared` on a new account, onboarding's
// `onboardedAt`, theme/units/rest-timer toggles, the runner's leverage and
// location — so one overlapping a foreground save is ordinary, not exotic.
//
// ⚠️ A LOCAL RUN CANNOT SHOW IT: LocalBackend resolves on the next microtask, so
// the window is zero. The fake cloud below has REAL latency (seeded jitter,
// 5–60 ms per read and per write), which is what Firestore gives a phone.
//
// 🔒 NO CLOUD. js/firebase-backend.js is swapped for an in-memory fake with a
// module hook before the store loads, and the test aborts if the swap did not
// take (the real module cannot load under node anyway).
import { registerHooks } from 'node:module';

const FAKE = `
const db = new Map();
const shared = new Map();
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const g = globalThis.__fakeCloud = { db, shared, writes: [], failNextSettingsWrite: false, publishes: 0,
  graph: { connections: [] } };
const copy = (v) => JSON.parse(JSON.stringify(v));
const lag = () => new Promise((r) => setTimeout(r, 5 + Math.floor(rnd() * 55)));
export const SHARDED_COLLECTIONS = [];
export function mergeRows(a, b) {
  const m = new Map();
  for (const r of [...(b || []), ...(a || [])]) m.set(r.id, r);
  return [...m.values()];
}
export const FirebaseBackend = {
  async ready() { return true; },
  currentUid() { return 'wesley'; },
  async read(c) { await lag(); return copy(db.get(c) || []); },
  async write(c, rows) {
    await lag();
    if (c === 'settings' && g.failNextSettingsWrite) { g.failNextSettingsWrite = false; throw new Error('offline'); }
    g.writes.push(c);
    db.set(c, copy(rows || []));
    return true;
  },
  async signUpEmail() { return { status: 'signed-in', created: true }; },
  async readGraph() { await lag(); return copy(g.graph); },
  async readShared() { return null; },
  async publishShared(audience, doc) { await lag(); g.publishes++; shared.set(audience, copy(doc)); return true; },
  async unpublishShared(audience) { await lag(); shared.delete(audience); return true; },
  async writeBackup() { return true; },
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

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
mem.set('ftrack:v1:lastCloudRollBackup', String(Date.now()));   // no backup sweep

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { store, social, auth } = await import('../js/store.js');
await store.getSettings();                          // connects the (fake) cloud
const cloud = globalThis.__fakeCloud;
if (!cloud) {
  console.log('FAIL  the fake cloud did not load — refusing to run anything that writes');
  process.exit(1);
}
ok(Boolean(cloud), 'the store is on the in-memory fake cloud with latency, not Firestore');
const row = () => (cloud.db.get('settings') || [])[0] || {};

/* ---- 1. Wesley's sequence: a background settings save is already in flight ---- */
// A brand-new account: no sharedTiersCleared, so the 2.5 s publish that
// saveProfile schedules will write settings too, overlapping whatever the
// person does next. Ten rounds with different jitter.
let kept = 0;
const ROUNDS = 10;
for (let i = 0; i < ROUNDS; i++) {
  cloud.db.set('settings', [{ id: 'settings', units: 'lbs' }]);
  const bg = store.saveSettings({ onboardedAt: 't' + i });            // onboarding.js, not awaited
  await store.saveProfile({ gender: 'male' });
  await store.saveSettings({ shareBodyWeight: true });
  await bg;
  const r = row();
  if (r.gender === 'male' && r.shareBodyWeight === true && r.onboardedAt === 't' + i && r.units === 'lbs') kept++;
}
ok(kept === ROUNDS, `🚨 with a background save in flight, gender + shareBodyWeight + onboardedAt all kept (${kept}/${ROUNDS} rounds)`);

/* ---- 2. eight fields saved at once from eight places ---- */
cloud.db.set('settings', [{ id: 'settings', units: 'kg' }]);
const fields = ['theme', 'palette', 'restTimer', 'moreDetails', 'defaultLocation', 'restTarget', 'displayName', 'birthYear'];
await Promise.all(fields.map((f, i) => store.saveSettings({ [f]: 'v' + i })));
const after = row();
const lost = fields.filter((f, i) => after[f] !== 'v' + i);
ok(lost.length === 0 && after.units === 'kg', `eight concurrent saves keep all eight fields and the old one (lost: ${lost.join(', ') || 'none'})`);

/* ---- 3. the live path end to end: saveProfile, then the publish timer overlaps setDisplayName ---- */
cloud.db.set('settings', [{ id: 'settings', units: 'lbs' }]);     // new account: tiers not cleared
await store.saveProfile({ gender: 'male' });
await store.saveSettings({ onboardedAt: 'now', shareBodyWeight: true });
await wait(2450);                                   // the publish debounce is about to fire
await Promise.all([
  social.setDisplayName('Wesley'),
  store.saveSettings({ theme: 'dark' }),
  store.logBodyWeight(230, '2026-03-17'),
]);
await wait(1500);                                   // let the timer's publish finish
const live = row();
ok(live.gender === 'male' && live.shareBodyWeight === true && live.displayName === 'Wesley'
   && live.theme === 'dark' && live.onboardedAt === 'now' && live.sharedTiersCleared === true,
  `after the publish timer overlaps a rename, every field is there: ${JSON.stringify(live)}`);

/* ---- 4. a failed write rejects to ITS caller and does not jam the next one ---- */
cloud.db.set('settings', [{ id: 'settings' }]);
cloud.failNextSettingsWrite = true;
const failed = store.saveSettings({ units: 'kg' }).then(() => 'resolved', () => 'rejected');
const next = store.saveSettings({ theme: 'light' }).catch(() => null);
ok(await failed === 'rejected', 'the save whose write failed still rejects to its caller');
const nextRow = await Promise.race([next, wait(3000).then(() => null)]);
ok(nextRow && nextRow.theme === 'light' && row().theme === 'light' && row().units === undefined,
  'and the save queued behind it still runs (the queue is not stuck on a rejection)');

/* ---- 5. sign-up does not write back a cloud settings row it merely read ---- */
// absorbThisDevice() used to read the cloud row and write the SAME row back,
// which is a read-modify-write that bypasses every guard and can erase a save
// that lands between its read and its write.
mem.set('ftrack:v1:settings', JSON.stringify([{ id: 'settings', units: 'kg', theme: 'light' }]));
mem.set('ftrack:v1:bodyWeight', JSON.stringify([{ id: 'bw-local', date: '2026-01-01', weight: 200 }]));
cloud.db.set('settings', [{ id: 'settings', units: 'lbs', gender: 'male' }]);
cloud.writes.length = 0;
await auth.signUpEmail('x@example.com', 'pw');
ok(!cloud.writes.includes('settings') && row().gender === 'male' && row().units === 'lbs',
  `sign-up leaves an existing cloud settings row alone (settings writes: ${cloud.writes.filter((c) => c === 'settings').length})`);
ok(cloud.writes.includes('bodyWeight'), 'while the device rows it is there for are still carried up');

await wait(3000);                                   // drain any publish timer
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
