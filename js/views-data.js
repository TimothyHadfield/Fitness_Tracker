// Calendar, day detail, graphs, settings.

import {
  store, auth, seriesForExercise, chartableExercises, activityByDate, todayISO, benchmarkComparison,
  normalizedSeries, defaultTargetReps, bodyWeightSeries, SOURCE_LABEL,
} from './store.js';
import { FIELD_META, LOAD_LABEL } from './exercises.js';
import {
  clampReps, repConfidence, normalizeBlockedReason, MIN_TARGET_REPS, MAX_TARGET_REPS,
} from './e1rm.js';
import {
  setChildren, el, iconBtn, toast, screenShell, emptyState, confirmSheet, miniStepper, chevron,
  fmtSet, fmtField, fmtDateLong, fmtDateShort, trimNum, fmtTime, loadBadge,
} from './ui.js';
import { muscleGroupsPane } from './views-muscles.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };
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

      const tags = [];
      if (rec) {
        const shown = rec.sessions.slice(0, 2);
        for (const s of shown) {
          tags.push(el('span', { class: 'cal-tag w', text: s.workoutName || 'Workout', title: s.workoutName }));
        }
        if (rec.sessions.length > shown.length) {
          tags.push(el('span', { class: 'cal-tag more', text: `+${rec.sessions.length - shown.length}` }));
        }
        if (rec.benchmarks.length) tags.push(el('span', { class: 'cal-tag b', text: 'Benchmark' }));
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

export async function CalendarView() {
  const activity = await activityByDate();
  const today = todayISO();
  const months = monthRange(activity);

  // The grid is the content, so the legend rides in the header rather than
  // costing a row of its own.
  const screen = screenShell({
    profile: true,
    title: el('div', { class: 'cal-topbar' },
      el('h1', { text: 'Calendar' }),
      el('div', { class: 'legend' },
        el('span', {}, el('i', { class: 'w' }), 'Workout'),
        el('span', {}, el('i', { class: 'b' }), 'Benchmark'),
      ),
    ),
    scroll: months.map(({ year, month }) => monthBlock(year, month, activity, today)),
  });

  // Land on the current month once the screen is in the document.
  setTimeout(() => {
    const pane = screen.querySelector('.pane-scroll');
    const current = screen.querySelector('[data-current-month]');
    if (pane && current) pane.scrollTop = current.offsetTop - pane.offsetTop;
  }, 0);

  return screen;
}

/* ================================================================== *
 * Day detail
 * ================================================================== */

export async function DayView(date) {
  const [activity, exMap] = await Promise.all([activityByDate(), store.getExerciseMap()]);
  const rec = activity.get(date) || { sessions: [], benchmarks: [] };

  const scroll = [];

  if (!rec.sessions.length && !rec.benchmarks.length) {
    scroll.push(emptyState('Nothing recorded on this day',
      'Days fill in automatically when you finish a workout or log a benchmark.'));
  }

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
      ...s.entries.map((e) => {
        const ex = exMap.get(e.exerciseId);
        const fields = ex ? ex.fields : ['weight', 'reps'];
        const loadType = ex ? ex.loadType : null;
        return el('div', { class: 'detail-ex' },
          el('div', { class: 'detail-ex-head' },
            el('span', { class: 'detail-ex-name', text: e.exerciseName }),
            loadType ? loadBadge(loadType) : null,
          ),
          el('div', { class: 'detail-sets' },
            ...e.sets.map((set, i) =>
              el('div', { class: 'detail-set' },
                el('b', { text: `Set ${i + 1}` }),
                el('span', { text: fmtSet(set, fields, loadType) }),
              )),
          ),
        );
      }),
    ));
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
let graphMode = 'trend'; // 'trend' | 'compare' | 'muscles'
let compareField = null;
// exerciseId -> rep count everything is compared at. Seeded from the most
// frequently recorded rep count, then whatever the user steps it to.
// Keyed by exercise AND source, because the two sources can have different
// habitual rep counts.
const targetReps = new Map();
// exerciseId -> 'benchmark' | 'workout'. Benchmarks win by default.
const sourceChoice = new Map();

function pickSource(opt) {
  const chosen = sourceChoice.get(opt.id);
  if (chosen && opt.usableSources.includes(chosen)) return chosen;
  return opt.usableSources.includes('benchmark') ? 'benchmark' : opt.usableSources[0];
}

export async function GraphView() {
  const [options, comparison, bwPoints] = await Promise.all([
    chartableExercises(2), benchmarkComparison(2), bodyWeightSeries(),
  ]);

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
  if (!trendOptions.length && graphMode === 'trend') graphMode = comparison.fields.length ? 'compare' : 'muscles';
  if (!comparison.fields.length && graphMode === 'compare') graphMode = trendOptions.length ? 'trend' : 'muscles';

  // The chart owns the screen. Controls are one compact row, and the mode switch
  // lives in the header instead of a redundant "Graphs" heading.
  const top = el('div', { class: 'graph-controls' });
  const host = el('div', { class: 'graph-host' });

  const modeSwitch = el('div', { class: 'segmented', role: 'tablist' },
    [['trend', 'Graph'], ['compare', 'Bar Chart'], ['muscles', 'Muscles']].map(([m, label]) =>
      el('button', {
        class: 'seg', role: 'tab', 'aria-selected': String(graphMode === m),
        // Muscles is never disabled: with no data it explains what to record,
        // which is more use than a dead tab.
        disabled: (m === 'trend' && !trendOptions.length) || (m === 'compare' && !comparison.fields.length),
        text: label,
        onClick: () => { graphMode = m; render(); },
      })),
  );

  /* ---------- trend (line, all sources) ---------- */

  async function renderTrend() {
    if (!trendOptions.length) {
      setChildren(top);
      setChildren(host, emptyState(
        'Nothing to chart yet',
        'A line needs the same thing recorded on two different days. Record a workout, a '
        + 'benchmark, or your body weight twice and it will appear here.',
        el('button', { class: 'btn primary', text: 'Record a benchmark', onClick: () => go('#/benchmark') }),
      ));
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
      setChildren(host, emptyState('Only one data point', 'Record this exercise on another day to see a line.'));
      return;
    }

    const blocked = normalizeBlockedReason(opt.exercise);
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
      setChildren(host, emptyState(
        'Nothing to compare yet',
        'This compares your first benchmark against your latest, so it needs the same exercise '
        + 'benchmarked on two different days.',
        el('button', { class: 'btn primary', text: 'Record a benchmark', onClick: () => go('#/benchmark') }),
      ));
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
    const order = ['trend', 'compare', 'muscles'];
    modeSwitch.querySelectorAll('.seg').forEach((b, i) =>
      b.setAttribute('aria-selected', String(graphMode === order[i])));
    // Muscles is the one mode with a side panel on a wide screen, so it is the
    // one mode that lays out as a row. The class carries that; the CSS decides
    // at which width it actually applies.
    host.classList.toggle('is-muscles', graphMode === 'muscles');
    if (graphMode === 'muscles') await muscleGroupsPane(host, top);
    else if (graphMode === 'compare') renderCompare();
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
  for (let i = 0; i <= steps; i++) {
    const v = vMin + ((vMax - vMin) * i) / steps;
    const yy = y(v);
    add('line', { x1: padL, x2: W - padR, y1: yy, y2: yy }, 'grid-line');
    const t = add('text', { x: padL - 7, y: yy + 3.5, 'text-anchor': 'end' }, 'axis-text');
    t.textContent = field === 'time' ? fmtTime(v) : trimNum(Math.round(v * 10) / 10);
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
  if (!configured) {
    return {
      title: 'This device only',
      sub: 'Cloud accounts not switched on',
      dataHelp: 'Everything is stored on this device. Download a backup regularly — and always before clearing your browser data.',
    };
  }
  if (state.mode === 'local') {
    return {
      title: 'Not connected',
      sub: 'Saving to this device — nothing is syncing',
      dataHelp: 'Your account could not be reached, so changes are being saved on this device. Download a backup until it reconnects.',
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

export async function SettingsView() {
  const [settings, accountState, profile] = await Promise.all([
    store.getSettings(), auth.state(), store.getProfile(),
  ]);
  const accountLine = describeAccount(accountState, auth.configured());
  // Say what is missing rather than just "Profile" — this is what gates the
  // Muscle Groups map, and a silent empty profile is why it would look broken.
  const profileLine = profile.missing.length
    ? `Add your ${profile.missing.join(' and ')} to rank your muscle groups`
    : `${profile.gender === 'female' ? 'Female' : 'Male'}`
      + (profile.age ? `, ${profile.age}` : '')
      + `, ${units.withUnit(profile.bodyWeight)}`;

  async function doExport() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `fitness-tracker-backup-${todayISO()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded');
  }

  const fileInput = el('input', {
    type: 'file', accept: 'application/json', style: 'display:none',
    onChange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await store.importAll(JSON.parse(await file.text()));
        toast('Backup restored');
        location.hash = '#/home';
      } catch (err) {
        toast(err.message || 'That file could not be read');
      }
      e.target.value = '';
    },
  });

  function setTheme(theme, e) {
    document.documentElement.setAttribute('data-theme', theme);
    store.saveSettings({ theme });
    e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    e.target.setAttribute('aria-pressed', 'true');
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

      el('div', { class: 'section-label', text: 'You' }),
      el('a', { class: 'row', href: '#/profile' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: 'Profile' }),
          el('div', { class: 'row-sub', text: profileLine }),
        ),
        el('span', { class: 'row-chev' }, chevron()),
      ),
      el('a', { class: 'row', href: '#/account' },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: accountLine.title }),
          el('div', { class: 'row-sub', text: accountLine.sub }),
        ),
        el('span', { class: 'row-chev' }, chevron()),
      ),

      el('div', { class: 'section-label', text: 'Your data' }),
      el('div', { class: 'card' },
        el('div', { class: 'field-help', text: accountLine.dataHelp }),
        el('button', { class: 'btn block', text: 'Download backup', onClick: doExport }),
        el('button', { class: 'btn ghost block', text: 'Restore from backup', onClick: () => fileInput.click() }),
        fileInput,
      ),

      el('button', {
        class: 'btn danger block',
        text: 'Delete all data',
        onClick: () => confirmSheet({
          title: 'Delete everything?',
          message: 'Every workout, record, benchmark and custom exercise will be permanently erased. Download a backup first if you are not sure.',
          confirmLabel: 'Delete everything',
          onConfirm: async () => { await store.clearAll(); toast('All data deleted'); location.hash = '#/home'; },
        }),
      }),

      el('div', { style: 'font-size:12.5px;color:var(--ink-faint);text-align:center;line-height:1.5' },
        'Fitness Tracker · ' + accountLine.sub.toLowerCase()),
    ],
  });
}
