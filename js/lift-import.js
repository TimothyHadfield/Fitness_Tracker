// Reading somebody's LIFTING history out of another app's export — pure, no
// DOM, no store. docs/import-plan.md (O-19, 2026-09-27).
//
// The switcher's case: years of Strong / Hevy / spreadsheet sets, and a
// strength map that would otherwise start from zero. This module turns the file
// into session rows of this app's own shape; views-import.js previews them and
// writes them through store.importRows(), which already exists.
//
// ⚠️ THE SAME THREE REFUSALS AS import-file.js, FOR THE SAME REASONS:
//   - a weight column whose unit the header does not state is ASKED, never
//     guessed (kg read as lb halves somebody's whole history, silently);
//   - slash dates the column cannot settle are ASKED (dateOrderOf);
//   - an exercise name that matches two library rows is UNMATCHED, not the
//     first hit ("Cable Kickback" is two different exercises here).
//
// ⚠️ RE-IMPORT IS AN UPSERT. A workout's id comes from its date, start time and
// name — never the file name — so the same export, or next month's overlapping
// one, lands on the same ids and adds nothing.

import { parseCSV, toRecords, readDate, dateOrderOf, importId, LB_PER_KG } from './import-file.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_WORKOUTS = 5000;
const MAX_REPS = 200;
const MAX_LB = 1500;
/** A "Sets" count above this is a typo or a total, not 50 real sets. */
export const MAX_SET_COUNT = 20;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* ------------------------------------------------------------------ *
 * The file
 * ------------------------------------------------------------------ */

/** ',' or ';' (or tab), read from the header line outside quotes. */
export function sniffDelimiter(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const line = src.slice(0, Math.max(0, src.indexOf('\n')) || src.length);
  let quoted = false;
  const n = { ',': 0, ';': 0, '\t': 0 };
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c in n) n[c]++;
  }
  if (n[';'] > n[','] && n[';'] >= n['\t']) return ';';
  if (n['\t'] > n[',']) return '\t';
  return ',';
}

/* Column aliases, matched on the normalised header; the first hit wins, so the
 * more specific name goes first. */
const COLS = {
  workoutNo: ['workout', 'workoutno', 'workoutnumber'],
  date: ['date', 'starttime', 'workoutdate', 'day', 'datetime', 'time'],
  workout: ['workoutname', 'title', 'workouttitle', 'routine', 'session', 'workout'],
  exercise: ['exercisename', 'exercisetitle', 'exercise', 'lift', 'movement'],
  setOrder: ['setorder', 'setindex', 'set', 'setnumber', 'setno'],
  // 🆕 A spreadsheet's "Sets" column is a COUNT (3 × 5), not the set's number.
  setCount: ['sets', 'setcount', 'numberofsets', 'numsets', 'noofsets'],
  setType: ['settype', 'type'],
  weight: ['weightkg', 'weightlbs', 'weightlb', 'weight', 'load', 'kg', 'lbs', 'lb'],
  unit: ['unit', 'units', 'weightunit'],
  reps: ['reps', 'rep', 'repetitions'],
  seconds: ['seconds', 'durationseconds', 'timeseconds'],
  distance: ['distancemeters', 'distancekm', 'distancemiles', 'distancemi', 'distancem', 'distance'],
};

/**
 * headers → { kind, cols, weightUnit, distanceUnit } for a lifting file, or
 * null when this is not one (no exercise column, or no reps/weight column).
 * `weightUnit` null = the header does not say, and the caller must ask.
 */
export function detectLiftFormat(headers) {
  const hs = headers.map((h) => String(h || '').trim());
  const cols = {};
  const used = new Set();
  // "Workout #" normalises to "workout" — it must be claimed before "Workout"
  // could be read as a workout NAME, and only when it is really the number.
  for (const [field, aliases] of Object.entries(COLS)) {
    for (const a of aliases) {
      const hit = hs.find((h) => !used.has(h) && norm(h) === a
        && (field !== 'workoutNo' || /#|no\.?$|number/i.test(h)));
      if (hit) { cols[field] = hit; used.add(hit); break; }
    }
  }
  if (!cols.exercise || !cols.date || !(cols.reps || cols.weight)) return null;

  const n = new Set(hs.map(norm));
  const kind = n.has('exercisetitle') && n.has('starttime') ? 'hevy'
    : n.has('exercisename') && n.has('setorder') ? 'strong' : 'generic';

  const wh = norm(cols.weight);
  const weightUnit = /kg|kilo/.test(wh) ? 'kg' : /lb|pound/.test(wh) ? 'lb' : null;
  const dh = norm(cols.distance);
  const distanceUnit = !cols.distance ? null
    : /km|kilomet/.test(dh) ? 'km' : /mile|mi$/.test(dh) ? 'mi' : /meter|metre|m$/.test(dh) ? 'm' : null;
  return { kind, cols, weightUnit, distanceUnit };
}

/** Text → { headers, records, format, delimiter }, or { error }. */
export function readLiftFile(text) {
  const delimiter = sniffDelimiter(text);
  const { headers, records } = toRecords(parseCSV(text, delimiter));
  if (!records.length) return { error: 'empty', headers };
  const format = detectLiftFormat(headers);
  if (!format) return { error: 'not-lifting', headers, records };
  return { headers, records, format, delimiter };
}

/* ------------------------------------------------------------------ *
 * Cells
 * ------------------------------------------------------------------ */

/** A number cell. In a semicolon file "60,5" is 60.5 (a decimal comma). */
export function liftNumber(cell, delimiter = ',') {
  let s = String(cell == null ? '' : cell).trim();
  if (!s) return null;
  if (delimiter === ';' && /^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

/** "2024/05/03" and "2024.05.03" are unambiguous; readDate only knows dashes. */
function dateCell(cell) {
  return String(cell || '').trim().replace(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/,
    (_, y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}

/** The time of day in a date cell, if it has one ("18:51:52" → "18:51"). */
function timeOf(cell) {
  const m = String(cell || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = Number(m[1]);
  if (/pm/i.test(cell) && h < 12) h += 12;
  if (/am/i.test(cell) && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** The date column's slash order: 'dmy' | 'mdy' | 'none' | 'ambiguous'. */
export function liftDateOrder(records, format) {
  return dateOrderOf(records.map((r) => dateCell(r[format.cols.date])));
}

/** 'warmup' | 'drop' | 'skip' | 'normal' */
function setKind(r, cols) {
  const t = norm(cols.setType ? r[cols.setType] : '');
  const o = String(cols.setOrder ? r[cols.setOrder] : '').trim().toLowerCase();
  if (t.startsWith('warm') || o === 'w' || o.startsWith('warm')) return 'warmup';
  if (t.startsWith('drop') || o === 'd' || o.startsWith('drop')) return 'drop';
  if (o.startsWith('rest') || t.startsWith('rest') || t.startsWith('cool')) return 'skip';
  return 'normal';
}

/* ------------------------------------------------------------------ *
 * Exercise names
 * ------------------------------------------------------------------ */

const stem = (w) => (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const WORD_FIX = { pullup: ['pull', 'up'], chinup: ['chin', 'up'], pushup: ['push', 'up'], situp: ['sit', 'up'],
  stepup: ['step', 'up'], skullcrusher: ['skull', 'crusher'], pulldown: ['pulldown'], ez: ['ez'],
  db: ['dumbbell'], bb: ['barbell'], kb: ['kettlebell'], ohp: ['overhead', 'press'], rdl: ['romanian', 'deadlift'] };
const NOISE = new Set(['weighted', 'bodyweight', 'the', 'with', 'and', 'a']);
function words(s) {
  const out = [];
  for (const w of String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(Boolean)) {
    for (const x of WORD_FIX[w] || [w]) if (!NOISE.has(x)) out.push(stem(x));
  }
  return out;
}
const keyOf = (ws) => [...new Set(ws)].sort().join(' ');

/* The common Strong / Hevy names the word rules cannot reach (normalised). */
const ALIASES = {
  squatbarbell: 'Back Squat',
  squat: 'Back Squat',
  benchpressbarbell: 'Barbell Bench Press',
  benchpress: 'Barbell Bench Press',
  deadlift: 'Deadlift',
  bicepcurlbarbell: 'Barbell Curl',
  bicepcurldumbbell: 'Dumbbell Curl',
  bicepcurlcable: 'Cable Curl',
  bicepcurlmachine: 'Machine Curl',
  bicepscurlbarbell: 'Barbell Curl',
  bicepscurldumbbell: 'Dumbbell Curl',
  ezbarcurl: 'EZ-Bar Curl',
  bicepcurlezbar: 'EZ-Bar Curl',
  curlezbar: 'EZ-Bar Curl',
  overheadpressdumbbell: 'Dumbbell Shoulder Press',
  shoulderpressdumbbell: 'Dumbbell Shoulder Press',
  seatedshoulderpressdumbbell: 'Seated Dumbbell Shoulder Press',
  seatedoverheadpressdumbbell: 'Seated Dumbbell Shoulder Press',
  abwheel: 'Ab Wheel Rollout',
  singlearmdumbbellrow: 'Dumbbell Row',
  onearmdumbbellrow: 'Dumbbell Row',
  isolateralrowmachine: 'Hammer Strength Row',
  overheadpressbarbell: 'Overhead Press',
  militarypress: 'Overhead Press',
  strictmilitarypress: 'Overhead Press',
  shoulderpressmachine: 'Machine Shoulder Press',
  bentoverrowbarbell: 'Barbell Row',
  bentoverrow: 'Barbell Row',
  bentoveronearmrowdumbbell: 'Dumbbell Row',
  dumbbellrow: 'Dumbbell Row',
  rowdumbbell: 'Dumbbell Row',
  chestflydumbbell: 'Dumbbell Fly',
  flydumbbell: 'Dumbbell Fly',
  chestflymachine: 'Machine Fly',
  butterflypecdeck: 'Pec Deck',
  pecdeckmachine: 'Pec Deck',
  chestflycable: 'Cable Fly',
  cablecrossover: 'Cable Crossover',
  skullcrusherbarbell: 'Skull Crusher',
  skullcrusherezbar: 'EZ-Bar Skull Crusher',
  skullcrusherdumbbell: 'Dumbbell Skull Crusher',
  lyingtricepsextensionbarbell: 'Skull Crusher',
  tricepspushdown: 'Triceps Pushdown',
  tricepspushdowncable: 'Triceps Pushdown',
  tricepspushdowncablestraightbar: 'Triceps Pushdown',
  triceppushdown: 'Triceps Pushdown',
  tricepsropepushdown: 'Rope Pushdown',
  tricepspushdownrope: 'Rope Pushdown',
  tricepspushdowncablerope: 'Rope Pushdown',
  tricepsextensioncable: 'Overhead Cable Extension',
  overheadtricepsextensioncable: 'Overhead Cable Extension',
  tricepsextensiondumbbell: 'Overhead Dumbbell Extension',
  overheadtricepsextensiondumbbell: 'Overhead Dumbbell Extension',
  tricepdip: 'Triceps Dip',
  tricepsdip: 'Triceps Dip',
  dip: 'Chest Dip',
  dips: 'Chest Dip',
  chestdip: 'Chest Dip',
  latpulldowncable: 'Lat Pulldown',
  latpulldownmachine: 'Lat Pulldown',
  seatedcablerow: 'Seated Cable Row',
  seatedrowcable: 'Seated Cable Row',
  seatedrowmachine: 'Machine Row',
  legcurllying: 'Lying Leg Curl',
  lyinglegcurlmachine: 'Lying Leg Curl',
  seatedlegcurlmachine: 'Seated Leg Curl',
  legextensionmachine: 'Leg Extension',
  legpress: 'Leg Press',
  legpressmachine: 'Leg Press',
  calfraisestanding: 'Standing Calf Raise',
  standingcalfraisemachine: 'Standing Calf Raise',
  calfraiseseated: 'Seated Calf Raise',
  seatedcalfraisemachine: 'Seated Calf Raise',
  hipthrustbarbell: 'Hip Thrust',
  gluteBridgebarbell: 'Glute Bridge',
  hipabductormachine: 'Hip Abduction Machine',
  hipabductionmachine: 'Hip Abduction Machine',
  hipadductormachine: 'Hip Adduction Machine',
  hipadductionmachine: 'Hip Adduction Machine',
  romaniandeadliftbarbell: 'Romanian Deadlift',
  stifflegdeadliftbarbell: 'Stiff-Leg Deadlift',
  shrugbarbell: 'Barbell Shrug',
  shrugdumbbell: 'Dumbbell Shrug',
  lateralraisedumbbell: 'Lateral Raise',
  frontraisedumbbell: 'Front Raise',
  reversefly: 'Rear Delt Fly',
  reverseflydumbbell: 'Rear Delt Fly',
  reverseflymachine: 'Reverse Pec Deck',
  rearDeltflydumbbell: 'Rear Delt Fly',
  facepullcable: 'Face Pull',
  crunch: 'Crunch',
  crunchmachine: 'Machine Crunch',
  cablecrunch: 'Cable Crunch',
  kneelingcablecrunch: 'Cable Crunch',
  hangingkneeraise: 'Hanging Knee Raise',
  hanginglegraise: 'Hanging Leg Raise',
  gobletsquatkettlebell: 'Goblet Squat',
  gobletsquatdumbbell: 'Goblet Squat',
  lungedumbbell: 'Forward Lunge',
  lungebarbell: 'Barbell Lunge',
  walkinglungedumbbell: 'Walking Lunge',
  bulgariansplitsquatdumbbell: 'Bulgarian Split Squat',
  kettlebellswing: 'Kettlebell Swing',
  plank: 'Plank',
  running: 'Running',
  runningtreadmill: 'Treadmill Run',
  treadmill: 'Treadmill Run',
  cycling: 'Outdoor Cycling',
  cyclingindoor: 'Stationary Bike',
  rowingmachine: 'Rowing Machine',
};
// Aliases are case-insensitive keys.
const ALIAS = new Map(Object.entries(ALIASES).map(([k, v]) => [k.toLowerCase(), v]));

/**
 * exercises (the store's library + custom list) → name → exercise | null.
 * Memoised per name, so a 30,000-row file costs one match per distinct name.
 */
export function makeMatcher(exercises) {
  const list = (exercises || []).filter((e) => e && e.name && e.id);
  const byNorm = new Map();
  const byKey = new Map();         // words(name) key → [ex]
  const byKeyEq = new Map();       // words(name + equipment) key → [ex]
  const byName = new Map();        // exact name → [ex]
  const push = (m, k, e) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(e)) m.get(k).push(e); };
  for (const e of list) {
    push(byNorm, norm(e.name), e);
    push(byName, e.name.toLowerCase(), e);
    push(byKey, keyOf(words(e.name)), e);
    push(byKeyEq, keyOf([...words(e.name), ...words(e.equipment)]), e);
  }
  const one = (arr) => (arr && arr.length === 1 ? arr[0] : null);
  const memo = new Map();

  return function match(raw) {
    const name = String(raw || '').trim();
    if (!name) return null;
    if (memo.has(name)) return memo.get(name);
    let hit = one(byNorm.get(norm(name)));
    if (!hit) {
      const alias = ALIAS.get(norm(name));
      if (alias) hit = one(byName.get(alias.toLowerCase()));
    }
    if (!hit) {
      // "Bench Press (Dumbbell)" / "Lat Pulldown - Wide Grip (Cable)"
      const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      const base = m ? m[1] : name;
      const equip = m ? m[2] : '';
      const all = keyOf([...words(base), ...words(equip)]);
      hit = one(byKey.get(all)) || one(byKeyEq.get(all));
      if (!hit && equip) {
        // The bare name, when the equipment says which one.
        const cands = byKey.get(keyOf(words(base))) || [];
        const ew = new Set(words(equip));
        hit = one(cands.filter((e) => words(e.equipment).some((w) => ew.has(w))));
      }
      if (!hit) hit = one(byKey.get(keyOf(words(base))));
    }
    memo.set(name, hit || null);
    return hit || null;
  };
}

/* ------------------------------------------------------------------ *
 * Rows → sessions
 * ------------------------------------------------------------------ */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The whole read. `opts`:
 *   exercises   — store.getExercises()
 *   picks       — { rawName: exerciseId | '' } the person's choices for unmatched names
 *   dateOrder   — 'dmy' | 'mdy' when the column needed asking
 *   weightUnit  — 'kg' | 'lb' when the header did not say
 *   distanceUnit — 'mi' | 'km' when the header did not say
 *   delimiter   — the file's, for decimal commas
 *   sourceName  — short label kept on each row as `importedFrom`
 *
 * Returns { sessions, needsWeightUnit, needsDistanceUnit, workouts, exercises, unmatched:[{name, sets}],
 *           problems:{undated, empty, implausible, skipped}, trimmed }.
 */
export function readLifting(records, format, opts = {}) {
  const { cols } = format;
  const delim = opts.delimiter || ',';
  const unitCol = cols.unit;
  const weightUnit = opts.weightUnit || format.weightUnit;
  const needsWeightUnit = Boolean(cols.weight) && !weightUnit && !unitCol;
  const problems = { undated: 0, empty: 0, implausible: 0, skipped: 0 };
  const match = makeMatcher(opts.exercises || []);
  const byId = new Map((opts.exercises || []).map((e) => [e.id, e]));
  const picks = opts.picks || {};
  const unmatched = new Map();       // raw name → set count
  const workouts = new Map();        // workout key → { date, time, name, entries: Map }
  const order = [];

  // ⚠️ Strong's classic "Distance" states no unit (it is the app's setting),
  // so it is ASKED like the weight — never dropped in silence, never guessed.
  // Only asked when some row really has a distance: an all-zero column is not
  // worth a question.
  const distanceUnit = opts.distanceUnit || format.distanceUnit;
  const needsDistanceUnit = Boolean(cols.distance) && !distanceUnit
    && records.some((r) => liftNumber(r[cols.distance], delim) > 0);
  const distMiles = (v) => {
    if (!(v > 0)) return null;
    if (distanceUnit === 'km') return v * 0.621371;
    if (distanceUnit === 'm') return v * 0.000621371;
    if (distanceUnit === 'mi') return v;
    return null;
  };

  for (const r of records) {
    const exName = String(r[cols.exercise] || '').trim();
    if (!exName) { problems.empty++; continue; }
    const kind = setKind(r, cols);
    if (kind === 'skip') { problems.skipped++; continue; }

    const rawDate = r[cols.date];
    const date = readDate(dateCell(rawDate), opts.dateOrder);
    if (!date || typeof date !== 'string') { problems.undated++; continue; }

    // Which exercise: the person's pick wins, then the matcher.
    let ex = null;
    if (Object.prototype.hasOwnProperty.call(picks, exName)) ex = picks[exName] ? byId.get(picks[exName]) || null : null;
    else ex = match(exName);
    if (!ex) {
      unmatched.set(exName, (unmatched.get(exName) || 0) + 1);
      continue;
    }

    // The set.
    const fields = Array.isArray(ex.fields) ? ex.fields : ['weight', 'reps'];
    const reps = cols.reps ? liftNumber(r[cols.reps], delim) : null;
    let w = cols.weight ? liftNumber(r[cols.weight], delim) : null;
    const secs = cols.seconds ? liftNumber(r[cols.seconds], delim) : null;
    const dist = cols.distance ? distMiles(liftNumber(r[cols.distance], delim)) : null;

    const rowUnit = unitCol ? (/kg|kilo/i.test(r[unitCol] || '') ? 'kg' : /lb|pound/i.test(r[unitCol] || '') ? 'lb' : null) : null;
    const unit = rowUnit || weightUnit;
    if (w != null && w < 0) {
      if (/^Assisted /.test(ex.name)) w = -w;
      else { problems.implausible++; continue; }
    }
    // ⚠️ With the unit unknown (needsWeightUnit) these rows are read as pounds
    // only so the preview can count them; the screen asks before any import.
    if (w != null && unit === 'kg') w *= LB_PER_KG;

    const set = {};
    if (fields.includes('reps')) {
      if (!(reps > 0)) { problems.empty++; continue; }
      if (reps > MAX_REPS) { problems.implausible++; continue; }
      set.reps = Math.round(reps);
    }
    if (fields.includes('weight')) {
      if (w != null && w > MAX_LB) { problems.implausible++; continue; }
      if (w != null) set.weight = round2(w);
      else if (fields.includes('reps')) set.weight = 0;
    }
    if (fields.includes('time') && secs > 0) set.time = Math.round(secs);
    if (fields.includes('distance') && dist > 0) set.distance = round2(dist);
    if (!Object.keys(set).length || (fields.includes('time') && !fields.includes('reps') && !set.time && !set.distance)) {
      problems.empty++; continue;
    }

    // The workout it belongs to.
    const wname = String((cols.workout && r[cols.workout]) || '').trim().slice(0, 80) || 'Imported workout';
    const time = timeOf(rawDate);
    const wkey = `${date}|${time}|${wname.toLowerCase()}`;
    let wk = workouts.get(wkey);
    if (!wk) {
      wk = { date, time, name: wname, entries: new Map() };
      workouts.set(wkey, wk);
      order.push(wkey);
    }
    let entry = wk.entries.get(ex.id);
    if (!entry) {
      entry = { exerciseId: ex.id, exerciseName: ex.name, sets: [] };
      wk.entries.set(ex.id, entry);
    }
    // A "Sets" count (a spreadsheet's 3 × 5) repeats the row, capped.
    const cnt = cols.setCount ? liftNumber(r[cols.setCount], delim) : null;
    const times = cnt >= 1 ? Math.min(MAX_SET_COUNT, Math.round(cnt)) : 1;
    const into = kind === 'warmup' ? (entry.warmups || (entry.warmups = []))
      : kind === 'drop' && entry.sets.length
        ? (entry.sets[entry.sets.length - 1].minis || (entry.sets[entry.sets.length - 1].minis = []))
        : entry.sets;
    for (let k = 0; k < times; k++) into.push(k ? { ...set } : set);
  }

  // Newest first, capped. A workout whose every set was a warm-up still counts:
  // it happened, and the calendar should show it.
  let keys = order.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const trimmed = Math.max(0, keys.length - MAX_WORKOUTS);
  if (trimmed) keys = keys.slice(0, MAX_WORKOUTS);

  const exIds = new Set();
  const sessions = keys.map((k) => {
    const wk = workouts.get(k);
    const entries = [...wk.entries.values()].map((e) => {
      exIds.add(e.exerciseId);
      const out = { exerciseId: e.exerciseId, exerciseName: e.exerciseName, sets: e.sets };
      if (e.warmups && e.warmups.length) out.warmups = e.warmups;
      return out;
    });
    const row = {
      id: importId('lift', [wk.date, wk.time, wk.name.toLowerCase()]),
      date: wk.date,
      workoutName: wk.name,
      isBenchmark: false,
      entries,
      importedFrom: opts.sourceName || 'file',
    };
    if (wk.time) row.startedAt = `${wk.date}T${wk.time}:00`;
    return row;
  });

  return {
    sessions,
    needsWeightUnit,
    needsDistanceUnit,
    workouts: sessions.length,
    exercises: exIds.size,
    unmatched: [...unmatched.entries()].map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name)),
    problems,
    trimmed,
  };
}

/** "312 workouts, 14 exercises, 3 unmatched" */
export function previewLine(read) {
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const bits = [n(read.workouts, 'workout', 'workouts'), n(read.exercises, 'exercise', 'exercises')];
  if (read.unmatched.length) bits.push(`${read.unmatched.length} unmatched`);
  return bits.join(', ');
}
