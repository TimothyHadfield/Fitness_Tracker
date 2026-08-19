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
