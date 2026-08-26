// Exercise library.
// Compact tuples: [name, muscleGroup, equipment, fieldCode]
//   wr = weight + reps      r  = reps only        t  = time only
//   dt = distance + time    wt = weight + time
// Add to this list freely; ids are derived from the name so they stay stable.

const FIELDS = {
  wr: ['weight', 'reps'],
  r:  ['reps'],
  t:  ['time'],
  dt: ['distance', 'time'],
  wt: ['weight', 'time'],
};

const RAW = [
  // ---------- CHEST ----------
  ['Barbell Bench Press', 'Chest', 'Barbell', 'wr'],
  ['Incline Barbell Bench Press', 'Chest', 'Barbell', 'wr'],
  ['Decline Barbell Bench Press', 'Chest', 'Barbell', 'wr'],
  ['Close-Grip Bench Press', 'Chest', 'Barbell', 'wr'],
  ['Close-Grip Incline Bench Press', 'Chest', 'Barbell', 'wr'],
  ['Floor Press', 'Chest', 'Barbell', 'wr'],
  // Bench press with the legs off the floor — no leg drive, no arch.
  ['Larsen Press', 'Chest', 'Barbell', 'wr'],
  ['Dumbbell Bench Press', 'Chest', 'Dumbbell', 'wr'],
  ['Incline Dumbbell Bench Press', 'Chest', 'Dumbbell', 'wr'],
  ['Decline Dumbbell Bench Press', 'Chest', 'Dumbbell', 'wr'],
  ['Dumbbell Fly', 'Chest', 'Dumbbell', 'wr'],
  ['Incline Dumbbell Fly', 'Chest', 'Dumbbell', 'wr'],
  ['Dumbbell Pullover', 'Chest', 'Dumbbell', 'wr'],
  ['Machine Chest Press', 'Chest', 'Machine', 'wr'],
  ['Incline Machine Press', 'Chest', 'Machine', 'wr'],
  ['Pec Deck', 'Chest', 'Machine', 'wr'],
  ['Cable Fly', 'Chest', 'Cable', 'wr'],
  ['Low-to-High Cable Fly', 'Chest', 'Cable', 'wr'],
  ['High-to-Low Cable Fly', 'Chest', 'Cable', 'wr'],
  // Torso bent to near parallel with the floor, so the line of pull crosses the
  // mid-pec rather than the upper or lower fibres.
  ['Bent-Over Cable Fly', 'Chest', 'Cable', 'wr'],
  ['Cable Crossover', 'Chest', 'Cable', 'wr'],
  ['Cable Press Around', 'Chest', 'Cable', 'wr'],
  ['Chest Dip', 'Chest', 'Bodyweight', 'wr'],
  ['Push-Up', 'Chest', 'Bodyweight', 'r'],
  ['Incline Push-Up', 'Chest', 'Bodyweight', 'r'],
  ['Decline Push-Up', 'Chest', 'Bodyweight', 'r'],
  ['Diamond Push-Up', 'Chest', 'Bodyweight', 'r'],
  ['Wide-Grip Push-Up', 'Chest', 'Bodyweight', 'r'],
  ['Svend Press', 'Chest', 'Plate', 'wr'],
  ['Smith Machine Bench Press', 'Chest', 'Machine', 'wr'],

  // ---------- BACK ----------
  ['Deadlift', 'Back', 'Barbell', 'wr'],
  ['Sumo Deadlift', 'Back', 'Barbell', 'wr'],
  ['Trap Bar Deadlift', 'Back', 'Barbell', 'wr'],
  ['Rack Pull', 'Back', 'Barbell', 'wr'],
  ['Deficit Deadlift', 'Back', 'Barbell', 'wr'],
  ['Barbell Row', 'Back', 'Barbell', 'wr'],
  ['Pendlay Row', 'Back', 'Barbell', 'wr'],
  ['Yates Row', 'Back', 'Barbell', 'wr'],
  ['T-Bar Row', 'Back', 'Barbell', 'wr'],
  ['Chest-Supported Row', 'Back', 'Machine', 'wr'],
  ['Seal Row', 'Back', 'Barbell', 'wr'],
  ['Dumbbell Row', 'Back', 'Dumbbell', 'wr'],
  ['Chest-Supported Dumbbell Row', 'Back', 'Dumbbell', 'wr'],
  ['Meadows Row', 'Back', 'Barbell', 'wr'],
  // Heavy, slightly loose one-arm dumbbell row for high reps.
  ['Kroc Row', 'Back', 'Dumbbell', 'wr'],
  ['Pull-Up', 'Back', 'Bodyweight', 'wr'],
  ['Chin-Up', 'Back', 'Bodyweight', 'wr'],
  ['Neutral-Grip Pull-Up', 'Back', 'Bodyweight', 'wr'],
  ['Wide-Grip Pull-Up', 'Back', 'Bodyweight', 'wr'],
  ['Assisted Pull-Up', 'Back', 'Machine', 'wr'],
  ['Lat Pulldown', 'Back', 'Cable', 'wr'],
  ['Wide-Grip Lat Pulldown', 'Back', 'Cable', 'wr'],
  ['Close-Grip Lat Pulldown', 'Back', 'Cable', 'wr'],
  ['Reverse-Grip Lat Pulldown', 'Back', 'Cable', 'wr'],
  ['Single-Arm Lat Pulldown', 'Back', 'Cable', 'wr'],
  ['Seated Cable Row', 'Back', 'Cable', 'wr'],
  ['Wide-Grip Seated Row', 'Back', 'Cable', 'wr'],
  ['Straight-Arm Pulldown', 'Back', 'Cable', 'wr'],
  ['Cable Pullover', 'Back', 'Cable', 'wr'],
  ['Machine Row', 'Back', 'Machine', 'wr'],
  ['Hammer Strength Row', 'Back', 'Machine', 'wr'],
  ['Inverted Row', 'Back', 'Bodyweight', 'r'],
  ['Good Morning', 'Back', 'Barbell', 'wr'],
  ['Back Extension', 'Back', 'Bodyweight', 'wr'],
  ['45-Degree Hyperextension', 'Back', 'Bodyweight', 'wr'],
  ['Reverse Hyperextension', 'Back', 'Machine', 'wr'],

  // ---------- SHOULDERS ----------
  ['Overhead Press', 'Shoulders', 'Barbell', 'wr'],
  ['Seated Barbell Overhead Press', 'Shoulders', 'Barbell', 'wr'],
  ['Push Press', 'Shoulders', 'Barbell', 'wr'],
  ['Behind-the-Neck Press', 'Shoulders', 'Barbell', 'wr'],
  ['Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'wr'],
  ['Seated Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'wr'],
  ['Arnold Press', 'Shoulders', 'Dumbbell', 'wr'],
  ['Machine Shoulder Press', 'Shoulders', 'Machine', 'wr'],
  ['Smith Machine Overhead Press', 'Shoulders', 'Machine', 'wr'],
  ['Lateral Raise', 'Shoulders', 'Dumbbell', 'wr'],
  ['Cable Lateral Raise', 'Shoulders', 'Cable', 'wr'],
  ['Cross-Body Cable Y-Raise', 'Shoulders', 'Cable', 'wr'],
  ['Machine Lateral Raise', 'Shoulders', 'Machine', 'wr'],
  ['Leaning Lateral Raise', 'Shoulders', 'Dumbbell', 'wr'],
  ['Front Raise', 'Shoulders', 'Dumbbell', 'wr'],
  ['Plate Front Raise', 'Shoulders', 'Plate', 'wr'],
  ['Cable Front Raise', 'Shoulders', 'Cable', 'wr'],
  ['Rear Delt Fly', 'Shoulders', 'Dumbbell', 'wr'],
  ['Reverse Pec Deck', 'Shoulders', 'Machine', 'wr'],
  ['Cable Rear Delt Fly', 'Shoulders', 'Cable', 'wr'],
  ['Face Pull', 'Shoulders', 'Cable', 'wr'],
  ['Upright Row', 'Shoulders', 'Barbell', 'wr'],
  ['Cable Upright Row', 'Shoulders', 'Cable', 'wr'],
  ['Landmine Press', 'Shoulders', 'Barbell', 'wr'],
  ['Z Press', 'Shoulders', 'Barbell', 'wr'],
  ['Pike Push-Up', 'Shoulders', 'Bodyweight', 'r'],
  ['Handstand Push-Up', 'Shoulders', 'Bodyweight', 'r'],

  // ---------- TRAPS ----------
  ['Barbell Shrug', 'Traps', 'Barbell', 'wr'],
  ['Dumbbell Shrug', 'Traps', 'Dumbbell', 'wr'],
  ['Trap Bar Shrug', 'Traps', 'Barbell', 'wr'],
  ['Cable Shrug', 'Traps', 'Cable', 'wr'],
  ['Machine Shrug', 'Traps', 'Machine', 'wr'],
  ['Farmer Carry', 'Traps', 'Dumbbell', 'wt'],
  ['Overhead Carry', 'Traps', 'Dumbbell', 'wt'],

  // ---------- BICEPS ----------
  ['Barbell Curl', 'Biceps', 'Barbell', 'wr'],
  ['EZ-Bar Curl', 'Biceps', 'Barbell', 'wr'],
  ['Dumbbell Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Alternating Dumbbell Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Hammer Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Cross-Body Hammer Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Preacher Curl', 'Biceps', 'Barbell', 'wr'],
  ['Dumbbell Preacher Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Machine Preacher Curl', 'Biceps', 'Machine', 'wr'],
  ['Concentration Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Cable Curl', 'Biceps', 'Cable', 'wr'],
  ['Cable Rope Hammer Curl', 'Biceps', 'Cable', 'wr'],
  ['Bayesian Cable Curl', 'Biceps', 'Cable', 'wr'],
  ['Spider Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Zottman Curl', 'Biceps', 'Dumbbell', 'wr'],
  ['Drag Curl', 'Biceps', 'Barbell', 'wr'],
  ['21s', 'Biceps', 'Barbell', 'wr'],

  // ---------- TRICEPS ----------
  ['Triceps Pushdown', 'Triceps', 'Cable', 'wr'],
  ['Rope Pushdown', 'Triceps', 'Cable', 'wr'],
  ['V-Bar Pushdown', 'Triceps', 'Cable', 'wr'],
  ['Reverse-Grip Pushdown', 'Triceps', 'Cable', 'wr'],
  ['Overhead Cable Extension', 'Triceps', 'Cable', 'wr'],
  ['Cross-Body Cable Triceps Extension', 'Triceps', 'Cable', 'wr'],
  ['Overhead Dumbbell Extension', 'Triceps', 'Dumbbell', 'wr'],
  ['Skull Crusher', 'Triceps', 'Barbell', 'wr'],
  ['Dumbbell Skull Crusher', 'Triceps', 'Dumbbell', 'wr'],
  ['JM Press', 'Triceps', 'Barbell', 'wr'],
  ['Triceps Dip', 'Triceps', 'Bodyweight', 'wr'],
  ['Bench Dip', 'Triceps', 'Bodyweight', 'r'],
  ['Machine Triceps Extension', 'Triceps', 'Machine', 'wr'],
  ['Triceps Kickback', 'Triceps', 'Dumbbell', 'wr'],
  ['Cable Kickback', 'Triceps', 'Cable', 'wr'],
  ['Tate Press', 'Triceps', 'Dumbbell', 'wr'],
  ['California Press', 'Triceps', 'Barbell', 'wr'],

  // ---------- FOREARMS ----------
  ['Wrist Curl', 'Forearms', 'Barbell', 'wr'],
  ['Reverse Wrist Curl', 'Forearms', 'Barbell', 'wr'],
  ['Reverse Curl', 'Forearms', 'Barbell', 'wr'],
  ['Cable Reverse Curl', 'Forearms', 'Cable', 'wr'],
  ['Behind-the-Back Wrist Curl', 'Forearms', 'Barbell', 'wr'],
  ['Plate Pinch Hold', 'Forearms', 'Plate', 'wt'],
  ['Dead Hang', 'Forearms', 'Bodyweight', 't'],
  ['Wrist Roller', 'Forearms', 'Other', 'wt'],

  // ---------- QUADS ----------
  ['Back Squat', 'Quads', 'Barbell', 'wr'],
  ['Front Squat', 'Quads', 'Barbell', 'wr'],
  ['High-Bar Squat', 'Quads', 'Barbell', 'wr'],
  ['Low-Bar Squat', 'Quads', 'Barbell', 'wr'],
  ['Box Squat', 'Quads', 'Barbell', 'wr'],
  ['Pause Squat', 'Quads', 'Barbell', 'wr'],
  ['Safety Bar Squat', 'Quads', 'Barbell', 'wr'],
  ['Zercher Squat', 'Quads', 'Barbell', 'wr'],
  ['Smith Machine Squat', 'Quads', 'Machine', 'wr'],
  ['Hack Squat', 'Quads', 'Machine', 'wr'],
  ['Pendulum Squat', 'Quads', 'Machine', 'wr'],
  ['Leg Press', 'Quads', 'Machine', 'wr'],
  ['Single-Leg Press', 'Quads', 'Machine', 'wr'],
  ['Leg Extension', 'Quads', 'Machine', 'wr'],
  ['Single-Leg Extension', 'Quads', 'Machine', 'wr'],
  ['Goblet Squat', 'Quads', 'Dumbbell', 'wr'],
  ['Bulgarian Split Squat', 'Quads', 'Dumbbell', 'wr'],
  ['Split Squat', 'Quads', 'Dumbbell', 'wr'],
  ['Walking Lunge', 'Quads', 'Dumbbell', 'wr'],
  ['Reverse Lunge', 'Quads', 'Dumbbell', 'wr'],
  ['Forward Lunge', 'Quads', 'Dumbbell', 'wr'],
  ['Curtsy Lunge', 'Quads', 'Dumbbell', 'wr'],
  ['Step-Up', 'Quads', 'Dumbbell', 'wr'],
  ['Sissy Squat', 'Quads', 'Bodyweight', 'r'],
  ['Wall Sit', 'Quads', 'Bodyweight', 't'],
  ['Bodyweight Squat', 'Quads', 'Bodyweight', 'r'],
  ['Belt Squat', 'Quads', 'Machine', 'wr'],

  // ---------- HAMSTRINGS ----------
  ['Romanian Deadlift', 'Hamstrings', 'Barbell', 'wr'],
  ['Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell', 'wr'],
  ['Stiff-Leg Deadlift', 'Hamstrings', 'Barbell', 'wr'],
  ['Single-Leg Romanian Deadlift', 'Hamstrings', 'Dumbbell', 'wr'],
  ['Lying Leg Curl', 'Hamstrings', 'Machine', 'wr'],
  ['Seated Leg Curl', 'Hamstrings', 'Machine', 'wr'],
  ['Standing Leg Curl', 'Hamstrings', 'Machine', 'wr'],
  ['Nordic Hamstring Curl', 'Hamstrings', 'Bodyweight', 'r'],
  ['Glute-Ham Raise', 'Hamstrings', 'Bodyweight', 'wr'],
  ['Cable Pull-Through', 'Hamstrings', 'Cable', 'wr'],
  ['Kettlebell Swing', 'Hamstrings', 'Kettlebell', 'wr'],
  ['Slider Leg Curl', 'Hamstrings', 'Bodyweight', 'r'],

  // ---------- GLUTES ----------
  ['Hip Thrust', 'Glutes', 'Barbell', 'wr'],
  ['Single-Leg Hip Thrust', 'Glutes', 'Bodyweight', 'wr'],
  ['Glute Bridge', 'Glutes', 'Barbell', 'wr'],
  ['Machine Hip Thrust', 'Glutes', 'Machine', 'wr'],
  ['Cable Kickback', 'Glutes', 'Cable', 'wr'],
  ['Machine Glute Kickback', 'Glutes', 'Machine', 'wr'],
  ['Hip Abduction Machine', 'Glutes', 'Machine', 'wr'],
  ['Banded Hip Abduction', 'Glutes', 'Band', 'r'],
  ['Hip Adduction Machine', 'Glutes', 'Machine', 'wr'],
  ['Frog Pump', 'Glutes', 'Bodyweight', 'r'],
  ['Sumo Squat', 'Glutes', 'Dumbbell', 'wr'],
  ['Cossack Squat', 'Glutes', 'Bodyweight', 'wr'],

  // ---------- CALVES ----------
  ['Standing Calf Raise', 'Calves', 'Machine', 'wr'],
  ['Seated Calf Raise', 'Calves', 'Machine', 'wr'],
  ['Leg Press Calf Raise', 'Calves', 'Machine', 'wr'],
  ['Smith Machine Calf Raise', 'Calves', 'Machine', 'wr'],
  ['Dumbbell Calf Raise', 'Calves', 'Dumbbell', 'wr'],
  ['Single-Leg Calf Raise', 'Calves', 'Bodyweight', 'wr'],
  ['Donkey Calf Raise', 'Calves', 'Machine', 'wr'],
  ['Tibialis Raise', 'Calves', 'Bodyweight', 'r'],

  // ---------- CORE ----------
  ['Plank', 'Core', 'Bodyweight', 't'],
  ['Side Plank', 'Core', 'Bodyweight', 't'],
  ['RKC Plank', 'Core', 'Bodyweight', 't'],
  ['Hollow Body Hold', 'Core', 'Bodyweight', 't'],
  ['Dead Bug', 'Core', 'Bodyweight', 'r'],
  ['Bird Dog', 'Core', 'Bodyweight', 'r'],
  ['Crunch', 'Core', 'Bodyweight', 'r'],
  ['Cable Crunch', 'Core', 'Cable', 'wr'],
  ['Machine Crunch', 'Core', 'Machine', 'wr'],
  ['Sit-Up', 'Core', 'Bodyweight', 'r'],
  ['Decline Sit-Up', 'Core', 'Bodyweight', 'wr'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight', 'r'],
  ['Hanging Knee Raise', 'Core', 'Bodyweight', 'r'],
  ['Captain’s Chair Leg Raise', 'Core', 'Bodyweight', 'r'],
  ['Lying Leg Raise', 'Core', 'Bodyweight', 'r'],
  ['Toes to Bar', 'Core', 'Bodyweight', 'r'],
  ['Ab Wheel Rollout', 'Core', 'Other', 'r'],
  ['Russian Twist', 'Core', 'Plate', 'wr'],
  ['Pallof Press', 'Core', 'Cable', 'wr'],
  ['Cable Woodchop', 'Core', 'Cable', 'wr'],
  ['Landmine Twist', 'Core', 'Barbell', 'wr'],
  ['Mountain Climber', 'Core', 'Bodyweight', 't'],
  ['Bicycle Crunch', 'Core', 'Bodyweight', 'r'],
  ['Flutter Kick', 'Core', 'Bodyweight', 't'],
  ['V-Up', 'Core', 'Bodyweight', 'r'],
  ['Suitcase Carry', 'Core', 'Dumbbell', 'wt'],
  ['Copenhagen Plank', 'Core', 'Bodyweight', 't'],
  ['Reverse Crunch', 'Core', 'Bodyweight', 'r'],

  // ---------- OLYMPIC / POWER ----------
  ['Power Clean', 'Full Body', 'Barbell', 'wr'],
  ['Hang Clean', 'Full Body', 'Barbell', 'wr'],
  ['Clean and Jerk', 'Full Body', 'Barbell', 'wr'],
  ['Snatch', 'Full Body', 'Barbell', 'wr'],
  ['Hang Snatch', 'Full Body', 'Barbell', 'wr'],
  ['Power Snatch', 'Full Body', 'Barbell', 'wr'],
  ['Clean Pull', 'Full Body', 'Barbell', 'wr'],
  ['Snatch Pull', 'Full Body', 'Barbell', 'wr'],
  ['Thruster', 'Full Body', 'Barbell', 'wr'],
  ['Barbell Complex', 'Full Body', 'Barbell', 'wr'],
  ['Box Jump', 'Full Body', 'Bodyweight', 'r'],
  ['Broad Jump', 'Full Body', 'Bodyweight', 'r'],
  ['Burpee', 'Full Body', 'Bodyweight', 'r'],
  ['Kettlebell Clean and Press', 'Full Body', 'Kettlebell', 'wr'],
  ['Turkish Get-Up', 'Full Body', 'Kettlebell', 'wr'],
  ['Kettlebell Snatch', 'Full Body', 'Kettlebell', 'wr'],
  ['Medicine Ball Slam', 'Full Body', 'Other', 'wr'],
  ['Sled Push', 'Full Body', 'Other', 'wt'],
  ['Sled Drag', 'Full Body', 'Other', 'wt'],
  ['Battle Ropes', 'Full Body', 'Other', 't'],
  ['Tire Flip', 'Full Body', 'Other', 'r'],

  // ---------- CARDIO ----------
  ['Running', 'Cardio', 'Other', 'dt'],
  ['Treadmill Run', 'Cardio', 'Machine', 'dt'],
  ['Treadmill Walk', 'Cardio', 'Machine', 'dt'],
  ['Incline Treadmill Walk', 'Cardio', 'Machine', 'dt'],
  ['Outdoor Cycling', 'Cardio', 'Other', 'dt'],
  ['Stationary Bike', 'Cardio', 'Machine', 'dt'],
  ['Assault Bike', 'Cardio', 'Machine', 'dt'],
  ['Rowing Machine', 'Cardio', 'Machine', 'dt'],
  ['Elliptical', 'Cardio', 'Machine', 'dt'],
  ['Stair Climber', 'Cardio', 'Machine', 'dt'],
  ['Swimming', 'Cardio', 'Other', 'dt'],
  // Added 2026-08-26 with the Record activity chooser: the non-lifting
  // activities Tim named. Filed under Cardio because that is this library's
  // "recorded, never rated" group — the honest slot until a dedicated
  // Activity group exists (docs/activities-plan.md §4). Climbing is
  // time-only: nobody logs a distance up a wall.
  ['Walking', 'Cardio', 'Other', 'dt'],
  ['Rock Climbing', 'Cardio', 'Other', 't'],
  ['Bouldering', 'Cardio', 'Other', 't'],
  ['Jump Rope', 'Cardio', 'Other', 't'],
  ['Ski Erg', 'Cardio', 'Machine', 'dt'],
  ['Hiking', 'Cardio', 'Other', 'dt'],
  ['Stairs', 'Cardio', 'Other', 't'],
  ['Sprint Intervals', 'Cardio', 'Other', 't'],
  ['Shadow Boxing', 'Cardio', 'Other', 't'],
  ['Jumping Jacks', 'Cardio', 'Bodyweight', 'r'],

  // ---------- NECK ----------
  ['Neck Curl', 'Neck', 'Other', 'wr'],
  ['Neck Extension', 'Neck', 'Other', 'wr'],
  ['Neck Harness Extension', 'Neck', 'Other', 'wr'],
];

export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Traps', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body', 'Cardio', 'Neck',
];

export const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight',
  'Kettlebell', 'Band', 'Plate', 'Other',
];

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ------------------------------------------------------------------ *
 * How the weight is counted.
 *
 *   'per_side' — the number you enter is the load on ONE side.
 *                Two 50 lb dumbbells = enter 50.
 *   'total'    — the number you enter is the whole load.
 *                A machine stack at 120 = enter 120.
 *
 * Default is derived from equipment; the two override lists below cover the
 * cases where equipment alone gets it wrong.
 * ------------------------------------------------------------------ */

// Held in one hand / loaded one side at a time, despite not being a dumbbell.
// Cable flys and crossovers each pull from their own stack, so the displayed
// number is per side.
const FORCE_PER_SIDE = new Set([
  'Cable Fly', 'Low-to-High Cable Fly', 'High-to-Low Cable Fly', 'Bent-Over Cable Fly',
  'Cable Crossover',
  'Cable Rear Delt Fly', 'Cable Lateral Raise', 'Bayesian Cable Curl', 'Cable Kickback',
  'Machine Lateral Raise', 'Single-Arm Lat Pulldown', 'Meadows Row', 'Landmine Press',
  'Cable Press Around', 'Cross-Body Cable Y-Raise', 'Cross-Body Cable Triceps Extension',
  'Kroc Row',
  'Suitcase Carry', 'Farmer Carry', 'Overhead Carry', 'Plate Pinch Hold',
]);

// One implement held with both hands, or a machine that moves one carriage —
// so the number is the whole load even though the equipment suggests otherwise.
const FORCE_TOTAL = new Set([
  'Goblet Squat', 'Dumbbell Pullover', 'Kettlebell Swing', 'Svend Press',
  'Russian Twist', 'Medicine Ball Slam', 'Single-Leg Press', 'Single-Leg Extension',
  'Sumo Squat', 'Single-Leg Calf Raise', 'Single-Leg Hip Thrust', 'Wrist Roller',
]);

/* ------------------------------------------------------------------ *
 * How much of your body weight a bodyweight movement actually carries
 * ------------------------------------------------------------------ *
 *
 * Same shape as the two override lists above: a named table, and the reasoning
 * for each entry sits beside it. What is different is the standard of proof.
 *
 * ⚠️ AN EXERCISE IS IN THIS TABLE ONLY IF THE FRACTION IS KNOWN — measured on a
 * force plate, or fixed by statics. There is no fallback by equipment, no
 * interpolation between neighbours and no "about right" entry. An exercise
 * missing from this table stays unrankable and the screen says why, which is a
 * shipping outcome rather than a hole. An invented fraction here would be worse
 * than nothing: it would be multiplied by a real body weight, run through the
 * e1RM curve and presented in the same colour as a measured lift.
 *
 * TWO KINDS OF ENTRY, and the difference is stated per entry:
 *
 *   'statics'  — the body hangs from the hands and nothing else touches the
 *                ground, so the hands carry ALL of it. This is not a claim that
 *                needs a study; it is the definition of a free hang, and it is a
 *                stronger footing than a citation would be.
 *
 *                ⚠️ THE OBVIOUS REFINEMENT IS REFUSED ON PURPOSE. A pull-up
 *                could be trimmed below 1.00 by subtracting the segments that
 *                do not travel — the hands stay on the bar, and the forearms
 *                barely rise — which is worth roughly four per cent. Doing that
 *                means adopting a cadaver segment-mass table, and the two in
 *                use disagree structurally rather than numerically: Winter's
 *                thigh is 10.0 % of body mass and de Leva's is 14.16 %, because
 *                Zatsiorsky's hip planes assign gluteal mass to the thigh where
 *                Dempster cuts at the hip joint centre. They are not
 *                interchangeable segment by segment. Winter's own fractions
 *                trace, through Miller & Nelson (1973) and Plagenhoef (1971),
 *                to eight embalmed white male cadavers of mean age ~68 and mean
 *                mass ~60 kg, which Dempster's report itself calls smaller than
 *                the population of interest. Four per cent is smaller than the
 *                ratio noise already in this model, so the refinement would buy
 *                precision the sample cannot support. 1.00 stands.
 *
 *   'measured' — the FEET share the load through a lever, so the split is a
 *                genuine empirical quantity and nothing may be reasoned about
 *                it. Only force-plate figures are accepted.
 *
 * `q` is how well the FRACTION is known — not how hard the exercise is, and not
 * how well it converts to a barbell. That second question is the `ratio` in
 * muscle-evidence.js and is a separate, weaker number. Keeping the two apart is
 * the whole honesty of this feature: one is physics, the other is an estimate.
 *
 * ⚠️ WHAT IS DELIBERATELY ABSENT, so nobody re-derives it and quietly adds it:
 *
 *   Inverted Row — the fraction IS measured, and that is exactly why it is out.
 *     Melrose & Dawes (2015, J Athl Enhanc 4:1) hold the start position at four
 *     angles and get 37.4 % at 30 degrees, 52.9 % at 45, 68.1 % at 60 and 79.4 %
 *     at 75; Vural et al. (2023, PLoS ONE 18(9):e0291608) put load cells on
 *     suspension straps and get 69.5-75.7 % near horizontal. The number depends
 *     entirely on the bar height, the app records no bar height, and a 2:1 range
 *     on the single most important term is not something a citation can rescue.
 *     Both sources are suspension-trainer work in any case, not a bar.
 *
 *   Incline Push-Up — Ebben et al. (2011) measured 55 % with the hands on a
 *     30.5 cm box and 41 % on a 61 cm box. Same objection: the app does not
 *     record the height, and 41 vs 55 is not a rounding difference.
 *
 *   Decline Push-Up — Ebben's two heights are close (70 % and 74 %), so the
 *     height problem is mild. It is out for a different reason: those are peak
 *     dynamic ground-reaction forces, a different measurement basis from the
 *     static figure used for the standard push-up below, and mixing the two
 *     scales would put a decline push-up BELOW a regular one, which is absurd.
 *     Re-admitting it means re-basing the whole family on Ebben, not bolting
 *     one number on.
 *
 *   Diamond and Wide-Grip Push-Up — no percent-of-body-mass figure exists for
 *     hand placement. Gouvali & Boudolos (2005) tested those variants and
 *     reported EMG only. NONE FOUND, so they stay out.
 *
 *   Assisted Pull-Up — WAS excluded, ADMITTED 2026-08-24 on Tim's call, and the
 *     original objection is still true, so it is priced rather than waved away.
 *     The fraction is a pull-up's 1.00 and never was the problem. What is
 *     unknown is how a machine's stack maps to load taken off you: the
 *     counterweight linkage is not standardised across brands and nothing
 *     published maps one to the other, so 1:1 is the obvious guess and is still
 *     a guess, on a machine.
 *
 *     ⚠️ WHAT CHANGED IS NOT THE EVIDENCE, IT IS WHAT REFUSING WAS COSTING.
 *     Tim used the app in a gym on 2026-08-24 and did assisted pull-ups, and a
 *     refusal meant his back training rated nothing at all — the same grey-map
 *     complaint that admitted the pull-up in the first place. His instruction:
 *     treat it as a pull-up with the assistance subtracted. That is exactly what
 *     `totalResistance()` already computed for the `assist` branch nobody could
 *     reach.
 *
 *     ⚠️ THE GUESS IS PAID FOR IN `q`, NOT IN A DISCLAIMER. 0.65 is below the
 *     push-up's 0.70 and well below the free hangs' 0.95, so an assisted set
 *     desaturates its own colour on the body map and loses to a real pull-up as
 *     evidence. The reason it sits below the push-up is worth stating: a
 *     push-up's uncertainty is a JUDGEMENT between three published force-plate
 *     figures, and this one has nothing published on either side of it.
 *
 *     ⚠️ AND THE ERROR IS NOT CONSTANT — it scales with how much help you take.
 *     At 10 lb of assist a wrong linkage moves the load by a rounding error; at
 *     120 lb off a 180 lb lifter it moves two thirds of it. A single `q` cannot
 *     express that, because contributionsFor() is per exercise and per body
 *     weight and never sees the set. Known limitation, recorded here rather than
 *     hidden: the number is most trustworthy where it matters least.
 *
 *   Handstand and Pike Push-Up — the wall and the feet take an unrecorded share.
 *     The "90-100 % of body weight" figure that circulates for handstand
 *     push-ups is misattributed to a paper that studied ordinary push-ups.
 *
 *   Every lower-body and trunk bodyweight movement (Bodyweight Squat, Sissy
 *     Squat, Cossack Squat, Nordic Hamstring Curl, Glute-Ham Raise, Single-Leg
 *     Hip Thrust, Single-Leg Calf Raise, Back Extension, 45-Degree
 *     Hyperextension, every Core hold) — out for a reason that is not about
 *     sourcing at all. Their key lifts log EXTERNAL load carried BY a body that
 *     is already there: a 275 lb back squat means 275 lb on the bar, on top of
 *     the lifter. So converting a bodyweight squat to "an equivalent back
 *     squat" needs the key lift's own body-weight component modelled first, and
 *     without that the honest answer is that a bodyweight squat implies an
 *     empty bar. Upper-body pressing and pulling do not have this problem —
 *     a bench press and a push-up both resist a load at the hands, and a row
 *     and a pull-up both pull one — which is why this table is upper body only.
 *     Core is unrankable anyway (no published standards exist).
 */
export const BODY_WEIGHT_FRACTION = {
  // ---- free hangs: 1.00 by statics, not by citation ----
  // Nothing but the hands is in contact with anything, so the hands carry the
  // whole body. Grip width barely moves the maximum, which is not an assumption:
  // Strength Level's own 1RM standards for pull-ups and chin-ups at 180 lb male
  // differ by under 1 % at every level (+74 vs +76 at the median), so one entry
  // covers the family.
  'Pull-Up':             { fraction: 1.00, q: 0.95, basis: 'statics' },
  'Chin-Up':             { fraction: 1.00, q: 0.95, basis: 'statics' },
  'Neutral-Grip Pull-Up':{ fraction: 1.00, q: 0.90, basis: 'statics' },
  'Wide-Grip Pull-Up':   { fraction: 1.00, q: 0.90, basis: 'statics' },
  // Parallel-bar dips. Same free hang, supported at the hands, legs clear.
  'Chest Dip':           { fraction: 1.00, q: 0.95, basis: 'statics' },
  'Triceps Dip':         { fraction: 1.00, q: 0.95, basis: 'statics' },
  // ⚠️ Bench Dip is NOT here: the feet are on the floor and take an unrecorded
  // share, which makes it the same problem as the inverted row.

  // ---- feet on the floor: measured, or not admitted ----
  //
  // Suprak DN, Dawes J, Stephenson MD (2011), "The effect of position on the
  // percentage of body mass supported during traditional and modified push-up
  // variants", J Strength Cond Res 25(2):497-503 (PMID 20179649). Twenty-eight
  // strength-trained men, hands on a force platform:
  //     up position   69.16 % +/- 2.83
  //     down position 75.04 % +/- 2.62
  //
  // THE DOWN POSITION IS THE ONE USED, on purpose. A set of push-ups fails at
  // the bottom, and a 1RM is a quasi-static grind against the hardest point of
  // the movement — so the bottom figure is the one that behaves like a weight
  // on a bar. Independently reproduced: Mier et al. (2014), Int J Exerc Sci
  // 7(2):161-168, force plates, n=37, give 74.6 % +/- 3.6 for men in the same
  // static down position. Two labs, two samples, half a percent apart.
  //
  // ⚠️ Not the number most people quote. The familiar "a push-up is 64 % of
  // your body weight" is Ebben et al. (2011), a peak dynamic ground-reaction
  // force, and "66.4 %" is Gouvali & Boudolos (2005) at the top. All three are
  // real force-plate measurements of DIFFERENT quantities, which is why they
  // disagree. Mier also measured the dynamic maximum and got 97.7 % +/- 8.1 for
  // men — that figure includes accelerating the body and is not comparable to a
  // barbell load, so it is not used here either. `q` is well below the free
  // hangs because which of these quantities belongs in a strength estimate is a
  // judgement, not a measurement.
  'Push-Up':             { fraction: 0.75, q: 0.70, basis: 'measured' },

  // ---- the one that runs the other way ----
  //
  // ⚠️ `assist` INVERTS THE SIGN of the logged weight everywhere it is read:
  // total resistance is fraction x body weight MINUS the number entered, and a
  // step forward is LESS of it. Every consumer keys off this flag rather than
  // off the name, which is why adding an Assisted Dip here is a one-line job and
  // adding one anywhere else would not be.
  //
  // The fraction is the free hang's 1.00 for the same statics reason as Pull-Up
  // above — you hang from your hands, the machine pushes on your knees or feet
  // and that push is the subtracted term, not a change in what carries you.
  // The exclusion note above this table is the full argument for `q`.
  'Assisted Pull-Up':    { fraction: 1.00, q: 0.65, basis: 'statics', assist: true },
};

/**
 * The published body-weight fraction for one exercise, or null when there is
 * none — which means "cannot be ranked or charted", never "assume something".
 */
export function bodyWeightFractionFor(exercise) {
  if (!exercise || !exercise.name) return null;
  const spec = BODY_WEIGHT_FRACTION[exercise.name];
  // A custom exercise the user typed can never acquire an entry, and guessing
  // one from its equipment is exactly what this table refuses to do.
  if (!spec || exercise.isCustom) return null;
  // ⚠️ Read from the entry, NOT hardcoded false. It was hardcoded while the
  // table held only bodyweight movements, and the cost was invisible: the
  // assisted branch existed in totalResistance(), the guard existed in
  // progression.js, and neither could be reached by any exercise in the app —
  // so an assist machine was silently handled as if adding weight made it
  // harder. A flag with no way of ever being true is a comment, not a flag.
  return { fraction: spec.fraction, quality: spec.q, basis: spec.basis, assist: Boolean(spec.assist) };
}

export function loadTypeFor(name, equipment, fields) {
  if (!fields.includes('weight')) return null;      // nothing to disambiguate
  if (FORCE_TOTAL.has(name)) return 'total';
  if (FORCE_PER_SIDE.has(name)) return 'per_side';
  if (/single-arm|one-arm/i.test(name)) return 'per_side';
  if (equipment === 'Dumbbell' || equipment === 'Kettlebell') return 'per_side';
  return 'total';
}

export const LOAD_LABEL = {
  per_side: 'per side',
  total: 'total',
};

// Longer form, used where there's room to be explicit.
export const LOAD_HELP = {
  per_side: 'Enter the weight of one side — one dumbbell, one stack, one hand.',
  total: 'Enter the whole load — the bar plus plates, or the full stack.',
};

export const BUILT_IN_EXERCISES = RAW.map(([name, muscle, equipment, code]) => ({
  id: slugify(name) + '--' + slugify(muscle),
  name,
  muscle,
  equipment,
  fields: FIELDS[code],
  loadType: loadTypeFor(name, equipment, FIELDS[code]),
  isCustom: false,
}));

export function makeCustomExercise({ name, muscle, equipment, fields, loadType }) {
  const f = fields && fields.length ? fields : ['weight', 'reps'];
  return {
    id: 'custom-' + slugify(name) + '-' + Date.now().toString(36),
    name: name.trim(),
    muscle: muscle || 'Other',
    equipment: equipment || 'Other',
    fields: f,
    loadType: f.includes('weight') ? (loadType || 'total') : null,
    isCustom: true,
  };
}

export const FIELD_META = {
  weight:   { label: 'Weight',   unit: 'lbs', step: 5,   min: 0,  decimals: 1 },
  reps:     { label: 'Reps',     unit: 'reps', step: 1,  min: 0,  decimals: 0 },
  time:     { label: 'Time',     unit: 'sec', step: 10,  min: 0,  decimals: 0 },
  distance: { label: 'Distance', unit: 'mi',  step: 0.1, min: 0,  decimals: 2 },
};
