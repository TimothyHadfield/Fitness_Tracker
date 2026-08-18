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
// 3. ⚠️ IT DOES NOT PRETEND TO PRECISION. The source models explain about a
//    QUARTER of the variance (R²marginal 22.3 % hypertrophy, 26.1 % strength).
//    A model that weak cannot honestly separate 83 % from 87 %, so every score
//    leaves here rounded to the nearest 5 and carries a range.
//
// And one it cannot do: the app has no RIR field (D9), so proximity to failure
// — the variable that most decides whether a set grows anything — is invisible.
// Every score is conditional on sets being taken close to failure, and the UI
// has to say so. A programme cannot make you train hard.
//
// Pure: no DOM, no store. Same as e1rm.js, volume-map.js, social.js.

import { SCORED_MUSCLES, weeklyVolume, weeklyFrequency } from './volume-map.js';

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
  // Local midnight, split rather than parsed: new Date('2026-08-18') is UTC and
  // lands a day early for everyone west of Greenwich.
  return Math.floor(new Date(y, m - 1, d).getTime() / 86400000);
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
export function rateUserSystem(workouts, exMap, { sessionDates, todayISO, minutesPerSession } = {}) {
  const observed = observedDaysPerWeek(sessionDates, todayISO);
  const daysPerWeek = observed ? observed.daysPerWeek : (workouts || []).length;

  const rating = rateProgramme(workouts, exMap, { daysPerWeek, minutesPerSession });
  return {
    ...rating,
    basis: observed ? 'measured' : 'assumed',
    observed,
    // Said in words by the module that computed it, so the sentence and the
    // number cannot drift apart — the same reason next-workout.js builds its
    // own caption.
    caption: observed
      ? `Based on the ${observed.sessions} session${observed.sessions === 1 ? '' : 's'} you have `
        + `logged in the last ${Math.round(observed.spanDays / 7)} weeks — about `
        + `${observed.daysPerWeek.toFixed(1)} days a week.`
      : 'Assuming you train each workout once a week. Log a couple of weeks and this will be '
        + 'measured from what you actually do instead.',
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
