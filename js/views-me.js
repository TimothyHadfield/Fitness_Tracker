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
// ⚠️ THE THREE COUNTS ARE THE SCREEN, so they must be honest about what they
// count — see COUNTS_HELP below, which is the one thing on here that needed
// thinking about rather than building.

import { store, social, demo } from './store.js';
import {
  el, screenShell, emptyState, chevron, setChildren, personFace, icon,
  fmtDateShort, relativeDay, helpDot,
} from './ui.js';
import { recordedSetCount } from './session-stats.js';

const go = (hash) => { location.hash = hash; };

/* 🚨 WHAT "FOLLOWERS" AND "FOLLOWING" ACTUALLY MEAN HERE, AND WHY THEY ARE THE
 * SAME NUMBER.
 *
 * This app has no follow model. A connection is MUTUAL — asked for, accepted,
 * and symmetrical from that moment — which was answered as an open question
 * long before this screen existed ("Social: mutual or followers? → Mutual").
 * So everybody who follows you is somebody you follow, and the two lists hold
 * the same people. Printing two numbers that are always equal looks like a bug
 * until you know that, which is exactly what a "?" is for.
 *
 * ⚠️ AND THE HARDER HALF: ON A PUBLIC ACCOUNT, "FOLLOWERS" IS NOT KNOWABLE.
 * D29 makes an account public by default, and a public account is readable by
 * anybody signed in who finds it — none of whom are in the graph. So the number
 * is the people you are CONNECTED to, which is a complete answer on a private
 * account and a floor on a public one. **It is labelled as what it is rather
 * than quietly presented as an audience**, because a follower count that
 * undercounts by an unbounded amount is the kind of number this app does not
 * print without saying so. Building a real follow model is a different feature
 * and nobody has asked for one.
 */
function countsHelp(visibility) {
  return el('div', {},
    el('p', {}, el('b', { text: 'The same people, twice. ' }),
      'Connecting here is mutual — you ask, they accept, and from then on you each see the '
      + 'other. So everybody following you is somebody you follow, and both lists hold the '
      + 'same names.'),
    visibility === 'public'
      ? el('p', {}, el('b', { text: 'Your account is public, ' }),
          'so anybody signed in who finds you can see your training without connecting. '
          + 'They are not in this count, and there is no way for the app to know how many '
          + 'there are. This number is the people you are connected to.')
      : el('p', {}, el('b', { text: 'Your account is private, ' }),
          'so these are the only people who can see your training.'),
  );
}

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
  const [settings, sessions, state] = await Promise.all([
    store.getSettings(),
    store.getSessions(),
    social.state().catch(() => ({ available: false, reason: 'offline' })),
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
      connections === null
        ? el('span', { class: 'me-stat is-off' },
            el('span', { class: 'me-stat-n', text: '—' }),
            el('span', { class: 'me-stat-l', text: 'Followers' }))
        : statTile('Followers', connections.length, '#/me/followers'),
      connections === null
        ? el('span', { class: 'me-stat is-off' },
            el('span', { class: 'me-stat-n', text: '—' }),
            el('span', { class: 'me-stat-l', text: 'Following' }))
        : statTile('Following', connections.length, '#/me/following'),
    ),

    connections === null
      ? el('div', { class: 'field-help', text: OFFLINE_COUNTS[state.reason]
          || 'Your connections cannot be counted right now.' })
      : el('div', { class: 'help-line' },
          el('span', { class: 'field-help', text:
            'Connections here are mutual, so both lists hold the same people.' }),
          helpDot(countsHelp(state.visibility),
            { label: 'What followers and following count', title: 'Who these numbers are' })),
  );
}

const OFFLINE_COUNTS = {
  demo: 'Followers and following are off in the demo account.',
  local: 'Connecting with people needs an account.',
  anonymous: 'Add an email to your account to connect with people.',
  offline: 'You are offline, so your connections cannot be counted.',
};

/* ------------------------------------------------------------------ *
 * The three lists behind the numbers
 * ------------------------------------------------------------------ */

/** `#/me/followers` and `#/me/following` — the same people under both labels. */
export async function MePeopleView(which) {
  const following = which === 'following';
  const title = following ? 'Following' : 'Followers';
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
      setChildren(body, emptyState(`No ${title.toLowerCase()} yet`,
        'Connecting is mutual — once somebody accepts, they appear under both Followers and '
        + 'Following.',
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
  if (sub === 'followers' || sub === 'following') return MePeopleView(sub);
  if (sub === 'workouts') return MeWorkoutsView();
  return MeView();
}
