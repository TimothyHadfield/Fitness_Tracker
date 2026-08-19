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
  fmtDateLong, relativeDay, chevron, setChildren, fmtSet,
} from './ui.js';
import {
  TIERS, TIER_LABEL, TIER_DETAIL, NONE, LIGHT, MID, FULL,
  atLeast, parseInviteRoute,
} from './social.js';

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
      'Social is off in the demo',
      'Sharing publishes a copy of your training for a friend to read, and the demo account\'s '
      + 'training is invented — publishing it to real people would be worse than not being able to '
      + 'try this screen. Leave the demo and Social comes back exactly as it was.',
      el('a', { class: 'btn primary', href: '#/account', text: 'Leave the demo' }),
    );
  }
  if (reason === 'anonymous') {
    return emptyState(
      'Social needs a real account',
      'You are signed in anonymously, which lives only in this browser. Add an email or Google '
      + 'sign-in so friends are connecting to an account that will still be here tomorrow. Your '
      + 'training history comes with you.',
      el('a', { class: 'btn primary', href: '#/account', text: 'Set up my account' }),
    );
  }
  if (reason === 'offline') {
    return emptyState(
      'Not connected right now',
      'Social needs a connection. Everything else in the app carries on working — you can log a '
      + 'whole workout offline and it will sync when you are back.',
      el('button', {
        class: 'btn', text: 'Try again',
        onClick: async () => { await auth.retry(); location.hash = '#/blank'; location.hash = '#/social'; },
      }),
    );
  }
  return emptyState(
    'Social is not switched on',
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
      title: 'Social', profile: true,
      scroll: unavailable(state.reason),
    });
  }

  if (!state.name) return nameSetupScreen();

  const body = el('div', { class: 'list' });
  const screen = screenShell({
    title: 'Social',
    sub: `You appear as ${state.name}`,
    profile: true,
    actions: [iconBtn('edit', 'Change your display name', () => renameSheet(state.name))],
    scroll: body,
    bottom: el('button', {
      class: 'btn primary block', text: 'Invite a friend',
      onClick: () => inviteSheet(),
    }),
  });

  await fillSocial(body, state);
  return screen;
}

async function fillSocial(body, state) {
  const parts = [];

  // Somebody used my link and is waiting to be let in. This is at the top
  // because it is the only thing on the screen that is waiting on the user.
  let claims = [];
  try {
    claims = (await social.invites()).filter((i) => i.claimedBy);
  } catch (_) { /* invites are a nicety; the friends list is the screen */ }

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
      'Nobody yet. Send somebody an invite link and they will appear here. New friends start on '
      + '"just that I trained" until you change it.' }));
  } else {
    for (const c of state.connections) {
      parts.push(el('a', { class: 'row', href: `#/friend/${encodeURIComponent(c.uid)}` },
        el('div', { class: 'row-icon' }, icon('person')),
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: c.name || 'Friend' }),
          el('div', { class: 'row-sub', text: `They can see: ${TIER_LABEL[c.tier] || TIER_LABEL[LIGHT]}` }),
        ),
        chevron(),
      ));
    }
  }

  // Links that have been sent and not yet used. Shown so a link can be taken
  // back — an invite is a capability, and a capability you cannot revoke is a
  // worse thing than one you never made.
  let open = [];
  try {
    open = (await social.invites()).filter((i) => !i.claimedBy);
  } catch (_) {}
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
  location.hash = '#/blank';
  location.hash = '#/social';
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
  const body = el('div', { class: 'list' });

  const screen = screenShell({
    title: name,
    sub: seen.tier ? `They share: ${TIER_LABEL[seen.tier]}` : 'They share nothing with you',
    back, noNav: true,
    scroll: body,
  });

  const parts = [];

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
        location.hash = '#/blank'; location.hash = `#/friend/${encodeURIComponent(uid)}`;
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
      for (const a of acts) parts.push(activityRow(a, seen.tier));
    }
  }

  parts.push(el('div', { class: 'danger-zone' },
    el('button', {
      class: 'btn danger block', text: 'Disconnect',
      onClick: () => confirmSheet({
        title: 'Disconnect?',
        message: `${conn.name || 'They'} will no longer be able to see anything of yours, and you `
          + 'will not see theirs. It cannot un-see anything they have already looked at.',
        confirmLabel: 'Disconnect',
        onConfirm: async () => {
          try { await social.remove(uid); toast('Disconnected.'); location.hash = '#/social'; }
          catch (err) { toast(err.message); }
        },
      }),
    }),
  ));

  setChildren(body, ...parts);
  return screen;
}

// One workout. At `light` this is the whole thing — a date and a name, and no
// disclosure to open, because there is nothing behind it. Pretending otherwise
// with an arrow that reveals an empty box would be worse than saying less.
function activityRow(a, tier) {
  const head = el('div', { class: 'row-main' },
    el('div', { class: 'row-title', text: a.name }),
    el('div', { class: 'row-sub', text: `${fmtDateLong(a.date)} · ${relativeDay(a.date)}` }),
  );

  if (!atLeast(tier, MID) || !a.entries || !a.entries.length) {
    return el('div', { class: 'row' }, head);
  }

  const detail = el('div', { class: 'act-detail', hidden: true });
  let built = false;

  const toggle = el('button', { class: 'row as-button', onClick: () => {
    if (!built) { setChildren(detail, ...a.entries.map(entryLine)); built = true; }
    detail.hidden = !detail.hidden;
  } },
    head,
    el('div', { class: 'row-sub', text: `${a.entries.length} exercises` }),
    chevron(),
  );

  return el('div', { class: 'act' }, toggle, detail);
}

function entryLine(entry) {
  const sets = (entry.sets || []).map((s) => {
    const bits = [];
    if (s.weight != null) bits.push(`${s.weight}`);
    if (s.reps != null) bits.push(`× ${s.reps}`);
    const mini = Array.isArray(s.minis) && s.minis.length ? ` +${s.minis.length}` : '';
    return bits.join(' ') + mini;
  }).filter(Boolean);

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
