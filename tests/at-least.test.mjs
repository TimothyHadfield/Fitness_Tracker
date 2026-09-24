// The "at least X" floor beside a muscle's estimate (Open work 9, 2026-09-23).
//   node tests/at-least.test.mjs
//
// Tim: *"Yes I like the at least X."* The floor is the best that any one recent
// listed set supports on its own, lowered by two of its own σ. Pure arithmetic.

const { atLeastOf, readingSigma } = await import('../js/muscle-evidence.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

// The key lift itself (direct, ratio 1, quality 1) — conversion σ is the 0.05
// sourcing floor, so the rep count is the only other doubt.
const row = (estimate, reps, ageDays) => ({
  estimate, reps, ageDays, kind: 'direct', ratio: 1, quality: 1,
  exerciseName: 'Barbell Bench Press',
});

{
  const r = row(225, 1, 3);
  const want = 225 * Math.exp(-2 * readingSigma(r));
  const got = atLeastOf([r], 225);
  ok(got !== null && Math.abs(got - want) < 1e-9,
     `one fresh single at 225 gives a floor of ${got && got.toFixed(1)} (225·e^(−2σ))`);
  ok(got < 225, 'and it sits below the estimate');
}
{
  const a = row(225, 1, 3), b = row(240, 10, 3);
  const got = atLeastOf([a, b], 235);
  const fa = 225 * Math.exp(-2 * readingSigma(a));
  const fb = 240 * Math.exp(-2 * readingSigma(b));
  ok(Math.abs(got - Math.max(fa, fb)) < 1e-9,
     'with two sets it takes the higher of the two floors, not an average');
  ok(readingSigma(b) > readingSigma(a),
     'and a 10-rep set is lowered further than a single, because it is the rougher reading');
}
ok(atLeastOf([row(225, 1, 120)], 225) === null,
   '⚠️ a set older than the 84-day window supports no floor — it says nothing about today');
ok(atLeastOf([row(300, 1, 3)], 250) === null,
   '🛑 a floor that would sit above the estimate is dropped, never shown contradicting it');
ok(atLeastOf([], 225) === null && atLeastOf(null, 225) === null && atLeastOf([row(225, 1, 3)], 0) === null,
   'nothing to go on gives null, not NaN');

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
