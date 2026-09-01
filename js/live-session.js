// "You have a workout open" — the bar above the nav.
//
// Tim, 2026-09-07: *"I want the user to be able to leave a workout and interact
// with the rest of the cite and then come back to the workout at any time … if a
// workout is currently running, it will appear as a box right above the main
// bars with an up arrow, and if you click on the up arrow it brings you back
// inside the workout."*
//
// 🚨 THE DRAFT ALREADY SURVIVED LEAVING — WHAT DID NOT EXIST WAS THE WAY BACK.
// Every set has been written to `ftrack:v1:draftSession` since the runner
// shipped, and starting the same workout again on the same day has always
// resumed it. But the only door was the workout's own row in the Record picker,
// and the only thing that said so was a sentence in the sheet you got on the way
// out. So the feature was real, invisible, and indistinguishable from having
// lost the session. This is the door.
//
// ⚠️ IT IS IN THE LAYOUT, NOT FLOATING OVER IT. `.update-bar` is `position:
// fixed` and can be, because it is transient — it covers the bottom of one
// screen for as long as it takes to tap Refresh. This bar is up for the length
// of a workout, and a fixed one would sit permanently on top of the primary
// action of every screen that has one (`.pane-bottom`), which is where "Save
// changes" and "Finish" live. As the last child of `.screen` it takes real
// height instead, on the phone's column layout and the desktop's sidebar layout
// alike, and nothing is ever underneath it.

import { el, icon, fmtTime } from './ui.js';
import { liveDraft } from './session-draft.js';
import { stepsFor } from './set-types.js';

/**
 * Which exercise the runner is pointing at.
 *
 * ⚠️ THROUGH `stepsFor`, NEVER `entries[index]`. `state.index` walks STEPS and a
 * superset contributes one step per member per round, so the two indices are not
 * the same number — the runner's own swap path carries this warning and a second
 * reading of it here that got it wrong would name the wrong lift on the bar
 * exactly when a workout is at its most complicated.
 */
function currentExercise(draft) {
  const entries = Array.isArray(draft.entries) ? draft.entries : [];
  if (!entries.length) return null;
  const all = stepsFor(entries.map((e) => ({ sets: (e.sets || []).length, group: e.group })));
  if (!all.length) return null;
  const i = Math.max(0, Math.min(Number(draft.index) || 0, all.length - 1));
  const entry = entries[all[i].entryIndex];
  return entry ? entry.exerciseName || null : null;
}

/** Whole seconds since the workout was started, or null if it never said. */
function elapsed(draft, now) {
  const t = Date.parse(draft.startedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 1000));
}

/**
 * The bar, or null when there is nothing open.
 *
 * @param {object} opts
 * @param {string} opts.route   the current route NAME, so the runner does not
 *                              draw a way back to itself
 * @param {string} opts.today   todayISO()
 * @param {number} [opts.now]   Date.now(), passed in for the same reason
 * @returns {HTMLElement|null}
 */
export function liveSessionBar({ route, today, now = Date.now() }) {
  // ⚠️ Not on the session screen itself, and not on the finish screen — which
  // needs no rule, because finish() clears the draft before it paints.
  if (route === 'session') return null;
  const draft = liveDraft(today);
  if (!draft) return null;

  const secs = elapsed(draft, now);
  const clock = el('span', { class: 'mini-clock mono', text: secs === null ? '' : fmtTime(secs) });
  const where = currentExercise(draft);

  /* ⚠️ THE WHOLE BAR IS THE CONTROL, not the arrow inside it. Hevy draws a
   * circular button on the left and the app's own touch-target rule (0i) is why
   * ours does not stop there: a 44px circle at the edge of a 56px bar means the
   * other 250px of an obviously-tappable pill does nothing. An anchor also gets
   * the browser's own focus ring and middle-click for free, which a div with an
   * onClick does not. */
  const bar = el('a', {
    class: 'session-mini',
    href: '#/session/' + encodeURIComponent(draft.workoutId),
    'aria-label': `Back to ${draft.workoutName || 'your workout'}`,
  },
    el('span', { class: 'mini-arrow' }, icon('up', 18)),
    el('span', { class: 'mini-text' },
      el('span', { class: 'mini-head' },
        el('span', { class: 'mini-dot' }),
        el('b', { class: 'mini-name', text: draft.workoutName || 'Workout' }),
        clock,
      ),
      // ⚠️ The second line is dropped rather than left empty when the walk has
      // nothing to point at — a workout whose exercises were all removed, or a
      // draft written before entries existed. An empty line would reserve the
      // height and read as a name that failed to load.
      where ? el('span', { class: 'mini-now', text: where }) : null,
    ),
  );

  /* The clock ticks from the TIMESTAMP on every tick, never accumulated — the
   * rest timer's rule, and for the same reason: a backgrounded tab throttles
   * intervals, so a counter that added a second each time would silently run
   * slow while the app was not in front of you, which is most of a workout.
   *
   * ⚠️ The interval clears itself once the bar leaves the document. Every route
   * change builds a new bar and drops the old one, so an interval that only
   * stopped when told to would leave one running per screen visited. */
  if (secs !== null && typeof setInterval === 'function') {
    const id = setInterval(() => {
      if (!bar.isConnected) { clearInterval(id); return; }
      clock.textContent = fmtTime(elapsed(draft, Date.now()));
    }, 1000);
  }

  return bar;
}
