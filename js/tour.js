// The first-run tour — 2026-09-25, part B of docs/onboarding-plan.md.
//
// Tim: *"when a user first joins, the cite will give them a tour (which they can
// skip), but will automatically show them every part of the cite and how to use
// it. It will be like buttons popping up pointing to different parts of the cite
// and if they click "next" it will automatically bring them to the next part of
// the tour. Make sure the annimations and everythign are clean for the tour."*
//
// A dimmed page with a rounded hole cut around one thing, a small bubble with an
// arrow at it, Back · Next and Skip. Next changes route when the next stop lives
// on another screen, waits for the thing to exist, and the hole GLIDES there.
//
// ⚠️ IT ONLY LOOKS. The page under the dim is inert (a click catcher sits over
// it) and the tour navigates with `location.hash` alone, so it cannot create,
// change or delete anything a person owns — the runner stop points at the door
// to the runner rather than opening a workout, because opening one makes a draft.
//
// ⚠️ ONE STATIC IMPORT, js/spring.js, which itself imports nothing and touches
// no DOM at load — so the stop list and the placement maths can still be tested
// in plain Node (tests/tour.test.mjs). The end card's workout comes from
// js/store.js through a dynamic import, inside startTour() only.
//
// 🆕 MOTION 2 (2026-09-25, docs/motion2-plan.md package E) — Tim: *"Put
// professional level annimation and physics into this cite."* The hole used
// to glide on a CSS transition; it now moves on four springs (x, y, width,
// height). A spring keeps its speed when retargeted, so a quick Next · Next
// bends the hole's path toward the newer stop instead of restarting it.

import { spring } from './spring.js';

export const TOUR_KEY = 'ftrack:v1:toured';

const nav = (hash) => `.navbar a[href="${hash}"]`;

/* The stops, in order. `targets` are tried in order; the first is the thing the
 * words are about, the later ones are fallbacks (usually the tab itself) for an
 * account whose screen has not got that thing. `route` is where the stop lives;
 * a stop whose route is the current one does not navigate. Words ≤ 15 each. */
/* 🔄 FIVE STOPS SINCE 2026-09-27 (overhaul O-10), from eight. Home pointed at an
 * empty feed, the runner stop taught ± on the Record chooser (the runner now
 * teaches itself the first time it opens — `hintOnce` below), Data said "tap
 * one" over an empty map, and Settings was pointed at from the Account screen. */
export const STOPS = [
  { id: 'workouts', route: '#/workouts',
    targets: ['.sys-head', '.pane-top .btn.primary', nav('#/workouts')],
    text: 'Your program. Tap its name to switch or find more.' },
  { id: 'record', route: '#/workouts',
    targets: ['.navbar .nav-primary'],
    text: 'Record starts a workout, a run, or any activity.' },
  { id: 'data', route: '#/graphs',
    targets: ['.body-wrap', nav('#/graphs')],
    text: 'How strong each muscle is. Fills in as you log.' },
  { id: 'profile', route: '#/me',
    targets: ['.me-head', nav('#/me')],
    text: 'What you did: workouts, best lifts, calendar.' },
  { id: 'account', route: '#/me',
    targets: ['.avatar-btn'],
    text: 'Your account, settings and this tour.' },
];

/* The end card. With a program, its one button starts the first workout
 * (`Start <name>` → #/session/<id>, found at the card — endAction()); with none,
 * it is `Done`. */
export const END = { title: 'You’re set', text: 'That’s everything. Go log your first workout.', done: 'Done' };

/** The end card's button: "Start Full Body A" when there is a workout, else "Done". */
export function endLabel(workout) {
  return workout && workout.name ? `Start ${workout.name}` : END.done;
}

export const GUTTER = 16;      // the bubble never comes closer than this to an edge
export const GAP = 12;         // between the hole and the bubble (the arrow sits in it)
export const SPOT_PAD = 6;     // the hole is this much bigger than the thing
const ARROW_INSET = 18;        // the arrow never sits closer than this to a bubble corner
const WAIT_MS = 3000;          // a stop whose thing never appears is skipped
const PREFER_MS = 1200;        // how long the first target gets before a fallback counts

/* ------------------------------------------------------------------ *
 * The seen flag
 * ------------------------------------------------------------------ */

export function hasToured(storage = globalThis.localStorage) {
  try { return storage.getItem(TOUR_KEY) === '1'; } catch (_) { return false; }
}

export function markToured(storage = globalThis.localStorage) {
  try { storage.setItem(TOUR_KEY, '1'); } catch (_) { /* private mode: it shows again, harmless */ }
}

/* ------------------------------------------------------------------ *
 * Placement maths — pure, so it is tested without a browser
 * ------------------------------------------------------------------ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The hole: the thing's box plus padding, cut to what is actually visible
 *  (`clip` — its scroller, or the window) so a tall card cannot dim the tab bar
 *  out from under the hole or run off the screen. */
export function spotRect(target, viewport, clip = null, pad = SPOT_PAD) {
  const c = clip || { x: 0, y: 0, w: viewport.w, h: viewport.h };
  const left = Math.max(target.x - pad, c.x, 2);
  const top = Math.max(target.y - pad, c.y, 2);
  const right = Math.min(target.x + target.w + pad, c.x + c.w, viewport.w - 2);
  const bottom = Math.min(target.y + target.h + pad, c.y + c.h, viewport.h - 2);
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

/** Where the bubble goes: under the hole if it fits, over it if not, and ON the
 *  hole's lower edge (no arrow) when neither fits — a target taller than the
 *  screen. Always inside the 16px gutters. `arrowX` is from the bubble's left. */
export function placeBubble(spot, bubble, viewport, gutter = GUTTER, gap = GAP) {
  const bw = Math.min(bubble.w, viewport.w - gutter * 2);
  const below = viewport.h - gutter - (spot.y + spot.h + gap);
  const above = spot.y - gap - gutter;
  let side, y;
  if (below >= bubble.h) { side = 'below'; y = spot.y + spot.h + gap; }
  else if (above >= bubble.h) { side = 'above'; y = spot.y - gap - bubble.h; }
  else { side = 'over'; y = spot.y + spot.h - bubble.h - gutter; }
  y = clamp(y, gutter, Math.max(gutter, viewport.h - gutter - bubble.h));
  const centre = spot.x + spot.w / 2;
  const x = clamp(centre - bw / 2, gutter, Math.max(gutter, viewport.w - gutter - bw));
  const arrowX = clamp(centre - x, ARROW_INSET, Math.max(ARROW_INSET, bw - ARROW_INSET));
  return { x, y, w: bw, side, arrowX };
}

/** "3 of 8" */
export function counter(index, total = STOPS.length) {
  return `${index + 1} of ${total}`;
}

/* ------------------------------------------------------------------ *
 * The tour itself (browser only)
 * ------------------------------------------------------------------ */

let active = null;

const reduced = () => Boolean(globalThis.matchMedia
  && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
const cssMs = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  } catch (_) { return fallback; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

function mk(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function visible(node) {
  if (!node || !node.isConnected) return false;
  const r = node.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const cs = getComputedStyle(node);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

function sameHash(a, b) {
  const norm = (h) => (h || '').replace(/^#\/?/, '') || 'home';
  return norm(a) === norm(b);
}

/** The first visible match of the stop's targets. The first target gets
 *  PREFER_MS to render (Home's feed fills in after its shell) before a
 *  fallback may stand in; nothing at all by WAIT_MS skips the stop. */
async function findTarget(stop, token) {
  const start = Date.now();
  for (;;) {
    if (token.dead) return null;
    const first = [...document.querySelectorAll(stop.targets[0])].find(visible);
    if (first) return first;
    if (Date.now() - start > PREFER_MS) {
      for (const sel of stop.targets.slice(1)) {
        const hit = [...document.querySelectorAll(sel)].find(visible);
        if (hit) return hit;
      }
    }
    if (Date.now() - start > WAIT_MS) return null;
    await sleep(60);
  }
}

// The scroller a target sits in, if any: the hole is cut to what it shows.
function clipOf(node) {
  const pane = node.closest('.pane-scroll');
  if (!pane) return null;
  const r = pane.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function rectOf(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** A screen arrives with a rise (and Record with a slide up), so a box measured
 *  in its first frames is wrong. Wait until it holds still for three frames. */
async function settle(node, token) {
  let last = null, still = 0;
  const t0 = Date.now();
  while (!token.dead && Date.now() - t0 < 900) {
    await frame();
    const r = rectOf(node);
    if (last && Math.abs(r.x - last.x) < 0.5 && Math.abs(r.y - last.y) < 0.5
        && Math.abs(r.w - last.w) < 0.5 && Math.abs(r.h - last.h) < 0.5) {
      if (++still >= 3) return;
    } else still = 0;
    last = r;
  }
}

/** Off-screen (or hidden under its pane's edge)? Scroll it into view first. */
async function reveal(node, token) {
  const vp = { w: innerWidth, h: innerHeight };
  const r = rectOf(node);
  const c = clipOf(node) || { x: 0, y: 0, w: vp.w, h: vp.h };
  const inside = r.y >= c.y - 1 && r.y + Math.min(r.h, c.h) <= c.y + c.h + 1;
  if (inside) return;
  try {
    node.scrollIntoView({ block: r.h > c.h ? 'start' : 'center', behavior: reduced() ? 'auto' : 'smooth' });
  } catch (_) { node.scrollIntoView(); }
  await settle(node, token);
}

/**
 * Start the tour. Idempotent: a second call while one is showing does nothing
 * and returns the same promise, which settles when the tour closes.
 */
export function startTour() {
  if (active) return active.done;
  if (typeof document === 'undefined') return Promise.resolve();
  markToured();

  const token = { dead: false };
  const origin = location.hash || '#/home';
  // The end card's workout, looked up while the stops run. A dynamic import so
  // this module still loads in plain Node (the tests) — the store is browser-side.
  let firstWorkout = null;
  import('./store.js').then(async ({ store }) => {
    const sys = await store.currentSystem();
    if (!sys) return;
    const ws = await store.getWorkouts(sys.id);
    firstWorkout = (ws || []).find((w) => w && w.id && w.exercises && w.exercises.length) || null;
    if (index >= STOPS.length && !token.dead) nextBtn.textContent = endLabel(firstWorkout);
  }).catch(() => { /* no program to offer: the card says Done */ });
  let index = 0;
  let target = null;
  let busy = false;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const root = mk('div', 'tour');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'App tour');
  const block = mk('div', 'tour-block');
  const spot = mk('div', 'tour-spot');
  const bubble = mk('div', 'tour-bubble');
  const arrow = mk('div', 'tour-arrow');
  const title = mk('div', 'tour-title');
  const text = mk('p', 'tour-text');
  text.setAttribute('aria-live', 'polite');
  const count = mk('span', 'tour-count');
  const skipBtn = mk('button', 'tour-skip', 'Skip');
  const backBtn = mk('button', 'btn small', 'Back');
  const nextBtn = mk('button', 'btn primary small', 'Next');
  [skipBtn, backBtn, nextBtn].forEach((b) => { b.type = 'button'; });
  const foot = mk('div', 'tour-foot');
  foot.append(count, skipBtn, backBtn, nextBtn);
  bubble.append(arrow, title, text, foot);
  root.append(block, spot, bubble);

  const vp = () => ({ w: innerWidth, h: innerHeight });

  /* The hole, on springs. `animate` false (first placement, a resize, a late
   * re-render — `instantly()`) puts it there at once; true springs it from
   * wherever it is now, keeping any speed it already has. */
  const SPOT_KEYS = ['x', 'y', 'w', 'h'];
  const spotNow = { x: 0, y: 0, w: 0, h: 0 };
  const spotSprings = {};
  function writeSpot() {
    spot.style.transform = `translate(${spotNow.x.toFixed(1)}px, ${spotNow.y.toFixed(1)}px)`;
    spot.style.width = `${Math.max(0, spotNow.w).toFixed(1)}px`;
    spot.style.height = `${Math.max(0, spotNow.h).toFixed(1)}px`;
  }
  function placeSpot(rect, animate = false, preset = 'glide') {
    for (const k of SPOT_KEYS) {
      const s = spotSprings[k];
      if (!animate) {
        if (s && s.active) s.stop();
        spotNow[k] = rect[k];
        continue;
      }
      if (s && s.active) { s.set(rect[k]); continue; }
      spotSprings[k] = spring({
        from: spotNow[k], to: rect[k], preset, precision: 0.3,
        onUpdate: (v) => { spotNow[k] = v; writeSpot(); },
      });
    }
    writeSpot();
  }

  /* 🆕 A STOP ON ANOTHER SCREEN: THE HOLE SHUTS, THEN OPENS THERE (2026-09-25,
   * motion review). Gliding across a route change left the old hole — a
   * lit cut-out over the old tab — sitting on the new screen while it rose
   * (150–300ms, WebKit 393px). Now the hole closes to a point on its own
   * centre (full dim) BEFORE the hash changes, and springs open from the new
   * thing's centre once that has held still. Waits until the hole is too
   * small to see, not for the spring's last half-pixel. */
  async function shutHole() {
    const c = { x: spotNow.x + spotNow.w / 2, y: spotNow.y + spotNow.h / 2, w: 0, h: 0 };
    if (reduced()) { placeSpot(c); return; }
    placeSpot(c, true, 'snap');
    const t0 = Date.now();
    while (!token.dead && (spotNow.w > 3 || spotNow.h > 3)
        && SPOT_KEYS.some((k) => spotSprings[k] && spotSprings[k].active) && Date.now() - t0 < 600) {
      await frame();
    }
  }
  function openHole(hole) {
    placeSpot({ x: hole.x + hole.w / 2, y: hole.y + hole.h / 2, w: 0, h: 0 });
    placeSpot(hole, true);
  }

  // The hole over the target, measured now.
  function holeFor(node) {
    return spotRect(rectOf(node), vp(), clipOf(node));
  }

  // The hole closed to a point in the middle: the end card, full dim.
  function closedHole() {
    const v = vp();
    return { x: v.w / 2, y: v.h / 2, w: 0, h: 0 };
  }

  function placeBubbleAt(hole, final) {
    const v = vp();
    bubble.style.width = `${Math.min(320, v.w - GUTTER * 2)}px`;
    const size = { w: bubble.offsetWidth, h: bubble.offsetHeight };
    if (final) {
      bubble.dataset.side = 'center';
      bubble.style.left = `${Math.round((v.w - size.w) / 2)}px`;
      bubble.style.top = `${Math.round((v.h - size.h) / 2)}px`;
      return;
    }
    const p = placeBubble(hole, size, v);
    bubble.dataset.side = p.side;
    bubble.style.left = `${Math.round(p.x)}px`;
    bubble.style.top = `${Math.round(p.y)}px`;
    arrow.style.left = `${Math.round(p.arrowX)}px`;
  }

  function fillBubble(i) {
    const final = i >= STOPS.length;
    title.textContent = final ? END.title : '';
    title.hidden = !final;
    text.textContent = final ? END.text : STOPS[i].text;
    count.textContent = final ? '' : counter(i);
    skipBtn.hidden = final;
    backBtn.hidden = i === 0;
    nextBtn.textContent = final ? endLabel(firstWorkout) : 'Next';
  }

  // Move without animating (first placement, a resize, a late re-render).
  function instantly(fn) {
    root.classList.add('tour-instant');
    fn();
    void root.offsetWidth;
    root.classList.remove('tour-instant');
  }

  async function hideBubble() {
    if (!bubble.classList.contains('is-shown')) return;
    bubble.classList.remove('is-shown');
    if (!reduced()) await sleep(cssMs('--t', 170));
  }

  function showBubble() {
    void bubble.offsetWidth;
    bubble.classList.add('is-shown');
    try { nextBtn.focus({ preventScroll: true }); } catch (_) { nextBtn.focus(); }
  }

  /** Go to stop `i` (STOPS.length = the end card). `dir` is +1 or -1, which is
   *  the way a stop that never appears is skipped. */
  async function go(i, dir, first = false) {
    if (busy || token.dead) return;
    busy = true;
    try {
      let crossed = false;   // this Next changed screen, so the hole is shut
      for (;;) {
        const final = i >= STOPS.length;
        const hiding = hideBubble();
        if (final) {
          target = null;
          await hiding;
          fillBubble(i);
          if (!root.classList.contains('is-on')) {
            // Every stop failed to appear: the end card is the first thing shown.
            instantly(() => { placeSpot(closedHole()); placeBubbleAt(null, true); });
            root.classList.add('is-on');
          } else {
            placeSpot(closedHole(), true);
            placeBubbleAt(null, true);
          }
          if (!reduced()) await sleep(cssMs('--t-slow', 240));
          index = i;
          showBubble();
          return;
        }
        const stop = STOPS[i];
        if (stop.route && !sameHash(location.hash, stop.route)) {
          // The words leave BEFORE the screen changes: a heavy screen can hold
          // the main thread for a few hundred ms, and the old bubble would sit
          // frozen over the new page for all of it (measured on Data). The
          // hole shuts with them (shutHole), so nothing of the old stop is
          // left drawn over the screen arriving.
          await Promise.all([hiding, crossed || first ? null : shutHole()]);
          if (token.dead) return;
          crossed = true;
          location.hash = stop.route;
        }
        const node = await findTarget(stop, token);
        if (token.dead) return;
        if (!node) {
          // Never appeared: skip it the way we were going, or stop at the start.
          const nextI = i + dir;
          if (nextI < 0) {
            // Going back and nothing before it appeared: stay where we were.
            await hiding;
            if (target) {
              location.hash = STOPS[index].route;
              // The hole was shut for the trip: open it on the stop we stayed on.
              const back = crossed ? await findTarget(target.stop, token) : null;
              if (token.dead) return;
              if (back) {
                await settle(back, token);
                target.node = back;
                const h = holeFor(back);
                openHole(h);
                placeBubbleAt(h, false);
              }
            }
            showBubble();
            return;
          }
          i = nextI;
          continue;
        }
        await settle(node, token);
        await reveal(node, token);
        await hiding;
        if (token.dead) return;
        target = { node, stop };
        index = i;
        fillBubble(i);
        const hole = holeFor(node);
        if (first) {
          instantly(() => { placeSpot(hole); placeBubbleAt(hole, false); });
          void root.offsetWidth;
          root.classList.add('is-on');
          if (!reduced()) await sleep(cssMs('--t', 170));
        } else {
          if (crossed && !reduced()) openHole(hole); else placeSpot(hole, true);
          placeBubbleAt(hole, false);
          if (!reduced()) await sleep(cssMs('--t-slow', 240));
        }
        showBubble();
        return;
      }
    } finally { busy = false; }
  }

  // The thing under the hole was re-rendered or the window changed size: find
  // it again and put the hole back on it without a glide.
  let remeasureTimer = null;
  function remeasure() {
    clearTimeout(remeasureTimer);
    remeasureTimer = setTimeout(() => {
      if (token.dead || busy) return;
      if (index >= STOPS.length) {
        instantly(() => { placeSpot(closedHole()); placeBubbleAt(null, true); });
        return;
      }
      if (!target) return;
      let node = target.node;
      if (!visible(node)) {
        node = target.stop.targets.map((s) => [...document.querySelectorAll(s)].find(visible))
          .find(Boolean);
        if (!node) return;
        target.node = node;
      }
      const hole = holeFor(node);
      instantly(() => { placeSpot(hole); placeBubbleAt(hole, false); });
    }, 90);
  }
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(remeasure) : null;

  function close(finished, dest = null) {
    if (token.dead) return;
    token.dead = true;
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', remeasure);
    removeEventListener('orientationchange', remeasure);
    if (observer) observer.disconnect();
    clearTimeout(remeasureTimer);
    root.classList.remove('is-on');
    root.classList.add('is-leaving');
    // "Start <workout>" goes to that workout; anything else goes back to where
    // the tour began.
    const to = dest || origin;
    const back = !sameHash(location.hash, to);
    const finish = () => {
      root.remove();
      active = null;
      resolveDone({ finished });
    };
    if (back) location.hash = to;
    if (reduced()) finish(); else setTimeout(finish, cssMs('--t', 170));
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); nextBtn.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); if (!backBtn.hidden) backBtn.click(); }
  }

  nextBtn.addEventListener('click', () => {
    if (busy) return;
    if (index >= STOPS.length) close(true, firstWorkout ? '#/session/' + firstWorkout.id : null);
    else go(index + 1, +1);
  });
  backBtn.addEventListener('click', () => { if (!busy && index > 0) go(Math.min(index, STOPS.length) - 1, -1); });
  skipBtn.addEventListener('click', () => close(false));
  // Nothing under the dim is reachable while the tour is up.
  block.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

  document.body.append(root);
  addEventListener('keydown', onKey, true);
  addEventListener('resize', remeasure);
  addEventListener('orientationchange', remeasure);
  const app = document.getElementById('app');
  if (observer && app) observer.observe(app, { childList: true, subtree: true });

  active = { done };
  go(0, +1, true);
  return done;
}

/* ------------------------------------------------------------------ *
 * One-time hints (overhaul O-11, 2026-09-27)
 *
 * The lesson the tour no longer gives lands where it is used: a tour-style
 * bubble beside one thing, the FIRST time it is on screen, once per browser.
 * No dim and nothing blocked — the page under it stays usable, and any tap
 * outside the bubble, a route change or Escape puts it away. The runner calls
 *   hintOnce('ftrack:v1:hint-runner', '<first set row>', 'Set the weight with ±, then tap Finished.')
 * ------------------------------------------------------------------ */

/**
 * Show `text` beside the first visible match of `selector`, unless `key` says
 * it was shown before. Waits up to 3 s for the thing to appear; if it never
 * does, nothing is marked and the hint gets another chance next time.
 * Never over the tour. Resolves true when shown, false when not.
 */
export async function hintOnce(key, selector, text, { storage = globalThis.localStorage, wait = WAIT_MS } = {}) {
  if (typeof document === 'undefined' || !key || !selector || !text) return false;
  try { if (storage.getItem(key)) return false; } catch (_) { return false; }
  if (active || document.querySelector('.tour-hint')) return false;
  const t0 = Date.now();
  let node = null;
  for (;;) {
    node = [...document.querySelectorAll(selector)].find(visible) || null;
    if (node || Date.now() - t0 > wait) break;
    await sleep(60);
  }
  if (!node || active) return false;
  try { storage.setItem(key, new Date().toISOString()); } catch (_) { /* private mode: shows again, harmless */ }

  const root = mk('div', 'tour-hint');
  // Structural, so it works before any stylesheet rule for it exists: one
  // fixed layer that lets every tap through except on the bubble itself.
  root.style.cssText = 'position:fixed;inset:0;z-index:95;pointer-events:none';
  root.setAttribute('role', 'status');
  const bubble = mk('div', 'tour-bubble');
  const arrow = mk('div', 'tour-arrow');
  const words = mk('p', 'tour-text', text);
  const ok = mk('button', 'btn primary small', 'Got it');
  ok.type = 'button';
  const foot = mk('div', 'tour-foot');
  foot.append(mk('span', 'tour-count', ''), ok);
  bubble.append(arrow, words, foot);
  root.append(bubble);
  document.body.append(root);

  const place = () => {
    if (!node.isConnected) return;
    const v = { w: innerWidth, h: innerHeight };
    bubble.style.width = `${Math.min(300, v.w - GUTTER * 2)}px`;
    const hole = spotRect(rectOf(node), v, clipOf(node), 2);
    const p = placeBubble(hole, { w: bubble.offsetWidth, h: bubble.offsetHeight }, v);
    bubble.dataset.side = p.side;
    bubble.style.left = `${Math.round(p.x)}px`;
    bubble.style.top = `${Math.round(p.y)}px`;
    arrow.style.left = `${Math.round(p.arrowX)}px`;
  };
  place();

  let gone = false;
  // A sheet opening or the target leaving (the save screen replaces the set
  // list) puts it away too — a keyboard or scripted open has no pointerdown.
  const watch = typeof MutationObserver === 'function'
    ? new MutationObserver(() => {
      if (!node.isConnected || document.querySelector('.sheet')) dismiss();
    })
    : null;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    watch?.disconnect();
    removeEventListener('pointerdown', outside, true);
    removeEventListener('hashchange', dismiss);
    removeEventListener('resize', place);
    removeEventListener('keydown', onKey, true);
    bubble.classList.remove('is-shown');
    setTimeout(() => root.remove(), reduced() ? 0 : cssMs('--t', 170));
  };
  const outside = (e) => { if (!bubble.contains(e.target)) dismiss(); };
  const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
  ok.addEventListener('click', dismiss);
  addEventListener('pointerdown', outside, true);
  addEventListener('hashchange', dismiss);
  addEventListener('resize', place);
  addEventListener('keydown', onKey, true);
  watch?.observe(document.body, { childList: true, subtree: true });

  void bubble.offsetWidth;
  bubble.classList.add('is-shown');
  return true;
}
