/* ==========================================================================
   workout-card.js — ONE workout, drawn as a card.

   Extracted from `views-workouts.js` on 2026-09-27, on Tim's instruction:
   *"when you click on the workouts section inside the user's profile, make the
   list of workouts look like the same style of the home page of your workouts
   from your friends."*

   🔒 ONE BUILDER, TWO SUBJECTS — the same shape `profile-shape.js` took for the
   two profiles, `systemBody()` for the two programme doors and `ownCalendar()`
   for the three calendars. The alternative was a second implementation of the
   card over in `views-me.js`, which is two bodies of code that must agree
   forever about a stat row, a five-exercise cap, an empty case and a title
   glyph. They would not have agreed for long.

   ⚠️ THE HEAD AND THE FOOT ARE THE CALLER'S, THE BODY IS NOT. What differs
   between a friend's card and your own is who it belongs to (their face and a
   link to their page; yours, and no link to yourself) and what sits at the
   bottom (their card takes Kudos/Comment/Share; yours shows the reactions that
   LANDED on it — you cannot react to your own workout, and `firestore.rules`
   says so with `isFriendOf`). Everything between those two is identical, and
   that middle is what lives here.

   ⚠️ WHAT THIS MODULE IS HANDED IS THE PUBLISHED SHAPE, not a stored session.
   A friend's card is built from `social.projectSession()`'s output; your own
   goes through `sessionToCard()` below, whose whole job is to hand this the
   same shape. Two input shapes reaching one renderer is how the `exerciseName`
   / `name` split would otherwise have leaked into the view.
   ========================================================================== */

import { el, icon, relativeDay } from './ui.js';
import { sessionStats, setsLabel } from './session-stats.js';
import { BUILT_IN_EXERCISES } from './exercises.js';

/** The library's Activity shelf, by lowercased name — see the kind glyph below.
 *
 * ⚠️ Moved here from `views-workouts.js` with the card. It costs no new load:
 * `exercises.js` is already pulled in by `store.js` through
 * `strength-observations.js`, so every screen that can show a card has it. */
const ACTIVITY_NAMES = new Set(
  BUILT_IN_EXERCISES.filter((e) => e.muscle === 'Activity').map((e) => e.name.toLowerCase()));

/* How many exercises to list on a card before it says "see the rest".
 *
 * Five, which is what Hevy's current build shows before "See 1 more exercise"
 * (social-plan §12.13). Below that a leg day reads as a stub; above it one
 * person's marathon session pushes everybody else's card off the screen. */
export const FEED_EX_LIMIT = 5;

/* The numbers under the title — Hevy's stat row, in our type.
 *
 * ⚠️ THEIRS READS `Time · Volume · Records` AND OURS READS `Time · Sets`, which
 * is Tim's call (2026-09-01: *"Replace Volume for # of sets"*) and is also the
 * only column of the three that can be computed honestly for somebody else's
 * session. `js/session-stats.js` has the full argument.
 *
 * 🛑 NOT EXPORTED, and the name is why: `views-me.js` already imports a
 * different `statRow` from `profile-shape.js`. Two exported functions with one
 * name reaching one file is a rename waiting to go wrong.
 *
 * Small grey label above, bold value below, in columns — their shape, because
 * it is a good one. No boxes and no rules between the columns (Rule 2); the
 * gaps do the separating. */
function statRow(pairs) {
  const cells = pairs.filter((p) => p && p[1] != null && p[1] !== '');
  if (!cells.length) return null;
  return el('div', { class: 'feed-stats' },
    ...cells.map(([label, value]) => el('div', { class: 'feed-stat' },
      el('div', { class: 'feed-stat-label', text: label }),
      el('div', { class: 'feed-stat-value', text: String(value) }),
    )));
}

/** "1h 4min" / "45 min" — their format, because a two-hour session in minutes
 *  is a number you have to do arithmetic on to understand. */
export function fmtMinutes(mins) {
  const n = Math.round(Number(mins) || 0);
  if (n <= 0) return null;
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/**
 * A STORED session → the shape a card is drawn from.
 *
 * 🚨 THE DURATION IS ROUNDED THE SAME WAY A PUBLISHED ONE IS, and that is a
 * deliberate agreement rather than laziness. `social.projectSession()` rounds
 * minutes to the nearest five and clamps to 5–360 as a PRIVACY concession —
 * a reader learns "about 45 minutes", never the instant somebody left the gym.
 * None of that reasoning applies to your own screen, where the exact figure is
 * yours already.
 *
 * It is matched anyway, because the alternative is one workout reading "47 min"
 * on your profile and "45 min" on the feed your friend is looking at, and an
 * app that disagrees with itself about a number is worse than an app that is
 * five minutes coarse. Same trade as the rep prediction following our own curve
 * rather than the better-graded one (§9).
 *
 * 🔒 The rounding lives in TWO PLACES and a test asserts they agree — see
 * `social.js`'s duration block. If one moves, the test fails by name.
 */
export function sessionToCard(session) {
  if (!session) return null;
  const startedMs = Date.parse(session.startedAt);
  const finishedMs = Date.parse(session.finishedAt);
  let minutes = null;
  if (Number.isFinite(startedMs) && Number.isFinite(finishedMs)) {
    const mins = (finishedMs - startedMs) / 60000;
    // A draft left open overnight carries NO duration rather than a
    // fourteen-hour one — the same guard, for the same reason.
    if (mins >= 5 && mins <= 360) minutes = Math.max(5, Math.round(mins / 5) * 5);
  }

  return {
    id: typeof session.id === 'string' ? session.id : null,
    date: session.date,
    name: session.workoutName || 'Workout',
    ...(session.startedAt ? { startedAt: session.startedAt } : {}),
    ...(minutes == null ? {} : { minutes }),
    ...(session.location ? { location: session.location } : {}),
    ...(session.note ? { note: session.note } : {}),
    /* ⚠️ `exerciseName` → `name`, which is the one field that differs between a
     * stored session and a published one. `sessionStats()` reads both keys, so
     * the stat row would have survived either way — but `cardBody()`'s
     * self-named check reads `.name` directly, and on a raw session that is
     * `undefined`, which silently turns off the "say it once" rule for every
     * activity. Normalise here, once, rather than teach the renderer two
     * shapes. */
    entries: (session.entries || []).map((e) => ({
      exerciseId: (e && e.exerciseId) || null,
      name: (e && (e.exerciseName || e.name)) || 'Exercise',
      sets: (e && e.sets) || [],
    })),
  };
}

/**
 * The middle of a card: title, description, stat row, exercise lines.
 * Returns an array of nodes, so the caller decides whether it is wrapped in a
 * link or in a flat div.
 */
export function cardBody(a) {
  // What they did. ⚠️ `entries` used to be missing at the lowest tier, which is
  // why the card has an honest empty case at all; the tiers went on 2026-09-03
  // and the empty case stays, because an activity carries no entries either.
  const names = (a.entries || []).map((x) => x && x.name).filter(Boolean);

  const stats = sessionStats(a.entries);
  const title = a.name || 'Workout';

  /* ⚠️ A RUN SHOULD READ AS A RUN WITHOUT BEING READ — activities-plan §3
   * item 4. The projection carries no group (it publishes what was done, not
   * how this app files it), so the kind is recovered on the CLIENT by matching
   * the title against the library's own Activity shelf. Presentation only. */
  const isActivity = ACTIVITY_NAMES.has(title.trim().toLowerCase());

  // An activity session is one entry named after itself, so the card was
  // printing "Running" directly under "Running". Say it once.
  const said = names.length === 1 && names[0].trim().toLowerCase() === title.trim().toLowerCase()
    ? [] : names;

  /* ⚠️ ONE ROW PER EXERCISE, SET COUNT FIRST — the second-biggest gap in
   * social-plan §12.14. A run-on line of names says what was touched and
   * nothing about how much was done, which is the whole difference between a
   * receipt and a record.
   *
   * The run-on survives as the fallback, and it earns its place: a session can
   * still have entries where no set carries a number — an old row, or a workout
   * abandoned after the first exercise — and printing "0 sets" against every
   * name would be a worse lie than the names alone. `stats.byExercise` is empty
   * in exactly that case. */
  const selfNamed = names.length === 1 && said.length === 0;
  const rows = selfNamed ? [] : stats.byExercise;

  const did = rows.length
    ? el('div', { class: 'feed-exs' },
        ...rows.slice(0, FEED_EX_LIMIT).map((x) => el('div', { class: 'feed-ex' },
          el('span', { class: 'feed-ex-sets', text: setsLabel(x.sets) }),
          el('span', { class: 'feed-ex-name', text: x.name }),
        )),
        rows.length > FEED_EX_LIMIT
          ? el('div', { class: 'feed-ex is-quiet', text:
              `See ${rows.length - FEED_EX_LIMIT} more exercise`
              + (rows.length - FEED_EX_LIMIT === 1 ? '' : 's') })
          : null,
      )
    : said.length
      ? el('div', { class: 'feed-did', text: said.join(' · ') })
      : names.length
        ? null
        : el('div', { class: 'feed-did is-quiet', text: 'Nothing was recorded inside this one.' });

  const heading = el('h2', { class: 'feed-title' },
    // ⚠️ The workout's name is the LARGEST text in the card, above the athlete's
    // own name — which is Strava's hierarchy, and it is right: you scan a feed
    // for what happened, and whose it is qualifies it.
    el('span', { class: 'feed-kind' }, icon(isActivity ? 'activity' : 'dumbbell', 16)),
    title);

  // Their description, published at "my workouts" and above. Second thing you
  // read, under the title and above the numbers — Hevy's order (§12.13), and
  // the right one: it is what the person said, and the stats are what the app
  // counted.
  const note = typeof a.note === 'string' && a.note
    ? el('p', { class: 'feed-note', text: a.note })
    : null;

  return [
    heading,
    note,
    // ⚠️ NO SET COUNT ON A RUN. "1 set" is an artifact of how a quick activity
    // is stored, not something anybody did, and D27 is explicit that activities
    // are recorded first-class and modelled not at all. Time is the honest
    // column for them and it is already there.
    statRow([['Time', fmtMinutes(a.minutes)], ['Sets', isActivity ? null : (stats.sets || null)]]),
    did,
  ].filter(Boolean);
}

/** The grey line under the name: "Yesterday at 07:14 · Gold's Gym". */
export function cardMeta(a, fmtClock) {
  // ⚠️ Strava's meta line is "{date} at {time}" plus a location, and it drops
  // the location half silently when there is none rather than leaving a hole.
  const when = [relativeDay(a.date), fmtClock ? fmtClock(a.startedAt) : null]
    .filter(Boolean).join(' at ');
  // ⚠️ MINUTES LEFT THIS LINE ON 2026-09-02 and moved into the stat row, where
  // it is read rather than skimmed past. It must not appear in both — the same
  // number twice on one card reads as two different facts.
  return [when, a.location].filter(Boolean).join(' · ');
}

/**
 * The whole card.
 *
 * @param {object} a      the card shape (published projection, or sessionToCard)
 * @param {object} opts
 *   head    node   — the top row (a friend's face + name, or yours). Optional.
 *   href    string — where the body goes. Omit for a card that is not a way in.
 *   foot    node   — the bottom row (their action buttons, or your reactions).
 *   id      string — stamped as `data-session`, so a link can find this card.
 */
export function workoutCard(a, opts = {}) {
  const body = cardBody(a);
  /* ⚠️ WHERE IT GOES DEGRADES RATHER THAN DYING. A friend's session with
   * nothing inside it has no workout to open, so the body is not a link and the
   * quiet line above says why. A dead tap is the failure this project keeps
   * refusing to ship.
   *
   * 🚨 `alwaysOpen` IS THE ONE PLACE YOUR OWN LIST DIFFERS, and it is not a
   * preference. The empty case exists because a FRIEND's published projection
   * can carry no entries at all — there may genuinely be nothing behind the
   * card. Your own sessions are on this device and `#/day/<date>` exists for
   * every date you recorded, empty or not, so the same rule applied to your
   * list would take away a way in that the old row list had. */
  const openable = Boolean(opts.href)
    && Boolean(opts.alwaysOpen || (a.entries && a.entries.length));

  return el('article', {
    class: 'feed-card',
    ...(opts.id ? { 'data-session': opts.id } : {}),
  },
    opts.head || null,
    openable
      ? el('a', { class: 'feed-open', href: opts.href }, ...body)
      : el('div', { class: 'feed-open is-flat' }, ...body),
    opts.foot || null,
  );
}
