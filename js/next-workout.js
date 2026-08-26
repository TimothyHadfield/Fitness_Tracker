// Which workout to do next.
//
// docs/vision.md §1.2, first half. Tim wants the app to suggest which workout
// to do when you start one. That idea has TWO halves and they are not the same
// problem: suggesting *which workout* is a lookup, and suggesting *the weights
// and reps inside it* is an inference that needs the strength estimator
// underneath it. Only the lookup is here. The other half must not be guessed at
// — a number the app moved for a bad reason is the kind of thing that destroys
// trust once and for good (vision.md §1.2 says so, and D8 says say WHY).
//
// ── WHAT THIS IS AND IS NOT AN OPINION ABOUT ─────────────────────────────────
//
// Rule 6 says the app gets no unearned opinions. Reading a rotation back to
// somebody is not an opinion: the order came from THEIR system, they either
// wrote it or copied it knowingly, and all this does is say where they are in
// it. What would be an opinion — and is deliberately absent — is telling
// somebody they have trained too much, too little, or the wrong thing. The
// suggestion never scolds and never refuses. It says what is next and what it
// is reading from, and every other workout stays one tap away.
//
// ── LEAST-RECENTLY-DONE FIRST, ROTATION AS THE TIE-BREAK ─────────────────────
//
// ⚠️ REVERSED 2026-08-26, by Tim, from the gym, with a counter-example: *"on
// Monday I did Pull, and Tuesday I did Legs, so it seems pretty easy to
// conclude that my next workout is Push"* — and the app said Pull. The old
// rule was "the workout after the last one, in display order", and its
// justification ("rotation is the thing the author actually wrote") had a
// hole nobody had hit until someone trained out of order: **a self-built
// system has no `order` at all**, so its "rotation" was alphabetical —
// Legs → Pull → Push — and the suggestion was reading a rotation that was
// never written.
//
// The rule now: **the workout you have not done for the longest**, with
// never-done treated as longest of all. When somebody follows their programme
// exactly, this IS the rotation — cycling through a list makes the next one
// always the stalest — so ordered programmes (Nippard's series, the floating
// split) lose nothing. Ties (several never-done, or same-day history) break
// by list position starting AFTER the last workout done, which is what keeps
// Push 1 before Push 2 on a fresh copy of an ordered programme.
//
// Pure: no DOM, no store, no clock of its own — `today` is passed in. That is
// the pattern that keeps e1rm.js and strength-standards.js testable, and this
// has more edge cases than either.

const DAY = 86400000;

// How long ago, in words. Kept here rather than reusing ui.js's `relativeDay`
// because that one reads the real clock, and the whole point of this module is
// that the date comes in as an argument.
export function agoWords(days) {
  if (days == null) return 'at some point';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'a week ago';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return 'a long time ago';
}

/**
 * The sentence under the suggestion, built by the same module that made the
 * suggestion — the trick D20 used for the comparison-group caption, and for the
 * same reason: a sentence written somewhere else drifts away from the thing it
 * is describing, and nobody notices because both halves look fine on their own.
 *
 * The button already says the workout's NAME, so this never repeats it.
 */
export function describeSuggestion(s) {
  if (!s) return '';
  const where = s.system && s.system.name ? s.system.name : 'your programme';

  if (s.isStart) return `First workout in ${where}.`;
  if (s.trainedToday) return `You already did ${s.lastName} today — this is next when you are ready.`;
  if (s.isOnlyWorkout) return `The only workout in ${where}. You last did it ${agoWords(s.daysSince)}.`;
  // Says what was READ — the least-recently-done rule (2026-08-26) chooses on
  // how long each workout has waited, so that is the fact the sentence carries.
  if (s.nextNeverDone) {
    return `You haven't done this one yet — everything else in ${where} is more recent. `
      + `You did ${s.lastName} ${agoWords(s.daysSince)}.`;
  }
  return `It's been longest since this one — ${agoWords(s.nextDaysSince)}. `
    + `You did ${s.lastName} ${agoWords(s.daysSince)}.`;
}

/* ------------------------------------------------------------------ *
 * How long a workout takes — Tim, 2026-08-26: "show the time estimation for
 * each workout … this new time should contribute to the estimation to make
 * it more accurate (although always round to the nearest ~5 min)."
 *
 * ⚠️ THE TIMER HE ASKED FOR ALREADY EXISTS AND ALWAYS HAS: the runner stamps
 * `startedAt` when a session begins and `finishedAt` when it is saved, so
 * every session ever recorded is already a measurement. Nothing new is
 * captured — this is the read side.
 * ------------------------------------------------------------------ */

/**
 * Minutes one recorded session actually took, or null.
 *
 * ⚠️ GUARDED, because both stamps can lie: a draft left open overnight
 * "took" 14 hours, and a back-dated quick log "took" seconds. Under 5
 * minutes is not a workout; over 6 hours is a phone left in a bag. Those
 * rows are dropped from the estimate rather than allowed to wreck it.
 */
export function sessionMinutes(s) {
  if (!s || typeof s.startedAt !== 'string' || typeof s.finishedAt !== 'string') return null;
  const ms = Date.parse(s.finishedAt) - Date.parse(s.startedAt);
  if (!Number.isFinite(ms)) return null;
  const mins = ms / 60000;
  return mins >= 5 && mins <= 360 ? mins : null;
}

/** Round to the nearest 5 minutes, never below 5 — the display grain Tim set. */
export function roundMinutes(mins) {
  return Math.max(5, Math.round(mins / 5) * 5);
}

/**
 * The estimate for one workout: the MEDIAN of its own recorded durations,
 * rounded to 5 — more recordings, better estimate, exactly as asked. The
 * median rather than the mean, so one interrupted session cannot drag it.
 * With no usable history it falls back to set count × 3 min/set (the same
 * published figure the system badge uses — MINUTES_PER_SET in optimal.js).
 *
 * Returns { minutes, measured, count } or null for a workout with no sets.
 */
export function estimateWorkoutMinutes(workout, sessions = []) {
  const recorded = [];
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (!s || s.workoutId !== workout.id) continue;
    const m = sessionMinutes(s);
    if (m != null) recorded.push(m);
  }
  if (recorded.length) {
    recorded.sort((a, b) => a - b);
    const mid = recorded.length >> 1;
    const median = recorded.length % 2 ? recorded[mid] : (recorded[mid - 1] + recorded[mid]) / 2;
    return { minutes: roundMinutes(median), measured: true, count: recorded.length };
  }
  const sets = (workout.exercises || []).reduce((n, e) => n + (Number(e.sets) || 0), 0);
  if (!sets) return null;
  return { minutes: roundMinutes(sets * 3), measured: false, count: 0 };
}

// Days between two YYYY-MM-DD dates. Parsed as LOCAL midnight, never through
// `new Date(iso)`, which reads a bare date string as UTC and lands on the
// previous day for anybody west of Greenwich.
export function daysBetween(fromISO, toISO) {
  const [ay, am, ad] = String(fromISO).split('-').map(Number);
  const [by, bm, bd] = String(toISO).split('-').map(Number);
  if (!ay || !by) return null;
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / DAY);
}

/**
 * The next workout to do, or null if there is nothing sensible to say.
 *
 * @param {object}   arg
 * @param {Array}    arg.systems   every system, any order
 * @param {Array}    arg.workouts  every workout, IN DISPLAY ORDER
 *                                 (store.getWorkouts() already sorts them:
 *                                 programme order first, then by name)
 * @param {Array}    arg.sessions  recorded sessions, newest first
 * @param {string}   arg.today     YYYY-MM-DD
 *
 * @returns {null|{
 *   workout, system, reason, lastName, lastDate, daysSince,
 *   trainedToday, isStart, isOnlyWorkout
 * }}
 */
export function suggestNext({ systems = [], workouts = [], sessions = [], today }) {
  if (!workouts.length) return null;

  // Only systems that still hold a workout can be suggested from. A system
  // whose workouts were all deleted is not a programme any more.
  const bySystem = new Map();
  for (const w of workouts) {
    if (!w.systemId) continue;
    if (!bySystem.has(w.systemId)) bySystem.set(w.systemId, []);
    bySystem.get(w.systemId).push(w);
  }
  if (!bySystem.size) return null;

  const workoutById = new Map(workouts.map((w) => [w.id, w]));
  const systemById = new Map(systems.map((s) => [s.id, s]));

  // Sessions newest first. `getSessions()` already sorts by date, but a caller
  // that hands them over in some other order should still get a right answer —
  // the whole function turns on "the most recent one", so it re-sorts rather
  // than trusting the shape it was given.
  const ordered = [...sessions]
    .filter((s) => s && s.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // The most recent session that still points at a workout that EXISTS and is
  // still inside a system. A workout deleted after being run leaves sessions
  // behind on purpose (D22: history does not become untrue), so this has to
  // skip past them rather than dead-end on the newest row.
  let last = null;
  for (const s of ordered) {
    const w = workoutById.get(s.workoutId);
    if (w && bySystem.has(w.systemId)) { last = { session: s, workout: w }; break; }
  }

  // ── Nothing recorded yet, or nothing recorded that still resolves ──────────
  // Start at the top of the rotation. If there is more than one system there is
  // no basis for choosing between them, so this only speaks when there is one —
  // guessing which programme somebody meant to start is exactly the kind of
  // confident-and-wrong the app is built against.
  if (!last) {
    if (bySystem.size > 1) return null;
    const [systemId, list] = [...bySystem.entries()][0];
    return {
      workout: list[0],
      system: systemById.get(systemId) || null,
      reason: 'start',
      lastName: null,
      lastDate: null,
      daysSince: null,
      trainedToday: false,
      isStart: true,
      isOnlyWorkout: list.length === 1,
    };
  }

  const list = bySystem.get(last.workout.systemId);
  const at = list.findIndex((w) => w.id === last.workout.id);
  const daysSince = daysBetween(last.session.date, today);

  // When each workout in this system was last done — read from EVERY session
  // that resolves to it, not just the newest overall. This is what the old
  // next-in-list rule never looked at, and why it told Tim to repeat Monday's
  // Pull on Wednesday.
  const lastDone = new Map();
  for (const s of ordered) {
    const w = workoutById.get(s.workoutId);
    if (!w || w.systemId !== last.workout.systemId) continue;
    if (!lastDone.has(w.id)) lastDone.set(w.id, s.date);   // ordered = newest first
  }

  // Stalest first; never-done is stalest of all. Ties break by rotation
  // position after the last workout done, so a fresh copy of an ordered
  // programme still walks Push 1 → Pull 1 → … in the author's order.
  const rotationRank = (w) => {
    const i = list.findIndex((x) => x.id === w.id);
    return (i - at - 1 + list.length) % list.length;
  };
  let next = null;
  for (const w of list) {
    if (!next) { next = w; continue; }
    const a = lastDone.get(w.id) || '';       // '' sorts before every date
    const b = lastDone.get(next.id) || '';
    if (a < b || (a === b && rotationRank(w) < rotationRank(next))) next = w;
  }

  const nextLastDate = lastDone.get(next.id) || null;

  return {
    workout: next,
    system: systemById.get(last.workout.systemId) || null,
    reason: 'stalest',
    lastName: last.session.workoutName || last.workout.name,
    lastDate: last.session.date,
    daysSince,
    // How long the SUGGESTED workout has been waiting — null if never done.
    nextDaysSince: nextLastDate ? daysBetween(nextLastDate, today) : null,
    nextNeverDone: !nextLastDate,
    trainedToday: daysSince === 0,
    isStart: false,
    // One workout in the system means "next" is the same one again. True, and
    // worth saying differently — "again" reads as a mistake otherwise.
    isOnlyWorkout: list.length === 1,
  };
}
