// Data tab fixes from the second pass of the 2026-09-24 review.
// Renders the real views over the DEMO account in jsdom.
//   node tests/review2-data.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "for all fo the 42 items you're leaving me to decide, you just choose
// what to do based on what you know and recommend".
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

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
window.HTMLElement.prototype.scrollIntoView = function () {};

const BASE = new URL('../js/', import.meta.url).href;
const { store, demo, muscleStrength } = await import(BASE + 'store.js');
const dataMod = await import(BASE + 'views-data.js');
const { GraphView, CalendarView, SettingsView } = dataMod;
const musclesMod = await import(BASE + 'views-muscles.js');
const { COMPARE_OPTIONS } = await import(BASE + 'strength-standards.js');
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const evidenceSrc = readFileSync(new URL('../js/muscle-evidence.js', import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function mount(p, ms = 150) {
  const node = await p;
  document.getElementById('app').replaceChildren(node);
  await settle(ms);
  return node;
}
const flat = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const tab = async (node, name, turns = 8) => {
  const seg = [...node.querySelectorAll('.seg')].find((b) => b.textContent === name);
  if (seg) seg.click();
  for (let i = 0; i < turns; i++) await settle();
  return Boolean(seg);
};
const dataBlock = (css.match(/\/\* === Review 2026-09-24 · Data === \*\/([\s\S]*?)\/\* === end Data === \*\//) || ['', ''])[1];

ok(demo.active(), 'the demo is on, so nothing below passes by having no data');
if (musclesMod.resetPanelViewState) musclesMod.resetPanelViewState();

const { muscles } = await muscleStrength();

/* ---- 3. Strongest / Furthest behind name only firm readings ---- */
{
  ok(typeof musclesMod.summaryMark === 'function', '3. summaryMark exists');
  // The rule written out here as well, so the rendered checks below do not lean on the
  // function they are checking: inferred or Low confidence is guessed, >6 weeks is old.
  const own = (m) => (!m ? null : Number(m.newestAgeDays) > 42 ? 'old'
    : (m.basis === 'fallback' || !m.band || m.band.key === 'low') ? 'guessed' : null);
  const mark = musclesMod.summaryMark || (() => undefined);
  ok(mark({ basis: 'fallback', band: { key: 'good' }, newestAgeDays: 3 }) === 'guessed',
     '3. an inferred reading is "guessed"');
  ok(mark({ basis: 'direct', band: { key: 'low' }, newestAgeDays: 3 }) === 'guessed',
     '3. a Low-confidence reading is "guessed"');
  ok(mark({ basis: 'direct', band: { key: 'good' }, newestAgeDays: 90 }) === 'old',
     '3. a reading with nothing in 6 weeks is "old"');
  ok(mark({ basis: 'direct', band: { key: 'good' }, newestAgeDays: 3 }) === null,
     '3. a recent, direct, good reading is firm');

  const node = await mount(GraphView(), 250);
  await tab(node, 'Muscles');
  const line = [...node.querySelectorAll('.body-foot .field-help')]
    .map(flat).find((t) => /^Strongest:/.test(t)) || '';
  ok(Boolean(line), `3. the summary names a strongest and a furthest-behind (${line})`);
  const said = [...line.matchAll(/(Strongest|Furthest behind): ([A-Za-z ]+?) \(/g)].map((x) => x[2]);
  const bad = said.filter((name) => {
    const m = muscles.get(name);
    const tag = own(m);
    return tag && !new RegExp(`${name} \\([^)]*\\) \\(${tag}\\)`).test(line);
  });
  ok(said.length === 2 && bad.length === 0,
     `3. every muscle named is firm, or carries (guessed)/(old) (${said.join(', ')})`);
  const firm = [...muscles.values()].filter((m) => !own(m));
  ok(firm.length < 2 || said.every((name) => !own(muscles.get(name))),
     `3. with ${firm.length} firm readings, only firm ones are named`);

  /* ---- 1. On a phone the tapped muscle's details come first ---- */
  const foot = node.querySelector('.body-foot');
  ok(foot && !foot.classList.contains('has-pick'), '1. with nothing tapped the foot has no has-pick');
  const region = [...node.querySelectorAll('.body-region')].find((r) => r.dataset.muscle === 'Traps');
  if (region) region.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  for (let i = 0; i < 20; i++) await settle();
  const foot2 = node.querySelector('.body-foot');
  ok(foot2 && foot2.classList.contains('has-pick') && foot2.querySelector('.muscle-detail'),
     '1. tapping a muscle marks the foot has-pick');
  ok(/@media \(max-width: 859px\)\s*\{\s*\.body-foot\.has-pick > \.lv-key-wrap \{ order: 1; \}/.test(dataBlock),
     '1. and on a phone (<860px) the key moves below the details');

  /* ---- 2. The column head names the key lift ---- */
  ok(typeof musclesMod.asKeyLiftHead === 'function' && musclesMod.asKeyLiftHead('Traps') === 'As shrug',
     '2. asKeyLiftHead("Traps") is "As shrug"');
  // The head only exists with the extra columns showing (compact at jsdom's width).
  if (!node.querySelector('.msrc-head')) {
    const more = node.querySelector('button.msrc-toggle');
    if (more) more.click();
  }
  const head = node.querySelector('.msrc-head .msrc-est');
  ok(head && flat(head) === 'As shrug' && /Estimated 1-rep max in/.test(head.getAttribute('title') || ''),
     `2. the Traps table head reads "As shrug" (${flat(head)})`);

  /* ---- 6b. "inferred" said once ---- */
  const detail = node.querySelector('.muscle-detail');
  // Counted per line: textContent glues "Fewer details" onto "Inferred", which hides a \b.
  const inferred = [...(detail ? detail.querySelectorAll('.muscle-warn, .muscle-meta') : [])]
    .reduce((n, line) => n + (flat(line).match(/\binferred\b/gi) || []).length, 0);
  ok(muscles.get('Traps') && muscles.get('Traps').basis === 'fallback' && inferred === 1,
     `6. Traps (inferred) says "inferred" once (${inferred})`);

  /* ---- 9. Trend line ---- */
  const trend = node.querySelector('.muscle-stat .muscle-trend');
  ok(trend && /^([+−]\d+ (lbs|kg)|No change) in 8 weeks$/.test(flat(trend)),
     `9. the Traps panel has an 8-week trend on its big-number line (${flat(trend)})`);
}

/* ---- 9. trendText, pure ---- */
{
  const t = musclesMod.trendText || (() => undefined);
  const up = t(237.4, 225.2);
  ok(up && up.text === '+12 lbs in 8 weeks' && up.dir === 1, `9. 237 vs 225 is "+12 lbs in 8 weeks" (${up && up.text})`);
  const down = t(200, 210);
  ok(down && down.text === '−10 lbs in 8 weeks' && down.dir === -1, `9. a drop is "−10 lbs" (${down && down.text})`);
  const same = t(200.2, 199.9);
  ok(same && same.text === 'No change in 8 weeks' && same.dir === 0, '9. equal is "No change in 8 weeks"');
  ok(t(200, null) === null && t(200, 0) === null, '9. nothing 8 weeks ago says nothing');
}

/* ---- 4. Key swatches match the figure ---- */
{
  const node = await mount(GraphView(), 250);
  await tab(node, 'Muscles');
  const faded = node.querySelector('.lv-key-item .lv-sw.lv-faded');
  ok(faded && /\blv-[a-z]+\b/.test(faded.className.replace(/lv-sw|lv-faded/g, '')),
     `4. the Faded swatch carries a level colour (${faded && faded.className})`);
  const minTint = Number((evidenceSrc.match(/MIN_TINT\s*=\s*([\d.]+)/) || [])[1]);
  ok(/\.lv-sw\.lv-faded[^}]*--tint-n:\s*0?\.38/.test(dataBlock) && minTint === 0.38,
     `4. and is painted at the figure's lowest tint (${minTint})`);
  ok(/\.lv-sw\.lv-none\s*\{[^}]*var\(--body-none\)/.test(dataBlock),
     '4. the No data swatch is the figure\'s --body-none');
}

/* ---- 5. The graph ---- */
{
  ok(typeof dataMod.niceStep === 'function', '5. niceStep exists');
  const ns = dataMod.niceStep || (() => NaN);
  ok([ns(0.9), ns(1.9), ns(2.4), ns(4), ns(8), ns(23), ns(60)].join() === '1,2,2.5,5,10,25,50',
     `5. niceStep picks 1/2/2.5/5/10 steps (${[ns(0.9), ns(1.9), ns(2.4), ns(4), ns(8), ns(23), ns(60)]})`);
  const node = await mount(GraphView(), 250);
  await tab(node, 'Graph');
  const svg = node.querySelector('svg.line-chart, .chart svg, svg');
  const ticks = [...node.querySelectorAll('text.axis-text')]
    .filter((t) => !t.classList.contains('axis-title') && /^-?[\d.,]+$/.test(t.textContent.trim()))
    .map((t) => Number(t.textContent.replace(/,/g, '')));
  const gaps = ticks.slice(1).map((v, i) => Math.abs(v - ticks[i]));
  const step = gaps[0];
  const round = step > 0 && [1, 2, 2.5, 5].some((b) => {
    const p = step / b; return Math.abs(Math.log10(p) - Math.round(Math.log10(p))) < 1e-9;
  });
  ok(ticks.length >= 3 && round && gaps.every((g) => Math.abs(g - step) < 1e-9)
     && ticks.every((v) => Math.abs(v / step - Math.round(v / step)) < 1e-9),
     `5. the y-ticks are round multiples of a nice step (${ticks.join(', ')})`);
  const title = node.querySelector('text.axis-title');
  ok(title && /^(lbs|kg) for \d+ reps$/.test(title.textContent), `5. the axis says its unit (${title && title.textContent})`);
  const captions = [...node.querySelectorAll('.chart-caption')].map(flat);
  ok(captions.length > 0 && captions.every((c) => !/· total\b/.test(c)),
     `5. no duplicate "· total" in the caption (${captions.join(' | ')})`);
  // 🔄 SC-11 (2026-09-27): the labels carry the rep count on a rep-normalised chart.
  const START_NOW = /^(start|now)( · \d+ reps)?$/i;
  const stats = [...node.querySelectorAll('.stat')]
    .filter((s) => START_NOW.test(flat(s.querySelector('.stat-label'))))
    .map((s) => flat(s.querySelector('.stat-value')));
  ok(stats.length === 2 && stats.every((v) => /^\d[\d,]*( (lbs|kg))?$/.test(v)),
     `5. START/NOW are whole units (${stats.join(', ')})`);

  /* ---- 11. SC-11: "Now · 5 reps" — the tiles say which rep count they compare ---- */
  const axisReps = title && (title.textContent.match(/for (\d+) reps$/) || [])[1];
  const labels = [...node.querySelectorAll('.stat .stat-label')].map(flat);
  ok(Boolean(axisReps) && labels.includes(`Start · ${axisReps} reps`) && labels.includes(`Now · ${axisReps} reps`),
     `11. the Start/Now tiles name the chart's rep count (${labels.join(' | ')})`);
  void svg;

  // In kg the demo's whole-pound numbers become fractions, which is where rounding shows.
  const unitsMod = await import(BASE + 'units.js');
  unitsMod.setUnits('kg');
  const kgNode = await mount(GraphView(), 250);
  await tab(kgNode, 'Graph');
  const kgStats = [...kgNode.querySelectorAll('.stat')]
    .filter((s) => START_NOW.test(flat(s.querySelector('.stat-label'))))
    .map((s) => flat(s.querySelector('.stat-value')));
  ok(kgStats.length === 2 && kgStats.every((v) => /^\d[\d,]*( kg)?$/.test(v)),
     `5. and in kg too (${kgStats.join(', ')})`);
  unitsMod.setUnits('lbs');
}

/* ---- 6a. Compare sheet: one "Everyone" ---- */
{
  const pools = COMPARE_OPTIONS.pool.map((o) => o.name);
  ok(pools.includes('All adults') && !pools.includes('Everyone'),
     `6. the pool option is "All adults", so the sheet has one "Everyone" (${pools.join(', ')})`);
}

/* ---- 6c. Research subtitle ---- */
{
  const node = await mount(GraphView(), 250);
  await tab(node, 'Research');
  const heading = flat(node.querySelector('.research-title'));
  const sub = flat(node.querySelector('.research-sub .field-help'));
  const tail = heading.split(' ').slice(-3).join(' ').toLowerCase();
  ok(sub && heading && !sub.toLowerCase().includes(tail), `6. the Research subtitle does not repeat "${tail}" (${sub})`);
}

/* ---- 6d. Volume has a Neck row ---- */
{
  const node = await mount(GraphView(), 250);
  await tab(node, 'Volume', 12);
  const names = [...node.querySelectorAll('.vol-row .vol-name')].map(flat);
  ok(names.includes('Neck'), `6. Volume lists Neck (${names.length} rows)`);
}

/* ---- 7. Months start on Monday ---- */
{
  const node = await mount(CalendarView(), 200);
  const months = [...node.querySelectorAll('.seg')].find((b) => b.textContent === 'Months');
  if (months) months.click();
  await settle(80);
  const block = node.querySelector('.cal-month:not(.is-empty)');
  const dows = [...(block ? block.querySelectorAll('.cal-dow') : [])].map(flat).join('');
  ok(dows === 'MTWTFSS', `7. the week reads Monday first (${dows})`);
  const title = flat(block && block.querySelector('.cal-title'));
  const [mName, yr] = title.split(' ');
  const mi = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'].indexOf(mName);
  const want = (new Date(Number(yr), mi, 1).getDay() + 6) % 7;
  const blanks = block ? block.querySelectorAll('.cal-cell.blank').length : -1;
  ok(mi >= 0 && blanks === want, `7. ${title} starts after ${want} blank(s) (${blanks})`);
}

/* ---- 8. Settings on/off are real switches ---- */
{
  const node = await mount(SettingsView(), 200);
  const sw = [...node.querySelectorAll('button.switch[role="switch"]')];
  const labels = sw.map((b) => flat(node.querySelector(`label[for="${b.id}"]`)));
  // 🔄 Overhaul 2026-09-27 (settings ST-11): six switches; Findable and the
  // group-workout switch moved to Account (ST-2b/ST-3).
  const SIX = ['Glass effects', 'Auto warm-ups', 'Set hints', 'Rest timer', 'Keep screen on', 'More details'];
  ok(sw.length === 6 && SIX.every((l) => labels.includes(l)),
     `8. six switches (${labels.join(', ')})`);
  ok(!labels.some((l) => /Findable|group workouts/i.test(l)),
     '8. and neither Findable nor the group-workout switch is in Settings any more');
  const rest = sw[labels.indexOf('Rest timer')];
  if (rest) {
    const before = rest.getAttribute('aria-checked');
    rest.click();
    await settle(60);
    const after = rest.getAttribute('aria-checked');
    const saved = (await store.getSettings()).restTimer === true;
    ok(before !== after && String(saved) === after, `8. tapping Rest timer flips it and saves (${before} → ${after})`);
    rest.click();
    await settle(60);
    ok(rest.getAttribute('aria-checked') === before && String((await store.getSettings()).restTimer === true) === before,
       '8. and tapping again flips it back');
  } else ok(false, '8. no Rest timer switch');
}

/* ================================================================== *
 * 12. OVERHAUL 2026-09-27 — builder DATA (settings ST-2a/11/12/14/16,
 *     screens SC-4/SC-12, words P1)
 * ================================================================== */

/* ---- 12a. A save that fails puts the knob back (ST-2a) ---- */
{
  const { onOffSwitch } = dataMod;
  let calls = 0;
  const row = onOffSwitch('Test switch', false, () => { calls++; return Promise.reject(new Error('no')); });
  document.getElementById('app').replaceChildren(row);
  const sw = row.querySelector('button.switch');
  sw.click();
  ok(sw.getAttribute('aria-checked') === 'true', '12a. the switch flips the moment it is tapped');
  await settle(20);
  ok(calls === 1 && sw.getAttribute('aria-checked') === 'false',
     '12a. and springs back when the save rejects');
  const kept = onOffSwitch('Test two', false, () => Promise.resolve());
  document.getElementById('app').replaceChildren(kept);
  kept.querySelector('button.switch').click();
  await settle(20);
  ok(kept.querySelector('button.switch').getAttribute('aria-checked') === 'true',
     '12a. a save that resolves keeps the new state');
  const plain = onOffSwitch('Test three', true, () => undefined);
  document.getElementById('app').replaceChildren(plain);
  plain.querySelector('button.switch').click();
  await settle(20);
  ok(plain.querySelector('button.switch').getAttribute('aria-checked') === 'false',
     '12a. a plain return still keeps the new state (views-account callers)');
}

/* ---- 12b. Settings layout: groups, Help, Account, Compared to, word cap ---- */
{
  const node = await mount(SettingsView(), 200);
  const groups = [...node.querySelectorAll('.set-group > .section-label')].map(flat);
  ok(groups.join() === 'Look,Weights,Workout,Data,Help',
     `12b. five groups in order (${groups.join(', ')})`);
  const chipsText = [...node.querySelectorAll('button.chip')].map(flat);
  ok(chipsText.includes('Take the tour') && chipsText.includes('Find me a program'),
     '12b. Help offers the tour and "Find me a program" (moved from Account)');
  ok(['Dark', 'Light', 'Auto'].every((t) => chipsText.includes(t)), '12b. Theme offers Auto');
  const acct = node.querySelector('a.row[href="#/account"]');
  ok(acct && flat(acct) === 'Account', `12b. one plain "Account" row, no sub-line (${flat(acct)})`);
  const labels = [...node.querySelectorAll('label')].map(flat);
  ok(['Units', 'Weight steps', 'Plates', 'Compared to'].every((l) => labels.includes(l)),
     `12b. Units, Weight steps, Plates and Compared to rows (${labels.join(', ')})`);
  const pane = node.querySelector('.pane-scroll') || node;
  // Counted per text node: textContent glues "Dark""Light""Auto" into one word.
  const tw = document.createTreeWalker(pane, window.NodeFilter.SHOW_TEXT);
  const bits = [];
  while (tw.nextNode()) bits.push(tw.currentNode.nodeValue);
  const words = bits.join(' ').split(/\s+/).filter((w) => w && !/^[?›┃]+$/.test(w));
  ok(words.length <= 70, `12b. at most 70 visible words in Settings (${words.length})`);
  ok(!/Nothing here is saved/.test(flat(node)), '12b. the demo has no footer (the demo bar says it)');
  ok(/Display only\./.test(flat(node)) && /Your ranking doesn't change\./.test(flat(node)),
     '12b. the two data-safety lines stay in the open (Rule 9)');

  /* ---- 12c. Compared to opens the muscle map's own sheet ---- */
  const cmpRow = [...node.querySelectorAll('.set-door')].find((r) => /Compared to/.test(flat(r)));
  ok(cmpRow && /Like me|Everyone|Custom/.test(flat(cmpRow.querySelector('.set-door-chip'))),
     `12c. the Compared to row names the preset (${flat(cmpRow && cmpRow.querySelector('.set-door-chip'))})`);
  if (cmpRow && typeof musclesMod.openCompareSheet === 'function') {
    cmpRow.querySelector('.set-door-chip').click();
    for (let i = 0; i < 10; i++) await settle();
    const sheet = [...document.querySelectorAll('.sheet')].pop();
    ok(Boolean(sheet), '12c. tapping it opens a sheet');
    document.querySelectorAll('.sheet-backdrop, .sheet').forEach((s) => s.remove());
  }
}

/* ---- 12d. Weight steps and plates save whole, both units ---- */
{
  const unitsMod = await import(BASE + 'units.js');
  const before = await store.getSettings();
  const node = await mount(SettingsView(), 200);
  const rowOf = (label) => [...node.querySelectorAll('.switch-row')]
    .find((r) => [...r.querySelectorAll('label')].some((l) => flat(l) === label));
  const stepRow = rowOf('Weight steps');
  const chip25 = stepRow && [...stepRow.querySelectorAll('button.chip')].find((b) => flat(b) === '2.5');
  if (chip25) chip25.click();
  await settle(60);
  let s = await store.getSettings();
  ok(s.weightStep && s.weightStep.lbs === 2.5 && s.weightStep.kg === 2.5,
     `12d. Weight steps 2.5 saves lbs and keeps kg (${JSON.stringify(s.weightStep)})`);
  ok(typeof unitsMod.weightStepFor !== 'function' || unitsMod.weightStepFor('lbs') === 2.5,
     '12d. and the engine is re-seeded at once (setWeightPrefs)');

  const platesRow = rowOf('Plates');
  platesRow.querySelector('.set-door-chip').click();
  await settle(40);
  const sheet = document.querySelector('.plates-sheet');
  ok(Boolean(sheet), '12d. the Plates row opens a sheet');
  const bar35 = sheet && [...sheet.querySelectorAll('button.chip')].find((b) => flat(b) === '35 lbs');
  if (bar35) bar35.click();
  await settle(60);
  const p10 = [...document.querySelector('.plates-sheet').querySelectorAll('button.chip')].find((b) => flat(b) === '10');
  if (p10) p10.click();
  await settle(60);
  s = await store.getSettings();
  ok(s.plates && s.plates.lbs && s.plates.lbs.bar === 35 && !s.plates.lbs.have.includes(10),
     `12d. the bar and a plate toggle save (${JSON.stringify(s.plates && s.plates.lbs)})`);
  ok(s.plates && s.plates.kg && s.plates.kg.bar === 20 && s.plates.kg.have.length > 0,
     `12d. and the kg side is written whole, untouched (${JSON.stringify(s.plates && s.plates.kg)})`);
  ok(/35 bar/.test(flat(rowOf('Plates'))), `12d. the row shows the new bar (${flat(rowOf('Plates'))})`);
  document.querySelectorAll('.sheet-backdrop, .sheet').forEach((x) => x.remove());
  await store.saveSettings({ weightStep: before.weightStep, plates: before.plates });
  if (unitsMod.setWeightPrefs) unitsMod.setWeightPrefs(await store.getSettings());
}

/* ---- 12e. Glass effects paints at once and saves ---- */
{
  const node = await mount(SettingsView(), 200);
  const glass = node.querySelector('#' + 'sw-glass-effects');
  ok(glass && glass.getAttribute('aria-checked') === 'true', '12e. Glass effects is on by absence');
  glass.click();
  await settle(60);
  ok(document.documentElement.getAttribute('data-glass') === 'off' && (await store.getSettings()).glass === false,
     '12e. off paints <html data-glass="off"> and saves glass:false');
  glass.click();
  await settle(60);
  ok(!document.documentElement.hasAttribute('data-glass') && (await store.getSettings()).glass === true,
     '12e. and on clears it');
}

/* ---- 12f. SC-12 Bars: no legend, source said once ---- */
{
  const node = await mount(GraphView(), 250);
  await tab(node, 'Bars', 12);
  ok(node.querySelector('.bar-row, .bars, .bar-track'), '12f. the demo draws bars');
  ok(!node.querySelector('.bar-legend'), '12f. no First/Latest legend');
  const cap = flat(node.querySelector('.chart-caption'));
  const oneSource = /^(Workouts|Benchmarks) only/.test(cap);
  const tags = [...node.querySelectorAll('.bar-reps')].map(flat).filter((t) => /^(Workouts|Benchmarks)$/.test(t));
  ok(!oneSource || tags.length === 0,
     `12f. one source: said once in the caption, not on every row (${cap} · ${tags.length} tags)`);
  ok(!/means weight compared/.test(cap), '12f. the @N-reps reading is behind the ?, not in the caption');
}

/* ---- 12g. SC-4 Volume: one-line rows, coloured fill, labelled tick ---- */
{
  const node = await mount(GraphView(), 250);
  await tab(node, 'Volume', 12);
  const rows = [...node.querySelectorAll('.vol-row')];
  ok(rows.length > 0 && !node.querySelector('.vol-sub'), '12g. rows have no second line');
  ok(rows.every((r) => !/days a week|never trained directly/.test(flat(r))),
     '12g. the tier and days a week moved out of the row');
  const fills = [...node.querySelectorAll('.vol-fill')];
  ok(fills.length === rows.length && fills.every((f) => /var\(--vol-/.test(f.getAttribute('style') || '')),
     '12g. every bar is painted from the volume ramp');
  const key = node.querySelectorAll('.vol-tick-key');
  ok(key.length === 1 && /4 sets a week/.test(flat(key[0])), '12g. the 4-set tick is labelled once');
  ok(flat(node.querySelector('.vol-hint')) === 'Tap a muscle for its exercises.', '12g. the short hint');
  const live = rows.find((r) => !r.classList.contains('is-none'));
  if (live) live.click();
  await settle(40);
  ok(/Trained:/.test(flat(node.querySelector('.vol-detail-wrap.is-open'))),
     '12g. the tapped panel says how often it was trained');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
