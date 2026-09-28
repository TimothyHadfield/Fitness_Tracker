// Sitewide word cap — overhaul wave 3, builder WORDS (2026-09-27).
//   node tests/word-cap.test.mjs            (needs jsdom)
//   WORDCAP_DUMP=1 node tests/word-cap.test.mjs   prints every unit it read
//
// Tim, 2026-09-27: *"all the wordy sections in the cite and reducing how much it
// says or putting it inside a question mark ... Review what I've said previously
// about display and what to show, especially about words and descriptions."*
// His taste file: labels are 1–3 words; a UI sentence stays under ~15 words
// ("is every word important"); the ? holds WHY, never WHAT; a caveat is never
// deleted, it moves behind the ?.
//
// So this boots the REAL app (app.js, the router, the demo account) and walks
// every main route, reading what a person sees WITHOUT tapping anything:
//   - no sentence over 15 words
//   - no button or label over 4 words
// The ? pop-ups (`.help-pop`) live in document.body, not in #app, so they are
// never read here — that is exactly where the long WHY is allowed to go.
//
// Carved out on purpose (long-form screens, Tim's own carve-out 2026-09-07 —
// *"we should allow it to describe that section sufficiently"*): the Research
// segment of Data (never clicked here), and Explore's preset detail pages
// (other people's programmes transcribed; hash-pinned text, see data-layer).
//
// ⚠️ jsdom has no layout, so "a line" is worked out from the markup: a run of
// text and inline elements between block elements is one unit, and a unit is
// split into sentences at . ! ? and at the " · " separator this app uses
// between facts. Only tokens with a letter or digit count as words, so "—",
// "·" and "→" are free.
import { JSDOM } from 'jsdom';

const DUMP = !!process.env.WORDCAP_DUMP;
const SENTENCE_MAX = 15;
const LABEL_MAX = 4;

/* The allowlist: ONLY things Tim pinned. Each entry quotes why. Matched as an
   exact normalised string. */
const ALLOW = new Map([
]);

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', {
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
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver = window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
// Two passes: phone, then laptop (min-width queries match), because the laptop
// layout shows things a phone keeps one tap away (a programme's rating column).
let wide = false;
window.matchMedia = (q) => ({ get matches() { return /min-width/.test(q) ? wide : false; }, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
for (const [prop, value] of [['clientWidth', 393], ['clientHeight', 659]]) {
  Object.defineProperty(window.HTMLElement.prototype, prop, { get: () => value, configurable: true });
}
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const sess = new Map([['ftrack:v1:demo', '1']]);
globalThis.sessionStorage = { getItem: (k) => (sess.has(k) ? sess.get(k) : null), setItem: (k, v) => sess.set(k, String(v)), removeItem: (k) => sess.delete(k) };
// Anything the app throws while rendering is a failure of this test too.
const thrown = [];
window.addEventListener('error', (e) => thrown.push(String(e.message || e.error)));
process.on('unhandledRejection', (e) => thrown.push('rejection: ' + (e && e.message || e)));

const BASE = new URL('../js/', import.meta.url).href;
await import(BASE + 'app.js');
await settle(600);
const app = document.getElementById('app');

/* ---------------- reading the screen ---------------- */
const INLINE = new Set(['SPAN', 'A', 'B', 'STRONG', 'EM', 'I', 'SMALL', 'ABBR', 'TIME', 'SUP', 'SUB', 'CODE', 'MARK', 'BR', 'KBD', 'S', 'U', 'Q', 'CITE', 'DATA', 'OUTPUT']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'svg', 'SVG', 'TEMPLATE', 'NOSCRIPT', 'SELECT', 'TEXTAREA', 'INPUT', 'CANVAS']);
const LABELISH = 'button, label, .section-label, .seg, .chip, th, [role="tab"], h1, h2, h3, .btn, .navbar a, .row-title, .stat-label, .tile-label';

/* `.preset-notes` is a programme's own notes — words its author (the person,
   or the coach a preset is transcribed from) wrote, shown as written. Not the
   app's UI text, so not the app's to cut. */
const hidden = (e) => e.hidden || e.getAttribute('aria-hidden') === 'true' || e.classList.contains('help-pop')
  || e.classList.contains('preset-notes')
  || e.classList.contains('help-dot') || e.classList.contains('sr-only') || e.classList.contains('visually-hidden')
  || (e.style && e.style.display === 'none');
// A "span" styled as its own row still reads as its own line.
const blockish = (e) => !INLINE.has(e.tagName) || /(^|[\s-])(sub|title|name|meta|note|help|label|value|caption|hint|line|row|desc|detail|tag|badge|stat)([\s-]|$)/.test(e.className || '')
  || e.tagName === 'A' && /\b(btn|row|card)\b/.test(e.className || '');
const hasBlockChild = (e) => [...e.children].some((c) => !hidden(c) && !SKIP.has(c.tagName) && (blockish(c) || hasBlockChild(c)));

function units(root) {
  const out = [];
  const walk = (node) => {
    let run = '', owner = node;
    const flush = () => { const t = run.replace(/\s+/g, ' ').trim(); if (t) out.push({ text: t, el: owner }); run = ''; };
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { run += c.nodeValue; continue; }
      if (c.nodeType !== 1 || SKIP.has(c.tagName) || hidden(c)) continue;
      if (blockish(c) || hasBlockChild(c)) { flush(); walk(c); }
      else run += ' ' + inlineText(c) + ' ';
    }
    flush();
  };
  walk(root);
  return out;
}
function inlineText(e) {
  let t = '';
  for (const c of e.childNodes) {
    if (c.nodeType === 3) t += c.nodeValue;
    else if (c.nodeType === 1 && !SKIP.has(c.tagName) && !hidden(c)) t += inlineText(c);
  }
  return t;
}
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
// "Dr. Mike", "Mr. Olympia", "vs. them" do not end a sentence.
const sentences = (s) => s.split(/(?<![\s(](?:Dr|Mr|Mrs|Ms|St|vs|e\.g|i\.e)\.)(?<=[.!?…])\s+(?=\S)|\s+·\s+|\s+\|\s+/)
  .map((x) => x.trim()).filter(Boolean);

const offenders = [];
function check(where) {
  const seen = new Set();
  for (const u of units(app)) {
    const key = u.text;
    if (seen.has(key)) continue;
    seen.add(key);
    if (DUMP) console.log(`  [${where}] ${u.el.tagName}.${u.el.className || ''} :: ${u.text}`);
    if (ALLOW.has(key)) continue;
    // A readout (the calendar's "Tap a day…" line becomes that day's summary)
    // is a line of text that happens to be tappable, not a button label.
    const isLabel = u.el.matches && u.el.matches(LABELISH) && !/readout/.test(u.el.className || '');
    if (isLabel) {
      for (const part of u.text.split(/\s+·\s+/)) {
        if (ALLOW.has(part)) continue;
        const n = words(part).length;
        if (n > LABEL_MAX) offenders.push({ where, kind: 'label', n, text: part });
      }
      continue;
    }
    for (const s of sentences(u.text)) {
      if (ALLOW.has(s)) continue;
      const n = words(s).length;
      if (n > SENTENCE_MAX) offenders.push({ where, kind: 'sentence', n, text: s });
    }
  }
}

async function go(hash) {
  location.hash = hash;
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await settle(350);
  document.querySelectorAll('.help-pop, .sheet, .sheet-backdrop').forEach((n) => n.remove());
}

const ROUTES = [
  '#/home', '#/record', '#/start', '#/workouts', '#/explore', '#/calendar', '#/me', '#/me/workouts', '#/me/friends',
  '#/profile', '#/settings', '#/account', '#/goals', '#/goal/new', '#/goal/new/Chest', '#/goal/stalls', '#/goal/systems',
  '#/social', '#/find', '#/import', '#/signin', '#/activity', '#/benchmark',
  '#/friend/demo-friend-1', '#/friend/demo-friend-3', '#/friend/demo-friend-1/workouts', '#/friend/demo-friend-1/friends',
  '#/friend/demo-friend-1/muscles', '#/compare/demo-friend-1',
  '#/system/demo-sys-ul', '#/system/demo-sys-ul/edit', '#/system/new', '#/workout/demo-w-ua', '#/workout/demo-w-ua/edit',
];
const visited = new Set();
for (const w of [false, true]) {
  wide = w;
  const tag = w ? ' (laptop)' : '';
  for (const h of ROUTES) {
    await go(h);
    visited.add(h);
    check(h + tag);
  }
  // Data: every segment but Research (Tim's long-form carve-out).
  await go('#/graphs');
  for (const seg of [...app.querySelectorAll('.seg')]) {
    const name = seg.textContent.trim();
    if (name === 'Research') continue;
    const now = [...app.querySelectorAll('.seg')].find((b) => b.textContent.trim() === name);
    if (!now) continue;
    now.click();
    await settle(250);
    visited.add('#/graphs ' + name);
    check('#/graphs ' + name + tag);
  }
  // A day from the calendar, and that day's recorded workout.
  await go('#/calendar');
  const dayLink = [...app.querySelectorAll('[href^="#/day/"]')].pop();
  if (dayLink) { await go(dayLink.getAttribute('href')); visited.add('#/day'); check('#/day' + tag); }
  const editLink = app.querySelector('[href^="#/edit/"]');
  if (editLink) { await go(editLink.getAttribute('href')); visited.add('#/edit'); check('#/edit' + tag); }
}
ok(visited.size >= ROUTES.length + 4, `walked ${visited.size} screens (every main route, 3+ Data segments, a day)`);

offenders.sort((a, b) => b.n - a.n);
const printed = new Set();
for (const o of offenders) {
  if (printed.has(o.kind + o.text)) continue;
  printed.add(o.kind + o.text);
  console.log(`  OVER  ${o.kind} ${o.n}w  [${o.where}]  ${o.text}`);
}
ok(offenders.filter((o) => o.kind === 'sentence').length === 0,
   `no visible sentence over ${SENTENCE_MAX} words on any main demo route (${offenders.filter((o) => o.kind === 'sentence').length} over)`);
ok(offenders.filter((o) => o.kind === 'label').length === 0,
   `no button or label over ${LABEL_MAX} words (${offenders.filter((o) => o.kind === 'label').length} over)`);
ok(thrown.length === 0, `no errors while walking the routes (${thrown.slice(0, 3).join(' | ') || 'none'})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
