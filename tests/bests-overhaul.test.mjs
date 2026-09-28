// Headless tests for the 2026-09-27 overhaul's numbers slice (builder BESTS):
//   node tests/bests-overhaul.test.mjs
//
//   EA-3  a slip typed into every set of the NEWEST day is held (it corroborated itself)
//   EB-6  the same hold reaches Profile's reps-only list and the compare sheet
//   EB-9  a kilogram reader's 1RM record needs one KILOGRAM of gain, not one pound
//   EB-11 compare prints a dumbbell lift per hand, flagged `each`, like every other screen
//   EB-3  no printed max when every set behind it is past D5's 15 reps (map untouched)
//   EB-7  Profile's number is the runner's recency-aware pick; the ever-best is a dated line
//   EB-8  Landmine Press is one load, not doubled; a bar row carries '+ bar'
//   P8    the compare sheet's sentences are short, and every reason moved to `help`

const mem = new Map();
globalThis.localStorage = globalThis.localStorage || {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { e1rm } = await import('../js/e1rm.js');
const { setE1rm } = await import('../js/set-e1rm.js');
const PB = await import('../js/personal-bests.js');
const { bestLifts } = await import('../js/profile-records.js');
const { rankedLifts } = await import('../js/profile-ranking.js');
const { ownBestSet, estimateOneRM } = await import('../js/exercise-estimate.js');
const { compareExercise, NO_VERDICT_HEADER } = await import('../js/compare.js');
const MM = await import('../js/machine-mechanics.js');
const { buildObservations } = await import('../js/strength-observations.js');
const { rateMuscle } = await import('../js/muscle-evidence.js');
const { MUSCLE_LIFTS } = await import('../js/strength-standards.js');
const { setUnits } = await import('../js/units.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const byName = (n) => {
  const e = BUILT_IN_EXERCISES.find((x) => x.name === n);
  if (!e) throw new Error('no exercise ' + n);
  return e;
};
const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));
const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const TODAY = '2026-09-27';
const sets = (w, r, n = 3) => Array.from({ length: n }, () => (w == null ? { reps: r } : { weight: w, reps: r }));
let sid = 0;
const session = (date, name, s) => ({
  id: 's' + (++sid), date, entries: [{ exerciseId: byName(name).id, exerciseName: name, sets: s }],
});
const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const ratings = (sessions, bodyWeights = []) => {
  const { byMuscle } = buildObservations({ sessions, benchmarks: [], exMap, bodyWeights, sex: 'male', today: TODAY });
  const out = new Map();
  for (const m of Object.keys(MUSCLE_LIFTS)) {
    const r = rateMuscle(byMuscle.get(m) || [], m);
    if (r) out.set(m, r);
  }
  return out;
};
const PROFILE = { gender: 'male', compare: {} };

const BENCH = byName('Barbell Bench Press');

/* ================= EA-3: the newest day's self-corroborated slip ================= */
{
  // Five clean sessions of 135×5, then a slip typed into all three sets.
  const clean = [1, 2, 3, 4, 5].map((i) => session(addDays('2026-09-20', -3 * i), BENCH.name, sets(135, 5)));
  const slip = session('2026-09-20', BENCH.name, sets(1350, 5));
  const seat = ownBestSet(BENCH, { sessions: [...clean, slip] }, TODAY);
  ok(seat && seat.weight === 135,
     `EA-3: after 5 × 135×5, a newest day of 1350×5 ×3 is NOT the seat (seat ${seat && seat.weight}×${seat && seat.reps})`);

  const again = session('2026-09-23', BENCH.name, sets(1350, 5));
  const seat2 = ownBestSet(BENCH, { sessions: [...clean, slip, again] }, TODAY);
  ok(seat2 && seat2.weight === 1350, 'EA-3: a later day that agrees releases it — the hold is never a deletion');

  const pr = session('2026-09-20', BENCH.name, sets(185, 5));
  const seat3 = ownBestSet(BENCH, { sessions: [...clean, pr] }, TODAY);
  ok(seat3 && seat3.weight === 185, 'EA-3: a real PR (1.37×) is never held');

  const only = ownBestSet(BENCH, { sessions: [slip] }, TODAY);
  ok(only && only.weight === 1350, 'EA-3: a first-ever day has nothing earlier to jump from, so nothing is held');

  // The helper the store builder calls: sets only, no estimate precomputed.
  const rows = [...clean, slip].flatMap((s) => s.entries[0].sets.map((x) => ({ date: s.date, ...x })));
  const held = typeof PB.holdTypos === 'function' ? PB.holdTypos(rows, { exercise: BENCH }) : null;
  ok(held instanceof Set && held.size === 3 && [...held].every((r) => r.weight === 1350),
     `EA-3: holdTypos(rows, { exercise }) returns the caller's own three 1350 rows (${held ? held.size : 'no helper'})`);
  const plain = typeof PB.holdTypos === 'function' ? PB.holdTypos(rows) : null;
  ok(plain instanceof Set && plain.size === 3, 'EA-3: and works without the exercise (plain curve, one scale)');
}

/* ================= EB-6: reps-only lifts, and compare ================= */
{
  const PUSH = byName('Push-Up');
  const days = [1, 2, 3, 4].map((i) => session(addDays('2026-09-20', -3 * i), PUSH.name, sets(null, 5)));
  const slip = session('2026-09-20', PUSH.name, [{ reps: 50 }]);
  const repHeld = typeof PB.holdTypos === 'function'
    ? PB.holdTypos([...days, slip].flatMap((s) => s.entries[0].sets.map((x) => ({ date: s.date, ...x }))), { metric: 'reps' })
    : null;
  ok(repHeld instanceof Set && repHeld.size === 1 && [...repHeld][0].reps === 50,
     'EB-6: holdTypos(..., { metric: "reps" }) holds push-ups 5, 5, 5, 5 then 50');

  const rec = bestLifts([...days, slip], { exMap, limit: 0 }).lifts.find((l) => l.name === PUSH.name);
  ok(rec && rec.best.kind === 'reps' && rec.best.value === 5,
     `EB-6: Profile's best push-up is 5, not the slipped 50 (${rec && rec.best.value})`);
  ok(rec && rec.sets === 13, 'EB-6: the held set still counts as a set');
  const r = rankedLifts({ sessions: [...days, slip], exMap, muscles: new Map(), profile: PROFILE, today: TODAY });
  const row = r.repsOnly.find((x) => x.name === PUSH.name);
  ok(row && row.reps === 5, `EB-6: Profile's reps-only row reads 5 (${row && row.reps})`);

  // compare: my five clean days and a slip, against their honest 225×5.
  const mine = [1, 2, 3, 4, 5].map((i) => session(addDays('2026-09-20', -3 * i), BENCH.name, sets(135, 5)))
    .concat(session('2026-09-20', BENCH.name, sets(1350, 5)));
  const theirs = [{ date: '2026-08-01', entries: [] },
    { date: '2026-09-10', entries: [{ exerciseId: BENCH.id, name: BENCH.name, sets: [{ weight: 225, reps: 5 }] }] },
    { date: '2026-09-25', entries: [] }];
  const c = compareExercise({ mine, theirs, exerciseId: BENCH.id, exercise: BENCH });
  const e = c.metrics.find((m) => m.key === 'e1rm');
  const top = c.metrics.find((m) => m.key === 'top-weight');
  ok(e && Math.abs(e.mine - e1rm(135, 5)) < 0.01, `EB-6: compare's 1RM row ignores my 1350 slip (${e && e.mine})`);
  ok(top && top.mine === 135, `EB-6: and so does the heaviest-set row (${top && top.mine})`);
  ok(c.metrics.find((m) => m.key === 'sets').mine === 18, 'EB-6: the slip still counts in "Sets logged"');
}

/* ================= EB-9: a kilogram reader's grain ================= */
{
  // Two sets whose 1RMs differ by more than a pound but round to the same kilogram.
  const kg = (lb) => Math.round(lb / 2.2046226218);
  let now = null;
  let was = null;
  for (let w0 = 200; w0 < 260 && !now; w0 += 5) {
    for (let w = w0 + 1; w < w0 + 3 && !now; w += 0.5) {
      const a = e1rm(w, 5), b = e1rm(w0, 5);
      if (Math.round(a) > Math.round(b) && kg(a) === kg(b)) { now = { weight: w, reps: 5 }; was = { weight: w0, reps: 5 }; }
    }
  }
  ok(Boolean(now), `EB-9 fixture: found a set one pound up but the same kilogram (${now && now.weight})`);
  const prior = [{ date: '2026-09-01', entries: [{ exerciseId: BENCH.id, exerciseName: BENCH.name, sets: [was] }] }];
  const cleaned = [{ exerciseId: BENCH.id, exerciseName: BENCH.name, sets: [now] }];
  setUnits('kg');
  const inKg = PB.personalBests(cleaned, prior, [], exMap, { date: '2026-09-20' }).filter((p) => p.kind === 'e1rm');
  setUnits('lbs');
  const inLb = PB.personalBests(cleaned, prior, [], exMap, { date: '2026-09-20' }).filter((p) => p.kind === 'e1rm');
  ok(inKg.length === 0, 'EB-9: in kg there is no "1RM 118 kg, up from 118 kg" record');
  ok(inLb.length === 1, 'EB-9: in lb the same sets DO set a record — the unit is really what decides');
}

/* ================= EB-11: compare prints per hand ================= */
{
  const DB = byName('Dumbbell Bench Press');
  const c = compareExercise({
    mine: [{ date: '2026-07-01', entries: [{ exerciseId: DB.id, exerciseName: DB.name, sets: [{ weight: 50, reps: 10 }] }] },
      { date: '2026-08-01', entries: [] }],
    theirs: [{ date: '2026-06-01', entries: [] },
      { date: '2026-07-02', entries: [{ exerciseId: DB.id, name: DB.name, sets: [{ weight: 45, reps: 10 }] }] }],
    exerciseId: DB.id, exercise: DB,
  });
  const top = c.metrics.find((m) => m.key === 'top-weight');
  const e = c.metrics.find((m) => m.key === 'e1rm');
  ok(top && top.mine === 50 && top.theirs === 45 && top.each === true,
     `EB-11: heaviest set per hand, flagged each (${top && top.mine}/${top && top.theirs})`);
  const perHand = setE1rm(DB, 50, 10).e1rm / 2;
  ok(e && Math.abs(e.mine - perHand) < 0.01 && e.each === true,
     `EB-11: 1RM per hand — the finish screen's figure (${e && e.mine} vs ${perHand})`);
  ok(e && e.better === 'mine', 'EB-11: and the per-row claim is unchanged by halving both sides');
}

/* ================= EB-3: nothing printed off 16–20-rep sets ================= */
{
  const bb = [0, 1, 2, 3, 4, 5].map((i) => session(addDays(TODAY, -4 * i - 2), BENCH.name,
    [{ weight: 155, reps: 18 }, { weight: 160, reps: 17 }, { weight: 165, reps: 16 }]));
  const muscles = ratings(bb);
  ok(muscles.get('Chest') && muscles.get('Chest').estimate > 0,
     'EB-3 control: the MAP still rates Chest off 16–18-rep sets (MAX_MAP_REPS, untouched)');
  ok(estimateOneRM(BENCH, muscles, 180, { sex: 'male' }) === null,
     'EB-3: the runner\'s "your estimated max" refuses — every set behind it is past 15 reps');
  const r = rankedLifts({ sessions: bb, exMap, muscles, profile: PROFILE, today: TODAY });
  const row = r.core.find((l) => l.name === BENCH.name);
  ok(row && row.oneRM === null, `EB-3: Profile prints no Bench number (${row && row.oneRM})`);
  ok(row && row.why === 'high-reps-only', `EB-3: and says why with its own key (${row && row.why})`);
}

/* ================= EB-7: one "your max" ================= */
{
  // 220×5 two hundred days ago, 170×5 this month: the runner reads the recent one.
  const old = session(addDays(TODAY, -200), BENCH.name, sets(220, 5));
  const recent = [3, 10, 17].map((d) => session(addDays(TODAY, -d), BENCH.name, sets(170, 5)));
  const all = [old, ...recent];
  const pick = ownBestSet(BENCH, { sessions: all }, TODAY);
  const r = rankedLifts({ sessions: all, exMap, muscles: ratings(all), profile: PROFILE, today: TODAY });
  const row = r.core.find((l) => l.name === BENCH.name);
  ok(pick && row && Math.abs(row.oneRM - pick.e1rm) < 0.01,
     `EB-7: Profile's Bench is the runner's pick (${row && row.oneRM && row.oneRM.toFixed(1)} vs ${pick && pick.e1rm.toFixed(1)})`);
  ok(row && row.best && row.best.weight === 170, 'EB-7: and the set it rests on is that pick\'s 170×5');
  ok(row && row.bestEver && Math.abs(row.bestEver.total - e1rm(220, 5)) < 0.01 && row.bestEver.date === old.date,
     'EB-7: the ever-best rides along as a DATED bestEver line');
  const same = rankedLifts({ sessions: recent, exMap, muscles: ratings(recent), profile: PROFILE, today: TODAY })
    .core.find((l) => l.name === BENCH.name);
  ok(same && same.bestEver === null, 'EB-7: no bestEver line when the two are the same number');
}

/* ================= EB-8: Landmine Press, and "+ bar" ================= */
{
  const LP = byName('Landmine Press');
  ok(LP.loadType === 'total', `EB-8: Landmine Press is ONE load on one bar (loadType ${LP.loadType})`);
  const lp = [3, 6, 9].map((d) => session(addDays(TODAY, -d), LP.name, sets(70, 10)));
  const row = rankedLifts({ sessions: lp, exMap, muscles: ratings(lp), profile: PROFILE, today: TODAY })
    .other.find((l) => l.name === LP.name);
  ok(row && row.percentile !== null && row.percentile < 70,
     `EB-8: 70×10 no longer reads Advanced (p${row && row.percentile && row.percentile.toFixed(1)}; was p87.7)`);
  ok(row && row.addedLoad === null, 'EB-8: and carries no bar note — it has no bar offset');

  ok(typeof MM.addedLoadNote === 'function' && MM.addedLoadNote(byName('T-Bar Row')) === '+ bar'
     && MM.addedLoadNote(byName('Meadows Row')) === '+ bar',
     'EB-8: addedLoadNote says "+ bar" on the landmine-bar rows');
  ok(typeof MM.addedLoadNote === 'function' && MM.addedLoadNote(byName('Barbell Row')) === null
     && MM.addedLoadNote(LP) === null && MM.addedLoadNote(byName('Machine Hip Thrust')) === null,
     'EB-8: and nothing on a plain barbell, the landmine press or a hip-thrust arm');
  const tb = [3, 6, 9].map((d) => session(addDays(TODAY, -d), 'T-Bar Row', sets(70, 10)));
  const tRow = rankedLifts({ sessions: tb, exMap, muscles: ratings(tb), profile: PROFILE, today: TODAY })
    .other.find((l) => l.name === 'T-Bar Row');
  ok(tRow && tRow.percentile !== null && tRow.addedLoad === '+ bar',
     `EB-8: a ranked T-Bar Row row carries '+ bar' beside its level (${tRow && tRow.addedLoad})`);
}

/* ================= P8: the compare sheet's words ================= */
{
  ok(wordCount(NO_VERDICT_HEADER) <= 15 && /No overall winner/.test(NO_VERDICT_HEADER),
     `P8: the no-winner header is short and still refuses a winner (${wordCount(NO_VERDICT_HEADER)} words)`);
  const mine = [{ date: '2026-07-01', entries: [{ exerciseId: BENCH.id, exerciseName: BENCH.name,
    sets: [{ weight: 135, reps: 20 }, { weight: 205, reps: 5 }] }] }, { date: '2026-08-01', entries: [] }];
  const theirs = [{ date: '2026-06-01', entries: [] },
    { date: '2026-07-02', entries: [{ exerciseId: BENCH.id, name: BENCH.name, sets: [{ weight: 200, reps: 5 }] }] }];
  const c = compareExercise({ mine, theirs, exerciseId: BENCH.id, exercise: BENCH });
  const long = c.caveats.filter((x) => wordCount(x.text) > 15);
  ok(c.caveats.length >= 3 && long.length === 0,
     `P8: every caveat's on-screen text is 15 words or fewer (${long.map((x) => x.key).join(', ') || 'none over'})`);
  const win = c.caveats.find((x) => x.key === 'window');
  ok(win && /publish/.test(win.help || '') && /flatter/.test(win.text),
     'P8: the window caveat keeps WHAT on screen and moves WHY (their publishing limit) to help');
  const gate = c.caveats.find((x) => x.key === 'rep-gate');
  ok(gate && /not read a maximum/.test(gate.help || '') && gate.help.includes('15'),
     'P8: the rep-gate reason moved behind the ?, not deleted');
  const PULL = byName('Pull-Up');
  const bw = compareExercise({
    mine: [{ date: '2026-07-01', entries: [{ exerciseId: PULL.id, exerciseName: PULL.name, sets: [{ reps: 8 }] }] },
      { date: '2026-08-01', entries: [] }],
    theirs: [{ date: '2026-06-01', entries: [] },
      { date: '2026-07-02', entries: [{ exerciseId: PULL.id, name: PULL.name, sets: [{ reps: 6 }] }] }],
    exerciseId: PULL.id, exercise: PULL,
  });
  const nl = bw.caveats.find((x) => x.key === 'no-load');
  ok(nl && wordCount(nl.text) <= 12 && /top tier/.test(nl.help || ''),
     'P8: the body-weight refusal is one short line, its reason behind the ?');
  const msgs = [
    compareExercise({ mine: [], theirs, exerciseId: BENCH.id, exercise: BENCH }).message,
    compareExercise({ mine, theirs: [], exerciseId: BENCH.id, exercise: BENCH }).message,
    compareExercise({ mine: [{ date: '2019-01-01', entries: [] }], theirs, exerciseId: BENCH.id, exercise: BENCH }).message,
    compareExercise({ mine, theirs: [{ date: '2026-06-01', name: 'W' }, { date: '2026-08-01', name: 'W' }],
      exerciseId: BENCH.id, exercise: BENCH }).message,
  ];
  ok(msgs.every((m) => m && wordCount(m) <= 12), `P8: the empty-state sentences are 12 words or fewer (${msgs.map(wordCount).join(', ')})`);
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
