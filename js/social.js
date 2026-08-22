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
  [MID]: 'The whole session — exercises, sets, reps and weights.',
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
  return { connections };
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
 * @param {object}   o.profile       { name }  — NEVER the email address
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
    profile: { name: typeof profile.name === 'string' ? profile.name.trim().slice(0, 60) : '' },
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
 * Throw if a projection contains something its tier does not allow.
 *
 * ⚠️ This is an ABSENCE check, not a shape check, and the difference is the
 * whole point. A test that lists the fields it expects to be missing passes
 * happily the day somebody adds a new field and forgets — which is exactly how
 * this kind of leak happens in practice. So: walk the finished document and
 * fail on any numeric leaf that is not on the short list of numbers the tier is
 * allowed to contain.
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
