// The in-workout recording flow, plus the benchmark form.

import { store, social, muscleStrength, todayISO, demo, uid } from './store.js';
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
  // ⚠️ Filter on the exercise's OWN FIELDS, not on Object.values(set). A set
  // carries a `minis` array, and `Number([{…}])` is NaN — so the old blanket
  // check happened to work, but only by accident, and it would have thrown away
  // a set whose numbers were all in its drops. Hoisted out of finish() on
  // 2026-08-24 because the exercise swap asks the same question: has this
  // exercise actually been done yet?
  const hasNumbers = (s, fields) => fields.some((f) => Number(s[f]) > 0);
  const setIsRecorded = (s, fields) =>
    // ⚠️ A SET STILL MARKED `prefilled` IS NOT RECORDED, whatever numbers are
    // in it. Everything else in this app treats "has a number" as "was
    // performed", which is true of a number somebody typed and false of one
    // the app worked out for them. See DEFAULT_REPS and startingSet().
    !s.prefilled
    && (hasNumbers(s, fields) || minisOf(s).some((d) => hasNumbers(d, fields)));

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
   * ⚠️ DIRECT contributions only, never a fallback. A fallback is one muscle
   * standing in for another and is the weakest reading in the table.
   *
   * Fire-and-forget: every failure yields an empty map and the runner opens on
   * reps alone, which is exactly what it did before this existed.
   */
  const derivedWeights = new Map();
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
      if (!best) continue;
      const rating = muscles.get(best.muscle);
      if (!rating || !(rating.estimate > 0) || !(rating.confidence >= 0.35)) continue;
      // `ratio` is this exercise's load as a fraction of the muscle's key lift,
      // and it is in TOTAL load — so a per-side entry halves on the way out.
      const oneRepTotal = rating.estimate * best.ratio;
      const forTen = e1.weightForReps(oneRepTotal, DEFAULT_REPS);
      if (!(forTen > 0)) continue;
      const shown = ex.loadType === 'per_side' ? forTen / 2 : forTen;
      derivedWeights.set(ex.id, { weight: shown, from: best.muscle });
    }
  } catch (_) { /* no estimate is a quieter screen, never an error */ }

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
    // Drafts written before 2026-08-29 have no personMeta, which is exactly
    // right for them: every name in one is an invented guest with no account,
    // and an empty meta is what that means. A workout in progress across the
    // deploy therefore keeps working and simply sends nothing.
    if (!state.personMeta || typeof state.personMeta !== 'object') state.personMeta = {};
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
      /* Who each name in `guestNames` actually IS — `{ uid }` for a friend
       * whose account this gets offered to at Finish, `{ personId }` for a
       * saved identity with no account, `{}` for a name typed and not saved.
       * Keyed by name because addPerson() refuses duplicates within a session;
       * the keys that reach disk are personId and uid. */
      personMeta: {},
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
    if (state.forName == null) return store.getSessions();
    const { sessions } = await historyForPerson(state.forName);
    return sessions;
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
    state.guestNames.push(name);
    state.others.push({
      name,
      entries: entriesFor(sessions, null, state.date),
      index: 0,
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
        rows.push(el('div', { class: 'field-help', text: social.available
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
        return el('button', {
          class: 'chip person-chip' + (meta.uid ? ' is-account' : ''),
          'aria-pressed': state.forName === n ? 'true' : 'false',
          title: meta.uid ? `${n} has an account — this is sent to them at the end` : null,
          onClick: () => switchTo(n),
        }, meta.uid ? icon('person', 12) : null, n);
      }),
      el('button', {
        class: 'chip person-chip person-add',
        'aria-label': 'Add a person to record for',
        onClick: openAddPerson,
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
      if (dropIndex == null) fillOnOpen(i);
      entry.active = i;
      entry.activeDrop = dropIndex;
      saveDraft(state);
      // ⚠️ KEEP THE SCROLL. The controls are inside the list now, so a render
      // that jumped back to the top would throw away the position of the row
      // somebody just tapped — set 4 of a long exercise would open off-screen.
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
        const t = r.read();
        r.vals.textContent = t;
        r.pick.setAttribute('aria-label', r.name(t));
      }
    }

    function renderSets() {
      const rows = [];
      liveRows.length = 0;
      entry.sets.forEach((s, i) => {
        const isHere = i === entry.active;
        const open = isHere && entry.activeDrop == null;
        const text = fmtSet(s, entry.fields, entry.loadType);
        const vals = el('span', { class: 'set-vals', text });
        const pick = el('button', {
          class: 'set-pick',
          'aria-label': `Set ${i + 1}: ${text}`,
          'aria-current': open ? 'true' : null,
          // The row is a disclosure now — it opens the controls for that set
          // rather than re-pointing a block elsewhere on the screen.
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => select(i, null),
        },
          el('span', { class: 'set-num', text: String(i + 1) }),
          vals,
        );
        liveRows.push({
          vals, pick,
          read: () => fmtSet(s, entry.fields, entry.loadType),
          name: (t) => `Set ${i + 1}: ${t}`,
        });
        rows.push(el('div', { class: 'set-item' + (open ? ' active' : '') },
          pick,
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
        if (open) rows.push(editor);

        // Drops hang UNDER their set and are indented, because that is what they
        // are — the same set continued at a lower weight. They are deliberately
        // not numbered as sets: one drop set is one hard set (progress.md §6),
        // and numbering them 1, 2, 3 would teach the opposite.
        minisOf(s).forEach((d, di) => {
          const dOpen = isHere && entry.activeDrop === di;
          const dText = fmtSet(d, entry.fields, entry.loadType);
          const dVals = el('span', { class: 'set-vals', text: dText });
          // Same restructure as the set row above, for the same reason: the ↳
          // is a 22px glyph and the numbers beside it are what a thumb aims at.
          const dPick = el('button', {
            class: 'set-pick',
            'aria-label': `${miniLabel(entry.setType, di + 1)} of set ${i + 1}: ${dText}`,
            'aria-current': dOpen ? 'true' : null,
            'aria-expanded': dOpen ? 'true' : 'false',
            onClick: () => select(i, di),
          },
            el('span', { class: 'set-num drop-num', text: '↳' }),
            dVals,
          );
          liveRows.push({
            vals: dVals, pick: dPick,
            read: () => fmtSet(d, entry.fields, entry.loadType),
            name: (t) => `${miniLabel(entry.setType, di + 1)} of set ${i + 1}: ${t}`,
          });
          rows.push(el('div', { class: 'set-item set-drop' + (dOpen ? ' active' : '') },
            dPick,
            el('button', {
              class: 'set-del', 'aria-label': `Delete ${miniLabel(entry.setType, di + 1)}`,
              onClick: () => {
                s.minis.splice(di, 1);
                if (!s.minis.length) delete s.minis;
                entry.activeDrop = null;
                saveDraft(state);
                renderPane({ keepScroll: true });
              },
            }, icon('trash')),
          ));
          if (dOpen) rows.push(editor);
        });
      });
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
          // ⚠️ TOUCHING A NUMBER IS WHAT MAKES THE SET REAL. Until then it holds
          // what the app worked out, and `setIsRecorded` refuses to count it —
          // which is what stops a derived opening weight being saved as a set
          // somebody never did. One nudge, one keystroke, and it is theirs.
          delete target.prefilled;
          delete activeSet.prefilled;
          saveDraft(state);
          renderAssist();
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
      }).node);

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
          // Swap's sibling (2026-08-28): drop the exercise from today entirely.
          // Same quietness, same contract — the saved workout is never touched.
          el('button', {
            class: 'swap-btn',
            title: 'Remove this exercise from today’s session',
            onClick: () => removeExercise(step.entryIndex),
          }, icon('trash', 15), 'Remove'),
        ),
        el('div', { class: 'session-ex-meta' },
          `${ex ? ex.muscle + ' · ' + ex.equipment + ' · ' : ''}Exercise ${step.entryIndex + 1} of ${state.entries.length}`,
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

      /* ⚠️ THE FIRST-TIME NOTE DOES NOT WEAR THE GREEN CHECK, and that is Rule 5
       * rather than styling. `.prefill-note`'s check is `--good` and sits beside
       * "Last time: 135 lbs", which is a MEASUREMENT. A worked-out opening
       * weight is an inference, and the rule's general form is that an inference
       * must be visually separable from a recording by a cue that is not colour
       * alone. So the derived case borrows `.suggest-note` — the app's existing
       * "this is a proposal" treatment — and says out loud that the number was
       * worked out rather than measured. */
      entry.hadHistory
        ? el('div', { class: 'prefill-note' }, icon('check', 16),
            el('span', {}, 'Last time: ', el('b', { text: entry.lastSummary })))
        : entry.opening === 'derived'
          ? el('div', { class: 'suggest-note' }, icon('up', 15),
              el('div', { class: 'suggest-body' },
                el('div', { class: 'suggest-head', text: 'First time logging this — a starting point, not a measurement' }),
                el('div', { class: 'suggest-why', text:
                  `Worked out from what you have already lifted for ${String(entry.openingFrom || 'this muscle').toLowerCase()}, at ${DEFAULT_REPS} reps. `
                  + 'Change it to whatever you can actually lift — nothing is recorded until you do, '
                  + 'and your real numbers are what it uses from then on.' }),
              ))
          : el('div', { class: 'prefill-note' },
              el('span', {}, 'First time logging this — ',
                el('b', { text: entry.opening === 'reps' ? `type what you can lift at about ${DEFAULT_REPS} reps` : 'type what you did' }),
                '. It will be remembered.')),

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

    const doRemove = () => {
      state.entries.splice(index, 1);
      const counts = new Map();
      for (const e of state.entries) {
        if (e.group != null) counts.set(e.group, (counts.get(e.group) || 0) + 1);
      }
      for (const e of state.entries) {
        if (e.group != null && counts.get(e.group) < 2) e.group = null;
      }
      // Land on the exercise that now occupies this slot (or the new last one)
      // — state.index walks STEPS, not entries, for the reason the swap's
      // split path spells out. goToStep() clamps, saves and renders.
      const at = steps().findIndex((s) => s.entryIndex === Math.min(index, state.entries.length - 1));
      goToStep(at >= 0 ? at : 0);
      toast(`Removed ${entry.exerciseName} — today only`);
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
            return out;
          }),
      }))
      .filter((e) => e.sets.length);

    // Dropping the empty entries can leave one half of a superset behind still
    // claiming to be in one, and the day view would bracket it alone and call
    // it a Superset — a false claim about what was actually done.
    return dropOrphanGroups(entries);
  }

  /**
   * Personal bests in what was just typed (UX review item 1: *"nothing
   * anywhere says you hit a personal best"* — the one rewarding readout the
   * whole app lacked).
   *
   * ⚠️ RULE 5-SAFE BY CONSTRUCTION: it compares two RECORDED sets — the
   * number just typed against the biggest number ever typed for that
   * exercise, benchmarks included. No estimate, no e1RM, no model anywhere
   * in it, so nothing inferred can masquerade as measured.
   *
   * ⚠️ AND ONLY WHERE THERE WAS SOMETHING TO BEAT. The first time an
   * exercise is ever logged, every set is trivially a maximum, and
   * celebrating it would teach that the trophy is noise. Weight wins where
   * the exercise has one; reps only where it does not (a pull-up), because
   * "more reps at less weight" is not a bigger number, and time and
   * distance are left alone — the app has no opinion on which direction of
   * a mile is better (Rule 6).
   */
  function personalBests(cleaned, priorSessions, priorBenchmarks) {
    const out = [];
    for (const e of cleaned) {
      const field = e.sets.some((s) => Number(s.weight) > 0) ? 'weight'
        : e.sets.some((s) => Number(s.reps) > 0) ? 'reps' : null;
      if (!field) continue;

      let prior = 0, seen = false;
      for (const s of priorSessions) {
        for (const pe of s.entries || []) {
          if (pe.exerciseId !== e.exerciseId) continue;
          for (const set of pe.sets || []) {
            const all = [set, ...minisOf(set)];
            for (const x of all) {
              const v = Number(x[field]);
              if (v > 0) { seen = true; if (v > prior) prior = v; }
            }
          }
        }
      }
      for (const b of priorBenchmarks) {
        if (b.exerciseId !== e.exerciseId || !b.values) continue;
        const v = Number(b.values[field]);
        if (v > 0) { seen = true; if (v > prior) prior = v; }
      }
      if (!seen) continue;

      const now = Math.max(...e.sets.map((s) => Number(s[field]) || 0));
      if (now > prior) out.push({ name: e.exerciseName, field, now, was: prior });
    }
    return out;
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
      prs = personalBests(cleaned,
        priorSessions.filter((s) => !ownId || s.id !== ownId),
        priorBenchmarks.filter((b) => !ownId || b.sourceSessionId !== ownId));
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
          entries: cleaned,
        });
      }
      // Each guest's half goes to its own collection under their name —
      // never into `sessions`, never a benchmark, never published (see the
      // guest-sessions note in store.js for why the separation is structural).
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
    const prLine = (p) => p.field === 'weight'
      ? `${p.name} — ${units.withUnit(p.now)}, up from ${units.withUnit(p.was)}`
      : `${p.name} — ${p.now} reps, up from ${p.was}`;
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
      noNav: true,
      scroll: el('div', { class: 'finish-hero' },
        el('div', { class: 'finish-check' }, icon('check')),
        el('h2', { text: 'Nice work' }),
        // ⚠️ Personal bests lead, because they are the one thing on this
        // screen that is not the same every time. Recorded-vs-recorded only
        // (see personalBests) — this block may never hold an estimate.
        prs.length
          ? el('div', { class: 'finish-prs' },
              el('div', { class: 'finish-prs-head' }, icon('up', 15),
                `Personal best${prs.length === 1 ? '' : 's'}`),
              ...prs.map((p) => el('div', { class: 'finish-pr', text: prLine(p) })),
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
                el('div', { class: 'finish-ex-name', text: e.exerciseName }),
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
      /* ⚠️ TYPING A GYM SETS THE DEFAULT FOR EVERY WORKOUT AFTER THIS ONE, and
       * it happens HERE rather than at Finish — Tim's instruction is *"if the
       * user ever sets a location"*, and somebody who types their gym and then
       * abandons the session has still told the app where they train.
       *
       * ⚠️ REMOVING IT DOES NOT CLEAR THE DEFAULT. Blank is "not this one",
       * which is why the old carry-forward-from-the-last-session rule was the
       * thing being fixed: one unlabelled workout wiped the default and the
       * next three had to be typed again. Changing gyms is what changes it.
       *
       * Fire-and-forget: a settings write that fails must not cost somebody the
       * label on the session they are recording, which is already in the draft.
       */
      if (state.location) {
        store.saveSettings({ defaultLocation: state.location }).catch(() => {});
      }
      close();
    };
    const { close } = openSheet({
      title: 'Where was this?',
      body: el('div', {},
        el('p', { class: 'field-help', style: 'margin-top:0', text:
          'Whatever you type here is the whole location — the app never reads GPS. '
          + 'Friends you share full workouts with see it on your card; '
          + 'people who only see that you trained do not. '
          + 'It becomes the default for every workout after this one, until you '
          + 'type a different one. Removing it leaves this workout without a '
          + 'location and keeps the default.' }),
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
    // Off by default (Tim, 2026-08-28) — the bar simply is not on the screen.
    restEnabled ? restBar : null,
    saveError,
    footer,
  );
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
