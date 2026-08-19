// Muscle Groups — the body map.
//
// Third mode of the Data screen. Colours each muscle by where its key lift sits
// among people who lift, grey where nothing is benchmarked.
//
// The one thing this screen must never do is imply the comparison is against
// everyone. "Stronger than 80 % of people" is false; the caption says
// "of people who lift" everywhere, and the general-population figure is a
// separate, clearly-labelled line.

import { store, muscleStrength } from './store.js';
import {
  LEVELS, MUSCLE_LIFTS, UNRANKABLE, weightForPercentile, keyLiftFor,
  COMPARE_OPTIONS, normalizeCompare, comparisonLabel, comparePreset, matchesPreset,
} from './strength-standards.js';
import { bodySvg, setSelected } from './body-map.js';
import { setChildren, el, emptyState, trimNum, fmtDateShort, icon, openSheet } from './ui.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

let selected = null;

export async function muscleGroupsPane(host, top) {
  const { profile, muscles, blocked, ready } = await muscleStrength();
  // Changing the comparison group changes the percentile, the level, the
  // targets and the colours, so the whole pane is rebuilt rather than repainted.
  const reload = () => muscleGroupsPane(host, top);

  if (!ready) {
    setChildren(top);
    setChildren(host, emptyState(
      'Tell us about you first',
      `Ranking a muscle group needs your ${profile.missing.join(' and ')} — every strength `
      + 'standard is a ratio to body weight, and they differ between men and women.',
      el('a', { class: 'btn primary', href: '#/profile', text: 'Open profile' }),
    ));
    return;
  }

  if (!muscles.size) {
    setChildren(top);
    setChildren(host, emptyState(
      'Nothing to rank yet',
      'Any exercise that trains a muscle rates it — a hammer curl rates biceps just as a barbell '
      + 'curl does. Log a workout or record a benchmark and the map lights up.',
      el('a', { class: 'btn primary', href: '#/benchmark', text: 'Record a benchmark' }),
    ));
    return;
  }

  /* ---- top row: what the comparison is against ---- */

  // The whole row is the control. Tim asked to be able to choose the comparison
  // group; making the existing caption the button means the thing that STATES
  // the comparison is also the thing that CHANGES it, so there is nothing extra
  // on a screen whose rule is that the content comes first.
  const label = comparisonLabel(profile);

  setChildren(top,
    el('div', { class: 'control-row' },
      el('button', {
        class: 'basis basis-btn', 'aria-haspopup': 'dialog',
        onClick: () => openCompareSheet(profile, reload),
      },
        el('span', { class: 'basis-main' },
          label.main,
          icon('down', 15),
        ),
        el('span', { class: 'basis-sub', text: label.sub }),
      ),
      // The old "vs. everyone" toggle is gone: comparing against people who do
      // not lift is now one of the four axes in the sheet, so having it in two
      // places would let them contradict each other.
    ),
  );

  /* ---- the body ---- */

  const levelMap = new Map();
  for (const [muscle, m] of muscles) {
    levelMap.set(muscle, {
      levelKey: m.level ? m.level.key : 'below',
      label: m.level ? m.level.name : 'Below Beginner',
      // How much of the level's colour survives. The rating is the hue; how
      // sure we are is how vivid it is. Grey already means "never trained", so
      // fading toward grey reads as one scale rather than a second code to
      // learn — and it never reaches grey, because "unsure" and "no data" are
      // completely different messages.
      tint: m.tint,
      confidence: m.band ? m.band.name : null,
    });
  }

  // The figure is built ONCE. Rebuilding it on every tap would re-attach the
  // two ink mask images and flash the drawing; only the panel below changes.
  const body = bodySvg(levelMap, selected, (muscle) => {
    selected = selected === muscle ? null : muscle;
    setSelected(body, selected);
    renderPanel();
  });
  const foot = el('div', { class: 'body-foot' });

  function renderPanel() {
    setChildren(foot,
      legend(),
      selected
        ? detail(muscles.get(selected), selected, profile,
                 blocked ? blocked.get(selected) : null)
        : summary(muscles),
    );
  }

  function render() {
    setChildren(host, el('div', { class: 'body-wrap' }, body), foot);
    renderPanel();
  }

  render();
}

/* ------------------------------------------------------------------ *
 * Legend — always on screen, so level is never colour-alone
 * ------------------------------------------------------------------ */

function legend() {
  return el('div', { class: 'lv-key' },
    ...LEVELS.map((l) =>
      el('span', { class: 'lv-key-item' },
        el('i', { class: 'lv-sw lv-' + l.key }),
        el('span', { class: 'lv-name', text: l.name }),
        el('span', { class: 'lv-pct', text: `${l.percentile}%` }),
      )),
    el('span', { class: 'lv-key-item' },
      el('i', { class: 'lv-sw lv-none' }),
      el('span', { class: 'lv-name', text: 'No data' }),
    ),
    // Without this the fade is an unexplained visual, and an unexplained
    // visual reads as a rendering bug rather than as information.
    el('span', { class: 'lv-key-item lv-key-note' },
      el('i', { class: 'lv-sw lv-faded' }),
      el('span', { class: 'lv-name', text: 'Faded = less sure' }),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * "Compared to:" — who the ranking is measured against
 * ------------------------------------------------------------------ */

// FOUR independent axes, and two presets on top of them (Tim, 2026-08-17).
//
// The axes are separate rather than a preset list because they genuinely are
// independent — "women, any body weight, my age" is a real question, and no
// preset list holds every combination without becoming a menu nobody reads. The
// presets exist because the two combinations people actually want are the two
// extremes, and setting four things by hand to reach either of them is a chore.
//
// The rule this must never break: every option changes the STATED comparison in
// the header at the same moment it changes the colours, so the number and the
// population it refers to can never drift apart. That rule got stricter here,
// not looser — ranking against people who do not lift is now genuinely on
// offer, so the caption has to carry the difference every single time.
const COMPARE_AXES = [
  { key: 'pool', title: 'Population',
    help: 'Most adults do not lift at all, so including them raises every level. '
      + 'What an untrained adult can lift has never been properly measured — that option is a rough estimate.' },
  { key: 'sex', title: 'Sex',
    help: 'Men and women are held to different standards, so this changes every level.' },
  { key: 'weight', title: 'Body weight',
    help: 'Standards scale with body weight. Ignoring it compares you against people of every size.' },
  { key: 'age', title: 'Age',
    help: 'Strength peaks around 23–40. Ignoring age drops the correction that keeps an older lifter from reading as permanently weak.' },
];

const PRESETS = [
  { key: 'like-me', name: 'Like me', hint: 'Lifters of my sex, weight and age' },
  { key: 'everyone', name: 'Everyone', hint: 'All adults, any sex, weight or age' },
];

function openCompareSheet(profile, onChange) {
  let current = normalizeCompare(profile.compare);
  const body = el('div', { class: 'compare-sheet' });

  const apply = async (next) => {
    current = normalizeCompare(next);
    await store.saveSettings({ compare: { ...current } });
    draw();
    // Re-rank rather than repaint: the percentile, the level, the targets and
    // the colours all move together.
    onChange();
  };

  function draw() {
    // `profile.compare` is the value this sheet was opened with; the presets and
    // the pressed states must reflect the LIVE choice, so a throwaway profile
    // carrying `current` is what gets asked.
    const live = { ...profile, compare: current };

    setChildren(body,
      // The presets, first, because they are what most people want and the four
      // axes below are the escape hatch rather than the main event.
      el('div', { class: 'compare-axis' },
        el('div', { class: 'compare-opts' },
          ...PRESETS.map((p) =>
            el('button', {
              class: 'btn preset',
              'aria-pressed': String(matchesPreset(current, p.key === 'everyone' ? 'everyone' : 'like-me', profile)),
              onClick: () => apply(comparePreset(p.key === 'everyone' ? 'everyone' : 'like-me', profile)),
            },
              el('span', { class: 'preset-name', text: p.name }),
              el('span', { class: 'preset-hint', text: p.hint }),
            ))),
      ),

      ...COMPARE_AXES.map((axis) =>
        el('div', { class: 'compare-axis' },
          el('div', { class: 'section-label', text: axis.title }),
          el('div', { class: 'compare-opts' },
            ...COMPARE_OPTIONS[axis.key].filter((o) => !o.hidden).map((opt) =>
              el('button', {
                // .chip[aria-pressed="true"] already carries the selected look,
                // so the state lives in the attribute the screen reader reads
                // rather than in a second class that could disagree with it.
                class: 'chip',
                'aria-pressed': String(isChosen(axis.key, opt.key, current, profile)),
                text: opt.name,
                onClick: () => apply({ ...current, [axis.key]: opt.key }),
              }))),
          el('div', { class: 'field-help', text: axis.help }),
        )),

      el('div', { class: 'field-help' },
        'Now comparing you against ',
        el('b', { text: comparisonLabel(live).main.replace(/^vs\. /, '') }),
        ` — ${comparisonLabel(live).sub}.`),
    );
  }
  draw();

  openSheet({ title: 'Compared to', body });
}

// `sex: 'own'` is the stored default and is never shown, so the chip that lights
// up for it is the user's actual sex. Without this, someone who has never opened
// the sheet would see nothing selected under Sex and read it as broken.
function isChosen(axis, key, current, profile) {
  if (axis !== 'sex') return current[axis] === key;
  const resolved = current.sex === 'own'
    ? (profile && profile.gender === 'female' ? 'female' : 'male')
    : current.sex;
  return resolved === key;
}


/* ------------------------------------------------------------------ *
 * Confidence
 * ------------------------------------------------------------------ */

// A bar and a word, never the colour alone. The bar is the same fade the muscle
// itself is painted with, so the two are obviously the same quantity — someone
// should be able to look at a washed-out muscle, tap it, and find the bar short.
function confidenceRow(m) {
  const pct = Math.round(m.confidence * 100);
  // Sessions AND exercises, because they answer different questions and the
  // panel used to imply the first was the second. "40 sessions counted" reads
  // as a well-corroborated number; "40 sessions counted, all of one exercise"
  // is the honest version of the same fact, and it is the one that explains why
  // the confidence bar beside it is not full.
  const sessions = m.contributorCount === 1
    ? '1 session counted'
    : `${m.contributorCount} sessions counted`;
  const sources = m.exerciseCount > 1
    ? `${sessions} across ${m.exerciseCount} exercises`
    : sessions;
  return el('div', { class: 'conf-row' },
    el('div', { class: 'conf-head' },
      el('span', { class: 'conf-label', text: 'Confidence' }),
      el('span', { class: 'conf-band', text: m.band.name }),
      el('span', { class: 'conf-pct mono', text: `${pct}%` }),
    ),
    el('div', { class: 'conf-bar' },
      el('div', {
        class: 'conf-fill lv-' + (m.level ? m.level.key : 'below'),
        style: `width:${Math.max(3, pct)}%`,
      })),
    el('div', { class: 'conf-sub', text: sources
      + (m.newestAgeDays === 0 ? ', newest today'
        : `, newest ${Math.round(m.newestAgeDays)} day${m.newestAgeDays === 1 ? '' : 's'} ago`) }),
  );
}

function summary(muscles) {
  const ranked = [...muscles.values()].filter((m) => m.level);
  const unranked = UNRANKABLE.filter((u) => u !== 'Cardio');
  const strongest = ranked.slice().sort((a, b) => b.percentile - a.percentile)[0];
  const weakest = ranked.slice().sort((a, b) => a.percentile - b.percentile)[0];

  return el('div', { class: 'card' },
    el('div', { class: 'field-help', text: 'Tap a muscle for its numbers.' }),
    strongest && weakest && strongest !== weakest
      ? el('div', { class: 'field-help' },
          `Strongest: ${strongest.muscle} (${strongest.level.name}). `
          + `Furthest behind: ${weakest.muscle} (${weakest.level.name}).`)
      : null,
    el('div', { class: 'field-help', text:
      `${unranked.join(' and ')} can't be ranked — there are no published strength standards for them.` }),
  );
}

/* ------------------------------------------------------------------ *
 * Detail for one muscle
 * ------------------------------------------------------------------ */

// `blocked` is work the user really did that the rating could not use. It is
// rendered in BOTH branches on purpose: a grey muscle needs it to stop the panel
// saying "nothing recorded" about thirty sets of pull-ups, and a rated muscle
// needs it because a rating built on rows while ignoring every chin-up is
// under-reporting its own evidence while looking complete.
//
// ⚠️ ONLY THE UNMEASURED CASE CAN REACH THIS SCREEN, and that is why there is no
// "log a weigh-in" button here even though rankBlockedReason() can produce that
// message. The map requires a body weight before it renders anything at all —
// `profile.missing` includes it, and muscleStrength() returns ready:false — so
// by the time a panel exists, a weigh-in exists and every bodyweight exercise
// with a published fraction is already counting. What is left is the permanent
// kind: an inverted row whose fraction spans 37–79 % with a bar height the app
// does not record, or a handstand push-up nobody has ever put on a force plate.
// Offering a button for those would be a promise the app cannot keep.
//
// The actionable wording is not wasted — it reaches the user on the GRAPH, in
// normalizeBlockedReason(), which has no profile gate in front of it.
function blockedNote(blocked) {
  if (!blocked || !blocked.exercises.length) return null;
  const names = blocked.exercises.map((e) => e.name);
  const listed = names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  const sets = blocked.sets;
  return el('div', { class: 'card' },
    el('div', { class: 'field-help', text:
      `${sets} set${sets === 1 ? '' : 's'} of ${listed} ${sets === 1 ? 'is' : 'are'} not counted `
      + `here — ${blocked.exercises[0].reason}.` }),
  );
}

function detail(m, muscle, profile, blocked) {
  if (!m) {
    const lift = keyLiftFor(muscle);
    const note = blockedNote(blocked);
    return el('div', { class: 'card' },
      el('div', { class: 'section-label', text: muscle }),
      el('div', { class: 'field-help' },
        lift
          ? (note
            ? 'Nothing here can be ranked yet, but that is not the same as nothing recorded.'
            : `Nothing recorded for this muscle yet. Any exercise that trains it counts — `
              + `${lift.name} is the standard it is measured against, but it is not the only thing `
              + 'that rates it.')
          : 'This muscle has no published strength standards, so it can\'t be ranked.'),
      note,
      lift
        ? el('a', { class: 'btn primary block', href: '#/benchmark', text: `Benchmark ${lift.name}` })
        : null,
    );
  }

  const pct = Math.round(m.percentile);
  const rows = LEVELS.map((l) => {
    const target = weightForPercentile(l.percentile, muscle, profile);
    const reached = m.percentile >= l.percentile;
    return el('div', { class: 'target-row' + (reached ? ' reached' : '') },
      el('i', { class: 'lv-sw lv-' + l.key }),
      el('span', { class: 'target-name', text: l.name }),
      el('span', { class: 'target-pct mono', text: `top ${100 - l.percentile}%` }),
      // Ceil, never round. If the panel says 295 lb, lifting 295 has to be
      // enough — rounding 295.4 down to 295 would show a target that does not
      // actually clear the threshold.
      el('span', { class: 'target-wt mono', text: units.withUnit(Math.ceil(target)) }),
    );
  });

  return el('div', { class: 'card' },
    el('div', { class: 'muscle-head' },
      el('span', { class: 'muscle-name', text: muscle }),
      el('span', { class: 'muscle-level lv-text-' + (m.level ? m.level.key : 'below'),
        text: m.level ? m.level.name : 'Below Beginner' }),
    ),

    // Where the number came from is never left unsaid (Rule 5). Now that a
    // rating can come from an exercise that is NOT the key lift, saying which
    // exercise matters more than it ever did: "195 lb bench" and "195 lb
    // converted from a dumbbell press" deserve different amounts of trust, and
    // the panel has to let someone tell them apart.
    el('div', { class: 'field-help' },
      `${units.withUnit(Math.round(m.estimate))} estimated ${m.lift.name}`
      + ` · best from ${m.best.exerciseName}, ${units.fmtWeight(m.best.weight)}`
      + (m.best.loadType === 'per_side' ? '/side' : '')
      + `×${m.best.reps} on ${fmtDateShort(m.best.date)}`
      + (m.best.source === 'workout' ? ', logged in a workout' : ', benchmarked')),

    confidenceRow(m),

    m.basis === 'fallback'
      ? el('div', { class: 'chart-caption warn' }, el('span', {
          text: 'No direct exercise for this muscle yet — this is inferred from the big lifts '
            + 'that also work it, so treat it as a rough placing.' }))
      : null,

    m.hint ? el('div', { class: 'field-help', text: m.hint }) : null,

    blockedNote(blocked),

    // The population is never assumed. It is whatever the header says it is,
    // built from the same function, so the percentile and the group it refers
    // to cannot drift apart when the comparison is changed.
    el('div', { class: 'field-help' },
      `Stronger than ${pct}% of ${comparisonLabel(profile).main.replace(/^vs\. /, '')}`
      + ` — ${comparisonLabel(profile).sub}.`),

    // When the comparison includes people who do not lift, say so in the panel
    // as well as the header — that reading is much softer evidence than a
    // ranking against lifters, and it should never be quoted without the caveat.
    profile && normalizeCompare(profile.compare).pool === 'everyone'
      ? el('div', { class: 'field-help general' },
          'This compares you against adults in general, most of whom do not lift. '
          + 'What an untrained adult can lift has never really been measured, so treat '
          + 'this as a rough placing rather than a number to quote.')
      : null,

    // The near goal. Five levels alone left gaps big enough to train through
    // without the colour moving; this is what keeps a target close.
    m.next
      ? el('div', { class: 'to-next' },
          el('div', { class: 'to-next-bar' },
            el('div', { class: 'to-next-fill', style: `width:${(m.progress * 100).toFixed(1)}%` })),
          el('div', { class: 'to-next-label' },
            `${units.withUnit(Math.ceil(m.toNext))} to ${m.next.name}`),
        )
      : el('div', { class: 'field-help', text: 'Top level reached.' }),

    !m.confident
      ? el('div', { class: 'chart-caption warn' }, el('span', {
          text: `Estimated from a ${m.best.reps}-rep set. Ranking is most reliable from sets of `
            + '5 reps or fewer — benchmark heavier for a firmer placing.' }))
      : null,

    el('div', { class: 'section-label', text: `${m.lift.name} targets` }),
    el('div', { class: 'targets' }, rows),
  );
}
