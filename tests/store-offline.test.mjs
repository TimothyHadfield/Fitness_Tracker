// Writes made while the cloud was unreachable reach the account — 2026-09-27
// (overhaul R-1b, R-1c, R-2, R-3).   node tests/store-offline.test.mjs
//
// Never touches Firestore: the cloud here is a fake `{read, write}` and the
// device is a Map standing in for localStorage. Under node the Firebase SDK
// cannot load (its URL is https), so the store really does run degraded —
// configured for the cloud, writing to this device — which is exactly the
// state R-1 is about.
//
// Pinned:
//   - a write that lands on this device while the cloud is wanted sets the
//     `strandedWrites` flag, and store.isDegraded() says so;
//   - absorbStrandedWrites() merges add-only: every cloud row survives, the
//     offline rows arrive, the newer copy of a row wins, and it NEVER writes an
//     empty or shorter list (the zero-guard's promise);
//   - an offline settings change merges into the cloud row field by field
//     (wave 4; tests/stranded-w4.test.mjs has the rest);
//   - a different account connecting gets nothing;
//   - a failed collection keeps its local copy and the flag for next time;
//   - clearAllShardCaches() drops only shard snapshots;
//   - persistStorage() asks once and never throws.
const mem = new Map();
const fakeStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.localStorage = fakeStorage;
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const origError = console.error;
console.error = () => {};   // the degraded fallback logs by design

const S = await import('../js/store.js');
const FB = await import('../js/firebase-backend.js');
const { IS_CONFIGURED } = await import('../js/firebase-config.js');
const NS = 'ftrack:v1:';

/* ---------- the flag is set by a write that could not reach the cloud ---------- */
{
  ok(IS_CONFIGURED, 'the app is configured for the cloud (so this run is the degraded case)');
  ok(typeof S.store.isDegraded === 'function' && (await S.store.isDegraded()) === true,
     'store.isDegraded() is true: configured, but running on this device');
  const st = await S.auth.state();
  ok(st.degraded === true, 'auth.state() agrees');
  ok(!mem.has(NS + 'strandedWrites'), 'no flag before anything is written');
  await S.store.saveSettings({ units: 'kg' });
  ok(mem.has(NS + 'strandedWrites'), 'a write while degraded sets strandedWrites');

  // Rows already on this device from long ago (adoptLocalData leaves them) are
  // NOT marked: only what was written while stranded is carried up later.
  mem.set(NS + 'sessions', JSON.stringify([{ id: 'old1', date: '2025-01-01', entries: [] }]));
  const s = await S.store.saveSession({ date: '2026-09-27', workoutName: 'Basement', entries: [] });
  const flag = JSON.parse(mem.get(NS + 'strandedWrites'));
  ok(flag.ids && flag.ids.sessions && flag.ids.sessions.length === 1 && flag.ids.sessions[0] === s.id,
     `only the new session is marked (${flag.ids && JSON.stringify(flag.ids.sessions)})`);
  ok(flag.ids.settings && flag.ids.settings.includes('settings'), 'and the settings row that changed');
}

/* ---------- the merge ---------- */
const day = (n) => `2026-09-${String(n).padStart(2, '0')}`;
const session = (id, date, updatedAt) => ({ id, date, createdAt: updatedAt, updatedAt, entries: [] });
function fakeCloud(initial, { failOn } = {}) {
  const data = new Map(Object.entries(structuredClone(initial)));
  const writes = [];
  return {
    data, writes,
    async read(c) { return structuredClone(data.get(c) || []); },
    async write(c, rows) {
      if (failOn === c) throw new Error('offline again');
      writes.push({ c, rows: structuredClone(rows) });
      data.set(c, structuredClone(rows));
      return true;
    },
  };
}
function deviceWith(local, flag) {
  const m = new Map();
  const st = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
  for (const [c, rows] of Object.entries(local)) m.set(NS + c, JSON.stringify(rows));
  // By default every local row counts as written while stranded.
  if (flag) {
    const ids = flag.ids || Object.fromEntries(Object.entries(local).map(([c, rows]) => [c, rows.map((r) => r.id)]));
    m.set(NS + 'strandedWrites', JSON.stringify({ ...flag, ids }));
  }
  return { m, st, readLocal: async (c) => (m.has(NS + c) ? JSON.parse(m.get(NS + c)) : []) };
}

{
  ok(typeof S.absorbStrandedWrites === 'function', 'absorbStrandedWrites is exported');
  // A real-sized account: 120 sessions, 30 weigh-ins, 6 workouts, one settings row.
  const cloudSessions = Array.from({ length: 120 }, (_, i) => session('c' + i, day(1 + (i % 28)), '2026-09-01T10:00:00Z'));
  const cloud = fakeCloud({
    sessions: cloudSessions,
    bodyWeight: Array.from({ length: 30 }, (_, i) => ({ id: 'bw' + i, date: day(1 + (i % 28)), weight: 180 })),
    workouts: Array.from({ length: 6 }, (_, i) => ({ id: 'w' + i, name: 'W' + i, updatedAt: '2026-09-10T00:00:00Z' })),
    settings: [{ id: 'settings', units: 'lbs', gender: 'male' }],
  });
  const device = deviceWith({
    // Two workouts logged in a basement, plus a stale copy of a cloud row.
    sessions: [session('off1', day(26), '2026-09-26T18:00:00Z'), session('off2', day(27), '2026-09-27T18:00:00Z'),
      session('c0', day(1), '2026-08-01T00:00:00Z')],
    // An edit made offline that is NEWER than the cloud's copy.
    workouts: [{ id: 'w2', name: 'W2 renamed', updatedAt: '2026-09-27T09:00:00Z' }],
    settings: [{ id: 'settings', units: 'kg' }],
    goals: [],
  }, { at: '2026-09-27T18:00:00Z', uid: 'u1' });

  const out = await S.absorbStrandedWrites(cloud, { uid: 'u1', mergeRows: FB.mergeRows, storage: device.st, readLocal: device.readLocal });
  const sessions = cloud.data.get('sessions');
  ok(sessions.length === 122, `the two offline workouts reach the account (${sessions.length} = 120 + 2)`);
  ok(cloudSessions.every((c) => sessions.some((s) => s.id === c.id)), 'every cloud session survives');
  ok(sessions.find((s) => s.id === 'c0').updatedAt === '2026-09-01T10:00:00Z', 'an older local copy never replaces the cloud row');
  ok(cloud.data.get('workouts').find((w) => w.id === 'w2').name === 'W2 renamed', 'a newer offline edit wins');
  ok(cloud.data.get('workouts').length === 6, 'no workout is lost or duplicated');
  // Wave 4: the offline units change wins field by field (the cloud row has no
  // newer updatedAt); fields not changed offline are kept.
  ok(cloud.data.get('settings')[0].units === 'kg' && cloud.data.get('settings')[0].gender === 'male',
     'an offline settings change merges into the cloud row, other fields kept');
  ok(!cloud.writes.some((w) => !w.rows.length), 'nothing is ever written as an empty list');
  ok(!cloud.writes.some((w) => w.c === 'bodyWeight' || w.c === 'goals'), 'a collection with nothing offline is not written at all');
  ok(!device.m.has(NS + 'strandedWrites'), 'the flag is cleared once everything merged');
  // Wave 4: only rows the cloud took leave; the stale c0 copy lost and stays.
  ok(JSON.parse(device.m.get(NS + 'sessions') || '[]').map((s) => s.id).join() === 'c0' && !device.m.has(NS + 'workouts'),
     'the merged local copies are removed; the one the cloud did not take stays');
  ok(out.merged.includes('sessions') && !out.failed.length, `reported: merged ${out.merged.join(', ')}`);

  // Running it again with no flag is a no-op.
  const n = cloud.writes.length;
  await S.absorbStrandedWrites(cloud, { uid: 'u1', mergeRows: FB.mergeRows, storage: device.st, readLocal: device.readLocal });
  ok(cloud.writes.length === n, 'with no flag, nothing happens');
}

{
  // An OLD local row (from before the cloud, deleted there since) is not
  // written while stranded, so it must not come back, and it stays put here.
  const cloud = fakeCloud({ sessions: [session('c1', day(1), '2026-09-01T00:00:00Z')] });
  const device = deviceWith({
    sessions: [session('deletedInCloud', day(2), '2026-08-02T00:00:00Z'), session('off1', day(26), '2026-09-26T18:00:00Z')],
  }, { uid: 'u1', ids: { sessions: ['off1'] } });
  await S.absorbStrandedWrites(cloud, { uid: 'u1', mergeRows: FB.mergeRows, storage: device.st, readLocal: device.readLocal });
  const ids = cloud.data.get('sessions').map((s) => s.id).sort();
  ok(ids.join() === 'c1,off1', `only the stranded row is carried; a cloud-deleted one stays deleted (${ids.join(', ')})`);
  const left = JSON.parse(device.m.get(NS + 'sessions') || '[]').map((s) => s.id);
  ok(left.join() === 'deletedInCloud', 'the carried row leaves the device and the old one is untouched');
}

{
  // A different account connects on this device: nothing is merged into it.
  const cloud = fakeCloud({ sessions: [session('x1', day(3), '2026-09-03T00:00:00Z')] });
  const device = deviceWith({ sessions: [session('off1', day(26), '2026-09-26T18:00:00Z')] }, { uid: 'u1' });
  const out = await S.absorbStrandedWrites(cloud, { uid: 'someone-else', mergeRows: FB.mergeRows, storage: device.st, readLocal: device.readLocal });
  ok(out.skipped === 'other-account' && !cloud.writes.length, 'another account gets none of this device\'s offline rows');
  ok(device.m.has(NS + 'sessions') && device.m.has(NS + 'strandedWrites'), 'and the rows stay on the device');
}

{
  // One collection fails: its local copy and the flag stay for the next connect.
  const cloud = fakeCloud({ sessions: [session('c1', day(1), '2026-09-01T00:00:00Z')], workouts: [] }, { failOn: 'workouts' });
  const device = deviceWith({
    sessions: [session('off1', day(26), '2026-09-26T18:00:00Z')],
    workouts: [{ id: 'wN', name: 'New', updatedAt: '2026-09-27T00:00:00Z' }],
  }, { uid: 'u1' });
  const out = await S.absorbStrandedWrites(cloud, { uid: 'u1', mergeRows: FB.mergeRows, storage: device.st, readLocal: device.readLocal });
  ok(out.failed.includes('workouts') && device.m.has(NS + 'workouts'), 'a failed collection keeps its local copy');
  ok(device.m.has(NS + 'strandedWrites'), 'and the flag stays, so the next connection tries again');
  ok(cloud.data.get('sessions').length === 2 && !device.m.has(NS + 'sessions'), 'the collections that did merge are done');
}

{
  // A merge that would SHRINK the cloud (rows without ids) is refused.
  const cloud = fakeCloud({ bodyWeight: [{ date: day(1), weight: 180 }, { date: day(2), weight: 181 }, { id: 'b3', date: day(3), weight: 182 }] });
  const device = deviceWith({ bodyWeight: [{ id: 'b9', date: day(27), weight: 183 }] }, { uid: 'u1' });
  const out = await S.absorbStrandedWrites(cloud, { uid: 'u1', mergeRows: FB.mergeRows, storage: device.st, readLocal: device.readLocal });
  ok(!cloud.writes.length && cloud.data.get('bodyWeight').length === 3, 'a merge that would drop cloud rows is never written');
  ok(out.failed.includes('bodyWeight') && device.m.has(NS + 'bodyWeight'), 'and the offline rows are kept for later');
}

/* ---------- R-2: clearAllShardCaches ---------- */
{
  ok(typeof FB.clearAllShardCaches === 'function', 'firebase-backend exports clearAllShardCaches');
  const m = new Map([
    ['ftrack:v1:shardCache:u1:sessions', 'x'.repeat(1000)],
    ['ftrack:v1:shardCache:u2:guestSessions', 'y'],
    ['ftrack:v1:sessionDraft', '{"keep":true}'],
    ['ftrack:v1:settings', '[]'],
  ]);
  const st = {
    getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
  const gone = FB.clearAllShardCaches(st);
  ok(gone === 2 && m.size === 2, `both shard snapshots go (${gone}) and nothing else does`);
  ok(m.has('ftrack:v1:sessionDraft') && m.has('ftrack:v1:settings'), 'the draft and the data stay');
  ok(FB.clearAllShardCaches({ get length() { throw new Error('denied'); } }) === 0, 'storage denied: 0, no throw');
}

/* ---------- R-3: persistStorage ---------- */
{
  ok(typeof S.persistStorage === 'function', 'persistStorage is exported for app.js');
  let asked = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { storage: { persisted: async () => false, persist: async () => { asked++; return true; } } },
  });
  const a = await S.persistStorage();
  const b = await S.persistStorage();
  ok(a === true && b === true && asked === 1, 'asks the browser once and reports the answer');
}

console.error = origError;
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
