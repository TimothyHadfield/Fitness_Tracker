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
  MAX_VIEWERS, MAX_ACTIVITY,
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
  startedAt: '2026-08-15T09:00:00.000Z',
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
// carrying, and a whitelist is what keeps them out.
ok(midSession.workoutId === undefined && midSession.startedAt === undefined
   && midSession.isBenchmark === undefined,
   'internal session fields are not published — the builder is a whitelist, not a delete list');

/* ------------------------------------------------------------------ *
 * FULL
 * ------------------------------------------------------------------ */

const full = base(FULL);
ok(full.benchmarks.length === 1 && full.benchmarks[0].values.weight === 205, 'full publishes benchmarks');
ok(full.strength.length === 1 && full.strength[0].level === 'Intermediate', 'full publishes the muscle map');
ok(full.strength[0].estimate === undefined,
   'but not the estimated weight behind a level — nothing renders it, so nothing needs it');
ok(full.activity.find((a) => a.name === 'Push').entries.length === 4, 'full contains everything mid does');

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

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
