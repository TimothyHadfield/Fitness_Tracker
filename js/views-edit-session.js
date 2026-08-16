// Editing a workout you already recorded.
//
// Reached from the calendar: open a day, press Edit on a record. Everything is
// changeable — the day it is filed under, the name, which exercises are in it,
// every set, and whether it counts as a benchmark.
//
// This is a plain form, deliberately NOT the session runner. The runner is built
// around a live workout: it prefills from history, keeps a draft against an app
// switch, and expires that draft at midnight. None of that is wanted when
// correcting last Tuesday, and bending it to do both would have put the draft
// machinery one bug away from overwriting real history.
//
// Nothing is written until Save, so backing out changes nothing.

import { store, todayISO } from './store.js';
import { LOAD_LABEL } from './exercises.js';
import {
  setChildren, el, icon, iconBtn, toast, screenShell, emptyState, stepper,
  confirmSheet, fmtDateLong,
} from './ui.js';
import { openExercisePicker } from './views-workouts.js';

const go = (hash) => { location.hash = hash; };

export async function EditSessionView(sessionId) {
  const [session, exMap] = await Promise.all([
    store.getSession(sessionId),
    store.getExerciseMap(),
  ]);

  if (!session) {
    return screenShell({
      title: 'Not found', back: () => go('#/calendar'),
      scroll: emptyState('That record no longer exists', 'It may have been deleted.'),
    });
  }

  // Deep copy: the form must not mutate what is on disk until Save is pressed.
  const draft = {
    ...session,
    entries: (session.entries || []).map((e) => ({
      ...e,
      sets: (e.sets || []).map((s) => ({ ...s })),
    })),
  };
  const originalDate = session.date;

  const nameInput = el('input', {
    class: 'input', type: 'text', value: draft.workoutName || '', maxlength: '60',
    placeholder: 'Workout name',
    onInput: (e) => { draft.workoutName = e.target.value; },
  });

  const dateInput = el('input', {
    class: 'input', type: 'date', value: draft.date, max: todayISO(),
    'aria-label': 'Day this workout is filed under',
    onChange: (e) => { draft.date = e.target.value || originalDate; },
  });

  const benchToggle = el('button', {
    class: 'chip', 'aria-pressed': String(Boolean(draft.isBenchmark)),
    text: draft.isBenchmark ? 'Counts as benchmarks' : 'Normal workout',
    onClick: () => {
      draft.isBenchmark = !draft.isBenchmark;
      benchToggle.setAttribute('aria-pressed', String(draft.isBenchmark));
      benchToggle.textContent = draft.isBenchmark ? 'Counts as benchmarks' : 'Normal workout';
    },
  });

  const list = el('div', { class: 'list' });

  function renderList() {
    if (!draft.entries.length) {
      setChildren(list, el('div', { class: 'field-help', text:
        'No exercises left. Add one, or delete the whole record.' }));
      return;
    }

    setChildren(list, ...draft.entries.map((entry, ei) => {
      const ex = exMap.get(entry.exerciseId);
      const fields = ex ? ex.fields : ['weight', 'reps'];
      const loadType = ex ? ex.loadType : null;

      // The set number and its delete button go on their own row ABOVE the
      // steppers. Beside them they ate enough width that the steppers' grid —
      // auto-fit at a 148px minimum — collapsed to one column and every set
      // became most of a screen tall.
      const setRows = entry.sets.map((set, si) => el('div', { class: 'edit-set' },
        el('div', { class: 'edit-set-head' },
          el('span', { class: 'edit-set-num', text: `Set ${si + 1}` }),
          entry.sets.length > 1
            ? iconBtn('trash', `Delete set ${si + 1}`, () => {
                entry.sets.splice(si, 1);
                renderList();
              }, 'set-del')
            : null,
        ),
        el('div', { class: 'steppers' },
          ...fields.map((f) => stepper({
            field: f,
            value: set[f],
            suffix: f === 'weight' && loadType ? LOAD_LABEL[loadType] : null,
            onChange: (v) => { set[f] = v; },
          }).node),
        ),
      ));

      return el('div', { class: 'card edit-ex' },
        el('div', { class: 'day-head' },
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'detail-ex-name', text: entry.exerciseName }),
          ),
          iconBtn('trash', `Remove ${entry.exerciseName}`, () => confirmSheet({
            title: `Remove ${entry.exerciseName}?`,
            message: 'Its sets will be removed from this record.',
            onConfirm: () => { draft.entries.splice(ei, 1); renderList(); },
          })),
        ),
        ...setRows,
        el('button', {
          class: 'btn block', onClick: () => {
            const last = entry.sets[entry.sets.length - 1] || {};
            entry.sets.push(fields.reduce((o, f) => ({ ...o, [f]: Number(last[f]) || 0 }), {}));
            renderList();
          },
        }, icon('plus'), 'Add a set'),
      );
    }));
  }
  renderList();

  async function save() {
    if (!draft.entries.length) {
      toast('Add an exercise, or delete the record');
      return;
    }
    // Same rule the session runner finishes by: a set with nothing in it is not
    // a set. Without this an "Add a set" someone thought better of would be
    // saved as a row of zeros.
    const entries = draft.entries
      .map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sets: e.sets.filter((s) => Object.values(s).some((v) => Number(v) > 0)),
      }))
      .filter((e) => e.sets.length);

    if (!entries.length) {
      toast('Every set is empty — enter at least one number');
      return;
    }

    await store.saveSession({
      ...draft,
      workoutName: (draft.workoutName || '').trim() || 'Workout',
      entries,
    });
    toast('Record updated');
    go('#/day/' + draft.date);
  }

  function removeRecord() {
    confirmSheet({
      title: 'Delete this record?',
      message: `“${draft.workoutName || 'Workout'}” from ${fmtDateLong(originalDate)} will be `
        + 'permanently removed, including from your graphs.',
      onConfirm: async () => {
        await store.deleteSession(draft.id);
        toast('Record deleted');
        go('#/calendar');
      },
    });
  }

  return screenShell({
    title: 'Edit record',
    sub: fmtDateLong(originalDate),
    back: () => go('#/day/' + originalDate),
    scroll: [
      el('div', { class: 'field' }, el('label', { text: 'Workout name' }), nameInput),
      el('div', { class: 'field' },
        el('label', { text: 'Day' }),
        dateInput,
        el('div', { class: 'field-help', text:
          'Moving this changes which day it appears on, and where it sits in your graphs.' }),
      ),
      el('div', { class: 'field' },
        el('label', { text: 'Kind' }),
        el('div', { class: 'chips' }, benchToggle),
        el('div', { class: 'field-help', text:
          'A benchmark record files the best set of each exercise as a benchmark for that day.' }),
      ),

      el('div', { class: 'section-label', text: 'Exercises' }),
      list,

      el('button', {
        class: 'btn block',
        onClick: () => openExercisePicker({
          exMap,
          onPick: (ex) => {
            if (draft.entries.some((e) => e.exerciseId === ex.id)) {
              toast('Already in this record');
              return false;
            }
            draft.entries.push({
              exerciseId: ex.id,
              exerciseName: ex.name,
              sets: [ex.fields.reduce((o, f) => ({ ...o, [f]: 0 }), {})],
            });
            renderList();
            return true;
          },
        }),
      }, icon('plus'), 'Add an exercise'),

      el('button', { class: 'btn danger block', onClick: removeRecord },
        icon('trash'), 'Delete this record'),
    ],
    bottom: el('button', { class: 'btn primary block', onClick: save }, 'Save changes'),
  });
}
