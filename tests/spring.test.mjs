// The physics tier of Rule 7 (docs/handbook.md §5, docs/motion2-plan.md A).
//   node tests/spring.test.mjs
//
// Tim, 2026-09-25: *"Put professional level annimation and physics into this
// cite."* Springs have no duration, so "quick" has to be measured on the
// physics itself: every preset covers 90% of its travel within 250ms and is
// within 1% of it by 400ms. Plus the things a spring must never do: move under
// reduced motion, lose its velocity when retargeted, or wait on a frame that
// never comes.
import { JSDOM } from 'jsdom';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const root = new URL('../', import.meta.url);

const S = await import(new URL('js/spring.js', root).href);
const { SPRINGS, simulate, spring, springTransform, velocityTracker, rubberBand, __setReducedMotionForTest } = S;

/* ---------- every preset is quick (the Rule 7 physics tier) ---------- */
function settle(preset, travel = 100, velocity = 0) {
  const samples = simulate({ from: 0, to: travel, velocity, preset, ms: 1500 });
  const lastOutside = (band) => {
    let t = 0;
    for (const s of samples) if (Math.abs(s.x - travel) > band) t = s.t;
    return t;
  };
  const peak = Math.max(...samples.map((s) => s.x));
  return { t90: lastOutside(travel * 0.1), t99: lastOutside(travel * 0.01), overshoot: (peak - travel) / travel };
}
ok(Object.keys(SPRINGS).length >= 4, `presets defined (${Object.keys(SPRINGS).join(', ')})`);
for (const [name, p] of Object.entries(SPRINGS)) {
  const r = settle(name);
  ok(r.t90 <= 250, `${name} (k${p.k} c${p.c}) covers 90% of its travel by 250ms (${r.t90.toFixed(0)}ms)`);
  ok(r.t99 <= 400, `${name} is within 1% of its target by 400ms (${r.t99.toFixed(0)}ms)`);
  ok(r.overshoot < 0.12, `${name} overshoots under 12% (${(r.overshoot * 100).toFixed(1)}%)`);
  const far = settle(name, 800);
  ok(Math.abs(far.t90 - r.t90) < 1 && Math.abs(far.t99 - r.t99) < 1,
     `${name} takes the same time over 800px as over 100px (a spring is scale-free)`);
}
ok(settle('snap').overshoot < 0.005 && settle('glide').overshoot < 0.005,
   'snap and glide do not overshoot (a press and a travel land, they do not wobble)');
ok(settle('bounce').overshoot > 0.03, `bounce does overshoot, visibly (${(settle('bounce').overshoot * 100).toFixed(1)}%)`);

/* ---------- no rAF (node): lands synchronously ---------- */
{
  const seen = [];
  let rested = 0;
  const c = spring({ from: 0, to: 40, onUpdate: (x) => seen.push(x), onRest: () => rested++ });
  ok(seen[seen.length - 1] === 40 && rested === 1 && c.value === 40,
     `with no requestAnimationFrame the spring lands at once (${seen.join(',')})`);
  let resolved = false;
  await c.done.then(() => { resolved = true; });
  ok(resolved, 'and its done promise resolves');
}

/* ---------- a fake clock and a fake frame ---------- */
let T = 1000;
let queue = [];
let rafCalls = 0;
globalThis.requestAnimationFrame = (fn) => { rafCalls++; queue.push(fn); return queue.length; };
globalThis.cancelAnimationFrame = () => { queue = []; };
Object.defineProperty(globalThis.performance, 'now', { value: () => T, configurable: true, writable: true });
const frame = (ms = 1000 / 60) => { T += ms; const q = queue.splice(0); q.forEach((f) => f(T)); };
const run = (ms, hz = 60) => { const n = Math.round((ms * hz) / 1000); for (let i = 0; i < n; i++) frame(1000 / hz); };

__setReducedMotionForTest(false);

/* ---------- it moves, and rests exactly on its target ---------- */
{
  const seen = [];
  let rested = 0;
  const c = spring({ from: 0, to: 100, preset: 'glide', onUpdate: (x) => seen.push(x), onRest: () => rested++ });
  ok(c.active && c.value === 0, 'with frames, the spring starts where it was');
  run(100);
  ok(c.value > 50 && c.value < 100, `…and is moving after 100ms (${c.value.toFixed(1)})`);
  run(500);
  ok(!c.active && c.value === 100 && rested === 1, `…and rests exactly on 100 (${c.value}, onRest×${rested})`);
  ok(seen[seen.length - 1] === 100, 'the last update it hands out is the target itself');
}

/* ---------- one loop for every spring ---------- */
{
  rafCalls = 0;
  const a = spring({ from: 0, to: 100 });
  const b = spring({ from: 0, to: -100 });
  const c = spring({ from: 0, to: 50, preset: 'bounce' });
  ok(queue.length === 1 && rafCalls === 1, `three live springs share ONE frame request (${queue.length} queued)`);
  frame();
  ok(queue.length === 1, 'and keep sharing it each frame');
  run(600);
  ok(!a.active && !b.active && !c.active && queue.length === 0, 'and the loop stops when all are at rest');
}

/* ---------- frame-rate independent ---------- */
{
  const at = (hz) => {
    const c = spring({ from: 0, to: 100, preset: 'glide' });
    run(100, hz);
    const v = c.value;
    run(600, hz);
    return v;
  };
  const x60 = at(60);
  const x120 = at(120);
  const x30 = at(30);
  ok(Math.abs(x60 - x120) < 3 && Math.abs(x60 - x30) < 4,
     `the same position after 100ms at 30, 60 and 120Hz (${x30.toFixed(1)} / ${x60.toFixed(1)} / ${x120.toFixed(1)})`);
}

/* ---------- interruptible: a retarget keeps the velocity it had ---------- */
{
  const c = spring({ from: 0, to: 100, preset: 'glide' });
  run(50);
  const x0 = c.value;
  const v0 = c.velocity;
  ok(v0 > 100, `moving fast mid-flight (${v0.toFixed(0)}px/s)`);
  c.set(0);
  ok(c.value === x0 && c.velocity === v0, '🚨 set() keeps the current position AND velocity (no jump, no dead stop)');
  frame();
  ok(c.value > x0, `…so it carries on forward for a moment before turning round (${x0.toFixed(1)} → ${c.value.toFixed(1)})`);
  run(700);
  ok(!c.active && c.value === 0, 'and then lands on the new target');
  const d = spring({ from: 0, to: 10 });
  d.set(10, 400);
  ok(d.velocity === 400, 'set(to, velocity) hands in a flick');
  run(700);
}

/* ---------- a delay holds it at its start ---------- */
{
  const c = spring({ from: 5, to: 50, delay: 100 });
  run(80);
  ok(c.value === 5, `a delayed spring holds still (${c.value})`);
  run(600);
  ok(c.value === 50, 'then goes');
}

/* ---------- reduced motion: every spring lands at once ---------- */
{
  __setReducedMotionForTest(true);
  const seen = [];
  let rested = 0;
  const c = spring({ from: 0, to: 30, onUpdate: (x) => seen.push(x), onRest: () => rested++ });
  ok(!c.active && seen[seen.length - 1] === 30 && rested === 1 && queue.length === 0,
     '🚨 reduced motion: onUpdate(to) and onRest() synchronously, no frame requested');
  __setReducedMotionForTest(false);
}

/* ---------- a hidden tab puts everything where it was going ---------- */
{
  const dom = new JSDOM('<!doctype html><body><div id="r"></div></body>', { pretendToBeVisual: true });
  // Re-import against a document so the visibility listener is wired.
  globalThis.document = dom.window.document;
  const S2 = await import(new URL('js/spring.js?doc', root).href);
  S2.__setReducedMotionForTest(false);
  const el = dom.window.document.getElementById('r');
  const c = S2.springTransform(el, { y: 0, opacity: 1 }, 'glide', { from: { y: 14, opacity: 0 } });
  ok(/translate3d\(0\.00px, 14\.00px/.test(el.style.transform) && Number(el.style.opacity) === 0,
     `springTransform paints its start at once (${el.style.transform} / ${el.style.opacity})`);
  frame(); frame();
  ok(c.active && el.style.opacity !== '', 'and is moving');
  Object.defineProperty(dom.window.document, 'hidden', { value: true, configurable: true });
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  ok(!c.active && el.style.transform === '' && el.style.opacity === '',
     '🚨 a hidden tab jumps it to rest, and at identity it leaves NO inline transform or opacity behind');
  Object.defineProperty(dom.window.document, 'hidden', { value: false, configurable: true });

  // Axes compose: rising and popping at once is one transform.
  const p = S2.springTransform(el, { y: 0 }, 'glide', { from: { y: 10 } });
  const q = S2.springTransform(el, { scale: 1 }, 'bounce', { velocity: { scale: 3 } });
  frame(); frame(); frame();
  ok(/translate3d/.test(el.style.transform) && /scale\(/.test(el.style.transform),
     `two springs on one element compose into one transform (${el.style.transform})`);
  run(700);
  ok(!p.active && !q.active && el.style.transform === '', 'and clear it when both rest');
  delete globalThis.document;
}

/* ---------- gestures ---------- */
{
  const r = (x) => rubberBand(x, 100);
  ok(r(0) === 0, 'rubberBand(0) is 0');
  ok(Math.abs(r(10) - 0.55 * 10) < 1, `a small pull moves ≈0.55× the finger (${r(10).toFixed(2)} for 10)`);
  ok(r(10000) < 100 && r(1e9) < 100, `🚨 however far you pull it never passes the limit (${r(10000).toFixed(1)} for 10000)`);
  ok(r(50) < r(100) && r(100) < r(400), 'more pull is always more movement');
  ok(r(-80) === -r(80), 'and it is symmetric');

  const vt = velocityTracker();
  for (let i = 0; i <= 10; i++) vt.add({ x: i * 12, y: 0, t: 5000 + i * 10 });
  const { vx, vy } = vt.get();
  ok(Math.abs(vx - 1200) < 1 && vy === 0, `velocity over the last 80ms: 12px per 10ms = 1200px/s (${vx.toFixed(0)})`);
  const still = velocityTracker();
  still.add({ x: 3, y: 3, t: 1 });
  ok(still.get().vx === 0, 'one sample is no velocity');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
