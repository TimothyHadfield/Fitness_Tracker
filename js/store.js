// Data layer.
//
// Everything the app reads/writes goes through `store`. The API is async from day one so a
// remote backend can replace the local one without touching any view code.
//
// Current backend: LocalBackend (browser localStorage).
// To switch to Firebase: fill in js/firebase-config.js and set BACKEND = 'firebase' below.
// See docs/firebase-setup.md.

import { BUILT_IN_EXERCISES } from './exercises.js';
import { e1rm, normalizeWeight, modalReps, canNormalize, clampReps, isRankableSet } from './e1rm.js';
import { normalizeGroups, plannedMinis, isNested } from './set-types.js';
import { IS_CONFIGURED } from './firebase-config.js';

const BACKEND = 'auto'; // 'auto' | 'local' | 'firebase'
const NS = 'ftrack:v1:';

// ⚠️ Adding a collection here also requires adding it to knownCollection() in
// firestore.rules and redeploying, or every cloud write to it is denied.
const COLLECTIONS = ['customExercises', 'workouts', 'sessions', 'benchmarks', 'settings', 'bodyWeight', 'systems'];

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

/* ------------------------------------------------------------------ *
 * Benchmark workouts
 *
 * A workout can be marked as a benchmark, and then every exercise it records
 * becomes a benchmark for that day. The session is still saved as a session —
 * you did do the workout — and the benchmark rows are DERIVED from it, tagged
 * with sourceSessionId and rebuilt on every save. That is what lets the date be
 * edited later without stranding a benchmark on the old day.
 * ------------------------------------------------------------------ */

/**
 * Which of an exercise's sets is *the* benchmark.
 *
 * A benchmark is one performance, so a workout's several sets have to reduce to
 * one. Where the app can already rank a lift it uses the same measure it ranks
 * with — estimated 1RM — so the benchmark agrees with the muscle map rather
 * than being a second opinion.
 *
 * ⚠️ The honest limitation is time. Longer is better for a plank; FASTER is
 * better for a mile. A distance-and-time exercise is resolved by taking the
 * furthest set and breaking ties on the fastest time, which gets a fixed-
 * distance run right. A time-ONLY exercise assumes longer is better, which is
 * right for a hold and wrong for a sprint — record those by hand.
 */
export function pickBenchmarkSet(sets, fields) {
  const usable = (sets || []).filter((s) => s && Object.values(s).some((v) => Number(v) > 0));
  if (!usable.length) return null;
  const has = (f) => fields && fields.includes(f);
  const num = (s, f) => Number(s[f]) || 0;

  const rank = (s) => {
    if (has('weight') && has('reps')) return e1rm(num(s, 'weight'), num(s, 'reps')) || 0;
    if (has('distance')) return num(s, 'distance');
    if (has('reps')) return num(s, 'reps');
    if (has('time')) return num(s, 'time');
    return 0;
  };

  let best = usable[0];
  for (const s of usable.slice(1)) {
    const d = rank(s) - rank(best);
    if (d > 0) { best = s; continue; }
    // Same distance, quicker time wins — that is a faster mile, not a longer one.
    if (d === 0 && has('distance') && has('time')
        && num(s, 'time') > 0 && (num(best, 'time') === 0 || num(s, 'time') < num(best, 'time'))) {
      best = s;
    }
  }
  return { ...best };
}

async function dropSessionBenchmarks(sessionId) {
  const rows = await backend.read('benchmarks');
  const kept = rows.filter((r) => r.sourceSessionId !== sessionId);
  if (kept.length !== rows.length) await backend.write('benchmarks', kept);
}

async function syncSessionBenchmarks(session) {
  const rows = await backend.read('benchmarks');
  const kept = rows.filter((r) => r.sourceSessionId !== session.id);

  const made = [];
  if (session.isBenchmark) {
    const exMap = await store.getExerciseMap();
    for (const entry of session.entries || []) {
      const ex = exMap.get(entry.exerciseId);
      const fields = ex ? ex.fields : ['weight', 'reps'];
      const values = pickBenchmarkSet(entry.sets, fields);
      if (!values) continue;
      made.push({
        // Deterministic, so re-saving updates the same row instead of piling up
        // a new benchmark every time a past workout is edited.
        id: `bmk-${session.id}-${entry.exerciseId}`,
        date: session.date,
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        values,
        sourceSessionId: session.id,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (kept.length !== rows.length || made.length) {
    await backend.write('benchmarks', [...kept, ...made]);
  }
}

// A SYSTEM is a named group of workouts — a programme. "Push Pull Legs" holding
// a Push, a Pull and a Legs workout; "Upper/Lower" holding two. Added 2026-08-17
// because Tim wants several programmes side by side and, later, to be able to
// load somebody else's (docs/vision.md §1.3).
//
// A workout belongs to exactly ONE system. Sharing one workout between two
// programmes sounds useful and is not: editing it in one place would silently
// change the other, and "did my Push day just change because I imported a
// celebrity programme?" is not a question this app should ever raise.
const DEFAULT_SYSTEM_NAME = 'My Workouts';

// In-flight migration, shared by concurrent callers. See ensureSystems().
let systemsMigration = null;

export function normalizeSystem(sys) {
  if (!sys) return sys;
  return {
    ...sys,
    name: (sys.name || '').trim() || 'Untitled system',
    notes: sys.notes || '',
  };
}

// Workouts used to be a bare list of exercise ids. They now carry a planned set
// count and notes per exercise, so older saved workouts are upgraded on read.
export function normalizeWorkout(w) {
  if (!w) return w;
  if (Array.isArray(w.exercises) && w.exercises.length) {
    return {
      ...w,
      isBenchmark: Boolean(w.isBenchmark),
      // ⚠️ This function REBUILDS each exercise field by field rather than
      // spreading it, so anything not named here is silently dropped on every
      // read and write. `group`, `setType` and `drops` (set-types.js) have to
      // be listed or supersets and drop sets would survive exactly until the
      // workout was next loaded. Add a field to the exercise shape, add it here.
      exercises: normalizeGroups(w.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: Number(e.sets) > 0 ? Number(e.sets) : DEFAULT_SETS,
        notes: e.notes || '',
        ...(isNested(e.setType) ? { setType: e.setType, minis: plannedMinis(e) } : {}),
        ...(e.group == null ? {} : { group: e.group }),
      }))),
    };
  }
  const ids = Array.isArray(w.exerciseIds) ? w.exerciseIds : [];
  return {
    ...w,
    isBenchmark: Boolean(w.isBenchmark),
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

  /* --- workout systems --- */

  // Every workout must end up in a system, including the ones saved before
  // systems existed. This is the migration, and it is idempotent: it only
  // writes when it finds a workout without a systemId, which after the first
  // run is never. Done here rather than on read of a single workout so that a
  // half-migrated state cannot exist.
  // ⚠️ SINGLE-FLIGHT, and that is not an optimisation. Read-modify-write on two
  // collections is not atomic, so two callers running this at once each read
  // "no systems", each created one, and the second write clobbered the first —
  // leaving the systems list pointing at a row that no longer existed and every
  // workout stamped with a dead id. It presented as an empty system list and a
  // "Not found" the moment you tapped it. Concurrent callers now share one run.
  //
  // WorkoutsView asking for systems and workouts in the same Promise.all is
  // exactly that case, and is a completely reasonable thing for a view to do.
  ensureSystems() {
    if (systemsMigration) return systemsMigration;
    systemsMigration = (async () => {
      const [systems, workouts] = await Promise.all([
        backend.read('systems'), backend.read('workouts'),
      ]);
      const orphans = workouts.filter((w) => !w.systemId);
      if (!orphans.length) return systems.map(normalizeSystem);

      let home = systems[0];
      if (!home) {
        const now = new Date().toISOString();
        home = { id: uid('sys'), name: DEFAULT_SYSTEM_NAME, notes: '', createdAt: now, updatedAt: now };
        systems.push(home);
        await backend.write('systems', systems);
      }
      for (const w of orphans) w.systemId = home.id;
      await backend.write('workouts', workouts);
      return systems.map(normalizeSystem);
    })();
    // Cleared once settled, so a later call re-checks. After the first run there
    // are no orphans left, so re-checking costs two reads and writes nothing.
    systemsMigration.finally(() => { systemsMigration = null; });
    return systemsMigration;
  },

  async getSystems() {
    const systems = await this.ensureSystems();
    return systems.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getSystem(id) {
    const rows = await this.ensureSystems();
    const row = rows.find((r) => r.id === id);
    return row ? normalizeSystem(row) : null;
  },

  async saveSystem(sys) {
    const rows = await backend.read('systems');
    const row = { ...normalizeSystem(sys), updatedAt: new Date().toISOString() };
    if (!row.id) row.id = uid('sys');
    if (!row.createdAt) row.createdAt = row.updatedAt;
    await backend.write('systems', upsert(rows, row));
    return row;
  },

  // Deleting a system deletes the workouts inside it — they belong to it and
  // there is nowhere else for them to live. Sessions already RECORDED are not
  // touched: history is a record of what happened and does not become untrue
  // because the plan behind it was thrown away.
  async deleteSystem(id) {
    const [systems, workouts] = await Promise.all([
      backend.read('systems'), backend.read('workouts'),
    ]);
    await backend.write('workouts', workouts.filter((w) => w.systemId !== id));
    await backend.write('systems', systems.filter((r) => r.id !== id));
  },

  /**
   * Copy a ready-made system into this account.
   *
   * A COPY, not a reference. Once added it is the user's: they can rename it,
   * change the exercises, delete a workout. The alternative — keeping it linked
   * to the original — means their programme could change under them when the
   * app updates, which is exactly the surprise a training plan must never spring.
   *
   * `presetId` is kept so the browse screen can say "already added", and so a
   * future update could offer a fresh copy rather than silently rewriting one.
   *
   * Exercises are matched BY NAME. Anything that does not resolve is skipped
   * rather than written as a dangling id, and the count of what was skipped is
   * returned so the caller can be honest about it. In practice a test asserts
   * every preset name resolves, so this is a belt-and-braces path.
   */
  async addPresetSystem(preset) {
    if (!preset || !Array.isArray(preset.workouts)) throw new Error('Not a system');
    const exMap = await this.getExerciseMap();
    const byName = new Map([...exMap.values()].map((e) => [e.name, e]));

    const system = await this.saveSystem({
      name: preset.name,
      notes: preset.notes || preset.summary || '',
      presetId: preset.id,
      author: preset.author || null,
      sourceName: preset.sourceName || null,
      sourceUrl: preset.sourceUrl || null,
    });

    let skipped = 0;
    let order = 0;
    for (const w of preset.workouts) {
      const exercises = [];
      for (const item of w.exercises || []) {
        const ex = byName.get(item.name);
        if (!ex) { skipped++; continue; }
        exercises.push({
          exerciseId: ex.id,
          sets: Number(item.sets) > 0 ? Number(item.sets) : DEFAULT_SETS,
          notes: item.notes || '',
          // A preset that says "supersetted with the next one" has to arrive
          // that way, or copying somebody's programme quietly flattens it —
          // which is the whole complaint docs/vision.md §1.5 was written about.
          ...(isNested(item.setType) ? { setType: item.setType, minis: plannedMinis(item) } : {}),
          ...(item.group == null ? {} : { group: item.group }),
        });
      }
      if (!exercises.length) continue;
      // ⚠️ `order` is what stops a programme arriving shuffled. Workouts sort by
      // name otherwise, which is harmless for a list somebody typed themselves
      // and wrong for a programme: Thurston's week came out Arms, Back, Chest,
      // Conditioning, Legs, Shoulders, and "Upper A, Lower A, Upper B, Lower B"
      // came out with both Lowers first — reversing the two things the notes
      // tell you to alternate. Caught by driving the real Add button.
      await this.saveWorkout({ name: w.name, systemId: system.id, exercises, order: order++ });
    }

    return { system, skipped };
  },

  // Which ready-made systems this account already holds a copy of.
  async addedPresetIds() {
    const rows = await backend.read('systems');
    return new Set(rows.map((r) => r.presetId).filter(Boolean));
  },

  /* --- workout templates --- */

  /**
   * Workouts, in the order they should be READ rather than the order they were
   * written.
   *
   * A workout copied from a ready-made system carries an `order` — the position
   * it had in the programme, which is information the author put there and
   * alphabetising throws away. A workout the user typed has none, because there
   * is no meaningful order to a list you wrote yourself, and those stay
   * alphabetical so they are findable.
   *
   * Ordered ones come first. That is deliberate: add your own workout to a
   * copied programme and it lands at the end, rather than wedging itself into
   * the middle of somebody's split because of its initial letter.
   */
  async getWorkouts(systemId) {
    await this.ensureSystems();
    const rows = await backend.read('workouts');
    const all = rows.map(normalizeWorkout).sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : Infinity;
      const bo = Number.isFinite(b.order) ? b.order : Infinity;
      return ao !== bo ? ao - bo : a.name.localeCompare(b.name);
    });
    return systemId ? all.filter((w) => w.systemId === systemId) : all;
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
    // Benchmarks derived from this session are rebuilt from scratch every save,
    // so editing the date, changing a set or clearing the flag can never leave a
    // stale benchmark behind pointing at a day the workout is no longer on.
    await syncSessionBenchmarks(row);
    return row;
  },

  async deleteSession(id) {
    const rows = await backend.read('sessions');
    await backend.write('sessions', rows.filter((r) => r.id !== id));
    await dropSessionBenchmarks(id);
  },

  /* --- benchmarks --- */

  /**
   * Every set of every exercise a benchmark workout records, reduced to the one
   * that counts. See pickBenchmarkSet for how "counts" is decided.
   */
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

  /** Derived rows carry the session that made them; a user-entered one doesn't. */
  async benchmarksFromSession(sessionId) {
    const rows = await backend.read('benchmarks');
    return rows.filter((r) => r.sourceSessionId === sessionId);
  },

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
      // Who the body map compares you against. A view preference, but it lives
      // in settings so it survives a reload and follows the account — someone
      // who has chosen to be ranked against everyone should not find it reset
      // the next morning. Shape is validated in strength-standards.js, so a
      // stale or hand-edited value degrades to the default rather than throwing.
      compare: settings.compare || null,
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

/* ------------------------------------------------------------------ *
 * Knowing WHY the cloud is unreachable
 *
 * "Your account could not be reached" is true of a dead server, a blocked
 * domain and a phone with no signal alike, and only one of those is worth
 * worrying about. navigator.onLine is a weak signal — false is reliable, true
 * only means "there is an interface", so it is used to explain a failure that
 * has already happened, never to predict one.
 * ------------------------------------------------------------------ */

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Actually ask the network, rather than trusting navigator.onLine.
 *
 * onLine === false is reliable. onLine === true is nearly worthless: it means
 * an interface exists, so a captive portal, a hotel wi-fi that never finished
 * logging in, or a dead upstream all report "online" while nothing can load.
 * Those are the cases most likely to send someone hunting for a bug in the app.
 *
 * The request is same-origin and cache-busted so the service worker cannot
 * answer it out of cache — a success here really does mean the network replied.
 */
export async function probeOffline(timeoutMs = 4000) {
  if (isOffline()) return true;
  if (typeof fetch !== 'function') return false;
  try {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    await fetch(`./manifest.webmanifest?connectivity=${Date.now()}`, {
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    return false;
  } catch (_) {
    return true;
  }
}

const LAST_ACCOUNT_KEY = NS + 'lastAccount';

function rememberAccount(user) {
  try {
    if (user && !user.isAnonymous && user.email) {
      localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify({ email: user.email }));
    } else if (user && user.isAnonymous) {
      // An anonymous session is not an account to be reminded of.
      localStorage.removeItem(LAST_ACCOUNT_KEY);
    }
  } catch (_) { /* storage full or blocked — this is a nicety, not data */ }
}

function lastKnownAccount() {
  try {
    const raw = localStorage.getItem(LAST_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function forgetLastAccount() {
  try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch (_) {}
}

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
        // WHY it is not connected, which the UI got wrong: a dropped connection
        // was reported as "your account could not be reached", which reads as a
        // problem with the account. Tim hit this, concluded the app was broken,
        // and was simply offline.
        offline: isOffline(),
        // Who was signed in last time the cloud WAS reachable. Without this an
        // offline session looks like being logged out, which is alarming and
        // untrue — nothing has been signed out, the app just cannot ask.
        lastAccount: lastKnownAccount(),
      };
    }
    rememberAccount(impl.currentUser());
    return { mode: 'cloud', user: impl.currentUser(), degraded: false, error: null,
             offline: false, lastAccount: lastKnownAccount() };
  },

  // A real retry, rather than location.reload(). The first connection attempt is
  // memoised in activePromise, so without clearing it every "Try again" replayed
  // the same cached failure.
  async retry() {
    activePromise = null;
    remoteImpl = null;
    remoteFailure = null;
    return this.state();
  },

  onChange(fn) {
    if (!remoteImpl) return () => {};
    return remoteImpl.onUserChange(fn);
  },

  async signUpEmail(email, password) { return requireRemote().signUpEmail(email, password); },
  async signInEmail(email, password) { return requireRemote().signInEmail(email, password); },
  async signInGoogle(opts) { return requireRemote().signInGoogle(opts); },
  async sendPasswordReset(email) { return requireRemote().sendPasswordReset(email); },
  async signOut() { forgetLastAccount(); return requireRemote().signOut(); },
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
// SINCE 2026-08-17 a muscle is rated from EVERY exercise that trains it, not
// from one named lift. Before this, 11 of 265 exercises could move the map:
// Tim trained everything for a week and got a single reading, because he had
// done hammer curls rather than barbell curls and dumbbell rows rather than
// barbell rows. js/muscle-evidence.js holds the conversions and the confidence
// model; this function's only job is to turn stored records into observations
// and hand them over.
//
// Returns one entry per rankable muscle group that has usable data.
export async function muscleStrength() {
  const [profile, benchmarks, sessions, exMap] = await Promise.all([
    store.getProfile(), store.getBenchmarks(), store.getSessions(), store.getExerciseMap(),
  ]);
  const [
    { MUSCLE_LIFTS, keyLiftFor, percentileFor, levelFor, nextLevelAfter,
      levelProgress, weightForPercentile, generalPopulationPercentile },
    { contributionsFor, totalLoad, rateMuscle, confidenceBand, tintFor, raiseConfidenceHint },
  ] = await Promise.all([
    import('./strength-standards.js'),
    import('./muscle-evidence.js'),
  ]);

  const out = new Map();
  if (profile.missing.length) return { profile, muscles: out, ready: false };

  // Contributions are per exercise, not per set, so they are resolved once.
  const contribCache = new Map();
  const contribFor = (exerciseId) => {
    if (contribCache.has(exerciseId)) return contribCache.get(exerciseId);
    const ex = exMap.get(exerciseId);
    const c = ex ? contributionsFor(ex) : [];
    contribCache.set(exerciseId, c);
    return c;
  };

  const today = new Date(todayISO() + 'T00:00:00');
  const ageOf = (date) => {
    const d = new Date(String(date) + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return 0;
    return Math.max(0, Math.round((today - d) / 86400000));
  };

  // muscle -> observations, each already converted to that muscle's KEY LIFT.
  const byMuscle = new Map();

  const record = (exerciseId, exerciseName, weight, reps, date, isBenchmark) => {
    // D5: a maximum is not inferred from a set above 15 reps. Without this the
    // formula extrapolates a 135x25 burnout set to 258 lb, which beats a real
    // 205x5 top set and moves the muscle a whole level on the back of the least
    // informative set of the week. A benchmark gets no exemption — a 25-rep
    // benchmark is no more evidence of a max than a 25-rep set is.
    if (!isRankableSet(reps)) return;
    const contributions = contribFor(exerciseId);
    if (!contributions.length) return;

    const ex = exMap.get(exerciseId);
    // Ratios are in TOTAL load. A dumbbell row entered as 80 is 160 on the body,
    // and comparing the 80 against a barbell row would make every dumbbell
    // lifter look weak.
    const load = totalLoad(weight, ex ? ex.loadType : 'total');
    if (load === null) return;
    const raw = e1rm(load, reps);
    if (raw === null) return;

    for (const c of contributions) {
      if (!byMuscle.has(c.muscle)) byMuscle.set(c.muscle, []);
      byMuscle.get(c.muscle).push({
        estimate: raw / c.ratio,
        rawE1rm: raw,
        quality: c.quality,
        kind: c.kind,
        via: c.via,
        ratio: c.ratio,
        reps: Math.round(Number(reps)),
        weight: Number(weight),
        loadType: ex ? ex.loadType : 'total',
        date,
        ageDays: ageOf(date),
        isBenchmark: Boolean(isBenchmark),
        exerciseId,
        exerciseName: exerciseName || (ex ? ex.name : exerciseId),
        source: isBenchmark ? 'benchmark' : 'workout',
      });
    }
  };

  for (const b of benchmarks) {
    const v = b.values || {};
    record(b.exerciseId, b.exerciseName, v.weight, v.reps, b.date, true);
  }
  for (const s of sessions) {
    for (const entry of s.entries || []) {
      for (const set of entry.sets || []) {
        record(entry.exerciseId, entry.exerciseName, set.weight, set.reps, s.date, Boolean(s.isBenchmark));
      }
    }
  }

  for (const muscle of Object.keys(MUSCLE_LIFTS)) {
    const rating = rateMuscle(byMuscle.get(muscle) || []);
    if (!rating) continue;

    const percentile = percentileFor(rating.estimate, muscle, profile);
    if (percentile === null) continue;
    const level = levelFor(percentile);
    const next = nextLevelAfter(level);
    const nextWeight = next ? weightForPercentile(next.percentile, muscle, profile) : null;

    // The single strongest contributor, named in the panel so an inference
    // never looks like a measurement (Rule 5).
    const top = rating.used[0];

    out.set(muscle, {
      muscle,
      lift: keyLiftFor(muscle),
      estimate: rating.estimate,
      confidence: rating.confidence,
      band: confidenceBand(rating.confidence),
      tint: tintFor(rating.confidence),
      basis: rating.kind,
      contributors: rating.used,
      contributorCount: rating.contributorCount,
      newestAgeDays: rating.newestAgeDays,
      hint: raiseConfidenceHint(muscle, rating),
      // Kept for the panel, which still wants to show a real recorded set
      // rather than only a derived number.
      best: {
        e1rm: top.rawE1rm,
        weight: top.weight,
        reps: top.reps,
        date: top.date,
        source: top.source,
        exerciseName: top.exerciseName,
        loadType: top.loadType,
      },
      percentile,
      level,
      next,
      nextWeight,
      toNext: nextWeight ? Math.max(0, nextWeight - rating.estimate) : null,
      progress: levelProgress(percentile, level),
      generalPercentile: generalPopulationPercentile(percentile),
      // Percentile placement leans on the e1RM formula being absolutely
      // accurate, which docs/research.md §1.3 says was never validated. It is
      // most trustworthy at low reps, so anything derived from a high-rep set
      // is flagged rather than presented as equally solid.
      confident: top.reps <= 5,
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

/**
 * Where every lift stands RIGHT NOW — one row per exercise, no history needed.
 *
 * Tim, 2026-08-17: *"I know the graph and bar charts don't mean much without
 * multiple recordings over time, but I still want to be able to see some sort of
 * display that allows the user to know their current measurements for each of
 * their lifts."* Both chart modes need two points on two days before they can
 * draw anything, so a new user who has logged a full workout was being told
 * "Nothing to chart yet" while the app sat on every number they had entered.
 *
 * This asks a different question from a chart, so it is a different function
 * rather than chartableExercises(1): a chart wants points over time, this wants
 * the single best effort and how long ago it was.
 *
 * Returns rows sorted by most recent, each:
 *   { id, name, muscle, best{ weight, reps, date, source, ... }, e1rm,
 *     latestDate, days, sessions }
 */
export async function currentBests() {
  const [sessions, benchmarks, exMap] = await Promise.all([
    store.getSessions(), store.getBenchmarks(), store.getExerciseMap(),
  ]);

  const rows = new Map();
  const row = (exId) => {
    if (!rows.has(exId)) {
      const ex = exMap.get(exId);
      rows.set(exId, {
        id: exId,
        name: ex ? ex.name : 'Unknown exercise',
        muscle: ex ? ex.muscle : '',
        loadType: ex ? ex.loadType : null,
        fields: ex ? ex.fields : ['weight', 'reps'],
        best: null,
        e1rm: null,
        latestDate: null,
        days: new Set(),
      });
    }
    return rows.get(exId);
  };

  const consider = (exId, values, date, source) => {
    const r = row(exId);
    r.days.add(date);
    if (!r.latestDate || date > r.latestDate) r.latestDate = date;

    const w = Number(values.weight);
    const reps = Number(values.reps);
    const hasLoad = w > 0 && reps >= 1;

    // Rank by estimated 1RM where there is one, so 185×8 correctly beats 205×3
    // only if it really does. Everything else — a time, a distance — keeps its
    // own best by raw value, and "best" for a time means FASTEST.
    if (hasLoad) {
      const est = e1rm(w, reps);
      if (est !== null && (r.e1rm === null || est > r.e1rm)) {
        r.e1rm = est;
        r.best = { weight: w, reps: Math.round(reps), date, source };
      }
      return;
    }
    const t = Number(values.time);
    const d = Number(values.distance);
    if (t > 0 && (!r.best || !(r.best.time > 0) || t < r.best.time)) {
      r.best = { time: t, distance: d > 0 ? d : undefined, date, source };
    } else if (d > 0 && (!r.best || !(r.best.distance > 0))) {
      r.best = { distance: d, date, source };
    } else if (w > 0 && (!r.best || !(r.best.weight > 0))) {
      // A weight with no reps still tells you something; it just cannot be
      // turned into an estimated maximum.
      r.best = { weight: w, date, source };
    }
  };

  for (const s of sessions) {
    for (const e of s.entries || []) {
      for (const set of e.sets || []) consider(e.exerciseId, set, s.date, 'workout');
    }
  }
  for (const b of benchmarks) consider(b.exerciseId, b.values || {}, b.date, 'benchmark');

  // Noon, so a DST shift cannot turn a clean 7 days into 6.96 and round down.
  const noon = (iso) => new Date(String(iso) + 'T12:00:00');
  const today = noon(todayISO());
  const out = [];
  for (const r of rows.values()) {
    if (!r.best) continue;
    const t = noon(r.latestDate);
    out.push({
      ...r,
      sessions: r.days.size,
      days: Number.isNaN(t.getTime()) ? null : Math.max(0, Math.round((today - t) / 86400000)),
    });
  }
  // Most recent first: the lift you did yesterday is the one you want to see.
  return out.sort((a, b) => (a.latestDate < b.latestDate ? 1 : a.latestDate > b.latestDate ? -1 : a.name.localeCompare(b.name)));
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
