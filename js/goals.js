// Goals — the model.
//
// docs/vision.md §1.6 · docs/goals-plan.md, Phases 1 and 2. Tim, 2026-08-18.
//
// ── WHAT A GOAL IS, AND WHY IT IS A LEVEL ────────────────────────────────────
//
// A goal is "get this muscle from where it is to <level>, in twelve weeks".
//
// It is NOT "+30 lb on your bench", and the difference is the whole design.
// Individual change over a 12-week programme, in people of the same age doing
// the same training, runs from 0 % to 250 % for strength (research.md §6.11).
// Population data cannot tell one person what they will gain in three months,
// so a goals screen offering a predicted number would be making a promise the
// literature cannot support for anybody.
//
// A LEVEL side-steps that completely. The app already places every muscle on a
// seven-level scale adjusted for body weight, sex and age, and already knows the
// weight that clears each one. So the goal makes no prediction at all — it says
// what would COUNT as hitting it, which is a different kind of claim and one
// this app can stand behind.
//
// ⚠️ AND A TARGET IS NOT A PROMISE. Tim, 2026-08-18: "it's okay if they struggle
// to hit this goal. This doesn't mean the site is promising them gains." The
// evidence backs him — non-responders are rare (82 % robust or excellent
// responders, 5 % poor) and individual responsiveness is reproducible. Almost
// everyone who trains gets stronger. Nothing here predicts by how much.
//
// ── THE ONE THING THIS MODULE MUST NEVER DO ──────────────────────────────────
//
// ⚠️ NOTHING HERE READS THE DEADLINE TO DECIDE A WEIGHT. docs/goals-plan.md §3.1
// is the most serious problem in the whole feature: load that follows a calendar
// pushes hardest at exactly the wrong moment, so somebody who has missed two
// weeks and is "behind schedule" would be handed HEAVIER weights — when the
// correct response to a lay-off is to come back lighter. That is the one failure
// mode in this app that could cause physical harm rather than merely be wrong on
// a screen. Progression is computed from the last session (research.md §12, the
// ACSM 2-for-2 rule) and the goal never touches it. What the goal changes is
// what the app TELLS you about the gap, which is information rather than
// instruction.
//
// ── THE VERDICT IS NOT HERE, ON PURPOSE ──────────────────────────────────────
//
// "On track / ahead / behind" is Phase 3 and it is gated on the strength
// estimator (docs/strength-estimate-plan.md). A working-set e1RM moves several
// percent day to day on sleep, food and time of day alone, so a verdict computed
// off raw session numbers would tell somebody they are behind because they had a
// bad Tuesday. Tim set the bar higher still: "behind" fires only when it is
// extremely unlikely the goal can be reached, which means measuring against an
// uncertainty band and not a point. Until that exists this module reports the
// MEASURED gap and says nothing about whether it is good or bad.
//
// Pure: no DOM, no store, no clock of its own — `today` is passed in. Same shape
// as e1rm.js, next-workout.js, optimal.js and volume-map.js.

import { LEVELS, weightForPercentile } from './strength-standards.js';
import { MINUTES_PER_SET } from './optimal.js';

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const DAY = 86400000;

// YYYY-MM-DD parsed as LOCAL midnight, split rather than passed to Date(),
// which reads a bare date string as UTC and lands a day early for everybody
// west of Greenwich. Same trap next-workout.js documents.
export function parseDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDay(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function addDays(iso, days) {
  const d = parseDay(iso);
  if (!d) return null;
  return formatDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export function daysBetween(fromISO, toISO) {
  const a = parseDay(fromISO), b = parseDay(toISO);
  if (!a || !b) return null;
  return Math.round((b - a) / DAY);
}

/**
 * Three months, and it is fixed rather than a dial.
 *
 * Twelve weeks is what Tim asked for, and it is also the horizon the
 * variability evidence is quoted over (research.md §6.11), so the caveats the
 * screen carries are about the same span as the goal.
 */
export const HORIZON_WEEKS = 12;

/* ------------------------------------------------------------------ *
 * Ambition
 * ------------------------------------------------------------------ */

/**
 * ⚠️ AMBITION IS DERIVED FROM THE GOAL, NEVER SET SEPARATELY.
 *
 * A dial saying "how hard do you want to try" beside a target saying "reach
 * Proficient" is two controls for one decision, and they can disagree. The
 * ambition of a goal IS how far it reaches: the required increase in estimated
 * max, as a fraction. Pick a bigger jump and the requirements grow, which is the
 * trade Tim asked for — "this lets the user know what they should be willing to
 * sacrifice."
 *
 * ⚠️ THE BOUNDARIES ARE OURS, but they are not arbitrary — they are anchored on
 * what the strength dose-response itself predicts. The meta-regressions in
 * research.md §6 put the strength effect of a well-dosed programme at roughly
 * 17–20 % over interventions averaging 10.4 weeks (js/optimal.js reproduces both
 * curves: 16.5 % at the minimum effective dose, ~19 % at high volume and three
 * sessions). So:
 *
 *   under 10 %   below what those models predict even at the minimum dose
 *   10–25 %      straddles what they predict for a well-run programme
 *   over 25 %    past the average response in that literature entirely
 *
 * ⚠️ That is a statement about the AVERAGE in a meta-regression, and it is not
 * a prediction about the person reading it — individual response over twelve
 * weeks ranges 0–250 % (§6.11), which is exactly why none of this is presented
 * as "you will gain X". It calibrates how much the app ASKS OF YOU, nothing
 * more. Everything each band then requires is separately cited.
 */
export const AMBITIONS = [
  {
    key: 'steady',
    name: 'Steady',
    maxGain: 0.10,
    blurb: 'A short step up. The lightest this asks of you.',
    // Straight off Table 3 of Pelland et al. — 4 sets is where the effect first
    // exceeds the smallest detectable effect size, and 5–10 is the band where
    // each further set buys the most.
    sets: [4, 6],
    setsWhy: 'The minimum effective dose, into the start of the best-value band.',
    // The 1 → 2 sessions jump is the big one for strength: 12.72 % → 17.32 %.
    // Everything after it has accelerating diminishing returns (§6.3).
    sessions: [2, 2],
    // §10.2 of the plan: 0.73 g/lb is the best estimate of the breakpoint above
    // which more protein did nothing detectable (Morton 2018).
    proteinPerLb: 0.73,
    proteinWhy: 'The best estimate of the point where more protein stops helping.',
    // Ours, and stated as ours. A smaller target survives a missed week better.
    weeksOnPlan: 8,
  },
  {
    key: 'committed',
    name: 'Committed',
    maxGain: 0.25,
    blurb: 'A real jump. It wants most weeks to go to plan.',
    sets: [7, 10],
    setsWhy: 'The rest of the best-value band — around 6 more sets buys another detectable step.',
    sessions: [2, 2],
    proteinPerLb: 0.73,
    proteinWhy: 'The best estimate of the point where more protein stops helping.',
    weeksOnPlan: 10,
  },
  {
    key: 'ambitious',
    name: 'Ambitious',
    maxGain: Infinity,
    blurb: 'A long way in twelve weeks. Expect it to cost you time and hard sets.',
    sets: [11, 18],
    setsWhy: 'Intermediate efficiency — still climbing, but around 8.5 more sets per further step.',
    sessions: [3, 3],
    // §10.2: the upper end buys CERTAINTY, not extra growth. The 95 % CI on the
    // breakpoint runs to 1.0 g/lb, so aiming there clears the bar even if the
    // true threshold sits at the top of the interval — and on the days you fall
    // short of what you meant to eat.
    proteinPerLb: 1.0,
    proteinWhy: 'The top of the confidence interval — so you clear the bar even if it sits higher '
      + 'than the best estimate, and on the days you fall short.',
    weeksOnPlan: 11,
  },
];

export function ambitionFor(gain) {
  const g = Number(gain);
  if (!Number.isFinite(g)) return AMBITIONS[0];
  return AMBITIONS.find((a) => g < a.maxGain) || AMBITIONS[AMBITIONS.length - 1];
}

export function ambitionByKey(key) {
  return AMBITIONS.find((a) => a.key === key) || null;
}

/* ------------------------------------------------------------------ *
 * What a goal asks of you
 * ------------------------------------------------------------------ */

// The cost of a set in minutes lives in optimal.js, which is the module that
// reasons about what a programme costs. Re-exported rather than copied: the
// goal screen's "minutes a week on this muscle" and a system's "~70 min" badge
// are the same assumption, and two copies of it would drift.
export { MINUTES_PER_SET } from './optimal.js';

/**
 * ⚠️ Sleep gets the SAME sentence at every ambition, and that is a correction
 * rather than an oversight.
 *
 * The plan originally wanted sleep to scale with the goal. It cannot: what
 * exists is an experiment on TOTAL deprivation — one night without sleep cut
 * postprandial muscle protein synthesis 18 % (Lamon et al. 2021) — and no
 * dose–response from habitual hours to gains exists at all. "8 hours for the
 * ambitious goal, 6 for the relaxed one" would be inventing a curve. So the app
 * says the measured thing, once, at every level.
 */
export const SLEEP_LINE = 'Losing a night’s sleep cuts the rate you build muscle by about a '
  + 'fifth for the next day. There is no evidence saying how many hours a goal needs, so this is '
  + 'the same at every level rather than a number we made up.';

/**
 * ⚠️ Effort does NOT scale here either, and this one is a deliberate departure
 * from docs/goals-plan.md §10.4.
 *
 * That table lists effort as scaling with ambition, and it is right — for
 * GROWTH. Hypertrophy improves as sets end nearer failure. But these goals are
 * STRENGTH levels, and the same paper found strength largely indifferent to
 * reps-in-reserve (research.md §6.7). Scaling a requirement by ambition on
 * evidence that says it does not move the outcome would be exactly the mistake
 * §10.1 caught with protein. So effort is stated once, with the split named.
 */
export const EFFORT_LINE = 'Take the last set of each exercise to within a rep or two of failure. '
  + 'This is the one requirement that does not grow with the goal: sets closer to failure clearly '
  + 'build more muscle, but the strength evidence is largely indifferent to how close you go.';

/**
 * Everything a goal asks for, ready to render.
 *
 * @param {string} ambitionKey
 * @param {object} opts  { bodyWeight } — pounds, for the protein figure
 */
export function requirementsFor(ambitionKey, { bodyWeight } = {}) {
  const a = ambitionByKey(ambitionKey) || AMBITIONS[0];
  const bw = Number(bodyWeight);
  const grams = bw > 0 ? Math.round(bw * a.proteinPerLb) : null;
  const minutes = [a.sets[0] * MINUTES_PER_SET, a.sets[1] * MINUTES_PER_SET];

  return {
    ambition: a,
    sets: a.sets,
    sessions: a.sessions,
    minutes,
    proteinPerLb: a.proteinPerLb,
    proteinGrams: grams,
    weeksOnPlan: a.weeksOnPlan,

    // One row per lever, each saying whether it grows with the goal and where
    // the number came from. `scales: false` is as load-bearing as `true` —
    // §10.1's whole point is that presenting protein as a dial would imply more
    // buys more muscle, which the meta-analysis found not to be true.
    rows: [
      {
        key: 'sets',
        label: 'Hard sets a week',
        value: `${a.sets[0]}–${a.sets[1]}`,
        // The muscle qualifier moved out of the LABEL and into the sentence: the
        // label shares its line with a chip, and "Hard sets a week, on this
        // muscle" pushed that chip onto a second line on every phone.
        //
        // ⚠️ "HARD SET" IS THE UNIT THIS WHOLE MODEL RESTS ON AND WAS NEVER
        // DEFINED ANYWHERE IN THE APP. The UX review called that the finding
        // closest to a real defect, because it is the number Goals measures the
        // user by — and the app counts something slightly different from what
        // the research counted. Defined here, at the one place the target is
        // stated, and the mismatch is admitted in the measured row rather than
        // hidden. See MEASURED_SETS_CAVEAT below.
        detail: `On this muscle specifically. A hard set means a working set taken close to failure `
          + `— roughly one to three reps left in you. Warm-ups do not count toward it. ${a.setsWhy}`,
        source: 'Pelland et al. 2025, Table 3',
        scales: true,
      },
      {
        key: 'sessions',
        label: 'Sessions a week',
        value: a.sessions[0] === a.sessions[1] ? String(a.sessions[0])
          : `${a.sessions[0]}–${a.sessions[1]}`,
        detail: 'Sessions that train this muscle, not days in the gym. Frequency genuinely does '
          + 'drive strength — going from one session a week to two is the big step, and it flattens '
          + 'fast after that. It does not drive growth at all.',
        source: 'Pelland et al. 2025 § frequency',
        scales: true,
      },
      {
        key: 'minutes',
        label: 'Minutes a week',
        value: `${minutes[0]}–${minutes[1]}`,
        detail: `On this muscle, and it follows from the sets — about ${MINUTES_PER_SET} minutes `
          + 'each including the rest after it. Everything else in the session is on top of this.',
        source: 'Arithmetic, not a finding',
        scales: true,
      },
      {
        key: 'effort',
        label: 'How hard the sets are',
        value: 'Within 1–2 reps of failure',
        // ⚠️ `phrase: true` is a LAYOUT fact the model owns, and it is here
        // rather than in the view because only the model knows which of these
        // values are quantities. Everything else is a number that belongs in a
        // right-aligned tabular column; "Within 1–2 reps of failure" put in
        // that column stole 300px from the label and crushed the sentence
        // beside it into a five-word-tall stripe. Seen in a browser, invisible
        // to jsdom.
        phrase: true,
        detail: EFFORT_LINE,
        source: 'Robinson et al. 2024',
        scales: false,
      },
      {
        key: 'consistency',
        label: 'Weeks that go to plan',
        value: `${a.weeksOnPlan} of ${HORIZON_WEEKS}`,
        detail: 'A bigger target has less room for a missed week. This threshold is ours, not a '
          + 'published one.',
        source: 'Our judgement',
        scales: true,
      },
      {
        key: 'protein',
        label: 'Protein a day',
        value: grams ? `${grams} g` : `${a.proteinPerLb} g per lb`,
        // The rate itself is left off this sentence and prepended by the view,
        // which is the only place that knows whether the reader wants g/lb or
        // g/kg. Both published figures are exact: 0.73 g/lb is 1.62 g/kg, the
        // breakpoint Morton reports, and 1.0 g/lb is the 2.2 g/kg top of the CI.
        perLb: a.proteinPerLb,
        detail: `${a.proteinWhy} Eating more than this has not been shown to add anything — the `
          + 'higher figure buys certainty, not extra muscle.',
        source: 'Morton et al. 2018',
        // Deliberately NOT `scales: true`. It moves between bands, but for a
        // reason that is not "more protein, more growth" — see the constant.
        scales: false,
        threshold: true,
      },
      {
        key: 'sleep',
        label: 'Sleep',
        value: 'Enough of it',
        phrase: true,
        detail: SLEEP_LINE,
        source: 'Lamon et al. 2021',
        scales: false,
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Picking a goal
 * ------------------------------------------------------------------ */

/**
 * Every level this muscle has not reached yet, with what it would cost.
 *
 * @param {string} muscle
 * @param {number} estimate    current estimated 1RM of the muscle's key lift
 * @param {number} percentile  where that sits now
 * @param {object} profile     for weightForPercentile — sex, weight, age, compare
 */
export function candidateGoals(muscle, estimate, percentile, profile) {
  const now = Number(estimate);
  const pct = Number(percentile);
  if (!(now > 0) || !Number.isFinite(pct)) return [];

  const out = [];
  for (const level of LEVELS) {
    if (pct >= level.percentile) continue;
    const target = weightForPercentile(level.percentile, muscle, profile);
    if (!(target > 0) || target <= now) continue;
    const gain = target / now - 1;
    out.push({
      muscle,
      level,
      targetWeight: target,
      startWeight: now,
      gain,
      gainPct: gain * 100,
      ambition: ambitionFor(gain),
    });
  }
  return out;
}

/**
 * Freeze a goal.
 *
 * ⚠️ THE TARGET WEIGHT IS STORED, NOT RECOMPUTED, and that is the point.
 * "Proficient" is not a weight — it is a percentile, and the weight behind it
 * moves with body weight, age and the comparison group the user picked (D20).
 * Recomputing it would mean a goal silently getting harder because somebody
 * gained four pounds, or easier because they switched the comparison to
 * "everyone". A goal you agreed to has to stay the goal you agreed to, so the
 * weight, the level name and the comparison it was computed against are all
 * frozen at the moment it is set, and the screen states the comparison.
 */
export function buildGoal({
  muscle, level, targetWeight, startWeight, startPercentile, startLevelKey,
  startDate, comparison, liftName, id,
}) {
  const target = Number(targetWeight);
  const start = Number(startWeight);
  const gain = start > 0 ? target / start - 1 : 0;

  return {
    id: id || null,
    muscle,
    liftName: liftName || null,
    targetLevel: level.key,
    targetLevelName: level.name,
    targetPercentile: level.percentile,
    targetWeight: target,
    startWeight: start,
    startPercentile: Number(startPercentile),
    startLevel: startLevelKey || null,
    startDate,
    endDate: addDays(startDate, HORIZON_WEEKS * 7),
    // Frozen alongside the weight, and for the same reason — the requirements
    // shown for a running goal must be the ones it was set with, not ones
    // recomputed from a target weight that a later body-weight entry moved.
    ambition: ambitionFor(gain).key,
    gainPct: gain * 100,
    comparison: comparison || null,
    status: 'active',
  };
}

/**
 * The sentence describing a goal, built by the module that holds the goal — the
 * same trick next-workout.js and optimal.js use, and for the same reason: a
 * sentence written in a view drifts away from the thing it describes and both
 * halves keep looking fine on their own.
 */
export function describeGoal(goal) {
  if (!goal) return '';
  const lift = goal.liftName || `${goal.muscle} key lift`;
  return `${goal.targetLevelName} ${lift} — by ${goal.endDate}.`;
}

/* ------------------------------------------------------------------ *
 * Where you are
 * ------------------------------------------------------------------ */

/**
 * The measured gap. No verdict — see the header.
 *
 * @param {object} goal
 * @param {number} currentWeight  today's estimated 1RM for the key lift, or null
 * @param {string} today          YYYY-MM-DD
 */
export function goalProgress(goal, currentWeight, today) {
  if (!goal) return null;
  const start = Number(goal.startWeight);
  const target = Number(goal.targetWeight);
  // ⚠️ NOT a bare Number(). Number(null) and Number('') are both 0, which is
  // finite — so "nothing has been recorded for this muscle since the goal was
  // set" would come back as an estimate of zero, draw an empty bar, and report
  // the whole starting weight as a LOSS. Caught by the test, not by reading.
  const now = currentWeight === null || currentWeight === undefined || currentWeight === ''
    ? NaN
    : Number(currentWeight);

  const span = target - start;
  const gained = Number.isFinite(now) ? now - start : null;
  // Unclamped, because a muscle can genuinely be below where it started and the
  // screen must be able to say so rather than draw an empty bar and imply zero
  // progress. The BAR clamps; the number does not.
  const raw = span > 0 && gained !== null ? gained / span : null;

  const elapsed = daysBetween(goal.startDate, today);
  const total = daysBetween(goal.startDate, goal.endDate);
  const left = daysBetween(today, goal.endDate);

  return {
    startWeight: start,
    targetWeight: target,
    currentWeight: Number.isFinite(now) ? now : null,
    // What is left to add, in pounds. Never negative on the display side.
    remaining: Number.isFinite(now) ? Math.max(0, target - now) : null,
    gained,
    rawFraction: raw,
    fraction: raw === null ? null : Math.min(1, Math.max(0, raw)),
    reached: Number.isFinite(now) && now >= target,
    daysElapsed: elapsed,
    daysTotal: total,
    daysLeft: left,
    weeksLeft: left === null ? null : Math.max(0, Math.ceil(left / 7)),
    weeksElapsed: elapsed === null ? null : Math.max(0, Math.floor(elapsed / 7)),
    expired: left !== null && left < 0,
  };
}

/* ------------------------------------------------------------------ *
 * Why progress stalls
 * ------------------------------------------------------------------ */

/**
 * docs/goals-plan.md §9.1 — Tim's idea, and the best one in that exchange.
 *
 * ⚠️ THE SPLIT IS THE WHOLE VALUE. Six things stop people making progress. The
 * app can MEASURE two of them and cannot see the other four at all, and saying
 * which is which is the honest version of this section. It also answers §3.2:
 * the invisible levers get named prominently here instead of being quietly left
 * out of a calculation that then blames your training for them.
 *
 * Nothing here is a verdict on the GOAL. "Your chest gets 3 sets a week and the
 * goal asks for 7" is a measurement of the training, available today and
 * independent of the estimator.
 *
 * @param {object} arg
 * @param {object} arg.requirements  from requirementsFor()
 * @param {object|null} arg.measured { weeklySets, sessionsPerWeek, spanDays, sessions }
 * @param {string} arg.muscle
 */
export function stallReasons({ requirements, measured, muscle }) {
  const req = requirements;
  const has = measured && Number.isFinite(measured.weeklySets);
  const round = (n) => Math.round(n * 10) / 10;

  // ⚠️ THE APP COUNTS EVERY SET YOU LOGGED. The target above is in HARD sets —
  // working sets near failure — and there is no warm-up exclusion on the volume
  // path, so somebody who logs their warm-ups is measured against a number built
  // on sets they did not take near failure.
  //
  // ⚠️ SAID RATHER THAN SILENTLY CORRECTED, and the reason is the direction of
  // the available fix. Excluding sets below some fraction of the day's top set
  // would catch warm-ups — and would also throw away genuine back-off work,
  // which is often the hardest set of the session. That is a judged threshold
  // whose error runs BOTH ways, unlike every other judged constant in this
  // project, so it is not one this file may quietly make. This is the same call
  // the rating makes when it says out loud that a workout stores a set count and
  // not a rep range: name what cannot be seen, on screen, in words.
  const MEASURED_SETS_CAVEAT = ' This counts every set you logged, warm-ups included — '
    + 'so if you log warm-ups, your real hard-set count is lower.';

  const volume = (() => {
    if (!has) {
      return {
        status: 'unknown',
        value: null,
        detail: 'Not enough logged training yet to measure this. Two weeks of sessions is the '
          + 'floor — below that a rate per week is noise.',
      };
    }
    const v = measured.weeklySets;
    if (v < 4) {
      return {
        status: 'short',
        value: round(v),
        detail: `${round(v)} sets a week is below the minimum effective dose of 4. That is the `
          + 'point where the evidence first sees a detectable change at all.'
          + MEASURED_SETS_CAVEAT,
      };
    }
    if (v < req.sets[0]) {
      return {
        status: 'short',
        value: round(v),
        detail: `${round(v)} sets a week against the ${req.sets[0]}–${req.sets[1]} this goal `
          + 'asks for. Enough to make progress, less than this target wants.'
          + MEASURED_SETS_CAVEAT,
      };
    }
    return {
      status: 'ok',
      value: round(v),
      // ⚠️ The caveat matters MOST on this branch, and that is not obvious. The
      // two above already tell somebody they are short, so an inflated count can
      // only soften bad news. Here it is the opposite: the app is saying the
      // work is being done, and if warm-ups are padding the number that is an
      // unearned positive verdict — the exact fault the headline fix on this
      // screen corrected from the other side on 2026-08-22 (Rule 6).
      detail: `${round(v)} sets a week, against the ${req.sets[0]}–${req.sets[1]} this goal `
        + 'asks for.' + MEASURED_SETS_CAVEAT,
    };
  })();

  const frequency = (() => {
    if (!measured || !Number.isFinite(measured.sessionsPerWeek)) {
      return {
        status: 'unknown',
        value: null,
        detail: 'Not enough logged training yet to measure this.',
      };
    }
    const f = measured.sessionsPerWeek;
    const want = req.sessions[0];
    const n = round(f);
    return {
      status: f + 0.05 < want ? 'short' : 'ok',
      value: n,
      detail: `About ${n} ${n === 1 ? 'session' : 'sessions'} a week `
        + `${n === 1 ? 'trains' : 'train'} ${muscle}, against the ${want} this goal asks for. `
        + 'Frequency drives strength, though not growth.',
    };
  })();

  /**
   * ⚠️ TWO SCREENS READ THESE ROWS AND THEY ARE ASKING DIFFERENT QUESTIONS.
   *
   * *Why progress stalls* asks "what could be wrong", so `reason` is a CAUSE
   * and "Not enough sets on this muscle" is the right name for it whether or
   * not it is happening to you.
   *
   * *What you are actually doing* asks "how am I going", and there the same
   * fixed string is simply false for anybody meeting the target: a lifter doing
   * 10.9 sets against a 7–10 target read **"Not enough sets on this muscle"** in
   * bold, with the number beside it in green and the grey sub-line underneath
   * correctly saying they were over. Headlines get read; grey sub-lines do not.
   *
   * So a row carries a `heading` that follows its status, and the screens pick.
   * ⚠️ **This is Rule 6 from the other side.** The rule forbids unearned
   * opinions, and the app is careful never to congratulate anyone for a number
   * that does not deserve it — but an unearned NEGATIVE verdict is the same
   * fault, and this was the one screen in the app holding measured evidence
   * that somebody was doing the work.
   */
  const heading = (status, { ok, short, unknown }) =>
    (status === 'ok' ? ok : status === 'unknown' ? unknown : short);

  return [
    {
      key: 'volume',
      reason: 'Not enough sets on this muscle',
      heading: heading(volume.status, {
        ok: 'Enough sets on this muscle',
        short: 'Not enough sets on this muscle',
        unknown: 'Sets on this muscle',
      }),
      visible: true,
      source: 'research.md §6.2',
      ...volume,
    },
    {
      key: 'frequency',
      reason: 'Not training it often enough',
      heading: heading(frequency.status, {
        ok: 'Training it often enough',
        short: 'Not training it often enough',
        unknown: 'How often you train it',
      }),
      visible: true,
      source: 'research.md §6.3',
      ...frequency,
    },
    {
      key: 'effort',
      reason: 'Sets not taken close enough to failure',
      visible: false,
      status: 'invisible',
      value: null,
      source: 'research.md §6.7',
      detail: 'The app has no reps-in-reserve field and is not getting one (D9), so it cannot see '
        + 'how hard your sets are. This is the variable that most decides whether a set grows '
        + 'anything.',
    },
    {
      key: 'protein',
      reason: 'Protein under the threshold',
      visible: false,
      status: 'invisible',
      value: null,
      source: 'research.md §6.9',
      detail: 'The app does not track food and will not — it recommends a number and never '
        + 'asks what you ate. So a shortfall here is invisible to it.',
    },
    {
      key: 'sleep',
      reason: 'Too little sleep',
      visible: false,
      status: 'invisible',
      value: null,
      source: 'research.md §6.10',
      detail: 'Invisible to the app. One night without sleep cuts muscle protein synthesis about '
        + '18 %, and nobody has measured what habitual hours do over a training block.',
    },
    {
      key: 'life',
      reason: 'Stress, illness, and everything else',
      visible: false,
      status: 'invisible',
      value: null,
      source: null,
      detail: 'Invisible to the app, and real. Training does not happen in a vacuum, and a bad '
        + 'twelve weeks outside the gym shows up inside it.',
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Matching a system to the goal
 * ------------------------------------------------------------------ */

/**
 * docs/goals-plan.md §5 — the cheapest and best-supported part.
 *
 * ⚠️ SORTED BY WHAT THE GOAL MUSCLE ACTUALLY GETS, not by the overall rating.
 * A programme rated 85 % for strength across every muscle is the wrong answer to
 * "I want a stronger bench" if it gives the chest three sets a week. The
 * headline number the Explore screen shows is an average over eleven muscles;
 * this ranks on the one muscle the goal is about, and falls back to the overall
 * strength score only to break ties.
 *
 * @param {Array} candidates [{ id, name, sets, rating, ... }] — `sets` is the
 *                           goal muscle's fractional weekly sets in that system
 * @param {number[]} want    the requirement band, [min, max]
 */
export function rankSystems(candidates, want) {
  const [lo, hi] = want;
  const score = (c) => {
    const s = Number(c.sets) || 0;
    // Inside the band is the best answer there is. Above it is second — more
    // work than the goal needs is a cost, not a failure. Below it is last, and
    // the further below the worse, because that is the case where the programme
    // cannot deliver the goal however well it is followed.
    if (s >= lo && s <= hi) return 1000 - Math.abs(s - (lo + hi) / 2);
    if (s > hi) return 500 - (s - hi);
    return s * 10;
  };
  return [...candidates]
    .map((c) => ({ ...c, fit: fitOf(Number(c.sets) || 0, lo, hi), _score: score(c) }))
    .sort((a, b) => (b._score - a._score)
      || ((b.rating ? b.rating.raw.strength : 0) - (a.rating ? a.rating.raw.strength : 0)))
    .map(({ _score, ...rest }) => rest);
}

function fitOf(sets, lo, hi) {
  if (sets >= lo && sets <= hi) return 'fits';
  if (sets > hi) return 'more';
  if (sets >= 4) return 'light';
  return 'under';
}

export const FIT_LABEL = {
  fits: 'Fits the goal',
  more: 'More than the goal asks',
  light: 'Under what the goal asks',
  under: 'Below the minimum effective dose',
};
