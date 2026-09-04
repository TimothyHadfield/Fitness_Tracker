// Social — who may see an account, and the projection builder.
//
// ⚠️ THIS FILE USED TO BE ABOUT TIERS. It is about two audiences now — see
// "PRIVATE OR PUBLIC" below, 2026-09-03. The tier reasoning is kept where it
// still explains something and is marked as history where it does not.
//
// docs/social-plan.md, Phase 1. Tim, 2026-08-17. NOTHING in this file is wired
// to a screen yet: it is the security half of the feature, built first and on
// purpose, because getting it wrong before a UI exists is far cheaper than
// after.
//
// ── WHY THIS FILE EXISTS AT ALL ──────────────────────────────────────────────
//
// Data is stored as ONE DOCUMENT PER COLLECTION — users/{uid}/collections/
// sessions holds every session ever recorded, as a single `rows` list — and
// Firestore grants permission PER DOCUMENT. There is no field-level read rule
// and no row-level one.
//
// So "let Alex see some of my workouts" is not a permission that can be
// written. Granting Alex read on that document would grant every session, every
// weight and every date, forever, including the parts deliberately not shared.
// Building it that way would leave the visibility settings enforced only by the
// UI, which is not enforcement at all.
//
// ⚠️ THEREFORE (D24, proposed): SHARING PUBLISHES A DERIVED COPY. It never
// widens a permission on the source. The private collections stay owner-only
// exactly as they are today; this file computes a new document containing only
// what was chosen, and that is what other people read.
//
// Two consequences worth keeping in mind while editing:
//
//   1. What goes IN is decided here, at write time. Who may READ it is decided
//      in firestore.rules. They are independent gates, and a mistake in either
//      one is contained by the other. Do not collapse them.
//   2. A projection is BUILT BY WHITELIST, never by deleting fields from a copy
//      of the private row. Deletion fails open: add a field to a session next
//      year and a delete-based builder publishes it. A whitelist fails closed —
//      the new field is simply absent until somebody names it here.
//
// ── PRIVATE OR PUBLIC — 🚨 THE MODEL CHANGED ON 2026-09-03 ───────────────────
//
// Tim: *"you can either make your account private so only friends you accept
// can see, or public so anyone on the app that finds your account can see all
// details."* Asked directly whether the per-person levels should go with it, he
// said yes: **account-level only**.
//
// ⚠️ WHAT WENT, AND IT WAS FOUR YEARS OF ARGUMENT IN THIS FILE: the tiers.
// `light` / `mid` / `full` — "just that I trained" / "my workouts" /
// "everything" — were Tim's own cut on 2026-08-17 and are recorded in
// docs/social-plan.md §3.3.1. They are gone. One person is not shown less than
// another; the account decides who may look at all. The reasoning is kept in
// the plan rather than deleted, because the shape it argued for is exactly the
// shape somebody would re-derive if this ever needs narrowing again.
//
// ⚠️ WHAT SURVIVED THE CHANGE, AND IT IS THE PART THAT MATTERS: sharing still
// publishes a DERIVED COPY and still never widens a permission on the source
// (D24, above). What used to be three documents cut by tier is now two cut by
// AUDIENCE:
//
//   friends — read by the uids in its own `viewers` list. Everything.
//   public  — read by anybody signed in, and only written while the account is
//             public. Everything EXCEPT body weight.
//
// 🚨 BODY WEIGHT IS THE ONE FIELD THE TWO DOCUMENTS DISAGREE ABOUT, and that is
// Tim's call too — asked which of the more personal fields should follow him
// into public, he picked the profile photo, the time of day he trains and the
// gym name, and left body weight out. It is the most personal number the app
// stores, it keeps its own opt-in switch, and it reaches accepted friends only.
// That is the whole reason there are two documents rather than one with a flag:
// a single document cannot be two different things to two readers.
//
// ⚠️ AND THE HONEST LIMIT OF THAT PROTECTION, WRITTEN DOWN SO NOBODY OVERCLAIMS
// IT: a reader who has the published sets AND a percentile can work backwards
// to an approximate body weight, because the strength standards are ratios to
// it and this project publishes its own formulas. Keeping the weigh-in series
// out of the public document means no exact number and no history of it; it is
// not a guarantee that nobody can estimate one. Say "not published", never
// "cannot be known".
//
// Pure: no DOM, no store, no clock of its own. Same reason as e1rm.js,
// set-types.js and next-workout.js — the whole point of this module is that it
// can be asserted headlessly, and a module that reaches for Date.now() or
// localStorage cannot be.

/* ------------------------------------------------------------------ *
 * Audiences and the account setting
 * ------------------------------------------------------------------ */

/** The two published documents. These strings are Firestore document ids. */
export const FRIENDS = 'friends';
export const PUBLIC = 'public';

/** Most-trusted first — see PROBE_ORDER, which is this list. */
export const AUDIENCES = [FRIENDS, PUBLIC];

/** The account setting. `private` is the default and the safe one. */
export const PRIVATE_ACCOUNT = 'private';
export const PUBLIC_ACCOUNT = 'public';

export const VISIBILITY_LABEL = {
  [PRIVATE_ACCOUNT]: 'Private',
  [PUBLIC_ACCOUNT]: 'Public',
};

/**
 * What the owner is told each choice means.
 *
 * ⚠️ IT NAMES WHAT IS SHARED RATHER THAN WHO IS EXCLUDED. "Private" that does
 * not say "your friends see everything" is a control the user cannot restate in
 * their own words, which is the test this file has always applied to a
 * visibility label.
 */
export const VISIBILITY_DETAIL = {
  [PRIVATE_ACCOUNT]:
    'Only friends you have accepted. They see everything: your workouts, benchmarks, muscle map, '
    + 'graphs and volume.',
  [PUBLIC_ACCOUNT]:
    'Anyone signed in who finds your account sees all of that too. Your body weight stays with '
    + 'accepted friends either way.',
};

/**
 * 🚨 THE DEFAULT IS PUBLIC — Tim, 2026-09-03, hours after the setting shipped
 * private-by-default: *"I think right now the default privacy for people is
 * private, but I would like the default to be public… for now it should
 * definently be public."*
 *
 * ⚠️ THIS REVERSES THE RULE THE REST OF THIS FILE IS BUILT ON, AND IT IS WORTH
 * BEING PLAIN ABOUT THAT. Everywhere else, an unrecognised or missing value
 * degrades to the NARROWEST reading — an unknown tier was never "at least
 * light", a graph with a hand-edited row never widened access. Here, absent now
 * means the WIDEST setting: an account that has never opened the sheet publishes
 * its training to anybody signed in who searches its name.
 *
 * That is a product decision and it is Tim's to make; it is not an accident, and
 * it must not be "tidied" back to private by somebody who reads the paragraph
 * above and assumes it was an oversight. What it costs is written down beside it
 * in progress.md. The plan he named for undoing it is the right one: ask on
 * first sign-in, so the answer is a choice rather than a default.
 *
 * ⚠️ ONLY THE EXACT STRING 'private' MEANS PRIVATE. Everything else — absent,
 * misspelled, a number, an object — is public, because it means "this account
 * has not said otherwise". The settings row is written by this app alone.
 */
export function normalizeVisibility(value) {
  return value === PRIVATE_ACCOUNT ? PRIVATE_ACCOUNT : PUBLIC_ACCOUNT;
}

export function isPublicAccount(value) {
  return normalizeVisibility(value) === PUBLIC_ACCOUNT;
}

export function isAudience(audience) {
  return AUDIENCES.includes(audience);
}

/* ------------------------------------------------------------------ *
 * Caps
 *
 * A projection is one Firestore document and documents stop at 1 MB. These are
 * not tuning knobs — a projection that silently grows past the limit stops
 * publishing, which presents as "my friend's page stopped updating" and is
 * miserable to diagnose. Cap here, deliberately, and say what was dropped.
 * ------------------------------------------------------------------ */

export const MAX_VIEWERS = 500;
export const MAX_ACTIVITY = 60;
export const MAX_BENCHMARKS = 200;
/**
 * The friends list carried IN the document (`doc.connections`) — see "A PROFILE
 * AS ITS OWNER SEES IT" below.
 *
 * ⚠️ A RUNAWAY GUARD, NOT A PRODUCT LIMIT, exactly like the three above: two
 * short strings per row means a thousand rows is tens of KB against a 1 MB
 * ceiling shared with sixty sessions and a photo. It is the same number as
 * MAX_VIEWERS on purpose — the two lists are the same people — so a friend who
 * is inside the read grant is not silently outside the rendered list.
 */
export const MAX_CONNECTIONS = 500;

/* ------------------------------------------------------------------ *
 * The profile photo (2026-08-31)
 *
 * Tim: *"when you put a profile picture into your account, your friends can't
 * see the profile picture… its just the default blank humanoid, not the picture
 * that they actually added."* True, and it was deliberate until now —
 * views-account.js said so in as many words: *"Local-only for now: the avatar is
 * NOT published into the social projection… publishing a face is a widening that
 * gets its own decision, not a side effect of this feature."* This is that
 * decision, made by the person whose face it is.
 *
 * ⚠️ IT SITS BESIDE THE NAME, AT EVERY TIER, and that is the argument for where
 * it goes: `profile` is IDENTITY, and the tiers cut TRAINING. Somebody on "just
 * that I trained" already sees the name you chose — a picture is the same kind
 * of fact about the same person, and splitting them would mean a friend seeing
 * your workouts but not your face, which is not a distinction anybody asked for.
 * Nothing here changes who may READ the document: that is the viewers list and
 * firestore.rules, untouched.
 *
 * 🚨 AND THIS IS A TRUST BOUNDARY IN BOTH DIRECTIONS. Going out, it is one of
 * this app's few big strings and the document has a 1 MiB ceiling shared with 60
 * activity entries. Coming in, it is a string another account wrote that this
 * app is about to put in an `src`. So it is validated as a base64 data URL of a
 * RASTER image and nothing else — never `image/svg+xml`, which is a document
 * that can carry script rather than a picture, and never a remote URL, which
 * would let somebody else's document make this device fetch a URL of their
 * choosing and log the request. Both ends call `safeAvatar`.
 * ------------------------------------------------------------------ */

/**
 * ⚠️ ~90 KB of image. The photo is written at 256px and quality 0.78, which is
 * tens of KB for a real photograph — this is a ceiling for something that has
 * gone wrong, not a target. Over it, the projection carries NO avatar rather
 * than a document that might stop publishing: a friend seeing the default face
 * is a disappointment, and a friend whose page silently stopped updating is a
 * bug nobody can diagnose (which is what the caps above exist to prevent).
 */
export const MAX_AVATAR_CHARS = 120000;

const AVATAR_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** The string if it is a picture this app is willing to publish or paint, else null. */
export function safeAvatar(value) {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_CHARS) return null;
  return AVATAR_URL.test(value) ? value : null;
}

/* ------------------------------------------------------------------ *
 * A PROFILE AS ITS OWNER SEES IT (2026-09-16)
 *
 * Tim asked that a friend's page show what he sees on his own: the photo, the
 * counts, the core lifts, the training history, and *"the 'your body' details,
 * but leave out the weight (only show gendar and age)"* — plus being able to
 * open a friend's friends list and walk on from there.
 *
 * None of that was possible to render, because none of it was in the document.
 * So exactly three things join the projection and nothing else:
 * `profile.gender`, `profile.age` and `connections`.
 *
 * ── WHY GENDER AND AGE SIT UNDER `profile` ──────────────────────────────────
 *
 * Same argument the photo won on 2026-08-31: `profile` is IDENTITY, and the
 * audiences cut TRAINING. A reader who has the name and the face is not a
 * different reader from the one who has "male, 34". Splitting them would mean a
 * friend seeing your whole training history but not the two facts the body map
 * is already ranked against — and the map's `defaultCompare` has encoded the
 * owner's sex since the grid shipped, so the sex was in the document already,
 * spelled as a comparison key rather than as a word.
 *
 * 🚨 BODY WEIGHT IS NOT ONE OF THE THREE AND MUST NEVER BECOME ONE. It keeps
 * its own opt-in switch and reaches accepted friends only; that is Tim's own
 * instruction here, in the same sentence that asked for the other two. The
 * standing warning at the top of this file still applies unchanged: published
 * sets plus a percentile can be worked backwards to an approximation, so say
 * "not published", never "cannot be known".
 *
 * ── WHY THE FRIENDS LIST GOES IN BOTH DOCUMENTS, WHICH IS A DECISION ────────
 *
 * 🚨 AN ACCOUNT'S FRIENDS LIST BECOMES READABLE BY EVERYONE WHO CAN READ THAT
 * ACCOUNT — which on a public account is ANYBODY SIGNED IN. That follows D29
 * (public means anybody signed in sees what friends see) and it is deliberate,
 * because "open their friends list and walk on from there" is the feature Tim
 * asked for and a public account that hid its list would simply be a dead end
 * on a page that says it shows everything.
 *
 * ⚠️ BUT IT IS A WIDENING OF WHAT "EVERYTHING" CONTAINS, and that is worth being
 * able to find later. Until now the two documents held one person's own facts;
 * this is the first field that names OTHER PEOPLE — a stranger reading a public
 * account learns a set of names and uids that person is connected to, and the
 * social graph is a different kind of fact from a bench press. Nobody is added
 * to a grant by it (`viewers` is untouched, and the rules read `viewers` and
 * `isPublic` and nothing else), and every uid in it was already reachable by
 * name through the directory. If that trade is ever regretted, the narrow
 * version is one line: build `connections` only when `!forPublic`, and the
 * reader already has to handle its absence for pre-change documents.
 *
 * ⚠️ NO AVATARS AND NO `since` IN THE ROWS. A face is read from that person's
 * OWN published document, which is how every other screen in the app draws one
 * (ui.js personFace) and which keeps ~90 KB per friend out of a 1 MB ceiling —
 * a fifty-friend list carrying faces is a document that stops publishing. And
 * `since` is a date about a relationship the reader is not part of; nothing
 * asked for it, so it is not published.
 * ------------------------------------------------------------------ */

/**
 * `'male'` | `'female'`, or null for anything else.
 *
 * ⚠️ THE EXACT TWO STRINGS AND NOTHING ELSE — the same shape the standards
 * tables use, and the same fail-closed reading the rest of this file applies:
 * an unrecognised, hand-edited or absent value is UNKNOWN rather than guessed.
 * Nothing here is a claim about what a person is; it is a claim about what this
 * app was told, and being told nothing has to publish nothing.
 */
export function safeGender(value) {
  return value === 'male' || value === 'female' ? value : null;
}

/**
 * A whole number of years, or null.
 *
 * 🚨 THE AGE IS PUBLISHED, NEVER THE BIRTH YEAR, and that is the decision worth
 * reading twice. store.getProfile() computes age from `birthYear` on EVERY read
 * for exactly this reason — a stored age goes stale in silence, which is the
 * comment ageFromBirthYear() carries in store.js — and a birth year is the more
 * identifying of the two: it is a fixed fact that joins across data sets, where
 * an age is a number that is true for a year.
 *
 * ⚠️ AND THE HONEST COST, WHICH IS THE DELIBERATE TRADE: this figure is computed
 * once, at publish time, and then sits in the document until the next
 * republish. So it goes STALE BY UP TO A YEAR — a friend can read 33 for
 * somebody who turned 34 last week, and nothing on either device notices. It is
 * accepted rather than solved because the alternative is publishing the birth
 * year and having the reader do the arithmetic, which trades a year of drift
 * for a permanently more identifying field. The document already carries
 * `publishedAt`, so a reader who cares how old the figure is can see it; and in
 * practice a republish follows every workout (schedulePublish), so an account
 * that is being used at all refreshes this within days.
 *
 * The bounds match ageFromBirthYear(): under 5 or over 120 is a typo or a
 * hand-edited row, not a person, and a nonsense age on somebody else's screen
 * is worse than no age at all.
 *
 * ⚠️ A NUMBER, NOT ANYTHING THAT LOOKS LIKE ONE — `num()` further down this file
 * is strict for the same reason and so is safeAvatar. `Number('34')` is 34 and
 * `Number('')` is 0, so coercing here would publish an age of zero-rounded-up
 * for an empty settings field; the only writer is arithmetic
 * (ageFromBirthYear), so a non-number means something is wrong rather than
 * something needs converting.
 */
export function safeAge(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const age = Math.round(value);
  return age >= 5 && age <= 120 ? age : null;
}

/* ------------------------------------------------------------------ *
 * The connection graph — owner-private
 *
 * Lives at users/{uid}/social/graph and is readable by NOBODY but the owner.
 * The list of who may read a projection is not kept here; it is kept inside the
 * projection itself, so the rule can check it without a second document read.
 * See docs/social-plan.md §3.2.
 * ------------------------------------------------------------------ */

export function normalizeGraph(graph) {
  const g = graph && typeof graph === 'object' ? graph : {};
  const seen = new Set();
  const connections = [];
  for (const c of Array.isArray(g.connections) ? g.connections : []) {
    if (!c || typeof c.uid !== 'string' || !c.uid || seen.has(c.uid)) continue;
    seen.add(c.uid);
    connections.push({
      uid: c.uid,
      name: typeof c.name === 'string' ? c.name : '',
      // ⚠️ `tier` IS DELIBERATELY DROPPED HERE (2026-09-03) rather than carried
      // through. Every graph written before that date has one, and a key that no
      // longer decides anything is worse than an absent one: the next reader
      // finds it, believes it, and writes a screen that quietly disagrees with
      // what is actually published. A connection is a connection now.
      since: typeof c.since === 'string' ? c.since : null,
    });
  }
  /* ⚠️ `pending` IS PART OF THE GRAPH SINCE 2026-08-29 — who I have ASKED to
   * connect, which is not the same as who I am connected to and must never be
   * confused with it.
   *
   * It exists because acceptance needs no write into my account: when they
   * accept, they add me to their graph and republish, which makes their shared
   * document readable to me under the rule that has existed since 2026-08-18.
   * So my client learns I was accepted by an EXISTING read succeeding — and
   * this list is what tells it whose reads are worth attempting. Without it,
   * "probe everyone" would be the alternative, and there is no list of everyone.
   *
   * ⚠️ It also closes the obvious hole in a reverse-tombstone design: because
   * my client only ever acts on people *I* asked, nobody can get themselves
   * added to my friends list by writing something into my account. */
  const pending = [];
  const pseen = new Set();
  for (const p of Array.isArray(g.pending) ? g.pending : []) {
    if (!p || typeof p.uid !== 'string' || !p.uid || pseen.has(p.uid)) continue;
    // Somebody who is already a connection is not pending, whatever the stored
    // list says — a half-finished accept must resolve toward the connection.
    if (seen.has(p.uid)) continue;
    pseen.add(p.uid);
    pending.push({
      uid: p.uid,
      name: typeof p.name === 'string' ? p.name : '',
      at: typeof p.at === 'string' ? p.at : null,
    });
  }
  return { connections, pending };
}

/** Is this person an accepted friend? Anyone not connected is not. */
export function isConnected(graph, uid) {
  return normalizeGraph(graph).connections.some((c) => c.uid === uid);
}

/**
 * Who may read the `friends` document — every accepted connection.
 *
 * ⚠️ ONE LIST NOW, WHERE THERE WERE THREE. Under the tiers a viewer appeared in
 * exactly one document's `viewers` and was never told which, so a reader had to
 * probe. That is over: a friend is in this list or is not connected. The probe
 * survives in a much smaller form (PROBE_ORDER) because a reader still cannot
 * know whether they are reading as a friend or as a member of the public.
 */
export function allViewers(graph) {
  return normalizeGraph(graph).connections.map((c) => c.uid).slice(0, MAX_VIEWERS);
}

/**
 * The friends list as it is PUBLISHED — `[{ uid, name }]`, and nothing else.
 *
 * ⚠️ IT RE-WHITELISTS WHAT normalizeGraph() ALREADY NORMALISED, deliberately and
 * for the same reason `viewers` is de-duplicated inside buildProjection() even
 * though allViewers() did it first: this is the publish boundary, and a
 * projection is built by whitelist rather than trusted from its caller (the
 * second rule at the top of this file). A connection row grows a field next year
 * — `since` already exists, `tier` used to — and this function is what keeps it
 * out of somebody else's document without anybody having to remember.
 *
 * `name` may be `''`: that is what normalizeGraph() gives a connection stored
 * without one, and an empty name is a real state a reader has to render anyway.
 * The uid is what identifies the row and what a reader follows to open that
 * person's own document, so a row without one is dropped rather than published
 * as an unopenable name.
 */
export function projectConnections(connections) {
  const seen = new Set();
  const out = [];
  for (const c of Array.isArray(connections) ? connections : []) {
    if (!c || typeof c.uid !== 'string' || !c.uid || seen.has(c.uid)) continue;
    seen.add(c.uid);
    // The same 60-character cut the display name gets — a name in this list is
    // rendered exactly where a display name is, and one of them being trimmed
    // and the other not is how a row becomes a layout bug on a phone.
    out.push({ uid: c.uid, name: typeof c.name === 'string' ? c.name.trim().slice(0, 60) : '' });
    if (out.length >= MAX_CONNECTIONS) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Cloning
 * ------------------------------------------------------------------ */

/**
 * A deep copy containing only JSON-safe leaves.
 *
 * Used for whole objects the tier admits in full — a recorded set, with its
 * `minis` nested inside it. Anything that is not a string, finite number,
 * boolean, plain object or array is DROPPED rather than carried: undefined,
 * functions, class instances and NaN all vanish. Firestore would reject most of
 * them anyway, and a publish that throws is a publish that silently never
 * happens.
 */
function clone(value) {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(clone).filter((v) => v !== undefined);
  if (t === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const c = clone(v);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

/**
 * One recorded session, as a reader of either document sees it.
 *
 * ⚠️ THERE IS NO LONGER A `tier` ARGUMENT, and its absence is the change of
 * 2026-09-03. A session used to be published three different ways; both
 * audiences now get the whole thing — exercises, sets, reps, weights, the time
 * it started, where it was and what the owner wrote about it. The two documents
 * differ only in what is published ALONGSIDE the sessions (body weight), never
 * in how a session is rendered.
 *
 * Weights are published in POUNDS, which is how everything is stored
 * (units.js). The reader's own lbs/kg preference converts at display, so two
 * people with different unit settings see the same workout in their own units
 * and neither is converting a number that was already converted.
 */
export function projectSession(session) {
  if (!session) return null;
  const date = typeof session.date === 'string' ? session.date : null;
  if (!date) return null;

  const out = {
    id: typeof session.id === 'string' ? session.id : null,
    date,
    name: typeof session.workoutName === 'string' && session.workoutName
      ? session.workoutName
      : 'Workout',
  };

  // ── THE START TIME ────────────────────────────────────────────────────────
  //
  // Tim wants a Strava-shaped home feed — a friend's name, the date and the
  // time at the top of each card — and the projection had no time in it at all,
  // so the feed could not have shown one however the view was written.
  //
  // ⚠️ IT USED TO BE GATED AT MID, AND THE GATE IS GONE WITH THE TIERS. The
  // argument for keeping it off the lowest tier was that sixty start times are a
  // SCHEDULE — when a house is empty, where a person reliably is — and that the
  // lowest tier was the default everybody landed on without choosing it. Neither
  // half applies now: there is no low tier to default into, and the only
  // question left is whether a start time follows the account into public.
  //
  // 🚨 TIM WAS ASKED THAT DIRECTLY ON 2026-09-03 AND SAID YES — the time of day
  // and the gym name both go public with the rest. The schedule argument above
  // is not refuted by that answer, it is OVERRULED by the person whose schedule
  // it is, which is the only way this decision was ever going to be taken. It
  // is left standing because it is what somebody would need if they ever want a
  // public account that keeps its hours to itself.
  //
  // Rejected: publishing a bare 'HH:MM' clock string instead of the instant.
  // It would have been strictly less data and it is what the card renders — but
  // deriving it means reading the HOST TIME ZONE, and the header of this file
  // says why that is not allowed here: a module that reaches for the
  // environment cannot be asserted headlessly, and this one's whole value is
  // that what a person shares can be proved with no browser and no account. So
  // the instant is published verbatim and the conversion happens in the view.
  // ⚠️ The honest cost of that: a viewer in another time zone sees the instant
  // in THEIRS, so a friend abroad reads an evening session as a morning one.
  // Fine for the people Tim actually shares with, wrong for a general audience,
  // and the fix when it matters is to publish the owner's UTC offset alongside
  // — not to start guessing zones in here.
  //
  // ⚠️ MISSING IS MISSING. Sessions recorded before startedAt existed have no
  // instant at all, and neither does a row imported from an old backup. Those
  // publish NO key rather than null-or-a-guess: `new Date(undefined)` is an
  // Invalid Date whose toISOString() throws, and a builder that throws is a
  // publish that silently never happens (see clone()). The view then has one
  // case to handle instead of three.
  //
  // instantMillis() rather than Date.parse() — measured, not padding: every
  // writer in the app today stores a plain ISO string (views-session.js writes
  // `new Date().toISOString()` on start and again on save; demo.js the same),
  // so the string path is the only live one. It is routed through instantMillis
  // anyway because the one shipped bug this file has ever had was exactly this
  // — a stored instant arriving back from the SDK as a Timestamp object, where
  // Date.parse() is NaN — and because it makes the output canonical whatever
  // the input shape was.
  const startedMs = instantMillis(session.startedAt);
  // The range guard is not decoration: Number.isFinite is happy with 1e20 and
  // `new Date(1e20).toISOString()` throws RangeError. ±8.64e15 ms is the whole
  // representable range of a JS Date.
  if (Number.isFinite(startedMs) && Math.abs(startedMs) <= 8.64e15) {
    out.startedAt = new Date(startedMs).toISOString();
  }

  // ── DURATION, IN MINUTES ROUNDED TO FIVE — Tim, 2026-08-26 ────────────────
  //
  // The old note here said finishedAt is deliberately not published because
  // start plus finish hands over how long somebody was out of the house. Tim
  // asked for the session length on the feed card, so the claim NARROWS
  // rather than falls: what is published is minutes rounded to the nearest
  // five, beside startedAt — so a reader learns
  // "about 45 minutes", never the exact instant the gym was left. The
  // rounding is the concession the old argument keeps. finishedAt itself is
  // still never published, and the same sanity guards the estimate uses
  // apply: a draft left open overnight publishes NO duration rather than a
  // fourteen-hour one.
  const finishedMs = instantMillis(session.finishedAt);
  if (Number.isFinite(startedMs) && Number.isFinite(finishedMs)) {
    const mins = (finishedMs - startedMs) / 60000;
    if (mins >= 5 && mins <= 360) {
      out.minutes = Math.max(5, Math.round(mins / 5) * 5);
    }
  }

  // ── LOCATION ──────────────────────────────────────────────────────────────
  //
  // Open work 0m. Tim asked for Strava's "{date} at {time} · {place}" line.
  //
  // ⚠️ IT IS A HAND-TYPED LABEL, NEVER A COORDINATE, and that is the privacy
  // decision 0m said had to be taken first. The app has no geolocation: the
  // owner types "Gold's Gym" (or nothing) and chooses their own granularity,
  // so nothing more precise than what they wrote can ever leak. Publishing GPS
  // and reverse-geocoding it would have handed coordinates to a third party to
  // render a string the owner could just have typed.
  //
  // ⚠️ IT GOES PUBLIC WITH THE ACCOUNT — Tim's answer on 2026-09-03, given the
  // argument that a place plus a time describes where a person reliably is and
  // when. The label is still theirs to write or leave blank, which is the part
  // that makes an owner's answer to this question a real one.
  if (typeof session.location === 'string' && session.location.trim()) {
    out.location = session.location.trim().slice(0, 80);
  }

  // ── THE DESCRIPTION ───────────────────────────────────────────────────────
  //
  // social-plan.md §13 Step 2. One line the owner typed during the workout —
  // "how did it go" — shown under the title on the feed card.
  //
  // ⚠️ IT IS A SENTENCE A PERSON WROTE, which is the one field here that can
  // say anything at all: that a PR was hit, that a shoulder gave out, who was
  // there. Nothing filters it and nothing should — but it is worth knowing,
  // when an account goes public, that this is the field most likely to carry
  // something its author did not think of as public. The screen that turns
  // public on says so.
  //
  // ⚠️ NOT `entry.notes`. That is the per-exercise coaching note on a workout
  // template and it has never been published by this function; this is the
  // session-level `note`, and the two keys are kept distinct everywhere.
  //
  // Same fail-closed shape as location, deliberately identical line for line:
  // string-typed only, so a number or an object is dropped rather than coerced
  // into text nobody wrote; trimmed; capped; and ABSENT when blank, so the view
  // has one case rather than three. The 280 matches the runner's input cap —
  // enforced again here because a row can also arrive from an import or a
  // restored backup, neither of which went past that textarea.
  if (typeof session.note === 'string' && session.note.trim()) {
    out.note = session.note.trim().slice(0, 280);
  }

  out.entries = (Array.isArray(session.entries) ? session.entries : []).map((entry) => {
    const e = {
      exerciseId: typeof entry.exerciseId === 'string' ? entry.exerciseId : null,
      name: typeof entry.exerciseName === 'string' ? entry.exerciseName : 'Exercise',
      // Set types survive the trip. A superset published as two unrelated
      // exercises is the same flattening that docs/vision.md §1.5 was written
      // to complain about, and it would be a strange thing to fix in the app
      // and then undo on the one screen another person actually looks at.
      ...(entry.group == null ? {} : { group: clone(entry.group) }),
      ...(entry.setType ? { setType: String(entry.setType) } : {}),
      // Whole objects, copied — no field surgery inside a set, which is the
      // entire reason this tier cut was chosen. `minis` come across with them.
      sets: (Array.isArray(entry.sets) ? entry.sets : []).map(projectSet),
    };
    return e;
  });

  return out;
}

/**
 * One recorded set.
 *
 * The only thing done to it is normalising the legacy `drops` key to `minis`,
 * so a reader has exactly one shape to render rather than two. That rename
 * already happened in the app (set-types.js); doing it again here means a
 * record written during the few hours when `drops` was the only key does not
 * export a list that claims to be drops when it is a myo-rep's match sets.
 */
function projectSet(set) {
  const s = clone(set && typeof set === 'object' ? set : {}) || {};
  if (Array.isArray(s.drops)) {
    if (!Array.isArray(s.minis)) s.minis = s.drops;
    delete s.drops;
  }
  return s;
}

/* ------------------------------------------------------------------ *
 * The projection
 * ------------------------------------------------------------------ */

/**
 * Everything one audience reads, as the document written to
 * users/{uid}/shared/{audience}.
 *
 * Every input is passed in. This function reads nothing and knows no clock —
 * `publishedAt` is an argument — so the whole of what a person shares can be
 * asserted in a headless test with no emulator, no browser and no account.
 *
 * @param {object}   o
 * @param {string}   o.audience      'friends' | 'public'
 * @param {string[]} o.viewers       uids allowed to read this document (friends only)
 * @param {object}   o.profile       { name, avatar, gender, age } — NEVER the email address
 * @param {object[]} o.connections   normalizeGraph(graph).connections — published as {uid, name}
 * @param {object[]} o.sessions      private session rows
 * @param {object[]} o.benchmarks    private benchmark rows
 * @param {object}   o.strength      the muscle map — see buildStrengthShare()
 * @param {object[]} o.bodyWeights   private body-weight rows  (friends AND opted in)
 * @param {boolean}  o.shareBodyWeight
 * @param {string}   o.publishedAt   ISO instant, passed in
 */
export function buildProjection({
  audience,
  viewers = [],
  profile = {},
  connections = [],
  sessions = [],
  benchmarks = [],
  strength = null,
  bodyWeights = [],
  shareBodyWeight = false,
  publishedAt = null,
} = {}) {
  if (!isAudience(audience)) throw new Error(`Not an audience: ${audience}`);
  const forPublic = audience === PUBLIC;

  const doc = {
    audience,
    // 🚨 THE FLAG THE RULES READ. firestore.rules grants a read on this document
    // to any signed-in caller when it is true, so it is the one field in this
    // file that is itself a permission. It is derived from the audience rather
    // than passed in for exactly that reason — a caller cannot hand
    // `isPublic: true` to the friends document.
    isPublic: forPublic,
    // ⚠️ The public document carries an EMPTY viewers list rather than no key.
    // The rules check `viewers is list` before indexing it, and a missing key
    // would make every friends-path rule evaluation on it an error rather than
    // a clean false.
    viewers: forPublic
      ? []
      : [...new Set(viewers.filter((v) => typeof v === 'string' && v))].slice(0, MAX_VIEWERS),
    // The shared identity is a name the user typed. Never the email address,
    // which is the only other identifier the app holds for a person and is
    // exactly the thing not to broadcast (docs/social-plan.md §3.5).
    profile: {
      name: typeof profile.name === 'string' ? profile.name.trim().slice(0, 60) : '',
      // Absent rather than null when there is no photo, or when the one on this
      // account is not something this app will publish — `profile.avatar` being
      // missing is what every reader already handles, and it is the state most
      // accounts are in.
      ...(safeAvatar(profile.avatar) ? { avatar: safeAvatar(profile.avatar) } : {}),
      // ⚠️ THE TWO "YOUR BODY" DETAILS THAT TRAVEL, and they are absent rather
      // than null when unknown — the same shape as the avatar directly above,
      // for the same reason: most accounts have never opened the profile sheet,
      // and a reader that already skips a missing key needs no second case for
      // a present-but-null one. See "A PROFILE AS ITS OWNER SEES IT" above for
      // why they sit here, and safeAge() for the staleness this accepts.
      ...(safeGender(profile.gender) ? { gender: safeGender(profile.gender) } : {}),
      ...(safeAge(profile.age) === null ? {} : { age: safeAge(profile.age) }),
    },
    publishedAt: typeof publishedAt === 'string' ? publishedAt : null,
    activity: [],
  };

  // 🚨 IN BOTH DOCUMENTS — the decision, and the argument for and against it, is
  // written out in full under "WHY THE FRIENDS LIST GOES IN BOTH DOCUMENTS"
  // above. In one line: a public account's friends list is readable by anybody
  // signed in, that follows D29, and it is a widening of what "everything"
  // means rather than a consequence of something already decided.
  //
  // ⚠️ `[]` FOR SOMEBODY WITH NO FRIENDS, never an absent key, and that is the
  // half of the contract a reader depends on: a MISSING `connections` means "not
  // published yet" (every document written before today) and an EMPTY one means
  // "nobody". Collapsing those two would put "no friends" on the screen of every
  // account that simply has not republished — the same shape of bug as the
  // 2026-08-28 incident where nothing was lost and nothing had been re-shared.
  doc.connections = projectConnections(connections);

  const dated = [...(Array.isArray(sessions) ? sessions : [])]
    .filter((s) => s && typeof s.date === 'string')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ACTIVITY);
  doc.activity = dated.map((s) => projectSession(s)).filter(Boolean);

  doc.benchmarks = (Array.isArray(benchmarks) ? benchmarks : [])
    .filter((b) => b && typeof b.date === 'string')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_BENCHMARKS)
    .map((b) => ({
      date: b.date,
      exerciseId: typeof b.exerciseId === 'string' ? b.exerciseId : null,
      name: typeof b.exerciseName === 'string' ? b.exerciseName : 'Exercise',
      values: clone(b.values || {}),
    }));

  doc.strength = projectStrength(strength);

  // ⚠️ BODY WEIGHT IS THE ONE THING THE TWO DOCUMENTS DISAGREE ABOUT, and it is
  // off even for friends unless the owner turned it on separately. It is the
  // most personal number the app stores and it is not what anybody means by "how
  // strong I am" — it sits in this bucket only because the strength maths needs
  // it. Letting an accident of the schema decide a privacy question is how this
  // sort of thing goes wrong. See docs/social-plan.md §3.3.1.
  //
  // 🚨 `!forPublic` IS THE GATE TIM CHOSE ON 2026-09-03 and it is enforced here,
  // in the builder, rather than left to the caller — assertAudienceClean below
  // then refuses the document anyway if this line is ever edited wrong.
  if (shareBodyWeight && !forPublic) {
    doc.bodyWeight = (Array.isArray(bodyWeights) ? bodyWeights : [])
      .filter((r) => r && typeof r.date === 'string' && Number.isFinite(r.weight))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date, weight: r.weight }));
  }

  // Defence in depth. Everything above is a whitelist and should already be
  // correct; this refuses to hand back a document that is not, so a mistake
  // becomes a thrown error at the publish site instead of a leak on somebody
  // else's screen. It costs one walk of a small object.
  assertAudienceClean(doc, audience);
  return doc;
}

/* ------------------------------------------------------------------ *
 * The muscle map, as somebody else reads it
 *
 * 🚨 THIS IS WHAT MADE A FRIEND'S BODY MAP TAPPABLE (2026-09-03). Tim: *"I also
 * want a friend to be able to see another user's body, their graphs, volume,
 * etc. as well as click on any muscle group like that own user can on
 * themselves and pull details from it."*
 *
 * The old projection published `[{ muscle, level, percentile, confidence }]` and
 * said so in as many words: "Level and percentile only — not the estimated
 * weight behind them… data nobody needs is data that only has downside." That
 * was right while a friend's map was a picture. It is not enough for a panel,
 * which names the estimate, what the next level costs, how well corroborated the
 * reading is and which recorded sets it came from.
 *
 * ⚠️ AND THE GRID IS THE PART WORTH UNDERSTANDING. Tim asked that a viewer be
 * able to use *"any comparison combination that is already available"* on
 * somebody else's body — men, women, everyone, any body weight, any age. A
 * percentile is a ratio to the person's own body weight and age, so recomputing
 * one on the viewer's device would mean publishing both. Instead the OWNER
 * computes every combination the app offers, on their own device where those
 * numbers already are, and publishes the answers: `grid[comboKey][muscle]`.
 *
 * The reader picks a combination and reads it off. Nobody's body weight is in
 * the document, the viewer can still ask every question the sheet offers, and
 * the arithmetic that produced both people's numbers is the same code.
 * ------------------------------------------------------------------ */

/** 13 rateable muscles today; the cap is a runaway guard, not a limit. */
export const MAX_SHARED_MUSCLES = 40;
/** pool(2) × sex(3) × weight(2) × age(2) = 24 today. */
export const MAX_SHARED_COMBOS = 60;
/** The panel names at most three contributing sets — muscle-evidence.js decides. */
export const MAX_SHARED_CONTRIBUTORS = 3;

function num(v) {
  return Number.isFinite(v) ? v : null;
}

function str(v, max = 60) {
  return typeof v === 'string' ? v.slice(0, max) : null;
}

/**
 * Whitelist the muscle map. Same discipline as everything else in this file: a
 * field invented next year is absent from a friend's screen until somebody
 * names it here, rather than published because nobody thought about it.
 */
export function projectStrength(strength) {
  const s = strength && typeof strength === 'object' && !Array.isArray(strength) ? strength : {};

  const muscles = (Array.isArray(s.muscles) ? s.muscles : [])
    .filter((m) => m && typeof m.muscle === 'string')
    .slice(0, MAX_SHARED_MUSCLES)
    .map((m) => ({
      muscle: m.muscle,
      lift: str(m.lift),
      estimate: num(m.estimate),
      confidence: num(m.confidence),
      band: str(m.band, 24),
      basis: str(m.basis, 24),
      contributorCount: num(m.contributorCount),
      exerciseCount: num(m.exerciseCount),
      // ⚠️ Rule 5 travels with the number. These name the real recorded sets the
      // estimate was converted FROM, which is the only thing that lets a reader
      // tell "195 lb bench" from "195 lb inferred off a dumbbell press". A panel
      // that showed the estimate without them would be an inference dressed as a
      // measurement on somebody else's screen.
      contributors: (Array.isArray(m.contributors) ? m.contributors : [])
        .slice(0, MAX_SHARED_CONTRIBUTORS)
        .map((c) => ({
          exerciseName: str(c && c.exerciseName, 80),
          weight: num(c && c.weight),
          reps: num(c && c.reps),
          date: str(c && c.date, 10),
          loadType: str(c && c.loadType, 16),
          source: str(c && c.source, 16),
        })),
      hint: str(m.hint, 200),
      confident: m.confident === true,
    }));

  const grid = {};
  let combos = 0;
  for (const [key, byMuscle] of Object.entries(s.grid && typeof s.grid === 'object' ? s.grid : {})) {
    if (combos >= MAX_SHARED_COMBOS) break;
    if (!byMuscle || typeof byMuscle !== 'object') continue;
    const row = {};
    for (const [muscle, pair] of Object.entries(byMuscle)) {
      if (!Array.isArray(pair)) continue;
      // [percentile, weight to the next level]. A pair rather than an object
      // because there are 24 of these per muscle and the document has a ceiling.
      row[muscle] = [num(pair[0]), num(pair[1])];
    }
    grid[String(key).slice(0, 40)] = row;
    combos++;
  }

  return {
    muscles,
    grid,
    // Which combination is THEIR "like me" — the one their own screen opens on.
    // ⚠️ It encodes their sex, which is the only thing about their body this
    // document carries, and it is here because the alternative is a viewer's
    // "Like me" silently meaning "like ME" on somebody else's body.
    defaultCompare: str(s.defaultCompare, 40),
  };
}

/* ------------------------------------------------------------------ *
 * The guard
 * ------------------------------------------------------------------ */

/** Every {path, value} leaf under an object, depth-first. */
export function leaves(value, path = '') {
  if (value === null || typeof value !== 'object') return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

/**
 * The complete set of top-level keys a published document may carry.
 *
 * ⚠️ Adding a name here WIDENS what a reader gets. It fails closed: a key this
 * list does not know about throws at the publish site rather than appearing on
 * somebody's screen.
 */
const DOC_FIELDS = new Set([
  'audience', 'isPublic', 'viewers', 'profile', 'publishedAt',
  'activity', 'benchmarks', 'strength', 'bodyWeight',
  // 2026-09-16, and the widest of the three additions: the friends list. Both
  // documents carry it — see the header above buildProjection's caller notes.
  'connections',
]);

/**
 * The complete set of keys `profile` may carry.
 *
 * ⚠️ THIS LIST IS NEW ON 2026-09-16 AND IT IS THE POINT OF THE CHANGE TO THIS
 * GUARD. `profile` used to hold a name and a photo and the guard never looked
 * inside it; it now holds two facts about a person's body, which makes it the
 * obvious place for a THIRD to arrive by accident — and the one that must never
 * arrive is the body weight, which is sitting in the same store row that gender
 * and age are read from (store.getProfile() returns `bodyWeight` beside them).
 * A new field is absent from a friend's screen until somebody names it HERE,
 * which is the same fail-closed rule DOC_FIELDS applies one level up.
 *
 * The email address is the other thing this catches, and it is the field
 * docs/social-plan.md §3.5 names by hand: the builder already drops it, and now
 * the guard refuses a document carrying it however it got there.
 */
const PROFILE_FIELDS = new Set(['name', 'avatar', 'gender', 'age']);

/** What the PUBLIC document may never hold, whatever the builder did. */
const PRIVATE_TO_FRIENDS = ['bodyWeight'];

/**
 * Throw if a published document holds something its audience may not have.
 *
 * ⚠️ THIS IS AN ABSENCE CHECK, NOT A SHAPE CHECK, and the difference is the
 * whole point. A test that lists the fields it expects to be missing passes
 * happily the day somebody adds a new field and forgets — which is exactly how
 * this kind of leak happens in practice. So: walk the finished document and
 * fail on anything that is not on the short list the audience may hold.
 *
 * ⚠️ IT LOST ITS BIGGEST JOB ON 2026-09-03 AND KEPT ITS SHAPE ON PURPOSE. Under
 * the tiers it walked every leaf below a session, because `light` was allowed no
 * number from inside a workout at all and a leak there would have been silent.
 * Both audiences now get the whole session, so that walk has nothing left to
 * find — and the guard is still here, still fail-closed, because the ONE
 * remaining difference between the two documents (body weight) is exactly the
 * kind of difference an edit six months from now will quietly undo.
 */
export function assertAudienceClean(doc, audience) {
  const bad = [];
  if (!isAudience(audience)) throw new Error(`Not an audience: ${audience}`);

  for (const key of Object.keys(doc || {})) {
    if (!DOC_FIELDS.has(key)) bad.push(`${key} is not a published field`);
  }

  /* ── THE THREE FIELDS ADDED ON 2026-09-16 ─────────────────────────────────
   *
   * ⚠️ THE GUARD IS EXTENDED RATHER THAN WORKED AROUND, and the difference
   * matters: the easy version of this change was to add three names to
   * DOC_FIELDS and stop. That would have taught the guard that the fields are
   * ALLOWED without teaching it what they may contain — and `connections` is a
   * list of objects, which is the first structure in this document that is
   * neither a session nor a number and therefore the first new place a private
   * number could ride along unnoticed. So each of the three is shape-checked
   * here, at the publish site, in the same fail-closed spirit as everything
   * above: a document that does not match is refused, not trimmed.
   *
   * 🚨 THIS DOES NOT LOOSEN ANYTHING. Every document the guard refused before
   * today it still refuses — body weight in the public document, a viewers list
   * on it, a friends document marked public, a top-level field nobody named. */
  const prof = doc && doc.profile;
  if (prof !== undefined) {
    if (prof === null || typeof prof !== 'object' || Array.isArray(prof)) {
      bad.push('profile is not an object');
    } else {
      for (const key of Object.keys(prof)) {
        if (!PROFILE_FIELDS.has(key)) bad.push(`profile.${key} is not a published field`);
      }
      // Absent when unknown, never null — the contract a reader was written
      // against, and the state most accounts are in.
      if ('gender' in prof && safeGender(prof.gender) === null) {
        bad.push('profile.gender is not "male" or "female"');
      }
      if ('age' in prof && (!Number.isInteger(prof.age) || safeAge(prof.age) !== prof.age)) {
        bad.push('profile.age is not a plausible whole number of years');
      }
    }
  }

  if (doc && doc.connections !== undefined) {
    if (!Array.isArray(doc.connections)) {
      bad.push('connections is not a list');
    } else if (doc.connections.length > MAX_CONNECTIONS) {
      // Uncapped, this is the field that quietly pushes a document past 1 MB,
      // and a document that stops publishing presents as a friend's page that
      // stopped updating — which is what every cap in this file exists to stop.
      bad.push(`connections holds more than ${MAX_CONNECTIONS} rows`);
    } else {
      for (const c of doc.connections) {
        if (!c || typeof c !== 'object' || Array.isArray(c)) {
          bad.push('a connection is not an object');
          continue;
        }
        // 🚨 {uid, name} AND NOTHING ELSE. A row carrying anything more is the
        // second route a private number would take into a public document, and
        // the whole reason this guard reads the rows rather than counting them.
        for (const key of Object.keys(c)) {
          if (key !== 'uid' && key !== 'name') bad.push(`connections[].${key} is not published`);
        }
        if (typeof c.uid !== 'string' || !c.uid) bad.push('a connection has no uid');
        if (typeof c.name !== 'string') bad.push('a connection name is not a string');
      }
    }
  }

  if (audience === PUBLIC) {
    for (const key of PRIVATE_TO_FRIENDS) {
      if (doc[key] !== undefined) bad.push(`${key} present in the public document`);
    }
    // A public document with a viewers list would be two access models on one
    // document, and the narrower one would be doing nothing.
    if (Array.isArray(doc.viewers) && doc.viewers.length) bad.push('public document has viewers');
    if (doc.isPublic !== true) bad.push('public document is not marked public');
  } else {
    // 🚨 The other direction, and it is the one that would actually hurt: a
    // friends document marked public is readable by everybody signed in, body
    // weight and all. The rules read `isPublic` and nothing else.
    if (doc.isPublic !== false) bad.push('friends document is marked public');
  }

  if (bad.length) {
    throw new Error(`Projection for "${audience}" leaks: ${bad.join(', ')}`);
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Invites
 *
 * There is no user directory in v1 and this is why. A searchable list of
 * accounts is an enumeration surface that has to be right the first time; an
 * invite link is a capability you hand to one person.
 *
 * Stored at users/{ownerUid}/invites/{token}, so the owner can list their own
 * and nobody can list anybody else's. The link carries both halves.
 * ------------------------------------------------------------------ */

export const INVITE_TTL_DAYS = 7;

const TOKEN_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/o/0/1

/**
 * A 26-character token — about 130 bits, which is not guessable.
 *
 * `randomBytes` is injected so this stays pure and testable. Callers pass
 * crypto.getRandomValues; the tests pass a counter and assert the mapping.
 */
export function newInviteToken(randomBytes) {
  const bytes = randomBytes(26);
  let out = '';
  for (let i = 0; i < 26; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

/**
 * Milliseconds since the epoch, from any of the shapes a stored instant
 * actually arrives in.
 *
 * ⚠️ THIS IS NOT DEFENSIVE PADDING — the shipped path needed it and did not
 * have it. store.js writes an invite's `expiresAt` as `new Date(...)`, so the
 * Firestore SDK hands it back as a **Timestamp object**, not a string.
 * `Date.parse(timestamp)` is NaN, and `NaN <= now` is FALSE — so the old
 * comparison called every expired invite `open`. Measured against the live
 * project on 2026-08-22: an invite three weeks past its expiry showed the
 * "Connect" screen, and the only thing that stopped the claim was
 * firestore.rules, which surfaced as a raw "Missing or insufficient
 * permissions." The one refusal message the plan says to get right — "that
 * link has expired" — could never be shown.
 *
 * The tests missed it because their fixture has no `expiresAt` at all, so they
 * only ever exercised the `inviteExpiry(createdAt)` fallback. *A pure module
 * has to be handed the shape the network really returns*, not a tidier one.
 *
 * Duck-typed rather than imported: this module has no SDK and must stay
 * assertable with no browser, no network and no emulator.
 */
export function instantMillis(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') return Date.parse(value);
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'object') return NaN;
  if (typeof value.toMillis === 'function') { try { return value.toMillis(); } catch (_) { return NaN; } }
  if (typeof value.toDate === 'function') {
    try { return value.toDate().getTime(); } catch (_) { return NaN; }
  }
  // A Timestamp that has been through JSON — the shape a cached or exported
  // document comes back as.
  if (Number.isFinite(value.seconds)) return value.seconds * 1000;
  if (Number.isFinite(value._seconds)) return value._seconds * 1000;
  return NaN;
}

export function inviteExpiry(createdAt, days = INVITE_TTL_DAYS) {
  const t = instantMillis(createdAt);
  if (!Number.isFinite(t)) return null;
  return new Date(t + days * 86400000).toISOString();
}

/**
 * Can this invite still be claimed, and if not, why not.
 *
 * Returns 'open' | 'claimed' | 'expired' | 'invalid'. The caller says the
 * different thing for each — "that link has already been used" and "that link
 * has expired" send somebody to two different next steps, and a single
 * "invalid link" sends them to neither.
 */
/**
 * The link that gets sent to somebody.
 *
 * Carries BOTH halves — the owner's uid and the token — because the invite
 * lives at users/{ownerUid}/invites/{token} and a token alone would need a
 * lookup across every account, which is exactly the enumeration this design
 * does not have. The uid in a link is not a secret: it identifies an account,
 * and reaching anything under it still requires the rules to say yes.
 */
export function inviteLink(baseUrl, ownerUid, token) {
  const base = String(baseUrl || '').split('#')[0];
  return `${base}#/invite/${encodeURIComponent(ownerUid)}/${encodeURIComponent(token)}`;
}

/** The other half — `#/invite/<ownerUid>/<token>` back into its two parts. */
export function parseInviteRoute(param) {
  const [ownerUid, token] = String(param || '').split('/');
  if (!ownerUid || !token) return null;
  return { ownerUid: decodeURIComponent(ownerUid), token: decodeURIComponent(token) };
}

/**
 * The order a reader tries somebody's documents in: friends first.
 *
 * ⚠️ IT IS TWO NOW, NOT THREE, and the reason for probing at all has changed
 * with it. Under the tiers a viewer was listed in exactly one document and was
 * never told which. Now the question is different and smaller: am I reading this
 * person as an accepted friend, or as a member of the public? Friends first,
 * because their document is the one with body weight in it — and because a
 * friend of a public account should not be silently downgraded to the stranger's
 * view. A refusal is not billed as a read.
 */
export const PROBE_ORDER = [FRIENDS, PUBLIC];

/* ------------------------------------------------------------------ *
 * 🚨 READING A FRIEND WHO HAS NOT MIGRATED YET — 2026-09-03
 *
 * Tim, within minutes of the change shipping: *"When I click on compare for my
 * muscle map, and click on one of my friends, it says: Nothing to compare yet."*
 *
 * ⚠️ THE CAUSE IS THE SHAPE OF THE MIGRATION ITSELF, and it was foreseeable.
 * Each account migrates ITS OWN documents, on ITS OWN device, the next time its
 * owner opens the app — because nobody's client may write into anybody else's
 * account (D24, and the whole of firestore.rules). So the moment one person
 * updates, every friend who has not yet opened the app is invisible to them:
 * their `shared/friends` does not exist, and the reader looks nowhere else.
 *
 * 🚨 THAT IS NOT A COMPARE-SCREEN BUG, IT IS EVERY SCREEN. Their feed cards,
 * their workouts, their benchmarks and their map all vanish at once — which is
 * exactly the shape of the 2026-08-28 incident where Autumn's published data
 * looked lost and had merely never been re-shared. **A friend disappearing from
 * the app is never an acceptable way to wait for a deploy to propagate.**
 *
 * So a reader falls back to the tier documents it can still read. What comes
 * back is honestly less: the old projection carried a LEVEL and a percentile per
 * muscle and deliberately nothing else, so their map can still be painted and
 * their workouts still open, while the panel's estimate, the sets behind it and
 * the 24 comparison groups simply are not in the document. **Every screen that
 * meets one says so rather than rendering an empty box.**
 *
 * ⚠️ THIS IS A READ PATH ONLY. Nothing writes a tier document ever again — the
 * rules refuse to create one — and the fallback disappears from a friend's
 * account the moment they open the app. Delete it when nobody is left on an old
 * build; it costs one extra read per unmigrated friend and nothing otherwise.
 * ------------------------------------------------------------------ */

export const LEGACY_AUDIENCES = ['full', 'mid', 'light'];

/**
 * The old per-muscle array, if this is an old document.
 *
 * ⚠️ IT IS NOT CONVERTED INTO THE NEW SHAPE, and that is deliberate. The new
 * shape's grid is keyed by comparison group, and the old percentiles were
 * computed under whatever group their owner had chosen at the time — which the
 * document does not record. Fabricating a key for them would put a number under
 * a label nobody checked, on a screen whose whole job is that the number and the
 * population it refers to cannot drift apart. So it stays a separate, clearly
 * poorer thing, and the views treat it as one.
 */
export function legacyLevels(doc) {
  const s = doc && doc.strength;
  if (!Array.isArray(s) || !s.length) return null;
  return s
    .filter((m) => m && typeof m.muscle === 'string' && typeof m.level === 'string')
    .map((m) => ({
      muscle: m.muscle,
      level: m.level,
      percentile: Number.isFinite(m.percentile) ? m.percentile : null,
      confidence: Number.isFinite(m.confidence) ? m.confidence : null,
    }));
}

export function inviteState(invite, nowISO) {
  if (!invite || typeof invite.token !== 'string' || !invite.token) return 'invalid';
  if (invite.claimedBy) return 'claimed';
  // A stored expiry wins; only a MISSING one falls back to deriving it from the
  // creation date. An expiry that is present but unreadable returns `invalid`
  // rather than quietly deriving a new one — the old code's silent widening is
  // what this whole function exists to prevent.
  const expires = instantMillis(
    invite.expiresAt == null ? inviteExpiry(invite.createdAt) : invite.expiresAt);
  const now = Date.parse(nowISO);
  // ⚠️ Both guards BEFORE the comparison, and that ordering is the bug.
  // `NaN <= now` is false, so an unreadable expiry compared directly reads as
  // "not expired" — the safest-looking line in the file failing open.
  if (!Number.isFinite(expires) || !Number.isFinite(now)) return 'invalid';
  return expires <= now ? 'expired' : 'open';
}

/* ------------------------------------------------------------------ *
 * Reactions — kudos and comments on a friend's published workouts
 * ------------------------------------------------------------------ *
 *
 * Open work 0l. The feed's kudos and comment buttons rendered from day one
 * and said plainly they were not connected, because a reaction has to be
 * written where the OTHER person can read it — and this app's model is that
 * nobody's client writes into anybody else's data.
 *
 * ⚠️ THE RESOLUTION IS A NARROW EXCEPTION, NOT A RETREAT FROM THE MODEL. A
 * reaction lives at users/{owner}/reactions/{id} — under the owner of the
 * workout it reacts to — and the rules allow an ACCEPTED FRIEND to CREATE one
 * there. What made a foreign write unacceptable everywhere
 *
 * 🚨 REACTING IS FRIENDS-ONLY, AND IT DID NOT FOLLOW THE ACCOUNT INTO PUBLIC
 * (2026-09-03). Tim asked that a public account be READABLE by anyone signed in;
 * letting anyone signed in also write into that account's reactions subtree is a
 * different feature — it is the moderation surface, and this project has no
 * moderation story (docs/social-plan.md §12.11 refuses the discovery feed on the
 * same grounds). So a stranger reads a public account and cannot leave anything
 * on it. Reversing that is one clause in firestore.rules and a decision, not an
 * oversight.
 *
 * else is that one document holds a whole collection, so a single bad write
 * replaces someone's training history. A reaction is one document per
 * reaction, create-only (no update path at all), shape-checked by the rules,
 * and lives in a subtree nothing else reads. The blast radius of the worst
 * possible write is one spurious kudos, which the owner can delete.
 *
 * These helpers are pure: id construction and grouping, assertable headlessly.
 * The I/O lives in firebase-backend.js; the policy lives in firestore.rules.
 */

export const KUDOS = 'kudos';
export const COMMENT = 'comment';
export const MAX_COMMENT_LENGTH = 500;

/**
 * One kudos per person per session, BY CONSTRUCTION: the document id is
 * deterministic, so giving kudos twice overwrites the first rather than
 * stacking, and taking it back is deleting a known id rather than searching.
 */
export function kudosId(sessionId, fromUid) {
  return `k_${sessionId}_${fromUid}`;
}

/** Comments stack, so their id carries a caller-supplied uniqueness suffix. */
export function commentId(sessionId, fromUid, nonce) {
  return `c_${sessionId}_${fromUid}_${nonce}`;
}

/**
 * What a comment is allowed to say. Returns the cleaned text, or throws the
 * sentence the screen should show. The rules enforce the same bounds on the
 * wire — two independent gates, same as the projection.
 */
export function cleanCommentText(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) throw new Error('Write something first.');
  if (t.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Keep it under ${MAX_COMMENT_LENGTH} characters.`);
  }
  return t;
}

/**
 * Raw reaction rows → per-session view state.
 *
 * Tolerant of garbage on purpose: these documents are the one place another
 * client writes, so a malformed row (wrong kind, missing sessionId) is
 * DROPPED rather than trusted to crash the feed. Comments come back oldest
 * first — a conversation reads downward.
 */
export function groupReactions(rows, myUid) {
  const bySession = new Map();
  const slot = (sid) => {
    if (!bySession.has(sid)) {
      bySession.set(sid, { kudos: [], myKudosId: null, comments: [] });
    }
    return bySession.get(sid);
  };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.sessionId !== 'string' || !r.sessionId) continue;
    if (typeof r.from !== 'string' || !r.from) continue;
    if (r.kind === KUDOS) {
      const s = slot(r.sessionId);
      // One kudos per person even if a hostile client stacked several docs.
      if (!s.kudos.includes(r.from)) s.kudos.push(r.from);
      if (myUid && r.from === myUid) s.myKudosId = r.id || kudosId(r.sessionId, myUid);
    } else if (r.kind === COMMENT) {
      if (typeof r.text !== 'string' || !r.text.trim()) continue;
      slot(r.sessionId).comments.push({
        id: r.id || null,
        from: r.from,
        fromName: typeof r.fromName === 'string' ? r.fromName : '',
        text: r.text,
        at: instantMillis(r.at),
        mine: Boolean(myUid && r.from === myUid),
      });
    }
  }
  for (const s of bySession.values()) {
    s.comments.sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  return bySession;
}

/* ── STALE PUBLISH DETECTION (2026-08-28) ────────────────────────────────────
 *
 * ⚠️ WHY THIS EXISTS: republish() was wired to every SOCIAL mutation and to
 * nothing else — social.publish() even carried the comment "after logging a
 * workout, say", and no workout ever called it. So every published copy froze
 * at its owner's last social action: Autumn connected with Tim, trained three
 * hours later, and her published muscle map stayed the empty pre-training
 * snapshot forever. Tim read that as her data being lost. It was not lost; it
 * was never re-shared.
 *
 * The fix is two-sided in store.js — publish after data mutations, and heal on
 * boot — and this is the boot half's brain, pure so it can be tested: is what
 * this account has PUBLISHED older than what it has RECORDED?
 *
 * ⚠️ `publishedAt` is the newest across the owner's existing tier documents,
 * or null when none exists. Null with connections present means "never
 * published at all", which is exactly as stale as stale gets.
 */
export function needsRepublish({ sessions, publishedAt }) {
  const pub = publishedAt ? Date.parse(publishedAt) : NaN;
  if (!Number.isFinite(pub)) return true;
  for (const s of sessions || []) {
    const made = Date.parse(s && s.createdAt ? s.createdAt : '');
    if (Number.isFinite(made) && made > pub) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Finding people by name — 🚨 THE PART THAT REVERSES A LOCKED DECISION
 *
 * ⚠️ READ THE INVITES HEADER ABOVE FIRST. It says, and said from the day this
 * file was written: *"There is no user directory in v1 and this is why. A
 * searchable list of accounts is an enumeration surface that has to be right
 * the first time; an invite link is a capability you hand to one person."*
 *
 * ⚠️ THAT SENTENCE IS NO LONGER TRUE OF THE APP, and it is left standing above
 * on purpose — it is the reasoning somebody will need if they ever want the
 * property back. What changed is Tim's instruction on 2026-08-29, given the
 * argument in full: *"Right now the website has less than 5 users so just do
 * the name search to keep it easy for now and then we can work on making a
 * different version eventually."*
 *
 * ⚠️ THE OBJECTION WAS NOT ANSWERED. It was accepted with its price named, and
 * the price is in firestore.rules above the `directory` block: Firestore rules
 * cannot constrain a query's `where` clause, so granting the `list` that name
 * search needs grants paginated enumeration of every row. There is no version
 * of free-text name search that does not. The narrowed design that keeps the
 * old invariant — exact lookup of a HANDLE, get-yes / list-no, nothing
 * enumerable — is what "a different version eventually" means, and
 * docs/social-plan.md §3.4 already blesses that shape.
 *
 * ⚠️ SO THE DIRECTORY ROW HOLDS THE MINIMUM THAT MAKES SEARCH WORK and nothing
 * else: a uid and a name the person chose to publish. Never an email (§3.5),
 * never a photo, never anything about their training. If a field is ever added
 * here, it is added to a document the whole signed-in world can enumerate.
 *
 * Pure, like the rest of this file: the matching is testable with no network.
 * ------------------------------------------------------------------ */

/** What gets stored for matching. Lower-case, collapsed whitespace, trimmed. */
export function searchKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Does this directory row match what was typed?
 *
 * ⚠️ MATCHED IN THE CLIENT, NOT IN THE QUERY, and that is not laziness. A
 * Firestore prefix query (`orderBy(nameLower).startAt(q).endAt(q + '\uf8ff')`)
 * only matches the START of the whole string, so searching "smith" would never
 * find "Anna Smith" — the one thing a person typing a surname expects. Since
 * the `list` permission that any such query needs already hands over every row
 * (see above), fetching the page and matching here costs nothing extra in
 * exposure and is strictly better at finding the right person.
 *
 * Matches a prefix of the whole name OR of any word in it, so "an" finds
 * "Anna Smith" and "sm" finds it too. Never a substring match inside a word:
 * "nn" finding "Anna" is the kind of result that makes a list of strangers
 * look like a list of matches.
 */
export function matchesSearch(row, query) {
  const q = searchKey(query);
  if (!q) return false;
  const name = searchKey(row && (row.nameLower || row.name));
  if (!name) return false;
  if (name.startsWith(q)) return true;
  return name.split(' ').some((word) => word.startsWith(q));
}

/**
 * Rank matches so the most likely person is first.
 *
 * Whole-name prefix beats word prefix beats everything else, then shorter
 * names first — "Sam" ranks above "Samantha Fitzgerald" for the query "sam",
 * because a shorter name containing the query is a closer match to it.
 */
export function rankMatches(rows, query) {
  const q = searchKey(query);
  return (rows || [])
    .filter((r) => matchesSearch(r, q))
    .map((r) => {
      const name = searchKey(r.nameLower || r.name);
      return { row: r, score: name.startsWith(q) ? 0 : 1, len: name.length };
    })
    .sort((a, b) => a.score - b.score
      || a.len - b.len
      || searchKey(a.row.name).localeCompare(searchKey(b.row.name)))
    .map((x) => x.row);
}

/**
 * ⚠️ A REQUEST IS ONLY EVER SHOWN TO ITS RECIPIENT, and this is what the
 * recipient's client renders. `from` is proven at the wire by the rules (the
 * document id IS the sender's uid and `from` must match it), so this does not
 * re-check identity — it checks SHAPE, because a row is still free text
 * somebody else wrote and it is about to be put on a screen.
 */
export function readableRequest(row) {
  if (!row || typeof row !== 'object') return null;
  const from = typeof row.from === 'string' ? row.from : (typeof row.id === 'string' ? row.id : '');
  const name = typeof row.name === 'string' ? row.name.trim().slice(0, 60) : '';
  if (!from || !name) return null;
  return { uid: from, name };
}

/**
 * A permanent link to one person's profile — what a QR code carries.
 *
 * ⚠️ NOT AN INVITE LINK, and the difference is the whole point of it. An
 * invite is a one-time capability that expires in 7 days, so a QR of one goes
 * stale in a pocket and has to be regenerated every time. Tim asked for *"each
 * user to have their own QR code where they can show another person"* — their
 * own, singular, permanent. So this addresses the ACCOUNT, and what the other
 * person does with it is send a request the owner has to accept.
 *
 * ⚠️ A uid in a link is not a secret. It identifies an account; reaching
 * anything under it still requires the rules to say yes, and the only thing
 * this route enables is a request — which is exactly what the directory
 * already enables by name.
 */
export function profileLink(baseUrl, uid) {
  const base = String(baseUrl || '').split('#')[0];
  return `${base}#/add/${encodeURIComponent(uid)}`;
}
