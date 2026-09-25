// Headless tests for the first-run tour (js/tour.js). No dependencies.
//   node tests/tour.test.mjs
//
// Tim, 2026-09-25: *"It will be like buttons popping up pointing to different
// parts of the cite and if they click "next" it will automatically bring them to
// the next part of the tour. Make sure the annimations and everythign are clean
// for the tour."* These pin the stop list, the bubble's placement (it must stay
// on a 393px phone and flip when there is no room) and the seen flag. The motion
// itself is checked by screenshots, not here.

import { readFileSync } from 'fs';

const T = await import('../js/tour.js');
const { STOPS, END, TOUR_KEY, spotRect, placeBubble, counter, hasToured, markToured, GUTTER } = T;

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log('PASS  ' + msg); else { fails++; console.log('FAIL  ' + msg); } };
const words = (s) => s.trim().split(/\s+/).length;

// ---- the stop list ----
ok(typeof T.startTour === 'function', 'startTour() is exported');
ok(STOPS.length >= 7, `the tour has its stops (${STOPS.length})`);
const ids = STOPS.map((s) => s.id);
for (const want of ['home', 'workouts', 'record', 'runner', 'data', 'profile', 'account', 'settings']) {
  ok(ids.includes(want), `a stop for ${want} (the plan's list)`);
}
ok(new Set(ids).size === ids.length, 'no stop id repeats');
ok(STOPS.every((s) => Array.isArray(s.targets) && s.targets.length && s.targets.every((t) => typeof t === 'string' && t)),
   'every stop names at least one target selector');
ok(STOPS.every((s) => /^#\/[a-z]+$/.test(s.route)), 'every stop has a route the router knows the shape of');
const long = STOPS.filter((s) => words(s.text) > 15);
ok(long.length === 0, `every bubble is 15 words or fewer (${long.map((s) => `${s.id}: ${words(s.text)}`).join(', ') || 'all short'})`);
ok(words(END.text) <= 15 && END.title, 'the end card is short and has a title');
ok(!STOPS.some((s) => /^#\/(session|start|system\/new|edit)/.test(s.route)),
   '🚨 no stop opens a screen that creates data (the runner, a new program, an edit)');

// Every selector must be valid CSS. Node has no DOM, so a cheap syntax check:
// balanced brackets and quotes.
const balanced = (s) => (s.match(/\[/g) || []).length === (s.match(/\]/g) || []).length
  && (s.match(/"/g) || []).length % 2 === 0 && (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;
ok(STOPS.every((s) => s.targets.every(balanced)), 'every selector is balanced');

// The selectors point at things the app actually draws.
const src = ['js/app.js', 'js/ui.js', 'js/views-workouts.js', 'js/views-muscles.js',
  'js/profile-shape.js', 'js/views-account.js'].map((f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
for (const cls of ['feed', 'sys-head', 'nav-primary', 'body-wrap', 'me-head', 'avatar-btn', 'navbar', 'pane-scroll']) {
  ok(src.includes(`'${cls}`) || src.includes(` ${cls}'`) || src.includes(`${cls} `), `the app still draws .${cls}`);
}
ok(src.includes("href: '#/settings'"), 'the Settings row still links #/settings');

ok(counter(2) === `3 of ${STOPS.length}`, 'the step counter reads "3 of N"');

// ---- the hole ----
const phone = { w: 393, h: 659 };
let s = spotRect({ x: 100, y: 200, w: 50, h: 40 }, phone);
ok(s.x === 94 && s.y === 194 && s.w === 62 && s.h === 52, 'the hole is the target plus 6px all round');
s = spotRect({ x: -30, y: 600, w: 500, h: 200 }, phone);
ok(s.x >= 0 && s.y + s.h <= phone.h && s.x + s.w <= phone.w, 'a target hanging off the screen is cut to the screen');
s = spotRect({ x: 16, y: 40, w: 361, h: 900 }, phone, { x: 0, y: 60, w: 393, h: 540 });
ok(s.y === 60 && s.y + s.h === 600, 'a card taller than its pane is cut to the pane (the tab bar stays dim)');

// ---- the bubble ----
const bubble = { w: 320, h: 110 };
let p = placeBubble({ x: 20, y: 80, w: 100, h: 40 }, bubble, phone);
ok(p.side === 'below' && p.y === 80 + 40 + 12, 'room below: the bubble sits under the hole');
p = placeBubble({ x: 150, y: 590, w: 90, h: 60 }, bubble, phone);
ok(p.side === 'above' && p.y + bubble.h === 590 - 12, '🚨 no room below (the tab bar): it FLIPS above');
p = placeBubble({ x: 0, y: 40, w: 393, h: 600 }, bubble, phone);
ok(p.side === 'over' && p.y >= GUTTER && p.y + bubble.h <= phone.h - GUTTER,
   'a hole taller than the screen: the bubble sits on it, inside the gutters');
p = placeBubble({ x: 360, y: 100, w: 30, h: 30 }, bubble, phone);
ok(p.x + p.w <= phone.w - GUTTER, `a target at the right edge: the bubble is clamped to the 16px gutter (right edge ${p.x + p.w})`);
ok(p.arrowX > p.w / 2 && p.x + p.arrowX <= 375 + 1, 'and its arrow still points at the target, not the bubble middle');
p = placeBubble({ x: 2, y: 100, w: 20, h: 20 }, bubble, phone);
ok(p.x === GUTTER, 'a target at the left edge: clamped to the left gutter');
ok(p.arrowX >= 18, 'the arrow never sits in the bubble corner');
p = placeBubble({ x: 150, y: 100, w: 30, h: 30 }, { w: 600, h: 110 }, phone);
ok(p.w === phone.w - GUTTER * 2 && p.x === GUTTER, 'a bubble wider than the phone is narrowed to fit between the gutters');
const desk = { w: 1440, h: 900 };
p = placeBubble({ x: 0, y: 300, w: 220, h: 44 }, bubble, desk);
ok(p.side === 'below' && p.x === GUTTER, 'the laptop sidebar: below the tab, clamped left');
const off = [];
for (let x = 0; x <= 393; x += 13) for (let y = 0; y <= 659; y += 29) {
  const q = placeBubble({ x, y, w: 40, h: 40 }, bubble, phone);
  if (q.x < GUTTER || q.x + q.w > phone.w - GUTTER || q.y < GUTTER || q.y + bubble.h > phone.h - GUTTER) off.push(`${x},${y}`);
}
ok(off.length === 0, `a sweep of targets across a 393×659 phone never puts the bubble outside the gutters (${off.length} off${off.length ? ', first at ' + off[0] : ''})`);

// ---- the seen flag ----
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const st = mem();
ok(TOUR_KEY === 'ftrack:v1:toured', 'the flag key is ftrack:v1:toured');
ok(hasToured(st) === false, 'a new browser has not seen the tour');
markToured(st);
ok(hasToured(st) === true && st.m.get(TOUR_KEY) === '1', 'after it runs, it is marked seen');
const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
let threw = false;
try { markToured(broken); ok(hasToured(broken) === false, 'storage that throws reads as not seen'); } catch (_) { threw = true; }
ok(!threw, 'storage that throws (private mode) never breaks the tour');

// ---- the Settings rows ----
const acct = readFileSync(new URL('../js/views-account.js', import.meta.url), 'utf8');
ok(/Take the tour/.test(acct) && /startTour\(\)/.test(acct), 'Account has a "Take the tour" row that calls startTour()');
ok(/Find me a program/.test(acct) && /import\('\.\/onboarding\.js'\)/.test(acct) && /openOnboarding\(/.test(acct),
   'and a "Find me a program" row that opens the questions');

// ---- the stylesheet ----
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const sec = css.slice(css.indexOf('/* === Tour === */'), css.indexOf('/* === end Tour === */'));
ok(sec.length > 100, 'the stylesheet has the Tour section');
ok(!/\d{3,}ms/.test(sec), 'the tour uses the motion tokens, no hand-written durations (Rule 7: ≤ 250ms)');
ok(/\.tour\s*\{[^}]*position:\s*fixed/.test(sec), 'the tour is one fixed layer, so nothing on the page moves when it opens');

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
