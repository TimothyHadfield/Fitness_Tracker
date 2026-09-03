// The in-workout recording flow, plus the benchmark form.

import { store, social, muscleStrength, muscleRatings, todayISO, uid, DEFAULT_SETS } from './store.js';
import { LOAD_LABEL, bodyWeightFractionFor } from './exercises.js';
import { totalResistance } from './e1rm.js';
import {
  setChildren, el, icon, iconBtn, toast, screenShell, emptyState, stepper,
  fmtSet, confirmSheet, fmtDateLong, openSheet, exerciseLabel, goBack, refreshRoute,
  parkScreen,
} from './ui.js';
import {
  saveDraft, loadDraft, clearDraft, liveDraft,
  hasNumbers, setIsRecorded, draftRecordedSets,
} from './session-draft.js';
import { openExercisePicker, openSwapPicker } from './views-workouts.js';
import {
  DROP, MYO, isNested, stepsFor, minisOf, plannedMinis, miniLabel, dropOrphanGroups,
  normalizeGroups,
} from './set-types.js';
import {
  historyFor, lastSessionDate, suggestProgression, applySuggestion,
} from './progression.js';
import { personalBests, PB_LABEL } from './personal-bests.js';
import { estimateOneRM, percentOfMax, repPrediction } from './exercise-estimate.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

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

/* ⚠️ DRAFT PERSISTENCE MOVED TO js/session-draft.js ON 2026-09-07, when the bar
 * above the nav started asking the same question from every screen in the app.
 * The functions are unchanged; read that file's header for why they left. */

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

  /**
   * The starting point for an exercise with no history at all.
   *
   * ⚠️ TIM ASKED FOR A BEGINNER WEIGHT AND WHAT THIS DOES IS NARROWER, ON
   * PURPOSE. His words, 2026-08-29: *"instead of setting the weight and rep
   * number to 0, put the amount to a beginner amount of weight and an average
   * number of reps (maybe 10). Add a note that this is their first recording
   * and they should change it."*
   *
   * ⚠️ THE REPS ARE FREE AND THE WEIGHT IS NOT, and the difference is what
   * this app is for. 10 reps is not a claim about a person — it is where the
   * app's own model already starts, `repRangeFor()` defaults to the 8-12 band
   * the position stand names for novices, and 10 is the only round number
   * strictly inside it (8 and 12 sit ON a band boundary, so a lifter would
   * start at the top of a range and be handed a load increase two obedient
   * sessions later). A WEIGHT is a claim about a person, and the only sources
   * for one are: an invented constant, or the 5th percentile of people who
   * lift and log — which is not a fact about somebody who has never lifted,
   * needs a body weight a new user has not given, and rests on the number
   * `strength-standards.js` calls the weakest in the file.
   *
   * ⚠️ SO A WEIGHT IS DERIVED WHERE IT CAN BE AND LEFT ALONE WHERE IT CANNOT.
   * Somebody who has trained here has a rated muscle, and `muscle-evidence.js`
   * already converts between exercises in the other direction every time the
   * body map is drawn — running it backwards is arithmetic on their own
   * recorded sets, not a guess. Gated at the two thresholds that already mean
   * "not good enough to speak" elsewhere in the app: ratio quality below 0.45
   * (which excludes most machines, correctly) and confidence below the Fair
   * band. Below either, the field stays empty and the note says why.
   *
   * ⚠️ AND ANYTHING PUT HERE IS MARKED `prefilled`, because a set carrying a
   * number is a set `finish()` SAVES — the "prefilled counts as recorded"
   * defect of 2026-08-28, which survives today only because a never-done
   * exercise prefills zero. Filling it in without the flag would delete the
   * one safe case and record a workout nobody did.
   */
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
  /* ⚠️ `hasNumbers` and `setIsRecorded` MOVED TO js/session-draft.js on
   * 2026-09-07 and are imported at the top of this file. They were closures
   * here — hoisted out of finish() on 2026-08-24 because the exercise swap asks
   * the same question — and they left when a third and fourth caller appeared
   * outside the runner. The rule is unchanged; there is now one copy of it. */

  /* 10 reps: the app's OWN default, not a guess. `repRangeFor()` in
   * progression.js falls back to the 8-12 band for an unknown rep count, and 10
   * is the only round number strictly inside it — 8 and 12 each sit on a band
   * boundary, which `repRangeFor` resolves downwards, so starting there would
   * put a brand-new lifter at the top of a range and hand them a load increase
   * two obedient sessions later. */
  const DEFAULT_REPS = 10;

  const settings = await store.getSettings();

  /**
   * A believable opening weight for each planned exercise, worked out from what
   * this account has ALREADY recorded on other lifts.
   *
   * ⚠️ THIS IS THE BODY MAP'S OWN ARITHMETIC RUN BACKWARDS, not a new model.
   * `muscleStrength()` converts every recorded set into an estimate of a
   * muscle's key lift by dividing by a published ratio; this multiplies back
   * out. Nothing about the person is invented — the input is their own sets.
   *
   * ⚠️ TWO GATES, both of them thresholds that already mean "not good enough to
   * speak" elsewhere in this app:
   *   • ratio quality ≥ FALLBACK_MIN_QUALITY (0.45). That deliberately excludes
   *     most machines, whose ratios sit at 0.35-0.45 precisely because a leg
   *     press depends on leverage the app knows nothing about.
   *   • confidence ≥ 0.35, the bottom of the Fair band. A muscle rated off one
   *     high-rep set has no business prescribing an opening weight.
   * Below either, no weight is offered and the screen says the field is theirs
   * to fill in.
   *
   * 🚨 AND SINCE 2026-09-06 IT SAYS SO IN WORDS — `openingWithheld` below.
   * THE GATES DID NOT MOVE AND MUST NOT: a number on this screen gets walked up
   * to a bar and attempted, which is the whole of "an estimate you read is not
   * an estimate you lift" (js/exercise-estimate.js's header). What changed is
   * only that a field left blank BECAUSE THE APP LOOKED AND WOULD NOT STAND
   * BEHIND A NUMBER now reads as a decision rather than as nothing having
   * happened — the same argument `historyForPerson()` already carries: *"no
   * suggestion" for a reason you cannot see reads as broken.* Tim's §3.1 is
   * satisfied by the label, not by filling the field: he kept the half that
   * says *"have a way to be upfront about it."*
   *
   * ⚠️ DIRECT contributions only, never a fallback — and since 2026-09-06, the
   * RATING may not be a fallback either. Those are two different doors into the
   * same room: one is this exercise reaching its muscle through a stand-in, the
   * other is that muscle having no direct evidence of its own. Either way it is
   * one muscle standing in for another, the weakest reading in the table, and
   * the second door was open until the check below closed it.
   *
   * Fire-and-forget: every failure yields an empty map and the runner opens on
   * reps alone, which is exactly what it did before this existed.
   */
  const derivedWeights = new Map();
  /* Exercises the block below LOOKED AT and declined to put a weight on.
   *
   * ⚠️ IT IS NOT "everything missing from `derivedWeights`", and the difference
   * is the whole point of the second map. An exercise with no weight field was
   * never a candidate; a thrown import or a failed `muscleStrength()` means the
   * app never got as far as an opinion. Neither of those may claim on screen
   * that the evidence was weighed — so both leave this set empty and the runner
   * stays as silent as it was before. Only the paths below the weight check
   * add to it, and every one of them is the app declining. */
  const openingWithheld = new Set();
  try {
    const [{ muscles }, ev, e1] = await Promise.all([
      muscleStrength(),
      import('./muscle-evidence.js'),
      import('./e1rm.js'),
    ]);
    const bw = await store.latestBodyWeight().catch(() => null);
    for (const { ex } of planned) {
      if (!Array.isArray(ex.fields) || !ex.fields.includes('weight')) continue;
      const contribs = ev.contributionsFor(ex, { bodyWeight: bw ? bw.weight : undefined });
      const best = contribs
        .filter((c) => c.kind === 'direct' && c.quality >= ev.FALLBACK_MIN_QUALITY)
        .sort((a, b) => b.quality - a.quality)[0];
      if (!best) { openingWithheld.add(ex.id); continue; }
      const rating = muscles.get(best.muscle);
      if (!rating || !(rating.estimate > 0) || !(rating.confidence >= 0.35)) {
        openingWithheld.add(ex.id); continue;
      }
      /* 🚨 AND THE RATING ITSELF MUST NOT BE A STAND-IN — closed 2026-09-06,
       * and it was open on the ONE path where it mattered most.
       *
       * The filter above refuses a fallback CONTRIBUTION: this exercise may not
       * reach its muscle through one. But `rateMuscle()` has a fallback of its
       * own — `kind: 'fallback'` means that muscle had no direct evidence at all
       * and a compound stood in for it, converted across by a published
       * cross-muscle ratio. Reading `rating.estimate` without looking at
       * `rating.kind` let the whole chain through the back door: an observation,
       * times a cross-muscle ratio, times this exercise's ratio.
       *
       * ⚠️ THIS IS THE IDENTICAL BUG FIXED IN `exercise-estimate.js` ON
       * 2026-09-02, and it survived here for four days because the two files
       * look like they do different jobs and do the same arithmetic. That one
       * puts a number on a screen somebody READS. This one puts a number in a
       * field somebody LOADS A BAR TO — so of the two places to have missed it,
       * this was the worse one. Found by an agent reading the two side by side.
       *
       * ⚠️ It can only ever WITHHOLD a suggestion, never raise one, which is the
       * same asymmetry the lay-off rule and `trainingRange()` are built on. */
      if (rating.kind === 'fallback') { openingWithheld.add(ex.id); continue; }
      // `ratio` is this exercise's load as a fraction of the muscle's key lift,
      // and it is in TOTAL load — so a per-side entry halves on the way out.
      const oneRepTotal = rating.estimate * best.ratio;
      const forTen = e1.weightForReps(oneRepTotal, DEFAULT_REPS);
      if (!(forTen > 0)) { openingWithheld.add(ex.id); continue; }
      const shown = ex.loadType === 'per_side' ? forTen / 2 : forTen;
      derivedWeights.set(ex.id, { weight: shown, from: best.muscle });
    }
  } catch (_) { /* no estimate is a quieter screen, never an error */ }

  /* A draft only resumes on the same day, and that rule now lives in
   * session-draft.js because the bar above the nav applies exactly the same
   * one — the two disagreeing would put a workout on the screen that opening it
   * then throws away. */
  const open = liveDraft(todayISO());
  const existingDraft = open && open.workoutId === workout.id ? open : null;

  /* 🚨 STARTING A SECOND WORKOUT USED TO DELETE THE FIRST ONE WITH NO WARNING.
   *
   * `if (rawDraft && !existingDraft) clearDraft()` is what stood here, and it
   * was defensible while the only way out of the runner was a sheet promising
   * the draft was safe: you had to deliberately leave, and then deliberately
   * start something else. **The bar above the nav makes it a stroll** — Record,
   * tap the next workout, and a session with twelve sets in it is gone with no
   * screen having mentioned it.
   *
   * ⚠️ It is asked rather than merged, and never resolved quietly. Two workouts
   * open at once is a second draft key and a second thing to explain; silently
   * resuming the OTHER one is worse still, because the tap said start this. So
   * the screen names what is open, says how much is in it, and offers both real
   * answers. **The discard is the app's first "throw a workout away" control,
   * and this is the only place it belongs**: beside a count of exactly what is
   * being lost.
   *
   * A draft with nothing recorded in it — started, walked away from, never
   * typed into — is cleared without asking. There is nothing to lose and a
   * question about nothing is how people learn to tap through questions. */
  if (open && !existingDraft) {
    const lost = draftRecordedSets(open);
    if (lost) return conflictScreen(open, lost);
    clearDraft();
  }
  // Yesterday's. Cleared without asking, exactly as before: it cannot be
  // resumed, and leaving it on disk would only make tomorrow's ask about it.
  if (!open && loadDraft()) clearDraft();

  /**
   * "You already have one open." The screen that stands between a second
   * workout and the first one's sets.
   */
  function conflictScreen(d, lost) {
    const name = d.workoutName || 'a workout';
    return screenShell({
      title: workout.name,
      back: () => go('#/record'),
      scroll: emptyState(
        `${name} is still open`,
        `It has ${lost} set${lost === 1 ? '' : 's'} recorded. Starting ${workout.name} now would `
        + 'throw that away — this app only keeps one workout open at a time.',
        /* ⚠️ THE DESTRUCTIVE ONE IS UP HERE AND THE SAFE ONE IS THE BIG BUTTON
         * BELOW, deliberately. `.pane-bottom` is where the thumb already is on
         * every other screen in the app, and a Discard sitting in that muscle
         * memory is how somebody deletes a workout they meant to go back to. */
        el('button', {
          class: 'btn ghost',
          text: `Discard it and start ${workout.name}`,
          onClick: () => confirmSheet({
            title: `Discard ${name}?`,
            message: `${lost} recorded set${lost === 1 ? '' : 's'} will be deleted. This cannot be undone.`,
            confirmLabel: 'Discard',
            danger: true,
            // Clear, then re-run this very route: with nothing open, the branch
            // above falls through and the workout starts fresh. `refreshRoute`
            // rather than a hash bounce, so back does not land on a screen that
            // renders nothing (Rule 8).
            onConfirm: () => { clearDraft(); refreshRoute(); },
          }),
        }),
      ),
      bottom: el('button', {
        class: 'btn primary block',
        text: `Back to ${name}`,
        onClick: () => go('#/session/' + encodeURIComponent(d.workoutId)),
      }),
    });
  }

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
      // Never done before: start somewhere usable instead of at zero, and mark
      // it so nothing about it can be mistaken for a record.
      const opening = (last && last.length) ? null : startingSet(ex, step);
      // Build exactly the number of sets the workout plans for. Where history
      // runs out, repeat the last recorded set rather than dropping to zero.
      const lastSets = Array.from({ length: item.sets }, (_, i) => {
        if (!last || !last.length) return opening ? { ...opening.set } : blankSet(ex.fields);
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
      /* ⚠️ RE-STAMPED AFTER applySuggestion, NOT BEFORE. That function returns
       * NEW set objects, so a flag put on `lastSets` is dropped on the way
       * through — and the flag going missing is the difference between "this is
       * a starting point" and a workout nobody did being written to disk. Found
       * by the test, which had the reps opening at 11 rather than 10: with no
       * history the progression rule still had an opinion about the numbers the
       * app had just filled in. */
      if (opening && opening.how) for (const s of sets) s.prefilled = true;

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
        // How the opening numbers were arrived at, so the note can say it.
        // 'derived' | 'reps' | null — see startingSet().
        opening: opening ? opening.how : null,
        openingFrom: opening ? opening.from : null,
        /* Whether the blank weight field is a DECISION rather than an absence.
         * ⚠️ Only meaningful with no history — with history the field is not
         * blank, it holds last time's numbers — so the note that reads this is
         * gated on `hadHistory` as well. A draft written before this existed has
         * no key at all, which reads as false and keeps the screen silent: the
         * correct answer for a session whose suggestions were never weighed. */
        openingWithheld: openingWithheld.has(ex.id),
      });
    }
    return out;
  }

  /**
   * The opening numbers for an exercise nobody here has ever done.
   *
   * Returns a set object carrying `prefilled: true`, plus two non-stored hints
   * about where the numbers came from. Never throws — every failure to derive
   * is a quieter answer, not an error.
   */
  function startingSet(ex, step) {
    const set = blankSet(ex.fields);
    let how = null;
    let from = null;

    // Reps first, because they cost nothing to be right about.
    if (ex.fields.includes('reps')) { set.reps = DEFAULT_REPS; how = 'reps'; }

    const derived = derivedWeights.get(ex.id);
    if (derived && derived.weight > 0 && ex.fields.includes('weight')) {
      // Down to a real increment, never up: the smallest plate in the room is
      // the resolution this number can honestly claim, and rounding up hands
      // somebody more than the estimate said.
      const stepped = step > 0 ? Math.floor(derived.weight / step) * step : derived.weight;
      if (stepped > 0) { set.weight = stepped; how = 'derived'; from = derived.from; }
    }
    // ⚠️ Only marked when something was actually put in. A set left at zeros is
    // the state this app has always had, and flagging it would change what
    // `setIsRecorded` says about an exercise nobody touched — which the swap
    // and remove paths both read.
    if (how) set.prefilled = true;
    return { set, how, from };
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
    // Same reason as location: a draft written before the description existed
    // has no key at all, and an `undefined` reaching the textarea would render
    // the string "undefined" into somebody's resumed workout.
    if (typeof state.note !== 'string') state.note = '';
    // Drafts written before 2026-08-29 have no personMeta, which is exactly
    // right for them: every name in one is an invented guest with no account,
    // and an empty meta is what that means. A workout in progress across the
    // deploy therefore keeps working and simply sends nothing.
    if (!state.personMeta || typeof state.personMeta !== 'object') state.personMeta = {};
    // A draft written before 2026-09-10 has no key, and `false` — everything
    // applies to everybody — is the right reading of one: it is the behaviour
    // Tim asked for, and a resumed workout should not be silently in the
    // narrower mode nobody chose.
    state.justForActive = Boolean(state.justForActive);
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
      /* ---- description (social-plan §13 Step 2) ----
       * One line about how it went, typed during the workout and saved with it.
       * ⚠️ DELIBERATELY NOT CARRIED FORWARD the way `location` is. Where you
       * train is the same most weeks; how a session went never is, and a
       * prefilled "felt strong" from Tuesday would be a sentence the app wrote
       * and put somebody's name on.
       * ⚠️ NAME COLLISION: this is `note`, the SESSION's description.
       * `entry.notes` is the per-exercise coaching note that comes off the
       * workout template. Different field, different owner, never merged. */
      note: '',
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
      /* Who each name in `guestNames` actually IS — `{ uid }` for a friend
       * whose account this gets offered to at Finish, `{ personId }` for a
       * saved identity with no account, `{}` for a name typed and not saved.
       * Keyed by name because addPerson() refuses duplicates within a session;
       * the keys that reach disk are personId and uid. */
      personMeta: {},
      /* 🚨 WHETHER A STRUCTURAL CHANGE IS FOR ONE PERSON OR FOR EVERYBODY —
       * Tim's "just for ____" button, 2026-09-10. FALSE is the default and
       * that is the change: a joint workout is one workout, and adding,
       * removing, swapping, reordering or moving on happens to everybody in it
       * unless somebody says otherwise. The sets never follow, only the shape.
       * ⚠️ It is one mode with a moving label, not a flag per person — the
       * button reads "Just for Alex" and then "Just for you" as you switch,
       * which is what he described. */
      justForActive: false,
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
     * more precise than what the owner wrote can exist to leak. Published at
     * the "My workouts" tier and above only — see projectSession() in
     * social.js for the schedule argument.
     *
     * ⚠️ IT IS A REMEMBERED DEFAULT SINCE 2026-08-29, NOT A CARRY-FORWARD
     * FROM THE LAST SESSION. Tim: *"If the user ever sets a location for that
     * workout, have that be the default and auto-filled in location for every
     * workout they fill in after that."*
     *
     * The old rule read the most recent session and copied whatever it had,
     * INCLUDING nothing — so one workout logged without a label (a session
     * back-dated, a quick activity, a day you were in a hurry) silently reset
     * the default to blank and the next three workouts had to be typed again.
     * A default that any single omission erases is not a default.
     *
     * ⚠️ SO CLEARING IT FOR ONE SESSION NO LONGER CLEARS IT FOREVER, which is
     * the deliberate reversal: the old note said "clearing it is a choice, and
     * an older label resurrecting itself would overrule it". That reasoning
     * was about the last SESSION being the source of truth. The source of
     * truth is now a setting the user changes by typing a different gym, so a
     * blank today is a blank today and nothing more. Changing gyms costs one
     * edit and sticks from then on, which is the same one tap it always was.
     *
     * The old session scan survives as a ONE-TIME migration for accounts that
     * have a location on disk but have not yet written the setting — without
     * it, everybody who already trains somewhere would find the field empty
     * on the first workout after this shipped. */
    if (typeof settings.defaultLocation === 'string') {
      state.location = settings.defaultLocation;
    } else {
      // ⚠️ The most recent session with a location IN IT — not simply the most
      // recent session, which is the bug being fixed. The startedAt tie-break
      // is the feed's ordering: getSessions() sorts on the DATE alone, so two
      // sessions on one day come back in storage order.
      const withLoc = sessions
        .filter((s) => typeof s.location === 'string' && s.location.trim())
        .sort((a, b) => b.date.localeCompare(a.date)
          || String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0];
      state.location = withLoc ? withLoc.location : '';
    }

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

  /* ---- people: the owner plus anyone training with them (Open work 0e) ----
   *
   * Tim, 2026-08-24: "one person can record both measurements for both people
   * on one phone … 2+ names at the top that the user could click on to switch
   * between which user they are recording the data to." His friend could not
   * sign in at all, so the first half built was the GUEST: a name with no
   * account, kept in the recorder's own data (store.guestSessions).
   *
   * ⚠️ 2026-08-29 — TIM'S ACTUAL WANT, and it is the other half: *"my main want
   * for this feature was so that one person could record the details for two+
   * people that do have accounts… look up one of your current friends and add
   * them to your workout instead of inventing someone new. Then, once you're
   * finished with the workout it will send the workout to that user's account
   * where they can accept it."*
   *
   * So a person in this session is now one of three things, and `personMeta`
   * carries which:
   *
   *   • the OWNER            — `forName === null`
   *   • a SAVED PERSON       — `{ personId }`, an invented identity that
   *                            persists between workouts (store.people)
   *   • a FRIEND             — `{ uid }`, a real account. Their half is
   *                            OFFERED to them at Finish (store.offerSession),
   *                            which they accept on their own device.
   *
   * ⚠️ `personMeta` IS KEYED BY NAME, and that is safe only because addPerson()
   * refuses a duplicate name within a session — every other place in this
   * project that keys on a typed name carries a warning about it, so this one
   * says why it is allowed: the keyspace is one workout, not the whole account.
   * The persistent keys are `personId` and `uid`, and those are what reach disk.
   */

  const peopleBar = el('div', { class: 'people-bar' });

  const metaFor = (name) => (name == null ? null : (state.personMeta || {})[name] || {});

  /**
   * The guest rows on THIS account that belong to one person.
   *
   * ⚠️ Matched by id where there is one and by NAME only as a fallback, because
   * every row written before 2026-08-29 has a name and nothing else. Name
   * matching is what this project warns about everywhere else ("Alex", "alex",
   * "my brother") — it is kept here as a migration path for rows already on
   * disk, never as the primary key.
   */
  function guestRowsFor(all, name) {
    const meta = metaFor(name) || {};
    if (meta.uid) return all.filter((g) => g.forUid === meta.uid);
    const key = String(name || '').trim().toLowerCase();
    return all.filter((g) => (meta.personId && g.personId === meta.personId)
      || (!g.personId && !g.forUid
          && String(g.guestName || '').trim().toLowerCase() === key));
  }

  /**
   * A friend's own training, read from what they have SHARED WITH THIS ACCOUNT.
   *
   * ⚠️ Nothing private is reached. This is the same published projection the
   * Friends tab renders, under the same rules — so what comes back is bounded
   * by the tier THEY chose, and at the default tier ("just that I trained") it
   * carries no sets at all and this returns null.
   *
   * ⚠️ AND IT IS NEVER MERGED WITH THE ROWS I RECORDED FOR THEM. A session I
   * recorded and they accepted exists on both sides with DIFFERENT ids (accept
   * mints a fresh one), so a merge would show the same workout twice — and
   * progression reads the last two sessions of a lift, so a doubled session is
   * "you did that weight twice in a row", which is the input that makes it
   * propose MORE WEIGHT. That is the one thing in this app that can hurt
   * somebody. One source, and their own account wins.
   */
  async function sharedSessionsFor(uid) {
    if (!uid) return null;
    let doc = null;
    try { ({ doc } = await social.friend(uid)); } catch (_) { return null; }
    const rows = (doc && Array.isArray(doc.activity) ? doc.activity : [])
      .filter((a) => a && Array.isArray(a.entries))
      .map((a) => ({
        id: a.id,
        date: a.date,
        workoutName: a.name,
        startedAt: a.startedAt,
        // ⚠️ NO workoutId — the projection does not publish one, so
        // scanSessions() falls through to "this exercise anywhere", which is
        // the correct answer rather than a degraded one: their bench press is
        // their bench press whichever of their programmes it was in.
        entries: (a.entries || []).map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.name,
          group: e.group == null ? null : e.group,
          setType: e.setType || null,
          sets: Array.isArray(e.sets) ? e.sets : [],
        })),
      }));
    return rows.length ? rows : null;
  }

  /**
   * One person's history, and WHERE IT CAME FROM — the caller puts that on the
   * screen, because "no suggestion" for a reason you cannot see reads as broken.
   */
  async function historyForPerson(name) {
    const meta = metaFor(name) || {};
    if (meta.uid) {
      const shared = await sharedSessionsFor(meta.uid);
      if (shared) return { sessions: shared, source: 'theirs' };
      const all = await store.getGuestSessions().catch(() => []);
      return { sessions: guestRowsFor(all, name), source: 'mine-only' };
    }
    const all = await store.getGuestSessions().catch(() => []);
    return { sessions: guestRowsFor(all, name), source: 'mine' };
  }

  // The active person's history, for the exercise swap. A guest's swap must
  // read the guest's own past sessions, or the swapped-in exercise arrives
  // wearing the OWNER's numbers — the exact cross-prescription 0e forbids.
  async function sessionsForActive() {
    return sessionsForName(state.forName);
  }

  async function sessionsForName(name) {
    if (name == null) return store.getSessions();
    const { sessions } = await historyForPerson(name);
    return sessions;
  }

  /* ================================================================== *
   * 🚨 A JOINT WORKOUT IS ONE WORKOUT — 2026-09-10, and it comes from Tim
   * MEASURING one for the first time rather than from a review.
   *
   * Tim: *"The accounts that are joint together should be more synced. When
   * the user clicks 'next exercise', it should move to the next exercise for
   * both users, not just one. If the user deletes, swaps, adds, or
   * reorganizes the exercises, it should do the same for both users. However,
   * make a 'just for ____ (the user that is currently selected)' button which
   * makes it so if you do any of those things, it just changes it for that
   * user and not both users."*
   *
   * ⚠️ WHAT IT WAS, AND WHY IT WAS THAT WAY. `state.others` parks the WHOLE
   * per-person state — entries, walk position, body weight — so switching
   * names is a pointer swap and the walk, the steppers and the rest timer
   * never have to know anybody else exists (see switchTo()). That is a good
   * design for the numbers and it accidentally decided something it was never
   * asked about: it made the SHAPE of the workout per-person too. Two people
   * doing one session on one phone got two independent exercise lists and two
   * independent positions in them, so tapping "Next exercise" moved one of
   * them and adding an exercise added it for one of them. Nothing was broken;
   * it had simply never been used by two people at once until today.
   *
   * 🔒 WHAT STAYS PER-PERSON, AND IT IS THE HALF THAT MATTERS: the SETS, the
   * history, the suggestion and the body weight. 0e's load-bearing rule is
   * that switching names switches the whole suggestion — two lifters on one
   * bar are not on the same weights — so a shared exercise arrives at each
   * person built from THEIR OWN past (`entryFor(name, ...)` below), never
   * copied across. What is shared is which exercises are being done, in what
   * order, and which one everybody is on.
   *
   * ⚠️ SO THE OPERATION IS REPLAYED, NOT BROADCAST. Each person's copy is
   * rebuilt against their own history rather than the active person's entry
   * being handed round. A broadcast would be four lines shorter and would put
   * the owner's 185 lb bench in front of somebody who has never benched, which
   * is the one thing this whole feature is built not to do.
   * ================================================================== */

  /* Whether a structural change applies to one person or to everybody.
   * ⚠️ ON THE DRAFT, so it survives leaving a workout open and coming back —
   * everything else in this runner does. It cannot be silently on: the button
   * is lit and names whoever is selected. */
  const syncedByDefault = () => state.guestNames.length > 0 && !state.justForActive;

  /**
   * Everybody in this workout, as one uniform shape.
   *
   * ⚠️ THE ACTIVE PERSON IS AN ADAPTER, not a copy. Their state is hoisted
   * onto `state` itself and the parked ones are plain `{name, entries, index}`
   * objects, so this hands back something that WRITES BACK to wherever that
   * person actually lives. A version that spread the active person into a new
   * object would look identical, pass a shallow test, and drop every change.
   */
  const activeSlot = {
    get name() { return state.forName; },
    get entries() { return state.entries; },
    set entries(v) { state.entries = v; },
    get index() { return state.index; },
    set index(v) { state.index = v; },
    get isActive() { return true; },
  };

  function allSlots() {
    return [activeSlot, ...state.others];
  }

  /** The people a structural change should reach right now. */
  function targetSlots() {
    return syncedByDefault() ? allSlots() : [activeSlot];
  }

  /** Everybody EXCEPT the person the active code path has already handled. */
  function otherTargets() {
    return targetSlots().filter((s) => !s.isActive);
  }

  const stepCountOf = (slot) =>
    stepsFor(slot.entries.map((e) => ({ sets: e.sets.length, group: e.group }))).length;

  /**
   * Put everybody else on the same step.
   *
   * ⚠️ CLAMPED PER PERSON, because after a "just for" edit the lists are
   * genuinely different lengths and there is no honest shared number. Clamping
   * says "as far along as you can be", which is the best available meaning and
   * is exactly right in the ordinary case where the lists match.
   */
  function syncWalk(i) {
    for (const slot of otherTargets()) {
      const n = stepCountOf(slot);
      slot.index = n ? Math.max(0, Math.min(i, n - 1)) : 0;
    }
  }

  /**
   * One entry for `newEx`, built against `name`'s own history.
   *
   * The per-person half of every shared structural change. `entryFromExercise`
   * reads the ACTIVE person; this reads whoever is asked for.
   */
  async function entryFor(name, newEx, shape = {}) {
    if (name === state.forName) return entryFromExercise(newEx, shape);
    const sessions = await sessionsForName(name);
    return buildEntry(newEx, shape, sessions, null);
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
      historySource: state.historySource || null,
    });
    state.forName = incoming.name;
    state.entries = incoming.entries;
    state.index = incoming.index || 0;
    state.bodyWeight = incoming.bodyWeight == null ? null : incoming.bodyWeight;
    // Parked with the rest of the per-person state, because it is per person:
    // it is the answer to "where did this suggestion come from", and that
    // answer is different for the owner, a friend and a name on this phone.
    state.historySource = incoming.historySource || null;
    saveDraft(state);
    renderAll();
  }

  /**
   * Put somebody in this workout.
   *
   * `meta` is `{ uid }` for a friend, `{ personId }` for a saved identity, or
   * empty for a name that has not been saved yet.
   */
  async function addPerson(rawName, meta = {}) {
    const name = String(rawName || '').trim();
    if (!name) { toast('Give them a name first'); return false; }
    if (name.length > 40) { toast('That name is too long'); return false; }
    const taken = ['you', 'me', ...state.guestNames.map((n) => n.toLowerCase())];
    if (taken.includes(name.toLowerCase())) { toast(`${name} is already in this workout`); return false; }

    if (!state.personMeta) state.personMeta = {};
    state.personMeta[name] = {
      ...(meta.uid ? { uid: meta.uid } : {}),
      ...(meta.personId ? { personId: meta.personId } : {}),
    };

    // Their own history, so their second session arrives with their own numbers
    // and their own suggestion — not blank, and never the owner's.
    const { sessions, source } = await historyForPerson(name);

    /* 🚨 THEY JOIN THE WORKOUT AS IT IS NOW, NOT AS THE TEMPLATE WROTE IT —
     * 2026-09-10, and this is the other half of the same instruction. This used
     * to build from `planned`, the saved workout, so somebody added after the
     * group had added, removed or swapped anything arrived **out of shape with
     * everybody** — the exact fault the shared operations exist to fix,
     * arriving through the one door that does not go through them.
     *
     * ⚠️ THE SHAPE IS COPIED; THE NUMBERS ARE NOT. Each entry is rebuilt from
     * THEIR OWN history (`sessions`, read above) exactly as a shared add or
     * swap does — never from the entry beside it, which would be the owner's
     * weights in a newcomer's field.
     *
     * ⚠️ FALLS BACK TO THE TEMPLATE IF ANY EXERCISE CANNOT BE RESOLVED. A
     * missing row would otherwise throw inside `buildEntry` and lose the whole
     * add; a person on the template's list is merely out of date, which is
     * where they used to start anyway. */
    const shaped = state.entries.map((e) => {
      const ex = exMap.get(e.exerciseId);
      return ex ? buildEntry(ex, {
        plannedSets: e.plannedSets,
        group: e.group,
        setType: e.setType,
        plannedMinis: e.plannedMinis,
        ...(e.addedToday ? { addedToday: true } : {}),
      }, sessions, null) : null;
    });
    const theirEntries = state.entries.length && shaped.every(Boolean)
      ? shaped
      : entriesFor(sessions, null, state.date);
    /* 🚨 THEY JOIN WHERE THE WORKOUT IS, not at the top — 2026-09-10, and it
     * follows from the same instruction as the shared walk. Somebody added at
     * exercise four is doing exercise four; starting them at zero puts the one
     * person who just arrived out of step with everybody, which is the thing
     * being fixed. Their earlier exercises stay blank, which is true — they
     * were not there. Clamped, because their list is built from their own
     * history and can be a different length. */
    const theirSteps = stepsFor(theirEntries.map((e) => ({ sets: e.sets.length, group: e.group }))).length;
    state.guestNames.push(name);
    state.others.push({
      name,
      entries: theirEntries,
      index: theirSteps ? Math.max(0, Math.min(state.index, theirSteps - 1)) : 0,
      bodyWeight: null,
      historySource: source,
    });

    saveDraft(state);
    // Adding somebody is followed by logging their first set, so the switch
    // is part of the add rather than a second tap.
    switchTo(name);
    return true;
  }

  /**
   * ⚠️ THE PICKER LEADS WITH FRIENDS, and that is Tim's whole point: the common
   * case is two people who both have accounts, and inventing a name for
   * somebody who already has one is exactly the mistake this screen used to
   * force. Typing a name is still there, one tap down, for the training partner
   * who has no account — which is the case the guest half was built for.
   *
   * ⚠️ THE TWO LISTS COME FROM DIFFERENT PLACES ON PURPOSE. Friends are read
   * live off the friends list every time; saved people come off this account.
   * Copying a friend into the saved roster would be copying a name that goes
   * stale the day they rename themselves — and their uid already identifies
   * them better than any label could.
   */
  function openAddPerson() {
    const already = new Set(state.guestNames.map((n) => n.toLowerCase()));
    const body = el('div', { class: 'list' });
    const { close } = openSheet({ title: 'Who is training with you?', body });

    const nameRow = (label, sub, onPick, extra) => el('div', { class: 'person-pick' },
      el('button', {
        class: 'row', style: 'flex:1;min-width:0;text-align:left',
        onClick: async (e) => {
          e.currentTarget.disabled = true;
          if (await onPick()) close(); else e.currentTarget.disabled = false;
        },
      }, el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: label }),
        // ⚠️ `.wrap`, because `.row-sub` is nowrap-with-an-ellipsis and this
        // line is the one that says what the tap will DO. Measured at 360px
        // without it: "their workout is sent to them at the e…" — the half
        // that matters, cut. Exactly the fault found on the visibility sheet
        // on 2026-08-18 ("…your muscle map and your pr…").
        sub ? el('div', { class: 'row-sub wrap', text: sub }) : null)),
      extra || null,
    );

    function typeANameSheet() {
      const input = el('input', {
        class: 'input', type: 'text', placeholder: 'Their name',
        'aria-label': 'Their name', maxlength: '40', autocomplete: 'off',
      });
      const sheet = openSheet({
        title: 'Someone new',
        body: el('div', {},
          el('p', { class: 'field-help', style: 'margin-top:0', text:
            'For somebody with no account. Their sets are kept here, on your '
            + 'account, under their name — never mixed into your own training '
            + 'or your stats. They are saved to your list, so next time they '
            + 'are one tap.' }),
          el('div', { class: 'field' }, el('label', { text: 'Name' }), input),
        ),
        footer: el('div', { class: 'btn-row' },
          el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => sheet.close() }),
          el('button', { class: 'btn primary', text: 'Add', onClick: async () => {
            const name = String(input.value || '').trim();
            if (!name) { toast('Give them a name first'); return; }
            // ⚠️ SAVED BEFORE THEY ARE ADDED, so the identity exists even if
            // this session is abandoned — "I typed their name once" is the
            // whole of what Tim asked to stop happening twice. A failure to
            // save the identity must NOT stop the workout: they still join,
            // just unsaved.
            let personId = null;
            try {
              // savePerson() is idempotent by name, so re-typing somebody who
              // is already on the list returns THEIR identity rather than a
              // second one — the dedupe is in the store, where the next caller
              // gets it for free.
              personId = (await store.savePerson({ name })).id;
            } catch (_) { /* the roster is a convenience; the workout is not */ }
            if (await addPerson(name, personId ? { personId } : {})) { sheet.close(); close(); }
          } }),
        ),
      });
      input.focus();
    }

    // Painted immediately with what needs no network, then filled in — the
    // shape views-social.js uses, and for the same reason: a sheet that waits
    // on the cloud before showing anything is a sheet that feels broken in a
    // gym basement.
    setChildren(body,
      el('div', { class: 'field-help', style: 'margin-top:0', text: 'Loading…' }));

    (async () => {
      // ⚠️ NOT named `social` — that is the imported module, and destructuring
      // over it shadows the import for the whole scope, putting the very call
      // on the line above into the temporal dead zone. Caught by the tests.
      const [people, net] = await Promise.all([
        store.getPeople().catch(() => []),
        social.state().catch(() => ({ available: false, connections: [] })),
      ]);
      const friends = (net.available ? net.connections || [] : [])
        .filter((c) => c.uid && !already.has(String(c.name || '').trim().toLowerCase()));
      const saved = people.filter((p) => !already.has(p.name.trim().toLowerCase()));

      const rows = [];

      rows.push(el('div', { class: 'section-label', text: 'Your friends' }));
      if (friends.length) {
        rows.push(...friends.map((c) => nameRow(
          c.name || 'Friend',
          'Has an account — their workout is sent to them when you finish',
          () => addPerson(c.name || 'Friend', { uid: c.uid }),
        )));
      } else {
        /* ⚠️ `net.available`, NOT `social.available` — fixed 2026-08-31. The
         * module has no `available` property; it is a field of what `state()`
         * resolves to, and `net` two lines up IS that answer. So this read
         * `undefined` for everybody and a signed-in person with no friends yet
         * was told to sign in. Found while writing the same expression somewhere
         * else and checking it. */
        rows.push(el('div', { class: 'field-help', text: net.available
          ? 'Nobody yet. Connect on the Friends tab and they show up here.'
          : 'Sign in and connect with somebody on the Friends tab to record for them.' }));
      }

      if (saved.length) {
        rows.push(el('div', { class: 'section-label', text: 'People you record for' }));
        rows.push(...saved.map((p) => nameRow(p.name, 'No account — kept on your phone',
          () => addPerson(p.name, { personId: p.id }),
          // Delete is a SIBLING of the row button, never a child — the same
          // rule the set list follows, for the same two reasons: nesting is
          // invalid HTML, and a stopPropagation guard works until somebody
          // adds the next control.
          el('button', {
            class: 'set-del', 'aria-label': `Remove ${p.name} from your list`,
            onClick: () => confirmSheet({
              title: `Remove ${p.name}?`,
              message: 'This only takes them off this list. Every workout you '
                + 'recorded for them stays on your calendar exactly as it is.',
              confirmLabel: 'Remove',
              onConfirm: async () => {
                await store.deletePerson(p.id);
                toast(`${p.name} removed from your list`);
                close();
              },
            }),
          }, icon('trash')))));
      }

      rows.push(el('button', {
        class: 'btn block', style: 'margin-top:10px', onClick: typeANameSheet,
      }, icon('plus', 15), 'Someone new'));

      setChildren(body, ...rows);
    })();
  }

  /**
   * Take somebody back out of this workout.
   *
   * Tim, 2026-08-30: *"allow the user to also remove one of the people they're
   * recording data with in case it was just a test, or an accident, or
   * something happened."*
   *
   * ⚠️ NOTHING IS ON DISK YET, and that is what makes this clean. A guest's
   * sets live in the draft until `finish()` writes them, so removing somebody
   * mid-session deletes a plan, not a record — there is no stored row to
   * orphan and nothing to undo on the server. The one thing that IS already on
   * disk is the saved identity (`store.people`, written the moment a name is
   * typed), and this deliberately does not touch it: removing somebody from
   * today's workout is not the same act as deleting them from your list, which
   * has its own control in the add-person sheet. Same argument D22 makes about
   * deleting a system.
   *
   * ⚠️ CONFIRM ONLY WHERE THERE IS SOMETHING TO LOSE — the shape `removeExercise`
   * already uses. Pre-filled numbers are a plan; a set they actually did is a
   * record, and one tap must not be able to destroy one. An accidental add,
   * which is the case Tim names first, has nothing recorded and goes quietly.
   *
   * ⚠️ AND A FRIEND'S CONFIRM SAYS THE OTHER HALF: their session was going to
   * be offered to their own account at Finish, and after this it is not. That
   * is a consequence outside this phone, so it does not get to be implied.
   */
  function removePerson(name) {
    const at = state.guestNames.indexOf(name);
    if (at < 0) return;
    const meta = metaFor(name) || {};

    const parked = state.others.find((o) => o.name === name);
    const theirEntries = state.forName === name ? state.entries : (parked ? parked.entries : []);
    const recorded = (theirEntries || []).reduce(
      (n, e) => n + e.sets.filter((s) => setIsRecorded(s, e.fields)).length, 0);

    const doRemove = () => {
      // Off their chip first if they are the one being recorded for, so the
      // screen is never pointing at somebody who is no longer in the workout.
      if (state.forName === name) switchTo(null);
      state.guestNames.splice(state.guestNames.indexOf(name), 1);
      state.others = state.others.filter((o) => o.name !== name);
      if (state.personMeta) delete state.personMeta[name];
      saveDraft(state);
      renderAll();
      toast(`${name} removed from this workout`);
    };

    if (!recorded) { doRemove(); return; }
    confirmSheet({
      title: `Remove ${name}?`,
      message: `${recorded} set${recorded === 1 ? '' : 's'} recorded for them will be deleted.`
        + (meta.uid
          ? `\n\n${name} has an account, and this workout will no longer be sent to them at the end.`
          : '\nThey stay on your list of people — this only takes them out of today.'),
      confirmLabel: 'Remove',
      onConfirm: doRemove,
    });
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
      ...state.guestNames.map((n) => {
        // ⚠️ A FRIEND'S CHIP SAYS SO, because the two are not the same promise.
        // A guest's sets stop here; a friend's are going to be offered to their
        // account at Finish, and somebody switching between two names deserves
        // to know which of those they are typing into BEFORE they finish rather
        // than on the summary screen.
        const meta = metaFor(n) || {};
        const active = state.forName === n;
        const chip = el('button', {
          class: 'chip person-chip' + (meta.uid ? ' is-account' : '') + (active ? ' has-del' : ''),
          'aria-pressed': active ? 'true' : 'false',
          title: meta.uid ? `${n} has an account — this is sent to them at the end` : null,
          onClick: () => switchTo(n),
        }, meta.uid ? icon('person', 12) : null, n);
        if (!active) return chip;
        /* ⚠️ THE REMOVE ✕ EXISTS ONLY ON THE PERSON YOU ARE ALREADY RECORDING
         * FOR, and that is the safety design rather than a layout economy.
         * It means a destructive control is never adjacent to the chip you are
         * aiming at to SWITCH — a mis-tap on a crowded bar would otherwise
         * delete somebody's session instead of opening it. Getting to it costs
         * the tap you would take anyway (switch to them, look at what they have
         * done), and in the case Tim leads with — an accidental add — the app
         * has just switched to them for you, so the ✕ is already there.
         *
         * A SIBLING of the chip, never a child: a button inside a button is
         * invalid HTML and would need a stopPropagation that works until the
         * next control is added. `.set-del` learned this on the set row. */
        return el('span', { class: 'person-wrap' }, chip, el('button', {
          class: 'person-del',
          'aria-label': `Remove ${n} from this workout`,
          title: `Remove ${n} from this workout`,
          onClick: () => removePerson(n),
        }, icon('x', 13)));
      }),
      el('button', {
        class: 'chip person-chip person-add',
        'aria-label': 'Add a person to record for',
        onClick: openAddPerson,
      }, icon('plus', 13), solo ? 'Add a person' : ''),

      /* 🚨 "JUST FOR ____" — Tim, 2026-09-10, and the label is his: it names
       * *"the user that is currently selected"*, so it reads "Just for you" on
       * the owner and "Just for Alex" on a guest.
       *
       * ⚠️ ONLY WHEN THERE IS SOMEBODY TO BE APART FROM. On a solo workout
       * every change already applies to exactly one person, and a button
       * offering to narrow that is a control that does nothing — worse, it
       * implies the app is doing something to somebody else.
       *
       * 🛑 IT IS A MODE, NOT A PER-ACTION CHOICE, which is what he asked for
       * and is also the only version that works one-handed in a gym: the
       * alternative is a question on top of every swap, remove, add and drag.
       * `aria-pressed` is what says which way it is set, the same as the
       * person chips beside it. */
      solo ? null : el('button', {
        class: 'chip just-for' + (state.justForActive ? ' is-on' : ''),
        'aria-pressed': state.justForActive ? 'true' : 'false',
        title: state.justForActive
          ? 'Changes apply only to ' + (state.forName || 'you')
          : 'Changes apply to everybody in this workout',
        onClick: () => {
          state.justForActive = !state.justForActive;
          saveDraft(state);
          renderAll();
          toast(state.justForActive
            ? `Changes now apply to ${state.forName || 'you'} only`
            : 'Changes now apply to everybody in this workout');
        },
      }, `Just for ${state.forName || 'you'}`),
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

  /* ================================================================== *
   * 🆕 A SET LOCKS WHEN YOU MOVE ON FROM IT — 2026-09-12, Tim:
   *
   * *"Sometimes a user mixes up sets and adjusts something that doesn't need
   * to be adjusted for a past set or something. To fix this, when a user moves
   * on from a set, automatically 'lock' the set they just finished which
   * doesn't allow the user to change any measurements for that set until they
   * unlock it. The lock adjustments will be a visual lock on the right side of
   * the set which animates being locked and unlocked when you click on it."*
   *
   * WHAT "MOVES ON" MEANS, decided here and nowhere else:
   *   • opening a DIFFERENT set of the same exercise (`select`);
   *   • leaving the exercise — next, previous, a banner member, a swap's split,
   *     a remove — which all go through `goToStep`; inside a superset a new
   *     ROUND on the same exercise counts too, because round 1's set is done;
   *   • "Add set" on a solo exercise, which moves the steppers to the new set.
   *   NOT: collapsing the open row, or tapping off it. `collapse()` leaves
   *   `entry.active` where it was — its own header says closing is about what
   *   is on screen, not about losing your place — and a set you have merely
   *   stopped looking at is not a set you have finished. NOT switching person:
   *   `switchTo` parks the whole state and you come back to the same set.
   *
   * 🚨 ONLY A SET THAT IS ACTUALLY RECORDED LOCKS — `setIsRecorded`, the one
   * copy of that rule. A blank set, or one still carrying the app's `prefilled`
   * opening numbers, was never finished; locking it would lock a suggestion the
   * lifter never made and put a padlock on a number nobody typed.
   *
   * ⚠️ A DROP LOCKS WITH ITS SET. `locked` lives on the parent set object and
   * covers every mini-set under it, for the reason the whole data model gives
   * (D23): one drop set is one hard set. Opening a drop of the set you are on
   * is not moving on; opening the next set is, and the padlock shuts on all of
   * it at once.
   *
   * ⚠️ WHAT LOCKED MEANS ON SCREEN: the row cannot be opened and cannot be
   * deleted — its text is not a control at all, and the padlock on the right is
   * the one live thing on it. Tapping the padlock unlocks the set AND opens it,
   * because the only reason to unlock is to change something.
   *
   * ⚠️ THE STATE IS `locked: true` ON THE DRAFT SET, so a workout you put down
   * and pick up keeps its locks — and it is DROPPED AT SAVE the way `prefilled`
   * is (`cleanedEntriesOf`), because it is a fact about the screen, not about
   * the training. In a joint workout it is therefore per person by
   * construction, and it is deliberately NOT broadcast the way a walk is: the
   * app knows the person whose steppers these are has moved on, and knows
   * nothing about whether Rae has.
   *
   * ⚠️ THE ANIMATION IS A ONE-SHOT, CONSUMED BY THE NEXT RENDER — the same
   * shape as `requestRise()`. A lock is applied by a mutation and the row is
   * REBUILT by the render that follows, so the movement cannot be a transition
   * on a node that is about to be thrown away; instead the rebuilt padlock
   * plays a keyframe from the state it left (`lock-shuts` / `lock-opens`,
   * `--t`, `--ease-both`), and the list of sets owed one is emptied by the
   * render that paints them so nothing replays on the render after.
   * ================================================================== */
  let lockFlashes = [];   // [{ set, to: 'shut' | 'open' }] — see above

  /** Lock `entry.sets[i]` if it is a set somebody actually did. */
  function lockSet(entry, i) {
    const s = entry && entry.sets[i];
    if (!s || s.locked || !setIsRecorded(s, entry.fields)) return false;
    s.locked = true;
    lockFlashes.push({ set: s, to: 'shut' });
    return true;
  }

  // Moving between steps re-points the steppers at the round you are on. Inside
  // a step you can still tap any set to fix a typo from round one.
  function goToStep(i) {
    const all = steps();
    // Who is being LEFT — read before the index moves, so the set that locks
    // is the one the steppers were on and not whatever the walk lands on.
    const leaving = entryHere();
    const leavingAt = leaving ? leaving.active : -1;
    state.index = Math.max(0, Math.min(i, all.length - 1));
    // 🚨 EVERYBODY MOVES — Tim, 2026-09-10: "when the user clicks 'next
    // exercise', it should move to the next exercise for both users, not just
    // one." Unless "Just for …" is on, in which case one person is walking
    // their own list and the whole point is that they move alone.
    syncWalk(state.index);
    const step = all[state.index];
    let landed = null;
    if (step) {
      const entry = state.entries[step.entryIndex];
      if (entry) {
        entry.active = step.round == null
          ? Math.min(entry.active || 0, entry.sets.length - 1)
          : Math.min(step.round, entry.sets.length - 1);
        entry.activeDrop = null;
        landed = entry;
      }
    }
    // ⚠️ A different exercise, OR the same one on a different set (a superset
    // round). Landing back on the very set you were on — a reorder's
    // `repointOn`, a re-render — is not moving on and locks nothing. And an
    // entry that has just been REMOVED is not in the list any more; its sets
    // are gone with it and there is nothing to lock.
    if (leaving && state.entries.includes(leaving)
        && (landed !== leaving || leaving.active !== leavingAt)) {
      lockSet(leaving, leavingAt);
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
        /* ⚠️ FINISH OPENS THE SAVE SCREEN; IT NO LONGER SAVES (2026-09-07).
         * The write happens from the button there, so the description, the gym
         * and the day are asked once, at the end, over a summary of what is
         * about to be recorded. The draft is untouched until that tap. */
        ? el('button', { class: 'btn good', onClick: openSaveScreen }, icon('check'), 'Finish workout')
        : el('button', {
            class: 'btn primary' + (label === 'Next exercise' ? '' : ' is-linked'),
            onClick: () => goToStep(state.index + 1),
          }, label, icon('right')),
    );
  }

  /**
   * ⚠️ THE SET LIST IS THE SCREEN NOW, AND THE STEPPERS LIVE INSIDE THE OPEN SET.
   *
   * Tim, 2026-08-28: *"there should be no large current selected set details
   * display, and instead the list of sets should be large and share the space in
   * the middle, and then when you select one, it makes it larger and you can add
   * or subtract the weight amount or number of reps after it is open."*
   *
   * The screen used to say the same numbers twice — a detached block of big
   * steppers headed "SET 1 OF 4", and then set 1 again in the list underneath
   * it, both live, both editing the same object. The link between them was the
   * heading and the accent square, which is a thing you work out rather than a
   * thing you see. Now there is one set of numbers per set, in the row that IS
   * that set, and the row you are on is the one that carries the controls.
   *
   * ⚠️ THE DIGITS AND THE ± TARGETS DID NOT SHRINK, and that is deliberate: the
   * 2026-08-28 usability drive listed "the runner's huge stepper digits" among
   * the things not to break chasing anything else. The same `.steppers` grid
   * moves into the open row unchanged; what is saved is the ~200px the detached
   * block and its heading were spending to show a copy of row one.
   *
   * ⚠️ AND EXACTLY ONE SET IS ALWAYS OPEN. Tapping the open row does not close
   * it. `entry.active` has always been what the steppers point at, so a
   * collapsed-to-nothing state would be a state with no way to log a number.
   */
  /* ================================================================== *
   * 🆕 THE BENCHMARK FORM'S TWO CAPTIONS, ON EVERY SET — 2026-09-11, Tim:
   *
   * *"Right now when a user is recording a benchmark, it estimates the number
   * of reps that user could do based on the weight that is displayed, and it
   * also shows you the percentage of your estimated max when you select a
   * weight. I want you to do the exact same thing for a regular workout by just
   * displaying the tiny '_% of estimated max' and 'maybe __ reps to failure'
   * above the weight and reps. This will help the user estimate how much
   * weight they should put on during a set."*
   *
   * Same arithmetic, same words, same slot in the stepper as `BenchmarkView`'s
   * `renderCaptions()` — `percentOfMax()` and `repPrediction()` are the one
   * definition of both numbers, so the two screens cannot disagree.
   *
   * 🚨 IT IS A READ, NOT A LOAD, AND THE DISTINCTION IS THE WHOLE OF
   * `exercise-estimate.js`'s HEADER. The opening-weight suggestion above
   * (`derivedWeights`) puts a number IN the field and is gated hard for it. A
   * caption beside a number the lifter typed themselves changes nothing about
   * what is on the bar: it says where the app thinks that weight sits, and
   * "maybe 8 to failure" is the same guess the benchmark screen has printed
   * since 2026-09-02, worded as a guess for the reason recorded there —
   * research.md §3, people under-predict their own reps to failure by one to
   * five and this app has no reps-in-reserve field (D28).
   *
   * 🛑 NO `allowFallback`. The benchmark form is that option's ONE named caller
   * and its header says a fourth screen is a new decision, not this one. Here
   * the refusal is the default: no direct contribution, no rating, a stand-in
   * rating, a custom exercise → no caption, silently. A blank caption on the
   * logging path is nothing lost; a three-hop number beside a bar is.
   *
   * 🚨 PER PERSON, OR IT IS THE CROSS-PRESCRIPTION 0e FORBIDS. A joint workout
   * switches names and the whole suggestion switches with it; a "% of your
   * estimated max" computed from the OWNER's muscle ratings and shown to a guest
   * would be the owner's max wearing the guest's name. So the ratings are built
   * per person from THEIR sessions — `muscleRatings(rows)` takes them by hand —
   * exactly the walk `historyForPerson()` already does for the suggestion. A
   * guest with no history gets no caption, which is the honest answer.
   *
   * ⚠️ LAZY AND CACHED. `muscleRatings()` walks a whole history, so it runs once
   * per person per runner and the pane paints without waiting for it; the
   * captions fill in when it lands, if the open set is still on screen.
   * ================================================================== */
  const ratingsByPerson = new Map();   // name (null → '') → Promise<Map|null>
  const ratingsReady = new Map();      // the same key → the resolved Map
  const personKey = (name) => (name == null ? '' : String(name));
  function ratingsFor(name) {
    const key = personKey(name);
    if (!ratingsByPerson.has(key)) {
      const p = (name == null
        ? muscleRatings()
        : sessionsForName(name).then((sessions) => muscleRatings({
            sessions: sessions || [],
            benchmarks: [],
            // Their weigh-in as the runner knows it, for a bodyweight lift.
            // One row, dated today: `bodyWeightOn()` reads the nearest earlier
            // one, and a guest has no series to read from.
            bodyWeights: state.bodyWeight > 0 ? [{ date: state.date, weight: state.bodyWeight }] : [],
          })))
        .then((m) => { ratingsReady.set(key, m || new Map()); return m; })
        .catch(() => { ratingsReady.set(key, new Map()); return null; });
      ratingsByPerson.set(key, p);
    }
    return ratingsByPerson.get(key);
  }

  function renderPane(opts) {
    const keepScroll = Boolean(opts && opts.keepScroll);
    const wasAt = pane.scrollTop;
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
      // ⚠️ A SET STILL MARKED `prefilled` COUNTS AS EMPTY HERE (2026-08-29).
      // Since a never-done exercise opens at 10 reps rather than at zeros, the
      // old "does it have any number in it" test said every set was already
      // filled and this stopped running at all — so set 2 of a first-ever
      // exercise no longer inherited the weight just typed into set 1. Empty
      // has always meant "nobody has put anything here", and a number the app
      // worked out is not somebody putting something there.
      if (!s.prefilled && entry.fields.some((f) => Number(s[f]) > 0)) return;
      if (minisOf(s).length) return;
      // The nearest set above with anything in it — not strictly i-1, so
      // skipping a set does not hand the next one a row of zeros. Same rule:
      // a set nobody has touched is not a source worth copying.
      for (let j = i - 1; j >= 0; j--) {
        const src = entry.sets[j];
        if (!src.prefilled && entry.fields.some((f) => Number(src[f]) > 0)) {
          // Fields only. A drop hangs off the set it was stripped from and the
          // app has never claimed to know how much lighter it is, so copying
          // one into a set nobody has reached yet would be a guess arriving
          // before the question.
          entry.sets[i] = { ...s, ...pickFields(src, entry.fields) };
          // Filled from a set somebody really did, so it is no longer a guess.
          delete entry.sets[i].prefilled;
          return;
        }
      }
    }

    function select(i, dropIndex) {
      // A locked set has no way in but its padlock — see the lock block above
      // `goToStep`. Its row is not a control, so this is belt and braces for a
      // caller that reaches it another way.
      if (!entry.sets[i] || entry.sets[i].locked) return;
      // Opening a DIFFERENT set is moving on from this one. A drop of the same
      // set is not: it is the same hard set, continued.
      if (i !== entry.active) lockSet(entry, entry.active);
      if (dropIndex == null) fillOnOpen(i);
      entry.active = i;
      entry.activeDrop = dropIndex;
      entry.editing = true;
      saveDraft(state);
      // ⚠️ KEEP THE SCROLL. The controls are inside the list now, so a render
      // that jumped back to the top would throw away the position of the row
      // somebody just tapped — set 4 of a long exercise would open off-screen.
      renderPane({ keepScroll: true });
    }

    /**
     * Shut the open set, leaving it selected.
     *
     * ⚠️ `entry.active` IS NOT CLEARED, and that is the difference between this
     * and a list with nothing chosen. The set stays the one the steppers point
     * at the moment it is reopened — closing is about what is on screen, not
     * about losing your place. Tapping the row again, or any dead space on the
     * screen, is what runs this.
     */
    function collapse() {
      entry.editing = false;
      entry.activeDrop = null;
      saveDraft(state);
      renderPane({ keepScroll: true });
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
    /* Every row's live value span, so a nudge can repaint the numbers WITHOUT
     * rebuilding the list.
     *
     * ⚠️ THIS IS LOAD-BEARING NOW THAT THE STEPPERS ARE INSIDE THE LIST. The
     * old code re-rendered the whole list on every `onChange`, which was free
     * while the steppers sat outside it — and would now tear down the very
     * input somebody is typing into, blurring it after the first digit. Rows
     * are only ever added or removed through `renderAll()`, so an in-place
     * text update is both the safe move and the cheap one. */
    const liveRows = [];
    function syncSetValues() {
      for (const r of liveRows) {
        if (r.vals) {
          const t = r.read();
          r.vals.textContent = t;
          r.pick.setAttribute('aria-label', r.name(t));
        }
        // The padlock is only offered on a set somebody has actually done, and
        // the first number typed into a fresh set is what makes it one — so the
        // open row's padlock appears IN PLACE on that keystroke, the same way
        // the values do, rather than waiting for a rebuild.
        if (r.lock) r.lock.classList.toggle('is-idle', !setIsRecorded(r.set, entry.fields));
      }
    }

    /**
     * The padlock on the right of a set row — see the lock block above
     * `goToStep` for what it means and when it shuts by itself.
     *
     * ⚠️ A SIBLING OF `.set-pick`, NEVER ITS CHILD, for the reason `.set-del`
     * gives: a button inside a button is invalid HTML and would need a
     * stopPropagation that holds until the next control is added. Delete and
     * the padlock share the right of the row like this: the padlock is the
     * OUTERMOST thing on every row, in a slot every row reserves (so delete
     * never walks sideways between one row and the next), and delete sits to
     * its left — until the set is locked, when delete is not rendered at all,
     * because a locked set cannot be deleted and a control that refuses is
     * worse than one that is absent.
     *
     * ⚠️ TWO <svg>s, ONE GLYPH. `icon()` draws one path per call and the
     * shackle has to move on its own, so the body and the shackle are drawn
     * over each other in the same viewBox and CSS rotates the second about its
     * right leg. See the `lock-body` / `lock-shackle` note in ui.js.
     *
     * ⚠️ `is-idle` IS `visibility: hidden`, NOT `display: none` — the slot has
     * to keep its width for the alignment argument above, and a hidden button
     * leaves the accessibility tree either way.
     *
     * `null` draws the spacer a drop row uses: a drop has no padlock of its
     * own because its parent's covers it (one hard set), but its delete still
     * has to sit in delete's column.
     */
    function lockButton(lock) {
      if (!lock) return el('span', { class: 'set-lock-gap' });
      const shackle = icon('lock-shackle', 17);
      shackle.classList.add('lock-shackle');
      const flash = lockFlashes.find((f) => f.set === lock.set);
      return el('button', {
        class: 'set-lock'
          + (lock.locked ? ' is-locked' : '')
          + (setIsRecorded(lock.set, entry.fields) ? '' : ' is-idle')
          + (flash ? (flash.to === 'shut' ? ' lock-shuts' : ' lock-opens') : ''),
        'aria-label': (lock.locked ? 'Unlock ' : 'Lock ') + lock.name,
        title: lock.locked ? 'Unlock this set to change it' : 'Lock this set so it cannot be changed',
        onClick: lock.onToggle,
      }, icon('lock-body', 17), shackle);
    }

    /* ⚠️ THE ROW BECOMES THE CONTROLS. IT DOES NOT GROW A SECOND ONE.
     *
     * Tim, 2026-08-31: *"when you click on a set, it ADDs a big box underneath
     * it that shows the weight and reps that you can change, however, I would
     * rather make the set itself change so that it morphs into the weight and
     * reps adjustment box, and then when you click off it it goes back to being
     * normal. this way it doesn't have 2 places for the same thing."*
     *
     * 🚨 SO THE VALUE TEXT IS NOT RENDERED ON AN OPEN ROW AT ALL, and that is
     * the load-bearing part rather than the layout. `135 lbs × 10` above a
     * stepper reading 135 and a stepper reading 10 is the same fact twice,
     * three inches apart, both live — which is the exact duplication the
     * 2026-08-28 restructure removed between the detached stepper block and the
     * list, arriving back one level down. The steppers ARE the row's numbers
     * now; there is one place to read them and one place to change them.
     *
     * ⚠️ THE SET NUMBER SURVIVES INTO THE OPEN STATE and the delete stays its
     * sibling, so the row keeps its identity while it is open and `.set-del`
     * keeps the position it has had since it was pulled out of `.set-pick`.
     */
    /* ⚠️ A LOCKED ROW IS NOT A CONTROL (2026-09-12). Its `.set-pick` is a
     * <div> carrying the same number and values, not a disabled <button>: a
     * button that is on screen and does nothing is the fault the five inert
     * back buttons taught this project, and `aria-disabled` is the same fault
     * with a label on it. The padlock beside it is the row's one live thing,
     * and its name says what tapping it does. Nothing on a locked row is
     * registered in `liveRows`, because nothing on it can change. */
    function setRow({ open, locked, lock, className, num, label, onOpen, onDelete, delLabel, valueText }) {
      if (locked) {
        const row = el('div', { class: `${className} is-locked` },
          el('div', { class: 'set-pick' }, num(), el('span', { class: 'set-vals', text: valueText() })),
          lockButton(lock),
        );
        return { row, live: null };
      }

      if (!open) {
        const vals = el('span', { class: 'set-vals', text: valueText() });
        const pick = el('button', {
          class: 'set-pick',
          'aria-label': label(valueText()),
          'aria-expanded': 'false',
          onClick: onOpen,
        }, num(), vals);
        const lockNode = lockButton(lock);
        const row = el('div', { class: className },
          pick,
          onDelete ? el('button', { class: 'set-del', 'aria-label': delLabel, onClick: onDelete }, icon('trash')) : null,
          lockNode,
        );
        return { row, live: { vals, pick, read: valueText, name: label, lock: lock ? lockNode : null, set: lock ? lock.set : null } };
      }

      const lockNode = lockButton(lock);
      const row = el('div', { class: `${className} active is-open` },
        el('div', { class: 'set-open-head' },
          // Tapping the open row closes it, which is the other half of "click
          // off it and it goes back to normal" — the half that works when the
          // screen is full of controls and there is no dead space to tap.
          el('button', {
            class: 'set-pick',
            'aria-label': `${label(valueText())}. Close`,
            'aria-current': 'true',
            'aria-expanded': 'true',
            onClick: collapse,
          }, num(), el('span', { class: 'set-open-caret' }, icon('up', 15))),
          onDelete ? el('button', { class: 'set-del', 'aria-label': delLabel, onClick: onDelete }, icon('trash')) : null,
          lockNode,
        ),
        editor,
      );
      // The open row prints no values, but its padlock is live: it has to
      // appear the moment the first number makes this a recorded set.
      return { row, live: lock ? { vals: null, pick: null, lock: lockNode, set: lock.set } : null };
    }

    function renderSets() {
      const rows = [];
      liveRows.length = 0;
      // Closed by a tap on the open row or on the screen behind it. Undefined —
      // every draft written before 2026-08-31, and every entry the runner has
      // just built — means open, which is the state this screen has always
      // arrived in.
      const editing = entry.editing !== false;

      entry.sets.forEach((s, i) => {
        const isHere = i === entry.active;
        const locked = Boolean(s.locked);
        // ⚠️ `entry.active` can point at a locked set — you came back to this
        // exercise with Previous, or you locked the open row by hand — and then
        // nothing is open. That is the one state in which "exactly one set is
        // always open" is false, and it is honest: the steppers stay pointed
        // at a set that refuses them until it is unlocked or another is tapped.
        const open = isHere && entry.activeDrop == null && editing && !locked;
        const lock = {
          set: s,
          locked,
          name: `set ${i + 1}`,
          onToggle: locked
            ? () => {
                // Unlocking is opening: the only reason to unlock a set is to
                // change it. Goes through `select` so the set you were on
                // locks behind you like any other move.
                delete s.locked;
                lockFlashes.push({ set: s, to: 'open' });
                select(i, null);
              }
            : () => {
                // Locking by hand. `lockSet` refuses a set with nothing in it,
                // and the padlock is not visible on one, so this cannot be a
                // tap that silently does nothing.
                if (!lockSet(entry, i)) return;
                if (entry.active === i) entry.activeDrop = null;
                saveDraft(state);
                renderPane({ keepScroll: true });
              },
        };
        const { row, live } = setRow({
          open,
          locked,
          lock,
          className: 'set-item',
          num: () => el('span', { class: 'set-num', text: String(i + 1) }),
          label: (t) => `Set ${i + 1}: ${t}`,
          valueText: () => fmtSet(s, entry.fields, entry.loadType),
          onOpen: () => select(i, null),
          delLabel: `Delete set ${i + 1}`,
          onDelete: entry.sets.length > 1 ? () => {
            entry.sets.splice(i, 1);
            entry.active = Math.min(entry.active, entry.sets.length - 1);
            entry.activeDrop = null;
            saveDraft(state);
            renderAll();
          } : null,
        });
        if (live) liveRows.push(live);
        rows.push(row);

        // Drops hang UNDER their set and are indented, because that is what they
        // are — the same set continued at a lower weight. They are deliberately
        // not numbered as sets: one drop set is one hard set (docs/handbook.md §6),
        // and numbering them 1, 2, 3 would teach the opposite.
        minisOf(s).forEach((d, di) => {
          const dOpen = isHere && entry.activeDrop === di && editing && !locked;
          const { row: dRow, live: dLive } = setRow({
            open: dOpen,
            // A drop is locked by its parent and has no padlock of its own —
            // one hard set, one lock. `lock: null` draws the spacer.
            locked,
            lock: null,
            className: 'set-item set-drop',
            // Same restructure as the set row above, for the same reason: the ↳
            // is a 22px glyph and the numbers beside it are what a thumb aims at.
            num: () => el('span', { class: 'set-num drop-num', text: '↳' }),
            label: (t) => `${miniLabel(entry.setType, di + 1)} of set ${i + 1}: ${t}`,
            valueText: () => fmtSet(d, entry.fields, entry.loadType),
            onOpen: () => select(i, di),
            delLabel: `Delete ${miniLabel(entry.setType, di + 1)}`,
            onDelete: () => {
              s.minis.splice(di, 1);
              if (!s.minis.length) delete s.minis;
              entry.activeDrop = null;
              saveDraft(state);
              renderPane({ keepScroll: true });
            },
          });
          if (dLive) liveRows.push(dLive);
          rows.push(dRow);
        });
      });
      // The one-shot is spent by the render that painted it — every padlock
      // owed a movement has been built by now, and one that was not (a set on
      // an exercise that has since been removed) is owed nothing.
      lockFlashes = [];
      setChildren(setList, ...rows);
    }

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

    /* The two captions — see the block above `ratingsFor()`. Only a lift with
     * BOTH a weight and a rep count gets them: "% of max" on a plank is
     * meaningless and a rep guess on a carry is worse. `ex` can be missing for
     * an exercise deleted from the library since the draft was written. */
    const capSlots = {};
    const wantsCaptions = Boolean(ex) && entry.fields.includes('weight') && entry.fields.includes('reps');
    function renderCaptions() {
      if (!wantsCaptions) return;
      const ratings = ratingsReady.get(personKey(state.forName));
      const est = ratings ? estimateOneRM(ex, ratings, state.bodyWeight) : null;
      const oneRM = est ? est.oneRM : 0;
      const w = Number(target.weight) || 0;
      /* ⚠️ THE LOAD, NOT THE NUMBER IN THE BOX. On a bodyweight or assisted lift
       * the box holds what was ADDED or how much HELP was taken, and the rating
       * it is being compared against was built from the total on the body —
       * `totalResistance()` is the one copy of that sum. It returns null for
       * more help than you weigh, which is the same "check the number" case
       * `renderAssist()` already names, and no caption is right beside it. A
       * plain lift is the number itself, doubled for a per-side entry because
       * `oneRM` is total load. */
      let totalW = 0;
      if (assistSpec) {
        const res = w >= 0 && state.bodyWeight > 0 ? totalResistance(ex, w, state.bodyWeight) : null;
        totalW = res ? res.load : 0;
      } else {
        totalW = entry.loadType === 'per_side' ? w * 2 : w;
      }
      // ⚠️ NO ARITHMETIC ON NOTHING — the benchmark form's rule, and it is
      // sharper here: every never-done set opens at a derived or blank weight,
      // and "0 % of your estimated max" over a blank field reads as a reading.
      const live = oneRM > 0 && totalW > 0;
      if (capSlots.weight) {
        const pct = live ? percentOfMax(oneRM, totalW) : null;
        setChildren(capSlots.weight, pct === null
          ? ''
          : el('span', {}, el('b', { text: `${Math.round(pct)}%` }), ' of your estimated max'));
      }
      if (capSlots.reps) {
        const p = live ? repPrediction(oneRM, totalW) : null;
        setChildren(capSlots.reps, !p
          ? ''
          : p.over
            ? el('span', { text: 'at or above what we think your max is' })
            : el('span', {},
                'maybe ', el('b', { text: `${p.reps}${p.atLeast ? '+' : ''}` }), ' to failure'));
      }
    }

    const steppers = entry.fields.map((f) => {
      const s = stepper({
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
          // ⚠️ TOUCHING A NUMBER IS WHAT MAKES THE SET REAL. Until then it holds
          // what the app worked out, and `setIsRecorded` refuses to count it —
          // which is what stops a derived opening weight being saved as a set
          // somebody never did. One nudge, one keystroke, and it is theirs.
          delete target.prefilled;
          delete activeSet.prefilled;
          saveDraft(state);
          renderAssist();
          renderCaptions();
          // In place — see `syncSetValues`. Rebuilding the list would now
          // destroy the stepper that raised this.
          syncSetValues();
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
      });
      if (wantsCaptions && (f === 'weight' || f === 'reps')) {
        capSlots[f] = el('div', { class: 'step-est' });
        // Between the field's name and its big number — the benchmark form's
        // slot, so it reads as a note about the number rather than as another
        // number. The stepper node is the same one; only the insertion differs.
        s.node.insertBefore(capSlots[f], s.node.querySelector('.stepper-controls'));
      }
      return s.node;
    });

    // Paint now if this person's ratings are in, and again when they land —
    // guarded on the slot still being on screen, because a re-render since then
    // built a fresh one and this closure's node is in the bin.
    renderCaptions();
    if (wantsCaptions && !ratingsReady.has(personKey(state.forName))) {
      ratingsFor(state.forName).then(() => {
        if (capSlots.weight && capSlots.weight.isConnected) renderCaptions();
      });
    }

    const miniCount = minis.length;
    const wantsMinis = nested ? entry.plannedMinis : 0;

    /* THE OPEN SET'S CONTROLS. Built once per render and pushed into the list
     * under whichever row is active — a set row, or one of its drops. Keeping
     * it one node rather than one per row is what lets a drop's editor be the
     * same object as its parent set's, and keeps `renderAssist()` pointed at a
     * line that is actually on screen. */
    const editor = el('div', { class: 'set-open' },
      // ⚠️ NO "SET 3 OF 4" HEADING ON A PLAIN SET. The row directly above these
      // controls is that set, with its number in an accent square — a caption
      // repeating it is a second answer to a question the layout has already
      // answered, and it cost a line in the middle of the screen. A DROP is the
      // one case where it earns its place: the row shows "↳" and nothing says
      // which drop it is, or which set it hangs off.
      entry.activeDrop == null ? null : el('div', { class: 'set-open-label',
        text: `Set ${entry.active + 1} · ${miniLabel(entry.setType, entry.activeDrop + 1).toLowerCase()}` }),
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
                renderPane({ keepScroll: true });
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
    );

    renderSets();

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
          // ⚠️ The picture, where there is one — and the whole name is the
          // button that opens it full screen (Tim, 2026-08-30). This heading
          // is not inside a control, so it may BE one; the rows elsewhere
          // cannot, which is why exerciseLabel takes `inControl`.
          exerciseLabel({ exercise: ex, name: entry.exerciseName,
            tag: 'h2', className: 'session-ex-name' }),
        ),
        el('div', { class: 'session-ex-meta' },
          `${ex ? ex.muscle + ' · ' + ex.equipment + ' · ' : ''}Exercise ${step.entryIndex + 1} of ${state.entries.length}`,
        ),

        /* ⚠️ THESE THREE ARE LOUD NOW, AND THAT REVERSES A DECISION THIS FILE
         * ARGUED FOR. Tim, 2026-08-31: *"Make the swap and remove boxes in a
         * workout stand out just like the +add set button."* They were
         * deliberately quiet — transparent, `--ink-soft`, sitting beside the
         * name — on the reasoning that swapping is occasional and must not
         * compete with the steppers (D4). His answer is that a control you
         * cannot find is worse than one you can, and he is the one using this
         * in a gym. They wear `.pill-action`, which is `.add-set`'s shape.
         *
         * ⚠️ AND THEY MOVED OFF THE NAME'S LINE, which the quiet version could
         * afford and this one cannot: three pills beside a heading leaves about
         * 110px for "Chest-Supported Dumbbell Row" at 360px. The name gets its
         * own line back and the actions get a row.
         *
         * ⚠️ 44px OF TOUCH FROM 32px OF INK, via the ::before the icon buttons
         * have used since the first audit. Matching `.add-set` is a request
         * about how loud they look; it is not permission to ship a 32px target
         * on the screen most used one-handed. */
        el('div', { class: 'session-actions' },
          // ⚠️ OPENS ON A SHORTLIST SINCE 2026-08-30 (Tim's ask), with the full
          // 275-exercise picker one tap under it. `ex` can be undefined for a
          // session recorded against an exercise this account no longer has, so
          // the swap falls back to the old sheet rather than to a broken one.
          el('button', {
            class: 'swap-btn pill-action',
            title: 'Use a different exercise for this session',
            onClick: () => (ex ? openSwapPicker({
              exMap,
              current: ex,
              inSession: state.entries.map((e) => e.exerciseId),
              onPick: (picked) => swapExercise(step.entryIndex, picked),
            }) : openExercisePicker({
              exMap,
              title: 'Swap this exercise',
              closeOnPick: true,
              onPick: (picked) => swapExercise(step.entryIndex, picked),
            })),
          }, icon('swap', 15), 'Swap'),
          // Swap's sibling (2026-08-28): drop the exercise from today entirely.
          // Same contract — the saved workout is never touched.
          el('button', {
            class: 'swap-btn pill-action',
            title: 'Remove this exercise from today’s session',
            onClick: () => removeExercise(step.entryIndex),
          }, icon('trash', 15), 'Remove'),
          // The whole of today, one tap from every exercise (Tim, 2026-08-31).
          el('button', {
            class: 'swap-btn pill-action',
            title: 'See every exercise in today’s workout — reorder, add or remove',
            onClick: () => openWorkoutSheet(),
          }, icon('list', 15), 'Exercises'),
        ),
        // Says which of the two things a swap just did, because they are
        // different and only one of them left a record behind.
        entry.swappedFrom
          ? el('div', { class: 'session-ex-meta', text: `Swapped in for ${entry.swappedFrom} — today only.` })
          : null,
        /* ⚠️ WHOSE NUMBERS THESE ARE, AND WHERE THEY CAME FROM (2026-08-29).
         * Recording for somebody else, the suggestion on this screen is about
         * THEM — and the three sources are not equally good. Saying which one
         * is in use is what stops "First time logging this" reading as a bug
         * for a friend who has trained for years but shares only the day and
         * the workout's name with you. D8: say it where it is being acted on. */
        state.forName == null ? null : el('div', { class: 'for-note' },
          el('b', { text: `Recording for ${state.forName}` }),
          state.historySource === 'theirs'
            ? ' · suggestions read from the training they share with you.'
            : state.historySource === 'mine-only'
              ? ' · they have not shared their training with you, so this starts '
                + 'from what you record for them here. Their workout still goes to them at the end.'
              : ' · kept on your phone, never mixed into your own training.'),
      ),

      entry.notes
        ? el('div', { class: 'note-card' }, el('b', { text: 'Note' }), el('span', { text: entry.notes }))
        : null,

      /* ⚠️ ONE LINE OF PROSE ON THIS SCREEN, AND IT IS A MEASUREMENT.
       *
       * Tim, 2026-08-31: *"Remove the 'Suggested: …' description at the top of
       * the workout, as well as the 'First time logging this…', '10 reps…'
       * feature right now. It's very wordy and I think we can improve it
       * later."* Three blocks came off: the progression's headline-and-why with
       * its "use last time's numbers instead" toggle, the derived-weight note,
       * and the first-time note.
       *
       * 🚨 WHAT WAS REMOVED IS THE EXPLANATION, NOT THE ARITHMETIC. The
       * suggestion is still computed and still laid over the numbers, and a
       * never-done exercise still opens at a derived weight and 10 reps, still
       * flagged `prefilled` so `finish()` refuses to record a set nobody
       * touched. That flag is what keeps this honest with the prose gone: the
       * app can no longer SAY the opening number was worked out rather than
       * measured, so it must stay unable to save one as though it were.
       *
       * ⚠️ AND "LAST TIME" STAYS, deliberately. It is six words, it is a
       * recording rather than an inference, and it is the one thing on the
       * screen that says where the numbers in front of you came from. Removing
       * it with the rest would have left the sets looking self-evident. */
      entry.hadHistory
        ? el('div', { class: 'prefill-note' }, icon('check', 16),
            el('span', {}, 'Last time: ', el('b', { text: entry.lastSummary })))
        : null,

      /* 🚨 THE OTHER HALF OF THAT SENTENCE: WHY THERE IS NO NUMBER (2026-09-06).
       *
       * "Last time" above is the one line that says where the numbers in front
       * of you came from. On a lift nobody here has ever done there are no
       * numbers, and until now there was also nothing said — which is the exact
       * failure `historyForPerson()` names further up this file: *"no
       * suggestion" for a reason you cannot see reads as broken.* A blank weight
       * box is indistinguishable from a bug, and the app HAD a reason.
       *
       * 🛑 IT LABELS, IT DOES NOT FILL. The opening-weight gates (ratio quality
       * ≥ 0.45, muscle confidence ≥ 0.35) are untouched and stay untouched: this
       * number would be walked up to a bar. Tim's §3.1 asks for a best-effort
       * number where one can be stood behind and for the app to be *"upfront
       * about it"* where one cannot — this is the second case, and being upfront
       * is the whole of what is owed here.
       *
       * ⚠️ IT IS ALSO PROSE ON THE SCREEN TIM TOOK PROSE OFF, so the tension is
       * stated rather than hidden. What he removed on 2026-08-31 (see the block
       * directly above) EXPLAINED NUMBERS THAT WERE THERE — a suggestion, its
       * reasoning, a toggle. This explains a number that is NOT there, appears
       * only in the case where the box is empty, and is one line. If he wants it
       * gone it is one node; the gates it describes are what must not move.
       *
       * ⚠️ FIVE CONDITIONS, AND EACH REMOVES A WAY OF LYING:
       *   • the OWNER is the one being recorded for. `derivedWeights` is built
       *     from `muscleStrength()`, which is the owner's own training — the
       *     prefill has always been the owner's and a guest inherits it, but a
       *     SENTENCE saying "nothing you have recorded" would put that
       *     inheritance into words and get it wrong. Whose numbers a guest's
       *     screen is using is already answered by the `for-note` above.
       *   • `!hadHistory`  — with history the field is not blank at all.
       *   • `openingWithheld` — the app actually looked and declined. An import
       *     that threw never had an opinion and may not claim one.
       *   • a weight field — nothing to explain on a lift that has no weight.
       *   • nothing typed  — the moment a real number is in any set this is a
       *     note about a box that is no longer empty. Read from the sets rather
       *     than from `prefilled`, because that flag is cleared on the first
       *     keystroke and this must also stay away from a set restored from a
       *     draft somebody had already filled in.
       *
       * ⚠️ RULE 7 — NOTHING MOVES ON THE LOGGING PATH. This is a static line in
       * the slot "Last time" would occupy, and it is drawn by `renderPane()`
       * only. Typing into a stepper goes through `syncSetValues()` in place and
       * does not re-render the pane, so the line cannot vanish out from under a
       * thumb mid-set and shove the set list up; it is simply gone the next time
       * this exercise is drawn. */
      state.forName == null
        && !entry.hadHistory
        && entry.openingWithheld
        && entry.fields.includes('weight')
        && !entry.sets.some((s) => Number(s.weight) > 0)
        ? el('div', { class: 'session-ex-meta', text:
            'No opening weight — nothing you have recorded points to this lift closely enough.' })
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
            // And following it is moving on from the set you were on, which
            // locks it (if it was done) — see the lock block above `goToStep`.
            if (step.group == null) {
              lockSet(entry, entry.active);
              entry.active = entry.sets.length - 1;
            }
            entry.activeDrop = null;
            saveDraft(state);
            renderAll();
          },
        }, icon('plus', 15), step.group == null ? 'Add set' : 'Add round'),
      ),
      setList,
    );

    // Landing on a new exercise starts at the top; opening a set does not.
    if (!keepScroll) { pane.scrollTop = 0; return; }
    pane.scrollTop = wasAt;

    /* ⚠️ AND THEN MAKE SURE THE THING THAT JUST OPENED IS ON SCREEN. The
     * controls used to be at a fixed place near the top of the pane; they now
     * sit wherever their set does, so opening set 6 of 6 can put the ± buttons
     * below the fold of the row somebody tapped. Scroll the minimum that fixes
     * it, never more — a jump to centre would move a list that was already fine.
     * jsdom reports every rect as zero, so this is inert there and the browser
     * pass is what checks it. */
    if (typeof editor.getBoundingClientRect !== 'function') return;
    const er = editor.getBoundingClientRect();
    const pr = pane.getBoundingClientRect();
    if (!er.height || !pr.height) return;
    if (er.bottom > pr.bottom) {
      pane.scrollTop += Math.min(er.bottom - pr.bottom + 8, Math.max(0, er.top - pr.top));
    }
    else if (er.top < pr.top) pane.scrollTop -= pr.top - er.top + 8;
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
    // ⚠️ The exercises sheet is a view of `state.entries` like any other, so it
    // repaints with everything else rather than at each of the four call sites
    // that can change the list underneath it. Null unless it is open.
    if (refreshWorkoutSheet) refreshWorkoutSheet();
  }

  /* "…and then when you click off it it goes back to being normal" — the other
   * half of Tim's morph, and the reason it is a listener on the PANE rather
   * than on the document: a tap anywhere in the workout that was not aimed at
   * something closes the open set, and a tap on the sheet, the people bar or
   * the footer is aimed at something.
   *
   * ⚠️ ANY CONTROL IS EXEMPT, not just the set list. Without that, "Add set"
   * would open the new set on its own click and this would close it again on
   * the way up — the handler runs after the button's, on the same event. The
   * test for that is the one that would not have been written by hand: add a
   * set, and assert the steppers are on screen.
   */
  pane.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (t.closest('.set-list, button, a, input, select, textarea, label')) return;
    const step = currentStep();
    const entry = step ? state.entries[step.entryIndex] : null;
    if (!entry || entry.editing === false) return;
    entry.editing = false;
    entry.activeDrop = null;
    saveDraft(state);
    renderPane({ keepScroll: true });
  });

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
  /**
   * ⚠️ SPLIT FROM `readingFor` ON 2026-09-10 SO A SHARED CHANGE CAN BUILD ONE
   * PERSON'S COPY AT A TIME. The history and the body weight are arguments
   * rather than reads off `state`, because a joint workout now adds and swaps
   * exercises for everybody at once and each of them must be built from their
   * OWN past. Handing the active person's reading round is the cross-
   * prescription 0e exists to forbid.
   */
  function readingFrom(ex, sessions, bodyWeight) {
    const history = historyFor(sessions, { exerciseId: ex.id, workoutId: state.workoutId });
    const last = history[0] || null;
    const lastDay = lastSessionDate(sessions, { exerciseId: ex.id, workoutId: state.workoutId });
    const suggestion = suggestProgression({
      history,
      exercise: ex,
      step: units.fromDisplay(units.weightStep()),
      daysSinceLast: lastDay ? daysBetweenDays(lastDay, state.date) : null,
      bodyWeight,
      fmt: units.withUnit,
    });
    return { history, last, suggestion };
  }

  async function readingFor(ex) {
    // The ACTIVE person's history — a guest's swap reads the guest's own past.
    return readingFrom(ex, await sessionsForActive(), state.bodyWeight);
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
  /**
   * A brand-new entry for `newEx`, ready to be dropped into `state.entries`.
   *
   * ⚠️ FACTORED OUT OF THE SWAP ON 2026-08-31 so ADDING an exercise mid-session
   * builds the identical thing. An exercise that arrives by a different door
   * must not arrive with a different shape — the swap's entry already carries
   * the history read, the suggestion and the `lastSets` fallback, and an added
   * exercise that skipped any of them would be the one entry on the screen with
   * no numbers and no explanation for it.
   *
   * `shape` is what the entry inherits from its surroundings: the sets it plans
   * for, and (on a swap) the group it is replacing somebody in. An ADDED
   * exercise inherits nothing — it is not in anybody's superset — which is why
   * every field of it is optional here.
   */
  async function entryFromExercise(newEx, shape = {}) {
    return buildEntry(newEx, shape, await sessionsForActive(), state.bodyWeight);
  }

  /**
   * The body of `entryFromExercise`, over a history handed in.
   *
   * ⚠️ Separated on 2026-09-10 for the reason `readingFrom` was: a shared add
   * or swap builds one of these PER PERSON, each against their own sessions.
   * Every caller still goes through `entryFromExercise` or `entryFor`, so
   * "an exercise that arrives by a different door must not arrive with a
   * different shape" is still true by construction.
   */
  function buildEntry(newEx, shape, sessions, bodyWeight) {
    const { last, suggestion } = readingFrom(newEx, sessions, bodyWeight);
    const plannedSets = Number(shape.plannedSets) > 0 ? Number(shape.plannedSets) : DEFAULT_SETS;

    const lastSets = Array.from({ length: plannedSets }, (_, i) => {
      if (!last || !last.length) return blankSet(newEx.fields);
      return pickFields(last[Math.min(i, last.length - 1)], newEx.fields);
    });

    return {
      lastSets,
      suggestion,
      exerciseId: newEx.id,
      exerciseName: newEx.name,
      fields: newEx.fields,
      loadType: newEx.loadType,
      notes: '',                 // a note belongs to the exercise it was written on
      plannedSets,
      group: shape.group == null ? null : shape.group,
      setType: shape.setType || null,
      plannedMinis: shape.plannedMinis || 0,
      sets: applySuggestion(lastSets, suggestion),
      active: 0,
      activeDrop: null,
      hadHistory: Boolean(last && last.length),
      lastSummary: last && last.length ? fmtSet(last[0], newEx.fields, newEx.loadType) : null,
      ...(shape.swappedFrom ? { swappedFrom: shape.swappedFrom } : {}),
      ...(shape.addedToday ? { addedToday: true } : {}),
    };
  }

  /**
   * The swap, applied to one person's list.
   *
   * ⚠️ `fresh` IS BUILT PER PERSON BY THE CALLER, never shared. Two people
   * swapping onto the same machine are not swapping onto the same weight.
   *
   * ⚠️ AND THE SPLIT RULE IS EVALUATED PER PERSON TOO, because whether there
   * are recorded sets to keep is a fact about THAT lifter: the owner may have
   * done two sets before the machine was taken while their friend had not
   * started. So one person's list can split while the other's replaces in
   * place, and the lists legitimately end up different lengths — which is what
   * syncWalk() clamps for.
   */
  function swapIn(slot, index, newEx, fresh) {
    const entry = slot.entries[index];
    if (!entry) return null;
    const recorded = entry.sets.filter((s) => setIsRecorded(s, entry.fields));
    if (!recorded.length) { slot.entries[index] = fresh; return null; }
    entry.sets = recorded;
    entry.active = Math.min(entry.active, recorded.length - 1);
    entry.activeDrop = null;
    if (entry.group != null) { entry.group = null; entry.setType = null; }
    slot.entries.splice(index + 1, 0, fresh);
    return index + 1;
  }

  async function swapExercise(index, newEx) {
    const entry = state.entries[index];
    if (!entry || !newEx) return;

    const fresh = await entryFromExercise(newEx, {
      plannedSets: entry.plannedSets,
      group: entry.group,
      setType: entry.setType,
      plannedMinis: entry.plannedMinis,
      swappedFrom: entry.exerciseName,
    });

    /* 🚨 EVERYBODY ELSE SWAPS TOO (Tim, 2026-09-10), each against their own
     * history and their own recorded sets. ⚠️ ONLY WHERE IT IS THE SAME
     * EXERCISE: after a "just for" edit somebody's slot `index` may hold
     * something else entirely, and swapping that would silently change an
     * exercise nobody pointed at. Skipping is the honest answer and the
     * footnote below says who was skipped. */
    const skipped = [];
    for (const slot of otherTargets()) {
      const theirs = slot.entries[index];
      if (!theirs || theirs.exerciseId !== entry.exerciseId) { skipped.push(slot.name); continue; }
      const built = await entryFor(slot.name, newEx, {
        plannedSets: theirs.plannedSets,
        group: theirs.group,
        setType: theirs.setType,
        plannedMinis: theirs.plannedMinis,
        swappedFrom: theirs.exerciseName,
      });
      swapIn(slot, index, newEx, built);
    }
    /* ⚠️ ONE TOAST, NOT TWO. `toast()` sends the one already on screen away and
     * replaces it, so a skip notice followed by "Swapped to X" would flash the
     * first for a frame and then hide it — the message nobody reads is the one
     * saying somebody was left out. Same reason `removeExercise` builds its
     * sentence the same way. */
    const said = (what) => toast(skipped.length
      ? `${what} — ${skipped.join(' and ')} kept theirs`
      : what);

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
      said(`Swapped to ${newEx.name}`);
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
    said(`Swapped to ${newEx.name}`);
  }

  /**
   * Remove the exercise at `index` from TODAY'S SESSION ONLY — Swap's sibling
   * (Tim, 2026-08-28: "delete this exercise entirely… works exactly the same
   * as the swap button where it doesn't adjust the workout for future
   * systems, just that day's recording"). The saved workout is never touched,
   * for the same reason Swap never touches it.
   *
   * ⚠️ WHERE IT DIFFERS FROM SWAP, AND WHY: a swap with sets already logged
   * SPLITS, because those sets were performed and belong in the record. A
   * removal deletes them — that is what removing means — so recorded sets get
   * a CONFIRM that says the count out loud, while an untouched exercise goes
   * quietly (pre-filled numbers are a plan, not a record). One tap must not
   * be able to destroy performed work; this app has had that lesson this week.
   *
   * ⚠️ A GROUP LEFT WITH ONE MEMBER STOPS BEING A GROUP. stepsFor() builds
   * blocks by adjacency and groupLabel(1) would happily print "Superset" over
   * a single exercise — telling somebody to go "straight into" nothing. The
   * survivor keeps its sets and loses only the banner.
   */
  function removeExercise(index) {
    const entry = state.entries[index];
    if (!entry) return;
    if (state.entries.length <= 1) {
      toast('This is the only exercise — use the ✕ up top to leave the workout instead.');
      return;
    }

    /** Drop entry `at` out of one person's list and dissolve any group of one. */
    const removeFrom = (slot, at) => {
      slot.entries.splice(at, 1);
      const counts = new Map();
      for (const e of slot.entries) {
        if (e.group != null) counts.set(e.group, (counts.get(e.group) || 0) + 1);
      }
      for (const e of slot.entries) {
        if (e.group != null && counts.get(e.group) < 2) e.group = null;
      }
    };

    const doRemove = () => {
      /* 🚨 EVERYBODY ELSE LOSES IT TOO (Tim, 2026-09-10) — but only where it is
       * the same exercise, and never where it would empty somebody's workout.
       * The active person's own "this is the only exercise" guard is above;
       * this is the same rule applied to each of the others, and it is why a
       * shared remove can legitimately reach fewer people than it names. */
      const skipped = [];
      for (const slot of otherTargets()) {
        const theirs = slot.entries[index];
        if (!theirs || theirs.exerciseId !== entry.exerciseId || slot.entries.length <= 1) {
          skipped.push(slot.name);
          continue;
        }
        removeFrom(slot, index);
        const n = stepCountOf(slot);
        slot.index = n ? Math.max(0, Math.min(slot.index, n - 1)) : 0;
      }
      removeFrom(activeSlot, index);
      // Land on the exercise that now occupies this slot (or the new last one)
      // — state.index walks STEPS, not entries, for the reason the swap's
      // split path spells out. goToStep() clamps, saves and renders.
      const at = steps().findIndex((s) => s.entryIndex === Math.min(index, state.entries.length - 1));
      goToStep(at >= 0 ? at : 0);
      // ⚠️ One toast, for the reason swapExercise's `said()` gives: a second
      // call replaces the first, and the one that would be lost is the one
      // saying somebody was left out.
      toast(`Removed ${entry.exerciseName} — today only`
        + (skipped.length ? ` — ${skipped.join(' and ')} kept theirs` : ''));
    };

    const recorded = entry.sets.filter((s) => setIsRecorded(s, entry.fields)).length;
    if (!recorded) { doRemove(); return; }
    confirmSheet({
      title: `Remove ${entry.exerciseName}?`,
      message: `${recorded} recorded set${recorded === 1 ? '' : 's'} will be deleted with it. `
        + 'Your saved workout is not changed — this only removes it from today.',
      confirmLabel: 'Remove',
      onConfirm: doRemove,
    });
  }

  /* ================================================================== *
   * TODAY'S EXERCISES — reorder, add, remove (Tim, 2026-08-31)
   *
   * *"you can remove a exercise or swap an exercise, but you can't add an
   * exercise or rearrange exercises for a different order… put a view full
   * workout button somewhere… and you can add an exercise, remove one, or drag
   * an exercise to another position… If any information has already been
   * recorded for any of the exercises, keep the information tied to that
   * exercise, but also allow it to be moved."*
   *
   * ⚠️ THE RECORDED SETS MOVE BECAUSE NOTHING IS COPIED. An entry IS its sets —
   * `state.entries[i].sets` is the only place a number lives until finish()
   * writes it — so reordering is a reorder of the array itself and the data
   * cannot come apart from the exercise it was typed on. The alternative shape,
   * a separate order array indexed into the entries, is what would let the two
   * drift; a test drives a reorder with sets recorded on two exercises and
   * checks the saved session, because "it moved with it" is the whole ask.
   *
   * ⚠️ AND IT IS TODAY ONLY, like Swap and Remove beside it. The saved workout
   * is not touched — same contract, stated in the sheet, for the same reason
   * (2026-08-24): improvising today must not silently reshape the programme.
   * ================================================================== */

  /* Set while the sheet is open, so every mutation path repaints it without
   * threading a callback through removeExercise(), the picker and the drag. */
  let refreshWorkoutSheet = null;

  /** The entry the walk is on right now — captured BEFORE a reshuffle. */
  function entryHere() {
    const step = currentStep();
    return step ? state.entries[step.entryIndex] : null;
  }

  /**
   * Put the walk back on `entry` after the list has been reshuffled.
   *
   * ⚠️ BY OBJECT IDENTITY, NEVER BY INDEX. `state.index` walks STEPS and the
   * entry it pointed at has just moved — re-using the old number would land on
   * whatever slid into that slot, which on a reorder is precisely the exercise
   * you were not doing. Same trap the swap's split path documents.
   */
  function repointOn(entry, fallbackIndex = 0) {
    const at = entry ? state.entries.indexOf(entry) : -1;
    const idx = at >= 0 ? at : Math.max(0, Math.min(fallbackIndex, state.entries.length - 1));
    const to = steps().findIndex((s) => s.entryIndex === idx);
    goToStep(to >= 0 ? to : 0);
  }

  /**
   * Re-derive every entry's `group` from where it now sits.
   *
   * ⚠️ A SUPERSET IS ADJACENCY, and a reorder is the one thing that can break
   * it — normalizeGroups' own header names this case. Dragging the second half
   * of a superset to the bottom of the list leaves two members carrying the
   * same id and nothing between them that makes it true; the runner's walk
   * would still be renumbering copies while the entries on disk claimed a block
   * that was not performed. Cheap, and run on every reshuffle.
   */
  function normalizeEntryGroups() {
    const fixed = normalizeGroups(state.entries.map((e) => ({ group: e.group })));
    state.entries.forEach((e, i) => { e.group = fixed[i].group == null ? null : fixed[i].group; });
  }

  /* 🚨 A REORDER IS REPLAYED ON EVERYBODY (Tim, 2026-09-10), and the guard is
   * LENGTH: a permutation of five positions means nothing applied to a list of
   * four. After a "just for" edit somebody's list can be a different length,
   * and re-indexing it against a shuffle computed for another one would move
   * the wrong exercises. So a mismatched list keeps its own order.
   *
   * ⚠️ AND THE WALK IS REPOINTED BY OBJECT IDENTITY PER PERSON, never by the
   * active person's new index — `repointOn`'s own header is the reason, and it
   * applies once per list rather than once. */
  function reorderSlot(slot, order) {
    /* 🚨 THE GUARD IS `order.length`, NOT THE FILTERED RESULT, AND THE FIRST
     * VERSION HAD IT WRONG — caught by a test written against this function's
     * own stated rule. Filtering first and then comparing lengths catches a
     * LONGER list (five entries, four positions → 4 !== 5, refused) and lets a
     * SHORTER one straight through: five positions over four entries maps to
     * five slots, one of them `undefined`, which `filter(Boolean)` quietly
     * drops back to four — so the lengths matched and a permutation computed
     * for somebody else's list was applied to a partial one. Compare the
     * incoming order against this list BEFORE resolving it, and refuse a hole
     * separately. */
    if (order.length !== slot.entries.length) return false;
    const next = order.map((k) => slot.entries[k]);
    if (next.some((e) => !e)) return false;
    const here = slot.entries[stepsFor(slot.entries.map(
      (e) => ({ sets: e.sets.length, group: e.group })))[slot.index]?.entryIndex];
    slot.entries = next;
    const fixed = normalizeGroups(slot.entries.map((e) => ({ group: e.group })));
    slot.entries.forEach((e, i) => { e.group = fixed[i].group == null ? null : fixed[i].group; });
    const at = here ? slot.entries.indexOf(here) : -1;
    const steps2 = stepsFor(slot.entries.map((e) => ({ sets: e.sets.length, group: e.group })));
    const to = at >= 0 ? steps2.findIndex((s) => s.entryIndex === at) : -1;
    slot.index = to >= 0 ? to : 0;
    return true;
  }

  /** Replay one reshuffle across everybody it should reach. */
  function reorderOthers(order) {
    for (const slot of otherTargets()) reorderSlot(slot, order);
  }

  /** Move the entry at `from` to sit at `to`. Returns whether anything moved. */
  function moveEntry(from, to) {
    const n = state.entries.length;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return false;
    const here = entryHere();
    const order = state.entries.map((_, i) => i);
    order.splice(to, 0, order.splice(from, 1)[0]);
    reorderOthers(order);
    const [moved] = state.entries.splice(from, 1);
    state.entries.splice(to, 0, moved);
    normalizeEntryGroups();
    repointOn(here, to);
    return true;
  }

  /** Apply a whole new order, given as old indices in their new sequence. */
  function applyOrder(order) {
    const next = order.map((k) => state.entries[k]).filter(Boolean);
    if (next.length !== state.entries.length) return false;
    if (order.every((k, i) => k === i)) return false;
    const here = entryHere();
    reorderOthers(order);
    state.entries = next;
    normalizeEntryGroups();
    repointOn(here, 0);
    return true;
  }

  /**
   * Add an exercise to today's session.
   *
   * ⚠️ APPENDED, and that is the opposite of the swap's rule for a reason. A
   * swap inserts directly after the exercise it replaced because
   * `muscleStrength()` reads entry order as "how much work this muscle had
   * already taken" — an exercise dropped at the end would be scored as though
   * it came after everything. Here it DID come after everything: you are adding
   * it now, mid-workout, so the end of the list is the truth. Drag it if it is
   * not.
   *
   * ⚠️ NEVER INTO A SUPERSET. It arrives with `group: null`, so an add cannot
   * silently make a two-exercise block into a three-exercise one and change
   * what the banner tells somebody to do with their next thirty seconds.
   */
  async function addExerciseToday(newEx) {
    if (!newEx) return false;
    // Refused for the same reason the builder refuses it: two entries with one
    // exercise id in a single session is the shape that produced the duplicate
    // -exercise read bug of 2026-08-28.
    if (state.entries.some((e) => e.exerciseId === newEx.id)) {
      toast(`${newEx.name} is already in this workout`);
      return false;
    }
    const here = entryHere();

    /* 🚨 EVERYBODY GETS IT (Tim, 2026-09-10), each built from their OWN
     * history — `entryFor`, never a copy of the one below. ⚠️ Somebody who
     * already has that exercise is skipped rather than given a second copy:
     * two entries with one exercise id in a session is the shape that produced
     * the duplicate-exercise read bug of 2026-08-28, and the active person's
     * own guard above refuses it for exactly that reason. */
    for (const slot of otherTargets()) {
      if (slot.entries.some((e) => e.exerciseId === newEx.id)) continue;
      slot.entries.push(await entryFor(slot.name, newEx, { addedToday: true }));
      const fixed = normalizeGroups(slot.entries.map((e) => ({ group: e.group })));
      slot.entries.forEach((e, i) => { e.group = fixed[i].group == null ? null : fixed[i].group; });
    }

    state.entries.push(await entryFromExercise(newEx, { addedToday: true }));
    normalizeEntryGroups();
    repointOn(here, state.entries.length - 1);
    toast(`Added ${newEx.name} — today only`);
    return true;
  }

  /**
   * The sheet itself.
   *
   * ⚠️ THE DRAG IS POINTER EVENTS, NOT HTML5 DRAG-AND-DROP, which does not exist
   * on a touch screen — `dragstart` never fires for a finger, so the whole
   * feature would have worked on Tim's laptop and done nothing on the phone
   * this app is for.
   *
   * ~~⚠️ AND THE ARROWS ARE NOT A CONSOLATION PRIZE. A drag cannot be performed
   * by a keyboard or a screen reader at all, so ▲▼ is the only version of this
   * control some people ever get — it is also the version the tests drive,
   * because jsdom reports every rectangle as zero and a pointer drag there
   * measures nothing. The builder has carried the same pair since it shipped.~~
   *
   * 🔄 THE ARROWS ARE GONE — 2026-09-12, Tim: *"the up and down arrows on the
   * right side of the exercises on this display are useless now that this is a
   * drag feature now. Remove them."* ⚠️ What they were FOR survives, on the
   * handle: a drag still has no keyboard equivalent, so the grip takes ArrowUp
   * and ArrowDown itself and commits through `moveEntry`, exactly the call the
   * buttons made, and its accessible name says so. Nothing visible was added.
   * A keyboard and a screen reader lose no path they had, `moveEntry` keeps a
   * caller, and jsdom — which measures every rectangle as zero — can still
   * drive a one-step reorder without stubbing geometry. Focus is put back on
   * the moved row's grip after the rebuild, or every keypress would land the
   * user at the top of the document.
   *
   * 🔄 AND THE ROW FOLLOWS THE FINGER — same day, Tim: *"It automatically
   * locks into a valid position in the list, and doesn't follow the user's
   * finger or mouse smoothly while they place it in a better position which is
   * annoying. I think that it should follow the exact location of the user's
   * selection and when the user releases their finger, it will automatically
   * take the nearest valid position."* The first version moved the row IN THE
   * DOM on every pointermove — `insertBefore` past a neighbour's midpoint — so
   * the row could only ever be in a slot, never under the finger. Now:
   *   • the dragged row is a `translateY` of exactly the pointer's travel, with
   *     no transition on it (a transition is a lag);
   *   • the rows it has passed slide out of its way by one row height, with
   *     the transition — Rule 7's "the row you drag pushes the rest", and the
   *     gap they open is the slot it will take;
   *   • the DOM is not touched until release. The slot is the dragged row's
   *     CENTRE against each neighbour's midpoint, all measured once at
   *     pointerdown — midpoints, never edges, for the reason the old code gave
   *     (a row flickering between two places while the finger sits on a
   *     boundary);
   *   • on release the order is committed exactly as before (`applyOrder` →
   *     `reorderOthers`, the superset rules untouched), the list is rebuilt,
   *     and the rebuilt row is FLIPped from where the finger let go to its
   *     slot, so the snap is a movement rather than a jump. Under reduced
   *     motion the blanket makes both transitions instant and the snap still
   *     lands.
   */
  function openWorkoutSheet() {
    const list = el('div', { class: 'reorder-list' });
    const body = el('div', { class: 'workout-sheet' });

    const { close } = openSheet({
      title: 'Today’s exercises',
      body,
      onClose: () => { refreshWorkoutSheet = null; },
    });

    /* The grip to focus after the next rebuild — a keyboard move rebuilds the
     * list under the key that was pressed. Null unless a move was by key. */
    let focusIndex = null;

    /* ---- the drag ---- */
    function startDrag(ev, rowNode) {
      if (ev.button != null && ev.button !== 0) return;
      // Stops the sheet scrolling under the finger that is moving a row.
      if (ev.preventDefault) ev.preventDefault();
      const handle = ev.currentTarget;
      // Without capture the pointer leaves the 30px handle on the first move
      // and the drag dies one row later. It throws in jsdom; the listeners
      // below are on the handle either way, so a harness that dispatches to
      // it still gets a drag.
      try { handle.setPointerCapture(ev.pointerId); } catch (_) { /* still drags */ }

      const rows = [...list.querySelectorAll('.reorder-row')];
      const from = rows.indexOf(rowNode);
      // ⚠️ Measured ONCE, here. The rows never move in the DOM during the drag
      // and only ever carry a transform, so the boxes they were laid out in
      // are the boxes to measure against for the whole gesture — reading them
      // on every move would read transformed rectangles, which is precisely
      // the thing being moved. A list nothing can measure (jsdom) is not
      // dragged at all; the arrow keys are the path there.
      const rects = rows.map((r) => r.getBoundingClientRect());
      if (from < 0 || !rects.every((r) => r.height > 0)) return;
      const startY = ev.clientY;
      const h = rects[from].height;
      const mids = rects.map((r) => r.top + r.height / 2);
      let to = from;

      rowNode.classList.add('is-dragging');

      const move = (e) => {
        const dy = e.clientY - startY;
        rowNode.style.transform = `translateY(${dy}px)`;
        // Where the dragged row's centre is now, against where every other
        // row's centre was: the slot is the furthest neighbour it has passed.
        const centre = mids[from] + dy;
        let slot = from;
        for (let i = from + 1; i < rows.length; i++) if (centre > mids[i]) slot = i;
        for (let i = from - 1; i >= 0; i--) if (centre < mids[i]) slot = i;
        if (slot === to) return;
        to = slot;
        // Everybody between the old slot and the new one steps one row the
        // other way; everybody else goes home. One row height, the dragged
        // row's own, which is the size of the hole it left.
        rows.forEach((r, i) => {
          if (i === from) return;
          const shift = i > from && i <= to ? -h : i < from && i >= to ? h : 0;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        // Where the row visibly is at the moment of release, before anything
        // is rebuilt — the FLIP below starts the settled row from here.
        const letGoAt = rowNode.getBoundingClientRect().top;
        rowNode.classList.remove('is-dragging');
        for (const r of rows) r.style.transform = '';
        // ⚠️ The state is only touched here, once, on release — nothing about
        // the order changed while the finger was down, so a drag that is
        // abandoned (the app is backgrounded, the pointer is cancelled) lands
        // wherever the row was and cannot leave half a reorder in the session.
        // Same contract as before; only the DOM stopped being the draft.
        const order = rows.map((r) => Number(r.dataset.index));
        order.splice(to, 0, order.splice(from, 1)[0]);
        if (!applyOrder(order)) { render(); return; }
        // `applyOrder` has already rebuilt the list (renderAll → render). The
        // moved entry now sits at `to`: start it from under the finger and let
        // the transition carry it the rest of the way. Reading `offsetHeight`
        // between the two writes is what makes the first one a starting point
        // rather than a no-op.
        const landed = list.querySelector(`.reorder-row[data-index="${to}"]`);
        if (!landed || typeof landed.getBoundingClientRect !== 'function') return;
        const delta = letGoAt - landed.getBoundingClientRect().top;
        if (!delta) return;
        landed.classList.add('is-settling');
        landed.style.transition = 'none';
        landed.style.transform = `translateY(${delta}px)`;
        void landed.offsetHeight;
        landed.style.transition = '';
        landed.style.transform = '';
        landed.addEventListener('transitionend', () => landed.classList.remove('is-settling'), { once: true });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }

    function render() {
      const step = currentStep();
      const hereIndex = step ? step.entryIndex : -1;

      const rows = state.entries.map((entry, i) => {
        const recorded = entry.sets.filter((s) => setIsRecorded(s, entry.fields)).length;
        const bits = [];
        if (i === hereIndex) bits.push('On this one now');
        bits.push(recorded
          ? `${recorded} set${recorded === 1 ? '' : 's'} recorded`
          : 'Nothing recorded yet');
        if (entry.group != null) bits.push('superset');
        if (entry.swappedFrom) bits.push(`swapped in for ${entry.swappedFrom}`);
        else if (entry.addedToday) bits.push('added today');

        const row = el('div', {
          class: 'reorder-row' + (i === hereIndex ? ' is-current' : ''),
          dataset: { index: String(i) },
        },
          el('button', {
            class: 'grip',
            // A drag has no keyboard equivalent, so the handle IS the keyboard
            // path (ArrowUp / ArrowDown) and its name says so — the ▲▼ buttons
            // that used to carry this are gone; see the sheet's header.
            'aria-label': `Drag to move ${entry.exerciseName}, or press the arrow keys`,
            title: 'Drag to move, or use the arrow keys',
            onPointerdown: (ev) => startDrag(ev, row),
            onKeydown: (ev) => {
              const dir = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
              if (!dir) return;
              ev.preventDefault();
              // Focus follows the row: `moveEntry` rebuilds the sheet, and
              // `render()` reads this back to put the key's owner back on the
              // grip they were holding. Cleared if nothing moved (an end).
              focusIndex = i + dir;
              if (!moveEntry(i, i + dir)) focusIndex = null;
            },
          }, icon('grip', 17)),
          el('div', { class: 'row-main' },
            // `inControl` even though this row is not a button: four controls
            // already live on it, and a fifth that only opens a picture would
            // be the loudest thing in a list about ORDER. The picture is one
            // tap away on the exercise itself.
            exerciseLabel({
              exercise: exMap.get(entry.exerciseId), name: entry.exerciseName,
              tag: 'div', className: 'row-title', inControl: true,
            }),
            el('div', { class: 'row-sub wrap', text: bits.join(' · ') }),
          ),
          // ~~`.move-btns` ▲▼ sat here~~ — removed 2026-09-12 on Tim's
          // instruction; the grip's arrow keys are what a keyboard gets now.
          el('button', {
            class: 'icon-btn',
            'aria-label': `Remove ${entry.exerciseName} from today`,
            title: 'Remove from today',
            onClick: () => removeExercise(i),
          }, icon('trash')),
        );
        return row;
      });

      setChildren(list, ...rows);
      setChildren(body,
        // ⚠️ ONE LINE. The first version was four, explaining the handle, the
        // arrows, that recorded sets travel and that the template is untouched
        // — all true, and all readable off the rows themselves. Tim's note on
        // the runner the same day was *"It's very wordy"*, and a sheet you open
        // mid-set is the last place to spend a paragraph.
        el('div', { class: 'field-help', style: 'margin-top:0', text:
          'Drag to reorder. Today only — your saved workout is not changed.' }),
        list,
        el('button', {
          class: 'btn block',
          onClick: () => openExercisePicker({
            exMap,
            title: 'Add to today',
            closeOnPick: true,
            onPick: (picked) => { addExerciseToday(picked); },
          }),
        }, icon('plus', 16), 'Add an exercise'),
      );
      // ⚠️ AFTER `body` is rebuilt, not after `list` is. `setChildren(body…)`
      // takes the list out and puts it back, and an element leaving the
      // document drops focus — so a grip focused a line earlier was blurred a
      // line later, and a keyboard user landed on the page body every move.
      if (focusIndex != null) {
        const g = list.querySelector(`.reorder-row[data-index="${focusIndex}"] .grip`);
        focusIndex = null;
        if (g) g.focus();
      }
    }

    refreshWorkoutSheet = render;
    render();
    return { close };
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
          // ⚠️ `setIsRecorded`, not `hasNumbers`, since 2026-08-29 — the two
          // differ on exactly one case and it is the one that matters: a set
          // still carrying the opening numbers the app DERIVED, which nobody
          // has touched. Numbers in it, and not a record of anything.
          .filter((s) => setIsRecorded(s, e.fields))
          .map((s) => {
            const kept = minisOf(s).filter((d) => hasNumbers(d, e.fields));
            const out = { ...s };
            // An empty `minis: []` is noise in storage and reads as "this was a
            // drop set with no drops", which is a different claim from "this
            // was a straight set".
            if (kept.length) out.minis = kept; else delete out.minis;
            delete out.drops;      // legacy key, never written any more
            delete out.prefilled;  // a runtime flag; storage never sees it
            // The padlock (2026-09-12) is a fact about the screen — "this row
            // is shut" — not about the training, and a saved session has no
            // rows. Same treatment as `prefilled`, and a test asserts it.
            delete out.locked;
            return out;
          }),
      }))
      .filter((e) => e.sets.length);

    // Dropping the empty entries can leave one half of a superset behind still
    // claiming to be in one, and the day view would bracket it alone and call
    // it a Superset — a false claim about what was actually done.
    return dropOrphanGroups(entries);
  }

  /* Personal bests in what was just typed (UX review item 1: *"nothing
   * anywhere says you hit a personal best"* — the one rewarding readout the
   * whole app lacked). It lived here as a private closure until 2026-09-02 and
   * now lives in `js/personal-bests.js`, with its own tests, because typing a
   * record into Weight · Volume · 1RM (social-plan §13 Step 5) made it real
   * arithmetic rather than a max().
   *
   * 🚨 THE RULE 5 CLAIM THAT USED TO SIT HERE IS GONE, BECAUSE IT STOPPED
   * BEING TRUE. This block asserted the function was "RULE 5-SAFE BY
   * CONSTRUCTION… No estimate, no e1RM, no model anywhere in it". There is now
   * an e1RM in it: the `1RM` kind is the Marzagao curve applied to a set
   * nobody performed, which is an inference. Rule 5 is still honoured, but by
   * LABELLING rather than by absence — the record carries `estimated: true`
   * and the finish screen prints the word "estimated" beside it in a `.tag`,
   * a cue that is words rather than colour. See the module header for the
   * whole argument, and see `showFinished()` for the render half.
   */

  async function finish() {
    // Everybody in the session — whoever is active plus everyone parked.
    const people = [
      { name: state.forName, entries: state.entries },
      ...state.others.map((o) => ({ name: o.name, entries: o.entries })),
    ];
    const owner = people.find((p) => p.name == null) || { entries: [] };
    const guests = people
      .filter((p) => p.name != null)
      .map((p) => ({ name: p.name, meta: metaFor(p.name) || {}, cleaned: cleanedEntriesOf(p.entries) }))
      .filter((p) => p.cleaned.length);

    const cleaned = cleanedEntriesOf(owner.entries);

    if (!cleaned.length && !guests.length) {
      toast('Nothing recorded — enter at least one number');
      return;
    }

    // ⚠️ Read BEFORE the save lands, so the session being saved cannot be its
    // own history and beat itself. Both reads are served from the cache.
    let prs = [];
    try {
      const [priorSessions, priorBenchmarks] = await Promise.all([
        store.getSessions(), store.getBenchmarks(),
      ]);
      // On a RETRY after a mid-save failure this session is already stored,
      // and a session must not be its own history and beat itself.
      const ownId = state.saveIds && state.saveIds.you;
      // ⚠️ `exMap` is handed over so a per-side lift's VOLUME record counts
      // both dumbbells. It is the only thing the module needs the library for,
      // and the module works without it — see its per-side note.
      prs = personalBests(cleaned,
        priorSessions.filter((s) => !ownId || s.id !== ownId),
        priorBenchmarks.filter((b) => !ownId || b.sourceSessionId !== ownId),
        exMap);
    } catch (_) { /* a PR readout must never block a save */ }

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
          // The description, on the same absent-rather-than-empty contract.
          ...(state.note ? { note: state.note } : {}),
          entries: cleaned,
        });
      }
      // Each guest's half goes to its own collection under their name —
      // never into `sessions`, never a benchmark, never published (see the
      // guest-sessions note in store.js for why the separation is structural).
      /* ⚠️ NO `note` ON A GUEST ROW, and it is a decision rather than an
       * oversight. The description is written in a box labelled "How did it
       * go?" by whoever is holding the phone, about THEIR workout — there is
       * one box in the header, not one per person, so it cannot be anybody
       * else's answer. And a guest row is offered to that person's account the
       * moment they have one: shipping the recorder's sentence with it would
       * put words in somebody's mouth on their own calendar. `location` is
       * left off these rows already, for the milder version of the same
       * reason. If a per-guest description is ever wanted it needs a per-guest
       * box, which is a different feature. */
      for (const g of guests) {
        g.row = await store.saveGuestSession({
          id: state.saveIds['g:' + g.name],
          guestName: g.name,
          // Who this really was, so a later read does not have to match a name.
          ...(g.meta.personId ? { personId: g.meta.personId } : {}),
          ...(g.meta.uid ? { forUid: g.meta.uid } : {}),
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

    /* ⚠️ SENDING HAPPENS AFTER EVERYTHING IS SAFELY SAVED, AND IT MAY NEVER
     * BLOCK THE FINISH. Tim, 2026-08-29: *"once you're finished with the
     * workout it will send the workout to that user's account where they can
     * accept it."*
     *
     * The offer is a network write to somebody else's account, so it is the
     * most likely thing on this screen to fail — no signal in a gym basement is
     * the normal case, not the exception. The guest row is already on disk by
     * the time this runs, which means a failed send costs a tap on the calendar
     * ("Send this to …" has existed since 2026-08-27) and never a lost workout.
     * ⚠️ So this is deliberately NOT inside the try that calls saveFailed():
     * telling somebody their workout was not saved, when it was, would be the
     * worse lie of the two.
     *
     * The id is deterministic on the guest row, so sending twice is one offer —
     * which is what makes the manual re-send safe after a failure here.
     */
    for (const g of guests) {
      if (!g.meta.uid || !g.row) continue;
      try {
        await social.offerSession(g.meta.uid, g.row, g.name);
        g.sent = true;
      } catch (err) {
        g.sent = false;
        g.sendError = (err && err.message) || 'Could not send it just now.';
      }
    }

    // The roster is a convenience and its failure is not worth a word on
    // screen — but stamping it is what puts the people you actually train with
    // at the top of the picker next time.
    store.touchPeople(guests.map((g) => g.meta.personId).filter(Boolean))
      .catch(() => {});

    clearDraft();
    showFinished(cleaned, guests, prs);
  }

  /* ================================================================== *
   * THE SAVE SCREEN — everything about the session, asked at the end
   *
   * Tim, 2026-09-07: *"Instead of putting the description and location at the
   * top of the cite During a workout, put all that information as an option
   * after the workout is finished, and then the user can post the workout."*
   *
   * ⚠️ NOTHING IS WRITTEN UNTIL SAVE IS TAPPED, which is the half of this that
   * had to be got right. Finish used to BE the save; it now opens this screen
   * and `finish()` runs from the button here. The draft is untouched the whole
   * time, so the safety story is exactly what it was — the numbers are on disk,
   * and the only copy stays there until `store.saveSession()` has landed.
   *
   * ⚠️ AND THE FAILURE MESSAGE MOVED WITH IT. `saveError` used to live in the
   * runner's DOM, which was right while Finish was tapped from the runner and
   * would have been the 2026-08-22 bug all over again from here: a save that
   * failed would have written its explanation into a screen nobody was looking
   * at, and the button would have appeared to do nothing.
   *
   * ⚠️ Rendered by replacing `#app` rather than as a route, the same way
   * `showFinished()` is, so the hash stays on the session — a workout being
   * described is still a workout in progress, and navigating away and back must
   * land in the runner rather than on a form about a session that never saved.
   * ================================================================== */
  function openSaveScreen() {
    const own = cleanedEntriesOf(state.entries);
    const sets = own.reduce((n, e) => n + e.sets.length, 0);
    const guestNames = state.guestNames.slice();
    const started = Date.parse(state.startedAt);
    const secs = Number.isFinite(started)
      ? Math.max(0, Math.round((Date.now() - started) / 1000)) : null;
    /* ⚠️ SECONDS UNDER A MINUTE, rather than rounding to "0 min". A number that
     * says nothing happened, on the screen that summarises what did, is the
     * kind of small wrongness that makes somebody distrust the rest of the
     * figures — and a workout can genuinely be short. */
    const duration = secs === null ? '—'
      : secs < 60 ? `${secs}s`
      : secs < 3600 ? `${Math.round(secs / 60)} min`
      : `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}min`;

    /* ⚠️ SETS AND EXERCISES, WHERE HEVY PUTS VOLUME IN POUNDS. Not an oversight
     * and not a shortcut: `js/session-stats.js` already argues it for the feed
     * card — a session of pull-ups has no external load to total, so a pounds
     * figure reads a hard workout as nothing — and Tim asked for a set count
     * instead of volume in so many words (*"Replace Volume for # of sets"*).
     * The same three-stat shape, counting something that is true of every
     * session this app can record. */
    const stat = (label, value) => el('div', { class: 'save-stat' },
      el('div', { class: 'save-stat-label', text: label }),
      el('div', { class: 'save-stat-value', text: value }),
    );

    const noteBox = el('textarea', {
      class: 'input', rows: '3', maxlength: '280',
      placeholder: 'How did it go? What felt strong, what you changed, what hurt…',
      'aria-label': 'Description of this workout',
      onInput: (e) => {
        state.note = String(e.target.value || '').slice(0, 280);
        saveDraft(state);
      },
    });
    noteBox.value = state.note || '';

    const locBox = el('input', {
      class: 'input', type: 'text', maxlength: '80', autocomplete: 'off',
      placeholder: 'Gold’s Gym, home, the park…',
      'aria-label': 'Where this workout happened',
      onInput: (e) => {
        state.location = String(e.target.value || '').slice(0, 80);
        saveDraft(state);
      },
      /* ⚠️ THE DEFAULT IS SET ON BLUR, NOT ON EVERY KEYSTROKE. Tim's rule is
       * *"if the user ever sets a location, have that be the default"*, and it
       * survived the move off the header intact — but a settings write per
       * character would be one per letter of "Gold's Gym". Removing it still
       * does not clear the default: blank is "not this one". */
      onBlur: () => {
        if (state.location.trim()) {
          store.saveSettings({ defaultLocation: state.location.trim() }).catch(() => {});
        }
      },
    });
    locBox.value = state.location || '';

    /* ⚠️ THE DATE IS EDITABLE IN BOTH PLACES, AND THAT IS DELIBERATE RATHER
     * THAN AN OVERSIGHT. Two controls for one value is normally this project's
     * definition of a bug — the objection is drift, and there is none here:
     * both read and write `state.date` and both re-render from it, and they are
     * never on screen together. Keeping the header one is what preserves the
     * reason it was put there in the first place — *a workout being logged for
     * another day says so the whole way through, rather than springing it on
     * you at the end* — and this one is what makes the screen a true summary of
     * what is about to be written. */
    const saveDate = el('input', {
      class: 'session-date', type: 'date', value: state.date, max: todayISO(),
      'aria-label': 'Day this workout is recorded for',
      onChange: (e) => {
        state.date = e.target.value || todayISO();
        saveDraft(state);
        renderDate();
        paintDayNote();
      },
    });
    const dayNote = el('div', { class: 'field-help' });
    function paintDayNote() {
      dayNote.textContent = state.date === todayISO()
        ? 'Today.'
        : `Not today — this is being recorded for ${fmtDateLong(state.date)}.`;
    }
    paintDayNote();

    const saveBtn = el('button', {
      class: 'btn primary block',
      onClick: async () => {
        // ⚠️ Disabled for the duration. A second tap while the first save is in
        // flight is two saves of the same rows; the ids are stable so it could
        // not double anybody's training, but it can double a guest's OFFER.
        saveBtn.disabled = true;
        try { await finish(); } finally { saveBtn.disabled = false; }
      },
    }, icon('check'), 'Save workout');

    document.getElementById('app').replaceChildren(screenShell({
      title: 'Save workout',
      /* Back into the RUNNER, not into history. The save screen is drawn by
       * replacing `#app` without touching the hash, so the entry behind it is
       * whatever came before the session — the same reason the finish screen
       * opts out (Rule 8). Here the arrow plainly means "back to the workout",
       * which is still open and still on disk. */
      back: () => backToRunner(),
      backExact: true,
      scroll: el('div', { class: 'save-screen' },
        el('h2', { class: 'save-title', text: state.workoutName }),
        el('div', { class: 'save-stats' },
          stat('Duration', duration),
          stat('Sets', String(sets)),
          stat('Exercises', String(own.length)),
        ),
        /* ⚠️ NOTHING IS SAID HERE ABOUT WHO WILL SEE IT. Hevy's screen carries a
         * per-workout Visibility row; ours cannot, because visibility is a
         * property of the ACCOUNT (D29) and a per-workout flag is an open
         * question Tim owes a decision on — putting the row here would decide
         * it by building it. The Friends screen and Settings own that setting. */
        el('div', { class: 'field' },
          el('label', { text: 'Description' }),
          noteBox,
          el('div', { class: 'field-help', text:
            'Friends see this on your card. People who can only see that you trained do not.' }),
        ),
        el('div', { class: 'field' },
          el('label', { text: 'Gym' }),
          locBox,
          el('div', { class: 'field-help', text:
            'Whatever you type is the whole location — the app never reads GPS. '
            + 'It becomes the default for your next workout until you type a different one.' }),
        ),
        el('div', { class: 'field' },
          el('label', { text: 'Date' }),
          saveDate,
          dayNote,
        ),
        guestNames.length
          ? el('p', { class: 'field-help', text:
              `${guestNames.join(' and ')} saved with this too — their sets go under their own `
              + 'names, and a friend gets theirs offered to their account.' })
          : null,
        /* ⚠️ THE ONE DESTRUCTIVE CONTROL IN THIS FLOW, AND IT IS DOWN HERE
         * BELOW EVERYTHING, not beside Save. Hevy puts Discard at the bottom of
         * this screen too. It is the first "throw a workout away" control the
         * app has had anywhere near the normal path, so it confirms, and the
         * confirmation names the count rather than asking abstractly. */
        el('button', {
          class: 'btn danger save-discard',
          text: 'Discard workout',
          onClick: () => confirmSheet({
            title: 'Discard this workout?',
            message: sets
              ? `${sets} recorded set${sets === 1 ? '' : 's'} will be deleted. This cannot be undone.`
              : 'Nothing was recorded in it, so nothing is lost.',
            confirmLabel: 'Discard',
            danger: true,
            onConfirm: () => { clearDraft(); go('#/home'); },
          }),
        }),
      ),
      bottom: el('div', {}, saveError, saveBtn),
    }));
    // A description is the thing this screen exists to ask for, but focusing it
    // would raise the keyboard over the summary somebody just came here to read.
  }

  /** Back out of the save screen into the workout, which never stopped running. */
  function backToRunner() {
    renderDate();
    document.getElementById('app').replaceChildren(screen);
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

  function showFinished(entries, guests = [], prs = []) {
    const setCount = entries.reduce((n, e) => n + e.sets.length, 0);

    /* What each kind of record says, in a sentence that names the old number.
     * "Up from" is the whole point — a bare "165 lbs" is not a celebration of
     * anything, it is just the set you did. */
    const prDetail = {
      weight: (p) => `${units.withUnit(p.now)}, up from ${units.withUnit(p.was)}`,
      // The tag already reads REPS, so the word is not repeated in the line.
      reps: (p) => `${p.now}, up from ${p.was}`,
      // "in one set", because this is the biggest SINGLE set, not the session
      // total — a reader who assumed the latter would think they had done far
      // less work than they did.
      // ⚠️ "(both sides)" is not decoration. A per-side lift's volume counts
      // both dumbbells, so "60 lbs × 12" and "1,440 lbs" do not multiply out
      // and the reader is left with a total they cannot check.
      volume: (p) => `${units.withUnit(p.now)} in one set${p.perSide ? ' (both sides)' : ''}`
        + `, up from ${units.withUnit(p.was)}`,
      /* ⚠️ ROUNDED TO THE POUND, AND THAT IS PART OF THE HONESTY. `fmtWeight`
       * keeps two decimals, so the raw estimate prints as "202.65 lbs" — a
       * precision the model does not have and which no measurement on this
       * screen claims. An estimate may not out-resolve the set it came from.
       *
       * ⚠️ And it says what it was estimated FROM. That is the second half of
       * the Rule 5 answer: the "estimated" tag says it is modelled, and this
       * names the real set the model was fed, so the inference can be checked
       * against a measurement rather than simply believed. */
      e1rm: (p) => `${units.withUnit(Math.round(p.now))} from ${units.withUnit(p.weight)} × ${p.reps}`
        + `, up from ${units.withUnit(Math.round(p.was))}`,
    };

    // One block per exercise, its records listed under the name — Hevy hangs
    // the three types under the set that earned them (§12.15); our finish
    // screen has no set rows on it, so the exercise is the closest true anchor.
    const prGroups = [];
    for (const p of prs) {
      const last = prGroups[prGroups.length - 1];
      if (last && last.name === p.name) last.items.push(p);
      else prGroups.push({ name: p.name, items: [p] });
    }
    /* ⚠️ THERE IS A WAY BACK OFF THIS SCREEN (2026-08-29).
     *
     * Tim: *"if a user clicks 'finish this workout' at the end of their last
     * rep, keep the back button in case they wanted to quickly change something
     * or accidentally clicked on the finish workout button."*
     *
     * ⚠️ IT GOES TO THE EDIT FORM, NOT BACK INTO THE RUNNER, and that is the
     * safe half of the answer rather than a shortcut. The session is already
     * saved by the time this screen exists — that is the whole point of the
     * order finish() writes in — so "undo the finish" would mean deleting a
     * stored session and rebuilding a draft from it, which is a delete on the
     * one screen somebody just tapped by accident. The edit form changes every
     * part of what was recorded (its day, its name, its exercises, every set)
     * and is already built and tested, so the accidental tap costs one more tap
     * and nothing else.
     *
     * ⚠️ Only when there IS an owner session to edit. A coach who ran the whole
     * thing for somebody else has no session of their own, and a back button
     * pointing at nothing is worse than no back button. */
    const ownId = state.saveIds && state.saveIds.you;
    document.getElementById('app').replaceChildren(screenShell({
      title: 'Workout complete',
      // ⚠️ A FUNCTION, not a hash. `screenShell` hands `back` straight to
      // iconBtn as its onClick, and el() silently ignores a non-function `onX`
      // — so a string here renders a back button that does nothing at all.
      back: entries.length && ownId ? () => go(`#/edit/${ownId}`) : null,
      /* 🚨 THE ONE SCREEN WHERE THE ARROW IS NOT A BACK (2026-09-02). Every
       * other one now goes back through history and treats its `back` as a
       * fallback; this arrow means "go and change what you just recorded", and
       * it is the whole reason it exists (Tim, 2026-08-29).
       *
       * ⚠️ AND HISTORY WOULD BE ACTIVELY WRONG HERE. This screen is drawn by
       * replacing #app directly, WITHOUT changing the hash — so the previous
       * entry is the session runner, whose draft has just been cleared.
       * Stepping back onto it would reopen a workout that no longer exists. */
      backExact: true,
      noNav: true,
      scroll: el('div', { class: 'finish-hero' },
        el('div', { class: 'finish-check' }, icon('check')),
        el('h2', { text: 'Nice work' }),
        /* ⚠️ Personal bests lead, because they are the one thing on this
         * screen that is not the same every time.
         *
         * 🚨 THIS BLOCK CAN NOW HOLD AN ESTIMATE, WHICH IT COULD NOT BEFORE.
         * The comment here used to say "recorded-vs-recorded only — this block
         * may never hold an estimate", and the 1RM record breaks that. Rule 5
         * is kept instead by the pair of `.tag` pills every estimated record
         * carries: `1RM` and `ESTIMATED`, in words, so the cue survives
         * greyscale, colour-blindness and a screen reader. The three recorded
         * kinds carry the type tag and no second one — the absence of the word
         * is what says "measured".
         *
         * Calm, not a scoreboard: no medals, no counts, no colour beyond the
         * one accent hairline `.finish-prs` already draws. */
        prGroups.length
          ? el('div', { class: 'finish-prs' },
              el('div', { class: 'finish-prs-head' }, icon('up', 15),
                `Personal best${prs.length === 1 ? '' : 's'}`),
              ...prGroups.map((g) => el('div', { class: 'finish-pr' },
                el('div', { text: g.name }),
                ...g.items.map((p) => el('div', {},
                  el('span', { class: 'tag', text: PB_LABEL[p.kind] }),
                  p.estimated ? el('span', { class: 'tag', text: 'estimated' }) : null,
                  ` ${prDetail[p.kind](p)}`)),
              )),
            )
          : null,
        // The owner's line only describes the owner's training. When they
        // recorded nothing and coached a guest through the whole thing, saying
        // "0 sets" would read as a failed save — the guests' lines are the
        // record of what happened.
        entries.length
          ? el('p', { text: `${state.workoutName} · ${entries.length} exercise${entries.length === 1 ? '' : 's'} · ${setCount} set${setCount === 1 ? '' : 's'}` })
          : el('p', { text: `${state.workoutName} — nothing recorded for you` }),
        /* ⚠️ EACH PERSON'S LINE SAYS WHERE THEIR WORKOUT WENT, because the two
         * destinations are genuinely different promises and the difference is
         * invisible otherwise. A saved person's sets stop on this phone. A
         * friend's have been OFFERED to their account and are not theirs until
         * they tap Add — saying "sent" without saying "to accept" would have
         * the recorder believe it landed. And a FAILED send has to name the way
         * out, in the same line, or it reads as work lost. */
        ...guests.map((g) => {
          const gs = g.cleaned.reduce((n, e) => n + e.sets.length, 0);
          const head = `Also recorded for ${g.name} — ${g.cleaned.length} exercise${g.cleaned.length === 1 ? '' : 's'} · ${gs} set${gs === 1 ? '' : 's'}`;
          if (!g.meta || !g.meta.uid) return el('p', { text: head });
          return el('p', {}, head,
            g.sent
              ? el('span', { class: 'sent-note' }, ' · ',
                  el('b', { text: `Sent to ${g.name}` }), ' to add to their own training.')
              : el('span', { class: 'is-warn' }, ' · ',
                  el('b', { text: 'Not sent.' }),
                  ` ${g.sendError || ''} Their sets are safe here — open this day on the calendar and tap “Send this to ${g.name}”.`));
        }),
        el('p', { text: `Saved to ${fmtDateLong(state.date)}` }),

        /* ⚠️ THE WORKOUT IS ON THIS SCREEN NOW, not behind a button (2026-08-29).
         *
         * Tim: *"instead of having 2 buttons: 'view workout' and 'back to home',
         * just display this workout and then keep the back to home setting when
         * they're done."*
         *
         * "View this workout" was a tap that led to a screen showing what the
         * screen you were already on had just described in one line — and it
         * left the finish screen with two primary-looking actions where there
         * is only one thing to do next. Showing the sets here answers the
         * question the button existed for, and the one button left is the one
         * that ends the session. */
        entries.length
          ? el('div', { class: 'finish-record' },
              ...entries.map((e) => el('div', { class: 'finish-ex' },
                exerciseLabel({ exercise: exMap.get(e.exerciseId), name: e.exerciseName,
                  tag: 'div', className: 'finish-ex-name' }),
                el('div', { class: 'finish-ex-sets' },
                  ...e.sets.map((set, i) => el('span', { class: 'finish-set' },
                    fmtSet(set, e.fields || ['weight', 'reps'], e.loadType || null)
                    + (i < e.sets.length - 1 ? ' ·' : ''))),
                ),
              )),
            )
          : null,
      ),
      bottom: el('button', { class: 'btn primary block', text: 'Back to home', onClick: () => go('#/home') }),
    }));
  }

  /**
   * Put the workout down without ending it — Tim's ask, 2026-09-07.
   *
   * ⚠️ IT ASKS NOTHING, AND THE SHEET IT REPLACED IS WHY THE FEATURE WAS NEEDED.
   * The ✕ used to open *"Leave this workout? Your progress is saved as a
   * draft"*, which was true and read as a warning — a question with a Cancel
   * button is the app saying this might cost you something. Nothing is at stake:
   * every set is already on disk, the bar above the nav says so on every screen,
   * and the way back is one tap. A confirmation here would be friction charged
   * for an action that undoes itself.
   *
   * ⚠️ Through `goBack`, not `#/home` (Rule 8). You reach the runner from the
   * Record picker, from a workout's own screen, or from a deep link, and the
   * arrow means the screen you were on — home is only the fallback for a session
   * opened cold.
   */
  function minimize() {
    /* 🆕 IT SLIDES OFF THE BOTTOM — 2026-09-10, Tim: *"Similarly to this
     * downwards/upwards animation, I want to have this similar animation for
     * when you're in the middle of a workout and you click down on it to the
     * main page or click up to resume the workout."*
     *
     * The same call Record's down arrow makes, for the same reason: the screen
     * you are putting down is the thing that moves, over whatever the router
     * draws underneath it. ⚠️ `parkScreen` returns null where nothing can
     * animate (reduced motion, jsdom), so this stays a plain navigation there
     * and no test ever sees a second `.screen`. */
    parkScreen(document.querySelector('#app > .screen'), { falls: true });
    goBack(() => go('#/home'));
  }

  /* ---- rest timer ---- */
  //
  // ⚠️ OFF BY DEFAULT SINCE 2026-08-28, BEHIND A SETTING — Tim's call, and his
  // words are the design note: *"I don't love the rest timer personally. When
  // I'm working out it just doesn't help and it's easy for me to feel it out
  // myself."* So the bar does not render and nothing ever ticks unless the
  // Settings switch is on. A 2026-08-28 usability pass had a list of
  // improvements for this bar (a done-gesture to start it on the happy path,
  // bigger digits, a default target); ⚠️ **he explicitly declined all of them**
  // — "it's a sub-feature" — so do not pick those up without him asking.
  //
  // Everything below is unchanged for the user who turns it on.
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
  const restEnabled = settings.restTimer === true;
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

  // ⚠️ Gated HERE rather than at the call sites, so the superset / drop-set
  // exceptions in the stepper's onChange stay exactly as they are for the user
  // who turns the timer on, and the runner never has to know the feature can
  // be off. Off means off: no timestamp written into the draft, no interval.
  function startRest() {
    if (!restEnabled) return;
    state.restStartedAt = Date.now();
    saveDraft(state);
    ensureTicking();
  }

  if (restEnabled && state.restStartedAt) ensureTicking();
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

  /* ⚠️ THE LOCATION AND DESCRIPTION CHIPS LEFT THE HEADER ON 2026-09-07 —
   * Tim: *"Instead of putting the description and location at the top of the
   * cite During a workout, put all that information as an option after the
   * workout is finished."* Both are fields on the save screen now; the state
   * they write (`state.location`, `state.note`) and everything downstream of it
   * is unchanged, including the rule that typing a gym sets the default for
   * every workout after this one.
   *
   * ⚠️ The note that used to sit here argued the description belonged in the
   * runner *because our finish screen renders after the save has landed*. That
   * was true of the OLD finish screen and is the thing this change fixed: the
   * save screen renders BEFORE anything is written, so the box describes a
   * session that is still a draft, and Finish is still one write.
   *
   * ⚠️ `note` IS THE SESSION'S DESCRIPTION. `entry.notes` — rendered as
   * `.note-card` on the set screen — is the per-exercise coaching note off the
   * template. Same word, different fields; nothing here touches that one. */

  renderAll();

  const screen = el('div', { class: 'screen no-nav' },
    el('header', { class: 'topbar' },
      /* ⚠️ A DOWN ARROW, NOT AN ✕ — and the glyph is the whole message. An ✕
       * closes, and closing a workout is precisely what this does not do. Hevy
       * uses the same arrow for the same reason: it says "put this away", and
       * the bar it minimises into carries the matching arrow pointing back up. */
      iconBtn('down', 'Leave this workout open and go back', minimize),
      el('div', { style: 'flex:1;min-width:0' },
        el('h1', { text: workout.name }),
        el('div', { class: 'topbar-sub session-sub' },
          el('span', { text: existingDraft ? 'Resumed' : 'In progress' }),
          el('span', { class: 'session-sub-dot', text: '·' }),
          // ⚠️ THE DAY STAYS HERE as well as on the save screen, and it is the
          // one thing that did not move: its whole job is to say NOT TODAY the
          // way through a back-dated workout rather than at the end of it.
          dateInput,
          dateNote,
        ),
      ),
    ),
    peopleBar,
    progress,
    pane,
    // Off by default (Tim, 2026-08-28) — the bar simply is not on the screen.
    restEnabled ? restBar : null,
    footer,
  );

  return screen;
}

/* ================================================================== *
 * Quick activity log — a run, a swim, a climb (2026-08-26)
 *
 * The non-lifting half of Record's category chooser. It saves a REAL
 * session — one entry, one set of time/distance — so the calendar, the feed,
 * backups and the cloud ceiling all see it with machinery that already
 * exists. Nothing here reaches the muscle map or the ratings: cardio-group
 * exercises have always been unrankable, and that is the design, not a gap
 * (docs/activities-plan.md).
 * ================================================================== */

export async function ActivityLogView(presetName) {
  const exMap = await store.getExerciseMap();
  const preset = presetName
    ? [...exMap.values()].find((e) => e.name === decodeURIComponent(presetName))
    : null;

  const state = {
    date: todayISO(),
    exercise: preset || null,
    values: {},
  };
  if (preset) for (const f of preset.fields) state.values[f] = 0;

  const dateInput = el('input', {
    class: 'input', type: 'date', value: state.date, max: todayISO(),
    'aria-label': 'Day this activity happened',
    onChange: (e) => { state.date = e.target.value || todayISO(); },
  });

  const exBtn = el('button', { class: 'row', onClick: pickExercise },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: preset ? preset.name : 'Choose an activity' }),
      el('div', { class: 'row-sub', text: preset
        ? 'Tap to log a different activity instead'
        : 'Anything in the library, or create your own' }),
    ),
    el('span', { class: 'row-chev' }, icon('right')),
  );

  const stepWrap = el('div', { class: 'steppers' });
  const saveBtn = el('button', {
    class: 'btn primary block', text: 'Save activity',
    disabled: !preset, onClick: save,
  });

  function renderSteppers() {
    setChildren(stepWrap,
      ...state.exercise.fields.map((f) =>
        stepper({
          field: f,
          value: state.values[f] || 0,
          onChange: (v) => { state.values[f] = v; },
        }).node),
    );
  }
  if (preset) renderSteppers();

  function pickExercise() {
    openExercisePicker({
      exMap,
      title: 'Choose activity',
      onPick: (ex) => {
        state.exercise = ex;
        state.values = {};
        for (const f of ex.fields) state.values[f] = 0;
        exBtn.querySelector('.row-title').textContent = ex.name;
        exBtn.querySelector('.row-sub').textContent = `${ex.muscle} · ${ex.equipment}`;
        renderSteppers();
        saveBtn.disabled = false;
        document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
        return true;
      },
    });
  }

  async function save() {
    if (!state.exercise) { toast('Pick an activity first'); return; }
    if (!Object.values(state.values).some((v) => Number(v) > 0)) {
      toast('Enter a time or a distance');
      return;
    }
    // ⚠️ startedAt is NOW, not a guess about when the run happened — the same
    // contract the runner keeps when a session is back-dated: the date moved,
    // the clock did not. A back-dated activity simply publishes no duration,
    // because sessionMinutes() drops sub-5-minute stamps.
    const now = new Date().toISOString();
    try {
      await store.saveSession({
        workoutName: state.exercise.name,
        date: state.date,
        startedAt: now,
        finishedAt: now,
        isBenchmark: false,
        entries: [{
          exerciseId: state.exercise.id,
          exerciseName: state.exercise.name,
          sets: [{ ...state.values }],
        }],
      });
    } catch (err) {
      toast((err && err.message) || 'Could not save this activity.');
      return;
    }
    toast('Activity saved');
    go('#/day/' + state.date);
  }

  return screenShell({
    title: preset ? preset.name : 'Log an activity',
    sub: 'Counts as training — never rated',
    back: () => go('#/record'),
    top: [
      el('div', { class: 'field' }, el('label', { text: 'Date' }), dateInput),
      el('div', { class: 'field' }, el('label', { text: 'Activity' }), exBtn),
    ],
    scroll: [
      stepWrap,
      el('div', { class: 'field-help', text:
        'Saved to your calendar and shared like any workout, under whatever each friend is '
        + 'allowed to see. It never touches your muscle map or strength ratings — those read '
        + 'lifting only.' }),
    ],
    bottom: saveBtn,
  });
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
  const estLine = el('div', { class: 'bench-est' });
  const submitBtn = el('button', { class: 'btn primary block', text: 'Save benchmark', disabled: true, onClick: submit });

  /* ⚠️ STARTED HERE AND NOT AWAITED, which is the difference between a screen
   * that opens and one that waits. `muscleStrength()` walks the whole training
   * history — the same work the Muscles tab does — and this screen's first job
   * is to let somebody pick an exercise, which needs none of it. It is read
   * once rather than per exercise, because re-walking a year every time
   * somebody changes their mind about which lift to test would be absurd.
   *
   * It is also allowed to fail. A brand-new account has no profile and no
   * history, and this screen worked without an estimate for months. */
  let muscles = null;
  let bodyWeight = null;
  /* ⚠️ `muscleRatings()`, NOT `muscleStrength()`. The latter gates everything
   * behind a complete profile because it places you against published standards
   * — and this screen wants pounds, not a percentile. Gating a weight estimate
   * on a weigh-in told anybody who had not used a scale that the app knew
   * nothing about their back, which it plainly did. */
  const ratingsReady = Promise.all([
    muscleRatings(), store.latestBodyWeight().catch(() => null),
  ]).then(([rated, bw]) => {
    muscles = rated;
    bodyWeight = bw ? bw.weight : null;
  }).catch(() => { /* no estimate is a quieter screen, never an error */ });

  // What the app thinks this lift is worth, before a single number is typed.
  let est = null;

  /* 🚨 THE ONE CALLER IN THE APP THAT ASKS FOR A STAND-IN RATING, AND THE FLAG
   * LIVES HERE RATHER THAN AT THE TWO CALL SITES SO THERE IS ONE THING TO GREP.
   *
   * `estimateOneRM()` refuses by default when the muscle it would convert
   * through has no direct evidence of its own — three estimates multiplied is
   * the chain that module's header spends thirty lines arguing against, and it
   * is still the default for every other caller: the runner's opening weight
   * (js/views-session.js, `derivedWeights`) and the compare screen
   * (js/views-social.js, `friendEstimates`) both leave it alone.
   *
   * ⚠️ WHY THIS SCREEN IS DIFFERENT, IN ONE SENTENCE: nothing here is loaded
   * onto a bar. This is a number somebody reads while deciding what to attempt,
   * on Tim's instruction that a labelled best-effort number beats a blank
   * (docs/direction.md §3.1) — and the half of that instruction he kept is
   * *"have a way to be upfront about it"*, which is `renderEstimate()`'s job
   * below and is not optional. The runner's field is the opposite case and JOB B
   * of this change deliberately left it empty.
   *
   * ⚠️ AND IT IS OPT-IN, NOT A LOOSENING. Without this object the refusal is
   * exactly what it was; the estimate that comes back is flagged `viaFallback`,
   * its confidence is multiplied down a third time and its band is capped. */
  const ESTIMATE_OPTS = { allowFallback: true };
  // Set by renderSteppers(), so the estimate landing late can repaint them.
  let repaintCaptions = () => {};

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
        est = muscles ? estimateOneRM(ex, muscles, bodyWeight, ESTIMATE_OPTS) : null;
        renderEstimate();
        renderSteppers();
        submitBtn.disabled = false;
        document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove());
        /* The history walk usually finishes long before anybody has picked an
         * exercise, and on a big account it may not. Either way the estimate
         * appears when it is ready rather than being missing for good — and
         * `state.exercise` is re-read rather than closed over, so choosing a
         * different lift while it was still working cannot paint the old one's
         * estimate over the new one's. */
        ratingsReady.then(() => {
          if (!muscles || !state.exercise || state.exercise.id !== ex.id) return;
          est = estimateOneRM(state.exercise, muscles, bodyWeight, ESTIMATE_OPTS);
          renderEstimate();
          repaintCaptions();
        });
        return true;
      },
    });
  }

  /* 🚨 WHAT THIS SCREEN NOW SAYS BEFORE YOU LIFT, AND WHY IT IS ALLOWED TO.
   *
   * Tim, 2026-09-02: *"when the user records a benchmark, there should be some
   * sort of display showing the predicted 1RM for that exercise… when they put
   * in a weight for their benchmark, put a number above the reps that estimates
   * how many they can do. Additionally, put a % above the weight that says what
   * % of the estimated 1RM the site thinks they can lift."*
   *
   * ⚠️ EVERY ONE OF THESE THREE NUMBERS IS AN INFERENCE AND EVERY ONE SAYS SO IN
   * WORDS — Rule 5's general form is that an inference must never look like a
   * measurement and the cue may not be colour alone. The estimate names the
   * exercises it was converted from, so somebody can see it came from their own
   * dumbbell rows rather than out of the air.
   *
   * ⚠️ AND THE REP NUMBER IS THE ONE MOST LIKELY TO BE WRONG, so it is worded as
   * a guess rather than a target. It answers "reps to momentary failure", and
   * research.md §3 measured that people under-predict their own reps to failure
   * by one to five — so somebody stopping where they normally stop will do fewer
   * than this says. The app has no reps-in-reserve field and never will (D28), so
   * that gap is invisible to it and has to be stated instead.
   */
  function renderEstimate() {
    if (!est) {
      // ⚠️ Three different silences and they are not the same sentence. Nothing
      // picked yet; the history has been read and this lift cannot be reached
      // from it; or the read has not finished. Saying "nothing converts to it"
      // while still working would be a claim the app has not checked.
      //
      // ⚠️ AND THE MIDDLE ONE IS NARROWER THAN IT LOOKS NOW. Since this screen
      // passes `allowFallback`, a muscle known only through a stand-in no longer
      // lands here — it gets a number and the sentence below. What still reaches
      // this line is a lift with no direct contribution at all, a custom
      // exercise, a bodyweight lift with no weigh-in, or a muscle with no rating
      // of any kind, which is Tim's own "you can't compare" case. The claim is
      // unchanged and still true; the population it describes is smaller.
      setChildren(estLine,
        el('div', { class: 'field-help', text:
          !state.exercise ? 'Pick an exercise.'
            : muscles ? 'No estimate for this one yet — nothing you have recorded converts to it.'
              : 'Working out what you might lift…' }));
      return;
    }
    const from = est.from.length
      ? `your ${est.from.slice(0, 3).join(', ')}`
      : 'your recorded training';
    setChildren(estLine,
      el('div', { class: 'bench-est-head' },
        el('span', { class: 'bench-est-num mono', text: units.withUnit(Math.round(est.shown)) }),
        el('span', { class: 'tag', text: 'estimated' }),
      ),
      el('div', { class: 'bench-est-note', text:
        `Estimated 1-rep max${est.perSide ? ' per side' : ''} · ${est.band.name.toLowerCase()} confidence` }),
      /* 🚨 THE FALLBACK BRANCH IS FIRST, AND THAT ORDER IS LOAD-BEARING. An
       * exercise can BE its muscle's key lift while that muscle's rating is
       * itself a stand-in — `isKeyLift` and `viaFallback` are both true, and
       * checking `isKeyLift` first would print "nothing here was converted" over
       * a number that was converted twice. That is the exact failure Rule 5
       * names: an inference wearing a measurement's clothes.
       *
       * ⚠️ IT NAMES BOTH HOPS BY NAME, because a reader cannot judge a chain
       * they cannot see: which muscle stood in for which, and which exercise the
       * stand-in was then converted into. The confidence band above is capped at
       * Fair for exactly this case, so the words and the label agree. */
      el('div', { class: 'field-help', text:
        est.viaFallback
          ? `Nothing you have recorded trains ${est.muscle.toLowerCase()} directly, so ${from}`
            + `${est.standIn ? ` — ${est.standIn.toLowerCase()} work — ` : ' '}`
            + `stood in for it, and that stand-in was then converted into ${state.exercise.name}. `
            + 'Two conversions on top of your own sets: a rough marker, not a target. '
            + `Any direct ${est.muscle.toLowerCase()} exercise would rate it properly.`
          : est.isKeyLift
            ? `Worked out from ${from} — nothing here was measured on this lift at a single rep.`
            : `Worked out ${from}, converted through ${est.muscle.toLowerCase()}. `
              + 'A conversion between exercises is an estimate on top of an estimate, which is what '
              + 'the confidence above is about.' }),
    );
  }

  function renderSteppers() {
    const fields = state.exercise.fields;
    // ⚠️ The captions are re-rendered from INSIDE onChange, so they need to
    // outlive the render — a node created per keystroke would be replaced
    // underneath the reader mid-typing.
    const caps = {};

    const nodes = fields.map((f) => {
      const s = stepper({
        field: f,
        value: 0,
        suffix: f === 'weight' && state.exercise.loadType ? LOAD_LABEL[state.exercise.loadType] : null,
        onChange: (v) => { state.values[f] = v; renderCaptions(); },
      });
      if (f === 'weight' || f === 'reps') {
        caps[f] = el('div', { class: 'step-est' });
        // Between the field's name and its big number, so it reads as a note
        // about the number rather than as another number.
        s.node.insertBefore(caps[f], s.node.querySelector('.stepper-controls'));
      }
      return s.node;
    });

    function renderCaptions() {
      // ⚠️ NO ARITHMETIC ON NOTHING. This screen opens at 0, and "0 % of your
      // estimated max" is the same mistake the assist readout's own comment
      // warns about: a number computed off an empty field looks like a reading.
      const w = Number(state.values.weight) || 0;
      const oneRM = est ? est.oneRM : 0;
      const totalW = state.exercise.loadType === 'per_side' ? w * 2 : w;

      if (caps.weight) {
        const pct = oneRM > 0 && totalW > 0 ? percentOfMax(oneRM, totalW) : null;
        setChildren(caps.weight, pct === null
          ? ''
          : el('span', {}, el('b', { text: `${Math.round(pct)}%` }), ' of your estimated max'));
      }
      if (caps.reps) {
        const p = oneRM > 0 && totalW > 0 ? repPrediction(oneRM, totalW) : null;
        setChildren(caps.reps, !p
          ? ''
          : p.over
            ? el('span', { text: 'at or above what we think your max is' })
            : el('span', {},
                'maybe ', el('b', { text: `${p.reps}${p.atLeast ? '+' : ''}` }), ' to failure'));
      }
    }

    repaintCaptions = renderCaptions;
    setChildren(stepWrap, ...nodes);
    renderCaptions();
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
    // ⚠️ The estimate is ABOVE the steppers, not below them. It is the thing you
    // read before deciding what to load, and a note under the numbers would be
    // read after the decision it exists to inform — if at all.
    scroll: el('div', { class: 'bench-body' }, estLine, stepWrap),
    bottom: submitBtn,
  });
}
