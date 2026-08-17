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

// Legend present, so level is never colour-alone. Seven levels, No data, and
// the note explaining the confidence fade — without that last one the fade is
// an unexplained visual and reads as a rendering fault.
ok(data.querySelectorAll('.lv-key-item').length === LEVELS.length + 2,
   'legend lists every level, No data, and the faded-means-less-sure note');
ok([...data.querySelectorAll('.lv-key-item')].some((n) => /less sure/i.test(n.textContent)),
   'and the fade is explained in words, not left as colour alone');

/* ================= tapping a muscle ================= */
chest.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await settle();
ok(/Chest/.test(data.textContent), 'tapping chest opens its detail');
// The comparison group is now the user's choice, so the caption is no longer one
// fixed string. The invariant it has to keep is the one that matters: whatever
// group is named, it is always a group of people who LIFT. Never the public.
ok(/who lifts?\b/i.test(data.textContent),
   'the caption names a population that lifts — never implies the general population');
ok(!/\d+% of (all )?(people|adults)\b(?! who)/i.test(data.textContent),
   'and never claims a percentile against people in general');
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
  ok(saved && saved.startedAt && saved.startedAt.slice(0, 10) === todayISO(),
     'startedAt still records when it was actually entered — the date moved, not the clock');
  ok(localStorage.getItem(DRAFT) === null, 'the draft is cleared once saved');

  // A draft genuinely left over from a previous day is still discarded.
  localStorage.setItem(DRAFT, JSON.stringify({
    workoutId: w.id, workoutName: w.name, date: past, startedOn: '2020-01-01',
    startedAt: '2020-01-01T10:00:00Z', index: 0, entries: [],
  }));
  const fresh = await mount(SessionView(w.id));
  ok(fresh.querySelector('.session-date').value === todayISO(),
     'yesterday\'s abandoned draft is still dropped, and the new one is for today');
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
  ok(!escapeBtn.hidden, 'a cancelled sign-in reveals the way through, rather than doing nothing');
  ok(!gBtn.disabled, 'and leaves the button usable rather than stuck on "Opening…"');

  escapeBtn.click();
  await settle(); await settle();
  ok(calls.length === 2 && calls[1].forceRedirect === true,
     'the fallback forces the redirect route, which no popup blocker can stop');

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

/* ================= the rest timer ================= */
{
  const { SessionView } = await import(BASE + 'views-session.js');
  const DRAFT = 'ftrack:v1:draftSession';
  localStorage.removeItem(DRAFT);

  const rw = await store.saveWorkout({
    name: 'Rest test',
    exercises: [{ exerciseId: byName('Barbell Bench Press').id, sets: 2, notes: '' }],
  });
  const s = await mount(SessionView(rw.id));

  const bar = s.querySelector('.rest-bar');
  ok(Boolean(bar), 'the session has a rest timer');
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
  await store.saveSettings({ restTarget: 0 });
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
