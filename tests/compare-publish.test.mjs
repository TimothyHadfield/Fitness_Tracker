// A friend's published muscle map, and the Compare screen's refusal — 2026-09-26.
//   node tests/compare-publish.test.mjs
//
// Tim: "When I compare my body with Autumn, it says "nothing to compare yet"
// (due to not enough recordings), even though she has 11 workouts recorded and
// she's previously been able to see her muscle map. What happened to change it?
// Why is mine working when I only have 8 recorded workouts?"
//
// What was measured (synthetic 140 lb woman, 11 sessions of typical lifts):
// with gender AND a weigh-in the publish path builds her map at HEAD exactly as
// it did on 2026-09-22; age is not needed; with no gender or no weigh-in it
// refuses (on purpose — an assumed map is never published). Her OWN map still
// draws without either, which is why she can see it and her friends cannot.
//
// What this file pins are the two gaps that kept her friends' copy mapless
// AFTER she fixes her details, plus the sentence that tells Tim which is missing:
//   1. saving gender / birth year republished nothing (only a workout or a
//      weigh-in did), so filling in Body details changed nothing a friend reads;
//   2. the boot heal only compared session times, so a mapless document whose
//      owner can now publish a map stayed mapless until her next workout;
//   3. the Compare screen blamed "gender, body weight and age" (age is not
//      needed) without saying which one the document shows is missing.
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

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { store, social, auth } = await import('../js/store.js');
const S = await import('../js/social.js');

await store.getSettings();                       // connects the (fake) cloud
const cloud = globalThis.__fakeCloud;
if (!cloud) {
  console.log('FAIL  the fake cloud did not load — refusing to run anything that writes');
  process.exit(1);
}
ok(Boolean(cloud), 'the store is on the in-memory fake cloud, not Firestore');

const by = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const ent = (n, w, r) => ({ exerciseId: by(n).id, exerciseName: n, sets: [1, 2, 3].map(() => ({ weight: w, reps: r })) });

/* ---- Autumn, as her account plausibly stands: 11 workouts, a weigh-in, no gender ---- */
await store.saveSettings({ units: 'lbs', birthYear: 2003, sharedTiersCleared: true });
await store.logBodyWeight(140, '2026-09-01');
const days = ['2026-08-20', '2026-08-23', '2026-08-27', '2026-08-30', '2026-09-03', '2026-09-06',
  '2026-09-10', '2026-09-13', '2026-09-17', '2026-09-20', '2026-09-24'];
for (let i = 0; i < days.length; i++) {
  const b = Math.floor(i / 2) * 5;
  const entries = i % 2 === 0
    ? [ent('Back Squat', 95 + b, 8), ent('Hip Thrust', 135 + 2 * b, 10), ent('Hip Abduction Machine', 90 + b, 12),
       ent('Romanian Deadlift', 85 + b, 10), ent('Walking Lunge', 20, 10), ent('Leg Press', 180 + 2 * b, 10)]
    : [ent('Lat Pulldown', 70 + b, 10), ent('Dumbbell Bench Press', 25, 10), ent('Dumbbell Shoulder Press', 15, 10)];
  await store.saveSession({ workoutId: 'w' + (i % 2), workoutName: i % 2 ? 'Upper' : 'Lower', date: days[i], entries });
}
await social.publish();
// Every save above started the 2.5 s publish debounce; let it land now, so the
// counts below measure only what the step under test caused.
await wait(3000);
const mapless = cloud.shared.get('friends');
ok(mapless && Array.isArray(mapless.activity) && mapless.activity.length === 11,
  `her friends document is published with all 11 workouts (${mapless && mapless.activity.length})`);
ok(mapless && mapless.strength && mapless.strength.muscles.length === 0,
  'and NO muscle map — no gender on file, so the map is refused (the intended refusal, reproduced)');

/* ---- 3. the sentence Tim reads says WHICH thing is missing, and never age ---- */
const why = (d) => (typeof S.whyNoSharedMap === 'function' ? S.whyNoSharedMap(d) : '');
ok(typeof S.whyNoSharedMap === 'function', 'social.js says why a friend document has no map');
const whyNoGender = why(mapless);
ok(/gender/i.test(whyNoGender) && !/age\b/i.test(whyNoGender) && !/body weight/i.test(whyNoGender),
  `a document with no gender names the gender, not age or body weight: "${whyNoGender}"`);
const withGender = { ...mapless, profile: { ...mapless.profile, gender: 'female' } };
const whyNoWeight = why(withGender);
ok(/body weight/i.test(whyNoWeight) && !/\bgender\b/i.test(whyNoWeight) && !/\bage\b/i.test(whyNoWeight),
  `a document whose gender IS published names body weight instead: "${whyNoWeight}"`);
const old = { ...mapless }; delete old.connections; old.profile = { name: 'Autumn' };
const whyOld = why(old);
ok(/gender/i.test(whyOld) && /body weight/i.test(whyOld) && !/\bage\b/i.test(whyOld),
  `a document too old to say which names both, still not age: "${whyOld}"`);

/* ---- 1. filling in Body details republishes — no workout needed ---- */
const before = cloud.publishes;
await store.saveProfile({ gender: 'female' });
await wait(3000);                                   // schedulePublish's 2.5 s debounce
const after = cloud.shared.get('friends');
ok(cloud.publishes > before, `saving her gender republished (${cloud.publishes - before} write(s))`);
ok(after && after.strength && after.strength.muscles.length > 0 && after.profile.gender === 'female',
  `…and her friends now read a map (${after && after.strength ? after.strength.muscles.length : 0} muscles)`);

/* ---- 2. the boot heal repairs a mapless document the owner can now fill ---- */
// The state an account is in if the gender landed WITHOUT a publish (another
// device, or a build before this fix): gender saved, document still mapless,
// and no workout newer than the document.
cloud.shared.set('friends', { ...mapless, publishedAt: new Date(Date.now() + 60_000).toISOString() });
const beforeHeal = cloud.publishes;
const healed = await social.healStalePublish();
const afterHeal = cloud.shared.get('friends');
ok(healed === true && cloud.publishes > beforeHeal, 'the boot heal republishes a mapless document once a map can be built');
ok(afterHeal && afterHeal.strength && afterHeal.strength.muscles.length > 0, 'and the map is back');
const again = await social.healStalePublish();
ok(again === false, 'and with the map published it does nothing the next boot (no write loop)');

// The vacuity guard: a mapless document whose owner STILL cannot publish one
// is left alone — the heal must not rewrite on every boot.
await social.publish();
ok(cloud.shared.get('friends').strength.muscles.length > 0, '(set-up: her map is published)');
const beforeClear = cloud.publishes;
await store.saveProfile({ gender: null });
await wait(3000);
const noGenderDoc = cloud.shared.get('friends');
ok(cloud.publishes > beforeClear && noGenderDoc && noGenderDoc.strength.muscles.length === 0,
  'clearing the gender republishes too, and the map comes down (an assumed map is never shared)');
const n0 = cloud.publishes;
ok(await social.healStalePublish() === false && cloud.publishes === n0,
  'and the heal leaves it alone: nothing to repair while the gender is still missing');

void auth;
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
