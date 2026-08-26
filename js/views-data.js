// Calendar, day detail, graphs, settings.

import {
  store, auth, social, seriesForExercise, chartableExercises, activityByDate, todayISO, benchmarkComparison,
  normalizedSeries, defaultTargetReps, bodyWeightSeries, SOURCE_LABEL, currentBests,
  CLOUD_WARN_AT,
} from './store.js';
import { FIELD_META, LOAD_LABEL } from './exercises.js';
import {
  clampReps, repConfidence, normalizeBlockedReason, MIN_TARGET_REPS, MAX_TARGET_REPS,
} from './e1rm.js';
import {
  setChildren, el, iconBtn, toast, screenShell, emptyState, confirmSheet, openSheet, miniStepper, chevron,
  fmtSet, fmtField, fmtDateLong, fmtDateShort, trimNum, fmtTime, loadBadge,
} from './ui.js';
import { muscleGroupsPane } from './views-muscles.js';
import { ageStrengthSeries, appGradingCurve, AGE_SOURCE, NOT_COVERED } from './research-data.js';
import { ageCoefficient } from './strength-standards.js';
import { minisOf, groupLabel, miniLabel } from './set-types.js';
import { yearsToShow, buildYear, daysLabel, DOW_LABELS } from './year-grid.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

// Which way the calendar is being read. Module-level so it survives leaving the
// screen and coming back — somebody who prefers the year view should not have
// to re-pick it after every trip to a day.
let calMode = 'months'; // 'months' | 'years'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Whole days between two ISO dates. Noon avoids a DST shift turning a clean
// multiple of 24h into 23 and rounding a day away.
const dayGap = (a, b) =>
  Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

/* ================================================================== *
 * Calendar
 * ================================================================== */

// Months run as one continuous vertical scroll rather than paging with arrows.
// The range covers at least the last 12 months, extended back to the earliest
// thing recorded, and opens scrolled to the current month.
function monthRange(activity) {
  const now = new Date();
  const endIdx = now.getFullYear() * 12 + now.getMonth();
  let startIdx = endIdx - 11;

  const dates = [...activity.keys()].sort();
  if (dates.length) {
    const [y, m] = dates[0].split('-').map(Number);
    startIdx = Math.min(startIdx, y * 12 + (m - 1));
  }

  const out = [];
  for (let i = startIdx; i <= endIdx; i++) out.push({ year: Math.floor(i / 12), month: i % 12 });
  return out;
}

function monthBlock(year, month, activity, today) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const isCurrent = today.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);

  const cells = [
    ...Array.from({ length: first }, () => el('div', { class: 'cal-cell blank' })),
    ...Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = activity.get(iso);

      const cls = ['cal-cell'];
      if (iso === today) cls.push('today');
      if (rec && rec.sessions.length) cls.push('has-workout');
      else if (rec && rec.benchmarks.length) cls.push('has-benchmark-only');

      // ⚠️ THE INNER SPAN IS NOT DECORATION. `.cal-tag` is a flex box that
      // centres its content so the name sits in the middle of the space it
      // fills; the line clamp that keeps a long name to two lines needs its own
      // block to apply to, and putting both on one element makes them fight.
      const tag = (cls, text) =>
        el('span', { class: 'cal-tag ' + cls, title: text }, el('span', { text }));

      const tags = [];
      if (rec) {
        const shown = rec.sessions.slice(0, 2);
        for (const s of shown) tags.push(tag('w', s.workoutName || 'Workout'));
        if (rec.sessions.length > shown.length) {
          tags.push(el('span', { class: 'cal-tag more', text: `+${rec.sessions.length - shown.length}` }));
        }
        if (rec.benchmarks.length) tags.push(tag('b', 'Benchmark'));
      }

      const label = rec
        ? `${MONTHS[month]} ${day}: ${rec.sessions.map((s) => s.workoutName).join(', ')}${rec.benchmarks.length ? (rec.sessions.length ? ', ' : '') + 'benchmark' : ''}`
        : `${MONTHS[month]} ${day}, nothing recorded`;

      return el('button', { class: cls.join(' '), onClick: () => go('#/day/' + iso), 'aria-label': label },
        el('span', { class: 'cal-day', text: String(day) }),
        el('span', { class: 'cal-tags' }, tags),
      );
    }),
  ];

  return el('section', {
    class: 'cal-month' + (isCurrent ? ' is-current' : ''),
    dataset: isCurrent ? { currentMonth: 'true' } : {},
  },
    el('div', { class: 'cal-month-head' },
      el('h2', { class: 'cal-title', text: `${MONTHS[month]} ${year}` }),
      el('div', { class: 'cal-dows' },
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => el('div', { class: 'cal-dow', text: d }))),
    ),
    el('div', { class: 'cal-grid' }, cells),
  );
}

/* ------------------------------------------------------------------ *
 * The year grid — years of training on one screen
 *
 * Tim, 2026-08-22, with a reference image: one tiny box per day, coloured if
 * he trained. The maths is in `js/year-grid.js`; this is the drawing.
 *
 * ⚠️ TAP SELECTS, IT DOES NOT NAVIGATE — and that is a touch decision, not a
 * preference. A cell here is about 6px on a 393px phone, because 53 weeks have
 * to fit across, which is the whole point of the view. Six pixels is under any
 * hit-target standard there is, so a tap that navigated would send people to
 * days they did not mean roughly as often as to days they did. Instead a tap
 * fills a readout that stays on screen, and the readout itself is the
 * full-width control that opens the day. Two taps, neither of them a gamble.
 *
 * ⚠️ WCAG 2.5.8 is satisfied by EQUIVALENCE, not by exemption. Every day
 * reachable here is reachable at 40px in the Months view, one tap away on the
 * same screen — the standard's own "equivalent control" case. The small squares
 * are an enhancement layered over that, never the only route to a day, which is
 * also why the grid is a picture with a summary rather than 366 focus stops
 * nobody can land on.
 * ------------------------------------------------------------------ */

function yearsPane(activity, today, onPick) {
  const active = (isoDate) => {
    const rec = activity.get(isoDate);
    return Boolean(rec && (rec.sessions.length || rec.benchmarks.length));
  };

  const years = yearsToShow([...activity.keys()], today);
  return years.map((year) => {
    const g = buildYear(year, active, today);

    const cells = [];
    g.columns.forEach((week, ci) => {
      week.forEach((cell, ri) => {
        if (!cell) return;
        const cls = ['yr-cell'];
        if (cell.active) cls.push('on');
        if (cell.isToday) cls.push('today');
        cells.push(el('div', {
          class: cls.join(' '),
          style: `grid-column:${ci + 1};grid-row:${ri + 1}`,
          dataset: { iso: cell.iso },
        }));
      });
    });

    const grid = el('div', {
      class: 'yr-grid',
      style: `grid-template-columns:repeat(${g.columns.length},minmax(0,1fr))`,
      role: 'img',
      'aria-label': `${year}: ${daysLabel(g.activeDays)}. Open the Months view to reach a day.`,
      onClick: (e) => {
        const box = e.target.closest('.yr-cell');
        if (!box) return;
        grid.querySelectorAll('.yr-cell.sel').forEach((n) => n.classList.remove('sel'));
        box.classList.add('sel');
        onPick(box.dataset.iso);
      },
    }, cells);

    return el('section', { class: 'yr' },
      el('div', { class: 'yr-head' },
        el('h2', { class: 'yr-title', text: String(year) }),
        el('span', { class: 'yr-count', text: daysLabel(g.activeDays) }),
      ),
      // The month strip lives INSIDE the two-column body so it shares the
      // grid's own column track. Sitting outside it, it would have to guess the
      // width of the day-name gutter, and a month label one gutter out of true
      // is worse than no month labels at all.
      el('div', { class: 'yr-body' },
        // ⚠️ minmax(0,1fr), NEVER 1fr. A bare `1fr` is `minmax(auto, 1fr)`, so
        // each column refuses to shrink below the min-content of the label
        // sitting in it — 53 columns each forced to the width of "Jan" made
        // this strip a third wider than the grid it labels and slid every
        // month leftward. Measured 2026-08-22: "Nov" sat over 20 August.
        // A month label two columns out of true is a lie nobody can catch by
        // eye at 7px, which is exactly why it was measured rather than looked at.
        el('div', { class: 'yr-months', style: `grid-template-columns:repeat(${g.columns.length},minmax(0,1fr))` },
          g.monthLabels.map((m) => el('span', {
            class: 'yr-month', text: m.text, style: `grid-column:${m.col + 1}/span 4`,
          }))),
        el('div', { class: 'yr-dows' },
          DOW_LABELS.map((d) => el('span', { class: 'yr-dow', text: d }))),
        grid,
      ),
    );
  });
}

export async function CalendarView() {
  const activity = await activityByDate();
  const today = todayISO();
  const months = monthRange(activity);

  // ⚠️ RESERVED, NEVER REVEALED. The readout holds its row whether or not a day
  // is selected, because Design Rule 3's corollary — content must not shrink
  // because you asked it a question — is exactly what a line appearing on tap
  // would break: every grid below it would jump by its height the first time
  // anybody touched a square. Empty, it says what to do instead.
  const readout = el('button', {
    class: 'yr-readout', 'aria-live': 'polite', disabled: true,
    text: 'Tap a day to see what you did',
  });

  const pickDay = (isoDate) => {
    const rec = activity.get(isoDate) || { sessions: [], benchmarks: [] };
    const names = rec.sessions.map((s) => s.workoutName || 'Workout');
    if (rec.benchmarks.length) names.push(`${rec.benchmarks.length} benchmark${rec.benchmarks.length > 1 ? 's' : ''}`);
    readout.disabled = false;
    readout.onclick = () => go('#/day/' + isoDate);
    // ⚠️ The YEAR is part of the date here, where it is not on other screens.
    // This is the one view in the app showing several years at once, and
    // "Jul 14" over a grid holding four different July 14ths names nothing.
    setChildren(readout,
      el('span', { class: 'yr-r-date', text: `${fmtDateShort(isoDate)}, ${isoDate.slice(0, 4)}` }),
      el('span', { class: 'yr-r-what', text: names.length ? names.join(' · ') : 'Nothing recorded' }),
      chevron(),
    );
  };

  // The grid is the content, so the legend rides in the header rather than
  // costing a row of its own. In Years mode the legend would be wrong — that
  // view paints one colour on purpose — so it is hidden and the readout takes
  // the row underneath instead.
  const legend = el('div', { class: 'legend' },
    el('span', {}, el('i', { class: 'w' }), 'Workout'),
    el('span', {}, el('i', { class: 'b' }), 'Benchmark'),
  );

  const tabs = [['months', 'Months'], ['years', 'Years']].map(([m, label]) =>
    el('button', {
      class: 'seg', role: 'tab', 'aria-selected': String(calMode === m), text: label,
      onClick: () => { if (calMode !== m) { calMode = m; paint(); } },
    }));

  const screen = screenShell({
    profile: true,
    // ⚠️ ITS OWN TITLE AGAIN, since 2026-08-25. This carried the four-way Data
    // switch while Calendar was a mode of that tab; it is a tab in its own right
    // now, so borrowing another tab's control would light up a segment for a
    // screen that is no longer in it.
    title: 'Calendar',
    top: el('div', { class: 'cal-modes' },
      el('div', { class: 'segmented sub', role: 'tablist' }, tabs), legend, readout),
    scroll: [],
  });

  /**
   * ⚠️ THE SCREEN NODE IS NEVER REPLACED, only repainted — and that is not a
   * performance choice.
   *
   * `app.js` PREPENDS things into the node a view returns: in the demo account
   * it prepends the "nothing is saved" strip. The first version of this switch
   * rebuilt the whole screen and swapped it in, which silently threw that strip
   * away — so switching to Years inside the demo removed the one thing on the
   * page saying the data is invented. Caught by a screenshot, not by a test.
   *
   * The general rule, which is worth more than this instance: **a view does not
   * own the node it returned.** Anything re-rendering itself in place must
   * repaint its own contents and leave the container alone.
   */
  function paint() {
    const isYears = calMode === 'years';
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.textContent === (isYears ? 'Years' : 'Months'))));
    legend.hidden = isYears;
    readout.hidden = !isYears;

    const pane = screen.querySelector('.pane-scroll');
    if (isYears) {
      setChildren(pane, ...(activity.size
        ? yearsPane(activity, today, pickDay)
        : [emptyState('No training recorded yet',
          'Every day you finish a workout fills in a square here. A year fits on one screen.')]));
      pane.scrollTop = 0;
    } else {
      setChildren(pane, ...months.map(({ year, month }) => monthBlock(year, month, activity, today)));
      landOnCurrentMonth(screen);
    }
  }

  paint();
  return screen;
}

function landOnCurrentMonth(screen) {

  // Land on the current month once the screen is in the document.
  //
  // ⚠️ THE SCROLL HAS TO BE GIVEN SOMETHING TO SCROLL AGAINST FIRST. The current
  // month is the LAST section in the list, so a scroller that ends with it
  // cannot bring it to the top: the assignment below is silently CLAMPED to
  // `scrollHeight - clientHeight` and the calendar opens with the previous month
  // filling the top of the screen. Measured 2026-08-21 at 393×852 — it asked for
  // 4363, got 4076, and 287px of a phone showed July when today was in August.
  // Deterministic, every visit, and invisible to every existing test because
  // nothing asserts where a scroller ended up.
  //
  // The arithmetic was never wrong, so the fix is not new arithmetic. The last
  // month is given exactly the trailing room the shortfall needs and no more —
  // padding it by a fixed fraction of the viewport would work too and would put
  // half a screen of void under December for the sake of August.
  setTimeout(() => {
    const pane = screen.querySelector('.pane-scroll');
    const current = screen.querySelector('[data-current-month]');
    if (!pane || !current) return;

    const last = pane.lastElementChild;
    if (last) {
      const shortfall = pane.clientHeight - last.getBoundingClientRect().height;
      last.style.paddingBottom = shortfall > 0 ? `${Math.ceil(shortfall)}px` : '';
    }

    // Measured against the pane rather than through offsetTop: the two elements
    // do not share an offsetParent (the pane's is #app, a month's is body), so
    // subtracting one from the other only works by coincidence of layout.
    pane.scrollTop += current.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  }, 0);

  return screen;
}

/**
 * THE DATA SWITCH — three ways of looking backwards, in one control.
 *
 * ⚠️ CALENDAR LEFT THIS CONTROL ON 2026-08-25 and became its own nav tab, on
 * Tim's instruction. That reverses the 2026-08-22 merge, whose argument was that
 * both are the past — one drawn as squares, one as lines. The argument was about
 * what the two screens ARE; his is about how often he opens them, and he is the
 * one using this in a gym. Frequency wins over taxonomy.
 *
 * ⚠️ AND IT TAKES THE CONTROL'S ONE ODDITY WITH IT. All three remaining entries
 * are now the same kind of thing: in-page state on `#/graphs`. Calendar was the
 * only one that navigated, which is why this function needed a special case and
 * an `onChartMode` fallback for "arriving from the calendar". Both are gone.
 *
 * ⚠️ MUSCLES IS FIRST AND IS THE DEFAULT — Tim, 2026-08-25: *"In the Data
 * section, the muscle group should be the first tab and the default tab for when
 * the user opens the section."* See `graphMode`'s initial value; the order here
 * and that value have to agree, and there is an assertion that they do.
 *
 * ⚠️ "Bars", not "Bar Chart". The 2026-08-21 phone survey measured the
 * THREE-segment version clipping this exact label to "Bar Char" at 393px. The
 * row is back to three segments, so the label would now fit — it is kept short
 * anyway, because nothing is gained by the word and a fourth segment has been
 * added to this row once already.
 */
// ⚠️ Four segments again (Research joined 2026-08-28, Tim's ask). The clipping
// this comment used to warn about was "Bar Chart" at 393px on a THREE-segment
// row; the labels are all short now and the row was driven at 360px with all
// four after the change — no clipping. If a fifth ever arrives, measure first.
const DATA_TABS = [['muscles', 'Muscles'], ['trend', 'Graph'], ['compare', 'Bars'], ['research', 'Research']];

function dataTabs(active, onChartMode) {
  return el('div', { class: 'segmented', role: 'tablist' },
    DATA_TABS.map(([key, label]) =>
      el('button', {
        class: 'seg', role: 'tab', 'aria-selected': String(key === active),
        // NOTHING here is disabled. Both chart modes fall back to the
        // current-bests list when they cannot draw a line, so a tab always
        // leads somewhere useful — which is the whole point of that list
        // existing. Disabling them was what made a new user's Data screen
        // feel empty.
        disabled: false,
        text: label,
        onClick: () => {
          graphMode = key;
          if (onChartMode) onChartMode();
          else go('#/graphs');
        },
      })),
  );
}

/* ================================================================== *
 * Day detail
 * ================================================================== */

/**
 * "Send this to <name>" for a guest record — Open work 0e's friend half.
 *
 * ⚠️ IT ASKS WHO, rather than guessing from the guest's name. A guest name is
 * free text typed mid-workout ("Alex", "alex", "my brother"), and matching that
 * against a friends list would eventually put somebody's training in the wrong
 * account. Picking from the real list is one tap and cannot be wrong.
 */
function handoffRow(guest, date) {
  return el('button', {
    class: 'btn small block', text: `Send this to ${guest.guestName}`,
    onClick: async () => {
      let state;
      try { state = await social.state(); } catch (_) { state = { available: false }; }
      if (!state.available || !state.connections.length) {
        toast('Connect with them on the Friends tab first.');
        return;
      }
      const sheet = openSheet({
        title: 'Send this to whom?',
        body: el('div', { class: 'list' },
          el('div', { class: 'field-help', text:
            `They will be offered “${guest.workoutName || 'Workout'}” from ${fmtDateLong(date)} `
            + 'and can add it to their own training. ⚠️ Nothing is written into their account '
            + 'unless they accept it, and your copy stays here either way.' }),
          ...state.connections.map((c) => el('button', {
            class: 'row', style: 'width:100%;text-align:left',
            onClick: async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              try {
                await social.offerSession(c.uid, guest, guest.guestName);
                toast(`Sent to ${c.name || 'them'}.`);
                sheet.close();
              } catch (err) { btn.disabled = false; toast(err.message); }
            },
          }, el('div', { class: 'row-main' },
             el('div', { class: 'row-title', text: c.name || 'Friend' })))),
        ),
      });
    },
  });
}

export async function DayView(date) {
  const [activity, exMap, guestRows] = await Promise.all([
    activityByDate(), store.getExerciseMap(),
    // Older stores have no guest collection; an empty list is the right read.
    store.getGuestSessions().catch(() => []),
  ]);
  const rec = activity.get(date) || { sessions: [], benchmarks: [] };
  const guestSessions = guestRows.filter((g) => g.date === date);

  const scroll = [];

  if (!rec.sessions.length && !rec.benchmarks.length && !guestSessions.length) {
    scroll.push(emptyState('Nothing recorded on this day',
      'Days fill in automatically when you finish a workout or log a benchmark.'));
  }

  // The set-by-set body of one session, shared by the owner's records and the
  // guests' — what was done reads identically whoever did it.
  const entryNodes = (s) => s.entries.map((e, ei) => {
    const ex = exMap.get(e.exerciseId);
    const fields = ex ? ex.fields : ['weight', 'reps'];
    const loadType = ex ? ex.loadType : null;
    // A superset was performed as one unit, so the record has to say so —
    // otherwise the day reads as two ordinary exercises that happened to be
    // next to each other, which is not what was done.
    const prev = s.entries[ei - 1];
    const opensGroup = e.group != null && (!prev || prev.group !== e.group);
    return el('div', { class: 'detail-ex' + (e.group == null ? '' : ' in-group') },
      opensGroup
        ? el('div', { class: 'detail-group-label', text:
            groupLabel(s.entries.filter((o) => o.group === e.group).length) })
        : null,
      el('div', { class: 'detail-ex-head' },
        el('span', { class: 'detail-ex-name', text: e.exerciseName }),
        loadType ? loadBadge(loadType) : null,
      ),
      el('div', { class: 'detail-sets' },
        // A set and its drops are ONE run, so a wrap can never leave a drop
        // sitting next to the wrong set number.
        ...e.sets.map((set, i) => el('div', { class: 'detail-set-run' },
          el('div', { class: 'detail-set' },
            el('b', { text: `Set ${i + 1}` }),
            el('span', { text: fmtSet(set, fields, loadType) }),
          ),
          // Mini-sets follow their set and are never given a set number
          // of their own — one drop set or myo-rep is one hard set (§6).
          ...minisOf(set).map((d) => el('div', { class: 'detail-set is-drop' },
            el('b', { text: '↳ ' + miniLabel(e.setType).toLowerCase() }),
            el('span', { text: fmtSet(d, fields, loadType) }),
          )),
        )),
      ),
    );
  });

  for (const s of rec.sessions) {
    const setCount = s.entries.reduce((n, e) => n + e.sets.length, 0);
    scroll.push(el('div', { class: 'card' },
      el('div', { class: 'day-head' },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { class: 'day-title' },
            s.workoutName || 'Workout',
            s.isBenchmark ? el('span', { class: 'bench-badge', text: 'benchmark' }) : null,
          ),
          el('div', { class: 'row-sub', text: `${s.entries.length} exercise${s.entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}` }),
        ),
        // Edit before delete: correcting a record is the common intent, and
        // putting the destructive button first invites the wrong tap.
        iconBtn('edit', 'Edit this workout record', () => go('#/edit/' + s.id)),
        iconBtn('trash', 'Delete this workout record', () => confirmSheet({
          title: 'Delete this record?',
          message: `“${s.workoutName}” from ${fmtDateLong(date)} will be permanently removed, including from your graphs.`,
          onConfirm: async () => { await store.deleteSession(s.id); toast('Record deleted'); refresh(); },
        })),
      ),
      ...entryNodes(s),
    ));
  }

  /* Sessions recorded FOR A GUEST — somebody trained with, on this phone,
   * with no account of their own (Open work 0e). Kept apart from the owner's
   * records because they are apart: nothing in them touches the owner's
   * graphs, muscle map or volume, and the label has to make that visible
   * rather than leave a stranger's squat looking like the owner's. No edit —
   * a guest record is a favour held for somebody, not training to maintain;
   * delete covers the mistyped ones. */
  if (guestSessions.length) {
    scroll.push(el('div', { class: 'section-label', text: 'Recorded for others' }));
    for (const g of guestSessions) {
      const setCount = g.entries.reduce((n, e) => n + e.sets.length, 0);
      scroll.push(el('div', { class: 'card' },
        el('div', { class: 'day-head' },
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'day-title', text: `${g.guestName} — ${g.workoutName || 'Workout'}` }),
            el('div', { class: 'row-sub', text:
              `Their session, kept on your account · ${g.entries.length} exercise${g.entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}` }),
          ),
          iconBtn('trash', `Delete ${g.guestName}'s record`, () => confirmSheet({
            title: 'Delete this record?',
            message: `${g.guestName}’s “${g.workoutName}” from ${fmtDateLong(date)} will be permanently removed. It is the only copy — they have no account it could live on.`,
            onConfirm: async () => { await store.deleteGuestSession(g.id); toast('Record deleted'); refresh(); },
          })),
        ),
        ...entryNodes(g),
        /* ⚠️ HANDING IT OVER — Open work 0e's friend half, built 2026-08-27.
         *
         * The guest half stores this under the recorder's account because the
         * person had no account to put it on. The moment they DO — Tim's friend
         * who could not sign in, now signed in and connected — this row is the
         * bridge: offer it to them and their own client writes it into their own
         * training on accept.
         *
         * ⚠️ It OFFERS rather than sends, which was Tim's own call. They see
         * what was logged in their name before it lands, and nothing is ever
         * written into anybody's history by somebody else's client. */
        handoffRow(g, date),
      ));
    }
  }

  // Benchmarks derived from a benchmark WORKOUT are already shown, set by set,
  // in that workout's own card above. Listing them again here would make the day
  // read as twice as much work as was actually done, so only hand-entered
  // benchmarks get their own section; the workout card carries a badge instead.
  const ownBenchmarks = rec.benchmarks.filter((b) => !b.sourceSessionId);
  if (ownBenchmarks.length) {
    scroll.push(el('div', { class: 'section-label', text: 'Benchmarks' }));
    for (const b of ownBenchmarks) {
      const ex = exMap.get(b.exerciseId);
      const fields = ex ? ex.fields : Object.keys(b.values || {});
      const loadType = ex ? ex.loadType : null;
      scroll.push(el('div', { class: 'card' },
        el('div', { class: 'day-head' },
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'detail-ex-head' },
              el('span', { class: 'detail-ex-name', text: b.exerciseName }),
              loadType ? loadBadge(loadType) : null,
            ),
            el('div', { class: 'row-sub mono', text: fmtSet(b.values || {}, fields, loadType) }),
          ),
          iconBtn('trash', 'Delete benchmark', () => confirmSheet({
            title: 'Delete this benchmark?',
            message: `${b.exerciseName} from ${fmtDateLong(date)} will be permanently removed.`,
            onConfirm: async () => { await store.deleteBenchmark(b.id); toast('Benchmark deleted'); refresh(); },
          })),
        ),
      ));
    }
  }

  return screenShell({
    title: fmtDateShort(date),
    sub: fmtDateLong(date),
    back: () => go('#/calendar'),
    scroll,
  });
}

// Force the router to rebuild the current view after a delete.
function refresh() {
  const h = location.hash;
  location.hash = '#/blank';
  setTimeout(() => { location.hash = h; }, 0);
}

/* ================================================================== *
 * Graphs
 * ================================================================== */

// Body weight is charted through the same exercise picker rather than taking a
// fourth tab — it is the same question, a number over time, and the mode switch
// is already three wide on a phone. It sits LAST so the default chart on the
// Data screen is still a lift.
const BODY_WEIGHT_ID = '__bodyweight';

let graphChoice = { exerciseId: null, field: null };
// ⚠️ 'muscles', NOT 'trend' — Tim, 2026-08-25: the muscle map is the first tab
// and the one the Data screen opens on. It is also the mode that works with the
// least history: a single benchmark colours the map, where a line chart needs
// two points before it can draw anything. This is module-level, so it survives
// leaving the screen and comes back where you left it; 'muscles' is only the
// value the session STARTS at.
let graphMode = 'muscles'; // 'muscles' | 'trend' | 'compare'
let compareField = null;
// exerciseId -> rep count everything is compared at. Seeded from the most
// frequently recorded rep count, then whatever the user steps it to.
// Keyed by exercise AND source, because the two sources can have different
// habitual rep counts.
const targetReps = new Map();
// exerciseId -> 'benchmark' | 'workout'. An explicit tap always wins.
const sourceChoice = new Map();

// WHICHEVER SOURCE HAS MORE DAYS TO DRAW, ties to benchmarks.
//
// Tim, 2026-08-16: *"default should be mostly workout measurements"* — the one
// part of that day's request that went unmet for three days. It used to hard
// default to benchmarks whenever any existed, so an exercise with forty logged
// sessions and two benchmarks opened on a two-point line and hid the forty.
// Most people never record a benchmark at all; the ones who do record a handful
// beside months of training.
//
// This is NOT a breach of D14. That rule is about never MIXING the two on one
// line — a benchmark is taken fresh and a workout set comes after everything
// else, so charting them together makes strength look like it swings wildly,
// and one-point-per-day silently discarded a reading. Both problems are about
// combining sources. Which single source is preselected is a different
// question, and the chips are one tap away either way.
//
// Ties go to benchmarks because a deliberate test IS the better measurement —
// this only overrules that when the other source has strictly more to show.
function pickSource(opt) {
  const chosen = sourceChoice.get(opt.id);
  if (chosen && opt.usableSources.includes(chosen)) return chosen;
  if (opt.usableSources.length < 2) return opt.usableSources[0];
  const best = opt.usableSources.reduce((a, b) =>
    ((opt.sources[b].days || 0) > (opt.sources[a].days || 0) ? b : a),
  opt.usableSources.includes('benchmark') ? 'benchmark' : opt.usableSources[0]);
  return best;
}

export async function GraphView() {
  const [options, comparison, bwPoints, bests] = await Promise.all([
    chartableExercises(2), benchmarkComparison(2), bodyWeightSeries(), currentBests(),
  ]);

  // ONE weigh-in is enough to normalise a pull-up, where TWO are needed to draw
  // a body-weight line — different questions, so they get different thresholds
  // rather than sharing the convenient one.
  const latestBodyWeight = bwPoints.length
    ? Number(bwPoints[bwPoints.length - 1].value) || 0
    : 0;

  // Two weigh-ins to make a line, the same bar every exercise has to clear.
  const bwOption = bwPoints.length >= 2
    ? { id: BODY_WEIGHT_ID, name: 'Body weight', fields: ['weight'] }
    : null;
  const trendOptions = bwOption ? [...options, bwOption] : options;

  // No early return. An earlier version bailed out to a bare empty state when
  // there was nothing to chart, which took the mode switch with it and made
  // Muscles unreachable — precisely when it is the most useful thing here,
  // since it works off a single benchmark and explains what to record next.
  // Each mode now renders its own empty state inside the normal shell.
  // No mode is force-switched away from any more either. A mode with no line to
  // draw still shows where every lift stands, so bouncing the user to a
  // different tab would take away the thing they came to look at.

  // The chart owns the screen. Controls are one compact row, and the mode switch
  // lives in the header instead of a redundant "Graphs" heading.
  const top = el('div', { class: 'graph-controls' });
  const host = el('div', { class: 'graph-host' });

  const modeSwitch = dataTabs(graphMode, () => render());

  /* ---------- trend (line, all sources) ---------- */

  async function renderTrend() {
    if (!trendOptions.length) {
      setChildren(top);
      // A line needs two days. Where there is only one, the numbers still exist
      // and are worth showing — telling someone who has just logged a full
      // workout that there is "nothing to chart" reads as the app having lost
      // their data (Tim, 2026-08-17).
      setChildren(host, bestsPane(bests, 'A line needs the same lift on two different days. '
        + 'Until then, here is where everything stands.'));
      return;
    }
    if (!graphChoice.exerciseId || !trendOptions.find((o) => o.id === graphChoice.exerciseId)) {
      graphChoice = { exerciseId: trendOptions[0].id, field: trendOptions[0].fields[0] };
    }
    const opt = trendOptions.find((o) => o.id === graphChoice.exerciseId);

    const mkOption = (o) =>
      el('option', { value: o.id, text: o.name, selected: o.id === graphChoice.exerciseId });

    const picker = el('select', {
      class: 'input compact',
      'aria-label': 'What to chart',
      onChange: (e) => {
        graphChoice.exerciseId = e.target.value;
        const next = trendOptions.find((o) => o.id === e.target.value);
        graphChoice.field = next.fields[0];
        targetReps.clear();          // recompute defaults for the new exercise
        render();
      },
    },
      // Grouped only when there is something to separate — a lone group label
      // over one item is noise.
      bwOption && options.length
        ? [el('optgroup', { label: 'Exercises' }, options.map(mkOption)),
           el('optgroup', { label: 'You' }, mkOption(bwOption))]
        : trendOptions.map(mkOption),
    );

    if (opt.id === BODY_WEIGHT_ID) return renderBodyWeight(picker);

    const source = pickSource(opt);

    // Only offered when the exercise genuinely has both. No control for a
    // choice that doesn't exist (D9).
    const sourceChips = opt.usableSources.length > 1
      ? el('div', { class: 'chips tight' }, opt.usableSources.map((s) =>
          el('button', {
            class: 'chip', 'aria-pressed': String(s === source),
            text: SOURCE_LABEL[s],
            onClick: () => { sourceChoice.set(opt.id, s); render(); },
          })))
      : null;

    if (opt.sources[source].normalizable) return renderNormalized(opt, picker, source, sourceChips);

    // Everything else keeps a plain metric selector: for a weighted carry or a
    // run, the two metrics do not trade off against each other the way weight
    // and reps do, so choosing between them is a real choice.
    const fields = opt.sources[source].fields;
    if (!fields.includes(graphChoice.field)) graphChoice.field = fields[0];

    setChildren(top,
      el('div', { class: 'control-row' },
        picker,
        sourceChips,
        fields.length > 1
          ? el('div', { class: 'chips tight' }, fields.map((f) =>
              el('button', {
                class: 'chip', 'aria-pressed': String(f === graphChoice.field),
                text: FIELD_META[f].label,
                onClick: () => { graphChoice.field = f; render(); },
              })))
          : null,
      ),
    );

    if (!graphChoice.field) {
      setChildren(host, emptyState('Nothing to chart from this source',
        `No ${SOURCE_LABEL[source].toLowerCase()} recorded for this exercise yet.`));
      return;
    }

    const points = await seriesForExercise(graphChoice.exerciseId, graphChoice.field, source);
    if (points.length < 2) {
      // One point is not a line, but it IS a measurement. Show it.
      const one = points[0];
      setChildren(host, emptyState(
        'One recording so far',
        one
          ? `${fmtField(graphChoice.field, one.value)} on ${fmtDateShort(one.date)}. `
            + 'Record it on another day and this becomes a line.'
          : 'Record this exercise on another day to see a line.'));
      return;
    }

    // Passing the body weight changes what this can SAY, not just what it
    // computes: without it a bodyweight exercise is told "we only chart the
    // added load", which is a dead end. With it the caption can name the one
    // thing that would fix it — a weigh-in — or stay silent because there is
    // nothing to fix. `latestBodyWeight` is 0 when nobody has ever weighed in,
    // which is exactly the case that wants the actionable wording.
    const blocked = normalizeBlockedReason(opt.exercise, { bodyWeight: latestBodyWeight });
    const plot = el('div', { class: 'chart-wrap' });
    setChildren(host,
      plot,
      el('div', { class: 'chart-foot' },
        summaryStats(points, graphChoice.field),
        graphChoice.field === 'weight' && opt.loadType
          ? el('div', { class: 'chart-caption' }, loadBadge(opt.loadType),
              el('span', { text: `weight shown is ${LOAD_LABEL[opt.loadType]}` }))
          : null,
        blocked
          ? el('div', { class: 'chart-caption' },
              el('span', { text: `Not compared at a fixed rep count — ${blocked}.` }))
          : null,
      ),
    );
    fillChart(plot, points, graphChoice.field);
  }

  /* ---------- rep-normalised trend (weight + reps exercises) ---------- */

  async function renderNormalized(opt, picker, source, sourceChips) {
    const key = opt.id + '|' + source;
    let target = targetReps.get(key);
    if (target == null) {
      target = clampReps(await defaultTargetReps(opt.id, source)) || 10;
      targetReps.set(key, target);
    }

    setChildren(top,
      el('div', { class: 'control-row' },
        picker,
        sourceChips,
        el('div', { class: 'rep-target' },
          miniStepper({
            value: target,
            min: MIN_TARGET_REPS,
            max: MAX_TARGET_REPS,
            label: 'reps',
            onChange: (v) => { targetReps.set(key, v); render(); },
          }),
          el('span', { class: 'rep-target-label', text: 'reps' }),
        ),
      ),
    );

    const points = await normalizedSeries(opt.id, target, source);
    if (points.length < 2) {
      setChildren(host, emptyState('Only one data point',
        `Record this exercise with a weight and a rep count on another day to see a line. `
        + `Showing ${SOURCE_LABEL[source].toLowerCase()} only.`));
      return;
    }

    const measured = points.filter((p) => p.actual).length;
    const conf = repConfidence(target);
    const plot = el('div', { class: 'chart-wrap' });

    setChildren(host,
      plot,
      el('div', { class: 'chart-foot' },
        summaryStats(points, 'weight'),
        el('div', { class: 'chart-caption' },
          opt.loadType ? loadBadge(opt.loadType) : null,
          el('span', { class: 'pt-key' }),
          el('span', {
            text: `${SOURCE_LABEL[source]} only · ${measured} measured at ${target} reps · rest estimated`
              + (opt.loadType ? ` · ${LOAD_LABEL[opt.loadType]}` : ''),
          }),
        ),
        conf !== 'good'
          ? el('div', { class: 'chart-caption warn' }, el('span', {
              text: conf === 'poor'
                ? `Above 15 reps a set is limited by breathing and grip more than strength — estimates here are unreliable.`
                : `Estimates get looser above 10 reps.`,
            }))
          : null,
      ),
    );
    fillChart(plot, points, 'weight');
  }

  /* ---------- body weight ---------- */

  // No sources to choose between and nothing to normalise, so the control row
  // is just the picker and the chart gets the rest of the screen (Rule 3).
  function renderBodyWeight(picker) {
    setChildren(top, el('div', { class: 'control-row' }, picker));

    const days = dayGap(bwPoints[0].date, bwPoints[bwPoints.length - 1].date);
    const plot = el('div', { class: 'chart-wrap' });
    setChildren(host,
      plot,
      el('div', { class: 'chart-foot' },
        // Direction is deliberately NOT judged here. Gaining is the goal for one
        // person and losing it for the next, and nothing has ever asked which —
        // colouring a gain red would be the app inventing an opinion it has no
        // basis for. Every point is a real weigh-in, so every point keeps a
        // marker (Rule 5); nothing here is estimated.
        summaryStats(bwPoints, 'weight', false),
        el('div', { class: 'chart-caption' }, el('span', {
          text: `${bwPoints.length} weigh-ins over ${days} day${days === 1 ? '' : 's'} · one per day, `
            + 'the last one that day wins',
        })),
      ),
    );
    fillChart(plot, bwPoints, 'weight', 'Body weight over time');
  }

  /* ---------- compare (paired bars, benchmarks only) ---------- */

  function renderCompare() {
    if (!comparison.fields.length) {
      setChildren(top);
      setChildren(host, bestsPane(bests,
        'This compares your first benchmark against your latest, so it needs the same exercise '
        + 'benchmarked on two different days. Until then, here is where everything stands.'));
      return;
    }
    if (!compareField || !comparison.fields.includes(compareField)) compareField = comparison.fields[0];
    const rows = comparison.byField[compareField];

    setChildren(top,
      el('div', { class: 'control-row' },
        comparison.fields.length > 1
          ? el('div', { class: 'chips tight' }, comparison.fields.map((f) =>
              el('button', {
                class: 'chip', 'aria-pressed': String(f === compareField),
                text: FIELD_META[f].label,
                onClick: () => { compareField = f; render(); },
              })))
          : null,
        el('div', { class: 'bar-legend' },
          el('span', {}, el('i', { class: 'k-start' }), 'First'),
          el('span', {}, el('i', { class: 'k-now' }), 'Latest'),
        ),
      ),
    );

    const note = comparison.incomplete[compareField];
    const anyNormalized = rows.some((r) => r.atReps);
    setChildren(host,
      barChart(rows, compareField),
      el('div', { class: 'chart-foot' },
        el('div', { class: 'chart-caption' },
          el('span', {
            text: 'Benchmarks only'
              + (anyNormalized ? ' · @N reps means weight compared at that rep count, faded bars estimated' : '')
              + (note ? ` · ${note} more need a second benchmark` : ''),
          })),
      ),
    );
  }

  async function render() {
    // Indexed off the shared list, so adding or reordering a segment cannot
    // leave the selected state pointing at the wrong one.
    modeSwitch.querySelectorAll('.seg').forEach((b, i) =>
      b.setAttribute('aria-selected', String(DATA_TABS[i][0] === graphMode)));
    // Muscles is the one mode with a side panel on a wide screen, so it is the
    // one mode that lays out as a row. The class carries that; the CSS decides
    // at which width it actually applies.
    host.classList.toggle('is-muscles', graphMode === 'muscles');
    if (graphMode === 'muscles') await muscleGroupsPane(host, top);
    else if (graphMode === 'compare') renderCompare();
    else if (graphMode === 'research') await renderResearchPane(host, top);
    else await renderTrend();
  }

  await render();

  return screenShell({
    profile: true,
    title: modeSwitch,
    top,
    scroll: host,
  });
}

/* ---- draw the line chart at the pixel size of its container ---- */

let chartObserver = null;

function fillChart(host, points, field, label) {
  let lastW = 0, lastH = 0;

  const draw = () => {
    const w = Math.round(host.clientWidth);
    const h = Math.round(host.clientHeight);
    if (w < 60 || h < 60) return;          // not laid out yet
    if (w === lastW && h === lastH) return; // nothing changed
    lastW = w; lastH = h;
    setChildren(host, lineChart(points, field, w, h, label));
  };

  // The observer is the reliable trigger — it fires once the element is in the
  // document and again on rotation or resize. The rAF just avoids a blank frame.
  if (chartObserver) chartObserver.disconnect();
  requestAnimationFrame(draw);
  if (typeof ResizeObserver !== 'undefined') {
    chartObserver = new ResizeObserver(draw);
    chartObserver.observe(host);
  }
}

/* ---- where every lift stands right now ---- */
//
// Both chart modes need the same thing recorded on two different days before
// they can draw anything, which left a new user staring at "Nothing to chart
// yet" while the app held every number they had entered. This is what fills
// that space instead: one row per exercise, best effort, how long ago.
//
// It is a list rather than a chart on purpose. There is no trend in a single
// recording, and drawing one would be inventing a shape out of one point —
// Rule 5, an inference must never look like a measurement.
function bestsPane(bests, intro) {
  if (!bests || !bests.length) {
    return emptyState(
      'Nothing recorded yet',
      'Log a workout or record a benchmark and your numbers will appear here.',
      el('button', { class: 'btn primary', text: 'Record a benchmark', onClick: () => go('#/benchmark') }),
    );
  }

  return el('div', { class: 'bests' },
    el('div', { class: 'field-help', text: intro }),
    el('div', { class: 'bests-list' },
      ...bests.map((b) => el('div', { class: 'best-row' },
        el('div', { class: 'best-main' },
          el('div', { class: 'best-name', text: b.name }),
          el('div', { class: 'best-sub' },
            b.muscle || '',
            b.muscle ? ' · ' : '',
            b.days === 0 ? 'today' : b.days === 1 ? 'yesterday' : `${b.days} days ago`,
            b.sessions > 1 ? ` · ${b.sessions} days recorded` : '',
            b.best.source === 'benchmark' ? ' · benchmarked' : '',
          ),
        ),
        el('div', { class: 'best-nums' },
          el('div', { class: 'best-set mono', text: bestSetText(b) }),
          // The estimated max is the comparable number across rep counts, and it
          // is explicitly labelled an estimate so it cannot be read as a lift
          // that was actually performed.
          b.e1rm
            ? el('div', { class: 'best-e1rm mono', text: `~${units.withUnit(Math.round(b.e1rm))} max` })
            : null,
        ),
      ))),
    el('div', { class: 'field-help', text:
      'Best effort for each lift. "~max" is an estimate from your reps, not a weight you have lifted.' }),
  );
}

function bestSetText(b) {
  const s = b.best;
  // loadType is a property of the EXERCISE, not of the set — reading it off the
  // set silently dropped "/side" from every dumbbell lift.
  if (s.weight > 0 && s.reps >= 1) {
    return `${units.fmtWeight(s.weight)}${b.loadType === 'per_side' ? '/side' : ''} × ${s.reps}`;
  }
  if (s.time > 0) return fmtTime(s.time) + (s.distance > 0 ? ` · ${trimNum(s.distance)} mi` : '');
  if (s.distance > 0) return `${trimNum(s.distance)} mi`;
  if (s.weight > 0) return units.fmtWeight(s.weight);
  return '—';
}

/* ---- paired horizontal bars: first benchmark vs latest ---- */

function barChart(rows, field) {
  if (!rows || !rows.length) {
    return emptyState('Nothing to compare yet',
      'Record the same exercise as a benchmark on two different days and it will appear here.');
  }

  const max = Math.max(...rows.flatMap((r) => [r.start, r.now])) || 1;
  const fmt = (v) => (field === 'time' ? fmtTime(v) : trimNum(Math.round(v * 100) / 100));
  const judged = field !== 'time';

  const bar = (kind, value, label, estimated) =>
    el('div', { class: 'bar-line' },
      el('span', { class: 'bar-tag', text: label }),
      el('div', { class: 'bar-track' },
        el('div', {
          class: 'bar ' + kind + (estimated ? ' est' : ''),
          style: `width:${Math.max(2, (value / max) * 100)}%`,
        })),
      el('span', { class: 'bar-val mono' + (estimated ? ' est' : ''), text: fmt(value) }),
    );

  return el('div', { class: 'bars' },
    rows.map((r) => {
      const cls = !judged || r.delta === 0 ? '' : r.delta > 0 ? ' up' : ' down';
      const sign = r.delta > 0 ? '+' : r.delta < 0 ? '−' : '';
      return el('div', { class: 'bar-row' },
        el('div', { class: 'bar-head' },
          el('span', { class: 'bar-name', text: r.name }),
          r.atReps ? el('span', { class: 'bar-reps mono', text: `@${r.atReps} reps` }) : null,
          el('span', { class: 'bar-delta mono' + cls, text: `${sign}${fmt(Math.abs(r.delta))}${r.pct === null ? '' : ` · ${r.delta > 0 ? '+' : ''}${r.pct.toFixed(0)}%`}` }),
        ),
        bar('start', r.start, 'Start', r.startActual === false),
        bar('now', r.now, 'Now', r.nowActual === false),
      );
    }),
  );
}

/* ---- SVG line chart ---- */

function lineChart(points, field, W = 360, H = 220, label = null) {
  const padL = 44, padR = 12, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;

  const ts = points.map((p) => new Date(p.date + 'T00:00:00').getTime());
  const vs = points.map((p) => p.value);
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  let vMin = Math.min(...vs), vMax = Math.max(...vs);
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const pad = (vMax - vMin) * 0.12;
  vMin -= pad; vMax += pad;
  if (field !== 'time' && vMin < 0) vMin = 0;

  const x = (t) => padL + (tMax === tMin ? iw / 2 : ((t - tMin) / (tMax - tMin)) * iw);
  const y = (v) => padT + ih - ((v - vMin) / (vMax - vMin)) * ih;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label || `${FIELD_META[field].label} over time`);

  const mk = (tag, attrs, cls) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (cls) n.setAttribute('class', cls);
    return n;
  };
  const add = (tag, attrs, cls) => {
    const n = mk(tag, attrs, cls);
    svg.append(n);
    return n;
  };

  // More gridlines when there is more height to fill.
  const steps = ih > 300 ? 5 : ih > 170 ? 4 : 3;

  // ⚠️ THE AXIS PRECISION FOLLOWS THE GAP BETWEEN GRIDLINES, not a fixed decimal
  // place. The old rule rounded every label to 0.1, which on a squat chart printed
  // 279.9 · 248.1 · 216.3 — a tenth of a pound on a barbell, which is a precision
  // nobody has and reads as a machine talking rather than a number. Rounding to
  // whole numbers unconditionally is the opposite mistake: a body-weight chart
  // spanning three pounds would print the same figure on two adjacent lines.
  //
  // Deriving it from the step keeps both from happening — every label is as
  // coarse as it can be while still being different from its neighbour.
  const gap = (vMax - vMin) / steps;
  const dp = gap >= 5 ? 0 : gap >= 0.5 ? 1 : 2;

  for (let i = 0; i <= steps; i++) {
    const v = vMin + gap * i;
    const yy = y(v);
    add('line', { x1: padL, x2: W - padR, y1: yy, y2: yy }, 'grid-line');
    const t = add('text', { x: padL - 7, y: yy + 3.5, 'text-anchor': 'end' }, 'axis-text');
    t.textContent = field === 'time' ? fmtTime(v) : trimNum(Number(v.toFixed(dp)));
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(ts[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  add('path', { d: `${d} L${x(ts[ts.length - 1]).toFixed(1)},${padT + ih} L${x(ts[0]).toFixed(1)},${padT + ih} Z` }, 'series-area');
  add('path', { d }, 'series-line');

  // A marker means "you actually lifted this, at this rep count". Estimated
  // points are carried by the line alone and get no marker, so a glance
  // separates measurement from inference. `actual` is undefined on charts that
  // are not rep-normalised, where every point is a measurement.
  points.forEach((p, i) => {
    if (p.actual === false) return;
    const last = i === points.length - 1;
    add('circle', { cx: x(ts[i]).toFixed(1), cy: y(p.value).toFixed(1), r: last ? 5.5 : 4 },
      last ? 'pt pt-last' : 'pt' + (p.source === 'benchmark' ? ' bench' : ''));
  });

  // Roughly one date label per 90px of width.
  const maxLabels = Math.max(2, Math.min(points.length, Math.floor(iw / 90)));
  const labelIdx = points.length <= 2
    ? [0, points.length - 1]
    : Array.from({ length: maxLabels }, (_, i) =>
        Math.round((i * (points.length - 1)) / (maxLabels - 1)));
  [...new Set(labelIdx)].forEach((i) => {
    const t = add('text', {
      x: x(ts[i]).toFixed(1),
      y: H - 9,
      'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
    }, 'axis-text');
    t.textContent = fmtDateShort(points[i].date);
  });

  /* ---- hover crosshair ---- */
  // Reading a value off a line chart by eye is guesswork, and these numbers are
  // the whole point of the screen. Hovering snaps to the nearest point and says
  // exactly what it is.
  //
  // The readout is plain text with a ground-coloured halo (paint-order: stroke)
  // rather than a boxed tooltip — it stays legible over gridlines and the area
  // fill without violating Rule 2.
  const hoverG = mk('g', { visibility: 'hidden', 'pointer-events': 'none' }, 'hover');
  const hLine = mk('line', { y1: padT, y2: padT + ih }, 'hover-line');
  const hDot = mk('circle', { r: 5 }, 'hover-dot');
  const hVal = mk('text', { y: padT + 14 }, 'hover-val');
  const hDate = mk('text', { y: padT + 28 }, 'hover-date');
  hoverG.append(hLine, hDot, hVal, hDate);
  svg.append(hoverG);

  const showAt = (i) => {
    const p = points[i];
    const px = x(ts[i]), py = y(p.value);

    hLine.setAttribute('x1', px.toFixed(1));
    hLine.setAttribute('x2', px.toFixed(1));
    hDot.setAttribute('cx', px.toFixed(1));
    hDot.setAttribute('cy', py.toFixed(1));
    // An estimate keeps its dashed identity here too — never let an inference
    // read as a measurement (Rule 5).
    hDot.setAttribute('class', 'hover-dot' + (p.actual === false ? ' est' : ''));

    // Keep the readout inside the plot instead of letting it clip at the edges.
    const anchor = px > W - padR - 64 ? 'end' : px < padL + 64 ? 'start' : 'middle';
    for (const t of [hVal, hDate]) {
      t.setAttribute('x', px.toFixed(1));
      t.setAttribute('text-anchor', anchor);
    }

    hVal.textContent = fmtField(field, Math.round(p.value * 10) / 10)
      + (p.actual === false ? '  est' : '');
    hDate.textContent = fmtDateShort(p.date);
    hoverG.setAttribute('visibility', 'visible');
  };

  const nearest = (clientX) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return 0;
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < ts.length; i++) {
      const d = Math.abs(x(ts[i]) - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  // pointer* covers mouse, pen and touch in one path. Nothing is prevented, so
  // a finger dragging over the chart still scrolls the screen.
  svg.addEventListener('pointermove', (ev) => showAt(nearest(ev.clientX)));
  svg.addEventListener('pointerdown', (ev) => showAt(nearest(ev.clientX)));
  svg.addEventListener('pointerleave', () => hoverG.setAttribute('visibility', 'hidden'));
  svg.addEventListener('pointercancel', () => hoverG.setAttribute('visibility', 'hidden'));

  return svg;
}

/* ---- summary beside the graph ---- */

function summaryStats(points, field, judged = field !== 'time') {
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const diff = last - first;
  const pct = first === 0 ? null : (diff / Math.abs(first)) * 100;

  // Direction is only good/bad when bigger is clearly better. Time is ambiguous
  // (a faster mile is better, a longer plank is better) so it stays neutral, and
  // callers can force neutral for anything else the app has no opinion on.
  const cls = !judged || diff === 0 ? '' : diff > 0 ? ' up' : ' down';
  const sign = diff > 0 ? '+' : '';
  const fmt = (v) => (field === 'time' ? fmtTime(v) : trimNum(Math.round(v * 100) / 100));

  return el('div', { class: 'summary-grid' },
    stat('Start', fmt(first), '', fmtDateShort(points[0].date)),
    stat('Now', fmt(last), '', fmtDateShort(points[points.length - 1].date)),
    stat('Change', (diff > 0 ? '+' : diff < 0 ? '−' : '') + fmt(Math.abs(diff)), cls),
    stat('Change %', pct === null ? '—' : `${sign}${pct.toFixed(1)}%`, cls),
  );
}

function stat(label, value, cls = '', sub) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-label', text: label }),
    el('div', { class: 'stat-value' + cls, text: value }),
    sub ? el('div', { style: 'font-size:11.5px;color:var(--ink-faint)', text: sub }) : null,
  );
}

/* ================================================================== *
 * Settings
 * ================================================================== */

// What Settings says about where the data lives. It must never claim a backup
// exists when it doesn't — an anonymous account is one browser-clear from gone.
function describeAccount(state, configured) {
  // Checked before `configured`, because in the demo the answer has nothing to
  // do with whether cloud accounts are switched on: nothing here is being
  // stored anywhere at all, and both of the other answers would be false.
  if (state.mode === 'demo') {
    return {
      title: 'Demo account',
      sub: 'Nothing here is saved — not to this device, not to an account',
      dataHelp: 'You are looking at made-up data. Reloading starts it over, and leaving brings '
        + 'your real account back exactly as it was. Download backup and Delete all data below '
        + 'act on this demo only.',
    };
  }
  if (!configured) {
    return {
      title: 'This device only',
      sub: 'Cloud accounts not switched on',
      dataHelp: 'Everything is stored on this device. Download a backup regularly — and always before clearing your browser data.',
    };
  }
  if (state.mode === 'local') {
    // Naming the cause matters: "could not be reached" reads as a broken
    // account, and the usual cause is simply no connection.
    return state.offline
      ? {
          title: 'Offline',
          sub: 'Saving to this device — will sync when you reconnect',
          dataHelp: 'This device has no internet connection, so changes are being saved here. '
            + 'They upload by themselves once you are back online.',
        }
      : {
          title: 'Not connected',
          sub: 'Saving to this device — nothing is syncing',
          dataHelp: 'Your account server cannot be reached at the moment — usually a connection '
            + 'problem rather than anything wrong with your account. Changes are being saved here '
            + 'and upload once it returns.',
        };
  }
  const u = state.user || {};
  if (u.isAnonymous) {
    return {
      title: 'No account yet',
      sub: 'Your data is not backed up — tap to secure it',
      dataHelp: 'Your data lives only in this browser. Clearing your browsing data will erase it permanently. Add an account, or download a backup.',
    };
  }
  return {
    title: u.email || 'Signed in',
    sub: 'Synced to your account',
    dataHelp: 'Your data syncs to your account and works offline. A downloaded backup is still the only copy you control directly.',
  };
}

/* ------------------------------------------------------------------ *
 * The cloud is running out of room
 *
 * ⚠️ SILENT UNTIL IT MATTERS, and that is the design. The UX review's fifth
 * finding was that the red "not backed up" dot is on from the first paint,
 * including on an empty account with nothing to lose — a permanent warning is
 * wallpaper within a week and stops being read at the moment it becomes true.
 * This returns nothing at all below CLOUD_WARN_AT.
 *
 * ⚠️ SINCE THE SHARDING MIGRATION IT IS UNLIKELY TO EVER FIRE, and that is the
 * point rather than a reason to delete it. `sessions` and `guestSessions` are
 * one document per row now and are not measured against the 1 MiB cap at all,
 * so the collection this warning was written for cannot reach it. What is left
 * under the cap is the small stuff — benchmarks, weigh-ins, programmes — and
 * the judgement that none of those grow without limit is a JUDGEMENT. This
 * exists so that being wrong about it is visible rather than silent, on
 * whichever collection is actually filling up, priced from that account's own
 * rows.
 *
 * ⚠️ IT NAMES A NUMBER OF RECORDS, NOT A PERCENTAGE ALONE. "84 % full" is not
 * an instruction. "About 170 more weigh-ins" is the same fact in the unit the
 * person actually thinks in, and it is derived from THEIR rows rather than from
 * a population average.
 * ------------------------------------------------------------------ */

// What one row of each collection is called out loud. The sharded collections
// are kept in the table even though the check no longer prices them: this is a
// naming table, and a name that costs nothing is cheaper than the bug where
// something is re-included upstream and the sentence reads "12 more records".
const ROW_NOUN = {
  sessions: ['workout record', 'workout records'],
  guestSessions: ['guest workout', 'guest workouts'],
  workouts: ['workout', 'workouts'],
  benchmarks: ['benchmark', 'benchmarks'],
  bodyWeight: ['weigh-in', 'weigh-ins'],
  customExercises: ['custom exercise', 'custom exercises'],
  systems: ['programme', 'programmes'],
  goals: ['goal', 'goals'],
  settings: ['setting', 'settings'],
};

// Exported for the tests, not for another screen. The only branch that matters
// is one nobody will see until it is already too late to design it, so it is
// driven directly rather than through a Settings render that cannot reach it —
// `cloudUsage()` returns null on every backend a test can stand up.
export function cloudFullWarning(usage) {
  if (!usage || usage.fraction < CLOUD_WARN_AT) return null;
  const [one, many] = ROW_NOUN[usage.collection] || ['record', 'records'];
  const left = usage.rowsLeft;

  // ⚠️ THE "FULL" BRANCH KEYS OFF ROOM FOR ONE MORE ROW, NOT OFF 100 %. The
  // stored document can never be over the cap — the write that put it there
  // would have been refused — so a `fraction >= 1` test describes a state
  // nothing can reach. What is reachable is sitting at 99 % with every new
  // save bouncing, and that is the state a user is actually in when they come
  // looking at this screen.
  const full = left === 0;

  return el('div', { class: 'storage-warning' },
    el('b', { text: full
      ? 'Your account has no room for new ' + many
      : 'Your account is running out of room' }),
    ' ',
    full
      ? `Your ${many} have reached the size limit for one account, so saving a new one `
        + 'is being refused. Download a backup now — it holds everything, and it is not '
        + 'subject to this limit.'
      : `Your ${many} are using ${Math.round(usage.fraction * 100)} % of the space one account `
        + `can hold — room for ${left === 1 ? `one more ${one}` : `about ${left} more`}. After `
        + 'that, new ones stop saving to your account. Download a backup so nothing depends on '
        + 'the cloud copy alone.',
  );
}

export async function SettingsView() {
  // ⚠️ SLIMMED 2026-08-26 on Tim's instruction: the profile row, the backup /
  // restore card and Delete all data moved to the ACCOUNT screen (the profile
  // icon), where the person lives. Settings is how the app looks and reads;
  // the account is who you are and what you own. views-account.js
  // `personalSections()` is where all of it went.
  const [settings, accountState] = await Promise.all([
    store.getSettings(), auth.state(),
  ]);
  const accountLine = describeAccount(accountState, auth.configured());

  function setTheme(theme, e) {
    document.documentElement.setAttribute('data-theme', theme);
    store.saveSettings({ theme });
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
  }

  // The colour direction — Tim liked all three options, so all three shipped
  // as a choice (2026-08-26). Applied instantly, like the theme; 'gold' is
  // the original and clears the attribute so bare :root rules apply.
  function setPalette(palette, e) {
    if (palette === 'gold') document.documentElement.removeAttribute('data-palette');
    else document.documentElement.setAttribute('data-palette', palette);
    store.saveSettings({ palette });
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
  }

  const PALETTES = [
    ['gold', 'Gold', '#D99A3E'],
    ['teal', 'Teal', '#3BC0AB'],
    ['indigo', 'Indigo', '#93A5FF'],
    ['ember', 'Ember', '#C98A2E'],
  ];
  const currentPalette = ['teal', 'indigo', 'ember'].includes(settings.palette)
    ? settings.palette : 'gold';

  // Changing this shows or hides a readout. It touches no stored number and no
  // rating: the levels are computed from percentiles either way.
  function setMoreDetails(on, e) {
    store.saveSettings({ moreDetails: on });
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
    toast(on ? 'Showing percentiles' : 'Showing rankings only');
  }

  // Shows or hides the rest bar on the workout screen. Nothing stored changes;
  // a draft's old restStartedAt just stops being painted.
  function setRestTimer(on, e) {
    store.saveSettings({ restTimer: on });
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
    toast(on ? 'Rest timer on' : 'Rest timer off');
  }

  // Changing units re-labels the app; it does NOT touch a single stored number.
  // Everything is kept in pounds, so switching back and forth is lossless.
  function setUnits(u, e) {
    units.setUnits(u);
    store.saveSettings({ units: u });
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
    toast(u === 'kg' ? 'Showing kilograms' : 'Showing pounds');
  }

  return screenShell({
    title: 'Settings',
    back: () => go('#/home'),
    scroll: [
      el('div', { class: 'field' },
        el('label', { text: 'Appearance' }),
        el('div', { class: 'chips' },
          el('button', { class: 'chip', 'aria-pressed': String(settings.theme !== 'light'), text: 'Dark', onClick: (e) => setTheme('dark', e) }),
          el('button', { class: 'chip', 'aria-pressed': String(settings.theme === 'light'), text: 'Light', onClick: (e) => setTheme('light', e) }),
        ),
        el('div', { class: 'field-help', text: 'Dark is easier to read under gym lighting.' }),
      ),

      el('div', { class: 'field' },
        el('label', { text: 'Colour' }),
        el('div', { class: 'chips' },
          ...PALETTES.map(([key, name, swatch]) =>
            el('button', {
              class: 'chip palette-chip',
              'aria-pressed': String(currentPalette === key),
              onClick: (e) => setPalette(key, e),
            },
              el('span', { class: 'palette-dot', style: `background:${swatch}` }),
              name)),
        ),
        el('div', { class: 'field-help', text:
          'Gold is the original. Teal and Indigo cool the whole app down; Ember keeps the gold '
          + 'and warms everything around it. Works with both Dark and Light.' }),
      ),

      el('div', { class: 'field' },
        el('label', { text: 'Weight units' }),
        el('div', { class: 'chips' },
          el('button', {
            class: 'chip', 'aria-pressed': String(units.units() !== 'kg'),
            text: 'lbs', onClick: (e) => setUnits('lbs', e),
          }),
          el('button', {
            class: 'chip', 'aria-pressed': String(units.units() === 'kg'),
            text: 'kg', onClick: (e) => setUnits('kg', e),
          }),
        ),
        el('div', { class: 'field-help', text:
          'Display only. Weights are stored the same way either way, so switching '
          + 'back and forth never changes anything you have recorded.' }),
      ),

      /* ⚠️ MORE DETAILS — OFF BY DEFAULT, and the default is the point.
       *
       * Tim, 2026-08-25: *"showing the percentile is a little harsh for some
       * people, so I think there should be a setting called 'more details' …
       * but the default is that it's turned off and just shows your ranking
       * (beginner, intermediate, etc.) and not any percentiles anywhere (even
       * though the rankings are still based on the percentiles and stuff)."*
       *
       * ⚠️ IT HIDES A READOUT, NOT A CALCULATION, and the help text says so.
       * Every level still comes from the same percentile it always did; this
       * decides whether the raw number is put in front of you. Hiding a number
       * that is still driving the answer would be dishonest if the app pretended
       * otherwise — so it does not.
       *
       * ⚠️ AND IT IS DELIBERATELY NOT A "SIMPLE MODE". It has one job today.
       * Rolling other things under it later is Tim's stated plan; naming it for
       * a scope it does not have yet would be a promise the switch cannot keep.
       */
      el('div', { class: 'field' },
        el('label', { text: 'More details' }),
        el('div', { class: 'chips' },
          el('button', {
            class: 'chip', 'aria-pressed': String(settings.moreDetails !== true),
            text: 'Off', onClick: (e) => setMoreDetails(false, e),
          }),
          el('button', {
            class: 'chip', 'aria-pressed': String(settings.moreDetails === true),
            text: 'On', onClick: (e) => setMoreDetails(true, e),
          }),
        ),
        el('div', { class: 'field-help', text:
          'Off shows your ranking — Beginner, Intermediate, Elite — and nothing else. '
          + 'On also shows the percentile behind it. The rankings are worked out the same '
          + 'way either way; this only decides how much of the working you see.' }),
      ),

      /* ⚠️ REST TIMER — OFF BY DEFAULT, and the default is Tim's own read of
       * training (2026-08-28): *"I don't love the rest timer personally. When
       * I'm working out it just doesn't help and it's easy for me to feel it
       * out myself."* Off means the bar is not on the workout screen at all —
       * not greyed, not collapsed, absent. On restores exactly the bar that
       * shipped: it starts when a set is logged, and its little chip cycles an
       * optional target.
       *
       * ⚠️ Existing accounts flip to off too, because the setting defaults by
       * ABSENCE. That is deliberate rather than an oversight — the person who
       * asked for off-by-default is also the app's heaviest user, and anybody
       * who misses the bar has a one-tap way back. */
      el('div', { class: 'field' },
        el('label', { text: 'Rest timer' }),
        el('div', { class: 'chips' },
          el('button', {
            class: 'chip', 'aria-pressed': String(settings.restTimer !== true),
            text: 'Off', onClick: (e) => setRestTimer(false, e),
          }),
          el('button', {
            class: 'chip', 'aria-pressed': String(settings.restTimer === true),
            text: 'On', onClick: (e) => setRestTimer(true, e),
          }),
        ),
        el('div', { class: 'field-help', text:
          'On shows a rest clock at the bottom of the workout screen. It starts when you '
          + 'log a set, and you can give it a target to count against.' }),
      ),

      el('div', { class: 'section-label', text: 'You' }),
      // ⚠️ THIS LINK IS WHY REMOVING THE GOALS TAB IS NOT DELETING GOALS.
      // 2026-08-25 took it off the bottom bar to make room for Calendar; the
      // feature is built and tested and `#/goals` still resolves, but a route
      // with no way in is deleted in every sense that matters to a user. This
      // is the way in.
      el('a', { class: 'row', href: '#/goals' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: 'Goals' }),
          el('div', { class: 'row-sub', text: 'Move a muscle up a strength level' }),
        ),
        el('span', { class: 'row-chev' }, chevron()),
      ),
      // One pointer, not the details: profile, backup and delete moved to the
      // Account screen (2026-08-26, Tim). The row survives so somebody who has
      // always found them here is redirected rather than stranded.
      el('a', { class: 'row', href: '#/account' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: 'Account & profile' }),
          el('div', { class: 'row-sub', text: 'Photo, your details, backups — now under the profile icon' }),
        ),
        el('span', { class: 'row-chev' }, chevron()),
      ),

      el('div', { style: 'font-size:12.5px;color:var(--ink-faint);text-align:center;line-height:1.5' },
        'Fitness Tracker · ' + accountLine.sub.toLowerCase()),
    ],
  });
}

/* ================================================================== *
 * Research — where the numbers come from (2026-08-28, Tim's ask)
 *
 * "I'm really curious about where some of our information is coming from and
 * how the site does its calculations, as well as displaying just useful
 * research on these topics." First exhibit: how average strength moves with
 * age, per muscle group — js/research-data.js carries the data and the full
 * sourcing argument (including why this is NOT drawn from Strength Level:
 * their by-age tables are one shared model wearing eleven names).
 *
 * ⚠️ EIGHT LINES, NOT ELEVEN, AND THE SCREEN SAYS WHY. Chest, Back and Traps
 * have no published per-group age curve — the study behind this chart has no
 * pressing, rowing or shrugging movement. Drawing them anyway would be
 * inventing data on the one screen that exists to show sources.
 * ================================================================== */

// Fixed slot order — identity follows the muscle, never the rank or filter
// state. These are the dataviz reference palette's eight categorical hues,
// validated (scripts run 2026-08-28) against this app's dark surfaces of all
// four palettes and the white light surface: CVD ΔE ≥ 8.4 adjacent, ≥ 3:1
// contrast on dark. Three hues sit under 3:1 on WHITE, which is why the table
// view and the labelled legend exist rather than being nice-to-haves.
const RESEARCH_SLOTS = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Shoulders', 'Biceps', 'Triceps', 'Forearms'];

function researchChart({ series, ref, W, H, isolated, focusBand, onBandTap }) {
  const padL = 38, padR = 10, padT = 10, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const ages = series[0].points.map((p) => p.age);
  const aMin = ages[0], aMax = ages[ages.length - 1];
  const vMin = 55, vMax = 100;

  const x = (a) => padL + ((a - aMin) / (aMax - aMin)) * iw;
  const y = (v) => padT + ih - ((v - vMin) / (vMax - vMin)) * ih;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('class', 'chart research-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    'Average strength by age as a percentage of each muscle group’s strongest age group');

  const mk = (tag, attrs, cls) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (cls) n.setAttribute('class', cls);
    svg.append(n);
    return n;
  };

  // Grid: horizontal only, recessive. Direct % labels on the axis.
  for (let v = 60; v <= 100; v += 10) {
    mk('line', { x1: padL, y1: y(v), x2: W - padR, y2: y(v) }, 'chart-grid');
    mk('text', { x: padL - 5, y: y(v) + 3.5, 'text-anchor': 'end' }, 'chart-tick').textContent = `${v}%`;
  }
  for (const a of ages) {
    mk('text', { x: x(a), y: H - 6, 'text-anchor': 'middle' }, 'chart-tick').textContent = String(a);
  }

  // The app's own grading curve — a REFERENCE, not a series: dashed, ink-
  // coloured, under the data lines.
  if (ref && ref.length) {
    mk('path', {
      d: ref.map((p, i) => `${i ? 'L' : 'M'}${x(p.age).toFixed(1)},${y(Math.max(vMin, p.pct)).toFixed(1)}`).join(' '),
      fill: 'none', 'stroke-dasharray': '5 4', 'stroke-width': 1.5,
    }, 'research-ref');
  }

  // Focused band guide, under the lines.
  if (focusBand != null) {
    mk('line', { x1: x(ages[focusBand]), y1: padT, x2: x(ages[focusBand]), y2: padT + ih }, 'research-guide');
  }

  series.forEach((s, si) => {
    const dim = isolated && isolated !== s.muscle;
    const g = mk('g', { opacity: dim ? 0.18 : 1 });
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.age).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', `var(--rs-${si + 1})`);
    path.setAttribute('stroke-width', 2);
    path.setAttribute('stroke-linejoin', 'round');
    g.append(path);
    for (const p of s.points) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x(p.age)); dot.setAttribute('cy', y(p.pct));
      dot.setAttribute('r', focusBand != null && ages[focusBand] === p.age ? 4 : 2.75);
      dot.setAttribute('fill', `var(--rs-${si + 1})`);
      // A 2px surface ring so overlapping markers separate (marks-and-anatomy).
      dot.setAttribute('stroke', 'var(--surface)');
      dot.setAttribute('stroke-width', 1.5);
      g.append(dot);
    }
    // Direct label at line end when isolated — with eight series the legend
    // carries identity; a label per line would be sixteen colliding words.
    if (isolated === s.muscle) {
      const last = s.points[s.points.length - 1];
      mk('text', { x: x(last.age) - 6, y: y(last.pct) - 8, 'text-anchor': 'end', fill: `var(--rs-${si + 1})` },
        'research-line-label').textContent = s.muscle;
    }
  });

  // Tap targets per age band — full column height, far bigger than the marks.
  ages.forEach((a, i) => {
    const half = iw / (ages.length - 1) / 2;
    const r = mk('rect', {
      x: Math.max(padL, x(a) - half), y: padT,
      width: half * 2, height: ih, fill: 'transparent',
    });
    r.style.cursor = 'pointer';
    r.addEventListener('click', () => onBandTap(i));
  });

  return svg;
}

async function renderResearchPane(host, top) {
  setChildren(top);
  const profile = await store.getProfile();
  const gender = profile.gender === 'female' ? 'female' : 'male';
  const series = ageStrengthSeries(gender);
  const ages = series[0].points.map((p) => p.age);
  const ref = appGradingCurve(ageCoefficient, ages[0], ages[ages.length - 1]);

  // Fixed slot order regardless of object iteration details.
  series.sort((a, b) => RESEARCH_SLOTS.indexOf(a.muscle) - RESEARCH_SLOTS.indexOf(b.muscle));

  const state = { isolated: null, focusBand: null };

  const chartHost = el('div', { class: 'research-chart-host' });
  const readout = el('div', { class: 'research-readout', role: 'status' });
  const legend = el('div', { class: 'research-legend' });

  function drawChart() {
    const W = Math.max(300, Math.min(chartHost.clientWidth || 358, 720));
    setChildren(chartHost, researchChart({
      series, ref, W, H: 250,
      isolated: state.isolated, focusBand: state.focusBand,
      onBandTap: (i) => { state.focusBand = state.focusBand === i ? null : i; drawChart(); },
    }));
    renderReadout();
    renderLegend();
  }

  function renderReadout() {
    if (state.focusBand == null) {
      setChildren(readout, el('span', { class: 'research-readout-hint',
        text: 'Tap the chart to read one age group; tap a muscle below to follow one line.' }));
      return;
    }
    const i = state.focusBand;
    const shown = state.isolated ? series.filter((s) => s.muscle === state.isolated) : series;
    setChildren(readout,
      el('b', { text: `Around age ${ages[i]}: ` }),
      el('span', {
        text: shown
          .map((s) => `${s.muscle} ${s.points[i].pct}%`)
          .join(' · '),
      }));
  }

  function renderLegend() {
    setChildren(legend,
      ...series.map((s, si) => el('button', {
        class: 'chip research-key',
        'aria-pressed': String(state.isolated === s.muscle),
        onClick: () => { state.isolated = state.isolated === s.muscle ? null : s.muscle; drawChart(); },
      },
        el('span', { class: 'rs-dot', style: `background:var(--rs-${si + 1})` }),
        s.muscle,
      )),
      el('span', { class: 'chip research-key research-key-ref' },
        el('span', { class: 'rs-dot rs-dot-ref' }),
        'App’s grading curve'),
    );
  }

  // The full numbers, for anyone the lines are too thin or too pale for —
  // and the relief the light-mode contrast WARN obligates.
  const table = el('details', { class: 'research-table' },
    el('summary', { text: 'Show as a table' }),
    el('div', { class: 'research-scroll' },
      el('table', {},
        el('thead', {}, el('tr', {},
          el('th', { text: 'Muscle group' }),
          ...ages.map((a) => el('th', { text: `~${a}` })))),
        el('tbody', {}, ...series.map((s) => el('tr', {},
          el('th', { text: s.muscle }),
          ...s.points.map((p) => el('td', { text: `${p.pct}%` }))))),
      )),
    el('div', { class: 'field-help', text:
      '100% is that muscle group’s strongest age group. Column headings are the average age '
      + 'of the people measured in each group.' }),
  );

  setChildren(host,
    el('div', { class: 'research-pane' },
      el('h2', { class: 'research-title', text: 'How strength changes with age' }),
      el('div', { class: 'field-help research-sub', text:
        `Average ${gender === 'female' ? 'women’s' : 'men’s'} strength by age, each muscle group as a % of its own strongest `
        + 'age group — measured, not modelled, which is why the lines differ and why the axis '
        + `stops where the people do (${ages[0]} to ${ages[ages.length - 1]}).` }),
      chartHost,
      readout,
      legend,
      table,
      el('div', { class: 'research-notes' },
        el('p', {}, el('b', { text: 'What this is. ' }),
          `${AGE_SOURCE.n[gender]} healthy non-athletic ${gender === 'female' ? 'women' : 'men'} aged 15–83, every major `
          + 'muscle group measured on the same dynamometer. Each point is one age group’s measured '
          + 'average (peak turning force at the joint, not a one-rep max), plotted at that group’s '
          + 'average age. Groups of different people, not the same people ageing — so treat the '
          + 'shapes as the finding, not any single percent. ',
          el('a', { href: AGE_SOURCE.url, target: '_blank', rel: 'noopener', text: 'Harbo, Brincks & Andersen (2012)' }), '.'),
        el('p', {}, el('b', { text: `Why ${NOT_COVERED.join(', ').replace(/, ([^,]+)$/, ' and $1')} are missing. ` }),
          'No study measures pressing, rowing or shrugging strength across ages in a general '
          + 'population. This tab shows sources — inventing three curves to complete the set would '
          + 'be the opposite of its job.'),
        el('p', {}, el('b', { text: 'The dashed line ' }),
          'is what this app assumes: one combined age curve for every lift, from powerlifting’s '
          + 'published age-grading tables (McCulloch and Foster coefficients), used to place your '
          + 'lifts against people your own age. One curve for all muscles is a simplification — '
          + 'this chart is what the measured groups actually did.'),
        el('p', {}, el('b', { text: 'Where the app’s other numbers come from. ' }),
          'Strength standards and lift-to-lift ratios: Strength Level’s published standards, '
          + 'derived at a fixed body weight. Estimated one-rep max: Marzagão’s 2026 formula. '
          + 'Muscle ratings: your recorded sets, converted through those ratios — every screen '
          + 'that shows a rating names the set it came from.')),
    ));

  drawChart();
  // Redraw once laid out — clientWidth is 0 until the pane is in the document.
  requestAnimationFrame(drawChart);
}
