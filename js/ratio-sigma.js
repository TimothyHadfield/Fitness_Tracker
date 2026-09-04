// HOW MUCH A CONVERSION RATIO DRIFTS ACROSS THE STRENGTH RANGE — GENERATED,
// never hand-edited. Regenerate with tools/build-ratio-sigma.mjs.
//
// docs/strength-accuracy-plan.md §6.4. `q` in js/muscle-evidence.js says
// "believe this much" and is a judgement; this is the half of it that has a
// derivation:
//
//     σ_drift = |ln r80 − ln r20| / 1.68
//
// where r20 and r80 are the exercise's ratio to its key lift at the novice
// (20th) and advanced (80th) rows of the published table, and 1.68 is the
// z-span between those two percentiles. A ratio that holds across the range is
// a fact about the movement; one that doubles from novice to advanced is
// telling you it depends on how strong the lifter is, and applying one number
// to everybody is exactly that uncertain.
//
// ⚠️ IT IS NOT THE WHOLE UNCERTAINTY, and `sigmaFor()` in muscle-evidence.js is
// where the rest is added: a sourcing floor, machine gearing (which no published
// table can see, because it varies by brand), and an extra hop for a
// cross-muscle stand-in. This file holds only the part that was measured.
//
// 🚨 THE DRIFT AND `q` AGREE ONLY LOOSELY — r = 0.63 over the 105 of these 106 that
// have a direct contribution today (q read as σ through the plan's bridge) — and
// the disagreements are the point. A machine curl is judged at q 0.35 for
// gearing and drifts 0.016, the flattest ratio in the file; a barbell reverse
// curl is judged at 0.40 and drifts 0.354, the widest. One of those is a
// suspicion about hardware and the other is a measurement.
//
// Derived from the same Strength Level pull as the ratios themselves
// (docs/history.md 2026-09-13 §C, re-derived 2026-09-15).
export const RATIO_DRIFT = new Map([
  ["Arnold Press",                    0.066],
  ["Barbell Calf Raise",              0.075],
  ["Barbell Lunge",                   0.090],
  ["Behind-the-Neck Press",           0.024],
  ["Belt Squat",                      0.133],
  ["Box Squat",                       0.018],
  ["Bulgarian Split Squat",           0.126],
  ["Cable Curl",                      0.061],
  ["Cable Fly",                       0.296],
  ["Cable Kickback",                  0.392],
  ["Cable Lateral Raise",             0.313],
  ["Cable Pull-Through",              0.269],
  ["Cable Rope Hammer Curl",          0.062],
  ["Cable Shrug",                     0.035],
  ["Chest Dip",                       0.109],
  ["Chest-Supported Dumbbell Row",    0.108],
  ["Chin-Up",                         0.181],
  ["Close-Grip Bench Press",          0.028],
  ["Concentration Curl",              0.051],
  ["Deadlift",                        0.034],
  ["Decline Barbell Bench Press",     0.022],
  ["Decline Dumbbell Bench Press",    0.117],
  ["Deficit Deadlift",                0.080],
  ["Dumbbell Bench Press",            0.056],
  ["Dumbbell Calf Raise",             0.055],
  ["Dumbbell Curl",                   0.045],
  ["Dumbbell Fly",                    0.144],
  ["Dumbbell Pullover",               0.087],
  ["Dumbbell Romanian Deadlift",      0.081],
  ["Dumbbell Row",                    0.047],
  ["Dumbbell Shoulder Press",         0.024],
  ["Dumbbell Shrug",                  0.027],
  ["Dumbbell Upright Row",            0.102],
  ["Dumbbell Wrist Curl",             0.205],
  ["EZ-Bar Curl",                     0.084],
  ["Face Pull",                       0.137],
  ["Floor Press",                     0.073],
  ["Front Raise",                     0.207],
  ["Front Squat",                     0.033],
  ["Goblet Squat",                    0.119],
  ["Good Morning",                    0.125],
  ["Hack Squat",                      0.154],
  ["Hammer Curl",                     0.042],
  ["Hip Abduction Machine",           0.121],
  ["Hip Adduction Machine",           0.139],
  ["Hip Thrust",                      0.145],
  ["Incline Barbell Bench Press",     0.018],
  ["Incline Dumbbell Bench Press",    0.017],
  ["Incline Dumbbell Curl",           0.067],
  ["JM Press",                        0.144],
  ["Landmine Press",                  0.146],
  ["Lat Pulldown",                    0.038],
  ["Lateral Raise",                   0.128],
  ["Leg Extension",                   0.083],
  ["Leg Press",                       0.084],
  ["Leg Press Calf Raise",            0.072],
  ["Lying Leg Curl",                  0.052],
  ["Machine Chest Press",             0.114],
  ["Machine Crunch",                  0.006],
  ["Machine Curl",                    0.016],
  ["Machine Lateral Raise",           0.100],
  ["Machine Row",                     0.053],
  ["Machine Shoulder Press",          0.153],
  ["Machine Shrug",                   0.033],
  ["Overhead Cable Extension",        0.207],
  ["Overhead Dumbbell Extension",     0.236],
  ["Pause Squat",                     0.031],
  ["Pec Deck",                        0.068],
  ["Pendlay Row",                     0.056],
  ["Preacher Curl",                   0.021],
  ["Pull-Up",                         0.151],
  ["Push Press",                      0.048],
  ["Rack Pull",                       0.028],
  ["Rear Delt Fly",                   0.273],
  ["Reverse Curl",                    0.354],
  ["Reverse Wrist Curl",              0.085],
  ["Safety Bar Squat",                0.030],
  ["Seal Row",                        0.055],
  ["Seated Barbell Overhead Press",   0.053],
  ["Seated Cable Row",                0.018],
  ["Seated Calf Raise",               0.025],
  ["Seated Dumbbell Shoulder Press",  0.026],
  ["Seated Leg Curl",                 0.054],
  ["Seated Leg Press",                0.095],
  ["Single-Leg Press",                0.188],
  ["Single-Leg Romanian Deadlift",    0.188],
  ["Skull Crusher",                   0.101],
  ["Smith Machine Bench Press",       0.015],
  ["Smith Machine Shrug",             0.022],
  ["Smith Machine Squat",             0.075],
  ["Stiff-Leg Deadlift",              0.022],
  ["Straight-Arm Pulldown",           0.112],
  ["Sumo Deadlift",                   0.054],
  ["Sumo Squat",                      0.245],
  ["T-Bar Row",                       0.071],
  ["Trap Bar Deadlift",               0.062],
  ["Trap Bar Shrug",                  0.101],
  ["Triceps Dip",                     0.081],
  ["Triceps Kickback",                0.184],
  ["Triceps Pushdown",                0.159],
  ["Upright Row",                     0.076],
  ["Walking Lunge",                   0.187],
  ["Yates Row",                       0.044],
  ["Z Press",                         0.050],
  ["Zercher Squat",                   0.030],
  ["Zottman Curl",                    0.170],
]);
