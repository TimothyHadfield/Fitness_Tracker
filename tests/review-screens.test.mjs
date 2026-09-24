// Screen bugs from the 2026-09-24 review (Goals, Volume, Bars, Muscles, Research,
// Profile, dates). Renders the real views over the DEMO account in jsdom.
//   node tests/review-screens.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "I want you to review the cite and look for improvements (either new
// features or fixing problems) throughout the whole thing."
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
for (const [prop, value] of [['clientWidth', 420], ['clientHeight', 320]]) {
  Object.defineProperty(window.HTMLElement.prototype, prop, { get: () => value, configurable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const sess = new Map([['ftrack:v1:demo', '1']]);
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

// Every scrollIntoView call, with the element it was called on.
const scrolled = [];
window.HTMLElement.prototype.scrollIntoView = function (opts) { scrolled.push({ node: this, opts }); };

const BASE = new URL('../js/', import.meta.url).href;
const { store, demo, todayISO } = await import(BASE + 'store.js');
const { GraphView } = await import(BASE + 'views-data.js');
const { GoalsView, GoalRouteView } = await import(BASE + 'views-goals.js');
const { stallReasons, requirementsFor } = await import(BASE + 'goals.js');
const { fmtDateShort } = await import(BASE + 'ui.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function mount(p) {
  const node = await p;
  document.getElementById('app').replaceChildren(node);
  await settle();
  return node;
}
const click = (n) => n.dispatchEvent(new window.Event('click', { bubbles: true }));
async function seg(node, name) {
  [...node.querySelectorAll('.seg')].find((b) => b.textContent === name).click();
  await settle(60);
}
const textNodes = (root) => {
  const out = [];
  const w = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  while (w.nextNode()) out.push(w.currentNode.nodeValue);
  return out;
};

ok(demo.active(), 'the demo is on, so nothing below passes by having no data');

/* ---- 1 + 6. The goal screen: no "null", no repo file names ---- */
{
  const g = await store.activeGoal();
  ok(Boolean(g), 'the demo has a running goal to render');
  const screen = await mount(GoalsView());
  await settle(80);
  ok(!textNodes(screen).some((t) => t.trim() === 'null'),
     'the goal screen prints no stray "null" (native append of a null notice)');
  const txt = screen.textContent;
  ok(!/\.md\b/.test(txt), `the goal screen names no repo file (${(txt.match(/\S+\.md[^·]*/) || [''])[0]})`);
  ok(/ACSM position stand 2009/.test(txt), 'and the real citation is still there');

  const stalls = await mount(GoalRouteView('stalls'));
  await settle(80);
  ok(!/\.md\b/.test(stalls.textContent), 'the stalls screen names no repo file either');
  ok(!/\(D\d+\)/.test(stalls.textContent), 'and no decision code');
}

/* ---- 2. Warm-ups: the caveats say what the app now does ---- */
{
  const req = requirementsFor('steady', { bodyWeight: 180 });
  const rows = stallReasons({ requirements: req,
    measured: { weeklySets: 3, sessionsPerWeek: 1, enough: false, spanDays: 9, sessions: 1, totalSets: 3 },
    muscle: 'Chest' });
  const vol = rows.find((r) => r.key === 'volume').detail;
  ok(/marked as warm-ups are left out/i.test(vol) && !/warm-ups included/.test(vol),
     `the goal's measured-sets row says marked warm-ups are left out (${vol.slice(-110)})`);

  const data = await mount(GraphView());
  await seg(data, 'Volume');
  const pane = data.querySelector('.vol-pane');
  ok(pane && /Marked warm-ups left out/.test(pane.textContent) && !/Warm-ups counted/.test(pane.textContent),
     'Volume\'s line says marked warm-ups are left out, not "Warm-ups counted"');

  /* ---- 7. A pick on the figure scrolls its details into view ---- */
  const region = [...data.querySelectorAll('.vol-figure [role=button]')]
    .find((n) => /^(Quads|Chest)/.test(n.getAttribute('aria-label') || ''));
  if (data.querySelector('.vol-detail-wrap.is-open')) click(region); // module state: start closed
  await settle();
  scrolled.length = 0;
  click(region);
  await settle(500);
  const wrap = data.querySelector('.vol-detail-wrap');
  ok(wrap.classList.contains('is-open') && scrolled.some((s) => s.node === wrap),
     `a muscle picked on the figure scrolls its details into view (${scrolled.length} call(s))`);
  click(region); // close again
  await settle();
  scrolled.length = 0;
  const row = data.querySelector('.vol-row');
  click(row);
  await settle(500);
  ok(!scrolled.some((s) => s.node === wrap), 'a row tap does not — it opens where the finger is');
  click(row);
  await settle();
}

/* ---- 10 + 11. Bars round to whole units; Research links wear text-link ---- */
{
  const data = await mount(GraphView());
  await seg(data, 'Bars');
  const vals = [...data.querySelectorAll('.bar-val, .bar-delta')].map((n) => n.textContent);
  ok(vals.length > 0, `the demo draws bars (${vals.length} figures)`);
  ok(vals.every((v) => !/\d\.\d/.test(v.replace(/ · .*$/, ''))),
     `no bar figure carries decimals (${vals.filter((v) => /\d\.\d/.test(v)).slice(0, 3).join(' | ') || 'none'})`);

  await seg(data, 'Research');
  await settle(100);
  const links = [...data.querySelectorAll('.rt-src a, .research-notes a')];
  ok(links.length > 0 && links.every((a) => a.classList.contains('text-link')),
     `every source link wears the app's link class (${links.filter((a) => !a.classList.contains('text-link')).length} of ${links.length} bare)`);
}

/* ---- 9. The rep warning speaks for the most influential row ---- */
{
  const data = await mount(GraphView());
  await seg(data, 'Muscles');
  const regions = [...new Map([...data.querySelectorAll('.body-region')]
    .map((r) => [(r.getAttribute('aria-label') || '').split(' — ')[0], r])).values()];
  let checked = 0, differs = 0, wrong = [];
  for (const r of regions) {
    const name = (r.getAttribute('aria-label') || '').split(' — ')[0];
    for (let i = 0; i < 2; i++) {
      click(r);
      await settle();
      if (data.querySelector('.muscle-sources .msrc-row')) break;
    }
    const toggle = data.querySelector('button.msrc-toggle');
    if (toggle && /More details/.test(toggle.textContent)) { toggle.click(); await settle(); }
    const rows = [...data.querySelectorAll('.muscle-sources .msrc-row')].map((row) => ({
      reps: Number(((row.querySelector('.msrc-set') || {}).textContent || '').split('×').pop()),
      share: parseFloat(((row.querySelector('.msrc-share') || {}).textContent || '')),
    }));
    const warn = [...data.querySelectorAll('.muscle-warn')].map((n) => n.textContent).join(' ');
    const m = warn.match(/From a (\d+)-rep set/);
    if (rows.length > 1 && rows.every((x) => Number.isFinite(x.share)) && m) {
      const lead = rows.slice().sort((a, b) => b.share - a.share)[0];
      checked++;
      if (lead.reps !== rows[0].reps) differs++;
      if (Number(m[1]) !== lead.reps) wrong.push(`${name}: says ${m[1]}, lead row ${lead.reps}`);
    }
    click(r); // close
    await settle();
  }
  ok(checked > 0, `muscles with a rep warning and several weighted rows were checked (${checked}; `
     + `${differs} where the first row is not the most influential)`);
  ok(wrong.length === 0, `the "From a N-rep set" warning names the most influential row (${wrong.join('; ') || 'all agree'})`);
}

/* ---- 3. A past goal: formatted dates, and the day it ENDED ---- */
{
  const g = await store.activeGoal();
  await store.endGoal(g.id);
  const screen = await mount(GoalsView());
  await settle(80);
  const sub = [...screen.querySelectorAll('.row-sub')].map((n) => n.textContent)
    .find((t) => /ended$/.test(t)) || '';
  ok(Boolean(sub), `the ended goal is listed under Before ("${sub}")`);
  ok(!/\d{4}-\d{2}-\d{2}/.test(sub), 'its dates are formatted, not raw ISO');
  ok(sub.includes(`to ${fmtDateShort(todayISO())}`) && !sub.includes(fmtDateShort(g.endDate)),
     `it ends on the day it was ended (${fmtDateShort(todayISO())}), not the planned deadline (${fmtDateShort(g.endDate)})`);
}

/* ---- 5. A short date says its year when it is not this year ---- */
{
  const y = new Date().getFullYear();
  ok(fmtDateShort(`${y - 1}-09-25`).includes(String(y - 1)),
     `last year's date carries its year (${fmtDateShort(`${y - 1}-09-25`)})`);
  ok(!fmtDateShort(`${y}-03-04`).includes(String(y)), `this year's does not (${fmtDateShort(`${y}-03-04`)})`);
  ok(fmtDateShort(`${y}-03-04`, { year: true }).includes(String(y)), 'and { year: true } forces it');
}

/* ---- 4, 10, 12. The three layout rules (jsdom has no layout; the screenshots measure them) ---- */
{
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
  const rule = (sel) => (css.match(new RegExp(`(^|\\n)${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`)) || [])[2] || '';
  ok(/align-self:\s*flex-start/.test(rule('.goal-hero-level')),
     'the goal\'s level chip sizes to its word instead of stretching the column');
  ok(/flex:\s*1 0 auto/.test(rule('.bar-row')), 'a bar row may grow but never shrink below its content');
  ok(rule('.me-body') && !/padding/.test(rule('.me-body')),
     'Profile adds no gutter of its own on top of the pane\'s');
  ok(/\.me-body \.list\s*\{\s*margin-inline:\s*0/.test(css),
     'and on a laptop its nested lists keep no full-bleed margin, so rows meet the labels');
}

/* ---- 8. Below Beginner counts as the furthest behind ---- */
{
  // A body weight no demo lift keeps up with, so most muscles land under Beginner.
  await store.logBodyWeight(700, todayISO());
  const data = await mount(GraphView());
  await seg(data, 'Muscles');
  await settle(80);
  const line = [...data.querySelectorAll('.field-help')].map((n) => n.textContent)
    .find((t) => /Furthest behind/.test(t)) || '';
  ok(/Furthest behind: [^(]+\(Below Beginner\)/.test(line),
     `"Furthest behind" names a below-Beginner muscle ("${line}")`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
