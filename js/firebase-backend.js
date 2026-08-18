// Firestore backend + accounts.
//
// ⚠️ The network paths in here have NEVER been executed — creating a Firebase
// project needs a Google login only Tim has. The pure helpers at the bottom are
// unit-tested; everything that touches the SDK is reviewed code, not verified
// code. See docs/firebase-setup.md.
//
// Data shape in Firestore:
//   users/{uid}/collections/{collectionName}  →  { rows: [...], updatedAt }
//
// One document per collection keeps reads cheap and mirrors the local backend's
// read-whole / write-whole API exactly. Firestore caps a document at 1 MB;
// `sessions` is the only collection that grows forever (~300 bytes each, so
// roughly 3,000 workouts). When that day comes, split it to one doc per session.
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

    // A Google sign-in that went the redirect route lands back here. This must
    // run before the anonymous fallback below, or we would create a throwaway
    // anonymous account on top of a successful sign-in.
    try {
      await auth.getRedirectResult(authClient);
    } catch (err) {
      console.error('Google redirect sign-in failed', err);
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
    return data && Array.isArray(data.rows) ? data.rows : [];
  },

  async write(collection, rows) {
    const c = await init();
    await c.fs.setDoc(docRef(c, collection), {
      rows,
      updatedAt: c.fs.serverTimestamp(),
    });
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

  // Publish one tier's projection. The document is written WHOLE every time —
  // never merged — so a field that stops being shared actually disappears
  // rather than lingering from the previous publish.
  async publishTier(tier, doc) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.setDoc(c.fs.doc(c.db, 'users', user.uid, 'shared', tier), doc);
    return true;
  },

  async unpublishTier(tier) {
    const c = await init();
    if (!user) throw new Error('Not signed in.');
    await c.fs.deleteDoc(c.fs.doc(c.db, 'users', user.uid, 'shared', tier));
    return true;
  },

  // Somebody else's projection. Returns null when the rules refuse, which is
  // the normal answer while probing tiers — see PROBE_ORDER in social.js — and
  // must not be logged as an error or it fills the console on every visit.
  async readShared(ownerUid, tier) {
    const c = await init();
    try {
      const snap = await c.fs.getDoc(c.fs.doc(c.db, 'users', ownerUid, 'shared', tier));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      if (err && err.code === 'permission-denied') return null;
      throw err;
    }
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
      preferRedirect: forceRedirect || prefersRedirect(),
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

export function prefersRedirect() {
  if (typeof window === 'undefined') return false;
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

  // A popup inside an installed PWA is usually blocked outright, so go straight
  // to redirect there. Elsewhere try the popup first — it keeps the app state
  // alive — and fall back if the browser refuses.
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
