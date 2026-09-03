/* How reps fall from set to set — js/rep-decrement.js
 *
 * Run: node tests/rep-decrement.test.mjs        (no dependencies)
 *
 * This module is the only place in the app where the literature on fatigue
 * reaches a number a user reads, and it reaches exactly one: the "maybe N to
 * failure" caption on a set after the first. It never touches a rating, never
 * touches the bar, and — the property most of this file is about — it can only
 * ever move a printed number DOWN.
 *
 * docs/strength-accuracy-plan.md §5; the evidence is docs/research.md §16.5.
 */

const R = await import('../js/rep-decrement.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* ================= the table itself ================= */

ok(Object.keys(R.REST_COLUMNS).length === 4, 'four rest columns — 1, 2, 3 and 5 minutes');
for (const [rest, col] of Object.entries(R.REST_COLUMNS)) {
  ok(col[0] === 1, `${rest}s: set 1 is the fresh prediction, unchanged (${col[0]})`);
  ok(col.every((v) => v <= 1 && v > 0),
     `${rest}s: every multiplier is in (0, 1] — the caption can only come down (${col.join(', ')})`);
  ok(col.every((v, i) => i === 0 || v <= col[i - 1]),
     `${rest}s: and never rises across sets (${col.join(' > ')})`);
}

/* 🚨 THE ORDERING BETWEEN COLUMNS IS THE FINDING, not the constants. Every
 * study in §16.5 agrees that longer rest means more reps on the next set; the
 * exact fractions are the moderate-evidence half. If a later session re-fits
 * the numbers this is the property that must survive. */
for (let k = 1; k <= 3; k++) {
  ok(R.REST_COLUMNS[60][k] < R.REST_COLUMNS[120][k]
     && R.REST_COLUMNS[120][k] < R.REST_COLUMNS[180][k]
     && R.REST_COLUMNS[180][k] < R.REST_COLUMNS[300][k],
     `set ${k + 1}: more rest is always more reps (1 < 2 < 3 < 5 min)`);
}

/* ================= choosing a column ================= */

ok(R.restColumn(0) === R.REST_COLUMNS[R.DEFAULT_REST_SECONDS],
   'the timer off means UNKNOWN, and unknown is the two-minute column — the defensible middle');
ok(R.restColumn(null) === R.REST_COLUMNS[120] && R.restColumn(undefined) === R.REST_COLUMNS[120]
   && R.restColumn('nonsense') === R.REST_COLUMNS[120],
   'and so is anything unreadable — this never throws and never picks the extreme');
ok(R.restColumn(60) === R.REST_COLUMNS[60] && R.restColumn(300) === R.REST_COLUMNS[300],
   'an exact target takes its own column');
ok(R.restColumn(150) === R.REST_COLUMNS[120] || R.restColumn(150) === R.REST_COLUMNS[180],
   '150s lands on one of its neighbours rather than inventing a column');
/* ⚠️ The app's own rest targets are 0 / 60 / 90 / 120 / 180, and 90 sits exactly
 * between two columns. The tie goes to the SHORTER rest on purpose: the lower
 * multiplier is the one a lifter can only beat. */
ok(R.restColumn(90) === R.REST_COLUMNS[60],
   '⚠️ 90s ties between two columns and takes the shorter one — the number you can only beat');

ok(R.setIndexMultiplier(0, 120) === 1, 'set 1 is never discounted');
ok(R.setIndexMultiplier(9, 120) === R.setIndexMultiplier(3, 120),
   'past set 4 the curve has flattened and holds — the studies stop there and so does this');
ok(R.setIndexMultiplier(-3, 120) === 1 && R.setIndexMultiplier(NaN, 120) === 1,
   'a nonsense index falls back to fresh rather than to a discount');

/* ================= reading a run of sets ================= */

const S = (w, r, extra) => ({ weight: w, reps: r, ...(extra || {}) });

ok(R.leadingRun([S(155, 8), S(155, 6), S(155, 5)]).join() === '8,6,5',
   'a run at one load is read in order');
ok(R.leadingRun([S(155, 8), S(155, 6), S(135, 10)]).join() === '8,6',
   '🚨 a WEIGHT CHANGE ends the run — a back-off set is a fresh effort, not set 3 of the same one');
ok(R.leadingRun([S(155, 8), S(155, null), S(155, 5)]).join() === '8',
   'a blank set ends it — nothing after an unrecorded set is a known position in a run');
ok(R.leadingRun([S(155, 8, { prefilled: true }), S(155, 6)]).length === 0,
   'and a prefilled set is not a set at all: it is what the app suggested, not what was done');
ok(R.leadingRun([S(0, 12), S(0, 10)]).join() === '12,10',
   '⚠️ a reps-only lift (pull-ups, push-ups) runs at a load of zero, and zero is one load');
ok(R.leadingRun([S(155, 20), S(155, 8)]).length === 0,
   'a set above the 15-rep evidence cap ends it before it starts — the same D5 line everywhere else');
ok(R.leadingRun(null).length === 0 && R.leadingRun([]).length === 0 && R.leadingRun([null]).length === 0,
   'and it never throws on nothing');

{
  const d = R.runDecrement([S(155, 8), S(155, 6), S(155, 5)]);
  ok(d && d.n === 3 && near(d.r2, 6 / 8) && near(d.r3, 5 / 8) && d.r4 === null,
     'runDecrement reports each set as a fraction of the first');
  ok(R.runDecrement([S(155, 8)]) === null, 'one set is not a decrement');
}

/* ================= the lifter's own decrement ================= */

const sess = (date, sets, extra) => ({
  date, ...(extra || {}), entries: [{ exerciseId: 'bp', sets }],
});
{
  const sessions = [
    sess('2026-08-01', [S(155, 8), S(155, 6), S(155, 5)]),
    sess('2026-08-08', [S(160, 8), S(160, 7), S(160, 6)]),
  ];
  const p = R.personalDecrement(sessions, 'bp');
  ok(p.n === 2 && near(p.r2, ((6 / 8) + (7 / 8)) / 2) && near(p.r3, ((5 / 8) + (6 / 8)) / 2),
     `two runs average into one decrement (r2 ${p.r2.toFixed(3)}, r3 ${p.r3.toFixed(3)})`);
  ok(R.personalDecrement(sessions, 'other').n === 0,
     'and it is per exercise — another lift borrows nothing');
}
{
  // 🚨 A SANDBAGGED FIRST SET MUST NOT RAISE THE CAPTION. Somebody who opens
  // easy and then works up has r2 > 1; clamping is what stops "maybe 8" becoming
  // "maybe 10 on set 2", which is the one direction this module may never move.
  const p = R.personalDecrement([sess('2026-08-01', [S(155, 5), S(155, 9), S(155, 9)])], 'bp');
  ok(p.n === 1 && p.r2 <= 1 && p.r3 <= 1,
     `🚨 a rising run is clamped at 1 (r2 ${p.r2}) — this module can only ever discount`);
}
{
  const sessions = [
    sess('2026-08-01', [S(155, 8), S(155, 6), S(155, 5)], { isBenchmark: true }),
    { date: '2026-08-08', entries: [{ exerciseId: 'bp', setType: 'drop', sets: [S(155, 8), S(155, 6), S(155, 5)] }] },
    { date: '2026-08-15', entries: [{ exerciseId: 'bp', group: 0, sets: [S(155, 8), S(155, 6), S(155, 5)] }] },
  ];
  ok(R.personalDecrement(sessions, 'bp').n === 0,
     '🚨 benchmarks, drop sets and supersets contribute nothing — each is a different rest regime, '
     + 'and `group: 0` is a real group (a truthiness test let the first superset of every workout through)');
}
ok(R.personalDecrement([sess('2026-08-01', [S(155, 8), S(155, 6)])], 'bp').n === 0,
   'and a run of two is too short to be evidence of a pattern');

/* ================= blending, which is where the two meet ================= */

{
  const pop = R.blendedMultipliers(null, 120);
  ok(pop.every((v, i) => near(v, R.REST_COLUMNS[120][i])),
     'with no history of their own, a lifter gets the published column exactly');
}
{
  // A lifter who holds their reps much better than the population.
  const strong = { n: 20, r2: 0.95, r3: 0.9, n4: 20, r4: 0.85 };
  const b = R.blendedMultipliers(strong, 120);
  ok(b[1] > R.REST_COLUMNS[120][1] && b[1] < 0.95,
     `⚠️ their own decrement pulls the number toward them without reaching it (${b[1].toFixed(3)}) — `
     + 'twenty sessions is a lot of evidence and still not a licence to ignore the population');
  const one = R.blendedMultipliers({ n: 1, r2: 0.95, r3: 0.9, n4: 0, r4: null }, 120);
  ok(one[1] < b[1],
     'and one session moves it less than twenty do — the shrinkage is by weight of evidence');
}
{
  // The invariants, under every input this can be handed.
  for (const p of [null, undefined, {}, { n: 0 }, { n: 5, r2: NaN, r3: null, n4: 0, r4: undefined },
                   { n: 3, r2: 2, r3: 1.8, n4: 3, r4: 1.5 }]) {
    const b = R.blendedMultipliers(p, 120);
    ok(b.length === 4 && b[0] === 1 && b.every((v) => v > 0 && v <= 1)
       && b.every((v, i) => i === 0 || v <= b[i - 1]),
       `blended stays ≤ 1 and non-increasing on ${JSON.stringify(p)} (${b.map((v) => v.toFixed(2)).join(', ')})`);
  }
}

/* ================= what the caption actually prints ================= */

{
  const m = R.blendedMultipliers(null, 120);
  ok(R.repsAtSet(8, 0, m) === 8, 'set 1 prints the fresh figure');
  ok(R.repsAtSet(8, 1, m) === 6 && R.repsAtSet(8, 2, m) === 4,
     `"maybe 8" becomes 6 on set 2 and 4 on set 3 at two minutes (${[0, 1, 2, 3].map((k) => R.repsAtSet(8, k, m)).join(' → ')})`);
  ok(R.repsAtSet(2, 3, m) >= 1,
     '🚨 and it never prints "maybe 0 to failure" — the floor is one rep, because zero is not a prediction');
  ok(R.repsAtSet(8, 9, m) === R.repsAtSet(8, 3, m), 'past the table it holds rather than extrapolating');
  ok(R.repsAtSet(null, 1, m) === null && R.repsAtSet(0, 1, m) === null,
     'and with nothing to discount it returns nothing');
  const short = R.blendedMultipliers(null, 60);
  ok(R.repsAtSet(8, 1, short) < R.repsAtSet(8, 1, m),
     'a minute of rest costs more reps than two do, which is the whole reason the column is chosen');
}

/* ================= the one inference that runs the other way ================= */

/* 🚨 FLAT REPS SAY "NOT TO FAILURE", AND THAT IS ALL THEY MAY SAY. At two
 * minutes a set taken to failure loses about a quarter of its reps by set 2, so
 * 8-8-8 is evidence the first set had something left. The app may use that to
 * WITHHOLD the near-max credit it would otherwise give (muscle-evidence.js);
 * using it to raise an estimate would be inventing reps nobody did. */
ok(R.flatRun([S(155, 8), S(155, 8), S(155, 8)]) === true,
   '8, 8, 8 at one load reads as "probably not to failure"');
ok(R.flatRun([S(155, 8), S(155, 6), S(155, 5)]) === false,
   'while a falling run says nothing either way — it is consistent with failure, fatigue or short rest');
ok(R.flatRun([S(155, 8), S(155, 8)]) === false,
   'two sets are not enough to call it');
ok(R.flatRun([S(155, 8), S(155, 8), S(135, 8)]) === false,
   'and a weight change breaks it, for the same reason it breaks a run');

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
