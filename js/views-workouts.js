// Home, workout list, workout builder, exercise picker.

import { store, DEFAULT_SETS, todayISO } from './store.js';
import { suggestNext, describeSuggestion } from './next-workout.js';
import { MUSCLE_GROUPS, EQUIPMENT, makeCustomExercise, LOAD_HELP } from './exercises.js';
import {
  el, icon, iconBtn, chevron, toast, openSheet, confirmSheet, screenShell,
  emptyState, relativeDay, miniStepper, loadBadge,
} from './ui.js';

const go = (hash) => { location.hash = hash; };

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const totalSets = (w) => w.exercises.reduce((n, e) => n + e.sets, 0);

/* ================================================================== *
 * Home
 * ================================================================== */

export async function HomeView() {
  const [systems, workouts, sessions] = await Promise.all([
    store.getSystems(), store.getWorkouts(), store.getSessions(),
  ]);
  const recent = sessions.slice(0, 20);

  // Where you are in your own rotation (docs/vision.md §1.2, first half).
  // This is a LOOKUP, not advice: the order came out of the user's own system.
  // It never refuses and never scolds — every other workout is still one tap
  // away on "Choose another workout", and the caption always says what it read.
  const next = suggestNext({ systems, workouts, sessions, today: todayISO() });

  const top = next
    ? [
        el('button', {
          class: 'btn primary lg block',
          onClick: () => go('#/session/' + next.workout.id),
        }, icon('play'), next.workout.name),

        el('div', { class: 'field-help', text: describeSuggestion(next) }),

        // Not "Start a workout" any more — the button above already starts one,
        // so this one has to say what is DIFFERENT about it.
        el('button', { class: 'btn block', onClick: () => go('#/start') },
          icon('list'), 'Choose another workout'),

        el('button', { class: 'btn block', onClick: () => go('#/benchmark') },
          icon('flag'), 'Record a benchmark'),
      ]
    : [
        el('button', {
          class: 'btn primary lg block',
          onClick: () => (workouts.length ? go('#/start') : go('#/workouts')),
        }, icon('play'), workouts.length ? 'Start a workout' : 'Create your first workout'),

        el('button', { class: 'btn block', onClick: () => go('#/benchmark') },
          icon('flag'), 'Record a benchmark'),
      ];

  const scroll = [
    el('div', { class: 'section-label', text: 'Recent activity' }),
    recent.length
      ? el('div', { class: 'list' }, recent.map(sessionRow))
      : emptyState('Nothing recorded yet',
          'Once you finish a workout or log a benchmark, it will show up here and on your calendar.'),
  ];

  return screenShell({
    profile: true,
    title: 'Fitness Tracker',
    sub: workouts.length ? `${plural(workouts.length, 'workout')} saved` : 'Get started below',
    actions: [iconBtn('sliders', 'Settings', () => go('#/settings'))],
    top,
    scroll,
  });
}

function sessionRow(s) {
  const count = (s.entries || []).filter((e) => (e.sets || []).length).length;
  const sets = (s.entries || []).reduce((n, e) => n + (e.sets || []).length, 0);
  return el('button', { class: 'row', onClick: () => go('#/day/' + s.date) },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: s.workoutName || 'Workout' }),
      el('div', { class: 'row-sub', text: `${relativeDay(s.date)} · ${plural(count, 'exercise')} · ${plural(sets, 'set')}` }),
    ),
    chevron(),
  );
}

/* ================================================================== *
 * Pick which workout to start
 * ================================================================== */

export async function StartPickerView() {
  const [systems, workouts] = await Promise.all([store.getSystems(), store.getWorkouts()]);

  // GROUPED, not nested. Making someone pick a system and then a workout would
  // add a tap to the one screen that is used mid-gym, and most people have one
  // system anyway. The heading is dropped when there is only one, because a
  // sole heading is decoration.
  const groups = systems
    .map((sys) => ({ sys, items: workouts.filter((w) => w.systemId === sys.id) }))
    .filter((g) => g.items.length);

  const row = (w) => el('button', { class: 'row', onClick: () => go('#/session/' + w.id) },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: w.name }),
      el('div', { class: 'row-sub', text: `${plural(w.exercises.length, 'exercise')} · ${plural(totalSets(w), 'set')}` }),
    ),
    chevron(),
  );

  const scroll = groups.length
    ? groups.flatMap((g) => (groups.length > 1
        ? [el('div', { class: 'section-label', text: g.sys.name }), el('div', { class: 'list' }, g.items.map(row))]
        : [el('div', { class: 'list' }, g.items.map(row))]))
    : emptyState('No workouts yet', 'Build a workout first, then you can run it here.',
        el('button', { class: 'btn primary', text: 'Build a workout', onClick: () => go('#/workouts') }));

  return screenShell({ title: 'Start a workout', back: () => go('#/home'), scroll });
}

/* ================================================================== *
 * Workout systems
 * ================================================================== */

// A SYSTEM is a programme — a named group of workouts. "Push Pull Legs" holding
// a Push, a Pull and a Legs day. Tim, 2026-08-17: he wants several side by side,
// and later to be able to load somebody else's (docs/vision.md §1.3).
//
// The top-level tab lists systems now, not workouts. Everything that used to be
// reachable in one tap still is, because a system with one workout shows that
// workout's name in its subtitle and the row goes straight into the system.
export async function WorkoutsView() {
  const [systems, workouts] = await Promise.all([store.getSystems(), store.getWorkouts()]);
  const countIn = (id) => workouts.filter((w) => w.systemId === id).length;

  return screenShell({
    profile: true,
    title: 'Workouts',
    sub: systems.length ? plural(systems.length, 'system') : null,
    top: [
      el('button', { class: 'btn primary block', onClick: () => go('#/system/new') },
        icon('plus'), 'New system'),
      // Browsing ready-made systems is the low-effort path and belongs beside
      // the high-effort one, not buried in an empty state where someone who
      // already has a system would never find it.
      el('button', { class: 'btn block', onClick: () => go('#/explore') },
        icon('search'), 'Explore ready-made systems'),
    ],
    scroll: systems.length
      ? el('div', { class: 'list' }, systems.map((sys) => {
          const n = countIn(sys.id);
          const names = workouts.filter((w) => w.systemId === sys.id).map((w) => w.name);
          return el('button', { class: 'row', onClick: () => go('#/system/' + sys.id) },
            el('div', { class: 'row-main' },
              el('div', { class: 'row-title', text: sys.name }),
              el('div', { class: 'row-sub', text: n
                // The workout names ARE the useful subtitle — "3 workouts" says
                // nothing you could not guess, "Push · Pull · Legs" tells you
                // what the programme is.
                ? names.slice(0, 4).join(' · ') + (names.length > 4 ? ' · …' : '')
                : 'No workouts yet' }),
            ),
            chevron(),
          );
        }))
      : emptyState('No systems yet',
          'A system is a programme — a named group of workouts. Push Pull Legs, Upper/Lower, '
          + 'whatever you follow. Build one, or start from a ready-made one.'),
  });
}

/* ================================================================== *
 * Explore ready-made systems
 * ================================================================== */

export async function ExploreView() {
  const [{ PRESET_SYSTEMS, presetSetCount }, added] = await Promise.all([
    import('./preset-systems.js'), store.addedPresetIds(),
  ]);

  return screenShell({
    title: 'Ready-made systems',
    back: () => go('#/workouts'),
    scroll: [
      el('div', { class: 'field-help', text:
        'Pick one and it is copied into your systems. From then on it is yours — rename it, '
        + 'change the exercises, delete what you do not do.' }),
      el('div', { class: 'list' }, PRESET_SYSTEMS.map((p) =>
        el('button', { class: 'row', onClick: () => go('#/explore/' + p.id) },
          el('div', { class: 'row-main' },
            el('div', { class: 'row-title' },
              p.name,
              added.has(p.id) ? el('span', { class: 'tag', text: 'Added' }) : null,
            ),
            // Whose it is, before anything else — but "follows X's method" and
            // "by X" are different claims and the list has to keep them apart.
            el('div', { class: 'row-sub', text:
              (p.author && p.author !== 'Fitness Tracker' ? `${p.author} · `
                : p.basedOn ? `Follows ${p.basedOn.person} · ` : '')
              + `${p.daysPerWeek} days/week · ~${p.minutes} min · ${p.level}` }),
            el('div', { class: 'row-sub wrap', text: p.summary }),
          ),
          chevron(),
        ))),
      el('div', { class: 'field-help', text:
        `${PRESET_SYSTEMS.length} to choose from, with more to come.` }),
    ],
  });
}

/* ================================================================== *
 * One ready-made system, before you commit to it
 * ================================================================== */

export async function ExploreDetailView(id) {
  const [{ presetById, presetSetCount }, added] = await Promise.all([
    import('./preset-systems.js'), store.addedPresetIds(),
  ]);
  const preset = presetById(id);

  if (!preset) {
    return screenShell({
      title: 'Not found', back: () => go('#/explore'),
      scroll: emptyState('That system no longer exists', 'It may have been renamed or removed.'),
    });
  }

  const alreadyAdded = added.has(preset.id);

  async function add() {
    const { system, skipped } = await store.addPresetSystem(preset);
    toast(skipped ? `Added — ${skipped} exercise(s) skipped` : 'Added to your systems');
    go('#/system/' + system.id);
  }

  return screenShell({
    title: preset.name,
    back: () => go('#/explore'),
    scroll: [
      // NOT "sets a week". These workouts repeat — a 6-day PPL runs its three
      // workouts twice — so the total across the workouts is not a weekly
      // figure, and printing it as one would overstate or understate every
      // programme by a different factor.
      el('div', { class: 'field-help', text:
        `${preset.goal} · ${preset.daysPerWeek} days a week · around ${preset.minutes} minutes a `
        + `session · ${preset.level} · ${presetSetCount(preset)} sets across `
        + `${plural(preset.workouts.length, 'workout')}` }),

      // Who wrote it, always. A system from somewhere else must never look like
      // one the app wrote, and the link out is how someone checks it.
      el('div', { class: 'field-help' },
        'By ', el('b', { text: preset.author || 'Unknown' }),
        preset.sourceName ? ' · ' : '',
        preset.sourceUrl
          ? el('a', { href: preset.sourceUrl, target: '_blank', rel: 'noopener noreferrer',
                      text: preset.sourceName || 'Source' })
          : (preset.sourceName || null),
      ),

      // A system that FOLLOWS someone's published method is not a system BY
      // them, and the two must never render the same way. The byline above
      // stays truthful (it says who chose the exercises); this line is where
      // the credit goes.
      preset.basedOn
        ? el('div', { class: 'field-help' },
            'Follows ', el('b', { text: preset.basedOn.person }), '’s ',
            preset.basedOn.what || 'published method',
            '. The workouts below are not theirs.')
        : null,

      // Loud, not a footnote. Someone reading a programme attributed to a real
      // person has to know whether that person actually wrote what is on screen.
      // The default assumes a video transcription, which is true of exactly one
      // system here — anything else states its own case.
      preset.unofficial
        ? el('div', { class: 'preset-warning' }, el('span', {
            text: preset.warning
              || 'Not official. Transcribed from published write-ups of the free videos, '
                 + 'not from the author or their paid programme. Sets and reps are as reported — '
                 + 'check the source before you trust a number.' }))
        : null,

      preset.notes
        ? el('div', { class: 'preset-notes' },
            // Paragraph breaks in the notes are real paragraphs, not one wall of text.
            ...preset.notes.split(/\n{2,}/).map((para) => el('p', { text: para })))
        : null,

      ...preset.workouts.flatMap((w) => [
        el('div', { class: 'section-label', text: w.name }),
        w.notes ? el('div', { class: 'field-help', text: w.notes }) : null,
        el('div', { class: 'list' }, w.exercises.map((e) =>
          el('div', { class: 'row static' },
            el('div', { class: 'row-main' },
              el('div', { class: 'row-title', text: e.name }),
              e.notes ? el('div', { class: 'row-sub', text: e.notes }) : null,
            ),
            el('div', { class: 'row-meta mono', text: plural(e.sets, 'set') }),
          ))),
      ]),
    ],
    bottom: [
      el('button', {
        class: 'btn primary block',
        text: alreadyAdded ? 'Add another copy' : 'Add to my systems',
        onClick: add,
      }),
      alreadyAdded
        ? el('div', { class: 'field-help', text:
            'You have already added this one. Adding it again makes a second, separate copy.' })
        : null,
    ],
  });
}

/* ================================================================== *
 * One system: its workouts, and its name
 * ================================================================== */

export async function SystemView(id) {
  const isNew = id === 'new';
  const existing = isNew ? null : await store.getSystem(id);

  if (!isNew && !existing) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      scroll: emptyState('That system no longer exists', 'It may have been deleted.'),
    });
  }

  const workouts = isNew ? [] : await store.getWorkouts(id);
  const draft = existing ? { ...existing } : { id: null, name: '', notes: '' };

  const nameInput = el('input', {
    class: 'input', type: 'text', value: draft.name, maxlength: '60',
    placeholder: 'Push Pull Legs, Upper/Lower…',
    onInput: (e) => { draft.name = e.target.value; },
  });
  const notesInput = el('textarea', {
    class: 'input', rows: '2', maxlength: '300',
    placeholder: 'What is this programme for? (optional)',
    onInput: (e) => { draft.notes = e.target.value; },
  });
  notesInput.value = draft.notes || '';

  async function save() {
    if (!draft.name.trim()) { toast('Give your system a name first'); nameInput.focus(); return; }
    const saved = await store.saveSystem({ ...draft, name: draft.name.trim() });
    toast(isNew ? 'System created' : 'System saved');
    // A brand-new system is empty, so land the user back inside it where the
    // "New workout" button is, rather than on the list looking at an empty row.
    go(isNew ? '#/system/' + saved.id : '#/workouts');
  }

  function remove() {
    confirmSheet({
      title: 'Delete this system?',
      message: workouts.length
        ? `${plural(workouts.length, 'workout')} inside it will be deleted too. `
          + 'Workouts you have already recorded stay in your history and on your calendar — '
          + 'only the templates go.'
        : 'It has no workouts in it.',
      onConfirm: async () => { await store.deleteSystem(draft.id); toast('System deleted'); go('#/workouts'); },
    });
  }

  const scroll = isNew
    ? [el('div', { class: 'field-help', text:
        'Name it first, then you can add workouts to it.' })]
    : [
        el('div', { class: 'section-label', text: workouts.length
          ? plural(workouts.length, 'workout') : 'Workouts' }),
        workouts.length
          ? el('div', { class: 'list' }, workouts.map((w) =>
              el('button', { class: 'row', onClick: () => go('#/workout/' + w.id) },
                el('div', { class: 'row-main' },
                  el('div', { class: 'row-title', text: w.name }),
                  el('div', { class: 'row-sub', text:
                    `${plural(w.exercises.length, 'exercise')} · ${plural(totalSets(w), 'set')}`
                    + (w.isBenchmark ? ' · benchmark' : '') }),
                ),
                chevron(),
              )))
          : emptyState('No workouts in this system yet',
              'Add the days this programme is made of — Push, Pull, Legs, or whatever you call them.'),
        el('button', { class: 'btn block', onClick: () => go('#/workout/new/' + draft.id) },
          icon('plus'), 'New workout'),
      ];

  return screenShell({
    title: isNew ? 'New system' : draft.name,
    back: () => go('#/workouts'),
    top: [
      el('div', { class: 'field' }, el('label', { text: 'System name' }), nameInput),
      el('div', { class: 'field' }, el('label', { text: 'Notes' }), notesInput),
    ],
    scroll,
    bottom: [
      el('button', { class: 'btn primary block', text: isNew ? 'Create system' : 'Save changes', onClick: save }),
      isNew ? null : el('button', { class: 'btn danger block', text: 'Delete system', onClick: remove }),
    ],
  });
}

/* ================================================================== *
 * Workout builder
 * ================================================================== */

// Route is `#/workout/<id>` to edit, `#/workout/new/<systemId>` to create — a
// new workout has to know which system it is being added to, and there is no
// sensible way to ask afterwards.
export async function WorkoutBuilderView(param) {
  const [id, newSystemId] = String(param || '').split('/');
  const isNew = id === 'new';
  const exMap = await store.getExerciseMap();
  const existing = isNew ? null : await store.getWorkout(id);

  if (!isNew && !existing) {
    return screenShell({
      title: 'Not found', back: () => go('#/workouts'),
      scroll: emptyState('That workout no longer exists', 'It may have been deleted.'),
    });
  }

  const draft = existing
    ? { ...existing, exercises: existing.exercises.map((e) => ({ ...e })) }
    : { id: null, name: '', exercises: [], systemId: newSystemId || null };

  // Where "back" and "save" return to. A workout is always inside a system, so
  // leaving one should land on that system rather than on the top-level list.
  const home = draft.systemId ? '#/system/' + draft.systemId : '#/workouts';

  const nameInput = el('input', {
    class: 'input', type: 'text', value: draft.name, maxlength: '60',
    placeholder: 'Push, Legs, Upper Body…',
    onInput: (e) => { draft.name = e.target.value; },
  });

  // A benchmark workout turns every exercise it records into a benchmark for
  // that day. Off by default: a benchmark is meant to be a deliberate test, and
  // making every workout one would empty the word of meaning.
  const benchToggle = el('button', {
    class: 'chip', 'aria-pressed': String(Boolean(draft.isBenchmark)),
    text: draft.isBenchmark ? 'Benchmark workout' : 'Normal workout',
    onClick: () => {
      draft.isBenchmark = !draft.isBenchmark;
      benchToggle.setAttribute('aria-pressed', String(draft.isBenchmark));
      benchToggle.textContent = draft.isBenchmark ? 'Benchmark workout' : 'Normal workout';
      benchHelp.textContent = draft.isBenchmark
        ? 'Every exercise you record in this workout is saved as a benchmark for that day — the best set of each.'
        : 'Turn this on for a testing session, where each exercise should count as a benchmark.';
    },
  });
  const benchHelp = el('div', { class: 'field-help', text: draft.isBenchmark
    ? 'Every exercise you record in this workout is saved as a benchmark for that day — the best set of each.'
    : 'Turn this on for a testing session, where each exercise should count as a benchmark.' });

  const listWrap = el('div', { class: 'list' });
  const countLabel = el('div', { class: 'section-label' });

  function renderList() {
    countLabel.textContent = draft.exercises.length
      ? `Exercises · ${plural(totalSets(draft), 'set')} total`
      : 'Exercises';

    listWrap.replaceChildren();

    if (!draft.exercises.length) {
      listWrap.append(emptyState('No exercises yet',
        'Add exercises below. The order here is the order you will see them in during the workout.'));
      return;
    }

    draft.exercises.forEach((item, i) => {
      const ex = exMap.get(item.exerciseId);
      const name = ex ? ex.name : 'Unknown exercise';

      listWrap.append(el('div', { class: 'builder-item' },
        el('div', { class: 'builder-main' },
          el('div', { class: 'row-title', text: name }),
          el('div', { class: 'row-sub', text: ex ? `${ex.muscle} · ${ex.equipment}` : 'Missing from library' }),
        ),
        el('div', { class: 'move-btns' },
          el('button', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onClick: () => move(i, -1) }, icon('up')),
          el('button', { type: 'button', 'aria-label': 'Move down', disabled: i === draft.exercises.length - 1, onClick: () => move(i, 1) }, icon('down')),
        ),
        iconBtn('trash', `Remove ${name}`, () => { draft.exercises.splice(i, 1); renderList(); }),

        el('div', { class: 'builder-controls' },
          el('span', { class: 'builder-control-label', text: 'Sets' }),
          miniStepper({
            value: item.sets, min: 1, max: 20,
            label: 'planned sets',
            onChange: (v) => { item.sets = v; countLabel.textContent = `Exercises · ${plural(totalSets(draft), 'set')} total`; },
          }),
          ex && ex.loadType ? loadBadge(ex.loadType) : null,
        ),

        el('textarea', {
          class: 'builder-note',
          rows: '1',
          maxlength: '200',
          placeholder: 'Notes — cues, seat height, rest, anything',
          value: item.notes || '',
          onInput: (e) => { item.notes = e.target.value; },
        }),
      ));
    });
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= draft.exercises.length) return;
    [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]];
    renderList();
  }

  renderList();

  async function save() {
    if (!draft.name.trim()) { toast('Give your workout a name first'); nameInput.focus(); return; }
    if (!draft.exercises.length) { toast('Add at least one exercise'); return; }
    await store.saveWorkout({ ...draft, name: draft.name.trim() });
    toast(isNew ? 'Workout created' : 'Workout saved');
    go(home);
  }

  function remove() {
    confirmSheet({
      title: 'Delete this workout?',
      message: 'Workouts you have already recorded stay in your history and on your calendar. Only the template is removed.',
      onConfirm: async () => { await store.deleteWorkout(draft.id); toast('Workout deleted'); go(home); },
    });
  }

  return screenShell({
    title: isNew ? 'New workout' : 'Edit workout',
    back: () => go(home),
    top: el('div', { class: 'field' }, el('label', { text: 'Workout name' }), nameInput),
    scroll: [
      el('div', { class: 'field' },
        el('label', { text: 'Kind' }),
        el('div', { class: 'chips' }, benchToggle),
        benchHelp,
      ),
      countLabel,
      listWrap,
      el('button', {
        class: 'btn block',
        onClick: () => openExercisePicker({
          exMap,
          onPick: (ex) => {
            if (draft.exercises.some((e) => e.exerciseId === ex.id)) { toast('Already in this workout'); return false; }
            draft.exercises.push({ exerciseId: ex.id, sets: DEFAULT_SETS, notes: '' });
            renderList();
            return true;
          },
        }),
      }, icon('plus'), 'Add exercise'),
    ],
    bottom: [
      el('button', { class: 'btn primary block', text: isNew ? 'Create workout' : 'Save changes', onClick: save }),
      isNew ? null : el('button', { class: 'btn danger block', text: 'Delete workout', onClick: remove }),
    ],
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
    class: 'input', type: 'search', placeholder: `Search ${all.length} exercises…`,
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
    list = list.slice(0, 150);

    results.replaceChildren();

    if (!list.length) {
      results.append(emptyState('No exercise matches that',
        query ? `Nothing found for “${query}”. You can create it as a custom exercise instead.` : 'Try a different filter.'));
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
          el('div', { class: 'row-sub' },
            `${ex.muscle} · ${ex.equipment}${ex.isCustom ? ' · custom' : ''}`,
          ),
        ),
        ex.loadType ? loadBadge(ex.loadType) : null,
        chevron(),
      );
      results.append(btn);
    });
  }

  render();

  const { close } = openSheet({
    title,
    body: [search, chipRow, results],
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
  let loadType = 'total';

  const help = el('div', { class: 'field-help', text: LOAD_HELP[loadType] });

  const loadField = el('div', { class: 'field' },
    el('label', { text: 'How is the weight counted?' }),
    el('div', { class: 'chips' },
      ['total', 'per_side'].map((lt) =>
        el('button', {
          class: 'chip', 'aria-pressed': String(lt === loadType),
          text: lt === 'total' ? 'Total load' : 'Per side',
          onClick: (e) => {
            loadType = lt;
            e.target.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
            e.target.setAttribute('aria-pressed', 'true');
            help.textContent = LOAD_HELP[loadType];
          },
        })),
    ),
    help,
  );

  function syncLoadVisibility() {
    loadField.style.display = chosen.has('weight') ? '' : 'none';
  }

  const fieldChips = el('div', { class: 'chips' },
    ['weight', 'reps', 'time', 'distance'].map((f) =>
      el('button', {
        class: 'chip',
        'aria-pressed': String(chosen.has(f)),
        text: f[0].toUpperCase() + f.slice(1),
        onClick: (e) => {
          if (chosen.has(f)) chosen.delete(f); else chosen.add(f);
          e.target.setAttribute('aria-pressed', String(chosen.has(f)));
          syncLoadVisibility();
        },
      })),
  );

  syncLoadVisibility();

  const { close } = openSheet({
    title: 'Create custom exercise',
    body: [
      el('div', { class: 'field' }, el('label', { text: 'Name' }), name),
      el('div', { class: 'field' }, el('label', { text: 'Muscle group' }), muscle),
      el('div', { class: 'field' }, el('label', { text: 'Equipment' }), equip),
      el('div', { class: 'field' },
        el('label', { text: 'What do you want to track?' }),
        fieldChips,
        el('div', { class: 'field-help', text: 'These become the steppers you see during a workout.' }),
      ),
      loadField,
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
          loadType,
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
