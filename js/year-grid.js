/**
 * THE YEAR GRID — a year of training as one row of tiny squares.
 *
 * Tim, 2026-08-22: *"another way to display the workout days in Calendar so each
 * day is a tiny box and is colored or not colored depending on if you worked out
 * that day. This will show years of data in one screen."*
 *
 * Pure. No DOM, no store, no clock of its own — the day the caller considers
 * "today" is passed in, which is the same shape `next-workout.js` uses and for
 * the same reason: a module that reads the clock cannot be tested at a date
 * somebody else chose.
 *
 * ⚠️ WHY THIS IS BINARY, when the month calendar beside it is not.
 * The month view paints a workout in `--accent` and a benchmark-only day in
 * `--good`, and that distinction is worth having at 40px. It is NOT carried in
 * here, and that is a measurement rather than a preference: the two tokens are
 * **ΔE 6.5 apart under protanopia in the light theme** (dataviz validator,
 * 2026-08-22), which the guidance permits only alongside a secondary encoding —
 * a label, a texture, a gap. A 6px square has room for none of them. So one
 * square means one thing, "you trained", and the Months view remains where the
 * kind of training is distinguished. A distinction nobody can see is not a
 * distinction; it is two colours.
 *
 * ⚠️ ISO DATES ARE SPLIT, NEVER PARSED. `new Date('2026-03-01')` is UTC midnight
 * and lands on the last day of February for everyone west of Greenwich —
 * progress.md §4 records this costing a real bug in `next-workout.js`. Every
 * date here is built from integers through `new Date(y, m, d)`, which is local.
 */

// Monday first. Tim's reference image labels its rows M / W / F / S, which only
// lines up on a Monday-start week — and a training week that starts on Monday is
// the one most programmes are written against.
//
// Single letters, and not for brevity's sake: the gutter they sit in is width
// taken away from the squares, and on a 393px phone "Mon" against "M" is most
// of a pixel off every one of the 53 columns.
export const DOW_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const iso = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// getDay() is Sunday-based; this is the Monday-based row index.
const rowOf = (date) => (date.getDay() + 6) % 7;

/**
 * Which years are worth drawing: every year from the earliest thing recorded to
 * the year of `today`, newest first.
 *
 * ⚠️ NO GAPS ARE SKIPPED. Somebody who trained in 2022, stopped, and came back
 * in 2026 gets 2023–2025 as empty rows rather than a jump. The empty years are
 * the honest part of the picture — this whole view exists to show the shape of
 * a training history, and a two-year gap IS that shape. Hiding them would draw
 * five years of consistency over a history that had none.
 */
export function yearsToShow(activeDates, today) {
  const thisYear = Number(today.slice(0, 4));
  let earliest = thisYear;
  for (const d of activeDates) {
    const y = Number(String(d).slice(0, 4));
    if (Number.isFinite(y) && y < earliest) earliest = y;
  }
  const out = [];
  for (let y = thisYear; y >= earliest; y--) out.push(y);
  return out;
}

/**
 * One year as columns of weeks.
 *
 * Returns { year, columns, monthLabels, activeDays, firstIso, lastIso }.
 *   columns     — [[cell|null × 7] …], one array per week column, Monday first.
 *                 A null is a slot belonging to the year either side, so the
 *                 first and last columns are ragged in exactly the way a real
 *                 calendar is.
 *   monthLabels — [{ text, col }], the column each month opens in.
 *   activeDays  — how many days carry anything at all.
 *
 * ⚠️ The column count is COMPUTED, never assumed to be 53. A leap year opening
 * on a Sunday spans 54 Monday-start columns, and hardcoding 53 would silently
 * drop its last day.
 */
export function buildYear(year, isActive, today) {
  const jan1 = new Date(year, 0, 1);
  const columns = [];
  const monthLabels = [];
  let activeDays = 0;

  // Lead the first column with nulls for whatever weekdays December owned.
  let col = new Array(7).fill(null);
  const lead = rowOf(jan1);

  const cursor = new Date(year, 0, 1);
  let seenMonth = -1;

  while (cursor.getFullYear() === year) {
    const row = rowOf(cursor);
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const key = iso(year, month, day);
    const active = Boolean(isActive(key));
    if (active) activeDays++;

    if (month !== seenMonth) {
      seenMonth = month;
      // ⚠️ A month gets a label only when it OPENS a column or near enough to
      // one. Labelling the column a month happens to start mid-way through puts
      // "Mar" over a square that is still February, which is a lie at 6px where
      // nobody can count the squares to check.
      monthLabels.push({ text: MONTH_ABBR[month], col: columns.length + (row > 3 ? 1 : 0) });
    }

    col[row] = { iso: key, day, month, active, isToday: key === today };

    // Sunday closes the column.
    if (row === 6) {
      columns.push(col);
      col = new Array(7).fill(null);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // The final partial week, if the year did not end on a Sunday.
  if (col.some(Boolean)) columns.push(col);

  return {
    year,
    columns,
    monthLabels,
    activeDays,
    lead,
    firstIso: iso(year, 0, 1),
    lastIso: iso(year, 11, 31),
  };
}

/**
 * ⚠️ THE NUMBER BESIDE A YEAR COUNTS DAYS, NOT SESSIONS, and the label says
 * "days trained" for that reason.
 *
 * The reference image reads "155 workouts". Ours cannot: this grid draws ONE
 * SQUARE PER DAY, so a day carrying two sessions is one square — and a header
 * reading "155 workouts" over 150 coloured squares is a number that does not
 * describe the thing beside it. That drift is exactly what the cross-screen
 * review caught on the Goals matcher. Count what is drawn, and name it.
 */
export function daysLabel(n) {
  return n === 1 ? '1 day trained' : `${n} days trained`;
}
