/* ------------------------------------------------------------------ *
 * Navigation that moves like objects — 2026-09-25, docs/motion2-plan.md
 * package B.
 *
 * Tim: *"I notice the rows slide up when a screen opens but that's it … Put
 * professional level annimation and physics into this cite. Really analyze all
 * the design layouts and everything … Impress me."*
 *
 * WHAT MOVES, AND WHAT EACH MOVEMENT SAYS (Rule 7: it answers "what happened")
 *   · PUSH   a screen you opened slides in from the right OVER the one you
 *            were on, which slips 30% left and dims — it is still there, under.
 *   · BACK   the exact reverse, frame for frame. The router knows which is
 *            which (`markRoute()` stamps every history entry; `navDirection()`).
 *   · TAB    a quick crossfade with a 0.985 → 1 scale and NO direction: tabs
 *            are places, not a stack.
 *   · RISE   Record comes up as a card; the screen behind steps back to 0.94
 *            with rounded corners and dims (phone). FALL is the reverse — the
 *            down arrow, a drag-down, or the OS back button on Record.
 *   · EDGE SWIPE back (phone): the screen follows the finger off the left edge
 *            with the previous screen parallaxed under it, and a flick or half
 *            the width completes it on the same spring.
 *   · THE TAB BAR's selection slides between items (a 3px accent line on a
 *            phone, the selected fill in the laptop sidebar) and a tapped icon
 *            gives a small spring pop. Content never moves on tap.
 *
 * HOW
 *   The router has never had two screens at once (`render()` clears `#app`),
 *   and still does not: the OUTGOING screen is moved out of `#app` into a fixed
 *   "ghost" on <body> before the next view is awaited — so it stays on screen
 *   while the store reads — and the incoming one is moved against it by ONE
 *   progress spring (p: 0 → 1, js/spring.js). Every frame is `frameFor(kind,
 *   p)`, a pure function the tests read. A new navigation mid-movement lands
 *   the old one first (`settleNavigation()`), so nothing ever stacks.
 *   A screen that is left is kept, detached, as a still picture for the back
 *   swipe to show underneath (`snaps`, eight at most).
 *
 * 🛑 NOTHING WHERE NOTHING CAN MOVE: jsdom (no Element.animate) and
 * prefers-reduced-motion build no ghost, no layer, no listener effect — the
 * router behaves exactly as it did, and no other suite ever sees two screens.
 * 🛑 NOTHING INSIDE THE RUNNER (the logging path): session → session never
 * moves, and the edge swipe is off on it. Entering and leaving it may move.
 * ------------------------------------------------------------------ */

import { spring, springTransform, simulate, velocityTracker, rubberBand, reducedMotion } from './spring.js';
import { canGoBack, currentNavIndex } from './ui.js';

/** Which spring each movement rides. All inside Rule 7's physics tier. */
export const NAV_SPRINGS = { push: 'glide', back: 'glide', tab: 'snap', rise: 'sheet', fall: 'sheet' };
export const PARALLAX = 0.3;      // the covered screen slips 30% of the width
export const DESK_SHIFT = 40;     // laptop: a short slide and a fade, not the whole width
export const TAB_SCALE = 0.985;
export const CARD_SCALE = 0.94;   // the screen behind a card
export const CARD_RADIUS = 12;
const LAPTOP_MIN = 860;           // the stylesheet's phone/laptop line
const IND_W = 28;                 // the tab bar's line, px
const SNAP_MAX = 8;
/** The logging path — nothing moves from one of these to the same one. */
const QUIET = ['session', 'edit', 'activity'];

const inBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined'
  && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
/** Can anything move right now? False in jsdom and under reduced motion. */
export function canMove() { return inBrowser() && !reducedMotion(); }
const isPhone = () => (window.innerWidth || 0) < LAPTOP_MIN;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ------------------------------------------------------------------ *
 * Pure parts — what the tests pin
 * ------------------------------------------------------------------ */

/**
 * Which movement a navigation gets.
 * @returns {'push'|'back'|'tab'|'rise'|'fall'|'none'}
 */
export function pickTransition({ dir, from = '', to = '', hasLeaving = false, rising = false, falling = false, hint = null } = {}) {
  if (falling || hint === 'fall') return 'fall';
  if (!hasLeaving) return 'none';
  if (hint === 'back') return 'back';
  if (rising) return 'rise';
  if (!dir || dir === 'replace') return 'none';
  if (from === to && QUIET.includes(to)) return 'none';
  if (dir === 'tab') return 'tab';
  if (dir === 'back') return from === 'record' ? 'fall' : 'back';
  return 'push';
}

const IDLE = { inX: 0, inY: 0, inOpacity: 1, inScale: 1, inRadius: 0, outX: 0, outOpacity: 1, outScale: 1, outRadius: 0, dim: 0 };

/**
 * One frame of a movement at progress p (0 = where it started, 1 = at rest).
 * push/back: `in*` is the screen ARRIVING, `out*` the one leaving.
 * rise/fall: `in*` is the CARD, `out*` the screen behind it.
 * `dim` is 0–1 of the theme's dim strength, over whatever is underneath.
 */
export function frameFor(kind, p, { W = 0, H = 0, phone = true } = {}) {
  const f = { ...IDLE };
  switch (kind) {
    case 'push':
      if (phone) { f.inX = W * (1 - p); f.outX = -PARALLAX * W * p; f.dim = p; }
      else { f.inX = DESK_SHIFT * (1 - p); f.inOpacity = p; f.outX = -DESK_SHIFT * 0.3 * p; f.dim = 0.5 * p; }
      return f;
    case 'back': {
      // The exact reverse: back at p is push at 1−p with the roles swapped.
      const q = frameFor('push', 1 - p, { W, H, phone });
      return { ...f, inX: q.outX, outX: q.inX, outOpacity: q.inOpacity, dim: q.dim };
    }
    case 'tab':
      f.inOpacity = p;
      f.inScale = TAB_SCALE + (1 - TAB_SCALE) * p;
      return f;
    case 'rise':
      f.inY = H * (1 - p);
      // Rounded while it travels, square once it lands: at rest Record is the
      // full screen it always was.
      f.inRadius = CARD_RADIUS * Math.min(1, (1 - p) * 4);
      f.dim = p;
      if (phone) { f.outScale = 1 - (1 - CARD_SCALE) * p; f.outRadius = CARD_RADIUS * p; }
      return f;
    case 'fall':
      return frameFor('rise', 1 - p, { W, H, phone });
    default:
      return f;
  }
}

/** Letting go of a drag: complete it, or spring back? px and px/s. */
export function releaseDecision({ offset = 0, velocity = 0, size = 1 } = {}) {
  if (velocity < -300) return false;          // flicked back the way it came
  if (velocity > 700) return offset > 0;      // a flick completes from anywhere
  return offset + velocity * 0.15 > size * 0.5;
}

/** A card dragged UP resists and never passes 32px. */
export const rubber = (offset) => rubberBand(offset, 32);

/**
 * Where a back swipe may start. In the home-screen app iOS gives no back
 * gesture, so the edge is ours (≤24px). In Safari the very edge is Safari's own
 * swipe, so ours starts past it (20–44px) and the two never fight.
 */
export function edgeZone(x, standalone) {
  return standalone ? x >= 0 && x <= 24 : x > 20 && x <= 44;
}

/* ------------------------------------------------------------------ *
 * Small DOM helpers
 * ------------------------------------------------------------------ */

function setT(node, transform, opacity) {
  if (!node) return;
  node.style.transform = transform;
  if (opacity !== undefined) node.style.opacity = opacity >= 0.999 ? '' : Math.max(0, opacity).toFixed(3);
}
/** Take every class this file added off a node. */
function stripNav(node) {
  if (!node || !node.classList) return;
  for (const c of [...node.classList]) if (c.startsWith('nav-')) node.classList.remove(c);
}
function clearStyle(node) {
  if (!node || !node.style) return;
  node.style.transform = '';
  node.style.opacity = '';
  node.style.borderRadius = '';
  if (node.getAttribute('style') === '') node.removeAttribute('style');
}
const radiusTop = (r) => (r > 0.05 ? `${r.toFixed(2)}px ${r.toFixed(2)}px 0 0` : '');
const radiusAll = (r) => (r > 0.05 ? `${r.toFixed(2)}px` : '');

function place(node, r, flexDir) {
  node.style.left = `${r.left}px`;
  node.style.top = `${r.top}px`;
  node.style.width = `${r.width}px`;
  node.style.height = `${r.height}px`;
  if (flexDir) node.style.flexDirection = flexDir;
}

function readDim(card) {
  try {
    const v = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue(card ? '--nav-card-dim' : '--nav-dim'));
    return Number.isFinite(v) ? v : (card ? 0.35 : 0.25);
  } catch (_) { return 0.25; }
}

/** A dim layer. Inside a ghost it covers the ghost; on <body> it is placed. */
function dimLayer(rect) {
  const d = document.createElement('div');
  d.className = 'nav-dim';
  d.setAttribute('aria-hidden', 'true');
  if (rect) { d.classList.add('nav-dim-fixed'); place(d, rect); }
  return d;
}

const SCROLLERS = '.pane-scroll, .pane-top, .segmented, .chips-scroll, .people-bar, .research-scroll';
function readScroll(rootNode) {
  if (!rootNode.querySelectorAll) return [];
  return [...rootNode.querySelectorAll(SCROLLERS)]
    .map((n) => [n, n.scrollTop, n.scrollLeft]).filter(([, t, l]) => t || l);
}
function writeScroll(list) {
  for (const [n, t, l] of list || []) { n.scrollTop = t; n.scrollLeft = l; }
}

/* ------------------------------------------------------------------ *
 * Ghosts and pictures
 * ------------------------------------------------------------------ */

const ghostInfo = new WeakMap();

/** Move the leaving screen (and the tab bar, when asked) out of #app, as it is. */
function park(app, screen, withNav) {
  const nodes = withNav ? [...app.children] : [screen];
  const r = (withNav ? app : screen).getBoundingClientRect();
  const scroll = readScroll(withNav ? app : screen);
  const g = document.createElement('div');
  g.className = 'screen-ghost nav-ghost';
  g.setAttribute('aria-hidden', 'true');
  g.inert = true;
  place(g, r, withNav ? getComputedStyle(app).flexDirection : null);
  g.append(...nodes);
  document.body.append(g);
  // Moving a node resets its scroll offset; the picture must be where you left it.
  writeScroll(scroll);
  ghostInfo.set(g, { withNav });
  return g;
}

/** navIndex → { node, hash, scroll, withNav }: the screens you left, as pictures. */
const snaps = new Map();
export function __snapshotCount() { return snaps.size; }

function keepSnap(index, hash, ghost) {
  const scroll = readScroll(ghost);
  ghost.remove();
  clearStyle(ghost);
  for (const c of ghost.children) { clearStyle(c); stripNav(c); }
  ghost.className = 'nav-snap';
  const withNav = Boolean(ghost.querySelector(':scope > .navbar'));
  snaps.delete(index);
  snaps.set(index, { node: ghost, hash, scroll, withNav });
  while (snaps.size > SNAP_MAX) snaps.delete(snaps.keys().next().value);
}

/** Put a picture under the live screen, at today's geometry. */
function showSnap(snap, app, screen) {
  const node = snap.node;
  const r = (snap.withNav ? app : screen).getBoundingClientRect();
  place(node, r, snap.withNav ? getComputedStyle(app).flexDirection : null);
  document.body.append(node);
  writeScroll(snap.scroll);
  return node;
}
function blankUnder(rect) {
  const n = document.createElement('div');
  n.className = 'nav-snap';
  n.setAttribute('aria-hidden', 'true');
  place(n, rect);
  document.body.append(n);
  return n;
}
function dropUnder(n) {
  if (!n) return;
  clearStyle(n);
  n.remove();
}

/* ------------------------------------------------------------------ *
 * The movement
 * ------------------------------------------------------------------ */

let active = null;   // the movement in flight: { finish() }
let hint = null;     // a drag that was let go of, waiting for its render

/** Land whatever is moving, now. The router calls this before every render. */
export function settleNavigation() { if (active) active.finish(); }

function dropHint(h) {
  if (!h) return;
  clearTimeout(h.timer);
  dropUnder(h.under);
  if (h.dim) h.dim.remove();
  if (h.screen && h.screen.isConnected) { clearStyle(h.screen); stripNav(h.screen); }
  document.body.classList.remove('nav-card');
}

/* Safari's own edge swipe navigates with its OWN slide; playing ours on top of
 * it would move the screen twice. A back that follows a touch at the very edge
 * is taken to be Safari's and lands without a movement. (Home-screen app: iOS
 * has no such swipe, so this never applies there.) */
let edgeDown = false;
let edgeUpAt = -1e9;
const standalone = () => {
  try {
    return (typeof navigator !== 'undefined' && navigator.standalone === true)
      || Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  } catch (_) { return false; }
};
const nativeSwipe = () => !standalone() && (edgeDown || now() - edgeUpAt < 800);

/**
 * The router is about to build the next screen. Park the one on screen and
 * return the movement, or null when nothing moves. Call `play(screen)` once
 * the new screen is in #app.
 */
export function beginNav({
  dir, from = '', to = '', rising = false, falling = null, leaving = null, app = null,
  parkNav = false, fromIndex = null, fromHash = '',
} = {}) {
  const h = hint;
  hint = null;
  if (h) clearTimeout(h.timer);
  if (!canMove() || !app) { if (falling) falling.remove(); dropHint(h); return null; }
  const hasLeaving = Boolean(leaving && leaving.isConnected);
  const kind = pickTransition({ dir, from, to, rising, falling: Boolean(falling), hasLeaving, hint: h && h.kind });
  if (!h && !falling && hasLeaving && ['back', 'forward', 'tab'].includes(dir) && nativeSwipe()) {
    return { kind: 'still', play(s) { if (s) s.classList.add('nav-still'); }, finish() {} };
  }
  if (kind === 'none' || (!hasLeaving && !falling)) { dropHint(h); return null; }
  const ghost = falling || park(app, leaving, parkNav || kind === 'rise' || kind === 'fall');
  ghost.dataset.navOwned = '1';
  const t = movement(kind, ghost, app, h, {
    fromIndex, fromHash, keep: kind === 'push' || kind === 'tab' || kind === 'rise',
  });
  active = t;
  return t;
}

function movement(kind, ghost, app, h, ctx) {
  const over = kind === 'back' || kind === 'fall';
  const card = kind === 'rise' || kind === 'fall';
  const phone = isPhone();
  ghost.classList.add('nav-ghost', over ? 'nav-over' : 'nav-under', `nav-g-${kind}`);
  const gScreens = [...ghost.children].filter((n) => n.classList && n.classList.contains('screen'));
  // A dragged screen arrives with the finger's offset on it; the ghost carries it from here.
  for (const s of gScreens) { clearStyle(s); stripNav(s); }
  const dims = { W: ghost.offsetWidth || window.innerWidth, H: ghost.offsetHeight || window.innerHeight, phone };
  const dimMax = readDim(card);
  let gDim = null;
  if (kind === 'push' || kind === 'rise') { gDim = dimLayer(null); ghost.append(gDim); }
  let under = h ? h.under : null;
  let uDim = h ? h.dim : null;
  let screen = null;
  let p = h ? clamp01(h.p) : 0;
  const v = h ? h.v : 0;
  let ctl = null;
  let done = false;
  let played = false;
  if (card && phone) document.body.classList.add('nav-card');

  const paint = (x) => {
    const f = frameFor(kind, clamp01(x), dims);
    switch (kind) {
      case 'push':
        setT(screen, f.inX ? `translate3d(${f.inX.toFixed(2)}px,0,0)` : '', f.inOpacity);
        for (const s of gScreens) setT(s, f.outX ? `translate3d(${f.outX.toFixed(2)}px,0,0)` : '');
        if (gDim) gDim.style.opacity = (f.dim * dimMax).toFixed(3);
        break;
      case 'back':
        setT(ghost, f.outX ? `translate3d(${f.outX.toFixed(2)}px,0,0)` : '', f.outOpacity);
        setT(under, f.inX ? `translate3d(${f.inX.toFixed(2)}px,0,0)` : '');
        if (uDim) uDim.style.opacity = (f.dim * dimMax).toFixed(3);
        break;
      case 'tab':
        setT(screen, f.inScale < 0.9999 ? `scale(${f.inScale.toFixed(4)})` : '', f.inOpacity);
        break;
      case 'rise':
        if (screen) {
          setT(screen, f.inY > 0.05 ? `translate3d(0,${f.inY.toFixed(2)}px,0)` : '');
          screen.style.borderRadius = radiusTop(f.inRadius);
        }
        setT(ghost, f.outScale < 0.9999 ? `scale(${f.outScale.toFixed(4)})` : '');
        ghost.style.borderRadius = radiusAll(f.outRadius);
        if (gDim) gDim.style.opacity = (f.dim * dimMax).toFixed(3);
        break;
      case 'fall':
        setT(ghost, f.inY > 0.05 ? `translate3d(0,${f.inY.toFixed(2)}px,0)` : '');
        ghost.style.borderRadius = radiusTop(f.inRadius);
        if (under) {
          setT(under, f.outScale < 0.9999 ? `scale(${f.outScale.toFixed(4)})` : '');
          under.style.borderRadius = radiusAll(f.outRadius);
        }
        if (uDim) uDim.style.opacity = (f.dim * dimMax).toFixed(3);
        break;
      default:
    }
  };

  const cleanup = () => {
    if (done) return;
    done = true;
    if (active === t) active = null;
    if (ctl && ctl.active) ctl.stop();
    if (screen) { clearStyle(screen); stripNav(screen); }
    clearStyle(app);
    app.classList.remove('nav-card-app');
    const bar = app.querySelector(':scope > .navbar');
    if (bar) bar.classList.remove('nav-bar-top');
    document.body.classList.remove('nav-card');
    if (uDim) uDim.remove();
    if (gDim) gDim.remove();
    if (under && under !== screen && under !== app) dropUnder(under);
    for (const s of gScreens) clearStyle(s);
    if (ctx.keep && ctx.fromIndex != null && ctx.fromIndex >= 0 && ghost.isConnected) {
      keepSnap(ctx.fromIndex, ctx.fromHash, ghost);
    } else {
      ghost.remove();
    }
  };

  const t = {
    kind,
    play(next) {
      if (done || played) return;
      played = true;
      clearTimeout(backstop);
      if (!next) { cleanup(); return; }
      screen = next;
      screen.classList.add('nav-moving', `nav-k-${kind}`);
      if (!over) screen.classList.add('nav-high');
      // The tab bar is not part of the stack: it stays put, above the move.
      const bar = app.querySelector(':scope > .navbar');
      if (bar && (kind === 'push' || kind === 'tab')) bar.classList.add('nav-bar-top');
      if (kind === 'back') {
        if (under && under !== screen) dropUnder(under);
        under = screen;
        const r = screen.getBoundingClientRect();
        if (!uDim) { uDim = dimLayer(r); document.body.append(uDim); } else place(uDim, r);
      }
      if (kind === 'fall') {
        if (under && under !== app) dropUnder(under);
        under = phone ? app : null;
        if (phone) app.classList.add('nav-card-app');
        const r = app.getBoundingClientRect();
        if (!uDim) { uDim = dimLayer(r); document.body.append(uDim); } else place(uDim, r);
      }
      paint(p);
      ctl = spring({
        from: p, to: 1, velocity: v, preset: NAV_SPRINGS[kind], precision: 0.0005,
        onUpdate: (x) => { p = x; paint(x); },
        onRest: () => cleanup(),
      });
    },
    /** Land now: the final frame, then tidy. */
    finish() {
      if (done) return;
      if (ctl && ctl.active) ctl.stop();
      paint(1);
      cleanup();
    },
  };
  // A render that never plays (it cannot — play() is called on the error path
  // too) must not leave a second screen in the document for ever.
  const backstop = setTimeout(() => { if (!played) cleanup(); }, 10000);
  paint(p);
  return t;
}

/* ------------------------------------------------------------------ *
 * Scroll: back returns to where you were in the list, too
 * ------------------------------------------------------------------ */

const scrollMemo = new Map();

/** Remember how far down the screen being left was scrolled. */
export function rememberScroll(index, screen) {
  if (index == null || index < 0 || !screen || !screen.querySelector) return;
  const pane = screen.querySelector('.pane-scroll');
  if (!pane) return;
  scrollMemo.delete(index);
  scrollMemo.set(index, pane.scrollTop);
  while (scrollMemo.size > 60) scrollMemo.delete(scrollMemo.keys().next().value);
}

/**
 * Coming back to an entry: put its list where it was. Screens that fill in a
 * beat later (Home, Profile) are tried again as they grow, for up to a second,
 * and a finger on the list ends the attempt — it never fights the reader.
 */
export function restoreScroll(screen, index) {
  const top = scrollMemo.get(index);
  if (!top || !screen || !screen.querySelector) return;
  const pane = screen.querySelector('.pane-scroll');
  if (!pane) return;
  const apply = () => { pane.scrollTop = top; return Math.abs(pane.scrollTop - top) < 2; };
  if (apply()) return;
  const MO = (typeof window !== 'undefined' && window.MutationObserver) || null;
  if (!MO) return;
  let over = false;
  const mo = new MO(() => { if (!over && apply()) end(); });
  function end() {
    over = true;
    mo.disconnect();
    pane.removeEventListener('touchstart', end);
    pane.removeEventListener('wheel', end);
  }
  mo.observe(pane, { childList: true, subtree: true });
  pane.addEventListener('touchstart', end, { passive: true });
  pane.addEventListener('wheel', end, { passive: true });
  setTimeout(end, 1000);
}

/* ------------------------------------------------------------------ *
 * The tab bar: a selection that slides, an icon that pops
 * ------------------------------------------------------------------ */

const inds = new WeakMap();

function drawInd(s, k) {
  s.ind.style.transform = s.mode === 'desk'
    ? `translate3d(0,${s.x.toFixed(2)}px,0) scaleY(${k.toFixed(3)})`
    : `translate3d(${s.x.toFixed(2)}px,0,0) scaleX(${k.toFixed(3)})`;
}
/** It stretches along its path while it moves, in proportion to its speed. */
function stretchOf(s) {
  const v = s.ctl ? Math.abs(s.ctl.velocity) : 0;
  return s.mode === 'desk' ? 1 + Math.min(0.12, v / 6000) : 1 + Math.min(0.6, v / 2500);
}

/**
 * Put the selection under the lit tab — sliding there from wherever it was if
 * this is the same bar as last time, placed outright if it is a new one.
 * On a phone the big Record button carries its own filled look, so the line
 * steps aside rather than sitting under the hub.
 */
export function syncTabIndicator(nav) {
  if (!nav || !inBrowser() || !nav.isConnected) return;
  let s = inds.get(nav);
  const fresh = !s;
  if (!s) {
    const ind = document.createElement('span');
    ind.className = 'nav-ind';
    ind.setAttribute('aria-hidden', 'true');
    nav.prepend(ind);
    nav.classList.add('has-ind');
    s = { ind, x: 0, ctl: null, mode: null, shown: false };
    inds.set(nav, s);
  }
  const mode = isPhone() ? 'phone' : 'desk';
  const on = nav.querySelector(':scope > a[aria-current="page"]');
  const show = Boolean(on) && !(mode === 'phone' && on.classList.contains('nav-primary'));
  s.ind.style.opacity = show ? '' : '0';
  if (!on) { s.shown = false; return; }
  let target;
  if (mode === 'desk') {
    s.ind.style.left = `${on.offsetLeft}px`;
    s.ind.style.width = `${on.offsetWidth}px`;
    s.ind.style.height = `${on.offsetHeight}px`;
    target = on.offsetTop;
  } else {
    s.ind.style.left = '';
    s.ind.style.width = '';
    s.ind.style.height = '';
    target = on.offsetLeft + on.offsetWidth / 2 - IND_W / 2;
  }
  const jump = fresh || s.mode !== mode || !s.shown || !show || !canMove();
  s.mode = mode;
  s.shown = show;
  if (jump) {
    if (s.ctl && s.ctl.active) s.ctl.stop();
    s.x = target;
    drawInd(s, 1);
    return;
  }
  if (s.ctl && s.ctl.active) { s.ctl.set(target); return; }
  s.ctl = spring({
    from: s.x, to: target, preset: 'glide', precision: 0.25,
    onUpdate: (x) => { s.x = x; drawInd(s, stretchOf(s)); },
  });
}

const PRESS_SCALE = 0.86;
const POP_PEAK = 1.07;
/** The kick that makes a released icon peak at POP_PEAK — solved from the
 *  spring itself, so retuning `bounce` cannot change the pop. */
const POP_KICK = (() => {
  const peak = (k) => Math.max(...simulate({ from: PRESS_SCALE, to: 1, velocity: k, preset: 'bounce', ms: 300 }).map((x) => x.x));
  let lo = 0; let hi = 20;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (peak(mid) < POP_PEAK) lo = mid; else hi = mid; }
  return lo;
})();

function onPress(e) {
  const a = e.target && e.target.closest && e.target.closest('.navbar > a');
  if (!a || !canMove()) return;
  const glyph = a.querySelector('svg');
  if (!glyph) return;
  springTransform(glyph, { scale: PRESS_SCALE }, 'snap');
  const release = () => {
    document.removeEventListener('pointerup', release, true);
    document.removeEventListener('pointercancel', release, true);
    springTransform(glyph, { scale: 1 }, 'bounce', { velocity: { scale: POP_KICK } });
  };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
}

/* ------------------------------------------------------------------ *
 * Gestures: the edge swipe back, and Record's drag-down
 * ------------------------------------------------------------------ */

let opts = { isTabRoot: () => false, route: () => '' };
let track = null;

const backButton = (screen) => screen.querySelector('.topbar > .icon-btn[aria-label="Back"]');
const closeButton = (screen) => screen.querySelector('.topbar > .icon-btn[aria-label="Close"]');
const point = (e) => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || null;

function onStart(e) {
  const t = point(e);
  if (t) {
    const W = window.innerWidth || 0;
    if (t.clientX < 20 || t.clientX > W - 20) edgeDown = true;
  }
  if (track && track.started) return;          // a second finger does not restart it
  track = null;
  if (!t || (e.touches && e.touches.length !== 1) || !canMove() || active || hint || !isPhone()) return;
  const screen = e.target && e.target.closest && e.target.closest('#app > .screen');
  if (!screen || e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const route = opts.route();
  const x = t.clientX;
  const y = t.clientY;
  if (edgeZone(x, standalone()) && route !== 'session' && route !== 'record'
      && canGoBack() && !opts.isTabRoot(location.hash)) {
    const btn = backButton(screen);
    if (btn) track = { type: 'edge', x0: x, y0: y, screen, btn, vt: velocityTracker(), started: false, off: 0 };
  } else if (route === 'record') {
    const btn = closeButton(screen);
    if (btn) {
      track = {
        type: 'card', x0: x, y0: y, screen, btn, vt: velocityTracker(), started: false, off: 0,
        scroller: e.target.closest('.pane-scroll'),
        sideways: e.target.closest('.segmented, .chips-scroll, .people-bar, .research-scroll'),
      };
    }
  }
  if (track) track.vt.add({ x, y, t: now() });
}

function onMove(e) {
  if (!track) return;
  const t = point(e);
  if (!t) return;
  const dx = t.clientX - track.x0;
  const dy = t.clientY - track.y0;
  track.vt.add({ x: t.clientX, y: t.clientY, t: now() });
  if (!track.started) {
    if (track.type === 'edge') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (dx > 0 && dx > Math.abs(dy) * 1.2) startEdge(dx);
      else { track = null; return; }
    } else {
      if (track.scroller && track.scroller.scrollTop > 0) { track = null; return; }
      if (Math.abs(dx) > Math.abs(dy) + 4 || dy < -6) { track = null; return; }
      // At the top of the list and pulling down: this is the card, not a
      // scroll — stop the page's own bounce from starting under the finger.
      if (dy > 0 && e.cancelable) e.preventDefault();
      if (dy < 10) return;
      startCard(dy);
    }
  }
  if (e.cancelable) e.preventDefault();
  if (track.type === 'edge') moveEdge(dx); else moveCard(dy - track.slop);
}

function onEnd() {
  if (edgeDown) { edgeDown = false; edgeUpAt = now(); }
  const tr = track;
  track = null;
  if (!tr || !tr.started) return;
  const { vx, vy } = tr.vt.get();
  if (tr.type === 'edge') endEdge(tr, vx); else endCard(tr, vy);
}

/* ---- edge swipe ---- */

function startEdge(dx) {
  const s = track.screen;
  const app = s.parentElement;
  const snap = snaps.get(currentNavIndex() - 1);
  const r = s.getBoundingClientRect();
  const under = snap ? showSnap(snap, app, s) : blankUnder(r);
  const dim = dimLayer(r);
  dim.classList.add('nav-dim-swipe');
  document.body.append(dim);
  s.classList.add('nav-moving', 'nav-high', 'nav-k-edge');
  track.g = { W: s.offsetWidth || window.innerWidth, under, dim, dimMax: readDim(false) };
  track.started = true;
  track.slop = 0;
  paintEdge(track, Math.max(0, dx));
}

function paintEdge(tr, x) {
  const { W, under, dim, dimMax } = tr.g;
  tr.off = x;
  const f = frameFor('back', clamp01(x / W), { W, phone: true });
  setT(tr.screen, x > 0.05 ? `translate3d(${x.toFixed(2)}px,0,0)` : '');
  setT(under, `translate3d(${f.inX.toFixed(2)}px,0,0)`);
  dim.style.opacity = (f.dim * dimMax).toFixed(3);
}

function moveEdge(dx) { paintEdge(track, Math.max(0, dx)); }

function endEdge(tr, vx) {
  const { W } = tr.g;
  if (releaseDecision({ offset: tr.off, velocity: vx, size: W })) {
    const h = { kind: 'back', p: tr.off / W, v: Math.max(0, vx) / W, under: tr.g.under, dim: tr.g.dim, screen: tr.screen };
    h.timer = setTimeout(() => { if (hint === h) { hint = null; dropHint(h); } }, 1500);
    hint = h;
    tr.btn.click();
    return;
  }
  springHome(tr, vx / W, (x) => paintEdge(tr, x * W), tr.off / W, 'glide');
}

/* ---- Record's card ---- */

function homeSnap(app) {
  const list = [...snaps.values()].reverse();
  const prev = snaps.get(currentNavIndex() - 1);
  if (prev && prev.hash === '#/home') return prev;
  return list.find((s) => s.hash === '#/home' && s.withNav)
    || list.find((s) => s.hash === '#/home') || prev || null;
}

function startCard(dy) {
  const s = track.screen;
  const app = s.parentElement;
  const snap = homeSnap(app);
  const r = app.getBoundingClientRect();
  const under = snap ? showSnap({ ...snap, withNav: true }, app, s) : blankUnder(r);
  const dim = dimLayer(r);
  dim.classList.add('nav-dim-swipe');
  document.body.append(dim);
  document.body.classList.add('nav-card');
  s.classList.add('nav-moving', 'nav-high', 'nav-k-card');
  track.g = { H: app.offsetHeight || window.innerHeight, under, dim, dimMax: readDim(true) };
  track.started = true;
  track.slop = dy;        // the card starts from where the finger was when it was taken
  paintCard(track, 0);
}

function paintCard(tr, y) {
  const { H, under, dim, dimMax } = tr.g;
  tr.off = y;
  const shown = y >= 0 ? y : rubber(y);
  const f = frameFor('fall', clamp01(y / H), { H, phone: true });
  setT(tr.screen, Math.abs(shown) > 0.05 ? `translate3d(0,${shown.toFixed(2)}px,0)` : '');
  tr.screen.style.borderRadius = radiusTop(y > 0 ? f.inRadius : 0);
  setT(under, `scale(${f.outScale.toFixed(4)})`);
  under.style.borderRadius = radiusAll(f.outRadius);
  dim.style.opacity = (f.dim * dimMax).toFixed(3);
}

function moveCard(dy) { paintCard(track, dy); }

function endCard(tr, vy) {
  const { H } = tr.g;
  if (tr.off > 0 && releaseDecision({ offset: tr.off, velocity: vy, size: H * 0.7 })) {
    const h = { kind: 'fall', p: tr.off / H, v: Math.max(0, vy) / H, under: tr.g.under, dim: tr.g.dim, screen: tr.screen };
    h.timer = setTimeout(() => { if (hint === h) { hint = null; dropHint(h); } }, 1500);
    hint = h;
    // The down arrow's own handler: it drops the card and knows where it lands.
    tr.btn.click();
    return;
  }
  springHome(tr, vy / H, (x) => paintCard(tr, x * H), tr.off / H, 'sheet');
}

/* ---- letting go without completing: back where it started, on a spring ---- */

function springHome(tr, v, draw, from, preset) {
  let ctl = null;
  let over = false;
  const tidy = () => {
    if (over) return;
    over = true;
    if (active === holder) active = null;
    dropUnder(tr.g.under);
    tr.g.dim.remove();
    clearStyle(tr.screen);
    stripNav(tr.screen);
    document.body.classList.remove('nav-card');
  };
  const holder = { kind: 'cancel', finish() { if (ctl && ctl.active) ctl.stop(); tidy(); } };
  active = holder;
  ctl = spring({
    from, to: 0, velocity: v, preset, precision: 0.0005,
    onUpdate: (x) => draw(x),
    onRest: tidy,
  });
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

let wired = false;

/**
 * Listen for the gestures and the tab presses. `isTabRoot(hash)` says which
 * screens have no back (the tab roots); `route()` names the route on screen.
 */
export function initGestures(o = {}) {
  if (!inBrowser() || wired) return;
  wired = true;
  opts = { ...opts, ...o };
  document.addEventListener('touchstart', onStart, { passive: true });
  // ⚠️ NOT passive: a swipe that has been taken must stop the page scrolling
  // under it, and only a non-passive listener may call preventDefault().
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onEnd, { passive: true });
  document.addEventListener('pointerdown', onPress, { passive: true });
  window.addEventListener('resize', () => {
    const nav = document.querySelector('#app > .navbar');
    const s = nav && inds.get(nav);
    if (s) { s.mode = null; syncTabIndicator(nav); }
  });
}
