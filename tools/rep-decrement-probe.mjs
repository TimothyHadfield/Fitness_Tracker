// The measurement that comes first — how THIS lifter's reps fall from set to set.
//
//   node tools/rep-decrement-probe.mjs <export.json>     a backup from Settings → Export
//   node tools/rep-decrement-probe.mjs demo              the demo year (describes demo.js, not a person)
//
// docs/strength-accuracy-plan.md §5.6: before any constant in js/rep-decrement.js reaches a
// caption, lay the owner's own history against the four rest columns. Owner sessions only, no
// benchmarks, straight sets only (no drops, myo-reps or supersets), the longest LEADING run of
// at least three sets at one load, reps[k] / reps[1]. The nearest column is the finding —
// "history sits on the ~2-min curve" — or "reps are flat: sets probably not to failure", which
// would re-prioritise §5.3.
//
// Then the two follow-ups: ORDER (the same exercise at the same load, fresh vs after three or
// more prior same-muscle sets, within 14 days) and FRESHNESS (set-1 reps against days since the
// last session that worked the same muscle directly).
//
// ⚠️ Prints. Writes nothing. Dev-only, never precached, never imported by the app.
//
// Confounds the reader should carry: a run ends at the first weight change, so pyramids and
// back-off sets drop out and machines and isolation work are over-represented; sessions before
// 2026-08-17 may hold drop sets nobody typed as drops; the app records no rest, so the column is
// inferred from the decrement, never measured.

import { readFileSync } from 'node:fs';
import { BUILT_IN_EXERCISES } from '../js/exercises.js';
import { familyOf } from '../js/exercise-families.js';
import { volumeContributions } from '../js/volume-map.js';
import { leadingRun, REST_COLUMNS, MIN_RUN, FLAT_R2 } from '../js/rep-decrement.js';

/* ---------- input ---------- */

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node tools/rep-decrement-probe.mjs <export.json | demo>');
  process.exit(2);
}

let data;
if (arg === 'demo') {
  const { buildDemoData } = await import('../js/demo.js');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  data = buildDemoData({ today });
  console.log(`DEMO YEAR as of ${today}.`);
  console.log('⚠️ These reps come from demo.js\'s state machine — set k loses k or k−1 reps, floored at the');
  console.log('   range bottom minus two — so every number below describes demo.js, not a person.\n');
} else {
  data = JSON.parse(readFileSync(arg, 'utf8'));
  if (!data || !Array.isArray(data.sessions)) {
    console.error('That file has no `sessions` array — is it a backup from Settings → Export?');
    process.exit(2);
  }
  console.log(`Backup exported ${data.exportedAt || '(no date)'}; ${data.sessions.length} owner sessions`
    + (Array.isArray(data.guestSessions) && data.guestSessions.length
      ? ` (${data.guestSessions.length} guest sessions ignored)` : '') + '.\n');
}

/* ---------- exercises, families, buckets ---------- */

const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
for (const c of Array.isArray(data.customExercises) ? data.customExercises : []) {
  if (c && c.id && !exMap.has(c.id)) exMap.set(c.id, c);
}

// Four buckets over exercise-families.js's movement patterns. A custom exercise has no family
// and falls to its muscle.
const FAMILY_BUCKET = {
  'press-flat': 'bench-like', 'press-incline': 'bench-like', 'press-decline': 'bench-like',
  'press-overhead': 'bench-like', 'triceps-press': 'bench-like',
  'squat': 'squat-like', 'lunge': 'squat-like', 'deadlift': 'squat-like',
  'hip-hinge': 'squat-like', 'hip-thrust': 'squat-like',
  'pull-vertical': 'pulldown-row', 'row': 'pulldown-row',
};
const MUSCLE_BUCKET = {
  Chest: 'bench-like', Shoulders: 'bench-like',
  Quads: 'squat-like', Hamstrings: 'squat-like', Glutes: 'squat-like',
  Back: 'pulldown-row',
};
function bucketOf(ex) {
  const fam = ex ? familyOf(ex) : null;
  if (fam) return FAMILY_BUCKET[fam.id] || 'isolation/other';
  return (ex && MUSCLE_BUCKET[ex.muscle]) || 'isolation/other';
}
function repBand(r1) {
  if (r1 <= 6) return '≤ 6 reps';
  if (r1 <= 10) return '7–10 reps';
  return '11–15 reps';
}

/* ---------- small statistics ---------- */

const sorted = (a) => [...a].filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
function quantile(a, q) {
  const s = sorted(a);
  if (!s.length) return null;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
const median = (a) => quantile(a, 0.5);
const mean = (a) => { const s = sorted(a); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const f2 = (x) => (x === null || x === undefined ? '  —  ' : x.toFixed(2));
const pct = (x) => (x === null || x === undefined ? ' — ' : `${Math.round(x * 100)} %`);
function medIqr(a) {
  const m = median(a);
  if (m === null) return '   —          ';
  return `${f2(m)} [${f2(quantile(a, 0.25))}–${f2(quantile(a, 0.75))}]`;
}

const dayNum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
};

/* ---------- 1. the runs ---------- */

const sessions = data.sessions
  .filter((s) => s && !s.isBenchmark && Array.isArray(s.entries) && dayNum(s.date) !== null)
  .sort((a, b) => dayNum(a.date) - dayNum(b.date));

const skipped = { benchmark: 0, superset: 0, nested: 0, short: 0 };
skipped.benchmark = data.sessions.filter((s) => s && s.isBenchmark).length;

const runs = [];
for (const s of sessions) {
  for (const e of s.entries) {
    if (!e) continue;
    if (e.group != null) { skipped.superset++; continue; }
    if (e.setType) { skipped.nested++; continue; }
    const run = leadingRun(e.sets);
    if (run.length < MIN_RUN) { skipped.short++; continue; }
    const ex = exMap.get(e.exerciseId);
    runs.push({
      exerciseId: e.exerciseId,
      name: e.exerciseName || (ex ? ex.name : e.exerciseId),
      bucket: bucketOf(ex),
      band: repBand(run[0]),
      date: s.date,
      r1: run[0],
      r2: run[1] / run[0],
      r3: run[2] / run[0],
      r4: run.length > 3 ? run[3] / run[0] : null,
      n: run.length,
    });
  }
}

console.log(`Sessions read: ${sessions.length}. Runs of ≥ ${MIN_RUN} sets at one load: ${runs.length}.`);
console.log(`Skipped — benchmark sessions ${skipped.benchmark}, superset entries ${skipped.superset}, `
  + `drop/myo entries ${skipped.nested}, entries whose leading run was shorter than ${MIN_RUN}: ${skipped.short}.\n`);

if (!runs.length) {
  console.log('Nothing to measure: no straight-set entry has three sets at one load with 1–15 reps each.');
  process.exit(0);
}

function summarise(label, rows) {
  const r2 = rows.map((r) => r.r2), r3 = rows.map((r) => r.r3), r4 = rows.map((r) => r.r4);
  const flat = rows.filter((r) => r.r2 >= FLAT_R2).length / rows.length;
  const steep = rows.filter((r) => r.r2 <= 0.6).length / rows.length;
  return `${label.padEnd(30)} n=${String(rows.length).padStart(4)}  r2 ${medIqr(r2)}  r3 ${medIqr(r3)}  `
    + `r4 ${medIqr(r4)}  flat ${pct(flat).padStart(5)}  r2≤0.6 ${pct(steep).padStart(5)}`;
}

console.log('median [IQR] of reps[k] / reps[1]; "flat" = set 2 held ≥ 95 % of set 1; "r2≤0.6" = set 2 lost 40 % or more\n');
console.log(summarise('POOLED', runs));

const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); }
  return m;
};

console.log('\nBy family');
for (const b of ['bench-like', 'squat-like', 'pulldown-row', 'isolation/other']) {
  const rows = runs.filter((r) => r.bucket === b);
  if (rows.length) console.log(summarise('  ' + b, rows));
}
console.log('\nBy set-1 reps');
for (const b of ['≤ 6 reps', '7–10 reps', '11–15 reps']) {
  const rows = runs.filter((r) => r.band === b);
  if (rows.length) console.log(summarise('  ' + b, rows));
}
console.log('\nBy exercise (runs ≥ 3)');
const byEx = [...groupBy(runs, 'name').entries()].sort((a, b) => b[1].length - a[1].length);
for (const [name, rows] of byEx) if (rows.length >= 3) console.log(summarise('  ' + name, rows));

/* ---------- the verdict ---------- */

const m2 = median(runs.map((r) => r.r2));
const m3 = median(runs.map((r) => r.r3));
const m4 = median(runs.map((r) => r.r4));
const flatShare = runs.filter((r) => r.r2 >= FLAT_R2).length / runs.length;

const NAME = { 60: '1-min', 120: '2-min', 180: '3-min', 300: '5-min' };
console.log('\nThe four columns (set 2 / set 3 / set 4 as a fraction of set 1), and how far the pooled medians sit from each:');
let nearest = null;
for (const [rest, col] of Object.entries(REST_COLUMNS)) {
  let d = Math.abs(m2 - col[1]) + Math.abs(m3 - col[2]);
  let k = 2;
  if (m4 !== null) { d += Math.abs(m4 - col[3]); k = 3; }
  const dist = d / k;
  if (!nearest || dist < nearest.dist) nearest = { rest, dist };
  console.log(`  ${NAME[rest].padEnd(6)} ${col.slice(1).map(f2).join(' / ')}   distance ${dist.toFixed(3)}`);
}
console.log(`  history ${m2 === null ? '—' : f2(m2)} / ${f2(m3)} / ${f2(m4)}`);

let verdict;
if (flatShare >= 0.5 || m2 >= FLAT_R2) {
  verdict = `reps are flat: sets probably not to failure (${pct(flatShare)} of runs hold set 1's reps into set 2)`;
} else if (m2 > REST_COLUMNS[300][1]) {
  verdict = `history sits above the 5-min curve — long rests, or sets short of failure (nearest column ${NAME[nearest.rest]})`;
} else {
  verdict = `history sits on the ~${NAME[nearest.rest]} curve`;
}
console.log(`\nVERDICT: ${verdict}`);

/* ---------- 2. order — fresh vs after prior same-muscle work ---------- */

// Set-1 reps for every straight entry, with the same-muscle work already done before it in the
// session — counted the way strength-observations.js counts it (direct 1.0, indirect 0.5, an
// exercise's own sets added AFTER it is recorded).
const firsts = [];
for (const s of sessions) {
  const prior = new Map();
  for (const e of s.entries) {
    if (!e) continue;
    const ex = exMap.get(e.exerciseId);
    const sets = Array.isArray(e.sets) ? e.sets : [];
    if (e.group == null && !e.setType) {
      const run = leadingRun(sets);
      if (run.length && ex) {
        const w = Number(sets[0] && sets[0].weight);
        firsts.push({
          key: `${e.exerciseId}@${Number.isFinite(w) ? w : 0}`,
          exerciseId: e.exerciseId, muscle: ex.muscle, name: ex.name,
          day: dayNum(s.date), r1: run[0],
          prior: prior.get(ex.muscle) || 0,
        });
      }
    }
    if (!ex) continue;
    for (const c of volumeContributions(ex)) {
      prior.set(c.muscle, (prior.get(c.muscle) || 0) + sets.length * c.weight);
    }
  }
}

console.log('\n\nORDER — the same exercise at the same load, first set fresh (no prior same-muscle sets) vs after ≥ 3, within 14 days');
const fresh = firsts.filter((f) => f.prior === 0);
const tired = firsts.filter((f) => f.prior >= 3);
console.log(`  first sets: ${firsts.length} · fresh ${fresh.length} · after ≥ 3 prior sets ${tired.length}`);
const pairs = [];
for (const t of tired) {
  let best = null;
  for (const f of fresh) {
    if (f.key !== t.key) continue;
    const gap = Math.abs(f.day - t.day);
    if (gap > 14) continue;
    if (!best || gap < best.gap) best = { gap, f };
  }
  if (best) pairs.push({ name: t.name, ratio: t.r1 / best.f.r1, tired: t.r1, fresh: best.f.r1 });
}
if (!pairs.length) {
  console.log('  no pairs: nothing here was done both fresh and after prior same-muscle work at one load within 14 days');
} else {
  const ratios = pairs.map((p) => p.ratio);
  console.log(`  ${pairs.length} pairs · tired / fresh set-1 reps median ${medIqr(ratios)} · fewer reps when tired in `
    + `${pct(pairs.filter((p) => p.ratio < 1).length / pairs.length)}, more in ${pct(pairs.filter((p) => p.ratio > 1).length / pairs.length)}`);
  const byName = groupBy(pairs, 'name');
  for (const [name, rows] of [...byName.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
    console.log(`    ${name.padEnd(30)} n=${String(rows.length).padStart(3)}  ratio ${medIqr(rows.map((r) => r.ratio))}`);
  }
}

/* ---------- 3. freshness — set-1 reps vs days since the muscle was last worked ---------- */

// Days with direct work on each muscle, from every entry (supersets and drops included: they
// are training whatever their shape).
const workDays = new Map();
for (const s of sessions) {
  const d = dayNum(s.date);
  for (const e of s.entries) {
    const ex = e && exMap.get(e.exerciseId);
    if (!ex || !Array.isArray(e.sets) || !e.sets.length) continue;
    for (const c of volumeContributions(ex)) {
      if (c.kind !== 'direct') continue;
      if (!workDays.has(c.muscle)) workDays.set(c.muscle, new Set());
      workDays.get(c.muscle).add(d);
    }
  }
}
const sortedDays = new Map([...workDays].map(([m, set]) => [m, [...set].sort((a, b) => a - b)]));

// Set-1 reps controlled for load: the residual against the mean set-1 reps of the same exercise
// at the same weight across the whole history.
const groupMean = new Map();
for (const [key, rows] of groupBy(firsts, 'key')) groupMean.set(key, mean(rows.map((r) => r.r1)));

const BANDS = [
  ['1 day', (d) => d === 1], ['2 days', (d) => d === 2], ['3–4 days', (d) => d >= 3 && d <= 4],
  ['5–7 days', (d) => d >= 5 && d <= 7], ['8–14 days', (d) => d >= 8 && d <= 14], ['15+ days', (d) => d >= 15],
];
const byBand = new Map(BANDS.map(([label]) => [label, []]));
let firstEver = 0;
for (const f of firsts) {
  const days = sortedDays.get(f.muscle) || [];
  let last = null;
  for (const d of days) { if (d < f.day) last = d; else break; }
  if (last === null) { firstEver++; continue; }
  const gap = f.day - last;
  const band = BANDS.find(([, test]) => test(gap));
  if (band) byBand.get(band[0]).push(f.r1 - groupMean.get(f.key));
}

console.log('\n\nFRESHNESS — set-1 reps minus the mean for that exercise at that load, by days since the muscle was last trained directly');
for (const [label, resid] of byBand) {
  if (!resid.length) { console.log(`  ${label.padEnd(10)} n=   0`); continue; }
  console.log(`  ${label.padEnd(10)} n=${String(resid.length).padStart(4)}  mean ${(mean(resid) >= 0 ? '+' : '') + mean(resid).toFixed(2)} reps`
    + `  median ${(median(resid) >= 0 ? '+' : '') + median(resid).toFixed(2)}`);
}
if (firstEver) console.log(`  (${firstEver} first sets had no earlier same-muscle session and are not banded)`);
console.log('\n⚠️ Residuals are within-history, so a lifter who always trains on the same rhythm shows nothing here — that is the finding, not a fault.');
