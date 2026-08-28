// Social — visibility tiers and the projection builder.
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
// ── THE TIERS ────────────────────────────────────────────────────────────────
//
// Tim's, 2026-08-17, and his cut is not the one the plan first drafted. The
// draft split mid from full on WEIGHTS; his splits on SESSION vs ANALYSIS —
// the whole workout at mid, benchmarks and the muscle map at full.
//
// His is better, and the load-bearing reason is this one: it needs no field
// surgery. Hiding weights meant walking into every set — AND into the `minis`
// nested inside a drop set or myo-rep — to strip one field while keeping its
// siblings. That is exactly the shape of code that leaves a number behind. His
// version copies whole objects or omits them, so there is no partial object
// anywhere in this file, and the test is an absence check rather than a shape
// check. See docs/social-plan.md §3.3.1.
//
// ⚠️ What it gives up, and the trade was taken deliberately: "they can see my
// volume but not my weights" (docs/vision.md §1.1) is NOT expressible. Volume
// is computed from weights, so anything showing it hands the weights back by
// another door. Do not add a fourth tier for this without re-reading §3.3.1.
//
// Pure: no DOM, no store, no clock of its own. Same reason as e1rm.js,
// set-types.js and next-workout.js — the whole point of this module is that it
// can be asserted headlessly, and a module that reaches for Date.now() or
// localStorage cannot be.

/* ------------------------------------------------------------------ *
 * Tiers
 * ------------------------------------------------------------------ */

export const NONE = 'none';
export const LIGHT = 'light';
export const MID = 'mid';
export const FULL = 'full';

/** Least to most visible. Index IS the rank — see tierRank(). */
export const TIERS = [LIGHT, MID, FULL];

/**
 * What the owner is told each tier means.
 *
 * The UI never shows the word "tier" or this table; it says "Alex can see:"
 * and one of these. A visibility control the user cannot restate in their own
 * words is not a control, which is the first reason Tim's cut beat the draft's.
 */
export const TIER_LABEL = {
  [NONE]: 'Nothing',
  [LIGHT]: 'Just that I trained',
  [MID]: 'My workouts',
  [FULL]: 'Everything',
};

export const TIER_DETAIL = {
  [NONE]: 'They stay connected but see nothing at all.',
  [LIGHT]: 'The day, and what the workout was called. Nothing inside it.',
  // ⚠️ "and the time you started" is not decoration — it is the only place the
  // owner is told that moving somebody to this tier hands over their routine as
  // well as their lifts. A visibility control the user cannot restate in their
  // own words is not a control, and time-of-day is the part of mid a reasonable
  // person would not have guessed from "my workouts". See projectSession().
  [MID]: 'The whole session — exercises, sets, reps and weights, and the time you started.',
  [FULL]: 'The above, plus benchmarks, your muscle map and your progress.',
};

/** A brand-new connection starts here. Never `mid`, never "whatever was last used". */
export const DEFAULT_TIER = LIGHT;

/** -1 for anything that is not a tier, so unknown input is never "at least light". */
export function tierRank(tier) {
  return TIERS.indexOf(tier);
}

export function isTier(tier) {
  return tierRank(tier) >= 0;
}

/** Does `tier` include everything `needed` includes? Unknown input is always false. */
export function atLeast(tier, needed) {
  const a = tierRank(tier);
  const b = tierRank(needed);
  return a >= 0 && b >= 0 && a >= b;
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
      // An unrecognised stored tier degrades to the SAFEST value, not the
      // nearest one. A hand-edited or half-migrated graph must never widen
      // access by accident.
      tier: isTier(c.tier) || c.tier === NONE ? c.tier : DEFAULT_TIER,
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

/** What one person is allowed to see. Anyone not connected sees nothing. */
export function tierForViewer(graph, uid) {
  const found = normalizeGraph(graph).connections.find((c) => c.uid === uid);
  return found ? found.tier : NONE;
}

/**
 * Who is listed in the `viewers` array of one tier's document.
 *
 * ⚠️ EXACT membership, not cumulative: somebody on `full` appears in the full
 * document's viewers and in NO other. The documents themselves are cumulative
 * instead (full contains everything mid does), so one document is all any
 * reader ever needs.
 *
 * The wrinkle this creates is on the READING side, and it is written down in
 * docs/social-plan.md §3.2: a reader does not know which tier they were given,
 * so they try full → mid → light and keep the first that works. That is cheap —
 * Firestore does not bill a permission-denied read — and the answer is cached
 * locally, re-probed only on a miss. The alternative, listing each viewer in
 * every tier at or below theirs, means three documents to rewrite whenever one
 * person's tier changes, and three places for that write to half-fail.
 */
export function viewersForTier(graph, tier) {
  if (!isTier(tier)) return [];
  return normalizeGraph(graph).connections
    .filter((c) => c.tier === tier)
    .map((c) => c.uid)
    .slice(0, MAX_VIEWERS);
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
 * One recorded session, as the given tier is allowed to see it.
 *
 * `light` is built from three fields and cannot contain a number from inside
 * the workout, because it never looks inside it. `mid` and `full` are the same
 * object — the tiers differ in what is published ALONGSIDE the sessions, not in
 * how a session is rendered.
 *
 * Weights are published in POUNDS, which is how everything is stored
 * (units.js). The reader's own lbs/kg preference converts at display, so two
 * people with different unit settings see the same workout in their own units
 * and neither is converting a number that was already converted.
 */
export function projectSession(session, tier) {
  if (!session || !atLeast(tier, LIGHT)) return null;
  const date = typeof session.date === 'string' ? session.date : null;
  if (!date) return null;

  const out = {
    id: typeof session.id === 'string' ? session.id : null,
    date,
    name: typeof session.workoutName === 'string' && session.workoutName
      ? session.workoutName
      : 'Workout',
  };

  if (!atLeast(tier, MID)) return out;

  // ── THE START TIME, AND WHY IT IS ON THIS SIDE OF THE MID GATE ─────────────
  //
  // Tim wants a Strava-shaped home feed — a friend's name, the date and the
  // time at the top of each card — and the projection had no time in it at all,
  // so the feed could not have shown one however the view was written.
  //
  // ⚠️ IT IS PUBLISHED AT MID, NOT LIGHT, AND THAT IS THE DECISION IN THIS
  // FUNCTION — the parsing below is the easy half. Four reasons, in the order
  // they actually decided it:
  //
  //   1. LIGHT IS THE DEFAULT TIER (DEFAULT_TIER above), so it is what every
  //      connection Tim has ever made is on unless he moved them. Adding a
  //      field to light does not ask anybody anything: the next publish widens
  //      what every existing light viewer can see, retroactively, across the
  //      whole 60-session activity window. A widening has to be an act by the
  //      owner, never a consequence of a deploy. That reason alone settles it.
  //   2. A TIME OF DAY IS A DIFFERENT KIND OF FACT FROM A DATE. "He trained on
  //      Tuesday" is about him; "he trains at 18:40 most weekdays" is a
  //      schedule, and a schedule says when a house is empty and where a person
  //      reliably is. Sixty of them say it with confidence. Light exists to say
  //      the minimum — TIER_DETAIL calls it "the day, and what the workout was
  //      called. Nothing inside it" — and a start time is not the minimum.
  //   3. AT MID IT COSTS NOTHING, which is the other half of the same argument.
  //      A mid viewer already has every exercise, set, rep and weight; somebody
  //      holding that does not learn much from also knowing it began at 18:40.
  //      The field is therefore nearly free where it is added and not free
  //      where it is not — so there is no version of this where light is the
  //      better trade.
  //   4. The feed does not need it at light anyway. views-social.js renders a
  //      light row flat, with no disclosure to open, precisely because there is
  //      nothing behind it. The rich card Tim described is the mid/full one.
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
  // five, at MID and above where startedAt already is — so a reader learns
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

  // ── LOCATION, AND WHY IT SITS BESIDE startedAt AND NOT AT LIGHT ────────────
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
  // ⚠️ MID AND ABOVE, for a STRONGER version of startedAt's argument: sixty
  // start times describe a schedule; sixty start times WITH A PLACE describe
  // where a person reliably is and when. Light is the default tier and exists
  // to say the minimum. Same fail-closed shape too — missing is missing, no
  // key rather than null, and assertTierClean's key allow-list at light means
  // this field showing up there is a test failure, not a quiet widening.
  if (typeof session.location === 'string' && session.location.trim()) {
    out.location = session.location.trim().slice(0, 80);
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
 * Everything one tier publishes, as the document that gets written to
 * users/{uid}/shared/{tier}.
 *
 * Every input is passed in. This function reads nothing and knows no clock —
 * `publishedAt` is an argument — so the whole of what a person shares can be
 * asserted in a headless test with no emulator, no browser and no account.
 *
 * @param {object}   o
 * @param {string}   o.tier          light | mid | full
 * @param {string[]} o.viewers       uids allowed to read this document
 * @param {object}   o.profile       { name, avatar } — NEVER the email address
 * @param {object[]} o.sessions      private session rows
 * @param {object[]} o.benchmarks    private benchmark rows      (full only)
 * @param {object[]} o.strength      muscle ratings              (full only)
 * @param {object[]} o.bodyWeights   private body-weight rows    (full AND opted in)
 * @param {boolean}  o.shareBodyWeight
 * @param {string}   o.publishedAt   ISO instant, passed in
 */
export function buildProjection({
  tier,
  viewers = [],
  profile = {},
  sessions = [],
  benchmarks = [],
  strength = [],
  bodyWeights = [],
  shareBodyWeight = false,
  publishedAt = null,
} = {}) {
  if (!isTier(tier)) throw new Error(`Not a visibility tier: ${tier}`);

  const doc = {
    tier,
    viewers: [...new Set(viewers.filter((v) => typeof v === 'string' && v))].slice(0, MAX_VIEWERS),
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
    },
    publishedAt: typeof publishedAt === 'string' ? publishedAt : null,
    activity: [],
  };

  const dated = [...(Array.isArray(sessions) ? sessions : [])]
    .filter((s) => s && typeof s.date === 'string')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ACTIVITY);
  doc.activity = dated.map((s) => projectSession(s, tier)).filter(Boolean);

  if (atLeast(tier, FULL)) {
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

    // Level and percentile only — not the estimated weight behind them. The
    // body map renders from exactly these two, so publishing the estimate would
    // be a number nothing displays, and data nobody needs is data that only has
    // downside. Real recorded numbers are already in `benchmarks` at this tier.
    doc.strength = (Array.isArray(strength) ? strength : [])
      .filter((m) => m && typeof m.muscle === 'string')
      .map((m) => ({
        muscle: m.muscle,
        level: typeof m.level === 'string' ? m.level : (m.level && m.level.name) || null,
        percentile: Number.isFinite(m.percentile) ? m.percentile : null,
        confidence: Number.isFinite(m.confidence) ? m.confidence : null,
      }));

    // ⚠️ Body weight is the exception INSIDE full, and it is off unless the
    // owner turned it on separately. It is the most personal number the app
    // stores and it is not what anybody means by "how strong I am" — it sits in
    // this bucket only because the strength maths needs it. Letting an accident
    // of the schema decide a privacy question is how this sort of thing goes
    // wrong. See docs/social-plan.md §3.3.1.
    if (shareBodyWeight) {
      doc.bodyWeight = (Array.isArray(bodyWeights) ? bodyWeights : [])
        .filter((r) => r && typeof r.date === 'string' && Number.isFinite(r.weight))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({ date: r.date, weight: r.weight }));
    }
  }

  // Defence in depth. Everything above is a whitelist and should already be
  // correct; this refuses to hand back a document that is not, so a mistake
  // becomes a thrown error at the publish site instead of a leak on somebody
  // else's screen. It costs one walk of a small object.
  assertTierClean(doc, tier);
  return doc;
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
 * The complete set of fields a session may carry below MID.
 *
 * ⚠️ Adding a name here WIDENS what every light viewer sees. There is no other
 * switch: this list and projectSession() are the two places that decide it.
 */
const LIGHT_SESSION_FIELDS = new Set(['id', 'date', 'name']);

/**
 * Throw if a projection contains something its tier does not allow.
 *
 * ⚠️ This is an ABSENCE check, not a shape check, and the difference is the
 * whole point. A test that lists the fields it expects to be missing passes
 * happily the day somebody adds a new field and forgets — which is exactly how
 * this kind of leak happens in practice. So: walk the finished document and
 * fail on anything that is not on the short list the tier is allowed to hold.
 *
 * `light` may hold no number from inside a workout at all. `mid` may hold the
 * session numbers and nothing from the analysis collections.
 */
export function assertTierClean(doc, tier) {
  const bad = [];

  if (!atLeast(tier, MID)) {
    for (const { path, value } of leaves(doc.activity || [], 'activity')) {
      // A date is a string; an id is a string. A NUMBER below a session at this
      // tier can only be something that leaked out of the workout.
      if (typeof value === 'number') bad.push(`${path} = ${value}`);

      // ⚠️ AND THE SAME QUESTION ASKED ABOUT THE KEY, WHICH THIS GUARD DID NOT
      // ASK UNTIL 2026-08-25. Every leak it was written to catch happened to be
      // a number — a weight, a rep count — so "no numbers below a session"
      // looked like the whole of it. It is not. Adding the session's start
      // time to light would have been a STRING, the guard would have passed it
      // without a murmur, and the safety net the whole sharing model leans on
      // would have been silent for the one field somebody had just thought
      // hardest about. Found by adding that field (at mid) and asking what
      // would have happened had it gone to light.
      //
      // So: the leaf's own field path, with the array index stripped, must be
      // one of the three names light admits. This fails CLOSED — a field
      // invented next year is a leak here until somebody names it above, which
      // is the same discipline projectSession()'s whitelist already follows,
      // and it subsumes the number rule rather than replacing it (both run, so
      // a number under an allowed key is still caught).
      const field = path.replace(/^activity\[\d+\]\.?/, '');
      if (!LIGHT_SESSION_FIELDS.has(field)) bad.push(`${path} is not shared at ${tier}`);
    }
  }

  if (!atLeast(tier, FULL)) {
    for (const key of ['benchmarks', 'strength', 'bodyWeight']) {
      if (doc[key] !== undefined) bad.push(`${key} present`);
    }
  }

  if (doc.bodyWeight !== undefined && !atLeast(tier, FULL)) bad.push('bodyWeight present');

  if (bad.length) {
    throw new Error(`Projection for "${tier}" leaks: ${bad.join(', ')}`);
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
 * The order a reader tries a friend's tiers in: most generous first.
 *
 * A viewer is listed in exactly one tier's document (see viewersForTier), so
 * they do not know which one they were given and have to find out by asking.
 * High to low, keeping the first that answers. A refusal is not billed as a
 * read, and the answer is worth caching — but the cache must be re-probed on a
 * miss, because the owner can move somebody down at any moment and a stale
 * "they let me see everything" must never survive that.
 */
export const PROBE_ORDER = [FULL, MID, LIGHT];

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
 * workout it reacts to — and the rules allow a VIEWER of any published tier
 * to CREATE one there. What made a foreign write unacceptable everywhere
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
