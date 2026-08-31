/* ==========================================================================
   routine-from-session.js — a friend's recorded session → a workout of my own.

   social-plan.md §13 Step 7, and the "Save / copy their workout" row of §12.8.

   ⚠️ THEIRS IS A RECORD AND OURS IS A PLAN: set counts carry across, weights
   never do — there is nowhere in a workout template to put one, so this module
   cannot hand you somebody else's numbers even if a later edit tried to.

   That sentence is the whole design problem and it is worth one more paragraph
   than the sentence. Their 185 lb bench is a FACT ABOUT THEM. Written into a
   template it becomes a PRESCRIPTION TO ME — the runner would open with 185 in
   the box and the only thing left to do is fail it. This app has a progression
   rule (progression.js) precisely so that the number I am shown next is derived
   from what I lifted last, and a copied routine is the one door through which
   another person's numbers could walk past it. So the guard is structural, not
   a check: `{ exerciseId, sets, notes }` is the entire exercise shape a workout
   stores (normalizeWorkout() in store.js rebuilds field by field, and weight is
   not among the fields), and this module builds exactly that shape.

   What DOES carry is structure — how many sets, in what order, back to back or
   not — because that is a plan, and a plan is the thing a routine is.

   Pure. No DOM, no store, no clock. It returns the workout; the CALLER hands it
   to store.saveWorkout() with a systemId. Same reason session-stats.js is a
   module: the arithmetic is assertable headlessly and the view is not.
   ========================================================================== */

import { recordedSetCount } from './session-stats.js';
import { isNested, minisOf, normalizeGroups } from './set-types.js';

// The builder's own cap (views-workouts.js — the workout name input is
// maxlength="60"). Copied rather than exported from a view because this module
// must not import a view; if that input ever changes, this follows it.
const NAME_MAX = 60;

// A display name is somebody's chosen handle, not free text we owe a paragraph
// to. Long enough for a real name, short enough that the suffix cannot eat the
// whole title.
const FROM_MAX = 24;

/**
 * Build a workout template from a friend's published session.
 *
 * @param {object} session  a projectSession() result:
 *        { id, date, name, entries: [{ exerciseId, name, group?, setType?,
 *          sets: [{weight?, reps?, time?, distance?, minis?}] }] }
 * @param {Map|object} exMap  MY exercise library, id → exercise
 *        (store.getExerciseMap() returns the Map; a plain object works too).
 * @param {{from?: string}} opts  `from` is their display name, for the title.
 *
 * @returns {{ workout: {name: string, exercises: {exerciseId: string, sets: number,
 *              notes: string, setType?: string, minis?: number, group?: number}[]},
 *             dropped: {exerciseId: *, name: string, sets: number}[],
 *             warnings: string[] }}
 *
 * `workout` is missing id/createdAt/updatedAt on purpose — saveWorkout() fills
 * those. `dropped` is never swallowed: see below.
 */
export function routineFromSession(session, exMap, opts = {}) {
  const warnings = [];
  const dropped = [];
  const carried = [];

  const entries = Array.isArray(session && session.entries) ? session.entries : [];
  let sawWeight = false;
  let brokeAGroup = false;

  // Which group ids had more than one member in THEIR session. Needed before
  // the loop so a group that loses a member on the way across can be reported
  // rather than just quietly dissolving in normalizeGroups(). Counted over
  // RECORDED entries only, for the same reason the loop skips them: a superset
  // whose second exercise was never performed was not a superset that day, and
  // warning that it broke would be warning about something that did not happen.
  const groupSize = new Map();
  for (const entry of entries) {
    if (!entry || entry.group == null || !recordedSetCount(entry)) continue;
    const key = String(entry.group);
    groupSize.set(key, (groupSize.get(key) || 0) + 1);
  }

  for (const entry of entries) {
    const sets = recordedSetCount(entry);

    // ⚠️ AN ENTRY WITH NOTHING RECORDED IN IT IS NOT "DROPPED", IT NEVER
    // HAPPENED. A plan row they never reached, or an "add set" they walked away
    // from. sessionStats() already refuses to count those as exercises ("a
    // workout finished early does not claim the exercises nobody reached") and
    // the feed card they are copying from never showed them, so listing one as
    // something we couldn't carry would name a thing that was not there.
    // Checked BEFORE the id lookup so an unrecorded unknown exercise does not
    // turn up in `dropped` either.
    if (!sets) continue;

    const name = String((entry && entry.name) || 'Exercise');
    const ex = lookup(exMap, entry && entry.exerciseId);

    // ⚠️ AN EXERCISE I DO NOT HAVE CANNOT GO INTO A WORKOUT, because a template
    // addresses exercises BY ID and the runner would open a row pointing at
    // nothing. Their custom "Nordic Hamstring Curl (band)" has an id in their
    // library and no meaning in mine. It is returned rather than skipped so the
    // caller can name it on screen — silently handing somebody a five-exercise
    // copy of their friend's seven-exercise session is the failure mode this
    // return value exists to prevent.
    if (!ex) {
      dropped.push({ exerciseId: (entry && entry.exerciseId) ?? null, name, sets });
      if (entry && entry.group != null && (groupSize.get(String(entry.group)) || 0) > 1) {
        brokeAGroup = true;
      }
      continue;
    }

    if (!sawWeight) sawWeight = hasWeight(entry);

    const item = {
      exerciseId: ex.id ?? entry.exerciseId,
      sets,
      // ⚠️ EMPTY, DELIBERATELY. `notes` on a workout exercise is MY coaching
      // note to myself mid-set ("elbows in"). Their session-level `note` is a
      // sentence about how their day went and projectSession() never publishes
      // a per-exercise one at all, so there is nothing here that is mine and
      // nothing here that is theirs. A copied cue nobody wrote is worse than
      // an empty field.
      notes: '',
    };

    // SET TYPES CARRY, and they are not weights. A drop set is a property of
    // how a set is PERFORMED — take it, strip the load, keep going — and a
    // workout template stores exactly that (normalizeWorkout keeps `setType`
    // and `minis`). What it stores is the COUNT of mini-sets planned, whereas a
    // recorded set carries the mini-sets themselves, so the count is derived:
    // the most they did on any one set is the plan they were working to. Zero
    // means omit the key and let plannedMinis() supply the type's default.
    if (isNested(entry.setType)) {
      item.setType = String(entry.setType);
      const minis = maxMinis(entry);
      if (minis > 0) item.minis = minis;
    }

    // GROUPING CARRIES TOO — and this is the one the brief asked me to check
    // rather than assume. set-types.js's header splits the two shapes:
    // GROUPING is a property of the space between exercises, stored as `group`
    // on a workout exercise; NESTING lives inside a set. A workout template CAN
    // express a group (normalizeWorkout lists `group` among the fields it
    // rebuilds), so a superset survives the copy and there is no field to
    // invent. Their ids are theirs; normalizeGroups() renumbers below.
    if (entry.group != null) item.group = entry.group;

    carried.push(item);
  }

  // normalizeGroups() is run HERE, not left to saveWorkout(), so that what this
  // function returns is already true — the caller may want to render a preview
  // ("2 supersets") before saving, and a preview off the un-normalised list
  // would announce one-exercise supersets that the save then dissolves.
  //
  // ⚠️ It also merges what a drop left adjacent: a tri-set of A-B-C whose B I
  // do not have arrives as A-C, and since B is genuinely not in my routine, A
  // and C genuinely are back to back. Faithful, but it is a changed block and
  // the warning below says so rather than letting it pass as theirs.
  const exercises = normalizeGroups(carried);

  if (brokeAGroup) {
    warnings.push('A superset lost an exercise your library does not have, so the block is not '
      + 'the one they did. Check the order before you run it.');
  }

  // Conditional on purpose — a session of bodyweight work has no weights to
  // leave behind, and a line about weights not carrying would be noise on it.
  if (sawWeight) {
    warnings.push('Their weights are not copied. A workout holds the plan — how many sets, in '
      + 'what order — and your own numbers come from your own last session.');
  }

  if (!exercises.length) {
    warnings.push(dropped.length
      ? 'Nothing in this session matched your exercise library, so the routine is empty. The '
        + 'exercises they used are listed above.'
      : 'This session has nothing recorded in it, so there is nothing to copy.');
  }

  return { workout: { name: copyName(session, opts.from), exercises }, dropped, warnings };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** MY library, as a Map or a plain object. Returns the exercise or null. */
function lookup(exMap, id) {
  if (typeof id !== 'string' || !id) return null;
  if (exMap instanceof Map) return exMap.get(id) || null;
  if (exMap && typeof exMap === 'object') {
    return Object.prototype.hasOwnProperty.call(exMap, id) ? exMap[id] || null : null;
  }
  return null;
}

/**
 * Did any set of this entry carry a load?
 *
 * Read only to decide whether to SAY that weights are not copied. The number
 * itself goes nowhere — this function returns a boolean, which is the only
 * thing about a friend's weight this module is willing to know.
 */
function hasWeight(entry) {
  return ((entry && entry.sets) || []).some((s) => Number(s && s.weight) > 0);
}

/** The most mini-sets they took on any one set — the plan they were working to. */
function maxMinis(entry) {
  return ((entry && entry.sets) || [])
    .reduce((n, s) => Math.max(n, minisOf(s).length), 0);
}

/**
 * "Push (from Autumn)".
 *
 * A copy needs to say where it came from, in the workout list, forever — six
 * months from now "Push" beside my own "Push" is a puzzle. Their name in
 * parentheses is the plainest form of it: no "copy of", no emoji, and it reads
 * as a title rather than a label.
 *
 * ⚠️ THE ATTRIBUTION IS THE PART THAT MUST SURVIVE THE CAP. 60 chars is the
 * builder's own maxlength, so a longer name would be un-editable in the very
 * screen that opens next. When it does not fit, THEIR WORKOUT NAME is trimmed
 * and the "(from …)" is kept whole — the credit is the reason the suffix
 * exists, and "Chest and Should… (from Autumn)" still says both things where
 * "Chest and Shoulders and Ar…" says neither.
 */
function copyName(session, from) {
  const base = String((session && session.name) || '').trim() || 'Workout';
  const who = String(from || '').trim().slice(0, FROM_MAX);
  if (!who) return base.slice(0, NAME_MAX);

  const suffix = ` (from ${who})`;
  const room = NAME_MAX - suffix.length;
  // One character of a name is not a name. If the credit alone crowds the title
  // out, fall back to plain truncation rather than emitting "P… (from …)".
  if (room < 4) return (base + suffix).slice(0, NAME_MAX);
  return (base.length <= room ? base : base.slice(0, room - 1).trimEnd() + '…') + suffix;
}

/* ------------------------------------------------------------------ *
 * Two judgement calls that are not visible in the code above
 * ------------------------------------------------------------------ *
 *
 * DUPLICATE EXERCISES STAY SEPARATE. A session listing Bench twice — three
 * sets early, two more at the end — copies as TWO rows of 3 and 2, not one row
 * of 5. Three reasons: the order somebody trained in is information
 * (session-stats.js says so where it keeps byExercise in session order);
 * merging silently rewrites a plan into a different plan, which is the same
 * shrinking that `dropped` exists to prevent; and the builder already treats a
 * repeat as legitimate — it MARKS a duplicate in the exercise picker ("already
 * in this workout") and refuses to hide it, on the grounds that filtering out
 * the right answer is worse than showing it twice. Merging here would be this
 * module deciding what that screen declined to.
 *
 * NO CAP ON THE SET COUNT. recordedSetCount() only ever counts sets a person
 * actually recorded, so the ceiling is what somebody physically did. A cap
 * would be a guess at what is reasonable, applied to a fact.
 */
