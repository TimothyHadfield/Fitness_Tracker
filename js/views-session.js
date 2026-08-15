// The in-workout recording flow, plus the benchmark form.

import { store, todayISO } from './store.js';
import { LOAD_LABEL } from './exercises.js';
import {
  el, icon, iconBtn, toast, screenShell, emptyState, stepper,
  fmtSet, confirmSheet, fmtDateLong,
} from './ui.js';
import { openExercisePicker } from './views-workouts.js';

const go = (hash) => { location.hash = hash; };
const DRAFT_KEY = 'ftrack:v1:draftSession';

/* ------------------------------------------------------------------ *
 * Draft persistence — a phone call or an app switch must not lose a workout
 * ------------------------------------------------------------------ */

function saveDraft(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {}
}
export function loadDraft() {
  try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}
export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
}

/* ================================================================== *
 * Session runner
 * ================================================================== */

export async function SessionView(workoutId) {
  const workout = await store.getWorkout(workoutId);
  if (!workout) {
    return screenShell({
      title: 'Not found', back: () => go('#/home'),
      scroll: emptyState('That workout no longer exists', 'It may have been deleted.'),
    });
  }

  const exMap = await store.getExerciseMap();
  const planned = workout.exercises
    .map((item) => ({ item, ex: exMap.get(item.exerciseId) }))
    .filter((p) => p.ex);

  if (!planned.length) {
    return screenShell({
      title: workout.name, back: () => go('#/home'),
      scroll: emptyState('This workout has no exercises', 'Add some before running it.',
        el('button', { class: 'btn primary', text: 'Edit workout', onClick: () => go('#/workout/' + workout.id) })),
    });
  }

  function blankSet(fields) {
    const s = {};
    for (const f of fields) s[f] = 0;
    return s;
  }
  function pickFields(src, fields) {
    const s = {};
    for (const f of fields) s[f] = typeof src[f] === 'number' ? src[f] : 0;
    return s;
  }

  // A draft only resumes on the same day. Yesterday's abandoned session should not
  // silently reappear and get saved with today's date.
  const rawDraft = loadDraft();
  const existingDraft =
    rawDraft && rawDraft.workoutId === workout.id && rawDraft.date === todayISO() ? rawDraft : null;
  if (rawDraft && !existingDraft) clearDraft();

  let state;

  if (existingDraft) {
    state = existingDraft;
  } else {
    state = {
      workoutId: workout.id,
      workoutName: workout.name,
      date: todayISO(),
      startedAt: new Date().toISOString(),
      index: 0,
      entries: [],
    };

    for (const { item, ex } of planned) {
      const last = await store.lastSetsFor(workout.id, ex.id);
      // Build exactly the number of sets the workout plans for. Where history
      // runs out, repeat the last recorded set rather than dropping to zero.
      const sets = Array.from({ length: item.sets }, (_, i) => {
        if (!last || !last.length) return blankSet(ex.fields);
        return pickFields(last[Math.min(i, last.length - 1)], ex.fields);
      });

      state.entries.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        fields: ex.fields,
        loadType: ex.loadType,
        notes: item.notes || '',
        plannedSets: item.sets,
        sets,
        active: 0,
        hadHistory: Boolean(last && last.length),
        lastSummary: last && last.length ? fmtSet(last[0], ex.fields, ex.loadType) : null,
      });
    }
    saveDraft(state);
  }

  /* ---- DOM scaffold ---- */

  const progress = el('div', { class: 'session-progress' });
  const pane = el('div', { class: 'pane-scroll' });
  const footer = el('div', { class: 'session-footer' });

  function renderProgress() {
    progress.replaceChildren(
      ...state.entries.map((_, i) =>
        el('span', { class: i < state.index ? 'done' : i === state.index ? 'current' : '' })),
    );
  }

  function renderFooter() {
    const isLast = state.index === state.entries.length - 1;
    footer.replaceChildren(
      el('button', {
        class: 'nav-arrow', 'aria-label': 'Previous exercise',
        disabled: state.index === 0,
        onClick: () => { state.index--; saveDraft(state); renderAll(); },
      }, icon('left')),
      isLast
        ? el('button', { class: 'btn good', onClick: finish }, icon('check'), 'Finish workout')
        : el('button', {
            class: 'btn primary',
            onClick: () => { state.index++; saveDraft(state); renderAll(); },
          }, 'Next exercise', icon('right')),
    );
  }

  function renderPane() {
    const entry = state.entries[state.index];
    const ex = exMap.get(entry.exerciseId);
    const active = entry.sets[entry.active] || entry.sets[0];

    const setList = el('div', { class: 'set-list' });

    function renderSets() {
      setList.replaceChildren(
        ...entry.sets.map((s, i) =>
          el('div', { class: 'set-item' + (i === entry.active ? ' active' : '') },
            el('button', {
              class: 'set-num', text: String(i + 1), 'aria-label': `Edit set ${i + 1}`,
              onClick: () => { entry.active = i; saveDraft(state); renderPane(); },
            }),
            el('div', { class: 'set-vals', text: fmtSet(s, entry.fields, entry.loadType) }),
            entry.sets.length > 1
              ? el('button', {
                  class: 'set-del', 'aria-label': `Delete set ${i + 1}`,
                  onClick: () => {
                    entry.sets.splice(i, 1);
                    entry.active = Math.min(entry.active, entry.sets.length - 1);
                    saveDraft(state);
                    renderPane();
                  },
                }, icon('trash'))
              : null,
          )),
      );
    }
    renderSets();

    const steppers = entry.fields.map((f) =>
      stepper({
        field: f,
        value: active[f],
        suffix: f === 'weight' && entry.loadType ? LOAD_LABEL[entry.loadType] : null,
        onChange: (v) => { active[f] = v; saveDraft(state); renderSets(); },
      }).node);

    pane.replaceChildren(
      // The per-side / total distinction is carried by the stepper's own label,
      // so it isn't repeated here.
      el('div', { class: 'session-head' },
        el('h2', { class: 'session-ex-name', text: entry.exerciseName }),
        el('div', { class: 'session-ex-meta' },
          `${ex ? ex.muscle + ' · ' + ex.equipment + ' · ' : ''}Exercise ${state.index + 1} of ${state.entries.length}`,
        ),
      ),

      entry.notes
        ? el('div', { class: 'note-card' }, el('b', { text: 'Note' }), el('span', { text: entry.notes }))
        : null,

      entry.hadHistory
        ? el('div', { class: 'prefill-note' }, icon('check', 16),
            el('span', {}, 'Last time: ', el('b', { text: entry.lastSummary })))
        : el('div', { class: 'prefill-note' },
            el('span', { text: 'First time logging this — your numbers will be remembered.' })),

      el('div', { class: 'section-label', text: `Set ${entry.active + 1} of ${entry.sets.length}` }),
      el('div', { class: 'steppers' }, steppers),

      el('div', { class: 'section-label', text: 'Sets' }),
      setList,

      el('button', {
        class: 'btn block',
        onClick: () => {
          entry.sets.push({ ...entry.sets[entry.sets.length - 1] });
          entry.active = entry.sets.length - 1;
          saveDraft(state);
          renderPane();
        },
      }, icon('plus'), 'Add another set'),
    );

    pane.scrollTop = 0;
  }

  function renderAll() {
    renderProgress();
    renderPane();
    renderFooter();
  }

  async function finish() {
    const entries = state.entries
      .map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        sets: e.sets.filter((s) => Object.values(s).some((v) => Number(v) > 0)),
      }))
      .filter((e) => e.sets.length);

    if (!entries.length) {
      toast('Nothing recorded — enter at least one number');
      return;
    }

    await store.saveSession({
      workoutId: state.workoutId,
      workoutName: state.workoutName,
      date: state.date,
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      entries,
    });

    clearDraft();
    showFinished(entries);
  }

  function showFinished(entries) {
    const setCount = entries.reduce((n, e) => n + e.sets.length, 0);
    document.getElementById('app').replaceChildren(screenShell({
      title: 'Workout complete',
      noNav: true,
      scroll: el('div', { class: 'finish-hero' },
        el('div', { class: 'finish-check' }, icon('check')),
        el('h2', { text: 'Nice work' }),
        el('p', { text: `${state.workoutName} · ${entries.length} exercise${entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}` }),
        el('p', { text: `Saved to ${fmtDateLong(state.date)}` }),
      ),
      bottom: [
        el('button', { class: 'btn primary block', text: 'View this workout', onClick: () => go('#/day/' + state.date) }),
        el('button', { class: 'btn block', text: 'Back to home', onClick: () => go('#/home') }),
      ],
    }));
  }

  function quit() {
    confirmSheet({
      title: 'Leave this workout?',
      message: 'Your progress is saved as a draft — start this workout again today and you will pick up where you left off.',
      confirmLabel: 'Leave',
      danger: false,
      onConfirm: () => go('#/home'),
    });
  }

  renderAll();

  return el('div', { class: 'screen no-nav' },
    el('header', { class: 'topbar' },
      iconBtn('x', 'Leave workout', quit),
      el('div', { style: 'flex:1;min-width:0' },
        el('h1', { text: workout.name }),
        el('div', { class: 'topbar-sub', text: existingDraft ? 'Resumed where you left off' : 'In progress' }),
      ),
    ),
    progress,
    pane,
    footer,
  );
}

/* ================================================================== *
 * Benchmark
 * ================================================================== */

export async function BenchmarkView() {
  const exMap = await store.getExerciseMap();
  const state = { date: todayISO(), exercise: null, values: {} };

  const dateInput = el('input', {
    class: 'input', type: 'date', value: state.date, max: todayISO(),
    onChange: (e) => { state.date = e.target.value || todayISO(); },
  });

  const exBtn = el('button', { class: 'row', onClick: pickExercise },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: 'Choose an exercise' }),
      el('div', { class: 'row-sub', text: 'Search the library or create your own' }),
    ),
    el('span', { class: 'row-chev' }, icon('right')),
  );

  const stepWrap = el('div', { class: 'steppers' });
  const submitBtn = el('button', { class: 'btn primary block', text: 'Save benchmark', disabled: true, onClick: submit });

  function pickExercise() {
    openExercisePicker({
      exMap,
      title: 'Choose exercise',
      onPick: (ex) => {
        state.exercise = ex;
        state.values = {};
        for (const f of ex.fields) state.values[f] = 0;
        exBtn.querySelector('.row-title').textContent = ex.name;
        exBtn.querySelector('.row-sub').textContent =
          `${ex.muscle} · ${ex.equipment}${ex.loadType ? ' · weight ' + LOAD_LABEL[ex.loadType] : ''}`;
        renderSteppers();
        submitBtn.disabled = false;
        document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
        return true;
      },
    });
  }

  function renderSteppers() {
    stepWrap.replaceChildren(
      ...state.exercise.fields.map((f) =>
        stepper({
          field: f,
          value: 0,
          suffix: f === 'weight' && state.exercise.loadType ? LOAD_LABEL[state.exercise.loadType] : null,
          onChange: (v) => { state.values[f] = v; },
        }).node),
    );
  }

  async function submit() {
    if (!state.exercise) { toast('Pick an exercise first'); return; }
    if (!Object.values(state.values).some((v) => Number(v) > 0)) { toast('Enter at least one number'); return; }

    await store.saveBenchmark({
      date: state.date,
      exerciseId: state.exercise.id,
      exerciseName: state.exercise.name,
      values: { ...state.values },
    });

    toast('Benchmark saved');
    go('#/day/' + state.date);
  }

  return screenShell({
    title: 'Record a benchmark',
    sub: 'A one-off record, past or present',
    back: () => go('#/home'),
    top: [
      el('div', { class: 'field' }, el('label', { text: 'Date' }), dateInput),
      el('div', { class: 'field' }, el('label', { text: 'Exercise' }), exBtn),
    ],
    scroll: stepWrap,
    bottom: submitBtn,
  });
}
