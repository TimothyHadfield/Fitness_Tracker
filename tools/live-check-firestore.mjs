// A COUNTING WRAPPER AROUND THE REAL FIRESTORE SDK — dev-only, for
// tools/live-check.mjs. Not part of the app and not precached.
//
// ⚠️ WHY IT EXISTS AT ALL, because a counter looks like padding until you need
// it: the read-pattern change (2026-09-08, Open work 26) is a claim about HOW
// MANY DOCUMENTS COME BACK. "It returned the right rows" is true of the
// expensive path as well as the cheap one, so a correctness check cannot tell
// them apart. `docsReturned` is the only thing that can, and against a real
// server it is the billed number itself.
//
// Explicit local exports shadow `export *` for the same name, so the app under
// test gets these wrappers and everything else untouched.
import * as FS from 'firebase/firestore';

export * from 'firebase/firestore';

export const counts = {
  getDoc: 0,
  getDocs: 0,
  docsReturned: 0,
  queries: 0,
  getCountFromServer: 0,
  setDoc: 0,
  deleteDoc: 0,
  batchCommits: 0,
  batchSets: 0,
  batchDeletes: 0,
};

export function resetCounts() {
  for (const k of Object.keys(counts)) counts[k] = 0;
}

export function getDoc(ref) {
  counts.getDoc++;
  return FS.getDoc(ref);
}

export async function getDocs(q) {
  counts.getDocs++;
  const snap = await FS.getDocs(q);
  counts.docsReturned += snap.size;
  return snap;
}

export function query(...args) {
  counts.queries++;
  return FS.query(...args);
}

export function getCountFromServer(q) {
  counts.getCountFromServer++;
  return FS.getCountFromServer(q);
}

export function setDoc(...args) {
  counts.setDoc++;
  return FS.setDoc(...args);
}

export function deleteDoc(...args) {
  counts.deleteDoc++;
  return FS.deleteDoc(...args);
}

export function writeBatch(db) {
  const b = FS.writeBatch(db);
  return {
    set(...a) { counts.batchSets++; b.set(...a); return this; },
    delete(...a) { counts.batchDeletes++; b.delete(...a); return this; },
    update(...a) { b.update(...a); return this; },
    commit() { counts.batchCommits++; return b.commit(); },
  };
}

/* ⚠️ DELIBERATE, AND THE ONE WAY THIS RUN DIFFERS FROM A PHONE. Node has no
 * IndexedDB, so the persistent cache cannot be built here. Throwing is what
 * makes js/firebase-backend.js take its OWN documented fallback
 * (`getFirestore`) — the same path a browser in private mode takes — instead of
 * failing in some way the app never sees.
 *
 * Nothing under test depends on it: the incremental sync's cache is
 * localStorage, and both the `where` query and the aggregation count are served
 * by the server whatever the local cache is. Stated rather than hidden, because
 * "the offline cache was not the one users get" is exactly the sort of
 * difference that would otherwise be discovered by somebody re-reading this in
 * six months. */
export function persistentLocalCache() {
  throw new Error('live-check: no IndexedDB in Node — taking the app\'s own fallback');
}
