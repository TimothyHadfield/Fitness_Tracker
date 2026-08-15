// Calendar, day detail, graphs, settings.

import { store, seriesForExercise, chartableExercises, activityByDate, todayISO } from './store.js';
import { FIELD_META, LOAD_LABEL } from './exercises.js';
import {
  el, icon, iconBtn, toast, screenShell, emptyState, confirmSheet,
  fmtSet, fmtDateLong, fmtDateShort, trimNum, fmtTime, loadBadge,
} from './ui.js';

const go = (hash) => { location.hash = hash; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* ================================================================== *
 * Calendar
 * ================================================================== */

let calCursor = null; // persists while navigating months

export async function CalendarView() {
  const activity = await activityByDate();
  const now = new Date();
  if (!calCursor) calCursor = { year: now.getFullYear(), month: now.getMonth() };

  const grid = el('div', { class: 'cal-grid' });
  const title = el('div', { class: 'cal-title' });

  function render() {
    const { year, month } = calCursor;
    title.textContent = `${MONTHS[month]} ${year}`;

    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const today = todayISO();

    grid.replaceChildren(
      ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => el('div', { class: 'cal-dow', text: d })),
      ...Array.from({ length: first }, () => el('div', { class: 'cal-cell blank' })),
      ...Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const rec = activity.get(iso);

        const cls = ['cal-cell'];
        if (iso === today) cls.push('today');
        if (rec && rec.sessions.length) cls.push('has-workout');
        else if (rec && rec.benchmarks.length) cls.push('has-benchmark-only');

        // Named labels rather than dots: the workout's own title, and the plain
        // word "Benchmark" for benchmarks.
        const tags = [];
        if (rec) {
          const shown = rec.sessions.slice(0, 2);
          for (const s of shown) {
            tags.push(el('span', { class: 'cal-tag w', text: s.workoutName || 'Workout', title: s.workoutName }));
          }
          if (rec.sessions.length > shown.length) {
            tags.push(el('span', { class: 'cal-tag more', text: `+${rec.sessions.length - shown.length}` }));
          }
          if (rec.benchmarks.length) {
            tags.push(el('span', { class: 'cal-tag b', text: 'Benchmark' }));
          }
        }

        const label = rec
          ? `${MONTHS[month]} ${day}: ${rec.sessions.map((s) => s.workoutName).join(', ')}${rec.benchmarks.length ? (rec.sessions.length ? ', ' : '') + 'benchmark' : ''}`
          : `${MONTHS[month]} ${day}, nothing recorded`;

        return el('button', { class: cls.join(' '), onClick: () => go('#/day/' + iso), 'aria-label': label },
          el('span', { class: 'cal-day', text: String(day) }),
          el('span', { class: 'cal-tags' }, tags),
        );
      }),
    );
  }

  function shift(n) {
    let m = calCursor.month + n, y = calCursor.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    calCursor = { year: y, month: m };
    render();
  }

  render();

  const totalDays = activity.size;

  return screenShell({
    title: 'Calendar',
    sub: totalDays ? `${totalDays} day${totalDays === 1 ? '' : 's'} recorded` : 'Nothing recorded yet',
    scroll: [
      el('div', { class: 'card' },
        el('div', { class: 'cal-head' },
          iconBtn('left', 'Previous month', () => shift(-1)),
          title,
          iconBtn('right', 'Next month', () => shift(1)),
        ),
        grid,
        el('div', { class: 'legend' },
          el('span', {}, el('i', { class: 'w' }), 'Workout'),
          el('span', {}, el('i', { class: 'b' }), 'Benchmark'),
        ),
      ),
      el('div', { style: 'font-size:13px;color:var(--ink-faint);text-align:center' },
        totalDays ? 'Tap any day to see everything you did.'
                  : 'Finish a workout or log a benchmark and the day fills in here.'),
    ],
  });
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
      el('div', { style: 'display:flex;align-items:center;gap:10px' },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { style: 'font-size:18px;font-weight:680;letter-spacing:-0.01em', text: s.workoutName || 'Workout' }),
          el('div', { class: 'row-sub', text: `${s.entries.length} exercise${s.entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}` }),
        ),
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

  if (rec.benchmarks.length) {
    scroll.push(el('div', { class: 'section-label', text: 'Benchmarks' }));
    for (const b of rec.benchmarks) {
      const ex = exMap.get(b.exerciseId);
      const fields = ex ? ex.fields : Object.keys(b.values || {});
      const loadType = ex ? ex.loadType : null;
      scroll.push(el('div', { class: 'card' },
        el('div', { style: 'display:flex;align-items:center;gap:10px' },
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

let graphChoice = { exerciseId: null, field: null };

export async function GraphView() {
  const options = await chartableExercises(2);

  if (!options.length) {
    return screenShell({
      title: 'Graphs',
      scroll: emptyState(
        'Not enough data yet',
        'A graph needs at least two recorded days for the same exercise. Record a workout or benchmark twice and it will appear here.',
        el('button', { class: 'btn primary', text: 'Record a benchmark', onClick: () => go('#/benchmark') }),
      ),
    });
  }

  if (!graphChoice.exerciseId || !options.find((o) => o.id === graphChoice.exerciseId)) {
    graphChoice = { exerciseId: options[0].id, field: options[0].fields[0] };
  }

  const chartHost = el('div', { class: 'card' });

  const select = el('select', {
    class: 'input',
    onChange: (e) => {
      graphChoice.exerciseId = e.target.value;
      graphChoice.field = options.find((o) => o.id === e.target.value).fields[0];
      draw();
    },
  }, options.map((o) => el('option', { value: o.id, text: o.name, selected: o.id === graphChoice.exerciseId })));

  const fieldChips = el('div', { class: 'chips' });

  async function draw() {
    const opt = options.find((o) => o.id === graphChoice.exerciseId);
    if (!opt.fields.includes(graphChoice.field)) graphChoice.field = opt.fields[0];

    fieldChips.replaceChildren(...opt.fields.map((f) =>
      el('button', {
        class: 'chip',
        'aria-pressed': String(f === graphChoice.field),
        text: FIELD_META[f].label,
        onClick: () => { graphChoice.field = f; draw(); },
      })));

    const points = await seriesForExercise(graphChoice.exerciseId, graphChoice.field);

    if (points.length < 2) {
      chartHost.replaceChildren(emptyState('Only one data point',
        'Record this exercise on another day to see a line.'));
      return;
    }

    chartHost.replaceChildren(
      graphChoice.field === 'weight' && opt.loadType
        ? el('div', { class: 'chart-caption' }, loadBadge(opt.loadType),
            el('span', { text: `Weight shown is ${LOAD_LABEL[opt.loadType]}` }))
        : null,
      el('div', { class: 'chart-wrap' }, lineChart(points, graphChoice.field)),
      summaryStats(points, graphChoice.field),
    );
  }

  await draw();

  return screenShell({
    title: 'Graphs',
    sub: `${options.length} exercise${options.length === 1 ? '' : 's'} with enough data`,
    top: [
      el('div', { class: 'field' }, el('label', { text: 'Exercise' }), select),
      fieldChips,
    ],
    scroll: chartHost,
  });
}

/* ---- SVG line chart ---- */

function lineChart(points, field) {
  const W = 360, H = 220, padL = 42, padR = 14, padT = 16, padB = 30;
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
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${FIELD_META[field].label} over time`);

  const add = (tag, attrs, cls) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (cls) n.setAttribute('class', cls);
    svg.append(n);
    return n;
  };

  for (let i = 0; i <= 3; i++) {
    const v = vMin + ((vMax - vMin) * i) / 3;
    const yy = y(v);
    add('line', { x1: padL, x2: W - padR, y1: yy, y2: yy }, 'grid-line');
    const t = add('text', { x: padL - 7, y: yy + 3.5, 'text-anchor': 'end' }, 'axis-text');
    t.textContent = field === 'time' ? fmtTime(v) : trimNum(Math.round(v * 10) / 10);
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(ts[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  add('path', { d: `${d} L${x(ts[ts.length - 1]).toFixed(1)},${padT + ih} L${x(ts[0]).toFixed(1)},${padT + ih} Z` }, 'series-area');
  add('path', { d }, 'series-line');

  points.forEach((p, i) => {
    const last = i === points.length - 1;
    add('circle', { cx: x(ts[i]).toFixed(1), cy: y(p.value).toFixed(1), r: last ? 5 : 3.6 },
      last ? 'pt pt-last' : 'pt' + (p.source === 'benchmark' ? ' bench' : ''));
  });

  const labelIdx = points.length > 3
    ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
    : [0, points.length - 1];
  [...new Set(labelIdx)].forEach((i) => {
    const t = add('text', {
      x: x(ts[i]).toFixed(1),
      y: H - 9,
      'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
    }, 'axis-text');
    t.textContent = fmtDateShort(points[i].date);
  });

  return svg;
}

/* ---- summary beside the graph ---- */

function summaryStats(points, field) {
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const diff = last - first;
  const pct = first === 0 ? null : (diff / Math.abs(first)) * 100;

  // Direction is only good/bad when bigger is clearly better. Time is ambiguous
  // (a faster mile is better, a longer plank is better) so it stays neutral.
  const judged = field !== 'time';
  const cls = !judged || diff === 0 ? '' : diff > 0 ? ' up' : ' down';
  const sign = diff > 0 ? '+' : '';
  const fmt = (v) => (field === 'time' ? fmtTime(v) : trimNum(Math.round(v * 100) / 100));

  return el('div', { class: 'summary-grid' },
    stat('Start', fmt(first), '', fmtDateShort(points[0].date)),
    stat('Now', fmt(last), '', fmtDateShort(points[points.length - 1].date)),
    stat('Change', (diff > 0 ? '+' : diff < 0 ? '−' : '') + fmt(Math.abs(diff)), cls),
    stat('Change %', pct === null ? '—' : `${sign}${pct.toFixed(1)}%`, cls),
    el('div', { class: 'stat wide' },
      el('div', { class: 'stat-label', text: 'Records' }),
      el('div', { style: 'font-size:14px;color:var(--ink-soft)', text: `${points.length} days recorded · ${FIELD_META[field].label.toLowerCase()} shown` }),
    ),
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

export async function SettingsView() {
  const settings = await store.getSettings();

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

      el('div', { class: 'section-label', text: 'Your data' }),
      el('div', { class: 'card' },
        el('div', { class: 'field-help' },
          'Everything is stored on this device. Download a backup regularly — and always before clearing your browser data.'),
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
        'Fitness Tracker · data stored locally in this browser'),
    ],
  });
}
