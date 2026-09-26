// Suggested warm-up sets (2026-09-26).
//
//   node tests/warmup.test.mjs      (the second half needs jsdom, like render.test.mjs)
//
// Tim: *"For heavy sets. make a suggested program for warming up to that set
// automatically … Make the warmup sets automatically appear and if the user
// changes the weight for the first set, then automatically adjust the warmup
// sets in real time."*
//
// Part 1 pins the pure ramp in js/warmup.js. Part 2 drives the real runner in
// jsdom: the rows appear, follow set 1 live, never clobber a row the user
// typed into, and never count as work.

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { warmupKind, warmupRamp, generalWarmup, WARMUP_MAX_SETS } = await import(BASE + 'warmup.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const ramp = (name, weight, reps, unit = 'lbs') => warmupRamp({ exercise: byName(name), weight, reps, unit });
const show = (r) => r.map((s) => `${s.weight}x${s.reps}`).join(', ') || 'none';
const rising = (r) => r.every((s, i) => i === 0 || s.weight > r[i - 1].weight);
const repsFalling = (r) => r.every((s, i) => i === 0 || s.reps <= r[i - 1].reps);

/* ============ 1. the pure ramp ============ */

// Tim's own example, 225 x 4 back squat.
{
  const r = ramp('Back Squat', 225, 4);
  ok(r.length === 4, `225 x 4 back squat gets four warm-up sets (${show(r)})`);
  ok(r[0] && r[0].weight === 45 && r[0].reps === 10, 'the first is the empty bar for 10');
  ok(rising(r) && repsFalling(r), 'weights rise and reps fall, so the warm-up does not tire you');
  ok(r.every((s) => s.weight % 5 === 0), 'every weight is loadable in 5 lb steps');
  const top = r[r.length - 1];
  ok(top.weight >= 0.75 * 225 && top.weight <= 0.82 * 225, `the last one is about 80 % of the working weight (${top.weight})`);
  ok(top.reps <= 4, 'and it is no more reps than the working set');
}

// Lighter, and light enough to need nothing.
{
  const b = ramp('Barbell Bench Press', 135, 8);
  ok(b.length === 3 && b[0].weight === 45, `135 x 8 bench: three sets from the bar (${show(b)})`);
  const light = ramp('Back Squat', 65, 8);
  ok(light.length === 1 && light[0].weight === 45 && light[0].reps === 10, `65 lb squat: just the empty bar for 10 (${show(light)})`);
  ok(ramp('Back Squat', 45, 10).length === 0, 'a working set AT the empty bar needs no warm-up set');
  ok(ramp('Back Squat', 0, 5).length === 0 && ramp('Back Squat', NaN, 5).length === 0,
     'no working weight, no ramp — nothing is guessed');
}

// More weight, more sets — and a cap.
{
  const counts = [95, 135, 185, 225, 315, 405, 600].map((w) => ramp('Deadlift', w, 5).length);
  ok(counts.every((n, i) => i === 0 || n >= counts[i - 1]), `the count never falls as the weight rises (${counts})`);
  ok(Math.max(...counts) === WARMUP_MAX_SETS, `and tops out at ${WARMUP_MAX_SETS}`);
  const heavy = ramp('Deadlift', 600, 5);
  ok(rising(heavy) && heavy.every((s) => s.weight < 600), `600 lb deadlift ramp is sane (${show(heavy)})`);
}

// Rep range changes the top and the count.
{
  const single = ramp('Back Squat', 315, 1);
  const top = single[single.length - 1];
  ok(top.weight > 0.8 * 315 && top.weight <= 0.86 * 315, `a heavy single climbs to ~85 % (${show(single)})`);
  ok(top.reps <= 2, 'with the top warm-up at 2 reps or fewer');
  ok(single.every((s) => s.reps >= 1) && repsFalling(single), 'and reps still falling all the way');
  ok(ramp('Back Squat', 225, 15).length < ramp('Back Squat', 225, 4).length,
     'a 15-rep set gets fewer warm-ups than a 4-rep set at the same weight');
}

// Kilograms.
{
  const r = ramp('Back Squat', 100, 5, 'kg');
  ok(r.length >= 3 && r[0].weight === 20, `100 kg squat starts at the 20 kg bar (${show(r)})`);
  ok(r.every((s) => Math.abs(s.weight / 2.5 - Math.round(s.weight / 2.5)) < 1e-9), 'every weight is a 2.5 kg step');
  ok(ramp('Back Squat', 20, 8, 'kg').length === 0, 'a 20 kg squat needs nothing');
}

// Dumbbells and machines.
{
  const d = ramp('Dumbbell Bench Press', 80, 8);
  ok(d.length >= 2 && d.length <= 3, `80 lb dumbbells: two or three sets (${show(d)})`);
  ok(d.every((s) => s.weight % 5 === 0 && s.weight >= 5), 'on real dumbbells, 5 lb steps');
  ok(d[0].weight < 45, 'and it does not start at a barbell');
  const dk = ramp('Dumbbell Bench Press', 30, 8, 'kg');
  ok(dk.every((s) => s.weight % 2 === 0), `kg dumbbells in 2 kg steps (${show(dk)})`);
  const lp = ramp('Leg Press', 400, 10);
  ok(lp.length === 3 && lp.every((s) => s.weight % 5 === 0) && rising(lp), `400 lb leg press: three sets (${show(lp)})`);
  const pd = ramp('Lat Pulldown', 120, 10);
  ok(pd.length === 2, `120 lb pulldown: two sets (${show(pd)})`);
}

// Who gets none.
{
  for (const n of ['Dumbbell Curl', 'Leg Extension', 'Lateral Raise', 'Triceps Pushdown', 'Push-Up',
    'Pull-Up', 'Assisted Pull-Up', 'Plank', 'Kettlebell Swing', 'Standing Calf Raise']) {
    const e = byName(n);
    if (!e) { ok(false, `fixture: ${n} is a library exercise`); continue; }
    ok(warmupKind(e) === null && warmupRamp({ exercise: e, weight: 200, reps: 5, unit: 'lbs' }).length === 0,
       `${n}: no warm-up sets`);
  }
  ok(warmupKind(null) === null && warmupRamp({ exercise: null, weight: 200, reps: 5 }).length === 0,
     'an exercise missing from the library gets none, and does not throw');
  for (const n of ['Back Squat', 'Deadlift', 'Barbell Bench Press', 'Overhead Press', 'Barbell Row',
    'Leg Press', 'Romanian Deadlift', 'Dumbbell Bench Press', 'Lat Pulldown']) {
    ok(warmupKind(byName(n)) !== null, `${n}: gets warm-ups`);
  }
}

// Every exercise the app would warm up gives a sane ramp at any weight.
{
  const bad = [];
  for (const e of BUILT_IN_EXERCISES) {
    if (!warmupKind(e)) continue;
    for (const w of [30, 60, 100, 150, 250, 400]) {
      for (const reps of [1, 5, 10, 20]) {
        const r = warmupRamp({ exercise: e, weight: w, reps, unit: 'lbs' });
        if (!rising(r) || r.some((s) => !(s.weight > 0) || s.weight >= w || !(s.reps >= 1))
          || r.length > WARMUP_MAX_SETS) bad.push(`${e.name} ${w}x${reps}: ${show(r)}`);
      }
    }
  }
  ok(bad.length === 0, `every eligible exercise: rising, lighter than the set, 1+ reps (${bad.slice(0, 3).join('; ') || 'all sane'})`);
}

// The general line.
{
  const g = generalWarmup(byName('Back Squat'));
  ok(/Dynamic stretch/.test(g || '') && /10 air squats/.test(g || ''), `squat: "${g}"`);
  ok(/push-ups/.test(generalWarmup(byName('Barbell Bench Press')) || ''), 'bench: push-ups');
  ok(generalWarmup(byName('Dumbbell Curl')) === null, 'nothing for an exercise that gets no warm-up');
}

/* ============ 2. in the runner (jsdom) ============ */
let JSDOM = null;
try { ({ JSDOM } = await import('jsdom')); } catch (_) { /* reported below */ }
ok(Boolean(JSDOM), 'jsdom is installed, so the runner half runs (npm i --no-save jsdom jsqr @firebase/rules-unit-testing)');
if (JSDOM) {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/#/home', pretendToBeVisual: true,
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
  const sess = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (sess.has(k) ? sess.get(k) : null),
    setItem: (k, v) => sess.set(k, String(v)),
    removeItem: (k) => sess.delete(k),
  };

  const { store } = await import(BASE + 'store.js');
  const { SessionView } = await import(BASE + 'views-session.js');
  const { loadDraft, clearDraft, draftRecordedSets } = await import(BASE + 'session-draft.js');
  const settle = () => new Promise((r) => setTimeout(r, 30));
  const app = () => document.getElementById('app');
  const type = (n, v) => { n.value = String(v); n.dispatchEvent(new window.Event('blur', { bubbles: false })); };
  const click = (n) => n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  async function mount(viewPromise) {
    const node = await viewPromise;
    app().replaceChildren(node);
    await settle(); await settle();
    return node;
  }

  clearDraft();
  await store.clearAll();
  const w = await store.saveWorkout({
    name: 'Squat day',
    exercises: [
      { exerciseId: byName('Back Squat').id, sets: 3, notes: '' },
      { exerciseId: byName('Dumbbell Curl').id, sets: 2, notes: '' },
    ],
  });
  const run = await mount(SessionView(w.id));
  const rows = () => [...run.querySelectorAll('.set-list .set-item')];
  const warmRows = () => rows().filter((r) => r.classList.contains('set-warm'));
  const workRows = () => rows().filter((r) => !r.classList.contains('set-warm'));
  const warmText = () => warmRows().map((r) => r.querySelector('.set-vals').textContent.replace(/\s+/g, ' ').trim());
  const entry0 = () => { const e = loadDraft().entries[0]; return { ...e, warmups: e.warmups || [] }; };

  ok(warmRows().length === 0, 'a squat with no weight yet shows no warm-ups — nothing to ramp to');

  const weightBox = run.querySelector('.set-open .step-value');
  type(weightBox, 225); await settle();
  type(run.querySelectorAll('.set-open .step-value')[1], 4); await settle();
  ok(warmRows().length === 4, `typing 225 x 4 into set 1 brings four warm-ups up (${warmText().join(' | ')})`);
  ok(/^45 lbs × 10$/.test(warmText()[0] || ''), `the first reads the empty bar for 10 ("${warmText()[0]}")`);
  ok(rows()[0] === warmRows()[0] && workRows()[0].querySelector('.set-num').textContent === '1',
     'they sit above set 1, which is still set 1');
  ok(weightBox.isConnected && workRows()[0].contains(weightBox),
     '🚨 the weight box being typed in is the SAME node afterwards — the list was not rebuilt under the thumb');
  ok(entry0().warmups.length === 4 && entry0().sets[0].weight === 225,
     'the draft holds them in `warmups`, set 1 still holds 225');
  ok(draftRecordedSets(loadDraft()) === 1,
     '🚨 the discard warnings count ONE set — the four suggested warm-ups are not sets');

  type(weightBox, 135); await settle();
  ok(warmRows().length === 3 && /^45 lbs/.test(warmText()[0]),
     `changing set 1 to 135 re-plans them live (${warmText().join(' | ')})`);
  type(weightBox, 45); await settle();
  ok(warmRows().length === 0, 'down to the empty bar: they go away');
  type(weightBox, 225); await settle();
  ok(warmRows().length === 4, 'and back up at 225');

  // Edit the second warm-up: that row is the user's now.
  click(warmRows()[1].querySelector('.set-vals'));
  await settle();
  type(run.querySelector('.set-open .step-value'), 100); await settle();
  ok(entry0().warmups[1].weight === 100, 'a warm-up can be typed into');
  click(workRows()[0].querySelector('.set-vals'));
  await settle();
  type(run.querySelector('.set-open .step-value'), 315); await settle();
  const after = entry0().warmups;
  ok(after[1].weight === 100, '🚨 a warm-up the user typed is NOT overwritten when set 1 changes');
  ok(after[0].weight === 45 && after[after.length - 1].weight > 225,
     `the untouched ones still follow set 1 (${after.map((x) => x.weight).join(', ')})`);

  // Delete one: the rest stop moving.
  const before = entry0().warmups.map((x) => x.weight).join(',');
  warmRows()[0].querySelector('.set-del').click(); await settle();
  const kept = entry0().warmups.map((x) => x.weight).join(',');
  const closed = workRows()[0].querySelector('.set-vals');
  if (closed) { click(closed); await settle(); }
  ok(workRows()[0].contains(run.querySelector('.set-open .step-value')), 'set 1 is the open row');
  type(run.querySelector('.set-open .step-value'), 405); await settle();
  ok(entry0().warmups.length === before.split(',').length - 1
     && entry0().warmups.map((x) => x.weight).join(',') === kept,
     'deleting a warm-up keeps it deleted and freezes the rest — they are the user\'s now');

  // An exercise that gets none.
  const next = [...run.querySelectorAll('button')].find((b) => /^Next/.test(b.textContent.trim()));
  if (next) { next.click(); await settle(); }
  const curlWeight = run.querySelector('.set-open .step-value');
  if (curlWeight) { type(curlWeight, 40); await settle(); }
  ok(Boolean(curlWeight) && /Curl/.test(run.querySelector('.session-ex-name').textContent) && warmRows().length === 0,
     'a dumbbell curl at 40 gets no warm-ups');

  // Save: warm-ups in their own list, numbers only.
  [...run.querySelectorAll('button')].find((b) => /Finish workout/.test(b.textContent)).click();
  await settle();
  const save = [...document.querySelectorAll('button')].find((b) => /^Save workout$/.test(b.textContent.trim()));
  if (save) save.click();
  await settle(); await settle();
  const saved = (await store.getSessions()).find((x) => x.workoutId === w.id);
  const sq = saved && saved.entries.find((e) => e.exerciseId === byName('Back Squat').id);
  ok(Boolean(sq) && Array.isArray(sq.warmups) && sq.warmups.length === 3,
     'the squat saved with its three warm-ups');
  ok(Boolean(sq) && sq.warmups.every((x) => Object.keys(x).every((k) => k === 'weight' || k === 'reps')),
     'a saved warm-up is its numbers only — no `auto` flag reaches storage');
  ok(Boolean(sq) && sq.sets.length === 1 && sq.sets[0].weight === 405,
     '🚨 and the sets are only the one set actually typed');
  const nested = (v) => Array.isArray(v) ? v.some((x) => Array.isArray(x) || nested(x))
    : (v && typeof v === 'object' ? Object.values(v).some(nested) : false);
  ok(Boolean(saved) && !nested(saved), 'no array inside an array anywhere in the saved session (Firestore refuses one)');
  clearDraft();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
