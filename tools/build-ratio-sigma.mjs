// Regenerates js/ratio-sigma.js — how much each conversion ratio drifts across
// the published strength range. DEV-ONLY.
//
//   node tools/build-ratio-sigma.mjs
//
// docs/strength-accuracy-plan.md §6.4. Reads two files that are the transcribed
// source rather than anything derived:
//
//   tools/strength-level-data.mjs — every Strength Level row this project has
//     pulled, male at 180 lb and female at 140 lb, with the equipment notes that
//     decide whether a number is per dumbbell or a total. 🚨 IT LIVED IN A TEMP
//     SCRATCHPAD UNTIL 2026-09-15 and was nearly lost with the session that
//     pulled it; the ratio table cannot be re-derived without it.
//   tools/strength-level-map.mjs — which library exercise each page describes.
//     ⚠️ A name in here is a claim that the page and the exercise are the same
//     movement under the same load convention. Three entries are deliberately
//     ABSENT from the ratio corrections for exactly that reason (the single-leg
//     RDL, the sumo squat, the cable lateral raise) — see the refusals in
//     js/muscle-evidence.js before adding a row here.
//
// ⚠️ THE OUTPUT IS THE MEASURED HALF ONLY. The sourcing floor, machine gearing
// and the cross-muscle hop are added in `sigmaFor()`, because none of them can
// be seen in a published table — every row of a machine's page is the same
// population on the same machines.
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { SL } from './strength-level-data.mjs';
import { MAP } from './strength-level-map.mjs';

// ⚠️ Absolute because this reads the app's own modules to resolve load types;
// change it if the project moves.
const ROOT = 'C:/Users/timha/OneDrive/Desktop/my-website/Code Projects/Fitness_Tracker/js/';
const u = (f) => pathToFileURL(ROOT + f).href;
const { BUILT_IN_EXERCISES } = await import(u('exercises.js'));

const KEY = { Chest: 'bench-press', Back: 'bent-over-row', Quads: 'squat', Hamstrings: 'romanian-deadlift', Glutes: 'deadlift', Shoulders: 'shoulder-press', Biceps: 'barbell-curl', Triceps: 'close-grip-bench-press', Traps: 'barbell-shrug', Calves: 'machine-calf-raise', Forearms: 'wrist-curl', Core: 'cable-crunch' };
const BW = { m: 180, f: 140 };
const ex = (name) => BUILT_IN_EXERCISES.find((e) => e.name === name);

function totals(slug, sex, exercise) {
  const d = SL[slug]; const rows = d[sex]; if (!rows) return null;
  return rows.map((v) => {
    if (d.added) return BW[sex] * 1.0 + v;
    if (d.db && exercise.loadType === 'per_side') return v * 2;
    return v;
  });
}

const rows = [];
for (const [name, slug, muscle] of MAP) {
  const e = ex(name);
  if (!e || !SL[slug] || !SL[KEY[muscle]]) continue;
  const keyM = SL[KEY[muscle]].m, keyF = SL[KEY[muscle]].f;
  const tm = totals(slug, 'm', e), tf = totals(slug, 'f', e);
  if (!tm || !tf) continue;
  const rm = tm.map((v, i) => v / keyM[i]), rf = tf.map((v, i) => v / keyF[i]);
  const d = (r) => Math.abs(Math.log(r[3]) - Math.log(r[1])) / 1.68;
  rows.push({ name, drift: Number(((d(rm) + d(rf)) / 2).toFixed(3)) });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

const width = Math.max(...rows.map((r) => r.name.length)) + 3;
const body = rows.map((r) => {
  const key = (JSON.stringify(r.name) + ',').padEnd(width + 1);
  return `  [${key} ${r.drift.toFixed(3)}],`;
}).join('\n');

const out = `// HOW MUCH A CONVERSION RATIO DRIFTS ACROSS THE STRENGTH RANGE — GENERATED,
// never hand-edited. Regenerate with tools/build-ratio-sigma.mjs.
//
// docs/strength-accuracy-plan.md §6.4. \`q\` in js/muscle-evidence.js says
// "believe this much" and is a judgement; this is the half of it that has a
// derivation:
//
//     σ_drift = |ln r80 − ln r20| / 1.68
//
// where r20 and r80 are the exercise's ratio to its key lift at the novice
// (20th) and advanced (80th) rows of the published table, and 1.68 is the
// z-span between those two percentiles. A ratio that holds across the range is
// a fact about the movement; one that doubles from novice to advanced is
// telling you it depends on how strong the lifter is, and applying one number
// to everybody is exactly that uncertain.
//
// ⚠️ IT IS NOT THE WHOLE UNCERTAINTY, and \`sigmaFor()\` in muscle-evidence.js is
// where the rest is added: a sourcing floor, machine gearing (which no published
// table can see, because it varies by brand), and an extra hop for a
// cross-muscle stand-in. This file holds only the part that was measured.
//
// 🚨 THE DRIFT AND \`q\` AGREE ONLY LOOSELY — r = 0.63 over the 105 of these ${rows.length} that
// have a direct contribution today (q read as σ through the plan's bridge) — and
// the disagreements are the point. A machine curl is judged at q 0.35 for
// gearing and drifts 0.016, the flattest ratio in the file; a barbell reverse
// curl is judged at 0.40 and drifts 0.354, the widest. One of those is a
// suspicion about hardware and the other is a measurement.
//
// Derived from the same Strength Level pull as the ratios themselves
// (docs/history.md 2026-09-13 §C, re-derived 2026-09-15).
export const RATIO_DRIFT = new Map([
${body}
]);
`;
writeFileSync(new URL('../js/ratio-sigma.js', import.meta.url), out);
console.log('wrote', rows.length, 'entries');
console.log('min', Math.min(...rows.map((r) => r.drift)), 'max', Math.max(...rows.map((r) => r.drift)));
