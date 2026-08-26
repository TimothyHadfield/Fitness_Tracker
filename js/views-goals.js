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
// Also not here: anything that changes a weight. docs/goals-plan.md §3.1 —
// progression follows your last session, never the calendar, because a deadline
// that raises loads would push hardest on somebody who has just missed two
// weeks. That is the one thing in this app that could hurt a person.

import { store, muscleStrength, trainingForMuscle, todayISO } from './store.js';
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

async function context() {
  const [{ profile, muscles, ready }, goal] = await Promise.all([
    muscleStrength(), store.activeGoal(),
  ]);
  return { profile, muscles, ready, goal };
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
  const { profile, muscles, ready, goal } = await context();

  if (!ready) {
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
  body.append(measuredHost, verdictBlock(p), progressionBlock(), moreRows());

  trainingForMuscle(goal.muscle)
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
 */
function verdictBlock(p) {
  return el('div', { class: 'goal-verdict' },
    el('div', { class: 'section-label', text: 'On track?' }),
    el('p', { class: 'goal-verdict-body', text:
      'The app will not tell you yet, and that is deliberate. A day-to-day strength estimate '
      + 'swings several percent on sleep, food and what time you trained, so a verdict built on it '
      + 'would tell you that you were behind because you had a bad Tuesday.' }),
    el('p', { class: 'goal-verdict-body', text:
      // ⚠️ "everything ABOVE", not "below" — this block moved down the screen on
      // 2026-08-21 and the sentence pointed at what used to follow it. A caveat
      // that survives being moved but stops describing anything is worse than
      // one that was never written.
      'When it does arrive it will only say you are behind if reaching the goal has genuinely '
      + 'become unlikely — never on one flat week. Until then, every number on this screen is '
      + 'measured rather than judged.' }),
    p.expired
      ? el('div', { class: 'field-help', text:
          'This goal has run its twelve weeks. Ending it keeps the record.' })
      : null,
  );
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
    el('div', { class: 'field-help', text: measured
      ? `Measured from the last ${Math.round(measured.spanDays / 7)} weeks of logged sessions — `
        + `${measured.sessions} of them.`
      : 'Measured from your logged sessions once there are two weeks of them.' }),
  );
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
      go('#/blank');
      go('#/goals');
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
  const { profile, muscles, ready } = await context();

  if (!ready) {
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
  const { profile, muscles, ready, goal } = await context();

  if (!ready || !muscles.has(muscle)) {
    return screenShell({
      title: muscle, back: () => go('#/goal/new'),
      scroll: ready ? needsHistory() : needsProfile(profile),
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
    go('#/blank');
    go('#/goals');
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
  const measured = await trainingForMuscle(goal.muscle).catch(() => null);
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

      // ⚠️ The point of the section, said outright. It is also the answer to
      // goals-plan §3.2 — the invisible levers are named here rather than
      // quietly excluded from a verdict that would then blame your training.
      el('div', { class: 'field-help', text:
        'That split is the honest version of this screen. Four of the six things most likely to '
        + 'stall you are invisible to any training log, so nothing here will ever tell you that '
        + 'your training is the problem when it might be your sleep.' }),
      el('div', { class: 'field-help', text:
        'The app has no reps-in-reserve field and does not track food, and neither is an '
        + 'oversight — both are decisions, and both are why two of these rows say "invisible" '
        + 'rather than showing a number.' }),
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
