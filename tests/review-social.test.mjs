// Social / account / boot bugs from the 2026-09-24 review (builder C).
//   node tests/review-social.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "I want you to review the cite and look for improvements (either new
// features or fixing problems) throughout the whole thing."
//
// No cloud is touched: every social/auth call the screens make is replaced
// below, and the store runs on its LocalBackend (localStorage mocked in memory).
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/home',
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
globalThis.MutationObserver = window.MutationObserver;
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

const BASE = new URL('../js/', import.meta.url).href;
const { store, social, auth } = await import(BASE + 'store.js');
const {
  SocialView, InviteView, AddView, FriendSessionView, inviteSheet,
} = await import(BASE + 'views-social.js');
const { AccountView } = await import(BASE + 'views-account.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function mount(p) {
  const node = await p;
  document.getElementById('app').replaceChildren(node);
  await settle();
  return node;
}
const text = (n) => n.textContent.replace(/\s+/g, ' ');
const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ');

// The stale promise, in any of the five places it was made.
const STALE = /only be able to see that you trained|can (now )?see that you train|Nothing of yours is shared until|only thing your friends see/i;

const original = { ...social };
const restore = () => Object.assign(social, original);
const baseState = {
  available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim H',
  shareBodyWeight: false, connections: [],
};

/* ---- 1. Privacy wording says what really happens ---- */
{
  // Name setup: an account with no display name yet.
  social.state = async () => ({ ...baseState, name: '' });
  const s = await mount(SocialView());
  ok(/display name/i.test(text(s)), 'the name setup screen renders');
  ok(!STALE.test(text(s)), `name setup does not say the name is all friends see ("${text(s).slice(0, 140)}")`);
  restore();
}
{
  // The claim toast on the Friends screen.
  social.state = async () => ({ ...baseState });
  social.invites = async () => [{ id: 't1', token: 't1', claimedBy: 'u-ana', claimedName: 'Ana' }];
  social.handoffs = async () => [];
  social.friend = async () => ({ tier: 'light', doc: null });
  social.healConnectionName = async () => null;
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;
  social.requests = async () => [];
  social.acceptClaim = async () => true;
  const s = await mount(SocialView());
  await settle(80);
  const add = [...s.querySelectorAll('button')].find((b) => b.textContent === 'Add');
  ok(Boolean(add), 'a claimed invite offers Add');
  if (add) { add.click(); await settle(); }
  ok(/Ana/.test(toasts()) && !STALE.test(toasts()),
     `accepting a claim toasts the truth ("${toasts()}")`);
  restore();
}
{
  // The invite link screen, and its toast.
  social.state = async () => ({ ...baseState });
  social.openInvite = async () => ({ state: 'open' });
  social.acceptInvite = async () => true;
  const s = await mount(InviteView('u-owner/tok123'));
  ok(/Connect/.test(text(s)), 'the invite screen renders');
  ok(!STALE.test(text(s)), `the invite screen does not promise "only that you trained" ("${text(s).slice(0, 220)}")`);
  ok(/everything/i.test(text(s)), 'and says friends see everything');
  const btn = [...s.querySelectorAll('button')].find((b) => b.textContent === 'Connect');
  btn.click(); await settle();
  ok(!STALE.test(toasts()) && /Connected/.test(toasts()), `and its toast is true too ("${toasts()}")`);
  restore();
}
{
  // The scanned-code screen.
  social.state = async () => ({ ...baseState });
  social.personByUid = async (uid) => ({ uid, name: 'Sam', state: 'none' });
  const s = await mount(AddView('u-sam'));
  await settle();
  ok(/Sam/.test(text(s)), 'the scanned-code screen renders');
  ok(!STALE.test(text(s)), `and does not say nothing is shared until they accept ("${text(s)}")`);
  restore();
}

/* ---- 3. The copy fallback does not tell a phone to press Ctrl+C ---- */
{
  social.createInvite = async () => ({ link: 'http://localhost/#/invite/me/tok' });
  const clip = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('no'); } }, configurable: true });
  window.matchMedia = (q) => ({ matches: /coarse/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  globalThis.matchMedia = window.matchMedia;
  ok(typeof inviteSheet === 'function', 'the invite sheet can be opened on its own');
  if (typeof inviteSheet === 'function') await inviteSheet();
  await settle();
  const sheet = [...document.querySelectorAll('.sheet')].pop();
  const copy = sheet && [...sheet.querySelectorAll('button')].find((b) => /Copy link/.test(b.textContent));
  ok(Boolean(copy), 'the invite sheet opens with Copy link');
  if (copy) { copy.click(); await settle(); }
  ok(!/Ctrl\+C/.test(toasts()) && /Tap and hold/i.test(toasts()),
     `on a touch screen the fallback says tap and hold ("${toasts()}")`);
  Object.defineProperty(navigator, 'clipboard', { value: clip, configurable: true });
  document.querySelectorAll('.sheet, .sheet-backdrop, .scrim').forEach((n) => n.remove());
  restore();
}

/* ---- 4. A friend's weighted pull-up is priced with their body weight ---- */
{
  const exMap = await store.getExerciseMap();
  const pull = [...exMap.values()].find((e) => e.name === 'Pull-Up');
  ok(Boolean(pull), 'the library has Pull-Up');
  const entry = (w) => [{ exerciseId: pull.id, name: 'Pull-Up', sets: [{ weight: w, reps: 5 }] }];
  social.state = async () => ({ ...baseState,
    connections: [{ uid: 'u-f', name: 'Fay', tier: 'full', since: '2026-08-01' }] });
  social.friend = async () => ({ audience: 'friends', doc: {
    profile: { name: 'Fay' },
    bodyWeight: [{ date: '2026-08-01', weight: 180 }],
    activity: [
      { id: 'old', date: '2026-08-10', name: 'Pull', entries: entry(25) },
      { id: 'new', date: '2026-08-20', name: 'Pull', entries: entry(45) },
    ],
  } });
  social.reactionsFor = async () => new Map();
  const s = await mount(FriendSessionView('u-f', 'new'));
  for (let i = 0; i < 6; i++) await settle();
  const prs = s.querySelector('.ws-prs');
  const tags = prs ? [...prs.querySelectorAll('.tag')].map((t) => t.textContent) : [];
  ok(tags.includes('1RM'),
     `a weighted pull-up on a friend's session shows its 1RM best (tags: ${tags.join(', ') || 'none'})`);
  restore();
}

/* ---- 5. A famous lifter's source link uses the app's link style ---- */
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/views-social.js', import.meta.url), 'utf8');
  const line = src.split('\n').find((l) => /href: l\.source/.test(l)) || '';
  ok(/class: 'text-link'/.test(line), 'the source link carries the text-link class');
}

/* ---- 2. A scanned code survives setting up an account ---- */
{
  location.hash = '#/add/u-sam';
  await settle();
  social.state = async () => ({ available: false, reason: 'anonymous' });
  const s = await mount(AddView('u-sam'));
  const setup = [...s.querySelectorAll('a')].find((a) => /Set up my account/.test(a.textContent));
  ok(Boolean(setup), 'a signed-out newcomer is sent to set up an account');
  setup.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  restore();

  // ...they sign up (the account screen is re-rendered signed in)...
  const origAuth = { state: auth.state, configured: auth.configured };
  auth.configured = () => true;
  auth.state = async () => ({ mode: 'cloud', user: { uid: 'me', isAnonymous: false, secured: true, email: 'a@b.c' } });
  location.hash = '#/account';
  await settle();
  await mount(AccountView());
  await settle(60);
  ok(location.hash === '#/add/u-sam', `and lands back on the code they scanned (${location.hash})`);

  // ...and only once.
  location.hash = '#/account';
  await settle();
  await mount(AccountView());
  await settle(60);
  ok(location.hash === '#/account', 'the saved route is used once, not on every visit');
  Object.assign(auth, origAuth);
}

/* ---- 6. First launch paints before the cloud answers ---- */
{
  localStorage.setItem('ftrack:v1:look', JSON.stringify({ theme: 'light' }));
  document.getElementById('app').replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  const origGet = store.getSettings;
  store.getSettings = () => new Promise(() => {}); // the SDK download that never finishes
  // Settled BEFORE the import, so no stray hashchange from the blocks above can
  // render a screen behind boot's back and make this pass by accident.
  location.hash = '#/home';
  await settle(60);
  await import(BASE + 'app.js');
  await settle(60);
  const app = document.getElementById('app');
  ok(Boolean(app.querySelector('nav.navbar')),
     `the app's frame is on screen while the cloud is still loading (${[...app.children].map((c) => c.className).join(', ') || 'nothing'})`);
  ok(document.documentElement.getAttribute('data-theme') === 'light',
     `a returning light-theme user sees light straight away (${document.documentElement.getAttribute('data-theme')})`);
  store.getSettings = origGet;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
