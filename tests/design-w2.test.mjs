// Overhaul wave 2, builder DESIGN-JS (2026-09-27) — design.md packages B and C:
//   fonts self-hosted + precached + preloaded + licensed (V-9)
//   --chrome-b and html.is-scrolled from app.js observeChrome() (V-2, V-14)
//   the Black Ember mark in the laptop sidebar (V-15)
//   metalDefs shared by the Auto-guide bar and the runner's plate drawing (V-10)
//   views-data: setCalMode(), the Data header's back arrow when reached by a link (I-8a)
//   node tests/design-w2.test.mjs      (needs jsdom)
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const INDEX = read('index.html');
const SW = read('sw.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

/* ================= 1. fonts: files, precache, preload, licence ================= */
const FONTS = ['css/fonts/barlow-semi-condensed-600.woff2', 'css/fonts/barlow-semi-condensed-700.woff2'];
for (const f of FONTS) {
  const url = new URL('../' + f, import.meta.url);
  const bytes = existsSync(url) ? readFileSync(url) : null;
  ok(bytes && bytes.subarray(0, 4).toString('latin1') === 'wOF2' && bytes.length > 8000 && bytes.length < 60000,
     `${f} is a real woff2 (${bytes ? bytes.length : 0} B)`);
  ok(SW.includes(`'./${f}'`), `sw.js SHELL precaches ${f}`);
  const pre = new RegExp(`<link rel="preload" href="${f.replace(/\./g, '\\.')}" as="font" type="font/woff2" crossorigin>`);
  ok(pre.test(INDEX), `index.html preloads ${f} (as=font, crossorigin)`);
}
{
  // data-layer's precache walk is not recursive, so css/fonts/ is covered here.
  const dir = new URL('../css/fonts/', import.meta.url);
  const shipped = existsSync(dir) ? readdirSync(dir).map((n) => 'css/fonts/' + n) : [];
  const missing = shipped.filter((f) => !SW.includes(`'./${f}'`));
  ok(shipped.length >= 2 && missing.length === 0, `every file in css/fonts/ is precached (${shipped.length}; missing: ${missing.join(', ') || 'none'})`);
  const lic = existsSync(new URL('../docs/licenses/barlow-OFL.txt', import.meta.url)) ? read('docs/licenses/barlow-OFL.txt') : '';
  ok(/Copyright \d{4} The Barlow Project Authors/.test(lic) && /SIL OPEN FONT LICENSE Version 1\.1/.test(lic),
     'docs/licenses/barlow-OFL.txt carries the Barlow copyright line and the SIL OFL 1.1 text');
  ok(!SW.includes("'./docs/"), 'the licence is not precached (docs are not shipped)');
  ok(/<img class="nav-brand-mark" src="icon\.svg" alt="" width="22" height="22"><span class="nav-brand-name">/.test(INDEX),
     'V-15: the boot skeleton carries the sidebar mark too (same markup as navbar())');
}

/* ================= 2. a DOM, then app.js ================= */
const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#0F1214"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"></head><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
const observed = new Set();
globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; } observe(n) { observed.add(n); } disconnect() { observed.clear(); } };
globalThis.MutationObserver = window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
let wide = false;
window.matchMedia = (q) => ({
  get matches() { return /min-width/.test(q) ? wide : false; }, media: q,
  addEventListener() {}, removeEventListener() {},
});
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const sess = new Map();
globalThis.sessionStorage = { getItem: (k) => (sess.has(k) ? sess.get(k) : null), setItem: (k, v) => sess.set(k, String(v)), removeItem: (k) => sess.delete(k) };

// jsdom has no layout: give the chrome pieces fixed heights (the measured
// WebKit values are checked by hand — see the report), everything else 0.
const H = [['guide-footer', 88], ['navbar', 62], ['pane-bottom', 70], ['session-mini', 44], ['session-footer', 76], ['rest-bar', 30]];
window.HTMLElement.prototype.getBoundingClientRect = function () {
  const hit = H.find(([c]) => this.classList.contains(c));
  const h = this.hidden ? 0 : hit ? hit[1] : 0;
  return { x: 0, y: 0, top: 0, left: 0, width: 0, height: h, right: 0, bottom: h };
};

const BASE = new URL('../js/', import.meta.url).href;
await import(BASE + 'app.js');
await settle(500);
const root = document.documentElement;
const app = document.getElementById('app');
const chromeB = () => root.style.getPropertyValue('--chrome-b');

{
  ok(app.querySelector(':scope > .navbar') && chromeB() === '62px',
     `V-2: on Home (phone) --chrome-b is the tab bar's height (${chromeB()})`);
  const mark = app.querySelector('.navbar .nav-brand img.nav-brand-mark');
  ok(mark && mark.getAttribute('src') === 'icon.svg' && mark.getAttribute('alt') === '' && mark.nextElementSibling.className === 'nav-brand-name',
     'V-15: navbar() puts the Black Ember mark (alt="") right before "Fitness Tracker"');

  // A screen with a save footer and the workout strip, under the tab bar.
  const nav = app.querySelector(':scope > .navbar');
  const scr = document.createElement('div'); scr.className = 'screen';
  scr.innerHTML = '<header class="topbar"></header><div class="pane-scroll"></div><div class="pane-bottom"></div><div class="session-mini"></div>';
  app.replaceChildren(nav, scr);
  await settle();
  ok(chromeB() === '176px', `footer + strip + tab bar all float: 70 + 44 + 62 = ${chromeB()}`);
  ok([...observed].some((n) => n.classList.contains('pane-bottom')) && observed.has(nav),
     'the ResizeObserver is aimed at the chrome pieces themselves');

  // The runner: fullscreen (no tab bar on a phone), rest bar + footer below the list.
  const run = document.createElement('div'); run.className = 'screen no-nav';
  run.innerHTML = '<header class="topbar"></header><div class="pane-scroll"></div>'
    + '<div class="guide" hidden><div class="guide-scroll"></div><div class="session-footer guide-footer"></div></div>'
    + '<div class="rest-bar"></div><div class="session-footer"></div>';
  app.replaceChildren(run);
  await settle();
  ok(chromeB() === '106px', `runner list view: rest bar + footer = ${chromeB()} (the hidden guide adds nothing)`);

  // Auto-guide on: its own scroller, and the chrome is what follows it inside .guide.
  const guide = run.querySelector('.guide');
  guide.hidden = false;
  run.querySelector(':scope > .pane-scroll').hidden = true;
  run.querySelector(':scope > .session-footer').hidden = true;
  guide.insertBefore(run.querySelector(':scope > .rest-bar'), guide.querySelector('.guide-footer'));
  await settle();
  ok(chromeB() === '118px', `Auto-guide: its rest bar + Back/Next = ${chromeB()}`);

  // is-scrolled: the active scroller only, > 4 px.
  const gs = guide.querySelector('.guide-scroll');
  let top = 0;
  Object.defineProperty(gs, 'scrollTop', { get: () => top, configurable: true });
  top = 10; gs.dispatchEvent(new window.Event('scroll'));
  ok(root.classList.contains('is-scrolled'), 'V-14: the active scroller past 4px puts is-scrolled on <html>');
  top = 4; gs.dispatchEvent(new window.Event('scroll'));
  ok(!root.classList.contains('is-scrolled'), 'and back at ≤ 4px takes it off');
  const other = document.createElement('div'); other.className = 'pane-scroll';
  Object.defineProperty(other, 'scrollTop', { get: () => 500 });
  document.body.append(other);
  other.dispatchEvent(new window.Event('scroll'));
  ok(!root.classList.contains('is-scrolled'), 'a scroll anywhere else (a sheet, a parked screen) does not set it');
  other.remove();
  top = 40;
  const again = document.createElement('div'); again.className = 'screen no-nav';
  app.replaceChildren(again);
  await settle();
  ok(!root.classList.contains('is-scrolled') && chromeB() === '0px', 'a new screen starts unscrolled, and one with no chrome reads 0px');

  // Laptop: the sidebar is not below anything.
  wide = true;
  const lap = document.createElement('div'); lap.className = 'screen';
  lap.innerHTML = '<div class="pane-scroll"></div><div class="pane-bottom"></div>';
  app.replaceChildren(nav, lap);
  await settle();
  ok(chromeB() === '70px', `laptop: the sidebar does not count, the save footer does (${chromeB()})`);
  wide = false;
}

/* ================= 3. I-8a: the Data header's back arrow ================= */
{
  location.hash = '#/me';
  await settle(600);
  location.hash = '#/graphs'; // a link (Profile's best lift), not a tab tap
  await settle(900);
  const bar = document.querySelector('#app .screen .topbar');
  ok(bar && bar.querySelector('[aria-label="Back"]') && !bar.querySelector('.avatar-btn'),
     'Data reached by a link from Profile wears a back arrow instead of the profile button');
  location.hash = '#/home';
  await settle(600);
  const tab = document.querySelector('#app > .navbar > a[href="#/graphs"]');
  tab.click();
  await settle(900);
  const bar2 = document.querySelector('#app .screen .topbar');
  ok(location.hash === '#/graphs' && bar2 && !bar2.querySelector('[aria-label="Back"]') && bar2.querySelector('.avatar-btn'),
     'the Data tab tapped in the bar keeps the profile button');
}

/* ================= 4. views-data setCalMode ================= */
{
  const data = await import(BASE + 'views-data.js');
  ok(typeof data.setCalMode === 'function', 'views-data exports setCalMode');
  ok(data.setCalMode('months') === 'months', "setCalMode('months')");
  const sel = () => {
    const c = data.ownCalendar(new Map(), '2026-09-27', { land: false });
    return c.top.querySelector('[role="tab"][aria-selected="true"]').textContent;
  };
  ok(sel() === 'Months', 'my calendar then opens on Months');
  ok(data.setCalMode('weeks') === 'months', 'an unknown mode is ignored');
  data.setCalMode('years');
  ok(sel() === 'Years', "setCalMode('years') → Years");
  const friend = data.ownCalendar(new Map(), '2026-09-27', { friend: true, land: false });
  data.setCalMode('months');
  ok(friend.top.querySelector('[aria-selected="true"]').textContent === 'Years'
     && data.ownCalendar(new Map(), '2026-09-27', { friend: true, land: false }).top.querySelector('[aria-selected="true"]').textContent === 'Years',
     "a friend's calendar memory is never moved by it");
  data.setCalMode('years');
}

/* ================= 5. V-10: one metal for both bars ================= */
{
  const bv = await import(BASE + 'bar-view.js');
  const plates = await import(BASE + 'plates.js');
  ok(typeof bv.metalDefs === 'function', 'bar-view.js exports metalDefs');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const d = bv.metalDefs(svg, 't1');
  ok(d.parentNode === svg && ['t1-metal', 't1-face', 't1-edge'].every((id) => svg.querySelector(`#${id}`)),
     'metalDefs(svg, id) appends -metal, -face and -edge gradients');
  ok(typeof bv.plateDrawingSvg === 'function', 'bar-view.js exports plateDrawingSvg (plates.js stays pure)');
  const load = plates.plateLoad(225);
  const drawing = load && plates.plateDrawing(load);
  const pic = drawing && bv.plateDrawingSvg(drawing);
  const id = pic && (pic.querySelector('linearGradient[id$="-metal"]') || { id: '' }).id.replace(/-metal$/, '');
  const pl = pic ? [...pic.querySelectorAll('rect.pd-plate')] : [];
  ok(pl.length === drawing.parts.filter((p) => p.part === 'plate').length && pl.length > 0,
     `the runner's drawing still has one rect.pd-plate per plate (${pl.length})`);
  ok(pl.every((r) => r.nextElementSibling.getAttribute('class') === 'pd-face' && r.nextElementSibling.getAttribute('fill') === `url(#${id}-face)`
                   && r.nextElementSibling.nextElementSibling.getAttribute('fill') === `url(#${id}-edge)`),
     'each plate wears the shared face + edge shading');
  const sleeve = pic && pic.querySelector('rect.pd-sleeve');
  ok(sleeve && sleeve.nextElementSibling.getAttribute('class') === 'pd-sheen' && sleeve.nextElementSibling.getAttribute('fill') === `url(#${id}-metal)`,
     'the sleeve (and every metal part) wears the steel sheen');
  const pic2 = bv.plateDrawingSvg(drawing);
  ok(pic2.querySelector('linearGradient').id !== pic.querySelector('linearGradient').id, 'every drawing has its own gradient ids');
  const ui = read('js/ui.js');
  ok(!/function plateSvg\(/.test(ui) && /plateDrawingSvg\(plateDrawing\(load\)\)/.test(ui), 'ui.js draws the stepper picture with plateDrawingSvg');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
