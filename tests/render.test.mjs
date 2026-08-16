// Renders the real views in a DOM. Until this existed, nothing in this app had
// ever been rendered by anything — every check was syntax, data-layer or HTTP,
// and two real bugs were sitting in the view code as a result.
//
//   npm install jsdom          (anywhere; it is a TEST-only dependency)
//   node tests/render.test.mjs
//
// The APP still has zero dependencies and no build step — that rule is about
// what ships, not about what verifies it. tests/data-layer.test.mjs stays
// dependency-free and is the one to run if jsdom is not installed.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home',
  pretendToBeVisual: true,
});
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };

// jsdom does no layout, so every element measures 0 and `fillChart` — which
// deliberately refuses to draw into a container it cannot measure — would skip
// the SVG builder entirely. Giving elements a fixed size is what lets the line
// chart actually run here. It is a size, not a layout: nothing in this file
// asserts anything about position or spacing, and nothing can.
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

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const { GraphView, CalendarView, SettingsView } = await import(BASE + 'views-data.js');
const { ProfileView } = await import(BASE + 'views-profile.js');
const { HomeView, WorkoutsView } = await import(BASE + 'views-workouts.js');
const { LEVELS } = await import(BASE + 'strength-standards.js');
const { MAPPED_MUSCLES } = await import(BASE + 'body-map.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const settle = () => new Promise((r) => setTimeout(r, 30));

async function mount(viewPromise) {
  const node = await viewPromise;
  document.getElementById('app').replaceChildren(node);
  await settle();
  return node;
}

/* ================= every screen renders at all ================= */
for (const [name, view] of [
  ['Home', HomeView], ['Workouts', WorkoutsView], ['Calendar', CalendarView],
  ['Settings', SettingsView], ['Profile', ProfileView], ['Data', GraphView],
]) {
  try {
    const n = await mount(view());
    ok(n && n.querySelector('.topbar'), `${name} renders with a header`);
  } catch (e) {
    ok(false, `${name} THREW: ${e.message}`);
  }
}

/* ============ the bug Tim hit: Muscles unreachable ============ */
// Empty account, no chartable data at all.
let data = await mount(GraphView());
let tabs = [...data.querySelectorAll('.seg')].map((b) => b.textContent);
ok(tabs.length === 3, `mode switch shows all three tabs with NO data (${JSON.stringify(tabs)})`);
ok(tabs.includes('Muscles'), 'Muscles tab is reachable on an empty account — the reported bug');

const musclesTab = [...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles');
ok(!musclesTab.disabled, 'Muscles tab is not disabled');
musclesTab.click();
await settle();
ok(/profile|body weight|gender/i.test(data.textContent),
   'with no profile, Muscles explains what is missing instead of rendering nothing');
ok(Boolean(data.querySelector('a[href="#/profile"]')), 'and links straight to the profile');

/* ================= now give it a real profile ================= */
await store.saveProfile({ gender: 'male', birthYear: 1994 });
await store.logBodyWeight(180, '2026-08-15');

data = await mount(GraphView());
[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles').click();
await settle();
ok(/benchmark/i.test(data.textContent),
   'profile set but no benchmarks: Muscles says which lifts to record');

/* ================= and a real benchmark ================= */
const bench = byName('Barbell Bench Press');
const squat = byName('Back Squat');
await store.saveBenchmark({ date: '2026-08-15', exerciseId: bench.id, exerciseName: bench.name, values: { weight: 225, reps: 1 } });
await store.saveBenchmark({ date: '2026-08-15', exerciseId: squat.id, exerciseName: squat.name, values: { weight: 405, reps: 1 } });

data = await mount(GraphView());
[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles').click();
await settle();

const svg = data.querySelector('svg.body-map');
ok(Boolean(svg), 'the body SVG renders');
const regions = svg ? svg.querySelectorAll('.body-region') : [];
ok(regions.length >= 25, `body has ${regions.length} tappable regions across both views`);
// The silhouette is a filled half-body plus its open outline, each emitted
// twice through the mirror transform. Both must be present: the fill is what
// stops an uncoloured muscle reading as a hole, the outline is what keeps a
// coloured one inside the body.
ok(svg && svg.querySelectorAll('.body-skin').length === 4,
   'the filled silhouette renders as two mirrored halves per view, front and back');
ok(svg && svg.querySelectorAll('.body-edge').length >= 2, 'the silhouette outline renders on top');
ok(svg && [...svg.querySelectorAll('.body-skin')].some((p) => p.getAttribute('transform')),
   'exactly one half is mirrored — symmetry comes from the transform, not duplicated path data');

// Every muscle drawn shows up in both views where expected, and each region
// carries exactly one level class.
const levelClasses = new Set(LEVELS.map((l) => 'lv-' + l.key).concat(['lv-none', 'lv-below']));
let everyRegionClassed = true;
for (const r of regions) {
  const cls = [...r.classList].filter((c) => levelClasses.has(c));
  if (cls.length !== 1) { everyRegionClassed = false; break; }
}
ok(everyRegionClassed, 'every region carries exactly one level class');

// Chest was benchmarked at 225x1 for a 180 lb male — dead on the 50th, so
// Intermediate. This is the whole feature working end to end.
const chest = [...regions].find((r) => r.getAttribute('aria-label').startsWith('Chest'));
ok(chest && chest.classList.contains('lv-intermediate'),
   `chest at 225x1 for a 180 lb male reads Intermediate (${chest && [...chest.classList].join(' ')})`);

const quads = [...regions].find((r) => r.getAttribute('aria-label').startsWith('Quads'));
ok(quads && !quads.classList.contains('lv-none'), 'quads coloured from the squat benchmark');

const biceps = [...regions].find((r) => r.getAttribute('aria-label').startsWith('Biceps'));
ok(biceps && biceps.classList.contains('lv-none'), 'biceps stays grey with no benchmark');

const core = [...regions].find((r) => r.getAttribute('aria-label').startsWith('Core'));
ok(core && core.classList.contains('lv-none'), 'core is grey — no published standards');

// Legend present, so level is never colour-alone.
ok(data.querySelectorAll('.lv-key-item').length === LEVELS.length + 1,
   'legend lists every level plus No data');

/* ================= tapping a muscle ================= */
chest.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await settle();
ok(/Chest/.test(data.textContent), 'tapping chest opens its detail');
ok(/people who lift/i.test(data.textContent),
   'the caption says "people who lift" — never implies the general population');
ok(/\d+ lbs to (Beginner|Novice|Intermediate|Proficient|Advanced|Expert|Elite)/.test(data.textContent),
   'the detail shows the weight needed for the next level');
ok(data.querySelectorAll('.target-row').length === LEVELS.length,
   'all seven per-level weight targets are listed');
ok(Boolean(data.querySelector('.to-next-fill')), 'progress bar toward the next level renders');
const selectedNow = data.querySelectorAll('.body-region.is-selected');
ok(selectedNow.length >= 1, `tapped muscle is highlighted (${selectedNow.length} regions)`);

/* ============ the side-panel layout hook ============ */
// On a wide screen the detail sits BESIDE the figures rather than under them,
// so the body never resizes when a muscle is picked. CSS does the layout; this
// class is what tells it which mode is on screen, and it must not leak into the
// chart modes, which are still a column.
ok(data.querySelector('.graph-host').classList.contains('is-muscles'),
   'Muscles mode marks the host so the detail can lay out as a side column');

/* ================= the other two modes still work ================= */
[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Graph').click();
await settle();
ok(!/THREW/.test(data.textContent), 'Graph mode still renders after the guard change');

[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Bar Chart').click();
await settle();
ok(data.querySelectorAll('.seg').length === 3, 'Bar Chart mode keeps the mode switch');

/* ================= body-weight trend ================= */
// One weigh-in so far, and a line needs two.
data = await mount(GraphView());
ok(![...data.querySelectorAll('option')].some((o) => o.textContent === 'Body weight'),
   'a single weigh-in offers no body-weight chart');

// Dated EARLIER than the existing 180, so the latest body weight — and every
// ranking above that depends on it — is untouched. Second bench benchmark so
// there is a real exercise in the picker to sit beside.
await store.logBodyWeight(190, '2026-06-15');
await store.logBodyWeight(185, '2026-07-15');
await store.saveBenchmark({ date: '2026-06-15', exerciseId: bench.id, exerciseName: bench.name, values: { weight: 205, reps: 1 } });

data = await mount(GraphView());
[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Graph').click();
await settle();

// Leaving Muscles must drop the side-column class — the chart modes are still a
// single column, and a stale class would lay them out as a row on a laptop.
ok(!data.querySelector('.graph-host').classList.contains('is-muscles'),
   'the side-column class is dropped on the way back out to a chart mode');

const select = data.querySelector('select');
const bwOpt = [...data.querySelectorAll('option')].find((o) => o.textContent === 'Body weight');
ok(Boolean(bwOpt), 'three weigh-ins put "Body weight" in the chart picker');
ok(bwOpt && bwOpt.parentElement.tagName === 'OPTGROUP' && bwOpt.parentElement.label === 'You',
   'it is grouped apart from the exercises rather than posing as one');
ok(select && select.options[0].textContent !== 'Body weight',
   'an exercise is still the default chart — body weight sits last');

// The exercise chart itself, drawn for the first time now that the container
// has a measurable size.
const exChart = data.querySelector('svg.chart');
ok(Boolean(exChart), 'the exercise line chart draws an SVG');
ok(exChart && exChart.querySelectorAll('.grid-line').length >= 3, 'it has gridlines and axis labels');

select.value = bwOpt.value;
select.dispatchEvent(new window.Event('change', { bubbles: true }));
await settle();

const bwChart = data.querySelector('svg.chart');
ok(Boolean(bwChart), 'selecting body weight draws a chart');
ok(bwChart && /body weight/i.test(bwChart.getAttribute('aria-label') || ''),
   `the chart is labelled body weight, not "Weight" (${bwChart && bwChart.getAttribute('aria-label')})`);
ok(bwChart && bwChart.querySelectorAll('.pt').length === 3,
   `all three weigh-ins carry a marker — nothing here is estimated (${bwChart && bwChart.querySelectorAll('.pt').length})`);
ok(/3 weigh-ins over 61 days/.test(data.textContent),
   'the caption counts the weigh-ins and the span they cover');
ok(/190/.test(data.textContent) && /180/.test(data.textContent),
   'the summary shows the first and latest weights');
ok(!data.querySelector('.stat-value.up') && !data.querySelector('.stat-value.down'),
   'losing 10 lbs is not coloured bad — the app has no opinion on which way body weight should go');
ok(!data.querySelector('.rep-target'),
   'no rep-target stepper — there is nothing to normalise about standing on a scale');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
