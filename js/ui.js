// Shared UI primitives: DOM builder, icons, sheets, toasts, steppers, formatters.

import { FIELD_META } from './exercises.js';
import { imageFor } from './exercise-images.js';
import { safeAvatar } from './social.js';
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
  // A drag handle. Two full-width rules rather than the six-dot grip: at 15px
  // the dots need a fill exception (a zero-length stroke is a dot in Chrome and
  // nothing in some others), and two lines is the convention every list-reorder
  // control on a phone already uses.
  grip: 'M5 9h14M5 15h14',
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
  // A padlock in TWO PARTS, and it is one glyph — the session runner's set
  // lock (2026-09-12). Tim asked for a lock that *"animates being locked and
  // unlocked when you click on it"*, and Rule 7 says a movement has to be a
  // thing going somewhere: a crossfade between a `lock` and an `unlock` glyph
  // is two pictures swapped, which is the "instant change" he was describing
  // the absence of. So the shackle is its own path, drawn over the body as a
  // second <svg> in the same viewBox, and CSS rotates it about its right leg
  // — one object, one movement. ⚠️ Neither is a whole icon on its own: draw
  // both, or you get a box with no shackle. The body's top edge sits at y=11
  // and the shackle's legs end there, so closed they meet exactly.
  'lock-body': 'M5.5 11h13a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1z',
  'lock-shackle': 'M8 11V7.5a4 4 0 0 1 8 0V11',
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
 * 🔄 THE YOU / FRIENDS SWITCH IS DELETED — 2026-09-08, Tim: *"I want to get rid
 * of the 'You' and 'Friends' tab in the home page."* It was the seam where
 * Social got folded into Home on 2026-08-22, and it is gone because the seam
 * is: Home is the feed, and the Friends list is reached from the Profile tab,
 * where the followers and following counts point straight at it.
 *
 * ⚠️ THE FUNCTION IS DELETED RATHER THAN LEFT UNUSED, and `#/social` is
 * untouched. A control nobody renders is not a feature kept warm, it is a
 * second answer to a question the app has stopped asking — and this file's own
 * rule is that a route with no way in is deleted in every sense that matters,
 * which cuts the other way too: the route has a way in, so it lives; the widget
 * has no caller, so it does not.
 *
 * Two things it recorded are worth keeping, because both outlived it:
 *
 *   ⚠️ IT WAS REAL LINKS ACROSS TWO ROUTES, not a state machine inside one
 *   screen — which is why `#/home` and `#/social` are still separate views and
 *   nothing had to be unpicked to remove the switch.
 *
 *   ⚠️ "FRIENDS" RATHER THAN "SOCIAL". `js/social.js` calls the feature social
 *   because that is what it is; a person has friends. Saying the thing rather
 *   than the term (D8) applies to the app's own vocabulary first — the same
 *   fault the UX review found in "system" vs "programme". The Friends screen is
 *   still titled Friends for exactly that reason.
 */

/**
 * Somebody's face — theirs if they have published one, the person glyph if not.
 *
 * Tim, 2026-08-31: *"when you post a workout and it goes on their feed, the
 * profile picture is shown, but its just the default blank humanoid, not the
 * picture that they actually added."* Every place a friend appears calls this,
 * so a photo arriving or being taken down happens everywhere at once.
 *
 * 🚨 `safeAvatar` IS THE GATE AND IT IS NOT OPTIONAL. The string is written by
 * another account, and this puts it in an `src`: it must be a base64 raster data
 * URL, never an SVG (a document that can carry script) and never a remote URL (a
 * beacon that would tell somebody else's server when this device rendered their
 * face, and from where). Anything else falls back to the glyph, which is also
 * what a friend on an old build looks like.
 *
 * ⚠️ `alt` IS EMPTY ON PURPOSE. The name is always beside it in the same row, so
 * describing the picture would make a screen reader say the person twice.
 */
export function personFace(avatar, size = 20) {
  const src = safeAvatar(avatar);
  return src
    ? el('img', { class: 'face-img', src, alt: '', loading: 'lazy', decoding: 'async' })
    : icon('person', size);
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

/* ------------------------------------------------------------------ *
 * Leaving the screen — 2026-09-01, the motion pass
 *
 * Tim: *"When you click on something, I want it to have some sort of visible
 * motion… rather than just an instant change or teleportation."* Arriving was
 * already animated in a couple of places; LEAVING never was, anywhere, because
 * a node that is removed is simply gone and CSS gets no say in it.
 *
 * 🚨 THE CLASS IS RENAMED RATHER THAN ADDED TO, and this is the load-bearing
 * decision. `.sheet` becomes `.sheet-x` the instant it is asked to close, so a
 * closing panel STOPS MATCHING `document.querySelector('.sheet')` immediately:
 * nothing in the app, and no test, can find, focus or assert against a surface
 * that is on its way off the screen. The obvious alternative — an `.is-closing`
 * class — leaves a real `.sheet` in the DOM for a quarter of a second, and a
 * ghost that still answers to its own name is exactly how a test comes to pass
 * for the wrong reason. app.css carries both names on the layout rules and only
 * the animation differs.
 *
 * ⚠️ IT IS IDEMPOTENT AND IT ALWAYS FINISHES. Pressing Cancel twice, or Escape
 * during the animation, must not stack two removals; and if the animation never
 * runs at all — reduced motion, jsdom, an engine that does not know the
 * keyframes — the timer still removes the node. Nothing here waits on an event
 * that might not fire.
 * ------------------------------------------------------------------ */
const LEAVE_MS = 240;

/**
 * ⚠️ CAN ANYTHING ACTUALLY ANIMATE HERE? Two places where the answer is no, and
 * in both of them the node must go IMMEDIATELY rather than linger for a quarter
 * of a second doing nothing:
 *
 *   - `prefers-reduced-motion`. The stylesheet already cuts every duration to
 *     nothing, so waiting out an animation that is not running is pure delay.
 *   - jsdom, where `Element.animate` does not exist. This is not only tidiness:
 *     🚨 THE RENAME ABOVE ONLY HIDES THE CONTAINER, NOT WHAT IS INSIDE IT. A
 *     closing sheet stops matching `.sheet`, but its rows still match
 *     `.search-results .row` for as long as it is painted — and that is a real
 *     bug this cost, not a theory: the swap test picked an exercise out of a
 *     sheet that had already been dismissed, and the picker underneath it was
 *     left open. In a browser `pointer-events: none` makes that unreachable to a
 *     finger; in a test harness there are no fingers, only selectors.
 */
const canAnimate = () => typeof document !== 'undefined'
  && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'
  && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function leave(node, ms = LEAVE_MS) {
  if (!node || !node.isConnected || node.dataset.leaving) return;
  if (!canAnimate()) { node.remove(); return; }
  node.dataset.leaving = '1';
  node.className = String(node.className).split(/\s+/).filter(Boolean)
    .map((c) => `${c}-x`).join(' ');
  // Belt and braces: the class change stops it being addressable, this stops it
  // being touchable in the frames it is still painted for.
  node.setAttribute('aria-hidden', 'true');
  node.style.pointerEvents = 'none';
  setTimeout(() => node.remove(), ms);
}

/* ------------------------------------------------------------------ *
 * A SCREEN THAT RISES, AND ONE THAT DROPS AWAY — 2026-09-09
 *
 * Tim: *"To make the record section feel more like a button that actually
 * activates something, I want the screen to pull up the record section from the
 * bottom (which covers over the main section display). The only change is that
 * we'll add a down arrow in the upper left which will push the record section
 * back down, showing the main section display and automatically being selected
 * on 'home'."*
 *
 * 🚨 THE ROUTER CANNOT DO THIS ON ITS OWN AND MUST NOT BE MADE TO. `render()`
 * clears `#app` and builds the next screen, so at no point do two screens exist
 * — which is right, and is why every screen in this app is stateless about the
 * one before it. What a slide needs is exactly one frame where both are painted.
 *
 * ⚠️ SO THE OUTGOING SCREEN IS MOVED OUT OF `#app` AND PARKED ON `document.body`
 * — the same place sheets and toasts live — for the length of the animation, and
 * removed by a timer that always runs. The router then does what it always does,
 * underneath. Nothing about `render()` changes except that it is handed a screen
 * that has already left.
 *
 * ⚠️ MOVED, NOT CLONED. The node is being thrown away either way: moving costs
 * nothing, cannot duplicate an `id` that `associateLabels()` generated, and the
 * listeners that come with it are unreachable behind `pointer-events: none`.
 *
 * 🚨 AND NOTHING HAPPENS AT ALL WHERE NOTHING CAN ANIMATE — reduced motion, or
 * jsdom. That is not tidiness: a ghost is a whole second screen in the document,
 * and every selector in every test would suddenly match two of things there is
 * meant to be one of. `canAnimate()` is false in both, so a test never sees one.
 * (`leave()` above makes the same call for the same reason, and the note on it
 * records what a lingering ghost cost when it was addressable.)
 * ------------------------------------------------------------------ */

/** Matches `--t-slow`; a whole surface, per Rule 7. */
const SCREEN_MS = 240;

/**
 * Park `node` where it is drawn, outside the router, and take it away.
 *
 * @param {Element} node    the `.screen` about to be replaced
 * @param {boolean} falls   true to slide it off the bottom (the down arrow),
 *   false to hold it still while something else rises over it (arriving)
 */
export function parkScreen(node, { falls = false } = {}) {
  if (!canAnimate() || !node || !node.isConnected) return null;
  // A second tap before the first finished: the older ghost goes now rather
  // than stacking. Idempotent, like leave().
  document.querySelectorAll('.screen-ghost').forEach((g) => g.remove());

  /* 🔄 THE WHOLE OF `#app` IS PARKED, NOT THE SCREEN ALONE — 2026-09-12, Tim:
   * *"when the screen goes up, it doesn't cover over the main sections display
   * (home, workouts, record, etc), like we talked about."* Record is a
   * no-nav screen now (`FULLSCREEN` in app.js), so `clear(app)` takes the tab
   * bar with the old screen; parking only the screen left the bar's strip
   * EMPTY for the 240ms the panel took to reach it — a bar that vanishes a
   * frame before it is covered, which is the opposite of covering it. So the
   * ghost is a still picture of everything that was on screen: the screen AND
   * its bar, in `#app`'s own flex direction (column-reverse on a phone, row on
   * a desktop), boxed on `#app`'s measured rect.
   *
   * ⚠️ `node` is still what the caller hands over, and it still has to be
   * connected — that is the "is there anything to park" question. Everything
   * else in `#app` simply comes along, which for a no-nav screen (Record
   * falling, the runner minimising) is nothing extra.
   *
   * ⚠️ MEASURED, NOT `inset: 0`, still: `#app` is `100dvh - --kb`, and a
   * full-viewport ghost would relayout under a raised keyboard. */
  const app = node.closest('#app') || node.parentElement;
  const r = app.getBoundingClientRect();
  const ghost = el('div', { class: 'screen-ghost' + (falls ? ' is-falling' : '') });
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`
    + `flex-direction:${getComputedStyle(app).flexDirection || 'column-reverse'}`;
  ghost.append(...app.children);
  document.body.append(ghost);

  /* 🔄 REMOVED WHEN THE MOVEMENT ENDS, NOT ON A CLOCK — 2026-09-12, found by an
   * in-page rAF probe while checking the fix above. The old `setTimeout(…,
   * SCREEN_MS)` started HERE, before `resolve()` was awaited (app.js parks
   * first, on purpose — see its comment). So on a read that took 220ms the
   * ghost was gone 20ms into a 240ms rise, and the panel climbed the second
   * half over an empty ground: measured, ghost removed at t=264 with the panel
   * still at y=404. The fix is the same shape as the parkScreen rule itself —
   * the thing that knows when the rise is over is the rising screen, so the
   * CALLER releases an arriving ghost (`releaseGhost()` on `animationend`), and
   * a falling ghost releases itself when its own `screen-down` ends.
   *
   * ⚠️ A TIMER STILL ALWAYS RUNS, as the header promises — as a backstop at
   * four times the duration, for a screen whose animation never fires (a tab
   * hidden mid-navigation does not paint, and an `animationend` that never
   * comes must not leave a second screen in the document for ever). */
  const done = () => ghost.remove();
  if (falls) {
    ghost.addEventListener('animationend', (e) => {
      if (e.target === ghost && e.animationName === 'screen-down') done();
    });
  }
  setTimeout(done, SCREEN_MS * 4);
  return ghost;
}

/**
 * Take an arriving ghost away when the screen that rose over it has landed.
 * Guarded on the screen's OWN `screen-up`: `animationend` bubbles, and a child
 * with a keyframe of its own (a bar filling, a row opening) would otherwise end
 * the ghost's life on the first frame.
 */
export function releaseGhost(ghost, screen) {
  if (!ghost || !screen) return;
  screen.addEventListener('animationend', (e) => {
    if (e.target === screen && e.animationName === 'screen-up') ghost.remove();
  });
}

/* ------------------------------------------------------------------ *
 * 🆕 THE SAME MOVEMENT FOR A WORKOUT IN PROGRESS — 2026-09-10.
 *
 * Tim: *"Similarly to this downwards/upwards animation, I want to have this
 * similar animation for when you're in the middle of a workout and you click
 * down on it to the main page or click up to resume the workout."*
 *
 * ⚠️ THE DOWN HALF NEEDED NOTHING NEW — `minimize()` in views-session.js parks
 * its own screen with `falls: true`, exactly as Record's down arrow does.
 *
 * 🚨 THE UP HALF CANNOT BE INFERRED FROM THE ROUTE, which is why this exists.
 * Record rises because arriving AT `#/record` from anywhere else is
 * unambiguous. The runner is reached three ways — the live bar (a resume,
 * which is the one he described), the Record picker (starting a workout), and
 * a deep link — and only the first is a panel coming back up over the screen
 * you were reading. So the door asks, rather than the router guessing, and the
 * other two doors behave exactly as they always did.
 *
 * ⚠️ ONE-SHOT, AND IT IS TAKEN RATHER THAN READ. A flag left set would make
 * the NEXT render rise too — a refresh, a demo toggle, anything — which is the
 * bounce Rule 7 forbids (a movement must not claim something happened that
 * did not). Consuming it at the point of use makes that impossible.
 * ------------------------------------------------------------------ */
let riseRequested = false;

/** Ask the router to make the next screen rise. */
export function requestRise() { riseRequested = true; }

/** Consume the request. Returns whether one was pending. */
export function takeRiseRequest() {
  const was = riseRequested;
  riseRequested = false;
  return was;
}

let toastTimer = null;
export function toast(message) {
  // ⚠️ The one already on screen LEAVES rather than vanishing under the new
  // one — two toasts in a row is a queue, and a queue that teleports reads as
  // a flicker.
  document.querySelectorAll('.toast').forEach((t) => leave(t, 200));
  const t = el('div', { class: 'toast', role: 'status', text: message });
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => leave(t, 200), 2400);
}

/* ------------------------------------------------------------------ *
 * The segmented control's pill slides — 2026-09-01
 *
 * 🚨 THIS IS THE MOVEMENT TIM DESCRIBED, in the control he uses most. Tapping
 * "Bars" painted a pill under your finger and unpainted the one you left: two
 * instant changes with nothing joining them. One pill travels now, which also
 * says which way along the row you just went.
 *
 * ⚠️ PROGRESSIVE, NOT REQUIRED. The painted `.seg[aria-selected]` background is
 * still in the stylesheet and is what the control looks like if this never runs
 * — no script, an old engine, a jsdom test. `.has-ind` is added by this
 * function and is the only thing that switches the fallback off, so the
 * enhancement can never leave the control with no selection visible at all.
 *
 * ⚠️ IT IS DRIVEN BY A MutationObserver ON aria-selected rather than by the
 * click handlers, because there are five of these controls built in four files
 * and one of them (Months / Years) re-renders its own buttons. Watching the
 * attribute that already means "this one is chosen" costs those files nothing
 * and cannot fall out of step with them.
 * ------------------------------------------------------------------ */
export function wireSegmented(root) {
  if (!root || !root.querySelectorAll) return;
  for (const bar of root.querySelectorAll('.segmented')) {
    if (bar.dataset.ind) continue;
    const segs = [...bar.children].filter((n) => n.classList && n.classList.contains('seg'));
    if (segs.length < 2) continue;
    bar.dataset.ind = '1';

    const ind = el('span', { class: 'seg-ind', 'aria-hidden': 'true' });
    bar.prepend(ind);
    bar.classList.add('has-ind');

    const place = () => {
      const on = segs.find((s) => s.getAttribute('aria-selected') === 'true');
      // Nothing selected is a real state on some of these — the pill hides
      // rather than parking on the first segment and lying about it.
      ind.style.opacity = on ? '1' : '0';
      if (!on) return;
      ind.style.width = `${on.offsetWidth}px`;
      ind.style.height = `${on.offsetHeight}px`;
      /* ⚠️ `offsetLeft`, NOT a bounding-rect difference, and since 2026-09-08
       * that is load-bearing rather than incidental: this row can SCROLL now
       * that Data has six segments, and `offsetLeft` is measured against the
       * bar itself, so the pill stays on its segment as the row moves. A
       * viewport-relative measurement would have drifted the moment anybody
       * flicked it sideways. */
      ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;

      /* 🚨 AND THE SELECTED SEGMENT IS SCROLLED INTO VIEW. Data's sixth segment
       * is off-screen at 360px, so opening the app on Calendar would otherwise
       * show a row of five tabs with none of them lit and the chosen one out of
       * sight — a screen that looks broken rather than scrolled.
       *
       * ⚠️ `scrollLeft` rather than `scrollIntoView()`: the latter walks every
       * scrollable ancestor and would drag the whole pane about, which on a
       * screen whose content is a full-height body map is very visible. This
       * moves one element's own scroll offset and nothing else. Guarded because
       * jsdom lays nothing out, so every offset here is 0 and the arithmetic
       * would centre on nothing. */
      if (bar.scrollWidth > bar.clientWidth + 1) {
        const target = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
        bar.scrollLeft = Math.max(0, target);
      }
    };

    // ⚠️ The FIRST placement must not slide. Without this every screen would
    // open with the pill flying in from the left edge, which is decoration
    // rather than a relationship — the rule the whole motion section is under.
    ind.classList.add('no-anim');
    place();
    requestAnimationFrame(() => {
      place();
      requestAnimationFrame(() => ind.classList.remove('no-anim'));
    });

    // ⚠️ OFF `window`, NOT THE BARE GLOBAL. In a browser they are the same
    // object; under jsdom the DOM globals are assigned onto globalThis one by
    // one and MutationObserver is not among them, so `typeof MutationObserver`
    // is "undefined" and this quietly did nothing — the pill wired itself, never
    // moved, and every assertion about it passed except the one that watched.
    const MO = (typeof window !== 'undefined' && window.MutationObserver) || null;
    if (MO) {
      new MO(place).observe(bar, {
        subtree: true, attributes: true, attributeFilter: ['aria-selected'],
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Exercise pictures (2026-08-30, Tim's ask)
 *
 * "the picture should be shown wherever an exercise is named, right next to
 * the name… if the user clicks on the name of the exercise, it will pull up
 * the picture that takes up the screen and then the user can click an x in the
 * corner that will close the picture."
 *
 * `js/exercise-images.js` owns WHICH picture; this owns how it is shown.
 *
 * ⚠️ THERE IS NO ART IN THE REPOSITORY YET — the style Tim wants is a paid
 * stock library and buying it is his call. So the whole path below has one
 * governing rule: **no picture is an ordinary state, not a missing file.**
 * `exerciseLabel()` with nothing to show returns the plain name it would have
 * rendered anyway — no placeholder square, no broken-image icon, no gap. A
 * screen with no pictures looks exactly as it did before this shipped, which
 * is what makes it safe to ship the feature ahead of the art.
 * ------------------------------------------------------------------ */

/**
 * Full-screen picture with an ✕ in the corner.
 *
 * ⚠️ THE PICTURE SITS ON WHITE IN BOTH THEMES, hard-coded, never a token.
 * These illustrations are drawn on white; painted onto a dark surface they
 * would be a glaring white rectangle with a ragged edge where the artwork
 * stops. The card is the same decision the QR code made on 2026-08-29 — an
 * asset that carries its own background does not get to inherit the theme.
 */
export function openImageViewer({ src, name }) {
  const close = () => {
    leave(backdrop);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const img = el('img', { class: 'exview-img', src, alt: `${name} — how the exercise looks` });

  const backdrop = el('div', {
    class: 'exview', role: 'dialog', 'aria-modal': 'true', 'aria-label': name,
    // Tapping the dark space closes it, like every sheet in the app. The ✕ is
    // what the screen TELLS you to press; this is the shortcut people try.
    onClick: (e) => { if (e.target === backdrop) close(); },
  },
    iconBtn('x', 'Close picture', close, 'icon-btn exview-close'),
    el('div', { class: 'exview-card' }, img),
    el('div', { class: 'exview-name', text: name }),
  );

  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  return { close };
}

/**
 * An exercise's name with its picture beside it, where there is one.
 *
 * @param exercise  the library object — needed for the id, because two
 *                  exercises share the name "Cable Kickback" and only the id
 *                  separates them.
 * @param name      what to print. Defaults to the exercise's own name; a
 *                  recorded session carries its own `exerciseName`, which is
 *                  what was called at the time and may differ.
 * @param tag       the element for the name — 'span' inside a row, 'h2' where
 *                  it is the screen's heading.
 * @param className goes on the name element, so existing styling is kept.
 * @param inControl ⚠️ TRUE WHERE THIS SITS INSIDE A BUTTON OR LINK ALREADY.
 *                  A button inside a button is invalid HTML and needs a
 *                  stopPropagation that holds until somebody adds the next
 *                  control — `.set-del` and the people bar's ✕ both learned
 *                  that. So inside a row the thumbnail is NOT a control: the
 *                  row keeps its own job, and the picture is reached from the
 *                  screens where the name is not already a control.
 */
export function exerciseLabel({
  exercise, name, tag = 'span', className = '', inControl = false, thumbClass = '',
} = {}) {
  const label = name || (exercise && exercise.name) || '';
  const src = imageFor(exercise);
  const nameNode = el(tag, { class: className, text: label });
  if (!src) return nameNode;

  const thumb = el('img', {
    class: `ex-thumb ${thumbClass}`.trim(), src, alt: '', loading: 'lazy', decoding: 'async',
  });

  if (inControl) {
    return el('span', { class: 'ex-label' }, thumb, nameNode);
  }
  // Not inside a control: the whole thing is the button, which is what Tim
  // asked for — "if the user clicks on the name of the exercise".
  return el('button', {
    class: 'ex-label ex-label-btn',
    'aria-label': `Show a picture of ${label}`,
    onClick: () => openImageViewer({ src, name: label }),
  }, thumb, nameNode);
}

/* ------------------------------------------------------------------ *
 * Bottom sheet
 * ------------------------------------------------------------------ */

export function openSheet({ title, body, footer, onClose }) {
  const close = () => {
    // ⚠️ BOTH halves leave, and they leave differently: the sheet drops back
    // towards the edge it came from, the dark behind it fades. One movement
    // undoing itself, rather than a panel blinking out of existence. See
    // `leave()` for why the class is renamed rather than added to.
    leave(sheet);
    leave(backdrop);
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

/* ------------------------------------------------------------------ *
 * The "?" — an explanation you can ask for
 *
 * Tim, 2026-09-07: *"If it's explaining something, I think it's best to have a
 * little question mark somewhere near the thing that it's explaining … when you
 * touch it it opens a mini box that shares what it's trying to say."*
 *
 * 🚨 THE POINT IS NOT THAT THE WORDS ARE HIDDEN. It is that a screen states the
 * fact and the ? carries the reason. This app's copy was written under a
 * standing rule that every caveat is stated on screen — which is right, and is
 * why nothing here deletes a caveat. What it got wrong is that a caveat and a
 * number were given the same weight and the same position, so a Volume screen
 * read as three paragraphs with some figures in them. **A caveat behind a ? is
 * still stated**; it is one tap away instead of in front of the thing it
 * qualifies.
 *
 * ⚠️ SO THE RULE FOR USING IT: the ? may hold WHY, never WHAT. If a sentence
 * changes what the reader thinks the number IS, it stays on the screen. If it
 * explains where the number came from, what it cannot see, or why it is drawn
 * that way, it goes in here.
 *
 * ⚠️ A popover rather than a bottom sheet, deliberately: a sheet covers the
 * screen and takes the thing being explained with it, which is precisely the
 * context somebody tapping "?" is trying to keep.
 * ------------------------------------------------------------------ */

let openHelp = null;

export function helpDot(body, { label = 'What does this mean?', title = null } = {}) {
  const dot = el('button', {
    class: 'help-dot',
    type: 'button',
    'aria-label': label,
    'aria-expanded': 'false',
    onClick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openHelp && openHelp.owner === dot) { openHelp.close(); return; }
      showHelp(dot, body, title, label);
    },
  }, '?');
  return dot;
}

function showHelp(dot, body, title, label) {
  if (openHelp) openHelp.close();

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', close);
    leave(pop);
    dot.setAttribute('aria-expanded', 'false');
    openHelp = null;
    // ⚠️ Focus goes back to the ? that opened it. Without this a keyboard user
    // is returned to the top of the document every time they ask a question.
    if (typeof dot.focus === 'function') dot.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const onOutside = (e) => { if (!pop.contains(e.target) && e.target !== dot) close(); };

  const pop = el('div', {
    class: 'help-pop',
    role: 'dialog',
    'aria-label': title || label,
  },
    title ? el('div', { class: 'help-pop-title', text: title }) : null,
    // A string or a node — a couple of these explanations want a list.
    typeof body === 'string' ? el('p', { class: 'help-pop-body', text: body }) : body,
  );

  document.body.append(pop);
  position(pop, dot);
  dot.setAttribute('aria-expanded', 'true');
  openHelp = { owner: dot, close };

  // ⚠️ `true` on both — capture, so a tap that would otherwise be swallowed by a
  // row's own click handler still closes this first.
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', close);
  if (typeof pop.focus === 'function') { pop.tabIndex = -1; pop.focus(); }
}

/**
 * Under the dot, clamped to the screen.
 *
 * ⚠️ Measured rather than placed by CSS, because the dot can be anywhere — in a
 * header, at the end of a row, beside a legend chip — and a popover that runs
 * off the right edge of a 360px phone is the whole failure mode of this pattern.
 */
function position(pop, dot) {
  const r = dot.getBoundingClientRect();
  const vw = window.innerWidth || 360;
  const vh = window.innerHeight || 640;
  const w = Math.min(pop.offsetWidth || 280, vw - 16);
  pop.style.width = w + 'px';
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, vw - w - 8));
  const h = pop.offsetHeight || 120;
  // Below the dot where there is room, above it where there is not.
  const below = r.bottom + 8;
  const top = (below + h > vh - 8 && r.top - h - 8 > 8) ? r.top - h - 8 : below;
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(Math.min(top, Math.max(8, vh - h - 8))) + 'px';
  // Where the little arrow points, so the box is visibly attached to the ? that
  // opened it rather than appearing from nowhere (Rule 7).
  pop.style.setProperty('--arrow-x', Math.round(r.left + r.width / 2 - left) + 'px');
  pop.classList.toggle('is-above', top < r.top);
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

/**
 * One recorded number, formatted for a screen.
 *
 * 🚨 WEIGHT GOES THROUGH `units`, AND DID NOT UNTIL 2026-09-06. This read
 * `${trimNum(value)} ${m.unit}` with `FIELD_META.weight.unit` hard-coded to
 * 'lbs' — so it printed the STORED pounds figure, labelled lbs, to a reader who
 * had chosen kg and saw kg on every other screen in the app. Not a wrong number:
 * the wrong unit, stated confidently, on a graph somebody reads to decide
 * whether they are getting stronger.
 *
 * ⚠️ EVERY CALLER MUST THEREFORE HAND IT POUNDS, which is the app's one storage
 * rule (units.js) and was already true of both call sites. A caller that
 * converts first would now convert twice.
 *
 * ⚠️ `distance` keeps its hard-coded unit deliberately — miles is the only unit
 * the app stores or shows for it, and there is no setting to disagree with. The
 * day that changes it wants the same treatment, not a second literal.
 */
export function fmtField(field, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const m = FIELD_META[field];
  if (field === 'time') return fmtTime(value);
  if (field === 'distance') return `${Number(value).toFixed(2)} ${m.unit}`;
  if (field === 'weight') return units.withUnit(value);
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
/* ==========================================================================
   BACK MEANS "THE SCREEN YOU WERE JUST ON" — 2026-09-02, Tim.

   *"When you click back on something it should always go to what you were on
   right before. Currently when you click on someone else's workout and then go
   back, it takes you to that user's profile/page rather than back to the home
   menu where you saw the post on."*

   ⚠️ HE IS DESCRIBING ONE SCREEN AND REPORTING A FAULT IN ALL 48. Every
   `screenShell({ back })` in this app hard-codes a PARENT — the calendar for a
   day, Workouts for a workout, the friend for their session — and a parent is
   only the right answer when you arrived from the parent. Reached from
   anywhere else, the back arrow silently moves you sideways in the app and the
   screen you were reading is now two taps away.

   The fix is one function, here, rather than 48 edits: the arrow goes BACK
   through history, and the hard-coded parent survives as the FALLBACK for the
   case history cannot serve — a link opened from outside, a shared URL, the
   first screen of a cold start. So a deep link still lands somewhere sensible
   instead of leaving the site.

   ⚠️ THE POSITION IS STAMPED ON THE HISTORY ENTRY, not counted in a variable.
   A counter cannot tell a forward navigation from the browser's own back
   button — both arrive as one `hashchange` and nothing distinguishes them — so
   it drifts the first time somebody uses the OS gesture, and drifts silently.
   `history.state` travels WITH the entry: an entry that has been visited
   already knows its own index, whichever direction it was reached from.
   ========================================================================== */

let lastIndex = -1;

/* ⚠️ `window.history`, NEVER THE BARE GLOBAL — and this is not defensiveness,
 * it is a bug that already happened. `tests/render.test.mjs` assigns jsdom's
 * window, document and location onto globalThis and does NOT assign `history`,
 * so a bare `history.state` is a ReferenceError there. It throws inside a click
 * handler, where jsdom reports it to its virtual console and carries on — so
 * the back button silently did nothing and one assertion failed with no stack
 * anywhere near the cause. In a browser the two are the same object. */
const hist = () => (typeof window !== 'undefined' && window.history) || null;

/** Stamp the current history entry with its position. Called once per render. */
export function markRoute() {
  const h = hist();
  if (!h) return;
  const state = h.state;
  if (state && typeof state.navIndex === 'number') { lastIndex = state.navIndex; return; }
  lastIndex += 1;
  // `replaceState` rather than `pushState`: the entry already exists — the hash
  // change made it — and this only writes what it is.
  try { h.replaceState({ ...(state || {}), navIndex: lastIndex }, ''); } catch (_) {}
}

/** True when there is a screen of ours behind this one. */
export function canGoBack() {
  const h = hist();
  const state = h && h.state;
  return Boolean(state && typeof state.navIndex === 'number' && state.navIndex > 0);
}

/**
 * The back arrow. Goes to the previous screen, or to `fallback` when this is
 * the first screen this visit.
 */
export function goBack(fallback) {
  if (canGoBack()) { hist().back(); return; }
  if (typeof fallback === 'function') fallback();
}

/**
 * Re-render the CURRENT route, optionally changing the hash without pushing a
 * new entry.
 *
 * ⚠️ THIS REPLACES THE `#/blank` TRICK, and it had to. Nine places did
 * `location.hash = '#/blank'; location.hash = '#/social'` to force a re-render,
 * which pushes TWO history entries — so once back means "the previous entry",
 * pressing it landed on `#/blank`, a route the router deliberately renders
 * nothing for. The arrow would have appeared to do nothing, and the second
 * press would have skipped a screen. Re-rendering in place has neither problem
 * and is what those call sites were describing all along.
 */
export function refreshRoute(hash) {
  if (hash && location.hash !== hash) {
    const h = hist();
    try { h.replaceState(h.state, '', hash); } catch (_) { location.hash = hash; }
  }
  /* ⚠️ `window.Event`, NOT the bare global. Under jsdom the module scope's
   * `Event` is Node's own class and `window.dispatchEvent` rejects it outright
   * — "parameter 1 is not of type 'Event'". In a browser the two are the same
   * object, so this costs nothing and is the only form that works in both. */
  const Ev = (typeof window !== 'undefined' && window.Event) || Event;
  window.dispatchEvent(new Ev('hashchange'));
}

export function screenShell({ title, sub, back, backExact, actions, top, scroll, bottom, body, noNav, profile, down }) {
  const heading = title instanceof Node
    ? el('div', { class: 'topbar-slot' }, title)
    : el('div', { style: 'flex:1;min-width:0' },
        el('h1', { text: title }),
        sub ? el('div', { class: 'topbar-sub', text: sub }) : null,
      );

  const screen = el('div', { class: 'screen' + (noNav ? ' no-nav' : '') },
    el('header', { class: 'topbar' },
      /* Left slot: back where there is somewhere to go back to, otherwise the
       * profile button. Never both — two things competing for the top-left
       * corner is how you get people tapping the wrong one.
       *
       * ⚠️ `back` IS THE FALLBACK, NOT THE DESTINATION (2026-09-02). The arrow
       * goes back through history and only uses this handler when there is no
       * history to go back through. `backExact` opts out for the one screen
       * where the arrow is not a back at all — see the finish screen. */
      /* 🚨 AND SINCE 2026-09-09 THERE IS A THIRD THING THAT CAN SIT THERE: a
       * DOWN arrow, for a screen that arrived by rising over what you were
       * looking at. Tim asked for it on Record — *"a down arrow in the upper
       * left which will push the record section back down"* — and it is not a
       * back arrow wearing a different glyph: back means the screen you were
       * just on (Rule 8), and this one means "put this away", which lands on
       * Home whatever you came from. Naming it `down` rather than reusing
       * `back` is what keeps those two from being confused later. */
      back
        ? iconBtn('left', 'Back', backExact ? back : () => goBack(back))
        : down
          ? iconBtn('down', 'Close', down)
          : (profile ? profileButton() : null),
      heading,
      ...(actions || []),
    ),
    top ? el('div', { class: 'pane-top' }, top) : null,
    el('div', { class: 'pane-scroll' }, scroll || body),
    bottom ? el('div', { class: 'pane-bottom' }, bottom) : null,
  );
  // ⚠️ Here AND in app.js, and the repeat is deliberate: `wireSegmented` is
  // idempotent (it marks the control it has done), this catches every screen
  // however it is mounted — including the ones a test mounts directly — and the
  // router's call catches anything that never came through this function. The
  // measurements are taken again on the next frame, by which time whichever of
  // the two ran first has put the screen in the document.
  wireSegmented(screen);
  return screen;
}
