// Laptop polish (motion pass 2, laptop review 2026-09-25). jsdom + the real modules.
//   node tests/laptop-polish.test.mjs
//
// Tim: *"Put professional level annimation and physics into this cite … Impress
// me. When you're done make sure that everything still looks good on every
// single page."* A laptop reviewer measured what a mouse user meets: the sidebar
// vanishing on sub-pages (content jumping 200px), dialogs that do not take or
// return focus, a gold sidebar label that arrives before its fill, no hover
// anywhere, rows touching a dialog's edge, a runner row that moved 3px when
// Finished was tapped. Geometry is measured in WebKit/Chrome (scratchpad); what
// is pinned here is the mechanism behind each fix.
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
const CSS = read('css/app.css');
const section = (name) => {
  const a = CSS.indexOf(`/* === ${name} === */`);
  const b = CSS.indexOf(`/* === end ${name} === */`);
  return a >= 0 && b > a ? CSS.slice(a, b) : '';
};
const LAP = section('Motion 2 · Laptop');

const UI = await import(new URL('js/ui.js', root).href);
const G = await import(new URL('js/gestures.js', root).href);
const S = await import(new URL('js/spring.js', root).href);

/* ---------- 1. a dialog takes focus, and gives it back ---------- */
{
  const trigger = UI.el('button', { text: 'Switch' });
  document.body.append(trigger);
  trigger.focus();
  ok(document.activeElement === trigger, 'setup: the trigger has focus');
  const { sheet } = UI.openSheet({ title: 'Your programs', body: UI.el('button', { text: 'Row' }) });
  ok(sheet.contains(document.activeElement),
     `open: focus moves INTO the dialog (was left on the trigger) — on ${document.activeElement.tagName}.${document.activeElement.className}`);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok(document.activeElement === trigger,
     `Escape: focus returns to the trigger (was <body>) — on ${document.activeElement.tagName}`);

  // Safari never focuses a clicked button: the last thing pressed stands in.
  trigger.blur();
  ok(document.activeElement === document.body, 'setup: a click in Safari leaves <body> focused');
  trigger.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  const second = UI.openSheet({ title: 'T', body: UI.el('p', { text: 'x' }) });
  second.close();
  ok(document.activeElement === trigger, 'closed after a click: focus goes to the button that was pressed');
  trigger.remove();
}

/* ---------- 2. the sidebar's label waits for its fill ---------- */
{
  // A laptop-shaped bar: jsdom is 1024px wide. Offsets are what layout gives.
  window.Element.prototype.animate = function () {
    const a = { playState: 'running', currentTime: 0, cancel() { a.playState = 'idle'; } };
    anims.push(a);
    return a;
  };
  const anims = [];
  window.matchMedia = () => ({ matches: false });
  S.__setReducedMotionForTest(false);
  const frames = [];
  const realRaf = window.requestAnimationFrame;
  globalThis.requestAnimationFrame = window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  const flush = () => { const f = frames.splice(0); f.forEach((cb) => cb(0)); };

  const nav = UI.el('nav', { class: 'navbar' });
  const links = ['Home', 'Workouts', 'Record', 'Data', 'Profile'].map((t, i) => {
    const a = UI.el('a', { href: '#/' + t.toLowerCase(), text: t });
    Object.defineProperty(a, 'offsetTop', { value: 80 + i * 43 });
    Object.defineProperty(a, 'offsetHeight', { value: 41 });
    Object.defineProperty(a, 'offsetLeft', { value: 10 });
    Object.defineProperty(a, 'offsetWidth', { value: 179 });
    nav.append(a);
    return a;
  });
  document.getElementById('app').replaceChildren(nav);
  links[0].setAttribute('aria-current', 'page');
  G.syncTabIndicator(nav);                       // placed on Home
  G.syncTabIndicator(nav, links[3]);             // the tap on Data: the fill starts
  ok(nav.classList.contains('ind-moving') && links[0].classList.contains('ind-lit') && !links[3].classList.contains('ind-lit'),
     'the tap: the fill leaves Home and the gold stays with Home (it went to Data at once before)');
  links[0].removeAttribute('aria-current');
  links[3].setAttribute('aria-current', 'page');  // the render re-lights the bar
  flush();
  ok(!links[3].classList.contains('ind-lit'), 'Data is current but not gold while the fill is still on its way');
  const a = anims[anims.length - 1];
  a.currentTime = 10000;                         // the fill is there
  flush();
  ok(links[3].classList.contains('ind-lit') && !links[0].classList.contains('ind-lit'),
     'the fill arrives: the gold is handed to Data');
  a.playState = 'finished';
  flush();
  ok(!nav.classList.contains('ind-moving') && !nav.querySelector('.ind-lit'),
     'at rest the classes are gone and aria-current alone colours the bar');
  const nav2 = section('Motion 2 · Navigation');
  ok(/\.navbar\.ind-moving > a\[aria-current="page"\]:not\(\.ind-lit\)\s*\{[^}]*color:\s*var\(--ink-faint\)/.test(nav2)
     && /\.navbar\.ind-moving > a\.ind-lit\s*\{[^}]*color:\s*var\(--accent\)/.test(nav2),
     'the stylesheet colours only the link the fill is on while it moves');
  ok(/:root\[data-theme="light"\]:not\(\[data-palette\]\) \.navbar\.ind-moving > a\.ind-lit\s*\{[^}]*#82570B/.test(nav2),
     'light gold keeps its AA-darkened label (#82570B) while it moves');
  window.requestAnimationFrame = realRaf;
  delete window.Element.prototype.animate;
}

/* ---------- 3. the sidebar stays on every laptop route ---------- */
{
  const app = read('js/app.js');
  const r = app.slice(app.indexOf('async function render()'));
  ok(/const wantsNav = \(name\) => !FULLSCREEN\.includes\(name\) \|\| sidebarAlways\(\)/.test(app)
     && /matchMedia\(SIDEBAR_MQ\)/.test(app) && /SIDEBAR_MQ = '\(min-width: 860px\)'/.test(app),
     'a route keeps its bar when it is a tab OR the window is at the laptop line (860px, the stylesheet\'s)');
  ok(/if \(wantsNav\(route\.name\)\) \{/.test(r) && /parkNav: !wantsNav\(route\.name\)/.test(r),
     'render appends the bar by that rule, and only parks it with the old screen when it is going away');
  ok(/if \(FULLSCREEN\.includes\(route\.name\)\) screen\.classList\.add\('no-nav'\)/.test(r),
     'a sub-page still owes its own safe-area padding (phone unchanged)');
  const g = read('js/gestures.js');
  ok(/const withNav = isPhone\(\) \? \(parkNav \|\| kind === 'rise' \|\| kind === 'fall'\) : parkNav;/.test(g),
     'laptop: Record rises and falls over the content area — the sidebar is not parked with it');
  const ui = read('js/ui.js');
  ok(/const keepBar = isLaptop\(\);/.test(ui) && /ghost\.append\(\.\.\.parked\)/.test(ui),
     'parkScreen (down arrow, minimise) leaves the laptop sidebar in place');
}

/* ---------- 4. the stylesheet ---------- */
{
  ok(LAP.length > 0, 'css/app.css has a "Motion 2 · Laptop" section');
  const hover = LAP.slice(LAP.indexOf('@media (hover: hover) and (pointer: fine)'));
  ok(/@media \(hover: hover\) and \(pointer: fine\)/.test(LAP), 'hover lives behind (hover: hover) and (pointer: fine) — it never sticks on a phone');
  for (const sel of ['button.row', '.btn', '.chip', '.seg', '.feed-act', 'button.cal-cell', '.navbar > a']) {
    ok(hover.includes(sel) && new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*:hover').test(hover),
       `hover answers on ${sel}`);
  }
  ok(!/:hover[^{]*\{[^}]*\b(transform|width|height|margin|padding|font-size)\s*:/.test(hover),
     'hover changes colour only — nothing moves or resizes');
  ok(/\.sheet-body \.list > \*\s*\{\s*padding-inline:\s*var\(--pad\)/.test(LAP),
     'laptop dialogs: rows keep the dialog\'s side padding (text was on the dialog\'s edge)');
  ok(/body:has\(> #app > \.navbar\) :is\(\.sheet-backdrop, \.sheet-backdrop-x\)\s*\{\s*padding-left:\s*200px/.test(LAP),
     'laptop dialogs centre over the content area, right of the 200px sidebar');
  ok(/text-wrap-style:\s*pretty/.test(LAP) && /text-wrap-style:\s*balance/.test(LAP) && !/\btext-wrap:/.test(LAP),
     'orphans: longhand text-wrap-style only (the shorthand would undo every nowrap title)');
  // The runner: an open set's head is exactly as tall as a closed row.
  const closed = CSS.match(/\n\.set-pick \{[^}]*min-height:\s*(\d+)px/);
  const open = LAP.match(/\.set-item:not\(\.set-drop\) > \.set-open-head[^{]*\{\s*min-height:\s*(\d+)px/);
  ok(closed && open && closed[1] === open[1],
     `Finished → Edit moves nothing: open head ${open && open[1]}px = closed row ${closed && closed[1]}px (was 44 vs 50: a 3px jump)`);
  ok(/\.cal-dow, \.cal-tag, \.yr-month, \.yr-dow, \.yr-dows \{ font-size: var\(--fs-sm\); \}/.test(LAP),
     'calendar labels on a laptop use a font-size TOKEN (--fs-sm), not 10px');
  ok(!/font-size:\s*\d/.test(LAP), 'no new px font sizes in the section');
  ok(/\.pane-scroll:has\(\.switch-row\) > \*\s*\{\s*max-width:\s*510px/.test(LAP),
     'Settings: every row keeps the switches\' measure, so they share one right edge');
  ok(/\.sheet:focus \{ outline: none; \}/.test(section('Motion 2 · Surfaces')),
     'the dialog that takes focus draws no ring of its own');
}

console.log(fails ? `\n${fails} FAIL` : '\nall passed');
process.exitCode = fails ? 1 : 0;
