// Surfaces motion (docs/motion2-plan.md, package C). jsdom + the real modules.
//   node tests/surfaces-motion.test.mjs
//
// Tim, 2026-09-25: *"Put professional level annimation and physics into this
// cite … Impress me."* Package C is the surfaces: the segmented pill (springs,
// stretches while it travels, can be dragged), sheets (spring up, grab handle,
// drag to dismiss), the photo viewer (zooms out of its thumbnail and back),
// toasts (spring in, flick away), the runner's ± (a press, nothing else) and
// the ? popover (grows out of its dot).
//
// Pinned here is what a screenshot cannot see: the release decisions, the
// geometry of a photo's flight and zoom, that every surface rides a spring
// inside Rule 7's physics tier, and that where nothing can move (jsdom, reduced
// motion) nothing extra is built and no inline style is left behind. The frames
// themselves are checked in WebKit (scratchpad strips).
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
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const UI = await import(new URL('js/ui.js', root).href);
const P = await import(new URL('js/photo.js', root).href);
const S = await import(new URL('js/spring.js', root).href);

/* ---------- 1. the segmented pill: where a drag lets go ---------- */
{
  const pick = UI.pickSegment;
  ok(typeof pick === 'function', 'ui.js exports pickSegment() — where a dragged pill lands');
  if (typeof pick === 'function') {
    const centers = [40, 120, 200, 280];
    ok(pick({ centers, x: 118 }) === 1, 'a slow release lands on the nearest segment');
    ok(pick({ centers, x: 150 }) === 1 && pick({ centers, x: 170 }) === 2, 'the line between two is halfway');
    ok(pick({ centers, x: 130, velocity: 900 }) === 2, 'a flick right carries it on to the next one');
    ok(pick({ centers, x: 130, velocity: -900 }) === 0, 'and a flick left the other way');
    ok(pick({ centers, x: 280, velocity: 5000 }) === 3 && pick({ centers, x: -50 }) === 0,
       'it never lands past either end');
  }
  const st = UI.pillStretch;
  ok(typeof st === 'function' && st(0) === 1, 'a pill at rest is its own width');
  ok(typeof st === 'function' && st(800) > 1 && st(800) === st(-800), 'it stretches along its path while it travels, either way');
  ok(typeof st === 'function' && st(1e6) <= 1.15, 'and never by more than 15%');
}

/* ---------- 2. sheets: let go, and it goes or it comes back ---------- */
{
  const d = UI.sheetShouldClose;
  ok(typeof d === 'function', 'ui.js exports sheetShouldClose()');
  if (typeof d === 'function') {
    const H = 520;
    ok(d({ offset: 30, velocity: 0, height: H }) === false, 'a small pull and a slow release springs back');
    ok(d({ offset: 260, velocity: 0, height: H }) === true, 'past about 40% of the sheet (or 240px) it goes');
    ok(d({ offset: 40, velocity: 1200, height: H }) === true, 'a flick down dismisses from anywhere');
    ok(d({ offset: 300, velocity: -600, height: H }) === false, 'a flick back up keeps it, however far it was pulled');
    ok(d({ offset: -20, velocity: 1200, height: H }) === false, 'pulled up (rubber band) it never closes');
    ok(d({ offset: 250, velocity: 0, height: 2000 }) === true, 'a very tall sheet still closes at 240px, not at 800');
  }
}

/* ---------- 3. toasts: a flick sends one away ---------- */
{
  const f = UI.toastFling;
  ok(typeof f === 'function', 'ui.js exports toastFling()');
  if (typeof f === 'function') {
    ok(f({ dx: 10, dy: 0, vx: 50, vy: 0, width: 300 }) === null, 'a nudge is not a dismissal');
    ok(f({ dx: 40, dy: 0, vx: 900, vy: 0, width: 300 }) === 'right', 'a flick right goes right');
    ok(f({ dx: -130, dy: 4, vx: -20, vy: 0, width: 300 }) === 'left', 'dragged well left, it goes left');
    ok(f({ dx: 2, dy: 20, vx: 0, vy: 700, width: 300 }) === 'down', 'a flick down drops it');
    ok(f({ dx: 0, dy: -30, vx: 0, vy: -900, width: 300 }) === null, 'but it cannot be thrown up into the screen');
  }
}

/* ---------- 4. the photo viewer: out of the thumbnail and back ---------- */
{
  ok(typeof P.rectFlight === 'function', 'photo.js still exports rectFlight (builder E)');
  const cover = UI.coverRect;
  const flight = UI.photoFlight;
  ok(typeof cover === 'function' && typeof flight === 'function', 'ui.js exports coverRect() and photoFlight()');
  if (typeof cover === 'function' && typeof flight === 'function') {
    // A 4:3 photo shown full-screen at 393×295, from a 365×200 card box (cover-cropped).
    const F = { left: 0, top: 182, width: 393, height: 294.75 };
    const T = { left: 14, top: 400, width: 365, height: 200 };
    const c = cover(T, F);
    ok(near(c.width / c.height, F.width / F.height, 1e-6), 'the cover rect keeps the photo’s own shape');
    ok(c.width >= T.width - 1e-6 && c.height >= T.height - 1e-6, 'and covers the thumbnail box on both sides');
    ok(near(c.left + c.width / 2, T.left + T.width / 2) && near(c.top + c.height / 2, T.top + T.height / 2),
       'centred on it, as object-fit: cover draws it');
    const f = flight(F, T);
    // Where the photo's visible (clipped) corners land at progress 0:
    const x0 = F.left + f.x + f.clipX * f.scale;
    const y0 = F.top + f.y + f.clipY * f.scale;
    const x1 = F.left + f.x + (F.width - f.clipX) * f.scale;
    const y1 = F.top + f.y + (F.height - f.clipY) * f.scale;
    ok(near(x0, T.left, 0.05) && near(y0, T.top, 0.05) && near(x1, T.left + T.width, 0.05) && near(y1, T.top + T.height, 0.05),
       `at the start of the flight the visible photo sits exactly on the thumbnail (${x0.toFixed(1)},${y0.toFixed(1)} → ${x1.toFixed(1)},${y1.toFixed(1)})`);
    ok(f.clipX === 0 || f.clipY === 0, 'only the cropped axis is clipped');
    const same = flight(F, { left: 0, top: 182, width: 393, height: 294.75 });
    ok(near(same.x, 0) && near(same.y, 0) && near(same.scale, 1) && near(same.clipX, 0) && near(same.clipY, 0),
       'from a box that IS the final rect there is nowhere to fly');
  }

  const zoom = UI.zoomAbout;
  ok(typeof zoom === 'function', 'ui.js exports zoomAbout() — double-tap and pinch');
  if (typeof zoom === 'function') {
    const F = { left: 0, top: 182, width: 393, height: 294.75 };
    const P0 = { x: 300, y: 250 };
    const z = zoom({ x: 0, y: 0, s: 1 }, P0, 2.5, F);
    // The image point under the finger before…
    const lx = (P0.x - F.left - 0) / 1; const ly = (P0.y - F.top - 0) / 1;
    // …is still under it after.
    ok(near(F.left + z.x + lx * z.s, P0.x) && near(F.top + z.y + ly * z.s, P0.y) && z.s === 2.5,
       'zooming keeps the point under the finger where it is');
  }
  const clamp = UI.clampPan;
  ok(typeof clamp === 'function', 'ui.js exports clampPan()');
  if (typeof clamp === 'function') {
    const F = { left: 0, top: 182.125, width: 393, height: 294.75 }; // (659 − 294.75) / 2: the layout's own centring
    const c1 = clamp({ x: 50, y: 40, s: 1 }, F, 393, 659);
    ok(near(c1.x, 0) && near(c1.y, 0), 'at 1× the photo goes back to the middle');
    const c2 = clamp({ x: 200, y: -2000, s: 2 }, F, 393, 659);
    ok(near(c2.x, 0), 'zoomed, its left edge never comes off the left of the screen');
    const W = F.width * 2; const Hh = F.height * 2;
    ok(near(F.left + c2.x + W, 393) || c2.x <= 0, 'and its right edge never off the right');
    ok(Hh < 659 ? near(F.top + c2.y + Hh / 2, 659 / 2, 0.5) : true, 'a zoomed photo shorter than the screen stays centred vertically');
  }
}

/* ---------- 5. every surface rides a spring inside the physics tier ---------- */
{
  const SS = UI.SURFACE_SPRINGS;
  ok(SS && typeof SS === 'object', 'ui.js exports SURFACE_SPRINGS');
  if (SS) {
    const names = Object.keys(SS);
    ok(['pill', 'sheet', 'dialog', 'toast', 'press', 'pop', 'photo'].every((k) => names.includes(k)),
       `one named spring per surface (${names.join(', ')})`);
    ok(names.every((k) => Object.prototype.hasOwnProperty.call(S.SPRINGS, SS[k])),
       'and each is a preset of js/spring.js — the tier tests/spring.test.mjs measures, no private constants');
  }
}

/* ---------- 6. where nothing can move, nothing extra is built ---------- */
{
  // jsdom has no Element.animate, so ui.js treats it as "cannot animate".
  const { close, sheet } = UI.openSheet({ title: 'T', body: UI.el('p', { text: 'x' }) });
  ok(!sheet.querySelector('.sheet-grab'), 'no grab handle where nothing can be dragged (jsdom / reduced motion)');
  ok(!sheet.getAttribute('style') && !sheet.parentElement.getAttribute('style'),
     'and no inline style on the sheet or its backdrop');
  close();
  ok(!document.querySelector('.sheet, .sheet-x, .sheet-backdrop, .sheet-backdrop-x'),
     'closing removes it at once — a closing sheet never lingers as something a selector can find');

  UI.toast('Saved');
  const t = document.querySelector('.toast');
  ok(Boolean(t) && !t.getAttribute('style'), 'a toast in jsdom has no inline style');
  t.remove();

  const s = UI.stepper({ field: 'reps', value: 5, onChange: () => {} });
  document.body.append(s.node);
  const [minus, plus] = s.node.querySelectorAll('.step-btn');
  plus.dispatchEvent(new window.Event('pointerdown'));
  plus.dispatchEvent(new window.Event('pointerup'));
  const input = s.node.querySelector('.step-value');
  ok(input.value === '6', 'a ± press still changes the number at once');
  ok(!input.getAttribute('style') && !s.node.querySelector('.stepper-controls').getAttribute('style'),
     '🛑 and the number itself never moves (logging path: only a press answers back)');
  ok(!plus.getAttribute('style') && !minus.getAttribute('style'), 'no inline style is left on the buttons');
  s.node.remove();

  const bar = UI.el('div', { class: 'segmented' },
    UI.el('button', { class: 'seg', 'aria-selected': 'true', text: 'A' }),
    UI.el('button', { class: 'seg', 'aria-selected': 'false', text: 'B' }));
  document.body.append(bar);
  UI.wireSegmented(document.body);
  UI.wireSegmented(document.body);
  ok(bar.querySelectorAll('.seg-ind').length === 1, 'the pill is still wired exactly once');
  bar.remove();
}

/* ---------- 7. the Profile Months/Years control gets its pill ---------- */
{
  const src = read('js/profile-shape.js');
  ok(/wireSegmented\(/.test(src),
     '🚨 the Profile calendar wires its own Months/Years control — it is built after the screen, so the shell never saw it (measured: no pill on Profile)');
}

/* ---------- 8. the stylesheet: its own section, and off under reduced motion ---------- */
{
  const css = read('css/app.css');
  const m = css.match(/\/\* === Motion 2 · Surfaces === \*\/([\s\S]*?)\/\* === end Motion 2 · Surfaces === \*\//);
  ok(Boolean(m), 'app.css has a "Motion 2 · Surfaces" section');
  if (m) {
    const sec = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
    ok(/@media \(prefers-reduced-motion: reduce\)/.test(sec), 'with a reduced-motion block of its own');
    ok(!/transition:[^;]*transform/.test(sec),
       '⚠️ and no CSS transition on a transform a spring writes (it would smear every frame)');
    ok(/\.help-pop[^{]*\{[^}]*transform-origin/.test(sec), 'the ? box grows from its dot (transform-origin)');
    // Review 2026-09-25: a phone sheet was see-through for its first ~100ms —
    // the backdrop's fade-in keyframe faded the sheet inside it with it. A
    // spring-driven surface switches its keyframes off, and the sheet's own
    // entrance is a transform only.
    ok(/\.s2-live\s*\{\s*animation:\s*none\s*!important/.test(sec),
       '🚨 a spring-driven surface has no CSS keyframes under it (the backdrop fade made the sheet see-through)');
    const ui = read('js/ui.js');
    ok(/backdrop\.classList\.add\('s2-live'\)/.test(ui), 'and the sheet’s backdrop is one of them');
  }
}

console.log(fails === 0 ? '\nAll surfaces-motion checks passed.' : `\n${fails} surfaces-motion check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
