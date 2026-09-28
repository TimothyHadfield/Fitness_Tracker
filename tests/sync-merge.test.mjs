// Two devices, one account — R-14, 2026-09-27. Runs against the Firestore
// EMULATOR, never the live project:
//
//   firebase emulators:exec --only firestore "node tests/sync-merge.test.mjs"
//
// Needs Java and @firebase/rules-unit-testing (see tests/rules.test.mjs).
//
// Each "device" is its own Firebase app signed in as the SAME uid, talking to
// the emulator through the real rules, driven through the same createListIO()
// and createShardIO() the app uses. Offline is the SDK's own disableNetwork(),
// so the write really is queued and replayed, not simulated.
//
// SYNC_OLD=1 swaps createListIO() for the pre-R-14 whole-list read/setDoc
// (transcribed from FirebaseBackend.read/write at HEAD 1eb1545), to watch the
// whole-list cases fail on the old code.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'firebase/firestore';
import * as fb from '../js/firebase-backend.js';

const here = dirname(fileURLToPath(import.meta.url));
const OLD = process.env.SYNC_OLD === '1';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const env = await initializeTestEnvironment({
  projectId: 'fitness-tracker-sync-test',
  firestore: {
    rules: readFileSync(join(here, '..', 'firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});
await env.clearFirestore();

// The old whole-list path, verbatim in behaviour: read the rows, write them all back.
function oldListIO(c, uid) {
  const ref = (name) => c.fs.doc(c.db, 'users', uid, 'collections', name);
  return {
    async read(collection) {
      const snap = await c.fs.getDoc(ref(collection));
      const data = snap.exists() ? snap.data() : null;
      return data && Array.isArray(data.rows) ? data.rows : [];
    },
    async write(collection, rows) {
      await c.fs.setDoc(ref(collection), { rows, updatedAt: c.fs.serverTimestamp() });
      return true;
    },
  };
}

const noCache = { get() { return null; }, set() {}, clear() {} };

let n = 0;
function device(uid) {
  const db = env.authenticatedContext(uid).firestore();
  const c = { fs, db };
  return {
    db,
    list: OLD ? oldListIO(c, uid) : fb.createListIO(c, uid),
    shard: fb.createShardIO(c, uid, noCache),
  };
}

// Realistically shaped rows: a program workout with exercises, like store.js saves.
const workout = (id, name) => ({
  id, name, systemId: 'sys1', createdAt: '2026-09-27T10:00:00.000Z',
  exercises: [
    { exerciseId: 'bench-press', sets: 3, notes: '' },
    { exerciseId: 'barbell-row', sets: 3, notes: '' },
  ],
});
const session = (id, date) => ({
  id, date, workoutId: 'w0', createdAt: `${date}T18:00:00.000Z`,
  entries: [
    { exerciseId: 'bench-press', sets: [{ weight: 185, reps: 8 }, { weight: 185, reps: 7 }, { weight: 185, reps: 6 }] },
    { exerciseId: 'barbell-row', sets: [{ weight: 155, reps: 10 }, { weight: 155, reps: 9 }] },
  ],
});
const ids = (rows) => rows.map((r) => r.id).sort().join(',');
const upsert = (rows, row) => [...rows.filter((r) => r.id !== row.id), row];

async function freshReader(uid) {
  // A THIRD client that has never seen the data: the server's truth.
  return device(uid);
}

/* ---------- 1. whole-list: both devices add at once ---------- */
{
  const uid = 'u-add-' + (++n);
  const A = device(uid), B = device(uid);
  await A.list.write('workouts', [workout('w0', 'Push')]);
  const a = await A.list.read('workouts');
  const b = await B.list.read('workouts');
  await Promise.all([
    A.list.write('workouts', upsert(a, workout('wA', 'Phone day'))),
    B.list.write('workouts', upsert(b, workout('wB', 'Laptop day'))),
  ]);
  const truth = await (await freshReader(uid)).list.read('workouts');
  ok(ids(truth) === 'w0,wA,wB',
     `workouts: two devices add at once, both survive (got ${ids(truth)})`);
}

/* ---------- 2. whole-list: delete on A, add on B, B still holding the row ---------- */
{
  const uid = 'u-del-' + (++n);
  const A = device(uid), B = device(uid);
  await A.list.write('goals', [workout('g0', 'Keep'), workout('gx', 'Delete me')]);
  const a = await A.list.read('goals');
  const b = await B.list.read('goals');
  await A.list.write('goals', a.filter((r) => r.id !== 'gx'));
  await B.list.write('goals', upsert(b, workout('gB', 'Added on B')));   // b still has gx
  let truth = await (await freshReader(uid)).list.read('goals');
  ok(ids(truth) === 'g0,gB', `goals: delete on A + add on B keeps the add, deleted row stays gone (got ${ids(truth)})`);
  // And B's NEXT write, from a fresh read, still does not bring gx back.
  const b2 = await B.list.read('goals');
  await B.list.write('goals', upsert(b2, workout('gC', 'Another')));
  truth = await (await freshReader(uid)).list.read('goals');
  ok(ids(truth) === 'g0,gB,gC', `goals: no zombie on B's next write (got ${ids(truth)})`);
}

/* ---------- 3. whole-list: offline write, then reconnect ---------- */
{
  const uid = 'u-off-' + (++n);
  const A = device(uid), B = device(uid);
  await A.list.write('bodyWeight', [{ id: 'bw0', date: '2026-09-20', weight: 180 }]);
  const a = await A.list.read('bodyWeight');
  await B.list.read('bodyWeight');
  await fs.disableNetwork(A.db);
  // Offline: the commit does not resolve until the connection returns.
  const pending = A.list.write('bodyWeight', upsert(a, { id: 'bwA', date: '2026-09-26', weight: 181 }));
  pending.catch(() => {});
  // Meanwhile B, online, adds one and deletes bw0.
  const b = await B.list.read('bodyWeight');
  await B.list.write('bodyWeight', upsert(b.filter((r) => r.id !== 'bw0'), { id: 'bwB', date: '2026-09-27', weight: 179 }));
  const seenOffline = await A.list.read('bodyWeight').catch(() => null);
  ok(Array.isArray(seenOffline) && seenOffline.some((r) => r.id === 'bwA'),
     'bodyWeight: the offline device sees its own write before reconnecting');
  await fs.enableNetwork(A.db);
  await pending;
  const truth = await (await freshReader(uid)).list.read('bodyWeight');
  ok(ids(truth) === 'bwA,bwB',
     `bodyWeight: offline write lands on reconnect, merged with B's add and delete (got ${ids(truth)})`);
}

/* ---------- 4. whole-list: both edit the same row → one row, nothing lost ---------- */
{
  const uid = 'u-edit-' + (++n);
  const A = device(uid), B = device(uid);
  await A.list.write('people', [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }]);
  const a = await A.list.read('people');
  const b = await B.list.read('people');
  await A.list.write('people', a.map((r) => (r.id === 'p1' ? { ...r, name: 'Alex A', updatedAt: '2026-09-27T10:00:00.000Z' } : r)));
  await B.list.write('people', b.map((r) => (r.id === 'p1' ? { ...r, name: 'Alex B', updatedAt: '2026-09-27T11:00:00.000Z' } : r)));
  const reader = await freshReader(uid);
  const truth = await reader.list.read('people');
  const p1 = truth.filter((r) => r.id === 'p1');
  ok(p1.length === 1 && p1[0].name === 'Alex B' && truth.length === 2,
     `people: same row edited on both → one copy, newer wins (got ${truth.map((r) => r.name).join(',')})`);
  // The next write from anybody heals the stored duplicate.
  await reader.list.write('people', upsert(truth, { id: 'p3', name: 'Jo' }));
  const raw = (await fs.getDoc(fs.doc(reader.db, 'users', uid, 'collections', 'people'))).data().rows;
  ok(raw.filter((r) => r.id === 'p1').length === 1 && raw.length === 3,
     `people: the next write leaves one stored copy of p1 (stored ${raw.length} rows)`);
}

/* ---------- 5. key order does not matter to arrayRemove ---------- */
if (!OLD) {
  const uid = 'u-order-' + (++n);
  const A = device(uid);
  await A.list.write('customExercises', [{ id: 'e1', name: 'Curl', muscle: 'biceps' }]);
  // Base recorded in the app's key order; now pretend the app sends a
  // reordered but equal row, then deletes it.
  await A.list.write('customExercises', [{ muscle: 'biceps', name: 'Curl', id: 'e1' }]);
  let raw = (await fs.getDoc(fs.doc(A.db, 'users', uid, 'collections', 'customExercises'))).data().rows;
  ok(raw.length === 1, `customExercises: a reordered-equal row is not duplicated (stored ${raw.length})`);
  await A.list.write('customExercises', []);
  raw = (await fs.getDoc(fs.doc(A.db, 'users', uid, 'collections', 'customExercises'))).data().rows;
  ok(raw.length === 0, `customExercises: and deleting it really deletes it (stored ${raw.length})`);
}

/* ---------- 6. settings stays one row (plain replace, the queue's job) ---------- */
{
  const uid = 'u-set-' + (++n);
  const A = device(uid), B = device(uid);
  await A.list.write('settings', [{ id: 'settings', units: 'lbs' }]);
  await A.list.read('settings'); await B.list.read('settings');
  await A.list.write('settings', [{ id: 'settings', units: 'kg' }]);
  await B.list.write('settings', [{ id: 'settings', units: 'lbs', theme: 'light' }]);
  const raw = (await fs.getDoc(fs.doc(A.db, 'users', uid, 'collections', 'settings'))).data().rows;
  ok(raw.length === 1, `settings: still exactly one row after two devices write (stored ${raw.length})`);
}

/* ---------- 7. restore from backup replaces ---------- */
if (!OLD) {
  const uid = 'u-rep-' + (++n);
  const A = device(uid);
  await A.list.write('systems', [workout('s1', 'Old'), workout('s2', 'Old 2')]);
  await A.list.write('systems', [workout('s9', 'From backup')], { wholesale: true, replace: true });
  const truth = await (await freshReader(uid)).list.read('systems');
  ok(ids(truth) === 's9', `systems: { replace: true } is still an exact replace (got ${ids(truth)})`);
}

/* ---------- 8–10. sessions (sharded, one document per row) ---------- */
{
  const uid = 'u-sess-' + (++n);
  const A = device(uid), B = device(uid);
  await A.shard.write('sessions', [session('s0', '2026-09-20')]);
  const a = await A.shard.read('sessions', []);
  const b = await B.shard.read('sessions', []);
  await Promise.all([
    A.shard.write('sessions', upsert(a, session('sA', '2026-09-27'))),
    B.shard.write('sessions', upsert(b, session('sB', '2026-09-27'))),
  ]);
  let truth = await (await freshReader(uid)).shard.read('sessions', []);
  ok(ids(truth) === 's0,sA,sB', `sessions: two devices log at once, both survive (got ${ids(truth)})`);

  const a2 = await A.shard.read('sessions', []);
  const b2 = await B.shard.read('sessions', []);
  await A.shard.write('sessions', a2.filter((r) => r.id !== 's0'));
  await B.shard.write('sessions', upsert(b2, session('sC', '2026-09-27')));   // b2 still has s0
  truth = await (await freshReader(uid)).shard.read('sessions', []);
  ok(ids(truth) === 'sA,sB,sC', `sessions: delete on A + add on B, deleted stays gone (got ${ids(truth)})`);

  const a3 = await A.shard.read('sessions', []);
  await fs.disableNetwork(A.db);
  const pending = A.shard.write('sessions', upsert(a3, session('sOff', '2026-09-27')));
  pending.catch(() => {});
  const b3 = await B.shard.read('sessions', []);
  await B.shard.write('sessions', upsert(b3, session('sD', '2026-09-27')));
  await fs.enableNetwork(A.db);
  await pending;
  truth = await (await freshReader(uid)).shard.read('sessions', []);
  ok(ids(truth) === 'sA,sB,sC,sD,sOff', `sessions: offline log lands on reconnect, merged (got ${ids(truth)})`);
}

await env.cleanup();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
