/* ------------------------------------------------------------------ *
 * LIVE CHECK — the shipped Firebase module against the REAL project.
 *
 * 🚨 THIS WRITES TO fitness-tracker-th. It is the only thing in this repository
 * that does, and it will not run without `--yes-write-to-live`.
 *
 * ⚠️ WHY IT EXISTS. Everything in `tests/` proves this app against a double or
 * against the emulator, and both are honest about what they are: a permission
 * question answered by the emulator, and arithmetic answered by the double.
 * Neither is a real server. Two things in this app have therefore only ever
 * been REVIEWED, and both of them fail silently if they are wrong:
 *
 *   1. **D32's publish** (2026-09-16). `validProjection()` pins the document
 *      with `hasOnly`, and `republish()` is fire-and-forget — its throw is
 *      swallowed at every call site. A rules deploy that did not land shows up
 *      as "nobody's page updates any more" with nothing on any screen saying
 *      so. The emulator can only ever tell you what the rules IN THIS WORKING
 *      TREE do, which is a different question from what the deployed ones do.
 *   2. **The read pattern** (2026-09-08, Open work 26). `where('updatedAt','>')`
 *      plus `getCountFromServer` is the whole cost model of the app —
 *      docs/running-costs.html — and a test double cannot bill anybody. The
 *      counts this tool prints ARE the billed reads.
 *
 * ⚠️ WHAT IT DOES NOT PROVE. It runs on a handful of sessions, so the mechanism
 * is verified and the SCALE is not; and it signs in anonymously, which the
 * rules treat identically to any other account (`request.auth != null`, and a
 * uid) but which is not the flow a real person takes to a published profile.
 *
 * ------------------------------------------------------------------
 * RUNNING IT
 *
 *   npm i --no-save firebase@10.12.2          (see the version note below)
 *   node tools/live-check.mjs --yes-write-to-live
 *
 * ⚠️ THE VERSION MATTERS AND THE TOOL PRINTS THE ONE IT USED. The app loads
 * 10.12.2 from gstatic; whatever is in `node_modules` may be something else
 * entirely, and "we proved it on a different client than the one users run" is
 * the sort of gap this file exists to close. Point `--sdk=<dir>` at a
 * node_modules holding the right version if the project's own has drifted —
 * that is how it was first run, so that installing an old SDK could not disturb
 * the one `tests/rules.test.mjs` needs.
 *
 * ⚠️ EVERY ACCOUNT IT CREATES IS THROWAWAY AND IT DELETES BOTH AT THE END, but
 * a crash mid-run leaves data behind. It prints both uids on every exit for
 * exactly that case; clean up with
 *
 *   firebase firestore:delete --recursive users/<uid> --force
 *
 * 🛑 AND NEVER "CLEAN UP TO ZERO". The project holds real accounts. Delete the
 * uids this tool printed and nothing else — docs/firebase-setup.md records the
 * day a stale "the project holds zero users" sentence was quoted into a brief
 * for an agent whose job involved deleting test accounts.
 * ------------------------------------------------------------------ */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const args = process.argv.slice(2);
if (!args.includes('--yes-write-to-live')) {
  console.error('live-check writes to the real fitness-tracker-th project.');
  console.error('Re-run with --yes-write-to-live if that is what you meant.');
  process.exit(2);
}

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const sdkArg = args.find((a) => a.startsWith('--sdk='));
const sdkRoot = sdkArg ? path.resolve(sdkArg.slice('--sdk='.length)) : ROOT;

/* Resolve the SDK from wherever it actually is, and say so. A bare
 * `import 'firebase/app'` would silently pick up whatever this file's own
 * directory can see, which is the whole question.
 *
 * ⚠️ The entry point comes out of the package's OWN export map rather than a
 * path typed here: `firebase/app` is `dist/index.mjs` under Node and
 * `dist/esm/index.esm.js` in a browser, and hard-coding either one is a
 * silent version trap the day the layout changes. */
const sdkDir = path.join(sdkRoot, 'node_modules', 'firebase');
const req = createRequire(pathToFileURL(path.join(sdkDir, 'package.json')).href);
const sdkPkg = req('./package.json');
const sdkVersion = sdkPkg.version;
const sdkEntry = (sub) => {
  const e = sdkPkg.exports[`./${sub}`];
  const rel = (e && e.node && e.node.import) || (e && e.default);
  if (!rel) throw new Error(`live-check: no ESM entry for firebase/${sub} in ${sdkDir}`);
  return pathToFileURL(path.join(sdkDir, rel)).href;
};

const APP_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const SHIM = new URL('./live-check-firestore.mjs', import.meta.url).href;

/* The app imports the SDK from a gstatic URL, which Node cannot fetch and which
 * is the point: redirecting it here is what makes THE SHIPPED MODULE the thing
 * under test rather than a lookalike written for the occasion. */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(APP_SDK)) {
      const tail = specifier.slice(APP_SDK.length);
      if (tail === 'firebase-firestore.js') return nextResolve(SHIM, context);
      const map = { 'firebase-app.js': 'app', 'firebase-auth.js': 'auth' };
      if (!map[tail]) throw new Error(`live-check: unmapped SDK import ${specifier}`);
      return { url: sdkEntry(map[tail]), shortCircuit: true };
    }
    // The shim's own `firebase/firestore`, resolved against the chosen SDK.
    if (specifier === 'firebase/firestore') {
      return { url: sdkEntry('firestore'), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/* ⚠️ THE SHARD CACHE LIVES IN localStorage AND NODE HAS NONE, so without this
 * `localShardCache()` returns a no-op, every read is a full read, and the
 * incremental path this tool exists to measure never runs at all — while every
 * correctness assertion still passes. A plain in-memory Storage is what a
 * browser hands it. */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
};

const warnings = [];
const realWarn = console.warn.bind(console);
console.warn = (...a) => { warnings.push(a.map(String).join(' ')); realWarn(...a); };

const js = (f) => pathToFileURL(path.join(ROOT, 'js', f)).href;
const shim = await import(SHIM);
const { FirebaseBackend } = await import(js('firebase-backend.js'));
const social = await import(js('social.js'));
const { FIREBASE_CONFIG } = await import(js('firebase-config.js'));

console.log(`SDK ${sdkVersion} from ${sdkRoot}`);
if (sdkVersion !== '10.12.2') {
  console.log(`⚠️  the app loads 10.12.2 from gstatic — this run is NOT on the shipped client`);
}
console.log(`project ${FIREBASE_CONFIG.projectId}`);

/* ------------------------------------------------------------------ */

let pass = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
async function denied(name, fn) {
  try {
    await fn();
    check(name, false, 'IT WAS ALLOWED');
  } catch (err) {
    const code = err && err.code ? err.code : String(err);
    check(name, code === 'permission-denied', `code=${code}`);
  }
}
async function allowed(name, fn) {
  try { await fn(); check(name, true); }
  catch (err) { check(name, false, `threw ${err && err.code ? err.code : err}`); }
}
const section = (t) => console.log(`\n== ${t}`);

/** Counts around one operation: what it cost on the wire, not what it should have. */
async function measured(fn) {
  shim.resetCounts();
  const out = await fn();
  return { out, c: { ...shim.counts } };
}

const session = (id, date) => ({
  id, date, workoutId: 'w1', workoutName: 'Push', startedAt: `${date}T10:00:00.000Z`,
  finishedAt: `${date}T11:00:00.000Z`, isBenchmark: false,
  entries: [{ exerciseId: 'bench-press', exerciseName: 'Bench Press', sets: [{ weight: 135, reps: 8 }] }],
});

let uidA = null;
let uidB = null;

try {
  section('S0 — two throwaway accounts');
  const who = await FirebaseBackend.ready();
  uidA = FirebaseBackend.currentUid();
  check('anonymous sign-in against the live project', !!uidA && who.isAnonymous, `uid ${uidA}`);

  // The reader gets its OWN app instance, so the module under test keeps
  // exactly one identity for the whole run.
  const { initializeApp } = await import(sdkEntry('app'));
  const { getAuth, signInAnonymously, deleteUser } = await import(sdkEntry('auth'));
  const { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } =
    await import(sdkEntry('firestore'));
  const appB = initializeApp(FIREBASE_CONFIG, 'live-check-reader');
  const authB = getAuth(appB);
  uidB = (await signInAnonymously(authB)).user.uid;
  const dbB = getFirestore(appB);
  check('a second signed-in account exists to read as', !!uidB && uidB !== uidA, `uid ${uidB}`);

  /* ================================================================
   * S1 — THE READ PATTERN. The aggregation query, the `>` against a real
   * server timestamp, and the rules' `list` on an aggregation: all three
   * reviewed and never executed until this tool existed.
   * ================================================================ */
  section('S1 — the incremental read pattern, on the wire');

  const rows0 = [session('s1', '2026-09-01'), session('s2', '2026-09-02'), session('s3', '2026-09-03')];
  await FirebaseBackend.read('sessions');          // fills the memo, exactly as store.js does
  await FirebaseBackend.write('sessions', rows0);

  const first = await measured(() => FirebaseBackend.read('sessions'));
  check('a cold read returns every session', first.out.length === 3, `${first.out.length} rows`);
  check('the cold read is a full read', first.c.getDocs === 1 && first.c.docsReturned === 3,
    `getDocs=${first.c.getDocs} docs=${first.c.docsReturned}`);

  const cached = JSON.parse(mem.get(`ftrack:v1:shardCache:${uidA}:sessions`) || 'null');
  check('the cursor is a REAL server timestamp, kept to the nanosecond',
    !!cached && cached.cursor.seconds > 1_600_000_000 && typeof cached.cursor.nanoseconds === 'number',
    cached ? `${cached.cursor.seconds}.${String(cached.cursor.nanoseconds).padStart(9, '0')}` : 'no cache');

  const idle = await measured(() => FirebaseBackend.read('sessions'));
  check('an unchanged sync returns the same three rows', idle.out.length === 3, `${idle.out.length} rows`);
  check('an unchanged sync bills ZERO document reads', idle.c.docsReturned === 0,
    `docs=${idle.c.docsReturned}, queries=${idle.c.queries}, counts=${idle.c.getCountFromServer}`);
  check('the aggregation count is accepted by the deployed rules', idle.c.getCountFromServer === 1);
  check('no fallback fired', !warnings.some((w) => w.includes('Incremental sync unavailable')));

  /* 🚨 THE ROWS THAT COME BACK ARE THE ONES TO MODIFY, and getting this wrong
   * is what the first version of this tool did — it rebuilt the untouched rows
   * from the same literals it had written, and the write rewrote all four.
   *
   * ⚠️ The reason is a property of `shardDiff` nothing had recorded, because
   * only a real server produces it: it compares `JSON.stringify(row)` against
   * the memo, and Firestore hands map keys back in an order of its OWN choosing
   * — `id,date,isBenchmark,workoutName,finishedAt,entries,workoutId,startedAt`
   * for a row written `id,date,workoutId,workoutName,…`. Same data, different
   * string, so every row reads as changed.
   *
   * 🛑 THIS IS NOT AN APP BUG and should not be "fixed": store.js does a
   * read-modify-write, so the rows it hands back ARE the objects the read
   * returned and the memo was built from, and they stringify identically. What
   * it does mean is that any path RECONSTRUCTING rows — restoring from a
   * downloaded backup file, say — pays a write per row rather than none.
   * Correct either way; the cost is the only thing at stake. */
  const rows1 = idle.out.map((r) => (r.id === 's1'
    ? { ...r, entries: [{ exerciseId: 'bench-press', exerciseName: 'Bench Press', sets: [{ weight: 145, reps: 8 }] }] }
    : r)).concat(session('s4', '2026-09-04'));
  const wrote = await measured(() => FirebaseBackend.write('sessions', rows1));
  check('a save writes only the rows that changed', wrote.c.batchSets === 2,
    `${wrote.c.batchSets} documents written of 4`);
  const inc = await measured(() => FirebaseBackend.read('sessions'));
  check('a changed sync returns four rows', inc.out.length === 4, `${inc.out.length} rows`);
  check('a changed sync bills only what changed', inc.c.docsReturned === 2 && inc.c.getDocs === 1,
    `docs=${inc.c.docsReturned} of 4`);
  check('the changed row came back updated',
    inc.out.find((r) => r.id === 's1')?.entries[0].sets[0].weight === 145);

  /* 🚨 THE CASE THE COUNT EXISTS FOR — a delete this device's cache never saw,
   * which is what another phone or another tab looks like from here. The
   * `where` query is structurally blind to it: a deleted document does not come
   * back changed, it does not come back at all. */
  section('S1b — a delete this device did not make');
  const raw = getFirestore();     // the same instance the app built, addressed directly
  const rawDelete = (id) => deleteDoc(doc(raw, 'users', uidA, 'sessions', id));
  const rawAdd = (row) => setDoc(doc(raw, 'users', uidA, 'sessions', row.id),
    { row, updatedAt: serverTimestamp() });

  await rawDelete('s4');
  const afterDel = await measured(() => FirebaseBackend.read('sessions'));
  check('an unseen delete is caught and the row disappears',
    afterDel.out.length === 3 && !afterDel.out.some((r) => r.id === 's4'), `${afterDel.out.length} rows`);
  check('catching it costs a full read, which is the designed fallback',
    afterDel.c.getDocs === 2, `getDocs=${afterDel.c.getDocs}`);

  // Delete one and add one: the raw count is unmoved, and the MERGE is what
  // fires. This is the subtle half of the mechanism.
  await FirebaseBackend.read('sessions');
  await rawDelete('s3');
  await rawAdd(session('s5', '2026-09-05'));
  const swap = await measured(() => FirebaseBackend.read('sessions'));
  check('delete-plus-add, with the count unmoved, is still caught',
    swap.out.length === 3 && !swap.out.some((r) => r.id === 's3') && swap.out.some((r) => r.id === 's5'),
    swap.out.map((r) => r.id).join(','));

  /* ================================================================
   * S2 — D32's PUBLISH against the DEPLOYED hasOnly list.
   * ================================================================ */
  section('S2 — D32: what every account now publishes');

  const publishInput = {
    viewers: [uidB],
    profile: { name: 'Live check', gender: 'female', age: 34 },
    connections: [{ uid: uidB, name: 'A Friend' }, { uid: 'someone-else', name: 'Another' }],
    sessions: [session('s1', '2026-09-01')],
    benchmarks: [{ date: '2026-09-01', exerciseId: 'bench-press', exerciseName: 'Bench Press', values: { weight: 135, reps: 8 } }],
    strength: null,
    bodyWeights: [{ date: '2026-09-01', weight: 160 }],
    shareBodyWeight: true,
    publishedAt: new Date().toISOString(),
  };

  const friendsDoc = social.buildProjection({ ...publishInput, audience: 'friends' });
  const publicDoc = social.buildProjection({ ...publishInput, audience: 'public' });
  check('the friends document carries gender, age and connections',
    friendsDoc.profile.gender === 'female' && friendsDoc.profile.age === 34 && friendsDoc.connections.length === 2);
  check('the public document carries them too, and no body weight',
    publicDoc.profile.gender === 'female' && publicDoc.connections.length === 2 && !('bodyWeight' in publicDoc));

  await allowed('the friends document is ACCEPTED by the deployed rules',
    () => FirebaseBackend.publishShared('friends', friendsDoc));
  await allowed('the public document is ACCEPTED by the deployed rules',
    () => FirebaseBackend.publishShared('public', publicDoc));

  const readBack = await FirebaseBackend.readShared(uidA, 'friends');
  check('the server holds profile.gender', readBack?.profile?.gender === 'female');
  check('the server holds profile.age', readBack?.profile?.age === 34);
  check('the server holds connections as {uid,name} rows',
    Array.isArray(readBack?.connections) && readBack.connections.length === 2
      && Object.keys(readBack.connections[0]).sort().join() === 'name,uid',
    JSON.stringify(readBack?.connections?.[0]));
  check('body weight reached the friends document', Array.isArray(readBack?.bodyWeight));

  const pubBack = await FirebaseBackend.readShared(uidA, 'public');
  check('the public document on the server has NO body weight', !!pubBack && !('bodyWeight' in pubBack));

  /* ⚠️ WITHOUT THESE, "the publish was accepted" ONLY PROVES THE RULES LET
   * SOMETHING THROUGH — not that the deployed ones are the new ones. Each of
   * these is refused by a clause that did not exist before 2026-09-16, or by
   * one whose list `connections` had to be added to. */
  section('S2b — negative controls: are the DEPLOYED rules the new ones?');
  await denied('a document carrying an unnamed key is refused',
    () => FirebaseBackend.publishShared('friends', { ...friendsDoc, nickname: 'probe' }));
  await denied('a PUBLIC document carrying body weight is refused on the wire',
    () => FirebaseBackend.publishShared('public', { ...publicDoc, bodyWeight: [{ date: '2026-09-01', weight: 160 }] }));
  await denied('a connections list over the cap is refused',
    () => FirebaseBackend.publishShared('friends', {
      ...friendsDoc,
      connections: Array.from({ length: 501 }, (_, i) => ({ uid: `u${i}`, name: 'x' })),
    }));
  await denied('a legacy tier id can never be written again',
    () => FirebaseBackend.publishShared('mid', friendsDoc));

  /* ⚠️ ABSENT IS NOT EMPTY. Every account published before 2026-09-16 has no
   * `connections` key at all, and those documents must still be writable — the
   * rule checks the field only where it is present. A rule that required one
   * would refuse the very accounts healStalePublish() exists to repair. */
  const noConnections = { ...friendsDoc };
  delete noConnections.connections;
  await allowed('a pre-D32 document with no connections key is still accepted',
    () => FirebaseBackend.publishShared('friends', noConnections));
  await allowed('and it republishes with connections again',
    () => FirebaseBackend.publishShared('friends', friendsDoc));

  /* ================================================================
   * S3 — THE READER. What the rules actually hand a second account.
   * ================================================================ */
  section('S3 — a second account reading it');
  const sharedRef = (owner, audience) => doc(dbB, 'users', owner, 'shared', audience);

  await allowed('a signed-in stranger may read the PUBLIC document', async () => {
    const s = await getDoc(sharedRef(uidA, 'public'));
    if (!s.exists()) throw new Error('missing');
    if (s.data().profile.gender !== 'female') throw new Error('wrong data');
  });
  await allowed('a viewer named in the friends document may read it', async () => {
    const s = await getDoc(sharedRef(uidA, 'friends'));
    if (!s.exists()) throw new Error('missing');
    if (!Array.isArray(s.data().connections)) throw new Error('no connections');
  });
  await denied('the reader may NOT write into the account it can read',
    () => setDoc(sharedRef(uidA, 'public'), publicDoc));
  await denied('the reader may NOT reach the private training behind it',
    () => getDoc(doc(dbB, 'users', uidA, 'sessions', 's1')));

  await FirebaseBackend.publishShared('friends',
    social.buildProjection({ ...publishInput, viewers: [], audience: 'friends' }));
  await denied('dropping them from viewers closes the friends document',
    () => getDoc(sharedRef(uidA, 'friends')));

  section('S4 — cleanup');
  await FirebaseBackend.unpublishShared('friends');
  await FirebaseBackend.unpublishShared('public');
  check('the published documents are gone',
    (await FirebaseBackend.readShared(uidA, 'friends')) === null
    && (await FirebaseBackend.readShared(uidA, 'public')) === null);
  const left = await FirebaseBackend.read('sessions');
  await FirebaseBackend.write('sessions', [], { wholesale: true });
  const after = await FirebaseBackend.read('sessions');
  check('every session document is deleted', after.length === 0, `was ${left.length}`);

  await deleteUser(authB.currentUser);
  await deleteUser(getAuth().currentUser);
  check('both throwaway accounts are deleted',
    getAuth().currentUser === null && authB.currentUser === null);
} catch (err) {
  console.log('\n!! live-check threw:', err && err.stack ? err.stack : err);
  failures.push(`threw: ${err && err.message}`);
} finally {
  console.log(`\nuids used: A=${uidA} B=${uidB}`);
  console.log(`${pass} passed, ${failures.length} failed`);
  if (failures.length) console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(failures.length ? 1 : 0);
}
