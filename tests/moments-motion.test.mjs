// Motion 2 · Moments (docs/motion2-plan.md package E). jsdom + the real modules.
//   node tests/moments-motion.test.mjs
//
// Tim, 2026-09-25: *"Put professional level annimation and physics into this
// cite … Think about the potential for any additions and where they could be.
// Impress me."*
//
// What is pinned here is what a screenshot cannot see: the maths each moment is
// built on (a box flown onto another box, an odometer's columns, a pull's dial,
// the finish screen's timeline), that every moment is OFF where motion is off
// and leaves the words exactly as they were, and that the loading shapes carry
// no text. The movement itself is checked in WebKit with frame strips.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.HTMLElement = window.HTMLElement;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
try { globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage; } catch (_) {}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const P = await import(new URL('js/photo.js', root).href);
const W = await import(new URL('js/workout-card.js', root).href);
const M = await import(new URL('js/motion.js', root).href);
const S = await import(new URL('js/spring.js', root).href);
const V = await import(new URL('js/views-session.js', root).href);
const G = await import(new URL('js/views-goals.js', root).href);

/* ---------- 1. one box flown onto another (photo.js rectFlight) ---------- */
{
  const { rectFlight } = P;
  ok(typeof rectFlight === 'function', 'photo.js exports rectFlight()');
  if (typeof rectFlight === 'function') {
    const same = rectFlight({ x: 10, y: 20, w: 100 }, { x: 10, y: 20, w: 100 });
    ok(same.x === 0 && same.y === 0 && same.scale === 1, 'a box flown onto itself is the identity');
    // The runner (393×659 app) into its bar (377 wide, 530 down).
    const app = { left: 0, top: 0, width: 393 };
    const bar = { left: 8, top: 530, width: 377 };
    const t = rectFlight(app, bar);
    ok(t.x === 8 && t.y === 530 && Math.abs(t.scale - 377 / 393) < 1e-9,
       `the runner lands on the bar: top-left on its top-left, scaled to its width (${t.x}, ${t.y}, ×${t.scale.toFixed(3)})`);
    const thumb = rectFlight({ x: 0, y: 100, w: 393 }, { x: 16, y: 300, w: 120 });
    ok(thumb.scale < 1 && thumb.y === 200, 'a viewer image starts on its thumbnail (smaller, lower)');
    const bad = rectFlight({ x: 0, y: 0, w: 0 }, { x: 5, y: 5, w: 5 });
    ok(bad.x === 0 && bad.y === 0 && bad.scale === 1, 'a zero-width box is left where it is, never a divide by zero');
  }
}

/* ---------- 2. kudos: the odometer and the words ---------- */
{
  const { odometerPlan, kudosLabel, rollCount, kudosPop } = W;
  ok(typeof odometerPlan === 'function' && typeof kudosLabel === 'function' && typeof rollCount === 'function',
     'workout-card.js exports odometerPlan(), kudosLabel() and rollCount()');
  if (typeof odometerPlan === 'function') {
    const a = odometerPlan(1, 2);
    ok(a.up && a.cols.length === 1 && a.cols[0].roll && a.cols[0].from === '1' && a.cols[0].to === '2',
       '1 → 2 rolls one digit, upward');
    const b = odometerPlan(9, 10);
    ok(b.up && b.cols.length === 2 && b.cols[0].from === '' && b.cols[0].to === '1' && b.cols[1].from === '9' && b.cols[1].to === '0',
       '9 → 10 rolls both columns, right-aligned (a new tens digit rolls in from nothing)');
    const c = odometerPlan(12, 11);
    ok(!c.up && !c.cols[0].roll && c.cols[1].roll, '12 → 11 rolls only the digit that changed, downward');
    const d = odometerPlan('', 1);
    ok(d.up && d.cols.length === 1 && d.cols[0].from === '' && d.cols[0].to === '1', 'the first kudos rolls up out of an empty cell');
  }
  if (typeof kudosLabel === 'function') {
    ok(kudosLabel(0).textContent === 'Kudos', 'no kudos: the button says "Kudos", exactly as before');
    const l = kudosLabel(3);
    ok(l.textContent === 'Kudos · 3' && l.querySelector('.kudos-n') && l.querySelector('.kudos-n').textContent === '3',
       'three: "Kudos · 3", the number in its own span for the roll');
  }
  if (typeof rollCount === 'function') {
    const n = document.createElement('span'); n.textContent = '4';
    ok(rollCount(n, 3, 4) === false && n.textContent === '4', 'motion off (jsdom): nothing rolls, the number is plain text');
    M.__setMotionForTest(true); S.__setReducedMotionForTest(true);
    const n2 = document.createElement('span'); n2.textContent = '10';
    document.body.append(n2);
    const played = rollCount(n2, 9, 10);
    await settle(30);
    ok(played === true && n2.textContent === '10' && !n2.querySelector('.odo-d'),
       'motion on: it rolls, and at rest the node is plain "10" again (no odometer left behind)');
    const g = document.createElement('span');
    ok(kudosPop(g) === true && g.classList.contains('m-sprung'), 'the thumb pop switches the CSS keyframe off (m-sprung) and springs');
    M.__setMotionForTest(null); S.__setReducedMotionForTest(null);
    n2.remove();
  }
}

/* ---------- 3. the pull's dial, and pull-to-refresh off where it cannot run ---------- */
{
  const { pullDial, pullToRefresh, PTR_THRESHOLD, PTR_HOLD, PTR_LIMIT } = W;
  ok(typeof pullDial === 'function' && typeof pullToRefresh === 'function', 'workout-card.js exports pullDial() and pullToRefresh()');
  if (typeof pullDial === 'function') {
    const z = pullDial(0);
    ok(z.progress === 0 && z.opacity === 0 && !z.armed, 'no pull: an invisible, empty, unarmed dial');
    const h = pullDial(PTR_THRESHOLD / 2);
    ok(h.progress === 0.5 && !h.armed && h.turn > 0, 'half way: half the ring, turned with the finger, not armed');
    ok(pullDial(PTR_THRESHOLD).armed && pullDial(PTR_THRESHOLD * 3).progress === 1, 'at the threshold it arms; past it the ring stays full');
    ok(PTR_HOLD < PTR_THRESHOLD && PTR_THRESHOLD < PTR_LIMIT, `hold (${PTR_HOLD}) < threshold (${PTR_THRESHOLD}) < rubber-band limit (${PTR_LIMIT})`);
    const armAt = (() => { for (let dy = 0; dy < 600; dy++) if (S.rubberBand(dy, PTR_LIMIT, 1) >= PTR_THRESHOLD) return dy; return Infinity; })();
    ok(armAt > PTR_THRESHOLD && armAt < 140, `the finger travels further than the feed (arms after ${armAt}px of finger) but not absurdly far`);
  }
  if (typeof pullToRefresh === 'function') {
    const pane = document.createElement('div');
    ok(pullToRefresh(pane, () => {}) === null && !pane.querySelector('.m-ptr'),
       'motion off (jsdom): no refresh gesture, nothing added to the pane');
  }
}

/* ---------- 4. skeletons carry the shape, never words ---------- */
{
  const { feedSkeleton, skelBar } = W;
  ok(typeof feedSkeleton === 'function', 'workout-card.js exports feedSkeleton()');
  if (typeof feedSkeleton === 'function') {
    const cards = feedSkeleton(3);
    ok(cards.length === 3 && cards.every((c) => c.getAttribute('aria-hidden') === 'true' && c.textContent === ''),
       'three placeholder cards, hidden from screen readers, with no text at all');
    ok(cards.every((c) => !c.matches('.feed-card') && !c.querySelector('.feed-card')),
       'they are not .feed-card — so motion.js never staggers them and the tour never points at one');
  }
  const home = read('js/views-workouts.js');
  ok(/el\('div', \{ class: 'feed', 'aria-busy': 'true' \}, \.\.\.feedSkeleton\(3\)\)/.test(home),
     'Home starts with the skeleton in its feed and says it is busy');
  const me = read('js/views-me.js');
  ok(/'me-body', 'aria-busy': 'true' \}, \.\.\.profileSkeleton\(\)/.test(me) && !/m-skel[^']*me-head/.test(me),
     'Profile starts with its skeleton, which does not borrow .me-head (the tour and tests look for that)');
}

/* ---------- 5. the finish screen's timeline ---------- */
{
  const { finishTimeline } = V;
  ok(typeof finishTimeline === 'function', 'views-session.js exports finishTimeline()');
  if (typeof finishTimeline === 'function') {
    for (const n of [0, 1, 3, 8]) {
      const t = finishTimeline(n, 2);
      ok(t.endMs <= 1200, `${n} record group(s): the whole sequence ends by ${t.endMs}ms (≤1.2s)`);
      ok(t.prs.every((v, i) => i === 0 || v > t.prs[i - 1]) && t.prs.every((v) => v <= V.FINISH_PR_LAST),
         `${n}: each record shines after the one above it, none starting after ${V.FINISH_PR_LAST}ms`);
    }
    const t = finishTimeline(2, 2);
    ok(t.draw < t.counts[0] && t.counts[0] < t.counts[1] && t.counts[1] < t.prs[0],
       'order: the check draws, then the two numbers count, then the records shine');
    // Review 2026-09-25: the exercise list came in ~330ms late and faint.
    const r = finishTimeline(0, 2, 6);
    ok(typeof r.rows === 'number' && r.rows > t.draw && r.rows <= 200,
       `the exercise rows follow right behind the check (${r.rows}ms, ≤200)`);
    ok(r.inMs <= 900, `everything has arrived by ${r.inMs}ms (≤900; the shines after are the celebration tier)`);
  }
  ok(/\.screen:has\(\.finish-hero\)\s*\{\s*animation:\s*none/.test(read('css/app.css')),
     'the finish screen is on screen from its first frame — no whole-screen fade from 0 (it was 0.51 at 143ms)');
  const src = read('js/views-session.js');
  ok(/export function minimizeFlight\(/.test(src) && /export function restoreFlight\(/.test(src),
     'the runner exports minimizeFlight() and restoreFlight() for the bar');
  ok(/if \(!minimizeFlight\(leaving\)\) parkScreen\(leaving, \{ falls: true \}\)/.test(src),
     'minimise flies into the bar, and falls off the bottom as before wherever the flight cannot run');
  const fly = src.slice(src.indexOf('export function minimizeFlight('), src.indexOf('export function restoreFlight('));
  ok(/scale\(\$\{lerp\(a\.sx[\s\S]*lerp\(a\.sy/.test(src) && /flyPlan\(from, /.test(fly),
     'minimise scales BOTH axes onto the bar (it measured 0.983→1.0 with a width-only scale)');
  ok(/ghost\.animate\(/.test(fly) && !/requestAnimationFrame\(\(\) =>[^)]*ghost\.animate/.test(fly),
     'and it is a web animation started in the tap\'s own task, not a spring waiting for the first frame after the render');
}

/* ---------- 6. goals: the bar springs once, and only with motion ---------- */
{
  const { springFill } = G;
  ok(typeof springFill === 'function', 'views-goals.js exports springFill()');
  if (typeof springFill === 'function') {
    const f = document.createElement('div'); f.style.width = '62.0%';
    springFill(f, 62, 'goal:test');
    ok(parseFloat(f.style.width) === 62 && !f.dataset.mSeen, `motion off: the bar is drawn at its width, untouched (${f.style.width})`);
    M.__setMotionForTest(true); S.__setReducedMotionForTest(true);
    const f2 = document.createElement('div'); f2.style.width = '40%';
    springFill(f2, 40, 'goal:test2');
    const zeroFirst = f2.style.width === '0%' && f2.dataset.mSeen === '1';
    await settle(40);
    ok(zeroFirst && parseFloat(f2.style.width) === 40,
       'motion on: it starts at 0, tells motion.js to leave it alone, and lands exactly on its width');
    const f3 = document.createElement('div'); f3.style.width = '40%';
    springFill(f3, 40, 'goal:test2');
    ok(f3.style.width === '40%', 'the same goal shown again this session does not refill');
    M.__setMotionForTest(null); S.__setReducedMotionForTest(null);
  }
}

/* ---------- 7. the stylesheet section ---------- */
{
  const css = read('css/app.css');
  const sec = css.match(/\/\* === Motion 2 · Moments === \*\/[\s\S]*?\/\* === end Motion 2 · Moments === \*\//);
  ok(Boolean(sec), 'the Moments section is in app.css, fenced');
  if (sec) {
    const live = sec[0].replace(/\/\*[\s\S]*?\*\//g, '');
    const rm = live.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
    ok(Boolean(rm) && /\.m-skel-bar::after/.test(rm[0]) && /\.m-ptr svg/.test(rm[0]) && /animation: none !important/.test(rm[0]),
       'reduced motion stops the shimmer and the spinner outright (an infinite loop at .01ms would flicker)');
    ok(/\.screen\.m-restoring \{[^}]*animation: none !important/.test(live),
       'the restoring runner turns its rise keyframe off, so the spring is the only thing moving it');
    ok(/\.m-ptr-host\.is-pulling > \*/.test(live) && !/\.m-ptr-host > \* \{/.test(live),
       'the pane\'s children are transformed only while a pull is on screen');
    ok(/\.m-ptr-host \{[^}]*overscroll-behavior-y: none/.test(live),
       'Home\'s pane turns its own bounce off, so there is one rubber band, not two');
    ok(!/var\(--t-celebrate\)/.test(live), 'this section never uses --t-celebrate (celebrate() does, through .m-celebrate)');
  }
}

console.log(fails ? `\n${fails} FAIL` : '\nall pass');
process.exit(fails ? 1 : 0);
