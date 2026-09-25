/* ------------------------------------------------------------------ *
 * Motion that says "this is new" — 2026-09-25, docs/polish-plan.md part M,
 * rebuilt the same day on springs (docs/motion2-plan.md package A).
 *
 * Tim: *"could you really work on design and annimation improvements throughout
 * the cite? …"* and then *"I notice the rows slide up when a screen opens but
 * that's it … Put professional level annimation and physics into this cite."*
 *
 * Four things live here, and each keeps Rule 7 (handbook §5): a movement says
 * what just happened, or it does not ship.
 *
 *   · ROWS ARRIVE AFTER THE SCREEN — the screen settles first (its own 6px
 *     fade), then the first 8 rows in view follow on a spring, a 12px rise,
 *     35ms apart (js/spring.js `snap`). Two movements, one after the other,
 *     rather than the same fade twice at the same moment.
 *   · HEADLINE NUMBERS COUNT UP when first shown, in ≤240ms, ending EXACTLY on
 *     the real text (it is written back verbatim at the end). "1h 5min" counts
 *     both parts, the same as "50 min" beside it.
 *   · BARS FILL FROM ZERO on first paint — a bar's width is Rule 7's named
 *     exception, and the growth is what says how much.
 *   · A CELEBRATION (`--t-celebrate`, pinned by name in tests/a11y.test.mjs)
 *     for a real win only: a new personal best, a workout saved, a goal
 *     reached. A specular shine sweeps across it and it pops on a real spring.
 *
 * 🚨 ONCE PER ROUTE PER SESSION, NEVER ON A RE-RENDER. Rows stagger and bars
 * fill the FIRST time a route is shown after the app loads; coming back to
 * Home is not news. A headline number counts again only if it CHANGED since
 * that route last showed it (a workout was saved, so the total moved).
 * Anything below the fold is left alone: motion nobody sees is cost only.
 *
 * 🛑 NOTHING ON THE LOGGING PATH (`QUIET_ROUTES`), nothing inside a screen that
 * is already rising as a whole, and nothing at all under reduced motion or in
 * jsdom — the same `canAnimate()` question ui.js asks, so no other test suite
 * ever sees a class or an inline style from this file.
 * ------------------------------------------------------------------ */

import { springTransform, simulate, isSpringing } from './spring.js';
import { demo } from './store.js';

export const STAGGER_STEP = 35;
export const STAGGER_MAX = 8;
/** Rows wait this long so the screen's own arrival reads first. */
export const STAGGER_LEAD = 40;
/** How far a row rises, px — twice the screen's own 6px, so it reads as its own movement. */
export const STAGGER_RISE = 12;
export const COUNT_MS = 240;
/** Matches `--t-celebrate` in app.css; the class comes off after it. */
export const CELEBRATE_MS = 600;
/** The celebration's pop peaks at this scale (a bounce spring, one wobble). */
export const POP_PEAK = 1.06;
/** How long after arriving a screen's first async fill still counts as its first paint. */
const FILL_WINDOW_MS = 1500;
/** Rows that land later than this after arriving are a re-draw, not the arrival. */
const ROW_WINDOW_MS = 500;

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

/** Is a screen transition in flight? Harmless where nothing ever sets it. */
export function navMoving() {
  try { return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-nav-moving'); } catch (_) { return false; }
}

let lastKey = null;
/** Routes (and Data sub-panes) already shown once since the app loaded. */
const visited = new Set();
/** The headline numbers each route last showed, in document order. */
const shownCounts = new Map();

/** Tests only: forget every visit, as a fresh app load would. */
export function __resetVisitsForTest() { visited.clear(); shownCounts.clear(); lastKey = null; }

/**
 * A screen has been put in the document. The FIRST time this route is shown
 * since the app loaded, its rows follow it in, its numbers count and its bars
 * fill — for what is already there and for the first batch an async fill adds
 * shortly after. Later visits count only a number that changed.
 *
 * @returns {boolean} whether anything was allowed to play
 */
export function arriveScreen(screen, { key = '', route = '', rising = false } = {}) {
  const repaint = key === lastKey;
  lastKey = key;
  if (!screen || repaint || rising || QUIET_ROUTES.includes(route) || !motionAllowed()) return false;
  const first = !visited.has(key);
  visited.add(key);
  return arrive(screen, key, first);
}

/**
 * A Data sub-tab (Bars, Graph, Volume, Muscles, Research…) has painted a pane
 * in place. Sub-tabs do not change the hash, so the router never sees them;
 * the view calls this after painting. Keyed per pane, once per session, like
 * a route. A pane painted before its screen is in the document is part of that
 * screen's own arrival, and is only remembered here.
 */
export function arrivePane(root, key) {
  if (!root || !key) return false;
  const k = `pane:${key}`;
  const first = !visited.has(k);
  visited.add(k);
  if (!first || !root.isConnected || !motionAllowed()) return false;
  return arrive(root, k, true);
}

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function arrive(root, key, first) {
  const ctx = {
    key, first, rows: STAGGER_MAX, started: 0, t0: clock(),
    countIndex: 0, prev: shownCounts.get(key) || [], now: [],
  };
  shownCounts.set(key, ctx.now);
  // Done once something was found, unless this is a first visit still filling
  // in its first rows (Profile paints its body row, then its lifts a beat later).
  const settled = (found) => found > 0
    && (!ctx.first || ctx.rows === 0 || clock() - ctx.t0 > ROW_WINDOW_MS);
  if (settled(play(root, ctx))) return true;

  // Home, Profile and Friends paint their shell and fill it in. Batches that
  // land while the first rows are still arriving join the same cascade, in
  // their slot; after that, or after the window, the observer goes — later
  // additions are re-draws.
  if (typeof MutationObserver === 'undefined') return true;
  const mo = new MutationObserver(() => {
    if (!root.isConnected) { mo.disconnect(); return; }
    if (settled(play(root, ctx))) mo.disconnect();
  });
  mo.observe(root, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), FILL_WINDOW_MS);
  return true;
}

/** Is any part of `n` inside the window? jsdom's all-zero rect counts as yes. */
function inView(n) {
  if (!n.getBoundingClientRect) return true;
  const r = n.getBoundingClientRect();
  const h = (typeof window !== 'undefined' && window.innerHeight) || 0;
  const w = (typeof window !== 'undefined' && window.innerWidth) || 0;
  return r.bottom >= 0 && r.top <= h && r.right >= 0 && r.left <= w;
}

/** One pass over a root. Returns how many things it found to consider. */
function play(root, ctx) {
  let found = 0;

  const rows = [...root.querySelectorAll(ROW_SEL)].filter((n) => !n.dataset.mSeen);
  rows.forEach((n) => { n.dataset.mSeen = '1'; });
  found += rows.length;
  const elapsed = clock() - ctx.t0;
  if (ctx.first && ctx.rows > 0 && rows.length && elapsed <= ROW_WINDOW_MS) {
    const shown = rows.filter(inView).slice(0, ctx.rows);
    // Each row keeps its slot in the cascade, counted from the arrival.
    staggerIn(shown, { lead: Math.max(0, STAGGER_LEAD + ctx.started * STAGGER_STEP - elapsed) });
    ctx.started += shown.length;
    ctx.rows -= shown.length;
    // A batch with nothing in view ends the cascade: what follows is below it.
    if (!shown.length) ctx.rows = 0;
  }

  for (const n of root.querySelectorAll(COUNT_SEL)) {
    if (n.dataset.mSeen) continue;
    n.dataset.mSeen = '1';
    found++;
    const i = ctx.countIndex++;
    const text = n.textContent;
    ctx.now[i] = text;
    const changed = !ctx.first && ctx.prev[i] !== undefined && ctx.prev[i] !== text;
    if ((ctx.first || changed) && inView(n)) countUp(n);
  }
  for (const n of root.querySelectorAll(BAR_SEL)) {
    if (n.dataset.mSeen) continue;
    n.dataset.mSeen = '1';
    found++;
    if (ctx.first && inView(n)) once(n, 'm-fill', 'm-grow', 240);
  }
  return found;
}

/**
 * Rows follow each other in: a 12px spring rise and a fade, STAGGER_STEP apart,
 * the first STAGGER_MAX only. For any batch of new nodes — Home's "Show more",
 * a list that grew. Returns how many it started.
 */
export function staggerIn(nodes, { lead = 0, step = STAGGER_STEP, max = STAGGER_MAX, rise = STAGGER_RISE } = {}) {
  if (!motionAllowed() || !nodes) return 0;
  // 🆕 2026-09-25 (review): not on top of a screen transition. While the
  // navigation is moving a whole screen (gestures.js sets `data-nav-moving` on
  // <html>), the rows are travelling with it — a cascade inside a sliding page
  // is two movements saying the same thing at once. Skipped, not delayed: rows
  // that faded out after the page landed would read as a flicker.
  if (navMoving()) return 0;
  const list = [...nodes].filter(Boolean).slice(0, max);
  list.forEach((n, i) => {
    n.classList.add('m-arriving');
    const c = springTransform(n, { y: 0, opacity: 1 }, 'snap',
      { from: { y: rise, opacity: 0 }, delay: lead + i * step });
    c.done.then(() => n.classList.remove('m-arriving'));
  });
  return list.length;
}

/* The class comes off when its own animation ends, with a timer as the
 * backstop for an animation that never fires — a hidden tab does not paint. */
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
const FIGURE_SPACE = ' ';

/**
 * Every number in `text`, and the text between them. `{ parts, pre, num,
 * decimals, commas, post, width }` — the single-number fields describe the
 * first number. Null when there is nothing to count: no number, or every
 * number zero.
 */
export function parseCount(text) {
  const s = String(text == null ? '' : text);
  const parts = [];
  let at = 0;
  for (const m of s.matchAll(NUM)) {
    const raw = m[0];
    const num = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(num)) return null;
    if (m.index > at) parts.push(s.slice(at, m.index));
    const dot = raw.indexOf('.');
    parts.push({
      num, decimals: dot < 0 ? 0 : raw.length - dot - 1, commas: raw.includes(','), width: raw.length,
      zeroPad: /^-?0\d/.test(raw),
    });
    at = m.index + raw.length;
  }
  if (at < s.length) parts.push(s.slice(at));
  const nums = parts.filter((p) => typeof p === 'object');
  if (!nums.length || nums.every((p) => p.num === 0)) return null;
  const first = parts.indexOf(nums[0]);
  const lastNum = parts.lastIndexOf(nums[nums.length - 1]);
  return {
    parts, count: nums.length,
    pre: parts.slice(0, first).join(''), post: nums.length === 1 ? parts.slice(lastNum + 1).join('') : '',
    num: nums[0].num, decimals: nums[0].decimals, commas: nums[0].commas, width: nums[0].width,
  };
}

function fmtNum(p, v) {
  let t = Math.abs(v).toFixed(p.decimals);
  if (p.commas) {
    const [i, d] = t.split('.');
    t = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  if (v < 0 || (p.num < 0 && v === 0)) t = '-' + t;
  // ⚠️ FIGURE SPACES, which are exactly one tabular digit wide and do not
  // collapse: every frame is the final number's width, so nothing beside it
  // moves while it counts, and the last digit never shifts. A zero-padded
  // number ("1:05") pads with zeros, the way a clock does.
  return t.padStart(p.width, p.zeroPad ? '0' : FIGURE_SPACE);
}

function fmtCount(pc, x) {
  return pc.parts.map((p) => (typeof p === 'string' ? p
    : fmtNum(p, Number((p.num * x).toFixed(p.decimals))))).join('');
}

const easeOut = (x) => 1 - (1 - x) ** 3;

/**
 * Count `node`'s numbers up from zero, all together. The final frame writes the
 * ORIGINAL text back, so the number a reader is left with is never a rounding
 * of anything. If the app writes the node meanwhile, the count stops and the
 * app's text stands.
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
    written = fmtCount(p, easeOut(x));
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

/** 🚨 The demo saves NOTHING to the device (handbook §0.10) — not even which
 *  invented win already shone. Demo → sessionStorage, gone with the tab. */
function winStore() {
  try {
    if (demo.active()) return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) { return null; }
}

/** The kick a bounce spring at rest needs to peak at POP_PEAK — solved once
 *  from the spring itself, so retuning the preset cannot change the pop. */
const POP_KICK = (() => {
  const peak = Math.max(...simulate({ from: 0, to: 0, velocity: 1, preset: 'bounce', ms: 300 }).map((s) => s.x));
  return (POP_PEAK - 1) / peak;
})();

const later = (fn) => (typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(() => fn()) : setTimeout(fn, 0));

/**
 * Shine and pop `node` for a real win. `key` names the win (the lift, the
 * goal, the saved workout) and a win celebrates ONCE: a second visit or a
 * re-render sees the same key and stays still.
 *
 * It starts on the next frame — the callers build the node before it is in
 * the document — and, if the node is a row still arriving, only once it has
 * arrived: a win that shone while the row was faded out would be spent unseen.
 *
 * @returns {boolean} whether it will play
 */
export function celebrate(node, key, { storage = winStore() } = {}) {
  if (!node || !motionAllowed()) return false;
  let seen = [];
  try { seen = JSON.parse((storage && storage.getItem(CELEBRATED_KEY)) || '[]'); } catch (_) { seen = []; }
  if (!Array.isArray(seen)) seen = [];
  if (key && seen.includes(key)) return false;
  if (key) {
    try { storage && storage.setItem(CELEBRATED_KEY, JSON.stringify([...seen, key].slice(-60))); } catch (_) {}
  }
  let tries = 0;
  const go = () => {
    // Still rising in with its list: wait for it (≤ ~0.6s), then shine.
    if (isSpringing(node) && tries++ < 40) { later(go); return; }
    startCelebration(node);
  };
  later(go);
  return true;
}

function startCelebration(node) {
  // The sweep is a pseudo-element at inset 0; it needs a positioned host, and
  // only a STATIC host is changed — never an absolute or sticky one.
  let positioned = false;
  try {
    if (typeof getComputedStyle === 'function' && getComputedStyle(node).position === 'static') {
      node.classList.add('m-celebrate-pos');
      positioned = true;
    }
  } catch (_) {}
  once(node, 'm-celebrate', 'm-shine', CELEBRATE_MS, () => {
    if (positioned) node.classList.remove('m-celebrate-pos');
  });
  springTransform(node, { scale: 1 }, 'bounce', { velocity: { scale: POP_KICK } });
}

/** The tab icon's small pop when it BECOMES the selected one. */
export function tabPop(link) {
  if (!link || !motionAllowed()) return;
  // The keyframe runs on the icon inside, so the backstop timer takes it off.
  once(link, 'm-tabbed', 'm-tab-pop', 170);
}
