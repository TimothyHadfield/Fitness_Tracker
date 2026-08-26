// Reading a file somebody exported from another app — pure, no DOM, no network.
//
// docs/integrations-plan.md §5: this is Phase 1, and it is the whole reason
// there IS a Phase 1. Every service Tim named (Strava, Cronometer, MacroFactor,
// Apple Health, the wearables) lets its own user export their data, and reading
// a file the user chose and handed over needs no OAuth, no client secret, no
// server, no paid tier and no partner approval. It is also the only one of
// those paths that breaks nobody's terms.
//
// ⚠️ WHAT THIS MODULE HAS NEVER SEEN: a real export file from any of those
// services. The column names below come from published documentation and
// community reports, not from a file this project has parsed. That is exactly
// why nothing here guesses — every importer detects its columns by name, hands
// back what it found, and the screen makes the user confirm a preview before a
// single row is written. A tolerant reader plus a confirmation is honest; a
// hard-coded schema claiming to be "the Strava importer" would not be.
//
// ⚠️ AND WHY RE-IMPORTING THE SAME FILE IS THE REAL PROBLEM, not parsing.
// Somebody exports monthly and drags the file in; the overlap must not double
// their training. Every row gets a DETERMINISTIC id derived from its own
// content, so a second import of the same row is an upsert of the same id
// rather than a new session. See importId().

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/**
 * A real CSV reader, because these files contain commas inside quotes —
 * "Morning Run, easy" is one field and splitting on ',' makes it two and
 * shifts every column after it. Handles quoted fields, escaped quotes (""),
 * CRLF, and a leading BOM (Excel writes one and it corrupts the first header).
 */
export function parseCSV(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  row.push(field);
  rows.push(row);

  // A trailing newline produces one empty row; so does a blank line anywhere.
  return rows.filter((r) => r.length > 1 || (r[0] !== undefined && r[0].trim() !== ''));
}

/** Header row + body → array of objects keyed by the (trimmed) header. */
export function toRecords(rows) {
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h || '').trim());
  const records = rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, n) => { o[h] = r[n] === undefined ? '' : String(r[n]).trim(); });
    return o;
  });
  return { headers, records };
}

/* ------------------------------------------------------------------ *
 * Finding the columns
 * ------------------------------------------------------------------ */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Column aliases, widest-net first. These are matched on a normalised header,
 * so "Activity Date", "activity_date" and "ACTIVITY DATE" are one thing.
 *
 * ⚠️ ORDER MATTERS INSIDE EACH LIST — the first header that matches wins, so
 * the most specific alias goes first. "Elapsed Time" and "Moving Time" both
 * exist in a Strava export and they are different numbers; moving time is the
 * one a pace should be computed from, so it is named first.
 */
const ALIASES = {
  date: ['activitydate', 'date', 'startdate', 'datelocal', 'startdatelocal', 'day', 'time', 'datetime'],
  name: ['activityname', 'activitytype', 'name', 'title', 'type', 'exercise', 'workout', 'sport'],
  distance: ['distance', 'distancemi', 'distancekm', 'distancemeters', 'distancem'],
  duration: ['movingtime', 'elapsedtime', 'duration', 'time', 'totaltime', 'durationseconds'],
  weight: ['weight', 'weightlb', 'weightlbs', 'weightkg', 'bodyweight', 'scaleweight', 'mass'],
};

/**
 * headers -> { field: headerName }. Only what is actually present; a caller
 * decides whether what it found is enough to do anything with.
 */
export function detectColumns(headers) {
  const found = {};
  const seen = new Set();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const hit = headers.find((h) => norm(h) === alias && !seen.has(h));
      if (hit) { found[field] = hit; seen.add(hit); break; }
    }
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * Dates — where the silent errors live
 * ------------------------------------------------------------------ */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * One cell -> a local YYYY-MM-DD, or null.
 *
 * ⚠️ THE SLASH FORMATS ARE DELIBERATELY REFUSED HERE AND RESOLVED BY THE
 * CALLER, because 03/04/2026 is the 3rd of April to most of the world and the
 * 4th of March in the United States, and NOTHING in the cell says which. A
 * guess is wrong half the time and silently — the reading would just be on the
 * wrong day forever. `readDate` therefore reports an ambiguous cell rather
 * than resolving it, and dateOrderOf() below settles it from the WHOLE column
 * when the column contains enough evidence to.
 */
export function readDate(cell, order) {
  const s = String(cell || '').trim();
  if (!s) return null;

  // ISO, with or without a time. Unambiguous, and what most exports use.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "Aug 26, 2026, 10:17:33 AM" / "26 Aug 2026" — the month is a word, so the
  // day and month cannot be confused whatever order they come in.
  const named = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/)
    || s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (named) {
    const monthWord = /^[A-Za-z]/.test(named[1]) ? named[1] : named[2];
    const dayNum = /^[A-Za-z]/.test(named[1]) ? named[2] : named[1];
    const m = MONTHS.indexOf(monthWord.slice(0, 3).toLowerCase());
    if (m >= 0) return `${named[3]}-${pad(m + 1)}-${pad(Number(dayNum))}`;
  }

  // Numeric slashes or dots. Needs the column's decided order.
  const parts = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (parts) {
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    if (a > 12 && b <= 12) return `${parts[3]}-${pad(b)}-${pad(a)}`;   // must be D/M
    if (b > 12 && a <= 12) return `${parts[3]}-${pad(a)}-${pad(b)}`;   // must be M/D
    if (order === 'dmy') return `${parts[3]}-${pad(b)}-${pad(a)}`;
    if (order === 'mdy') return `${parts[3]}-${pad(a)}-${pad(b)}`;
    return { ambiguous: true };                    // caller must decide
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Read the WHOLE column and decide whether its slash dates can be resolved
 * without asking. One cell with a first number above 12 settles the order for
 * every cell in the column, which is usually available in a real export and
 * costs the user nothing.
 *
 * Returns 'dmy', 'mdy', 'none' (no slash dates at all) or 'ambiguous'.
 */
export function dateOrderOf(cells) {
  let sawSlash = false;
  for (const cell of cells) {
    const m = String(cell || '').trim().match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
    if (!m) continue;
    sawSlash = true;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) return 'dmy';
    if (b > 12 && a <= 12) return 'mdy';
  }
  return sawSlash ? 'ambiguous' : 'none';
}

/* ------------------------------------------------------------------ *
 * Numbers and units
 * ------------------------------------------------------------------ */

export function readNumber(cell) {
  if (cell === null || cell === undefined) return null;
  // Strip thousands separators and any unit suffix the export wrote inline.
  const s = String(cell).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!s) return null;
  const n = Number(s[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * A duration cell -> seconds. Exports write these three ways and they are not
 * distinguishable by magnitude alone, so the shape decides: "1:23:45" and
 * "23:45" are clocks, a bare number is seconds unless the header said minutes.
 */
export function readDuration(cell, unit) {
  const s = String(cell || '').trim();
  if (!s) return null;
  const clock = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    return clock[3] !== undefined
      ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
      : Number(clock[1]) * 60 + Number(clock[2]);
  }
  const n = readNumber(s);
  if (n === null) return null;
  return unit === 'minutes' ? n * 60 : n;
}

/** Which unit a distance column is in, read from its own header. */
export function distanceUnitOf(header) {
  const h = norm(header);
  if (h.includes('km') || h.includes('kilomet')) return 'km';
  if (h.includes('meter') || h.includes('metre') || /distancem$/.test(h)) return 'm';
  if (h.includes('mi')) return 'mi';
  return null;
}

/** Which unit a duration column is in. */
export function durationUnitOf(header) {
  const h = norm(header);
  if (h.includes('minute') || h.endsWith('min')) return 'minutes';
  return 'seconds';
}

/** Which unit a weight column is in. */
export function weightUnitOf(header) {
  const h = norm(header);
  if (h.includes('kg') || h.includes('kilo')) return 'kg';
  if (h.includes('lb') || h.includes('pound')) return 'lb';
  return null;
}

const MI_PER_KM = 0.621371;
const MI_PER_M = 0.000621371;
export const LB_PER_KG = 2.2046226218;

export function toMiles(value, unit) {
  if (value === null) return null;
  if (unit === 'km') return value * MI_PER_KM;
  if (unit === 'm') return value * MI_PER_M;
  return value;                                   // already miles, or unknown
}

/* ------------------------------------------------------------------ *
 * Deterministic ids — what makes a re-import safe
 * ------------------------------------------------------------------ */

/**
 * FNV-1a over the row's own identifying content. Deterministic, dependency
 * free, and stable across sessions and devices — which is the whole point: the
 * SAME row in the SAME file must produce the SAME id in six months, or a
 * monthly exporter accumulates duplicate training every time they import.
 *
 * ⚠️ Prefixed `imp_` so an imported row is identifiable in a backup and can be
 * told apart from something typed in the app. That matters because a future
 * "undo this import" has to know what it may delete.
 */
export function importId(kind, parts) {
  const key = [kind, ...parts.map((p) => String(p == null ? '' : p))].join('');
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // A second pass over the reversed string, so two different rows need TWO
  // collisions rather than one. 64 bits of key space for a few hundred rows.
  let g = 0x811c9dc5;
  for (let i = key.length - 1; i >= 0; i--) {
    g ^= key.charCodeAt(i);
    g = Math.imul(g, 0x01000193) >>> 0;
  }
  return `imp_${kind}_${h.toString(36)}${g.toString(36)}`;
}

/* ------------------------------------------------------------------ *
 * The two importers
 * ------------------------------------------------------------------ */

/**
 * Activity rows -> sessions in this app's own shape.
 *
 * ⚠️ AN IMPORTED ACTIVITY IS EXACTLY WHAT THE QUICK LOG WRITES — one entry,
 * one set, no workoutId — so it lands on the calendar, in the feed, in backups
 * and against the cloud ceiling through machinery that already exists, and the
 * muscle map and ratings never see it. D27, unchanged and unweakened: this
 * adds a door, not a model.
 */
export function readActivities(records, cols, opts = {}) {
  const order = opts.dateOrder;
  const durUnit = opts.durationUnit || durationUnitOf(cols.duration);
  const out = [];
  const problems = { undated: 0, empty: 0 };

  /* ⚠️ THE DISTANCE UNIT IS ASKED FOR, NEVER ASSUMED — and this was a real bug,
   * caught by driving a Strava-shaped file through the screen on 2026-08-27.
   * A bare "Distance" header used to fall back to miles, and Strava's export
   * writes KILOMETRES: a 5.02 km run imported as a 5.02 mile run, 61 % long,
   * silently, forever. It is the same hazard the weight column already had
   * priced — the difference was that only one of the two had been thought
   * about, which is exactly how a class of bug survives being "handled".
   * `null` means REFUSE and ask; it never means "probably miles". */
  const distUnit = opts.distanceUnit || distanceUnitOf(cols.distance);
  if (cols.distance && !distUnit) {
    return { rows: [], problems, needsDistanceUnit: true };
  }

  for (const r of records) {
    const date = cols.date ? readDate(r[cols.date], order) : null;
    if (!date || typeof date !== 'string') { problems.undated++; continue; }

    const name = (cols.name && r[cols.name]) ? String(r[cols.name]).trim().slice(0, 80) : 'Activity';
    const miles = cols.distance ? toMiles(readNumber(r[cols.distance]), distUnit) : null;
    const seconds = cols.duration ? readDuration(r[cols.duration], durUnit) : null;

    // A row with neither a distance nor a time records nothing. Importing it
    // would put an empty session on somebody's calendar.
    if (!(miles > 0) && !(seconds > 0)) { problems.empty++; continue; }

    const set = {};
    if (seconds > 0) set.time = Math.round(seconds);
    if (miles > 0) set.distance = Math.round(miles * 100) / 100;

    out.push({
      id: importId('act', [date, name, set.time || '', set.distance || '']),
      date,
      workoutName: name,
      entries: [{ exerciseName: name, sets: [set] }],
      importedFrom: opts.sourceName || 'file',
    });
  }
  return { rows: out, problems };
}

/**
 * Weight rows -> weigh-ins, stored in POUNDS like everything else in this app.
 *
 * ⚠️ THE UNIT IS THE WHOLE RISK HERE. A kg column read as pounds turns a 75 kg
 * person into a 75 lb one, which is not a rounding error — it is a body weight
 * that would rewrite every pull-up they have ever logged. So the unit is never
 * inferred from the magnitude: it comes from the header, or from the caller
 * having asked. `null` unit means REFUSE, not guess.
 */
export function readWeights(records, cols, opts = {}) {
  const order = opts.dateOrder;
  const unit = opts.weightUnit || weightUnitOf(cols.weight);
  const out = [];
  const problems = { undated: 0, empty: 0, implausible: 0 };
  if (!unit) return { rows: [], problems, needsUnit: true };

  for (const r of records) {
    const date = cols.date ? readDate(r[cols.date], order) : null;
    if (!date || typeof date !== 'string') { problems.undated++; continue; }
    const raw = cols.weight ? readNumber(r[cols.weight]) : null;
    if (!(raw > 0)) { problems.empty++; continue; }

    const lb = unit === 'kg' ? raw * LB_PER_KG : raw;
    // A sanity gate, not a schema. Nothing between 40 and 800 lb is refused;
    // outside that the row is a unit mix-up or a typo, and importing it would
    // move the muscle map for every bodyweight lift on that date.
    if (lb < 40 || lb > 800) { problems.implausible++; continue; }

    out.push({
      id: importId('bw', [date, Math.round(lb * 100)]),
      date,
      weight: Math.round(lb * 100) / 100,
      importedFrom: opts.sourceName || 'file',
    });
  }
  return { rows: out, problems };
}

/**
 * What an import would actually do, against what is already there.
 *
 * ⚠️ THE CONFIRMATION HAS TO BE ABLE TO SAY THIS. "Import 214 activities" is
 * not what happens when 190 of them are already on the calendar, and somebody
 * who is told the wrong number learns not to read the sheet.
 */
export function planImport(rows, existing, keyOf) {
  const have = new Set((existing || []).map((r) => r.id));
  const dayOf = new Set((existing || []).map(keyOf).filter(Boolean));
  const fresh = [];
  let repeat = 0;
  let collides = 0;
  for (const row of rows) {
    if (have.has(row.id)) { repeat++; continue; }
    // Same day and same name as something already recorded, but not the same
    // id — most likely the user logged it by hand and is now importing it too.
    // Counted and reported rather than dropped: it is their call.
    if (dayOf.has(keyOf(row))) collides++;
    fresh.push(row);
  }
  return { fresh, repeat, collides, total: rows.length };
}
