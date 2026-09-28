// The workout in progress, on disk — and the one rule for whether it is still
// live.
//
// ⚠️ MOVED OUT OF views-session.js ON 2026-09-07, AND THE MOVE IS THE POINT.
// A running workout used to be visible only from inside the runner, so the
// runner could own the answer to "is one open?". It cannot any more: the bar
// above the nav (js/live-session.js) asks that question on every screen in the
// app, and it cannot import the runner — the runner is the screen the bar
// exists to get back to, and a module that pulled in the whole recording flow
// to draw a two-line pill would drag the exercise picker in behind it.
//
// Nothing here changed in the move except its address. The same-day rule below
// was inline in SessionView and is now written once, because the bar and the
// runner disagreeing about whether yesterday's draft counts would put a live
// workout on screen that opening it then throws away.

import { demo } from './store.js';
import { minisOf } from './set-types.js';

const DRAFT_KEY = 'ftrack:v1:draftSession';

/* 🆕 The Empty workout's draft id (`#/session/new-empty`). Here, not only in
 * the runner, so the Record screen can say "Resume" for an open Empty workout
 * without loading the runner (wave 4). views-session.js re-exports it. */
export const EMPTY_SESSION_ID = 'new-empty';
/** Is this draft an open Empty workout? (No saved workout carries its id.) */
export const isEmptyDraft = (d) => Boolean(d && d.workoutId === EMPTY_SESSION_ID);

/**
 * ⚠️ THE DEMO ACCOUNT DOES NOT WRITE DRAFTS TO DISK.
 *
 * `store.js` swaps its whole BACKEND for an in-memory one inside the demo, so
 * no invented session can reach localStorage or Firestore — but the draft never
 * went through the store. It was written straight to localStorage, so running a
 * workout inside the demo left `ftrack:v1:draftSession` full of made-up sets on
 * the real device, and it survived leaving the demo. Found by the UX review,
 * 2026-08-22.
 *
 * ⚠️ It was near-harmless in practice and that is not the point. A strip on
 * every screen of the demo says *"nothing is saved"*, and docs/handbook.md §0.10
 * said *"nothing it does can reach localStorage"*. **Both were false**, and in
 * this project a claim that is false is a bigger defect than the leak it
 * describes. sessionStorage matches the demo flag's own lifetime: per tab, gone
 * when the browser closes, and never visible to the real account.
 */
const draftStore = () => {
  try {
    return demo.active() ? sessionStorage : localStorage;
  } catch (_) {
    return localStorage;
  }
};

/* 🆕 R-2 (2026-09-27): A FULL PHONE NO LONGER LOSES SETS SILENTLY.
 *
 * `saveDraft` used to swallow every error, so with localStorage full a tap on
 * + changed the screen and nothing reached disk (measured: `setItem` stubbed to
 * throw QuotaExceededError, three taps, draft unchanged, nothing shown). It now
 * returns whether the draft is on disk. On a failure it clears the cloud's
 * shard snapshots (`clearAllShardCaches()` in firebase-backend.js — a read
 * shortcut the next sync rebuilds, and up to 1.5 MB each) and tries once more.
 * If that fails too, the runner shows one line until a save works again.
 *
 * ⚠️ firebase-backend.js is fetched LAZILY, on the first save, never at boot:
 * it is 80 KB the app only needs when the cloud is on. By the time storage
 * runs out mid-workout it has long since arrived; if the very first save
 * fails, the retry runs when it lands and tells the listener. */
let clearCaches = null;
let clearerLoading = null;
function loadClearer() {
  if (clearCaches || clearerLoading) return clearerLoading || Promise.resolve();
  clearerLoading = import('./firebase-backend.js')
    .then((m) => { clearCaches = typeof m.clearAllShardCaches === 'function' ? m.clearAllShardCaches : null; })
    .catch(() => {});
  return clearerLoading;
}

let storageFull = false;
const draftListeners = new Set();
/** Is the last draft write still failing? (The runner's "storage is full" line.) */
export function draftStorageFull() { return storageFull; }
/** Called with `true`/`false` whenever a draft write fails or recovers. Returns an unsubscribe. */
export function onDraftStorage(fn) {
  draftListeners.add(fn);
  return () => draftListeners.delete(fn);
}
function setFull(v) {
  if (storageFull === v) return;
  storageFull = v;
  for (const fn of [...draftListeners]) { try { fn(v); } catch (_) { /* a listener's bug is not a lost set */ } }
}

function writeDraft(raw) {
  try { draftStore().setItem(DRAFT_KEY, raw); return true; } catch (_) { return false; }
}

/** Write the draft. True when it is on disk. */
export function saveDraft(d) {
  let raw;
  try { raw = JSON.stringify(d); } catch (_) { return false; }
  if (writeDraft(raw)) { setFull(false); loadClearer(); return true; }
  if (clearCaches) {
    try { clearCaches(); } catch (_) { /* nothing to clear */ }
    if (writeDraft(raw)) { setFull(false); return true; }
    setFull(true);
    return false;
  }
  setFull(true);
  // Not loaded yet: clear and retry once it is, with whatever is newest then.
  // 🆕 2026-09-27 (wave 4): ONE retry, of the NEWEST draft. Each failed save
  // used to queue its own retry holding its own `raw`; the first (the OLDEST
  // draft) won, set the flag false, and the newer ones then did nothing — so
  // the disk kept v1 of three. Only the latest failed draft is remembered.
  const first = pendingRaw === null;
  pendingRaw = raw;
  if (first) {
    loadClearer().then(() => {
      const newest = pendingRaw;
      pendingRaw = null;
      if (newest === null || !storageFull || !clearCaches) return;
      try { clearCaches(); } catch (_) { /* nothing to clear */ }
      if (writeDraft(newest)) setFull(false);
    });
  }
  return false;
}
/* The newest draft a save could not write while the clearer was loading. */
let pendingRaw = null;

export function loadDraft() {
  try { const r = draftStore().getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}

export function clearDraft() {
  // ⚠️ Cleared from BOTH. A draft written before the demo fix is sitting in real
  // localStorage on somebody's phone right now, and the demo is the one place
  // that can no longer see it to tidy it up.
  try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) {}
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
}

/* ------------------------------------------------------------------ *
 * 🆕 WHERE RECORD ROSE FROM — 2026-09-27 (overhaul I-4 / I-20).
 *
 * Tim, 2026-09-10: the runner's down arrow goes *"to the main page"*. It went
 * back ONE entry, which after Home → Record → Weightlifting → Legs is the Record
 * picker. The runner's exits now go back past the Record flow (`record`,
 * `start`, and any other runner entry) to the screen Record rose over.
 *
 * ⚠️ HISTORY CANNOT BE READ BACKWARDS, so the trail is written going forwards:
 * every entry's hash, keyed by the `navIndex` ui.js's `markRoute()` stamps on
 * it, in sessionStorage (it lives exactly as long as the tab's history does).
 * It is HERE because this module loads at boot with the live bar on every
 * screen (app.js → live-session.js → here), so it sees the whole visit —
 * the runner's own module could be loaded late. The stamp is read a tick after
 * `hashchange`, once the router has run `markRoute()`. An entry this never saw
 * is simply unknown, and the runner then goes back one, as before.
 * ------------------------------------------------------------------ */
const TRAIL_KEY = 'ftrack:v1:navTrail';
const TRAIL_MAX = 60;

function readTrail() {
  try { const r = sessionStorage.getItem(TRAIL_KEY); const v = r ? JSON.parse(r) : null; return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; }
}

/** Write `hash` (default: the current one) against the current entry's navIndex. */
export function stampTrail(hash) {
  try {
    const st = window.history && window.history.state;
    if (!st || typeof st.navIndex !== 'number') return;
    const t = readTrail();
    t[st.navIndex] = hash || window.location.hash;
    // Entries above this one are a forward branch nobody can reach now that a
    // new entry sits here; and keep the map small.
    for (const k of Object.keys(t)) {
      if (Number(k) > st.navIndex && !hash) delete t[k];
      else if (Number(k) < st.navIndex - TRAIL_MAX) delete t[k];
    }
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(t));
  } catch (_) { /* a trail is a nicety */ }
}

/** The route name of a hash: `#/start/x` → `start`. */
const routeOf = (hash) => String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];

/** Screens that are part of starting or running a workout, not a place to land. */
export const RECORD_FLOW = ['record', 'start', 'session'];

/**
 * How many entries back the screen Record rose over is, from entry `at`.
 * 0 means there is none (a cold deep link, or nothing but the Record flow
 * behind) — go to Home. An entry the trail never saw counts as a landing.
 * Pure over `trail` for the tests.
 */
export function stepsBackPastRecord(at, trail) {
  if (!(Number.isInteger(at) && at > 0)) return 0;
  let i = at - 1;
  while (i >= 0 && trail[i] != null && RECORD_FLOW.includes(routeOf(trail[i]))) i--;
  return i >= 0 ? at - i : 0;
}

/** `stepsBackPastRecord()` for the entry on screen now. */
export function stepsBackFromHere() {
  const st = typeof window !== 'undefined' && window.history && window.history.state;
  if (!st || typeof st.navIndex !== 'number') return 0;
  return stepsBackPastRecord(st.navIndex, readTrail());
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('hashchange', () => setTimeout(() => stampTrail(), 0));
  // The first screen of the visit, and a reload.
  setTimeout(() => stampTrail(), 0);
}

/** How long past midnight a workout started yesterday stays open (see below). */
export const LIVE_DRAFT_MS = 12 * 3600 * 1000;

/**
 * The draft if a workout is genuinely still open, otherwise null.
 *
 * A draft lives for the day it was started (and, since 2026-09-24, up to
 * twelve hours past it — below). Yesterday's abandoned session must not
 * silently reappear.
 *
 * ⚠️ The check is against `startedOn` — the day the draft was CREATED — and not
 * against `date`, which is the day the session is recorded FOR and which the
 * user can move. Comparing `date` would mean back-dating a workout threw its own
 * draft away the moment you switched apps. `date` is the fallback for drafts
 * written before `startedOn` existed.
 *
 * ⚠️ `today` is passed IN rather than read from a clock, the same way
 * `next-workout.js` and `strength-observations.js` take theirs, so a test can
 * put a draft on either side of midnight without waiting for one.
 *
 * 🆕 2026-09-24 (review): **A WORKOUT OPEN PAST MIDNIGHT IS STILL LIVE.** The
 * day rule alone threw away a session started at 23:00 the moment the clock
 * rolled over — the runner then `clearDraft()`ed it on the next open, sets and
 * all. So a draft started YESTERDAY also counts while `startedAt` is under
 * `LIVE_DRAFT_MS` old. It keeps its own `date`, so it still saves to the day
 * it was started. The start day has to be yesterday as well as the instant
 * being recent, so a draft whose two fields disagree is not rescued by either.
 * No `startedAt` (an old draft) is the day rule, exactly as before.
 *
 * @param {string} today  todayISO()
 * @param {number} [now]  ms; defaults to the clock, passed in by tests
 */
export function liveDraft(today, now = Date.now()) {
  const d = loadDraft();
  if (!d || !d.workoutId) return null;
  const day = d.startedOn || d.date;
  if (day === today) return d;
  const t = Date.parse(d.startedAt);
  if (!Number.isFinite(t) || !(now - t >= 0 && now - t < LIVE_DRAFT_MS)) return null;
  const [y, m, dd] = String(today).split('-').map(Number);
  const prev = new Date(y, m - 1, dd - 1);
  const yesterday = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-`
    + String(prev.getDate()).padStart(2, '0');
  return day === yesterday ? d : null;
}

/**
 * Whole seconds the workout has been RUNNING — paused time taken off — or null
 * if the draft never said when it started.
 *
 * 🆕 2026-09-23, Autumn via Tim: *"she went to the bathroom and it kept
 * going."* A pause is two fields on the draft: `pausedAt` (ms, set while
 * paused) and `pausedMs` (every finished pause, added up). While paused the
 * clock stands at `pausedAt`, so it reads the same on every tick.
 *
 * ⚠️ HERE AND NOT IN THE RUNNER, because the bar on every other screen draws
 * the same clock, and the two disagreeing about a pause would show a workout
 * ticking on Home that says Paused inside it. Read from timestamps, never
 * accumulated per tick, for the rest timer's reason: a backgrounded tab
 * throttles intervals.
 */
export function activeSeconds(d, now) {
  const t = Date.parse(d && d.startedAt);
  if (!Number.isFinite(t)) return null;
  const pausedAt = Number(d.pausedAt) || 0;
  const end = pausedAt || now;
  return Math.max(0, Math.floor((end - t - (Number(d.pausedMs) || 0)) / 1000));
}

/* ------------------------------------------------------------------ *
 * What counts as a set somebody actually did
 *
 * ⚠️ MOVED HERE FROM INSIDE SessionView ON 2026-09-07, WHEN THE THIRD CALLER
 * APPEARED. It was a closure in the runner, which was right while the runner
 * was the only thing that had to answer the question. It is now asked by the
 * save screen (how much is about to be written), by the conflict screen (how
 * much starting another workout would destroy) and by the bar's own bin (how
 * much this tap is about to delete) — and three copies of "was this set really
 * performed" is precisely the shape of thing this project deletes functions
 * over. One definition, and every screen that talks about a count is quoting
 * the same rule the save path filters on.
 * ------------------------------------------------------------------ */

/** Any of the exercise's own fields carrying a real number. */
export function hasNumbers(set, fields) {
  // ⚠️ The exercise's OWN FIELDS, not Object.values(set). A set carries a
  // `minis` array and `Number([{…}])` is NaN — so a blanket check happens to
  // work and would throw away a set whose numbers were all in its drops.
  return (fields || []).some((f) => Number(set[f]) > 0);
}

/**
 * ⚠️ A SET STILL MARKED `prefilled` IS NOT RECORDED, whatever numbers are in
 * it. Everything else in this app treats "has a number" as "was performed",
 * which is true of a number somebody typed and false of one the app worked out
 * for them.
 *
 * 🆕 2026-09-23 — EXCEPT THE PLAN'S NUMBERS (`fromPlan`). Tim: *"last numbers
 * should count, since they might intentionally not touch it if it was the same
 * as last time."* A prescribed set accepted as it stands was done as
 * prescribed. Here rather than only in the save filter, so the save screen's
 * count and the discard warnings quote the same rule the save keeps.
 */
export function setIsRecorded(set, fields) {
  // 🆕 2026-09-27: a set the Auto-guide's Skip left behind is not a set done
  // (Tim: "Skip leaves the set unrecorded and moves on"), whatever numbers
  // last time left in it — unless it was Finished after all.
  if (set.skipped && !set.done && !set.locked) return false;
  return (!set.prefilled || Boolean(set.fromPlan))
    && (hasNumbers(set, fields) || minisOf(set).some((d) => hasNumbers(d, fields)));
}

/** Every set a person really typed into this draft — guests included. */
export function draftRecordedSets(d) {
  const walk = (entries) => (entries || []).reduce(
    (n, e) => n + (e.sets || []).filter((s) => setIsRecorded(s, e.fields || [])).length, 0);
  if (!d) return 0;
  return walk(d.entries) + (d.others || []).reduce((n, o) => n + walk(o.entries), 0);
}

/**
 * 🆕 WHOSE TURN IS IT NEXT — 2026-09-27. Tim: *"if you're in a group workout
 * and you click finish for one set for one person, have it automatically go to
 * the next person's details on their next set, makeing the alternating between
 * the two people really easy."*
 *
 * `people` is everybody in PILL ORDER (You, then guests as added), each
 * `{ entries }`. The person at `from` just finished a set of `exerciseId`,
 * which sits at `entryIndex` in their own list. Returns the next person after
 * them, wrapping round, who still has an unfinished working set of that
 * exercise — `{ pos, entryIndex, set }` — or null when nobody else does (the
 * caller then keeps the solo behaviour).
 *
 * ⚠️ THEIR ENTRY IS THE ONE AT THE SAME POSITION when it is the same exercise
 * (a synced list — and in a superset that is the same member), otherwise
 * their first entry of that exercise with a set left, because a "Just for"
 * edit can leave the lists different shapes. Warm-ups live in `entry.warmups`,
 * never in `sets`, so they can never be "the next set". `locked` is a
 * pre-2026-09-23 draft's word for `done`.
 */
export function nextPersonTurn(people, from, exerciseId, entryIndex) {
  const n = (people || []).length;
  const openSet = (e) => (e && e.exerciseId === exerciseId && Array.isArray(e.sets)
    ? e.sets.findIndex((s) => !(s && (s.done || s.locked)))
    : -1);
  for (let k = 1; k < n; k++) {
    const pos = (from + k) % n;
    const entries = (people[pos] && people[pos].entries) || [];
    // The same entry only, when it is this exercise — never a second copy of
    // the lift further down the workout.
    const same = entries[entryIndex] && entries[entryIndex].exerciseId === exerciseId;
    for (const i of same ? [entryIndex] : entries.keys()) {
      const set = openSet(entries[i]);
      if (set !== -1) return { pos, entryIndex: i, set };
    }
  }
  return null;
}
