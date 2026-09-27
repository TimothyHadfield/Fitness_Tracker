// A friend's published muscle map, and the Compare screen — 2026-09-26, and
// REVERSED 2026-09-27 at Tim's word.
//   node tests/compare-publish.test.mjs
//
// Tim, 2026-09-26: "When I compare my body with Autumn, it says "nothing to
// compare yet" (due to not enough recordings), even though she has 11 workouts
// recorded and she's previously been able to see her muscle map."
//
// Cause: the publish refused a map while gender or a weigh-in was missing (the
// 2026-09-06 rule "an assumed profile is never published"), while her OWN screen
// ranked on a stated assumption. Tim, 2026-09-27: "I want you to fix the code on
// your end so that even if there are whatever user errors it still is working as
// much as it can. Worse case, we just show the information that was previously
// being shown in the first place, right?"
//
// So what this file pins now:
//   1. an incomplete profile PUBLISHES — ranked on exactly the assumption her
//      own screen uses, with the assumption carried in the map (`assumed`);
//   2. her screen and the published grid agree number for number;
//   3. filling in Body details republishes and the assumption comes off;
//   4. the boot heal republishes a mapless document (an old build refused it)
//      and a document whose `assumed` no longer matches the profile;
//   5. the rows branch (demo friends, famous lifters) follows the same rule;
//   6. the reader side: `assumed` survives the whitelist, a friend's screen has
//      a sentence for it, and a legacy document still yields levels to draw.
//
// 🔒 NO CLOUD. `js/firebase-backend.js` is swapped for an in-memory fake with a
// module hook BEFORE the store loads, and the test aborts if the swap did not
// take — the real module cannot load under node anyway (https imports).
import { registerHooks } from 'node:module';

const FAKE = `
const db = new Map();
const shared = new Map();
const g = globalThis.__fakeCloud = { db, shared, publishes: 0, graph: { connections: [{ uid: 'tim', name: 'Tim' }] } };
const copy = (v) => JSON.parse(JSON.stringify(v));
export const SHARDED_COLLECTIONS = [];
export function mergeRows(a, b) { return [...(a || []), ...(b || [])]; }
export const FirebaseBackend = {
  async ready() { return true; },
  currentUid() { return 'autumn'; },
  async read(c) { return copy(db.get(c) || []); },
  async write(c, rows) { db.set(c, copy(rows || [])); return true; },
  async readGraph() { return copy(g.graph); },
  async readShared(uid, audience) { return uid === 'autumn' && shared.has(audience) ? copy(shared.get(audience)) : null; },
  async publishShared(audience, doc) { g.publishes++; shared.set(audience, copy(doc)); return true; },
  async unpublishShared(audience) { shared.delete(audience); return true; },
  async writeBackup() { return true; },
};
`;
registerHooks({
  resolve(specifier, context, next) {
    if (/firebase-backend\.js$/.test(specifier)) {
      return { url: 'data:text/javascript,' + encodeURIComponent(FAKE), shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
// No rolling backup sweep during the test.
mem.set('ftrack:v1:lastCloudRollBackup', String(Date.now()));

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sorted = (a) => (Array.isArray(a) ? [...a].sort().join(',') : '');

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { store, social, auth, muscleStrength, buildStrengthShare } = await import('../js/store.js');
const S = await import('../js/social.js');
const SM = await import('../js/shared-map.js');

await store.getSettings();                       // connects the (fake) cloud
const cloud = globalThis.__fakeCloud;
if (!cloud) {
  console.log('FAIL  the fake cloud did not load — refusing to run anything that writes');
  process.exit(1);
}
ok(Boolean(cloud), 'the store is on the in-memory fake cloud, not Firestore');

const by = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const ent = (n, w, r) => ({ exerciseId: by(n).id, exerciseName: n, sets: [1, 2, 3].map(() => ({ weight: w, reps: r })) });

/* ---- Autumn, as her account plausibly stands: 11 workouts, no gender, no weigh-in yet ---- */
await store.saveSettings({ units: 'lbs', birthYear: 2003, sharedTiersCleared: true });
const days = ['2026-08-20', '2026-08-23', '2026-08-27', '2026-08-30', '2026-09-03', '2026-09-06',
  '2026-09-10', '2026-09-13', '2026-09-17', '2026-09-20', '2026-09-24'];
const sessions = [];
for (let i = 0; i < days.length; i++) {
  const b = Math.floor(i / 2) * 5;
  const entries = i % 2 === 0
    ? [ent('Back Squat', 95 + b, 8), ent('Hip Thrust', 135 + 2 * b, 10), ent('Hip Abduction Machine', 90 + b, 12),
       ent('Romanian Deadlift', 85 + b, 10), ent('Walking Lunge', 20, 10), ent('Leg Press', 180 + 2 * b, 10)]
    : [ent('Lat Pulldown', 70 + b, 10), ent('Dumbbell Bench Press', 25, 10), ent('Dumbbell Shoulder Press', 15, 10)];
  const row = { workoutId: 'w' + (i % 2), workoutName: i % 2 ? 'Upper' : 'Lower', date: days[i], entries };
  sessions.push(row);
  await store.saveSession(row);
}
await social.publish();
// Every save above started the 2.5 s publish debounce; let it land now, so the
// counts below measure only what the step under test caused.
await wait(3000);

/* ---- 1. no gender AND no weigh-in: the map is published, on a stated assumption ---- */
const bare = cloud.shared.get('friends');
const bareMap = bare && bare.strength;
ok(bare && Array.isArray(bare.activity) && bare.activity.length === 11,
  `her friends document is published with all 11 workouts (${bare && bare.activity.length})`);
ok(bareMap && Array.isArray(bareMap.muscles) && bareMap.muscles.length > 0,
  `🚨 and WITH a muscle map although gender and weigh-in are both missing (${bareMap ? bareMap.muscles.length : 0} muscles)`);
ok(bareMap && sorted(bareMap.assumed) === 'body weight,sex',
  `the map says what was assumed: ${JSON.stringify(bareMap && bareMap.assumed)}`);
ok(bareMap && bareMap.defaultCompare === 'lifters|male|own|own',
  'and it is keyed as male — the same assumption her own screen states ("Assumed male")');

/* ---- 2. her own screen and the published grid agree, number for number ---- */
const own = await muscleStrength();
const row = bareMap && bareMap.grid && bareMap.grid['lifters|male|own|own'];
let agree = 0; let differ = 0;
for (const [muscle, m] of own.muscles) {
  const cell = row && row[muscle];
  if (cell && Math.abs(cell[0] - m.percentile) < 1e-9) agree++; else differ++;
}
ok(own.muscles.size > 0 && agree === own.muscles.size && differ === 0,
  `every muscle on her own screen has the same percentile in the published "like them" row (${agree}/${own.muscles.size})`);
const anyRow = bareMap && bareMap.grid && bareMap.grid['lifters|male|any|own'];
ok(row && anyRow && Object.keys(row).length > 0
   && Object.keys(row).every((k) => anyRow[k] && anyRow[k][0] === row[k][0]),
  'with no weigh-in, "their body weight" rows are the reference-weight rows — exactly what her screen does');

/* ---- the reader's sentence for it ---- */
const note = SM.assumedNoteFor(S.projectStrength(bareMap), 'Autumn');
ok(typeof note === 'string' && /Assumed male/.test(note) && /Autumn/.test(note) && /180 lb/.test(note),
  `a friend's screen has one plain line for it: "${note}"`);

/* ---- 3a. a weigh-in republishes, and only the sex is still assumed ---- */
let before = cloud.publishes;
await store.logBodyWeight(140, '2026-09-01');
await wait(3000);
const weighed = cloud.shared.get('friends');
ok(cloud.publishes > before && weighed.strength.muscles.length > 0 && sorted(weighed.strength.assumed) === 'sex',
  `after a weigh-in the map says only the sex is assumed: ${JSON.stringify(weighed.strength.assumed)}`);

/* ---- the Compare sentence for an OLD-BUILD document (no map at all) still names what is missing ---- */
const mapless = { ...weighed, strength: { muscles: [], grid: {}, defaultCompare: null } };
const whyNoGender = S.whyNoSharedMap(mapless);
ok(/gender/i.test(whyNoGender) && !/age\b/i.test(whyNoGender) && !/body weight/i.test(whyNoGender),
  `a mapless document with no gender names the gender, not age or body weight: "${whyNoGender}"`);
const old = { ...mapless }; delete old.connections; old.profile = { name: 'Autumn' };
const whyOld = S.whyNoSharedMap(old);
ok(/gender/i.test(whyOld) && /body weight/i.test(whyOld) && !/\bage\b/i.test(whyOld),
  `a document too old to say which names both, still not age: "${whyOld}"`);

/* ---- 3b. filling in Body details republishes and the assumption comes off ---- */
before = cloud.publishes;
await store.saveProfile({ gender: 'female' });
await wait(3000);                                   // schedulePublish's 2.5 s debounce
const after = cloud.shared.get('friends');
ok(cloud.publishes > before, `saving her gender republished (${cloud.publishes - before} write(s))`);
ok(after && after.strength && after.strength.muscles.length > 0 && after.profile.gender === 'female'
   && !('assumed' in after.strength) && after.strength.defaultCompare === 'lifters|female|own|own',
  'and the map is now hers with nothing assumed (no `assumed` key, keyed female)');

/* ---- 4a. the boot heal: a doc still carrying an assumption the profile no longer needs ---- */
cloud.shared.set('friends', { ...weighed, publishedAt: new Date(Date.now() + 60_000).toISOString() });
let n0 = cloud.publishes;
ok(await social.healStalePublish() === true && cloud.publishes > n0,
  'the boot heal republishes a document whose `assumed` no longer matches her profile');
ok(!('assumed' in cloud.shared.get('friends').strength), 'and the assumption is gone from it');
n0 = cloud.publishes;
ok(await social.healStalePublish() === false && cloud.publishes === n0,
  'and with it matching it does nothing the next boot (no write loop)');

/* ---- 4b. Autumn's real case: gender missing, and an OLD build left the doc mapless ---- */
before = cloud.publishes;
await store.saveProfile({ gender: null });
await wait(3000);
const noGender = cloud.shared.get('friends');
ok(cloud.publishes > before && noGender.strength.muscles.length > 0 && sorted(noGender.strength.assumed) === 'sex',
  'clearing the gender republishes and the map STAYS, now marked as assumed (it used to come down)');
cloud.shared.set('friends', { ...noGender, strength: { muscles: [], grid: {}, defaultCompare: null },
  publishedAt: new Date(Date.now() + 60_000).toISOString() });
n0 = cloud.publishes;
ok(await social.healStalePublish() === true && cloud.publishes > n0
   && cloud.shared.get('friends').strength.muscles.length > 0,
  '🚨 a mapless document left by an old build is healed on her next boot — with no gender set');
n0 = cloud.publishes;
ok(await social.healStalePublish() === false && cloud.publishes === n0,
  'and the heal then leaves it alone');

/* ---- 5. the rows branch (demo friends, famous lifters) follows the same rule ---- */
const rows = { sessions: sessions.map((s, i) => ({ ...s, id: 's' + i })), benchmarks: [], bodyWeights: [] };
const rNoWeight = await buildStrengthShare(rows, { gender: 'female' }).catch(() => null);
ok(rNoWeight && rNoWeight.muscles.length > 0 && sorted(rNoWeight.assumed) === 'body weight'
   && rNoWeight.defaultCompare === 'lifters|female|own|own',
  `rows with no body weight still publish, saying so: ${JSON.stringify(rNoWeight && rNoWeight.assumed)}`);
const rNothing = await buildStrengthShare(rows, {}).catch(() => null);
ok(rNothing && rNothing.muscles.length > 0 && sorted(rNothing.assumed) === 'body weight,sex',
  'rows with no profile at all still publish, both assumptions stated');
const rFull = await buildStrengthShare({ ...rows, bodyWeights: [{ date: '2026-08-01', weight: 140 }] },
  { gender: 'female', bodyWeight: 140 }).catch(() => null);
ok(rFull && rFull.muscles.length > 0 && !('assumed' in rFull),
  'the vacuity guard: a complete profile assumes nothing and carries no `assumed` key');

/* ---- 6. the reader side ---- */
const projected = S.projectStrength({ muscles: [], grid: {}, assumed: ['sex', 'hacked', 5, 'body weight'] });
ok(sorted(projected.assumed) === 'body weight,sex',
  'the publish whitelist keeps `assumed`, and only the two known words');
ok(!('assumed' in S.projectStrength({ muscles: [], grid: {} })),
  'and adds no key when nothing was assumed');
ok(SM.assumedOf({ assumed: 'sex' }).length === 0 && SM.assumedOf(null).length === 0
   && SM.assumedNoteFor({}, 'X') === null,
  'a garbage or absent `assumed` reads as nothing assumed, never a crash');

// A legacy document (strength as an ARRAY, the shape her live doc had in 2026-09).
const legacyDoc = {
  profile: { name: 'Autumn' },
  strength: [
    { muscle: 'Chest', level: 'Intermediate', percentile: 62, confidence: 0.7 },
    { muscle: 'Back', level: 'Novice', percentile: 31, confidence: 0.4 },
    { muscle: 'Quads', level: 'Nonsense' },
  ],
};
const lv = typeof SM.levelMapFromLegacy === 'function' ? SM.levelMapFromLegacy(S.legacyLevels(legacyDoc)) : null;
ok(lv instanceof Map && lv.size === 2 && lv.get('Chest').levelKey && lv.get('Back').label === 'Novice',
  'a legacy document still yields the levels it carries, so Compare can draw it instead of "Nothing to compare"');
ok(typeof SM.levelMapFromLegacy === 'function' && SM.levelMapFromLegacy(null) === null
   && SM.levelMapFromLegacy(S.legacyLevels({ strength: { muscles: [] } })) === null,
  'and nothing readable is null, so the empty state is kept only when truly nothing is there');

void auth;
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
