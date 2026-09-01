// Headless tests for the social projection builder. No DOM, no network, no
// emulator, no dependencies.
//   node tests/social.test.mjs
//
// This file asserts what a person SHARES. The companion file, tests/rules.test.mjs,
// asserts who may READ it — that one needs the Firestore emulator, because the
// only way to test a permission is to be a different user.
//
// ⚠️ The important assertions here are ABSENCE assertions, and they are written
// by walking the finished document rather than by naming the fields that ought
// to be missing. A test that lists what should not be there passes happily the
// day somebody adds a field and forgets about it, which is exactly how a leak
// of this kind happens.

const {
  FRIENDS, PUBLIC, AUDIENCES, PROBE_ORDER,
  PRIVATE_ACCOUNT, PUBLIC_ACCOUNT, VISIBILITY_LABEL, VISIBILITY_DETAIL,
  normalizeVisibility, isPublicAccount, isAudience,
  normalizeGraph, isConnected, allViewers,
  projectSession, projectStrength, buildProjection, assertAudienceClean, leaves,
  MAX_VIEWERS, MAX_ACTIVITY, MAX_AVATAR_CHARS, MAX_SHARED_CONTRIBUTORS,
  newInviteToken, inviteExpiry, inviteState, INVITE_TTL_DAYS,
} = await import('../js/social.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const throws = (fn, msg) => {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  ok(threw, msg);
};

/* ------------------------------------------------------------------ *
 * Fixtures — deliberately the nastiest shapes the app can produce
 * ------------------------------------------------------------------ */

// A session with a superset, a drop set carrying `minis`, and a myo-rep still
// carrying the LEGACY `drops` key. Nested mini-sets are where a naive builder
// leaves a number behind, so every leak test runs against this.
const SESSION = {
  id: 's-1',
  workoutId: 'w-1',
  workoutName: 'Push',
  date: '2026-08-15',
  // The four instants a real row carries (views-session.js, demo.js). Only
  // `startedAt` is ever published, and only at mid — the other three are here
  // so the "whitelist, not a delete list" assertion below has something to
  // prove. Deliberately DIFFERENT values, so a builder copying the wrong one
  // shows up as a wrong number rather than a passing test.
  startedOn: '2026-08-15',
  startedAt: '2026-08-15T09:00:00.000Z',
  finishedAt: '2026-08-15T10:14:00.000Z',
  createdAt: '2026-08-15T10:14:02.000Z',
  isBenchmark: false,
  entries: [
    {
      exerciseId: 'ex-bench', exerciseName: 'Barbell Bench Press', group: 'g1',
      sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }],
    },
    {
      exerciseId: 'ex-row', exerciseName: 'Barbell Row', group: 'g1',
      sets: [{ weight: 155, reps: 8 }],
    },
    {
      exerciseId: 'ex-fly', exerciseName: 'Cable Fly', setType: 'drop',
      sets: [{ weight: 40, reps: 12, minis: [{ weight: 30, reps: 8 }, { weight: 20, reps: 6 }] }],
    },
    {
      exerciseId: 'ex-lat', exerciseName: 'Lateral Raise', setType: 'myo',
      // The legacy key, written during the hours when drop sets were the only
      // nesting type. It must still publish, and must publish as `minis`.
      sets: [{ weight: 20, reps: 15, drops: [{ weight: 20, reps: 5 }] }],
    },
  ],
};

// ⚠️ s-2 and s-3 have NO `startedAt`, and that is the fixture doing a job
// rather than being lazy: `startedAt` was added to the session row part-way
// through the project, so every workout Tim logged before it exists without
// one, and a feed that renders "Invalid Date" over half of somebody's history
// is worse than a feed with no times in it. The mixed list is what a real
// account looks like.
const SESSIONS = [
  SESSION,
  { id: 's-2', workoutName: 'Legs', date: '2026-08-17', entries: [
    { exerciseId: 'ex-squat', exerciseName: 'Back Squat', sets: [{ weight: 275, reps: 3 }] },
  ] },
  { id: 's-3', workoutName: 'Pull', date: '2026-08-13', entries: [] },
];

const BENCHMARKS = [
  { id: 'b-1', date: '2026-08-10', exerciseId: 'ex-bench', exerciseName: 'Barbell Bench Press',
    values: { weight: 205, reps: 3 } },
];
/* The muscle map as buildStrengthShare() produces it — the combination-keyed
 * grid, and the per-muscle facts that do not depend on a comparison group. */
const STRENGTH = {
  muscles: [{
    muscle: 'Chest', lift: 'Barbell Bench Press', estimate: 233.4, confidence: 0.71,
    band: 'Good', basis: 'direct', contributorCount: 9, exerciseCount: 3,
    contributors: [
      { exerciseName: 'Barbell Bench Press', weight: 205, reps: 3, date: '2026-08-10', loadType: 'total', source: 'benchmark' },
      { exerciseName: 'Incline Dumbbell Bench Press', weight: 70, reps: 8, date: '2026-08-06', loadType: 'per_side', source: 'workout' },
      { exerciseName: 'Cable Fly', weight: 40, reps: 12, date: '2026-08-15', loadType: 'per_side', source: 'workout' },
      { exerciseName: 'Push-Up', weight: 0, reps: 30, date: '2026-08-02', loadType: 'total', source: 'workout' },
    ],
    hint: 'Benchmark heavier for a firmer placing.', confident: false,
  }],
  grid: {
    'lifters|male|own|own': { Chest: [62, 24.5] },
    'everyone|all|any|any': { Chest: [88.1, 61] },
  },
  defaultCompare: 'lifters|male|own|own',
};
const BODY_WEIGHTS = [{ id: 'bw-1', date: '2026-08-01', weight: 178 }];

const base = (audience, extra = {}) => buildProjection({
  audience,
  viewers: ['alex'],
  profile: { name: 'Tim' },
  sessions: SESSIONS,
  benchmarks: BENCHMARKS,
  strength: STRENGTH,
  bodyWeights: BODY_WEIGHTS,
  publishedAt: '2026-08-17T12:00:00.000Z',
  ...extra,
});

/* ------------------------------------------------------------------ *
 * Private or public — 2026-09-03, replacing the three tiers
 * ------------------------------------------------------------------ */

ok(AUDIENCES.join(',') === 'friends,public', 'two audiences: friends, and everybody signed in');
ok(PROBE_ORDER.join(',') === 'friends,public',
   '⚠️ and a reader tries FRIENDS first — a friend of a public account must not be silently '
   + 'downgraded to the stranger\'s view, which is the one with no body weight in it');
/* 🚨 THE DEFAULT IS PUBLIC, AND THIS ASSERTION WAS THE OPPOSITE THIS MORNING.
 *
 * Tim, hours after the setting shipped private-by-default: *"I would like the
 * default to be public… for now it should definently be public."*
 *
 * ⚠️ IT REVERSES THE RULE THE REST OF THIS FILE IS BUILT ON — everywhere else an
 * unrecognised value degrades to the NARROWEST reading. Here, absent means the
 * widest. That is a product decision, not an oversight, and this test says so in
 * as many words because the next person to read `normalizeVisibility` will be
 * tempted to "fix" it back. */
ok(normalizeVisibility(undefined) === PUBLIC_ACCOUNT
   && normalizeVisibility('sneaky') === PUBLIC_ACCOUNT
   && normalizeVisibility('Private') === PUBLIC_ACCOUNT,
   '🚨 an account that has never chosen is PUBLIC — Tim\'s call, 2026-09-03');
ok(normalizeVisibility(PRIVATE_ACCOUNT) === PRIVATE_ACCOUNT && !isPublicAccount(PRIVATE_ACCOUNT)
   && isPublicAccount(PUBLIC_ACCOUNT),
   '⚠️ and ONLY the exact string "private" turns it off — so the choice, once made, is honoured '
   + 'exactly, and the default above is not simply swallowing everything');
ok(!isAudience('full') && !isAudience('friends ') && isAudience(FRIENDS) && isAudience(PUBLIC),
   'a document id that is not an audience is not one — the old tier names included');
ok([PRIVATE_ACCOUNT, PUBLIC_ACCOUNT].every((v) =>
     VISIBILITY_LABEL[v] && VISIBILITY_DETAIL[v] && VISIBILITY_DETAIL[v].length > 40),
   'each choice has a label and a sentence saying what it actually means (D8)');
ok(/friends/i.test(VISIBILITY_DETAIL[PRIVATE_ACCOUNT])
   && /body weight/i.test(VISIBILITY_DETAIL[PUBLIC_ACCOUNT]),
   '⚠️ and the public sentence names the exception rather than leaving it to be discovered');

/* ------------------------------------------------------------------ *
 * The graph
 * ------------------------------------------------------------------ */

const GRAPH = { connections: [
  { uid: 'alex', name: 'Alex', since: '2026-08-01' },
  { uid: 'sam', name: 'Sam' },
  { uid: 'jo', name: 'Jo' },
] };

ok(isConnected(GRAPH, 'alex') && !isConnected(GRAPH, 'stranger') && !isConnected(null, 'alex'),
   'a connection is a connection; nobody else is');
ok(allViewers(GRAPH).join() === 'alex,sam,jo',
   'every accepted friend reads the friends document — there is no longer a tier to sort them into');
ok(normalizeGraph({ connections: [{ uid: 'a', tier: 'full' }] }).connections[0].tier === undefined,
   '⚠️ a stored `tier` from before 2026-09-03 is DROPPED rather than carried — a key that no longer '
   + 'decides anything is worse than an absent one, because the next reader believes it');
ok(normalizeGraph({ connections: [{ uid: 'a' }, { uid: 'a' }] }).connections.length === 1,
   'a duplicated uid appears once');
ok(normalizeGraph({ connections: [{ name: 'No uid' }] }).connections.length === 0,
   'a connection with no uid is dropped rather than published to nobody');

/* ------------------------------------------------------------------ *
 * What a friend gets — everything
 * ------------------------------------------------------------------ */

const mid = base(FRIENDS);
const midSession = mid.activity.find((a) => a.name === 'Push');
ok(mid.activity.length === 3, 'every session in the window is published');
ok(mid.activity[0].date === '2026-08-17' && mid.activity[2].date === '2026-08-13',
   'activity is newest first');
ok(mid.audience === FRIENDS && mid.isPublic === false,
   'the friends document says which it is, and says it is not public');
ok(midSession.entries.length === 4, 'every exercise is published');
ok(midSession.entries[0].sets[0].weight === 185, 'with its weights');
ok(midSession.entries[0].group === 'g1' && midSession.entries[1].group === 'g1',
   'the superset survives — both halves keep the same group');
ok(midSession.entries[2].setType === 'drop', 'the drop set is still a drop set');
ok(midSession.entries[2].sets[0].minis.length === 2, 'and its two drops came with it');
ok(midSession.entries[3].sets[0].minis.length === 1,
   'a myo-rep stored under the LEGACY `drops` key still publishes its mini-sets');
ok(midSession.entries[3].sets[0].drops === undefined,
   'and publishes them as `minis`, so a reader has one shape to render, not two');
// Data minimisation: the private row has fields the projection has no business
// carrying, and a whitelist is what keeps them out. ⚠️ `startedAt` used to be
// the example here and now IS published at mid, so the example moved to the
// three instants beside it rather than being deleted — the invariant is the
// point, not the field that happened to demonstrate it.
ok(midSession.workoutId === undefined && midSession.isBenchmark === undefined
   && midSession.startedOn === undefined && midSession.finishedAt === undefined
   && midSession.createdAt === undefined,
   'internal session fields are not published — the builder is a whitelist, not a delete list');
ok(JSON.stringify(mid).indexOf('10:14') === -1,
   'and in particular the FINISH time is not shared: publishing both hands over how long '
   + 'somebody was out of the house, which is a different fact from when they started');

/* ------------------------------------------------------------------ *
 * The start time — what the feed puts at the top of a card
 * ------------------------------------------------------------------ */

ok(midSession.startedAt === '2026-08-15T09:00:00.000Z',
   'the session says when it started, so a feed card can say a time and not just a day');
ok(Number.isFinite(Date.parse(midSession.startedAt)),
   'and publishes it as an instant a Date can be built from — the view formats, it does not repair');

const legs = mid.activity.find((a) => a.name === 'Legs');
ok(legs.startedAt === undefined,
   'a session recorded before start times existed publishes NO time rather than a made-up one');
ok(!Object.prototype.hasOwnProperty.call(legs, 'startedAt'),
   'the key is absent, not present-and-null — one case for the view to handle, not two');
ok(JSON.stringify(mid).indexOf('Invalid Date') === -1 && JSON.stringify(mid).indexOf('NaN') === -1,
   'and nothing anywhere in the document reads "Invalid Date"');

// The shapes a broken or foreign instant really arrives in. Every one of these
// must vanish rather than publish something a card would render as nonsense.
for (const [bad, what] of [
  [undefined, 'a session with no startedAt at all'],
  [null, 'a null startedAt'],
  ['', 'an empty string'],
  ['not a date', 'an unparseable string'],
  [{}, 'an object with nothing readable in it'],
  [1e20, 'a number outside the range a Date can hold'],
]) {
  const p = projectSession({ date: '2026-08-01', workoutName: 'Push', startedAt: bad });
  ok(p.startedAt === undefined, `${what} publishes no time — never "Invalid Date", never a guess`);
}

// ⚠️ Vacuity guard for the six above: they are all absences, and a builder that
// never published a time would pass every one of them. This is the same call
// with a GOOD instant, and it must produce one.
ok(projectSession({ date: '2026-08-01', startedAt: '2026-08-01T18:40:00.000Z' }).startedAt
     === '2026-08-01T18:40:00.000Z',
   'the same call with a real instant DOES publish it — so "absent" above is a result, not a hole');

// store.js writes instants through the SDK, which reads them back as Timestamp
// objects. That exact shape is the one bug this module has ever shipped — see
// instantMillis() and the invite section at the foot of this file — so the time
// goes through the same reader and comes out canonical whatever went in.
ok(projectSession({ date: '2026-08-01', startedAt: new Date('2026-08-01T18:40:00.000Z') })
     .startedAt === '2026-08-01T18:40:00.000Z',
   'a Date is normalised to one canonical ISO instant, so a reader has one shape to parse');
ok(projectSession({ date: '2026-08-01', startedAt: { seconds: 1785508800 } }).startedAt
     === new Date(1785508800000).toISOString(),
   'and so is a Firestore Timestamp that has been through JSON');

/* ------------------------------------------------------------------ *
 * 🚨 THE PUBLIC DOCUMENT — and the one thing it may never hold
 *
 * Tim, asked on 2026-09-03 which of the more personal fields should follow him
 * into public, picked the profile photo, the time of day he trains and the gym
 * name, and left BODY WEIGHT out. That is the whole difference between these two
 * documents, so it is asserted from every direction it could be got wrong.
 * ------------------------------------------------------------------ */

const pub = base(PUBLIC, { shareBodyWeight: true });
const friendsBw = base(FRIENDS, { shareBodyWeight: true });

ok(friendsBw.bodyWeight.length === 1 && friendsBw.bodyWeight[0].weight === 178,
   'a friend gets the weigh-ins once the owner switches them on');
ok(pub.bodyWeight === undefined,
   '🚨 AND THE PUBLIC DOCUMENT DOES NOT — with the identical inputs, including the switch turned on');
ok(JSON.stringify(pub).indexOf('178') === -1,
   '⚠️ and 178 does not survive anywhere in it as text either, which is the assertion that would '
   + 'catch it being smuggled through some other field');
ok(base(FRIENDS).bodyWeight === undefined,
   'and it is off even for friends until the owner turns it on separately');

ok(pub.isPublic === true && pub.audience === PUBLIC,
   'the public document is marked public — 🚨 this flag IS the read permission, firestore.rules '
   + 'grants any signed-in caller a read when it is true');
ok(pub.viewers.length === 0,
   '⚠️ and carries an EMPTY viewers list rather than a populated one: two access models on one '
   + 'document would leave the narrower one doing nothing');
ok(Array.isArray(pub.viewers),
   'the key is present though — the rules check `viewers is list` before indexing it, and a '
   + 'missing key turns a clean denial into an evaluation error');

ok(pub.activity.length === 3 && pub.activity.find((a) => a.name === 'Push').entries.length === 4,
   'everything else is there: a public account really does publish the whole workout');
ok(pub.activity.find((a) => a.name === 'Push').startedAt === '2026-08-15T09:00:00.000Z',
   'including the time of day — Tim\'s explicit answer, given the argument that sixty start times '
   + 'describe a weekly schedule');
ok(pub.benchmarks.length === 1 && pub.strength.muscles.length === 1,
   'and the benchmarks and the muscle map');

/* ------------------------------------------------------------------ *
 * The muscle map somebody else reads — 2026-09-03
 * ------------------------------------------------------------------ */

const shared = base(FRIENDS).strength;
ok(shared.muscles[0].estimate === 233.4,
   '🚨 THE ESTIMATED 1RM IS PUBLISHED NOW. It was deliberately withheld — "nothing renders it, so '
   + 'nothing needs it" — and that stopped being true the moment a friend could tap a muscle');
ok(shared.muscles[0].contributors.length === MAX_SHARED_CONTRIBUTORS,
   `⚠️ and at most ${MAX_SHARED_CONTRIBUTORS} contributing sets come with it — Rule 5 travels with `
   + 'the number, or the panel shows an inference dressed as a measurement');
ok(shared.muscles[0].contributors[0].exerciseName === 'Barbell Bench Press'
   && shared.muscles[0].contributors[0].weight === 205,
   'each naming a real recorded set');
ok(shared.grid['lifters|male|own|own'].Chest[0] === 62,
   'the grid carries a percentile per comparison group');
ok(shared.grid['everyone|all|any|any'].Chest[0] === 88.1,
   '⚠️ and a DIFFERENT one for a different group — which is the whole point of publishing a grid '
   + 'rather than one number: the reader can ask any question the sheet offers');
ok(shared.defaultCompare === 'lifters|male|own|own',
   'and says which row is their own "like me", so a viewer\'s "own" resolves to THEIR sex');
ok(projectStrength({ muscles: [{ muscle: 'Chest', secretNote: 'x' }], grid: {} })
     .muscles[0].secretNote === undefined,
   '⚠️ the map is whitelisted like everything else — a field invented next year is absent from a '
   + "friend's screen until somebody names it, rather than published because nobody thought");
ok(projectStrength(null).muscles.length === 0 && projectStrength([]).grid !== undefined,
   'and a missing or legacy-shaped map degrades to an empty one rather than throwing mid-publish');

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

const withEmail = buildProjection({
  audience: FRIENDS, viewers: ['alex'],
  profile: { name: 'Tim', email: 'tim@example.com', uid: 'abc123' },
  sessions: [], publishedAt: '2026-08-17T12:00:00.000Z',
});
ok(withEmail.profile.email === undefined && withEmail.profile.uid === undefined,
   'the email address can never reach a projection, even when handed straight to it');
ok(JSON.stringify(withEmail).indexOf('example.com') === -1, 'and does not survive as text either');
ok(withEmail.profile.name === 'Tim', 'the display name is what is shared');

/* ---- the profile photo (2026-08-31) ----
 *
 * Tim: *"your friends can't see the profile picture… its just the default blank
 * humanoid, not the picture that they actually added."* It rides beside the
 * name, because `profile` is IDENTITY — somebody who can see your name can see
 * your face. ⚠️ Asked on 2026-09-03 whether it follows the account into public,
 * he said yes, so it is asserted in BOTH documents below.
 *
 * 🚨 THE REFUSALS ARE THE POINT OF THIS BLOCK. The same string is read back off
 * somebody else's document and put into an `src` by ui.js personFace(), so the
 * one function decides both directions and both are asserted here.
 */
{
  const FACE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA==';
  const withFace = (avatar, audience = FRIENDS) => buildProjection({
    audience, viewers: ['alex'], profile: { name: 'Tim', avatar },
    sessions: [], publishedAt: '2026-08-31T12:00:00.000Z',
  });

  ok(withFace(FACE).profile.avatar === FACE, 'a photo is published beside the name to friends');
  ok(withFace(FACE, PUBLIC).profile.avatar === FACE,
     'and to the public — Tim picked the photo as one of the three that follow the account there');
  ok(withFace(undefined).profile.avatar === undefined,
     '⚠️ and it is ABSENT rather than null on an account with no photo, which is most of them — '
     + 'every reader already treats a missing avatar as "draw the glyph"');
  ok(withFace('').profile.avatar === undefined, 'an empty string is no photo, not a broken one');

  ok(withFace('data:image/svg+xml;base64,PHN2Zy8+').profile.avatar === undefined,
     '🚨 AN SVG IS REFUSED. It is a document that can carry script rather than a picture, and the '
     + 'far end of this is an <img src> on somebody else\'s phone');
  ok(withFace('https://example.com/me.jpg').profile.avatar === undefined,
     '🚨 and a REMOTE URL is refused — it would make every viewer\'s device fetch a URL of the '
     + 'publisher\'s choosing, which tells them who looked and from where');
  ok(withFace('javascript:alert(1)').profile.avatar === undefined, 'and a javascript: URL, obviously');
  ok(withFace(`data:image/jpeg;base64,${'A'.repeat(MAX_AVATAR_CHARS)}`).profile.avatar === undefined,
     `⚠️ and anything past ${MAX_AVATAR_CHARS} characters is dropped rather than published — the `
     + 'document has a 1 MiB ceiling it shares with 60 sessions, and a projection that quietly '
     + 'outgrows it stops publishing, which presents as "my friend\'s page stopped updating"');
  ok(withFace({ toString: () => FACE }).profile.avatar === undefined,
     'and a non-string is not coaxed into one');

  // The absence guard has to stay happy with it, or publishing breaks outright.
  ok(assertAudienceClean(withFace(FACE), FRIENDS) === true
     && assertAudienceClean(withFace(FACE, PUBLIC), PUBLIC) === true,
     'and the guard passes a document carrying a face — identity is not training');
}

/* ------------------------------------------------------------------ *
 * Caps
 * ------------------------------------------------------------------ */

const many = Array.from({ length: 400 }, (_, i) => ({
  id: `s-${i}`, workoutName: 'Push',
  date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  entries: [],
}));
const capped = buildProjection({ audience: FRIENDS, viewers: [], profile: {}, sessions: many, publishedAt: null });
ok(capped.activity.length === MAX_ACTIVITY, `activity is capped at ${MAX_ACTIVITY}`);

const manyViewers = Array.from({ length: MAX_VIEWERS + 50 }, (_, i) => `u${i}`);
ok(buildProjection({ audience: FRIENDS, viewers: manyViewers, sessions: [] }).viewers.length === MAX_VIEWERS,
   `viewers are capped at ${MAX_VIEWERS} — a document that quietly outgrows 1 MB stops publishing`);
ok(buildProjection({ audience: FRIENDS, viewers: ['a', 'a', 'b', '', null], sessions: [] }).viewers.join() === 'a,b',
   'viewers are de-duplicated and empties dropped');

/* ------------------------------------------------------------------ *
 * The guard itself
 *
 * ⚠️ IT LOST ITS BIGGEST JOB ON 2026-09-03 AND KEPT ITS SHAPE. Under the tiers
 * it walked every leaf below a session, because `light` was allowed no number
 * from inside a workout at all. Both audiences get the whole session now, so
 * that walk has nothing left to find — and the guard still exists, still fails
 * closed, because the ONE remaining difference between the two documents is
 * exactly the kind an edit six months from now will quietly undo.
 * ------------------------------------------------------------------ */

throws(() => buildProjection({ audience: 'full', viewers: [], sessions: [] }),
       'building a projection for an audience that does not exist — an OLD TIER NAME, which is the '
       + 'shape a stale caller would really pass — throws rather than guessing');
throws(() => assertAudienceClean({ isPublic: true, bodyWeight: [{ date: '2026-08-01', weight: 178 }] }, PUBLIC),
       '🚨 the guard catches body weight in the public document');
throws(() => assertAudienceClean({ isPublic: true, viewers: ['alex'] }, PUBLIC),
       'and a public document carrying a viewers list');
throws(() => assertAudienceClean({ isPublic: true, viewers: [] }, FRIENDS),
       '🚨 AND THE OTHER DIRECTION, WHICH IS THE ONE THAT WOULD HURT: a FRIENDS document marked '
       + 'public is readable by everybody signed in, body weight and all. The rules read that flag '
       + 'and nothing else');
throws(() => assertAudienceClean({ isPublic: false, secretPlans: 'x' }, FRIENDS),
       'and a top-level field nobody has invented yet — the guard fails closed, not open');
ok(assertAudienceClean(mid, FRIENDS) && assertAudienceClean(pub, PUBLIC)
   && assertAudienceClean(friendsBw, FRIENDS),
   'and passes every real document, including the one carrying weigh-ins');

/* ------------------------------------------------------------------ *
 * Edge shapes
 * ------------------------------------------------------------------ */

ok(projectSession(null) === null, 'no session, no projection');
ok(projectSession({ workoutName: 'Push' }) === null,
   'a session with no date is not published — a dateless entry cannot be placed');
ok(projectSession({ date: '2026-08-01' }).name === 'Workout',
   'a session with no name still says a workout happened');
ok(projectSession({ date: '2026-08-01', entries: null }).entries.length === 0,
   'a malformed entries list becomes empty rather than throwing mid-publish');

// NaN and Infinity are not JSON and Firestore rejects them; a publish that
// throws is a publish that silently never happens.
const nasty = projectSession({
  date: '2026-08-01', workoutName: 'Push',
  entries: [{ exerciseName: 'Bench', sets: [{ weight: NaN, reps: Infinity, note: undefined }] }],
});
ok(nasty.entries[0].sets[0].weight === null && nasty.entries[0].sets[0].reps === null,
   'NaN and Infinity become null rather than reaching Firestore');
ok(JSON.stringify(nasty).indexOf('undefined') === -1, 'undefined is dropped, not stringified');

/* ------------------------------------------------------------------ *
 * Invites
 * ------------------------------------------------------------------ */

let counter = 0;
const fakeBytes = (n) => Uint8Array.from({ length: n }, () => counter++);
const token = newInviteToken(fakeBytes);
ok(token.length === 26, 'an invite token is 26 characters (~130 bits)');
ok(/^[a-z2-9]+$/.test(token) && !/[lo01]/.test(token),
   'from an alphabet with no l, o, 0 or 1 — these get read aloud and typed by hand');

const realBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const tokens = new Set(Array.from({ length: 500 }, () => newInviteToken(realBytes)));
ok(tokens.size === 500, '500 real tokens, no collisions');

ok(inviteExpiry('2026-08-17T00:00:00.000Z') === '2026-08-24T00:00:00.000Z',
   `an invite lasts ${INVITE_TTL_DAYS} days`);
ok(inviteExpiry('not a date') === null, 'an unparseable creation date has no expiry');

const openInvite = { token: 'abc', createdAt: '2026-08-17T00:00:00.000Z' };
ok(inviteState(openInvite, '2026-08-18T00:00:00.000Z') === 'open', 'a fresh invite is open');
ok(inviteState(openInvite, '2026-08-25T00:00:00.000Z') === 'expired', 'and expires after a week');
ok(inviteState({ ...openInvite, claimedBy: 'alex' }, '2026-08-18T00:00:00.000Z') === 'claimed',
   'a claimed invite says claimed, not expired — they send you to different next steps');
ok(inviteState(null, '2026-08-18T00:00:00.000Z') === 'invalid', 'nonsense is invalid');
ok(inviteState({ token: 'abc' }, '2026-08-18T00:00:00.000Z') === 'invalid',
   'an invite with no creation date and no expiry is invalid, NOT open');

/* ------------------------------------------------------------------ *
 * ⚠️ THE SHAPE THE NETWORK REALLY RETURNS
 *
 * Everything above hands inviteState a fixture with NO `expiresAt`, so it only
 * ever tested the derive-from-createdAt fallback. The app never takes that
 * path: store.js writes `expiresAt` as a Date, so the Firestore SDK reads it
 * back as a TIMESTAMP OBJECT. `Date.parse()` on one of those is NaN and
 * `NaN <= now` is false — so before 2026-08-22 every expired invite read as
 * `open`, and the "that link has expired" screen could not be reached. Driven
 * against the live project that day: an invite three weeks stale offered
 * "Connect", and only firestore.rules stopped the claim.
 *
 * These fakes are duck-typed exactly as the real ones are — a Timestamp, a
 * Timestamp that has been through JSON, and a Date.
 * ------------------------------------------------------------------ */

const stamp = (iso) => ({
  seconds: Math.floor(Date.parse(iso) / 1000),
  nanoseconds: 0,
  toMillis() { return this.seconds * 1000; },
  toDate() { return new Date(this.seconds * 1000); },
  toString() { return `Timestamp(seconds=${this.seconds}, nanoseconds=0)`; },
});

const stamped = { token: 'abc', createdAt: '2026-08-17T00:00:00.000Z' };

ok(inviteState({ ...stamped, expiresAt: stamp('2026-08-24T00:00:00.000Z') },
               '2026-08-18T00:00:00.000Z') === 'open',
   'a Firestore Timestamp expiry in the future is open');
ok(inviteState({ ...stamped, expiresAt: stamp('2026-08-24T00:00:00.000Z') },
               '2026-08-25T00:00:00.000Z') === 'expired',
   '⚠️ and one in the PAST is expired — Date.parse() on a Timestamp is NaN, and NaN <= now is false');
ok(inviteState({ ...stamped, expiresAt: { seconds: Math.floor(Date.parse('2026-08-24T00:00:00.000Z') / 1000) } },
               '2026-08-25T00:00:00.000Z') === 'expired',
   'a Timestamp that has been through JSON — no methods, just seconds — expires too');
ok(inviteState({ ...stamped, expiresAt: new Date('2026-08-24T00:00:00.000Z') },
               '2026-08-25T00:00:00.000Z') === 'expired',
   'and so does a plain Date, which is what store.js hands the SDK on the way in');
ok(inviteState({ ...stamped, expiresAt: {} }, '2026-08-18T00:00:00.000Z') === 'invalid',
   'an expiry that is present but unreadable is invalid, NOT open — it must fail closed');
ok(inviteState({ ...stamped, expiresAt: stamp('2026-08-24T00:00:00.000Z'), claimedBy: 'alex' },
               '2026-08-18T00:00:00.000Z') === 'claimed',
   'claimed still beats expiry, whatever shape the expiry is in');

ok(inviteExpiry(stamp('2026-08-17T00:00:00.000Z')) === '2026-08-24T00:00:00.000Z',
   'inviteExpiry reads a Timestamp too, so the fallback cannot be the odd one out');
ok(inviteExpiry({}) === null, 'and an unreadable creation date still has no expiry');

/* ---------- location (0m): a typed label, never a coordinate ---------- */
{
  const s = {
    id: 's9', date: '2026-08-20', workoutName: 'Push',
    startedAt: '2026-08-20T18:00:00Z', location: '  Gold’s Gym  ', entries: [],
  };
  ok(projectSession(s).location === 'Gold’s Gym', 'the label is published, trimmed');
  ok(base(PUBLIC, { sessions: [s] }).activity[0].location === 'Gold’s Gym',
     '⚠️ INCLUDING TO THE PUBLIC — Tim\'s answer on 2026-09-03, given the argument that a place '
     + 'plus a time says where a person reliably is and when. It was mid-and-above before');
  ok(!('location' in projectSession({ ...s, location: '   ' })),
     'a blank label publishes NO key — absent, never empty (one case for the view)');
  ok(!('location' in projectSession({ ...s, location: 42 })),
     'a non-string label is dropped, not coerced');
  const nos = { ...s }; delete nos.location;
  ok(!('location' in projectSession(nos)), 'missing is missing');
  ok(projectSession({ ...s, location: 'x'.repeat(300) }).location.length === 80,
     'capped at 80 characters at the builder, matching the input cap');
}

/* ---------- the description (§13 Step 2): how it went ---------- */
{
  const s = {
    id: 's11', date: '2026-08-20', workoutName: 'Push',
    startedAt: '2026-08-20T18:00:00Z', note: '  Felt strong. Shoulder held up.  ', entries: [],
  };
  ok(projectSession(s).note === 'Felt strong. Shoulder held up.', 'the line is published, trimmed');
  ok(!('note' in projectSession({ ...s, note: '   ' })),
     'a blank description publishes NO key — absent, never empty (one case for the card)');
  ok(!('note' in projectSession({ ...s, note: 42 })),
     'a non-string description is dropped, not coerced — nobody wrote "42"');
  const nonote = { ...s }; delete nonote.note;
  ok(!('note' in projectSession(nonote)),
     'every session recorded before this field existed publishes no key — missing is missing');
  ok(projectSession({ ...s, note: 'x'.repeat(400) }).note.length === 280,
     'capped at 280 at the builder as well as at the box, because an imported row never saw the box');
  // ⚠️ The per-exercise `notes` is a DIFFERENT field with nearly the same name.
  // It has never been published and this must not be what starts.
  ok(!('notes' in projectSession(s)),
     '⚠️ and `note` is the session’s description — the per-exercise `notes` is still nobody’s business');
}

/* ---------- duration: minutes rounded to five ---------- */
{
  const s = {
    id: 's10', date: '2026-08-20', workoutName: 'Push',
    startedAt: '2026-08-20T18:00:00.000Z', finishedAt: '2026-08-20T18:47:00.000Z',
    entries: [],
  };
  ok(projectSession(s).minutes === 45,
     `47 minutes publishes as 45 — rounded to five, so the exact finish stays private (${projectSession(s).minutes})`);
  ok(!('finishedAt' in projectSession(s)),
     '⚠️ finishedAt itself is STILL never published, to anybody');
  ok(!('minutes' in projectSession({ ...s, finishedAt: '2026-08-21T08:00:00.000Z' })),
     'a draft left open overnight publishes NO duration rather than a fourteen-hour one');
  ok(!('minutes' in projectSession({ ...s, finishedAt: s.startedAt })),
     'a zero-length stamp pair (the quick activity log) publishes no duration');
  const noFinish = { ...s }; delete noFinish.finishedAt;
  ok(!('minutes' in projectSession(noFinish)),
     'sessions from before finishedAt existed publish no key — missing is missing');
}

/* ---------- reactions: kudos + comments (0l) ---------- */
{
  const {
    KUDOS, COMMENT, MAX_COMMENT_LENGTH,
    kudosId, commentId, cleanCommentText, groupReactions,
  } = await import('../js/social.js');

  // Deterministic ids are the idempotency story: giving kudos twice is the
  // same document twice, never two kudos.
  ok(kudosId('s1', 'uidA') === kudosId('s1', 'uidA'), 'a kudos id is deterministic');
  ok(kudosId('s1', 'uidA') !== kudosId('s1', 'uidB'), 'and per person');
  ok(commentId('s1', 'uidA', 'n1') !== commentId('s1', 'uidA', 'n2'),
     'comments stack — the nonce keeps their ids apart');

  ok(cleanCommentText('  nice one  ') === 'nice one', 'comment text is trimmed');
  throws(() => cleanCommentText('   '), 'an empty comment is refused with a sentence');
  throws(() => cleanCommentText('x'.repeat(MAX_COMMENT_LENGTH + 1)),
     'an over-long comment is refused');
  ok(cleanCommentText('x'.repeat(MAX_COMMENT_LENGTH)).length === MAX_COMMENT_LENGTH,
     'exactly the cap is allowed');

  const rows = [
    { id: 'k1', kind: KUDOS, sessionId: 's1', from: 'alice' },
    { id: 'k2', kind: KUDOS, sessionId: 's1', from: 'me' },
    // A hostile client stacking a second kudos doc from the same person —
    // grouped, they still count once.
    { id: 'k3', kind: KUDOS, sessionId: 's1', from: 'alice' },
    { id: 'c2', kind: COMMENT, sessionId: 's1', from: 'alice', fromName: 'Alice', text: 'later', at: '2026-08-02T10:00:00Z' },
    { id: 'c1', kind: COMMENT, sessionId: 's1', from: 'me', fromName: '', text: 'first', at: '2026-08-01T10:00:00Z' },
    // Garbage another client could write: dropped, never trusted to crash.
    { id: 'x1', kind: 'sticker', sessionId: 's1', from: 'alice' },
    { id: 'x2', kind: COMMENT, sessionId: 's1', from: 'alice', text: '   ' },
    { id: 'x3', kind: KUDOS, from: 'alice' },
    { id: 'x4', kind: KUDOS, sessionId: 's1' },
    null, 'string', 42,
  ];
  const grouped = groupReactions(rows, 'me');
  const s1 = grouped.get('s1');
  ok(Boolean(s1), 'reactions group under their session');
  ok(s1.kudos.length === 2, `stacked kudos from one person count once (${s1.kudos.length})`);
  ok(Boolean(s1.myKudosId), 'my own kudos is recognised so the button can show its state');
  ok(s1.comments.length === 2, `blank and malformed comments are dropped (${s1.comments.length})`);
  ok(s1.comments[0].text === 'first' && s1.comments[1].text === 'later',
     'comments read oldest first — a conversation runs downward');
  ok(s1.comments[0].mine === true && s1.comments[1].mine === false,
     'my comments are marked mine, so only they offer a delete');
  ok(groupReactions(rows, null).get('s1').myKudosId === null,
     'with no viewer uid nothing claims to be mine');
  ok(groupReactions('garbage', 'me').size === 0, 'a non-list input groups to nothing');
}

/* ================= stale publish detection (2026-08-28) =================
   The brain of the boot heal. Why it exists: republish() was wired to social
   mutations only, so Autumn's published muscle map froze as an empty
   pre-training snapshot the moment she connected — and Tim reported it as
   data loss. needsRepublish() answers "is what this account has PUBLISHED
   older than what it has RECORDED", and the heal republishes when it is. */
{
  const { needsRepublish } = await import('../js/social.js');
  const sess = (createdAt) => ({ id: 's', createdAt });

  ok(needsRepublish({ sessions: [sess('2026-08-26T04:09:00Z')], publishedAt: '2026-08-25T21:25:20Z' }),
     '⚠️ the Autumn case: a session recorded after the last publish means republish');
  ok(!needsRepublish({ sessions: [sess('2026-08-25T20:00:00Z')], publishedAt: '2026-08-25T21:25:20Z' }),
     'a publish newer than every session means nothing to do');
  ok(needsRepublish({ sessions: [], publishedAt: null }),
     'never published at all is as stale as stale gets — the caller has already checked connections exist');
  ok(needsRepublish({ sessions: [sess('2026-08-26T00:00:00Z')], publishedAt: 'garbage' }),
     'an unreadable publishedAt is treated as never-published, not as fresh');
  ok(!needsRepublish({ sessions: [{ id: 'x' }], publishedAt: '2026-08-25T21:25:20Z' }),
     'a session with no createdAt cannot vote — better one stale edge than a republish loop');
  ok(!needsRepublish({ sessions: null, publishedAt: '2026-08-25T21:25:20Z' }),
     'and no session list at all is handled, not thrown on');
}


/* ================= finding people by name (2026-08-29) =================
   🚨 The directory reverses a decision this project made on purpose — the
   argument is in js/social.js's "Finding people by name" header and above the
   `directory` block in firestore.rules. These assertions are about the MATCHING,
   which is pure and is where a bad result would actually come from. */
{
  const { searchKey, matchesSearch, rankMatches, readableRequest, profileLink } =
    await import('../js/social.js');

  ok(searchKey('  Tim   Hadfield ') === 'tim hadfield',
     'the search key trims, lower-cases and collapses runs of whitespace');
  ok(searchKey(null) === '', 'and nothing in is nothing out, never a throw');

  const anna = { uid: 'u1', name: 'Anna Smith', nameLower: 'anna smith' };
  ok(matchesSearch(anna, 'an'), 'a prefix of the whole name matches');
  ok(matchesSearch(anna, 'sm'),
     '⚠️ and a prefix of ANY WORD matches — a Firestore prefix query could not do this, '
     + 'so somebody typing a surname would never have found her');
  ok(matchesSearch(anna, 'ANNA smith'), 'case and spacing do not matter');
  ok(!matchesSearch(anna, 'nn'),
     '⚠️ but never a substring INSIDE a word — "nn" finding "Anna" is how a list of '
     + 'strangers starts looking like a list of matches');
  ok(!matchesSearch(anna, '   '), 'and whitespace matches nobody rather than everybody');
  ok(!matchesSearch(null, 'a') && !matchesSearch({}, 'a'),
     'a row with no name is not a match — the directory is written by other people');

  const rows = [
    { uid: 'u1', name: 'Samantha Fitzgerald', nameLower: 'samantha fitzgerald' },
    { uid: 'u2', name: 'Sam', nameLower: 'sam' },
    { uid: 'u3', name: 'Jo Sampson', nameLower: 'jo sampson' },
    { uid: 'u4', name: 'Tim', nameLower: 'tim' },
  ];
  const ranked = rankMatches(rows, 'sam');
  ok(ranked.length === 3, `Tim is not a match for "sam" (${ranked.length} matched)`);
  ok(ranked[0].uid === 'u2',
     '⚠️ the shortest whole-name match leads — "Sam" above "Samantha Fitzgerald", because a '
     + 'shorter name containing the query is closer to it');
  ok(ranked[1].uid === 'u1' && ranked[2].uid === 'u3',
     'then the longer name-prefix, then the word-prefix — a surname match is a weaker signal');
  ok(rankMatches(rows, '').length === 0,
     'an empty query matches nobody — never "here is everybody", which is what the '
     + 'permission behind this would happily return');

  // A request row is written by somebody else and is about to go on a screen.
  ok(readableRequest({ from: 'u9', name: '  Autumn  ' }).name === 'Autumn',
     'a request is trimmed before it is rendered');
  ok(readableRequest({ id: 'u9', name: 'Autumn' }).uid === 'u9',
     'the document id stands in for `from`, because the rules pin them to each other anyway');
  ok(readableRequest({ from: 'u9' }) === null && readableRequest({ name: 'A' }) === null,
     'a half-formed request is dropped rather than rendered as a nameless row');
  ok(readableRequest(null) === null && readableRequest('nope') === null,
     'and so is anything that is not an object');
  ok(readableRequest({ from: 'u9', name: 'x'.repeat(200) }).name.length === 60,
     'a 200-character name is cut to 60 — the rules cap it too, and neither trusts the other');

  ok(profileLink('https://example.com/app/#/social', 'abc') === 'https://example.com/app/#/add/abc',
     '⚠️ a profile link points at the ACCOUNT and never expires — an invite link is a one-time '
     + 'capability, and a QR of one goes stale in a pocket');
}

/* ================= the graph's `pending` list (2026-08-29) =================
   Who I have ASKED, which is not who I am connected to and must never be
   confused with it. It exists so my client knows whose shared document is worth
   probing — the probe succeeding IS how acceptance is learned, and probing only
   people I asked is what stops anybody adding themselves to my friends list. */
{
  const { normalizeGraph } = await import('../js/social.js');

  const g = normalizeGraph({
    connections: [{ uid: 'a', name: 'Ann', tier: 'mid' }],
    pending: [
      { uid: 'b', name: 'Bob', at: '2026-08-29' },
      { uid: 'b', name: 'Bob again' },
      { uid: 'a', name: 'Ann' },
      { uid: '', name: 'nobody' },
      null,
    ],
  });
  ok(g.pending.length === 1 && g.pending[0].uid === 'b',
     'pending de-duplicates and drops rows with no uid');
  ok(!g.pending.some((p) => p.uid === 'a'),
     '⚠️ somebody already CONNECTED is never also pending — a half-finished accept has to '
     + 'resolve toward the connection, or they show up twice on one screen');
  ok(normalizeGraph({ connections: [] }).pending.length === 0,
     'a graph written before this existed reads as no pending requests, not as a crash');
  ok(Array.isArray(normalizeGraph(null).pending),
     'and so does no graph at all');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
