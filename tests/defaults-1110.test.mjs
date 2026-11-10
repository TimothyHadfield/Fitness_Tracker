// The five Waiting-on-Tim defaults, built 2026-11-10 (Tim: "Build those now").
//
//   node tests/defaults-1110.test.mjs      (needs jsdom, like misc-fix-w4.test.mjs)
//
//   si-a  sign-out clears the unfinished workout draft (a failed one keeps it)
//   si-b  the guest "Add to Home Screen" lines say to secure the account first
//   si-c  a "did you mean gmail.com?" hint under the sign-up email, tap to fix
//   8     Record lists benchmark workouts from every program, labelled, once
//   fb    (the rules half is in tests/rules.test.mjs, under the emulator)
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

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
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['en-US'], language: 'en-US', userAgent: 'node' }, configurable: true,
});
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

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const src = (f) => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');

const BASE = new URL('../js/', import.meta.url).href;
const S = await import(BASE + 'store.js');
const { store, auth, todayISO } = S;
const { saveDraft, loadDraft, clearDraft } = await import(BASE + 'session-draft.js');
const { StartPickerView } = await import(BASE + 'views-workouts.js');
const A = await import(BASE + 'views-account.js');
const F = await import(BASE + 'first-save.js');

/* ============ si-a: sign-out clears the draft ============ */
{
  const today = todayISO();
  const draft = () => saveDraft({ workoutId: 'w1', workoutName: 'Legs', date: today, startedOn: today,
    startedAt: new Date().toISOString(),
    entries: [{ exerciseId: 'squat', fields: ['weight', 'reps'], sets: [{ weight: 225, reps: 5 }] }] });
  const hook = typeof S.__setRemoteForTest === 'function';
  ok(hook, 'store exposes a test stand-in for the cloud backend');
  if (hook) {
    draft();
    ok(loadDraft() && loadDraft().workoutId === 'w1', '(guard) a draft with a recorded set is on disk');
    S.__setRemoteForTest({ signOut: async () => ({ uid: 'guest', isAnonymous: true }) });
    await auth.signOut();
    ok(loadDraft() === null, 'signing out clears the unfinished workout draft');

    draft();
    S.__setRemoteForTest({ signOut: async () => { throw new Error('offline'); } });
    let threw = false;
    try { await auth.signOut(); } catch (_) { threw = true; }
    ok(threw && loadDraft() && loadDraft().workoutId === 'w1', 'a sign-out that fails keeps the draft');
    S.__setRemoteForTest(null);
    clearDraft();
  }
  const acct = src('views-account.js');
  ok(/The unfinished workout on this device is discarded\./.test(acct)
     && /draftRecordedSets\(liveDraft\(todayISO\(\)\)\)/.test(acct),
     'the Sign out sheet says the unfinished workout goes, only when it has sets');
}

/* ============ si-b: secure the account first ============ */
{
  ok(/^Secure your account first/.test(F.NUDGE.ios), `the first-save iOS line starts "Secure your account first" (${F.NUDGE.ios})`);
  ok(/Add to Home Screen/.test(F.NUDGE.ios), 'and still says how to add it');
  ok(F.NUDGE.ios.trim().split(/\s+/).length <= 15, 'under 15 words, like every nudge line');
  const acct = src('views-account.js');
  ok(/'Secure your account first, then Add to Home Screen so your iPhone keeps your data'/.test(acct),
     'the Account screen\'s guest hint says to secure first');
  ok(/it starts empty: sign in there to bring your data/.test(acct), 'and its ? says the Home Screen app starts empty');
}

/* ============ si-c: email typo hint ============ */
{
  const fix = A.suggestEmailFix;
  ok(typeof fix === 'function', 'views-account exports suggestEmailFix()');
  if (typeof fix === 'function') {
    const cases = [
      ['tim@gmial.com', 'tim@gmail.com'], ['tim@gmai.com', 'tim@gmail.com'], ['tim@gmal.com', 'tim@gmail.com'],
      ['a.b@hotmial.com', 'a.b@hotmail.com'], ['x@yahooo.com', 'x@yahoo.com'], ['x@outlok.com', 'x@outlook.com'],
      ['x@iclod.com', 'x@icloud.com'], ['x@gmail.con', 'x@gmail.com'], ['x@gmail.cmo', 'x@gmail.com'],
      ['x@gmial.con', 'x@gmail.com'], ['x@uvu.con', 'x@uvu.com'], ['x@gmail.co', 'x@gmail.com'],
      ['X@GMIAL.COM', 'X@gmail.com'],
    ];
    for (const [typed, want] of cases) ok(fix(typed) === want, `${typed} → ${want} (${fix(typed)})`);
    for (const fine of ['tim@gmail.com', 'a@hotmail.co.uk', 'a@yahoo.fr', 'a@uvu.edu', 'a@company.co', '', 'nope', 'a@', '@gmial.com'])
      ok(fix(fine) === null, `no hint for "${fine}"`);
  }
  // The live screen: anonymousScreen() is behind cloud auth, so the hint's own
  // wiring is pinned by source, and its behaviour by the helper above.
  const acct = src('views-account.js');
  ok(/el\('label', \{ text: 'Email' \}\), email, emailTypoHint\(email\)\)/.test(acct),
     'the sign-up email field carries the hint line');
  ok(/'Did you mean '/.test(acct) && /onClick: \(\) => \{ input\.value = fix;/.test(acct),
     'the hint reads "Did you mean …?" and a tap puts the fix in the field');
  ok(!/createBtn[\s\S]{0,400}suggestEmailFix/.test(acct), 'Create account never checks it: the hint never blocks');
}

/* ============ 8: benchmark workouts from every program ============ */
const app = () => document.getElementById('app');
async function mount(p) { const n = await p; app().replaceChildren(n); await settle(); return n; }
{
  clearDraft();
  await store.clearAll();
  const ppl = await store.saveSystem({ name: 'Push Pull Legs' });
  const ul = await store.saveSystem({ name: 'Upper Lower' });
  const ex = [{ exerciseId: 'Barbell Bench Press', sets: 3 }];
  await store.saveWorkout({ name: 'Push', systemId: ppl.id, exercises: ex });
  await store.saveWorkout({ name: 'PPL test day', systemId: ppl.id, exercises: ex, isBenchmark: true });
  await store.saveWorkout({ name: 'Upper', systemId: ul.id, exercises: ex });
  await store.saveWorkout({ name: 'Max day', systemId: ul.id, exercises: ex, isBenchmark: true });
  await store.setCurrentSystem(ppl.id);

  const pick = await mount(StartPickerView());
  const rows = [...pick.querySelectorAll('.row')];
  const named = (n) => rows.filter((r) => r.querySelector('.row-title') && r.querySelector('.row-title').textContent === n);
  ok(named('Push').length === 1, '(guard) the current program\'s workout is listed');
  ok(named('Upper').length === 0, '(guard) another program\'s ordinary workout is not');
  ok(named('Max day').length === 1, 'a benchmark workout in another program appears on Record');
  const sub = named('Max day')[0] && named('Max day')[0].querySelector('.row-sub').textContent;
  ok(/^Upper Lower · /.test(sub || ''), `labelled with its program (${sub})`);
  ok(named('PPL test day').length === 1, 'the current program\'s own benchmark is listed exactly once');
  ok([...pick.querySelectorAll('.section-label')].some((l) => l.textContent === 'Benchmark workouts'),
     'under a "Benchmark workouts" label');
  const was = location.hash;
  named('Max day')[0] && named('Max day')[0].click();
  await settle();
  const went = location.hash; location.hash = was;
  ok(/^#\/session\//.test(went), `tapping it starts that workout (${went})`);

  // Only one program: nothing extra.
  await store.clearAll();
  const one = await store.saveSystem({ name: 'Solo' });
  await store.saveWorkout({ name: 'Solo bench', systemId: one.id, exercises: ex, isBenchmark: true });
  await store.setCurrentSystem(one.id);
  const pick2 = await mount(StartPickerView());
  ok(![...pick2.querySelectorAll('.section-label')].some((l) => l.textContent === 'Benchmark workouts'),
     'with nothing in other programs there is no extra section');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
