// Wave 4 EST-FIX: the typo guards added in the overhaul may never make a real
// lifter's number or advice worse. Tim's rule for estimates: "never make a real
// lifter's number or advice worse to guard against a typo."
//   node tests/est-fix-w4.test.mjs
//
// Every case below was run against the pre-fix code (EST_ROOT pointed at a copy
// of HEAD's js/) and failed there; each typo case still refuses.

import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = process.env.EST_ROOT
  ? pathToFileURL(process.env.EST_ROOT.replace(/[\\/]?$/, '/')).href
  : new URL('../js/', import.meta.url).href;

const P = await import(root + 'progression.js');
const { observedDaysPerWeek } = await import(root + 'optimal.js');
const { compareExercise } = await import(root + 'compare.js');
const G = await import(root + 'goals.js');
const { BUILT_IN_EXERCISES } = await import(root + 'exercises.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const ex = (n) => BUILT_IN_EXERCISES.find((x) => x.name === n);
const S = (w, r, n = 3) => Array.from({ length: n }, () => ({ weight: w, reps: r }));

const BENCH = ex('Barbell Bench Press');
const PU = ex('Pull-Up');
const AP = ex('Assisted Pull-Up');
const sug = (history, exercise, more = {}) => P.suggestProgression({ history, exercise, ...more });

/* 1. Singles and doubles: "the same again" only on a loaded lift. */
{
  const s = sug([S(0, 2), S(0, 2)], PU, { bodyWeight: 180 });
  ok(s && s.kind === 'reps' && s.reps === 3, `Pull-Up 0×2 with a weigh-in gets one more rep (${s && s.headline})`);
  const a = sug([S(60, 2), S(60, 2)], AP, { bodyWeight: 180 });
  ok(a && a.kind === 'reps' && a.reps === 3, `Assisted Pull-Up 60 help ×2 gets one more rep (${a && a.headline})`);
  const b = sug([S(405, 1), S(405, 1)], BENCH);
  ok(b && b.kind === 'repeat' && b.reps === 1 && b.weight === 405, 'a 405 × 1 bench single is still "the same again"');
  const planned = sug([S(0, 2), S(0, 2)], PU, { bodyWeight: 180, range: [1, 2] });
  ok(planned && planned.kind === 'repeat', 'a plan whose range tops out at 2 still gets "the same again" on a pull-up');
}

/* 2. A repeated change of rep range is not a typo. */
{
  const h = [S(135, 11), S(135, 11), S(185, 5), S(185, 5)];
  const r = P.trainingRange(h);
  ok(r[0] === 8 && r[1] === 12, `5s → 11s twice reads 8–12 (got ${r.join('–')})`);
  const s = sug(h, BENCH);
  ok(s && s.kind === 'reps' && s.weight === 135 && s.reps === 12, `and says one more rep at 135 (${s && s.headline})`);
  // A one-off rep typo inside the window is still dropped.
  const t = P.trainingRange([S(225, 5), S(225, 50), S(225, 5), S(225, 5)]);
  ok(t[0] === 3 && t[1] === 5, `a single 225 × 50 among 5s is still left out (got ${t.join('–')})`);
}

/* 3. The newest-session typo check refuses only typos. */
{
  const w = sug([S(20, 6), S(10, 8)], PU, { bodyWeight: 180 });
  ok(w && w.weight === 20, `weighted pull-up +10 → +20 lb gets a suggestion (${w && w.headline})`);
  const light = sug([S(135, 12), S(185, 5)], BENCH);
  ok(light && light.weight === 135, `a light day after a heavy one gets a suggestion (${light && light.headline})`);
  const help = sug([S(60, 8), S(25, 8)], AP, { bodyWeight: 180 });
  ok(help && help.weight === 60, `more assistance on an assist machine is not a typo (${help && help.headline})`);
  ok(sug([S(1350, 5), S(135, 5)], BENCH) === null, 'a 1350 × 5 after 135 × 5 still gets no suggestion');
  ok(sug([S(225, 50), S(225, 5)], BENCH) === null, 'a 225 × 50 after 225 × 5 still gets no suggestion');
}

/* 4. Back from a break: measured from the first session back. */
{
  const dates = ['2026-06-01', '2026-06-03', '2026-06-05',
    '2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25'];
  const o = observedDaysPerWeek(dates, '2026-09-27');
  ok(o && o.daysPerWeek === 3 && o.spanDays === 14, `a 3-month break then 6 in 14 days reads 3/week (got ${o && o.daysPerWeek} over ${o && o.spanDays})`);
  // EA-10 kept: a steady lifter with older history still gets the whole window.
  const steady = [];
  for (let d = new Date(Date.UTC(2026, 6, 1)); d <= new Date(Date.UTC(2026, 8, 27)); d.setUTCDate(d.getUTCDate() + 1)) {
    if ([1, 3, 5].includes(d.getUTCDay())) steady.push(d.toISOString().slice(0, 10));
  }
  const st = observedDaysPerWeek(steady, '2026-09-25');
  ok(st && st.spanDays === 28, `a steady Mon/Wed/Fri lifter still reads over the whole window (${st && st.spanDays})`);
}

/* 5. Compare keeps real assisted sets. */
{
  const run = (e, sets) => {
    const mine = sets.map(([w, r], i) => ({ date: `2026-09-0${i + 1}`, entries: [{ exerciseId: e.id, exerciseName: e.name, sets: [{ weight: w, reps: r }] }] }));
    // Their second (empty) session stretches the shared window over all of mine.
    const theirs = [{ date: '2026-09-01', entries: [{ exerciseId: e.id, name: e.name, sets: [{ weight: 0, reps: 10 }] }] },
      { date: '2026-09-05', entries: [] }];
    return compareExercise({ mine, theirs, exerciseId: e.id, exercise: e });
  };
  const c = run(AP, [[40, 8], [40, 8], [90, 12]]);
  const top = c.metrics.find((m) => m.key === 'top-reps');
  ok(top && top.mine === 12, `Assisted Pull-Up 90 × 12 counts as Most reps (got ${top && top.mine})`);
  const b = run(BENCH, [[135, 5], [135, 5], [135, 5], [1350, 5]]);
  const shown = b.metrics.map((m) => m.mineSet && m.mineSet.weight).filter((x) => x != null);
  ok(!shown.includes(1350), 'a barbell 1350 × 5 is still held out of the best rows');
}

/* 6. "Reached" needs two days at the target, and both screens count them. */
{
  ok(typeof G.goalDaysAtTarget === 'function', 'goals.js exports goalDaysAtTarget');
  if (typeof G.goalDaysAtTarget === 'function') {
    const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
    const goal = { muscle: 'Chest', startDate: '2026-08-01', endDate: '2026-10-24', startWeight: 180, targetWeight: 220 };
    const day = (date, w, r) => ({ date, entries: [{ exerciseId: BENCH.id, exerciseName: BENCH.name, sets: S(w, r) }] });
    const rows = (sessions) => ({ sessions, benchmarks: [], exMap, bodyWeights: [], sex: 'male', today: '2026-09-27' });
    const once = [day('2026-09-20', 225, 1), day('2026-09-10', 185, 5), day('2026-07-01', 240, 1)];
    const n1 = await G.goalDaysAtTarget(goal, 224, rows(once));
    ok(n1 === 1, `one day at 225 since the start counts 1 (a day before the start does not) (got ${n1})`);
    ok(G.goalProgress(goal, 224, '2026-09-27', { daysAtTarget: n1 }).reached === false, 'so the goal is not Reached yet');
    const twice = [day('2026-09-24', 225, 1), ...once];
    const n2 = await G.goalDaysAtTarget(goal, 224, rows(twice));
    ok(n2 === 2 && G.goalProgress(goal, 224, '2026-09-27', { daysAtTarget: n2 }).reached, `two days at 225 → Reached (got ${n2})`);
    ok(await G.goalDaysAtTarget(goal, 200, rows(twice)) === undefined, 'nothing is walked while today is under the target');
    ok(await G.goalDaysAtTarget(goal, 224, {}) === undefined, 'no rows → the old single-reading test, never a hidden goal');
  }
  const src = (f) => readFileSync(fileURLToPath(root + f), 'utf8');
  const goalsView = src('views-goals.js');
  const me = src('views-me.js');
  ok(/goalProgress\(goal, current, todayISO\(\), \{ daysAtTarget \}\)/.test(goalsView), 'the Goals screen passes daysAtTarget');
  const meCalls = me.split('\n').filter((l) => /goalProgress\(goal/.test(l));
  ok(meCalls.length === 2 && meCalls.every((l) => /\{ daysAtTarget \}\);/.test(l)), 'both Profile goal calls pass daysAtTarget');
  ok(/goalSection\(goal, muscles, daysAtTarget\)/.test(me) && /await goalDaysAtTarget\(/.test(me), 'and Profile counts the days before it draws the row');
}

/* 7. The Goals footer: two equal quiet buttons. */
{
  const goalsView = readFileSync(fileURLToPath(root + 'views-goals.js'), 'utf8');
  ok(/class: 'btn block goal-end-link', text: 'End this goal'/.test(goalsView), '"End this goal" is the same quiet button as "Change goal"');
}

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
