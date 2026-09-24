// Calculation bugs found by the 2026-09-24 whole-site review. No DOM.
//   node tests/review-maths.test.mjs
//
// Each block pins one bug with the reviewer's own reproduction, plus the
// "normal history is unchanged" half so a fix cannot quietly move ordinary
// numbers.

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { BUILT_IN_EXERCISES } = await import('../js/exercises.js');
const { personalBests } = await import('../js/personal-bests.js');
const { bestLifts } = await import('../js/profile-records.js');
const { ownBestSet } = await import('../js/exercise-estimate.js');
const { weightForTarget } = await import('../js/set-targets.js');
const { suggestProgression } = await import('../js/progression.js');
const { recordedSetCount } = await import('../js/session-stats.js');
const { buildObservations } = await import('../js/strength-observations.js');
const { weeklyVolumeByMuscle } = await import('../js/store.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };
const byName = (n) => BUILT_IN_EXERCISES.find((e) => e.name === n);
const exMap = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

const bench = byName('Barbell Bench Press');
const session = (date, exercise, sets) => ({ date, entries: [{ exerciseId: exercise.id, exerciseName: exercise.name, sets }] });

/* ---------- 1. one typo set no longer breaks PBs, best lifts and % targets ---------- */
{
  const hist = [
    session('2026-08-01', bench, [{ weight: 225, reps: 5 }]),
    session('2026-08-08', bench, [{ weight: 2250, reps: 5 }]),
  ];
  const today = [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 245, reps: 5 }] }];
  const pbs = personalBests(today, hist, [], exMap, { date: '2026-09-01' });
  const w = pbs.find((p) => p.kind === 'weight');
  ok(w && w.now === 245 && w.was === 225,
     `a real 245×5 after a typo 2250×5 is a Weight PR over 225 (${JSON.stringify(pbs.map((p) => [p.kind, p.now, p.was]))})`);
  ok(pbs.some((p) => p.kind === 'e1rm'), 'and a 1RM PR too');

  const lifts = bestLifts([...hist, { date: '2026-09-01', entries: today }], { exMap }).lifts;
  const b = lifts.find((l) => l.exerciseId === bench.id);
  ok(b && b.best.value === 245, `best lifts reads 245, not the typo (${b && b.best.value})`);
  ok(b && b.estimatedMax && b.estimatedMax.weight === 245, `and its estimated max comes off 245×5 (${b && b.estimatedMax && b.estimatedMax.weight})`);

  // The reviewer's t3: the % target prefilled 1875 lb.
  const sessions = [
    session('2026-08-01', bench, [{ weight: 225, reps: 5 }, { weight: 225, reps: 5 }]),
    session('2026-08-08', bench, [{ weight: 2250, reps: 5 }, { weight: 225, reps: 5 }]),
    session('2026-09-20', bench, [{ weight: 230, reps: 5 }]),
  ];
  const own = ownBestSet(bench, { sessions }, '2026-09-24');
  ok(own && own.weight === 230, `the estimated max anchors on 230×5, not 2250×5 (${own && own.weight}×${own && own.reps})`);
  const t = own && weightForTarget(75, own.e1rm, 5);
  ok(t && t.weight < 250, `so a 75 % target prefills ${t && t.weight} lb, not 1875`);

  // Normal histories are untouched: a real, big jump (under 2x) still counts.
  const real = [
    session('2026-08-01', bench, [{ weight: 225, reps: 5 }]),
    session('2026-08-08', bench, [{ weight: 275, reps: 5 }]),
  ];
  const now2 = [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 280, reps: 5 }] }];
  const pb2 = personalBests(now2, real, [], exMap, { date: '2026-08-15' }).find((p) => p.kind === 'weight');
  ok(pb2 && pb2.was === 275, `a genuine 275 is still the bar to beat (${pb2 && pb2.was})`);
  const now3 = [{ exerciseId: bench.id, exerciseName: bench.name, sets: [{ weight: 270, reps: 5 }] }];
  ok(!personalBests(now3, real, [], exMap, { date: '2026-08-15' }).some((p) => p.kind === 'weight'),
     'and 270 after a real 275 is no PR');
  const lone = bestLifts([session('2026-08-08', bench, [{ weight: 2250, reps: 5 }])], { exMap }).lifts[0];
  ok(lone && lone.best.value === 2250, 'one day on its own is never set aside — it is all the app knows');
  const repeated = bestLifts([
    session('2026-08-01', bench, [{ weight: 100, reps: 5 }]),
    session('2026-08-08', bench, [{ weight: 225, reps: 5 }]),
    session('2026-08-12', bench, [{ weight: 225, reps: 5 }]),
  ], { exMap }).lifts[0];
  ok(repeated && repeated.best.value === 225, 'a big jump repeated on another day is released, as on the muscle map');
}

/* ---------- 2. assisted pull-up with no weigh-in steps the help DOWN ---------- */
{
  const ap = byName('Assisted Pull-Up');
  const hist = [[{ weight: 70, reps: 12 }, { weight: 70, reps: 12 }], [{ weight: 70, reps: 12 }, { weight: 70, reps: 12 }]];
  const s = suggestProgression({ history: hist, exercise: ap, step: 5, bodyWeight: null });
  ok(s && s.kind === 'load' && s.weight < 70,
     `no weigh-in: the help goes down, not up (${s && s.kind} ${s && s.weight} | ${s && s.headline})`);
  ok(s && /help/.test(s.headline) && !/^\+/.test(s.headline), `and says "help" (${s && s.headline})`);
  ok(s && !/of your own weight/.test(s.why), `and does not invent a body-weight figure (${s && s.why})`);
  const withBw = suggestProgression({ history: hist, exercise: ap, step: 5, bodyWeight: 180 });
  ok(withBw && withBw.kind === 'load' && withBw.weight === 65, `with a weigh-in it is unchanged (${withBw && withBw.weight})`);

  const top = [[{ weight: 70, reps: 20 }, { weight: 70, reps: 20 }]];
  const c = suggestProgression({ history: top, exercise: ap, step: 5, bodyWeight: null });
  ok(c && /of help/.test(c.headline) && !/70 lbs × 20/.test(c.headline),
     `the 20-rep message keeps the help wording (${c && c.headline})`);
}

/* ---------- 3. the estimated max does not anchor on a tired set ---------- */
{
  const calf = byName('Standing Calf Raise');
  const own = ownBestSet(calf, { sessions: [
    session('2026-09-10', calf, [{ weight: 170, reps: 13 }, { weight: 170, reps: 8 }]),
  ] }, '2026-09-24');
  ok(own && own.reps === 13, `170×13 beats the fatigued 170×8 it dominates (${own && own.weight}×${own && own.reps})`);
  const own2 = ownBestSet(calf, { sessions: [
    session('2026-09-03', calf, [{ weight: 170, reps: 8 }]),
    session('2026-09-10', calf, [{ weight: 180, reps: 12 }]),
  ] }, '2026-09-24');
  ok(own2 && own2.weight === 180, `across days too (${own2 && own2.weight}×${own2 && own2.reps})`);
  // A real trade (heavier but shorter) still goes to the low-rep set.
  const own3 = ownBestSet(bench, { sessions: [
    session('2026-09-10', bench, [{ weight: 215, reps: 3 }, { weight: 185, reps: 12 }]),
  ] }, '2026-09-24');
  ok(own3 && own3.weight === 215, `heavier-but-shorter is a trade and the ≤8-rep set still wins (${own3 && own3.weight})`);
}

/* ---------- 4. weekly sets do not swing by day of the week ---------- */
{
  // A steady once-a-week chest day, 10 sets, every Monday for six months.
  const rows = [];
  const d0 = Date.UTC(2026, 2, 2); // Monday
  for (let i = 0; i < 210; i += 7) {
    const iso = new Date(d0 + i * 86400000).toISOString().slice(0, 10);
    rows.push({ id: 's' + i, date: iso, entries: [{ exerciseId: bench.id, sets: Array.from({ length: 10 }, () => ({ weight: 135, reps: 8 })) }] });
  }
  const seen = [];
  for (const t of ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']) {
    const v = await weeklyVolumeByMuscle(28, t, rows.filter((r) => r.date <= t));
    const chest = v && v.muscles.find((m) => m.muscle === 'Chest');
    seen.push(chest ? Math.round(chest.weeklySets * 100) / 100 : null);
  }
  ok(seen.every((x) => x === 10), `10 sets every Monday reads 10 a week on every day of the week (${seen.join(', ')})`);

  // A new account keeps the short span: 3 weeks of training is not divided by 4.
  const fresh = rows.filter((r) => r.date >= '2026-09-07' && r.date <= '2026-09-27');
  const v2 = await weeklyVolumeByMuscle(28, '2026-09-27', fresh);
  ok(v2 && v2.spanDays === 21, `a new account's span is still from its first session (${v2 && v2.spanDays})`);
}

/* ---------- 5. an empty set is not a recorded set ---------- */
{
  ok(recordedSetCount({ sets: [{ done: true }, { weight: 0, reps: 0, fromPlan: true }, { weight: '', reps: '' }] }) === 0,
     `a tick, a zeroed plan row and a blank row are not sets (${recordedSetCount({ sets: [{ done: true }, { weight: 0, reps: 0, fromPlan: true }, { weight: '', reps: '' }] })})`);
  ok(recordedSetCount({ sets: [{ weight: 135, reps: 8, prefilled: true, fromPlan: true }, { reps: 12 }, { time: 60 }, { distance: 2 }] }) === 4,
     'an untouched prefilled set with numbers still counts (Tim, 2026-09-23), as do reps, time and distance');
  ok(recordedSetCount({ sets: [{ weight: 0, reps: 0, minis: [{ weight: 50, reps: 8 }] }] }) === 1,
     'and a set whose numbers are all in its drops is one set');

  const fly = byName('Pec Deck') || byName('Cable Crossover');
  const obs = buildObservations({
    sessions: [{ date: '2026-09-20', entries: [
      { exerciseId: fly.id, sets: [{ done: true }, { weight: 0, reps: 0 }, { weight: '', reps: '' }] },
      { exerciseId: bench.id, sets: [{ weight: 225, reps: 5 }] },
    ] }],
    benchmarks: [], exMap, bodyWeights: [], today: '2026-09-24',
  });
  const chest = (obs.byMuscle.get('Chest') || []).find((o) => o.exerciseId === bench.id);
  ok(chest && chest.priorVolume === 0, `blank sets before the bench are not fatigue (${chest && chest.priorVolume})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
