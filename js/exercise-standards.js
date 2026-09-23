// EVERY PUBLISHED STANDARD FOR A NON-KEY EXERCISE — the shipped copy of the
// rows in tools/strength-level-data.mjs that the app now READS, 2026-09-23
// (Open work 13, "conversions that depend on how strong you are").
//
// Tim: *"How one lift translates to another (like machine press to overhead
// press) changes a lot between beginners and advanced lifters, and the app uses
// one fixed number."* It does: machine shoulder press over overhead press runs
// 0.89 beginner · 1.08 novice · 1.23 intermediate · 1.35 advanced · 1.44 elite
// on these very rows, and the ratio table in muscle-evidence.js applies 1.23 to
// everybody. `levelCurveFor()` there reads these rows to make the conversion
// level-aware (percentile matching); this file is only the data.
//
// Source: https://strengthlevel.com/strength-standards/<slug>/lb, fetched
// 2026-09-03 (the same pull every ratio in muscle-evidence.js and every anchor
// in strength-standards.js was divided from). Beginner / Novice / Intermediate /
// Advanced / Elite = the 5th / 20th / 50th / 80th / 95th percentiles, male at
// 180 lb (`m`) and female at 140 lb (`f`), exactly as Strength Level print them
// — per dumbbell where their page says so. 🔒 THE LOAD CONVENTION DOES NOT
// MATTER HERE, and that is deliberate: only the SHAPE of each row is read (its
// two-piece log-spread, `fitSigma()` in strength-standards.js), and a per-hand
// or doubled row has the same shape. Where the row sits is still decided by the
// ratio table's own median, so nothing here can re-derive a ratio by accident.
//
// ⚠️ `muscle` IS THE MUSCLE THE RATIO CONVERTS INTO (tools/strength-level-map.mjs's
// third column), and a row is used only for that muscle's direct conversion.
//
// 🛑 WHAT IS NOT HERE, AND WHY — each keeps today's fixed ratio exactly:
//   · the body-weight tables (Chest Dip, Triceps Dip, Pull-Up, Chin-Up). Their
//     published rows are ADDED weight at one body weight, and Strength Level's
//     own 140/220 lb rows show the total does not scale by the bodyweight^0.67
//     law strength-standards.js uses — placing them would need a second model.
//   · Single-Leg Romanian Deadlift, Sumo Squat, Cable Lateral Raise — the three
//     pages the ratio table already refuses as a different movement or load
//     convention (see build-ratio-sigma.mjs); a page that is not the same lift
//     does not have the same shape either. Cable Kickback has no ratio at all.
//
// 98 rows. Regenerate by filtering tools/strength-level-data.mjs through
// tools/strength-level-map.mjs with the refusals above; never hand-edit a number.
export const EXERCISE_STANDARDS = new Map([
  ["Close-Grip Bench Press",         { muscle: "Chest",      slug: "close-grip-bench-press", m: [124, 163, 208, 260, 314], f: [48, 73, 106, 144, 186] }],
  ["Incline Barbell Bench Press",    { muscle: "Chest",      slug: "incline-bench-press", m: [113, 150, 195, 246, 300], f: [34, 58, 90, 130, 174] }],
  ["Decline Barbell Bench Press",    { muscle: "Chest",      slug: "decline-bench-press", m: [131, 177, 234, 299, 368], f: [44, 74, 114, 163, 217] }],
  ["Floor Press",                    { muscle: "Chest",      slug: "floor-press", m: [96, 145, 206, 279, 358], f: [36, 64, 101, 147, 199] }],
  ["Smith Machine Bench Press",      { muscle: "Chest",      slug: "smith-machine-bench-press", m: [120, 162, 212, 270, 331], f: [38, 65, 100, 142, 190] }],
  ["Dumbbell Bench Press",           { muscle: "Chest",      slug: "dumbbell-bench-press", m: [43, 64, 89, 119, 152], f: [16, 28, 43, 63, 85] }],
  ["Incline Dumbbell Bench Press",   { muscle: "Chest",      slug: "incline-dumbbell-bench-press", m: [49, 66, 88, 113, 139], f: [18, 28, 43, 60, 79] }],
  ["Decline Dumbbell Bench Press",   { muscle: "Chest",      slug: "decline-dumbbell-bench-press", m: [36, 57, 84, 117, 153], f: [14, 28, 46, 70, 96] }],
  ["Machine Chest Press",            { muscle: "Chest",      slug: "chest-press", m: [88, 137, 200, 274, 356], f: [25, 48, 81, 122, 169] }],
  ["Pec Deck",                       { muscle: "Chest",      slug: "machine-chest-fly", m: [96, 142, 199, 266, 339], f: [30, 53, 84, 123, 167] }],
  ["Cable Fly",                      { muscle: "Chest",      slug: "cable-fly", m: [19, 44, 82, 131, 189], f: [8, 21, 40, 66, 96] }],
  ["Dumbbell Fly",                   { muscle: "Chest",      slug: "dumbbell-fly", m: [18, 33, 53, 78, 106], f: [9, 16, 26, 38, 52] }],
  ["Dumbbell Pullover",              { muscle: "Chest",      slug: "dumbbell-pullover", m: [33, 53, 79, 110, 144], f: [16, 26, 41, 58, 78] }],
  ["Dumbbell Row",                   { muscle: "Back",       slug: "dumbbell-row", m: [44, 67, 97, 132, 171], f: [20, 32, 48, 66, 86] }],
  ["Chest-Supported Dumbbell Row",   { muscle: "Back",       slug: "chest-supported-dumbbell-row", m: [33, 55, 84, 119, 158], f: [17, 29, 46, 67, 91] }],
  ["Lat Pulldown",                   { muscle: "Back",       slug: "lat-pulldown", m: [106, 143, 189, 241, 296], f: [52, 75, 103, 136, 172] }],
  ["Seated Cable Row",               { muscle: "Back",       slug: "seated-cable-row", m: [106, 146, 195, 251, 312], f: [49, 73, 103, 140, 179] }],
  ["Machine Row",                    { muscle: "Back",       slug: "machine-row", m: [106, 162, 234, 318, 410], f: [47, 77, 116, 163, 215] }],
  ["Yates Row",                      { muscle: "Back",       slug: "yates-row", m: [129, 174, 228, 290, 356], f: [60, 84, 115, 151, 189] }],
  ["Seal Row",                       { muscle: "Back",       slug: "bench-pull (seal row)", m: [106, 146, 195, 250, 310], f: [58, 80, 105, 135, 166] }],
  ["T-Bar Row",                      { muscle: "Back",       slug: "t-bar-row", m: [86, 130, 185, 250, 321], f: [34, 61, 96, 140, 189] }],
  ["Pendlay Row",                    { muscle: "Back",       slug: "pendlay-row", m: [120, 158, 204, 255, 310], f: [58, 83, 113, 148, 186] }],
  ["Straight-Arm Pulldown",          { muscle: "Back",       slug: "straight-arm-pulldown", m: [44, 77, 120, 173, 232], f: [25, 43, 67, 97, 131] }],
  ["Deadlift",                       { muscle: "Back",       slug: "deadlift", m: [201, 268, 348, 438, 535], f: [93, 139, 196, 264, 338] }],
  ["Sumo Deadlift",                  { muscle: "Back",       slug: "sumo-deadlift", m: [230, 303, 390, 488, 592], f: [108, 153, 210, 275, 345] }],
  ["Trap Bar Deadlift",              { muscle: "Back",       slug: "hex-bar-deadlift", m: [223, 291, 372, 464, 560], f: [110, 155, 211, 274, 343] }],
  ["Rack Pull",                      { muscle: "Back",       slug: "rack-pull", m: [224, 310, 415, 535, 664], f: [121, 176, 246, 328, 416] }],
  ["Deficit Deadlift",               { muscle: "Back",       slug: "deficit-deadlift", m: [216, 281, 358, 444, 535], f: [116, 157, 207, 264, 324] }],
  ["Good Morning",                   { muscle: "Back",       slug: "good-morning", m: [68, 119, 189, 274, 370], f: [36, 64, 101, 147, 199] }],
  ["Hack Squat",                     { muscle: "Quads",      slug: "hack-squat", m: [143, 230, 342, 477, 626], f: [57, 115, 199, 305, 428] }],
  ["Leg Press",                      { muscle: "Quads",      slug: "sled-leg-press", m: [246, 366, 516, 692, 884], f: [115, 202, 320, 465, 628] }],
  ["Seated Leg Press",               { muscle: "Quads",      slug: "horizontal-leg-press", m: [172, 268, 392, 539, 701], f: [91, 156, 243, 350, 469] }],
  ["Single-Leg Press",               { muscle: "Quads",      slug: "single-leg-press", m: [96, 175, 283, 417, 569], f: [47, 94, 160, 243, 339] }],
  ["Leg Extension",                  { muscle: "Quads",      slug: "leg-extension", m: [107, 162, 231, 313, 402], f: [50, 86, 134, 193, 259] }],
  ["Front Squat",                    { muscle: "Quads",      slug: "front-squat", m: [133, 179, 234, 297, 364], f: [71, 100, 136, 178, 224] }],
  ["Goblet Squat",                   { muscle: "Quads",      slug: "goblet-squat", m: [35, 59, 92, 132, 177], f: [23, 38, 58, 83, 110] }],
  ["Bulgarian Split Squat",          { muscle: "Quads",      slug: "dumbbell-bulgarian-split-squat", m: [30, 49, 75, 106, 140], f: [16, 29, 46, 67, 91] }],
  ["Walking Lunge",                  { muscle: "Quads",      slug: "dumbbell-lunge", m: [22, 41, 67, 100, 137], f: [13, 25, 41, 63, 87] }],
  ["Barbell Lunge",                  { muscle: "Quads",      slug: "barbell-lunge", m: [77, 124, 186, 259, 341], f: [45, 74, 112, 157, 208] }],
  ["Smith Machine Squat",            { muscle: "Quads",      slug: "smith-machine-squat", m: [129, 190, 266, 354, 451], f: [50, 88, 138, 199, 267] }],
  ["Safety Bar Squat",               { muscle: "Quads",      slug: "safety-bar-squat", m: [157, 225, 310, 407, 513], f: [79, 122, 176, 239, 309] }],
  ["Box Squat",                      { muscle: "Quads",      slug: "box-squat", m: [185, 258, 347, 449, 559], f: [86, 131, 189, 257, 331] }],
  ["Pause Squat",                    { muscle: "Quads",      slug: "pause-squat", m: [171, 228, 295, 371, 452], f: [82, 119, 164, 216, 273] }],
  ["Zercher Squat",                  { muscle: "Quads",      slug: "zercher-squat", m: [128, 184, 253, 334, 421], f: [59, 92, 134, 184, 240] }],
  ["Belt Squat",                     { muscle: "Quads",      slug: "belt-squat", m: [171, 278, 416, 583, 767], f: [80, 151, 248, 369, 508] }],
  ["Dumbbell Romanian Deadlift",     { muscle: "Hamstrings", slug: "dumbbell-romanian-deadlift", m: [43, 67, 98, 136, 177], f: [24, 40, 61, 87, 116] }],
  ["Lying Leg Curl",                 { muscle: "Hamstrings", slug: "lying-leg-curl", m: [68, 103, 148, 201, 259], f: [35, 56, 83, 115, 151] }],
  ["Seated Leg Curl",                { muscle: "Hamstrings", slug: "seated-leg-curl", m: [87, 131, 185, 250, 320], f: [44, 71, 107, 150, 198] }],
  ["Stiff-Leg Deadlift",             { muscle: "Hamstrings", slug: "stiff-leg-deadlift", m: [149, 212, 291, 381, 480], f: [67, 104, 153, 210, 274] }],
  ["Cable Pull-Through",             { muscle: "Hamstrings", slug: "cable-pull-through", m: [34, 76, 138, 218, 312], f: [22, 49, 89, 142, 202] }],
  ["Hip Thrust",                     { muscle: "Glutes",     slug: "hip-thrust", m: [129, 218, 335, 478, 639], f: [81, 143, 227, 330, 447] }],
  ["Hip Abduction Machine",          { muscle: "Glutes",     slug: "hip-abduction", m: [86, 141, 213, 300, 398], f: [60, 101, 155, 221, 295] }],
  ["Hip Adduction Machine",          { muscle: "Glutes",     slug: "hip-adduction", m: [92, 151, 228, 322, 426], f: [51, 91, 145, 211, 286] }],
  ["Machine Shoulder Press",         { muscle: "Shoulders",  slug: "machine-shoulder-press", m: [67, 112, 172, 244, 325], f: [18, 38, 68, 106, 150] }],
  ["Dumbbell Shoulder Press",        { muscle: "Shoulders",  slug: "dumbbell-shoulder-press", m: [34, 50, 71, 94, 120], f: [14, 22, 33, 46, 61] }],
  ["Seated Dumbbell Shoulder Press", { muscle: "Shoulders",  slug: "seated-dumbbell-shoulder-press", m: [40, 56, 76, 98, 122], f: [17, 26, 37, 50, 64] }],
  ["Arnold Press",                   { muscle: "Shoulders",  slug: "arnold-press", m: [23, 37, 54, 75, 98], f: [13, 19, 27, 37, 47] }],
  ["Seated Barbell Overhead Press",  { muscle: "Shoulders",  slug: "seated-shoulder-press", m: [82, 117, 160, 210, 264], f: [23, 43, 70, 104, 143] }],
  ["Push Press",                     { muscle: "Shoulders",  slug: "push-press", m: [96, 133, 177, 229, 283], f: [51, 72, 99, 129, 162] }],
  ["Behind-the-Neck Press",          { muscle: "Shoulders",  slug: "behind-the-neck-press", m: [67, 98, 136, 181, 230], f: [32, 50, 74, 102, 134] }],
  ["Z Press",                        { muscle: "Shoulders",  slug: "z-press", m: [65, 94, 131, 174, 220], f: [22, 38, 61, 88, 119] }],
  ["Landmine Press",                 { muscle: "Shoulders",  slug: "landmine-press", m: [45, 79, 126, 184, 249], f: [19, 37, 62, 94, 130] }],
  ["Upright Row",                    { muscle: "Shoulders",  slug: "upright-row", m: [53, 87, 132, 187, 248], f: [26, 44, 67, 96, 128] }],
  ["Dumbbell Upright Row",           { muscle: "Shoulders",  slug: "dumbbell-upright-row", m: [18, 34, 55, 82, 113], f: [12, 20, 29, 41, 54] }],
  ["Face Pull",                      { muscle: "Shoulders",  slug: "face-pull", m: [35, 64, 105, 155, 211], f: [24, 45, 73, 107, 146] }],
  ["Lateral Raise",                  { muscle: "Shoulders",  slug: "dumbbell-lateral-raise", m: [12, 22, 37, 55, 76], f: [7, 13, 20, 29, 39] }],
  ["Machine Lateral Raise",          { muscle: "Shoulders",  slug: "machine-lateral-raise", m: [58, 92, 136, 189, 248], f: [19, 36, 59, 89, 122] }],
  ["Front Raise",                    { muscle: "Shoulders",  slug: "dumbbell-front-raise", m: [10, 22, 38, 60, 86], f: [6, 12, 21, 32, 44] }],
  ["Rear Delt Fly",                  { muscle: "Shoulders",  slug: "dumbbell-reverse-fly", m: [8, 20, 39, 64, 94], f: [6, 12, 22, 34, 47] }],
  ["Hammer Curl",                    { muscle: "Biceps",     slug: "hammer-curl", m: [24, 37, 54, 73, 95], f: [11, 18, 27, 38, 50] }],
  ["Dumbbell Curl",                  { muscle: "Biceps",     slug: "dumbbell-curl", m: [19, 32, 49, 71, 95], f: [9, 17, 27, 40, 55] }],
  ["Preacher Curl",                  { muscle: "Biceps",     slug: "preacher-curl", m: [46, 70, 100, 136, 175], f: [20, 35, 54, 78, 104] }],
  ["Concentration Curl",             { muscle: "Biceps",     slug: "concentration-curl", m: [20, 33, 48, 67, 88], f: [11, 18, 27, 38, 51] }],
  ["Incline Dumbbell Curl",          { muscle: "Biceps",     slug: "incline-dumbbell-curl", m: [22, 32, 44, 58, 74], f: [11, 17, 25, 34, 43] }],
  ["Zottman Curl",                   { muscle: "Biceps",     slug: "zottman-curl", m: [11, 23, 41, 64, 90], f: [10, 16, 23, 31, 41] }],
  ["Cable Curl",                     { muscle: "Biceps",     slug: "cable-curl", m: [44, 75, 115, 164, 218], f: [17, 33, 56, 84, 116] }],
  ["Cable Rope Hammer Curl",         { muscle: "Biceps",     slug: "cable-hammer-curl", m: [35, 62, 97, 141, 190], f: [20, 36, 57, 82, 111] }],
  ["EZ-Bar Curl",                    { muscle: "Biceps",     slug: "ez-bar-curl", m: [56, 78, 104, 135, 167], f: [26, 40, 58, 79, 102] }],
  ["Machine Curl",                   { muscle: "Biceps",     slug: "machine-bicep-curl", m: [57, 88, 128, 176, 228], f: [20, 36, 58, 86, 117] }],
  ["Skull Crusher",                  { muscle: "Triceps",    slug: "lying-tricep-extension", m: [45, 69, 98, 132, 170], f: [16, 29, 46, 67, 90] }],
  ["Triceps Pushdown",               { muscle: "Triceps",    slug: "tricep-pushdown", m: [49, 82, 126, 179, 238], f: [21, 39, 65, 96, 133] }],
  ["Overhead Cable Extension",       { muscle: "Triceps",    slug: "cable-overhead-tricep-extension", m: [33, 60, 97, 142, 194], f: [13, 27, 47, 72, 101] }],
  ["Overhead Dumbbell Extension",    { muscle: "Triceps",    slug: "dumbbell-tricep-extension", m: [14, 28, 49, 75, 105], f: [8, 15, 26, 39, 54] }],
  ["Triceps Kickback",               { muscle: "Triceps",    slug: "dumbbell-tricep-kickback", m: [11, 23, 41, 63, 89], f: [9, 15, 23, 32, 43] }],
  ["JM Press",                       { muscle: "Triceps",    slug: "jm-press", m: [73, 110, 156, 210, 268], f: [20, 43, 74, 115, 162] }],
  ["Dumbbell Shrug",                 { muscle: "Traps",      slug: "dumbbell-shrug", m: [38, 64, 99, 141, 188], f: [15, 31, 54, 83, 117] }],
  ["Machine Shrug",                  { muscle: "Traps",      slug: "machine-shrug", m: [135, 219, 328, 460, 606], f: [47, 105, 190, 301, 430] }],
  ["Smith Machine Shrug",            { muscle: "Traps",      slug: "smith-machine-shrug", m: [131, 197, 280, 378, 485], f: [46, 92, 157, 240, 335] }],
  ["Cable Shrug",                    { muscle: "Traps",      slug: "cable-shrug", m: [89, 149, 229, 327, 436], f: [32, 67, 119, 185, 262] }],
  ["Trap Bar Shrug",                 { muscle: "Traps",      slug: "hex-bar-shrug", m: [136, 206, 296, 401, 516], f: [78, 119, 172, 235, 304] }],
  ["Seated Calf Raise",              { muscle: "Calves",     slug: "seated-calf-raise", m: [71, 129, 209, 308, 420], f: [33, 77, 144, 230, 332] }],
  ["Leg Press Calf Raise",           { muscle: "Calves",     slug: "sled-press-calf-raise", m: [191, 308, 460, 642, 844], f: [92, 174, 287, 430, 592] }],
  ["Dumbbell Calf Raise",            { muscle: "Calves",     slug: "dumbbell-calf-raise", m: [22, 47, 83, 130, 185], f: [12, 27, 49, 77, 110] }],
  ["Barbell Calf Raise",             { muscle: "Calves",     slug: "barbell-calf-raise", m: [117, 192, 290, 407, 539], f: [58, 106, 173, 255, 349] }],
  ["Dumbbell Wrist Curl",            { muscle: "Forearms",   slug: "dumbbell-wrist-curl", m: [17, 35, 60, 92, 129], f: [7, 17, 33, 55, 80] }],
  ["Reverse Wrist Curl",             { muscle: "Forearms",   slug: "reverse-wrist-curl", m: [8, 37, 90, 165, 258], f: [3, 18, 48, 91, 147] }],
  ["Reverse Curl",                   { muscle: "Forearms",   slug: "reverse-barbell-curl", m: [35, 59, 90, 128, 171], f: [16, 29, 47, 69, 95] }],
  ["Machine Crunch",                 { muscle: "Core",       slug: "machine-seated-crunch", m: [65, 110, 170, 243, 325], f: [30, 57, 94, 140, 192] }],
]);
