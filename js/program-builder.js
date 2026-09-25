// Answers → a program. Pure: no DOM, no store. docs/onboarding-plan.md part A.
//
// Tim, 2026-09-25: *"a guided system for users as soon as they log in that's
// question/multiple choice based … For now, this will just be giving them a
// workout they need."*
//
// HOW IT WORKS, in the order the plan states it:
//   split     from days a week (2 = full body A/B, 3 = A/B/C, 4 = upper/lower,
//             5 = upper/lower + push/pull/legs, 6 = push/pull/legs run twice)
//   exercises each day is a list of SLOTS (a movement: "horizontal press",
//             "hinge" …). A slot names real exercises from js/exercises.js in
//             order of preference; the first one the person's equipment allows
//             wins. Nothing is invented — tests/onboarding.test.mjs walks every
//             answer combination and checks every id against the library.
//   count     exercises per day from time (30 → 4 … 75 → 7), beginners capped at 5
//   sets      from experience and time; beginners 2–3, the two main lifts +1
//             for anyone past a year at 60 min or more
//   reps      by goal: muscle 8–12 · strength 3–6 on the main lifts, then 6–10
//             · both 5–8 then 8–12 · general 8–12 then 10–15
//   focus     up to two muscle groups: +1 set on their exercises, and their
//             optional slots are pulled forward so a short day still has them
//
// ⚠️ EQUIPMENT IS READ FROM THE EXERCISE'S OWN `equipment` FIELD, never from its
// name, so "Bodyweight only" can be proven to contain no barbell by a test.

import { BUILT_IN_EXERCISES } from './exercises.js';
import { PRESET_SYSTEMS } from './preset-systems.js';

/** Which `equipment` values each answer allows. */
export const EQUIPMENT_ALLOWED = {
  gym: ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Plate'],
  dumbbells: ['Dumbbell', 'Bodyweight'],
  barbell: ['Barbell', 'Bodyweight', 'Plate'],
  bodyweight: ['Bodyweight'],
};

/* Each slot: exercises by NAME in order of preference. `main` marks the lifts
 * that can open a day and carry the heavy rep range. A name that is not in the
 * library would simply never be picked — the test would then see a thin day. */
const SLOTS = {
  squat:    { main: true, pick: ['Back Squat', 'Goblet Squat', 'Bodyweight Squat'] },
  hinge:    { main: true, pick: ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Single-Leg Hip Thrust'] },
  deadlift: { main: true, pick: ['Deadlift', 'Dumbbell Romanian Deadlift', 'Single-Leg Hip Thrust'] },
  quad2:    { pick: ['Leg Press', 'Bulgarian Split Squat', 'Barbell Lunge', 'Cossack Squat'] },
  hamCurl:  { pick: ['Lying Leg Curl', 'Single-Leg Romanian Deadlift', 'Slider Leg Curl'] },
  glute:    { pick: ['Hip Thrust', 'Single-Leg Hip Thrust', 'Frog Pump'] },
  calves:   { pick: ['Standing Calf Raise', 'Dumbbell Calf Raise', 'Barbell Calf Raise', 'Single-Leg Calf Raise'] },
  hPush:    { main: true, pick: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Push-Up'] },
  incPush:  { pick: ['Incline Dumbbell Bench Press', 'Incline Barbell Bench Press', 'Decline Push-Up'] },
  chestIso: { pick: ['Cable Fly', 'Dumbbell Fly', 'Wide-Grip Push-Up'] },
  vPush:    { main: true, pick: ['Overhead Press', 'Dumbbell Shoulder Press', 'Pike Push-Up'] },
  lateral:  { pick: ['Lateral Raise', 'Upright Row', 'Pike Push-Up'] },
  rearDelt: { pick: ['Face Pull', 'Rear Delt Fly'] },
  hPull:    { main: true, pick: ['Barbell Row', 'Dumbbell Row', 'Inverted Row'] },
  hPull2:   { pick: ['Seated Cable Row', 'Chest-Supported Dumbbell Row', 'Pendlay Row', 'Inverted Row'] },
  vPull:    { pick: ['Lat Pulldown', 'Pull-Up'] },
  vPull2:   { pick: ['Close-Grip Lat Pulldown', 'Chin-Up', 'Neutral-Grip Pull-Up'] },
  biceps:   { pick: ['Dumbbell Curl', 'Barbell Curl', 'Chin-Up'] },
  biceps2:  { pick: ['Hammer Curl', 'EZ-Bar Curl'] },
  triceps:  { pick: ['Triceps Pushdown', 'Overhead Dumbbell Extension', 'Skull Crusher', 'Diamond Push-Up'] },
  triceps2: { pick: ['Overhead Cable Extension', 'Dumbbell Skull Crusher', 'Close-Grip Bench Press', 'Bench Dip'] },
  core:     { pick: ['Cable Crunch', 'Reverse Crunch'] },
};

/* Days, most important first. The first two are never dropped for time; the
 * tail is what a shorter session loses (unless it is a focus muscle). */
const DAYS = {
  'full-body-a': { name: 'Full Body A', slots: ['squat', 'hPush', 'hPull', 'lateral', 'hamCurl', 'biceps', 'triceps', 'calves', 'glute', 'core'] },
  'full-body-b': { name: 'Full Body B', slots: ['hinge', 'vPush', 'vPull', 'incPush', 'quad2', 'triceps', 'biceps', 'core', 'glute', 'calves'] },
  'full-body-c': { name: 'Full Body C', slots: ['deadlift', 'incPush', 'hPull2', 'quad2', 'lateral', 'biceps2', 'triceps2', 'glute', 'core', 'calves'],
    // Four protected: without a barbell the deadlift becomes a dumbbell RDL,
    // a hamstring lift, so the day needs both its pull AND its squat.
    protect: 4 },
  'upper-a': { name: 'Upper A', slots: ['hPush', 'hPull', 'vPush', 'vPull', 'lateral', 'biceps', 'triceps', 'rearDelt', 'chestIso'] },
  'lower-a': { name: 'Lower A', slots: ['squat', 'hinge', 'quad2', 'hamCurl', 'calves', 'core', 'glute'] },
  'upper-b': { name: 'Upper B', slots: ['vPush', 'hPull2', 'incPush', 'vPull', 'chestIso', 'biceps2', 'triceps2', 'rearDelt', 'lateral'] },
  'lower-b': { name: 'Lower B', slots: ['deadlift', 'quad2', 'glute', 'hamCurl', 'calves', 'core'] },
  upper: { name: 'Upper', slots: ['hPush', 'hPull', 'vPush', 'vPull', 'lateral', 'biceps', 'triceps', 'rearDelt', 'chestIso'] },
  lower: { name: 'Lower', slots: ['squat', 'hinge', 'quad2', 'hamCurl', 'calves', 'core', 'glute'] },
  push: { name: 'Push', slots: ['hPush', 'vPush', 'incPush', 'lateral', 'chestIso', 'triceps', 'triceps2'] },
  pull: { name: 'Pull', slots: ['hPull', 'vPull', 'hPull2', 'rearDelt', 'biceps', 'biceps2', 'vPull2', 'core'] },
  legs: { name: 'Legs', slots: ['squat', 'hinge', 'quad2', 'hamCurl', 'glute', 'calves', 'core'] },
};

const R = 'rest';
/* The split per days-a-week: which days, the program's name, the plan (a
 * seven-slot cycle, drawn by the existing plan boxes) and one line on running it. */
const SPLITS = {
  2: { label: 'Full Body', days: ['full-body-a', 'full-body-b'],
    plan: ['full-body-a', R, R, 'full-body-b', R, R, R],
    how: 'Alternate A and B. Rest at least a day between.' },
  3: { label: 'Full Body', days: ['full-body-a', 'full-body-b', 'full-body-c'],
    plan: ['full-body-a', R, 'full-body-b', R, 'full-body-c', R, R],
    how: 'A, B, then C across the week. Rest a day between.' },
  4: { label: 'Upper/Lower', days: ['upper-a', 'lower-a', 'upper-b', 'lower-b'],
    plan: ['upper-a', 'lower-a', R, 'upper-b', 'lower-b', R, R],
    how: 'Upper A, Lower A, rest, Upper B, Lower B, two rest days.' },
  5: { label: 'Upper/Lower + PPL', days: ['upper', 'lower', 'push', 'pull', 'legs'],
    plan: ['upper', 'lower', R, 'push', 'pull', 'legs', R],
    how: 'Upper, Lower, rest, then Push, Pull, Legs.' },
  6: { label: 'Push/Pull/Legs', days: ['push', 'pull', 'legs'],
    plan: ['push', 'pull', 'legs', 'push', 'pull', 'legs', R],
    how: 'Push, Pull, Legs, twice through. One rest day a week.' },
};

const FOCUS_MUSCLES = {
  chest: ['Chest'],
  back: ['Back', 'Traps'],
  shoulders: ['Shoulders'],
  arms: ['Biceps', 'Triceps', 'Forearms'],
  legs: ['Quads', 'Hamstrings', 'Calves'],
  glutes: ['Glutes'],
  core: ['Core'],
};

const EXERCISES_PER_DAY = { 30: 4, 45: 5, 60: 6, 75: 7 };
const MINUTES_PER_SET = 2.5; // a working set plus its rest, roughly

let libByName = null;
function libraryByName() {
  if (!libByName) {
    libByName = new Map();
    // First wins: "Cable Kickback" exists twice, and no slot names it anyway.
    for (const e of BUILT_IN_EXERCISES) if (!libByName.has(e.name)) libByName.set(e.name, e);
  }
  return libByName;
}

function pickFor(slotKey, allowed, taken) {
  const slot = SLOTS[slotKey];
  for (const name of slot.pick) {
    const ex = libraryByName().get(name);
    if (!ex || !allowed.includes(ex.equipment) || !ex.fields.includes('reps')) continue;
    if (taken.has(ex.id)) continue;
    return ex;
  }
  return null;
}

function clampMinutes(m) {
  const n = Number(m) || 60;
  return n <= 30 ? 30 : n <= 45 ? 45 : n <= 60 ? 60 : 75;
}

function clampDays(d) {
  const n = Math.round(Number(d) || 3);
  return Math.min(6, Math.max(2, n));
}

function repsFor(goal, ex, isMain) {
  if (!ex.fields.includes('weight')) return [8, 15]; // body weight: reps are the only dial
  switch (goal) {
    case 'strength': return isMain ? [3, 6] : [6, 10];
    case 'both': return isMain ? [5, 8] : [8, 12];
    case 'general': return isMain ? [8, 12] : [10, 15];
    default: return [8, 12];
  }
}

function buildDay(key, a) {
  const day = DAYS[key];
  const allowed = EQUIPMENT_ALLOWED[a.equipment] || EQUIPMENT_ALLOWED.gym;
  const focusMuscles = new Set((a.focus || []).flatMap((f) => FOCUS_MUSCLES[f] || []));

  // Resolve every slot to a real exercise, skipping any the equipment rules out
  // and any already used today.
  const taken = new Set();
  const resolved = [];
  for (const slotKey of day.slots) {
    const ex = pickFor(slotKey, allowed, taken);
    if (!ex) continue;
    taken.add(ex.id);
    resolved.push({ slotKey, ex, focus: focusMuscles.has(ex.muscle) });
  }

  // How many. The first three always stay (on a full-body day that is a leg,
  // a push and a pull — a focus must never cost the day its pull); up to two
  // focus exercises are then pulled forward from the tail; the rest fill in order.
  const beginner = a.experience === 'new';
  let n = EXERCISES_PER_DAY[a.minutes];
  if (beginner) n = Math.min(n, 5);
  n = Math.min(n, resolved.length);
  const protect = day.protect || 3;
  const keep = new Set();
  for (let i = 0; i < protect && i < n; i++) keep.add(i);
  let promoted = 0;
  for (let i = protect; i < resolved.length && keep.size < n && promoted < 2; i++) {
    if (resolved[i].focus) { keep.add(i); promoted++; }
  }
  for (let i = protect; i < resolved.length && keep.size < n; i++) keep.add(i);
  const chosen = resolved.filter((_, i) => keep.has(i));

  // Sets.
  const longSession = a.minutes >= 60;
  const base = beginner ? (longSession ? 3 : 2) : 3;
  const maxSets = beginner ? 3 : 4;
  const exercises = chosen.map((c, i) => {
    const isMain = Boolean(SLOTS[c.slotKey].main) && i < 2;
    let sets = base;
    if (isMain && !beginner && longSession && a.experience !== 'under1') sets += 1;
    if (c.focus) sets += 1;
    sets = Math.min(sets, maxSets);
    return {
      name: c.ex.name,
      exerciseId: c.ex.id,
      muscle: c.ex.muscle,
      equipment: c.ex.equipment,
      sets,
      reps: repsFor(a.goal, c.ex, isMain),
      main: isMain,
      focus: c.focus,
    };
  });

  // Fit the time: trim extra sets from the end (never below 2, main lifts
  // last), then drop exercises from the end if it still does not fit.
  const budget = Math.floor((a.minutes + 10) / MINUTES_PER_SET);
  const total = () => exercises.reduce((s, e) => s + e.sets, 0);
  for (const pass of [false, true]) {
    for (let i = exercises.length - 1; i >= 0 && total() > budget; i--) {
      const e = exercises[i];
      if (e.main !== pass) continue;
      while (e.sets > 2 && total() > budget) e.sets--;
    }
  }
  while (total() > budget && exercises.length > 3) exercises.pop();

  return {
    key,
    name: day.name,
    exercises: exercises.map(({ main, focus, ...rest }) => rest),
  };
}

/**
 * @param {{goal:string, experience:string, days:number, minutes:number,
 *          equipment:string, focus?:string[]}} answers
 *   goal: muscle | strength | both | general
 *   experience: new | under1 | 1to3 | 3plus
 *   equipment: gym | dumbbells | barbell | bodyweight
 *   focus: up to two of chest, back, shoulders, arms, legs, glutes, core
 * @returns {{name, daysPerWeek, minutes, notes, plan, workouts:[{key, name,
 *   exercises:[{name, exerciseId, muscle, equipment, sets, reps:[lo,hi]}]}]}}
 */
export function buildProgram(answers) {
  const a = {
    goal: ['muscle', 'strength', 'both', 'general'].includes(answers && answers.goal) ? answers.goal : 'muscle',
    experience: ['new', 'under1', '1to3', '3plus'].includes(answers && answers.experience) ? answers.experience : 'under1',
    days: clampDays(answers && answers.days),
    minutes: clampMinutes(answers && answers.minutes),
    equipment: EQUIPMENT_ALLOWED[answers && answers.equipment] ? answers.equipment : 'gym',
    focus: ((answers && answers.focus) || []).filter((f) => FOCUS_MUSCLES[f]).slice(0, 2),
  };
  const split = SPLITS[a.days];
  const workouts = split.days.map((key) => buildDay(key, a));
  return {
    name: `Your ${a.days}-day ${split.label}`,
    daysPerWeek: a.days,
    minutes: a.minutes,
    notes: `Built from your answers. ${split.how} `
      + (a.equipment === 'bodyweight'
        ? 'Hit the top of the rep range, then try a harder version.'
        : 'Add weight when you reach the top of the rep range.'),
    plan: { kind: 'cycle', slots: split.plan.slice() },
    workouts,
  };
}

const LEVEL_FOR = { new: 'Beginner', under1: 'Beginner', '1to3': 'Intermediate', '3plus': 'Advanced' };

/**
 * One or two ready-made programs from Explore that fit the answers, best first.
 * ⚠️ Only for a full gym: every ready-made program here needs one, and offering
 * a barbell program to somebody who said "bodyweight only" is worse than none.
 */
export function matchingPresets({ days, experience, equipment }, presets = PRESET_SYSTEMS, max = 2) {
  if (equipment && equipment !== 'gym') return [];
  const want = LEVEL_FOR[experience] || 'Beginner';
  const d = clampDays(days);
  const scored = presets.map((p, i) => {
    const diff = Math.abs((p.daysPerWeek || 0) - d);
    let s = diff === 0 ? 4 : diff === 1 ? 1 : 0;
    if (p.level === want) s += 2;
    else if (p.level === 'Any') s += 1;
    else if (want === 'Beginner' && p.level === 'Advanced') s -= 5;
    // Ties go to the app's own programs, then to list order.
    return { p, s, ours: p.author === 'Fitness Tracker' && !p.basedOn ? 0 : 1, i };
  }).filter((x) => x.s >= 3);
  scored.sort((x, y) => y.s - x.s || x.ours - y.ours || x.i - y.i);
  return scored.slice(0, max).map(({ p }) => ({ id: p.id, name: p.name, daysPerWeek: p.daysPerWeek, level: p.level }));
}
