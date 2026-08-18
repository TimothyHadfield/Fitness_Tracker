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
// ── WHY ROTATION AND NOT "LEAST RECENTLY TRAINED" ────────────────────────────
//
// Both answers coincide when somebody follows their programme, so the choice
// only matters when they have not. Rotation wins because it is the thing the
// author actually wrote: Nippard's series, Israetel's floating split and every
// PPL in the app are ORDERED, and the order carries information that "whichever
// is stalest" throws away — Push 1 and Push 2 are different sessions on purpose.
// A stale-first rule would also chase people who miss a day into repeating the
// same catch-up forever. `order` (see store.js) is what makes this possible at
// all; before it, workouts came back alphabetically and a rotation could not be
// read off them.
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
  return `Next in ${where}. You did ${s.lastName} ${agoWords(s.daysSince)}.`;
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
  // Wrap. A rotation's last workout is followed by its first — that is what
  // makes it a rotation rather than a list you finish and are done with.
  const next = list[(at + 1) % list.length];
  const daysSince = daysBetween(last.session.date, today);

  return {
    workout: next,
    system: systemById.get(last.workout.systemId) || null,
    reason: 'rotation',
    lastName: last.session.workoutName || last.workout.name,
    lastDate: last.session.date,
    daysSince,
    trainedToday: daysSince === 0,
    isStart: false,
    // One workout in the system means "next" is the same one again. True, and
    // worth saying differently — "again" reads as a mistake otherwise.
    isOnlyWorkout: list.length === 1,
  };
}
