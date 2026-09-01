// Data layer.
//
// Everything the app reads/writes goes through `store`. The API is async from day one so a
// remote backend can replace the local one without touching any view code.
//
// Current backend: LocalBackend (browser localStorage).
// To switch to Firebase: fill in js/firebase-config.js and set BACKEND = 'firebase' below.
// See docs/firebase-setup.md.

import { BUILT_IN_EXERCISES } from './exercises.js';
// ⚠️ isRankableSet moved out with the observation walk — it now lives beside
// the D5 gate it guards, in strength-observations.js. Nothing else here rated
// a set.
import { e1rm, normalizeWeight, modalReps, canNormalize, clampReps } from './e1rm.js';
import { normalizeGroups, plannedMinis, isNested } from './set-types.js';
import { recordedSetCount } from './session-stats.js';
import { IS_CONFIGURED } from './firebase-config.js';

const BACKEND = 'auto'; // 'auto' | 'local' | 'firebase'
const NS = 'ftrack:v1:';

// ⚠️ Adding a collection here also requires adding it to knownCollection() in
// firestore.rules and redeploying, or every cloud write to it is denied.
const COLLECTIONS = ['customExercises', 'workouts', 'sessions', 'benchmarks', 'settings', 'bodyWeight', 'systems', 'goals', 'guestSessions', 'people'];

/* ------------------------------------------------------------------ *
 * Local backend
 * ------------------------------------------------------------------ */

const LocalBackend = {
  async read(collection) {
    try {
      const raw = localStorage.getItem(NS + collection);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to read ' + collection, err);
      return [];
    }
  },

  async write(collection, rows) {
    try {
      localStorage.setItem(NS + collection, JSON.stringify(rows));
      return true;
    } catch (err) {
      console.error('Failed to write ' + collection, err);
      throw new Error('Could not save. Your browser storage may be full.');
    }
  },
};

/* ------------------------------------------------------------------ *
 * Demo backend — a year of invented training, in memory only
 *
 * ⚠️ THE POINT OF THIS BACKEND IS WHAT IT CANNOT DO. It holds a Map. It has no
 * path to localStorage and no path to Firestore, so while the demo is on there
 * is no sequence of taps — editing a workout, deleting a system, importing a
 * backup, clearing all data — that can reach anybody's real records. That is a
 * stronger guarantee than writing demo rows to a separate namespace and tidying
 * up afterwards, because there is no tidying step left to fail.
 *
 * It is seeded on first read and reseeded on every page load, which is exactly
 * what Tim asked for: edit whatever you like, and it is back to the default the
 * next time you come in.
 * ------------------------------------------------------------------ */

const MemoryBackend = {
  rows: new Map(),
  // ⚠️ A PROMISE, NOT A BOOLEAN, and this is the third time this project has
  // met that distinction — see `ensureSystems()` in §4 of progress.md.
  //
  // A boolean set before an `await` marks the work as DONE at the moment it
  // STARTS. Every concurrent caller then skips the wait and reads rows that are
  // not there yet. `muscleStrength()` does exactly that: one `Promise.all` over
  // profile, benchmarks, sessions and exercises, four reads racing a seed that
  // has only just begun. The result was that entering the demo could show the
  // muscle map asking for a body weight on an account holding 53 weigh-ins —
  // then correcting itself on the next render, which is the signature of this
  // bug and the reason it survives casual testing.
  //
  // Holding the promise makes every caller await the same seed, whether they
  // are first or fifth. Caught 2026-08-19.
  seeding: null,

  async seed() {
    if (this.seeding) return this.seeding;
    this.seeding = (async () => {
    const [{ buildDemoData }, current] = await Promise.all([
      import('./demo.js'),
      // The real settings, read straight off this device rather than through
      // the store — `active()` is mid-flight at this point and asking it would
      // deadlock. Only two fields are taken, and both for the same reason:
      // a demo that flips somebody from kg to lbs or light to dark reads as
      // the app breaking rather than as a demo starting.
      LocalBackend.read('settings').then((r) => r[0] || {}).catch(() => ({})),
    ]);
    const data = buildDemoData({
      today: todayISO(),
      units: current.units === 'kg' ? 'kg' : 'lbs',
      theme: current.theme === 'light' ? 'light' : 'dark',
      // Same reasoning as units and theme: a demo that flips somebody's
      // colour palette reads as the app breaking, not as a demo starting.
      palette: ['teal', 'indigo', 'ember'].includes(current.palette) ? current.palette : 'gold',
    });
    for (const c of COLLECTIONS) this.rows.set(c, data[c] ? structuredClone(data[c]) : []);
    })();
    // A failed seed must not latch. Leaving a rejected promise here would make
    // every later read reject too, turning one transient import failure into a
    // permanently broken demo.
    this.seeding.catch(() => { this.seeding = null; });
    return this.seeding;
  },

  async read(collection) {
    await this.seed();
    return structuredClone(this.rows.get(collection) || []);
  },

  async write(collection, rows) {
    await this.seed();
    this.rows.set(collection, structuredClone(rows || []));
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Firebase backend — loaded lazily, only when switched on
 * ------------------------------------------------------------------ */

// 'auto' means: use the cloud the moment real keys are pasted into
// js/firebase-config.js, and stay on this device until then. Nothing else has
// to change to switch over.
const wantRemote = () => BACKEND === 'firebase' || (BACKEND === 'auto' && IS_CONFIGURED);

let activePromise = null;
let remoteImpl = null;
let remoteFailure = null;

async function active() {
  if (activePromise) return activePromise;

  activePromise = (async () => {
    // ⚠️ FIRST, before anything else and before any cloud connection. The demo
    // must be incapable of reading or writing a real record, so it short-
    // circuits above the branch that would reach for Firestore rather than
    // being layered on top of it.
    if (demo.active()) return MemoryBackend;
    if (!wantRemote()) return LocalBackend;
    try {
      const mod = await import('./firebase-backend.js');
      await mod.FirebaseBackend.ready();
      remoteImpl = mod.FirebaseBackend;
      remoteFailure = null;
      await adoptLocalData(mod);
      return remoteImpl;
    } catch (err) {
      // Losing the cloud must never stop someone logging a set mid-workout.
      // Fall back to this device and surface it in Settings instead of failing.
      console.error('Cloud backend unavailable — using this device only.', err);
      remoteFailure = err;
      return LocalBackend;
    }
  })();

  return activePromise;
}

// The day the cloud is switched on, everyone who has been logging locally would
// otherwise open the app to a brand-new empty account and conclude their history
// was destroyed. So on the FIRST successful cloud connection, if the account is
// empty and this device is not, carry the data up automatically.
//
// Deliberately narrow, because silent data movement is worth being paranoid
// about: it only runs when every cloud collection is empty, so it cannot
// overwrite anything, and a marker stops it ever running twice. Failure is
// swallowed — the manual "Upload from this device" button in Account remains,
// and a failed migration must not stop the app loading.
const ADOPTED_KEY = NS + 'adoptedIntoCloud';

async function adoptLocalData(mod) {
  try {
    if (localStorage.getItem(ADOPTED_KEY)) return;

    const localCounts = await Promise.all(COLLECTIONS.map((c) => LocalBackend.read(c)));
    const hasLocal = localCounts.some((rows, i) => COLLECTIONS[i] !== 'settings' && rows.length);
    if (!hasLocal) { localStorage.setItem(ADOPTED_KEY, 'nothing-to-adopt'); return; }

    const remote = await Promise.all(COLLECTIONS.map((c) => mod.FirebaseBackend.read(c)));
    const cloudEmpty = remote.every((rows, i) => COLLECTIONS[i] === 'settings' || !rows.length);
    if (!cloudEmpty) { localStorage.setItem(ADOPTED_KEY, 'cloud-already-had-data'); return; }

    for (let i = 0; i < COLLECTIONS.length; i++) {
      if (localCounts[i].length) await mod.FirebaseBackend.write(COLLECTIONS[i], localCounts[i]);
    }
    localStorage.setItem(ADOPTED_KEY, new Date().toISOString());
    console.info('Local data carried into your new cloud account.');
  } catch (err) {
    console.error('Could not carry local data into the cloud automatically.', err);
  }
}

const backend = {
  async read(collection) { return (await active()).read(collection); },
  async write(collection, rows, opts) {
    /* ⚠️ THE ZERO-GUARD — 2026-08-28, after Tim's calendar came up empty.
     *
     * "This can never happen. You need to make it extremely difficult to
     * erase data from people's accounts." This is the store-side half of that
     * (the sharded backend has its own mass-delete guard): NO ordinary write
     * may take a collection the cache knows is substantial down to nothing.
     * Every legitimate emptier — Clear all, Restore from backup — declares
     * itself wholesale and snapshots to the cloud first. Anything else
     * writing [] over real rows is a bug by definition: a stale read, a
     * failed merge, an exception that left a list half-built. Refusing costs
     * a correct caller nothing, because there are no correct callers.
     *
     * ⚠️ Judged against the CACHE, not a fresh read — the guard must not add
     * a round trip to every write. A cold cache means no opinion, and the
     * sharded backend's memo-fill covers the collections where emptiness
     * costs the most.
     */
    const known = readCache.get(collection);
    if (!(opts && opts.wholesale)
        && (!rows || rows.length === 0)
        && known && known.length >= 5) {
      throw new Error(
        `Refusing to overwrite ${known.length} ${collection} rows with an empty list. `
        + 'Clearing a collection must go through the wholesale path.');
    }

    const okay = await (await active()).write(collection, rows, opts);
    // We have just decided what this collection contains, so the cache is not
    // guessing — it is recording. Set AFTER the await: a write that threw has
    // changed nothing, and caching what we hoped to store would be a lie the
    // rest of the session reads back as fact.
    readCache.set(collection, (rows || []).slice());
    lastRead.set(collection, Date.now());
    // Fire-and-forget: keep the rolling cloud backup fresh. Never awaited and
    // never allowed to fail a save — a backup is worthless if taking it can
    // cost somebody the workout they just recorded.
    maybeRollCloudBackup().catch(() => {});
    return okay;
  },
};

/* ------------------------------------------------------------------ *
 * CLOUD BACKUPS — users/{uid}/backups/*, 2026-08-28.
 *
 * ⚠️ WHY THIS EXISTS: on 2026-08-26 the sharding migration emptied the
 * whole-list sessions document on Tim's account and his calendar came up
 * blank. His instruction afterwards is the specification: "make it extremely
 * difficult to erase data from people's accounts, and even if you do, there's
 * some backup saved." The guards above are the first half; this is the second
 * — copies that exist BEFORE anything goes wrong, in the user's own account,
 * owner-only under the same rules discipline as everything else.
 *
 * Two kinds, one shape ({collection, part, rows, reason, at}):
 *
 *   rolling-{weekday}-{collection}   A 7-day ring. Refreshed at most once per
 *                                    20 hours, by overwrite, so it prunes
 *                                    itself — up to a week of daily copies of
 *                                    every collection, forever, ~9 small doc
 *                                    writes a day at most.
 *   snap-{stamp}-{collection}        Taken immediately before the two flows
 *                                    allowed to wipe wholesale (Clear all,
 *                                    Restore from backup). Immutable — the
 *                                    rules deny update on snap ids.
 *
 * ⚠️ NEVER AWAITED ON A SAVE PATH and never allowed to throw out of it — a
 * backup that can fail somebody's save is a backup that costs training data
 * to protect training data. The pre-wipe snapshot IS awaited, because there
 * the whole point is happening-before.
 *
 * Rows are chunked at 250 per part so no backup document can approach the
 * 1 MiB cap even after the source collection sharded past it.
 * ------------------------------------------------------------------ */

const ROLL_KEY = NS + 'lastCloudRollBackup';
const ROLL_EVERY_MS = 20 * 3600 * 1000;
const BACKUP_CHUNK = 250;

async function writeCloudBackup(idPrefix, reason) {
  const impl = await active();
  if (!remoteImpl || impl !== remoteImpl || !impl.writeBackup) return false;
  const at = new Date().toISOString();
  for (const collection of COLLECTIONS) {
    const rows = await impl.read(collection);
    for (let part = 0; part * BACKUP_CHUNK < Math.max(1, rows.length); part++) {
      const chunk = rows.slice(part * BACKUP_CHUNK, (part + 1) * BACKUP_CHUNK);
      const id = `${idPrefix}-${collection}` + (part ? `-p${part}` : '');
      await impl.writeBackup(id, { collection, part, rows: chunk, reason, at });
    }
  }
  return true;
}

/** The rolling ring. Cheap enough to call after every write; throttles itself. */
async function maybeRollCloudBackup() {
  const last = Number(localStorage.getItem(ROLL_KEY) || 0);
  if (Date.now() - last < ROLL_EVERY_MS) return;
  const impl = await active();
  if (!remoteImpl || impl !== remoteImpl) return;
  // Stamp FIRST: several writes land in a burst when a workout finishes, and
  // each would otherwise start its own sweep. Losing one sweep to a failure
  // costs at most 20 hours of freshness on a copy that is one of seven.
  localStorage.setItem(ROLL_KEY, String(Date.now()));
  await writeCloudBackup(`rolling-${new Date().getDay()}`, 'rolling');
}

/**
 * The pre-wipe snapshot. AWAITED by its two callers, and a failure ABORTS the
 * wipe: cancelling a Clear-all because the safety copy could not be taken is
 * an inconvenience; proceeding without one is how a mistake becomes permanent.
 */
async function snapshotBeforeWipe(reason) {
  const impl = await active();
  if (!remoteImpl || impl !== remoteImpl) return;   // local/demo: nothing cloud to protect
  await writeCloudBackup(`snap-${Date.now().toString(36)}`, reason);
}

/* ------------------------------------------------------------------ *
 * HOW FULL THE CLOUD IS — the 1 MiB ceiling, measured rather than assumed
 *
 * ⚠️ THIS EXISTS BECAUSE THE PROJECT'S OWN ESTIMATE OF IT HAS NOW BEEN WRONG
 * TWICE, IN THE SAME DIRECTION. `docs/firebase-setup.md` claimed ~300 bytes a
 * session and about 3,000 workouts until 2026-08-24, when a real serialisation
 * put it at ~1,100 and the ceiling at ~950. That correction measured
 * `JSON.stringify` length — and Firestore does not charge JSON length. On this
 * app's own data the true cost is **1.66× the JSON**, so the ceiling is nearer
 * **520 sessions, about two and a half years at four a week**, not four and a
 * half. A constant nobody can check drifts twice; a function that reads the
 * account's actual rows cannot. The number below is this account's, not a
 * population's.
 *
 * ⚠️ WHERE THE 1.66× COMES FROM, because it is not a fudge factor. Firestore
 * charges a flat 32 bytes for every MAP and 8 for every NUMBER, however short
 * they look written down. One recorded set — `{"weight":205,"reps":6}` — is 23
 * bytes of JSON and **60 to Firestore**. A session is ~17 of those plus an
 * entry map each, and `entries` is 88 % of the collection, so the overhead is
 * the document rather than a rounding error on it. A check built on JSON bytes
 * would UNDER-count and fire after the thing it was warning about. These are
 * the published rules (Firestore → Usage and limits → Storage size):
 *
 *     string      UTF-8 bytes + 1        array    sum of its values
 *     number      8                      map      sum of keys+values, + 32
 *     boolean     1                      doc      name + fields + 32
 *     null        1                      name     each segment + 1, + 16
 *
 * ⚠️ NEVER VERIFIED AGAINST A REAL REJECTION, and it must not be described as
 * if it were. Confirming it means writing a megabyte to the live project and
 * watching it fail, which is not worth doing to Tim's account. It is the
 * published arithmetic, applied honestly, and it errs high — see the uid note.
 * ------------------------------------------------------------------ */

// Firestore's hard per-document cap. Not a tuning knob.
export const FIRESTORE_DOC_LIMIT = 1048576;

// Warn from here up. Chosen for RUNWAY rather than for tidiness: the remaining
// fifth of a megabyte is about 100 sessions, or six months at four a week,
// which is long enough to do the document-per-session migration calmly. A
// warning that leaves no time to act is just an accusation.
export const CLOUD_WARN_AT = 0.8;

const ENC = new TextEncoder();
// A field name and a string value are charged the same way: UTF-8 bytes + 1.
const fsString = (s) => ENC.encode(s).length + 1;

/** Bytes Firestore charges for one value. Exported for the tests. */
export function firestoreValueBytes(v) {
  if (v === null || v === undefined) return 1;
  switch (typeof v) {
    case 'boolean': return 1;
    case 'number': return 8;
    case 'string': return fsString(v);
    default: break;
  }
  if (Array.isArray(v)) {
    let n = 0;
    for (const x of v) n += firestoreValueBytes(x);
    return n;   // ⚠️ no +32 — an array pays for its contents and nothing else
  }
  if (v instanceof Date) return 8;               // stored as a timestamp
  let n = 32;
  for (const k of Object.keys(v)) {
    // `undefined` never reaches Firestore — the SDK refuses it outright — so
    // counting it would price a field that cannot exist.
    if (v[k] === undefined) continue;
    n += fsString(k) + firestoreValueBytes(v[k]);
  }
  return n;
}

/**
 * Bytes the document at `users/{uid}/collections/{name}` would occupy, given
 * the rows the backend is about to write into it. The shape is fixed by
 * `FirebaseBackend.write`: `{ rows, updatedAt }`.
 *
 * ⚠️ The uid is assumed to be a standard 28-character Firebase one rather than
 * read off the live user, and that is deliberate: it keeps this function pure
 * and testable, and the whole document NAME is ~60 bytes against a 1,048,576
 * budget. Getting it exactly right would be precision theatre.
 */
export function firestoreDocBytes(collection, rows) {
  const segments = ['users', 'x'.repeat(28), 'collections', String(collection)];
  const name = segments.reduce((n, s) => n + ENC.encode(s).length + 1, 0) + 16;
  return name + 32
    + fsString('rows') + firestoreValueBytes(rows || [])
    + fsString('updatedAt') + 8;
}

/* ------------------------------------------------------------------ *
 * THE READ CACHE — why tapping a nav tab used to wait for the network
 *
 * ⚠️ Measured 2026-08-22, after Tim reported the nav bar feeling laggy on his
 * iPhone on good signal. Building a screen is NOT the cost: at 4× CPU
 * throttling every tab renders in 11–72 ms. What each tab did was ask the
 * backend for whole collections it had already been given:
 *
 *     Workouts  5 reads     Calendar  2 reads
 *     Data      4 reads     Goals     7 reads
 *
 * and `sessions` was re-fetched by four of the six. On Firestore every one of
 * those is a `getDoc`, and a `getDoc` waits for the SERVER even with offline
 * persistence enabled — the local copy is a fallback for being offline, not a
 * fast path. So a tab tap cost one round trip per collection, serially in
 * places: about 400 ms on good wifi and over a second on cellular, for data
 * already sitting in the page. **It was never Firebase being slow, and never
 * the phone. It was asking the same questions again.**
 *
 * ⚠️ THE CACHE IS ONLY FOR READ-ONLY GETTERS, AND THAT IS THE SAFETY ARGUMENT.
 * This store does read-modify-write everywhere: read a collection, change one
 * row, write the whole thing back. Serving one of THOSE reads from a cache
 * would mean a second device's change is invisible when the list is written
 * back — and the write would erase it. Mutations therefore keep calling
 * `backend.read` directly and are exactly as safe as they were before this
 * existed. `saveSettings` was the single exception, reading through a getter
 * before writing, and it now reads fresh.
 *
 * ⚠️ REVALIDATION IS SILENT AND NEVER RE-RENDERS. A background refresh keeps
 * the NEXT navigation correct; nothing repaints under a thumb. That is the same
 * call sw.js makes about a new deploy, for the same reason — being briefly out
 * of date is a small cost, and a screen rearranging itself mid-tap is not.
 * ------------------------------------------------------------------ */

const readCache = new Map();
const lastRead = new Map();
const revalidating = new Set();

// Long enough that a burst of tab switching costs nothing, short enough that a
// change made on another device shows up within a minute of ordinary use.
const REVALIDATE_MS = 30000;

/** Drop everything. Anything that changes WHOSE data this is must call it. */
export function clearReadCache() {
  readCache.clear();
  lastRead.clear();
  // ⚠️ The social cache goes with it, wired HERE rather than at each call site,
  // for the reason onChange() already gives about itself: a second thing that
  // has to be remembered separately is a thing that gets forgotten, and the way
  // it would fail is one account being shown the previous account's friends.
  clearSocialCache();
}

/**
 * Fetch every collection once, in PARALLEL, so the first tap on any tab is
 * already warm.
 *
 * ⚠️ The saving is the shape of the waiting, not the number of bytes. Left to
 * the screens, these reads happen a few at a time, per screen, and some of them
 * are serialised behind each other — the Goals tab alone asked for seven. Done
 * here they are one `Promise.all`, so the whole app costs ONE round trip of
 * latency instead of one per collection per visit.
 *
 * ⚠️ Fire-and-forget, and failure is silent. It is called after the first
 * screen is already on the page, so nothing waits for it, and a cold start in a
 * gym with no signal must not produce an error about an optimisation (D6). Any
 * collection it misses is simply read the old way when a screen asks.
 */
export function warmReadCache() {
  return Promise.all(COLLECTIONS.map((c) => readCached(c).catch(() => null)))
    .then(() => undefined)
    .catch(() => undefined);
}

async function readCached(collection) {
  if (readCache.has(collection)) {
    maybeRevalidate(collection);
    // ⚠️ A COPY of the array, every time. Callers sort and filter these rows —
    // `getSessions()` sorts on the way out — and an in-place sort of the cached
    // array would quietly reorder what everybody else is about to be handed.
    // The row objects themselves are shared, which is what the store has always
    // done; it is the list that is now long-lived.
    return readCache.get(collection).slice();
  }
  const rows = await backend.read(collection);
  readCache.set(collection, rows.slice());
  lastRead.set(collection, Date.now());
  return rows;
}

function maybeRevalidate(collection) {
  if (revalidating.has(collection)) return;
  if (Date.now() - (lastRead.get(collection) || 0) < REVALIDATE_MS) return;
  revalidating.add(collection);
  backend.read(collection)
    .then((rows) => {
      readCache.set(collection, rows.slice());
      lastRead.set(collection, Date.now());
    })
    // ⚠️ Silent. This runs while somebody is using the app, very often in a gym
    // with no signal, and a failed refresh is the absence of news rather than an
    // error (D6). The cached rows stay exactly as they were.
    .catch(() => {})
    .finally(() => revalidating.delete(collection));
}

/* ------------------------------------------------------------------ *
 * The demo switch
 *
 * ⚠️ sessionStorage, NOT localStorage, and that is the safety decision rather
 * than a convenience. Per-tab means the demo cannot follow somebody into a new
 * tab and cannot survive closing the browser — so there is no state in which a
 * person opens the app tomorrow, sees a year of training they did not do, and
 * concludes their own history is gone. That failure would be far worse than the
 * feature is valuable.
 *
 * Entering and leaving both RELOAD. The store caches its chosen backend in
 * `activePromise`, `ensureSystems()` is single-flight, and units are seeded once
 * at boot — swapping the data underneath all of that in place is a much larger
 * surface than starting clean, for a transition that happens twice a session.
 * ------------------------------------------------------------------ */

const DEMO_FLAG = NS + 'demo';

export const demo = {
  active() {
    try {
      return typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem(DEMO_FLAG));
    } catch (_) {
      // Access can throw in some private-browsing modes. "No demo" is the right
      // answer there: the feature is optional and the app is not.
      return false;
    }
  },

  available() {
    try {
      return typeof sessionStorage !== 'undefined';
    } catch (_) { return false; }
  },

  enter() {
    try { sessionStorage.setItem(DEMO_FLAG, '1'); } catch (_) { return false; }
    location.reload();
    return true;
  },

  exit() {
    try { sessionStorage.removeItem(DEMO_FLAG); } catch (_) { /* leaving anyway */ }
    location.reload();
  },
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

export function uid(prefix = 'id') {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function upsert(rows, row) {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i === -1) rows.push(row);
  else rows[i] = row;
  return rows;
}

/* ------------------------------------------------------------------ *
 * ⚠️ ONE SESSION CAN HOLD THE SAME EXERCISE TWICE, AND FOUR READERS
 * ASSUMED IT COULD NOT (fixed 2026-08-28).
 *
 * Every one of them did `entries.find(e => e.exerciseId === id)` and stopped
 * at the first hit, so the second entry's sets were silently invisible — not
 * dropped from storage, just never read. The workout EDITOR refuses a
 * duplicate ("Already in this workout"), which is why this looked safe; the
 * RUNNER does not, because the exercise swap splits:
 *
 *     swap Leg Press → Hack Squat with two sets already logged
 *       → [Leg Press (2 sets), Hack Squat (rest)]
 *     swap Hack Squat → Leg Press when that machine frees up
 *       → [Leg Press (2 sets), Hack Squat (n sets), Leg Press (rest)]
 *
 * — which is an ordinary thing to do in a busy gym, and exactly the
 * improvisation the swap was built for on 2026-08-24.
 *
 * The damage was quiet and ran in the flattering-to-nobody direction: the
 * chart's best set for that day, the modal rep count, and the pre-fill for
 * next time all read the FIRST entry, which after a swap-back is the
 * abandoned stub rather than the work that was actually finished.
 *
 * ⚠️ `muscleStrength()` was never affected — it walks every entry in order,
 * because it has to for the fatigue discount. That is the shape the rest of
 * these readers should have had.
 * ------------------------------------------------------------------ */

/** Every entry in `session` for this exercise, in the order performed. */
function entriesFor(session, exerciseId) {
  return (session.entries || []).filter((e) => e.exerciseId === exerciseId);
}

/**
 * The LAST entry in `session` that logged sets for this exercise.
 *
 * ⚠️ Last rather than first, and that is the whole point of the helper. These
 * callers want "what did you do on this lift last time" to pre-fill the next
 * session, and after a swap-back the first entry is the two sets you gave up
 * on. The last one is the work you finished.
 *
 * ⚠️ `js/progression.js` carries a copy of this, deliberately — see the note
 * there. Change one, change both.
 */
function lastLoggedEntry(session, exerciseId) {
  const hits = entriesFor(session, exerciseId).filter((e) => e.sets && e.sets.length);
  return hits.length ? hits[hits.length - 1] : null;
}

export const DEFAULT_SETS = 3;

/* ------------------------------------------------------------------ *
 * Benchmark workouts
 *
 * A workout can be marked as a benchmark, and then every exercise it records
 * becomes a benchmark for that day. The session is still saved as a session —
 * you did do the workout — and the benchmark rows are DERIVED from it, tagged
 * with sourceSessionId and rebuilt on every save. That is what lets the date be
 * edited later without stranding a benchmark on the old day.
 * ------------------------------------------------------------------ */

/**
 * Which of an exercise's sets is *the* benchmark.
 *
 * A benchmark is one performance, so a workout's several sets have to reduce to
 * one. Where the app can already rank a lift it uses the same measure it ranks
 * with — estimated 1RM — so the benchmark agrees with the muscle map rather
 * than being a second opinion.
 *
 * ⚠️ The honest limitation is time. Longer is better for a plank; FASTER is
 * better for a mile. A distance-and-time exercise is resolved by taking the
 * furthest set and breaking ties on the fastest time, which gets a fixed-
 * distance run right. A time-ONLY exercise assumes longer is better, which is
 * right for a hold and wrong for a sprint — record those by hand.
 */
export function pickBenchmarkSet(sets, fields) {
  const usable = (sets || []).filter((s) => s && Object.values(s).some((v) => Number(v) > 0));
  if (!usable.length) return null;
  const has = (f) => fields && fields.includes(f);
  const num = (s, f) => Number(s[f]) || 0;

  const rank = (s) => {
    if (has('weight') && has('reps')) return e1rm(num(s, 'weight'), num(s, 'reps')) || 0;
    if (has('distance')) return num(s, 'distance');
    if (has('reps')) return num(s, 'reps');
    if (has('time')) return num(s, 'time');
    return 0;
  };

  let best = usable[0];
  for (const s of usable.slice(1)) {
    const d = rank(s) - rank(best);
    if (d > 0) { best = s; continue; }
    // Same distance, quicker time wins — that is a faster mile, not a longer one.
    if (d === 0 && has('distance') && has('time')
        && num(s, 'time') > 0 && (num(best, 'time') === 0 || num(s, 'time') < num(best, 'time'))) {
      best = s;
    }
  }
  return { ...best };
}

async function dropSessionBenchmarks(sessionId) {
  const rows = await backend.read('benchmarks');
  const kept = rows.filter((r) => r.sourceSessionId !== sessionId);
  // ⚠️ `wholesale`: every benchmark can come from one session, so deleting that
  // session legitimately empties the collection. The filter ran over rows read
  // in this same call, which is the invariant the zero-guard exists to protect.
  if (kept.length !== rows.length) await backend.write('benchmarks', kept, { wholesale: true });
}

async function syncSessionBenchmarks(session) {
  const rows = await backend.read('benchmarks');
  const kept = rows.filter((r) => r.sourceSessionId !== session.id);

  const made = [];
  if (session.isBenchmark) {
    const exMap = await store.getExerciseMap();
    for (const entry of session.entries || []) {
      const ex = exMap.get(entry.exerciseId);
      const fields = ex ? ex.fields : ['weight', 'reps'];
      const values = pickBenchmarkSet(entry.sets, fields);
      if (!values) continue;
      made.push({
        // Deterministic, so re-saving updates the same row instead of piling up
        // a new benchmark every time a past workout is edited.
        id: `bmk-${session.id}-${entry.exerciseId}`,
        date: session.date,
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        values,
        sourceSessionId: session.id,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (kept.length !== rows.length || made.length) {
    // ⚠️ `wholesale` for the same reason dropSessionBenchmarks gives: re-saving
    // the session every benchmark came from, with its flag now off, produces a
    // legitimately empty list from rows read in this same call.
    await backend.write('benchmarks', [...kept, ...made], { wholesale: true });
  }
}

// A SYSTEM is a named group of workouts — a programme. "Push Pull Legs" holding
// a Push, a Pull and a Legs workout; "Upper/Lower" holding two. Added 2026-08-17
// because Tim wants several programmes side by side and, later, to be able to
// load somebody else's (docs/vision.md §1.3).
//
// A workout belongs to exactly ONE system. Sharing one workout between two
// programmes sounds useful and is not: editing it in one place would silently
// change the other, and "did my Push day just change because I imported a
// celebrity programme?" is not a question this app should ever raise.
const DEFAULT_SYSTEM_NAME = 'My Workouts';

// In-flight migration, shared by concurrent callers. See ensureSystems().
let systemsMigration = null;

export function normalizeSystem(sys) {
  if (!sys) return sys;
  return {
    ...sys,
    name: (sys.name || '').trim() || 'Untitled system',
    notes: sys.notes || '',
  };
}

// Workouts used to be a bare list of exercise ids. They now carry a planned set
// count and notes per exercise, so older saved workouts are upgraded on read.
export function normalizeWorkout(w) {
  if (!w) return w;
  if (Array.isArray(w.exercises) && w.exercises.length) {
    return {
      ...w,
      isBenchmark: Boolean(w.isBenchmark),
      // ⚠️ This function REBUILDS each exercise field by field rather than
      // spreading it, so anything not named here is silently dropped on every
      // read and write. `group`, `setType` and `drops` (set-types.js) have to
      // be listed or supersets and drop sets would survive exactly until the
      // workout was next loaded. Add a field to the exercise shape, add it here.
      exercises: normalizeGroups(w.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: Number(e.sets) > 0 ? Number(e.sets) : DEFAULT_SETS,
        notes: e.notes || '',
        ...(isNested(e.setType) ? { setType: e.setType, minis: plannedMinis(e) } : {}),
        ...(e.group == null ? {} : { group: e.group }),
      }))),
    };
  }
  const ids = Array.isArray(w.exerciseIds) ? w.exerciseIds : [];
  return {
    ...w,
    isBenchmark: Boolean(w.isBenchmark),
    exercises: ids.map((id) => ({ exerciseId: id, sets: DEFAULT_SETS, notes: '' })),
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const store = {
  /* --- exercises --- */

  async getExercises() {
    const custom = await readCached('customExercises');
    return [...BUILT_IN_EXERCISES, ...custom];
  },

  async getExerciseMap() {
    const all = await this.getExercises();
    return new Map(all.map((e) => [e.id, e]));
  },

  async addCustomExercise(ex) {
    const rows = await backend.read('customExercises');
    rows.push(ex);
    await backend.write('customExercises', rows);
    return ex;
  },

  async deleteCustomExercise(id) {
    const rows = await backend.read('customExercises');
    await backend.write('customExercises', rows.filter((r) => r.id !== id));
  },

  /* --- workout systems --- */

  // Every workout must end up in a system, including the ones saved before
  // systems existed. This is the migration, and it is idempotent: it only
  // writes when it finds a workout without a systemId, which after the first
  // run is never. Done here rather than on read of a single workout so that a
  // half-migrated state cannot exist.
  // ⚠️ SINGLE-FLIGHT, and that is not an optimisation. Read-modify-write on two
  // collections is not atomic, so two callers running this at once each read
  // "no systems", each created one, and the second write clobbered the first —
  // leaving the systems list pointing at a row that no longer existed and every
  // workout stamped with a dead id. It presented as an empty system list and a
  // "Not found" the moment you tapped it. Concurrent callers now share one run.
  //
  // WorkoutsView asking for systems and workouts in the same Promise.all is
  // exactly that case, and is a completely reasonable thing for a view to do.
  ensureSystems() {
    if (systemsMigration) return systemsMigration;
    systemsMigration = (async () => {
      // ⚠️ THE CHECK READS THROUGH THE CACHE; THE FIX-UP DOES NOT.
      //
      // This runs on every getSystems() and every getWorkouts(), and it used to
      // cost TWO backend reads each time to re-answer a question that is
      // settled for good on almost every account — on Firestore that is two
      // network round trips on the Workouts tab, every visit. Measured
      // 2026-08-22 while working out why the nav bar felt laggy.
      //
      // ⚠️ A LATCH WAS THE WRONG FIX and the tests said so immediately. "No
      // orphans, so never check again" is true of a running app and false of
      // anything that can put old-shape rows back underneath it — a restored
      // backup, a different account, a test seeding localStorage directly. The
      // cache is the honest version of the same saving: it makes the check
      // cheap without ever claiming the answer cannot change.
      const [systems, workouts] = await Promise.all([
        readCached('systems'), readCached('workouts'),
      ]);
      if (!workouts.some((w) => !w.systemId)) return systems.map(normalizeSystem);

      // ⚠️ From here it is a READ-MODIFY-WRITE, so it re-reads the real thing.
      // Rewriting a whole collection from a cached copy is how a change made
      // somewhere else gets erased.
      const [freshSystems, freshWorkouts] = await Promise.all([
        backend.read('systems'), backend.read('workouts'),
      ]);
      const orphans = freshWorkouts.filter((w) => !w.systemId);
      if (!orphans.length) return freshSystems.map(normalizeSystem);
      const [systemsRows, workoutsRows] = [freshSystems, freshWorkouts];

      let home = systemsRows[0];
      if (!home) {
        const now = new Date().toISOString();
        home = { id: uid('sys'), name: DEFAULT_SYSTEM_NAME, notes: '', createdAt: now, updatedAt: now };
        systemsRows.push(home);
        await backend.write('systems', systemsRows);
      }
      for (const w of orphans) w.systemId = home.id;
      await backend.write('workouts', workoutsRows);
      return systemsRows.map(normalizeSystem);
    })();
    // Cleared once settled, so a later call re-checks. After the first run there
    // are no orphans left, so re-checking costs two reads and writes nothing.
    systemsMigration.finally(() => { systemsMigration = null; });
    return systemsMigration;
  },

  async getSystems() {
    const systems = await this.ensureSystems();
    return systems.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getSystem(id) {
    const rows = await this.ensureSystems();
    const row = rows.find((r) => r.id === id);
    return row ? normalizeSystem(row) : null;
  },

  async saveSystem(sys) {
    const rows = await backend.read('systems');
    const row = { ...normalizeSystem(sys), updatedAt: new Date().toISOString() };
    if (!row.id) row.id = uid('sys');
    if (!row.createdAt) row.createdAt = row.updatedAt;
    await backend.write('systems', upsert(rows, row));
    return row;
  },

  // Deleting a system deletes the workouts inside it — they belong to it and
  // there is nowhere else for them to live. Sessions already RECORDED are not
  // touched: history is a record of what happened and does not become untrue
  // because the plan behind it was thrown away.
  async deleteSystem(id) {
    const [systems, workouts] = await Promise.all([
      backend.read('systems'), backend.read('workouts'),
    ]);
    // ⚠️ `wholesale`: deleting the only system legitimately empties `workouts`,
    // and the zero-guard would otherwise refuse a flow the user just confirmed
    // on a screen that names what it deletes. The rows really were read first.
    await backend.write('workouts', workouts.filter((w) => w.systemId !== id), { wholesale: true });
    await backend.write('systems', systems.filter((r) => r.id !== id), { wholesale: true });
  },

  /**
   * Copy a ready-made system into this account.
   *
   * A COPY, not a reference. Once added it is the user's: they can rename it,
   * change the exercises, delete a workout. The alternative — keeping it linked
   * to the original — means their programme could change under them when the
   * app updates, which is exactly the surprise a training plan must never spring.
   *
   * `presetId` is kept so the browse screen can say "already added", and so a
   * future update could offer a fresh copy rather than silently rewriting one.
   *
   * Exercises are matched BY NAME. Anything that does not resolve is skipped
   * rather than written as a dangling id, and the count of what was skipped is
   * returned so the caller can be honest about it. In practice a test asserts
   * every preset name resolves, so this is a belt-and-braces path.
   */
  async addPresetSystem(preset) {
    if (!preset || !Array.isArray(preset.workouts)) throw new Error('Not a system');
    const exMap = await this.getExerciseMap();
    const byName = new Map([...exMap.values()].map((e) => [e.name, e]));

    const system = await this.saveSystem({
      name: preset.name,
      notes: preset.notes || preset.summary || '',
      presetId: preset.id,
      author: preset.author || null,
      sourceName: preset.sourceName || null,
      sourceUrl: preset.sourceUrl || null,
      // ⚠️ HOW OFTEN IT IS MEANT TO BE TRAINED HAS TO COME WITH IT.
      // Without these three the copy rates DIFFERENTLY from the original the
      // moment it lands in your library — Push Pull Legs is three workouts
      // trained six days a week, so dropping `daysPerWeek` made the copy look
      // like a three-day programme and score well below the version on the
      // Explore screen. Tim spotted exactly that. The rating is only allowed to
      // change once there is real history saying it should.
      daysPerWeek: preset.daysPerWeek || null,
      cycleDays: preset.cycleDays || null,
      minutes: preset.minutes || null,
    });

    let skipped = 0;
    let order = 0;
    for (const w of preset.workouts) {
      const exercises = [];
      for (const item of w.exercises || []) {
        const ex = byName.get(item.name);
        if (!ex) { skipped++; continue; }
        exercises.push({
          exerciseId: ex.id,
          sets: Number(item.sets) > 0 ? Number(item.sets) : DEFAULT_SETS,
          notes: item.notes || '',
          // A preset that says "supersetted with the next one" has to arrive
          // that way, or copying somebody's programme quietly flattens it —
          // which is the whole complaint docs/vision.md §1.5 was written about.
          ...(isNested(item.setType) ? { setType: item.setType, minis: plannedMinis(item) } : {}),
          ...(item.group == null ? {} : { group: item.group }),
        });
      }
      if (!exercises.length) continue;
      // ⚠️ `order` is what stops a programme arriving shuffled. Workouts sort by
      // name otherwise, which is harmless for a list somebody typed themselves
      // and wrong for a programme: Thurston's week came out Arms, Back, Chest,
      // Conditioning, Legs, Shoulders, and "Upper A, Lower A, Upper B, Lower B"
      // came out with both Lowers first — reversing the two things the notes
      // tell you to alternate. Caught by driving the real Add button.
      await this.saveWorkout({ name: w.name, systemId: system.id, exercises, order: order++ });
    }

    return { system, skipped };
  },

  // Which ready-made systems this account already holds a copy of.
  async addedPresetIds() {
    const rows = await backend.read('systems');
    return new Set(rows.map((r) => r.presetId).filter(Boolean));
  },

  /* --- workout templates --- */

  /**
   * Workouts, in the order they should be READ rather than the order they were
   * written.
   *
   * A workout copied from a ready-made system carries an `order` — the position
   * it had in the programme, which is information the author put there and
   * alphabetising throws away. A workout the user typed has none, because there
   * is no meaningful order to a list you wrote yourself, and those stay
   * alphabetical so they are findable.
   *
   * Ordered ones come first. That is deliberate: add your own workout to a
   * copied programme and it lands at the end, rather than wedging itself into
   * the middle of somebody's split because of its initial letter.
   */
  async getWorkouts(systemId) {
    await this.ensureSystems();
    const rows = await readCached('workouts');
    const all = rows.map(normalizeWorkout).sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : Infinity;
      const bo = Number.isFinite(b.order) ? b.order : Infinity;
      return ao !== bo ? ao - bo : a.name.localeCompare(b.name);
    });
    return systemId ? all.filter((w) => w.systemId === systemId) : all;
  },

  async getWorkout(id) {
    const rows = await readCached('workouts');
    const row = rows.find((r) => r.id === id);
    return row ? normalizeWorkout(row) : null;
  },

  async saveWorkout(workout) {
    const rows = await backend.read('workouts');
    const row = { ...normalizeWorkout(workout), updatedAt: new Date().toISOString() };
    delete row.exerciseIds; // superseded by `exercises`
    if (!row.id) row.id = uid('w');
    if (!row.createdAt) row.createdAt = row.updatedAt;
    await backend.write('workouts', upsert(rows, row));
    return row;
  },

  async deleteWorkout(id) {
    const rows = await backend.read('workouts');
    await backend.write('workouts', rows.filter((r) => r.id !== id));
  },

  /* --- completed sessions --- */

  async getSessions() {
    const rows = await readCached('sessions');
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async getSession(id) {
    const rows = await readCached('sessions');
    return rows.find((r) => r.id === id) || null;
  },

  async saveSession(session) {
    const rows = await backend.read('sessions');
    const row = { ...session };
    if (!row.id) row.id = uid('s');
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    await backend.write('sessions', upsert(rows, row));
    // Benchmarks derived from this session are rebuilt from scratch every save,
    // so editing the date, changing a set or clearing the flag can never leave a
    // stale benchmark behind pointing at a day the workout is no longer on.
    await syncSessionBenchmarks(row);
    // Friends' copies follow the data — see schedulePublish() for the Autumn
    // incident that made this line exist.
    schedulePublish();
    return row;
  },

  async deleteSession(id) {
    const rows = await backend.read('sessions');
    await backend.write('sessions', rows.filter((r) => r.id !== id));
    await dropSessionBenchmarks(id);
    schedulePublish();
  },

  /* --- guest sessions ---
   *
   * A GUEST is a name with no account — Tim's friend who could not sign in.
   * The recorder's phone runs the workout for both of them, and the guest's
   * half is saved HERE, in the recorder's own data (Open work 0e, guest half).
   *
   * ⚠️ A SEPARATE COLLECTION, not a flag on `sessions`, and that is the
   * load-bearing choice. Everything that reads sessions — the muscle map, the
   * charts, weekly volume, the published social projection, progression —
   * would need a filter it could forget, and one forgotten filter counts a
   * guest's training as the owner's, publishes it to the owner's friends, and
   * moves the owner's suggestions. A collection nothing else reads cannot be
   * mis-counted by code that has never heard of it.
   *
   * Rows are session-shaped plus `guestName`, so historyFor() and the day
   * view can read them with the machinery sessions already have. No
   * isBenchmark and no derived benchmarks: a benchmark is a claim filed into
   * the OWNER's history, and none of this is the owner's training.
   */

  async getGuestSessions() {
    const rows = await readCached('guestSessions');
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async saveGuestSession(session) {
    const rows = await backend.read('guestSessions');
    const row = { ...session };
    if (!row.id) row.id = uid('g');
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    await backend.write('guestSessions', upsert(rows, row));
    return row;
  },

  async deleteGuestSession(id) {
    const rows = await backend.read('guestSessions');
    await backend.write('guestSessions', rows.filter((r) => r.id !== id));
  },

  /* --- people: the roster you record for ---
   *
   * Tim, 2026-08-29: *"if you do create a new person to your account, save them
   * as an identity so you don't have to recreate the same person over and over
   * again each time you add them to a workout."*
   *
   * ⚠️ THIS HOLDS INVENTED PEOPLE ONLY — the training partner with no account.
   * A FRIEND is never copied in here: they come live off the friends list every
   * time, because a saved copy of somebody's name is a copy that goes stale the
   * day they rename themselves, and their uid already identifies them perfectly.
   * Two sources in the picker is the honest shape; one source with a stale half
   * is not.
   *
   * ⚠️ AN IDENTITY IS NOT A RECORD OF TRAINING. Deleting a person deletes the
   * name off the roster and NOTHING else — every session recorded for them stays
   * in `guestSessions` and on the calendar, because it is a record of work that
   * was really done and does not become untrue when the label is thrown away.
   * Same argument D22 makes about deleting a system.
   *
   * Person  id, name, createdAt, lastUsedAt
   */

  /** Most recently recorded-for first, so the picker's top row is the likely one. */
  async getPeople() {
    const rows = await readCached('people');
    return rows.slice().sort((a, b) =>
      String(b.lastUsedAt || b.createdAt || '').localeCompare(String(a.lastUsedAt || a.createdAt || '')));
  },

  /**
   * ⚠️ IDEMPOTENT BY NAME when no id is given — adding "Alex" twice returns the
   * SAME identity rather than a second one.
   *
   * The guard lives here rather than at the call site on purpose. A
   * check-then-create in the view fixes today's caller and nothing about the
   * next one, and the failure it prevents is not loud: two "Alex" rows in the
   * picker, each holding half his training, with no way to tell them apart.
   * The same argument associateLabels() makes about guarding at call sites.
   *
   * Renaming is still possible — pass the id, and the name goes wherever you
   * put it.
   */
  async savePerson(person) {
    const rows = await backend.read('people');
    const row = { ...person };
    row.name = String(row.name || '').trim().slice(0, 40);
    if (!row.name) throw new Error('Give them a name first.');
    if (!row.id) {
      const key = row.name.toLowerCase();
      const existing = rows.find((r) => String(r.name || '').trim().toLowerCase() === key);
      if (existing) return existing;
      row.id = uid('p');
    }
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    await backend.write('people', upsert(rows, row));
    return row;
  },

  /**
   * Stamp everybody who was in a session, in ONE read-modify-write.
   *
   * ⚠️ One write, not one per person, and that is not tidiness: finish() calls
   * this with everybody in the workout, and a loop over savePerson() would be N
   * full reads and writes of the collection with N chances to be interrupted
   * half-way. The same argument importRows() makes.
   */
  async touchPeople(ids, at) {
    const want = new Set((Array.isArray(ids) ? ids : []).filter(Boolean));
    if (!want.size) return 0;
    const rows = await backend.read('people');
    const stamp = at || new Date().toISOString();
    let hit = 0;
    const next = rows.map((r) => {
      if (!want.has(r.id)) return r;
      hit++;
      return { ...r, lastUsedAt: stamp };
    });
    if (!hit) return 0;
    await backend.write('people', next);
    return hit;
  },

  /** Forget the name. Never the training — see the note above. */
  async deletePerson(id) {
    const rows = await backend.read('people');
    await backend.write('people', rows.filter((r) => r.id !== id));
  },

  /* --- benchmarks --- */

  /**
   * Every set of every exercise a benchmark workout records, reduced to the one
   * that counts. See pickBenchmarkSet for how "counts" is decided.
   */
  async getBenchmarks() {
    const rows = await readCached('benchmarks');
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async saveBenchmark(mark) {
    const rows = await backend.read('benchmarks');
    const row = { ...mark };
    if (!row.id) row.id = uid('b');
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    await backend.write('benchmarks', upsert(rows, row));
    schedulePublish();
    return row;
  },

  async deleteBenchmark(id) {
    const rows = await backend.read('benchmarks');
    await backend.write('benchmarks', rows.filter((r) => r.id !== id));
    schedulePublish();
  },

  /* --- prefill: what did they do last time for this exercise? --- */

  /** Derived rows carry the session that made them; a user-entered one doesn't. */
  async benchmarksFromSession(sessionId) {
    const rows = await backend.read('benchmarks');
    return rows.filter((r) => r.sourceSessionId === sessionId);
  },

  // Looks first within the same workout template, then falls back to any session.
  async lastSetsFor(workoutId, exerciseId) {
    const sessions = await this.getSessions(); // newest first
    const scan = (filterFn) => {
      for (const s of sessions) {
        if (!filterFn(s)) continue;
        const entry = lastLoggedEntry(s, exerciseId);
        if (entry) return entry.sets;
      }
      return null;
    };
    return scan((s) => s.workoutId === workoutId) || scan(() => true);
  },

  /* --- goals --- */

  // docs/goals-plan.md. A goal is a target LEVEL for one muscle over twelve
  // weeks, with the target weight frozen at the moment it was set — see
  // buildGoal() in js/goals.js for why recomputing it would be wrong.
  //
  // ⚠️ ONE ACTIVE GOAL AT A TIME, and that is a product decision rather than a
  // storage one. Every requirement on the goal screen — sets, sessions, minutes,
  // protein — is stated for THE goal. Two at once and "how many sets do I need"
  // has two answers, which is exactly the kind of ambiguity this screen exists
  // to remove. Old goals are kept rather than deleted: whether a target was hit
  // is the most useful thing a person can know when setting the next one.
  async getGoals() {
    const rows = await readCached('goals');
    return rows
      .filter((g) => g && g.id && g.muscle)
      .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
  },

  async activeGoal() {
    const rows = await this.getGoals();
    return rows.find((g) => g.status === 'active') || null;
  },

  // Setting a goal ends whichever one was running. It is never a silent
  // replacement — the view asks first — but the store guarantees the invariant
  // rather than trusting every caller to remember it.
  async setGoal(goal) {
    const rows = await backend.read('goals');
    const now = new Date().toISOString();
    const row = {
      ...goal,
      id: goal.id || uid('goal'),
      status: 'active',
      createdAt: goal.createdAt || now,
      updatedAt: now,
    };
    const others = rows.map((g) => (g.id === row.id || g.status !== 'active'
      ? g
      : { ...g, status: 'ended', endedAt: now, endedReason: 'replaced' }));
    await backend.write('goals', upsert(others, row));
    return row;
  },

  async endGoal(id, reason = 'ended') {
    const rows = await backend.read('goals');
    const now = new Date().toISOString();
    await backend.write('goals', rows.map((g) => (g.id === id
      ? { ...g, status: 'ended', endedAt: now, endedReason: reason }
      : g)));
  },

  async deleteGoal(id) {
    const rows = await backend.read('goals');
    await backend.write('goals', rows.filter((g) => g.id !== id));
  },

  /* --- settings --- */

  async getSettings() {
    const rows = await readCached('settings');
    return rows[0] || { id: 'settings', units: 'lbs', theme: 'dark' };
  },

  async saveSettings(patch) {
    // ⚠️ NOT this.getSettings(). This is a read-modify-write: it reads the row,
    // merges a patch into it and writes the whole thing back, so a cached copy
    // could silently drop a field changed on another device. Every other
    // mutation in this store already reads straight from the backend; this was
    // the only one going through a cached getter.
    const current = await backend.read('settings').then((r) => r[0] || {});
    const next = { ...current, ...patch, id: 'settings' };
    await backend.write('settings', [next]);
    return next;
  },

  /* --- how full the cloud is --- */

  /**
   * The fullest of this account's cloud documents, against Firestore's 1 MiB
   * cap. `null` when the answer would be about somebody else's storage.
   *
   * ⚠️ NULL UNLESS THE DATA REALLY IS IN FIRESTORE. On this device the limit is
   * localStorage's, which is a different size and a different failure; in the
   * demo there is no limit at all because there is no storage. Quoting a
   * Firestore ceiling on either would be a confident number about the wrong
   * thing — the fault this file keeps meeting from other directions.
   *
   * ⚠️ EVERY COLLECTION, NOT JUST `sessions`. Sessions is the one that grows
   * forever and it is what the doc and the review both talk about, but hard-
   * coding that makes the check silently wrong the day something else does. It
   * costs nothing to ask all eight and report the worst.
   *
   * ⚠️ EXCEPT THE SHARDED ONES, SINCE THE MIGRATION. `sessions` and
   * `guestSessions` are one document per row now, so they are not measured
   * against this cap at all — a single session is ~2,000 bytes against a
   * 1,048,576 byte document and the collection above it has no cap. Pricing
   * them here would keep warning about a document that has been emptied, which
   * is the exact failure mode this function was written to end: a number that
   * has gone stale and nobody can check.
   *
   * ⚠️ THE OTHERS ARE STILL WATCHED, AND THAT IS THE POINT OF NOT DELETING
   * THIS. The judgement that only two collections grow without limit is a
   * judgement. If it is wrong — if benchmarks or bodyWeight climb faster than
   * anyone expects — this still fires, on the collection that is actually
   * filling up, with that account's own numbers.
   *
   * Reads go through the cache, so after the boot warm this is free and touches
   * the network not at all. It is a read-only getter, which is the only kind the
   * cache is allowed to serve.
   *
   * @returns {Promise<null|{collection, rows, bytes, limit, fraction,
   *                         bytesPerRow, rowsLeft}>}
   */
  async cloudUsage() {
    const impl = await active();
    if (!remoteImpl || impl !== remoteImpl) return null;

    // ⚠️ ONE Promise.all, NOT a loop with an await in it. On a cold Settings
    // open the cache can still be empty, and eight sequential `readCached`
    // calls would be eight serialised round trips — precisely the shape of the
    // lag Tim reported on 2026-08-22, reintroduced by an optimisation's own
    // status readout.
    const { SHARDED_COLLECTIONS } = await import('./firebase-backend.js');
    const capped = COLLECTIONS.filter((c) => !SHARDED_COLLECTIONS.includes(c));
    const all = await Promise.all(capped.map((c) => readCached(c)));

    let worst = null;
    for (let i = 0; i < capped.length; i++) {
      const bytes = firestoreDocBytes(capped[i], all[i]);
      if (!worst || bytes > worst.bytes) {
        worst = { collection: capped[i], rows: all[i].length, bytes };
      }
    }
    if (!worst) return null;

    // ⚠️ Per-row cost comes from THIS account, not from the ~1,100 bytes the
    // docs record. That figure is a population average over somebody else's
    // sessions, and the last population average this project trusted was out by
    // 3×. Somebody logging twelve exercises a session has bigger rows than
    // somebody logging four, and the runway they are told about should be
    // theirs.
    const bytesPerRow = worst.rows ? worst.bytes / worst.rows : null;
    const left = FIRESTORE_DOC_LIMIT - worst.bytes;
    return {
      collection: worst.collection,
      rows: worst.rows,
      bytes: worst.bytes,
      limit: FIRESTORE_DOC_LIMIT,
      fraction: worst.bytes / FIRESTORE_DOC_LIMIT,
      bytesPerRow,
      rowsLeft: bytesPerRow ? Math.max(0, Math.floor(left / bytesPerRow)) : null,
    };
  },

  /* --- data portability (P6: permanence) --- */

  async exportAll() {
    const out = { exportedAt: new Date().toISOString(), version: 1 };
    for (const c of COLLECTIONS) out[c] = await backend.read(c);
    return out;
  },

  /**
   * Read a backup file and say what is in it, WITHOUT writing anything.
   *
   * ⚠️ SEPARATED FROM importAll() SO THE USER CAN BE ASKED FIRST. Restoring
   * replaces everything, and until 2026-08-24 it did that with no confirmation
   * while "Delete all data" two lines below it had one. You cannot confirm what
   * you have not been told, so the sheet needs the counts before the write.
   *
   * @returns { counts: {collection: n}, total }
   * @throws with a sentence naming what is wrong, never a generic apology.
   */
  inspectBackup(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('That file is not a backup.');
    }
    const known = COLLECTIONS.filter((c) => data[c] !== undefined);
    if (!known.length) {
      // ⚠️ `{foo:1}` used to import "successfully" and toast "Backup restored"
      // having restored nothing at all. A restore that silently does nothing is
      // worse than one that fails, because the user walks away believing their
      // training is back.
      throw new Error('That file has no workout data in it — it may not be a backup from this app.');
    }
    // ⚠️ EVERY ROW IS CHECKED BEFORE ANY ROW IS WRITTEN, and that ordering is
    // the fix. A half-import used to be reachable: `{sessions:[{id:'s1'}]}`
    // stored fine and then `getSessions()` threw on `b.date.localeCompare`,
    // taking out Home, Workouts, Calendar, Data, Muscles and Goals through the
    // router's catch. Settings still rendered, so it was recoverable rather
    // than bricked — but only by deleting everything.
    const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
    // Only the fields whose absence actually CRASHES a screen. This is a
    // gatekeeper, not a schema: rejecting a backup for a missing optional field
    // would lock people out of their own data over nothing.
    const REQUIRED = {
      sessions: (r) => (isDate(r.date) ? null : 'a session with no usable date'),
      // Same exposure as sessions: getGuestSessions() sorts on the date, so a
      // dateless row would crash the read for every screen that asks.
      guestSessions: (r) => (isDate(r.date) ? null : 'a guest record with no usable date'),
      benchmarks: (r) => (isDate(r.date) ? null : 'a benchmark with no usable date'),
      bodyWeight: (r) => (isDate(r.date) && typeof r.weight === 'number' && r.weight > 0
        ? null : 'a weigh-in with no usable date or weight'),
      workouts: (r) => (r.exercises === undefined || Array.isArray(r.exercises)
        ? null : 'a workout whose exercise list is not a list'),
    };
    const counts = {};
    for (const c of known) {
      const rows = data[c];
      if (!Array.isArray(rows)) {
        throw new Error(`That backup's ${c} is not a list, so it cannot be restored.`);
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r || typeof r !== 'object' || Array.isArray(r)) {
          throw new Error(`That backup has a damaged ${c} entry (number ${i + 1}), so nothing was restored.`);
        }
        if (typeof r.id !== 'string' || !r.id) {
          throw new Error(`That backup has a ${c} entry with no id (number ${i + 1}), so nothing was restored.`);
        }
        const problem = REQUIRED[c] && REQUIRED[c](r);
        if (problem) {
          throw new Error(`That backup contains ${problem} (number ${i + 1}), so nothing was restored.`);
        }
      }
      counts[c] = rows.length;
    }
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  },

  async importAll(data) {
    // Throws before a single byte is written if anything is wrong.
    const summary = this.inspectBackup(data);

    // ⚠️ EVERY COLLECTION IS REPLACED, INCLUDING THE ONES THE FILE DOES NOT
    // CARRY, and that is a deliberate change from the merge this used to do.
    //
    // A backup is a SNAPSHOT of a whole account — exportAll() writes every
    // collection — so "restore" means "put me back in that state". The old
    // merge left collections the file did not mention untouched, and the result
    // was a class of bug the rest of this codebase already knows by name: a
    // foreign key is only valid while the rest of that set still exists.
    // Restoring a pre-systems backup kept the CURRENT systems, so a restored
    // workout could point at a system that was never in the file — returned by
    // getWorkouts(), rendered by no system screen, and never adopted by
    // ensureSystems(), which only looks for workouts with NO systemId rather
    // than a dead one. The workout was on disk and invisible forever.
    //
    // Replacing wholesale cannot produce that: a pre-systems backup clears
    // systems too, its workouts have no systemId, and ensureSystems() adopts
    // them on the next read, which is exactly what that migration is for.
    // ⚠️ SNAPSHOT FIRST (2026-08-28): a restore REPLACES every collection, so
    // what stands right now is about to stop existing anywhere. The snapshot
    // makes "I restored the wrong file" recoverable; a failure aborts the
    // restore before a single collection has been touched.
    await snapshotBeforeWipe('pre-restore');
    for (const c of COLLECTIONS) {
      await backend.write(c, Array.isArray(data[c]) ? data[c] : [], { wholesale: true });
    }
    // ⚠️ A restored backup is the ONE way old-shape workouts — the ones with no
    // systemId — can come back after the migration has already run and latched
    // itself off. Clearing it makes the next read re-check. The cache is
    // cleared with it: every collection has just been replaced wholesale.
    clearReadCache();
    return summary;
  },

  /* --- profile + body weight --- */

  // Body weight is stored as a DATED SERIES rather than one number on the
  // profile. It is needed as a single current value for strength standards, but
  // storing only that would throw away the trend line Tier 1 wants — and it
  // would be a migration later. One row per weigh-in costs nothing now.
  async getBodyWeights() {
    const rows = await readCached('bodyWeight');
    return rows
      .filter((r) => r && typeof r.weight === 'number' && r.weight > 0 && r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async logBodyWeight(weight, date) {
    const w = Number(weight);
    if (!(w > 0)) throw new Error('Enter a weight.');
    const day = date || todayISO();
    const rows = await backend.read('bodyWeight');
    // One weigh-in per day; a second on the same day replaces the first rather
    // than making the trend jagged with intra-day noise.
    const existing = rows.find((r) => r.date === day);
    const row = existing
      ? { ...existing, weight: w, updatedAt: new Date().toISOString() }
      : { id: uid('bw'), date: day, weight: w, createdAt: new Date().toISOString() };
    await backend.write('bodyWeight', upsert(rows, row));
    // Body weight is published when sharing allows it — same rule as sessions.
    schedulePublish();
    return row;
  },

  async deleteBodyWeight(id) {
    const rows = await backend.read('bodyWeight');
    await backend.write('bodyWeight', rows.filter((r) => r.id !== id));
    schedulePublish();
  },

  /* --- importing a file from another app (js/import-file.js) --- */

  /**
   * Write a whole batch in ONE read-modify-write.
   *
   * ⚠️ NOT A LOOP OVER saveSession(), and the reason is not tidiness. Every
   * single-row mutation in this store reads the whole collection, changes one
   * row and writes the whole collection back — so importing 200 activities
   * through them would be 200 full reads and 200 full writes of a document
   * that can be most of a megabyte, with 200 chances to be interrupted
   * half-way. One read, one merge, one write is also the only version that is
   * atomic from the reader's point of view.
   *
   * ⚠️ THE MERGE KEY DIFFERS BY COLLECTION AND HAS TO. Sessions upsert by the
   * deterministic import id, so re-importing an overlapping export updates the
   * same rows instead of duplicating a month of training. Weigh-ins upsert by
   * DATE, because this store has always kept one per day (a second reading on
   * a Tuesday replaces the first rather than making the trend jagged) and an
   * import must not be the one thing that breaks that rule.
   */
  async importRows(collection, rows) {
    if (!COLLECTIONS.includes(collection)) {
      throw new Error(`Cannot import into ${collection}.`);
    }
    const incoming = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!incoming.length) return { added: 0, replaced: 0 };

    const existing = await backend.read(collection);
    const byDate = collection === 'bodyWeight';
    const keyOf = (r) => (byDate ? r.date : r.id);

    const index = new Map(existing.map((r) => [keyOf(r), r]));
    let added = 0;
    let replaced = 0;
    for (const row of incoming) {
      const key = keyOf(row);
      if (key === undefined || key === null || key === '') continue;
      const prior = index.get(key);
      if (prior) {
        replaced++;
        // Keep the row's original identity and creation time. An import that
        // renumbered an existing weigh-in would orphan anything pointing at it.
        index.set(key, { ...prior, ...row, id: prior.id, createdAt: prior.createdAt || row.createdAt });
      } else {
        added++;
        index.set(key, { ...row, createdAt: row.createdAt || new Date().toISOString() });
      }
    }
    await backend.write(collection, [...index.values()]);
    // 200 imported activities are 200 things friends should see; one publish.
    schedulePublish();
    return { added, replaced };
  },

  async latestBodyWeight() {
    const rows = await this.getBodyWeights();
    return rows.length ? rows[rows.length - 1] : null;
  },

  // Everything the strength map needs about the person, in one call.
  async getProfile() {
    const [settings, latest] = await Promise.all([this.getSettings(), this.latestBodyWeight()]);
    return {
      gender: settings.gender || null,          // 'male' | 'female' | null
      birthYear: settings.birthYear || null,
      age: ageFromBirthYear(settings.birthYear),
      bodyWeight: latest ? latest.weight : null,
      bodyWeightDate: latest ? latest.date : null,
      units: settings.units || 'lbs',
      // Who the body map compares you against. A view preference, but it lives
      // in settings so it survives a reload and follows the account — someone
      // who has chosen to be ranked against everyone should not find it reset
      // the next morning. Shape is validated in strength-standards.js, so a
      // stale or hand-edited value degrades to the default rather than throwing.
      compare: settings.compare || null,
      missing: [
        !settings.gender && 'gender',
        !latest && 'body weight',
      ].filter(Boolean),
    };
  },

  async saveProfile({ gender, birthYear }) {
    const patch = {};
    if (gender !== undefined) patch.gender = gender || null;
    if (birthYear !== undefined) {
      const y = Number(birthYear);
      patch.birthYear = Number.isFinite(y) && y >= 1900 && y <= new Date().getFullYear()
        ? Math.round(y)
        : null;
    }
    return this.saveSettings(patch);
  },

  async clearAll() {
    // ⚠️ SNAPSHOT FIRST, AND A FAILED SNAPSHOT ABORTS THE CLEAR (2026-08-28).
    // Clearing without the safety copy is how a mis-tap becomes permanent;
    // aborting costs a retry. On the local and demo backends this is a no-op —
    // there is no cloud copy to protect.
    await snapshotBeforeWipe('pre-clear');
    for (const c of COLLECTIONS) await backend.write(c, [], { wholesale: true });
  },
};

// Birth year is stored, never age. Age would silently go stale — someone who
// entered 34 stays 34 forever and quietly drifts into the wrong comparison band.
export function ageFromBirthYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900) return null;
  const age = new Date().getFullYear() - y;
  return age >= 5 && age <= 120 ? age : null;
}

/* ------------------------------------------------------------------ *
 * Accounts
 *
 * A thin facade so views never import the Firebase module directly. Every
 * method is safe to call when the cloud is off — it just reports "local".
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Knowing WHY the cloud is unreachable
 *
 * "Your account could not be reached" is true of a dead server, a blocked
 * domain and a phone with no signal alike, and only one of those is worth
 * worrying about. navigator.onLine is a weak signal — false is reliable, true
 * only means "there is an interface", so it is used to explain a failure that
 * has already happened, never to predict one.
 * ------------------------------------------------------------------ */

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Actually ask the network, rather than trusting navigator.onLine.
 *
 * onLine === false is reliable. onLine === true is nearly worthless: it means
 * an interface exists, so a captive portal, a hotel wi-fi that never finished
 * logging in, or a dead upstream all report "online" while nothing can load.
 * Those are the cases most likely to send someone hunting for a bug in the app.
 *
 * The request is same-origin and cache-busted so the service worker cannot
 * answer it out of cache — a success here really does mean the network replied.
 */
export async function probeOffline(timeoutMs = 4000) {
  if (isOffline()) return true;
  if (typeof fetch !== 'function') return false;
  try {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    await fetch(`./manifest.webmanifest?connectivity=${Date.now()}`, {
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    return false;
  } catch (_) {
    return true;
  }
}

const LAST_ACCOUNT_KEY = NS + 'lastAccount';

function rememberAccount(user) {
  try {
    if (user && !user.isAnonymous && user.email) {
      localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify({ email: user.email }));
    } else if (user && user.isAnonymous) {
      // An anonymous session is not an account to be reminded of.
      localStorage.removeItem(LAST_ACCOUNT_KEY);
    }
  } catch (_) { /* storage full or blocked — this is a nicety, not data */ }
}

function lastKnownAccount() {
  try {
    const raw = localStorage.getItem(LAST_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function forgetLastAccount() {
  try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch (_) {}
}

function requireRemote() {
  if (!remoteImpl) {
    throw new Error(remoteFailure
      ? 'Not connected to your account right now. Check your connection and try again.'
      : 'Cloud accounts are not switched on yet.');
  }
  return remoteImpl;
}

export const auth = {
  // Is the cloud even meant to be on? False until real keys are pasted in.
  configured: () => wantRemote(),

  // Where the data actually lives right now, after any fallback.
  async state() {
    const impl = await active();

    // ⚠️ THE DEMO IS A THIRD BACKEND, AND THIS FUNCTION USED TO KNOW OF TWO.
    // The test below was `impl === LocalBackend`, so MemoryBackend — which is
    // neither that nor the remote one — fell through to the cloud branch and
    // called `impl.currentUser()`, a method it has never had. Settings threw
    // "impl.currentUser is not a function" for the whole of the demo's life and
    // nothing else did, because `AccountView` and `social.state()` both check
    // `demo.active()` themselves before they get here. Found 2026-08-21, on the
    // first pass over the app at phone size.
    //
    // Handled HERE rather than by adding a third `demo.active()` guard at the
    // call site, for the reason associateLabels() gives: guarding at the call
    // sites fixes today's callers and nothing about the next one, and the next
    // one will be written by somebody who has never met MemoryBackend.
    //
    // The mode is its own value rather than 'local'. A demo session is not
    // saving to this device either — it is saving nowhere — and "your data is
    // on this device" is a false claim to put in front of somebody whose data
    // is about to vanish on reload.
    if (impl === MemoryBackend) {
      return {
        mode: 'demo', user: null, degraded: false, error: null,
        offline: false, lastAccount: lastKnownAccount(),
      };
    }

    if (impl === LocalBackend) {
      return {
        mode: 'local',
        user: null,
        // Configured but not connected means something failed — the user is
        // still logging fine, but nothing is syncing. Say so plainly.
        degraded: wantRemote(),
        error: remoteFailure ? remoteFailure.message : null,
        // WHY it is not connected, which the UI got wrong: a dropped connection
        // was reported as "your account could not be reached", which reads as a
        // problem with the account. Tim hit this, concluded the app was broken,
        // and was simply offline.
        offline: isOffline(),
        // Who was signed in last time the cloud WAS reachable. Without this an
        // offline session looks like being logged out, which is alarming and
        // untrue — nothing has been signed out, the app just cannot ask.
        lastAccount: lastKnownAccount(),
      };
    }
    rememberAccount(impl.currentUser());
    return { mode: 'cloud', user: impl.currentUser(), degraded: false, error: null,
             offline: false, lastAccount: lastKnownAccount() };
  },

  // A real retry, rather than location.reload(). The first connection attempt is
  // memoised in activePromise, so without clearing it every "Try again" replayed
  // the same cached failure.
  async retry() {
    activePromise = null;
    remoteImpl = null;
    remoteFailure = null;
    return this.state();
  },

  /**
   * ⚠️ THE CACHE IS DROPPED ON EVERY IDENTITY CHANGE, and this is the hook that
   * guarantees it.
   *
   * The read cache is keyed by collection and NOT by account, because the store
   * only ever serves one account at a time — but sign-in, sign-out, an
   * anonymous account being upgraded and an account being deleted all change
   * WHOSE rows those are. Clearing here rather than at each call site is the
   * same argument `associateLabels()` makes: this fixes today's transitions and
   * the next one somebody adds, and forgetting looks exactly like remembering.
   *
   * It runs BEFORE the app's own handler, so nothing downstream can read a
   * previous account's rows out of the cache.
   */
  onChange(fn) {
    if (!remoteImpl) return () => {};
    return remoteImpl.onUserChange((...args) => {
      clearReadCache();
      return fn(...args);
    });
  },

  async signUpEmail(email, password) { return requireRemote().signUpEmail(email, password); },
  async signInEmail(email, password) { return requireRemote().signInEmail(email, password); },
  async signInGoogle(opts) { return requireRemote().signInGoogle(opts); },
  async sendPasswordReset(email) { return requireRemote().sendPasswordReset(email); },
  async signOut() {
    forgetLastAccount();
    clearReadCache();
    return requireRemote().signOut();
  },
  async changePassword(currentPassword, newPassword) {
    return requireRemote().changePassword(currentPassword, newPassword);
  },
  // ⚠️ The directory row goes FIRST, and it is the one piece of this account
  // that lives outside users/{uid} — so deleting the account without it would
  // leave the name and uid of a person who no longer exists in a collection the
  // whole signed-in world can list. Best-effort: a failure here must not stop
  // somebody deleting their account.
  async deleteAccount(currentPassword) {
    const impl = requireRemote();
    await impl.removeDirectory().catch(() => {});
    return impl.deleteAccount(currentPassword);
  },

  // Anything still sitting in this browser's local storage — data logged before
  // the cloud was switched on, or while it was unreachable.
  async localRowCounts() {
    const out = {};
    for (const c of COLLECTIONS) {
      const rows = await LocalBackend.read(c);
      if (rows.length && c !== 'settings') out[c] = rows.length;
    }
    return out;
  },

  // Merge this device's local data into the signed-in account. Merges by id and
  // keeps whichever copy is newer, so running it twice is harmless and it can
  // never delete something the cloud already had.
  async uploadLocalData() {
    const impl = requireRemote();
    const { mergeRows } = await import('./firebase-backend.js');
    const report = {};
    for (const c of COLLECTIONS) {
      const local = await LocalBackend.read(c);
      if (!local.length) continue;
      const remote = await impl.read(c);
      // Settings is a single row and not worth fighting over — an existing
      // cloud preference wins, because it reflects a device already signed in.
      const merged = c === 'settings' ? (remote.length ? remote : local) : mergeRows(remote, local);
      await impl.write(c, merged);
      report[c] = merged.length - remote.length;
    }
    return report;
  },

  // Wipe the local copy after a successful upload, so one device stops being a
  // second source of truth. Never called automatically.
  async clearLocalData() {
    for (const c of COLLECTIONS) await LocalBackend.write(c, []);
  },
};

/* ------------------------------------------------------------------ *
 * Social
 *
 * docs/social-plan.md. A thin facade, in the same spirit as `auth` above:
 * every method is safe to call when the cloud is off, and reports why rather
 * than throwing something the UI has to interpret.
 *
 * ⚠️ Nothing here reads or writes another person's PRIVATE data, and nothing
 * can — the rules refuse it. Sharing works by publishing a derived copy
 * (js/social.js), and these methods are the plumbing that keeps those copies in
 * step with the graph. The single rule to hold on to while editing: ANY change
 * to who-sees-what must be followed by a republish, or the stored copy keeps
 * answering the old question.
 * ------------------------------------------------------------------ */

async function socialMod() { return import('./social.js'); }

/* ⚠️ PUBLISH FOLLOWS THE DATA NOW, NOT JUST THE GRAPH — 2026-08-28.
 *
 * republish() was called by every social mutator and by nothing that records
 * training. social.publish() even shipped with the comment "after logging a
 * workout, say" — and nothing ever called it. So every published copy froze
 * at its owner's last SOCIAL action: Autumn connected with Tim, recorded a
 * session three hours later, and her published muscle map stayed the empty
 * pre-training snapshot from the moment of connection. Tim reported it as
 * her data being lost. Nothing was lost; nothing was ever re-shared.
 *
 * schedulePublish() is called after every mutation of published data. It is
 * DEBOUNCED (finishing a workout saves owner + benchmarks + guests in a
 * burst), FIRE-AND-FORGET (a failed publish must never fail a save), and
 * INERT off the cloud (no remote backend — tests, local mode — means nothing
 * is published to stale). The demo cannot reach it: republish() throws its
 * own refusal, which the catch below swallows.
 */
let publishTimer = null;
function schedulePublish() {
  if (!remoteImpl) return;
  if (publishTimer) return;
  publishTimer = setTimeout(() => {
    publishTimer = null;
    republish().catch(() => {});
  }, 2500);
}

/* ⚠️ THE THREE LEGACY TIER DOCUMENTS — deleted on the first publish after
 * 2026-09-03. Nothing reads them any more (PROBE_ORDER is friends/public), and a
 * document nobody reads that still lists viewers is the exact shape of an access
 * grant nobody can see. Deleting is idempotent and costs three writes ONCE per
 * account, guarded by a settings flag so it is not three writes per publish. */
const LEGACY_TIERS = ['light', 'mid', 'full'];

// Both documents are rewritten on every publish, and an audience with nobody in
// it is DELETED rather than left behind. Leaving a stale document with an old
// viewers list would keep somebody's access alive after they were removed from
// it, which is the one thing revocation has to be.
async function republish() {
  // ⚠️ THE GUARD THAT MATTERS, and it is here at the write rather than on the
  // screen. This function builds a friend-visible projection out of
  // store.getSessions() — which under the demo is INVENTED data — and writes it
  // to the real Firestore for real friends to read. Every social mutator ends
  // in a republish, so refusing here closes the whole leak in one place instead
  // of relying on every future caller to remember. social.state() also reports
  // the demo as unavailable, but that is the polite half; this is the seal.
  if (demo.active()) throw new Error('Social is off while you are in the demo account.');
  const impl = requireRemote();
  const S = await socialMod();
  const graph = await readGraphFresh(impl);
  const settings = await store.getSettings();

  const [sessions, benchmarks, bodyWeights] = await Promise.all([
    store.getSessions(), store.getBenchmarks(), store.getBodyWeights(),
  ]);

  let strength = null;
  try {
    strength = await buildStrengthShare();
  } catch (err) {
    // A body map that cannot be computed must not stop the rest publishing.
    console.warn('Muscle map not included in this publish.', err);
  }

  const viewers = S.allViewers(graph);
  const wantPublic = S.isPublicAccount(settings.visibility);
  const publishedAt = new Date().toISOString();

  const build = (audience) => S.buildProjection({
    audience,
    viewers,
    // ⚠️ The photo rides with the name, and social.js decides whether it is
    // publishable at all — this passes the stored value through rather than
    // testing it here, so there is exactly one rule about what a published
    // face may be (2026-08-31, Tim's report that friends only ever saw the
    // blank humanoid).
    profile: { name: settings.displayName || '', avatar: settings.avatar },
    sessions, benchmarks, strength, bodyWeights,
    shareBodyWeight: Boolean(settings.shareBodyWeight),
    publishedAt,
  });

  // ⚠️ THE PUBLIC DOCUMENT IS WRITTEN FIRST AND DELETED LAST, deliberately. Of
  // the two orders, this is the one where a half-finished publish leaves LESS
  // visible rather than more: going public, the friends document is stale for a
  // moment; going private, the public copy is gone before anything else changes.
  if (wantPublic) {
    await impl.publishShared(S.PUBLIC, build(S.PUBLIC));
  }
  if (viewers.length) {
    await impl.publishShared(S.FRIENDS, build(S.FRIENDS));
  } else {
    await impl.unpublishShared(S.FRIENDS).catch(() => {});
  }
  if (!wantPublic) {
    await impl.unpublishShared(S.PUBLIC).catch(() => {});
  }

  // The one-off cleanup of the tier documents. After the flag is set this costs
  // nothing; before it, it is what actually revokes the old grants.
  if (settings.sharedTiersCleared !== true) {
    for (const tier of LEGACY_TIERS) await impl.unpublishShared(tier).catch(() => {});
    await store.saveSettings({ sharedTiersCleared: true });
  }
  return true;
}

function normalizeSocialGraph(raw) {
  return raw && Array.isArray(raw.connections) ? raw : { connections: [] };
}

/* ------------------------------------------------------------------ *
 * The social read cache
 *
 * ⚠️ THE SAME CONTRACT AS THE COLLECTION CACHE ABOVE, for the same reason and
 * with the same one rule: READ-ONLY PATHS ONLY. Every mutation here
 * (setTier, remove, addConnection) is a read-modify-write of one document, so
 * serving those reads from memory would write a stale connection list back over
 * whatever another device changed. They call readGraphFresh() and say so.
 *
 * Tim, 2026-08-26, on an iPhone: *"whenever I click on friends in the home menu,
 * it has a long delay and lag to it that's alarming."* The Friends screen was
 * the last one in the app still paying the network on every single visit — the
 * 2026-08-22 cache covered the local collections and stopped at the cloud edge.
 * Opening it cost a graph read plus TWO identical invite list queries, awaited
 * one after another before a single pixel changed.
 * ------------------------------------------------------------------ */

const socialCache = new Map();      // key -> value
const socialReadAt = new Map();     // key -> ms
const socialRevalidating = new Set();

export function clearSocialCache() {
  socialCache.clear();
  socialReadAt.clear();
}

/**
 * Cached read with a silent background refresh, exactly like readCached():
 * nothing repaints under a thumb, the NEXT visit is the correct one, and a
 * failed refresh is the absence of news rather than an error (D6).
 */
async function socialCached(key, read) {
  if (socialCache.has(key)) {
    if (!socialRevalidating.has(key)
        && Date.now() - (socialReadAt.get(key) || 0) >= REVALIDATE_MS) {
      socialRevalidating.add(key);
      read()
        .then((fresh) => { socialCache.set(key, fresh); socialReadAt.set(key, Date.now()); })
        .catch(() => {})
        .finally(() => socialRevalidating.delete(key));
    }
    return socialCache.get(key);
  }
  const value = await read();
  socialCache.set(key, value);
  socialReadAt.set(key, Date.now());
  return value;
}

/** The graph as the screens read it — cached, and handed out as a copy. */
async function readGraphCached(impl) {
  const graph = await socialCached('graph',
    async () => normalizeSocialGraph(await impl.readGraph()));
  // A copy, for the reason readCached() hands out a copy: callers filter and
  // sort these rows, and the cached object is now long-lived. ⚠️ `pending` is
  // copied too — processAcceptedRequests() filters it, and filtering the cached
  // array in place would leave the next reader short a pending request.
  return {
    ...graph,
    connections: graph.connections.map((c) => ({ ...c })),
    pending: (graph.pending || []).map((p) => ({ ...p })),
  };
}

/** What every mutation uses. Never cached, and it drops the cache behind it. */
async function readGraphFresh(impl) {
  const graph = normalizeSocialGraph(await impl.readGraph());
  socialCache.set('graph', graph);
  socialReadAt.set('graph', Date.now());
  return graph;
}

/** A write invalidates what a read would otherwise keep serving. */
function socialWrote() {
  socialCache.delete('graph');
  socialCache.delete('invites');
  socialReadAt.delete('graph');
  socialReadAt.delete('invites');
}

export const social = {
  /**
   * Can this account be social at all, and if not, exactly why.
   *
   * Three refusals, each with a different next step, which is why they are
   * three values and not one boolean: no cloud configured, cloud unreachable
   * right now, and signed in anonymously (D25 — an anonymous uid is a browser
   * profile that will eventually be lost, so a connection to one is a
   * connection to nobody).
   */
  async state() {
    // Checked before the account, because the reason a demo user cannot be
    // social has nothing to do with their account and telling them to sign in
    // would be a wrong answer to the right question.
    if (demo.active()) return { available: false, reason: 'demo', user: null };
    const a = await auth.state();
    if (a.mode !== 'cloud') {
      return { available: false, reason: a.degraded ? 'offline' : 'local', user: null };
    }
    if (!a.user || a.user.isAnonymous) {
      return { available: false, reason: 'anonymous', user: a.user };
    }
    const impl = requireRemote();
    // ⚠️ In parallel. These are three independent reads and the graph is the
    // only one that touches the network; awaiting them in a row was costing the
    // Friends tab a round trip it never needed.
    const [settings, graph, S] = await Promise.all([
      store.getSettings(), readGraphCached(impl), socialMod(),
    ]);
    return {
      available: true,
      reason: null,
      user: a.user,
      uid: impl.currentUid(),
      name: settings.displayName || '',
      shareBodyWeight: Boolean(settings.shareBodyWeight),
      // 'private' | 'public' — the whole of who may see this account since
      // 2026-09-03. Unknown stored values degrade to private in social.js.
      visibility: S.normalizeVisibility(settings.visibility),
      connections: S.normalizeGraph(graph).connections,
    };
  },

  async setDisplayName(name) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) throw new Error('Choose a name your friends will recognise.');
    await store.saveSettings({ displayName: clean });
    // The name is inside every projection, so changing it has to rewrite them.
    await republish().catch((err) => console.warn('Could not republish after rename.', err));
    // ⚠️ And the directory row, or somebody who renamed themselves stays
    // findable under the old name forever. Fire-and-forget: being findable is a
    // nicety and must never be the reason a rename fails.
    this.syncDirectory().catch(() => {});
    return clean;
  },

  async setShareBodyWeight(on) {
    await store.saveSettings({ shareBodyWeight: Boolean(on) });
    await republish();
  },

  /**
   * Private or public — 2026-09-03, and it replaced the per-person tiers.
   *
   * ⚠️ GOING PRIVATE HAS TO DELETE THE PUBLIC DOCUMENT, not merely stop writing
   * it, and republish() is where that happens. A setting that changes what is
   * published without changing what is ALREADY published is the fault that froze
   * Autumn's muscle map in 2026-08-28 — except this version would leave a whole
   * account readable by strangers after its owner switched them off.
   */
  async setVisibility(value) {
    const S = await socialMod();
    const next = S.normalizeVisibility(value);
    await store.saveSettings({ visibility: next });
    await republish();
    return next;
  },

  /**
   * Disconnect from somebody — ⚠️ NOW MUTUAL, as of 2026-08-27 (Open work 0j).
   *
   * Two halves, and they are not the same KIND of thing, which is why the
   * sheet has to describe both:
   *
   * 1. **My side, immediately.** They come out of my graph and I republish, so
   *    they lose access to my training on the next read. This half has always
   *    worked.
   * 2. **Their side, eventually.** I cannot take myself out of the `viewers`
   *    list inside THEIR published document — that is the document holding
   *    everything all their friends can see, and write permission on it is the
   *    one thing this whole design exists to avoid granting. So I leave a note
   *    under their uid saying I have gone, and their client acts on it the next
   *    time it runs. Until then I am still in their viewers list.
   *
   * ⚠️ THE SECOND HALF IS BEST-EFFORT AND MUST NOT BLOCK THE FIRST. If the
   * note cannot be written — they deleted their account, the rules refused,
   * there is no signal — disconnecting must still work. A failure to tell
   * somebody you left is not a reason to stay connected to them.
   */
  async remove(uid) {
    const impl = requireRemote();
    const graph = await readGraphFresh(impl);
    graph.connections = graph.connections.filter((c) => c.uid !== uid);
    await impl.writeGraph(graph);
    socialWrote();
    // Republish FIRST-class: this is what actually cuts their access, because
    // the viewers list lives inside the document they were reading.
    await republish();
    let told = false;
    try {
      await impl.announceDisconnect(uid);
      told = true;
    } catch (_) { /* best effort — see above */ }
    return { removed: true, told };
  },

  /**
   * Act on the notes other people left saying they have disconnected.
   *
   * ⚠️ Called on the Friends screen rather than on a timer, because that is
   * where somebody would notice the result, and because a background job that
   * republishes is a background job that can surprise you. Republishing is what
   * actually removes them from `viewers`; the note is only the message.
   *
   * ⚠️ The note is deleted only AFTER the republish succeeds. Deleting first
   * would lose the instruction if the republish then failed, and the leaver
   * would stay in the viewers list with nothing left to say so.
   */
  async processDisconnects() {
    const impl = requireRemote();
    let notes = [];
    try { notes = await impl.listDisconnects(impl.currentUid()); } catch (_) { return 0; }
    if (!notes.length) return 0;

    const graph = await readGraphFresh(impl);
    const leaving = new Set(notes.map((n) => n.id).filter(Boolean));
    const before = graph.connections.length;
    graph.connections = graph.connections.filter((c) => !leaving.has(c.uid));

    if (graph.connections.length !== before) {
      await impl.writeGraph(graph);
      socialWrote();
      await republish();
    }
    for (const note of notes) {
      await impl.clearDisconnect(impl.currentUid(), note.id).catch(() => {});
    }
    return before - graph.connections.length;
  },

  async addConnection(uid, name) {
    const impl = requireRemote();
    const graph = await readGraphFresh(impl);
    if (!graph.connections.some((c) => c.uid === uid)) {
      graph.connections.push({
        uid,
        name: String(name || '').slice(0, 60),
        since: todayISO(),
      });
      await impl.writeGraph(graph);
      socialWrote();
      await republish();
    }
    return true;
  },

  /* --- invites --- */

  async createInvite() {
    const impl = requireRemote();
    const S = await socialMod();
    const token = S.newInviteToken((n) => crypto.getRandomValues(new Uint8Array(n)));
    const createdAt = new Date().toISOString();
    await impl.createInvite(token, {
      token,
      createdAt,
      expiresAt: new Date(Date.parse(S.inviteExpiry(createdAt))),
    });
    socialWrote();
    return { token, link: S.inviteLink(location.href, impl.currentUid(), token) };
  },

  async invites() {
    const impl = requireRemote();
    const rows = await socialCached('invites', async () => {
      const list = await impl.listInvites();
      return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    });
    // A copy: the Friends screen partitions this into claimed and unclaimed.
    return rows.map((r) => ({ ...r }));
  },

  async revokeInvite(token) {
    const done = await requireRemote().deleteInvite(token);
    socialWrote();
    return done;
  },

  /**
   * Somebody opened my link and claimed it — turn that into a connection.
   *
   * The claim is the other person telling me who they are; this is me agreeing.
   * Deliberately two steps: a link can be forwarded, so the person who opens it
   * is not always the person it was sent to, and the owner should see a name
   * before anything is shared.
   */
  async acceptClaim(token) {
    const impl = requireRemote();
    const rows = await impl.listInvites();
    const row = rows.find((r) => r.token === token || r.id === token);
    if (!row || !row.claimedBy) throw new Error('That invite has not been used yet.');
    await this.addConnection(row.claimedBy, row.claimedName);
    await impl.deleteInvite(row.id || row.token).catch(() => {});
    socialWrote();
    return true;
  },

  /** The other side: I opened somebody's link. */
  async openInvite(ownerUid, token) {
    const impl = requireRemote();
    const S = await socialMod();
    const row = await impl.readInvite(ownerUid, token);
    return { invite: row, state: S.inviteState(row, new Date().toISOString()) };
  },

  async acceptInvite(ownerUid, token, ownerName) {
    const impl = requireRemote();
    const settings = await store.getSettings();
    if (!settings.displayName) throw new Error('Choose your display name first.');
    await impl.claimInvite(ownerUid, token, {
      claimedBy: impl.currentUid(),
      claimedName: settings.displayName,
      claimedAt: new Date().toISOString(),
    });
    // They now know about me; this is me adding them, so the connection is
    // mutual from my side immediately rather than waiting on their next visit.
    await this.addConnection(ownerUid, ownerName || 'Friend');
    return true;
  },

  /* --- finding people, and asking to connect (2026-08-29) ---
   *
   * 🚨 The directory reverses a decision this project made deliberately. The
   * whole argument, and Tim's instruction, are in the "Finding people by name"
   * header of js/social.js and above the `directory` block in firestore.rules.
   * Read one of them before changing anything here.
   */

  /**
   * Am I findable? Opt-OUT, defaulting to on.
   *
   * ⚠️ It is a courtesy, not a protection, and the rules say so: a client can
   * always write its own directory row, so this cannot be enforced server-side.
   * Describing it as a privacy control would be the same class of overclaim the
   * disconnect sheet shipped with in 2026-08-24.
   */
  async listed() {
    const settings = await store.getSettings();
    return settings.listedInDirectory !== false;
  },

  async setListed(on) {
    const impl = requireRemote();
    await store.saveSettings({ listedInDirectory: Boolean(on) });
    if (on) {
      const settings = await store.getSettings();
      if (settings.displayName) await impl.writeDirectory(settings.displayName);
    } else {
      await impl.removeDirectory();
    }
    return Boolean(on);
  },

  /**
   * Put my name in the directory, or take it out.
   *
   * ⚠️ FIRE-AND-FORGET AT EVERY CALL SITE. Being findable is a nicety; failing
   * to write a directory row must never stop somebody renaming themselves or
   * signing in. Same discipline as schedulePublish().
   */
  async syncDirectory() {
    if (demo.active()) return false;
    const impl = requireRemote();
    const settings = await store.getSettings();
    if (settings.listedInDirectory === false || !settings.displayName) {
      await impl.removeDirectory();
      return false;
    }
    await impl.writeDirectory(settings.displayName);
    return true;
  },

  /**
   * People whose name matches, minus everybody already connected or asked.
   *
   * ⚠️ Each row is annotated rather than filtered out, because "you are already
   * friends" and "no such person" are completely different answers and a search
   * that silently drops the person you were looking for is the worse of the
   * two. `state` is one of: 'none' | 'connected' | 'asked'.
   */
  async searchPeople(query) {
    const impl = requireRemote();
    const S = await socialMod();
    if (!S.searchKey(query)) return [];
    const [rows, graph] = await Promise.all([
      socialCached('directory', () => impl.searchDirectory()),
      readGraphCached(impl),
    ]);
    const g = S.normalizeGraph(graph);
    const connected = new Set(g.connections.map((c) => c.uid));
    const asked = new Set(g.pending.map((p) => p.uid));
    return S.rankMatches(rows, query).map((r) => ({
      uid: r.uid,
      name: r.name,
      state: connected.has(r.uid) ? 'connected' : asked.has(r.uid) ? 'asked' : 'none',
    }));
  },

  /** One person by uid — what a QR code or a shared link lands on. */
  async personByUid(uid) {
    const impl = requireRemote();
    const S = await socialMod();
    const [rows, graph] = await Promise.all([
      socialCached('directory', () => impl.searchDirectory()),
      readGraphCached(impl),
    ]);
    const row = (rows || []).find((r) => r.uid === uid);
    if (!row) return null;
    const g = S.normalizeGraph(graph);
    return {
      uid: row.uid,
      name: row.name,
      state: g.connections.some((c) => c.uid === uid) ? 'connected'
        : g.pending.some((p) => p.uid === uid) ? 'asked' : 'none',
    };
  },

  /**
   * Ask somebody to connect.
   *
   * ⚠️ MY GRAPH IS NOT WIDENED HERE — they go on `pending`, not `connections`.
   * Adding them outright would put them in my `viewers` list, which is me
   * publishing my training to somebody who has not agreed to anything, and it
   * would show them on my friends list as a friend before they were one. A
   * request is a message; the friendship starts when they say yes.
   */
  async sendRequest(uid, name) {
    if (demo.active()) throw new Error('The demo account cannot add real people.');
    const impl = requireRemote();
    const S = await socialMod();
    const settings = await store.getSettings();
    if (!settings.displayName) throw new Error('Choose your display name first.');
    if (uid === impl.currentUid()) throw new Error('That is you.');

    const graph = await readGraphFresh(impl);
    const g = S.normalizeGraph(graph);
    if (g.connections.some((c) => c.uid === uid)) throw new Error('You are already connected.');

    await impl.sendRequest(uid, settings.displayName);
    if (!g.pending.some((p) => p.uid === uid)) {
      g.pending.push({ uid, name: String(name || '').slice(0, 60), at: todayISO() });
    }
    await impl.writeGraph(g);
    socialWrote();
    return true;
  },

  /** Take back one I sent, before they answer it. */
  async withdrawRequest(uid) {
    const impl = requireRemote();
    const S = await socialMod();
    // Their copy first: dropping it from my list while it still sits in their
    // account is the state where they can accept something I think I cancelled.
    await impl.deleteRequest(uid, impl.currentUid());
    const g = S.normalizeGraph(await readGraphFresh(impl));
    g.pending = g.pending.filter((p) => p.uid !== uid);
    await impl.writeGraph(g);
    socialWrote();
    return true;
  },

  /** Who has asked to connect with me. */
  async requests() {
    if (demo.active()) return [];
    const impl = requireRemote();
    const S = await socialMod();
    const rows = await impl.listRequests(impl.currentUid());
    return rows.map((r) => S.readableRequest(r)).filter(Boolean);
  },

  /**
   * Say yes.
   *
   * ⚠️ THIS NEEDS NO WRITE INTO THEIR ACCOUNT, and that is the nicest property
   * of the design. Adding them to my graph republishes with them in `viewers`,
   * which makes my shared document readable to them under the rule that has
   * existed since 2026-08-18 — so their client learns they were accepted by an
   * existing read succeeding. No "accepted" flag, no reverse tombstone, no new
   * permission. ⚠️ It is EVENTUAL on their side, like mutual disconnect, and
   * the screen says so.
   *
   * The request is deleted only AFTER the connection is written, for the same
   * reason the handoff is: the other order loses the offer if the write fails.
   */
  async acceptRequest(uid, name) {
    const impl = requireRemote();
    await this.addConnection(uid, name);
    await impl.deleteRequest(impl.currentUid(), uid).catch(() => {});
    socialWrote();
    return true;
  },

  /** Say no. Nothing is written to my graph, and they are not told. */
  async declineRequest(uid) {
    const impl = requireRemote();
    await impl.deleteRequest(impl.currentUid(), uid);
    socialWrote();
    return true;
  },

  /**
   * Turn any of my accepted requests into connections.
   *
   * ⚠️ THE PROBE *IS* THE NOTIFICATION. For each person I have asked, try to
   * read what they share. A refusal means they have not accepted (or have
   * declined, which is indistinguishable and deliberately so — nobody is told
   * they were turned down). A document coming back means I am in their viewers
   * list, which only their own accept could have put me in.
   *
   * ⚠️ ONLY PEOPLE I ASKED ARE PROBED, and that is the access control: nothing
   * anybody else writes anywhere can add them to my friends list. Run on the
   * Friends screen rather than on a timer, for the same reason disconnects are
   * — that is where somebody would notice the result, and a background job that
   * republishes is a background job that can surprise you.
   */
  async processAcceptedRequests() {
    if (demo.active()) return 0;
    const impl = requireRemote();
    const S = await socialMod();
    const g = S.normalizeGraph(await readGraphCached(impl));
    if (!g.pending.length) return 0;

    /* 🚨 THE FRIENDS DOCUMENT, NOT ANY DOCUMENT — and getting this wrong on
     * 2026-09-03 would have added strangers to people's friends lists.
     *
     * The probe IS the notification: a document coming back means I am in their
     * viewers list, which only their own accept could have put me in. That was
     * airtight while every published document was gated on `viewers` — and it
     * stopped being airtight the moment a PUBLIC account existed, because its
     * public document answers everybody. Somebody I asked, who never replied,
     * whose account happens to be public, would have been silently promoted to
     * an accepted friend on the next visit to this screen.
     *
     * So the test is the audience, not the answer. Only `friends` proves it. */
    const answers = await Promise.all(g.pending.map((p) =>
      this.friend(p.uid)
        /* ⚠️ A LEGACY DOCUMENT IS ALSO PROOF, and for the same reason the
         * friends document is: every tier document was gated on its own
         * `viewers` list, and there was no public tier for anybody to read
         * without being on one. Excluding them would leave a request accepted
         * just before the change unrecognised until the accepter opened the app
         * — which is the exact class of stall this whole fallback exists for. */
        .then((r) => (r && r.doc && (r.legacy || r.audience === S.FRIENDS) ? p : null))
        .catch(() => null)));
    const accepted = answers.filter(Boolean);
    if (!accepted.length) return 0;

    // One read-modify-write for the lot: this runs on a screen paint, and N
    // separate graph writes is N chances to clobber each other.
    const fresh = S.normalizeGraph(await readGraphFresh(impl));
    for (const p of accepted) {
      if (fresh.connections.some((c) => c.uid === p.uid)) continue;
      fresh.connections.push({
        uid: p.uid,
        // Their published name beats the one I typed when I searched.
        name: String(p.name || '').slice(0, 60),
        since: todayISO(),
      });
    }
    const done = new Set(accepted.map((p) => p.uid));
    fresh.pending = fresh.pending.filter((p) => !done.has(p.uid));
    await impl.writeGraph(fresh);
    socialWrote();
    await republish().catch(() => {});
    return accepted.length;
  },

  /* --- reading a friend --- */

  /**
   * What one person has shared with me — a friend, or anybody public.
   *
   * ⚠️ IT IS NOT ONLY FRIENDS ANY MORE (2026-09-03) and the name is kept because
   * forty call sites use it. Two documents are tried at once: `friends`, which
   * answers if they have accepted me, and `public`, which answers if their
   * account is public. A refusal is the normal answer for the one that is not
   * mine to read, never an error.
   *
   * ⚠️ BOTH AT ONCE, not friends-then-public. The serial version spends a whole
   * network round trip on the refusal, and the feed multiplies that by every
   * friend. Precedence is applied to the ANSWERS instead — friends wins where
   * both come back, because that document is the one with body weight in it.
   */
  async friend(uid) {
    const impl = requireRemote();
    const S = await socialMod();
    const docs = await Promise.all(
      S.PROBE_ORDER.map((audience) => impl.readShared(uid, audience).catch(() => null)));
    for (let i = 0; i < S.PROBE_ORDER.length; i++) {
      if (docs[i]) return { audience: S.PROBE_ORDER[i], doc: docs[i], legacy: false };
    }

    /* 🚨 AND THEN THE TIER DOCUMENTS, for a friend who has not opened the app
     * since 2026-09-03. See the header above LEGACY_AUDIENCES in social.js: each
     * account migrates its own documents on its own device, so between one
     * person updating and the other opening the app, THIS is the only thing
     * standing between them and their friend vanishing from every screen.
     *
     * ⚠️ SECOND, NEVER FIRST, and only when the new documents are absent — a
     * migrated account must never be read through its old copy, which is stale
     * by definition and may list viewers it no longer has.
     *
     * ⚠️ The reads are serial-in-parallel like the pair above, and a refusal is
     * not billed, so the cost of this for a MIGRATED friend is zero: the loop
     * above returns before it is reached. */
    const legacy = await Promise.all(
      S.LEGACY_AUDIENCES.map((tier) => impl.readShared(uid, tier).catch(() => null)));
    for (let i = 0; i < S.LEGACY_AUDIENCES.length; i++) {
      if (legacy[i]) return { audience: S.LEGACY_AUDIENCES[i], doc: legacy[i], legacy: true };
    }
    return { audience: null, doc: null, legacy: false };
  },

  /* --- reactions: kudos + comments (Open work 0l) --- */

  /**
   * Everything reacted onto one person's workouts, grouped per session.
   * Works for a friend's uid (the feed's counts) and for your own (what
   * landed on YOUR workouts — the receiving half, without which kudos would
   * be write-only and pointless).
   */
  async reactionsFor(ownerUid) {
    if (demo.active()) return new Map();
    const impl = requireRemote();
    const S = await socialMod();
    const rows = await impl.listReactions(ownerUid);
    return S.groupReactions(rows, impl.currentUid());
  },

  /** Toggle my kudos on a friend's session. Returns true if it is now given. */
  async toggleKudos(ownerUid, sessionId, hasIt) {
    if (demo.active()) throw new Error('The demo account cannot react to real people.');
    const impl = requireRemote();
    const S = await socialMod();
    const me = impl.currentUid();
    if (!me) throw new Error('Not signed in.');
    const id = S.kudosId(sessionId, me);
    if (hasIt) {
      await impl.deleteReaction(ownerUid, id);
      return false;
    }
    const settings = await store.getSettings();
    await impl.writeReaction(ownerUid, id, {
      kind: S.KUDOS,
      sessionId,
      from: me,
      fromName: String(settings.displayName || '').slice(0, 60),
      text: '',
    });
    return true;
  },

  async addComment(ownerUid, sessionId, text) {
    if (demo.active()) throw new Error('The demo account cannot react to real people.');
    const impl = requireRemote();
    const S = await socialMod();
    const me = impl.currentUid();
    if (!me) throw new Error('Not signed in.');
    const clean = S.cleanCommentText(text);
    const settings = await store.getSettings();
    const id = S.commentId(sessionId, me, Date.now().toString(36));
    await impl.writeReaction(ownerUid, id, {
      kind: S.COMMENT,
      sessionId,
      from: me,
      fromName: String(settings.displayName || '').slice(0, 60),
      text: clean,
    });
    return { id, text: clean };
  },

  /** Sender takes back their own; owner moderates their workouts' thread. */
  async removeReaction(ownerUid, reactionId) {
    if (demo.active()) throw new Error('The demo account cannot react to real people.');
    return requireRemote().deleteReaction(ownerUid, reactionId);
  },

  /**
   * Repair a connection's stored display name from what they publish.
   *
   * ⚠️ WHY A PLACEHOLDER CAN BE STORED AT ALL: accepting somebody's invite
   * happens BEFORE they have accepted you back, so their published profile is
   * not readable yet and the graph stores 'Friend'. Their real name becomes
   * readable the moment they accept — but nothing ever went back to fix the
   * stored row, so Tim's friend showed as "Friend" in every list while her
   * own page (which reads the published doc) showed "Autumn Dossey". Found
   * by Tim, 2026-08-26. Screens that show a placeholder call this; it
   * persists the published name so every other screen is right from then on.
   * A real stored name is never overwritten — you may have renamed them
   * deliberately, and their published name is theirs to change, not to
   * impose.
   */
  async healConnectionName(uid) {
    const impl = requireRemote();
    const graph = await readGraphFresh(impl);
    const row = graph.connections.find((c) => c.uid === uid);
    if (!row) return null;
    if (row.name && row.name !== 'Friend') return row.name;
    const { doc } = await this.friend(uid);
    const published = doc && doc.profile && typeof doc.profile.name === 'string'
      ? doc.profile.name.trim().slice(0, 60) : '';
    if (!published) return row.name || null;
    row.name = published;
    // No republish: viewers derive from uid and tier, and the name is a
    // local label — nothing another account can read changed.
    await impl.writeGraph(graph);
    socialWrote();
    return published;
  },

  /* --- handoffs: giving a friend the session you recorded for them ---
   *
   * Open work 0e's friend half. ⚠️ TIM'S DECISION IS THE SHAPE: *"the data is
   * saved to each user's specific account"* — by THEM accepting it. A direct
   * write would need permission on their `sessions` document, which holds
   * every session they have ever recorded, and there is no narrower grant to
   * make. So the recorder OFFERS and the recipient's own client accepts, which
   * also means they see what was logged in their name before it lands.
   */

  /**
   * Offer a guest session to the friend it was recorded for.
   *
   * ⚠️ The id is DETERMINISTIC on the guest session, so offering twice is one
   * offer rather than two. The same argument the kudos id makes, and it matters
   * more here: a duplicated offer accepted twice is a duplicated workout.
   */
  async offerSession(uid, session, guestName) {
    const impl = requireRemote();
    const settings = await store.getSettings();
    const clean = {
      // Only the keys the rules allow, and only the ones a session needs. The
      // guest row's own id is deliberately NOT reused — see acceptHandoff().
      date: session.date,
      workoutName: String(session.workoutName || guestName || 'Workout').slice(0, 80),
      entries: Array.isArray(session.entries) ? session.entries : [],
    };
    if (session.workoutId) clean.workoutId = session.workoutId;
    if (session.startedAt) clean.startedAt = session.startedAt;
    if (session.finishedAt) clean.finishedAt = session.finishedAt;
    if (session.location) clean.location = session.location;

    await impl.writeHandoff(uid, `h_${session.id}`, {
      from: impl.currentUid(),
      fromName: String(settings.displayName || '').slice(0, 60),
      session: clean,
    });
    return true;
  },

  /** What has been offered to me, newest first. */
  async handoffs() {
    const impl = requireRemote();
    const rows = await impl.listHandoffs(impl.currentUid());
    return rows.sort((a, b) => instantOf(b.at) - instantOf(a.at));
  },

  /**
   * Accept one: write it into MY OWN sessions, then clear the offer.
   *
   * ⚠️ THIS IS THE RECIPIENT'S OWN CLIENT WRITING TO THEIR OWN ACCOUNT, under
   * the owner-only rules that have not changed. Nothing about accepting needs a
   * foreign permission — which is the entire reason the feature has this shape.
   *
   * ⚠️ A FRESH ID, not the sender's. The sender's id belongs to a row in THEIR
   * guestSessions, and reusing it would tie two people's records together by a
   * key neither of them controls — so deleting one would look like it should
   * affect the other. The offer is a message, not a shared object.
   *
   * ⚠️ And the offer is deleted only after the session is safely saved. The
   * other order loses somebody's training if the save fails.
   */
  async acceptHandoff(id) {
    const impl = requireRemote();
    const rows = await impl.listHandoffs(impl.currentUid());
    const row = rows.find((r) => r.id === id);
    if (!row || !row.session) throw new Error('That workout is no longer here.');

    const saved = await store.saveSession({
      ...row.session,
      id: uid('s'),
      acceptedFrom: row.from || null,
    });
    await impl.deleteHandoff(impl.currentUid(), id).catch(() => {});
    // It is my training now, so my friends should see it like any other.
    await republish().catch(() => {});
    return saved;
  },

  /** Turn one down. Nothing is written to my training. */
  async declineHandoff(id) {
    const impl = requireRemote();
    await impl.deleteHandoff(impl.currentUid(), id);
    return true;
  },

  /** Take back one I sent, before they act on it. */
  async retractHandoff(uid, sessionId) {
    const impl = requireRemote();
    await impl.deleteHandoff(uid, `h_${sessionId}`);
    return true;
  },

  /** Force every projection to be rebuilt — after logging a workout, say. */
  async publish() { return republish(); },

  /**
   * ⚠️ THE BOOT HEAL — republish if what this account has PUBLISHED is older
   * than what it has RECORDED. schedulePublish() keeps projections fresh from
   * now on; this repairs every account that recorded training BEFORE that
   * wiring existed (Autumn's published muscle map was a frozen pre-training
   * snapshot for exactly this reason), and any future publish that failed
   * mid-flight. Self-throttling by nature: when nothing is stale it reads and
   * writes nothing.
   *
   * Fire-and-forget from boot. Returns false rather than throwing everywhere
   * — local mode, demo, offline, no connections — because a heal is an
   * opportunistic repair, not a feature anything waits on.
   */
  async healStalePublish() {
    try {
      if (demo.active()) return false;
      const impl = requireRemote();
      const [graph, settings, S] = await Promise.all([
        readGraphFresh(impl), store.getSettings(), socialMod(),
      ]);
      // ⚠️ A PUBLIC ACCOUNT WITH NO FRIENDS STILL HAS SOMETHING TO KEEP FRESH
      // (2026-09-03). This used to return early on an empty graph, which was
      // right when the only readers were connections; a public document read by
      // strangers is exactly as stale-able and nobody is on the list.
      const wantPublic = S.isPublicAccount(settings.visibility);
      if (!graph.connections.length && !wantPublic) return false;

      let newest = null;
      const present = new Set();
      // ⚠️ The legacy tier documents are read too, and on purpose: an account
      // that has not published since the model changed has its newest timestamp
      // in one of them, and skipping them would make every such account look
      // "never published" and republish on every single boot.
      for (const audience of [...S.AUDIENCES, ...LEGACY_TIERS]) {
        const d = await impl.readShared(impl.currentUid(), audience).catch(() => null);
        if (!d) continue;
        present.add(audience);
        if (typeof d.publishedAt === 'string'
            && (!newest || Date.parse(d.publishedAt) > Date.parse(newest))) {
          newest = d.publishedAt;
        }
      }

      /* 🚨 WHAT IS PUBLISHED MUST MATCH WHAT THE SETTING SAYS, and this check is
       * what makes a change to the DEFAULT reach accounts that already exist.
       *
       * Tim, 2026-09-03, hours after the setting shipped: *"Change this now so
       * everyone's information is public."* Flipping the default only changes
       * what `normalizeVisibility()` computes — every account that had already
       * published carried on with exactly the documents it had, because nothing
       * writes on a boot where no training changed. An account would have read
       * as public on its own Friends screen while publishing nothing a stranger
       * could open, which is the worst of both: a setting that says one thing
       * and a database that does another.
       *
       * ⚠️ IT IS A COMPARISON, NOT A ONE-OFF FLAG. A migration flag would fire
       * once and be spent; this asks "is the public document there when it
       * should be, and gone when it should not be?" on every boot, so it also
       * repairs a publish that half-failed and a setting changed on another
       * device. It costs nothing when the answer is yes — the documents were
       * already read for the timestamp above. */
      const hasPublic = present.has(S.PUBLIC);
      const wantFriends = graph.connections.length > 0;
      if (wantPublic !== hasPublic || (wantFriends && !present.has(S.FRIENDS))) {
        await republish();
        return true;
      }
      // 🚨 AND THE MIGRATION ITSELF IS A REASON TO REPUBLISH. An account whose
      // last publish predates 2026-09-03 has three tier documents and neither of
      // the two a reader now looks for — so its friends see nothing at all until
      // it publishes again. `sharedTiersCleared` is set by that publish and is
      // therefore the flag for "this account has been through the change".
      if (settings.sharedTiersCleared !== true) {
        await republish();
        return true;
      }
      const sessions = await store.getSessions();
      if (!S.needsRepublish({ sessions, publishedAt: newest })) return false;
      await republish();
      return true;
    } catch (_) { return false; }
  },
};

/** A Firestore Timestamp, a Date or an ISO string -> milliseconds. */
function instantOf(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/* ------------------------------------------------------------------ *
 * Derived data used by the graph + calendar
 * ------------------------------------------------------------------ */

// Flattens sessions and benchmarks into one time series per exercise.
// Session value for a given field = the best set that day (max, except time-only which uses max too).
export async function seriesForExercise(exerciseId, field, source = null) {
  const [sessions, benchmarks] = await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const points = [];

  if (source !== 'benchmark') {
    for (const s of sessions) {
      // Every entry for this exercise, not just the first — see entriesFor().
      // The day's best set is the best across all of them.
      const vals = entriesFor(s, exerciseId)
        .flatMap((entry) => (entry.sets || []).map((set) => set[field]))
        .filter((v) => typeof v === 'number' && !Number.isNaN(v));
      if (!vals.length) continue;
      points.push({ date: s.date, value: Math.max(...vals), source: 'workout', label: s.workoutName });
    }
  }

  if (source !== 'workout') {
    for (const b of benchmarks) {
      if (b.exerciseId !== exerciseId) continue;
      const v = b.values ? b.values[field] : undefined;
      if (typeof v !== 'number' || Number.isNaN(v)) continue;
      points.push({ date: b.date, value: v, source: 'benchmark', label: 'Benchmark' });
    }
  }

  // one point per day — keep the best
  const byDate = new Map();
  for (const p of points) {
    const prev = byDate.get(p.date);
    if (!prev || p.value > prev.value) byDate.set(p.date, p);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Body weight as a chartable series, in the same {date, value} shape the line
// chart takes for everything else. Already one row per day and already sorted,
// so this is a rename — but it keeps the view out of the storage shape.
export async function bodyWeightSeries() {
  const rows = await store.getBodyWeights();
  return rows.map((r) => ({ date: r.date, value: r.weight, source: 'bodyweight' }));
}

/* ------------------------------------------------------------------ *
 * Rep-normalised series
 * ------------------------------------------------------------------ */

// A benchmark is a deliberate test taken fresh; a set logged mid-workout comes
// after whatever else the session had already done. They are not the same
// measurement and charting them as one line is misleading — benchmarks are the
// default because that is the series someone means when they ask "am I getting
// stronger?".
export const SOURCES = ['benchmark', 'workout'];
export const SOURCE_LABEL = { benchmark: 'Benchmarks', workout: 'Workouts' };

// Every recorded (weight, reps) pair for one exercise, one row per SET.
// Sets are kept individually rather than reduced per day, because the rep count
// that appears most often is counted over real observations — a workout of
// 3 x 10 genuinely contributes three tens.
export async function weightRepObservations(exerciseId, source = null, rows = null) {
  /* ⚠️ `rows` IS A FRIEND'S PUBLISHED TRAINING (2026-09-03) — `{sessions,
   * benchmarks}` straight out of their document. Everything above this line
   * about what counts as an observation is then true of their chart as well as
   * yours, because it is the same walk.
   *
   * ⚠️ THEIR SESSION ROWS NAME THE EXERCISE DIFFERENTLY: the projection publishes
   * `entries[].name`, not `exerciseName`, and benchmark rows publish `name` too.
   * Only `exerciseId` is used for matching here, which both shapes carry, and the
   * label is read defensively below for the same reason. */
  const [sessions, benchmarks] = rows
    ? [rows.sessions || [], rows.benchmarks || []]
    : await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const out = [];

  const push = (date, weight, reps, src, label) => {
    const w = Number(weight), r = Number(reps);
    if (!(w > 0) || !(r >= 1) || Number.isNaN(w) || Number.isNaN(r)) return;
    out.push({ date, weight: w, reps: Math.round(r), source: src, label });
  };

  if (source !== 'benchmark') {
    for (const s of sessions) {
      // ⚠️ Every entry, and every SET of every entry. This function's whole
      // contract is "one row per set" — the modal rep count is counted over
      // these rows — so a second entry going unread is a set that was
      // performed and does not vote. See entriesFor().
      for (const entry of entriesFor(s, exerciseId)) {
        // `workoutName` is what a private row calls it and `name` is what a
        // published one does — the label is decoration on the chart's hover
        // readout, so it degrades rather than being made a special case.
        const label = s.workoutName || s.name || '';
        for (const set of entry.sets || []) push(s.date, set.weight, set.reps, 'workout', label);
      }
    }
  }
  if (source !== 'workout') {
    for (const b of benchmarks) {
      if (b.exerciseId !== exerciseId) continue;
      const v = b.values || {};
      push(b.date, v.weight, v.reps, 'benchmark', 'Benchmark');
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// The rep count everything gets compared at, by default.
export async function defaultTargetReps(exerciseId, source = null, rows = null) {
  return modalReps(await weightRepObservations(exerciseId, source, rows));
}

// One point per day, every point expressed as the weight you would have lifted
// at `targetReps`.
//
// Per-day pick: if any set that day was actually done at the target rep count,
// that set wins (heaviest of them) and the point is marked `actual` — a real
// measurement always beats an estimate. Otherwise the set with the highest
// estimated 1RM wins and the point is marked as an estimate.
export async function normalizedSeries(exerciseId, targetReps, source = null, rows = null) {
  const target = clampReps(targetReps);
  if (target === null) return [];

  const byDate = new Map();
  for (const o of await weightRepObservations(exerciseId, source, rows)) {
    const isActual = o.reps === target;
    const value = isActual ? o.weight : normalizeWeight(o.weight, o.reps, target);
    if (!(value > 0)) continue;

    const cand = {
      date: o.date,
      value,
      actual: isActual,
      weight: o.weight,
      reps: o.reps,
      source: o.source,
      label: o.label,
      rank: e1rm(o.weight, o.reps) || 0,
    };

    const prev = byDate.get(o.date);
    if (!prev) { byDate.set(o.date, cand); continue; }
    // A real measurement at the target always outranks an estimate.
    if (prev.actual !== cand.actual) { if (cand.actual) byDate.set(o.date, cand); continue; }
    if (cand.actual ? cand.value > prev.value : cand.rank > prev.rank) byDate.set(o.date, cand);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ *
 * Muscle-group strength ranking
 * ------------------------------------------------------------------ */

// Ranks from BOTH benchmarks and sets logged in a workout, best estimate wins.
//
// This is not a breach of D14. That rule is about charting a trend: two sources
// on one line make strength look like it swings wildly, and keeping one point
// per day silently threw the loser away. Neither applies to a single best
// estimate, which is all this screen asks for. Ranking on benchmarks alone left
// the best screen in the app permanently grey for anyone who just logs their
// workouts — which is most people, and the whole point of the app.
//
// A set logged mid-workout comes after everything else the session did, so it
// UNDERSTATES: it will rarely beat a fresh benchmark, and when it does, that is
// real evidence the lifter has moved on since they last tested. Taking the max
// is therefore the conservative reading, not an optimistic one.
//
// What must never happen is the source going unsaid — an inference must not look
// like a measurement (Rule 5). `best.source` carries it and the UI states it.
//
// SINCE 2026-08-17 a muscle is rated from EVERY exercise that trains it, not
// from one named lift. Before this, 11 of 265 exercises could move the map:
// Tim trained everything for a week and got a single reading, because he had
// done hammer curls rather than barbell curls and dumbbell rows rather than
// barbell rows. js/muscle-evidence.js holds the conversions and the confidence
// model; this function's only job is to turn stored records into observations
// and hand them over.
//
// The turning of records into observations now lives in
// js/strength-observations.js, because a FRIEND's rating has to be computed the
// same way from rows this store never held. What is left here is the part that
// is genuinely about MY account: reading it, and dressing a rating up in the
// percentiles and levels the screen shows.
//
// Returns one entry per rankable muscle group that has usable data.
/**
 * Muscle ratings, WITHOUT the profile gate — one estimate in pounds per muscle.
 *
 * 🚨 THE GATE ABOVE IS ABOUT PERCENTILES, NOT ABOUT STRENGTH, and conflating the
 * two cost this app its whole estimate for anybody who has not stepped on a
 * scale. `muscleStrength()` returns nothing at all when the profile is
 * incomplete, and rightly so: placing somebody against published standards
 * needs their sex, their age and their body weight, and a percentile without
 * those is not a weaker claim, it is a different person's.
 *
 * ⚠️ BUT "ROUGHLY WHAT COULD YOU ROW" NEEDS NONE OF THEM. It is their own sets,
 * converted by a published ratio, in pounds. Sending that through the
 * percentile gate meant a lifter with four months of training and no weigh-in
 * was told the app knew nothing about their back — which it plainly did.
 *
 * Body weight still matters where the LOAD depends on it: a pull-up with no
 * weigh-in has an unknown resistance, and `contributionsFor()` refuses it here
 * exactly as it does everywhere else. That is a refusal about one exercise
 * rather than about the account.
 *
 * ⚠️ IT TAKES ROWS, so a FRIEND'S published training can go through the same
 * arithmetic as your own. Called with nothing it reads your store, which is
 * every existing caller. Called with `{ sessions, benchmarks, bodyWeights }` it
 * rates those instead — and that is the only honest way to compare two people:
 * a second implementation for their side would be a second opinion about what a
 * set is worth, and the first time the two disagreed the comparison would be
 * measuring the difference between two functions rather than between two
 * lifters.
 *
 * ⚠️ The exercise LIBRARY always comes from this device, whoever the rows
 * belong to. It is the only one we have, and an exercise the reader's library
 * has never heard of cannot be converted by it — which is a true statement
 * about what this app can work out, and is reported as such.
 *
 * @param {object} [rows] { sessions, benchmarks, bodyWeights } — theirs
 * @returns {Promise<Map<string, object>>} muscle -> rateMuscle() result
 */
export async function muscleRatings(rows) {
  const [benchmarks, sessions, exMap, bodyWeights] = rows
    ? [rows.benchmarks || [], rows.sessions || [], await store.getExerciseMap(), rows.bodyWeights || []]
    : await Promise.all([
      store.getBenchmarks(), store.getSessions(), store.getExerciseMap(), store.getBodyWeights(),
    ]);
  const [{ rateMuscle }, { buildObservations }, { MUSCLE_LIFTS }] = await Promise.all([
    import('./muscle-evidence.js'),
    import('./strength-observations.js'),
    import('./strength-standards.js'),
  ]);

  // Same walk, same rules, same `today`-passed-in discipline as the rating
  // screen. Two callers, one definition of what a set is worth.
  const { byMuscle } = buildObservations({
    sessions, benchmarks, exMap, bodyWeights, today: todayISO(),
  });

  const out = new Map();
  for (const muscle of Object.keys(MUSCLE_LIFTS)) {
    const rating = rateMuscle(byMuscle.get(muscle) || []);
    if (rating) out.set(muscle, rating);
  }
  return out;
}

/**
 * The muscle map as somebody else will read it — 2026-09-03.
 *
 * 🚨 THIS IS THE OTHER HALF OF "a friend can click on any muscle group like that
 * own user can". js/social.js explains the document shape; this computes it.
 *
 * Two parts, and the split is the whole design:
 *
 *   `muscles` — what does not depend on who you compare against. The estimate,
 *     the confidence, and the recorded sets it was converted from (Rule 5
 *     travels with the number, or a panel on somebody else's screen shows an
 *     inference dressed as a measurement).
 *   `grid`  — what does. One row per comparison combination the sheet offers,
 *     computed HERE because a percentile is a ratio to this person's own body
 *     weight and age, and neither is in the public document.
 *
 * ⚠️ 24 combinations × 13 muscles, two numbers each. Measured at ~9 KB of JSON
 * against a 1 MiB document that is mostly sixty sessions — cheap enough that the
 * alternative (publishing body weight so the reader can do the arithmetic) buys
 * nothing but exposure.
 */
/**
 * `muscleRatings()` output dressed in the shape `muscleStrength()` returns.
 *
 * ⚠️ IT IS THE SAME FIELDS BY THE SAME FUNCTIONS, and the reason it exists at all
 * is that `muscleStrength()` reads THIS device's store and the demo's friends do
 * not live there. Anything that diverges here shows up as a friend's panel
 * disagreeing with the identical panel on your own screen.
 */
async function ratedFromRows(rows, profile) {
  const [ratings, {
    keyLiftFor, percentileFor, levelFor, nextLevelAfter, levelProgress, weightForPercentile,
  }, { confidenceBand, tintFor, raiseConfidenceHint }] = await Promise.all([
    muscleRatings(rows), import('./strength-standards.js'), import('./muscle-evidence.js'),
  ]);

  const out = new Map();
  for (const [muscle, rating] of ratings) {
    const percentile = percentileFor(rating.estimate, muscle, profile);
    if (percentile === null) continue;
    const level = levelFor(percentile);
    const next = nextLevelAfter(level);
    const nextWeight = next ? weightForPercentile(next.percentile, muscle, profile) : null;
    const top = rating.used[0];
    out.set(muscle, {
      muscle,
      lift: keyLiftFor(muscle),
      estimate: rating.estimate,
      confidence: rating.confidence,
      band: confidenceBand(rating.confidence),
      tint: tintFor(rating.confidence),
      basis: rating.kind,
      contributors: rating.used,
      contributorCount: rating.contributorCount,
      exerciseCount: rating.exerciseCount,
      hint: raiseConfidenceHint(muscle, rating),
      best: top ? { ...top } : null,
      percentile,
      level,
      next,
      toNext: nextWeight ? Math.max(0, nextWeight - rating.estimate) : null,
      progress: levelProgress(percentile, level),
      confident: Boolean(top && top.reps <= 5),
    });
  }
  return out;
}

export async function buildStrengthShare(rows = null, asProfile = null) {
  /* ⚠️ `rows` AND `asProfile` ARE FOR SOMEBODY WHO IS NOT SIGNED IN HERE — the
   * demo account's invented friends, which is how every screen in this app gets
   * looked at, measured and audited (progress.md §0.10). Without them a friend's
   * muscle map could not be seen anywhere but on a real second account, which is
   * exactly the state that let the feed's own fixture ship thinner than the wire
   * on 2026-09-02. The publishing path is otherwise identical, deliberately:
   * one function, so the fixture cannot be a tidier shape than the real thing. */
  const {
    percentileFor, levelFor, nextLevelAfter, weightForPercentile,
    allCompareCombos, compareKey, keyLiftFor,
  } = await import('./strength-standards.js');

  let profile;
  let muscles;
  if (rows) {
    profile = asProfile || {};
    if (!profile.bodyWeight || !profile.gender) return null;
    muscles = await ratedFromRows(rows, profile);
  } else {
    const [mine, s] = await Promise.all([store.getProfile(), muscleStrength()]);
    profile = mine;
    if (!s.ready) return null;
    muscles = s.muscles;
  }
  if (!muscles.size) return null;

  const ownSex = profile.gender === 'female' ? 'female' : 'male';
  const rated = [...muscles.values()];

  const grid = {};
  for (const combo of allCompareCombos()) {
    // ⚠️ The owner's profile with ONE field replaced. Every other input — sex,
    // age, body weight — has to be theirs, which is the entire reason this runs
    // on their device and not on the reader's.
    const asked = { ...profile, compare: combo };
    const row = {};
    for (const m of rated) {
      const pct = percentileFor(m.estimate, m.muscle, asked);
      if (pct === null) continue;
      const next = nextLevelAfter(levelFor(pct));
      const nextWeight = next ? weightForPercentile(next.percentile, m.muscle, asked) : null;
      row[m.muscle] = [
        pct,
        Number.isFinite(nextWeight) ? Math.max(0, nextWeight - m.estimate) : null,
      ];
    }
    grid[compareKey(combo, ownSex)] = row;
  }

  return {
    muscles: rated.map((m) => ({
      muscle: m.muscle,
      lift: m.lift && m.lift.name ? m.lift.name : (keyLiftFor(m.muscle) || {}).name || null,
      estimate: m.estimate,
      confidence: m.confidence,
      band: m.band ? m.band.name : null,
      basis: m.basis,
      contributorCount: m.contributorCount,
      exerciseCount: m.exerciseCount,
      contributors: (m.contributors || []).map((c) => ({
        exerciseName: c.exerciseName,
        weight: c.weight,
        reps: c.reps,
        date: c.date,
        loadType: c.loadType,
        source: c.source,
      })),
      hint: m.hint || null,
      confident: m.confident === true,
    })),
    grid,
    // Which row is THEIR "like me" — the combination their own screen opens on.
    defaultCompare: compareKey({ pool: 'lifters', sex: ownSex, weight: 'own', age: 'own' }, ownSex),
  };
}

export async function muscleStrength() {
  const [profile, benchmarks, sessions, exMap, bodyWeights] = await Promise.all([
    store.getProfile(), store.getBenchmarks(), store.getSessions(), store.getExerciseMap(),
    store.getBodyWeights(),
  ]);
  // Loaded on demand, like everything else this function needs: the rating
  // modules are a large chunk of the app and only the muscle screen asks for
  // them. strength-observations.js joins the same list rather than becoming a
  // static import, so pulling the walk out of here does not quietly add it to
  // every page that touches the store.
  const [
    { MUSCLE_LIFTS, keyLiftFor, percentileFor, levelFor, nextLevelAfter,
      levelProgress, weightForPercentile, generalPopulationPercentile },
    { rateMuscle, confidenceBand, tintFor, raiseConfidenceHint },
    { buildObservations },
  ] = await Promise.all([
    import('./strength-standards.js'),
    import('./muscle-evidence.js'),
    import('./strength-observations.js'),
  ]);

  const out = new Map();
  if (profile.missing.length) return { profile, muscles: out, ready: false };

  // The walk itself is js/strength-observations.js — same function, same rules,
  // whether the rows came from my store or from a friend's published feed.
  // `today` is handed in rather than read there, so the ages this rating leans
  // on are the ones this call decided.
  const { byMuscle, blocked } = buildObservations({
    sessions, benchmarks, exMap, bodyWeights, today: todayISO(),
  });

  for (const muscle of Object.keys(MUSCLE_LIFTS)) {
    const rating = rateMuscle(byMuscle.get(muscle) || []);
    if (!rating) continue;

    const percentile = percentileFor(rating.estimate, muscle, profile);
    if (percentile === null) continue;
    const level = levelFor(percentile);
    const next = nextLevelAfter(level);
    const nextWeight = next ? weightForPercentile(next.percentile, muscle, profile) : null;

    // The single strongest contributor, named in the panel so an inference
    // never looks like a measurement (Rule 5).
    const top = rating.used[0];

    out.set(muscle, {
      muscle,
      lift: keyLiftFor(muscle),
      estimate: rating.estimate,
      confidence: rating.confidence,
      band: confidenceBand(rating.confidence),
      tint: tintFor(rating.confidence),
      basis: rating.kind,
      contributors: rating.used,
      contributorCount: rating.contributorCount,
      // How many DIFFERENT exercises had a say, as opposed to how many sessions
      // were counted. The two used to be conflated, and the difference is the
      // whole of whether a reading is corroborated.
      exerciseCount: rating.exerciseCount,
      newestAgeDays: rating.newestAgeDays,
      hint: raiseConfidenceHint(muscle, rating),
      // Kept for the panel, which still wants to show a real recorded set
      // rather than only a derived number.
      best: {
        e1rm: top.rawE1rm,
        weight: top.weight,
        reps: top.reps,
        date: top.date,
        source: top.source,
        exerciseName: top.exerciseName,
        loadType: top.loadType,
      },
      percentile,
      level,
      next,
      nextWeight,
      toNext: nextWeight ? Math.max(0, nextWeight - rating.estimate) : null,
      progress: levelProgress(percentile, level),
      generalPercentile: generalPopulationPercentile(percentile),
      // Percentile placement leans on the e1RM formula being absolutely
      // accurate, which docs/research.md §1.3 says was never validated. It is
      // most trustworthy at low reps, so anything derived from a high-rep set
      // is flagged rather than presented as equally solid.
      confident: top.reps <= 5,
    });
  }

  return { profile, muscles: out, blocked, ready: true };
}

// Every exercise that has at least `min` recorded data points, per field.
export async function chartableExercises(min = 2) {
  const [sessions, benchmarks, exMap] = await Promise.all([
    store.getSessions(),
    store.getBenchmarks(),
    store.getExerciseMap(),
  ]);

  // Everything is tracked PER SOURCE. A benchmark is a deliberate test; a set
  // logged mid-workout is whatever the session called for. Mixing them into one
  // line makes a jagged mess that looks like wild swings in strength, so the
  // graph now charts one source at a time and this has to know which sources
  // actually have enough data to offer.
  const counts = new Map(); // exerciseId -> source -> field -> Set(dates)

  const rec = (exId) => {
    if (!counts.has(exId)) counts.set(exId, { benchmark: {}, workout: {} });
    return counts.get(exId);
  };
  const bump = (exId, src, field, date) => {
    const r = rec(exId)[src];
    if (!r[field]) r[field] = new Set();
    r[field].add(date);
  };
  const bumpPair = (exId, src, date, values) => {
    const w = values.weight, r = values.reps;
    if (typeof w !== 'number' || Number.isNaN(w) || !(w > 0)) return;
    if (typeof r !== 'number' || Number.isNaN(r) || !(r >= 1)) return;
    const rr = rec(exId)[src];
    if (!rr.__paired) rr.__paired = new Set();
    rr.__paired.add(date);
  };

  for (const s of sessions) {
    for (const e of s.entries || []) {
      for (const set of e.sets || []) {
        for (const f of ['weight', 'reps', 'time', 'distance']) {
          if (typeof set[f] === 'number' && !Number.isNaN(set[f])) bump(e.exerciseId, 'workout', f, s.date);
        }
        bumpPair(e.exerciseId, 'workout', s.date, set);
      }
    }
  }
  for (const b of benchmarks) {
    for (const f of ['weight', 'reps', 'time', 'distance']) {
      const v = b.values ? b.values[f] : undefined;
      if (typeof v === 'number' && !Number.isNaN(v)) bump(b.exerciseId, 'benchmark', f, b.date);
    }
    bumpPair(b.exerciseId, 'benchmark', b.date, b.values || {});
  }

  const out = [];
  for (const [exId, perSource] of counts) {
    const ex = exMap.get(exId);
    const canNorm = canNormalize(ex);

    const sources = {};
    for (const src of SOURCES) {
      const r = perSource[src];
      const fields = Object.keys(r).filter((f) => f !== '__paired' && r[f].size >= min);
      const pairedDays = (r.__paired || new Set()).size;
      // How many distinct DAYS this source can draw, which is what makes one
      // source a better default than the other. Days rather than readings: ten
      // sets on one afternoon is still one point on a chart.
      const days = Math.max(pairedDays, 0, ...fields.map((f) => r[f].size));
      sources[src] = { fields, pairedDays, days, normalizable: canNorm && pairedDays >= min };
    }

    // Offer the exercise only if at least ONE source can draw a line on its own.
    // Otherwise it sits in the dropdown leading to an empty chart.
    const usable = SOURCES.filter((s) => sources[s].fields.length || sources[s].normalizable);
    if (!usable.length) continue;

    out.push({
      id: exId,
      name: ex ? ex.name : 'Unknown exercise',
      muscle: ex ? ex.muscle : '',
      equipment: ex ? ex.equipment : '',
      loadType: ex ? ex.loadType : null,
      exercise: ex || null,
      sources,
      usableSources: usable,
      // Union across sources, kept so callers that ignore source still work.
      normalizable: SOURCES.some((s) => sources[s].normalizable),
      fields: [...new Set(SOURCES.flatMap((s) => sources[s].fields))],
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Where every lift stands RIGHT NOW — one row per exercise, no history needed.
 *
 * Tim, 2026-08-17: *"I know the graph and bar charts don't mean much without
 * multiple recordings over time, but I still want to be able to see some sort of
 * display that allows the user to know their current measurements for each of
 * their lifts."* Both chart modes need two points on two days before they can
 * draw anything, so a new user who has logged a full workout was being told
 * "Nothing to chart yet" while the app sat on every number they had entered.
 *
 * This asks a different question from a chart, so it is a different function
 * rather than chartableExercises(1): a chart wants points over time, this wants
 * the single best effort and how long ago it was.
 *
 * Returns rows sorted by most recent, each:
 *   { id, name, muscle, best{ weight, reps, date, source, ... }, e1rm,
 *     latestDate, days, sessions }
 */
export async function currentBests() {
  const [sessions, benchmarks, exMap] = await Promise.all([
    store.getSessions(), store.getBenchmarks(), store.getExerciseMap(),
  ]);

  const rows = new Map();
  const row = (exId) => {
    if (!rows.has(exId)) {
      const ex = exMap.get(exId);
      rows.set(exId, {
        id: exId,
        name: ex ? ex.name : 'Unknown exercise',
        muscle: ex ? ex.muscle : '',
        loadType: ex ? ex.loadType : null,
        fields: ex ? ex.fields : ['weight', 'reps'],
        best: null,
        e1rm: null,
        latestDate: null,
        days: new Set(),
      });
    }
    return rows.get(exId);
  };

  const consider = (exId, values, date, source) => {
    const r = row(exId);
    r.days.add(date);
    if (!r.latestDate || date > r.latestDate) r.latestDate = date;

    const w = Number(values.weight);
    const reps = Number(values.reps);
    const hasLoad = w > 0 && reps >= 1;

    // Rank by estimated 1RM where there is one, so 185×8 correctly beats 205×3
    // only if it really does. Everything else — a time, a distance — keeps its
    // own best by raw value, and "best" for a time means FASTEST.
    if (hasLoad) {
      const est = e1rm(w, reps);
      if (est !== null && (r.e1rm === null || est > r.e1rm)) {
        r.e1rm = est;
        r.best = { weight: w, reps: Math.round(reps), date, source };
      }
      return;
    }
    const t = Number(values.time);
    const d = Number(values.distance);
    if (t > 0 && (!r.best || !(r.best.time > 0) || t < r.best.time)) {
      r.best = { time: t, distance: d > 0 ? d : undefined, date, source };
    } else if (d > 0 && (!r.best || !(r.best.distance > 0))) {
      r.best = { distance: d, date, source };
    } else if (w > 0 && (!r.best || !(r.best.weight > 0))) {
      // A weight with no reps still tells you something; it just cannot be
      // turned into an estimated maximum.
      r.best = { weight: w, date, source };
    }
  };

  for (const s of sessions) {
    for (const e of s.entries || []) {
      for (const set of e.sets || []) consider(e.exerciseId, set, s.date, 'workout');
    }
  }
  for (const b of benchmarks) consider(b.exerciseId, b.values || {}, b.date, 'benchmark');

  // Noon, so a DST shift cannot turn a clean 7 days into 6.96 and round down.
  const noon = (iso) => new Date(String(iso) + 'T12:00:00');
  const today = noon(todayISO());
  const out = [];
  for (const r of rows.values()) {
    if (!r.best) continue;
    const t = noon(r.latestDate);
    out.push({
      ...r,
      sessions: r.days.size,
      days: Number.isNaN(t.getTime()) ? null : Math.max(0, Math.round((today - t) / 86400000)),
    });
  }
  // Most recent first: the lift you did yesterday is the one you want to see.
  return out.sort((a, b) => (a.latestDate < b.latestDate ? 1 : a.latestDate > b.latestDate ? -1 : a.name.localeCompare(b.name)));
}

// Start-vs-now comparison built from BENCHMARKS ONLY — workout sessions are
// deliberately excluded, so this answers "how has my tested best moved?" rather
// than mixing in whatever happened to get logged on a training day.
//
// Returns { fields: [...], byField: { weight: [{...}], ... } }.
export async function benchmarkComparison(minPoints = 2) {
  const [benchmarks, exMap] = await Promise.all([store.getBenchmarks(), store.getExerciseMap()]);
  const FIELDS = ['weight', 'reps', 'time', 'distance'];

  // exerciseId -> field -> [{date, value}]
  const grouped = new Map();
  for (const b of benchmarks) {
    for (const f of FIELDS) {
      const v = b.values ? b.values[f] : undefined;
      if (typeof v !== 'number' || Number.isNaN(v)) continue;
      if (!grouped.has(b.exerciseId)) grouped.set(b.exerciseId, {});
      const rec = grouped.get(b.exerciseId);
      if (!rec[f]) rec[f] = [];
      rec[f].push({ date: b.date, value: v });
    }
  }

  // Exercises whose weight is comparable only after rep normalisation. For
  // these the raw weight is replaced by equivalent load at their own modal rep
  // count, and the bare `reps` comparison is suppressed — "reps went 10 -> 4"
  // is not a result, it is half of one.
  const normalized = new Map(); // exerciseId -> { target, ordered: [...] }
  for (const b of benchmarks) {
    const ex = exMap.get(b.exerciseId);
    if (!canNormalize(ex) || normalized.has(b.exerciseId)) continue;

    const obs = benchmarks
      .filter((x) => x.exerciseId === b.exerciseId)
      .map((x) => ({ date: x.date, weight: Number((x.values || {}).weight), reps: Number((x.values || {}).reps) }))
      .filter((o) => o.weight > 0 && o.reps >= 1 && !Number.isNaN(o.weight) && !Number.isNaN(o.reps));
    if (!obs.length) continue;

    const target = modalReps(obs);
    const byDate = new Map();
    for (const o of obs) {
      const isActual = Math.round(o.reps) === target;
      const value = isActual ? o.weight : normalizeWeight(o.weight, o.reps, target);
      if (!(value > 0)) continue;
      const cand = { date: o.date, value, actual: isActual, rank: e1rm(o.weight, o.reps) || 0 };
      const prev = byDate.get(o.date);
      if (!prev) { byDate.set(o.date, cand); continue; }
      if (prev.actual !== cand.actual) { if (cand.actual) byDate.set(o.date, cand); continue; }
      if (cand.actual ? cand.value > prev.value : cand.rank > prev.rank) byDate.set(o.date, cand);
    }
    normalized.set(b.exerciseId, {
      target,
      ordered: [...byDate.values()].sort((a, b2) => a.date.localeCompare(b2.date)),
    });
  }

  const byField = {};
  const incomplete = {};

  for (const f of FIELDS) {
    const rows = [];
    let pending = 0;

    for (const [exId, rec] of grouped) {
      const norm = normalized.get(exId);
      if (norm && f === 'reps') continue;          // meaningless once weight is normalised

      const useNorm = Boolean(norm) && f === 'weight' && norm.ordered.length > 0;
      const points = useNorm ? norm.ordered : rec[f];
      if (!points) continue;

      // One entry per day; if a day has several, keep the best.
      // Normalised points arrive already reduced per day.
      let ordered;
      if (useNorm) ordered = points;
      else {
        const byDate = new Map();
        for (const p of points) {
          const prev = byDate.get(p.date);
          if (!prev || p.value > prev.value) byDate.set(p.date, p);
        }
        ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      }

      if (ordered.length < minPoints) { pending++; continue; }

      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const ex = exMap.get(exId);
      rows.push({
        id: exId,
        name: ex ? ex.name : 'Unknown exercise',
        loadType: ex ? ex.loadType : null,
        atReps: useNorm ? norm.target : null,
        startActual: useNorm ? first.actual : true,
        nowActual: useNorm ? last.actual : true,
        start: first.value,
        startDate: first.date,
        now: last.value,
        nowDate: last.date,
        delta: last.value - first.value,
        pct: first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100,
        count: ordered.length,
      });
    }

    if (rows.length) {
      // Biggest movers first — the chart's job is to show change.
      byField[f] = rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      incomplete[f] = pending;
    }
  }

  return { fields: Object.keys(byField), byField, incomplete };
}

/* ------------------------------------------------------------------ *
 * Weekly volume, from what was RECORDED
 *
 * ⚠️ TWO SCREENS READ THIS AND THEY ARE NOT ALLOWED TO DISAGREE.
 * `trainingForMuscle()` answers "how much work is my goal muscle getting" for
 * the Goals screens; `weeklyVolumeByMuscle()` answers it for every muscle at
 * once for Data → Volume. Ask both about Chest on the same day and they must
 * return the same number, so the window, the day index, the two-week floor and
 * the "a set with no numbers was never done" filter are defined ONCE, here,
 * rather than copied into the second caller — which is how the Goals screen's
 * hand-written paraphrase of INDIRECT_NOTE quietly lost a clause.
 * ------------------------------------------------------------------ */

// A stable day index.
//
// ⚠️ SPLIT, then Date.UTC. Two traps, and only this form clears both.
// `new Date('2026-08-18')` reads a bare date as UTC midnight and lands a day
// early west of Greenwich — splitting avoids that. But splitting into a LOCAL
// Date and flooring, which is what this did until 2026-08-22, is a stable day
// index only while the zone's UTC offset stays on one side of zero.
// Europe/London, Dublin, Lisbon and the Canaries are UTC+0 in winter and UTC+1
// in summer, so the index steps by 0 or 2 across each DST change: 28
// consecutive training days over 29 March 2026 measured a 27-day span and 14.52
// sets a week instead of 14.00. Date.UTC has no offset to move.
function volumeDayNum(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return y && m && d ? Math.round(Date.UTC(y, m - 1, d) / 86400000) : null;
}

/**
 * The trailing window of recorded sessions, and how much of it holds training.
 *
 * ⚠️ `spanDays` is measured from the FIRST session in the window to today, not
 * from the window's own edge — a 28-day window over an account that started
 * training nine days ago spans nine days, and dividing by four weeks would
 * report a quarter of the truth. `enough` is the two-week floor: a rate per week
 * measured over four days is noise, and reporting it as a fact would be worse
 * than saying nothing. Same rule as `observedDaysPerWeek()`.
 */
function volumeWindow(sessions, windowDays, today) {
  const todayNum = volumeDayNum(today || todayISO());
  if (todayNum === null) return null;

  const inWindow = (sessions || []).filter((s) => {
    const n = volumeDayNum(s.date);
    return n !== null && n <= todayNum && n > todayNum - windowDays;
  });
  if (!inWindow.length) return null;

  const first = Math.min(...inWindow.map((s) => volumeDayNum(s.date)));
  const spanDays = todayNum - first + 1;
  return { inWindow, spanDays, weeks: spanDays / 7, enough: spanDays >= 14, windowDays };
}

/*
 * How many sets of one entry were really performed — `recordedSetCount()`,
 * imported from `session-stats.js` at the top of this file.
 *
 * ⚠️ IT USED TO BE DEFINED HERE, and it moved on 2026-09-02 for the reason the
 * comment block above gives about the window: the feed card and the workout
 * detail screen count a session's sets too, and two copies of "was this set
 * really done" is two answers the day the rule changes — which is exactly what
 * typing warm-ups would do to it. One definition, three callers.
 */

/** Recorded sessions in the shape `weeklyVolume()` reads a programme in. */
function asVolumeWorkouts(sessions) {
  return sessions.map((s) => ({
    exercises: (s.entries || [])
      .map((e) => ({ exerciseId: e.exerciseId, sets: recordedSetCount(e) }))
      .filter((e) => e.sets > 0),
  }));
}

/**
 * How much work one muscle has ACTUALLY been getting, from logged sessions.
 *
 * docs/goals-plan.md §9.1. This is the measured half of the "why progress
 * stalls" section — the two rows the app can put a number against, as opposed to
 * the four it has to admit it cannot see.
 *
 * ⚠️ It reads SESSIONS, not workouts, and the difference is the whole point.
 * `weeklyVolume()` is normally handed a programme — what you intend to do. Here
 * it is handed what was recorded, so a plan promising 12 sets a week and a
 * history containing 4 give different answers, which is precisely the gap
 * somebody asking "why am I not progressing" needs to see.
 *
 * Returns null below a two-week span — see `volumeWindow()`.
 */
export async function trainingForMuscle(muscle, windowDays = 28, today = null) {
  const [sessions, exMap, { weeklyVolume, volumeContributions }] = await Promise.all([
    store.getSessions(), store.getExerciseMap(), import('./volume-map.js'),
  ]);

  const win = volumeWindow(sessions, windowDays, today);
  if (!win || !win.enough) return null;
  const { inWindow, spanDays, weeks } = win;

  const weeklySets = weeklyVolume(asVolumeWorkouts(inWindow), exMap, weeks).get(muscle) || 0;

  // A session counts toward frequency only if it held DIRECT work for the
  // muscle — the same rule weeklyFrequency() uses. Counting indirect work would
  // make every pressing day a back day because of the deadlift.
  let direct = 0;
  for (const s of inWindow) {
    const hit = (s.entries || []).some((e) => {
      const ex = exMap.get(e.exerciseId);
      if (!ex) return false;
      return volumeContributions(ex).some((c) => c.muscle === muscle && c.kind === 'direct');
    });
    if (hit) direct++;
  }

  return {
    muscle,
    weeklySets,
    sessionsPerWeek: direct / weeks,
    sessions: inWindow.length,
    spanDays,
    windowDays,
  };
}

/**
 * The same question asked of EVERY muscle at once — Data → Volume.
 *
 * D3 has called weekly sets per muscle group the headline metric since the first
 * day of this project, and until now the app computed it only for a goal muscle
 * on a screen most people never open. This is that number for all of them.
 *
 * ⚠️ IT RETURNS A WINDOW THAT IS TOO SHORT RATHER THAN NULL, which is the one
 * place it deliberately parts company with `trainingForMuscle()`. That function
 * feeds a sentence ("your training is delivering N sets a week") and a rate
 * measured over four days would make that sentence false; this one feeds a
 * screen, and a screen can say "nine days so far, here is what is in them" —
 * which is more use to somebody who has just started than an empty state is.
 * `enough` is the flag, and the caller must not print a weekly rate without it.
 *
 * ⚠️ EVERY MUSCLE IS LISTED, INCLUDING THE ONES ON ZERO. A muscle you are not
 * training is the finding — leaving it out would turn "you have done no calf
 * work for a month" into a screen that simply does not mention calves.
 *
 * @returns {Promise<null|{
 *   windowDays: number, spanDays: number, weeks: number, sessions: number,
 *   enough: boolean, clamped: boolean,
 *   muscles: {muscle: string, weeklySets: number, totalSets: number,
 *             sessionsPerWeek: number, daysTrained: number,
 *             contributors: {name: string, sets: number, kind: string}[]}[],
 * }>}
 */
export async function weeklyVolumeByMuscle(windowDays = 28, today = null, rows = null) {
  /* ⚠️ `rows` IS HOW A FRIEND'S VOLUME IS COMPUTED (2026-09-03), and it is the
   * same trick `muscleRatings(rows)` used on 2026-09-02 for the same reason: the
   * arithmetic must not be written twice. Their published sessions carry every
   * exercise id and every set, so this walk over their rows produces the number
   * their own screen shows, from the same function, on this device.
   *
   * ⚠️ Their sessions are a 60-session WINDOW rather than a history, which does
   * not matter here — this function only ever looks at a trailing four weeks —
   * but the caller must not describe the result as "all their training". */
  const [sessions, exMap, { volumeContributions, VOLUME_MUSCLES, SESSION_CEILING }] =
    await Promise.all([
      rows ? Promise.resolve(rows) : store.getSessions(),
      store.getExerciseMap(), import('./volume-map.js'),
    ]);

  const win = volumeWindow(sessions, windowDays, today);
  if (!win) return null;

  const totals = new Map();
  let clamped = false;

  for (const s of win.inWindow) {
    // Totalled per session first, because the ceiling is a per-session rule.
    const perMuscle = new Map();
    for (const e of s.entries || []) {
      const sets = recordedSetCount(e);
      if (!sets) continue;
      const ex = exMap.get(e.exerciseId);
      if (!ex) continue;
      for (const c of volumeContributions(ex)) {
        let m = perMuscle.get(c.muscle);
        if (!m) { m = { total: 0, direct: false, ex: new Map() }; perMuscle.set(c.muscle, m); }
        m.total += sets * c.weight;
        if (c.kind === 'direct') m.direct = true;
        const cur = m.ex.get(ex.id) || { name: ex.name, sets: 0, kind: c.kind };
        cur.sets += sets * c.weight;
        m.ex.set(ex.id, cur);
      }
    }

    for (const [muscle, m] of perMuscle) {
      // ⚠️ THE SAME CLAMP `weeklyVolume()` APPLIES, SPREAD ACROSS THE EXERCISES
      // THAT CAUSED IT. Scaling each contributor by the same factor is what keeps
      // the parts summing to the whole: a screen that names four exercises adding
      // to 30 above a total reading 24 is a screen nobody can check, and being
      // checkable is the entire reason the contributors are listed at all.
      // Below the ceiling — which is everywhere any real training lives — the
      // factor is exactly 1 and nothing is touched.
      const scale = m.total > SESSION_CEILING ? SESSION_CEILING / m.total : 1;
      if (scale < 1) clamped = true;

      let t = totals.get(muscle);
      if (!t) { t = { sets: 0, days: 0, ex: new Map() }; totals.set(muscle, t); }
      t.sets += m.total * scale;
      // A session counts toward frequency only if it held DIRECT work for the
      // muscle — the same rule `weeklyFrequency()` uses. Counting indirect work
      // would make every pressing day a back day because of the deadlift.
      if (m.direct) t.days += 1;
      for (const [id, c] of m.ex) {
        const cur = t.ex.get(id) || { name: c.name, sets: 0, kind: c.kind };
        cur.sets += c.sets * scale;
        t.ex.set(id, cur);
      }
    }
  }

  const names = [...new Set([...VOLUME_MUSCLES, ...totals.keys()])];
  const muscles = names.map((muscle) => {
    const t = totals.get(muscle);
    return {
      muscle,
      totalSets: t ? t.sets : 0,
      weeklySets: t ? t.sets / win.weeks : 0,
      sessionsPerWeek: t ? t.days / win.weeks : 0,
      daysTrained: t ? t.days : 0,
      contributors: t ? [...t.ex.values()].sort((a, b) => b.sets - a.sets) : [],
    };
  }).sort((a, b) => b.weeklySets - a.weeklySets || a.muscle.localeCompare(b.muscle));

  return {
    windowDays,
    spanDays: win.spanDays,
    weeks: win.weeks,
    sessions: win.inWindow.length,
    enough: win.enough,
    clamped,
    muscles,
  };
}

// Everything recorded on a given date.
export async function activityByDate() {
  const [sessions, benchmarks] = await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const map = new Map();
  const push = (date, item) => {
    if (!map.has(date)) map.set(date, { sessions: [], benchmarks: [] });
    map.get(date)[item.kind === 'session' ? 'sessions' : 'benchmarks'].push(item.data);
  };
  for (const s of sessions) push(s.date, { kind: 'session', data: s });
  for (const b of benchmarks) push(b.date, { kind: 'benchmark', data: b });
  return map;
}
