// Ready-made workout systems the user can browse and copy into their account.
//
// SHAPE FIRST, CONTENT SECOND. This file is deliberately structured so that a
// system published by somebody else — a coach, a YouTuber — can be added later
// without changing anything but the data: `author`, `sourceName` and `sourceUrl`
// exist now and are shown now, so a third-party system can never be presented as
// though the app wrote it.
//
// ⚠️ WHAT IS NOT IN HERE, AND WHY. Tim asked (2026-08-17) for Jeff Nippard's
// "Ultimate Push Pull Legs" as the first public system. It is not here, for two
// reasons that are worth writing down so nobody re-litigates them by accident:
//
//   1. The full 12-week system is a PAID product on jeffnippard.com — a 110-page
//      ebook he sells. Copying its prescriptions into a public app is
//      redistributing something he charges for.
//   2. Nobody here can watch the videos. Secondary write-ups of the free YouTube
//      series are partial and disagree with each other. Publishing a guess under
//      a real person's name is worse than publishing nothing under it.
//
// The structure below is what a properly licensed or properly sourced third-party
// system would slot into. See chat.md, 2026-08-17.
//
// The systems here are the app's own, built on what docs/research.md already
// supports: ~10–20 hard sets per muscle per week (§6), compounds first while
// fresh (§4), and sets taken close to failure because every estimate the app
// makes assumes it (§3).
//
// Exercises are referenced BY NAME, not by id. Ids are derived from name+muscle
// in exercises.js, so hard-coding them here would rot silently the first time a
// name changed. A test asserts every name below resolves to a real exercise.

export const PRESET_SYSTEMS = [
  {
    id: 'preset-nippard-ppl-2023',
    name: 'Ultimate Push Pull Legs',
    author: 'Jeff Nippard',
    sourceName: 'The Ultimate Push Pull Legs Series (2023) — YouTube',
    sourceUrl: 'https://www.youtube.com/playlist?list=PLp4G6oBUcv8w-v9tpZeF8GSlGcyl_J_gx',
    // ⚠️ NOT OFFICIAL, and the screen says so. These three workouts are
    // transcribed from published write-ups of the FREE YouTube videos — Fitness
    // Volt and BarBend — not from Jeff Nippard's paid 12-week ebook, and not
    // from him. Two limits worth keeping in view:
    //   · the series is SIX parts; this is one rotation of it, not all six
    //   · nobody here watched the videos, so the sets and reps are as reported
    // The `unofficial` flag is what puts that on screen rather than in a
    // comment nobody reads.
    unofficial: true,
    goal: 'Hypertrophy',
    daysPerWeek: 6,
    minutes: 75,
    level: 'Intermediate',
    summary: 'One rotation of Jeff Nippard’s 2023 YouTube series. Heavy top sets, then '
      + 'high-rep isolation work chosen for stretch and peak contraction.',
    notes: 'Transcribed from published write-ups of the free YouTube videos, not from Jeff '
      + 'Nippard’s paid programme and not by him. Watch the series for his form cues and '
      + 'reasoning — they are most of the value and none of it fits in a workout log.\n\n'
      + 'The series runs to six workouts; this is one Push, one Pull and one Legs from it.\n\n'
      + 'The pattern to notice: one heavy compound taken near a true maximum, then everything '
      + 'else lighter and further from failure, picked for where it loads the muscle rather than '
      + 'for how much weight moves.',
    workouts: [
      { name: 'Push', notes: 'Chest, shoulders, triceps. One heavy press, then stretch- and '
          + 'contraction-biased work. Reported reps: bench 3–5, Larsen press 10, Arnold press '
          + '8–10, press-around 12–15, Y-raise 12–15, pressdown 8, cross-body extension 10–12.',
        exercises: [
          { name: 'Barbell Bench Press', sets: 1, notes: 'One heavy set of 3–5, after working up to it.' },
          { name: 'Larsen Press', sets: 2, notes: 'Legs off the floor — no leg drive, no arch. 10 reps.' },
          { name: 'Arnold Press', sets: 3, notes: 'Standing. 8–10 reps.' },
          { name: 'Cable Press Around', sets: 2, notes: '12–15 reps. Supersetted with a 30-second pec stretch.' },
          { name: 'Cross-Body Cable Y-Raise', sets: 3, notes: '12–15 reps.' },
          { name: 'Triceps Pushdown', sets: 3, notes: 'Squeeze-only partials, 8 reps. Supersetted with the overhead extension.' },
          { name: 'Overhead Cable Extension', sets: 3, notes: 'Stretch-only partials, 8 reps.' },
          { name: 'Cross-Body Cable Triceps Extension', sets: 2, notes: '10–12 reps.' },
        ] },
      { name: 'Pull', notes: 'Back, biceps, rear delts. Six exercises. Reported reps: pulldown '
          + '12–15, pull-ups to failure, Kroc rows 10–12, everything else 10–12.',
        exercises: [
          { name: 'Single-Arm Lat Pulldown', sets: 3, notes: 'Half-kneeling, one arm. 12–15 reps.' },
          { name: 'Pull-Up', sets: 1, notes: 'One set to failure. If you are cutting, aim to add a rep a week as your body weight drops.' },
          { name: 'Kroc Row', sets: 3, notes: 'Heavy one-arm dumbbell row, 10–12 reps.' },
          { name: 'Cable Shrug', sets: 3, notes: 'Shrug-ins from a low pulley — the traps fan out horizontally, so the cable angle suits them better than a barbell. 10–12 reps.' },
          { name: 'Reverse Pec Deck', sets: 3, notes: '10–12 reps.' },
          { name: 'Cable Curl', sets: 3, notes: 'Overhead, which biases the long head more than a standing curl. 10–12 reps.' },
        ] },
      { name: 'Legs', notes: 'One heavy squat, then hinge, single-leg, hamstring and calf work. '
          + 'Reported: squat 2–4 near max plus two paused back-off sets, RDL 8–10, lunges 10 per '
          + 'leg, leg curls 10–12, calves 10–12.',
        exercises: [
          { name: 'Back Squat', sets: 3, notes: 'Work up, then one set of 2–4 at 85–90%. Two paused back-off sets of 5 at 75% of that.' },
          { name: 'Romanian Deadlift', sets: 3, notes: '8–10 reps.' },
          { name: 'Walking Lunge', sets: 3, notes: 'Dumbbells, 10 reps per leg.' },
          { name: 'Seated Leg Curl', sets: 3, notes: '10–12 reps.' },
          { name: 'Leg Press Calf Raise', sets: 4, notes: '10–12 reps.' },
          { name: 'Decline Sit-Up', sets: 3, notes: 'Holding a plate. 10–12 reps.' },
        ] },
    ],
  },

  {
    id: 'preset-ppl',
    name: 'Push Pull Legs',
    author: 'Fitness Tracker',
    sourceName: null,
    sourceUrl: null,
    goal: 'Hypertrophy',
    daysPerWeek: 6,
    minutes: 65,
    level: 'Intermediate',
    summary: 'Three workouts run twice a week. The most common way to get 10–20 hard sets '
      + 'per muscle without any session running long.',
    notes: 'Run Push, Pull, Legs, rest, then repeat — or spread the six days however your week '
      + 'allows, keeping at least one day between repeats of the same workout.\n\n'
      + 'Take the last set of each exercise to within a rep or two of failure. Every estimate this '
      + 'app makes assumes that, and a set stopped four reps short tells it almost nothing.',
    workouts: [
      { name: 'Push', notes: 'Chest, shoulders, triceps. Press first, while you are fresh.',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, notes: 'Heaviest thing you do today. Leave 1–2 reps in reserve on the top set.' },
          { name: 'Overhead Press', sets: 3, notes: '' },
          { name: 'Incline Dumbbell Bench Press', sets: 3, notes: '' },
          { name: 'Cable Fly', sets: 3, notes: 'Stretch under load matters more than load here.' },
          { name: 'Lateral Raise', sets: 3, notes: 'Light. Side delts respond to reps, not weight.' },
          { name: 'Triceps Pushdown', sets: 3, notes: '' },
          { name: 'Overhead Cable Extension', sets: 3, notes: 'The overhead position is what trains the long head.' },
        ] },
      { name: 'Pull', notes: 'Back and biceps. Row and pull down in the same session — they are not redundant.',
        exercises: [
          { name: 'Barbell Row', sets: 4, notes: '' },
          { name: 'Lat Pulldown', sets: 3, notes: '' },
          { name: 'Seated Cable Row', sets: 3, notes: '' },
          { name: 'Rear Delt Fly', sets: 3, notes: '' },
          { name: 'Barbell Curl', sets: 3, notes: '' },
          { name: 'Hammer Curl', sets: 3, notes: '' },
          { name: 'Face Pull', sets: 3, notes: 'Cheap insurance for shoulders that press twice a week.' },
        ] },
      { name: 'Legs', notes: 'Quads, hamstrings, glutes, calves.',
        exercises: [
          { name: 'Back Squat', sets: 4, notes: '' },
          { name: 'Romanian Deadlift', sets: 3, notes: 'Hinge, do not squat it. Stop when your back would round.' },
          { name: 'Leg Press', sets: 3, notes: '' },
          { name: 'Lying Leg Curl', sets: 3, notes: 'Hamstrings need a knee-bend movement as well as a hinge.' },
          { name: 'Leg Extension', sets: 3, notes: '' },
          { name: 'Standing Calf Raise', sets: 4, notes: 'Pause at the bottom. Bouncing does nothing.' },
        ] },
    ],
  },

  {
    id: 'preset-upper-lower',
    name: 'Upper / Lower',
    author: 'Fitness Tracker',
    sourceName: null,
    sourceUrl: null,
    goal: 'Hypertrophy and strength',
    daysPerWeek: 4,
    minutes: 70,
    level: 'Any',
    summary: 'Four days, two workouts. Hits everything twice a week and is the easiest '
      + 'programme to keep to when life gets in the way.',
    notes: 'Upper, Lower, rest, Upper, Lower, rest, rest — or any arrangement that gives each '
      + 'workout two goes a week.\n\n'
      + 'If you miss a day, do the workout you missed rather than skipping to the next one. '
      + 'Two sessions a week per muscle is what this programme is built on.',
    workouts: [
      { name: 'Upper', notes: 'Everything above the waist. Push and pull alternate so nothing is fresh-only.',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, notes: '' },
          { name: 'Barbell Row', sets: 4, notes: '' },
          { name: 'Overhead Press', sets: 3, notes: '' },
          { name: 'Lat Pulldown', sets: 3, notes: '' },
          { name: 'Lateral Raise', sets: 3, notes: '' },
          { name: 'Barbell Curl', sets: 3, notes: '' },
          { name: 'Triceps Pushdown', sets: 3, notes: '' },
        ] },
      { name: 'Lower', notes: 'Legs, plus the hip hinge that also builds your back.',
        exercises: [
          { name: 'Back Squat', sets: 4, notes: '' },
          { name: 'Romanian Deadlift', sets: 3, notes: '' },
          { name: 'Leg Press', sets: 3, notes: '' },
          { name: 'Seated Leg Curl', sets: 3, notes: '' },
          { name: 'Leg Extension', sets: 3, notes: '' },
          { name: 'Standing Calf Raise', sets: 4, notes: '' },
        ] },
    ],
  },

  {
    id: 'preset-full-body',
    name: 'Full Body, 3 Days',
    author: 'Fitness Tracker',
    sourceName: null,
    sourceUrl: null,
    goal: 'General strength',
    daysPerWeek: 3,
    minutes: 50,
    level: 'Beginner',
    summary: 'Three shorter sessions, everything trained each time. The best return on '
      + 'time if you are starting out or can only train three days.',
    notes: 'Alternate A and B: A, B, A one week, then B, A, B the next. At least one rest day '
      + 'between sessions.\n\n'
      + 'Add a little weight whenever you hit the top of the rep range on every set. That is the '
      + 'whole progression rule, and at this stage it works for a long time.',
    workouts: [
      { name: 'Full Body A', notes: 'Squat-led.',
        exercises: [
          { name: 'Back Squat', sets: 3, notes: '' },
          { name: 'Barbell Bench Press', sets: 3, notes: '' },
          { name: 'Barbell Row', sets: 3, notes: '' },
          { name: 'Overhead Press', sets: 2, notes: '' },
          { name: 'Barbell Curl', sets: 2, notes: '' },
          { name: 'Standing Calf Raise', sets: 3, notes: '' },
        ] },
      { name: 'Full Body B', notes: 'Hinge-led. Deadlifts first, while your back is fresh.',
        exercises: [
          { name: 'Deadlift', sets: 3, notes: 'Stop the set when the bar speed drops, not when you fail.' },
          { name: 'Overhead Press', sets: 3, notes: '' },
          { name: 'Lat Pulldown', sets: 3, notes: '' },
          { name: 'Incline Dumbbell Bench Press', sets: 3, notes: '' },
          { name: 'Lying Leg Curl', sets: 3, notes: '' },
          { name: 'Triceps Pushdown', sets: 2, notes: '' },
        ] },
    ],
  },
];

export function presetById(id) {
  return PRESET_SYSTEMS.find((p) => p.id === id) || null;
}

// Total planned sets, used in the browse list so the size of a programme is
// visible before you commit to it.
export function presetSetCount(preset) {
  return preset.workouts.reduce(
    (n, w) => n + w.exercises.reduce((m, e) => m + (Number(e.sets) || 0), 0), 0);
}

export function presetExerciseNames(preset) {
  return preset.workouts.flatMap((w) => w.exercises.map((e) => e.name));
}
