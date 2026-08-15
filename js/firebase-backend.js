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

  async signInGoogle() {
    const c = await init();
    const provider = new c.auth.GoogleAuthProvider();
    const anon = user && user.isAnonymous;

    // A popup inside an installed PWA is usually blocked outright, so go
    // straight to redirect there. Elsewhere try the popup first — it keeps the
    // app state alive — and fall back to redirect if the browser refuses it.
    if (prefersRedirect()) {
      if (anon) await c.auth.linkWithRedirect(user, provider);
      else await c.auth.signInWithRedirect(c.authClient, provider);
      return null; // page navigates away; init() picks the result up on return
    }

    try {
      const res = anon
        ? await c.auth.linkWithPopup(user, provider)
        : await c.auth.signInWithPopup(c.authClient, provider);
      user = res.user;
      notify();
      return describeUser(user);
    } catch (err) {
      if (isPopupFailure(err)) {
        if (anon) await c.auth.linkWithRedirect(user, provider);
        else await c.auth.signInWithRedirect(c.authClient, provider);
        return null;
      }
      // Linking fails if that Google account already has its own data. Signing
      // in plainly is the right move — the anonymous data is what gets left
      // behind, and the UI warns before this point.
      if (anon && isAlreadyLinked(err)) {
        const res = await c.auth.signInWithPopup(c.authClient, provider);
        user = res.user;
        notify();
        return describeUser(user);
      }
      throw err;
    }
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

const POPUP_FAILURES = [
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
];
export function isPopupFailure(err) {
  return Boolean(err && POPUP_FAILURES.includes(err.code));
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
