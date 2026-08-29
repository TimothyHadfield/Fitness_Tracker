// Movement families — which exercises can reasonably stand in for each other.
//
// Tim, 2026-08-30: "categorize similar exercises together, and when the user
// clicks on 'swap' it will show them a few alternative exercises that will
// achieve the same or similar result as doing the exercise they chose. For
// example many exercises have dumbell, barbell, machine, different positioned,
// bodyweight, banded, etc. variants that you might be able to reasonably
// replace that exercise with."
//
// Pure: no DOM, no store.
//
// ── WHAT A FAMILY IS, AND WHAT IT IS NOT ─────────────────────────────────────
//
// A family is a MOVEMENT PATTERN, not a muscle group. `js/exercises.js` already
// answers "what does this train"; nothing answered "what could I do instead".
// Those are different questions and the second one is the useful one at 6pm
// when the rack is taken.
//
// ⚠️ HAND-WRITTEN, NOT DERIVED FROM THE NAME. Stripping "Dumbbell" / "Incline"
// / "Machine" off a name and grouping what is left would look clever, work for
// the bench press, and be wrong quietly: "Dumbbell Pullover" is not a pullover
// press, "Cable Kickback" is two different exercises, and "Close-Grip Bench
// Press" is a triceps builder wearing a chest exercise's name. Every membership
// below is a judgement somebody made, and `tests/data-layer.test.mjs` asserts
// each one resolves to exactly one real exercise.
//
// ⚠️ ONE FAMILY PER EXERCISE, asserted. Several could honestly sit in two —
// Close-Grip Bench Press is a horizontal press AND a triceps press — and the
// one-family rule is what keeps "alternatives" from quietly becoming "anything
// that shares a word with this". Where an exercise is split between two, it
// goes in the one you would swap it FOR.
//
// ⚠️ AND SOME EXERCISES DELIBERATELY HAVE NO FAMILY. Hip Adduction Machine is
// not a substitute for Hip Abduction — it is the OPPOSITE movement, and putting
// them together because the machines look alike would be the single most
// misleading suggestion this file could make. Same for Neck Curl against Neck
// Extension, and for Tibialis Raise against the calf raises. Those fall back to
// "same muscle group", which the screen labels differently and honestly.
//
// ⚠️ FAMILIES MAY CROSS MUSCLE GROUPS, on purpose. Reverse Curl is filed under
// Forearms and belongs with the hammer curls; Straight-Arm Pulldown is Back and
// belongs with the pullovers. The alternative rows show the muscle group, so a
// reader can see the swap changes what the app credits.

/**
 * A member is an exercise NAME. Where a name is ambiguous in the library it is
 * written `Name|Muscle` — there is currently exactly one such case, `Cable
 * Kickback`, which exists for both Triceps and Glutes. A test fails if any
 * member resolves to zero or to more than one exercise, so a future duplicate
 * name cannot silently point the wrong way.
 */
export const FAMILIES = [
  // ---------- pressing ----------
  {
    id: 'press-flat',
    label: 'Flat pressing',
    members: ['Barbell Bench Press', 'Dumbbell Bench Press', 'Machine Chest Press',
      'Smith Machine Bench Press', 'Floor Press', 'Larsen Press', 'Push-Up',
      'Wide-Grip Push-Up', 'Incline Push-Up', 'Dumbbell Squeeze Press'],
  },
  {
    // ⚠️ Decline Push-Up lives here and it is not a typo: feet ELEVATED puts the
    // torso at an incline relative to the load, which is the upper-chest
    // emphasis an incline press gives. The name describes the body; the family
    // describes the movement.
    id: 'press-incline',
    label: 'Incline pressing',
    members: ['Incline Barbell Bench Press', 'Incline Dumbbell Bench Press',
      'Incline Machine Press', 'Close-Grip Incline Bench Press', 'Decline Push-Up',
      'Smith Machine Incline Bench Press'],
  },
  {
    id: 'press-decline',
    label: 'Decline pressing',
    members: ['Decline Barbell Bench Press', 'Decline Dumbbell Bench Press', 'Chest Dip',
      // The two dip machines, added 2026-08-31. Somebody who cannot do a dip
      // wants the assisted one, and somebody whose gym has no dip station
      // wants the seated machine — which is exactly what this list is for.
      'Assisted Dip', 'Machine Dip'],
  },
  {
    id: 'chest-fly',
    label: 'Chest flyes',
    members: ['Dumbbell Fly', 'Incline Dumbbell Fly', 'Pec Deck', 'Cable Fly',
      'Low-to-High Cable Fly', 'High-to-Low Cable Fly', 'Bent-Over Cable Fly',
      'Cable Crossover', 'Cable Press Around', 'Svend Press', 'Machine Fly'],
  },
  {
    id: 'pullover',
    label: 'Pullovers',
    members: ['Dumbbell Pullover', 'Cable Pullover', 'Straight-Arm Pulldown',
      'Machine Pullover'],
  },
  {
    id: 'press-overhead',
    label: 'Overhead pressing',
    members: ['Overhead Press', 'Seated Barbell Overhead Press', 'Push Press',
      'Behind-the-Neck Press', 'Dumbbell Shoulder Press', 'Seated Dumbbell Shoulder Press',
      'Arnold Press', 'Machine Shoulder Press', 'Smith Machine Overhead Press',
      'Landmine Press', 'Z Press', 'Pike Push-Up', 'Handstand Push-Up'],
  },

  // ---------- pulling ----------
  {
    id: 'pull-vertical',
    label: 'Vertical pulling',
    members: ['Pull-Up', 'Chin-Up', 'Neutral-Grip Pull-Up', 'Wide-Grip Pull-Up',
      'Assisted Pull-Up', 'Lat Pulldown', 'Wide-Grip Lat Pulldown',
      'Close-Grip Lat Pulldown', 'Reverse-Grip Lat Pulldown', 'Single-Arm Lat Pulldown',
      'Assisted Chin-Up'],
  },
  {
    id: 'row',
    label: 'Rowing',
    members: ['Barbell Row', 'Pendlay Row', 'Yates Row', 'T-Bar Row',
      'Chest-Supported Row', 'Seal Row', 'Dumbbell Row', 'Chest-Supported Dumbbell Row',
      'Meadows Row', 'Kroc Row', 'Seated Cable Row', 'Wide-Grip Seated Row',
      'Machine Row', 'Hammer Strength Row', 'Inverted Row', 'Smith Machine Row',
      'Landmine Row', 'Single-Arm Cable Row'],
  },
  {
    id: 'deadlift',
    label: 'Deadlifts',
    members: ['Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift', 'Rack Pull',
      'Deficit Deadlift'],
  },
  {
    // ⚠️ NOT the same family as the deadlifts, though it looks like it. A
    // deadlift starts from the floor and is a whole-body pull; a hinge is a
    // hamstring movement that never touches down. muscle-evidence.js prices
    // them differently for the same reason.
    id: 'hip-hinge',
    label: 'Hip hinges',
    members: ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Stiff-Leg Deadlift',
      'Single-Leg Romanian Deadlift', 'Good Morning', 'Cable Pull-Through',
      'Kettlebell Swing', 'Deficit Romanian Deadlift'],
  },
  {
    id: 'back-extension',
    label: 'Back extensions',
    members: ['Back Extension', '45-Degree Hyperextension', 'Reverse Hyperextension'],
  },

  // ---------- shoulders ----------
  {
    id: 'lateral-raise',
    label: 'Lateral raises',
    members: ['Lateral Raise', 'Cable Lateral Raise', 'Machine Lateral Raise',
      'Leaning Lateral Raise', 'Cross-Body Cable Y-Raise', 'Upright Row',
      'Cable Upright Row', 'Seated Lateral Raise', 'Dumbbell Upright Row'],
  },
  {
    id: 'front-raise',
    label: 'Front raises',
    members: ['Front Raise', 'Plate Front Raise', 'Cable Front Raise', 'Barbell Front Raise'],
  },
  {
    id: 'rear-delt',
    label: 'Rear delt work',
    members: ['Rear Delt Fly', 'Reverse Pec Deck', 'Cable Rear Delt Fly', 'Face Pull',
      'Machine Rear Delt Fly'],
  },
  {
    id: 'shrug',
    label: 'Shrugs',
    members: ['Barbell Shrug', 'Dumbbell Shrug', 'Trap Bar Shrug', 'Cable Shrug',
      'Machine Shrug', 'Smith Machine Shrug', 'Behind-the-Back Barbell Shrug',
      'Snatch-Grip Barbell Shrug', 'Incline Dumbbell Shrug'],
  },
  {
    id: 'carry',
    label: 'Loaded carries',
    members: ['Farmer Carry', 'Overhead Carry', 'Suitcase Carry', 'Trap Bar Carry'],
  },

  // ---------- arms ----------
  {
    id: 'curl',
    label: 'Curls',
    members: ['Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Alternating Dumbbell Curl',
      'Cable Curl', 'Drag Curl', '21s', 'Machine Curl', 'Seated Dumbbell Curl'],
  },
  {
    // The brachialis / forearm-biased curls. Reverse Curl and Cable Reverse
    // Curl are filed under Forearms in the library and belong here.
    id: 'curl-neutral',
    label: 'Hammer and reverse curls',
    members: ['Hammer Curl', 'Cross-Body Hammer Curl', 'Cable Rope Hammer Curl',
      'Zottman Curl', 'Reverse Curl', 'Cable Reverse Curl', 'EZ-Bar Reverse Curl'],
  },
  {
    id: 'curl-supported',
    label: 'Supported curls',
    members: ['Preacher Curl', 'Dumbbell Preacher Curl', 'Machine Preacher Curl',
      'Concentration Curl', 'Spider Curl', 'Incline Dumbbell Curl', 'Bayesian Cable Curl'],
  },
  {
    id: 'triceps-pushdown',
    label: 'Triceps pushdowns',
    members: ['Triceps Pushdown', 'Rope Pushdown', 'V-Bar Pushdown',
      'Reverse-Grip Pushdown', 'Machine Triceps Extension', 'Triceps Kickback',
      'Cable Kickback|Triceps', 'Single-Arm Cable Pushdown'],
  },
  {
    id: 'triceps-extension',
    label: 'Overhead triceps extensions',
    members: ['Overhead Cable Extension', 'Overhead Dumbbell Extension',
      'Cross-Body Cable Triceps Extension', 'Skull Crusher', 'Dumbbell Skull Crusher',
      'Tate Press', 'Rope Overhead Extension', 'EZ-Bar Skull Crusher'],
  },
  {
    // Triceps-dominant PRESSING, which is a different job from an extension —
    // it loads heavier and it is what somebody swaps a close-grip bench for.
    id: 'triceps-press',
    label: 'Triceps pressing',
    members: ['Close-Grip Bench Press', 'JM Press', 'California Press', 'Triceps Dip',
      'Bench Dip', 'Diamond Push-Up'],
  },
  {
    id: 'wrist-curl',
    label: 'Wrist work',
    members: ['Wrist Curl', 'Reverse Wrist Curl', 'Behind-the-Back Wrist Curl',
      'Wrist Roller', 'Dumbbell Wrist Curl'],
  },
  {
    id: 'grip-hold',
    label: 'Grip holds',
    members: ['Plate Pinch Hold', 'Dead Hang', 'Barbell Hold'],
  },

  // ---------- legs ----------
  {
    // ⚠️ The leg presses are IN here rather than in a family of their own, and
    // that is the whole feature working: "the squat rack is taken" is the
    // commonest reason anybody opens this list, and the leg press is the answer.
    id: 'squat',
    label: 'Squats and presses',
    members: ['Back Squat', 'Front Squat', 'High-Bar Squat', 'Low-Bar Squat',
      'Box Squat', 'Pause Squat', 'Safety Bar Squat', 'Zercher Squat',
      'Smith Machine Squat', 'Hack Squat', 'Pendulum Squat', 'Belt Squat',
      'Leg Press', 'Single-Leg Press', 'Goblet Squat', 'Bodyweight Squat',
      'Sumo Squat', 'Seated Leg Press', 'Landmine Squat'],
  },
  {
    id: 'lunge',
    label: 'Lunges and split squats',
    members: ['Bulgarian Split Squat', 'Split Squat', 'Walking Lunge', 'Reverse Lunge',
      'Forward Lunge', 'Curtsy Lunge', 'Step-Up', 'Cossack Squat',
      'Barbell Bulgarian Split Squat', 'Barbell Lunge'],
  },
  {
    id: 'leg-extension',
    label: 'Knee extensions',
    members: ['Leg Extension', 'Single-Leg Extension', 'Sissy Squat', 'Wall Sit'],
  },
  {
    id: 'leg-curl',
    label: 'Leg curls',
    members: ['Lying Leg Curl', 'Seated Leg Curl', 'Standing Leg Curl',
      'Nordic Hamstring Curl', 'Glute-Ham Raise', 'Slider Leg Curl', 'Cable Leg Curl'],
  },
  {
    id: 'hip-thrust',
    label: 'Hip thrusts and bridges',
    members: ['Hip Thrust', 'Single-Leg Hip Thrust', 'Glute Bridge', 'Machine Hip Thrust',
      'Frog Pump', 'B-Stance Hip Thrust', 'Smith Machine Hip Thrust'],
  },
  {
    id: 'glute-kickback',
    label: 'Glute kickbacks',
    members: ['Cable Kickback|Glutes', 'Machine Glute Kickback'],
  },
  {
    // ⚠️ Hip ADDUCTION is deliberately absent — it is the opposite movement on
    // a machine that looks the same, and suggesting it here would be the most
    // misleading row this file could produce.
    id: 'hip-abduction',
    label: 'Hip abduction',
    members: ['Hip Abduction Machine', 'Banded Hip Abduction'],
  },
  {
    // Seated calf raises bias the soleus and standing ones the gastrocnemius,
    // so these are not identical — but they are the same movement on different
    // equipment, which is what somebody swapping wants.
    id: 'calf-raise',
    label: 'Calf raises',
    members: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise',
      'Smith Machine Calf Raise', 'Dumbbell Calf Raise', 'Single-Leg Calf Raise',
      'Donkey Calf Raise', 'Seated Dumbbell Calf Raise', 'Barbell Calf Raise'],
  },

  // ---------- core ----------
  {
    id: 'core-hold',
    label: 'Core holds',
    members: ['Plank', 'Side Plank', 'RKC Plank', 'Hollow Body Hold', 'Copenhagen Plank',
      'Dead Bug', 'Bird Dog', 'Ab Wheel Rollout', 'L-Sit', 'Dragon Flag'],
  },
  {
    id: 'core-crunch',
    label: 'Crunches and sit-ups',
    members: ['Crunch', 'Cable Crunch', 'Machine Crunch', 'Sit-Up', 'Decline Sit-Up',
      'Bicycle Crunch', 'V-Up', 'Reverse Crunch'],
  },
  {
    id: 'core-leg-raise',
    label: 'Leg raises',
    members: ['Hanging Leg Raise', 'Hanging Knee Raise', 'Captain’s Chair Leg Raise',
      'Lying Leg Raise', 'Toes to Bar', 'Flutter Kick'],
  },
  {
    id: 'core-rotation',
    label: 'Rotation and anti-rotation',
    members: ['Pallof Press', 'Cable Woodchop', 'Landmine Twist', 'Russian Twist'],
  },

  // ---------- whole body ----------
  {
    id: 'olympic',
    label: 'Olympic lifts',
    members: ['Power Clean', 'Hang Clean', 'Clean and Jerk', 'Snatch', 'Hang Snatch',
      'Power Snatch', 'Clean Pull', 'Snatch Pull', 'Thruster',
      'Kettlebell Clean and Press', 'Kettlebell Snatch'],
  },
  {
    id: 'jump',
    label: 'Jumps',
    members: ['Box Jump', 'Broad Jump'],
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    members: ['Burpee', 'Battle Ropes', 'Medicine Ball Slam', 'Tire Flip', 'Sled Push',
      'Sled Drag', 'Barbell Complex', 'Mountain Climber', 'Jumping Jacks',
      'Jump Rope', 'Sprint Intervals', 'Shadow Boxing', 'Wall Ball', 'Devil’s Press'],
  },
  {
    id: 'cardio-steady',
    label: 'Steady cardio',
    members: ['Treadmill Run', 'Running', 'Stationary Bike', 'Assault Bike',
      'Outdoor Cycling', 'Rowing Machine', 'Elliptical', 'Stair Climber', 'Ski Erg',
      'Swimming', 'Versa Climber', 'Arc Trainer'],
  },
  {
    id: 'cardio-walk',
    label: 'Walking',
    members: ['Treadmill Walk', 'Incline Treadmill Walk', 'Walking', 'Hiking', 'Stairs'],
  },
  {
    id: 'climbing',
    label: 'Climbing',
    members: ['Rock Climbing', 'Bouldering'],
  },
  {
    // Neck CURL is absent for the adduction reason — flexion and extension are
    // opposite movements.
    id: 'neck-extension',
    label: 'Neck extension',
    members: ['Neck Extension', 'Neck Harness Extension'],
  },
];

/** `Name` or `Name|Muscle` → does this member refer to this exercise? */
function memberMatches(member, ex) {
  const bar = member.indexOf('|');
  if (bar < 0) return ex.name === member;
  return ex.name === member.slice(0, bar) && ex.muscle === member.slice(bar + 1);
}

/**
 * The family an exercise belongs to, or null.
 *
 * Custom exercises never match, by construction — they are user-named and this
 * table is written against the built-in library. They fall through to the
 * muscle-group fallback, which is the honest answer for a name nobody here has
 * seen.
 */
export function familyOf(ex) {
  if (!ex) return null;
  for (const f of FAMILIES) {
    for (const m of f.members) if (memberMatches(m, ex)) return f;
  }
  return null;
}

/**
 * A few exercises that could stand in for this one.
 *
 * Returns `{ reason, familyLabel, items }` — `reason` is 'family' when these
 * are the same movement and 'muscle' when the exercise has no family and these
 * are merely the same muscle group. ⚠️ **The caller must say which**, because
 * "another way to do this movement" and "something else that trains this" are
 * different promises and only one of them is what the user asked for.
 *
 * @param exercise  the one being swapped out
 * @param all       the full library (built-ins plus this account's custom ones)
 * @param inSession ids already in today's session — marked, never hidden.
 *                  Swapping to something you are already doing is a real thing
 *                  (swap away, machine frees up, swap back — the case the
 *                  2026-08-28 duplicate-entry fix was written for), so the row
 *                  says so and lets the user decide.
 * @param limit     how many to show
 */
export function alternativesFor(exercise, all, { inSession = [], limit = 5 } = {}) {
  if (!exercise) return { reason: null, familyLabel: null, items: [] };
  const taken = new Set(inSession);
  const fam = familyOf(exercise);

  let pool;
  let reason;
  if (fam) {
    pool = all.filter((e) => e.id !== exercise.id && fam.members.some((m) => memberMatches(m, e)));
    reason = 'family';
  } else {
    pool = all.filter((e) => e.id !== exercise.id && e.muscle === exercise.muscle);
    reason = 'muscle';
  }

  // ⚠️ SAME FIELDS FIRST, THEN DIFFERENT EQUIPMENT — in that order, and the
  // order is the argument. A swap that keeps weight+reps carries the prefilled
  // numbers and the suggestion across; one that drops to reps-only throws them
  // away. Different equipment is the REASON somebody is here (the machine is
  // taken), so it ranks next. Ties fall back to library order, which is stable
  // — nothing here may use Math.random(), for the reason demo.js states.
  const sameFields = (e) => e.fields.length === exercise.fields.length
    && e.fields.every((f, i) => f === exercise.fields[i]);

  const scored = pool.map((e, i) => ({
    ex: e,
    inSession: taken.has(e.id),
    score: (sameFields(e) ? 4 : 0) + (e.equipment !== exercise.equipment ? 2 : 0),
    i,
  }));
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));

  /* ⚠️ THEN ONE PER EQUIPMENT TYPE BEFORE ANY SECOND ONE, and this step is the
   * difference between a useful list and a redundant one. Ranked on score
   * alone, a leg press offered "Back Squat, Front Squat, High-Bar Squat,
   * Low-Bar Squat, Box Squat" — five barbell squats, all correct, all the same
   * answer — while Hack Squat and Goblet Squat sat below the cut. A lat
   * pulldown offered four pull-up variants.
   *
   * Tim's own framing is the specification: "dumbbell, barbell, machine,
   * different positioned, bodyweight, banded". The question behind a swap is
   * almost always "what else can I do with what is FREE", so the five rows
   * should cover five ways of doing it rather than five names for one way.
   *
   * Groups are ordered by their best member, so the first row is still the
   * top-ranked alternative and the ordering stays deterministic. */
  const byEquipment = new Map();
  for (const s of scored) {
    if (!byEquipment.has(s.ex.equipment)) byEquipment.set(s.ex.equipment, []);
    byEquipment.get(s.ex.equipment).push(s);
  }
  const groups = [...byEquipment.values()]
    .sort((a, b) => (b[0].score - a[0].score) || (a[0].i - b[0].i));

  const items = [];
  for (let round = 0; items.length < limit; round++) {
    const before = items.length;
    for (const g of groups) {
      if (items.length >= limit) break;
      if (g[round]) items.push(g[round]);
    }
    if (items.length === before) break;   // every group exhausted
  }

  return {
    reason,
    familyLabel: fam ? fam.label : null,
    items: items.map((s) => ({ exercise: s.ex, inSession: s.inSession })),
  };
}

/** Every member string in the table, for the tests to resolve. */
export function allMembers() {
  return FAMILIES.flatMap((f) => f.members);
}
