// Calendar, day detail, graphs, settings.

import {
  store, auth, social, seriesForExercise, chartableExercises, activityByDate, todayISO,
  normalizedSeries, defaultTargetReps, bodyWeightSeries, SOURCE_LABEL, currentBests,
  CLOUD_WARN_AT, weeklyVolumeByMuscle, weightRepObservations,
} from './store.js';
import {
  hypertrophyTier, strengthTier, INDIRECT_NOTE_WEEKLY, SESSION_CEILING,
  VOLUME_SHADES, volumeShade,
} from './volume-map.js';
import { bodySvg, setSelected, MAPPED_MUSCLES, BODY_ASPECT } from './body-map.js';
import { FIELD_META, LOAD_LABEL } from './exercises.js';
import {
  clampReps, repConfidence, normalizeBlockedReason, MIN_TARGET_REPS, MAX_TARGET_REPS, e1rm,
} from './e1rm.js';
import {
  setChildren, el, iconBtn, toast, screenShell, emptyState, confirmSheet, openSheet, miniStepper, chevron,
  fmtSet, fmtField, fmtDateLong, fmtDateShort, trimNum, fmtTime, loadBadge, exerciseLabel,
  refreshRoute, helpDot, wireSegmented,
} from './ui.js';
import { muscleGroupsPane } from './views-muscles.js';
import { ageStrengthSeries, appGradingCurve, AGE_SOURCE, NOT_COVERED } from './research-data.js';
import { TOPICS, CONFIDENCE, topicSources } from './research-topics.js';
import { ageCoefficient } from './strength-standards.js';
import { minisOf, groupLabel, miniLabel } from './set-types.js';
import { yearsToShow, buildYear, daysLabel, publishedDaysLabel, DOW_LABELS } from './year-grid.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

// Which way the calendar is being read. Module-level so it survives leaving the
// screen and coming back — somebody who prefers the year view should not have
// to re-pick it after every trip to a day.
let calMode = 'months'; // 'months' | 'years'

/* 🚨 ONE CONTROL, TWO MEMORIES — 2026-09-10, when a friend's calendar got the
 * Months/Years switch (Tim: *"you can see their calendar, but can't select
 * between months and years. Make it so you can."*).
 *
 * This is the same guard `graphMode` has, for the same reason and with one
 * addition. Browsing somebody else may not silently change what MY calendar
 * opens on; and the default matters more here than it does for a tab, because
 * the two views make different claims. Months shows the range it holds and
 * nothing beyond it. Years draws a whole calendar year and leaves everything
 * outside their sixty published sessions blank — true, captioned, and still the
 * view that most needs the reader to have chosen it. So a friend's page opens
 * on Months and Years is one tap away, rather than inheriting a preference
 * formed on a screen showing a whole history.
 *
 * ⚠️ IT IS STILL MODULE STATE, not per-render: somebody comparing two friends'
 * years should not re-pick it on every page. It is simply not the same variable
 * as mine. */
let friendCalMode = 'months';
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

/**
 * @param {Function|false} [onDay]  ⚠️ WHERE A DAY GOES, and it is a parameter
 *   since 2026-09-05 because `#/day/<iso>` is MY day. On a friend's calendar
 *   that link would open my own training for the date I tapped on theirs — the
 *   same day, the wrong person, and it would look like it had worked.
 *
 *   🚨 `false` MAKES THE CELLS INERT RATHER THAN NO-OP BUTTONS. A friend's
 *   calendar has nowhere to go: there is no screen for one of their days. A
 *   button that does nothing is worse than no button — it takes focus, it is
 *   announced as a control, and it teaches a keyboard or screen-reader user to
 *   press something that will never answer.
 */
/* 🚨 A PUBLISHED SESSION CALLS IT `name`; MINE CALLS IT `workoutName` — found
 * 2026-09-10, while putting the Years switch on a friend's calendar.
 *
 * `projectSession()` in js/social.js writes `name: session.workoutName || 'Workout'`,
 * so a friend's document has no `workoutName` on it at all. Everything below
 * read `s.workoutName` — which meant **every cell of a friend's calendar said
 * "Workout"**, whatever their workout was called, and worse, the cell's
 * accessible name was built without the fallback and read literally
 * *"February 10: undefined"*. Shipped since the friend calendar did, and
 * invisible to every test because no fixture used the published shape.
 *
 * ⚠️ THE TWO KEYS CANNOT COLLIDE, which is what makes one line safe here rather
 * than a guess. A local session is written with `workoutName` and never a
 * `name` (store.js, views-session.js, views-edit-session.js, import-file.js,
 * demo.js); a published one is written with `name` and never a `workoutName`.
 * So this reads whichever key the document in hand actually has, and falls back
 * to the same word the publisher does. */
const sessionName = (s) => (s && (s.workoutName || s.name)) || 'Workout';

function monthBlock(year, month, activity, today, onDay = null) {
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
        for (const s of shown) tags.push(tag('w', sessionName(s)));
        if (rec.sessions.length > shown.length) {
          tags.push(el('span', { class: 'cal-tag more', text: `+${rec.sessions.length - shown.length}` }));
        }
        if (rec.benchmarks.length) tags.push(tag('b', 'Benchmark'));
      }

      const label = rec
        ? `${MONTHS[month]} ${day}: ${rec.sessions.map(sessionName).join(', ')}${rec.benchmarks.length ? (rec.sessions.length ? ', ' : '') + 'benchmark' : ''}`
        : `${MONTHS[month]} ${day}, nothing recorded`;

      // Inert where there is nowhere to go — see the note on `onDay`.
      return el(onDay === false ? 'div' : 'button', {
        class: cls.join(' '),
        'aria-label': label,
        ...(onDay === false
          ? { role: 'img' }
          : { onClick: () => (onDay ? onDay(iso) : go('#/day/' + iso)) }),
      },
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

/**
 * @param {object} [opts]
 * @param {Function} [opts.countLabel]  🚨 WHAT THE NUMBER BESIDE A YEAR IS
 *   CALLED, and it is a parameter since 2026-09-10 rather than a constant.
 *   `daysLabel` says "N days trained", which is true of my own grid and false of
 *   a friend's: their document holds sixty published sessions, so the count is
 *   of days they PUBLISHED and cannot exceed 60 however much they trained. See
 *   `publishedDaysLabel` in js/year-grid.js for the whole argument.
 * @param {string} [opts.gridHint]  the second sentence of the picture's
 *   description. Mine points at Months, where every day is a 40px control; a
 *   friend's cannot, because their cells are inert, so it says what the picture
 *   is instead.
 */
function yearsPane(activity, today, onPick, opts = {}) {
  const countLabel = opts.countLabel || daysLabel;
  const gridHint = opts.gridHint || 'Open the Months view to reach a day.';
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
      'aria-label': `${year}: ${countLabel(g.activeDays)}. ${gridHint}`,
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
        el('span', { class: 'yr-count', text: countLabel(g.activeDays) }),
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

/**
 * THE CALENDAR, BUILT ONCE AND SHOWN IN THREE PLACES — 2026-09-08, Tim: *"I
 * think we should move the calendar section back to being a tab in the data
 * section."*, and 2026-09-10: *"When you view a friend's data, you can see their
 * calendar, but can't select between months and years. Make it so you can."*
 *
 * 🚨 IT RETURNS ITS CONTROLS AND A PAINTER RATHER THAN A SCREEN, and that is
 * what lets the same calendar be a nav tab (`#/calendar`, still a route, still
 * bookmarkable), the sixth segment of the Data screen and a friend's fifth tab
 * without a second copy of Months, Years, the readout and the day links. The
 * rule this project keeps relearning — see the note above `GraphView` — is that
 * two subjects share one function or they drift apart; two PLACES are no
 * different, and a subject and a place together are the case that drifts fastest.
 *
 * The caller supplies the node the grids are painted into: the Calendar tab
 * hands over its `.pane-scroll`, the Data screen its `.graph-host`. Everything
 * else — which mode is on, where a day goes, what the readout says — lives here.
 *
 * 🚨 A FRIEND DIFFERS IN FOUR THINGS AND EVERY ONE OF THEM IS AN HONESTY
 * DECISION rather than a layout one. They are enumerated here because the
 * previous answer was a second, thinner calendar in `renderCalendarPane`, and
 * that is exactly the drift this function exists to stop:
 *
 *   1. **The cells are inert.** `#/day/<iso>` is MY training for that date, and
 *      there is no screen for one of theirs. See the note on `monthBlock`.
 *   2. **The readout does not navigate either**, and is therefore not a button.
 *      It still names what they did on the day you tapped — that is the whole
 *      value of a 6px square — but a control that cannot answer is worse than no
 *      control, so it is a live region rather than a dead link.
 *   3. **The count beside a year says "published", not "trained"** — their
 *      document holds sixty sessions, so the figure is bounded by what they
 *      share and says nothing about what they did. `publishedDaysLabel`.
 *   4. **A caveat sits under the switch, in the open, and it is longer in
 *      Years.** Rule 9 puts WHY behind a "?" and keeps WHAT on the screen; the
 *      window IS what this picture is, so it stays in the open. Months can only
 *      under-draw the range it holds. Years draws a whole calendar year and
 *      leaves every day outside the window blank, which reads as rest unless the
 *      screen says otherwise.
 *
 * ⚠️ `calMode` STAYS MODULE STATE and is deliberately shared by my two doors. It
 * is "how I read a calendar", not "how this screen was left": somebody who
 * prefers Years should not have to re-pick it because they arrived through the
 * other door. A friend's page keeps `friendCalMode` instead — see the note
 * beside those two declarations for why browsing somebody else may not move it.
 *
 * 🆕 **AND THE PROFILE TAB IS THE FOURTH DOOR SINCE 2026-09-10**, which is what
 * `land` is for. On the Calendar screen and the Data screen the calendar is
 * effectively the whole pane, so jumping the scroller to the current month is
 * the right arrival. On Profile it sits UNDER the avatar, the stats and
 * whatever else that screen grows, and yanking the page down past all of it to
 * land on this month would hide the screen somebody just opened. The calendar
 * is the same calendar; only where the pane starts is different.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.friend]  somebody else's page: the four differences
 *   above, and the other mode memory.
 * @param {string}  [opts.who]     what to call them in the caveat.
 * @param {boolean} [opts.land]    default true. False keeps the host's own
 *   scroller where the reader left it — see the Profile note above.
 */
export function ownCalendar(activity, today, opts = {}) {
  const friend = Boolean(opts.friend);
  const who = opts.who || 'They';
  const land = opts.land !== false;
  const months = monthRange(activity);

  const readMode = () => (friend ? friendCalMode : calMode);
  const writeMode = (m) => { if (friend) friendCalMode = m; else calMode = m; };

  // ⚠️ RESERVED, NEVER REVEALED. The readout holds its row whether or not a day
  // is selected, because Design Rule 3's corollary — content must not shrink
  // because you asked it a question — is exactly what a line appearing on tap
  // would break: every grid below it would jump by its height the first time
  // anybody touched a square. Empty, it says what to do instead.
  //
  // 🚨 A DIV ON A FRIEND'S PAGE, NOT A DISABLED BUTTON. Their day has nowhere to
  // go, and the same argument that makes their month cells inert applies with
  // more force to a full-width control: it would take focus, be announced as a
  // button, and never answer. The text it carries is the same either way.
  const readout = el(friend ? 'div' : 'button', {
    class: 'yr-readout', 'aria-live': 'polite',
    ...(friend ? {} : { disabled: true }),
    text: friend ? 'Tap a day to see what they did' : 'Tap a day to see what you did',
  });

  const pickDay = (isoDate) => {
    const rec = activity.get(isoDate) || { sessions: [], benchmarks: [] };
    const names = rec.sessions.map(sessionName);
    if (rec.benchmarks.length) names.push(`${rec.benchmarks.length} benchmark${rec.benchmarks.length > 1 ? 's' : ''}`);
    if (!friend) {
      readout.disabled = false;
      readout.onclick = () => go('#/day/' + isoDate);
    }
    // ⚠️ The YEAR is part of the date here, where it is not on other screens.
    // This is the one view in the app showing several years at once, and
    // "Jul 14" over a grid holding four different July 14ths names nothing.
    setChildren(readout,
      el('span', { class: 'yr-r-date', text: `${fmtDateShort(isoDate)}, ${isoDate.slice(0, 4)}` }),
      el('span', { class: 'yr-r-what', text: names.length ? names.join(' · ') : 'Nothing recorded' }),
      friend ? null : chevron(),
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

  /* 🚨 THE SIXTY-SESSION CAVEAT, AND IT GREW A SECOND HALF FOR YEARS.
   *
   * The first sentence is unchanged and is the one their Volume and Graph tabs
   * carry too — a calendar looks more like a complete history than anything else
   * on their page, so an empty February could mean they rested or could mean it
   * fell out of the window.
   *
   * ⚠️ YEARS MAKES THAT WORSE IN TWO SPECIFIC WAYS AND BOTH ARE NAMED. The grid
   * paints a whole calendar year whether or not the window reaches back that
   * far, so the blank half of a year is a statement about publishing that reads
   * as a statement about training; and the figure beside the year is capped at
   * sixty by construction. Neither is a rounding error, so neither is left to be
   * worked out — `docs/direction.md` §3.1: a best-effort number clearly labelled
   * beats a blank, and a number presented as something it is not is still wrong.
   *
   * 🛑 IT IS NOT BEHIND A "?" (Rule 9). The dot holds WHY; this is WHAT the
   * picture is. */
  const CAVEAT_MONTHS =
    `From the most recent sixty sessions ${who} publishes — not their whole history.`;
  // ⚠️ THE CLOSING CLAUSE DELIBERATELY AVOIDS THE PHRASE "days trained", and
  // that is a test talking rather than a style note: the assertion guarding this
  // screen is that those two words appear NOWHERE on somebody else's page, which
  // is the only shape of check that catches `daysLabel` being wired back in by
  // accident. A caveat that quotes the forbidden phrase to disown it would blunt
  // the one guard that cannot be fooled.
  const CAVEAT_YEARS = `${CAVEAT_MONTHS} Days outside that window are blank whether or `
    + 'not they trained, and the number beside each year counts published days only.';
  const caveat = friend ? el('div', { class: 'field-help', text: CAVEAT_MONTHS }) : null;

  const tabs = [['months', 'Months'], ['years', 'Years']].map(([m, label]) =>
    el('button', {
      class: 'seg', role: 'tab', 'aria-selected': String(readMode() === m), text: label,
      onClick: () => { if (readMode() !== m) { writeMode(m); paint(); } },
    }));

  // ⚠️ THE CAVEAT GOES DIRECTLY UNDER THE SWITCH, and the readout stays LAST.
  // `.yr-readout` carries a hairline on its top edge and is drawn as the closing
  // row of this block; a paragraph under that line reads as belonging to the
  // grid below rather than to the control above it.
  const top = el('div', { class: 'cal-modes' },
    el('div', { class: 'segmented sub', role: 'tablist' }, tabs), caveat, legend, readout);

  // The node the grids go in, handed over by whoever is showing this.
  let host = null;

  /**
   * ⚠️ THE CONTAINER IS NEVER REPLACED, only repainted — and that is not a
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
   * repaint its own contents and leave the container alone. On the Data screen
   * that matters twice over: the node here is the shared `.graph-host` every
   * other segment paints into, and it belongs to `GraphView`.
   */
  function paint() {
    const isYears = readMode() === 'years';
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.textContent === (isYears ? 'Years' : 'Months'))));
    legend.hidden = isYears;
    readout.hidden = !isYears;
    // The window sentence is true in both modes; only Years needs the two extra
    // clauses, so the text is swapped rather than a second block being revealed.
    if (caveat) caveat.textContent = isYears ? CAVEAT_YEARS : CAVEAT_MONTHS;

    if (!host) return;
    if (isYears) {
      const yearsOpts = friend ? {
        countLabel: publishedDaysLabel,
        // ⚠️ NOT "open the Months view to reach a day". Their month cells are
        // inert, so pointing a screen-reader user at them would be an
        // instruction that cannot be carried out. Describe the picture instead.
        gridHint: `Only the sessions ${who} publishes are drawn.`,
      } : {};
      setChildren(host, ...(activity.size
        ? yearsPane(activity, today, pickDay, yearsOpts)
        // ⚠️ Unreachable on a friend's page today — `renderCalendarPane` returns
        // its own empty state before building this — but the words may not be
        // wrong if it ever is reached: "every day you finish a workout" is my
        // voice, on somebody else's screen.
        : [friend
          ? emptyState('Nothing to draw yet', `${who} has not published any sessions you can read.`)
          : emptyState('No training recorded yet',
            'Every day you finish a workout fills in a square here. A year fits on one screen.')]));
      // The scroller is the pane, which is the host itself on the Calendar tab
      // and its parent on the Data screen. ⚠️ Not on Profile: there the pane
      // holds the whole profile and this would scroll the avatar off the top.
      const pane = land ? host.closest('.pane-scroll') : null;
      if (pane) pane.scrollTop = 0;
    } else {
      setChildren(host, ...months.map(({ year, month }) =>
        monthBlock(year, month, activity, today, friend ? false : null)));
      if (land) landOnCurrentMonth(host);
    }
  }

  return {
    top,
    paint(node) { host = node; paint(); },
  };
}

export async function CalendarView() {
  const cal = ownCalendar(await activityByDate(), todayISO());

  const screen = screenShell({
    profile: true,
    // ⚠️ ITS OWN TITLE, and it keeps it even though Calendar is a Data segment
    // again since 2026-09-08. `#/calendar` is a route in its own right —
    // `#/day/<date>` and `#/edit/<id>` hang off it — so this screen still has to
    // stand up alone. Wearing the Data switch here would light a segment for a
    // screen that is not the Data screen.
    title: 'Calendar',
    top: cal.top,
    scroll: [],
  });

  cal.paint(screen.querySelector('.pane-scroll'));
  return screen;
}

/**
 * @param {Node} container  where the month sections were painted — the scroller
 *   itself on the Calendar tab, the `.graph-host` inside it on the Data screen.
 *   `closest()` starts at the element itself, so one call resolves both.
 */
function landOnCurrentMonth(container) {

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
    const pane = container.closest ? container.closest('.pane-scroll') : null;
    const current = container.querySelector('[data-current-month]');
    if (!pane || !current) return;

    // ⚠️ THE LAST MONTH, not the pane's last child. On the Data screen the pane
    // holds one element — the host every segment paints into — so asking the
    // pane would pad the host itself and move nothing.
    const last = container.lastElementChild;
    if (last) {
      const shortfall = pane.clientHeight - last.getBoundingClientRect().height;
      last.style.paddingBottom = shortfall > 0 ? `${Math.ceil(shortfall)}px` : '';
    }

    // Measured against the pane rather than through offsetTop: the two elements
    // do not share an offsetParent (the pane's is #app, a month's is body), so
    // subtracting one from the other only works by coincidence of layout.
    pane.scrollTop += current.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  }, 0);
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
 * 🔄 CALENDAR CAME BACK ON 2026-09-08 AND THE ODDITY DID NOT. It is a mode like
 * every other one now — `renderCalendarPane` paints the shared `.graph-host`,
 * nothing here navigates, and the special case and the `onChartMode` fallback
 * stayed deleted. `#/calendar` is still a route, but it is a route the tab does
 * not use; that is why this reversal costs one entry in the list rather than
 * bringing the 2026-08-22 shape back with it.
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
// ⚠️ FIVE segments since 2026-08-31 (Volume joined), and the fifth was measured
// before it shipped because this file's own note said to. Driven at 360px, both
// themes: the row is 293px wide, the five labels render 63 + 60 + 51 + 39 + 68 =
// 281px, `scrollWidth === clientWidth` on the row and on every segment, and the
// four that were already there are the SAME width they were with four segments —
// nothing was squeezed. ⚠️ THAT LEAVES 12px, so a SIXTH does not fit and this is
// the last one that can be added without shortening a label. 🔄 **STILL TRUE,
// NO LONGER THE RULING** — a sixth arrived on 2026-09-08 and the row was made to
// scroll instead of being squeezed. Read the block below before this one.
//
// ⚠️ Volume sits SECOND, beside Muscles, because they are two readings of the
// same body — "how strong is it" and "how much work is it getting" — and the two
// chart modes belong together after them.
/* 🔄 FIVE SEGMENTS AGAIN SINCE 2026-09-10 — CALENDAR MOVED TO PROFILE, and this
 * is its FOURTH move. Every one has been Tim's, and this one came out of a
 * question rather than an instruction: *"The main profile section is looking
 * really empty right now and the settings profile section is really crowded …
 * Should the profile menu even be a main section? … I think showing the
 * calendar as a main section was nice, but I think we can also display it in the
 * data section in a good way (although it's not in a great place right now)."*
 *
 * 🚨 THE TWO COMPLAINTS WERE ONE PROBLEM, AND THE MEASUREMENT IS WHAT SAID SO.
 * Profile was empty because everything that belongs on it already lived here,
 * and this control was simultaneously overfull — **six segments physically did
 * not fit**, and only worked because the row was made to scroll on 2026-09-08.
 * The measured figures are kept below because they are the evidence: a tab that
 * needs a scrolling tab bar is a tab holding two jobs. Splitting them by what
 * they ANSWER puts five here and fixes the overflow outright:
 *
 *   • **what it MEANS** — Muscles, Volume, Graph, Bars, Research. Analysis.
 *   • **what you DID** — the calendar. A record, and Profile's job.
 *
 * ⚠️ THE ROW STILL SCROLLS AND THAT RULE STAYS. It is what makes any future
 * sixth segment degrade rather than break, and `wireSegmented()` still centres
 * the selected one. Removing it because five happen to fit today would be
 * deleting the guard that made the overflow survivable.
 *
 * ⚠️ **A FRIEND'S PAGE KEEPS ITS CALENDAR SEGMENT** — `FRIEND_TABS` below is
 * built from the first four of these plus Calendar, and it is unaffected. There
 * is no Profile tab for somebody else, so their page is the only door to their
 * calendar and it stays where it is.
 *
 * The 2026-09-08 measurement, kept as the record of why six was too many.
 * Re-driven over CDP at 320 / 360 / 375 / 390 / 393 / 430 / 768px, both themes:
 *
 *   Muscles 62.59 · Volume 60.08 · Graph 50.73 · Bars 39.23 · Research 68.22 ·
 *   Calendar 68.00 = 348.85px of segment, + 5 gaps × 2px + 4px of padding =
 *   **362.86px of row against a 290px slot at 360px** — the profile button and
 *   the header's padding take the other 70. It needed ~433px to fit outright.
 *   Unfixed, the bar ran 58.86px past the right edge and Calendar showed
 *   **11.14px of its 68** — the "C" and nothing else — with 0px at 320px and no
 *   sideways gesture on the document to bring it back.
 *
 * ⚠️ NO LABEL IS EVER ELLIPSISED. `.seg` carries `min-width: fit-content`, so a
 * segment cannot be squeezed below its own text. That is why scrolling was the
 * right answer rather than a dodge, and it is still true of five. */
const DATA_TABS = [['muscles', 'Muscles'], ['volume', 'Volume'], ['trend', 'Graph'],
  ['compare', 'Bars'], ['research', 'Research']];

/* 🚨 A FRIEND'S FIFTH TAB IS THEIR CALENDAR, NOT RESEARCH — Tim, 2026-09-05:
 * *"with the 'research' tab replaced with that user's 'calendar' data."*
 *
 * ⚠️ AND THE SWAP IS THE RIGHT WAY ROUND. Research is eleven topics about
 * training in general — identical on everybody's screen — so on a friend's page
 * it would be five tabs of which one is not about them at all. A calendar IS
 * about them, and their sessions are already in the document their page reads,
 * so it costs no extra read.
 *
 * ⚠️ THE POSITION IS KEPT. Swapping in place rather than appending means the
 * four tabs somebody already knows do not move when they open another person's
 * page: the muscle map is still first, the calendar is where Research was.
 *
 * 🚨 `slice(0, 4)` IS LOAD-BEARING NOW THAT MY OWN LIST ENDS IN CALENDAR TOO
 * (2026-09-08). Taking the whole list and swapping Research out would give a
 * friend's page two Calendar segments — the fifth from the swap and the sixth
 * from mine — both selecting the same mode, which is the "two ways in light two
 * things at once" fault from the other direction. Five stays five. */
const FRIEND_TABS = [...DATA_TABS.slice(0, 4), ['calendar', 'Calendar']];

/**
 * @param {Function} [setMode]  🚨 HOW THE CHOSEN TAB IS REMEMBERED, and it is a
 *   parameter for the same reason `openCompareSheet`'s `save` is. `graphMode` is
 *   MODULE state — the tab you left your own Data screen on — and a friend's
 *   page must not write it. Browsing somebody else would otherwise change which
 *   tab your own screen opens on. One control, two memories.
 *
 *   ⚠️ AND THE HARM CHANGED SHAPE ON 2026-09-08 WITHOUT GETTING SMALLER. It
 *   used to be that picking their Calendar left `graphMode` holding a key not in
 *   `DATA_TABS`, so my next visit fell through to the trend chart. `calendar` is
 *   now a real key of mine, so the same tap would instead open MY Data screen on
 *   MY calendar — no longer a broken value, still a screen I did not choose,
 *   and now indistinguishable from having chosen it. The guard is unchanged and
 *   the reason to keep it is not weaker.
 */
function dataTabs(active, onChartMode, tabs = DATA_TABS, setMode = null) {
  return el('div', { class: 'segmented', role: 'tablist' },
    tabs.map(([key, label]) =>
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
          if (setMode) setMode(key);
          else graphMode = key;
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
    onClick: async (ev) => {
      /* ⚠️ A RECORD THAT ALREADY KNOWS WHOSE IT IS DOES NOT ASK AGAIN.
       * Since 2026-08-29 a session recorded for a FRIEND carries their uid, so
       * the chooser below would be asking a question the row has already
       * answered — and offering the chance to send somebody's training to the
       * wrong person. The chooser stays for rows recorded for a guest, where
       * there genuinely is nothing to go on but a typed name. */
      if (guest.forUid) {
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          await social.offerSession(guest.forUid, guest, guest.guestName);
          toast(`Sent to ${guest.guestName}.`);
        } catch (err) { toast(err.message); }
        btn.disabled = false;
        return;
      }
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
        exerciseLabel({ exercise: exMap.get(e.exerciseId), name: e.exerciseName,
          tag: 'span', className: 'detail-ex-name' }),
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
          /* The description typed during the workout (social-plan §13 Step 2).
           * Under the title and above the counts, which is where it sits on
           * the feed card too — it is what the session WAS, and the counts are
           * what it contained. Read-only here; the pencil beside it is the way
           * to change it, the same as every other fact on this card.
           * `.wrap` because a sentence that ellipsises at one line is a
           * sentence you cannot read, and this one is up to 280 characters. */
          s.note ? el('div', { class: 'row-sub wrap', text: s.note }) : null,
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
              exerciseLabel({ exercise: exMap.get(b.exerciseId), name: b.exerciseName,
                tag: 'span', className: 'detail-ex-name' }),
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

// Force the router to rebuild the current view after a delete. ⚠️ Re-renders in
// place — the old `#/blank` bounce pushed two history entries and broke the
// back arrow (2026-09-02, see refreshRoute()).
function refresh() {
  refreshRoute();
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
// 'muscles' | 'volume' | 'trend' | 'compare' | 'research' | 'calendar'
let graphMode = 'muscles';
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

/**
 * The Data screen — and, since 2026-09-05, a friend's Data screen too.
 *
 * 🚨 ONE FUNCTION, TWO SUBJECTS, AND THAT IS THE POINT. Tim: *"I want it to look
 * nearly exactly like how a user views their own data section."* The literal way
 * to get that is for it to BE the same function: every pane, every empty state,
 * every caption and every control comes from here, so a friend's Volume screen
 * cannot drift from yours by a pixel or a word.
 *
 * ⚠️ THE ALTERNATIVE WAS A SECOND SET OF PANES, which is what this project keeps
 * writing warnings about — `musclePanel()` was exported on 2026-09-03 for
 * exactly this reason, and `muscleRatings(rows)` and `weeklyVolumeByMuscle(rows)`
 * grew their row parameters on the same argument. Six more store getters grew
 * one for this.
 *
 * @param {object} [opts]
 * @param {{sessions,benchmarks,bodyWeight}} [opts.rows]  somebody else's
 *   published training. Absent means mine, read from the store.
 * @param {string} [opts.subject]  whose it is, for titles and captions.
 * @param {string} [opts.tab]      which tab to open on.
 * @param {Function} [opts.back]   where the arrow goes; only for a friend.
 * @param {Function} [opts.musclesPane]  renders the Muscles tab. A friend's map
 *   comes from their published grid and cannot be recomputed here.
 * @param {Node} [opts.musclesExtra]  appended under the Muscles pane — the
 *   friend page's "Recent workouts", which Tim asked to keep under the body.
 */
export async function GraphView(opts = {}) {
  const rows = opts.rows || null;
  const subject = opts.subject || null;
  /* ⚠️ `benchmarkComparison()` USED TO BE READ HERE AND IS NOT ANY MORE. Bars is
   * no longer benchmarks-only — it builds its rows through `pickSource()` so a
   * lift with workout sets and no benchmarks can still be compared — and two
   * comparison builders over one screen is two answers the day either changes.
   * The store getter is left exported: it is a fair question to ask and nothing
   * about it was wrong, it just is not the only question this tab asks. */
  const [options, bwPoints, bests] = await Promise.all([
    chartableExercises(2, rows), bodyWeightSeries(rows), currentBests(rows),
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

  /* Which tabs, and whose memory of the chosen one. ⚠️ A friend's page keeps its
   * own `mode` rather than writing the module-level `graphMode` — see dataTabs. */
  const tabs = rows ? FRIEND_TABS : DATA_TABS;
  let mode = rows
    ? (tabs.some(([k]) => k === opts.tab) ? opts.tab : 'muscles')
    : graphMode;
  const setMode = rows ? ((k) => { mode = k; }) : ((k) => { graphMode = k; mode = k; });
  const modeSwitch = dataTabs(mode, () => render(), tabs, setMode);

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
    // choice that doesn't exist (D28).
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

    const points = await seriesForExercise(graphChoice.exerciseId, graphChoice.field, source, rows);
    if (points.length < 2) {
      // One point is not a line, but it IS a measurement. Show it.
      const one = points[0];
      if (!one) {
        setChildren(host, emptyState('Nothing to chart from this source',
          `No ${SOURCE_LABEL[source].toLowerCase()} recorded for this exercise yet.`));
        return;
      }
      /* 🚨 THE ESTIMATE IS BUILT FROM THE SAME SOURCE AND THE SAME DAY as the
       * value printed above it. `currentBests()` was the tempting shortcut and
       * it is the wrong one here: it ranks benchmarks and workout sets together
       * on purpose, so a chart showing a workout set would have printed a max
       * computed from a benchmark and said nothing about the swap — precisely
       * the mixing Rule 4 / D14 forbids, arriving through the back door.
       *
       * ⚠️ There may be no pair to estimate from at all — a plank, a run, a
       * carry — and that is a stated outcome rather than a gap: the recording
       * and its day are still shown, and `est` simply stays null. */
      const sameDay = (await weightRepObservations(opt.id, source, rows))
        .filter((o) => o.date === one.date);
      let top = null;
      for (const o of sameDay) {
        if (!top || (e1rm(o.weight, o.reps) || 0) > (e1rm(top.weight, top.reps) || 0)) top = o;
      }
      setChildren(host, oneRecordingState({
        /* ⚠️ THIS USED TO BRANCH, AND THE REASON IT NO LONGER HAS TO IS THE
         * POINT. `fmtField` hard-coded "lbs" while the estimated max beside it
         * went through the user's unit, so this sentence could read
         * "120 lbs … ~81 kg max" — and the workaround was to bypass fmtField for
         * weight. `fmtField` was fixed at the source on 2026-09-06, so the
         * branch is gone rather than left standing as a fossil that quietly
         * says the bug is still there. */
        setText: fmtField(graphChoice.field, one.value),
        date: one.date,
        source,
        est: top ? e1rm(top.weight, top.reps) : null,
        estFrom: top
          ? `${units.withUnit(top.weight)}${opt.loadType === 'per_side' ? '/side' : ''} × ${top.reps} that day`
          : '',
      }));
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
      target = clampReps(await defaultTargetReps(opt.id, source, rows)) || 10;
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

    const points = await normalizedSeries(opt.id, target, source, rows);
    if (points.length < 2) {
      const p = points[0];
      /* ⚠️ THE SET AS IT WAS RECORDED, NOT THE NORMALISED VALUE. Every point on
       * this chart is a weight restated at the target rep count, and for a set
       * that was not performed at that count the restated weight is itself an
       * estimate. With one point there is nothing to compare it against, so
       * printing it would be an estimate standing in for the measurement —
       * Rule 5 the wrong way round. `p.weight × p.reps` is what was lifted; the
       * estimated max beside it is the derived number, and it is labelled. */
      setChildren(host, p
        ? oneRecordingState({
            setText: `${units.withUnit(p.weight)}${opt.loadType === 'per_side' ? '/side' : ''} × ${p.reps}`,
            date: p.date,
            source,
            est: e1rm(p.weight, p.reps),
            estFrom: 'that set',
          })
        : emptyState('Nothing to chart from this source',
            `No ${SOURCE_LABEL[source].toLowerCase()} with both a weight and a rep count `
            + 'recorded for this exercise yet.'));
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
        /* ⚠️ THE VERDICT ON THE CHART STAYS; THE PHYSIOLOGY GOES BEHIND THE ?
         * (Rule 9). "Unreliable above 15 reps" changes what the reader thinks
         * every point on this chart is, so it can never be something to ask
         * for. WHY a high-rep set stops measuring strength is the classic case
         * for the dot.
         *
         * ⚠️ NO `.help-line` HERE, DELIBERATELY. `.chart-caption` is already a
         * baseline flex row with the same 7px gap, and `.help-dot` is
         * `flex: none` — wrapping it would have meant re-classing the caption
         * to `.field-help` and changing its size and colour, which is a visual
         * change nobody asked for. The dot still sits against the words. */
        conf !== 'good'
          ? el('div', { class: 'chart-caption warn' },
              el('span', { text: conf === 'poor'
                ? 'Estimates above 15 reps are unreliable.'
                : 'Estimates get looser above 10 reps.' }),
              conf === 'poor'
                ? helpDot('Above 15 reps a set is limited by breathing and grip more than by '
                    + 'strength, so what it converts to says less about a one-rep max.',
                  { label: 'Why high-rep estimates are unreliable' })
                : null,
            )
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

  /* ---------- compare (paired bars) ---------- */

  /**
   * Where each lift started and where it is now — ONE SOURCE PER LIFT.
   *
   * 🚨 IT USED TO BE BENCHMARKS ONLY, AND THAT LEFT THE TAB BLANK FOR ALMOST
   * EVERYBODY. `benchmarkComparison()` needs the same exercise benchmarked on
   * two different days; most people never record a benchmark at all, so Bars
   * fell through to bestsPane() while the app held months of workout sets that
   * answer exactly the question the screen asks. docs/direction.md §3.1 — a
   * clearly-labelled best-effort number beats a blank.
   *
   * 🚨 ONE SOURCE PER ROW, AND THE ROW SAYS WHICH (Rule 4 / D14). A row whose
   * "First" is a benchmark and whose "Now" is a mid-workout set is the mixing
   * that rule exists to stop: a benchmark is taken fresh and a workout set comes
   * after everything else the session did, so the pair would read as strength
   * swinging when nothing had happened but a change of measuring instrument.
   * The guarantee here is structural rather than a check — every row is built
   * from ONE call to `seriesForExercise`/`normalizedSeries` with an explicit
   * `source`, and those never return the other one's readings. A lift whose
   * picked source cannot supply two days is dropped rather than patched from
   * the other; the source is then named on the row itself.
   *
   * ⚠️ WHICH SOURCE IS `pickSource()` — the Graph's own picker, not a second
   * rule. Whichever has more days to draw, ties to benchmarks, and an explicit
   * tap on the Graph's source chips wins here too. Two tabs reading one body of
   * data must not disagree about which half of it they are reading.
   */
  async function sourcedComparison() {
    // Fixed order, so the field chips do not reshuffle with whatever the walk
    // happened to see first.
    const FIELD_ORDER = ['weight', 'reps', 'time', 'distance'];
    const byField = {};
    const covered = new Set();

    const mkRow = (opt, src, pts, atReps) => {
      const first = pts[0], last = pts[pts.length - 1];
      return {
        id: opt.id,
        name: opt.name,
        loadType: opt.loadType,
        source: src,
        atReps,
        // Only a normalised series has anything to be estimated ABOUT: a raw
        // field is the number that was written down.
        startActual: atReps ? first.actual !== false : true,
        nowActual: atReps ? last.actual !== false : true,
        start: first.value,
        startDate: first.date,
        now: last.value,
        nowDate: last.date,
        delta: last.value - first.value,
        pct: first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100,
        count: pts.length,
      };
    };

    // Everything one source can say about one exercise. Returns [] rather than
    // reaching for the other source — that decision belongs to the caller, and
    // it is the decision that keeps a row unmixed.
    const fromSource = async (opt, src) => {
      const s = opt.sources[src];
      if (!s) return [];
      const out = [];

      if (s.normalizable) {
        // The same rep target the Graph is using for this exercise and source,
        // seeded from the modal rep count the first time either tab asks.
        const key = opt.id + '|' + src;
        let target = targetReps.get(key);
        if (target == null) {
          target = clampReps(await defaultTargetReps(opt.id, src, rows)) || 10;
          targetReps.set(key, target);
        }
        const pts = await normalizedSeries(opt.id, target, src, rows);
        if (pts.length >= 2) out.push(['weight', mkRow(opt, src, pts, target)]);
      }

      for (const f of s.fields) {
        // Once weight is compared at a fixed rep count, the raw weight and the
        // bare rep count are each half of a result — "reps went 10 → 4" is not
        // an answer. The same suppression `benchmarkComparison()` makes.
        if (s.normalizable && (f === 'weight' || f === 'reps')) continue;
        const pts = await seriesForExercise(opt.id, f, src, rows);
        if (pts.length >= 2) out.push([f, mkRow(opt, src, pts, null)]);
      }
      return out;
    };

    for (const opt of options) {
      // Picked source first; the other usable one only if the picked one has
      // nothing to say at all. Never both — see the block comment.
      const picked = pickSource(opt);
      const order = [picked, ...opt.usableSources.filter((s) => s !== picked)];
      for (const src of order) {
        const built = await fromSource(opt, src);
        if (!built.length) continue;
        for (const [f, row] of built) {
          if (!byField[f]) byField[f] = [];
          byField[f].push(row);
          covered.add(row.id);
        }
        break;
      }
    }

    // Biggest movers first — the chart's job is to show change.
    for (const f of Object.keys(byField)) byField[f].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return {
      fields: FIELD_ORDER.filter((f) => byField[f]),
      byField,
      // Lifts the app holds a number for and still cannot compare: one recorded
      // day. Counted off `bests`, which is every lift with anything at all.
      pending: (bests || []).filter((b) => !covered.has(b.id)).length,
    };
  }

  /* ⚠️ REBUILT ONLY WHEN THE SOURCE OR REP-TARGET CHOICES HAVE MOVED. Those are
   * module-level maps the Graph tab writes to, so a cache with no key goes stale
   * the moment somebody taps a source chip and comes back — and rebuilding on
   * every field-chip tap walks every exercise again for a list that cannot have
   * changed. The signature is taken AFTER the build because the build itself
   * seeds `targetReps`; taking it before guarantees a miss on the next call. */
  let compareCache = null;
  const compareSig = () => JSON.stringify([[...sourceChoice], [...targetReps]]);

  async function renderCompare() {
    if (!compareCache || compareCache.key !== compareSig()) {
      const data = await sourcedComparison();
      compareCache = { key: compareSig(), data };
    }
    const cmp = compareCache.data;

    if (!cmp.fields.length) {
      setChildren(top);
      setChildren(host, bestsPane(bests,
        'A bar needs the same lift recorded on two different days — as a benchmark, or in a '
        + 'workout. Until then, here is where everything stands.'));
      return;
    }
    if (!compareField || !cmp.fields.includes(compareField)) compareField = cmp.fields[0];
    const barRows = cmp.byField[compareField];

    setChildren(top,
      el('div', { class: 'control-row' },
        cmp.fields.length > 1
          ? el('div', { class: 'chips tight' }, cmp.fields.map((f) =>
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

    const anyNormalized = barRows.some((r) => r.atReps);
    const usedSources = [...new Set(barRows.map((r) => r.source))];
    setChildren(host,
      barChart(barRows, compareField),
      el('div', { class: 'chart-foot' },
        el('div', { class: 'chart-caption' },
          el('span', {
            // ⚠️ THE CAPTION SAYS THE RULE, THE ROW SAYS THE ANSWER. When every
            // row happens to come from one source the caption can state it
            // outright; when they differ, the only honest sentence up here is
            // that no row mixes them, and the label on each row carries which.
            text: (usedSources.length === 1
              ? `${SOURCE_LABEL[usedSources[0]]} only`
              : 'One source per lift, never mixed — each row says which')
              + (anyNormalized ? ' · @N reps means weight compared at that rep count, faded bars estimated' : '')
              + (cmp.pending ? ` · ${cmp.pending} more need a second recorded day` : ''),
          })),
      ),
    );
  }

  async function render() {
    // Indexed off the shared list, so adding or reordering a segment cannot
    // leave the selected state pointing at the wrong one.
    modeSwitch.querySelectorAll('.seg').forEach((b, i) =>
      b.setAttribute('aria-selected', String(tabs[i][0] === mode)));
    /* Muscles is the one mode with a side panel on a wide screen, so it is the
     * one mode that lays out as a row. The class carries that; the CSS decides
     * at which width it actually applies.
     *
     * 🚨 AND A FRIEND'S MAP MUST NOT TAKE THAT CLASS — 2026-09-09, Tim: *"right
     * now viewing another person's profile (specifically on a laptop) is a
     * mess."* It was, and this line was the whole of it. `is-muscles` makes the
     * host a ROW at 860px, which is right for the two children your own map puts
     * in it (the figure and its panel) and catastrophic for the SEVEN a friend's
     * page does — their face, the map, their body weight, two headings, their
     * recent workouts and the disconnect footer all became columns side by side,
     * each squeezed to a word or two wide, with the workouts running off the
     * right-hand edge behind a horizontal scrollbar.
     *
     * ⚠️ THE SIDE-BY-SIDE LAYOUT IS NOT LOST, it moved INSIDE the pane where the
     * two things that belong beside each other are: `.map-split` in
     * views-social.js. The host is a plain column either way, which is what a
     * page of stacked sections has always wanted. */
    host.classList.toggle('is-muscles', mode === 'muscles' && !opts.musclesPane);
    host.classList.toggle('is-shared-muscles', mode === 'muscles' && Boolean(opts.musclesPane));
    if (mode === 'muscles') {
      /* 🚨 A FRIEND'S MAP IS NOT `muscleGroupsPane` WITH ROWS, AND CANNOT BE.
       * Their percentile was computed on THEIR device against their body weight
       * and age, neither of which is in a published document — that is the whole
       * design (js/shared-map.js). So the friend page hands in its own renderer,
       * which reads the published grid, rather than this screen recomputing a
       * number it does not have the inputs for. */
      if (opts.musclesPane) await opts.musclesPane(host, top);
      else await muscleGroupsPane(host, top);
      /* ⚠️ APPENDED, NOT A SIXTH TAB. Tim asked for the friend page's recent
       * workouts to stay "below that user's body view as it is now" — it is the
       * list you scroll to after looking at their map, and promoting it to a tab
       * would put it behind one more decision than it deserves. */
      if (opts.musclesExtra) host.append(opts.musclesExtra);
    } else if (mode === 'volume') {
      await renderVolumePane(host, top, { rows: rows && rows.sessions, subject });
    } else if (mode === 'compare') await renderCompare();
    else if (mode === 'research') await renderResearchPane(host, top);
    else if (mode === 'calendar') await renderCalendarPane(host, top, { rows, subject });
    else await renderTrend();
  }

  await render();

  return screenShell({
    // A friend's page is a fullscreen view with a back arrow and their name in
    // the title; my own is a nav-level screen whose header IS the tab bar.
    profile: !rows,
    noNav: Boolean(rows),
    back: opts.back,
    title: rows ? subject : modeSwitch,
    top: rows ? el('div', {}, modeSwitch, top) : top,
    scroll: host,
  });
}

/* ---- draw the line chart at the pixel size of its container ---- */

let chartObserver = null;

// ⚠️ EXPORTED SINCE 2026-09-03 so a friend's graph is drawn by the same
// measured-SVG chart as yours, gridlines, markers, hover readout and all —
// rather than by a second, thinner chart that would have to be kept in step
// with this one forever. Rule 5's marker rule lives inside it.
export function fillChart(host, points, field, label) {
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

/* ---- one recording: the number, not a blank ---- */
//
// 🚨 A SINGLE RECORDING IS A MEASUREMENT, AND BOTH CHART BRANCHES USED TO THROW
// IT AWAY. "One recording so far" and "Only one data point" printed an empty
// pane while the app was holding the weight, the reps and the day it was lifted
// — the same fault bestsPane() was written for in 2026-08-17, surviving one
// level further in. docs/direction.md §3.1: *"something is always better than
// nothing"*, with the half Tim kept being *"have a way to be upfront about it"*.
//
// 🛑 STILL NO LINE, AND NO TREND THROUGH ONE POINT. Drawing a shape out of one
// reading invents the shape — Rule 5, an inference must never look like a
// measurement — so this is text, and it says so out loud rather than leaving
// the absence of a chart to imply it.
//
// ⚠️ THE ESTIMATE IS LABELLED THE WAY bestsPane() LABELS ONE: the tilde, the
// word estimate, and the set the model was fed named beside it. `estFrom` is
// required rather than optional for that reason — an estimated max whose input
// is not on the screen is indistinguishable from one the app made up.
//
// ⚠️ AND `source` IS NAMED ON IT. The caller has already picked one source and
// this number came from that source alone; saying which is what keeps it from
// reading as "your best, from everywhere" (Rule 4 / D14).
function oneRecordingState({ setText, date, source, est, estFrom }) {
  return emptyState(
    'One recording so far',
    `${setText} on ${fmtDateShort(date)}, from ${SOURCE_LABEL[source].toLowerCase()}.`
      + (est ? ` Estimated max ~${units.withUnit(Math.round(est))}.` : ''),
    el('div', { class: 'field-help', text:
      (est ? `The "~" max is an estimate from ${estFrom}, not a weight you have lifted. ` : '')
      + 'One point is not a line, so nothing here is drawn as a trend. Record this on another '
      + 'day and it becomes one.' }),
  );
}

/* ---- paired horizontal bars: where a lift started, where it is now ---- */

function barChart(rows, field) {
  // A guard, not a screen anybody should reach: renderCompare() falls back to
  // bestsPane() when there is nothing to compare, because a list of where every
  // lift stands is worth more than a sentence about what to record next.
  if (!rows || !rows.length) {
    return emptyState('Nothing to compare yet',
      // ⚠️ RE-SHAPED, NOT HIDDEN — an empty state is an instruction, and an
      // instruction is WHAT. `emptyState()` takes a string in any case.
      'Record the same exercise on two different days, as a benchmark or in a workout. '
      + 'It will then appear here.');
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
          /* 🚨 WHICH SOURCE THIS ROW IS, ON THE ROW (Rule 4 / D14). Both bars in
           * a row are always from one source, and the list as a whole may hold
           * rows from either — so the fact has to travel with the row rather
           * than sit in one caption underneath the lot of them.
           *
           * ⚠️ IT WEARS `.bar-reps` RATHER THAN A CLASS OF ITS OWN. That class
           * is the head's small faint qualifier slot; a new one would be a
           * visual change nobody asked for, and this needs the styling that is
           * already there, not a new look. */
          r.source ? el('span', { class: 'bar-reps', text: SOURCE_LABEL[r.source] }) : null,
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

  /* 🚨 THE AXIS IS IN THE READER'S UNIT — 2026-09-06, and it was not before.
   * Every value on this chart is POUNDS, because that is the one thing this app
   * stores (units.js), and the labels printed it raw. A reader on kg saw their
   * bench charted as 205 while the set list, the muscle panel and the record
   * screen all said 93. **Nothing was wrong with the chart except the words
   * down its left-hand side**, which is the worst kind: the shape is right, so
   * there is nothing to notice.
   *
   * ⚠️ ONLY THE LABEL IS CONVERTED, NOT THE GEOMETRY, and that is exact rather
   * than a shortcut: pounds to kilograms is a pure scale with no offset, so
   * every gridline stays on the pixel it was already on and only its name
   * changes. Converting the plotted values would move nothing and risk the
   * scaling. */
  const asShown = (v) => (field === 'weight' ? units.toDisplay(v) : v);

  // ⚠️ Derived from the gap AS SHOWN. In kg the same span is 2.2x smaller, so a
  // step that earned whole numbers in pounds can need a decimal — and the old
  // derivation, run on pounds, would have printed two adjacent gridlines with
  // the same number on them.
  const shownGap = Math.abs(asShown(vMin + gap) - asShown(vMin));
  const dp = shownGap >= 5 ? 0 : shownGap >= 0.5 ? 1 : 2;

  for (let i = 0; i <= steps; i++) {
    const v = vMin + gap * i;
    const yy = y(v);
    add('line', { x1: padL, x2: W - padR, y1: yy, y2: yy }, 'grid-line');
    const t = add('text', { x: padL - 7, y: yy + 3.5, 'text-anchor': 'end' }, 'axis-text');
    t.textContent = field === 'time' ? fmtTime(v) : trimNum(Number(asShown(v).toFixed(dp)));
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

  /* Whether other people can find you by typing your name (2026-08-29).
   *
   * ⚠️ IT IS A COURTESY, NOT A PROTECTION, and the help text has to say so.
   * The rules cannot enforce it — a client can always write its own directory
   * row — so calling it a privacy control would be the same class of overclaim
   * the disconnect sheet shipped with in 2026-08-24. What it genuinely does is
   * take your row out, which is what search reads.
   *
   * Defaults ON by absence, unlike the rest timer, and for the opposite
   * reason: with fewer than five accounts on the site, a directory nobody is
   * in is a search that never finds anybody. */
  function setListed(on, e) {
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
    social.setListed(on)
      .then(() => toast(on ? 'People can find you by name' : 'You are no longer findable'))
      .catch((err) => toast(err.message));
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
        el('div', { class: 'help-line' },
          el('label', { text: 'Colour' }),
          helpDot('Gold is the original. Teal and Indigo cool the whole app down; Ember keeps the '
            + 'gold and warms everything around it.', { label: 'What each colour does' })),
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
        /* ⚠️ WHAT SURVIVED THE SPLIT ABOVE (Rule 9). The one thing a reader
         * needs before tapping is that this is NOT a second theme switch — a
         * person who thinks it is will avoid it — and that is five words. Which
         * of the four is warm and which is cool describes options whose
         * swatches are already drawn on the chips, so it went behind the ? on
         * the label rather than sitting here as a paragraph. */
        el('div', { class: 'field-help', text: 'Works with both Dark and Light.' }),
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
        /* ⚠️ THE SAFETY HALF STAYS IN THE OPEN. "Switching never changes
         * anything you have recorded" is a statement about the reader's data
         * and Rule 9 keeps those on the screen; HOW that is true — one stored
         * unit, converted for display — is WHY. */
        el('div', { class: 'help-line' },
          el('span', { class: 'field-help', text:
            'Display only. Switching never changes anything you have recorded.' }),
          helpDot('Weights are stored the same way either way, so switching back and forth as '
            + 'often as you like changes nothing but the label.',
          { label: 'Why switching is safe' })),
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
        /* 🚨 "THE RANKING IS THE SAME EITHER WAY" DOES NOT GO BEHIND THE ?, and
         * that is the whole reason this switch is honest. It changes what the
         * reader thinks the ranking IS — somebody who believes turning this off
         * gives them a gentler level has been misled by a setting. What moved
         * is the naming of the levels (the muscle map prints them) and the
         * phrasing about seeing the working. */
        el('div', { class: 'help-line' },
          el('span', { class: 'field-help', text:
            'Off shows your ranking and nothing else. On adds the percentile behind it — the '
            + 'ranking is the same either way.' }),
          helpDot('The rankings are Beginner through Elite, and they are worked out from the same '
            + 'percentile whichever way this is set. It only decides how much of the working you '
            + 'see.', { label: 'What more details actually changes' })),
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
        // ⚠️ RE-SHAPED, NOT HIDDEN. Every word here is what the switch DOES,
        // and a person deciding whether to turn something on must not have to
        // open a ? to find out what it turns on. One 22-word sentence became two.
        el('div', { class: 'field-help', text:
          'On shows a rest clock at the bottom of the workout screen. It starts when you log a '
          + 'set. You can give it a target to count against.' }),
      ),

      /* ⚠️ FINDABLE BY NAME — the opt-out for the directory added 2026-08-29.
       * The whole argument for the directory existing at all is above the
       * `directory` block in firestore.rules; this is the one control a person
       * has over it, and the help text is deliberately blunt about what it is
       * and is not. */
      el('div', { class: 'field' },
        el('label', { text: 'Findable by name' }),
        el('div', { class: 'chips' },
          el('button', {
            class: 'chip', 'aria-pressed': String(settings.listedInDirectory === false),
            text: 'Off', onClick: (e) => setListed(false, e),
          }),
          el('button', {
            class: 'chip', 'aria-pressed': String(settings.listedInDirectory !== false),
            text: 'On', onClick: (e) => setListed(true, e),
          }),
        ),
        /* ⚠️ WHAT THE SWITCH DOES STAYS ON THE SCREEN; the reassurance about
         * what is listed moved behind the ? (2026-09-07). "You still have to
         * accept" is load-bearing — it is the difference between being findable
         * and being connected — so it survives, in five words. */
        el('div', { class: 'help-line' },
          el('span', { class: 'field-help', text:
            'On: people can find you by name and ask to connect. You still accept.' }),
          helpDot(el('div', {},
            el('p', { text: 'Off takes your name out of that search. Your code and invite '
              + 'links keep working.' }),
            el('p', { text: 'Only your display name is ever listed — never your email, and '
              + 'nothing about your training.' }),
          ), { label: 'What being findable means' })),
      ),

      el('div', { class: 'section-label', text: 'You' }),
      /* 🔄 ~~THE GOALS ROW LIVED HERE~~ **IT IS ON PROFILE SINCE 2026-09-11**,
       * step 4 of the Data/Profile split (`direction.md` §4b, `progress.md` Open
       * work 29). The old comment is worth keeping because its argument is the
       * one that moved it: *"a route with no way in is deleted in every sense
       * that matters to a user"* — 2026-08-25 took Goals off the bottom bar for
       * the calendar and Settings was the way in it was given.
       *
       * 🚨 IT IS GONE FROM HERE RATHER THAN LEFT AS A SECOND DOOR, and that is
       * what makes this a move. `#/me` is a TAB; this row is three taps behind
       * an icon, on the screen Tim called crowded. Two doors would leave the app
       * with two answers to "where are my goals" and the worse one nearer the
       * top. `#/goals` still resolves for anything bookmarked. */
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
 * Volume — weekly sets per muscle group (2026-08-31)
 *
 * D3, and it has been called "the headline metric" since the first day of this
 * project: hypertrophy responds to hard sets per muscle per week. The app has
 * been able to compute it for a year — `weeklyVolume()` rates every programme
 * with it — and has only ever SHOWN it for one goal muscle on a screen most
 * people never open. This is that number, for every muscle, from what was
 * actually recorded rather than from what was planned.
 *
 * ⚠️ THE TIERS ARE NOT TARGETS, AND THE SCREEN HAS TO KEEP SAYING SO. They come
 * from Table 3 of Pelland et al. and describe what ANOTHER SET BUYS at that
 * volume — "lower efficiency" means each extra set does less, not that you are
 * doing too much. Rule 6: the app does not get an opinion it has not earned, and
 * "more is better up to a point and worse after it" is not a finding this
 * evidence supports. So nothing here is coloured good or bad, there is no target
 * line, and the one threshold drawn is the one the source states outright —
 * 4 sets a week, below which no detectable change is expected.
 *
 * ⚠️ AND IT COUNTS EVERY SET YOU LOGGED, WARM-UPS INCLUDED. That is the open UX
 * question this project records (Open work 0c) and it is Tim's call, not this
 * screen's: excluding light sets would also throw away back-off work, which is
 * often the hardest set of the session. Until he decides, the screen says what
 * it counts rather than quietly counting something else.
 * ================================================================== */

// Both survive leaving the screen, for the same reason `calMode` does: somebody
// reading three months of volume should not be dropped back to four weeks by a
// trip to the calendar.
let volDays = 28;
let volOpen = null;

const VOL_WINDOWS = [[28, '4 weeks'], [56, '8 weeks'], [84, '12 weeks']];

// One decimal, because half sets are the whole point of fractional counting —
// but never a bare "12.0", which reads as false precision on a count.
const fmtSets = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');

/**
 * One muscle's row under the figure.
 *
 * ⚠️ IT SELECTS, IT NO LONGER EXPANDS — changed when the body map arrived
 * (2026-09-01). The row used to open its own copy of the working; with the
 * figure above it that would be the same block on screen twice, which is the
 * fault Tim named on the set row (*"it doesn't have 2 places for the same
 * thing"*) arriving on a different screen. The working has one home now, in the
 * panel under the figure, and this row is one of the two ways to point at it.
 */
/* ⚠️ THE `perWeek` FLAG IS GONE FROM THIS FAMILY OF FUNCTIONS (2026-09-06), and
 * its absence is the point — see the block above `renderVolumePane`'s span line.
 * The row, the panel, the contributor list, the figure's colours and the legend
 * are all a RATE, unconditionally, because a flag threaded through five places
 * is five chances to print a window total under a weekly heading. */
function volRow(m, scale, open, onToggle) {
  const value = m.weeklySets;
  const tier = hypertrophyTier(m.weeklySets);
  const none = value <= 0;

  const sub = none
    ? 'Nothing logged'
    : `${tier.label} · ${m.daysTrained ? `${fmtSets(m.sessionsPerWeek)} days a week` : 'never trained directly'}`;

  const btn = el('button', {
    class: 'vol-row' + (none ? ' is-none' : ''),
    'aria-pressed': String(open),
    dataset: { muscle: m.muscle },
    onClick: onToggle,
  },
    el('span', { class: 'vol-head' },
      el('span', { class: 'vol-name', text: m.muscle }),
      el('span', { class: 'vol-num' },
        el('b', { text: fmtSets(value) }),
        el('span', { class: 'vol-unit', text: ' / wk' }),
      ),
    ),
    // Decorative: every number and every label above and below it is already
    // text, so the bar adds shape rather than meaning. A screen reader that
    // announced it would be reading the same figure twice.
    el('span', { class: 'vol-track', 'aria-hidden': 'true' },
      el('span', { class: 'vol-fill', style: `width:${Math.min(100, (value / scale) * 100).toFixed(2)}%` }),
      // The one threshold the source actually states.
      el('span', { class: 'vol-med', style: `left:${Math.min(100, (4 / scale) * 100).toFixed(2)}%` }),
    ),
    el('span', { class: 'vol-sub', text: sub }),
  );

  return el('div', { class: 'vol-item' }, btn);
}

/**
 * What is behind one muscle's number.
 *
 * ⚠️ THE CONTRIBUTORS ARE THE POINT OF THIS BLOCK. A weekly set count is a
 * derived figure built out of a fractional rule most people have never heard of,
 * and a derived figure nobody can check is one people either believe too much or
 * stop believing altogether. Naming the exercises and their halves makes it
 * checkable against the sessions they came from — the same argument the muscle
 * panel's "from … and … and …" line makes one screen over.
 */
function volDetail(m, weeks) {
  const hyp = hypertrophyTier(m.weeklySets);
  const str = strengthTier(m.weeklySets);
  // ⚠️ IN THE SAME UNIT AS THE NUMBER ABOVE THEM, which the first version got
  // wrong: the row said 21.8 a week and the list under it said 24, because the
  // store counts a window and the row divides by it. Parts that do not add up to
  // the whole in front of them are worse than no parts at all — the whole reason
  // this block exists is that somebody can check the figure.
  //
  // ⚠️ AND IT IS NO LONGER CONDITIONAL. It used to divide by the weeks only when
  // the rows were showing a rate; the rows always are now, so this always does.
  // The two halves of that pairing must move together or the block is quoting a
  // different quantity in the same column, which is the exact fault above.
  const shown = (sets) => fmtSets(sets / weeks);

  if (!m.contributors.length) {
    /* ⚠️ THE ZERO IS THE FACT; "that is the finding, not a gap" IS WHY.
     * A reader who has just tapped a muscle and been given nothing needs to
     * know the app looked and found nothing — that is WHAT, and it is one
     * sentence. The argument for why an empty answer is the point of the screen
     * is exactly the kind of reasoning Rule 9 puts one tap away. */
    return el('div', { class: 'vol-detail' },
      el('div', { class: 'help-line' },
        el('span', { class: 'field-help', text:
          `Nothing in this window trained ${m.muscle}, directly or through another lift.` }),
        helpDot('That is the finding rather than a gap in the app — a muscle with no work is what '
          + 'this screen exists to make visible.', { label: 'Why this is not a missing number' })),
    );
  }

  return el('div', { class: 'vol-detail' },
    // The published bands are bands of a WEEKLY dose, so they read against the
    // weekly figure and nothing else. That is now the only figure this screen
    // prints, which is why they are unconditional.
    el('div', { class: 'vol-tier' },
      el('div', { class: 'vol-tier-line' }, el('b', { text: hyp.label + '. ' }), hyp.detail),
      el('div', { class: 'vol-tier-line' }, el('b', { text: 'For strength: ' }),
        `${str.label.toLowerCase()}. ${str.detail}`),
    ),
    el('div', { class: 'vol-contrib-head', text: 'Where those sets come from — a week' }),
    el('div', { class: 'vol-contrib' },
      ...m.contributors.map((c) => el('div', { class: 'vol-contrib-row' },
        el('span', { class: 'vol-contrib-name', text: c.name }),
        el('span', { class: 'vol-contrib-kind', text: c.kind === 'direct' ? 'direct' : 'half' }),
        el('span', { class: 'vol-contrib-sets', text: shown(c.sets) }),
      )),
    ),
  );
}

/**
 * The figure, coloured by how much work each muscle has been getting.
 *
 * Tim, 2026-09-01: *"the exact same human body display with the coloured muscle
 * groups (exact same picture), but instead coloured them by the number of sets
 * for that muscle group rather than strength."*
 *
 * 🚨 THE SAME `bodySvg()`, THE SAME ART, AND A DIFFERENT MEANING FOR THE COLOUR
 * — which is the thing to be careful about. Two screens now paint the same
 * drawing from two different scales, so everything that STATES what a colour
 * means has to be per-screen: the figure's own accessible label, every muscle's
 * label and title, and the legend under it. Nothing here may say "level".
 *
 * ⚠️ AND THIS MAP HAS NO GREY, WHICH THE STRENGTH ONE CANNOT MANAGE. Over there
 * a muscle with no published standard can never be ranked and is painted grey
 * beside "no data" in the legend — the complaint about abs. Here every muscle
 * has a number, because zero sets IS a number, so every muscle is painted and
 * the one thing this screen cannot do is fail to say something.
 */
/* 🚨 AND THE COLOURS ARE A RATE, WHICH THEY WERE NOT UNTIL 2026-09-06. Under a
 * fortnight this painted `totalSets` — a window total — against `volumeShade()`,
 * whose bands are weekly doses out of the literature. The legend's heading
 * changed to "Sets so far" and the band edges did not, so a nine-day beginner
 * with 21 recorded sets was painted the colour of somebody training hard. That
 * is the fault the key's own header comment describes, arriving through the
 * figure instead of through the chips. One unit, one scale, one key. */
function volumeFigure(data, selected, onPick) {
  const byMuscle = new Map(data.muscles.map((m) => [m.muscle, m]));
  const levels = new Map();
  for (const muscle of MAPPED_MUSCLES) {
    const m = byMuscle.get(muscle);
    const sets = m ? m.weeklySets : 0;
    const shade = volumeShade(sets);
    levels.set(muscle, {
      levelKey: `vol-${shade.key}`,
      // Read out on tap and on hover. The number is the answer; the band is how
      // it is painted, and both are said in words because the colour cannot be
      // trusted to carry it on its own.
      label: `${fmtSets(sets)} sets a week`,
    });
  }
  return bodySvg(levels, selected, onPick, {
    label: 'Muscle groups coloured by how many sets a week each one is getting',
  });
}

/**
 * ⚠️ THE KEY SAYS ITS UNIT, and that sentence is here because it was missing.
 * The bands are a RATE — sets a WEEK — and they are therefore the same bands at
 * every window: picking 12 weeks measures a longer stretch, it does not ask more
 * of you. The chips read "10–19" beside a control offering 4, 8 and 12 weeks,
 * and Tim read them as totals for the window and asked (correctly, on that
 * reading) why the ranges did not move with it. The numbers were right; the key
 * was not saying what it was counting.
 *
 * ⚠️ SO THE FIX IS THE LABEL, NOT THE THRESHOLDS. 4, 10 and 20 are weekly doses
 * out of the literature; scaling them by the window would compare somebody's
 * training against a target the research never states.
 */
function volumeLegend(selectedKey) {
  // ⚠️ Read in the direction the RAMP runs — none first, most last — while
  // VOLUME_SHADES is stored descending because that is the order its lookup
  // needs. A key printed against the scale backwards is a key nobody trusts.
  return el('div', { class: 'vol-legend', role: 'list' },
    // ⚠️ "Sets a week", never "Sets so far". The band edges below it are weekly
    // doses and cannot be relabelled without being recomputed; the heading used
    // to switch under a fortnight while they stayed put, which named the wrong
    // quantity over the right numbers.
    el('span', { class: 'vol-legend-unit', text: 'Sets a week' }),
    ...[...VOLUME_SHADES].reverse().map((s) => el('span', {
      class: 'vol-chip' + (s.key === selectedKey ? ' is-on' : ''), role: 'listitem',
    },
      el('i', { style: `background:var(--vol-${s.key})` }),
      s.label,
    )),
  );
}

/**
 * @param {object} [opts]
 * @param {object[]} [opts.rows]  ⚠️ SOMEBODY ELSE'S SESSIONS (2026-09-03). Tim
 *   asked that a friend's volume be readable the way your own is, and the honest
 *   way to do that is to render the SAME screen from their published rows rather
 *   than to write a second, thinner one that drifts. `weeklyVolumeByMuscle()`
 *   takes the rows; everything below here is unchanged.
 * @param {string} [opts.subject]  Whose training this is, for the sentences that
 *   name a person. Absent means yours.
 */
/**
 * A CALENDAR PANE — a friend's fifth tab, and since 2026-09-08 my own sixth.
 *
 * Tim, 2026-09-05: *"with the 'research' tab replaced with that user's
 * 'calendar' data."*
 *
 * 🔄 ~~TWO SUBJECTS, TWO DIFFERENT CALENDARS~~ — ONE CALENDAR SINCE 2026-09-10,
 * Tim: *"When you view a friend's data, you can see their calendar, but can't
 * select between months and years. Make it so you can."*
 *
 * ⚠️ THE SUPERSEDED ARGUMENT IS WORTH KEEPING, because it was right about the
 * hazard and wrong about the remedy. It read: *"Years exists to fit a whole
 * training history on one screen; a friend publishes their most recent sixty
 * sessions, so the squares would thin out and stop partway up the page — a
 * picture of what they SHARE, drawn as though it were a picture of what they
 * have DONE."* Every word of that is still true of the picture. What does not
 * follow is that the view had to be withheld: the same objection applies to
 * their Volume and Graph tabs, which ship with a sentence rather than a
 * refusal, and a screen that thins out and SAYS SO is not the same object as one
 * that thins out silently. See `ownCalendar` for the four things that differ on
 * their page and why each one is an honesty decision.
 *
 * 🛑 WHAT DID NOT SURVIVE THE REVERSAL: the "N days trained" figure. A count of
 * published days printed under the name of a training total is the one thing
 * here that could not be fixed by a caveat, because it is a number rather than
 * an impression — `publishedDaysLabel` in js/year-grid.js.
 *
 * ⚠️ AND THE CELLS STILL GO NOWHERE. `#/day/<iso>` is my own training for that
 * date and there is no equivalent screen for somebody else; their individual
 * workouts are already reachable from the feed and from Recent workouts. So a
 * cell states what they did and is inert, rather than going somewhere wrong.
 */
export async function renderCalendarPane(host, top, opts = {}) {
  const rows = opts.rows || null;
  const who = opts.subject || 'They';
  const activity = await activityByDate(rows);
  const today = todayISO();

  /* 🚨 ONE BUILDER FOR BOTH SUBJECTS. Same code the `#/calendar` route uses, so
   * Months, Years, the readout and the day links cannot differ between the three
   * doors into it — the whole reason the switch reaching a friend's page was a
   * three-line change rather than a second copy of it.
   *
   * ⚠️ `wireSegmented` IS CALLED HERE and it has to be. `screenShell` wires the
   * controls a screen was BUILT with; this control is built later, every time
   * somebody taps back onto this segment, so nothing else would ever see it and
   * the Months/Years pill would be the one segmented control in the app that
   * does not slide. It is idempotent — it marks the bar it has done — so the
   * first render, where the shell wires it too, still gets exactly one pill. */
  if (rows && !activity.size) {
    // Before the switch rather than after it: a Months/Years control over an
    // empty pane offers two ways to look at nothing.
    setChildren(top);
    setChildren(host, emptyState('Nothing recorded yet',
      `${who} has not published any sessions you can read.`));
    return;
  }

  const cal = ownCalendar(activity, today, rows ? { friend: true, who } : {});
  setChildren(top, cal.top);
  cal.paint(host);
  wireSegmented(top);
}

export async function renderVolumePane(host, top, opts = {}) {
  const rows = opts.rows || null;
  const who = opts.subject || null;
  const data = await weeklyVolumeByMuscle(volDays, null, rows);

  const reload = () => renderVolumePane(host, top, opts);
  setChildren(top,
    el('div', { class: 'control-row' },
      el('div', { class: 'chips tight' }, VOL_WINDOWS.map(([days, label]) =>
        el('button', {
          class: 'chip', 'aria-pressed': String(days === volDays), text: label,
          onClick: () => { volDays = days; volOpen = null; reload(); },
        }))),
    ),
  );

  if (!data) {
    setChildren(host, who
      ? emptyState('Nothing in this window',
        `${who} has not published a session in the last ${volDays} days. Try a longer window.`)
      : emptyState(
        'Nothing recorded in this window',
        // ⚠️ RE-SHAPED, NOT HIDDEN. `emptyState()` takes a plain string, so
        // there is nowhere to hang a ? — and what this says is the UNIT and
        // what it counts, which Rule 9 keeps on the screen anyway.
        'Weekly sets per muscle, counted from the workouts you log. It fills in as you train. '
        + 'Every set counts — the ones you got through a compound at half.',
        el('a', { class: 'btn primary', href: '#/start', text: 'Record a workout' }),
      ));
    return;
  }

  /* 🚨 A RATE EVEN UNDER A FORTNIGHT — changed 2026-09-06, and this is the note
   * to read before putting the refusal back.
   *
   * This screen used to check `data.enough` (a two-week span) and, below it,
   * print raw window totals under a ⚠️ line saying a weekly figure over a few
   * days is noise. The noise is real. The refusal was still the wrong answer:
   * `m.weeklySets` is computed either way, and "17 sets" is comparable to
   * nothing on the screen it is printed on — not to the 4 / 10 / 20 bands beside
   * it, not to the same muscle at a different window length, not to any figure
   * in the literature. It replaced an imprecise answer with an unanswerable one.
   * docs/direction.md §3.1, Tim: *"something is always better than nothing"*.
   *
   * ⚠️ THE HALF HE KEPT IS *"have a way to be upfront about it"*, and that is
   * two sentences below: the intro names the sessions and the span the rate was
   * measured over, and a short window carries a caveat saying what that does to
   * it. A labelled best-effort rate is not a measurement dressed as a settled
   * one (Rule 5) — what it must never do is print silently.
   *
   * 🚨 AND IT IS ONE UNIT FOR THE WHOLE SCREEN, which is why the `perWeek` flag
   * was deleted rather than pinned to true. The rows, the panel under the
   * figure, the contributor list inside it, the body map's colours and the
   * legend's bands all have to be the same quantity or the parts stop adding up
   * to the whole — the fault `volDetail()`'s header describes. A flag threaded
   * through five call sites is five chances to get that wrong; no flag is none. */
  const biggest = Math.max(...data.muscles.map((m) => m.weeklySets), 0);
  // ⚠️ ONE SCALE FOR EVERY ROW, and it is the whole reason the bars are worth
  // drawing: the comparison people actually make on this screen is between their
  // own muscles. Rounded up to a multiple of 4 so the minimum-dose tick lands on
  // a sensible fraction of the track, and floored at 20 so a light week does not
  // draw four sets as a full-width bar.
  const scale = Math.max(20, Math.ceil(biggest / 4) * 4);

  /* ⚠️ THE LIST IS BUILT ONCE AND OPENING A ROW ONLY MOVES CLASSES. Rebuilding
   * it on every tap was the first version and it cannot animate: the replacement
   * node arrives already open, with nothing to move from. It also threw away the
   * bar-growth animation on every tap, which then read as the numbers changing
   * when nothing had. */
  const list = el('div', { class: 'vol-list' });

  /* 🚨 ONE SELECTION, THREE PLACES. Tapping a muscle on the figure and tapping
   * its row are the same act, and they had better not be able to disagree —
   * the figure's outline, the panel under it and the open row all read
   * `volOpen`. The first version had the figure keep its own `selected` (which
   * is what views-muscles.js does, where there is no list to keep in step), and
   * a muscle could be outlined on the body while a different row sat open. */
  const select = (muscle) => {
    volOpen = volOpen === muscle ? null : muscle;
    for (const b of list.querySelectorAll('.vol-row')) {
      b.setAttribute('aria-pressed', String(b.dataset.muscle === volOpen));
    }
    setSelected(figure, volOpen);
    drawPicked();
  };

  setChildren(list, ...data.muscles.map((m) => volRow(
    m, scale, volOpen === m.muscle, () => select(m.muscle),
  )));

  const figure = volumeFigure(data, volOpen, select);
  const picked = el('div', { class: 'vol-picked' });
  // ⚠️ The panel is inside the collapsing wrapper the motion pass built, so
  // picking a muscle SLIDES the list down rather than jolting it. Same class,
  // same animation, one level up from where it started this morning.
  const pickedWrap = el('div', { class: 'vol-detail-wrap' + (volOpen ? ' is-open' : '') }, picked);
  const hint = el('div', { class: 'field-help vol-hint' });
  const legendHost = el('div', {});

  function drawPicked() {
    const m = volOpen ? data.muscles.find((x) => x.muscle === volOpen) : null;
    setChildren(legendHost, volumeLegend(m ? volumeShade(m.weeklySets).key : null));
    pickedWrap.classList.toggle('is-open', Boolean(m));
    hint.hidden = Boolean(m);
    hint.textContent = 'Tap a muscle, or a row below it, to see the exercises behind its number.';
    if (!m) return;
    setChildren(picked,
      el('div', { class: 'vol-picked-head' },
        el('span', { class: 'vol-picked-name', text: m.muscle }),
        el('span', { class: 'vol-picked-num' },
          fmtSets(m.weeklySets),
          el('span', { class: 'vol-unit', text: ' / wk' }),
        ),
      ),
      volDetail(m, data.weeks),
    );
  }
  drawPicked();

  const span = `${data.spanDays} ${data.spanDays === 1 ? 'day' : 'days'}`;
  const sess = `${data.sessions} ${data.sessions === 1 ? 'session' : 'sessions'}`;

  setChildren(host,
    el('div', { class: 'vol-pane' },
      el('div', { class: 'vol-intro' },
        /* 🚨 THE SPAN IT WAS ACTUALLY MEASURED OVER IS IN THIS SENTENCE, and
         * that is what earns the rate below it. `data.spanDays` runs from the
         * FIRST session in the window to today, not from the window's own edge
         * — so somebody nine days into training reads "over the last 9 days"
         * under a chip saying 4 weeks, which is the truth about the measurement
         * rather than the truth about the control. */
        el('div', { class: 'vol-intro-main', text:
          `${who ? `${who}: s` : 'S'}ets a week per muscle, from ${sess} over the last ${span}.` }),
        /* ⚠️ A FRIEND'S WINDOW IS NOT THEIR HISTORY, and the screen has to say
         * so. What they publish is their last sixty sessions, so a long window
         * over a busy account can be measuring a shorter stretch than it says.
         * Silence here would let this screen quietly claim to be the same
         * measurement as the one on their own phone. */
        /* ⚠️ WHAT IT IS COUNTED FROM STAYS; THE CONSEQUENCE FOR A BUSY ACCOUNT
         * GOES BEHIND THE ? (Rule 9). "Their most recent sixty sessions" is
         * what this number IS, and without it the reader thinks they are
         * looking at the same figure that friend sees on their own phone. Why a
         * long window can then measure a shorter stretch is the arithmetic. */
        who ? el('div', { class: 'help-line' },
          el('span', { class: 'field-help', text:
            `Counted from the sessions ${who} publishes — their most recent sixty.` }),
          helpDot(`If ${who} trains a lot, a long window here may reach further back than what `
            + 'they share, so it can measure a shorter stretch than the chip says.',
          { label: 'Why a long window can measure less' })) : null,
        /* ⚠️ ONE LINE ABOVE THE FIGURE, AND ONLY WHEN IT IS EARNED. The sentence
         * that used to sit here — why weekly sets is the metric — moved to the
         * notes at the bottom: every pixel above the drawing is a pixel off the
         * drawing, and it was repeating what the line above it says.
         *
         * 🚨 THIS IS THE "UPFRONT ABOUT IT" HALF OF §3.1 AND IT IS NOT OPTIONAL.
         * The rate is still shown under a fortnight — see the block above
         * `biggest` — so the caveat is what stops a nine-day window reading as a
         * settled measurement. It states the span, states that the figures are
         * recorded sets stated per week, and states the consequence in the terms
         * that actually move it: one session. It does NOT say the number is
         * wrong, because it is not; it says how much it can move. */
        /* ⚠️ "Measured over N days", NOT "N days of history". `spanDays` runs
         * from the first session INSIDE this window to today, so somebody with a
         * year of training who took three weeks off has a short span and a long
         * history — and on a friend's page the document is only their last sixty
         * sessions either way. The span is a fact about the measurement; history
         * would be a claim about the person. */
        /* ⚠️ SHORTENED, NOT DROPPED (2026-09-07). The span and "not a settled
         * rate" are WHAT the number is and stay on the screen; the arithmetic
         * behind why one session moves it is WHY and went behind the ?. */
        data.enough ? null : el('div', { class: 'help-line'},
          el('span', { class: 'field-help', text:
            `⚠️ Measured over ${span} — a best effort, not a settled rate.` }),
          helpDot(`These are the sets you really recorded over ${span}, stated per week. `
            + 'A rate settles over a fortnight, so at this length one session more or less moves it '
            + 'a long way. It steadies as the window fills.',
          { label: 'Why this is not a settled rate' })),
      ),

      el('div', { class: 'vol-figure', style: `--body-ar:${BODY_ASPECT.toFixed(4)}` }, figure),
      legendHost,
      hint,
      pickedWrap,

      list,

      /* 🚨 FIVE PARAGRAPHS BECAME ONE LINE AND A "?" — 2026-09-07, Tim's ask.
       *
       * ⚠️ NOT ONE WORD OF THE CAVEATS WAS DELETED; they moved. What was on
       * screen was five stacked `.field-help` blocks totalling ~150 words under
       * a body map — the reader's own numbers were above a wall of prose that
       * explained them, and the prose was the same every visit while the
       * numbers were the thing that changed.
       *
       * The line that stays is the four facts a reader needs to READ the
       * screen: the unit, that warm-ups are in, that indirect work is halved,
       * and where the tick is. Everything behind the ? is WHY — why the bands
       * do not move with the window, why there is no target line, why warm-ups
       * cannot be separated, why Core is understated. That is the split the
       * helpDot header describes, and this screen is what it was written for. */
      el('div', { class: 'vol-notes' },
        el('div', { class: 'help-line'},
          el('span', { class: 'field-help', text:
            'Sets a week per muscle. Warm-ups counted, indirect work counts half, '
            + `the tick is 4 a week.` }),
          helpDot(el('div', {},
            el('p', {}, el('b', { text: 'Always a rate. ' }),
              'Sets a week, so the bands are the same at every window — 12 weeks measures longer, '
              + 'it does not ask more of you.'),
            el('p', {}, el('b', { text: 'No target line. ' }),
              `The tick at 4 is where change starts being detectable. Above it the `
              + 'labels say what another set buys, not what you ought to do.'),
            el('p', {}, el('b', { text: 'Warm-ups. ' }),
              'The app cannot tell a warm-up from a back-off set, and dropping the light ones would '
              + 'drop real work too — so these run a little high if you log warm-ups.'),
            el('p', {}, el('b', { text: 'Half a set. ' }), INDIRECT_NOTE_WEEKLY),
            el('p', {}, el('b', { text: 'Core. ' }),
              'Understated for everyone — squats, deadlifts, carries and overhead work all train it '
              + 'and none of them log a set against it.'),
            data.clamped
              ? el('p', {}, el('b', { text: 'One big session. ' }),
                  `A day went past ${SESSION_CEILING} sets on one muscle. Nothing above that has `
                  + 'been measured, so the rest of that day was not counted.')
              : null,
          ), { label: 'How these numbers are counted', title: 'How this is counted' }),
        ),
      ),
    ));
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

/* ── THE BASICS (2026-08-30, Tim's ask) ───────────────────────────────────────
 *
 * "collect information to educate users on the basics of weightlifting and some
 * of the stuff science has confidently determined… before we put anything on
 * here, we need to be confident."
 *
 * `js/research-topics.js` holds the content, the sources and the rules it was
 * written under. This function only draws it — which is the point of the split:
 * the claims are testable without a DOM, and the word budgets are asserted in
 * `tests/data-layer.test.mjs`.
 *
 * ⚠️ COLLAPSED BY DEFAULT, AND THAT IS THE READABILITY DECISION. Eleven topics
 * open at once is a wall, and Tim's second constraint was that this stays
 * readable. A `<details>` is also the one disclosure widget that is keyboard
 * and screen-reader native without a line of code — the app has already shipped
 * a hand-rolled control that dropped off the accessibility tree once
 * (the set row, 2026-08-25).
 *
 * ⚠️ THE CONFIDENCE PILL CARRIES NO COLOUR. It says the word — "Strong
 * evidence" — and a `limited` one is drawn with a DASHED border, so the
 * strongest and the weakest claims on the page are separable in greyscale, in
 * a screenshot and to a colour-blind reader. Design Rule 5's general form, and
 * the specific fault the 2026-08-25 audit found when level names were painted
 * in the level's own colour (2.83:1 on a light ground).
 */
function confidencePill(level) {
  const c = CONFIDENCE[level] || CONFIDENCE.limited;
  return el('span', {
    class: `rt-conf rt-conf-${level}`,
    title: c.note,
  }, c.label);
}

function sourceLine(topic) {
  const srcs = topicSources(topic);
  return el('div', { class: 'rt-src' },
    el('b', { text: srcs.length === 1 ? 'Source: ' : 'Sources: ' }),
    ...srcs.flatMap((s, i) => [
      i ? ' · ' : null,
      // A source with no verified link is named rather than linked — a wrong
      // link on screen is worse than no link.
      s.url
        ? el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label })
        : el('span', { text: s.label }),
      s.n ? el('span', { class: 'rt-src-n', text: ` (${s.n})` }) : null,
    ]),
  );
}

function topicBlock(topic) {
  return el('details', { class: 'rt-topic', dataset: { topic: topic.id } },
    el('summary', { class: 'rt-summary' },
      el('span', { class: 'rt-q', text: topic.question }),
      confidencePill(topic.confidence),
    ),
    el('div', { class: 'rt-body' },
      el('div', { class: 'rt-lead', text: topic.lead }),
      el('p', { class: 'rt-answer', text: topic.answer }),
      el('ul', { class: 'rt-points' },
        ...topic.points.map((p) => el('li', {},
          p.myth ? el('b', { class: 'rt-myth', text: `${p.myth} ` }) : null,
          p.text)),
      ),
      el('p', { class: 'rt-caveat' },
        el('b', { text: 'The limit. ' }), topic.caveat),
      sourceLine(topic),
    ),
  );
}

function basicsSection() {
  return el('div', { class: 'rt-section' },
    el('h2', { class: 'research-title', text: 'The basics, and how sure anyone is' }),
    /* ⚠️ THE FRAMING SHRANK; THE TEACHING DID NOT — Tim, 2026-09-07: *"the
     * research section is extreamly wordy and while I do think we need to make
     * the descriptions in that section more clear, we should allow it to
     * describe that section sufficiently."* So this heading blurb is one line
     * and a ?, and the topics below it are untouched: their length is the
     * feature, and `tests/data-layer.test.mjs` already caps it at 45 words an
     * answer and 260 a topic. */
    el('div', { class: 'help-line research-sub' },
      el('span', { class: 'field-help', text:
        'What the research actually supports — with how sure anyone is.' }),
      helpDot('Every topic says how much to believe it and links what it came from. Every one '
        + 'also names its own weak spot: a finding with nothing to admit usually has not been '
        + 'checked.', { label: 'How to read these' })),
    el('div', { class: 'rt-list' }, ...TOPICS.map(topicBlock)),
  );
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
      // The basics lead, because they answer questions somebody arrived with.
      // The age chart is the exhibit underneath them.
      basicsSection(),
      el('div', { class: 'rt-rule' }),
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
        /* 🔄 BEHIND A "?" ON 2026-09-09, and it is the ONE paragraph on this tab
         * that qualifies. Tim carved this section out by name when he opened the
         * wordiness topic — *"the research section is extreamly wordy and while I
         * do think we need to make the descriptions in that section more clear,
         * we should allow it to describe that section sufficiently"* — so the
         * three paragraphs above it stay whole: they say what THIS chart is,
         * what it cannot cover, and what the dashed line on it assumes. That is
         * the tab describing itself, which is its entire job.
         *
         * 🚨 THIS ONE IS NOT ABOUT THIS CHART. It lists where the ratings, the
         * standards and the estimated 1RM on OTHER screens come from — the
         * 2026-09-07 finding exactly: the copy is not padded, it is mis-placed.
         * A reader looking at an age chart is not asking it. */
        el('div', { class: 'help-line' },
          el('div', { class: 'section-label', text: 'Where the app’s other numbers come from' }),
          helpDot(
            'Strength standards and lift-to-lift ratios: Strength Level’s published standards, '
            + 'derived at a fixed body weight. Estimated one-rep max: Marzagão’s 2026 formula. '
            + 'Muscle ratings: your recorded sets, converted through those ratios — every screen '
            + 'that shows a rating names the set it came from.',
            { label: 'Where the app’s other numbers come from', title: 'Sources' }))),
    ));

  drawChart();
  // Redraw once laid out — clientWidth is 0 until the pane is in the document.
  requestAnimationFrame(drawChart);
}
