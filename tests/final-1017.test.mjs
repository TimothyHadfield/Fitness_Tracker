// Tim's two answers of 2026-10-17 (question box), built the same day. Every
// check below was seen FAILING on 3776132 before its fix.
//
//   node tests/final-1017.test.mjs      (needs jsdom, like render.test.mjs)
//
//   1. "When you finish a set, the rows below jump about 51px. Fix it so
//      nothing moves?" → "Fix it". Measured at 393×659 (headless WebKit, demo):
//      Finished on set 1 opened set 2 one row lower, and the pane scrolled the
//      whole list up 51px so set 2's controls — plate drawing included — sat
//      above the floating footer. Now the finished row and every row below it
//      stay still; the pane scrolls only when set 2's ± buttons would be behind
//      the footer, and then by the least that frees them.
//      jsdom has no layout, so this suite gives the runner a small layout model
//      (row heights as measured: open 228, closed/finished 51, ± row 108–160
//      inside an open row, footer 63) and reads what the runner scrolls.
//   2. "Should deleting an account also delete that person's comments on
//      friends' workouts?" → "Yes." deleteAccount() now removes every comment
//      the user wrote (social/{owner}/sessions/{sid}/comments/c_<sid>_<uid>_…),
//      found through their connections, before the account is gone.
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

/* ---------- the layout model ---------- */
// Numbers from the 393×659 WebKit measurement: the pane starts at 161 and
// ends at the screen's bottom, the footer floats over its last 63px, the set
// list starts 200px into the pane (title + three warm-ups), an open set row is
// 228 tall with its ± row 108–160 into it, every other row 51.
const PANE_TOP = 161, PANE_BOTTOM = 659, CHROME = 63, LIST_AT = 200;
const OPEN_H = 228, ROW_H = 51, HEAD_H = 50, CTRL_TOP = 108, CTRL_H = 52;
const VISIBLE_BOTTOM = PANE_BOTTOM - CHROME;
const scrollTops = new WeakMap();
Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', {
  configurable: true,
  get() { return scrollTops.get(this) || 0; },
  set(v) { scrollTops.set(this, Math.max(0, Number(v) || 0)); },
});
const rect = (top, height) => ({ top, bottom: top + height, height, left: 0, right: 393, width: 393, x: 0, y: top });
const rowHeight = (r) => (r.classList.contains('is-open') ? OPEN_H : ROW_H);
function rowTop(row) {
  const pane = row.closest('.pane-scroll');
  let y = PANE_TOP + LIST_AT - (pane ? pane.scrollTop : 0);
  for (const r of row.parentNode.children) { if (r === row) break; y += rowHeight(r); }
  return y;
}
window.Element.prototype.getBoundingClientRect = function () {
  if (this.classList && this.classList.contains('pane-scroll')) return rect(PANE_TOP, PANE_BOTTOM - PANE_TOP);
  const row = this.closest && this.closest('[data-row]');
  if (!row || !row.parentNode) return rect(PANE_TOP, 20);
  const top = rowTop(row);
  if (this === row) return rect(top, rowHeight(row));
  if (this.closest('.stepper-controls')) return rect(top + CTRL_TOP, CTRL_H);
  if (this.classList.contains('set-open')) return rect(top + HEAD_H, OPEN_H - HEAD_H);
  if (this.closest('.set-open-head')) return rect(top, HEAD_H);
  return rect(top, rowHeight(row));
};
const realGCS = window.getComputedStyle.bind(window);
globalThis.getComputedStyle = (node, pseudo) => {
  const cs = realGCS(node, pseudo);
  if (node !== document.documentElement) return cs;
  return new Proxy(cs, {
    get(t, k) {
      if (k === 'getPropertyValue') return (p) => (p === '--chrome-b' ? `${CHROME}px` : t.getPropertyValue(p));
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
};

const BASE = new URL('../js/', import.meta.url).href;
const { BUILT_IN_EXERCISES } = await import(BASE + 'exercises.js');
const { store } = await import(BASE + 'store.js');
const { SessionView } = await import(BASE + 'views-session.js');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };

const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const settle = () => new Promise((r) => setTimeout(() => { skew += 450; r(); }, 30));
const app = () => document.getElementById('app');
const DRAFT = 'ftrack:v1:draftSession';

/* ---------- 1. Finished keeps every row still ---------- */
{
  localStorage.removeItem(DRAFT);
  await store.saveSettings({ runnerView: 'list' });
  const bench = byName('Barbell Bench Press');
  const w = await store.saveWorkout({ name: 'Row day', exercises: [{ exerciseId: bench.id, sets: 4, notes: '' }] });
  const node = await SessionView(w.id);
  app().replaceChildren(node);
  await settle(); await settle();
  const pane = app().querySelector('.pane-scroll');
  const row = (k) => app().querySelector(`[data-row="${k}"]`);
  const top = (k) => (row(k) ? row(k).getBoundingClientRect().top : NaN);
  // Type a weight and reps into the open set so Finished is offered.
  function fillOpen(weight, reps) {
    const boxes = [...app().querySelectorAll('.set-item.is-open .step-value')];
    [weight, reps].forEach((v, i) => {
      if (!boxes[i]) return;
      boxes[i].value = String(v);
      boxes[i].dispatchEvent(new window.Event('blur'));
    });
  }
  const finishBtn = () => app().querySelector('.set-item.is-open .set-done-btn:not(.is-idle)');
  const controlsBottom = () => {
    const c = [...app().querySelectorAll('.set-item.is-open .stepper-controls')];
    return c.length ? Math.max(...c.map((n) => n.getBoundingClientRect().bottom)) : NaN;
  };

  pane.scrollTop = 0;
  ok(row('s0') && row('s0').classList.contains('is-open'), 'set 1 is open on arrival');
  fillOpen(185, 5);
  const b = finishBtn();
  ok(Boolean(b), 'Finished is offered once set 1 holds a weight and reps');
  const before = { s0: top('s0'), s2: top('s2'), s3: top('s3'), scroll: pane.scrollTop };
  if (b) b.click();
  await settle();
  ok(row('s0').classList.contains('is-done') && row('s1').classList.contains('is-open'),
     'Finished on set 1 opens set 2');
  ok(top('s0') === before.s0, `the finished row stays where it was (${before.s0} → ${top('s0')})`);
  ok(top('s2') === before.s2 && top('s3') === before.s3,
     `the rows below stay still (set 3 ${before.s2} → ${top('s2')}, set 4 ${before.s3} → ${top('s3')})`);
  ok(pane.scrollTop === before.scroll, `nothing scrolled (pane scrollTop ${before.scroll} → ${pane.scrollTop})`);
  ok(controlsBottom() <= VISIBLE_BOTTOM, `set 2's ± buttons are above the footer (${controlsBottom()} ≤ ${VISIBLE_BOTTOM})`);

  // Set 3 opens one row lower again; now its ± buttons would be behind the
  // footer, so the pane scrolls — by the least that frees them, not a row.
  fillOpen(185, 5);
  const before2 = top('s1');
  const b2 = finishBtn();
  if (b2) b2.click();
  await settle();
  ok(row('s2') && row('s2').classList.contains('is-open'), 'Finished on set 2 opens set 3');
  const cb = controlsBottom();
  ok(cb <= VISIBLE_BOTTOM, `set 3's ± buttons are still reachable above the footer (${cb} ≤ ${VISIBLE_BOTTOM})`);
  ok(VISIBLE_BOTTOM - cb <= 8, `…and the list moved only as far as that needed (gap ${VISIBLE_BOTTOM - cb}px, moved ${before2 - top('s1')}px)`);
  localStorage.removeItem(DRAFT);
}

/* ---------- 2. delete account takes the user's comments with it ---------- */
{
  const src = readFileSync(new URL('../js/firebase-backend.js', import.meta.url), 'utf8');
  const fn = (src.match(/async deleteAccount\(currentPassword, collections\) \{[\s\S]*?\n {2}\},\n/) || [''])[0];
  ok(/deleteOwnComments\(/.test(fn), 'deleteAccount() calls deleteOwnComments()');
  const iDel = fn.indexOf('deleteOwnComments(');
  const iPurge = fn.indexOf('createAccountPurge(');
  const iUser = fn.indexOf('deleteUser(');
  ok(iDel !== -1 && iDel < iPurge && iPurge < iUser,
     'comments go after re-auth and BEFORE the purge (the friends list is read from users/{uid}/social/graph, which the purge removes) and the auth user');

  const { deleteOwnComments } = await import(BASE + 'firebase-backend.js?final');
  ok(typeof deleteOwnComments === 'function', 'deleteOwnComments is exported for testing');
  if (typeof deleteOwnComments === 'function') {
    // Shaped like the real store: users/{owner}/reactions/{id}, flat, with
    // `kind` and `from` (firestore.rules validReaction). Me = "me"; friends
    // a and b. My kudos stay (Tim was asked about comments); other people's
    // comments stay; my own workouts' reactions are the purge's job.
    const reactions = {
      a: [
        { id: 'c_s1_me_k1', kind: 'comment', from: 'me', sessionId: 's1', text: 'nice' },
        { id: 'c_s1_a_k2', kind: 'comment', from: 'a', sessionId: 's1', text: 'thanks' },
        { id: 'k_s1_me', kind: 'kudos', from: 'me', sessionId: 's1', text: '' },
        { id: 'c_s2_me_k3', kind: 'comment', from: 'me', sessionId: 's2', text: 'big' },
      ],
      b: [
        { id: 'c_s9_b_k4', kind: 'comment', from: 'b', sessionId: 's9', text: 'mine' },
        { id: 'c_s9_me_k5', kind: 'comment', from: 'me', sessionId: 's9', text: 'go' },
      ],
    };
    const deleted = [];
    const api = {
      friendUids: async () => ['a', 'b'],
      listReactions: async (owner) => (reactions[owner] || []).map((r) => ({ ...r })),
      deleteReaction: async (owner, id) => { deleted.push(`${owner}/${id}`); },
    };
    const r = await deleteOwnComments('me', api);
    ok(deleted.length === 3 && deleted.join() === 'a/c_s1_me_k1,a/c_s2_me_k3,b/c_s9_me_k5',
       `deletes exactly the 3 comments "me" wrote on friends' workouts (${deleted.join(', ')})`);
    ok(r && r.deleted === 3 && r.failed.length === 0, `reports 3 deleted, none failed (${JSON.stringify(r)})`);
    // One friend that can't be reached is reported, and the rest still go.
    const deleted2 = [];
    const r2 = await deleteOwnComments('me', {
      ...api,
      listReactions: async (owner) => { if (owner === 'a') throw new Error('offline'); return api.listReactions(owner); },
      deleteReaction: async (o, id) => { deleted2.push(id); },
    });
    ok(deleted2.join() === 'c_s9_me_k5' && r2.failed.join() === 'a',
       `one unreachable friend doesn't stop the others, and is reported (${JSON.stringify(r2)})`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
