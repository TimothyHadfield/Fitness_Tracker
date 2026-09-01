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

const DRAFT_KEY = 'ftrack:v1:draftSession';

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

export function saveDraft(d) {
  try { draftStore().setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {}
}

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

/**
 * The draft if a workout is genuinely still open, otherwise null.
 *
 * A draft only lives for the day it was started. Yesterday's abandoned session
 * must not silently reappear and get saved with today's date.
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
 * @param {string} today  todayISO()
 */
export function liveDraft(today) {
  const d = loadDraft();
  if (!d || !d.workoutId) return null;
  return (d.startedOn || d.date) === today ? d : null;
}
