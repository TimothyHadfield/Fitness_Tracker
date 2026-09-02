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

import { el, icon, fmtTime, confirmSheet, refreshRoute } from './ui.js';
import { liveDraft, clearDraft, draftRecordedSets } from './session-draft.js';
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

  /* ⚠️ ALL OF THE BAR EXCEPT THE BIN IS THE WAY BACK, not just the arrow. Hevy
   * draws a circular button on the left and the app's own touch-target rule
   * (0i) is why ours does not stop there: a 44px circle at the edge of a 56px
   * bar means the other 250px of an obviously-tappable pill does nothing. An
   * anchor also gets the browser's own focus ring and middle-click for free,
   * which a div with an onClick does not.
   *
   * ⚠️ AND THE BIN IS ITS SIBLING, NOT ITS CHILD. A <button> inside an <a> is
   * invalid HTML and browsers recover from it differently — the one thing that
   * must never be ambiguous here is whether a tap opens the workout or deletes
   * it. */
  const open = el('a', {
    class: 'session-mini-open',
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

  /**
   * The bin — Tim, 2026-09-07: *"add a trash can on the right side of the box
   * that delets the workout if the user clicks on it."*
   *
   * ⚠️ IT ASKS FIRST WHEN THERE IS SOMETHING TO LOSE, AND ONLY THEN. That is
   * not a hedge on the instruction, it is the rule this app already applies to
   * every other destructive control: removing a person from a workout confirms
   * when sets are recorded for them and goes quietly when none are, and the
   * save screen's Discard does the same. **A one-tap delete would be the only
   * unconfirmed destructive control in the app, and it would be the one that
   * sits under the thumb on every screen for the length of a workout** — beside
   * the nav, where the next tap is usually Home. With nothing recorded there is
   * nothing to warn about and it simply goes.
   */
  const bin = el('button', {
    class: 'mini-del',
    'aria-label': `Discard ${draft.workoutName || 'this workout'}`,
    onClick: () => {
      const lost = draftRecordedSets(draft);
      if (!lost) { clearDraft(); refreshRoute(); return; }
      confirmSheet({
        title: `Discard ${draft.workoutName || 'this workout'}?`,
        message: `${lost} recorded set${lost === 1 ? '' : 's'} will be deleted. This cannot be undone.`,
        confirmLabel: 'Discard',
        danger: true,
        // ⚠️ `refreshRoute`, so the screen behind the bar redraws without it and
        // without pushing a history entry — the bar is built by the router, and
        // clearing the draft under it would otherwise leave a control on screen
        // pointing at a workout that no longer exists.
        onConfirm: () => { clearDraft(); refreshRoute(); },
      });
    },
  }, icon('trash', 17));

  const bar = el('div', { class: 'session-mini' }, open, bin);

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
