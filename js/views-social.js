// Social — the screens.
//
// docs/social-plan.md, Phases 2 and 3. Tim, 2026-08-18: a Social section beside
// Home, Workouts, Calendar and Data, where you interact with friends and see
// their data, all in one place.
//
// ⚠️ Two decisions were taken here rather than asked about, both of them the
// recommendation already written into the plan (§9), and both are the kind that
// are much harder to reverse later than to choose now:
//
//   MUTUAL, not followers. Both sides agree and either can leave. An
//   asymmetric audience creates performance, and performance is what turns a
//   training log into a place where people post their best day and quietly
//   stop logging their worst.
//
//   A LIST YOU VISIT, not a feed. You open a friend and see their page. D7
//   says no social feed, and this delivers "see what my friends are doing"
//   without needing that decision reopened. No likes, no kudos, no comments,
//   no streaks, no leaderboards — each is individually reasonable and
//   collectively the product D7 was written against.
//
// Everything shown here comes from a PUBLISHED COPY (js/social.js), never from
// anybody's private collections. This file cannot read another person's real
// data even if it tries — the rules refuse it.

import { store, auth, social } from './store.js';
import {
  el, icon, iconBtn, screenShell, emptyState, openSheet, confirmSheet, toast,
  fmtDateLong, relativeDay, chevron, setChildren, fmtSet, youFriendsTabs, personFace,
  refreshRoute,
} from './ui.js';
import {
  TIERS, TIER_LABEL, TIER_DETAIL, NONE, LIGHT, MID, FULL,
  atLeast, parseInviteRoute, profileLink,
} from './social.js';
import { encodeQR } from './qr.js';
import { sessionStats, recordedSetCount } from './session-stats.js';
import { minisOf, miniLabel, groupLabel } from './set-types.js';

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

// Why social is unavailable, and what to do about it. Three different answers,
// because "you can't use this" with no route out is the thing this app is not
// allowed to do.
function unavailable(reason) {
  // ⚠️ Not "sign in to use Social". The reason a demo user cannot be social has
  // nothing to do with their account, and telling them to sign in would be a
  // confidently wrong answer to the right question.
  if (reason === 'demo') {
    return emptyState(
      'Sharing is off in the demo',
      'Sharing publishes a copy of your training for a friend to read, and the demo account\'s '
      + 'training is invented — publishing it to real people would be worse than not being able to '
      + 'try this screen. Leave the demo and your friends come back exactly as they were.',
      el('a', { class: 'btn primary', href: '#/account', text: 'Leave the demo' }),
    );
  }
  if (reason === 'anonymous') {
    return emptyState(
      'Friends need a real account',
      'You are signed in anonymously, which lives only in this browser. Add an email or Google '
      + 'sign-in so friends are connecting to an account that will still be here tomorrow. Your '
      + 'training history comes with you.',
      el('a', { class: 'btn primary', href: '#/account', text: 'Set up my account' }),
    );
  }
  if (reason === 'offline') {
    return emptyState(
      'Not connected right now',
      'Friends needs a connection. Everything else in the app carries on working — you can log a '
      + 'whole workout offline and it will sync when you are back.',
      el('button', {
        class: 'btn', text: 'Try again',
        onClick: async () => { await auth.retry(); refreshRoute('#/social'); },
      }),
    );
  }
  return emptyState(
    'Friends is not switched on',
    'This copy of the app is storing your data on this device only, so there is no account for a '
    + 'friend to connect to.',
  );
}

// The control that says what one person may see. The sheet names all four
// options and says what each means — "mid visibility" is meaningless to
// somebody who has not read the plan, and D8 says teach at the moment of use.
function visibilitySheet(name, current, onPick) {
  const options = [FULL, MID, LIGHT, NONE];
  const row = (tier) => el('button', {
    class: 'pick-row' + (tier === current ? ' is-on' : ''),
    onClick: () => { close(); onPick(tier); },
  },
    el('div', { style: 'flex:1;min-width:0' },
      el('div', { class: 'pick-title', text: TIER_LABEL[tier] }),
      el('div', { class: 'pick-sub', text: TIER_DETAIL[tier] }),
    ),
    tier === current ? icon('check') : null,
  );

  const { close } = openSheet({
    title: `What ${name} can see`,
    body: el('div', { class: 'pick-list' },
      ...options.map(row),
      el('p', { class: 'note', text:
        'Changing this takes effect straight away. It cannot un-see anything they have already '
        + 'looked at.' }),
    ),
  });
}

/* ------------------------------------------------------------------ *
 * The Social tab
 * ------------------------------------------------------------------ */

export async function SocialView() {
  let state;
  try {
    state = await social.state();
  } catch (err) {
    state = { available: false, reason: 'offline' };
  }

  if (!state.available) {
    return screenShell({
      title: 'Friends', profile: true,
      top: youFriendsTabs('friends'),
      scroll: unavailable(state.reason),
    });
  }

  if (!state.name) return nameSetupScreen();

  const body = el('div', { class: 'list' });
  const screen = screenShell({
    // ⚠️ "Friends", not "Social" — this is half of the Home tab now, and the
    // switch above it says Friends. Two names for one screen is the "system"
    // vs "programme" fault the UX review found, and it is cheaper to not
    // introduce it than to go back and unpick it.
    title: 'Friends',
    sub: `You appear as ${state.name}`,
    profile: true,
    top: youFriendsTabs('friends'),
    actions: [iconBtn('edit', 'Change your display name', () => renameSheet(state.name))],
    scroll: body,
    // ⚠️ "Add a friend", not "Invite a friend" — there are three ways in now
    // (search, code, link) and naming the button after one of them would hide
    // the other two behind a word that does not describe them.
    bottom: el('button', {
      class: 'btn primary block',
      onClick: () => { location.hash = '#/find'; },
    }, icon('plus', 16), 'Add a friend'),
  });

  // ⚠️ NOT AWAITED — the screen goes up now and fills in when the network
  // answers. Tim, 2026-08-26, on an iPhone: *"whenever I click on friends in
  // the home menu, it has a long delay and lag to it that's alarming."* The
  // router awaits the view before it swaps the DOM, so every millisecond spent
  // here was a tap that visibly did nothing — the PREVIOUS screen stayed under
  // his thumb. This is the shape profileButton() and fillFeed() already use.
  fillSocial(body, state).catch(() => {
    setChildren(body, emptyState('Could not load your friends',
      'You are signed in, but the list could not be fetched just now. It will be here when the '
      + 'connection is back.'));
  });
  return screen;
}

async function fillSocial(body, state) {
  const parts = [];

  // ⚠️ ONE read, partitioned — this was TWO identical list queries, awaited one
  // after the other, for the claimed half and the unclaimed half of the same
  // collection. On cellular that is a whole round trip spent asking a question
  // already answered.
  // ⚠️ IN PARALLEL, and none of them may take the screen down. Each is a
  // separate cloud read and each one is optional — the friends list is the
  // screen, and a failed invite fetch must not blank it.
  const [invites, offers, departed, requests, joined] = await Promise.all([
    social.invites().catch(() => []),
    social.handoffs().catch(() => []),
    // ⚠️ ACTING ON DEPARTURES HAPPENS HERE, on the screen where somebody would
    // notice the result, rather than on a timer. Open work 0j: this is the half
    // that makes a disconnect mutual — the other person left a note, and this
    // is my client removing them and republishing without them. A background
    // job that republishes is a background job that can surprise you.
    social.processDisconnects().catch(() => 0),
    // Who has asked to connect with me (2026-08-29).
    social.requests().catch(() => []),
    /* ⚠️ AND THE OTHER SIDE OF THAT: turning MY accepted requests into
     * connections. It runs here for exactly the reason processDisconnects()
     * does — this is the screen where somebody would notice the result.
     *
     * ⚠️ The probe IS the notification. Accepting needs no write into the
     * asker's account: adding them to your graph republishes with them in
     * `viewers`, which makes your shared document readable to them under a
     * rule that has existed since 2026-08-18. So this asks "can I read them
     * yet?" of everybody I asked, and a yes can only have come from their
     * accept. Nobody I did not ask is ever probed. */
    social.processAcceptedRequests().catch(() => 0),
  ]);
  const claims = invites.filter((i) => i.claimedBy);

  if (joined > 0) {
    // ⚠️ Said, for the same reason a departure is: a name APPEARING on the list
    // with no explanation is as confusing as one vanishing, and this one is
    // good news that would otherwise go unnoticed entirely.
    parts.push(el('p', { class: 'note', text: joined === 1
      ? 'Somebody accepted your request — they are on your friends list now.'
      : `${joined} people accepted your requests and are on your friends list now.` }));
  }

  if (departed > 0) {
    // Said once, plainly. Somebody disappearing off the list with no
    // explanation is the kind of thing that reads as the app losing data.
    parts.push(el('p', { class: 'note', text: departed === 1
      ? 'Somebody disconnected from you, so they have been removed from your friends list.'
      : `${departed} people disconnected from you and have been removed from your friends list.` }));
  }

  /* ⚠️ WORKOUTS SOMEBODY RECORDED FOR ME — Open work 0e's friend half.
   *
   * Tim's decision is the whole shape: the other person ACCEPTS it. Nothing
   * has been written into my training yet; this is an offer sitting in a
   * subtree of my account, and until I tap Add my sessions are untouched. That
   * is also why the sender's name is on it — I should know whose word I am
   * taking before I take it. */
  if (offers.length) {
    parts.push(el('h2', { class: 'section-head', text: 'Recorded for you' }));
    for (const o of offers) {
      const s = o.session || {};
      const what = [s.workoutName || 'Workout', relativeDay(s.date)].filter(Boolean).join(' · ');
      const exercises = (s.entries || []).map((x) => x && x.exerciseName).filter(Boolean);
      parts.push(el('div', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: what }),
          el('div', { class: 'row-sub', text:
            `${o.fromName || 'A friend'} logged this for you`
            + (exercises.length ? ` — ${exercises.slice(0, 4).join(', ')}` : '') }),
        ),
        el('button', {
          class: 'btn small primary', text: 'Add',
          onClick: async (e) => {
            e.target.disabled = true;
            try {
              await social.acceptHandoff(o.id);
              toast('Added to your training.');
              refresh();
            } catch (err) { e.target.disabled = false; toast(err.message); }
          },
        }),
        el('button', {
          class: 'btn small ghost', text: 'No',
          onClick: async (e) => {
            e.target.disabled = true;
            try { await social.declineHandoff(o.id); toast('Turned down.'); refresh(); }
            catch (err) { e.target.disabled = false; toast(err.message); }
          },
        }),
      ));
    }
  }

  /* ⚠️ SOMEBODY ASKED TO CONNECT (2026-08-29). Distinct from "Waiting for
   * you" below, which is somebody who used a link I HANDED THEM — I already
   * agreed to that connection when I made the link. This is unsolicited, so it
   * leads with the plain question and offers No as an equal choice.
   *
   * ⚠️ Declining is SILENT. They are not told, and there is nothing on this
   * screen offering to tell them — "X turned you down" is a message this app
   * has no reason to be able to send. */
  if (requests.length) {
    parts.push(el('h2', { class: 'section-head', text: 'Asked to connect' }));
    for (const r of requests) {
      parts.push(el('div', { class: 'row' },
        el('div', { class: 'row-icon' }, icon('person')),
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: r.name }),
          el('div', { class: 'row-sub wrap', text:
            'They want to connect. If you add them they start on "just that I trained" '
            + 'until you change it.' }),
        ),
        el('button', {
          class: 'btn small primary', text: 'Add',
          onClick: async (e) => {
            e.target.disabled = true;
            try {
              await social.acceptRequest(r.uid, r.name);
              toast(`${r.name} is on your friends list.`);
              refresh();
            } catch (err) { e.target.disabled = false; toast(err.message); }
          },
        }),
        el('button', {
          class: 'btn small ghost', text: 'No',
          onClick: async (e) => {
            e.target.disabled = true;
            try { await social.declineRequest(r.uid); toast('Turned down.'); refresh(); }
            catch (err) { e.target.disabled = false; toast(err.message); }
          },
        }),
      ));
    }
  }

  if (claims.length) {
    parts.push(el('h2', { class: 'section-head', text: 'Waiting for you' }));
    for (const c of claims) {
      parts.push(el('div', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: c.claimedName || 'Someone' }),
          el('div', { class: 'row-sub', text: 'Used your invite link' }),
        ),
        el('button', {
          class: 'btn small primary', text: 'Add',
          onClick: async (e) => {
            e.target.disabled = true;
            try {
              await social.acceptClaim(c.token || c.id);
              toast(`${c.claimedName || 'They'} can now see that you train.`);
              refresh();
            } catch (err) { e.target.disabled = false; toast(err.message); }
          },
        }),
      ));
    }
  }

  parts.push(el('h2', { class: 'section-head', text: 'Friends' }));

  if (!state.connections.length) {
    parts.push(el('p', { class: 'note', text:
      'Nobody yet. Search for them by name, show them your code, or send an invite link — '
      + 'whichever is easier. New friends start on "just that I trained" until you change it.' }));
  } else {
    for (const c of state.connections) {
      const title = el('div', { class: 'row-title', text: c.name || 'Friend' });
      /* ⚠️ THE FACE IS FILLED IN AFTER THE ROW IS PAINTED, never awaited before
       * it. Their photo lives in the document THEY published, so it costs a read
       * per friend — and this is the screen Tim reported in 2026-08-26 as having
       * "a long delay and lag to it that's alarming", which was three serialised
       * round trips before a pixel moved. The list paints from the graph
       * immediately, as it does now; the pictures arrive when they arrive, and a
       * friend who cannot be read keeps the glyph. Same shape as
       * healConnectionName below, which had the same problem to solve. */
      const faceSlot = el('div', { class: 'row-icon' }, icon('person'));
      social.friend(c.uid)
        .then(({ doc }) => {
          const avatar = doc && doc.profile ? doc.profile.avatar : null;
          if (avatar && faceSlot.isConnected) setChildren(faceSlot, personFace(avatar));
        })
        .catch(() => {});
      parts.push(el('a', { class: 'row', href: `#/friend/${encodeURIComponent(c.uid)}` },
        faceSlot,
        el('div', { class: 'row-main' },
          title,
          el('div', { class: 'row-sub', text: `They can see: ${TIER_LABEL[c.tier] || TIER_LABEL[LIGHT]}` }),
        ),
        chevron(),
      ));
      // ⚠️ A row still saying "Friend" is the accept-flow placeholder: their
      // real name was not readable at accept time (they had not accepted back
      // yet), and nothing ever went back to fix the stored row — so Tim's
      // friend was "Friend" in every list and "Autumn Dossey" on her own
      // page. Heal from the published profile, update in place, and the
      // stored graph is right for every screen from then on.
      if (!c.name || c.name === 'Friend') {
        social.healConnectionName(c.uid)
          .then((n) => { if (n && title.isConnected) title.textContent = n; })
          .catch(() => {});
      }
    }
  }

  // Links that have been sent and not yet used. Shown so a link can be taken
  // back — an invite is a capability, and a capability you cannot revoke is a
  // worse thing than one you never made.
  const open = invites.filter((i) => !i.claimedBy);
  if (open.length) {
    parts.push(el('h2', { class: 'section-head', text: 'Invite links you have sent' }));
    for (const i of open) {
      parts.push(el('div', { class: 'row' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: 'Unused link' }),
          el('div', { class: 'row-sub', text: `Made ${relativeDay(String(i.createdAt).slice(0, 10))} · expires after 7 days` }),
        ),
        el('button', {
          class: 'btn small ghost', text: 'Cancel',
          onClick: async () => {
            try { await social.revokeInvite(i.id || i.token); toast('Link cancelled.'); refresh(); }
            catch (err) { toast(err.message); }
          },
        }),
      ));
    }
  }

  setChildren(body, ...parts);
}

function refresh() {
  refreshRoute('#/social');
}

/* ------------------------------------------------------------------ *
 * Display name
 * ------------------------------------------------------------------ */

function nameSetupScreen() {
  const input = el('input', { class: 'input', maxlength: '60', placeholder: 'e.g. Tim H' });
  const save = async () => {
    try {
      await social.setDisplayName(input.value);
      refresh();
    } catch (err) { toast(err.message); }
  };

  return screenShell({
    title: 'Social', profile: true,
    scroll: el('div', { class: 'form' },
      el('h2', { class: 'section-head', text: 'Pick a display name' }),
      el('p', { class: 'note', text:
        'This is the only thing your friends see about you by default. Your email address is never '
        + 'shown to anyone.' }),
      input,
      el('button', { class: 'btn primary block', text: 'Continue', onClick: save }),
    ),
  });
}

function renameSheet(current) {
  const input = el('input', { class: 'input', maxlength: '60', value: current });
  const { close } = openSheet({
    title: 'Your display name',
    body: el('div', { class: 'form' },
      input,
      el('p', { class: 'note', text: 'Changing this updates it everywhere your friends see you.' }),
    ),
    footer: el('div', { class: 'btn-row' },
      el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => close() }),
      el('button', {
        class: 'btn primary', text: 'Save',
        onClick: async () => {
          try { await social.setDisplayName(input.value); close(); refresh(); }
          catch (err) { toast(err.message); }
        },
      }),
    ),
  });
}

/* ------------------------------------------------------------------ *
 * Inviting
 * ------------------------------------------------------------------ */

async function inviteSheet() {
  let made;
  try {
    made = await social.createInvite();
  } catch (err) { toast(err.message); return; }

  // Selectable rather than only copyable: navigator.clipboard needs a secure
  // context and permission, and a link you cannot select is a dead end when it
  // is refused.
  const field = el('input', { class: 'input mono', value: made.link, readonly: 'readonly' });

  openSheet({
    title: 'Invite a friend',
    body: el('div', { class: 'form' },
      el('p', { class: 'note', text:
        'Send them this link. It works once, expires in 7 days, and you can cancel it any time '
        + 'before it is used. When they open it you will be asked to confirm before anything is '
        + 'shared.' }),
      field,
      el('button', {
        class: 'btn block', text: 'Copy link',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(made.link);
            toast('Link copied.');
          } catch (_) {
            field.select();
            toast('Press Ctrl+C to copy.');
          }
        },
      }),
    ),
    onClose: refresh,
  });
}

/* ------------------------------------------------------------------ *
 * Accepting an invite  —  #/invite/<ownerUid>/<token>
 * ------------------------------------------------------------------ */

export async function InviteView(param) {
  const parsed = parseInviteRoute(param);
  const back = () => { location.hash = '#/social'; };

  if (!parsed) {
    return screenShell({ title: 'Invite', back, noNav: true,
      scroll: emptyState('That link is not complete', 'Ask your friend to send it again.') });
  }

  let state;
  try { state = await social.state(); } catch (_) { state = { available: false, reason: 'offline' }; }
  if (!state.available) {
    return screenShell({ title: 'Invite', back, noNav: true, scroll: unavailable(state.reason) });
  }
  if (!state.name) {
    return screenShell({ title: 'Invite', back, noNav: true,
      scroll: emptyState(
        'Pick a display name first',
        'Your friend will see this name when you accept. It takes a moment.',
        el('a', { class: 'btn primary', href: '#/social', text: 'Choose a name' }),
      ) });
  }
  if (parsed.ownerUid === state.uid) {
    return screenShell({ title: 'Invite', back, noNav: true,
      scroll: emptyState('That is your own link', 'Send it to somebody else and they can open it.') });
  }

  let found;
  try {
    found = await social.openInvite(parsed.ownerUid, parsed.token);
  } catch (err) {
    return screenShell({ title: 'Invite', back, noNav: true,
      scroll: emptyState('That link could not be opened', err.message || 'It may have been cancelled.') });
  }

  // Each refusal says the different thing, because "already used" and "expired"
  // send somebody to two different next steps and "invalid link" sends them to
  // neither.
  const MESSAGES = {
    claimed: ['That link has already been used', 'Links work once. Ask them for a fresh one.'],
    expired: ['That link has expired', 'Invite links last 7 days. Ask them for a new one.'],
    invalid: ['That link is not valid', 'It may have been cancelled. Ask them to send another.'],
  };
  if (found.state !== 'open') {
    const [title, msg] = MESSAGES[found.state] || MESSAGES.invalid;
    return screenShell({ title: 'Invite', back, noNav: true, scroll: emptyState(title, msg) });
  }

  const accept = async (e) => {
    e.target.disabled = true;
    try {
      await social.acceptInvite(parsed.ownerUid, parsed.token, 'Friend');
      toast('Connected. They can see that you train — change it any time.');
      location.hash = '#/social';
    } catch (err) { e.target.disabled = false; toast(err.message); }
  };

  return screenShell({
    title: 'Invite', back, noNav: true,
    scroll: el('div', { class: 'form' },
      el('h2', { class: 'section-head', text: 'Connect' }),
      el('p', { class: 'note', text:
        `You will appear to them as ${state.name}. To start, they will only be able to see that you `
        + 'trained and when — not your exercises, weights or anything else. You choose what they see '
        + 'from your Social screen, and you can disconnect whenever you like.' }),
      el('button', { class: 'btn primary block', text: 'Connect', onClick: accept }),
      el('a', { class: 'btn ghost block', href: '#/social', text: 'Not now' }),
    ),
  });
}

/* ------------------------------------------------------------------ *
 * One friend  —  #/friend/<uid>
 * ------------------------------------------------------------------ */

export async function FriendView(uid) {
  const back = () => { location.hash = '#/social'; };

  let state;
  try { state = await social.state(); } catch (_) { state = { available: false, reason: 'offline' }; }
  if (!state.available) {
    return screenShell({ title: 'Friend', back, noNav: true, scroll: unavailable(state.reason) });
  }

  const conn = state.connections.find((c) => c.uid === uid);
  if (!conn) {
    return screenShell({ title: 'Friend', back, noNav: true,
      scroll: emptyState('Not connected', 'You are not connected to them any more.') });
  }

  let seen = { tier: null, doc: null };
  try { seen = await social.friend(uid); } catch (_) {}

  const name = (seen.doc && seen.doc.profile && seen.doc.profile.name) || conn.name || 'Friend';
  // Opening their page is the other moment their real name is in hand while
  // the graph may still hold the accept-flow placeholder — persist it, so the
  // lists stop saying "Friend" even if this screen is the only one visited.
  if (!conn.name || conn.name === 'Friend') {
    social.healConnectionName(uid).catch(() => {});
  }
  const body = el('div', { class: 'list' });

  const screen = screenShell({
    title: name,
    sub: seen.tier ? `They share: ${TIER_LABEL[seen.tier]}` : 'They share nothing with you',
    back, noNav: true,
    scroll: body,
  });

  const parts = [];

  /* ⚠️ THEIR FACE, ONCE, AT THE TOP — and only where there is one (2026-08-31).
   * The screen already says the name in the title bar, so a circle with the
   * person glyph in it would be an empty ornament on every account that has not
   * added a photo, which is most of them. With a photo it is the one thing on
   * this screen that says whose page this is at a glance. */
  if (seen.doc && seen.doc.profile && seen.doc.profile.avatar) {
    parts.push(el('div', { class: 'friend-face' },
      personFace(seen.doc.profile.avatar, 40),
      el('div', { class: 'row-title', text: name }),
    ));
  }

  // What I share with them, always first and always visible — the thing a
  // person most wants to check on this screen is not what their friend shared,
  // it is what they themselves are giving away.
  parts.push(el('h2', { class: 'section-head', text: 'What they can see of yours' }));
  const mine = el('button', {
    class: 'row as-button',
    onClick: () => visibilitySheet(conn.name || 'They', conn.tier, async (tier) => {
      try {
        await social.setTier(uid, tier);
        toast('Updated.');
        refreshRoute(`#/friend/${encodeURIComponent(uid)}`);
      } catch (err) { toast(err.message); }
    }),
  },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: TIER_LABEL[conn.tier] || TIER_LABEL[LIGHT] }),
      // `.wrap`, because this one is a sentence rather than a name — clipped to
      // one line it ended "...plus benchmarks, your muscle map and your pr…",
      // which is the one row on this screen where the detail is the point.
      el('div', { class: 'row-sub wrap', text: TIER_DETAIL[conn.tier] || TIER_DETAIL[LIGHT] }),
    ),
    chevron(),
  );
  parts.push(mine);

  if (!seen.doc) {
    parts.push(el('h2', { class: 'section-head', text: 'What they share' }));
    parts.push(el('p', { class: 'note', text:
      'Nothing yet. They have either not chosen what to share with you, or have not trained since '
      + 'they connected.' }));
  } else {
    if (atLeast(seen.tier, FULL) && seen.doc.strength && seen.doc.strength.length) {
      parts.push(el('h2', { class: 'section-head', text: 'Muscle map' }));
      parts.push(await friendBody(seen.doc.strength));
    }
    if (seen.doc.bodyWeight && seen.doc.bodyWeight.length) {
      const last = seen.doc.bodyWeight[seen.doc.bodyWeight.length - 1];
      parts.push(el('p', { class: 'note', text: `Body weight ${Math.round(last.weight)} lbs on ${fmtDateLong(last.date)}` }));
    }

    parts.push(el('h2', { class: 'section-head', text: 'Recent workouts' }));
    const acts = seen.doc.activity || [];
    if (!acts.length) {
      parts.push(el('p', { class: 'note', text: 'Nothing recorded yet.' }));
    } else {
      for (const a of acts) parts.push(activityRow(a, seen.tier, uid));
    }
  }

  parts.push(el('div', { class: 'danger-zone' },
    el('button', {
      class: 'btn danger block', text: 'Disconnect',
      onClick: () => confirmSheet({
        title: 'Disconnect?',
        // ⚠️ THIS SHEET USED TO PROMISE SOMETHING FALSE. It said "and you will
        // not see theirs", and `social.remove()` edits only MY graph — their
        // published copy still lists me in its `viewers`, so I can go on reading
        // their training after pressing this. Found by the live social round
        // trip on 2026-08-22 and left standing for two days because the real fix
        // is a mutual disconnect, which needs something their client can read
        // and therefore a new rules path.
        //
        // ⚠️ The sentence is corrected first and separately, on purpose. A
        // half-built feature is a known gap; a screen that states the opposite
        // of what the code does is a lie the user acts on — they press this
        // believing a link is cut in both directions, and it is not. Say what
        // actually happens until the other half exists.
        message: `${conn.name || 'They'} will no longer be able to see anything of yours, and they `
          + 'drop off your friends list. It cannot un-see anything they have already looked at.\n\n'
          + 'They are told, so their app will drop you too the next time they open it. Until then '
          + 'their training may still be readable by this account.',
        confirmLabel: 'Disconnect',
        onConfirm: async () => {
          try {
            const r = await social.remove(uid);
            // ⚠️ Say which of the two actually happened. "Disconnected" over a
            // note that never reached them would be this sheet's promise going
            // unkept silently — the exact fault it has already had once.
            toast(r && r.told === false
              ? 'Disconnected on your side — we could not reach them to tell them.'
              : 'Disconnected.');
            location.hash = '#/social';
          } catch (err) { toast(err.message); }
        },
      }),
    }),
  ));

  setChildren(body, ...parts);
  return screen;
}

/* ------------------------------------------------------------------ *
 * One workout  —  #/friend/<uid>/<sessionId>
 *
 * docs/social-plan.md §13 steps 3 and 4, and §12.15 is the screen it is modelled
 * on — Hevy's workout detail, seen at last through four photographs Tim took of
 * his own phone.
 *
 * ⚠️ IT IS ADDRESSED THROUGH THE FRIEND ROUTE ON PURPOSE. There is no per-session
 * read in this app and there cannot be one: a friend publishes ONE document per
 * tier holding up to sixty sessions, and Firestore grants per document. So this
 * screen reads the same document the friend's page reads and finds the session
 * inside it by id. That also means it costs exactly what opening their page
 * costs, and is served from the same 30-second read cache.
 *
 * What it does NOT do is invent an owner-side twin: your own sessions already
 * have a detail screen at #/day/<date>, and giving them a second one would put
 * two screens in the app that must agree about the same workout forever.
 * ------------------------------------------------------------------ */

export async function FriendSessionView(uid, sessionId) {
  const back = () => { location.hash = `#/friend/${encodeURIComponent(uid)}`; };

  let state;
  try { state = await social.state(); } catch (_) { state = { available: false, reason: 'offline' }; }

  /* ⚠️ THE DEMO OPENS THESE TOO, for the same reason Home's feed has a demo
   * branch: the demo account is where every screen in this app is looked at,
   * measured and audited, and a card that opens "not available here" would make
   * the newest screen in the product the one nobody can see. Reading an invented
   * friend is not the hazard — publishing to a real one is, and that stays
   * refused. Nothing here touches the network, storage, or anybody's account. */
  let demoEntry = null;
  if (state.reason === 'demo') {
    const { buildDemoFeed } = await import('./demo.js');
    const { todayISO } = await import('./store.js');
    demoEntry = buildDemoFeed(todayISO()).find((x) => x.uid === uid && x.act && x.act.id === sessionId)
      || null;
  } else if (!state.available) {
    return screenShell({ title: 'Workout', back, noNav: true, scroll: unavailable(state.reason) });
  }

  const conn = demoEntry
    ? { uid, name: demoEntry.name, tier: demoEntry.tier }
    : (state.connections || []).find((c) => c.uid === uid);
  if (!conn) {
    return screenShell({ title: 'Workout', back, noNav: true,
      scroll: emptyState('Not connected', 'You are not connected to them any more.') });
  }

  let seen = { tier: null, doc: null };
  if (demoEntry) {
    seen = { tier: demoEntry.tier, doc: { profile: { name: demoEntry.name } } };
  } else {
    try { seen = await social.friend(uid); } catch (_) {}
  }

  const name = (seen.doc && seen.doc.profile && seen.doc.profile.name) || conn.name || 'Friend';
  const acts = demoEntry ? [demoEntry.act] : ((seen.doc && seen.doc.activity) || []);
  const a = acts.find((x) => x && x.id === sessionId) || null;

  /* ⚠️ GONE IS A NORMAL OUTCOME HERE, not an error. The published window is the
   * last sixty sessions, so a workout somebody opened from an old feed card can
   * have rolled off the end of it — and a friend who narrowed what they share
   * makes the same thing happen faster. Either way the honest answer names the
   * reason rather than showing a spinner that never stops. */
  if (!a) {
    return screenShell({ title: 'Workout', back, noNav: true,
      scroll: emptyState('That workout is not here',
        `${name} shares their most recent workouts, and this one is no longer among them — either `
        + 'it has scrolled off the end of what they publish, or they have changed what they share '
        + 'with you.') });
  }

  const body = el('div', { class: 'ws' });
  const screen = screenShell({ title: 'Workout', back, noNav: true, scroll: body });

  const [exMap, stats] = [
    await store.getExerciseMap().catch(() => new Map()),
    sessionStats(a.entries),
  ];

  /* ⚠️ AN ABSOLUTE DATE HERE AND A RELATIVE ONE ON THE CARD. "6 hours ago" is
   * right while you are scanning; "Wednesday, 26 August 2026 at 1:23 pm" is
   * right once you have stopped to look at one thing. Hevy does exactly this
   * and it is worth copying (§12.16). */
  const clock = a.startedAt
    ? ' at ' + new Date(a.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  const parts = [];

  parts.push(el('a', { class: 'ws-who', href: `#/friend/${encodeURIComponent(uid)}` },
    el('span', { class: 'feed-avatar' },
      personFace(seen.doc && seen.doc.profile ? seen.doc.profile.avatar : null, 19)),
    el('span', { class: 'feed-who' },
      el('span', { class: 'feed-name', text: name }),
      el('span', { class: 'feed-meta', text: `${fmtDateLong(a.date)}${clock}` }),
    ),
  ));

  parts.push(el('h1', { class: 'ws-title', text: a.name || 'Workout' }));
  if (typeof a.note === 'string' && a.note) {
    parts.push(el('p', { class: 'ws-note', text: a.note }));
  }

  // Time · Sets · Exercises. ⚠️ NOT volume — js/session-stats.js has the whole
  // argument, and the short of it is that a friend's bodyweight work has no
  // external load to total and their body weight is not ours to have.
  const cells = [
    ['Time', a.minutes ? fmtDuration(a.minutes) : null],
    ['Sets', stats.sets || null],
    ['Exercises', stats.exercises || null],
  ].filter((c) => c[1] != null);
  if (cells.length) {
    parts.push(el('div', { class: 'feed-stats ws-stats' },
      ...cells.map(([label, value]) => el('div', { class: 'feed-stat' },
        el('div', { class: 'feed-stat-label', text: label }),
        el('div', { class: 'feed-stat-value', text: String(value) }),
      ))));
  }

  if (a.location) parts.push(el('p', { class: 'ws-where', text: a.location }));

  /* The same kudos/comment/share row the card carries, from the same function.
   * ⚠️ Reactions anchor on the session id and a session published before ids
   * existed has none — `feedActions` already answers that with a sentence
   * rather than a dead tap, which is why it is imported rather than copied. */
  let rx = null;
  if (!demoEntry && a.id) {
    try {
      const grouped = await social.reactionsFor(uid);
      rx = {
        slot: grouped.get(a.id) || { kudos: [], myKudosId: null, comments: [] },
        myUid: state.uid,
        names: new Map([[state.uid, 'You'], [uid, name]]),
      };
    } catch (_) { /* unreadable reactions must not take the screen down with them */ }
  }
  const { feedActions } = await import('./views-workouts.js');
  parts.push(feedActions({ uid, name, act: a, rx, demo: Boolean(demoEntry) }));

  if (!atLeast(seen.tier, MID) || !a.entries || !a.entries.length) {
    parts.push(el('p', { class: 'note', text:
      `${name} shares that they trained, not what they did. There is nothing more to show here.` }));
    setChildren(body, ...parts);
    return screen;
  }

  const records = await friendRecords(a, acts, exMap);
  if (records) parts.push(records);

  const split = await muscleSplit(a.entries, exMap);
  if (split) parts.push(split);

  parts.push(el('h2', { class: 'section-head', text: 'Workout' }));
  parts.push(...workoutEntries(a.entries, exMap, { uid, who: name, demo: Boolean(demoEntry) }));

  /* What you can do with somebody else's workout — copy the plan, or send a
   * picture of it. ⚠️ Both are at the BOTTOM, after the workout itself: the
   * reason to open this screen is to read what they did, and a row of buttons
   * above that would make the app's suggestions louder than their training. */
  parts.push(el('div', { class: 'ws-do' },
    el('button', {
      class: 'btn block', text: 'Save as my workout',
      onClick: () => saveAsRoutineSheet(a, exMap, name),
    }),
    el('button', {
      class: 'btn ghost block', text: 'Share a picture',
      onClick: () => shareWorkoutPicture(a, name, stats),
    }),
  ));

  setChildren(body, ...parts);
  return screen;
}

/* Copy their workout into one of mine — social-plan §13 step 7.
 *
 * ⚠️ IT SHOWS WHAT IT IS ABOUT TO DO BEFORE IT DOES IT, and that is the whole
 * design of this sheet. Their session is a RECORD and my workout is a PLAN, so
 * the set counts carry and the weights cannot — and an exercise my library has
 * never heard of cannot be carried at all, because a workout addresses
 * exercises by id and the runner would find nothing under it. Saving silently
 * and shrinking somebody's routine on the way is the failure this app keeps
 * refusing to ship; naming it costs one sheet.
 */
async function saveAsRoutineSheet(a, exMap, from) {
  const { routineFromSession } = await import('./routine-from-session.js');
  const { workout, dropped, warnings } = routineFromSession(a, exMap, { from });

  if (!workout.exercises.length) {
    toast('None of these exercises are in your library, so there is nothing to copy.');
    return;
  }

  const systems = await store.getSystems().catch(() => []);
  // One system is the common case and picking from a list of one is a tax.
  const picker = systems.length > 1
    ? el('select', { class: 'input', 'aria-label': 'Add to' },
        ...systems.map((s) => el('option', { value: s.id, text: s.name })))
    : null;

  const { close } = openSheet({
    title: 'Save as my workout',
    body: el('div', { class: 'form' },
      el('p', { class: 'note', text:
        `"${workout.name}" — ${workout.exercises.length} exercise`
        + `${workout.exercises.length === 1 ? '' : 's'}, with their set counts.` }),
      el('div', { class: 'ws-copy-list' },
        ...workout.exercises.map((x) => el('div', { class: 'feed-ex' },
          el('span', { class: 'feed-ex-sets', text: `${x.sets} set${x.sets === 1 ? '' : 's'}` }),
          el('span', { class: 'feed-ex-name', text:
            (exMap.get(x.exerciseId) || {}).name || 'Exercise' }),
        ))),
      ...warnings.map((w) => el('p', { class: 'note ws-fine', text: w })),
      dropped.length
        ? el('p', { class: 'note ws-fine', text:
            `Not copied, because ${dropped.length === 1 ? 'it is' : 'they are'} not in your `
            + `library: ${dropped.map((d) => d.name).join(', ')}.` })
        : null,
      picker ? el('div', { class: 'field' }, el('label', { text: 'Add to' }), picker) : null,
    ),
    footer: el('button', { class: 'btn primary block', text: 'Save', onClick: async () => {
      try {
        // A brand-new account can have no system at all, and a workout has
        // nowhere to live without one.
        const systemId = picker ? picker.value
          : (systems[0] ? systems[0].id : (await store.saveSystem({ name: 'My workouts' })).id);
        const saved = await store.saveWorkout({ ...workout, systemId });
        close();
        toast('Saved. Weights are yours to set.');
        location.hash = `#/workout/${encodeURIComponent(saved.id)}`;
      } catch (err) { toast((err && err.message) || 'Could not save that.'); }
    } }),
  });
}

/* A picture of the workout — social-plan §13 step 8.
 *
 * ⚠️ NO WEIGHTS ON IT, and the module enforces that rather than trusting this
 * caller: an image leaves the app for a feed nobody here controls, and their
 * numbers are theirs. Sets and time are the honest figures, which is the same
 * call Tim made for the feed card. */
async function shareWorkoutPicture(a, who, stats) {
  try {
    const { shareWorkoutImage } = await import('./share-image.js');
    const r = await shareWorkoutImage({
      title: a.name || 'Workout', who, date: a.date, minutes: a.minutes || null,
      sets: stats.sets, note: a.note || null, location: a.location || null,
      exercises: stats.byExercise.map((x) => ({ name: x.name, sets: x.sets })),
    });
    // ⚠️ NO `height` PASSED, on purpose. The card sizes itself to its contents
    // between 1080 and 1350 — a caller guessing at it here is a second opinion
    // about layout living outside the module that does the layout, and the
    // first version of this line was exactly that.
    // A share sheet that was dismissed is not an error and says nothing.
    if (r && r.downloaded) toast('Saved to your files.');
  } catch (err) {
    toast((err && err.message) || 'Could not make that picture.');
  }
}

/** "1h 4min" — the same shape the feed card uses. */
function fmtDuration(mins) {
  const n = Math.round(Number(mins) || 0);
  if (n <= 0) return null;
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/* Records set in this workout — social-plan §13 step 5.
 *
 * 🚨 "A BEST IN WHAT THEY HAVE SHARED", AND THE SCREEN SAYS EXACTLY THAT.
 * We hold their last sixty published sessions, not their life. Calling one of
 * these a personal record would be a claim about training we have never seen
 * and which they may never have shared — Rule 5's general form, from the
 * direction of scope rather than of inference. On your OWN finish screen there
 * is no such limit, because there the app really does have all of it, and that
 * screen says nothing about windows for the same reason.
 *
 * ⚠️ AND THEIR BENCHMARKS ARE NOT IN IT even at the top tier, deliberately: a
 * benchmark is a deliberate test taken fresh and a mid-workout set is not
 * (Rule 4). Your own finish screen compares against both because it has the
 * whole picture and can tell them apart; here, mixing a published benchmark
 * into a window of workout sets would make a record appear or vanish depending
 * on which tier somebody put you on.
 */
async function friendRecords(a, acts, exMap) {
  if (!a.entries || !a.entries.length) return null;
  const { personalBests, PB_LABEL } = await import('./personal-bests.js');
  const { withUnit } = await import('./units.js');

  // `personalBests` reads the store's own key names; the projection renames
  // exerciseName to name. Translate rather than teaching the pure module about
  // a second shape.
  const asEntries = (entries) => (entries || []).map((e) => ({
    exerciseId: e.exerciseId, exerciseName: e.name, sets: e.sets || [],
  }));

  // Everything of theirs that we hold from BEFORE this one. Same-day sessions
  // are ordered by `startedAt` where it exists, and where it does not the id
  // breaks the tie — an arbitrary but stable order, which is all that is needed
  // to stop a session being compared against itself.
  const key = (x) => `${x.date}|${x.startedAt || ''}|${x.id || ''}`;
  const here = key(a);
  const prior = acts.filter((x) => x && key(x) < here).map((x) => ({ entries: asEntries(x.entries) }));
  if (!prior.length) return null;

  const prs = personalBests(asEntries(a.entries), prior, [], exMap);
  if (!prs.length) return null;

  const line = (p) => {
    if (p.kind === 'reps') return `${p.now} reps, up from ${p.was}`;
    if (p.kind === 'volume') {
      return `${withUnit(p.now)} in one set${p.perSide ? ' (both sides)' : ''}`
        + `, up from ${withUnit(p.was)}`;
    }
    if (p.kind === 'e1rm') {
      return `${withUnit(Math.round(p.now))} from ${withUnit(p.weight)} × ${p.reps}`
        + `, up from ${withUnit(Math.round(p.was))}`;
    }
    return `${withUnit(p.now)}, up from ${withUnit(p.was)}`;
  };

  return el('div', { class: 'ws-prs' },
    el('h2', { class: 'section-head', text: 'Bests in this workout' }),
    ...prs.map((p) => el('div', { class: 'ws-pr' },
      el('div', { class: 'ws-pr-head' },
        el('span', { class: 'ws-pr-name', text: p.name }),
        el('span', { class: 'tag', text: PB_LABEL[p.kind] || p.kind }),
        // Rule 5 again, in words rather than in colour: an estimate must never
        // look like a measurement.
        p.estimated ? el('span', { class: 'tag', text: 'estimated' }) : null,
      ),
      el('div', { class: 'ws-pr-line', text: line(p) }),
    )),
    el('p', { class: 'note ws-fine', text:
      'Measured against the workouts they share with you, not against everything they have ever '
      + 'done — so this is their best here, which may not be their best.' }),
  );
}

/* The per-session muscle split — social-plan §13 step 4.
 *
 * 🚨 A SHARE, NEVER AN ABSOLUTE, and the reason is worth keeping beside the
 * code: "52 % of this workout was chest" is a complete statement about the
 * thing on screen, while "12.4 sets" only means something measured against a
 * week. Per session: share. Per week: absolute. Getting that backwards would
 * put a weekly band on one workout, which is the mistake this app spent a whole
 * screen avoiding on the Volume tab.
 *
 * ⚠️ BARS RATHER THAN THE BODY FIGURE, deliberately. The figure is painted in a
 * red-to-green ramp whose entire justification is the legend and the numbers
 * printed beside it (tools/volume-ramp.mjs); a small figure dropped onto a
 * workout screen would strip exactly the secondary encoding that makes that
 * ramp legal for the 8 % of men who cannot separate those hues.
 */
async function muscleSplit(entries, exMap) {
  const { volumeContributions, INDIRECT_NOTE_SESSION } = await import('./volume-map.js');

  const totals = new Map();
  let counted = 0;
  let unknown = 0;

  for (const entry of entries || []) {
    const sets = recordedSetCount(entry);
    if (!sets) continue;
    const ex = entry.exerciseId ? exMap.get(entry.exerciseId) : null;
    if (!ex) { unknown++; continue; }
    for (const c of volumeContributions(ex)) {
      totals.set(c.muscle, (totals.get(c.muscle) || 0) + sets * c.weight);
      counted += sets * c.weight;
    }
  }

  if (!counted) return null;

  const rows = [...totals.entries()]
    .map(([muscle, value]) => ({ muscle, pct: (value / counted) * 100 }))
    .sort((x, y) => y.pct - x.pct);

  return el('div', { class: 'ws-split' },
    el('h2', { class: 'section-head', text: 'Muscle split' }),
    ...rows.map((r) => el('div', { class: 'split-row' },
      el('div', { class: 'split-head' },
        el('span', { class: 'split-name', text: r.muscle }),
        el('span', { class: 'split-pct', text: `${Math.round(r.pct)}%` }),
      ),
      el('div', { class: 'split-track' },
        el('div', { class: 'split-fill', style: `width:${r.pct.toFixed(1)}%` })),
    )),
    // ⚠️ The share is of what could be COUNTED, and when something could not be
    // it says so rather than quietly renormalising over the rest.
    unknown
      ? el('p', { class: 'note ws-fine', text:
          `${unknown} exercise${unknown === 1 ? ' is' : 's are'} not in your library, so `
          + `${unknown === 1 ? 'it is' : 'they are'} left out of this split.` })
      : null,
    // ⚠️ FINE PRINT, NOT A PARAGRAPH. It has to be here — a fractional set count
    // is a modelling choice and this app states them where they are used — but
    // set at body size it was six lines of caveat sitting between the split and
    // the workout, louder than either. Small and quiet still says it.
    el('p', { class: 'note ws-fine', text: INDIRECT_NOTE_SESSION }),
  );
}

/* The set tables — §12.15's layout, in this app's type.
 *
 * ⚠️ THE HEADER ADAPTS TO THE EXERCISE, which is the detail worth copying:
 * "SET | WEIGHT & REPS" for a bench press, "SET | REPS" for a dip, "SET | TIME"
 * for a plank. `fields` already knows, so this is free — and printing a weight
 * column against a plank would be a column of dashes pretending to be data.
 */
/* ⚠️ `fmtSet` WRITES REPS AS "× 12" because everywhere else in this app they
 * follow a weight — "185 lbs × 12". In a table with its own REPS column the
 * multiplication sign is left over from a number that is not there, so it comes
 * off. The rule is local to this screen on purpose: `fmtSet` is right for every
 * other caller, and changing it would move a symbol on six screens to tidy one. */
function setText(set, fields, loadType) {
  const t = fmtSet(set, fields, loadType);
  return fields.includes('weight') ? t : t.replace(/^×\s*/, '');
}

function workoutEntries(entries, exMap, ctx) {
  const out = [];
  entries.forEach((entry, i) => {
    const prev = entries[i - 1];
    const opensGroup = entry.group != null && (!prev || prev.group !== entry.group);
    const { fields, loadType, known } = shapeOf(entry, exMap);

    const heads = fields
      .map((f) => (f === 'weight' ? 'Weight' : f === 'reps' ? 'Reps' : f === 'time' ? 'Time' : 'Distance'))
      .join(' & ');

    /* ⚠️ THE NAME IS ONLY A BUTTON WHERE THERE IS SOMETHING BEHIND IT. Hevy
     * paints every exercise name blue and every one of them opens; ours can
     * only compare on an exercise this library knows, because a comparison
     * needs a rep-normalising model and that needs the exercise. A blue name
     * that does nothing is worse than a plain one. */
    const nameNode = known && ctx
      ? el('button', { class: 'ws-ex-name as-link', text: entry.name,
          onClick: () => compareSheet(entry, exMap, ctx) })
      : el('span', { class: 'ws-ex-name', text: entry.name });

    out.push(el('div', { class: 'ws-ex' + (entry.group == null ? '' : ' in-group') },
      opensGroup
        ? el('div', { class: 'detail-group-label', text:
            groupLabel(entries.filter((o) => o.group === entry.group).length) })
        : null,
      el('div', { class: 'ws-ex-head' },
        nameNode,
        entry.setType
          ? el('span', { class: 'tag', text: entry.setType === 'drop' ? 'drop set' : 'myo-reps' })
          : null,
        // ⚠️ Said once, quietly, where it is true — the split above has already
        // explained what it costs. Silence would be the app pretending it knows
        // an exercise it has never heard of.
        known ? null : el('span', { class: 'tag', text: 'not in your library' }),
      ),
      el('div', { class: 'ws-sets' },
        el('div', { class: 'ws-set is-head' },
          el('span', { class: 'ws-set-n', text: 'Set' }),
          el('span', { class: 'ws-set-v', text: heads }),
        ),
        ...(entry.sets || []).map((set, si) => el('div', { class: 'ws-set-run' },
          el('div', { class: 'ws-set' },
            el('span', { class: 'ws-set-n', text: String(si + 1) }),
            el('span', { class: 'ws-set-v', text: setText(set, fields, loadType) }),
          ),
          ...minisOf(set).map((mini, mi) => el('div', { class: 'ws-set is-mini' },
            el('span', { class: 'ws-set-n', text: '↳' }),
            el('span', { class: 'ws-set-v', text:
              `${miniLabel(entry.setType, mi + 1)} — ${setText(mini, fields, loadType)}` }),
          )),
        )),
      ),
    ));
  });
  return out;
}

/* You and them on one exercise — social-plan §13 step 6.
 *
 * 🚨 NO WINNER. Hevy prints a yellow STRONGER rosette beside whoever leads;
 * declaring a winner off one exercise is Rule 6 exactly, and `compare.js`
 * refuses to produce an overall verdict at all — `NO_VERDICT_HEADER` is the
 * module's own sentence saying so, printed here rather than paraphrased.
 *
 * ⚠️ AND THE COMPARISON IS WINDOWED. Their published history is their last
 * sixty sessions and mine is my whole life, so an unwindowed comparison
 * flatters me every single time, in the same direction. The module cuts both
 * sides to the overlap and names the window; this sheet prints that name.
 */
async function compareSheet(entry, exMap, ctx) {
  const ex = exMap.get(entry.exerciseId);
  if (!ex) return;

  const sheet = openSheet({
    title: ex.name,
    body: el('p', { class: 'note', text: 'Working it out…' }),
  });

  try {
    const [{ compareExercise, NO_VERDICT_HEADER }, mine, seen] = await Promise.all([
      import('./compare.js'),
      // The demo's own year is real data from this app's point of view, so a
      // comparison inside the demo is a real comparison against invented
      // training — which is exactly what the demo is for.
      store.getSessions().catch(() => []),
      ctx.demo ? Promise.resolve(null) : social.friend(ctx.uid).catch(() => null),
    ]);

    const theirs = ctx.demo
      ? (await import('./demo.js')).buildDemoFeed((await import('./store.js')).todayISO())
          .filter((x) => x.uid === ctx.uid).map((x) => x.act)
      : ((seen && seen.doc && seen.doc.activity) || []);

    const r = compareExercise({ mine, theirs, exerciseId: entry.exerciseId, exercise: ex });

    const rows = r.common
      ? r.metrics.map((m) => el('div', { class: 'cmp-row' },
          el('div', { class: 'cmp-label' },
            m.label,
            // Rule 5: an inference must never look like a measurement, and the
            // cue may not be colour alone. So it says the word.
            m.estimate ? el('span', { class: 'tag', text: 'estimated' }) : null,
          ),
          el('div', { class: 'cmp-pair' },
            el('span', { class: 'cmp-num' }, el('b', { text: 'You ' }),
              m.mine == null ? '—' : `${trimNumber(m.mine)}${m.unit ? ` ${m.unit}` : ''}`),
            el('span', { class: 'cmp-num' }, el('b', { text: `${ctx.who} ` }),
              m.theirs == null ? '—' : `${trimNumber(m.theirs)}${m.unit ? ` ${m.unit}` : ''}`),
          ),
          m.note ? el('div', { class: 'note ws-fine', text: m.note }) : null,
        ))
      : [el('p', { class: 'note', text: r.message || 'Nothing to compare on this one yet.' })];

    setChildren(sheet.sheet.querySelector('.sheet-body'),
      el('div', { class: 'cmp' },
        ...rows,
        // ⚠️ The window is NOT restated here. `compare.js` already emits it as
        // a caveat, in more detail and with the dates — and two sentences about
        // the same rule, written in two places, is how one of them goes stale.
        ...(r.caveats || []).map((c) => el('p', { class: 'note ws-fine', text: c.text })),
        el('p', { class: 'note ws-fine', text: r.header || NO_VERDICT_HEADER }),
      ));
  } catch (err) {
    setChildren(sheet.sheet.querySelector('.sheet-body'),
      el('p', { class: 'note', text: (err && err.message) || 'Could not work that out.' }));
  }
}

/** An integer where it is one, two decimals where it is not. */
function trimNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// One workout. At `light` this is the whole thing — a date and a name, and no
// disclosure to open, because there is nothing behind it. Pretending otherwise
// with an arrow that reveals an empty box would be worse than saying less.
function activityRow(a, tier, uid) {
  // ⚠️ THE TERNARY IS NOT OPTIONAL. `startedAt` arrived with the Home feed on
  // 2026-08-25 and is published at MID and above only, so a light-tier row and
  // every session recorded before the field existed have none — and
  // `new Date(undefined).toLocaleTimeString()` renders the string "Invalid
  // Date" straight into the card. The line simply loses its last term instead.
  const clock = a.startedAt
    ? ' · ' + new Date(a.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  const head = el('div', { class: 'row-main' },
    el('div', { class: 'row-title', text: a.name }),
    el('div', { class: 'row-sub', text: `${fmtDateLong(a.date)} · ${relativeDay(a.date)}${clock}` }),
  );

  if (!atLeast(tier, MID) || !a.entries || !a.entries.length) {
    return el('div', { class: 'row' }, head);
  }

  const detail = el('div', { class: 'act-detail', hidden: true });
  let built = false;

  const toggle = el('button', { class: 'row as-button', onClick: async () => {
    if (!built) {
      built = true;
      // The library is only wanted once somebody opens a row, and it is served
      // from the store's read cache after the first time.
      const exMap = await store.getExerciseMap().catch(() => new Map());
      setChildren(detail, ...a.entries.map((e) => entryLine(e, exMap)),
        a.id
          ? el('a', { class: 'act-open', href:
              `#/friend/${encodeURIComponent(uid)}/${encodeURIComponent(a.id)}`,
              text: 'Open this workout' })
          : null);
    }
    detail.hidden = !detail.hidden;
  } },
    head,
    el('div', { class: 'row-sub', text: `${a.entries.length} exercises` }),
    chevron(),
  );

  return el('div', { class: 'act' }, toggle, detail);
}

/* ⚠️ WHAT FIELDS DID THEY RECORD? A projected entry carries no `fields` and no
 * `loadType` — those belong to the exercise, and the exercise belongs to the
 * library. Their `exerciseId` is published, so the reader looks it up in THEIR
 * OWN library first, which is right for every built-in lift.
 *
 * When that fails — a friend's custom exercise, or one added to the library
 * after they published — the shape is recovered from the sets themselves. That
 * is not a guess: a set holds exactly the fields it recorded, so reading the
 * keys off it is reading what happened. Falling back to ['weight','reps']
 * instead would print "— × 12" against a plank.
 */
function shapeOf(entry, exMap) {
  const ex = exMap && entry.exerciseId ? exMap.get(entry.exerciseId) : null;
  if (ex) return { fields: ex.fields, loadType: ex.loadType || null, known: true };

  const seen = new Set();
  for (const s of entry.sets || []) {
    for (const k of Object.keys(s || {})) if (k !== 'minis' && k !== 'drops') seen.add(k);
  }
  const order = ['weight', 'reps', 'time', 'distance'].filter((f) => seen.has(f));
  return { fields: order.length ? order : ['weight', 'reps'], loadType: null, known: false };
}

function entryLine(entry, exMap) {
  const { fields, loadType } = shapeOf(entry, exMap);
  /* ⚠️ `fmtSet` RATHER THAN THE RAW NUMBER, corrected 2026-09-02. This line
   * used to print `s.weight` straight out of the projection, which publishes
   * canonical POUNDS — so a friend's 100 kg squat read as "100" to a lifter
   * whose whole app is in kilos. `fmtSet` puts it through the reader's own
   * units, which is what every other set in this app already goes through. */
  const sets = (entry.sets || []).map((s) => {
    const mini = Array.isArray(s.minis) && s.minis.length ? ` +${s.minis.length}` : '';
    return fmtSet(s, fields, loadType) + mini;
  }).filter((t) => t && t !== '—');

  return el('div', { class: 'act-line' },
    el('div', { class: 'act-name', text: entry.name },
      entry.setType ? el('span', { class: 'tag', text: entry.setType === 'drop' ? 'drop set' : 'myo-reps' }) : null,
      entry.group != null ? el('span', { class: 'tag', text: 'superset' }) : null,
    ),
    el('div', { class: 'act-sets', text: sets.join(' · ') || '—' }),
  );
}

// Their body map, drawn with the same art and the same colour ramp as your own.
// It is the most distinctive thing the app has and it is a STATE rather than an
// event, which is what makes it the right thing to put on a profile.
async function friendBody(strength) {
  const [{ bodySvg }, { LEVELS }] = await Promise.all([
    import('./body-map.js'), import('./strength-standards.js'),
  ]);
  const byName = new Map(LEVELS.map((l) => [l.name, l]));
  const levels = new Map();
  for (const s of strength) {
    const lv = byName.get(s.level);
    if (lv) levels.set(s.muscle, { levelKey: lv.key, label: lv.name });
  }
  const wrap = el('div', { class: 'friend-body' }, bodySvg(levels, null, () => {}));
  return wrap;
}

/* ================================================================== *
 * Finding people — search, your own code, and invite links
 *
 * 🚨 THE SEARCH HALF REVERSES A DECISION THIS PROJECT MADE ON PURPOSE, and the
 * argument is written out in full in the "Finding people by name" header of
 * js/social.js and above the `directory` block in firestore.rules. Read one of
 * them before touching this screen. The short version: name search needs
 * Firestore's `list`, `list` cannot be narrowed by a rule, and Tim took that
 * trade knowingly on 2026-08-29 with fewer than five users on the site.
 * ================================================================== */

/**
 * A QR code as an SVG.
 *
 * ⚠️ BLACK ON WHITE, ALWAYS, whatever theme the app is in. A light-on-dark
 * code is legal — the 1:1:3:1:1 finder ratio survives inversion and recent
 * iPhones handle it — but plenty of Android scanners and third-party apps do
 * not, and a code that fails on somebody else's phone fails at the one moment
 * it exists for. So the card paints its own white ground rather than inheriting
 * the surface, and that is why it is the one bright rectangle in dark mode.
 *
 * ⚠️ THE QUIET ZONE IS PART OF THE CODE, not padding around it. Four modules on
 * every side, inside the SVG's own viewBox — relying on the page background for
 * it breaks the moment somebody puts this on a coloured card.
 */
function qrNode(text, px = 240) {
  const { size, modules } = encodeQR(text);
  const QUIET = 4;
  const total = size + QUIET * 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('width', String(px));
  svg.setAttribute('height', String(px));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Your QR code. Point a phone camera at it.');
  svg.setAttribute('shape-rendering', 'crispEdges');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(total));
  bg.setAttribute('height', String(total));
  bg.setAttribute('fill', '#fff');
  svg.appendChild(bg);

  // One path for every dark module rather than one rect each: a version-6
  // symbol is 41x41, and 1,681 elements is a lot of DOM for a picture.
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    }
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#000');
  svg.appendChild(path);
  return svg;
}

/** Your own code — the thing you hold up for somebody to scan. */
function myCodeSheet(uid, name) {
  let card;
  try {
    card = el('div', { class: 'qr-card' },
      qrNode(profileLink(location.href, uid)),
      el('div', { class: 'qr-name', text: name || 'You' }),
    );
  } catch (err) {
    // An encoder that cannot encode has to say so, rather than render a blank
    // white square somebody then holds up at a camera for a minute.
    card = el('p', { class: 'note is-warn', text: 'Could not draw your code just now.' });
  }
  openSheet({
    title: 'Your code',
    body: el('div', {},
      card,
      el('p', { class: 'field-help', text:
        'Point their phone camera at this — no app needed, it opens straight to your '
        + 'profile. They send you a request and you decide whether to add them. '
        + 'The code is yours permanently; it never expires.' }),
    ),
  });
}

export async function FindView() {
  let state;
  try {
    state = await social.state();
  } catch (_) { state = { available: false, reason: 'offline' }; }

  if (!state.available) {
    return screenShell({ title: 'Add a friend', back: () => { location.hash = '#/social'; }, scroll: unavailable(state.reason) });
  }
  if (!state.name) return nameSetupScreen();

  const results = el('div', { class: 'list' });
  const input = el('input', {
    class: 'input', type: 'search', placeholder: 'Their name',
    'aria-label': 'Search for somebody by name', autocomplete: 'off', maxlength: '60',
  });

  const empty = () => setChildren(results, el('p', { class: 'field-help', text:
    'Type a name to look for somebody. You can only find people who are findable — '
    + 'everybody is by default, and it can be turned off in Settings.' }));
  empty();

  /* ⚠️ DEBOUNCED, AND A STALE ANSWER IS DISCARDED. Two keystrokes can be in
   * flight at once and answer out of order, and the older answer landing second
   * would replace the right list with the wrong one — a bug that only shows on
   * a slow connection, which is the one this app is built for. */
  let seq = 0;
  let timer = null;
  async function run(query) {
    const mine = ++seq;
    if (!query.trim()) { empty(); return; }
    let rows = [];
    try { rows = await social.searchPeople(query); } catch (_) { rows = null; }
    if (mine !== seq) return;
    if (rows === null) {
      setChildren(results, el('p', { class: 'note', text:
        'Could not search just now. It will work when the connection is back.' }));
      return;
    }
    if (!rows.length) {
      setChildren(results, el('p', { class: 'note', text:
        `Nobody called “${query.trim()}”. The name has to match how they typed theirs — `
        + 'or show them your code instead.' }));
      return;
    }
    setChildren(results, ...rows.map((r) => personRow(r, () => run(input.value))));
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(input.value), 220);
  });

  return screenShell({
    title: 'Add a friend',
    back: () => { location.hash = '#/social'; },
    scroll: el('div', {},
      el('div', { class: 'field' }, el('label', { text: 'Search by name' }), input),
      results,
      el('h2', { class: 'section-head', text: 'Other ways' }),
      el('button', { class: 'btn block', onClick: () => myCodeSheet(state.uid, state.name) },
        icon('target', 16), 'Show my code'),
      el('button', { class: 'btn block', style: 'margin-top:8px', onClick: () => inviteSheet() },
        icon('link', 16), 'Send an invite link'),
      el('p', { class: 'field-help', text:
        'A code is yours permanently and anyone can scan it. An invite link works once and '
        + 'expires after 7 days, which is the one to use if you are sending it somewhere you '
        + 'would rather it did not sit forever.' }),
    ),
  });
}

/**
 * One person in a result list, with the right control for where they stand.
 *
 * ⚠️ ALREADY-CONNECTED AND ALREADY-ASKED ARE SHOWN, NOT FILTERED OUT. "You are
 * already friends" and "no such person" are completely different answers, and a
 * search that silently drops the person you were looking for is much the worse
 * of the two.
 */
function personRow(person, after) {
  const control = person.state === 'connected'
    ? el('span', { class: 'row-flag', text: 'Friends' })
    : person.state === 'asked'
      ? el('button', {
          class: 'btn small ghost', text: 'Asked',
          title: 'Take back your request',
          onClick: async (e) => {
            e.target.disabled = true;
            try { await social.withdrawRequest(person.uid); toast('Request taken back.'); }
            catch (err) { toast(err.message); }
            e.target.disabled = false;
            if (after) after();
          },
        })
      : el('button', {
          class: 'btn small primary', text: 'Add',
          onClick: async (e) => {
            e.target.disabled = true;
            try {
              await social.sendRequest(person.uid, person.name);
              toast(`Asked ${person.name}. They decide whether to add you.`);
            } catch (err) { toast(err.message); }
            e.target.disabled = false;
            if (after) after();
          },
        });

  return el('div', { class: 'row' },
    el('div', { class: 'row-icon' }, icon('person')),
    el('div', { class: 'row-main' }, el('div', { class: 'row-title', text: person.name })),
    control,
  );
}

/**
 * `#/add/<uid>` — where a scanned code lands.
 *
 * ⚠️ IT SHOWS WHO IT IS AND THEN ASKS, rather than connecting on arrival. A
 * code can be scanned by accident or forwarded by anybody, so the person
 * holding it is not necessarily the person it was meant for — the same reason
 * `acceptClaim` is deliberately two steps.
 */
export async function AddView(uid) {
  let state;
  try {
    state = await social.state();
  } catch (_) { state = { available: false, reason: 'offline' }; }

  if (!state.available) {
    return screenShell({ title: 'Add a friend', back: () => { location.hash = '#/social'; }, scroll: unavailable(state.reason) });
  }
  if (!state.name) return nameSetupScreen();

  if (uid === state.uid) {
    return screenShell({
      title: 'Your code', back: () => { location.hash = '#/social'; },
      scroll: emptyState('That is your own code',
        'Somebody else scanning it lands on your profile and can ask to connect.'),
    });
  }

  const body = el('div', { class: 'list' });
  const screen = screenShell({ title: 'Add a friend', back: () => { location.hash = '#/social'; }, scroll: body });

  social.personByUid(uid).then((person) => {
    if (!person) {
      setChildren(body, emptyState('That code did not match anybody',
        'They may have turned off being findable, or deleted their account. Ask them for an '
        + 'invite link instead.'));
      return;
    }
    setChildren(body,
      el('div', { class: 'row static' },
        el('div', { class: 'row-icon' }, icon('person')),
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: person.name }),
          el('div', { class: 'row-sub wrap', text: person.state === 'connected'
            ? 'You are already connected.'
            : person.state === 'asked'
              ? 'You have already asked. They decide whether to add you.'
              : 'They get a request and decide whether to add you. Nothing of yours is '
                + 'shared until they do.' }),
        ),
      ),
      person.state === 'none'
        ? el('button', {
            class: 'btn primary block', style: 'margin-top:12px',
            onClick: async (e) => {
              e.target.disabled = true;
              try {
                await social.sendRequest(person.uid, person.name);
                toast(`Asked ${person.name}.`);
                location.hash = '#/social';
              } catch (err) { e.target.disabled = false; toast(err.message); }
            },
          }, 'Ask to connect')
        : el('a', { class: 'btn block', style: 'margin-top:12px', href: '#/social' }, 'Back to friends'),
    );
  }).catch(() => {
    setChildren(body, emptyState('Could not look them up',
      'You are signed in, but the lookup failed just now. Try again when the connection is back.'));
  });

  return screen;
}
