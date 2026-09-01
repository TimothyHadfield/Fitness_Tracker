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
// seconds. If that ever becomes the constraint, the fix is an incremental
// revalidation (`where updatedAt > lastSeen`, plus a count to catch deletes),
// not a return to one big document.
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

export function createShardIO(c, uid) {
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

  async function readShard(collection) {
    const snap = await c.fs.getDocs(col(collection));
    const rows = [];
    snap.forEach((d) => {
      const data = d.data();
      // ⚠️ The document NAME is the row id, and it overrides whatever is in
      // the payload. They are written together and cannot disagree — but if
      // they ever did, the name is the one the delete path addresses, so
      // trusting the other one would leave a row that cannot be removed.
      if (data && data.row) rows.push({ ...data.row, id: d.id });
    });
    return rows;
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
      const rows = legacyRows.length
        ? await adopt(collection, legacyRows)
        : await readShard(collection);
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
  //   { status: 'signed-in', user } · { status: 'redirecting' } · { status: 'cancelled' }
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
    return { status: 'signed-in', user: describeUser(user) };
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

  // Wipe the data first, then the account. Doing it the other way round would
  // leave the documents orphaned with no signed-in user able to reach them —
  // the rules scope everything to a uid that would no longer exist.
  async deleteAccount(currentPassword) {
    const c = await init();
    const u = c.authClient.currentUser;
    if (!u) throw new Error('Not signed in.');

    if (currentPassword && u.email) {
      await c.auth.reauthenticateWithCredential(
        u, c.auth.EmailAuthProvider.credential(u.email, currentPassword));
    }

    for (const name of ['customExercises', 'workouts', 'sessions', 'benchmarks', 'settings']) {
      try { await this.write(name, []); } catch (err) { console.error('clearing ' + name, err); }
    }
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
 * Returns { user } · { redirected: true } · { cancelled: true }, or throws.
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
    const res = anon
      ? await auth.linkWithPopup(currentUser, provider)
      : await auth.signInWithPopup(authClient, provider);
    return { user: res.user };
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
          return { user: res.user };
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
