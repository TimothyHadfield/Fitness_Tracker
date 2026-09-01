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
/* ⚠️ ADDED 2026-09-02, and its absence hid a real failure. The back arrow now
   reads `history.state` to decide whether there is a screen behind this one;
   without this line that was a ReferenceError thrown inside a click handler,
   which jsdom reports to its virtual console and swallows — so the button
   silently did nothing and the only symptom was one assertion failing with no
   stack anywhere near the cause. `ui.js` also guards it, and both are worth
   having: the guard keeps the app working, this keeps the test honest. */
globalThis.history = window.history;
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
// The demo flag lives here, and it is per-tab on purpose — see store.js. Without
// it the demo simply reports itself unavailable, which would make every demo
// assertion below pass by never running.
const sess = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
};

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const { GraphView, CalendarView, SettingsView } = await import(BASE + 'views-data.js');
const { ProfileView } = await import(BASE + 'views-profile.js');
const { HomeView, WorkoutsView, SystemRouteView, WorkoutRouteView, StartPickerView } = await import(BASE + 'views-workouts.js');
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
/* ⚠️ FIVE since 2026-08-31: Volume joined (D3's headline metric). Four from
   2026-08-28 when Research joined; three from 2026-08-25, when Calendar left
   this control and became its own nav tab. The count is asserted rather than
   just the contents, because a segment silently disappearing is exactly the
   class of bug this block was written for — and this note has twice demanded the
   360px clipping measurement before a new segment ships. It was run for Volume,
   over CDP in both themes: a 293px row, labels 63+60+51+39+68 = 281px, nothing
   clipped, and the four that were already there came out the same width they
   were with four segments. A SIXTH does not fit in the 12px left over. */
ok(tabs.length === 5, `mode switch shows five tabs with NO data (${JSON.stringify(tabs)})`);
ok(tabs[1] === 'Volume',
   '⚠️ Volume sits beside Muscles — two readings of the same body, not a chart mode');
ok(tabs.includes('Research'),
   'Research is reachable on an empty account — published data needs no history');
ok(tabs.includes('Muscles'), 'Muscles tab is reachable on an empty account — the reported bug');
ok(tabs[0] === 'Muscles',
   '⚠️ and Muscles is FIRST — it is the mode that works with the least history, where a line chart needs two points');
ok(!tabs.includes('Calendar'),
   '⚠️ and the calendar is NOT in here any more — it has its own tab, and two ways in would light two things at once');
ok([...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles')
     .getAttribute('aria-selected') === 'true',
   '⚠️ and the Data screen OPENS on Muscles rather than on a chart');

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
ok(regions.length >= 15, `body has ${regions.length} tappable regions across both views`);
// One path per muscle group per view, and every one carries real geometry.
ok(svg && [...regions].every((r) => (r.getAttribute('d') || '').length > 200),
   'every region is a traced path, not an empty placeholder');
ok(svg && svg.querySelectorAll('.body-paper').length === 2,
   'each view is printed on its own sheet of paper');

// The ink is the drawing itself — keylines, striations, shading — carried as a
// luminance mask over a rectangle of ink colour. If the mask reference or the
// image goes missing the figure renders as flat silhouettes with no detail at
// all, which is the one failure that would not look like a bug in a screenshot.
const inkRects = svg ? [...svg.querySelectorAll('.body-ink')] : [];
ok(inkRects.length === 2, 'both views carry an ink layer');
ok(inkRects.every((r) => /^url\(#bm-ink-/.test(r.getAttribute('mask') || '')),
   'the ink layer is masked');
const maskIds = svg ? [...svg.querySelectorAll('mask')].map((m) => m.id) : [];
ok(inkRects.every((r) => maskIds.includes(
     (r.getAttribute('mask') || '').slice(5, -1))),
   'every ink mask reference resolves to a mask in the same SVG');
const inkImgs = svg ? [...svg.querySelectorAll('mask image')] : [];
ok(inkImgs.length === 2
   && inkImgs.every((i) => /^img\/ink-(front|back)\.webp$/.test(i.getAttribute('href'))),
   'each mask loads its view\'s ink image');

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

/* ⚠️ THE KEY IS CHIPS, AND THEY ARE NOT DECORATION.
 *
 * Rebuilt 2026-08-25 on Tim's reference image: one chip per level, the level's
 * name inside it, shaded in its colour. The palette that came with it fails the
 * dataviz validator's CVD adjacency check on green↔orange, and the validator's
 * own rule is that such a failure is survivable ONLY with direct labels. These
 * chips ARE those labels, so a change that shrinks them back toward unlabelled
 * swatches takes the palette's justification away with it. That is why the name
 * inside each chip is asserted rather than just the count.
 */
const chips = [...data.querySelectorAll('.lv-chip')];
ok(chips.length === LEVELS.length, `the key is ${chips.length} chips, one per level`);
ok(LEVELS.every((l) => chips.some((c) => c.textContent.includes(l.name))),
   '⚠️ every level NAME is inside its own chip — the secondary encoding the palette depends on');
ok(LEVELS.every((l) => chips.some((c) => c.classList.contains('lv-' + l.key))),
   'and each chip carries its level class, so it is shaded in that level\'s colour');
// "No data" and the fade are notes, not levels: making them chips would invent
// two rankings nobody can reach.
ok(data.querySelectorAll('.lv-key-item').length === 2,
   'No data and the confidence fade stay notes rather than becoming levels');
ok([...data.querySelectorAll('.lv-key-item')].some((n) => /less sure/i.test(n.textContent)),
   'and the fade is explained in words, not left as colour alone');
ok(!/\d+%/.test(data.querySelector('.lv-key').textContent),
   '⚠️ and the key carries NO percentages by default — the level is the answer, the percentile is the working');

/* ================= tapping a muscle ================= */
chest.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await settle();
ok(/Chest/.test(data.textContent), 'tapping chest opens its detail');
// The comparison group is now the user's choice, so the caption is no longer one
// fixed string. The invariant it has to keep is the one that matters: whatever
// group is named, it is always a group of people who LIFT. Never the public.
// ⚠️ ASSERTED ON THE HEADER, not on the whole screen — changed 2026-08-21 when
// the panel stopped restating the comparison group. D15's rule is unchanged and
// unweakened: the UI must always say "of people who lift". What changed is WHERE
// it is said. `.pane-top` is `flex: none`, so that line is on screen at every
// moment the panel is, and two lines agreeing with each other was the redundancy
// worth cutting rather than the claim.
//
// (The old assertion read the whole screen and passed on the panel's copy. It
// broke here for a reason worth knowing: textContent concatenates with no
// separator, so the header alone reads "…who lift180 lbs" and `\b` after
// "lift" never matches. It was a boundary artefact, not a lost claim.)
const compareHeader = data.querySelector('.pane-top');
ok(compareHeader && /who lifts?/i.test(compareHeader.textContent),
   'the fixed header names a population that lifts — never implies the general population');
ok(!/\d+% of (all )?(people|adults)\b(?! who)/i.test(data.textContent),
   'and never claims a percentile against people in general');
ok(/\d+ lbs to (Beginner|Novice|Intermediate|Proficient|Advanced|Expert|Elite)/.test(data.textContent),
   'the detail shows the weight needed for the next level');

/* ── The panel is short, and stays short (Tim, 2026-08-21) ─────────────────
   "Make way less words on the bottom. We want it to be easy to understand, not
   a paragraph." It was a paragraph — a source sentence, a confidence block with
   a bar and a corroboration line, up to three multi-line caveats, a restatement
   of the header, and a seven-row table of per-level weight targets.

   ⚠️ A WORD COUNT, because that is the actual property asked for and nothing
   else measures it. Every other assertion here checks that something is
   PRESENT; the failure mode this guards is things quietly accumulating until
   the panel is a wall again, which no presence check can ever catch. */
const panel = data.querySelector('.muscle-detail');
ok(Boolean(panel), 'tapping a muscle opens the short detail panel');
ok(!data.querySelector('.target-row'),
   'the seven-row per-level target table is gone — six of its rows were levels nobody is near');
ok(!data.querySelector('.conf-bar'),
   'and so is the confidence bar, which drew the same quantity as the muscle’s own fade (D19)');

// ⚠️ This fixture is a CLEAN rating — one benchmark at 225×1, no fallback, no
// high-rep flag, no blocked sets — so the count measures the common path, which
// is the one that accumulates. A muscle carrying three caveats will legitimately
// run longer; the caveats are the one thing here allowed to cost words.
const panelWords = panel.textContent.trim().split(/\s+/).length;
ok(panelWords <= 40,
   `a clean rating fits in ${panelWords} words — a glance, not a paragraph (cap 40)`);

// ...and it still says the four things somebody taps a muscle to find out.
const panelText = panel.textContent.replace(/\s+/g, ' ');
ok(/Chest/.test(panelText), 'it names the muscle');
ok(/Intermediate/.test(panelText), 'and the level it has reached');
ok(/\d+ lbs\b/.test(panelText), 'and the estimate, which is the number the screen exists for');
/* 🚨 AND WHAT THAT NUMBER IS — Tim, 2026-08-31: *"I have no idea what that weight
 * means. Is it for a specific exercise, or the one it's basing its decision off
 * of?"* Neither: it is an estimated one-rep max on the muscle's KEY LIFT, which
 * every contributing exercise was converted into. The screen has never said so.
 *
 * ⚠️ BOTH HALVES ARE ASSERTED. Naming the lift without the word "estimated"
 * would put it a line above "from Barbell Bench Press 220×3" — a real recorded
 * set — with nothing to tell the reader which of the two was measured. */
ok(/Estimated 1-rep max in Barbell Bench Press/.test(panelText),
   '🚨 and it SAYS what the weight is: an estimated 1-rep max in the muscle\'s key lift, named');
/* ⚠️ NO PERCENTILE BY DEFAULT — Tim, 2026-08-25: "showing the percentile is a
 * little harsh for some people." What must stay true is that hiding it hides a
 * READOUT and not the reasoning: the level above is still computed from that
 * same percentile, which is why `Intermediate` is asserted two lines up. */
ok(!/stronger than/.test(panelText) && !/\b\d+%/.test(panelText),
   '⚠️ but NOT the percentile — the ranking is the answer, and being ranked against people by number is the part that stings');
ok(/confidence/i.test(panelText),
   '⚠️ and how much to believe it — shortened to a word, never dropped');
ok(/from .+\d+×\d+/.test(panelText),
   '⚠️ and the set it was converted FROM (Rule 5: an inference must not look like a measurement)');
// One benchmark in this fixture, so one source line — the multi-source case is
// driven with three real chest lifts further down.
ok(panel.querySelectorAll('.muscle-sources > *').length === 1,
   'a rating built from one exercise names one set');
ok(Boolean(data.querySelector('.to-next-fill')), 'progress bar toward the next level renders');
const selectedNow = data.querySelectorAll('.body-region.is-selected');
ok(selectedNow.length >= 1, `tapped muscle is highlighted (${selectedNow.length} regions)`);

/* ⚠️ AND "MORE DETAILS" BRINGS IT BACK — otherwise this is not a setting, it is
 * a deletion with a switch next to it. Both directions are asserted, because a
 * one-way test passes just as well against a hard-coded `false`. */
{
  /* Two traps here, both worth naming because they cost a run each:
   *   - the muscle pane is async inside a SYNC click handler, so it needs more
   *     than one turn of the loop to land;
   *   - `selected` in views-muscles.js is MODULE-level and survives a remount,
   *     so Chest is still open from the block above and clicking it again would
   *     toggle it shut. Open one only if nothing is open. */
  const openMuscles = async () => {
    const node = await mount(GraphView());
    const seg = [...node.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles');
    if (seg) seg.click();
    for (let i = 0; i < 6; i++) await settle();
    if (!node.querySelector('.muscle-detail')) {
      const c = [...node.querySelectorAll('.body-region')]
        .find((r) => (r.getAttribute('aria-label') || '').startsWith('Chest'));
      if (c) c.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 4; i++) await settle();
    }
    return node;
  };

  await store.saveSettings({ moreDetails: true });
  const on = await openMuscles();
  ok(Boolean(on.querySelector('.muscle-detail')), 'a muscle panel is open to read');
  const onText = on.querySelector('.muscle-detail').textContent.replace(/\s+/g, ' ');
  ok(/stronger than \d+%/.test(onText),
     '⚠️ with More details on, the percentile is back on the muscle panel');
  ok(/\d+%/.test(on.querySelector('.lv-key').textContent),
     'and the key shows what each level is worth, which is the other half of the working');

  await store.saveSettings({ moreDetails: false });
  const off = await openMuscles();
  ok(!/\d+%/.test(off.querySelector('.lv-key').textContent),
     'and turning it off hides them again — the switch works in both directions');

  /* 🚨 ALL THREE CONTRIBUTORS, NOT JUST THE LEADER (2026-08-31). Tim: *"you
   * mentioned how the muscle group estimate is based off your top three
   * recordings based on credibility, but when you click on a muscle it only
   * shows one recording. Could you instead show all 3?"* The panel named
   * `contributors[0]` and said nothing about the rest, so a number built from
   * three exercises looked like a number built from one.
   *
   * ⚠️ THREE DIFFERENT EXERCISES, on three different days. rateMuscle() gives
   * each exercise ONE seat and each exercise-day one value, so three sessions of
   * the same lift would produce a single source line and this test would pass
   * for the wrong reason — which is the exact bug the "three exercises, not
   * three sets" fix in muscle-evidence.js was about. */
  for (const [i, name] of ['Barbell Bench Press', 'Incline Dumbbell Bench Press', 'Machine Chest Press'].entries()) {
    await store.saveSession({
      workoutName: 'Push', date: `2026-08-1${i + 1}`, startedAt: `2026-08-1${i + 1}T10:00:00.000Z`,
      entries: [{ exerciseId: byName(name).id, exerciseName: name,
        sets: [{ weight: 150 - i * 20, reps: 5 }] }],
    });
  }
  const many = await openMuscles();
  const sources = [...many.querySelectorAll('.muscle-sources > *')].map((n) => n.textContent);
  ok(sources.length === 3,
     `🚨 all three contributing sets are named (${sources.length}) — the estimate is a blend of `
     + 'three exercises and the panel now shows the whole of the working');
  ok(/^from /.test(sources[0]) && sources.slice(1).every((s) => /^and /.test(s)),
     'reading as one sentence: "from … and … and …", in the credibility order they are weighted in');
  ok(new Set(sources.map((s) => s.replace(/^(from|and) /, '').split(/\s\d/)[0])).size === 3,
     '⚠️ and they are three DIFFERENT exercises — one seat each, which is what makes a corroborated '
     + 'reading different from the same lift counted three times');
}

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

[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Bars').click();
await settle();
ok(data.querySelectorAll('.seg').length === 5, 'Bars mode keeps the mode switch (five segments since Volume)');

/* ================= the Research mode (2026-08-28) ================= */
// Tim: "I want to add a 'Research' tab in the data section… a graph that
// shows how average strength increases or decreases depending on age for
// each muscle group." js/research-data.js carries the sourcing argument.
{
  [...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Research').click();
  await settle(); await settle();

  ok(/How strength changes with age/.test(data.textContent), 'Research opens on the age chart');
  ok(Boolean(data.querySelector('.research-chart')), 'and the chart is drawn');
  // ⚠️ Eight lines + the app's grading reference — see research-data.js for
  // why eleven would have been three invented curves.
  ok(data.querySelectorAll('.research-chart path').length === 9,
     `eight measured series plus the dashed grading reference (${data.querySelectorAll('.research-chart path').length})`);
  const keys = [...data.querySelectorAll('.research-key')].map((b) => b.textContent.trim());
  ok(keys.length === 9 && keys.includes('Quads') && keys.includes('Forearms'),
     'every line has a labelled legend chip, so identity is never colour-alone');
  ok(/Chest, Back and Traps/.test(data.textContent),
     '⚠️ the groups with NO published curve are named as missing, not drawn anyway');
  ok(/not a one-rep max/.test(data.textContent),
     'and the screen says what the measurement actually is');
  const doi = data.querySelector('.research-notes a');
  ok(doi && /doi\.org/.test(doi.href), 'the study is linked, not just name-dropped');

  // The table view — the relief the light-mode contrast WARN obligates.
  const rows = data.querySelectorAll('.research-table tbody tr');
  ok(rows.length === 8, `the table carries all eight groups (${rows.length})`);
  ok(rows[0].querySelectorAll('td').length === 6, 'six measured age groups per row');

  // Tap a legend chip → that series is isolated, tap again → back. The
  // legend REBUILDS on every draw, so the chip is re-found after each tap —
  // holding the old node would read a detached button's stale state.
  const quadsChip = () => [...data.querySelectorAll('.research-key')].find((b) => b.textContent.trim() === 'Quads');
  quadsChip().click(); await settle();
  ok(quadsChip().getAttribute('aria-pressed') === 'true', 'tapping a muscle follows its line');
  ok([...data.querySelectorAll('.research-chart g')].some((g) => g.getAttribute('opacity') === '0.18'),
     'and the other lines step back rather than vanish');
  quadsChip().click(); await settle();
  ok(quadsChip().getAttribute('aria-pressed') === 'false', 'tapping again releases it');

  /* ---- the basics topics (2026-08-30, Tim's ask) ----
     "collect information to educate users on the basics of weightlifting…
     before we put anything on here, we need to be confident."
     The CONTENT is asserted in data-layer.test.mjs (sources, word budgets,
     the three claims that would be worst to get backwards). These pin the
     things only a mounted DOM can see. */
  const { TOPICS } = await import('../js/research-topics.js');
  const topics = [...data.querySelectorAll('.rt-topic')];
  ok(topics.length === TOPICS.length,
     `every topic is on the screen (${topics.length} of ${TOPICS.length})`);

  // ⚠️ COLLAPSED ON ARRIVAL. Eleven topics open at once is the wall this
  // content exists not to be, and Tim's own second constraint. If somebody
  // makes them open by default the Research pane silently becomes ~2,000
  // words of prose above the chart.
  ok(topics.every((d) => !d.open), 'they arrive collapsed — the pane stays scannable');
  ok(topics.every((d) => d.tagName === 'DETAILS' && d.querySelector('summary')),
     '⚠️ a real <details>/<summary>, so it is keyboard and screen-reader native');

  // ⚠️ DRIVEN, NOT READ. Open one and require the answer, a caveat and a
  // live link — the failure this catches is a summary that expands to
  // nothing, which reads as a broken feature and passes any "the text is in
  // textContent" check because a closed <details> still holds its children.
  const first = topics[0];
  first.open = true;
  ok(/overlap far more than people think/.test(first.textContent),
     'opening one shows its answer');
  ok(Boolean(first.querySelector('.rt-caveat')), 'and the limit it states about itself');
  const src = first.querySelector('.rt-src a');
  ok(src && /^https:\/\//.test(src.href), 'and its sources are links, not name-drops');
  first.open = false;

  // The confidence label is a WORD on every topic, never a colour. Design
  // Rule 5's general form — the 2026-08-25 audit is why the level names on
  // the muscle map stopped being painted in the level's own colour.
  const pills = [...data.querySelectorAll('.rt-conf')];
  ok(pills.length === TOPICS.length, 'every topic wears a confidence label');
  ok(pills.every((p) => /evidence/i.test(p.textContent)),
     '⚠️ and it says the word — greyscale, colour-blind and screenshot safe');

  // Tim's questions, on the screen, in his words.
  for (const phrase of ['Free weights vs machines', 'Warming up and stretching',
                        'Time of day', 'Common misconceptions']) {
    ok(data.textContent.includes(phrase), `the screen asks it out loud: ${phrase}`);
  }
}

[...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Bars').click();
await settle();

/* ============ neither chart mode is ever a dead end ============ */
// Tim, 2026-08-17: a chart needs the same lift on two days, but the numbers
// exist from the first workout and should be visible. Both modes fall back to
// the current-bests list rather than an empty state, and no tab is disabled.
ok(![...data.querySelectorAll('.seg')].some((b) => b.disabled),
   'no mode tab is ever disabled — each one leads somewhere useful');
for (const mode of ['Graph', 'Bars']) {
  [...data.querySelectorAll('.seg')].find((b) => b.textContent === mode).click();
  await settle();
  const rows = data.querySelectorAll('.best-row');
  ok(rows.length > 0, `${mode} shows where every lift stands when it cannot draw a line`);
  ok(/\d/.test(data.querySelector('.best-set').textContent),
     `${mode}'s list shows actual numbers, not just names`);
  ok(!/Nothing to chart yet|Nothing to compare yet/.test(data.textContent),
     `${mode} no longer dead-ends on "nothing to chart"`);
}

/* ================= Volume — weekly sets per muscle (2026-08-31) =================
 * D3's headline metric, finally on a screen. The arithmetic is pinned in
 * data-layer.test.mjs against fixed dates; these are the things only a mounted
 * DOM can see.
 *
 * ⚠️ IT RUNS AFTER THE DEAD-END BLOCK ABOVE, and that is not tidiness. This
 * fixture logs the same lift on several days, which is exactly what makes an
 * exercise CHARTABLE — dropping it earlier in the file replaced the
 * current-bests fallback with a real line chart and failed a 2026-08-17
 * assertion that had nothing to do with volume.
 *
 * ⚠️ THE SESSIONS ARE DATED FROM TODAY, not hard-coded. This screen reads a
 * TRAILING WINDOW, so a fixture written as "2026-08-15" would drift out of it
 * and this whole block would quietly start asserting against an empty state —
 * passing for the wrong reason, which is the failure mode the vacuous "exactly
 * one ✕" test taught this file on 2026-08-30. */
{
  const iso = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
  const squat = byName('Back Squat');
  for (const [i, back] of [20, 17, 13, 9, 5, 1].entries()) {
    const ex = i % 2 ? squat : bench;
    await store.saveSession({
      workoutName: 'V', date: iso(back), startedAt: `${iso(back)}T10:00:00.000Z`,
      entries: [{ exerciseId: ex.id, exerciseName: ex.name,
        sets: [{ weight: 185, reps: 8 }, { weight: 185, reps: 8 }, { weight: 185, reps: 8 }] }],
    });
  }

  data = await mount(GraphView());
  [...data.querySelectorAll('.seg')].find((b) => b.textContent === 'Volume').click();
  await settle(); await settle();

  const rows = [...data.querySelectorAll('.vol-row')];
  ok(rows.length === 12, `every volume muscle gets a row (${rows.length})`);
  ok(/ \/ wk/.test(rows[0].textContent),
     'with three weeks of history it states a RATE — sets a week, which is the metric');
  ok(/Chest|Quads/.test(rows[0].querySelector('.vol-name').textContent),
     'and the most-trained muscle leads');

  // ⚠️ A MUSCLE ON ZERO IS STILL A ROW. "No calf work for a month" is the
  // finding; omitting calves would answer a different question quietly.
  ok(rows.some((r) => /Nothing logged/.test(r.textContent)),
     'muscles with no work are listed, on zero, and say so');

  // No bar may overflow its track — the scale is shared across every row, so
  // one runaway muscle would otherwise redraw the comparison everyone reads.
  ok([...data.querySelectorAll('.vol-fill')].every((f) => parseFloat(f.style.width) <= 100),
     'no bar overruns the shared scale');
  ok(data.querySelectorAll('.vol-med').length === rows.length,
     '⚠️ every row draws the 4-sets-a-week tick — the one threshold the source actually states');

  /* ================= the body map, coloured by SETS (2026-09-01) =================
   * Tim: *"the exact same human body display with the coloured muscle groups
   * (exact same picture), but instead coloured them by the number of sets."*
   *
   * 🚨 THE SAME ART CARRYING A DIFFERENT MEANING is the risk this block exists
   * for. Two screens now paint one drawing from two scales, so what is asserted
   * is that this one says SETS everywhere it speaks — the figure's own label and
   * every muscle's — and that nothing on it is grey. */
  const fig = data.querySelector('.vol-figure svg.body-map');
  ok(Boolean(fig), 'the body map is on the Volume tab, the same figure as Muscles');
  ok(/sets/.test(fig.getAttribute('aria-label') || '') && !/strength/.test(fig.getAttribute('aria-label') || ''),
     `⚠️ and it announces itself as SETS, not as strength (${fig.getAttribute('aria-label')})`);
  const painted = [...fig.querySelectorAll('.body-region')];
  ok(painted.length >= 15 && painted.every((p) => /lv-vol-/.test(p.className.baseVal || '')),
     `🚨 every muscle on the figure is painted from the volume ramp (${painted.length})`);
  /* 🚨 NO GREY, ANYWHERE, and that is the difference from the strength map worth
     pinning. Over there a muscle with no published standard can never be ranked
     and is painted the same grey as "no data" — which is the abs complaint. Zero
     sets is a number, so this figure always has something true to say. */
  ok(!painted.some((p) => /lv-none/.test(p.className.baseVal || '')),
     '🚨 and NONE of them is grey — zero sets is a number, so nothing here is unrankable');
  ok(painted.some((p) => /lv-vol-none/.test(p.className.baseVal || '')),
     'a muscle with no work wears the ramp\'s own bottom step instead');
  ok(painted.every((p) => /\d/.test(p.getAttribute('aria-label') || '')),
     '⚠️ every muscle states its number in text — the ramp is red-to-green, so nothing may be colour-alone');

  const chips = [...data.querySelectorAll('.vol-chip')];
  ok(chips.length === 5, `the legend names all five bands (${chips.length})`);
  ok(chips.every((c) => /\w/.test(c.textContent)),
     '🚨 in WORDS — the secondary encoding a red-to-green ramp is only legal with');
  ok(chips[0].textContent.trim() === 'None' && chips[chips.length - 1].textContent.trim() === '20+',
     '⚠️ and it reads in the direction the ramp runs, none first — the lookup order is the '
     + `reverse of it, so this is the one place they are allowed to differ (${chips.map((c) => c.textContent.trim()).join(' ')})`);

  /* ⚠️ THE CONTRIBUTORS ARE WHAT MAKE THE NUMBER CHECKABLE. A fractional weekly
     set count is derived through a rule most people have never heard of, and a
     derived number nobody can audit is one they either over-trust or stop
     believing. Picking a muscle names the exercises behind it.

     ⚠️ THE WORKING HAS ONE HOME. It used to open inside the row; with the figure
     above, that would be the same block on screen twice — the fault Tim named on
     the set row ("it doesn't have 2 places for the same thing"). So the row
     SELECTS and the panel under the figure is where the working lives. */
  ok(!data.querySelector('.vol-detail-wrap.is-open'),
     'nothing is selected to begin with');
  ok(!data.querySelector('.vol-hint').hidden, 'and the screen says how to pick one');
  const openName = rows.find((r) => !/Nothing logged/.test(r.textContent))
    .querySelector('.vol-name').textContent;
  const rowFor = (name) => [...data.querySelectorAll('.vol-row')]
    .find((r) => r.querySelector('.vol-name').textContent === name);
  rowFor(openName).click();
  await settle();
  const opened = rowFor(openName);
  ok(opened.getAttribute('aria-pressed') === 'true', 'tapping a row selects that muscle');
  ok(data.querySelectorAll('.vol-detail-wrap.is-open').length === 1,
     'exactly one panel opens, under the figure');
  ok(data.querySelector('.vol-hint').hidden, 'and the how-to-pick line gets out of the way');
  const detail = data.querySelector('.vol-detail-wrap.is-open .vol-detail');
  ok(Boolean(detail), 'and the detail is there');
  ok(new RegExp(openName).test(data.querySelector('.vol-picked-name').textContent),
     'the panel names the muscle that was picked');
  ok(fig.dataset.selected === openName,
     '🚨 and the FIGURE outlines the same one — one selection, not two that can disagree');
  ok(detail.querySelectorAll('.vol-contrib-row').length > 0,
     '🚨 naming the exercises the sets came from, so the total can be checked against real sessions');
  ok(/direct|half/.test(detail.textContent),
     'each one saying whether it counted whole or half');
  ok(/efficiency|minimum effective dose|Below the minimum|Beyond the evidence/.test(detail.textContent),
     'with the published tier in words, not a colour');
  ok(/For strength/.test(detail.textContent),
     'and the strength tier beside it, which flattens far earlier than the growth one');

  /* 🚨 THE PARTS ADD UP TO THE WHOLE ON SCREEN, IN THE SAME UNIT. The first
     version of this block failed exactly here and nothing caught it: the row read
     "21.8 / wk" and the exercises under it listed 24, 21, 18 — the store counts a
     WINDOW and the row divides it by the weeks, so the detail was quoting a
     different quantity in the same column. A reader checking the number would
     have concluded the app cannot add up. */
  const headline = parseFloat(data.querySelector('.vol-picked-num').textContent);
  const partsSum = [...detail.querySelectorAll('.vol-contrib-sets')]
    .reduce((t, n) => t + parseFloat(n.textContent), 0);
  ok(Math.abs(partsSum - headline) <= 0.2 * Math.max(1, detail.querySelectorAll('.vol-contrib-sets').length),
     `🚨 the exercises listed add up to the number above them (${partsSum} vs ${headline}, `
     + 'each rounded to a tenth) — same unit, sets a week');
  ok(/a week/.test(detail.querySelector('.vol-contrib-head').textContent),
     'and the heading says which unit they are in');
  ok(parseFloat(opened.querySelector('.vol-num').textContent) === headline,
     'and the row and the panel quote the same number for the same muscle');

  /* ⚠️ THE FIGURE IS THE OTHER WAY IN, and it drives the same selection. Picking
     a DIFFERENT muscle on the body must move the row too — two controls over one
     piece of state is exactly where a screen starts contradicting itself. */
  const other = painted.find((p) => (p.getAttribute('aria-label') || '').split(' —')[0] !== openName);
  const otherName = other.getAttribute('aria-label').split(' —')[0];
  other.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settle();
  ok(fig.dataset.selected === otherName, 'tapping the body picks that muscle');
  ok(new RegExp(otherName).test(data.querySelector('.vol-picked-name').textContent),
     'the panel follows the body');
  ok(rowFor(otherName).getAttribute('aria-pressed') === 'true'
    && rowFor(openName).getAttribute('aria-pressed') === 'false',
     '🚨 and so does the list — one selection, three places, and they cannot disagree');

  rowFor(otherName).click();
  await settle();
  ok(!data.querySelector('.vol-detail-wrap.is-open')
    && !fig.dataset.selected
    && !data.querySelector('.vol-hint').hidden,
     'and picking it again clears everything back');

  // ⚠️ THE CAVEATS TRAVEL WITH THE NUMBERS. Every one of these is a thing the
  // count is doing that a reader would otherwise have to guess at.
  const pane = data.querySelector('.vol-pane').textContent;
  ok(/warm-ups included/.test(pane),
     '⚠️ it admits it counts every logged set, warm-ups included — the open question, said rather '
     + 'than silently resolved');
  ok(/not a measured fact/.test(pane),
     'the half-a-set rule is named as a modelling choice, in the words that ship beside the constant');
  ok(/no target line/.test(pane),
     '🚨 and it says outright that there is no target — the tiers describe what another set buys, '
     + 'and an app that painted 20 sets "good" would be forming an opinion the evidence has not earned');
  ok(/Core is counted honestly and is understated/.test(pane),
     'Core says why its own number is low for everyone');

  // The window is a control, and changing it redraws rather than dead-ends.
  [...data.querySelectorAll('.chip')].find((c) => c.textContent === '12 weeks').click();
  await settle(); await settle();
  ok([...data.querySelectorAll('.chip')].find((c) => c.textContent === '12 weeks')
       .getAttribute('aria-pressed') === 'true', 'the window is switchable');
  ok(data.querySelectorAll('.vol-row').length === 12, 'and the list redraws over the longer window');
}

/* ================= the sliding segment pill (2026-09-01) =================
 * Tim: *"When you click on something, I want it to have some sort of visible
 * motion between the movement rather than just an instant change."*
 *
 * ⚠️ WHAT A DOM WITH NO LAYOUT CAN AND CANNOT SAY. Every box here measures zero,
 * so nothing in this block asserts that the pill MOVED — that is checked in a
 * real browser (the motion probe: transform 2px → 223px, interpolating, with a
 * running transition on transform and width). What jsdom can prove is the part
 * that would silently rot: that the control gets wired at all, that it is wired
 * exactly once, and that it follows `aria-selected` rather than a click handler
 * — which is what lets four view files build these without knowing about it. */
{
  const bar = data.querySelector('.segmented');
  ok(Boolean(bar) && bar.classList.contains('has-ind'),
     'the mode switch is wired for a sliding pill');
  ok(data.querySelectorAll('.seg-ind').length === 1,
     'exactly one indicator — wiring the same control twice would stack them');
  const ind = bar.querySelector('.seg-ind');
  ok(ind.getAttribute('aria-hidden') === 'true',
     'and it is hidden from a screen reader — the segment already says which one is chosen');

  /* ⚠️ FOLLOWS THE ATTRIBUTE, NOT THE TAP. Five of these controls are built in
     four files and one rebuilds its own buttons; watching `aria-selected` is
     what makes them all work without any of them knowing. Proved by moving the
     attribute by hand, with nothing clicked. */
  for (const s of bar.querySelectorAll('.seg')) s.setAttribute('aria-selected', 'false');
  await settle();
  ok(ind.style.opacity === '0',
     '⚠️ nothing selected hides the pill rather than parking it on the first segment and lying');
  bar.querySelectorAll('.seg')[2].setAttribute('aria-selected', 'true');
  await settle();
  ok(ind.style.opacity === '1', 'and it comes back when something is selected again');
  bar.querySelectorAll('.seg')[2].setAttribute('aria-selected', 'false');
  bar.querySelectorAll('.seg')[0].setAttribute('aria-selected', 'true');
}

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

/* ================= the session's date ================= */
// A workout records for TODAY by default, and the day can be moved for the
// session you forgot to log.
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { todayISO } = await import(BASE + 'store.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const w = await store.saveWorkout({
    name: 'Push day',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' }],
  });

  localStorage.removeItem(DRAFT);
  const session = await mount(SessionView(w.id));

  const dateInput = session.querySelector('.session-date');
  ok(Boolean(dateInput), 'the session shows the day it will be recorded for');
  ok(dateInput && dateInput.value === todayISO(),
     `it defaults to today (${dateInput && dateInput.value})`);
  ok(dateInput && dateInput.getAttribute('max') === todayISO(),
     'it refuses future dates — you cannot log a workout you have not done');
  ok(dateInput && !dateInput.classList.contains('is-moved'),
     'today is not flagged as moved');

  const draft0 = JSON.parse(localStorage.getItem(DRAFT));
  ok(draft0 && draft0.date === todayISO() && draft0.startedOn === todayISO(),
     'the draft records both the day it is for and the day it was started');

  // Move it back a week.
  const past = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  dateInput.value = past;
  dateInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  await settle();

  const draft1 = JSON.parse(localStorage.getItem(DRAFT));
  ok(draft1 && draft1.date === past, `changing the date updates the draft (${draft1 && draft1.date})`);
  ok(draft1 && draft1.startedOn === todayISO(),
     'startedOn stays put — it is what decides whether the draft is still today\'s');
  ok(session.querySelector('.session-date').classList.contains('is-moved'),
     'a date that is not today is called out');

  // The trap: a back-dated session must still resume. Comparing the draft's
  // `date` to today — which is what the code used to do — would have thrown
  // this draft away the moment the user switched apps.
  const resumed = await mount(SessionView(w.id));
  ok(localStorage.getItem(DRAFT) !== null, 'a back-dated draft survives leaving the screen');
  ok(resumed.querySelector('.session-date').value === past,
     'and it resumes on the day it was set to, not today');

  // The whole point: finishing must SAVE it against the chosen day.
  const before = (await store.getSessions()).length;
  // The stepper commits on blur, not change — it lets you type freely first.
  const weight = resumed.querySelector('.step-value');
  weight.value = '135';
  weight.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  for (const b of resumed.querySelectorAll('button')) {
    if (/Next exercise/.test(b.textContent)) { b.click(); await settle(); }
  }
  const finishBtn = [...resumed.querySelectorAll('button')]
    .find((b) => /Finish workout/.test(b.textContent));
  ok(Boolean(finishBtn), 'the session offers a finish button');
  if (finishBtn) { finishBtn.click(); await settle(); await settle(); }

  const sessions = await store.getSessions();
  const saved = sessions.find((s) => s.workoutId === w.id);
  ok(sessions.length === before + 1, 'finishing writes one session');
  ok(saved && saved.date === past,
     `the session is filed under the chosen day, not today (${saved && saved.date})`);
  // ⚠️ `startedAt` is a UTC INSTANT; `todayISO()` is a LOCAL date. This used to
  // compare the two, which meant the suite failed every evening once UTC rolled
  // over into tomorrow and passed again the next morning — a test that is green
  // by time of day is worse than no test. The app itself is fine: the day logic
  // (draft expiry) runs off `startedOn`, which is local, and `startedAt` is
  // never compared to a local date anywhere.
  //
  // What the assertion actually means: the clock did NOT move with the date.
  // So check it against real time, and against the back-dated day it must not
  // have become.
  const startedMs = saved && saved.startedAt ? Date.parse(saved.startedAt) : NaN;
  ok(Number.isFinite(startedMs) && Math.abs(Date.now() - startedMs) < 5 * 60000,
     'startedAt records when it was actually entered — the date moved, not the clock');
  ok(saved && saved.startedAt.slice(0, 10) !== past,
     'and it did not get dragged back to the day the session was filed under');
  ok(localStorage.getItem(DRAFT) === null, 'the draft is cleared once saved');

  // A draft genuinely left over from a previous day is still discarded.
  localStorage.setItem(DRAFT, JSON.stringify({
    workoutId: w.id, workoutName: w.name, date: past, startedOn: '2020-01-01',
    startedAt: '2020-01-01T10:00:00Z', index: 0, entries: [],
  }));
  const fresh = await mount(SessionView(w.id));
  ok(fresh.querySelector('.session-date').value === todayISO(),
     'yesterday\'s abandoned draft is still dropped, and the new one is for today');

  /* ⚠️ A FAILED SAVE AT THE END OF A WORKOUT — the one failure in this app that
     can cost somebody their training.
     Until 2026-08-22 `finish()` awaited the save unguarded and the app has no
     `unhandledrejection` handler, so a full localStorage meant the promise
     rejected, `showFinished()` never ran, and the user tapped Finish and
     NOTHING HAPPENED. Reproduced here by making the store throw. */
  {
    const screen = await mount(SessionView(w.id));
    const wv = screen.querySelector('.step-value');
    wv.value = '145';
    wv.dispatchEvent(new window.Event('blur', { bubbles: false }));
    await settle();
    for (const b of screen.querySelectorAll('button')) {
      if (/Next exercise/.test(b.textContent)) { b.click(); await settle(); }
    }
    const fin = [...screen.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent));

    const real = store.saveSession;
    store.saveSession = async () => { throw new Error('Could not save. Your browser storage may be full.'); };
    const countBefore = (await store.getSessions()).length;
    fin.click(); await settle(); await settle();

    const err = screen.querySelector('.save-error');
    ok(err && !err.hidden, 'a save that fails SAYS SO on the screen rather than doing nothing');
    ok(/storage may be full/i.test(err.textContent),
       'and it passes on the reason the backend actually gave, not a generic apology');
    // ⚠️ THE LOAD-BEARING ONE. The draft is the only remaining copy of the
    // session, so clearing it before the save has landed would turn a
    // recoverable error into lost training.
    ok(localStorage.getItem(DRAFT) !== null,
       'and the draft is KEPT, because it is the only other copy of what was just done');
    ok(document.querySelector('.finish-hero') === null,
       'and it does not claim the workout was saved');

    // Recovery: the same tap works once the store does.
    store.saveSession = real;
    fin.click(); await settle(); await settle();
    ok((await store.getSessions()).length === countBefore + 1,
       'tapping Finish again after the problem clears saves it, with nothing lost');
  }

  /* ⚠️ CLICKING ANYWHERE ON A SET SELECTS IT — Tim, 2026-08-25.
   *
   * *"if the user is doing multiple sets, then clicking on the other sets is
   * often confusing because you have to click on the 1, 2, 3, etc on the side."*
   * The numbered square is 21x21 on a row the full width of the screen, and the
   * weight and reps — the part you are actually reading, and the part a thumb
   * goes to — were inert text.
   *
   * The behavioural assertion is the one that matters: a click on the VALUES
   * must select. Everything else here is structure that keeps it honest.
   */
  {
    localStorage.removeItem(DRAFT);
    const multi = await store.saveWorkout({
      name: 'Three sets',
      exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 3, notes: '' }],
    });
    const screen = await mount(SessionView(multi.id));
    const items = [...screen.querySelectorAll('.set-list .set-item')];
    ok(items.length === 3, `three sets are listed (${items.length})`);
    ok(items[0].classList.contains('active'), 'set 1 is the one open to begin with');

    // The whole row, minus delete, is ONE control carrying the row's own name.
    const pick = items[2].querySelector('.set-pick');
    ok(Boolean(pick) && pick.tagName === 'BUTTON',
       '⚠️ the row is a real BUTTON, not a div with a click handler — a div would satisfy the '
       + 'request and silently drop the set list out of the keyboard order');
    ok(Boolean(pick.querySelector('.set-num')) && Boolean(pick.querySelector('.set-vals')),
       'and it holds BOTH the number and the values, so neither is a dead zone');
    ok(/Set 3/.test(pick.getAttribute('aria-label') || ''),
       'named for the set it is, rather than the old number labelled "Edit set 3"');

    // ⚠️ THE ONE THAT FLIPS IF THIS IS EVER REVERTED: click the numbers, not the square.
    items[2].querySelector('.set-vals').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    const after = [...screen.querySelectorAll('.set-list .set-item')];
    ok(after[2].classList.contains('active') && !after[0].classList.contains('active'),
       '⚠️ clicking the WEIGHT AND REPS of set 3 opens set 3 — the numbered square is no longer '
       + 'the only live part of the row');

    // Delete is a sibling, not a child. Nested it would be invalid HTML and
    // would need a stopPropagation that works until the next control is added.
    const del = after[1].querySelector('.set-del');
    ok(Boolean(del) && del.parentElement.classList.contains('set-item'),
       'delete sits BESIDE the row button rather than inside it, so it can never also select');
    del.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(screen.querySelectorAll('.set-list .set-item').length === 2,
       'and tapping it still deletes rather than selecting');

    localStorage.removeItem(DRAFT);
  }

  /* ⚠️ THE CONTROLS LIVE INSIDE THE OPEN SET (2026-08-28).
   *
   * Tim: *"there should be no large current selected set details display, and
   * instead the list of sets should be large … when you select one, it makes it
   * larger and you can add or subtract the weight amount or number of reps."*
   *
   * Before this the screen showed the same numbers twice — a detached block of
   * steppers headed "SET 1 OF 4", and set 1 again in the list under it, both
   * live, both editing the same object. These assertions are about WHERE the
   * steppers are, because that is the whole of the change and nothing else in
   * the suite would notice them moving back.
   */
  {
    localStorage.removeItem(DRAFT);
    const acc = await store.saveWorkout({
      name: 'Accordion',
      exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 4, notes: '' }],
    });
    const screen = await mount(SessionView(acc.id));

    // ⚠️ THE ONE THAT FLIPS ON A REVERT. A detached block would be a `.steppers`
    // that is not inside the list.
    const all = [...screen.querySelectorAll('.steppers')];
    ok(all.length === 1, `exactly one set is open, so exactly one set of controls (${all.length})`);
    ok(Boolean(all[0].closest('.set-list')),
       '⚠️ the steppers are INSIDE the set list, not in a block of their own above it');

    const rows = () => [...screen.querySelectorAll('.set-list .set-item')];
    /* ⚠️ `.closest`, NOT `previousElementSibling` — CHANGED 2026-08-31 WITH THE
     * SHAPE IT MEASURES. The controls were a SIBLING of their row until Tim
     * asked for the row itself to morph into them; the row is now their parent.
     * The assertion is the same one either way: exactly one row carries the
     * controls, and it is the row that is open. */
    const openAt = () => rows().indexOf(screen.querySelector('.set-open').closest('.set-item'));
    ok(rows().length === 4, 'four sets are listed');
    ok(openAt() === 0, 'and the controls are INSIDE set 1, which is the one open');

    // Opening another set MOVES the controls to it rather than re-pointing a
    // block somewhere else on the screen.
    rows()[2].querySelector('.set-vals').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(openAt() === 2, '⚠️ opening set 3 moves the controls into SET 3 — one set of numbers per set');
    ok(screen.querySelectorAll('.steppers').length === 1, 'and there is still only one of them');
    ok(rows()[2].querySelector('.set-pick').getAttribute('aria-expanded') === 'true'
       && rows()[0].querySelector('.set-pick').getAttribute('aria-expanded') === 'false',
       'the row is a disclosure, and says so — a screen reader is told which set is open');

    /* ⚠️ A NUDGE MUST NOT REBUILD THE LIST, and this is the assertion that keeps
     * it that way. The old code re-rendered every row on every `onChange`, which
     * was free while the steppers sat outside the list — and would now tear down
     * the input somebody is typing into, blurring it after one digit. Holding
     * the row NODE across the change is what proves it was updated in place. */
    const before = rows()[2];
    const input = screen.querySelector('.step-value');
    input.value = '225';
    input.dispatchEvent(new window.Event('blur', { bubbles: false }));
    await settle();
    ok(rows()[2] === before,
       '⚠️ logging a number updates set 3 IN PLACE — the row is the same node, so the stepper '
       + 'that raised the change was never destroyed under the user\'s finger');
    ok(before.querySelector('.step-value').value === '225',
       'and the number is in the row that was typed into');

    /* ⚠️ THE MORPH, AND THE ONE ASSERTION THAT FAILS IF THE PANEL EVER GOES BACK
     * TO BEING A SIBLING (2026-08-31). Tim: *"I would rather make the set itself
     * change so that it morphs into the weight and reps adjustment box… this way
     * it doesn't have 2 places for the same thing."* The open row must not ALSO
     * print `225 lbs × 10` above the stepper that holds 225. */
    ok(!before.querySelector('.set-vals'),
       '🚨 the open row does NOT also print its values as text — the steppers are the only '
       + 'place those numbers appear, which is the whole of what was asked for');
    ok(rows().filter((r) => r.querySelector('.set-vals')).length === 3,
       'and every CLOSED row still reads as a line of numbers');

    // "…and then when you click off it it goes back to being normal."
    rows()[2].querySelector('.set-pick').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(!screen.querySelector('.set-open'),
       '⚠️ tapping the open row CLOSES it — the runner can now show no controls at all, which '
       + 'it never could before, and that is Tim\'s "click off it and it goes back to normal"');
    ok(/225/.test(rows()[2].textContent),
       'and the row it collapses back to is showing what was typed into it');

    // Reopening puts them back on the same set: closing is about the screen,
    // not about losing your place in the exercise.
    rows()[2].querySelector('.set-pick').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(openAt() === 2, 'and reopening lands on the same set, not back at set 1');

    /* ⚠️ A TAP ON A CONTROL IS NOT A TAP OFF THE SET. The click-off listener runs
     * on the pane, AFTER the button that was actually pressed — so without its
     * "any control is exempt" guard, Add set would open the new set and this
     * would close it again on the same event. Nothing but a screenshot would
     * have shown that. */
    [...screen.querySelectorAll('button')].find((b) => /Add set/.test(b.textContent))
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(rows().length === 5 && Boolean(screen.querySelector('.set-open')),
       '⚠️ adding a set leaves the new set OPEN — the click-off handler does not fire on a '
       + 'tap that landed on a control');

    // The heading that used to sit above the detached block is gone: the accent
    // square on the row above the controls already says which set they are for.
    ok(!/SET 3 OF 4/i.test(screen.textContent),
       'no "Set 3 of 4" caption — the row directly above the controls IS set 3');

    localStorage.removeItem(DRAFT);
  }

  /* ⚠️ THE DEMO ACCOUNT MAY NOT WRITE A DRAFT TO REAL STORAGE.
     `store.js` swaps its whole backend inside the demo, but the draft never
     went through the store — it was written straight to localStorage, so
     running a workout in the demo left invented sets on the real device and
     they survived leaving it. Every screen of the demo carries a strip saying
     "nothing is saved". Found by the UX review, 2026-08-22. */
  {
    const { demo } = await import(BASE + 'store.js');
    localStorage.removeItem(DRAFT);
    sessionStorage.setItem('ftrack:v1:demo', '1');
    ok(demo.active(), 'the demo flag is on for this check, so it is not passing vacuously');

    const screen = await mount(SessionView(w.id));
    const wv = screen.querySelector('.step-value');
    wv.value = '99';
    wv.dispatchEvent(new window.Event('blur', { bubbles: false }));
    await settle();

    ok(localStorage.getItem(DRAFT) === null,
       '⚠️ a workout run inside the demo writes NOTHING to real localStorage');
    ok(sessionStorage.getItem(DRAFT) !== null,
       'while the draft still exists, so an app switch inside the demo loses nothing either');

    sessionStorage.removeItem('ftrack:v1:demo');
    sessionStorage.removeItem(DRAFT);
    localStorage.removeItem(DRAFT);
  }
}

/* ========= a cancelled Google sign-in is never a dead end ========= */
// The regression this guards: treating auth/popup-closed-by-user as "do
// nothing" made the button look broken — no message, no way through. Firebase
// raises that code both when a person closes the window and when the SDK loses
// its handle on it, so it is not reliably a decision.
{
  const { AccountView } = await import(BASE + 'views-account.js');
  const { auth } = await import(BASE + 'store.js');

  const realState = auth.state.bind(auth);
  const realConfigured = auth.configured;
  const realGoogle = auth.signInGoogle.bind(auth);

  auth.configured = () => true;
  auth.state = async () => ({
    mode: 'cloud',
    user: { uid: 'anon1', isAnonymous: true, secured: false, email: null },
    degraded: false, error: null, offline: false, lastAccount: null,
  });

  const calls = [];
  auth.signInGoogle = async (opts) => { calls.push(opts || {}); return { status: 'cancelled' }; };

  const screen = await mount(AccountView());
  const gBtn = [...screen.querySelectorAll('button')]
    .find((b) => /Continue with Google/.test(b.textContent));
  ok(Boolean(gBtn), 'the anonymous screen offers Google sign-in');

  const escapeBtn = [...screen.querySelectorAll('button')]
    .find((b) => /Continue in this window/.test(b.textContent));
  ok(Boolean(escapeBtn), 'and carries a redirect fallback');
  ok(escapeBtn.hidden, 'which stays out of the way until it is needed');

  gBtn.click();
  await settle(); await settle();

  ok(calls.length === 1 && !calls[0].forceRedirect, 'tapping it tries the popup first');
  ok(!gBtn.disabled, 'and leaves the button usable rather than stuck on "Opening…"');

  /* ⚠️ WHAT A CANCELLED SIGN-IN OWES THE USER — rewritten 2026-08-21 after Tim
     reported from an iPhone that the popup opens, closes, and nothing happens.
     This block used to assert only that the redirect fallback appeared. That is
     the wrong contract on his phone: `signInWithRedirect` cannot finish when the
     authDomain is a different origin from the app, which is this project, so
     revealing it was offering a route guaranteed to fail.

     The contract now is the one that is actually true everywhere: SOMETHING
     VISIBLE AND PERMANENT is said, and what it offers is a route that works. */
  const statusText = () => [...screen.querySelectorAll('.field-help')]
    .filter((n) => !n.hidden).map((n) => n.textContent).join(' ');
  ok(/closed before finishing/i.test(statusText()),
     'a cancelled sign-in SAYS so, on the screen rather than in a 2.4-second toast');

  const { redirectCanComplete } = await import(BASE + 'firebase-backend.js');
  const { FIREBASE_CONFIG } = await import(BASE + 'firebase-config.js');
  if (redirectCanComplete(FIREBASE_CONFIG)) {
    ok(!escapeBtn.hidden, 'where a redirect can finish, it is offered');
    escapeBtn.click();
    await settle(); await settle();
    ok(calls.length === 2 && calls[1].forceRedirect === true,
       'and it forces the redirect route, which no popup blocker can stop');
  } else {
    ok(escapeBtn.hidden,
       'where a redirect CANNOT finish, it is not offered — the bug was offering it anyway');
    ok(/email and password/i.test(statusText()),
       'and the route that does work on that device is named instead');
  }

  /* ⚠️ THE ONE THAT PRODUCED "NOTHING HAPPENS" — a promise that never settles.
     On iOS Safari the popup's handler page can lose the storage it needs, the
     window closes, and the SDK is left holding a promise nobody will resolve.
     No throw means no catch: `run()` awaited for ever and the button sat on
     "Opening…" with no toast, no fallback and no explanation. Literally nothing.

     ⚠️ The fix races the UI, NEVER the sign-in — a real sign-in behind
     two-factor can take minutes, and aborting one because a timer expired would
     be a worse bug than this one. So the assertion is that the BUTTON comes
     back and the screen speaks, while the auth promise is still outstanding. */
  {
    let settledTheAuth = false;
    // A promise that never resolves on its own — the iOS case exactly.
    auth.signInGoogle = () => new Promise(() => { settledTheAuth = false; });

    // Fire the patience timer immediately instead of waiting 40 seconds. Only
    // the long one: short timers belong to the app and must keep their timing.
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...rest) =>
      (ms >= 30000 ? realSetTimeout(fn, 0) : realSetTimeout(fn, ms, ...rest));

    const hung = await mount(AccountView());
    const hungBtn = [...hung.querySelectorAll('button')]
      .find((b) => /Continue with Google/.test(b.textContent));

    hungBtn.click();
    await settle(); await settle(); await settle();

    globalThis.setTimeout = realSetTimeout;

    ok(!hungBtn.disabled,
       'a popup promise that NEVER settles still hands the button back — the literal "nothing happens"');
    ok(/closed without finishing/i.test(
         [...hung.querySelectorAll('.field-help')].filter((n) => !n.hidden)
           .map((n) => n.textContent).join(' ')),
       'and says so on the screen instead of waiting for ever');
    ok(settledTheAuth === false,
       '⚠️ and the sign-in itself was never cancelled — the UI is raced, not the auth, '
       + 'because a real sign-in behind two-factor takes minutes');
  }

  auth.signInGoogle = realGoogle;
  auth.state = realState;
  auth.configured = realConfigured;
}

/* ========= the offline account screen ========= */
// Reported by Tim: after a while away, the account screen said his account
// "could not be reached" and printed a raw gstatic import URL. He concluded the
// app was broken; his wi-fi was off. The behaviour was right and the message
// was not, so these assert the MESSAGE.
{
  const { AccountView } = await import(BASE + 'views-account.js');
  const { auth } = await import(BASE + 'store.js');

  const realState = auth.state.bind(auth);
  const realConfigured = auth.configured;
  auth.configured = () => true;

  // Genuinely offline.
  auth.state = async () => ({
    mode: 'local', user: null, degraded: true, offline: true,
    error: 'Failed to fetch dynamically imported module: '
      + 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
    lastAccount: { email: 'tim@example.com' },
  });
  const off = await mount(AccountView());
  const offText = off.textContent;
  // What the user actually reads, i.e. everything outside the collapsed
  // <details>. The raw string is allowed to exist in there; it is not allowed
  // to be the message.
  const visible = (root) => {
    const copy = root.cloneNode(true);
    copy.querySelectorAll('.tech-detail').forEach((d) => d.remove());
    return copy.textContent;
  };

  ok(/offline/i.test(offText), 'an offline account screen says you are offline');
  ok(!/gstatic|dynamically imported/i.test(visible(off)),
     'and never leads with a raw module-import error');
  ok(/gstatic/.test(off.querySelector('.tech-detail').textContent),
     'though the raw string stays available behind the disclosure');
  ok(/still signed in/i.test(offText) && /tim@example\.com/.test(offText),
     'it says you are still signed in, rather than looking logged out');
  ok(!/could not be reached/i.test(offText),
     'it does not blame the account for a connection problem');
  ok(/backup/i.test(offText), 'and points at a backup, which works offline');

  // Online, but the backend really is unreachable — the raw detail is worth
  // keeping THEN, just not as the headline. The connectivity probe has to be
  // told the network is fine, or jsdom (which can reach nothing) correctly
  // rewrites this to "offline" and the case under test never happens.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  auth.state = async () => ({
    mode: 'local', user: null, degraded: true, offline: false,
    error: 'FirebaseError: permission-denied', lastAccount: null,
  });
  const broken = await mount(AccountView());
  await settle(); await settle();
  ok(/can.t connect/i.test(broken.textContent),
     'a real failure while online reads differently from being offline');
  const detail = broken.querySelector('.tech-detail');
  ok(Boolean(detail) && /permission-denied/.test(detail.textContent),
     'and the technical string is kept, behind a disclosure');
  ok(!detail.hasAttribute('open'), 'which is closed by default');

  globalThis.fetch = realFetch;
  auth.state = realState;
  auth.configured = realConfigured;
}

/* ========= editing a workout already recorded ========= */
{
  const { EditSessionView } = await import(BASE + 'views-edit-session.js');
  const { DayView } = await import(BASE + 'views-data.js');
  await store.clearAll();

  const benchId = byName('Barbell Bench Press').id;
  const rec = await store.saveSession({
    workoutId: 'w9', workoutName: 'Test day', date: '2026-08-12', isBenchmark: true,
    entries: [{ exerciseId: benchId, exerciseName: 'Barbell Bench Press',
                sets: [{ weight: 185, reps: 5 }, { weight: 225, reps: 2 }] }],
  });

  // The calendar day offers the way in.
  const day = await mount(DayView('2026-08-12'));
  const editBtn = [...day.querySelectorAll('button')]
    .find((b) => /Edit this workout record/.test(b.getAttribute('aria-label') || ''));
  ok(Boolean(editBtn), 'a recorded workout can be edited from its day');
  ok(/benchmark/i.test(day.textContent), 'and a benchmark workout is badged as one');
  // Its derived benchmarks are not listed again underneath.
  ok((day.textContent.match(/Barbell Bench Press/g) || []).length === 1,
     'a derived benchmark is not listed a second time under the day');

  const ed = await mount(EditSessionView(rec.id));
  ok(ed.querySelector('input[type="date"]').value === '2026-08-12',
     'the editor opens on the day it is filed under');
  ok(ed.querySelectorAll('.edit-set').length === 2, 'every set is editable');

  // Change a weight, move the day, and save.
  const firstWeight = ed.querySelector('.edit-set .step-value');
  firstWeight.value = '195';
  firstWeight.dispatchEvent(new window.Event('blur', { bubbles: false }));
  const d = ed.querySelector('input[type="date"]');
  d.value = '2026-08-09';
  d.dispatchEvent(new window.Event('change', { bubbles: true }));
  const nameField = ed.querySelector('input[type="text"]');
  nameField.value = 'Max out';
  nameField.dispatchEvent(new window.Event('input', { bubbles: true }));

  [...ed.querySelectorAll('button')].find((b) => /Save changes/.test(b.textContent)).click();
  await settle(); await settle();

  const saved = (await store.getSessions()).find((x) => x.id === rec.id);
  ok(saved.date === '2026-08-09', `the record moves day (${saved.date})`);
  ok(saved.workoutName === 'Max out', 'the name can be changed');
  ok(saved.entries[0].sets[0].weight === 195, 'and a set can be corrected');
  ok((await store.getSessions()).length === 1, 'editing does not create a second record');

  const marks = await store.getBenchmarks();
  ok(marks.length === 1 && marks[0].date === '2026-08-09',
     'its benchmark moved with it rather than being left behind');

  // Emptying every set must not silently save a record of zeros.
  const ed2 = await mount(EditSessionView(rec.id));
  for (const inp of ed2.querySelectorAll('.edit-set .step-value')) {
    inp.value = '0';
    inp.dispatchEvent(new window.Event('blur', { bubbles: false }));
  }
  [...ed2.querySelectorAll('button')].find((b) => /Save changes/.test(b.textContent)).click();
  await settle();
  const still = (await store.getSessions()).find((x) => x.id === rec.id);
  ok(still.entries[0].sets.length === 2 && still.entries[0].sets[0].weight === 195,
     'a record emptied to zeros is refused, and the real one is untouched');

  await store.clearAll();
}

/* ========= replaceChildren must not print the word "null" ========= */
// Element.replaceChildren() stringifies anything that is not a Node, so a
// `cond ? el(...) : null` child rendered the literal text "null" on the page.
// It was doing exactly that under the exercise name for any exercise with no
// note. el() always guarded against it; the direct replaceChildren calls did not.
{
  const { SessionView } = await import(BASE + 'views-session.js');
  localStorage.removeItem('ftrack:v1:draftSession');
  const nw = await store.saveWorkout({
    name: 'No notes',
    // notes deliberately empty — that is what used to render "null"
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
  });
  const screen = await mount(SessionView(nw.id));
  ok(!/\bnull\b/.test(screen.textContent),
     'an exercise with no note does not render the word "null"');
  ok(!/\bundefined\b/.test(screen.textContent), 'nor "undefined"');

  // The whole app, not just this screen.
  for (const [name, view] of [
    ['Home', HomeView()], ['Workouts', WorkoutsView()],
    ['Calendar', CalendarView()], ['Settings', SettingsView()],
  ]) {
    const node = await mount(view);
    ok(!/\bnull\b/.test(node.textContent), `${name} renders no stray "null"`);
  }
  localStorage.removeItem('ftrack:v1:draftSession');
}

/* ========== the calendar's YEARS view (Tim, 2026-08-22) ========== */
{
  // A session last year and one today, so two year rows exist and the counts
  // are not both zero.
  const w = await store.saveWorkout({ name: 'Grid test', exercises: [] });
  const todayIso = new Date().toLocaleDateString('en-CA');
  const lastYear = `${Number(todayIso.slice(0, 4)) - 1}-06-15`;
  for (const date of [todayIso, lastYear]) {
    await store.saveSession({ workoutId: w.id, workoutName: 'Grid test', date, entries: [] });
  }

  const screen = await mount(CalendarView());
  // ⚠️ Scoped to the SUBORDINATE control. Since the six-tab nav became five
  // (2026-08-22) the calendar's header carries the four-way Data switch, so an
  // unscoped `.seg` query now sweeps up six segments from two different
  // controls — and would have gone on "passing" while asserting nothing about
  // either of them.
  const segs = () => [...screen.querySelectorAll('.segmented.sub .seg')];
  ok(segs().map((b) => b.textContent).join() === 'Months,Years',
     'the calendar offers Months and Years');

  // ⚠️ THE UNMERGE: the calendar is its own tab again (2026-08-25), so its
  // header is its own title and NOT the Data switch. Borrowing that control
  // would light a segment for a screen no longer inside it.
  const dataSegs = [...screen.querySelectorAll('.topbar .seg')].map((b) => b.textContent);
  ok(!dataSegs.includes('Graph') && !dataSegs.includes('Bars'),
     `the calendar no longer wears the Data switch (${dataSegs.join() || 'none'})`);
  ok(/Calendar/.test(screen.querySelector('.topbar').textContent),
     'and says its own name instead');
  // The only segments left in this header are the calendar's OWN Months/Years,
  // which live in `.segmented.sub` — the topbar itself carries none.
  ok(dataSegs.length === 0,
     'and carries no cross-screen segments at all, so nothing here can light up for another tab');
  ok(screen.querySelectorAll('.cal-month').length > 0 && !screen.querySelector('.yr-grid'),
     'and opens on Months, which is what it has always been');

  segs().find((b) => b.textContent === 'Years').click();
  await settle();

  ok(screen.querySelectorAll('.yr-grid').length >= 2,
     'switching to Years draws a grid for this year and last');
  ok(!screen.querySelector('.cal-month'), 'and the month blocks are gone rather than stacked underneath');

  /* ⚠️ THE REGRESSION THIS EXISTS FOR. The first version of the switch rebuilt
     the whole screen and swapped the new node in — which silently discarded the
     demo account's "nothing is saved" strip, because app.js PREPENDS that into
     the node the view returned. Switching to Years inside the demo removed the
     one line on the page saying the data is invented.

     ⚠️ ASSERTED AGAINST THE DOCUMENT, NOT AGAINST `screen`. Under the bug the
     test's own reference goes stale: the original node is detached and keeps
     both the strip and its old contents, so a `screen.querySelector` would
     still find the strip and pass over the exact fault it was written for.
     What matters is whether the strip is still ON SCREEN beside a rendered
     grid — so that is what is asked. */
  const stowaway = document.createElement('div');
  stowaway.className = 'demo-bar';
  screen.prepend(stowaway);
  segs().find((b) => b.textContent === 'Months').click();
  await settle();
  segs().find((b) => b.textContent === 'Years').click();
  await settle();
  ok(document.querySelector('.demo-bar') === stowaway && !!document.querySelector('.yr-grid'),
     'and switching mode repaints IN PLACE, so anything the router prepended is still on screen');

  // Re-queried after the round trip: the panes were repainted, so anything held
  // from before it is detached and would answer questions about a dead screen.
  const grids = [...document.querySelectorAll('.yr-grid')];

  // The squares are days, and the label counts what is drawn.
  const cells = grids[0].querySelectorAll('.yr-cell');
  const y = Number(todayIso.slice(0, 4));
  const days = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
  ok(cells.length === days, `this year draws one square per day (${cells.length})`);
  ok(grids[0].querySelectorAll('.yr-cell.on').length === 1, 'exactly one of them is coloured in');
  ok(/1 day trained/.test(screen.textContent), 'and the count beside the year says DAYS, matching the squares');

  // The legend belongs to Months — a Years grid paints one colour on purpose,
  // so a Workout/Benchmark key over it would describe a distinction it is not
  // making. `hidden` alone does not do this: display:flex outranks it.
  const legend = screen.querySelector('.legend');
  ok(legend && legend.hasAttribute('hidden'), 'the workout/benchmark legend is dropped in Years');

  // Tap selects; it does not navigate. At ~6px a tap that navigated would be a
  // gamble, so the readout is the thing that opens the day.
  const readout = screen.querySelector('.yr-readout');
  ok(readout && readout.disabled, 'the readout starts inert, and holds its row rather than appearing');
  const hash = globalThis.location ? globalThis.location.hash : '';
  grids[0].querySelector('.yr-cell.on').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settle();
  ok(!readout.disabled && /Grid test/.test(readout.textContent),
     'tapping a square names what was done that day');
  ok((globalThis.location ? globalThis.location.hash : '') === hash,
     'and does NOT navigate — a 6px target may not be a one-tap trip to another screen');
  ok(grids[0].querySelectorAll('.yr-cell.sel').length === 1, 'exactly one square reads as selected');
}

/* ================= the rest timer ================= */
// ⚠️ OFF BY DEFAULT SINCE 2026-08-28 — Tim: "I don't love the rest timer
// personally… it's easy for me to feel it out myself." Off is the absence of
// the bar, not a disabled bar; On restores exactly what shipped. The block
// below therefore proves the DEFAULT first, then turns it on and proves the
// old behaviour unchanged.
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  localStorage.removeItem(DRAFT);

  const rw = await store.saveWorkout({
    name: 'Rest test',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' }],
  });

  /* ---- the default: no bar, and logging a set starts nothing ---- */
  const off = await mount(SessionView(rw.id));
  ok(!off.querySelector('.rest-bar'),
     '⚠️ by default there is NO rest bar on the workout screen — absent, not greyed');
  const offWt = off.querySelector('.step-value');
  offWt.value = '135';
  offWt.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  const offDraft = JSON.parse(localStorage.getItem(DRAFT));
  ok(offDraft.restStartedAt === undefined,
     'and logging a set writes no rest timestamp into the draft — off means off');
  localStorage.removeItem(DRAFT);

  /* ---- turned on: everything that shipped, unchanged ---- */
  await store.saveSettings({ restTimer: true });
  const s = await mount(SessionView(rw.id));

  const bar = s.querySelector('.rest-bar');
  ok(Boolean(bar), 'with the setting on, the session has a rest timer');
  ok(s.querySelector('.rest-clock').textContent === '--:--',
     'it shows nothing until a set is actually logged');

  const wt = s.querySelector('.step-value');
  wt.value = '135';
  wt.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();

  const draft = JSON.parse(localStorage.getItem(DRAFT));
  ok(typeof draft.restStartedAt === 'number',
     'logging a set starts the rest clock, and it goes in the draft');
  ok(/^00:0\d$/.test(s.querySelector('.rest-clock').textContent),
     `the clock starts from zero (${s.querySelector('.rest-clock').textContent})`);

  // Elapsed time is read from the timestamp, not accumulated by the interval —
  // a backgrounded tab throttles timers, which is exactly when a rest timer
  // matters. Rewinding the stored start proves the clock is derived from it.
  draft.restStartedAt = Date.now() - 95000;
  localStorage.setItem(DRAFT, JSON.stringify(draft));
  const resumedRest = await mount(SessionView(rw.id));
  ok(resumedRest.querySelector('.rest-clock').textContent === '01:35',
     `a resumed session picks the clock back up from the timestamp `
     + `(${resumedRest.querySelector('.rest-clock').textContent})`);

  // The target is opt-in; with none set, the bar never claims rest is "done".
  const chip = resumedRest.querySelector('.rest-target');
  ok(chip.textContent === 'no target', 'no rest target by default — no unearned opinion');
  ok(!resumedRest.querySelector('.rest-bar').classList.contains('is-done'),
     'and with no target it never says the rest is over');

  chip.click(); await settle();
  ok(chip.textContent === '60s', 'tapping cycles a target on');
  ok(resumedRest.querySelector('.rest-bar').classList.contains('is-done'),
     '95s past a 60s target reads as done');
  ok((await store.getSettings()).restTarget === 60, 'the target is remembered');

  localStorage.removeItem(DRAFT);
  await store.saveSettings({ restTarget: 0, restTimer: false });
}

/* ================= the stepper in kilograms ================= */
// The stepper SHOWS the user's unit and HANDS BACK pounds. Getting this
// backwards would quietly store kilogram numbers as pounds and corrupt every
// weight recorded after the switch.
{
  const { stepper } = await import(BASE + 'ui.js');
  const u = await import(BASE + 'units.js');

  u.setUnits('lbs');
  let got = null;
  const lb = stepper({ field: 'weight', value: 135, onChange: (v) => { got = v; } });
  ok(lb.node.querySelector('.step-value').value === '135', 'pounds show as stored');
  lb.node.querySelectorAll('.step-btn')[1].dispatchEvent(new window.Event('pointerdown'));
  ok(got === 140, `a nudge in pounds is +5 (${got})`);

  u.setUnits('kg');
  got = null;
  const kg = stepper({ field: 'weight', value: 220.46, onChange: (v) => { got = v; } });
  ok(kg.node.querySelector('.step-value').value === '100',
     `220.46 lb is shown as 100 kg (${kg.node.querySelector('.step-value').value})`);
  ok(/2\.5 kg steps/.test(kg.node.textContent), 'and the hint says 2.5 kg steps');

  kg.node.querySelectorAll('.step-btn')[1].dispatchEvent(new window.Event('pointerdown'));
  ok(kg.node.querySelector('.step-value').value === '102.5', 'a nudge moves it to 102.5 kg');
  ok(got !== null && Math.abs(got - 226.0) < 0.5,
     `but what comes back is POUNDS, not kilograms (${got && got.toFixed(2)})`);
  ok(Math.abs(kg.get() - got) < 1e-9, 'get() agrees with what onChange reported');

  // Typing a round kg figure must store the right pounds.
  const typed = kg.node.querySelector('.step-value');
  typed.value = '60';
  typed.dispatchEvent(new window.Event('blur', { bubbles: false }));
  ok(Math.abs(got - 132.277) < 0.01, `typing 60 kg stores 132.28 lb (${got && got.toFixed(3)})`);

  u.setUnits('lbs');
}

/* ================= workout systems ================= */
{
  // Workouts saved before systems existed, written past the store exactly as an
  // older build left them.
  localStorage.setItem('ftrack:v1:workouts', JSON.stringify([
    { id: 'sw1', name: 'Push', exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 3 }] },
    { id: 'sw2', name: 'Legs', exercises: [{ exerciseId: byName('Back Squat').id, sets: 3 }] },
  ]));

  const list = await mount(WorkoutsView());
  ok(/My Workouts/.test(list.textContent),
     'the Workouts tab lists systems, and old workouts are adopted into one');
  // The subtitle naming the workouts is the point — "2 workouts" says nothing
  // you could not guess.
  ok(/Push/.test(list.textContent) && /Legs/.test(list.textContent),
     'and names the workouts inside it rather than just counting them');
  ok(!/No workouts yet/.test(list.textContent),
     'the migrated system does not claim to be empty — the bug the race caused');

  const sys = (await store.getSystems())[0];
  const detail = await mount(SystemRouteView(sys.id));
  ok(/Push/.test(detail.textContent) && /Legs/.test(detail.textContent),
     'opening a system shows its workouts');
  ok(/New workout/.test(detail.textContent), 'and offers to add another');
  ok(!/no longer exists/.test(detail.textContent),
     'a system opened straight after migration is found, not "Not found"');

  ok(/New system/.test((await mount(WorkoutsView())).textContent),
     'a system can be created from the list');
  const blank = await mount(SystemRouteView('new'));
  ok(/Create system/.test(blank.textContent), 'the new-system screen offers to create one');

  /* ── Reading and editing are two screens, 2026-08-21 ──────────────────────
     ⚠️ These are POSITION tests as much as presence tests, and the bug they
     exist for was invisible to every assertion above: `#/system/<id>` used to
     BE the editor, so the workouts were present and correct and 468px below the
     fold on a phone, behind a name field, a notes box and a Save/Delete pinned
     to the bottom of the screen. "Is it on the screen" passed the whole time.
     Tim chose the split on 2026-08-21; what follows is what must stay true. */
  const detailText = detail.textContent.replace(/\s+/g, ' ');
  ok(!/System name|Save changes|Delete system/.test(detailText),
     'opening a system is READING it — no name field, no Save, no Delete');
  ok(Boolean([...detail.querySelectorAll('button')]
       .find((n) => /edit this system/i.test(n.getAttribute('aria-label') || ''))),
     'and the way to edit it is a pencil in the header');
  // The workouts come FIRST. A phone has one screenful and this is what it is for.
  const firstLabel = detail.querySelector('.pane-scroll .section-label');
  ok(firstLabel && /workout/i.test(firstLabel.textContent),
     'the workouts are the first thing in the pane, above the rating and the notes');

  const editor = await mount(SystemRouteView(sys.id + '/edit'));
  const editorText = editor.textContent.replace(/\s+/g, ' ');
  ok(/System name/.test(editorText) && /Save changes/.test(editorText),
     'the pencil route is the form');
  ok(/Delete system/.test(editorText), 'which is where Delete lives now');
  ok(!editor.querySelector('.pane-bottom .btn.danger'),
     'and Delete is NOT pinned to the bottom of the screen, under the thumb');

  /* ── The same split on a workout, and the thing it fixes ─────────────── */
  const pushId = (await store.getWorkouts(sys.id))[0].id;
  const wDetail = await mount(WorkoutRouteView(pushId));
  const wText = wDetail.textContent.replace(/\s+/g, ' ');
  ok(/Start workout/.test(wText),
     'a workout you open can be STARTED — the path Workouts → my programme → today had no way to begin one');
  ok(!/Add exercise|Delete workout|Workout name/.test(wText),
     'and opening it is not the builder');
  // ⚠️ blocksOf() hands back { item, index } wrappers rather than exercises, and
  // the first version of this screen mapped the wrapper straight into a row —
  // six lines of "Unknown exercise · undefined sets". Every assertion above
  // passed over it, because none of them read what the rows actually SAY. A
  // screenshot caught it. This is that screenshot, as a test.
  const pushWorkout = (await store.getWorkouts(sys.id))[0];
  const firstExName = (await store.getExerciseMap()).get(pushWorkout.exercises[0].exerciseId).name;
  ok(wText.includes(firstExName), 'and it names its exercises');
  ok(!/Unknown exercise|undefined/.test(wText),
     'reading them through blocksOf’s wrapper, not past it');
  ok(/\d+ sets?/.test(wText), 'with the planned set count on each');
  const startBtn = [...wDetail.querySelectorAll('.pane-bottom button')]
    .find((n) => /Start workout/.test(n.textContent));
  ok(Boolean(startBtn) && startBtn.classList.contains('primary'),
     'Start is the pinned primary action, not one option among several');

  const wEditor = await mount(WorkoutRouteView(pushId + '/edit'));
  ok(/Add exercise/.test(wEditor.textContent), 'and /edit is still the builder');
  ok(!wEditor.querySelector('.pane-bottom .btn.danger'),
     'with Delete out of the pinned footer there too');

  // Starting a workout must still reach every workout, whatever system it is in.
  const start = await mount(StartPickerView());
  ok(/Push/.test(start.textContent) && /Legs/.test(start.textContent),
     'the start picker still reaches every workout');

  /* ── ⚠️ RECORD MUST SAY THAT IT STARTS THINGS ─────────────────────────────
   *
   * Tim, after his second gym session (2026-08-25): *"it's not clear that by
   * clicking on any of the workouts that you'll actually start a workout, it's
   * easy to assume that you'd just look into details about it."* A chevron
   * means "go and look at that" on every other row in the app, and this row
   * begins a session.
   */
  const startRows = [...start.querySelectorAll('.list .row')];
  ok(startRows.length > 0, `Record lists ${startRows.length} workouts to start`);
  ok(startRows.every((r) => /Start/.test(r.textContent)),
     '⚠️ every workout row SAYS Start — the word, not a glyph a reader has to interpret');
  ok(startRows.every((r) => !r.querySelector('.row-chev')),
     '⚠️ and none of them wears a chevron, which everywhere else in this app means "go and look"');

  /* ── ⚠️ AND IT MUST NAME THE PROGRAMME, EVEN WITH ONLY ONE ────────────────
   *
   * *"make the title of the workout system more clear because that's the first
   * thing that the user will try to find."* The 2026-08-22 build dropped the
   * heading whenever there was a single system, on the argument that a sole
   * heading is decoration. It is not: it is the label on the thing being
   * looked for, and its absence is worse than its being small.
   */
  const heads = [...start.querySelectorAll('.sys-head')].map((n) => n.textContent);
  const allSystems = await store.getSystems();
  const withWorkouts = [];
  for (const s of allSystems) if ((await store.getWorkouts(s.id)).length) withWorkouts.push(s.name);
  ok(heads.length === withWorkouts.length && withWorkouts.every((n) => heads.includes(n)),
     `⚠️ every system with workouts is named on Record (${heads.length} of ${withWorkouts.length})`);
  ok(!start.querySelector('.section-label.sub'),
     'and the name is a heading rather than the 11.5px grey caption it used to be — it was quieter '
     + 'than the workout names underneath it, so the thing being searched for was the least visible text');
}


/* ================= ready-made systems ================= */
{
  const { ExploreView, ExploreDetailView } = await import(BASE + 'views-workouts.js');
  const { PRESET_SYSTEMS } = await import(BASE + 'preset-systems.js');

  const browse = await mount(ExploreView());
  ok(PRESET_SYSTEMS.every((p) => browse.textContent.includes(p.name)),
     'every ready-made system is listed');

  const first = PRESET_SYSTEMS[0];
  const detail = await mount(ExploreDetailView(first.id));
  ok(detail.textContent.includes(first.workouts[0].name),
     'opening one shows its workouts before you commit to it');
  ok(detail.textContent.includes(first.workouts[0].exercises[0].name),
     'and the exercises inside them');
  // Attribution is not optional. A system from somewhere else must never look
  // like one the app wrote.
  ok(detail.textContent.includes(first.author), 'and says who wrote it');
  ok(/Add to my systems/.test(detail.textContent), 'and offers to add it');
  // The set total must not be presented as a weekly figure: these workouts
  // repeat, so the total across them is not what you do in a week.
  ok(!/sets a week/i.test(detail.textContent),
     'the set count is not mislabelled as a weekly total');

  // Every unofficial system gets a warning ON SCREEN, and each says its own
  // true thing. The default text claims a video transcription, so a system
  // that is not one must not be able to fall through to it — the whole point
  // of the flag is that the reader knows what they are looking at.
  for (const p of PRESET_SYSTEMS.filter((x) => x.unofficial)) {
    const d = await mount(ExploreDetailView(p.id));
    ok(/Not official|NOT/.test(d.textContent), `"${p.name}" warns that it is not official`);
    if (p.warning) {
      ok(d.textContent.includes(p.warning.slice(0, 40)),
         `"${p.name}" shows its own warning, not the video-transcription default`);
      ok(!/free videos/.test(d.textContent),
         `"${p.name}" does not also show the default warning`);
    }
    // A method system credits the person WITHOUT bylining them.
    if (p.basedOn) {
      ok(d.textContent.includes('Follows ') && d.textContent.includes(p.basedOn.person),
         `"${p.name}" credits ${p.basedOn.person} as the method, not the author`);
      ok(!new RegExp('By\\s*' + p.basedOn.person).test(d.textContent),
         `"${p.name}" never renders "By ${p.basedOn.person}"`);
    }
  }

  const missing = await mount(ExploreDetailView('no-such-preset'));
  ok(/no longer exists/.test(missing.textContent),
     'an unknown system id gives a real screen, not a crash');
}


/* ================= set types in the BUILDER ================= */
// These controls all write into `draft.exercises`, and the list is rendered
// from blocksOf(), which returns COPIES. Every one of them silently did
// nothing until a real click in a browser showed it — so each is asserted by
// reading the saved workout back, not by reading the screen.
{
  const { WorkoutBuilderView } = await import(BASE + 'views-workouts.js');
  const sys = await store.saveSystem({ name: 'Builder tests' });
  const w = await store.saveWorkout({
    name: 'Arms', systemId: sys.id,
    exercises: [
      { exerciseId: byName('Triceps Pushdown').id, sets: 3, notes: '' },
      { exerciseId: byName('Overhead Cable Extension').id, sets: 3, notes: '' },
      { exerciseId: byName('Leg Extension').id, sets: 3, notes: '' },
    ],
  });

  const b = await mount(WorkoutBuilderView(w.id));
  const find = (re) => [...b.querySelectorAll('button')].find((n) => re.test(n.textContent));

  ok(!/Superset/.test(b.querySelector('.section-label').textContent), 'nothing is grouped to begin with');
  find(/Superset with next/).click();
  await settle();
  ok(/SUPERSET|Superset/.test(b.textContent), 'linking brackets the two exercises');
  ok(/No rest — tap to separate/.test(b.textContent), 'and the control now offers to undo it');

  // The set-type chip opens a sheet — at three types plus a count, cycling
  // would have taken up to seven taps to get back where you started.
  find(/Straight sets/).click();
  await settle();
  const sheet = document.querySelector('.sheet');
  ok(Boolean(sheet), 'the set-type chip opens a sheet');
  const sheetRow = (re) => [...sheet.querySelectorAll('button')].find((n) => re.test(n.textContent));
  ok(Boolean(sheetRow(/Myo-reps/)) && Boolean(sheetRow(/Drop set/)) && Boolean(sheetRow(/Straight sets/)),
     'showing all three types at once');
  // D8: teach at the moment of use. "Myo-reps" is jargon and the sheet has to
  // say what one IS, not just name it.
  ok(/rest 10–15 seconds/i.test(sheet.textContent),
     'and explaining what a myo-rep is rather than assuming you know');
  ok(/strip the weight/i.test(sheet.textContent), 'and what a drop set is');

  sheetRow(/Myo-reps/).click();
  await settle();
  ok(/Myo-reps · 3 mini-sets/.test(b.textContent),
     'picking myo-reps defaults to three mini-sets — the usual 3–5');
  ok(/Mini-sets/.test(document.querySelector('.sheet').textContent),
     'and the count stepper appears under the type it counts');

  document.querySelector('.sheet').querySelectorAll('button')
    .forEach(() => {});
  sheetRow(/Drop set/).click();
  await settle();
  ok(/Drop set/.test(b.textContent) && !/Myo-reps/.test(b.textContent),
     'switching to a drop set replaces it rather than stacking');
  document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());

  find(/Save changes/).click();
  await settle(); await settle();

  const saved = await store.getWorkout(w.id);
  ok(saved.exercises[0].group != null && saved.exercises[0].group === saved.exercises[1].group,
     'the superset is actually SAVED, not just drawn');
  ok(saved.exercises[2].group === undefined, 'and the third exercise is left out of it');
  ok(saved.exercises[0].setType === 'drop' && saved.exercises[0].minis === 1,
     `the set type is saved with its count (${JSON.stringify(saved.exercises[0])})`);
}


/* ================= set types in the session runner ================= */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  // The rest timer is off by default (2026-08-28). These blocks assert the
  // superset/drop-set HOLDOFF rules — when the timer must NOT fire — which is
  // only observable with the timer on.
  await store.saveSettings({ restTimer: true });

  const type = (node, value) => {
    node.value = String(value);
    node.dispatchEvent(new window.Event('blur', { bubbles: false }));
  };
  const btn = (root, re) => [...root.querySelectorAll('button')].find((b) => re.test(b.textContent));

  /* ---- a superset ---- */
  {
    const w = await store.saveWorkout({
      name: 'Superset day',
      exercises: [
        { exerciseId: byName('Triceps Pushdown').id, sets: 2, notes: '', group: 0 },
        { exerciseId: byName('Overhead Cable Extension').id, sets: 2, notes: '', group: 0 },
        { exerciseId: byName('Lateral Raise').id, sets: 2, notes: '' },
      ],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    ok(/Superset/.test(s.textContent), 'the session says you are in a superset');
    ok(/Round 1 of 2/.test(s.textContent), 'and which round you are on');
    ok(/No rest/i.test(s.textContent), 'and that you do not rest after this one');
    ok(/Triceps Pushdown/.test(s.querySelector('.session-ex-name').textContent),
       'starting with the first exercise of the block');
    ok(Boolean(btn(s, /Straight into Overhead Cable Extension/)),
       'the forward button names the exercise you go straight into');

    // THE RULE. Logging a number inside a superset must NOT start the rest
    // timer — that is the whole point of the grouping, and a timer firing here
    // would be telling you to do the opposite of what a superset is.
    const rest = s.querySelector('.rest-bar');
    type(s.querySelector('.step-value'), 100);
    await settle();
    ok(/Rest starts when you log a set/.test(rest.textContent),
       'logging the first exercise of a round does NOT start the rest timer');

    btn(s, /Straight into/).click();
    await settle();
    ok(/Overhead Cable Extension/.test(s.querySelector('.session-ex-name').textContent),
       'moving on lands on the second exercise of the same round');
    ok(/Last one in the round/i.test(s.textContent), 'which says it is the last of the round');
    type(s.querySelector('.step-value'), 60);
    await settle();
    ok(/Resting/.test(rest.textContent),
       'and logging THAT one does start the rest — rest belongs after the round');

    ok(Boolean(btn(s, /Round 2 of 2/)), 'the next step is round two, not the next exercise');
    btn(s, /Round 2 of 2/).click();
    await settle();
    ok(/Triceps Pushdown/.test(s.querySelector('.session-ex-name').textContent)
       && /Round 2 of 2/.test(s.textContent),
       'round two comes back to the first exercise — A,B,A,B, not all of A then all of B');
  }

  /* ---- half a superset logged: it must not save as a lone "Superset" ---- */
  // Found in review. finish() drops entries with no numbers, which left the
  // survivor still carrying `group`, and the day view bracketed one exercise
  // and called it a Superset — a claim about what was done that is false.
  {
    const w = await store.saveWorkout({
      name: 'Half super',
      exercises: [
        { exerciseId: byName('Cable Fly').id, sets: 1, notes: '', group: 0 },
        { exerciseId: byName('Pec Deck').id, sets: 1, notes: '', group: 0 },
      ],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    type(s.querySelector('.step-value'), 40);   // only the first one gets numbers
    await settle();
    const finish = btn(s, /Finish workout/) || (btn(s, /Straight into|Round/) && null);
    if (!finish) { btn(s, /Straight into|Round/).click(); await settle(); }
    const f2 = btn(s, /Finish workout/);
    if (f2) { f2.click(); await settle(); await settle(); }

    const saved = (await store.getSessions()).find((x) => x.workoutName === 'Half super');
    ok(saved && saved.entries.length === 1, 'the unlogged half of the superset is not saved');
    ok(saved && saved.entries[0].group === undefined,
       'and the half that WAS logged no longer claims to be in a superset');
  }

  /* ---- a drop set ---- */
  {
    const w = await store.saveWorkout({
      name: 'Drop day',
      exercises: [{ exerciseId: byName('Leg Extension').id, sets: 2, notes: '', setType: 'drop', minis: 2 }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    ok(/one hard set/i.test(s.textContent),
       'the screen states that the whole drop set counts as one hard set');
    const add = btn(s, /Strip the weight/);
    ok(Boolean(add), 'and offers the drop as an instruction, not a jargon label');

    // The top set of a drop set is not the end of the set — you strip the
    // weight and carry on — so rest must wait for the drop.
    const rest = s.querySelector('.rest-bar');
    type(s.querySelector('.step-value'), 120);
    await settle();
    ok(/Rest starts when you log a set/.test(rest.textContent),
       'logging the top set of a drop set does not start rest yet');

    btn(s, /Strip the weight/).click();
    await settle();
    ok(s.querySelectorAll('.set-drop').length === 1, 'the drop appears under its set');
    ok(/drop 1/i.test(s.textContent), 'and the steppers say they are editing the drop');
    type(s.querySelector('.step-value'), 80);
    await settle();
    ok(/Resting/.test(rest.textContent), 'logging the drop is what starts the rest');

    // ⚠️ The locked rule (progress.md §6): a drop set is ONE hard set. If drops
    // were rows in `sets` this count would read 3 and every volume figure in
    // the app would inflate the day someone used the feature.
    ok(s.querySelectorAll('.set-item:not(.set-drop)').length === 2,
       'the set list still shows two sets, not three');

    const finish = btn(s, /Finish workout/);
    if (finish) { finish.click(); await settle(); await settle(); }
    const saved = (await store.getSessions()).find((x) => x.workoutName === 'Drop day');
    ok(Boolean(saved), 'the drop session saves');
    ok(saved && saved.entries[0].sets.length === 1,
       `only the set with numbers in it is kept, and it is ONE set (${saved && saved.entries[0].sets.length})`);
    ok(saved && (saved.entries[0].sets[0].minis || []).length === 1,
       'with its drop stored inside it rather than as another set');
    ok(saved && saved.entries[0].setType === 'drop',
       'and the record remembers it was a drop set');
  }
  /* ---- myo-reps ---- */
  // Same nesting shape as a drop set, so what is asserted here is that the two
  // are told APART: different instruction, different label, same one-hard-set
  // rule. If they ever render identically the feature has failed at its only
  // job, because the difference between them is the whole point.
  {
    const w = await store.saveWorkout({
      name: 'Myo day',
      exercises: [{ exerciseId: byName('Cable Curl').id, sets: 2, notes: '', setType: 'myo', minis: 3 }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    ok(/Rest 10–15 seconds/.test(s.textContent),
       'a myo-rep tells you to rest briefly, not to strip the weight');
    ok(!/Strip the weight/.test(s.textContent), 'and never shows the drop-set instruction');
    ok(/3 mini-sets after each set/.test(s.textContent), 'stating how many are planned');
    ok(/one hard set/i.test(s.textContent), 'and that the whole thing is still one hard set');

    const rest = s.querySelector('.rest-bar');
    type(s.querySelector('.step-value'), 50);
    await settle();
    ok(/Rest starts when you log a set/.test(rest.textContent),
       'the top set of a myo-rep does not start the long rest either');

    btn(s, /Rest 10–15 seconds/).click();
    await settle();
    ok(/mini-set 1/i.test(s.textContent) && !/drop 1/i.test(s.textContent),
       'the mini-set is called a mini-set, not a drop');
    type(s.querySelector('.step-value'), 50);
    await settle();
    ok(/Resting/.test(rest.textContent), 'and logging it starts the rest');
    ok(Boolean(btn(s, /Another mini-set/)), 'with the button now offering another');

    const finish = btn(s, /Finish workout/);
    if (finish) { finish.click(); await settle(); await settle(); }
    const saved = (await store.getSessions()).find((x) => x.workoutName === 'Myo day');
    ok(saved && saved.entries[0].sets.length === 1, 'a myo-rep saves as ONE hard set');
    ok(saved && (saved.entries[0].sets[0].minis || []).length === 1,
       'with its mini-set nested inside');
    ok(saved && saved.entries[0].setType === 'myo', 'and recorded as a myo-rep, not a drop set');
  }
  localStorage.removeItem(DRAFT);

  /* ---- opening set 2 for the first time fills it from set 1 ---- *
   *
   * Tim, from a gym on 2026-08-24: "once the user puts in their measurements for
   * the first rep, put those same measurements in for the next set so it's easy
   * to adjust next."
   *
   * ⚠️ THE HALF THAT MATTERS IS THE SET NOBODY OPENED. The first version of this
   * filled every set below on the first keystroke, and finish() keeps any set
   * with numbers in it — so logging one set and stopping recorded three, and the
   * lifter's volume, weekly sets and muscle map all counted work they had not
   * done. That is asserted here directly, because it is the failure mode, and
   * the convenience is worthless if it invents training. */
  {
    const w = await store.saveWorkout({
      name: 'Fill day',
      exercises: [{ exerciseId: byName('Barbell Curl').id, sets: 3, notes: '' }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    ok(!s.querySelector('.prefill-note'),
       '⚠️ a lift with no history shows NO "last time" line, which is the only case this fills '
       + '(the sentence that used to say so came off on 2026-08-31 at Tim\'s request)');

    const setBtn = (n) => Array.from(s.querySelectorAll('.set-num'))
      .find((b) => b.textContent === String(n));
    type(s.querySelectorAll('.step-value')[0], 65);
    await settle();
    type(s.querySelectorAll('.step-value')[1], 10);
    await settle();

    setBtn(2).click();
    await settle();
    const vals = Array.from(s.querySelectorAll('.step-value')).map((i) => Number(i.value));
    ok(vals[0] === 65 && vals[1] === 10,
       '⚠️ opening set 2 arrives pre-filled with set 1\'s numbers, ready to adjust');

    // Adjust it, so the two sets differ and the copy cannot be mistaken for a
    // coincidence — and so the next assertion is about set 3 alone.
    type(s.querySelectorAll('.step-value')[1], 8);
    await settle();

    const finish = btn(s, /Finish workout/);
    if (finish) { finish.click(); await settle(); await settle(); }
    const saved = (await store.getSessions()).find((x) => x.workoutName === 'Fill day');
    ok(saved && saved.entries[0].sets.length === 2,
       `⚠️ set 3 was never opened, so it is NOT saved — two sets, not three (${saved && saved.entries[0].sets.length})`);
    ok(saved && saved.entries[0].sets[1].weight === 65 && saved.entries[0].sets[1].reps === 8,
       'and the filled set kept the edit made to it, not the number it was filled with');
  }
  localStorage.removeItem(DRAFT);

  /* ---- swapping an exercise mid-workout ---- *
   *
   * Tim, from a gym on 2026-08-24: "Allow the user to change the specific
   * exercise they're doing once they're already in the workout so it's easy to
   * improvise in case they want or need to switch something up."
   *
   * ⚠️ THE HALF THAT MATTERS IS THE SETS ALREADY DONE. If the machine was taken
   * after two sets, two sets were done — and they were done on the ORIGINAL
   * exercise. A swap that overwrote the entry would delete real training. */
  {
    const w = await store.saveWorkout({
      name: 'Swap day',
      exercises: [
        { exerciseId: byName('Leg Press').id, sets: 3, notes: 'machine by the window' },
        { exerciseId: byName('Leg Extension').id, sets: 3, notes: '' },
      ],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    const swapBtn = () => Array.from(s.querySelectorAll('.swap-btn'))[0];
    ok(Boolean(swapBtn()), 'every exercise offers a swap');

    /* ⚠️ SWAP OPENS ON A SHORTLIST SINCE 2026-08-30 (Tim's ask), and the full
     * library is one tap under it. `showAll()` is what every step below uses to
     * reach the old picker — which is also the assertion that the escape hatch
     * exists, made every single time rather than once. A shortlist you cannot
     * get out of would be worse than no shortlist. */
    const showAll = () => {
      const btn = [...document.querySelectorAll('.sheet button')]
        .find((b) => /^Show all \d+ exercises$/.test((b.textContent || '').trim()));
      if (btn) btn.click();
      return Boolean(btn);
    };

    /* --- nothing logged yet: replace in place --- */
    swapBtn().click();
    await settle();
    {
      const sheet = document.querySelector('.sheet');
      ok(/Swap Leg Press/.test(sheet.textContent),
         '⚠️ the swap sheet names the exercise being swapped OUT');
      ok(/Same movement, different equipment/.test(sheet.textContent),
         'and says these are the same movement rather than merely the same muscle');
      const rows = [...sheet.querySelectorAll('.search-results .row')];
      ok(rows.length === 5, `five alternatives, not 275 (${rows.length})`);
      // ⚠️ The equipment spread is the feature. Ranked on score alone this was
      // five barbell squats — every one correct and every one the same answer.
      const kinds = new Set(rows.map((r) => (r.textContent.match(/· (\w+)/) || [])[1]));
      ok(kinds.size >= 3, `and they span ${kinds.size} kinds of equipment`);
    }
    ok(showAll(), '⚠️ and the full library is one tap underneath');
    await settle();
    // The picker caps its list at 150 rows, so anything further down the library
    // has to be searched for — which is what a person does anyway.
    const pick = (name) => {
      const box = document.querySelector('.search-results')
        && document.querySelector('input[type="search"]');
      // window.Event, not the bare global — in Node 24 `Event` resolves to the
      // runtime's own, which jsdom rejects as "not of type 'Event'".
      if (box) { box.value = name; box.dispatchEvent(new window.Event('input', { bubbles: true })); }
      const row = Array.from(document.querySelectorAll('.search-results .row'))
        .find((b) => new RegExp('^' + name).test((b.textContent || '').trim()));
      if (row) row.click();
      return Boolean(row);
    };
    ok(pick('Hack Squat'), 'the swap opens the exercise picker');
    await settle(); await settle();
    ok(/Hack Squat/.test(s.textContent), '⚠️ with nothing logged the exercise is replaced in place');
    ok(!/Leg Press/.test(s.querySelector('.session-ex-name').textContent),
       'and the one it replaced is no longer the exercise you are on — an empty entry is not a record');
    ok(/Swapped in for Leg Press/.test(s.textContent),
       'and the screen says what it swapped in for, and that it is today only');
    ok(!/machine by the window/.test(s.textContent),
       'the note belonged to the exercise that was replaced, so it does not follow');

    /* ⚠️ AND A SHORTLIST ROW SWAPS DIRECTLY — the whole point of the feature is
     * that the common case is ONE tap. Asserted by clicking a row rather than
     * by reading the list, because a sheet that renders five plausible names
     * and does nothing when they are pressed is exactly the failure this
     * project has shipped before (the five inert back buttons, 2026-08-29). */
    swapBtn().click();
    await settle();
    {
      const sheet = document.querySelector('.sheet');
      const row = sheet.querySelector('.search-results .row');
      const picked = (row.querySelector('.row-title') || {}).textContent;
      row.click();
      await settle(); await settle();
      ok(new RegExp(picked).test(s.querySelector('.session-ex-name').textContent),
         `⚠️ tapping an alternative swaps straight to it (${picked}) — no second screen`);
      ok(!document.querySelector('.sheet'), 'and the sheet closes, because swapping is a single act');
      // Put Hack Squat back so the assertions below read as they did before.
      swapBtn().click(); await settle(); showAll(); await settle();
      pick('Hack Squat'); await settle(); await settle();
    }

    /* --- ⚠️ sets already logged: SPLIT, keeping what was done --- */
    type(s.querySelectorAll('.step-value')[0], 200);
    await settle();
    type(s.querySelectorAll('.step-value')[1], 8);
    await settle();
    swapBtn().click();
    await settle();
    ok(showAll(), 'the shortlist opens again with work already logged');
    await settle();
    ok(pick('Goblet Squat'), 'and the full picker is still reachable from it');
    await settle(); await settle();
    ok(/Goblet Squat/.test(s.querySelector('.session-head').textContent),
       'the swapped-in exercise is what you land on');

    // Walk to the end — the split inserted an exercise, so "Finish" is two
    // steps away rather than under the thumb.
    for (let i = 0; i < 8 && !btn(s, /Finish workout/); i++) {
      const next = btn(s, /Next exercise|Straight into|Round/);
      if (!next) break;
      next.click();
      await settle();
    }
    const finish = btn(s, /Finish workout/);
    ok(Boolean(finish), 'the walk reaches the end of the swapped workout');
    if (finish) { finish.click(); await settle(); await settle(); }
    const saved = (await store.getSessions()).find((x) => x.workoutName === 'Swap day');
    const names = saved ? saved.entries.map((e) => e.exerciseName) : [];
    ok(names.includes('Hack Squat'),
       `⚠️ the 200x8 done on the Hack Squat is KEPT under its own name (${names.join(', ')})`);
    const kept = saved && saved.entries.find((e) => e.exerciseName === 'Hack Squat');
    ok(kept && kept.sets.length === 1 && kept.sets[0].weight === 200,
       'exactly the one set that was really done, not the three that were planned');
    ok(names.indexOf('Hack Squat') < names.indexOf('Leg Extension'),
       '⚠️ and it stays in session ORDER — muscleStrength() reads that order to score fatigue');

    /* --- the workout itself is untouched: today only --- */
    const plan = await store.getWorkout(w.id);
    ok(plan.exercises[0].exerciseId === byName('Leg Press').id,
       '⚠️ and the SAVED WORKOUT still says Leg Press — a swap is for this session only');
  }
  localStorage.removeItem(DRAFT);

  /* ---- removing an exercise mid-workout (Swap's sibling, 2026-08-28) ---- *
   *
   * Tim: "delete this exercise entirely… works exactly the same as the swap
   * button where it doesn't adjust the workout for future systems, just that
   * day's recording."
   *
   * ⚠️ THE ONE PLACE IT MUST NOT MIRROR SWAP: recorded sets. A swap KEEPS
   * them (they were performed); a removal deletes them, so it has to say the
   * count out loud and ask — one tap must not destroy performed work. */
  {
    const w = await store.saveWorkout({
      name: 'Remove day',
      exercises: [
        { exerciseId: byName('Triceps Pushdown').id, sets: 2, notes: '', group: 0 },
        { exerciseId: byName('Overhead Cable Extension').id, sets: 2, notes: '', group: 0 },
        { exerciseId: byName('Lateral Raise').id, sets: 2, notes: '' },
      ],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    const removeBtn = () => [...s.querySelectorAll('.swap-btn')].find((b) => /Remove/.test(b.textContent));
    ok(Boolean(removeBtn()), 'every exercise offers Remove beside Swap');
    ok(/Superset/.test(s.textContent), 'the workout opens inside a superset');

    /* --- nothing logged: goes quietly, and the orphaned group dissolves --- */
    removeBtn().click();
    await settle();
    ok(!document.querySelector('.sheet'),
       'an untouched exercise asks nothing — pre-filled numbers are a plan, not a record');
    ok(!/Triceps Pushdown/.test(s.textContent), 'the exercise is gone from today');
    ok(!/Superset/.test(s.textContent),
       '⚠️ and its partner is no longer called a Superset — a group of one is not a group');
    ok(/Overhead Cable Extension/.test(s.querySelector('.session-ex-name').textContent),
       'you land on the exercise that took its slot');

    /* --- sets recorded: a confirm that says the count --- */
    type(s.querySelector('.step-value'), 60);
    await settle();
    removeBtn().click();
    await settle();
    const sheet = document.querySelector('.sheet');
    ok(Boolean(sheet), '⚠️ with a recorded set, removing ASKS first');
    ok(/1 recorded set/.test(sheet.textContent), 'and says how many sets die with it');
    ok(/not changed|only removes it from today/.test(sheet.textContent),
       'and that the saved workout is untouched');
    [...sheet.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove').click();
    await settle();
    ok(!/Overhead Cable Extension/.test(s.querySelector('.session-head').textContent),
       'confirming removes it, recorded set and all');

    /* --- the last exercise is refused --- */
    ok(/Lateral Raise/.test(s.querySelector('.session-ex-name').textContent), 'one exercise remains');
    removeBtn().click();
    await settle();
    ok(/Lateral Raise/.test(s.querySelector('.session-ex-name').textContent),
       '⚠️ the ONLY exercise cannot be removed — an empty session has no screen to stand on');

    /* --- today only: the saved workout still has all three --- */
    const plan = await store.getWorkout(w.id);
    ok(plan.exercises.length === 3,
       '⚠️ and the SAVED WORKOUT still has all three exercises — removal is for this session only');
    const draft = JSON.parse(localStorage.getItem(DRAFT));
    ok(draft.entries.length === 1, 'while the draft carries the removals, so a resume does too');
  }
  localStorage.removeItem(DRAFT);

  /* 🚨 THE SWAP LEAD ONLY PROMISES WHAT THE LIST DELIVERS (2026-08-30).
   *
   * Caught by a SCREENSHOT, not by an assertion: the lead read "Same movement,
   * different equipment" unconditionally, and a Deadlift offers four barbell
   * deadlifts under it — every row a correct alternative, and the sentence
   * above them false. Some families are single-equipment by nature. A caption
   * that overclaims on those teaches a reader to stop believing it on the ones
   * where it is true, which is Design Rule 5's general form. */
  {
    const dw = await store.saveWorkout({
      name: 'Single-equipment family day',
      exercises: [
        { exerciseId: byName('Deadlift').id, sets: 1, notes: '' },
        { exerciseId: byName('Leg Press').id, sets: 1, notes: '' },
      ],
    });
    localStorage.removeItem(DRAFT);
    const ds = await mount(SessionView(dw.id));
    ds.querySelectorAll('.swap-btn')[0].click();
    await settle();
    const sheet = document.querySelector('.sheet');
    const kinds = new Set([...sheet.querySelectorAll('.search-results .row-sub')]
      .map((n) => n.textContent.split('·')[1].trim()));
    ok(kinds.size === 1 && kinds.has('Barbell'),
       `the deadlift family really is barbell-only, which is what makes this the right case (${[...kinds]})`);
    ok(!/different equipment/.test(sheet.textContent),
       '🚨 so the lead does NOT promise different equipment');
    ok(/Other ways to do this movement/.test(sheet.textContent),
       'it says what is actually true instead');
    sheet.closest('.sheet-backdrop').remove();

    // And the mixed case still makes the promise, so the guard is not just
    // "never say it" — a leg press genuinely offers four kinds of equipment.
    ds.querySelectorAll('.swap-btn')[0].click();   // still exercise 1; walk on
    document.querySelector('.sheet-backdrop').remove();
    btn(ds, /Next exercise|Straight into|Round/).click();
    await settle();
    ds.querySelectorAll('.swap-btn')[0].click();
    await settle();
    const mixed = document.querySelector('.sheet');
    ok(/Swap Leg Press/.test(mixed.textContent), 'on to the leg press');
    ok(/different equipment/.test(mixed.textContent),
       'and there the promise IS made, because there the list keeps it');
    mixed.closest('.sheet-backdrop').remove();
  }
  localStorage.removeItem(DRAFT);

  /* ---- an assist machine says what you are really lifting ---- *
   *
   * ⚠️ The box says 70 and the lifter is moving 110. Tim asked for the real
   * number beside it after doing assisted pull-ups on 2026-08-24 — and this is
   * the same screen whose progression rule was, until that day, about to tell
   * him to ADD assistance and call it progress. */
  {
    const { todayISO: today } = await import(BASE + 'store.js');
    await store.logBodyWeight(180, today());
    const w = await store.saveWorkout({
      name: 'Assist day',
      exercises: [{ exerciseId: byName('Assisted Pull-Up').id, sets: 2, notes: '' }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    type(s.querySelectorAll('.step-value')[0], 70);
    await settle();
    const readout = s.querySelector('.assist-readout');
    ok(Boolean(readout), 'an assisted lift carries a readout under its steppers');
    ok(readout && /110/.test(readout.textContent),
       '⚠️ which names the 110 lbs actually being lifted, not just the 70 on the stack');
    ok(readout && /180/.test(readout.textContent) && /70/.test(readout.textContent),
       'and shows the arithmetic — 180 of body weight less 70 of help — rather than a bare number');
    ok(/of help/.test(s.textContent),
       'and the stepper itself calls the number help, so the box is not read as load');

    // ⚠️ More help than you weigh is a typo, not a very easy set.
    type(s.querySelectorAll('.step-value')[0], 250);
    await settle();
    ok(/more help than you weigh/i.test(s.querySelector('.assist-readout').textContent),
       'and 250 lbs of help on a 180 lb lifter is called out rather than shown as a negative load');
  }
  localStorage.removeItem(DRAFT);
  await store.saveSettings({ restTimer: false });
}


/* ================= home suggests where you are in the rotation ================= */
{
  const { todayISO } = await import(BASE + 'store.js');
  const { presetById } = await import(BASE + 'preset-systems.js');

  await store.clearAll();

  /* ⚠️ THE FIRST RUN — rewritten 2026-08-21, and the assertion it replaces was
     passing over the defect. It checked for "Create your first workout", which
     is exactly the string that was WRONG: it promised a workout and landed on
     `#/workouts`, whose actions are "New system" and "Explore ready-made
     systems". A stranger had to learn what a system is before logging a set.
     Verified by hand 2026-08-19; the test had been green throughout.

     What is pinned now is the property, not the wording: the first thing an
     empty account is offered must be one tap from a real programme, and must
     not make anybody read the word "system" to get there. */
  /* ⚠️ THE FIRST RUN MOVED TO RECORD ON 2026-08-25, and this test moved with
     it. Home became a friends-only feed on Tim's instruction, so a brand-new
     account's Home is legitimately empty — which means the property below is
     now Record's to keep, and losing track of it would quietly undo the
     2026-08-21 work that took install-to-first-logged-set from about a dozen
     taps to five. What is pinned is the property, not the wording. */
  const { StartPickerView: RecordView } = await import(BASE + 'views-workouts.js');
  let rec = await mount(RecordView({ tab: true }));
  const firstBtn = rec.querySelector('.btn.primary');
  ok(Boolean(firstBtn), 'an empty account leads with one clear action, on Record');
  ok(!/Create your first workout/.test(rec.textContent),
     'and it is NOT the old promise of a workout that delivered a system');
  ok(!/system/i.test(rec.textContent),
     '⚠️ the app’s own word for its own convenience (D22) does not appear on the first screen');

  // The tap has to reach Explore. Asserted by driving it, not by reading a label.
  firstBtn.click();
  await settle();
  ok(location.hash === '#/explore',
     `the first action opens the ready-made programmes (${location.hash})`);
  location.hash = '#/home';
  await settle();

  /* ⚠️ AND HOME IS A FEED, WITH NOTHING TO START. Tim: "all of the suggested
     workout and choose another workout stuff [moves] to the Record section, so
     we don't double dip." A copy of either drifting back here is the exact
     duplication he asked to remove. */
  let home = await mount(HomeView());
  for (let i = 0; i < 6; i++) await settle();
  ok(Boolean(home.querySelector('.feed')), 'Home is a feed');
  ok(!/Choose another workout|Next in your rotation/.test(home.textContent),
     '⚠️ and carries no way to start a workout — that is Record’s job now, not a second copy of it');
  ok(!/Recent activity/.test(home.textContent),
     'nor the user’s own recent sessions, which is what "friends only, for now" means');

  const { system } = await store.addPresetSystem(presetById('preset-ppl'));
  const ws = await store.getWorkouts(system.id);

  // One system, no history — start at the top of the rotation. On RECORD now.
  rec = await mount(RecordView({ tab: true }));
  const primary = rec.querySelector('.btn.primary.lg');
  ok(primary && primary.textContent.includes(ws[0].name),
     `the big button offers the first workout in the programme (${primary && primary.textContent})`);
  ok(/First workout in Push Pull Legs/.test(rec.textContent),
     'and says why, naming the system');
  ok(/Or start any workout/.test(rec.textContent),
     '⚠️ every other workout is still one tap away — the suggestion never traps you, and on this screen the full list is directly underneath it');

  // Record the first workout; the suggestion should move on to the second.
  await store.saveSession({
    workoutId: ws[0].id, workoutName: ws[0].name, date: todayISO(),
    entries: [{ exerciseId: ws[0].exercises[0].exerciseId, exerciseName: 'x', sets: [{ weight: 100, reps: 5 }] }],
  });
  rec = await mount(RecordView({ tab: true }));
  const next = rec.querySelector('.btn.primary.lg');
  ok(next && next.textContent.includes(ws[1].name),
     `after doing ${ws[0].name} it offers ${ws[1].name} (${next && next.textContent})`);
  ok(new RegExp(`already did ${ws[0].name} today`).test(rec.textContent),
     'training today is acknowledged, not used as a reason to refuse');
  ok(!/rest day|too much|should not/i.test(rec.textContent),
     'and it never tells you what to do — Rule 6');

  await store.clearAll();
}


/* ================= Home is a feed of other people ================= *
 *
 * Rebuilt 2026-08-25 on Tim's Strava reference. Driven inside the DEMO, which
 * is the only account that has friends — `social.state()` refuses in the demo
 * for real (publishing invented training to real people is the one thing that
 * could do harm), so the feed reads a generated list instead. That branch
 * exists precisely so this screen can be looked at and measured at all.
 */
{
  const { demo } = await import(BASE + 'store.js');
  const { buildDemoFeed } = await import(BASE + 'demo.js');
  const { todayISO } = await import(BASE + 'store.js');

  sessionStorage.setItem('ftrack:v1:demo', '1');
  ok(demo.active(), 'the demo flag is on, so this is not passing vacuously');

  const home = await mount(HomeView());
  for (let i = 0; i < 8; i++) await settle();

  const cards = [...home.querySelectorAll('.feed-card')];
  ok(cards.length > 0, `the feed renders ${cards.length} cards`);

  /* ⚠️ NEWEST FIRST, AND NEVER RANKED. Strava switched its default to a
     personalised ordering and got a petition; it now ships "Latest Activities"
     as a toggle. Ordering is the one thing a feed cannot get wrong quietly. */
  const feed = buildDemoFeed(todayISO());
  const dates = feed.map((e) => e.act.date);
  ok(dates.every((d, i) => i === 0 || dates[i - 1] >= d),
     '⚠️ strictly newest-first — no ranking, nothing hidden, nothing promoted');

  const first = cards[0];
  ok(Boolean(first.querySelector('.feed-name')), 'a card names who did it');
  ok(Boolean(first.querySelector('.feed-title')), 'and what they did, as the card’s heading');
  ok(Boolean(first.querySelector('.feed-actions')), 'and carries the action row');

  // Order is the part Tim specified explicitly, so it is the part pinned.
  const acts = [...first.querySelectorAll('.feed-act')].map((b) => b.textContent);
  ok(/Kudos/.test(acts[0]) && /Comment/.test(acts[1]) && /Share/.test(acts[2]),
     `⚠️ thumbs-up left, comment middle, share right (${acts.join(' | ')})`);

  /* ⚠️ THE LOWEST SHARING TIER MUST READ AS COMPLETE, NOT BROKEN. "Just that I
     trained" publishes no exercise list, and the demo deliberately includes one
     such friend — a card that rendered an empty line there would look like a
     failed load, which is the fault this assertion exists to catch. */
  const quiet = [...home.querySelectorAll('.feed-did.is-quiet')];
  ok(quiet.length > 0, 'a friend who shares only that they trained still gets a complete card');
  ok(quiet.every((n) => n.textContent.trim().length > 10),
     'and it says so in words rather than leaving the line blank');

  /* ⚠️ THE ONE STRING THAT MUST NEVER APPEAR. Sessions recorded before
     `startedAt` existed have no time, and the lowest tier never publishes one —
     `new Date(undefined).toLocaleTimeString()` renders "Invalid Date" straight
     into the card. The meta line drops the half it has nothing for. */
  ok(!/Invalid Date/.test(home.textContent),
     '⚠️ no card ever prints "Invalid Date" — a missing time removes a term, it does not invent one');
  ok([...home.querySelectorAll('.feed-meta')].some((n) => / at /.test(n.textContent)),
     'and a card that HAS a time shows it, so the check above is not passing by there being none');

  /* ---- the stat row (social-plan §13 step 1) ----
   *
   * ⚠️ SETS, NOT VOLUME. Tim's call on 2026-09-01 — "Replace Volume for # of
   * sets" — and js/session-stats.js records why it is also the only one of the
   * two that can be computed honestly for somebody else's training. */
  const withStats = [...home.querySelectorAll('.feed-stats')];
  ok(withStats.length > 0, `${withStats.length} cards carry a stat row`);
  const labels = [...home.querySelectorAll('.feed-stat-label')].map((n) => n.textContent);
  ok(labels.includes('Sets'), 'the middle column counts SETS');
  ok(!labels.some((l) => /volume/i.test(l)),
     '⚠️ and never volume — a friend\'s bodyweight work has no external load to total');
  ok(labels.includes('Time'), 'duration moved out of the grey meta line and into the row');
  ok(![...home.querySelectorAll('.feed-meta')].some((n) => /\d+ min/.test(n.textContent)),
     '⚠️ and it left the meta line rather than appearing twice — one number, one place');
  ok([...home.querySelectorAll('.feed-stat-value')].every((n) => n.textContent.trim() !== '0'),
     'a column with nothing to say is dropped, not printed as 0');

  /* ---- one row per exercise, set count first (§12.14 difference 2) ---- */
  const exRows = [...home.querySelectorAll('.feed-ex')];
  ok(exRows.length > 0, `${exRows.length} exercise rows across the feed`);
  ok(exRows.some((n) => /^\d+ sets?$/.test(n.querySelector('.feed-ex-sets')?.textContent || '')),
     'each says how much was done of it, not just that it was done');
  ok([...home.querySelectorAll('.feed-card')].every((c) =>
       c.querySelectorAll('.feed-ex:not(.is-quiet)').length <= 5),
     '⚠️ at most five exercises on a card — one marathon session must not push every other card off the screen');

  /* ---- the card is a way in (§13 step 3) ---- */
  const opens = [...home.querySelectorAll('a.feed-open')];
  ok(opens.length > 0, 'tapping a card opens the workout');
  ok(opens.every((a) => /^#\/friend\/[^/]+\/[^/]+$/.test(a.getAttribute('href'))),
     'at a route that addresses one session of one person');
  ok([...home.querySelectorAll('.feed-card')].every((c) =>
       c.querySelector('a.feed-open') || c.querySelector('.feed-open.is-flat')),
     '⚠️ and a card with nothing behind it is flat rather than a dead tap');

  /* 🚨 FOLLOW THE LINK. The href being well-formed proves nothing about there
     being a screen at the other end — this walks the route the card actually
     carries and asserts the workout is on it. The demo is the only account with
     friends, so it is also the only place this whole path can be driven. */
  const { FriendSessionView } = await import(BASE + 'views-social.js');
  const [, , duid, dsid] = opens[0].getAttribute('href').split('/');
  const opened = await mount(FriendSessionView(decodeURIComponent(duid), decodeURIComponent(dsid)));
  for (let i = 0; i < 8; i++) await settle();
  const openedTitle = cards[0].querySelector('.feed-title').textContent.trim();
  ok(opened.textContent.includes(openedTitle),
     `the card's link opens that same workout (${openedTitle})`);
  ok(Boolean(opened.querySelector('.ws-sets')),
     'and the screen shows the sets, which the card never did');
  ok(Boolean(opened.querySelector('.feed-actions')),
     'and carries kudos, comment and share — the same row, from the same function');

  sessionStorage.removeItem('ftrack:v1:demo');
  await (await import(BASE + 'store.js')).auth.retry();
}

/* ================= The "% optimal" rating on Explore ================= */
{
  const { ExploreView } = await import(BASE + 'views-workouts.js');
  const { PRESET_SYSTEMS } = await import(BASE + 'preset-systems.js');
  const screen = await ExploreView();
  await settle();

  const badges = screen.querySelectorAll('.rating');
  ok(badges.length === PRESET_SYSTEMS.length,
     `every ready-made system carries a rating (${badges.length} of ${PRESET_SYSTEMS.length})`);

  // The badge carries FOUR cells since 2026-08-19 — two scores and two costs —
  // so the score assertions are scoped by their caption rather than by
  // position. A cell read by index would silently start checking days/week the
  // next time the order changes.
  const cellsOf = (badge) => [...badge.querySelectorAll('.rating-cell')].map((c) => ({
    cap: c.querySelector('.rating-cap').textContent,
    num: c.querySelector('.rating-num').textContent,
  }));
  const all = [...badges].flatMap(cellsOf);
  const scores = all.filter((c) => c.cap === 'growth' || c.cap === 'strength');

  ok(scores.length === PRESET_SYSTEMS.length * 2,
     'two scores each — growth and strength, never a blend');
  ok(scores.every((c) => /^\d+%$/.test(c.num)), 'each is a plain percentage');
  ok(scores.every((c) => Number(c.num.replace('%', '')) % 5 === 0),
     'and every one is banded to 5 — the models explain a quarter of the variance');
  ok(scores.every((c) => Number(c.num.replace('%', '')) <= 100), 'nothing exceeds 100 %');

  // Tim, 2026-08-19: what a programme COSTS, beside how good it is.
  const days = all.filter((c) => c.cap === 'days/wk');
  const mins = all.filter((c) => c.cap === 'min');
  ok(days.length === PRESET_SYSTEMS.length,
     'every ready-made system also shows its training days a week');
  ok(mins.length === PRESET_SYSTEMS.length, 'and roughly how long a session takes');
  ok(days.every((c) => Number(c.num) > 0 && Number(c.num) <= 7),
     'days are a real number of days');
  ok(mins.every((c) => /^~\d+$/.test(c.num)),
     'minutes are marked approximate — no programme takes exactly 75 minutes');

  // ⚠️ The cost must never be duplicated in the row summary as well. It used to
  // live there, and leaving it in both places takes width off the one line that
  // says what the programme actually is.
  const subs = [...screen.querySelectorAll('.row-sub')].map((n) => n.textContent).join(' ');
  ok(!/days\/week/.test(subs),
     'and the row summary no longer repeats the days, now that the badge carries them');

  // The number cannot be left to explain itself: 55 % reads as a bad mark
  // unless the reader is told what 100 % would mean.
  const text = screen.textContent.replace(/\s+/g, ' ');
  ok(/Nothing real reaches 100/.test(text), 'the screen says outright that nothing reaches 100 %');
  ok(/close to failure/.test(text), 'and that the ratings assume you train close to failure (D9)');
  ok(/more days is not itself better/i.test(text),
     'and that more days is not itself better for growth — the finding Tim predicted');
}

/* ========== The rating on a system the USER built ========== */
{
  const { SystemRouteView } = await import(BASE + 'views-workouts.js');
  await store.clearAll();

  const sys = await store.saveSystem({ name: 'My Split' });
  const bench = byName('Barbell Bench Press');
  const squat = byName('Back Squat');
  const row = byName('Barbell Row');
  await store.saveWorkout({ name: 'Upper', systemId: sys.id, exercises: [
    { exerciseId: bench.id, sets: 4 }, { exerciseId: row.id, sets: 4 },
  ] });
  await store.saveWorkout({ name: 'Lower', systemId: sys.id, exercises: [
    { exerciseId: squat.id, sets: 5 },
  ] });

  const screen = await SystemRouteView(sys.id);
  await settle();
  const text = () => screen.textContent.replace(/\s+/g, ' ');

  ok(screen.querySelector('.own-rating'), 'a system you built yourself gets a rating too');
  const cellText = (root, cap) => [...root.querySelectorAll('.rating-cell')]
    .filter((c) => c.querySelector('.rating-cap').textContent === cap)
    .map((c) => c.querySelector('.rating-num').textContent);
  const nums = [...cellText(screen, 'growth'), ...cellText(screen, 'strength')];
  ok(nums.length === 2, 'the same two scores as a ready-made one — growth and strength');
  ok(nums.every((t) => Number(t.replace('%', '')) % 5 === 0), 'banded the same way');
  // ⚠️ A system the user typed declares no session length, so its minutes are
  // ESTIMATED from the set count. Showing nothing at all would be worse on a
  // summary badge, and showing it unmarked would be a claim the author never
  // made — so it is there, and the title says which it is.
  ok(cellText(screen, 'days/wk').length === 1 && cellText(screen, 'min').length === 1,
     'and it carries days a week and a session length like a ready-made one does');
  const minCell = [...screen.querySelectorAll('.rating-cell')]
    .find((c) => c.querySelector('.rating-cap').textContent === 'min');
  ok(/Estimated from the set count/.test(minCell.getAttribute('title') || ''),
     'with the estimate declared as an estimate, not passed off as the author’s figure');

  // With no history it must say it is assuming, not quietly pretend to know.
  ok(/Assuming you train each workout once a week/.test(text()),
     'with no history it SAYS it is assuming how often you train, rather than guessing silently');
  ok(/Nothing real reaches 100/.test(text()), 'and still explains what 100 % would mean');
  // Coverage is the actionable part on your own programme.
  ok(/Under 4 sets a week/.test(text()),
     'and names the muscles under the minimum effective dose');

  // An empty system has nothing to rate and must not render an empty box.
  const empty = await store.saveSystem({ name: 'Nothing here' });
  const emptyScreen = await SystemRouteView(empty.id);
  await settle();
  ok(!emptyScreen.querySelector('.own-rating'),
     'a system with no workouts shows no rating rather than an empty one');

  // ...and the same rating on the Workouts LIST, which is where Tim wanted it.
  const { WorkoutsView } = await import(BASE + 'views-workouts.js');
  const list = await WorkoutsView();
  await settle();
  const listText = list.textContent.replace(/\s+/g, ' ');

  ok(list.querySelector('.rating'),
     'the Workouts list shows the rating beside your own systems');
  ok(list.querySelectorAll('.rating').length === 1,
     'one badge — the system with workouts in it, not the empty one');
  ok(/My Split/.test(listText) && /Nothing here/.test(listText),
     'while both systems are still listed');
  const listNums = [...cellText(list, 'growth'), ...cellText(list, 'strength')];
  ok(listNums.length === 2 && listNums.every((t) => Number(t.replace('%', '')) % 5 === 0),
     'growth and strength, banded the same as everywhere else');
  ok(cellText(list, 'days/wk').length === 1 && cellText(list, 'min').length === 1,
     'and the cost beside them, so the list says what a programme asks before you open it');
  ok(/Upper · Lower|Lower · Upper/.test(listText),
     'and the workout names still show in full — the rating did not clip them away');

  await store.clearAll();
}

/* ================= Social ================= */
// docs/social-plan.md, Phases 2-3. There is no cloud in jsdom, so what these
// assert is the DEGRADED path — which is the one a real person on a train meets,
// and the one a screenshot review would never see.
{
  const { SocialView, FriendView, InviteView } = await import(BASE + 'views-social.js');
  const text = (node) => node.textContent.replace(/\s+/g, ' ');

  const social = await SocialView();
  ok(social instanceof Node, 'the Social screen mounts');
  // ⚠️ "Friends", not "Social", since the six-tab nav became five on
  // 2026-08-22: this screen is half of the Home tab now and the switch above it
  // says Friends. The module is still social.js — that is the code's word for
  // the feature, and this asserts the word the USER sees.
  ok(/Friends/.test(text(social)), 'and is titled Friends');
  ok(!/Social/.test(text(social)),
     'and does not also call itself Social — one screen, one name');
  // The important one: with no account reachable it must explain itself rather
  // than render an empty friends list, which would read as "you have no
  // friends" when the truth is "we cannot ask".
  ok(/not connected|not switched on|real account/i.test(text(social)),
     'with no cloud it says WHY social is unavailable rather than showing an empty list');
  ok(!/Invite a friend/.test(text(social)),
     'and does not offer to invite anybody when it cannot reach an account');
  ok(!/lbs|reps/i.test(text(social)), 'and shows no training data at all');

  // Messaging apps truncate links. A broken one must explain itself, not throw.
  for (const bad of ['', 'onlyone', '//']) {
    const v = await InviteView(bad);
    ok(v instanceof Node && /not complete|not connected|not switched on|name first/i.test(text(v)),
       `a broken invite link ("${bad}") explains itself instead of throwing`);
  }

  const friend = await FriendView('nobody-uid');
  ok(friend instanceof Node, 'a friend screen mounts for an unknown uid');
  ok(/not connected|not switched on|real account/i.test(text(friend)),
     'and says so rather than rendering a blank profile');
}

/* ================= Goals ================= */
// docs/goals-plan.md, Phases 1-2. The model itself is covered by
// tests/goals.test.mjs; what this checks is that every screen mounts, that the
// two states with nothing to show still offer a route out, and — the one that
// matters most — that the screen SAYS it cannot give a verdict rather than
// leaving a gap somebody reads as a broken feature.
{
  const { GoalsView, GoalRouteView } = await import(BASE + 'views-goals.js');
  const { candidateGoals, buildGoal } = await import(BASE + 'goals.js');
  const { muscleStrength, todayISO } = await import(BASE + 'store.js');
  const text = (node) => node.textContent.replace(/\s+/g, ' ');

  await store.clearAll();

  // ---- nothing known about the person at all ----
  let goals = await mount(GoalsView());
  ok(goals.querySelector('.topbar'), 'Goals renders with a header');
  ok(/gender|body weight/i.test(text(goals)),
     'with no profile it names what is missing rather than showing an empty screen');
  ok(goals.querySelector('a[href="#/profile"]'), 'and links straight to the profile');

  // ---- profile, but nothing recorded ----
  await store.saveProfile({ gender: 'male', birthYear: 1994 });
  await store.logBodyWeight(180, '2026-08-15');
  goals = await mount(GoalsView());
  ok(/Nothing to aim at yet/i.test(text(goals)),
     'with a profile but no history it says there is nothing to aim at yet');
  ok(goals.querySelector('a[href="#/benchmark"]'), 'and offers a way to fix that');
  ok(/target, not a promise/i.test(text(goals)),
     'and states before anything is chosen that a goal is not a promise');

  // ---- something to rank ----
  const b = byName('Barbell Bench Press');
  await store.saveBenchmark({
    date: '2026-08-15', exerciseId: b.id, exerciseName: b.name,
    values: { weight: 205, reps: 3 },
  });

  const picker = await mount(GoalRouteView('new'));
  ok(/Chest/.test(text(picker)), 'the picker lists a muscle that has something recorded');
  ok(/Barbell Bench Press/.test(text(picker)), 'named by the lift it is measured against');
  ok(/freezes the weight/i.test(text(picker)),
     'and says the target weight is frozen, so changing the comparison later cannot move it');

  const levels = await mount(GoalRouteView('new/Chest'));
  const levelText = text(levels);
  ok(/Proficient|Advanced|Expert|Elite/.test(levelText),
     'choosing a muscle offers the levels above where it is now');
  ok(/\+\d+%/.test(levelText), 'each with how far it reaches');
  ok(/is a prediction/i.test(levelText),
     'and repeats that none of them is a prediction, at the moment somebody commits');

  // ---- a goal is running ----
  const { muscles, profile } = await muscleStrength();
  const chest = muscles.get('Chest');
  const option = candidateGoals('Chest', chest.estimate, chest.percentile, profile)[0];
  await store.setGoal(buildGoal({
    muscle: 'Chest', level: option.level, targetWeight: option.targetWeight,
    startWeight: chest.estimate, startPercentile: chest.percentile,
    startLevelKey: chest.level ? chest.level.key : null,
    startDate: todayISO(), liftName: chest.lift.name, comparison: 'men who lift',
  }));

  goals = await mount(GoalsView());
  const live = text(goals);
  ok(/Barbell Bench Press/.test(live), 'the tab now shows the goal');
  ok(goals.querySelector('.to-next-fill'), 'with a progress bar');
  ok(/12 weeks left|11 weeks left/.test(live), 'and how long is left');

  // ⚠️ THE ONE THAT MATTERS. The verdict is gated on the estimator, and the
  // screen has to say so — a silent gap where "on track" belongs reads as a
  // broken feature, and a guess would be worse than either.
  ok(/will not tell you yet/i.test(live),
     'it states outright that it will not give an on-track verdict yet');
  ok(/bad Tuesday/i.test(live), 'and why — a day-to-day estimate swings several percent');

  // "behind" is allowed exactly once on this screen: inside the paragraph
  // explaining why there is no verdict, and in the future tense. Strip that
  // paragraph out and the word must be gone — otherwise something somewhere has
  // started passing judgement on the reader's training.
  const withoutVerdict = goals.cloneNode(true);
  withoutVerdict.querySelectorAll('.goal-verdict').forEach((n) => n.remove());
  ok(!/behind|on track|ahead of/i.test(text(withoutVerdict)),
     'and no verdict language appears anywhere outside that explanation');

  // Requirements, and the two that must not look like dials.
  ok(/Hard sets a week/i.test(live), 'the requirements are on the screen');
  ok(/g\b/.test(live) && /Protein/i.test(live), 'including a protein figure');
  ok(/a bar, not a dial/i.test(live),
     'with protein labelled a threshold rather than something more of buys more muscle');
  ok(/cannot see either/i.test(live),
     'and protein and sleep stated as conditions the app cannot measure');

  const stalls = await mount(GoalRouteView('stalls'));
  const stallText = text(stalls);
  ok(/What the app can measure/i.test(stallText) && /What it cannot see/i.test(stallText),
     'the stalls screen keeps the measurable and unmeasurable reasons apart');
  ok(/reps-in-reserve|reps in reserve/i.test(stallText),
     'and names the invisible one that matters most');
  ok(stalls.querySelectorAll('.stall-row').length === 6, 'six reasons in all');

  const fits = await mount(GoalRouteView('systems'));
  const fitText = text(fits);
  ok(/sets a week on Chest/i.test(fitText),
     'the matching screen ranks programmes by what the goal muscle actually gets');
  ok(fits.querySelectorAll('.row').length > 3, 'and lists the ready-made systems');

  await store.clearAll();
}

/* ================= The demo account ================= */
// The generated year itself is covered by tests/demo.test.mjs. What this checks
// is the way IN and the way OUT, and — the one that matters — that a demo
// session cannot reach Social, because publishing invented workouts to real
// friends is the only way this feature could do actual harm.
{
  const { AccountView } = await import(BASE + 'views-account.js');
  const { SocialView } = await import(BASE + 'views-social.js');
  const { demo, social } = await import(BASE + 'store.js');
  const text = (node) => node.textContent.replace(/\s+/g, ' ');

  const account = await mount(AccountView());
  ok(/View demo account/.test(text(account)), 'the Account screen offers the demo account');
  ok(/nothing is saved/i.test(text(account)),
     'and says before you tap it that nothing in there is kept');
  ok(/Your own data is untouched/i.test(text(account)),
     'and that your own data is safe, which is the other thing to say first');

  // Entering for real reloads the page, which jsdom cannot do — so the flag is
  // set directly and the screens are asked what they make of it.
  sess.set('ftrack:v1:demo', '1');
  ok(demo.active() === true, 'the demo flag is per-tab and reads back as active');

  const inDemo = await mount(AccountView());
  const demoText = text(inDemo);
  ok(/You are in the demo account/i.test(demoText),
     'the Account screen becomes the demo screen rather than showing account controls');
  ok(!/Delete account|Sign out|Upload/i.test(demoText),
     'and offers no account controls at all — none of them would mean anything here');
  ok(/Leave the demo/i.test(demoText), 'with the way out on it');
  ok(/starts it over/i.test(demoText), 'and it repeats that a reload starts over');

  // ⚠️ THE ONE THAT MATTERS. republish() builds a friend-visible copy out of
  // store.getSessions(), which in the demo is invented — so Social has to be
  // refused, and refused for the RIGHT reason rather than by telling somebody
  // to sign in to an account they are already signed into.
  const state = await social.state();
  ok(state.available === false && state.reason === 'demo',
     'Social reports itself unavailable in the demo, and says demo is why');

  const soc = await mount(SocialView());
  ok(/Sharing is off in the demo/i.test(text(soc)),
     'and the Friends screen explains that rather than showing an empty friends list');
  ok(!/Set up my account/i.test(text(soc)), 'without wrongly blaming the account');

  // ⚠️ SETTINGS, INSIDE THE DEMO. This threw for the whole of the demo's life:
  // `auth.state()` tested `impl === LocalBackend`, and MemoryBackend is neither
  // that nor the remote one, so it fell into the cloud branch and called a
  // `currentUser()` it has never had. Every route was checked by hand on
  // 2026-08-19 EXCEPT the two behind the header icons, and this was one of them.
  // The screen a person uses to judge the app crashed inside the account built
  // for judging the app.
  //
  // Asserted three ways so it cannot half-regress: the state object, the screen
  // rendering at all, and the words on it — because the first version of the fix
  // could have returned mode 'local', which renders fine and tells somebody in
  // the demo that their data is safe on this device. It is not on this device.
  // It is nowhere.
  // ⚠️ `active()` memoises its choice of backend, and the app only ever reaches
  // the demo through a RELOAD, which throws that memo away. A test setting the
  // flag in a live module has to do the same by hand, or it is asking the
  // question of whichever backend was already chosen.
  const { auth } = await import(BASE + 'store.js');
  await auth.retry();
  const demoState = await auth.state();
  ok(demoState.mode === 'demo', 'auth.state() knows the demo is its own backend, not "local"');
  ok(demoState.user === null && demoState.degraded === false,
     'and reports no account rather than a degraded one');

  const { SettingsView } = await import(BASE + 'views-data.js');
  const settings = await mount(SettingsView());
  // (The row that said "Demo account" moved to the Account screen 2026-08-26;
  // what this assertion always meant is "the screen mounts in the demo".)
  ok(settings.querySelector('.topbar') && /Nothing here is saved/i.test(text(settings)),
     'Settings opens in the demo instead of throwing "impl.currentUser is not a function"');
  ok(/Nothing here is saved/i.test(text(settings)),
     'and says nothing is being stored, rather than claiming this device holds it');
  ok(!/Saving to this device/i.test(text(settings)),
     'the wrong-but-plausible answer is specifically absent');

  sess.delete('ftrack:v1:demo');
  ok(demo.active() === false, 'and leaving clears the flag');

  // The same screen outside the demo must be unaffected — otherwise the fix
  // above could be "always say demo", which passes everything before this line.
  await auth.retry();
  const realSettings = await mount(SettingsView());
  ok(!/Demo account/i.test(text(realSettings)),
     'and Settings outside the demo does not claim to be one');

  /* ---- ⚠️ the cloud-full warning — Open work 0b(c) ---- *
   *
   * Driven directly rather than through a Settings render, because no test can
   * stand up a Firestore backend and `cloudUsage()` correctly returns null on
   * every backend that can be stood up. So the branches below are the ONLY way
   * the wording of a warning nobody will see for years gets read at all.
   */
  const { cloudFullWarning } = await import(BASE + 'views-data.js');
  const usage = (fraction, rowsLeft, collection = 'sessions') => ({
    collection, rows: 500, bytes: Math.round(1048576 * fraction),
    limit: 1048576, fraction, bytesPerRow: 2000, rowsLeft,
  });

  ok(cloudFullWarning(null) === null, 'no usage figure paints nothing');
  ok(cloudFullWarning(usage(0.10, 900)) === null,
     '⚠️ an account with room to spare is told NOTHING — the always-on warning is the one nobody reads');
  ok(cloudFullWarning(usage(0.79, 110)) === null, 'and it stays silent right up to the threshold');

  const near = text(await mount(cloudFullWarning(usage(0.84, 84))));
  ok(/running out of room/i.test(near), 'at 84 % it says the account is running out of room');
  ok(/84 %/.test(near), 'and states the percentage it is talking about');
  ok(/about 84 more/.test(near),
     '⚠️ and converts it to a number of workout records, because a percentage is not an instruction');
  ok(/backup/i.test(near), 'and names the one thing that helps');
  ok(!/refused/i.test(near), 'without claiming anything has failed yet');

  const full = text(await mount(cloudFullWarning(usage(0.995, 0))));
  ok(/no room for new workout records/i.test(full),
     '⚠️ the full branch keys off room for ONE MORE ROW, not on the fraction reaching 1 — a stored '
     + 'document can never be over the cap, because the write that put it there would have been refused');
  ok(/refused/i.test(full), 'and says plainly that saving is being refused');
  ok(!/running out of room/i.test(full), 'the softer sentence is gone once it is actually full');

  const oneLeft = text(await mount(cloudFullWarning(usage(0.99, 1))));
  ok(/one more workout record/i.test(oneLeft) && !/about 1 more/.test(oneLeft),
     'room for exactly one more reads as English, not as "about 1 more"');

  const weighIns = text(await mount(cloudFullWarning(usage(0.9, 40, 'bodyWeight'))));
  ok(/weigh-ins/.test(weighIns) && !/workout record/.test(weighIns),
     'it names the collection the check actually found, rather than assuming sessions');
}

/* ================================================================== *
 * ⚠️ LABELS ARE ASSOCIATED WITH THEIR CONTROLS
 *
 * Found by the first accessibility audit this project ever had, 2026-08-20: the
 * app rendered 19 `el('label', { text: … })` calls and NOT ONE was connected to
 * anything. A .field puts the label next to the control, which is visually
 * correct and programmatically silent — a screen reader announced "edit text,
 * blank" on every form in the app.
 *
 * ⚠️ jsdom IS THE RIGHT TOOL HERE, FOR ONCE. An association is structure, not
 * paint, so unlike the contrast and hit-area work this needs no browser. What it
 * cannot tell you is whether the name is a GOOD one — only that there is one.
 * ================================================================== */
{
  const { associateLabels } = await import(BASE + 'ui.js');
  const div = (cls) => { const d = document.createElement('div'); if (cls) d.className = cls; return d; };
  const lab = (t) => { const l = document.createElement('label'); l.textContent = t; return l; };
  const inp = () => document.createElement('input');

  const field = div('field');
  const label = lab('Birth year');
  const input = inp();
  field.append(label, input);
  associateLabels(field);
  ok(!!input.id && label.htmlFor === input.id,
     'a label and its sibling control inside a .field are wired together');

  // ⚠️ Scoped to the field. A label must never reach past its own group — the
  // first field's label naming the second field's input is worse than no name
  // at all, because it reads as correct to everything that checks for one.
  const two = div();
  const f1 = div('field'); const l1 = lab('Email');
  const f2 = div('field'); const i2 = inp();
  f1.append(l1); f2.append(i2); two.append(f1, f2);
  associateLabels(two);
  ok(!l1.htmlFor, 'and a label with no control in its own field names nothing rather than a stranger');

  const kept = div('field');
  const kl = lab('Weight');
  const ki = inp();
  ki.setAttribute('aria-label', 'Body weight in pounds');
  kept.append(kl, ki);
  associateLabels(kept);
  ok(ki.getAttribute('aria-label') === 'Body weight in pounds' && !kl.htmlFor,
     'and a control that already carries an aria-label is left alone, never overwritten');

  // ⚠️ VACUITY GUARD. If the ids were a constant, every assertion above would
  // still pass and two labels would point at one input.
  const a = div('field'); const b = div('field');
  const la = lab('One'); const ia = inp();
  const lb = lab('Two'); const ib = inp();
  a.append(la, ia); b.append(lb, ib);
  const both = div(); both.append(a, b);
  associateLabels(both);
  ok(ia.id && ib.id && ia.id !== ib.id && la.htmlFor === ia.id && lb.htmlFor === ib.id,
     'two fields get two DISTINCT ids — generated, not a constant');
}

/* ================= guests in the session runner (Open work 0e) =================
   Tim, from the gym, twice: record a friend's sets on your phone. The guest is
   a name with no account, their sets live in their own collection, and the
   load-bearing assertions are the SEPARATIONS — the guest's numbers never
   appear under You, and never land in the owner's sessions. */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const w = await store.saveWorkout({
    name: 'Buddy bench day',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));

  const bar = s.querySelector('.people-bar');
  ok(Boolean(bar), 'the runner says who it is recording for');
  const chips = () => [...s.querySelectorAll('.person-chip')];
  ok(chips().some((b) => b.textContent.trim() === 'You'), 'You are the first person');
  const addBtn = chips().find((b) => /Add a person/.test(b.textContent));
  ok(Boolean(addBtn), 'adding a person is offered in words while the session is solo');

  /* Add Alex through the sheet.
   *
   * ⚠️ TWO STEPS SINCE 2026-08-29, and the extra one is the point of the
   * change: the sheet now leads with the people who already have accounts, and
   * inventing a name is the deliberate second choice rather than the only one.
   * `openSheet` stacks, so the inner sheet is the LAST `.sheet` in the DOM. */
  addBtn.click(); await settle(); await settle();
  const sheet = document.querySelector('.sheet');
  ok(Boolean(sheet), 'add-a-person opens a sheet');
  ok(/Your friends/i.test(sheet.textContent),
     '⚠️ and it leads with FRIENDS — the people who have accounts, which is what Tim '
     + 'wanted this feature for');
  const newBtn = [...sheet.querySelectorAll('button')]
    .find((b) => /Someone new/.test(b.textContent));
  ok(Boolean(newBtn), 'with inventing a name offered below them, for somebody with no account');
  newBtn.click(); await settle();
  const inner = [...document.querySelectorAll('.sheet')].pop();
  ok(/no account/i.test(inner.textContent),
     'the sheet says a guest needs no account and where their sets are kept');
  inner.querySelector('input').value = 'Alex';
  [...inner.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click();
  await settle(); await settle();

  const alexChip = chips().find((b) => b.textContent.trim() === 'Alex');
  ok(Boolean(alexChip), 'the guest appears as a chip');
  ok(alexChip && alexChip.getAttribute('aria-pressed') === 'true',
     'adding a guest switches straight to recording for them');

  // Record 95 lbs for Alex.
  const gWeight = s.querySelector('.step-value');
  gWeight.value = '95';
  gWeight.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();

  // Switch back to You — the guest's number must not follow.
  chips().find((b) => b.textContent.trim() === 'You').click();
  await settle();
  ok(Number(s.querySelector('.step-value').value) !== 95,
     '⚠️ switching back to You does not show the guest\'s numbers');

  // Record the owner's own set and finish.
  const oWeight = s.querySelector('.step-value');
  oWeight.value = '185';
  oWeight.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle();

  const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
  ok(saved && saved.entries[0].sets[0].weight === 185,
     'the owner\'s session holds the owner\'s numbers');
  /* ⚠️ ASSERTED ON THE SETS, NOT ON A SUBSTRING OF THE WHOLE SESSION.
   * This was `JSON.stringify(saved).indexOf('95') === -1` until 2026-08-28 and
   * it failed roughly once in ten runs for a reason that had nothing to do with
   * guests: the serialised session carries a generated id, a `createdAt` and a
   * `startedAt`, and "95" turns up in a millisecond field or a base-36 id often
   * enough to be seen. A test that fails at random teaches people to re-run it,
   * which is the habit that hides a real failure.
   *
   * The claim being made is about recorded VALUES, so the check is too. */
  const ownerSets = (saved ? saved.entries : []).flatMap((e) => e.sets || []);
  ok(ownerSets.length > 0 && ownerSets.every((set) => set.weight !== 95),
     '⚠️ and nothing of the guest\'s is in it');
  ok(saved && saved.guestName === undefined, 'nor is it labelled as anybody else\'s');
  const gs = (await store.getGuestSessions()).filter((g) => g.workoutId === w.id);
  ok(gs.length === 1 && gs[0].guestName === 'Alex' && gs[0].entries[0].sets[0].weight === 95,
     '⚠️ the guest\'s session is saved under their name with their numbers');
  ok(/Also recorded for Alex/.test(document.getElementById('app').textContent),
     'the finish screen says the guest\'s half was saved too');
  ok(localStorage.getItem(DRAFT) === null, 'the draft is cleared after a multi-person save');

  /* ⚠️ AND THE IDENTITY PERSISTS. Tim, 2026-08-29: *"if you do create a new
   * person to your account, save them as an identity so you don't have to
   * recreate the same person over and over again each time you add them to a
   * workout."* Saved at the moment the name is typed, not at Finish — so an
   * abandoned session still costs the typing only once. */
  const roster = await store.getPeople();
  ok(roster.some((p) => p.name === 'Alex'),
     '⚠️ Alex is saved to the roster, so next time he is one tap rather than typed again');
  const alexRow = roster.find((p) => p.name === 'Alex');
  ok(gs[0].personId === alexRow.id,
     'and his session is filed under the identity\'s ID, not matched on the free text of his name');
}

/* ================= exercise pictures (2026-08-30) =================
 *
 * Tim: *"the picture should be shown wherever an exercise is named, right next
 * to the name… if the user clicks on the name of the exercise, it will pull up
 * the picture that takes up the screen and then the user can click an x in the
 * corner that will close the picture."*
 *
 * 🚨 THE FIRST ASSERTION IS THE ONE THAT MATTERS, and it is about ABSENCE.
 * There is no art in the repository — the style Tim wants is a paid stock
 * library and buying it is his call — so the feature had to ship ahead of the
 * pictures. That is only safe if a screen with no picture looks EXACTLY as it
 * did before: no placeholder, no broken-image box, no reserved gap. If that
 * ever stops being true, every screen in the app grows an empty square.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { MANIFEST } = await import(BASE + 'exercise-images.js');
  const DRAFT = 'ftrack:v1:draftSession';
  const bench = byName('Barbell Bench Press');

  const w = await store.saveWorkout({
    name: 'Picture day',
    exercises: [{ exerciseId: bench.id, sets: 1, notes: '' }],
  });

  // ---- with no art, which is the shipped state ----
  localStorage.removeItem(DRAFT);
  {
    const s = await mount(SessionView(w.id));
    ok(s.querySelectorAll('.ex-thumb').length === 0,
       '🚨 with no pictures bought, nothing renders a thumbnail');
    ok(s.querySelectorAll('.ex-label-btn').length === 0,
       'and no name becomes a button — the screen is byte-for-byte what it was');
    const head = s.querySelector('.session-ex-name');
    ok(head && head.tagName === 'H2' && head.textContent === 'Barbell Bench Press',
       'the heading is still a plain heading with the plain name');
  }

  // ---- now give that one exercise a picture ----
  MANIFEST[bench.id] = 'webp';
  try {
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    const thumb = s.querySelector('.session-ex-name')
      ? s.querySelector('.ex-label .ex-thumb') : null;
    ok(Boolean(thumb), 'once bought, the picture appears beside the name');
    ok(thumb && /img\/exercises\/barbell-bench-press--chest\.webp$/.test(thumb.getAttribute('src')),
       '⚠️ addressed by the exercise ID, not its name — two exercises share the name '
       + '"Cable Kickback" and only the id separates them');
    ok(thumb && thumb.getAttribute('alt') === '',
       'the thumbnail is decorative — its name is right beside it, so announcing it twice is noise');

    /* ⚠️ THE NAME IS THE BUTTON, which is what Tim asked for. Asserted by
     * CLICKING rather than by reading a class: a label that looks tappable and
     * does nothing is the exact fault this project shipped five times over in
     * one pass on 2026-08-29. */
    const label = s.querySelector('.ex-label-btn');
    ok(Boolean(label) && label.tagName === 'BUTTON', 'and the name is a real button');
    ok(/Show a picture of Barbell Bench Press/.test(label.getAttribute('aria-label') || ''),
       'named for a screen reader rather than left as a bare image');
    label.click();
    await settle();

    const viewer = document.querySelector('.exview');
    ok(Boolean(viewer), '⚠️ tapping it opens the full-screen picture');
    ok(viewer && viewer.getAttribute('role') === 'dialog'
       && viewer.getAttribute('aria-modal') === 'true', 'as a modal dialog');
    const big = viewer && viewer.querySelector('.exview-img');
    ok(big && big.getAttribute('src') === thumb.getAttribute('src'),
       'showing the same picture, at size');
    ok(big && /Barbell Bench Press/.test(big.getAttribute('alt') || ''),
       '⚠️ and THIS one carries the name in its alt — it is the content of the screen now, '
       + 'not a decoration beside a label');
    ok(/Barbell Bench Press/.test(viewer.textContent),
       'with the name on screen, so the picture is never context-free');

    const x = viewer.querySelector('.exview-close');
    ok(Boolean(x) && /Close/.test(x.getAttribute('aria-label') || ''),
       'and an ✕ in the corner, which is what Tim asked for');
    x.click();
    await settle();
    ok(!document.querySelector('.exview'), 'the ✕ closes it');

    // Escape too — the app's sheets all honour it and a modal that traps you is worse
    // than no modal.
    s.querySelector('.ex-label-btn').click();
    await settle();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    ok(!document.querySelector('.exview'), 'and so does Escape');

    /* 🚨 INSIDE A ROW THE THUMBNAIL IS NOT A CONTROL. A button inside a button
     * is invalid HTML and needs a stopPropagation that holds until somebody
     * adds the next control — `.set-del` and the people bar's ✕ both learned
     * that the hard way. The row keeps its own job. */
    s.querySelectorAll('.swap-btn')[0].click();
    await settle();
    const sheet = document.querySelector('.sheet');
    const rowThumb = sheet.querySelector('.search-results .ex-thumb');
    if (rowThumb) {
      ok(!rowThumb.closest('.ex-label-btn'),
         '🚨 a thumbnail inside a row is never itself a button');
      ok(rowThumb.closest('button.row'), 'the row is still the only control on the row');
    } else {
      ok(true, 'no shortlist row happens to have a picture, which is fine');
    }
    sheet.closest('.sheet-backdrop').remove();

    // Everywhere else it is named: the calendar day, the edit form, the picker.
    const { DayView } = await import(BASE + 'views-data.js');
    const { todayISO: today } = await import(BASE + 'store.js');
    await store.saveSession({
      workoutId: w.id, workoutName: 'Picture day', date: today(),
      entries: [{ exerciseId: bench.id, exerciseName: 'Barbell Bench Press',
                  sets: [{ weight: 185, reps: 5 }] }],
    });
    const day = await mount(DayView(today()));
    ok(day.querySelector('.detail-ex-name'), 'the calendar day still names the exercise');
    ok(day.querySelector('.ex-thumb'),
       '⚠️ and shows its picture there too — Tim asked for "wherever an exercise is named"');
  } finally {
    delete MANIFEST[bench.id];
    localStorage.removeItem(DRAFT);
  }
}

/* ============ taking somebody back OUT of the workout (2026-08-30) ============
 *
 * Tim: *"allow the user to also remove one of the people they're recording data
 * with in case it was just a test, or an accident, or something happened."*
 *
 * The two paths are the point, and they are `removeExercise`'s shape: an
 * accidental add has nothing recorded and goes quietly; a person with sets
 * behind them gets a confirm that says the count out loud. One tap must not be
 * able to destroy work somebody actually did.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const w = await store.saveWorkout({
    name: 'Remove-a-person day',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  const chips = () => [...s.querySelectorAll('.person-chip')];

  const addGuest = async (name) => {
    // ⚠️ By CLASS, not by its words: the add chip keeps the label "Add a person"
    // only while the session is solo, and drops to a bare + once somebody is on
    // the bar. A text matcher works for the first guest and silently fails for
    // the second, which is exactly the shape of bug that hides in a test helper.
    s.querySelector('.person-add').click();
    await settle(); await settle();
    [...document.querySelector('.sheet').querySelectorAll('button')]
      .find((b) => /Someone new/.test(b.textContent)).click();
    await settle();
    const inner = [...document.querySelectorAll('.sheet')].pop();
    inner.querySelector('input').value = name;
    [...inner.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click();
    await settle(); await settle();
  };

  await addGuest('Testy');
  ok(chips().some((b) => b.textContent.trim() === 'Testy'), 'a person can be added');

  /* ⚠️ THE ✕ IS ONLY ON THE PERSON YOU ARE ALREADY RECORDING FOR, and that is
   * the safety design rather than a layout economy: a destructive control is
   * never sitting next to a chip somebody is aiming at to SWITCH.
   *
   * ⚠️ ASSERTED WITH TWO GUESTS ON THE BAR, because with one it is true however
   * the code is written — the first version of this check passed against a
   * mutation that put a ✕ on every chip, which is a test that proves nothing. */
  const dels = () => [...s.querySelectorAll('.person-del')];
  await addGuest('Bystander');
  ok(chips().filter((b) => /Testy|Bystander/.test(b.textContent)).length === 2, 'two guests on the bar');
  ok(dels().length === 1, 'exactly one remove control with two people on the bar');
  ok(/Remove Bystander/.test(dels()[0].getAttribute('aria-label')),
     '⚠️ and it is on the ACTIVE person, named — a screen reader is never offered a bare ✕');
  // Back to Testy: the control follows the person being recorded for.
  chips().find((b) => b.textContent.trim() === 'Testy').click();
  await settle();
  ok(dels().length === 1 && /Remove Testy/.test(dels()[0].getAttribute('aria-label')),
     'switching moves the remove control with it');
  // Take the bystander back out through the same path, so the bar is left as
  // the assertions below expect.
  chips().find((b) => b.textContent.trim() === 'Bystander').click();
  await settle();
  dels()[0].click();
  await settle(); await settle();
  ok(!chips().some((b) => b.textContent.trim() === 'Bystander'), 'and removes the right one');
  chips().find((b) => b.textContent.trim() === 'Testy').click();
  await settle();

  // Nothing recorded: goes quietly, which is the accident Tim leads with.
  dels()[0].click();
  await settle(); await settle();
  ok(!chips().some((b) => b.textContent.trim() === 'Testy'),
     '⚠️ an accidental add with nothing recorded is removed on one tap — no confirm to read');
  ok(chips().find((b) => b.textContent.trim() === 'You').getAttribute('aria-pressed') === 'true',
     'and the screen falls back to You rather than pointing at somebody who has left');
  ok(!document.querySelector('.sheet'), 'no confirm sheet was raised for it');

  // With a set recorded: confirm, and it says the count.
  await addGuest('Sam');
  const sw = s.querySelector('.step-value');
  sw.value = '95';
  sw.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  dels()[0].click();
  await settle();
  const confirm = document.querySelector('.sheet');
  ok(Boolean(confirm) && /Remove Sam/.test(confirm.textContent),
     '⚠️ a person with recorded sets gets a confirm instead');
  ok(/1 set recorded for them will be deleted/.test(confirm.textContent),
     'and it says the count out loud rather than "are you sure?"');
  ok(/stay on your list of people/.test(confirm.textContent),
     '⚠️ and that their saved identity is NOT deleted — that is a different act with its own control');
  ok(chips().some((b) => b.textContent.trim() === 'Sam'),
     'and nothing has happened yet');
  [...confirm.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove').click();
  await settle(); await settle();
  ok(!chips().some((b) => b.textContent.trim() === 'Sam'), 'confirming removes them');

  // ⚠️ AND THE DRAFT FOLLOWS, or backgrounding the app brings them back.
  const draft = JSON.parse(localStorage.getItem(DRAFT) || '{}');
  ok(Array.isArray(draft.guestNames) && !draft.guestNames.includes('Sam'),
     '⚠️ the draft no longer holds them — otherwise a resume would resurrect somebody');
  ok(!draft.others || !draft.others.some((o) => o.name === 'Sam'),
     'nor their parked sets');

  // Finishing writes nothing for the person who was removed.
  const ow = s.querySelector('.step-value');
  ow.value = '185';
  ow.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle();
  const rows = (await store.getGuestSessions()).filter((g) => g.workoutId === w.id);
  ok(rows.length === 0,
     '🚨 and finishing saves NOTHING for either removed person — the sets were only ever in the draft');
}

/* ============ recording for a FRIEND, and sending it to their account ============
 *
 * Tim, 2026-08-29: *"my main want for this feature was so that one person could
 * record the details for two+ people that do have accounts… look up one of your
 * current friends and add them… then, once you're finished with the workout it
 * will send the workout to that user's account where they can accept it."*
 *
 * The load-bearing assertions are the two SEPARATIONS plus the send: their sets
 * never reach the owner's own training, the offer carries their uid, and — the
 * one that matters most — a FAILED send never costs the recording.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { social } = await import(BASE + 'store.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const original = { state: social.state, friend: social.friend, offerSession: social.offerSession };
  const restore = () => Object.assign(social, original);

  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me',
    name: 'Tim', shareBodyWeight: false,
    connections: [{ uid: 'u-autumn', name: 'Autumn', tier: 'mid', since: '2026-08-01' }],
  });
  // What she shares: a real session of her own, at the tier that carries sets.
  social.friend = async () => ({ tier: 'mid', doc: { activity: [{
    id: 'her-1', date: '2026-08-20', name: 'Push',
    entries: [{ exerciseId: byName('Barbell Bench Press').id, name: 'Barbell Bench Press',
                sets: [{ weight: 115, reps: 8 }] }],
  }] } });
  const offers = [];
  social.offerSession = async (uid, session, name) => { offers.push({ uid, session, name }); return true; };

  const w2 = await store.saveWorkout({
    name: 'Friend bench day',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
  });
  localStorage.removeItem(DRAFT);
  const s2 = await mount(SessionView(w2.id));

  const chips2 = () => [...s2.querySelectorAll('.person-chip')];
  chips2().find((b) => /Add a person/.test(b.textContent)).click();
  await settle(); await settle();
  const sheet2 = document.querySelector('.sheet');
  const autumnBtn = [...sheet2.querySelectorAll('button')].find((b) => /Autumn/.test(b.textContent));
  ok(Boolean(autumnBtn), '⚠️ a friend can be picked straight off the list — no name to invent');
  ok(/sent to them when you finish/i.test(sheet2.textContent),
     'and the row says what picking them will do, before it is done');
  autumnBtn.click();
  await settle(); await settle();

  const autumnChip = chips2().find((b) => /Autumn/.test(b.textContent));
  ok(Boolean(autumnChip) && autumnChip.getAttribute('aria-pressed') === 'true',
     'picking them adds them and switches to recording for them');
  ok(autumnChip.classList.contains('is-account'),
     '⚠️ their chip is marked as an account, because a friend\'s sets are going somewhere '
     + 'a guest\'s are not — and that is worth knowing BEFORE you finish');

  /* ⚠️ THE SUGGESTION IS BUILT FROM HER OWN TRAINING, not from the owner's and
   * not from nothing. This is the "switching names has to switch the whole
   * suggestion" rule (0e) reaching the case it was written for. */
  ok(/Last time/.test(s2.textContent) && /115/.test(s2.textContent),
     '⚠️ the screen prefills from HER shared training — 115, which is hers, not the owner\'s');
  ok(/training they share with you/i.test(s2.textContent),
     'and it says where that came from, so a blank one would be explainable rather than broken');

  const fw = s2.querySelector('.step-value');
  fw.value = '120';
  fw.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();

  chips2().find((b) => b.textContent.trim() === 'You').click();
  await settle();
  const ow = s2.querySelector('.step-value');
  ow.value = '185';
  ow.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...s2.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle(); await settle();

  ok(offers.length === 1 && offers[0].uid === 'u-autumn',
     '⚠️ finishing OFFERS her half to her account, addressed by uid rather than by her name');
  ok(offers[0].session.entries[0].sets[0].weight === 120,
     'and what is offered is what she lifted');
  const mine = (await store.getSessions()).find((x) => x.workoutId === w2.id);
  const mySets = (mine ? mine.entries : []).flatMap((e) => e.sets || []);
  ok(mySets.length && mySets.every((set) => set.weight !== 120),
     '⚠️ while none of hers is in the owner\'s own session');
  const herRow = (await store.getGuestSessions()).find((g) => g.workoutId === w2.id);
  ok(herRow && herRow.forUid === 'u-autumn',
     'the recorder keeps their own copy, stamped with whose it was');
  ok(/Sent to Autumn/.test(document.getElementById('app').textContent),
     'and the finish screen says it was sent, and that she adds it herself');

  /* ⚠️ THE ONE THAT MATTERS MOST: A FAILED SEND MUST NOT COST THE RECORDING.
   * The offer is a network write to somebody else's account and no signal in a
   * gym is the normal case. Telling somebody their workout was not saved, when
   * it was, would be the worse of the two lies. */
  social.offerSession = async () => { throw new Error('offline'); };
  const w3 = await store.saveWorkout({
    name: 'Friend bench day two',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
  });
  localStorage.removeItem(DRAFT);
  const s3 = await mount(SessionView(w3.id));
  [...s3.querySelectorAll('.person-chip')].find((b) => /Add a person/.test(b.textContent)).click();
  await settle(); await settle();
  [...document.querySelector('.sheet').querySelectorAll('button')]
    .find((b) => /Autumn/.test(b.textContent)).click();
  await settle(); await settle();
  const fw3 = s3.querySelector('.step-value');
  fw3.value = '125';
  fw3.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...s3.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle(); await settle();

  const failRow = (await store.getGuestSessions()).find((g) => g.workoutId === w3.id);
  ok(Boolean(failRow) && failRow.entries[0].sets[0].weight === 125,
     '⚠️ the send failed and her workout is STILL SAVED on this phone — a failed offer costs '
     + 'a tap on the calendar, never somebody\'s training');
  const finText = document.getElementById('app').textContent;
  ok(/Not sent/.test(finText),
     'the finish screen says so plainly rather than reporting success it did not have');
  ok(/Send this to Autumn/.test(finText),
     'and it names the way to retry, in the same line — otherwise it reads as work lost');
  ok(localStorage.getItem(DRAFT) === null,
     '⚠️ and the draft is still cleared: the SAVE worked, and only the send did not');

  /* ⚠️ REMOVING A FRIEND SAYS THE OTHER HALF (2026-08-30). Their session was
   * going to be offered to their own account at Finish, and after this it is
   * not — a consequence outside this phone, so it does not get to be implied. */
  {
    const w4 = await store.saveWorkout({
      name: 'Friend removal day',
      exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
    });
    localStorage.removeItem(DRAFT);
    const s4 = await mount(SessionView(w4.id));
    [...s4.querySelectorAll('.person-chip')].find((b) => /Add a person/.test(b.textContent)).click();
    await settle(); await settle();
    [...document.querySelector('.sheet').querySelectorAll('button')]
      .find((b) => /Autumn/.test(b.textContent)).click();
    await settle(); await settle();
    const fv = s4.querySelector('.step-value');
    fv.value = '130';
    fv.dispatchEvent(new window.Event('blur', { bubbles: false }));
    await settle();
    s4.querySelector('.person-del').click();
    await settle();
    const sheet4 = document.querySelector('.sheet');
    ok(Boolean(sheet4) && /no longer be sent to them/.test(sheet4.textContent),
       '⚠️ removing a FRIEND says their workout will no longer reach their account');
    ok(!/stay on your list of people/.test(sheet4.textContent),
       'and does not claim a saved identity that a friend never had');
    [...sheet4.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancel').click();
    await settle();
    ok([...s4.querySelectorAll('.person-chip')].some((b) => /Autumn/.test(b.textContent)),
       'cancelling leaves them in the workout');
    localStorage.removeItem(DRAFT);
  }

  restore();
  localStorage.removeItem(DRAFT);
}

/* ================= location on a session (0m) =================
   A typed label, carried forward from the last session, saved on the row,
   and never anything the app read from a sensor. */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { todayISO } = await import(BASE + 'store.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const w = await store.saveWorkout({
    name: 'Located day',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 1, notes: '' }],
  });

  // A prior session that carries a location — the newest row, so the runner's
  // carry-forward reads it.
  await store.saveSession({
    workoutId: w.id, workoutName: 'Located day', date: todayISO(),
    startedAt: new Date().toISOString(), location: 'The garage',
    entries: [{ exerciseId: byName('Barbell Bench Press').id, exerciseName: 'Barbell Bench Press',
      sets: [{ weight: 100, reps: 5 }] }],
  });

  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  const chip = s.querySelector('.session-loc');
  ok(Boolean(chip), 'the runner offers a location');
  ok(/The garage/.test(chip.textContent),
     'and it carries forward from the last session — one gym costs zero taps forever');
  const draft = JSON.parse(localStorage.getItem(DRAFT));
  ok(draft && draft.location === 'The garage', 'the carried label is on the draft');

  const wv = s.querySelector('.step-value');
  wv.value = '105';
  wv.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle();

  const rows = (await store.getSessions()).filter((x) => x.workoutId === w.id);
  const saved = rows.find((x) => x.entries[0].sets[0].weight === 105);
  ok(saved && saved.location === 'The garage', 'finishing saves the location on the session row');

  // And an emptied label is ABSENT on the next save, not an empty string.
  localStorage.removeItem(DRAFT);
  const s2 = await mount(SessionView(w.id));
  const draft2 = JSON.parse(localStorage.getItem(DRAFT));
  draft2.location = '';
  localStorage.setItem(DRAFT, JSON.stringify(draft2));
  const s3 = await mount(SessionView(w.id));
  const wv3 = s3.querySelector('.step-value');
  wv3.value = '110';
  wv3.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...s3.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle();
  const saved2 = (await store.getSessions()).find((x) => x.workoutId === w.id
    && x.entries[0].sets[0].weight === 110);
  ok(saved2 && !('location' in saved2), 'a cleared location saves NO key — absent, never ""');

  /* ⚠️ AND THE DEFAULT SURVIVES A WORKOUT LOGGED WITHOUT ONE (2026-08-29).
   *
   * Tim: *"if the user ever sets a location for that workout, have that be the
   * default and auto-filled in location for every workout they fill in after
   * that."* The old rule copied the most recent session's location INCLUDING
   * nothing, so the blank session just saved above would have reset the
   * default to empty and the next three workouts would have to be typed again.
   * A default that any single omission erases is not a default. */
  localStorage.removeItem(DRAFT);
  const s4 = await mount(SessionView(w.id));
  ok(/The garage/.test(s4.querySelector('.session-loc').textContent),
     '⚠️ the next workout still opens at The garage, even though the one before it was '
     + 'saved with no location at all — blank is "not this one", never "forget where I train"');

  // Typing a different gym is what moves it, and it moves immediately rather
  // than at Finish: somebody who types it and abandons the session has still
  // told the app where they train.
  const st = await import(BASE + 'store.js');
  await st.store.saveSettings({ defaultLocation: 'Iron Works' });
  localStorage.removeItem(DRAFT);
  const s5 = await mount(SessionView(w.id));
  ok(/Iron Works/.test(s5.querySelector('.session-loc').textContent),
     'and changing it is one edit that sticks from then on');
  await st.store.saveSettings({ defaultLocation: '' });
}

/* ================= personal bests on the finish screen =================
   The UX review's sharpest finding was that nothing anywhere celebrates
   anything. The block is Rule 5-safe — recorded vs recorded — and these pin
   the three cases that keep it honest: beaten, not beaten, nothing to beat. */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { todayISO } = await import(BASE + 'store.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const w = await store.saveWorkout({
    name: 'Press day',
    exercises: [{ exerciseId: byName('Overhead Press').id, sets: 1, notes: '' }],
  });

  const runWith = async (weight) => {
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    const wv = s.querySelector('.step-value');
    wv.value = String(weight);
    wv.dispatchEvent(new window.Event('blur', { bubbles: false }));
    await settle();
    [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
    await settle(); await settle();
    return document.getElementById('app');
  };

  // Nothing to beat: the first time ever logging a lift is not a record.
  const first = await runWith(100);
  ok(!first.querySelector('.finish-prs'),
     'the first time an exercise is ever logged is NOT called a personal best');

  // Beaten: a bigger recorded number than any recorded before.
  const beat = await runWith(105);
  ok(Boolean(beat.querySelector('.finish-prs')), 'typing a bigger number than ever before is celebrated');
  ok(/Overhead Press/.test(beat.querySelector('.finish-prs').textContent)
     && /105/.test(beat.querySelector('.finish-prs').textContent)
     && /up from 100/.test(beat.querySelector('.finish-prs').textContent),
     'and the line says the lift, the new number and what it beat');

  // Not beaten: an ordinary day stays an ordinary day.
  const ordinary = await runWith(95);
  ok(!ordinary.querySelector('.finish-prs'),
     'a set below the best is not congratulated — the trophy stays meaningful');
}

/* ================= body-map hit halos (0i) =================
   jsdom cannot hit-test, so what is pinned here is the STRUCTURE the design
   depends on: a halo per muscle, wired to the same pick, hidden from
   assistive tech, and — the load-bearing bit — every halo BEFORE every fill,
   because SVG hit-testing takes the topmost element and a halo may only win
   where no real muscle is painted. */
{
  const { bodySvg, MAPPED_MUSCLES } = await import(BASE + 'body-map.js');
  let picked = null;
  const svg = bodySvg(new Map(), null, (m) => { picked = m; });

  const halos = [...svg.querySelectorAll('.body-halo')];
  const fills = [...svg.querySelectorAll('.body-region')];
  ok(halos.length > 0 && halos.length === fills.length,
     `every muscle path has exactly one halo (${halos.length})`);
  ok(halos.every((h) => h.getAttribute('aria-hidden') === 'true' && !h.hasAttribute('tabindex')),
     'halos are invisible to assistive tech and the keyboard — the real paths are the controls');

  // Document order: within each view group, the last halo still precedes the
  // first fill, so no halo can ever sit on top of a painted muscle.
  const groups = [...svg.querySelectorAll('g[transform]')];
  ok(groups.length >= 2 && groups.every((view) => {
    const kids = [...view.children];
    const lastHalo = kids.map((n) => n.classList && n.classList.contains('body-halo')).lastIndexOf(true);
    const firstFill = kids.findIndex((n) => n.classList && n.classList.contains('body-region'));
    return lastHalo >= 0 && firstFill > lastHalo;
  }), '⚠️ every halo precedes every fill — enlargement can never steal a tap from a painted muscle');

  const trapsHalo = halos.find((h) => h.dataset.haloFor === 'Traps');
  ok(Boolean(trapsHalo), 'the smallest measured muscle has a halo');
  trapsHalo.dispatchEvent(new window.Event('click', { bubbles: true }));
  ok(picked === 'Traps', 'tapping a halo picks its muscle');
}

/* ================= the polish sweep (UX review leftovers) ================= */
{
  // Explore explains its numbers BEFORE the nine cards, not nine cards later.
  const { ExploreView } = await import(BASE + 'views-workouts.js');
  const ex = await mount(ExploreView());
  const kids = [...ex.querySelector('.pane-scroll').children];
  const listAt = kids.findIndex((n) => n.classList.contains('list'));
  const explainAt = kids.findIndex((n) => /stimulus the research supports/.test(n.textContent));
  ok(explainAt >= 0 && listAt > explainAt,
     'what the percentages mean is said ABOVE the list, before anyone compares nine of them');
  ok(/a system is just a programme you own/.test(ex.textContent),
     'the programme/system word swap is bridged in one sentence where the stranger is standing');
  ok(/Nothing real reaches 100/.test(ex.textContent),
     'and the full "what 100 % would mean" statement is still on the screen');

  // The backup dot means "something to lose AND not backed up" — both halves.
  const { HomeView } = await import(BASE + 'views-workouts.js');
  const withData = await mount(HomeView());
  await settle(); await settle();
  ok(withData.querySelector('.avatar-btn.at-risk'),
     'an unsecured account WITH training data carries the not-backed-up dot');

  await store.clearAll();
  const { clearReadCache } = await import(BASE + 'store.js');
  clearReadCache();
  const empty = await mount(HomeView());
  await settle(); await settle();
  ok(empty.querySelector('.avatar-btn') && !empty.querySelector('.avatar-btn.at-risk'),
     '⚠️ a brand-new empty account shows NO dot — a permanent warning is wallpaper, and this one now waits for something to be at risk');
}

/* ================= the colour palette setting (0k, Tim's pick) =================
   All three colourway options shipped as a Settings choice. Both directions
   are asserted — a one-way test passes just as well against a hard-coded
   attribute — and an unrecognised stored value degrades to the default. */
{
  const { SettingsView } = await import(BASE + 'views-data.js');
  const html = document.documentElement;

  const s1 = await mount(SettingsView());
  const chips = () => [...s1.querySelectorAll('.palette-chip')];
  ok(chips().length === 4, 'four colour choices: Gold, Teal, Indigo, Ember');
  ok(chips().every((c) => c.querySelector('.palette-dot')),
     'each chip shows its accent before it is chosen');
  const pressed = () => chips().find((c) => c.getAttribute('aria-pressed') === 'true');
  ok(pressed() && /Gold/.test(pressed().textContent), 'the original gold is the default');

  chips().find((c) => /Teal/.test(c.textContent)).click();
  await settle();
  ok(html.getAttribute('data-palette') === 'teal', 'picking Teal recolours the app instantly');
  ok((await store.getSettings()).palette === 'teal', 'and the choice is saved');

  chips().find((c) => /Gold/.test(c.textContent)).click();
  await settle();
  ok(!html.hasAttribute('data-palette'),
     '⚠️ picking Gold CLEARS the attribute — the default is bare :root, exactly what an untouched account renders');
  ok((await store.getSettings()).palette === 'gold', 'and that is saved too');

  // A stored value from the future (or a corrupted one) must not paint an
  // undefined palette — same fail-safe shape as social's tier normalisation.
  await store.saveSettings({ palette: 'neon' });
  const s2 = await mount(SettingsView());
  const p2 = [...s2.querySelectorAll('.palette-chip')].find((c) => c.getAttribute('aria-pressed') === 'true');
  ok(p2 && /Gold/.test(p2.textContent), 'an unrecognised stored palette degrades to Gold, never to nothing');
  await store.saveSettings({ palette: 'gold' });
}

/* ================= the Account screen owns the person (2026-08-26) =================
   Tim: the profile icon should show ALL account and profile details, back
   should go Home not Settings, and the account-ish rows should leave the
   Settings menu. Plus the profile photo. */
{
  const { AccountView } = await import(BASE + 'views-account.js');
  const { SettingsView } = await import(BASE + 'views-data.js');
  const text = (n) => n.textContent;

  const acct = await mount(AccountView());
  ok(/Add a photo|Change photo/.test(text(acct)), 'the Account screen offers a profile photo');
  ok(acct.querySelector('.avatar-face'), 'with a visible face slot');

  /* ⚠️ EDITING AN EXISTING PHOTO (Tim, 2026-08-27: "make a feature where you
   * can edit the profile picture though — resize, move the center circle").
   * The controls a photo does and does not carry are the testable half; the
   * canvas work is covered by image-crop's own sweep and by the CDP pass. */
  {
    const { store } = await import(BASE + 'store.js');
    const before = await store.getSettings();

    // No photo: nothing to edit, and offering it would be a dead button.
    await store.saveSettings({ avatar: '', avatarSource: '', avatarCrop: null });
    const empty = await mount(AccountView());
    const emptyBtns = [...empty.querySelectorAll('button')].map((b) => b.textContent.trim());
    ok(emptyBtns.includes('Add a photo'), 'with no photo the button reads "Add a photo"');
    ok(!emptyBtns.includes('Edit'), 'and there is no Edit button, because there is nothing to edit');
    ok(!emptyBtns.includes('Remove'), 'nor a Remove');

    // With one: Edit, Change, Remove — and Edit comes FIRST, because moving the
    // photo you already picked is the common errand.
    await store.saveSettings({
      avatar: 'data:image/jpeg;base64,AAAA',
      avatarSource: 'data:image/jpeg;base64,BBBB',
      avatarCrop: { zoom: 0.4, cx: 100, cy: 120 },
    });
    const withPhoto = await mount(AccountView());
    const btns = [...withPhoto.querySelectorAll('button')].map((b) => b.textContent.trim());
    ok(btns.includes('Edit'), 'with a photo saved there is an Edit button');
    ok(btns.includes('Change photo'), 'alongside Change photo');
    ok(btns.includes('Remove'), 'and Remove');
    ok(btns.indexOf('Edit') < btns.indexOf('Change photo'),
       'and Edit comes before Change photo — repositioning is the common errand');
    ok(/Edit to move or resize the circle/.test(text(withPhoto)),
       'and the help text says what Edit is for');

    // ⚠️ REMOVE MUST CLEAR ALL THREE. Leaving the source behind would let a
    // later Edit reopen a photo the account no longer has.
    const removeBtn = [...withPhoto.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Remove');
    removeBtn.click();
    await settle(); await settle();
    const cleared = await store.getSettings();
    ok(!cleared.avatar && !cleared.avatarSource && !cleared.avatarCrop,
       'Remove clears the face, the source and the crop together');

    await store.saveSettings({
      avatar: before.avatar || '', avatarSource: before.avatarSource || '',
      avatarCrop: before.avatarCrop || null,
    });
  }
  ok(/Your details/.test(text(acct)), 'the profile row lives on Account now');
  ok(/Download backup/.test(text(acct)) && /Restore from backup/.test(text(acct)),
     'and so do backup and restore');
  ok(/Delete all data/.test(text(acct)), 'and delete-all');

  // Back goes to the MAIN screen. Settings has its own button.
  const backBtn = acct.querySelector('.topbar .icon-btn');
  window.location.hash = '#/account';
  backBtn.click();
  await settle();
  // ⚠️ THE FALLBACK, and that is now what this asserts. Since 2026-09-02 the
  // arrow goes BACK through history and only uses the screen's own handler when
  // there is nothing behind it — which is the case here, because nothing in
  // this file drives the router that stamps a position on a history entry.
  ok(window.location.hash === '#/home', `Account's back falls back to Home, not Settings (${window.location.hash})`);

  const st = await mount(SettingsView());
  ok(!/Download backup/.test(text(st)) && !/Delete all data/.test(text(st)),
     'Settings no longer carries the data controls');
  ok(/Account & profile/.test(text(st)),
     'but keeps one pointer row, so nobody who always found them here is stranded');
  ok(/Goals/.test(text(st)), 'and Goals stays — it is not an account detail');

  // The photo: store a tiny data URL directly (the canvas resize path needs a
  // real browser) and confirm both the Account face and the top-left button
  // wear it.
  const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  await store.saveSettings({ avatar: PIXEL });
  const acct2 = await mount(AccountView());
  const faceImg = acct2.querySelector('.avatar-face img');
  ok(faceImg && faceImg.getAttribute('src') === PIXEL, 'a stored photo shows on the Account screen');
  ok(/Change photo/.test(text(acct2)) && /Remove/.test(text(acct2)),
     'and the controls flip to change/remove');

  const { HomeView } = await import(BASE + 'views-workouts.js');
  const home = await mount(HomeView());
  await settle(); await settle();
  const btnImg = home.querySelector('.avatar-btn .avatar-img');
  ok(btnImg && btnImg.getAttribute('src') === PIXEL,
     'the top-left account button wears the photo everywhere');
  await store.saveSettings({ avatar: '' });
}

/* ================= Record is a category chooser (2026-08-26) =================
   Tim: "when you open Record, it should show you maybe a few options to
   categorize different types of workouts, and one of them is weightlifting,
   which leads you to the current page." */
{
  const { RecordChooserView, StartPickerView } = await import(BASE + 'views-workouts.js');
  const { ActivityLogView } = await import(BASE + 'views-session.js');

  const chooser = await mount(RecordChooserView());
  ok(/Weightlifting/.test(chooser.textContent), 'Weightlifting is one of the options');
  const lift = [...chooser.querySelectorAll('button')].find((b) => /Weightlifting/.test(b.textContent));
  ok(lift && lift.classList.contains('primary'),
     'and it is the biggest — lifting is still the common case and must not slow down');
  for (const label of ['Run', 'Swim', 'Cycle', 'Climb', 'Something else']) {
    ok(new RegExp(label).test(chooser.textContent), `the chooser offers ${label}`);
  }
  ok(/never rated|ratings still come from lifting/i.test(chooser.textContent),
     'and says plainly that activities are recorded, not rated');
  lift.click();
  await settle();
  ok(window.location.hash === '#/start', 'Weightlifting leads to the full recorder');

  // The full recorder now shows a time estimate per workout. (An earlier
  // block clears all data, so seed one workout for the row to estimate.)
  await store.saveWorkout({
    name: 'Timed day',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 10, notes: '' }],
  });
  const picker = await mount(StartPickerView({ tab: false }));
  ok(/~30 min/.test(picker.textContent),
     'each workout row carries a rounded time estimate (10 sets × 3 min before any recording exists)');

  // The quick activity log saves a REAL session.
  const before = (await store.getSessions()).length;
  const act = await mount(ActivityLogView('Running'));
  ok(/Running/.test(act.textContent), 'the preset activity is filled in');
  const timeStep = [...act.querySelectorAll('.step-value')];
  ok(timeStep.length >= 1, 'time and distance steppers render');
  const tv = act.querySelector('.step-value');
  tv.value = '30';
  tv.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();
  [...act.querySelectorAll('button')].find((b) => /Save activity/.test(b.textContent)).click();
  await settle(); await settle();
  const sessions = await store.getSessions();
  ok(sessions.length === before + 1, 'saving an activity writes one session');
  const run = sessions.find((x) => x.workoutName === 'Running');
  ok(run && run.entries.length === 1 && run.entries[0].exerciseName === 'Running',
     'a real session row, one entry, under the activity\'s name — calendar, feed and backups all see it');
  ok(!('workoutId' in run) || !run.workoutId,
     'and it points at no workout, so the rotation suggestion skips it rather than choking');
  await store.deleteSession(run.id);
}


/* ================= the Friends screen paints before the network answers =====
 *
 * Tim, 2026-08-26, on an iPhone: *"whenever I click on friends in the home menu,
 * it has a long delay and lag to it that's alarming."*
 *
 * ⚠️ THE ROUTER AWAITS THE VIEW BEFORE IT SWAPS THE DOM (app.js render()), so
 * anything SocialView awaits is time during which the PREVIOUS screen is still
 * under his thumb and the tap looks ignored. The fix was to stop awaiting the
 * fill — and the way that silently comes back is somebody adding one innocent
 * `await` at the top of the view.
 *
 * So this test hands it a network that NEVER ANSWERS. If the screen still
 * arrives, the paint does not depend on the fetch. If somebody re-awaits the
 * fill, this hangs — which the race below turns into a failure rather than a
 * hung suite.
 */
{
  const { SocialView } = await import(BASE + 'views-social.js');
  const { social } = await import(BASE + 'store.js');

  const original = {
    state: social.state, invites: social.invites,
    friend: social.friend, healConnectionName: social.healConnectionName,
  };
  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me',
    name: 'Tim', shareBodyWeight: false,
    connections: [{ uid: 'u1', name: 'Autumn', tier: 'light', since: '2026-08-01' }],
  });
  // The hang: reads that are issued and never come back, which is what a dead
  // cellular connection actually looks like from the page's side.
  social.invites = () => new Promise(() => {});
  social.friend = () => new Promise(() => {});
  social.healConnectionName = () => new Promise(() => {});

  const raced = await Promise.race([
    SocialView().then((node) => ({ node })),
    new Promise((r) => setTimeout(() => r({ timedOut: true }), 1500)),
  ]);

  ok(!raced.timedOut, 'the Friends screen renders while the network is still hanging');
  if (!raced.timedOut) {
    const t = raced.node.textContent.replace(/\s+/g, ' ');
    ok(/Friends/.test(t), 'and it is the Friends screen, header and all');
    ok(/You appear as Tim/.test(t),
       'with what it already knows on it — the parts that needed no fetch');
    ok(Boolean(raced.node.querySelector('.btn.primary')),
       'and its Invite button, so the screen is usable before the list arrives');
  }

  Object.assign(social, original);
}


/* ================= pace, shown and never judged =========================
 * docs/activities-plan.md §3 item 2. Division, not a model — so the only ways
 * it can be wrong are arithmetic, and refusing to divide by nothing.
 */
{
  const { pace, fmtSet } = await import(BASE + 'ui.js');
  const DT = ['distance', 'time'];

  ok(pace({ distance: 3, time: 1800 }, DT) === '10:00 /mi', '3 miles in 30 minutes is 10:00 /mi');
  ok(pace({ distance: 1, time: 443 }, DT) === '7:23 /mi', 'and it carries the seconds properly');
  ok(pace({ distance: 6.2, time: 3000 }, DT) === '8:04 /mi', 'a 10k at 50 minutes');

  // ⚠️ The refusals. A back-dated log with one field filled in is normal, and
  // "Infinity /mi" on somebody's calendar is the kind of thing that reads as
  // the app being broken.
  ok(pace({ distance: 0, time: 1800 }, DT) === '', 'no distance, no pace — never a division by zero');
  ok(pace({ time: 1800 }, DT) === '', 'a missing distance is silent rather than NaN');
  ok(pace({ distance: 3 }, DT) === '', 'and a missing time is too');
  ok(pace({ distance: 3, time: 1800 }, ['weight', 'reps']) === '',
     'a lift never gets a pace, however its numbers happen to divide');
  ok(pace({ distance: 0.01, time: 3600 }, DT) === '',
     'and an implausible one is withheld rather than printed as 100:00 /mi');

  // It rides on the same line as the numbers it came from.
  const line = fmtSet({ distance: 3, time: 1800 }, DT, null);
  ok(/3\.00 mi/.test(line) && /30:00/.test(line) && /10:00 \/mi/.test(line),
     'the day view shows distance, time and pace together');
  // ⚠️ Rule 6: it is a string on the line, not a class that could be coloured.
  ok(typeof line === 'string' && !/good|bad|fast|slow/i.test(line),
     'and it passes no judgement on whether that pace was any good');
}


/* ================= handoffs and mutual disconnect (0e friend half, 0j) =====
 *
 * ⚠️ WHAT CAN AND CANNOT BE TESTED HERE. The permissions live in
 * firestore.rules and are tested against the real engine in rules.test.mjs —
 * that is where "a stranger cannot offer a workout" is proved. What jsdom can
 * prove is the half the rules cannot: that nothing is written into the
 * recipient's training until they tap Add, that declining writes nothing at
 * all, and that the screen says which of the two happened.
 */
{
  const { SocialView, FriendView } = await import(BASE + 'views-social.js');
  const { social, store } = await import(BASE + 'store.js');

  const original = {
    state: social.state, invites: social.invites, handoffs: social.handoffs,
    friend: social.friend, healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    acceptHandoff: social.acceptHandoff, declineHandoff: social.declineHandoff,
    remove: social.remove, setTier: social.setTier,
  };
  const restore = () => Object.assign(social, original);

  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me',
    name: 'Tim', shareBodyWeight: false,
    connections: [{ uid: 'u1', name: 'Autumn', tier: 'light', since: '2026-08-01' }],
  });
  social.invites = async () => [];
  social.friend = async () => ({ tier: 'light', doc: null });
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.handoffs = async () => [{
    id: 'h_g1', from: 'u1', fromName: 'Autumn',
    session: {
      date: '2026-08-26', workoutName: 'Push',
      entries: [{ exerciseName: 'Bench Press', sets: [{ weight: 135, reps: 8 }] }],
    },
  }];

  let accepted = 0;
  let declined = 0;
  social.acceptHandoff = async () => { accepted++; return {}; };
  social.declineHandoff = async () => { declined++; return true; };

  const before = (await store.getSessions()).length;
  const soc = await mount(SocialView());
  await settle(); await settle();
  const t = soc.textContent.replace(/\s+/g, ' ');

  ok(/Recorded for you/.test(t), 'a workout somebody logged for you appears on Friends');
  ok(/Autumn logged this for you/.test(t), 'and it names who logged it — whose word you are taking');
  ok(/Bench Press/.test(t), 'and what is in it, before you decide');
  ok((await store.getSessions()).length === before,
     '⚠️ and NOTHING is in your training yet — an offer is an offer until you accept it');

  const addBtn = [...soc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add');
  ok(Boolean(addBtn), 'there is an Add button');
  addBtn.click();
  await settle(); await settle();
  ok(accepted === 1, 'tapping Add accepts it through the store, which writes to YOUR OWN account');

  const soc2 = await mount(SocialView());
  await settle(); await settle();
  const noBtn = [...soc2.querySelectorAll('button')].find((b) => b.textContent.trim() === 'No');
  ok(Boolean(noBtn), 'and a way to turn it down');
  noBtn.click();
  await settle(); await settle();
  ok(declined === 1 && (await store.getSessions()).length === before,
     '⚠️ declining writes nothing at all — not to your training, not anywhere');

  /* ---- somebody disconnected FROM me ---- */
  social.handoffs = async () => [];
  social.processDisconnects = async () => 2;
  const soc3 = await mount(SocialView());
  await settle(); await settle();
  ok(/2 people disconnected from you/.test(soc3.textContent.replace(/\s+/g, ' ')),
     'somebody leaving is SAID, not silent — a name vanishing off the list reads as lost data');

  /* ---- the disconnect sheet, which has been wrong before ---- */
  social.processDisconnects = async () => 0;
  let toldFlag = true;
  social.remove = async () => ({ removed: true, told: toldFlag });
  social.setTier = async () => ({});
  social.friend = async () => ({ tier: 'light', doc: { profile: { name: 'Autumn' }, activity: [] } });

  const friend = await mount(FriendView('u1'));
  await settle(); await settle();
  const disconnect = [...friend.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === 'Disconnect');
  ok(Boolean(disconnect), 'a friend page offers Disconnect');
  disconnect.click();
  await settle();
  const sheet = document.querySelector('.sheet');
  const sheetText = sheet ? sheet.textContent.replace(/\s+/g, ' ') : '';
  ok(/no longer be able to see anything of yours/.test(sheetText),
     'the sheet says what it does to your side');
  ok(/They are told/.test(sheetText),
     '⚠️ and that they are TOLD — the half that makes it mutual (0j, built 2026-08-27)');
  ok(/Until then/.test(sheetText),
     '⚠️ and that it is EVENTUAL rather than instant, because their document is theirs to rewrite');
  ok(!/only cuts YOUR side/.test(sheetText),
     'the old one-sided wording is gone, because it is no longer true');
  document.querySelector('.sheet-backdrop')?.remove();

  restore();
}


/* ============ finding people: search, requests, and the code (2026-08-29) ============
 *
 * 🚨 The search half reverses a decision this project made on purpose. The
 * argument is in js/social.js's "Finding people by name" header and above the
 * `directory` block in firestore.rules; Tim took the trade knowingly with fewer
 * than five users on the site. These assertions are about the SCREENS — that a
 * request is an ask rather than a connection, and that the code is a code.
 */
{
  const { SocialView, FindView, AddView } = await import(BASE + 'views-social.js');
  const { social } = await import(BASE + 'store.js');

  const original = {
    state: social.state, invites: social.invites, handoffs: social.handoffs,
    friend: social.friend, healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    processAcceptedRequests: social.processAcceptedRequests,
    requests: social.requests, searchPeople: social.searchPeople,
    personByUid: social.personByUid, sendRequest: social.sendRequest,
    acceptRequest: social.acceptRequest, declineRequest: social.declineRequest,
    withdrawRequest: social.withdrawRequest,
  };
  const restore = () => Object.assign(social, original);

  const DIR = [
    { uid: 'u-sami', name: 'Samira Okonkwo' },
    { uid: 'u-sam', name: 'Sam Whitfield-Brookes' },
    { uid: 'u-jo', name: 'Jo Sampson' },
  ];
  let asked = [];
  let accepted = null;
  let declined = null;
  let joinedCount = 0;

  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim H',
    shareBodyWeight: false,
    connections: [{ uid: 'u-jo', name: 'Jo Sampson', tier: 'light', since: '2026-08-01' }],
  });
  social.invites = async () => [];
  social.handoffs = async () => [];
  social.friend = async () => ({ tier: 'light', doc: null });
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => joinedCount;
  social.requests = async () => [{ uid: 'u-sami', name: 'Samira Okonkwo' }];
  social.searchPeople = async (q) => {
    const { rankMatches } = await import(BASE + 'social.js');
    return rankMatches(DIR, q).map((r) => ({
      uid: r.uid, name: r.name,
      state: r.uid === 'u-jo' ? 'connected' : (asked.includes(r.uid) ? 'asked' : 'none'),
    }));
  };
  social.personByUid = async (uid) => {
    const r = DIR.find((x) => x.uid === uid);
    return r ? { uid: r.uid, name: r.name, state: 'none' } : null;
  };
  social.sendRequest = async (uid) => { asked.push(uid); return true; };
  social.withdrawRequest = async (uid) => { asked = asked.filter((x) => x !== uid); return true; };
  social.acceptRequest = async (uid) => { accepted = uid; return true; };
  social.declineRequest = async (uid) => { declined = uid; return true; };

  /* ---- somebody asked to connect ---- */
  {
    const s = await mount(SocialView());
    await settle(); await settle();
    ok(/Asked to connect/i.test(s.textContent),
       'an incoming request gets its own heading, separate from "Waiting for you"');
    ok(/Samira Okonkwo/.test(s.textContent), 'and names who asked');
    ok(/can see everything you have recorded/i.test(s.textContent),
       '⚠️ and says what accepting would actually give them — a request is a decision, not a '
       + 'notification to dismiss. ⚠️ IT SAYS MORE THAN IT USED TO, because accepting now gives '
       + 'more: this line read "they start on just that I trained" until 2026-09-03, and a '
       + 'sentence that understates what a tap hands over is worse than no sentence');

    const row = [...s.querySelectorAll('.row')].find((r) => /Samira/.test(r.textContent));
    const no = [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'No');
    ok(Boolean(no), '⚠️ No is offered beside Add, as an equal choice — this was unsolicited');
    no.click(); await settle();
    ok(declined === 'u-sami', 'declining goes through the store');
    ok(accepted === null,
       '⚠️ and declining connects NOBODY — the one thing that must never happen by accident');
  }

  /* ---- accepting one ---- */
  {
    accepted = null;
    const s = await mount(SocialView());
    await settle(); await settle();
    const row = [...s.querySelectorAll('.row')].find((r) => /Samira/.test(r.textContent));
    [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click();
    await settle();
    ok(accepted === 'u-sami', 'Add connects them');
  }

  /* ⚠️ AND WHEN SOMEBODY ACCEPTS MINE, IT IS SAID OUT LOUD. A name appearing
   * on the friends list with no explanation is as confusing as one vanishing —
   * the same reason a disconnect is announced. This is good news that would
   * otherwise go completely unnoticed, because acceptance is learned by a
   * silent background probe rather than by any message. */
  {
    joinedCount = 2;
    const s = await mount(SocialView());
    await settle(); await settle();
    ok(/2 people accepted your requests/.test(s.textContent),
       '⚠️ requests that were accepted are announced — acceptance arrives with no message '
       + 'of its own, so the screen is the only place it can be said');
    joinedCount = 0;
  }

  /* ---- searching ---- */
  {
    asked = [];
    const s = await mount(FindView());
    await settle();
    ok(/Search by name/i.test(s.textContent), 'the Add-a-friend screen leads with search');
    const input = s.querySelector('input[type="search"]');
    ok(Boolean(input), 'and it is a real search field');

    input.value = 'sam';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    await settle(); await settle();

    const titles = [...s.querySelectorAll('.row-title')].map((n) => n.textContent);
    ok(titles.length === 3, `"sam" finds three of the three (${titles.join(', ')})`);
    ok(titles[0] === 'Samira Okonkwo',
       '⚠️ ranked: the shortest whole-name prefix leads, so the likeliest person is the top row');
    ok(titles[2] === 'Jo Sampson', 'and a surname match sorts last — it is a weaker signal');

    const joRow = [...s.querySelectorAll('.row')].find((r) => /Jo Sampson/.test(r.textContent));
    ok(/Friends/.test(joRow.textContent) && !joRow.querySelector('button'),
       '⚠️ somebody already connected is SHOWN and flagged, not filtered out — "you are already '
       + 'friends" and "no such person" are different answers, and dropping them silently is '
       + 'the worse one');

    const samiRow = [...s.querySelectorAll('.row')].find((r) => /Samira/.test(r.textContent));
    samiRow.querySelector('button').click();
    await settle(); await settle();
    ok(asked.includes('u-sami'), 'Add sends a request');
    const after = [...s.querySelectorAll('.row')].find((r) => /Samira/.test(r.textContent));
    ok(/Asked/.test(after.textContent),
       '⚠️ and the row flips to "Asked" rather than "Friends" — asking is not connecting, and a '
       + 'screen that said otherwise would be claiming a connection the other person has not made');
  }

  /* ---- the code, and where it lands ---- */
  {
    const s = await mount(FindView());
    await settle();
    [...s.querySelectorAll('button')].find((b) => /Show my code/.test(b.textContent)).click();
    await settle();
    const sheet = [...document.querySelectorAll('.sheet')].pop();
    const svg = sheet.querySelector('.qr-card svg');
    ok(Boolean(svg), 'a code renders as an SVG, drawn in the app rather than fetched');
    ok(sheet.querySelector('.qr-card rect').getAttribute('fill') === '#fff'
       && sheet.querySelector('.qr-card path').getAttribute('fill') === '#000',
       '⚠️ black on white, hard-coded, never a theme token — plenty of Android scanners fail on '
       + 'an inverted code, and a code that fails on somebody else\'s phone fails at the one '
       + 'moment it exists for');
    const vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
    ok(vb[2] === vb[3] && vb[2] > 8,
       '⚠️ and the quiet zone is INSIDE the viewBox — four modules a side, so putting the code on '
       + 'a coloured card cannot eat the margin the spec requires');
    ok(/never expires/.test(sheet.textContent),
       'the sheet says the code is permanent, which is what makes it different from an invite link');
    [...sheet.querySelectorAll('button')].forEach((b) => { if (/close/i.test(b.getAttribute('aria-label') || '')) b.click(); });
  }

  {
    const s = await mount(AddView('u-sam'));
    await settle(); await settle();
    ok(/Sam Whitfield-Brookes/.test(s.textContent),
       'landing on somebody\'s code shows WHO it is');
    ok(/Nothing of yours is shared until they do/.test(s.textContent),
       'and that nothing is shared until they accept');
    const ask = [...s.querySelectorAll('button')].find((b) => /Ask to connect/.test(b.textContent));
    ok(Boolean(ask),
       '⚠️ it ASKS rather than connecting on arrival — a code can be scanned by accident or '
       + 'forwarded by anybody, so the holder is not necessarily who it was meant for');
  }

  {
    const s = await mount(AddView('u-nobody'));
    await settle(); await settle();
    ok(/did not match anybody/i.test(s.textContent),
       'a code for somebody who is no longer findable says so, rather than showing a blank row');
  }

  restore();
}


/* ============ the finish screen: one action, and a way back (2026-08-29) ============
 *
 * Tim, two asks in one message: *"keep the back button in case they wanted to
 * quickly change something or accidentally clicked on the finish workout
 * button"*, and *"instead of having 2 buttons: 'view workout' and 'back to
 * home', just display this workout and then keep the back to home."*
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const w = await store.saveWorkout({
    name: 'Finish screen day',
    exercises: [
      { exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' },
      { exerciseId: byName('Barbell Curl').id, sets: 1, notes: '' },
    ],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));

  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  type(s.querySelectorAll('.step-value')[0], 185);
  await settle();
  type(s.querySelectorAll('.step-value')[1], 5);
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Next exercise/.test(b.textContent)).click();
  await settle();
  type(s.querySelectorAll('.step-value')[0], 60);
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle(); await settle();

  const app = document.getElementById('app');
  ok(/Nice work/.test(app.textContent), 'the finish screen is up');

  /* ⚠️ ONE ACTION. Two primary-looking buttons where there is one thing to do
   * next is a choice the screen was inventing for itself. */
  const actions = [...app.querySelectorAll('.btn.block')];
  ok(actions.length === 1 && /Back to home/.test(actions[0].textContent),
     `⚠️ one action, and it is Back to home (${actions.map((b) => b.textContent.trim()).join(', ')})`);
  ok(!/View this workout/.test(app.textContent),
     '⚠️ "View this workout" is gone — it led to a screen describing what this screen had '
     + 'already summarised in one line');

  /* ...because the workout is ON this screen instead. */
  const rec = app.querySelector('.finish-record');
  ok(Boolean(rec), 'the workout is displayed here rather than behind a tap');
  const names = [...rec.querySelectorAll('.finish-ex-name')].map((n) => n.textContent);
  ok(names.length === 2 && /Bench/.test(names[0]) && /Curl/.test(names[1]),
     `every exercise recorded is listed, in the order it was done (${names.join(', ')})`);
  ok(/185/.test(rec.textContent) && /60/.test(rec.textContent),
     'with the real numbers, so it is a receipt rather than a count');
  ok(rec.querySelectorAll('.finish-set').length === 2,
     '⚠️ and only the sets that were RECORDED — the second bench set was never touched, and a '
     + 'receipt listing a set nobody did is the same lie the save path refuses to tell '
     + `(${rec.querySelectorAll('.finish-set').length} shown)`);

  /* ⚠️ AND A WAY BACK OFF IT. It goes to the EDIT FORM, not into the runner:
   * the session is already saved by the time this screen exists, so "undo the
   * finish" would mean deleting a stored session on the one screen somebody
   * just tapped by accident. */
  const back = app.querySelector('[aria-label="Back"]');
  ok(Boolean(back),
     '⚠️ there is a back button — an accidental tap on Finish must not be a one-way door');
  /* ⚠️ CLICKED, not read off an href. `screenShell` passes `back` to iconBtn as
   * an onClick, and el() silently ignores a non-function `onX` — so a string
   * renders a back button that does nothing. Asserting on the attribute would
   * have passed over exactly that bug; clicking it is what caught it. */
  back.click();
  await settle();
  const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
  ok(saved && location.hash === `#/edit/${saved.id}`,
     `⚠️ and it opens THIS session's record for editing (${location.hash}) — every part of what `
     + 'was recorded is changeable there, which is what "quickly change something" needs');

  localStorage.removeItem(DRAFT);
}


/* ============ an exercise you have never done (2026-08-29) ============
 *
 * Tim: *"If a user has added a new exercise that they've never done before,
 * instead of setting the weight and rep number to 0, put the amount to a
 * beginner amount of weight and an average number of reps (maybe 10). Add a
 * note that this is their first recording and they should change it."*
 *
 * ⚠️ THE SAFETY ASSERTION IS THE POINT OF THIS BLOCK. `finish()` saves any set
 * with a number in it, so filling one in without a guard would record a workout
 * nobody did — and until this shipped, a never-done exercise prefilling ZERO
 * was the one case that could not happen.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  /* ---- no history anywhere: reps only, and NOTHING is recorded ---- */
  {
    const w = await store.saveWorkout({
      name: 'Brand new lift',
      exercises: [{ exerciseId: byName('Drag Curl').id, sets: 2, notes: '' }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    /* ⚠️ THE NOTE IS GONE AND THE GUARD IS NOT — 2026-08-31. Tim: *"Remove the
     * 'Suggested: …' description at the top of the workout, as well as the
     * 'First time logging this…', '10 reps…' feature right now. It's very wordy
     * and I think we can improve it later."* What came off is the PROSE. The
     * opening numbers, the `prefilled` flag and finish()'s refusal to record an
     * untouched set are all still here, and are what the rest of this block
     * checks — because with nothing on screen to say the number was worked out,
     * the flag is the only thing keeping the app honest about it. */
    ok(!/First time logging this|starting point, not a measurement/.test(s.textContent),
       '🚨 no first-time paragraph anywhere on the screen');
    ok(!/Suggested:/.test(s.textContent), 'and no "Suggested:" block either');
    const reps = Number(s.querySelectorAll('.step-value')[1].value);
    ok(reps === 10,
       `⚠️ reps open at 10, not 0 (${reps}) — and 10 is the app's OWN default: repRangeFor() `
       + 'falls back to the 8-12 band, and 10 is the only round number strictly inside it');

    const draft = JSON.parse(localStorage.getItem(DRAFT));
    ok(draft.entries[0].sets.every((set) => set.prefilled === true),
       '⚠️ and every opening set is MARKED, because a set carrying a number is a set finish() '
       + 'would otherwise save');

    // Walk straight to Finish without touching anything — the exact path that
    // would record a workout nobody did.
    [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
    await settle(); await settle();
    ok(/Nothing recorded/i.test(document.getElementById('app').textContent)
       || !(await store.getSessions()).some((x) => x.workoutId === w.id),
       '🚨 TAPPING FINISH WITHOUT TOUCHING A NUMBER RECORDS NOTHING. The reps the app filled in '
       + 'are a starting point, not a claim that ten of them happened');
    localStorage.removeItem(DRAFT);
  }

  /* ---- touch it, and it becomes real ---- */
  {
    const w = await store.saveWorkout({
      name: 'Brand new lift two',
      exercises: [{ exerciseId: byName('Concentration Curl').id, sets: 1, notes: '' }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    const wt = s.querySelectorAll('.step-value')[0];
    wt.value = '45';
    wt.dispatchEvent(new window.Event('blur', { bubbles: false }));
    await settle();

    const draft = JSON.parse(localStorage.getItem(DRAFT));
    ok(draft.entries[0].sets[0].prefilled === undefined,
       '⚠️ one keystroke clears the flag — touching a number is what makes the set theirs');

    [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
    await settle(); await settle();
    const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
    ok(saved && saved.entries[0].sets[0].weight === 45,
       'and now it saves, at what they typed');
    ok(saved && saved.entries[0].sets[0].reps === 10,
       '⚠️ carrying the reps they left alone — they were on screen, they were accepted, and '
       + 'the set as a whole is now a record');
    ok(saved && !('prefilled' in saved.entries[0].sets[0]),
       'and the runtime flag never reaches storage');
    localStorage.removeItem(DRAFT);
  }

  /* ---- a WEIGHT is derived from what they have already lifted ---- */
  {
    /* ⚠️ A COMPLETE PROFILE IS A REAL GATE ON THIS, not test scaffolding.
     * `muscleStrength()` returns `ready: false` without gender, birth year and
     * a body weight — the same reason the body map is grey for that account —
     * so no weight can be derived either, and the screen falls back to the
     * reps-only note. That is the honest behaviour rather than a gap. */
    await store.saveSettings({ gender: 'male', birthYear: 1998 });
    await store.logBodyWeight(180, '2026-08-01');

    // A real bench press history, so Chest is rated well enough to speak.
    const bench = byName('Barbell Bench Press').id;
    for (const d of ['2026-08-10', '2026-08-14', '2026-08-18']) {
      await store.saveSession({
        workoutName: 'Push', date: d, startedAt: `${d}T10:00:00.000Z`,
        entries: [{ exerciseId: bench, exerciseName: 'Barbell Bench Press',
          sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }] }],
      });
    }
    // Now a chest lift they have never done.
    const w = await store.saveWorkout({
      name: 'New chest lift',
      exercises: [{ exerciseId: byName('Close-Grip Bench Press').id, sets: 1, notes: '' }],
    });
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));

    const opened = Number(s.querySelectorAll('.step-value')[0].value);
    ok(opened > 0,
       `⚠️ the weight opens at a real number (${opened}) — derived from their own bench press by `
       + 'the same published ratio the body map uses, run backwards. Not a beginner constant, '
       + 'and not the 5th percentile of people who lift, which is not a fact about this person');
    ok(opened < 185,
       `and it is BELOW their flat bench (${opened} vs 185), which is what a close-grip press should be`);

    ok(!s.querySelector('.prefill-note'),
       '⚠️ and it does NOT wear the green check that means "last time" — that cue belongs to a '
       + 'recorded measurement, and an inference borrowing it is exactly what Rule 5 forbids. '
       + 'The sentence that used to spell that out came off on 2026-08-31; the flag below is '
       + 'what carries the guarantee now');

    // Untouched, it still records nothing.
    [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
    await settle(); await settle();
    ok(!(await store.getSessions()).some((x) => x.workoutId === w.id),
       '🚨 and a DERIVED WEIGHT untouched is still not a record — the guard covers the number '
       + 'that would otherwise be most convincing');
    localStorage.removeItem(DRAFT);
  }
}

/* ============ today's exercises: reorder, add, remove (2026-08-31) ============
 *
 * Tim: *"you can remove a exercise or swap an exercise, but you can't add an
 * exercise or rearrange exercises for a different order… put a view full workout
 * button somewhere… and you can add an exercise, remove one, or drag an exercise
 * to another position… If any information has already been recorded for any of
 * the exercises, keep the information tied to that exercise, but also allow it
 * to be moved."*
 *
 * ⚠️ THE LOAD-BEARING ONE IS THE LAST CLAUSE, and it is checked against the
 * SAVED SESSION rather than against the screen: a reorder that looks right and
 * writes somebody's squat sets under their curl is worse than one that visibly
 * does nothing.
 *
 * ⚠️ THE ARROWS ARE WHAT THESE DRIVE, and that is not a shortcut. jsdom reports
 * every rectangle as zero, so a pointer drag here would measure nothing at all —
 * it would be a test that passes because it stopped looking. The arrows and the
 * drag commit through the same moveEntry / applyOrder pair; what is left
 * unproven by machine is the finger, and progress.md says so.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  const killSheets = () => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
  const sheetRows = () => [...document.querySelectorAll('.sheet .reorder-row')];
  const sheetNames = () => sheetRows().map((r) => r.querySelector('.row-title').textContent.trim());
  const arrow = (i, dir) => sheetRows()[i].querySelectorAll('.move-btns button')[dir === 'up' ? 0 : 1];
  const order = () => sheetNames().join(' > ');

  /* ⚠️ THREE LIFTS NOTHING ELSE IN THIS FILE HAS TOUCHED, and that is not
   * fussiness: an exercise with history opens with every set pre-filled from
   * last time, and a pre-filled set from a real session counts as performed.
   * Reusing the bench press here would have made "1 set recorded" read 2, and
   * the assertion would have been describing the fixture rather than the
   * feature. */
  killSheets();
  const w = await store.saveWorkout({
    name: 'Order day',
    exercises: [
      { exerciseId: byName('Zercher Squat').id, sets: 2, notes: '' },
      { exerciseId: byName('Landmine Press').id, sets: 2, notes: '' },
      { exerciseId: byName('Spider Curl').id, sets: 2, notes: '' },
    ],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));

  /* ---- the three actions, and the shape Tim asked them to wear ---- */
  const pills = [...s.querySelectorAll('.session-actions .pill-action')];
  ok(pills.length === 3, `three actions on the exercise: Swap, Remove and the list (${pills.length})`);
  ok(/Swap/.test(pills[0].textContent) && /Remove/.test(pills[1].textContent),
     'Swap and Remove are still the first two, in the order they have always been');
  ok(/Exercises/.test(pills[2].textContent),
     '⚠️ and the way into the whole workout sits beside them, which is where Tim asked for it');
  ok(pills.every((p) => p.classList.contains('pill-action')),
     '⚠️ all three carry .pill-action — the class the stylesheet gives .add-set\'s shape, which '
     + 'is what "make them stand out just like the +add set button" asked for. jsdom paints '
     + 'nothing, so tests/a11y.test.mjs pins the rule itself');

  /* ---- record something, so the reorder has data to move ---- */
  type(s.querySelectorAll('.step-value')[0], 185);
  await settle();
  type(s.querySelectorAll('.step-value')[1], 5);
  await settle();

  pills[2].click();
  await settle();
  ok(order() === 'Zercher Squat > Landmine Press > Spider Curl',
     `the sheet lists today's exercises in order (${order()})`);
  ok(/1 set recorded/.test(sheetRows()[0].textContent),
     'and says what has been recorded against each — the thing a reorder must not lose');
  ok(sheetRows()[0].classList.contains('is-current'),
     'and marks the one you are standing on');
  ok(arrow(0, 'up').disabled && arrow(2, 'down').disabled,
     '⚠️ the arrows at the ends are disabled rather than absent — a control that silently does '
     + 'nothing is the fault the five inert back buttons taught this project');
  ok(sheetRows().every((r) => (r.querySelector('.grip').getAttribute('aria-label') || '').includes('arrows')),
     '⚠️ and the drag handle NAMES the arrows beside it, because a drag has no keyboard '
     + 'equivalent and a handle that only says "reorder" is a promise it cannot keep to '
     + 'somebody who is not using a finger');

  /* ---- move the exercise you are ON, with a set already recorded ---- */
  arrow(0, 'down').click();
  await settle();
  ok(order() === 'Landmine Press > Zercher Squat > Spider Curl',
     `the Zercher squat moved down one (${order()})`);
  ok(/1 set recorded/.test(sheetRows()[1].textContent) && /Nothing recorded/.test(sheetRows()[0].textContent),
     '🚨 AND THE RECORDED SET MOVED WITH IT — the row that now holds the training is the Zercher '
     + 'squat in its new place, not whatever slid into slot one');
  ok(/Zercher Squat/.test(s.querySelector('.session-ex-name').textContent),
     '⚠️ and the runner is still on the exercise you were doing. state.index walks STEPS, so the '
     + 'walk is re-pointed by the entry OBJECT — re-using the old number would land on whatever '
     + 'took its slot, which on a reorder is precisely the exercise you are not doing');
  ok(/Exercise 2 of 3/.test(s.querySelector('.session-head').textContent),
     'and the position line says it is second now');

  /* ⚠️ NOW MOVE AN EXERCISE YOU ARE NOT ON, WHICH IS THE CASE THAT SEPARATES
   * "re-point by object" from "re-point by index". Moving the exercise you are
   * standing on lands correctly either way — the slot it arrives in is the slot
   * you would have guessed. Shuffling one BEHIND you shifts your own position
   * without anything on your row changing, and an index-based re-point silently
   * follows the exercise somebody else moved. */
  arrow(2, 'up').click();
  await settle();
  ok(order() === 'Landmine Press > Spider Curl > Zercher Squat',
     `the curl moved up past the squat (${order()})`);
  ok(/Zercher Squat/.test(s.querySelector('.session-ex-name').textContent)
     && /Exercise 3 of 3/.test(s.querySelector('.session-head').textContent),
     '🚨 and you are STILL on the Zercher squat, now third — reordering the list under somebody '
     + 'must never move them to a different exercise mid-set');
  arrow(1, 'down').click();          // put it back for the rest of this block
  await settle();
  ok(order() === 'Landmine Press > Zercher Squat > Spider Curl', 'and it moves back');

  /* ---- add one ---- */
  [...document.querySelectorAll('.sheet button')].find((b) => /Add an exercise/.test(b.textContent)).click();
  await settle();
  {
    const box = document.querySelector('input[type="search"]');
    box.value = 'Zottman Curl';
    box.dispatchEvent(new window.Event('input', { bubbles: true }));
    const row = [...document.querySelectorAll('.search-results .row')]
      .find((b) => /^Zottman Curl/.test((b.textContent || '').trim()));
    ok(Boolean(row), 'the add button opens the full exercise picker');
    row.click();
    await settle(); await settle();
  }
  ok(sheetNames().length === 4 && sheetNames()[3] === 'Zottman Curl',
     `⚠️ an added exercise goes on the END (${order()}) — a swap inserts in place because those `
     + 'sets were performed there, but an add really did happen after everything, and '
     + 'muscleStrength() reads entry order as how much work a muscle had already taken');
  ok(/added today/.test(sheetRows()[3].textContent), 'and the sheet says it is today only');
  ok(/Zercher Squat/.test(s.querySelector('.session-ex-name').textContent),
     '⚠️ and adding does not move you off the exercise you are mid-way through');
  ok(/Exercise 2 of 4/.test(s.querySelector('.session-head').textContent),
     'while the count behind you goes up');

  /* ---- a duplicate is refused, for the reason the builder refuses it ---- */
  [...document.querySelectorAll('.sheet button')].find((b) => /Add an exercise/.test(b.textContent)).click();
  await settle();
  {
    const box = document.querySelector('input[type="search"]');
    box.value = 'Landmine Press';
    box.dispatchEvent(new window.Event('input', { bubbles: true }));
    const row = [...document.querySelectorAll('.search-results .row')]
      .find((b) => /^Landmine Press/.test((b.textContent || '').trim()));
    row.click();
    await settle(); await settle();
  }
  ok(sheetNames().length === 4,
     '⚠️ adding something already in today\'s session is refused — two entries with one exercise '
     + 'id is the shape that produced the duplicate-exercise read bug of 2026-08-28');

  /* ---- remove one, from the sheet, with nothing recorded on it ---- */
  const removeBtn = (i) => [...sheetRows()[i].querySelectorAll('button')]
    .find((b) => /^Remove /.test(b.getAttribute('aria-label') || ''));
  removeBtn(3).click();
  await settle();
  ok(order() === 'Landmine Press > Zercher Squat > Spider Curl',
     `an untouched exercise goes quietly (${order()})`);

  /* ---- and one WITH sets recorded asks first ---- */
  removeBtn(1).click();
  await settle();
  ok(/1 recorded set will be deleted/.test(document.body.textContent),
     '🚨 removing an exercise that has been trained CONFIRMS, and says the count — the same '
     + 'contract the Remove button on the exercise itself has had since 2026-08-28');
  [...document.querySelectorAll('.sheet .btn.ghost')].pop().click();   // Cancel
  await settle();
  ok(sheetNames().length === 3, 'and cancelling leaves the workout exactly as it was');

  /* ---- the saved session is the proof ---- */
  killSheets();
  const finishBtn = () => [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent));
  for (let i = 0; i < 12 && !finishBtn(); i++) {
    const next = [...s.querySelectorAll('button')].find((b) => /Next exercise|Straight into|Round/.test(b.textContent));
    if (!next) break;
    next.click();
    await settle();
  }
  finishBtn().click();
  await settle(); await settle();
  const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
  ok(Boolean(saved), 'the reordered session saves');
  ok(saved && saved.entries.length === 1 && saved.entries[0].exerciseName === 'Zercher Squat',
     '⚠️ and only the exercise anybody actually trained is in it — the empty ones drop at save, '
     + 'exactly as they did before this feature existed');
  ok(saved && saved.entries[0].sets.length === 1 && saved.entries[0].sets[0].weight === 185,
     '🚨 and the 185 is written under the ZERCHER SQUAT after a reorder, an add and a cancelled '
     + 'delete. This is the assertion Tim\'s "keep the information tied to that exercise" comes '
     + 'down to');
  localStorage.removeItem(DRAFT);
  killSheets();
}

/* ============ a friend's face, everywhere they appear (2026-08-31) ============
 *
 * Tim: *"when you put a profile picture into your account, your friends can't
 * see the profile picture… For example when they see your friend profile, or
 * when you post a workout and it goes on their feed, the profile picture is
 * shown, but its just the default blank humanoid, not the picture that they
 * actually added."*
 *
 * 🚨 THE ASSERTION THAT MATTERS MOST IS THE REFUSAL, and it is in
 * tests/social.test.mjs: an avatar is a string another account wrote, and this
 * app puts it in an `src`. Here the question is only whether the three screens
 * paint it.
 */
{
  const { HomeView } = await import(BASE + 'views-workouts.js');
  const { SocialView, FriendView } = await import(BASE + 'views-social.js');
  const { social, todayISO } = await import(BASE + 'store.js');
  sessionStorage.removeItem('ftrack:v1:demo');   // the feed has its own demo branch

  // A real 1×1 JPEG, base64 — small enough to sit in a test file and a genuine
  // `data:image/jpeg;base64,…`, which is exactly what safeAvatar() admits.
  const FACE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEB'
    + 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/9sAQwEBAQEBAQEBAQEBAQEBAQEB'
    + 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/8AAEQgAAQABAwEiAAIRAQMR'
    + 'Af/EABUAAQEAAAAAAAAAAAAAAAAAAAAI/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABUBAQEAAAAAAAAAAAAAAAAA'
    + 'AAAG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKp//2Q==';

  const original = {
    state: social.state, invites: social.invites, handoffs: social.handoffs,
    friend: social.friend, healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    processAcceptedRequests: social.processAcceptedRequests,
    requests: social.requests,
  };
  const restore = () => Object.assign(social, original);

  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me',
    name: 'Tim', shareBodyWeight: false,
    connections: [{ uid: 'u1', name: 'Autumn', tier: 'mid', since: '2026-08-01' }],
  });
  social.invites = async () => [];
  social.handoffs = async () => [];
  social.requests = async () => [];
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;

  const withFace = (avatar) => async () => ({
    tier: 'mid',
    doc: {
      profile: avatar ? { name: 'Autumn', avatar } : { name: 'Autumn' },
      activity: [{ id: 'a1', date: todayISO(), name: 'Pull', startedAt: `${todayISO()}T09:00:00.000Z`,
        entries: [{ exerciseId: 'x', name: 'Lat Pulldown', sets: [{ weight: 90, reps: 8 }] }] }],
    },
  });

  /* ---- the feed card: the screen Tim named ---- */
  social.friend = withFace(null);
  let home = await mount(HomeView());
  for (let i = 0; i < 8; i++) await settle();
  ok(Boolean(home.querySelector('.feed-avatar svg')) && !home.querySelector('.feed-avatar .face-img'),
     'a friend with no photo keeps the person glyph, which is what every account looks like today');

  social.friend = withFace(FACE);
  home = await mount(HomeView());
  for (let i = 0; i < 8; i++) await settle();
  const face = home.querySelector('.feed-avatar .face-img');
  ok(Boolean(face), '🚨 and a friend WITH a photo has their own face on their workout in the feed');
  ok(face && face.getAttribute('src') === FACE, 'and it is the picture they published, unaltered');
  ok(face && face.getAttribute('alt') === '',
     '⚠️ with an EMPTY alt — their name is in the same card, and describing the picture would '
     + 'make a screen reader say the person twice');

  /* ---- the friends list ---- */
  const soc = await mount(SocialView());
  for (let i = 0; i < 8; i++) await settle();
  ok(Boolean(soc.querySelector('.row-icon .face-img')),
     '⚠️ the friends list shows it too — filled in AFTER the row paints, because their photo '
     + 'costs a read per friend and this is the screen Tim once reported as laggy');

  /* ---- their own page ---- */
  const fr = await mount(FriendView('u1'));
  for (let i = 0; i < 8; i++) await settle();
  ok(Boolean(fr.querySelector('.friend-face .face-img')), 'and their page leads with it');

  social.friend = withFace(null);
  const bare = await mount(FriendView('u1'));
  for (let i = 0; i < 8; i++) await settle();
  ok(!bare.querySelector('.friend-face'),
     '⚠️ while a friend with no photo gets NO empty circle — the title bar already says whose '
     + 'page this is, so a glyph here would be an ornament on most accounts');

  /* ---- taking it down has to take it down from where people are looking ---- *
   *
   * ⚠️ THIS IS THE HALF THAT WOULD ROT SILENTLY. A photo added or removed only
   * reaches friends when something republishes, and until 2026-08-31 the only
   * things that did were the social mutators and a finished workout — the fault
   * that froze Autumn's published muscle map at a pre-training snapshot and got
   * reported as her data being lost. "Remove" that leaves your face on somebody
   * else's feed is a worse version of it, because it is a promise about a
   * picture of you. */
  {
    const { AccountView } = await import(BASE + 'views-account.js');
    const { store } = await import(BASE + 'store.js');
    const realPublish = social.publish;
    let published = 0;
    social.publish = async () => { published++; return true; };

    await store.saveSettings({ avatar: FACE, avatarSource: FACE, avatarCrop: null });
    const acct = await mount(AccountView());
    await settle();
    ok(Boolean(acct.querySelector('.avatar-face img')), 'the account screen shows the photo you saved');
    ok(/friends you are connected to/.test(acct.textContent),
       '⚠️ and SAYS friends can see it. The line read "Only on this account — friends do not see '
       + 'it", which was true until today; a stale reassurance about who can see your face is the '
       + 'worst wrong sentence this app could carry');

    [...acct.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove').click();
    await settle(); await settle();
    const after = await store.getSettings();
    ok(!after.avatar, 'Remove clears the photo');
    ok(published === 1,
       '🚨 and REPUBLISHES, so it comes off your friends\' screens too rather than only off yours');

    social.publish = realPublish;
  }

  /* ---- and the one that is not a picture at all ---- */
  social.friend = withFace('data:image/svg+xml;base64,PHN2Zy8+');
  const nasty = await mount(FriendView('u1'));
  for (let i = 0; i < 8; i++) await settle();
  ok(!nasty.querySelector('.face-img'),
     '🚨 AN SVG IS NOT PAINTED. It is a document that can carry script rather than a picture, '
     + 'and this string was written by somebody else\'s account');

  restore();
}

/* ================= a friend's workout, on its own screen ==================
 *
 * docs/social-plan.md §13 steps 3 and 4 — the screen a feed card now opens.
 * Driven against a hand-written projection rather than the demo, because the
 * cases worth pinning are the ragged ones: a session that has rolled off the
 * published window, an exercise this library has never heard of, a plank that
 * records seconds, and a drop set that must stay one set.
 */
{
  const { FriendSessionView } = await import(BASE + 'views-social.js');
  const { social } = await import(BASE + 'store.js');
  const { BUILT_IN_EXERCISES: LIB } = await import(BASE + 'exercises.js');

  const original = { state: social.state, friend: social.friend };
  const restore = () => Object.assign(social, original);

  const bench = LIB.find((e) => e.name === 'Barbell Bench Press');
  const plank = LIB.find((e) => e.name === 'Plank');

  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me',
    name: 'Tim', shareBodyWeight: false,
    connections: [{ uid: 'u1', name: 'Autumn', tier: 'mid', since: '2026-08-01' }],
  });

  const session = {
    id: 's1', date: '2026-08-26', name: 'Push', note: 'Gotta start eating more pre lift',
    startedAt: '2026-08-26T13:23:00.000Z', minutes: 65, location: 'Ironworks Gym',
    entries: [
      { exerciseId: bench.id, name: 'Barbell Bench Press', setType: 'drop', sets: [
        { weight: 185, reps: 8, minis: [{ weight: 155, reps: 6 }, { weight: 135, reps: 6 }] },
        { weight: 185, reps: 7 },
      ] },
      { exerciseId: plank.id, name: 'Plank', sets: [{ time: 60 }, { time: 60 }] },
      // Their app knows this lift and ours does not. It must still be listed.
      { exerciseId: 'their-own-id', name: 'Reverse Nordic Curl', sets: [{ reps: 10 }, { reps: 8 }] },
    ],
  };
  social.friend = async () => ({
    tier: 'mid', doc: { profile: { name: 'Autumn' }, activity: [session] },
  });

  const ws = await mount(FriendSessionView('u1', 's1'));
  for (let i = 0; i < 8; i++) await settle();
  const t = ws.textContent.replace(/\s+/g, ' ');

  ok(/Push/.test(t), 'the workout is named');
  ok(/Gotta start eating more pre lift/.test(t), 'and what they said about it is on the screen');
  /* ⚠️ ABSOLUTE HERE, RELATIVE ON THE CARD. "6 hours ago" is right while you
     are scanning a feed; once you have stopped to look at one workout, the
     question is when it actually was. */
  ok(/August 26, 2026|26 August 2026/.test(t),
     '⚠️ the date is absolute here, not "2 days ago" — the card already did relative');

  const labels = [...ws.querySelectorAll('.feed-stat-label')].map((n) => n.textContent);
  ok(labels.includes('Time') && labels.includes('Sets') && labels.includes('Exercises'),
     `the stat row reads Time · Sets · Exercises (${labels.join(' · ')})`);
  ok(!labels.some((l) => /volume/i.test(l)), '⚠️ and still never volume');
  ok(/1h 5min/.test(t), 'a 65-minute session reads as 1h 5min rather than as 65 minutes');

  /* ---- the set tables, §12.15 ---- */
  const heads = [...ws.querySelectorAll('.ws-set.is-head .ws-set-v')].map((n) => n.textContent);
  ok(heads.includes('Weight & Reps'), 'a barbell lift is headed Weight & Reps');
  ok(heads.includes('Time'),
     '🚨 and a plank is headed Time — the header ADAPTS, because a weight column '
     + 'over a plank is a column of dashes pretending to be data');
  ok(/1:00/.test(t), 'and its sets read as a minute, not as the number 60');

  const benchSets = ws.querySelectorAll('.ws-ex')[0].querySelectorAll('.ws-set:not(.is-head)');
  ok(benchSets.length === 4,
     `the drop set's minis hang under it as rows (${benchSets.length} = 2 sets + 2 drops)`);
  ok(ws.querySelectorAll('.ws-set.is-mini').length === 2, 'and are marked as minis, not numbered as sets');
  ok([...ws.querySelectorAll('.ws-ex')[0].querySelectorAll('.ws-set-n')]
       .filter((n) => /^\d+$/.test(n.textContent)).length === 2,
     '🚨 ONE HARD SET IS ONE NUMBER — a drop set is not three sets, and the numbering says so');

  ok(/Reverse Nordic Curl/.test(t), 'an exercise this library has never heard of is still listed');
  ok(/not in your library/.test(t), 'and says so once, rather than being silently dropped');

  /* ---- bests in this workout, §13 step 5 ----
   *
   * The fixture gives them an earlier, lighter bench session, so today's 185
   * really is a best within what they have shared. */
  {
    const earlier = { ...session, id: 's0', date: '2026-08-19', startedAt: '2026-08-19T13:00:00.000Z',
      entries: [{ exerciseId: bench.id, name: 'Barbell Bench Press', sets: [{ weight: 155, reps: 8 }] }] };
    social.friend = async () => ({
      tier: 'mid', doc: { profile: { name: 'Autumn' }, activity: [session, earlier] } });
    const withPr = await mount(FriendSessionView('u1', 's1'));
    for (let i = 0; i < 8; i++) await settle();
    const p = withPr.textContent.replace(/\s+/g, ' ');
    ok(/Bests in this workout/.test(p), 'a best set in this workout is called out');
    ok(/up from 155/.test(p), 'and says what it beat, which is the whole point of a best');
    ok(/estimated/.test(p),
       '⚠️ the 1RM one is labelled ESTIMATED in words — Rule 5 says an inference may never look '
       + 'like a measurement, and the cue may not be colour alone');
    /* 🚨 THE HONESTY LINE. We hold their last sixty published sessions, not
       their life, so calling any of this a personal record would be a claim
       about training this app has never seen. */
    ok(/not against everything they have ever done|best here, which may not be their best/.test(p),
       '🚨 and it says this is their best in what they SHARE, not their best ever');

    // Put the single-session fixture back for the assertions below.
    social.friend = async () => ({
      tier: 'mid', doc: { profile: { name: 'Autumn' }, activity: [session] } });
  }

  /* ---- the muscle split, §13 step 4 ---- */
  const pcts = [...ws.querySelectorAll('.split-pct')].map((n) => n.textContent);
  ok(pcts.length > 0, `the session's muscle split is drawn (${pcts.join(' ')})`);
  ok(pcts.every((p) => /%$/.test(p)),
     '🚨 A SHARE, NOT AN ABSOLUTE — "52% of this workout was chest" is true of one session, '
     + 'where "12.4 sets" only means something measured against a week');
  const total = pcts.reduce((n, p) => n + parseFloat(p), 0);
  ok(total >= 97 && total <= 103, `and the shares total 100 (${total})`);
  ok(/1 exercise is not in your library/.test(t),
     '⚠️ and it names what it could not count rather than quietly renormalising over the rest');
  ok(/modelling choice/.test(t), 'the half-set rule travels with the number that used it');

  /* ---- copying their workout into one of mine (§13 step 7) ---- */
  {
    const { store } = await import(BASE + 'store.js');
    const before = (await store.getWorkouts()).length;
    const copy = [...ws.querySelectorAll('button')].find((b) => /Save as my workout/.test(b.textContent));
    ok(Boolean(copy), 'their workout can be saved as one of mine');
    copy.click();
    for (let i = 0; i < 8; i++) await settle();
    const sheet = document.querySelector('.sheet');
    const s = sheet.textContent.replace(/\s+/g, ' ');
    ok(/from Autumn/.test(s), 'the copy is named after where it came from');
    ok(/2 sets Barbell Bench Press|Barbell Bench Press/.test(s), 'it lists what will be copied');
    /* 🚨 THE PART THAT MATTERS: a session is a RECORD and a workout is a PLAN.
       Their 185 lb bench is a fact about them and would be a prescription to
       me — and handing somebody else's numbers to a lifter is the one thing
       this app's progression rule exists to prevent. */
    ok(!/185/.test(s), '🚨 and never their weights — set counts carry across, loads do not');
    ok(/not in your library/.test(s),
       '⚠️ and it says what it cannot copy rather than quietly shrinking the routine');
    ok((await store.getWorkouts()).length === before,
       'nothing is saved until Save is pressed');
    document.querySelector('.sheet-backdrop').remove();
  }

  /* ---- you and them on one exercise (§13 step 6) ---- */
  {
    const link = ws.querySelector('.ws-ex-name.as-link');
    ok(Boolean(link), 'an exercise this library knows opens a comparison');
    ok(![...ws.querySelectorAll('.ws-ex-name')]
         .filter((n) => /Reverse Nordic/.test(n.textContent))
         .some((n) => n.classList.contains('as-link')),
       '⚠️ and one it does not know is NOT a link — a control that cannot do anything is worse than plain text');
    link.click();
    for (let i = 0; i < 10; i++) await settle();
    const sheetNode = document.querySelector('.sheet');
    const cmp = sheetNode.textContent.replace(/\s+/g, ' ');
    const { NO_VERDICT_HEADER } = await import(BASE + 'compare.js');
    /* 🚨 Hevy prints a yellow STRONGER rosette beside whoever leads. Calling a
       winner off one exercise is exactly the unearned opinion Rule 6 forbids,
       so the module refuses to produce one and says so in its own words —
       printed here rather than paraphrased, so the sentence cannot drift from
       the behaviour it describes. */
    ok(cmp.includes(NO_VERDICT_HEADER.replace(/\s+/g, ' ')),
       '🚨 the sheet states there is NO overall result, in the module\'s own sentence');
    ok(!sheetNode.querySelector('.is-win, .winner, .stat-value.up, .stat-value.down'),
       'and nothing in it is painted as a win or a loss');
    /* ⚠️ Either it compares, or it says why it cannot — never a column of
       zeros. "You 0, Autumn 0" would read as two people who both failed at
       something, where the truth is that one of them has not logged it. */
    const nums = [...sheetNode.querySelectorAll('.cmp-num')];
    const said = [...sheetNode.querySelectorAll('.note')]
      .map((n) => n.textContent.trim())
      .filter((s) => s.length > 30 && !NO_VERDICT_HEADER.startsWith(s.slice(0, 20)));
    ok(nums.length ? nums.every((n) => n.textContent.trim() !== '0') : said.length > 0,
       nums.length
         ? `it compares on ${nums.length / 2} measure(s) and none of them is a bare 0`
         : `it says plainly why it cannot: "${said[0] || ''}"`);
    document.querySelector('.sheet-backdrop').remove();
  }

  /* ---- a workout that has rolled off the published window ---- */
  const gone = await mount(FriendSessionView('u1', 'not-published'));
  for (let i = 0; i < 8; i++) await settle();
  const g = gone.textContent.replace(/\s+/g, ' ');
  ok(/not here|no longer/.test(g),
     '⚠️ a session outside the published window says so — the window is 60, and an old card outlives it');
  ok(/changed what they share|scrolled off/.test(g), 'and names both reasons it can happen');

  /* ---- and one with nothing inside it ----
   *
   * ⚠️ THIS USED TO BE THE LOWEST-TIER CASE and it is not gone with the tiers,
   * only re-caused: a session with no entries is still reachable — an activity
   * publishes none, and so does a workout finished with nothing logged. The
   * screen has to read as complete rather than as one that failed to load. */
  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim',
    shareBodyWeight: false, visibility: 'private',
    connections: [{ uid: 'u1', name: 'Autumn', since: '2026-08-01' }],
  });
  social.friend = async () => ({
    audience: 'friends',
    doc: { profile: { name: 'Autumn' }, activity: [{ id: 's9', date: '2026-08-26', name: 'Workout' }] },
  });
  const light = await mount(FriendSessionView('u1', 's9'));
  for (let i = 0; i < 8; i++) await settle();
  ok(/no exercises recorded in this one/i.test(light.textContent),
     'a session with nothing in it gets a complete screen that says what it is, not an empty one');
  ok(!light.querySelector('.ws-split'), 'and no muscle split invented out of nothing');

  restore();
}

/* ================= back means the screen you were just on =================
 *
 * Tim, 2026-09-02: *"When you click back on something it should always go to
 * what you were on right before. Currently when you click on someone else's
 * workout and then go back, it takes you to that user's profile/page rather
 * than back to the home menu where you saw the post on."*
 *
 * ⚠️ HE REPORTED ONE SCREEN AND DESCRIBED ALL 48. Every `screenShell({ back })`
 * in this app hard-codes a PARENT, which is only the right answer when you
 * arrived from the parent. The fix is in `ui.js` — the arrow goes back through
 * history and the hard-coded parent is the fallback — so this block tests the
 * mechanism rather than the one screen that happened to reveal it.
 */
{
  const { screenShell, el, markRoute, canGoBack, refreshRoute } = await import(BASE + 'ui.js');
  const backOf = (node) => node.querySelector('.topbar .icon-btn');

  // A cold start: one entry, nothing behind it.
  history.replaceState(null, '', '#/home');
  markRoute();
  ok(!canGoBack(), 'on the first screen of a visit there is nothing behind you');

  let fellBack = 0;
  const first = screenShell({ title: 'Home', back: () => { fellBack++; }, scroll: el('div') });
  backOf(first).click();
  ok(fellBack === 1,
     '⚠️ so the arrow uses the screen\'s own destination — a deep link must land somewhere, '
     + 'not step off the site');

  // Now walk: home → a friend's workout, the way a card does it.
  location.hash = '#/friend/u1/s1';
  await settle();
  markRoute();
  ok(canGoBack(), 'after moving to a second screen there IS something behind you');

  const second = screenShell({
    title: 'Workout',
    // The parent this screen would have gone to before — a friend's page, which
    // is NOT where the reader came from.
    back: () => { location.hash = '#/friend/u1'; },
    scroll: el('div'),
  });
  backOf(second).click();
  await settle(); await settle();
  ok(location.hash === '#/home',
     `🚨 back goes to the screen you were on, not to the parent (${location.hash})`);
  ok(location.hash !== '#/friend/u1',
     '⚠️ and specifically NOT to the friend\'s page, which is the bug Tim reported');

  /* ---- the one screen that opts out ---- */
  history.replaceState(null, '', '#/session/x');
  markRoute();
  location.hash = '#/session/y';
  await settle();
  markRoute();
  let exact = 0;
  const finish = screenShell({
    title: 'Workout complete', back: () => { exact++; }, backExact: true, scroll: el('div'),
  });
  backOf(finish).click();
  ok(exact === 1 && canGoBack(),
     '🚨 `backExact` still runs its own handler even with history behind it — the finish screen\'s '
     + 'arrow means "go and edit what you just recorded", and the entry behind it is a workout '
     + 'whose draft has just been cleared');

  /* ---- and the re-render that used to push two entries ---- */
  let renders = 0;
  const onHash = () => { renders++; };
  window.addEventListener('hashchange', onHash);
  const before = location.hash;
  refreshRoute();
  await settle();
  ok(renders === 1, 'refreshRoute() re-renders the screen you are on');
  ok(location.hash === before,
     '⚠️ without moving — the `#/blank` bounce it replaced pushed two entries and put a route that '
     + 'renders nothing directly behind every screen that used it');
  window.removeEventListener('hashchange', onHash);
}

/* ================= the benchmark screen predicts before you lift ==========
 *
 * Tim, 2026-09-02: *"when the user records a benchmark, there should be some
 * sort of display showing the predicted 1RM for that exercise… put a number
 * above the reps that estimate how many they can do… put a % above the weight
 * that says what % of the estimated 1RM the cite thinks they can lift."*
 *
 * 🚨 THE FIXTURE IS TIM'S OWN EXAMPLE. It records dumbbell rows and lat
 * pulldowns and NEVER a barbell row — then asks the screen about the barbell
 * row. If the estimate came from the exercise itself this would show nothing.
 *
 * ⚠️ NOT DRIVEN IN THE DEMO, and the reason is worth writing down: the demo
 * flag swaps the store's BACKEND, and that swap happens on boot. Setting the
 * flag partway through a test file leaves `store.getSessions()` reading the
 * local rows it always was, so `muscleStrength()` sees an empty history and the
 * screen correctly shows nothing. The first version of this block did exactly
 * that and failed for a reason that had nothing to do with the feature.
 */
{
  const { store } = await import(BASE + 'store.js');
  const { BenchmarkView } = await import(BASE + 'views-session.js');
  const { clearReadCache } = await import(BASE + 'store.js');

  const dbRow = byName('Dumbbell Row');
  const pulldown = byName('Lat Pulldown');
  const session = (date, ex, weight, reps) => ({
    id: `bx-${date}-${ex.id}`, date, workoutName: 'Pull',
    entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: [{ weight, reps }] }],
  });
  await store.importAll({
    sessions: [
      session('2026-08-10', dbRow, 90, 6), session('2026-08-17', dbRow, 95, 6),
      session('2026-08-12', pulldown, 160, 8), session('2026-08-19', pulldown, 170, 8),
    ],
  });
  clearReadCache('seeded rows directly through importAll');

  /* 🚨 NO PROFILE AND NO WEIGH-IN IS SET HERE, DELIBERATELY, and `importAll`
   * has just cleared any left by an earlier block. This screen used to read
   * `muscleStrength()`, which refuses everything until sex, age and a body
   * weight are on record — so a lifter with months of training and no weigh-in
   * was told the app had no idea what they could row, which was false. The
   * estimate is pounds converted from their own sets and needs none of those;
   * only a percentile does. If this block ever starts needing a profile again,
   * that is the regression. */

  const bench = await mount(BenchmarkView());
  for (let i = 0; i < 8; i++) await settle();

  ok(!bench.querySelector('.bench-est-num'),
     'nothing is claimed before an exercise is chosen');

  // Open the picker and take a lift this account HAS trained.
  bench.querySelector('.pane-top .row').click();
  for (let i = 0; i < 8; i++) await settle();
  const pick = [...document.querySelectorAll('.sheet .row, .sheet button')]
    .find((n) => /^Barbell Row/.test(n.textContent.trim()));
  ok(Boolean(pick), 'the exercise picker opens');
  pick.click();
  /* ⚠️ POLLED, NOT SLEPT ON. The screen paints immediately and fills the
     estimate in when the history walk finishes — that is the whole point of it
     not being awaited — so a fixed number of ticks is a race that passes on a
     fast machine and fails on a slow one. Bounded, so a broken estimate still
     fails rather than hanging. */
  for (let i = 0; i < 120 && !bench.querySelector('.bench-est-num'); i++) await settle();

  const num = bench.querySelector('.bench-est-num');
  if (!num) {
    const { muscleStrength } = await import(BASE + 'store.js');
    const r = await muscleStrength();
    console.log('DEBUG ready=', r.ready, 'muscles=', r.muscles.size,
      'missing=', JSON.stringify(r.profile && r.profile.missing),
      'sessions=', (await store.getSessions()).length,
      'estText=', JSON.stringify(bench.querySelector('.bench-est').textContent));
  }
  ok(Boolean(num) && /\d/.test(num.textContent),
     `an estimated 1-rep max appears for the chosen lift (${num && num.textContent})`);
  const est = bench.textContent.replace(/\s+/g, ' ');
  /* 🚨 Rule 5: an inference must never look like a measurement, and the cue may
     not be colour alone. Every number this screen adds is worked out, so the
     word has to be on the screen. */
  ok(/ESTIMATED|estimated/.test(est), 'and says the word "estimated" in text, not in a shade');
  ok(/confidence/.test(est), 'with how much it is worth believing');
  ok(/Worked out from your /.test(est),
     '⚠️ and names the exercises it came from — an estimate whose source is not on screen is '
     + 'indistinguishable from a number the app made up');
  ok(!/from from/.test(est), 'and reads as English (this line shipped doubled once)');

  /* ---- the two live captions ---- */
  const caps = [...bench.querySelectorAll('.step-est')];
  ok(caps.length === 2, `both fields carry a caption slot (${caps.length})`);
  ok(caps.every((c) => c.textContent.trim() === ''),
     '⚠️ and they are EMPTY at zero — "0 % of your estimated max" is arithmetic on an untouched '
     + 'field, which reads as a reading');

  const weightInput = bench.querySelectorAll('.step-value')[0];
  weightInput.value = '155';
  weightInput.dispatchEvent(new window.Event('blur', { bubbles: true }));
  for (let i = 0; i < 8; i++) await settle();

  const capText = caps.map((c) => c.textContent.trim());
  ok(/%\s*of your estimated max/.test(capText[0]),
     `the weight says what share of the estimate it is (${capText[0]})`);
  ok(/to failure/.test(capText[1]),
     `and the reps say roughly how many it allows (${capText[1]})`);
  /* ⚠️ "to failure" is not decoration. research.md §3 measured that people
     under-predict their own reps to failure by one to five, and this app has no
     reps-in-reserve field (D9) — so the number is systematically higher than
     what somebody stopping where they normally stop will do. Saying which kind
     of rep count it is, is the whole difference between a guide and a lie. */
  ok(/maybe/.test(capText[1]), 'worded as a guess rather than as a target');

  await store.clearAll();
}

/* ================================================================== *
 * 🚨 PRIVATE OR PUBLIC, A FRIEND'S MUSCLE PANEL, AND TWO BODIES SIDE BY SIDE
 *   — 2026-09-03
 *
 * Tim: *"I want to change how privacy settings work, as well as change the
 * visibility one user has on another… a friend [should] be able to see another
 * user's body, their graphs, volume, etc. as well as click on any muscle group
 * like that own user can on themselves… make a compare button somewhere that
 * allows that user to display another person's body side by side."*
 * ================================================================== */
{
  const { FriendView, CompareBodiesView, FriendVolumeView, FriendGraphView, SocialView } =
    await import(BASE + 'views-social.js');
  const { social, store, todayISO } = await import(BASE + 'store.js');
  sessionStorage.removeItem('ftrack:v1:demo');

  const original = {
    state: social.state, friend: social.friend, invites: social.invites,
    handoffs: social.handoffs, requests: social.requests,
    healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    processAcceptedRequests: social.processAcceptedRequests,
    setVisibility: social.setVisibility,
  };
  social.invites = async () => [];
  social.handoffs = async () => [];
  social.requests = async () => [];
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;

  let saved = null;
  social.setVisibility = async (v) => { saved = v; return v; };

  const state = (visibility = 'private') => async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim',
    shareBodyWeight: false, visibility,
    connections: [{ uid: 'u1', name: 'Autumn', since: '2026-08-01' }],
  });

  /* Their published muscle map, in the shape buildStrengthShare() produces —
   * ⚠️ WITH TWO GRID ROWS, because the assertion that matters is that changing
   * the comparison group changes the numbers on somebody ELSE's body. A fixture
   * with one row would let a screen that silently ignores the control pass. */
  const STRENGTH = {
    muscles: [
      { muscle: 'Chest', lift: 'Barbell Bench Press', estimate: 233.4, confidence: 0.71,
        band: 'Good', basis: 'direct', contributorCount: 9, exerciseCount: 3,
        contributors: [
          { exerciseName: 'Barbell Bench Press', weight: 205, reps: 3, date: '2026-08-10',
            loadType: 'total', source: 'benchmark' },
          { exerciseName: 'Cable Fly', weight: 40, reps: 12, date: '2026-08-15',
            loadType: 'per_side', source: 'workout' },
        ],
        hint: null, confident: true },
      { muscle: 'Back', lift: 'Barbell Row', estimate: 180, confidence: 0.4,
        band: 'Rough', basis: 'fallback', contributorCount: 2, exerciseCount: 1,
        contributors: [{ exerciseName: 'Barbell Row', weight: 145, reps: 8, date: '2026-08-12',
          loadType: 'total', source: 'workout' }],
        hint: null, confident: false },
    ],
    grid: {
      'lifters|male|own|own': { Chest: [62, 24.5], Back: [41, 30] },
      'everyone|all|any|any': { Chest: [88.1, 61], Back: [70.2, 44] },
    },
    defaultCompare: 'lifters|male|own|own',
  };

  const theirSession = {
    id: 'fs1', date: todayISO(), name: 'Pull', startedAt: `${todayISO()}T09:00:00.000Z`,
    entries: [{ exerciseId: 'lat-pulldown', name: 'Lat Pulldown',
      sets: [{ weight: 120, reps: 10 }, { weight: 120, reps: 9 }] }],
  };
  const theirDoc = {
    audience: 'friends', isPublic: false,
    profile: { name: 'Autumn' },
    activity: [theirSession],
    benchmarks: [{ date: '2026-08-10', exerciseId: 'lat-pulldown', name: 'Lat Pulldown',
      values: { weight: 140, reps: 5 } }],
    strength: STRENGTH,
  };

  social.state = state('private');
  social.friend = async () => ({ audience: 'friends', doc: theirDoc });

  /* ---- the account setting, on the Friends screen ---- */
  {
    const s = await mount(SocialView());
    for (let i = 0; i < 8; i++) await settle();
    const t = s.textContent.replace(/\s+/g, ' ');
    ok(/Who can see your account/.test(t),
       '🚨 who may see this account is stated ON the sharing screen — it is one setting for the '
       + 'whole account now, so it belongs above the list of people it applies to');
    ok(/Private/.test(t) && /Only friends you have accepted/.test(t),
       'and says what the current choice means in words, not as a label to look up');
    ok(!/just that I trained|My workouts/i.test(t),
       '⚠️ AND THE FOUR PER-PERSON LEVELS ARE GONE FROM IT — a screen still offering them would be '
       + 'offering a control that no longer decides anything');

    const row = [...s.querySelectorAll('button.row')].find((b) => /Private/.test(b.textContent));
    row.click();
    for (let i = 0; i < 6; i++) await settle();
    const sheet = document.querySelector('.sheet');
    const sh = sheet.textContent.replace(/\s+/g, ' ');
    ok(/Public/.test(sh) && /anyone signed in/i.test(sh),
       'the sheet offers public and says who that is');
    ok(/time of day|gym/i.test(sh),
       '⚠️ AND NAMES WHAT A REASONABLE PERSON WOULD NOT GUESS FROM THE WORD "PUBLIC" — the time of '
       + 'day they train and the gym they typed. D8: teach at the moment of use');
    ok(/body weight/i.test(sh) && /friends/i.test(sh),
       'and names the one thing that never goes public');

    const pick = [...sheet.querySelectorAll('.pick-row')].find((b) => /^Public/.test(b.textContent));
    pick.click();
    for (let i = 0; i < 6; i++) await settle();
    ok(saved === 'public', 'and choosing it goes through the store');
  }

  /* 🚨 AN ACCOUNT THAT HAS NEVER CHOSEN READS AS PUBLIC — Tim, 2026-09-03,
   * hours after this shipped the other way round: *"I would like the default to
   * be public… for now it should definently be public."*
   *
   * ⚠️ ASSERTED THROUGH THE SCREEN, not just through normalizeVisibility(). The
   * unit test proves the function; this proves the default actually reaches the
   * row somebody reads, which is a different claim — the state object simply
   * carries no `visibility` key here, exactly as it will for every account that
   * predates the setting. */
  {
    social.state = async () => ({
      available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim',
      shareBodyWeight: false,
      connections: [{ uid: 'u1', name: 'Autumn', since: '2026-08-01' }],
    });
    const s = await mount(SocialView());
    for (let i = 0; i < 8; i++) await settle();
    const row = [...s.querySelectorAll('button.row')]
      .find((b) => /Who can see|Public|Private/.test(b.textContent));
    ok(row && /Public/.test(row.textContent),
       '🚨 an account with no stored choice reads as PUBLIC on the screen');
    ok(/anyone signed in who finds your account/i.test(row.textContent.toLowerCase())
       || /anyone signed in/i.test(row.textContent),
       'and the row says what that means rather than only naming it');
    social.state = state('private');
  }

  /* ---- their body map is tappable now ---- */
  {
    social.state = state('private');
    const fr = await mount(FriendView('u1'));
    for (let i = 0; i < 10; i++) await settle();

    const map = fr.querySelector('.friend-body .body-map');
    ok(Boolean(map), 'their muscle map is drawn');
    ok(/Autumn/.test(map.getAttribute('aria-label')),
       '⚠️ and its accessible label says WHOSE body it is — the same drawing carries two meanings '
       + 'in this app already, and a screen-reader user must not be told it is their own');

    const chest = fr.querySelector('.body-map [data-muscle="Chest"]');
    ok(Boolean(chest), 'and every muscle is a control');
    chest.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 8; i++) await settle();

    const panel = fr.textContent.replace(/\s+/g, ' ');
    ok(/Chest/.test(panel) && /Intermediate|Advanced|Proficient|Beginner|Novice|Expert|Elite/.test(panel),
       '🚨 TAPPING A MUSCLE OPENS THE SAME PANEL YOUR OWN MAP OPENS — Tim: "click on any muscle '
       + 'group like that own user can on themselves and pull details from it"');
    ok(/Estimated 1-rep max/.test(panel),
       '⚠️ including the estimate, which the projection deliberately withheld until today');
    ok(/Barbell Bench Press 205/.test(panel.replace(/\s+/g, ' ')),
       '🚨 AND THE RECORDED SETS IT CAME FROM. Rule 5 travels with the number: an estimate whose '
       + 'source is not on screen is indistinguishable from one the app made up');
    ok(/confidence/i.test(panel), 'and how much it is worth believing');

    /* ⚠️ THE COMPARISON GROUP IS THEIRS, NOT MINE. The label over their figure
     * must not claim a body weight this device does not have. */
    const basis = fr.querySelector('.basis-sub');
    ok(basis && /their body weight/.test(basis.textContent),
       '⚠️ the comparison line says "their body weight" rather than naming a number — their weight '
       + 'is not in the document, and "your body weight" would name the wrong person');

    ok([...fr.querySelectorAll('a')].some((a) => /Compare/.test(a.textContent)),
       '🚨 and a Compare button sits on their map');
    ok(/Volume/.test(fr.textContent) && /Graphs/.test(fr.textContent),
       'with their volume and graphs one tap away');

    /* 🚨 THE LOAD-BEARING ONE FOR TIM'S ANSWER — *"allow them to use any
     * comparison combination that is already available"*. The percentile behind
     * a level is a ratio to THEIR body weight and age, which this device does
     * not have; their client published one row per combination instead. So the
     * assertion is that switching the group reads a DIFFERENT row: a screen
     * that silently ignored the control, or fell back to their default, would
     * pass every other assertion in this block. */
    const est = () => fr.querySelector('.muscle-level').textContent.trim();
    const before = est();
    fr.querySelector('.basis-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 8; i++) await settle();
    const everyone = [...document.querySelectorAll('.sheet .preset')]
      .find((b) => /Everyone/.test(b.textContent));
    everyone.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 10; i++) await settle();
    const after = est();
    ok(before !== after,
       `🚨 changing the comparison group changes their level (${before} → ${after}) — the grid is `
       + 'being read, not decorated with');

    /* ⚠️ AND IT IS NOT SAVED. A viewer flipping to "everyone" to look at a
     * friend's map is asking a question about that screen, not changing the
     * standard their own body is ranked against. */
    const mySettings = await store.getSettings();
    const myCompare = mySettings.compare || {};
    ok(myCompare.pool !== 'everyone',
       '⚠️ and the choice is NOT written into my own settings — silently re-ranking your own map '
       + 'from somebody else\'s page is the kind of thing nobody would ever find');
  }

  /* ---- two bodies, side by side ---- */
  {
    // My own map needs a profile and a set before it can be ranked at all.
    await store.saveProfile({ gender: 'male', birthYear: 1996 });
    await store.logBodyWeight(178, todayISO());
    await store.saveBenchmark({ date: todayISO(), exerciseId: 'barbell-bench-press--chest',
      exerciseName: 'Barbell Bench Press', values: { weight: 185, reps: 5 } });

    const cmp = await mount(CompareBodiesView('u1'));
    for (let i = 0; i < 12; i++) await settle();

    const cols = cmp.querySelectorAll('.cmp-col');
    ok(cols.length === 2, `two columns, one per person (${cols.length})`);
    const names = [...cmp.querySelectorAll('.cmp-name')].map((n) => n.textContent);
    ok(names.includes('Autumn') && names.includes('You'),
       `each column is named (${names.join(', ')}) — a body with no name over it is not a comparison`);
    ok(cmp.querySelectorAll('.cmp-col .body-map').length === 2, 'and both figures are drawn');

    /* 🚨 ONE SELECTION, BOTH BODIES. Two independent selections is the state
     * where somebody reads one person's chest against the other's back. */
    const chest = cmp.querySelector('.cmp-col .body-map [data-muscle="Chest"]');
    chest.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 10; i++) await settle();
    const panels = [...cmp.querySelectorAll('.cmp-grid')].pop();
    ok(panels.querySelectorAll('.muscle-detail').length === 2,
       '🚨 tapping one body opens the SAME muscle on both — two independent selections is the '
       + 'state where somebody compares one person\'s chest against the other\'s back');

    const text = cmp.textContent.replace(/\s+/g, ' ');
    ok(/own body weight and age/.test(text),
       '⚠️ AND THE SCREEN SAYS WHAT THE COLOURS MEAN: each body is ranked against people its own '
       + 'size, so two people can read the same level at very different weights. "Advanced vs '
       + 'Advanced" would otherwise read as "the same lift"');
    ok(/never "who lifts more"|who is lifting more/.test(text),
       'and points at the estimate as the number that does answer who lifts more');
  }

  /* ---- their volume and their graph, from the same functions as mine ---- */
  {
    const vol = await mount(FriendVolumeView('u1'));
    for (let i = 0; i < 12; i++) await settle();
    const v = vol.textContent.replace(/\s+/g, ' ');
    ok(/Autumn/.test(v), 'their volume screen names whose it is');
    ok(/most recent sixty|sixty/.test(v),
       '🚨 AND SAYS THE WINDOW IS NOT THEIR HISTORY — they publish sixty sessions, so this screen '
       + 'is not the same measurement as the one on their own phone, and silence would let it '
       + 'claim to be');

    const gr = await mount(FriendGraphView('u1'));
    for (let i = 0; i < 12; i++) await settle();
    const g = gr.textContent.replace(/\s+/g, ' ');
    ok(/Autumn/.test(g), 'and so does their graph');
    ok(/Lat Pulldown/.test(g) || /line to draw|two different days/.test(g),
       'which either charts a lift of theirs or says why it cannot');
  }

  Object.assign(social, original);
  await store.clearAll();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

