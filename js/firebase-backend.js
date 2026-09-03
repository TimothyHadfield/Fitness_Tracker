// Firestore backend + accounts.
//
// ⚠️ The network paths in here have NEVER been executed — creating a Firebase
// project needs a Google login only Tim has. The pure helpers at the bottom are
// unit-tested; everything that touches the SDK is reviewed code, not verified
// code. See docs/firebase-setup.md.
//
// Data shape in Firestore — TWO shapes since 2026-08-28, and which one a
// collection uses is the whole of what the sharding section at the bottom of
// this file is about:
//
//   users/{uid}/collections/{name}  →  { rows: [...], updatedAt }   (most)
//   users/{uid}/sessions/{rowId}    →  { row, updatedAt }           (sharded)
//   users/{uid}/guestSessions/{id}  →  { row, updatedAt }           (sharded)
//
// One document per collection kept reads cheap and mirrored the local backend's
// read-whole / write-whole API exactly. It still does, for everything bounded.
// But Firestore caps a document at 1 MiB, and the two collections carrying
// `entries` grow forever.
//
// ⚠️ THIS COMMENT SAID "~300 bytes each, so roughly 3,000 workouts" UNTIL
// 2026-08-24, AND THE FIGURE THAT REPLACED IT WAS ALSO WRONG. The correction
// that day measured JSON length — ~1,100 bytes a session, ceiling ~950 — but
// Firestore charges 32 bytes per MAP and 8 per NUMBER regardless of how short
// the text is, which on this app's data is **1.66× the JSON**. The real figure
// is ~2,000 bytes a session and a ceiling near **520 — about two and a half
// years at four a week.**
//
// ⚠️ THAT CEILING IS WHAT THE SHARDING REMOVED, and the migration ran while
// the account held a few dozen sessions rather than four hundred, precisely
// because a migration over somebody's training history gets more dangerous the
// longer it is left. See SHARDED_COLLECTIONS below.
//
// Nobody should ever have to trust this line again: `store.cloudUsage()`
// computes it from the account's own rows and Settings warns from 80 %. That
// exists precisely because a constant copied into prose has now gone stale
// twice — and it now skips the sharded collections, so it will not go stale in
// the opposite direction by warning about a document that has been emptied.
//
// ⚠️ THE READ COST CHANGED AND IT IS WORTH KNOWING. A sharded read is one
// billed document read per row rather than one per collection. At 520 sessions
// that is 520 reads to fill the cache on a cold open, against a 50,000/day free
// allowance — about 96 cold opens a day before it bites, and the read cache
// means a session of ordinary use is one fill plus a revalidation every 30
// seconds.
//
// 💷 ✅ AND ON 2026-09-08 THAT CONSTRAINT WAS REMOVED — by exactly the fix this
// paragraph used to predict: `where updatedAt > cursor` plus an aggregation
// count to catch deletes, so a cold open pays for what CHANGED rather than for
// a whole training history. Worth ~20× at every scale. The reasoning, and the
// millisecond version that a test caught being worse than useless, are in the
// block above createShardIO().
//
// Account model (chosen 2026-08-15): anonymous first, upgrade later. A visitor
// starts logging immediately with an anonymous account, then adds email or
// Google to secure it. Upgrading LINKS the existing account, so the uid — and
// therefore all the data — is preserved.

import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let ctx = null;          // { app, db, authClient, fs, auth }
let ctxPromise = null;
let user = null;         // the live Firebase user, or null
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(describeUser(user)); } catch (err) { console.error(err); }
  }
}

/* ------------------------------------------------------------------ *
 * Connection
 * ------------------------------------------------------------------ */

async function init() {
  if (ctxPromise) return ctxPromise;

  ctxPromise = (async () => {
    const [appMod, auth, fs] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);

    // initializeApp throws if called twice. A hot reload, a second entry point,
    // or a retry after a failed connect all hit that.
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);

    // Offline persistence is non-negotiable (D6 — gyms are basements). It can
    // legitimately fail: private browsing, storage denied, or Firestore already
    // initialised elsewhere. None of those should take the app down, so fall
    // back to a memory-cached instance rather than throwing.
    let db;
    try {
      db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (err) {
      console.warn('Firestore offline persistence unavailable; continuing without it.', err);
      db = fs.getFirestore(app);
    }

    const authClient = auth.getAuth(app);

    /* A Google sign-in that went the redirect route lands back here. This must
     * run before the anonymous fallback below, or we would create a throwaway
     * anonymous account on top of a successful sign-in.
     *
     * ⚠️ ONLY ASKED WHERE A REDIRECT COULD HAVE HAPPENED — added 2026-08-22
     * after Tim hit this on his iPhone:
     *
     *     "Unable to process request due to missing initial state. This may
     *      happen if browser sessionStorage is inaccessible or accidentally
     *      cleared … 2) Using signInWithRedirect in a storage-partitioned
     *      browser environment."
     *
     * That is `auth/missing-initial-state`, and calling `getRedirectResult()`
     * is what asks for the state it is complaining about. On iOS Safari the
     * sessionStorage the redirect flow needs is partitioned away from this
     * origin, so the question cannot be answered — and in THIS configuration it
     * should never be asked, because `redirectCanComplete()` is false: the app
     * is on `timothyhadfield.github.io` and the authDomain is not, so a redirect
     * could never legitimately have been started in the first place.
     *
     * ⚠️ Guarded on the same predicate the sign-in path uses, not on a browser
     * check. The day this app moves to a domain where redirect works, both
     * halves start working together — a guard that had to be remembered
     * separately is a guard that gets forgotten.
     */
    if (redirectCanComplete(FIREBASE_CONFIG)) {
      try {
        await auth.getRedirectResult(authClient);
      } catch (err) {
        console.error('Google redirect sign-in failed', err);
      }
    }

    // Keep a live subscription — the uid can change at any time (sign in, sign
    // out, link) and the data layer has to follow it.
    let settleFirst;
    const first = new Promise((resolve) => { settleFirst = resolve; });
    auth.onAuthStateChanged(authClient, (u) => {
      user = u;
      if (settleFirst) { settleFirst(u); settleFirst = null; }
      notify();
    }, (err) => {
      console.error('Auth state error', err);
      if (settleFirst) { settleFirst(null); settleFirst = null; }
    });

    let signedIn = await first;
    if (!signedIn) signedIn = (await auth.signInAnonymously(authClient)).user;
    user = signedIn;

    ctx = { app, db, authClient, fs, auth };
    return ctx;
  })();

  try {
    return await ctxPromise;
  } catch (err) {
    ctxPromise = null;   // let a later attempt retry instead of failing forever
    throw err;
  }
}

function docRef(c, collection) {
  if (!user) throw new Error('Not signed in.');
  return c.fs.doc(c.db, 'users', user.uid, 'collections', collection);
}

/* ------------------------------------------------------------------ *
 * SHARDED COLLECTIONS — the network half. The pure half, and the whole
 * argument for why any of this exists, is at the bottom of this file.
 *
 * A sharded collection lives at `users/{uid}/{name}/{rowId}` as
 * `{ row, updatedAt }`, one document per row, alongside the old whole-list
 * document at `users/{uid}/collections/{name}` which migration empties.
 *
 * ⚠️ EVERY DEPENDENCY IS AN ARGUMENT, AND THAT IS NOT A STYLE PREFERENCE.
 * This file opens by admitting that its network paths have never been
 * executed — the SDK is fetched from a URL and creating the project needed a
 * Google login only Tim has. That was tolerable for code whose worst failure
 * is a save that does not happen. It is NOT tolerable for the one function in
 * this project that deletes documents holding somebody's training history.
 *
 * So the Firestore surface it needs (`fs`, `db`) and the account it acts on
 * (`uid`) come in as parameters instead of being read off module state, and
 * `tests/data-layer.test.mjs` drives the whole thing — migrate, verify, empty,
 * diff, delete — against an in-memory double. It is still not a test against
 * Firestore. It is the difference between reviewed code and executed code.
 * ------------------------------------------------------------------ */

/**
 * Read/write for the sharded collections of ONE account.
 *
 * @param {{fs: object, db: object}} c   the Firestore surface
 * @param {string} uid                   whose data this is
 */
// The most sessions one non-wholesale write may delete. Ordinary use deletes
// one at a time; two leaves room for a same-write edge nobody has met yet.
export const MASS_DELETE_MAX = 2;

/* ------------------------------------------------------------------ *
 * 💷 READING ONLY WHAT CHANGED — 2026-09-08, and it is a COST fix
 *
 * 🚨 THE FINDING IT ANSWERS, from `docs/running-costs.html` (2026-09-06):
 * `readShard()` did `getDocs()` over the WHOLE sessions collection on every
 * cold open, so the bill scaled with how LONG somebody had trained rather than
 * how much. A three-year user cost 3× a one-year user for the same exercise,
 * forever, and it never levelled off. Reads were 81 % of the bill at 10 k
 * users. Measured worth: **~20× at every scale** — free servers to ~1,894
 * users instead of ~94.
 *
 * ⚠️ OFFLINE PERSISTENCE DOES NOT HELP AND NEVER DID. Firestore bills a
 * one-shot query by the documents it returns whether or not they are already
 * on the device; only asking for fewer documents changes the number.
 *
 * THE MECHANISM, and both halves are needed:
 *
 *   1. **`where('updatedAt', '>=', cursor)`** returns only what changed. The
 *      rest of the collection is served out of a local snapshot.
 *   2. **A COUNT catches the deletes**, because a `where >=` query is
 *      structurally blind to them — a deleted document does not come back
 *      changed, it does not come back at all. `getCountFromServer` is billed
 *      at one read per 1,000 documents, so it is nearly free.
 *
 * 🚨 THE COUNT IS COMPARED AGAINST THE SIZE OF THE **MERGED** SET, and the
 * subtle case is worth stating: deleting one session and adding another leaves
 * the collection count unmoved, so a check against "did the count change?"
 * would see nothing and a deleted workout would sit on the calendar for ever.
 * The merge still holds the deleted row — a delete does not come back changed,
 * it does not come back at all — so it comes out one row bigger than the
 * server, and that is what fires. Any mismatch falls back to the full read,
 * which is exactly the old behaviour.
 *
 * ⚠️ THE CURSOR IS A SERVER VALUE, NEVER A DEVICE CLOCK — the maximum
 * `updatedAt` actually seen. A device clock running fast would skip a write
 * permanently.
 *
 * 🚨 AND IT IS KEPT TO THE NANOSECOND, WHICH IS NOT FUSSINESS — THE FIRST
 * VERSION USED MILLISECONDS AND A TEST CAUGHT IT DEAD. Firestore stamps every
 * document in a batch with the same instant, so a restore-from-backup or the
 * adoption of a 1,200-session history gives a whole collection one timestamp.
 * A millisecond cursor compared with `>=` then matched all 1,200 on every
 * sync — and because re-reading them could not produce a NEWER maximum, the
 * cursor was pinned there for ever. **The cheap path silently became the
 * expensive path for exactly the accounts with the most data in them**, which
 * is the failure this whole feature exists to prevent. Storing the real
 * `{seconds, nanoseconds}` and comparing with `>` fixes both halves: the
 * documents we already hold are excluded, and anything committed afterwards
 * has a strictly later stamp because Firestore assigns it at commit.
 *
 * ⚠️ A LOCAL WRITE NEVER ADVANCES THE CURSOR. We do not know what timestamp
 * the server gave our own document, so the next sync re-reads it — a handful
 * of reads once, against inventing a timestamp and skipping a real change.
 * ------------------------------------------------------------------ */

const SHARD_CACHE_PREFIX = 'ftrack:v1:shardCache:';

// Past this a collection is not worth caching in localStorage — the quota is
// ~5 MB shared with everything else in the app, and losing the whole store to
// a QuotaExceededError would cost more than the reads it saves.
const SHARD_CACHE_MAX_BYTES = 1_500_000;

/**
 * Where a shard snapshot is kept between sessions. Injectable so the tests can
 * drive it, and so a browser with storage denied degrades to full reads rather
 * than failing — every method swallows, because a cache that cannot be read is
 * a slower app and a cache that throws is a broken one.
 */
export function localShardCache(storage) {
  const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
  const key = (uid, collection) => `${SHARD_CACHE_PREFIX}${uid}:${collection}`;
  return {
    get(uid, collection) {
      if (!store) return null;
      try {
        const raw = store.getItem(key(uid, collection));
        if (!raw) return null;
        const v = JSON.parse(raw);
        // A shape check rather than trust: this is parsed from a store any
        // other script on the origin can write to, and a bad `rows` would be
        // handed to the diff that decides what to DELETE.
        if (!v || !Array.isArray(v.rows)) return null;
        if (!v.cursor || typeof v.cursor.seconds !== 'number'
            || typeof v.cursor.nanoseconds !== 'number') return null;
        return v;
      } catch { return null; }
    },
    set(uid, collection, value) {
      if (!store) return;
      try {
        const raw = JSON.stringify(value);
        if (raw.length > SHARD_CACHE_MAX_BYTES) { this.clear(uid, collection); return; }
        store.setItem(key(uid, collection), raw);
      } catch {
        // Out of quota, or private browsing. Drop this collection's copy so a
        // half-written one can never be read back as whole.
        this.clear(uid, collection);
      }
    },
    clear(uid, collection) {
      if (!store) return;
      try { store.removeItem(key(uid, collection)); } catch { /* nothing to do */ }
    },
  };
}

/**
 * Firestore Timestamp | {seconds,nanoseconds} | null → `{seconds, nanoseconds}`.
 *
 * ⚠️ SECONDS AND NANOSECONDS, NOT MILLISECONDS — see the header. A whole
 * collection written in one batch shares one instant, and at millisecond
 * resolution the cursor could never get past it.
 */
export function timestampParts(ts) {
  if (!ts) return null;
  if (typeof ts.seconds === 'number') {
    return { seconds: ts.seconds, nanoseconds: ts.nanoseconds || 0 };
  }
  if (typeof ts.toMillis === 'function') {
    const ms = ts.toMillis();
    return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
  }
  return null;
}

/**
 * Is `a` strictly after `b`?
 *
 * ⚠️ Compared as a PAIR rather than as one number: `seconds * 1e9 + nanos` is
 * about 1.7e18 today and `Number.MAX_SAFE_INTEGER` is 9e15, so the obvious
 * arithmetic silently loses the nanoseconds this function exists to keep.
 */
export function tsAfter(a, b) {
  if (!a) return false;
  if (!b) return true;
  return a.seconds !== b.seconds ? a.seconds > b.seconds : a.nanoseconds > b.nanoseconds;
}

/**
 * The arithmetic of an incremental sync, with no Firestore in it.
 *
 * @param cachedRows  what this device already had
 * @param changed     [{ row, at }] the documents the `updatedAt` query returned
 * @param serverCount what the collection really holds, or null if unknown
 * @returns {{rows, cursorMs, full}} — `full: true` means "do not trust this,
 *          read the whole collection", which is the old behaviour.
 */
export function mergeIncremental(cachedRows, changed, serverCount, cursor) {
  const byId = new Map((cachedRows || []).map((r) => [String(r.id), r]));
  let fresh = 0;
  let newest = cursor;
  for (const { row, at } of changed) {
    const id = String(row.id);
    if (!byId.has(id)) fresh++;
    byId.set(id, row);
    if (tsAfter(at, newest)) newest = at;
  }
  const rows = [...byId.values()];

  /* 🚨 THE MERGED SET MUST BE EXACTLY AS BIG AS THE SERVER SAYS THE COLLECTION
   * IS, and that one line is what makes the whole scheme safe against deletes.
   * A deleted document does not come back changed — it does not come back at
   * all — so it survives in the merge, and the merged set is then one bigger
   * than the collection. Delete one session and add another and the raw count
   * is unmoved, but the merge holds four rows against a server holding three,
   * so it is still caught.
   *
   * ⚠️ `cached + genuinely-new` IS `rows.length`. A mutation check proved it:
   * swapping one for the other changed nothing, because the merge is the union
   * of exactly those two sets. This comment previously claimed the two were
   * different and that the distinction was what caught delete-plus-add. It was
   * wrong; the reason above is the real one. Written out because a false
   * mechanism in a comment is how the next person "simplifies" the true one
   * away. */
  const expected = (cachedRows || []).length + fresh;
  if (serverCount === null || serverCount !== expected) {
    return { rows: [], cursor, full: true };
  }
  return { rows, cursor: newest, full: false };
}

export function createShardIO(c, uid, cache = localShardCache()) {
  // id → JSON of the row as this tab last saw it, per collection. What makes a
  // write cost one document instead of five hundred.
  //
  // ⚠️ IT LIVES INSIDE THE ACCOUNT, which is the point of the factory. A memo
  // shared across a sign-in would diff the new account's rows against the
  // previous account's, and the DELETES that came out of that would land on
  // documents belonging to whoever just signed in. Making it impossible to
  // share beats remembering to clear it.
  const memo = new Map();

  const col = (name) => c.fs.collection(c.db, 'users', uid, name);
  // ⚠️ There is deliberately NO ref to users/{uid}/collections/{name} in this
  // factory. The sharded path has no way to address the legacy document, so
  // no future edit here can write to it by accident. See the prohibition below.

  /** The whole collection, and the newest `updatedAt` in it. */
  async function readShardAll(collection) {
    const snap = await c.fs.getDocs(col(collection));
    const rows = [];
    let cursor = null;
    snap.forEach((d) => {
      const data = d.data();
      // ⚠️ The document NAME is the row id, and it overrides whatever is in
      // the payload. They are written together and cannot disagree — but if
      // they ever did, the name is the one the delete path addresses, so
      // trusting the other one would leave a row that cannot be removed.
      if (data && data.row) {
        rows.push({ ...data.row, id: d.id });
        const at = timestampParts(data.updatedAt);
        if (tsAfter(at, cursor)) cursor = at;
      }
    });
    return { rows, cursor };
  }

  async function readShard(collection) {
    return (await readShardAll(collection)).rows;
  }

  /**
   * The whole collection, but paying only for what changed. Falls back to
   * `readShard()` — the old behaviour — on anything it cannot prove.
   *
   * ⚠️ EVERY FAILURE PATH HERE ENDS IN A FULL READ, and that is the property
   * to preserve if this is ever edited: no cache, an old build's cache, a
   * count that will not come back, a count that disagrees, a Firestore surface
   * without `query`/`getCountFromServer`. Being slower and right is the only
   * acceptable failure mode for the code that decides what somebody's training
   * history contains.
   */
  /**
   * A full read, and the snapshot that lets the NEXT one be incremental.
   *
   * ⚠️ No cursor means no cache written. A collection whose documents carry no
   * server timestamp yet (every write in the same tick, or a fixture) would
   * otherwise be cached against a null cursor and every later sync would ask
   * for everything anyway — slower than not caching, and harder to reason about.
   */
  async function fullReadAndSeed(collection) {
    const { rows, cursor } = await readShardAll(collection);
    if (!cursor) cache.clear(uid, collection);
    else cache.set(uid, collection, { rows, cursor });
    return rows;
  }

  async function readShardIncremental(collection) {
    const cached = cache.get(uid, collection);
    const canQuery = c.fs.query && c.fs.where && c.fs.getCountFromServer && c.fs.Timestamp;
    if (!cached || !canQuery) return fullReadAndSeed(collection);

    const changed = [];
    let serverCount = null;
    try {
      // ⚠️ `>`, against the exact stamp of the newest document we hold. See the
      // header: `>=` on a millisecond cursor pinned a bulk-written collection
      // in place and re-read all of it, forever.
      const since = new c.fs.Timestamp(cached.cursor.seconds, cached.cursor.nanoseconds);
      const snap = await c.fs.getDocs(
        c.fs.query(col(collection), c.fs.where('updatedAt', '>', since)));
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.row) {
          changed.push({ row: { ...data.row, id: d.id }, at: timestampParts(data.updatedAt) });
        }
      });
      const agg = await c.fs.getCountFromServer(col(collection));
      const n = agg && agg.data ? agg.data().count : null;
      serverCount = typeof n === 'number' ? n : null;
    } catch (err) {
      // Offline, a missing index, a rules change — anything at all.
      console.warn('Incremental sync unavailable; reading the whole collection.', err);
      return fullReadAndSeed(collection);
    }

    const out = mergeIncremental(cached.rows, changed, serverCount, cached.cursor);
    if (out.full) return fullReadAndSeed(collection);
    cache.set(uid, collection, { rows: out.rows, cursor: out.cursor });
    return out.rows;
  }

  async function commitOps(ops) {
    for (const chunk of inBatches(ops, BATCH_LIMIT)) {
      const batch = c.fs.writeBatch(c.db);
      for (const op of chunk) {
        if (op.kind === 'set') batch.set(op.ref, { row: op.row, updatedAt: c.fs.serverTimestamp() });
        else batch.delete(op.ref);
      }
      await batch.commit();
    }
  }

  /* ⚠️ THE LEGACY DOCUMENT IS NEVER WRITTEN BY THIS MODULE. NOT EMPTIED, NOT
   * "TIDIED", NOT TOUCHED — and this paragraph is a LOAD-BEARING PROHIBITION,
   * written after the design it replaces erased the sessions off Tim's own
   * calendar on 2026-08-26 (progress.md, the 2026-08-28 emergency section).
   *
   * The first migration wrote the shards, verified them by re-reading, and
   * then emptied the whole-list document as its "migrated" flag. The
   * verification was sound about what it saw; the emptying was the mistake,
   * twice over:
   *
   *   1. Every client running the PREVIOUS build reads ONLY that document.
   *      Emptying it showed every old client a blank training history —
   *      which is exactly what Tim's phone did.
   *   2. A `getDoc` served from a stale offline cache would migrate the rows
   *      the cache knew about and then overwrite the SERVER's fuller document
   *      with an empty list. Verification cannot catch that, because it can
   *      only verify what was read.
   *
   * So the design is now ADOPTION, not migration: legacy rows that are not in
   * the shard yet are copied in (idempotent — upserts by id), reads always
   * merge both sources with the shard winning, and the whole-list document is
   * left exactly as it was, forever, as a frozen at-adoption backup floor
   * that old builds can still read and still write. The one cost is that a
   * post-adoption edit made on an OLD build is invisible to new builds until
   * that row's id is new; that was already the documented collision rule.
   */

  async function adopt(collection, legacyRows) {
    const existing = await readShard(collection);
    const merged = mergeShardAndLegacy(existing, legacyRows);
    const { writes } = shardDiff(shardSnapshot(existing), merged);
    if (writes.length) {
      await commitOps(writes.map((row) => ({
        kind: 'set', ref: c.fs.doc(col(collection), String(row.id)), row,
      })));
      // 💷 Documents just appeared with timestamps we did not see. Throwing the
      // snapshot away costs one full read next time and removes the whole
      // question of whether a cursor from before an adoption still means
      // anything.
      cache.clear(uid, collection);
    }
    return merged;
  }

  return {
    /**
     * @param {string} collection
     * @param {Array} legacyRows  whatever the old whole-list document holds —
     *   the caller has already read it, so this does not read it twice.
     */
    async read(collection, legacyRows) {
      // ⚠️ BOTH SOURCES, EVERY READ, FOREVER. The legacy getDoc was already
      // paid before sharding existed, and it is what makes an old client's
      // writes recoverable rather than a silent divergence: whatever it wrote
      // gets adopted into the shard on the next read here. Once everything is
      // adopted, adopt() computes zero writes and this is read-only.
      // 💷 The incremental path is the ordinary one and the whole point of the
      // cost work; adoption stays a full read because it is comparing the shard
      // against a legacy document and has to see all of both. Once everything
      // is adopted, `legacyRows` for a new account is empty forever and this
      // never runs again.
      const rows = legacyRows.length
        ? await adopt(collection, legacyRows)
        : await readShardIncremental(collection);
      memo.set(collection, shardSnapshot(rows));
      return rows;
    },

    async write(collection, rows, opts) {
      // ⚠️ NO MEMO MEANS NO GROUND TRUTH, SO READ FIRST. Without this, a write
      // that is the first thing this tab does to the collection — `clearAll()`,
      // or restoring a backup — would find nothing to delete and leave every
      // existing document in place while believing it had replaced them.
      //
      // In ordinary use it never fires: every mutation in store.js reads the
      // collection immediately before writing it, deliberately bypassing the
      // read cache, so the memo is not merely warm but was filled by THIS
      // read-modify-write cycle.
      if (!memo.has(collection)) {
        memo.set(collection, shardSnapshot(await readShard(collection)));
      }

      const { writes, deletes } = shardDiff(memo.get(collection), rows);

      /* ⚠️ THE MASS-DELETE GUARD — 2026-08-28, Tim: "make it extremely
       * difficult to erase data from people's accounts."
       *
       * No ordinary user action deletes more than one session at a time. The
       * only flows that legitimately remove many rows at once are Clear all
       * and Restore from backup, and both now declare themselves with
       * `wholesale` after taking a cloud snapshot first (store.js). Anything
       * else asking to delete more than MASS_DELETE_MAX rows in one write is
       * assumed to be a BUG — a stale read, a bad merge, a future refactor —
       * and the entire write is refused, not trimmed: a write whose delete
       * half is wrong has no trustworthy halves.
       */
      if (!(opts && opts.wholesale) && deletes.length > MASS_DELETE_MAX) {
        throw new Error(
          `Refusing to delete ${deletes.length} ${collection} rows in one write. `
          + 'If this is a real bulk removal it must go through the wholesale path.');
      }

      const target = col(collection);
      await commitOps([
        ...writes.map((row) => ({ kind: 'set', ref: c.fs.doc(target, String(row.id)), row })),
        // ⚠️ Deleting a row is a DOCUMENT DELETE here, where in a whole-list
        // collection it was a write of a shorter list. That is a permission the
        // rules did not previously need to grant anywhere, and firestore.rules
        // says so at the sessions block.
        ...deletes.map((id) => ({ kind: 'delete', ref: c.fs.doc(target, id) })),
      ]);

      // After the await, for the reason the store's own write cache gives: a
      // commit that threw has changed nothing, and recording what we hoped to
      // store is a lie the next diff reads back as fact.
      memo.set(collection, shardSnapshot(rows));

      /* 💷 The between-sessions snapshot follows the write, and ⚠️ THE CURSOR
       * DELIBERATELY DOES NOT MOVE. We do not know what `serverTimestamp()`
       * resolved to on our own documents, so the next sync re-reads them — a
       * handful of billed reads, once, against the alternative of inventing a
       * timestamp and skipping somebody's change. This is also what keeps
       * `clearAll()` and Restore from backup honest: they land here like any
       * other write, so the snapshot is replaced rather than left describing
       * an account that no longer looks like that. */
      const prior = cache.get(uid, collection);
      if (prior) cache.set(uid, collection, { rows, cursor: prior.cursor });
      return true;
    },
  };
}


// The live one, rebuilt whenever the uid changes. Never shared across accounts
// — see the memo note in createShardIO().
let shardIO = null;
let shardIOUid = null;

function shards(c) {
  if (!user) throw new Error('Not signed in.');
  if (!shardIO || shardIOUid !== user.uid) {
    shardIO = createShardIO(c, user.uid);
    shardIOUid = user.uid;
  }
  return shardIO;
}

/* ------------------------------------------------------------------ *
 * 🚨 DELETING AN ACCOUNT — the purge. 2026-09-10.
 *
 * ⚠️ WHAT THIS REPLACES, because the old shape is the whole argument for the
 * new one. `deleteAccount()` used to clear the account by calling `write()`
 * with an empty list, over a HAND-TYPED list of five collection names, each
 * call wrapped in a try/catch that logged and carried on. Three separate
 * things were wrong with that and every one of them was silent:
 *
 *   1. **The list was five of ten.** `bodyWeight`, `systems`, `goals`,
 *      `people` and `guestSessions` were never named, so every weigh-in,
 *      programme, goal, saved person and guest workout stayed exactly where it
 *      was. Nothing said so: the loop finished, the toast said "Account
 *      deleted".
 *   2. **`sessions` was named and still could not be cleared.** A sharded
 *      write of `[]` is a mass delete, and the guard above refuses one without
 *      `wholesale` — correctly. The throw was caught, logged, and ignored, so
 *      the ONE collection the list did get right was the one that failed.
 *   3. **`write()` cannot reach most of an account anyway.** It addresses
 *      `collections/{name}` and the two shards. It has no way to name
 *      `shared/*`, `social/*`, `invites/*`, `handoffs/*`, `disconnects/*`,
 *      `requests/*`, `reactions/*` or `backups/*` — and `shared` is the one
 *      that matters most, because it is the copy OTHER PEOPLE read. A public
 *      account that deleted itself left its published training readable by
 *      anybody signed in, for ever.
 *
 * 🚨 SO THIS IS NOT `write()` WITH A FLAG ON IT, AND THAT IS DELIBERATE.
 * `progress.md` item 27 said the fix looked like one word (`{ wholesale:
 * true }`) and that the word was the wrong fix, and it was right. The guard
 * exists so that nobody sprinkles that flag around; the two flows already
 * allowed to use it (Clear all, Restore from backup) SNAPSHOT TO THE CLOUD
 * FIRST, and a safety copy written into an account that is about to stop
 * existing is not a safety copy — it is one more unreachable document with a
 * bill attached. Deleting an account is a different operation from writing a
 * row list, so it gets its own path and the guard goes on guarding writes.
 *
 * 🔒 AND IT VERIFIES BEFORE THE ACCOUNT GOES, which is the property the old
 * code had no way to have. `deleteUser()` is the irreversible step: after it
 * the uid is gone, every rule here is `isOwner`, and anything left behind can
 * never be reached or removed by anyone — not by the user, not by Tim, not by
 * a later build. So the purge deletes everything it can, then RE-READS to see
 * what actually survived, and throws rather than deleting the user if
 * anything did. Failing towards "your account still exists, try again" is the
 * only acceptable direction; the purge is idempotent, so a retry resumes.
 *
 * ⚠️ ONE FAILURE DOES NOT STOP THE OTHERS. Phase one is best-effort over
 * every path, collecting errors rather than throwing on the first, because a
 * network blip on `backups` is no reason to leave `shared` published. The
 * verification pass is what decides the outcome.
 * ------------------------------------------------------------------ */

/**
 * Every subcollection an account owns, in the order they are purged.
 *
 * 🚨 THE ORDER IS THE REVOCATION ORDER, NOT ALPHABETICAL. `shared` holds the
 * published copies and `reactions` is friend-readable, so those two go first:
 * if the purge is interrupted half way — a closed tab, a dropped connection —
 * what has already gone is everything anybody else could read.
 *
 * ⚠️ `collections` IS NOT IN THIS LIST and cannot be. `firestore.rules` says
 * `allow delete: if false` on `users/{uid}/collections/{name}` — clearing one
 * has always been a write of an empty list, never a document delete — so those
 * ten documents are emptied instead, below.
 */
export const PURGED_SUBCOLLECTIONS = [
  'shared', 'reactions',
  'sessions', 'guestSessions',
  'social', 'invites', 'handoffs', 'disconnects', 'requests', 'backups',
];

/**
 * Remove everything one account owns under `users/{uid}`.
 *
 * Dependency-injected for the reason the sharding header gives at length: this
 * file's network paths have never been executed against Firestore, and that is
 * tolerable for a save that might not happen and not tolerable for the function
 * that deletes somebody's training. `tests/data-layer.test.mjs` drives the
 * whole thing — delete, verify, survive a failure — against an in-memory double.
 *
 * @param {{fs: object, db: object}} c   the Firestore surface
 * @param {string} uid                   whose account this is
 * @param {string[]} collections         COLLECTIONS from store.js, which owns
 *   that list. Passed in rather than copied here: a hand-typed second copy is
 *   exactly what left five of ten collections behind, and a test now asserts
 *   the caller hands over every one of them.
 * @returns {Promise<{deleted: number, left: string[], errors: string[]}>}
 *   `left` is what survived the verification pass. Empty means empty.
 */
export function createAccountPurge(c, uid, collections) {
  const col = (name) => c.fs.collection(c.db, 'users', uid, name);
  const legacyDoc = (name) => c.fs.doc(c.db, 'users', uid, 'collections', name);

  async function refsIn(name) {
    const snap = await c.fs.getDocs(col(name));
    const refs = [];
    snap.forEach((d) => refs.push(c.fs.doc(col(name), d.id)));
    return refs;
  }

  return async function purge() {
    const errors = [];
    let deleted = 0;

    // --- phase one: remove everything, best-effort ---
    for (const name of PURGED_SUBCOLLECTIONS) {
      try {
        const refs = await refsIn(name);
        for (const chunk of inBatches(refs, BATCH_LIMIT)) {
          const batch = c.fs.writeBatch(c.db);
          for (const ref of chunk) batch.delete(ref);
          await batch.commit();
        }
        deleted += refs.length;
      } catch (err) {
        errors.push(`${name}: ${err && err.message ? err.message : String(err)}`);
      }
    }

    /* ⚠️ AND THE LEGACY WHOLE-LIST DOCUMENTS, INCLUDING THE TWO SHARDED ONES.
     * The prohibition in createShardIO() — that the legacy document is never
     * written, because emptying it is what erased Tim's calendar on 2026-08-26
     * — is about an account that CONTINUES TO EXIST, where that document is the
     * backup floor and old clients still read it. This is the one case where it
     * is the point: an account that never migrated holds its whole training
     * history there, and leaving it would leave everything behind. */
    for (const name of collections) {
      try {
        await c.fs.setDoc(legacyDoc(name), { rows: [], updatedAt: c.fs.serverTimestamp() });
      } catch (err) {
        errors.push(`${name}: ${err && err.message ? err.message : String(err)}`);
      }
    }

    /* --- phase two: 🔒 re-read and see what is REALLY gone ---
     * The cost is one billed read per empty query, which is nothing, and it
     * buys the only thing worth having here: the caller may delete the auth
     * user if and only if this comes back empty. A failed delete that was
     * merely logged is what shipped the original bug. */
    const left = [];
    for (const name of PURGED_SUBCOLLECTIONS) {
      try {
        const refs = await refsIn(name);
        if (refs.length) left.push(`${name} (${refs.length})`);
      } catch (err) {
        // Unverifiable is not the same as clean, and must not be treated as it.
        left.push(`${name} (could not check)`);
        errors.push(`${name}: ${err && err.message ? err.message : String(err)}`);
      }
    }
    for (const name of collections) {
      try {
        const snap = await c.fs.getDoc(legacyDoc(name));
        const rows = snap.exists() && snap.data() ? snap.data().rows : null;
        if (Array.isArray(rows) && rows.length) left.push(`${name} (${rows.length})`);
      } catch (err) {
        left.push(`${name} (could not check)`);
        errors.push(`${name}: ${err && err.message ? err.message : String(err)}`);
      }
    }

    return { deleted, left, errors };
  };
}

/* ------------------------------------------------------------------ *
 * Backend API — matches LocalBackend
 * ------------------------------------------------------------------ */

export const FirebaseBackend = {
  async ready() { await init(); return describeUser(user); },

  async read(collection) {
    const c = await init();
    // Deliberately NOT caught. The store does read-modify-write, so swallowing
    // a failed read and returning [] would let the next write persist an empty
    // list over real cloud data.
    const snap = await c.fs.getDoc(docRef(c, collection));
    const data = snap.exists() ? snap.data() : null;
    const legacy = data && Array.isArray(data.rows) ? data.rows : [];

    if (!SHARDED_COLLECTIONS.includes(collection)) return legacy;
    return shards(c).read(collection, legacy);
  },

  async write(collection, rows, opts) {
    const c = await init();
    if (SHARDED_COLLECTIONS.includes(collection)) return shards(c).write(collection, rows, opts);
    await c.fs.setDoc(docRef(c, collection), {
      rows,
      updatedAt: c.fs.serverTimestamp(),
    });
    return true;
  },

  /**
   * One backup document at users/{uid}/backups/{id} — the store decides when
   * and what (see the CLOUD BACKUPS section in store.js); this only holds the
   * path. Owner-only under the rules; `rolling-*` ids may be overwritten (the
   * 7-day ring), `snap-*` ids are immutable.
   */
  async writeBackup(id, data) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', user.uid, 'backups', String(id)),
      { ...data, updatedAt: c.fs.serverTimestamp() });
    return true;
  },

  /* --- social ---------------------------------------------------------
   *
   * ⚠️ These do NOT go through docRef(). Everything else in this file reads and
   * writes users/{uid}/collections/{name} and is owner-only by construction;
   * social is the one place the app touches a path belonging to somebody else.
   * Each method therefore names its full path explicitly, so a reader can see
   * whose data it is from the call site rather than inferring it.
   *
   * The rules are what enforce all of this. These methods only decide what to
   * ASK for; firestore.rules decides what is answered. See docs/social-plan.md.
   * ------------------------------------------------------------------ */

  currentUid() { return user ? user.uid : null; },

  // Owner-private: who I am connected to and what each of them may see.
  async readGraph() {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    const snap = await c.fs.getDoc(c.fs.doc(c.db, 'users', user.uid, 'social', 'graph'));
    return snap.exists() ? snap.data() : null;
  },

  async writeGraph(graph) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', user.uid, 'social', 'graph'), graph);
    return true;
  },

  // Publish one audience's projection — 'friends' or 'public'. The document is
  // written WHOLE every time, never merged, so a field that stops being shared
  // actually disappears rather than lingering from the previous publish.
  async publishShared(audience, doc) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', user.uid, 'shared', audience), doc);
    return true;
  },

  async unpublishShared(audience) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', user.uid, 'shared', audience));
    return true;
  },

  // Somebody else's projection. Returns null when the rules refuse, which is
  // the normal answer while probing — see PROBE_ORDER in social.js — and must
  // not be logged as an error or it fills the console on every visit.
  async readShared(ownerUid, audience) {
    const c = await init();
    try {
      const snap = await c.fs.getDoc(c.fs.doc(c.db, 'users', ownerUid, 'shared', audience));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      if (err && err.code === 'permission-denied') return null;
      throw err;
    }
  },

  /* --- reactions: kudos + comments on published workouts --- */

  // Everything reacted onto ownerUid's workouts. permission-denied is the
  // normal answer for somebody who is not a viewer, same as readShared — an
  // empty list, never a console error.
  async listReactions(ownerUid) {
    const c = await init();
    try {
      const snap = await c.fs.getDocs(c.fs.collection(c.db, 'users', ownerUid, 'reactions'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (err && err.code === 'permission-denied') return [];
      throw err;
    }
  },

  // ⚠️ setDoc with a DETERMINISTIC id, and that is the idempotency story:
  // giving kudos twice is the same document twice, not two kudos. `at` is
  // stamped here so the caller cannot forget it — the rules require it.
  async writeReaction(ownerUid, id, data) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', ownerUid, 'reactions', id),
      { ...data, at: c.fs.serverTimestamp() });
    return true;
  },

  async deleteReaction(ownerUid, id) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', ownerUid, 'reactions', id));
    return true;
  },

  /* --- handoffs: a session recorded FOR somebody, offered for them to accept.
   * Open work 0e's friend half. Same permission-denied-is-an-empty-list rule
   * as reactions: not being able to read somebody's list is the normal answer
   * for anybody who is not them, never an error to put on a screen. --- */

  async listHandoffs(ownerUid) {
    const c = await init();
    try {
      const snap = await c.fs.getDocs(c.fs.collection(c.db, 'users', ownerUid, 'handoffs'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (err && err.code === 'permission-denied') return [];
      throw err;
    }
  },

  async writeHandoff(ownerUid, id, data) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', ownerUid, 'handoffs', id),
      { ...data, at: c.fs.serverTimestamp() });
    return true;
  },

  async deleteHandoff(ownerUid, id) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', ownerUid, 'handoffs', id));
    return true;
  },

  /* --- disconnects: "I have left, take me off your list" (Open work 0j) --- */

  async listDisconnects(ownerUid) {
    const c = await init();
    try {
      const snap = await c.fs.getDocs(c.fs.collection(c.db, 'users', ownerUid, 'disconnects'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (err && err.code === 'permission-denied') return [];
      throw err;
    }
  },

  // ⚠️ The document id is the LEAVER'S uid, which the rules check against the
  // caller. That is what makes this "I am leaving" and not "evict them".
  async announceDisconnect(ownerUid) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', ownerUid, 'disconnects', user.uid),
      { from: user.uid, at: c.fs.serverTimestamp() });
    return true;
  },

  async clearDisconnect(ownerUid, leaverUid) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', ownerUid, 'disconnects', leaverUid));
    return true;
  },

  /* --- invites --- */

  async createInvite(token, data) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', user.uid, 'invites', token), data);
    return true;
  },

  async listInvites() {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    const snap = await c.fs.getDocs(c.fs.collection(c.db, 'users', user.uid, 'invites'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async deleteInvite(token) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', user.uid, 'invites', token));
    return true;
  },

  // Reading somebody else's invite by exact id — allowed, because you cannot
  // redeem what you cannot read. Listing them is what the rules refuse.
  async readInvite(ownerUid, token) {
    const c = await init();
    const snap = await c.fs.getDoc(c.fs.doc(c.db, 'users', ownerUid, 'invites', token));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  // ⚠️ updateDoc, not setDoc. The rules allow a claimer to change exactly three
  // fields; setDoc sends the whole document, so every other field counts as
  // affected and the write is refused. This is the one place in the app where
  // that distinction decides whether the feature works at all.
  async claimInvite(ownerUid, token, patch) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.updateDoc(c.fs.doc(c.db, 'users', ownerUid, 'invites', token), patch);
    return true;
  },

  /* --- friend requests: "add me", which they accept (2026-08-29) ---
   *
   * Same permission-denied-is-an-empty-list rule as reactions and handoffs:
   * not being able to read somebody's requests is the normal answer for
   * anybody who is not them, never an error to put on a screen. */

  async listRequests(ownerUid) {
    const c = await init();
    try {
      const snap = await c.fs.getDocs(c.fs.collection(c.db, 'users', ownerUid, 'requests'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (err && err.code === 'permission-denied') return [];
      throw err;
    }
  },

  // ⚠️ The document id is the SENDER'S uid, which the rules check against the
  // caller. That is what makes this "add me" and not "add them" — and it makes
  // asking twice write the same document rather than two rows for one person.
  async sendRequest(toUid, name) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', toUid, 'requests', user.uid),
      { from: user.uid, name: String(name || '').slice(0, 60), at: c.fs.serverTimestamp() });
    return true;
  },

  async deleteRequest(ownerUid, fromUid) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', ownerUid, 'requests', fromUid));
    return true;
  },

  /* --- the public directory (2026-08-29) ---
   *
   * 🚨 The one collection in this app that anybody signed in can LIST. The
   * whole argument is above the `directory` block in firestore.rules and in
   * the "Finding people by name" header of js/social.js — read one of them
   * before touching this. */

  async writeDirectory(name) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) throw new Error('Choose a display name first.');
    await c.fs.setDoc(c.fs.doc(c.db, 'directory', user.uid), {
      uid: user.uid,
      name: clean,
      // Stored lower-cased so the client can match without downcasing every
      // row on every keystroke. The matching itself is in social.js.
      nameLower: clean.toLowerCase().replace(/\s+/g, ' '),
      updatedAt: c.fs.serverTimestamp(),
    });
    return true;
  },

  async removeDirectory() {
    const c = await init();
    if (!user) return false;
    await c.fs.deleteDoc(c.fs.doc(c.db, 'directory', user.uid)).catch(() => {});
    return true;
  },

  /**
   * ⚠️ THE WHOLE COLLECTION, CAPPED, MATCHED IN THE CLIENT.
   *
   * A prefix query would look tighter and would not be: `list` is `list`, and
   * the rules cannot restrict a `where` clause, so the permission this needs is
   * the same permission a full scan needs. Given that, fetching a page and
   * matching in social.js is strictly better at finding the right person — a
   * Firestore prefix only matches the START of the whole string, so a surname
   * would never match.
   *
   * The cap is a BILLING guard rather than a privacy one, and calling it that
   * matters: it bounds what one search costs, not what an attacker can reach.
   */
  async searchDirectory(max = 300) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    const snap = await c.fs.getDocs(
      c.fs.query(c.fs.collection(c.db, 'directory'), c.fs.limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      // Never offer yourself as somebody to add.
      .filter((r) => r.uid !== user.uid);
  },

  /* --- notes to the developer (2026-09-04) ---
   *
   * ⚠️ THE ONLY THING PROTECTING THESE IS `firestore.rules`. Nothing below
   * checks who is asking, on purpose: a client-side check would be a second,
   * weaker definition of "developer" that could drift from the rule, and the
   * rule is the one that holds against a client that is not ours. `listNotes()`
   * simply fails for everybody else, which is what it should do. */

  async sendNote(note) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    // A generated id rather than the uid: one person may send more than one.
    const ref = c.fs.doc(c.fs.collection(c.db, 'feedback'));
    await c.fs.setDoc(ref, note);
    return ref.id;
  },

  async listNotes(max = 500) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    // No orderBy — see sortNotes() in js/feedback.js for why the sort is done
    // in the client. The cap is a billing guard.
    const snap = await c.fs.getDocs(
      c.fs.query(c.fs.collection(c.db, 'feedback'), c.fs.limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async deleteNote(id) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'feedback', String(id)));
    return true;
  },

  /* --- accounts --- */

  currentUser() { return describeUser(user); },

  onUserChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Adding email/password to an anonymous account LINKS it, so the uid and all
  // existing data carry over. Only a genuinely signed-out user creates a new one.
  async signUpEmail(email, password) {
    const c = await init();
    if (user && user.isAnonymous) {
      const cred = c.auth.EmailAuthProvider.credential(email, password);
      const res = await c.auth.linkWithCredential(user, cred);
      user = res.user;
      notify();
      return describeUser(user);
    }
    const res = await c.auth.createUserWithEmailAndPassword(c.authClient, email, password);
    user = res.user;
    notify();
    return describeUser(user);
  },

  async signInEmail(email, password) {
    const c = await init();
    const res = await c.auth.signInWithEmailAndPassword(c.authClient, email, password);
    user = res.user;
    notify();
    return describeUser(user);
  },

  // Returns a tagged result rather than a user-or-null, because "cancelled" and
  // "the page is navigating to Google" are different things and the UI has to
  // tell them apart. Collapsing both to null is what made a cancelled popup
  // look like a dead button.
  //   { status: 'signed-in', user, created } · { status: 'redirecting' } · { status: 'cancelled' }
  //
  // ⚠️ `created` IS NOT COSMETIC — store.js carries this device's local data
  // into the account on the strength of it (2026-09-08). Creating an account
  // means the data on this device is yours; signing in to one that already
  // exists means it is somebody's account with its own history, and merging a
  // stray browser into it would be the opposite of what the person asked for.
  async signInGoogle({ forceRedirect = false } = {}) {
    const c = await init();
    const out = await googleSignInFlow({
      auth: c.auth,
      authClient: c.authClient,
      provider: new c.auth.GoogleAuthProvider(),
      currentUser: user,
      anon: Boolean(user && user.isAnonymous),
      preferRedirect: forceRedirect || prefersRedirect(FIREBASE_CONFIG),
    });
    if (out.cancelled) return { status: 'cancelled' };
    if (!out.user) return { status: 'redirecting' };
    user = out.user;
    notify();
    return { status: 'signed-in', user: describeUser(user), created: Boolean(out.created) };
  },

  // Sign out, then take a fresh anonymous account so the app still works.
  // The old anonymous account (if it was never upgraded) becomes unreachable —
  // which is why the UI warns before signing out of one.
  async signOut() {
    const c = await init();
    await c.auth.signOut(c.authClient);
    const res = await c.auth.signInAnonymously(c.authClient);
    user = res.user;
    notify();
    return describeUser(user);
  },

  async sendPasswordReset(email) {
    const c = await init();
    await c.auth.sendPasswordResetEmail(c.authClient, email);
  },

  // Changing a password or deleting an account are "recent login" operations.
  // Firebase rejects them on a stale session, so take the current password and
  // re-authenticate first rather than surfacing a confusing error.
  async changePassword(currentPassword, newPassword) {
    const c = await init();
    const u = c.authClient.currentUser;
    if (!u || !u.email) throw new Error('You need an email account to set a password.');
    await c.auth.reauthenticateWithCredential(
      u, c.auth.EmailAuthProvider.credential(u.email, currentPassword));
    await c.auth.updatePassword(u, newPassword);
  },

  /**
   * 🚨 THE DATA GOES FIRST, THEN THE ACCOUNT, AND THE ORDER IS NOT A
   * PREFERENCE. `deleteUser()` is irreversible and every rule in
   * firestore.rules is `isOwner`, so anything still under `users/{uid}` when
   * the uid stops existing can never be read or removed by anybody again.
   *
   * 🔒 WHICH IS WHY A FAILED PURGE ABORTS THE DELETION RATHER THAN BEING
   * LOGGED. The old code swallowed every error and called `deleteUser()`
   * regardless — see the purge header above for the three ways that went
   * wrong. Keeping the account is recoverable (the purge is idempotent, so
   * pressing the button again resumes); orphaning it is not.
   *
   * @param {string[]} collections  COLLECTIONS, handed down by store.js.
   */
  async deleteAccount(currentPassword, collections) {
    const c = await init();
    const u = c.authClient.currentUser;
    if (!u) throw new Error('Not signed in.');
    if (!Array.isArray(collections) || !collections.length) {
      // Refuse rather than default. A purge working from a list it invented is
      // precisely the fault being fixed here.
      throw new Error('Cannot delete an account without the collection list.');
    }

    if (currentPassword && u.email) {
      await c.auth.reauthenticateWithCredential(
        u, c.auth.EmailAuthProvider.credential(u.email, currentPassword));
    }

    const { left, errors } = await createAccountPurge(c, u.uid, collections)();
    if (left.length) {
      if (errors.length) console.error('account purge', errors);
      // Plain words, because this reaches the user as a toast. It says what
      // state they are in rather than only that something went wrong: some of
      // their data really has gone, and the account really has not.
      throw new Error(
        'Your account was not deleted, because some of your data could not be removed ('
        + left.join(', ') + '). Anything already removed is gone. Try again.');
    }

    // 💷 And the between-sessions read snapshots, which are keyed by this uid
    // and would otherwise sit in localStorage describing an account that no
    // longer exists.
    const gone = localShardCache();
    for (const name of SHARDED_COLLECTIONS) gone.clear(u.uid, name);
    await c.auth.deleteUser(u);

    // Leave a working anonymous account behind so the app still runs.
    const res = await c.auth.signInAnonymously(c.authClient);
    user = res.user;
    notify();
    return describeUser(user);
  },
};

/* ------------------------------------------------------------------ *
 * Pure helpers — no SDK, unit-tested
 * ------------------------------------------------------------------ */

// A plain snapshot of the signed-in user for the UI. Never hand the raw
// Firebase user object to views; it carries tokens and refreshes underneath you.
export function describeUser(u) {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || null,
    isAnonymous: Boolean(u.isAnonymous),
    // An anonymous account exists only in this browser. Nothing recovers it.
    secured: Boolean(!u.isAnonymous && (u.email || (u.providerData || []).length)),
    providers: (u.providerData || []).map((p) => p && p.providerId).filter(Boolean),
  };
}

/**
 * ⚠️ IS `signInWithRedirect` EVEN CAPABLE OF FINISHING HERE?
 *
 * Firebase's own guidance (firebase.google.com/docs/auth/web/redirect-best-practices):
 * the redirect flow needs cross-origin access to storage on the authDomain, and
 * **Safari 16.1+, Firefox 109+ and Chrome M115+ all block that**. So whenever the
 * app is served from one origin and `authDomain` points at another —
 * `timothyhadfield.github.io` against `fitness-tracker-th.firebaseapp.com`, which
 * is exactly this project — redirect cannot complete on a modern browser.
 *
 * This is not browser sniffing, and deliberately so: the list of browsers that
 * partition third-party storage only grows, and a sniff written today is wrong
 * next year. The question asked here is the one that actually decides it — are
 * the two origins the same?
 *
 * Tim reported the symptom on an iPhone on 2026-08-21: the Google popup opens,
 * closes a second later, and nothing happens. What made it worse than a failed
 * sign-in was that the app's recovery — "Continue in this window instead" — is a
 * redirect, so the one escape hatch offered was the one route his browser
 * cannot finish either.
 */
export function redirectCanComplete(config) {
  if (typeof window === 'undefined') return false;
  const domain = config && config.authDomain;
  if (!domain) return false;
  // Same origin as the page means the storage the handler needs is first-party,
  // which is the one arrangement no browser partitions.
  return domain === window.location.hostname;
}

/**
 * ⚠️ NO LONGER "iOS home screen → redirect".
 *
 * It used to return true for an installed PWA, on the reasoning that a popup
 * inside one is usually blocked outright. ⚠️ **THAT REASONING IS FALSE, and a
 * real iPhone said so on 2026-08-22**: Google sign-in completes through the
 * POPUP in the installed home-screen app, which is precisely the case this
 * function used to route around. The conclusion was independently wrong too,
 * because with a cross-origin authDomain the redirect it sent people to
 * **cannot complete either** — so it was choosing between a route that works
 * and a route that is documented not to, and picking the second.
 *
 * So redirect is now only preferred where it can actually finish. Where it
 * cannot, the popup is attempted and its failure is EXPLAINED rather than
 * papered over with an escape hatch that leads nowhere.
 */
export function prefersRedirect(config) {
  if (typeof window === 'undefined') return false;
  if (!redirectCanComplete(config)) return false;
  if (window.navigator && window.navigator.standalone === true) return true;   // iOS home screen
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

// The browser refused to open the window. Worth retrying as a full-page
// redirect, which needs no popup.
const POPUP_FAILURES = [
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
];
export function isPopupFailure(err) {
  return Boolean(err && POPUP_FAILURES.includes(err.code));
}

// The USER shut the window. Not the same thing at all: bouncing them to
// Google's full-page redirect because they just cancelled is the opposite of
// what they asked for. auth/popup-closed-by-user used to sit in the list above
// and did exactly that.
export function isUserCancelled(err) {
  return Boolean(err && err.code === 'auth/popup-closed-by-user');
}

/**
 * What to do when a Google sign-in attempt fails. Pure, so the decision that
 * caused "Your browser blocked the sign-in window" is directly testable.
 *
 *   'cancelled'  — the user closed the window; do nothing
 *   'redirect'   — the browser refused a popup; go full-page instead
 *   'credential' — the Google account already exists in its own right, so sign
 *                  into it with the credential from the FAILED link
 *   'rethrow'    — anything else, which the UI reports
 *
 * The bug this replaces: on 'credential' the code opened a SECOND popup. By
 * then the user gesture that authorised the first one is spent, so the browser
 * blocks it — and because that throw happened inside the catch block, nothing
 * handled it. It surfaced as a blocked-popup error on what was really an
 * already-registered account.
 */
/**
 * The whole Google sign-in dance, with its SDK surface passed in rather than
 * reached for — so it can be exercised without a browser, a popup or a network.
 * The bug that prompted this only showed up on the third branch, which is
 * exactly the branch that is hardest to reach by hand.
 *
 * Returns { user, created } · { redirected: true } · { cancelled: true }, or throws.
 *
 * ⚠️ `created` SEPARATES "this account came into existence just now" FROM "this
 * account already existed and I signed into it", and the two branches that look
 * alike are the ones that matter: linking an anonymous account CREATES, and the
 * credential recovery below SIGNS IN. store.js decides whether to carry this
 * device's local data up on the strength of that word, so it is a fact about
 * the account rather than a convenience for the UI.
 */
export async function googleSignInFlow({
  auth, authClient, provider, currentUser, anon, preferRedirect,
}) {
  const goRedirect = async () => {
    if (anon) await auth.linkWithRedirect(currentUser, provider);
    else await auth.signInWithRedirect(authClient, provider);
    return { redirected: true };
  };

  // Redirect only where prefersRedirect() says it can actually finish. ⚠️ NOT
  // "installed app → redirect": a popup in an installed iOS app was measured
  // working on 2026-08-22, so the old rule was routing the one environment it
  // cared about onto the one route that cannot complete. Everywhere else the
  // popup goes first anyway — it keeps the app state alive — and falls back
  // only when the browser actually refuses to open it.
  if (preferRedirect) return goRedirect();

  try {
    if (anon) {
      // Linking an anonymous session IS creating the account: same uid, same
      // data, now reachable from another device.
      const res = await auth.linkWithPopup(currentUser, provider);
      return { user: res.user, created: true };
    }
    const res = await auth.signInWithPopup(authClient, provider);
    // A Google account nobody has used here before makes a new user. The SDK is
    // the only thing that knows; `?.` because this flow is also driven by tests
    // that hand it the two functions it actually calls and nothing else.
    const info = typeof auth.getAdditionalUserInfo === 'function'
      ? auth.getAdditionalUserInfo(res) : null;
    return { user: res.user, created: Boolean(info && info.isNewUser) };
  } catch (err) {
    switch (planAfterGoogleFailure(err, { anon })) {
      case 'cancelled':
        // They closed the window. Sending them to a full-page Google redirect
        // for that would be worse than doing nothing.
        return { cancelled: true };

      case 'redirect':
        return goRedirect();

      case 'credential': {
        // Linking fails when that Google account already exists in its own
        // right. Signing into it is correct — the anonymous data is what gets
        // left behind, and the UI warns before this point.
        //
        // NO SECOND POPUP. The gesture that authorised the first one is spent
        // by now, so the browser blocks a second window — and the user was
        // shown "your browser blocked the sign-in window" for an account that
        // had simply been registered already. Firebase hands back the
        // credential from the failed link, and using it needs no window at all.
        const cred = auth.GoogleAuthProvider.credentialFromError(err);
        if (cred) {
          const res = await auth.signInWithCredential(authClient, cred);
          // ⚠️ NOT `created`. This branch is reached precisely BECAUSE the
          // account already exists, and its own history is the thing being
          // signed into.
          return { user: res.user, created: false };
        }
        // No credential on the error. Redirect rather than reopening a popup,
        // because it is the one route a popup blocker cannot touch.
        return goRedirect();
      }

      default:
        throw err;
    }
  }
}

export function planAfterGoogleFailure(err, { anon } = {}) {
  if (isUserCancelled(err)) return 'cancelled';
  if (isPopupFailure(err)) return 'redirect';
  if (anon && isAlreadyLinked(err)) return 'credential';
  return 'rethrow';
}

export function isAlreadyLinked(err) {
  return Boolean(err && (
    err.code === 'auth/credential-already-in-use' ||
    err.code === 'auth/email-already-in-use' ||
    err.code === 'auth/account-exists-with-different-credential'
  ));
}

// Firebase error codes are not user-facing. Anything unmapped falls through to
// a generic line rather than leaking a raw code into the UI.
const AUTH_MESSAGES = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/missing-password': 'Enter a password.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/email-already-in-use': 'That email already has an account. Try signing in instead.',
  'auth/credential-already-in-use': 'That account is already in use. Sign in to it instead.',
  'auth/account-exists-with-different-credential': 'That email is registered with a different sign-in method.',
  'auth/user-not-found': 'No account with that email.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-login-credentials': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Your data is saved on this device and will sync later.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled in Firebase yet.',
  'auth/requires-recent-login': 'Sign in again before making this change.',
  'auth/unauthorized-domain': 'This site is not on the Firebase authorised-domains list.',
  'permission-denied': 'Your account is not allowed to do that.',
  unavailable: 'No connection. Changes are saved on this device and will sync later.',
};

export function authErrorMessage(err) {
  if (!err) return 'Something went wrong.';
  const code = err.code || '';
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  return err.message && !String(err.message).includes('auth/')
    ? err.message
    : 'Something went wrong. Try again.';
}

/* ------------------------------------------------------------------ *
 * SHARDING — the pure half of "one document per session"
 *
 * ⚠️ WHY THIS EXISTS AT ALL. Everything else in this app stores a whole
 * collection in ONE Firestore document, `{rows, updatedAt}`, which caps at
 * 1 MiB. `store.cloudUsage()` prices this account's own rows against that cap
 * and Settings warns from 80 %; the measured figure is ~2,000 bytes a session,
 * so the ceiling is about **520 sessions — two and a half years at four a
 * week**. Open work 0b(c).
 *
 * ⚠️ AND WHY NOW, WITH THE ACCOUNT NEARLY EMPTY, WHICH IS THE OPPOSITE OF
 * WHAT THE WARNING WAS FOR. The 80 % threshold was chosen to leave six months
 * to do this calmly. But the thing being migrated is somebody's training
 * history, the migration gets riskier the more of it there is, and doing it at
 * 80 % means doing it to 420 sessions under time pressure. Doing it at a few
 * dozen is the same code against a twentieth of the data with no deadline.
 * The runway was never the hard part.
 *
 * ⚠️ ONLY `sessions` AND `guestSessions` ARE SHARDED, and that is measured
 * rather than tidy: `entries` is 88 % of the collection, and those are the two
 * collections carrying entries. `bodyWeight` grows by one small row a day
 * (~45 years to the cap), `benchmarks` by a handful per test session. They
 * stay whole, and cloudUsage() keeps watching them so the warning still fires
 * if that judgement is wrong.
 *
 * ⚠️ THE LOCAL AND MEMORY BACKENDS ARE NOT SHARDED AND MUST NOT BE. There is
 * no per-key cap in localStorage worth designing around, splitting would slow
 * it down, and — the real reason — the store's read-whole/write-whole API is
 * unchanged by any of this, so every screen and every existing test goes on
 * working against the same shape. The split lives entirely inside the one
 * backend that has a 1 MiB problem.
 * ------------------------------------------------------------------ */

export const SHARDED_COLLECTIONS = ['sessions', 'guestSessions'];

/** Firestore's hard cap on operations in one `writeBatch`. Not a tuning knob. */
export const BATCH_LIMIT = 500;

/**
 * What has to change in the shard to make it hold `rows`.
 *
 * @param {Map<string,string>} prev  id → JSON of the row as last seen
 * @param {Array} rows               what the collection should now contain
 * @returns {{writes: Array, deletes: string[]}}
 *
 * ⚠️ THE COMPARISON IS ON SERIALISED CONTENT, not identity. The store does
 * read-modify-write and hands back the same row objects it was given, so an
 * identity check would call every row unchanged and persist nothing. JSON is
 * the cheap honest test: a row whose text is identical needs no write, and
 * skipping those is the entire point — saving one session should cost one
 * document write, not five hundred.
 *
 * ⚠️ A ROW WITH NO `id` IS DROPPED RATHER THAN GUESSED AT. Every writer in
 * store.js assigns one before saving; a row arriving without one has no
 * document name it could go in, and inventing one would make the next write
 * duplicate it.
 */
export function shardDiff(prev, rows) {
  const writes = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || row.id == null) continue;
    const id = String(row.id);
    seen.add(id);
    if (prev.get(id) !== JSON.stringify(row)) writes.push(row);
  }
  const deletes = [];
  for (const id of prev.keys()) if (!seen.has(id)) deletes.push(id);
  return { writes, deletes };
}

/** id → JSON, the shape shardDiff() compares against. */
export function shardSnapshot(rows) {
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && row.id != null) out.set(String(row.id), JSON.stringify(row));
  }
  return out;
}

/**
 * The rows a read should return, given what is in the shard and what is left
 * in the old whole-collection document.
 *
 * ⚠️ AN EMPTY LEGACY DOCUMENT IS THE MIGRATION FLAG, and it is the flag
 * because it needs no permission the rules do not already grant. `rows: []` is
 * a valid payload under the existing `validPayload()`; a `migratedAt` field
 * would have meant widening the rule that guards every collection in the app
 * in order to record something the emptiness already says.
 *
 * ⚠️ THE SHARD WINS A COLLISION, AND THE COST OF THAT IS NAMED. Non-empty
 * legacy rows after a migration mean a client that predates this code wrote
 * there — it would read the emptied document, see no history, and save what it
 * recorded. Adopting ids the shard has never heard of picks that work up on the
 * next read. Letting legacy win instead would also let a STALE cached copy of
 * an already-migrated session overwrite a newer edit, and silently reverting an
 * edit is worse than the thing this avoids: an edit made on an old client is
 * dropped. Both are bad; only one is invisible.
 */
export function mergeShardAndLegacy(shardRows, legacyRows) {
  const out = Array.isArray(shardRows) ? shardRows.slice() : [];
  const have = new Set(out.map((r) => (r && r.id != null ? String(r.id) : null)));
  for (const row of Array.isArray(legacyRows) ? legacyRows : []) {
    if (!row || row.id == null) continue;
    if (have.has(String(row.id))) continue;
    out.push(row);
  }
  return out;
}

/** Split a list of operations into batches Firestore will accept. */
export function inBatches(items, size = BATCH_LIMIT) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Merge local rows into cloud rows, keyed by id. The newer `updatedAt` wins;
// when only one side has a timestamp that side wins; otherwise the cloud does,
// because it is the copy other devices already agree on.
export function mergeRows(remoteRows, localRows) {
  const out = new Map();
  for (const r of Array.isArray(remoteRows) ? remoteRows : []) {
    if (r && r.id != null) out.set(r.id, r);
  }
  for (const l of Array.isArray(localRows) ? localRows : []) {
    if (!l || l.id == null) continue;
    const existing = out.get(l.id);
    if (!existing) { out.set(l.id, l); continue; }
    const a = Date.parse(existing.updatedAt || existing.createdAt || '');
    const b = Date.parse(l.updatedAt || l.createdAt || '');
    const aOk = Number.isFinite(a), bOk = Number.isFinite(b);
    if (bOk && (!aOk || b > a)) out.set(l.id, l);
  }
  return [...out.values()];
}
