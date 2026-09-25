/* ------------------------------------------------------------------ *
 * Motion that says "this is new" — 2026-09-25, docs/polish-plan.md part M.
 *
 * Tim: *"could you really work on design and annimation improvements throughout
 * the cite? Some cites have really good shading, reflection graphics, shining,
 * smooth and creative annimation …"*
 *
 * Four things live here, and each keeps Rule 7 (handbook §5): a movement says
 * what just happened, or it does not ship.
 *
 *   · ROWS STAGGER IN when a screen is first painted — the first 8, 30ms apart,
 *     a 6px rise and a fade. It says "this list just arrived", once.
 *   · HEADLINE NUMBERS COUNT UP when first shown, in ≤240ms, ending EXACTLY on
 *     the real text (it is written back verbatim at the end).
 *   · BARS FILL FROM ZERO on first paint — a bar's width is Rule 7's named
 *     exception, and the growth is what says how much.
 *   · A CELEBRATION (`--t-celebrate`, the one duration over 250ms, pinned by
 *     name in tests/a11y.test.mjs) for a real win only: a new personal best, a
 *     workout saved, a goal reached. A shine sweeps across it and it pops.
 *
 * 🚨 ONCE PER VISIT, NEVER ON A RE-RENDER. `arriveScreen()` is called by the
 * router on every render and decides for itself: the same hash twice in a row
 * is a repaint (refreshRoute, a demo toggle), and a repaint that bounced would
 * be motion claiming something happened that did not.
 *
 * 🛑 NOTHING ON THE LOGGING PATH (`QUIET_ROUTES`), nothing inside a screen that
 * is already rising as a whole, and nothing at all under reduced motion or in
 * jsdom — the same `canAnimate()` question ui.js asks, so no other test suite
 * ever sees a class or an inline delay from this file.
 * ------------------------------------------------------------------ */

export const STAGGER_STEP = 30;
export const STAGGER_MAX = 8;
export const COUNT_MS = 240;
/** Matches `--t-celebrate` in app.css; the class comes off after it. */
export const CELEBRATE_MS = 640;
/** How long after arriving a screen's first async fill still counts as its first paint. */
const FILL_WINDOW_MS = 1500;

/** The logging path, and the edit form that is the same thing after the fact. */
export const QUIET_ROUTES = ['session', 'edit', 'activity'];

const ROW_SEL = '.list > .row, .list > .row-split, .feed-card';
const COUNT_SEL = '.me-stat-n, .feed-stat-value, .summary-grid .stat-value';
const BAR_SEL = '.to-next-fill, .bar-track > .bar, .split-fill';

let forced = null;
/** Tests only: true/false forces the answer, null asks the environment again. */
export function __setMotionForTest(v) { forced = v; }

export function motionAllowed() {
  if (forced !== null) return forced;
  if (typeof window === 'undefined' || typeof Element === 'undefined') return false;
  if (typeof Element.prototype.animate !== 'function') return false;
  return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

let lastKey = null;

/**
 * A screen has been put in the document. Plays its first-paint motion if this
 * is an ARRIVAL (a different hash from the last render) — now for what is
 * already there, and for the first batch an async fill adds shortly after.
 *
 * @returns {boolean} whether anything was allowed to play
 */
export function arriveScreen(screen, { key = '', route = '', rising = false } = {}) {
  const arrival = key !== lastKey;
  lastKey = key;
  if (!screen || !arrival || rising || QUIET_ROUTES.includes(route) || !motionAllowed()) return false;

  const budget = { rows: STAGGER_MAX };
  if (play(screen, budget)) return true;

  // Nothing yet: Home, Profile and Friends paint their shell and fill it in.
  // The FIRST batch that brings something is the first paint; after it, or
  // after the window, the observer goes — later additions are re-draws.
  if (typeof MutationObserver === 'undefined') return true;
  const mo = new MutationObserver(() => {
    if (!screen.isConnected) { mo.disconnect(); return; }
    if (play(screen, budget)) mo.disconnect();
  });
  mo.observe(screen, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), FILL_WINDOW_MS);
  return true;
}

/** One pass over a screen. Returns how many things it started. */
function play(screen, budget) {
  let started = 0;

  const rows = [...screen.querySelectorAll(ROW_SEL)].filter((n) => !n.dataset.mSeen);
  rows.forEach((n) => { n.dataset.mSeen = '1'; });
  rows.slice(0, budget.rows).forEach((n, i) => { stagger(n, i); started++; });
  budget.rows = Math.max(0, budget.rows - rows.length);

  for (const n of screen.querySelectorAll(COUNT_SEL)) {
    if (n.dataset.mSeen) continue;
    n.dataset.mSeen = '1';
    if (countUp(n)) started++;
  }
  for (const n of screen.querySelectorAll(BAR_SEL)) {
    if (n.dataset.mSeen) continue;
    n.dataset.mSeen = '1';
    once(n, 'm-fill', 'm-grow', 240);
    started++;
  }
  return started;
}

function stagger(node, i) {
  node.style.animationDelay = `${i * STAGGER_STEP}ms`;
  once(node, 'm-stagger', 'm-rise', 170 + i * STAGGER_STEP, () => { node.style.animationDelay = ''; });
}

/* The class comes off when its own animation ends (a `.row:active` press must
 * not be fighting a finished keyframe's fill), with a timer as the backstop
 * for an animation that never fires — a hidden tab does not paint. */
function once(node, cls, name, ms, after) {
  node.classList.add(cls);
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    node.classList.remove(cls);
    node.removeEventListener('animationend', onEnd);
    if (after) after();
  };
  const onEnd = (e) => { if (e.target === node && e.animationName === name) end(); };
  node.addEventListener('animationend', onEnd);
  setTimeout(end, ms + 200);
}

/* ------------------------------------------------------------------ *
 * Count-up
 * ------------------------------------------------------------------ */

const NUM = /-?\d[\d,]*(?:\.\d+)?/g;
const FIGURE_SPACE = ' ';

/** `{ pre, num, decimals, commas, post, width }` for text holding exactly one
 *  non-zero number; null for anything else (a dash, "1h 4min", "1:05"). */
export function parseCount(text) {
  const s = String(text == null ? '' : text);
  const all = s.match(NUM);
  if (!all || all.length !== 1) return null;
  const raw = all[0];
  const num = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(num) || num === 0) return null;
  const at = s.indexOf(raw);
  const dot = raw.indexOf('.');
  return {
    pre: s.slice(0, at), post: s.slice(at + raw.length), num,
    decimals: dot < 0 ? 0 : raw.length - dot - 1,
    commas: raw.includes(','), width: raw.length,
  };
}

function fmtCount(p, v) {
  let t = Math.abs(v).toFixed(p.decimals);
  if (p.commas) {
    const [i, d] = t.split('.');
    t = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  if (v < 0 || (p.num < 0 && v === 0)) t = '-' + t;
  // ⚠️ FIGURE SPACES, which are exactly one tabular digit wide and do not
  // collapse: every frame is the final number's width, so nothing beside it
  // moves while it counts, and the last digit never shifts.
  return p.pre + t.padStart(p.width, FIGURE_SPACE) + p.post;
}

const easeOut = (x) => 1 - (1 - x) ** 3;

/**
 * Count `node`'s number up from zero. The final frame writes the ORIGINAL text
 * back, so the number a reader is left with is never a rounding of anything.
 * If the app writes the node meanwhile, the count stops and the app's text stands.
 */
export function countUp(node, { ms = COUNT_MS, raf, now } = {}) {
  if (!node) return false;
  const final = node.textContent;
  const p = parseCount(final);
  if (!p) return false;
  const frame = raf || ((fn) => window.requestAnimationFrame(fn));
  const clock = now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  let start = null;
  let written = fmtCount(p, 0);
  node.textContent = written;
  const tick = () => {
    if (node.textContent !== written) return; // the app wrote something newer
    const t = clock();
    if (start === null) start = t;
    const x = Math.min(1, (t - start) / ms);
    if (x >= 1) { node.textContent = final; return; }
    written = fmtCount(p, Number((p.num * easeOut(x)).toFixed(p.decimals)));
    node.textContent = written;
    frame(tick);
  };
  frame(tick);
  return true;
}

/* ------------------------------------------------------------------ *
 * The celebration tier
 * ------------------------------------------------------------------ */

const CELEBRATED_KEY = 'ftrack:v1:celebrated';

function localStore() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; }
}

/**
 * Shine and pop `node` for a real win. `key` names the win (the lift, the
 * goal, the saved workout) and a win celebrates ONCE: a second visit or a
 * re-render sees the same key and stays still.
 *
 * @returns {boolean} whether it will play
 */
export function celebrate(node, key, { storage = localStore() } = {}) {
  if (!node || !motionAllowed()) return false;
  let seen = [];
  try { seen = JSON.parse((storage && storage.getItem(CELEBRATED_KEY)) || '[]'); } catch (_) { seen = []; }
  if (!Array.isArray(seen)) seen = [];
  if (key && seen.includes(key)) return false;
  if (key) {
    try { storage && storage.setItem(CELEBRATED_KEY, JSON.stringify([...seen, key].slice(-60))); } catch (_) {}
  }
  once(node, 'm-celebrate', 'm-pop', CELEBRATE_MS);
  return true;
}

/** The tab icon's small pop when it BECOMES the selected one. */
export function tabPop(link) {
  if (!link || !motionAllowed()) return;
  // The keyframe runs on the icon inside, so the backstop timer takes it off.
  once(link, 'm-tabbed', 'm-tab-pop', 170);
}
