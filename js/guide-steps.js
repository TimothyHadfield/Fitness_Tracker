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
// ⚠️ THE CURSOR IS NOT A NEW FIELD. A step is `{ name, entryIndex, kind, index,
// mini? }` and it is always read from, and written back to, the fields the
// runner already walks by — `forName`, `index`, `entry.active`,
// `entry.activeWarm`, `entry.activeDrop` — so the guide and the normal view can
// never disagree about where you are, Edit lands on the same set, and a reload
// resumes on it. The only thing the guide adds to the draft is `view: 'guide'`
// (a string) and a `done` flag on a warm-up row (a boolean inside its own list,
// dropped at save by `pickFields`). A drop is the runner's own `minis` row.
// Since 2026-09-27 also `skipped: true` on a row Skip left behind (a boolean,
// dropped at save; the row itself is left out — see skipStep()).
// Nothing here can put an array inside an array (handbook §0.22).
//
// THE ORDER, per block (a solo exercise, or a superset/tri-set walked round by
// round the way the runner already does):
//   • a solo exercise: its warm-ups, then its working sets — each set followed
//     by its planned drops / mini-sets, one step each (a drop set is one hard
//     set, so the drops belong to the same turn and rest waits for the last);
//   • a superset: round 1 member A, B, …; round 2 … (warm-ups are hidden in
//     supersets by the runner, so none here either);
//   • a TURN is one set (with its drops) on a solo exercise, or one person's
//     whole round of a superset (a partner does A then B with no rest while the
//     other waits);
//   • at the end of a turn, the next person in pill order (You, then guests as
//     added), wrapping, who still has an unfinished item on this block — the
//     same rule `nextPersonTurn` applies to Finished, extended to warm-ups; if
//     nobody else does, the same person carries on;
//   • when nobody has anything left on the block, the next block with anything
//     unfinished, starting with the next person in pill order (so a pair keeps
//     alternating across exercises). A person whose "Just for" list has a
//     different exercise in that place does THAT one (2026-09-27 review);
//   • nothing left ahead → any unfinished work BEHIND, anybody's (an exercise
//     skipped, or entered the guide half way down) — only then null, which the
//     screen shows as Finish.

import { stepsFor, minisOf, isNested, miniLabel, MYO } from './set-types.js';
import { hasNumbers, setIsRecorded } from './session-draft.js';

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
/** Two steps are the same place (a drop also by which drop). */
export const sameStep = (a, b) => Boolean(a && b) && a.entryIndex === b.entryIndex && a.kind === b.kind
  && a.index === b.index && (a.mini == null ? null : a.mini) === (b.mini == null ? null : b.mini);

/**
 * How many drops / mini-sets set `set` of `entry` walks as their own steps:
 * the plan's count (`entry.plannedMinis`, what the runner's "Planned: N drops"
 * line reads), or more if some were added in the normal view. 0 on a
 * straight set.
 */
export function dropCount(entry, set) {
  if (!entry || !isNested(entry.setType)) return 0;
  return Math.max(Number(entry.plannedMinis) || 0, minisOf(set).length);
}

/** [start, end) of the block holding entries[i]: one solo entry, or a run of one group. */
function blockRange(entries, i) {
  const g = entries[i] && entries[i].group;
  if (g == null) return [i, i + 1];
  let s = i, e = i + 1;
  while (s > 0 && entries[s - 1] && entries[s - 1].group === g) s--;
  while (entries[e] && entries[e].group === g) e++;
  return [s, e];
}

/** A set's own item, then one item per drop; the last of them ends the turn if `ends`. */
function setItems(entry, entryIndex, k, round, rounds, ends) {
  const drops = dropCount(entry, entry.sets[k]);
  const out = [{ entryIndex, kind: 'set', index: k, round, rounds, turnEnd: ends && drops === 0 }];
  for (let j = 0; j < drops; j++) {
    out.push({ entryIndex, kind: 'drop', index: k, mini: j, round, rounds, turnEnd: ends && j === drops - 1 });
  }
  return out;
}

/** Every item of the block holding entries[i], in the order it is done. */
export function blockItems(entries, i) {
  const [s, e] = blockRange(entries, i);
  const out = [];
  if (!entries[s]) return out;
  if (e - s === 1) {
    const entry = entries[s];
    // Warm-ups are before the work: once a working set is finished they are
    // behind you, even if a suggested ramp appeared (or grew) since.
    const started = (entry.sets || []).some(isDoneSet);
    (started ? [] : warmsOf(entry)).forEach((w, k) => out.push({ entryIndex: s, kind: 'warm', index: k, round: null, turnEnd: true }));
    (entry.sets || []).forEach((x, k) => out.push(...setItems(entry, s, k, null, null, true)));
    return out;
  }
  const rounds = Math.max(0, ...entries.slice(s, e).map((x) => (x.sets || []).length));
  for (let r = 0; r < rounds; r++) {
    const inRound = [];
    for (let m = s; m < e; m++) if ((entries[m].sets || []).length > r) inRound.push(m);
    inRound.forEach((m, pos) => out.push(...setItems(entries[m], m, r, r, rounds, pos === inRound.length - 1)));
  }
  return out;
}

/**
 * Is this item behind you? A warm-up by its own flag; a set by the runner's
 * Finished flag — and on a drop set, the top set is behind you as soon as its
 * first drop exists, and a drop as soon as the next one does (the whole set is
 * Finished with its last drop, the runner's "a drop is finished with its set").
 */
export function itemDone(entries, it) {
  const e = entries[it.entryIndex];
  if (!e) return true;
  if (it.kind === 'warm') {
    const w = warmsOf(e)[it.index] || {};
    return Boolean(w.done || w.skipped);
  }
  const set = (e.sets || [])[it.index];
  // A skipped set (and so its drops) is behind you too — see skipStep().
  if (!set || isDoneSet(set) || set.skipped) return true;
  const made = minisOf(set).length;
  if (it.kind === 'set') return dropCount(e, set) > 0 && made > 0;
  return made > it.mini + 1;
}

/** Their entry of the same exercise: the same position when it matches (a synced list), else the first of that exercise. */
function locate(entries, entryIndex, exerciseId) {
  if (entries[entryIndex] && entries[entryIndex].exerciseId === exerciseId) return entryIndex;
  return entries.findIndex((e) => e && e.exerciseId === exerciseId);
}

/** As `locate`, but a person with no entry of that exercise at all ("Just
 * for" gave them a different one) is on whatever sits in the same place. */
function theirs(entries, entryIndex, exerciseId) {
  const i = locate(entries, entryIndex, exerciseId);
  if (i >= 0) return i;
  return entries[entryIndex] ? entryIndex : -1;
}

const firstOpen = (entries, i) => blockItems(entries, i).find((it) => !itemDone(entries, it)) || null;
const asStep = (name, it) => (it.kind === 'drop'
  ? { name, entryIndex: it.entryIndex, kind: it.kind, index: it.index, mini: it.mini }
  : { name, entryIndex: it.entryIndex, kind: it.kind, index: it.index });

/**
 * Anybody's unfinished work, anywhere in their list — the next person in pill
 * order first (`from` is the position just finished), each list read from its
 * top. What is left when nothing is left AHEAD: an exercise skipped, or the
 * part of the workout before the place the guide was opened.
 */
function anyOpen(people, from) {
  const n = people.length;
  for (let k = 1; k <= n; k++) {
    const p = people[(from + k) % n];
    for (let i = 0; i < p.entries.length; i = blockRange(p.entries, i)[1]) {
      const open = firstOpen(p.entries, i);
      if (open) return asStep(p.name, open);
    }
  }
  return null;
}

const posOf = (people, name) => Math.max(0, people.findIndex((p) => p.name === nameOf(name)));

/**
 * The step after `cur`, or null when nothing is left anywhere (→ Finish workout).
 * Call it AFTER `cur` has been marked done.
 */
export function nextStep(d, cur) {
  const people = peopleInOrder(d);
  const n = people.length;
  const pos = posOf(people, cur.name);
  const mine = people[pos].entries;
  const here = mine[cur.entryIndex];
  if (!here) return anyOpen(people, pos);
  const items = blockItems(mine, cur.entryIndex);
  const at = items.findIndex((it) => sameStep(it, cur));
  const it = items[at];

  // 1. Mid-turn: the same person carries on — the next member of a superset
  //    round, or the next drop of this set.
  if (it && !it.turnEnd) {
    const more = items.slice(at + 1).find((x) => x.round === it.round && !itemDone(mine, x));
    if (more) return asStep(people[pos].name, more);
  }
  // 2. End of a turn: the next person in pill order with something left here.
  for (let k = 1; k < n; k++) {
    const p = people[(pos + k) % n];
    const i = theirs(p.entries, cur.entryIndex, here.exerciseId);
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
      const i = theirs(p.entries, j, exId);
      const open = i >= 0 ? firstOpen(p.entries, i) : null;
      if (open) return asStep(p.name, open);
    }
    j = blockRange(mine, j)[1];
  }
  // 5. Nothing ahead: anybody's unfinished work behind, or in a list longer than this one.
  return anyOpen(people, pos);
}

/**
 * The step BEFORE `cur` in guide order, or null on the very first one — what
 * Back does when the screen has no trail of its own (just entered, or after a
 * reload). Tim: *"Also there's no back button for the auto-guide like there
 * should be."* Read-only: nothing is un-finished, so the numbers on that step
 * stay as logged, and Next from there marks it done again and carries on.
 *
 * nextStep's order run backwards:
 *   1. mid-turn: the same person's item just before in this turn (the previous
 *      member this round, or the set / drop before this drop);
 *   2. the start of a turn in a joint workout: the person before in pill order
 *      whose last finished item here is from this round or the one before
 *      (someone further behind already had their turn skipped);
 *   3. this person's previous item on the block;
 *   4. the previous block: the last finished item there, person before first;
 *      if nobody finished anything there, this person's last item of it.
 * Only finished items count in 2 and 4 — Back goes where somebody has been.
 */
export function prevStep(d, cur) {
  const people = peopleInOrder(d);
  const n = people.length;
  const pos = posOf(people, cur.name);
  const me = people[pos];
  const mine = me.entries;
  const here = mine[cur.entryIndex];
  if (!here) return null;
  const items = blockItems(mine, cur.entryIndex);
  const at = items.findIndex((it) => sameStep(it, cur));
  const lastDone = (entries, i) => {
    const list = blockItems(entries, i).filter((x) => itemDone(entries, x));
    return list.length ? list[list.length - 1] : null;
  };
  // A drop is part of its set, for "was that turn just now".
  const kindOf = (x) => (x.kind === 'drop' ? 'set' : x.kind);

  // 1. Mid-turn.
  if (at > 0 && !items[at - 1].turnEnd) return asStep(me.name, items[at - 1]);
  // 2. The start of a turn: the person before, if their turn was just now.
  for (let k = 1; k < n; k++) {
    const p = people[(pos - k + n) % n];
    const i = locate(p.entries, cur.entryIndex, here.exerciseId);
    const last = i >= 0 ? lastDone(p.entries, i) : null;
    if (!last) continue;
    const recent = kindOf(last) === kindOf(cur) ? last.index >= cur.index - 1
      : last.kind === 'warm' && kindOf(cur) === 'set' && cur.index === 0;
    if (recent) return asStep(p.name, last);
  }
  // 3. This person's previous item on the block.
  if (at > 0) return asStep(me.name, items[at - 1]);
  // 4. The previous block.
  const start = blockRange(mine, cur.entryIndex)[0];
  if (start <= 0) return null;
  const j = blockRange(mine, start - 1)[0];
  const exId = mine[j].exerciseId;
  for (let k = 1; k <= n; k++) {
    const p = people[(pos - k + n) % n];
    const i = locate(p.entries, j, exId);
    const last = i >= 0 ? lastDone(p.entries, i) : null;
    if (last) return asStep(p.name, last);
  }
  const all = blockItems(mine, j);
  return all.length ? asStep(me.name, all[all.length - 1]) : null;
}

/**
 * The very last step somebody finished — where Back goes from "Nothing left to
 * do" (everything done, e.g. the guide reopened after the last set). The
 * active person first, their list read from the bottom; then everybody else.
 */
export function lastStep(d) {
  const people = peopleInOrder(d);
  const pos = posOf(people, d.forName);
  for (let k = 0; k < people.length; k++) {
    const p = people[(pos + k) % people.length];
    const starts = [];
    for (let i = 0; i < p.entries.length; i = blockRange(p.entries, i)[1]) starts.push(i);
    for (let b = starts.length - 1; b >= 0; b--) {
      const done = blockItems(p.entries, starts[b]).filter((x) => itemDone(p.entries, x));
      if (done.length) return asStep(p.name, done[done.length - 1]);
    }
  }
  return null;
}

/**
 * Where the guide opens: the active person's first unfinished item on the
 * block the runner is on (warm-ups first), else the step after it.
 */
export function startStep(d) {
  const people = peopleInOrder(d);
  const self = posOf(people, d.forName);
  const selfFirst = (self - 1 + people.length) % people.length;
  const entries = d.entries || [];
  const walk = stepsFor(entries.map((e) => ({ sets: (e.sets || []).length, group: e.group })));
  const st = walk[Math.max(0, Math.min(Number(d.index) || 0, walk.length - 1))];
  if (!st) return anyOpen(people, selfFirst);
  const name = nameOf(d.forName);
  // A warm-up the runner has open is where you are, even if it is done.
  const e = entries[st.entryIndex];
  if (e && e.group == null && e.activeWarm != null && warmsOf(e)[e.activeWarm]
    && !warmsOf(e)[e.activeWarm].done && !warmsOf(e)[e.activeWarm].skipped) {
    return { name, entryIndex: st.entryIndex, kind: 'warm', index: e.activeWarm };
  }
  const open = firstOpen(entries, st.entryIndex);
  if (open) return asStep(name, open);
  // Everything here is finished: the next thing, as if the last one was just done.
  const items = blockItems(entries, st.entryIndex);
  const last = items[items.length - 1];
  return last ? nextStep(d, asStep(name, last)) : anyOpen(people, selfFirst);
}

/** The row a step points at (a working set, one of its drops, or a warm-up), or null. */
export function targetOf(d, cur) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  if (!e) return null;
  if (cur.kind === 'warm') return warmsOf(e)[cur.index] || null;
  const set = (e.sets || [])[cur.index] || null;
  if (cur.kind === 'drop') return set ? minisOf(set)[cur.mini] || null : null;
  return set;
}

/**
 * Make sure drop `j` of set `k` exists — the runner's "Strip the weight — add
 * a drop" button: each new one starts from the numbers above it (the app
 * cannot know how much lighter, so it carries them and waits to be corrected).
 * Fields only, the runner's `pickFields`.
 */
export function ensureDrop(entry, k, j) {
  const set = entry && (entry.sets || [])[k];
  if (!set) return null;
  if (!Array.isArray(set.minis)) set.minis = minisOf(set).slice();
  const fields = entry.fields || [];
  while (set.minis.length <= j) {
    const from = set.minis.length ? set.minis[set.minis.length - 1] : set;
    const row = {};
    for (const f of fields) row[f] = typeof from[f] === 'number' ? from[f] : 0;
    set.minis.push(row);
  }
  return set.minis[j];
}

/**
 * Mark a step finished. False (and nothing changed) when the runner would not
 * let you Finish it.
 *
 * 🔄 2026-09-27 (review): A WORKING SET PASSES THE RUNNER'S OWN TEST,
 * `setIsRecorded()` — the rule its Finished button and the save both use. A
 * number the app worked out for a lift you have never done (`prefilled`, e.g.
 * 0 lbs × 10) is not a set somebody did, so Next refuses it exactly as
 * Finished is hidden on it; last time's numbers and the plan's (`fromPlan`)
 * pass untouched, as they do there. A warm-up or a drop needs a number (the
 * save's rule for those rows).
 *
 * On a drop set, the top set's Next strips the weight (makes drop 1) instead
 * of finishing it, each drop's Next makes the next one, and the LAST drop's
 * Next finishes the whole set — one hard set, one Finished.
 *
 * `force` (peekNext only) skips the number check to ask "where would it go".
 * A warm-up loses `auto`, so the suggested ramp can no longer rewrite one you
 * have already done.
 */
export function markDone(d, cur, { force = false } = {}) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  const row = targetOf(d, cur);
  if (!e || !row) return false;
  const fields = e.fields || [];
  if (cur.kind === 'warm') {
    if (!force && !hasNumbers(row, fields)) return false;
    row.done = true;
    delete row.auto;
    delete row.skipped;   // Next on a skipped step un-skips it
    return true;
  }
  const set = e.sets[cur.index];
  const finish = () => {
    set.done = true;
    delete set.locked;
    delete set.prefilled;
    return true;
  };
  const drops = dropCount(e, set);
  if (cur.kind === 'drop') {
    if (!force && !hasNumbers(row, fields)) return false;
    delete row.skipped;
    delete set.skipped;
    if (cur.mini + 1 < drops) { ensureDrop(e, cur.index, cur.mini + 1); return true; }
    return finish();
  }
  // Un-skipped before the check: `setIsRecorded` refuses a skipped set, and
  // Next on one is the user saying they did it after all.
  const wasSkipped = Boolean(set.skipped);
  delete set.skipped;
  if (!force && !setIsRecorded(set, fields)) {
    if (wasSkipped) set.skipped = true;
    return false;
  }
  if (drops > 0) { delete set.prefilled; ensureDrop(e, cur.index, 0); return true; }
  return finish();
}

/**
 * 🆕 SKIP (2026-09-27). Tim, in the question box: *"Add Swap and Skip"* —
 * *"Skip leaves the set unrecorded and moves on."*
 *
 * Marks the step `skipped` (a draft-only flag, dropped at save like `done` /
 * `touched`) and changes nothing else: no number is made real, nothing is
 * Finished, no rest starts (the screen's job). Then Next's own order carries
 * on, and `itemDone()` counts a skipped row as behind you, so the wrap-around
 * ("unfinished work anywhere") never comes back to it. Back still can, and
 * Next on it un-skips it (`markDone`).
 *
 *   • a warm-up: that row, and it loses `auto` so the suggested ramp cannot
 *     swap it for a fresh, un-skipped row;
 *   • a working set: the set — and with it any drops it would have had (one
 *     drop set is one hard set);
 *   • a drop: that drop row; the next one is made as Next would, or, on the
 *     last drop, the set is Finished with the drops before it (the runner's
 *     "a drop is finished with its set").
 *
 * WHAT "UNRECORDED" MEANS AT SAVE: `setIsRecorded()` refuses a skipped set
 * that is not Finished, and the save leaves out skipped warm-up and drop rows,
 * so last time's numbers sitting in a skipped set are not saved as work.
 */
export function skipStep(d, cur) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  const row = targetOf(d, cur);
  if (!e || !row) return false;
  if (cur.kind === 'warm') {
    row.skipped = true;
    delete row.auto;
    return true;
  }
  const set = e.sets[cur.index];
  if (cur.kind === 'drop') {
    row.skipped = true;
    if (cur.mini + 1 < dropCount(e, set)) ensureDrop(e, cur.index, cur.mini + 1);
    else { set.done = true; delete set.locked; delete set.prefilled; }
    return true;
  }
  set.skipped = true;
  return true;
}

/**
 * 🆕 THE WEIGHT CARRY (2026-09-27) — ONE rule, used by the runner's steppers
 * and the guide's. Tim, in the question box: *"Carry the change"* —
 * *"Untouched later sets take your new 225. Sets you've already typed into
 * stay as they are."*
 *
 * After a person changes set `from`'s weight, every LATER set of the same
 * exercise that nobody has touched takes it. Untouched = not typed into
 * (`touched`), not Finished, not skipped, no drops made. Reps never move
 * (his example is weight). Flags are left exactly as they were: a guessed set
 * (`prefilled`) stays a guess — `finish()` saves any set with numbers in it,
 * so a carry that made later sets "real" would record sets nobody did (the
 * reason the runner's `fillOnOpen()` fills on open, not on type).
 * Warm-ups follow set 1 by their own rule (`syncAutoWarmups`).
 * Returns how many sets moved.
 */
export function carryWeight(entry, from) {
  if (!entry || !(entry.fields || []).includes('weight')) return 0;
  const sets = entry.sets || [];
  const src = sets[from];
  if (!src || typeof src.weight !== 'number') return 0;
  let moved = 0;
  for (let j = from + 1; j < sets.length; j++) {
    const s = sets[j];
    if (!s || isDoneSet(s) || s.touched || s.skipped || minisOf(s).length) continue;
    if (s.weight !== src.weight) { s.weight = src.weight; moved++; }
  }
  return moved;
}

/**
 * The runner's footer words inside a superset — ONE copy, used by the runner's
 * `renderFooter()` and by the guide's button. `step`/`next` are walk steps
 * (`group`, `round`, `rounds`, `entryIndex`); null when they are not two steps
 * of one group, and the caller says what it says anywhere else.
 */
export function groupNextLabel(step, next, nameAt) {
  if (!step || !next || step.group == null || next.group !== step.group) return null;
  if (next.round === step.round) return 'Straight into ' + nameAt(next.entryIndex);
  return `Round ${next.round + 1} of ${next.rounds}`;
}

/** The step's words: `set` ("Set 2 of 4", "Warm-up 1 of 3", "Round 1 of 3", "Drop 1 of 2") and `who` (null when solo). */
export function stepWords(d, cur) {
  const p = peopleInOrder(d).find((x) => x.name === nameOf(cur.name));
  const e = p && p.entries[cur.entryIndex];
  if (!e) return { set: '', who: null, exerciseName: '' };
  const joint = ((d.guestNames || []).length) > 0;
  let set;
  if (cur.kind === 'warm') set = `Warm-up ${cur.index + 1} of ${warmsOf(e).length}`;
  else if (cur.kind === 'drop') set = `${miniLabel(e.setType, cur.mini + 1)} of ${dropCount(e, e.sets[cur.index])}`;
  else if (e.group != null) {
    const it = blockItems(p.entries, cur.entryIndex).find((x) => x.entryIndex === cur.entryIndex);
    set = `Round ${cur.index + 1} of ${it ? it.rounds : (e.sets || []).length}`;
  } else set = `Set ${cur.index + 1} of ${(e.sets || []).length}`;
  return {
    set,
    who: joint ? (cur.name == null ? 'You' : cur.name) : null,
    exerciseName: e.exerciseName || '',
  };
}

/**
 * The bottom button's words for going from `cur` to `next` (null = the end).
 * A different exercise outranks a different person: the next screen names them.
 * Inside one person's turn the runner's own words: "Strip the weight" before a
 * drop (its add-a-drop button), "Straight into …" / "Round 2 of 3" in a superset.
 */
export function nextLabel(d, cur, next) {
  if (!next) return 'Finish workout';
  const people = peopleInOrder(d);
  const listOf = (s) => (people.find((x) => x.name === nameOf(s.name)) || { entries: [] }).entries;
  const a = listOf(cur)[cur.entryIndex] || {};
  const b = listOf(next)[next.entryIndex] || {};
  const samePerson = nameOf(next.name) === nameOf(cur.name);
  if (samePerson && next.kind === 'drop' && next.entryIndex === cur.entryIndex && next.index === cur.index) {
    const myo = b.setType === MYO;
    if (next.mini === 0) return myo ? 'Rest 10–15 seconds' : 'Strip the weight';
    return myo ? 'Another mini-set' : 'Drop again';
  }
  // The same block: the same exercise, or two members of one superset.
  const sameBlock = a.exerciseId === b.exerciseId || (a.group != null && a.group === b.group);
  const who = next.name == null ? 'You' : next.name;
  // 🔄 2026-09-27, Tim: *"Name the exercise"* — *"You know where to walk. In a
  // group workout the person's name still comes first when it's their turn."*
  // So "Next: Leg Press", and "Next: Rae · Leg Press" on somebody else's turn.
  // (The button ellipsises a long name on one line.)
  const exName = b.exerciseName || 'next exercise';
  if (!sameBlock) return samePerson ? `Next: ${exName}` : `Next: ${who} · ${exName}`;
  if (!samePerson) return `Next: ${who}`;
  if (a.group != null && a.group === b.group && next.kind !== 'drop') {
    const it = blockItems(listOf(next), next.entryIndex).find((x) => x.entryIndex === next.entryIndex);
    const label = groupNextLabel(
      { group: a.group, round: cur.index },
      { group: b.group, round: next.index, rounds: it ? it.rounds : 0, entryIndex: next.entryIndex },
      (i) => (listOf(next)[i] || {}).exerciseName || '');
    if (label) return label;
  }
  if (a.exerciseId !== b.exerciseId) return `Next: ${exName}`;
  return next.kind === 'warm' ? 'Next warm-up' : 'Next set';
}

/**
 * What the button would do, without doing it: marks `cur` done on a COPY and
 * asks for the step after. The copy is JSON — the draft is JSON on disk anyway.
 */
export function peekNext(d, cur) {
  const copy = JSON.parse(JSON.stringify(d));
  markDone(copy, cur, { force: true });
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
