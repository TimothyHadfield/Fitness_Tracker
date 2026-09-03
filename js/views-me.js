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

import { store, social, demo, activityByDate, todayISO } from './store.js';
// ⚠️ ONE calendar, four doors. See `calendarSection` below and `ownCalendar`'s
// own header — a second copy is the drift that function exists to prevent.
import { ownCalendar } from './views-data.js';
// 🆕 "What are my best lifts, ever?" — the question the app could not answer
// until 2026-09-10. Pure; the screen only formats what it hands back.
import { bestLifts } from './profile-records.js';
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
  const [settings, sessions, state, activity] = await Promise.all([
    store.getSettings(),
    store.getSessions(),
    social.state().catch(() => ({ available: false, reason: 'offline' })),
    // 🆕 THE CALENDAR LIVES HERE SINCE 2026-09-10 — see the block below.
    activityByDate().catch(() => new Map()),
  ]);

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

    bestLiftsSection(sessions),
    calendarSection(activity),
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
function bestLiftsSection(sessions) {
  const { lifts, total, shown, empty } = bestLifts(sessions);
  if (empty) return null;

  return el('div', { class: 'me-bests' },
    el('div', { class: 'section-label', text: 'Your best lifts' }),
    el('div', { class: 'list' }, ...lifts.map((l) => el('div', { class: 'row me-best' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: l.name }),
        el('div', { class: 'row-sub', text:
          `${l.days} ${l.days === 1 ? 'day' : 'days'} · last ${fmtDateShort(l.lastDate)}` }),
      ),
      el('div', { class: 'me-best-nums' },
        el('span', { class: 'me-best-top', text: bestText(l) }),
        // 🚨 A SEPARATE LINE, AND THE WORD IS ON IT. An estimate beside a
        // measurement with nothing to tell them apart is the one thing this
        // app is not allowed to do.
        l.estimatedMax && !l.sameSet
          ? el('span', { class: 'me-best-est', text:
              `${units.withUnit(Math.round(l.estimatedMax.value))} estimated max` })
          : null,
      ),
    ))),
    // Says what it is showing rather than implying it is everything.
    total > shown
      ? el('div', { class: 'field-help', text:
          `The ${shown} lifts you have trained most, of ${total}.` })
      : null,
  );
}

/** The measured half, in the units the set was logged in. */
function bestText(l) {
  const b = l.best;
  if (b.kind === 'reps') return `${b.reps} reps`;
  return `${units.withUnit(b.weight)}${l.perSide ? '/side' : ''}`
    + (b.reps ? ` × ${b.reps}` : '');
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
 * ⚠️ AND `#/calendar` IS STILL A SCREEN. It has survived four moves without
 * breaking a link and `#/day/<iso>` and `#/edit/<id>` hang off it, so a day
 * opened from here still lands somewhere that stands up on its own.
 * ------------------------------------------------------------------ */
function calendarSection(activity) {
  const host = el('div', { class: 'me-cal-host' });
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
