/* ------------------------------------------------------------------ *
 * WHEN A READY-MADE PROGRAMME CHANGES AFTER YOU COPIED IT — 2026-09-20.
 *
 * Tim, 2026-09-19: > "could we change it so the system they have (If it's a
 * pre-built system connected to the cite) is not a copy and is able to be
 * changed if the origonal version is changed in any way?"
 *
 * 🛑 A LIVE LINK WAS ASSESSED AND REFUSED (docs/history.md 2026-09-19 §B), for
 * three reasons that have not moved:
 *
 *   1. You could not EDIT a linked programme, and people edit ready-made ones.
 *      "Once you add it, it is yours" is most of the value.
 *   2. Recorded sessions reference a `workoutId`. A deploy that renamed or
 *      dropped a preset workout would strand history already logged — D22's own
 *      principle: the past does not become untrue because the plan behind it
 *      was thrown away.
 *   3. 🚨 It would rewrite a prescribed WEIGHT under you with no notification.
 *      Presets carry `targets` now, deploys are invisible, and there is no
 *      server to announce one.
 *
 * So the copy stays a copy, and this module is the other answer: **tell them
 * what changed, and never change anything they have touched.** Pure — no DOM,
 * no store, no clock. It decides; `store.applyPresetUpdate()` writes.
 *
 * ------------------------------------------------------------------
 * 🚨 THE WHOLE THING RESTS ON TWO STAMPS, AND THEY ARE WHY THIS COULD NOT BE
 * BUILT ON 2026-09-19.
 *
 *   `system.presetVersion` — the preset's version at the moment it was copied.
 *   `workout.presetKey`    — which workout of the original this one is, by a
 *                            key rather than a NAME, so a rename in the preset
 *                            does not orphan somebody's copy.
 *   `exercise.origin`      — { sets, targets, notes } exactly as shipped.
 *
 * ⚠️ `origin` is the load-bearing one and it is worth saying why a second copy
 * of three fields earns its bytes. Without it, "your copy says 3 sets and the
 * original now says 4" has two explanations that look identical: the original
 * changed, or you changed it. Storing what it ARRIVED as makes those two
 * distinguishable, and distinguishing them is the entire difference between a
 * notice you can trust and one that overwrites your work.
 *
 * ------------------------------------------------------------------
 * 🛑 THREE REFUSALS, ALL OF THEM DELIBERATE
 *
 *   NOTHING IS EVER DELETED. A preset that drops an exercise reports it and
 *   stops. Removing work somebody may have been doing for weeks is worse than
 *   leaving something stale, and there is no undo in this app.
 *
 *   NOTHING EDITED IS EVER OVERWRITTEN. An exercise whose current values no
 *   longer match its `origin` is reported as yours and left exactly alone.
 *
 *   A NEW EXERCISE IS APPENDED, NEVER INSERTED. The original's position is not
 *   available in a list the user may have reordered, and entry order is scored
 *   — within-session fatigue reads it (0g). Appending is the only placement
 *   that cannot silently change what an existing set means.
 *
 * ------------------------------------------------------------------
 * ⚠️ AN UNSTAMPED COPY IS A DIFFERENT, WEAKER CASE — and every copy made before
 * 2026-09-20 is one, including Tim's own. There is no `presetVersion` and no
 * `origin`, so "the original says 85 % and yours says nothing" cannot be told
 * apart from an edit. Those copies get a comparison against the CURRENT preset,
 * every row marked `manual`, and nothing is ever applied automatically. The
 * screen has to say that the differences may be their own — see `status`.
 * ------------------------------------------------------------------ */

import { expandRepSpec, summariseReps, normalizeRepSpec, repSpecToStored } from './set-reps.js';

/* A rep list, cloned into the STORED shape — `{lo, hi}` per set.
 *
 * ⚠️ THIS REPLACED `list.map((p) => p.slice())` IN THREE PLACES, 2026-09-27.
 * That clone assumed every entry was an array and threw outright once entries
 * became maps. Going through `repSpecToStored` clones and canonicalises in one
 * step, so a row copied from a preset, a row read off disk from before the
 * change, and a row the update sheet just wrote all end up identical — which is
 * what stops the next read reporting a change nobody made. */
function cloneReps(list) {
  if (!Array.isArray(list)) return null;
  const out = list.map(repSpecToStored);
  return out.every(Boolean) ? out : null;
}

/** A preset with no `version` is version 1. Nine of them shipped without one. */
export function presetVersionOf(preset) {
  const v = Number(preset && preset.version);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
}

/**
 * The version a copy was taken at, or null for a copy made before stamping.
 *
 * ⚠️ null is NOT zero, and the difference decides everything below: zero would
 * mean "copied from a very old version", which we could reason about; null
 * means "we do not know what it looked like", which we cannot.
 */
export function copiedVersionOf(system) {
  const v = Number(system && system.presetVersion);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : null;
}

/** The author's own words about what changed, newest versions only. */
export function changeNotes(preset, fromVersion) {
  const list = Array.isArray(preset && preset.changes) ? preset.changes : [];
  const from = Number(fromVersion);
  return list
    .filter((c) => c && Number.isFinite(Number(c.version))
      && (!Number.isFinite(from) || Number(c.version) > from))
    .sort((a, b) => Number(a.version) - Number(b.version));
}

function sameTargets(a, b) {
  const x = Array.isArray(a) ? a : null;
  const y = Array.isArray(b) ? b : null;
  if (!x && !y) return true;
  if (!x || !y || x.length !== y.length) return false;
  return x.every((v, i) => Number(v) === Number(y[i]));
}

/* Rep prescriptions are one prescription per set, so this is `sameTargets` one
 * level deeper. Compared by value rather than by JSON, because the two sides
 * arrive from different places — one from disk, one from the module — and
 * `shardDiff()`'s lesson is that a stringify comparison answers a question
 * about serialisation rather than about content (§4).
 *
 * 🚨 IT COMPARES THROUGH `normalizeRepSpec` SINCE 2026-09-27, and that is not
 * tidying. The stored shape became `{lo, hi}` that day (Firestore refuses an
 * array of arrays — js/set-reps.js), so the two sides genuinely can arrive in
 * different shapes: a row written today is a map, a row written last week is a
 * pair, and a preset authors `reps: 8`. The previous version returned false the
 * moment either side was not an Array, which would have reported EVERY
 * exercise of every copy as edited — and the failure is silent and in the worst
 * direction: `isUntouched()` would answer no, so a real update would be refused
 * as "you changed this" rather than offered. Value equality is the only
 * comparison that survives a change of storage shape. */
function sameReps(a, b) {
  const x = Array.isArray(a) ? a : null;
  const y = Array.isArray(b) ? b : null;
  if (!x && !y) return true;
  if (!x || !y || x.length !== y.length) return false;
  return x.every((spec, i) => {
    const mine = normalizeRepSpec(spec);
    const other = normalizeRepSpec(y[i]);
    if (!mine || !other) return false;
    return mine[0] === other[0] && mine[1] === other[1];
  });
}

function sameText(a, b) {
  return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
}

/**
 * Is this copied exercise still exactly what it arrived as?
 *
 * ⚠️ NO STAMP MEANS NO, and that is the safe direction: an exercise we cannot
 * vouch for is treated as edited, so it is reported and never written to.
 */
function isUntouched(mine, origin) {
  if (!origin) return false;
  return Number(mine.sets) === Number(origin.sets)
    && sameTargets(mine.targets, origin.targets)
    && sameReps(mine.reps, origin.reps)
    && sameText(mine.notes, origin.notes);
}

/* What the preset says an exercise should be, resolved into this account's
 * exercise ids. Names are how presets reference exercises (ids are derived from
 * name+muscle, so hard-coding them there would rot silently) — which means a
 * name the library no longer has resolves to nothing and is skipped, exactly as
 * `addPresetSystem()` skips it on the way in. */
function resolvePresetExercises(pw, byName) {
  const out = [];
  for (const item of (pw.exercises || [])) {
    const ex = byName.get(item.name);
    if (!ex) continue;
    const sets = Number(item.sets) > 0 ? Math.floor(Number(item.sets)) : null;
    out.push({
      exerciseId: ex.id,
      name: item.name,
      sets,
      targets: Array.isArray(item.targets) ? item.targets.slice() : null,
      // Expanded to one entry per set HERE, so the comparison is against the
      // shape that was stored rather than against the shape the author wrote —
      // `reps: 8` on a 3-set exercise is stored as three entries, and comparing
      // the two forms would report a change on every read.
      reps: expandRepSpec(item.reps, sets) || null,
      notes: item.notes || '',
    });
  }
  return out;
}

/* Pair a copied workout's exercises with the preset's, by exercise id and then
 * by how many times that id has already been seen. Two sets of Barbell Curl in
 * one workout are two different rows with the same id, and pairing the first
 * with the first is the only answer that does not shuffle them. */
function pairByOccurrence(mineList, theirsList) {
  const seen = new Map();
  const index = new Map();
  mineList.forEach((e, i) => {
    const n = seen.get(e.exerciseId) || 0;
    seen.set(e.exerciseId, n + 1);
    index.set(e.exerciseId + '#' + n, i);
  });
  const used = new Map();
  const pairs = [];
  for (const theirs of theirsList) {
    const n = used.get(theirs.exerciseId) || 0;
    used.set(theirs.exerciseId, n + 1);
    const at = index.get(theirs.exerciseId + '#' + n);
    pairs.push({ theirs, at: at == null ? null : at, mine: at == null ? null : mineList[at] });
  }
  return pairs;
}

/**
 * What has changed in the original since this copy was taken.
 *
 * @param {object}  preset   the ready-made system as it ships TODAY
 * @param {object}  system   the user's copied system row
 * @param {object[]} workouts the user's workouts for that system
 * @param {Map}     byName   exercise name → exercise, from the account's library
 * @returns {null|{
 *   fromVersion: number|null, toVersion: number, stamped: boolean,
 *   notes: object[], changes: object[], readyCount: number
 * }}
 *   null when there is nothing to say — which is the answer for every copy of
 *   an unchanged preset, so this runs on the system screen and costs nothing.
 *
 * ⚠️ A `status` of 'ready' is the ONLY one `applyPresetPlan()` will act on.
 * 'edited' is yours, 'manual' is ours to describe and never to do.
 */
export function presetUpdatePlan({ preset, system, workouts, byName }) {
  if (!preset || !system || !system.presetId || system.presetId !== preset.id) return null;
  const names = byName || new Map();
  const mine = (workouts || []).filter((w) => w.systemId === system.id);
  const toVersion = presetVersionOf(preset);
  const fromVersion = copiedVersionOf(system);
  const stamped = fromVersion != null;

  /* 🛑 A STAMPED COPY AT THE CURRENT VERSION IS DONE, WITHOUT LOOKING AT A
   * SINGLE EXERCISE. The version is the whole point of the version: it is the
   * one cheap question that can answer "nothing to do" for the overwhelming
   * majority of copies, on a screen that opens every time somebody taps
   * Workouts. Comparing content first and using the version as a tiebreak would
   * be the same answer at many times the cost. */
  if (stamped && fromVersion >= toVersion) return null;

  const changes = [];
  const byKey = new Map();
  for (const w of mine) if (w.presetKey) byKey.set(w.presetKey, w);

  for (const pw of (preset.workouts || [])) {
    /* ⚠️ MATCHED BY KEY, AND FALLING BACK TO NAME ONLY FOR AN UNSTAMPED COPY.
     * A stamped copy has a key on every workout, so a key that matches nothing
     * means the preset gained a workout. An unstamped copy has no keys at all,
     * and its name is the only handle there has ever been. */
    const mineW = byKey.get(pw.key)
      || (stamped ? null : mine.find((w) => sameText(w.name, pw.name)));
    const theirs = resolvePresetExercises(pw, names);

    if (!mineW) {
      /* ⚠️ A WORKOUT MISSING FROM AN UNSTAMPED COPY IS NOT NEWS — they may have
       * deleted it, and we cannot tell. Only a stamped copy can claim the
       * original grew. */
      if (!stamped) continue;
      changes.push({
        kind: 'workout-added',
        key: pw.key,
        workoutId: null,
        workoutName: pw.name,
        status: 'ready',
        exercises: theirs,
        notes: pw.notes || '',
      });
      continue;
    }

    const mineEx = Array.isArray(mineW.exercises) ? mineW.exercises : [];
    const pairs = pairByOccurrence(mineEx, theirs);

    for (const { theirs: t, mine: m, at } of pairs) {
      if (!m) {
        changes.push({
          kind: 'exercise-added',
          key: pw.key,
          workoutId: mineW.id,
          workoutName: mineW.name,
          exerciseId: t.exerciseId,
          exerciseName: t.name,
          now: t,
          // An unstamped copy cannot claim the original grew an exercise —
          // it is just as likely the user removed one.
          status: stamped ? 'ready' : 'manual',
        });
        continue;
      }
      const origin = stamped ? m.origin : null;
      const untouched = isUntouched(m, origin);
      const add = (kind, was, now) => changes.push({
        kind,
        key: pw.key,
        workoutId: mineW.id,
        workoutName: mineW.name,
        exerciseId: t.exerciseId,
        exerciseName: t.name,
        at,
        was,
        now,
        status: !stamped ? 'manual' : (untouched ? 'ready' : 'edited'),
      });

      // The prescription first: it is the one that puts a weight on a bar.
      if (t.targets !== null || (origin && origin.targets)) {
        const theirsNow = t.targets;
        const base = stamped && origin ? origin.targets : (m.targets || null);
        if (!sameTargets(theirsNow, base)) add('prescription', m.targets || null, theirsNow);
      }
      // The rep prescription next: it is what the author actually wrote, and
      // for a programme like Nippard's it is nearly the whole of the plan.
      if (t.reps !== null || (origin && origin.reps)) {
        const base = stamped && origin ? origin.reps : (m.reps || null);
        if (!sameReps(t.reps, base)) add('reps', m.reps || null, t.reps);
      }
      if (t.sets != null) {
        const base = stamped && origin ? Number(origin.sets) : Number(m.sets);
        if (Number(t.sets) !== base) add('sets', Number(m.sets), Number(t.sets));
      }
      const baseNotes = stamped && origin ? origin.notes : m.notes;
      if (!sameText(t.notes, baseNotes)) add('notes', m.notes || '', t.notes);
    }

    /* An exercise the original no longer has. Reported, never acted on — see
     * the header's first refusal. */
    if (stamped) {
      const wanted = new Map();
      for (const t of theirs) wanted.set(t.exerciseId, (wanted.get(t.exerciseId) || 0) + 1);
      const held = new Map();
      mineEx.forEach((e) => {
        const n = (held.get(e.exerciseId) || 0) + 1;
        held.set(e.exerciseId, n);
        // Only a row that ARRIVED with the copy can have been dropped from it;
        // one the user added themselves was never the original's to remove.
        if (e.origin && n > (wanted.get(e.exerciseId) || 0)) {
          changes.push({
            kind: 'exercise-removed',
            key: pw.key,
            workoutId: mineW.id,
            workoutName: mineW.name,
            exerciseId: e.exerciseId,
            status: 'manual',
          });
        }
      });
    }
  }

  if (!changes.length) return null;
  return {
    fromVersion,
    toVersion,
    stamped,
    notes: changeNotes(preset, fromVersion),
    changes,
    readyCount: changes.filter((c) => c.status === 'ready').length,
  };
}

/**
 * Turn the 'ready' rows of a plan into the writes that would satisfy them.
 *
 * Returns `{ workouts, creates }` — workout rows to save as they now should be,
 * and whole new workouts to create. 🛑 Nothing here deletes, and nothing here
 * touches a row whose status is not 'ready'.
 *
 * ⚠️ `origin` IS RESTAMPED ON EVERY ROW IT WRITES. Applying an update makes the
 * copy match the original again, and a stamp still describing the old version
 * would report the same change forever.
 */
export function applyPresetPlan({ plan, preset, workouts, byName }) {
  if (!plan || !plan.changes.length) return { workouts: [], creates: [] };
  const names = byName || new Map();
  const edits = new Map();
  const creates = [];

  const rowFor = (id) => {
    if (!edits.has(id)) {
      const w = (workouts || []).find((x) => x.id === id);
      if (!w) return null;
      edits.set(id, { ...w, exercises: (w.exercises || []).map((e) => ({ ...e })) });
    }
    return edits.get(id);
  };

  for (const c of plan.changes) {
    if (c.status !== 'ready') continue;

    if (c.kind === 'workout-added') {
      creates.push({
        name: c.workoutName,
        presetKey: c.key,
        exercises: c.exercises.map((t) => stampedExercise(t)),
      });
      continue;
    }

    const row = rowFor(c.workoutId);
    if (!row) continue;

    if (c.kind === 'exercise-added') {
      // Appended, never inserted — see the header's third refusal.
      row.exercises.push(stampedExercise(c.now));
      continue;
    }

    const ex = row.exercises[c.at];
    if (!ex) continue;
    if (c.kind === 'prescription') {
      if (c.now) ex.targets = c.now.slice();
      else delete ex.targets;
    } else if (c.kind === 'reps') {
      if (c.now) ex.reps = cloneReps(c.now);
      else delete ex.reps;
    } else if (c.kind === 'sets') {
      ex.sets = c.now;
    } else if (c.kind === 'notes') {
      ex.notes = c.now;
    }
    ex.origin = {
      sets: Number(ex.sets),
      notes: ex.notes || '',
      ...(ex.targets ? { targets: ex.targets.slice() } : {}),
      ...(ex.reps ? { reps: cloneReps(ex.reps) } : {}),
    };
  }

  // Resolving a name the library lacks is the caller's problem on creation, and
  // `resolvePresetExercises` has already dropped any that do not exist.
  void names;
  return { workouts: [...edits.values()], creates };
}

/** One copied exercise, carrying the record of what it arrived as. */
export function stampedExercise(t) {
  const body = {
    sets: t.sets == null ? undefined : t.sets,
    notes: t.notes || '',
    ...(t.targets ? { targets: t.targets.slice() } : {}),
    ...(t.reps ? { reps: cloneReps(t.reps) } : {}),
  };
  // The row and its record of itself are built from ONE object, so they cannot
  // drift — the first version listed the fields twice and gaining `reps` meant
  // remembering to add it in both halves.
  return { exerciseId: t.exerciseId, ...body, origin: { ...body } };
}

/** How the notice reads. Kept here so the screen and the tests agree. */
export function describeChange(c) {
  const where = c.workoutName ? ` in ${c.workoutName}` : '';
  switch (c.kind) {
    case 'workout-added':
      return `${c.workoutName} is a new workout in the original`;
    case 'exercise-added':
      return `${c.exerciseName} was added${where}`;
    case 'exercise-removed':
      return `the original no longer has this exercise${where}`;
    case 'prescription':
      return c.now
        ? `${c.exerciseName}${where} now prescribes ${c.now.join(' / ')} % of your max`
        : `${c.exerciseName}${where} no longer prescribes a percentage`;
    case 'reps':
      return c.now
        ? `${c.exerciseName}${where} now asks for ${summariseReps(c.now)}`
        : `${c.exerciseName}${where} no longer names a rep target`;
    case 'sets':
      return `${c.exerciseName}${where} is ${c.now} sets in the original, not ${c.was}`;
    case 'notes':
      return `the note on ${c.exerciseName}${where} changed`;
    default:
      return `${c.exerciseName || c.workoutName} changed`;
  }
}
