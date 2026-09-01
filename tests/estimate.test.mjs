// The per-exercise strength estimate and the rep prediction.
//   node tests/estimate.test.mjs
//
// No DOM, no store. Everything here is arithmetic, which is the point of the
// module being arithmetic.

const { e1rm, repsForWeight, weightForReps, MAX_EVIDENCE_REPS } = await import('../js/e1rm.js');
const { estimateOneRM, percentOfMax, repPrediction } = await import('../js/exercise-estimate.js');
const { BUILT_IN_EXERCISES, makeCustomExercise } = await import('../js/exercises.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);

/* ---------- the inverse curve ----------
 *
 * 🚨 THE ROUND TRIP IS THE LOAD-BEARING TEST. `repsForWeight` claims to be the
 * exact inverse of `e1rm`, so feeding it e1rm's own answer must give back the
 * rep count it started from — at every weight and every rep count, not at one
 * convenient pair. A wrong exponent, a wrong k, or an inverted term all fail
 * this and almost nothing else would catch them.
 */
{
  let worst = 0;
  for (const w of [25, 45, 95, 135, 185, 225, 315, 405]) {
    for (const r of [2, 3, 5, 8, 10, 12, 15]) {
      const back = repsForWeight(e1rm(w, r), w);
      worst = Math.max(worst, Math.abs(back - r));
    }
  }
  ok(worst < 1e-9, `reps → 1RM → reps round-trips exactly (worst error ${worst.toExponential(1)})`);

  ok(repsForWeight(225, 225) === null,
     '⚠️ at the one-rep max there is no rep count — that is what a maximum means, and "0 reps" '
     + 'would be a different and wrong statement');
  ok(repsForWeight(225, 250) === null, 'and above it there is none either');
  ok(repsForWeight(0, 100) === null && repsForWeight(225, 0) === null,
     'a missing number is refused rather than coerced');

  // Strictly decreasing: heavier means fewer.
  const ladder = [90, 120, 150, 180, 210].map((w) => repsForWeight(225, w));
  ok(ladder.every((v, i) => i === 0 || v < ladder[i - 1]),
     `more weight is always fewer reps (${ladder.map((v) => v.toFixed(1)).join(' > ')})`);

  /* ⚠️ THE NUMBER THIS APP PRINTS AND THE NUMBER THE OTHER LITERATURE PRINTS
     ARE NOT THE SAME, and the difference is pinned here rather than discovered
     later. research.md §2 (Nuzzo 2024, graded 🟢) puts ~9 reps at 80 % of a
     bench max; the Marzagao curve this whole app runs on says about 7. The app
     uses Marzagao for consistency with every other e1RM it prints — see the
     argument on repsForWeight — and this assertion exists so that if the curve
     ever moves, somebody has to come back and re-read that argument. */
  const at80 = repsForWeight(225, 180);
  ok(at80 > 6 && at80 < 8,
     `⚠️ 80 % of a 225 max is ~${at80.toFixed(1)} reps on this curve, where Nuzzo's table says ~9 `
     + '— the two disagree and the module says why');
}

/* ---------- what may go on a screen ---------- */
{
  ok(repPrediction(225, 180).reps === 7, 'the screen figure is the rounded curve');
  ok(repPrediction(225, 225).over === true && repPrediction(225, 225).reps === null,
     'at the max it says so instead of printing a rep count');

  const light = repPrediction(225, 112);
  ok(light.reps === MAX_EVIDENCE_REPS && light.atLeast === true,
     `🚨 past ${MAX_EVIDENCE_REPS} reps it stops counting and says "${MAX_EVIDENCE_REPS}+" — the same `
     + 'refusal D5 makes about inferring a maximum FROM a set, and the same one progression.js makes '
     + 'rather than walking somebody to 37 reps');
  ok(repPrediction(225, 40).reps === MAX_EVIDENCE_REPS,
     'and it holds however light the weight gets, rather than climbing');

  ok(repPrediction(0, 100) === null, 'with no estimate there is nothing to say');

  ok(near(percentOfMax(225, 180), 80), 'the percentage is the plain fraction');
  ok(percentOfMax(0, 100) === null, 'and refuses to divide by an estimate that does not exist');
}

/* ---------- converting a rating into one named lift ---------- */
{
  // A rating shaped like `muscleStrength()`'s, which is what the real caller has.
  const rating = (estimate, confidence, used = []) => ({
    estimate, confidence, used, exerciseCount: used.length || 1,
  });
  const muscles = new Map([
    ['Back', rating(200, 0.8, [{ exerciseName: 'Dumbbell Row' }, { exerciseName: 'Lat Pulldown' }])],
    ['Chest', rating(185, 0.6, [{ exerciseName: 'Barbell Bench Press' }])],
  ]);

  /* 🚨 TIM'S OWN CASE, 2026-09-02: "I don't have any barbell rows recorded and
     my friend does. However, I have dumbell rows, lat pulldowns, assisted pull
     ups, and other excersizes recorded." The barbell row IS the Back key lift,
     so its ratio is 1.00 and the rating converts straight across. */
  const row = estimateOneRM(byName('Barbell Row'), muscles);
  ok(row && near(row.oneRM, 200), `a lift never performed gets an estimate (${row && row.oneRM})`);
  ok(row.isKeyLift === true, 'and the key lift is flagged, because nothing was converted for it');
  ok(row.from.includes('Dumbbell Row') && row.from.includes('Lat Pulldown'),
     '⚠️ and it names the exercises it came from — an estimate whose source is not on screen is '
     + 'indistinguishable from a number the app made up');
  ok(near(row.confidence, 0.8), 'a key lift keeps the muscle\'s own confidence (ratio quality 1.00)');

  // A converted lift: the ratio moves the number and the quality moves the
  // confidence, and both must move.
  const db = estimateOneRM(byName('Dumbbell Row'), muscles);
  ok(db && db.oneRM !== 200,
     `a non-key lift is converted rather than copied (${db && Math.round(db.oneRM)} lb total)`);
  ok(db.confidence < 0.8,
     '🚨 and converting COSTS confidence — the ratio carries a population spread of its own, and a '
     + 'number that went through it is worth believing less than the one that did not');
  ok(db.perSide === true && near(db.shown, db.oneRM / 2),
     '⚠️ a per-side lift is shown per side — the ratios are in total load, so a dumbbell row '
     + 'estimated at 240 total is 120 in each hand, and printing 240 would double it');

  ok(estimateOneRM(byName('Barbell Bench Press'), muscles).muscle === 'Chest',
     'each exercise is converted through its own muscle');

  /* ---- what it refuses ---- */
  ok(estimateOneRM(byName('Barbell Row'), new Map()) === null,
     '🚨 no rating for that muscle, no estimate — Tim\'s rule: "If the user has no exercises '
     + 'recorded on a certain muscle group at all, then you can say that you can\'t compare"');
  ok(estimateOneRM(byName('Plank'), muscles) === null,
     'an exercise with no weight field has no maximum to estimate');
  ok(estimateOneRM(makeCustomExercise({ name: 'Barbell Row', muscle: 'Back' }), muscles) === null,
     '⚠️ and a CUSTOM exercise gets nothing, however it is named — muscle-evidence.js took that '
     + 'away on 2026-08-31 after a made-up machine became the only voice in the room, and this '
     + 'module inherits the refusal rather than re-deciding it');
  ok(estimateOneRM(byName('Pull-Up'), muscles) === null,
     '⚠️ a bodyweight lift with no weigh-in is refused, because its load is unknown rather than zero');

  /* 🚨 A RATING THAT IS ITSELF A STAND-IN. `rateMuscle()` returns kind
     'fallback' when a muscle had no direct evidence and a compound was
     converted across to cover it. Multiplying that outward into a named lift is
     an observation × a cross-muscle ratio × this exercise's ratio — the three
     estimates muscle-evidence.js calls the machine for confidently wrong
     numbers, and the exact chain this module's header says it refuses. The
     first version read `rating.estimate` without looking at `rating.kind`. */
  const standIn = new Map([['Back', {
    estimate: 200, confidence: 0.5, kind: 'fallback',
    contributors: [{ exerciseName: 'Deadlift' }], exerciseCount: 1,
  }]]);
  ok(estimateOneRM(byName('Barbell Row'), standIn) === null,
     '🚨 a muscle known only through a compound standing in for it converts to nothing — three '
     + 'estimates multiplied is the chain this module exists to refuse');
  ok(estimateOneRM(byName('Barbell Row'), new Map([['Back', {
    estimate: 200, confidence: 0.5, kind: 'direct',
    contributors: [{ exerciseName: 'Dumbbell Row' }], exerciseCount: 1,
  }]])) !== null,
     'and the same rating marked direct still converts, so the check above is not refusing everything');
  ok(estimateOneRM(null, muscles) === null && estimateOneRM(byName('Barbell Row'), null) === null,
     'and a missing argument is an answer, not a crash');

  /* 🚨 …AND SINCE 2026-09-06 THAT REFUSAL IS OPT-OUT-ABLE, FOR ONE SCREEN.
     docs/direction.md §3.1: *"something is always better than nothing"*, with
     the half Tim kept being *"have a way to be upfront about it."* The benchmark
     screen is a thing somebody READS, so a rough marker with both hops named
     beats silence there. The runner — a number somebody LOADS A BAR TO — keeps
     the refusal, and so does everything else, because the default did not move. */
  const viaOpt = estimateOneRM(byName('Barbell Row'), standIn, undefined, { allowFallback: true });
  ok(viaOpt !== null && viaOpt.viaFallback === true,
     'the opt-in returns a number AND flags it as having gone through a stand-in — a caller cannot '
     + 'take the number without being handed the fact that it is twice-converted');
  ok(estimateOneRM(byName('Barbell Row'), standIn) === null,
     '🚨 THE DEFAULT DID NOT MOVE. Called the old way it still refuses — which is what keeps every '
     + 'existing call site, including the runner, exactly as safe as it was yesterday');
  ok(estimateOneRM(byName('Barbell Row'), standIn, undefined, { allowFallback: 'yes' }) === null,
     '⚠️ and it is checked === true, so a stray truthy value cannot open the gate by accident');

  const direct = estimateOneRM(byName('Barbell Row'), new Map([['Back', {
    estimate: 200, confidence: 0.5, kind: 'direct',
    contributors: [{ exerciseName: 'Dumbbell Row' }], exerciseCount: 1,
  }]]), undefined, { allowFallback: true });
  ok(direct.viaFallback === false,
     'a direct rating asked the same way is NOT flagged — the flag means "this one went the long '
     + 'way round", not "somebody passed the option"');
  ok(viaOpt.confidence < direct.confidence,
     'the twice-converted number is less believable than the once-converted one, and the number '
     + 'says so rather than the sentence beside it having to');
  ok(viaOpt.band.name !== direct.band.name && !/high|good/i.test(viaOpt.band.name),
     `🚨 and its band is CAPPED (${viaOpt.band.name}) — three estimates multiplied may never wear a `
     + 'confident label, however high the inputs happen to be');

  /* ---- the estimate agrees with the curve that produced it ---- */
  const target = weightForReps(row.oneRM, 5);
  ok(near(repsForWeight(row.oneRM, target), 5, 1e-6),
     '🚨 the weight the app would suggest for 5 reps predicts 5 reps — the two directions are one '
     + 'curve, so a benchmark screen and a session runner cannot disagree about the same lift');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
