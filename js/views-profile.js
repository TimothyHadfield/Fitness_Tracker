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
  refreshRoute, helpDot,
} from './ui.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

// Rebuild the screen you are on. ⚠️ It used to bounce through `#/blank`, which
// pushed two history entries and therefore broke the back arrow the day back
// started meaning "the previous screen" (2026-09-02). `refreshRoute()` renders
// in place and pushes nothing.
function refresh() {
  refreshRoute();
}

/* Why each field is asked for, said at the point of asking (D8). Nobody should
 * have to guess why a fitness app wants their birth year.
 *
 * ⚠️ BEHIND A "?" SINCE 2026-09-08, not deleted — Tim pointed at the account
 * screens and this is the same fault one tap in: three fields, three
 * explanations, and the explanations were longer than the controls. This is
 * exactly the split Rule 9 describes — the label says WHAT is being asked for
 * and the ? says why it is worth answering — and Hevy's own profile screen,
 * which is what Tim sent, marks its one explanation the same way. */
const WHY = {
  gender: 'Strength standards differ by about 20–30 % between men and women at the same body weight.',
  age: 'Only used to compare you against people your own age. Optional — leave it blank to be compared against everyone.',
  weight: 'Every strength standard is a ratio to body weight, so this is what the comparison is built on.',
};

/** A field label with its explanation one tap away. */
const askedFor = (label, why, what) => el('div', { class: 'help-line' },
  el('label', { text: label }),
  helpDot(why, { label: `Why we ask for your ${what || label.toLowerCase()}` }),
);

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
    // ⚠️ This is the ONE control in the app with no visible label — the button
    // under it says "Log today's weight" and carries the meaning for a sighted
    // reader, so associateLabels() has nothing to attach and a screen reader got
    // "edit text, blank". A placeholder is not a name: it disappears the moment
    // anything is typed. Found by the 2026-08-20 audit.
    'aria-label': `Body weight in ${units.units() === 'kg' ? 'kilograms' : 'pounds'}`,
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
        askedFor('Gender', WHY.gender),
        genderChips,
      ),

      el('div', { class: 'field' },
        askedFor('Birth year', WHY.age, 'birth year'),
        yearInput,
        // ⚠️ The age STAYS on the screen and does not go in the ?. It is the
        // app reading back what it made of what you typed — a fact about this
        // account rather than an explanation of the field.
        profile.age ? el('div', { class: 'field-help', text: `You’re ${profile.age}.` }) : null,
      ),

      el('div', { class: 'help-line' },
        el('div', { class: 'section-label', text: `Body weight (${units.units()})` }),
        helpDot(WHY.weight, { label: 'Why we ask for your body weight' })),
      el('div', { class: 'card' },
        weightInput,
        logBtn,
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
