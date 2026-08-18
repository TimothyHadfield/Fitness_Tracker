// Set types — supersets, tri-sets and drop sets.
//
// docs/vision.md §1.5. Tim, 2026-08-17. Until now a workout was a flat list of
// exercises and a set was a flat list of numbers, so several of the programmes
// in preset-systems.js shipped with their structure removed — Dr. Mike's
// Floating Split most of all, and Chris Bumstead could not ship at all.
//
// ── THE TWO SHAPES, WHICH ARE NOT THE SAME SHAPE ─────────────────────────────
//
// This is the thing to understand before changing anything here. "Supersets,
// drop sets and tri-sets" sounds like three of one kind and is two of two:
//
//   GROUPING — a superset (2 exercises) or a tri-set (3) or a giant set (4+)
//   is a property of the SPACE BETWEEN exercises: do these back to back, rest
//   after the last one. Modelled as `group` on a workout exercise; adjacent
//   exercises sharing a group id are one block.
//
//   NESTING — a drop set is a property of a SINGLE SET: take it, strip the
//   weight, keep going. Modelled as `drops: [...]` INSIDE a recorded set,
//   never as extra rows in `sets`.
//
// ⚠️ The nesting is not a stylistic choice. `progress.md` §6 locks "drop sets
// and myo-reps count as ONE hard set — else volume totals inflate". Storing
// drops inside the set makes that true BY CONSTRUCTION: every existing
// analysis path counts `sets.length`, so it keeps counting one, and nobody has
// to remember the rule. Flattening drops into `sets` would have silently
// inflated every set count, every weekly volume figure and D3 when it lands.
//
// Myo-reps are deliberately NOT here. They are the same nesting shape as a
// drop set — mini-sets after a top set, differing only in whether the weight
// comes down — so adding them later is a label and a rest hint, not a model
// change. Tim asked for three things; this builds three things.
//
// Pure: no DOM, no store. Same reason as e1rm.js and next-workout.js.

export const STRAIGHT = 'straight';
export const DROP = 'drop';

/** What to call a block of N exercises done back to back. */
export function groupLabel(size) {
  if (size >= 4) return 'Giant set';
  if (size === 3) return 'Tri-set';
  return 'Superset';
}

/** Drops on a recorded set, always an array. */
export function dropsOf(set) {
  return Array.isArray(set && set.drops) ? set.drops : [];
}

/**
 * HARD SETS — the number that volume is counted in.
 *
 * One drop set is one hard set no matter how many drops hang off it. This
 * function exists so that rule lives in exactly one place with a test on it,
 * rather than being an emergent property of how the data happens to be shaped.
 */
export function hardSetCount(sets) {
  return Array.isArray(sets) ? sets.length : 0;
}

/** Every mini-set actually performed, drops included. For display only. */
export function miniSetCount(sets) {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((n, s) => n + 1 + dropsOf(s).length, 0);
}

/** How a workout exercise describes its own set type, in words. */
export function setTypeLabel(item) {
  if (!item || item.setType !== DROP) return 'Straight sets';
  const n = Number(item.drops) > 0 ? Number(item.drops) : 1;
  return n === 1 ? 'Drop set' : `Drop set · ${n} drops`;
}

/** How many drops each set of this exercise plans for. */
export function plannedDrops(item) {
  if (!item || item.setType !== DROP) return 0;
  const n = Number(item.drops);
  return n > 0 ? Math.min(n, 4) : 1;
}

/**
 * Renumber groups so the stored shape can never lie.
 *
 * Three things it fixes, all of which happen through ordinary use:
 *   · a group with one member left (delete the other, or move it away) is not
 *     a superset any more and must become null, or the runner would announce a
 *     one-exercise superset;
 *   · the same id appearing in two non-adjacent runs — reorder can do this —
 *     which would otherwise read as one impossible block;
 *   · ids left with holes in them after a delete.
 *
 * Called on every read and every mutation. Cheap, and the alternative is a
 * shape that is only correct if every caller remembers.
 */
export function normalizeGroups(exercises) {
  const list = (exercises || []).map((e) => ({ ...e }));

  // Split into contiguous runs of the same non-null group id.
  const runs = [];
  for (let i = 0; i < list.length; i++) {
    const g = list[i].group;
    const prev = runs[runs.length - 1];
    if (g != null && prev && prev.group === g && prev.end === i - 1) prev.end = i;
    else runs.push({ group: g == null ? null : g, start: i, end: i });
  }

  let next = 0;
  for (const run of runs) {
    const size = run.end - run.start + 1;
    // A run of one is not a group, whatever its id used to say.
    const id = run.group != null && size > 1 ? next++ : null;
    for (let i = run.start; i <= run.end; i++) {
      if (id == null) delete list[i].group;
      else list[i].group = id;
    }
  }
  return list;
}

/**
 * The list split into blocks — a block is one exercise, or a run of them done
 * back to back. This is the unit the runner walks and the builder brackets.
 */
export function blocksOf(exercises) {
  const list = normalizeGroups(exercises);
  const blocks = [];
  list.forEach((item, index) => {
    const last = blocks[blocks.length - 1];
    if (item.group != null && last && last.group === item.group) last.items.push({ item, index });
    else blocks.push({ group: item.group == null ? null : item.group, items: [{ item, index }] });
  });
  return blocks;
}

/** Are exercises i and i+1 done back to back? */
export function isLinked(exercises, i) {
  const list = normalizeGroups(exercises);
  const a = list[i];
  const b = list[i + 1];
  return Boolean(a && b && a.group != null && a.group === b.group);
}

/**
 * Join or split the boundary between exercises i and i+1.
 *
 * The control the user touches is the GAP, not either row, because that is
 * what the thing actually is — "no rest between these two". Joining onto an
 * existing block extends it (superset → tri-set) rather than making a second
 * block, and splitting in the middle of a tri-set leaves two runs which
 * normalizeGroups then renumbers, dissolving whichever side is left alone.
 */
export function toggleLink(exercises, i) {
  const list = normalizeGroups(exercises);
  if (i < 0 || i + 1 >= list.length) return list;

  if (isLinked(list, i)) {
    // Break the chain here: everything from i+1 rightwards in this block gets
    // a fresh id. normalizeGroups then dissolves any side of size one.
    const g = list[i].group;
    const fresh = 1000 + i;
    for (let k = i + 1; k < list.length && list[k].group === g; k++) list[k].group = fresh;
    return normalizeGroups(list);
  }

  // Join. Prefer an id already in play on either side so a superset grows into
  // a tri-set instead of splitting into two blocks.
  const id = list[i].group != null ? list[i].group
    : list[i + 1].group != null ? list[i + 1].group
    : 1000 + i;
  list[i].group = id;
  list[i + 1].group = id;
  return normalizeGroups(list);
}

/** Rounds in a block: one round is one set of each member. */
export function roundsIn(block) {
  return block.items.reduce((n, { item }) => Math.max(n, Number(item.sets) || 0), 0);
}

/**
 * The order the session runner walks.
 *
 * A solo exercise is ONE step showing all its sets, exactly as before. A block
 * is one step per (round, member): A set 1, B set 1, rest, A set 2, B set 2 …
 * which is what a superset actually is. Doing it any other way — all of A then
 * all of B — is not a superset at all, it is two exercises in a row, and that
 * is the mistake this feature exists to stop the app from making.
 *
 * A member planned for fewer sets than the block simply drops out of the later
 * rounds rather than holding everyone up.
 */
export function stepsFor(exercises) {
  const blocks = blocksOf(exercises);
  const steps = [];

  for (const block of blocks) {
    if (block.group == null) {
      steps.push({
        entryIndex: block.items[0].index,
        group: null, groupSize: 1, groupLabel: null,
        round: null, rounds: null, memberPos: 0,
        // A solo exercise rests after every set, which is what the timer
        // already did before groups existed.
        restsAfter: true,
        members: [block.items[0].index],
      });
      continue;
    }

    const rounds = roundsIn(block);
    const members = block.items.map((it) => it.index);
    const label = groupLabel(block.items.length);

    for (let r = 0; r < rounds; r++) {
      const inRound = block.items.filter(({ item }) => (Number(item.sets) || 0) > r);
      inRound.forEach(({ index }, pos) => {
        steps.push({
          entryIndex: index,
          group: block.group,
          groupSize: block.items.length,
          groupLabel: label,
          round: r,
          rounds,
          memberPos: pos,
          // ⚠️ THE POINT OF THE WHOLE FEATURE. Rest belongs at the END of a
          // round, not between the exercises inside it — "no rest between
          // these" is what a superset means, and a timer that started on every
          // logged number would be telling you the opposite.
          restsAfter: pos === inRound.length - 1,
          members,
        });
      });
    }
  }

  return steps;
}
