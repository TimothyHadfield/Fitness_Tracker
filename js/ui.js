// Shared UI primitives: DOM builder, icons, sheets, toasts, steppers, formatters.

import { FIELD_META } from './exercises.js';
import * as units from './units.js';

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== 'list' && typeof v !== 'object') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Element.replaceChildren() stringifies anything that is not a Node, so a
// `cond ? el(...) : null` child renders the literal text "null" on the page —
// which it had been doing under the exercise name on the session screen for any
// exercise without a note. el() has always guarded against this; setChildren is
// the same guard for the places that replace a node's children directly.
export function setChildren(node, ...children) {
  node.replaceChildren(
    ...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
  );
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------------------------------------------ *
 * ⚠️ Labels — associate every one with the control it names
 *
 * FOUND BY THE FIRST ACCESSIBILITY AUDIT THIS PROJECT HAS EVER HAD, 2026-08-20.
 * The app renders 19 `el('label', { text: … })` calls and **not one of them was
 * connected to anything.** A `.field` puts the label and the control next to
 * each other, which looks correct and is correct visually — and a screen reader
 * announces "edit text, blank", because a sibling is not an association. Every
 * form in the app was affected: email and password on Account, birth year and
 * gender on Profile, workout name and day on the edit screen, system name and
 * notes in the builder, appearance and units in Settings.
 *
 * ⚠️ DONE AS A PASS OVER THE MOUNTED TREE, NOT AT 19 CALL SITES. Wiring each
 * one by hand fixes today's 19 and nothing about the 20th — and the 20th will be
 * written by somebody who has never read this comment, because the visual result
 * of forgetting is indistinguishable from the visual result of remembering.
 * Running it at the two places anything is mounted makes it structural.
 *
 * A control that already carries an aria-label is left alone: an explicit name
 * beats a positional guess, and overwriting one would be how a good label gets
 * replaced by a worse one.
 */
let labelSeq = 0;
const NAMEABLE = 'input, select, textarea';

export function associateLabels(root) {
  if (!root || !root.querySelectorAll) return root;
  for (const label of root.querySelectorAll('label')) {
    if (label.htmlFor) continue;
    // The control this label names: inside it if somebody wrapped, otherwise the
    // next one along in the same .field. Scoped to the field so a label can
    // never reach past its own group and name a stranger's input.
    const field = label.closest('.field') || label.parentElement;
    const control = label.querySelector(NAMEABLE)
      || (field && field.querySelector(NAMEABLE));
    if (!control) continue;
    if (label.contains(control)) continue;        // already implicit, needs no id
    if (control.getAttribute('aria-label')) continue;
    if (!control.id) control.id = `f${++labelSeq}`;
    label.htmlFor = control.id;
  }
  return root;
}

/* ------------------------------------------------------------------ *
 * ⚠️ Textareas — grow to their own content
 *
 * FOUND 2026-08-21, on the first pass over the app at phone size. A system's
 * Notes box is `rows="2"` and the demo account's notes are three lines, so the
 * screen showed 66px of a 90px sentence and simply stopped mid-word. It has a
 * scrollbar in the sense that the browser will scroll it; on a phone there is
 * no scrollbar drawn and no indication that anything is missing, so the text
 * reads as having ended.
 *
 * `resize: vertical` does not help — dragging a resize handle is a mouse
 * gesture and there is no handle under a thumb. `field-sizing: content` is the
 * CSS answer and Safari does not have it yet, which is the browser this matters
 * on. So: measure and set, on mount and on every keystroke.
 *
 * Run from the same two mount points as associateLabels(), and for the same
 * reason — a per-call-site fix covers the textareas that exist today.
 * ------------------------------------------------------------------ */

const MAX_GROW = 260;   // past this it is a document, and scrolling is right

export function autoGrowTextareas(root) {
  if (!root || !root.querySelectorAll) return root;
  for (const ta of root.querySelectorAll('textarea')) {
    if (ta.dataset.autogrow) continue;
    ta.dataset.autogrow = '1';
    const fit = () => {
      // Collapse first: without this the box can only ever get taller, because
      // scrollHeight of an already-tall element includes the height it was
      // given rather than the height it needs.
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, MAX_GROW)}px`;
      ta.style.overflowY = ta.scrollHeight > MAX_GROW ? 'auto' : 'hidden';
    };
    ta.addEventListener('input', fit);
    // The value is often assigned after construction (`notesInput.value = …`),
    // so the first measurement waits for the frame the element is laid out in.
    requestAnimationFrame(fit);
  }
  return root;
}

/* ------------------------------------------------------------------ *
 * Icons
 * ------------------------------------------------------------------ */

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  dumbbell: 'M4 9v6M20 9v6M7.5 6.5v11M16.5 6.5v11M7.5 12h9',
  calendar: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9.5h16M8.5 3v4M15.5 3v4',
  chart: 'M4 4v16h16M7.5 15.5l4-5 3 3 5-6.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  right: 'M9.5 5.5l6.5 6.5-6.5 6.5',
  left: 'M14.5 5.5L8 12l6.5 6.5',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6',
  check: 'M4.5 12.5l5 5L19.5 7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.2 16.2L21 21',
  up: 'M6 14.5L12 8.5l6 6',
  down: 'M6 9.5l6 6 6-6',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 4.5v5M8 14.5v5',
  play: 'M7.5 5.5v13l11-6.5z',
  list: 'M4 6.5h2M4 12h2M4 17.5h2M9.5 6.5H20M9.5 12H20M9.5 17.5H20',
  // Two links of a chain, joined and broken. The broken one is the OFF state,
  // so the control reads as "these are not joined yet" rather than as a
  // decoration next to a label.
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1',
  'link-off': 'M9.5 14.5 7 17a3.5 3.5 0 0 1-5-5l2.5-2.5M14.5 9.5 17 7a3.5 3.5 0 0 1 5 5l-2.5 2.5M3 3l18 18',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z',
  // Two arrows passing in opposite directions — one thing out, another in.
  // Deliberately not a circular "refresh": swapping an exercise replaces it
  // with something different, it does not reload the same one.
  swap: 'M4 8.5h15M15.5 5l3.5 3.5-3.5 3.5M20 15.5H5M8.5 12 5 15.5 8.5 19',
  flag: 'M5 21V4h13l-2.5 4L18 12H5',
  // A route rather than a runner: this one glyph stands for every activity —
  // a swim, a climb, a cycle — and a sport-specific mark would be wrong for
  // five of the six things it labels.
  activity: 'M3 17.5c3 0 3-11 6-11s3 11 6 11 3-11 6-11',
  // A map pin — the location label on a session. Stroked ring for the centre,
  // same trick as `target`, so it needs no fill exception.
  pin: 'M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21zM14.2 10.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0',
  person: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  // Two people, the second half-behind the first. Deliberately not a speech
  // bubble or a heart: this section is people, not messages or approval.
  people: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4a6.5 6.5 0 0 1 3.5 5.6',
  // A bullseye: two rings and a centre. The centre is a stroked 1.2r circle
  // rather than a filled dot, so it needs no fill exception the way `play`
  // does and still reads as solid at 21px in the tab bar.
  target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M13.2 12a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0',
};

export function icon(name, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', PATHS[name] || PATHS.home);
  if (name === 'play') p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

export function iconBtn(name, label, onClick, cls = 'icon-btn') {
  return el('button', { class: cls, 'aria-label': label, title: label, onClick }, icon(name));
}

/**
 * The You / Friends switch — the seam where Social was folded into Home.
 *
 * ⚠️ REAL LINKS ACROSS TWO ROUTES, not a state machine inside one screen.
 * `#/home` and `#/social` stay separate views that each render this control,
 * so the back button, a bookmark and a shared invite link all keep working
 * exactly as they did, and neither screen had to be nested inside the other.
 * The nav bar lights the same tab for both (see `NAV[].match` in app.js).
 *
 * ⚠️ "Friends" rather than "Social". `js/social.js` calls the feature social
 * because that is what it is; a person has friends. The app's own rule about
 * saying the thing rather than the term (D8) applies to its own vocabulary
 * first — this is the same fault the UX review found in "system" vs
 * "programme", caught before it shipped rather than after.
 */
export function youFriendsTabs(active) {
  return el('div', { class: 'segmented', role: 'tablist' },
    [['you', 'You', '#/home'], ['friends', 'Friends', '#/social']].map(([key, label, href]) =>
      el('a', {
        class: 'seg', role: 'tab', href,
        'aria-selected': String(key === active),
      }, label)),
  );
}

export function chevron() {
  return el('span', { class: 'row-chev' }, icon('right'));
}

/* ------------------------------------------------------------------ *
 * Profile button — top-left of every main screen
 * ------------------------------------------------------------------ */

// Returns immediately with a neutral avatar and fills itself in once the
// account state is known, so no view has to await anything to render.
//
// It carries a warning dot whenever the data is NOT backed up — an anonymous
// account, or no cloud at all. That is the one status worth interrupting
// someone about, because it is the only one where they can lose everything.
//
// store.js is imported dynamically rather than at the top: ui.js is otherwise
// pure presentation, and a lazy import keeps that true and rules out any
// import cycle.
export function profileButton() {
  const glyph = el('span', { class: 'avatar-glyph' }, icon('person'));
  // ⚠️ No `at-risk` at construction. The dot used to be on from the first
  // paint of a brand-new account with nothing in it (UX review finding 5) —
  // and a permanent warning is wallpaper within a week, unread at the moment
  // it becomes true. It now waits for the data check below.
  const btn = el('a', {
    class: 'avatar-btn',
    href: '#/account',
    'aria-label': 'Account',
    title: 'Account',
  }, glyph);

  const paint = (state, hasData, avatar) => {
    const user = state && state.user;
    const secured = Boolean(user && user.secured);
    btn.classList.toggle('secured', secured);
    // ⚠️ The dot means "you have something to lose and it is not backed up" —
    // BOTH halves. An empty account has nothing at risk, and warning about it
    // teaches people the dot is decoration. When the check itself fails the
    // warning stays (hasData defaults true), because unknown is not safe.
    btn.classList.toggle('at-risk', !secured && hasData);

    // A chosen photo beats every fallback glyph — it IS the person, which is
    // what an initial or a silhouette were standing in for. The aria labels
    // below still carry the account state; only the picture changes.
    const face = avatar && typeof avatar === 'string' && avatar.startsWith('data:image/')
      ? el('img', { class: 'avatar-img', src: avatar, alt: '' })
      : null;

    if (secured && user.email) {
      glyph.replaceChildren(face || document.createTextNode(user.email.trim()[0].toUpperCase()));
      btn.setAttribute('aria-label', `Account — signed in as ${user.email}`);
      btn.setAttribute('title', user.email);
    } else if (secured) {
      glyph.replaceChildren(face || icon('person'));
      btn.setAttribute('aria-label', 'Account — signed in');
      btn.setAttribute('title', 'Account');
    } else if (state && state.lastAccount && state.lastAccount.email) {
      // Signed in, but the app cannot reach the account to confirm it. The dot
      // stays — anything logged right now genuinely is not backed up yet — but
      // calling that "no account" would be false and is what makes an offline
      // session look like being signed out.
      glyph.replaceChildren(face || document.createTextNode(state.lastAccount.email.trim()[0].toUpperCase()));
      btn.setAttribute('aria-label',
        `Account — signed in as ${state.lastAccount.email}, but offline right now`);
      btn.setAttribute('title', 'Offline — recent changes have not uploaded yet');
    } else if (hasData) {
      glyph.replaceChildren(face || icon('person'));
      btn.setAttribute('aria-label', 'Account — your data is not backed up');
      btn.setAttribute('title', 'Your data is not backed up');
    } else {
      glyph.replaceChildren(face || icon('person'));
      btn.setAttribute('aria-label', 'Account — not signed in');
      btn.setAttribute('title', 'Account');
    }
  };

  import('./store.js')
    .then(async ({ auth, store }) => {
      // Is there anything a lost browser profile would actually lose? Reads
      // are served from the store's cache, so this costs nothing after boot.
      const dataAtRisk = async () => {
        try {
          const [s, w, b, bw, g] = await Promise.all([
            store.getSessions(), store.getWorkouts(), store.getBenchmarks(),
            store.getBodyWeights(), store.getGuestSessions().catch(() => []),
          ]);
          return Boolean(s.length || w.length || b.length || bw.length || g.length);
        } catch (_) { return true; }   // unknown is not safe — keep the warning
      };
      const avatarOf = async () => {
        try { return (await store.getSettings()).avatar || null; }
        catch (_) { return null; }
      };
      const repaint = async () =>
        paint(await auth.state(), await dataAtRisk(), await avatarOf());
      await repaint();

      // A new button is built on every navigation, so the subscription has to
      // die with the node it belongs to — otherwise listeners accumulate for
      // the life of the session, each pinning a detached element.
      // `wasMounted` guards the gap between creating the button and appending
      // it, so a change arriving in that window doesn't cancel it early.
      let wasMounted = false;
      let stop = null;
      stop = auth.onChange(async () => {
        if (btn.isConnected) wasMounted = true;
        else if (wasMounted) { if (stop) stop(); return; }
        await repaint();
      });
    })
    .catch((err) => console.error('Could not read account state', err));

  return btn;
}

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

let toastTimer = null;
export function toast(message) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: 'toast', role: 'status', text: message });
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2400);
}

/* ------------------------------------------------------------------ *
 * Bottom sheet
 * ------------------------------------------------------------------ */

export function openSheet({ title, body, footer, onClose }) {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('div', { class: 'sheet-head' },
      el('h2', { text: title }),
      iconBtn('x', 'Close', close),
    ),
    el('div', { class: 'sheet-body' }, body),
    footer ? el('div', { class: 'sheet-foot' }, footer) : null,
  );

  const backdrop = el('div', {
    class: 'sheet-backdrop',
    onClick: (e) => { if (e.target === backdrop) close(); },
  }, sheet);

  document.body.append(backdrop);
  // A sheet is mounted outside the router, so it needs the passes of its own.
  associateLabels(sheet);
  autoGrowTextareas(sheet);
  document.addEventListener('keydown', onKey);
  return { close, sheet };
}

export function confirmSheet({ title, message, confirmLabel = 'Delete', danger = true, onConfirm }) {
  const { close } = openSheet({
    title,
    // ⚠️ `pre-line` so a message can hold a second paragraph. Added 2026-08-24
    // for the disconnect sheet, where the honest wording is two ideas — what
    // this does, and what it pointedly does NOT do — and running them together
    // buries the second. No existing message contains a newline, so nothing
    // else changes shape.
    body: el('p', { text: message, style: 'margin:0;color:var(--ink-soft);line-height:1.5;white-space:pre-line' }),
    footer: el('div', { class: 'btn-row' },
      el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => close() }),
      el('button', {
        class: 'btn ' + (danger ? 'danger' : 'primary'),
        text: confirmLabel,
        onClick: () => { close(); onConfirm(); },
      }),
    ),
  });
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

export function parseTime(str) {
  const t = String(str).trim();
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
  }
  return Math.max(0, Math.round(parseFloat(t) || 0));
}

export function fmtField(field, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const m = FIELD_META[field];
  if (field === 'time') return fmtTime(value);
  if (field === 'distance') return `${Number(value).toFixed(2)} ${m.unit}`;
  if (field === 'weight') return `${trimNum(value)} ${m.unit}`;
  return `${trimNum(value)}`;
}

export function trimNum(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

export function fmtSet(set, fields, loadType) {
  const parts = [];
  if (fields.includes('weight') && set.weight != null) {
    parts.push(`${units.withUnit(set.weight)}${loadType === 'per_side' ? '/side' : ''}`);
  }
  if (fields.includes('reps') && set.reps != null) parts.push(`× ${trimNum(set.reps)}`);
  if (fields.includes('time') && set.time != null) parts.push(fmtTime(set.time));
  if (fields.includes('distance') && set.distance != null) parts.push(`${Number(set.distance).toFixed(2)} mi`);
  const p = pace(set, fields);
  if (p) parts.push(p);
  return parts.join('  ') || '—';
}

/**
 * Minutes per mile, for anything recording both a distance and a time.
 *
 * ⚠️ DERIVED FROM WHAT WAS RECORDED, AND NEVER JUDGED — docs/activities-plan.md
 * §3 item 2, and Rule 6. It is division, not a model, so it says nothing the
 * two numbers beside it did not already say; and it is printed in the same ink
 * as the rest of the line, never coloured, because a recovery run is not a
 * worse run and this app has no way to know which one today was.
 *
 * Silent unless both numbers are really there and really positive — a
 * back-dated log with a distance and no time would otherwise read "Infinity".
 */
export function pace(set, fields) {
  if (!fields.includes('distance') || !fields.includes('time')) return '';
  const miles = Number(set.distance);
  const seconds = Number(set.time);
  if (!(miles > 0) || !(seconds > 0)) return '';
  const perMile = seconds / miles;
  // Past about an hour a mile this stops describing anything anybody would
  // call a pace — a stroll with a long stop in it, or a mistyped distance.
  if (perMile > 3600) return '';
  const mins = Math.floor(perMile / 60);
  const secs = Math.round(perMile % 60);
  const carried = secs === 60 ? { m: mins + 1, s: 0 } : { m: mins, s: secs };
  return `${carried.m}:${String(carried.s).padStart(2, '0')} /mi`;
}

export function fmtDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function fmtDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relativeDay(iso) {
  const today = new Date();
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - then) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return fmtDateShort(iso);
}

/* ------------------------------------------------------------------ *
 * Stepper — the primary in-gym control.
 * Big targets, tap-and-hold to repeat, direct typing allowed.
 * ------------------------------------------------------------------ */

export function stepper({ field, value, onChange, suffix }) {
  const meta = FIELD_META[field];
  // Weight is STORED in pounds and SHOWN in the user's unit, so the stepper
  // works entirely in display units — a nudge is then a clean 2.5 kg rather
  // than whatever 5 lb happens to convert to — and converts back on the way
  // out. Every other field has one unit and passes straight through.
  const isWeight = field === 'weight';
  const step = isWeight ? units.weightStep() : meta.step;
  const inbound = (v) => (isWeight ? units.toDisplay(v) : Number(v));
  const outbound = (v) => (isWeight ? units.fromDisplay(v) : v);

  let current = value == null ? 0 : inbound(value);

  const input = el('input', {
    class: 'step-value mono',
    type: field === 'time' ? 'text' : 'number',
    // ⚠️ `numeric` is the iOS keypad WITH NO DECIMAL POINT, so it must only go
    // on a field that can never hold one. Weight can: kilograms are stored as
    // pounds and shown to one decimal, and the kg step is 2.5 — so a kg user
    // reading "62.5" was handed a keyboard that could not type it, and had to
    // reach for the ± buttons to enter a number the screen was already showing.
    // Found 2026-08-21. Reps stay `numeric`: half a rep is not a thing.
    inputmode: (field === 'distance' || field === 'weight') ? 'decimal' : 'numeric',
    value: display(current),
    'aria-label': meta.label,
  });

  function display(v) {
    if (field === 'time') return fmtTime(v);
    if (field === 'distance') return Number(v).toFixed(2);
    // Kilograms keep a decimal: stored as pounds, a round 60 kg is 132.277 lb
    // underneath and would otherwise read back as 60.000000000001.
    if (isWeight && units.units() === 'kg') return String(Math.round(v * 10) / 10);
    return trimNum(v);
  }

  function set(v, silent) {
    current = Math.max(meta.min, Math.round(v * 100) / 100);
    input.value = display(current);
    if (!silent) onChange(outbound(current));
  }

  function bump(dir) {
    set(current + dir * step);
    if (navigator.vibrate) navigator.vibrate(8);
  }

  // press-and-hold to repeat
  function holdable(btn, dir) {
    let to = null, iv = null;
    const start = (e) => {
      e.preventDefault();
      bump(dir);
      to = setTimeout(() => { iv = setInterval(() => bump(dir), 90); }, 420);
    };
    const stop = () => { clearTimeout(to); clearInterval(iv); to = iv = null; };
    btn.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    return btn;
  }

  input.addEventListener('focus', () => { if (field === 'time') input.value = current; input.select(); });
  input.addEventListener('blur', () => {
    const raw = field === 'time' ? parseTime(input.value) : parseFloat(input.value);
    set(Number.isNaN(raw) ? current : raw);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

  const minus = holdable(el('button', { class: 'step-btn', type: 'button', 'aria-label': `Decrease ${meta.label}` }, icon('minus')), -1);
  const plus = holdable(el('button', { class: 'step-btn', type: 'button', 'aria-label': `Increase ${meta.label}` }, icon('plus')), 1);

  const node = el('div', { class: 'stepper' },
    el('div', { class: 'stepper-label' },
      meta.label,
      suffix ? el('em', { class: 'stepper-suffix', text: suffix }) : null,
    ),
    el('div', { class: 'stepper-controls' }, minus, input, plus),
    el('div', { class: 'step-unit', text: stepHint(field, meta) }),
  );

  return { node, get: () => outbound(current), set: (v) => set(inbound(v), true) };
}

function stepHint(field, meta) {
  if (field === 'time') return `${meta.step} sec steps`;
  if (field === 'weight') return `${units.weightStep()} ${units.units()} steps`;
  if (field === 'distance') return `${meta.step} mi steps`;
  return `1 rep steps`;
}

/* ------------------------------------------------------------------ *
 * Mini stepper — compact inline counter, used for planned set counts
 * ------------------------------------------------------------------ */

export function miniStepper({ value, min = 1, max = 20, onChange, label = 'Sets' }) {
  let current = value;
  const out = el('span', { class: 'mini-value mono', text: String(current) });

  const step = (dir) => {
    const next = Math.min(max, Math.max(min, current + dir));
    if (next === current) return;
    current = next;
    out.textContent = String(current);
    onChange(current);
    if (navigator.vibrate) navigator.vibrate(6);
  };

  return el('div', { class: 'mini-stepper', role: 'group', 'aria-label': label },
    el('button', { type: 'button', class: 'mini-btn', 'aria-label': `One fewer ${label}`, onClick: () => step(-1) }, icon('minus')),
    out,
    el('button', { type: 'button', class: 'mini-btn', 'aria-label': `One more ${label}`, onClick: () => step(1) }, icon('plus')),
  );
}

/* ------------------------------------------------------------------ *
 * Load-type badge — says whether a weight is per side or the whole load
 * ------------------------------------------------------------------ */

export function loadBadge(loadType) {
  if (!loadType) return null;
  return el('span', {
    class: 'load-badge' + (loadType === 'per_side' ? ' per-side' : ''),
    text: loadType === 'per_side' ? 'PER SIDE' : 'TOTAL',
  });
}

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

export function emptyState(title, message, action) {
  return el('div', { class: 'empty' },
    el('div', { class: 'empty-title', text: title }),
    el('p', { text: message }),
    action || null,
  );
}

/* ------------------------------------------------------------------ *
 * Screen shell — topbar + body, shared by every view
 * ------------------------------------------------------------------ */

// The page itself never scrolls. A screen is a fixed header, an optional fixed
// region under it, exactly one scrolling region, and an optional fixed footer.
// Anything that overflows scrolls inside `scroll` — never the window.
// `title` may be a string or a DOM node. Passing a node lets a screen put its
// primary control in the header instead of a redundant heading, which buys back
// a whole row for the content.
export function screenShell({ title, sub, back, actions, top, scroll, bottom, body, noNav, profile }) {
  const heading = title instanceof Node
    ? el('div', { class: 'topbar-slot' }, title)
    : el('div', { style: 'flex:1;min-width:0' },
        el('h1', { text: title }),
        sub ? el('div', { class: 'topbar-sub', text: sub }) : null,
      );

  return el('div', { class: 'screen' + (noNav ? ' no-nav' : '') },
    el('header', { class: 'topbar' },
      // Left slot: back where there is somewhere to go back to, otherwise the
      // profile button. Never both — two things competing for the top-left
      // corner is how you get people tapping the wrong one.
      back ? iconBtn('left', 'Back', back) : (profile ? profileButton() : null),
      heading,
      ...(actions || []),
    ),
    top ? el('div', { class: 'pane-top' }, top) : null,
    el('div', { class: 'pane-scroll' }, scroll || body),
    bottom ? el('div', { class: 'pane-bottom' }, bottom) : null,
  );
}
