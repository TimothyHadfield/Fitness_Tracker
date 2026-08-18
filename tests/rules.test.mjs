// Firestore security rules — the only tests in this project that run as
// somebody who is not you.
//
//   firebase emulators:exec --only firestore "node tests/rules.test.mjs"
//
// Needs Java and, once:  npm i --no-save @firebase/rules-unit-testing
//
// ── WHY THIS FILE IS DIFFERENT FROM EVERY OTHER TEST HERE ────────────────────
//
// Everything else in tests/ asserts a number. These assert a PERMISSION, and a
// permission can only be tested by attempting the thing as a different user and
// being refused. Nothing available before this — jsdom, headless Chrome, the
// live-project checks in docs/firebase-setup.md — can do that: they all run as
// one signed-in person, so the interesting half of the rules was untestable.
//
// ⚠️ A rules test that only asserts the ALLOWED cases is worth almost nothing.
// A rule that permits everything passes every positive test in this file. The
// denials are the point, so they come first and there are more of them.
//
// docs/social-plan.md §7.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp,
} from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const denied = async (p, msg) => {
  try { await assertFails(p); ok(true, 'DENIED  ' + msg); }
  catch (_) { ok(false, 'ALLOWED ' + msg + '  ← should have been refused'); }
};
const allowed = async (p, msg) => {
  try { await assertSucceeds(p); ok(true, 'allowed ' + msg); }
  catch (err) { ok(false, 'denied  ' + msg + '  ← ' + (err && err.message)); }
};

const env = await initializeTestEnvironment({
  projectId: 'fitness-tracker-rules-test',
  firestore: {
    rules: readFileSync(join(here, '..', 'firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

await env.clearFirestore();

const TIM = 'tim-uid';
const ALEX = 'alex-uid';       // connected, full
const SAM = 'sam-uid';         // connected, light
const STRANGER = 'stranger-uid';

const asTim = env.authenticatedContext(TIM).firestore();
const asAlex = env.authenticatedContext(ALEX).firestore();
const asSam = env.authenticatedContext(SAM).firestore();
const asStranger = env.authenticatedContext(STRANGER).firestore();
const asNobody = env.unauthenticatedContext().firestore();

const shared = (db, uid, tier) => doc(db, 'users', uid, 'shared', tier);
const priv = (db, uid, name) => doc(db, 'users', uid, 'collections', name);
const graph = (db, uid) => doc(db, 'users', uid, 'social', 'graph');
const invite = (db, uid, token) => doc(db, 'users', uid, 'invites', token);

const projection = (tier, viewers, extra = {}) => ({
  tier,
  viewers,
  profile: { name: 'Tim' },
  publishedAt: '2026-08-17T12:00:00.000Z',
  activity: [{ id: 's1', date: '2026-08-15', name: 'Push' }],
  ...extra,
});

// Seed with rules OFF, so the fixtures cannot themselves be a test of the rules.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(priv(db, TIM, 'sessions'), { rows: [{ id: 's1', weight: 185 }], updatedAt: new Date() });
  await setDoc(shared(db, TIM, 'full'), projection('full', [ALEX]));
  await setDoc(shared(db, TIM, 'light'), projection('light', [SAM]));
  await setDoc(graph(db, TIM), { connections: [{ uid: ALEX, tier: 'full' }] });
  await setDoc(invite(db, TIM, 'open-token'), {
    token: 'open-token',
    createdAt: '2026-08-17T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  await setDoc(invite(db, TIM, 'expired-token'), {
    token: 'expired-token',
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: new Date(Date.now() - 86400000),
  });
  await setDoc(invite(db, TIM, 'claimed-token'), {
    token: 'claimed-token',
    createdAt: '2026-08-17T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 7 * 86400000),
    claimedBy: STRANGER,
  });
});

console.log('\n--- The private data stays private. Asserted directly, not inherited. ---\n');

// ⚠️ This block is the regression test for the whole feature. Social added new
// paths under users/{uid}/ and the one unacceptable outcome is that it widened
// the old ones. Never delete these because "we didn't touch that rule".
await denied(getDoc(priv(asAlex, TIM, 'sessions')),
  'a FULL-tier friend still cannot read the private sessions document');
await denied(getDoc(priv(asStranger, TIM, 'sessions')), 'a stranger cannot read private sessions');
await denied(getDoc(priv(asNobody, TIM, 'sessions')), 'a signed-out caller cannot read private sessions');
await denied(setDoc(priv(asAlex, TIM, 'sessions'), { rows: [], updatedAt: serverTimestamp() }),
  'a friend cannot write into somebody else\'s private collection');
await allowed(getDoc(priv(asTim, TIM, 'sessions')), 'the owner reads their own private data');

console.log('\n--- Projections: only the listed viewers ---\n');

await allowed(getDoc(shared(asAlex, TIM, 'full')), 'a viewer listed on full reads the full projection');
await allowed(getDoc(shared(asSam, TIM, 'light')), 'a viewer listed on light reads the light projection');
await allowed(getDoc(shared(asTim, TIM, 'full')),
  'the owner reads their own projection — "here is exactly what Alex can see"');

await denied(getDoc(shared(asSam, TIM, 'full')),
  'a LIGHT viewer cannot read the full projection');
await denied(getDoc(shared(asStranger, TIM, 'full')), 'a stranger cannot read a projection');
await denied(getDoc(shared(asStranger, TIM, 'light')), 'nor the lightest one');
await denied(getDoc(shared(asNobody, TIM, 'light')), 'a signed-out caller cannot read a projection');

console.log('\n--- A viewer is a reader and nothing more ---\n');

await denied(setDoc(shared(asAlex, TIM, 'full'), projection('full', [ALEX, STRANGER])),
  'a viewer cannot write to a projection they can read');
await denied(updateDoc(shared(asAlex, TIM, 'full'), { viewers: [ALEX, STRANGER] }),
  'a viewer cannot add somebody to the audience');
await denied(setDoc(shared(asStranger, TIM, 'full'), projection('full', [STRANGER])),
  'a stranger cannot publish a projection into somebody else\'s account');
await denied(updateDoc(shared(asStranger, TIM, 'light'), { viewers: [SAM, STRANGER] }),
  'A STRANGER CANNOT ADD THEMSELVES TO A VIEWERS LIST');
await denied(deleteDoc(shared(asAlex, TIM, 'full')), 'a viewer cannot delete a projection');
await denied(getDocs(collection(asAlex, 'users', TIM, 'shared')),
  'a viewer cannot LIST the tiers — that would name the ones they were not granted');
await allowed(getDocs(collection(asTim, 'users', TIM, 'shared')), 'the owner can list their own tiers');

console.log('\n--- Publishing, and its shape ---\n');

await allowed(setDoc(shared(asTim, TIM, 'mid'), projection('mid', [SAM])), 'the owner publishes a tier');
await denied(setDoc(shared(asTim, TIM, 'everything'), projection('everything', [SAM])),
  'a tier that is not one of the three cannot be published');
await denied(setDoc(shared(asTim, TIM, 'full'), { ...projection('full', [ALEX]), secret: 'x' }),
  'an unexpected field is refused — the document shape is pinned');
await denied(setDoc(shared(asTim, TIM, 'full'), projection('full', 'alex')),
  'viewers must be a list, not a string');
await denied(setDoc(shared(asTim, TIM, 'full'),
  projection('full', Array.from({ length: 501 }, (_, i) => `u${i}`))),
  'more than 500 viewers is refused before the document can approach 1 MB');
await denied(setDoc(shared(asTim, TIM, 'full'),
  { ...projection('full', [ALEX]), activity: Array.from({ length: 61 }, () => ({ date: '2026-08-01' })) }),
  'more than 60 activity entries is refused');

console.log('\n--- Revocation ---\n');

await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(shared(ctx.firestore(), TIM, 'full'), projection('full', []));
});
await denied(getDoc(shared(asAlex, TIM, 'full')),
  'removing somebody from viewers makes the document unreadable to them immediately');
await allowed(deleteDoc(shared(asTim, TIM, 'mid')), 'the owner can delete a projection outright');

console.log('\n--- The connection graph is owner-only in both directions ---\n');

await denied(getDoc(graph(asAlex, TIM)),
  'a full-tier friend cannot read the graph — it names everyone else and their tier');
await denied(getDoc(graph(asStranger, TIM)), 'nor can a stranger');
await denied(setDoc(graph(asAlex, TIM), { connections: [{ uid: ALEX, tier: 'full' }] }),
  'and nobody can write themselves into it');
await allowed(getDoc(graph(asTim, TIM)), 'the owner reads their own graph');

console.log('\n--- Invites: get yes, list no ---\n');

await allowed(getDoc(invite(asStranger, TIM, 'open-token')),
  'anyone signed in can fetch an invite they were GIVEN — they must, to redeem it');
await denied(getDocs(collection(asStranger, 'users', TIM, 'invites')),
  'BUT NOBODY CAN LIST THEM — a leaked link costs one invite, never the whole set');
await denied(getDocs(collection(asNobody, 'users', TIM, 'invites')), 'signed out, likewise');
await allowed(getDocs(collection(asTim, 'users', TIM, 'invites')), 'the owner lists their own invites');
await denied(getDoc(invite(asNobody, TIM, 'open-token')), 'a signed-out caller cannot fetch an invite');

await allowed(updateDoc(invite(asStranger, TIM, 'open-token'),
  { claimedBy: STRANGER, claimedName: 'Sam', claimedAt: '2026-08-17T12:00:00.000Z' }),
  'the person given a link can claim it');
await denied(updateDoc(invite(asStranger, TIM, 'claimed-token'), { claimedBy: STRANGER }),
  'an already-claimed invite cannot be claimed again');
await denied(updateDoc(invite(asStranger, TIM, 'expired-token'), { claimedBy: STRANGER }),
  'an expired invite cannot be claimed');
await denied(setDoc(invite(asStranger, STRANGER, 'forged'), {
  token: 'forged', createdAt: '2026-08-17T00:00:00.000Z', expiresAt: new Date(), claimedBy: TIM,
}), 'an invite cannot be created pre-claimed by somebody else');
await denied(deleteDoc(invite(asStranger, TIM, 'open-token')), 'only the owner can revoke an invite');

// Seed a fresh one, because the open token above is now claimed.
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(invite(ctx.firestore(), TIM, 'second-token'), {
    token: 'second-token',
    createdAt: '2026-08-17T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
});
await denied(updateDoc(invite(asStranger, TIM, 'second-token'),
  { claimedBy: STRANGER, expiresAt: new Date(Date.now() + 900 * 86400000) }),
  'a claimer cannot extend the expiry on the way past');
await denied(updateDoc(invite(asStranger, TIM, 'second-token'), { claimedBy: ALEX }),
  'and cannot claim an invite on somebody else\'s behalf');

console.log('\n--- Nothing else in the database exists ---\n');

await denied(setDoc(doc(asTim, 'users', TIM, 'collections', 'invented'), { rows: [], updatedAt: serverTimestamp() }),
  'a collection not in knownCollection() is still refused');
await denied(setDoc(doc(asTim, 'anything', 'else'), { x: 1 }), 'an unlisted top-level path is refused');
await denied(getDoc(doc(asTim, 'users', ALEX)), 'the user document itself is not readable');

await env.cleanup();
console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
