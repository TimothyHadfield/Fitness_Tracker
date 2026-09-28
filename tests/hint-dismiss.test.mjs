// The runner's one-time hint (tour.js hintOnce) must go away when a sheet opens
// or its target leaves the page — not only on a tap. The CSS builder found the
// "Set the weight with ±" bubble still floating over the Today's exercises sheet
// and the save screen (manager, overhaul wave 2, 2026-09-27).
//   node tests/hint-dismiss.test.mjs      (needs jsdom)
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/session/x', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.Node = window.Node;
globalThis.MutationObserver = window.MutationObserver;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.removeEventListener = window.removeEventListener.bind(window);
globalThis.innerWidth = 393;
globalThis.innerHeight = 659;
globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
// jsdom has no layout: give every element a real-looking box so `visible()` passes.
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 16, y: 200, left: 16, top: 200, width: 361, height: 60, right: 377, bottom: 260 };
};

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

const T = await import('../js/tour.js');

const app = document.getElementById('app');
const row = () => { const r = document.createElement('div'); r.className = 'set-list'; r.innerHTML = '<div class="is-open">set</div>'; app.replaceChildren(r); };

// 1. A sheet opening puts it away.
row();
let shown = await T.hintOnce('k1', '.set-list .is-open', 'Set the weight with ±, then tap Finished.', { storage: mem(), wait: 100 });
ok(shown === true && document.querySelector('.tour-hint'), 'the hint shows beside the open set');
const sheet = document.createElement('div');
sheet.className = 'sheet';
document.body.append(sheet);
await settle(400);
ok(!document.querySelector('.tour-hint'), 'a sheet opening (no tap) puts the hint away');
sheet.remove();

// 2. The target leaving (the save screen replaces the set list) puts it away.
row();
shown = await T.hintOnce('k2', '.set-list .is-open', 'Set the weight with ±, then tap Finished.', { storage: mem(), wait: 100 });
ok(shown === true, 'shown again under a fresh key');
app.replaceChildren(document.createElement('form'));
await settle(400);
ok(!document.querySelector('.tour-hint'), 'the set list leaving the page puts the hint away');

// 3. Unrelated DOM churn does not.
row();
shown = await T.hintOnce('k3', '.set-list .is-open', 'Set the weight with ±, then tap Finished.', { storage: mem(), wait: 100 });
document.querySelector('.set-list').append(document.createElement('span'));
await settle(100);
ok(document.querySelector('.tour-hint'), 'other changes on the page leave it up');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
