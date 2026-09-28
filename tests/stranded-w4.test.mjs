// Offline edits, settings and deletes survive the reconnect — 2026-09-27
// (overhaul wave 4, DATA-FIX).   node tests/stranded-w4.test.mjs
//
// The bug: a signed-in person offline fixed 135 -> 185 on an old session. On
// reconnect the cloud's 135 won (saveSession never stamped updatedAt, so both
// copies had the same createdAt and the cloud wins a tie), and the phone's copy
// was deleted anyway. A units change made offline was skipped because the cloud
// already had a settings row, then deleted too. A session deleted offline came
// back, because only added or changed ids were carried.
//
// Never touches Firestore. Under node the Firebase SDK cannot load, so the store
// runs degraded (configured for the cloud, writing to this device), which is
// the state these writes happen in. The cloud is a fake {read, write} that
// applies the sharded backend's mass-delete limit.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const origError = console.error;
console.error = () => {};   // the degraded fallback logs by design

const S = await import('../js/store.js');
const FB = await import('../js/firebase-backend.js');
const NS = 'ftrack:v1:';
const FLAG = NS + 'strandedWrites';

function fakeCloud(initial) {
  const data = new Map(Object.entries(structuredClone(initial)));
  const writes = [];
  return {
    data, writes,
    async read(c) { return structuredClone(data.get(c) || []); },
    async write(c, rows) {
      const before = data.get(c) || [];
      const gone = before.filter((r) => !rows.some((n) => n.id === r.id)).length;
      if (gone > FB.MASS_DELETE_MAX) throw new Error(`Refusing to delete ${gone} ${c} rows in one write.`);
      writes.push({ c, rows: structuredClone(rows), gone });
      data.set(c, structuredClone(rows));
      return true;
    },
  };
}
const absorb = (cloud) => S.absorbStrandedWrites(cloud, {
  uid: null, mergeRows: FB.mergeRows, storage: localStorage,
  readLocal: async (c) => JSON.parse(mem.get(NS + c) || '[]'),
});
const device = (c) => JSON.parse(mem.get(NS + c) || '[]');
/** A fresh device holding `local`, with no flag. */
function reset(local) {
  mem.clear();
  for (const [c, rows] of Object.entries(local)) mem.set(NS + c, JSON.stringify(rows));
}

// A real-shaped synced session: 4 exercises, 3-4 sets each.
const sess = (id, date, extra = {}) => ({
  id, date, workoutId: 'w-push', workoutName: 'Push', createdAt: date + 'T17:00:00.000Z',
  entries: [
    { exerciseId: 'bench', exerciseName: 'Bench Press', sets: [{ weight: 135, reps: 5 }, { weight: 135, reps: 5 }, { weight: 135, reps: 5 }] },
    { exerciseId: 'ohp', exerciseName: 'Overhead Press', sets: [{ weight: 95, reps: 8 }, { weight: 95, reps: 8 }, { weight: 95, reps: 7 }] },
    { exerciseId: 'dips', exerciseName: 'Dips', sets: [{ reps: 12 }, { reps: 10 }, { reps: 9 }] },
    { exerciseId: 'tri-push', exerciseName: 'Triceps Pushdown', sets: [{ weight: 50, reps: 12 }, { weight: 50, reps: 12 }, { weight: 50, reps: 10 }, { weight: 50, reps: 9 }] },
  ],
  ...extra,
});
const history = Array.from({ length: 60 }, (_, i) => sess('s' + i, `2026-0${7 + Math.floor(i / 30)}-${String(1 + (i % 28)).padStart(2, '0')}`));

/* ---------- 1. an offline edit of a synced session wins ---------- */
{
  reset({ sessions: history });
  const cloud = fakeCloud({ sessions: history });
  const old = history[10];
  const fixed = structuredClone(old);
  fixed.entries[0].sets = fixed.entries[0].sets.map((s) => ({ ...s, weight: 185 }));
  const saved = await S.store.saveSession(fixed);
  ok(typeof saved.updatedAt === 'string' && saved.updatedAt > old.createdAt, `saveSession stamps updatedAt (${saved.updatedAt})`);
  const out = await absorb(cloud);
  const got = cloud.data.get('sessions').find((s) => s.id === old.id);
  ok(got.entries[0].sets[0].weight === 185, `the offline fix 135 -> 185 reaches the cloud (cloud says ${got.entries[0].sets[0].weight})`);
  ok(cloud.data.get('sessions').length === 60, 'no session lost or duplicated');
  ok(!out.failed.length && !mem.has(FLAG), 'everything merged, flag cleared');
}

/* ---------- 2. offline settings merge field by field ---------- */
{
  reset({ settings: [{ id: 'settings', units: 'lbs', gender: 'male', theme: 'dark' }] });
  const cloud = fakeCloud({ settings: [{ id: 'settings', units: 'lbs', gender: 'male', theme: 'dark', palette: 'teal' }] });
  await S.store.saveSettings({ units: 'kg', birthYear: 1999 });
  const out = await absorb(cloud);
  const row = cloud.data.get('settings')[0];
  ok(row.units === 'kg' && row.birthYear === 1999, `the offline units and birth year reach the cloud (${row.units}, ${row.birthYear})`);
  ok(row.gender === 'male' && row.palette === 'teal' && row.theme === 'dark', 'cloud fields not changed offline are kept (palette set on another device survives)');
  ok(cloud.data.get('settings').length === 1, 'still one settings row');
  ok(device('settings')[0] && device('settings')[0].units === 'kg', 'the device keeps its settings row');
  ok(!out.failed.length && !mem.has(FLAG), 'flag cleared');
}

/* ---------- 3. a NEWER cloud settings change beats an older offline one ---------- */
{
  reset({ settings: [{ id: 'settings', units: 'lbs' }] });
  await S.store.saveSettings({ units: 'kg' });
  const later = new Date(Date.now() + 3600e3).toISOString();
  const cloud = fakeCloud({ settings: [{ id: 'settings', units: 'lbs', updatedAt: later }] });
  await absorb(cloud);
  ok(cloud.data.get('settings')[0].units === 'lbs', 'a cloud change made after the offline one wins');
  ok(device('settings')[0]?.units === 'kg', 'and the device copy is not deleted');
}

/* ---------- 4. an offline delete stays deleted ---------- */
{
  reset({ sessions: history });
  const cloud = fakeCloud({ sessions: history });
  await S.store.deleteSession('s5');
  await absorb(cloud);
  const ids = cloud.data.get('sessions').map((s) => s.id);
  ok(!ids.includes('s5') && ids.length === 59, `a session deleted offline stays deleted (${ids.length} left)`);
  ok(!mem.has(FLAG), 'flag cleared');
}

/* ---------- 5. three deletes: each cloud write stays under the mass-delete guard ---------- */
{
  reset({ sessions: history });
  const cloud = fakeCloud({ sessions: history });
  for (const id of ['s1', 's2', 's3']) await S.store.deleteSession(id);
  const out = await absorb(cloud);
  const ids = cloud.data.get('sessions').map((s) => s.id);
  ok(!['s1', 's2', 's3'].some((id) => ids.includes(id)) && ids.length === 57, `all three offline deletes land (${ids.length} left)`);
  ok(cloud.writes.every((w) => w.gone <= FB.MASS_DELETE_MAX) && !out.failed.length, 'no single write deletes more than the guard allows');
}

/* ---------- 6. a delete loses to a later edit from another device ---------- */
{
  reset({ sessions: history });
  await S.store.deleteSession('s7');
  const edited = { ...history[7], note: 'edited on the laptop', updatedAt: new Date(Date.now() + 3600e3).toISOString() };
  const cloud = fakeCloud({ sessions: history.map((s) => (s.id === 's7' ? edited : s)) });
  await absorb(cloud);
  ok(cloud.data.get('sessions').some((s) => s.id === 's7'), 'a row edited elsewhere after the offline delete is kept');
}

/* ---------- 7. a stranded row the cloud did not take stays on the device ---------- */
{
  reset({ sessions: history });
  const mine = structuredClone(history[20]);
  mine.entries[1].sets[0].weight = 100;
  await S.store.saveSession(mine);
  const theirs = { ...history[20], note: 'newer, from the laptop', updatedAt: new Date(Date.now() + 3600e3).toISOString() };
  const cloud = fakeCloud({ sessions: history.map((s) => (s.id === 's20' ? theirs : s)) });
  await absorb(cloud);
  ok(cloud.data.get('sessions').find((s) => s.id === 's20').note === 'newer, from the laptop', 'the newer cloud copy wins the conflict');
  const kept = device('sessions').find((s) => s.id === 's20');
  ok(kept && kept.entries[1].sets[0].weight === 100, 'the losing offline copy is NOT deleted from the device');
}

/* ---------- 8. add then delete offline: nothing reaches the cloud ---------- */
{
  reset({ sessions: history });
  const cloud = fakeCloud({ sessions: history });
  const s = await S.store.saveSession(sess(undefined, '2026-09-27'));
  await S.store.deleteSession(s.id);
  await absorb(cloud);
  ok(cloud.data.get('sessions').length === 60 && !cloud.data.get('sessions').some((r) => r.id === s.id), 'a row added and deleted offline never appears');
}

/* ---------- 9. Clear all offline is NOT carried (no cloud snapshot possible) ---------- */
{
  reset({ sessions: history, bodyWeight: [{ id: 'bw1', date: '2026-09-01', weight: 180 }] });
  const cloud = fakeCloud({ sessions: history, bodyWeight: [{ id: 'bw1', date: '2026-09-01', weight: 180 }] });
  await S.store.clearAll();
  await absorb(cloud);
  ok(cloud.data.get('sessions').length === 60 && cloud.data.get('bodyWeight').length === 1, 'an offline wipe does not empty the account');
}

console.error = origError;
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
