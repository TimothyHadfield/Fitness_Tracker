// A system's optional weekly plan — added 2026-09-16 on Tim's ask.
//
// Tim: *"I want to add an optional weekly scheduling to every workout system if
// the user wants to make it… the user might use the days of the cycle system and
// say 'day 1: push, day 2: pull, day 3: legs, day 4: rest, repeat.' In another
// system that works better for a 7 day cycle or even 14 day cycle they might use
// the weekly system instead."*
//
// Two kinds, because those are two different claims about time:
//
//   'week'   seven slots that ARE Monday…Sunday. A plan tied to the calendar.
//   'cycle'  N slots that repeat. Day 1 is not any particular day; it is
//            wherever you are in the rotation.
//
// 🛑 THE PLAN IS DISPLAY ONLY, AND THAT IS A DECISION RATHER THAN AN UNFINISHED
// EDGE. Tim was asked directly whether it should also decide what the app
// suggests next and chose display-only: Home and the Record picker keep offering
// whichever workout you have done least recently. So nothing in this file
// computes "what day is it today" and nothing imports it into next-workout.js.
// A function that answered that question would be the whole of the feature Tim
// declined, sitting one call site away from being switched on by accident.
//
// ⚠️ PURE ON PURPOSE. No DOM, no store, no clock. store.js validates with it and
// views-workouts.js draws with it, and neither can drift from the other's idea
// of what a slot may hold.

/** The two kinds. Anything else is not a schedule and is dropped on read. */
export const WEEK = 'week';
export const CYCLE = 'cycle';

/**
 * ⚠️ THREE SLOT STATES, NOT TWO, AND THE THIRD IS THE HONEST ONE.
 *
 *   a workout id   train that workout on this day
 *   REST           the user said REST. A choice they made.
 *   null           nothing has been said about this day yet.
 *
 * Collapsing the last two would be the easy build and it would put words in
 * somebody's mouth: a half-filled plan would claim four rest days its author
 * never chose (Rule 6 — the app does not get to have an opinion about somebody's
 * week). It also matters when a workout is deleted — see pruneSchedule(), which
 * empties that slot rather than resting it.
 */
export const REST = 'rest';

// Monday first. The app is a training planner and a training week starts on
// Monday everywhere Tim's examples put it — his own was "monday: push … sunday:
// rest". Not locale-derived: a plan whose first column moved because of a
// browser setting would be a plan that disagrees with the one you typed.
// ⚠️ Not exported, for the same reason there is no trainingDays() at the bottom
// of this file: slotLabel() is the only thing that should ever turn an index
// into a day, so a screen reader and the screen cannot name the same slot two
// different ways. A caller holding the raw array would be a second namer.
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WEEK_DAYS = 7;
// Two is the shortest thing that is a rotation at all; below it "repeat" says
// nothing. Fourteen is the top of Tim's own examples ("even 14 day cycle"), and
// it is also the number the boxes were laid out against — see .plan-grid in
// css/app.css, which was measured at 360px with fourteen of them.
export const MIN_CYCLE_DAYS = 2;
export const MAX_CYCLE_DAYS = 14;

/** How many slots a schedule of this kind and length has. */
export function slotCount(kind, days) {
  if (kind === WEEK) return WEEK_DAYS;
  const n = Math.round(Number(days));
  if (!Number.isFinite(n)) return MIN_CYCLE_DAYS;
  return Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, n));
}

/** A blank plan of the given kind — every day unset, nothing assumed. */
export function newSchedule(kind, days) {
  const k = kind === CYCLE ? CYCLE : WEEK;
  return { kind: k, slots: new Array(slotCount(k, days)).fill(null) };
}

/**
 * Coerce whatever is on the row into a plan, or `null` if it is not one.
 *
 * ⚠️ ABSENT MEANS NO PLAN, and that is why this returns null rather than a blank
 * seven-day week. "A system without a schedule is completely unchanged" is the
 * whole of the "optional" in Tim's ask; handing every system an empty plan would
 * make every system screen grow a row of empty boxes nobody asked for.
 *
 * Length is derived from `slots.length` rather than stored beside it. A stored
 * count is a second source of truth for the same fact and the two go out of step
 * the first time one is written without the other.
 */
export function normalizeSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return null;
  const kind = schedule.kind === CYCLE ? CYCLE : (schedule.kind === WEEK ? WEEK : null);
  if (!kind) return null;
  const raw = Array.isArray(schedule.slots) ? schedule.slots : [];
  const n = kind === WEEK ? WEEK_DAYS : slotCount(CYCLE, raw.length);
  const slots = new Array(n).fill(null).map((_, i) => normalizeSlot(raw[i]));
  return { kind, slots };
}

/** One slot: a workout id, REST, or nothing. Anything else is nothing. */
function normalizeSlot(slot) {
  if (slot === REST) return REST;
  if (typeof slot !== 'string') return null;
  const id = slot.trim();
  return id ? id : null;
}

/**
 * Grow or shrink a cycle, keeping what the user already typed.
 *
 * ⚠️ SHRINKING DISCARDS THE TAIL AND SAYS SO AT THE CALL SITE. Keeping the
 * dropped days somewhere invisible so they come back on re-growing sounds
 * friendly and is a plan that silently disagrees with the boxes on screen.
 */
export function resizeSchedule(schedule, days) {
  const plan = normalizeSchedule(schedule);
  if (!plan || plan.kind !== CYCLE) return plan;
  const n = slotCount(CYCLE, days);
  const slots = new Array(n).fill(null).map((_, i) => (i < plan.slots.length ? plan.slots[i] : null));
  return { kind: CYCLE, slots };
}

/**
 * What to call slot `i` — "Mon" or "Day 3".
 *
 * `long` gives the accessible name ("Monday", "Day 3 of the cycle"); the short
 * form is what fits in a 96px box. Both come from here so a screen reader and
 * the screen can never name the same slot differently.
 */
export function slotLabel(kind, i, long = false) {
  if (kind === WEEK) return long ? WEEKDAYS[i % WEEK_DAYS] : WEEKDAYS_SHORT[i % WEEK_DAYS];
  return long ? `Day ${i + 1} of the cycle` : `Day ${i + 1}`;
}

/**
 * Empty every slot pointing at a workout that no longer exists.
 *
 * 🚨 THIS IS THE LESSON dropOrphanGroups() IN js/set-types.js ALREADY PAID FOR,
 * one collection up: a foreign key into a set of rows is only valid while the
 * rest of that set still exists. A slot holds a workout ID, and a workout can be
 * deleted (or taken with its whole system, D22) long after the plan naming it
 * was written. Renaming is not a problem — the id does not change and the name
 * is read live — but deleting is.
 *
 * ⚠️ THE DEAD SLOT BECOMES `null`, NEVER `REST`. Emptying is the only honest
 * answer: the user planned something for that day and the thing is gone, which
 * is not the same as them having chosen to rest. The boxes show it as unset and
 * the person can say what they meant.
 *
 * ⚠️ RETURNS `{ schedule, dropped }` RATHER THAN THE PLAN, because the count is
 * the half the caller actually needs. normalizeSchedule() allocates a fresh
 * object every time, so `result === input` can never be the "nothing changed"
 * signal — a caller testing for it would rewrite the whole systems collection on
 * every workout deletion and never know.
 */
export function pruneSchedule(schedule, liveIds) {
  const plan = normalizeSchedule(schedule);
  if (!plan) return { schedule: null, dropped: 0 };
  const live = liveIds instanceof Set ? liveIds : new Set(liveIds || []);
  let dropped = 0;
  const slots = plan.slots.map((s) => {
    if (s === null || s === REST || live.has(s)) return s;
    dropped++;
    return null;
  });
  return { schedule: { kind: plan.kind, slots }, dropped };
}

/* 🛑 THERE IS DELIBERATELY NO `trainingDays()` HERE, AND NO "WHAT DAY IS IT".
 * Both were written and both were removed before this shipped. Counting the
 * days a plan says to train is two lines and has exactly one plausible caller —
 * the programme rating on the system screen, which today derives its "days/wk"
 * from `daysPerWeek` and from what you have actually recorded. Feeding the plan
 * into it would be the plan deciding something, which is the one thing Tim said
 * no to. An unused export sitting beside that refusal is not neutral: it is the
 * missing half of the feature, pre-built, waiting for somebody to join it up.
 * If a future session has a real use, write it then. */
