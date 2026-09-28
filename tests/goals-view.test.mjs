// Goals screens, overhaul 2026-09-27 (builder GOALS): SC-2 order, I-11 change
// vs end, and the words package (W-1, W-2, W-3, W-10..W-15). Renders the real
// views over the DEMO account in jsdom.
//   node tests/goals-view.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "all the wordy sections in the cite and reducing how much it says or
// putting it inside a question mark". Every caveat that left the screen is
// asserted by OPENING its ? and reading it back (Rule 9) — never relaxed.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/goals',
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
window.HTMLElement.prototype.scrollIntoView = function () {};

const VIEW = process.env.GOALS_VIEW || '../js/views-goals.js';
const { store, demo } = await import(new URL('../js/store.js', import.meta.url).href);
const { GoalsView, GoalRouteView } = await import(new URL(VIEW, import.meta.url).href);

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms));
async function mount(p, ms = 120) {
  const node = await p;
  document.getElementById('app').replaceChildren(node);
  await settle(ms);
  return node;
}
const flat = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
function closePop() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
/** Click a ? and return what it says. */
async function openDot(dot) {
  if (!dot) return '';
  closePop();
  await settle(10);
  dot.click();
  await settle();
  const pop = document.querySelector('.help-pop');
  const t = flat(pop);
  closePop();
  await settle(10);
  return t;
}
const dotByLabel = (root, re) => [...root.querySelectorAll('.help-dot')]
  .find((d) => re.test(d.getAttribute('aria-label') || ''));
function closeSheets() {
  document.querySelectorAll('.sheet, .sheet-backdrop, .sheet-wrap').forEach((n) => n.remove());
}

ok(demo.active(), 'the demo is on, so nothing below passes by having no data');
ok(Boolean(await store.activeGoal()), 'and it has a running goal');

/* ---- SC-2: the order ---- */
{
  const screen = await mount(GoalsView(), 250);
  const body = screen.querySelector('.goal-screen');
  const kids = body ? [...body.children] : [];
  const at = (sel) => kids.findIndex((k) => k.matches(sel));
  const iProgress = at('.goal-progress');
  const iMeasured = at('.goal-measured');
  const iReqs = at('.goal-reqs');
  ok(iProgress > 0 && iMeasured === iProgress + 1,
     `SC-2: "What you are actually doing" comes straight after the bar (${iProgress}, ${iMeasured})`);
  ok(iReqs === iMeasured + 1, `   then the requirements (${iReqs})`);
  ok(/What you are actually doing/.test(flat(kids[iMeasured])), '   and the measured block has loaded');

  const reqs = kids[iReqs];
  const inReqs = reqs ? [...reqs.children] : [];
  const iList = inReqs.findIndex((k) => k.matches('.list'));
  const iVerdicts = inReqs.map((k, i) => (k.matches('.goal-verdict') ? i : -1)).filter((i) => i >= 0);
  ok(iVerdicts.length === 2 && iVerdicts[0] > iList,
     '   On track and the weights follow the requirements, inside the right-hand column');
  ok(/On track\?/.test(flat(reqs.children[iVerdicts[0]]))
     && /weights/i.test(flat(reqs.children[iVerdicts[1]])), '   in that order');
  ok(kids[kids.length - 1] && /Why progress stalls/.test(flat(kids[kids.length - 1])),
     '   and the two links come last');

  /* W-1: one-line requirement rows, paragraph + citation behind the ? */
  const rows = [...screen.querySelectorAll('.req-row')];
  ok(rows.length === 7, `seven requirement rows (${rows.length})`);
  ok(rows.every((r) => r.querySelector('.row-title .help-dot')), '   each with a ? beside its label');
  const subs = rows.map((r) => flat(r.querySelector('.row-sub'))).filter(Boolean);
  ok(subs.length >= 5 && subs.every((s) => words(s) <= 8),
     `   each row's visible line is short (${subs.join(' | ')})`);
  ok(subs.some((s) => /Our threshold, not a published one/.test(s)),
     '   and the consistency caveat stays in the open');
  ok(subs.some((s) => /g per (lb|kg) of body weight/.test(s)),
     '   protein shows its rate in the reader\'s unit');
  ok(!screen.querySelector('.req-row .req-source'), '   no citation printed on a row');
  const setsWhy = await openDot(rows[0].querySelector('.help-dot'));
  ok(/Warm-ups do not count/.test(setsWhy) && /Pelland/.test(setsWhy),
     `   the sets ? still defines a hard set and cites Pelland (${setsWhy.slice(0, 80)}…)`);
  const protein = rows.find((r) => /Protein/.test(flat(r)));
  const proteinWhy = await openDot(protein && protein.querySelector('.help-dot'));
  ok(/g per (lb|kg) of body weight/.test(proteinWhy) && /Morton/.test(proteinWhy),
     '   the protein ? carries the rate in the reader\'s unit and Morton');
  ok(/a bar, not a dial/.test(flat(protein)), '   and protein is still tagged a bar, not a dial');

  /* W-14: the tags line is cut; its ? sits on the heading */
  ok(!/The tags say which/.test(flat(screen)), 'W-14: the "tags say" line is gone');
  const scales = await openDot(dotByLabel(screen, /grow with the goal/));
  ok(/Protein is a bar to clear/.test(scales) && /Ochi/.test(scales),
     '   and its ? (with the Ochi figure) is on the "What this asks of you" heading');
  ok(/cannot see either/.test(flat(screen)), '   food and sleep: the app cannot see either — still visible');

  /* W-15: measured rows are short, the sentence behind the ? */
  const measured = [...screen.querySelectorAll('.goal-measured .stall-row')];
  ok(measured.length === 2, `two measured rows (${measured.length})`);
  for (const r of measured) {
    const sub = flat(r.querySelector('.row-sub'));
    ok(words(sub) <= 12, `   short line ≤12 words: "${sub}"`);
  }
  const volWhy = await openDot(measured[0] && measured[0].querySelector('.help-dot'));
  ok(/warm-ups/i.test(volWhy), `   the sets ? keeps the warm-up caveat (${volWhy.slice(-90)})`);

  /* W-3: what has moved */
  const verdict = reqs.children[iVerdicts[0]];
  const vt = flat(verdict);
  ok(/Not judged yet\./.test(vt), 'W-3: "Not judged yet."');
  ok(/not a tested max/.test(vt), '   both ends named as estimates, not a tested max');
  ok(/±12 %/.test(vt) && !/modelled, not measured on you/.test(vt),
     '   the ±12 % is in the open and the duplicate source line is cut');
  const noise = await openDot(dotByLabel(verdict, /± figure/));
  ok(/modelled rather than measured on you/.test(noise), '   and the ? says it is modelled, not measured on you');
  ok(words(vt.replace(/On track\?/, '')) <= 60,
     `   the block is ≤60 words, was 118+ (${words(vt)})`);

  /* whole screen: far fewer words in the open */
  const total = words(flat(screen));
  ok(total <= 300, `the goal screen shows ≤300 words, was ~757 measured (${total})`);
}

/* ---- I-11: Change goal opens the picker; End is a quiet link with today's sheet ---- */
{
  const screen = await mount(GoalsView(), 250);
  const bottom = screen.querySelector('.pane-bottom');
  const change = bottom && [...bottom.querySelectorAll('button')].find((b) => flat(b) === 'Change goal');
  const end = bottom && [...bottom.querySelectorAll('button')].find((b) => flat(b) === 'End this goal');
  ok(Boolean(change), 'I-11: the bottom button reads "Change goal"');
  ok(Boolean(end) && end.classList.contains('text-link'), '   with "End this goal" as a text link');
  location.hash = '#/goals';
  if (change) change.click();
  await settle();
  ok(location.hash === '#/goal/new', `   Change goal opens the picker (${location.hash})`);
  closeSheets();
  if (end) end.click();
  await settle();
  const sheet = document.querySelector('.sheet');
  ok(Boolean(sheet) && /End this goal\?/.test(flat(sheet)) && /End it/.test(flat(sheet)),
     '   End this goal opens the same "End this goal?" sheet');
  ok(Boolean(await store.activeGoal()), '   and nothing ends until it is confirmed');
  closeSheets();
}

/* ---- W-12: the picker ---- */
{
  const pick = await mount(GoalRouteView('new'), 250);
  const t = flat(pick);
  ok(/Pick a muscle\./.test(t) && !/The next screen shows/.test(t), 'W-12: "Pick a muscle."');
  ok(/freezes the weight/.test(t), '   that a goal freezes its weight is still on the screen');
  const freeze = await openDot(dotByLabel(pick, /frozen/));
  ok(/won't move a running goal/.test(freeze), '   and why a later comparison change can\'t move it is behind the ?');
}

/* ---- W-13: a muscle's levels ---- */
{
  const lv = await mount(GoalRouteView('new/Chest'), 250);
  const t = flat(lv);
  ok(/Measured on .+ · now \d+/.test(t), `W-13: "Measured on {lift} · now {w}" (${t.slice(0, 90)})`);
  const opt = flat(lv.querySelector('.goal-option .row-sub'));
  ok(opt && words(opt) <= 8, `   a level row is "{w} {lift} · {ambition}" (${opt})`);
  ok(/is a prediction/.test(t), '   none of these is a prediction — still on the screen');
  const why = await openDot(dotByLabel(lv, /prediction/));
  ok(/not what you will lift/.test(why) && /vary enormously/.test(why), '   the rest is behind its ?');
  const lift = await openDot(dotByLabel(lv, /Why this lift/));
  ok(/Every exercise that trains it counts/.test(lift), '   and "every exercise counts" behind the lift ?');
}

/* ---- W-11: why progress stalls ---- */
{
  const st = await mount(GoalRouteView('stalls'), 250);
  const t = flat(st);
  ok(!/Almost everybody who trains/.test(t), 'W-11: the intro is cut');
  ok(st.querySelectorAll('.stall-row').length === 6, '   six reasons still');
  ok(/This screen never blames your training\./.test(t), '   the point is still said outright');
  const effort = [...st.querySelectorAll('.stall-row')].find((r) => /close enough to failure/.test(flat(r)));
  const effortWhy = await openDot(effort && effort.querySelector('.help-dot'));
  ok(/reps-in-reserve/.test(effortWhy),
     '   and the invisible one that matters most — no reps-in-reserve field — is behind its ?');
  const foot = await openDot(dotByLabel(st, /no number/));
  ok(/invisible to any training log/.test(foot), '   "invisible to any training log" behind the footer ?');
  for (const r of st.querySelectorAll('.stall-row')) {
    const sub = flat(r.querySelector('.row-sub'));
    ok(words(sub) <= 12, `   row line ≤12 words: "${sub}"`);
  }
}

/* ---- W-10 + W-2: programs that fit ---- */
{
  const sys = await mount(GoalRouteView('systems'), 400);
  const t = flat(sys);
  ok(/sets a week on Chest · (fits|more than asked|under|below minimum)/.test(t),
     'W-10: each row reads "{n} sets a week on Chest · fits"');
  ok(!/What the strength score cannot see/.test(t), 'W-2: the 97-word strength caveat is off the screen');
  ok(/Strength % counts sets, not how heavy they are\./.test(t), '   replaced by a short fact');
  const strength = await openDot(dotByLabel(sys, /strength score cannot see/));
  ok(/3 sets of 20/.test(strength) && /8 reps or fewer/.test(strength),
     '   and the whole caveat is behind its ?, word for word');
  ok(/Indirect work counts half a set\./.test(t), '   indirect sets: a short fact');
  const indirect = await openDot(dotByLabel(sys, /indirect/i));
  ok(/not a measured fact/.test(indirect), '   with "not a measured fact" behind its ?');
  ok(/Adding copies it\. Your goal stays as it is\./.test(t), '   and the adding line is short');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
