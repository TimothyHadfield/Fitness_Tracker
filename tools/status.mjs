/* ------------------------------------------------------------------ *
 * WHAT IS ACTUALLY TRUE ABOUT THIS REPO, RIGHT NOW — 2026-09-21.
 *
 * Dev-only. Writes nothing, changes nothing, needs no dependencies.
 *
 *   node tools/status.mjs            inventory only, about a second
 *   node tools/status.mjs --run      also runs the suites and counts them
 *
 * ------------------------------------------------------------------
 * 🚨 WHY THIS EXISTS. Every fact it prints used to be a hand-maintained
 * sentence in `progress.md`, and every one of them has been WRONG at some
 * point — usually for weeks, always invisibly:
 *
 *   · "seventeen suites" was wrong for weeks. `core-rating` and `feedback`
 *     shipped on 2026-09-04, were never added to the list, and so were missing
 *     from every total quoted afterwards.
 *   · "all twenty green" has been reported off a run that skipped the two
 *     suites needing Chrome and the emulator.
 *   · "the working tree is clean" was in the notes on 2026-09-21 while five
 *     files of unfinished work sat uncommitted in it.
 *   · The Data tab's segment count was wrong for six days, and the row that
 *     was wrong sat directly above a row explaining that a row contradicting
 *     the code is a bug in the file.
 *
 * The pattern is always the same and it is the pattern this project already
 * knows: a hand-maintained fact about the repo looks perfect from inside the
 * session that broke it. The precache list and the collection list are both
 * TESTS for exactly that reason. This is the same fix for the facts that are
 * reported rather than asserted — a number that is printed cannot be stale,
 * because nobody is maintaining it.
 *
 * 🛑 SO DO NOT COPY ITS OUTPUT INTO A DOCUMENT. That would recreate the
 * problem it exists to remove. Documents say what is TRUE REGARDLESS —
 * decisions, refusals, reasoning. Counts are run, not written down.
 *
 * ⚠️ IT REPORTS RATHER THAN JUDGES. Nothing here fails a build. The budgets
 * are owned by `tests/data-layer.test.mjs`, and they are PARSED from that file
 * rather than repeated here, because a second copy of a threshold is the exact
 * fault this tool is about. If the parse ever stops matching, this says so
 * loudly instead of printing a confident wrong number (§0.18: a measurement
 * that never reached the thing it measures reports the same green as a pass).
 * ------------------------------------------------------------------ */

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;
const RUN = process.argv.includes('--run');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const heading = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const line = (a, b) => console.log(`  ${String(a).padEnd(34)}${b}`);

/* ---------------------------------------------------------------- *
 * THE DOCUMENTS A SESSION IS TOLD TO READ
 *
 * ⚠️ The budgets live in the test, not here. Parsing them keeps one source of
 * truth; failing loudly on a parse miss keeps this honest.
 * ---------------------------------------------------------------- */
function docs() {
  heading('Documents read at the start of a session');

  const test = read('tests/data-layer.test.mjs');
  const block = test.match(/const READ_WHOLE = \[([\s\S]*?)\n  \];/);
  const budgets = new Map();
  if (block) {
    for (const m of block[1].matchAll(/\['([^']+)',\s*(\d+)\s*\*\s*KB/g)) {
      budgets.set(m[1], Number(m[2]) * KB);
    }
  }
  if (!budgets.size) {
    console.log('  ⚠️  COULD NOT PARSE THE BUDGETS out of tests/data-layer.test.mjs.');
    console.log('     The test still enforces them; this tool just cannot show them.');
    console.log('     Fix the parse above rather than hard-coding numbers here.');
  }

  for (const [rel, budget] of budgets) {
    const kb = statSync(join(ROOT, rel)).size / KB;
    const pct = Math.round((kb / (budget / KB)) * 100);
    const bar = pct >= 95 ? '🛑' : pct >= 80 ? '⚠️ ' : '  ';
    line(rel, `${bar} ${kb.toFixed(0)} KB of ${budget / KB} KB  (${pct}%)`);
  }

  /* The archives are deliberately unbudgeted — grep for a date, read that
     range, never read them whole. Printed so their growth is at least visible. */
  for (const rel of ['docs/history.md', 'docs/chat-archive.md']) {
    if (!existsSync(join(ROOT, rel))) continue;
    line(rel, `   ${(statSync(join(ROOT, rel)).size / KB).toFixed(0)} KB  (archive, no budget)`);
  }
}

/* ---------------------------------------------------------------- *
 * THE WORKING TREE
 *
 * 🚨 THIS IS THE CHECK THAT WOULD HAVE CAUGHT 2026-09-20's LEFTOVERS. The notes
 * said nothing was half-built; five files of unfinished work were sitting in
 * the tree, and 470 KB of prose could not see them. One command could.
 *
 * ⚠️ `Fitness_Research/` is another agent's folder and is ALWAYS dirty. That is
 * its normal state, it is not half-built work of ours, and it is counted
 * separately here so it can never be mistaken for ours — the same reason the
 * standing instruction says to stage by name and never `git add -A`.
 * ---------------------------------------------------------------- */
function tree() {
  heading('Working tree');

  const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const status = git('status', '--porcelain');
  if (status.status !== 0) { line('git', 'unavailable'); return; }

  const rows = status.stdout.split('\n').filter(Boolean);
  const theirs = rows.filter((r) => r.slice(3).replace(/^"/, '').startsWith('Fitness_Research/'));
  const ours = rows.filter((r) => !theirs.includes(r));

  line('ours, uncommitted', ours.length ? `🛑 ${ours.length} file(s)` : '✅ clean');
  for (const r of ours) console.log(`      ${r}`);
  line('Fitness_Research/', `${theirs.length} file(s) — the other agent's, ignore`);

  const head = git('log', '-1', '--format=%h %s').stdout.trim();
  line('HEAD', head);
  /* ⚠️ HEAD is not necessarily ours: the research agent commits from this same
     checkout, so between two of our pushes its commits land here too. */

  const ahead = git('rev-list', '--count', '@{u}..HEAD');
  const behind = git('rev-list', '--count', 'HEAD..@{u}');
  if (ahead.status === 0 && behind.status === 0) {
    line('vs origin', `${ahead.stdout.trim()} ahead, ${behind.stdout.trim()} behind`);
  }
}

/* ---------------------------------------------------------------- *
 * MODULES, PRECACHE AND ROUTES
 *
 * ⚠️ "No dead modules" is a claim with a DATE on it in the handbook, not a
 * standing guarantee. This recomputes it, so the claim can be re-checked in a
 * second instead of being trusted for months.
 * ---------------------------------------------------------------- */
function code() {
  heading('Modules');

  const mods = readdirSync(join(ROOT, 'js')).filter((f) => f.endsWith('.js')).sort();
  const sw = read('sw.js');

  /* The precache has its own test; this only reports, so the two cannot
     disagree about whose job it is to fail. */
  const missing = mods.filter((m) => !sw.includes(`js/${m}`));

  /* Imported-by-anything. Cheap and good enough: a module nothing names is
     certainly dead; one that is named might still be reachable only from dead
     code, which no grep can settle. Reported as a lead, never as a verdict. */
  const all = [...mods.map((m) => ['js', m]), ...readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.mjs')).map((f) => ['tests', f])]
    .map(([d, f]) => read(`${d}/${f}`)).join('\n');
  const unreferenced = mods.filter((m) => {
    const stem = basename(m, '.js');
    /* its own file names it once — require a mention somewhere else */
    const hits = all.split(new RegExp(`['"./]${stem}\\.js`)).length - 1;
    return hits === 0;
  });

  line('js/ modules', mods.length);
  line('missing from sw.js precache', missing.length ? `🛑 ${missing.join(', ')}` : '✅ none');
  line('named by nothing else', unreferenced.length ? `⚠️  ${unreferenced.join(', ')}` : '✅ none');

  const app = read('js/app.js');
  const routes = [...app.matchAll(/^\s*case '([a-z]+)':/gm)].map((m) => m[1]);
  line('routes in app.js', `${routes.length}  (${routes.join(' ')})`);

  const exercises = read('js/exercises.js');
  const count = (exercises.match(/^\s*\{\s*id:\s*'/gm) || []).length;
  if (count) line('exercises in the library', count);
}

/* ---------------------------------------------------------------- *
 * THE SUITES
 *
 * 🚨 A SUITE THAT DID NOT RUN IS NOT A SUITE THAT PASSED, and reporting the two
 * the same way is how "all twenty green" got said off a run that skipped four.
 * Anything producing no PASS lines is reported as DID NOT RUN, with its reason,
 * and is never folded into the total.
 * ---------------------------------------------------------------- */
function suites() {
  const files = readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort();

  heading(`Suites (${files.length} files)`);
  if (!RUN) {
    for (const f of files) line(f, '');
    console.log('\n  (pass --run to execute them and count assertions)');
    return;
  }

  let pass = 0, fail = 0, skipped = 0;
  for (const f of files) {
    const r = spawnSync(process.execPath, [join('tests', f)], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const p = (out.match(/^PASS/gm) || []).length;
    const q = (out.match(/^FAIL/gm) || []).length;

    if (p + q === 0) {
      /* Name WHY, because "0 assertions" and "0 failures" look identical in a
         summary and only one of them is good news. */
      const why = /Cannot find package|ERR_MODULE_NOT_FOUND/.test(out) ? 'needs npm i --no-save …'
        : /ECONNREFUSED|emulator|FIRESTORE_EMULATOR/.test(out) ? 'needs the Firestore emulator'
        : /chrome|Chrome|browser/.test(out) ? 'needs Chrome'
        : `exit ${r.status}`;
      line(f, `⚠️  DID NOT RUN — ${why}`);
      skipped++;
      continue;
    }
    pass += p; fail += q;
    line(f, `${q ? '🛑' : '✅'} ${p} pass${q ? `, ${q} FAIL` : ''}`);
  }

  heading('Total');
  line('assertions passing', pass);
  line('failing', fail ? `🛑 ${fail}` : '0');
  line('suites that did not run here', skipped);
  if (skipped) {
    console.log('\n  🛑 Do not report this as "everything green" — ' + skipped + ' suite(s) did not run.');
  }
}

docs();
tree();
code();
suites();
console.log('');
