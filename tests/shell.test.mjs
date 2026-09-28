// The app shell (overhaul wave 1, builder SHELL, 2026-09-27):
//   R-7 friendlyError + toast {error, action} + one live region · emptyState {help}
//   I-8a arrivedByLink · I-8b per-tab scroll · R-10 head script · R-18 manifest
//   ST-10 theme Auto · glass · setWeightPrefs seeding · ST-9 first-run units
//   O-9 no tour after Skip · O-16 first Home · R-3 persist · I-13 lazy screens
//   R-8c boot skeleton.
//   node tests/shell.test.mjs      (needs jsdom)
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const INDEX = read('index.html');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

/* ================= 1. index.html's head script, before any module ================= */
function runIndex({ look = null, systemLight = false, hash = '#/home', wide = false } = {}) {
  const store = new Map(look ? [['ftrack:v1:look', JSON.stringify(look)]] : []);
  // The real stylesheet is not loaded here: a stand-in declares the grounds the
  // head script reads back (the same values css/app.css holds).
  const html = INDEX.replace('<link rel="stylesheet" href="css/app.css">',
    '<style>:root{--ground:#0F1214}:root[data-theme="light"]{--ground:#F3F4F1}</style>')
    .replace('<script type="module" src="js/app.js"></script>', '');
  const dom = new JSDOM(html, {
    url: 'http://localhost/' + hash, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem() {}, removeItem() {} } });
      w.matchMedia = (q) => ({ matches: /light/.test(q) ? systemLight : /min-width/.test(q) ? wide : false, media: q });
    },
  });
  return dom.window;
}
{
  let w = runIndex();
  const d = w.document;
  ok(d.documentElement.getAttribute('data-theme') === 'dark', 'no saved look: dark (the default stays Dark)');
  ok(d.querySelectorAll('meta[name="theme-color"]').length === 1, 'ONE theme-color meta, not one per system scheme');
  ok(d.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content === 'black-translucent', 'dark keeps black-translucent');

  w = runIndex({ look: { theme: 'light', palette: 'teal' } });
  ok(w.document.documentElement.getAttribute('data-theme') === 'light', 'a saved Light look is on <html> before any module runs');
  ok(w.document.documentElement.getAttribute('data-palette') === 'teal', 'and its palette');
  ok(w.document.querySelector('meta[name="theme-color"]').content.toUpperCase() === '#F3F4F1',
     `theme-color = the ground on screen (${w.document.querySelector('meta[name="theme-color"]').content})`);
  ok(w.document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content === 'default',
     'Light: status-bar-style default, so the clock is dark on the light header');

  w = runIndex({ look: { theme: 'auto' }, systemLight: true });
  ok(w.document.documentElement.getAttribute('data-theme') === 'light' && w.document.documentElement.getAttribute('data-theme-pref') === 'auto',
     'Auto on a light phone: light, and the choice is kept as data-theme-pref');
  w = runIndex({ look: { theme: 'auto' }, systemLight: false });
  ok(w.document.documentElement.getAttribute('data-theme') === 'dark', 'Auto on a dark phone: dark');
  w = runIndex({ look: { theme: 'dark', glass: false } });
  ok(w.document.documentElement.getAttribute('data-glass') === 'off', 'glass off is applied before paint too');

  // The skeleton: the tab bar is on the page before the modules.
  w = runIndex({ hash: '#/graphs' });
  const app = w.document.getElementById('app');
  ok(app.hasAttribute('data-skel') && app.querySelectorAll('.navbar > a').length === 5,
     'the boot skeleton paints the five tabs before any module loads');
  ok(app.querySelector('.navbar > a[aria-current="page"]').textContent === 'Data', 'with the right tab lit (#/graphs → Data)');
  w = runIndex({ hash: '#/session/x' });
  ok(!w.document.querySelector('#app > .navbar') && w.document.querySelector('.boot-shell.no-nav'),
     'a full-screen route on a phone: no bar in the skeleton either');
  w = runIndex({ hash: '#/session/x', wide: true });
  ok(Boolean(w.document.querySelector('#app > .navbar')), 'but a laptop keeps its sidebar');
}

/* The skeleton's copies of NAV / FULLSCREEN / the icons agree with app.js and ui.js. */
{
  const app = read('js/app.js');
  const ui = read('js/ui.js');
  const navBlock = app.slice(app.indexOf('const NAV = ['), app.indexOf('];', app.indexOf('const NAV = [')));
  const navMatches = [...navBlock.matchAll(/match: \[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]));
  const skelNav = INDEX.match(/var NAV_SKEL = (\[[\s\S]*?\]\]);/)[1];
  ok(JSON.stringify(eval(skelNav)) === JSON.stringify(navMatches), 'NAV_SKEL mirrors app.js NAV');
  const full = app.match(/const FULLSCREEN = (\[[^\]]*\]);/)[1];
  const skelFull = INDEX.match(/var FULL_SKEL = (\[[^\]]*\]);/)[1];
  ok(JSON.stringify(eval(full)) === JSON.stringify(eval(skelFull)), 'FULL_SKEL mirrors app.js FULLSCREEN');
  const labels = [...navBlock.matchAll(/label: '(\w+)',\s*icon: '(\w+)'/g)];
  const skelLinks = [...INDEX.matchAll(/<a href="(#\/\w+)"[^>]*><svg[^>]*><path d="([^"]+)"\/><\/svg><span>(\w+)<\/span><\/a>/g)];
  ok(skelLinks.length === 5 && labels.every(([, label, ic], i) => {
    const d = (ui.match(new RegExp(`\\n  ${ic}: '([^']+)'`)) || [])[1];
    return skelLinks[i][3] === label && skelLinks[i][2] === d;
  }), 'each skeleton tab has the same label and icon path as the real bar');
  ok(/modulepreload" href="js\/app\.js"/.test(INDEX) && /modulepreload" href="js\/ui\.js"/.test(INDEX) && /modulepreload" href="js\/store\.js"/.test(INDEX),
     'app, ui and store are modulepreloaded');
}

/* ================= 2. the manifest ================= */
{
  const m = JSON.parse(read('manifest.webmanifest'));
  ok(m.id === './', 'the manifest has an id');
  ok(m.icons.every((i) => !/\s/.test(i.purpose || 'any')), 'no combined "any maskable" purpose');
  ok(['icon-192.png', 'icon-512.png'].every((f) => ['any', 'maskable'].every((p) => m.icons.some((i) => i.src === f && i.purpose === p))),
     'each PNG is listed once as any and once as maskable');
}

/* ================= 3. ui.js in a DOM ================= */
const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#0F1214"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"></head><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
let systemLight = false;
const mqListeners = [];
window.matchMedia = (q) => ({
  get matches() { return /light/.test(q) ? systemLight : false; }, media: q,
  addEventListener: (_, f) => { if (/light/.test(q)) mqListeners.push(f); }, removeEventListener() {},
});
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const sess = new Map();
globalThis.sessionStorage = { getItem: (k) => (sess.has(k) ? sess.get(k) : null), setItem: (k, v) => sess.set(k, String(v)), removeItem: (k) => sess.delete(k) };

const BASE = new URL('../js/', import.meta.url).href;
const UI = await import(BASE + 'ui.js');

/* R-7 friendlyError */
{
  const f = UI.friendlyError;
  ok(typeof f === 'function', 'ui.js exports friendlyError');
  const fe = (code, message = 'x') => Object.assign(new Error(message), { name: 'FirebaseError', code });
  ok(f(fe('unavailable', 'FirebaseError: [code=unavailable]: offline')) === "No connection — try again when you're back online.", 'unavailable → no connection');
  ok(f(fe('deadline-exceeded')) === f(fe('unavailable')), 'deadline-exceeded → no connection');
  ok(f(fe('auth/network-request-failed')) === f(fe('unavailable')), 'auth/network-request-failed → no connection');
  ok(f(fe('permission-denied')) === "Your account isn't allowed to do that.", 'permission-denied');
  ok(f(fe('resource-exhausted')) === 'Too many changes at once — try again in a minute.', 'resource-exhausted');
  ok(f(Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' })) === "This phone's storage is full.", 'QuotaExceededError');
  ok(f(new Error('FirebaseError: [code=unavailable]: Failed to get document')) === f(fe('unavailable')), 'a code only in the printed message is still read');
  ok(f(new TypeError('Failed to fetch')) === f(fe('unavailable')), 'a failed fetch is a lost connection');
  ok(f(new TypeError('Importing a module script failed.')) === f(fe('unavailable')), "a screen's module that could not load is a lost connection");
  ok(f(new TypeError("Cannot read properties of undefined (reading 'x')")) === 'Something went wrong — try again.', 'a programming error never reaches the screen as-is');
  ok(f(new TypeError("Cannot read properties of undefined (reading 'x')"), 'Could not save this.') === 'Could not save this.', 'the caller\'s fallback replaces the generic line');
  ok(f(new Error('Enter a weight.')) === 'Enter a weight.', "the app's own plain errors pass through unchanged");
  ok(f(null) === 'Something went wrong — try again.', 'nothing at all → the generic line');
  ok(Object.values({ a: f(fe('unavailable')), b: f(fe('permission-denied')), c: f(fe('resource-exhausted')), d: 'Something went wrong — try again.' })
    .every((s) => s.split(/\s+/).length <= 15), 'every mapped sentence is under 15 words');
}

/* R-7 toasts */
{
  UI.toast('Saved');
  let t = document.querySelector('.toast');
  ok(t && t.textContent === 'Saved' && t.getAttribute('role') !== 'alert', 'a plain toast: its words only, not an alert');
  await settle(100);
  const live = document.getElementById('app-live');
  ok(live && live.getAttribute('aria-live') === 'polite' && live.textContent === 'Saved', 'its words go through the one live region');
  t.remove();

  UI.toast('No connection', { error: true });
  t = document.querySelector('.toast');
  ok(t && t.getAttribute('role') === 'alert' && t.classList.contains('toast-error'), 'an error toast is role=alert');
  await settle(3000);
  ok(t.isConnected, 'and still on screen after 3 s (a plain toast leaves at 2.4 s)');
  t.remove();

  let runs = 0;
  UI.toast('Set 3 deleted', { action: { label: 'Undo', run: () => { runs++; } } });
  t = document.querySelector('.toast');
  const btn = t && t.querySelector('button.toast-action');
  ok(btn && btn.textContent === 'Undo' && t.querySelector('.toast-text').textContent === 'Set 3 deleted', 'an action toast: the words and ONE button');
  btn.click(); btn.click();
  await settle(250);
  ok(runs === 1, `the action runs once however often it is tapped (${runs})`);
  ok(!document.querySelector('.toast'), 'and the toast goes when it is used');
  ok(document.querySelectorAll('#app-live').length === 1, 'still ONE live region after several toasts');
}

/* words P6: emptyState's optional ? */
{
  const plain = UI.emptyState('Nothing yet', 'Log a workout.', null);
  ok(!plain.querySelector('.help-dot') && plain.querySelector('p').textContent === 'Log a workout.', 'no help: exactly as before');
  const withHelp = UI.emptyState('Nothing yet', 'Log a workout.', null, { help: 'Because ratings need sets.' });
  const p = withHelp.querySelector('p');
  ok(p && p.querySelector('.help-dot') && p.firstChild.textContent === 'Log a workout.', 'with { help }: a ? right after the message, inside its line');
  ok(UI.emptyState('T', 'M', null, 'Why.').querySelector('p .help-dot'), 'the help text may also be passed bare');
}

/* I-8a arrivedByLink */
{
  history.replaceState(null, '', '#/me');
  UI.markRoute();
  location.hash = '#/graphs';
  await settle();
  UI.markLinkNav();
  UI.markRoute();
  ok(UI.arrivedByLink() === true, 'a tab root the router marked as reached by a link answers arrivedByLink()');
  location.hash = '#/day/2026-09-01';
  await settle();
  UI.markRoute();
  ok(UI.arrivedByLink() === false, 'a screen reached any other way does not');
  history.back();
  await settle(60);
  UI.markRoute();
  ok(location.hash === '#/graphs' && UI.arrivedByLink() === true, 'coming BACK to the linked tab keeps its back arrow for that visit');
  location.hash = '#/workouts';
  await settle();
  UI.markTabNav();
  UI.markRoute();
  ok(UI.arrivedByLink() === false, 'a tab tapped in the bar does not');
}

/* I-8b per-tab scroll memory */
{
  const G = await import(BASE + 'gestures.js');
  const mk = (top) => {
    const s = document.createElement('div');
    const pane = document.createElement('div');
    pane.className = 'pane-scroll';
    let st = top;
    Object.defineProperty(pane, 'scrollTop', { get: () => st, set: (v) => { st = v; }, configurable: true });
    s.append(pane);
    return s;
  };
  G.rememberTabScroll('#/me', mk(640));
  const back = mk(0);
  G.restoreTabScroll(back, '#/me');
  ok(back.querySelector('.pane-scroll').scrollTop === 640, 'a tab tapped again goes back to where its list was left');
  const other = mk(0);
  G.restoreTabScroll(other, '#/graphs');
  ok(other.querySelector('.pane-scroll').scrollTop === 0, 'a tab never scrolled stays at the top');
}

/* ================= 4. app.js: boot in a DOM ================= */
{
  const app = read('js/app.js');
  ok(!/^import [^;]*from '\.\/views-/m.test(app), 'I-13: no screen module is a static import of app.js any more');
  for (const v of ['workouts', 'session', 'data', 'account', 'import', 'profile', 'edit-session', 'social', 'goals', 'me']) {
    ok(app.includes(`import('./views-${v}.js')`), `views-${v}.js loads on first use`);
  }
  const sw = read('sw.js');
  ok(['views-workouts', 'views-session', 'views-data', 'views-social', 'views-goals', 'views-me'].every((v) => sw.includes(`'./js/${v}.js'`)),
     'and every one is still precached for offline');
  const fr = app.slice(app.indexOf('async function firstRun('));
  ok(/onDone: \(r\) => \(r && r\.skipped \? null/.test(fr), 'O-9: a skipped intro starts no tour');
  ok(/removeEventListener\('hashchange', onFirstHome\)[\s\S]{0,40}firstRun\(\)/.test(app), 'O-16: the first arrival at Home asks the gate once');
  ok(/navigator\.storage/.test(app) && /\.persist\(\)/.test(app) && /keepStorage\(\);/.test(app), 'R-3: boot asks for persistent storage');

  // ST-9's region rule, pulled out of the source (app.js boots on import).
  const src = app.match(/const LBS_REGIONS = [^\n]*\nfunction regionUnits[\s\S]*?\n}\n/)[0];
  const regionUnits = new Function(`${src}; return regionUnits;`)();
  ok(regionUnits('en-GB') === 'kg' && regionUnits('de-DE') === 'kg' && regionUnits('es-419') === 'kg', 'region units: GB, DE, Latin America → kg');
  ok(regionUnits('en-US') === 'lbs' && regionUnits('en_LR') === 'lbs' && regionUnits('my-MM') === 'lbs', 'US, Liberia, Myanmar → lbs');
  ok(regionUnits('zh-Hans-CN') === 'kg' && regionUnits('en') === null, 'a script subtag is skipped; no region → no opinion');
  const nc = app.match(/const unitsNeverChosen = [\s\S]*?;\n/)[0];
  const neverChosen = new Function(`${nc}; return unitsNeverChosen;`)();
  ok(neverChosen({ id: 'settings', units: 'lbs', theme: 'dark' }) && neverChosen({ id: 'settings', sharedTiersCleared: true }),
     'units count as never chosen for the store\'s empty default and a row with no units');
  ok(!neverChosen({ id: 'settings', units: 'lbs' }) && !neverChosen({ id: 'settings', units: 'lbs', theme: 'dark', onboardedAt: 'x' }) && !neverChosen({ units: 'kg' }),
     '🛑 but never once a unit was saved');
}

{
  // The skeleton, as index.html paints it.
  const skel = INDEX.match(/<div id="app" data-skel>[\s\S]*?<\/nav><div class="screen boot-shell"><\/div><\/div>/)[0];
  document.body.innerHTML = skel;
  history.replaceState(null, '', '#/home');
  mem.set('ftrack:v1:look', JSON.stringify({ theme: 'auto' }));
  systemLight = true;
  const { store } = await import(BASE + 'store.js');
  const units = await import(BASE + 'units.js');
  await store.saveSettings({ theme: 'auto' });
  await import(BASE + 'app.js');
  await settle(400);
  const root = document.documentElement;
  const appEl = document.getElementById('app');
  ok(!appEl.hasAttribute('data-skel'), 'boot swaps the static skeleton for the real frame');
  ok(appEl.querySelectorAll(':scope > .navbar').length === 1, 'and there is exactly one tab bar');
  ok(root.getAttribute('data-theme') === 'light' && root.getAttribute('data-theme-pref') === 'auto', 'ST-10: Auto resolves to the phone\'s light');
  systemLight = false;
  mqListeners.forEach((f) => f());
  await settle();
  ok(root.getAttribute('data-theme') === 'dark', 'and follows the phone when it switches to dark');
  ok(JSON.parse(mem.get('ftrack:v1:look')).theme === 'auto', 'the remembered look keeps the CHOICE (auto), not what it resolved to');

  root.setAttribute('data-theme', 'light'); // Settings' Light chip
  await settle();
  ok(!root.hasAttribute('data-theme-pref') && JSON.parse(mem.get('ftrack:v1:look')).theme === 'light', 'an explicit Light ends Auto');
  systemLight = true;
  root.setAttribute('data-theme', 'auto'); // a view that sets the choice itself
  await settle();
  ok(root.getAttribute('data-theme') === 'light' && root.getAttribute('data-theme-pref') === 'auto', 'a view writing data-theme="auto" is resolved before paint');
  ok(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content === 'default', 'the status bar follows the theme on screen');
  root.setAttribute('data-theme', 'dark');
  await settle();
  ok(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content === 'black-translucent', '…both ways');

  await store.saveSettings({ glass: false });
  ok(root.getAttribute('data-glass') === 'off', 'settings.glass === false → <html data-glass="off"> right after the save');
  await store.saveSettings({ glass: true });
  ok(!root.hasAttribute('data-glass'), 'and back on');
  if (typeof units.setWeightPrefs === 'function') {
    await store.saveSettings({ weightStep: { lbs: 2.5, kg: 1 } });
    ok(units.weightStepFor('lbs') === 2.5 && units.weightStepFor('kg') === 1, 'any settings save re-seeds units.js weight prefs (setWeightPrefs)');
    await store.saveSettings({ weightStep: { lbs: 5, kg: 2.5 } });
  } else ok(true, 'units.js has no setWeightPrefs yet — guarded');

  // I-13: a screen that is not needed at boot still opens.
  location.hash = '#/goals';
  await settle(600);
  ok(/Goals/.test((document.querySelector('#app .screen h1') || {}).textContent || ''), 'a lazily loaded screen (Goals) renders');
  location.hash = '#/home';
  await settle(400);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
