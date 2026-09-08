// The Research tab's topic list — hooks, facets, grouping and the badge.
//
//   npm install jsdom          (anywhere; it is a TEST-only dependency)
//   node tests/research-pane.test.mjs
//
// `tests/data-layer.test.mjs` already holds the CONTENT to account: word
// budgets, the closed tag vocabulary, and the rule that a `limited` finding's
// hook may not claim certainty. This file is about the SCREEN — that the filter
// chips actually filter, that a section header does not survive its own topics
// being hidden, and that the pane never lands on a blank list.
//
// Those are exactly the failures a data-layer test cannot see: every assertion
// there checks that something is PRESENT in a data structure, and a filter that
// hides everything is a fully populated structure drawn wrong.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/graphs',
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
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const { TOPICS, SECTIONS, SECTION_ORDER, CONFIDENCE_ORDER } = await import('../js/research-topics.js');
const { __researchTopicsPane } = await import('../js/views-data.js');

ok(typeof __researchTopicsPane === 'function',
   'views-data exposes the topics pane for testing');

const pane = __researchTopicsPane();
document.getElementById('app').append(pane);

const topics = () => [...pane.querySelectorAll('.rt-topic')];
const visible = () => topics().filter((n) => !n.hidden);
const chips = () => [...pane.querySelectorAll('.rt-chip')];
const chipNamed = (re) => chips().find((c) => re.test(c.textContent));

// ── everything is drawn, and drawn once ──────────────────────────────────────
ok(topics().length === TOPICS.length,
   `all ${TOPICS.length} topics are drawn (${topics().length})`);
ok(new Set(topics().map((n) => n.dataset.topic)).size === TOPICS.length,
   'each topic is drawn exactly once');
ok(visible().length === TOPICS.length, 'nothing is hidden before a filter is touched');

// ── the hook is on the collapsed row ─────────────────────────────────────────
const hooks = [...pane.querySelectorAll('.rt-hook')];
ok(hooks.length === TOPICS.length, 'every topic shows its hook while collapsed');
ok(hooks.every((h) => h.textContent.trim().length > 0), 'no hook renders empty');
// The hook is the reason a closed list is worth reading. If it ever renders
// inside .rt-body it is invisible until opened, which defeats the point.
ok(hooks.every((h) => !h.closest('.rt-body')), 'the hook is outside the collapsed body');

// ── grouping ─────────────────────────────────────────────────────────────────
const groups = [...pane.querySelectorAll('.rt-group')];
if (TOPICS.length >= 16) {
  ok(groups.length > 0, `${TOPICS.length} topics, so the list is grouped into sections`);
  const seen = groups.map((g) => g.dataset.section);
  ok(seen.every((s) => SECTIONS[s]), 'every group names a real section');
  ok(seen.join(',') === SECTION_ORDER.filter((s) => seen.includes(s)).join(','),
     'groups appear in the declared section order');
  const grouped = groups.reduce((n, g) => n + g.querySelectorAll('.rt-topic').length, 0);
  ok(grouped === TOPICS.length, 'grouping loses no topic');
  ok(groups.every((g) => g.querySelector('.rt-group-head')), 'every group has a heading');
} else {
  ok(groups.length === 0, `${TOPICS.length} topics is below 16, so the list stays flat`);
}

// ── the contested badge ──────────────────────────────────────────────────────
const contested = TOPICS.filter((t) => t.contested);
ok(pane.querySelectorAll('.rt-contested').length === contested.length,
   `${contested.length} topics carry the disagreement badge`);
for (const t of contested) {
  const node = pane.querySelector(`.rt-topic[data-topic="${t.id}"]`);
  ok(node.dataset.contested === '1', `${t.id}: marked contested for the filter`);
  ok(Boolean(node.querySelector('.rt-verdict')),
     `${t.id}: states the disagreement and the verdict in its body`);
}

// ── the filters actually filter ──────────────────────────────────────────────
ok(chips().length >= 3, `${chips().length} filter chips`);

for (const level of CONFIDENCE_ORDER) {
  const n = TOPICS.filter((t) => t.confidence === level).length;
  if (!n) continue;
  const chip = chips().find((c) => c.dataset.value === level);
  ok(Boolean(chip), `there is a chip for ${level}`);
  chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok(visible().length === n, `${level}: shows ${n} of ${TOPICS.length} topics`);
  ok(visible().every((node) => node.dataset.conf === level),
     `${level}: nothing of another confidence survives the filter`);
  ok(chip.getAttribute('aria-pressed') === 'true', `${level}: the chip reads as pressed`);
  // A hidden group heading is the failure this catches: the topics vanish and
  // the header sits there labelling nothing.
  for (const g of pane.querySelectorAll('.rt-group')) {
    const anyVisible = Boolean(g.querySelector('.rt-topic:not([hidden])'));
    ok(g.hidden === !anyVisible, `${level}: the "${g.dataset.section}" heading follows its topics`);
  }
}

// Contested is a toggle rather than one of the confidence choices.
const conChip = chipNamed(/disagree/i);
if (contested.length) {
  chips().find((c) => c.dataset.value === 'all').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  conChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok(visible().length === contested.length, `contested filter shows ${contested.length}`);
  ok(visible().every((n) => n.dataset.contested === '1'), 'and only contested ones');
  conChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok(visible().length === TOPICS.length, 'tapping it again puts everything back');
}

// ── never a blank pane ───────────────────────────────────────────────────────
const empty = pane.querySelector('.rt-empty');
ok(Boolean(empty), 'the pane carries an empty-state line');
ok(empty.hidden, 'which is hidden while anything is showing');
// Drive it to a genuinely empty combination if one exists: a confidence level
// that no contested topic holds.
const lonely = CONFIDENCE_ORDER.find((c) =>
  TOPICS.some((t) => t.confidence === c) && !contested.some((t) => t.confidence === c));
if (lonely && contested.length) {
  chips().find((c) => c.dataset.value === lonely).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  conChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok(visible().length === 0, `${lonely} + contested genuinely matches nothing`);
  ok(!empty.hidden, 'and the empty line appears rather than a blank pane');
}

// ── opening a topic still works ──────────────────────────────────────────────
chips().find((c) => c.dataset.value === 'all').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
if (conChip && conChip.getAttribute('aria-pressed') === 'true') {
  conChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}
const first = topics()[0];
first.open = true;
ok(first.querySelector('.rt-answer'), 'an opened topic shows its answer');
ok(first.querySelector('.rt-caveat'), 'and its limit');
ok(first.querySelector('.rt-src'), 'and where it came from');

console.log(fails ? `\n${fails} failed` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
