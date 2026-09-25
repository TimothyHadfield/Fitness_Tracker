// Navigation motion (docs/motion2-plan.md, package B). jsdom + the real modules.
//   node tests/nav-motion.test.mjs
//
// Tim, 2026-09-25: *"Put professional level annimation and physics into this
// cite."* Package B is the navigation half: a pushed screen slides in from the
// right over the one it came from, back is the exact reverse, a tab switch
// crossfades, Record rises as a card over the screen behind it, the left edge
// swipes back, and the tab bar's selection slides.
//
// What is pinned here is what a screenshot cannot see: which movement each
// navigation gets (push / back / tab / rise / fall / none), the geometry of
// every frame as a function of progress, the release decision of a drag, that
// every movement is a spring inside Rule 7's physics tier, that nothing is built
// where nothing can move (jsdom, reduced motion), and that a finished movement
// leaves no inline style or stray layer behind. Frames themselves are checked
// in WebKit (scratchpad strips), not here.
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
globalThis.location = window.location;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const UI = await import(new URL('js/ui.js', root).href);
const G = await import(new URL('js/gestures.js', root).href);
const S = await import(new URL('js/spring.js', root).href);

/* ---------- 1. the router knows which way you went ---------- */
{
  const d = UI.navDirectionFor;
  ok(typeof d === 'function' && typeof UI.navDirection === 'function', 'ui.js exports navDirection() and its pure core');
  ok(d({ fresh: true, tab: false }) === 'push', 'a new history entry is a push');
  ok(d({ fresh: true, tab: true }) === 'tab', 'a new entry made by the tab bar is a tab switch');
  ok(d({ from: 4, to: 3 }) === 'back', 'an older entry is back');
  ok(d({ from: 3, to: 4 }) === 'forward', 'a newer entry is forward');
  ok(d({ from: 3, to: 3 }) === 'replace', 'the same entry is a re-render (replace)');
  ok(d({ from: 4, to: 3, fromVia: 'tab' }) === 'tab',
     'backing out of an entry the TAB BAR made is a tab switch, not a slide — tabs are not a stack');
  ok(d({ from: 3, to: 4, toVia: 'tab' }) === 'tab', 'and so is going forward into one');

  // markRoute() stamps, navDirection() reads — in jsdom's real history.
  const h = window.history;
  h.replaceState(null, '', '#/home');
  UI.markRoute();
  const i0 = h.state.navIndex;
  h.pushState(null, '', '#/workouts');
  UI.markTabNav();
  UI.markRoute();
  ok(UI.navDirection() === 'tab' && h.state.navVia === 'tab' && h.state.navIndex === i0 + 1,
     `a tab tap stamps its entry (navVia=${h.state.navVia}, dir=${UI.navDirection()})`);
  h.pushState(null, '', '#/workout/x');
  UI.markRoute();
  ok(UI.navDirection() === 'push' && !h.state.navVia, `a link inside it is a push (${UI.navDirection()})`);
  ok(UI.currentNavIndex() === i0 + 2, 'currentNavIndex() is the entry on screen');
  // A back: the entry being returned to already carries its index.
  h.replaceState({ navIndex: i0 + 1, navVia: 'tab' }, '', '#/workouts');
  UI.markRoute();
  ok(UI.navDirection() === 'back' && UI.navRevisit() === true, `returning to an older entry is back, and a revisit (${UI.navDirection()})`);
  h.replaceState({ navIndex: i0 + 1, navVia: 'tab' }, '', '#/workouts');
  UI.markRoute();
  ok(UI.navDirection() === 'replace', 'rendering the same entry again is a replace');
  // A tab intent that never became a navigation must not leak into the next one.
  UI.markTabNav();
  h.pushState(null, '', '#/workout/y');
  const realNow = Date.now;
  Date.now = () => realNow() + 5000;
  UI.markRoute();
  Date.now = realNow;
  ok(UI.navDirection() === 'push', `a stale tab intent (>1.5s old) is ignored (${UI.navDirection()})`);
}

/* ---------- 2. which movement each navigation gets ---------- */
{
  const pick = G.pickTransition;
  const base = { hasLeaving: true, from: 'home', to: 'workout' };
  ok(pick({ ...base, dir: 'push' }) === 'push', 'push → slide in from the right');
  ok(pick({ ...base, dir: 'forward' }) === 'push', 'forward → the same slide');
  ok(pick({ ...base, dir: 'back' }) === 'back', 'back → the exact reverse');
  ok(pick({ ...base, dir: 'tab' }) === 'tab', 'tab → crossfade');
  ok(pick({ ...base, dir: 'replace' }) === 'none', 'a re-render in place does not move');
  ok(pick({ ...base, dir: 'push', hasLeaving: false }) === 'none', 'a cold open has nothing to move from');
  ok(pick({ ...base, dir: 'push', rising: true }) === 'rise', 'Record (and a resumed workout) rise as a card');
  ok(pick({ ...base, dir: 'push', falling: true, hasLeaving: false }) === 'fall', 'the down arrow drops the card');
  ok(pick({ ...base, dir: 'back', from: 'record', to: 'home' }) === 'fall',
     'the OS back button on Record drops the card too, rather than sliding it sideways');
  ok(pick({ ...base, dir: 'push', from: 'session', to: 'session' }) === 'none',
     '🚨 nothing slides INSIDE the runner (the logging path)');
  ok(pick({ ...base, dir: 'push', from: 'record', to: 'session' }) === 'push', 'entering the runner may move');
  ok(pick({ ...base, dir: 'tab', hint: 'back' }) === 'back', 'an edge swipe finishes as a back whatever the entry says');
}

/* ---------- 3. the frames ---------- */
{
  const f = G.frameFor;
  const W = 393, H = 659;
  const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
  let a = f('push', 0, { W, H, phone: true });
  let b = f('push', 1, { W, H, phone: true });
  ok(near(a.inX, W) && near(a.outX, 0) && near(b.inX, 0) && near(b.outX, -0.3 * W),
     `push (phone): new screen from x=${a.inX} to ${b.inX}, old parallaxes 0 → ${b.outX.toFixed(1)} (30%)`);
  ok(a.dim === 0 && b.dim > 0 && b.dim <= 1, 'the screen being covered dims as it goes');
  const back = f('back', 0.25, { W, H, phone: true }), push = f('push', 0.75, { W, H, phone: true });
  ok(near(back.inX, push.outX) && near(back.outX, push.inX) && near(back.dim, push.dim),
     'back at p is push at 1−p, frame for frame — the exact reverse');
  a = f('push', 0, { W: 1240, H: 900, phone: false });
  b = f('push', 1, { W: 1240, H: 900, phone: false });
  ok(near(a.inX, 40) && near(a.inOpacity, 0) && near(b.inX, 0) && near(b.inOpacity, 1),
     `push (laptop): a short 40px slide and a fade (${a.inX}px)`);
  a = f('tab', 0, { W, H, phone: true });
  b = f('tab', 1, { W, H, phone: true });
  ok(near(a.inOpacity, 0) && near(a.inScale, 0.985, 1e-4) && near(b.inScale, 1) && near(b.inOpacity, 1) && a.inX === 0,
     `tab: crossfade with a tiny scale ${a.inScale} → 1, and no direction`);
  a = f('rise', 0, { W, H, phone: true });
  b = f('rise', 1, { W, H, phone: true });
  ok(near(a.inY, H) && near(b.inY, 0) && near(b.outScale, 0.94) && b.outRadius > 0 && near(a.outScale, 1),
     `rise (phone): the card comes up ${H}px and the screen behind goes back to ${b.outScale}`);
  ok(b.inRadius === 0 && a.inRadius > 0, 'and the card squares off as it lands — at rest Record is the full screen it always was');
  const lr = f('rise', 1, { W: 1440, H: 900, phone: false });
  ok(near(lr.outScale, 1), 'rise (laptop): the screen behind is not scaled');
  const fa = f('fall', 0.3, { W, H, phone: true }), ri = f('rise', 0.7, { W, H, phone: true });
  ok(near(fa.outScale, ri.outScale) && near(fa.dim, ri.dim), 'fall at p is rise at 1−p for the screen behind');
}

/* ---------- 4. every movement is a spring inside Rule 7's physics tier ---------- */
{
  const P = G.NAV_SPRINGS;
  ok(P && ['push', 'back', 'tab', 'rise', 'fall'].every((k) => P[k] && typeof P[k].k === 'number'),
     `every movement names its spring (${JSON.stringify(P)})`);
  // 🔄 Review, 2026-09-25: "within 1%" was not when the screen came to rest.
  // The movement ends when spring.js's OWN rest rule fires (|x−1| < precision
  // AND |v| < precision×10, the precision the router passes) — that was
  // measured at ~660ms for `glide` at 0.0005. Pin the real moment.
  const eps = G.NAV_PRECISION;
  ok(typeof eps === 'number' && eps > 0 && eps * 393 < 1, `rests within a pixel of a phone's width (${eps} × 393 = ${(eps * 393).toFixed(2)}px)`);
  for (const [kind, preset] of Object.entries(P)) {
    const s = S.simulate({ from: 0, to: 1, preset, ms: 1000 });
    const t90 = s.find((x) => x.x >= 0.9).t;
    const rest = s.find((x) => Math.abs(x.x - 1) < eps && Math.abs(x.v) < eps * 10);
    const over = Math.max(...s.map((x) => x.x)) - 1;
    ok(t90 <= 250 && rest && rest.t <= 400 && over < 0.001,
       `${kind}: 90% of the way in ${t90.toFixed(0)}ms, AT REST by ${rest ? rest.t.toFixed(0) : '∞'}ms, no overshoot`);
  }
}

/* ---------- 4b. review fixes: nothing seen twice, nothing on a laptop but the arrival ---------- */
{
  const f = G.frameFor;
  const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;
  const desk = { W: 1240, H: 900, phone: false };
  const ps = [0, 0.3, 0.6, 1];
  ok(ps.every((p) => { const x = f('push', p, desk); return x.outX === 0 && x.dim === 0 && x.outOpacity === 1; }),
     'laptop push: the screen being left does not move, fade or dim — it is covered, not seen through');
  const b0 = f('back', 0, desk), b1 = f('back', 1, desk);
  ok(near(b0.inX, -G.DESK_SHIFT) && near(b0.inOpacity, 0) && near(b1.inX, 0) && near(b1.inOpacity, 1) && b0.outX === 0,
     `laptop back: the returning screen arrives from the other side (${b0.inX}px), in place`);
  ok(G.EARLY_FADE_MS > 0 && G.EARLY_FADE_MS <= 100, `the old content goes from the tap, fast (${G.EARLY_FADE_MS}ms)`);
}

/* ---------- 5. letting go of a drag ---------- */
{
  const r = G.releaseDecision;
  ok(r({ offset: 40, velocity: 0, size: 393 }) === false, 'a short slow drag springs back');
  ok(r({ offset: 220, velocity: 0, size: 393 }) === true, 'past half way and let go: it completes');
  ok(r({ offset: 60, velocity: 1200, size: 393 }) === true, 'a flick completes from anywhere');
  ok(r({ offset: 260, velocity: -900, size: 393 }) === false, 'a flick back the other way cancels even past half');
  ok(G.rubber(-100) < 0 && G.rubber(-100) > -40 && G.rubber(-1000) > -40, 'dragging the card up resists and never passes its limit');
  ok(G.edgeZone(10, true) && !G.edgeZone(30, true), 'home-screen app: the back swipe starts within 24px of the edge');
  ok(!G.edgeZone(10, false) && G.edgeZone(30, false) && !G.edgeZone(60, false),
     'in Safari: 20–44px, so Safari keeps its own swipe from the very edge');
}

/* ---------- 6. nothing is built where nothing can move ---------- */
{
  ok(G.canMove() === false, 'jsdom: no Element.animate, so no movement');
  const app = document.getElementById('app');
  const old = document.createElement('div');
  old.className = 'screen';
  app.replaceChildren(old);
  const t = G.beginNav({ dir: 'push', from: 'home', to: 'workout', leaving: old, app, fromIndex: 0, fromHash: '#/home' });
  ok(t === null && !document.querySelector('.screen-ghost, .nav-snap, .nav-dim') && old.parentNode === app,
     '🔒 no ghost, no layer and the screen left where it was — every other suite sees one screen');
  G.syncTabIndicator(document.createElement('nav'));
  ok(!document.querySelector('.nav-ind'), 'no tab indicator is drawn without layout');
}

/* ---------- 7. a finished movement leaves nothing behind ---------- */
{
  // Pretend to be a browser with no animation frames: springs land at once
  // (spring.js lands synchronously without requestAnimationFrame), so each
  // transition runs to completion inside play() and can be inspected.
  window.Element.prototype.animate = function () {};
  window.matchMedia = () => ({ matches: false });
  S.__setReducedMotionForTest(false);
  ok(G.canMove() === true, 'with Element.animate and no reduced motion, movement is allowed');
  const app = document.getElementById('app');
  const nav = document.createElement('nav'); nav.className = 'navbar';
  for (const kind of ['push', 'back', 'tab', 'rise']) {
    const old = document.createElement('div'); old.className = 'screen';
    old.innerHTML = '<div class="pane-scroll"><p>old</p></div>';
    app.replaceChildren(nav, old);
    const dir = kind === 'rise' ? 'push' : kind;
    const t = G.beginNav({ dir, from: 'home', to: kind === 'rise' ? 'record' : 'workout', rising: kind === 'rise',
      leaving: old, app, parkNav: kind === 'rise', fromIndex: 7, fromHash: '#/home' });
    ok(t && t.kind === kind && old.parentNode !== app, `${kind}: the old screen is parked out of #app before the new one is built`);
    const fresh = document.createElement('div'); fresh.className = 'screen';
    app.replaceChildren(fresh);
    t.play(fresh);
    const stray = document.querySelectorAll('.screen-ghost, .nav-dim, .nav-snap');
    ok(!stray.length && !fresh.getAttribute('style') && !app.getAttribute('style')
       && !/nav-/.test(fresh.className) && !document.body.classList.contains('nav-card'),
       `${kind}: at rest there is no ghost, no dim, no inline style and no nav- class (${stray.length} stray, style="${fresh.getAttribute('style') || ''}")`);
  }
  ok(G.__snapshotCount() >= 1, `the screens it left are kept as pictures for the back swipe (${G.__snapshotCount()})`);

  // Review fixes, 2026-09-25 (jsdom is 1024px wide: a laptop).
  const html = document.documentElement;
  const withBar = (cls) => {
    const s = document.createElement('div'); s.className = cls || 'screen';
    s.innerHTML = '<div class="demo-bar">Demo</div><div class="pane-scroll"><p>x</p></div>';
    s.firstChild.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1024, bottom: 30, width: 1024, height: 30 });
    return s;
  };
  for (const kind of ['tab', 'push', 'rise']) {
    const old = withBar();
    app.replaceChildren(nav, old);
    const t = G.beginNav({ dir: kind === 'rise' ? 'push' : kind, from: 'home', to: kind === 'rise' ? 'record' : 'workout',
      rising: kind === 'rise', leaving: old, app, parkNav: kind === 'rise', fromIndex: 9, fromHash: '#/home' });
    ok(html.getAttribute('data-nav-moving') === kind,
       `${kind}: <html data-nav-moving> is set while it moves (motion.js keeps its row cascade off it)`);
    const pins = document.querySelectorAll('.nav-banner-pin').length;
    // Review 4: a card keeps its own strip and so does the screen behind it —
    // the pinned copy sat above the rising card and doubled its strip.
    ok(pins === 0 && !document.body.classList.contains('nav-pinned'),
       `${kind}: ${kind === 'rise' ? 'a card pins no copy of the strip (each sheet keeps its own)' : 'arrives in place, so the strip needs no copy'} (${pins})`);
    ok(kind === 'rise' ? true : Boolean(t.lead && typeof t.lead.then === 'function'),
       `${kind}: hands the router a lead to await, so the old content starts going before a heavy view builds`);
    const fresh = withBar();
    app.replaceChildren(nav, fresh);
    t.play(fresh);
    ok(!html.hasAttribute('data-nav-moving') && !document.querySelector('.nav-banner-pin') && !document.body.classList.contains('nav-pinned'),
       `${kind}: at rest the flag, the pinned strip and its class are gone`);
    ok([...fresh.children].every((c) => !c.getAttribute('style')), `${kind}: and the content carries no inline style`);
    ok(fresh.classList.contains('landed'), `${kind}: the landed screen is marked so .screen's CSS arrival does not start after it`);
  }
  // …and on a phone: a sideways slide still pins ONE strip; a card pins none.
  {
    const realW = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 393, configurable: true });
    for (const kind of ['push', 'rise']) {
      const old = withBar();
      app.replaceChildren(old);
      const t = G.beginNav({ dir: 'push', from: 'home', to: kind === 'rise' ? 'record' : 'workout',
        rising: kind === 'rise', leaving: old, app, parkNav: true, fromIndex: 11, fromHash: '#/home' });
      const pins = document.querySelectorAll('.nav-banner-pin').length;
      ok(kind === 'push' ? pins === 1 : pins === 0 && !document.body.classList.contains('nav-pinned'),
         `phone ${kind}: ${kind === 'push' ? 'ONE strip pinned while two screens slide' : 'no pinned copy over the rising card (it doubled the card\'s strip)'} (${pins})`);
      const fresh = withBar();
      app.replaceChildren(fresh);
      t.play(fresh);
      ok(!document.querySelector('.nav-banner-pin'), `phone ${kind}: and none at rest`);
      ok(!old.querySelector('.demo-bar').getAttribute('style'),
         `phone ${kind}: the strip of the screen left behind carries no inline opacity at rest (its picture is whole)`);
    }
    // The strip BEHIND a card fades as the card's top comes within a strip's
    // height of it, so the laptop never shows the two stacked (review 4).
    const bo = G.behindStripOpacity;
    ok(typeof bo === 'function' && bo(120, 40) === 1 && bo(80, 40) === 1 && bo(60, 40) === 0.5 && bo(40, 40) === 0 && bo(0, 40) === 0,
       'behind strip: whole while the card is 2 strips away, gone by the time the card reaches it');
    Object.defineProperty(window, 'innerWidth', { value: realW, configurable: true });
  }
  // Reduced motion: nothing again.
  S.__setReducedMotionForTest(true);
  const old = document.createElement('div'); old.className = 'screen';
  app.replaceChildren(old);
  ok(G.beginNav({ dir: 'push', from: 'home', to: 'workout', leaving: old, app, fromIndex: 1 }) === null,
     '🚨 prefers-reduced-motion: no movement at all');
  S.__setReducedMotionForTest(false);
}

/* ---------- 8. the wiring ---------- */
{
  const app = read('js/app.js');
  const r = app.slice(app.indexOf('async function render()'));
  ok(r.indexOf('settleNavigation()') > 0 && r.indexOf('settleNavigation()') < r.indexOf('markRoute()'),
     'a movement still running lands BEFORE the next navigation is read');
  ok(/beginNav\(/.test(r) && r.indexOf('beginNav(') < r.indexOf('await resolve(route)'),
     'the old screen is parked before the next view is awaited (it stays on screen while the store reads)');
  ok(/\.play\(screen\)/.test(r), 'and the movement plays once the new screen is in #app');
  ok(/syncTabIndicator\(/.test(r) && /initGestures\(/.test(app), 'the tab indicator and the gestures are wired');
  ok(/markTabNav\(\)/.test(app), 'a tab-bar tap marks its navigation as a tab switch');
  const tr = r.indexOf('isTabRoot(location.hash)');
  ok(tr > 0 && tr < r.indexOf('markRoute()') && /tabByLink\) markTabNav\(\)/.test(r),
     'a LINK to a tab\'s root ("Back to home") is a tab switch too — marked before markRoute() reads it');
  ok(/await move\.lead/.test(r) && r.indexOf('await move.lead') < r.indexOf('await resolve(route)'),
     'the router lets the first frame of a movement paint before it builds the next view');
  const css0 = read('css/app.css');
  ok(/\.screen\.landed\s*\{[^}]*animation:\s*none/.test(css0), 'a landed screen does not replay the CSS arrival');
  ok(/body\.nav-pinned \.demo-bar:not\(\.nav-banner-pin\)\s*\{[^}]*visibility:\s*hidden/.test(css0),
     'while a strip is pinned the moving copies are hidden, not removed (nothing shifts)');
  ok(!/parkScreen\(leaving\)/.test(app), 'Record no longer rises on the CSS keyframe path');
  ok(read('sw.js').includes("'./js/gestures.js'"), 'gestures.js is precached for offline');
  const css = read('css/app.css');
  const a = css.indexOf('/* === Motion 2 · Navigation === */');
  const b = css.indexOf('/* === end Motion 2 · Navigation === */');
  ok(a > 0 && b > a, 'app.css has the Motion 2 · Navigation section');
  const sec = css.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.nav-moving[^{]*\{[^}]*animation:\s*none/.test(sec), 'a screen a spring is moving does not also play the CSS arrival');
  ok(/\.nav-fall[^{]*\{[^}]*animation:\s*none/.test(sec), 'the dropped card is spring-driven, not the old keyframe');
  ok(!/transition:[^;]*transform/.test(sec), '🚨 no CSS transition on transform in this section — springs write it');
  const rm = (sec.match(/prefers-reduced-motion[^{]*\{([\s\S]*?)\n\}/) || [])[1] || '';
  ok(rm && !/\.nav-ind/.test(rm), '🚨 reduced motion does not pin the tab indicator (its transform is its place)');
  const g = read('js/gestures.js');
  ok(/passive:\s*false/.test(g) && /preventDefault\(\)/.test(g), 'the swipe listens non-passively so it can stop the page scrolling under it');
  ok(/'session'/.test(g), 'the edge swipe knows the runner is off limits');
}

/* ---------- 9. phone review 3 (2026-09-25, WebKit 393×659) ---------- */
{
  // A tab switch flashed BLANK: the old content went all the way out in 90ms
  // and the new came in from 0 once built, with nothing on screen between.
  // Now the tap only dims the old content, and the two crossfade.
  const calls = [];
  window.Element.prototype.animate = function (frames) { calls.push({ node: this, frames }); };
  window.matchMedia = () => ({ matches: false });
  S.__setReducedMotionForTest(false);
  const app = document.getElementById('app');
  const nav = document.createElement('nav'); nav.className = 'navbar';
  const old = document.createElement('div'); old.className = 'screen';
  old.innerHTML = '<div class="demo-bar">Demo</div><div class="pane-scroll"><p>old</p></div>';
  const oldPane = old.querySelector('.pane-scroll');
  app.replaceChildren(nav, old);
  const t = G.beginNav({ dir: 'tab', from: 'home', to: 'graphs', leaving: old, app, fromIndex: 11, fromHash: '#/home' });
  const fade = calls.find((c) => c.node === oldPane);
  const endsAt = fade && fade.frames[fade.frames.length - 1].opacity;
  ok(Boolean(fade) && endsAt > 0.2 && endsAt < 0.8,
     `the tap DIMS the old content (to ${endsAt}), it does not empty the screen (was 0: a blank frame on every tab)`);
  ok(!calls.some((c) => c.node === old.querySelector('.demo-bar')), 'the demo strip is not faded with it');
  const fresh = document.createElement('div'); fresh.className = 'screen';
  fresh.innerHTML = '<div class="pane-scroll"><p>new</p></div>';
  app.replaceChildren(nav, fresh);
  // The spring lands inside play() here (no frames), so the class is watched as it is added.
  let seeThrough = false;
  const add = fresh.classList.add.bind(fresh.classList);
  fresh.classList.add = (...c) => { if (c.includes('nav-xfade')) seeThrough = true; return add(...c); };
  t.play(fresh);
  ok(seeThrough, 'the arriving screen is see-through while it moves (nav-xfade), so the old content shows under it');
  ok(!oldPane.getAttribute('style') && !/nav-/.test(fresh.className) && !fresh.getAttribute('style'),
     'and at rest nothing is left: no inline style on the old picture or the new screen');
  const css = read('css/app.css');
  ok(/\.screen\.nav-moving\.nav-xfade\s*\{\s*background:\s*transparent/.test(css), 'the stylesheet drops its ground for that');
  /* Review 4: at ~60ms both screens stood at about half strength and their text
   * overlapped (measured per frame in WebKit: old 0.52 / new 0.24 on a laptop
   * push, 0.41 / 0.25 on a phone tab). The handoff is checked over the real
   * springs, from wherever the tap's dim had got the old content to: the old
   * is ≤ 0.15 before the new passes 0.4, and the two are never both above 0.12.
   * (Before the fix there was no `oldOpacityAt`; the fallback models the old
   * rule — old gone by XFADE_OUT of the way, new = progress — so this fails on it.) */
  const oldAt = (t, x, from) => (typeof G.oldOpacityAt === 'function'
    ? G.oldOpacityAt(t, from) : from * Math.max(0, 1 - x / G.XFADE_OUT));
  for (const [kind, preset, dims] of [['tab', G.NAV_SPRINGS.tab, { W: 393, H: 659, phone: true }],
    ['tab', G.NAV_SPRINGS.tab, { W: 1240, H: 900, phone: false }],
    ['push', G.NAV_SPRINGS.push, { W: 1240, H: 900, phone: false }],
    ['back', G.NAV_SPRINGS.back, { W: 1240, H: 900, phone: false }]]) {
    for (const from of [1, 0.8, 0.4]) {
      let worst = 0; let oldWhenNew40 = null; let gone = null; let t90 = null;
      for (const q of S.simulate({ from: 0, to: 1, preset, ms: 600 })) {
        const o = oldAt(q.t, q.x, from);
        const n = G.frameFor(kind, q.x, dims).inOpacity;
        worst = Math.max(worst, Math.min(o, n));
        if (oldWhenNew40 === null && n > 0.4) oldWhenNew40 = o;
        if (gone === null && o <= 0.001) gone = q.t;
        if (t90 === null && n >= 0.9) t90 = q.t;
      }
      ok(oldWhenNew40 !== null && oldWhenNew40 <= 0.15 && worst <= 0.12 && gone !== null && gone <= 90 && t90 !== null && t90 <= 250,
         `${kind} (${dims.phone ? 'phone' : 'laptop'}, old from ${from}): old ${oldWhenNew40 === null ? '?' : oldWhenNew40.toFixed(2)} when the new passes 0.4, `
         + `never both above ${worst.toFixed(2)}, old gone by ${gone === null ? '∞' : gone.toFixed(0)}ms, new at 90% by ${t90 === null ? '∞' : t90.toFixed(0)}ms`);
    }
  }
  const g = read('js/gestures.js');
  ok(/if \(inPlace && playOnCompositor\(p, v\)\) return;/.test(g),
     'the crossfade is sampled into WAAPI keyframes: a heavy view building after it cannot freeze it half way');
  ok(/const q = clamp01\(\(now\(\) - tapAt\) \/ EARLY_FADE_MS\)/.test(g),
     'it carries on from the tap\'s dim by the wall clock (getComputedStyle read the frame before a heavy build: opacity 1)');

  // Reduced motion switched the GESTURES off with the springs. A drag is the
  // finger moving it: it is wired wherever there are fingers.
  ok(/!inBrowser\(\) \|\| active \|\| hint \|\| !isPhone\(\)\) return;/.test(g),
     'the edge swipe and Record\'s drag-down are wired under reduced motion too (inBrowser, not canMove)');
  const nsec = css.slice(css.indexOf('/* === Motion 2 · Navigation === */'), css.indexOf('/* === end Motion 2 · Navigation === */'));
  ok(/\.screen\.nav-moving:not\(\.nav-k-edge\):not\(\.nav-k-card\)/.test(nsec),
     'and the reduced-motion rule lets a screen under a finger follow it');

  // The runner's minimise flies into its bar; the router lets it paint first.
  ok(typeof G.flightLead === 'function' && G.flightLead() === null, 'flightLead(): null when nothing is flying');
  const ghost = document.createElement('div'); ghost.className = 'screen-ghost m-flying';
  document.body.append(ghost);
  const lead = G.flightLead();
  ok(Boolean(lead && typeof lead.then === 'function'), 'and a promise to await when the minimise is in the air');
  ghost.remove();
  const r = read('js/app.js').slice(read('js/app.js').indexOf('async function render()'));
  ok(/const flying = move \? null : flightLead\(\);\s*if \(flying\) await flying;/.test(r)
     && r.indexOf('await flying') < r.indexOf('await resolve(route)'),
     'the router awaits it before building the next view');

  // The falling Record card had an empty band where its hidden strip was.
  // Since review 4 a card pins no strip at all, so nothing hides its own.
  const startCardSrc = g.slice(g.indexOf('function startCard('), g.indexOf('function paintCard('));
  ok(startCardSrc.length > 0 && !/pinBanner\(/.test(startCardSrc),
     'a card carries its own demo strip — dragging Record down pins no copy (no empty band, no double)');

  // A route change puts away what was open over the old screen.
  ok(/if \(prevHash && location\.hash !== prevHash\) closeSurfaces\(\);/.test(r)
     && r.indexOf('closeSurfaces()') < r.indexOf('settleNavigation()'),
     'a NEW hash closes open sheets, ? boxes and photos (a repaint of the same one does not)');
  delete window.Element.prototype.animate;
}

console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
process.exit(fails ? 1 : 0);
