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
  NONE, LIGHT, MID, FULL, TIERS, TIER_LABEL,
  tierRank, isTier, atLeast, DEFAULT_TIER,
  normalizeGraph, tierForViewer, viewersForTier,
  projectSession, buildProjection, assertTierClean, leaves,
  MAX_VIEWERS, MAX_ACTIVITY, MAX_AVATAR_CHARS,
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
const STRENGTH = [{ muscle: 'Chest', level: 'Intermediate', percentile: 62, confidence: 0.71, estimate: 233.4 }];
const BODY_WEIGHTS = [{ id: 'bw-1', date: '2026-08-01', weight: 178 }];

const base = (tier, extra = {}) => buildProjection({
  tier,
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
 * Tiers
 * ------------------------------------------------------------------ */

ok(TIERS.join(',') === 'light,mid,full', 'three tiers, least to most visible');
ok(DEFAULT_TIER === LIGHT, 'a new connection defaults to the LEAST visible tier');
ok(tierRank(LIGHT) < tierRank(MID) && tierRank(MID) < tierRank(FULL), 'tiers are ordered');
ok(tierRank('nonsense') === -1 && tierRank(NONE) === -1, 'a non-tier has no rank');
ok(atLeast(FULL, MID) && atLeast(MID, MID) && !atLeast(LIGHT, MID), 'atLeast compares rank');
ok(!atLeast(NONE, LIGHT) && !atLeast(undefined, LIGHT) && !atLeast('full ', LIGHT),
   'unknown input is NEVER at least light — a typo must not widen access');
ok(TIERS.every((t) => TIER_LABEL[t] && !TIER_LABEL[t].includes('tier')),
   'every tier has a label that does not use the word "tier"');

/* ------------------------------------------------------------------ *
 * The graph
 * ------------------------------------------------------------------ */

const GRAPH = { connections: [
  { uid: 'alex', name: 'Alex', tier: FULL, since: '2026-08-01' },
  { uid: 'sam', name: 'Sam', tier: MID },
  { uid: 'jo', name: 'Jo', tier: LIGHT },
  { uid: 'pat', name: 'Pat', tier: NONE },
] };

ok(tierForViewer(GRAPH, 'alex') === FULL, 'a connection resolves to its tier');
ok(tierForViewer(GRAPH, 'stranger') === NONE, 'somebody not connected gets nothing');
ok(tierForViewer(null, 'alex') === NONE, 'no graph at all means nothing is shared');
ok(normalizeGraph({ connections: [{ uid: 'a', tier: 'sneaky' }] }).connections[0].tier === DEFAULT_TIER,
   'an unrecognised stored tier degrades to the SAFEST value, not the nearest');
ok(normalizeGraph({ connections: [{ uid: 'a', tier: FULL }, { uid: 'a', tier: LIGHT }] })
     .connections.length === 1,
   'a duplicated uid appears once');
ok(normalizeGraph({ connections: [{ tier: FULL }] }).connections.length === 0,
   'a connection with no uid is dropped rather than published to nobody');

ok(viewersForTier(GRAPH, FULL).join() === 'alex', 'full viewers = exactly the full connections');
ok(viewersForTier(GRAPH, MID).join() === 'sam', 'mid viewers = exactly the mid connections');
ok(viewersForTier(GRAPH, LIGHT).join() === 'jo', 'light viewers = exactly the light connections');
ok(!viewersForTier(GRAPH, LIGHT).includes('pat') && !viewersForTier(GRAPH, FULL).includes('pat'),
   'somebody set to Nothing appears in NO tier');
ok(viewersForTier(GRAPH, 'full ').length === 0, 'a non-tier has no viewers');
// Membership is exact, not cumulative — the documents are cumulative instead.
ok(!viewersForTier(GRAPH, LIGHT).includes('alex'),
   'a full viewer is not also listed on light (membership is exact, docs are cumulative)');

/* ------------------------------------------------------------------ *
 * LIGHT — the assertion this whole feature turns on
 * ------------------------------------------------------------------ */

const light = base(LIGHT);
const lightNumbers = leaves(light.activity, 'activity').filter((l) => typeof l.value === 'number');
ok(lightNumbers.length === 0,
   `light publishes NO number from inside a workout (found ${lightNumbers.length}: ${lightNumbers.map((l) => l.path).join(' ')})`);
// ⚠️ VACUITY GUARD. The assertion above is "found no numbers", which is also
// what a walk that looks in the wrong place reports. So run the identical walk
// over the identical sessions at MID and require that it DOES find numbers —
// otherwise the test above proves nothing at all.
const midNumbers = leaves(buildProjection({
  tier: MID, viewers: ['alex'], profile: { name: 'Tim' }, sessions: SESSIONS,
  publishedAt: '2026-08-17T12:00:00.000Z',
}).activity, 'activity').filter((l) => typeof l.value === 'number');
ok(midNumbers.length > 0,
   `the same walk finds ${midNumbers.length} numbers at mid — so "none at light" is a real result`);

ok(light.activity.length === 3, 'light still says a workout happened, three times');
ok(light.activity[0].date === '2026-08-17' && light.activity[2].date === '2026-08-13',
   'activity is newest first');
ok(light.activity.every((a) => a.name && typeof a.name === 'string'), 'and names each workout');
ok(light.activity.every((a) => a.entries === undefined),
   'light never looks inside the workout at all');
ok(light.activity.every((a) => a.startedAt === undefined),
   'light says WHICH DAY somebody trained and never what time — a time of day is a routine, '
   + 'and light is the tier every new connection starts on');
ok(JSON.stringify(light).indexOf('T09:00') === -1,
   'and the start time does not survive at light as text either');
// ⚠️ The three assertions above are absences, so pin the fields light DOES
// carry — otherwise a builder that published nothing at all would pass them.
ok(light.activity.every((a) => Object.keys(a).sort().join() === 'date,id,name'),
   'a light session is exactly id, date and name — nothing more, and not less');
ok(light.benchmarks === undefined && light.strength === undefined && light.bodyWeight === undefined,
   'light carries no benchmarks, no muscle map, no body weight');

// The same walk, over the deliberately nasty session on its own.
const lightOne = projectSession(SESSION, LIGHT);
ok(leaves(lightOne).every((l) => typeof l.value !== 'number'),
   'a session with supersets, a drop set and a legacy myo-rep still leaks no number at light');
ok(JSON.stringify(lightOne).indexOf('185') === -1 && JSON.stringify(lightOne).indexOf('minis') === -1,
   'and no weight or mini-set survives even as text');

/* ------------------------------------------------------------------ *
 * MID — the whole session, and nothing from the analysis
 * ------------------------------------------------------------------ */

const mid = base(MID);
const midSession = mid.activity.find((a) => a.name === 'Push');
ok(midSession.entries.length === 4, 'mid publishes every exercise');
ok(midSession.entries[0].sets[0].weight === 185, 'mid publishes weights');
ok(midSession.entries[0].group === 'g1' && midSession.entries[1].group === 'g1',
   'the superset survives — both halves keep the same group');
ok(midSession.entries[2].setType === 'drop', 'the drop set is still a drop set');
ok(midSession.entries[2].sets[0].minis.length === 2, 'and its two drops came with it');
ok(midSession.entries[3].sets[0].minis.length === 1,
   'a myo-rep stored under the LEGACY `drops` key still publishes its mini-sets');
ok(midSession.entries[3].sets[0].drops === undefined,
   'and publishes them as `minis`, so a reader has one shape to render, not two');
ok(mid.benchmarks === undefined && mid.strength === undefined && mid.bodyWeight === undefined,
   'mid carries nothing from the analysis collections — that is the whole mid/full cut');

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
   'mid publishes when the session started, so a feed card can say a time and not just a day');
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
  const p = projectSession({ date: '2026-08-01', workoutName: 'Push', startedAt: bad }, MID);
  ok(p.startedAt === undefined, `${what} publishes no time — never "Invalid Date", never a guess`);
}

// ⚠️ Vacuity guard for the six above: they are all absences, and a builder that
// never published a time would pass every one of them. This is the same call
// with a GOOD instant, and it must produce one.
ok(projectSession({ date: '2026-08-01', startedAt: '2026-08-01T18:40:00.000Z' }, MID).startedAt
     === '2026-08-01T18:40:00.000Z',
   'the same call with a real instant DOES publish it — so "absent" above is a result, not a hole');

// store.js writes instants through the SDK, which reads them back as Timestamp
// objects. That exact shape is the one bug this module has ever shipped — see
// instantMillis() and the invite section at the foot of this file — so the time
// goes through the same reader and comes out canonical whatever went in.
ok(projectSession({ date: '2026-08-01', startedAt: new Date('2026-08-01T18:40:00.000Z') }, MID)
     .startedAt === '2026-08-01T18:40:00.000Z',
   'a Date is normalised to one canonical ISO instant, so a reader has one shape to parse');
ok(projectSession({ date: '2026-08-01', startedAt: { seconds: 1785508800 } }, MID).startedAt
     === new Date(1785508800000).toISOString(),
   'and so is a Firestore Timestamp that has been through JSON');

// The tier line, asserted from both sides.
ok(projectSession(SESSION, LIGHT).startedAt === undefined
   && projectSession(SESSION, MID).startedAt === '2026-08-15T09:00:00.000Z',
   'the SAME session publishes a time at mid and none at light — the tier is what decides it');

/* ------------------------------------------------------------------ *
 * FULL
 * ------------------------------------------------------------------ */

const full = base(FULL);
ok(full.benchmarks.length === 1 && full.benchmarks[0].values.weight === 205, 'full publishes benchmarks');
ok(full.strength.length === 1 && full.strength[0].level === 'Intermediate', 'full publishes the muscle map');
ok(full.strength[0].estimate === undefined,
   'but not the estimated weight behind a level — nothing renders it, so nothing needs it');
ok(full.activity.find((a) => a.name === 'Push').entries.length === 4, 'full contains everything mid does');
ok(full.activity.find((a) => a.name === 'Push').startedAt === '2026-08-15T09:00:00.000Z',
   'including the start time — the documents are cumulative, so full is never missing a mid field');

ok(full.bodyWeight === undefined,
   'BODY WEIGHT IS OFF EVEN AT FULL unless it was turned on separately');
const fullBw = base(FULL, { shareBodyWeight: true });
ok(fullBw.bodyWeight.length === 1 && fullBw.bodyWeight[0].weight === 178,
   'and appears once it is');
const midBw = base(MID, { shareBodyWeight: true });
ok(midBw.bodyWeight === undefined,
   'asking to share body weight cannot smuggle it into a lower tier');

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

const withEmail = buildProjection({
  tier: LIGHT, viewers: ['alex'],
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
 * humanoid, not the picture that they actually added."* It is published with
 * the name now, at every tier, because `profile` is IDENTITY and the tiers cut
 * TRAINING — somebody who can see your name can see your face.
 *
 * 🚨 THE REFUSALS ARE THE POINT OF THIS BLOCK. The same string is read back off
 * somebody else's document and put into an `src` by ui.js personFace(), so the
 * one function decides both directions and both are asserted here.
 */
{
  const FACE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA==';
  const withFace = (avatar, tier = LIGHT) => buildProjection({
    tier, viewers: ['alex'], profile: { name: 'Tim', avatar },
    sessions: [], publishedAt: '2026-08-31T12:00:00.000Z',
  });

  ok(withFace(FACE).profile.avatar === FACE,
     'a photo is published beside the name at the LOWEST tier — a friend who sees only that you '
     + 'trained still sees who you are');
  ok(withFace(FACE, FULL).profile.avatar === FACE, 'and at the highest');
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

  // The absence guard has to stay happy with it, or publishing breaks at light.
  ok(assertTierClean(withFace(FACE), LIGHT) === true,
     'and the tier guard passes a light projection carrying a face — identity is not training');
}

/* ------------------------------------------------------------------ *
 * Caps
 * ------------------------------------------------------------------ */

const many = Array.from({ length: 400 }, (_, i) => ({
  id: `s-${i}`, workoutName: 'Push',
  date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  entries: [],
}));
const capped = buildProjection({ tier: LIGHT, viewers: [], profile: {}, sessions: many, publishedAt: null });
ok(capped.activity.length === MAX_ACTIVITY, `activity is capped at ${MAX_ACTIVITY}`);

const manyViewers = Array.from({ length: MAX_VIEWERS + 50 }, (_, i) => `u${i}`);
ok(buildProjection({ tier: LIGHT, viewers: manyViewers, sessions: [] }).viewers.length === MAX_VIEWERS,
   `viewers are capped at ${MAX_VIEWERS} — a document that quietly outgrows 1 MB stops publishing`);
ok(buildProjection({ tier: LIGHT, viewers: ['a', 'a', 'b', '', null], sessions: [] }).viewers.join() === 'a,b',
   'viewers are de-duplicated and empties dropped');

/* ------------------------------------------------------------------ *
 * The guard itself
 * ------------------------------------------------------------------ */

throws(() => buildProjection({ tier: 'everything', viewers: [], sessions: [] }),
       'building a projection for a tier that does not exist throws rather than guessing');
throws(() => assertTierClean({ activity: [{ date: '2026-08-01', name: 'Push', sets: [{ weight: 100 }] }] }, LIGHT),
       'the guard catches a number smuggled into light activity');
throws(() => assertTierClean({ activity: [], benchmarks: [] }, MID),
       'the guard catches benchmarks appearing at mid');
throws(() => assertTierClean({ activity: [], bodyWeight: [{ date: '2026-08-01', weight: 178 }] }, LIGHT),
       'the guard catches body weight at light');
ok(assertTierClean(light, LIGHT) && assertTierClean(mid, MID) && assertTierClean(full, FULL),
   'and passes all three real projections');

// The guard must survive a leak that is buried, not top-level — otherwise it is
// checking the easy case only.
throws(() => assertTierClean({ activity: [
  { date: '2026-08-01', name: 'Push', entries: [{ name: 'Fly', sets: [{ minis: [{ weight: 30 }] }] }] },
]}, LIGHT), 'the guard catches a weight nested two levels down inside a mini-set');

/* ------------------------------------------------------------------ *
 * ⚠️ THE LEAK THE GUARD COULD NOT SEE UNTIL 2026-08-25
 *
 * Every leak assertTierClean was written against happened to be a NUMBER — a
 * weight, a rep count — so "no numbers below a session at light" read like the
 * whole of it. It was not. The start time is a STRING, and a string sailed
 * through the guard untouched: the one field this change thought hardest about
 * was the one field the safety net could not have caught. The guard now checks
 * the KEY as well as the value, against the three names light admits.
 * ------------------------------------------------------------------ */

throws(() => assertTierClean({ activity: [
  { id: 's-1', date: '2026-08-01', name: 'Push', startedAt: '2026-08-01T18:40:00.000Z' },
]}, LIGHT), 'the guard catches a start time at light — a leak with no number in it anywhere');
throws(() => assertTierClean({ activity: [
  { id: 's-1', date: '2026-08-01', name: 'Push', notes: 'felt awful, left early' },
]}, LIGHT), 'and catches a field nobody has invented yet — the guard fails closed, not open');
// The vacuity guard for both: the identical documents MINUS the extra field
// must pass, or the two above prove only that the guard rejects everything.
ok(assertTierClean({ activity: [{ id: 's-1', date: '2026-08-01', name: 'Push' }] }, LIGHT),
   'while id, date and name together are clean — light is not simply rejecting whatever it sees');
ok(assertTierClean({ activity: [
  { id: 's-1', date: '2026-08-01', name: 'Push', startedAt: '2026-08-01T18:40:00.000Z' },
]}, MID), 'and the same start time is clean at mid, which is the tier that publishes it');

// And the real thing, re-asserted after the change: all three tiers, built from
// sessions that DO carry times, still pass their own guard.
ok(assertTierClean(light, LIGHT) && assertTierClean(mid, MID) && assertTierClean(full, FULL)
   && assertTierClean(base(FULL, { shareBodyWeight: true }), FULL),
   'every real projection still passes its own guard now that sessions carry a time');

/* ------------------------------------------------------------------ *
 * Edge shapes
 * ------------------------------------------------------------------ */

ok(projectSession(null, LIGHT) === null, 'no session, no projection');
ok(projectSession({ workoutName: 'Push' }, LIGHT) === null,
   'a session with no date is not published — a dateless entry cannot be placed');
ok(projectSession(SESSION, NONE) === null, 'the "nothing" tier publishes nothing');
ok(projectSession({ date: '2026-08-01' }, LIGHT).name === 'Workout',
   'a session with no name still says a workout happened');
ok(projectSession({ date: '2026-08-01', entries: null }, MID).entries.length === 0,
   'a malformed entries list becomes empty rather than throwing mid-publish');

// NaN and Infinity are not JSON and Firestore rejects them; a publish that
// throws is a publish that silently never happens.
const nasty = projectSession({
  date: '2026-08-01', workoutName: 'Push',
  entries: [{ exerciseName: 'Bench', sets: [{ weight: NaN, reps: Infinity, note: undefined }] }],
}, MID);
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

/* ---------- location (0m): a typed label, mid and above ---------- */
{
  const s = {
    id: 's9', date: '2026-08-20', workoutName: 'Push',
    startedAt: '2026-08-20T18:00:00Z', location: '  Gold’s Gym  ', entries: [],
  };
  ok(!('location' in projectSession(s, LIGHT)),
     '⚠️ location is NOT published at light — sixty times-and-places describe where a person reliably is');
  ok(projectSession(s, MID).location === 'Gold’s Gym',
     'at mid the label is published, trimmed');
  ok('location' in projectSession(s, FULL), 'and at full');
  ok(!('location' in projectSession({ ...s, location: '   ' }, MID)),
     'a blank label publishes NO key — absent, never empty (one case for the view)');
  ok(!('location' in projectSession({ ...s, location: 42 }, MID)),
     'a non-string label is dropped, not coerced');
  const nos = { ...s }; delete nos.location;
  ok(!('location' in projectSession(nos, MID)), 'missing is missing');
  ok(projectSession({ ...s, location: 'x'.repeat(300) }, MID).location.length === 80,
     'capped at 80 characters at the builder, matching the input cap');
}

/* ---------- the description (§13 Step 2): how it went, mid and above ---------- */
{
  const s = {
    id: 's11', date: '2026-08-20', workoutName: 'Push',
    startedAt: '2026-08-20T18:00:00Z', note: '  Felt strong. Shoulder held up.  ', entries: [],
  };
  ok(!('note' in projectSession(s, LIGHT)),
     '⚠️ the description is NOT published at light — light says the day and the name and '
     + 'nothing from inside the workout, and a sentence about how it went is inside it');
  ok(JSON.stringify(projectSession(s, LIGHT)).indexOf('Shoulder') === -1,
     'and it does not survive at light as text either');
  ok(projectSession(s, MID).note === 'Felt strong. Shoulder held up.',
     'at mid the line is published, trimmed');
  ok('note' in projectSession(s, FULL), 'and at full');
  ok(!('note' in projectSession({ ...s, note: '   ' }, MID)),
     'a blank description publishes NO key — absent, never empty (one case for the card)');
  ok(!('note' in projectSession({ ...s, note: 42 }, MID)),
     'a non-string description is dropped, not coerced — nobody wrote "42"');
  const nonote = { ...s }; delete nonote.note;
  ok(!('note' in projectSession(nonote, MID)),
     'every session recorded before this field existed publishes no key — missing is missing');
  ok(projectSession({ ...s, note: 'x'.repeat(400) }, MID).note.length === 280,
     'capped at 280 at the builder as well as at the box, because an imported row never saw the box');
  // ⚠️ The per-exercise `notes` is a DIFFERENT field with nearly the same name.
  // It has never been published and this must not be what starts.
  ok(!('notes' in projectSession(s, FULL)),
     '⚠️ and `note` is the session’s description — the per-exercise `notes` is still nobody’s business');
}

/* ---------- duration: minutes rounded to five, mid and above ---------- */
{
  const s = {
    id: 's10', date: '2026-08-20', workoutName: 'Push',
    startedAt: '2026-08-20T18:00:00.000Z', finishedAt: '2026-08-20T18:47:00.000Z',
    entries: [],
  };
  ok(!('minutes' in projectSession(s, LIGHT)),
     'duration is NOT published at light — it rides the same gate as the start time');
  ok(projectSession(s, MID).minutes === 45,
     `47 minutes publishes as 45 — rounded to five, so the exact finish stays private (${projectSession(s, MID).minutes})`);
  ok(!('finishedAt' in projectSession(s, FULL)),
     '⚠️ finishedAt itself is STILL never published, at any tier');
  ok(!('minutes' in projectSession({ ...s, finishedAt: '2026-08-21T08:00:00.000Z' }, MID)),
     'a draft left open overnight publishes NO duration rather than a fourteen-hour one');
  ok(!('minutes' in projectSession({ ...s, finishedAt: s.startedAt }, MID)),
     'a zero-length stamp pair (the quick activity log) publishes no duration');
  const noFinish = { ...s }; delete noFinish.finishedAt;
  ok(!('minutes' in projectSession(noFinish, MID)),
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
