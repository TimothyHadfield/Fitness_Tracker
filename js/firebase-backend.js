// Firestore backend.
//
// ⚠️ UNTESTED. Written against the Firebase v10 modular Web SDK but never run, because
// creating a Firebase project requires a Google login that only Tim has. Treat this as a
// well-formed starting point, not verified code. See docs/firebase-setup.md.
//
// Data shape in Firestore:
//   users/{uid}/collections/{collectionName}   →  { rows: [...] }
//
// One document per collection keeps reads cheap and mirrors the local backend's
// read-whole-collection / write-whole-collection API exactly. If a single user's history
// ever approaches Firestore's 1 MB document limit, split `sessions` into one doc per
// session — that is the only collection likely to grow that far.

import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let ready = null;

async function connect() {
  if (ready) return ready;

  ready = (async () => {
    const [{ initializeApp }, auth, firestore] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);

    const app = initializeApp(FIREBASE_CONFIG);

    // Offline persistence is essential here — gyms have bad signal, and D6 says
    // logging must never depend on a connection.
    const db = firestore.initializeFirestore(app, {
      localCache: firestore.persistentLocalCache({
        tabManager: firestore.persistentMultipleTabManager(),
      }),
    });

    const authClient = auth.getAuth(app);

    // Wait for the restored session, then fall back to an anonymous account so a
    // first-time visitor can start logging without signing up.
    const user = await new Promise((resolve, reject) => {
      const stop = auth.onAuthStateChanged(authClient, async (u) => {
        stop();
        if (u) return resolve(u);
        try {
          const cred = await auth.signInAnonymously(authClient);
          resolve(cred.user);
        } catch (err) {
          reject(err);
        }
      }, reject);
    });

    return { db, firestore, auth, authClient, uid: user.uid };
  })();

  return ready;
}

function docRef(ctx, collection) {
  return ctx.firestore.doc(ctx.db, 'users', ctx.uid, 'collections', collection);
}

export const FirebaseBackend = {
  async read(collection) {
    const ctx = await connect();
    const snap = await ctx.firestore.getDoc(docRef(ctx, collection));
    const data = snap.exists() ? snap.data() : null;
    return data && Array.isArray(data.rows) ? data.rows : [];
  },

  async write(collection, rows) {
    const ctx = await connect();
    await ctx.firestore.setDoc(docRef(ctx, collection), {
      rows,
      updatedAt: ctx.firestore.serverTimestamp(),
    });
    return true;
  },

  // Upgrade an anonymous account to a real one without losing existing data.
  async linkEmail(email, password) {
    const ctx = await connect();
    const cred = ctx.auth.EmailAuthProvider.credential(email, password);
    await ctx.auth.linkWithCredential(ctx.authClient.currentUser, cred);
  },

  async signIn(email, password) {
    const ctx = await connect();
    await ctx.auth.signInWithEmailAndPassword(ctx.authClient, email, password);
    ready = null; // force reconnect so the new uid is picked up
  },

  async signOut() {
    const ctx = await connect();
    await ctx.auth.signOut(ctx.authClient);
    ready = null;
  },

  async currentUser() {
    const ctx = await connect();
    return ctx.authClient.currentUser;
  },
};
