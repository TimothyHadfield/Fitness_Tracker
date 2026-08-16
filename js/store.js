// Data layer.
//
// Everything the app reads/writes goes through `store`. The API is async from day one so a
// remote backend can replace the local one without touching any view code.
//
// Current backend: LocalBackend (browser localStorage).
// To switch to Firebase: fill in js/firebase-config.js and set BACKEND = 'firebase' below.
// See docs/firebase-setup.md.

import { BUILT_IN_EXERCISES } from './exercises.js';
import { e1rm, normalizeWeight, modalReps, canNormalize, clampReps } from './e1rm.js';
import { IS_CONFIGURED } from './firebase-config.js';

const BACKEND = 'auto'; // 'auto' | 'local' | 'firebase'
const NS = 'ftrack:v1:';

// ⚠️ Adding a collection here also requires adding it to knownCollection() in
// firestore.rules and redeploying, or every cloud write to it is denied.
const COLLECTIONS = ['customExercises', 'workouts', 'sessions', 'benchmarks', 'settings', 'bodyWeight'];

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

// 'auto' means: use the cloud the moment real keys are pasted into
// js/firebase-config.js, and stay on this device until then. Nothing else has
// to change to switch over.
const wantRemote = () => BACKEND === 'firebase' || (BACKEND === 'auto' && IS_CONFIGURED);

let activePromise = null;
let remoteImpl = null;
let remoteFailure = null;

async function active() {
  if (activePromise) return activePromise;

  activePromise = (async () => {
    if (!wantRemote()) return LocalBackend;
    try {
      const mod = await import('./firebase-backend.js');
      await mod.FirebaseBackend.ready();
      remoteImpl = mod.FirebaseBackend;
      remoteFailure = null;
      await adoptLocalData(mod);
      return remoteImpl;
    } catch (err) {
      // Losing the cloud must never stop someone logging a set mid-workout.
      // Fall back to this device and surface it in Settings instead of failing.
      console.error('Cloud backend unavailable — using this device only.', err);
      remoteFailure = err;
      return LocalBackend;
    }
  })();

  return activePromise;
}

// The day the cloud is switched on, everyone who has been logging locally would
// otherwise open the app to a brand-new empty account and conclude their history
// was destroyed. So on the FIRST successful cloud connection, if the account is
// empty and this device is not, carry the data up automatically.
//
// Deliberately narrow, because silent data movement is worth being paranoid
// about: it only runs when every cloud collection is empty, so it cannot
// overwrite anything, and a marker stops it ever running twice. Failure is
// swallowed — the manual "Upload from this device" button in Account remains,
// and a failed migration must not stop the app loading.
const ADOPTED_KEY = NS + 'adoptedIntoCloud';

async function adoptLocalData(mod) {
  try {
    if (localStorage.getItem(ADOPTED_KEY)) return;

    const localCounts = await Promise.all(COLLECTIONS.map((c) => LocalBackend.read(c)));
    const hasLocal = localCounts.some((rows, i) => COLLECTIONS[i] !== 'settings' && rows.length);
    if (!hasLocal) { localStorage.setItem(ADOPTED_KEY, 'nothing-to-adopt'); return; }

    const remote = await Promise.all(COLLECTIONS.map((c) => mod.FirebaseBackend.read(c)));
    const cloudEmpty = remote.every((rows, i) => COLLECTIONS[i] === 'settings' || !rows.length);
    if (!cloudEmpty) { localStorage.setItem(ADOPTED_KEY, 'cloud-already-had-data'); return; }

    for (let i = 0; i < COLLECTIONS.length; i++) {
      if (localCounts[i].length) await mod.FirebaseBackend.write(COLLECTIONS[i], localCounts[i]);
    }
    localStorage.setItem(ADOPTED_KEY, new Date().toISOString());
    console.info('Local data carried into your new cloud account.');
  } catch (err) {
    console.error('Could not carry local data into the cloud automatically.', err);
  }
}

const backend = {
  async read(collection) { return (await active()).read(collection); },
  async write(collection, rows) { return (await active()).write(collection, rows); },
};

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

  /* --- profile + body weight --- */

  // Body weight is stored as a DATED SERIES rather than one number on the
  // profile. It is needed as a single current value for strength standards, but
  // storing only that would throw away the trend line Tier 1 wants — and it
  // would be a migration later. One row per weigh-in costs nothing now.
  async getBodyWeights() {
    const rows = await backend.read('bodyWeight');
    return rows
      .filter((r) => r && typeof r.weight === 'number' && r.weight > 0 && r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async logBodyWeight(weight, date) {
    const w = Number(weight);
    if (!(w > 0)) throw new Error('Enter a weight.');
    const day = date || todayISO();
    const rows = await backend.read('bodyWeight');
    // One weigh-in per day; a second on the same day replaces the first rather
    // than making the trend jagged with intra-day noise.
    const existing = rows.find((r) => r.date === day);
    const row = existing
      ? { ...existing, weight: w, updatedAt: new Date().toISOString() }
      : { id: uid('bw'), date: day, weight: w, createdAt: new Date().toISOString() };
    await backend.write('bodyWeight', upsert(rows, row));
    return row;
  },

  async deleteBodyWeight(id) {
    const rows = await backend.read('bodyWeight');
    await backend.write('bodyWeight', rows.filter((r) => r.id !== id));
  },

  async latestBodyWeight() {
    const rows = await this.getBodyWeights();
    return rows.length ? rows[rows.length - 1] : null;
  },

  // Everything the strength map needs about the person, in one call.
  async getProfile() {
    const [settings, latest] = await Promise.all([this.getSettings(), this.latestBodyWeight()]);
    return {
      gender: settings.gender || null,          // 'male' | 'female' | null
      birthYear: settings.birthYear || null,
      age: ageFromBirthYear(settings.birthYear),
      bodyWeight: latest ? latest.weight : null,
      bodyWeightDate: latest ? latest.date : null,
      units: settings.units || 'lbs',
      // What the strength map is still waiting on. Gender and body weight are
      // required; age only changes which population you are compared against.
      missing: [
        !settings.gender && 'gender',
        !latest && 'body weight',
      ].filter(Boolean),
    };
  },

  async saveProfile({ gender, birthYear }) {
    const patch = {};
    if (gender !== undefined) patch.gender = gender || null;
    if (birthYear !== undefined) {
      const y = Number(birthYear);
      patch.birthYear = Number.isFinite(y) && y >= 1900 && y <= new Date().getFullYear()
        ? Math.round(y)
        : null;
    }
    return this.saveSettings(patch);
  },

  async clearAll() {
    for (const c of COLLECTIONS) await backend.write(c, []);
  },
};

// Birth year is stored, never age. Age would silently go stale — someone who
// entered 34 stays 34 forever and quietly drifts into the wrong comparison band.
export function ageFromBirthYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900) return null;
  const age = new Date().getFullYear() - y;
  return age >= 5 && age <= 120 ? age : null;
}

/* ------------------------------------------------------------------ *
 * Accounts
 *
 * A thin facade so views never import the Firebase module directly. Every
 * method is safe to call when the cloud is off — it just reports "local".
 * ------------------------------------------------------------------ */

function requireRemote() {
  if (!remoteImpl) {
    throw new Error(remoteFailure
      ? 'Not connected to your account right now. Check your connection and try again.'
      : 'Cloud accounts are not switched on yet.');
  }
  return remoteImpl;
}

export const auth = {
  // Is the cloud even meant to be on? False until real keys are pasted in.
  configured: () => wantRemote(),

  // Where the data actually lives right now, after any fallback.
  async state() {
    const impl = await active();
    if (impl === LocalBackend) {
      return {
        mode: 'local',
        user: null,
        // Configured but not connected means something failed — the user is
        // still logging fine, but nothing is syncing. Say so plainly.
        degraded: wantRemote(),
        error: remoteFailure ? remoteFailure.message : null,
      };
    }
    return { mode: 'cloud', user: impl.currentUser(), degraded: false, error: null };
  },

  onChange(fn) {
    if (!remoteImpl) return () => {};
    return remoteImpl.onUserChange(fn);
  },

  async signUpEmail(email, password) { return requireRemote().signUpEmail(email, password); },
  async signInEmail(email, password) { return requireRemote().signInEmail(email, password); },
  async signInGoogle() { return requireRemote().signInGoogle(); },
  async sendPasswordReset(email) { return requireRemote().sendPasswordReset(email); },
  async signOut() { return requireRemote().signOut(); },
  async changePassword(currentPassword, newPassword) {
    return requireRemote().changePassword(currentPassword, newPassword);
  },
  async deleteAccount(currentPassword) { return requireRemote().deleteAccount(currentPassword); },

  // Anything still sitting in this browser's local storage — data logged before
  // the cloud was switched on, or while it was unreachable.
  async localRowCounts() {
    const out = {};
    for (const c of COLLECTIONS) {
      const rows = await LocalBackend.read(c);
      if (rows.length && c !== 'settings') out[c] = rows.length;
    }
    return out;
  },

  // Merge this device's local data into the signed-in account. Merges by id and
  // keeps whichever copy is newer, so running it twice is harmless and it can
  // never delete something the cloud already had.
  async uploadLocalData() {
    const impl = requireRemote();
    const { mergeRows } = await import('./firebase-backend.js');
    const report = {};
    for (const c of COLLECTIONS) {
      const local = await LocalBackend.read(c);
      if (!local.length) continue;
      const remote = await impl.read(c);
      // Settings is a single row and not worth fighting over — an existing
      // cloud preference wins, because it reflects a device already signed in.
      const merged = c === 'settings' ? (remote.length ? remote : local) : mergeRows(remote, local);
      await impl.write(c, merged);
      report[c] = merged.length - remote.length;
    }
    return report;
  },

  // Wipe the local copy after a successful upload, so one device stops being a
  // second source of truth. Never called automatically.
  async clearLocalData() {
    for (const c of COLLECTIONS) await LocalBackend.write(c, []);
  },
};

/* ------------------------------------------------------------------ *
 * Derived data used by the graph + calendar
 * ------------------------------------------------------------------ */

// Flattens sessions and benchmarks into one time series per exercise.
// Session value for a given field = the best set that day (max, except time-only which uses max too).
export async function seriesForExercise(exerciseId, field, source = null) {
  const [sessions, benchmarks] = await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const points = [];

  if (source !== 'benchmark') {
    for (const s of sessions) {
      const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
      if (!entry) continue;
      const vals = (entry.sets || [])
        .map((set) => set[field])
        .filter((v) => typeof v === 'number' && !Number.isNaN(v));
      if (!vals.length) continue;
      points.push({ date: s.date, value: Math.max(...vals), source: 'workout', label: s.workoutName });
    }
  }

  if (source !== 'workout') {
    for (const b of benchmarks) {
      if (b.exerciseId !== exerciseId) continue;
      const v = b.values ? b.values[field] : undefined;
      if (typeof v !== 'number' || Number.isNaN(v)) continue;
      points.push({ date: b.date, value: v, source: 'benchmark', label: 'Benchmark' });
    }
  }

  // one point per day — keep the best
  const byDate = new Map();
  for (const p of points) {
    const prev = byDate.get(p.date);
    if (!prev || p.value > prev.value) byDate.set(p.date, p);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Body weight as a chartable series, in the same {date, value} shape the line
// chart takes for everything else. Already one row per day and already sorted,
// so this is a rename — but it keeps the view out of the storage shape.
export async function bodyWeightSeries() {
  const rows = await store.getBodyWeights();
  return rows.map((r) => ({ date: r.date, value: r.weight, source: 'bodyweight' }));
}

/* ------------------------------------------------------------------ *
 * Rep-normalised series
 * ------------------------------------------------------------------ */

// A benchmark is a deliberate test taken fresh; a set logged mid-workout comes
// after whatever else the session had already done. They are not the same
// measurement and charting them as one line is misleading — benchmarks are the
// default because that is the series someone means when they ask "am I getting
// stronger?".
export const SOURCES = ['benchmark', 'workout'];
export const SOURCE_LABEL = { benchmark: 'Benchmarks', workout: 'Workouts' };

// Every recorded (weight, reps) pair for one exercise, one row per SET.
// Sets are kept individually rather than reduced per day, because the rep count
// that appears most often is counted over real observations — a workout of
// 3 x 10 genuinely contributes three tens.
export async function weightRepObservations(exerciseId, source = null) {
  const [sessions, benchmarks] = await Promise.all([store.getSessions(), store.getBenchmarks()]);
  const out = [];

  const push = (date, weight, reps, src, label) => {
    const w = Number(weight), r = Number(reps);
    if (!(w > 0) || !(r >= 1) || Number.isNaN(w) || Number.isNaN(r)) return;
    out.push({ date, weight: w, reps: Math.round(r), source: src, label });
  };

  if (source !== 'benchmark') {
    for (const s of sessions) {
      const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
      if (!entry) continue;
      for (const set of entry.sets || []) push(s.date, set.weight, set.reps, 'workout', s.workoutName);
    }
  }
  if (source !== 'workout') {
    for (const b of benchmarks) {
      if (b.exerciseId !== exerciseId) continue;
      const v = b.values || {};
      push(b.date, v.weight, v.reps, 'benchmark', 'Benchmark');
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// The rep count everything gets compared at, by default.
export async function defaultTargetReps(exerciseId, source = null) {
  return modalReps(await weightRepObservations(exerciseId, source));
}

// One point per day, every point expressed as the weight you would have lifted
// at `targetReps`.
//
// Per-day pick: if any set that day was actually done at the target rep count,
// that set wins (heaviest of them) and the point is marked `actual` — a real
// measurement always beats an estimate. Otherwise the set with the highest
// estimated 1RM wins and the point is marked as an estimate.
export async function normalizedSeries(exerciseId, targetReps, source = null) {
  const target = clampReps(targetReps);
  if (target === null) return [];

  const byDate = new Map();
  for (const o of await weightRepObservations(exerciseId, source)) {
    const isActual = o.reps === target;
    const value = isActual ? o.weight : normalizeWeight(o.weight, o.reps, target);
    if (!(value > 0)) continue;

    const cand = {
      date: o.date,
      value,
      actual: isActual,
      weight: o.weight,
      reps: o.reps,
      source: o.source,
      label: o.label,
      rank: e1rm(o.weight, o.reps) || 0,
    };

    const prev = byDate.get(o.date);
    if (!prev) { byDate.set(o.date, cand); continue; }
    // A real measurement at the target always outranks an estimate.
    if (prev.actual !== cand.actual) { if (cand.actual) byDate.set(o.date, cand); continue; }
    if (cand.actual ? cand.value > prev.value : cand.rank > prev.rank) byDate.set(o.date, cand);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ *
 * Muscle-group strength ranking
 * ------------------------------------------------------------------ */

// Ranks from BOTH benchmarks and sets logged in a workout, best estimate wins.
//
// This is not a breach of D14. That rule is about charting a trend: two sources
// on one line make strength look like it swings wildly, and keeping one point
// per day silently threw the loser away. Neither applies to a single best
// estimate, which is all this screen asks for. Ranking on benchmarks alone left
// the best screen in the app permanently grey for anyone who just logs their
// workouts — which is most people, and the whole point of the app.
//
// A set logged mid-workout comes after everything else the session did, so it
// UNDERSTATES: it will rarely beat a fresh benchmark, and when it does, that is
// real evidence the lifter has moved on since they last tested. Taking the max
// is therefore the conservative reading, not an optimistic one.
//
// What must never happen is the source going unsaid — an inference must not look
// like a measurement (Rule 5). `best.source` carries it and the UI states it.
//
// Returns one entry per rankable muscle group that has usable data.
export async function muscleStrength() {
  const [profile, benchmarks, sessions] = await Promise.all([
    store.getProfile(), store.getBenchmarks(), store.getSessions(),
  ]);
  const {
    MUSCLE_LIFTS, keyLiftFor, percentileFor, levelFor, nextLevelAfter,
    levelProgress, weightForPercentile, generalPopulationPercentile,
  } = await import('./strength-standards.js');

  const out = new Map();
  if (profile.missing.length) return { profile, muscles: out, ready: false };

  for (const muscle of Object.keys(MUSCLE_LIFTS)) {
    const lift = keyLiftFor(muscle);
    if (!lift || !lift.id) continue;

    // Best e1RM on this muscle's key lift, from any source — a muscle is as
    // strong as the best evidence for it, and averaging would punish someone
    // for a bad day they honestly logged.
    let best = null;
    const consider = (weight, reps, date, source) => {
      const est = e1rm(weight, reps);
      if (est === null) return;
      if (!best || est > best.e1rm) {
        best = { e1rm: est, weight, reps: Math.round(Number(reps)), date, source };
      }
    };

    for (const b of benchmarks) {
      if (b.exerciseId !== lift.id) continue;
      const v = b.values || {};
      consider(v.weight, v.reps, b.date, 'benchmark');
    }
    for (const s of sessions) {
      for (const entry of s.entries || []) {
        if (entry.exerciseId !== lift.id) continue;
        for (const set of entry.sets || []) consider(set.weight, set.reps, s.date, 'workout');
      }
    }
    if (!best) continue;

    const percentile = percentileFor(best.e1rm, muscle, profile);
    if (percentile === null) continue;
    const level = levelFor(percentile);
    const next = nextLevelAfter(level);
    const nextWeight = next ? weightForPercentile(next.percentile, muscle, profile) : null;

    out.set(muscle, {
      muscle,
      lift,
      best,
      percentile,
      level,
      next,
      nextWeight,
      toNext: nextWeight ? Math.max(0, nextWeight - best.e1rm) : null,
      progress: levelProgress(percentile, level),
      generalPercentile: generalPopulationPercentile(percentile),
      // Percentile placement leans on the e1RM formula being absolutely
      // accurate, which docs/research.md §1.3 says was never validated. It is
      // most trustworthy at low reps, so anything derived from a high-rep set
      // is flagged rather than presented as equally solid.
      confident: best.reps <= 5,
    });
  }

  return { profile, muscles: out, ready: true };
}

// Every exercise that has at least `min` recorded data points, per field.
export async function chartableExercises(min = 2) {
  const [sessions, benchmarks, exMap] = await Promise.all([
    store.getSessions(),
    store.getBenchmarks(),
    store.getExerciseMap(),
  ]);

  // Everything is tracked PER SOURCE. A benchmark is a deliberate test; a set
  // logged mid-workout is whatever the session called for. Mixing them into one
  // line makes a jagged mess that looks like wild swings in strength, so the
  // graph now charts one source at a time and this has to know which sources
  // actually have enough data to offer.
  const counts = new Map(); // exerciseId -> source -> field -> Set(dates)

  const rec = (exId) => {
    if (!counts.has(exId)) counts.set(exId, { benchmark: {}, workout: {} });
    return counts.get(exId);
  };
  const bump = (exId, src, field, date) => {
    const r = rec(exId)[src];
    if (!r[field]) r[field] = new Set();
    r[field].add(date);
  };
  const bumpPair = (exId, src, date, values) => {
    const w = values.weight, r = values.reps;
    if (typeof w !== 'number' || Number.isNaN(w) || !(w > 0)) return;
    if (typeof r !== 'number' || Number.isNaN(r) || !(r >= 1)) return;
    const rr = rec(exId)[src];
    if (!rr.__paired) rr.__paired = new Set();
    rr.__paired.add(date);
  };

  for (const s of sessions) {
    for (const e of s.entries || []) {
      for (const set of e.sets || []) {
        for (const f of ['weight', 'reps', 'time', 'distance']) {
          if (typeof set[f] === 'number' && !Number.isNaN(set[f])) bump(e.exerciseId, 'workout', f, s.date);
        }
        bumpPair(e.exerciseId, 'workout', s.date, set);
      }
    }
  }
  for (const b of benchmarks) {
    for (const f of ['weight', 'reps', 'time', 'distance']) {
      const v = b.values ? b.values[f] : undefined;
      if (typeof v === 'number' && !Number.isNaN(v)) bump(b.exerciseId, 'benchmark', f, b.date);
    }
    bumpPair(b.exerciseId, 'benchmark', b.date, b.values || {});
  }

  const out = [];
  for (const [exId, perSource] of counts) {
    const ex = exMap.get(exId);
    const canNorm = canNormalize(ex);

    const sources = {};
    for (const src of SOURCES) {
      const r = perSource[src];
      const fields = Object.keys(r).filter((f) => f !== '__paired' && r[f].size >= min);
      const pairedDays = (r.__paired || new Set()).size;
      sources[src] = { fields, pairedDays, normalizable: canNorm && pairedDays >= min };
    }

    // Offer the exercise only if at least ONE source can draw a line on its own.
    // Otherwise it sits in the dropdown leading to an empty chart.
    const usable = SOURCES.filter((s) => sources[s].fields.length || sources[s].normalizable);
    if (!usable.length) continue;

    out.push({
      id: exId,
      name: ex ? ex.name : 'Unknown exercise',
      muscle: ex ? ex.muscle : '',
      equipment: ex ? ex.equipment : '',
      loadType: ex ? ex.loadType : null,
      exercise: ex || null,
      sources,
      usableSources: usable,
      // Union across sources, kept so callers that ignore source still work.
      normalizable: SOURCES.some((s) => sources[s].normalizable),
      fields: [...new Set(SOURCES.flatMap((s) => sources[s].fields))],
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

  // Exercises whose weight is comparable only after rep normalisation. For
  // these the raw weight is replaced by equivalent load at their own modal rep
  // count, and the bare `reps` comparison is suppressed — "reps went 10 -> 4"
  // is not a result, it is half of one.
  const normalized = new Map(); // exerciseId -> { target, ordered: [...] }
  for (const b of benchmarks) {
    const ex = exMap.get(b.exerciseId);
    if (!canNormalize(ex) || normalized.has(b.exerciseId)) continue;

    const obs = benchmarks
      .filter((x) => x.exerciseId === b.exerciseId)
      .map((x) => ({ date: x.date, weight: Number((x.values || {}).weight), reps: Number((x.values || {}).reps) }))
      .filter((o) => o.weight > 0 && o.reps >= 1 && !Number.isNaN(o.weight) && !Number.isNaN(o.reps));
    if (!obs.length) continue;

    const target = modalReps(obs);
    const byDate = new Map();
    for (const o of obs) {
      const isActual = Math.round(o.reps) === target;
      const value = isActual ? o.weight : normalizeWeight(o.weight, o.reps, target);
      if (!(value > 0)) continue;
      const cand = { date: o.date, value, actual: isActual, rank: e1rm(o.weight, o.reps) || 0 };
      const prev = byDate.get(o.date);
      if (!prev) { byDate.set(o.date, cand); continue; }
      if (prev.actual !== cand.actual) { if (cand.actual) byDate.set(o.date, cand); continue; }
      if (cand.actual ? cand.value > prev.value : cand.rank > prev.rank) byDate.set(o.date, cand);
    }
    normalized.set(b.exerciseId, {
      target,
      ordered: [...byDate.values()].sort((a, b2) => a.date.localeCompare(b2.date)),
    });
  }

  const byField = {};
  const incomplete = {};

  for (const f of FIELDS) {
    const rows = [];
    let pending = 0;

    for (const [exId, rec] of grouped) {
      const norm = normalized.get(exId);
      if (norm && f === 'reps') continue;          // meaningless once weight is normalised

      const useNorm = Boolean(norm) && f === 'weight' && norm.ordered.length > 0;
      const points = useNorm ? norm.ordered : rec[f];
      if (!points) continue;

      // One entry per day; if a day has several, keep the best.
      // Normalised points arrive already reduced per day.
      let ordered;
      if (useNorm) ordered = points;
      else {
        const byDate = new Map();
        for (const p of points) {
          const prev = byDate.get(p.date);
          if (!prev || p.value > prev.value) byDate.set(p.date, p);
        }
        ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      }

      if (ordered.length < minPoints) { pending++; continue; }

      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const ex = exMap.get(exId);
      rows.push({
        id: exId,
        name: ex ? ex.name : 'Unknown exercise',
        loadType: ex ? ex.loadType : null,
        atReps: useNorm ? norm.target : null,
        startActual: useNorm ? first.actual : true,
        nowActual: useNorm ? last.actual : true,
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
