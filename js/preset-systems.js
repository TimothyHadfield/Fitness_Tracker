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
//
// ── THREE KINDS OF SYSTEM, AND WHY THE DIFFERENCE IS ENCODED ─────────────────
//
//   1. OURS.        `author: 'Fitness Tracker'`, no source. We wrote it.
//   2. TRANSCRIBED. `author` is a real person, `unofficial: true`, and a
//                   `sourceUrl` to the published write-up. THE WORKOUTS ARE
//                   THEIRS; the words describing them are not.
//   3. METHOD.      `author: 'Fitness Tracker'` PLUS `basedOn: {person, …}`.
//                   The workouts are OURS, written to follow someone's
//                   published method. Their name goes in `basedOn`, never in
//                   `author`, because "By Dr. Mike Israetel" over exercises he
//                   never chose is a lie no warning underneath can undo.
//
// The third kind exists because Tim follows Mike Israetel (2026-08-17). The
// first attempt at him was kind 3 ONLY, on the belief that no transcribable
// programme of his existed. Tim pushed back — "search online for other people
// who have reposted or summarized the system" — and he was right: RP publishes
// his actual split on their own site, for free, and a second write-up agrees
// with it exercise for exercise. That is now shipped as kind 2.
//
// BOTH are kept, because they answer different questions and each is honest
// about which one it answers. `preset-israetel-floating-split` is what he
// really does — a cutting split, mostly myo-reps, only partly representable
// here. `preset-volume-landmarks` is a runnable programme built on the method
// he publishes for everybody else. Neither could stand in for the other, and
// the summaries say so on screen so nobody has to guess.
//
// The lesson worth keeping: "no honest source exists" was a conclusion reached
// after four searches, and it was wrong. Search harder before inventing a
// category.
//
// `warning` overrides the default red banner on the detail screen. The default
// talks about transcribing free VIDEOS, which is true of Nippard and false of
// a sixty-year-old routine from a book or of a method-based system, so anything
// that is not a video transcription must set its own.

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
          // The write-up says these two are supersetted, and now the app can
          // say so too rather than listing them as separate exercises.
          { name: 'Triceps Pushdown', sets: 3, group: 0, notes: 'Squeeze-only partials, 8 reps.' },
          { name: 'Overhead Cable Extension', sets: 3, group: 0, notes: 'Stretch-only partials, 8 reps. Straight into this from the pushdown.' },
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
    id: 'preset-israetel-floating-split',
    name: 'Dr. Mike’s Floating Split',
    author: 'Dr. Mike Israetel',
    sourceName: 'Dr. Mike’s Exact Training Split to Get to 6% Body Fat — Renaissance Periodization',
    sourceUrl: 'https://rpstrength.com/blogs/video-guides/dr-mikes-exact-training-split-to-get-to-6-body-fat',
    // ⚠️ NOT OFFICIAL, but better sourced than most: the split is written up on
    // RENAISSANCE PERIODIZATION'S OWN SITE, free, and a second write-up (BoxLife)
    // agrees with it exercise for exercise. That is a stronger footing than the
    // Nippard transcription had. Three things it does NOT fix:
    //
    //   1. It is a CUTTING split — what he trained while dieting to 6 % body
    //      fat, built to hold muscle under fatigue rather than to add it.
    //   2. Nearly every set in it is a MYO-REP or a GIANT SET, and this app can
    //      only record straight sets. The exercises are his; the set structure
    //      is not, and cannot be until docs/vision.md §1.5 is built. This is the
    //      single most distorted transcription in this file and the warning
    //      leads with it.
    //   3. Several set counts were never reported by either source, and the
    //      specialty bars he uses (transformer bar, cambered bar, the CC squat
    //      machine) are mapped onto the nearest thing in the library.
    unofficial: true,
    warning: 'Not official. Transcribed from the write-up on Renaissance Periodization’s own site, '
      + 'not from him. It is a CUTTING split — built to hold muscle while dieting to 6 % body fat, '
      + 'not to add it — so it is not a mass programme. Some set counts were never reported by '
      + 'either source, and the specialty bars he uses are swapped for the nearest equivalent.',
    goal: 'Holding muscle while cutting',
    daysPerWeek: 6,
    minutes: 90,
    level: 'Advanced',
    summary: 'The split Dr. Mike Israetel actually trained to reach 6 % body fat — Pull, Legs, '
      + 'Push, twice through, with no fixed days. Written up on Renaissance Periodization’s own '
      + 'site.',
    notes: 'Transcribed from the write-up on Renaissance Periodization’s own site — not from him, '
      + 'and not from anything RP sells. A second write-up (BoxLife) agrees with it exercise for '
      + 'exercise, which is a firmer footing than most creator programmes get.\n\n'
      + 'Read this before you run it. It is a CUTTING split: this is what he did while dieting '
      + 'down to 6 % body fat, so it is built to hold muscle under fatigue rather than to add it. '
      + 'Run it to grow and you are running the wrong programme.\n\n'
      + 'Almost every set he does is a MYO-REP — take the set close to failure, rest ten or fifteen '
      + 'seconds, then squeeze out short mini-sets at the same weight. Those are marked as myo-reps '
      + 'below and the app records them properly: the whole thing counts as one hard set, which is '
      + 'the point of doing them. (Until 2026-08-17 it could not, and this programme shipped with '
      + 'its structure flattened.)\n\n'
      + 'What "floating" means, and it is the best idea in here: there are no days of the week. You '
      + 'run Pull 1, Legs 1, Push 1, Pull 2, Legs 2, Push 2 and start again. Train when you have '
      + 'recovered, rest when you have not — one rest day, two, or none. It came out at six days a '
      + 'week on average, sometimes five, sometimes seven. Missing a Tuesday cannot derail a '
      + 'programme that has no Tuesday.\n\n'
      + 'Sessions ran about ninety minutes. Reps are high throughout — mostly 10–20, and the lateral '
      + 'raises accumulate near a hundred reps in a session.\n\n'
      + 'Equipment: he uses a transformer bar, a cambered bar and a CC squat machine. Those are '
      + 'mapped to the closest thing in this app’s library and noted on each exercise. Use whatever '
      + 'your gym has — none of it is load-bearing.',
    workouts: [
      { name: 'Pull 1', notes: 'Neutral-grip pull-ups first, then rows, side delts, biceps and '
          + 'forearms. Reported: 3–5 weighted sets of 5–15, then the same grip unweighted; rows '
          + 'about 40 total reps; laterals 4–6 sets to around 100 reps; curls one set of 40.',
        exercises: [
          { name: 'Neutral-Grip Pull-Up', sets: 5, notes: 'Weighted for 5–15 reps, descending. Then strip the weight and repeat the same grip — that second block is the point, not a cooldown.' },
          { name: 'Chest-Supported Row', sets: 2, setType: 'myo', minis: 3, notes: 'Machine. Myo-rep match sets — about 40 reps in total.' },
          { name: 'Lateral Raise', sets: 5, setType: 'myo', minis: 3, notes: 'Seated dumbbell. Myo-rep match sets — he accumulates close to 100 reps here.' },
          { name: 'Cable Curl', sets: 1, setType: 'myo', minis: 4, notes: '40 reps in one myo-rep set. One source says a lying dumbbell curl instead — either is a long-head biceps curl.' },
          { name: 'Wrist Curl', sets: 1, notes: 'Cable. 50 reps, as a finisher.' },
        ] },
      { name: 'Legs 1', notes: 'The hinge day. Abs first, then a good morning, leg press and a '
          + 'quad finisher taken to failure. Reported: good mornings 5–15 reps, leg press 10–20.',
        exercises: [
          { name: 'Decline Sit-Up', sets: 1, notes: '30 reps, to open the session.' },
          { name: 'Good Morning', sets: 3, notes: '5–15 reps. He uses a transformer bar — any safe hinge works.' },
          { name: 'Leg Press', sets: 3, setType: 'myo', minis: 3, notes: '10–20 reps.' },
          { name: 'Sissy Squat', sets: 1, setType: 'myo', minis: 4, notes: 'One giant myo-rep set to failure — about 90 seconds and 30 reps. He uses a CC squat machine; a sissy squat is the closest free version.' },
        ] },
      { name: 'Push 1', notes: 'Calves first, then a flat press, triceps paired with push-ups, '
          + 'biceps and a very long lateral-raise set. Reported: presses 5–15, curls 4×12, '
          + 'laterals 50–75 reps in one giant set.',
        exercises: [
          { name: 'Standing Calf Raise', sets: 3, notes: 'Opens the session.' },
          { name: 'Barbell Bench Press', sets: 3, notes: '5–15 reps. He uses a cambered bar for the extra stretch at the bottom.' },
          { name: 'Overhead Cable Extension', sets: 3, group: 0, notes: 'Straight into the push-ups — no rest between the two.' },
          { name: 'Push-Up', sets: 3, group: 0, notes: 'From a deficit, so the chest drops below the hands.' },
          { name: 'Incline Dumbbell Curl', sets: 4, setType: 'myo', minis: 3, notes: '12 reps on the top set.' },
          { name: 'Lateral Raise', sets: 1, setType: 'myo', minis: 5, notes: 'One giant myo-rep set, light, 50–75 total reps.' },
        ] },
      { name: 'Pull 2', notes: 'Same shape as Pull 1 with the grip changed — overhand rather than '
          + 'neutral. Front raises here instead of laterals. Several counts were never reported.',
        exercises: [
          { name: 'Pull-Up', sets: 5, notes: 'Overhand this time. Weighted first, then unweighted for volume.' },
          { name: 'Machine Row', sets: 3, notes: 'He uses a Smith machine row. Set count not reported.' },
          { name: 'Cable Front Raise', sets: 3, notes: 'Lying. This is a heavy shoulder session.' },
          { name: 'Cable Curl', sets: 1, notes: 'Biceps maintenance rather than a growth block.' },
          { name: 'Wrist Curl', sets: 1, notes: 'Cable.' },
        ] },
      { name: 'Legs 2', notes: 'Hamstring curls replace the hinge — deliberately, to keep lower-back '
          + 'fatigue off a body already dieting. Reported: leg curls and belt squats 15–20 reps.',
        exercises: [
          { name: 'Lying Leg Curl', sets: 3, notes: '15–20 reps. Here instead of a hinge so the lower back gets a break.' },
          { name: 'Belt Squat', sets: 3, setType: 'myo', minis: 3, notes: '15–20 reps. Loads the legs without loading the spine.' },
          { name: 'Bulgarian Split Squat', sets: 3, notes: 'He does these with the transformer bar.' },
        ] },
      { name: 'Push 2', notes: 'The heavier push day. Reported: incline press 10–20, flat bench '
          + '5–15, skull crushers 6 sets at 15–20.',
        exercises: [
          { name: 'Incline Machine Press', sets: 3, setType: 'myo', minis: 3, notes: '10–20 reps.' },
          { name: 'Barbell Bench Press', sets: 3, notes: '5–15 reps, flat and straight-barred this time.' },
          { name: 'Skull Crusher', sets: 6, setType: 'myo', minis: 3, notes: '15–20 reps on the top set. The most volume any exercise gets in the week.' },
          { name: 'Cable Curl', sets: 1, notes: 'He uses a Free Motion cable station.' },
          { name: 'Cable Front Raise', sets: 1, setType: 'myo', minis: 4, notes: 'Lying. One giant myo-rep set to finish.' },
        ] },
    ],
  },

  {
    id: 'preset-arnold-golden-six',
    name: 'The Golden Six',
    author: 'Arnold Schwarzenegger',
    sourceName: 'Arnold’s Golden Six — Fitness Volt',
    sourceUrl: 'https://fitnessvolt.com/arnolds-golden-six-routine/',
    // ⚠️ NOT OFFICIAL. This is the routine Arnold used in his early years in
    // Austria, before he trained on splits. It has been republished for sixty
    // years and the versions DISAGREE — some list an upright row in place of
    // the behind-the-neck press, rep counts on the sit-ups run from 20 to
    // "as many as possible". The version here follows Fitness Volt's. Nobody
    // involved has a primary source, and there may not be one.
    unofficial: true,
    warning: 'Not official. A routine from Arnold’s early years, republished for sixty years — '
      + 'the versions disagree with each other on at least two exercises, and nobody here has a '
      + 'primary source. Treat the numbers as the shape of the thing, not as his prescription.',
    goal: 'Mass and strength',
    daysPerWeek: 3,
    minutes: 65,
    level: 'Beginner',
    summary: 'Six exercises, three times a week, everything trained every time. The oldest '
      + 'programme in this list and still a completely reasonable way to start.',
    notes: 'Transcribed from published write-ups of a routine from Arnold’s early years — not '
      + 'from him, and not from anything he sells. Run it three times a week on non-consecutive '
      + 'days: Monday, Wednesday, Friday, or whatever spaces out the same way.\n\n'
      + 'The progression rule is the whole programme. When you can beat the target reps by two or '
      + 'three on every set, put the weight up. Nothing else changes for three months.\n\n'
      + 'Rest two to three minutes after squats and about ninety seconds after everything else.\n\n'
      + 'One honest modernisation: the behind-the-neck press is in here because it is in the '
      + 'original. It asks for shoulder mobility a lot of people do not have. If it hurts, press '
      + 'in front instead — you lose nothing the programme was trying to give you.',
    workouts: [
      { name: 'Golden Six', notes: 'The whole programme. Squat first, abs last, three times a '
          + 'week. Twenty working sets, about an hour.',
        exercises: [
          { name: 'Back Squat', sets: 4, notes: '10 reps. Rest 2–3 minutes — this is the one that costs you.' },
          { name: 'Barbell Bench Press', sets: 3, notes: '10 reps, wide grip.' },
          { name: 'Chin-Up', sets: 3, notes: 'As many as you can each set. Add weight when bodyweight gets easy.' },
          { name: 'Behind-the-Neck Press', sets: 4, notes: '10 reps. Press in front instead if your shoulders object — see the notes above.' },
          { name: 'Barbell Curl', sets: 3, notes: '10 reps. Strict — no swinging the bar up.' },
          { name: 'Sit-Up', sets: 3, notes: 'Knees bent, 20–25 reps.' },
        ] },
    ],
  },

  {
    id: 'preset-thurston-6day',
    name: 'Mike Thurston’s Six-Day Split',
    author: 'Mike Thurston',
    sourceName: 'Mike Thurston Workout And Diet Routine — Fitness Volt',
    sourceUrl: 'https://fitnessvolt.com/mike-thurston-workout-routine/',
    // ⚠️ NOT OFFICIAL. Transcribed from a published write-up of his training,
    // not from him. Worth knowing: he re-writes his own programme every four to
    // six weeks, so this is a snapshot of one block, not a fixed programme —
    // which is a different limitation from Nippard's (his is a fixed published
    // series and we only have half of it).
    unofficial: true,
    warning: 'Not official. Transcribed from a published write-up of his training, not from him '
      + 'and not from anything he sells. He rebuilds his own programme every four to six weeks, '
      + 'so this is one block frozen in place rather than a programme he stands behind.',
    goal: 'Hypertrophy',
    daysPerWeek: 6,
    minutes: 75,
    level: 'Intermediate',
    summary: 'One muscle group a day across five lifting days, plus a conditioning day. '
      + 'The classic bodybuilding split, done with modern exercise selection.',
    notes: 'Transcribed from a published write-up of Mike Thurston’s training — not from him. '
      + 'He changes his own programme every four to six weeks, so treat this as one block rather '
      + 'than something to run forever.\n\n'
      + 'Chest, Back, Shoulders, Legs, Arms, Conditioning, rest. Each muscle gets one long '
      + 'session a week, which is the opposite trade to the other systems here: more volume in a '
      + 'sitting, less frequency. Mostly 8–12 reps, three to four sets, with the first exercise '
      + 'of a day taken heavier.\n\n'
      + 'If you can only train four or five days, drop the conditioning day first and then the '
      + 'arm day — the presses and rows already train arms harder than most people expect.',
    workouts: [
      { name: 'Chest', notes: 'One heavy press, then incline and fly work. Reported reps: bench 6, everything else 10.',
        exercises: [
          { name: 'Barbell Bench Press', sets: 3, notes: '6 reps — the heaviest thing in the week for your chest.' },
          { name: 'Incline Dumbbell Bench Press', sets: 3, notes: '10 reps.' },
          { name: 'Incline Machine Press', sets: 3, notes: '10 reps. Written up as an incline hammer press.' },
          { name: 'Cable Crossover', sets: 3, notes: '10 reps.' },
          { name: 'Decline Dumbbell Bench Press', sets: 3, notes: '10 reps.' },
        ] },
      { name: 'Back', notes: 'Two rows, two pulldowns, and a heavy pull off pins to finish. Reported reps: 8–12.',
        exercises: [
          { name: 'Barbell Row', sets: 3, notes: '10 reps, bent over.' },
          { name: 'Wide-Grip Lat Pulldown', sets: 3, notes: '8–12 reps.' },
          { name: 'Dumbbell Row', sets: 3, notes: '8–12 reps per arm.' },
          { name: 'Straight-Arm Pulldown', sets: 3, notes: '8–12 reps. Written up as a standing cable pulldown.' },
          { name: 'Rack Pull', sets: 3, notes: '10 reps. Heavy, short range, from about knee height.' },
        ] },
      { name: 'Shoulders', notes: 'One press and then four raises — two side, two rear. Reported reps: 8–12.',
        exercises: [
          { name: 'Seated Dumbbell Shoulder Press', sets: 3, notes: '8–12 reps.' },
          { name: 'Lateral Raise', sets: 3, notes: '10 reps, seated.' },
          { name: 'Cable Lateral Raise', sets: 3, notes: '10 reps, standing.' },
          { name: 'Rear Delt Fly', sets: 3, notes: '10 reps, chest down on an incline bench.' },
          { name: 'Reverse Pec Deck', sets: 3, notes: '10 reps.' },
        ] },
      { name: 'Legs', notes: 'Hinge first rather than squat. Reported reps: 10–12.',
        exercises: [
          { name: 'Romanian Deadlift', sets: 3, notes: '10 reps.' },
          { name: 'Leg Press', sets: 3, notes: '12 reps.' },
          { name: 'Lying Leg Curl', sets: 4, notes: '10 reps.' },
          { name: 'Leg Extension', sets: 4, notes: '12 reps.' },
          { name: 'Bulgarian Split Squat', sets: 3, notes: '12 reps per leg.' },
          { name: 'Hip Thrust', sets: 3, notes: '12 reps.' },
        ] },
      { name: 'Arms', notes: 'Triceps first, then biceps. Seven exercises — the longest day here. Reported reps: 8–15.',
        exercises: [
          { name: 'Dumbbell Skull Crusher', sets: 4, notes: '10 reps, flat bench.' },
          { name: 'Triceps Pushdown', sets: 4, notes: '10 reps, cable.' },
          { name: 'Overhead Cable Extension', sets: 3, notes: '10 reps with a rope.' },
          { name: 'Bench Dip', sets: 3, notes: '15 reps, feet elevated.' },
          { name: 'Barbell Curl', sets: 4, notes: '8 reps, standing.' },
          { name: 'Hammer Curl', sets: 4, notes: '10 reps, alternating.' },
          { name: 'EZ-Bar Curl', sets: 4, notes: '10 reps, standing.' },
        ] },
      { name: 'Conditioning', notes: 'Not lifting. Written up as a HIIT day — rope, bodyweight intervals, '
          + 'and bike sprints to finish. Drop this first if the week is tight.',
        exercises: [
          { name: 'Jump Rope', sets: 1, notes: '3 minutes. Battle ropes work just as well.' },
          { name: 'Jumping Jacks', sets: 3, notes: '1 minute on, rest, repeat.' },
          { name: 'Kettlebell Swing', sets: 3, notes: '1 minute on, rest, repeat.' },
          { name: 'Sprint Intervals', sets: 1, notes: '20 minutes on a bike, hard and easy alternating.' },
        ] },
    ],
  },

  {
    id: 'preset-volume-landmarks',
    name: 'Volume Landmarks Hypertrophy',
    // ⚠️ THE AUTHOR IS US. Read the "three kinds of system" note at the top of
    // this file before changing this. Dr. Israetel's volume landmarks are his,
    // freely published, and cited below — but he did not pick these exercises,
    // did not set these numbers, and has never seen this. His name goes in
    // `basedOn`, and the screen renders that as "Follows … method", never as a
    // byline. The routine written up as HIS OWN training is built on supersets,
    // tri-sets and myo-reps, none of which this app can log, so transcribing it
    // was not an honest option — see docs/vision.md §1.5.
    author: 'Fitness Tracker',
    basedOn: {
      person: 'Dr. Mike Israetel',
      what: 'volume landmarks (MEV → MRV)',
      sourceName: 'Training Volume Landmarks for Muscle Growth — Renaissance Periodization',
      sourceUrl: 'https://rpstrength.com/expert-advice/training-volume-landmarks-muscle-growth',
    },
    sourceName: 'Training Volume Landmarks for Muscle Growth — Renaissance Periodization',
    sourceUrl: 'https://rpstrength.com/expert-advice/training-volume-landmarks-muscle-growth',
    unofficial: true,
    warning: 'These workouts are NOT Dr. Israetel’s. The METHOD is his and is freely published — '
      + 'start each muscle near the volume where it begins growing, add sets weekly, deload — but '
      + 'every exercise choice and set count below was written by this app, not by him, and he has '
      + 'never seen it. Read his article for the real thing.',
    goal: 'Hypertrophy',
    daysPerWeek: 4,
    minutes: 70,
    level: 'Intermediate',
    summary: 'Four days that grow. Start at the volume where growth begins, add a set per muscle '
      + 'each week for four weeks, then deload — the mesocycle Dr. Mike Israetel’s volume '
      + 'landmarks describe, written out as workouts you can log. Not his own training: for that, '
      + 'see Dr. Mike’s Floating Split.',
    notes: 'Not written by Dr. Mike Israetel, and not transcribed from a programme of his. The '
      + 'idea underneath is his and is published free by Renaissance Periodization; the exercises '
      + 'and set counts here are this app’s reading of it.\n\n'
      + 'If you want what he actually does, that is a separate system here — Dr. Mike’s Floating '
      + 'Split. It is a cutting programme built almost entirely from myo-reps, so this app can only '
      + 'record part of it. This one is the runnable programme; that one is the real one.\n\n'
      + 'The idea in one paragraph: for each muscle there is a weekly set count below which it '
      + 'does not grow (he calls it MEV), a range above that where it grows fastest, and a ceiling '
      + 'past which you cannot recover (MRV). You start near the bottom, climb, and reset before '
      + 'you hit the ceiling — rather than doing the same amount forever.\n\n'
      + 'How to run it. Upper A, Lower A, rest, Upper B, Lower B, rest, rest. The set counts here '
      + 'are WEEK ONE. Each week after, add one set to any muscle that recovered fine and still '
      + 'felt easy; leave alone anything that was still sore on the next session. By week four you '
      + 'should be near the most you can handle. Week five is a deload: half the sets, two thirds '
      + 'the weight, then start the whole thing again from week one’s numbers with a little more '
      + 'weight.\n\n'
      + 'How hard. Week one leaves about three reps in reserve. Week four leaves none. That ramp '
      + 'is doing as much work as the added sets.\n\n'
      + 'Why the arms look under-trained: they are not. Every press trains triceps and every row '
      + 'and pulldown trains biceps, and those sets count towards the weekly total even though '
      + 'this app cannot yet add them up for you.',
    workouts: [
      { name: 'Upper A', notes: 'Chest-led. 8–12 reps on the compounds, 12–15 on the cables and '
          + 'machines. Around 20 sets — that is week one, and it is meant to feel manageable.',
        exercises: [
          { name: 'Incline Dumbbell Bench Press', sets: 3, notes: '8–12 reps. Three in reserve in week one.' },
          { name: 'Machine Chest Press', sets: 2, notes: '10–15 reps.' },
          { name: 'Wide-Grip Lat Pulldown', sets: 3, notes: '8–12 reps.' },
          { name: 'Chest-Supported Row', sets: 3, notes: '10–12 reps. Chest on the pad — no body English to hide behind.' },
          { name: 'Cable Lateral Raise', sets: 3, notes: '12–20 reps. Side delts take more volume than almost anything else.' },
          { name: 'Cable Curl', sets: 3, notes: '10–15 reps.' },
          { name: 'Overhead Cable Extension', sets: 3, notes: '10–15 reps. Overhead is what loads the long head.' },
        ] },
      { name: 'Lower A', notes: 'Squat-led. Around 18 sets in week one.',
        exercises: [
          { name: 'Back Squat', sets: 3, notes: '6–10 reps.' },
          { name: 'Leg Press', sets: 3, notes: '10–15 reps.' },
          { name: 'Seated Leg Curl', sets: 3, notes: '10–15 reps. Seated beats lying here — the hamstring is stretched at the hip.' },
          { name: 'Hip Thrust', sets: 2, notes: '8–12 reps.' },
          { name: 'Standing Calf Raise', sets: 4, notes: '10–15 reps. Pause at the bottom.' },
          { name: 'Cable Crunch', sets: 3, notes: '10–20 reps.' },
        ] },
      { name: 'Upper B', notes: 'The same muscles, different exercises and angles. Around 22 sets '
          + 'in week one — the longer of the two upper days.',
        exercises: [
          { name: 'Barbell Bench Press', sets: 3, notes: '6–10 reps.' },
          { name: 'Cable Fly', sets: 2, notes: '12–20 reps. Load the stretch.' },
          { name: 'Neutral-Grip Pull-Up', sets: 3, notes: '6–12 reps. Assisted or lat pulldown if you cannot get six.' },
          { name: 'Seated Cable Row', sets: 3, notes: '10–15 reps.' },
          { name: 'Machine Lateral Raise', sets: 3, notes: '12–20 reps.' },
          { name: 'Reverse Pec Deck', sets: 2, notes: '12–20 reps.' },
          { name: 'Incline Dumbbell Curl', sets: 3, notes: '10–15 reps. The incline is the stretch.' },
          { name: 'Rope Pushdown', sets: 3, notes: '10–15 reps.' },
        ] },
      { name: 'Lower B', notes: 'Hinge-led, and the quad work is machine-based so the second leg '
          + 'day does not fight the first. Around 19 sets in week one.',
        exercises: [
          { name: 'Romanian Deadlift', sets: 3, notes: '8–12 reps. Hinge — stop before your back rounds.' },
          { name: 'Hack Squat', sets: 3, notes: '8–12 reps.' },
          { name: 'Leg Extension', sets: 3, notes: '12–20 reps.' },
          { name: 'Lying Leg Curl', sets: 3, notes: '10–15 reps.' },
          { name: 'Seated Calf Raise', sets: 4, notes: '12–20 reps.' },
          { name: 'Hanging Leg Raise', sets: 3, notes: '8–15 reps.' },
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
