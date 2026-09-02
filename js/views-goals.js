// Goals — the screens.
//
// docs/vision.md §1.6 · docs/goals-plan.md, Phases 1 and 2. Tim, 2026-08-19: a
// Goals section beside Home, Workouts, Calendar, Data and Social.
//
// ── WHAT IS BUILT AND WHAT IS DELIBERATELY MISSING ───────────────────────────
//
// Built: pick a goal (a strength LEVEL for one muscle, over twelve weeks), see
// exactly what it asks of you, see what you are actually doing against that, see
// why progress stalls with the measurable and unmeasurable reasons kept apart,
// and see which programmes deliver the volume the goal needs.
//
// NOT built, on purpose: the on-track / ahead / behind verdict. It is gated on
// the strength estimator (docs/strength-estimate-plan.md) and cannot be faked
// from raw session numbers, which move several percent day to day. The screen
// says so in as many words rather than leaving a gap somebody has to guess at.
//
// ⚠️ BUT SINCE 2026-09-06 IT SAYS WHAT HAS MOVED, which is not the same thing.
// docs/direction.md §3.1: "something is always better than nothing", with the
// half Tim kept — "have a way to be upfront about it". Two places on this screen
// used to refuse where they could have measured, and both now report:
//
//   · verdictBlock() prints the CHANGE since the goal was set — a subtraction of
//     two estimates the app already holds — with the noise floor in the same
//     breath and no verdict word anywhere near it (movedSince()).
//   · Under two weeks of history the "what you are actually doing" rows used to
//     say "not enough logged training yet". They now show TOTALS with the window
//     named, via trainingOrShortWindow() below and the `enough: false` branch in
//     stallReasons(). A total is a measurement; a rate over nine days is not.
//
// Neither adds an opinion and neither touches a weight. Rule 6 is the line: the
// measurement is reported, the conclusion is left to the reader.
//
// Also not here: anything that changes a weight. docs/goals-plan.md §3.1 —
// progression follows your last session, never the calendar, because a deadline
// that raises loads would push hardest on somebody who has just missed two
// weeks. That is the one thing in this app that could hurt a person.

import {
  store, muscleStrength, trainingForMuscle, weeklyVolumeByMuscle, todayISO,
} from './store.js';
import { comparisonLabel } from './strength-standards.js';
import {
  candidateGoals, buildGoal, goalProgress, requirementsFor, stallReasons,
  rankSystems, FIT_LABEL,
} from './goals.js';
import { PROGRESSION_EXPLAINER } from './progression.js';
// ⚠️ Static, not a dynamic import, for the reason views-workouts.js states at
// its own top: a caveat that can arrive late or not at all is the one kind of
// caveat that must not exist. The rating these qualify is loaded dynamically
// further down; the sentences qualifying it are not.
import { INDIRECT_NOTE_SETS } from './volume-map.js';
import { STRENGTH_CAVEAT } from './optimal.js';
import {
  el, icon, screenShell, emptyState, chevron, confirmSheet, toast, fmtDateLong, trimNum,
  refreshRoute, helpDot,
} from './ui.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

// The two states that stop this screen before it starts, both of which have a
// route out. An empty state with no way forward is the thing this app does not
// do — the muscle map's own empty states are the pattern.
function needsProfile(profile) {
  return emptyState(
    'Tell us about you first',
    `A goal is a strength level, and a level needs your ${profile.missing.join(' and ')} — every `
    + 'standard is a ratio to body weight, and they differ between men and women.',
    el('a', { class: 'btn primary', href: '#/profile', text: 'Open profile' }),
  );
}

function needsHistory() {
  return emptyState(
    'Nothing to aim at yet',
    'A goal starts from where a muscle is now, so there has to be something recorded for it. '
    + 'Log a workout or record a benchmark and the goals appear.',
    el('a', { class: 'btn primary', href: '#/benchmark', text: 'Record a benchmark' }),
  );
}

/**
 * 🚨 `ready` IS NO LONGER THE QUESTION THIS SCREEN ASKS, AND THE DIFFERENCE IS
 * THE WHOLE REASON GOALS KEPT A GATE THE MUSCLE MAP GAVE UP (2026-09-06).
 *
 * `muscleStrength()` used to refuse outright on an incomplete profile. It now
 * ranks anyway — assuming male where sex is missing, and comparing against
 * lifters of EVERY SIZE where there is no weigh-in rather than inventing one —
 * and says so on the map. That is right there: the map is a reading, it is
 * relabelled the moment the real details arrive, and nothing is stored.
 *
 * ⚠️ IT IS NOT RIGHT HERE, because a goal FREEZES. `targetWeight` is written
 * once, in pounds, when the goal is set, and never recomputed (D20, and the
 * Goal shape in §4 says so) — precisely so that gaining four pounds cannot make
 * a goal quietly harder. Set a goal against an assumed sex or against "lifters
 * of every size", and that assumption is frozen into the target too, months
 * after the profile has been filled in properly and every other screen has
 * stopped mentioning it. The reading would be corrected; the goal would not.
 *
 * So this screen asks the raw question — is the profile actually there — and
 * `profile.missing` is untouched by the assumption overlay for exactly this
 * kind of caller. `ready` is left in the return because the friend screens
 * still read it and it is not this file's to redefine.
 */
async function context() {
  const [{ profile, muscles, ready }, goal] = await Promise.all([
    muscleStrength(), store.activeGoal(),
  ]);
  return { profile, muscles, ready, hasProfile: !profile.missing.length, goal };
}

/**
 * ⚠️ THE WINDOW IS NAMED ONCE AND PASSED, never left to two defaults.
 *
 * Both store functions below default to 28 days, and this screen prints the
 * window in words ("the last four weeks"). Three places agreeing by coincidence
 * is how a sentence ends up describing a window nobody is measuring — so the
 * number is stated here, handed to both calls, and the sentence is built from
 * it. Change it in one place and the copy follows.
 */
const WINDOW_DAYS = 28;

/**
 * What has been logged for one muscle, INCLUDING when there is too little of it.
 *
 * ⚠️ `trainingForMuscle()` returns null below a two-week span, on purpose: it
 * feeds sentences about sets PER WEEK, and a rate measured over four days would
 * make those sentences false. That is right, and it is also why this screen used
 * to go blank-with-a-refusal for anybody a week into the app.
 *
 * `weeklyVolumeByMuscle()` is the same arithmetic over the same window from the
 * same volumeWindow() — its own header says it "returns a window that is too
 * short rather than null" for exactly this caller — so the fallback cannot
 * disagree with the primary about a number. It carries `enough: false`, and
 * stallReasons() reads that flag to report TOTALS instead of rates.
 *
 * ⚠️ Not merged into one call, because when there IS enough history the two
 * screens must go on reading the function that guarantees the two-week floor.
 * This is a fallback, not a replacement.
 */
async function trainingOrShortWindow(muscle) {
  const full = await trainingForMuscle(muscle, WINDOW_DAYS).catch(() => null);
  if (full) return full;

  const all = await weeklyVolumeByMuscle(WINDOW_DAYS).catch(() => null);
  if (!all) return null;

  // Absent from the list means the window held no work for this muscle — which
  // is a finding ("nothing you logged reached your chest"), not a missing value,
  // so it reads as zero rather than as null. Same argument weeklyVolumeByMuscle()
  // makes for listing every muscle including the ones on zero.
  const row = all.muscles.find((r) => r.muscle === muscle);
  return {
    muscle,
    weeklySets: row ? row.weeklySets : 0,
    sessionsPerWeek: row ? row.sessionsPerWeek : 0,
    totalSets: row ? row.totalSets : 0,
    daysTrained: row ? row.daysTrained : 0,
    sessions: all.sessions,
    spanDays: all.spanDays,
    windowDays: all.windowDays,
    // Copied from the window rather than hard-coded false: if a later change
    // ever makes this path reachable with a full window, stallReasons() takes
    // its ordinary branches on the same numbers instead of silently downgrading
    // a real rate to a total.
    enough: all.enough,
  };
}

/** Protein in the unit the user reads. The published figures are both here. */
function proteinRate(perLb) {
  return units.units() === 'kg'
    ? `${Math.round(perLb * units.LB_PER_KG * 100) / 100} g per kg`
    : `${perLb} g per lb`;
}

/* ================================================================== *
 * The Goals tab
 * ================================================================== */

export async function GoalsView() {
  const { profile, muscles, hasProfile, goal } = await context();

  if (!hasProfile) {
    return screenShell({ title: 'Goals', profile: true, back: () => go('#/settings'),
                         scroll: needsProfile(profile) });
  }

  if (!goal) return noGoalScreen(muscles);
  return activeGoalScreen(goal, profile, muscles);
}

/* ---- no goal set ---- */

async function noGoalScreen(muscles) {
  const past = (await store.getGoals()).filter((g) => g.status !== 'active');

  return screenShell({
    title: 'Goals',
    profile: true,
    // ⚠️ A BACK BUTTON, since 2026-08-25. Goals lost its nav tab to Calendar,
    // so it is now reached FROM Settings and needs a way home — a screen with
    // neither a tab nor a back button is a trap.
    back: () => go('#/settings'),
    scroll: [
      muscles.size ? null : needsHistory(),

      el('div', { class: 'goal-intro' },
        el('h2', { class: 'goal-intro-title', text: 'Pick something to aim at' }),
        el('p', { class: 'goal-intro-body', text:
          'A goal is one muscle moving up a strength level, over twelve weeks. The app then tells '
          + 'you what that costs — how many hard sets a week, how often, how much protein — and '
          + 'shows you what you are actually doing against it.' }),
        // Said before anything is chosen, not after. The whole design rests on
        // it: a level makes no prediction, so nothing here is a promise.
        el('p', { class: 'goal-intro-body', text:
          'It is a target, not a promise. Almost everybody who trains gets stronger, but how much '
          + 'anyone gains in three months varies enormously, so the app will never tell you what '
          + 'you are going to lift.' }),
      ),

      muscles.size
        ? el('button', { class: 'btn primary block', onClick: () => go('#/goal/new') },
            icon('flag'), 'Choose a goal')
        : null,

      past.length
        ? [
            el('h2', { class: 'section-head', text: 'Before' }),
            el('div', { class: 'list' }, past.map(pastRow)),
          ]
        : null,
    ],
  });
}

function pastRow(g) {
  return el('div', { class: 'row' },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: `${g.targetLevelName} ${g.liftName || g.muscle}` }),
      el('div', { class: 'row-sub wrap', text:
        `${g.startDate} to ${g.endDate} · ${g.endedReason === 'replaced' ? 'replaced by a new goal'
          : g.endedReason === 'reached' ? 'reached' : 'ended'}` }),
    ),
  );
}

/* ---- a goal is running ---- */

async function activeGoalScreen(goal, profile, muscles) {
  const m = muscles.get(goal.muscle);
  const current = m ? m.estimate : null;
  const p = goalProgress(goal, current, todayISO());
  const req = requirementsFor(goal.ambition, { bodyWeight: profile.bodyWeight });

  const body = el('div', { class: 'goal-screen' });

  const screen = screenShell({
    title: 'Goals',
    profile: true,
    back: () => go('#/settings'),
    scroll: body,
    bottom: el('button', {
      class: 'btn block', text: 'Change or end this goal',
      onClick: () => endSheet(goal, p),
    }),
  });

  // ⚠️ THE VERDICT EXPLANATION MOVED DOWN ON 2026-08-21, and only down — it is
  // not hidden, shortened or folded into a disclosure. On a 375×667 phone it sat
  // third and its two paragraphs filled the whole screen, so a goal opened on an
  // explanation of something the screen does NOT say, and nothing it does say —
  // no requirement, no cost, no measurement — was reachable without scrolling.
  //
  // It now sits with the screen's other honest limit, the one about weights,
  // which is where progressionBlock's own note already argues these belong.
  body.append(
    goalHero(goal, p),
    progressBlock(goal, p, m),
    requirementsBlock(goal, req),
  );

  // The measured half loads after the screen is on the page. It reads every
  // session, and a goal screen that waits on that before painting anything is a
  // blank screen for as long as the read takes.
  const measuredHost = el('div', { class: 'goal-measured' });
  // Progression sits AFTER what the goal asks and what you are doing, not
  // between them — "what this asks of you" and "what you are actually doing" are
  // a pair and a digression about weights in the middle of them reads as part of
  // the requirement. It also puts the sentence that matters most — the goal does
  // not set your weights — next to the screen's other honest limits.
  body.append(measuredHost, verdictBlock(goal, p, m), progressionBlock(), moreRows());

  trainingOrShortWindow(goal.muscle)
    .then((measured) => measuredHost.append(measuredBlock(goal, req, measured)))
    .catch((err) => console.error('Could not measure training for the goal', err));

  return screen;
}

function goalHero(goal, p) {
  const left = p.weeksLeft;
  const when = p.expired
    ? 'The twelve weeks are up'
    : left === 0 ? 'Last few days'
      : `${left} week${left === 1 ? '' : 's'} left`;

  return el('div', { class: 'goal-hero' },
    el('div', { class: 'goal-hero-level lv-text-' + goal.targetLevel, text: goal.targetLevelName }),
    el('div', { class: 'goal-hero-lift', text: goal.liftName || goal.muscle }),
    el('div', { class: 'goal-hero-meta' },
      el('span', { class: 'mono', text: units.withUnit(Math.ceil(goal.targetWeight)) }),
      el('span', { class: 'goal-hero-dot', text: '·' }),
      el('span', { text: when }),
    ),
    el('div', { class: 'field-help', text: `By ${fmtDateLong(goal.endDate)}.` }),
  );
}

function progressBlock(goal, p, m) {
  if (p.currentWeight === null) {
    return el('div', { class: 'card' },
      el('div', { class: 'field-help', text:
        `Nothing has been recorded for ${goal.muscle} since this goal was set, so there is no `
        + 'current estimate to compare against. Log a set of anything that trains it.' }),
    );
  }

  const gained = p.gained;
  const needed = p.targetWeight - p.startWeight;

  return el('div', { class: 'card goal-progress' },
    el('div', { class: 'goal-nums' },
      stat('Now', units.withUnit(Math.round(p.currentWeight))),
      stat('Started at', units.withUnit(Math.round(p.startWeight))),
      stat('Target', units.withUnit(Math.ceil(p.targetWeight))),
    ),

    el('div', { class: 'to-next-bar' },
      el('div', {
        class: 'to-next-fill',
        style: `width:${((p.fraction || 0) * 100).toFixed(1)}%`,
      })),

    el('div', { class: 'to-next-label', text: p.reached
      ? 'Target reached.'
      : `${units.withUnit(Math.ceil(p.remaining))} to go of the `
        + `${units.withUnit(Math.ceil(needed))} this goal asks for.` }),

    // Going backwards is a real outcome and the screen has to be able to say it
    // without dressing it up. Rule 6 keeps it factual: no judgement, no advice.
    gained < 0
      ? el('div', { class: 'field-help', text:
          `The current estimate is ${units.withUnit(Math.round(-gained))} below where this goal `
          + 'started. Estimates move on how recently and how heavily you have trained, so a '
          + 'single light week can do this.' })
      : null,

    // Where the number came from, every time (Rule 5). An estimate must never
    // look like a measurement, and this one is converted from whatever exercise
    // happened to rate the muscle best.
    m
      ? el('div', { class: 'field-help', text:
          `Estimated from ${m.best.exerciseName}, ${units.fmtWeight(m.best.weight)}`
          + `${m.best.loadType === 'per_side' ? '/side' : ''}×${m.best.reps}`
          + ` — ${m.band.name.toLowerCase()} confidence, ${m.contributorCount} `
          + `session${m.contributorCount === 1 ? '' : 's'} counted.` })
      : null,
  );
}

function stat(label, value) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-value mono', text: value }),
    el('div', { class: 'stat-label', text: label }),
  );
}

/**
 * The size a change has to beat before this app can tell it from noise.
 *
 * ⚠️ IT IS MODELLED, NOT MEASURED ON THE READER, and the copy beside it says so
 * — Rule 5. docs/strength-estimate-plan.md §6.1 and §14 hold the only number
 * this project has actually derived for how wide a strength estimate is: the
 * simulator put the band at ±12.2 % on average, and ±21 % off a single high-rep
 * set. Twelve is that rounded DOWN, and down is the conservative direction here
 * — it makes the app quicker to allow that a move might be real, never quicker
 * to announce one.
 *
 * ⚠️ AND IT IS NOT AN ERROR BAR ON THE NUMBER THIS SCREEN SHOWS. That band was
 * measured on js/strength-estimate.js, which is not wired into the rating yet
 * (that plan's Phase 2). The estimate a goal is scored against comes from
 * js/muscle-evidence.js and carries no band at all. Printing ±12 % as if it
 * belonged to this estimate would be an inference dressed as a measurement, so
 * the sentence offers it as a yardstick and names where it came from instead.
 */
const ESTIMATE_NOISE_PCT = 12;

/**
 * ⚠️ THE MISSING VERDICT IS STATED, NOT HIDDEN.
 *
 * "On track / ahead / behind" is the thing a goals screen is expected to say,
 * and this one cannot say it yet. Leaving a silent gap would read as the feature
 * being broken; guessing would be worse. A working-set estimate swings several
 * percent on sleep, food and time of day, so a verdict off raw numbers would
 * call a bad Tuesday a failure.
 *
 * And when it does arrive it will be asymmetric on purpose (goals-plan §9.2):
 * telling somebody they are behind when they are not costs a user who was doing
 * fine, so "behind" waits until it is genuinely unlikely the goal can be
 * reached. Saying that now sets the expectation correctly.
 *
 * ── WHAT IT SAYS INSTEAD, SINCE 2026-09-06 ───────────────────────────────────
 *
 * ⚠️ REFUSING A VERDICT IS NOT A REASON TO REFUSE THE MEASUREMENT. Until now
 * this block explained what the app would not say and then said nothing at all,
 * which is the shape docs/direction.md §3.1 reversed: "have a way to be upfront
 * about it but something is always better than nothing." The change since the
 * goal was set is a subtraction of two numbers the app already has, and it is a
 * measurement — so it is printed, with the yardstick in the same breath and the
 * conclusion left to the reader. That is the Rule 6 line exactly: report the
 * measurement, withhold the opinion. No verdict word, no colour, no
 * encouragement, and nothing here reaches a weight.
 *
 * ⚠️ THE MOVEMENT IS IN POUNDS, AND THE PERCENTILE IS DELIBERATELY LEFT OUT.
 * The goal also froze `startPercentile` and `startLevel`, and subtracting
 * today's percentile from them looks like the obvious version of this. It is
 * wrong: a percentile is computed against a comparison group and a body weight,
 * both of which move, and this screen already tells the reader that changing
 * the comparison will not move a running goal (D20). The difference would then
 * report a change in the STANDARDS as a change in the lifter. Two estimated
 * 1RMs for the same muscle subtract cleanly; two percentiles do not.
 */
function verdictBlock(goal, p, m) {
  return el('div', { class: 'goal-verdict' },
    /* 🚨 THREE SENTENCES OF REASONING BECAME SIX WORDS AND A "?" (2026-09-07).
     *
     * ⚠️ THE REFUSAL ITSELF IS STILL ON THE SCREEN, because it is WHAT rather
     * than WHY: a reader who does not know the app is declining to judge will
     * read the numbers below as a verdict. What went behind the ? is why it
     * declines and what would change that. */
    el('div', { class: 'help-line' },
      el('div', { class: 'section-label', text: 'On track?' }),
      helpDot(el('div', {},
        el('p', { text: 'A day-to-day strength estimate swings several percent on sleep, food and '
          + 'what time you trained. A verdict built on that would tell you that you were behind '
          + 'because you had a bad Tuesday.' }),
        // ⚠️ "when it arrives" — this block moved down the screen on 2026-08-21
        // and the sentence used to point at what followed it. A caveat that
        // survives being moved but stops describing anything is worse than one
        // that was never written.
        el('p', { text: 'When a verdict does arrive it will only say you are behind if the goal has '
          + 'genuinely become unlikely — never on one flat week.' }),
      ), { label: 'Why there is no verdict', title: 'Why not' })),
    el('p', { class: 'goal-verdict-body', text: 'Not yet — every number here is measured, not judged.' }),

    // What it CAN say: the measured change, and the size a change has to beat.
    ...movedSince(goal, p, m),
    p.expired
      ? el('div', { class: 'field-help', text:
          'This goal has run its twelve weeks. Ending it keeps the record.' })
      : null,
  );
}

/**
 * What has actually changed since the goal was set, and how big a change has to
 * be before this app can see it.
 *
 * ⚠️ EVERY NUMBER HERE IS ARITHMETIC ON FIELDS THAT ALREADY EXIST — `startWeight`
 * and `startDate` frozen on the goal, and the current rating. Nothing is
 * recomputed, nothing new is modelled, and `targetWeight` is not touched: it is
 * frozen and stays frozen.
 *
 * ⚠️ AND NOTHING HERE READS THE DEADLINE. `endDate`, `daysLeft` and `weeksLeft`
 * are all sitting on `p` and every one of them is deliberately unused — this
 * block reports a change over elapsed time and nothing else. docs/goals-plan.md
 * §3.1: the moment a screen starts phrasing a measurement in terms of how much
 * time is left, the next session's obvious improvement is to phrase a
 * REQUIREMENT that way, and that is the one thing in this app that could hurt
 * somebody. The deadline is stated once, in the hero, as a date.
 *
 * Returns an array so the caller can spread it — an empty section would leave a
 * stray element, and a block that renders nothing at all is what this change
 * exists to remove.
 */
function movedSince(goal, p, m) {
  const lift = goal.liftName || `${goal.muscle} key lift`;

  // ⚠️ SAID SPECIFICALLY, not left blank. "There is no current estimate" and
  // "you have not moved" are different facts and must not look alike (Rule 5) —
  // a blank here would read as the second. progressBlock() says what to do about
  // it; this says what it costs, which is this measurement.
  if (p.currentWeight === null || !(p.startWeight > 0)) {
    return [el('p', { class: 'goal-verdict-body', text:
      `There is nothing to measure yet: ${goal.muscle} has no current rating, so there is no `
      + 'estimate to subtract the starting one from. Log a set of anything that trains it and the '
      + 'change since this goal was set appears here.' })];
  }

  const delta = p.gained;
  const pct = Math.abs(delta) / p.startWeight * 100;
  const pctText = `${trimNum(Math.round(pct * 10) / 10)} %`;
  const from = units.withUnit(Math.round(p.startWeight));
  const to = units.withUnit(Math.round(p.currentWeight));

  /* ⚠️ FLAT IS DECIDED BY WHAT GETS PRINTED, NOT BY `delta === 0`. The two ends
   * are estimates carrying decimals, so a goal set the same day reads as a
   * change of 0.2 lb — and rounding that for display printed "0 lbs higher",
   * which is a sentence saying two contradictory things at once. Rounding
   * first and asking whether anything survived is the fix, and it also gives
   * the honest wording: unchanged TO THE NEAREST POUND, which is all the
   * screen ever claimed. */
  const step = Math.round(Math.abs(delta));
  const unitWord = units.units() === 'kg' ? 'kilo' : 'pound';
  const moved = step === 0
    ? `The ${lift} estimate is where it started, ${from} — unchanged to the nearest ${unitWord}.`
    : `The ${lift} estimate has gone from ${from} then to ${to} now — `
      + `${units.withUnit(step)} ${delta > 0 ? 'higher' : 'lower'}, or ${pctText}.`;

  // ⚠️ ELAPSED, NEVER REMAINING. See the note above — `p.daysLeft` is right
  // there and is deliberately not read. Days under a fortnight, weeks after
  // that, and nothing at all on the day the goal was set: "0 days ago" is the
  // kind of phrase that makes a screen look like it is guessing.
  const days = p.daysElapsed;
  const ago = days === null || days === 0 ? ''
    : days < 14
      ? `, ${days} day${days === 1 ? '' : 's'} ago`
      : `, ${p.weeksElapsed} week${p.weeksElapsed === 1 ? '' : 's'} ago`;

  // ⚠️ The comparison against the yardstick is arithmetic, not a judgement:
  // "smaller than 12 %" is a fact about resolution, and the sentence stops
  // there rather than turning it into good news or bad news (Rule 6).
  const scale = step === 0
    ? 'A flat reading and a small real change look identical at that resolution, so this is not '
      + 'evidence either way.'
    : pct < ESTIMATE_NOISE_PCT
      ? `A move of ${pctText} is inside that, so it is not yet something the app can tell apart `
        + 'from an ordinary swing. Read it as the measurement it is, not as a result either way.'
      : `A move of ${pctText} is larger than that. It is still built from your best recorded sets `
        + 'rather than a tested max, so it is the estimate that has moved, not a max you have hit.';

  return [
    el('p', { class: 'goal-verdict-body', text:
      `What has moved: this goal was set on ${fmtDateLong(goal.startDate)}${ago}. ${moved} `
      + "Both ends of that are this app's own estimate from your recorded sets, and neither is a "
      + 'tested max.' }),

    el('p', { class: 'goal-verdict-body', text:
      `For scale: this project's own simulation of a strength estimate puts the uncertainty on one `
      + `at about ±${ESTIMATE_NOISE_PCT} %, and the figure above carries no band of its own. `
      + scale }),

    // Rule 5 — the yardstick names what it came from, and says it is not a
    // measurement of this reader. Same pattern as progressionBlock's citation.
    el('div', { class: 'req-source', text:
      `the ±${ESTIMATE_NOISE_PCT} % is modelled, not measured on you · `
      + 'strength-estimate-plan.md §6.1' }),

    /* ⚠️ THE DATE IS THE POINT OF THIS LINE, and it is why it is not a repeat of
     * the source line progressBlock() already prints further up. That one says
     * which set the estimate came from; this one says WHEN, and a change-over-
     * time claim is worthless without it. "Up 11 lb since 4 August" measures
     * nothing recent if the newest chest set it rests on is from July — the
     * reader can only see that if the date is beside the sentence making the
     * claim, not four blocks away. Rule 5: the number names where it came from,
     * and here "where" includes when. */
    m
      ? el('div', { class: 'field-help', text:
          `The "now" end of that was last moved by ${m.best.exerciseName}, `
          + `${units.fmtWeight(m.best.weight)}${m.best.loadType === 'per_side' ? '/side' : ''}`
          + `×${m.best.reps} on ${fmtDateLong(m.best.date)} — so that is how recent this `
          + 'comparison actually is.' })
      : null,
  ];
}

/**
 * ⚠️ THE ONE THING A GOALS SCREEN MUST SAY ABOUT WEIGHTS IS THAT THE GOAL DOES
 * NOT SET THEM.
 *
 * docs/goals-plan.md §3.1. The feature Tim originally described had the app
 * raising weights to keep you on pace, and it is the only thing in this app that
 * could cause physical harm: it would hand HEAVIER weights to somebody who has
 * missed two weeks and is "behind", when the right answer is to come back
 * lighter. He agreed and the rule was decoupled.
 *
 * Leaving that silent would be worse than saying it. Somebody who set a goal and
 * then sees the runner pre-fill a heavier weight has every reason to assume the
 * two are connected — so the screen states what the suggestion actually reads,
 * which is the last two sessions of that exercise and nothing else. The
 * sentences live in js/progression.js beside the rule they describe.
 */
function progressionBlock() {
  return el('div', { class: 'goal-verdict' },
    el('div', { class: 'section-label', text: 'And the weights themselves' }),
    ...PROGRESSION_EXPLAINER.map((t) => el('p', { class: 'goal-verdict-body', text: t })),
    el('div', { class: 'req-source', text: 'ACSM position stand 2009 · research.md §12' }),
  );
}

function requirementsBlock(goal, req) {
  const a = req.ambition;
  // Recomputed rather than trusted: a goal written before gainPct was stored
  // would otherwise render "+NaN%", and the two numbers it is derived from are
  // both frozen on the goal, so this cannot disagree with what was set.
  const gainPct = Number.isFinite(goal.gainPct)
    ? goal.gainPct
    : (goal.startWeight > 0 ? (goal.targetWeight / goal.startWeight - 1) * 100 : 0);

  return el('div', { class: 'card' },
    el('div', { class: 'goal-ambition' },
      el('span', { class: 'goal-ambition-name', text: a.name }),
      el('span', { class: 'goal-ambition-gain mono', text: `+${Math.round(gainPct)}%` }),
    ),
    el('div', { class: 'field-help', text: a.blurb }),

    el('h2', { class: 'section-head', text: 'What this asks of you' }),
    el('div', { class: 'list' }, req.rows.map((r) => reqRow(r, req))),

    // Two conditions of the estimate, said once and plainly. goals-plan §3.2:
    // protein and sleep are levers the app cannot see, so they are stated as
    // assumptions rather than folded into any calculation.
    el('div', { class: 'field-help', text:
      'All of this assumes you are eating and sleeping enough. The app cannot see either, so '
      + 'neither will ever be counted for or against you.' }),
    el('div', { class: 'field-help', text:
      'Which of these grow with a bigger goal is not a matter of taste — sets, sessions, time and '
      + 'consistency each have a measured dose response. Protein is a bar to clear rather than a '
      + 'dial, and nothing measures how many hours of sleep a goal needs.' }),
  );
}

function reqRow(r, req) {
  const value = r.key === 'protein' && req.proteinGrams ? `${req.proteinGrams} g` : r.value;
  // Only the view knows whether this reader is in pounds or kilos, so the rate
  // is prepended here rather than baked into the model's sentence.
  const detail = r.perLb
    ? `${proteinRate(r.perLb)} of body weight. ${r.detail}`
    : r.detail;

  return el('div', { class: 'row req-row' },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title' },
        r.label,
        r.scales
          ? el('span', { class: 'tag', text: 'grows with the goal' })
          : r.threshold ? el('span', { class: 'tag', text: 'a bar, not a dial' }) : null,
      ),
      // A requirement whose answer is a phrase rather than a quantity states it
      // on its own line under the label. Putting it in the tabular column
      // instead is what crushed the sentence beside it — the column is sized
      // for "7–10", not for "Within 1–2 reps of failure".
      r.phrase ? el('div', { class: 'req-phrase', text: value }) : null,
      el('div', { class: 'row-sub wrap', text: detail }),
      r.source ? el('div', { class: 'req-source', text: r.source }) : null,
    ),
    r.phrase ? null : el('div', { class: 'req-value mono', text: value }),
  );
}

function measuredBlock(goal, req, measured) {
  const rows = stallReasons({ requirements: req, measured, muscle: goal.muscle })
    .filter((r) => r.visible);

  return el('div', { class: 'card' },
    el('h2', { class: 'section-head', text: 'What you are actually doing' }),
    // ⚠️ `heading`, not `reason` — this section says what you ARE doing, so a
    // row that is being met must not be titled with the thing that goes wrong.
    // *Why progress stalls* keeps `reason`, because there the row names a cause.
    ...rows.map((r) => el('div', { class: 'row stall-row is-' + r.status },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: r.heading || r.reason }),
        el('div', { class: 'row-sub wrap', text: r.detail }),
      ),
      el('div', { class: 'req-value mono', text: r.value === null ? '—' : String(r.value) }),
    )),
    // ⚠️ THE WINDOW IS PART OF THE NUMBER, so it is printed every time and it
    // says which of the three states produced the rows above — a full window, a
    // window too short to divide into weeks, or no sessions at all. The middle
    // one used to be folded into the last, which is how a lifter eight days in
    // was told the app had nothing rather than being shown what they had done.
    el('div', { class: 'field-help', text: measuredFooter(measured) }),
  );
}

function measuredFooter(measured) {
  if (!measured) {
    return `No sessions logged in the last ${WINDOW_DAYS / 7} weeks, so there is nothing here to `
      + 'measure from yet.';
  }
  const days = measured.spanDays;
  if (measured.enough === false) {
    return `Counted over the ${days} day${days === 1 ? '' : 's'} since your first session in the `
      + `last ${WINDOW_DAYS / 7} weeks — ${measured.sessions} `
      + `session${measured.sessions === 1 ? '' : 's'}. Under two weeks, so these are totals of `
      + 'what you have done, not rates per week; the goal is stated per week, so the two cannot be '
      + 'compared until there is a fortnight to divide by.';
  }
  return `Measured from the last ${Math.round(days / 7)} weeks of logged sessions — `
    + `${measured.sessions} of them.`;
}

function moreRows() {
  return el('div', { class: 'list' },
    el('button', { class: 'row', onClick: () => go('#/goal/stalls') },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: 'Why progress stalls' }),
        el('div', { class: 'row-sub wrap', text:
          'The six reasons — and which two the app can actually see.' }),
      ),
      chevron(),
    ),
    el('button', { class: 'row', onClick: () => go('#/goal/systems') },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: 'Programmes that fit this goal' }),
        el('div', { class: 'row-sub wrap', text:
          'Sorted by what they actually give this muscle, not by their headline rating.' }),
      ),
      chevron(),
    ),
  );
}

function endSheet(goal, p) {
  confirmSheet({
    title: 'End this goal?',
    message: p.reached
      ? 'You reached it. Ending it keeps the record and lets you set the next one.'
      : 'It is kept in your history either way, and you can set a new one straight after. '
        + 'Nothing about your training or your records changes.',
    confirmLabel: 'End it',
    danger: !p.reached,
    onConfirm: async () => {
      await store.endGoal(goal.id, p.reached ? 'reached' : 'ended');
      toast('Goal ended.');
      refreshRoute('#/goals');
    },
  });
}

/* ================================================================== *
 * The sub-screens — #/goal/...
 * ================================================================== */

export async function GoalRouteView(param) {
  const [head, ...rest] = String(param || '').split('/');
  if (head === 'stalls') return GoalStallsView();
  if (head === 'systems') return GoalSystemsView();
  if (head === 'new' && rest.length) return GoalLevelView(decodeURIComponent(rest.join('/')));
  return GoalMuscleView();
}

/* ---- step one: which lift ---- */

async function GoalMuscleView() {
  const { profile, muscles, hasProfile } = await context();

  if (!hasProfile) {
    return screenShell({ title: 'Choose a goal', back: () => go('#/goals'), scroll: needsProfile(profile) });
  }
  if (!muscles.size) {
    return screenShell({ title: 'Choose a goal', back: () => go('#/goals'), scroll: needsHistory() });
  }

  // Weakest first. Not an opinion about what they SHOULD train — it is the
  // ordering that puts the biggest available step at the top, and the muscle
  // map already names the same one as "furthest behind". Every other muscle is
  // one scroll away and nothing is hidden.
  const rated = [...muscles.values()]
    .filter((m) => m.level || m.percentile != null)
    .sort((a, b) => a.percentile - b.percentile);

  const atTop = rated.filter((m) => !m.next);

  return screenShell({
    title: 'Choose a goal',
    sub: 'Which lift',
    back: () => go('#/goals'),
    scroll: [
      el('div', { class: 'field-help', text:
        'Pick the muscle you want to move. The next screen shows the levels above where it is now '
        + 'and what each would cost you.' }),

      el('div', { class: 'list' }, rated.filter((m) => m.next).map((m) =>
        el('button', { class: 'row', onClick: () => go('#/goal/new/' + encodeURIComponent(m.muscle)) },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: m.muscle }),
            el('div', { class: 'row-sub wrap', text:
              `${m.lift.name} · ${units.withUnit(Math.round(m.estimate))} estimated` }),
          ),
          el('span', { class: 'muscle-level lv-text-' + (m.level ? m.level.key : 'below'),
            text: m.level ? m.level.name : 'Below Beginner' }),
          chevron(),
        ))),

      atTop.length
        ? el('div', { class: 'field-help', text:
            `${atTop.map((m) => m.muscle).join(', ')} ${atTop.length === 1 ? 'is' : 'are'} already `
            + 'at the top level, so there is no next one to aim at.' })
        : null,

      el('div', { class: 'field-help', text:
        `${comparisonLabel(profile).main.replace(/^vs\. /, 'Levels are measured against ')} — `
        + `${comparisonLabel(profile).sub}. A goal freezes the weight behind the level when you `
        + 'set it, so changing that comparison later will not move a goal you are already running.' }),
    ],
  });
}

/* ---- step two: which level ---- */

async function GoalLevelView(muscle) {
  const { profile, muscles, hasProfile, goal } = await context();

  if (!hasProfile || !muscles.has(muscle)) {
    return screenShell({
      title: muscle, back: () => go('#/goal/new'),
      scroll: hasProfile ? needsHistory() : needsProfile(profile),
    });
  }

  const m = muscles.get(muscle);
  const options = candidateGoals(muscle, m.estimate, m.percentile, profile);

  return screenShell({
    title: muscle,
    sub: `Now ${m.level ? m.level.name : 'below Beginner'}`,
    back: () => go('#/goal/new'),
    scroll: [
      el('div', { class: 'field-help', text:
        `${m.lift.name} is the standard ${muscle} is measured against. Every exercise that trains `
        + `it counts toward the estimate — right now that is ${units.withUnit(Math.round(m.estimate))}.` }),

      el('div', { class: 'list' }, options.map((o) => goalOption(o, m, profile, goal))),

      el('div', { class: 'field-help', text:
        'The percentage beside each is how much you would have to add to your estimated maximum. '
        + 'That is what decides how much the goal asks of you — the bands are ours, but everything '
        + 'each one then asks for comes from the research.' }),

      // Said here as well as on the tab, because this is the screen where
      // somebody commits to a number and it is the moment the claim matters.
      el('div', { class: 'field-help', text:
        'None of these is a prediction. Individual gains over twelve weeks vary enormously, so the '
        + 'app is telling you what would count as hitting the target, not what you will lift.' }),
    ],
  });
}

function goalOption(o, m, profile, existing) {
  return el('button', { class: 'row goal-option', onClick: () => confirmGoal(o, m, profile, existing) },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title' },
        el('span', { class: 'lv-text-' + o.level.key, text: o.level.name }),
      ),
      el('div', { class: 'row-sub wrap', text:
        `${units.withUnit(Math.ceil(o.targetWeight))} ${m.lift.name} · `
        + `${o.ambition.name} — ${o.ambition.blurb.charAt(0).toLowerCase()}`
        + o.ambition.blurb.slice(1) }),
    ),
    el('div', { class: 'goal-option-gain mono', text: `+${Math.round(o.gainPct)}%` }),
    chevron(),
  );
}

function confirmGoal(o, m, profile, existing) {
  const label = comparisonLabel(profile);
  const start = todayISO();

  const set = async () => {
    const goal = buildGoal({
      muscle: o.muscle,
      level: o.level,
      targetWeight: o.targetWeight,
      startWeight: m.estimate,
      startPercentile: m.percentile,
      startLevelKey: m.level ? m.level.key : null,
      startDate: start,
      liftName: m.lift.name,
      comparison: `${label.main.replace(/^vs\. /, '')} — ${label.sub}`,
    });
    await store.setGoal(goal);
    toast('Goal set.');
    refreshRoute('#/goals');
  };

  if (existing) {
    confirmSheet({
      title: 'Replace your goal?',
      message: `You are already aiming at ${existing.targetLevelName} `
        + `${existing.liftName || existing.muscle}. Setting this one ends that, and it stays in `
        + 'your history. One goal at a time — otherwise "how many sets do I need" has two answers.',
      confirmLabel: 'Replace it',
      danger: false,
      onConfirm: set,
    });
    return;
  }
  set();
}

/* ---- why progress stalls ---- */

async function GoalStallsView() {
  const { profile, goal } = await context();
  if (!goal) return screenShell({ title: 'Why progress stalls', back: () => go('#/goals'), scroll: noGoal() });

  const req = requirementsFor(goal.ambition, { bodyWeight: profile.bodyWeight });
  // The same fallback the Goals screen uses, so the two never disagree about
  // what has been logged — this screen and that one read the same rows.
  const measured = await trainingOrShortWindow(goal.muscle).catch(() => null);
  const rows = stallReasons({ requirements: req, measured, muscle: goal.muscle });

  const seen = rows.filter((r) => r.visible);
  const unseen = rows.filter((r) => !r.visible);

  return screenShell({
    title: 'Why progress stalls',
    sub: goal.liftName || goal.muscle,
    back: () => go('#/goals'),
    scroll: [
      el('p', { class: 'goal-intro-body', text:
        'Almost everybody who trains gets stronger. When somebody does not, there are usually '
        + 'practical reasons — and the useful thing is knowing which of them this app can see and '
        + 'which it cannot.' }),

      el('h2', { class: 'section-head', text: 'What the app can measure' }),
      el('div', { class: 'list' }, seen.map(stallRow)),

      el('h2', { class: 'section-head', text: 'What it cannot see' }),
      el('div', { class: 'list' }, unseen.map(stallRow)),

      /* ⚠️ The point of the section, said outright — and it is the answer to
       * goals-plan §3.2, so the SPLIT stays on screen. What went behind the ?
       * is why two rows can never fill in. */
      el('div', { class: 'help-line' },
        el('span', { class: 'field-help', text:
          'Most of what stalls you is invisible to any training log — so this screen will never '
          + 'blame your training.' }),
        helpDot('The app has no reps-in-reserve field and does not track food. Neither is an '
          + 'oversight: both are deliberate, and both are why two of these rows say "invisible" '
          + 'rather than showing a number.',
        { label: 'Why two rows say invisible' })),
    ],
  });
}

function stallRow(r) {
  return el('div', { class: 'row stall-row is-' + r.status },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: r.reason }),
      el('div', { class: 'row-sub wrap', text: r.detail }),
      r.source ? el('div', { class: 'req-source', text: r.source }) : null,
    ),
    el('div', { class: 'req-value mono', text: r.visible
      ? (r.value === null ? '—' : String(r.value))
      : '' }),
  );
}

function noGoal() {
  return emptyState(
    'No goal running',
    'Set one and this fills in with what your training is actually doing against it.',
    el('a', { class: 'btn primary', href: '#/goal/new', text: 'Choose a goal' }),
  );
}

/* ---- programmes that fit ---- */

/**
 * docs/goals-plan.md §5. The rating already scores growth and strength
 * separately, which is most of the work — but the ranking here is on the GOAL
 * MUSCLE's weekly sets, not on the headline score. See rankSystems() for why.
 */
async function GoalSystemsView() {
  const { profile, goal } = await context();
  if (!goal) {
    return screenShell({ title: 'Programmes', back: () => go('#/goals'), scroll: noGoal() });
  }

  const req = requirementsFor(goal.ambition, { bodyWeight: profile.bodyWeight });
  const rows = await candidateSystems(goal.muscle);
  const ranked = rankSystems(rows, req.sets);

  return screenShell({
    title: 'Programmes that fit',
    sub: `${goal.muscle} · ${req.sets[0]}–${req.sets[1]} sets a week`,
    back: () => go('#/goals'),
    scroll: [
      el('div', { class: 'field-help', text:
        `Sorted by how many hard sets each one actually gives ${goal.muscle} in a week, against `
        + `the ${req.sets[0]}–${req.sets[1]} this goal asks for. A programme with a high overall `
        + 'rating is the wrong answer if it barely trains the muscle you care about.' }),

      el('div', { class: 'list' }, ranked.map((r) => systemRow(r, goal))),

      // ⚠️ THE SAME CAVEATS THAT TRAVEL WITH THESE NUMBERS EVERYWHERE ELSE.
      // Every row above prints a strength percentage and a count of weekly sets
      // — the identical figures Explore and the system screen show — and this
      // screen carried neither caveat beside them. The strength one was simply
      // absent; the fractional-sets one was a hand-written paraphrase that had
      // already lost "not a measured fact". Imported now, so a number and the
      // sentence qualifying it cannot appear on one screen and not another.
      el('div', { class: 'field-help', text: INDIRECT_NOTE_SETS }),
      el('div', { class: 'field-help', text: STRENGTH_CAVEAT }),
      el('div', { class: 'field-help', text:
        'Adding a programme copies it into your systems. It never changes a goal, and it never '
        + 'changes any weight you have recorded.' }),
    ],
  });
}

async function candidateSystems(muscle) {
  const [{ PRESET_SYSTEMS }, { rateProgramme, rateUserSystem }, { weeklyVolume },
    exMap, systems, workouts, sessions] = await Promise.all([
    import('./preset-systems.js'), import('./optimal.js'), import('./volume-map.js'),
    store.getExerciseMap(), store.getSystems(), store.getWorkouts(), store.getSessions(),
  ]);

  const byName = new Map([...exMap.values()].map((e) => [e.name, e]));
  const today = todayISO();
  const out = [];

  // The user's own systems first-class alongside the ready-made ones. Somebody
  // who already follows a programme should find out whether it delivers the
  // goal, not be handed a shopping list.
  for (const sys of systems) {
    const own = workouts.filter((w) => w.systemId === sys.id);
    if (!own.length) continue;
    const ids = new Set(own.map((w) => w.id));
    const rating = rateUserSystem(own, exMap, {
      sessionDates: sessions.filter((s) => ids.has(s.workoutId)).map((s) => s.date),
      todayISO: today,
      declaredDaysPerWeek: sys.daysPerWeek,
      cycleDays: sys.cycleDays,
      minutesPerSession: sys.minutes,
    });
    const weeks = rating.daysPerWeek > 0 ? own.length / rating.daysPerWeek : 1;
    out.push({
      id: sys.id,
      name: sys.name,
      mine: true,
      href: '#/system/' + sys.id,
      sets: weeklyVolume(own, exMap, weeks).get(muscle) || 0,
      days: rating.daysPerWeek,
      rating,
    });
  }

  for (const p of PRESET_SYSTEMS) {
    const built = (p.workouts || []).map((w) => ({
      exercises: (w.exercises || []).map((i) => {
        const e = byName.get(i.name);
        return e ? { exerciseId: e.id, sets: Number(i.sets) || 3 } : null;
      }).filter(Boolean),
    }));
    if (!built.length) continue;
    const rating = rateProgramme(built, exMap, {
      daysPerWeek: p.daysPerWeek,
      minutesPerSession: p.minutes,
      cycleDays: p.cycleDays || 0,
    });
    // The same rotation length the rating used, so the two cannot disagree:
    // Bumstead's eight-day cycle is 8/7 of a week however many days he trains.
    const weeks = p.cycleDays > 0 ? p.cycleDays / 7 : built.length / p.daysPerWeek;
    out.push({
      id: p.id,
      name: p.name,
      author: p.author && p.author !== 'Fitness Tracker' ? p.author : null,
      href: '#/explore/' + p.id,
      sets: weeklyVolume(built, exMap, weeks).get(muscle) || 0,
      days: p.daysPerWeek,
      minutes: p.minutes,
      rating,
    });
  }

  return out;
}

function systemRow(r, goal) {
  const sets = Math.round(r.sets * 10) / 10;
  return el('button', { class: 'row', onClick: () => go(r.href) },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title' },
        r.name,
        r.mine ? el('span', { class: 'tag', text: 'Yours' }) : null,
      ),
      el('div', { class: 'row-sub wrap', text:
        `${sets} sets a week on ${goal.muscle} · ${FIT_LABEL[r.fit]}` }),
      el('div', { class: 'row-sub wrap', text:
        (r.author ? `${r.author} · ` : '')
        + `${trimNum(Math.round(r.days * 10) / 10)} days/week`
        + (r.minutes ? ` · ~${r.minutes} min` : '')
        + ` · ${r.rating.strength}% strength · ${r.rating.hypertrophy}% growth` }),
    ),
    chevron(),
  );
}
