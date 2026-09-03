/* ==========================================================================
   personal-bests.js — the records one just-recorded session actually set.

   Pure: no DOM, no store, no clock. Imports only `e1rm.js` and `set-types.js`.
   It lived as a private closure inside `js/views-session.js` from 2026-08-26
   until now, which meant this project's most opinionated piece of arithmetic
   was the one piece with no test of its own. Extracted for §13 Step 5.

   ── WHAT CHANGED, AND THE INVARIANT IT BROKE ────────────────────────────────

   The old function returned ONE untyped record per exercise and carried this
   promise in its header:

     "RULE 5-SAFE BY CONSTRUCTION: it compares two RECORDED sets… No estimate,
      no e1RM, no model anywhere in it, so nothing inferred can masquerade as
      measured."

   🚨 THAT PROMISE IS NO LONGER TRUE OF THIS MODULE AND THE COMMENT IS NOT
   ALLOWED TO GO ON CLAIMING IT. Hevy types a record into `Weight · Volume ·
   1RM` (social-plan §12.15) and the third of those is an ESTIMATE — the
   Marzagao curve in `e1rm.js` applied to a set nobody performed. It is an
   inference, and this module now emits one.

   What replaces the old promise is the general form of Rule 5 — *never let an
   inference look like a measurement, and the cue must not be colour alone* —
   honoured in three places rather than by avoidance:

     1. `estimated: true` rides out of here on the `e1rm` kind and on nothing
        else, so no caller has to know which kinds are modelled.
     2. `kind` is the discriminator, so a screen can say the word "1RM" and the
        word "estimated" in text. The finish screen prints both as `.tag`
        pills — words, not a shade.
     3. D5 is enforced on both sides of the comparison: a set above
        `MAX_EVIDENCE_REPS` is refused as e1RM evidence here exactly as it is
        everywhere else in this app, so a 20-rep burnout set can neither set
        the record nor stand in the way of one.

   Three of the four kinds are still recorded-vs-recorded and carry no flag.
   The honesty is now in the labelling rather than in the absence.

   ── THE FOUR KINDS ──────────────────────────────────────────────────────────

     'weight'  the heaviest single weight ever recorded for that exercise
     'volume'  the biggest SINGLE-SET volume — load × reps, one set
     'reps'    the bodyweight case: most reps, where there is no weight at all
     'e1rm'    the best estimated one-rep max                    ⚠️ ESTIMATE

   `weight` and `reps` are mutually exclusive by construction, for the reason
   the original gave and which still holds: "more reps at less weight" is not a
   bigger number, so an exercise that logs weight is judged on weight and reps
   is the readout only where there is no weight to judge. Time and distance are
   left alone entirely — the app has no opinion on which direction of a mile is
   better (Rule 6).

   ── AND ONLY WHERE THERE WAS SOMETHING TO BEAT ──────────────────────────────

   The first time an exercise is ever logged every set is trivially a maximum,
   and celebrating it would teach that the trophy is noise. The gate is now
   PER KIND rather than per exercise, which is stricter and more honest: an
   exercise logged for a year as bodyweight-only, then loaded for the first
   time today, has no weight history to beat, so it gets no Weight record —
   "up from 0" is not a thing that happened.
   ========================================================================== */

import { e1rm, isRankableSet } from './e1rm.js';
import { minisOf } from './set-types.js';

/** What each kind is called on screen. The word is the Rule 5 cue. */
export const PB_LABEL = {
  weight: 'Weight',
  volume: 'Volume',
  reps: 'Reps',
  e1rm: '1RM',
};

/** Kind order within one exercise — Hevy's `🏅Weight 🏅Volume 🏅1RM`. */
const KIND_ORDER = { weight: 0, reps: 0, volume: 1, e1rm: 2 };

/**
 * ⚠️ JUDGEMENT CALL — MINI-SETS COUNT ON BOTH SIDES, and this is a change.
 *
 * The old function walked `[set, ...minisOf(set)]` when reading HISTORY but
 * took `now` from the parent sets alone. That asymmetry was live and it could
 * only ever work one way: a drop off a drop set could raise the bar it is
 * measured against, and could never clear it. An exercise whose best-ever set
 * happened to be a mini-set was permanently unable to beat itself.
 *
 * Symmetric was the only defensible fix, and counting them is the better half
 * of the symmetry: a mini-set is a set that was really performed and really
 * recorded, so if it is evidence in the past it is evidence today. (The other
 * half — ignoring minis everywhere — would throw away real work, and would
 * quietly disagree with `historyFor()` and the charts, which count them.)
 *
 * ⚠️ Note what this does NOT do: it does not sum a drop set into one volume.
 * `progress.md` §6 locks a drop set as ONE hard set, and the record here is
 * "the biggest single set", so each mini is weighed on its own — which is also
 * how the parent is weighed. Same rule on both sides.
 *
 * ⚠️ EXPORTED SINCE 2026-09-11, for `js/profile-records.js`. It is the one copy
 * of "which rows of an entry are sets a maximum may be read off", and a second
 * copy in the all-time module would be the same asymmetry bug in a new place.
 */
export function allSetsOf(sets) {
  const out = [];
  for (const s of sets || []) {
    if (!s) continue;
    out.push(s);
    for (const m of minisOf(s)) if (m) out.push(m);
  }
  return out;
}

/**
 * Which kinds of record an exercise's sets are even eligible for.
 *
 * `weight` and `reps` are mutually exclusive by construction — see the header.
 * An empty array means "no opinion": time and distance only, so Rule 6 applies
 * and nothing here is a maximum.
 *
 * ⚠️ EXTRACTED AND EXPORTED SINCE 2026-09-11 and it is a pure move — the two
 * lines it replaces read identically. `js/profile-records.js` asks the same
 * question about a whole history that this file asks about one session, and
 * "does a loaded lift get a reps record" must have exactly one answer.
 */
export function kindsFor(sets) {
  const loaded = sets.some((s) => Number(s.weight) > 0);
  if (loaded) return ['weight', 'volume', 'e1rm'];
  return sets.some((s) => Number(s.reps) > 0) ? ['reps'] : [];
}

/**
 * One set, measured for one kind. Null means "this set is not evidence of
 * this kind of record" — no weight logged, no reps logged, or refused by D5.
 *
 * @param factor 2 for a per-side exercise, 1 otherwise. See personalBests().
 * @returns { value, weight, reps } | null — `weight`/`reps` describe the set
 *   that produced `value`, so a screen can say what the record came off.
 *
 * ⚠️ EXPORTED SINCE 2026-09-11, for `js/profile-records.js`. This is where D5
 * lives for records — the `isRankableSet` gate on the e1rm branch — and it is
 * the single place that knows a per-side lift doubles VOLUME and nothing else.
 * The all-time module asks the identical question of much older sets; if it
 * asked it in its own words the two screens would disagree the first day one of
 * these four branches changed.
 */
export function measure(kind, set, factor) {
  const w = Number(set && set.weight);
  const r = Number(set && set.reps);
  const hasW = Number.isFinite(w) && w > 0;
  const hasR = Number.isFinite(r) && r > 0;

  if (kind === 'weight') return hasW ? { value: w, weight: w, reps: hasR ? r : null } : null;
  if (kind === 'reps') return hasR ? { value: r, weight: null, reps: r } : null;
  if (kind === 'volume') return hasW && hasR ? { value: w * factor * r, weight: w, reps: r } : null;
  if (kind === 'e1rm') {
    // ⚠️ D5. `isRankableSet` is the same gate the charts and the strength
    // estimate use, and it is applied to HISTORY as well as to today. Letting
    // a 25-rep set through would extrapolate 135×25 to 258 lb, beat a genuine
    // 205×5, and hand out a 1RM trophy for a burnout set.
    if (!hasW || !hasR || !isRankableSet(r)) return null;
    const v = e1rm(w, r);
    return v === null ? null : { value: v, weight: w, reps: r };
  }
  return null;
}

/**
 * ⚠️ A RECORD HAS TO BE BIG ENOUGH TO SEE.
 *
 * `e1rm()` returns a float off a logarithm, so two sets that are the same lift
 * in every way a human would recognise can differ in the twelfth decimal, and
 * a trophy for that is a lie about what happened. Both sides are snapped to
 * the same grain before being compared.
 *
 * ⚠️ THE GRAIN IS THE PRECISION THE SCREEN PRINTS AT, per kind, and the two
 * must not disagree. The estimate is stated to the whole pound — a model has
 * no business out-resolving the measurement it was fed — so a 0.4 lb "gain"
 * that would render as "202 lbs, up from 202 lbs" is not counted as a record
 * at all. The measured kinds keep a tenth, which is what they display to.
 *
 * The unrounded value still leaves the module; this decides only whether a
 * difference counts, never what is shown.
 */
const GRAIN = { weight: 0.1, reps: 1, volume: 0.1, e1rm: 1 };
const snap = (n, kind) => Math.round(n / GRAIN[kind]) * GRAIN[kind];

/**
 * The records set by `cleaned`, against everything recorded before it.
 *
 * @param {Array} cleaned          this session's entries, already cleaned —
 *   [{ exerciseId, exerciseName, sets: [{ weight, reps, minis? }] }]
 * @param {Array} priorSessions    every session EXCEPT this one. The caller
 *   owns that exclusion; a session that is its own history beats itself.
 * @param {Array} priorBenchmarks  every benchmark except this session's own.
 *   A benchmark is a single set and counts for all four kinds (Rule 4 is about
 *   CHARTING them as one line, not about what a maximum is).
 * @param {Map} [exMap]            id → exercise, for `loadType`. Optional; see
 *   the per-side note below.
 * @returns {Array} [{ name, exerciseId, kind, now, was, weight, reps, perSide,
 *   estimated }] in the order the exercises were done, `Weight · Volume · 1RM`
 *   within each. `weight` and `reps` describe the set that earned `now` (null
 *   where the record IS that number); `perSide` says whether the volume figure
 *   counts both sides; `estimated` is true on the 1RM and nothing else. Up to
 *   three records per exercise, as Hevy does.
 */
export function personalBests(cleaned, priorSessions, priorBenchmarks, exMap) {
  const out = [];

  for (const e of cleaned || []) {
    const nowSets = allSetsOf(e.sets);
    // Empty means time/distance only: Rule 6, the app has no opinion there.
    const kinds = kindsFor(nowSets);
    if (!kinds.length) continue;

    /* ⚠️ JUDGEMENT CALL — PER-SIDE DOUBLES VOLUME AND NOTHING ELSE.
     *
     * A per-side exercise records the load on ONE side, so a 50 lb dumbbell
     * press for 10 really is 1,000 lb of work and calling it 500 would halve
     * somebody's session. Volume is a claim about total work — it is a sum,
     * and the sum has a right answer — so it is doubled.
     *
     * The Weight and 1RM records are NOT doubled, and that is deliberate
     * rather than an oversight: they are stated in the units the set was
     * logged in and that every other screen in this app prints (`50/side`,
     * `ui.js:710`). A finish screen reading "Weight 100 lbs" for a lift the
     * user typed as 50 would be a number they never entered.
     *
     * What matters more than either choice is that `now` and `was` go through
     * this same factor, resolved once per exercise — so the comparison is
     * internally consistent even where `exMap` is absent or the exercise has
     * been deleted from the library, in which case nothing is doubled and the
     * records are simply stated in logged units throughout.
     */
    const ex = exMap && typeof exMap.get === 'function' ? exMap.get(e.exerciseId) : null;
    const factor = ex && ex.loadType === 'per_side' ? 2 : 1;

    // Every set this exercise has ever contributed, flattened once for all
    // four kinds rather than re-walked per kind.
    const priorSets = [];
    for (const s of priorSessions || []) {
      for (const pe of (s && s.entries) || []) {
        if (!pe || pe.exerciseId !== e.exerciseId) continue;
        priorSets.push(...allSetsOf(pe.sets));
      }
    }
    for (const b of priorBenchmarks || []) {
      if (!b || b.exerciseId !== e.exerciseId || !b.values) continue;
      priorSets.push(b.values);
    }

    for (const kind of kinds) {
      // `seen` is what stops a first-ever log being a trophy, and it is per
      // kind: a prior set only counts as something to beat if it is evidence
      // of THIS kind of record.
      let was = 0, seen = false;
      for (const s of priorSets) {
        const m = measure(kind, s, factor);
        if (!m) continue;
        seen = true;
        if (m.value > was) was = m.value;
      }
      if (!seen) continue;

      let best = null;
      for (const s of nowSets) {
        const m = measure(kind, s, factor);
        if (m && (!best || m.value > best.value)) best = m;
      }
      if (!best || snap(best.value, kind) <= snap(was, kind)) continue;

      out.push({
        name: e.exerciseName,
        exerciseId: e.exerciseId,
        kind,
        now: best.value,
        was,
        weight: best.weight,
        reps: best.reps,
        // ⚠️ So the screen can EXPLAIN the volume number. "60 lbs × 12" and
        // "1,440 lbs" do not multiply out unless you already know the lift is
        // per side, and a total nobody can reconstruct is a total nobody
        // should be asked to believe.
        perSide: factor === 2,
        // ⚠️ The Rule 5 flag. True on exactly one kind, and carried out of the
        // module so no screen has to re-derive which kinds are modelled.
        estimated: kind === 'e1rm',
      });
    }
  }

  return groupByExercise(cleaned, out);
}

/**
 * Records regrouped so an exercise's three kinds sit together, in the order
 * they were performed. `personalBests()` already emits them that way; this
 * makes it true by construction rather than by the loop happening to be nested
 * in that order, because the kind loop is the inner one and a future edit
 * could easily reverse it.
 */
function groupByExercise(cleaned, records) {
  const order = new Map();
  (cleaned || []).forEach((e, i) => { if (!order.has(e.exerciseId)) order.set(e.exerciseId, i); });
  return records
    .map((r, i) => ({ r, i }))
    .sort((a, b) =>
      (order.get(a.r.exerciseId) ?? 0) - (order.get(b.r.exerciseId) ?? 0)
      || KIND_ORDER[a.r.kind] - KIND_ORDER[b.r.kind]
      || a.i - b.i)
    .map((x) => x.r);
}
