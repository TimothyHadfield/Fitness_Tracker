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

    // Where the number came from is never left unsaid: a set logged mid-workout
    // comes after everything else that session did, so it reads lower than a
    // deliberate test, and someone comparing two muscles deserves to know which
    // kind of evidence each one rests on.
    el('div', { class: 'field-help' },
      `${units.withUnit(Math.round(m.best.e1rm))} estimated max on ${m.lift.name}`
      + ` · from ${units.fmtWeight(m.best.weight)}×${m.best.reps} on ${fmtDateShort(m.best.date)}`
      + (m.best.source === 'workout' ? ', logged in a workout' : ', benchmarked')),

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
