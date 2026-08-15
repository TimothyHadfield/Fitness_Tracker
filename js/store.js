// Data layer.
//
// Everything the app reads/writes goes through `store`. The API is async from day one so a
// remote backend can replace the local one without touching any view code.
//
// Current backend: LocalBackend (browser localStorage).
// To switch to Firebase: fill in js/firebase-config.js and set BACKEND = 'firebase' below.
// See docs/firebase-setup.md.

import { BUILT_IN_EXERCISES } from './exercises.js';

const BACKEND = 'local'; // 'local' | 'firebase'
const NS = 'ftrack:v1:';

const COLLECTIONS = ['customExercises', 'workouts', 'sessions', 'benchmarks', 'settings'];

/* ------------------------------------------------------------------ *
 * Local backend
 * ------------------------------------------------------------------ */

const LocalBackend = {
  async read(collection) {
    try {
      const raw = localStorage.getItem(NS + collection);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to read ' + collection, err);
      return [];
    }
  },

  async write(collection, rows) {
    try {
      localStorage.setItem(NS + collection, JSON.stringify(rows));
      return true;
    } catch (err) {
      console.error('Failed to write ' + collection, err);
      throw new Error('Could not save. Your browser storage may be full.');
    }
  },
};

/* ------------------------------------------------------------------ *
 * Firebase backend — loaded lazily, only when switched on
 * ------------------------------------------------------------------ */

const RemoteBackend = {
  async load() {
    if (this._impl) return this._impl;
    const { IS_CONFIGURED } = await import('./firebase-config.js');
    if (!IS_CONFIGURED) {
      throw new Error('Firebase is not configured yet. See docs/firebase-setup.md');
    }
    const { FirebaseBackend } = await import('./firebase-backend.js');
    this._impl = FirebaseBackend;
    return this._impl;
  },
  async read(collection) { return (await this.load()).read(collection); },
  async write(collection, rows) { return (await this.load()).write(collection, rows); },
};

const backend = BACKEND === 'firebase' ? RemoteBackend : LocalBackend;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

export function uid(prefix = 'id') {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function upsert(rows, row) {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i === -1) rows.push(row);
  else rows[i] = row;
  return rows;
}

export const DEFAULT_SETS = 3;

// Workouts used to be a bare list of exercise ids. They now carry a planned set
// count and notes per exercise, so older saved workouts are upgraded on read.
export function normalizeWorkout(w) {
  if (!w) return w;
  if (Array.isArray(w.exercises) && w.exercises.length) {
    return {
      ...w,
      exercises: w.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: Number(e.sets) > 0 ? Number(e.sets) : DEFAULT_SETS,
        notes: e.notes || '',
      })),
    };
  }
  const ids = Array.isArray(w.exerciseIds) ? w.exerciseIds : [];
  return {
    ...w,
    exercises: ids.map((id) => ({ exerciseId: id, sets: DEFAULT_SETS, notes: '' })),
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const store = {
  /* --- exercises --- */

  async getExercises() {
    const custom = await backend.read('customExercises');
    return [...BUILT_IN_EXERCISES, ...custom];
  },

  async getExerciseMap() {
    const all = await this.getExercises();
    return new Map(all.map((e) => [e.id, e]));
  },

  async addCustomExercise(ex) {
    const rows = await backend.read('customExercises');
    rows.push(ex);
    await backend.write('customExercises', rows);
    return ex;
  },

  async deleteCustomExercise(id) {
    const rows = await backend.read('customExercises');
    await backend.write('customExercises', rows.filter((r) => r.id !== id));
  },

  /* --- workout templates --- */

  async getWorkouts() {
    const rows = await backend.read('workouts');
    return rows.map(normalizeWorkout).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getWorkout(id) {
    const rows = await backend.read('workouts');
    const row = rows.find((r) => r.id === id);
    return row ? normalizeWorkout(row) : null;
  },

  async saveWorkout(workout) {
    const rows = await backend.read('workouts');
    const row = { ...normalizeWorkout(workout), updatedAt: new Date().toISOString() };
    delete row.exerciseIds; // superseded by `exercises`
    if (!row.id) row.id = uid('w');
    if (!row.createdAt) row.createdAt = row.updatedAt;
    await backend.write('workouts', upsert(rows, row));
    return row;
  },

  async deleteWorkout(id) {
    const rows = await backend.read('workouts');
    await backend.write('workouts', rows.filter((r) => r.id !== id));
  },

  /* --- completed sessions --- */

  async getSessions() {
    const rows = await backend.read('sessions');
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async getSession(id) {
    const rows = await backend.read('sessions');
    return rows.find((r) => r.id === id) || null;
  },

  async saveSession(session) {
    const rows = await backend.read('sessions');
    const row = { ...session };
    if (!row.id) row.id = uid('s');
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    await backend.write('sessions', upsert(rows, row));
    return row;
  },

  async deleteSession(id) {
    const rows = await backend.read('sessions');
    await backend.write('sessions', rows.filter((r) => r.id !== id));
  },

  /* --- benchmarks --- */

  async getBenchmarks() {
    const rows = await backend.read('benchmarks');
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async saveBenchmark(mark) {
    const rows = await backend.read('benchmarks');
    const row = { ...mark };
    if (!row.id) row.id = uid('b');
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    await backend.write('benchmarks', upsert(rows, row));
    return row;
  },

  async deleteBenchmark(id) {
    const rows = await backend.read('benchmarks');
    await backend.write('benchmarks', rows.filter((r) => r.id !== id));
  },

  /* --- prefill: what did they do last time for this exercise? --- */

  // Looks first within the same workout template, then falls back to any session.
  async lastSetsFor(workoutId, exerciseId) {
    const sessions = await this.getSessions(); // newest first
    const scan = (filterFn) => {
      for (const s of sessions) {
        if (!filterFn(s)) continue;
        const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
        if (entry && entry.sets && entry.sets.length) return entry.sets;
      }
      return null;
    };
    return scan((s) => s.workoutId === workoutId) || scan(() => true);
  },

  /* --- settings --- */

  async getSettings() {
    const rows = await backend.read('settings');
    return rows[0] || { id: 'settings', units: 'lbs', theme: 'dark' };
  },

  async saveSettings(patch) {
    const current = await this.getSettings();
    const next = { ...current, ...patch, id: 'settings' };
    await backend.write('settings', [next]);
    return next;
  },

  /* --- data portability (P6: permanence) --- */

  async exportAll() {
    const out = { exportedAt: new Date().toISOString(), version: 1 };
    for (const c of COLLECTIONS) out[c] = await backend.read(c);
    return out;
  },

  async importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('That file is not a valid backup.');
    for (const c of COLLECTIONS) {
      if (Array.isArray(data[c])) await backend.write(c, data[c]);
    }
  },

  async clearAll() {
    for (const c of COLLECTIONS) await backend.write(c, []);
  },
};

/* ------------------------------------------------------------------ *
 * Derived data used by the graph + calendar
 * ------------------------------------------------------------------ */

// Flattens sessions and benchmarks into one time series per exercise.
// Session value for a given field = the best set that day (max, except time-only which uses max too).
export async function seriesForExercise(exerciseId, field) {
  const [sessions, benchmarks] = await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const points = [];

  for (const s of sessions) {
    const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    const vals = (entry.sets || [])
      .map((set) => set[field])
      .filter((v) => typeof v === 'number' && !Number.isNaN(v));
    if (!vals.length) continue;
    points.push({ date: s.date, value: Math.max(...vals), source: 'workout', label: s.workoutName });
  }

  for (const b of benchmarks) {
    if (b.exerciseId !== exerciseId) continue;
    const v = b.values ? b.values[field] : undefined;
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    points.push({ date: b.date, value: v, source: 'benchmark', label: 'Benchmark' });
  }

  // one point per day — keep the best
  const byDate = new Map();
  for (const p of points) {
    const prev = byDate.get(p.date);
    if (!prev || p.value > prev.value) byDate.set(p.date, p);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Every exercise that has at least `min` recorded data points, per field.
export async function chartableExercises(min = 2) {
  const [sessions, benchmarks, exMap] = await Promise.all([
    store.getSessions(),
    store.getBenchmarks(),
    store.getExerciseMap(),
  ]);

  const counts = new Map(); // exerciseId -> { field -> Set(dates) }
  const bump = (exId, field, date) => {
    if (!counts.has(exId)) counts.set(exId, {});
    const rec = counts.get(exId);
    if (!rec[field]) rec[field] = new Set();
    rec[field].add(date);
  };

  for (const s of sessions) {
    for (const e of s.entries || []) {
      for (const set of e.sets || []) {
        for (const f of ['weight', 'reps', 'time', 'distance']) {
          if (typeof set[f] === 'number' && !Number.isNaN(set[f])) bump(e.exerciseId, f, s.date);
        }
      }
    }
  }
  for (const b of benchmarks) {
    for (const f of ['weight', 'reps', 'time', 'distance']) {
      const v = b.values ? b.values[f] : undefined;
      if (typeof v === 'number' && !Number.isNaN(v)) bump(b.exerciseId, f, b.date);
    }
  }

  const out = [];
  for (const [exId, rec] of counts) {
    const fields = Object.keys(rec).filter((f) => rec[f].size >= min);
    if (!fields.length) continue;
    const ex = exMap.get(exId);
    out.push({
      id: exId,
      name: ex ? ex.name : 'Unknown exercise',
      muscle: ex ? ex.muscle : '',
      loadType: ex ? ex.loadType : null,
      fields,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Start-vs-now comparison built from BENCHMARKS ONLY — workout sessions are
// deliberately excluded, so this answers "how has my tested best moved?" rather
// than mixing in whatever happened to get logged on a training day.
//
// Returns { fields: [...], byField: { weight: [{...}], ... } }.
export async function benchmarkComparison(minPoints = 2) {
  const [benchmarks, exMap] = await Promise.all([store.getBenchmarks(), store.getExerciseMap()]);
  const FIELDS = ['weight', 'reps', 'time', 'distance'];

  // exerciseId -> field -> [{date, value}]
  const grouped = new Map();
  for (const b of benchmarks) {
    for (const f of FIELDS) {
      const v = b.values ? b.values[f] : undefined;
      if (typeof v !== 'number' || Number.isNaN(v)) continue;
      if (!grouped.has(b.exerciseId)) grouped.set(b.exerciseId, {});
      const rec = grouped.get(b.exerciseId);
      if (!rec[f]) rec[f] = [];
      rec[f].push({ date: b.date, value: v });
    }
  }

  const byField = {};
  const incomplete = {};

  for (const f of FIELDS) {
    const rows = [];
    let pending = 0;

    for (const [exId, rec] of grouped) {
      const points = rec[f];
      if (!points) continue;

      // One entry per day; if a day has several, keep the best.
      const byDate = new Map();
      for (const p of points) {
        const prev = byDate.get(p.date);
        if (!prev || p.value > prev.value) byDate.set(p.date, p);
      }
      const ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

      if (ordered.length < minPoints) { pending++; continue; }

      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const ex = exMap.get(exId);
      rows.push({
        id: exId,
        name: ex ? ex.name : 'Unknown exercise',
        loadType: ex ? ex.loadType : null,
        start: first.value,
        startDate: first.date,
        now: last.value,
        nowDate: last.date,
        delta: last.value - first.value,
        pct: first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100,
        count: ordered.length,
      });
    }

    if (rows.length) {
      // Biggest movers first — the chart's job is to show change.
      byField[f] = rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      incomplete[f] = pending;
    }
  }

  return { fields: Object.keys(byField), byField, incomplete };
}

// Everything recorded on a given date.
export async function activityByDate() {
  const [sessions, benchmarks] = await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const map = new Map();
  const push = (date, item) => {
    if (!map.has(date)) map.set(date, { sessions: [], benchmarks: [] });
    map.get(date)[item.kind === 'session' ? 'sessions' : 'benchmarks'].push(item.data);
  };
  for (const s of sessions) push(s.date, { kind: 'session', data: s });
  for (const b of benchmarks) push(b.date, { kind: 'benchmark', data: b });
  return map;
}
