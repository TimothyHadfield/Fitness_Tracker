/* ==========================================================================
   session-stats.js — arithmetic over ONE recorded session.

   Pure. No DOM, no store, no imports. It is used in three places — the feed
   card, the workout detail screen and a friend's page — which is exactly why
   it is a module with its own tests rather than three lines inside a view.

   ⚠️ WHAT THIS DELIBERATELY DOES NOT COMPUTE: total volume in pounds.

   Hevy's stat row reads `Time · Volume · Records` and the obvious move was to
   copy it. Tim's instruction on 2026-09-01 was to ship the SET COUNT in that
   column instead and leave volume alone for now, and the reasoning holds up
   from this side too:

     - A per-side dumbbell set at 50 lbs x 10 is 1,000 lbs of work, not 500,
       so volume can only be computed by looking each exercise up in the
       reader's own library for `loadType`. That is a dependency this module
       does not otherwise need.
     - A bodyweight set cannot be counted for a FRIEND at all. `totalResistance()`
       needs the lifter's body weight, and a friend's body weight publishes only
       at the top tier and only if they opted in — so a pull-up would contribute
       0 and a session of pull-ups would read as a rest day. That is the kind of
       number that flatters or halves somebody's session, which is the one thing
       this project's rules are about.
     - A set count has neither problem. It is the same number for everybody,
       needs nothing outside the session, and is the unit the rest of this app
       already thinks in (D3 — sets per muscle per week is the headline metric).

   When volume ships it belongs here, beside this, taking an exercise map.

   ⚠️ AND WARM-UPS ARE COUNTED, because nothing records that a set was one.
   A set is typed by the lifter in Hevy (`W`, in amber) and that is a better
   answer than any threshold this app could guess at — but it is a change to
   what the runner asks mid-workout and it is Tim's call. Until then every
   recorded set counts, here and in `volume-map.js`, and the screens say so.
   ========================================================================== */

/**
 * How many sets of one entry were really performed.
 *
 * A set with no numbers in it was never done — an empty row left behind by a
 * plan, or by tapping "add set" and walking away. Both save paths drop those
 * already; this guards the older rows that predate that, and a FRIEND's
 * projection, which we do not control the writing of.
 *
 * ⚠️ A drop set or a myo-rep set is ONE set, not one plus its minis. That is
 * this project's oldest resolved-without-asking decision (progress.md §6) and
 * `volume-map.js` counts the same way — nesting lives inside `minis` on the
 * parent set and is never walked here, on purpose. Counting them separately
 * would inflate every total the moment somebody used a set type.
 */
export function recordedSetCount(entry) {
  return ((entry && entry.sets) || [])
    .filter((set) => set && Object.values(set).some((v) => Number(v) > 0)).length;
}

/**
 * Totals for one session, and the same totals broken down per exercise.
 *
 * @param {Array} entries  session.entries — [{ exerciseId, exerciseName, sets[] }]
 * @returns {{ sets: number, exercises: number,
 *             byExercise: {exerciseId: *, name: string, sets: number}[] }}
 *
 * `exercises` counts only the ones with a set actually recorded against them,
 * so a workout finished early does not claim the exercises nobody reached.
 * `byExercise` keeps the session's own order — it is what the card lists, and
 * the order a person did them in is information.
 */
export function sessionStats(entries) {
  const byExercise = [];
  let sets = 0;

  for (const entry of entries || []) {
    const n = recordedSetCount(entry);
    if (!n) continue;
    sets += n;
    byExercise.push({
      exerciseId: entry.exerciseId ?? null,
      name: String(entry.exerciseName || entry.name || 'Exercise'),
      sets: n,
    });
  }

  return { sets, exercises: byExercise.length, byExercise };
}

/**
 * "4 sets" / "1 set". Pluralisation in one place because it appears on the
 * card, on the detail screen and in the muscle split.
 */
export function setsLabel(n) {
  return `${n} ${n === 1 ? 'set' : 'sets'}`;
}
