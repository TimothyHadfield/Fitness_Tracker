// Progression — what to put on the bar next time.
//
// docs/goals-plan.md §8 · docs/research.md §12. Tim, 2026-08-18:
//   "The amount that the weight or reps increase should have nothing to do with
//    your goal. However, it should still have a system… Most of the time
//    increasing the weight (even by a little) is too much, so a good system
//    could be increase the reps by 1 for 2-3 weeks, and then increase the weight
//    while going back down in reps."
//
// That is double progression, and it is the American College of Sports Medicine
// position stand ("Progression Models in Resistance Training for Healthy
// Adults", 2009) almost word for word.
//
// ── ⚠️ THIS IS THE ONE PART OF THIS APP THAT COULD HURT SOMEBODY ─────────────
//
// Everything else here can only be wrong on a screen. This suggests a weight a
// person will then try to lift, so the two rules below are not style points.
//
// 1. ⚠️ NOTHING IN THIS FILE MAY READ A GOAL, A DEADLINE, OR HOW FAR BEHIND
//    ANYBODY IS. goals-plan §3.1: load that follows a calendar pushes hardest at
//    exactly the wrong moment. Somebody who has missed two weeks is "behind
//    schedule", and handing them a HEAVIER weight for it is backwards — the
//    correct response to a lay-off is to come back lighter. The same logic
//    pushes harder on the week somebody slept badly, is ill, or is stressed.
//
//    ⚠️ THAT IS WHY THIS IS ITS OWN MODULE AND NOT PART OF goals.js. It imports
//    nothing from Goals, is handed no goal and no date, and has no clock. The
//    refusal is structural rather than a promise in a comment, and there is a
//    test that feeds a goal, a deadline and a deficit in through the options bag
//    and requires the output to be byte-identical.
//
//    Every progression model that works — double progression, autoregulation,
//    RIR- and velocity-based — reads WHAT YOU JUST DID. None of them read a
//    calendar. This one reads your last two sessions of this exercise, and
//    nothing else.
//
// 2. ⚠️ A CLOCK MAY SUPPRESS A SUGGESTION. IT MAY NEVER CREATE OR INCREASE ONE.
//
//    Rule 1 says nothing may get heavier because a deadline is close. The same
//    harm arrives from the other side: handing somebody a heavier weight than
//    they have touched in a month is exactly what §3.1 exists to prevent,
//    whether the trigger is a deadline or a gap. §3.1's objection was never
//    "clocks are forbidden" — it was that TIME MUST NOT MAKE THE APP ASK FOR
//    MORE.
//
//    So this module accepts exactly one temporal fact, `daysSinceLast`, and it
//    is a plain day count measured by the caller — there is still no clock in
//    here, nothing to compare a deadline against, and no date arithmetic. All
//    it can do is take a suggestion away: after a long gap the app falls back
//    to last time's numbers, which is what it did before this feature existed,
//    and says why in one sentence.
//
//    ⚠️ THE ASYMMETRY IS THE RULE, not a condition attached to one branch. It
//    invents no deload percentage and prescribes no reduction — a reduction
//    would be a number nobody has measured (research.md §12.4: the position
//    stand is silent on coming back from a missed block). It refuses, and a
//    refusal needs no evidence to be safe. A swept test asserts the property
//    directly: across every lift, weight and history, adding a gap of any
//    length can never produce a suggestion heavier than the same history with
//    no gap at all.
//
// 3. ⚠️ PROPOSE, NEVER IMPOSE. This pre-fills, exactly as the runner already
//    pre-fills last time's numbers, and it says out loud that it is a
//    suggestion. Tim's own note in vision.md §1.2: "Silent adjustment is the
//    kind of thing that destroys trust if it is wrong once."
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
//
//   1. Hold the load and add reps up the range.
//   2. When the top of the range is hit on TWO CONSECUTIVE sessions, add the
//      smallest load increment that lands inside 2–10 %, and drop the reps back
//      to the bottom of the range.
//   3. Size the step by the lift — the position stand says "on the basis of
//      muscle group size and involvement".
//   4. When no honest increment exists, SAY SO, and suggest another rep, an
//      extra set, or microplates. research.md §12.2: a 5 lb jump only enters the
//      2–10 % band at 50 lb and above, so for most isolation work, most dumbbell
//      work and every beginner's compounds a rep is the only increment fine
//      enough. Silently proposing a 17 % jump would be worse than saying it.
//
// Pure: no DOM, no store, no clock. Same shape as e1rm.js, set-types.js,
// volume-map.js and optimal.js.

import { volumeContributions } from './volume-map.js';
import { totalResistance } from './e1rm.js';

/* ------------------------------------------------------------------ *
 * The published numbers
 * ------------------------------------------------------------------ */

/**
 * ACSM 2009, stated directly in the position stand: "a 2–10 % increase in load
 * should be applied when the individual can perform the current workload for
 * one to two repetitions over the desired number on two consecutive training
 * sessions", the size chosen "on the basis of muscle group size and
 * involvement".
 *
 * ⚠️ research.md §12.4: this band is a practitioner consensus, not a
 * dose–response curve. 🟡 on the exact numbers, 🟢 on the shape.
 */
export const LOAD_BAND = { min: 0.02, max: 0.10 };

/**
 * "Muscle group size and involvement" made computable, and it is the ONLY place
 * the app's own judgement enters the load rule.
 *
 * A lift gets the top of the band when it is BOTH a large muscle group AND
 * trains more than one muscle. Everything else — every isolation movement, and
 * every small-group lift — is capped at half the band.
 *
 * ⚠️ IT ERRS SMALL ON PURPOSE. Every case this rule gets wrong, it gets wrong by
 * proposing a lighter jump than it could have, which is the only direction it is
 * safe to be wrong in. An exercise the app has never seen falls through to the
 * cautious half too.
 */
export const ISOLATION_MAX = 0.05;

const LARGE_GROUPS = new Set(['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Full Body']);

export function isCompound(exercise) {
  if (!exercise || !exercise.muscle) return false;
  if (!LARGE_GROUPS.has(exercise.muscle)) return false;
  return volumeContributions(exercise).length > 1;
}

export function loadCeiling(exercise) {
  return isCompound(exercise) ? LOAD_BAND.max : ISOLATION_MAX;
}

/**
 * The rep ranges double progression walks up.
 *
 * ⚠️ THE LADDER IS OURS AND IS LABELLED AS OURS. The app has no field for a
 * prescribed rep range — a workout stores a set COUNT, not a range — so the
 * range has to be inferred from what somebody is actually doing. The ladder is
 * the ordinary set of training ranges; 8–12 is the one the position stand names
 * for novices, and 3–12 is inside the 1–12 RM it gives for everyone else.
 *
 * The first band whose top is at least your rep count wins, so a rep count
 * sitting on a boundary is at the TOP of the lower band rather than the bottom
 * of the higher one. That matters: it is what lets somebody running 3×8 earn a
 * load increase at 8 instead of being walked up to 12 first.
 *
 * Under 3 reps falls into 3–5 rather than getting a band of its own. A band
 * ending at 1 or 2 would mean a load increase dropping somebody to a single,
 * which is a far larger change than this rule should ever propose.
 */
export const REP_BANDS = [[3, 5], [6, 8], [8, 12], [12, 15], [15, 20]];

/**
 * How long a gap has to be before the app stops proposing a step up.
 *
 * ⚠️ THIS NUMBER IS OURS AND NOTHING SUPPORTS IT, because nothing exists to
 * support it: research.md §12.4 records that the ACSM position stand "says
 * nothing about what to do after a missed block", and no other source here
 * offers a threshold either. It is a round judgement, labelled as one, in the
 * same way the rep ladder above is.
 *
 * Three weeks rather than two, for a reason that is at least stateable: a
 * fortnight between two sessions of one lift is inside plenty of people's
 * normal cadence — a low-frequency programme, a busy fortnight, an eight-day
 * cycle read across a holiday — and a threshold that fires on ordinary training
 * would withhold the feature from the people using it correctly.
 *
 * ⚠️ And the cost of being wrong is the argument for not agonising over it. Too
 * high and somebody gets one session at last time's numbers, which is exactly
 * what this app did before progression existed. Too low and the same. The
 * threshold cannot make anything heavier at any value, which is what makes a
 * guessed number acceptable here and would not make a guessed deload percentage
 * acceptable.
 */
export const LAYOFF_DAYS = 21;

export function repRangeFor(reps) {
  const r = Number(reps);
  if (!Number.isFinite(r)) return REP_BANDS[2];
  const band = REP_BANDS.find((b) => r <= b[1]);
  return band || REP_BANDS[REP_BANDS.length - 1];
}

/**
 * The range this lift is being TRAINED in — read across recent sessions, not
 * from the last one alone.
 *
 * ⚠️ ONE SESSION CANNOT ANSWER THIS, AND READING IT FROM ONE SESSION MEANT THE
 * APP DESTROYED THE RANGE IT HAD JUST TOLD SOMEBODY TO USE. The bands share
 * their boundaries — 8 is the top of 6–8 and the bottom of 8–12, and so are 12
 * and 15 — and `repRangeFor` resolves a boundary DOWNWARDS on purpose (see
 * above), so that somebody running 3×8 earns a load increase at 8 rather than
 * being walked to 12 first. That is right for reading a session cold and wrong
 * the moment the app's own advice produced the session:
 *
 *   "+5 lb and back to 8 reps"   ← said with range 8–12
 *   next session, 8 reps read cold  → range 6–8, already at the top
 *   two sessions later            → +5 lb again, and back to 6 reps
 *
 * A lifter who did exactly as they were told was migrated out of 8–12 into 6–8
 * and left there, taking a load increase every two sessions instead of walking
 * the range — faster than double progression prescribes, from a module whose
 * whole stated bias is to err small. Measured over twelve obedient sessions:
 * 185 × 10 became 200 × 6, and the range never came back.
 *
 * ⚠️ THE MAXIMUM, AND THAT ASYMMETRY IS THE POINT. History may only ever widen
 * the range upward, never narrow it — `REP_BANDS` tops rise, so a larger input
 * can never return a lower band. A higher range makes the top HARDER to reach
 * and drops the reps LESS far when it is, so this can only ever withhold a load
 * increase, never bring one forward. Same shape as the lay-off rule: the safe
 * direction is the only direction it can push. A swept test asserts it directly.
 *
 * The cost is stated rather than hidden: somebody genuinely moving from 12s to
 * triples is held in their old range until the 12s fall out of the window, which
 * is a few sessions of the app declining to add weight. That is the cautious
 * failure, and it is the one to have.
 */
export function trainingRange(history) {
  const best = (history || [])
    .map(sessionSummary)
    .filter(Boolean)
    .reduce((m, r) => Math.max(m, r.bestAtTop), 0);
  return repRangeFor(best);
}

/* ------------------------------------------------------------------ *
 * Reading a session
 * ------------------------------------------------------------------ */

const EPS = 0.01;   // pounds. Two weights typed in kg round-trip to within this.
const sameWeight = (a, b) => Math.abs(Number(a) - Number(b)) < EPS;

const trim = (n) => String(Math.round(Number(n) * 100) / 100);
const defaultFmt = (lb) => `${trim(lb)} lbs`;

// The published band, in words, in one place — so no sentence on any screen can
// quote a different pair of numbers from the one the code applies.
const bandText = () =>
  `${Math.round(LOAD_BAND.min * 100)}–${Math.round(LOAD_BAND.max * 100)} %`;

/**
 * What one session of one exercise did, reduced to the two numbers the rule
 * needs.
 *
 * ⚠️ BOTH ENDS ARE KEPT, AND THEY DO DIFFERENT JOBS. Reps almost always fall
 * across the sets of a working weight — 6, 6, 4, 3 is an ordinary session, not a
 * failed one — so one number cannot describe it.
 *
 *   bestAtTop  says which rep RANGE this lift is being trained in. It has to be
 *              the best set, because that is what the lifter can do fresh.
 *   repsAtTop  is the MINIMUM, and it is what gates a load increase. Double
 *              progression asks every set to reach the top of the range before
 *              the weight moves, so the weakest set decides.
 *
 * ⚠️ Getting this wrong was visible only in a real browser. Anchoring the range
 * on the minimum too made the app tell somebody who had just pressed 190 × 6
 * that "the weight moves once you have hit 5" — a target they had already beaten
 * in the same session, and one that would then have dropped them to 3 reps.
 *
 * Mini-sets (drops, myo-reps) are not counted: they live inside a set and are
 * deliberately lighter or shorter, so they would drag the working numbers down
 * for doing exactly what they are supposed to do.
 */
export function sessionSummary(sets) {
  // ⚠️ Filtered on REPS, not on weight. A pull-up, a dip and a push-up are all
  // logged with a weight of 0 — the field means ADDED load — so requiring a
  // weight threw away every bodyweight movement in the library and returned
  // "nothing to say" for a session that plainly happened.
  const rows = (sets || []).filter((s) => s && Number(s.reps) > 0);
  if (!rows.length) return null;
  const topWeight = rows.reduce((m, s) => Math.max(m, Number(s.weight) || 0), 0);
  const atTop = topWeight > 0 ? rows.filter((s) => sameWeight(s.weight, topWeight)) : rows;
  return {
    topWeight,
    // No load at all: either the exercise records none, or the lifter is adding
    // none. Either way there is nothing to step up but the reps.
    weightless: topWeight <= 0,
    repsAtTop: atTop.reduce((m, s) => Math.min(m, Number(s.reps)), Infinity),
    bestAtTop: atTop.reduce((m, s) => Math.max(m, Number(s.reps)), 0),
    setsAtTop: atTop.length,
  };
}

/**
 * The recent sessions of one exercise, newest first, as arrays of sets.
 *
 * Same precedence the runner's own pre-fill has always used: this workout's own
 * history first, and only if there is none, the exercise anywhere. Doing a lift
 * inside a different programme is still evidence of what you can lift, but it is
 * weaker evidence about what belongs in THIS session.
 *
 * @param {Array} sessions  store.getSessions() — newest first
 */
function scanSessions(sessions, { exerciseId, workoutId, limit = 4 } = {}) {
  const scan = (filterFn) => {
    const out = [];
    for (const s of sessions || []) {
      if (!filterFn(s)) continue;
      const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
      if (entry && entry.sets && entry.sets.length) out.push({ date: s.date, sets: entry.sets });
      if (out.length >= limit) break;
    }
    return out;
  };
  const own = scan((s) => s.workoutId === workoutId);
  return own.length ? own : scan(() => true);
}

export function historyFor(sessions, opts) {
  return scanSessions(sessions, opts).map((r) => r.sets);
}

/**
 * The day this exercise was last done, as the stored YYYY-MM-DD string.
 *
 * ⚠️ A STRING, and no arithmetic on it. Turning it into a gap needs today, and
 * today is a clock — so the caller does that and hands this module a plain
 * number of days. Keeping the date maths out of here is what makes "there is no
 * clock in this file" checkable rather than a claim.
 */
export function lastSessionDate(sessions, opts) {
  const rows = scanSessions(sessions, { ...opts, limit: 1 });
  return rows.length ? rows[0].date || null : null;
}

/* ------------------------------------------------------------------ *
 * The load step
 * ------------------------------------------------------------------ */

/**
 * The smallest increment you can actually make that still lands inside the band.
 *
 * Increments are whole multiples of the smallest step the lifter has — 5 lb, or
 * 2.5 kg, which is what units.js calls a step because it is the smallest PAIR of
 * plates most gyms own.
 *
 * ⚠️ Returns null when there is no honest answer, and that is a result rather
 * than a failure. research.md §12.2: at 30 lb the smallest jump available is
 * 16.7 %, and there is nothing to be done about that with the plates in the
 * room. Saying so is more use than proposing it.
 *
 * @param {number} weight   the working weight, in pounds
 * @param {number} step     smallest available increment, in pounds
 * @param {number} ceiling  top of the band for this lift
 */
export function smallestHonestIncrement(weight, step, ceiling = LOAD_BAND.max) {
  const w = Number(weight), s = Number(step);
  if (!(w > 0) || !(s > 0)) return null;
  const floor = w * LOAD_BAND.min;
  const cap = w * ceiling;
  for (let k = 1; k * s <= cap + 1e-9; k++) {
    if (k * s >= floor - 1e-9) return k * s;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The suggestion
 * ------------------------------------------------------------------ */

/**
 * What to put on the bar, and why.
 *
 * ⚠️ THE ARGUMENTS ARE THE WHOLE POINT. There is no goal here, no deadline and
 * no deficit — only the last sessions of this exercise, the plates available,
 * and how long ago the last one was. That last one is the single temporal fact
 * this function accepts, and by rule 2 in the header it can only ever take a
 * suggestion AWAY. Anything added to this signature that could make the answer
 * heavier for a reason other than what was lifted reintroduces goals-plan §3.1.
 *
 * @param {Array<Array>} history  recent sets for this exercise, newest first
 * @param {object} exercise       for sizing the step by the lift
 * @param {number} step           smallest available load increment, in pounds
 * @param {number} daysSinceLast  gap since the last session of this exercise,
 *                                measured by the caller. Unknown is fine and
 *                                suppresses nothing.
 * @param {number} bodyWeight     pounds, for the movements where the lifter IS
 *                                most of the load. Unknown is fine.
 * @param {Function} fmt          weight -> display string; the view passes the
 *                                user's unit, tests get pounds
 * @returns {object|null}  null when there is nothing honest to say
 */
export function suggestProgression({
  history, exercise, step = 5, daysSinceLast = null, bodyWeight = null, fmt = defaultFmt,
} = {}) {
  const fields = (exercise && exercise.fields) || [];
  // The rule is stated in reps, with load as the second lever where there is
  // one. An exercise measured in time or distance has no double progression at
  // all, and inventing one for it would be exactly the unearned opinion Rule 6
  // forbids.
  if (!fields.includes('reps')) return null;

  const last = sessionSummary((history || [])[0]);
  if (!last) return null;

  // ⚠️ Across the history, never from `last` alone — see trainingRange(). Read
  // from one session, the app's own "back to 8 reps" was re-read next time as
  // the top of 6–8 and quietly moved the lifter down a band for good.
  const range = trainingRange(history);

  // ⚠️ THE BAND IS A PERCENTAGE OF WHAT YOU ARE ACTUALLY LIFTING, and on a
  // pull-up most of that is you. `totalResistance()` in e1rm.js is the app's one
  // answer to "how much load was that really" — imported rather than copied,
  // because two versions of a body-weight table would drift and this one is
  // sourced line by line.
  //
  // Without it, 5 lb on a 25 lb dip belt reads as a 20 % jump and gets refused,
  // when against ~205 lb of real resistance it is 2.4 % and is exactly the step
  // the position stand describes. Barbell, dumbbell and machine work is
  // untouched: `totalResistance` returns null for everything with no body-weight
  // fraction, so `resistance` is the entered weight and nothing changes.
  const res = totalResistance(exercise, last.topWeight, bodyWeight);

  // ⚠️ An ASSIST machine runs the other way — the number you enter is help, so
  // adding to it makes the set EASIER. A load rule that proposed "+5 lb" there
  // would be proposing a regression while reading like progress. Nothing in the
  // table is flagged `assist` today; this is here so that the day one is, the
  // suggestion degrades to a rep rather than silently inverting.
  const assisted = Boolean(res && res.assist);
  const resistance = res ? res.load : last.topWeight;
  const bodyBase = res ? res.base : 0;

  const weightless = assisted
    || !fields.includes('weight')
    || (last.weightless && !(bodyBase > 0));

  // "at 190 lbs" is right; "at 0 lbs" is not — an unweighted pull-up is done at
  // body weight, and that is what the sentence has to call it.
  const atLoad = last.topWeight > 0 ? `at ${fmt(last.topWeight)}` : 'at body weight';

  // ── 0. A long gap SUPPRESSES, and that is the only thing time may do ──
  //
  // ⚠️ Checked before every branch below, so there is no path on which a gap
  // can reach the load rule at all. What comes back is last time's numbers —
  // the app's behaviour before progression existed — and a sentence saying so.
  // It is a refusal, not a prescription: no deload percentage is invented,
  // because nobody has measured one (research.md §12.4).
  const gap = Number(daysSinceLast);
  if (Number.isFinite(gap) && gap >= LAYOFF_DAYS) {
    return {
      fromWeight: weightless ? null : last.topWeight,
      fromReps: last.repsAtTop,
      range,
      compound: isCompound(exercise),
      kind: 'layoff',
      daysSinceLast: gap,
      weight: weightless ? null : last.topWeight,
      reps: last.repsAtTop,
      headline: 'what you did last time',
      why: `It has been about ${Math.round(gap / 7)} weeks since you last did this one, so this is `
        + 'what you last did rather than a step up. Take it from wherever it feels right today.',
    };
  }

  // ── 0b. Nothing to add but reps ──────────────────────────────────────
  //
  // A push-up records reps and has no weight field at all; a pull-up has one but
  // the app does not know what the lifter weighs, so it cannot say what a
  // percentage would be a percentage OF. Double progression with the load lever
  // removed is just "one more rep", and it is the only progression these
  // movements have — declining to say anything, which is what this did before,
  // left the whole bodyweight half of the library with no rule at all.
  if (weightless) {
    const did = last.bestAtTop === last.repsAtTop
      ? `You did ${last.repsAtTop} last time.`
      : `Last time was ${last.bestAtTop} down to ${last.repsAtTop}.`;
    return {
      fromWeight: null,
      fromReps: last.repsAtTop,
      range,
      compound: isCompound(exercise),
      kind: 'repsOnly',
      weight: null,
      reps: last.repsAtTop + 1,
      headline: `one more rep — ${last.repsAtTop + 1}`,
      why: `${did} There is no weight to add on this one, so a rep is the only step there is.`,
    };
  }

  // ⚠️ The range comes from the BEST sets and the gate from the weakest — see
  // sessionSummary(). Using one number for both is the defect the browser found.
  const rangeText = `${range[0]}–${range[1]}`;
  const atTop = last.repsAtTop >= range[1];

  const base = {
    fromWeight: last.topWeight,
    fromReps: last.repsAtTop,
    range,
    compound: isCompound(exercise),
    // What the percentages below are percentages OF. Equal to the entered weight
    // for everything but the seven body-weight movements, and the reason the
    // band means what it says on those.
    resistance,
  };

  // ── 1. Below the top of the range: hold the load, take a rep ──────────
  if (!atTop) {
    const did = last.bestAtTop === last.repsAtTop
      ? `You did ${last.repsAtTop} ${atLoad} last time.`
      : `Last time was ${last.bestAtTop} down to ${last.repsAtTop} ${atLoad}.`;
    return {
      ...base,
      kind: 'reps',
      weight: last.topWeight,
      reps: last.repsAtTop + 1,
      headline: `one more rep ${atLoad}`,
      why: `${did} Reps first — the weight moves once every set reaches ${range[1]}, twice in a row.`,
    };
  }

  // ── 2. At the top once: the 2-for-2 rule says do it again ─────────────
  const prev = sessionSummary((history || [])[1]);
  const twice = prev && sameWeight(prev.topWeight, last.topWeight) && prev.repsAtTop >= range[1];

  if (!twice) {
    return {
      ...base,
      kind: 'repeat',
      weight: last.topWeight,
      reps: last.repsAtTop,
      headline: last.topWeight > 0
        ? `the same again — ${fmt(last.topWeight)} × ${last.repsAtTop}`
        : `the same again — ${last.repsAtTop} at body weight`,
      why: `Every set reached the top of ${rangeText} last time. Do it again and the weight goes up `
        + '— the rule asks for two sessions, because one is noise.',
    };
  }

  // ── 3. At the top twice: take the smallest honest step ────────────────
  const ceiling = loadCeiling(exercise);
  // ⚠️ Against the RESISTANCE, not against the number typed into the box. On a
  // barbell they are the same; on a dip belt they are not, and the band is a
  // statement about load lifted.
  const inc = smallestHonestIncrement(resistance, step, ceiling);

  if (inc === null) {
    // ⚠️ §8.2 rule 4. The plates in the room cannot make an honest step, and
    // saying that is the useful answer.
    //
    // ⚠️ TWO DIFFERENT REFUSALS, AND THEY MUST NOT SHARE A SENTENCE. At 30 lb
    // the smallest jump is 16.7 % and is simply past the published band. At
    // 60 lb on an isolation lift it is 8.3 % — INSIDE the published band, and
    // refused only because this app sizes the step by the lift. Telling
    // somebody "2–10 % is the recommended step" while refusing an 8.3 % jump
    // would be a sentence contradicting itself on screen.
    const pct = Math.round((step / resistance) * 1000) / 10;
    const overBand = pct > LOAD_BAND.max * 100;
    return {
      ...base,
      kind: 'noIncrement',
      weight: last.topWeight,
      reps: last.repsAtTop + 1,
      smallestPct: pct,
      headline: `another rep — ${last.repsAtTop + 1} ${atLoad}`,
      // "a 8.3 % jump" reads as a typo. 8, 11 and 18 are the percentages in
      // range that are spoken with a vowel.
      why: `The smallest weight you can add here is ${/^(8|11|18)/.test(String(pct)) ? 'an' : 'a'} `
        + `${pct} % jump, `
        + (overBand
          ? `past the recommended ${bandText()}. `
          : `and that step is sized by the lift — a single-muscle exercise wants the bottom of the `
            + `${bandText()} band. `)
        + 'A rep, an extra set, or microplates are the ways up.',
    };
  }

  const pct = Math.round((inc / resistance) * 1000) / 10;
  return {
    ...base,
    kind: 'load',
    weight: last.topWeight + inc,
    reps: range[0],
    addedWeight: inc,
    pct,
    headline: `+${fmt(inc)}${bodyBase > 0 ? ' added' : ''} and back to ${range[0]} reps`,
    // ⚠️ Two sentences, not one with a clause bolted on. The body-weight case
    // has more to say — what the percentage is a percentage OF, and how you
    // physically add five pounds to a pull-up (D8, at the moment of use) — and
    // saying it inside the barbell sentence ran to six lines on a 360px phone
    // and pushed the sets off the screen. Naming the real load outright also
    // lets the reader check the number rather than take 2.8 % on trust.
    why: bodyBase > 0
      ? `Top of ${rangeText} twice in a row, and ${fmt(inc)} is ${pct} % of the ${fmt(resistance)} `
        + `you really lift — inside the recommended ${bandText()}. Reps back to ${range[0]}`
        + (last.topWeight <= 0 ? '; add it with a belt or a dumbbell between your feet.' : '.')
      : `Every set hit the top of ${rangeText} twice in a row, so the weight takes the smallest `
        + `step available — ${pct} %, inside the recommended ${bandText()} — and reps drop back to `
        + `${range[0]}.`,
  };
}

/**
 * Lay a suggestion over the sets the runner already pre-filled from history.
 *
 * ⚠️ ONLY THE SETS AT THE WORKING WEIGHT ARE TOUCHED. A lighter set is a warm-up
 * or a back-off, and overwriting the whole list with one number would flatten a
 * ramp somebody built on purpose.
 *
 * ⚠️ And while the load is being HELD, reps are never lowered: a set that
 * already beat the suggestion keeps its own number. The only place reps come
 * down is a load increase, which is the rule.
 */
export function applySuggestion(sets, suggestion) {
  const rows = (sets || []).map((s) => ({ ...s }));
  if (!suggestion) return rows;
  // ⚠️ A lay-off suggestion changes NOTHING. It exists to say why the numbers
  // are last time's; writing anything at all would make it a prescription,
  // which is precisely what the header rule forbids. Explicit rather than
  // relying on the arithmetic below happening to be a no-op.
  if (suggestion.kind === 'layoff') return rows;
  for (const s of rows) {
    // No load anywhere — every set is the working set, and only reps move.
    if (suggestion.fromWeight === null) {
      s.reps = Math.max(Number(s.reps) || 0, suggestion.reps);
      continue;
    }
    if (!sameWeight(s.weight, suggestion.fromWeight)) continue;
    s.weight = suggestion.weight;
    s.reps = suggestion.kind === 'load'
      ? suggestion.reps
      : Math.max(Number(s.reps) || 0, suggestion.reps);
  }
  return rows;
}

/**
 * The paragraph the Goals screen shows, kept here rather than in the view for
 * the same reason next-workout.js builds its own caption: a sentence written
 * beside a rule drifts away from it, and both halves keep looking fine alone.
 *
 * ⚠️ The second line is the one that matters. A goals screen that also talked
 * about weights would read as though the goal were driving them.
 */
export const PROGRESSION_EXPLAINER = [
  'In a workout the app pre-fills last time\'s numbers and suggests the next step: hold the weight '
  + 'and add a rep until you reach the top of the range twice in a row, then add the smallest load '
  + 'that lands inside the 2–10 % the ACSM position stand recommends, and drop the reps back down.',
  'Your goal never touches that number. Nothing gets heavier because a deadline is close — a '
  + 'suggestion that read the calendar would push hardest on somebody coming back from two weeks '
  + 'off, which is exactly backwards. It reads your last two sessions of that exercise, and nothing '
  + 'about your goal at all.',
  // ⚠️ Said outright rather than left as a footnote, because it is the one place
  // a clock touches a weight and the reader deserves to know which direction it
  // can push. See rule 2 in this file's header.
  'Time can only ever take a step away. If it has been weeks since you last did a lift, the app '
  + 'offers what you last did instead of a step up — and it will not tell you to go lighter either, '
  + 'because nobody has measured by how much.',
  'And it only ever proposes. Every number is pre-filled and editable, and there is a one-tap way '
  + 'back to last time\'s numbers on the exercise itself.',
];
