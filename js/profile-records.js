/* ==========================================================================
   profile-records.js — "what are my best lifts, ever?"

   Pure: no DOM, no store, no clock, no network. Sessions and benchmarks are
   handed in, exactly like `strength-observations.js` and `compare.js`, which is
   the only reason any of the three can be tested. It must never import
   `store.js`.

   ── WHY THIS IS NOT `personal-bests.js`, AND WHY IT IMPORTS IT ──────────────

   `personal-bests.js` answers a question about ONE session — *did what I just
   did beat anything?* — and it is wired to the finish screen alone. Nothing in
   this app has ever answered the standing question a profile is for: *what are
   my best lifts, ever?* Those are different questions and they want different
   answers, but they must not want different ARITHMETIC.

   So every rule that decides what a maximum is stays in that file and is
   imported from it: `allSetsOf` (a drop off a drop set is a set that really
   happened, and counts), `kindsFor` (a loaded lift is judged on weight, a
   bodyweight lift on reps, and time/distance are left alone under Rule 6),
   `measure` (which is where the D5 rep ceiling lives, where a per-side lift
   doubles volume and nothing else, and — since 2026-09-13 — where an assisted
   lift's Weight is inverted and its 1RM is body-inclusive through
   `setE1rm()`), and `contextFor` (the weigh-in on the date of the set). Copying
   any of them here would be two answers to "what is a maximum" the first day
   one of them changed.

   🔄 2026-09-13: `opts.bodyWeights` is the dated weigh-in series. With it a
   pull-up's `estimatedMax` is the lifter's body plus the plate, at the weight
   they were THAT day (`bodyWeightOn`), and `estimatedMax.bodyIncluded` says so;
   without it a body-weight lift has a `best` and no estimate, which is the
   honest state. A per-side lift's `estimatedMax.value` is one hand's figure
   (the curve saw one dumbbell, was doubled, and `value` is half of that — plan
   §4.e); `estimatedMax.total` is both.

   ⚠️ A D17 BENCHMARK IS ALSO A SESSION SET, and until today it was counted
   twice in `sets` (the audit's D15). A benchmark row that matches a workout row
   of the same lift on (date, weight, reps) now RELABELS that row `benchmark`
   rather than adding a second one — the number was never affected, the count
   was.

   ── ⚠️ THE ONE RULE THIS MODULE DELIBERATELY DOES NOT INHERIT ───────────────

   `personalBests()` refuses a record where there was nothing to beat — the
   first time an exercise is ever logged is not a trophy, because every set of
   it is trivially a maximum and celebrating that teaches that the trophy is
   noise. 🚨 THAT GATE IS ABOUT A CELEBRATION AND THIS SCREEN IS NOT ONE. Asked
   "what is your best squat", a person who has squatted once has a true answer,
   and returning a blank instead would be inventing an absence — `direction.md`
   §3.1, *"something is always better than nothing"*, with the half Tim kept
   being *"have a way to be upfront about it."* Being upfront is `days`: every
   lift reports how many distinct days it has been trained, so a screen can
   print "1 session" beside a one-session lift rather than dressing it as a
   career best. The number is real either way; the context is what was missing.

   ── ⚠️ WHAT "BEST" MEANS, AND IT IS BOTH ────────────────────────────────────

   Heaviest set and best estimated 1RM disagree, and the disagreement is the
   interesting part: 135 × 3 and 105 × 10 estimate the same maximum, and a lift
   whose heaviest day is 135 × 3 while its best estimate came off 105 × 10 is
   telling its owner something true about how they train. Picking one silently
   would throw that away, and picking the estimate as the headline would be
   worse — so:

     `best`          the heaviest single weight ever recorded (or, for a
                     bodyweight lift, the most reps; for an assisted lift, the
                     LEAST help). MEASURED. Always present.
     `estimatedMax`  the best e1RM, through `set-e1rm.js`. AN ESTIMATE. May be
                     null — always null for a body-weight lift with no weigh-in.
     `sameSet`       whether the two came off the same set.

   🚨 RULE 5 IS THE REASON THEY ARE TWO FIELDS RATHER THAN A SORTED LIST. A
   screen cannot print the estimate where it meant to print the measurement by
   accident: they are reached by different names, only one of them carries
   `estimated: true`, and the estimate carries the real `weight`, `reps` and
   `date` of the set the model was fed, so the guess can be checked against
   something that actually happened. `sameSet: false` is the cue that there is a
   second, different day worth naming.

   ⚠️ Volume is not returned, and that is a choice rather than an oversight.
   The finish screen types a record `Weight · Volume · 1RM` because all three
   moved today; a biggest-single-set volume on a profile is a number nobody
   quotes and it would crowd out the two people care about. Nothing stops it
   being added — `measure('volume', …)` is right there — but it should be added
   because somebody wants it, not because the finish screen has it.

   ── ⚠️ ORDERING, WHICH MATTERS MORE THAN IT LOOKS ───────────────────────────

   A list of 300 exercises is a database dump, not a readout. Ranked by
   TRAINING DAYS, most first, and cut to `limit` (default 6).

   The two obvious alternatives were both rejected, and for reasons rather than
   taste:

     · **Biggest lifts.** There is no honest cross-exercise ranking of a 405 lb
       deadlift against a 40 lb lateral raise. Sorting by pounds sorts by which
       movements happen to load heavy, which is a property of the barbell and
       not of the lifter — an unearned opinion, Rule 6.
     · **Most recently trained.** One curious afternoon on the cable crossover
       pushes a five-year squat off the list. Recency churns, and a profile
       readout that changes every session is not a set of best lifts.

   Days trained is the closest thing to "the lifts that are yours", it is
   stable, and it cannot be gamed by one heavy single. ⚠️ Its known weakness is
   that a lift trained hard two years ago and abandoned still ranks: no decay is
   applied, because a decay constant would be invented, and the honest fix is
   information rather than arithmetic — every row carries `lastDate` and `days`
   so the screen can say when it was last trained and let the reader judge.

   Ties break on the most recent day, then the name, then the id, so the same
   history always produces the same list.
   ========================================================================== */

import { allSetsOf, kindsFor, measure, contextFor } from './personal-bests.js';

/** How many lifts a profile shows before it stops being a readout. */
export const DEFAULT_LIMIT = 6;

// Dates are bare 'YYYY-MM-DD' calendar days everywhere in this app, so they
// sort and compare as strings. Sliced because an imported or restored row can
// carry a full timestamp, and '2026-01-05T18:40' must not sort after
// '2026-01-05' as a different day.
const day = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : null);

/**
 * A stable key for one exercise.
 *
 * ⚠️ Falls back to the NAME, and that is load-bearing rather than defensive:
 * `import-file.js` writes entries with an `exerciseName` and no `exerciseId`
 * at all, so keying on the id alone would drop every imported session out of
 * somebody's best lifts without saying so.
 */
const keyOf = (exerciseId, name) =>
  (exerciseId ? `id:${exerciseId}` : (name ? `name:${name}` : null));

/**
 * The best single set for one kind, out of everything on record.
 *
 * ⚠️ TIES GO TO THE EARLIEST DAY. A record is set the first time it is hit, not
 * the last time it is matched — somebody who has benched 225 four times set
 * that record on the first of those days, and re-dating it every time they
 * repeat it would quietly claim they are still improving.
 *
 * @param ctxOn  `contextFor(exercise, bodyWeights)` — the measure context for
 *   a date, so each row is priced at the weigh-in of ITS day.
 */
function bestOf(rows, kind, ctxOn) {
  let best = null;
  for (const row of rows) {
    const m = measure(kind, row.set, ctxOn(row.date));
    if (!m) continue;
    if (!best || m.value > best.value
        || (m.value === best.value && isEarlier(row.date, best.date))) {
      best = {
        kind,
        // ⚠️ For an assisted lift's Weight, `measure()` keys on MINUS the help
        // so the least-assisted set wins; what is reported is the help itself.
        value: kind === 'weight' && m.assisted ? m.weight : m.value,
        weight: m.weight,
        reps: m.reps,
        date: row.date,
        source: row.source,
        assisted: Boolean(m.assisted),
        // ⚠️ THE RULE 5 FLAG, and it rides out of `personal-bests.js`'s own
        // discriminator rather than being decided here, so the two modules
        // cannot end up disagreeing about which kinds are modelled.
        estimated: kind === 'e1rm',
        // The 1RM kind's own facts — what the number IS. Absent on the others.
        ...(kind === 'e1rm' ? {
          total: m.total,
          perSide: Boolean(m.perSide),
          bodyIncluded: Boolean(m.bodyIncluded),
          bodyWeight: m.bodyWeight,
          bodyWeightQuality: m.bodyWeightQuality,
        } : {}),
      };
    }
  }
  return best;
}

// A set with no usable date loses every tie: a dated record is a record you can
// point at, and an undated one is not evidence that it came first.
function isEarlier(a, b) {
  if (a === null) return false;
  if (b === null) return true;
  return a < b;
}

const sameRow = (a, b) =>
  Boolean(a) && Boolean(b) && a.date === b.date && a.weight === b.weight
  && a.reps === b.reps && a.source === b.source;

/**
 * Your best on each lift, across your whole history.
 *
 * @param {Array} sessions            [{ id, date, entries: [{ exerciseId,
 *   exerciseName, sets: [{ weight, reps, minis? }] }] }] — any order.
 * @param {object} [opts]
 * @param {Map}   [opts.exMap]        id → exercise, for `loadType` and for a
 *   name where the stored entry carries none. Optional: without it nothing is
 *   doubled, exactly as in `personalBests()`.
 * @param {Array} [opts.benchmarks]   [{ exerciseId, date, values }] — a
 *   deliberate test is the most considered record there is, so it counts.
 *   ⚠️ Rule 4 / D14 forbid CHARTING benchmarks and workout sets as one line;
 *   they have never said a tested max is not a maximum, and `personalBests()`
 *   has counted them as history since it shipped. `source` says which is which
 *   so a screen may still label it.
 * @param {Array} [opts.bodyWeights]  [{ date, weight }] the weigh-in series, so
 *   a body-weight lift's estimate can include the body it lifted, at the
 *   weight of the set's own day. Optional: without it those lifts have a
 *   `best` and no `estimatedMax`.
 * @param {number} [opts.limit]       how many lifts to return. 0 means all.
 * @returns {{
 *   lifts: Array<{
 *     exerciseId: string|null, name: string, perSide: boolean,
 *     days: number, sets: number, firstDate: string|null, lastDate: string|null,
 *     best: { kind: 'weight'|'reps', value: number, weight: number|null,
 *             reps: number|null, date: string|null,
 *             source: 'workout'|'benchmark', assisted: boolean,
 *             estimated: false },
 *     estimatedMax: { kind: 'e1rm', value, total, weight, reps, date, source,
 *                     perSide, bodyIncluded, assisted, bodyWeight,
 *                     bodyWeightQuality, estimated: true } | null,
 *     sameSet: boolean|null,
 *   }>,
 *   total: number, shown: number, empty: boolean,
 * }}
 *   `total` is every lift that has a best at all; `shown` is how many came
 *   back, so a screen can say "6 of 23" without recounting. `empty` is the
 *   first-run case and it is the NORMAL case, not an edge one.
 *
 *   ⚠️ `days` is distinct CALENDAR DAYS the lift was trained (a benchmark day
 *   counts) and `sets` is every row a maximum could have been read off, drops
 *   and benchmarks included — a benchmark that IS one of the workout's sets
 *   (D17) is one row, not two. They are the thin-history disclosure: a lift
 *   with `days: 1` has a true best and one afternoon behind it, and the screen
 *   is the thing that has to say so.
 *
 *   ⚠️ `best` on an ASSISTED lift is the LEAST help ever used — `assisted: true`
 *   and `value` is that help. `estimatedMax` on a body-weight or assisted lift
 *   is body-inclusive (`bodyIncluded: true`, `bodyWeight` the weigh-in used).
 */
export function bestLifts(sessions, opts = {}) {
  const exMap = opts.exMap && typeof opts.exMap.get === 'function' ? opts.exMap : null;
  const limit = opts.limit === undefined ? DEFAULT_LIMIT : Number(opts.limit);
  const bodyWeights = Array.isArray(opts.bodyWeights) ? opts.bodyWeights : [];

  // key → { exerciseId, name, nameDate, days:Set, rows: [{ set, date, source }] }
  const byExercise = new Map();

  const bucket = (exerciseId, name, date) => {
    const key = keyOf(exerciseId, name);
    if (!key) return null;
    let b = byExercise.get(key);
    if (!b) {
      b = { exerciseId: exerciseId || null, name: name || '', nameDate: null, days: new Set(), rows: [] };
      byExercise.set(key, b);
    }
    // ⚠️ The name from the MOST RECENT day wins. A renamed custom exercise
    // should read as whatever it is called now, not as whatever it was called
    // the first time it was logged.
    if (name && (b.nameDate === null || (date !== null && date >= b.nameDate))) {
      b.name = name;
      b.nameDate = date;
    }
    return b;
  };

  for (const s of sessions || []) {
    if (!s) continue;
    const date = day(s.date);
    for (const e of s.entries || []) {
      if (!e) continue;
      const b = bucket(e.exerciseId, e.exerciseName || e.name, date);
      if (!b) continue;
      // `allSetsOf` is the imported rule: parents AND the drops hanging off
      // them, because a mini-set was really performed and really recorded.
      const sets = allSetsOf(e.sets);
      if (!sets.length) continue;
      if (date !== null) b.days.add(date);
      for (const set of sets) b.rows.push({ set, date, source: 'workout' });
    }
  }

  for (const bm of opts.benchmarks || []) {
    if (!bm || !bm.values) continue;
    const date = day(bm.date);
    const named = bm.exerciseName || (exMap && exMap.get(bm.exerciseId) ? exMap.get(bm.exerciseId).name : '');
    const b = bucket(bm.exerciseId, named, date);
    if (!b) continue;
    if (date !== null) b.days.add(date);
    // ⚠️ D17: a benchmark derived from a workout is ALSO one of that workout's
    // sets, already in `rows`. Relabel the row rather than count it twice —
    // the benchmark is the more deliberate name for the same set.
    const twin = date === null ? null : b.rows.find((r) =>
      r.source === 'workout' && r.date === date
      && Number(r.set.weight) === Number(bm.values.weight)
      && Number(r.set.reps) === Number(bm.values.reps));
    if (twin) twin.source = 'benchmark';
    else b.rows.push({ set: bm.values, date, source: 'benchmark' });
  }

  const lifts = [];
  for (const b of byExercise.values()) {
    // The kind question, asked of a whole history rather than of one session,
    // in `personal-bests.js`'s words. Empty means time/distance only.
    const kinds = kindsFor(b.rows.map((r) => r.set));
    if (!kinds.length) continue;

    const ex = (exMap ? exMap.get(b.exerciseId) : null) || null;
    // The measure context per date — the per-side factor once, the weigh-in
    // per day — from personal-bests.js, so both screens price a body alike.
    const ctxOn = contextFor(ex, bodyWeights);
    const factor = ctxOn(null).factor;

    // 'weight' and 'reps' are mutually exclusive upstream, so exactly one of
    // them is in `kinds` and it is the headline. Neither is modelled.
    const headKind = kinds.includes('weight') ? 'weight' : 'reps';
    const best = bestOf(b.rows, headKind, ctxOn);
    if (!best) continue;

    const estimatedMax = kinds.includes('e1rm') ? bestOf(b.rows, 'e1rm', ctxOn) : null;

    const dates = [...b.days].sort();
    lifts.push({
      exerciseId: b.exerciseId,
      name: b.name || (ex ? ex.name : '') || 'Exercise',
      // ⚠️ So the screen can print "50/side". `best` is one hand's weight and
      // `estimatedMax.value` one hand's max (`.total` is both) — a reader
      // still has to be told which number they are looking at.
      perSide: factor === 2,
      days: b.days.size,
      sets: b.rows.length,
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
      best,
      estimatedMax,
      // null rather than false where there is no estimate, because "they came
      // off different sets" and "there is no estimate" are different facts.
      sameSet: estimatedMax ? sameRow(best, estimatedMax) : null,
    });
  }

  lifts.sort((a, b) =>
    b.days - a.days
    || String(b.lastDate || '').localeCompare(String(a.lastDate || ''))
    || a.name.localeCompare(b.name)
    || String(a.exerciseId || '').localeCompare(String(b.exerciseId || '')));

  const shown = limit > 0 ? lifts.slice(0, limit) : lifts;
  return { lifts: shown, total: lifts.length, shown: shown.length, empty: lifts.length === 0 };
}
