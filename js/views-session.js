// The in-workout recording flow, plus the benchmark form.

import { store, todayISO, demo, uid } from './store.js';
import { LOAD_LABEL, bodyWeightFractionFor } from './exercises.js';
import { totalResistance } from './e1rm.js';
import {
  setChildren, el, icon, iconBtn, toast, screenShell, emptyState, stepper,
  fmtSet, confirmSheet, fmtDateLong, openSheet,
} from './ui.js';
import { openExercisePicker } from './views-workouts.js';
import {
  DROP, MYO, isNested, stepsFor, minisOf, plannedMinis, miniLabel, dropOrphanGroups,
} from './set-types.js';
import {
  historyFor, lastSessionDate, suggestProgression, applySuggestion,
} from './progression.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };
const DRAFT_KEY = 'ftrack:v1:draftSession';

/**
 * Whole days between two stored YYYY-MM-DD days.
 *
 * ⚠️ Split, never `new Date(iso)`, which reads a bare date as UTC and lands a
 * day early for everybody west of Greenwich — the trap `next-workout.js` and
 * `goals.js` both document.
 *
 * This lives here rather than in progression.js on purpose: that module is
 * required to have no clock, and measuring a gap needs today. The runner does
 * the measuring and hands it across as a plain number.
 */
function daysBetweenDays(fromISO, toISO) {
  const parse = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d).getTime() : null;
  };
  const a = parse(fromISO), b = parse(toISO);
  return a === null || b === null ? null : Math.round((b - a) / 86400000);
}

/* ------------------------------------------------------------------ *
 * Draft persistence — a phone call or an app switch must not lose a workout
 * ------------------------------------------------------------------ */

/**
 * ⚠️ THE DEMO ACCOUNT DOES NOT WRITE DRAFTS TO DISK.
 *
 * `store.js` swaps its whole BACKEND for an in-memory one inside the demo, so
 * no invented session can reach localStorage or Firestore — but the draft never
 * went through the store. It is written straight to localStorage from here, so
 * running a workout inside the demo left `ftrack:v1:draftSession` full of
 * made-up sets on the real device, and it survived leaving the demo. Found by
 * the UX review, 2026-08-22.
 *
 * ⚠️ It was near-harmless in practice and that is not the point. A strip on
 * every screen of the demo says *"nothing is saved"*, and progress.md §0.10
 * said *"nothing it does can reach localStorage"*. **Both were false**, and in
 * this project a claim that is false is a bigger defect than the leak it
 * describes. sessionStorage matches the demo flag's own lifetime: per tab, gone
 * when the browser closes, and never visible to the real account.
 */
const draftStore = () => {
  try {
    return demo.active() ? sessionStorage : localStorage;
  } catch (_) {
    return localStorage;
  }
};

function saveDraft(d) {
  try { draftStore().setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {}
}
export function loadDraft() {
  try { const r = draftStore().getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}
export function clearDraft() {
  // ⚠️ Cleared from BOTH. A draft written before this fix is sitting in real
  // localStorage on somebody's phone right now, and the demo is the one place
  // that can no longer see it to tidy it up.
  try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) {}
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
  // ⚠️ Filter on the exercise's OWN FIELDS, not on Object.values(set). A set
  // carries a `minis` array, and `Number([{…}])` is NaN — so the old blanket
  // check happened to work, but only by accident, and it would have thrown away
  // a set whose numbers were all in its drops. Hoisted out of finish() on
  // 2026-08-24 because the exercise swap asks the same question: has this
  // exercise actually been done yet?
  const hasNumbers = (s, fields) => fields.some((f) => Number(s[f]) > 0);
  const setIsRecorded = (s, fields) =>
    hasNumbers(s, fields) || minisOf(s).some((d) => hasNumbers(d, fields));

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

  /**
   * Everything one PERSON's copy of this workout needs: their sets, their
   * history, their suggestions. Factored out of session start so a GUEST can
   * be handed the identical machinery over their own history — switching
   * names has to switch the whole suggestion, not just where the number is
   * saved, or two lifters on the same bar get the same prescription (0e).
   *
   * `sessions` is whoever-this-is's own history — the owner's real sessions,
   * or the guest rows recorded under their name. `bodyWeight` likewise: null
   * for a guest, because nobody has weighed them, and progression already
   * degrades honestly (rep-only for bodyweight moves, no assist readout).
   */
  function entriesFor(sessions, bodyWeight, forDate) {
    const step = units.fromDisplay(units.weightStep());
    const out = [];
    for (const { item, ex } of planned) {
      const history = historyFor(sessions, { exerciseId: ex.id, workoutId: workout.id });
      const last = history[0] || null;
      // Build exactly the number of sets the workout plans for. Where history
      // runs out, repeat the last recorded set rather than dropping to zero.
      const lastSets = Array.from({ length: item.sets }, (_, i) => {
        if (!last || !last.length) return blankSet(ex.fields);
        return pickFields(last[Math.min(i, last.length - 1)], ex.fields);
      });

      // ⚠️ PROPOSE, NEVER IMPOSE (docs/goals-plan.md §8.2 rule 5). The
      // suggestion is laid over the numbers, the screen says it is a suggestion
      // and why, and `lastSets` is kept so one tap puts last time's numbers
      // back. It reads the last two sessions of this exercise and nothing about
      // any goal or date — §3.1 is why, and js/progression.js has the whole
      // reasoning.
      //
      // ⚠️ The gap is measured HERE, and it can only ever suppress. See rule 2
      // in that module's header: after a long lay-off the suggestion is
      // withheld and last time's numbers stand, because handing somebody a
      // heavier weight than they have touched in a month is the same harm §3.1
      // exists to prevent, arriving from the other side.
      const lastDay = lastSessionDate(sessions, { exerciseId: ex.id, workoutId: workout.id });
      const suggestion = suggestProgression({
        history,
        exercise: ex,
        step,
        daysSinceLast: lastDay ? daysBetweenDays(lastDay, forDate) : null,
        bodyWeight,
        fmt: units.withUnit,
      });
      const sets = applySuggestion(lastSets, suggestion);

      out.push({
        lastSets,
        suggestion,
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
    return out;
  }

  if (existingDraft) {
    state = existingDraft;
    // Drafts written before guests existed have neither key. Normalising here
    // rather than branching everywhere is what keeps the rest of this file
    // ignorant of when its draft was written.
    if (!Array.isArray(state.others)) state.others = [];
    if (!Array.isArray(state.guestNames)) state.guestNames = [];
    if (state.forName === undefined) state.forName = null;
    if (typeof state.location !== 'string') state.location = '';
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
      /* ---- guests (Open work 0e, the guest half) ----
       * `forName` is WHO the steppers currently record for: null is the
       * owner, a string is a guest. `guestNames` is the stable roster, in
       * the order people were added. `others` parks the full per-person
       * state (entries, walk position, body weight) of everyone NOT active,
       * so switching is a pointer swap and nothing in the walk, the rest
       * timer or the steppers has to know more than one person exists. */
      forName: null,
      guestNames: [],
      others: [],
    };

    // Read once for the whole workout rather than per exercise. The runner used
    // store.lastSetsFor(), which reads every session each time it is called;
    // progression needs the last TWO sessions of each lift, and historyFor()
    // applies exactly the same precedence — this workout's own history first,
    // the exercise anywhere else only if there is none.
    const sessions = await store.getSessions();
    // For pull-ups, dips and push-ups the lifter IS most of the load, so the
    // 2–10 % band means nothing without this. Absent is fine — progression
    // falls back to "one more rep" rather than guessing a body weight.
    const latestWeight = await store.latestBodyWeight().catch(() => null);
    const bodyWeight = latestWeight ? latestWeight.weight : null;

    /* ---- location (Open work 0m) ----
     * A HAND-TYPED label, never GPS — the privacy decision is that nothing
     * more precise than what the owner wrote can exist to leak. Carried
     * forward from the most recent session so training at one gym costs
     * zero taps forever; clearing it for this session is one tap. Published
     * at the "My workouts" tier and above only — see projectSession() in
     * social.js for the schedule argument.
     *
     * ⚠️ "Most recent" needs the startedAt tie-break (same as the feed's
     * ordering): getSessions() sorts on the DATE alone, so two sessions today
     * come back in storage order and the carry-forward would read whichever
     * happened to be first. A session with no location deliberately carries
     * "no location" forward — clearing it is a choice, and an older label
     * resurrecting itself would overrule it. */
    const newest = sessions.slice().sort((a, b) =>
      b.date.localeCompare(a.date)
      || String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0];
    state.location = (newest && typeof newest.location === 'string') ? newest.location : '';

    state.entries = entriesFor(sessions, bodyWeight, state.date);
    // ⚠️ Kept on the DRAFT, not looked up again at render time, and the reason is
    // the same one bodyWeightOn() exists for: this is what the lifter weighed on
    // the day of the session. A weigh-in logged tomorrow must not retroactively
    // change what today's screen said their assisted pull-ups were worth.
    // Dropped at save time — finish() rebuilds every entry from named fields —
    // so it never reaches storage.
    state.bodyWeight = bodyWeight;
    saveDraft(state);
  }

  /* ---- DOM scaffold ---- */

  const progress = el('div', { class: 'session-progress' });
  const pane = el('div', { class: 'pane-scroll' });
  const footer = el('div', { class: 'session-footer' });

  // Sits directly above the footer that carries Finish, so the explanation and
  // the button that failed are in the same glance. Hidden until it is needed,
  // and it is the only thing in this view that persists an error.
  const saveError = el('div', { class: 'save-error', role: 'alert', hidden: true });

  /* ---- people: the owner plus any guests (Open work 0e, guest half) ----
   *
   * Tim, 2026-08-24: "one person can record both measurements for both people
   * on one phone … 2+ names at the top that the user could click on to switch
   * between which user they are recording the data to." His friend could not
   * sign in at all, so the first half built is the GUEST: a name with no
   * account, kept in the recorder's own data (store.guestSessions), no rules
   * widened, nothing written into anybody else's account.
   */

  const peopleBar = el('div', { class: 'people-bar' });

  // The active person's history, for the exercise swap. A guest's swap must
  // read the guest's own past sessions, or the swapped-in exercise arrives
  // wearing the OWNER's numbers — the exact cross-prescription 0e forbids.
  async function sessionsForActive() {
    if (state.forName == null) return store.getSessions();
    const all = await store.getGuestSessions();
    const key = state.forName.trim().toLowerCase();
    return all.filter((g) => String(g.guestName || '').trim().toLowerCase() === key);
  }

  function switchTo(name) {
    if (name === state.forName) return;
    const at = state.others.findIndex((o) => o.name === name);
    if (at < 0) return;
    const incoming = state.others.splice(at, 1)[0];
    // Park the whole per-person state, not just the entries — the walk
    // position and the body weight are each person's own.
    state.others.push({
      name: state.forName,
      entries: state.entries,
      index: state.index,
      bodyWeight: state.bodyWeight,
    });
    state.forName = incoming.name;
    state.entries = incoming.entries;
    state.index = incoming.index || 0;
    state.bodyWeight = incoming.bodyWeight == null ? null : incoming.bodyWeight;
    saveDraft(state);
    renderAll();
  }

  async function addGuest(rawName) {
    const name = String(rawName || '').trim();
    if (!name) { toast('Give them a name first'); return false; }
    if (name.length > 40) { toast('That name is too long'); return false; }
    const taken = ['you', 'me', ...state.guestNames.map((n) => n.toLowerCase())];
    if (taken.includes(name.toLowerCase())) { toast(`${name} is already in this workout`); return false; }

    // The guest's own history, so their second session arrives with their own
    // numbers and their own suggestion — not blank, and never the owner's.
    const all = await store.getGuestSessions().catch(() => []);
    const key = name.toLowerCase();
    const theirs = all.filter((g) => String(g.guestName || '').trim().toLowerCase() === key);

    state.guestNames.push(name);
    state.others.push({
      name,
      entries: entriesFor(theirs, null, state.date),
      index: 0,
      bodyWeight: null,
    });
    saveDraft(state);
    // Adding somebody is followed by logging their first set, so the switch
    // is part of the add rather than a second tap.
    switchTo(name);
    return true;
  }

  function openAddGuest() {
    const input = el('input', {
      class: 'input', type: 'text', placeholder: 'Their name',
      'aria-label': 'Guest name', maxlength: '40', autocomplete: 'off',
    });
    const { close } = openSheet({
      title: 'Add a person',
      body: el('div', {},
        el('p', { class: 'field-help', style: 'margin-top:0', text:
          'Record this workout for somebody training with you. They do not '
          + 'need an account — their sets are kept on your account, under '
          + 'their name, and never mix with your own training or your stats.' }),
        el('div', { class: 'field' }, el('label', { text: 'Name' }), input),
      ),
      footer: el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => close() }),
        el('button', { class: 'btn primary', text: 'Add', onClick: async () => {
          if (await addGuest(input.value)) close();
        } }),
      ),
    });
    input.focus();
  }

  function renderPeople() {
    const solo = !state.guestNames.length;
    // `.chip` supplies the pill, the 44px invisible hit target and the
    // aria-pressed accent state — the same control the rest chip uses.
    setChildren(peopleBar,
      el('button', {
        class: 'chip person-chip',
        'aria-pressed': state.forName == null ? 'true' : 'false',
        onClick: () => switchTo(null),
      }, 'You'),
      ...state.guestNames.map((n) =>
        el('button', {
          class: 'chip person-chip',
          'aria-pressed': state.forName === n ? 'true' : 'false',
          onClick: () => switchTo(n),
        }, n)),
      el('button', {
        class: 'chip person-chip person-add',
        'aria-label': 'Add a person to record for',
        onClick: openAddGuest,
      }, icon('plus', 13), solo ? 'Add a person' : ''),
    );
  }

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

    /**
     * The FIRST time you ever do an exercise, opening set 2 fills it from set 1.
     *
     * Tim, after using this in a gym on 2026-08-24: "once the user puts in their
     * measurements for the first rep, put those same measurements in for the
     * next set so it's easy to adjust next." An exercise with history already
     * behaves this way — the runner pre-fills every set from the last session
     * and lays the suggestion over it — so the only place anybody meets a column
     * of zeros is a lift they have never logged, which is exactly where they are
     * least sure what to type.
     *
     * ⚠️ FILLED WHEN THE SET IS OPENED, NOT WHEN THE ONE ABOVE IS TYPED, and the
     * difference is what somebody gets credited for. The eager version wrote
     * numbers into every set below on the first keystroke — and finish() keeps
     * any set that has numbers in it, so a lifter who logged one set and stopped
     * would have had two more recorded that they never performed, inflating
     * their volume, their muscle map and their weekly sets. Two render tests
     * caught it. Filling on open cannot do that: a set nobody opened stays blank
     * and is dropped at save, exactly as before.
     *
     * ⚠️ GATED ON `hadHistory` as well. With history the sets are not blank —
     * they are last time's numbers, possibly a deliberate ramp of 95, 135, 135 —
     * and there is nothing to fill in.
     *
     * ⚠️ AND ONLY INTO A SET WITH NOTHING IN IT. "Empty" is the whole condition,
     * so this can never overwrite a number somebody typed, and never touches a
     * set twice.
     */
    function fillOnOpen(i) {
      if (entry.hadHistory || i <= 0 || i >= entry.sets.length) return;
      const s = entry.sets[i];
      if (entry.fields.some((f) => Number(s[f]) > 0)) return;
      if (minisOf(s).length) return;
      // The nearest set above with anything in it — not strictly i-1, so
      // skipping a set does not hand the next one a row of zeros.
      for (let j = i - 1; j >= 0; j--) {
        const src = entry.sets[j];
        if (entry.fields.some((f) => Number(src[f]) > 0)) {
          // Fields only. A drop hangs off the set it was stripped from and the
          // app has never claimed to know how much lighter it is, so copying
          // one into a set nobody has reached yet would be a guess arriving
          // before the question.
          entry.sets[i] = { ...s, ...pickFields(src, entry.fields) };
          return;
        }
      }
    }

    function select(i, dropIndex) {
      if (dropIndex == null) fillOnOpen(i);
      entry.active = i;
      entry.activeDrop = dropIndex;
      saveDraft(state);
      renderPane();
    }

    /* ⚠️ THE WHOLE ROW SELECTS THE SET, not just the little numbered square.
     *
     * Tim, after his second gym session (2026-08-25): *"if the user is doing
     * multiple sets, then clicking on the other sets is often confusing because
     * you have to click on the 1, 2, 3, etc on the side."* He is describing a
     * 21×21 px target on a row 35 px tall and the full width of the screen —
     * the numbers ARE the only live part, and everything a thumb naturally aims
     * at (the weight and reps, which is what you are reading) did nothing.
     *
     * ⚠️ A BUTTON INSIDE THE ROW, NOT A CLICK HANDLER ON THE ROW ITSELF. A
     * `<div onClick>` would satisfy the request and quietly drop the set list
     * out of the keyboard order and off the accessibility tree — the exact
     * class of fault the 2026-08-20 audit found in the 19 unassociated labels.
     * `.set-pick` is a real button carrying the row's whole accessible name, so
     * there is now ONE named control per set instead of a number labelled
     * "Edit set 3" that never said what set 3 held.
     *
     * ⚠️ AND DELETE IS ITS SIBLING, NOT ITS CHILD. Nesting it would be invalid
     * HTML and would need a stopPropagation to keep a delete from also
     * selecting — a guard that works until somebody adds the next control. Two
     * siblings cannot have that bug.
     */
    function renderSets() {
      const rows = [];
      entry.sets.forEach((s, i) => {
        const isHere = i === entry.active;
        rows.push(el('div', { class: 'set-item' + (isHere && entry.activeDrop == null ? ' active' : '') },
          el('button', {
            class: 'set-pick',
            'aria-label': `Set ${i + 1}: ${fmtSet(s, entry.fields, entry.loadType)}`,
            'aria-current': isHere && entry.activeDrop == null ? 'true' : null,
            onClick: () => select(i, null),
          },
            el('span', { class: 'set-num', text: String(i + 1) }),
            el('span', { class: 'set-vals', text: fmtSet(s, entry.fields, entry.loadType) }),
          ),
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
            // Same restructure as the set row above, for the same reason: the ↳
            // is a 22px glyph and the numbers beside it are what a thumb aims at.
            el('button', {
              class: 'set-pick',
              'aria-label': `${miniLabel(entry.setType, di + 1)} of set ${i + 1}: `
                + fmtSet(d, entry.fields, entry.loadType),
              'aria-current': isHere && entry.activeDrop === di ? 'true' : null,
              onClick: () => select(i, di),
            },
              el('span', { class: 'set-num drop-num', text: '↳' }),
              el('span', { class: 'set-vals', text: fmtSet(d, entry.fields, entry.loadType) }),
            ),
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

    // ⚠️ AN ASSIST MACHINE'S NUMBER IS THE ONE NUMBER IN THIS APP THAT MEANS THE
    // OPPOSITE OF WHAT IT LOOKS LIKE. 70 in the box is 70 pounds of HELP, so the
    // box goes down as you get stronger — and a lifter watching only that box is
    // watching their progress run backwards. Tim asked for the real number
    // beside it after doing assisted pull-ups in a gym on 2026-08-24, and it is
    // the same argument the suggestion sentences make: say the thing at the
    // moment of use, where it is being acted on (D8).
    //
    // Silent when there is no weigh-in, on purpose. Without a body weight there
    // is no second number to show, and inventing one from an average adult is
    // exactly what the fraction table refuses to do.
    const assistSpec = ex ? bodyWeightFractionFor(ex) : null;
    const showsAssist = Boolean(assistSpec && assistSpec.assist && state.bodyWeight > 0);
    const assistLine = showsAssist ? el('div', { class: 'assist-readout' }) : null;
    function renderAssist() {
      if (!assistLine) return;
      const res = totalResistance(ex, target.weight, state.bodyWeight);
      // null is a real answer here — more help than you weigh is not a lighter
      // set, it is a typo, and totalResistance() refuses it rather than printing
      // a negative load.
      // ⚠️ ONE SHORT LINE, and the units appear once. "110 lbs on you — 180 lbs
      // of body weight less 70 lbs of help" is three units in a row and wrapped
      // to three lines at 360px, under a stepper somebody is using mid-set. The
      // bold number is the one that matters and is the only one that needs its
      // unit spelled out. Measured at 360, 375 and 393: one line, no overflow.
      //
      // ⚠️ AND THE ZERO CASE GETS ITS OWN SENTENCE. Every set opens at zero, so
      // the first thing anybody would have seen was "your 180 less 0 of help" —
      // arithmetic performed on nothing, in the one place the app is trying to
      // make an unintuitive number clear. Found by looking at it; no test would
      // have called that wrong. At zero the machine is not helping and the
      // honest reading is that this is a pull-up.
      if (!res) {
        setChildren(assistLine,
          el('span', { class: 'is-warn', text: 'That is more help than you weigh — check the number.' }));
      } else if (!(res.added > 0)) {
        setChildren(assistLine,
          el('span', {}, el('b', { text: units.withUnit(res.load) }), ' on you — no help set, so this is a pull-up'));
      } else {
        setChildren(assistLine,
          el('span', {}, el('b', { text: units.withUnit(res.load) }), ' on you — your ',
            `${units.fmtWeight(res.base)} less ${units.fmtWeight(res.added)} of help`));
      }
    }
    renderAssist();

    const steppers = entry.fields.map((f) =>
      stepper({
        field: f,
        value: target[f],
        // ⚠️ "of help" read as "Weight of help" in the label, because the suffix
        // sits directly after the field name — the slot exists to say what KIND
        // of weight this is ("total", "per side"), and a prepositional phrase
        // does not fit it. Caught in a screenshot at 360px.
        suffix: f === 'weight' && entry.loadType
          ? (showsAssist ? 'assistance' : LOAD_LABEL[entry.loadType])
          : null,
        onChange: (v) => {
          target[f] = v;
          saveDraft(state);
          renderAssist();
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
          ...step.roundMembers.map((mi, pos) => el('button', {
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
        el('div', { class: 'session-head-row' },
          el('h2', { class: 'session-ex-name', text: entry.exerciseName }),
          // ⚠️ QUIET, and beside the name rather than under the numbers. Swapping
          // is a thing you do occasionally when a machine is taken; it must be
          // findable without competing with the steppers, which are what this
          // screen is for (D4). Same reasoning as the suggestion's undo link.
          el('button', {
            class: 'swap-btn',
            title: 'Use a different exercise for this session',
            onClick: () => openExercisePicker({
              exMap,
              title: 'Swap this exercise',
              closeOnPick: true,
              onPick: (picked) => swapExercise(step.entryIndex, picked),
            }),
          }, icon('swap', 15), 'Swap'),
        ),
        el('div', { class: 'session-ex-meta' },
          `${ex ? ex.muscle + ' · ' + ex.equipment + ' · ' : ''}Exercise ${step.entryIndex + 1} of ${state.entries.length}`,
        ),
        // Says which of the two things a swap just did, because they are
        // different and only one of them left a record behind.
        entry.swappedFrom
          ? el('div', { class: 'session-ex-meta', text: `Swapped in for ${entry.swappedFrom} — today only.` })
          : null,
      ),

      entry.notes
        ? el('div', { class: 'note-card' }, el('b', { text: 'Note' }), el('span', { text: entry.notes }))
        : null,

      entry.hadHistory
        ? el('div', { class: 'prefill-note' }, icon('check', 16),
            el('span', {}, 'Last time: ', el('b', { text: entry.lastSummary })))
        : el('div', { class: 'prefill-note' },
            el('span', { text: 'First time logging this — your numbers will be remembered.' })),

      // ⚠️ THE SUGGESTION SAYS WHY, IN ONE LINE, AT THE MOMENT OF USE (D8).
      // "+5 lbs" with no reason is an instruction from nowhere; "top of the
      // range twice in a row, so the smallest step inside 2–10 %" is the rule
      // being taught while it is being used, which is the only place this app
      // teaches anything.
      //
      // And it is a PROPOSAL. The numbers are pre-filled and every stepper
      // overrides them, plus there is a one-tap way back to last time's — see
      // docs/goals-plan.md §8.2 rule 5 and js/progression.js's header.
      //
      // ⚠️ A lay-off note is DELIBERATELY QUIETER than a suggestion, and it
      // carries no toggle. Nothing was proposed, so there is nothing to undo —
      // an "instead" link beside numbers that already are last time's would be
      // offering a choice that does not exist. The visual weight matches how
      // much is being asked, which here is nothing.
      entry.suggestion
        ? el('div', { class: 'suggest-note' + (entry.suggestion.kind === 'layoff' ? ' is-hold' : '') },
            icon(entry.suggestion.kind === 'load' ? 'up'
              : entry.suggestion.kind === 'layoff' ? 'check' : 'plus', 15),
            el('div', { class: 'suggest-body' },
              el('div', { class: 'suggest-head', text: entry.suggestion.kind === 'layoff'
                ? 'No step up this time'
                : entry.usingLast
                  ? `Suggested was ${entry.suggestion.headline}`
                  : `Suggested: ${entry.suggestion.headline}` }),
              el('div', { class: 'suggest-why', text: entry.suggestion.why }),
              entry.suggestion.kind === 'layoff' ? null : el('button', {
                class: 'suggest-toggle',
                text: entry.usingLast ? 'Use the suggestion' : 'Use last time’s numbers instead',
                onClick: () => {
                  entry.usingLast = !entry.usingLast;
                  // ⚠️ Edited IN PLACE, not rebuilt from the original list. A
                  // set added or deleted mid-session would otherwise vanish the
                  // moment somebody tapped this, and any drop already recorded
                  // with it. Only the numbers move; the shape of the list does
                  // not.
                  entry.sets = entry.usingLast
                    ? entry.sets.map((s, i) => (i < entry.lastSets.length
                        ? { ...s, ...entry.lastSets[i] } : s))
                    : applySuggestion(entry.sets, entry.suggestion);
                  entry.activeDrop = null;
                  saveDraft(state);
                  renderAll();
                },
              }),
            ))
        : null,

      el('div', { class: 'section-label', text: entry.activeDrop == null
        ? `Set ${entry.active + 1} of ${entry.sets.length}`
        : `Set ${entry.active + 1} · ${miniLabel(entry.setType, entry.activeDrop + 1).toLowerCase()}` }),
      el('div', { class: 'steppers' }, steppers),
      assistLine,

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
            // ⚠️ On a SOLO exercise, adding a set means you are about to do it,
            // so the steppers follow it. Inside a block they must NOT: you are
            // still on round N, and moving the target to the new last set meant
            // the next numbers you typed landed in a different round from the
            // one the banner said you were on — for that member only, silently
            // desynchronising the block.
            if (step.group == null) entry.active = entry.sets.length - 1;
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
    // Clamp FIRST. Deleting a set can shrink the walk, and renderProgress ran
    // before renderPane did the clamping — so the bar drew every dot as done
    // with no current step until something else forced a redraw.
    currentStep();
    renderPeople();
    renderProgress();
    renderPane();
    renderFooter();
  }

  /**
   * Everything the runner needs to know about an exercise it is about to show:
   * last time's numbers, and what to suggest.
   *
   * ⚠️ Pulled out of the session-start loop so the SWAP can reuse it. The runner
   * reads every session ONCE at the start and builds all of this up front, which
   * is right for a workout whose exercises are known — and leaves an exercise
   * swapped in mid-session with no history and a column of zeros unless it can
   * go and ask. `store.getSessions()` is served from the read cache, so asking
   * again mid-workout costs nothing on the wire.
   */
  async function readingFor(ex) {
    // The ACTIVE person's history — a guest's swap reads the guest's own past.
    const sessions = await sessionsForActive();
    const history = historyFor(sessions, { exerciseId: ex.id, workoutId: state.workoutId });
    const last = history[0] || null;
    const lastDay = lastSessionDate(sessions, { exerciseId: ex.id, workoutId: state.workoutId });
    const suggestion = suggestProgression({
      history,
      exercise: ex,
      step: units.fromDisplay(units.weightStep()),
      daysSinceLast: lastDay ? daysBetweenDays(lastDay, state.date) : null,
      bodyWeight: state.bodyWeight,
      fmt: units.withUnit,
    });
    return { history, last, suggestion };
  }

  /**
   * Swap the exercise at `index` for another one, FOR THIS SESSION ONLY.
   *
   * Tim, after a gym session on 2026-08-24: *"Allow the user to change the
   * specific exercise they're doing once they're already in the workout so it's
   * easy to improvise in case they want or need to switch something up."* The
   * machine is taken, the gym is busy, or it just feels wrong today.
   *
   * ⚠️ THE SAVED WORKOUT IS NOT TOUCHED — his call, asked and answered. It is
   * also what the runner already does everywhere else: `isBenchmark`, `group`,
   * `setType` and `plannedMinis` are all copied from the template at the moment
   * the session starts, precisely so that improvising today cannot reshape the
   * programme, and editing the programme next month cannot reshape a session
   * already recorded.
   *
   * ⚠️ SETS ALREADY RECORDED ARE KEPT, UNDER THE EXERCISE THEY WERE DONE ON. If
   * the machine was taken after two sets, two sets were done — and they were
   * done on the leg press, not on the thing that replaced it. So a swap with
   * work already logged SPLITS: the original keeps its recorded sets and the new
   * exercise is inserted directly after it. A swap with nothing logged replaces
   * in place, because an empty entry is not a record of anything.
   *
   * ⚠️ Inserted AFTER, never appended to the end, and that is not cosmetic any
   * more: `muscleStrength()` reads entry order to work out how much work a
   * muscle had already taken when each exercise started. An exercise dropped at
   * the end of the list would be scored as though it came after everything.
   */
  async function swapExercise(index, newEx) {
    const entry = state.entries[index];
    if (!entry || !newEx) return;
    const { last, suggestion } = await readingFor(newEx);

    const lastSets = Array.from({ length: entry.plannedSets || 1 }, (_, i) => {
      if (!last || !last.length) return blankSet(newEx.fields);
      return pickFields(last[Math.min(i, last.length - 1)], newEx.fields);
    });

    const fresh = {
      lastSets,
      suggestion,
      exerciseId: newEx.id,
      exerciseName: newEx.name,
      fields: newEx.fields,
      loadType: newEx.loadType,
      notes: '',                 // the note belonged to the exercise being replaced
      plannedSets: entry.plannedSets,
      group: entry.group,
      setType: entry.setType,
      plannedMinis: entry.plannedMinis,
      sets: applySuggestion(lastSets, suggestion),
      active: 0,
      activeDrop: null,
      hadHistory: Boolean(last && last.length),
      lastSummary: last && last.length ? fmtSet(last[0], newEx.fields, newEx.loadType) : null,
      swappedFrom: entry.exerciseName,
    };

    const recorded = entry.sets.filter((s) => setIsRecorded(s, entry.fields));
    if (recorded.length) {
      entry.sets = recorded;
      entry.active = Math.min(entry.active, recorded.length - 1);
      entry.activeDrop = null;
      // ⚠️ The kept half leaves the superset. A group's rounds are walked by
      // membership, so letting both halves stay in it would put three exercises
      // in a two-exercise round and desynchronise the walker mid-workout. The
      // half you are still doing keeps the group; the half you have finished
      // becomes what it now is — some sets you did.
      if (entry.group != null) { entry.group = null; entry.setType = null; }
      state.entries.splice(index + 1, 0, fresh);
      toast(`Swapped to ${newEx.name}`);
      // ⚠️ `state.index` walks STEPS, not entries, and a split rebuilds the walk
      // — a superset contributes one step per member per round, so the two
      // indices are not the same number and adding one to it lands wherever it
      // happens to land. Find the step that belongs to the new entry instead.
      // goToStep() saves and renders, so nothing else is needed here.
      const at = steps().findIndex((s) => s.entryIndex === index + 1);
      goToStep(at >= 0 ? at : state.index);
      return;
    }
    state.entries[index] = fresh;
    saveDraft(state);
    renderAll();
    toast(`Swapped to ${newEx.name}`);
  }

  // One person's entries, reduced to what was actually recorded. Factored so
  // finish() can run it once per person — the owner and every guest get the
  // identical drop-empties / keep-minis / orphan-group treatment.
  function cleanedEntriesOf(rawEntries) {
    const entries = rawEntries
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

    // Dropping the empty entries can leave one half of a superset behind still
    // claiming to be in one, and the day view would bracket it alone and call
    // it a Superset — a false claim about what was actually done.
    return dropOrphanGroups(entries);
  }

  async function finish() {
    // Everybody in the session — whoever is active plus everyone parked.
    const people = [
      { name: state.forName, entries: state.entries },
      ...state.others.map((o) => ({ name: o.name, entries: o.entries })),
    ];
    const owner = people.find((p) => p.name == null) || { entries: [] };
    const guests = people
      .filter((p) => p.name != null)
      .map((p) => ({ name: p.name, cleaned: cleanedEntriesOf(p.entries) }))
      .filter((p) => p.cleaned.length);

    const cleaned = cleanedEntriesOf(owner.entries);

    if (!cleaned.length && !guests.length) {
      toast('Nothing recorded — enter at least one number');
      return;
    }

    /* ⚠️ THE ONE PLACE IN THIS APP WHERE A FAILURE COSTS SOMEBODY THEIR WORK.
     *
     * This `await` was unguarded until 2026-08-22, and the app has no
     * `unhandledrejection` handler — so a full localStorage meant the promise
     * rejected, `clearDraft()` and `showFinished()` never ran, and the user
     * tapped **Finish**, at the end of a workout, and NOTHING HAPPENED. The
     * backend was already throwing the right words ("Could not save. Your
     * browser storage may be full."); nobody was listening for them.
     *
     * ⚠️ THE DRAFT IS NOT CLEARED ON FAILURE, and that is the whole point.
     * The draft is the only remaining copy of the session, so clearing it
     * before the save is known to have landed would turn a recoverable error
     * into lost training. Leaving it means the numbers are still on the screen
     * and still on disk, and Finish can simply be tapped again.
     *
     * The message is persistent rather than a toast for the same reason the
     * sign-in screen's is: 2.4 seconds is indistinguishable from nothing
     * happening, which is exactly how the original was reported from a phone.
     */
    /* ⚠️ IDS ARE MINTED ONCE, ON THE DRAFT, BEFORE ANY SAVE. This used to be
     * one save, where "failed = nothing landed" made a bare retry safe. It is
     * now up to N saves, and a failure between them means Finish gets tapped
     * again over rows that already landed — with no id, every one of those
     * would be inserted a second time. A stable id makes the retry an upsert
     * of the same row, so tapping Finish twice cannot double anybody's
     * training. */
    if (!state.saveIds) state.saveIds = {};
    if (cleaned.length && !state.saveIds.you) state.saveIds.you = uid('s');
    for (const g of guests) {
      if (!state.saveIds['g:' + g.name]) state.saveIds['g:' + g.name] = uid('g');
    }
    saveDraft(state);

    try {
      // The owner saves ONLY when they recorded something. A coach who ran the
      // whole session for a guest and lifted nothing has no session of their
      // own — saving an empty one would put a workout on their calendar and
      // their volume that never happened.
      if (cleaned.length) {
        await store.saveSession({
          id: state.saveIds.you,
          workoutId: state.workoutId,
          workoutName: state.workoutName,
          date: state.date,
          startedAt: state.startedAt,
          finishedAt: new Date().toISOString(),
          isBenchmark: Boolean(state.isBenchmark),
          // Absent rather than '' when there is none — one case for every
          // reader, the same contract startedAt set in the projection.
          ...(state.location ? { location: state.location } : {}),
          entries: cleaned,
        });
      }
      // Each guest's half goes to its own collection under their name —
      // never into `sessions`, never a benchmark, never published (see the
      // guest-sessions note in store.js for why the separation is structural).
      for (const g of guests) {
        await store.saveGuestSession({
          id: state.saveIds['g:' + g.name],
          guestName: g.name,
          workoutId: state.workoutId,
          workoutName: state.workoutName,
          date: state.date,
          startedAt: state.startedAt,
          finishedAt: new Date().toISOString(),
          entries: g.cleaned,
        });
      }
    } catch (err) {
      saveFailed(err);
      return;
    }

    clearDraft();
    showFinished(cleaned, guests);
  }

  // Said on the screen, not in a toast, and it stays until the save works.
  function saveFailed(err) {
    const msg = (err && err.message) || 'Could not save this workout.';
    setChildren(saveError,
      el('strong', { text: 'Not saved. ' }),
      el('span', { text: `${msg} Your numbers are still here — nothing has been thrown away. `
        + 'Tap Finish again, or free up some space and then tap it.' }),
    );
    saveError.hidden = false;
    // ⚠️ Guarded, and not as politeness to jsdom. An exception thrown INSIDE the
    // handler for a failed save puts the user straight back where they started:
    // a tap on Finish that does nothing at all. The message is the job; the
    // scroll is a nicety, and a nicety may not be able to take the message down
    // with it.
    if (typeof saveError.scrollIntoView === 'function') saveError.scrollIntoView({ block: 'nearest' });
  }

  function showFinished(entries, guests = []) {
    const setCount = entries.reduce((n, e) => n + e.sets.length, 0);
    document.getElementById('app').replaceChildren(screenShell({
      title: 'Workout complete',
      noNav: true,
      scroll: el('div', { class: 'finish-hero' },
        el('div', { class: 'finish-check' }, icon('check')),
        el('h2', { text: 'Nice work' }),
        // The owner's line only describes the owner's training. When they
        // recorded nothing and coached a guest through the whole thing, saying
        // "0 sets" would read as a failed save — the guests' lines are the
        // record of what happened.
        entries.length
          ? el('p', { text: `${state.workoutName} · ${entries.length} exercise${entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}` })
          : el('p', { text: `${state.workoutName} — nothing recorded for you` }),
        ...guests.map((g) => {
          const gs = g.cleaned.reduce((n, e) => n + e.sets.length, 0);
          return el('p', { text: `Also recorded for ${g.name} — ${g.cleaned.length} exercise${g.cleaned.length === 1 ? '' : 's'} · ${gs} set${gs === 1 ? '' : 's'}` });
        }),
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

  /* ---- location (0m): a typed label, remembered, one tap to change ---- */
  const locationBtn = el('button', { class: 'session-loc' });
  function renderLocation() {
    setChildren(locationBtn, icon('pin', 12),
      el('span', { class: 'session-loc-name', text: state.location || 'Add location' }));
    locationBtn.classList.toggle('is-empty', !state.location);
    locationBtn.setAttribute('aria-label', state.location
      ? `Location: ${state.location}. Change it` : 'Add a location for this workout');
  }
  renderLocation();
  locationBtn.addEventListener('click', () => {
    const input = el('input', {
      class: 'input', type: 'text', value: state.location,
      placeholder: 'Gold’s Gym, home, the park…',
      'aria-label': 'Where this workout happened', maxlength: '80', autocomplete: 'off',
    });
    const apply = (v) => {
      state.location = String(v || '').trim().slice(0, 80);
      saveDraft(state);
      renderLocation();
      close();
    };
    const { close } = openSheet({
      title: 'Where was this?',
      body: el('div', {},
        el('p', { class: 'field-help', style: 'margin-top:0', text:
          'Whatever you type here is the whole location — the app never reads GPS. '
          + 'Friends you share full workouts with see it on your card; '
          + 'people who only see that you trained do not. '
          + 'It carries over to your next workout until you change it.' }),
        el('div', { class: 'field' }, el('label', { text: 'Location' }), input),
      ),
      footer: el('div', { class: 'btn-row' },
        state.location
          ? el('button', { class: 'btn ghost', text: 'Remove', onClick: () => apply('') })
          : el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => close() }),
        el('button', { class: 'btn primary', text: 'Save', onClick: () => apply(input.value) }),
      ),
    });
    input.focus();
  });

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
          locationBtn,
        ),
      ),
    ),
    peopleBar,
    progress,
    pane,
    restBar,
    saveError,
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
