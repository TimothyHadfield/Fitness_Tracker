// Importing a file exported from another app.
//
// docs/integrations-plan.md §5, Phase 1. The whole argument for doing this
// before any live sync: reading a file the user exported and handed over needs
// no OAuth, no client secret, no server, no paid Firebase tier and no partner
// approval, and it breaks nobody's terms of service. It works today, on a
// static site, which live Strava sync cannot.
//
// ⚠️ THE SHAPE IS inspectBackup()'S, AND ON PURPOSE: read the whole file,
// work out exactly what would happen, SAY IT, and only then write. The restore
// path learned that the hard way on 2026-08-24 — a half-import used to be
// reachable, and a file with nothing usable in it used to toast "restored".
//
// ⚠️ AND NOTHING HERE HAS EVER SEEN A REAL EXPORT FILE. The column names are
// from published documentation, not from a file this project has parsed, which
// is why every step is a preview the user confirms rather than a schema that
// claims to know. If a column is guessed wrong, the preview is where they see
// it — before anything is written, not after.

import { store } from './store.js';
import { el, screenShell, toast, confirmSheet, setChildren, icon, refreshRoute } from './ui.js';
import * as imp from './import-file.js';

const go = (hash) => { location.hash = hash; };

/* ⚠️ SETTING THE HASH YOU ARE ALREADY ON FIRES NO EVENT, so `go('#/import')`
 * from the import screen did precisely nothing — "Choose a different file" was
 * a dead button and so was the one after a finished import. Found by driving
 * the screen rather than by reading it. ⚠️ It used to bounce through `#/blank`
 * like the Account screen did; that pushed two history entries and broke the
 * back arrow once back meant "the previous screen" (2026-09-02). */
function reopen() {
  refreshRoute('#/import');
}

export async function ImportView() {
  const body = el('div', { class: 'list' });

  const fileInput = el('input', {
    type: 'file', accept: '.csv,text/csv,text/plain', style: 'display:none',
    onChange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        await showPlan(body, file.name, text);
      } catch (err) {
        toast((err && err.message) || 'That file could not be read.');
      }
    },
  });

  setChildren(body, intro(() => fileInput.click()), fileInput);

  return screenShell({
    title: 'Import from a file',
    back: () => go('#/account'),
    scroll: body,
  });
}

function intro(pick) {
  return el('div', { class: 'card' },
    el('div', { class: 'field-help' },
      'Bring in workouts you have already recorded somewhere else, or a history of weigh-ins. '
      + 'Everything happens on this device — the file is never uploaded anywhere.'),
    el('button', { class: 'btn primary block', onClick: pick }, icon('plus'), 'Choose a CSV file'),
    el('div', { class: 'section-label', text: 'Where to get the file' }),
    // ⚠️ Named services, because "export a CSV" is not an instruction anybody
    // can follow. D8 — teach at the moment of use.
    el('div', { class: 'field-help' },
      'Strava: Settings → My Account → Download or Delete Your Account → Request your archive. '
      + 'The file you want is activities.csv.'),
    el('div', { class: 'field-help' },
      'MacroFactor: Settings → Data Export. Cronometer: Settings → Account → Export Data. '
      + 'Apple Health: your profile → Export All Health Data.'),
    el('div', { class: 'field-help' },
      'A spreadsheet of your own works too, as long as the first row names the columns — '
      + 'something like date, activity, distance, time, or date and weight.'),
    el('div', { class: 'field-help' },
      'What comes in: activities land on your calendar and in your feed like any workout, and '
      + 'weigh-ins join your body-weight history. Muscle ratings still come from lifting only.'),
  );
}

/**
 * The middle step, and the one that matters: what WOULD happen.
 *
 * ⚠️ It counts against what is already stored, so the number on the button is
 * the number of rows that will actually be added. "Import 214 activities" when
 * 190 are already on the calendar is a sentence that teaches somebody not to
 * read the next one.
 */
async function showPlan(body, fileName, text) {
  const rows = imp.parseCSV(text);
  const { headers, records } = imp.toRecords(rows);

  if (!records.length) {
    setChildren(body, problem('That file has no rows in it.',
      'It may be empty, or it may not be a CSV. The first line should name the columns.'));
    return;
  }

  const cols = imp.detectColumns(headers);
  if (!cols.date) {
    setChildren(body, problem('No date column found.',
      `Every row needs a date. The columns in this file are: ${headers.filter(Boolean).join(', ')}.`));
    return;
  }

  const hasActivity = Boolean(cols.distance || cols.duration);
  const hasWeight = Boolean(cols.weight);
  if (!hasActivity && !hasWeight) {
    setChildren(body, problem('Nothing recognisable to import.',
      'This file has dates but no distance, time or weight column. Those are the things this app '
      + `can read. The columns in this file are: ${headers.filter(Boolean).join(', ')}.`));
    return;
  }

  // ⚠️ THE DATE ORDER IS SETTLED BEFORE ANYTHING IS READ, and refused rather
  // than guessed when the column cannot settle it. 03/04/2026 is the 3rd of
  // April to most of the world and the 4th of March in the US, and a guess is
  // wrong half the time SILENTLY — every imported session would sit on the
  // wrong day forever, and nothing on screen would ever look wrong.
  const order = imp.dateOrderOf(records.map((r) => r[cols.date]));
  if (order === 'ambiguous') {
    setChildren(body, askDateOrder(body, fileName, headers, records, cols));
    return;
  }

  await renderPlan(body, fileName, headers, records, cols, { dateOrder: order });
}

function askDateOrder(body, fileName, headers, records, cols) {
  const sample = records.slice(0, 3).map((r) => r[cols.date]).filter(Boolean);
  const choose = async (dateOrder) => {
    await renderPlan(body, fileName, headers, records, cols, { dateOrder });
  };
  return el('div', { class: 'card' },
    el('div', { class: 'section-label', text: 'Which way round are the dates?' }),
    el('div', { class: 'field-help' },
      `This file writes dates like ${sample.join(', ')}, and that could mean either order. `
      + 'Nothing in the file says which, and getting it wrong would put every record on the '
      + 'wrong day without ever looking wrong — so it is worth one tap.'),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', text: 'Day / Month', onClick: () => choose('dmy') }),
      el('button', { class: 'btn', text: 'Month / Day', onClick: () => choose('mdy') }),
    ),
  );
}

async function renderPlan(body, fileName, headers, records, cols, opts) {
  const sourceName = fileName.replace(/\.[^.]+$/, '').slice(0, 40);
  const parts = [];

  const [sessions, weights] = await Promise.all([
    store.getSessions(), store.getBodyWeights(),
  ]);

  // Activities
  let actPlan = null;
  let needsDistanceUnit = false;
  if (cols.distance || cols.duration) {
    const read = imp.readActivities(records, cols, { ...opts, sourceName });
    if (read.needsDistanceUnit) needsDistanceUnit = true;
    else {
      actPlan = imp.planImport(read.rows, sessions, (r) => `${r.date}|${(r.workoutName || '').toLowerCase()}`);
      actPlan.problems = read.problems;
    }
  }

  // Weigh-ins. The unit is asked for rather than inferred when the header does
  // not say — reading kg as pounds would turn a 75 kg person into a 75 lb one.
  let weightPlan = null;
  let needsWeightUnit = false;
  if (cols.weight) {
    const unit = opts.weightUnit || imp.weightUnitOf(cols.weight);
    if (!unit) needsWeightUnit = true;
    else {
      const read = imp.readWeights(records, cols, { ...opts, weightUnit: unit, sourceName });
      weightPlan = imp.planImport(read.rows, weights, (r) => r.date);
      weightPlan.problems = read.problems;
      weightPlan.unit = unit;
    }
  }

  parts.push(el('div', { class: 'card' },
    el('div', { class: 'section-label', text: fileName }),
    el('div', { class: 'field-help', text:
      `${records.length} rows, ${headers.filter(Boolean).length} columns. `
      + `Read as: ${Object.entries(cols).map(([k, v]) => `${k} → “${v}”`).join(', ')}.` }),
  ));

  if (needsDistanceUnit) {
    parts.push(el('div', { class: 'card' },
      el('div', { class: 'section-label', text: 'Miles or kilometres?' }),
      el('div', { class: 'field-help' },
        `The column “${cols.distance}” does not say which unit it is in. Strava exports `
        + 'kilometres, most American apps export miles, and reading one as the other would make '
        + 'every distance wrong by 61 % without ever looking wrong.'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', text: 'Miles', onClick: () =>
          renderPlan(body, fileName, headers, records, cols, { ...opts, distanceUnit: 'mi' }) }),
        el('button', { class: 'btn', text: 'Kilometres', onClick: () =>
          renderPlan(body, fileName, headers, records, cols, { ...opts, distanceUnit: 'km' }) }),
      ),
    ));
  }

  if (needsWeightUnit) {
    parts.push(el('div', { class: 'card' },
      el('div', { class: 'section-label', text: 'Pounds or kilograms?' }),
      el('div', { class: 'field-help' },
        `The column “${cols.weight}” does not say which unit it is in, and the app cannot tell from `
        + 'the numbers — reading kilograms as pounds would record you as a third of your real '
        + 'weight, and every pull-up you have ever logged would be re-rated against it.'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', text: 'Pounds', onClick: () =>
          renderPlan(body, fileName, headers, records, cols, { ...opts, weightUnit: 'lb' }) }),
        el('button', { class: 'btn', text: 'Kilograms', onClick: () =>
          renderPlan(body, fileName, headers, records, cols, { ...opts, weightUnit: 'kg' }) }),
      ),
    ));
  }

  if (actPlan) parts.push(planCard('Activities', actPlan, 'activity', 'activities'));
  if (weightPlan) parts.push(planCard(`Weigh-ins (${weightPlan.unit === 'kg' ? 'kg' : 'lbs'})`,
    weightPlan, 'weigh-in', 'weigh-ins'));

  const willAdd = (actPlan ? actPlan.fresh.length : 0) + (weightPlan ? weightPlan.fresh.length : 0);
  // ⚠️ A question still on screen is not the same as nothing to import, and
  // saying so would be a wrong answer to a question the app itself just asked.
  const pending = needsDistanceUnit || needsWeightUnit;

  if (!willAdd && !pending) {
    parts.push(el('div', { class: 'card' },
      el('div', { class: 'field-help', text:
        'Nothing new to bring in — everything readable in this file is already here. '
        + 'Importing the same export twice is safe; it updates rather than duplicating.' }),
    ));
  } else if (willAdd) {
    parts.push(el('button', {
      class: 'btn primary block',
      text: `Import ${willAdd} ${willAdd === 1 ? 'record' : 'records'}`,
      onClick: () => confirmImport(body, actPlan, weightPlan),
    }));
  }
  parts.push(el('button', { class: 'btn ghost block', text: 'Choose a different file',
    onClick: reopen }));

  setChildren(body, ...parts);
}

function planCard(title, plan, one, many) {
  const lines = [];
  lines.push(`${plan.fresh.length} new ${plan.fresh.length === 1 ? one : many} to add.`);
  if (plan.repeat) {
    lines.push(`${plan.repeat} already imported from a file before — they will be left alone.`);
  }
  if (plan.collides) {
    lines.push(`⚠️ ${plan.collides} fall on a day you already have something recorded with the `
      + 'same name. They will be added as well, so check for repeats afterwards.');
  }
  const p = plan.problems || {};
  const rowWord = (n) => (n === 1 ? '1 row' : `${n} rows`);
  if (p.undated) {
    lines.push(`${rowWord(p.undated)} ${p.undated === 1 ? 'has' : 'have'} no readable date `
      + 'and will be skipped.');
  }
  if (p.empty) {
    lines.push(`${rowWord(p.empty)} ${p.empty === 1 ? 'records' : 'record'} nothing at all `
      + 'and will be skipped.');
  }
  if (p.implausible) {
    lines.push(`${p.implausible} weights are outside 40–800 lbs and will be skipped — `
      + 'that usually means the column is in different units than it says.');
  }

  return el('div', { class: 'card' },
    el('div', { class: 'section-label', text: title }),
    ...lines.map((t) => el('div', { class: 'field-help', text: t })),
    ...preview(plan.fresh, one),
  );
}

/** Three real rows, so somebody can see the columns were read correctly. */
function preview(rows, kind) {
  if (!rows.length) return [];
  return [
    el('div', { class: 'field-help', text: 'First few:' }),
    ...rows.slice(0, 3).map((r) => el('div', { class: 'row' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: r.workoutName || `${r.weight} lbs` }),
        el('div', { class: 'row-sub', text: describeRow(r, kind) }),
      ),
    )),
  ];
}

function describeRow(r, kind) {
  if (kind === 'weigh-in') return r.date;
  const set = (r.entries && r.entries[0] && r.entries[0].sets && r.entries[0].sets[0]) || {};
  const bits = [r.date];
  if (set.distance) bits.push(`${set.distance} mi`);
  if (set.time) bits.push(`${Math.round(set.time / 60)} min`);
  return bits.join(' · ');
}

function problem(title, detail) {
  return el('div', { class: 'card' },
    el('div', { class: 'section-label', text: title }),
    el('div', { class: 'field-help', text: detail }),
    el('button', { class: 'btn ghost block', text: 'Try another file', onClick: reopen }),
  );
}

function confirmImport(body, actPlan, weightPlan) {
  const bits = [];
  if (actPlan && actPlan.fresh.length) bits.push(`${actPlan.fresh.length} activities`);
  if (weightPlan && weightPlan.fresh.length) bits.push(`${weightPlan.fresh.length} weigh-ins`);
  const replacing = weightPlan
    ? weightPlan.fresh.filter((r) => false).length : 0;   // weigh-ins merge by day, counted below

  confirmSheet({
    title: 'Add these to your account?',
    message: `${bits.join(' and ')} will be added.\n\n`
      + 'This adds to what you already have — nothing is deleted or replaced, except a weigh-in on '
      + 'a day you already have one, which is kept as a single reading per day. '
      + 'Importing the same file again later is safe.',
    confirmLabel: 'Import',
    danger: false,
    onConfirm: async () => {
      try {
        const done = { added: 0, replaced: 0 };
        if (actPlan && actPlan.fresh.length) {
          const r = await store.importRows('sessions', actPlan.fresh);
          done.added += r.added; done.replaced += r.replaced;
        }
        if (weightPlan && weightPlan.fresh.length) {
          const r = await store.importRows('bodyWeight', weightPlan.fresh);
          done.added += r.added; done.replaced += r.replaced;
        }
        toast(`Imported ${done.added}${done.replaced ? `, updated ${done.replaced}` : ''}`);
        setChildren(body, el('div', { class: 'card' },
          el('div', { class: 'section-label', text: 'Imported' }),
          el('div', { class: 'field-help', text:
            `${done.added} added${done.replaced ? `, ${done.replaced} updated` : ''}. `
            + 'Activities are on your calendar; weigh-ins are in your body-weight history.' }),
          el('a', { class: 'btn primary block', href: '#/calendar', text: 'Open the calendar' }),
          el('a', { class: 'btn ghost block', href: '#/account', text: 'Back to account' }),
        ));
      } catch (err) {
        // ⚠️ Said on the screen, not swallowed. The 2026-08-22 silent-save
        // lesson: a write that fails and says nothing is worse than one that
        // fails loudly, because the user walks away believing it worked.
        toast((err && err.message) || 'That import could not be saved.');
      }
    },
  });
}
