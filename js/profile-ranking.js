/* ==========================================================================
   profile-ranking.js — "where do my best lifts sit, against people like me?"

   Pure: no DOM, no store, no clock, no network. Sessions, benchmarks, the
   exercise map, the muscle ratings and the profile are all handed in, exactly
   like `profile-records.js`, `compare.js` and `strength-observations.js`. It
   must never import `store.js`.

   ── WHY THIS IS NOT INSIDE `profile-records.js` ─────────────────────────────

   That module answers a MEASURED question — what is the heaviest set you have
   ever held — and it imports one file. This one answers a MODELLED question:
   what would you lift for one rep, and where does that put you among people
   who lift. It needs the ratio table, the estimator and the standards, which is
   most of the rating stack. Two questions, two files; the measured one stays
   small and importable by anything, and the model is imported from here.

   Tim, 2026-09-12: *"For the 'Your best lifts' section in the profile menu, I
   want to display the core lifts, and then have 'other lifts' in an expandable
   section below it. … Instead of displaying this as the weight and reps, just
   show the weight of an estimated 1RM for each of these, and show the
   confidence below it. Additionally, colorize the number based on where that
   measurement puts that user among people like them … Order the core lifts
   from highest ranking exercise (beginner-elite) to lowest, and do the same for
   ordering the other lifts."*

   ── THE CORE LIFTS, AND WHY THESE EIGHT ─────────────────────────────────────

   Tim named four — Squat, Bench, Deadlift, Overhead Press — and asked for
   *"maybe 3-4 more core ones that summarize that user's strength as a whole"*.
   The app already has an answer to "which lift summarises a muscle": the key
   lift of each muscle in `MUSCLE_LIFTS`, the one its standards are published
   for. So the core list is the key lift of every muscle that describes
   whole-body strength — the four he named plus Barbell Row (Back), Romanian
   Deadlift (Hamstrings), Barbell Curl (Biceps) and Close-Grip Bench Press
   (Triceps). Eight lifts, eight muscles, none invented here.

   ⚠️ FOUR MUSCLES ARE DELIBERATELY NOT CORE, and each for its own reason:
     · Core — its key lift is Cable Crunch, which `MUSCLE_LIFTS` itself says
       rests on one measured source, a σ half again as wide as every other
       lift's and a standard-quality penalty. A quarter of ab training happens
       on a cable stack; the rest is unrankable. Putting it beside the squat as
       a headline lift would present the thinnest standard in the table as one
       of the eight numbers that summarise a person.
     · Traps, Calves, Forearms — real standards, but assistance muscles. A
       shrug does not summarise anybody's strength as a whole, and Tim's list
       was compounds. They still appear, ranked, under "other lifts" the day
       they are trained.

   ── WHAT THE 1RM IS, AND IT IS TWO DIFFERENT THINGS, LABELLED ───────────────

   🚨 `source` SAYS WHICH, AND THE SCREEN MUST PRINT IT (Rule 5).

     'recorded'   The lift's OWN best set through the app's own rep curve —
                  the `estimatedMax` that `bestLifts()` already computes
                  (`set-e1rm.js`: per hand then doubled, body included, assist
                  inverted), in total load. This is what "your best lifts"
                  means: the number rests on sets of THIS exercise that really
                  happened, and `best` carries THAT SET so it can be checked.

     'converted'  Nothing rankable of this lift on record, so the number is the
                  muscle's rating multiplied back out through the ratio table
                  — `estimateOneRM()`, the body map's arithmetic run backwards.
                  `from` names the exercises it was converted from.

   ⚠️ WHY A RECORDED LIFT IS NOT ALSO PUT THROUGH `estimateOneRM()`. It was
   argued both ways and the recorded set won, for two reasons that are about
   what the reader is asking rather than about arithmetic:

     1. The muscle rating is a winsorised blend of up to three exercises. A
        squat "1RM" printed off a rating that a leg press led would be a number
        no squat set of theirs supports, under the heading "your best lifts".
     2. Every exercise of one muscle would land on the SAME percentile — the
        key-lift equivalent of a converted number is the rating itself — so
        "order the other lifts by rank" would have sorted them by muscle and
        then by name, which is not what was asked.

   The price is that a single best set has none of the rating's protection
   against a fat-finger typo (§9: the winsoriser does not catch a ×10 either).
   What holds the line is Rule 5 done properly: `best` carries the weight, the
   reps and the day, and `days` says how much history stands behind it.

   🔄 2026-09-13 — `best` IS THE SET THAT PRODUCED THE NUMBER (plan §2.6). Until
   today `best` was the HEAVIEST set while `oneRM` came off the best-ESTIMATE
   set, and the screen printed "265 lbs · Proficient" over "215 × 3" when the
   265 belonged to a hidden 185 × 12 (e1rm(215, 3) is 236). `sameSet: false`
   existed for exactly this and was ignored. Now the anchor is `estimatedMax`'s
   own set — the number and its set agree — and the heaviest set survives as
   `heaviest` for a screen that wants both. The other reading (print the
   heaviest set and ITS e1RM) was rejected because it would silently change
   which number "your best lift" is: `bestLifts()` chooses the best estimate,
   and this file's argument above is that a recorded lift shows the set it
   rests on, not the set that looks best.

   🔄 2026-09-13 — BODY-WEIGHT LIFTS TAKE THE RECORDED BRANCH TOO. `bestLifts()`
   now prices a pull-up with the lifter's body at the weigh-in of the set's
   day, so `estimatedMax` for one is a real max of the movement and
   `bodyIncluded` tells the screen so. They were diverted to the converted
   branch only because the old estimate was e1rm(the plate on the belt).

   🔄 2026-09-13 — `ageDays` (plan §2.7 / the audit's D14). This list never
   decays — a best is a best — where the muscle map's weight halves every 120
   days. The honest version of that difference is information: every recorded
   row says how old its set is, and past `STALE_SET_DAYS` the screen prints it.

   🔄 2026-09-13 — THE DUMBBELL CONVENTION (plan §2.8, Tim's §4.e): per hand
   into the curve, then doubled. ~~This file argued for the total — "the curve
   has to see the load the body saw"~~ — struck: Marzagão was fitted with
   dumbbells logged PER HAND (research.md §1.3), and the ratio table was derived
   from Strength Level's per-dumbbell tables doubled, so the per-hand number is
   the one the coefficients and the ratios both mean. `setE1rm()` owns it;
   nothing here calls `e1rm()` any more.

   ── THE LEVEL, FOR A LIFT THAT IS NOT A KEY LIFT ────────────────────────────

   Standards exist for the key lift only, so a non-key lift is ranked by its
   KEY-LIFT EQUIVALENT: total load DIVIDED by its ratio — `estimate: raw /
   c.ratio` in `contributionsFor()`'s callers, the same direction the body map
   converts in. The ratio is the best-quality DIRECT contribution, chosen by
   the rule `estimateOneRM()` uses, so a chin-up (Back and Biceps) is ranked
   through the ratio worth believing most and not the muscle the library lists
   first. A lift with no direct ratio has a number but no level, and sits at
   the bottom of its list rather than being dropped.

   "People like them" is the account's own comparison setting — `profile.compare`
   — passed through `withAssumptions()`, which substitutes a missing sex or
   weigh-in the way the muscle map has since 2026-09-06 and REPORTS what it
   assumed. That list comes back as `assumed` and the screen is required to say
   it, or a percentile sits on screen beside a comparison group it was not
   computed against.

   ── CONFIDENCE, AND WHY THE TWO KINDS OF ROW PRICE IT DIFFERENTLY ───────────

   A converted row carries `estimateOneRM()`'s confidence untouched: the
   rating's own credence times the conversion's quality, capped and banded
   there. A recorded row has no rating in it, so that number would be about
   the wrong thing. It is priced from the two doubts it actually has:

     `repFactor(reps)`   how far the rep curve extrapolated — a triple is worth
                         1.00, a set of twelve 0.45 (muscle-evidence.js)
     `ratio.quality`     how well the conversion to the STANDARD is known,
                         because the level is read through it. 1.00 for a key
                         lift; a machine's 0.35 pulls the band down even though
                         the pounds themselves were never converted.

   Both are already on 0..1 and both already mean "believe this much", and
   multiplying them is the idiom the estimator uses for two hops. It is a BAND
   NAME on the way out, never a ± figure: nothing in this project has fitted
   the error a ratio of quality q adds, and a guessed ± is a guess in a
   measurement's clothes (§9).

   ── RULE 5 IN THE RETURN SHAPE ──────────────────────────────────────────────

   Every row carries `estimated: true` — including a recorded one, whose 1RM
   is a model of a set, not a set — and the measured set rides beside it in
   `best` under a different name. There is no field a screen can print as a
   measurement by accident. Rule 6: no verdict word appears here; the colour
   is the screen's, and it is the existing level ramp.

   ── ORDERING ────────────────────────────────────────────────────────────────

   Highest level first, by percentile descending; a lift with no percentile
   last; ties by name, then id, so one history always produces one list. Both
   lists. This IS ranking by rank rather than by pounds, which Rule 6 forbids
   — and it is the thing Tim asked for by name: a percentile against people
   like you is a property of the lifter, where pounds are a property of the
   barbell.
   ========================================================================== */

import { bestLifts } from './profile-records.js';
import { estimateOneRM } from './exercise-estimate.js';
import { contributionsFor, confidenceBand, repFactor } from './muscle-evidence.js';
import {
  MUSCLE_LIFTS, keyLiftFor, percentileFor, levelFor, withAssumptions,
} from './strength-standards.js';
import { bodyWeightFractionFor } from './exercises.js';

/**
 * Past this many days a recorded row's set is old enough that the screen says
 * so. It is the muscle map's WEIGHT half-life (`WEIGHT_HALF_LIFE_DAYS` in
 * muscle-evidence.js, 120): the day the map would be trusting that set at half
 * strength is the day this list — which never discounts — owes the reader a
 * date.
 */
export const STALE_SET_DAYS = 120;

function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : null;
}

/** Whole days from `date` to `today`; null when either is not a calendar day. */
function ageDaysOf(date, today) {
  const a = dayNumber(date), b = dayNumber(today);
  if (a === null || b === null) return null;
  return Math.max(0, Math.round(b - a));
}

/**
 * The muscles whose key lifts summarise whole-body strength — see the header
 * for why Core, Traps, Calves and Forearms are not here. Order is Tim's four
 * first, then the rest; the SCREEN order is by rank, never this.
 */
export const CORE_MUSCLES = [
  'Quads',       // Back Squat
  'Chest',       // Barbell Bench Press
  'Glutes',      // Deadlift
  'Shoulders',   // Overhead Press
  'Back',        // Barbell Row
  'Hamstrings',  // Romanian Deadlift
  'Biceps',      // Barbell Curl
  'Triceps',     // Close-Grip Bench Press
];

/** The eight core lifts, named from the standards table rather than typed here. */
export const CORE_LIFTS = CORE_MUSCLES.map((muscle) => ({ muscle, name: MUSCLE_LIFTS[muscle].lift }));

/**
 * The ratio a lift is ranked through: its best-quality DIRECT contribution,
 * by the same rule `estimateOneRM()` picks its conversion. Null when the
 * library has no published way to convert this lift.
 *
 * @param {object} opts  { sex, bodyWeight, bodyWeightQuality }
 *   `sex` — the ratios are sex-specific (plan §3.6): a woman's pull-up is a
 *   different fraction of her row than a man's is of his. It is the sex the
 *   PERCENTILE is computed against (`withAssumptions()`'s overlay), so the two
 *   hops of one row read one population; when it was assumed, `assumed` says.
 *   `bodyWeight` — for a body-weight lift, the weigh-in the SET was priced at
 *   (`estimatedMax.bodyWeight`), so `contributionsFor()` admits it and prices
 *   the fraction and the weigh-in into `quality`. A plain lift ignores it.
 */
function ratioFor(exercise, opts) {
  const o = {};
  if (opts && opts.sex) o.sex = opts.sex;
  if (opts && Number(opts.bodyWeight) > 0) {
    o.bodyWeight = Number(opts.bodyWeight);
    if (Number(opts.bodyWeightQuality) > 0) o.bodyWeightQuality = Number(opts.bodyWeightQuality);
  }
  const best = contributionsFor(exercise, Object.keys(o).length ? o : undefined)
    .filter((c) => c.kind === 'direct' && c.ratio > 0 && c.quality > 0)
    .sort((a, b) => b.quality - a.quality)[0];
  return best || null;
}

/**
 * The measured set a recorded row rests on — `estimatedMax`'s own set, which
 * is the set that PRODUCED the number (plan §2.6). Measured, so `estimated` is
 * false; `weight` is null for a body-weight rep with nothing added.
 */
function anchorOf(own) {
  return {
    weight: own.weight, reps: own.reps, date: own.date, source: own.source,
    assisted: Boolean(own.assisted), estimated: false,
  };
}

/**
 * One ranked row for one exercise.
 *
 * @param {object|null} exercise  library entry, or null when the history names
 *   an exercise the library cannot resolve (an import, a deleted custom one)
 * @param {object|null} rec       the `bestLifts()` entry for it, if trained
 * @param {object} ctx            { muscles (muscle -> rating), ranked (the
 *   profile AFTER `withAssumptions()`), bodyWeight (latest weigh-in, for the
 *   converted branch), sex, today }
 * @param {string|null} muscle    the core muscle this row stands for, or null
 */
function rowFor(exercise, rec, ctx, muscle) {
  const { muscles, ranked, bodyWeight, sex, today } = ctx;
  const name = (rec && rec.name) || (exercise && exercise.name) || 'Exercise';
  const own = rec && rec.estimatedMax;
  const perSide = own ? Boolean(own.perSide) : Boolean(exercise && exercise.loadType === 'per_side');
  const bodyIncluded = own ? Boolean(own.bodyIncluded) : Boolean(exercise && bodyWeightFractionFor(exercise));

  const row = {
    exerciseId: (rec && rec.exerciseId) || (exercise && exercise.id) || null,
    name,
    muscle,
    // 🚨 THE RULE 5 FLAG, on every row without exception. A recorded row's 1RM
    // is a model of a set — the set itself is in `best`, under its own name.
    estimated: true,
    oneRM: null,
    shown: null,
    perSide,
    bodyIncluded,
    assisted: Boolean(own && own.assisted),
    confidence: null,
    band: null,
    percentile: null,
    level: null,
    days: rec ? rec.days : 0,
    lastDate: rec ? rec.lastDate : null,
    // `best` is the set the NUMBER came off (see the header, §2.6); `heaviest`
    // is the heaviest set ever held, which may be a different afternoon.
    best: own ? anchorOf(own) : null,
    heaviest: rec ? rec.best : null,
    ageDays: own ? ageDaysOf(own.date, today) : null,
    source: null,
    from: [],
    ratio: null,
    // Why there is no number, when there is none. Keys, not sentences: the
    // screen owns the words.
    why: null,
  };

  /* ── RECORDED: the lift's own best set, through the app's own curve ──────
   *
   * `own.total` is the whole load's max (both dumbbells, body included) and
   * `own.value` is the figure the lifter recognises (one hand's, for a
   * per-side lift). A body-weight lift lands here too since 2026-09-13: its
   * `estimatedMax` now has the body in it, at the weigh-in of the set's day,
   * so the ratio — measured on total resistance — is applied to a total. */
  if (own) {
    row.oneRM = own.total;
    row.shown = own.value;
    row.source = 'recorded';
    row.from = [name];
    const via = exercise
      ? ratioFor(exercise, { sex, bodyWeight: own.bodyWeight, bodyWeightQuality: own.bodyWeightQuality })
      : null;
    if (via) {
      row.muscle = via.muscle;
      row.ratio = via.ratio;
      // ⚠️ Two doubts multiplied — see the header. A key lift at three reps is
      // 1.00 × 1.00; a machine at twelve reps is 0.35 × 0.45. On a pull-up the
      // ratio's quality already carries the fraction's and the weigh-in's.
      row.confidence = Math.max(0, Math.min(1, repFactor(own.reps) * via.quality));
      row.percentile = percentileFor(own.total / via.ratio, via.muscle, ranked);
      row.level = row.percentile === null ? null : levelFor(row.percentile);
      if (row.percentile === null) row.why = 'no-standard';
    } else {
      // A number with nothing to rank it against: the pounds are theirs and
      // the rep curve is the only inference, so that is the only doubt priced.
      // (Also the NO-LIBRARY case — an import, a deleted custom exercise.)
      row.confidence = repFactor(own.reps);
      row.why = 'no-conversion';
    }
    row.band = confidenceBand(row.confidence);
    return row;
  }

  /* ── CONVERTED: the muscle's rating, multiplied back out ─────────────────
   *
   * 🚨 DEFAULT OPTIONS. `allowFallback` has exactly one named caller (the
   * benchmark form, a read-only screen that prints both hops) and this is not
   * it. A core lift whose muscle has only a stand-in rating comes back with no
   * number and `why: 'stand-in-only'`, and the screen says so — three
   * estimates multiplied is the chain exercise-estimate.js refuses by default,
   * and a headline list of eight is the last place to quietly reopen it.
   * `sex` rides along for the ratio table's sake; the module may ignore it. */
  if (exercise) {
    const est = estimateOneRM(exercise, muscles, bodyWeight, sex ? { sex } : undefined);
    if (est) {
      row.oneRM = est.oneRM;
      row.shown = est.shown;
      row.confidence = est.confidence;
      row.band = est.band;
      row.muscle = est.muscle;
      row.ratio = est.ratio;
      row.from = est.from;
      row.source = 'converted';
      // The key-lift equivalent of a converted number is the rating itself —
      // oneRM / ratio — which is the number the body map ranks this muscle by.
      row.percentile = percentileFor(est.oneRM / est.ratio, est.muscle, ranked);
      row.level = row.percentile === null ? null : levelFor(row.percentile);
      if (row.percentile === null) row.why = 'no-standard';
      return row;
    }
    // No estimate. Say which of the module's refusals it was, because "log
    // something for this muscle" and "this muscle is rated only by a stand-in"
    // are different sentences and only the first is a thing to act on.
    const via = ratioFor(exercise, { sex, bodyWeight });
    const rating = via ? muscles.get(via.muscle) : null;
    row.muscle = via ? via.muscle : muscle;
    row.why = !via ? 'no-conversion'
      : !rating ? 'no-evidence'
        : rating.kind === 'fallback' ? 'stand-in-only'
          : 'no-evidence';
    return row;
  }

  /* ── NO LIBRARY ENTRY AND NO ESTIMATE: nothing to show, nothing to rank ── */
  row.why = 'no-conversion';
  return row;
}

// Highest level first; no percentile last; ties by name, then id.
function byRank(a, b) {
  const pa = a.percentile === null ? -1 : a.percentile;
  const pb = b.percentile === null ? -1 : b.percentile;
  return (pb - pa)
    || a.name.localeCompare(b.name)
    || String(a.exerciseId || '').localeCompare(String(b.exerciseId || ''));
}

/**
 * Your best lifts, ranked — the core eight always, and everything else you
 * have trained.
 *
 * @param {object} input
 * @param {Array}  input.sessions     recorded sessions, any order
 * @param {Array}  [input.benchmarks] deliberate tests — count, as in bestLifts()
 * @param {Map}    input.exMap        exerciseId -> exercise, the whole library
 * @param {Map}    input.muscles      muscle -> rating, from `muscleRatings()`
 * @param {object} input.profile      as `store.getProfile()` returns it; the
 *   comparison group is `profile.compare`, the sex `profile.gender`
 * @param {number} [input.bodyWeight] latest weigh-in; defaults to the profile's
 * @param {Array}  [input.bodyWeights] the dated weigh-in series, so a pull-up's
 *   own max includes the body at the weight of the set's day
 * @param {string} [input.today]      'YYYY-MM-DD', for `ageDays`. No clock is
 *   read here; without it no row has an age.
 * @returns {{
 *   core: Lift[], other: Lift[],
 *   repsOnly: Array<{ exerciseId, name, reps, days, lastDate }>,
 *   assumed: string[], profile: object, estimated: true,
 * }}
 *
 *   Lift = { exerciseId, name, muscle, estimated: true,
 *            oneRM (total lb | null), shown (per-side lb | null), perSide,
 *            bodyIncluded, assisted, confidence (0..1 | null), band
 *            (CONFIDENCE_BANDS entry | null), percentile (0.1..99.9 | null),
 *            level (LEVELS entry | null — null with a percentile means below
 *            Beginner), days, lastDate,
 *            best (the measured set the number was modelled FROM — weight,
 *              reps, date, source, assisted, estimated: false — or null),
 *            heaviest (bestLifts()'s measured headline: the heaviest set, or
 *              the least help; may be a different day from `best`),
 *            ageDays (days from `best.date` to `today`, or null),
 *            source: 'recorded' | 'converted' | null, from: string[],
 *            ratio, why: null | 'no-evidence' | 'stand-in-only' |
 *            'no-conversion' | 'no-standard' }
 *
 *   `core` always has exactly CORE_LIFTS.length rows — a core lift is never
 *   dropped, it comes back with `oneRM: null` and a `why`. `other` is every
 *   other lift with a loaded best. `repsOnly` is what was trained by reps
 *   alone (pull-ups with no weigh-in, push-ups): a true best with no honest
 *   pound figure, listed so it is not lost rather than dressed as a 1RM.
 *   `assumed` is `withAssumptions()`'s list and `profile` is the overlay the
 *   percentiles were computed against — pass THAT to `comparisonLabel()`, not
 *   the raw profile, or the caption names a group the colours were not built
 *   from.
 */
export function rankedLifts({
  sessions, benchmarks, exMap, muscles, profile, bodyWeight, bodyWeights, today,
} = {}) {
  const map = exMap && typeof exMap.get === 'function' ? exMap : new Map();
  const ratings = muscles && typeof muscles.get === 'function' ? muscles : new Map();
  const ranked = withAssumptions(profile);
  const bw = Number(bodyWeight) > 0 ? Number(bodyWeight) : Number(ranked.bodyWeight) || 0;
  // ⚠️ THE SEX THE PERCENTILE IS COMPUTED AGAINST, assumed or not — so the ratio
  // hop and the percentile hop of one row read the same population, and when
  // it was assumed the screen already says so from `assumed`.
  const ctx = { muscles: ratings, ranked, bodyWeight: bw, sex: ranked.gender || null, today: today || null };

  const recorded = bestLifts(sessions, { exMap: map, benchmarks, limit: 0, bodyWeights }).lifts;

  // Resolve by id, then by NAME — an imported session carries a name and no id
  // (import-file.js), and a Squat imported from another app is still a squat.
  const byName = new Map();
  for (const ex of map.values()) if (ex && ex.name && !byName.has(ex.name)) byName.set(ex.name, ex);
  const resolve = (rec) => (rec.exerciseId && map.get(rec.exerciseId)) || byName.get(rec.name) || null;

  const recById = new Map();
  const repsOnly = [];
  const others = [];
  for (const rec of recorded) {
    const ex = resolve(rec);
    const id = ex ? ex.id : null;
    if (id) recById.set(id, rec);
    if (rec.best && rec.best.kind === 'reps') {
      repsOnly.push({
        exerciseId: id, name: rec.name, reps: rec.best.value, days: rec.days, lastDate: rec.lastDate,
      });
      continue;
    }
    others.push({ rec, ex });
  }

  const coreIds = new Set();
  const core = CORE_MUSCLES.map((muscle) => {
    const key = keyLiftFor(muscle);
    const ex = key && key.id ? map.get(key.id) : null;
    if (ex) coreIds.add(ex.id);
    return rowFor(ex, ex ? recById.get(ex.id) || null : null, ctx, muscle);
  });

  const other = others
    .filter(({ ex }) => !(ex && coreIds.has(ex.id)))
    .map(({ rec, ex }) => rowFor(ex, rec, ctx, null));

  core.sort(byRank);
  other.sort(byRank);
  repsOnly.sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));

  return { core, other, repsOnly, assumed: ranked.assumed, profile: ranked, estimated: true };
}
