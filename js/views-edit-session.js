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
import { minisOf, miniLabel, dropOrphanGroups } from './set-types.js';
import {
  setChildren, el, icon, iconBtn, toast, screenShell, emptyState, stepper,
  confirmSheet, fmtDateLong, exerciseLabel,
} from './ui.js';
import { openExercisePicker } from './views-workouts.js';
import { photoField } from './photo.js';

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
      // The drops have to be copied too. A shallow `{...s}` carries the SAME
      // drops array through, so editing a drop here would have written straight
      // into the stored record before Save was ever pressed.
      sets: (e.sets || []).map((s) => ({
        ...s,
        ...(minisOf(s).length ? { minis: minisOf(s).map((d) => ({ ...d })) } : {}),
      })),
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

  const locationInput = el('input', {
    class: 'input', type: 'text', value: draft.location || '', maxlength: '80',
    placeholder: 'Nowhere recorded',
    'aria-label': 'Where this workout happened',
    onInput: (e) => { draft.location = e.target.value; },
  });

  /* The session's description (social-plan §13 Step 2) — written in the runner
   * during the workout, fixable here afterwards. A textarea because it holds up
   * to 280 characters and a one-line box scrolls sideways over what you wrote.
   * ⚠️ `draft.note`, NOT `entry.notes` — that one is the per-exercise coaching
   * note and is edited on the workout, not on the record of doing it. */
  const noteInput = el('textarea', {
    class: 'input', rows: '3', maxlength: '280',
    placeholder: 'Nothing written',
    'aria-label': 'How this workout went',
    onInput: (e) => { draft.note = e.target.value; },
  });
  noteInput.value = draft.note || '';

  /* 🆕 THE WORKOUT'S PHOTO (2026-09-25). `photoChange` stays undefined while
   * untouched, becomes null on Remove and `{url, w, h}` on Add/Replace; Save
   * acts on it. The stored picture is fetched after the screen is drawn. */
  let photoChange;
  const photoInput = photoField({
    loadInitial: session.photo ? () => store.photoFor(session.id) : null,
    onChange: (next) => { photoChange = next; },
    onError: (msg) => toast(msg),
  });
  photoInput.append(el('div', { class: 'field-help', text:
    'Optional. Whoever can see this workout sees the photo.' }));

  /* 🆕 THE WORKOUT'S LENGTH, FIXABLE AFTER SAVING (2026-09-24, review picks).
   * The same minutes box the save screen has, and the same rule: Save writes
   * `finishedAt = startedAt + minutes`, clamped 1–600. Untouched, the stored
   * finishedAt is left exactly as it was. No startedAt (old rows), no box —
   * there is nothing to count the minutes from. */
  let durationMin = null;
  const startMs = Date.parse(session.startedAt);
  const storedMin = Math.round((Date.parse(session.finishedAt) - startMs) / 60000);
  const durBox = Number.isFinite(startMs) ? el('input', {
    class: 'input edit-dur', type: 'number', inputmode: 'numeric',
    min: '1', max: '600', step: '1',
    'aria-label': 'Workout length in minutes',
    onInput: (e) => {
      const n = Math.round(Number(e.target.value));
      if (Number.isFinite(n) && n > 600) e.target.value = '600';
      durationMin = Number.isFinite(n) && n > 0 ? Math.min(600, n) : null;
    },
  }) : null;
  if (durBox && storedMin >= 1) durBox.value = String(storedMin);

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
      // One editable block of steppers, used for a set and for each of its
      // drops. A drop is the same numbers with a different label — writing it
      // twice is how the two drift apart.
      const numberBlock = (obj, { label, onDelete, drop }) => el('div',
        { class: 'edit-set' + (drop ? ' is-drop' : '') },
        el('div', { class: 'edit-set-head' },
          el('span', { class: 'edit-set-num', text: label }),
          onDelete ? iconBtn('trash', `Delete ${label}`, onDelete, 'set-del') : null,
        ),
        el('div', { class: 'steppers' },
          ...fields.map((f) => stepper({
            field: f,
            value: obj[f],
            // Editing a record shows the same plate list the runner did —
            // the number is the same number, and only one of the two screens
            // explaining it would be the drift this label exists to avoid.
            exercise: ex,
            suffix: f === 'weight' && loadType ? LOAD_LABEL[loadType] : null,
            onChange: (v) => { obj[f] = v; },
          }).node),
        ),
      );

      const setRows = entry.sets.flatMap((set, si) => [
        numberBlock(set, {
          label: `Set ${si + 1}`,
          onDelete: entry.sets.length > 1
            ? () => { entry.sets.splice(si, 1); renderList(); }
            : null,
        }),
        // Drops are editable here too. They were invisible on this screen at
        // first, which is worse than not supporting them: someone opening a
        // recorded drop set would have seen half of what they did and assumed
        // the rest had been lost.
        ...minisOf(set).map((d, di) => numberBlock(d, {
          drop: true,
          label: miniLabel(entry.setType, di + 1),
          onDelete: () => {
            set.minis.splice(di, 1);
            if (!set.minis.length) delete set.minis;
            renderList();
          },
        })),
      ]);

      return el('div', { class: 'card edit-ex' },
        el('div', { class: 'day-head' },
          el('div', { style: 'flex:1;min-width:0' },
            exerciseLabel({ exercise: exMap.get(entry.exerciseId), name: entry.exerciseName,
              tag: 'div', className: 'detail-ex-name' }),
            entry.group != null || entry.setType
              ? el('div', { class: 'row-sub', text: [
                  entry.group != null ? 'part of a superset' : null,
                  entry.setType ? miniLabel(entry.setType).toLowerCase() + 's' : null,
                ].filter(Boolean).join(' · ') })
              : null,
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
    // ⚠️ This rebuilds each entry field by field, so anything not named here is
    // lost on every save. `group` and `setType` describe how the workout was
    // actually performed; dropping them would quietly flatten a superset into
    // two ordinary exercises the first time somebody fixed a typo in it.
    const hasNumbers = (s, fields) => fields.some((f) => Number(s[f]) > 0);

    const entries = draft.entries
      .map((e) => {
        const ex = exMap.get(e.exerciseId);
        const fields = ex ? ex.fields : ['weight', 'reps'];
        return {
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          ...(e.group == null ? {} : { group: e.group }),
          ...(e.setType ? { setType: e.setType } : {}),
          // Warm-ups (2026-09-23) are not edited here, only carried through, so
          // fixing a typo in a working set never deletes them.
          ...(Array.isArray(e.warmups) && e.warmups.length ? { warmups: e.warmups } : {}),
          sets: e.sets
            .filter((s) => hasNumbers(s, fields) || minisOf(s).some((d) => hasNumbers(d, fields)))
            .map((s) => {
              const kept = minisOf(s).filter((d) => hasNumbers(d, fields));
              const out = { ...s };
              if (kept.length) out.minis = kept; else delete out.minis;
              delete out.drops;   // legacy key, never written any more
              return out;
            }),
        };
      })
      .filter((e) => e.sets.length);

    // Removing one half of a recorded superset must not leave the survivor
    // claiming to still be in one — same trap as the session runner's finish().
    const cleaned = dropOrphanGroups(entries);

    if (!entries.length) {
      toast('Every set is empty — enter at least one number');
      return;
    }

    const row = {
      ...draft,
      workoutName: (draft.workoutName || '').trim() || 'Workout',
      // `cleaned`, not `entries` — it was worked out above and then not saved,
      // so a half-removed superset kept its bracket (review, 2026-09-24).
      entries: cleaned,
    };
    // Absent rather than '' when cleared — the same one-case contract the
    // runner and the projection keep for this key.
    const loc = String(row.location || '').trim().slice(0, 80);
    if (loc) row.location = loc; else delete row.location;
    // The description keeps the same contract, at the cap the runner types to.
    const note = String(row.note || '').trim().slice(0, 280);
    if (note) row.note = note; else delete row.note;
    if (durationMin !== null) row.finishedAt = new Date(startMs + durationMin * 60000).toISOString();
    // The row says whether there is a photo, and its shape; the picture has its
    // own doc. A NEW picture is written first, so the row never promises one
    // that failed to land; a removed one is deleted after the row stops
    // mentioning it.
    if (photoChange) row.photo = { w: photoChange.w, h: photoChange.h };
    else if (photoChange === null) delete row.photo;
    /* ⚠️ GUARDED, the runner's reason (its finish() note): unguarded, a full
     * storage made the promise reject into nothing, and Save changes did
     * nothing at all (review, 2026-09-24). Disabled while in flight so a
     * second tap is not a second write; the form keeps every edit on failure. */
    saveBtn.disabled = true;
    try {
      if (photoChange) await store.savePhoto(row.id, photoChange);
      await store.saveSession(row);
      if (photoChange === null && session.photo) await store.deletePhoto(row.id).catch(() => {});
    } catch (err) {
      toast(`Not saved. ${(err && err.message) || 'Could not save this record.'}`);
      return;
    } finally {
      saveBtn.disabled = false;
    }
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

  const saveBtn = el('button', { class: 'btn primary block', onClick: save }, 'Save changes');

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
      durBox
        ? el('div', { class: 'field' },
          el('label', { text: 'Duration' }),
          el('div', { class: 'edit-dur-row' }, durBox, el('span', { class: 'edit-dur-unit', text: 'min' })),
        )
        : null,
      el('div', { class: 'field' },
        el('label', { text: 'Location' }),
        locationInput,
        el('div', { class: 'field-help', text:
          'Optional, and whatever you type is the whole location — the app never reads GPS. '
          + 'Shown to friends you share your workouts with.' }),
      ),
      el('div', { class: 'field' },
        el('label', { text: 'Description' }),
        noteInput,
        el('div', { class: 'field-help', text:
          'Optional — a line about how this workout went. '
          + 'Shown to friends you share your workouts with.' }),
      ),
      photoInput,
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
    bottom: saveBtn,
  });
}
