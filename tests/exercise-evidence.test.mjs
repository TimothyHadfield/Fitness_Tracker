// Headless tests for js/exercise-evidence.js. No DOM required.
//   node tests/exercise-evidence.test.mjs
//
// What these are actually defending. The module is a table of hand-written
// claims and hand-written ids, and every failure mode it has is a typo that
// still parses:
//
//   · an exercise id that does not exist, so the lint silently never fires;
//   · a `betterThan` pointing at nothing, so a comparison renders half-empty;
//   · a sourceId with no entry in SOURCES, so a claim loses its citation —
//     which is the exact drift the file's rule 1 exists to prevent;
//   · a tier or confidence word outside the allowed set, so a consumer's
//     switch statement falls through to nothing;
//   · a muscle key that is not a real muscle group, so coverage never runs.
//
// None of those throw. All of them are asserted here.

const { BUILT_IN_EXERCISES, MUSCLE_GROUPS } = await import('../js/exercises.js');
const {
  SOURCES, EXERCISE_EVIDENCE, MUSCLE_COVERAGE, evidenceFor, coverageFor,
} = await import('../js/exercise-evidence.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const TIERS = ['measured', 'emg', 'anatomy'];
const CONFIDENCES = ['strong', 'good', 'limited'];

const exIds = new Set(BUILT_IN_EXERCISES.map((e) => e.id));
const evKeys = Object.keys(EXERCISE_EVIDENCE);
const covKeys = Object.keys(MUSCLE_COVERAGE);

/* ---------- the file is populated at all ---------- */
ok(evKeys.length > 0, `EXERCISE_EVIDENCE has ${evKeys.length} entries`);
ok(covKeys.length > 0, `MUSCLE_COVERAGE has ${covKeys.length} muscles`);
ok(Object.keys(SOURCES).length > 0, `SOURCES defines ${Object.keys(SOURCES).length} studies`);

/* ---------- ⚠️ EVERY ID IS REAL ----------
 * The one assertion that cannot be skipped. Ids are slugify(name) + '--' +
 * slugify(muscle), they are not guessable, and "Cable Kickback" exists twice in
 * the library under two different muscles — so a plausible-looking id can be
 * wrong in a way no reader will spot. */
{
  const bad = evKeys.filter((id) => !exIds.has(id));
  ok(bad.length === 0,
     `🚨 every EXERCISE_EVIDENCE key exists in BUILT_IN_EXERCISES${bad.length ? ' — missing: ' + bad.join(', ') : ''}`);
}

{
  const bad = [];
  for (const [id, entry] of Object.entries(EXERCISE_EVIDENCE)) {
    for (const other of entry.betterThan || []) if (!exIds.has(other)) bad.push(`${id} → ${other}`);
  }
  ok(bad.length === 0,
     `🚨 every betterThan id exists too${bad.length ? ' — missing: ' + bad.join(', ') : ''}`);
}

/* ---------- ⚠️ EVERY CITATION RESOLVES ----------
 * Rule 1 of the file: a claim that loses its source is a claim that drifts. */
{
  const bad = [];
  const check = (label, entry) => {
    for (const s of entry.sources || []) if (!SOURCES[s]) bad.push(`${label} → ${s}`);
  };
  for (const [id, entry] of Object.entries(EXERCISE_EVIDENCE)) check(id, entry);
  for (const [m, entry] of Object.entries(MUSCLE_COVERAGE)) check(m, entry);
  ok(bad.length === 0,
     `🚨 every sourceId referenced is defined in SOURCES${bad.length ? ' — undefined: ' + bad.join(', ') : ''}`);
}

{
  const bad = [];
  for (const [id, entry] of Object.entries(EXERCISE_EVIDENCE)) {
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) bad.push(id);
  }
  for (const [m, entry] of Object.entries(MUSCLE_COVERAGE)) {
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) bad.push(m);
  }
  ok(bad.length === 0,
     `⚠️ no entry has an empty sources array — an uncited claim is not allowed in this file${bad.length ? ' (' + bad.join(', ') + ')' : ''}`);
}

/* ---------- tier and confidence are from the allowed sets ---------- */
{
  const badTier = evKeys.filter((id) => !TIERS.includes(EXERCISE_EVIDENCE[id].tier));
  ok(badTier.length === 0,
     `every tier is one of ${TIERS.join('/')}${badTier.length ? ' — bad: ' + badTier.join(', ') : ''}`);

  const badConf = evKeys.filter((id) => !CONFIDENCES.includes(EXERCISE_EVIDENCE[id].confidence));
  ok(badConf.length === 0,
     `every exercise confidence is one of ${CONFIDENCES.join('/')}${badConf.length ? ' — bad: ' + badConf.join(', ') : ''}`);

  const badCovConf = covKeys.filter((m) => !CONFIDENCES.includes(MUSCLE_COVERAGE[m].confidence));
  ok(badCovConf.length === 0,
     `every coverage confidence is one of ${CONFIDENCES.join('/')}${badCovConf.length ? ' — bad: ' + badCovConf.join(', ') : ''}`);
}

/* ---------- every entry says something, in one sentence ---------- */
{
  const noClaim = evKeys.filter((id) => typeof EXERCISE_EVIDENCE[id].claim !== 'string'
    || EXERCISE_EVIDENCE[id].claim.trim().length < 20);
  ok(noClaim.length === 0,
     `every exercise entry carries a real claim${noClaim.length ? ' — thin: ' + noClaim.join(', ') : ''}`);

  const noCovClaim = covKeys.filter((m) => typeof MUSCLE_COVERAGE[m].claim !== 'string'
    || MUSCLE_COVERAGE[m].claim.trim().length < 20);
  ok(noCovClaim.length === 0,
     `every coverage entry carries a real claim${noCovClaim.length ? ' — thin: ' + noCovClaim.join(', ') : ''}`);
}

/* ---------- ⚠️ MUSCLE_COVERAGE KEYS ARE REAL MUSCLE GROUPS ----------
 * 'Hamstring' instead of 'Hamstrings' would make the lint quietly never run on
 * the one muscle the evidence is strongest about. */
{
  const bad = covKeys.filter((m) => !MUSCLE_GROUPS.includes(m));
  ok(bad.length === 0,
     `🚨 every MUSCLE_COVERAGE key is in MUSCLE_GROUPS${bad.length ? ' — not a muscle group: ' + bad.join(', ') : ''}`);

  const badFlag = covKeys.filter((m) => typeof MUSCLE_COVERAGE[m].needsDirectWork !== 'boolean');
  ok(badFlag.length === 0,
     `needsDirectWork is a real boolean everywhere${badFlag.length ? ' — bad: ' + badFlag.join(', ') : ''}`);

  ok(covKeys.some((m) => MUSCLE_COVERAGE[m].needsDirectWork === false),
     '⚠️ at least one muscle records that the compound IS enough — a null result is a finding, and a '
     + 'lint that only ever knows how to complain is one people turn off');
}

/* ---------- the tier means what it says ----------
 * Rule 4: a claim may never say more than its tier supports. An EMG or anatomy
 * entry that asserts growth is the single most damaging thing this file could
 * ship, because it launders modelling as measurement. */
{
  const GROWTH = /\b(grew|grows|growth|hypertroph|out-grew|outgrew)\b/i;
  const HEDGE = /\b(no trial|never been compared|never measured|has never|not tested|untested|the one trial|in the one trial)\b/i;
  const bad = evKeys.filter((id) => {
    const e = EXERCISE_EVIDENCE[id];
    if (e.tier === 'measured') return false;
    return GROWTH.test(e.claim) && !HEDGE.test(e.claim);
  });
  ok(bad.length === 0,
     '⚠️ no emg or anatomy claim asserts growth without naming what was not measured'
     + (bad.length ? ' — offending: ' + bad.join(', ') : ''));
}

/* ---------- betterThan is a hypertrophy comparison, not a preference ---------- */
{
  const bad = evKeys.filter((id) => (EXERCISE_EVIDENCE[id].betterThan || []).length > 0
    && EXERCISE_EVIDENCE[id].tier !== 'measured');
  ok(bad.length === 0,
     '⚠️ betterThan only ever appears on a `measured` entry — it means a trial measured growth in '
     + 'both, and it may not be reached from EMG or moment arms'
     + (bad.length ? ' — offending: ' + bad.join(', ') : ''));

  const selfRef = evKeys.filter((id) => (EXERCISE_EVIDENCE[id].betterThan || []).includes(id));
  ok(selfRef.length === 0, 'nothing beats itself');
}

/* ---------- sources are described well enough to be checked ---------- */
{
  const bad = Object.entries(SOURCES).filter(([, s]) => !s.label || !s.authors || !s.year || !s.n);
  ok(bad.length === 0,
     `every source carries label, authors, year and n${bad.length ? ' — thin: ' + bad.map(([k]) => k).join(', ') : ''}`);

  // ⚠️ title / journal / doi are OPTIONAL BY DESIGN: the research library
  // records authors, years and results, and inventing a journal from memory is
  // exactly the drift rule 1 forbids. What is asserted is that anything present
  // is a real string, not an empty placeholder that renders as a blank line.
  const empty = Object.entries(SOURCES).filter(([, s]) => ['title', 'journal', 'doi']
    .some((f) => f in s && (typeof s[f] !== 'string' || !s[f].trim())));
  ok(empty.length === 0,
     `an absent citation field is absent, never an empty string${empty.length ? ' — bad: ' + empty.map(([k]) => k).join(', ') : ''}`);

  const used = new Set();
  for (const e of Object.values(EXERCISE_EVIDENCE)) for (const s of e.sources) used.add(s);
  for (const e of Object.values(MUSCLE_COVERAGE)) for (const s of e.sources) used.add(s);
  const orphans = Object.keys(SOURCES).filter((s) => !used.has(s));
  ok(orphans.length === 0,
     `no orphan sources — every study defined is actually cited${orphans.length ? ' — unused: ' + orphans.join(', ') : ''}`);
}

/* ---------- 🚨 THE FILE STAYS SHORT ON PURPOSE ----------
 * Across ~10,000 papers the research library counts about sixteen exercise
 * claims backed by measured growth. If this table ever covers a large slice of
 * the 319-exercise library, something has been let in on EMG or on a tier list.
 * Under-inclusion is the rule, and it is asserted rather than remembered. */
{
  ok(evKeys.length < BUILT_IN_EXERCISES.length * 0.15,
     `only ${evKeys.length} of ${BUILT_IN_EXERCISES.length} exercises have an entry — most of the `
     + 'library has never been measured and says so by being absent');

  const measured = evKeys.filter((id) => EXERCISE_EVIDENCE[id].tier === 'measured').length;
  ok(measured > evKeys.length / 2,
     `${measured} of ${evKeys.length} entries rest on measured growth rather than EMG or anatomy`);

  ok(evKeys.filter((id) => EXERCISE_EVIDENCE[id].confidence === 'strong').length <= 1,
     '⚠️ at most one `strong` entry, because exercise selection has almost no synthesis literature '
     + 'and `strong` means two or more independent syntheses agree — the same bar research-topics.js '
     + 'uses for the same word');
}

/* ---------- the lookups ---------- */
{
  ok(evidenceFor('overhead-cable-extension--triceps') === EXERCISE_EVIDENCE['overhead-cable-extension--triceps'],
     'evidenceFor() returns the entry for a known id');
  ok(coverageFor('Biceps') === MUSCLE_COVERAGE.Biceps, 'coverageFor() returns the entry for a known muscle');

  ok(evidenceFor('not-a-real-exercise--nope') === null, 'evidenceFor() returns null for an unknown id');
  ok(coverageFor('Elbows') === null, 'coverageFor() returns null for an unknown muscle');

  // ⚠️ Ids arrive from saved templates, which are user data, and a bare object
  // lookup hands back a live function for these three.
  ok(evidenceFor('constructor') === null && evidenceFor('toString') === null
     && evidenceFor('valueOf') === null,
     '🚨 evidenceFor() returns null for inherited Object properties, not a function with no .claim');
  ok(coverageFor('constructor') === null && coverageFor('hasOwnProperty') === null,
     '🚨 coverageFor() does the same');

  ok(evidenceFor(undefined) === null && evidenceFor(null) === null && evidenceFor(42) === null,
     'and null for undefined, null and a number');
  ok(coverageFor(undefined) === null && coverageFor(null) === null,
     'coverageFor() likewise');
}

/* ---------- purity ---------- */
{
  const before = JSON.stringify(EXERCISE_EVIDENCE);
  evidenceFor('back-squat--quads');
  coverageFor('Quads');
  coverageFor('Elbows');
  ok(JSON.stringify(EXERCISE_EVIDENCE) === before,
     'reading the table does not change it — no DOM, no store, no clock, testable headlessly, which '
     + 'is the pattern that has caught real bugs in this project');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
