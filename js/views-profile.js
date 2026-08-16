// Profile — gender, age, body weight.
//
// This exists for the Muscle Groups map: every strength standard is a ratio to
// body weight, and they differ by roughly 20–30 % between men and women at the
// same weight. Without gender and body weight the map cannot compute anything.
//
// Body weight doubles as the Tier 1 body-weight trend, so it is logged as a
// dated series rather than a single profile field.

import { store } from './store.js';
import {
  el, screenShell, toast, emptyState, confirmSheet, iconBtn,
  fmtDateShort, trimNum,
} from './ui.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

function refresh() {
  const h = location.hash;
  location.hash = '#/blank';
  setTimeout(() => { location.hash = h; }, 0);
}

// Why each field is asked for, said plainly at the point of asking (D8). Nobody
// should have to guess why a fitness app wants their birth year.
const WHY = {
  gender: 'Strength standards differ by about 20–30 % between men and women at the same body weight.',
  age: 'Only used to compare you against people your own age. Optional — leave it blank to be compared against everyone.',
  weight: 'Every strength standard is a ratio to body weight, so this is what the comparison is built on.',
};

export async function ProfileView() {
  const profile = await store.getProfile();
  const history = await store.getBodyWeights();

  /* ---- gender ---- */

  const genderChips = el('div', { class: 'chips' },
    [['male', 'Male'], ['female', 'Female']].map(([value, label]) =>
      el('button', {
        class: 'chip',
        'aria-pressed': String(profile.gender === value),
        text: label,
        onClick: async () => {
          await store.saveProfile({ gender: profile.gender === value ? null : value });
          refresh();
        },
      })),
  );

  /* ---- birth year ---- */

  const yearInput = el('input', {
    class: 'input',
    type: 'number',
    inputmode: 'numeric',
    placeholder: 'e.g. 1994',
    min: '1900',
    max: String(new Date().getFullYear()),
    value: profile.birthYear || '',
    onChange: async (e) => {
      await store.saveProfile({ birthYear: e.target.value });
      refresh();
    },
  });

  /* ---- body weight ---- */

  const weightInput = el('input', {
    class: 'input',
    type: 'number',
    inputmode: 'decimal',
    step: '0.1',
    placeholder: profile.bodyWeight ? units.fmtWeight(profile.bodyWeight) : (units.units() === 'kg' ? 'e.g. 82' : 'e.g. 180'),
  });

  const logBtn = el('button', {
    class: 'btn primary block',
    text: profile.bodyWeight ? 'Log today’s weight' : 'Save weight',
    onClick: async () => {
      const v = Number(weightInput.value);
      if (!(v > 0)) { toast('Enter a weight'); return; }
      // Typed in whatever unit is on screen; stored in pounds, always.
      await store.logBodyWeight(units.fromDisplay(v));
      toast('Weight saved');
      refresh();
    },
  });

  const trend = history.length > 1
    ? (() => {
        const first = history[0], last = history[history.length - 1];
        const diff = last.weight - first.weight;
        const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
        return el('div', { class: 'field-help' },
          `${units.fmtWeight(first.weight)} on ${fmtDateShort(first.date)} → `
          + `${units.fmtWeight(last.weight)} on ${fmtDateShort(last.date)} `
          + `(${sign}${units.withUnit(Math.abs(diff))}) · `,
          // Two weigh-ins is exactly when the chart becomes available, so this
          // is the moment to say where it is (D8 — teach at the point of use).
          el('a', { class: 'text-link', href: '#/graphs', text: 'see the chart' }));
      })()
    : null;

  const historyList = history.length
    ? el('div', { class: 'list' }, [...history].reverse().slice(0, 12).map((r) =>
        el('div', { class: 'row' },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: units.withUnit(r.weight) }),
            el('div', { class: 'row-sub', text: fmtDateShort(r.date) }),
          ),
          iconBtn('trash', 'Delete this weigh-in', () => confirmSheet({
            title: 'Delete this weigh-in?',
            message: `${units.withUnit(r.weight)} from ${fmtDateShort(r.date)} will be removed.`,
            onConfirm: async () => { await store.deleteBodyWeight(r.id); toast('Deleted'); refresh(); },
          })),
        )))
    : null;

  /* ---- what is still missing ---- */

  const ready = profile.missing.length === 0;
  const status = el('div', { class: 'card' },
    el('div', { class: 'section-label', text: 'Muscle Groups' }),
    el('div', { class: 'field-help' },
      ready
        ? (profile.age
            ? `Ready. You'll be compared against people who lift, aged around ${profile.age}, at ${units.withUnit(profile.bodyWeight)}.`
            : `Ready. You'll be compared against everyone who lifts at ${units.withUnit(profile.bodyWeight)}. Add a birth year to compare against your own age group instead.`)
        : `Still needs your ${profile.missing.join(' and ')} before it can rank anything.`),
  );

  return screenShell({
    title: 'Profile',
    back: () => go('#/settings'),
    scroll: [
      status,

      el('div', { class: 'field' },
        el('label', { text: 'Gender' }),
        genderChips,
        el('div', { class: 'field-help', text: WHY.gender }),
      ),

      el('div', { class: 'field' },
        el('label', { text: 'Birth year' }),
        yearInput,
        el('div', {
          class: 'field-help',
          text: profile.age ? `${WHY.age} You're ${profile.age}.` : WHY.age,
        }),
      ),

      el('div', { class: 'section-label', text: `Body weight (${units.units()})` }),
      el('div', { class: 'card' },
        weightInput,
        logBtn,
        el('div', { class: 'field-help', text: WHY.weight }),
        trend,
      ),

      history.length ? el('div', { class: 'section-label', text: 'History' }) : null,
      historyList,
      history.length > 12
        ? el('div', { class: 'field-help', text: `Showing the 12 most recent of ${history.length}.` })
        : null,

      !history.length
        ? emptyState('No weigh-ins yet',
            'Log your weight above. Weighing in regularly also gives you a body-weight trend over time.')
        : null,
    ],
  });
}
