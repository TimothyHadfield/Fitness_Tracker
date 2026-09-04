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

/* ⚠️ FINISHING IS TWO TAPS SINCE 2026-09-07. "Finish workout" opens the save
   screen — the description, the gym and the day, over a summary of what is about
   to be written — and the "Save workout" button there is what calls the store.
   Every block below that used to click Finish and read the result goes through
   here, so each one keeps asserting exactly what it was written to assert.

   ⚠️ It looks for Save on the DOCUMENT rather than in the node it was handed:
   the save screen replaces `#app` outright, so the runner node the caller holds
   is no longer in the page by the time this runs. */
async function saveNow() {
  const save = [...document.querySelectorAll('button')]
    .find((b) => /^Save workout$/.test(b.textContent.trim()));
  if (save) save.click();
  await settle();
  await settle();
}
async function finishAndSave(node) {
  const fin = [...(node || document).querySelectorAll('button')]
    .find((b) => /Finish workout/.test(b.textContent));
  if (fin) fin.click();
  await settle();
  await saveNow();
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
/* ⚠️ SIX since 2026-09-08, when Tim moved the calendar back in: *"move the
   calendar section back to being a tab in the data section."* Five from
   2026-08-31 (Volume joined, D3's headline metric); four from 2026-08-28
   (Research); three from 2026-08-25, when Calendar left this control for a nav
   tab of its own. **The calendar has now been in this control, out of it, and
   back in — every move on his instruction.** The count is asserted rather than
   just the contents, because a segment silently disappearing is exactly the
   class of bug this block was written for.

   🚨 AND THIS NOTE USED TO END *"A SIXTH does not fit in the 12px left over"* —
   measured over CDP at 360px, a 293px row against labels 63+60+51+39+68 = 281px.
   That measurement was and is correct, which is why the sixth segment could not
   simply be appended: the row had to be able to SCROLL. The measurement stands
   as the reason for the mechanism rather than as a ban on the tab. */
ok(tabs.length === 5, `mode switch shows five tabs with NO data (${JSON.stringify(tabs)})`);
ok(tabs[1] === 'Volume',
   '⚠️ Volume sits beside Muscles — two readings of the same body, not a chart mode');
ok(tabs.includes('Research'),
   'Research is reachable on an empty account — published data needs no history');
ok(tabs.includes('Muscles'), 'Muscles tab is reachable on an empty account — the reported bug');
ok(tabs[0] === 'Muscles',
   '⚠️ and Muscles is FIRST — it is the mode that works with the least history, where a line chart needs two points');
/* 🔄 THIS ASSERTION HAS NOW BEEN BOTH OF ITS OWN OPPOSITES, and it is kept
   flipping rather than deleted because the reasoning it carries has never
   changed across four moves: **there must be exactly ONE way in.** It read
   "the calendar has its own tab" before 2026-09-08, "the calendar is a Data
   segment again" after it, and since 2026-09-10 the calendar lives on Profile —
   so Data must NOT offer a second door to it. `app.js`'s Profile tab claims the
   `calendar`, `day` and `edit` routes; Data claims only `graphs`. */
ok(!tabs.includes('Calendar'),
   '🚨 the calendar is NOT a Data segment — it is on Profile, and two ways in '
   + 'would light two tabs at once');
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
const levelClasses = new Set(LEVELS.map((l) => 'lv-' + l.key)
  // `lv-unranked` is not a level and never ranks anything — but it IS the third
  // mutually-exclusive fill a region can wear, so it belongs in the set this
  // "exactly one" check counts against.
  .concat(['lv-none', 'lv-below', 'lv-unranked']));
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
ok(core && core.classList.contains('lv-none'),
   'core with NOTHING logged is grey — no published standards and no work either');

/* 🚨 TRAINED, BUT NOT RANKABLE — the third fill, added 2026-09-04.
 *
 * Core has no published standards, so it can never carry a level. Until today it
 * therefore wore `lv-none`, which is also the fill for a muscle nobody has ever
 * trained — and the key's only grey reads "No data". Somebody who trains abs
 * three times a week was shown the colour of somebody who has never done a
 * sit-up, while the same screen printed the truth in words two lines below.
 *
 * ⚠️ THE ASSERTION DIRECTLY ABOVE IS THE OTHER HALF, AND BOTH ARE LOAD-BEARING.
 * Grey is still right for an unrankable muscle with nothing logged. The bug was
 * one fill carrying two opposite facts, and hatching Core unconditionally would
 * be the same bug pointing the other way — which is what makes this pair, rather
 * than either line alone, the thing that pins the fix.
 */
{
  const plank = byName('Plank');
  const crunch = byName('Cable Crunch');
  for (const [i, ex] of [plank, plank, crunch].entries()) {
    await store.saveSession({
      workoutName: 'Abs', date: `2026-08-2${i + 1}`, startedAt: `2026-08-2${i + 1}T10:00:00.000Z`,
      entries: [{ exerciseId: ex.id, exerciseName: ex.name,
        sets: [{ time: 60 }, { time: 60 }] }],
    });
  }

  const withAbs = await mount(GraphView());
  [...withAbs.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles').click();
  await settle();
  const abs = [...withAbs.querySelectorAll('.body-region')]
    .find((r) => (r.getAttribute('aria-label') || '').startsWith('Core'));

  ok(abs && abs.classList.contains('lv-unranked'),
     `🚨 core with logged work is hatched, not grey (${abs && [...abs.classList].join(' ')})`);
  ok(abs && !abs.classList.contains('lv-none'),
     '🚨 and it is NOT wearing the "no data" fill any more — that was the whole complaint');

  // The hatch is a fill, and a fill says nothing to a screen reader. Whatever
  // the colour does, the name has to carry the same fact.
  ok(abs && /can't be ranked/.test(abs.getAttribute('aria-label') || '')
     && !/nothing recorded/.test(abs.getAttribute('aria-label') || ''),
     `⚠️ its accessible name says trained-but-unrankable, not "nothing recorded" (${abs && abs.getAttribute('aria-label')})`);
  ok(abs && /\d/.test(abs.getAttribute('aria-label') || ''),
     'and it states the set count, so the claim can be checked rather than trusted');

  // A mark with no key entry is a puzzle. The key gains one only when something
  // on the figure is actually wearing it.
  const keyNames = [...withAbs.querySelectorAll('.lv-key-item .lv-name')].map((n) => n.textContent);
  ok(keyNames.some((t) => /Trained/.test(t) && /can't be ranked/.test(t)),
     `🚨 the key names the new mark (${keyNames.join(' · ')})`);
  ok(withAbs.querySelector('.lv-sw.lv-unranked'),
     'and shows the hatch itself beside it, rather than describing it in words alone');

  // The figure's pattern def has to be per-figure: the compare screen draws two
  // of these in one document, and a shared id resolves to the wrong one.
  const pat = withAbs.querySelector('svg.body-map pattern');
  ok(pat && /^hatch-\d+$/.test(pat.id), `the hatch is a pattern def with its own id (${pat && pat.id})`);

  // Tapping it used to say only that it cannot be ranked — a fact about the
  // world rather than about you, and the reason grey felt like it had not
  // noticed. It now says what it HAS got, and none of that needs a standard.
  abs.dispatchEvent(new withAbs.ownerDocument.defaultView.Event('click', { bubbles: true }));
  await settle();
  const logged = withAbs.querySelector('.muscle-logged');
  ok(Boolean(logged), 'tapping it says what HAS been logged');
  ok(logged && /\d+ sets? recorded/.test(logged.textContent),
     `⚠️ as a count of things that happened — no level, no percentile (${logged && logged.textContent.slice(0, 90)})`);
  ok(logged && /Plank/.test(logged.textContent),
     'and names the exercises behind the count, so it is checkable');
  ok(logged && !/percentile|stronger than/i.test(logged.textContent),
     '🚨 and never ranks it against anybody — that is the thing there is no standard for');

  /* 🚨 THE REGRESSION GUARD FOR 2026-09-04's SECOND CHANGE, and it is the whole
   * reason the hatch is computed from "did a rating come out" rather than from
   * the UNRANKABLE list.
   *
   * Core became rankable the same day, off the Cable Crunch. Written the obvious
   * way — hatch the muscles that are in UNRANKABLE — this lifter would have
   * dropped straight back to `lv-none`, "No data", over three sessions a week of
   * planks, because only 8 of the library's 30 core exercises record a weight at
   * all. That is the ORIGINAL bug, reintroduced for the majority of people, and
   * it would have looked like a success: Core would have coloured beautifully
   * for anyone who does cable crunches, which is the smaller group.
   *
   * The assertions above (plank + cable crunch, hatched) and this one (plank
   * only, still hatched) are not duplicates: the first proves the mark exists,
   * this proves it does not depend on the standards table.
   */
  ok(abs && abs.classList.contains('lv-unranked'),
     '🚨 a lifter whose core work is PLANKS is still hatched after Core became rankable — '
     + 'the mark tracks "no rating came out", not "no standard exists"');

  // And the other half: weighted core work now produces a real level.
  const cableCrunch = byName('Cable Crunch');
  await store.saveSession({
    workoutName: 'Abs', date: '2026-08-27', startedAt: '2026-08-27T10:00:00.000Z',
    entries: [{ exerciseId: cableCrunch.id, exerciseName: cableCrunch.name,
      sets: [{ weight: 120, reps: 10 }, { weight: 120, reps: 9 }] }],
  });

  const ranked = await mount(GraphView());
  [...ranked.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles').click();
  await settle();
  const rankedAbs = [...ranked.querySelectorAll('.body-region')]
    .find((r) => (r.getAttribute('aria-label') || '').startsWith('Core'));

  ok(rankedAbs && !rankedAbs.classList.contains('lv-unranked')
     && !rankedAbs.classList.contains('lv-none'),
     `🚨 one cable crunch and Core carries a real level (${rankedAbs && [...rankedAbs.classList].join(' ')})`);

  /* ⚠️ SELECTION IS MODULE STATE AND IT SURVIVES A REMOUNT, so a bare click here
     TOGGLES OFF the Core that an earlier block already selected — which reads as
     "the caveat is missing" and is nothing of the kind. Click until it is
     actually open rather than assuming, and cap it so a genuinely broken panel
     still fails instead of hanging. */
  let warnText = '';
  for (let i = 0; i < 2; i++) {
    warnText = [...ranked.querySelectorAll('.muscle-warn')].map((n) => n.textContent).join(' ');
    if (/rough placing/.test(warnText)) break;
    rankedAbs.dispatchEvent(new ranked.ownerDocument.defaultView.Event('click', { bubbles: true }));
    await settle();
  }
  warnText = [...ranked.querySelectorAll('.muscle-warn')].map((n) => n.textContent).join(' ');

  ok(/rough placing/.test(warnText),
     '⚠️ the panel carries the muscle\'s own caveat — Core\'s standards are thinner than the '
     + `rest, and the number may never appear without saying so (${warnText.slice(0, 90)})`);
  ok(/thinner|one measured source/.test(warnText),
     'and says WHY it is rougher, not just that it is');
}

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
ok(data.querySelectorAll('.seg').length === 5, 'Bars mode keeps the mode switch (five segments since Calendar moved to Profile)');

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

  /* 🔄 ONE PARAGRAPH OF THE NOTES WENT BEHIND A "?" ON 2026-09-09 — the one
   * listing where the ratings, the standards and the estimated 1RM on OTHER
   * screens come from. It is the 2026-09-07 finding in miniature: the copy is
   * not padded, it is mis-placed, and a reader looking at an age chart is not
   * asking it.
   *
   * 🛑 THE THREE PARAGRAPHS ABOUT THIS CHART STAY WHOLE, and the assertions
   * above are what hold them there — Tim carved this section out by name
   * (`docs/direction.md` §4.1), so the tab is still allowed to describe itself
   * sufficiently. What moved is the part that describes something else. */
  ok(!/Marzagão’s 2026 formula/.test(data.textContent),
     '⚠️ the sources for the app\'s OTHER numbers are no longer printed under this chart');
  const srcDot = [...data.querySelectorAll('.research-notes .help-dot')][0];
  ok(Boolean(srcDot), 'a ? beside a short label carries them instead');
  srcDot.click();
  await settle();
  const srcHelp = document.querySelector('.help-pop').textContent;
  ok(/Marzagão/.test(srcHelp) && /Strength Level/.test(srcHelp),
     '🔒 and every source is still there, one tap away — a ? holds words, it does not delete them');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();

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

  /* ⚠️ THE CAVEATS TRAVEL WITH THE NUMBERS. Every one of these is a thing the
     count is doing that a reader would otherwise have to guess at.

     🚨 SINCE 2026-09-07 MOST OF THEM LIVE BEHIND THE "?" AND THESE ASSERTIONS
     OPEN IT. That is a STRONGER check than the one it replaced, not a weaker
     one: it used to be enough for the words to exist somewhere in the pane, and
     now they have to be reachable by the control a reader would actually use.
     A ? that stopped opening would fail here, where before it could not.
     ⚠️ The four facts that stayed on the screen are asserted unopened, first,
     because the split between them is the whole design. */
  const paneText = () => data.querySelector('.vol-pane').textContent;
  ok(/Warm-ups counted/.test(paneText()),
     '⚠️ the screen itself still says warm-ups are counted — the open question, said rather than '
     + 'silently resolved, and short enough to read at a glance');
  ok(/indirect work counts half/.test(paneText()),
     'and that indirect work counts half');
  data.querySelector('.vol-notes .help-dot').click();
  await settle();
  const helpText = document.querySelector('.help-pop').textContent;
  ok(/warm-up from a back-off set/.test(helpText),
     '⚠️ and the ? explains WHY a warm-up cannot be told apart');
  ok(/not a measured fact/.test(helpText),
     'the half-a-set rule is named as a modelling choice, in the words that ship beside the constant');
  ok(/No target line/.test(helpText),
     '🚨 and it says outright that there is no target — the tiers describe what another set buys, '
     + 'and an app that painted 20 sets "good" would be forming an opinion the evidence has not earned');
  ok(/Understated for everyone/.test(helpText),
     'Core says why its own number is low for everyone');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();

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
  if (finishBtn) { finishBtn.click(); await settle(); await saveNow(); }

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
    fin.click(); await settle();
    await saveNow();

    /* ⚠️ ON THE DOCUMENT, NOT ON THE RUNNER NODE, AND THAT IS THE POINT SINCE
       2026-09-07. The save now happens from the save screen, which replaces
       `#app` — so an error element left behind in the runner's DOM would be a
       message written to a screen nobody is looking at, which is the 2026-08-22
       bug exactly: a tap on Save that appears to do nothing. */
    const err = document.querySelector('.save-error');
    ok(err && !err.hidden, 'a save that fails SAYS SO on the screen rather than doing nothing');
    ok(Boolean(err && err.closest('.screen')
       && err.closest('.screen').contains(document.querySelector('.save-screen'))),
       '⚠️ and it says so ON THE SAVE SCREEN — the one the user is looking at when they tap Save');
    ok(/storage may be full/i.test(err.textContent),
       'and it passes on the reason the backend actually gave, not a generic apology');
    // ⚠️ THE LOAD-BEARING ONE. The draft is the only remaining copy of the
    // session, so clearing it before the save has landed would turn a
    // recoverable error into lost training.
    ok(localStorage.getItem(DRAFT) !== null,
       'and the draft is KEPT, because it is the only other copy of what was just done');
    ok(document.querySelector('.finish-hero') === null,
       'and it does not claim the workout was saved');

    // Recovery: the same tap works once the store does. ⚠️ The same tap is now
    // Save on the screen the error is on, not Finish back in the runner —
    // a retry that made you walk the workout again would be its own defect.
    store.saveSession = real;
    await saveNow();
    ok((await store.getSessions()).length === countBefore + 1,
       'tapping Save again after the problem clears saves it, with nothing lost');
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
    /* 🔄 ROW 1 IS COMPARED, NOT ROW 0, SINCE 2026-09-12: set 1 held last time's
       numbers, so it was RECORDED, so opening set 3 LOCKED it — and a locked
       row's text is a <div>, not a disclosure. The lock is asserted beside it. */
    ok(rows()[2].querySelector('.set-pick').getAttribute('aria-expanded') === 'true'
       && rows()[1].querySelector('.set-pick').getAttribute('aria-expanded') === 'false',
       'the row is a disclosure, and says so — a screen reader is told which set is open');
    ok(rows()[0].classList.contains('is-locked')
       && rows()[0].querySelector('.set-lock').getAttribute('aria-label') === 'Unlock set 1',
       '🔒 and set 1, which held last time\'s numbers, LOCKED when set 3 was opened — a set you '
       + 'moved on from is shut until its padlock is tapped');

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

/* ========= a note to the developer (2026-09-04) =========
 *
 * Tim asked for a way for a user to send him an idea from inside the app. What
 * is asserted here is the SCREEN; who may actually read a note is
 * `firestore.rules` and is checked by tests/rules.test.mjs, which runs as
 * somebody who is not you. Both halves are needed and neither substitutes for
 * the other — the whole failure mode this feature has is a screen and a
 * database disagreeing about who the developer is.
 */
{
  const { AccountView, NotesView } = await import(BASE + 'views-account.js');
  const { auth, feedback } = await import(BASE + 'store.js');
  const { DEVELOPER_UID, buildNote } = await import(BASE + 'feedback.js');

  const realState = auth.state.bind(auth);
  const realConfigured = auth.configured;

  /* ---- signed in for real: the form is there ---- */
  auth.configured = () => true;
  auth.state = async () => ({ mode: 'cloud', user: { uid: 'someone', isAnonymous: false, name: 'Alex' } });

  const screen = await mount(AccountView());
  await settle();
  const box = screen.querySelector('textarea[aria-label="Your note to the developer"]');
  ok(Boolean(box), 'a signed-in account gets a note box on the Account screen');
  ok(box && Number(box.getAttribute('maxlength')) === 1000,
     'capped in the markup as well as in the builder and the rule');
  // 🔒 Behind the ? since 2026-09-08, so the assertion opens it — the sentence
  // has to be REACHABLE, which is a stronger claim than present in the pane.
  const noteDot = [...screen.querySelectorAll('.help-dot')]
    .find((d) => /Where this note goes/.test(d.getAttribute('aria-label') || ''));
  ok(Boolean(noteDot), 'with a ? beside the heading');
  noteDot.click();
  await settle();
  ok(/goes\s+straight to the person building it/.test(
       document.querySelector('.help-pop').textContent),
     'and it says where the note goes');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  ok(![...screen.querySelectorAll('a')].some((a) => a.getAttribute('href') === '#/notes'),
     '🚨 and an ordinary account is NOT offered the inbox link');

  /* 🚨 NO "LEFT ON THIS DEVICE", AND NO BUTTON — 2026-09-08, Tim's instruction.
     Creating an account carries this device's rows up on its own
     (`absorbThisDevice` in store.js), so a signed-in person is never asked to
     file their own data. Asserted on the SCREEN rather than on the store,
     because what he objected to was the card. */
  ok(!/Left on this device/i.test(screen.textContent),
     '🚨 a signed-in account is never shown a "Left on this device" card');
  ok(![...screen.querySelectorAll('button')].some((b) => /^Upload /.test(b.textContent)),
     '…nor any button asking them to upload it themselves — creating the account did that');

  /* ---- the developer gets one more control ---- */
  auth.state = async () => ({
    mode: 'cloud', user: { uid: DEVELOPER_UID, isAnonymous: false, name: 'Tim' },
  });
  const devScreen = await mount(AccountView());
  await settle();
  ok([...devScreen.querySelectorAll('a')].some((a) => a.getAttribute('href') === '#/notes'),
     'the developer\'s own account is offered the inbox');

  /* ---- and every refusal says which one it is ----
   *
   * ⚠️ THE STATE IS RESOLVED BEFORE THE BOX IS DRAWN, and these assert that: a
   * textarea somebody fills in and then cannot send is worse than no textarea,
   * because the refusal arrives after the effort rather than before it. */
  /* 🚨 `isAnonymous`, AND THE FIELD NAME IS THE ASSERTION.
   *
   * These three lines passed against `anonymous: true` while the app was broken,
   * because the store read `a.user.anonymous` — always undefined — and the mock
   * had been written to match the store rather than the store's INPUT. So the
   * guard never fired in the real app: an anonymous account was offered the box
   * and its note would have arrived from a browser profile that will be lost,
   * with nobody to reply to. Found by driving the real app against the real
   * project; 941 jsdom assertions were green over it.
   *
   * ⚠️ THE LESSON IS ABOUT MOCKS, NOT ABOUT THIS FIELD. A mock is a claim about
   * what the real thing produces, and a mock copied from the consumer proves
   * only that the consumer agrees with itself. `auth.state()` is what defines
   * this shape — `firebase-backend.js` sets `isAnonymous` — so that is the name
   * a test must use even when the code under test spells it wrong. */
  auth.state = async () => ({ mode: 'cloud', user: { uid: 'anon-1', isAnonymous: true } });
  const anon = await mount(AccountView());
  await settle();
  ok(!anon.querySelector('textarea[aria-label="Your note to the developer"]'),
     '🚨 an anonymous account gets no box…');
  ok(/nobody to reply to/.test(anon.textContent), '…and is told why, in terms of the fix');

  auth.state = async () => ({ mode: 'local', user: null, reason: 'offline' });
  const off = await mount(AccountView());
  await settle();
  ok(/rather than queued/.test(off.textContent),
     '⚠️ offline explains that notes are NOT queued — otherwise somebody types one, closes the '
     + 'app and believes they were heard');

  /* ---- the inbox is empty for everybody but the developer, and says nothing ---- */
  auth.state = async () => ({ mode: 'cloud', user: { uid: 'someone', isAnonymous: false } });
  const notMine = await mount(NotesView());
  await settle();
  ok(/nothing on this screen/i.test(notMine.textContent),
     '🚨 a non-developer who types #/notes sees an empty screen that does not mention notes — '
     + 'a screen saying "you are not the developer" confirms there is something worth being');
  ok(!/No notes have been sent/.test(notMine.textContent),
     'and specifically not the developer\'s own empty state');

  /* ---- a note reaches the inbox, and its text is never markup ---- */
  const built = buildNote({
    text: '<img src=x onerror=alert(1)>\nsecond line',
    uid: 'someone', name: 'Alex', now: '2026-09-04T10:00:00.000Z',
  });
  ok(built.ok, 'a note containing markup still builds — it is text, and refusing it would be odd');

  const realList = feedback.list;
  feedback.list = async () => [{ id: 'n1', ...built.note }];
  auth.state = async () => ({ mode: 'cloud', user: { uid: DEVELOPER_UID, isAnonymous: false } });
  const inbox = await mount(NotesView());
  await settle();
  const bodyEl = inbox.querySelector('.note-body');
  ok(Boolean(bodyEl), 'the developer sees the note');
  ok(bodyEl && bodyEl.querySelector('img') === null,
     '🚨 and its markup is NOT rendered — this is the only free text in the app written by one '
     + 'person for another to read, so `text` rather than `html` is load-bearing here');
  ok(bodyEl && /onerror=alert\(1\)/.test(bodyEl.textContent),
     'it is shown as the characters they typed');
  ok(/Alex/.test(inbox.textContent), 'attributed to whoever sent it');

  feedback.list = realList;
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
  /* 🔄 YEARS IS THE DEFAULT SINCE 2026-09-12, ~~"and opens on Months, which is
     what it has always been"~~. Tim: *"make the year display the default for the
     calendar in all scenarios."* His report was about the Profile tab, where the
     calendar cannot be landed on arrival and Months therefore opened on the
     earliest month drawn; the default is one variable for every door.

     ⚠️ THIS IS THE FIRST TIME THE SWITCH IS TOUCHED IN THIS FILE, so this is the
     one assertion that reads `calMode`'s INITIAL value — every later "opens on
     Years" (the Profile block, the friend block) is reading whatever the block
     before it left in memory. Mutation-checked 2026-09-12: flipping the
     declaration back to 'months' fails this line and no other own-calendar line. */
  ok(screen.querySelectorAll('.yr-grid').length >= 2 && !screen.querySelector('.cal-month'),
     '🚨 opens on YEARS — a grid for this year and last, and no month blocks — the default on '
     + 'every door since 2026-09-12');
  ok(segs().find((b) => b.textContent === 'Years').getAttribute('aria-selected') === 'true',
     'and the switch says so');

  /* ---- Months, on a tap, lands on the current month ---- */
  segs().find((b) => b.textContent === 'Months').click();
  await settle();
  ok(screen.querySelectorAll('.cal-month').length > 0 && !screen.querySelector('.yr-grid'),
     'tapping Months draws the month blocks and drops the grids');
  {
    const current = screen.querySelector('.cal-month[data-current-month]');
    ok(current && !current.nextElementSibling,
       '⚠️ the current month is the LAST block, so earlier months are reached by scrolling UP — '
       + 'Tim: "the viewer can scroll up for earlier months"');
    /* ⚠️ THE STRUCTURE, NOT THE PIXELS. jsdom lays nothing out — every rect is
       zero and `scrollTop` never moves — so whether the heading actually came to
       rest at the top of the pane is the browser's to show (it was measured on
       2026-08-21, when the clamp was found). What can be pinned is which section
       the scroller was AIMED at: `landOnCurrentMonth` stamps it. */
    ok(current && current.dataset.landed === 'true',
       '🚨 and the scroller was aimed at it — the tap landed on the current month');
  }

  segs().find((b) => b.textContent === 'Years').click();
  await settle();

  ok(screen.querySelectorAll('.yr-grid').length >= 2,
     'switching back to Years draws a grid for this year and last');
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

  /* 🚨 AND THE OTHER DIRECTION — WHAT A CHART PRINTS (2026-09-06).
   *
   * The stepper above has respected the unit setting since kg shipped. The
   * GRAPH did not: `fmtField()` read `FIELD_META.weight.unit`, a hard-coded
   * 'lbs', so the hover readout printed the stored pounds figure and labelled it
   * lbs, to somebody who saw kg everywhere else in the app.
   *
   * ⚠️ IT IS THE ONE KIND OF BUG NOTHING ELSE HERE COULD CATCH: the number was
   * right, the chart's shape was right, and the app was internally consistent
   * with its own storage. Only a reader on kg would ever see it, and this suite
   * has always run in pounds. */
  const { fmtField } = await import(BASE + 'ui.js');

  u.setUnits('kg');
  ok(/kg/.test(fmtField('weight', 220.46)) && !/lbs/.test(fmtField('weight', 220.46)),
     `🚨 a charted weight is printed in the reader's own unit (${fmtField('weight', 220.46)}), not `
     + 'in the pounds it happens to be stored as');
  ok(/^100\b/.test(fmtField('weight', 220.46)),
     '⚠️ and CONVERTED, not merely relabelled — 220.46 lb reads 100, which is the assertion that '
     + 'would catch somebody fixing the unit string and leaving the number alone');

  u.setUnits('lbs');
  ok(/^135 lbs$/.test(fmtField('weight', 135)),
     'the vacuity guard: in pounds it is unchanged, so the two units really are being told apart');
  ok(fmtField('distance', 3) === '3.00 mi',
     '⚠️ distance keeps its literal on purpose — miles is the only unit the app stores or shows for '
     + 'it, so there is no setting for it to disagree with');
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

  /* ── 🚨 A SYSTEM OPENS AND CLOSES, ON BOTH SCREENS (2026-09-16) ───────────
   *
   * Tim: *"In the workouts section as well as the record section, it shows the
   * list of systems you have as well as the workouts within each of them. I
   * want you to be able to click on the system in order to close or open the
   * display of the workouts within them in both sections."*
   *
   * ⚠️ `details.open` IS THE ONLY HONEST READING OF "CLOSED" HERE, and this
   * project has already written down why: a closed `<details>` still reports a
   * box for its contents in the audit's Chrome — it hides them with
   * `content-visibility`, not `display: none` — and jsdom lays nothing out at
   * all, so a rect proves nothing in either engine. The element's own state is
   * the one thing both agree on.
   *
   * ⚠️ AND EVERY FOLD BELOW IS DRIVEN BY A CLICK ON THE SUMMARY, never by
   * setting `.open`. A test that sets the property itself passes happily over a
   * summary nobody can actually reach with a finger.
   */
  {
    const recGroups = (root) => [...root.querySelectorAll('details.sys-group')];
    const groups0 = recGroups(start);

    ok(groups0.length === heads.length,
       `⚠️ every system on Record is a disclosure, one per heading (${groups0.length} of ${heads.length})`);
    ok(groups0.every((d) => d.querySelector('summary.sys-head')),
       '⚠️ and the control IS the heading — the same `.sys-head` the 2026-08-25 note put there, now a '
       + '<summary>, rather than a second thing beside it to aim at');
    ok(groups0.every((d) => d.open),
       '🚨 and every one of them ARRIVES OPEN. Record is one tap from a workout in a gym (D4) and most '
       + 'people have one system: a fold on arrival adds a tap to the most consequential path in the app '
       + 'and hands a one-system user a closed door to their own workouts');
    ok(groups0.every((d) => d.querySelectorAll('.list .row').length > 0),
       'each group still holds its workout rows');
    ok(groups0.every((d) => [...d.querySelectorAll('.list .row')].every((r) => /Start/.test(r.textContent))),
       '⚠️ and every row inside still SAYS Start — wrapping the list in a disclosure did not swallow the '
       + 'one word that says this begins a session');

    /* Tapping the heading opens and shuts it, and that is the whole request. */
    const closedId = groups0[0].dataset.sys;
    groups0[0].querySelector('summary').click();
    await settle();
    ok(recGroups(start)[0].open === false,
       '🚨 tapping a system on Record CLOSES the workouts under it');
    recGroups(start)[0].querySelector('summary').click();
    await settle();
    ok(recGroups(start)[0].open === true, 'and tapping it again opens them back up');

    /* ⚠️ IT SURVIVES A RE-RENDER, which is the half of this that is not free.
     * The state lives outside the view; without that, any unrelated repaint
     * springs every system back open and the person folds the same programme
     * away over and over. */
    recGroups(start)[0].querySelector('summary').click();
    await settle();
    const start2 = await mount(StartPickerView());
    const g2 = recGroups(start2).find((d) => d.dataset.sys === closedId);
    ok(g2 && g2.open === false,
       '🚨 and the fold SURVIVES A RE-RENDER — the memory is outside the view, or every unrelated repaint '
       + 'undoes the choice');

    /* 🚨 AND THE TWO SCREENS DO NOT SHARE ONE MEMORY. Which programmes I have
     * folded away while browsing my library says nothing about what I want in
     * front of me mid-gym. `friendCalMode` exists in views-data.js for exactly
     * this reason, and a mutation check is what proved one shared memory let
     * one screen contaminate the other. */
    const wlist = await mount(WorkoutsView());
    const wGroups = recGroups(wlist);
    ok(wGroups.length > 0, `the Workouts tab lists its systems as disclosures too (${wGroups.length})`);
    const twin = wGroups.find((d) => d.dataset.sys === closedId);
    ok(twin && twin.open,
       '🚨 and the system folded away on RECORD is still open on the Workouts tab — two memories, not one');

    // Now the same journey in the other direction.
    twin.querySelector('summary').click();
    await settle();
    ok(twin.open === false, 'tapping a system on the Workouts tab closes it as well — one mechanism, both screens');
    const wlist2 = await mount(WorkoutsView());
    const twin2 = recGroups(wlist2).find((d) => d.dataset.sys === closedId);
    ok(twin2 && twin2.open === false, 'and that fold survives a re-render of the Workouts tab');

    /* ⚠️ THE ROW STILL SAYS EVERYTHING IT SAID, and the workouts are REAL ROWS
     * now rather than only names in a subtitle. */
    const sumText = twin2.querySelector('summary').textContent.replace(/\s+/g, ' ');
    ok(/Push/.test(sumText) && /Legs/.test(sumText) && /·/.test(sumText),
       '⚠️ the row still previews its workouts in the subtitle — a collapsed system must not say LESS '
       + 'than the row said before the fold existed');
    twin2.querySelector('summary').click();
    await settle();
    const kidText = twin2.textContent.replace(/\s+/g, ' ');
    ok(/\d+ exercises?/.test(kidText) && /\d+ sets?/.test(kidText),
       '⚠️ and opening it gives each workout the exercise and set counts the system screen gives it — '
       + 'one workout described one way, wherever it appears');

    /* 🚨 THE ROUTE THE ROW USED TO BE IS STILL REACHABLE. The summary opens and
     * closes now, so it cannot also navigate; `#/system/<id>` is where Edit,
     * Notes, New workout and the full rating live. A feature that quietly
     * deleted a screen would not be a feature. */
    const hashBefore = window.location.hash;
    twin2.querySelector('summary').click();
    await settle();
    ok(window.location.hash === hashBefore,
       '⚠️ tapping the system itself navigates NOWHERE — it opens and closes, which is the whole change');
    twin2.querySelector('summary').click();
    await settle();
    const opener = [...twin2.querySelectorAll('.list .row')]
      .find((r) => /Open this system/.test(r.textContent));
    ok(Boolean(opener),
       '🚨 and `#/system/<id>` survives as the last row of the group rather than being dropped with the tap');
    opener.click();
    await settle();
    ok(window.location.hash === '#/system/' + closedId,
       `and it really goes there (${window.location.hash})`);
    window.location.hash = '#/workouts';
    await settle();
  }
}


/* ================= a system's weekly plan, as boxes ================= */
/* 2026-09-16, Tim: *"If the workout system does have this daily planner then
   show it as boxes at the top of the workout system when you click on it in the
   'workouts' section."* Two kinds — seven weekdays, or N repeating cycle days —
   each slot holding one of that system's workouts or Rest.

   ⚠️ THE POSITION TEST ABOVE ("the workouts are the first thing in the pane")
   IS NOT RELAXED BY ANY OF THIS AND MUST NOT BE. It runs on a system with no
   plan, which is every system that existed yesterday, and it still passes
   unchanged. The plan takes first position ONLY when there is one. */
{
  const { REST } = await import(BASE + 'schedule.js');
  const sys = await store.saveSystem({ name: 'Plan test' });
  const mk = (name, ex) => store.saveWorkout({
    name, systemId: sys.id, exercises: [{ exerciseId: byName(ex).id, sets: 3 }],
  });
  const push = await mk('Push', 'Barbell Bench Press');
  const pull = await mk('Pull', 'Barbell Row');
  const legs = await mk('Legs', 'Back Squat');

  /* ---- a system with no plan is completely unchanged ---- */
  {
    const node = await mount(SystemRouteView(sys.id));
    ok(!node.querySelector('.plan-grid'),
       'a system with no plan draws no boxes — nothing prompts for one');
    const first = node.querySelector('.pane-scroll .section-label');
    ok(first && /workout/i.test(first.textContent),
       'and its workouts are still the first thing in the pane');
  }

  /* ---- the boxes ---- */
  await store.saveSystem({ ...sys, schedule: { kind: 'week',
    slots: [push.id, pull.id, legs.id, REST, push.id, null, REST] } });
  {
    const node = await mount(SystemRouteView(sys.id));
    const boxes = [...node.querySelectorAll('.plan-day')];
    ok(boxes.length === 7, `a weekly plan draws a box for every day (${boxes.length})`);
    ok(node.querySelector('.pane-scroll > *').classList.contains('plan'),
       '🚨 and the plan is the FIRST thing in the pane — "boxes at the top of the workout system" '
       + 'is the position Tim asked for, and on a phone first is the only position that means anything');
    ok(/Weekly plan/.test(node.textContent), 'headed as a weekly plan');
    ok(boxes.map((b) => b.querySelector('.plan-dow').textContent).join(' ')
         === 'Mon Tue Wed Thu Fri Sat Sun',
       'labelled Monday through Sunday, in that order');
    ok(boxes[0].querySelector('.plan-slot').textContent === 'Push',
       'a training day names the workout it holds');

    const rest = boxes[3].querySelector('.plan-slot');
    ok(rest.textContent === 'Rest' && rest.classList.contains('is-rest'),
       '⚠️ a REST day is a box that is present and says Rest — "visibly empty rather than missing". '
       + 'A grid that skipped its rest days would make a 6-day split read as a 6-day week');
    const none = boxes[5].querySelector('.plan-slot');
    ok(none.textContent === '—' && none.classList.contains('is-none'),
       '🛑 and a day nothing has been said about is a DIFFERENT box from a rest day. Printing "Rest" '
       + 'for both would be the app inventing a rest day nobody chose (Rule 6)');
    ok(boxes[5].getAttribute('aria-label') === 'Saturday: nothing planned'
       && boxes[3].getAttribute('aria-label') === 'Thursday: rest'
       && boxes[0].getAttribute('aria-label') === 'Monday: Push',
       '⚠️ each box is ONE phrase to a screen reader — read as two nodes a grid says "Mon" and "Push" '
       + 'as unrelated things, and "—" is not a word at all');

    ok(!/today|day \d+ of|behind|on track|streak/i.test(node.textContent),
       '🛑 NOTHING on the screen says what day it is today, how far through the cycle you are, or '
       + 'whether the plan was followed. Tim chose display-only and Rule 6 forbids the verdict');

    const dot = [...node.querySelectorAll('.help-dot')]
      .find((d) => /plan/i.test(d.getAttribute('aria-label') || ''));
    ok(Boolean(dot), 'the plan carries a ? beside its own label, not off on the right (Rule 9)');
    dot.click();
    await settle();
    const pop = document.querySelector('.help-pop');
    ok(pop && /longest without doing/.test(pop.textContent),
       '🚨 and behind it, in words, that the plan does NOT drive what the app suggests next — a reader '
       + 'is entitled to assume the opposite, so the one thing it cannot do is the thing that is said');
    dot.click();
    await settle();
  }

  /* ---- a slot naming a workout that is gone reads as unset, never throws ---- */
  await store.saveSystem({ ...sys, schedule: { kind: 'week',
    slots: ['w-does-not-exist', pull.id, null, REST, null, null, null] } });
  {
    const node = await mount(SystemRouteView(sys.id));
    const boxes = [...node.querySelectorAll('.plan-day')];
    ok(boxes.length === 7 && boxes[0].querySelector('.plan-slot').textContent === '—',
       '⚠️ a slot naming a workout that no longer exists reads as unset rather than blanking the '
       + 'screen — the store repairs the row on deletion, but a restored backup can still arrive here');
    ok(boxes[0].getAttribute('aria-label') === 'Monday: nothing planned',
       'and says so rather than reading out a dead id');
  }

  /* ---- fourteen days, the case that breaks a phone ---- */
  await store.saveSystem({ ...sys, schedule: { kind: 'cycle',
    slots: new Array(14).fill(null).map((_, i) => (i % 4 === 3 ? REST : [push.id, pull.id, legs.id][i % 3])) } });
  {
    const node = await mount(SystemRouteView(sys.id));
    const boxes = [...node.querySelectorAll('.plan-day')];
    ok(boxes.length === 14, `a 14-day cycle draws fourteen boxes (${boxes.length})`);
    ok(/14-day cycle/.test(node.textContent), 'headed by its own length rather than "cycle"');
    ok(/Repeats every 14 days/.test(node.textContent),
       'and says it repeats — "repeat" is the word in Tim\'s own example and it is the whole of what '
       + 'a cycle means');
    ok(boxes[13].querySelector('.plan-dow').textContent === 'Day 14',
       'counting to Day 14');
    ok(!node.querySelector('.plan-grid').className.includes('scroll'),
       '⚠️ and it is a WRAPPING grid, not a sideways scroller — jsdom cannot measure it, so the widths '
       + 'are pinned in tests/a11y.test.mjs and the 360px case is driven in a browser');
  }

  /* ---- the form behind the pencil is where it is built ---- */
  {
    const ed = await mount(SystemRouteView(sys.id + '/edit'));
    const kind = [...ed.querySelectorAll('select')]
      .find((s) => s.getAttribute('aria-label') === 'Kind of plan');
    ok(Boolean(kind), 'the plan is edited on the FORM behind the pencil, not on the screen it is drawn on');
    ok(kind.value === 'cycle', 'and it opens showing the plan that is saved');
    ok(ed.querySelectorAll('.plan-row').length === 14,
       `one row per day, all fourteen of them (${ed.querySelectorAll('.plan-row').length})`);

    const opts = [...ed.querySelector('.plan-row select').options].map((o) => o.textContent);
    ok(opts[0] === 'Nothing planned' && opts[1] === 'Rest'
       && opts.includes('Push') && opts.includes('Pull') && opts.includes('Legs'),
       `⚠️ every day offers THREE kinds of answer — nothing, Rest, or one of this system's workouts — `
       + `for the same reason the boxes print two different words (${opts.join(', ')})`);

    const grow = [...ed.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === 'One more day in the cycle');
    ok(Boolean(grow), 'a cycle\'s length is a stepper, and it reads in the singular');
    const sel0 = ed.querySelector('.plan-row select');
    const before = sel0.value;
    grow.click();
    await settle();
    ok(ed.querySelectorAll('.plan-row').length === 14,
       'which is already at the 14-day ceiling, so pressing + changes nothing');
    ok(ed.contains(grow),
       '🚨 and the stepper itself is not rebuilt by its own press — replacing the node holding focus '
       + 'gives a keyboard user exactly one press and no second one');
    ok(ed.querySelector('.plan-row select').value === before,
       '⚠️ and resizing reads the CURRENT plan, not the one this handler was built with. A handler '
       + 'created once and pressed many times that resizes a captured copy throws away everything '
       + 'typed between the first press and the second');

    // Turning the plan off must actually take it off the row.
    kind.value = '';
    kind.dispatchEvent(new window.Event('change'));
    await settle();
    ok(!ed.querySelector('.plan-row'), 'choosing "No plan" clears the day rows');
    const save = [...document.querySelectorAll('button')].find((b) => /Save changes/.test(b.textContent));
    save.click();
    await settle();
    await settle();
    ok(!('schedule' in (await store.getSystem(sys.id))),
       '🚨 and saving REMOVES the schedule from the row rather than leaving an empty one behind — '
       + 'absent is the shape that means "no plan", so a switched-off plan has to reach it');
    ok(!(await mount(SystemRouteView(sys.id))).querySelector('.plan-grid'),
       'so the boxes are gone from the system screen too');
  }

  await store.deleteSystem(sys.id);
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
    if (f2) { f2.click(); await settle(); await saveNow(); }

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

    // ⚠️ The locked rule (docs/handbook.md §6): a drop set is ONE hard set. If drops
    // were rows in `sets` this count would read 3 and every volume figure in
    // the app would inflate the day someone used the feature.
    ok(s.querySelectorAll('.set-item:not(.set-drop)').length === 2,
       'the set list still shows two sets, not three');

    const finish = btn(s, /Finish workout/);
    if (finish) { finish.click(); await settle(); await saveNow(); }
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
    if (finish) { finish.click(); await settle(); await saveNow(); }
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
    if (finish) { finish.click(); await settle(); await saveNow(); }
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
    if (finish) { finish.click(); await settle(); await saveNow(); }
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

  /* ⚠️ THE BADGE RIDES ON THE SUMMARY, NOT INSIDE THE FOLD (2026-09-16). It
     describes the whole programme and it is what Tim asked to see on the list
     before opening anything — pushed inside the disclosure, a folded system
     would show none of its four numbers, which is the state most of a long
     list will be in. */
  ok(Boolean(list.querySelector('details.sys-group > summary .rating')),
     'the rating badge sits on the row that opens and closes, not in what it hides');

  /* ⚠️ AN EMPTY SYSTEM IS NOT A DISCLOSURE. There is nothing under it to
     unfold, and a chevron that turns to reveal nothing is a control lying about
     having something. It stays the plain link it has always been — which is
     also the only place to add the workouts it is missing. */
  const emptyRow = [...list.querySelectorAll('.row')].find((r) => /Nothing here/.test(r.textContent));
  ok(emptyRow && emptyRow.tagName === 'BUTTON' && !emptyRow.closest('details'),
     'a system with no workouts in it is still a row that goes into the system, not an empty fold');

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
  /* ⚠️ SPLIT ACROSS THE "?" SINCE 2026-09-07, and the split is the assertion:
     the REFUSAL stays on the screen, because a reader who does not know the app
     is declining to judge will read the numbers under it as a verdict; the
     reasoning is one tap away. Both are still required to exist. */
  ok(/measured, not judged/i.test(live),
     'it states outright on the screen that it will not give an on-track verdict yet');
  goals.querySelector('.goal-verdict .help-dot').click();
  await settle();
  ok(/bad Tuesday/i.test(document.querySelector('.help-pop').textContent),
     'and the ? still gives the reason — a day-to-day estimate swings several percent');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();

  /* 🚨 AND THE WEIGHTS BLOCK SPLIT THE SAME WAY ON 2026-09-09 — four paragraphs
   * and ~150 words down to three short sentences, with the mechanism behind a ?.
   *
   * ⚠️ THE HALF THAT STAYED IS THE SAFETY CLAIM, and it is asserted ON the pane
   * rather than through the dot: somebody who set a goal and then sees the runner
   * pre-fill a heavier weight has every reason to think the two are connected,
   * and that belief is the only thing in this app that could get somebody hurt
   * (docs/goals-plan.md §3.1). It may not be one tap away. */
  ok(/never touches that number/i.test(live)
     && /Nothing gets heavier because a deadline is close/i.test(live),
     '🚨 the weights block still says on the screen that the goal does not set the weights, and '
     + 'that nothing gets heavier because a deadline is close');
  ok(!/ACSM position stand recommends/.test(live),
     '⚠️ while the mechanism — the rep ladder and the 2–10 % band — is no longer printed in front '
     + 'of somebody reading their own progress');

  const weightsDot = [...goals.querySelectorAll('.help-dot')]
    .find((d) => /weight suggestion/i.test(d.getAttribute('aria-label') || ''));
  ok(Boolean(weightsDot), 'with a ? beside the label instead');
  weightsDot.click();
  await settle();
  const wHelp = document.querySelector('.help-pop').textContent;
  ok(/2–10 %/.test(wHelp) && /ACSM/.test(wHelp),
     'which carries the band a step has to land inside, and whose it is');
  ok(/only ever take a step away/.test(wHelp)
     && /nobody has measured by how much/.test(wHelp),
     '🛑 AND THE LAY-OFF REFUSAL WORD FOR WORD — a refusal behind a ? is still stated, and a '
     + 'refusal reworded is not the same refusal');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();

  /* 🆕 AND SINCE 2026-09-06 IT SAYS WHAT HAS MOVED. The refusal above was always
     right and the BLANK under it was not (docs/direction.md §3.1) — so the
     screen now subtracts two numbers it already holds and states the noise floor
     in the same breath, leaving the conclusion to the reader. Rule 6 exactly:
     report the measurement, withhold the opinion. */
  ok(/where it started|unchanged to the nearest pound/i.test(live),
     'a goal set today reports no movement yet, and says so as a measurement rather than leaving a '
     + 'gap somebody reads as broken');

  // Now move it: a heavier benchmark after the goal was set.
  await store.saveBenchmark({
    date: todayISO(), exerciseId: b.id, exerciseName: b.name,
    values: { weight: 245, reps: 3 },
  });
  const moved = text(await mount(GoalsView()));
  ok(/has gone from/i.test(moved),
     '🚨 and once the estimate really moves it prints the change — the screen used to explain why '
     + 'it would not judge and then say nothing at all');
  ok(/estimate/i.test(moved) && /not a tested max|neither is a tested max/i.test(moved),
     '⚠️ with BOTH ends named as estimates (Rule 5) — a lifter who never tested a max must not read '
     + 'this as two measurements');
  ok(/inside that|is larger than that/i.test(moved),
     'and against a stated yardstick, so a move smaller than the noise is not read as progress');

  const movedNoVerdict = (await mount(GoalsView()));
  movedNoVerdict.querySelectorAll('.goal-verdict').forEach((n) => n.remove());
  ok(!/behind|on track|ahead of/i.test(text(movedNoVerdict)),
     '🛑 AND STILL NOT ONE VERDICT WORD OUTSIDE THAT BLOCK. This is the assertion that would catch '
     + 'the movement line quietly growing into the verdict the estimator has not earned yet');

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

  /* 🔒 BEHIND THE "?" SINCE 2026-09-08 (Tim named this card), AND THESE
     ASSERTIONS WERE STRENGTHENED RATHER THAN RELAXED — Rule 9. They used to
     read the words off the pane; they now have to FIND the control, open it and
     read them back, so "reachable" is asserted as well as "present". */
  const demoDot = [...account.querySelectorAll('.help-dot')]
    .find((d) => /What the demo account is/.test(d.getAttribute('aria-label') || ''));
  ok(Boolean(demoDot), 'with a ? beside it rather than two paragraphs under it');
  demoDot.click();
  await settle();
  const demoHelp = document.querySelector('.help-pop').textContent;
  ok(/nothing is saved/i.test(demoHelp),
     'and it still says before you tap it that nothing in there is kept');
  ok(/Your own data is untouched/i.test(demoHelp),
     'and that your own data is safe, which is the other thing to say first');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();

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
  // Same move, same rule: the words are one tap away rather than three
  // paragraphs deep, and the test opens the tap.
  const inDemoDot = inDemo.querySelector('.help-dot');
  ok(Boolean(inDemoDot), 'and a ? rather than three paragraphs restating the demo bar');
  inDemoDot.click();
  await settle();
  const inDemoHelp = document.querySelector('.help-pop').textContent;
  ok(/starts it over/i.test(inDemoHelp), 'which still says that a reload starts over');
  ok(/Social is switched off/i.test(inDemoHelp),
     '🚨 and that Social is off — named here rather than discovered by tapping it');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();

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
  await finishAndSave(s);
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
  await finishAndSave(s);
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
  await finishAndSave(s2);
  await settle();

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
  await finishAndSave(s3);
  await settle();

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

  /* ⚠️ THE LOCATION IS ASKED AT THE END SINCE 2026-09-07, not in the runner's
     header — Tim's instruction. Everything below it is unchanged behaviour
     asserted through the new control: it still carries forward, still saves on
     the row, still writes ABSENT rather than "" when cleared, and a workout
     logged without one still does not wipe the default. */
  const gymBox = () => document.querySelector('[aria-label="Where this workout happened"]');

  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  ok(!s.querySelector('.session-loc'),
     '⚠️ the runner no longer asks where you are mid-workout');
  const draft = JSON.parse(localStorage.getItem(DRAFT));
  ok(draft && draft.location === 'The garage', 'the carried label is on the draft from the start');

  const wv = s.querySelector('.step-value');
  wv.value = '105';
  wv.dispatchEvent(new window.Event('blur', { bubbles: false }));
  await settle();

  [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle();
  ok(Boolean(gymBox()), 'the save screen asks where it was');
  ok(gymBox().value === 'The garage',
     'and it carries forward from the last session — one gym costs zero taps forever');
  await saveNow();
  await settle();

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
  await finishAndSave(s3);
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
  ok(JSON.parse(localStorage.getItem(DRAFT)).location === 'The garage',
     '⚠️ the next workout still opens at The garage, even though the one before it was '
     + 'saved with no location at all — blank is "not this one", never "forget where I train"');

  // Typing a different gym is what moves it, and it moves immediately rather
  // than at Finish: somebody who types it and abandons the session has still
  // told the app where they train.
  const st = await import(BASE + 'store.js');
  await st.store.saveSettings({ defaultLocation: 'Iron Works' });
  localStorage.removeItem(DRAFT);
  const s5 = await mount(SessionView(w.id));
  ok(JSON.parse(localStorage.getItem(DRAFT)).location === 'Iron Works',
     'and changing it is one edit that sticks from then on');
  void s5;
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
    await finishAndSave(s);
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
    /* ⚠️ THE CAPTION NO LONGER EXPLAINS THE BUTTON — 2026-09-08. It read
       "Edit to move or resize the circle" directly under a button labelled
       Edit, which is the shape of wordiness Tim pointed at. What it must
       still carry is WHO CAN SEE THE PHOTO: that is WHAT rather than WHY, so
       Rule 9 keeps it on the screen and out of a ?. */
    ok(/friends you are connected to/.test(text(withPhoto)),
       '🚨 and the caption still says who can see it — visibility never goes behind a ?');
    ok(!/Edit to move or resize/.test(text(withPhoto)),
       '…while the sentence explaining the button beside it is gone, not hidden');

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
  /* 🔄 ~~"and Goals stays — it is not an account detail"~~ **INVERTED
     2026-09-11**, step 4 of the Data/Profile split. Goals was here because
     2026-08-25 took it off the tab bar and Settings was the way in it was given;
     `direction.md` §4b puts it on Profile, and a MOVE means the old door closes.
     ⚠️ THE PAIR IS THE POINT — "not on Settings" alone is satisfied by deleting
     Goals altogether, which is why the row on `#/me` is asserted in the Profile
     block below and the route is asserted to still resolve there too. */
  ok(![...st.querySelectorAll('a.row')].some((a) => a.getAttribute('href') === '#/goals'),
     '🔄 and Goals is NOT on Settings any more — it moved to the Profile tab, and a move that '
     + 'leaves the old door open is two answers to "where are my goals"');

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

  /* ================= 🚨 IT COMES UP, AND THE ARROW PUTS IT BACK DOWN ==========
   *
   * Tim, 2026-09-09: *"To make the record section feel more like a button that
   * actually activates something, I want the screen to pull up the record
   * section from the bottom (which covers over the main section display). The
   * only change is that we'll add a down arrow in the upper left which will push
   * the record section back down, showing the main section display and
   * automatically being selected on 'home'."*
   *
   * ⚠️ jsdom CANNOT SEE THE MOVEMENT and is not asked to. What it can hold is
   * everything that would still be wrong if the animation were perfect: which
   * control is in the corner, what it is called, and where it goes.
   */
  {
    const corner = chooser.querySelector('.topbar button');
    ok(corner && corner.getAttribute('aria-label') === 'Close',
       '🚨 the top-left of Record is a DOWN arrow, not the avatar — the corner holds one thing, and '
       + 'on a panel that came up over something the thing it holds is the way back down');
    ok(!chooser.querySelector('.topbar .avatar-btn'),
       '⚠️ and the profile button is genuinely gone from it rather than sitting behind the arrow — '
       + 'two controls in one corner is how somebody taps the wrong one');

    window.location.hash = '#/graphs';
    await settle();
    corner.click();
    await settle();
    ok(window.location.hash === '#/home',
       '🚨 AND IT LANDS ON HOME, NOT WHERE YOU CAME FROM. That is Tim\'s instruction and it is why '
       + 'this is `down` rather than `back`: Rule 8 says a back arrow returns to the screen you were '
       + 'just on, and a panel you put away leaves you at the top of the app');

    /* 🔒 THE GUARD THAT KEEPS EVERY OTHER TEST IN THIS FILE HONEST. `parkScreen()`
     * builds a second, whole `.screen` on `document.body` for the length of the
     * animation — so in a harness it would double every selector in the suite,
     * silently, from whichever block ran next. It refuses to build one where
     * nothing can animate, and this is the assertion that says so. */
    ok(!document.querySelector('.screen-ghost'),
       '🔒 and NO parked screen is ever built in jsdom — a ghost here would be a second copy of a '
       + 'whole screen that every later selector would match');
  }

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
  await finishAndSave(s);
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
    await finishAndSave(s);
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

    await finishAndSave(s);
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
    await finishAndSave(s);
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
  // 🔄 The ▲▼ buttons are gone (2026-09-12); the grip's ArrowUp / ArrowDown is
  // the keyboard path. `.click()` presses the key, `.disabled` is "at an end" —
  // so every assertion below that drove the arrows drives the keys unchanged.
  const arrow = (i, dir) => ({
    disabled: dir === 'up' ? i === 0 : i === sheetRows().length - 1,
    click: () => sheetRows()[i].querySelector('.grip').dispatchEvent(
      new window.KeyboardEvent('keydown', { key: dir === 'up' ? 'ArrowUp' : 'ArrowDown', bubbles: true, cancelable: true })),
  });
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
  /* 🔄 ~~"the arrows at the ends are disabled rather than absent"~~ — THE ARROWS
     ARE GONE, 2026-09-12, Tim: *"the up and down arrows on the right side of the
     exercises on this display are useless now that this is a drag feature now.
     Remove them."* The property that assertion protected — no control that
     silently does nothing — survives in the grip, which takes the arrow KEYS and
     says so; the `arrow()` shim above drives that path. */
  ok(sheetRows().every((r) => !r.querySelector('.move-btns')),
     '🔄 no ▲▼ on the rows — Tim: "the up and down arrows … are useless now that this is a '
     + 'drag feature now. Remove them."');
  ok(sheetRows().every((r) => (r.querySelector('.grip').getAttribute('aria-label') || '').includes('arrow keys')),
     '⚠️ and the drag handle NAMES its keyboard path — a drag has no keyboard equivalent, so '
     + 'the grip takes ArrowUp/ArrowDown itself and says so, rather than promising a reorder '
     + 'it cannot give somebody who is not using a finger');

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
  await settle();
  await saveNow();
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

/* ============ A. a set locks when you move on from it (2026-09-12) ============
 *
 * Tim: *"when a user moves on from a set, automatically 'lock' the set they
 * just finished which doesn't allow the user to change any measurements for
 * that set until they unlock it. The lock adjustments will be a visual lock on
 * the right side of the set which animates being locked and unlocked when you
 * click on it."*
 *
 * ⚠️ TWO LIFTS NOTHING ELSE IN THE SUITE TOUCHES (Pendlay Row, Meadows Row),
 * so every set opens PREFILLED and the first assertion — a suggestion never
 * locks — is about the feature rather than the fixture.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  const click = (n) => n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const draft = () => JSON.parse(localStorage.getItem(DRAFT) || '{}');
  const w = await store.saveWorkout({
    name: 'Lock day',
    exercises: [
      { exerciseId: byName('Pendlay Row').id, sets: 3, notes: '' },
      { exerciseId: byName('Meadows Row').id, sets: 2, notes: '' },
    ],
  });
  localStorage.removeItem(DRAFT);
  let s = await mount(SessionView(w.id));
  const rows = () => [...s.querySelectorAll('.set-list .set-item')];
  const lockOf = (i) => rows()[i].querySelector('.set-lock');
  const openAt = () => { const o = s.querySelector('.set-open'); return o ? rows().indexOf(o.closest('.set-item')) : -1; };
  const footer = (re) => [...s.querySelectorAll('.session-footer button')]
    .find((b) => re.test(b.textContent) || re.test(b.getAttribute('aria-label') || ''));

  /* ---- 1. a set nobody did never locks ---- */
  ok(openAt() === 0, 'set 1 opens first, as it always has');
  ok(Boolean(lockOf(0)) && lockOf(0).classList.contains('is-idle'),
     '⚠️ the open row carries a padlock, INVISIBLE while nothing has been typed — a lock offered on '
     + 'a set with nothing in it would be a control that does nothing');
  click(rows()[1].querySelector('.set-vals'));
  await settle();
  ok(openAt() === 1 && !rows()[0].classList.contains('is-locked'),
     '🚨 moving on from an UNTOUCHED set locks nothing — its 10 reps are the app\'s suggestion, and '
     + 'locking that would put a padlock on a number nobody typed');

  /* ---- 2. the first number reveals the padlock in place ---- */
  click(rows()[0].querySelector('.set-vals'));
  await settle();
  const row0 = rows()[0];
  type(s.querySelector('.set-open .step-value'), 185);
  await settle();
  ok(rows()[0] === row0 && !lockOf(0).classList.contains('is-idle'),
     '⚠️ the first number typed reveals the padlock IN PLACE — same node, no rebuild, nothing torn '
     + 'down under the finger');
  ok(lockOf(0).getAttribute('aria-label') === 'Lock set 1',
     'and while the set is open its padlock is the way to lock it by hand, and says so');

  /* ---- 3. moving on locks ---- */
  click(rows()[1].querySelector('.set-vals'));
  await settle();
  ok(rows()[0].classList.contains('is-locked') && openAt() === 1,
     '🚨 moving on from a RECORDED set LOCKS it, and the set you moved to is open');
  ok(lockOf(0).classList.contains('is-locked') && lockOf(0).getAttribute('aria-label') === 'Unlock set 1',
     'the padlock is shut and named for what tapping it does');
  ok(lockOf(0).classList.contains('lock-shuts'),
     '⚠️ and it was rebuilt wearing the one-shot class that plays the shackle closing (Rule 7 — the '
     + 'one movement, on the row you LEFT, beside the logging path rather than on it)');
  ok(rows()[0].querySelector('.set-pick').tagName !== 'BUTTON',
     '🔒 a locked row is NOT a control — not a disabled button, not aria-disabled: its text is text');
  ok(!rows()[0].querySelector('.set-del'),
     'and it cannot be deleted — delete is not rendered rather than rendered refusing');
  ok(lockOf(0).parentElement === rows()[0].querySelector('.set-pick').parentElement,
     '⚠️ the padlock is a SIBLING of .set-pick, never its child (a button in a button is invalid HTML)');
  ok(lockOf(0).querySelectorAll('svg').length === 2 && Boolean(lockOf(0).querySelector('svg.lock-shackle')),
     '⚠️ two <svg>s, one glyph — the shackle is its own path so CSS can swing it');
  ok(draft().entries[0].sets[0].locked === true,
     '🔒 the lock lives on the DRAFT set, so a workout put down and picked up keeps it');

  /* ---- 4. the flash is a one-shot; a locked row ignores taps ---- */
  click(rows()[1].querySelector('.set-pick'));       // collapse set 2 → a re-render
  await settle();
  ok(rows()[0].classList.contains('is-locked') && !lockOf(0).classList.contains('lock-shuts'),
     '⚠️ the next render does NOT replay the closing — the one-shot was spent by the render that '
     + 'painted it');
  click(rows()[0].querySelector('.set-pick'));
  await settle();
  ok(openAt() === -1 && rows()[0].classList.contains('is-locked'),
     'tapping a locked row opens nothing — the padlock is the one way in');

  /* ---- 5. the padlock unlocks AND opens; and locks again by hand ---- */
  lockOf(0).click();
  await settle();
  ok(openAt() === 0 && !rows()[0].classList.contains('is-locked'),
     '🚨 tapping the padlock UNLOCKS the set and OPENS it — the only reason to unlock is to change it');
  ok(lockOf(0).getAttribute('aria-label') === 'Lock set 1' && lockOf(0).classList.contains('lock-opens'),
     'the open padlock is named for locking, and plays the shackle opening');
  ok(draft().entries[0].sets[0].locked === undefined, 'and the draft no longer carries the lock');
  lockOf(0).click();
  await settle();
  ok(rows()[0].classList.contains('is-locked') && openAt() === -1,
     'tapping the open padlock locks by hand and shuts the row');

  /* ---- 6. leaving the exercise locks the set you were on, and only it ---- */
  /* ⚠️ SET 2 IS ALREADY LOCKED, and that is fill-on-open (2026-08-24) meeting
   * the padlock: opening set 2 in step 3 copied set 1's 185 into it, a filled
   * set is a recorded one everywhere in this app, and unlocking set 1 in step
   * 5 was moving on from it. Nothing new is being saved that was not saved
   * before — the padlock makes the copy VISIBLE where it used to be silent. */
  ok(rows()[1].classList.contains('is-locked'),
     '⚠️ set 2, filled from set 1 the moment it was opened, locked when set 1 was unlocked — a '
     + 'filled set is a recorded set, and the padlock shows the copy that used to be saved silently');
  lockOf(1).click();
  await settle();
  ok(openAt() === 1, 'its padlock opens it');
  type(s.querySelector('.set-open .step-value'), 135);
  await settle();
  footer(/Next exercise/).click();
  await settle();
  ok(draft().entries[0].sets[1].locked === true && draft().entries[0].sets[2].locked !== true,
     '🚨 Next locks the set you were ON and nothing else — set 3 was never done and stays free');
  footer(/Previous/).click();
  await settle();
  ok(openAt() === -1 && rows()[1].classList.contains('is-locked') && rows()[0].classList.contains('is-locked'),
     '⚠️ coming back with Previous finds both shut and NOTHING open — the one state in which "exactly '
     + 'one set is always open" is false, and it is honest');

  /* ---- 7. the locks survive leaving the workout open ---- */
  s = await mount(SessionView(w.id));
  ok(rows()[0].classList.contains('is-locked') && rows()[1].classList.contains('is-locked')
     && !rows()[2].classList.contains('is-locked'),
     '🔒 re-opening the runner from the draft keeps every lock exactly where it was');

  /* ---- 8. `locked` never reaches storage ---- */
  footer(/Next exercise/).click();
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle();
  await saveNow();
  const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
  ok(Boolean(saved) && saved.entries[0].sets.length === 2,
     `the session saves with the two recorded sets (${saved && saved.entries[0].sets.length})`);
  ok(Boolean(saved) && saved.entries.every((e) => e.sets.every((st) => !('locked' in st))),
     '🔒 and `locked` is DROPPED at save, like `prefilled` — it is a fact about the screen, not the training');
  localStorage.removeItem(DRAFT);
}

/* ============ B. a drop locks with its set — one hard set (2026-09-12) ============ */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  const click = (n) => n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const w = await store.saveWorkout({
    name: 'Lock drop day',
    exercises: [{ exerciseId: byName('Belt Squat').id, sets: 2, notes: '', setType: 'drop', minis: 1 }],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  const rows = () => [...s.querySelectorAll('.set-list .set-item')];
  type(s.querySelector('.set-open .step-value'), 200);
  await settle();
  [...s.querySelectorAll('button')].find((b) => /Strip the weight/.test(b.textContent)).click();
  await settle();
  ok(rows().length === 3 && rows()[1].classList.contains('set-drop') && Boolean(rows()[1].querySelector('.set-open')),
     'set 1 has a drop under it, and the drop is open');
  ok(Boolean(rows()[1].querySelector('.set-lock-gap')) && !rows()[1].querySelector('.set-lock'),
     '⚠️ a drop has no padlock of its own — a spacer keeps delete in its column');
  ok(!rows()[0].classList.contains('is-locked'),
     '⚠️ opening a DROP of the set you are on is not moving on — the set stays unlocked');
  type(s.querySelector('.set-open .step-value'), 160);
  await settle();
  click(rows()[2].querySelector('.set-vals'));          // set 2
  await settle();
  ok(rows()[0].classList.contains('is-locked') && rows()[1].classList.contains('is-locked'),
     '🚨 moving to set 2 locks set 1 AND its drop — one hard set, one lock (D23)');
  ok(!rows()[1].querySelector('.set-del') && rows()[1].querySelector('.set-pick').tagName !== 'BUTTON',
     'and the locked drop can be neither opened nor deleted');
  rows()[0].querySelector('.set-lock').click();
  await settle();
  ok(!rows()[1].classList.contains('is-locked') && Boolean(rows()[1].querySelector('.set-pick').tagName === 'BUTTON'),
     'unlocking the set frees its drop with it');
  localStorage.removeItem(DRAFT);
}

/* ============ C. locks are per person and never broadcast (2026-09-12) ============ */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  const click = (n) => n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const draft = () => JSON.parse(localStorage.getItem(DRAFT) || '{}');
  const killSheets = () => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
  const w = await store.saveWorkout({
    name: 'Lock joint day',
    exercises: [{ exerciseId: byName('Pendlay Row').id, sets: 2, notes: '' }],
  });
  killSheets();
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  s.querySelector('.person-add').click();
  await settle(); await settle();
  [...document.querySelector('.sheet').querySelectorAll('button')].find((b) => /Someone new/.test(b.textContent)).click();
  await settle();
  const inner = [...document.querySelectorAll('.sheet')].pop();
  inner.querySelector('input').value = 'Rae';
  [...inner.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click();
  await settle(); await settle();
  [...s.querySelectorAll('.person-chip')].find((b) => b.textContent.trim() === 'You').click();
  await settle();
  const rows = () => [...s.querySelectorAll('.set-list .set-item')];
  type(s.querySelector('.set-open .step-value'), 155);
  await settle();
  click(rows()[1].querySelector('.set-vals'));
  await settle();
  const rae = (draft().others || []).find((o) => o.name === 'Rae');
  ok(draft().forName === null && draft().entries[0].sets[0].locked === true,
     'the owner\'s set 1 locked when the owner moved on');
  ok(Boolean(rae) && rae.entries[0].sets[0].locked !== true,
     '🚨 and Rae\'s did NOT — a lock is per person\'s own sets and is never broadcast: the app knows '
     + 'whose steppers moved on and knows nothing about whether Rae has finished');
  killSheets();
  localStorage.removeItem(DRAFT);
}

/* ============ D. the row follows the finger (2026-09-12) ============
 *
 * Tim: *"It automatically locks into a valid position in the list, and doesn't
 * follow the user's finger or mouse smoothly … it should follow the exact
 * location of the user's selection and when the user releases their finger,
 * it will automatically take the nearest valid position. Also the up and down
 * arrows … are useless now that this is a drag feature now. Remove them."*
 *
 * ⚠️ jsdom measures every rectangle as zero, so this block STUBS the rows'
 * `getBoundingClientRect` (56px rows, stacked) before pressing. The drag reads
 * geometry once at pointerdown, which is what makes a stub honest here: the
 * assertions are about what the code does with a geometry it was given, and
 * the finger itself is what the browser pass checks.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  const killSheets = () => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
  const sheetRows = () => [...document.querySelectorAll('.sheet .reorder-row')];
  const order = () => sheetRows().map((r) => r.querySelector('.row-title').textContent.trim()).join(' > ');
  const H = 56;
  const stubRects = () => sheetRows().forEach((r, i) => {
    r.getBoundingClientRect = () => ({ top: i * H, bottom: i * H + H, height: H, left: 0, right: 0, width: 0 });
  });
  const pointer = (type, node, clientY) => node.dispatchEvent(
    new window.PointerEvent(type, { clientY, button: 0, pointerId: 1, bubbles: true, cancelable: true }));

  killSheets();
  const w = await store.saveWorkout({
    name: 'Drag day',
    exercises: [
      { exerciseId: byName('Sissy Squat').id, sets: 1, notes: '' },
      { exerciseId: byName('Cossack Squat').id, sets: 1, notes: '' },
      { exerciseId: byName('Meadows Row').id, sets: 1, notes: '' },
    ],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  [...s.querySelectorAll('.session-actions .pill-action')][2].click();
  await settle();
  ok(order() === 'Sissy Squat > Cossack Squat > Meadows Row', `the sheet lists today's exercises (${order()})`);

  /* ---- the arrows are gone; the handle names its keyboard path ---- */
  ok(sheetRows().every((r) => !r.querySelector('.move-btns')),
     '🔄 no ▲▼ on any row — "useless now that this is a drag feature now. Remove them."');
  ok(sheetRows().every((r) => r.querySelector('.grip').tagName === 'BUTTON'
       && /arrow keys/.test(r.querySelector('.grip').getAttribute('aria-label') || '')),
     '⚠️ the grip is still a real named control, and its name says the arrow keys move the row — the '
     + 'keyboard path the buttons used to be');

  /* ---- a short drag follows the pointer exactly and moves nothing ---- */
  stubRects();
  let grip = sheetRows()[0].querySelector('.grip');
  pointer('pointerdown', grip, 28);
  pointer('pointermove', grip, 38);
  ok(sheetRows()[0].style.transform === 'translateY(10px)' && sheetRows()[0].classList.contains('is-dragging'),
     '🚨 the dragged row is a translateY of EXACTLY the pointer\'s travel — 10px of finger is 10px of row');
  ok(sheetRows()[1].style.transform === '' && sheetRows()[2].style.transform === '',
     'and ten pixels passes nobody\'s midpoint, so no other row moves');
  pointer('pointerup', grip, 38);
  await settle();
  ok(order() === 'Sissy Squat > Cossack Squat > Meadows Row',
     `letting go short of the next midpoint snaps the row back to where it was (${order()})`);
  ok(sheetRows().every((r) => r.style.transform === '' && !r.classList.contains('is-dragging')),
     'and every row is back at rest');

  /* ---- past the next row's midpoint: that row slides out of the way ---- */
  stubRects();
  grip = sheetRows()[0].querySelector('.grip');
  pointer('pointerdown', grip, 28);
  pointer('pointermove', grip, 90);
  ok(sheetRows()[0].style.transform === 'translateY(62px)',
     'the row is under the finger, 62px down');
  ok(sheetRows()[1].style.transform === `translateY(-${H}px)` && sheetRows()[2].style.transform === '',
     '🚨 the row it passed slides UP one row height to show the gap it will take (Rule 7: the row you '
     + 'drag pushes the rest), and the row it has not reached stays put');
  ok(order() === 'Sissy Squat > Cossack Squat > Meadows Row',
     '⚠️ and the DOM is UNTOUCHED mid-drag — the order is a fact about release, not about the finger');
  pointer('pointerup', grip, 90);
  await settle();
  ok(order() === 'Cossack Squat > Sissy Squat > Meadows Row',
     `on release it takes the nearest valid slot (${order()})`);
  ok(/Sissy Squat/.test(s.querySelector('.session-ex-name').textContent),
     '⚠️ and you are still on the exercise you were doing — the commit is the same applyOrder the '
     + 'arrows used, re-pointed by entry object');
  ok(sheetRows().every((r) => r.style.transform === ''),
     'the rebuilt rows carry no transform — the settle is a transition that ends at rest');

  /* ---- the keyboard path ---- */
  sheetRows()[1].querySelector('.grip').dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await settle();
  ok(order() === 'Sissy Squat > Cossack Squat > Meadows Row',
     `ArrowUp on the grip moves the row up one (${order()})`);
  ok(document.activeElement === sheetRows()[0].querySelector('.grip'),
     '⚠️ and focus follows the row onto its new grip — the list was rebuilt under the key');
  sheetRows()[0].querySelector('.grip').dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await settle();
  ok(order() === 'Sissy Squat > Cossack Squat > Meadows Row', 'ArrowUp at the top does nothing');
  killSheets();
  localStorage.removeItem(DRAFT);
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
  ok(Boolean(fr.querySelector('.me-head .me-face .face-img')),
     '🔄 and their PROFILE leads with it — the same `.me-face` head `#/me` uses, at the bigger '
     + 'radius Tim asked for on 2026-09-16 ("their profile picture big at the top")');

  social.friend = withFace(null);
  const bare = await mount(FriendView('u1'));
  for (let i = 0; i < 8; i++) await settle();
  ok(Boolean(bare.querySelector('.me-head .me-face'))
     && !bare.querySelector('.me-face .face-img'),
     '🔄 while a friend with no photo now gets the PERSON GLYPH, reversing 2026-08-31 on purpose. '
     + '~~a friend with no photo gets NO empty circle~~ was right when this page was a list under '
     + 'a title bar carrying their name — a bare circle would have been an ornament on most '
     + 'accounts. A PROFILE has a slot for the face: the name sits beside it and the two figures '
     + 'sit under it, so leaving it out moves the whole screen up and reads as a page that failed '
     + 'to load');

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

  /* ---- and the fourth list of people, which never showed a face at all ----
   *
   * 🚨 THE BUG TIM REPORTED ON 2026-09-16: *"in the profile section, if you click
   * on frineds, the friend's profile icon does not show their image that is
   * normally showed."* `MePeopleView` rendered `personFace(p.avatar, 20)` and a
   * row of `social.state().connections` is `{ uid, name, since }` —
   * `normalizeGraph()` has never carried an avatar and should not: a photo is a
   * fact about the person, published in THEIR document, and a copy of it in my
   * graph is a copy that goes stale the day they change it. So `p.avatar` was
   * always `undefined`, `safeAvatar()` correctly refused it, and every row on
   * that screen showed the default humanoid. */
  {
    const { MePeopleView } = await import(BASE + 'views-me.js');

    social.friend = withFace(FACE);
    const list = await mount(MePeopleView());
    for (let i = 0; i < 8; i++) await settle();
    ok(Boolean(list.querySelector('.row-face .face-img')),
       '🚨 the Profile tab\'s friends list shows their published photo, read from the document '
       + 'THEY published rather than from a stale copy in my graph');

    /* ⚠️ AND A FRIEND WHOSE DOCUMENT CANNOT BE READ KEEPS THE GLYPH, SILENTLY.
     * That is an ordinary outcome — they are private and the read is refused —
     * and it is what every account without a photo looks like anyway. The row
     * still paints from the graph immediately rather than waiting on a read per
     * person, which is the screen Tim once reported as alarmingly laggy. */
    social.friend = async () => { throw new Error('private'); };
    const refused = await mount(MePeopleView());
    for (let i = 0; i < 8; i++) await settle();
    ok(Boolean(refused.querySelector('.row-face svg')) && !refused.querySelector('.row-face img'),
       '⚠️ while a friend whose document is unreadable keeps the person glyph and says nothing');
    ok(/Autumn/.test(refused.textContent),
       '🔒 and the ROW is still there — the name comes from the graph, so a refused photo read '
       + 'may never cost the reader the person');
  }

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
  /* 🔒 THE HALF-SET RULE, NOW BEHIND THE "?" — 2026-09-08, Rule 9, and this
     assertion was STRENGTHENED rather than relaxed. It used to read the words
     off the pane; it now has to find the control, open it and read them back,
     which also asserts they are REACHABLE. And the basis of the percentages —
     what they are a share OF, and that a helping muscle counts half — is
     checked separately, in the open, because that is WHAT rather than WHY and
     it was buried inside the caveat before. */
  ok(/Share of this workout|counts half/.test(t),
     '🚨 the basis of the percentages is stated ON the screen, which it was not before');
  {
    const splitDot = ws.querySelector('.ws-split .help-dot');
    ok(Boolean(splitDot), 'with a ? beside it rather than sixty words under it');
    splitDot.click();
    await settle();
    ok(/modelling choice/.test(document.querySelector('.help-pop').textContent),
       'and the half-set rule still travels with the number that used it');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
  }

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
 * 🆕 THE SAME TWO CAPTIONS ON EVERY SET OF A WORKOUT — 2026-09-11
 *
 * Tim: *"I want you to do the exact same thing for a regular workout by just
 * displaying the tiny '_% of estimated max' and 'maybe __ reps to failure'
 * above the weight and reps. This will help the user estimate how much weight
 * they should put on during a set."*
 *
 * 🚨 THE LOAD-BEARING ASSERTION IS THE GUEST'S, and the fixture is built so it
 * can fail: the OWNER has a rowing history and the GUEST has none, on the same
 * bar, in the same workout. A caption computed from the owner's ratings and
 * shown under the guest's name would be the owner's max wearing the guest's
 * name — the cross-prescription 0e exists to forbid — and a version that read
 * `muscleRatings()` once for everybody would pass every other assertion here.
 * ================================================================== */
{
  const { store, clearReadCache } = await import(BASE + 'store.js');
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const row = byName('Barbell Row');
  const dbRow = byName('Dumbbell Row');
  const session = (date, ex, weight, reps) => ({
    id: `rc-${date}-${ex.id}`, date, workoutName: 'Pull',
    entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: [{ weight, reps }] }],
  });
  await store.importAll({
    sessions: [
      session('2026-08-10', row, 135, 8), session('2026-08-17', row, 140, 8),
      session('2026-08-12', dbRow, 60, 8), session('2026-08-19', dbRow, 65, 8),
    ],
  });
  clearReadCache('seeded rows directly through importAll');

  const w = await store.saveWorkout({
    name: 'Pull day',
    exercises: [
      { exerciseId: row.id, sets: 2, notes: '' },
      { exerciseId: byName('Plank').id, sets: 1, notes: '' },
    ],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  // The ratings walk is not awaited by the screen; poll for the caption
  // rather than sleeping a fixed number of ticks (the benchmark block's rule).
  const capsOf = (node) => [...node.querySelectorAll('.set-open .step-est')];
  for (let i = 0; i < 120 && !capsOf(s).some((c) => c.textContent.trim()); i++) await settle();

  const caps = capsOf(s);
  ok(caps.length === 2, `the open set carries two caption slots, weight and reps (${caps.length})`);
  const capText = () => capsOf(s).map((c) => c.textContent.replace(/\s+/g, ' ').trim());
  ok(/%\s*of your estimated max/.test(capText()[0]),
     `the weight says what share of the estimate it is (${capText()[0]})`);
  ok(/maybe .* to failure/.test(capText()[1]),
     `and the reps say roughly how many it allows, worded as a guess (${capText()[1]})`);

  /* 🚨 AND SINCE 2026-09-13 IT SAYS WHOSE NUMBER IT IS. The lifter has a barbell
   * row history, so the caption reads THEIR OWN best set on this lift rather
   * than their Back rating converted back out through the ratio table. That was
   * Tim's report: with a tested set on record the runner still spoke from the
   * muscle rating, and told him a weight he had tested two days earlier was
   * above his max. */
  /* ⚠️ `× \d` RATHER THAN "from your", and the difference is a mutation check.
   * A caption falling back to the muscle rating says "(from your other lifts)",
   * which matches "from your" perfectly well — so the loose pattern passed with
   * the own-set lookup disabled entirely. It has to name a SET. */
  ok(/from your .*× ?\d/.test(capText()[0]),
     `⚠️ the caption names the set it rests on — Rule 5's anchor, on the screen where the number `
     + `is acted on (${capText()[0]})`);
  ok(/14?0|135/.test(capText()[0]),
     'and the set it names is one this person actually did, not a converted figure');

  /* ⚠️ THE RANGE, not a single integer (decision h). The rep table publishes a
   * between-person spread of about ±2.5 reps at 80 % — as wide as the fatigue
   * correction on a third set — so a bare number was always overstating what is
   * known. */
  ok(/maybe \d+–\d+ to failure|maybe \d+\+? to failure/.test(capText()[1]),
     `the rep caption carries a band where it has one (${capText()[1]})`);

  /* ⚠️ LIVE: a nudge repaints them, in place, without rebuilding the row. */
  const before = capText()[0];
  const weightInput = s.querySelector('.set-open .step-value');
  weightInput.value = '95';
  weightInput.dispatchEvent(new window.Event('blur', { bubbles: true }));
  await settle();
  ok(capText()[0] !== before && /%/.test(capText()[0]),
     `a lighter weight moves the percentage (${before} → ${capText()[0]})`);
  ok(s.querySelector('.set-open .step-value') === weightInput,
     '⚠️ and the input being typed into survived — the caption repaints, the row does not rebuild');

  /* ⚠️ NO ARITHMETIC ON NOTHING: an empty field gets an empty caption. */
  weightInput.value = '0';
  weightInput.dispatchEvent(new window.Event('blur', { bubbles: true }));
  await settle();
  ok(capText().every((t) => t === ''),
     '⚠️ and at zero both are EMPTY — "0 % of your estimated max" would be a reading of nothing');

  /* ⚠️ Only a lift with a weight AND reps. A plank has neither, so its open
     set has no slot at all rather than an empty one. */
  [...s.querySelectorAll('.session-footer button')].find((b) => /Next/.test(b.textContent)).click();
  await settle();
  ok(capsOf(s).length === 0, 'a timed exercise (plank) gets no caption slot at all');
  [...s.querySelectorAll('.session-footer button')].find((b) => /Previous/.test(b.getAttribute('aria-label') || '')).click();
  await settle();

  /* 🚨 PER PERSON. The guest has no rowing history, so the guest gets nothing —
     never the owner's number. */
  await store.savePerson({ name: 'Nobody Yet' });
  [...s.querySelectorAll('.person-chip')].find((b) => /Add a person/.test(b.textContent)).click();
  await settle(); await settle();
  [...document.querySelector('.sheet').querySelectorAll('button')]
    .find((b) => /Nobody Yet/.test(b.textContent)).click();
  for (let i = 0; i < 20; i++) await settle();
  const guestWeight = s.querySelector('.set-open .step-value');
  guestWeight.value = '135';
  guestWeight.dispatchEvent(new window.Event('blur', { bubbles: true }));
  for (let i = 0; i < 20; i++) await settle();
  ok(capsOf(s).every((c) => c.textContent.trim() === ''),
     '🚨 the GUEST sees no caption at 135 lb — their ratings are built from THEIR history, which is '
     + 'empty, and the owner\'s "% of max" must never appear under somebody else\'s name');
  // Vacuity guard: back on the owner, the same weight has a caption again. The
  // owner is always the FIRST chip on the bar (`forName === null` renders first).
  [...s.querySelectorAll('.person-chip')][0].click();
  for (let i = 0; i < 20; i++) await settle();
  /* 🔒 SINCE 2026-09-12 THE OWNER'S SET 1 IS LOCKED HERE — Next/Previous above
     moved on from it — so nothing is open until its padlock is tapped. That is
     the lock feature doing its job in the middle of another feature's test. */
  ok(Boolean(s.querySelector('.set-list .set-item.is-locked')),
     '🔒 the owner\'s set 1 is locked after Next/Previous, so nothing is open until it is unlocked');
  s.querySelector('.set-lock.is-locked').click();
  await settle();
  const ownerWeight = s.querySelector('.set-open .step-value');
  ownerWeight.value = '135';
  ownerWeight.dispatchEvent(new window.Event('blur', { bubbles: true }));
  for (let i = 0; i < 20; i++) await settle();
  ok(/%/.test(capText()[0] || ''),
     'while the OWNER, on the same bar, still gets one — the guest\'s blank is a decision, not a '
     + 'broken caption');

  localStorage.removeItem(DRAFT);
  await store.clearAll();
}

/* ================================================================== *
 * 🚨 THE FATIGUE THE REP CAPTION CARRIES, ON THE SCREEN — 2026-09-14
 *
 * rep-decrement.js has 57 module-level assertions of its own and NOTHING
 * asserted the multiplier ever reached a screen. That is the failure this block
 * exists for: the caption printing "maybe 9–15 to failure" identically on set 1
 * and set 4 — which is what it did until 2026-09-13 — while the module beneath
 * it went on computing a perfectly good 0.72 that no reader ever saw.
 *
 * ⚠️ THE FRESH FIGURE STAYS ON SCREEN, and that is half the feature rather than
 * a decoration. A number that only ever falls, with nothing beside it, reads as
 * the app changing its mind about you between sets; "(12 fresh)" is what makes
 * the smaller number read as fatigue.
 *
 * ⚠️ AND IT IS ASSERTED AS A NUMBER, NOT ONLY AS A SHAPE. Every multiplier in
 * the table is ≤ 1 (rep-decrement.js rule 1: a wrong constant may only make the
 * caption easier to beat, never harder), so the later band must not sit ABOVE
 * the fresh figure printed beside it. A regex that only looked for "fresh)"
 * would pass with the arithmetic inverted.
 *
 * ⚠️ A WEIGHT CHANGE ENDS THE RUN. `leadingRun()` is the boundary the module
 * cares about — a back-off set is a fresh effort, not a fatigued one — so the
 * last part of this block changes the load on set 3 and asserts the note goes
 * away entirely rather than merely getting smaller.
 * ================================================================== */
{
  const { store, clearReadCache } = await import(BASE + 'store.js');
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const bp = byName('Barbell Bench Press');
  await store.saveProfile({ gender: 'male', birthYear: 1994 });
  await store.logBodyWeight(180, '2026-08-01');
  /* ⚠️ THE REST TARGET IS PINNED, because it chooses the column. 0 is the
     default — timer off, "unknown" — and rep-decrement.js answers that with the
     two-minute column [1, 0.72, 0.55, 0.45]. Pinning it means this block is
     reading one known column rather than whatever a previous block left in
     `settings`, and 0 keeps it the column a real user with the timer off gets. */
  await store.saveSettings({ restTarget: 0 });
  /* Two single-set sessions, so the lifter has an OWN best set (the caption
     prefers it over the muscle rating) and NO run of three at one load — which
     means `personalDecrement()` contributes nothing and the multipliers are the
     published column exactly. A fixture with three-set sessions would blend, and
     the numbers below would then depend on the shrinkage weight as well. */
  await store.importAll({
    sessions: [
      { id: 'fatigue-1', date: '2026-08-10', workoutName: 'Push',
        entries: [{ exerciseId: bp.id, exerciseName: bp.name, sets: [{ weight: 185, reps: 5 }] }] },
      { id: 'fatigue-2', date: '2026-08-17', workoutName: 'Push',
        entries: [{ exerciseId: bp.id, exerciseName: bp.name, sets: [{ weight: 185, reps: 5 }] }] },
    ],
  });
  clearReadCache('seeded a bench history directly through importAll');

  const w = await store.saveWorkout({
    name: 'Fatigue day', exercises: [{ exerciseId: bp.id, sets: 3, notes: '' }],
  });
  localStorage.removeItem(DRAFT);
  const s = await mount(SessionView(w.id));
  const capsOf = () => [...s.querySelectorAll('.set-open .step-est')];
  // The ratings and own-history walks are not awaited by the screen; poll.
  for (let i = 0; i < 120 && !capsOf().some((c) => c.textContent.trim()); i++) await settle();
  const repCap = () => (capsOf()[1] ? capsOf()[1].textContent.replace(/\s+/g, ' ').trim() : '');
  const type = async (field, value) => {
    const inputs = [...s.querySelectorAll('.set-open .step-value')];
    inputs[field === 'weight' ? 0 : 1].value = String(value);
    inputs[field === 'weight' ? 0 : 1]
      .dispatchEvent(new window.Event('blur', { bubbles: true }));
    for (let k = 0; k < 8; k++) await settle();
  };
  const openSet = async (i) => {
    [...s.querySelectorAll('.set-list .set-pick')][i].click();
    for (let k = 0; k < 8; k++) await settle();
  };
  // "maybe 6–11 to failure on this set (12 fresh)" → [6, 11, 12].
  const band = (t) => {
    const m = t.match(/maybe (\d+)(?:–(\d+))?\+? to failure(?: on this set \((\d+) fresh\))?/);
    return m ? { low: Number(m[1]), high: Number(m[2] || m[1]), fresh: m[3] ? Number(m[3]) : null } : null;
  };

  // 165 lb against a 185 × 5 own best is ~79 % — squarely inside the rep table,
  // so the caption has a real band rather than the "15+" ceiling.
  await type('weight', 165);
  await type('reps', 8);
  const cap1 = repCap();
  ok(/maybe \d+–\d+ to failure$/.test(cap1),
     `set 1 of the run is the fresh prediction and says nothing about fatigue (${cap1})`);

  await openSet(1);
  await type('weight', 165);
  await type('reps', 8);
  const cap2 = repCap();
  ok(cap2 !== cap1,
     `🚨 set 2 at the SAME weight does not repeat set 1's sentence — the decrement reaches the `
     + `screen (set 1 "${cap1}", set 2 "${cap2}")`);
  ok(/ on this set \(\d+ fresh\)$/.test(cap2),
     `⚠️ and the fresh figure is still printed beside it, so the smaller number reads as fatigue `
     + `rather than as the app changing its mind (${cap2})`);
  const b1 = band(cap1);
  const b2 = band(cap2);
  ok(Boolean(b1 && b2 && b2.fresh),
     'both captions parse as a rep band, and set 2 carries the fresh figure');
  ok(b2 && b2.high <= b2.fresh && b2.low < b2.fresh,
     `🚨 and the fatigued band sits BELOW the fresh figure beside it — every multiplier in the `
     + `table is ≤ 1, so this direction is the whole safety argument (${cap2})`);

  await openSet(2);
  await type('weight', 165);
  await type('reps', 8);
  const cap3 = repCap();
  const b3 = band(cap3);
  ok(b3 && b2 && b3.high < b2.high && b3.low <= b2.low,
     `⚠️ set 3 falls further still — the caption reads the set's PLACE in the run, not a single `
     + `"is this set 1?" flag (set 2 "${cap2}", set 3 "${cap3}")`);
  ok(b3 && b3.fresh === b2.fresh,
     `and the fresh figure beside it is unchanged, because the load has not changed (${cap3})`);

  /* 🚨 THE BOUNDARY THE MODULE CARES ABOUT. A back-off — any change of load —
     ends the run, so set 3 at a different weight is a FRESH effort again and the
     note must disappear rather than shrink. `leadingRun()` is what measures it. */
  await type('weight', 175);
  const cap4 = repCap();
  ok(/maybe \d+/.test(cap4) && !/fresh\)/.test(cap4),
     `🚨 changing the weight on set 3 ends the run and takes the fatigue note with it — a fresh `
     + `load is a fresh effort (${cap4})`);

  localStorage.removeItem(DRAFT);
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
  const { FriendView, FriendDataView, CompareBodiesView, SocialView } =
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

    /* 🔄 THE MAP IS BEHIND "VIEW DATA" SINCE 2026-09-16, and that is Tim's own
     * sentence: *"instead of going straight to the muscle map and data section,
     * I want you to view their profile display … Add a 'view data' button on the
     * top right side of this profile display that pulls up a screen."* So the
     * two halves are asserted separately — the profile does NOT carry the map,
     * and the panel does — because a rewrite that only followed the map to its
     * new screen would still pass if the profile had never been built. */
    const prof = await mount(FriendView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    ok(!prof.querySelector('.body-map'),
       '🚨 their PROFILE does not carry the muscle map — it is a profile now, not a Data screen');
    ok(Boolean([...prof.querySelectorAll('.topbar button')]
      .find((b) => /View data/.test(b.textContent))),
       '⚠️ and carries a "View data" control in the top-right corner instead, labelled in words: '
       + 'a chart glyph would be a guess the reader has to tap to check');

    const fr = await mount(FriendDataView('u1'));
    for (let i = 0; i < 10; i++) await settle();

    /* 🛑 THE ARROW ON THE PANEL IS A DOWN ARROW, NOT A BACK ARROW, and the
     * distinction is the same one Record's carries: Rule 8's back means the
     * screen you were just on, and this means "put the panel away", which lands
     * on that friend's profile whatever route opened it — a deep link and a
     * reload included. `screenShell`'s `down` slot renders `aria-label="Close"`. */
    ok(Boolean(fr.querySelector('.topbar .icon-btn[aria-label="Close"]'))
       && !fr.querySelector('.topbar .icon-btn[aria-label="Back"]'),
       '🛑 and the panel wears the DOWN arrow rather than a back arrow');

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
    /* 🚨 THEIR DATA IS TABS, NOT ROWS UNDER THE BODY — 2026-09-05. Tim: *"I want
     * it to look nearly exactly like how a user views their own data section."*
     *
     * 🔄 FOUR OF THEM SINCE 2026-09-16, ~~five with Calendar where Research is on
     * yours~~. Tim: *"because calendar is now shown in the profile menu, remove
     * it as a tab in the 'view data' section when looking at another person's
     * information."* Their calendar became a section of their PROFILE earlier the
     * same day, and this segment was then a second door onto the same
     * `ownCalendar()` one tap away — with its own Months/Years memory to leave in
     * a different state from the one underneath it.
     *
     * ⚠️ TWO ABSENCES, TWO DIFFERENT REASONS, AND THE PAIR IS THE ASSERTION.
     * Research is missing because its CONTENT is not about this person (eleven
     * topics identical on everybody's screen); Calendar is missing because its
     * content IS about them and is already on the screen this panel was pulled up
     * over. Asserting the exact list rather than two `!includes` is what catches
     * a segment quietly coming back in either direction. */
    const tabLabels = [...fr.querySelectorAll('.segmented .seg')].map((b) => b.textContent);
    ok(tabLabels.join('|') === 'Muscles|Volume|Graph|Bars',
       `🚨 their data panel carries exactly four tabs (${tabLabels.join('|')})`);
    ok(!tabLabels.includes('Research'),
       '⚠️ NOT Research — it is the same on every screen, so on a friend\'s page it would be '
       + 'a tab that is not about them');
    ok(!tabLabels.includes('Calendar'),
       '🚨 and NOT Calendar — it is on their profile, which is the screen this panel is pulled up '
       + 'over, and two doors onto one calendar is the drift "one calendar, five doors" exists to '
       + 'prevent');

    /* Recent workouts stayed under the body rather than becoming a sixth tab —
     * Tim: *"keep the 'recent workouts' display below that user's body view as
     * it is now."* */
    ok(/Recent workouts/.test(fr.textContent),
       '⚠️ and Recent workouts is still under the body, not promoted to a tab');

    /* 🔄 ~~"What they can see of yours"~~ GONE — 2026-09-05, on Tim's
     * instruction. It was a PER-PERSON dial when it was built; the tiers went on
     * 2026-09-03 and it became one account-wide setting that merely happened to
     * be drawn here, where its position still read as "for this friend". */
    ok(!/What they can see of yours/.test(fr.textContent),
       '🚨 and the visibility control is gone from a friend\'s page — an account-wide setting in a '
       + 'per-person position invites somebody to think they are changing what THIS friend sees');

    /* ---- the other tabs draw THEIR numbers, from the same code as yours ---- */
    const tabBtn = (label) => [...fr.querySelectorAll('.segmented .seg')]
      .find((b) => b.textContent === label);

    tabBtn('Volume').click();
    await settle(); await settle();
    ok(/sets a week|Weekly sets|sets\b/i.test(fr.textContent),
       'their Volume tab draws the weekly-sets screen');

    /* 🔄 AND THEIR CALENDAR IS ASSERTED ON THEIR PROFILE, NOT HERE — 2026-09-16.
       Every line below is the one this block already made about the panel's
       Calendar segment; the segment is gone and the calendar is not, so the
       assertions follow it to the door it actually has rather than being
       deleted with the tab.

       ⚠️ A FRESH MOUNT, not the `prof` above. Their calendar fills into a slot
       AFTER the profile paints and the fill is guarded on `calSlot.isConnected`
       — mounting the panel detached that node, so the earlier reference would be
       a profile whose calendar can never arrive. */
    {
      const cal = await mount(FriendView('u1'));
      for (let i = 0; i < 14; i++) await settle();
      const calText = cal.textContent;
      ok(/most recent sixty sessions/.test(calText),
         '🚨 their calendar says it is a WINDOW rather than a history — sixty published sessions, '
         + 'so an empty month may mean they rested or may mean it fell off the end');
      /* 🔄 THEIR CALENDAR OPENS ON YEARS SINCE 2026-09-12 — Tim: *"make the year
         display the default for the calendar in all scenarios (including viewing
         a friend's calendar)"*. ⚠️ THIS IS THE FIRST FRIEND CALENDAR THIS FILE
         PAINTS, so it is the one assertion reading `friendCalMode`'s INITIAL
         value; the friend block at the end of the file asserts the same opening,
         but by then it is reading what this block restores before it leaves. */
      const theirSeg = (label) => [...cal.querySelectorAll('.cal-modes .seg')]
        .find((b) => b.textContent === label);
      ok(cal.querySelectorAll('.yr-grid').length > 0 && !cal.querySelector('.cal-month')
         && theirSeg('Years').getAttribute('aria-selected') === 'true',
         '🚨 and it opens on YEARS, like every other door — the sixty-session caveat is on the '
         + 'screen in that view, which is where it is needed');

      /* ⚠️ AND ITS DAYS GO NOWHERE — in Months, which is the tap away.
         `#/day/<iso>` is MY training for that date; linking there from their
         calendar would open the right day for the wrong person and look like it
         had worked. */
      theirSeg('Months').click();
      for (let i = 0; i < 3; i++) await settle();
      const calCells = [...cal.querySelectorAll('.cal-cell')].filter((c) => !c.classList.contains('blank'));
      ok(calCells.length > 0, 'and, on Months, it draws day cells');
      ok(calCells.every((c) => c.tagName.toLowerCase() !== 'button'),
         '🚨 none of which is a button — there is no screen for one of their days, and a control '
         + 'that does nothing takes focus and is announced as a control');
      /* 🔄 THE TAP STILL LANDS, ON THE PROFILE'S OWN PANE — `land: false` is the
         ARRIVAL only, and it always was. Their document holds a session dated
         today, so the current month is inside the range the months are now
         trimmed to and this is the unchanged case. Structure only — see the
         Calendar block for what a browser still has to show. */
      ok(Boolean(cal.querySelector('.cal-month[data-current-month][data-landed]')),
         '🚨 and tapping Months aimed the scroller at the CURRENT month on their profile');
      /* ⚠️ PUT THEIR SWITCH BACK ON YEARS, the default, before leaving:
         `friendCalMode` is module state and the last block in this file asserts
         their page opens on it. */
      theirSeg('Years').click();
      await settle();
    }

    /* 🚨 AND BROWSING THEIR TABS MUST NOT MOVE MINE. `graphMode` is module state
     * — the tab my own Data screen opens on — and a friend's page keeping its
     * own `mode` is the only thing stopping "look at their calendar" from
     * leaving my Data screen on a tab that does not exist in its own list. */
    const { GraphView: MyData } = await import(BASE + 'views-data.js');
    const mine = await mount(MyData());
    await settle();
    const mySelected = [...mine.querySelectorAll('.segmented .seg')]
      .find((b) => b.getAttribute('aria-selected') === 'true');
    ok(mySelected && mySelected.textContent !== 'Calendar',
       `⚠️ my own Data screen is unaffected by having browsed theirs (${mySelected && mySelected.textContent})`);
    ok([...mine.querySelectorAll('.segmented .seg')].some((b) => b.textContent === 'Research'),
       'and still has Research, which is mine and not theirs');

    /* ⚠️ PUT THEIR PAGE BACK ON MUSCLES BEFORE LEAVING. This file is one long
       script over one jsdom, so a block that walks a screen into a different
       state hands that state to every block after it — the assertions below
       read the muscle panel, and the first version of this left them looking at
       a calendar. Restoring the tab is the block's own job. */
    tabBtn('Muscles').click();
    await settle(); await settle();

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

  /* ---- 🚨 THEIR MAP IS READ AGAINST PEOPLE LIKE **THEM** — 2026-09-09 ----
   *
   * Tim: *"when you click on another person's profile, their muscle map is being
   * compared against people like YOU, not people like THEM."*
   *
   * ⚠️ THE FIXTURE ABOVE COULD NOT HAVE CAUGHT THIS AND THAT IS THE LESSON. Its
   * friend publishes `defaultCompare: 'lifters|male|own|own'` and the reader is
   * male, so the wrong answer and the right answer are the same string. The fault
   * only exists where the two people differ, so the fixture has to differ:
   * SHE is female, the viewer's saved group names MALE outright, and the two grid
   * rows give levels far enough apart to be told apart by name.
   */
  {
    /* ⚠️ THE BLOCK ABOVE LEFT ITS SHEET OPEN, and a sheet is mounted on
     * `document.body` rather than inside the screen — so `.sheet .chip` would
     * match TWO sheets and the first version of this read its chips off the
     * stale one, which is how "pick Men" silently picked nothing. Close what is
     * open, and address the live sheet by position rather than by class. */
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    const liveSheet = () => [...document.querySelectorAll('.sheet')].pop();

    const prevSettings = await store.getSettings();
    // The state the bug needs: a viewer who has pressed "Like me" at some point,
    // which is what writes a CONCRETE sex into their own settings.
    await store.saveSettings({ compare: { pool: 'lifters', sex: 'male', weight: 'own', age: 'own' } });

    const HER = {
      muscles: [
        { muscle: 'Chest', lift: 'Barbell Bench Press', estimate: 120, confidence: 0.7,
          band: 'Good', basis: 'direct', contributorCount: 5, exerciseCount: 2,
          contributors: [{ exerciseName: 'Barbell Bench Press', weight: 110, reps: 5,
            date: '2026-08-10', loadType: 'total', source: 'benchmark' }],
          hint: null, confident: true },
      ],
      grid: {
        // The same lift, read against two populations: unremarkable among men,
        // near the top among women. Exactly the case Tim described.
        'lifters|male|own|own': { Chest: [18, 30] },
        'lifters|female|own|own': { Chest: [93, 6] },
      },
      defaultCompare: 'lifters|female|own|own',
    };
    social.friend = async () => ({
      audience: 'friends',
      doc: { audience: 'friends', isPublic: false, profile: { name: 'Autumn' },
             activity: [theirSession], benchmarks: [], strength: HER },
    });

    // 🔄 Her MAP, so the panel rather than the profile — see the block above.
    const her = await mount(FriendDataView('u1'));
    for (let i = 0; i < 12; i++) await settle();

    ok(/women who lift/.test(her.querySelector('.basis-main').textContent),
       '🚨 HER MAP OPENS ON WOMEN WHO LIFT, not on the reader\'s own sex — the whole of Tim\'s '
       + 'instruction, and it fails the moment this screen starts from settings.compare again');
    ok(!/men who lift/.test(her.querySelector('.basis-main').textContent.replace('women who lift', '')),
       '⚠️ and does not say "men" anywhere in that caption — the caption naming a population the '
       + 'colours were not computed against is the exact fault this control exists to prevent');

    const chest = her.querySelector('.body-map [data-muscle="Chest"]');
    chest.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 8; i++) await settle();
    const herLevel = her.querySelector('.muscle-level').textContent.trim();

    /* 🔒 THE VACUITY GUARD, and it is what makes the assertion above mean
     * something: pick MEN by hand and the level must MOVE. Without it, a screen
     * that ignored the grid entirely and printed one level for everything would
     * pass the caption check and this one. */
    her.querySelector('.basis-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 8; i++) await settle();
    const sheet = liveSheet();
    const sheetText = sheet.textContent.replace(/\s+/g, ' ');

    /* 🚨 THE SHEET SAYS "THEM", NOT "ME" — the same instruction, one screen in.
     * `own` on the weight and age axes has always meant the person the map is
     * about, so "My body weight" over her body named the wrong person as the
     * basis of everything on screen. */
    ok(/Like them/.test(sheetText) && !/Like me/.test(sheetText),
       '🚨 the preset on somebody else\'s page reads "Like them"');
    ok(/Their body weight/.test(sheetText) && !/My body weight/.test(sheetText),
       'and the body-weight chip says THEIR body weight');
    ok(/Their age/.test(sheetText) && !/My age/.test(sheetText),
       'and the age chip says THEIR age');

    /* 🚨 THE WORDINESS CUT — Tim, 2026-09-09: *"the 'compared to' (like me,
     * everyone) menu is pretty wordy and it really doesn't need any words at
     * all. I think it could do with some question marks or extream cuts."*
     *
     * ⚠️ ASSERTED AS AN ABSENCE **PLUS** A REACHABILITY, never as an absence
     * alone. A sheet that had simply deleted its explanations would pass the
     * first of these and fail the second, and that is the difference between
     * Rule 9 and losing a caveat. */
    ok(sheet.querySelectorAll('.preset-hint').length === 0,
       '🚨 no preset carries a hint under its name any more — the axis chips below light up to show '
       + 'what a preset means, and the line at the foot names it in words');
    const dots = [...sheet.querySelectorAll('.compare-axis .help-dot')];
    ok(dots.length === 4,
       `🚨 every one of the four axes has a ? instead of a paragraph (${dots.length})`);

    const poolDot = dots.find((d) => /population/i.test(d.getAttribute('aria-label') || ''));
    poolDot.click();
    await settle();
    const pop = document.querySelector('.help-pop').textContent;
    ok(/rough estimate/.test(pop) && /untrained adult/.test(pop),
       '🔒 AND THE UNTRAINED-ADULT CAVEAT IS STILL REACHABLE, word for word — it is the weakest '
       + 'number on this screen (D21) and moving it behind a ? may never soften it');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    const men = [...sheet.querySelectorAll('.chip')].find((b) => b.textContent === 'Men');
    men.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 10; i++) await settle();
    const asMen = her.querySelector('.muscle-level').textContent.trim();
    ok(herLevel !== asMen,
       `🔒 asking for men instead moves her level (${herLevel} → ${asMen}), so the row really is `
       + 'being read — the default is a choice rather than the only thing this screen can draw');
    ok(/men who lift/.test(her.querySelector('.basis-main').textContent),
       '🚨 AND THE CAPTION FOLLOWS IT. It was built once and never repainted, so changing the group '
       + 're-ranked the body and left the words naming the population it had just left');

    /* 🚨 THE LAPTOP LAYOUT — Tim, 2026-09-09: *"viewing another person's profile
     * (specifically on a laptop) is a mess. Everything is formated for an iphone
     * instead of a laptop."*
     *
     * ⚠️ jsdom HAS NO LAYOUT, so this pins the STRUCTURE the CSS needs rather
     * than any measurement: the figure and the panel are siblings inside one
     * `.map-split`, and the pane host does NOT take `is-muscles` — the class that
     * makes a host a ROW at 860px, which turned a friend's seven stacked sections
     * into seven columns. The browser audit measures the pixels; this stops the
     * shape being refactored out from under them. */
    ok(Boolean(her.querySelector('.map-split > .friend-body'))
       && Boolean(her.querySelector('.map-split > .body-foot')),
       '🚨 their figure and their panel are siblings in one .map-split, which is what lets a laptop '
       + 'put them side by side');
    const host = her.querySelector('.graph-host');
    ok(host && !host.classList.contains('is-muscles'),
       '🚨 and their pane is NOT `is-muscles` — that class makes the host a row, and a friend\'s '
       + 'page puts SEVEN sections in it, not the two your own map does');
    ok(host && host.classList.contains('is-shared-muscles'),
       'it carries its own class instead, so the two layouts cannot be styled by accident');

    social.friend = async () => ({ audience: 'friends', doc: theirDoc });
    await store.saveSettings({ compare: prevSettings.compare || {} });
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
    /* ⚠️ AND THE SCREEN SAYS WHAT THE COLOURS MEAN: each body is ranked against
       people its own size, so two people can read the same level at very
       different weights. "Advanced vs Advanced" would otherwise read as "the
       same lift".

       🚨 THE ASSERTION NOW REQUIRES **SEX**, AND ITS ABSENCE WAS THE BUG. Until
       2026-09-05 this line said "own body weight and age" and passed — while
       both bodies were in fact ranked against a single sex, the viewer's. Weight
       and age were per-person from the start, so the caption was narrowly true
       and complete-sounding, and the test was pinning exactly the two axes that
       already worked. Naming all three is what makes it catch a regression. */
    ok(/own sex, body weight and age/.test(text),
       '🚨 the screen states that each body is on its OWN sex, body weight and age — the three '
       + `axes, not the two that were never in doubt (${text.slice(text.indexOf('Each body'), text.indexOf('Each body') + 90)})`);
    ok(/vs\. people like each of them/.test(text),
       '⚠️ and the header names the per-person group rather than one population — a caption naming '
       + 'a population the colours were not computed against is the fault this label exists to prevent');
    ok(/never "who lifts more"|who is lifting more/.test(text),
       'and points at the estimate as the number that does answer who lifts more');

    /* ⚠️ AND THE CHIPS AGREE WITH THAT CAPTION — 2026-09-09. They read "My body
     * weight" directly above a sentence saying each body is on its OWN, which is
     * the same wrong pronoun Tim named on a friend's page, one screen over. The
     * key is still `own`; only the word changed. */
    cmp.querySelector('.basis-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    for (let i = 0; i < 8; i++) await settle();
    const eachSheet = [...document.querySelectorAll('.sheet')].pop().textContent.replace(/\s+/g, ' ');
    ok(/Own body weight/.test(eachSheet) && !/My body weight/.test(eachSheet),
       '🚨 with two bodies on screen the chip says "Own body weight", not "My" — the sheet may not '
       + 'contradict the sentence printed at the foot of itself');
    ok(!/Like them/.test(eachSheet),
       '⚠️ and "Like them" is NOT offered here — with two people, "them" names nobody in particular; '
       + 'that word belongs on the screen with one body on it');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    /* ================= 🚨 EACH BODY GETS ITS OWN POPULATION =================
     *
     * Tim, 2026-09-05: *"if there is a young woman, the girl's muscle group is
     * compared to other young women, but if that is being compared to an older
     * man, then the man is being compared to other older men. Right now both
     * people are being compared to the same people."*
     *
     * ⚠️ ASSERTED AT THE KEY, NOT THROUGH THE PIXELS, and that is deliberate.
     * Two bodies of different sexes will often land on the same LEVEL by
     * coincidence — the standards are built so that comparable people read
     * comparably — so an assertion on the rendered colours would pass with the
     * bug present most of the time. The comparison KEY is the thing that was
     * wrong, and it is exact: one object must produce two different keys.
     *
     * Marcus (male) and Priya (female) are in the demo precisely because they
     * differ; see DEMO_FRIENDS.
     */
    const { compareKey, comparePreset } = await import(BASE + 'strength-standards.js');
    const { ownSexOf } = await import(BASE + 'shared-map.js');

    const each = comparePreset('each');
    const asMale = { defaultCompare: 'lifters|male|own|own' };
    const asFemale = { defaultCompare: 'lifters|female|own|own' };

    ok(compareKey(each, ownSexOf(asMale)) === 'lifters|male|own|own'
       && compareKey(each, ownSexOf(asFemale)) === 'lifters|female|own|own',
       '🚨 ONE comparison object produces a DIFFERENT key per body — the man is read against men '
       + 'and the woman against women, which is the whole of what was asked for');

    // And the old behaviour, so the difference is pinned rather than assumed:
    // a concrete preset gives both bodies the same population.
    const likeMe = comparePreset('like-me', { gender: 'male' });
    ok(compareKey(likeMe, ownSexOf(asMale)) === compareKey(likeMe, ownSexOf(asFemale)),
       '⚠️ while "Like me" deliberately still gives BOTH bodies one population — it is a valid '
       + 'question ("hold them to the same standard"), and it was only wrong as the DEFAULT');

    ok(each.sex === 'own',
       '⚠️ and the mechanism is that the sex axis stays UNRESOLVED — weight and age were always '
       + 'per-person, because the owner resolves those when publishing their grid');

    /* The grid a real publisher writes must actually contain both rows, or the
     * key above resolves to nothing and the body silently fails to paint. */
    const { buildStrengthShare } = await import(BASE + 'store.js');
    const share = await buildStrengthShare();
    if (share && share.grid) {
      ok(Boolean(share.grid['lifters|male|own|own']) && Boolean(share.grid['lifters|female|own|own']),
         '🚨 and a published grid carries BOTH sexes\' rows, so the key each body resolves to is '
         + 'one that exists — a reader cannot recompute a percentile, so a missing row is a blank body');
    }
  }

  /* ---- 🚨 A FRIEND WHO HAS NOT MIGRATED YET ----
   *
   * Tim, minutes after the change shipped: *"When I click on compare for my
   * muscle map, and click on one of my friends, it says: Nothing to compare
   * yet."* His account had migrated; hers had not, because each account does its
   * own on its own device — so her whole page, feed cards included, had gone
   * blank to him.
   *
   * ⚠️ THE FIXTURE IS THE SHAPE HER LIVE DOCUMENT ACTUALLY HAD, read off the
   * project: a `full` tier document with `strength` as an ARRAY of
   * {muscle, level, percentile, confidence}. A tidier fixture would have proved
   * nothing — that is the mistake this file's own notes record about `sets: []`.
   */
  {
    const legacyDoc = {
      tier: 'full',
      profile: { name: 'Autumn' },
      activity: [theirSession],
      benchmarks: [],
      strength: [
        { muscle: 'Chest', level: 'Intermediate', percentile: 62, confidence: 0.7 },
        { muscle: 'Back', level: 'Novice', percentile: 31, confidence: 0.4 },
      ],
    };
    social.friend = async () => ({ audience: 'full', doc: legacyDoc, legacy: true });

    /* 🔄 The map is on the panel since 2026-09-16. ⚠️ The legacy PROFILE is
     * asserted too, further down this block: a friend whose app has not updated
     * must still render a sensible profile and say what is missing, which is the
     * same promise `legacyBody` makes about their map. */
    const fr = await mount(FriendDataView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    const t = fr.textContent.replace(/\s+/g, ' ');

    ok(Boolean(fr.querySelector('.friend-body .body-map')),
       '🚨 THEIR BODY IS STILL DRAWN — a friend does not vanish from the app while waiting for a '
       + 'deploy to reach their phone, which is the 2026-08-28 "her data is lost" incident in a '
       + 'different costume');
    ok(/Pull/.test(t), 'and their workouts are still listed');
    ok(/has not updated/.test(t),
       '⚠️ with one line saying why it is less than the real thing');
    ok(!fr.querySelector('.basis-btn'),
       '⚠️ AND NO COMPARISON CONTROL, because the old document cannot answer a different comparison '
       + 'group — a control that cannot answer is worse than an absent one');

    const cmp = await mount(CompareBodiesView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    const c = cmp.textContent.replace(/\s+/g, ' ');
    ok(/Autumn/.test(c) && /has not updated/.test(c),
       '🚨 and the compare screen NAMES THE PERSON AND THE REASON — it shipped saying "one of these '
       + 'two has not published a muscle map", which names neither and cannot be acted on');

    social.friend = async () => ({ audience: 'friends', doc: theirDoc });
  }

  /* ---- their volume and their graph, from the same functions as mine ----
   *
   * 🔄 REACHED AS TABS SINCE 2026-09-05, where they used to be screens of their
   * own. ⚠️ THE OLD ROUTES ARE ASSERTED HERE RATHER THAN THE OLD FUNCTIONS:
   * `#/friend/<uid>/volume` and `/graph` were live addresses, so they still have
   * to land somewhere sensible — on the friend's page, opened on that tab. The
   * screens went; the addresses did not.
   */
  {
    const vol = await mount(FriendDataView('u1', 'volume'));
    for (let i = 0; i < 12; i++) await settle();
    const v = vol.textContent.replace(/\s+/g, ' ');
    ok(/Autumn/.test(v), 'their volume tab names whose it is');
    ok(/most recent sixty|sixty/.test(v),
       '🚨 AND SAYS THE WINDOW IS NOT THEIR HISTORY — they publish sixty sessions, so this screen '
       + 'is not the same measurement as the one on their own phone, and silence would let it '
       + 'claim to be');
    ok([...vol.querySelectorAll('.segmented .seg')]
       .some((b) => b.textContent === 'Volume' && b.getAttribute('aria-selected') === 'true'),
       '⚠️ and the old /volume route opens the page ON that tab rather than 404-ing or landing on '
       + 'Muscles — a deep link that resolves to the wrong screen is worse than one that fails');

    const gr = await mount(FriendDataView('u1', 'trend'));
    for (let i = 0; i < 12; i++) await settle();
    const g = gr.textContent.replace(/\s+/g, ' ');
    ok(/Autumn/.test(g), 'and so does their graph');
    ok(/Lat Pulldown/.test(g) || /line to draw|two different days/.test(g),
       'which either charts a lift of theirs or says why it cannot');
  }

  Object.assign(social, original);
  await store.clearAll();
}

/* ================================================================== *
 * A FRIEND'S PROFILE — 2026-09-16, and what it refuses to claim
 *
 * 🚨 Tim: *"When you view a friend's profile, instead of going straight to the
 * muscle map and data section, I want you to view their profile display, like
 * how they see it for themselves, with their profile picture big at the top,
 * the workouts and frineds, the core lifts and weights (with other lifts
 * aswell) and their training history (calendar). Intentionally leave out the
 * goals. Display the 'your body' details, but leave out the weight (only show
 * gendar and age). Add a 'view data' button on the top right side … Then if the
 * user clicks the arrow again, it brings them back to the profile menu for that
 * user. Additionally allow the user to click on the friend's 'workouts' button
 * and 'friends' button … However, if you go back after going inside a frined's
 * friend, it doesn't go back to your friend, it goes back to your main profile
 * menu."*
 *
 * ⚠️ THE FIXTURE PUBLISHES THE 2026-09-16 CONTRACT FIELDS — `profile.gender`,
 * `profile.age` and `connections` — because every assertion about them is
 * otherwise asserting an absence, and an absence passes for a screen that was
 * never built. The block below it publishes NONE of them, which is every
 * document written before the fields existed and therefore the common case.
 *
 * 🚨 AND IT PUBLISHES A WEIGH-IN, which is the only way to prove the removal
 * Tim asked for. Their body weight IS shared with friends who opted in, and this
 * page printed it as a note until today — so a check that their profile never
 * shows it has to be run against a document that HAS one, or it proves nothing.
 * ================================================================== */
{
  const { FriendView, FriendDataView, FriendPeopleView, FriendWorkoutsView } =
    await import(BASE + 'views-social.js');
  const { GraphView } = await import(BASE + 'views-data.js');
  /* 🔄 ~~`markFriendTrail, friendTrailDepth` from ui.js~~ NOT IMPORTED SINCE
     2026-09-16 — see section 7, where the depth rule they served was replaced by
     an unconditional one and both functions lost their last reader. */
  const { social, store, todayISO } = await import(BASE + 'store.js');
  sessionStorage.removeItem('ftrack:v1:demo');
  await store.clearAll();

  const keep = {
    state: social.state, friend: social.friend, invites: social.invites,
    handoffs: social.handoffs, requests: social.requests,
    healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    processAcceptedRequests: social.processAcceptedRequests,
  };
  social.invites = async () => [];
  social.handoffs = async () => [];
  social.requests = async () => [];
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;
  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim',
    shareBodyWeight: false, visibility: 'private',
    connections: [{ uid: 'u1', name: 'Autumn', since: '2026-08-01' }],
  });

  const TODAY = todayISO();
  const YEAR = Number(TODAY.slice(0, 4));
  /* ⚠️ A DISTINCTIVE WEIGH-IN. 197.3 lb is a number that appears nowhere else on
     this screen, in either unit, so "their body weight is not printed" is a
     check on the weight rather than on a coincidence. */
  const THEIR_WEIGHT = 197.3;

  const hersDoc = (extra = {}) => ({
    audience: 'friends', isPublic: false,
    profile: { name: 'Autumn', gender: 'female', age: 28 },
    activity: [
      { id: 'fp1', date: TODAY, name: 'Pull', startedAt: `${TODAY}T09:00:00.000Z`,
        entries: [
          { exerciseId: 'lat-pulldown--back', name: 'Lat Pulldown',
            sets: [{ weight: 120, reps: 10 }] },
          // 🚨 A BODY-WEIGHT LIFT. With their weigh-in published it prices; with
          // it absent nothing on this device can price it, and the row has to
          // say so rather than being dropped or given the plate-only figure.
          { exerciseId: 'pull-up--back', name: 'Pull-Up',
            sets: [{ weight: 25, reps: 6 }] },
        ] },
      { id: 'fp2', date: `${YEAR}-02-10`, name: 'Push', startedAt: `${YEAR}-02-10T09:00:00.000Z`,
        entries: [{ exerciseId: 'lat-pulldown--back', name: 'Lat Pulldown',
          sets: [{ weight: 110, reps: 12 }] }] },
    ],
    benchmarks: [],
    strength: {
      muscles: [
        { muscle: 'Chest', lift: 'Barbell Bench Press', estimate: 120, confidence: 0.7,
          band: 'Good', basis: 'direct', contributorCount: 5, exerciseCount: 2,
          contributors: [{ exerciseName: 'Barbell Bench Press', weight: 110, reps: 5,
            date: `${YEAR}-02-10`, loadType: 'total', source: 'benchmark' }],
          hint: null, confident: true },
        { muscle: 'Back', lift: 'Barbell Row', estimate: 150, confidence: 0.5,
          band: 'Fair', basis: 'direct', contributorCount: 3, exerciseCount: 1,
          contributors: [{ exerciseName: 'Barbell Row', weight: 115, reps: 6,
            date: `${YEAR}-02-10`, loadType: 'total', source: 'workout' }],
          hint: null, confident: true },
      ],
      grid: { 'lifters|female|own|own': { Chest: [93, 6], Back: [58, 21] } },
      defaultCompare: 'lifters|female|own|own',
    },
    ...extra,
  });

  const FULL = hersDoc({
    bodyWeight: [{ date: `${YEAR}-02-10`, weight: THEIR_WEIGHT }],
    connections: [{ uid: 'u2', name: 'Marco' }, { uid: 'u3', name: '' }],
  });
  social.friend = async () => ({ audience: 'friends', doc: FULL });

  const flat = (n) => n.textContent.replace(/\s+/g, ' ');

  /* ---- 1. the two figures, and what each of them may claim ---- */
  {
    const prof = await mount(FriendView('u1'));
    for (let i = 0; i < 14; i++) await settle();
    const t = flat(prof);

    /* 🚨 THE WORKOUT FIGURE IS RENAMED, NOT FOOTNOTED. A published document
     * carries at most MAX_ACTIVITY sessions, so this counts what they PUBLISH
     * and not what they have trained — the same problem their calendar met and
     * solved by renaming the number ("N days published"), which docs/state.md
     * records as the right call. A tile reading "2" under WORKOUTS is a claim
     * about their training; under WORKOUTS SHARED it is a claim about their
     * document, which is the only thing this device knows. */
    const tiles = [...prof.querySelectorAll('.me-stat')].map((n) => flat(n));
    ok(tiles.some((x) => /Workouts shared/.test(x)),
       `🚨 the workout tile is labelled "Workouts shared", never bare "Workouts" (${tiles.join(' / ')})`);
    ok(!tiles.some((x) => /^\s*\d+\s*Workouts\s*$/.test(x)),
       '🔒 and there is no bare "Workouts" tile beside it that could be read as a career total');
    ok(/most recent 60 sessions at most/.test(t),
       '⚠️ and the window is NAMED under the pair — "shared" says the figure is bounded without '
       + 'saying by how much, and sixty is a number a reader can check an expectation against');

    ok(tiles.some((x) => /2 ?Friends/.test(x.replace(/\s+/g, ' '))),
       `🚨 the friends figure counts the list their app published (${tiles.join(' / ')})`);
    ok([...prof.querySelectorAll('a.me-stat')].map((a) => a.getAttribute('href'))
      .includes('#/friend/u1/friends'),
       '⚠️ and links to it, which is what makes "and so on if they want" possible');
    ok(!/has not published their friends list/.test(t),
       '🔒 with no "not published" line, because it IS published — the sentence below has to be '
       + 'able to be absent or its presence proves nothing');

    /* 🚨 NEVER THEIR BODY WEIGHT, EVEN THOUGH THIS DOCUMENT PUBLISHES ONE. Tim:
     * "Display the 'your body' details, but leave out the weight (only show
     * gendar and age)." This page printed their last weigh-in as a note until
     * today, so the absence is a removal rather than a gap. */
    ok(!/197/.test(t),
       '🚨 their profile never prints their body weight — not even for a friend who publishes it, '
       + 'and this fixture publishes one so the check is on the weight and not on a coincidence');

    ok(/Autumn's body/.test(t) && /Female · 28 years/.test(t),
       `⚠️ their body reads sex and age, from the published fields, and stops there (${t.slice(t.indexOf("Autumn's body"), t.indexOf("Autumn's body") + 60)})`);
    ok(!prof.querySelector('a[href="#/profile"]'),
       '🚨 and it is a READOUT, not a door — `#/profile` is MY form, there is no screen for '
       + 'somebody else\'s body, and a row that opened nothing would be the "control that cannot '
       + 'answer" this file already refuses on their calendar cells');

    /* 🛑 NO GOALS SECTION. Tim: "Intentionally leave out the goals." Nothing
     * about a goal is in a published document either, so there is no version of
     * it that could have been built honestly. */
    ok(!/Your goal|Set a goal/.test(t), '🛑 and the profile carries no goal section at all');

    /* ---- their best lifts, and which half this device may rank ---- */
    const coreRows = [...prof.querySelectorAll('.me-bests > .list > .me-best')];
    ok(coreRows.length === 8,
       `🚨 the core eight are always drawn, ranked or not (${coreRows.length})`);

    const bench = coreRows.find((r) => /Barbell Bench Press/.test(r.querySelector('.row-title').textContent));
    const benchNum = bench && bench.querySelector('.me-best-top');
    ok(Boolean(benchNum) && /lv-text-/.test(benchNum.className),
       '🚨 a core lift wears the level ramp its OWNER published for that muscle — a percentile '
       + 'needs a body weight and theirs is not ours to have (js/shared-map.js says recomputing '
       + 'one is the thing it cannot do)');
    // ⚠️ THE SEVEN LEVELS AND THE EIGHTH NON-LEVEL, from strength-standards.js's
    // own list. "Below Beginner" is what a percentile under the first band reads
    // as — `lv-text-below` refuses to invent an eighth level and neither does this.
    ok(bench && /confidence · (Below Beginner|Beginner|Novice|Intermediate|Proficient|Advanced|Expert|Elite)/
      .test(flat(bench.querySelector('.me-best-est'))),
       `⚠️ with the band and the LEVEL NAME in words beside it, so the colour is never the only carrier (${bench && flat(bench.querySelector('.me-best-est'))})`);
    ok(bench && /Barbell Bench Press 110 lbs × 5/.test(flat(bench)),
       '⚠️ and the recorded set their rating was led by, on the row — Rule 5\'s measured anchor');

    ok(/their body weight/.test(t) && /their age/.test(t),
       '⚠️ the comparison line names THEIR body and THEIR age — "people like you" over their '
       + 'figures is the exact fault the 2026-09-09 default change was made to stop');
    ok(/women who lift/.test(t),
       '🚨 and THEIR population, resolved from their own published defaultCompare');
    ok(!/people like you|your body weight|My body weight/i.test(t),
       '🔒 and never the reader\'s');

    /* 🚨 A MUSCLE THE GRID DOES NOT CARRY GETS A REASON, NOT A NUMBER — the
     * NO_NUMBER pattern from #/me, with its own sentences because "nothing
     * recorded for this muscle yet" is an instruction on my page and a
     * statement about somebody else on theirs. Six of the eight are unrated in
     * this fixture, which is what a thin published grid really looks like. */
    ok(/have not published a rating for this muscle/.test(t),
       '🚨 an unrated core muscle says why, in the number\'s slot, rather than leaving a hole');
    const noneRows = coreRows.filter((r) => r.querySelector('.me-best-none'));
    ok(noneRows.length === 6,
       `⚠️ and all six of them do, rather than being silently dropped (${noneRows.length})`);

    /* 🚨 EVERYTHING ELSE IS NUMBERED BUT NOT RANKED, with the reason said once.
     * Their app publishes a level per MUSCLE, not per lift; one worked out here
     * would be read against a different body from the one theirs was. */
    const otherRows = [...prof.querySelectorAll('.me-other .me-best')];
    ok(otherRows.length >= 2,
       `⚠️ their other lifts are listed (${otherRows.length})`);
    ok(otherRows.some((r) => /Lat Pulldown/.test(flat(r))),
       'including a lift only their published sets know about');
    ok(otherRows.every((r) => {
      const top = r.querySelector('.me-best-top');
      return !top || !/lv-text-/.test(top.className);
    }), '🔒 and NOT ONE of them wears a level chip — the colour half of the same refusal');
    ok(otherRows.filter((r) => r.querySelector('.me-best-top'))
      .every((r) => /not ranked|measured, not ranked/.test(flat(r.querySelector('.me-best-est')))),
       '⚠️ every numbered "other" row says "not ranked" in words beside its estimate');
    ok(/level per muscle rather than per lift/.test(t),
       '🚨 and the section says WHY nothing but the core eight is ranked — a list of unranked '
       + 'numbers with no reason reads as a feature that half-failed');

    /* ---- their calendar, from ownCalendar(), counting the honest thing ---- */
    ok(Boolean(prof.querySelector('.me-cal .cal-modes')),
       '🚨 their training history is on the profile, drawn by the same ownCalendar() as mine');
    ok(/day published|days published/.test(t),
       '⚠️ counting days PUBLISHED, never days trained — their document holds sixty sessions, so '
       + 'the figure is bounded by what they share and says nothing about what they did');
    ok(!/days trained|day trained/.test(t),
       '🔒 and the word "trained" appears nowhere on somebody else\'s page');
  }

  /* ---- 2. the same document with none of the new fields ---- */
  {
    const bare = hersDoc();
    delete bare.profile.gender;
    delete bare.profile.age;
    social.friend = async () => ({ audience: 'friends', doc: bare });
    const prof = await mount(FriendView('u1'));
    for (let i = 0; i < 14; i++) await settle();
    const t = flat(prof);

    ok(!/Autumn's body/.test(t),
       '⚠️ with NEITHER field the body section is omitted rather than printing an empty row — '
       + 'which is every document published before the fields existed, so it is the common case');

    /* 🚨 ABSENT IS NOT ZERO. `connections` does not exist on a document written
     * before 2026-09-16, and printing 0 there would invent a fact about somebody
     * else's social life out of a field that has never been written. */
    const friendTile = [...prof.querySelectorAll('.me-stat')]
      .find((n) => /Friends/.test(n.textContent));
    ok(friendTile && /—/.test(friendTile.textContent) && friendTile.tagName !== 'A',
       '🚨 and the friends figure is a DASH with no link, never 0');
    ok(/has not published their friends list yet/.test(t),
       '⚠️ with one line saying their app has not published it — the difference between "they '
       + 'have none" and "we have not been told" is visible to the reader, so it is stated');

    /* 🚨 A BODY-WEIGHT LIFT NOBODY CAN PRICE. `bestLifts()` returns no
     * `estimatedMax` for a pull-up with no weigh-in in the document, so the row
     * would otherwise fall to the converted branch and print their muscle rating
     * multiplied back out on this device. */
    ok(/cannot be priced/.test(t),
       '🚨 a pull-up from somebody who publishes no weigh-in says so, rather than being silently '
       + 'dropped OR given the plate-only figure — which would read as a 25 lb pull-up max');
    ok(/Pull-Up/.test(t),
       '⚠️ and the lift is still LISTED, with the days they trained it — a refusal about a number '
       + 'is not a reason to lose the lift');
  }

  /* ---- 3. their friends list: "none" is not "not published" ---- */
  {
    social.friend = async () => ({ audience: 'friends',
      doc: hersDoc({ connections: [{ uid: 'u2', name: 'Marco' }, { uid: 'u3', name: '' }] }) });
    const list = await mount(FriendPeopleView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    ok(/Marco/.test(list.textContent), 'their friends list renders the published rows');
    ok(/Someone/.test(list.textContent),
       '⚠️ and a row whose published name is empty still says something rather than nothing');
    ok([...list.querySelectorAll('a.row')].map((a) => a.getAttribute('href'))
      .includes('#/friend/u2'),
       '🚨 each row opens THAT person\'s page, which is the whole of "and so on if they want"');

    social.friend = async () => ({ audience: 'friends', doc: hersDoc({ connections: [] }) });
    const none = await mount(FriendPeopleView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    ok(/No friends yet/.test(none.textContent),
       'an empty PUBLISHED list says they are not connected to anybody');

    social.friend = async () => ({ audience: 'friends', doc: hersDoc() });
    const gap = await mount(FriendPeopleView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    ok(/has not published/.test(gap.textContent) && !/No friends yet/.test(gap.textContent),
       '🚨 while an ABSENT field says their app has not published it — "No friends yet" there '
       + 'would be this app stating something false about somebody\'s social life on the strength '
       + 'of a field that did not exist when their app last ran');
  }

  /* ---- 4. their workouts ---- */
  {
    social.friend = async () => ({ audience: 'friends', doc: FULL });
    const wk = await mount(FriendWorkoutsView('u1'));
    for (let i = 0; i < 10; i++) await settle();
    const t = flat(wk);
    ok(/2 workouts Autumn has published/.test(t),
       `⚠️ the count says PUBLISHED, the third place this one figure is stated and the third time it may not read as a career total (${t.slice(0, 90)})`);
    ok(/most recent 60 sessions at most/.test(t), 'and names the window, as the tile does');
    ok(wk.querySelectorAll('.act').length === 2,
       'with one row per published workout, from the same activityRow() their page has always used');
  }

  /* ---- 5. every old address still resolves, onto the panel ---- *
   *
   * 🚨 THIS PROJECT HAS NOT BROKEN A DEEP LINK YET. `#/friend/<uid>/volume` and
   * `/graph` were live screens until 2026-09-05 and tabs until 2026-09-16;
   * `muscles` and `bars` read exactly like them and were reserved at the same
   * time, because a link somebody could reasonably type otherwise resolved to
   * "that workout is not here".
   *
   * ⚠️ THE MAP IS WRITTEN OUT HERE because `js/app.js` cannot be imported into a
   * DOM test — it boots on import. This mirrors `FRIEND_DATA_TABS`; if the two
   * ever disagree, the browser is where that shows, and the tab each segment
   * lands on is what this pins. */
  {
    const ROUTES = [['data', null, 'Muscles'], ['volume', 'volume', 'Volume'],
      ['graph', 'trend', 'Graph'], ['muscles', 'muscles', 'Muscles'],
      ['bars', 'compare', 'Bars']];
    for (const [seg, tab, label] of ROUTES) {
      const v = await mount(FriendDataView('u1', tab));
      for (let i = 0; i < 12; i++) await settle();
      const on = [...v.querySelectorAll('.segmented .seg')]
        .find((b) => b.getAttribute('aria-selected') === 'true');
      ok(on && on.textContent === label,
         `⚠️ #/friend/<uid>/${seg} opens the panel on ${label} (${on && on.textContent})`);
      ok(Boolean(v.querySelector('.topbar .icon-btn[aria-label="Close"]'))
         && !v.querySelector('.topbar .icon-btn[aria-label="Back"]'),
         `🛑 and /${seg} carries the DOWN arrow even opened cold — it means "put this away", which `
         + 'lands on their profile whatever route arrived at it, where a back arrow on a cold '
         + 'open would step off the site');
    }

    /* 🆕 AND `#/friend/<uid>/calendar` IS RESERVED SINCE 2026-09-16, ONTO THEIR
       PROFILE — not onto the panel. The segment left the panel that day, and
       this address was never in `FRIEND_DATA_TABS`: it fell through to the
       session branch and resolved to "that workout is not here". So nothing is
       being rescued; a link that reads exactly like the four above is being made
       to answer, which is the argument `muscles` and `bars` were reserved on
       this morning.

       ⚠️ THE ROUTE ITSELF CANNOT BE DRIVEN HERE — `js/app.js` boots on import —
       so what is pinned is the half a test CAN see and the half that could
       actually be wrong: that the screen the address is mapped to is the one
       holding a calendar, and the panel is not. An address landing on four tabs
       none of which is a calendar is the failure this guards. */
    {
      const prof = await mount(FriendView('u1'));
      for (let i = 0; i < 14; i++) await settle();
      ok(Boolean(prof.querySelector('.me-cal .cal-modes')),
         '🚨 #/friend/<uid>/calendar is mapped to their PROFILE, which is the screen that holds '
         + 'their calendar');
      const panel = await mount(FriendDataView('u1'));
      for (let i = 0; i < 12; i++) await settle();
      ok(!panel.querySelector('.cal-modes'),
         '⚠️ and the panel it used to open no longer holds one at all, which is why the address '
         + 'may not be pointed there');
    }
  }

  /* ---- 6. the segments are an explicit ask, not an inference ---- *
   *
   * 🚨 Research is left off a friend's page for a reason about CONTENT — Tim:
   * "exclude research because it doesn't share anything new", it being eleven
   * topics about training in general, identical on everybody's screen — and
   * until 2026-09-16 that reason was expressed as "this screen was given rows,
   * therefore four tabs and a calendar". `opts.segments` lets the caller that
   * HAS the reason state it. */
  {
    const only = await mount(GraphView({ segments: ['muscles', 'volume'] }));
    for (let i = 0; i < 10; i++) await settle();
    ok([...only.querySelectorAll('.segmented .seg')].map((b) => b.textContent).join('|')
       === 'Muscles|Volume',
       '⚠️ GraphView draws exactly the segments it is asked for, in the order it is asked for');
    const rev = await mount(GraphView({ segments: ['volume', 'muscles'] }));
    for (let i = 0; i < 10; i++) await settle();
    ok([...rev.querySelectorAll('.segmented .seg')].map((b) => b.textContent).join('|')
       === 'Volume|Muscles',
       '🔒 including the order, which is the caller\'s and not this file\'s — reading it out of a '
       + 'label map would silently impose one');
  }

  /* ---- 7. the back rule, and it is Tim's override of Rule 8 ---- *
   *
   * 🚨 *"if you go back after going inside a frined's friend, it doesn't go back
   * to your friend, it goes back to your main profile menu."* Rule 8's arrow
   * goes through history; `backExact: true` is the existing opt-out and this is
   * its second user after the finish screen. It is written down as an override
   * so the next person to read Rule 8 does not "fix" it.
   *
   * 🔄 AND IT IS UNCONDITIONAL SINCE LATER THE SAME DAY, ~~depth 1 behaved
   * normally and only depth ≥ 2 jumped home~~. Tim's second report: *"when I go
   * into a user's 'view data' section, then close to go into their main profile
   * display, and then go 'back', it takes me back into the data section, rather
   * than my own profile display … Fix this so it takes the user to their own
   * profile display whenever they go 'back' from another user's main profile
   * display, no matter where they were prior to that."*
   *
   * 🚨 WHY THE DEPTH RULE WAS THE WRONG AXIS, and it is the point of the four
   * cases below. Depth measured how many PEOPLE deep the walk was; the fault is
   * how many SCREENS. The panel's down arrow NAVIGATES to `#/friend/<uid>`, so
   * the entry behind a depth-1 profile is the panel just put away — and the old
   * arrow dutifully reopened it. The Home feed does the same through a session.
   *
   * ⚠️ THESE DRIVE THE ARROW, NOT A HELPER. The depth-stamping functions in
   * `ui.js` were what the old version of this section drove, and they have no
   * caller left anywhere in the app — so a test that still exercised them would
   * be the only thing keeping them alive, which is the shape of a mechanism
   * outliving its reason. What is asserted now is the thing a reader taps. */
  {
    const backBtn = (screen) => screen.querySelector('.topbar .icon-btn[aria-label="Back"]');
    social.friend = async () => ({ audience: 'friends', doc: hersDoc() });

    /* Each entry is the route somebody was on BEFORE the profile. `navIndex`
       is what `markRoute()` writes and what `canGoBack()` reads, so a non-zero
       one is the state in which Rule 8's arrow would go through history — which
       is exactly what must not happen here. */
    const ARRIVALS = [
      ['#/friend/u1/data', 'their data panel, put away with the down arrow — Tim\'s own report'],
      ['#/friend/u9', 'inside another friend, the walk the override was written for'],
      ['#/home', 'the Home feed'],
      ['#/me/friends', 'my own friends list'],
    ];
    for (const [from, what] of ARRIVALS) {
      history.replaceState({ navIndex: 3 }, '', from);
      const prof = await mount(FriendView('u1'));
      for (let i = 0; i < 12; i++) await settle();
      const b = backBtn(prof);
      ok(Boolean(b), `their profile carries a back arrow, arriving from ${what}`);
      b.click();
      await settle();
      ok(globalThis.location.hash === '#/me',
         `🚨 and it lands on #/me, not on ${from} — "no matter where they were prior to that" `
         + `(${globalThis.location.hash})`);
    }

    /* 🔒 A COLD ARRIVAL TOO, which is the case a history-reading arrow gets
       right by accident: with nothing behind it, Rule 8 would fall back to
       `#/social`. The destination is `#/me` either way now, so this pins the
       rule rather than the fallback. */
    history.replaceState({ navIndex: 0 }, '', '#/friend/u1');
    {
      const prof = await mount(FriendView('u1'));
      for (let i = 0; i < 12; i++) await settle();
      backBtn(prof).click();
      await settle();
      ok(globalThis.location.hash === '#/me',
         '🔒 and a cold-opened profile — a deep link, a reload — goes to #/me as well, rather than '
         + 'to the #/social fallback it used to have');
    }

    /* 🛑 THE SUB-SCREENS ARE NOT THE PROFILE AND DO NOT MOVE. Their workouts and
       their friends list are screens OF THAT FRIEND; sending those home too
       would cost the reader the person they were reading for one tap they did
       not ask for. Rule 8's ordinary arrow is right for them. */
    history.replaceState({ navIndex: 3 }, '', '#/friend/u1');
    {
      const wk = await mount(FriendWorkoutsView('u1'));
      for (let i = 0; i < 10; i++) await settle();
      backBtn(wk).click();
      await settle();
      ok(globalThis.location.hash !== '#/me',
         `🛑 their workouts list does NOT jump home — it is a screen of THAT friend, and its arrow `
         + `still goes back to them (${globalThis.location.hash})`);
    }
    history.replaceState({}, '', '#/home');
  }

  /* ---- 8. the demo renders the same profile, not a fixture of its own ---- *
   *
   * 🚨 THIRD TIME THIS RULE HAS HAD TO BE APPLIED TO `friendScreen()`. It was a
   * near-duplicate of the real page's body, and when the real page grew a Data
   * tab bar on 2026-09-05 the demo nearly kept the old layout — and the demo is
   * where every screen in this app gets looked at, measured and audited (§0.10).
   * It is not a near-duplicate any more: `friendProfileScreen()` draws both and
   * `demo: true` is the only difference, so the layout cannot fall behind. */
  {
    sessionStorage.setItem('ftrack:v1:demo', '1');
    const { demo } = await import(BASE + 'store.js');
    /* 🔒 AND THE REAL `social.state` AND `social.friend` GO BACK FIRST. The stubs
     * above answer `{ available: true, reason: null }`, and `friendDoc()` reaches
     * its demo branch on `state.reason === 'demo'` — so with them in place this
     * block would have driven the REAL path against a stubbed document and
     * asserted the demo's behaviour without ever entering the demo. It did,
     * until the assertion below caught it. */
    Object.assign(social, { state: keep.state, friend: keep.friend });
    ok(demo.active(), 'the demo flag is on, so this is not passing vacuously');
    ok((await social.state()).reason === 'demo',
       '🔒 and the app really is IN the demo — a stubbed social state would send this down the '
       + 'real path and prove nothing about the demo at all');

    const d = await mount(FriendView('demo-friend-1'));
    for (let i = 0; i < 16; i++) await settle();
    ok(Boolean(d.querySelector('.me-head .me-face')) && Boolean(d.querySelector('.me-stats')),
       '🚨 the demo friend renders the SAME profile shape as a real one — a fixture rendering a '
       + 'layout the app no longer has is a known failure mode here');
    ok(Boolean(d.querySelector('.me-bests')) && Boolean(d.querySelector('.me-cal')),
       'with their best lifts and their training history on it');
    ok(!d.querySelector('.danger-zone'),
       '⚠️ minus the relationship footer: Disconnect and Send a friend request act on a real '
       + 'account, and a control that cannot do what it says is worse than an absent one');
    sessionStorage.removeItem('ftrack:v1:demo');
  }

  Object.assign(social, keep);
  await store.clearAll();
}

/* ================================================================== *
 * THE BLANKS THAT BECAME NUMBERS — 2026-09-06, docs/direction.md §3.1
 *
 * Tim: *"something is always better than nothing"*, with the half he kept being
 * *"have a way to be upfront about it."* Four screens used to refuse where they
 * were holding the numbers. Each assertion below is paired with the thing that
 * must NOT have happened — a screen that started guessing instead of widening,
 * or a gate that came off where it was load-bearing.
 * ================================================================== */
{
  const { GraphView } = await import(BASE + 'views-data.js');
  const { GoalsView } = await import(BASE + 'views-goals.js');
  const { store } = await import(BASE + 'store.js');
  const text = (n) => n.textContent.replace(/\s+/g, ' ');
  const tab = (root, name) => [...root.querySelectorAll('.seg')].find((b) => b.textContent === name);

  await store.clearAll();
  await store.saveSettings({ units: 'lbs' });          // no gender, no weigh-in
  const bp = byName('Barbell Bench Press');
  await store.saveSession({
    workoutId: 'w1', workoutName: 'Push', date: '2026-08-10',
    entries: [{ exerciseId: bp.id, exerciseName: bp.name,
                sets: [{ weight: 185, reps: 5 }, { weight: 205, reps: 3 }] }],
  });

  /* ---- the muscle map ranks, and says what it had to assume ---- */
  let d = await mount(GraphView());
  tab(d, 'Muscles').click();
  await settle(); await settle();
  const m = text(d);

  ok(Boolean(d.querySelector('svg')),
     '🚨 THE HEADLINE: with no sex and no weigh-in the body is DRAWN. This screen used to be two '
     + 'sentences and a button over an account holding recorded sets');
  ok(/assumed male/i.test(m),
     'and it says the sex was assumed — the label is the whole permission for the number');
  /* 🚨 THIS ASSERTION USED TO PIN THE OPPOSITE SENTENCE, AND THE SENTENCE WAS
   * FALSE. It read "a missing weigh-in widens the comparison to lifters of
   * every size, which is a real group" and guarded, as a mutation check, that
   * no reference weight was ever printed. Both halves described an intention.
   * The arithmetic never widened anything: `weight: 'any'` resolves to the
   * reference body weight, so the app compared the user against exactly a
   * 180 lb man (140 lb woman) and captioned it as a group. Measured on the demo
   * bench: a true 150 lb lifter read the 69th percentile and was shown the
   * 54th; a 250 lb lifter read the 28th and was shown the same 54th.
   *
   * So the screen says what the maths does — "as if 180 lb" — and the old
   * mutation guard is inverted: the reference weight MUST now appear, because
   * hiding it was the bug. The honesty is unchanged in kind, only in accuracy:
   * an assumption stated is still an assumption stated. */
  ok(/as if .*180 ?lb/i.test(m),
     '🚨 THE ASSUMPTION IS NAMED FOR WHAT IT IS. With no weigh-in the app ranks the user as if they '
     + 'weighed 180 lb, and now says so — it never widened the comparison to "every size", it just '
     + 'described itself that way');
  ok(!/every size/i.test(m),
     '⚠️ and the old sentence is gone rather than sitting beside the new one — two descriptions of '
     + 'one number is how the wrong one survives');
  ok(Boolean(d.querySelector('a[href="#/profile"]')),
     'and the way to replace the assumption with the truth is still one tap away');

  /* ---- 🛑 but Goals still refuses, and that is deliberate ---- */
  const g = await mount(GoalsView());
  ok(/gender|body weight/i.test(text(g)) && Boolean(g.querySelector('a[href="#/profile"]')),
     '🛑 GOALS KEEPS THE GATE THE MAP GAVE UP, and this is a regression test for a trap rather '
     + 'than a leftover: a goal FREEZES its target weight when set (D20), so a goal set against an '
     + 'assumed sex would carry that assumption for twelve weeks after the profile was filled in '
     + 'and every other screen had stopped mentioning it. The map is a reading and is relabelled; '
     + 'a goal is not');

  /* ---- Volume states a rate over a short window, and names the window ---- */
  await store.saveProfile({ gender: 'male', birthYear: 1994 });
  await store.logBodyWeight(180, '2026-08-01');
  d = await mount(GraphView());
  tab(d, 'Volume').click();
  await settle(); await settle();
  const v = text(d);
  ok(/\/ ?wk/.test(v),
     'Volume states sets a WEEK even on a few days of history — it used to print raw totals under a '
     + 'heading that had changed while the thresholds had not');
  ok(/\d+ days?/.test(v),
     'and names the span it measured over, because a rate from five days is a real number and a '
     + 'settled one is a different claim');

  /* ---- one recording is a number, not an empty state ---- */
  tab(d, 'Graph').click();
  await settle(); await settle();
  const gr = text(d);
  ok(/One recording so far/i.test(gr) || /205|185/.test(gr),
     'a lift recorded on one day shows what was recorded rather than "nothing to chart"');
  ok(!/^\s*$/.test(gr) && (!/One recording so far/i.test(gr) || /~/.test(gr)),
     'and when it says so it prints the estimated max beside it, marked with ~ as an estimate');
  ok(!/One point is not a line/i.test(gr) || !gr.includes('trend line'),
     '⚠️ and draws no line through one point — Rule 5, an inference must not look like a '
     + 'measurement, and one point has no trend to show');

  await store.clearAll();
}

/* ================================================================== *
 * THE THREE THAT SHIPPED WITHOUT A TEST NAMING THEM — 2026-09-06
 *
 * ⚠️ ALL THREE WERE VERIFIED BY HAND IN THROWAWAY SCRIPTS THAT WERE THEN
 * DELETED, which is exactly the proof this project does not count. The
 * one-source-per-row rule is the reason this block exists at all: it is D14,
 * and a rule with no test is a rule that comes back.
 * ================================================================== */
{
  const { GraphView } = await import(BASE + 'views-data.js');
  const { GoalsView } = await import(BASE + 'views-goals.js');
  const { SessionView } = await import(BASE + 'views-session.js');
  const { store } = await import(BASE + 'store.js');
  const text = (n) => n.textContent.replace(/\s+/g, ' ');
  const tab = (root, name) => [...root.querySelectorAll('.seg')].find((b) => b.textContent === name);

  await store.clearAll();
  await store.saveProfile({ gender: 'male', birthYear: 1994 });
  await store.logBodyWeight(180, '2026-06-01');

  const bench = byName('Barbell Bench Press');
  const squat = byName('Back Squat');

  /* ---- 🚨 ONE SOURCE PER ROW ON BARS (Rule 4 / D14) ----
     The squat is BENCHMARKED on two days; the bench is only ever done in
     WORKOUTS, on two days. So the two rows must come from different sources and
     each must say which — and neither row may be built by taking a start from
     one source and a now from the other, which is the mixing that makes
     strength look like it swings wildly. */
  await store.saveBenchmark({ date: '2026-06-10', exerciseId: squat.id, exerciseName: squat.name, values: { weight: 275, reps: 5 } });
  await store.saveBenchmark({ date: '2026-08-10', exerciseId: squat.id, exerciseName: squat.name, values: { weight: 315, reps: 5 } });
  await store.saveSession({ workoutId: 'w1', workoutName: 'Push', date: '2026-06-12',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 185, reps: 5 }] }] });
  await store.saveSession({ workoutId: 'w1', workoutName: 'Push', date: '2026-08-12',
    entries: [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 205, reps: 5 }] }] });

  let d = await mount(GraphView());
  tab(d, 'Bars').click();
  await settle(); await settle(); await settle();
  const bars = text(d);

  ok(!/Nothing to compare yet/i.test(bars),
     'Bars fills from workout sets instead of the blank it used to show when nothing had been '
     + 'benchmarked twice');
  ok(/Barbell Bench Press/.test(bars) && /Back Squat/.test(bars),
     'and both lifts get a row — one that was benchmarked, one that was only ever done in workouts');
  ok(/Workouts/.test(bars) && /Benchmarks/.test(bars),
     '🚨 EACH ROW SAYS WHICH SOURCE IT CAME FROM. Two rows from two sources on one screen is fine; '
     + 'a row that does not say which is not, because the reader cannot tell whether the comparison '
     + 'is like-for-like');
  ok(/never mixed|One source per lift/i.test(bars),
     '⚠️ and the screen states the rule itself (D14) — one source per lift, never a start from a '
     + 'benchmark against a now from a training day');

  /* ---- the runner says WHY a weight field is blank ----
     Leg Press is a machine: its ratio quality sits below FALLBACK_MIN_QUALITY
     precisely because a leg press depends on leverage the app knows nothing
     about. With no leg history either, the runner has nothing honest to put in
     the field — and used to leave it blank with no explanation. */
  const legPress = byName('Leg Press');
  const w = await store.saveWorkout({
    name: 'Legs', systemId: null,
    exercises: [{ exerciseId: legPress.id, sets: 3 }],
  });
  const run = await mount(SessionView(w.id));
  for (let i = 0; i < 6; i++) await settle();
  const rt = text(run);
  ok(/No opening weight/i.test(rt),
     '🚨 the runner SAYS why the weight field is empty — "no suggestion" for a reason you cannot '
     + 'see reads as broken, which is the argument historyForPerson() already makes one screen over');
  ok(/nothing you have recorded|closely enough/i.test(rt),
     'and gives the reason rather than just announcing the absence');

  await store.clearAll();
}

/* ================================================================== *
 * 🚨 WHAT THE DATA TAB REFUSED TO READ, SAID OUT LOUD — 2026-09-14
 *   (docs/strength-accuracy-plan.md §2.2, decision l)
 *
 * D5 — no maximum is inferred from a set above 15 reps — was enforced in the
 * store on 2026-09-13 and NOT on this tab until the same day. A 135 × 25
 * burnout set was restated as a 258 lb max and beat a real 205 × 5 on the
 * bests list and on the chart.
 *
 * 🚨 THE FIX IS ONLY HALF A FIX WITHOUT THE SENTENCE. A lifter who logged three
 * sets and sees two points reads it as data loss, not as a rule — so the
 * refusal has to be named, and the one thing they can do about it (take a
 * heavier set to a lower rep count) is what the wording implies. Both
 * sentences below are on screens nothing has ever asserted, and neither is
 * reachable in the demo account.
 *
 * ⚠️ IT IS PLACED HERE, AFTER THE LAST BLOCK THAT MOUNTS GraphView, AND THE
 * REASON IS MODULE STATE. `targetReps` in views-data.js is keyed by
 * exercise|source and outlives a `clearAll()`, and the last thing this block
 * does is walk the rep target to its ceiling. Running before another Graph
 * block would hand that block a 15-rep target it never asked for.
 * ================================================================== */
{
  const { GraphView } = await import(BASE + 'views-data.js');
  const { store, clearReadCache } = await import(BASE + 'store.js');
  const text = (n) => n.textContent.replace(/\s+/g, ' ');

  await store.clearAll();
  await store.saveSettings({ units: 'lbs' });
  await store.saveProfile({ gender: 'male', birthYear: 1994 });
  await store.logBodyWeight(180, '2026-08-01');   // ONE weigh-in: no body-weight line

  const bp = byName('Barbell Bench Press');
  const day = (id, date, top, burnout) => ({
    id, date, workoutName: 'Push',
    entries: [{ exerciseId: bp.id, exerciseName: bp.name,
      sets: [{ weight: 185, reps: top }, { weight: 135, reps: burnout }] }],
  });

  /* ---- 1. the bests list, where a lift has only ONE recorded day ----
     One day means no line can be drawn, so the Graph tab falls through to
     `bestsPane()` — which is the screen this sentence lives on. */
  await store.importAll({ sessions: [day('drop-1', '2026-08-20', 5, 25)] });
  clearReadCache('seeded one day with a burnout set');
  let d = await mount(GraphView());
  [...d.querySelectorAll('.seg')].find((b) => b.textContent === 'Graph').click();
  for (let i = 0; i < 20; i++) await settle();
  const one = text(d);

  ok(/Sets over 15 reps are not used for a max/.test(one),
     `🚨 the bests list SAYS a set was left out, rather than silently dropping it (${one.slice(-220)})`);
  ok(/sets left out that way\./.test(one),
     '⚠️ and it ends by naming how many lifts it happened to — the reader who remembers logging '
     + 'that set is owed the count, not just the rule');
  ok(/One lift has sets left out that way\./.test(one),
     'in the singular, because exactly one lift here has one');
  /* 🚨 THE VACUITY GUARD, AND IT IS THE BUG ITSELF. The sentence would be worth
     nothing if the 25-rep set had still won the row: the whole reason it is
     printed is that 135 × 25 no longer stands where 185 × 5 belongs. */
  ok(/185 × 5/.test(one) && !/135 × 25/.test(one),
     '🚨 and the row itself is the 185 × 5, not the 135 × 25 that used to out-rank it');

  /* ---- 2. the chart, where the same refusal gets its own caption ----
     A second day makes the lift chartable, so the bests list is gone and the
     dropped sets are reported under the line instead. Two different sentences
     on two different screens; the audit found neither. */
  await store.importAll({
    sessions: [day('drop-1', '2026-08-20', 5, 25), day('drop-2', '2026-08-27', 5, 22)],
  });
  clearReadCache('seeded a second day so the lift charts');
  d = await mount(GraphView());
  for (let i = 0; i < 20; i++) await settle();
  const chart = text(d);
  ok(Boolean(d.querySelector('svg.chart')) && !/sets left out that way/.test(chart),
     'with two days the lift charts, so the bests list — and its sentence — are gone');
  ok(/2 sets over 15 reps aren't used here\./.test(chart),
     `🚨 and the CHART carries its own count of what it would not plot (${chart.slice(-200)})`);
  ok(!/Estimates get looser above 10 reps\./.test(chart),
     '⚠️ and at the default 5-rep target there is no confidence warning — the two captions are '
     + 'about different things, and the audit found the target warning standing in for both');

  /* ---- 3. the rep target has the same ceiling as the evidence gate ----
     🚨 MAX_TARGET_REPS WAS 20 AND IS 15 (decision l): the chart could be set to
     a rep count the app refuses to read a maximum from, so every real set was
     being restated at a target the curve is not trusted at. The stepper is
     where a reader meets that ceiling, so this walks it into the wall. */
  const stepUp = () => [...d.querySelectorAll('.mini-stepper .mini-btn')][1];
  for (let k = 0; k < 20; k++) { stepUp().click(); for (let i = 0; i < 4; i++) await settle(); }
  const maxed = text(d);
  ok(d.querySelector('.mini-value').textContent === '15',
     `🚨 the rep target stops at 15 — the same number D5 refuses to read a maximum past, so the `
     + `chart can never be drawn at a rep count the evidence gate would reject `
     + `(${d.querySelector('.mini-value').textContent})`);
  ok(/Estimates get looser above 10 reps\./.test(maxed),
     `⚠️ and above 10 the chart says so, in the reader's own words (${maxed.slice(-200)})`);
  /* ⚠️ THE OTHER HALF OF THAT SENTENCE IS UNREACHABLE, AND THIS IS WHERE IT
     WOULD SHOW UP. `renderNormalized()` also carries "Estimates above 15 reps
     are unreliable." for `repConfidence(target) === 'poor'`, which needs a
     target of 16 or more — and `clampReps()` and the stepper both stop at 15.
     Asserted as the ceiling holding rather than as the branch being dead: if
     MAX_TARGET_REPS ever goes back to 20, the assertion above fails and this
     one starts finding the sentence. Reported to Tim, 2026-09-14. */
  ok(!/above 15 reps are unreliable/.test(maxed),
     'and it is never the harsher wording, because the target cannot get above 15 to earn it');

  // Put the target back where it was found: `targetReps` outlives clearAll().
  const stepDown = () => [...d.querySelectorAll('.mini-stepper .mini-btn')][0];
  for (let k = 0; k < 20; k++) { stepDown().click(); for (let i = 0; i < 4; i++) await settle(); }
  await store.clearAll();
}

/* ================================================================== *
 * 🚨 WHAT THE MUSCLE PANEL SETS ASIDE, AND WHAT IT KNOWS ABOUT FRESHNESS
 *   — 2026-09-14 (docs/strength-accuracy-plan.md §3.2, Tim's decision b)
 *
 * `screenDaily()` was fitted and measured on 2026-08-19 and then never called,
 * so one mistyped set rated a chest 1,958 lb, Elite, at "Good" confidence. The
 * quarantine that fixes it shipped on 2026-09-13 with the module-level tests in
 * data-layer.test.mjs and NOTHING asserting that the panel says so — and a
 * quarantine nobody is told about is indistinguishable from the app losing the
 * set. Not reachable in the demo year either: it quarantines nothing (that is
 * asserted over there), which is the point of the demo and the reason this
 * fixture has to be built by hand.
 *
 * ⚠️ THE WORDING IS THE FEATURE. The app cannot tell a mistyped 1,800 from a
 * genuine jump, so the sentence says what it DID, says the set still counts if
 * it happens again, and leaves the judgement with the person who was there.
 * "Repeat it and it counts" is asserted for that reason and not as decoration:
 * without it the line is the app calling a lifter careless.
 * ================================================================== */
{
  const { GraphView } = await import(BASE + 'views-data.js');
  const { store, clearReadCache, todayISO } = await import(BASE + 'store.js');
  const text = (n) => n.textContent.replace(/\s+/g, ' ');
  await store.clearAll();
  await store.saveSettings({ units: 'lbs' });
  await store.saveProfile({ gender: 'male', birthYear: 1994 });
  await store.logBodyWeight(180, '2026-06-01');
  const bp = byName('Barbell Bench Press');
  const sq = byName('Back Squat');
  const back = (n) => {
    const d = new Date(todayISO() + 'T12:00:00');
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const sess = (id, date, ex, weight) => ({
    id, date, workoutName: 'W',
    entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: [{ weight, reps: 5 }] }],
  });
  await store.importAll({ sessions: [
    sess('q1', back(28), bp, 200), sess('q2', back(21), bp, 205),
    sess('q3', back(14), bp, 205), sess('q4', back(7), bp, 210),
    sess('q5', back(0), bp, 2050),
    sess('s1', back(30), sq, 300), sess('s2', back(2), sq, 315),
  ] });
  clearReadCache('probe3');
  const d = await mount(GraphView());
  [...d.querySelectorAll('.seg')].find((b) => b.textContent === 'Muscles').click();
  for (let i = 0; i < 30; i++) await settle();
  const tapMuscle = async (name) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const open = d.querySelector('.muscle-detail');
      if (open && open.textContent.startsWith(name)) return open;
      const r = [...d.querySelectorAll('.body-region')]
        .find((x) => (x.getAttribute('aria-label') || '').startsWith(name + ' '));
      if (r) r.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 10; i++) await settle();
    }
    return d.querySelector('.muscle-detail');
  };
  const chestPanel = text(await tapMuscle('Chest'));

  ok(/Set aside for now: /.test(chestPanel),
     `🚨 the panel NAMES the set it held back — a quarantine nobody is told about reads as the app `
     + `losing a set (${chestPanel.slice(0, 200)})`);
  ok(/Set aside for now: 2050 × 5/.test(chestPanel),
     '⚠️ by its weight and reps, so the reader can tell WHICH set it means — a generic "one set was '
     + 'ignored" would be unanswerable');
  ok(/it is far enough above everything else here that it looks like a typo\./.test(chestPanel),
     'and says why, in the singular for one set');
  ok(/Repeat it and it counts\./.test(chestPanel),
     '🚨 and leaves the judgement with the person who was there — the app cannot tell a mistyped '
     + '2,050 from a jump, so it withholds rather than accuses, and says what would change its mind');

  /* 🚨 THE VACUITY GUARD, AND IT IS THE ORIGINAL BUG. The sentence is worth
     nothing on its own: what has to be true beside it is that the 2,050 did not
     reach the number. A 2,050 × 5 chest converts to something north of 2,000 lb
     and took this muscle to Elite at "high confidence". */
  const est = Number((d.querySelector('.muscle-est').textContent.match(/[\d.]+/) || [0])[0]);
  ok(est > 100 && est < 500,
     `🚨 and the big number is still a bench press rather than the typo — ${est} lbs, not the `
     + `four figures the un-screened 2050 × 5 produced`);
  ok(!/Elite/.test(chestPanel),
     'and the level with it — one slip used to promote a muscle to the top of the scale');

  /* ---- freshness: the data is there; the SENTENCE is not ----
   *
   * 🚨 A DEFECT IN CODE THIS BLOCK MAY NOT TOUCH, REPORTED TO TIM 2026-09-14.
   * `freshnessLine()` in views-muscles.js has NO CALLER. `muscleGroupsPane()`
   * computes `recent` and passes `recent.get(selected)` as a SEVENTH argument
   * to `detail()` — which declares six parameters — so the note that a muscle
   * trained inside 24 h (48 h for legs) reads a little low is computed, handed
   * over, and dropped on the floor. Verified on this fixture: the chest was
   * trained TODAY and the panel above says nothing about it.
   *
   * ⚠️ SO THIS ASSERTS THE HALF THAT IS WIRED, and it is deliberately not an
   * assertion that the sentence is absent — pinning a bug in place is not the
   * same as testing it. `recentDirectWork()` is exported, is what the missing
   * line would read, and carries the whole of the 24 h / 48 h rule. When
   * somebody joins the wire, the panel assertions are what they should add. */
  const { recentDirectWork } = await import(BASE + 'views-muscles.js');
  const recent = recentDirectWork(await store.getSessions(), await store.getExerciseMap(), todayISO());
  ok(recent.get('Chest') === 0,
     `⚠️ the pane knows the chest was trained TODAY (${recent.get('Chest')})`);
  ok(recent.get('Quads') === 2,
     `⚠️ and that the quads were trained two days ago — inside the 48 h a leg day gets, where the `
     + `upper body gets 24 (${recent.get('Quads')})`);
  ok(!recent.has('Triceps'),
     '🚨 and that a bench press did NOT train the triceps for this purpose — the half-set is real '
     + 'volume but it is not the muscle being trained that day, which is volume-map.js\'s word '
     + '"direct" and not a new one');

  await store.clearAll();
}

/* ====== leaving a workout open, and the way back in (2026-09-07) ======
 *
 * Tim: *"I want the user to be able to leave a workout and interact with the
 * rest of the cite and then come back to the workout at any time."*
 *
 * ⚠️ THE DRAFT ALREADY SURVIVED LEAVING. What is new is the ▾ that puts it down
 * without a question, and the bar that says it is still there — so the
 * assertions worth having are about the two things that could quietly not be
 * true: that leaving keeps the workout, and that starting a different one no
 * longer eats it. */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { liveSessionBar } = await import(BASE + 'live-session.js');
  const { loadDraft, saveDraft, clearDraft, liveDraft } = await import(BASE + 'session-draft.js');
  const { todayISO } = await import(BASE + 'store.js');
  const today = todayISO();
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };

  clearDraft();
  const wA = await store.saveWorkout({
    name: 'Push A',
    exercises: [
      { exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' },
      { exerciseId: byName('Barbell Curl').id, sets: 1, notes: '' },
    ],
  });
  const wB = await store.saveWorkout({
    name: 'Pull B',
    exercises: [{ exerciseId: byName('Barbell Row').id, sets: 2, notes: '' }],
  });

  const run = await mount(SessionView(wA.id));
  const corner = run.querySelector('.topbar button');
  ok(corner && /leave this workout open/i.test(corner.getAttribute('aria-label') || ''),
     '🚨 the runner\'s corner control LEAVES THE WORKOUT OPEN — it was an ✕ labelled "Leave '
     + `workout", and an ✕ means closed (${corner && corner.getAttribute('aria-label')})`);

  type(run.querySelectorAll('.step-value')[0], 185);
  await settle();
  type(run.querySelectorAll('.step-value')[1], 5);
  await settle();
  ok(Boolean(loadDraft()), 'a set is typed and the workout is on disk');

  /* ⚠️ COUNTED BEFORE AND AFTER, not asserted absent. Sheets are appended to
     document.body and earlier blocks in this file leave theirs there, so
     `!document.querySelector('.sheet')` fails whatever this button does — a
     test that can only fail is worth no more than one that can only pass. */
  const sheetsBefore = document.querySelectorAll('.sheet').length;
  corner.click();
  await settle();
  ok(document.querySelectorAll('.sheet').length === sheetsBefore,
     '⚠️ and leaving ASKS NOTHING. The sheet it replaced said the draft was safe, which was true '
     + 'and read as a warning — a Cancel button is the app saying this might cost you something');
  ok(Boolean(loadDraft()),
     '🚨 THE HEADLINE: the workout is still open after walking away from it');

  /* ---- the bar that says so ---- */
  const bar = liveSessionBar({ route: 'home', today });
  ok(Boolean(bar), 'a workout in progress puts a bar on every other screen');
  const opener = bar.querySelector('.session-mini-open');
  ok(opener && opener.getAttribute('href') === '#/session/' + wA.id,
     '⚠️ and ALL of it except the bin is the way back, not just the arrow inside it — 56px of pill '
     + 'that does nothing but hold a 34px button is the touch-target complaint (0i) built on purpose');
  ok(bar.querySelector('.mini-del') && !opener.querySelector('.mini-del'),
     '🚨 THE BIN IS A SIBLING OF THE LINK, NEVER INSIDE IT. A <button> inside an <a> is invalid HTML '
     + 'that browsers recover from differently, and the one thing that must never be ambiguous on '
     + 'this bar is whether a tap opens the workout or deletes it');
  ok(/Push A/.test(bar.textContent), 'it names the workout');
  ok(/Bench Press/.test(bar.textContent),
     'and the exercise you are on, so it is a place rather than a notification');
  ok(!liveSessionBar({ route: 'session', today }),
     '⚠️ never on the runner itself — a way back to the screen you are already looking at');

  /* ---- the bin (Tim, 2026-09-07) ----
     *"add a trash can on the right side of the box that delets the workout if
     the user clicks on it."* ⚠️ It asks first when there is something to lose
     and only then, which is the rule every other destructive control in this
     app already follows — and it matters most here, because this is the one
     that sits a few pixels from the Home tab for the length of a workout. */
  {
    const sheetsBefore = document.querySelectorAll('.sheet').length;
    bar.querySelector('.mini-del').click();
    await settle();
    const sheets = document.querySelectorAll('.sheet');
    ok(sheets.length === sheetsBefore + 1,
       '🚨 the bin ASKS before deleting a workout with sets in it');
    ok(/1 recorded set/.test(sheets[sheets.length - 1].textContent),
       '⚠️ and names what it is about to destroy');
    ok(Boolean(loadDraft()), '⚠️ and nothing is gone while the question is on screen');
    [...sheets[sheets.length - 1].querySelectorAll('button')]
      .find((b) => /^Cancel$/.test(b.textContent)).click();
    await settle();
    ok(Boolean(loadDraft()), 'cancelling leaves the workout exactly where it was');
  }

  /* ---- the same-day rule, applied by ONE function ----
     The runner and the bar disagreeing here would put a workout on screen that
     opening it immediately throws away. */
  const real = loadDraft();
  saveDraft({ ...real, startedOn: '2020-01-01' });
  ok(!liveDraft(today) && !liveSessionBar({ route: 'home', today }),
     "🚨 yesterday's draft is not a live workout, and the bar reads the same rule the runner does");
  saveDraft(real);
  ok(Boolean(liveSessionBar({ route: 'home', today })),
     '⚠️ the vacuity guard for that — today\'s draft still shows, so the check above is the DATE '
     + 'and not a bar that never renders');

  /* ---- starting a second workout no longer eats the first ---- */
  const clash = await mount(SessionView(wB.id));
  ok(/Push A is still open/.test(clash.textContent),
     '🚨 STARTING ANOTHER WORKOUT USED TO DELETE THIS ONE SILENTLY. `if (rawDraft && !existingDraft) '
     + 'clearDraft()` was defensible while leaving the runner took a deliberate tap through a sheet; '
     + 'the bar makes it a stroll — Record, tap the next workout, twelve sets gone');
  ok(/1 set recorded/.test(clash.textContent),
     '⚠️ and it says how much is at stake, because "you have one open" is not a decision anybody '
     + 'can make');
  /* ⚠️ THE DRAFT IS STILL PUSH A's, not merely "a draft exists". The weaker
     version of this passed under the mutation that restores the silent wipe —
     the wipe writes a fresh draft for the workout you just opened, so something
     is always on disk. What is being asserted is that the SESSION survived. */
  ok((loadDraft() || {}).workoutId === wA.id,
     '⚠️ and Push A is untouched while the question is being asked');
  ok(!clash.querySelector('.set-list'),
     'the second workout has not started either — one open at a time, and the screen says which');

  const discard = [...clash.querySelectorAll('button')].find((b) => /^Discard it and start/.test(b.textContent));
  ok(Boolean(discard) && !discard.closest('.pane-bottom'),
     '⚠️ THE DESTRUCTIVE ONE IS NOT IN THE FOOTER. `.pane-bottom` is where the thumb already is on '
     + 'every other screen, and a Discard in that muscle memory is how somebody deletes the workout '
     + 'they meant to go back to');
  const before = document.querySelectorAll('.sheet').length;
  discard.click();
  await settle();
  const sheets = document.querySelectorAll('.sheet');
  ok(sheets.length === before + 1, 'and it still asks before deleting anything');
  [...sheets[sheets.length - 1].querySelectorAll('button')].find((b) => /^Discard$/.test(b.textContent)).click();
  await settle();
  ok(!loadDraft(), 'confirming discards it');

  /* ⚠️ THE VACUITY GUARD, and it is the half that keeps the guard from becoming
     a nag: a workout started and never typed into has nothing to lose, so
     starting a different one just works. */
  await mount(SessionView(wA.id));
  await settle();
  const clean = await mount(SessionView(wB.id));
  ok(!/is still open/.test(clean.textContent) && Boolean(clean.querySelector('.set-list')),
     '⚠️ an untouched draft is replaced without a question — a question about nothing is how '
     + 'people learn to tap through questions');

  /* ---- the second line follows the WALK, not the entry list ----
     A superset is one step per member per round, so `state.index` and an index
     into `entries` are different numbers. The runner's own swap path carries
     this warning; a second reading of it on the bar that got it wrong would
     name the wrong lift exactly when a workout is at its most complicated. */
  clearDraft();
  const wS = await store.saveWorkout({
    name: 'Superset day',
    exercises: [
      { exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '', group: 'g1' },
      { exerciseId: byName('Barbell Curl').id, sets: 2, notes: '', group: 'g1' },
    ],
  });
  await mount(SessionView(wS.id));
  const sd = loadDraft();
  ok(sd && sd.entries.length === 2, 'a superset draft is two entries');
  saveDraft({ ...sd, index: 1 });
  ok(/Curl/.test(liveSessionBar({ route: 'home', today }).textContent),
     'step 2 of the round is the second exercise');
  saveDraft({ ...sd, index: 2 });
  ok(/Bench Press/.test(liveSessionBar({ route: 'home', today }).textContent),
     '🚨 AND STEP 3 IS THE FIRST EXERCISE AGAIN — round two, member one. `entries[2]` does not '
     + 'exist, so a bar reading the entry list would have printed nothing here and looked fine on '
     + 'every workout without a superset in it');

  clearDraft();
  await store.clearAll();
}

/* ====== the save screen (2026-09-07) ======
 *
 * Tim: *"Instead of putting the description and location at the top of the cite
 * During a workout, put all that information as an option after the workout is
 * finished, and then the user can post the workout."*
 *
 * 🚨 THE LOAD-BEARING ONE IS THAT FINISH NO LONGER SAVES. Everything else here
 * is a field moving; that is a change to when the app writes to disk, and the
 * draft has to survive every path off this screen. */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { loadDraft, clearDraft } = await import(BASE + 'session-draft.js');
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  const app = () => document.getElementById('app');
  const findBtn = (re) => [...app().querySelectorAll('button')].find((b) => re.test(b.textContent));
  // Finish only exists on the last step of the walk.
  const walkToEnd = async () => {
    for (let i = 0; i < 8 && !findBtn(/Finish workout/); i++) {
      const next = findBtn(/Next exercise|Straight into|Round/);
      if (!next) break;
      next.click();
      await settle();
    }
  };

  clearDraft();
  await store.clearAll();
  const w = await store.saveWorkout({
    name: 'Save day',
    exercises: [
      { exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' },
      { exerciseId: byName('Barbell Curl').id, sets: 1, notes: '' },
    ],
  });

  const runner = await mount(SessionView(w.id));
  type(runner.querySelectorAll('.step-value')[0], 155);
  await settle();
  type(runner.querySelectorAll('.step-value')[1], 6);
  await settle();

  const before = (await store.getSessions()).length;
  await walkToEnd();
  findBtn(/Finish workout/).click();
  await settle();

  ok(Boolean(app().querySelector('.save-screen')), 'Finish opens the save screen');
  ok((await store.getSessions()).length === before,
     '🚨 AND IT SAVES NOTHING. Finish used to BE the save; the write happens from the button on '
     + 'this screen, so the description and the gym describe a session that is still a draft');
  ok(Boolean(loadDraft()), '⚠️ and the draft is untouched — still the only copy, exactly as before');

  const stats = [...app().querySelectorAll('.save-stat-value')].map((n) => n.textContent);
  ok(stats.length === 3, `three stats across the top (${stats.join(' / ')})`);
  ok(stats[1] === '1' && stats[2] === '1',
     `⚠️ SETS and EXERCISES, counting only what was RECORDED — one set typed of the three planned, `
     + `on one of the two exercises (${stats.join(' / ')})`);
  ok(!/lbs/.test(app().querySelector('.save-stats').textContent),
     '⚠️ and no volume figure in pounds, where Hevy has one — a session of pull-ups has no external '
     + 'load to total, and Tim asked for a set count instead');

  /* ---- back goes into the workout, which never stopped ---- */
  app().querySelector('[aria-label="Back"]').click();
  await settle();
  ok(Boolean(app().querySelector('.set-list')), 'back goes into the runner');
  ok((await store.getSessions()).length === before && Boolean(loadDraft()),
     '⚠️ and nothing was written on the way through — the workout is simply still open');

  /* ---- the fields, and what they write ---- */
  await walkToEnd();
  findBtn(/Finish workout/).click();
  await settle();
  const noteBox = app().querySelector('[aria-label="Description of this workout"]');
  const gymBox = app().querySelector('[aria-label="Where this workout happened"]');
  ok(Boolean(noteBox) && Boolean(gymBox),
     'the description and the gym are asked here, once, at the end');
  noteBox.value = 'Felt strong.';
  noteBox.dispatchEvent(new window.Event('input', { bubbles: true }));
  gymBox.value = 'The garage';
  gymBox.dispatchEvent(new window.Event('input', { bubbles: true }));
  await settle();
  ok(loadDraft().note === 'Felt strong.' && loadDraft().location === 'The garage',
     '⚠️ typed straight onto the draft, so closing the app on this screen loses neither');

  await saveNow();
  const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
  ok(Boolean(saved), 'Save writes the session');
  ok(saved && saved.note === 'Felt strong.' && saved.location === 'The garage',
     '🚨 with the description and the gym on the row');
  ok(!loadDraft(), 'and the draft is cleared only once the save has landed');
  ok(/Nice work|Workout complete/i.test(app().textContent),
     'and it lands on the finish screen, which is unchanged');

  /* ---- discard ---- */
  clearDraft();
  const again = await mount(SessionView(w.id));
  type(again.querySelectorAll('.step-value')[0], 165);
  await settle();
  const countBefore = (await store.getSessions()).length;
  await walkToEnd();
  findBtn(/Finish workout/).click();
  await settle();
  const discard = findBtn(/^Discard workout$/);
  ok(Boolean(discard), 'the save screen offers a discard');
  ok(!discard.closest('.pane-bottom'),
     '⚠️ and NOT in the footer beside Save — that is where the thumb already is on every other '
     + 'screen in the app');
  const sheetsBefore = document.querySelectorAll('.sheet').length;
  discard.click();
  await settle();
  const sheets = document.querySelectorAll('.sheet');
  ok(sheets.length === sheetsBefore + 1, 'and it asks first');
  /* ⚠️ A COUNT, not a specific number. What counts as "recorded" is the save
     path's own rule, prefill and all — which is Open work 15 and Tim's call —
     so pinning an exact figure here would be pinning that open question by
     accident. What this screen owes the user is the number it is about to
     delete, whatever the rule says it is. */
  ok(/\d+ recorded sets? will be deleted/.test(sheets[sheets.length - 1].textContent),
     '⚠️ naming the count rather than asking abstractly');
  [...sheets[sheets.length - 1].querySelectorAll('button')].find((b) => /^Discard$/.test(b.textContent)).click();
  await settle();
  ok(!loadDraft() && (await store.getSessions()).length === countBefore,
     'confirming throws the workout away and writes nothing');

  /* ---- and the bin goes quietly when there is nothing to lose ----
     ⚠️ THE VACUITY GUARD FOR THE CONFIRM ABOVE, and the half that keeps it from
     being a nag: a workout started and never typed into has nothing to warn
     about, so the bin simply empties it. Without this, a bin that always asked
     would pass every assertion above and be worse to use. */
  {
    const { liveSessionBar: makeBar } = await import(BASE + 'live-session.js');
    const { todayISO: today2 } = await import(BASE + 'store.js');
    clearDraft();
    const fresh = await store.saveWorkout({
      name: 'Untouched day',
      exercises: [{ exerciseId: byName('Barbell Row').id, sets: 2, notes: '' }],
    });
    await mount(SessionView(fresh.id));
    ok(Boolean(loadDraft()), 'a workout is open');
    const quietBar = makeBar({ route: 'home', today: today2() });
    const sheetsBefore = document.querySelectorAll('.sheet').length;
    quietBar.querySelector('.mini-del').click();
    await settle();
    ok(document.querySelectorAll('.sheet').length === sheetsBefore,
       '⚠️ nothing recorded, nothing asked — a question about nothing is how people learn to tap '
       + 'through questions');
    ok(!loadDraft(), 'and it is gone');
  }

  clearDraft();
  await store.clearAll();
}

/* ====== the "?" and its mini box (2026-09-07) ======
 *
 * Tim: *"have a little question mark somewhere near the thing that it's
 * explaining … when you touch it it opens a mini box that shares what it's
 * trying to say."*
 *
 * 🚨 THE RISK THIS CONTROL CARRIES IS THAT A CAVEAT BECOMES UNREACHABLE. Every
 * screen that adopts it has an assertion that opens the ? and reads the words
 * back; these pin the control itself. */
{
  const { helpDot, el: mk } = await import(BASE + 'ui.js');
  const host = document.getElementById('app');

  const dot = helpDot('Because the numbers move.', { label: 'Why not', title: 'Why not' });
  host.replaceChildren(mk('div', {}, dot));
  await settle();

  ok(dot.tagName === 'BUTTON' && dot.getAttribute('aria-label') === 'Why not',
     '⚠️ the ? is a real button with an accessible name — "?" alone reads as nothing to a screen '
     + 'reader, which is the whole population this pattern could otherwise fail');
  ok(dot.getAttribute('aria-expanded') === 'false', 'and it says it is closed');
  ok(!document.querySelector('.help-pop'), 'with nothing open yet');

  dot.click();
  await settle();
  const pop = document.querySelector('.help-pop');
  ok(Boolean(pop), 'tapping it opens the mini box');
  ok(/Because the numbers move/.test(pop.textContent), 'with the explanation in it');
  ok(dot.getAttribute('aria-expanded') === 'true', 'and the button says so');

  // Escape closes it — the keyboard path, which nothing else in this pattern has.
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  ok(!document.querySelector('.help-pop'), 'Escape closes it');

  // ⚠️ ONE AT A TIME. Two open boxes is two overlapping explanations and no way
  // to tell which ? either belongs to.
  const dotB = helpDot('The second one.', { label: 'B' });
  host.replaceChildren(mk('div', {}, dot, dotB));
  await settle();
  dot.click();
  await settle();
  dotB.click();
  await settle();
  ok(document.querySelectorAll('.help-pop').length === 1,
     '⚠️ opening a second ? closes the first — two boxes at once is two explanations with no way '
     + 'to tell which one belongs to which control');
  ok(/The second one/.test(document.querySelector('.help-pop').textContent),
     'and the one left open is the one just tapped');

  // Tapping the same ? again closes it, rather than reopening it in place.
  dotB.click();
  await settle();
  ok(!document.querySelector('.help-pop'), 'tapping the same ? again closes it');

  // ⚠️ Tapping ANYWHERE else closes it. Captured on the document, so a row with
  // its own click handler underneath cannot swallow the dismissal.
  dot.click();
  await settle();
  document.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
  await settle();
  ok(!document.querySelector('.help-pop'), 'and a tap anywhere else closes it');

  host.replaceChildren();
}

/* ====== THE PROFILE TAB (2026-09-08) ======
 *
 * Tim restructured the navigation: the You / Friends switch left Home, the
 * calendar went back into Data, and the slot it vacated is a Profile section —
 * *"the user's profile picture and their username, as well as the number of
 * workouts, followers, and following at the top."*
 *
 * 🚨 THE ASSERTION THAT MATTERS IS NOT THAT THE NUMBERS RENDER. It is that the
 * two social ones are NOT PRINTED AS ZERO when the app has no way to know them.
 * Off the cloud there is no graph to count, and "0 followers" is a claim where
 * the truth is an absence — the same fault the muscle map's grey-for-Core had,
 * arriving through a different door.
 */
{
  const { MeRouteView } = await import(BASE + 'views-me.js');
  const { social } = await import(BASE + 'store.js');
  const realState = social.state;
  const text = (n) => n.textContent.replace(/\s+/g, ' ');

  await store.clearAll();
  await store.saveSettings({ displayName: 'Tim', avatar: '' });

  /* ---- signed in, with connections ---- */
  social.state = async () => ({
    available: true, reason: null, uid: 'me-1', name: 'Tim',
    visibility: 'private',
    connections: [{ uid: 'u-autumn', name: 'Autumn' }, { uid: 'u-alex', name: 'Alex' }],
  });

  // Two sessions so the workout count is not the same number as the friends.
  const sysId = (await store.saveSystem({ name: 'PPL' })).id;
  const wk = await store.saveWorkout({ name: 'Push', systemId: sysId, exercises: [] });
  for (const d of ['2026-08-01', '2026-08-03', '2026-08-05']) {
    await store.saveSession({ workoutId: wk.id, workoutName: 'Push', date: d, entries: [] });
  }

  const me = await mount(MeRouteView(''));
  await settle();
  ok(/Tim/.test(text(me)), 'the Profile tab shows your display name');
  ok(Boolean(me.querySelector('.me-face')), 'and a slot for your photo');

  /* 🔄 ~~THREE FIGURES~~ TWO SINCE 2026-09-09 — Tim: *"just combine the 2 and
   * call them 'friends' instead."* The two social counts were always the same
   * number, because a connection here is mutual; one figure with the word the
   * rest of the app uses needs no "?" to explain itself.
   *
   * ⚠️ THE ABSENCE OF THE DOT IS ASSERTED BELOW, and it is the half that says
   * this was a simplification rather than a rename with the old explanation
   * left lying underneath it. */
  const tiles = [...me.querySelectorAll('.me-stat')];
  ok(tiles.length === 2, `two figures across the top (${tiles.length})`);
  const tileText = tiles.map((t) => t.textContent.replace(/\s+/g, ' ').trim());
  ok(/^3\s*Workouts$/i.test(tileText[0]), `Workouts counts the sessions (${tileText[0]})`);
  ok(/^2\s*Friends$/i.test(tileText[1]),
     `🚨 and one FRIENDS figure counts the connections (${tileText[1]})`);
  ok(!/Followers|Following/i.test(text(me)),
     '🚨 and neither word is anywhere on the screen — they describe a one-way graph this app does '
     + 'not have, which is the whole reason they went');

  const hrefs = tiles.map((t) => t.getAttribute('href'));
  ok(hrefs[0] === '#/me/workouts' && hrefs[1] === '#/me/friends',
     `each figure opens its own list (${hrefs.join(' ')})`);

  /* 🔒 AND NO "?" SURVIVED ON A PRIVATE ACCOUNT. The old one existed to explain
     why two numbers were equal; with one number there is nothing to explain, and
     leaving the dot would be the app talking about itself for the sake of it —
     the exact thing Tim asked to stop. The public-account caveat is a different
     sentence and is checked further down, ON the screen rather than behind a
     dot, because it changes what the number IS (Rule 9). */
  ok(!me.querySelector('.help-dot'),
     '🔒 and a private account gets no ? at all — the count is a complete answer and there is '
     + 'nothing left to say about it');
  ok(!/mutual/i.test(text(me)),
     '⚠️ nor a line explaining that connecting is mutual, which was only ever there to account for '
     + 'the second number');

  /* ---- one people list, under three names ---- */
  for (const which of ['friends', 'followers', 'following']) {
    const list = await mount(MeRouteView(which));
    await settle();
    const rows = [...list.querySelectorAll('a.row')];
    ok(rows.length === 2, `${which} lists both connections (${rows.length})`);
    ok(rows.every((r) => /^#\/friend\//.test(r.getAttribute('href'))),
       `and every row opens that person's page (${which})`);
    ok(/Autumn/.test(text(list)) && /Alex/.test(text(list)), `by name (${which})`);
    /* ⚠️ THE OLD ROUTES RESOLVE AND THEY SAY "FRIENDS" WHEN THEY DO. A live URL
       may not 404 because a word changed (`#/calendar` kept its route through
       three moves) — and a screen still titled "Followers" would be the rename
       half-done, which is worse than either state. */
    ok(/Friends/.test(text(list)) && !/Followers|Following/.test(text(list)),
       `🚨 and it is titled Friends however you got to it (${which})`);
  }

  /* ---- the workouts list ---- */
  {
    const list = await mount(MeRouteView('workouts'));
    await settle();
    const rows = [...list.querySelectorAll('a.row')];
    ok(rows.length === 3, `the workouts list shows all three (${rows.length})`);
    ok(rows[0].getAttribute('href') === '#/day/2026-08-05',
       `⚠️ newest first, and it opens the DAY rather than an edit form (${rows[0].getAttribute('href')})`);
  }

  /* ---- 🚨 THE ONE THAT MATTERS: no cloud, no invented zeros ---- */
  for (const reason of ['local', 'anonymous', 'offline', 'demo']) {
    social.state = async () => ({ available: false, reason });
    const off = await mount(MeRouteView(''));
    await settle();
    const offTiles = [...off.querySelectorAll('.me-stat')];
    const social2 = offTiles.slice(1);
    ok(social2.length === 1 && social2.every((t) => /—/.test(t.textContent)),
       `🚨 with no cloud (${reason}) the Friends figure is a DASH, never 0 — the app cannot `
       + 'count it, and a zero would be a claim where the truth is an absence');
    ok(social2.every((t) => t.tagName !== 'A' && !t.getAttribute('href')),
       `…and it is not a link, because there is no list behind it (${reason})`);
    ok(/^3\s*Workouts$/i.test(offTiles[0].textContent.replace(/\s+/g, ' ').trim()),
       `while Workouts still counts, because that one is on this device (${reason})`);
  }

  /* Vacuity guard for the block above: with the cloud back, they are numbers
     again. Without this, a MeView broken into always rendering a dash would
     pass every assertion in that loop. */
  social.state = async () => ({
    available: true, reason: null, uid: 'me-1', name: 'Tim', visibility: 'public',
    connections: [{ uid: 'u-autumn', name: 'Autumn' }],
  });
  const back = await mount(MeRouteView(''));
  await settle();
  ok(!/—/.test([...back.querySelectorAll('.me-stat')].map((t) => t.textContent).join(' ')),
     'and with the cloud back they are numbers again — the vacuity guard');

  /* 🚨 A PUBLIC ACCOUNT SAYS THE COUNT IS A FLOOR, AND IT SAYS IT ON THE SCREEN.
     D29 makes public the default, and a public account is readable by anybody
     signed in who finds it — none of whom are in the graph. Printing a number
     that undercounts its own audience by an unbounded amount without saying so
     is exactly what this app does not do.

     ⚠️ IT DID NOT FOLLOW THE OTHER HALF BEHIND A "?" ON 2026-09-09. Rule 9's
     test is whether a sentence changes what the reader thinks the number IS,
     and this one does: with it, "2 Friends" is a connection count; without it,
     somebody reads it as who can see them. */
  ok(/public/i.test(text(back)) && /without being friends/i.test(text(back)),
     '🚨 on a public account the screen says people can see your training without being friends, so '
     + 'the number is who you are connected to rather than who is reading you');
  ok(!back.querySelector('.help-dot'),
     '⚠️ and it is said outright rather than behind a dot — one sentence, on the screen, only where '
     + 'it is true');

  social.state = realState;
  await store.clearAll();
}

/* ====== WHAT PROFILE IS FOR — THE DATA/PROFILE SPLIT (2026-09-10/-11) ======
 *
 * Tim: *"The main profile section is looking really empty right now and the
 * settings profile section is really crowded … I think showing the calendar as a
 * main section was nice, but I think we can also display it in the data section
 * in a good way."* Then, given the five-step plan: **"I like all of that. Start
 * working on it now."**
 *
 * 🚨 THE LINE THIS BLOCK EXISTS TO PIN IS HIS: **Data answers what your training
 * MEANS, Profile answers what you DID.** Steps 1 and 3 (calendar, best lifts)
 * shipped on 2026-09-10 with data-layer coverage and no render coverage at all —
 * `bestLifts()` was tested and the SECTION was not — so they are asserted here
 * alongside steps 2 and 4, which is where they should have been.
 *
 * 🚨 AND THE ONE THAT GUARDS THE WHOLE SCREEN IS THE LAST: `#/me` NEVER WRITES.
 * `direction.md` §4a splits the two profile screens by that exact property —
 * *"adjustments behind the top-left icon, a view of the account in the tab
 * bar"* — and every section added here is a readout with a door beside it. A
 * field appearing on this screen would be the split half-undone, and it would
 * look like a feature while it happened.
 */
{
  const { MeRouteView } = await import(BASE + 'views-me.js');
  const { social } = await import(BASE + 'store.js');
  const realState = social.state;
  const text = (n) => n.textContent.replace(/\s+/g, ' ');
  const rowFor = (node, href) =>
    [...node.querySelectorAll('a.row')].find((a) => a.getAttribute('href') === href);
  /* ⚠️ NULL-SAFE ON PURPOSE, and it is not defensive noise. The first mutation
     check run against this block deleted both sections and the suite THREW on
     the second assertion — so one deliberate mutation reported one failure and
     hid the other eleven. A mutation check is only evidence if the suite
     survives the mutation far enough to say what else it broke. */
  const rowText = (node, href) => {
    const r = rowFor(node, href);
    return r ? text(r) : '';
  };

  // Off the cloud throughout: the counts are a dash and none of this depends on
  // them. What is under test is what the screen HOLDS, not who is signed in.
  social.state = async () => ({ available: false, reason: 'local' });

  await store.clearAll();

  /* ---- step 2: an empty profile is NAMED, never blank ---- */
  {
    const blank = await mount(MeRouteView(''));
    await settle();
    ok(Boolean(rowFor(blank, '#/profile')),
       'Profile carries a body row even with nothing filled in');
    /* 🚨 `direction.md` §3.1 — *"something is always better than nothing"*, with
       the half Tim kept: *"have a way to be upfront about it."* An empty profile
       is the first-run case, and the honest version of it is the sentence that
       says what filling it in buys — the SAME sentence the Account screen uses,
       because one gap described two ways becomes two claims. */
    ok(/Add your gender and body weight to rank your muscle groups/
      .test(rowText(blank, '#/profile')),
       '🚨 and it names what is missing and what that costs, rather than printing a blank');
  }

  /* ---- step 2: half a profile prints the half it has ---- */
  {
    await store.saveProfile({ gender: 'male' });
    const half = await mount(MeRouteView(''));
    await settle();
    const t = rowText(half, '#/profile');
    ok(/Male/.test(t),
       '⚠️ a half-filled profile prints the half it HAS — the gender is on the screen…');
    ok(/Add your body weight/.test(t) && !/Add your gender/.test(t),
       '…and names only what is still missing (the body weight), not the field it already has');
  }

  /* ---- step 2: a complete profile, and the weigh-in is DATED ---- */
  {
    await store.saveProfile({ gender: 'male', birthYear: 1994 });
    await store.logBodyWeight(180);
    const full = await mount(MeRouteView(''));
    await settle();
    const row = rowFor(full, '#/profile');
    const t = rowText(full, '#/profile');
    ok(/Male/.test(t) && /years/.test(t) && /180/.test(t),
       `🚨 a filled profile shows sex, age and current weight on the Profile tab (${t.trim()})`);
    ok(!/Add your/.test(t), 'and says nothing about missing fields once there are none');
    /* ⚠️ THE DATE IS THE HONESTY, and it is the same one `BODY_WEIGHT_FRACTION`
       makes when it reads a weight from the date of the SET: the number above is
       that day's, not today's. §9 records a stale weigh-in as a known gap, and
       saying when it was is the version of that a readout can do. */
    ok(/Last weighed/i.test(t),
       '⚠️ with the day it was weighed, because the number is that day’s rather than today’s');
    /* 🚨 IT IS A DOOR, NOT A FORM (`direction.md` §4a). */
    ok(Boolean(row) && row.getAttribute('href') === '#/profile',
       '🚨 and the row opens the form at #/profile rather than editing anything here');
  }

  /* ---- step 4: Goals moved to Profile ---- */
  {
    const noGoal = await mount(MeRouteView(''));
    await settle();
    ok(Boolean(rowFor(noGoal, '#/goals')),
       '🔄 Goals is on the Profile tab since 2026-09-11 (step 4)');
    ok(/Set a goal/.test(rowText(noGoal, '#/goals')),
       'and with no goal running it invites one rather than showing an empty section');

    await store.setGoal({
      muscle: 'Chest', liftName: 'Barbell Bench Press',
      targetLevel: 4, targetLevelName: 'Advanced', targetPercentile: 80,
      targetWeight: 225, startWeight: 185, startPercentile: 60,
      startDate: '2026-09-01', endDate: '2026-11-24', ambition: 'steady', status: 'active',
    });
    const withGoal = await mount(MeRouteView(''));
    await settle();
    const gt = rowText(withGoal, '#/goals');
    ok(/Advanced/.test(gt) && /Barbell Bench Press/.test(gt),
       `🔄 and a running goal reads as the level it aims at, on the lift it is about (${gt.trim()})`);
    ok(/By /.test(gt), 'with the date it runs to');

    /* 🛑 NO VERDICT, AND THIS IS THE ASSERTION THAT MATTERS IN THE WHOLE STEP.
       `js/goals.js` refuses to say whether somebody is on track — a day-to-day
       estimate swings several percent and a bad Tuesday is not a failure (Rule
       6) — and `tests/goals.test.mjs` pins that refusal in the module. A
       summary row on the most-visited screen in the app is exactly where that
       refusal would get quietly undone by a cheerful word. */
    ok(!/on track|behind|ahead|falling|catch up/i.test(text(withGoal)),
       '🛑 and it passes no verdict — the module refuses one, and a summary row is where that '
       + 'refusal would be undone without anybody noticing');
  }

  /* ---- steps 1 and 3: the sections that shipped without render coverage ---- */
  {
    /* ⚠️ THE FIXTURE IS BUILT SO THE TWO ORDERINGS DISAGREE AND SO THE TWO
       "BESTS" DISAGREE — a fixture where they agree would pass against a screen
       that got either rule backwards.

       · The bench is trained on TWO days and its heaviest set is 185 × 5.
       · The row is trained on ONE day and is HEAVIER at 225 × 5, so sorting by
         pounds would lead with it and sorting by days trained must not (Rule 6).
       · The bench's second day is 165 × 10, whose estimated 1RM (227) beats the
         one from its own heaviest set (219) — so `sameSet` is false and the
         estimate line has something to say. */
    const bench = byName('Barbell Bench Press');
    const barbellRow = byName('Barbell Row');
    const dbCurl = byName('Dumbbell Curl');
    const days = [
      ['2026-08-11', bench, { weight: 185, reps: 5 }],
      ['2026-08-12', bench, { weight: 165, reps: 10 }],
      ['2026-08-13', barbellRow, { weight: 225, reps: 5 }],
      // 🔄 A NON-CORE lift, 2026-09-12, so "Other lifts" has something to hold.
      ['2026-08-14', dbCurl, { weight: 40, reps: 10 }],
    ];
    for (const [date, ex, set] of days) {
      await store.saveSession({
        workoutName: 'Push', date, startedAt: `${date}T10:00:00.000Z`,
        entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: [set] }],
      });
    }

    const me = await mount(MeRouteView(''));
    await settle();
    ok(Boolean(me.querySelector('.me-bests')), 'Your best lifts renders on the Profile tab (step 3)');

    /* 🔄 RANKED SINCE 2026-09-12 — Tim: *"display the core lifts, and then have
       'other lifts' in an expandable section below it … just show the weight of
       an estimated 1RM for each of these, and show the confidence below it …
       colorize the number based on where that measurement puts that user among
       people like them … Order the core lifts from highest ranking exercise
       (beginner-elite) to lowest."* ~~The old section led by DAYS TRAINED and
       printed the measured set first~~ — both assertions are inverted below on
       purpose, and the measured set survives in the sub-line (Rule 5's anchor).

       ⚠️ THE FIXTURE DISCRIMINATES THE ORDERING: the bench has MORE days (2)
       and the row is a higher LEVEL (225 × 5 on a 205 median beats 185 × 5 /
       165 × 10 on a 225 median by a whole band), so days-first and level-first
       put a different lift on top. */
    const coreRows = [...me.querySelectorAll('.me-bests > .list > .me-best')];
    ok(coreRows.length === 8, `the core EIGHT are always listed, trained or not (${coreRows.length})`);
    const coreNames = coreRows.map((r) => (r.querySelector('.row-title') || {}).textContent || '');
    const iRow = coreNames.findIndex((n) => /^Barbell Row$/.test(n));
    const iBench = coreNames.findIndex((n) => /^Barbell Bench Press$/.test(n));
    ok(iRow >= 0 && iBench >= 0 && iRow < iBench,
       `🔄 ordered by LEVEL, highest first — the row (one day, higher band) is above the bench (two `
       + `days, lower band), which a days-first list gets backwards (${coreNames.join(' | ')})`);
    ok(coreRows.filter((r) => r.querySelector('.me-best-none')).every((r) =>
         coreRows.indexOf(r) > Math.max(iRow, iBench)),
       'and the core lifts with no number sit after every ranked one, each saying why');

    const benchRow = coreRows[iBench];
    const benchTop = benchRow.querySelector('.me-best-top');
    ok(Boolean(benchTop) && /lbs/.test(benchTop.textContent) && /227/.test(benchTop.textContent),
       `🚨 the number on a recorded lift is its ESTIMATED 1RM (${benchTop && benchTop.textContent}), `
       + 'off its own best set (165 × 10 → 227) rather than the heaviest set');
    const lvClasses = [...benchTop.classList].filter((c) => /^lv-text-/.test(c));
    ok(lvClasses.length === 1,
       `🚨 coloured by LEVEL through the ramp's own chip class, exactly one (${lvClasses.join(',')})`);
    ok(/confidence/.test(text(benchRow)) && /Intermediate|Novice|Proficient|Beginner|Advanced|Expert|Elite/.test(text(benchRow)),
       '🚨 with the confidence band AND the level NAME in words under it — colour is never the only carrier');
    /* 🔄 THE ANCHOR IS THE SET THAT PRODUCED THE NUMBER, CHANGED 2026-09-13.
     * This used to require "185 lbs × 5" — the HEAVIEST set — while the 227 lb
     * figure above it came off the 165 × 10. Two numbers on one row, describing
     * two different sets, with nothing saying so: Rule 5's anchor pointing at
     * something that was not the anchor. `sameSet: false` existed to flag it
     * and nothing read the flag.
     *
     * The heaviest set is still available to the row as `heaviest`; what the
     * sub-line prints is the one the estimate rests on. */
    ok(/165 lbs × 10/.test(text(benchRow)),
       '🚨 and the measured set it rests on is printed in the sub-line — the set that PRODUCED the '
       + 'number, not the heaviest one, so Rule 5\'s anchor really anchors it');
    ok(/Estimated one-rep maxes/.test(text(me)) && /who lift/.test(text(me)),
       'the section says once that every figure is an estimate, and names the comparison group');
    ok(!/\b(weak|strong)\b/i.test(text(me.querySelector('.me-bests'))),
       '🛑 and passes no verdict — band names and level names only (Rule 6)');

    /* Other lifts: a real disclosure, closed, with the count on it. */
    const other = me.querySelector('details.me-other');
    ok(Boolean(other) && other.querySelector('summary'),
       'the non-core lifts sit behind a real <details>/<summary> — keyboard and screen-reader native');
    ok(Boolean(other) && !other.open, 'closed on arrival');
    ok(Boolean(other) && /Dumbbell Curl/.test(text(other)) && /\/side/.test(text(other)),
       'holding the dumbbell curl, marked per side because its number is one hand\'s');
    ok(Boolean(other) && /^1$/.test((other.querySelector('.me-other-n') || {}).textContent || ''),
       'with the count on the summary');

    ok(Boolean(me.querySelector('.me-cal')), 'and the calendar is here too (step 1)');
    ok(/Training history/.test(text(me)), 'under a heading that says what it is');
    ok([...me.querySelectorAll('.seg')].some((s) => /Years/.test(s.textContent)),
       '⚠️ with the same Months / Years switch the Calendar screen has — it is `ownCalendar()`, '
       + 'one function behind four doors, so the two can never drift');

    /* 🔄 OPENS ON YEARS, AND THE PANE STAYS PUT — 2026-09-12. Tim's report was
       about THIS door: *"it automatically shows almost a full year before the
       user's first recording, so they have to scroll down in order to see
       anything."* The calendar sits under the avatar, the stats, the body, the
       lifts and the goal, and cannot be landed on arrival without scrolling all
       of that off the top — so with Months as the default the first thing under
       "Training history" was the earliest month drawn.
       ⚠️ `calMode` is shared with the Calendar screen, so this reads memory
       rather than the declaration — the initial value is pinned where the
       switch is first touched (the Calendar block). What is pinned HERE is that
       Profile shows that memory, and that arriving lands nothing. */
    const meSeg = (label) => [...me.querySelectorAll('.cal-modes .seg')]
      .find((s) => s.textContent === label);
    ok(meSeg('Years').getAttribute('aria-selected') === 'true'
       && Boolean(me.querySelector('.yr-grid')) && !me.querySelector('.cal-month'),
       '🚨 the Profile tab opens its calendar on YEARS — the whole history under the avatar, and no '
       + 'year of empty months to scroll through');
    ok(!me.querySelector('[data-landed]'),
       '⚠️ and nothing was landed on arrival — the pane holds the avatar and the stats above this, '
       + 'and the screen somebody just opened does not move under them');

    /* 🚨 THE TAP LANDS, HERE TOO. Tim: *"when the month display is selected, the
       current month should be the one that is being viewed to start, and then
       the viewer can scroll up for earlier months."* `land: false` used to mean
       "never move this pane"; since 2026-09-12 it means "not on arrival". The
       structure is pinned — which section the pane was aimed at, and that it is
       the last one — and the rest is the browser's: that this month's heading
       comes to rest at the top of the pane with the switch one flick above it.
       Mutation-checked 2026-09-12: restoring `if (land)` fails the first line
       below and nothing else in the file — the second is structure, and holds
       whether or not anything scrolled. */
    meSeg('Months').click();
    await settle();
    {
      /* 🔄 AND THIS FIXTURE IS THE CASE THE 2026-09-16 TRIM CREATED, which is
         why the two assertions below changed shape rather than being deleted.
         Its four sessions are dated 2026-08-11 to 08-14 and the months now stop
         at the last recording, so the CURRENT month is not drawn at all — there
         is nothing in it, and a month after the last recording is not a gap in a
         history, it is the future. The landing therefore has no
         `[data-current-month]` to aim at.

         🛑 WHAT MAY NOT HAPPEN IS THE LANDING QUIETLY STOPPING. That is Tim's
         2026-09-12 fix, and a missing target that simply returned would leave
         the Profile pane wherever the reader had scrolled it — the switch is
         mid-page here, so a tap on Months would paint the months and move
         nothing. It lands on the most recent month DRAWN instead, which by
         construction of the range is a month with training in it. */
      const months = [...me.querySelectorAll('.cal-month')];
      const landed = me.querySelector('.cal-month[data-landed]');
      ok(!me.querySelector('.cal-month[data-current-month]'),
         '🔄 nothing was recorded this month, so the current month is not drawn — the months stop '
         + 'at the last recording (Tim: "don\'t show any months that were before or after the first '
         + 'and last recording")');
      ok(landed && landed === months[months.length - 1],
         '🚨 so tapping Months aims the Profile pane at the most recent month DRAWN — the landing '
         + 'may not silently stop working because the month it used to aim at is no longer there');
      ok(landed && /August/.test(landed.querySelector('.cal-title').textContent)
         && !landed.classList.contains('is-empty'),
         '⚠️ and that month is August, the month of their last session — the last month drawn always '
         + 'HAS something in it, so the pane never comes to rest on a "No recordings" row');
      ok(landed && !landed.nextElementSibling,
         '⚠️ which is the last block, so the earlier months are above it: scroll UP');
    }
    // Back to the default before leaving: `calMode` is module memory and the
    // blocks after this one read it.
    meSeg('Years').click();
    await settle();

    /* 🚨 THE PROPERTY THE WHOLE SPLIT RESTS ON: THIS SCREEN NEVER WRITES.
       Four sections now hang off it, every one of them a readout with a link;
       a text field or a chip here would mean the same control on two screens
       and one of them going stale. Buttons are exempt because the calendar's
       own Months/Years switch is one. */
    ok(!me.querySelector('input') && !me.querySelector('textarea') && !me.querySelector('select'),
       '🚨 and nothing on the Profile tab writes anything — no field, anywhere on it, which is '
       + 'the line `direction.md` §4a draws between this screen and #/account');
  }

  social.state = realState;
  await store.clearAll();
  await store.saveProfile({ gender: null, birthYear: null });
}

/* ====== HOME LOST ITS SWITCH (2026-09-08) ======
   Tim: *"I want to get rid of the 'You' and 'Friends' tab in the home page."*
   ⚠️ THE SCREEN BEHIND IT DID NOT GO — asserted separately, because "the switch
   is gone" is satisfiable by deleting the friends list too. */
{
  const { SocialView } = await import(BASE + 'views-social.js');
  const home = await mount(HomeView());
  await settle();
  /* ⚠️ `.segmented` IS THE REAL SELECTOR AND THE FIRST VERSION OF THIS
     ASSERTION HAD THE WRONG ONE. It looked for `.yf-tabs`, a class this app has
     never had, so it passed against a Home screen that still carried the switch
     — a vacuous check dressed as a guarantee, which is §0.14's trap on a
     selector rather than on a mutation. `youFriendsTabs()` built a
     `div.segmented` of two `a.seg`, and Home has no other segmented control. */
  ok(!home.querySelector('.segmented'),
     'Home no longer carries the You / Friends switch');
  ok(![...home.querySelectorAll('a.seg')].some((a) => a.getAttribute('href') === '#/social'),
     'and nothing on it is a tab pointing at the Friends screen');

  const friends = await mount(SocialView());
  await settle();
  ok(Boolean(friends), '🚨 while the Friends screen itself still renders — the switch went, not the screen');
}

/* ====== A JOINT WORKOUT IS ONE WORKOUT (2026-09-10) ======
 *
 * Tim, after recording one for the first time: *"The accounts that are joint
 * together should be more synced. When the user clicks 'next exercise', it
 * should move to the next exercise for both users, not just one. If the user
 * deletes, swaps, adds, or reorganizes the exercises, it should do the same for
 * both users. However, make a 'just for ____ (the user that is currently
 * selected)' button which makes it so if you do any of those things, it just
 * changes it for that user and not both users."*
 *
 * 🚨 THE LOAD-BEARING ASSERTION IN THIS WHOLE BLOCK IS THE ONE ABOUT NUMBERS,
 * not the ones about lists. Sharing the SHAPE of a workout is the feature;
 * sharing the WEIGHTS would be the cross-prescription 0e exists to forbid — two
 * lifters on one bar are not on the same weights. So the fixture gives the
 * owner and the guest genuinely different pasts on the exercises that get added
 * and swapped in (50 vs 10 on the Zottman curl, 95 vs 25 on the preacher curl),
 * and the assertions read each person's entry back separately. A fixture where
 * both sides had the same history would pass against a version that built ONE
 * entry and handed it round, which is the exact defect being guarded.
 *
 * ⚠️ EVERYTHING IS READ OFF THE DRAFT rather than off the screen, because only
 * one person is on screen at a time. `state.others` parks everybody else, so
 * the draft is the only place the two lists can be compared — and it is also
 * what survives backgrounding the app, which is where a desync would be found.
 */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const { setIsRecorded } = await import(BASE + 'session-draft.js');
  const DRAFT = 'ftrack:v1:draftSession';

  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const ZERCHER = byName('Zercher Squat');
  const LANDMINE = byName('Landmine Press');
  const SPIDER = byName('Spider Curl');
  const ZOTTMAN = byName('Zottman Curl');
  const PREACHER = byName('Preacher Curl');

  /* ⚠️ THE WORKOUT'S OWN THREE LIFTS HAVE NO HISTORY FOR ANYBODY, deliberately.
   * An exercise with history opens with every set pre-filled from last time and
   * a pre-filled set from a real session counts as PERFORMED — which would make
   * every swap below take the split path and every remove raise a confirm, so
   * the assertions would be describing the fixture rather than the feature. The
   * divergent histories live on the two lifts that get added and swapped IN. */
  const w = await store.saveWorkout({
    name: 'Joint day',
    exercises: [
      { exerciseId: ZERCHER.id, sets: 1, notes: '' },
      { exerciseId: LANDMINE.id, sets: 1, notes: '' },
      { exerciseId: SPIDER.id, sets: 1, notes: '' },
    ],
  });
  const armDay = await store.saveWorkout({
    name: 'Arm day',
    exercises: [
      { exerciseId: ZOTTMAN.id, sets: 3, notes: '' },
      { exerciseId: PREACHER.id, sets: 3, notes: '' },
    ],
  });
  // The owner's arms.
  await store.saveSession({
    workoutId: armDay.id, workoutName: 'Arm day', date: daysAgo(6),
    startedAt: new Date(Date.now() - 6 * 864e5).toISOString(),
    entries: [
      { exerciseId: ZOTTMAN.id, exerciseName: 'Zottman Curl', sets: [{ weight: 50, reps: 10 }] },
      { exerciseId: PREACHER.id, exerciseName: 'Preacher Curl', sets: [{ weight: 95, reps: 8 }] },
    ],
  });
  // Rae's arms, recorded on this phone under their name — a fifth of the load.
  await store.saveGuestSession({
    workoutId: armDay.id, workoutName: 'Arm day', date: daysAgo(5), guestName: 'Rae',
    entries: [
      { exerciseId: ZOTTMAN.id, exerciseName: 'Zottman Curl', sets: [{ weight: 10, reps: 12 }] },
      { exerciseId: PREACHER.id, exerciseName: 'Preacher Curl', sets: [{ weight: 25, reps: 10 }] },
    ],
  });

  /* ---- driving the screen ---- */
  const killSheets = () => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
  const sheetRows = () => [...document.querySelectorAll('.sheet .reorder-row')];
  // 🔄 The ▲▼ buttons are gone (2026-09-12); the grip's ArrowUp / ArrowDown is
  // the keyboard path. `.click()` presses the key, `.disabled` is "at an end" —
  // so every assertion below that drove the arrows drives the keys unchanged.
  const arrow = (i, dir) => ({
    disabled: dir === 'up' ? i === 0 : i === sheetRows().length - 1,
    click: () => sheetRows()[i].querySelector('.grip').dispatchEvent(
      new window.KeyboardEvent('keydown', { key: dir === 'up' ? 'ArrowUp' : 'ArrowDown', bubbles: true, cancelable: true })),
  });
  const rowRemove = (i) => [...sheetRows()[i].querySelectorAll('button')]
    .find((b) => /^Remove /.test(b.getAttribute('aria-label') || ''));
  const showAll = () => {
    const b = [...document.querySelectorAll('.sheet button')]
      .find((x) => /^Show all \d+ exercises$/.test((x.textContent || '').trim()));
    if (b) b.click();
    return Boolean(b);
  };
  const pick = (name) => {
    const box = document.querySelector('input[type="search"]');
    if (box) { box.value = name; box.dispatchEvent(new window.Event('input', { bubbles: true })); }
    const row = [...document.querySelectorAll('.search-results .row')]
      .find((b) => new RegExp('^' + name).test((b.textContent || '').trim()));
    if (row) row.click();
    return Boolean(row);
  };
  const chips = (s) => [...s.querySelectorAll('.person-chip')];
  const chip = (s, label) => chips(s).find((b) => b.textContent.trim() === label);
  const justFor = (s) => s.querySelector('.just-for');
  const nextBtn = (s) => [...s.querySelectorAll('button')]
    .find((b) => /Next exercise|Straight into|Round /.test(b.textContent));
  const actions = (s) => [...s.querySelectorAll('.session-actions .swap-btn')];

  /* ⚠️ TOASTS ARE COLLECTED AS THEY ARRIVE, NEVER READ OFF THE SCREEN AFTERWARDS,
   * and the first version of these assertions failed because of it. `toast()`
   * makes the one already showing LEAVE, and `leave()` removes a node outright
   * when it cannot animate — which is every jsdom run. A shared change that
   * skips somebody says so and then immediately says what it DID do, so the
   * skip notice is gone by the time any assertion could look for it. */
  const toastLog = [];
  new window.MutationObserver((recs) => {
    for (const r of recs) {
      for (const n of r.addedNodes) {
        if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) toastLog.push(n.textContent);
      }
    }
  }).observe(document.body, { childList: true });
  const mark = () => toastLog.length;
  const said = (from) => toastLog.slice(from).join(' | ');

  /* ---- reading everybody's copy out of the draft ----
   * ⚠️ The OWNER'S name is `null`, both as `state.forName` and in `others`. */
  const draft = () => JSON.parse(localStorage.getItem(DRAFT) || '{}');
  const slotOf = (name) => {
    const d = draft();
    return d.forName === name ? d : ((d.others || []).find((o) => o.name === name) || null);
  };
  const listOf = (name) => ((slotOf(name) || {}).entries || []).map((e) => e.exerciseName);
  const orderOf = (name) => listOf(name).join(' > ');
  const posOf = (name) => { const sl = slotOf(name); return sl ? sl.index : -1; };
  const entryOf = (name, exName) =>
    (((slotOf(name) || {}).entries) || []).find((e) => e.exerciseName === exName) || null;

  async function addGuest(s, name) {
    s.querySelector('.person-add').click();
    await settle(); await settle();
    [...document.querySelector('.sheet').querySelectorAll('button')]
      .find((b) => /Someone new/.test(b.textContent)).click();
    await settle();
    const inner = [...document.querySelectorAll('.sheet')].pop();
    inner.querySelector('input').value = name;
    [...inner.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add').click();
    await settle(); await settle();
  }
  /** A fresh two-person workout with the OWNER selected — the ordinary case. */
  async function joint() {
    killSheets();
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    await addGuest(s, 'Rae');
    chip(s, 'You').click();
    await settle();
    return s;
  }
  async function openList(s) { killSheets(); actions(s)[2].click(); await settle(); }
  async function addToday(s, name) {
    await openList(s);
    [...document.querySelectorAll('.sheet button')]
      .find((b) => /Add an exercise/.test(b.textContent)).click();
    await settle();
    const found = pick(name);
    await settle(); await settle();
    return found;
  }
  async function swapHere(s, name) {
    killSheets();
    actions(s)[0].click(); await settle();
    showAll(); await settle();
    const found = pick(name);
    await settle(); await settle();
    return found;
  }
  /* ⚠️ THE CONFIRM IS ANSWERED WHERE THERE IS ONE. An exercise added or swapped
   * in mid-session is pre-filled from real history, and a pre-filled set from a
   * real session counts as performed everywhere in this app — so removing one
   * says the count out loud and asks first, exactly as it does for an exercise
   * the workout started with. */
  async function removeAt(s, i) {
    await openList(s);
    rowRemove(i).click();
    await settle();
    const top = [...document.querySelectorAll('.sheet')].pop();
    const yes = top && !top.querySelector('.reorder-row')
      && [...top.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove');
    if (yes) { yes.click(); await settle(); }
    await settle();
  }
  async function moveDown(s, i) { await openList(s); arrow(i, 'down').click(); await settle(); }
  async function toggleJustFor(s) { justFor(s).click(); await settle(); }

  /* ============ the button: it only exists where it means something ============ */
  {
    killSheets();
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    ok(!justFor(s),
       '🚨 a SOLO workout has no "Just for" button — every change already applies to exactly one '
       + 'person, and a control offering to narrow that implies the app is doing something to '
       + 'somebody else');

    await addGuest(s, 'Rae');
    ok(Boolean(justFor(s)), 'a second person in the workout is what brings it onto the bar');
    ok(justFor(s).textContent.trim() === 'Just for Rae',
       '⚠️ and it names the person currently SELECTED, which is Tim\'s own wording — adding '
       + `somebody switches to them, so it opens as theirs (${justFor(s).textContent.trim()})`);
    ok(justFor(s).getAttribute('aria-pressed') === 'false',
       'off by default: a joint workout is one workout unless somebody says otherwise');

    chip(s, 'You').click();
    await settle();
    ok(justFor(s).textContent.trim() === 'Just for you',
       `🚨 and the label FOLLOWS the switch — one mode with a moving label, not a flag per person `
       + `(${justFor(s).textContent.trim()})`);

    await toggleJustFor(s);
    ok(justFor(s).getAttribute('aria-pressed') === 'true',
       '⚠️ aria-pressed is what says which way it is set — the same as the person chips beside it, '
       + 'and the only thing a screen reader has to go on');
    ok(draft().justForActive === true,
       'and the mode is on the DRAFT, so leaving the workout and coming back does not silently '
       + 'flip it back');
    await toggleJustFor(s);
    ok(justFor(s).getAttribute('aria-pressed') === 'false' && draft().justForActive === false,
       'and it toggles back off');

    // Switching while it is ON moves the label with it, which is what makes the
    // mode legible: it always says who "just for" currently means.
    await toggleJustFor(s);
    chip(s, 'Rae').click();
    await settle();
    ok(justFor(s).textContent.trim() === 'Just for Rae'
       && justFor(s).getAttribute('aria-pressed') === 'true',
       '⚠️ switching person while the mode is on re-aims it rather than clearing it — one mode, '
       + 'and the label is what says who it is pointed at');
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ============ shared by default: everything moves for everybody ============ */
  {
    const s = await joint();
    ok(orderOf(null) === 'Zercher Squat > Landmine Press > Spider Curl'
       && orderOf('Rae') === orderOf(null),
       `both people start on the same three exercises (${orderOf('Rae')})`);
    ok(posOf(null) === 0 && posOf('Rae') === 0, 'and on the same one');

    /* ---- 1. "Next exercise" moves everybody ---- */
    nextBtn(s).click(); await settle();
    ok(posOf(null) === 1 && posOf('Rae') === 1,
       `🚨 "Next exercise" moves EVERYBODY — Tim's first clause. Without it one person walks the `
       + `workout and the other is left standing on exercise one (you ${posOf(null)}, Rae ${posOf('Rae')})`);
    nextBtn(s).click(); await settle();
    ok(posOf(null) === 2 && posOf('Rae') === 2, 'and keeps doing it, step for step');
    /* ⚠️ THE BACK CHECK IS MADE ONE STEP AT A TIME, and the first version was not.
     * Reading only the last one — both at zero — is satisfied by somebody who
     * never moved at all, which is exactly what a broken shared walk looks like.
     * Asserting the middle step is what makes it a check on the walk. */
    s.querySelector('.nav-arrow').click(); await settle();
    ok(posOf(null) === 1 && posOf('Rae') === 1,
       `⚠️ and BACK too — the previous arrow goes through the same walk, so a mis-tap does not `
       + `leave the two of you one exercise apart (you ${posOf(null)}, Rae ${posOf('Rae')})`);
    s.querySelector('.nav-arrow').click(); await settle();
    ok(posOf(null) === 0 && posOf('Rae') === 0, 'and back to the top together');

    /* ---- 2. adding reaches everybody, and 6. each from their OWN past ---- */
    ok(await addToday(s, 'Zottman Curl'), 'an exercise can be added mid-workout');
    ok(listOf(null).length === 4 && listOf(null)[3] === 'Zottman Curl',
       `the owner gets it, on the end (${orderOf(null)})`);
    ok(listOf('Rae').length === 4 && listOf('Rae')[3] === 'Zottman Curl',
       `🚨 and so does Rae — one workout, one list of exercises (${orderOf('Rae')})`);

    const mineZ = entryOf(null, 'Zottman Curl');
    const raeZ = entryOf('Rae', 'Zottman Curl');
    ok(mineZ && mineZ.lastSets[0].weight === 50,
       `🔒 THE ONE THAT MATTERS: the owner's copy is built from the OWNER's history — 50 lb, which `
       + `is what they curled (${mineZ && mineZ.lastSets[0].weight})`);
    ok(raeZ && raeZ.lastSets[0].weight === 10,
       `🔒 and Rae's from RAE's — 10 lb. A version that built one entry and handed it round would `
       + `put 50 in front of somebody who has never curled it (${raeZ && raeZ.lastSets[0].weight})`);
    ok(mineZ && raeZ && mineZ.sets[0].weight !== raeZ.sets[0].weight,
       `🚨 so the numbers in the two people's FIELDS differ (${mineZ && mineZ.sets[0].weight} vs `
       + `${raeZ && raeZ.sets[0].weight}) — sharing the shape of a workout must never share its `
       + 'weights. This is decision 0e, and it is the whole safety property of the feature');
    ok(mineZ && mineZ.sets[0].weight >= 50 && raeZ && raeZ.sets[0].weight <= 20,
       '⚠️ and each lands on their own side of the gap rather than merely differing — a suggestion '
       + 'can nudge a number, it can never move it to somebody else\'s');
    ok(mineZ && mineZ.hadHistory === true && raeZ && raeZ.hadHistory === true,
       'both are marked as having a past, so neither is told "first time logging this" wrongly');

    /* ---- 4. swapping reaches everybody, again from their own past ---- */
    ok(await swapHere(s, 'Preacher Curl'), 'the exercise you are on can be swapped');
    ok(listOf(null)[0] === 'Preacher Curl',
       `the owner is on the new exercise (${orderOf(null)})`);
    ok(listOf('Rae')[0] === 'Preacher Curl',
       `🚨 and Rae's slot 0 swapped with it — a shared swap, not a private one (${orderOf('Rae')})`);
    const mineP = entryOf(null, 'Preacher Curl');
    const raeP = entryOf('Rae', 'Preacher Curl');
    ok(mineP && mineP.lastSets[0].weight === 95 && raeP && raeP.lastSets[0].weight === 25,
       `🔒 and the swap is REPLAYED per person, not broadcast: 95 for the owner, 25 for Rae `
       + `(${mineP && mineP.lastSets[0].weight} / ${raeP && raeP.lastSets[0].weight})`);
    ok(mineP && raeP && mineP.sets[0].weight !== raeP.sets[0].weight,
       'so the two swapped-in exercises arrive on different weights, which is the point');
    ok(mineP && mineP.swappedFrom === 'Zercher Squat' && raeP && raeP.swappedFrom === 'Zercher Squat',
       'and each says what it replaced on their own list');

    /* ---- 3. removing reaches everybody ---- */
    await removeAt(s, 3);
    ok(listOf(null).length === 3 && !listOf(null).includes('Zottman Curl'),
       `the owner loses it (${orderOf(null)})`);
    ok(listOf('Rae').length === 3 && !listOf('Rae').includes('Zottman Curl'),
       `🚨 and so does Rae — otherwise one of you is still being walked through an exercise the `
       + `group has abandoned (${orderOf('Rae')})`);

    /* ---- 5. reordering reaches everybody ---- */
    const before = orderOf(null);
    await moveDown(s, 0);
    ok(orderOf(null) !== before, `the list really moved (${before} → ${orderOf(null)})`);
    ok(orderOf('Rae') === orderOf(null),
       `🚨 and Rae's list is in the same order — a reorder that reached one person would have the `
       + `two of you calling out different exercises (${orderOf('Rae')})`);
    ok(posOf(null) === posOf('Rae'),
       '⚠️ and both are still standing on the same step after the shuffle — each re-pointed by '
       + 'their own entry object, never by the other person\'s new index');
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ============ "Just for ___": the same five, reaching one person ============
   *
   * ⚠️ EVERY ASSERTION HERE IS PAIRED — what changed for the owner AND what did
   * not change for Rae. Half of it would pass against a mode that did nothing at
   * all, and the other half against a mode that broke the edit entirely. */
  {
    const s = await joint();
    await toggleJustFor(s);
    ok(draft().justForActive === true, 'the mode is on, and pointed at the owner');
    const raeStart = orderOf('Rae');

    nextBtn(s).click(); await settle();
    ok(posOf(null) === 1 && posOf('Rae') === 0,
       `🚨 with "Just for you" on, moving on moves ONLY you — the person walking their own list is `
       + `the whole point of the button (you ${posOf(null)}, Rae ${posOf('Rae')})`);

    await addToday(s, 'Zottman Curl');
    ok(listOf(null).includes('Zottman Curl') && !listOf('Rae').includes('Zottman Curl'),
       `an add lands on you alone (${orderOf(null)} / ${orderOf('Rae')})`);

    await swapHere(s, 'Preacher Curl');
    ok(listOf(null)[1] === 'Preacher Curl' && listOf('Rae')[1] === 'Landmine Press',
       `a swap lands on you alone — Rae keeps the exercise they were given (${orderOf('Rae')})`);

    await removeAt(s, 2);
    ok(!listOf(null).includes('Spider Curl') && listOf('Rae').includes('Spider Curl'),
       `🚨 and a remove takes it off YOUR list only. This is the assertion that stops the button `
       + `deleting somebody else's exercise (${orderOf('Rae')})`);

    const mine = orderOf(null);
    await moveDown(s, 0);
    ok(orderOf(null) !== mine, `and a reorder moves your own list (${mine} → ${orderOf(null)})`);
    ok(orderOf('Rae') === raeStart,
       `⚠️ while Rae's is byte-for-byte the list they started with, after all five (${orderOf('Rae')})`);
    ok(posOf('Rae') === 0, 'and they have not been walked anywhere either');
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ============ the honest skips ============
   *
   * ⚠️ THESE BRANCHES EXIST BECAUSE "JUST FOR" MAKES DIVERGENCE REAL. Once two
   * lists can differ, a shared change has cases where there is no honest answer
   * — so it skips that person and says so, rather than changing an exercise
   * nobody pointed at. Each fixture below diverges the lists FIRST, with the
   * mode, and then drives the shared change over the top. */

  /* ---- 11. a swap skips a slot holding a different exercise ----
   * ⚠️ SWAPPED TO TWO LIFTS NOBODY IN THIS FIXTURE HAS EVER DONE, on purpose. A
   * swapped-in exercise WITH history arrives with last time's numbers in it, and
   * those count as performed — so the second swap would take the split path and
   * the assertion would be measuring the fixture rather than the skip. */
  {
    const s = await joint();
    await toggleJustFor(s);
    await swapHere(s, 'Hammer Curl');         // owner only: slot 0 now differs
    await toggleJustFor(s);
    ok(listOf(null)[0] === 'Hammer Curl' && listOf('Rae')[0] === 'Zercher Squat',
       'the two lists genuinely disagree about slot 0 before the shared swap runs');

    const from = mark();
    await swapHere(s, 'Concentration Curl');
    ok(listOf(null)[0] === 'Concentration Curl',
       `the owner's swap goes through (${orderOf(null)})`);
    ok(listOf('Rae')[0] === 'Zercher Squat',
       `🚨 and Rae is SKIPPED, because their slot 0 holds something else — swapping it would `
       + `silently change an exercise nobody pointed at (${orderOf('Rae')})`);
    const swapNotice = said(from);
    ok(/Rae kept theirs/.test(swapNotice) && /Swapped to Concentration Curl/.test(swapNotice)
       && !swapNotice.includes(' | '),
       `⚠️ and ONE notice says both what happened and who it did not reach. A shared change that `
       + `quietly reaches fewer people than it names is the same lie as one that reaches more — `
       + `and a second toast would not do, because toast() sends the first away (${swapNotice})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ---- 12. a remove skips somebody it would leave with nothing ---- */
  {
    const s = await joint();
    chip(s, 'Rae').click(); await settle();
    await toggleJustFor(s);                    // "Just for Rae"
    await removeAt(s, 2);
    await removeAt(s, 1);
    ok(orderOf('Rae') === 'Zercher Squat', `Rae is down to one exercise (${orderOf('Rae')})`);
    chip(s, 'You').click(); await settle();
    await toggleJustFor(s);
    ok(draft().justForActive === false && listOf(null)[0] === 'Zercher Squat',
       'and the shared mode is back on, with both slot 0s holding the SAME exercise — so the only '
       + 'thing left that can skip Rae is the one being tested');

    const from = mark();
    await removeAt(s, 0);
    ok(orderOf(null) === 'Landmine Press > Spider Curl',
       `the owner loses the squat (${orderOf(null)})`);
    ok(orderOf('Rae') === 'Zercher Squat',
       '🚨 and Rae keeps it — a shared remove never empties somebody\'s workout, which is the same '
       + 'rule the active person\'s own "this is the only exercise" guard states');
    const removeNotice = said(from);
    ok(/Rae kept theirs/.test(removeNotice) && /Removed Zercher Squat/.test(removeNotice)
       && !removeNotice.includes(' | '),
       `and one notice says so rather than leaving the divergence unexplained (${removeNotice})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ---- 13. an add skips somebody who already has it ---- */
  {
    const s = await joint();
    chip(s, 'Rae').click(); await settle();
    await toggleJustFor(s);
    await addToday(s, 'Zottman Curl');         // Rae only
    chip(s, 'You').click(); await settle();
    await toggleJustFor(s);
    ok(listOf('Rae').filter((n) => n === 'Zottman Curl').length === 1
       && !listOf(null).includes('Zottman Curl'),
       'Rae has the curl and the owner does not, before the shared add runs');

    await addToday(s, 'Zottman Curl');
    ok(listOf(null).includes('Zottman Curl') && listOf(null).length === 4,
       `the owner gets it (${orderOf(null)})`);
    ok(listOf('Rae').filter((n) => n === 'Zottman Curl').length === 1 && listOf('Rae').length === 4,
       `🚨 and Rae is skipped rather than given a SECOND copy — two entries with one exercise id in `
       + `a session is the shape that produced the duplicate-exercise read bug (${orderOf('Rae')})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ---- 14. a reorder skips a list of a different length ----
   *
   * ⚠️ BOTH DIRECTIONS, because the guard is a length comparison and the two
   * sides of it are not symmetrical: `order` is a permutation of the ACTIVE
   * person's indices, so applying it to a LONGER list drops the entries past the
   * end and applying it to a SHORTER one drops the indices past the end. Only
   * one of those changes the count the guard measures. */
  {
    const s = await joint();
    chip(s, 'Rae').click(); await settle();
    await toggleJustFor(s);
    await addToday(s, 'Hammer Curl');          // Rae's list is now the LONGER one
    chip(s, 'You').click(); await settle();
    await toggleJustFor(s);
    ok(listOf(null).length === 3 && listOf('Rae').length === 4,
       `the owner has three exercises and Rae four (${orderOf('Rae')})`);

    const raeBefore = orderOf('Rae');
    await moveDown(s, 0);
    ok(orderOf(null) === 'Landmine Press > Zercher Squat > Spider Curl',
       `the owner's list reorders (${orderOf(null)})`);
    ok(orderOf('Rae') === raeBefore,
       `a LONGER list keeps its own order — a three-position shuffle says nothing about a fourth `
       + `exercise, and applying it would drop one (${orderOf('Rae')})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }
  {
    const s = await joint();
    chip(s, 'Rae').click(); await settle();
    await toggleJustFor(s);
    await removeAt(s, 2);                      // Rae's list is now the SHORTER one
    chip(s, 'You').click(); await settle();
    await toggleJustFor(s);
    ok(listOf(null).length === 3 && listOf('Rae').length === 2,
       `the owner has three exercises and Rae two (${orderOf('Rae')})`);

    const raeBefore = orderOf('Rae');
    await moveDown(s, 0);
    ok(orderOf(null) === 'Landmine Press > Zercher Squat > Spider Curl',
       `the owner's list reorders (${orderOf(null)})`);
    /* 🚨 THIS ONE FAILS, AND IT IS THE CODE THAT IS WRONG — reported, not fixed,
     * because js/views-session.js is being written in parallel. `reorderSlot`
     * guards with `next.length !== slot.entries.length` AFTER a `filter(Boolean)`
     * over the mapped indices, and that comparison can never fire for a SHORTER
     * list: the out-of-range indices are dropped by the filter, so the count
     * always comes back equal to the short list's own length. The guard works in
     * exactly one direction — the assertion above it, where the other person has
     * MORE exercises and real entries fall off the end. Comparing against
     * `order.length` instead is what the header already says this does. */
    ok(orderOf('Rae') === raeBefore,
       `🚨 and a SHORTER list keeps its own order too — "a permutation of five positions means `
       + `nothing applied to a list of four" is the rule reorderSlot states, and it has to hold `
       + `whichever list is the short one (${raeBefore} → ${orderOf('Rae')})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ---- 15. the walk clamps PER PERSON rather than running off a short list ---- */
  {
    const s = await joint();
    chip(s, 'Rae').click(); await settle();
    await toggleJustFor(s);
    await removeAt(s, 2);
    // Back to the top of their own list first: a removal lands you on whatever
    // took the slot, and starting this at step 1 would let a clamp that never
    // ran look exactly like one that did.
    s.querySelector('.nav-arrow').click(); await settle();
    chip(s, 'You').click(); await settle();
    await toggleJustFor(s);
    ok(listOf(null).length === 3 && listOf('Rae').length === 2 && posOf('Rae') === 0,
       'the owner has three steps, Rae two, and both are at the top');

    nextBtn(s).click(); await settle();
    ok(posOf(null) === 1 && posOf('Rae') === 1, 'step one is a step both of them have');
    nextBtn(s).click(); await settle();
    ok(posOf(null) === 2, `the owner walks to their own last step (${posOf(null)})`);
    ok(posOf('Rae') === 1,
       `🚨 and Rae lands on THEIR last step rather than on a step they do not have — syncWalk `
       + `clamps per person, because after a "just for" edit there is no honest shared number, and `
       + `"as far along as you can be" is the best available meaning (${posOf('Rae')})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ============ 16. joining a workout already in progress ============ */
  {
    killSheets();
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    nextBtn(s).click(); await settle();
    nextBtn(s).click(); await settle();
    ok(draft().index === 2, 'the owner is on exercise three, alone');

    await addGuest(s, 'Rae');
    ok(draft().forName === 'Rae' && draft().index === 2,
       `🚨 somebody added mid-workout JOINS WHERE THE WORKOUT IS — starting them at zero puts the `
       + `one person who just arrived out of step with everybody (${draft().index})`);
    ok(posOf(null) === 2, 'and the owner has not been moved by their arrival');
    ok(slotOf('Rae').entries.every((e) => (e.sets || []).every((set) => !setIsRecorded(set, e.fields))),
       '⚠️ while the exercises they were not there for stay blank, which is true — joining at '
       + 'exercise three is not a claim to have done one and two');
    killSheets();
    localStorage.removeItem(DRAFT);
  }

  /* ---- 🚨 AND THEY JOIN THE WORKOUT AS IT IS NOW, NOT AS THE TEMPLATE WROTE IT ----
     This block described the OPPOSITE until 2026-09-10 and was right to: the
     newcomer's list was built from `planned`, the saved workout, so anybody
     added after the group had improvised arrived out of shape with everybody —
     the exact fault the shared operations exist to fix, coming through the one
     door that did not go through them. Found by the agent that wrote this
     block, reported rather than asserted as correct, and fixed.

     ⚠️ THE SHAPE IS COPIED AND THE NUMBERS ARE NOT, which is the half that
     must not regress: each entry is rebuilt from THEIR OWN history, never from
     the entry beside it. */
  {
    killSheets();
    localStorage.removeItem(DRAFT);
    const s = await mount(SessionView(w.id));
    await addToday(s, 'Zottman Curl');
    await addToday(s, 'Preacher Curl');
    killSheets();
    for (let i = 0; i < 4 && nextBtn(s); i++) { nextBtn(s).click(); await settle(); }
    ok(draft().index === 4, `the owner is five exercises deep (${draft().index})`);

    await addGuest(s, 'Rae');
    ok(draft().forName === 'Rae' && slotOf('Rae').entries.length === 5,
       `🚨 the newcomer gets the list the group has improvised its way to, not the template's `
       + `three (${slotOf('Rae').entries.length} entries)`);
    ok(orderOf('Rae') === orderOf(null),
       `in the same order, exercise for exercise (${orderOf('Rae')})`);
    ok(draft().index === 4,
       `🚨 so they land where everybody else is standing rather than being clamped back to a `
       + `shorter list of their own (${draft().index})`);
    ok(posOf(null) === 4, 'and the owner stays where they were');

    /* 🔒 The half that must never follow the shape across. Rae's history on
       Zottman Curl is 10 lb and the owner's is 50; a newcomer built by copying
       the group's entries rather than rebuilding them would read 50 here. */
    const theirs = slotOf('Rae').entries.find((e) => e.exerciseName === 'Zottman Curl');
    ok(theirs && Number(theirs.lastSets[0].weight) === 10,
       `⚠️ and the numbers are THEIRS, not the group's — Zottman Curl opens at their own 10 lb, `
       + `not the owner's 50 (${theirs && theirs.lastSets[0].weight})`);
    killSheets();
    localStorage.removeItem(DRAFT);
  }
}

/* ==================================================================
 * A FRIEND'S CALENDAR HAS THE MONTHS / YEARS SWITCH — 2026-09-10
 *
 * Tim: *"When you view a friend's data, you can see their calendar, but can't
 * select between months and years. Make it so you can."*
 *
 * 🚨 THE HALF OF THIS THAT IS NOT ABOUT THE SWITCH IS THE HALF THAT MATTERS.
 * Their document holds sixty published sessions (`MAX_ACTIVITY` in social.js,
 * `activity.size() <= 60` in firestore.rules), and the Years grid prints a count
 * beside every year. Over that window "141 days trained" is a count of what they
 * SHARE wearing the name of what they DID — a number presented as something it
 * is not, which docs/direction.md §3.1 says is still wrong however useful it
 * looks. So the assertions below check three separate things and none of them
 * substitutes for another: the switch exists, both views draw, and the screen
 * never claims to know more about their training than sixty sessions.
 * ================================================================== */
{
  const { FriendView, FriendDataView } = await import(BASE + 'views-social.js');
  const { social, todayISO } = await import(BASE + 'store.js');
  const { CalendarView: MyCal } = await import(BASE + 'views-data.js');
  sessionStorage.removeItem('ftrack:v1:demo');

  const keep = {
    state: social.state, friend: social.friend, invites: social.invites,
    handoffs: social.handoffs, requests: social.requests,
    healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    processAcceptedRequests: social.processAcceptedRequests,
  };
  social.invites = async () => [];
  social.handoffs = async () => [];
  social.requests = async () => [];
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;
  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim',
    shareBodyWeight: false, visibility: 'private',
    connections: [{ uid: 'u1', name: 'Autumn', since: '2026-08-01' }],
  });

  const THIS_YEAR = Number(todayISO().slice(0, 4));
  const LAST_YEAR = THIS_YEAR - 1;
  /* ⚠️ TWO YEARS ON PURPOSE. `yearsToShow` runs from the earliest thing recorded
     to today, so a fixture inside one year would draw one grid and could not
     tell "a grid per year" from "a grid". */
  const dates = [todayISO(), `${THIS_YEAR}-02-10`, `${THIS_YEAR}-02-11`, `${LAST_YEAR}-11-05`];
  const theirSessions = dates.map((date, i) => ({
    id: `fc${i}`, date, name: 'Pull', startedAt: `${date}T09:00:00.000Z`,
    entries: [{ exerciseId: 'lat-pulldown', name: 'Lat Pulldown',
      sets: [{ weight: 120, reps: 10 }] }],
  }));
  const theirDoc = {
    audience: 'friends', isPublic: false,
    profile: { name: 'Autumn' },
    activity: theirSessions,
    benchmarks: [],
    strength: {
      muscles: [{ muscle: 'Back', lift: 'Barbell Row', estimate: 180, confidence: 0.4,
        band: 'Rough', basis: 'fallback', contributorCount: 2, exerciseCount: 1,
        contributors: [{ exerciseName: 'Barbell Row', weight: 145, reps: 8,
          date: `${THIS_YEAR}-02-10`, loadType: 'total', source: 'workout' }],
        hint: null, confident: false }],
      grid: { 'lifters|male|own|own': { Back: [41, 30] } },
      defaultCompare: 'lifters|male|own|own',
    },
  };
  social.friend = async () => ({ audience: 'friends', doc: theirDoc });

  /* ⚠️ PIN MY OWN CALENDAR TO YEARS FIRST, and it is not tidying up. Years is
     the default, but earlier blocks in this file click the switch and leave
     `calMode` wherever they finish, and the "browsing theirs did not move mine"
     assertion below needs to KNOW where mine starts: their page is about to be
     switched to Months, so mine on Months would be comparing Months to Months
     and could never fail. Setting it deliberately is what gives that check
     something to detect. (🔄 It pinned Months until 2026-09-12, when the
     default flipped and the friend page started opening on Years — the pair of
     checks is the same, with the two views swapped.) */
  {
    const mine = await mount(MyCal());
    for (let i = 0; i < 4; i++) await settle();
    const y = [...mine.querySelectorAll('.cal-modes .seg')].find((b) => b.textContent === 'Years');
    if (y && y.getAttribute('aria-selected') !== 'true') { y.click(); await settle(); }
  }

  /* 🔄 THEIR CALENDAR HAS TWO DOORS SINCE 2026-09-16 and this asserts both. It
   * is a segment of their DATA PANEL, as it has been since 2026-09-05 — that is
   * the one carrying the Months/Years switch these assertions are about — and it
   * is also a section of their PROFILE now, because Tim asked for *"their
   * training history (calendar)"* on it. Both are `ownCalendar()`: one function,
   * five doors, which is the whole reason that function exists. */
  {
    const prof = await mount(FriendView('u1'));
    for (let i = 0; i < 12; i++) await settle();
    ok(Boolean(prof.querySelector('.me-cal .cal-modes')),
       '🚨 their PROFILE carries their training history, drawn by the same ownCalendar() as mine');
    ok(/days published/.test(prof.textContent.replace(/\s+/g, ' ')),
       '⚠️ counting days PUBLISHED, not days trained — the rename is what makes a bounded figure '
       + 'honest, and it travels with the calendar rather than being written twice');
  }

  /* 🔄 ONE DOOR SINCE LATER ON 2026-09-16, ~~two~~. Tim: *"because calendar is
   * now shown in the profile menu, remove it as a tab in the 'view data' section
   * when looking at another person's information."* Every assertion below is the
   * one this block already made — the switch, both views, the count that says
   * "published", the inert cells, the landing — read at the door that still
   * exists. Nothing was weakened to make the move: the door changed, the claims
   * did not. */
  const fr = await mount(FriendView('u1'));
  for (let i = 0; i < 14; i++) await settle();

  const calSeg = (label) => [...fr.querySelectorAll('.cal-modes .segmented .seg')]
    .find((b) => b.textContent === label);

  /* ---- 1. the switch is there, and it is the app's own switch ---- */
  const modeLabels = [...fr.querySelectorAll('.cal-modes .segmented .seg')].map((b) => b.textContent);
  ok(modeLabels.join('|') === 'Months|Years',
     `🚨 a friend's calendar carries the Months / Years switch (${modeLabels.join('|') || 'none'})`);
  /* 🚨 ONE BODY OF CODE BEHIND BOTH DOORS. The switch is a `.cal-modes` block
     built by `ownCalendar()`; a second copy written for this page would drift
     from mine the first time either changed, which is what docs/state.md's
     Calendar row exists to prevent. Asserted through the SHAPE the shared
     builder produces rather than by importing it, because a private function
     re-implemented would still import cleanly. */
  ok(fr.querySelectorAll('.cal-modes').length === 1
     && fr.querySelector('.cal-modes .segmented').classList.contains('sub'),
     '⚠️ and it is the same `.cal-modes` / `.segmented.sub` block my own calendar builds, not a '
     + 'second switch written for this page');
  /* 🔄 ~~their page OPENS on Months — Years is the view that draws a whole year
     over a sixty-session window, so it is chosen rather than inherited~~ YEARS
     SINCE 2026-09-12, Tim: *"make the year display the default for the calendar
     in all scenarios (including viewing a friend's calendar)."* The hazard that
     sentence named is still answered — by the caveat under the switch, which is
     on the screen in Years and says the blanks are not rest — rather than by
     opening one tap away from it. ⚠️ This reads `friendCalMode` as the earlier
     friend-page block left it (it restores the default before leaving); the
     INITIAL value is pinned there, on the first friend calendar this file
     paints. */
  ok(calSeg('Years').getAttribute('aria-selected') === 'true',
     '🔄 and their page OPENS on Years, like every door');

  /* ---- 2. Years draws, and it draws THEIR days ---- */
  const grids = [...fr.querySelectorAll('.yr-grid')];
  ok(grids.length === 2,
     `🚨 Years draws a grid per year of what they published (${grids.length})`);
  ok(!fr.querySelector('.cal-month'),
     '⚠️ and no month blocks under them — one view at a time, the same repaint-in-place my own '
     + 'calendar does');
  const litThisYear = grids[0].querySelectorAll('.yr-cell.on').length;
  ok(litThisYear === new Set(dates.filter((d) => d.startsWith(String(THIS_YEAR)))).size,
     `⚠️ one square lit per day they published, not per session (${litThisYear})`);

  /* ---- 3. 🚨 THE NUMBER BESIDE THE YEAR COUNTS WHAT IS DRAWN, AND SAYS SO ----
     This is the load-bearing assertion of the whole change. Over sixty published
     sessions "N days trained" is a count of publishing wearing the name of
     training: it is capped at 60 whatever they did, so somebody who trained 200
     days and somebody who trained 61 read identically. The figure is not blanked
     — the grid is one `role="img"` with a single label, so blanking it would
     leave a screen-reader user no reading of the picture at all — it is renamed
     to the quantity it actually counts. */
  const calText = fr.textContent.replace(/\s+/g, ' ');
  ok(new RegExp(`${litThisYear} days published`).test(calText),
     `🚨 the count beside their year says "${litThisYear} days published" — it counts the squares `
     + 'drawn, which are the days they SHARED');
  ok(!/days trained|day trained/.test(calText),
     '🚨 AND THE WORDS "days trained" APPEAR NOWHERE ON THEIR PAGE — that number cannot exceed the '
     + 'sixty sessions they publish, so printing it under the name of a training total is a claim '
     + 'this app has no way to make (direction.md §3.1: a number presented as something it is not '
     + 'is still wrong)');
  {
    const label = grids[0].getAttribute('aria-label') || '';
    ok(/days published/.test(label) && !/days trained/.test(label),
       '⚠️ including the label a screen reader is given for the picture — the visible chip and the '
       + 'accessible name are the same claim, or one of them is a lie');
    ok(!/Open the Months view to reach a day/.test(label),
       '🚨 and it does NOT tell them to open Months to reach a day, which is my own grid\'s hint '
       + 'and is an instruction that cannot be carried out here — their month cells are inert');
  }

  /* ---- 4. the caveat is ON the screen, and Years says the extra part ---- */
  ok(/most recent sixty sessions Autumn publishes/.test(calText),
     '🚨 the sixty-session window is stated on their calendar in Years');
  ok(/blank whether or not they trained/.test(calText),
     '🚨 AND YEARS SAYS THE BLANKS ARE NOT REST. It paints a whole calendar year whether or not '
     + 'the window reaches back that far, so an empty half-year is a statement about publishing '
     + 'that reads as a statement about training unless the screen says otherwise');
  ok(/counts published days only/.test(calText),
     '⚠️ and names what the figure beside each year is, rather than leaving the reader to work out '
     + 'that a count capped at sixty is not a total');
  ok(!fr.querySelector('.cal-modes .help-dot'),
     '🛑 and it is NOT behind a "?" — Design Rule 9 puts WHY behind the dot and keeps WHAT on the '
     + 'screen, and the window is WHAT this picture is');

  /* ---- 5. the readout reports, and goes nowhere ---- */
  const readout = fr.querySelector('.yr-readout');
  ok(readout && readout.tagName.toLowerCase() !== 'button',
     '🚨 their readout is not a button — my own opens `#/day/<iso>`, which is MY training for that '
     + 'date, and a full-width control that can never answer is the same fault as a day cell that '
     + `does nothing (${readout && readout.tagName.toLowerCase()})`);
  {
    const before = globalThis.location.hash;
    const lit = grids[0].querySelector('.yr-cell.on');
    lit.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(/Pull/.test(readout.textContent),
       '⚠️ but it still names what they did that day — that is the whole value of a 6px square, and '
       + 'withholding it would make the Years view unreadable rather than honest');
    ok(globalThis.location.hash === before,
       '🚨 and tapping a square navigates nowhere at all');
    readout.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(globalThis.location.hash === before,
       '🚨 nor does tapping the readout itself — the one control that DOES navigate on my own '
       + 'calendar is the one that had to be neutered on theirs');
    ok(grids[0].querySelectorAll('.yr-cell.sel').length === 1,
       'exactly one square reads as selected');
  }

  /* ---- 6. Months, on a tap: draws, cells still inert, and it LANDS ---- */
  calSeg('Months').click();
  for (let i = 0; i < 4; i++) await settle();
  ok(fr.querySelectorAll('.cal-month').length > 0 && !fr.querySelector('.yr-grid'),
     'tapping Months draws their month blocks, and the grids go');
  {
    const cells = [...fr.querySelectorAll('.cal-cell')].filter((c) => !c.classList.contains('blank'));
    ok(cells.length > 0 && cells.every((c) => c.tagName.toLowerCase() !== 'button'),
       '🚨 and NOT ONE of their day cells is a button — there is still no screen for one of their '
       + `days, and routing this switch through the shared builder must not have created one (${cells.length} cells)`);

    /* 🚨 A DEFECT THIS BLOCK FOUND RATHER THAN A FEATURE IT ADDED, and it had
       shipped with the friend calendar. `projectSession()` writes a published
       session's title as `name`; the calendar read `s.workoutName`, which a
       published document does not have. So every cell of every friend's
       calendar said "Workout" whatever the workout was called — and the cell's
       ACCESSIBLE NAME was built without the fallback, so a screen reader was
       handed "February 10: undefined".
       ⚠️ INVISIBLE TO EVERY EXISTING TEST because no fixture used the published
       shape; this one does, which is why it turned up. */
    const named = cells.find((c) => /Pull/.test(c.textContent));
    ok(Boolean(named),
       '🚨 and a cell carries the workout\'s real name — a published session calls it `name`, not '
       + '`workoutName`, so reading only the latter labelled every one of their days "Workout"');
    /* ⚠️ THE ACCESSIBLE NAME IS ASSERTED SEPARATELY AND IS NOT THE SAME CHECK.
       The visible tag had a `|| 'Workout'` fallback behind it; the aria-label
       was built from `rec.sessions.map((s) => s.workoutName)` with nothing
       behind it at all, so a screen reader was handed the literal string
       "undefined". ⚠️ An earlier version of this assertion looked for that word
       and would have been VACUOUS — the shared reader can no longer return
       undefined for anybody — so it asks the real question instead: does the
       label carry the name a sighted user can see. */
    ok(named && /Pull/.test(named.getAttribute('aria-label') || ''),
       '🚨 and so does its accessible name — the label was the half of this bug with no fallback '
       + 'behind it, and read "February 10: undefined"');
  }

  /* The window sentence is true in both modes and is on the screen in both;
     Years carries the two extra clauses (asserted in section 4). */
  ok(/most recent sixty sessions Autumn publishes/.test(fr.textContent.replace(/\s+/g, ' ')),
     '🚨 and the sixty-session window is stated in Months as well — both views, one sentence');
  /* 🔄 AND THE TAP LANDED — 2026-09-12. Same mechanism as my own calendar: their
     page's pane is the Data pane, `land` is on, and the tap aims it at the
     current month. Structure only — jsdom lays nothing out; see the Calendar
     block for what a browser still has to show. */
  ok(Boolean(fr.querySelector('.cal-month[data-current-month][data-landed]')),
     '🚨 and tapping Months aimed their page\'s pane at the CURRENT month — Tim: "the current '
     + 'month should be the one that is being viewed to start"');

  /* ---- 7. 🚨 AND BROWSING THEIR CALENDAR MUST NOT MOVE MINE, IN EITHER DIRECTION ----
     The same guard `graphMode` has. `calMode` is "how I read MY calendar"; a
     preference formed over somebody's sixty-session window is not a decision
     about my own history, and my Calendar tab must not open somewhere I did not
     choose. Their page keeps `friendCalMode`.

     🔄 The views are swapped since 2026-09-12 (theirs was just switched to
     Months; mine was pinned to Years at the top of this block), and the pair is
     now asserted BOTH ways, each with the two memories holding DIFFERENT values
     — the only arrangement in which one shared variable would fail. Mutation-
     checked 2026-09-12: reading and writing `calMode` for both subjects fails
     both 🚨 lines below, plus the two that follow the first one (mine draws
     Months instead of Years, so "draws Years" and "days trained" go with it),
     and nothing else in the file. */
  {
    const mine = await mount(MyCal());
    for (let i = 0; i < 4; i++) await settle();
    const sel = [...mine.querySelectorAll('.cal-modes .seg')]
      .find((b) => b.getAttribute('aria-selected') === 'true');
    ok(sel && sel.textContent === 'Years',
       `🚨 my own calendar is still on Years after switching theirs to Months (${sel && sel.textContent})`);
    ok(mine.querySelectorAll('.yr-grid').length > 0 && !mine.querySelector('.cal-month'),
       'and actually draws Years rather than only claiming the segment');
    /* ⚠️ THE OTHER DIRECTION OF THE WORDS, and it is the half a one-way check
       would miss: mine still says "trained", because over my whole history that
       is exactly what the squares are. The rename is about their window, not a
       retreat from naming my own training. */
    const mineText = mine.textContent.replace(/\s+/g, ' ');
    ok(/days trained|day trained/.test(mineText),
       '⚠️ and MY grid still counts days TRAINED — I publish nothing to myself, so the honest word '
       + 'on my own calendar is unchanged');
    ok(!/most recent sixty sessions/.test(mineText),
       '⚠️ with no window caveat on it, because there is no window');
    // Now move MINE to Months, so the two memories differ the other way round.
    [...mine.querySelectorAll('.cal-modes .seg')].find((b) => b.textContent === 'Months').click();
    await settle();
    /* 🔄 THE WHOLE RULE RATHER THAN ONE OF ITS TWO CASES — 2026-09-16. Until
       today the months always ran to today, so "it landed" and "it landed on the
       current month" were the same sentence; the months now stop at the last
       recording, and which of the two this fixture exercises depends on whether
       the store this block inherits happens to hold something dated this month.
       Asserting the RULE — the current month when it is drawn, the most recent
       month drawn when it is not — pins both branches and cannot go quietly
       vacuous when the fixture above it changes. */
    {
      const blocks = [...mine.querySelectorAll('.cal-month')];
      const cur = mine.querySelector('.cal-month[data-current-month]');
      const landed = mine.querySelector('.cal-month[data-landed]');
      ok(landed && landed === (cur || blocks[blocks.length - 1]),
         `and tapping Months on my own Calendar screen lands — on the current month when it is `
         + `drawn, on the most recent month drawn when it is not (current month drawn: ${Boolean(cur)})`);
      ok(landed && !landed.nextElementSibling,
         '⚠️ and either way it is the LAST block, so earlier months are reached by scrolling up');
    }
  }
  {
    // Theirs is on Months from section 6; put it on Years so the two differ.
    const back = await mount(FriendView('u1'));
    for (let i = 0; i < 14; i++) await settle();
    [...back.querySelectorAll('.cal-modes .seg')].find((b) => b.textContent === 'Years').click();
    await settle();
  }
  {
    const mine = await mount(MyCal());
    for (let i = 0; i < 4; i++) await settle();
    const sel = [...mine.querySelectorAll('.cal-modes .seg')]
      .find((b) => b.getAttribute('aria-selected') === 'true');
    ok(sel && sel.textContent === 'Months',
       `🚨 and my own calendar is still on Months after reading a year of theirs (${sel && sel.textContent})`);
    /* ⚠️ PUT MINE BACK ON YEARS, the default, before leaving. `calMode` is
       module state and outlives this block; theirs is already on Years. */
    [...mine.querySelectorAll('.cal-modes .seg')].find((b) => b.textContent === 'Years').click();
    await settle();
  }

  Object.assign(social, keep);
}

/* ==================================================================
 * AN EMPTY MONTH COLLAPSES, AND SIX MONTHS EARN A BAR CHART — 2026-09-16
 *
 * Tim: *"when you go in the months display, if a month has no recordings in it,
 * just say the month and say no recordings, don't show an entire month of empty
 * boxes. Additionally, if the user has more than 5 months of recordings in it,
 * show a bar chart that has the months as the x axis and the number of days
 * workouts recorded in that month as the y axis."*
 *
 * ⚠️ RUN LAST, and it clears the store on the way in and out. `calMode` is
 * module state that every calendar block in this file reads, so this one leaves
 * it on Years — the default — exactly as the friend block above does.
 * ================================================================== */
{
  const { todayISO } = await import(BASE + 'store.js');
  sessionStorage.removeItem('ftrack:v1:demo');
  await store.clearAll();

  const TODAY = todayISO();
  // Day 5 of the month `n` months back. ⚠️ Built from integers through
  // `new Date(y, m, d)` and never parsed from a string — the rule year-grid.js
  // states, for the reason it states: `new Date('2026-03-01')` is UTC midnight
  // and lands in February west of Greenwich.
  const monthBack = (n) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - n, 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`;
  };
  const monthName = (n) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - n, 5);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  };
  const sameMonth = (n, day) => monthBack(n).slice(0, 8) + String(day).padStart(2, '0');

  const w = await store.saveWorkout({ name: 'Chart test', exercises: [] });
  const log = async (date) => store.saveSession({
    workoutId: w.id, workoutName: 'Chart test', date, entries: [],
  });
  const segs = (screen) => [...screen.querySelectorAll('.cal-modes .seg')];
  const toMonths = async (screen) => {
    segs(screen).find((b) => b.textContent === 'Months').click();
    for (let i = 0; i < 3; i++) await settle();
  };

  /* ---- 1. an empty month is one line, and a full one still has its grid ---- */
  {
    await log(TODAY);
    await log(monthBack(2));
    const screen = await mount(CalendarView());
    await toMonths(screen);

    const blocks = [...screen.querySelectorAll('.cal-month')];
    const empties = blocks.filter((b) => b.classList.contains('is-empty'));
    ok(empties.length > 0 && empties.every((b) => !b.querySelector('.cal-cell')),
       `🚨 a month with nothing recorded draws NO day boxes at all (${empties.length} collapsed, `
       + `${empties.reduce((n, b) => n + b.querySelectorAll('.cal-cell').length, 0)} cells between them) `
       + '— Tim: "don\'t show an entire month of empty boxes"');
    ok(empties.every((b) => /No recordings/.test(b.textContent)),
       'and says "No recordings" instead');
    ok(empties.every((b) => /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b \d{4}/
      .test(b.querySelector('.cal-title').textContent)),
       '⚠️ while still NAMING the month and its year — Tim asked for the month to be said, not for '
       + 'the month to be dropped: a month that is not drawn reads as a month that does not exist');
    /* ⚠️ THE OTHER HALF, and without it "collapse every month" would pass every
       line above. A month that HAS something is untouched: its day boxes, its
       weekday strip and the workout's name in the cell are all still there. */
    {
      const full = blocks.filter((b) => !b.classList.contains('is-empty'));
      ok(full.length === 2,
         `🚨 and exactly the two months that HAVE something are still drawn in full (${full.length})`);
      ok(full.every((b) => b.querySelectorAll('.cal-cell').length >= 28 && b.querySelector('.cal-dows')),
         'each with its day boxes and its weekday strip');
      ok(full.some((b) => /Chart test/.test(b.textContent)),
         '⚠️ and the workout still names itself in the cell — the collapse may not cost the months '
         + 'that survive it anything');
    }
    /* 🚨 A COLLAPSED MONTH IS STILL A LANDING TARGET, and this is the assertion
       the whole change turns on. `landOnCurrentMonth` finds its month by
       `[data-current-month]` and pads `lastElementChild`; a collapsed section
       that dropped either would silently stop the Months tap landing — which is
       the 2026-09-12 fix, undone by the 2026-09-16 one. Structure only: jsdom
       lays nothing out, so `data-landed` is the record of what the scroller was
       AIMED at (see the Calendar block for what a browser still has to show). */
    {
      const current = screen.querySelector('.cal-month[data-current-month]');
      ok(current && current.dataset.landed === 'true' && !current.nextElementSibling,
         '🚨 the current month is still the LAST block and the scroller was still aimed at it');
    }
    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
    await store.clearAll();
  }

  /* ---- 2. 🔄 THE MONTHS STOP AT THE LAST RECORDING, AND THE LANDING FOLLOWS ----
     ~~AND THE CURRENT MONTH COLLAPSES LIKE ANY OTHER, still landing. The 1st of
     a month is the ordinary case here, not an edge one: nothing is recorded yet
     and the month somebody lands on is the empty one.~~

     🔄 REWRITTEN 2026-09-16 BECAUSE THE CASE IT DESCRIBED NO LONGER EXISTS, and
     that is the change rather than a gap in it. Tim: *"don't show any months
     that were before or after the first and last recording."* The range ends at
     the last recording, so a current month with nothing in it is not drawn —
     which retires the flagged "on the 1st of an empty month you land on a
     one-line row over a screenful of padding" outright, since the row is not
     there to land on.

     🚨 THE RISK THE TRIM CREATED IS WHAT THIS BLOCK NOW PINS. `landOnCurrentMonth`
     aimed at `[data-current-month]`, and with that section absent a plain
     `return` would leave the scroller wherever it was — silently undoing Tim's
     2026-09-12 landing. It aims at the most recent month drawn instead. */
  {
    await log(monthBack(1));
    await log(monthBack(3));
    const screen = await mount(CalendarView());
    await toMonths(screen);
    const blocks = [...screen.querySelectorAll('.cal-month')];
    ok(!screen.querySelector('.cal-month[data-current-month]'),
       '🚨 nothing was recorded this month, so THIS MONTH IS NOT DRAWN — a month after the last '
       + 'recording is not a gap in a history');
    ok(blocks.length === 3,
       `🚨 and exactly three months are drawn — three months back through one month back, ends `
       + `inclusive (${blocks.length})`);
    ok(blocks[1] && blocks[1].classList.contains('is-empty'),
       '⚠️ with the month BETWEEN them still collapsed and still there: an interior empty month is '
       + 'a real silence in a real history, which is what the one-line row was built for');
    const landed = screen.querySelector('.cal-month[data-landed]');
    ok(landed && landed === blocks[blocks.length - 1],
       '🚨 and the tap lands on the most recent month DRAWN — the landing may not stop working '
       + 'because the month it used to aim at is no longer on the page (Tim, 2026-09-12: "the '
       + 'current month should be the one that is being viewed to start")');
    ok(landed && !landed.classList.contains('is-empty'),
       '⚠️ which has training in it by construction — the last month drawn is the month of the last '
       + 'recording, so the pane never comes to rest on a "No recordings" row');
    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
    await store.clearAll();
  }

  /* ---- 2b. 🆕 NO RECORDINGS AT ALL, AND ONE RECORDING — 2026-09-16 ----
     The two ends of the trim, and neither existed before it: the months used to
     run twelve back from today whatever the store held. */
  {
    const screen = await mount(CalendarView());
    await toMonths(screen);
    ok(!screen.querySelector('.cal-month'),
       '🚨 a fresh account draws NO month blocks — there is no first recording and no last, so '
       + 'there is no range');
    ok(Boolean(screen.querySelector('.empty .empty-title')),
       '🚨 and gets an empty state rather than a blank pane — a month of empty boxes is the thing '
       + 'Tim asked to remove, and nothing at all reads as a screen that failed');
    ok(/fills in as you train|fills in its day/i.test(screen.textContent),
       '⚠️ saying what would fill it, in the app\'s own words');
    ok(!screen.querySelector('.mchart'),
       '⚠️ and no chart over it — five months of recordings is the floor and this has none');
    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
  }
  {
    await log(monthBack(4));
    const screen = await mount(CalendarView());
    await toMonths(screen);
    const blocks = [...screen.querySelectorAll('.cal-month')];
    ok(blocks.length === 1 && !blocks[0].classList.contains('is-empty'),
       `🚨 ONE recording draws exactly one month — first and last are the same month, and the four `
       + `months of nothing between it and today are not part of the history (${blocks.length})`);
    ok(blocks[0] && blocks[0].dataset.landed === 'true',
       '⚠️ and the landing aims at it, being the only month there is');
    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
    await store.clearAll();
  }

  /* ---- 3. FIVE months of recordings is not enough for a chart ----
     Tim's threshold is "more than 5", so five is the case that must NOT draw.
     Asserted before the six-month case, because "the chart appears" is
     satisfiable by a chart that always appears. */
  {
    for (const n of [0, 1, 2, 3, 4]) await log(monthBack(n));
    const screen = await mount(CalendarView());
    await toMonths(screen);
    ok(!screen.querySelector('.mchart'),
       '🛑 five months of recordings draws NO bar chart — Tim: "more than 5 months"');
    ok(screen.querySelectorAll('.cal-month').length > 0,
       'and the months themselves are still there, so the absence is the chart and not the screen');
    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
    await store.clearAll();
  }

  /* ---- 4. SIX months draws it, and it draws the right thing ---- */
  {
    // Six months WITH something, and a deliberate hole at two months back so a
    // gap has something to be. Two days in month 5 — one of them logged twice —
    // so the y-axis maximum is 2 and "days, not sessions" has a case.
    for (const n of [0, 1, 3, 4, 5, 6]) await log(monthBack(n));
    await log(sameMonth(5, 6));
    await log(monthBack(5));

    const screen = await mount(CalendarView());
    await toMonths(screen);

    const chart = screen.querySelector('.mchart');
    ok(Boolean(chart), '🚨 six months of recordings draws the bar chart');
    ok(chart && /DAYS TRAINED EACH MONTH/i.test(chart.textContent),
       'under a heading naming what the y-axis counts');

    const slots = [...chart.querySelectorAll('.mchart-bars .mchart-slot')];
    /* ⚠️ SEVEN COLUMNS FOR SIX MONTHS OF TRAINING. The x-axis is TIME, evenly
       spaced, so the hole two months back has to occupy its own place: dropping
       it would put three-months-ago next to one-month-ago and draw a
       continuous run over a history that stopped. */
    ok(slots.length === 7,
       `🚨 seven columns — the six months with something PLUS the empty one between them, because `
       + `the x-axis is time and a gap has to read as a gap (${slots.length})`);
    const zeros = [...chart.querySelectorAll('.mchart-bar.is-zero')];
    ok(zeros.length === 1,
       `⚠️ exactly one of them is a ZERO column rather than a missing one (${zeros.length})`);
    ok(slots[4] && slots[4].querySelector('.mchart-bar.is-zero'),
       '🚨 and it is in the right PLACE — fifth of seven, which is two months back — so the gap '
       + 'sits where the silence actually was');

    /* 🔄 LEADING EMPTY MONTHS ARE TRIMMED, AND SINCE 2026-09-16 THE LIST BELOW
       IS TRIMMED WITH THEM — ~~`monthRange` always reaches back twelve months,
       so without the trim this chart would open on five zero columns before the
       first thing ever recorded~~. The reason is unchanged and was first written
       down on the chart: months before the first recording are not a gap in
       training, there was no history yet. What changed is WHO trims — the range
       is computed once and handed to both. */
    /* 🛑 ~~`ok(slots.length < 12, 'the months BEFORE the first recording are not
       drawn at all … (N columns, not 12)')`~~ DROPPED 2026-09-16, and dropped
       rather than rewritten. It read "fewer than the twelve `monthRange` always
       reaches back", and `monthRange` does not reach back twelve months any
       more — the bound is gone, so the number 12 in it means nothing. Under a
       mutation that widened the range by five months it "failed" only because 12
       is not < 12, and its own message read "(12 columns, not 12)". The claim it
       was making is pinned exactly, and by construction, three assertions above
       (seven columns for a seven-month range) and in sections 2 and 2b (exactly
       three months, exactly one month). An assertion that no longer says what it
       claims to say is worse than no assertion. */
    /* 🚨 ONE RANGE, NOT TWO THAT AGREE TODAY. Until 2026-09-16 the chart trimmed
       its own leading months while the list drew every month it was given; the
       moment those two rules differed by a month, the chart's left-hand column
       would name a month with no row under it. Asserting COLUMN-FOR-BLOCK is the
       only shape of check that catches them drifting apart, and it is why the
       trim moved into `monthRange` rather than being copied. */
    ok(slots.length === screen.querySelectorAll('.cal-month').length,
       `🚨 and there is exactly one column per month block underneath — one range, computed once `
       + `(${slots.length} columns, ${screen.querySelectorAll('.cal-month').length} months)`);
    {
      const firstBlock = screen.querySelector('.cal-month .cal-title');
      const label = (chart.querySelector('.mchart-plot').getAttribute('aria-label') || '');
      ok(firstBlock && new RegExp(`, ${firstBlock.textContent} to `).test(label),
         `⚠️ and the chart's reading OPENS on the same month the list opens on `
         + `(${firstBlock && firstBlock.textContent})`);
    }

    /* 🚨 THE Y-AXIS COUNTS DAYS, NOT SESSIONS — the same rule `daysLabel` states
       over the year grid, and the reason is the same: a day with two workouts is
       ONE square there, so it has to be one unit of bar here or the chart stops
       describing the picture underneath it. Month 5 holds three sessions across
       two days; the maximum is 2. */
    const ticks = [...chart.querySelectorAll('.mchart-tick')].map((t) => t.textContent);
    ok(ticks.join('|') === '2|0',
       `🚨 the y-axis tops out at 2 — month five holds THREE sessions on TWO days, and the axis `
       + `counts the days (${ticks.join('|')})`);

    /* 🚨 ONE role="img" WITH THE WHOLE READING ON IT — the shape year-grid.js
       settled on, and the reason there is no number printed over every bar. */
    const plot = chart.querySelector('.mchart-plot');
    const label = (plot && plot.getAttribute('aria-label')) || '';
    ok(plot && plot.getAttribute('role') === 'img',
       '🚨 the plot is a single picture with one label, not seven focus stops announcing a number '
       + 'with no scale beside it');
    ok(new RegExp(`${monthName(2)}: 0`).test(label),
       `🚨 and the reading names the empty month and its zero (looking for "${monthName(2)}: 0") — `
       + 'the exact figures live here, which is what lets the bars carry no numerals');
    /* ⚠️ THE YEAR IS OPTIONAL IN THIS PATTERN, and that is the reading's own
       rule rather than slack in the assertion: the reading prints a year only
       where the year CHANGES, exactly as the visible axis labels it. An earlier
       version of this line demanded "Apr 2026: 2" and failed against a correct
       chart — the assertion was wrong, not the code. */
    ok(new RegExp(`${monthName(5)}( \\d{4})?: 2`).test(label),
       `⚠️ and the two-day month reads 2 (looking for "${monthName(5)}: 2")`);
    ok((label.match(/: \d/g) || []).length === 7,
       `⚠️ with one figure per column and no column left out (${(label.match(/: \d/g) || []).length})`);

    /* 🛑 NO VERDICT AND NO TREND (Rule 6). It reports what was recorded; whether
       that is good, improving or slipping is not something this app knows. */
    ok(!/\b(best|worst|improv|better|worse|slipp|streak|trend|on track|behind)\b/i.test(chart.textContent),
       '🛑 and it passes no verdict of any kind — no best month, no trend, no arrow');
    ok(!chart.querySelector('svg') && !chart.querySelector('.mchart-trend'),
       '🛑 nor draws a trend line');

    /* ⚠️ IT IS A READING OF THE MONTHS VIEW, so it goes when the months go.
       Years already shows the whole history at a glance; a second summary over
       it would be two pictures of one claim. */
    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
    ok(!screen.querySelector('.mchart'),
       '🚨 and it is a MONTHS-view chart — switching to Years takes it away with the month blocks, '
       + 'because Years is already a picture of the whole history');
    segs(screen).find((b) => b.textContent === 'Months').click();
    for (let i = 0; i < 3; i++) await settle();
    ok(Boolean(screen.querySelector('.mchart')),
       'and comes back with them, painted in place rather than rebuilt around');

    /* ⚠️ AND IT SITS ABOVE THE MONTHS, which is the only position from which it
       is a summary of the list rather than a second header on the screen. */
    const host = screen.querySelector('.pane-scroll');
    ok(host && host.firstElementChild && host.firstElementChild.classList.contains('mchart'),
       '⚠️ above the months rather than under them');
    ok(host && [...host.children].filter((c) => c.classList.contains('cal-month')).length > 0
       && host.lastElementChild.classList.contains('cal-month'),
       '⚠️ and the LAST child is still a month, so `landOnCurrentMonth` still has a month to pad');

    segs(screen).find((b) => b.textContent === 'Years').click();
    await settle();
  }
  await store.clearAll();
}

/* ==================================================================
 * AND ON A FRIEND'S CALENDAR THE Y-AXIS SAYS PUBLISHED — 2026-09-16
 *
 * 🚨 The third place this rule is applied in this file, not the first:
 * `publishedDaysLabel` and "N days published" beside each year already say it.
 * Their document holds their most recent sixty sessions, so a bar of 12 is
 * twelve days they SHARED and the whole chart is bounded by sixty however much
 * they trained — a count of publishing printed under the name of training
 * (direction.md §3.1).
 * ================================================================== */
{
  const { FriendView } = await import(BASE + 'views-social.js');
  const { social, todayISO } = await import(BASE + 'store.js');
  sessionStorage.removeItem('ftrack:v1:demo');

  const keep = {
    state: social.state, friend: social.friend, invites: social.invites,
    handoffs: social.handoffs, requests: social.requests,
    healConnectionName: social.healConnectionName,
    processDisconnects: social.processDisconnects,
    processAcceptedRequests: social.processAcceptedRequests,
  };
  social.invites = async () => [];
  social.handoffs = async () => [];
  social.requests = async () => [];
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;
  social.state = async () => ({
    available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim',
    shareBodyWeight: false, visibility: 'private',
    connections: [{ uid: 'u2', name: 'Autumn', since: '2026-08-01' }],
  });

  const monthBack = (n) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - n, 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`;
  };
  // Seven months with something: over five, so their page earns a chart too.
  const dates = [todayISO(), ...[1, 2, 3, 4, 5, 6].map(monthBack)];
  social.friend = async () => ({
    audience: 'friends',
    doc: {
      audience: 'friends', isPublic: false,
      profile: { name: 'Autumn' },
      activity: dates.map((date, i) => ({
        id: `mc${i}`, date, name: 'Pull', startedAt: `${date}T09:00:00.000Z`,
        entries: [{ exerciseId: 'lat-pulldown', name: 'Lat Pulldown',
          sets: [{ weight: 120, reps: 10 }] }],
      })),
      benchmarks: [],
      strength: { muscles: [], grid: {}, defaultCompare: 'lifters|male|own|own' },
    },
  });

  /* 🔄 REACHED THROUGH THEIR PROFILE SINCE 2026-09-16 — the Calendar segment
     left their data panel the same day (Tim: *"because calendar is now shown in
     the profile menu, remove it as a tab in the 'view data' section"*). The
     chart is a reading of the Months view wherever the Months view is, so the
     assertions are unchanged and only the route to them moved. */
  const fr = await mount(FriendView('u2'));
  for (let i = 0; i < 14; i++) await settle();
  [...fr.querySelectorAll('.cal-modes .seg')].find((b) => b.textContent === 'Months').click();
  for (let i = 0; i < 4; i++) await settle();

  const chart = fr.querySelector('.mchart');
  ok(Boolean(chart), 'a friend with seven months of published sessions gets the chart too');
  ok(chart && /DAYS PUBLISHED EACH MONTH/i.test(chart.textContent),
     '🚨 and its y-axis counts what they PUBLISHED — sixty sessions is a window, so a bar drawn '
     + 'under the name of training would be a count of one quantity wearing the name of another');
  {
    const plotNode = chart.querySelector('.mchart-plot');
    const label = plotNode ? plotNode.getAttribute('aria-label') : '';
    ok(/published/.test(label) && !/trained/.test(label),
       '⚠️ including the reading a screen reader is given — the visible heading and the accessible '
       + 'name are the same claim, or one of them is a lie');
  }
  /* 🚨 THE GUARD THAT CANNOT BE FOOLED, and it is the shape the friend block
     above already uses: the words appear NOWHERE on their page, so wiring the
     owner's wording back in by accident is caught wherever it happens. */
  ok(!/days trained|day trained/.test(fr.textContent.replace(/\s+/g, ' ')),
     '🚨 and "days trained" still appears nowhere at all on their page, chart included');
  /* ⚠️ Their cells were inert before this change and still are — a chart drawn
     above them must not have handed the collapse a reason to build buttons. */
  {
    const cells = [...fr.querySelectorAll('.cal-cell')].filter((c) => !c.classList.contains('blank'));
    ok(cells.length > 0 && cells.every((c) => c.tagName.toLowerCase() !== 'button'),
       `⚠️ and not one of their day cells became a button (${cells.length} cells)`);
  }
  [...fr.querySelectorAll('.cal-modes .seg')].find((b) => b.textContent === 'Years').click();
  await settle();

  Object.assign(social, keep);
  await store.clearAll();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

