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
// The sharded collections — one document per row. Open work 0b(c).
const shard = (db, uid, name, id) => doc(db, 'users', uid, name, id);
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
  await setDoc(shard(db, TIM, 'sessions', 's1'), { row: { id: 's1', weight: 185 }, updatedAt: new Date() });
  await setDoc(shard(db, TIM, 'guestSessions', 'g1'), { row: { id: 'g1', guestName: 'Alex' }, updatedAt: new Date() });
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

/* ⚠️ THE SHARDED COLLECTIONS ARE THE SAME PRIVATE DATA UNDER A NEW PATH SHAPE,
 * AND THIS BLOCK IS THE PROOF THAT THE MIGRATION DID NOT WIDEN ANYTHING.
 *
 * The 1 MiB per-document cap put a ceiling at ~520 sessions, so sessions and
 * guest sessions now live one document per row (Open work 0b(c)). One document
 * per row is exactly the shape that made reactions and handoffs safe to expose
 * — which makes it exactly the shape somebody could talk themselves into
 * exposing HERE, "just the one session, to the friend it was published to".
 * These denials are what that argument has to get past. Sharing a workout is
 * still a derived copy under shared/{tier}; it is not, and must never become,
 * a read permission on a real session document. */
await denied(getDoc(shard(asAlex, TIM, 'sessions', 's1')),
  '⚠️ a FULL-tier friend cannot read one sharded session either — sharding is not sharing');
await denied(getDoc(shard(asSam, TIM, 'sessions', 's1')), 'nor can a light-tier friend');
await denied(getDoc(shard(asStranger, TIM, 'sessions', 's1')), 'nor a stranger');
await denied(getDoc(shard(asNobody, TIM, 'sessions', 's1')), 'nor a signed-out caller');
await denied(getDocs(collection(asAlex, 'users', TIM, 'sessions')),
  '⚠️ and a friend cannot LIST them, which would be the whole history at once');
await denied(setDoc(shard(asAlex, TIM, 'sessions', 'forged'),
  { row: { id: 'forged' }, updatedAt: serverTimestamp() }),
  'a friend cannot write a session into somebody else\'s account');
await denied(deleteDoc(shard(asAlex, TIM, 'sessions', 's1')),
  '⚠️ and cannot DELETE one — the permission sharding had to add is owner-only');
await denied(getDoc(shard(asAlex, TIM, 'guestSessions', 'g1')),
  'guest sessions are private in exactly the same way');

await allowed(getDoc(shard(asTim, TIM, 'sessions', 's1')), 'the owner reads their own sharded session');
await allowed(getDocs(collection(asTim, 'users', TIM, 'sessions')), 'and lists them, which is how a read works now');
await allowed(setDoc(shard(asTim, TIM, 'sessions', 's2'),
  { row: { id: 's2', weight: 205 }, updatedAt: serverTimestamp() }), 'and writes one');
await allowed(deleteDoc(shard(asTim, TIM, 'sessions', 's2')),
  'and deletes one — a session removed is a document removed now, not a shorter list');

// The shape check. Same job validPayload() does for the whole-list documents:
// a modified client cannot use the project as free storage.
await denied(setDoc(shard(asTim, TIM, 'sessions', 'bad1'),
  { row: { id: 'bad1' }, updatedAt: serverTimestamp(), extra: 'nope' }),
  'an invented field is refused at the wire');
await denied(setDoc(shard(asTim, TIM, 'sessions', 'bad2'),
  { row: 'not a map', updatedAt: serverTimestamp() }),
  'and a row that is not a map is refused');
await denied(setDoc(shard(asTim, TIM, 'sessions', 'bad3'), { row: { id: 'bad3' } }),
  'and one with no updatedAt');
await denied(setDoc(shard(asTim, TIM, 'invented', 'x'),
  { row: {}, updatedAt: serverTimestamp() }),
  '⚠️ and a subcollection the app does not shard is not a free storage bucket');

/* ⚠️ BACKUPS — users/{uid}/backups/*, added 2026-08-28 after a migration
 * emptied the sessions document on Tim's real account. A backup of private
 * data is exactly as private as the data, and the snap-* ones must be
 * immutable or the wipe they exist to survive could overwrite them. */
const backup = (db, uid, id) => doc(db, 'users', uid, 'backups', id);
const backupDoc = { collection: 'sessions', part: 0, rows: [{ id: 's1' }],
  reason: 'rolling', at: '2026-08-28T00:00:00Z', updatedAt: serverTimestamp() };

await allowed(setDoc(backup(asTim, TIM, 'rolling-3-sessions'), backupDoc),
  'the owner writes a rolling backup');
await allowed(setDoc(backup(asTim, TIM, 'rolling-3-sessions'),
  { ...backupDoc, rows: [{ id: 's1' }, { id: 's2' }] }),
  'and overwrites it next week — the ring prunes itself by overwrite');
await allowed(setDoc(backup(asTim, TIM, 'snap-abc-sessions'), backupDoc),
  'and writes a pre-wipe snapshot');
await denied(setDoc(backup(asTim, TIM, 'snap-abc-sessions'),
  { ...backupDoc, rows: [] }),
  '⚠️ but even the OWNER cannot overwrite a snap — the wipe it protects against must not reach it');
await allowed(deleteDoc(backup(asTim, TIM, 'snap-abc-sessions')),
  'though they may delete one deliberately');

await denied(getDoc(backup(asAlex, TIM, 'rolling-3-sessions')),
  'a FULL-tier friend cannot read a backup — it is the private data again');
await denied(getDocs(collection(asAlex, 'users', TIM, 'backups')),
  'nor list them');
await denied(setDoc(backup(asAlex, TIM, 'rolling-9-x'), backupDoc),
  'nor write one into somebody else\'s account');
await denied(setDoc(backup(asTim, TIM, 'rolling-3-sessions'),
  { ...backupDoc, extra: 'nope' }),
  'and an invented field is refused at the wire, like everywhere else');

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

console.log('\n--- Reactions: the one narrow foreign write (0l) ---\n');

// The reactions path is the FIRST place a non-owner may create anything under
// another person's uid, so the denials here are the most important in this
// file: every one of them is a way the exception could have been wider than
// designed.

// Re-seed the projections: the revocation tests above rewrote shared/full
// with an empty viewers list, and a reactions test that ran against that
// state would be testing "a revoked viewer cannot react" three times while
// believing it tested the happy path.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(shared(db, TIM, 'full'), projection('full', [ALEX]));
  await setDoc(shared(db, TIM, 'light'), projection('light', [SAM]));
});

const reaction = (db, owner, id) => doc(db, 'users', owner, 'reactions', id);
const kudosDoc = (from, sessionId = 'sess-1') => ({
  kind: 'kudos', sessionId, from, fromName: 'Somebody', text: '', at: serverTimestamp(),
});
const commentDoc = (from, text = 'nice one', sessionId = 'sess-1') => ({
  kind: 'comment', sessionId, from, fromName: 'Somebody', text, at: serverTimestamp(),
});

// Viewers at ANY tier may react — seeing the card is what qualifies you.
await allowed(setDoc(reaction(asAlex, TIM, 'k_sess-1_' + ALEX), kudosDoc(ALEX)),
  'a full-tier viewer can give kudos');
await allowed(setDoc(reaction(asSam, TIM, 'k_sess-1_' + SAM), kudosDoc(SAM)),
  'a light-tier viewer can too — they see the card, so they can react to it');
await allowed(setDoc(reaction(asAlex, TIM, 'c_sess-1_' + ALEX + '_n1'), commentDoc(ALEX)),
  'a viewer can comment');

await denied(setDoc(reaction(asStranger, TIM, 'k_sess-1_' + STRANGER), kudosDoc(STRANGER)),
  'a stranger cannot react — no published tier lists them');
await denied(setDoc(reaction(asNobody, TIM, 'k_sess-1_anon'), kudosDoc('anon')),
  'a signed-out caller cannot react');
await denied(setDoc(reaction(asAlex, TIM, 'k_forged'), kudosDoc(SAM)),
  '⚠️ `from` must be the caller — a reaction cannot be forged in somebody else\'s name');
await denied(setDoc(reaction(asAlex, TIM, 'x_extra'), { ...kudosDoc(ALEX), extra: 1 }),
  'an invented field is refused — the shape is a whitelist');
await denied(setDoc(reaction(asAlex, TIM, 'x_kind'), { ...kudosDoc(ALEX), kind: 'sticker' }),
  'an invented kind is refused');
await denied(setDoc(reaction(asAlex, TIM, 'x_talky'), { ...kudosDoc(ALEX), text: 'hello' }),
  'a kudos carrying words is refused — that shape is a comment');
await denied(setDoc(reaction(asAlex, TIM, 'x_mute'), commentDoc(ALEX, '')),
  'a comment with no words is refused — that shape is a kudos');
await denied(setDoc(reaction(asAlex, TIM, 'x_long'), commentDoc(ALEX, 'x'.repeat(501))),
  'a 501-character comment is refused at the wire, not just in the client');
await denied(setDoc(reaction(asAlex, TIM, 'x_nosess'), { ...kudosDoc(ALEX), sessionId: '' }),
  'a reaction must name the session it is about');

// No update path AT ALL — editing is delete-and-repost.
await denied(updateDoc(reaction(asAlex, TIM, 'c_sess-1_' + ALEX + '_n1'), { text: 'edited' }),
  'the sender cannot edit a comment in place');
await denied(updateDoc(reaction(asTim, TIM, 'c_sess-1_' + ALEX + '_n1'), { text: 'edited' }),
  'and neither can the owner — there is no update path at all');

// Reading: owner and viewers, nobody else.
await allowed(getDoc(reaction(asTim, TIM, 'k_sess-1_' + ALEX)),
  'the owner reads what landed on their workouts');
await allowed(getDocs(collection(asSam, 'users', TIM, 'reactions')),
  'a viewer lists the reactions, so the feed can show counts');
await denied(getDocs(collection(asStranger, 'users', TIM, 'reactions')),
  'a stranger cannot read anybody\'s reactions');

// Deleting: the sender takes back their own; the owner moderates anything.
await denied(deleteDoc(reaction(asSam, TIM, 'k_sess-1_' + ALEX)),
  'one viewer cannot delete another\'s reaction');
await allowed(deleteDoc(reaction(asAlex, TIM, 'k_sess-1_' + ALEX)),
  'the sender can take their own kudos back');
await allowed(deleteDoc(reaction(asTim, TIM, 'c_sess-1_' + ALEX + '_n1')),
  'the owner can moderate a comment off their own workout');


console.log('\n--- Handoffs: a session recorded FOR somebody (Open work 0e) ---\n');

const handoff = (db, owner, id) => doc(db, 'users', owner, 'handoffs', id);
const handoffDoc = (from, over) => ({
  from,
  fromName: 'Alex',
  at: serverTimestamp(),
  session: {
    date: '2026-08-27',
    workoutName: 'Push',
    entries: [{ exerciseName: 'Bench Press', sets: [{ weight: 135, reps: 8 }] }],
  },
  ...over,
});

// ⚠️ THE DENIALS FIRST, and the load-bearing one is the stranger: this path
// lets one signed-in person write under ANOTHER person's uid, which is the
// thing the rest of this file exists to forbid. It is acceptable only because
// it is one document per offer, create-only, and the recipient's own training
// is never touched — so the test that matters is that an unconnected person
// cannot put anything in anybody's list at all.
await denied(setDoc(handoff(asStranger, TIM, 'h_x1'), handoffDoc(STRANGER)),
  'a stranger cannot offer a workout to somebody who has not published to them');
await denied(setDoc(handoff(asAlex, TIM, 'h_x2'), handoffDoc(TIM)),
  'the `from` field is proven, so an offer cannot be forged in somebody else\'s name');
await denied(setDoc(handoff(asAlex, TIM, 'h_x3'), { ...handoffDoc(ALEX), extra: 1 }),
  'an invented field is refused');
await denied(setDoc(handoff(asAlex, TIM, 'h_x4'), { ...handoffDoc(ALEX), session: 'not a map' }),
  'a session that is not a map is refused');
await denied(setDoc(handoff(asAlex, TIM, 'h_x5'),
  handoffDoc(ALEX, { session: { date: '2026-08-27', entries: [], sneaky: true } })),
  'a session carrying a key the app does not write is refused');
await denied(setDoc(handoff(asAlex, TIM, 'h_x6'),
  handoffDoc(ALEX, { session: { date: '2026-08-27', workoutName: 'X',
    entries: new Array(41).fill({ exerciseName: 'e', sets: [] }) } })),
  'a 41-exercise session is refused — an offer is one workout, not a payload');

// The happy path, and then the shape of the whole feature.
await allowed(setDoc(handoff(asAlex, TIM, 'h_s1'), handoffDoc(ALEX)),
  'a connected friend CAN offer Tim the session they recorded for him');
await allowed(setDoc(handoff(asSam, TIM, 'h_s2'), { ...handoffDoc(SAM), fromName: 'Sam' }),
  'and so can a light-tier friend — being able to see him is what qualifies you');

// ⚠️ NO UPDATE PATH. Same argument as reactions: every mutation a rule does
// not have is a mutation that cannot be got wrong.
await denied(updateDoc(handoff(asAlex, TIM, 'h_s1'), { fromName: 'Someone else' }),
  'the sender cannot edit an offer in place');
await denied(updateDoc(handoff(asTim, TIM, 'h_s1'), { fromName: 'Someone else' }),
  'and neither can the recipient — retract and resend instead');

// Reading is the recipient's alone. Unlike a reaction there is nothing here
// for a third party to see: an offer is addressed to one person.
await allowed(getDocs(collection(asTim, 'users', TIM, 'handoffs')),
  'the recipient lists what has been offered to them');
await denied(getDocs(collection(asAlex, 'users', TIM, 'handoffs')),
  '⚠️ even the SENDER cannot list Tim\'s offers — they would see what everyone else sent him');
await denied(getDocs(collection(asStranger, 'users', TIM, 'handoffs')),
  'and a stranger certainly cannot');

// Deleting: the recipient acts on it, the sender can take it back.
await denied(deleteDoc(handoff(asSam, TIM, 'h_s1')),
  'one friend cannot delete another friend\'s offer');
await allowed(deleteDoc(handoff(asAlex, TIM, 'h_s1')),
  'the sender can retract an offer they should not have sent');
await allowed(deleteDoc(handoff(asTim, TIM, 'h_s2')),
  'and the recipient can decline one');

console.log('\n--- Disconnects: "I have left, take me off your list" (Open work 0j) ---\n');

const disc = (db, owner, leaver) => doc(db, 'users', owner, 'disconnects', leaver);
const discDoc = (from) => ({ from, at: serverTimestamp() });

// ⚠️ THE DOCUMENT ID IS THE CALLER'S UID, AND THAT IS THE WHOLE ACCESS
// CONTROL. Without it, anybody connected could evict anybody else from
// somebody's friends list — which is a far worse power than the one this
// path exists to grant.
await denied(setDoc(disc(asAlex, TIM, SAM), discDoc(SAM)),
  '⚠️ Alex cannot announce SAM\'s departure — you may only ever leave for yourself');
await denied(setDoc(disc(asAlex, TIM, ALEX), discDoc(SAM)),
  'and the `from` field must match the caller too, so neither half can be forged alone');
await denied(setDoc(disc(asAlex, TIM, ALEX), { from: ALEX, at: serverTimestamp(), note: 'x' }),
  'an invented field is refused');

await allowed(setDoc(disc(asAlex, TIM, ALEX), discDoc(ALEX)),
  'Alex can tell Tim that Alex has gone');
await allowed(setDoc(disc(asAlex, TIM, ALEX), discDoc(ALEX)),
  'and doing it twice writes the same document — pressing Disconnect twice is harmless');

// ⚠️ A stranger CAN leave a note, and that is deliberate rather than an
// oversight: the note carries no information and grants nothing. Refusing it
// would mean checking the graph, which is owner-only — so the check would have
// to be a get() on every write, to prevent somebody announcing a departure
// from a relationship that does not exist. A no-op note is the cheaper
// outcome; the owner's client only ever removes somebody already in its graph.
await allowed(setDoc(disc(asStranger, TIM, STRANGER), discDoc(STRANGER)),
  'a stranger may leave a note, which does nothing — the client only removes people it has');

// Reading is the owner's alone: this list is who has walked away from them.
await allowed(getDocs(collection(asTim, 'users', TIM, 'disconnects')),
  'the owner reads the notes so their client can act on them');
await denied(getDocs(collection(asAlex, 'users', TIM, 'disconnects')),
  'nobody else can read who has disconnected from Tim');

await denied(deleteDoc(disc(asSam, TIM, ALEX)),
  'and one person cannot delete another\'s note');
await allowed(deleteDoc(disc(asAlex, TIM, ALEX)),
  'the leaver can withdraw their own note if they reconnect');

console.log('\n--- Nothing else in the database exists ---\n');

await denied(setDoc(doc(asTim, 'users', TIM, 'collections', 'invented'), { rows: [], updatedAt: serverTimestamp() }),
  'a collection not in knownCollection() is still refused');
await denied(setDoc(doc(asTim, 'anything', 'else'), { x: 1 }), 'an unlisted top-level path is refused');
await denied(getDoc(doc(asTim, 'users', ALEX)), 'the user document itself is not readable');

await env.cleanup();
console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
