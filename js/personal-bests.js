/* ==========================================================================
   personal-bests.js — the records one just-recorded session actually set.

   Pure: no DOM, no store, no clock. Imports `set-e1rm.js` (the one place a set
   becomes a 1RM), `e1rm.js` (the weigh-in lookup), `exercises.js` (which lifts
   carry a body) and `set-types.js`. It lived as a private closure inside
   `js/views-session.js` from 2026-08-26 until now, which meant this project's
   most opinionated piece of arithmetic was the one piece with no test of its
   own. Extracted for §13 Step 5.

   ── 🔄 2026-09-13: THE LOAD IS THE LOAD ON THE BODY, NOT THE NUMBER IN THE BOX ─

   Until today `measure()` fed `e1rm()` the logged number. For a barbell that is
   the load; for an assisted pull-up it is the HELP, so 70 help × 8 then 80 help
   × 8 read "Weight 80, up from 70" and "1RM 110, up from 98" — more help, bigger
   trophy (docs/strength-accuracy-plan.md §2.1, the audit's D2). For a weighted
   pull-up it was the plate on the belt, so +25 × 5 read a 34 lb max. Now:

     · the 1RM kind goes through `setE1rm()` — assist-aware, body-inclusive
       with the weigh-in ON THE DATE OF THE SET, per hand into the curve then
       doubled (plan §4.e). The record's `now` is still the per-side figure for
       a per-side lift, because that is what every screen prints the lift as.
     · the Weight kind on an ASSISTED lift is INVERTED: less help is the
       record. `assisted: true` rides out on it so the screen can say "less
       help than ever" instead of "up from". It was inverted rather than
       refused because it is the one record an assisted lift can set with no
       weigh-in on file, and it is measured — a thing the lifter typed.
     · the Volume kind on an assisted lift is refused: help × reps is not work
       done, and it inverts the same way.

   Callers hand in `opts.bodyWeights` (the dated series) and `opts.date` (the
   day the session being scored happened). Without them a body-weight lift's
   1RM kind is simply absent — "we don't know" survives to the screen rather
   than a made-up number.

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

import { bodyWeightOn } from './e1rm.js';
import { setE1rm, shownMax } from './set-e1rm.js';
import { bodyWeightFractionFor } from './exercises.js';
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
 * The context one set is measured in: which exercise it was, and what the
 * lifter weighed that day. Built once per (exercise, date) by the two callers.
 *
 * @typedef {object} MeasureContext
 * @property {object|null} exercise   the library/custom entry, or null when the
 *   library cannot place it — then nothing is doubled and no body is added
 * @property {number} [factor]        2 for a per-side lift, 1 otherwise;
 *   derived from `exercise.loadType` when absent
 * @property {number} [bodyWeight]    pounds, ON THE DATE OF THE SET
 * @property {number} [bodyWeightQuality]  1, or 0.70 for a weigh-in carried
 *   backward (`bodyWeightOn` in e1rm.js)
 */

/**
 * One set, measured for one kind. Null means "this set is not evidence of
 * this kind of record" — no weight logged, no reps logged, refused by D5, or a
 * body-weight lift with no weigh-in to price the body.
 *
 * @param {MeasureContext|number} ctx  a context, or (older callers) the bare
 *   per-side factor
 * @returns { value, weight, reps, assisted, … } | null — `value` is ALWAYS
 *   "bigger is better", which is the one invariant the two comparison loops
 *   (here and in profile-records.js) rely on; `weight`/`reps` describe the set
 *   that produced it, so a screen can say what the record came off. The 1RM
 *   kind also carries `total` (both dumbbells, body included), `perSide`,
 *   `bodyIncluded`, `bodyWeight` and `bodyWeightQuality` — the flags a screen
 *   needs to say what the number is.
 *
 * ⚠️ EXPORTED SINCE 2026-09-11, for `js/profile-records.js`. This is where D5
 * lives for records — `setE1rm()` returns null above MAX_EVIDENCE_REPS — and it
 * is the single place that knows a per-side lift doubles VOLUME and nothing
 * else on the way out. The all-time module asks the identical question of much
 * older sets; if it asked it in its own words the two screens would disagree
 * the first day one of these four branches changed.
 *
 * 🚨 THE ASSISTED WEIGHT KIND IS INVERTED HERE AND NOWHERE ELSE. `value` is
 * MINUS the help, so the loops' "bigger wins" picks the least-assisted set,
 * while `weight` stays the number the lifter typed. `assisted: true` tells the
 * screen to say "less help" rather than "up from". Volume on an assisted lift
 * is refused outright: help × reps is not work.
 */
export function measure(kind, set, ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : { exercise: null, factor: Number(ctx) || 1 };
  const exercise = c.exercise || null;
  const factor = c.factor !== undefined ? c.factor
    : (exercise && exercise.loadType === 'per_side' ? 2 : 1);
  const bwSpec = bodyWeightFractionFor(exercise);
  const assisted = Boolean(bwSpec && bwSpec.assist);

  const w = Number(set && set.weight);
  const r = Number(set && set.reps);
  const hasW = Number.isFinite(w) && w > 0;
  const hasR = Number.isFinite(r) && r > 0;

  if (kind === 'weight') {
    if (!hasW) return null;
    // Less help is the record: the comparison key is −help, the printed number is the help.
    return { value: assisted ? -w : w, weight: w, reps: hasR ? r : null, assisted };
  }
  if (kind === 'reps') return hasR ? { value: r, weight: null, reps: r, assisted: false } : null;
  if (kind === 'volume') {
    if (assisted || !hasW || !hasR) return null;
    return { value: w * factor * r, weight: w, reps: r, assisted: false };
  }
  if (kind === 'e1rm') {
    // ⚠️ D5 lives inside setE1rm(): a set above MAX_EVIDENCE_REPS comes back
    // null, on HISTORY as well as today. Letting a 25-rep set through would
    // extrapolate 135×25 to 258 lb, beat a genuine 205×5, and hand out a 1RM
    // trophy for a burnout set. A body-weight lift needs no logged weight —
    // zero added load is a complete set — but a plain lift does.
    if (!hasR || (!bwSpec && !hasW)) return null;
    const res = setE1rm(exercise, hasW ? w : 0, r, {
      bodyWeight: c.bodyWeight, bodyWeightQuality: c.bodyWeightQuality,
    });
    if (!res) return null;
    return {
      // Per side for a per-side lift — the figure every screen prints the lift
      // as — and the body-inclusive total for a pull-up. `total` is the whole.
      value: shownMax(res),
      total: res.e1rm,
      load: res.load,
      weight: hasW ? w : null,
      reps: r,
      perSide: res.perSide,
      bodyIncluded: res.bodyIncluded,
      assisted: res.assist,
      bodyWeight: res.bodyIncluded ? Number(c.bodyWeight) : null,
      bodyWeightQuality: res.bodyIncluded ? (Number(c.bodyWeightQuality) || 1) : null,
    };
  }
  return null;
}

/**
 * A `MeasureContext` per (exercise, date), with the weigh-in looked up once
 * per day. Shared by both callers so the two screens price a body the same way.
 *
 * @param {object|null} exercise
 * @param {Array} bodyWeights  the dated weigh-in series, pounds; may be empty
 * @returns {(date: string|null) => MeasureContext}
 */
export function contextFor(exercise, bodyWeights) {
  const factor = exercise && exercise.loadType === 'per_side' ? 2 : 1;
  const cache = new Map();
  return (date) => {
    const key = date || '';
    if (!cache.has(key)) {
      const bw = date ? bodyWeightOn(bodyWeights, date) : null;
      cache.set(key, {
        exercise, factor,
        bodyWeight: bw ? bw.weight : undefined,
        bodyWeightQuality: bw ? bw.quality : undefined,
      });
    }
    return cache.get(key);
  };
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
 * @param {Map} [exMap]            id → exercise, for `loadType` and for which
 *   lifts carry a body. Optional; see the per-side note below.
 * @param {object} [opts]
 * @param {Array}  [opts.bodyWeights]  the dated weigh-in series, pounds. Needed
 *   for the 1RM kind of a body-weight or assisted lift; without it that kind
 *   is absent for those lifts rather than wrong.
 * @param {string} [opts.date]         the day `cleaned` was performed, so its
 *   sets are priced at THAT day's weigh-in, exactly as the history is.
 * @returns {Array} [{ name, exerciseId, kind, now, was, weight, reps, perSide,
 *   bodyIncluded, assisted, estimated }] in the order the exercises were done,
 *   `Weight · Volume · 1RM` within each. `weight` and `reps` describe the set
 *   that earned `now` (null where the record IS that number); `perSide` says
 *   whether the volume figure counts both sides (and that a 1RM is one hand's);
 *   `bodyIncluded` says the 1RM has the lifter's body in it; `assisted` on a
 *   Weight record means `now` is HELP and the record is having used LESS of it
 *   than `was`; `estimated` is true on the 1RM and nothing else. Up to three
 *   records per exercise, as Hevy does.
 */
export function personalBests(cleaned, priorSessions, priorBenchmarks, exMap, opts) {
  const out = [];
  const bodyWeights = (opts && opts.bodyWeights) || [];
  const todayDate = (opts && opts.date) || null;

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
     * user typed as 50 would be a number they never entered. (The 1RM's CURVE
     * sees one hand and the result is doubled inside `setE1rm()` — plan §4.e —
     * and `now` is half of that: 82.7 for a 50/side × 12, on every screen.)
     *
     * What matters more than either choice is that `now` and `was` go through
     * this same context, resolved once per exercise — so the comparison is
     * internally consistent even where `exMap` is absent or the exercise has
     * been deleted from the library, in which case nothing is doubled and the
     * records are simply stated in logged units throughout.
     */
    const ex = exMap && typeof exMap.get === 'function' ? exMap.get(e.exerciseId) || null : null;
    const ctxOn = contextFor(ex, bodyWeights);
    const factor = ctxOn(null).factor;

    // Every set this exercise has ever contributed, flattened once for all
    // four kinds rather than re-walked per kind — each with the day it was
    // done, because a pull-up is priced at THAT day's body weight.
    const priorSets = [];
    for (const s of priorSessions || []) {
      for (const pe of (s && s.entries) || []) {
        if (!pe || pe.exerciseId !== e.exerciseId) continue;
        for (const set of allSetsOf(pe.sets)) priorSets.push({ set, date: s.date || null });
      }
    }
    for (const b of priorBenchmarks || []) {
      if (!b || b.exerciseId !== e.exerciseId || !b.values) continue;
      priorSets.push({ set: b.values, date: b.date || null });
    }

    for (const kind of kinds) {
      // `was` is what stops a first-ever log being a trophy, and it is per
      // kind: a prior set only counts as something to beat if it is evidence
      // of THIS kind of record. It is the whole measure, not a number, because
      // an inverted record prints the help it beat, not the key it beat it on.
      let was = null;
      for (const { set, date } of priorSets) {
        const m = measure(kind, set, ctxOn(date));
        if (m && (!was || m.value > was.value)) was = m;
      }
      if (!was) continue;

      let best = null;
      for (const s of nowSets) {
        const m = measure(kind, s, ctxOn(todayDate));
        if (m && (!best || m.value > best.value)) best = m;
      }
      if (!best || snap(best.value, kind) <= snap(was.value, kind)) continue;

      const assisted = Boolean(best.assisted);
      out.push({
        name: e.exerciseName,
        exerciseId: e.exerciseId,
        kind,
        // An inverted Weight record prints the HELP on both sides — `value`
        // was only ever the comparison key. Every other kind prints its value.
        now: kind === 'weight' && assisted ? best.weight : best.value,
        was: kind === 'weight' && assisted ? was.weight : was.value,
        weight: best.weight,
        reps: best.reps,
        // ⚠️ So the screen can EXPLAIN the volume number. "60 lbs × 12" and
        // "1,440 lbs" do not multiply out unless you already know the lift is
        // per side, and a total nobody can reconstruct is a total nobody
        // should be asked to believe.
        perSide: factor === 2,
        // ⚠️ Two more things the screen must SAY rather than let the reader
        // guess: the 1RM of a pull-up has a body in it, and a Weight record on
        // an assist machine is "less help", not "more weight".
        bodyIncluded: Boolean(best.bodyIncluded),
        assisted,
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
