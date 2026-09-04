// Home, workout list, workout builder, exercise picker.

import { store, social, DEFAULT_SETS, todayISO } from './store.js';
import { suggestNext, describeSuggestion, estimateWorkoutMinutes } from './next-workout.js';
import {
  DROP, MYO, isNested, blocksOf, groupLabel, isLinked, toggleLink, normalizeGroups,
  setTypeLabel, plannedMinis, clampMinis,
} from './set-types.js';
import {
  MUSCLE_GROUPS, EQUIPMENT, makeCustomExercise, LOAD_HELP, BUILT_IN_EXERCISES,
  canStandIn, standInFor,
} from './exercises.js';
/* ⚠️ Statically imported, and it costs nothing: `store.js` above already pulls
 * muscle-evidence.js in through strength-observations.js, so this names a module
 * that is loaded either way. It is here for one job — the custom-exercise sheet
 * must not offer a stand-in that converts nothing (see standInOptions). */
import {
  WEEK, CYCLE, REST, MIN_CYCLE_DAYS, MAX_CYCLE_DAYS,
  newSchedule, normalizeSchedule, resizeSchedule, slotLabel, slotCount,
} from './schedule.js';
import { contributionsFor } from './muscle-evidence.js';
import { alternativesFor } from './exercise-families.js';
import { sessionStats, setsLabel } from './session-stats.js';

/** The library's Activity shelf, by lowercased name — see feedCard(). */
const ACTIVITY_NAMES = new Set(
  BUILT_IN_EXERCISES.filter((e) => e.muscle === 'Activity').map((e) => e.name.toLowerCase()));

/* A built-in exercise by NAME, for the ready-made-system screens — those list
 * their exercises by name (`preset-systems.js` references them that way on
 * purpose, and a test asserts every one resolves), so there is no id to look up.
 *
 * ⚠️ Returns the FIRST match, and the one ambiguous name in the library is
 * "Cable Kickback" (Triceps and Glutes). No preset system uses it; if one ever
 * does, this picks the triceps one and the picture would be wrong. Worth
 * knowing rather than worth solving today — the exercise-image manifest is
 * keyed by id everywhere it can be. */
const byExerciseName = (name) =>
  BUILT_IN_EXERCISES.find((e) => e.name === name) || null;
// ⚠️ Statically imported, unlike the rest of the rating, and on purpose. These
// are the CAVEATS that travel with the numbers — what the strength score cannot
// see, and that "half a set" is a modelling choice — plus the exercise-order
// note in the builder. Behind a dynamic import they would be a caveat that can
// arrive late or not at all, which is the one failure mode a caveat may not
// have. Both modules are pure and dependency-free (optimal.js imports only
// volume-map.js), so this costs an import and nothing else.
import {
  STRENGTH_CAVEAT, STRENGTH_CAVEAT_SHORT, exerciseOrderNote,
} from './optimal.js';
import { INDIRECT_NOTE_RATING } from './volume-map.js';
import {
  setChildren, el, icon, iconBtn, chevron, toast, openSheet, confirmSheet, screenShell,
  emptyState, relativeDay, miniStepper, loadBadge, trimNum, exerciseLabel,
  personFace, helpDot, parkScreen,
} from './ui.js';

const go = (hash) => { location.hash = hash; };

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const totalSets = (w) => w.exercises.reduce((n, e) => n + e.sets, 0);

/* ================================================================== *
 * Home
 * ================================================================== */

/**
 * HOME — a feed of what the people you train with have been doing.
 *
 * ⚠️ REBUILT 2026-08-25. Tim: *"I got inspiration off of Strava, and I want it
 * to be extremely similar to that… whenever any of your friends record a workout
 * then it shows up at the top of your feed, with their name, the date and time,
 * and location at the top of their box, then the title of their workout, and a
 * list of the exercises they did. Then at the bottom it will have a thumbs up
 * emoji on the left, a comment button in the middle, and a share button on the
 * right."*
 *
 * ⚠️ EVERYTHING THAT STARTED A WORKOUT HAS LEFT THIS SCREEN — *"so we don't
 * double dip."* The suggestion and "choose another workout" are on Record now.
 * That answers the UX review's sharpest finding from the other side, too:
 * *"nothing a user can see on Home ever grows."* A feed is nothing BUT growth.
 *
 * ⚠️ STRAVA'S ANATOMY, NOT STRAVA'S CHROME. He also said *"I don't want panels
 * on any page"*, and Strava's feed is literally elevated cards with drop
 * shadows. Both can be true: the ORDER and CONTENT of a card is copied exactly
 * — name, then date/time/location, then title, then what they did, then three
 * actions — while the separation stays this app's own hairline-and-space
 * (Rule 2). If he wants the boxes, it is one CSS rule.
 *
 * ⚠️ CHRONOLOGICAL, DELIBERATELY. Strava switched its default to a personalised
 * ranking and got a sustained backlash and a petition; it now ships "Latest
 * Activities" as a toggle. Newest first, no ranking, nothing hidden.
 *
 * ⚠️ ONE ENTRY PER FRIEND PER DAY IS **NOT** COLLAPSED, and that is a decision
 * rather than an omission — see feedEntries(). Strava is criticised for exactly
 * this and it is a cheap win, but collapsing means deciding what the merged card
 * is called, and two workouts in a day is a real thing that happened twice.
 *
 * ⚠️ NO LOCATION ANYWHERE YET, and the card says nothing rather than something
 * vague. Tim flagged it himself — *"we might need to work on location
 * services"* — and there is no geolocation in this app, nothing in the
 * published projection to carry it, and a privacy decision to take before there
 * is. Open work 0m.
 */
/* 🔄 2026-09-08 — THE YOU / FRIENDS SWITCH IS GONE, AND HOME IS BECOMING THE HUB.
 *
 * Tim: *"I want to get rid of the 'You' and 'Friends' tab in the home page …
 * Any details that don't go in any of the other main sections (data, workouts,
 * etc) go into the home page, so we want to make it really nice. It's going to
 * be the hub of all basic interaction. Side features or anything like that
 * should be placed there."*
 *
 * ⚠️ THE SWITCH WENT; THE SCREEN BEHIND IT DID NOT. The Friends list is still
 * `#/social`, reached from the Profile tab — where the followers and following
 * counts point straight at it, which is a better door than a switch that made
 * Home two screens wearing one name. What actually left Friends is the pair of
 * controls that were never about other people: your display name and who can see
 * your account, both now on the Account screen with the rest of the logistics.
 *
 * 🛑 AND WHAT HOME IS *FOR* IS NOW A STANDING BRIEF RATHER THAN A LAYOUT: it is
 * where anything that belongs to no other tab goes. Nothing was added here today
 * — he described the destination, not a feature — so resist filling it. */
export async function HomeView() {
  const body = el('div', { class: 'feed' });

  const screen = screenShell({
    profile: true,
    title: 'Home',
    actions: [iconBtn('sliders', 'Settings', () => go('#/settings'))],
    scroll: body,
  });

  // Fetched AFTER the shell exists, so the tab paints immediately and the feed
  // fills in. Every friend is a separate network read; awaiting all of them
  // before showing anything would make the Home tab the slowest in the app,
  // which is the fault the 2026-08-22 read-cache pass was written to remove.
  fillFeed(body).catch(() => {
    setChildren(body, emptyState('Could not load your feed',
      'Your connection dropped. Everything else in the app works offline — this is the one screen that cannot.'));
  });

  return screen;
}

/**
 * ⚠️ THE FEED IS OTHER PEOPLE ONLY, on Tim's instruction: *"for now, we won't
 * put any of the user's own workouts in this home section."* So an account with
 * no friends has an empty feed no matter how much its owner trains — which
 * means the empty state has to be a real screen and not a shrug. Strava's own
 * answer to a thin feed is a "find friends" push, and that is what this is.
 */
async function fillFeed(body) {
  let state;
  try { state = await social.state(); } catch (_) { state = { available: false }; }

  /* ⚠️ THE DEMO GETS A FEED, and it is the reason this branch exists at all.
   *
   * `social.state()` refuses in the demo — correctly, because `republish()`
   * must never push invented workouts at real people. But that refusal made the
   * single most important new screen in the app **unjudgeable in the one place
   * built for judging screens**: the demo account exists so every screen can be
   * looked at without logging anything, and Home would have shown an empty
   * state there forever, including to the accessibility audit, which drives the
   * demo.
   *
   * ⚠️ READING INVENTED FRIENDS IS NOT THE HAZARD. Publishing is, and publishing
   * stays refused — this reads a generated list out of demo.js and touches no
   * network, no storage and nobody's account.
   */
  if (state.reason === 'demo') {
    const { buildDemoFeed } = await import('./demo.js');
    setChildren(body, ...buildDemoFeed(todayISO()).map((e) => feedCard({ ...e, demo: true })));
    return;
  }

  if (!state.available || !state.name) {
    setChildren(body, emptyState('Your feed lives here',
      'Connect with someone you train with and their workouts show up here as they log them.',
      el('a', { class: 'btn primary', href: '#/social', text: 'Find friends' })));
    return;
  }

  if (!state.connections.length) {
    setChildren(body, emptyState('Nobody to follow yet',
      'Send somebody an invite link and their workouts appear here the moment they train.',
      el('a', { class: 'btn primary', href: '#/social', text: 'Invite a friend' })));
    return;
  }

  // ⚠️ Promise.all, and a friend who fails is DROPPED rather than throwing.
  // One person's document being unreadable — they downgraded me, they are
  // mid-publish, the rules said no — must not blank the whole feed.
  const seen = await Promise.all(state.connections.map(async (c) => {
    try {
      const r = await social.friend(c.uid);
      return { conn: c, audience: r.audience, doc: r.doc };
    } catch (_) { return null; }
  }));

  const entries = feedEntries(seen.filter(Boolean));

  if (!entries.length) {
    setChildren(body, emptyState('Nothing from anyone yet',
      'Your friends’ workouts will appear here as they record them. What each person shares is '
      + 'their choice, so some may only show that they trained.'));
    return;
  }

  /* ---- reactions (Open work 0l, now wired) ----
   *
   * One list read per friend, in parallel, failures dropped the same way an
   * unreadable friend is — a missing count must never blank the feed. Names
   * for comment authors resolve through MY graph first (I named my friends),
   * then the name the sender published with, then 'Someone': a
   * friend-of-a-friend's comment is real and should not render as broken. */
  const names = new Map(state.connections.map((c) => [c.uid, c.name]));
  // A published profile name beats the stored graph name — the graph can hold
  // the accept-flow "Friend" placeholder (see healConnectionName in store.js).
  for (const s of seen) {
    if (s && s.doc && s.doc.profile && s.doc.profile.name) names.set(s.conn.uid, s.doc.profile.name);
  }
  names.set(state.uid, 'You');
  const uids = [...new Set(entries.map((e) => e.uid))];
  const reactionMaps = new Map();
  await Promise.all(uids.map(async (uid) => {
    try { reactionMaps.set(uid, await social.reactionsFor(uid)); }
    catch (_) { reactionMaps.set(uid, new Map()); }
  }));

  const withRx = entries.map((e) => {
    const perSession = reactionMaps.get(e.uid) || new Map();
    const slot = (e.act.id && perSession.get(e.act.id))
      || { kudos: [], myKudosId: null, comments: [] };
    return { ...e, rx: { slot, myUid: state.uid, names } };
  });

  // What landed on MY workouts — the receiving half. Without it a kudos
  // would be write-only and the feature would be pointless for the person it
  // exists to encourage.
  const mineBlock = await reactionsOnMine(state, names).catch(() => null);

  setChildren(body, ...(mineBlock ? [mineBlock] : []), ...withRx.map(feedCard));
}

/**
 * A quiet strip above the feed: who reacted to YOUR recent workouts.
 * One line per session, newest session first, capped at three — a readout,
 * not a notification system.
 */
async function reactionsOnMine(state, names) {
  const mine = await social.reactionsFor(state.uid);
  if (!mine.size) return null;
  const sessions = await store.getSessions();
  const byId = new Map(sessions.map((s) => [s.id, s]));

  const rows = [];
  for (const [sid, slot] of mine) {
    const s = byId.get(sid);
    if (!s) continue;                    // reaction to something since deleted
    if (!slot.kudos.length && !slot.comments.length) continue;
    rows.push({ s, slot });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => b.s.date.localeCompare(a.s.date));

  const who = (uid) => names.get(uid) || 'Someone';
  return el('div', { class: 'feed-mine' },
    el('div', { class: 'section-label', text: 'On your workouts' }),
    ...rows.slice(0, 3).map(({ s, slot }) => {
      const bits = [];
      if (slot.kudos.length) {
        bits.push(`👍 ${slot.kudos.map(who).join(', ')}`);
      }
      for (const c of slot.comments.slice(-2)) {
        bits.push(`💬 ${c.fromName || who(c.from)}: “${c.text.length > 60 ? c.text.slice(0, 57) + '…' : c.text}”`);
      }
      return el('div', { class: 'feed-mine-row' },
        el('span', { class: 'feed-mine-what', text: `${s.workoutName || 'Workout'} · ${relativeDay(s.date)}` }),
        el('span', { class: 'feed-mine-who', text: bits.join('   ') }),
      );
    }),
  );
}

/**
 * Flatten every friend's published activity into one list, newest first.
 *
 * ⚠️ SORTED ON THE DATE THE WORKOUT HAPPENED, not on when it was published.
 * Somebody logging Tuesday's session on Thursday belongs on Tuesday — the feed
 * is a record of training, and publishing is an implementation detail of how it
 * got here.
 */
function feedEntries(seen) {
  const out = [];
  for (const s of seen) {
    const acts = (s.doc && s.doc.activity) || [];
    const name = (s.doc && s.doc.profile && s.doc.profile.name) || s.conn.name || 'Friend';
    // Their photo comes from the same published document their name does, so a
    // friend on an old build — or one who has never added a photo — simply has
    // no `avatar` here and the card draws the glyph it always drew.
    const avatar = (s.doc && s.doc.profile && s.doc.profile.avatar) || null;
    for (const a of acts) {
      if (!a || !a.date) continue;
      out.push({ uid: s.conn.uid, name, avatar, act: a });
    }
  }
  // `startedAt` breaks ties within a day where it exists, so two of somebody's
  // sessions on one date do not shuffle between renders.
  return out.sort((x, y) =>
    y.act.date.localeCompare(x.act.date)
    || String(y.act.startedAt || '').localeCompare(String(x.act.startedAt || '')));
}

/* The numbers under the title — Hevy's stat row, in our type.
 *
 * ⚠️ THEIRS READS `Time · Volume · Records` AND OURS READS `Time · Sets`, which
 * is Tim's call (2026-09-01: *"Replace Volume for # of sets"*) and is also the
 * only column of the three that can be computed honestly for somebody else's
 * session. `js/session-stats.js` has the full argument; the short version is
 * that a friend's bodyweight sets have no external load to total and their body
 * weight is not ours to have, so a pounds figure would quietly halve a session
 * of pull-ups. A set count is the same number for everybody.
 *
 * Small grey label above, bold value below, in columns — their shape, because
 * it is a good one. No boxes and no rules between the columns (Rule 2); the
 * gaps do the separating.
 */
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
function fmtMinutes(mins) {
  const n = Math.round(Number(mins) || 0);
  if (n <= 0) return null;
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/* How many exercises to list on a card before it says "see the rest".
 *
 * Five, which is what Hevy's current build shows before "See 1 more exercise"
 * (social-plan §12.13). Below that a leg day reads as a stub; above it one
 * person's marathon session pushes everybody else's card off the screen. */
const FEED_EX_LIMIT = 5;

function feedCard(e) {
  const a = e.act;

  // ⚠️ Strava's meta line is "{date} at {time}" plus a location, and it drops
  // the location half silently when there is none rather than leaving a hole.
  // Same here — and there is never a location yet, so the line is currently
  // always just the left half. Written this way so adding one is one term.
  const when = [relativeDay(a.date), fmtClock(a.startedAt)].filter(Boolean).join(' at ');
  // ⚠️ MINUTES LEFT THIS LINE ON 2026-09-02 and moved into the stat row, where
  // it is read rather than skimmed past. It must not appear in both — the same
  // number twice on one card reads as two different facts.
  const meta = [when, a.location].filter(Boolean).join(' · ');

  // What they did. ⚠️ `entries` used to be missing at the lowest tier, which is
  // why the card has an honest empty case at all; the tiers went on 2026-09-03
  // and the empty case stays, because an activity carries no entries either.
  const names = (a.entries || [])
    .map((x) => x && x.name)
    .filter(Boolean);

  const stats = sessionStats(a.entries);
  const title = a.name || 'Workout';

  /* ⚠️ A RUN SHOULD READ AS A RUN WITHOUT BEING READ — activities-plan §3
   * item 4. The projection carries no group (it publishes what was done, not
   * how this app files it), so the kind is recovered on the CLIENT by matching
   * the title against the library's own Activity shelf. Presentation only:
   * getting it wrong shows the wrong little glyph and changes nothing else,
   * which is why a name match is an acceptable way to decide it. */
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
   * still have entries where no set carries a
   * number — an old row, or a workout abandoned after the first exercise — and
   * printing "0 sets" against every name would be a worse lie than the names
   * alone. `stats.byExercise` is empty in exactly that case. */
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

  /* Tapping the card opens the workout — social-plan §13 step 3, and §12.14's
   * fifth difference ("the card is not a way in").
   *
   * ⚠️ WHERE IT GOES DEGRADES RATHER THAN DYING. A session published before the
   * projection carried ids has nothing to address, so the tap lands on the
   * friend's page — a real destination where the same session is one tap
   * further — instead of on a route that cannot resolve. A dead tap is the
   * failure this project keeps refusing to ship; a slightly less specific
   * destination is not. A session with nothing inside it has no workout to open,
   * so the body is not a link and the quiet line above says why. */
  const openable = Boolean(a.entries && a.entries.length);
  const href = a.id
    ? `#/friend/${encodeURIComponent(e.uid)}/${encodeURIComponent(a.id)}`
    : `#/friend/${encodeURIComponent(e.uid)}`;

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

  const body = [
    heading,
    note,
    // ⚠️ NO SET COUNT ON A RUN. "1 set" is an artifact of how a quick activity
    // is stored, not something anybody did, and D27 is explicit that activities
    // are recorded first-class and modelled not at all. Time is the honest
    // column for them and it is already there.
    statRow([['Time', fmtMinutes(a.minutes)], ['Sets', isActivity ? null : (stats.sets || null)]]),
    did,
  ].filter(Boolean);

  return el('article', { class: 'feed-card' },
    el('a', { class: 'feed-head', href: `#/friend/${encodeURIComponent(e.uid)}` },
      el('span', { class: 'feed-avatar' }, personFace(e.avatar, 19)),
      el('span', { class: 'feed-who' },
        el('span', { class: 'feed-name', text: e.name }),
        el('span', { class: 'feed-meta', text: meta }),
      ),
    ),
    openable
      ? el('a', { class: 'feed-open', href }, ...body)
      : el('div', { class: 'feed-open is-flat' }, ...body),
    feedActions(e),
  );
}

/**
 * ⚠️ KUDOS AND COMMENTS ARE REAL NOW (0l, closed 2026-08-26). A reaction is
 * one create-only document at users/{owner}/reactions/{id}; the rules let a
 * viewer of any published tier write one, prove `from` is the caller, and
 * allow no update path at all. See the reactions block in firestore.rules and
 * the header of the reactions section in js/social.js for why this narrow
 * foreign write is acceptable where widening a collection never was.
 *
 * The demo renders the same buttons and refuses with a sentence when pressed —
 * publishing invented reactions at real people is the same hazard as
 * publishing invented workouts, and reading is fine while writing is not.
 *
 * Share needs no backend: `navigator.share`, clipboard fallback.
 *
 * ⚠️ EXPORTED SINCE 2026-09-02 so the workout screen can carry the same row.
 * A second implementation over there would be two places that must agree about
 * an anchor that can be missing, a demo that must refuse, and an optimistic
 * update — the row is small and the rules around it are not.
 */
export function feedActions(e) {
  const row = el('div', { class: 'feed-actions' });
  const rx = e.rx || null;
  const slot = rx ? rx.slot : { kudos: [], myKudosId: null, comments: [] };

  const refuse = () => toast(e.demo
    ? 'The demo account cannot react to real people.'
    : 'Reactions need a signed-in account.');
  // Sessions published before the projection carried ids have nothing stable
  // to react TO. Old cards, increasingly rare — but a silent no-op is the
  // fault this project keeps refusing to ship, so it says why.
  const noAnchor = () => toast('This workout was shared before reactions existed — it cannot take one.');

  let busy = false;
  async function onKudos() {
    if (!rx) { refuse(); return; }
    if (!e.act.id) { noAnchor(); return; }
    if (busy) return;
    busy = true;
    try {
      const given = await social.toggleKudos(e.uid, e.act.id, Boolean(slot.myKudosId));
      if (given) {
        slot.myKudosId = 'mine';
        if (!slot.kudos.includes(rx.myUid)) slot.kudos.push(rx.myUid);
      } else {
        slot.myKudosId = null;
        slot.kudos = slot.kudos.filter((u) => u !== rx.myUid);
      }
      paint();
    } catch (err) {
      toast((err && err.message) || 'Could not send that.');
    } finally { busy = false; }
  }

  function onComment() {
    if (!rx) { refuse(); return; }
    if (!e.act.id) { noAnchor(); return; }
    openCommentsSheet(e, rx, paint);
  }

  function paint() {
    const mine = Boolean(slot.myKudosId);
    setChildren(row,
      el('button', {
        class: 'feed-act' + (mine ? ' is-mine' : ''),
        'aria-pressed': mine ? 'true' : 'false',
        onClick: onKudos,
      },
        el('span', { class: 'feed-act-glyph', text: '👍' }),
        'Kudos' + (slot.kudos.length ? ` · ${slot.kudos.length}` : '')),
      el('button', { class: 'feed-act', onClick: onComment },
        el('span', { class: 'feed-act-glyph', text: '💬' }),
        'Comment' + (slot.comments.length ? ` · ${slot.comments.length}` : '')),
      el('button', { class: 'feed-act', onClick: () => shareActivity(e) },
        el('span', { class: 'feed-act-glyph', text: '↗' }), 'Share'),
    );
  }
  paint();
  return row;
}

/**
 * The comment thread on one feed card. Reads downward, oldest first; your own
 * comments carry a delete. The thread lives on the workout owner's account,
 * so everyone who can see the card sees the same conversation.
 */
function openCommentsSheet(e, rx, onChanged) {
  const slot = rx.slot;
  const list = el('div', { class: 'comment-list' });
  const input = el('textarea', {
    class: 'input', rows: '2', placeholder: `Say something about ${e.name}’s workout`,
    'aria-label': 'Your comment', maxlength: '500',
  });

  const who = (c) => (rx.names.get(c.from)) || c.fromName || 'Someone';

  function paintList() {
    setChildren(list,
      ...(slot.comments.length
        ? slot.comments.map((c) => el('div', { class: 'comment-row' },
            el('div', { class: 'comment-main' },
              el('span', { class: 'comment-who', text: who(c) }),
              el('span', { class: 'comment-text', text: c.text }),
            ),
            c.mine && c.id ? iconBtn('trash', 'Delete your comment', async () => {
              try {
                await social.removeReaction(e.uid, c.id);
                slot.comments = slot.comments.filter((x) => x !== c);
                paintList(); onChanged();
              } catch (err) { toast((err && err.message) || 'Could not delete that.'); }
            }) : null,
          ))
        : [el('p', { class: 'field-help', style: 'margin:0', text:
            'No comments yet — yours would be the first.' })]),
    );
  }
  paintList();

  const send = el('button', { class: 'btn primary', text: 'Send', onClick: async () => {
    try {
      send.disabled = true;
      const r = await social.addComment(e.uid, e.act.id, input.value);
      slot.comments.push({
        id: r.id, from: rx.myUid, fromName: '', text: r.text,
        at: Date.now(), mine: true,
      });
      input.value = '';
      paintList(); onChanged();
    } catch (err) {
      toast((err && err.message) || 'Could not send that.');
    } finally { send.disabled = false; }
  } });

  openSheet({
    title: `${e.act.name || 'Workout'} — comments`,
    body: el('div', { class: 'comment-sheet' }, list, input),
    footer: el('div', { class: 'btn-row' }, send),
  });
}

async function shareActivity(e) {
  const names = (e.act.entries || []).map((x) => x && x.name).filter(Boolean);
  const text = `${e.name} did ${e.act.name || 'a workout'} on ${e.act.date}`
    + (names.length ? ` — ${names.join(', ')}` : '');
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast('Copied'); return; }
    toast('Sharing is not available in this browser');
  } catch (_) {
    // An abort is somebody changing their mind, not a failure. Reporting it as
    // one would make cancelling a share look like the app breaking.
  }
}

/**
 * "6:32 PM" from an ISO timestamp, or null.
 *
 * ⚠️ NULL RATHER THAN A GUESS. Sessions recorded before `startedAt` existed have
 * no time at all, and a card reading "at 12:00 AM" would be inventing one. The
 * meta line drops the half it has nothing for.
 */
function fmtClock(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (_) { return null; }
}

// ⚠️ `sessionRow()` LIVED HERE AND IS GONE, 2026-08-25. It drew Home's "Recent
// activity" list of the user's OWN sessions, which the feed replaced on Tim's
// *"for now, we won't put any of the user's own workouts in this home section,
// but maybe in the future."* Deleted rather than left unreferenced, because a
// function nothing calls is a function nobody maintains and it would rot before
// "the future" arrived — git has it, and the Calendar tab is where your own
// training is read now.

/* ================================================================== *
 * Pick which workout to start
 * ================================================================== */

/**
 * RECORD — the middle tab, and the biggest target in the app.
 *
 * ⚠️ This is the old start picker with the benchmark action folded in, not a
 * new screen. Tim's five-tab redesign (2026-08-22) moved *"start a workout"*
 * and *"record a benchmark"* off Home and into one place, and the reason it
 * deserves the middle slot is **D4**: the logging loop is the single thing this
 * app beats a spreadsheet at. Until now it was two ordinary buttons partway
 * down Home.
 *
 * `tab: true` is the nav destination. `tab: false` is the old `#/start` deep
 * link, which still opens the same screen as a pushed page with a back button —
 * "Choose another workout" on Home has linked there for months and a hash
 * somebody bookmarked must not start 404ing because a tab bar was redesigned.
 */
/**
 * RECORD — the category chooser (Tim, 2026-08-26: *"when you open Record, it
 * should show you maybe a few options to categorize different types of
 * workouts, and one of them is weightlifting, which leads you to the current
 * page"*). The app stops assuming every workout is a barbell: lifting keeps
 * the full recorder, and running, swimming, cycling, climbing or anything
 * else gets a quick log that saves a real session — calendar, feed and
 * backups all see it. docs/activities-plan.md is the larger plan; lifting
 * stays the analytical core (the muscle map and ratings read lifts only).
 *
 * Weightlifting is FIRST and BIGGEST, and carries the next-in-rotation name,
 * because it is still the common case and the chooser must not slow the
 * mid-gym loop it sits in front of by more than the one tap Tim priced in.
 */
export async function RecordChooserView() {
  const [systems, workouts, sessions] = await Promise.all([
    store.getSystems(), store.getWorkouts(), store.getSessions(),
  ]);
  const next = suggestNext({ systems, workouts, sessions, today: todayISO() });

  const activity = (label, exerciseName) =>
    el('a', { class: 'row', href: exerciseName ? `#/activity/${encodeURIComponent(exerciseName)}` : '#/activity' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: label }),
      ),
      el('span', { class: 'row-chev' }, chevron()),
    );

  /* 🚨 IT COMES UP FROM THE BOTTOM AND THE ARROW PUTS IT BACK DOWN — 2026-09-09.
   *
   * Tim: *"To make the record section feel more like a button that actually
   * activates something, I want the screen to pull up the record section from the
   * bottom (which covers over the main section display). The only change is that
   * we'll add a down arrow in the upper left which will push the record section
   * back down, showing the main section display and automatically being selected
   * on 'home'."*
   *
   * ⚠️ IT IS STILL A ROUTE AND STILL A TAB. `#/record` resolves exactly as it
   * did, the tab bar stays visible under it, and nothing that links here — the
   * Profile tab's button, the session runner's back, a bookmark — knows anything
   * changed. What changed is how it ARRIVES; the rise is in app.js and the CSS.
   *
   * 🚨 THE ARROW GOES HOME, NOT BACK, AND THAT IS TIM'S INSTRUCTION RATHER THAN
   * AN OVERSIGHT. Rule 8 says a back arrow returns to the screen you were just
   * on; this is not one. *"showing the main section display and automatically
   * being selected on 'home'"* — a panel you put away leaves you at the top of
   * the app, not wherever you happened to be standing when you opened it. It is
   * `down`, a different slot in screenShell, so nobody later "fixes" it into a
   * back arrow.
   *
   * ⚠️ IT TAKES THE PROFILE BUTTON'S PLACE, and that corner may only hold one
   * thing (screenShell says why). The avatar is on every other tab.
   */
  return screenShell({
    down: () => {
      // The screen slides away over the one the router is drawing underneath it;
      // with no way to animate, this is a plain navigation and nothing is lost.
      parkScreen(document.querySelector('#app > .screen'), { falls: true });
      go('#/home');
    },
    title: 'Record',
    sub: 'What kind of training?',
    scroll: [
      el('button', {
        class: 'btn primary lg block',
        onClick: () => go('#/start'),
      }, icon('play'), 'Weightlifting'),
      el('div', { class: 'field-help', text: next
        ? `Your workouts, sets and reps. Next in your rotation: ${next.workout.name}.`
        : 'Your workouts, sets and reps — the full recorder.' }),

      el('div', { class: 'section-label', text: 'Or log an activity' }),
      el('div', { class: 'list' },
        activity('Run', 'Running'),
        activity('Walk or hike', 'Walking'),
        activity('Swim', 'Swimming'),
        activity('Cycle', 'Outdoor Cycling'),
        activity('Climb', 'Rock Climbing'),
        activity('Something else', null),
      ),
      el('div', { class: 'field-help', text:
        'Activities go on your calendar and into your feed like any workout. '
        + 'Muscle ratings still come from lifting only.' }),
    ],
    bottom: el('button', { class: 'btn block', onClick: () => go('#/benchmark') },
      icon('flag'), 'Record a benchmark'),
  });
}

/* ================================================================== *
 * A system opens and closes — the one mechanism, used by both screens
 * ================================================================== */

/* Tim, 2026-09-16: *"In the workouts section as well as the record section, it
 * shows the list of systems you have as well as the workouts within each of
 * them. I want you to be able to click on the system in order to close or open
 * the display of the workouts within them in both sections."*
 *
 * ⚠️ ONE MECHANISM FOR BOTH SCREENS, which is the whole reason this is a helper
 * rather than a `<details>` written out twice fifty lines apart. Two
 * implementations of one disclosure is precisely the drift this project keeps
 * having to write down — "one calendar, four doors" is the same lesson — and
 * the drift is invisible until somebody puts the two screens side by side.
 *
 * ⚠️ `<details>`/`<summary>`, the disclosure this app already uses: the Research
 * topics (`.rt-topic`) and "Other lifts" on Profile (`.me-other`). It is
 * keyboard-operable, it announces itself as collapsed or expanded to a screen
 * reader, and it keeps working with no script at all. None of that is behaviour
 * we have to write, and none of it is behaviour we can forget to write.
 *
 * ⚠️ NOTHING ANIMATES ITS HEIGHT, deliberately. The Record picker is one tap
 * from a workout in a gym (D4) and the MOTION rules allow exactly one thing to
 * move on that path: a press answering back. The chevron turning IS that press
 * answering back — `--t-fast`, the same 100ms `.me-other-chev` already uses —
 * and the rows appear at once, so no tap ever waits on a transition. A sliding
 * height would also have to be JS-driven on a native `<details>`, which is how
 * a disclosure ends up with a state its own element disagrees with.
 *
 * ⚠️ A CLOSED `<details>` STILL REPORTS A BOX FOR ITS CONTENTS in the audit's
 * Chrome — it hides them with `content-visibility`, not `display: none`. So
 * anything checking "are the workouts hidden" must read `details.open` (or
 * `checkVisibility()`), never a bounding rect. Recorded because a rect-based
 * check here would pass while the screen was plainly wrong.
 */

/* ⚠️ TWO MEMORIES, NOT ONE, AND THIS PROJECT HAS ALREADY PAID FOR THAT LESSON.
 * `calMode` in views-data.js is shared by its four doors on purpose, because it
 * answers "how I read a calendar" — a preference about a picture, and the same
 * preference wherever the picture is drawn. This is not that question. Which
 * programmes I have folded away while browsing my library says nothing about
 * which I want in front of me mid-gym, and the Record picker is an ACTION
 * screen while the Workouts tab is a destination. `friendCalMode` exists as a
 * separate variable for exactly this reason: a mutation check proved that one
 * shared memory let one screen contaminate the other.
 *
 * ⚠️ AND THEY REMEMBER WHAT IS CLOSED, NEVER WHAT IS OPEN. That single choice
 * is what makes "open" the default without seeding anything: a system nobody
 * has touched is not in the set, a system created ten seconds ago is not in the
 * set, and a fresh install starts with two empty sets. A set of OPEN ids would
 * have to be filled in before the first paint, from data the view has only just
 * finished loading, and would silently fold away every system added afterwards.
 *
 * They survive leaving the screen and coming back, for the same reason
 * `calMode` and `volDays` do: somebody who folded away four of their five
 * programmes did it because they run one of them, and re-opening all five on
 * the next visit would undo that choice every single time. They do not survive
 * a reload, which is the right floor — this is a reading position, not a
 * setting, and nothing is lost by starting a fresh session showing everything.
 */
const closedOnWorkouts = new Set();
const closedOnRecord = new Set();

/* 🚨 OPEN IS THE DEFAULT ON BOTH SCREENS, AND IT IS NOT A COIN TOSS.
 *
 * The one-system case decides it. Most people have one programme (the Record
 * picker's own comment says so, and it is why that screen groups rather than
 * nests), and a person with one system who arrives to find it collapsed has
 * been handed a closed door to their own workouts — the app showing them a
 * heading and hiding everything it exists to show.
 *
 * The first-run case says the same thing from the other end: somebody who has
 * just loaded a ready-made programme arrives here to see what is in it, and
 * "install to first logged set in five taps" (2026-08-21) does not survive a
 * sixth tap being added to unfold the list.
 *
 * And Record settles it beyond argument. That screen is an ACTION, not a
 * destination — it is the one screen in this app where the point is to leave it
 * immediately, with a phone in one hand in a gym. Collapsing it by default
 * would add a tap to the most consequential path in the product to save a
 * scroll on a screen most people never scroll.
 *
 * So the fold is something a person CHOOSES, one system at a time, and the two
 * sets above are the record of those choices and nothing else.
 */

/**
 * A system's workouts, behind a disclosure its own row opens and closes.
 *
 * Everything the row already carried is passed straight through in `summary`
 * and rendered untouched — the rating badge on the Workouts tab, the programme
 * name on Record. This helper adds a chevron and takes nothing away.
 *
 * @param {object}      o
 * @param {Set<string>} o.memory   the screen's own record of what is folded.
 * @param {string}      o.id       the system id — its key in that memory.
 * @param {string}      o.cls      the classes the row wore before it was a
 *                                 summary, so it still looks like itself.
 * @param {Node|Node[]} o.summary  what the row says. Untouched.
 * @param {Node|Node[]} o.body     the workouts inside it.
 */
function systemGroup({ memory, id, cls, summary, body }) {
  const node = el('details', { class: 'sys-group', open: !memory.has(id), dataset: { sys: id } },
    el('summary', { class: cls },
      summary,
      // The chevron this app already has, TURNED rather than swapped for a
      // second glyph. `.me-other` does the same thing, so one rotation means
      // "this is open" in all three places that disclose anything — and the
      // rotation is the only difference between "go and look at that" and "this
      // unfolds here", which is a difference a still picture cannot carry.
      el('span', { class: 'sys-chev' }, chevron()),
    ),
    body,
  );

  /* ⚠️ THE MEMORY IS WRITTEN FROM `toggle`, NOT FROM A CLICK ON THE SUMMARY.
   * A `<details>` also opens from the keyboard, from find-in-page, and from a
   * screen reader's own expand — a click listener would miss all three, and the
   * memory would then disagree with the screen until the next re-render put the
   * disagreement on display. `toggle` fires however it moved. */
  node.addEventListener('toggle', () => {
    if (node.open) memory.delete(id); else memory.add(id);
  });
  return node;
}

export async function StartPickerView({ tab = false } = {}) {
  const [systems, workouts, sessions] = await Promise.all([
    store.getSystems(), store.getWorkouts(), store.getSessions(),
  ]);

  /* ⚠️ THE SUGGESTION LIVES HERE NOW — Tim, 2026-08-25: *"all of the 'suggested
   * workout' and 'choose another workout' stuff [moves] to the Record section,
   * so we don't double dip."*
   *
   * It was Home's whole top half. Home is becoming a feed of what your friends
   * did, and a screen cannot be both a place you read and a place you act
   * without one of the two winning — which is the same argument that put Record
   * in the middle of the tab bar in the first place (D4).
   *
   * ⚠️ AND "CHOOSE ANOTHER WORKOUT" DIES RATHER THAN MOVES. On Home it was the
   * escape hatch from the suggestion, pointing at this screen. On this screen
   * the full list is already the thing underneath it, so the button would point
   * at what it is sitting on top of.
   *
   * This is a LOOKUP, not advice: the order came out of the user's own system.
   * It never refuses and never scolds, and the caption always says what it read.
   */
  const next = suggestNext({ systems, workouts, sessions, today: todayISO() });

  // GROUPED, not nested. Making someone pick a system and then a workout would
  // add a tap to the one screen that is used mid-gym, and most people have one
  // system anyway.
  const groups = systems
    .map((sys) => ({ sys, items: workouts.filter((w) => w.systemId === sys.id) }))
    .filter((g) => g.items.length);

  // ⚠️ A CHEVRON USED TO SIT HERE AND IT WAS TELLING THE TRUTH ABOUT THE WRONG
  // THING. Tim, after his second gym session (2026-08-25): *"it's not clear that
  // by clicking on any of the workouts that you'll actually start a workout,
  // it's easy to assume that you'd just look into details about it."* He is
  // right, and the reason is that a chevron means exactly one thing everywhere
  // else in this app — go and look at that. Every other `.row` in the product
  // navigates to a detail screen; this one begins a session, which is the single
  // most consequential tap in the app (D4), and it was wearing the same clothes.
  //
  // The word, not just a glyph. "Start" is unambiguous in a way a play triangle
  // is not — a triangle could as easily mean "expand" — and this is the screen
  // where being certain matters most, because the cost of being wrong is
  // starting a session you did not mean to start mid-gym.
  // The time each workout takes (Tim, 2026-08-26): the median of ITS OWN
  // recorded durations once any exist — startedAt/finishedAt have been on
  // every session all along — and sets × 3 min before that. Rounded to 5,
  // and "~" carries the honesty either way.
  const row = (w) => {
    const est = estimateWorkoutMinutes(w, sessions);
    return el('button', { class: 'row', onClick: () => go('#/session/' + w.id) },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: w.name }),
        el('div', { class: 'row-sub', text:
          `${plural(w.exercises.length, 'exercise')} · ${plural(totalSets(w), 'set')}`
          + (est ? ` · ~${est.minutes} min` : '') }),
      ),
      el('span', { class: 'row-start' }, 'Start', icon('play', 12)),
    );
  };

  // ⚠️ THE SYSTEM NAME IS ALWAYS SHOWN NOW, INCLUDING WHEN THERE IS ONLY ONE.
  // This reverses a call made on 2026-08-22 — "a sole heading is decoration" —
  // on Tim's report from the gym: *"make the title of the workout system more
  // clear because that's the first thing that the user will try to find."*
  //
  // He is describing how the screen is actually used. You do not arrive here
  // hunting for "Push"; you arrive knowing which programme you are running and
  // look for it, then take the day off it. With one system that heading was not
  // decoration, it was the label on the thing you came for — and it was missing
  // entirely, which is worse than small.
  //
  // It is a real heading rather than `.section-label sub`, which is a 11.5px
  // grey caption. The old sub-label was quieter than the workout names beneath
  // it, so even with several systems the one thing being searched for was the
  // least prominent text in the group.
  // ⚠️ The suggestion is a BUTTON at the top of the list, not a card above it.
  // It is one of the workouts below, promoted — so it wears the same clothes,
  // and the sentence under it says what was read to choose it. A distinct
  // treatment would imply it came from somewhere else.
  const suggestion = next
    ? [
        el('div', { class: 'section-label', text: 'Next in your rotation' }),
        el('button', {
          class: 'btn primary lg block',
          onClick: () => go('#/session/' + next.workout.id),
        }, icon('play'), next.workout.name),
        el('div', { class: 'field-help', text: describeSuggestion(next) }),
      ]
    : [];

  const scroll = groups.length
    ? [
        ...suggestion,
        el('div', { class: 'section-label', text: next ? 'Or start any workout' : 'Start a workout' }),
        // ⚠️ THE HEADING IS THE CONTROL NOW (2026-09-16) — see systemGroup
        // above. It was a `<div class="sys-head">` with the programme's name in
        // it and nothing else; it is a `<summary>` with the same class, the
        // same name and the same type, so everything the 2026-08-25 note
        // demanded of it still holds. What it gains is `.row`: the app's own
        // 46px target and its own press-back, both already written, so a
        // heading that is now tappable is a heading that looks tappable.
        //
        // ⚠️ `.row-main` around the name, not a bare text node, so the chevron
        // is pushed to the far edge of the row rather than sitting against the
        // last letter. `.row-main` sets no type of its own, so the heading's
        // 15px/700 still comes down from `.sys-head` — and the summary's
        // textContent is still exactly the system's name, which is what makes
        // it a legitimate accessible name for the control.
        ...groups.map((g) => systemGroup({
          memory: closedOnRecord,
          id: g.sys.id,
          cls: 'sys-head row',
          summary: el('div', { class: 'row-main', text: g.sys.name }),
          // Untouched: the same rows, in the same order, each still starting a
          // session and still carrying its `~N min`.
          body: el('div', { class: 'list' }, g.items.map(row)),
        })),
      ]
    : [
        // ⚠️ On an empty account this screen must not be a dead end. The
        // first-run work (2026-08-21) got install-to-first-logged-set down to
        // five taps by making a ready-made programme the primary action, and a
        // brand-new user tapping the biggest button in the app lands HERE — so
        // it has to offer the same route rather than "build a workout first".
        emptyState('Nothing to run yet',
          'Pick a ready-made programme and its first workout is one tap away, or build your own.',
          el('button', { class: 'btn primary', text: 'Pick a programme', onClick: () => go('#/explore') })),
        el('button', { class: 'btn block', onClick: () => go('#/system/new') },
          icon('plus'), 'Build my own instead'),
      ];

  // A benchmark is a deliberate one-off test rather than a session, so it sits
  // apart from the list rather than in it — and it is pinned, because the list
  // above is the common case and this must not need scrolling past.
  const bottom = el('button', { class: 'btn block', onClick: () => go('#/benchmark') },
    icon('flag'), 'Record a benchmark');

  return screenShell({
    profile: tab,
    title: 'Record',
    sub: 'Log a session, or a one-off best',
    // Since 2026-08-26 the Record TAB is the category chooser and this whole
    // screen is the Weightlifting option behind it, so back goes there.
    back: tab ? null : () => go('#/record'),
    scroll,
    bottom,
  });
}

/* ================================================================== *
 * Workout systems
 * ================================================================== */

// A SYSTEM is a programme — a named group of workouts. "Push Pull Legs" holding
// a Push, a Pull and a Legs day. Tim, 2026-08-17: he wants several side by side,
// and later to be able to load somebody else's (docs/vision.md §1.3).
//
// The top-level tab lists systems now, not workouts. Everything that used to be
// reachable in one tap still is, because a system with one workout shows that
// workout's name in its subtitle — ~~and the row goes straight into the
// system~~: since 2026-09-16 the row UNFOLDS, and every workout in the
// programme is a row of its own under it, one tap from here. `#/system/<id>` is
// the last row inside the group. See systemGroup() for why the tap changed.
export async function WorkoutsView() {
  const [systems, workouts] = await Promise.all([store.getSystems(), store.getWorkouts()]);
  // ~~`countIn`~~ — the row needs the workouts themselves now, not a count of
  // them, so each system filters once and reads both off the one array.
  const ratings = await rateOwnSystems(systems, workouts);

  return screenShell({
    profile: true,
    title: 'Workouts',
    sub: systems.length ? plural(systems.length, 'system') : null,
    top: [
      el('button', { class: 'btn primary block', onClick: () => go('#/system/new') },
        icon('plus'), 'New system'),
      // Browsing ready-made systems is the low-effort path and belongs beside
      // the high-effort one, not buried in an empty state where someone who
      // already has a system would never find it.
      el('button', { class: 'btn block', onClick: () => go('#/explore') },
        icon('search'), 'Explore ready-made programmes'),
    ],
    scroll: systems.length
      ? el('div', { class: 'list' }, systems.map((sys) => {
          const mine = workouts.filter((w) => w.systemId === sys.id);
          const n = mine.length;
          const names = mine.map((w) => w.name);

          // Unchanged, and it has to be: this is what the row says about
          // itself, and the rating badge is the four numbers Tim asked to have
          // on the list rather than only inside the programme.
          const says = [
            el('div', { class: 'row-main' },
              el('div', { class: 'row-title wrap', text: sys.name }),
              // `.wrap`, for the same reason as the Explore list: the rating
              // takes width off this line, and the workout names are what tell
              // you which programme this is. Clipping "Push · Pull · Legs" to
              // "Push · Pu…" would trade the content for the ornament.
              el('div', { class: 'row-sub wrap', text: n
                // The workout names ARE the useful subtitle — "3 workouts" says
                // nothing you could not guess, "Push · Pull · Legs" tells you
                // what the programme is.
                //
                // ⚠️ IT STAYS ON THE ROW EVEN WHEN THE GROUP IS OPEN, and the
                // near-duplication with the rows below is deliberate. It is a
                // PREVIEW — up to four names, then "· …" — while the rows are
                // the detail, each with its exercise and set counts. Swapping
                // it for "3 workouts" on open would mean the row's identity
                // line changes meaning under the finger that just tapped it,
                // and it would leave a collapsed row saying less than it says
                // today, which is the one thing this change must not do.
                ? names.slice(0, 4).join(' · ') + (names.length > 4 ? ' · …' : '')
                : 'No workouts yet' }),
            ),
            ratingBadge(ratings.get(sys.id)),
          ];

          /* ⚠️ AN EMPTY SYSTEM IS NOT A DISCLOSURE, IT IS STILL A LINK. There is
           * nothing under it to unfold, and a chevron that turns to reveal
           * nothing is a control that lies about having something. So a
           * programme with no workouts in it is exactly the row it has always
           * been, going exactly where it has always gone — which is also the
           * only place you can add the workouts it is missing. */
          if (!n) {
            return el('button', { class: 'row row-rated', onClick: () => go('#/system/' + sys.id) },
              says, chevron());
          }

          /* Tim, 2026-09-16: *"I want you to be able to click on the system in
           * order to close or open the display of the workouts within them."*
           *
           * ⚠️ THE WORKOUTS ARE REAL ROWS HERE NOW. They existed on this screen
           * only as names in the subtitle, and a disclosure that unfolds to
           * reveal the line you were already reading would be theatre. They are
           * the same rows the system screen shows — same wording, same order,
           * same `#/workout/<id>` — because a workout must not describe itself
           * two ways in two places.
           *
           * 🚨 AND THE WAY INTO THE SYSTEM ITSELF SURVIVES, as the last row in
           * the group. The summary opens and closes now, so it cannot also
           * navigate; `#/system/<id>` is where Edit, Notes, New workout and the
           * full rating live, and the Workouts tab is its front door (the Goals
           * screen links there too, but nobody finds a programme by going to
           * Goals). Dropping the route rather than moving it would have been a
           * feature that quietly deleted a screen. */
          return systemGroup({
            memory: closedOnWorkouts,
            id: sys.id,
            cls: 'row row-rated',
            summary: says,
            body: el('div', { class: 'list' },
              mine.map((w) => el('button', { class: 'row', onClick: () => go('#/workout/' + w.id) },
                el('div', { class: 'row-main' },
                  el('div', { class: 'row-title', text: w.name }),
                  el('div', { class: 'row-sub', text:
                    `${plural(w.exercises.length, 'exercise')} · ${plural(totalSets(w), 'set')}`
                    + (w.isBenchmark ? ' · benchmark' : '') }),
                ),
                chevron(),
              )),
              el('button', { class: 'row', onClick: () => go('#/system/' + sys.id) },
                el('div', { class: 'row-main' },
                  el('div', { class: 'row-title', text: 'Open this system' }),
                  el('div', { class: 'row-sub wrap', text:
                    'Add a workout, edit the programme, read how it rates' }),
                ),
                chevron(),
              ),
            ),
          });
        }))
      : emptyState('No systems yet',
          'A system is a programme — a named group of workouts. Push Pull Legs, Upper/Lower, '
          + 'whatever you follow. Build one, or start from a ready-made one.'),
  });
}

/* ================================================================== *
 * How one exercise's sets are structured
 * ================================================================== */

// Three types with a count is past what a cycling chip can carry, so this is a
// sheet: every option visible, each explained in one line, and the count only
// shown once it means something. The explanations matter more than the names —
// "myo-reps" is jargon and the whole point of D8 is to teach at the moment of
// use rather than expect somebody to already know.
const SET_TYPES = [
  { id: null, name: 'Straight sets', hint: 'Normal sets with a full rest between them.' },
  { id: DROP, name: 'Drop set',
    hint: 'Take the set, strip the weight, keep going. Counts as one hard set.' },
  { id: MYO, name: 'Myo-reps',
    hint: 'Take the set close to failure, rest 10–15 seconds, then squeeze out short '
      + 'mini-sets at the same weight. Counts as one hard set.' },
];

export function openSetTypeSheet(item, onChange) {
  const body = el('div', { class: 'list' });

  const draw = () => {
    setChildren(body, ...SET_TYPES.flatMap((t) => {
      const on = (item.setType || null) === t.id;
      const rows = [el('button', {
        class: 'row' + (on ? ' is-on' : ''),
        'aria-pressed': String(on),
        onClick: () => {
          if (t.id == null) { delete item.setType; delete item.minis; }
          else { item.setType = t.id; item.minis = plannedMinis({ setType: t.id }); }
          draw();
          onChange();
        },
      },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: t.name }),
          el('div', { class: 'row-sub wrap', text: t.hint }),
        ),
        on ? icon('check', 18) : null,
      )];

      // The count belongs under the type it counts, and nowhere at all when
      // the answer is "straight sets".
      if (on && t.id != null) {
        rows.push(el('div', { class: 'builder-controls set-type-count' },
          el('span', { class: 'builder-control-label',
            text: t.id === MYO ? 'Mini-sets' : 'Drops' }),
          miniStepper({
            value: plannedMinis(item), min: 1, max: 6,
            label: t.id === MYO ? 'mini-sets after each set' : 'drops after each set',
            onChange: (v) => { item.minis = clampMinis(v); draw(); onChange(); },
          }),
        ));
      }
      return rows;
    }));
  };
  draw();

  openSheet({ title: 'How are these sets done?', body });
}

/* ================================================================== *
 * Explore ready-made systems
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * Rule 9 on these screens — the "?" holds WHY, never WHAT
 *
 * Tim, 2026-09-08: "many details in the ready-made workout systems" are too
 * wordy. What was measured: 186 grey words under the Explore list, and the
 * rating block on a system's own screen was already down as ~350 unbroken ones
 * in August (see `.own-rating` in css/app.css). Identical on every visit, under
 * the only things that change — the nine programmes and their four numbers.
 *
 * ⚠️ `.own-rating`'s CSS comment says "nothing here is hidden or shortened,
 * because a disclosure is how a caveat stops being read". That was written on
 * 2026-08-21 and Rule 9 (2026-09-07) is the answer to it: a caveat behind a ?
 * is still stated, and what governs is whether it is WHAT or WHY. The gap that
 * comment asks for is still doing its job — these are still separate claims.
 *
 * 🚨 NOT ONE WORD WAS DELETED FOR BEING LONG, and the split here is stricter
 * than on any other screen because some of this prose is about SOMEBODY ELSE'S
 * WORK. What stays on the screen, always:
 *
 *   · that a programme was TRANSCRIBED rather than given to us, and by whom —
 *     attribution is never an explanation (see warningBlock below);
 *   · what each badge number measures, and that nothing real reaches 100 %;
 *   · that 3 sets of 20 and 3 sets of 5 get the same strength percentage —
 *     §3 "What the strength score cannot see" says so in words, because a
 *     `title` does nothing on a phone and a phone is where this is read;
 *   · that indirect work counts half a set.
 *
 * Behind the ?: where the number came from and why it is drawn that way.
 * ------------------------------------------------------------------ */

/**
 * Cut a caveat that ships from another module into the half that stays on the
 * screen and the half that goes behind the ?.
 *
 * ⚠️ THE CONSTANT IS NEVER RE-TYPED HERE. `STRENGTH_CAVEAT` lives in optimal.js
 * beside the number it is about (and volume-map.js records what happened the one
 * time a screen hand-wrote its own paraphrase: it quietly lost "not a measured
 * fact"). This splits the real string at a marker inside it, so both halves are
 * still the words that ship with the constant.
 *
 * ⚠️ AND IF THE MARKER IS EVER GONE, EVERYTHING STAYS ON THE SCREEN. A caveat
 * may fail loud; it may never fail quiet.
 */
function splitCaveat(text, marker) {
  const s = String(text || '');
  const i = s.indexOf(marker);
  if (i < 0) return { seen: s, why: null };
  let seen = s.slice(0, i).replace(/[\s—–,]+$/, '');
  if (!/[.!?]$/.test(seen)) seen += '.';
  const why = s.slice(i).replace(/^[\s—–]+/, '');
  return { seen, why: why.charAt(0).toUpperCase() + why.slice(1) };
}

/**
 * A block of prose as its sentences.
 *
 * ⚠️ "Dr." AND "Mr." ARE NOT THE END OF A SENTENCE, and both appear in these
 * strings — "These workouts are NOT Dr. Israetel's" and "a four-time Mr.
 * Olympia's programme". Breaking there would cut an attribution in half, which
 * is the one thing this file may not do.
 *
 * ⚠️ No lookbehind: Safari only learned it in 16.4 and an iPhone is the target.
 */
function sentencesOf(text) {
  const s = String(text || '');
  const out = [];
  const re = /[.!?]\s+/g;
  let start = 0;
  let m;
  while ((m = re.exec(s))) {
    const head = s.slice(start, m.index + 1).trim();
    if (/\b(?:Dr|Mr|Mrs|Ms|St)\.$/.test(head)) continue;
    out.push(head);
    start = m.index + m[0].length;
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * The two caveats that travel with EVERY rating, wherever one is drawn.
 *
 * Both are stated on the screen and both keep their full text one tap away.
 * The strength one keeps its concrete half visible on purpose — "3 sets of 20
 * and 3 sets of 5 get the same strength percentage" changes what the reader
 * thinks the number IS, so it is not allowed behind a dot; what moved is why
 * that matters and by how much. The half-a-set line follows the Volume screen,
 * which says "indirect work counts half" on the screen and keeps the modelling
 * argument behind its ?.
 */
function ratingCaveats() {
  const strength = splitCaveat(STRENGTH_CAVEAT, 'They are not the same');
  return [
    el('div', { class: 'help-line' },
      el('span', { class: 'field-help', text: strength.seen }),
      strength.why
        ? helpDot(strength.why, { label: 'Why the weight matters for strength' })
        : null),
    el('div', { class: 'help-line' },
      el('span', { class: 'field-help', text: 'Indirect work counts half a set.' }),
      helpDot(INDIRECT_NOTE_RATING,
        { label: 'Why indirect work counts half', title: 'Half a set' })),
  ];
}

/**
 * The rating beside a ready-made system.
 *
 * ⚠️ TWO numbers, never one, and never a bare "83 % optimal". A programme good
 * for growth is often not the one good for strength — the Golden Six is the
 * clearest case in the library — and a single blended figure would hide exactly
 * the trade somebody is choosing between. Tim ratified this on 2026-08-18.
 *
 * The scores are banded to 5 before they get here (js/optimal.js), because the
 * source models explain about a quarter of the variance and a sharper number
 * would be claiming a precision nobody has.
 */
function ratingBadge(rating) {
  if (!rating) return null;

  // Tim, 2026-08-19: the two percentages say how GOOD a programme is and say
  // nothing about what it costs, which is the first thing anybody wants before
  // they open it. Days and minutes are that cost, and they belong beside the
  // scores rather than only inside the system — "80 % strength" reads very
  // differently at 3 days a week than at 6.
  //
  // A 2x2 grid, not one row of four. Four cells side by side is ~180px, which
  // on a 390px phone leaves the system's NAME with about half the row — and
  // Rule 3 says the name is the content and the badge is the ornament.
  const days = rating.daysPerWeek > 0
    ? trimNum(Math.round(rating.daysPerWeek * 10) / 10)
    : null;
  const minutes = rating.minutesPerSession > 0 ? Math.round(rating.minutesPerSession) : null;

  const cell = (value, cap, title) => el('div', { class: 'rating-cell', title: title || null },
    el('div', { class: 'rating-num', text: value }),
    el('div', { class: 'rating-cap', text: cap }),
  );

  return el('div', { class: 'rating' },
    cell(rating.hypertrophy + '%', 'growth'),
    // ⚠️ The strength cell carries what it cannot see. A planned workout stores
    // a set count and no load, so 3x20 and 3x5 land on the same percentage —
    // and load is the single biggest thing there is for strength (SMD 0.60,
    // docs/research.md §6.13). A `title` alone does nothing on a phone, which is
    // why the same caveat is spelled out in full on the system screen and under
    // the Explore list rather than only here.
    cell(rating.strength + '%', 'strength', STRENGTH_CAVEAT_SHORT),
    days ? cell(days, 'days/wk', 'Training days a week') : null,
    minutes
      ? cell('~' + minutes, 'min', rating.minutesEstimated
          ? 'Estimated from the set count, at about 3 minutes a set including rest'
          : 'As stated by the programme')
      : null,
  );
}

/**
 * Rate every one of the user's own systems, for the Workouts list.
 *
 * One pass over sessions and one exercise map for the whole list rather than
 * per row — the same reason the Explore list rates its presets once.
 *
 * A system with no workouts gets no entry, so `ratingBadge` renders nothing for
 * it. An empty programme is not a bad programme, it is an unfinished one, and
 * showing it a 0 % would be both wrong and discouraging.
 */
async function rateOwnSystems(systems, workouts) {
  const out = new Map();
  if (!systems || !systems.length) return out;

  const [{ rateUserSystem }, exMap, sessions, declared] = await Promise.all([
    import('./optimal.js'), store.getExerciseMap(), store.getSessions(), declaredFor(systems),
  ]);
  const today = todayISO();

  for (const sys of systems) {
    const own = workouts.filter((w) => w.systemId === sys.id);
    if (!own.length) continue;
    const ids = new Set(own.map((w) => w.id));
    const d = declared.get(sys.id) || {};
    const rating = rateUserSystem(own, exMap, {
      sessionDates: sessions.filter((s) => ids.has(s.workoutId)).map((s) => s.date),
      todayISO: today,
      declaredDaysPerWeek: d.daysPerWeek,
      cycleDays: d.cycleDays,
      minutesPerSession: d.minutes,
    });
    if (rating && rating.raw.hypertrophy > 0) out.set(sys.id, rating);
  }
  return out;
}

/**
 * What each system says about how often it is meant to be trained.
 *
 * A system copied from a ready-made one now carries `daysPerWeek` itself. But
 * copies made BEFORE that fix do not, so anything with a `presetId` falls back
 * to looking it up — otherwise Tim's existing library keeps showing the old,
 * lower numbers and the fix appears not to have worked.
 */
async function declaredFor(systems) {
  const out = new Map();
  const needsLookup = systems.some((s) => s.presetId && !s.daysPerWeek);
  const presets = needsLookup
    ? (await import('./preset-systems.js')).PRESET_SYSTEMS
    : [];

  for (const sys of systems) {
    if (sys.daysPerWeek) {
      out.set(sys.id, { daysPerWeek: sys.daysPerWeek, cycleDays: sys.cycleDays, minutes: sys.minutes });
      continue;
    }
    const p = sys.presetId && presets.find((x) => x.id === sys.presetId);
    if (p) out.set(sys.id, { daysPerWeek: p.daysPerWeek, cycleDays: p.cycleDays, minutes: p.minutes });
  }
  return out;
}

/**
 * The rating for a system the user built themselves.
 *
 * The only thing a ready-made system has that this does not is a declared
 * days-per-week — so it is MEASURED from their own logged sessions instead
 * (js/optimal.js), and the caption says which of the two it used. A rating
 * computed from an assumption and one computed from ten sessions are not the
 * same claim and must not look alike.
 *
 * Returns null rather than an empty box when there is nothing to rate: an empty
 * system, or one whose exercises all fall outside what can be scored.
 */
async function ownSystemRating(systemId, workouts, systemRow) {
  if (!systemId || !workouts || !workouts.length) return null;

  const [{ rateUserSystem, explain }, exMap, sessions] = await Promise.all([
    import('./optimal.js'), store.getExerciseMap(), store.getSessions(),
  ]);

  const ids = new Set(workouts.map((w) => w.id));
  const sessionDates = sessions.filter((s) => ids.has(s.workoutId)).map((s) => s.date);

  const declared = (await declaredFor([systemRow || { id: systemId }])).get(systemId) || {};
  const rating = rateUserSystem(workouts, exMap, {
    sessionDates,
    todayISO: todayISO(),
    declaredDaysPerWeek: declared.daysPerWeek,
    cycleDays: declared.cycleDays,
    minutesPerSession: declared.minutes,
  });
  if (!rating || !(rating.raw.hypertrophy > 0)) return null;

  const under = rating.under;
  // ⚠️ THE SCORE AND ITS CEILING STAY ON THE SCREEN; THE ARITHMETIC BEHIND THE
  // CEILING DOES NOT. "Nothing real reaches 100 %" is what the percentage IS —
  // without it 55 % reads as a bad mark — while "42 hard sets per muscle every
  // week" is where that ceiling came from, which is WHY.
  const growth = splitCaveat(explain(rating.hypertrophy), 'that would mean');
  return el('div', { class: 'own-rating' },
    el('div', { class: 'own-rating-head' },
      el('div', { class: 'section-label', text: 'How this programme rates' }),
      ratingBadge(rating),
    ),
    // What the number is based on — measured, declared or assumed. WHAT, in
    // full: a rating computed from an assumption and one computed from ten
    // sessions are not the same claim and must not look alike.
    el('div', { class: 'field-help', text: rating.caption }),
    el('div', { class: 'help-line' },
      el('span', { class: 'field-help', text: growth.seen }),
      growth.why ? helpDot(growth.why, { label: 'Why nothing reaches 100 %' }) : null),
    // Coverage in words, never folded into the score — "a good programme that
    // skips calves" should read as exactly that, and it is the most actionable
    // thing on the screen.
    under.length
      ? el('div', { class: 'field-help', text:
          `Under 4 sets a week, which is the least that produces a measurable change: `
          + `${under.join(', ')}.` })
      : el('div', { class: 'field-help', text:
          'Every muscle group gets at least the minimum effective dose.' }),
    // ⚠️ The two things these numbers do not know, on the screen where somebody
    // actually stops and reads them. D8: at the moment of use, never in a
    // manual. Both strings still come from the modules that own the constants
    // they are about, so neither can drift — see ratingCaveats(), which keeps
    // the fact on the screen and the reasoning one tap away.
    ...ratingCaveats(),
  );
}

/** Rate every preset once, so the list does not recompute per row. */
async function rateAllPresets(presets) {
  const [{ rateProgramme }, exMap] = await Promise.all([
    import('./optimal.js'), store.getExerciseMap(),
  ]);
  const byName = new Map([...exMap.values()].map((e) => [e.name, e]));
  const out = new Map();

  for (const p of presets) {
    const workouts = (p.workouts || []).map((w) => ({
      exercises: (w.exercises || []).map((i) => {
        const e = byName.get(i.name);
        return e ? { exerciseId: e.id, sets: Number(i.sets) || 3 } : null;
      }).filter(Boolean),
    }));
    if (!workouts.length) continue;
    out.set(p.id, rateProgramme(workouts, exMap, {
      daysPerWeek: p.daysPerWeek,
      minutesPerSession: p.minutes,
      // Bumstead's is an EIGHT-day cycle, not a week — it drifts across the
      // calendar on purpose, and counting it as a week would overstate every
      // number on his row by about a seventh.
      cycleDays: p.cycleDays || 0,
    }));
  }
  return out;
}

export async function ExploreView() {
  const [{ PRESET_SYSTEMS, presetSetCount }, added] = await Promise.all([
    import('./preset-systems.js'), store.addedPresetIds(),
  ]);
  const ratings = await rateAllPresets(PRESET_SYSTEMS);

  return screenShell({
    title: 'Ready-made programmes',
    back: () => go('#/workouts'),
    scroll: [
      // ⚠️ ONE SENTENCE AT THE MOMENT OF THE WORD SWAP (UX review: "programme"
      // becomes "system" on the next tap, and the definition lived on a screen
      // the first-run path routes past). A stranger arrives here from "Pick a
      // programme"; the bridge is built where they are standing (D8).
      // ⚠️ THE WORD SWAP STAYS ON THE SCREEN. What went behind the ? is what
      // owning the copy lets you DO, which is a consequence of "copied" rather
      // than part of it.
      el('div', { class: 'help-line' },
        el('span', { class: 'field-help', text:
          'Pick one and it is copied into your systems — a system is just a programme you own.' }),
        helpDot('From then on it is yours: rename it, change the exercises, delete what you do '
          + 'not do.', { label: 'What happens when you add one' })),
      // ⚠️ WHAT THE NUMBERS MEAN, BEFORE THE NINE NUMBERS (UX review: "Explore
      // ranks nine programmes by a number it explains nine cards later"). The
      // caveats stay below; this is the line without which 55 % reads as a bad
      // mark, so both halves of it — what the percentage measures, and that
      // nothing real reaches 100 % — are WHAT and stay put.
      //
      // ⚠️ "Nothing real reaches 100 %" USED TO BE SAID TWICE, here in passing
      // and again in full under the list. It is said once now, here, where the
      // reader meets the first badge; the 42-sets arithmetic that was the rest
      // of that sentence is WHY and went behind this dot.
      el('div', { class: 'help-line' },
        el('span', { class: 'field-help', text:
          'Each badge: how much of the growth and strength stimulus the research supports a '
          + 'programme delivering, plus what it costs in days a week and minutes a session. '
          + 'Nothing real reaches 100 %.' }),
        helpDot('That would mean 42 hard sets per muscle every week.',
          { label: 'Why nothing reaches 100 %' })),
      el('div', { class: 'list' }, PRESET_SYSTEMS.map((p) =>
        el('button', { class: 'row row-rated', onClick: () => go('#/explore/' + p.id) },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title wrap' },
              p.name,
              added.has(p.id) ? el('span', { class: 'tag', text: 'Added' }) : null,
            ),
            // Whose it is, before anything else — but "follows X's method" and
            // "by X" are different claims and the list has to keep them apart.
            // ⚠️ Days and minutes used to be repeated here. They moved INTO the
            // badge on 2026-08-19, and repeating them in both places would be
            // noise taking width off the summary — which is the line that
            // actually tells you what the programme is.
            el('div', { class: 'row-sub wrap', text:
              (p.author && p.author !== 'Fitness Tracker' ? `${p.author} · `
                : p.basedOn ? `Follows ${p.basedOn.person} · ` : '')
              + p.level }),
            el('div', { class: 'row-sub wrap', text: p.summary }),
          ),
          ratingBadge(ratings.get(p.id)),
          chevron(),
        ))),
      // The two assumptions inside the percentage. Both are WHAT — they change
      // what the reader thinks the number is a percentage OF — so neither goes
      // behind a dot. What left this line is the "nothing reaches 100 %"
      // sentence, which the line above the list now carries on its own.
      el('div', { class: 'field-help', text:
        'The percentages assume you train close to failure, and more days is not itself better '
        + 'for growth.' }),
      // ⚠️ These two go under the list, not only in a tooltip. A `title` is
      // invisible on a phone, and this is where a stranger is comparing nine
      // strength percentages against each other — the exact moment the number's
      // blind spot matters most. Rule 9 splits each of them: the blind spot
      // itself on the screen, why it matters behind the ?.
      ...ratingCaveats(),
      el('div', { class: 'field-help', text:
        `${PRESET_SYSTEMS.length} to choose from, with more to come.` }),
    ],
  });
}

/* ================================================================== *
 * One ready-made system, before you commit to it
 * ================================================================== */

/**
 * The red-ruled warning above a transcribed programme.
 *
 * 🛑 NOTHING HERE IS HIDDEN AND NOTHING HERE MAY BE. Every other block on these
 * screens gave its WHY to a "?"; this one did not, and the reason is that a
 * `warning` is not a caveat about a number — it is a statement about what the
 * programme IS. That it was transcribed from a published write-up rather than
 * handed to us, that Bumstead's rotation is an eight-day cycle and not a week,
 * that Israetel's is a cutting split, that the versions of Arnold's disagree:
 * a reader must not be able to mistake any of that for the author's own upload
 * WITHOUT TAPPING ANYTHING. Attribution behind a disclosure is not attribution.
 *
 * ⚠️ SO THE FIX HERE IS SHAPE, NOT DISCLOSURE — Rule 9's "re-shaping is as
 * often the fix as hiding". Up to seventy words arrived as one dense red
 * paragraph and left as a lead plus the things to know. The words are the
 * warning's own, unedited and in their own order; only the line breaks are new.
 *
 * ⚠️ THE LEAD IS TWO SENTENCES, NEVER ONE. All but one of these open with the
 * three words "Not official." and the claim only lands with the sentence after
 * it — and `tests/render.test.mjs` reads the first forty characters of the
 * warning as one string, which straddles that break.
 */
function warningBlock(text) {
  const parts = sentencesOf(text);
  if (parts.length <= 2) return el('div', { class: 'preset-warning' }, el('span', { text }));
  const lead = parts.slice(0, 2).join(' ');
  const rest = parts.slice(2);
  return el('div', { class: 'preset-warning' },
    el('div', { text: lead }),
    rest.length > 1
      // Three things in one paragraph are three things nobody counts — the same
      // reason the visibility sheet's sentence became `.vis-list`.
      ? el('ul', { class: 'vis-list' }, rest.map((s) => el('li', { text: s })))
      : el('div', { text: rest[0] }),
  );
}

export async function ExploreDetailView(id) {
  const [{ presetById, presetSetCount }, added] = await Promise.all([
    import('./preset-systems.js'), store.addedPresetIds(),
  ]);
  const preset = presetById(id);

  if (!preset) {
    return screenShell({
      title: 'Not found', back: () => go('#/explore'),
      scroll: emptyState('That system no longer exists', 'It may have been renamed or removed.'),
    });
  }

  const alreadyAdded = added.has(preset.id);

  async function add() {
    const { system, skipped } = await store.addPresetSystem(preset);
    toast(skipped ? `Added — ${skipped} exercise(s) skipped` : 'Added to your systems');
    go('#/system/' + system.id);
  }

  return screenShell({
    title: preset.name,
    back: () => go('#/explore'),
    scroll: [
      // NOT "sets a week". These workouts repeat — a 6-day PPL runs its three
      // workouts twice — so the total across the workouts is not a weekly
      // figure, and printing it as one would overstate or understate every
      // programme by a different factor.
      el('div', { class: 'field-help', text:
        `${preset.goal} · ${preset.daysPerWeek} days a week · around ${preset.minutes} minutes a `
        + `session · ${preset.level} · ${presetSetCount(preset)} sets across `
        + `${plural(preset.workouts.length, 'workout')}` }),

      // Who wrote it, always. A system from somewhere else must never look like
      // one the app wrote, and the link out is how someone checks it.
      el('div', { class: 'field-help' },
        'By ', el('b', { text: preset.author || 'Unknown' }),
        preset.sourceName ? ' · ' : '',
        preset.sourceUrl
          ? el('a', { href: preset.sourceUrl, target: '_blank', rel: 'noopener noreferrer',
                      text: preset.sourceName || 'Source' })
          : (preset.sourceName || null),
      ),

      // A system that FOLLOWS someone's published method is not a system BY
      // them, and the two must never render the same way. The byline above
      // stays truthful (it says who chose the exercises); this line is where
      // the credit goes.
      preset.basedOn
        ? el('div', { class: 'field-help' },
            'Follows ', el('b', { text: preset.basedOn.person }), '’s ',
            preset.basedOn.what || 'published method',
            '. The workouts below are not theirs.')
        : null,

      // Loud, not a footnote. Someone reading a programme attributed to a real
      // person has to know whether that person actually wrote what is on screen.
      // The default assumes a video transcription, which is true of exactly one
      // system here — anything else states its own case.
      preset.unofficial
        ? warningBlock(preset.warning
            || 'Not official. Transcribed from published write-ups of the free videos, '
               + 'not from the author or their paid programme. Sets and reps are as reported — '
               + 'check the source before you trust a number.')
        : null,

      preset.notes
        ? el('div', { class: 'preset-notes' },
            // Paragraph breaks in the notes are real paragraphs, not one wall of text.
            ...preset.notes.split(/\n{2,}/).map((para) => el('p', { text: para })))
        : null,

      ...preset.workouts.flatMap((w) => [
        el('div', { class: 'section-label', text: w.name }),
        w.notes ? el('div', { class: 'field-help', text: w.notes }) : null,
        el('div', { class: 'list' }, w.exercises.map((e) =>
          el('div', { class: 'row static' },
            el('div', { class: 'row-main' },
              exerciseLabel({ exercise: byExerciseName(e.name), name: e.name,
                tag: 'div', className: 'row-title' }),
              e.notes ? el('div', { class: 'row-sub', text: e.notes }) : null,
            ),
            el('div', { class: 'row-meta mono', text: plural(e.sets, 'set') }),
          ))),
      ]),
    ],
    bottom: [
      el('button', {
        class: 'btn primary block',
        text: alreadyAdded ? 'Add another copy' : 'Add to my systems',
        onClick: add,
      }),
      // ⚠️ The button above already says "Add another copy" when this shows, so
      // "You have already added this one" was the button read back to the
      // reader — the shape Rule 9 deletes rather than hides. What is left is
      // the half the button does not say: the two copies are separate.
      alreadyAdded
        ? el('div', { class: 'field-help', text:
            'Adding it again makes a second, separate copy.' })
        : null,
    ],
  });
}

/* ================================================================== *
 * One system: its workouts, and its name
 * ================================================================== */

/**
 * ⚠️ A SYSTEM HAS TWO SCREENS NOW, AND IT USED TO HAVE ONE.
 *
 * `#/system/<id>` opened the EDITOR: a name field and a notes box pinned above,
 * Save changes and Delete system pinned below, and the workouts somewhere under
 * the rating. Measured on a phone 2026-08-21 — 303px of an 852px screen was
 * permanently form, and **the first workout was 468px down a 445px pane**, so
 * the Push/Pull/Legs you opened the programme to reach was more than a full
 * screenful below the fold. A full-width *Delete system* sat in the thumb zone
 * the whole time.
 *
 * Tim chose the split on 2026-08-21: reading is the screen, editing is behind
 * the pencil. That is the pattern a calendar day already uses, so it is not a
 * new idea in this app — it is the one the Workouts tab had missed.
 *
 *   #/system/<id>        the programme: its workouts, then how it rates
 *   #/system/<id>/edit   the form: name, notes, Save, Delete
 *   #/system/new         the form, with nothing to read yet
 */
export async function SystemRouteView(param) {
  const [id, tail] = String(param || '').split('/');
  if (id === 'new' || tail === 'edit') return SystemEditorView(id);
  return SystemDetailView(id);
}

/**
 * The plan, as boxes — 2026-09-16, Tim: *"If the workout system does have this
 * daily planner then show it as boxes at the top of the workout system when you
 * click on it in the 'workouts' section."*
 *
 * Returns null when the system has no plan, which is the ordinary case and is
 * why every system that had no schedule yesterday looks exactly the same today.
 *
 * ⚠️ EVERY SLOT IS DRAWN, INCLUDING THE EMPTY ONES. A plan with Thursday missing
 * is not the same picture as a plan with six days in it: "Thu — Rest" is the
 * information, and a grid that silently skips its rest days makes a 6-day split
 * look like a 6-day WEEK. That is the whole of "rest days visibly empty rather
 * than missing".
 *
 * ⚠️ REST AND UNSET ARE DIFFERENT WORDS, on purpose. `Rest` is something the
 * user chose; `—` is a day nothing has been said about — including a day whose
 * workout was deleted out from under it (store.deleteWorkout empties the slot
 * rather than resting it). Printing "Rest" for both would be the app inventing a
 * rest day on somebody's behalf, which is Rule 6 in one word.
 *
 * ⚠️ A SLOT NAMING A WORKOUT THAT IS GONE READS AS UNSET RATHER THAN THROWING.
 * The store repairs the row on deletion, so this should not happen — but a
 * restored backup, a half-written row, or a plan written before that repair
 * existed can all still arrive here, and "a foreign key is only valid while the
 * rest of that set still exists" is a lesson this project has already paid for
 * once (dropOrphanGroups). Falling back is cheap; a blank screen is not.
 *
 * 🛑 NOTHING HERE ASKS WHAT DAY IT IS. The plan does not decide what the app
 * suggests next — Tim chose display-only — so there is no "today" ring, no "day
 * 3 of 4", and no verdict about whether the week was followed (Rule 6). The ?
 * says so, because a reader is entitled to assume the opposite.
 */
function planBoxes(schedule, workouts) {
  const plan = normalizeSchedule(schedule);
  if (!plan) return null;

  const nameById = new Map(workouts.map((w) => [w.id, w.name]));
  const heading = plan.kind === WEEK ? 'Weekly plan' : `${plan.slots.length}-day cycle`;

  return el('div', { class: 'plan' },
    el('div', { class: 'help-line' },
      el('div', { class: 'section-label', text: heading }),
      helpDot(
        'A note to yourself about how this programme is meant to run. '
        + 'The app does not use it: Home and Record still offer whichever workout '
        + 'you have gone longest without doing, exactly as they did before, and '
        + 'nothing here checks whether you followed it.',
        { label: 'What does this plan do?', title: heading },
      ),
    ),
    el('div', { class: 'plan-grid' }, plan.slots.map((slot, i) => {
      const short = slotLabel(plan.kind, i);
      const long = slotLabel(plan.kind, i, true);
      const name = slot === REST ? null : nameById.get(slot) || null;
      const state = slot === REST ? 'Rest' : (name || '—');
      return el('div', {
        class: 'plan-day',
        /* ⚠️ `role="img"` WITH THE WHOLE BOX AS ONE PHRASE, which is exactly what
         * an inert `.cal-cell` in js/views-data.js already does — the same
         * problem, so not a second answer to it. The role makes the subtree
         * presentational, so the two spans need no aria-hidden of their own and
         * cannot drift out of step with the label.
         *
         * Read as two nodes, a grid says "Mon" and "Push" as unrelated things:
         * the adjacency IS the meaning and speech has no adjacency. And `—` is
         * not a word, so the empty day has to say so in words. */
        role: 'img',
        'aria-label': `${long}: ${slot === REST ? 'rest' : (name || 'nothing planned')}`,
      },
        el('span', { class: 'plan-dow', text: short }),
        el('span', {
          class: 'plan-slot' + (slot === REST ? ' is-rest' : (name ? '' : ' is-none')),
          text: state,
        }),
      );
    })),
    plan.kind === CYCLE
      ? el('div', { class: 'field-help', text: `Repeats every ${plural(plan.slots.length, 'day')}.` })
      : null,
  );
}

async function SystemDetailView(id) {
  const existing = await store.getSystem(id);
  if (!existing) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      scroll: emptyState('That system no longer exists', 'It may have been deleted.'),
    });
  }

  const workouts = await store.getWorkouts(id);

  return screenShell({
    title: existing.name,
    back: () => go('#/workouts'),
    // The pencil, not a "Settings" or a "…". It names the one thing it does.
    actions: [iconBtn('edit', 'Edit this system', () => go('#/system/' + id + '/edit'))],
    scroll: [
      // ⚠️ THE PLAN GOES ABOVE THE WORKOUTS, AND ONLY WHEN THERE IS ONE.
      // The note below says the workouts come first, and it was written when
      // there was nothing else that could reasonably be above them. Tim asked
      // for these boxes "at the top of the workout system when you click on it",
      // and a plan IS the shape of the programme — it names every workout in the
      // list underneath it and puts each one on a day. A system with no plan is
      // untouched: planBoxes() returns null and the workouts are still the first
      // thing in the pane, which is what the position test in
      // tests/render.test.mjs pins.
      planBoxes(existing.schedule, workouts),
      // The workouts FIRST. They are why anybody opens a programme, and on a
      // phone "first" is the only position that means anything.
      el('div', { class: 'section-label', text: workouts.length
        ? plural(workouts.length, 'workout') : 'Workouts' }),
      workouts.length
        ? el('div', { class: 'list' }, workouts.map((w) =>
            el('button', { class: 'row', onClick: () => go('#/workout/' + w.id) },
              el('div', { class: 'row-main' },
                el('div', { class: 'row-title', text: w.name }),
                el('div', { class: 'row-sub', text:
                  `${plural(w.exercises.length, 'exercise')} · ${plural(totalSets(w), 'set')}`
                  + (w.isBenchmark ? ' · benchmark' : '') }),
              ),
              chevron(),
            )))
        : emptyState('No workouts in this system yet',
            'Add the days this programme is made of — Push, Pull, Legs, or whatever you call them.'),
      el('button', { class: 'btn block', onClick: () => go('#/workout/new/' + id) },
        icon('plus'), 'New workout'),
      // The notes are the author's own words about the programme, so they read
      // here rather than only inside the form that happens to edit them.
      existing.notes
        ? el('div', { class: 'preset-notes' },
            el('div', { class: 'section-label', text: 'Notes' }),
            el('p', { text: existing.notes }))
        : null,
      await ownSystemRating(id, workouts, existing),
    ],
  });
}

async function SystemEditorView(id) {
  const isNew = id === 'new';
  const existing = isNew ? null : await store.getSystem(id);

  if (!isNew && !existing) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      scroll: emptyState('That system no longer exists', 'It may have been deleted.'),
    });
  }

  const workouts = isNew ? [] : await store.getWorkouts(id);
  const draft = existing ? { ...existing } : { id: null, name: '', notes: '' };

  const nameInput = el('input', {
    class: 'input', type: 'text', value: draft.name, maxlength: '60',
    placeholder: 'Push Pull Legs, Upper/Lower…',
    onInput: (e) => { draft.name = e.target.value; },
  });
  const notesInput = el('textarea', {
    class: 'input', rows: '2', maxlength: '300',
    placeholder: 'What is this programme for? (optional)',
    onInput: (e) => { draft.notes = e.target.value; },
  });
  notesInput.value = draft.notes || '';

  /* ── The plan, and where it is edited ────────────────────────────────────
   * It goes on the FORM rather than on the screen the boxes are drawn on,
   * because that is the split Tim chose on 2026-08-21 and this is a second
   * chance to get it wrong the same way: `#/system/<id>` reads, the pencil
   * edits. A row of nine selects on the reading screen would rebuild exactly
   * the 468px-of-form problem the split was measured to fix.
   *
   * ⚠️ NOTHING PROMPTS FOR ONE. The kind starts at "No plan" and a system that
   * has never had one shows a single closed select — no nag, no empty week of
   * boxes waiting to be filled in, nothing on the reading screen at all. The
   * plan is optional and an optional thing that asks is not optional.
   *
   * ⚠️ A FRESH COPY, NOT THE ROW'S OWN. normalizeSchedule() allocates, so the
   * draft cannot write through into whatever the store handed back — the read
   * cache shares row objects between callers by design (§0.12) and an abandoned
   * edit that had already reached them would be a change nobody saved.
   */
  draft.schedule = normalizeSchedule(existing && existing.schedule);
  const planBody = el('div', { class: 'plan-edit' });
  /* ⚠️ TWO CONTAINERS, AND THE SECOND ONE IS WHY. Changing the KIND changes the
   * whole shape of this section, so it rebuilds everything; changing the LENGTH
   * changes only how many day rows there are. Rebuilding the section for a
   * length change would replace the +/− stepper the finger is on — the node
   * holding focus is destroyed, so a keyboard user gets exactly one press
   * before focus falls back to the body and a second press is impossible. The
   * rows live in their own box and only they are redrawn. */
  const planRows = el('div', { class: 'list' });

  function renderPlanEditor() {
    const plan = draft.schedule;
    const kindSelect = el('select', {
      class: 'input', 'aria-label': 'Kind of plan',
      onChange: (e) => {
        const v = e.target.value;
        draft.schedule = v ? newSchedule(v, v === CYCLE ? MIN_CYCLE_DAYS + 1 : undefined) : null;
        renderPlanEditor();
      },
    },
      el('option', { value: '', text: 'No plan' }),
      el('option', { value: WEEK, text: 'Days of the week' }),
      el('option', { value: CYCLE, text: 'Days of a cycle' }),
    );
    kindSelect.value = plan ? plan.kind : '';

    const parts = [el('div', { class: 'field' },
      el('label', { text: 'Plan' }), kindSelect,
      el('div', { class: 'field-help', text: plan
        ? 'Shown as boxes at the top of this system. It does not change what the app suggests next.'
        : 'Optional. Lay this programme out over a week, or over a cycle that repeats.' }),
    )];

    if (plan && plan.kind === CYCLE) {
      // ⚠️ `.plan-len`, not the builder's `.builder-controls` — that one carries
      // `grid-area: ctl`, which means nothing outside the builder's own grid and
      // would be a dead declaration waiting to be read as load-bearing. The
      // LABEL's typography is shared, because it is the same kind of caption.
      parts.push(el('div', { class: 'plan-len' },
        el('span', { class: 'builder-control-label', text: 'Days in the cycle' }),
        miniStepper({
          value: plan.slots.length, min: MIN_CYCLE_DAYS, max: MAX_CYCLE_DAYS,
          // Singular: miniStepper builds "One more <label>" / "One fewer
          // <label>", and the buttons are what a screen reader actually lands on.
          label: 'day in the cycle',
          onChange: (v) => {
            // 🚨 `draft.schedule`, NOT the `plan` this closure was built with.
            // resizeSchedule() returns a NEW object, and this handler outlives
            // several of them — it is created once and pressed many times. Read
            // from the captured one and every press after the first resizes the
            // plan as it was when the section was drawn, so growing from three
            // days to five and back to four silently threw away everything typed
            // in between. Caught by driving the stepper twice; one press looked
            // perfect.
            draft.schedule = resizeSchedule(draft.schedule, slotCount(CYCLE, v));
            // ⚠️ Shortening throws the tail away and does not remember it. See
            // resizeSchedule() — a plan that quietly disagrees with its own
            // boxes is worse than one that lost a day you can retype.
            renderPlanRows();
          },
        }),
      ));
    }

    if (plan) {
      parts.push(!workouts.length
        ? el('div', { class: 'field-help', text:
            'This system has no workouts yet, so every day can only be Rest. '
            + 'Add a workout and come back.' })
        : null);
      parts.push(planRows);
    }

    setChildren(planBody, ...parts.filter(Boolean));
    renderPlanRows();
  }

  function renderPlanRows() {
    const plan = draft.schedule;
    if (!plan) { setChildren(planRows); return; }
    setChildren(planRows, ...plan.slots.map((slot, i) => {
      const sel = el('select', {
        class: 'input',
        'aria-label': slotLabel(plan.kind, i, true),
        onChange: (e) => { plan.slots[i] = e.target.value || null; },
      },
        // ⚠️ THREE CHOICES, NOT TWO. "Rest" and "Nothing planned" are separate
        // options for the same reason the boxes print two different words for
        // them: one is a decision, the other is the absence of one.
        el('option', { value: '', text: 'Nothing planned' }),
        el('option', { value: REST, text: 'Rest' }),
        ...workouts.map((w) => el('option', { value: w.id, text: w.name })),
      );
      // Set after building: a value matching no option is ignored by the DOM and
      // the select falls back to its first, which is the honest outcome for a
      // slot naming a workout that has since been deleted. The slot is corrected
      // to match, so saving cannot write the dangling id back.
      sel.value = slot || '';
      if (slot && sel.value !== slot) plan.slots[i] = null;
      return el('div', { class: 'plan-row' },
        el('span', { class: 'plan-row-day', text: slotLabel(plan.kind, i) }),
        sel,
      );
    }));
  }
  if (!isNew) renderPlanEditor();

  async function save() {
    if (!draft.name.trim()) { toast('Give your system a name first'); nameInput.focus(); return; }
    const saved = await store.saveSystem({ ...draft, name: draft.name.trim() });
    toast(isNew ? 'System created' : 'System saved');
    // Both cases now land on the system itself. Saving an EXISTING one used to
    // drop you back on the top-level list, which was the right escape from a
    // screen that was only a form; from an editor reached by a pencil it throws
    // away the place you were reading and makes you walk back in.
    go('#/system/' + (saved.id || id));
  }

  function remove() {
    confirmSheet({
      title: 'Delete this system?',
      message: workouts.length
        ? `${plural(workouts.length, 'workout')} inside it will be deleted too. `
          + 'Workouts you have already recorded stay in your history and on your calendar — '
          + 'only the templates go.'
        : 'It has no workouts in it.',
      onConfirm: async () => { await store.deleteSystem(draft.id); toast('System deleted'); go('#/workouts'); },
    });
  }

  // The form is the whole screen now, so it lives in the scroll rather than
  // being pinned above a list it no longer shares the screen with. Only Save is
  // pinned — Delete moves into a danger zone at the bottom of the scroll, where
  // you have to travel to reach it, rather than sitting under the thumb of
  // somebody who came here to rename something.
  return screenShell({
    title: isNew ? 'New system' : 'Edit system',
    back: () => go(isNew ? '#/workouts' : '#/system/' + id),
    scroll: [
      el('div', { class: 'field' }, el('label', { text: 'System name' }), nameInput),
      el('div', { class: 'field' }, el('label', { text: 'Notes' }), notesInput),
      // Below the name and the notes, above the danger zone. A plan is a thing
      // about the programme rather than a thing that identifies it, and it must
      // not sit between somebody and the Delete they came here for.
      isNew ? null : planBody,
      isNew
        ? el('div', { class: 'field-help', text: 'Name it first, then you can add workouts to it.' })
        : el('div', { class: 'danger-zone' },
            el('button', { class: 'btn danger block', text: 'Delete system', onClick: remove }),
            el('div', { class: 'field-help', text: workouts.length
              ? `Deletes this programme and ${plural(workouts.length, 'workout')} inside it. `
                + 'Workouts you have already recorded stay in your history.'
              : 'It has no workouts in it.' }),
          ),
    ],
    bottom: el('button', {
      class: 'btn primary block', text: isNew ? 'Create system' : 'Save changes', onClick: save,
    }),
  });
}

/* ================================================================== *
 * Workout builder
 * ================================================================== */

/**
 * ⚠️ A WORKOUT HAS TWO SCREENS NOW, for the same reason a system does, and the
 * cost here was higher. `#/workout/<id>` opened the BUILDER, so tapping "Push"
 * inside your programme handed you a name field, a benchmark toggle, an editable
 * exercise list and a *Delete workout* — and **no way to start it**. The only
 * routes into a session were Home's next-workout button and `#/start`, so the
 * obvious path (Workouts → my programme → the day I am about to do) was the one
 * path that could not begin it. Measured on a phone 2026-08-21: *Add exercise*
 * sat ~500px below the fold and the last exercise row was cut in half by the
 * pinned Save/Delete.
 *
 *   #/workout/<id>            what this workout is, and Start it
 *   #/workout/<id>/edit       the builder
 *   #/workout/new/<systemId>  the builder, empty — a new workout has to know
 *                             which system it joins and there is no sensible
 *                             way to ask afterwards
 */
export async function WorkoutRouteView(param) {
  const [id, tail] = String(param || '').split('/');
  if (id === 'new' || tail === 'edit') return WorkoutBuilderView(param);
  return WorkoutDetailView(id);
}

async function WorkoutDetailView(id) {
  const [exMap, workout] = await Promise.all([store.getExerciseMap(), store.getWorkout(id)]);

  if (!workout) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      scroll: emptyState('That workout no longer exists', 'It may have been deleted.'),
    });
  }

  const home = workout.systemId ? '#/system/' + workout.systemId : '#/workouts';

  // Read from the same block walk the builder and the runner use, so a superset
  // reads as a superset here rather than as three unrelated exercises.
  const blocks = blocksOf(workout.exercises);

  const exerciseRow = (item) => {
    const ex = exMap.get(item.exerciseId);
    return el('div', { class: 'row static' },
      el('div', { class: 'row-main' },
        exerciseLabel({ exercise: ex, name: ex ? ex.name : 'Unknown exercise',
          tag: 'div', className: 'row-title' }),
        el('div', { class: 'row-sub wrap', text:
          [ex ? ex.muscle : null, ex ? ex.equipment : null,
           // setTypeLabel() already carries the count, and it says "Straight
           // sets" for the ordinary case — which is every row on most workouts
           // and is not worth a line.
           isNested(item.setType) ? setTypeLabel(item) : null,
          ].filter(Boolean).join(' · ') }),
      ),
      el('div', { class: 'row-meta', text: plural(item.sets, 'set') }),
    );
  };

  return screenShell({
    title: workout.name,
    sub: `${plural(workout.exercises.length, 'exercise')} · ${plural(totalSets(workout), 'set')}`,
    back: () => go(home),
    actions: [iconBtn('edit', 'Edit this workout', () => go('#/workout/' + id + '/edit'))],
    scroll: [
      workout.isBenchmark
        ? el('div', { class: 'field-help', text:
            'Benchmark workout — the best set of every exercise you record here is filed as a '
            + 'benchmark for that day.' })
        : null,
      // ⚠️ blocksOf() yields `{ item, index }` WRAPPERS, not the exercises —
      // the builder needs the index to write back through. Mapping the wrapper
      // straight into a row renders "Unknown exercise · undefined sets" for
      // every line, which is what the first version of this screen did.
      ...blocks.map((b) => (b.items.length > 1
        // A joined block keeps its bracket and its name, the same way the
        // builder and the runner draw it.
        ? el('div', { class: 'builder-group' },
            el('div', { class: 'builder-group-head' },
              el('div', { class: 'builder-group-label', text: groupLabel(b.items.length) })),
            el('div', { class: 'list' }, b.items.map((w) => exerciseRow(w.item))))
        : el('div', { class: 'list' }, b.items.map((w) => exerciseRow(w.item))))),
      workout.exercises.some((e) => e.notes)
        ? el('div', { class: 'preset-notes' },
            el('div', { class: 'section-label', text: 'Notes' }),
            workout.exercises.filter((e) => e.notes).map((e) => {
              const ex = exMap.get(e.exerciseId);
              return el('p', {}, el('b', { text: (ex ? ex.name : 'Exercise') + ' — ' }), e.notes);
            }))
        : null,
    ],
    // The reason this screen exists. A workout you are looking at is nearly
    // always one you are about to do.
    bottom: el('button', {
      class: 'btn primary block lg', onClick: () => go('#/session/' + id),
    }, icon('play'), 'Start workout'),
  });
}

export async function WorkoutBuilderView(param) {
  const [id, newSystemId] = String(param || '').split('/');
  const isNew = id === 'new';
  const exMap = await store.getExerciseMap();
  const existing = isNew ? null : await store.getWorkout(id);

  if (!isNew && !existing) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      scroll: emptyState('That workout no longer exists', 'It may have been deleted.'),
    });
  }

  const draft = existing
    ? { ...existing, exercises: existing.exercises.map((e) => ({ ...e })) }
    : { id: null, name: '', exercises: [], systemId: newSystemId || null };

  // Where "back" and "save" return to. A workout is always inside a system, so
  // leaving one should land on that system rather than on the top-level list.
  const home = draft.systemId ? '#/system/' + draft.systemId : '#/workouts';

  const nameInput = el('input', {
    class: 'input', type: 'text', value: draft.name, maxlength: '60',
    placeholder: 'Push, Legs, Upper Body…',
    onInput: (e) => { draft.name = e.target.value; },
  });

  // A benchmark workout turns every exercise it records into a benchmark for
  // that day. Off by default: a benchmark is meant to be a deliberate test, and
  // making every workout one would empty the word of meaning.
  const benchToggle = el('button', {
    class: 'chip', 'aria-pressed': String(Boolean(draft.isBenchmark)),
    text: draft.isBenchmark ? 'Benchmark workout' : 'Normal workout',
    onClick: () => {
      draft.isBenchmark = !draft.isBenchmark;
      benchToggle.setAttribute('aria-pressed', String(draft.isBenchmark));
      benchToggle.textContent = draft.isBenchmark ? 'Benchmark workout' : 'Normal workout';
      benchHelp.textContent = draft.isBenchmark
        ? 'Every exercise you record in this workout is saved as a benchmark for that day — the best set of each.'
        : 'Turn this on for a testing session, where each exercise should count as a benchmark.';
    },
  });
  const benchHelp = el('div', { class: 'field-help', text: draft.isBenchmark
    ? 'Every exercise you record in this workout is saved as a benchmark for that day — the best set of each.'
    : 'Turn this on for a testing session, where each exercise should count as a benchmark.' });

  const listWrap = el('div', { class: 'list' });
  const countLabel = el('div', { class: 'section-label' });

  // ⚠️ THE ONE OPINION THIS SCREEN HOLDS, and Design Rule 6 is the reason it is
  // allowed to. ACSM's 2026 position stand grades exercise ORDER at 88 %
  // quality of evidence — the highest of anything in it, and better than the
  // dose-response models the whole rating is built on. The app already knows
  // the order and has never said anything about it (docs/research.md §6.16.1).
  //
  // It is a NOTE and nothing more: it never blocks a save, never reorders
  // anything, never moves a score, and its last sentence says outright that
  // leaving the order alone is a legitimate answer. The sentence is built in
  // js/optimal.js so it cannot drift from the rule that decides when to show it.
  const orderNote = el('div', { class: 'field-help' });

  function renderOrderNote() {
    const note = exerciseOrderNote(draft.exercises, exMap);
    orderNote.textContent = note ? note.text : '';
    orderNote.hidden = !note;
  }

  function renderList() {
    countLabel.textContent = draft.exercises.length
      ? `Exercises · ${plural(totalSets(draft), 'set')} total`
      : 'Exercises';

    renderOrderNote();
    listWrap.replaceChildren();

    if (!draft.exercises.length) {
      listWrap.append(emptyState('No exercises yet',
        'Add exercises below. The order here is the order you will see them in during the workout.'));
      return;
    }

    // Blocks, so a superset can be bracketed as one thing. The bracket is a
    // hairline down the left and a label — never a bordered card (Rule 2).
    //
    // ⚠️ blocksOf() returns COPIES (normalizeGroups maps over the list), so the
    // `item` inside a block is not the object in `draft.exercises`. Every
    // handler below has to reach back through the index or it writes into a
    // throwaway and the control silently does nothing — which is exactly what
    // the set-type chip, the sets stepper and the notes box all did until a
    // browser click showed it. Blocks are for LAYOUT; the draft is the truth.
    const blocks = blocksOf(draft.exercises);

    for (const block of blocks) {
      const grouped = block.group != null;
      const wrap = el('div', { class: grouped ? 'builder-group' : 'builder-plain' });
      // Link controls that belong OUTSIDE this block's bracket — see below.
      const trailing = [];

      if (grouped) {
        wrap.append(el('div', { class: 'builder-group-head' },
          el('span', { class: 'builder-group-label', text: groupLabel(block.items.length) }),
          el('span', { class: 'builder-group-hint', text: 'done back to back · rest after the last one' }),
        ));
      }

      block.items.forEach(({ index: i }) => {
        const item = draft.exercises[i];   // the REAL one — see the note above
        const ex = exMap.get(item.exerciseId);
        const name = ex ? ex.name : 'Unknown exercise';
        const nested = isNested(item.setType);

        wrap.append(el('div', { class: 'builder-item' },
          el('div', { class: 'builder-main' },
            el('div', { class: 'row-title', text: name }),
            el('div', { class: 'row-sub', text: ex ? `${ex.muscle} · ${ex.equipment}` : 'Missing from library' }),
          ),
          el('div', { class: 'move-btns' },
            el('button', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(i, -1) }, icon('up')),
            el('button', { type: 'button', 'aria-label': 'Move down', disabled: i === draft.exercises.length - 1, onClick: () => move(i, 1) }, icon('down')),
          ),
          iconBtn('trash', `Remove ${name}`, () => {
            draft.exercises.splice(i, 1);
            draft.exercises = normalizeGroups(draft.exercises);
            renderList();
          }),

          el('div', { class: 'builder-controls' },
            el('span', { class: 'builder-control-label', text: 'Sets' }),
            miniStepper({
              value: item.sets, min: 1, max: 20,
              label: 'planned sets',
              onChange: (v) => { item.sets = v; countLabel.textContent = `Exercises · ${plural(totalSets(draft), 'set')} total`; },
            }),
            ex && ex.loadType ? loadBadge(ex.loadType) : null,

            // This was a one-tap cycle while there were two states. At THREE
            // types plus a count it stopped being a shortcut — you would have
            // tapped up to seven times to get back where you started — so it
            // opens a sheet where every option is visible at once.
            el('button', {
              type: 'button',
              class: 'chip set-type' + (nested ? ' is-on' : ''),
              'aria-pressed': String(nested),
              text: setTypeLabel(item),
              onClick: () => openSetTypeSheet(item, renderList),
            }),
          ),

          el('textarea', {
            class: 'builder-note',
            rows: '1',
            maxlength: '200',
            placeholder: 'Notes — cues, seat height, rest, anything',
            value: item.notes || '',
            onInput: (e) => { item.notes = e.target.value; },
          }),
        ));

        // The link control belongs in the GAP, because that is what a superset
        // is — an instruction about the space between two exercises, not a
        // property of either one. Rendering it on a row would force the reader
        // to work out which of its neighbours it meant.
        if (i < draft.exercises.length - 1) {
          const linked = isLinked(draft.exercises, i);
          const gap = el('div', { class: 'link-gap' + (linked ? ' is-linked' : '') },
            el('button', {
              type: 'button',
              class: 'link-btn',
              'aria-pressed': String(linked),
              onClick: () => {
                draft.exercises = toggleLink(draft.exercises, i);
                renderList();
              },
            }, icon(linked ? 'link' : 'link-off', 15),
              linked ? 'No rest — tap to separate' : 'Superset with next'),
          );
          // The gap after a block's LAST member is the boundary out of the
          // block, so it goes outside the bracket. Inside, the accent rule ran
          // past it and "Superset with next" read as part of the superset it
          // was offering to join, which is the opposite of what it does.
          if (linked) wrap.append(gap); else trailing.push(gap);
        }
      });

      listWrap.append(wrap, ...trailing);
    }
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= draft.exercises.length) return;
    [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]];
    // Moving an exercise out of a superset has to dissolve it if that leaves
    // one member behind — a one-exercise superset is not a thing.
    draft.exercises = normalizeGroups(draft.exercises);
    renderList();
  }

  renderList();

  async function save() {
    if (!draft.name.trim()) { toast('Give your workout a name first'); nameInput.focus(); return; }
    if (!draft.exercises.length) { toast('Add at least one exercise'); return; }
    const saved = await store.saveWorkout({ ...draft, name: draft.name.trim() });
    toast(isNew ? 'Workout created' : 'Workout saved');
    // Editing returns to the workout you were reading; creating returns to the
    // system, which is where the "New workout" button is and therefore where
    // somebody building a programme is most likely going next.
    go(isNew ? home : '#/workout/' + (saved && saved.id ? saved.id : id));
  }

  function remove() {
    confirmSheet({
      title: 'Delete this workout?',
      message: 'Workouts you have already recorded stay in your history and on your calendar. Only the template is removed.',
      onConfirm: async () => { await store.deleteWorkout(draft.id); toast('Workout deleted'); go(home); },
    });
  }

  // ⚠️ THE NAME FIELD CAME OUT OF `top`. Pinned, it cost 86px of every phone
  // screen for a field you touch once in the life of a workout, and it pushed
  // "Add exercise" — the thing this screen is FOR — about 500px below the fold.
  // In the scroll it costs that space once, at the top, where you are anyway.
  //
  // Delete came out of `bottom` for the harder reason: pinned, it is a
  // destructive control permanently under the thumb of somebody who is
  // rearranging exercises. It now sits past the end of the list, which is a
  // journey rather than a slip.
  return screenShell({
    title: isNew ? 'New workout' : 'Edit workout',
    back: () => go(isNew ? home : '#/workout/' + id),
    scroll: [
      el('div', { class: 'field' }, el('label', { text: 'Workout name' }), nameInput),
      el('div', { class: 'field' },
        el('label', { text: 'Kind' }),
        el('div', { class: 'chips' }, benchToggle),
        benchHelp,
      ),
      countLabel,
      listWrap,
      orderNote,
      el('button', {
        class: 'btn block',
        onClick: () => openExercisePicker({
          exMap,
          onPick: (ex) => {
            if (draft.exercises.some((e) => e.exerciseId === ex.id)) { toast('Already in this workout'); return false; }
            draft.exercises.push({ exerciseId: ex.id, sets: DEFAULT_SETS, notes: '' });
            renderList();
            return true;
          },
        }),
      }, icon('plus'), 'Add exercise'),
      isNew ? null : el('div', { class: 'danger-zone' },
        el('button', { class: 'btn danger block', text: 'Delete workout', onClick: remove }),
        el('div', { class: 'field-help', text:
          'Workouts you have already recorded stay in your history and on your calendar. '
          + 'Only the template is removed.' }),
      ),
    ],
    bottom: el('button', {
      class: 'btn primary block', text: isNew ? 'Create workout' : 'Save changes', onClick: save,
    }),
  });
}

/* ================================================================== *
 * Swap sheet — a few alternatives first, the whole library one tap down
 *
 * Tim, 2026-08-30: "when the user clicks on 'swap' it will show them a few
 * alternative exercises that will achieve the same or similar result…
 * Underneath this list of alternative exercises, put a button that brings them
 * to the full list of exercises we currently have displayed under swap."
 *
 * ⚠️ THE FULL LIST IS NOT REPLACED, IT IS DEMOTED. Swapping is done mid-set,
 * one-handed, usually because a machine is taken — and the old sheet answered
 * that with a search box over 275 exercises and sixteen filter chips. Five rows
 * answer it in one tap. But a shortlist that cannot be escaped is worse than no
 * shortlist: the button underneath goes to exactly the sheet that was there
 * before, unchanged.
 *
 * ⚠️ AND IT SAYS WHICH KIND OF LIST IT IS. `alternativesFor` returns
 * `reason: 'family'` when these are the same movement and `'muscle'` when the
 * exercise has no family and these merely train the same thing. Those are
 * different promises; showing both under one heading would make the weaker one
 * borrow the stronger one's credibility, which is Design Rule 5's general form.
 * ================================================================== */
export async function openSwapPicker({ exMap, current, inSession = [], onPick }) {
  const all = exMap ? [...exMap.values()] : await store.getExercises();
  const { reason, familyLabel, items } = alternativesFor(current, all, { inSession });

  const pick = (ex) => { close(); onPick(ex); };

  const rows = items.map(({ exercise: ex, inSession: dup }) => el('button', {
    class: 'row',
    onClick: () => pick(ex),
  },
    el('div', { class: 'row-main' },
      exerciseLabel({ exercise: ex, tag: 'div', className: 'row-title', inControl: true }),
      el('div', { class: 'row-sub' },
        `${ex.muscle} · ${ex.equipment}${ex.isCustom ? ' · custom' : ''}`
        // ⚠️ MARKED, NEVER HIDDEN. Swapping to something already in today's
        // session is a real move — swap away when the machine is taken, swap
        // back when it frees up, which is the case the runner's split path
        // exists for. Filtering it out would silently remove the right answer.
        + (dup ? ' · already in this workout' : '')),
    ),
    ex.loadType ? loadBadge(ex.loadType) : null,
    chevron(),
  ));

  /* ⚠️ THE LEAD ONLY PROMISES WHAT THE LIST ACTUALLY DELIVERS. It read "Same
   * movement, different equipment" unconditionally until a screenshot caught a
   * deadlift offering four barbell deadlifts under it — every one a correct
   * alternative, and the sentence above them false. Some families are
   * single-equipment by nature (the deadlifts, the Olympic lifts), and a
   * caption that overclaims on those teaches the reader to stop believing the
   * ones where it is true. Design Rule 5's general form. */
  const spreadsEquipment = items.some((i) => i.exercise.equipment !== current.equipment);
  const body = [
    el('div', { class: 'field-help swap-lead', text: reason === 'family'
      ? (spreadsEquipment ? 'Same movement, different equipment' : 'Other ways to do this movement')
        + (familyLabel ? ` — ${familyLabel.toLowerCase()}.` : '.')
      : `Nothing in the library does the same movement, so these are other ${current.muscle} exercises.` }),
    rows.length ? el('div', { class: 'search-results' }, ...rows) : null,
    // Underneath the alternatives, exactly as asked. `.block` so it reads as
    // the way onward rather than as a sixth alternative.
    el('button', {
      class: 'btn block swap-all', onClick: () => {
        close();
        openExercisePicker({ exMap, title: 'Swap this exercise', closeOnPick: true, onPick });
      },
    }, `Show all ${all.length} exercises`),
  ];

  const { close } = openSheet({
    title: current ? `Swap ${current.name}` : 'Swap this exercise',
    body,
  });
}

/* ================================================================== *
 * Exercise picker sheet
 * ================================================================== */

/**
 * @param closeOnPick  ⚠️ Adding exercises to a workout is a REPEATED action, so
 *   the sheet stays open and ticks each row as it goes. Swapping one is a SINGLE
 *   action — you are mid-set, you wanted a different machine, and leaving the
 *   sheet over the screen would mean the next thing you do is dismiss it.
 */
export async function openExercisePicker({ exMap, onPick, title = 'Add exercise', closeOnPick = false }) {
  const all = exMap ? [...exMap.values()] : await store.getExercises();
  let filterMuscle = null;
  let query = '';

  const results = el('div', { class: 'search-results' });

  const search = el('input', {
    class: 'input', type: 'search', placeholder: `Search ${all.length} exercises…`,
    autocomplete: 'off',
    onInput: (e) => { query = e.target.value.trim().toLowerCase(); render(); },
  });

  // ⚠️ ONE SCROLLING ROW, not four wrapped ones. Sixteen muscle groups wrapped
  // to 142px of a phone screen — between the search box and the results, which
  // are the only two things anybody opens this sheet for. With the keyboard up
  // that left THREE of 272 exercises visible, measured 2026-08-21. A row you
  // swipe costs 36px and puts the first five groups on screen, which is where
  // the common ones already are.
  const chipRow = el('div', { class: 'chips chips-scroll' },
    el('button', { class: 'chip', 'aria-pressed': 'true', text: 'All', onClick: (e) => setMuscle(null, e.target) }),
    MUSCLE_GROUPS.map((m) =>
      el('button', { class: 'chip', 'aria-pressed': 'false', text: m, onClick: (e) => setMuscle(m, e.target) })),
  );

  function setMuscle(m, btn) {
    filterMuscle = m;
    chipRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    render();
  }

  function render() {
    let list = all;
    if (filterMuscle) list = list.filter((e) => e.muscle === filterMuscle);
    if (query) list = list.filter((e) => e.name.toLowerCase().includes(query) || e.equipment.toLowerCase().includes(query));
    list = list.slice(0, 150);

    results.replaceChildren();

    if (!list.length) {
      results.append(emptyState('No exercise matches that',
        query ? `Nothing found for “${query}”. You can create it as a custom exercise instead.` : 'Try a different filter.'));
      return;
    }

    list.forEach((ex) => {
      const btn = el('button', { class: 'row', onClick: () => {
        const ok = onPick(ex);
        if (ok === false) return;
        if (closeOnPick) { close(); return; }
        btn.style.borderColor = 'var(--good)';
        btn.querySelector('.row-chev').replaceChildren(icon('check'));
      } },
        el('div', { class: 'row-main' },
          exerciseLabel({ exercise: ex, tag: 'div', className: 'row-title', inControl: true }),
          /* ⚠️ THE MATCH IS NAMED HERE TOO — Rule 5, and the reason is that this
           * row is where somebody meets a custom exercise made months ago. The
           * creator sheet said what a match does once, to the person making it;
           * this says it every time, to whoever is picking it. */
          el('div', { class: 'row-sub' },
            `${ex.muscle} · ${ex.equipment}${ex.isCustom ? ' · custom' : ''}`
            + (ex.isCustom && standInFor(ex) ? ` · rated as ${standInFor(ex).name}` : ''),
          ),
        ),
        ex.loadType ? loadBadge(ex.loadType) : null,
        chevron(),
      );
      results.append(btn);
    });
  }

  render();

  const { close } = openSheet({
    title,
    body: [search, chipRow, results],
    footer: el('div', { class: 'btn-row' },
      el('button', { class: 'btn ghost', text: 'Create custom', onClick: () => { close(); openCustomExerciseSheet(onPick); } }),
      el('button', { class: 'btn primary', text: 'Done', onClick: () => close() }),
    ),
  });

  setTimeout(() => search.focus(), 120);
}

/* ================================================================== *
 * Custom exercise creator
 * ================================================================== */

/* The library exercises somebody may point a custom one at, grouped by muscle.
 *
 * ⚠️ TWO FILTERS, AND THE SECOND ONE IS THE INTERESTING ONE. `canStandIn()`
 * removes what a custom exercise's logged number cannot mean — bodyweight and
 * assisted work, whose ratios convert a resistance derived from a weigh-in.
 * `contributionsFor()` removes what has no ratio at all: Machine Dip, Wrist
 * Roller, the exercises the library deliberately refuses to convert. Offering
 * one of those would let somebody make a match, be told nothing was wrong, and
 * still get no rating — a dead end the app knew about before they picked it.
 *
 * Built once, lazily, so opening any other sheet does not pay for it. Grouped
 * with <optgroup> rather than a flat 250-row list, and by MUSCLE_GROUPS order so
 * it reads in the same order as the dropdown three rows above it. */
let standInOptionCache = null;
function standInOptions() {
  if (standInOptionCache) return standInOptionCache;
  const byMuscle = new Map();
  for (const e of BUILT_IN_EXERCISES) {
    if (!canStandIn(e) || !contributionsFor(e).length) continue;
    if (!byMuscle.has(e.muscle)) byMuscle.set(e.muscle, []);
    byMuscle.get(e.muscle).push(e);
  }
  const order = [...MUSCLE_GROUPS.filter((m) => byMuscle.has(m)),
    ...[...byMuscle.keys()].filter((m) => !MUSCLE_GROUPS.includes(m))];
  standInOptionCache = order.map((m) => el('optgroup', { label: m },
    byMuscle.get(m).map((e) => el('option', { value: e.id, text: e.name }))));
  return standInOptionCache;
}

export function openCustomExerciseSheet(onPick) {
  const name = el('input', { class: 'input', type: 'text', placeholder: 'Exercise name', maxlength: '60' });
  const muscle = el('select', { class: 'input' }, MUSCLE_GROUPS.map((m) => el('option', { value: m, text: m })));
  const equip = el('select', { class: 'input' }, EQUIPMENT.map((m) => el('option', { value: m, text: m })));
  /* ⚠️ "None" IS THE FIRST OPTION AND THE DEFAULT, because leaving it alone has
   * to be the thing that happens when somebody does not read the field. The
   * whole 2026-08-31 decision rests on a custom exercise rating nothing unless
   * a person deliberately said what it was. */
  const standIn = el('select', { class: 'input' },
    el('option', { value: '', text: 'None' }),
    standInOptions());

  const chosen = new Set(['weight', 'reps']);
  let loadType = 'total';

  const help = el('div', { class: 'field-help', text: LOAD_HELP[loadType] });

  const loadField = el('div', { class: 'field' },
    el('label', { text: 'How is the weight counted?' }),
    el('div', { class: 'chips' },
      ['total', 'per_side'].map((lt) =>
        el('button', {
          class: 'chip', 'aria-pressed': String(lt === loadType),
          text: lt === 'total' ? 'Total load' : 'Per side',
          onClick: (e) => {
            loadType = lt;
            e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
            e.target.setAttribute('aria-pressed', 'true');
            help.textContent = LOAD_HELP[loadType];
          },
        })),
    ),
    help,
  );

  function syncLoadVisibility() {
    loadField.style.display = chosen.has('weight') ? '' : 'none';
  }

  const fieldChips = el('div', { class: 'chips' },
    ['weight', 'reps', 'time', 'distance'].map((f) =>
      el('button', {
        class: 'chip',
        'aria-pressed': String(chosen.has(f)),
        text: f[0].toUpperCase() + f.slice(1),
        onClick: (e) => {
          if (chosen.has(f)) chosen.delete(f); else chosen.add(f);
          e.target.setAttribute('aria-pressed', String(chosen.has(f)));
          syncLoadVisibility();
        },
      })),
  );

  syncLoadVisibility();

  const { close } = openSheet({
    title: 'Create custom exercise',
    body: [
      el('div', { class: 'field' }, el('label', { text: 'Name' }), name),
      el('div', { class: 'field' }, el('label', { text: 'Muscle group' }), muscle),
      el('div', { class: 'field' }, el('label', { text: 'Equipment' }), equip),
      /* ⚠️ SAID BEFORE IT IS CREATED, not discovered afterwards on the muscle
       * map. Until 2026-08-31 a custom exercise DID set a strength level, off a
       * ratio guessed from the equipment dropdown above — one 60 lb × 10 set on
       * a made-up "Dip Machine" rated a beginner's triceps Advanced. It no
       * longer does, and this is the sentence that stops the absence reading as
       * a bug when somebody later wonders why their custom lift moved nothing.
       * js/muscle-evidence.js's CUSTOM_RATIO header has the whole argument.
       *
       * ⚠️ REWORDED 2026-09-05, because "they do not set a strength level" is no
       * longer true without a condition on it. The condition is the field below,
       * and the ORDER matters: this paragraph says what a custom exercise does,
       * and the control that changes it sits directly underneath. Reversing them
       * would make the field look like a required step. */
      el('div', { class: 'field-help', text:
        'Custom exercises are logged, charted and counted in your weekly volume. '
        + 'They only set a strength level if you pick the closest library exercise below.' }),
      el('div', { class: 'field' },
        el('label', { text: 'Closest library exercise' }),
        standIn,
        el('div', { class: 'field-help', text:
          'Optional. Your sets convert through it, labelled as your match rather than '
          + 'a measurement. Leave it blank and this exercise sets no strength level.' }),
      ),
      el('div', { class: 'field' },
        el('label', { text: 'What do you want to track?' }),
        fieldChips,
        el('div', { class: 'field-help', text: 'These become the steppers you see during a workout.' }),
      ),
      loadField,
    ],
    footer: el('button', {
      class: 'btn primary block',
      text: 'Create exercise',
      onClick: async () => {
        if (!name.value.trim()) { toast('Give the exercise a name'); name.focus(); return; }
        if (!chosen.size) { toast('Pick at least one thing to track'); return; }
        const ex = makeCustomExercise({
          name: name.value,
          muscle: muscle.value,
          equipment: equip.value,
          fields: ['weight', 'reps', 'time', 'distance'].filter((f) => chosen.has(f)),
          loadType,
          // Empty string when "None" is selected; makeCustomExercise() resolves
          // it and stores null unless it names an eligible library row.
          standInId: standIn.value || null,
        });
        await store.addCustomExercise(ex);
        close();
        toast(`“${ex.name}” created`);
        if (onPick) onPick(ex);
      },
    }),
  });

  setTimeout(() => name.focus(), 120);
}
