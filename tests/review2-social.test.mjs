// Home / Friends decisions from the second 2026-09-24 review pass (builder R3).
//   node tests/review2-social.test.mjs      (needs jsdom, like render.test.mjs)
//
// Tim: "for all fo the 42 items you're leaving me to decide, you just choose
// what to do based on what you know and recommend".
//
// No cloud is touched: every social call the screens make is replaced below,
// and the store runs on its LocalBackend (localStorage mocked in memory).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

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
const S = await import(BASE + 'social.js');
const { HomeView, feedActions } = await import(BASE + 'views-workouts.js');
const { MeRouteView } = await import(BASE + 'views-me.js');
const { inviteSheet } = await import(BASE + 'views-social.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms));
async function mount(p) {
  const node = await p;
  document.getElementById('app').replaceChildren(node);
  await settle();
  return node;
}
const text = (n) => n.textContent.replace(/\s+/g, ' ');
const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ');
const clearOverlays = () => {
  for (const n of document.querySelectorAll('.toast, .sheet, .sheet-backdrop, .scrim')) n.remove();
};
// Emoji and the old arrow glyph — the drawn icons replace all of them.
const EMOJI = /[\u{1F300}-\u{1FAFF}]|↗/u;

const original = { ...social };
const restore = () => Object.assign(social, original);
const baseState = {
  available: true, reason: null, user: { uid: 'me' }, uid: 'me', name: 'Tim H',
  shareBodyWeight: false, connections: [],
};
const quiet = () => {
  social.processDisconnects = async () => 0;
  social.processAcceptedRequests = async () => 0;
  social.requests = async () => [];
  social.handoffs = async () => [];
  social.invites = async () => [];
  social.reactionsFor = async () => new Map();
};

/* ---- 1. The newcomer path on Home ---- */
for (const reason of ['anonymous', 'local']) {
  social.state = async () => ({ available: false, reason });
  const home = await mount(HomeView());
  await settle();
  const btn = home.querySelector('.empty a.btn');
  ok(/account/i.test(text(home)), `signed out (${reason}): Home says friends need an account ("${text(home).slice(0, 120)}")`);
  ok(btn && btn.getAttribute('href') === '#/account',
     `and its one button goes straight to account setup (${btn && btn.getAttribute('href')})`);
  ok(home.querySelectorAll('.empty a.btn, .empty button').length === 1, 'one button, not two');
  restore();
}
{
  social.state = async () => ({ ...baseState });
  quiet();
  const home = await mount(HomeView());
  await settle(80);
  ok(!/follow/i.test(text(home)), `no "follow" wording — friends are mutual ("${text(home).slice(0, 120)}")`);
  const btn = home.querySelector('.empty a.btn');
  ok(btn && btn.getAttribute('href') === '#/find',
     `the no-friends button opens Add a friend, not the Friends list (${btn && btn.getAttribute('href')})`);
  ok(!home.querySelector('.feed-waiting'), 'nothing waiting → no waiting line at all');
  restore();
}

/* ---- 2. Friend requests visible from Home ---- */
{
  social.state = async () => ({ ...baseState });
  quiet();
  social.requests = async () => [{ uid: 'a', name: 'Ana' }, { uid: 'b', name: 'Bo' }];
  social.handoffs = async () => [{ id: 'h1', session: { date: '2026-09-20' } }];
  social.invites = async () => [{ id: 't1', claimedBy: 'u-c', claimedName: 'Cy' }, { id: 't2' }];
  const home = await mount(HomeView());
  await settle(80);
  const line = home.querySelector('a.feed-waiting');
  ok(Boolean(line), 'something waiting → one line at the top of Home');
  ok(line && line.getAttribute('href') === '#/social', `linking to the Friends screen (${line && line.getAttribute('href')})`);
  ok(line && /2 people asked to connect/.test(text(line)), `counts requests (${line && text(line)})`);
  ok(line && /1 workout recorded for you/.test(text(line)), 'counts workouts recorded for you');
  ok(line && /1 person used your invite/.test(text(line)), 'counts a claimed invite, not an unclaimed one');
  ok(home.firstElementChild === line || home.querySelector('.feed').firstElementChild === line,
     'and it is the first thing on the feed');
  restore();
}

/* ---- 3. Comment times, and replying on your own workout ---- */
{
  const now = Date.parse('2026-09-24T12:00:00Z');
  ok(S.commentAge(now - 20 * 1000, now) === 'just now', 'commentAge: seconds → just now');
  ok(S.commentAge(now - 5 * 60e3, now) === '5m ago', 'commentAge: minutes');
  ok(S.commentAge(now - 2 * 3600e3, now) === '2h ago', `commentAge: hours (${S.commentAge(now - 2 * 3600e3, now)})`);
  ok(S.commentAge(now - 3 * 86400e3, now) === '3d ago', 'commentAge: days');
  ok(S.commentAge(now - 15 * 86400e3, now) === '2w ago', 'commentAge: weeks');
  ok(S.commentAge(null, now) === '' && S.commentAge(0, now) === '', 'no time stored → nothing, not "56 years ago"');
}
{
  const saved = await store.saveSession({
    workoutName: 'Push', date: '2026-09-23', startedAt: '2026-09-23T10:00:00.000Z',
    finishedAt: '2026-09-23T11:00:00.000Z',
    entries: [{ exerciseId: 'x', exerciseName: 'Bench Press', sets: [{ weight: 135, reps: 8 }] }],
  });
  const twoHoursAgo = Date.now() - 2 * 3600e3;
  const slot = { kudos: ['ana'], myKudosId: null,
    comments: [{ id: 'c1', from: 'ana', fromName: 'Ana', text: 'Strong!', at: twoHoursAgo, mine: false }] };
  social.state = async () => ({ ...baseState, connections: [{ uid: 'ana', name: 'Ana' }] });
  social.reactionsFor = async () => new Map([[saved.id, slot]]);
  let sent = null;
  social.addComment = async (owner, sid, t) => { sent = { owner, sid, t }; return { id: 'c2', text: t }; };
  const list = await mount(MeRouteView('workouts'));
  await settle(80);
  const card = list.querySelector(`[data-session="${saved.id}"]`);
  ok(Boolean(card), 'your own workout card renders');
  ok(card && /2h ago/.test(text(card)), `the comment on it shows when it was said (${card && text(card).slice(-120)})`);
  ok(card && !EMOJI.test(text(card)), 'no emoji on your own card — drawn icons instead');
  ok(card && card.querySelectorAll('.feed-rx svg').length >= 2, 'kudos and comment lines carry drawn icons');
  const btns = card ? [...card.querySelectorAll('button')] : [];
  const comment = btns.find((b) => /Comment/.test(b.textContent));
  const share = btns.find((b) => /Share/.test(b.textContent));
  ok(Boolean(comment), 'your own card has a Comment button');
  ok(Boolean(share), 'and a Share (picture) button');
  ok(!btns.some((b) => /Kudos/.test(b.textContent)), 'but no Kudos — a vote for yourself is refused by the rules too');
  if (comment) {
    comment.click(); await settle();
    const sheet = document.querySelector('.comment-sheet');
    ok(Boolean(sheet), 'Comment opens the thread');
    ok(sheet && /2h ago/.test(text(sheet)), 'and the thread shows the comment time');
    const ta = sheet && sheet.querySelector('textarea');
    const send = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Send');
    if (ta && send) {
      ta.value = 'Thanks!';
      send.click(); await settle();
      ok(sent && sent.owner === 'me' && sent.sid === saved.id && sent.t === 'Thanks!',
         `a reply is written on YOUR account, on that session (${JSON.stringify(sent)})`);
      ok(/just now/.test(text(document.querySelector('.comment-sheet'))), 'and shows as just now');
    } else ok(false, 'the thread has a box and a Send button');
  }
  clearOverlays();
  restore();
}

/* ---- 4 + 5. Kudos reacts instantly; drawn icons on the feed ---- */
{
  let settleSave;
  social.toggleKudos = () => new Promise((res) => { settleSave = res; });
  const slot = { kudos: [], myKudosId: null, comments: [] };
  const row = feedActions({ uid: 'ana', name: 'Ana', act: { id: 's1', date: '2026-09-23', name: 'Legs' },
    rx: { slot, myUid: 'me', names: new Map() } });
  document.getElementById('app').replaceChildren(row);
  ok(!EMOJI.test(text(row)), `feed buttons carry no emoji (${text(row)})`);
  ok(row.querySelectorAll('.feed-act svg').length === 3, 'three drawn icons: thumb, comment, share');
  const kudos = () => [...row.querySelectorAll('button')].find((b) => /Kudos/.test(b.textContent));
  kudos().click();
  ok(/Kudos · 1/.test(kudos().textContent) && kudos().getAttribute('aria-pressed') === 'true',
     `the count moves BEFORE the save finishes (${kudos().textContent})`);
  ok(Boolean(kudos().querySelector('.is-popping')), 'and the icon pops');
  settleSave(true); await settle();
  ok(/Kudos · 1/.test(kudos().textContent), 'and stays when the save lands');

  // A failed save rolls back and says so.
  clearOverlays();
  social.toggleKudos = async () => { throw new Error('Could not send that.'); };
  kudos().click();
  ok(/Kudos · 0|^Kudos$/.test(kudos().textContent.trim()) || kudos().getAttribute('aria-pressed') === 'false',
     'taking it back also moves instantly');
  await settle();
  ok(kudos().getAttribute('aria-pressed') === 'true' && /Kudos · 1/.test(kudos().textContent),
     `a failed save puts it back (${kudos().textContent})`);
  ok(/Could not send/.test(toasts()), `and toasts why (${toasts()})`);
  clearOverlays();
  restore();
}
{
  // The Home strip of reactions on your workouts.
  const saved = (await store.getSessions())[0];
  social.state = async () => ({ ...baseState, connections: [{ uid: 'ana', name: 'Ana' }] });
  quiet();
  social.friend = async () => ({ audience: 'friends', doc: { profile: { name: 'Ana' }, activity: [
    { id: 'f1', date: '2026-09-22', name: 'Legs', entries: [] }] } });
  social.reactionsFor = async (uid) => (uid === 'me'
    ? new Map([[saved.id, { kudos: ['ana'], myKudosId: null,
        comments: [{ id: 'c', from: 'ana', fromName: 'Ana', text: 'Nice', at: Date.now() - 3 * 3600e3 }] }]])
    : new Map());
  const home = await mount(HomeView());
  await settle(80);
  const strip = home.querySelector('.feed-mine');
  ok(Boolean(strip), 'the "On your workouts" strip renders');
  ok(strip && !EMOJI.test(text(strip)), `with no emoji (${strip && text(strip)})`);
  ok(strip && strip.querySelectorAll('svg').length >= 2, 'but drawn icons');
  ok(strip && /3h ago/.test(text(strip)), 'and the comment says when');
  restore();
}

/* ---- 7. Compare stacks on a phone ---- */
{
  const src = readFileSync(new URL('../js/views-social.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
  const sect = (css.split('/* === Review 2026-09-24 · Home/Friends === */')[1] || '').split('/* === end Home/Friends === */')[0];
  ok(/cmp-grid cmp-panels/.test(src), 'the two muscle panels are marked as panels, apart from the bodies');
  ok(/@media \(max-width: 859px\)[^}]*\.cmp-panels[^}]*grid-template-columns:\s*1fr\s*;/.test(sect),
     'and below the laptop split they stack in one column');
}

/* ---- 8. Invite link Share ---- */
{
  social.createInvite = async () => ({ link: 'https://x.test/#/invite/me/tok' });
  const nav = globalThis.navigator;
  let shared = null;
  Object.defineProperty(nav, 'share', { value: async (d) => { shared = d; }, configurable: true, writable: true });
  document.getElementById('app').replaceChildren();
  clearOverlays();
  const sheetButtons = () => [...document.querySelectorAll('.sheet button')];
  await inviteSheet(); await settle();
  let shareBtn = sheetButtons().find((b) => b.textContent.trim() === 'Share');
  ok(Boolean(shareBtn), 'the invite sheet offers Share when the phone has a share sheet');
  if (shareBtn) { shareBtn.click(); await settle(); }
  ok(shared && shared.url === 'https://x.test/#/invite/me/tok', `and shares the link (${JSON.stringify(shared)})`);
  ok(sheetButtons().some((b) => b.textContent === 'Copy link'), 'Copy stays');
  clearOverlays();
  delete nav.share;
  await inviteSheet(); await settle();
  ok(sheetButtons().some((b) => b.textContent === 'Copy link'), 'the sheet opened again (not vacuous)');
  shareBtn = sheetButtons().find((b) => b.textContent.trim() === 'Share');
  ok(!shareBtn, 'and hides Share where there is none');
  clearOverlays();
  restore();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
