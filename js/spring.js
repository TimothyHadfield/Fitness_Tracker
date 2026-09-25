/* ------------------------------------------------------------------ *
 * Springs — the physics tier of Rule 7 (handbook §5), 2026-09-25,
 * docs/motion2-plan.md package A.
 *
 * Tim: *"Put professional level annimation and physics into this cite."*
 *
 * A spring is a thing with a position, a velocity and somewhere it wants to
 * be. It has no duration: it arrives when the physics says so, and if it is
 * told to go somewhere else halfway (a finger lands, a second tap) it turns
 * round WITH the speed it already had — which is the difference between an
 * object and a tween. That is the whole reason this file exists.
 *
 * RULES IT KEEPS (tests/spring.test.mjs pins each one)
 *   · Every preset covers 90% of its travel within 250ms and is within 1% of
 *     it by 400ms. Quick is still a number, just a different one.
 *   · Frame-rate independent: fixed 1/240s substeps, however long the frame.
 *   · ONE requestAnimationFrame loop for every live spring in the app.
 *   · prefers-reduced-motion, a hidden tab, or no rAF at all (node, jsdom):
 *     the spring lands on its target synchronously — onUpdate(to), onRest(),
 *     done resolves. Nothing waits on a frame that will never come.
 *   · springTransform() writes only `transform` and `opacity`, and clears them
 *     back to '' when the element is at rest at identity, so a CSS :active or
 *     a class never has to fight a leftover inline value.
 * ------------------------------------------------------------------ */

/** Stiffness k and damping c, mass 1. ζ = c / (2√k). */
export const SPRINGS = {
  snap:   { k: 600, c: 49 },   // ζ≈1.00 — presses, small hops. 90% in ~160ms.
  glide:  { k: 400, c: 40 },   // ζ=1.00 — things that travel. 90% in ~195ms.
  bounce: { k: 500, c: 28 },   // ζ≈0.63 — a win, a pop. ~8% overshoot, one wobble.
  sheet:  { k: 450, c: 42 },   // ζ≈0.99 — a surface arriving. 90% in ~185ms.
};

export const STEP = 1 / 240;
/** A frame longer than this is simulated as this long — a stalled tab must not
 *  teleport a spring halfway through the next frame. */
const MAX_FRAME = 1 / 15;

let forcedReduced = null;
/** Tests only: true/false forces reduced motion, null asks the environment. */
export function __setReducedMotionForTest(v) { forcedReduced = v; }

export function reducedMotion() {
  if (forcedReduced !== null) return forcedReduced;
  try {
    return typeof window !== 'undefined' && Boolean(window.matchMedia)
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) { return false; }
}

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const raf = () => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
const hidden = () => typeof document !== 'undefined' && document.hidden === true;

function presetOf(p) {
  if (p && typeof p === 'object') return p;
  return SPRINGS[p] || SPRINGS.glide;
}

/** One semi-implicit Euler substep. Exported for the tests' simulator. */
export function stepSpring(s, k, c, dt) {
  const a = -k * (s.x - s.to) - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

/**
 * Pure simulation, no DOM, no clock — what tests and tuning read.
 * @returns {{t:number,x:number,v:number}[]} one sample per substep, t in ms
 */
export function simulate({ from = 0, to = 1, velocity = 0, preset = 'glide', ms = 1000 } = {}) {
  const { k, c } = presetOf(preset);
  const s = { x: from, v: velocity, to };
  const out = [{ t: 0, x: s.x, v: s.v }];
  const n = Math.ceil(ms / 1000 / STEP);
  for (let i = 1; i <= n; i++) {
    stepSpring(s, k, c, STEP);
    out.push({ t: i * STEP * 1000, x: s.x, v: s.v });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The one loop
 * ------------------------------------------------------------------ */

const live = new Set();
let frameId = null;
let lastT = 0;
let lastTick = 0;
let acc = 0;
let watchdog = null;

function ensureLoop() {
  if (frameId !== null) return;
  const r = raf();
  lastT = now();
  acc = 0;
  lastTick = lastT;
  frameId = r(tick);
  // 🛟 A rAF that never fires (an engine throttling a background frame) would
  // leave a row at opacity 0 for ever. Anything alive with no frame for half a
  // second is put where it was going.
  if (!watchdog && typeof setInterval === 'function') {
    watchdog = setInterval(() => {
      if (!live.size) { clearInterval(watchdog); watchdog = null; return; }
      if (now() - lastTick > 500) finishAll();
    }, 250);
    if (watchdog && typeof watchdog.unref === 'function') watchdog.unref();
  }
}

function tick() {
  frameId = null;
  // performance.now(), not the rAF argument: one clock for start and frames,
  // whatever a test harness or an old engine passes in.
  const at = now();
  lastTick = at;
  acc += Math.min(Math.max(0, (at - lastT) / 1000), MAX_FRAME);
  lastT = at;
  const n = Math.floor(acc / STEP + 1e-9);
  acc -= n * STEP;
  if (n > 0) for (const s of [...live]) advance(s, n);
  if (live.size) frameId = raf()(tick);
}

function advance(s, n) {
  for (let i = 0; i < n; i++) {
    if (s.wait > 0) { s.wait -= STEP; continue; }
    stepSpring(s, s.k, s.c, STEP);
    if (Math.abs(s.v) < s.vEps && Math.abs(s.x - s.to) < s.eps) { land(s); return; }
  }
  if (s.wait <= 0) emit(s, s.x);
}

function emit(s, x) {
  if (!s.onUpdate) return;
  try { s.onUpdate(x); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
}

function land(s) {
  s.x = s.to;
  s.v = 0;
  s.wait = 0;
  live.delete(s);
  emit(s, s.to);
  if (s.onRest) { try { s.onRest(s.to); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  s.resolve();
}

function finishAll() {
  for (const s of [...live]) land(s);
  if (frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
  frameId = null;
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => { if (hidden()) finishAll(); });
}

/** Can a spring started NOW actually be watched moving? */
const canAnimate = () => Boolean(raf()) && !hidden() && !reducedMotion();

/**
 * A one-dimensional spring.
 *
 * @param {object} o
 * @param {number} [o.from=0]
 * @param {number} [o.to=1]
 * @param {number} [o.velocity=0]   units per SECOND
 * @param {string|{k,c}} [o.preset='glide']
 * @param {number} [o.precision]    rest threshold on |x−to|; default 0.5 (px).
 *                                  Pass ~0.001 for 0–1 values (opacity, scale).
 * @param {number} [o.delay=0]      ms to hold at `from` before moving
 * @param {Function} [o.onUpdate]   (x) every frame, and once more at rest
 * @param {Function} [o.onRest]     (to) once, when it lands
 */
export function spring({
  from = 0, to = 1, velocity = 0, preset = 'glide', precision, delay = 0, onUpdate, onRest,
} = {}) {
  const { k, c } = presetOf(preset);
  const eps = precision == null ? 0.5 : precision;
  const s = {
    x: from, v: velocity, to, k, c, eps, vEps: precision == null ? 5 : precision * 10,
    wait: Math.max(0, delay) / 1000, onUpdate, onRest, resolve: null, done: null,
  };
  const arm = () => { s.done = new Promise((r) => { s.resolve = r; }); };
  arm();

  const start = () => {
    if (!canAnimate()) { land(s); return; }
    live.add(s);
    ensureLoop();
  };

  const ctl = {
    /** Retarget. Keeps the current position and velocity unless given one. */
    set(next, v) {
      if (typeof next === 'number') s.to = next;
      if (typeof v === 'number') s.v = v;
      if (!live.has(s)) { arm(); start(); }
      return ctl;
    },
    /** Freeze where it is. `done` resolves; onRest does not fire. */
    stop() {
      if (!live.has(s)) return ctl;
      live.delete(s);
      s.v = 0;
      s.resolve();
      return ctl;
    },
    get value() { return s.x; },
    get velocity() { return s.v; },
    get target() { return s.to; },
    get done() { return s.done; },
    get active() { return live.has(s); },
  };
  if (s.wait <= 0) emit(s, s.x);
  start();
  return ctl;
}

/* ------------------------------------------------------------------ *
 * Several axes on one element
 * ------------------------------------------------------------------ */

const AXES = ['x', 'y', 'scale', 'opacity'];
const IDENTITY = { x: 0, y: 0, scale: 1, opacity: 1 };
const els = new WeakMap();

function stateOf(el) {
  let st = els.get(el);
  if (!st) { st = { ...IDENTITY, ctl: {} }; els.set(el, st); }
  return st;
}

function write(el, st) {
  const x = Math.abs(st.x) < 0.01 ? 0 : st.x;
  const y = Math.abs(st.y) < 0.01 ? 0 : st.y;
  const sc = Math.abs(st.scale - 1) < 0.0005 ? 1 : st.scale;
  const parts = [];
  if (x || y) parts.push(`translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`);
  if (sc !== 1) parts.push(`scale(${sc.toFixed(4)})`);
  el.style.transform = parts.join(' ');
  const op = Math.min(1, Math.max(0, st.opacity));
  el.style.opacity = op >= 0.999 ? '' : op.toFixed(3);
}

/**
 * Spring any of `{ x, y, scale, opacity }` on one element. Axes compose: a row
 * rising (y, opacity) and popping (scale) at once is one transform, and each
 * axis keeps its own velocity when retargeted.
 *
 * @param {Element} el
 * @param {{x?,y?,scale?,opacity?}} to
 * @param {string|{k,c}} [preset='glide']
 * @param {{from?:object, velocity?:object, delay?:number, onRest?:Function}} [opts]
 * @returns {{set(to, velocity?), stop(), value, velocity, done: Promise}}
 */
export function springTransform(el, to = {}, preset = 'glide', opts = {}) {
  const st = stateOf(el);
  const from = opts.from || {};
  const vel = opts.velocity || {};
  for (const a of AXES) if (typeof from[a] === 'number') st[a] = from[a];
  write(el, st);

  const drive = (targets, velocity = {}, delay = 0) => {
    for (const a of AXES) {
      if (typeof targets[a] !== 'number') continue;
      const cur = st.ctl[a];
      if (cur && cur.active) { cur.set(targets[a], velocity[a]); continue; }
      st.ctl[a] = spring({
        from: st[a], to: targets[a], velocity: velocity[a] || 0, preset, delay,
        precision: a === 'x' || a === 'y' ? 0.25 : 0.001,
        onUpdate: (v) => { st[a] = v; write(el, st); },
      });
    }
  };
  drive(to, vel, opts.delay || 0);

  const live = () => AXES.map((a) => st.ctl[a]).filter(Boolean);
  const ctl = {
    set(targets, velocity) { drive(targets || {}, velocity || {}); return ctl; },
    stop() { live().forEach((c) => c.stop()); return ctl; },
    get value() { return { x: st.x, y: st.y, scale: st.scale, opacity: st.opacity }; },
    get velocity() {
      const v = {};
      for (const a of AXES) v[a] = st.ctl[a] ? st.ctl[a].velocity : 0;
      return v;
    },
    get done() {
      return Promise.all(live().map((c) => c.done)).then(() => { if (opts.onRest) opts.onRest(); });
    },
    get active() { return live().some((c) => c.active); },
  };
  return ctl;
}

/** Is `el` still being moved by a spring from this file? */
export function isSpringing(el) {
  const st = els.get(el);
  return Boolean(st) && AXES.some((a) => st.ctl[a] && st.ctl[a].active);
}

/* ------------------------------------------------------------------ *
 * Gestures
 * ------------------------------------------------------------------ */

/**
 * Finger velocity over the last ~80ms — what a flick hands to a spring.
 * `add()` takes a pointer/touch event or `{ x, y, t }` (t in ms).
 */
export function velocityTracker(windowMs = 80) {
  let samples = [];
  return {
    add(e) {
      const p = e && e.touches && e.touches[0] ? e.touches[0] : e;
      const x = p.clientX != null ? p.clientX : p.x;
      const y = p.clientY != null ? p.clientY : p.y;
      const t = e.t != null ? e.t : (e.timeStamp != null && e.timeStamp > 0 ? e.timeStamp : now());
      samples.push({ x, y, t });
      const cut = t - Math.max(windowMs * 2, 100);
      if (samples.length > 3 && samples[0].t < cut) samples = samples.filter((s) => s.t >= cut);
    },
    get() {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      const last = samples[samples.length - 1];
      const recent = samples.filter((s) => last.t - s.t <= windowMs);
      const first = recent.length > 1 ? recent[0] : samples[samples.length - 2];
      const dt = (last.t - first.t) / 1000;
      if (dt <= 0.001) return { vx: 0, vy: 0 };
      return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
    },
    reset() { samples = []; },
  };
}

/**
 * iOS-style rubber band: past an edge the content follows the finger less and
 * less, and never passes `limit`. ≈ c·offset for a small pull.
 */
export function rubberBand(offset, limit, c = 0.55) {
  if (!limit || !offset) return 0;
  const sign = offset < 0 ? -1 : 1;
  const d = Math.abs(offset);
  return sign * (1 - 1 / ((d * c) / limit + 1)) * limit;
}
