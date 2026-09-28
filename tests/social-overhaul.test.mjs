// Overhaul wave 1, builder SOCIAL (2026-09-27): SC-3, SC-9, SC-10, O-15, E-3a,
// ST-14, the "a 8-rep" article bug, and the error-toast wording.
//   node tests/social-overhaul.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "all the wordy sections in the cite and reducing how much it says or
// putting it inside a question mark."
//
// No cloud is touched: every social call the screens make is replaced below,
// and the store runs on its LocalBackend (localStorage mocked in memory).
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
const { store, social } = await import(BASE + 'store.js');
const VS = await import(BASE + 'views-social.js');
const VM = await import(BASE + 'views-muscles.js');
const S = await import(BASE + 'social.js');

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
const original = { ...social };
const restore = () => Object.assign(social, original);
const baseState = {
  available: true, reason: null, user: { uid: 'me', name: 'Sam Rivera' }, uid: 'me', name: 'Tim H',
  shareBodyWeight: false, connections: [],
};
const click = (n) => n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

/* ---- O-15: the invite asks for the name ON the invite screen and keeps the link ---- */
{
  const calls = [];
  social.state = async () => ({ ...baseState, name: '' });
  social.openInvite = async () => ({ state: 'open' });
  social.setDisplayName = async (n) => { calls.push(['name', n]); };
  social.acceptInvite = async (owner, token) => { calls.push(['accept', owner, token]); return true; };
  location.hash = '#/invite/u-owner/tok123';
  const s = await mount(VS.InviteView('u-owner/tok123'));
  const input = s.querySelector('input[aria-label="Your name"]');
  ok(Boolean(input), `🚨 no display name yet: the invite screen asks for it inline (${text(s).slice(0, 120)})`);
  ok(input && input.value === 'Sam Rivera', 'prefilled from the sign-in\'s own name');
  ok(!/Pick a display name first/i.test(text(s)), 'and does not send them away to #/social (which lost the invite)');
  const btn = [...s.querySelectorAll('button')].find((b) => /^Connect$/.test(b.textContent.trim()));
  if (input) input.value = 'Sam R';
  if (btn) click(btn);
  for (let i = 0; i < 5; i++) await settle();
  ok(calls.length === 2 && calls[0][0] === 'name' && calls[0][1] === 'Sam R' && calls[1][0] === 'accept'
     && calls[1][2] === 'tok123',
     `Connect saves the name, THEN accepts the same invite (${JSON.stringify(calls)})`);
  ok(location.hash === '#/home', `after Connect the app goes Home (${location.hash})`);
  restore();
}
{
  social.state = async () => ({ ...baseState });
  social.openInvite = async () => ({ state: 'open' });
  social.acceptInvite = async () => true;
  location.hash = '#/invite/u-owner/tok9';
  const s = await mount(VS.InviteView('u-owner/tok9'));
  ok(!s.querySelector('input[aria-label="Your name"]'), 'with a name already set, no field is shown');
  ok(/You'll appear as Tim H\./.test(text(s)), 'and it says the name they will appear as');
  click([...s.querySelectorAll('button')].find((b) => /^Connect$/.test(b.textContent.trim())));
  for (let i = 0; i < 5; i++) await settle();
  ok(location.hash === '#/home', `Connect goes to #/home (${location.hash})`);
  restore();
}
{
  social.state = async () => ({ available: false, reason: 'anonymous' });
  const s = await mount(VS.InviteView('u-owner/tok9'));
  const t = text(s);
  ok(/Your friend's link needs an account/.test(t), `anonymous on an invite: short copy about the link (${t.slice(0, 160)})`);
  ok(t.split(/\s+/).filter((w) => /\w/.test(w)).length < 60, 'and the screen stays short');
  restore();
}

/* ---- SC-10: friend profile has no duplicate hero name, and a Compare button ---- */
{
  social.state = async () => ({ ...baseState, connections: [{ uid: 'u1', name: 'Autumn', since: '2026-08-01' }] });
  social.friend = async () => ({
    audience: 'friends',
    doc: {
      audience: 'friends', isPublic: false,
      profile: { name: 'Autumn', gender: 'female', age: 28 },
      activity: [], benchmarks: [],
      strength: {
        muscles: [{ muscle: 'Chest', lift: 'Barbell Bench Press', estimate: 120, confidence: 0.7,
          band: 'Good', basis: 'direct', contributorCount: 5, exerciseCount: 2, contributors: [] }],
        grid: { 'lifters|female|own|own': { Chest: [93, 6] } },
        defaultCompare: 'lifters|female|own|own',
      },
    },
  });
  const prof = await mount(VS.FriendView('u1'));
  for (let i = 0; i < 14; i++) await settle();
  const head = prof.querySelector('.me-head');
  ok(head && !/Autumn/.test(head.textContent),
     `🚨 the hero no longer prints their name — the topbar does (${head ? text(head).slice(0, 80) : 'no head'})`);
  ok(/Autumn/.test(text(prof.querySelector('.topbar') || prof)), 'the topbar still names them');
  const cmp = [...prof.querySelectorAll('a')].find((a) => a.getAttribute('href') === '#/compare/u1');
  ok(Boolean(cmp) && /Compare/.test(cmp.textContent), '🚨 a Compare button links to #/compare/<uid>');
  const bar = cmp && cmp.parentElement;
  ok(bar && [...bar.querySelectorAll('button, a')].some((b) => /View data/.test(b.textContent)),
     'and it sits beside View data');
  restore();
}

/* ---- SC-9: the Compare list, 13 rows, their level and yours, no winner ---- */
{
  const screen = await mount(VS.CompareBodiesView('famous:jeff-nippard/famous:stefi-cohen'));
  for (let i = 0; i < 12; i++) await settle();
  const rows = [...screen.querySelectorAll('.cmp-list .cmp-lrow:not(.cmp-lrow-head)')];
  ok(rows.length === 13, `🚨 the list has 13 muscle rows (${rows.length})`);
  ok(rows[0] && /Chest/.test(rows[0].textContent) && rows.every((r) => r.querySelectorAll('.cmp-lv').length === 2),
     'in the map\'s order, each with one level cell per person');
  const head = screen.querySelector('.cmp-lrow-head');
  ok(head && /Jeff Nippard/.test(head.textContent) && /Stefi Cohen/.test(head.textContent), 'the header names both people');
  const t = text(screen);
  ok(!/winner|stronger|wins|beats/i.test(t), 'no winner is named anywhere');
  ok(screen.querySelectorAll('.cmp-grid .cmp-col').length === 2, 'the famous-lifter compare still draws two bodies');
  const chestRow = rows.find((r) => r.dataset.muscle === 'Chest');
  click(chestRow);
  for (let i = 0; i < 8; i++) await settle();
  ok(screen.querySelectorAll('.cmp-panels .muscle-detail').length === 2, 'a row tap opens the same panel on both');
  ok(screen.querySelector('.cmp-lrow[data-muscle="Chest"]').getAttribute('aria-pressed') === 'true',
     'and the row shows it is the one open');
  ok(/The same level can mean very different weights/.test(t), 'the caption is the short one');
  const dot = screen.querySelector('.vol-notes > .help-line .help-dot');
  if (dot) { click(dot); await settle(); }
  const pop = document.querySelector('.help-pop');
  ok(pop && /own sex, body weight and age/.test(pop.textContent) && /never "who lifts more"/.test(pop.textContent),
     '⚠️ and the ranked-against caveat moved behind the ? beside it, word for word');
}

/* ---- E-3a: the confidence line counts SESSIONS, not observations ---- */
{
  ok(VM.confidenceLine({ sessionCount: 1, contributorCount: 4, exerciseCount: 4, band: { name: 'High' } })
     === 'High confidence · 1 session, 4 exercises', '🚨 one workout of four exercises reads "1 session, 4 exercises"');
  ok(VM.confidenceLine({ contributorCount: 3, exerciseCount: 1, band: { name: 'Fair' } })
     === 'Fair confidence · 3 sessions', 'a rating with no sessionCount falls back to contributorCount');
  const shared = S.projectStrength({ muscles: [{ muscle: 'Chest', sessionCount: 2, contributorCount: 6 }] });
  ok(shared.muscles[0].sessionCount === 2, 'a friend\'s published map carries sessionCount');
  const old = S.projectStrength({ muscles: [{ muscle: 'Chest', contributorCount: 6 }] });
  ok(!('sessionCount' in old.muscles[0]), 'and a rating without it carries no key');
}

/* ---- "a 8-rep" → "an 8-rep" ---- */
{
  const want = { 1: 'a', 5: 'a', 6: 'a', 8: 'an', 10: 'a', 11: 'an', 12: 'a', 18: 'an', 20: 'a', 80: 'an', 85: 'an', 100: 'a', 118: 'a' };
  const bad = Object.entries(want).filter(([n, a]) => VM.articleFor(Number(n)) !== a);
  ok(bad.length === 0, `🚨 "an" before 8, 11, 18 and 80s; "a" otherwise (wrong: ${JSON.stringify(bad)})`);
}

/* ---- SC-3: the legend is the compact one, chips kept ---- */
{
  const lg = VM.legend(false, true);
  ok(lg.classList.contains('lv-compact'), 'the legend is marked compact for the one-row layout');
  ok(lg.querySelectorAll('.lv-chip').length === 7 && [...lg.querySelectorAll('.lv-chip')].every((c) => c.textContent.trim()),
     '⚠️ and keeps its seven named chips (Tim, 2026-08-25: the name inside the chip)');
}

/* ---- ST-14: Settings can open the same Compared-to sheet with no arguments ---- */
{
  document.querySelectorAll('.sheet').forEach((n) => n.remove());
  await VM.openCompareSheet();
  await settle();
  const sheet = [...document.querySelectorAll('.sheet')].pop();
  ok(sheet && /Compared to/.test(sheet.textContent) && /Like me/.test(sheet.textContent),
     '🚨 openCompareSheet() with no arguments opens your own "Compared to" sheet');
  const everyone = sheet && [...sheet.querySelectorAll('button')].find((b) => /^Everyone$/.test(b.textContent.trim()));
  if (everyone) click(everyone);
  for (let i = 0; i < 5; i++) await settle();
  const saved = (await store.getSettings()).compare;
  ok(saved && saved.pool === 'everyone', `and a choice there saves to settings.compare (${JSON.stringify(saved)})`);
}

/* ---- error toasts are plain sentences ---- */
{
  ok(VS.friendly(new Error('FirebaseError: Missing or insufficient permissions.')) !== 'FirebaseError: Missing or insufficient permissions.',
     'a raw Firebase error is never shown as-is');
  ok(typeof VS.friendly(new Error('x')) === 'string' && VS.friendly(new Error('x')).length > 0, 'and always says something');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
