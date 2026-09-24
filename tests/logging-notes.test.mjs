// Headless tests for the HOW-TO-COUNT notes under an exercise name. No dependencies.
//   node tests/logging-notes.test.mjs
//
// Tim, 2026-09-23: *"For excersizes where it's not clear, like … machine weight
// or if lunge=1 step or 2, you should specify in like 3-4 words or symbols that
// that's the case."* The notes state conventions the ratings already assume;
// these tests pin the ones he named and keep every note short and real.

const { BUILT_IN_EXERCISES, loggingNoteFor, LOGGING_NOTE_NAMES } = await import('../js/exercises.js');

let fails = 0;
const ok = (cond, msg) => { if (cond) console.log('PASS  ' + msg); else { fails++; console.log('FAIL  ' + msg); } };
const ex = (name) => BUILT_IN_EXERCISES.find((e) => e.name === name);
const note = (name) => loggingNoteFor(ex(name));

const names = new Set(BUILT_IN_EXERCISES.map((e) => e.name));
const typos = LOGGING_NOTE_NAMES.filter((n) => !names.has(n));
ok(typos.length === 0, `every name the notes table names is a real exercise (${typos.join(', ') || 'none missing'})`);

ok(note('Walking Lunge') === 'Reps per leg', '🚨 a lunge says reps are counted per leg — Tim\'s "lunge = 1 step or 2"');
ok(note('Bulgarian Split Squat') === 'Reps per leg', 'and so does a split squat');
ok(note('Dumbbell Row') === 'Reps per arm', 'a one-arm row counts per arm');
ok(note('Alternating Dumbbell Curl') === 'Reps per arm', 'alternating curls count per arm (Tim chose, 2026-09-23)');
ok(note('Leg Press') === 'Plates only, no sled', '🚨 the leg press says the sled is not counted — Tim\'s "machine weight"');
ok(note('Smith Machine Squat') === 'Plates only, no bar', 'a Smith machine is plates only, no bar (Tim chose)');
ok(note('Sled Push') === 'Plates only, no sled', 'a sled push is plates only (Tim chose)');
ok(note('EZ-Bar Curl') === 'Include the bar', 'an EZ bar includes the bar');
ok(note('Pull-Up') === 'Added weight only', 'a weighted pull-up is the added weight only');
ok(note('Assisted Pull-Up') === 'Weight = help', 'an assist machine\'s number is the help');
ok(note('Side Plank') === 'Time per side', 'a side plank is timed per side');

ok(note('Barbell Bench Press') === null && note('Dumbbell Curl') === null,
   '⚠️ a lift whose counting is obvious gets NO note — "per side / total" is already on the weight label');
ok(loggingNoteFor({ name: 'Walking Lunge', isCustom: true, fields: ['weight', 'reps'] }) === null,
   'a custom exercise gets no note — the app does not know how its author counts');
ok(loggingNoteFor(null) === null, 'no exercise, no note');

const long = BUILT_IN_EXERCISES.map(loggingNoteFor).filter(Boolean)
  .filter((n) => n.split(' · ').some((part) => part.split(/\s+/).length > 4));
ok(long.length === 0, `every note is at most four words per part — Tim: "like 3-4 words" (${long.join('; ') || 'all short'})`);

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
