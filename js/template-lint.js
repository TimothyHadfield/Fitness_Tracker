// Does this plan say anything the research would remark on?
//
// ── WHAT THIS IS ─────────────────────────────────────────────────────────────
//
// The workout builder will let you save anything. Twenty sets of chest in one
// afternoon, a split with no direct arm work in it anywhere — nothing in the
// app has ever looked at a plan and said a word about it. This module is the
// looking.
//
// ⚠️ AND ITS NORMAL ANSWER IS `[]`. That is not a weakness of the checks, it is
// the design. Two checks ship, both anchored to a number the Research tab
// already states and cites, and a plan that trips neither gets silence. A
// linter that finds something in every workout is a linter people learn to
// scroll past, and the second time it cries wolf it has spent the credibility
// the first genuine finding needed.
//
// ── ⚠️ TWO CHECKS, TWO SCOPES, AND THE SCOPE IS THE WHOLE DESIGN ────────────
//
// This started as one per-day function and it was WRONG, in a way that only a
// measurement could show. Run against the 36 workout days in preset-systems.js
// — the app's own curated programmes — the first version fired on 10 of them,
// 28 %, and almost every coverage finding was structurally bogus:
//
//   "Mike Thurston / Chest → Triceps worked only indirectly"
//        …and that same six-day split has an ARMS DAY with 14 direct triceps
//        sets on it.
//   "Back → Biceps"        …the Arms day covers it.
//   "Back → Hamstrings"    …those are deadlifts, and there is a Legs day.
//
// A single day cannot see any of that, and no amount of care inside a per-day
// function ever could. So the two checks now run at the scope each one is a
// statement ABOUT:
//
//   SETS_PER_SESSION   PER DAY. "Past 11 sets in one session" is inherently a
//                      claim about one session. A day is exactly its scope.
//   NEEDS_DIRECT_WORK  PER PROGRAMME. "This split never trains biceps
//                      directly" is a claim about the split. It fires only
//                      when NO day in the whole programme gives that muscle
//                      direct work, and it is attached to the programme
//                      (`workoutId: null`) rather than blamed on whichever day
//                      happened to be looked at.
//
// ⚠️ AND SO `lintWorkout()` NO LONGER RUNS THE COVERAGE CHECK AT ALL. It
// returns SETS_PER_SESSION and nothing else. The next person will ask why this
// is not an opt-in flag, so: an option like `{ coverage: true }` would be a
// switch whose ON position is wrong 10 times out of 36 on our own presets, and
// putting a known-wrong answer one keyword away from a caller is how it ends up
// shipped. There is already an honest way to ask the coverage question about a
// single day — `lintProgramme([day], exMap)` — and it means what it says: a
// one-day programme really does never train biceps directly. One entry point
// per scope, no flag, nothing to get wrong.
//
// ── ⚠️ A FINDING IS NOT A PRESCRIPTION, AND THE WORDING CARRIES THAT ─────────
//
// Rule 5 of research-topics.js: "NO EXERCISE PRESCRIPTIONS FOR A PERSON. This
// is what studies measured, not what you should do on Tuesday." Every message
// below reports what the evidence stops being able to say. None of them tells
// anybody to change a workout, and none of them uses a verdict word — no
// "too many", no "missing", no "should". The sets-and-reps topic's own caveat
// is the reason: all of this together explains about a quarter of why two
// training groups get different results. Something that explains a quarter of
// the variance has not earned the right to correct anyone's Tuesday.
//
// The messages are also SHORT — one sentence, about fifteen words — for the
// same reason the research topics are, and tests/template-lint.test.mjs asserts
// the budget, because every other assertion anybody would write here checks
// that something is PRESENT and prose piling back up is invisible to those.
//
// ── ⚠️ WHY THERE IS NO REST-INTERVAL CHECK ──────────────────────────────────
//
// Rest was ruled out of scope. It is also the check this file could not have
// written honestly: a planned workout in this app records an exercise and a set
// count, and nothing about rest at all, so any rest finding would be a claim
// about data the app does not hold. Two checks, both about what is actually in
// the plan.
//
// ── THE TWO REGISTRIES THE `sources` FIELD POINTS INTO ───────────────────────
//
// ⚠️ A finding's `sources` are IDS, and WHICH REGISTRY they resolve against is
// decided by the finding's `code`, not by a field:
//
//   SETS_PER_SESSION   → SOURCES in js/research-topics.js
//   NEEDS_DIRECT_WORK  → SOURCES in js/exercise-evidence.js
//
// Two registries rather than one because these are two different kinds of
// claim — a dose-response threshold from the training literature, and a
// per-muscle coverage claim from the exercise-evidence build — and merging them
// would mean this file owning a third copy of a citation. Rule 1 of
// research-topics.js: a citation written inline is a citation that drifts. So
// nothing is copied here; ids are carried, and the renderer looks them up.
//
// ── ⚠️ THE OPTIONAL DEPENDENCY, AND WHY IT IS IMPORTED THE HARD WAY ─────────
//
// js/exercise-evidence.js was written on another branch and HAS NOW LANDED, so
// this import resolves. The guard stays anyway, and not out of habit: this
// module is precached by sw.js, which means a user can be running a build where
// one of the two files is the old cached copy. A missing or half-written
// evidence module must cost the coverage check and nothing else — never the
// workout builder that imports this one.
//
// So the import is dynamic and guarded, resolved once at load, and a failure
// leaves `null`. The cost, stated plainly: if the file really is absent, a
// browser logs a 404 in the console. That is the whole price, and it buys a
// builder screen that still opens. The alternatives were both worse — a static
// import (the app breaks), or resolving the module lazily on first call (the
// first call would silently return fewer findings than the second, which is a
// bug nobody would ever reproduce).
//
// Everything downstream of that is written for absence: a missing module, a
// missing entry, a lookup that returns null, and a half-written module that
// THROWS all mean "no finding", never a crash.
//
// ── WHAT IS REUSED RATHER THAN REINVENTED ────────────────────────────────────
//
// · `volumeContributions()` from volume-map.js answers "which muscles did this
//   exercise only HELP with", which is check 2's entire question. That file
//   already carries the direct/indirect classification from Table 1 of Pelland
//   et al. — rows and pulldowns indirect for biceps, presses indirect for
//   triceps — and a second hand-written copy of that table in this file would
//   be a copy that drifts.
// · `SESSION_CEILING` from the same file is the one place a per-session set
//   count stops being covered by data at all, so it is what separates the two
//   severities rather than a number invented here.
// · `SOURCES` from research-topics.js, to cite check 1 without retyping it.
//
// Pure: no DOM, no store, no network, no clock, and it mutates nothing handed
// to it. The same shape as e1rm.js, muscle-evidence.js and research-topics.js,
// which is what makes it testable headlessly and is how this project's real
// bugs have been caught.

import { SOURCES as RESEARCH_SOURCES } from './research-topics.js';
import { volumeContributions, VOLUME_MUSCLES, SESSION_CEILING } from './volume-map.js';

/* ------------------------------------------------------------------ *
 * The optional dependency
 * ------------------------------------------------------------------ */

/**
 * js/exercise-evidence.js if it exists, null if it does not. See the header.
 *
 * Its contract, which this file is written against and does not define:
 *   SOURCES           { sourceId: { authors, year, title, journal, doi } }
 *   EXERCISE_EVIDENCE { exerciseId: { tier, claim, sources, confidence, betterThan? } }
 *   MUSCLE_COVERAGE   { muscleGroup: { needsDirectWork, claim, sources, confidence } }
 *   evidenceFor(exerciseId) → entry | null
 *   coverageFor(muscleGroup) → entry | null
 *
 * ⚠️ Only `coverageFor` / `MUSCLE_COVERAGE` is read here. The per-exercise half
 * of that module answers "is this a good exercise for X", which is a different
 * question from "does this plan hold together", and check 2 must not start
 * ranking somebody's exercise choices on the way past.
 */
let DEFAULT_EVIDENCE = null;
try {
  DEFAULT_EVIDENCE = await import('./exercise-evidence.js');
} catch {
  DEFAULT_EVIDENCE = null;
}

/* ------------------------------------------------------------------ *
 * The numbers
 * ------------------------------------------------------------------ */

/**
 * Sets on one muscle in one session, past which a finding is raised.
 *
 * ⚠️ 11 IS NOT A LIMIT ON WHAT WORKS, and describing it as one would be wrong
 * in a way that matters. It is Remmert et al. (2025)'s "point of undetectable
 * outcome superiority": the set count past which their 67 studies can no longer
 * TELL THE EXTRA SETS APART. Their own paper says growth "continued to occur,
 * again in a decreasing manner" above it. Undetectable is not absent, and this
 * file never says otherwise.
 *
 * It is also the number the Research tab already prints — the `sets-and-reps`
 * topic, third point, cited to acsm2026 and remmert2025 — so a reader who trips
 * this finding can go and read the claim behind it. That is the only reason to
 * pick 11 over any other point on a curve that never flattens inside the data.
 *
 * ⚠️ Note that volume-map.js deliberately does NOT cap at 11 (its SESSION_CEILING
 * is 24, and its header argues the case at length). There is no contradiction:
 * capping a SCORE at 11 would move shipped ratings on the strength of an
 * unreviewed preprint with an R²marginal of 16.1 %, while REMARKING at 11 costs
 * a sentence on screen and is the same thing the Research tab already says.
 * Scoring and remarking are allowed to use different thresholds; that is why
 * this constant lives here and not there.
 */
export const SETS_PER_SESSION_LIMIT = 11;

/**
 * How much indirect work a muscle needs, ACROSS THE WHOLE PROGRAMME, before
 * check 2 will remark on it.
 *
 * Without a floor, one set of rows tacked onto a leg day would raise "biceps
 * were worked only indirectly", which is true, trivial, and exactly the noise
 * that teaches people to ignore the panel. Three sets is the point where the
 * plan has actually put work through that muscle and the observation is about
 * the programme rather than about a rounding error. It is a judgement call, not
 * a measured threshold, and it is named here so it is one edit to move.
 *
 * ⚠️ IT BITES MUCH LESS THAN IT USED TO, and that is correct rather than a
 * regression. Totalled over a six-day split, three indirect sets is nothing —
 * any muscle a programme touches at all clears it. The floor is no longer the
 * thing keeping this check quiet; the programme-wide direct-work test is, and
 * that is a far better reason to be quiet than an arbitrary number was.
 */
export const INDIRECT_ONLY_MIN_SETS = 3;

/**
 * Sources for check 1, filtered against the registry they have to resolve in.
 *
 * ⚠️ The filter is not defensive noise. If an id is ever renamed in
 * research-topics.js, this ships a finding whose citation resolves to nothing —
 * a claim on screen with no source, which is the one thing rule 1 of that file
 * exists to prevent. Dropping the dead id keeps the screen honest; the test
 * asserts both ids survive, so the failure is loud where it should be loud
 * (in CI) and quiet where it should be quiet (on somebody's phone).
 */
const SETS_PER_SESSION_SOURCES = ['acsm2026', 'remmert2025']
  .filter((id) => Boolean(RESEARCH_SOURCES && RESEARCH_SOURCES[id]));

/**
 * The muscle names check 1 will count against.
 *
 * 'Full Body', 'Cardio' and 'Activity' are library shelves rather than muscles,
 * and "Full Body has 14 sets here" is not a sentence about any muscle at all.
 * Neck is added back to volume-map's list: it is left out THERE so it does not
 * drag a programme's average, and that argument says nothing about whether a
 * neck day is worth remarking on.
 */
const REAL_MUSCLES = new Set([...VOLUME_MUSCLES, 'Neck']);

/* ------------------------------------------------------------------ *
 * Lookups that cannot throw
 * ------------------------------------------------------------------ */

/** exMap may be a Map (what store.getExerciseMap() returns) or a plain object. */
function lookupIn(exMap) {
  if (!exMap) return () => null;
  if (typeof exMap.get === 'function') return (id) => exMap.get(id) || null;
  return (id) => (id != null && Object.prototype.hasOwnProperty.call(exMap, id) ? exMap[id] : null) || null;
}

/**
 * One muscle's coverage entry, or null.
 *
 * ⚠️ The try/catch is for the half-written module, not for the missing one. A
 * `coverageFor` that is mid-edit and throws on an unexpected key would
 * otherwise take out the builder screen, and a lint finding is never worth a
 * blank page.
 */
function coverageOf(evidence, muscle) {
  if (!evidence || !muscle) return null;
  try {
    if (typeof evidence.coverageFor === 'function') {
      return evidence.coverageFor(muscle) || null;
    }
    const table = evidence.MUSCLE_COVERAGE;
    return (table && table[muscle]) || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The checks
 * ------------------------------------------------------------------ */

/**
 * Check 1 — sets on one muscle in one session.
 *
 * Counted on the library's own `muscle` field, whole sets, direct work only.
 * ⚠️ Deliberately NOT the fractional count volume-map produces: the 11 comes
 * from a paper that counted fractionally, so this is the more conservative of
 * the two readings and will remark later rather than sooner. Being wrong in the
 * quiet direction is the right way for a linter to be wrong.
 */
function setsPerSessionFindings(rows) {
  const bySets = new Map();
  const byIds = new Map();
  for (const { ex, sets } of rows) {
    const m = ex.muscle;
    if (!REAL_MUSCLES.has(m)) continue;
    bySets.set(m, (bySets.get(m) || 0) + sets);
    if (!byIds.has(m)) byIds.set(m, []);
    byIds.get(m).push(ex.id);
  }

  const out = [];
  for (const [muscle, sets] of bySets) {
    if (sets <= SETS_PER_SESSION_LIMIT) continue;
    // Past the ceiling the studies stop existing rather than stop separating,
    // which is a different sentence and the only thing that earns a 'warn'.
    const past = sets > SESSION_CEILING;
    out.push({
      code: 'SETS_PER_SESSION',
      severity: past ? 'warn' : 'note',
      message: past
        ? `${muscle}: ${sets} sets here — past ${SESSION_CEILING} in one session no study has measured anything.`
        : `${muscle}: ${sets} sets here — past about ${SETS_PER_SESSION_LIMIT} in one session the research stops separating them.`,
      muscle,
      exerciseIds: [...new Set(byIds.get(muscle))],
      sources: SETS_PER_SESSION_SOURCES.slice(),
      // ⚠️ `limited`, not the `strong` the sets-and-reps topic carries overall.
      // The topic is strong because its WEEKLY half is; this particular number
      // rests on a preprint that is still not peer reviewed. Rule 2 of
      // research-topics.js: a preprint is `limited`, and the confidence travels
      // with the claim rather than with the topic it came from.
      confidence: 'limited',
    });
  }
  return out.sort((a, b) => a.muscle.localeCompare(b.muscle));
}

/**
 * Check 2 — a muscle THIS PROGRAMME only ever helps with.
 *
 * The classic case is a split of rows and pulldowns with no curl anywhere in
 * it: the biceps did real work, they were never any exercise's target, and the
 * fact that they were loaded is exactly why it is easy not to notice.
 *
 * ⚠️ `rows` IS EVERY DAY'S ROWS POOLED, and pooling them is the whole fix. One
 * direct set of an exercise for that muscle ANYWHERE in the programme settles
 * the question — a Chest day that leans on the triceps is not a finding when
 * Thursday is an Arms day. Handed one day's rows this reverts to the old,
 * wrong, per-day behaviour, which is why nothing calls it that way except
 * `lintProgramme([oneDay])`, where a one-day programme is exactly what the
 * caller means.
 *
 * Whether an uncovered muscle is worth saying is still not this file's call —
 * MUSCLE_COVERAGE decides, per muscle, with its own sources and confidence.
 */
function needsDirectWorkFindings(rows, evidence) {
  const direct = new Set();
  const indirectSets = new Map();
  const indirectIds = new Map();

  for (const { ex, sets } of rows) {
    let contributions = [];
    try {
      contributions = volumeContributions(ex) || [];
    } catch {
      contributions = [];
    }
    for (const c of contributions) {
      if (!c || !c.muscle) continue;
      if (c.kind === 'direct') { direct.add(c.muscle); continue; }
      indirectSets.set(c.muscle, (indirectSets.get(c.muscle) || 0) + sets);
      if (!indirectIds.has(c.muscle)) indirectIds.set(c.muscle, []);
      indirectIds.get(c.muscle).push(ex.id);
    }
  }

  const out = [];
  for (const [muscle, sets] of indirectSets) {
    if (direct.has(muscle)) continue;
    if (sets < INDIRECT_ONLY_MIN_SETS) continue;
    const cov = coverageOf(evidence, muscle);
    if (!cov || !cov.needsDirectWork) continue;
    out.push({
      code: 'NEEDS_DIRECT_WORK',
      severity: 'note',
      // ⚠️ "in this plan", not "here". The word had to change with the scope:
      // "here" pointed at whichever day was on screen, and this finding is now
      // about the whole split rather than about any one of its days.
      message: `${muscle}: worked only indirectly in this plan — the evidence says it responds to direct sets.`,
      muscle,
      // Null, because no single day is answerable for it. See the header.
      workoutId: null,
      exerciseIds: [...new Set(indirectIds.get(muscle))],
      // ⚠️ The entry's own `claim` is NOT inlined into the message, and not
      // because it is untrusted. It is written for a different context and to a
      // different length, and pasting it here would blow the sentence budget
      // and put a second, drifting copy of it on screen. The ids travel; the
      // renderer can show the claim beside them in full.
      sources: Array.isArray(cov.sources) ? cov.sources.slice() : [],
      confidence: cov.confidence || 'limited',
    });
  }
  return out.sort((a, b) => a.muscle.localeCompare(b.muscle));
}

/* ------------------------------------------------------------------ *
 * Resolving a plan into rows
 * ------------------------------------------------------------------ */

/** The exercises of one workout that this file can actually say anything about. */
function rowsFor(workout, get) {
  const items = workout && Array.isArray(workout.exercises) ? workout.exercises : [];
  const rows = [];
  for (const item of items) {
    if (!item) continue;
    // ⚠️ An id the map does not hold is SKIPPED, never thrown on. A workout can
    // name a custom exercise that was deleted, or one that belongs to another
    // account on a shared plan, and neither of those is a reason for the
    // builder to fall over — it is a reason to have nothing to say about that
    // row. Same refusal as volume-map's conservative fallback.
    const ex = get(item.exerciseId);
    if (!ex || !ex.muscle) continue;
    const sets = Number(item.sets);
    if (!(sets > 0)) continue;
    rows.push({ ex, sets });
  }
  return rows;
}

/** Which day a finding belongs to. Null when the workout has no id of its own. */
function idOf(workout) {
  return workout && workout.id != null ? workout.id : null;
}

/** `opts.evidence` if it was passed at all — including as an explicit null. */
function evidenceFrom(opts) {
  return opts && Object.prototype.hasOwnProperty.call(opts, 'evidence')
    ? opts.evidence
    : DEFAULT_EVIDENCE;
}

/* ------------------------------------------------------------------ *
 * The two entry points
 * ------------------------------------------------------------------ */

/**
 * What the research has to say about ONE planned day.
 *
 * ⚠️ SETS_PER_SESSION ONLY. The coverage check is not here and is not behind a
 * flag — the header has the measurement that settled it and the argument for
 * having no flag. `opts.evidence` is accepted and ignored, so that the same
 * options object can be handed to either entry point.
 *
 * @param {{ id?, name?, exercises?: {exerciseId, sets, notes?}[] }} workout
 * @param {Map|object} exMap  exerciseId -> exercise record from exercises.js
 * @param {object} [opts]
 * @returns {{code, severity, message, muscle, workoutId, exerciseIds, sources, confidence}[]}
 *          Empty for most days, which is the point.
 */
export function lintWorkout(workout, exMap, opts = {}) {
  const rows = rowsFor(workout, lookupIn(exMap));
  if (!rows.length) return [];
  const id = idOf(workout);
  return setsPerSessionFindings(rows).map((f) => ({ ...f, workoutId: id }));
}

/**
 * What the research has to say about a WHOLE PROGRAMME — a split, a preset
 * system, every day the user trains in a week.
 *
 * Runs SETS_PER_SESSION per day, each finding tagged with the day it came from,
 * and NEEDS_DIRECT_WORK once over every day pooled, tagged `workoutId: null`
 * because it is a statement about the split rather than about any one day.
 *
 * ⚠️ Findings come back in ONE FLAT LIST rather than grouped by day, and that
 * is deliberate: a programme-level finding belongs to no day, so any grouping
 * would need a bucket for "the programme" anyway. `workoutId` is the grouping
 * key, and a caller that wants it by day can group on it in one line.
 *
 * @param {Array} workouts    [{ id?, name?, exercises: [{ exerciseId, sets }] }]
 * @param {Map|object} exMap  exerciseId -> exercise record from exercises.js
 * @param {object} [opts]
 * @param {object|null} [opts.evidence]  stands in for js/exercise-evidence.js.
 *        Anything exposing `coverageFor(muscle)` or a `MUSCLE_COVERAGE` table
 *        will do; `null` disables the coverage check entirely. Defaults to the
 *        real module, or to null if it could not be loaded. This is how the
 *        test supplies data without the module, and it is the reason this file
 *        has no fixture of its own — a lint module carrying its own copy of the
 *        evidence is a second registry nobody would remember to update.
 * @returns {{code, severity, message, muscle, workoutId, exerciseIds, sources, confidence}[]}
 */
export function lintProgramme(workouts, exMap, opts = {}) {
  const days = Array.isArray(workouts) ? workouts.filter(Boolean) : [];
  const get = lookupIn(exMap);
  const evidence = evidenceFrom(opts);

  const perDay = [];
  const pooled = [];
  for (const day of days) {
    const rows = rowsFor(day, get);
    if (!rows.length) continue;
    const id = idOf(day);
    for (const f of setsPerSessionFindings(rows)) perDay.push({ ...f, workoutId: id });
    // ⚠️ Pooled AFTER the per-day pass, never instead of it. The two checks read
    // the same rows at different scopes and neither may borrow the other's.
    pooled.push(...rows);
  }
  if (!pooled.length) return [];

  return [...perDay, ...needsDirectWorkFindings(pooled, evidence)];
}
