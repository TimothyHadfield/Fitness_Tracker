/**
 * THE YEAR GRID — the calendar's years view.
 *
 * No dependencies: `node tests/year-grid.test.mjs`.
 *
 * What is worth asserting here is not "it returns 53 columns". It is the two
 * things that would be invisible on screen if they broke:
 *
 *   1. EVERY DAY OF THE YEAR APPEARS EXACTLY ONCE. A grid that silently drops
 *      December 31st of a leap year still looks like a perfectly good grid —
 *      there is no gap to see, because the missing square is at the end of a
 *      ragged column that is supposed to be ragged.
 *   2. THE SQUARE MATCHES THE DATE. An off-by-one in the weekday maths shifts
 *      the whole year up or down one row, and the picture still looks entirely
 *      plausible. Nobody can check a 6px square by eye, so it is checked here.
 */

import { yearsToShow, buildYear, daysLabel, DOW_LABELS } from '../js/year-grid.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('PASS ', msg); }
  else { fail++; console.error('FAIL ', msg); }
};

const none = () => false;

/* ---------- every day, exactly once ---------- */

// 2024 is a leap year opening on a Monday; 2023 opens on a Sunday, which is the
// worst case for a Monday-start week (one day alone in the first column).
for (const year of [2021, 2022, 2023, 2024, 2025, 2026, 2028]) {
  const g = buildYear(year, none, '2026-08-22');
  const seen = g.columns.flat().filter(Boolean).map((c) => c.iso);
  const days = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;

  ok(seen.length === days, `${year}: every one of its ${days} days is drawn`);
  ok(new Set(seen).size === seen.length, `${year}: and none of them twice`);
  ok(seen[0] === `${year}-01-01` && seen[seen.length - 1] === `${year}-12-31`,
     `${year}: running from Jan 1 to Dec 31 in order`);
}

/* ---------- the square matches the date ---------- */

// Row 0 is Monday. Checked against real weekdays rather than against the
// module's own arithmetic, which would only prove it agrees with itself.
{
  const g = buildYear(2026, none, '2026-08-22');
  let wrong = 0;
  g.columns.forEach((week) => {
    week.forEach((cell, row) => {
      if (!cell) return;
      const [y, m, d] = cell.iso.split('-').map(Number);
      const realRow = (new Date(y, m - 1, d).getDay() + 6) % 7;
      if (realRow !== row) wrong++;
    });
  });
  ok(wrong === 0, 'every square sits in the row its weekday actually falls on');
  ok(DOW_LABELS.length === 7 && DOW_LABELS[0] === 'M' && DOW_LABELS[6] === 'S',
     'and the gutter labels agree that the week starts on Monday');
}

// ⚠️ A COLUMN IS NEVER SHARED BY TWO WEEKS. If a column held days from two
// different weeks the picture would compress silently — this is the assertion
// that fails if the Sunday rollover is ever moved.
{
  const g = buildYear(2023, none, '2026-08-22');   // opens on a Sunday
  const bad = g.columns.filter((week) => {
    const isos = week.filter(Boolean).map((c) => c.iso);
    if (isos.length < 2) return false;
    const [y1, m1, d1] = isos[0].split('-').map(Number);
    const [y2, m2, d2] = isos[isos.length - 1].split('-').map(Number);
    return (new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000 > 6;
  });
  ok(bad.length === 0, 'no column spans more than seven days, even in a year opening on a Sunday');
  ok(g.columns[0].filter(Boolean).length === 1,
     'a year opening on a Sunday puts exactly one day in its first column');
}

/* ---------- a month label sits over its own month ---------- */

// ⚠️ This is the assertion that would have caught the worst thing this view
// shipped in draft: the month strip was laid out on `1fr` columns, which refuse
// to shrink below the width of the text in them, so the strip came out a third
// wider than the grid and "Nov" sat over the 20th of August. That was a CSS
// fault rather than an arithmetic one and only a browser could measure it — but
// the arithmetic is half the contract and it can be pinned here for nothing.
for (const year of [2023, 2024, 2025, 2026]) {
  const g = buildYear(year, none, '2026-08-22');
  const columnOf = new Map();
  g.columns.forEach((week, ci) => week.forEach((cell) => { if (cell) columnOf.set(cell.iso, ci); }));

  let adrift = [];
  g.monthLabels.forEach((label, m) => {
    const first = columnOf.get(`${year}-${String(m + 1).padStart(2, '0')}-01`);
    // One column of slack, and only forward: a month opening on a Friday is
    // three days of the previous month's column, so the label belongs on the
    // next one. Never backwards, which would put it over a month that has not
    // started yet.
    if (!(label.col === first || label.col === first + 1)) adrift.push(`${label.text}@${label.col} vs ${first}`);
  });
  ok(adrift.length === 0, `${year}: every month label sits on its own month's column (${adrift.join(', ')})`);
  ok(g.monthLabels.length === 12, `${year}: and all twelve months are labelled`);
}

/* ---------- active days ---------- */

{
  const active = new Set(['2026-01-01', '2026-06-15', '2026-06-16', '2026-12-31']);
  const g = buildYear(2026, (iso) => active.has(iso), '2026-08-22');
  ok(g.activeDays === 4, 'the count is the number of days carrying anything');

  const on = g.columns.flat().filter(Boolean).filter((c) => c.active).map((c) => c.iso).sort();
  ok(JSON.stringify(on) === JSON.stringify([...active].sort()),
     'and exactly those days are the ones marked active');

  // Vacuity guard: the same year with nothing recorded must differ, or the
  // assertion above would pass over a function that marks everything.
  const empty = buildYear(2026, none, '2026-08-22');
  ok(empty.activeDays === 0, 'a year with nothing recorded marks nothing');
}

/* ---------- today ---------- */

{
  const g = buildYear(2026, none, '2026-08-22');
  const flagged = g.columns.flat().filter(Boolean).filter((c) => c.isToday);
  ok(flagged.length === 1 && flagged[0].iso === '2026-08-22',
     'exactly one square is today, and it is the day passed in');

  const other = buildYear(2025, none, '2026-08-22');
  ok(other.columns.flat().filter(Boolean).every((c) => !c.isToday),
     'and no square in any other year claims to be today');
}

/* ---------- which years ---------- */

{
  ok(JSON.stringify(yearsToShow([], '2026-08-22')) === '[2026]',
     'an empty history still shows the current year rather than nothing');

  // ⚠️ THE GAP IS THE POINT. Years with no training are drawn empty, not
  // skipped: this view exists to show the shape of a history, and a three-year
  // absence IS that shape. Skipping them would draw four years of consistency
  // over a history that had none.
  const gap = yearsToShow(['2022-04-01', '2026-01-09'], '2026-08-22');
  ok(JSON.stringify(gap) === '[2026,2025,2024,2023,2022]',
     'a three-year gap is drawn as empty years, never collapsed away');
  ok(gap[0] === 2026, 'and the newest year comes first');

  ok(JSON.stringify(yearsToShow(['2030-01-01'], '2026-08-22')) === '[2026]',
     'a date in the future does not invent years beyond today');
}

/* ---------- the label counts what is drawn ---------- */

{
  ok(daysLabel(1) === '1 day trained', 'one day is singular');
  ok(daysLabel(155) === '155 days trained', 'and the label names DAYS');
  // ⚠️ Not "workouts". One square is one day, so a day holding two sessions is
  // still one square — a header reading "155 workouts" over 150 squares is a
  // number that does not describe the thing beside it. Same class of drift as
  // the Goals matcher's missing caveat.
  ok(!/workout/i.test(daysLabel(3)), 'and never the word "workout", which would not match the squares');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
