// Auto-guide: which single step comes next (2026-09-27). Pure — no DOM, no
// store, no clock — so every rule below is pinned by tests/guide-mode.test.mjs.
//
// Tim: *"make a "auto-guide" button you could press which would just show you
// the single set you should be on … and then just a single button at the
// bottom that says "next ____ (either set or exercise)" and then it will take
// you to your next step. If you are in a group workout, it will automatically
// do the next set on the next person, like I described. It will also take you
// through warmup sets."*
//
// ⚠️ THE CURSOR IS NOT A NEW FIELD. A step is `{ name, entryIndex, kind, index }`
// and it is always read from, and written back to, the fields the runner
// already walks by — `forName`, `index`, `entry.active`, `entry.activeWarm` —
// so the guide and the normal view can never disagree about where you are,
// Edit lands on the same set, and a reload resumes on it. The only thing the
// guide adds to the draft is `view: 'guide'` (a string) and a `done` flag on a
// warm-up row (a boolean inside its own list, dropped at save by `pickFields`).
// Nothing here can put an array inside an array (handbook §0.22).
//
// THE ORDER, per block (a solo exercise, or a superset/tri-set walked round by
// round the way the runner already does):
//   • a solo exercise: its warm-ups, then its working sets;
//   • a superset: round 1 member A, B, …; round 2 … (warm-ups are hidden in
//     supersets by the runner, so none here either);
//   • a TURN is one item on a solo exercise, or one person's whole round of a
//     superset (a partner does A then B with no rest while the other waits);
//   • at the end of a turn, the next person in pill order (You, then guests as
//     added), wrapping, who still has an unfinished item on this block — the
//     same rule `nextPersonTurn` applies to Finished, extended to warm-ups; if
//     nobody else does, the same person carries on;
//   • when nobody has anything left on the block, the next block with anything
//     unfinished, starting with the next person in pill order (so a pair keeps
//     alternating across exercises);
//   • nothing left anywhere ahead → null, which the screen shows as Finish.

import { stepsFor } from './set-types.js';
import { hasNumbers } from './session-draft.js';

const nameOf = (n) => (n == null ? null : n);

/** Everybody in the workout in PILL ORDER, each `{ name, entries }`. */
export function peopleInOrder(d) {
  const names = [null, ...((d && d.guestNames) || [])];
  return names.map((n) => {
    if (n === nameOf(d.forName)) return { name: n, entries: d.entries || [] };
    const parked = (d.others || []).find((o) => nameOf(o.name) === n);
    return { name: n, entries: (parked && parked.entries) || [] };
  });
}

const isDoneSet = (s) => Boolean(s && (s.done || s.locked));
const warmsOf = (e) => (e && e.group == null && Array.isArray(e.warmups) ? e.warmups : []);

/** [start, end) of the block holding entries[i]: one solo entry, or a run of one group. */
function blockRange(entries, i) {
  const g = entries[i] && entries[i].group;
  if (g == null) return [i, i + 1];
  let s = i, e = i + 1;
  while (s > 0 && entries[s - 1] && entries[s - 1].group === g) s--;
  while (entries[e] && entries[e].group === g) e++;
  return [s, e];
}

/** Every item of the block holding entries[i], in the order it is done. */
export function blockItems(entries, i) {
  const [s, e] = blockRange(entries, i);
  const out = [];
  if (e - s === 1) {
    const entry = entries[s];
    // Warm-ups are before the work: once a working set is finished they are
    // behind you, even if a suggested ramp appeared (or grew) since.
    const started = (entry.sets || []).some(isDoneSet);
    (started ? [] : warmsOf(entry)).forEach((w, k) => out.push({ entryIndex: s, kind: 'warm', index: k, round: null, turnEnd: true }));
    (entry.sets || []).forEach((x, k) => out.push({ entryIndex: s, kind: 'set', index: k, round: null, turnEnd: true }));
    return out;
  }
  const rounds = Math.max(0, ...entries.slice(s, e).map((x) => (x.sets || []).length));
  for (let r = 0; r < rounds; r++) {
    const inRound = [];
    for (let m = s; m < e; m++) if ((entries[m].sets || []).length > r) inRound.push(m);
    inRound.forEach((m, pos) => out.push({
      entryIndex: m, kind: 'set', index: r, round: r, turnEnd: pos === inRound.length - 1,
    }));
  }
  return out;
}

export function itemDone(entries, it) {
  const e = entries[it.entryIndex];
  if (!e) return true;
  return it.kind === 'warm' ? Boolean((warmsOf(e)[it.index] || {}).done) : isDoneSet((e.sets || [])[it.index]);
}

/** Their entry of the same exercise: the same position when it matches (a synced list), else the first of that exercise. */
function locate(entries, entryIndex, exerciseId) {
  if (entries[entryIndex] && entries[entryIndex].exerciseId === exerciseId) return entryIndex;
  return entries.findIndex((e) => e && e.exerciseId === exerciseId);
}

const firstOpen = (entries, i) => blockItems(entries, i).find((it) => !itemDone(entries, it)) || null;
const asStep = (name, it) => ({ name, entryIndex: it.entryIndex, kind: it.kind, index: it.index });

/**
 * The step after `cur`, or null when nothing is left ahead (→ Finish workout).
 * Call it AFTER `cur` has been marked done.
 */
export function nextStep(d, cur) {
  const people = peopleInOrder(d);
  const n = people.length;
  const pos = Math.max(0, people.findIndex((p) => p.name === nameOf(cur.name)));
  const mine = people[pos].entries;
  const here = mine[cur.entryIndex];
  if (!here) return null;
  const items = blockItems(mine, cur.entryIndex);
  const at = items.findIndex((it) => it.entryIndex === cur.entryIndex && it.kind === cur.kind && it.index === cur.index);
  const it = items[at];

  // 1. Mid-round in a superset: the same person, straight into the next member.
  if (it && !it.turnEnd) {
    const more = items.slice(at + 1).find((x) => x.round === it.round && !itemDone(mine, x));
    if (more) return asStep(people[pos].name, more);
  }
  // 2. End of a turn: the next person in pill order with something left here.
  for (let k = 1; k < n; k++) {
    const p = people[(pos + k) % n];
    const i = locate(p.entries, cur.entryIndex, here.exerciseId);
    const open = i >= 0 ? firstOpen(p.entries, i) : null;
    if (open) return asStep(p.name, open);
  }
  // 3. Nobody else: this person's next unfinished item on the block.
  const own = firstOpen(mine, cur.entryIndex);
  if (own) return asStep(people[pos].name, own);
  // 4. The next block with anything unfinished, next person in pill order first.
  let j = blockRange(mine, cur.entryIndex)[1];
  while (j < mine.length) {
    const exId = mine[j].exerciseId;
    for (let k = 1; k <= n; k++) {
      const p = people[(pos + k) % n];
      const i = locate(p.entries, j, exId);
      const open = i >= 0 ? firstOpen(p.entries, i) : null;
      if (open) return asStep(p.name, open);
    }
    j = blockRange(mine, j)[1];
  }
  return null;
}

/**
 * Where the guide opens: the active person's first unfinished item on the
 * block the runner is on (warm-ups first), else the step after it.
 */
export function startStep(d) {
  const entries = d.entries || [];
  if (!entries.length) return null;
  const walk = stepsFor(entries.map((e) => ({ sets: (e.sets || []).length, group: e.group })));
  const st = walk[Math.max(0, Math.min(Number(d.index) || 0, walk.length - 1))];
  if (!st) return null;
  const name = nameOf(d.forName);
  // A warm-up the runner has open is where you are, even if it is done.
  const e = entries[st.entryIndex];
  if (e && e.group == null && e.activeWarm != null && warmsOf(e)[e.activeWarm] && !warmsOf(e)[e.activeWarm].done) {
    return { name, entryIndex: st.entryIndex, kind: 'warm', index: e.activeWarm };
  }
  const open = firstOpen(entries, st.entryIndex);
  if (open) return asStep(name, open);
  // Everything here is finished: the next thing, as if the last one was just done.
  const items = blockItems(entries, st.entryIndex);
  const last = items[items.length - 1];
  return last ? nextStep(d, asStep(name, last)) : null;
}

/** The row a step points at (a working set or a warm-up), or null. */
export function targetOf(d, cur) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  if (!e) return null;
  return cur.kind === 'warm' ? warmsOf(e)[cur.index] || null : (e.sets || [])[cur.index] || null;
}

/**
 * Mark a step finished. False (and nothing changed) when it holds no number —
 * a blank set is not a set somebody did.
 *
 * ⚠️ A SET LOSES `prefilled` HERE: pressing Next under a number is the lifter
 * saying they did it, the same as touching it. A warm-up loses `auto`, so the
 * suggested ramp can no longer rewrite one you have already done.
 */
export function markDone(d, cur) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  const row = targetOf(d, cur);
  if (!e || !row) return false;
  const fields = e.fields || [];
  const minis = Array.isArray(row.minis) ? row.minis : [];
  if (!hasNumbers(row, fields) && !minis.some((m) => hasNumbers(m, fields))) return false;
  if (cur.kind === 'warm') {
    row.done = true;
    delete row.auto;
  } else {
    row.done = true;
    delete row.locked;
    delete row.prefilled;
  }
  return true;
}

/** The step's words: `set` ("Set 2 of 4", "Warm-up 1 of 3") and `who` (null when solo). */
export function stepWords(d, cur) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  if (!e) return { set: '', who: null, exerciseName: '' };
  const total = cur.kind === 'warm' ? warmsOf(e).length : (e.sets || []).length;
  const joint = ((d.guestNames || []).length) > 0;
  return {
    set: `${cur.kind === 'warm' ? 'Warm-up' : 'Set'} ${cur.index + 1} of ${total}`,
    who: joint ? (cur.name == null ? 'You' : cur.name) : null,
    exerciseName: e.exerciseName || '',
  };
}

/**
 * The bottom button's words for going from `cur` to `next` (null = the end).
 * A different exercise outranks a different person: the next screen names them.
 */
export function nextLabel(d, cur, next) {
  if (!next) return 'Finish workout';
  const people = peopleInOrder(d);
  const entryOf = (s) => {
    const p = people.find((x) => x.name === nameOf(s.name));
    return (p && p.entries[s.entryIndex]) || {};
  };
  const a = entryOf(cur), b = entryOf(next);
  // The same block: the same exercise, or two members of one superset.
  const sameBlock = a.exerciseId === b.exerciseId || (a.group != null && a.group === b.group);
  if (!sameBlock) return 'Next exercise';
  if (nameOf(next.name) !== nameOf(cur.name)) return `Next: ${next.name == null ? 'You' : next.name}`;
  if (a.exerciseId !== b.exerciseId) return 'Next exercise';
  return next.kind === 'warm' ? 'Next warm-up' : 'Next set';
}

/**
 * What the button would do, without doing it: marks `cur` done on a COPY and
 * asks for the step after. The copy is JSON — the draft is JSON on disk anyway.
 */
export function peekNext(d, cur) {
  const copy = JSON.parse(JSON.stringify(d));
  const row = targetOf(copy, cur);
  if (row) row.done = true;
  return nextStep(copy, cur);
}

/** The runner's walk index for a step on the ACTIVE person's list. */
export function walkIndexFor(entries, cur) {
  const walk = stepsFor(entries.map((e) => ({ sets: (e.sets || []).length, group: e.group })));
  let at = walk.findIndex((st) => st.entryIndex === cur.entryIndex
    && (st.round == null || cur.kind === 'warm' || st.round === cur.index));
  if (at < 0) at = walk.findIndex((st) => st.entryIndex === cur.entryIndex);
  return at;
}
