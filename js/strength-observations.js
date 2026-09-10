/* ==========================================================================
   strength-observations.js — stored records → per-muscle evidence.

   The half of the muscle rating that reads a training history: it walks a
   person's sessions and benchmarks, turns every usable set into an observation
   already converted to the muscle's key lift, and hands the lists to
   `rateMuscle()` in muscle-evidence.js. It decides nothing about how good a
   lifter is; it decides what counts as evidence and what the rating never got
   to see.

   WHY IT IS ITS OWN FILE. This walk lived inside `muscleStrength()` in store.js
   and was hard-wired to read MY store. The same ratings are now wanted for a
   FRIEND, computed from their published sessions, and the honest way to get
   them is to pass a different set of rows into the same function. Copying forty
   lines into a friend path would be two answers to "how does a set become
   evidence" the first day one of them changed — the D5 gate, the body-weight-
   of-the-day rule and the prior-volume term are exactly the sort of thing that
   must not fork.

   Pure, and `today` is passed IN rather than read off a clock, so a year of
   training scores the same in a test as it does in the app. No DOM, no store —
   it must never import store.js, which imports it.
   ========================================================================== */

// ⚠️ `isMapRankableSet` RATHER THAN `isRankableSet`, AND THIS IS THE ONLY
// MODULE THAT MAY DO THAT (2026-09-23). The map's gate is 25 because the map
// PRICES a long set at 1/σ² instead of believing it; D5's 15 is untouched
// everywhere a set becomes one printed number. The argument, in full, is on
// MAX_MAP_REPS in e1rm.js — read it before adding a second importer.
import { isMapRankableSet, MAX_EVIDENCE_REPS, MAX_MAP_REPS, e1rm, bodyWeightOn } from './e1rm.js';
import { setE1rm } from './set-e1rm.js';
import { contributionsFor, rankBlockedReason, fatigueFactor } from './muscle-evidence.js';
import { MUSCLE_LIFTS } from './strength-standards.js';
import { volumeContributions } from './volume-map.js';

/**
 * Every set worth rating, grouped by the muscle it is evidence for.
 *
 * @param {object} input
 * @param {Array}  input.sessions     recorded sessions, `entries` in performed order
 * @param {Array}  input.benchmarks   deliberate tests
 * @param {Map}    input.exMap        exerciseId -> exercise
 * @param {Array}  input.bodyWeights  weigh-ins, for the bodyweight movements
 * @param {string} input.today        'YYYY-MM-DD' — never a clock, so this is deterministic
 * @param {string} [input.sex]        'male' | 'female'; anything else means not known
 * @returns {{ byMuscle: Map<string, object[]>, blocked: Map<string, object> }}
 *   `byMuscle` is what rateMuscle() consumes; `blocked` is the work the rating
 *   had to throw away, per muscle, for the panel to own up to.
 *
 * ⚠️ TWO REASONS LAND IN `blocked` SINCE 2026-09-23, and they are independent.
 * An exercise that converts to nothing is refused for its EXERCISE (no published
 * body-weight fraction, no weigh-in), filed under `ex.muscle`. A set longer than
 * MAX_MAP_REPS is refused for its LENGTH even though the exercise converts
 * perfectly well, and is filed under every muscle it contributes to. The second
 * one used to be no reason at all: the gate returned before the bookkeeping, so
 * the map was the one path in the app that dropped a set in silence.
 *
 * ⚠️ `sex` ARRIVES HERE AND GOES STRAIGHT INTO THE CONVERSION (2026-09-13).
 * Roughly a quarter of the RATIOS table is now a male/female pair, because for
 * pulls, body-weight lifts and machines the two sexes genuinely differ by
 * 20-40 % — a woman's pull-up is 1.64 of her barbell row where a man's is 1.28.
 * Omitting it is not an error and never throws: `resolveRatio()` falls back to
 * the mean of the pair, which is what the table did for everybody until today.
 * It is, however, the wrong answer for both sexes, so every caller that knows
 * the profile should pass it.
 */
export function buildObservations({ sessions, benchmarks, exMap, bodyWeights, today, sex }) {
  // ⚠️ Contributions are per exercise AND PER BODY WEIGHT, not per exercise
  // alone. A pull-up done at 200 lb is a different load from the same pull-up at
  // 170, so caching on exerciseId only would score a whole training history at
  // whatever weight happened to be looked up first. The cache key carries both,
  // rounded to the pound because that is the resolution weigh-ins are entered at
  // and an unrounded float would defeat the cache entirely.
  const contribCache = new Map();
  // ⚠️ The sex is NOT part of the cache key, and does not need to be: one call
  // to buildObservations() is one person, so it is constant for the life of
  // this map. Putting it in the key would be harmless and misleading — it would
  // suggest two sexes can share a cache, which is the bug it looks like a guard
  // against.
  const contribFor = (exerciseId, bw) => {
    const key = `${exerciseId}@${bw ? Math.round(bw.weight) + ':' + bw.quality : 'none'}`;
    if (contribCache.has(key)) return contribCache.get(key);
    const ex = exMap.get(exerciseId);
    const c = ex
      ? contributionsFor(ex, bw
        ? { bodyWeight: bw.weight, bodyWeightQuality: bw.quality, sex }
        : { sex })
      : [];
    contribCache.set(key, c);
    return c;
  };

  // What the lifter weighed on a given day, resolved once per DATE rather than
  // once per set — a session with eight sets asks the same question eight times.
  const bwCache = new Map();
  const bodyWeightFor = (date) => {
    if (!bwCache.has(date)) bwCache.set(date, bodyWeightOn(bodyWeights, date));
    return bwCache.get(date);
  };

  const todayDate = new Date(today + 'T00:00:00');
  const ageOf = (date) => {
    const d = new Date(String(date) + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return 0;
    return Math.max(0, Math.round((todayDate - d) / 86400000));
  };

  // muscle -> observations, each already converted to that muscle's KEY LIFT.
  const byMuscle = new Map();
  // muscle -> exerciseName -> { name, sets, reason, fixable }. Work the user
  // really did that the rating had to throw away, kept so the panel can say so.
  const blockedByMuscle = new Map();

  /* One set, refused, written down against one muscle.
   *
   * 🔒 A FUNCTION RATHER THAN THE BOOKKEEPING WRITTEN OUT TWICE (2026-09-23),
   * because there are now TWO independent reasons a set can be refused and they
   * do not fire in the same place — see the rep gate below. Two copies of "make
   * the bag, look the name up, bump the count" is two places for the shape to
   * drift, and the shape is a contract with whatever renders it.
   *
   * ⚠️ FIRST REASON WINS, AND THE SETS STILL ADD UP. One exercise can genuinely
   * collect both refusals under one muscle — a pull-up logged on a day with no
   * weigh-in (no contributions at all) and the same pull-up at 30 reps on a day
   * with one. The entry names the first refusal seen and counts every refused
   * set, which is honest about the total and picks one of two true sentences;
   * the shape has one `reason` slot and inventing a second would break the
   * contract to fix a case that needs a screen decision, not a data one. */
  const noteBlocked = (muscle, name, reason, fixable) => {
    if (!muscle || !name || !reason) return;
    if (!blockedByMuscle.has(muscle)) blockedByMuscle.set(muscle, new Map());
    const bag = blockedByMuscle.get(muscle);
    const prev = bag.get(name) || { name, sets: 0, reason, fixable: Boolean(fixable) };
    prev.sets += 1;
    bag.set(name, prev);
  };

  /* 🚨 THE EXACT SENTENCE, AND ANOTHER MODULE PRINTS IT. Built from
   * MAX_MAP_REPS rather than typed, so the number in the sentence cannot drift
   * from the number in the gate — that pair going out of step would put a wrong
   * figure in front of a user with nothing failing anywhere. */
  const TOO_MANY_REPS = `more than ${MAX_MAP_REPS} reps — this app does not read a maximum off a set that long`;

  const record = (exerciseId, exerciseName, weight, reps, date, isBenchmark, priorByMuscle) => {
    // ⚠️ The body weight of THE DAY OF THE SET, never today's. Somebody who has
    // lost twenty pounds must not have last year's pull-ups re-scored at this
    // year's weight — that would quietly rewrite history every time they
    // stepped on the scales.
    const bw = bodyWeightFor(date);
    const contributions = contribFor(exerciseId, bw);
    if (!contributions.length) {
      // WHY a muscle is grey, when the answer is something the user can act on.
      // Before this, logging thirty sets of pull-ups and being told "nothing
      // recorded for this muscle yet" was true of the rating and a lie about
      // the training. The distinction rankBlockedReason() draws is the one that
      // matters: "log a weigh-in" is actionable, "nobody has measured this
      // exercise" is not, and only the first is worth putting a button under.
      const ex0 = exMap.get(exerciseId);
      const why = ex0 && MUSCLE_LIFTS[ex0.muscle]
        ? rankBlockedReason(ex0, bw ? { bodyWeight: bw.weight } : undefined)
        : null;
      if (why) noteBlocked(ex0.muscle, exerciseName || ex0.name, why, /weigh-in/.test(why));
      return;
    }

    /* ── THE REP GATE, AND IT NOW LEAVES A NOTE ───────────────────────────────
     *
     * 🚨 IT MOVED BELOW THE CONTRIBUTIONS ON 2026-09-23, AND THE MOVE IS THE
     * WHOLE FIX. ~~`if (!isRankableSet(reps)) return;` sat above the block
     * above~~, so a refused set left no observation AND no record that anything
     * had been refused — the one path in the app that drops silently. Tim's
     * calves were the symptom: forty weeks of 20-rep calf raises produced a
     * hatched muscle wearing the sentence written for the Neck, whose problem is
     * that the world publishes no standard at all. One rep was the difference
     * between "Novice, high confidence" and a hatch, and no screen said "reps".
     * `docs/calf-neck-ranking-plan.md` §1.2 proved it against the real modules.
     *
     * ⚠️ A SECOND, INDEPENDENT REASON — NOT A BRANCH OF THE ONE ABOVE. The block
     * above fires only when an exercise contributes to NOTHING. A 30-rep
     * standing calf raise has perfectly good contributions and is refused purely
     * for its length, so it is recorded against THE MUSCLES IT CONTRIBUTES TO
     * and never against `ex.muscle`: a Leg Press Calf Raise is filed under
     * `Legs` in the library and the work that was thrown away was the Calves'.
     * Reading `ex.muscle` here would have put the sentence on the wrong muscle's
     * panel — true words, wrong screen, which is worse than silence.
     *
     * ⚠️ NO REP COUNT IS NOT THE SAME AS TOO MANY REPS. A set with a missing or
     * unparseable rep field is dropped exactly as it always was, silently: it is
     * not evidence, and it is not "a set that long" either. Only a real number
     * above the ceiling earns the sentence.
     *
     * 🛑 A BENCHMARK GETS NO EXEMPTION, as it never did. A 40-rep benchmark is no
     * more evidence of a maximum than a 40-rep set, and it is refused in the
     * same words. */
    const r = Number(reps);
    if (!isMapRankableSet(r)) {
      if (Number.isFinite(r) && r > MAX_MAP_REPS) {
        for (const c of contributions) {
          noteBlocked(c.muscle, exerciseName || (exMap.get(exerciseId) || {}).name || exerciseId,
            TOO_MANY_REPS, false);
        }
      }
      return;
    }

    const ex = exMap.get(exerciseId);
    /* Ratios are in TOTAL load. A dumbbell row entered as 80 is 160 on the body,
     * and comparing the 80 against a barbell row would make every dumbbell
     * lifter look weak.
     *
     * ⚠️ SINCE 2026-09-13 THE CURVE IS APPLIED PER HAND AND THE RESULT DOUBLED,
     * rather than the curve being applied to the doubled load. Both give a
     * "total", and they are not the same total: k(w) grows with the log of the
     * weight, so e1rm(160, 8) is 209 lb where 2 x e1rm(80, 8) is 220 — five
     * percent, on every dumbbell lift in the app. Marzagão was fitted with
     * dumbbells logged per hand and the ratio table was derived from Strength
     * Level's per-dumbbell rows doubled, so per-hand is the convention both of
     * this line's inputs already speak.
     *
     * 🚨 IT IS `setE1rm()` RATHER THAN THE ARITHMETIC WRITTEN OUT HERE, and
     * that is the actual fix. The old two lines were correct and were also the
     * seventh copy of "how does a set become a 1RM" in the codebase; four of
     * the other six had the assist sign or the doubling wrong, which is how
     * taking MORE help off an assisted pull-up came to be a personal best. One
     * function, one convention, one place to be wrong. */
    /* 🚨 `setE1rm()` IS ASKED AT D5'S CEILING AND THE CURVE IS THEN WALKED OUT
     * BY A RATIO — 2026-09-23. It is deliberately NOT asked about a 20-rep set,
     * and this is the load-bearing half of the map's higher ceiling.
     *
     * `setE1rm()` enforces D5 itself and MUST keep doing so: it is the single
     * entry point every printed maximum in the app comes through, and the day
     * four of seven hand-built copies of the load convention had the assist sign
     * or the dumbbell doubling wrong is why it exists at all. Loosening it would
     * hand a 20-rep set to the personal-bests table and the Data tab, which is
     * exactly what MAX_MAP_REPS was made narrow to avoid.
     *
     * So the map asks it the question it is allowed to answer — the convention
     * at 15 reps — and moves along the SAME curve to the real rep count as a
     * RATIO. The three things that make this exact rather than approximate:
     *
     *   · `load`, `perSide`, `perSideWeight` and `quality` do not depend on the
     *     rep count at all. They are the convention: per hand on a dumbbell,
     *     fraction × body weight ± the logged number on a body-weight lift.
     *   · `curveWeight` is the number the curve was actually fed, and a ratio of
     *     two `e1rm()` calls on it CANCELS the per-side doubling — so nothing
     *     here restates D30 and there is no second copy to get wrong.
     *   · `dominate()` in muscle-evidence.js already re-reads a set at a
     *     DIFFERENT rep count this exact way, off this exact field. This is that
     *     technique pointed the other direction: it truncates downward, this
     *     extends upward, and both are one curve evaluated twice.
     *
     * ⚠️ At or below 15 the call is byte-for-byte what it was, `over` is false
     * and no ratio is computed — an unchanged path for every set the app has
     * ever rated. */
    const over = r > MAX_EVIDENCE_REPS;
    const scored = setE1rm(ex, weight, over ? MAX_EVIDENCE_REPS : reps, bw
      ? { bodyWeight: bw.weight, bodyWeightQuality: bw.quality }
      : undefined);
    if (!scored) return;
    const load = scored.load;
    const curveWeight = scored.perSide ? scored.perSideWeight : scored.load;
    let raw = scored.e1rm;
    if (over) {
      const at = e1rm(curveWeight, r);
      const was = e1rm(curveWeight, MAX_EVIDENCE_REPS);
      // Refuse rather than fall back. A missing scale factor would silently
      // score a 20-rep set as a 15-rep one — a FLATTERING failure, and the one
      // direction this whole change is being careful about.
      if (!(at > 0) || !(was > 0)) return;
      raw *= at / was;
    }

    for (const c of contributions) {
      if (!byMuscle.has(c.muscle)) byMuscle.set(c.muscle, []);
      // ⚠️ How much work this muscle had ALREADY TAKEN when this exercise
      // started, which is the term rateMuscle() needs to tell a heavy set from
      // a tired one. Absent for a benchmark, and rightly so: a benchmark is its
      // own session and has nothing in front of it.
      const priorVolume = (priorByMuscle && priorByMuscle.get(c.muscle)) || 0;
      byMuscle.get(c.muscle).push({
        estimate: raw / c.ratio,
        rawE1rm: raw,
        quality: c.quality,
        kind: c.kind,
        via: c.via,
        // ⚠️ A SECOND FIELD, NOT A SECOND MEANING FOR `via`. `via` is the muscle
        // a fallback came through; this is the library exercise a USER matched
        // their own exercise to. See contributionsFor() for why they are not one
        // field — a value whose meaning depends on reading `kind` first is
        // correct until somebody reads it without `kind`.
        standInName: c.standInName || null,
        ratio: c.ratio,
        reps: Math.round(Number(reps)),
        weight: Number(weight),
        /* 🆕 THE WEIGHT THE CURVE WAS ACTUALLY APPLIED TO — 2026-09-20, and it
         * is not `weight` for two of the three load types. `setE1rm()` feeds the
         * curve the PER-HAND number on a dumbbell lift and doubles the result
         * (D30), and the TOTAL RESISTANCE on a body-weight one, so `weight` — the
         * pounds the lifter typed — is the curve's input only for a plain barbell
         * or machine set.
         *
         * It is carried because `rateMuscle()` needs to re-read a set at FEWER
         * reps for the dominance rule, and the only alternative was to
         * re-implement the three-branch convention there. A second copy of D30's
         * arithmetic is precisely what D30 was recorded to prevent — so the
         * input travels with the observation instead. */
        curveWeight,
        loadType: ex ? ex.loadType : 'total',
        date,
        ageDays: ageOf(date),
        isBenchmark: Boolean(isBenchmark),
        exerciseId,
        exerciseName: exerciseName || (ex ? ex.name : exerciseId),
        source: isBenchmark ? 'benchmark' : 'workout',
        priorVolume,
        fatigueFactor: fatigueFactor(priorVolume),
      });
    }
  };

  for (const b of benchmarks || []) {
    const v = b.values || {};
    record(b.exerciseId, b.exerciseName, v.weight, v.reps, b.date, true);
  }
  for (const s of sessions || []) {
    // ⚠️ WALKED IN ORDER, and the order is the whole point. `entries` is stored
    // in the order the workout was performed, so everything before the current
    // entry is work this lifter had already done when they reached it.
    //
    // ⚠️ Counted with volume-map.js's own weights rather than a second opinion —
    // direct 1.0, indirect 0.5. That module exists to answer "how much work
    // landed on this muscle", which is exactly the question here, and a private
    // tally would be a third muscle table to keep in sync with the other two.
    const priorByMuscle = new Map();
    for (const entry of s.entries || []) {
      const sets = entry.sets || [];
      for (const set of sets) {
        record(entry.exerciseId, entry.exerciseName, set.weight, set.reps, s.date,
          Boolean(s.isBenchmark), priorByMuscle);
      }
      // ⚠️ AFTER this exercise's own sets are recorded, never before. An
      // exercise does not fatigue itself: its first set is as fresh as the
      // lifter was when they walked up to it, and charging it for its own
      // volume would discount every first exercise in every session.
      const ex = exMap.get(entry.exerciseId);
      if (!ex) continue;
      for (const c of volumeContributions(ex)) {
        priorByMuscle.set(c.muscle, (priorByMuscle.get(c.muscle) || 0) + sets.length * c.weight);
      }
    }
  }

  // Blocked work is reported for EVERY rankable muscle, not only the grey ones.
  // A muscle can be rated off a barbell row and still be throwing away every
  // pull-up the user has done, and that is worth saying in exactly the same
  // words — the alternative is a panel that quietly under-reports its own
  // evidence and looks complete while doing it.
  const blocked = new Map();
  for (const [muscle, bag] of blockedByMuscle) {
    const list = [...bag.values()].sort((a, b) => b.sets - a.sets);
    blocked.set(muscle, {
      exercises: list,
      sets: list.reduce((n, e) => n + e.sets, 0),
      // Is there something the user can DO about it? Only a missing weigh-in
      // is fixable; "nobody has measured this exercise" is not, and offering a
      // button for it would be a false promise.
      // ⚠️ NOR IS THE REP REFUSAL, and it is the one most likely to look like it
      // is (2026-09-23). "Log a heavier set of eight" IS something a person can
      // go and do — but it is a training instruction, not a button, and this
      // flag exists to decide whether the panel puts a control under the
      // sentence. `fixable: false` on it, so a muscle blocked only for reps
      // offers no control and the sentence carries the whole message.
      fixable: list.some((e) => e.fixable),
    });
  }

  return { byMuscle, blocked };
}
