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
} from './strength-standards.js';
import { bodySvg, setSelected } from './body-map.js';
import { setChildren, el, emptyState, trimNum, fmtDateShort } from './ui.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

let selected = null;
let showGeneral = false;

export async function muscleGroupsPane(host, top) {
  const { profile, muscles, ready } = await muscleStrength();

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
      'Each muscle group is ranked by one named lift — bench press for chest, back squat for quads, '
      + 'and so on. Lift one in a workout, or record a benchmark, and it will light up.',
      el('a', { class: 'btn primary', href: '#/benchmark', text: 'Record a benchmark' }),
    ));
    return;
  }

  /* ---- top row: what the comparison is against ---- */

  setChildren(top,
    el('div', { class: 'control-row' },
      el('div', { class: 'basis' },
        el('span', { class: 'basis-main', text: 'vs. people who lift' }),
        el('span', {
          class: 'basis-sub',
          text: `${profile.gender === 'female' ? 'women' : 'men'}`
            + (profile.age ? ` around ${profile.age}` : ', all ages')
            + ` · ${units.withUnit(profile.bodyWeight)}`,
        }),
      ),
      el('button', {
        class: 'chip', 'aria-pressed': String(showGeneral),
        text: 'vs. everyone',
        onClick: () => { showGeneral = !showGeneral; render(); },
      }),
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
      selected ? detail(muscles.get(selected), selected, profile) : summary(muscles),
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
 * Confidence
 * ------------------------------------------------------------------ */

// A bar and a word, never the colour alone. The bar is the same fade the muscle
// itself is painted with, so the two are obviously the same quantity — someone
// should be able to look at a washed-out muscle, tap it, and find the bar short.
function confidenceRow(m) {
  const pct = Math.round(m.confidence * 100);
  const sources = m.contributorCount === 1
    ? '1 session counted'
    : `${m.contributorCount} sessions counted`;
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

function detail(m, muscle, profile) {
  if (!m) {
    const lift = keyLiftFor(muscle);
    return el('div', { class: 'card' },
      el('div', { class: 'section-label', text: muscle }),
      el('div', { class: 'field-help' },
        lift
          ? `Nothing recorded on ${lift.name} yet. That's the lift this muscle is ranked by — `
            + 'lift it in a workout or benchmark it.'
          : 'This muscle has no published strength standards, so it can\'t be ranked.'),
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

    el('div', { class: 'field-help' },
      `Stronger than ${pct}% of people who lift at your weight`
      + (profile.age ? ' and age.' : '.')),

    showGeneral
      ? el('div', { class: 'field-help general' },
          `Roughly the top ${Math.max(1, Math.round(100 - m.generalPercentile))}% of all adults — `
          + 'a rough estimate from how many people strength train at all, not a measurement.')
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
