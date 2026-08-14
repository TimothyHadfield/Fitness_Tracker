// Home, workout list, workout builder, exercise picker.

import { store, uid } from './store.js';
import { MUSCLE_GROUPS, EQUIPMENT, makeCustomExercise } from './exercises.js';
import {
  el, icon, iconBtn, chevron, toast, openSheet, confirmSheet, screenShell,
  emptyState, relativeDay, fmtSet,
} from './ui.js';

const go = (hash) => { location.hash = hash; };

/* ================================================================== *
 * Home
 * ================================================================== */

export async function HomeView() {
  const [workouts, sessions] = await Promise.all([store.getWorkouts(), store.getSessions()]);
  const recent = sessions.slice(0, 5);

  const body = [
    el('button', {
      class: 'btn primary lg block',
      onClick: () => (workouts.length ? go('#/start') : go('#/workout/new')),
    }, icon('play'), workouts.length ? 'Start a workout' : 'Create your first workout'),

    el('button', {
      class: 'btn block',
      onClick: () => go('#/benchmark'),
    }, icon('flag'), 'Record a benchmark'),

    el('div', { class: 'section-label', text: 'Recent activity' }),

    recent.length
      ? el('div', { class: 'list' }, recent.map((s) => sessionRow(s)))
      : emptyState(
          'Nothing recorded yet',
          'Once you finish a workout or log a benchmark, it will show up here and on your calendar.',
        ),
  ];

  return screenShell({
    title: 'Fitness Tracker',
    sub: workouts.length ? `${workouts.length} workout${workouts.length === 1 ? '' : 's'} saved` : 'Get started below',
    actions: [iconBtn('sliders', 'Settings', () => go('#/settings'))],
    body,
  });
}

function sessionRow(s) {
  const count = (s.entries || []).filter((e) => (e.sets || []).length).length;
  return el('button', { class: 'row', onClick: () => go('#/day/' + s.date) },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: s.workoutName || 'Workout' }),
      el('div', { class: 'row-sub', text: `${relativeDay(s.date)} · ${count} exercise${count === 1 ? '' : 's'}` }),
    ),
    chevron(),
  );
}

/* ================================================================== *
 * Pick which workout to start
 * ================================================================== */

export async function StartPickerView() {
  const workouts = await store.getWorkouts();

  const body = workouts.length
    ? el('div', { class: 'list' }, workouts.map((w) =>
        el('button', { class: 'row', onClick: () => go('#/session/' + w.id) },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title', text: w.name }),
            el('div', { class: 'row-sub', text: `${w.exerciseIds.length} exercise${w.exerciseIds.length === 1 ? '' : 's'}` }),
          ),
          chevron(),
        )))
    : emptyState('No workouts yet', 'Build a workout first, then you can run it here.',
        el('button', { class: 'btn primary', text: 'Build a workout', onClick: () => go('#/workout/new') }));

  return screenShell({ title: 'Start a workout', back: () => go('#/home'), body });
}

/* ================================================================== *
 * Workout list
 * ================================================================== */

export async function WorkoutsView() {
  const workouts = await store.getWorkouts();

  const body = [
    el('button', { class: 'btn primary block', onClick: () => go('#/workout/new') },
      icon('plus'), 'New workout'),

    workouts.length
      ? el('div', { class: 'list' }, workouts.map((w) =>
          el('button', { class: 'row', onClick: () => go('#/workout/' + w.id) },
            el('div', { class: 'row-main' },
              el('div', { class: 'row-title', text: w.name }),
              el('div', { class: 'row-sub', text: `${w.exerciseIds.length} exercise${w.exerciseIds.length === 1 ? '' : 's'}` }),
            ),
            chevron(),
          )))
      : emptyState(
          'No workouts yet',
          'A workout is a named list of exercises — Push, Legs, Upper, whatever you call it. Make as many as you like.',
        ),
  ];

  return screenShell({ title: 'Workouts', body });
}

/* ================================================================== *
 * Workout builder
 * ================================================================== */

export async function WorkoutBuilderView(id) {
  const isNew = id === 'new';
  const exMap = await store.getExerciseMap();
  const existing = isNew ? null : await store.getWorkout(id);

  if (!isNew && !existing) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      body: emptyState('That workout no longer exists', 'It may have been deleted.'),
    });
  }

  const draft = existing
    ? { ...existing, exerciseIds: [...existing.exerciseIds] }
    : { id: null, name: '', exerciseIds: [] };

  const nameInput = el('input', {
    class: 'input', type: 'text', value: draft.name, maxlength: '60',
    placeholder: 'Push, Legs, Upper Body…',
    onInput: (e) => { draft.name = e.target.value; },
  });

  const listWrap = el('div', { class: 'list' });

  function renderList() {
    listWrap.replaceChildren();
    if (!draft.exerciseIds.length) {
      listWrap.append(emptyState('No exercises yet', 'Add exercises below. You can reorder them — that is the order you will see them in during the workout.'));
      return;
    }
    draft.exerciseIds.forEach((exId, i) => {
      const ex = exMap.get(exId);
      listWrap.append(el('div', { class: 'builder-item' },
        el('div', { class: 'builder-main' },
          el('div', { class: 'row-title', text: ex ? ex.name : 'Unknown exercise' }),
          el('div', { class: 'row-sub', text: ex ? `${ex.muscle} · ${ex.equipment}` : 'Missing from library' }),
        ),
        el('div', { class: 'move-btns' },
          el('button', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(i, -1) }, icon('up')),
          el('button', { type: 'button', 'aria-label': 'Move down', disabled: i === draft.exerciseIds.length - 1, onClick: () => move(i, 1) }, icon('down')),
        ),
        iconBtn('trash', 'Remove', () => { draft.exerciseIds.splice(i, 1); renderList(); }, 'icon-btn'),
      ));
    });
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= draft.exerciseIds.length) return;
    [draft.exerciseIds[i], draft.exerciseIds[j]] = [draft.exerciseIds[j], draft.exerciseIds[i]];
    renderList();
  }

  renderList();

  async function save() {
    if (!draft.name.trim()) { toast('Give your workout a name first'); nameInput.focus(); return; }
    if (!draft.exerciseIds.length) { toast('Add at least one exercise'); return; }
    await store.saveWorkout({ ...draft, name: draft.name.trim() });
    toast(isNew ? 'Workout created' : 'Workout saved');
    go('#/workouts');
  }

  function remove() {
    confirmSheet({
      title: 'Delete this workout?',
      message: 'Workouts you have already recorded stay in your history and on your calendar. Only the template is removed.',
      onConfirm: async () => { await store.deleteWorkout(draft.id); toast('Workout deleted'); go('#/workouts'); },
    });
  }

  const body = [
    el('div', { class: 'field' }, el('label', { text: 'Workout name' }), nameInput),
    el('div', { class: 'section-label', text: 'Exercises' }),
    listWrap,
    el('button', {
      class: 'btn block',
      onClick: () => openExercisePicker({
        exMap,
        onPick: (ex) => {
          if (draft.exerciseIds.includes(ex.id)) { toast('Already in this workout'); return false; }
          draft.exerciseIds.push(ex.id);
          renderList();
          return true;
        },
      }),
    }, icon('plus'), 'Add exercise'),
    el('div', { style: 'height:4px' }),
    el('button', { class: 'btn primary block', text: isNew ? 'Create workout' : 'Save changes', onClick: save }),
    isNew ? null : el('button', { class: 'btn danger block', text: 'Delete workout', onClick: remove }),
  ];

  return screenShell({
    title: isNew ? 'New workout' : 'Edit workout',
    back: () => go('#/workouts'),
    body,
  });
}

/* ================================================================== *
 * Exercise picker sheet
 * ================================================================== */

export async function openExercisePicker({ exMap, onPick, title = 'Add exercise' }) {
  const all = exMap ? [...exMap.values()] : await store.getExercises();
  let filterMuscle = null;
  let query = '';

  const results = el('div', { class: 'search-results' });

  const search = el('input', {
    class: 'input', type: 'search', placeholder: 'Search 250+ exercises…',
    autocomplete: 'off',
    onInput: (e) => { query = e.target.value.trim().toLowerCase(); render(); },
  });

  const chipRow = el('div', { class: 'chips' },
    el('button', { class: 'chip', 'aria-pressed': 'true', text: 'All', onClick: (e) => setMuscle(null, e.target) }),
    MUSCLE_GROUPS.map((m) =>
      el('button', { class: 'chip', 'aria-pressed': 'false', text: m, onClick: (e) => setMuscle(m, e.target) })),
  );

  function setMuscle(m, btn) {
    filterMuscle = m;
    chipRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    render();
  }

  function render() {
    let list = all;
    if (filterMuscle) list = list.filter((e) => e.muscle === filterMuscle);
    if (query) list = list.filter((e) => e.name.toLowerCase().includes(query) || e.equipment.toLowerCase().includes(query));
    list = list.slice(0, 120);

    results.replaceChildren();

    if (!list.length) {
      results.append(emptyState(
        'No exercise matches that',
        query ? `Nothing found for “${query}”. You can create it as a custom exercise instead.` : 'Try a different filter.',
      ));
      return;
    }

    list.forEach((ex) => {
      const btn = el('button', { class: 'row', onClick: () => {
        const ok = onPick(ex);
        if (ok !== false) {
          btn.style.borderColor = 'var(--good)';
          btn.querySelector('.row-chev').replaceChildren(icon('check'));
        }
      } },
        el('div', { class: 'row-main' },
          el('div', { class: 'row-title', text: ex.name }),
          el('div', { class: 'row-sub', text: `${ex.muscle} · ${ex.equipment}${ex.isCustom ? ' · custom' : ''}` }),
        ),
        chevron(),
      );
      results.append(btn);
    });
  }

  render();

  const { close } = openSheet({
    title,
    body: [
      search,
      chipRow,
      results,
    ],
    footer: el('div', { class: 'btn-row' },
      el('button', { class: 'btn ghost', text: 'Create custom', onClick: () => { close(); openCustomExerciseSheet(onPick); } }),
      el('button', { class: 'btn primary', text: 'Done', onClick: () => close() }),
    ),
  });

  setTimeout(() => search.focus(), 120);
}

/* ================================================================== *
 * Custom exercise creator
 * ================================================================== */

export function openCustomExerciseSheet(onPick) {
  const name = el('input', { class: 'input', type: 'text', placeholder: 'Exercise name', maxlength: '60' });
  const muscle = el('select', { class: 'input' }, MUSCLE_GROUPS.map((m) => el('option', { value: m, text: m })));
  const equip = el('select', { class: 'input' }, EQUIPMENT.map((m) => el('option', { value: m, text: m })));

  const chosen = new Set(['weight', 'reps']);
  const fieldChips = el('div', { class: 'chips' },
    ['weight', 'reps', 'time', 'distance'].map((f) =>
      el('button', {
        class: 'chip',
        'aria-pressed': String(chosen.has(f)),
        text: f[0].toUpperCase() + f.slice(1),
        onClick: (e) => {
          if (chosen.has(f)) chosen.delete(f); else chosen.add(f);
          e.target.setAttribute('aria-pressed', String(chosen.has(f)));
        },
      })),
  );

  const { close } = openSheet({
    title: 'Create custom exercise',
    body: [
      el('div', { class: 'field' }, el('label', { text: 'Name' }), name),
      el('div', { class: 'field' }, el('label', { text: 'Muscle group' }), muscle),
      el('div', { class: 'field' }, el('label', { text: 'Equipment' }), equip),
      el('div', { class: 'field' },
        el('label', { text: 'What do you want to track?' }),
        fieldChips,
        el('div', { style: 'font-size:13px;color:var(--ink-faint);line-height:1.45' },
          'These become the steppers you see during a workout.'),
      ),
    ],
    footer: el('button', {
      class: 'btn primary block',
      text: 'Create exercise',
      onClick: async () => {
        if (!name.value.trim()) { toast('Give the exercise a name'); name.focus(); return; }
        if (!chosen.size) { toast('Pick at least one thing to track'); return; }
        const ex = makeCustomExercise({
          name: name.value,
          muscle: muscle.value,
          equipment: equip.value,
          fields: ['weight', 'reps', 'time', 'distance'].filter((f) => chosen.has(f)),
        });
        await store.addCustomExercise(ex);
        close();
        toast(`“${ex.name}” created`);
        if (onPick) onPick(ex);
      },
    }),
  });

  setTimeout(() => name.focus(), 120);
}
