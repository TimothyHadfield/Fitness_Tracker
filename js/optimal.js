// The "% optimal" rating — the scoring model.
//
// docs/optimal-rating-plan.md Phase 2 · docs/research.md §6. Tim, 2026-08-18.
//
// ── WHAT THIS NUMBER IS ──────────────────────────────────────────────────────
//
// Every other number in this app is measured (a weight you lifted) or derived
// from published standards with the derivation stated (a percentile). This one
// is a PREDICTION ABOUT SOMEBODY'S BODY rendered as two digits and a percent
// sign, which is the most confident-looking format information has. So the bar
// set in §1 of the plan is: every component traces to a published dose-response
// model, and the screen says how sure it is.
//
// ── THE CURVES ARE FITTED TO PUBLISHED VALUES, NOT INVENTED ──────────────────
//
// Pelland et al. (2025) report, for each outcome, the best-fitting functional
// form and the marginal slope at the mean volume of their data. Those two facts
// pin a one-parameter curve exactly, which is what the constants below are.
// They are derived, not chosen, and the derivation is in each comment so it can
// be checked rather than trusted.
//
// ── THE THREE THINGS IT REFUSES TO DO ────────────────────────────────────────
//
// 1. ⚠️ IT DOES NOT REWARD TRAINING MORE DAYS FOR GROWTH. Frequency has no
//    consistently identifiable independent effect on hypertrophy — slope 0.32 %
//    [95 % CrI -0.14, 0.82], an interval containing zero. Tim said before any
//    of this was read that "just because a workout has more time or exercises
//    doesn't necessarily mean it's more optimal", and the evidence agrees more
//    strongly than he put it. A rating that scored hours would be contradicted
//    by its own source.
// 2. ⚠️ IT DOES NOT EXTRAPOLATE PAST THE DATA. Volume is clamped at 42
//    fractional sets, the top of the evidence range; past 43 the authors say
//    there is insufficient data "or potentially less hypertrophy". Without the
//    clamp a square-root curve keeps rising forever and the rating eventually
//    recommends 60 sets a week, which is the exact failure it exists to avoid.
//    Since 2026-08-19 the SAME refusal runs on the per-session axis:
//    `SESSION_CEILING = 24` in volume-map.js is the top of the per-session data
//    range in Remmert et al. (2025), and its long comment says why the cap is
//    not at that paper's ~11-set "point of diminishing returns". Effect on the
//    nine shipped systems: none. Effect on 60 sets of bench in one day: 25 % ->
//    20 %.
// 3. ⚠️ IT DOES NOT PRETEND TO PRECISION. The source models explain about a
//    QUARTER of the variance (R²marginal 22.3 % hypertrophy, 26.1 % strength).
//    A model that weak cannot honestly separate 83 % from 87 %, so every score
//    leaves here rounded to the nearest 5 and carries a range.
//
// And two it cannot do, both of which are things the UI has to say out loud
// rather than things a comment can settle:
//
// A. The app has no RIR field (D28), so proximity to failure — the variable that
//    most decides whether a set grows anything — is invisible. Every score is
//    conditional on sets being taken HARD ENOUGH. (Phrased as a floor, not as
//    an instruction: ACSM 2026 puts "training to momentary failure is not
//    required" at position-stand level, with 2-3 reps in reserve named as
//    sufficient. docs/research.md §6.16.1.) A programme cannot make you train
//    hard.
//
// B. ⚠️ THE STRENGTH SCORE IS WRONG BY OMISSION, AND IT IS NOT A SMALL
//    OMISSION. A planned workout stores a set COUNT and nothing else —
//    normalizeWorkout() in store.js keeps { exerciseId, sets, notes, group?,
//    setType?, minis? } and every ready-made system puts its rep prescription
//    in prose notes. So 3x20 and 3x5 arrive here identical and leave here with
//    the SAME strength percentage. The evidence says they are not the same:
//    high load vs low load is SMD 0.60 [0.38, 0.82] for strength (Lopez et al.
//    2021, corroborated by ACSM 2026 at 79 % quality of evidence for >= 80 %
//    1RM) — a larger effect than anything this file does model. For hypertrophy
//    the same contrast is SMD 0.12 [-0.06, 0.29], an interval crossing zero, so
//    the GROWTH number is not missing much and needs no such caveat.
//
//    This cannot be fixed here. Fixing it means a load or rep-range field on a
//    planned exercise, which is a data-model change and would make every user
//    type a rep target before their programme could be scored — D9 rules that
//    out. So the number stays and stops implying what it does not know:
//    STRENGTH_CAVEAT below is the sentence, exported from this module for the
//    same reason rateUserSystem() builds its own caption — a caveat kept in a
//    view drifts away from the number it is about. docs/research.md §6.13.
//
// Pure: no DOM, no store. Same as e1rm.js, volume-map.js, social.js.

import {
  SCORED_MUSCLES, weeklyVolume, weeklyFrequency, volumeContributions,
} from './volume-map.js';

/* ------------------------------------------------------------------ *
 * The hypertrophy curve
 * ------------------------------------------------------------------ */

/**
 * Top of the evidence-supported range, in fractional weekly sets per muscle.
 * Their Table 3 runs to 42 and calls 43+ "unclear". Nothing is scored above it.
 */
export const VOLUME_CEILING = 42;

// Square root was the best-fitting form: R(v) = a·√v.
// Its slope is R'(v) = a / (2√v), and the paper reports R' = 0.24 % per set at
// their mean volume of 12.25 sets. So a = 0.24 · 2 · √12.25 = 1.68.
//
// Checked against their Fig. 7, which is the only way to know the fit is the
// right one rather than merely arithmetically consistent: this gives 5.9 % at
// 12 sets and 10.9 % at 42, and the plotted marginal means are ~5-6 % and
// ~10.5 %. It reproduces the published curve, not just the published slope.
const HYP_A = 0.24 * 2 * Math.sqrt(12.25);

/** Predicted % change in muscle size for a weekly volume. */
export function hypertrophyResponse(sets) {
  const v = Math.min(Math.max(Number(sets) || 0, 0), VOLUME_CEILING);
  return HYP_A * Math.sqrt(v);
}

/* ------------------------------------------------------------------ *
 * The strength curves
 * ------------------------------------------------------------------ */

export const STRENGTH_VOLUME_CEILING = 10;   // far past the plateau in Table 4
export const STRENGTH_FREQ_CEILING = 6;      // sessions/week for one muscle

// Reciprocal was the best-fitting form for both strength models. Written as a
// rectangular hyperbola R(v) = A·v / (v + k): it starts at zero, rises steeply
// and flattens to an asymptote A, which is the "strong diminishing returns and
// a functional plateau" the paper describes.
//
// VOLUME: slope R'(v) = A·k / (v + k)², reported as 0.21 % per set at their
// mean of 8.14 sets. Taking the asymptote A = 20 % from their Fig. 8 and
// solving 20k / (8.14 + k)² = 0.21 gives k ≈ 0.86. That reproduces their curve:
// 10.8 % at one set, 17.1 % at five, 18.4 % at ten — and their Table 4 puts the
// minimum effective dose at ONE set and the plateau at about five.
const STR_A = 20, STR_K = 0.86;

// FREQUENCY: fitted directly to the two points the paper states rather than to
// a slope — 12.72 % at one session a week and 17.32 % at two. Same form.
const FRQ_A = 27.1, FRQ_K = 1.13;

export function strengthVolumeResponse(sets) {
  const v = Math.min(Math.max(Number(sets) || 0, 0), STRENGTH_VOLUME_CEILING);
  return (STR_A * v) / (v + STR_K);
}

export function strengthFrequencyResponse(sessions) {
  const f = Math.min(Math.max(Number(sessions) || 0, 0), STRENGTH_FREQ_CEILING);
  return (FRQ_A * f) / (f + FRQ_K);
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

// ⚠️ THIS WEIGHTING IS OURS, NOT THEIRS, and it is the largest modelling
// assumption in this file. The paper fits volume and frequency as separate
// fixed effects on strength, each adjusted for the other; it never combines
// them into one predicted value. Splitting the strength score evenly between
// them is a composition we chose, because a single number was asked for. It is
// stated here, in the plan, and on screen — and it is the first thing to
// revisit if the strength ratings ever look wrong.
const STRENGTH_VOLUME_SHARE = 0.5;

/**
 * ⚠️ Rounding to 5 IS the honesty mechanism, not cosmetics.
 *
 * With models explaining a quarter of the variance, the difference between 83
 * and 87 is noise wearing a number's clothes. Everything leaves here on a
 * 5-point grid so the screen cannot imply a precision the source does not have.
 */
export function band(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return Math.round(p / 5) * 5;
}

/**
 * How long one pass through a programme's workout list actually takes, in
 * weeks.
 *
 * ⚠️ A SYSTEM'S WORKOUT LIST IS A ROTATION, NOT A WEEK, and assuming otherwise
 * was a real bug — caught by the Golden Six scoring absurdly low. It stores
 * ONE workout and is trained three days a week, so counting its list once gave
 * it a third of its true volume and a frequency of 1 instead of 3. Push Pull
 * Legs has the same shape: three workouts, six days, so the rotation runs
 * twice.
 *
 * So one pass takes `workouts / daysPerWeek` weeks. `cycleDays` overrides it
 * for anything that does not divide into a week — Chris Bumstead's is six
 * workouts across an EIGHT-day cycle, which drifts across the calendar on
 * purpose and is 8/7 of a week however many days he trains.
 */
export function weeksForRotation(workoutCount, daysPerWeek, cycleDays) {
  if (cycleDays > 0) return cycleDays / 7;
  const w = Number(workoutCount) || 0;
  const d = Number(daysPerWeek) || 0;
  if (!w || !d) return 1;
  return w / d;
}

/**
 * Minutes a working set costs, including the rest after it.
 *
 * ⚠️ ARITHMETIC, NOT A FINDING — but it is no longer an unsourced one. It was
 * written when the rest-interval literature was on the "still to pull" list;
 * that axis has since been pulled (docs/research.md §6.8), and the rest
 * intervals actually used in the studies behind the dose-response are
 * 1.80 ± 0.68 min for the hypertrophy effects and 2.04 ± 0.79 for the strength
 * ones. Three minutes is a set of 30–45 seconds plus a rest at the TOP of that
 * band — inside the observed distribution rather than beyond it, which is the
 * right direction for a number that tells somebody how long a session takes.
 * Erring long overestimates the cost of training; erring short would promise
 * people a workout that does not fit in the time they have.
 *
 * The rest axis cannot enter the RATING for a separate reason: rest is a global
 * user setting, not a property of a programme, so there is nothing per-system
 * to score. And it would not move much if it could — the meta-analytic
 * difference between short and long rest crosses zero on every measure.
 *
 * Anything shown from this says it is an estimate. js/goals.js re-exports it
 * rather than keeping a second copy, so the goal screen's minutes and a
 * system's badge can never disagree.
 */
export const MINUTES_PER_SET = 3;

/**
 * Roughly how long one session of this programme takes, from its set count.
 *
 * Only used where the programme does not DECLARE a length. A ready-made system
 * states its own minutes and that is a better number than any arithmetic — it
 * comes from whoever wrote the programme. One the user typed states nothing,
 * and "no idea" is a worse answer on a summary badge than a stated estimate.
 */
export function estimateMinutesPerSession(workouts) {
  const list = (workouts || []).filter((w) => w && (w.exercises || []).length);
  if (!list.length) return null;
  const total = list.reduce((sum, w) => sum
    + w.exercises.reduce((s, e) => s + (Number(e.sets) > 0 ? Number(e.sets) : 0), 0), 0);
  if (!total) return null;
  return Math.round((total / list.length) * MINUTES_PER_SET);
}

/**
 * Rate a programme.
 *
 * @param {Array} workouts  [{ exercises: [{ exerciseId, sets }] }]
 * @param {Map}   exMap     exerciseId -> exercise
 * @param {object} opts     { daysPerWeek, minutesPerSession, cycleDays, weeks }
 *
 * `weeks` is normally left alone — it is derived by weeksForRotation() above,
 * because getting it wrong silently scales every number in the result.
 */
export function rateProgramme(workouts, exMap, opts = {}) {
  const weeks = opts.weeks > 0
    ? opts.weeks
    : weeksForRotation((workouts || []).length, opts.daysPerWeek, opts.cycleDays);
  const volume = weeklyVolume(workouts, exMap, weeks);
  const frequency = weeklyFrequency(workouts, exMap, weeks);

  const hypCeiling = hypertrophyResponse(VOLUME_CEILING);
  const strVolCeiling = strengthVolumeResponse(STRENGTH_VOLUME_CEILING);
  const strFrqCeiling = strengthFrequencyResponse(STRENGTH_FREQ_CEILING);

  const perMuscle = SCORED_MUSCLES.map((muscle) => {
    const v = volume.get(muscle) || 0;
    const f = frequency.get(muscle) || 0;
    const hyp = hypertrophyResponse(v) / hypCeiling;
    const str = STRENGTH_VOLUME_SHARE * (strengthVolumeResponse(v) / strVolCeiling)
              + (1 - STRENGTH_VOLUME_SHARE) * (strengthFrequencyResponse(f) / strFrqCeiling);
    return { muscle, sets: v, sessions: f, hypertrophy: hyp * 100, strength: str * 100 };
  });

  const mean = (key) => perMuscle.reduce((s, m) => s + m[key], 0) / perMuscle.length;

  // Cost, and the efficiency read that is the actual point of the exercise.
  const daysPerWeek = Number(opts.daysPerWeek) || (workouts || []).length / weeks;
  const minutes = Number(opts.minutesPerSession) || 0;
  const weeklyMinutes = minutes * daysPerWeek;

  const hypertrophy = mean('hypertrophy');
  const strength = mean('strength');

  return {
    hypertrophy: band(hypertrophy),
    strength: band(strength),
    // Kept unrounded for ordering and for the efficiency figure — the banding
    // is for DISPLAY, and sorting on banded values would scramble ties.
    raw: { hypertrophy, strength },
    perMuscle,
    // Growth stimulus per hour trained. This is where a three-day programme can
    // beat a six-day one outright, and by §2.3 of the plan it is the number
    // nobody else shows.
    perHour: weeklyMinutes > 0 ? hypertrophy / (weeklyMinutes / 60) : null,
    daysPerWeek,
    weeklyMinutes: weeklyMinutes || null,
    // What one session costs, for the summary badge. Declared beats estimated
    // and `minutesEstimated` says which it is, because "~70 min because the
    // author said so" and "~70 min because we multiplied the sets by three" are
    // not the same claim and the screen has to be able to tell them apart.
    // ⚠️ `perHour` and `weeklyMinutes` above still use the DECLARED figure only.
    // Folding an estimate into them would quietly change the efficiency reading
    // of every system the user typed themselves.
    minutesPerSession: minutes || estimateMinutesPerSession(workouts),
    minutesEstimated: !minutes,
    // Muscles that never reach the minimum effective dose of 4 sets. Reported
    // in words rather than folded into the number, so "good programme that
    // skips calves" reads as exactly that.
    under: perMuscle.filter((m) => m.sets < 4).map((m) => m.muscle),
  };
}

/* ------------------------------------------------------------------ *
 * Rating a system the USER built
 *
 * A ready-made system declares how many days a week it is trained. One the user
 * typed does not, and that number is not optional — it decides how often the
 * rotation repeats, and getting it wrong scales every result. Three workouts
 * trained three days a week and the same three trained six are not the same
 * programme.
 *
 * ⚠️ The app does not have to ASK. It already knows how often they train it,
 * because it has their sessions. Measuring what somebody actually does beats a
 * number they typed once and never revisited — and it is the same principle as
 * next-workout.js, which reads history and then says what it read.
 * ------------------------------------------------------------------ */

export const OBSERVE_WINDOW_DAYS = 28;
/** Below this, a rate per week is noise. Two weeks is the floor. */
export const MIN_OBSERVED_SPAN_DAYS = 14;

const dayNumber = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  // ⚠️ SPLIT, then Date.UTC — pure calendar arithmetic with no zone in it at
  // all. Two things have to be true here and only this form gives both.
  //
  //   `new Date(iso)` reads a bare date as UTC midnight and lands a day early
  //   for everyone west of Greenwich. That is the trap docs/handbook.md §4 records,
  //   and splitting the string is what avoids it.
  //
  //   ⚠️ But splitting into a LOCAL Date and flooring — which is what this did
  //   until 2026-08-22 — only yields a stable day index while the zone's UTC
  //   offset stays on one side of zero. Europe/London, Dublin, Lisbon and the
  //   Canaries are UTC+0 in winter and UTC+1 in summer, so local midnight sits
  //   on the same UTC day all winter and on the PREVIOUS one all summer, and
  //   the index jumps by 0 or 2 across each DST change. 29 and 30 March 2026
  //   collapsed to one number, so two logged sessions counted as one and every
  //   "% optimal" rating built on observed frequency read low.
  //
  // Date.UTC has no offset to move, so the difference between two day numbers
  // is exactly the number of calendar days everywhere. Same form as
  // dayNumber() in strength-estimate.js and e1rm.js.
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/**
 * How many days a week they actually train this system.
 *
 * @param {string[]} dates    session dates (YYYY-MM-DD) belonging to the system
 * @param {string}   todayISO clock passed in, so this stays pure
 * @returns {{daysPerWeek: number, spanDays: number, sessions: number} | null}
 *          null when there is not enough history to say — which the caller must
 *          treat as "assume nothing", not as zero.
 */
export function observedDaysPerWeek(dates, todayISO, windowDays = OBSERVE_WINDOW_DAYS) {
  const today = dayNumber(todayISO);
  if (today === null) return null;

  const days = [...new Set((dates || []).map(dayNumber).filter((d) => d !== null))]
    .filter((d) => d <= today && d > today - windowDays);
  if (!days.length) return null;

  // Measured from their FIRST session in the window, not from the window edge —
  // somebody three weeks into a new programme should be judged on those three
  // weeks, not marked down for the week before it existed.
  const spanDays = today - Math.min(...days) + 1;
  if (spanDays < MIN_OBSERVED_SPAN_DAYS) return null;

  const perWeek = days.length / (spanDays / 7);
  return { daysPerWeek: Math.min(7, perWeek), spanDays, sessions: days.length };
}

/**
 * Rate a system, working out for itself how often it is trained.
 *
 * Returns the rating plus a `basis` saying which it used, because the screen has
 * to be able to say so. A rating computed from an assumption and a rating
 * computed from ten sessions are not the same claim.
 */
export function rateUserSystem(workouts, exMap, {
  sessionDates, todayISO, minutesPerSession, declaredDaysPerWeek, cycleDays,
} = {}) {
  const observed = observedDaysPerWeek(sessionDates, todayISO);

  // ⚠️ THREE bases, in this order, and the order is the whole fix for a real
  // bug: a ready-made system rated one way on Explore and a different way once
  // copied into the library, because the copy had lost the programme's own
  // "6 days a week" and fell back to assuming one pass.
  //
  //   measured  — what they actually do. Always wins when it exists.
  //   declared  — what the programme says it is. Right for a copy with no
  //               history yet, and it makes the two screens agree.
  //   assumed   — one pass a week. Only for a system somebody typed from
  //               scratch, which declares nothing.
  const basis = observed ? 'measured' : (declaredDaysPerWeek > 0 ? 'declared' : 'assumed');
  const daysPerWeek = observed ? observed.daysPerWeek
    : (declaredDaysPerWeek > 0 ? declaredDaysPerWeek : (workouts || []).length);

  const rating = rateProgramme(workouts, exMap, {
    daysPerWeek,
    minutesPerSession,
    // A declared cycle only applies while the days count is declared too. Once
    // there is real history, the history already knows about the rest days.
    cycleDays: observed ? 0 : cycleDays,
  });

  const CAPTIONS = {
    measured: observed && `Based on the ${observed.sessions} session${observed.sessions === 1 ? '' : 's'} `
      + `you have logged in the last ${Math.round(observed.spanDays / 7)} weeks — about `
      + `${observed.daysPerWeek.toFixed(1)} days a week.`,
    declared: `Based on this programme's ${declaredDaysPerWeek} days a week. Once you have logged a `
      + 'couple of weeks, this switches to what you actually do.',
    assumed: 'Assuming you train each workout once a week. Log a couple of weeks and this will be '
      + 'measured from what you actually do instead.',
  };

  return {
    ...rating,
    basis,
    observed,
    // Built by the module that computed the number, so the sentence and the
    // number cannot drift apart — the same reason next-workout.js builds its own.
    caption: CAPTIONS[basis],
  };
}

/**
 * What the number means, in a sentence, for the screen.
 *
 * Deliberately NOT "83 % optimal". A percentage of a theoretical maximum nobody
 * reaches needs saying out loud, or the reader will assume 100 is the target
 * and that anything less is a bad programme.
 */
export function explain(score) {
  return `${score} % of the most growth stimulus the research supports. Nothing real reaches 100 % `
       + '— that would mean 42 hard sets per muscle every week, which nobody recovers from.';
}

/* ------------------------------------------------------------------ *
 * ⚠️ What the STRENGTH number does not know
 *
 * See B in the header. These two strings are the on-screen half of that, and
 * they live here rather than in a view so that the caveat and the number ship
 * together. The short one is for the badge's title, where four cells share a
 * phone's width; the long one is for a screen with room to say it properly.
 * ------------------------------------------------------------------ */

export const STRENGTH_CAVEAT_SHORT =
  'How much work a programme does, not how heavy it is. This app stores a set count, not a weight '
  + 'or a rep range — so 3 sets of 20 and 3 sets of 5 score the same here, and for strength they '
  + 'are not the same.';

export const STRENGTH_CAVEAT =
  'What the strength score cannot see: how heavy the sets are. A workout here stores a number of '
  + 'sets, not a weight or a rep range, so a programme of 3 sets of 20 and a programme of 3 sets '
  + 'of 5 get the same strength percentage. They are not the same — training at about 8 reps or '
  + 'fewer builds clearly more strength than lighter work does, and that difference is bigger than '
  + 'anything this score does measure. The growth percentage is not affected: for muscle size, how '
  + 'hard the set is matters far more than how heavy it is.';

/* ------------------------------------------------------------------ *
 * Exercise order
 *
 * docs/research.md §6.16. ACSM's 2026 position stand (Currier et al., MSSE
 * 58(4):851-872 — 137 systematic reviews, the first in seventeen years) grades
 * exercise ORDER at 88 % quality of evidence, the highest of anything in it:
 * work you want to get stronger at belongs at the start of a session.
 *
 * ⚠️ Design Rule 6 says no unearned opinions, and this is the test case for it.
 * 88 % QoE from a position stand is about as earned as this project's evidence
 * gets — better than the dose-response curves the whole rating is built on — so
 * the app is allowed to say what it says. What it is NOT allowed to do is
 * scold, refuse a save, reorder anything, or move a score:
 *
 *   - It does not enter the rating. The stand grades order under STRENGTH and
 *     makes no equivalent claim for hypertrophy, and folding a per-position
 *     multiplier into the score would mean inventing an effect size the stand
 *     does not publish. See docs/optimal-rating-plan.md §9.
 *   - It fires as a NOTE in the workout builder and nowhere else — at the one
 *     moment somebody is deciding the order, which is D8.
 *   - It says outright that leaving the order alone is a legitimate answer.
 * ------------------------------------------------------------------ */

/** The position stand's own quality-of-evidence grade for this one. */
export const ORDER_QOE = 88;

/**
 * ⚠️ Not the same question as `isCompound()` in js/progression.js, and the two
 * must not be merged. That one asks "how big an increment may this lift take"
 * and deliberately only says yes for LARGE muscle groups. This one asks "is
 * this a multi-joint lift somebody would want to be fresh for", which includes
 * the overhead press and the pull-up.
 *
 * Judgement, and stated as judgement. The signal is volume-map's own
 * contributions — a lift crossing two muscle groups or more is multi-joint —
 * with two corrections:
 *
 *   - Forearms and Core are ignored, because nearly everything pays them
 *     something and a curl is not a compound for having a grip.
 *   - A short exclusion list for the multi-muscle movements nobody trains
 *     heavy: face pulls, upright rows, pullovers, back extensions, shrugs,
 *     carries, raises, flyes, crossovers and kickbacks.
 *
 * It errs toward NOT flagging (a glute-ham raise is a real compound and is
 * excluded by the /raise/ rule), which is the right direction: a note that does
 * not appear costs nothing, and one that appears over a correctly ordered
 * workout costs the app's credibility.
 */
const NOT_COMPOUND = /face pull|upright row|pullover|extension|shrug|carry|raise|fly|crossover|kickback/i;

export function isCompoundLift(exercise) {
  if (!exercise) return false;
  const parts = volumeContributions(exercise)
    .filter((c) => c.muscle !== 'Forearms' && c.muscle !== 'Core');
  if (parts.length < 2) return false;
  return !NOT_COMPOUND.test(String(exercise.name || ''));
}

/**
 * Compound lifts sitting behind isolation work, and the sentence to say about
 * them.
 *
 * @param {Array} exercises [{ exerciseId }] in the order they will be performed
 * @param {Map}   exMap     exerciseId -> exercise
 * @returns {{names: string[], text: string} | null} null when there is nothing
 *          to say — which is the common case and must stay silent, not render
 *          an empty reassurance.
 *
 * Exercises that produce no countable volume (cardio, an id that is not in the
 * library) are skipped rather than treated as isolation, so five minutes on a
 * bike as a warm-up does not make the squat behind it "out of order".
 */
export function exerciseOrderNote(exercises, exMap) {
  let seenIsolation = false;
  const late = [];

  for (const item of exercises || []) {
    const ex = exMap && exMap.get ? exMap.get(item && item.exerciseId) : null;
    if (!ex || !volumeContributions(ex).length) continue;
    if (isCompoundLift(ex)) {
      if (seenIsolation) late.push(ex.name);
    } else {
      seenIsolation = true;
    }
  }
  if (!late.length) return null;

  const names = late.length === 1
    ? late[0]
    : `${late.slice(0, -1).join(', ')} and ${late[late.length - 1]}`;

  return {
    names: late,
    text: `${names} ${late.length === 1 ? 'comes' : 'come'} after isolation work. The 2026 ACSM `
      + `position stand grades exercise order at ${ORDER_QOE} % quality of evidence — the highest `
      + 'of anything in it — and what it found is that the lifts you want to get stronger at do '
      + 'best at the start of a session, while you are fresh. That is a strength finding; it makes '
      + 'no claim about muscle size. Leave the order alone if it is what you meant.',
  };
}
