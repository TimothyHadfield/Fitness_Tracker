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

import { e1rm, isRankableSet, bodyWeightOn } from './e1rm.js';
import { contributionsFor, setLoad, rankBlockedReason, fatigueFactor } from './muscle-evidence.js';
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
 * @returns {{ byMuscle: Map<string, object[]>, blocked: Map<string, object> }}
 *   `byMuscle` is what rateMuscle() consumes; `blocked` is the work the rating
 *   had to throw away, per muscle, for the panel to own up to.
 */
export function buildObservations({ sessions, benchmarks, exMap, bodyWeights, today }) {
  // ⚠️ Contributions are per exercise AND PER BODY WEIGHT, not per exercise
  // alone. A pull-up done at 200 lb is a different load from the same pull-up at
  // 170, so caching on exerciseId only would score a whole training history at
  // whatever weight happened to be looked up first. The cache key carries both,
  // rounded to the pound because that is the resolution weigh-ins are entered at
  // and an unrounded float would defeat the cache entirely.
  const contribCache = new Map();
  const contribFor = (exerciseId, bw) => {
    const key = `${exerciseId}@${bw ? Math.round(bw.weight) + ':' + bw.quality : 'none'}`;
    if (contribCache.has(key)) return contribCache.get(key);
    const ex = exMap.get(exerciseId);
    const c = ex
      ? contributionsFor(ex, bw ? { bodyWeight: bw.weight, bodyWeightQuality: bw.quality } : undefined)
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

  const record = (exerciseId, exerciseName, weight, reps, date, isBenchmark, priorByMuscle) => {
    // D5: a maximum is not inferred from a set above 15 reps. Without this the
    // formula extrapolates a 135x25 burnout set to 258 lb, which beats a real
    // 205x5 top set and moves the muscle a whole level on the back of the least
    // informative set of the week. A benchmark gets no exemption — a 25-rep
    // benchmark is no more evidence of a max than a 25-rep set is.
    if (!isRankableSet(reps)) return;
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
      if (why) {
        if (!blockedByMuscle.has(ex0.muscle)) blockedByMuscle.set(ex0.muscle, new Map());
        const bag = blockedByMuscle.get(ex0.muscle);
        const name = exerciseName || ex0.name;
        const prev = bag.get(name) || { name, sets: 0, reason: why, fixable: /weigh-in/.test(why) };
        prev.sets += 1;
        bag.set(name, prev);
      }
      return;
    }

    const ex = exMap.get(exerciseId);
    // Ratios are in TOTAL load. A dumbbell row entered as 80 is 160 on the body,
    // and comparing the 80 against a barbell row would make every dumbbell
    // lifter look weak. setLoad() routes a bodyweight or assisted movement
    // through the body-weight arithmetic and everything else straight through.
    const load = setLoad(ex, weight, bw ? { bodyWeight: bw.weight } : undefined);
    if (load === null) return;
    const raw = e1rm(load, reps);
    if (raw === null) return;

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
        ratio: c.ratio,
        reps: Math.round(Number(reps)),
        weight: Number(weight),
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
      fixable: list.some((e) => e.fixable),
    });
  }

  return { byMuscle, blocked };
}
