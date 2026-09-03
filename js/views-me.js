// PROFILE — your own account, as a place rather than as a settings screen.
//
// Tim, 2026-09-08, restructuring the navigation: *"replace it with a profile
// section. For now, this section will only show the user's profile picture and
// their username, as well as the number of workouts, followers, and following
// at the top. When the user clicks on the followers or following, it will give
// them the list of users that fit that description, and then the user can click
// on any of those users to view their profile. When they click on the workouts,
// it will show them a list of all the user's most recent workouts."*
//
// 🚨 IT IS NOT THE ACCOUNT SCREEN AND THE DIFFERENCE IS HIS, VERBATIM: *"this
// profile section on the main sections is different than the profile section
// when you click on your profile icon in the top left, because that section is
// mostly used to make setting adjustments and do logistics, where this new
// section is broad information and view of your account and your own profile."*
//
// So: `#/account` is where you CHANGE things — the photo, the display name, who
// can see you, backups, sign-out. `#/me` is where you LOOK at what your account
// amounts to. Nothing here writes anything.
//
// 🔄 ~~THREE COUNTS~~ **TWO SINCE 2026-09-09, AND THE SECOND IS CALLED FRIENDS.**
// Tim, closing the question this screen opened when it shipped: *"just combine
// the 2 and call them 'friends' instead. We might change it to
// following/folowers later."*
//
// 🚨 THE WORDS NOW MATCH THE MODEL, WHICH IS THE CHEAPER OF THE TWO WAYS OUT.
// "Followers" and "following" describe a one-way graph; this app's is mutual —
// answered as an open question long before this screen existed ("Social: mutual
// or followers? → Mutual") — so the two numbers were always equal and the screen
// needed a "?" to explain why it was printing the same figure twice. One number
// called Friends needs no explanation, and it is what the rest of the app has
// called these people all along.
//
// ⚠️ IT IS A RENAME, NOT A NARROWING. No follow model was built and none was
// deleted; `social.state().connections` is the same list it always was. He kept
// the door open — *"we might change it to following/folowers later"* — and the
// thing that would make that expensive is a migration, of which there is none.
//
// ⚠️ `#/me/followers` AND `#/me/following` STILL RESOLVE, onto the one list. A
// tab bar being redesigned may not 404 a URL (`#/calendar` kept its route
// through three moves) and neither may this.
//
// 🆕 AND IT HAS CONTENT SINCE 2026-09-10/-11 — the Data/Profile split, Tim's
// five-step plan (`docs/direction.md` §4b, `progress.md` Open work 29). In his
// order: the CALENDAR (step 1), the BODY FACTS (step 2), the BEST LIFTS
// (step 3) and GOALS (step 4), with the Account cleanup behind them (step 5).
//
// 🚨 ONE LINE DECIDES WHAT LANDS HERE AND IT IS HIS: **Data answers what your
// training MEANS, Profile answers what you DID.** That is why the calendar and
// the records are here and the muscle map and Volume are not — and why every
// section below is a READOUT with a door beside it. Nothing on this screen
// writes anything, still.

import { store, social, demo, activityByDate, todayISO, muscleRatings } from './store.js';
// ⚠️ ONE calendar, four doors. See `calendarSection` below and `ownCalendar`'s
// own header — a second copy is the drift that function exists to prevent.
import { ownCalendar } from './views-data.js';
// 🆕 "What are my best lifts, ever?" — the question the app could not answer
// until 2026-09-10 — 🔄 and since 2026-09-12 RANKED: the core eight and the rest,
// each an estimated 1RM with a level and a confidence. Pure; the screen only
// formats what it hands back. `js/profile-ranking.js` has the arithmetic and
// the argument for which number a recorded lift shows.
import { rankedLifts } from './profile-ranking.js';
import { comparisonLabel } from './strength-standards.js';
import * as units from './units.js';
import {
  el, screenShell, emptyState, chevron, setChildren, personFace, icon,
  // ⚠️ `helpDot` LEFT WITH THE SECOND COUNT on 2026-09-09. The one thing this
  // screen still has to say — that a public account is readable by people who
  // are not friends — changes what the number IS, so it stays on the screen
  // rather than going behind a dot (Rule 9).
  fmtDateShort, relativeDay,
} from './ui.js';
import { recordedSetCount } from './session-stats.js';

const go = (hash) => { location.hash = hash; };

/* 🚨 THE ONE THING THE COUNT STILL HAS TO SAY, AND ONLY ON A PUBLIC ACCOUNT.
 *
 * ~~Half of this file's old help text explained why two numbers were equal~~ —
 * gone with the second number, which is the point of the rename. What survives
 * is the harder half, and it survives because it changes what the number IS
 * rather than explaining where it came from (Rule 9): **D29 makes an account
 * public by default, and a public account is readable by anybody signed in who
 * finds it — none of whom are in the graph.** So on a public account "Friends"
 * is the people you are connected to and NOT the people who can see you, and a
 * count that undercounts its own audience by an unbounded amount is exactly the
 * kind of number this app does not print in silence.
 *
 * ⚠️ ONE SENTENCE, ON THE SCREEN, AND NOTHING AT ALL WHEN IT IS NOT TRUE. On a
 * private account the number is a complete answer and there is nothing to add;
 * a line saying so would be the app explaining itself for the sake of it, which
 * is the whole of what Tim asked to stop.
 */
const PUBLIC_NOTE = 'Your account is public, so people can see your training without being friends.';

/** One tappable figure. The number is the point, so it is the big thing. */
function statTile(label, value, href) {
  return el('a', { class: 'me-stat', href },
    el('span', { class: 'me-stat-n', text: String(value) }),
    el('span', { class: 'me-stat-l', text: label }),
  );
}

/* ------------------------------------------------------------------ *
 * The profile itself
 * ------------------------------------------------------------------ */

export async function MeView() {
  const body = el('div', { class: 'me-body' });
  const screen = screenShell({
    profile: true,
    title: 'Profile',
    scroll: body,
  });

  // ⚠️ Not awaited — the shell paints and the numbers fill in. Same shape as
  // Home's feed and the Friends list, and for the same reason: the router
  // awaits the view before swapping the DOM, so time spent here is a tap that
  // visibly does nothing while the PREVIOUS screen sits under the thumb.
  fill(body).catch(() => {
    setChildren(body, emptyState('Could not load your profile',
      'Your account could not be reached just now. Everything you have recorded is safe on '
      + 'this device.'));
  });
  return screen;
}

async function fill(body) {
  const [settings, sessions, state, activity, profile, goal] = await Promise.all([
    store.getSettings(),
    store.getSessions(),
    social.state().catch(() => ({ available: false, reason: 'offline' })),
    // 🆕 THE CALENDAR LIVES HERE SINCE 2026-09-10 — see the block below.
    activityByDate().catch(() => new Map()),
    // 🆕 STEPS 2 AND 4 OF THE SAME SPLIT, 2026-09-11. Both are reads and both
    // are allowed to fail into "nothing to show": a profile that cannot be
    // read is the same screen as a profile nobody has filled in, and this
    // screen has no business erroring over a section.
    store.getProfile().catch(() => null),
    store.activeGoal().catch(() => null),
  ]);

  // 🔄 THE RANKED BEST LIFTS NEED THE RATINGS, 2026-09-12 — the same walk the
  // muscle map does, handed the rows by hand so it cannot disagree with it.
  // Every one of these fails into "no section" rather than into an error.
  const [benchmarks, exMap, bodyWeights] = await Promise.all([
    store.getBenchmarks().catch(() => []),
    store.getExerciseMap().catch(() => new Map()),
    store.getBodyWeights().catch(() => []),
  ]);
  const muscles = await muscleRatings({ sessions, benchmarks, bodyWeights }).catch(() => new Map());

  const workouts = sessions.length;
  // ⚠️ `connections` only exists on an available state. Off the cloud there is
  // no graph to count, and showing 0 would be a claim rather than an absence.
  const connections = state.available ? (state.connections || []) : null;

  const name = state.name || settings.displayName || '';

  setChildren(body,
    el('div', { class: 'me-head' },
      el('span', { class: 'me-face' }, personFace(settings.avatar, 44)),
      el('div', { class: 'me-who' },
        el('div', { class: 'me-name', text: name || 'No display name yet' }),
        // ⚠️ Says what to do about it rather than leaving a blank. The name is
        // set on the Account screen now, not here — this screen never writes.
        name ? null : el('a', { class: 'text-link', href: '#/account',
          text: 'Add one on your account' }),
      ),
    ),

    el('div', { class: 'me-stats' },
      statTile('Workouts', workouts, '#/me/workouts'),
      // 🔒 Off the cloud it is a DASH and not a link — local, anonymous, offline
      // and demo have no graph, and 0 would be a claim where the truth is an
      // absence. Unchanged by the rename; it was the right call for two numbers
      // and it is the right call for one.
      connections === null
        ? el('span', { class: 'me-stat is-off' },
            el('span', { class: 'me-stat-n', text: '—' }),
            el('span', { class: 'me-stat-l', text: 'Friends' }))
        : statTile('Friends', connections.length, '#/me/friends'),
    ),

    connections === null
      ? el('div', { class: 'field-help', text: OFFLINE_COUNTS[state.reason]
          || 'Your friends cannot be counted right now.' })
      // Nothing at all on a private account: see PUBLIC_NOTE.
      : state.visibility === 'public'
        ? el('div', { class: 'field-help', text: PUBLIC_NOTE })
        : null,

    bodySection(profile),
    bestLiftsSection({ sessions, benchmarks, exMap, muscles, profile }),
    goalSection(goal),
    calendarSection(activity),
  );
}

/* ------------------------------------------------------------------ *
 * 🆕 YOUR BODY — 2026-09-11, step 2 of the Data/Profile split.
 *
 * Tim's plan, in his order: calendar, body facts, best lifts, Goals, then the
 * Account cleanup. This is the second, and it is the smallest of the five
 * because it moves a READOUT rather than a feature.
 *
 * 🚨 IT DISPLAYS AND LINKS; IT DOES NOT ASK. `#/me` never writes (`direction.md`
 * §4a — adjustments behind the top-left icon, a view of the account in the tab
 * bar), so `#/profile` stays the form and this row is the door to it. Building
 * the fields here instead would have put the same three controls on two screens,
 * which is the fault Tim named on the set row — *"it doesn't have 2 places for
 * the same thing"* — and one of the two would have gone stale.
 *
 * ⚠️ WHAT IS THERE LEADS, AND WHAT IS MISSING IS NAMED. `direction.md` §3.1:
 * something honest beats a blank, so a half-filled profile prints the half it
 * has and says what the other half would buy. A person with a gender and no
 * weigh-in reads "Male" over "Add your body weight to rank your muscle groups",
 * not an empty row and not a silent one.
 *
 * ⚠️ THE SENTENCE IS THE ONE THE ACCOUNT SCREEN ALREADY USES, word for word.
 * Two screens describing the same gap in two different ways is how a caveat
 * quietly becomes two claims.
 * ------------------------------------------------------------------ */
function bodySection(profile) {
  // A profile that could not be read at all: no row rather than a wrong one.
  if (!profile) return null;

  const facts = [
    profile.gender === 'female' ? 'Female' : profile.gender === 'male' ? 'Male' : null,
    // ⚠️ AGE, NOT BIRTH YEAR — the store computes it from the year on every read
    // for exactly this reason (a stored age goes stale in silence). The word is
    // printed because a bare "31" beside "180 lbs" reads as a weight.
    profile.age ? `${profile.age} years` : null,
    profile.bodyWeight ? units.withUnit(profile.bodyWeight) : null,
  ].filter(Boolean);

  const missing = profile.missing.length
    ? `Add your ${profile.missing.join(' and ')} to rank your muscle groups`
    : null;

  return el('div', { class: 'me-section' },
    el('div', { class: 'section-label', text: 'Your body' }),
    el('div', { class: 'list' },
      el('a', { class: 'row', href: '#/profile' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: facts.length ? facts.join(' · ') : 'Your body' }),
          el('div', { class: 'row-sub wrap', text: missing
            // ⚠️ The DATE of the last weigh-in, because the number above it is
            // that day's rather than today's — the same distinction
            // `BODY_WEIGHT_FRACTION` makes when it reads the weight from the
            // date of the set. A stale weigh-in is a known gap (§9) and the
            // honest version of it here is simply saying when it was.
            || (profile.bodyWeightDate
              ? `Last weighed ${relativeDay(profile.bodyWeightDate)}`
              : 'Gender, birth year and body weight') }),
        ),
        el('span', { class: 'row-chev' }, chevron()),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 🆕 YOUR GOAL — 2026-09-11, step 4 of the split, and it is a MOVE.
 *
 * Goals came off the tab bar on 2026-08-25 to make room for the calendar, and
 * has been reached from Settings ever since — a feature with a real screen, real
 * tests and no home. `direction.md` §4b puts it on Profile by name: **Data is
 * what your training MEANS, Profile is what you DID**, and a goal you set is a
 * thing you did.
 *
 * 🚨 THE SETTINGS ROW IS GONE RATHER THAN LEFT AS A SECOND DOOR, which is the
 * difference between moving it and adding one. Profile is a tab; Settings is
 * three taps behind an icon. Keeping both would leave the app with two answers
 * to "where are my goals", and `#/goals` still resolves for anything anybody
 * bookmarked — the same guarantee `#/calendar` has kept through four moves.
 *
 * 🛑 NO VERDICT, NOT EVEN A CHEERFUL ONE. `js/goals.js` refuses to say whether
 * somebody is on track, because a day-to-day estimate swings several percent and
 * a bad Tuesday is not a failure (Rule 6, and the refusal is asserted in
 * `tests/goals.test.mjs`). This row therefore prints only what was RECORDED when
 * the goal was set — the level being aimed at and the date it runs to — and
 * nothing computed from where the lifter is now. A "you're behind" here would be
 * the one refusal in this app that the summary screen quietly undid.
 * ------------------------------------------------------------------ */
function goalSection(goal) {
  return el('div', { class: 'me-section' },
    el('div', { class: 'section-label', text: 'Your goal' }),
    el('div', { class: 'list' },
      el('a', { class: 'row', href: '#/goals' },
        el('div', { class: 'row-main' },
          goal
            ? el('div', { class: 'row-title',
                text: `${goal.targetLevelName} ${goal.liftName || goal.muscle}` })
            : el('div', { class: 'row-title', text: 'Set a goal' }),
          el('div', { class: 'row-sub wrap', text: goal
            ? `By ${fmtDateShort(goal.endDate)}`
            : 'Move a muscle up a strength level' }),
        ),
        el('span', { class: 'row-chev' }, chevron()),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 🆕 YOUR BEST LIFTS — 2026-09-10, step 3 of the Data/Profile split.
 *
 * `js/personal-bests.js` has computed typed records since the finish screen
 * shipped, but only ever for ONE session, answering "did this workout beat
 * anything". Nothing in the app answered **"what are my best lifts, ever?"** —
 * which is the most rewarding thing a profile can carry, and is exactly the
 * kind of readout the UX review meant when it found that nothing a user can
 * see ever grows.
 *
 * 🚨 THE MEASUREMENT LEADS AND THE ESTIMATE FOLLOWS, LABELLED — Rule 5, and it
 * is the whole reason this returns two fields rather than one. The heaviest set
 * you actually held is a fact; the best estimated 1RM is a model, and the two
 * genuinely disagree (185×3 and 155×10 are different days). Collapsing them
 * would throw that away; leading with the estimate would put an inference where
 * a measurement belongs. The word "estimated" is the cue, never a colour.
 *
 * ⚠️ ORDERED BY DAYS TRAINED, NOT BY POUNDS. There is no honest ranking of a
 * 405 deadlift against a 40 lateral raise — sorting by weight sorts by which
 * movements load heavy, which is a property of the barbell rather than of the
 * lifter (Rule 6). Days trained is what makes a lift *yours*.
 *
 * ⚠️ AND `days` IS PRINTED, because it is the honesty for a thin history: one
 * afternoon on a new machine is a true best and must not read as a career one.
 * ------------------------------------------------------------------ */
/* 🔄 ~~six most-trained lifts, measured set first~~ **RANKED SINCE 2026-09-12.**
 *
 * Tim: *"display the core lifts, and then have 'other lifts' in an expandable
 * section below it … just show the weight of an estimated 1RM for each of
 * these, and show the confidence below it … colorize the number based on where
 * that measurement puts that user among people like them … Order the core
 * lifts from highest ranking exercise (beginner-elite) to lowest, and do the
 * same for ordering the other lifts."*
 *
 * The arithmetic is `js/profile-ranking.js`. This prints it, under three rules
 * that are all Rule 5 / Rule 6:
 *
 *   · EVERY figure is an estimate and the section says so ONCE, in the line
 *     under the core list, rather than stamping "est." on eight rows. A recorded
 *     row prints the SET it rests on in its sub-line ("315 lbs × 3 · 2 days"),
 *     so the model is never the only number on the row.
 *   · The COLOUR is the level ramp (`lv-text-<key>`), a chip with its own ink
 *     validated for contrast in both themes, and the level's NAME is printed
 *     in words beside the confidence — the colour is never the only carrier.
 *     "Red for beginner, orange for novice" is the ramp's own low end.
 *   · NO verdict word. Band names and level names only.
 *
 * ⚠️ `<details>`/`<summary>` for "Other lifts" — the disclosure the Research
 * topics use, keyboard- and screen-reader-native without a line of code.
 *
 * 🔒 NO `input`, `textarea` or `select` anywhere in it — the tab's standing
 * test. ~~The section used to say "The 6 lifts you have trained most, of 25"~~:
 * the core eight are fixed and Other holds everything else, so the count is
 * on the summary instead.
 */
function bestLiftsSection({ sessions, benchmarks, exMap, muscles, profile }) {
  const r = rankedLifts({ sessions, benchmarks, exMap, muscles, profile });
  // Nothing trained at all: no section, as before. A core row with no number
  // on an account WITH history is a different case and stays, saying why.
  const trained = r.core.some((l) => l.days > 0 || l.oneRM !== null)
    || r.other.length > 0 || r.repsOnly.length > 0;
  if (!trained) return null;

  // ⚠️ `r.profile`, never the raw one: it is the overlay `withAssumptions()`
  // built, and the label reads what it assumed off it.
  const label = comparisonLabel(r.profile);
  const otherCount = r.other.length + r.repsOnly.length;

  return el('div', { class: 'me-bests' },
    el('div', { class: 'section-label', text: 'Your best lifts' }),
    el('div', { class: 'list' }, ...r.core.map(liftRow)),

    // 🚨 ONE sentence carrying three things: that every figure is an estimate,
    // which group the colours were computed against, and — when the app had to
    // guess a sex or a body weight — what it guessed. `label.assumed` is the
    // muscle map's own wording, so two screens cannot describe one assumption
    // two ways.
    el('div', { class: 'field-help', text:
      `Estimated one-rep maxes, coloured by level ${label.main} · ${label.sub}.`
      + (label.assumed ? ` ${label.assumed}` : '') }),

    otherCount
      ? el('details', { class: 'me-other' },
          el('summary', { class: 'me-other-sum' },
            el('span', { class: 'me-other-title', text: 'Other lifts' }),
            el('span', { class: 'me-other-n', text: String(otherCount) }),
            el('span', { class: 'me-other-chev' }, chevron()),
          ),
          el('div', { class: 'list' },
            ...r.other.map(liftRow),
            // Reps-only work — pull-ups with no weigh-in, push-ups — has a true
            // best and no honest pound figure. Listed plainly, uncoloured.
            ...r.repsOnly.map((l) => el('div', { class: 'row me-best' },
              el('div', { class: 'row-main' },
                el('div', { class: 'row-title', text: l.name }),
                el('div', { class: 'row-sub wrap', text: daysText(l) }),
              ),
              el('div', { class: 'me-best-nums' },
                el('span', { class: 'me-best-top', text: `${l.reps} reps` }),
                el('span', { class: 'me-best-est', text: 'measured, not ranked' }),
              ),
            )),
          ),
        )
      : null,
  );
}

/* Why a core lift has no number, in the reader's words. The keys come from
 * profile-ranking.js; the sentences live here so the module stays wordless. */
const NO_NUMBER = {
  'no-evidence':   'Nothing recorded for this muscle yet',
  'stand-in-only': 'Only a stand-in rates this muscle — record the lift, or a close one',
  'no-conversion': 'No published way to convert this one',
  'no-standard':   'No standard to rank it against',
};

function liftRow(l) {
  // `level` null WITH a percentile is "below Beginner" — plain ink, no chip,
  // because inventing an eighth level is what `lv-text-below` refuses to do.
  const lvKey = l.level ? l.level.key : (l.percentile !== null ? 'below' : null);
  const lvName = l.level ? l.level.name : (l.percentile !== null ? 'Below Beginner' : null);

  return el('div', { class: 'row me-best' + (l.oneRM === null ? ' is-none' : '') },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: l.name }),
      el('div', { class: 'row-sub wrap', text: subText(l) }),
    ),
    el('div', { class: 'me-best-nums' },
      l.oneRM === null
        // No number: say why, in the number's slot, so the row is not a hole.
        ? el('span', { class: 'me-best-none', text: NO_NUMBER[l.why] || 'No estimate' })
        : el('span', { class: 'me-best-top' + (lvKey ? ` lv-text-${lvKey}` : ''),
            text: units.withUnit(Math.round(l.shown)) + (l.perSide ? '/side' : '') }),
      // The confidence in words under the number — Tim's ask — with the
      // level's NAME beside it so the colour is never the only carrier.
      l.oneRM === null ? null
        : el('span', { class: 'me-best-est', text:
            `${l.band.name} confidence` + (lvName ? ` · ${lvName}` : ' · not ranked') }),
    ),
  );
}

/* The sub-line: what the number rests on. A recorded row names the SET it was
 * modelled from — Rule 5's measured anchor on the row; a converted row names
 * what it was converted from and says the lift was never recorded. */
function subText(l) {
  if (l.source === 'recorded' && l.best) {
    const set = l.best.kind === 'reps'
      ? `${l.best.reps} reps`
      : `${units.withUnit(l.best.weight)}${l.perSide ? '/side' : ''}${l.best.reps ? ` × ${l.best.reps}` : ''}`
        + (l.bodyIncluded ? ' added' : '');
    return `${set} · ${daysText(l)}`;
  }
  if (l.source === 'converted') {
    return `Estimated from ${l.from.join(', ')}` + (l.days ? ` · ${daysText(l)}` : ' · never recorded')
      + (l.bodyIncluded ? ' · body weight included' : '');
  }
  return l.days ? daysText(l) : 'Not trained yet';
}

function daysText(l) {
  return `${l.days} ${l.days === 1 ? 'day' : 'days'}`
    + (l.lastDate ? ` · last ${fmtDateShort(l.lastDate)}` : '');
}

/* ------------------------------------------------------------------ *
 * 🆕 THE CALENDAR — 2026-09-10, and it is the first thing that made this
 * screen worth having a tab for.
 *
 * Tim: *"The main profile section is looking really empty right now and the
 * settings profile section is really crowded … I think showing the calendar as
 * a main section was nice, but I think we can also display it in the data
 * section in a good way (although it's not in a great place right now)."*
 *
 * 🚨 THE TWO HALVES OF THAT WERE ONE PROBLEM. This screen was empty because
 * everything belonging on it already lived in Data, and Data was overfull for
 * the same reason — six segments that physically did not fit. The line that
 * separates them is what a screen ANSWERS: **Data is what your training MEANS**
 * (Muscles, Volume, Graph, Bars, Research) and **Profile is what you DID**. A
 * calendar is a record, not an analysis, so it is the first thing across.
 *
 * ⚠️ IT IS `ownCalendar()`, THE SAME FUNCTION THE OTHER THREE DOORS USE, and
 * that is the whole reason this cost so little. Months, Years, the readout and
 * the day links cannot drift from the Calendar screen's because there is only
 * one of them. The one thing this door passes is `land: false` — see that
 * function's header: jumping the scroller to the current month is right when
 * the calendar IS the pane, and wrong here, where it would scroll the avatar
 * and the stats off the top of the screen somebody just opened.
 *
 * 🔄 AND SINCE 2026-09-12 THAT IS ABOUT THE ARRIVAL ONLY. Tim: *"it
 * automatically shows almost a full year before the user's first recording, so
 * they have to scroll down in order to see anything"* — which was exactly this
 * door: the calendar opened on Months with nothing landed, so the first thing
 * under "Training history" was the earliest month drawn. Two things changed,
 * both in `ownCalendar` rather than here. **Years is the default** on every
 * door, so this screen opens on the whole history at a glance and the pane
 * stays where it opened. And **a tap on Months lands on the current month**
 * here too — the pane scrolls so this month's heading is at the top and the
 * earlier months are above it, which is what he asked for: *"the current month
 * should be the one that is being viewed to start, and then the viewer can
 * scroll up for earlier months."* The switch goes with them; it is one flick
 * up, and the alternative — a scroller of the calendar's own inside this pane
 * — is two scrollbars fighting over one drag (see `.me-cal` in app.css).
 *
 * ⚠️ THE ONE CASE `land: false` STILL DECIDES: `calMode` is shared with the
 * Calendar screen, so a reader who chose Months there opens this tab on
 * Months, and that first paint does NOT land — the screen they just opened
 * does not move under them. They are where they left the previous screen;
 * Years then Months lands, or they scroll.
 *
 * ⚠️ AND `#/calendar` IS STILL A SCREEN. It has survived four moves without
 * breaking a link and `#/day/<iso>` and `#/edit/<id>` hang off it, so a day
 * opened from here still lands somewhere that stands up on its own.
 * ------------------------------------------------------------------ */
function calendarSection(activity) {
  const host = el('div', { class: 'me-cal-host' });
  // `land: false` — the arrival only; a tap on Months lands. See the header.
  const cal = ownCalendar(activity, todayISO(), { land: false });
  // Painted after the node exists, exactly as the other three doors do it.
  queueMicrotask(() => cal.paint(host));
  return el('div', { class: 'me-cal' },
    el('div', { class: 'section-label', text: 'Training history' }),
    cal.top,
    host,
  );
}

const OFFLINE_COUNTS = {
  demo: 'Friends are off in the demo account.',
  local: 'Connecting with people needs an account.',
  anonymous: 'Add an email to your account to connect with people.',
  offline: 'You are offline, so your friends cannot be counted.',
};

/* ------------------------------------------------------------------ *
 * The two lists behind the numbers
 * ------------------------------------------------------------------ */

/**
 * `#/me/friends` — the people you are connected to.
 *
 * ⚠️ `#/me/followers` AND `#/me/following` LAND HERE TOO, and always did land on
 * this same list of the same people; they were two names for it. They are kept
 * resolving rather than deleted because they were live routes, and this project
 * has not broken a deep link yet.
 */
export async function MePeopleView() {
  const title = 'Friends';
  const body = el('div', { class: 'list' });

  const screen = screenShell({
    title,
    // Rule 8: history first, this only when there is none to go back through.
    back: '#/me',
    scroll: body,
  });

  (async () => {
    const state = await social.state().catch(() => ({ available: false, reason: 'offline' }));
    if (!state.available) {
      setChildren(body, emptyState(title,
        OFFLINE_COUNTS[state.reason] || 'This list cannot be loaded right now.'));
      return;
    }
    const people = state.connections || [];
    if (!people.length) {
      setChildren(body, emptyState('No friends yet',
        'Ask somebody to connect, or accept a request, and they show up here.',
        el('a', { class: 'btn primary', href: '#/find', text: 'Add a friend' })));
      return;
    }
    setChildren(body, ...people.map((p) => el('a', {
      class: 'row', href: `#/friend/${encodeURIComponent(p.uid)}`,
    },
      el('span', { class: 'row-face' }, personFace(p.avatar, 20)),
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: p.name || 'Someone' }),
      ),
      el('span', { class: 'row-chev' }, chevron()),
    )));
  })().catch(() => {
    setChildren(body, emptyState('Could not load this list',
      'The connection dropped. It will be here when it is back.'));
  });

  return screen;
}

/**
 * `#/me/workouts` — your own training, newest first.
 *
 * ⚠️ IT OPENS THE DAY, not an edit form. Tapping a workout here is "show me
 * that session", and `#/day/<date>` is the screen that already answers it —
 * with the edit pencil on it for anybody who wanted the other thing.
 */
export async function MeWorkoutsView() {
  const body = el('div', { class: 'list' });
  const screen = screenShell({
    title: 'Your workouts',
    back: '#/me',
    scroll: body,
  });

  (async () => {
    const sessions = await store.getSessions();
    if (!sessions.length) {
      setChildren(body, emptyState('Nothing recorded yet',
        'Every workout you finish shows up here, newest first.',
        el('a', { class: 'btn primary', href: '#/record', text: 'Record a workout' })));
      return;
    }
    // Newest first. `date` is the local day the session belongs to, which is
    // the one a person is looking for — not `startedAt`, which is a UTC instant.
    const rows = [...sessions].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    setChildren(body,
      el('div', { class: 'field-help', text:
        `${rows.length} workout${rows.length === 1 ? '' : 's'}, newest first.` }),
      ...rows.map((s) => {
        const sets = recordedSetCount(s);
        const exercises = (s.entries || []).length;
        return el('a', { class: 'row', href: `#/day/${encodeURIComponent(s.date)}` },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: s.workoutName || 'Workout' }),
            el('div', { class: 'row-sub', text:
              `${relativeDay(s.date)} · ${fmtDateShort(s.date)} · ${sets} set${sets === 1 ? '' : 's'}`
              + (exercises ? ` · ${exercises} exercise${exercises === 1 ? '' : 's'}` : '') }),
          ),
          el('span', { class: 'row-chev' }, chevron()),
        );
      }),
    );
  })().catch(() => {
    setChildren(body, emptyState('Could not load your workouts',
      'Everything you have recorded is safe. Try again in a moment.'));
  });

  return screen;
}

/** The router hands `#/me/<sub>` here so one route owns the whole section. */
export async function MeRouteView(param) {
  const sub = String(param || '').split('/')[0];
  // ⚠️ Three names, one list — `followers` and `following` are the old routes and
  // they resolve rather than 404. See MePeopleView.
  if (sub === 'friends' || sub === 'followers' || sub === 'following') return MePeopleView();
  if (sub === 'workouts') return MeWorkoutsView();
  return MeView();
}
