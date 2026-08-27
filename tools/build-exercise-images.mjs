// Regenerate the exercise-picture manifest from what is actually in
// img/exercises/, and keep sw.js's precache list in step with it.
//
//   node tools/build-exercise-images.mjs
//
// Run it after dropping picture files in. It rewrites two generated blocks and
// touches nothing else:
//   js/exercise-images.js   between BEGIN GENERATED / END GENERATED
//   sw.js                   between BEGIN EXERCISE IMAGES / END EXERCISE IMAGES
//
// ⚠️ WHY A TOOL RATHER THAN A HAND-KEPT LIST. A list of filenames maintained by
// hand drifts from the directory, and the drift is SILENT: a name typed wrong
// shows no picture, and "no picture" is the normal state of this feature, so
// nothing looks wrong. Same argument as `tools/build-body-art.py`, and the same
// discipline the sw precache test already enforces for js modules.
//
// ⚠️ IT REFUSES A FILE WHOSE NAME IS NOT AN EXERCISE ID rather than skipping it
// quietly. A picture that never appears because its filename was wrong is
// indistinguishable from a picture that was never bought, and telling those
// apart at 2am is not a thing anybody should have to do.
//
// File naming: <exerciseId>.<ext>, where the id is
// `slugify(name) + '--' + slugify(muscle)` from js/exercises.js.
// ⚠️ The muscle half matters — "Cable Kickback" exists for both Triceps and
// Glutes and the id is the only thing that separates them.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'img', 'exercises');
const ALLOWED = new Set(['webp', 'png', 'jpg', 'jpeg', 'svg', 'gif']);

const { BUILT_IN_EXERCISES } = await import(`file://${join(ROOT, 'js', 'exercises.js')}`);
const validIds = new Set(BUILT_IN_EXERCISES.map((e) => e.id));

if (!existsSync(DIR)) {
  mkdirSync(DIR, { recursive: true });
  console.log(`created ${DIR}`);
}

const files = readdirSync(DIR).filter((f) => !f.startsWith('.'));
const manifest = new Map();
const problems = [];

for (const f of files) {
  const dot = f.lastIndexOf('.');
  const id = dot < 0 ? f : f.slice(0, dot);
  const ext = dot < 0 ? '' : f.slice(dot + 1).toLowerCase();
  if (f === 'README.md') continue;
  if (!ALLOWED.has(ext)) { problems.push(`${f} — not an image extension`); continue; }
  if (!validIds.has(id)) {
    problems.push(`${f} — "${id}" is not an exercise id. It should be `
      + 'slugify(name) + "--" + slugify(muscle), e.g. barbell-bench-press--chest');
    continue;
  }
  if (manifest.has(id)) { problems.push(`${f} — a second file for ${id}`); continue; }
  manifest.set(id, ext);
}

if (problems.length) {
  console.error('\n⚠️  Files that were NOT added:\n');
  for (const p of problems) console.error('   ' + p);
  console.error('\nNothing was written. Fix the names and run again.\n');
  process.exit(1);
}

const ids = [...manifest.keys()].sort();

// ---- js/exercise-images.js -------------------------------------------------
const modPath = join(ROOT, 'js', 'exercise-images.js');
const body = ids.length
  ? ids.map((id) => `  '${id}': '${manifest.get(id)}',`).join('\n')
  : '';
writeBetween(modPath, '  // BEGIN GENERATED', '  // END GENERATED', body);

// ---- sw.js -----------------------------------------------------------------
const swPath = join(ROOT, 'sw.js');
const swBody = ids.length
  ? ids.map((id) => `  './img/exercises/${id}.${manifest.get(id)}',`).join('\n')
  : '';
writeBetween(swPath, '  // BEGIN EXERCISE IMAGES', '  // END EXERCISE IMAGES', swBody);

console.log(`${ids.length} exercise picture${ids.length === 1 ? '' : 's'} — `
  + `manifest and precache rewritten.`);
if (!ids.length) {
  console.log('(none yet: drop files into img/exercises/ named for the exercise id)');
}

function writeBetween(path, startMark, endMark, replacement) {
  const src = readFileSync(path, 'utf8');
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark);
  if (a < 0 || b < 0 || b < a) {
    console.error(`⚠️  markers not found in ${path} — nothing written there`);
    process.exit(1);
  }
  const head = src.slice(0, a + startMark.length);
  const tail = src.slice(b);
  const mid = replacement ? `\n${replacement}\n` : '\n';
  writeFileSync(path, head + mid + tail);
}
