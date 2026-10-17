// Data-safety audit fixes — 2026-10-17.
//   node tests/datasafety-1017.test.mjs
//
// 1. Two overlapping session saves must BOTH survive — through the real
//    createShardIO() (sessions), the real createListIO() (every whole-list
//    collection) and the store itself (the per-collection queue). The trigger
//    seen in the audit: autoApplyHandoffs() saving a friend's group workout
//    while the person taps Save workout. Before the fix the later write diffed
//    against the earlier one's read and DELETED the other new workout.
// 2. A commit the server never answers (no signal after connecting) no longer
//    hangs Save workout: after a short wait it counts as queued.
// 3. Clear all and Restore republish what friends see and drop orphan photos.
// 6. Sign out clears the uid-keyed sessions snapshot.
//
// Seen FAILING on main (151b08b) before the fix, then passing.
//
// 🔒 NO CLOUD. The store's firebase-backend.js is swapped for an in-memory fake
// (same technique as settings-race.test.mjs); the real module is loaded under
// a `?real` URL only for its pure factories, driven by a fake Firestore.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const REAL = await import(new URL('../js/firebase-backend.js?real', import.meta.url).href);

/* ---------- a small fake Firestore with real latency ---------- */
function fakeFirestore() {
  const docs = new Map();                 // path -> data
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const tick = () => new Promise((r) => setTimeout(r, 2 + Math.floor(rnd() * 20)));
  const UNION = Symbol('union'), REMOVE = Symbol('remove');
  const applyMerge = (path, data) => {
    const cur = { ...(docs.get(path) || {}) };
    for (const [k, v] of Object.entries(data)) {
      if (v && v[UNION]) {
        const arr = Array.isArray(cur[k]) ? cur[k].slice() : [];
        for (const x of v[UNION]) if (!arr.some((y) => JSON.stringify(y) === JSON.stringify(x))) arr.push(x);
        cur[k] = arr;
      } else if (v && v[REMOVE]) {
        const out = Array.isArray(cur[k]) ? cur[k] : [];
        cur[k] = out.filter((y) => !v[REMOVE].some((x) => JSON.stringify(x) === JSON.stringify(y)));
      } else cur[k] = v;
    }
    docs.set(path, cur);
  };
  const fs = {
    collection: (db, ...p) => ({ path: p.join('/') }),
    doc: (a, ...p) => ({ path: (a && a.path ? [a.path, ...p] : p).join('/') }),
    async getDocs(col) {
      await tick();
      const out = [];
      for (const [k, v] of docs) {
        if (k.startsWith(col.path + '/') && k.split('/').length === col.path.split('/').length + 1) {
          out.push({ id: k.split('/').pop(), data: () => v });
        }
      }
      return { forEach: (f) => out.forEach(f) };
    },
    async getDoc(ref) { await tick(); const v = docs.get(ref.path); return { exists: () => !!v, data: () => v }; },
    async setDoc(ref, data) { await tick(); docs.set(ref.path, data); },
    writeBatch() {
      const ops = [];
      return {
        set: (r, d, o) => ops.push(['s', r, d, o]),
        delete: (r) => ops.push(['d', r]),
        async commit() {
          await tick();
          for (const [k, r, d, o] of ops) {
            if (k === 'd') docs.delete(r.path);
            else if (o && o.merge) applyMerge(r.path, d);
            else docs.set(r.path, d);
          }
        },
      };
    },
    arrayUnion: (...xs) => ({ [UNION]: xs }),
    arrayRemove: (...xs) => ({ [REMOVE]: xs }),
    serverTimestamp: () => ({ seconds: 1, nanoseconds: 0 }),
  };
  return { fs, docs };
}
const noCache = { get: () => null, set() {}, clear() {} };

/* ---- 1a. the sharded path (sessions): the auditor's repro ---- */
console.log('\n--- 1. Overlapping saves both survive ---\n');
{
  let both = 0;
  for (let round = 0; round < 10; round++) {
    const { fs, docs } = fakeFirestore();
    const io = REAL.createShardIO({ fs, db: {} }, 'u1', noCache);
    docs.set('users/u1/sessions/old', { row: { id: 'old', date: '2026-10-01' } });
    const save = async (id, ms) => {
      const rows = await io.read('sessions', []);
      await wait(ms);
      await io.write('sessions', [...rows, { id, date: '2026-10-17' }], { deletes: [] });
    };
    await Promise.all([save('mine', 0), save('s-h_friend', 30 + round * 3)]);
    const ids = [...docs.keys()].map((k) => k.split('/').pop()).sort();
    if (ids.join() === 'mine,old,s-h_friend') both++;
  }
  ok(both === 10, `🚨 sessions: Save workout + an auto-applied group workout at once keep BOTH (${both}/10 rounds)`);

  // The same overlap written the way the OLD store wrote it (no deletes list):
  // an ordinary write that leaves rows out must not delete them either.
  const { fs, docs } = fakeFirestore();
  const io = REAL.createShardIO({ fs, db: {} }, 'u1', noCache);
  docs.set('users/u1/sessions/a', { row: { id: 'a' } });
  docs.set('users/u1/sessions/b', { row: { id: 'b' } });
  await io.read('sessions', []);
  await io.write('sessions', [{ id: 'a' }, { id: 'c' }]);
  ok(docs.has('users/u1/sessions/b') && docs.has('users/u1/sessions/c'),
    'an ordinary sessions write never infers a delete from the shared memo');
  await io.write('sessions', [{ id: 'a' }, { id: 'c' }], { deletes: ['b'] });
  ok(!docs.has('users/u1/sessions/b'), 'while a NAMED delete still removes the workout');
  await io.write('sessions', [], { wholesale: true });
  ok(![...docs.keys()].some((k) => k.startsWith('users/u1/sessions/')),
    'and Clear all (wholesale, no list) still empties the collection');
}

/* ---- 1b. the whole-list path (benchmarks, people, workouts…) ---- */
{
  let both = 0;
  for (let round = 0; round < 10; round++) {
    const { fs, docs } = fakeFirestore();
    const io = REAL.createListIO({ fs, db: {} }, 'u1');
    docs.set('users/u1/collections/benchmarks', { rows: [{ id: 'old' }] });
    const save = async (id, ms) => {
      const rows = await io.read('benchmarks');
      await wait(ms);
      await io.write('benchmarks', [...rows, { id }], { deletes: [] });
    };
    await Promise.all([save('mine', 0), save('friend', 30 + round * 3)]);
    const ids = (docs.get('users/u1/collections/benchmarks').rows || []).map((r) => r.id).sort();
    if (ids.join() === 'friend,mine,old') both++;
  }
  ok(both === 10, `🚨 whole-list collections: overlapping saves keep BOTH rows (${both}/10 rounds)`);

  const { fs, docs } = fakeFirestore();
  const io = REAL.createListIO({ fs, db: {} }, 'u1');
  docs.set('users/u1/collections/goals', { rows: [{ id: 'g1' }, { id: 'g2' }] });
  await io.read('goals');
  await io.write('goals', [{ id: 'g1' }], { deletes: ['g2'] });
  ok(docs.get('users/u1/collections/goals').rows.map((r) => r.id).join() === 'g1',
    'a named delete still removes the row from the list');
  const plan = REAL.listMergePlan([{ id: 'x' }, { id: 'y' }], [{ id: 'x' }], new Set());
  ok(plan.removes.length === 0, 'listMergePlan with an empty delete list removes nothing it was not told to');
}

/* ---- 2. a commit with no signal does not hang Save workout ---- */
console.log('\n--- 2. No signal after connecting: Save finishes ---\n');
{
  REAL.setCommitWait(80);
  const never = new Promise(() => {});
  const t0 = Date.now();
  const out = await Promise.race([REAL.commitOrQueue(never), wait(2000).then(() => 'hung')]);
  ok(out === 'queued' && Date.now() - t0 < 1000, `a commit the server never answers counts as queued (${out}, ${Date.now() - t0} ms)`);
  ok(REAL.queuedWriteCount() === 1, 'and is counted as waiting to upload');

  let lateFail;
  const late = new Promise((_, rej) => { lateFail = rej; });
  const warn = console.warn; console.warn = () => {};
  ok(await REAL.commitOrQueue(late) === 'queued', 'a second one too');
  lateFail(new Error('permission-denied'));
  await wait(10);
  console.warn = warn;
  ok(REAL.queuedWriteCount() === 1, 'a queued write the server later refuses is logged, not thrown, and leaves the count');

  ok(await REAL.commitOrQueue(Promise.resolve()) === 'sent', 'a commit the server answers is "sent"');
  let refused = null;
  try { await REAL.commitOrQueue(Promise.reject(new Error('denied'))); } catch (e) { refused = e.message; }
  ok(refused === 'denied', 'and a quick refusal still reaches the caller as an error');

  // Through the real shard writer, with a writeBatch whose commit never resolves.
  const { fs, docs } = fakeFirestore();
  const hang = { ...fs, writeBatch() { const b = fs.writeBatch(); return { ...b, commit: () => new Promise(() => {}) }; } };
  const io = REAL.createShardIO({ fs: hang, db: {} }, 'u1', noCache);
  docs.set('users/u1/sessions/old', { row: { id: 'old' } });
  const rows = await io.read('sessions', []);
  const t1 = Date.now();
  const res = await Promise.race([io.write('sessions', [...rows, { id: 'new' }], { deletes: [] }), wait(2000).then(() => 'hung')]);
  ok(res === 'queued', `🚨 the sessions write returns "queued" instead of hanging (${res}, ${Date.now() - t1} ms)`);
  REAL.setCommitWait(REAL.COMMIT_WAIT_MS);
  ok(REAL.COMMIT_WAIT_MS === 4000, 'the real wait is 4 s');
}

/* ---- 6. sign out clears the sessions snapshot (source check: signOut needs real Firebase) ---- */
console.log('\n--- 6. Sign out ---\n');
{
  const src = readFileSync(new URL('../js/firebase-backend.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  async signOut() {'), src.indexOf('  async sendPasswordReset('));
  const clearAt = body.indexOf('.clear(leaving.uid, name)');
  const outAt = body.indexOf('c.auth.signOut(');
  ok(clearAt > 0 && outAt > clearAt, 'signOut clears ftrack:v1:shardCache:<uid>:* before signing out (source)');
  const mem = new Map([['ftrack:v1:shardCache:u9:sessions', '{}'], ['ftrack:v1:shardCache:u9:guestSessions', '{}']]);
  const cache = REAL.localShardCache({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) });
  for (const name of REAL.SHARDED_COLLECTIONS) cache.clear('u9', name);
  ok(mem.size === 0, 'and that clear removes both sharded snapshots for the uid');
}

/* ================= the store, on an in-memory cloud ================= */
const FAKE = `
const db = new Map();
let seed = 5;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const g = globalThis.__fakeCloud = { db, shared: new Map(), writes: [], publishes: 0, photoKeeps: [],
  graph: { connections: [] } };
const copy = (v) => JSON.parse(JSON.stringify(v));
const lag = () => new Promise((r) => setTimeout(r, 5 + Math.floor(rnd() * 45)));
export const SHARDED_COLLECTIONS = [];
export function mergeRows(a, b) {
  const m = new Map();
  for (const r of [...(b || []), ...(a || [])]) m.set(r.id, r);
  return [...m.values()];
}
export const FirebaseBackend = {
  async ready() { return true; },
  currentUid() { return 'u1'; },
  queuedWrites() { return g.queued || 0; },
  async read(c) { await lag(); return copy(db.get(c) || []); },
  // A plain whole-list replace, like LocalBackend: only the store's queue can
  // keep two overlapping read-modify-writes from losing a row here.
  async write(c, rows, opts) {
    await lag();
    g.writes.push({ c, deletes: opts && opts.deletes });
    db.set(c, copy(rows || []));
    return true;
  },
  async readGraph() { await lag(); return copy(g.graph); },
  async readShared() { return null; },
  async publishShared(audience, doc) { await lag(); g.publishes++; g.shared.set(audience, copy(doc)); return true; },
  async unpublishShared(audience) { await lag(); g.shared.delete(audience); return true; },
  async writeBackup() { return true; },
  async deletePhoto() { return true; },
  async deletePhotosExcept(keep) { await lag(); g.photoKeeps.push([...keep].sort()); return 0; },
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
mem.set('ftrack:v1:lastCloudRollBackup', String(Date.now()));

const { store } = await import('../js/store.js');
await store.getSettings();
const cloud = globalThis.__fakeCloud;
if (!cloud) { console.log('FAIL  the fake cloud did not load — refusing to run anything that writes'); process.exit(1); }

console.log('\n--- 1c. The store queues every read-modify-write ---\n');
{
  let both = 0;
  for (let round = 0; round < 10; round++) {
    cloud.db.set('sessions', [{ id: 'old', date: '2026-10-01', entries: [] }]);
    await Promise.all([
      store.saveSession({ id: 'mine-' + round, date: '2026-10-17', entries: [] }),
      store.saveSession({ id: 's-h_friend-' + round, date: '2026-10-17', entries: [] }),
    ]);
    const ids = (cloud.db.get('sessions') || []).map((r) => r.id);
    if (ids.includes('old') && ids.includes('mine-' + round) && ids.includes('s-h_friend-' + round)) both++;
  }
  ok(both === 10, `🚨 store.saveSession ×2 at once: both workouts are in the cloud (${both}/10 rounds)`);

  cloud.db.set('bodyWeight', []);
  await Promise.all([store.logBodyWeight(200, '2026-10-01'), store.logBodyWeight(201, '2026-10-02'),
    store.logBodyWeight(202, '2026-10-03')]);
  ok((cloud.db.get('bodyWeight') || []).length === 3, 'three weigh-ins logged at once all stay (the queue covers bodyWeight)');

  cloud.db.set('goals', []);
  await Promise.all([store.setGoal({ id: 'g1', muscle: 'chest' }), store.endGoal('none'), store.setGoal({ id: 'g2', muscle: 'back' })]);
  const goals = cloud.db.get('goals') || [];
  ok(goals.length === 2 && goals.filter((g) => g.status === 'active').length === 1,
    'goals saved at once: both kept, one active (the queue covers goals)');

  cloud.writes.length = 0;
  await store.deleteSession('mine-9');
  const del = cloud.writes.find((w) => w.c === 'sessions');
  ok(del && Array.isArray(del.deletes) && del.deletes.join() === 'mine-9',
    `deleteSession names exactly the id it deletes (${del && JSON.stringify(del.deletes)})`);
  cloud.writes.length = 0;
  await store.saveSession({ id: 'mine-1', date: '2026-10-18', entries: [] });
  const up = cloud.writes.find((w) => w.c === 'sessions');
  ok(up && Array.isArray(up.deletes) && up.deletes.length === 0, 'and a save names none');
}

console.log('\n--- 2b. The save screen can ask whether writes are queued ---\n');
{
  ok(store.queuedWrites() === 0, 'nothing queued: no line');
  cloud.queued = 2;
  ok(store.queuedWrites() === 2, 'queued writes are reported to the save screen');
  cloud.queued = 0;
  const src = readFileSync(new URL('../js/views-session.js', import.meta.url), 'utf8');
  ok(/if \(store\.queuedWrites\(\) > 0\) toast\('Saved on this phone — will upload\.'\)/.test(src),
    'the save screen shows "Saved on this phone — will upload." after a queued save');
}

console.log('\n--- 3. Clear all and Restore refresh what friends see ---\n');
{
  cloud.graph = { connections: [{ uid: 'f1', name: 'Friend' }] };
  cloud.db.set('settings', [{ id: 'settings', displayName: 'Me', sharedTiersCleared: true }]);
  cloud.db.set('sessions', [{ id: 's1', date: '2026-10-01', entries: [] }]);
  await wait(3000);                              // drain the save's publish timer
  cloud.publishes = 0; cloud.photoKeeps.length = 0;
  await store.clearAll();
  ok(cloud.publishes >= 1, `🔒 Clear all republishes the friends copy (${cloud.publishes} publish)`);
  const pub = cloud.shared.get('friends');
  ok(pub && Array.isArray(pub.activity) && pub.activity.length === 0,
    'and that copy holds no workouts any more');
  ok(cloud.photoKeeps.length === 1 && cloud.photoKeeps[0].length === 0, '🔒 and every cloud photo is deleted');

  cloud.publishes = 0; cloud.photoKeeps.length = 0;
  await store.importAll({ sessions: [{ id: 'r1', date: '2026-09-01', entries: [] }], settings: [{ id: 'settings', displayName: 'Me' }] });
  ok(cloud.publishes >= 1, `🔒 Restore republishes too (${cloud.publishes} publish)`);
  ok(cloud.photoKeeps.length === 1 && cloud.photoKeeps[0].join() === 'r1',
    'and keeps only the photos of workouts the backup holds');
}

await wait(3000);                                  // drain any publish timer
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
