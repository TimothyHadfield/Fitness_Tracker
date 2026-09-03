/* ==========================================================================
   compare.js — you and one friend, on ONE exercise.

   Pure arithmetic. No DOM, no store, no network. The screen is somebody else's
   job; this decides what may honestly be put on it.

   ── WHAT THIS REFUSES TO PRODUCE ──────────────────────────────────────────
   🚨 THERE IS NO OVERALL RESULT IN HERE. No winner, no score, no ranking, no
   badge. Hevy prints a yellow STRONGER rosette on this exact screen (§12.12)
   and social-plan §13 Step 6 says to skip it, because declaring a person
   stronger off one exercise is Rule 6 — an opinion the data has not earned.
   One lift is one lift: it knows nothing about the other 264 in the library,
   about who trains it as a main and who as an accessory, or about who was
   three weeks into a cut. Each metric row may say which NUMBER is larger, so
   the caller can draw a delta bar, and that claim is bounded by the row it
   sits in. Nothing sums the rows, and the result carries a `header` that says
   so out loud rather than leaving the screen free to imply otherwise.

   ── THE WINDOW, WHICH IS THE WHOLE REASON THIS FILE IS NOT TEN LINES ──────
   ⚠️ Their side is capped at their last 60 PUBLISHED sessions (MAX_ACTIVITY in
   social.js). Mine is my entire history. Compared as-is, that is my best ever
   against their best recent — a bias that is silent, one-directional, and
   always in my favour. So both sides are cut to the OVERLAP of what each side
   has available, and the window is reported in the result.

   ⚠️ WHY A FOOTNOTE UNDER THE CHART WOULD NOT HAVE BEEN ENOUGH. A footnote
   does not change the bars, and the bars are what a person reads — the caption
   is read second, if at all, and it cannot un-see a bar that is 30 % longer
   than it should be. Worse, the error is not noise that averages out over many
   comparisons: it points one way every single time, so a screen full of
   footnoted comparisons still adds up to a consistently flattering picture of
   me. A footnote describes a wrong number. Restricting the window makes the
   number right, and then says what it covers.

   ── UNITS, 2026-09-13 (docs/strength-accuracy-plan.md §2.7) ────────────────
   ⚠️ EVERY LOAD IN THE RESULT IS POUNDS, AND NO ROW NAMES A UNIT TO PRINT.
   The two load rows used to carry `unit: 'lb'` and the screen printed it
   verbatim, so a kilogram user read "185 lb" beside numbers every other screen
   showed them in kg. A row now says what KIND of number it holds — 'weight'
   (stored pounds; the screen converts through units.js), 'reps' or 'sets'
   (counts, printed as they are) — and never the suffix. This module has no
   idea what the reader's unit is and must not pretend to.

   ── THE 1RM CONVENTION IS set-e1rm.js's, NOT A LOCAL ONE (plan §2.8, §4.e) ──
   A dumbbell set used to be doubled and THEN put through the curve —
   e1rm(100, 12) for 50 in each hand — which is a different number from the
   2 × e1rm(50, 12) every other screen prints, because k in e1rm.js depends on
   the weight. Both sides are the same exercise, so `better` never turned on
   it; the printed figure did, by ~9 % on a 12-rep set. setE1rm() is the one
   place a logged set becomes a maximum, and this row reads from it.
   ========================================================================== */

import {
  isRankableSet, MAX_EVIDENCE_REPS, canNormalize, normalizeBlockedReason,
} from './e1rm.js';
import { setE1rm } from './set-e1rm.js';
import { totalLoad } from './muscle-evidence.js';
import { bodyWeightFractionFor } from './exercises.js';

/* ------------------------------------------------------------------ *
 * Small shared bits
 * ------------------------------------------------------------------ */

// Dates are bare 'YYYY-MM-DD' calendar days everywhere in this app, so they
// sort and compare as strings. Sliced because an imported or restored row can
// carry a full timestamp, and '2026-01-05T18:40' must not sort after
// '2026-01-05' as a different day.
const day = (d) => (typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : null);

function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  // Date.UTC on both sides — a pure day count, no local/UTC mix, no DST hole.
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

/**
 * Was this set actually performed?
 *
 * Byte-for-byte the rule in session-stats.js recordedSetCount(): a row with no
 * positive number in it was never done — an empty row left by a plan, or by
 * tapping "add set" and walking away. It matters more here than there, because
 * a friend's projection is written by an app build we do not control.
 */
function isRecorded(set) {
  return Boolean(set) && Object.values(set).some((v) => Number(v) > 0);
}

/**
 * Sessions, normalised, from either side.
 *
 * Mine arrive as store.getSessions(); theirs as the projection's `activity`
 * array, where an entry names the exercise with `name` rather than
 * `exerciseName`. Accepting the whole projection document as well costs two
 * lines and turns the commonest wiring slip — passing `friend` instead of
 * `friend.activity` — into working code rather than a silent empty result.
 */
function sessionList(input) {
  const raw = Array.isArray(input)
    ? input
    : (input && Array.isArray(input.activity) ? input.activity : []);
  return raw
    .map((s) => ({
      date: day(s && s.date),
      entries: Array.isArray(s && s.entries) ? s.entries : [],
      detailed: Array.isArray(s && s.entries),
    }))
    .filter((s) => s.date);
}

/**
 * The sets of one exercise, out of one side's sessions.
 *
 * Matching is by `exerciseId` first, because that is the stable identity and
 * it survives a rename. The name fallback applies ONLY where their row carries
 * no id at all — projectSession() types it `string | null`, and sessions
 * recorded before ids existed publish null. Matching a null-id row by name is
 * the only way to see those at all, and the risk it carries (their custom
 * exercise happening to share a library name) is smaller than the alternative,
 * which is silently telling somebody their friend has never done an exercise
 * they have done a hundred times.
 *
 * ⚠️ `minis` are not walked, and no drop or myo-rep set is expanded. A drop set
 * is ONE set — this project's oldest resolved decision (docs/handbook.md §6), and
 * what session-stats.js and volume-map.js both count. It also costs nothing
 * here: every mini is lighter than the set it hangs off, so it can be neither
 * the heaviest set nor the best e1RM.
 */
function observations(sessions, exerciseId, exerciseName) {
  const out = [];
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (!entry) continue;
      const id = entry.exerciseId;
      const named = entry.exerciseName || entry.name;
      const hit = id ? id === exerciseId : Boolean(exerciseName) && named === exerciseName;
      if (!hit) continue;
      for (const set of (Array.isArray(entry.sets) ? entry.sets : [])) {
        if (!isRecorded(set)) continue;
        out.push({
          date: session.date,
          weight: Number(set.weight),
          reps: Number(set.reps),
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Per-side load
 * ------------------------------------------------------------------ */

/**
 * ⚠️ A DUMBBELL SET AT 50 LBS IS NOT 50 LBS OF WORK. The HEAVIEST-SET row
 * goes through totalLoad() from muscle-evidence.js, which doubles `per_side`
 * — the app's single existing rule for this, imported rather than restated so
 * there cannot be two of them.
 *
 * Both sides are the SAME exercise, so both get the same doubling and no
 * `better` verdict can ever turn on it. What it changes is the number printed
 * beside the bar.
 *
 * 🔄 THE ESTIMATED-1RM ROW NO LONGER READS THIS — 2026-09-13. ~~k(w) in
 * e1rm.js varies with the weight, so estimating from 50 rather than 100 does
 * not merely halve the answer … Converting first is the only way the estimate
 * lands where every other e1RM in the app lands.~~ True about k, wrong about
 * where the others land: the rating pipeline, the finish-screen bests and the
 * Data tab all put the PER-HAND weight through the curve and double the result
 * (Tim's call, plan §4.e; Marzagão's dumbbell rows were logged per hand). This
 * screen was the one doing it the other way. setE1rm() now holds the
 * convention for every caller, and the row below reads its total.
 *
 * The caller is told which convention is in force via `result.loadType` and a
 * caveat, so the screen can print "100 lb (50 / side)" rather than a number
 * neither person ever typed.
 */
function loadOf(obs, loadType) {
  return totalLoad(obs.weight, loadType);
}

/* ------------------------------------------------------------------ *
 * What can honestly be measured on this exercise
 * ------------------------------------------------------------------ */

/**
 * Is the logged weight the resistance, for BOTH of us?
 *
 * ⚠️ BODY WEIGHT IS THE REFUSAL THIS FUNCTION EXISTS FOR. totalResistance()
 * needs the lifter's body weight, and a friend's publishes only at the top
 * tier and only if they opted in — so their pull-up load is unknowable here,
 * permanently, for most friends.
 *
 * Note what is NOT done about that: my own resistance is computable from my
 * weigh-ins, and putting my `fraction × bodyweight + added` beside their bare
 * added load would be worse than refusing — it would compare two different
 * quantities on one bar and hand me the larger of them. Nor is theirs guessed
 * at, or floored at zero: a zero is a number, and it would read as a person
 * who lifts nothing. The refusal is symmetric, stated, and reps stay
 * comparable (see BEST REPS below), because a pull-up rep is a pull-up rep.
 *
 * The clause list is deliberately canNormalize()'s, called with one argument —
 * which in that function means "I have not looked up a body weight", the true
 * and permanent state of this caller. Assisted machines fall out of the same
 * call, and correctly: there the logged number is help, not load.
 */
function loadIsComparable(exercise) {
  return Boolean(exercise) && canNormalize(exercise);
}

/**
 * The heaviest set needs no rep count, so it is available on a weighted
 * exercise that logs no reps (a loaded carry). Same bodyweight/assist clauses
 * as above — only the reps requirement is dropped.
 */
function weightIsComparable(exercise) {
  if (!exercise || !Array.isArray(exercise.fields)) return false;
  if (!exercise.fields.includes('weight')) return false;
  if (bodyWeightFractionFor(exercise)) return false;
  if (exercise.equipment === 'Bodyweight') return false;
  if (/^assisted\b/i.test(exercise.name || '')) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * The metrics
 * ------------------------------------------------------------------ */

// Two numbers within a tenth of a pound are a tie, not a win. Nobody logs at
// that resolution and no bar can draw it; calling it for one side would be an
// opinion manufactured out of floating point.
const TIE_EPS = 0.05;

function betterOf(mine, theirs) {
  if (!(Number.isFinite(mine) && Number.isFinite(theirs))) return null;
  if (Math.abs(mine - theirs) <= TIE_EPS) return 'tie';
  return mine > theirs ? 'mine' : 'theirs';
}

/**
 * One row. `judged` is the Rule 6 flag — the same idea as summaryStats()'s —
 * and `better` is null wherever bigger is not genuinely better, so a caller
 * that colours by `better` cannot accidentally colour something neutral.
 *
 * `unit` is the KIND of number, never a suffix: 'weight' means pounds in
 * storage and the reader's own unit on the screen; 'reps' and 'sets' are
 * counts. See the header.
 */
function metric({
  key, label, unit, mine, theirs, judged = true, estimate = false, note = null,
  mineSet = null, theirsSet = null, mineConverted = false, theirsConverted = false,
}) {
  const both = Number.isFinite(mine) && Number.isFinite(theirs);
  return {
    key,
    label,
    unit,
    mine: Number.isFinite(mine) ? mine : null,
    theirs: Number.isFinite(theirs) ? theirs : null,
    // Bigger is better, or nothing is claimed at all.
    better: judged ? betterOf(mine, theirs) : null,
    judged,
    // 🚨 Rule 5: an inference must never look like a measurement. The module
    // cannot draw the hatch, so it flags the row and the caller labels it.
    estimate,
    delta: both ? mine - theirs : null,
    note,
    mineSet,
    theirsSet,
    /* ⚠️ ESTIMATED AND CONVERTED ARE DIFFERENT CLAIMS AND THE ROW CARRIES BOTH.
     * `estimate` says the number was worked out from a set rather than lifted;
     * `converted` says the set it was worked out from was on a DIFFERENT
     * EXERCISE. The second is a weaker claim than the first and it applies to
     * one side at a time, so a screen that collapsed them would tell a reader
     * their friend's measured bench and their own converted one were the same
     * kind of number. */
    mineConverted: Boolean(mineConverted),
    theirsConverted: Boolean(theirsConverted),
  };
}

// The best row of a side by some score, kept whole so the caller can show the
// set behind the number — a bar that cannot be traced back to a real set is
// how estimates start looking like measurements.
function bestBy(rows, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const row of rows) {
    const s = score(row);
    if (!Number.isFinite(s) || s <= bestScore) continue;
    bestScore = s;
    best = row;
  }
  return best === null ? null : { score: bestScore, set: best };
}

const setDetail = (hit) => (hit ? {
  // `weight` is AS LOGGED — per side where that is the convention — so the
  // caller can print the set the way the lifter typed it, beside the total.
  weight: Number.isFinite(hit.set.weight) ? hit.set.weight : null,
  reps: Number.isFinite(hit.set.reps) ? hit.set.reps : null,
  date: hit.set.date,
} : null);

/* ------------------------------------------------------------------ *
 * The window
 * ------------------------------------------------------------------ */

function span(sessions) {
  if (!sessions.length) return null;
  const days = sessions.map((s) => s.date).sort();
  return { first: days[0], last: days[days.length - 1] };
}

function windowLabel(days) {
  if (days <= 0) return 'no shared days';
  if (days < 14) return `the last ${days} day${days === 1 ? '' : 's'}`;
  if (days < 70) {
    const w = Math.round(days / 7);
    return `the last ${w} weeks`;
  }
  const m = Math.round(days / 30.44);
  if (m < 24) return `the last ${m} months`;
  return `the last ${(days / 365.25).toFixed(1)} years`;
}

/* ------------------------------------------------------------------ *
 * The comparison
 * ------------------------------------------------------------------ */

export const NO_VERDICT_HEADER =
  'Two sets of numbers on one exercise, over the same weeks. '
  + 'There is no overall result here — each row stands on its own, and one lift '
  + 'does not decide who is stronger.';

/**
 * Compare me and one friend on one exercise.
 *
 * @param {object}  args
 * @param {Array}   args.mine        store.getSessions() — my whole history
 * @param {Array}   args.theirs      their projection's `activity` (or the
 *                                   projection document itself)
 * @param {string}  args.exerciseId  the exercise both sides are matched on
 * @param {object}  args.exercise    the library entry — `fields`, `loadType`,
 *                                   `equipment`, `name`. Without it no load
 *                                   metric is offered, because per-side and
 *                                   bodyweight cannot be told apart blind.
 *
 * @returns {{
 *   exerciseId: string, exerciseName: string, header: string,
 *   loadType: string|null,
 *   window: {start, end, days, label}|null,
 *   common: boolean, reason: string|null, message: string|null,
 *   counts: { mine: {sessions, sets}, theirs: {sessions, sets} },
 *   metrics: Array, caveats: Array<{key, text}>
 * }}
 *
 * `common: false` is a real answer and comes back with a `reason` and a
 * sentence — never with a metric list full of zeros, which would say the two
 * of us both lift nothing when the truth is that we have nothing to compare.
 */
export function compareExercise({ mine, theirs, exerciseId, exercise, estimates } = {}) {
  const exerciseName = (exercise && exercise.name) || '';
  const loadType = (exercise && exercise.loadType) || null;

  const mySessions = sessionList(mine);
  const theirSessions = sessionList(theirs);

  const base = {
    exerciseId: exerciseId || null,
    exerciseName,
    header: NO_VERDICT_HEADER,
    loadType,
    window: null,
    common: false,
    reason: null,
    message: null,
    counts: { mine: { sessions: 0, sets: 0 }, theirs: { sessions: 0, sets: 0 } },
    metrics: [],
    caveats: [],
  };

  /* ---- 1. nothing at all on one side ---- */
  if (!mySessions.length || !theirSessions.length) {
    return {
      ...base,
      reason: !mySessions.length ? 'you-have-nothing-recorded' : 'they-have-published-nothing',
      message: !mySessions.length
        ? 'There is nothing recorded on your side yet, so there is nothing to compare.'
        : 'They have not published any sessions, so there is nothing to compare against.',
    };
  }

  /* ---- 2. the shared window ---- */
  //
  // The overlap of what each side HAS, computed over every session either of
  // us recorded rather than only the ones containing this exercise. Using only
  // matching sessions would let the window snap shut around a single shared
  // month and call an accident of scheduling a fair comparison; the honest
  // question is "over what period do we both have data at all".
  const mySpan = span(mySessions);
  const theirSpan = span(theirSessions);
  const start = mySpan.first > theirSpan.first ? mySpan.first : theirSpan.first;
  const end = mySpan.last < theirSpan.last ? mySpan.last : theirSpan.last;

  if (start > end) {
    return {
      ...base,
      reason: 'windows-do-not-overlap',
      message: 'Your sessions and the ones they publish do not cover any of the same days, '
        + 'so there is no period to compare over.',
    };
  }

  const days = (dayNumber(end) - dayNumber(start)) + 1;   // inclusive of both ends
  const window = { start, end, days, label: windowLabel(days) };

  const inWindow = (s) => s.date >= start && s.date <= end;
  const myWindowed = mySessions.filter(inWindow);
  const theirWindowed = theirSessions.filter(inWindow);

  /* ---- 3. the sets ---- */
  const myAll = observations(mySessions, exerciseId, exerciseName);
  const theirAll = observations(theirSessions, exerciseId, exerciseName);
  const myObs = observations(myWindowed, exerciseId, exerciseName);
  const theirObs = observations(theirWindowed, exerciseId, exerciseName);

  const counts = {
    mine: { sessions: new Set(myObs.map((o) => o.date)).size, sets: myObs.length },
    theirs: { sessions: new Set(theirObs.map((o) => o.date)).size, sets: theirObs.length },
  };

  /* ---- 4. nobody has done it — but the app may still know roughly what they
   *         WOULD do, and Tim asked for that rather than a shrug.
   *
   * 🚨 THE REQUEST, 2026-09-02: *"if that person has an exercise that the site
   * can estimate from another similar exercise, then estimate it rather than
   * say there are no recorded exercises. For example, I don't have any barbell
   * rows recorded and my friend does. However, I have dumbell rows, lat
   * pulldowns, assisted pull ups… If the user has no exercises recorded on a
   * certain muscle group at all, then you can say that you can't compare."*
   *
   * The estimate is computed by the CALLER (`estimateOneRM` in
   * exercise-estimate.js) and handed in, because it needs the whole muscle map
   * and this module is pure arithmetic over two lists of sets. Both sides get
   * the same treatment or neither does.
   *
   * ⚠️ IT FILLS EXACTLY ONE ROW, AND THE CHOICE IS THE WHOLE POINT. "Best
   * estimated 1RM" is already an inference, so an estimate is at home in it.
   * "Heaviest set recorded" is a MEASUREMENT — a row that would be a lie the
   * moment a converted number appeared in it — so a side with no sets stays
   * blank there however much the app thinks it knows. Rule 5, applied one row
   * at a time rather than to the screen as a whole.
   */
  const estOf = (side) => {
    const e = estimates && estimates[side];
    return e && e.oneRM > 0 ? e : null;
  };
  const myEst = myObs.length ? null : estOf('mine');
  const theirEst = theirObs.length ? null : estOf('theirs');

  /* ---- 4a. no common ground, said plainly ---- */
  if ((!myObs.length && !myEst) || (!theirObs.length && !theirEst)) {
    // Four different truths, and they are not interchangeable — "they have
    // never done this" and "they did it, but before the window we can compare
    // over" send a person to different places.
    // ⚠️ The test is whether their sessions carry an `entries` ARRAY, not
    // whether any of them is non-empty. A light-tier projection has no entries
    // key at all (projectSession returns before it), which is "they do not
    // publish what is inside a workout"; a mid-tier session always has the
    // array, so an empty one means an empty workout, not a hidden one.
    const theirsDetailed = theirSessions.some((s) => s.detailed);
    /* ⚠️ THE SENTENCE CHANGED WHEN THE ESTIMATE ARRIVED. "You have never
     * recorded this" was the whole truth before; now the app has looked for a
     * way to convert something else of yours and failed, and the honest
     * sentence says which of the two happened. Telling somebody they have not
     * done an exercise, when the real answer is that they have trained nothing
     * this exercise converts from, sends them to the wrong place. */
    const nothingConverts = ' and nothing else you have recorded converts to it';
    let reason;
    let message;
    if (!myObs.length && !myEst && !theirObs.length && !theirEst) {
      reason = 'neither-of-you-logged-it';
      message = `Neither of you has recorded ${exerciseName || 'this exercise'} in ${window.label}${
        estimates ? ', and neither of you has trained anything it converts from' : ''}.`;
    } else if (!myObs.length && !myEst) {
      reason = myAll.length ? 'yours-is-outside-the-window' : 'you-have-not-logged-it';
      message = myAll.length
        ? `You have done ${exerciseName || 'this'}, but not within ${window.label} — the period you both have data for.`
        : `You have never recorded ${exerciseName || 'this exercise'}${estimates ? nothingConverts : ''}`
          + ', so there is nothing of yours to put beside theirs.';
    } else if (!theirsDetailed) {
      reason = 'they-do-not-publish-the-detail';
      message = 'They share the day and the name of each workout, not what was in it, '
        + 'so there is nothing to compare exercise by exercise.';
    } else {
      reason = theirAll.length ? 'theirs-is-outside-the-window' : 'they-have-not-logged-it';
      message = theirAll.length
        ? `They have done ${exerciseName || 'this'}, but not within ${window.label} — the period you both have data for.`
        : `They have not recorded ${exerciseName || 'this exercise'} in anything they have published`
          + `${estimates ? ', and nothing they share converts to it' : ''}.`;
    }
    return { ...base, window, common: false, reason, message, counts };
  }

  /* ---- 5. the rep gate ---- */
  //
  // ⚠️ D5, and MAX_EVIDENCE_REPS is imported rather than restated. A set above
  // 15 reps is refused as evidence of a maximum everywhere else in this app,
  // for a reason this screen shares: the formula happily turns 135 × 25 into
  // 258 lb, and a burnout set would beat a genuine top single.
  //
  // The gate is applied ONCE, to a single pool, and both load rows read from
  // it. Filtering the estimate but not the heaviest set would mean the two
  // rows describe different sets — a second, looser rule wearing the first
  // one's name.
  const rankable = (obs) => obs.filter((o) => isRankableSet(o.reps));
  const overGate = (obs) => obs.filter((o) => Number.isFinite(o.reps) && o.reps > MAX_EVIDENCE_REPS).length;
  const myRank = rankable(myObs);
  const theirRank = rankable(theirObs);
  const dropped = overGate(myObs) + overGate(theirObs);

  const metrics = [];
  const caveats = [];

  /* ---- 6. estimated 1RM — the row that makes this a comparison ---- */
  //
  // 🚨 Without it this screen is "who typed a bigger number": 225 × 3 and
  // 185 × 10 are not orderable as raw weight, and whichever of us trains in
  // the lower rep range wins every time. e1rm() puts both on one axis.
  if (loadIsComparable(exercise)) {
    // The TOTAL estimated maximum — both dumbbells — from the one convention
    // (set-e1rm.js). No body weight is handed in, and none is needed: a lift
    // carried by body weight never reaches this branch (loadIsComparable).
    const score = (o) => {
      const r = setE1rm(exercise, o.weight, o.reps);
      return r ? r.e1rm : NaN;
    };
    const mineBest = bestBy(myRank, score);
    const theirsBest = bestBy(theirRank, score);

    /* A side with no sets on this lift falls back to the converted estimate —
     * and ONLY here. See the note at step 4: this row is already an inference,
     * so an inference belongs in it; the heaviest-set row below is a
     * measurement and stays blank rather than borrowing a number. */
    const mineValue = mineBest ? mineBest.score : (myEst ? myEst.oneRM : null);
    const theirsValue = theirsBest ? theirsBest.score : (theirEst ? theirEst.oneRM : null);
    const converted = [];
    if (!mineBest && myEst) converted.push('yours');
    if (!theirsBest && theirEst) converted.push('theirs');

    if (mineValue !== null || theirsValue !== null) {
      metrics.push(metric({
        key: 'e1rm',
        label: 'Best estimated 1RM',
        unit: 'weight',
        mine: mineValue,
        theirs: theirsValue,
        estimate: true,
        note: converted.length
          ? 'Worked out from recorded sets — and where somebody has never done this lift, '
            + 'converted from the ones they have.'
          : 'Worked out from a recorded set, not lifted.',
        mineSet: setDetail(mineBest),
        theirsSet: setDetail(theirsBest),
        // So the screen can mark the converted side without re-deriving which.
        mineConverted: !mineBest && Boolean(myEst),
        theirsConverted: !theirsBest && Boolean(theirEst),
      }));
      caveats.push({
        key: 'estimate',
        text: 'Nobody has lifted the 1RM figures — they are estimated from sets that were '
          + 'actually recorded, so treat them as the same lift on a common scale rather '
          + 'than as a number either of you has hit.',
      });
      /* ⚠️ A CONVERTED SIDE IS A SECOND INFERENCE ON TOP OF THE FIRST, and the
       * caveat says so in those terms rather than hiding it inside the word
       * "estimated", which the row above has already spent. Which side, and
       * from what, so the reader can weigh it — a conversion off a close
       * relative is worth much more than one off a machine. */
      for (const est of [myEst, theirEst]) {
        if (!est) continue;
        const whose = est === myEst ? 'Your' : 'Their';
        const from = est.from && est.from.length
          ? `${est.from.slice(0, 3).join(', ')}`
          : 'other lifts';
        caveats.push({
          key: 'converted',
          text: `${whose} figure is converted rather than recorded — neither of these sets was `
            + `done on this exercise. It comes from ${from}, through ${est.muscle.toLowerCase()}, `
            + `at ${est.band.name.toLowerCase()} confidence.`,
        });
      }
    }
  } else if (exercise) {
    // The stated refusal. `normalizeBlockedReason()` supplies the app's own
    // wording for it where it has one, so this screen does not invent a second
    // way of saying the same thing.
    const why = normalizeBlockedReason(exercise);
    caveats.push({
      key: 'no-load',
      text: bodyWeightFractionFor(exercise) || exercise.equipment === 'Bodyweight'
        ? 'There is no load row for this one: it is carried by body weight, and a friend '
          + 'publishes their body weight only at the top tier and only if they chose to. '
          + 'Rather than guess at it, or count it as nothing, the weight is left out — '
          + 'the reps below are still the same reps for both of you.'
        : `There is no load row for this one — ${why || 'the logged weight is not the resistance'}.`,
    });
  } else {
    caveats.push({
      key: 'unknown-exercise',
      text: 'This exercise is not in your library, so there is no way to tell whether its '
        + 'weights are per side or carried by body weight. Only the counts are shown.',
    });
  }

  /* ---- 7. heaviest set — a measurement, no model ---- */
  if (weightIsComparable(exercise)) {
    const score = (o) => {
      const load = loadOf(o, loadType);
      return load === null ? NaN : load;
    };
    // Rep-gated too, for the reason in section 5 — one pool, one rule.
    const pool = (exercise.fields || []).includes('reps') ? [myRank, theirRank] : [myObs, theirObs];
    const mineBest = bestBy(pool[0], score);
    const theirsBest = bestBy(pool[1], score);
    if (mineBest || theirsBest) {
      metrics.push(metric({
        key: 'top-weight',
        label: 'Heaviest set recorded',
        unit: 'weight',
        mine: mineBest && mineBest.score,
        theirs: theirsBest && theirsBest.score,
        note: loadType === 'per_side'
          ? 'Both hands together — half of it was in each.'
          : 'What was actually on the bar.',
        mineSet: setDetail(mineBest),
        theirsSet: setDetail(theirsBest),
      }));
    }
    if (loadType === 'per_side') {
      caveats.push({
        key: 'per-side',
        text: 'The weights here are the total of both sides, because that is what the body '
          + 'lifted — a 50 lb dumbbell in each hand counts as 100 lb, for both of you.',
      });
    }
  }

  /* ---- 8. most reps in a set — only where the load rows are refused ---- */
  //
  // On a bodyweight movement this is the honest comparison that survives, and
  // §13 Step 6's constraint 3 says as much: a pull-up rep is a pull-up rep.
  //
  // It is deliberately ABSENT on a weighted exercise, where "most reps in one
  // set" rewards whoever went lightest for longest and would sit beside two
  // strength rows implying it means the same kind of thing.
  //
  // ⚠️ The rep gate is NOT applied here, and that is not a loophole. D5 caps
  // what a MAXIMUM may be inferred from; this row infers nothing. Twenty
  // press-ups is twenty press-ups — a recorded number, and refusing to show it
  // above fifteen would be refusing to show a measurement.
  if (!loadIsComparable(exercise) && exercise && (exercise.fields || []).includes('reps')) {
    const score = (o) => o.reps;
    const mineBest = bestBy(myObs, score);
    const theirsBest = bestBy(theirObs, score);
    if (mineBest || theirsBest) {
      metrics.push(metric({
        key: 'top-reps',
        label: 'Most reps in a set',
        unit: 'reps',
        mine: mineBest && mineBest.score,
        theirs: theirsBest && theirsBest.score,
        note: 'Recorded, not estimated.',
        mineSet: setDetail(mineBest),
        theirsSet: setDetail(theirsBest),
      }));
    }
  }

  /* ---- 9. sets logged — and it is NOT judged ---- */
  //
  // Sets are this app's unit (D3: weekly sets per muscle is the headline
  // metric), which is why this row exists and "times trained" and "best
  // single-set volume" do not. Times trained is very nearly the same number
  // said less precisely. Volume is a third load row that would carry both of
  // the load problems above — per side and body weight — while telling the
  // reader nothing the first two did not.
  //
  // 🚨 `judged: false`. MORE SETS IS NOT BETTER. It is more time available, a
  // different programme, a different week — exactly the case Rule 6 names when
  // it says change is coloured only where bigger is genuinely better. The
  // caller gets the two numbers and must not colour them.
  metrics.push(metric({
    key: 'sets',
    label: 'Sets logged',
    unit: 'sets',
    mine: counts.mine.sets,
    theirs: counts.theirs.sets,
    judged: false,
    note: 'Neither number is the better one — training more is not training better.',
  }));

  /* ---- 10. caveats about the comparison itself ---- */
  caveats.unshift({
    key: 'window',
    text: `Both sides cover ${window.label} — ${start} to ${end}. That is as far back as `
      + 'they publish, so anything either of you did before it is left out on purpose: '
      + 'your whole history against their recent months would flatter you every time.',
  });

  if (dropped) {
    caveats.push({
      key: 'rep-gate',
      text: `${dropped} set${dropped === 1 ? '' : 's'} above ${MAX_EVIDENCE_REPS} reps `
        + `${dropped === 1 ? 'is' : 'are'} left out of the strength rows. This app does not `
        + 'read a maximum off a burnout set, for either of you.',
    });
  }

  return {
    ...base,
    window,
    common: true,
    reason: null,
    message: null,
    counts,
    metrics,
    caveats,
  };
}
