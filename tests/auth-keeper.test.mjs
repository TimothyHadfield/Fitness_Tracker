// A dropped sign-in is repaired, not reported — 2026-09-28.
//   node tests/auth-keeper.test.mjs
//
// The bug: Tim's brother saw "Something went wrong · Not signed in." on Record
// and Account, and "Could not load your profile" on Profile. Firebase dropped
// his user after start-up and nothing signed him back in, so every call threw.
//
// Never touches Firestore: the keeper takes its SDK surface as arguments.
import { readFileSync } from 'node:fs';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const FB = await import('../js/firebase-backend.js');

function fakeAuth({ current = null, delay = 5 } = {}) {
  let n = 0;
  const authClient = { currentUser: current };
  const auth = {
    calls: 0,
    async signInAnonymously(client) {
      auth.calls++;
      await new Promise((r) => setTimeout(r, delay));
      const u = { uid: 'anon-' + (++n), isAnonymous: true };
      client.currentUser = u;
      return { user: u };
    },
  };
  return { auth, authClient };
}

function keeper(sdk) {
  let user = null;
  let notified = 0;
  const ensure = FB.createUserKeeper({
    ...sdk,
    getUser: () => user,
    setUser: (u) => { user = u; },
    onSigned: () => { notified++; },
  });
  return { ensure, get user() { return user; }, set user(u) { user = u; }, get notified() { return notified; } };
}

ok(typeof FB.createUserKeeper === 'function', 'firebase-backend exports createUserKeeper');

{
  const sdk = fakeAuth();
  const k = keeper(sdk);
  const u = await k.ensure();
  ok(u && u.isAnonymous, 'nobody signed in → a guest account is taken');
  ok(k.user === u && k.notified === 1, 'the backend user is set and listeners are told');
}

{
  const sdk = fakeAuth();
  const k = keeper(sdk);
  const [a, b, c] = await Promise.all([k.ensure(), k.ensure(), k.ensure()]);
  ok(sdk.auth.calls === 1, 'three screens asking at once make ONE account, not three');
  ok(a === b && b === c, 'and all three get the same user');
}

{
  const sdk = fakeAuth();
  const k = keeper(sdk);
  await k.ensure();
  k.user = null;                        // Firebase drops the user later
  sdk.authClient.currentUser = null;
  const again = await k.ensure();
  ok(sdk.auth.calls === 2 && again.uid === 'anon-2', 'a drop after start-up takes a fresh guest account');
}

{
  const existing = { uid: 'real', isAnonymous: false };
  const sdk = fakeAuth({ current: existing });
  const k = keeper(sdk);
  const u = await k.ensure();
  ok(u === existing && sdk.auth.calls === 0, 'a user the SDK already holds is reused, never replaced');
}

{
  const sdk = fakeAuth();
  sdk.auth.signInAnonymously = async () => { sdk.auth.calls++; throw new Error('offline'); };
  const k = keeper(sdk);
  let threw = false;
  try { await k.ensure(); } catch (_) { threw = true; }
  sdk.auth.signInAnonymously = async (client) => { client.currentUser = { uid: 'late', isAnonymous: true }; return { user: client.currentUser }; };
  const u = await k.ensure();
  ok(threw && u.uid === 'late', 'a failed sign-in does not stick: the next ask tries again');
}

// Wiring, asserted on the source: the listener must repair a null user after
// start-up, and every data call waits on the keeper before its user check.
const src = readFileSync(new URL('../js/firebase-backend.js', import.meta.url), 'utf8');
ok(/if \(!u\) keepUser\(\)/.test(src), 'the auth listener re-signs a dropped user');
ok(/async function init\(\) \{\s*const c = await connect\(\);\s*if \(!user\) await keepUser\(\);/.test(src),
  'init() waits for a user before any call checks it');
ok(!/signInAnonymously\(/.test(src.replace(/export function createUserKeeper[\s\S]*?\r?\n\}\r?\n/, '')),
  'no anonymous sign-in happens outside the keeper');

// --- Sign-in review follow-ups (same day) ----------------------------------

// A blocked popup must not bounce to a redirect that cannot finish here.
{
  const err = Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' });
  let redirected = false;
  const sdk = {
    signInWithPopup: async () => { throw err; },
    signInWithRedirect: async () => { redirected = true; },
  };
  let thrown = null;
  try {
    await FB.googleSignInFlow({ auth: sdk, authClient: {}, provider: {}, anon: false,
      preferRedirect: false, canRedirect: false });
  } catch (e) { thrown = e; }
  ok(thrown === err && !redirected, 'popup blocked + redirect cannot finish → the error reaches the screen, no redirect');
  const out = await FB.googleSignInFlow({ auth: sdk, authClient: {}, provider: {}, anon: false, preferRedirect: false });
  ok(out.redirected && redirected, 'where a redirect can finish it is still used');
}

// A Google account's delete proves identity BEFORE anything is removed.
{
  const store = readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const body = store.slice(store.indexOf('async deleteAccount(currentPassword)'));
  const confirmAt = body.indexOf('confirmIdentity');
  const purgeAt = body.indexOf('removeDirectory');
  ok(confirmAt > 0 && confirmAt < purgeAt, 'deleteAccount confirms identity before removing anything');
  ok(/reauthenticateWithPopup\(u, new c\.auth\.GoogleAuthProvider\(\)\)/.test(src), 'a Google account re-confirms with a popup');
  ok(/guestRowCounts/.test(readFileSync(new URL('../js/views-account.js', import.meta.url), 'utf8')),
    'the sign-in warning counts the guest\'s cloud rows, not only device rows');
  ok(/if \(epoch !== cacheEpoch\) return rows;/.test(store), 'a read from before an account switch is never cached');
}

// A real account dropped by Firebase is remembered; our own sign-out is not.
{
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  ok(FB.droppedAccount() === null, 'no dropped account by default');
  ok(/if \(!u && prev && !prev\.isAnonymous && !leaving\(\)\) rememberDropped\(prev\.email\)/.test(src),
    'the listener remembers a real account dropped by Firebase (not by our sign-out)');
  mem.set('ftrack:v1:droppedAccount', JSON.stringify({ email: 'a@b.co' }));
  ok(FB.droppedAccount().email === 'a@b.co', 'droppedAccount() reads it back');
  FB.forgetDropped();
  ok(FB.droppedAccount() === null, 'forgetDropped() clears it');
}

console.log(fails ? `\n${fails} FAIL` : '\nall PASS');
process.exit(fails ? 1 : 0);
