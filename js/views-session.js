// The in-workout recording flow, plus the benchmark form.

import { store, todayISO } from './store.js';
import { LOAD_LABEL } from './exercises.js';
import {
  setChildren, el, icon, iconBtn, toast, screenShell, emptyState, stepper,
  fmtSet, confirmSheet, fmtDateLong,
} from './ui.js';
import { openExercisePicker } from './views-workouts.js';
import { DROP, MYO, isNested, stepsFor, minisOf, plannedMinis, miniLabel } from './set-types.js';

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

  const settings = await store.getSettings();

  // A draft only resumes on the same day. Yesterday's abandoned session should not
  // silently reappear and get saved with today's date.
  //
  // That check is against startedOn — the day the draft was CREATED — and not
  // against `date`, which is the day the session is recorded for and which the
  // user can move. Comparing `date` would mean back-dating a workout threw its
  // own draft away the moment you switched apps. `date` is the fallback for
  // drafts written before startedOn existed.
  const rawDraft = loadDraft();
  const existingDraft = rawDraft && rawDraft.workoutId === workout.id
    && (rawDraft.startedOn || rawDraft.date) === todayISO() ? rawDraft : null;
  if (rawDraft && !existingDraft) clearDraft();

  let state;

  if (existingDraft) {
    state = existingDraft;
  } else {
    state = {
      workoutId: workout.id,
      workoutName: workout.name,
      // The day this is recorded FOR. Defaults to today and is editable, for
      // the workout you did yesterday and forgot to log.
      date: todayISO(),
      // The day it was STARTED. Never edited — it is what decides whether a
      // draft is still today's.
      startedOn: todayISO(),
      startedAt: new Date().toISOString(),
      // Copied from the template at the moment the session starts, not read
      // back from it later: re-flagging a workout months from now must not
      // retroactively turn old sessions into benchmarks.
      isBenchmark: Boolean(workout.isBenchmark),
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
        // Copied from the plan at the moment the session starts, like
        // isBenchmark above and for the same reason: editing the workout
        // template next month must not reshape a session already recorded.
        group: item.group == null ? null : item.group,
        setType: isNested(item.setType) ? item.setType : null,
        plannedMinis: plannedMinis(item),
        sets,
        active: 0,
        activeDrop: null,
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

  /**
   * The walk.
   *
   * A solo exercise is one step, exactly as it always was. A superset is one
   * step PER (round, member) — A set 1, B set 1, rest, A set 2, B set 2 — which
   * is what a superset is. All of A and then all of B is not a superset, it is
   * two exercises in a row.
   *
   * Derived from the ENTRIES' live set counts rather than from the workout
   * plan, so adding or deleting a set mid-session reshapes the walk instead of
   * leaving it pointing at rounds that no longer exist.
   */
  function steps() {
    return stepsFor(state.entries.map((e) => ({ sets: e.sets.length, group: e.group })));
  }

  function currentStep() {
    const all = steps();
    if (!all.length) return null;
    state.index = Math.max(0, Math.min(state.index, all.length - 1));
    return all[state.index];
  }

  // Moving between steps re-points the steppers at the round you are on. Inside
  // a step you can still tap any set to fix a typo from round one.
  function goToStep(i) {
    const all = steps();
    state.index = Math.max(0, Math.min(i, all.length - 1));
    const step = all[state.index];
    if (step) {
      const entry = state.entries[step.entryIndex];
      if (entry) {
        entry.active = step.round == null
          ? Math.min(entry.active || 0, entry.sets.length - 1)
          : Math.min(step.round, entry.sets.length - 1);
        entry.activeDrop = null;
      }
    }
    saveDraft(state);
    renderAll();
  }

  function renderProgress() {
    const all = steps();
    setChildren(progress,
      ...all.map((s, i) =>
        el('span', {
          class: [
            i < state.index ? 'done' : i === state.index ? 'current' : '',
            // A superset's steps are marked, so the dots read as the shape of
            // the workout rather than as an undifferentiated row.
            s.group == null ? '' : 'grouped',
          ].filter(Boolean).join(' '),
        })),
    );
  }

  function renderFooter() {
    const all = steps();
    const step = all[state.index];
    const next = all[state.index + 1];
    const isLast = state.index === all.length - 1;

    // The label has to say what actually happens next, because mid-superset
    // "Next exercise" is both true and useless — the thing you need to know is
    // that you do not rest first.
    let label = 'Next exercise';
    if (next) {
      if (step && step.group != null && next.group === step.group && next.round === step.round) {
        label = 'Straight into ' + state.entries[next.entryIndex].exerciseName;
      } else if (step && step.group != null && next.group === step.group) {
        label = `Round ${next.round + 1} of ${next.rounds}`;
      }
    }

    setChildren(footer,
      el('button', {
        class: 'nav-arrow', 'aria-label': 'Previous',
        disabled: state.index === 0,
        onClick: () => goToStep(state.index - 1),
      }, icon('left')),
      isLast
        ? el('button', { class: 'btn good', onClick: finish }, icon('check'), 'Finish workout')
        : el('button', {
            class: 'btn primary' + (label === 'Next exercise' ? '' : ' is-linked'),
            onClick: () => goToStep(state.index + 1),
          }, label, icon('right')),
    );
  }

  function renderPane() {
    const step = currentStep();
    if (!step) return;
    const entry = state.entries[step.entryIndex];
    const ex = exMap.get(entry.exerciseId);
    const nested = isNested(entry.setType);

    if (entry.active >= entry.sets.length) entry.active = entry.sets.length - 1;
    const activeSet = entry.sets[entry.active] || entry.sets[0];
    // What the steppers are pointed at: the set itself, or one of its drops.
    const minis = minisOf(activeSet);
    if (entry.activeDrop != null && entry.activeDrop >= minis.length) entry.activeDrop = null;
    const target = entry.activeDrop == null ? activeSet : minis[entry.activeDrop];

    const setList = el('div', { class: 'set-list' });

    function select(i, dropIndex) {
      entry.active = i;
      entry.activeDrop = dropIndex;
      saveDraft(state);
      renderPane();
    }

    function renderSets() {
      const rows = [];
      entry.sets.forEach((s, i) => {
        const isHere = i === entry.active;
        rows.push(el('div', { class: 'set-item' + (isHere && entry.activeDrop == null ? ' active' : '') },
          el('button', {
            class: 'set-num', text: String(i + 1), 'aria-label': `Edit set ${i + 1}`,
            onClick: () => select(i, null),
          }),
          el('div', { class: 'set-vals', text: fmtSet(s, entry.fields, entry.loadType) }),
          entry.sets.length > 1
            ? el('button', {
                class: 'set-del', 'aria-label': `Delete set ${i + 1}`,
                onClick: () => {
                  entry.sets.splice(i, 1);
                  entry.active = Math.min(entry.active, entry.sets.length - 1);
                  entry.activeDrop = null;
                  saveDraft(state);
                  renderAll();
                },
              }, icon('trash'))
            : null,
        ));

        // Drops hang UNDER their set and are indented, because that is what they
        // are — the same set continued at a lower weight. They are deliberately
        // not numbered as sets: one drop set is one hard set (progress.md §6),
        // and numbering them 1, 2, 3 would teach the opposite.
        minisOf(s).forEach((d, di) => {
          rows.push(el('div', { class: 'set-item set-drop' + (isHere && entry.activeDrop === di ? ' active' : '') },
            el('button', {
              class: 'set-num drop-num', text: '↳',
              'aria-label': `Edit ${miniLabel(entry.setType, di + 1)} of set ${i + 1}`,
              onClick: () => select(i, di),
            }),
            el('div', { class: 'set-vals', text: fmtSet(d, entry.fields, entry.loadType) }),
            el('button', {
              class: 'set-del', 'aria-label': `Delete ${miniLabel(entry.setType, di + 1)}`,
              onClick: () => {
                s.minis.splice(di, 1);
                if (!s.minis.length) delete s.minis;
                entry.activeDrop = null;
                saveDraft(state);
                renderPane();
              },
            }, icon('trash')),
          ));
        });
      });
      setChildren(setList, ...rows);
    }
    renderSets();

    const steppers = entry.fields.map((f) =>
      stepper({
        field: f,
        value: target[f],
        suffix: f === 'weight' && entry.loadType ? LOAD_LABEL[entry.loadType] : null,
        onChange: (v) => {
          target[f] = v;
          saveDraft(state);
          renderSets();
          // Recording a number IS finishing a set, so that is when rest starts.
          // No extra button to remember to press mid-workout.
          //
          // ⚠️ Two exceptions, and they are the whole point of set types.
          // Inside a superset, rest belongs after the LAST exercise of the
          // round — a timer that started between them would be telling you to
          // do the opposite of what a superset is. And on a drop set, the top
          // set is not the end of the set: you strip the weight and carry on,
          // so rest waits for a drop.
          const midGroup = !step.restsAfter;
          const midNestedSet = nested && entry.activeDrop == null;
          if (!midGroup && !midNestedSet) startRest();
        },
      }).node);

    const miniCount = minis.length;
    const wantsMinis = nested ? entry.plannedMinis : 0;

    setChildren(pane,
      // The superset banner is the first thing on the screen, above the
      // exercise name, because "do not rest after this one" changes what you do
      // with your next thirty seconds and the exercise name does not.
      step.group == null ? null : el('div', { class: 'group-banner' },
        el('div', { class: 'group-banner-head' },
          el('span', { class: 'group-kind', text: step.groupLabel }),
          el('span', { class: 'group-round', text: `Round ${step.round + 1} of ${step.rounds}` }),
        ),
        el('div', { class: 'group-members' },
          ...step.members.map((mi, pos) => el('button', {
            class: 'group-member' + (mi === step.entryIndex ? ' is-current' : ''),
            onClick: () => {
              const all = steps();
              const to = all.findIndex((s) => s.group === step.group && s.round === step.round && s.entryIndex === mi);
              if (to >= 0) goToStep(to);
            },
          }, (pos ? '→ ' : '') + state.entries[mi].exerciseName)),
        ),
        el('div', { class: 'group-hint', text: step.restsAfter
          ? 'Last one in the round — rest after this.'
          : 'Go straight into the next one. No rest.' }),
      ),

      // The per-side / total distinction is carried by the stepper's own label,
      // so it isn't repeated here.
      el('div', { class: 'session-head' },
        el('h2', { class: 'session-ex-name', text: entry.exerciseName }),
        el('div', { class: 'session-ex-meta' },
          `${ex ? ex.muscle + ' · ' + ex.equipment + ' · ' : ''}Exercise ${step.entryIndex + 1} of ${state.entries.length}`,
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

      el('div', { class: 'section-label', text: entry.activeDrop == null
        ? `Set ${entry.active + 1} of ${entry.sets.length}`
        : `Set ${entry.active + 1} · ${miniLabel(entry.setType, entry.activeDrop + 1).toLowerCase()}` }),
      el('div', { class: 'steppers' }, steppers),

      // A nested set says what to do next in the one place you are looking, and
      // the button IS the instruction rather than the name of a technique.
      // "Strip the weight" and "Rest 10–15 seconds" are things you can act on;
      // "Add drop" and "Add myo-rep" assume you already know what those are,
      // which is the assumption D8 exists to refuse.
      nested
        ? el('div', { class: 'drop-row' },
            el('button', {
              class: 'btn block drop-add',
              onClick: () => {
                if (!Array.isArray(activeSet.minis)) activeSet.minis = [];
                // A myo-rep match set is the SAME weight after a short rest, so
                // carrying the numbers forward is right. A drop is lighter and
                // the app cannot know by how much, so it carries them forward
                // too and waits to be corrected — a guessed weight would be
                // worse than an obvious one.
                const from = minis.length ? minis[minis.length - 1] : activeSet;
                activeSet.minis.push(pickFields(from, entry.fields));
                entry.activeDrop = activeSet.minis.length - 1;
                saveDraft(state);
                renderPane();
              },
            }, icon(entry.setType === MYO ? 'plus' : 'down', 16),
              entry.setType === MYO
                ? (miniCount ? 'Another mini-set' : 'Rest 10–15 seconds — add a mini-set')
                : (miniCount ? 'Drop again' : 'Strip the weight — add a drop')),
            el('div', { class: 'field-help', text: miniCount >= wantsMinis && wantsMinis
              ? `${miniCount} ${miniLabel(entry.setType).toLowerCase()}${miniCount === 1 ? '' : 's'} recorded — this counts as one hard set.`
              : `Planned: ${wantsMinis} ${miniLabel(entry.setType).toLowerCase()}${wantsMinis === 1 ? '' : 's'} after each set. `
                + 'The whole thing counts as one hard set.' }),
          )
        : null,

      // The add button rides on the "Sets" heading rather than sitting under the
      // list. Full-width and below, it was as loud as the sets themselves and it
      // sat directly on top of them once the list outgrew the pane.
      el('div', { class: 'sets-head' },
        el('div', { class: 'section-label', text: 'Sets' }),
        el('button', {
          class: 'add-set', 'aria-label': step.group == null ? 'Add another set' : 'Add another round',
          onClick: () => {
            // Inside a superset a set is a ROUND: adding one to a single member
            // would leave the block ragged and the walk would skip it.
            const targets = step.group == null ? [step.entryIndex] : step.members;
            for (const mi of targets) {
              const e = state.entries[mi];
              e.sets.push(pickFields(e.sets[e.sets.length - 1] || {}, e.fields));
            }
            entry.active = entry.sets.length - 1;
            entry.activeDrop = null;
            saveDraft(state);
            renderAll();
          },
        }, icon('plus', 15), step.group == null ? 'Add set' : 'Add round'),
      ),
      setList,
    );

    pane.scrollTop = 0;
  }

  function renderAll() {
    renderProgress();
    renderPane();
    renderFooter();
  }

  async function finish() {
    // ⚠️ Filter on the exercise's OWN FIELDS, not on Object.values(set). A set
    // now carries a `drops` array, and `Number([{…}])` is NaN — so the old
    // blanket check happened to work, but only by accident, and it would have
    // thrown away a set whose numbers were all in its drops.
    const hasNumbers = (s, fields) => fields.some((f) => Number(s[f]) > 0);

    const entries = state.entries
      .map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        // Carried so the calendar and the edit screen can show a recorded
        // session the way it was actually performed, not just as a flat list.
        ...(e.group == null ? {} : { group: e.group }),
        ...(e.setType ? { setType: e.setType } : {}),
        sets: e.sets
          .filter((s) => hasNumbers(s, e.fields) || minisOf(s).some((d) => hasNumbers(d, e.fields)))
          .map((s) => {
            const kept = minisOf(s).filter((d) => hasNumbers(d, e.fields));
            const out = { ...s };
            // An empty `minis: []` is noise in storage and reads as "this was a
            // drop set with no drops", which is a different claim from "this
            // was a straight set".
            if (kept.length) out.minis = kept; else delete out.minis;
            delete out.drops;   // legacy key, never written any more
            return out;
          }),
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
      isBenchmark: Boolean(state.isBenchmark),
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

  /* ---- rest timer ---- */
  //
  // Counts UP from the last set rather than down from a target, because the
  // count-up is true without being configured: open the app, see how long you
  // have been standing there. A target is optional on top of it, and only then
  // does the bar have an opinion about whether the rest is over.
  //
  // Time is read from a TIMESTAMP on every tick, never accumulated. Mobile
  // throttles timers in a backgrounded tab, so a counter that added a second
  // per tick would silently run slow — which is exactly what a rest timer is
  // for, and exactly when the app is not in front of you.
  const REST_TARGETS = [0, 60, 90, 120, 180];
  let restTarget = REST_TARGETS.includes(Number(settings.restTarget))
    ? Number(settings.restTarget) : 0;

  const restClock = el('span', { class: 'rest-clock mono' });
  const restLabel = el('span', { class: 'rest-label' });
  const restChip = el('button', {
    class: 'chip rest-target',
    onClick: () => {
      restTarget = REST_TARGETS[(REST_TARGETS.indexOf(restTarget) + 1) % REST_TARGETS.length];
      store.saveSettings({ restTarget });
      paintRest();
    },
  });
  const restBar = el('div', { class: 'rest-bar' },
    el('button', {
      class: 'rest-reset', 'aria-label': 'Restart the rest timer',
      onClick: () => startRest(),
    }, restClock),
    restLabel,
    restChip,
  );

  function restSeconds() {
    if (!state.restStartedAt) return null;
    return Math.max(0, Math.floor((Date.now() - state.restStartedAt) / 1000));
  }

  function paintRest() {
    const s = restSeconds();
    restChip.textContent = restTarget ? `${restTarget}s` : 'no target';
    restChip.setAttribute('aria-pressed', String(Boolean(restTarget)));

    if (s === null) {
      restClock.textContent = '--:--';
      restLabel.textContent = 'Rest starts when you log a set';
      restBar.classList.remove('is-done');
      return;
    }
    restClock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const done = restTarget > 0 && s >= restTarget;
    restBar.classList.toggle('is-done', done);
    restLabel.textContent = done ? 'Rest done' : 'Resting';
  }

  let restTick = null;

  // Kept separate from startRest on purpose: resuming a draft must pick the
  // clock back UP, not restart it. Folding the two together meant walking back
  // into a workout reset the rest you had already taken.
  function ensureTicking() {
    paintRest();
    if (restTick) return;
    restTick = setInterval(() => {
      // Nothing tears this view down explicitly, so the interval has to notice
      // it has been detached or it outlives the screen for the whole session.
      if (!restBar.isConnected) { clearInterval(restTick); restTick = null; return; }
      paintRest();
    }, 1000);
  }

  function startRest() {
    state.restStartedAt = Date.now();
    saveDraft(state);
    ensureTicking();
  }

  if (state.restStartedAt) ensureTicking();
  paintRest();

  /* ---- which day this is recorded for ---- */
  // Defaults to today, because that is what it is nearly every time. It sits in
  // the header rather than behind the Finish button so that a workout being
  // logged for another day says so the whole way through, instead of springing
  // it on you at the end.
  const dateInput = el('input', {
    class: 'session-date', type: 'date', value: state.date,
    // No future dates: this exists for the session you forgot to log, and a
    // workout you have not done yet is not a thing to record.
    max: todayISO(),
    'aria-label': 'Day this workout is recorded for',
    onChange: (e) => {
      state.date = e.target.value || todayISO();
      saveDraft(state);
      renderDate();
    },
  });
  const dateNote = el('span', { class: 'session-date-note' });

  function renderDate() {
    const isToday = state.date === todayISO();
    dateInput.value = state.date;
    dateInput.classList.toggle('is-moved', !isToday);
    dateNote.textContent = isToday ? '' : 'not today';
    dateNote.hidden = isToday;
  }
  renderDate();

  renderAll();

  return el('div', { class: 'screen no-nav' },
    el('header', { class: 'topbar' },
      iconBtn('x', 'Leave workout', quit),
      el('div', { style: 'flex:1;min-width:0' },
        el('h1', { text: workout.name }),
        el('div', { class: 'topbar-sub session-sub' },
          el('span', { text: existingDraft ? 'Resumed' : 'In progress' }),
          el('span', { class: 'session-sub-dot', text: '·' }),
          dateInput,
          dateNote,
        ),
      ),
    ),
    progress,
    pane,
    restBar,
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
    setChildren(stepWrap,
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
