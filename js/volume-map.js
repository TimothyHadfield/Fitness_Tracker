// Which muscles a set of an exercise actually WORKS, and how much of a set it
// counts as.
//
// docs/optimal-rating-plan.md Phase 1 · docs/research.md §6.4. Tim, 2026-08-18.
//
// ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────────
//
// ⚠️ This is NOT js/muscle-evidence.js, and confusing the two would be an easy
// and expensive mistake. They map the same exercises onto the same muscles and
// answer completely different questions:
//
//   muscle-evidence.js  "HOW STRONG is this muscle?"  — converts a lift into a
//                       key-lift equivalent so it can be ranked. Ratios,
//                       confidence, fallbacks.
//   volume-map.js       "HOW MUCH WORK LANDED HERE?" — counts sets per muscle
//                       so weekly volume can be totalled. Direct or indirect,
//                       nothing else.
//
// `progress.md` §9 has carried "exercise→muscle is a single string, this must
// change before D3" since the beginning, and assumed the fix was a continuous
// primary/secondary weighting. The evidence says otherwise, and says something
// simpler.
//
// ── THE 1.0 / 0.5 RULE ───────────────────────────────────────────────────────
//
// Pelland et al. (2025) compared three ways of counting a set against 67
// studies and 2058 participants:
//
//   'direct'      only the primary force generator counts
//   'total'       any involvement counts as a whole set
//   'fractional'  an indirect set counts as HALF          ← best supported
//
// 'fractional' won by strong-to-very-strong Bayes factors on the Kass-Raftery
// scale, for both hypertrophy (2xlog(BF) 9.48 over 'total', 10.29 over
// 'direct') and strength (18.21 and 45.96). So: direct = 1.0, indirect = 0.5.
//
// ⚠️ The authors' own caveat, which belongs here and not only in the docs:
// 0.5 "is still an assumption", and the method "should be regarded as a
// heuristic to improve the accuracy of dose-response modeling, rather than a
// definitive standard for practical application across all contexts."
//
// ── WHERE THE CLASSIFICATIONS COME FROM ──────────────────────────────────────
//
// The big ones are not invented here. Table 1 of that paper lists exactly which
// exercises the authors counted as direct and indirect per muscle, and it
// anchors the cases that matter most:
//
//   - bench press variants are INDIRECT for triceps and for anterior deltoid
//   - shoulder press variants are INDIRECT for triceps
//   - lat pulldowns and rows are INDIRECT for biceps, and for trapezius
//   - squats and leg presses are DIRECT for quadriceps
//
// Everything beyond that list is applied judgement in the same spirit, and it
// is judgement, not measurement. Two guards on that:
//
//   1. The FALLBACK IS CONSERVATIVE. An exercise matching no rule contributes
//      one direct muscle — the library's own `muscle` field — and no indirect
//      work at all. Unmatched exercises therefore UNDERCOUNT rather than
//      inventing volume, which is the right way for this to be wrong.
//   2. The 0.5 is a named constant and the rating's validation deliberately
//      re-runs with it moved (0.3 / 0.7) to see whether any conclusion depends
//      on it. See docs/optimal-rating-plan.md §5.
//
// Pure: no DOM, no store. Same as e1rm.js, set-types.js, social.js.

export const DIRECT = 1.0;
export const INDIRECT = 0.5;

/**
 * The muscle groups weekly volume is totalled over.
 *
 * Excluded on purpose:
 *   'Full Body' and 'Cardio' are not muscles — they are library shelves.
 *   'Neck' is a real muscle group with real exercises, but essentially no
 *   programme trains it, so including it would dock every programme by the same
 *   amount for the same reason and tell nobody anything. It still gets counted
 *   if somebody trains it; it just does not drag the average.
 */
export const VOLUME_MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Traps', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core',
];

/**
 * The muscles a programme's SCORE is averaged over. Core is counted and shown,
 * but does not drag the average — and the reason is specific, not squeamish.
 *
 * ⚠️ The distinction is whether face-value set counting is accurate for that
 * muscle. Calves are trained by calf exercises, which are logged as sets, so
 * counting them at face value is right — a programme with no calf work really
 * does neglect calves and should be marked down for it (running the nine
 * shipped systems, several genuinely score zero, and that is a true statement
 * about them). Core is different: it is trained substantially by squats,
 * deadlifts, carries and overhead pressing, none of which log a set against it.
 * Counting Core at face value therefore understates it *systematically*, for
 * every programme, in a way no amount of care in the mapping would fix.
 *
 * The alternative was to credit compounds with indirect core work, which would
 * mean inventing a number the literature does not offer — docs/research.md §6
 * has a dose response for limb muscles, not for bracing. Reporting Core
 * honestly and leaving it out of the average is the smaller assumption.
 */
export const SCORED_MUSCLES = VOLUME_MUSCLES.filter((m) => m !== 'Core');

/** Exercises here produce no resistance-training volume for any muscle. */
const NO_VOLUME = new Set(['Cardio']);

/**
 * name pattern -> extra muscles beyond the library's own `muscle` field.
 *
 * ORDER MATTERS: the first match wins, so narrower patterns come first. The
 * classic trap is "Cable Kickback", which exists TWICE in the library — once as
 * a glute exercise and once as a triceps one — so anything matching on name
 * alone has to be qualified by the primary muscle. `only` overrides the
 * library's muscle entirely; `also` adds indirect work alongside it.
 */
const RULES = [
  /* ---- chest ---- */
  // Presses drive the triceps and anterior delt. Table 1: indirect for both.
  { muscle: 'Chest', when: /press|push-up|dip/i, also: ['Triceps', 'Shoulders'] },
  // Flyes and crossovers are the isolation case — no meaningful triceps work,
  // and the delt contribution is small enough not to claim.
  { muscle: 'Chest', when: /fly|pec deck|crossover/i, also: [] },
  { muscle: 'Chest', when: /pullover/i, also: ['Back'] },

  /* ---- back ---- */
  // A deadlift is the whole posterior chain. D16 already gives glutes the
  // ranking credit; for VOLUME it feeds several at once.
  { muscle: 'Back', when: /deadlift|rack pull/i, also: ['Hamstrings', 'Glutes', 'Traps', 'Forearms'] },
  // Erector work that is really hip hinge.
  { muscle: 'Back', when: /good morning|extension|hyperextension/i, also: ['Hamstrings', 'Glutes'] },
  // Straight-arm work keeps the elbow out of it, so no biceps.
  { muscle: 'Back', when: /straight-arm|pullover/i, also: [] },
  { muscle: 'Back', when: /row/i, also: ['Biceps', 'Forearms', 'Traps'] },
  { muscle: 'Back', when: /pull-?up|chin-?up|pulldown/i, also: ['Biceps', 'Forearms'] },

  /* ---- shoulders ---- */
  { muscle: 'Shoulders', when: /raise|fly|pec deck/i, also: [] },
  { muscle: 'Shoulders', when: /face pull/i, also: ['Traps', 'Biceps'] },
  { muscle: 'Shoulders', when: /upright row/i, also: ['Traps', 'Biceps'] },
  { muscle: 'Shoulders', when: /press|push-?up/i, also: ['Triceps'] },

  /* ---- arms ---- */
  // Every curl loads the forearm; the brachioradialis variants most of all,
  // but not enough to call it direct.
  { muscle: 'Biceps', when: /./, also: ['Forearms'] },
  // Dips and the press-shaped triceps builders share load with the chest.
  { muscle: 'Triceps', when: /dip/i, also: ['Chest', 'Shoulders'] },
  { muscle: 'Triceps', when: /jm press|california|tate/i, also: ['Chest'] },
  { muscle: 'Triceps', when: /./, also: [] },
  // ⚠️ Wrist curls FIRST, and this ordering is a bug that was caught by the
  // audit rather than by reading. A bare /curl/ rule matched "Wrist Curl" and
  // "Behind-the-Back Wrist Curl" and handed them biceps volume, which is wrong:
  // the elbow does not move. A reverse curl genuinely does train the elbow
  // flexors; a wrist curl genuinely does not.
  { muscle: 'Forearms', when: /wrist/i, also: [] },
  { muscle: 'Forearms', when: /curl/i, also: ['Biceps'] },
  { muscle: 'Forearms', when: /./, also: [] },

  /* ---- traps ---- */
  { muscle: 'Traps', when: /carry/i, also: ['Forearms', 'Core', 'Shoulders'] },
  { muscle: 'Traps', when: /shrug/i, also: ['Forearms'] },

  /* ---- legs ---- */
  { muscle: 'Quads', when: /extension|sissy|wall sit/i, also: [] },
  { muscle: 'Quads', when: /lunge|step-up|split squat|curtsy/i, also: ['Glutes', 'Hamstrings'] },
  { muscle: 'Quads', when: /squat|leg press/i, also: ['Glutes'] },

  { muscle: 'Hamstrings', when: /leg curl|nordic|slider/i, also: [] },
  { muscle: 'Hamstrings', when: /deadlift|pull-through|swing|glute-ham/i, also: ['Glutes', 'Back'] },

  { muscle: 'Glutes', when: /abduction|adduction|kickback|frog/i, also: [] },
  { muscle: 'Glutes', when: /thrust|bridge/i, also: ['Hamstrings'] },
  { muscle: 'Glutes', when: /squat/i, also: ['Quads', 'Hamstrings'] },

  /* ---- Full Body ----
   * ⚠️ These get NO direct muscle at all, and that is deliberate rather than
   * lazy. An Olympic lift is limited by technique and power output long before
   * any one muscle is driven near failure, and the hypertrophy literature these
   * weights come from is built almost entirely on sets taken close to failure
   * (docs/research.md §6.7). Counting a clean as a direct set for the quads
   * would inflate a CrossFit-shaped programme's rating on evidence that does
   * not cover it. Indirect-only says "this trains these muscles, and we are not
   * claiming it is a targeted growth stimulus". */
  { muscle: 'Full Body', when: /clean and jerk|clean and press/i, only: [], also: ['Quads', 'Glutes', 'Back', 'Traps', 'Shoulders', 'Triceps'] },
  { muscle: 'Full Body', when: /clean|snatch/i, only: [], also: ['Quads', 'Glutes', 'Hamstrings', 'Back', 'Traps', 'Shoulders'] },
  { muscle: 'Full Body', when: /thruster/i, only: [], also: ['Quads', 'Glutes', 'Shoulders', 'Triceps'] },
  { muscle: 'Full Body', when: /turkish/i, only: [], also: ['Shoulders', 'Core'] },
  { muscle: 'Full Body', when: /battle ropes/i, only: [], also: ['Shoulders', 'Core'] },
  { muscle: 'Full Body', when: /slam/i, only: [], also: ['Core', 'Back', 'Shoulders'] },
  { muscle: 'Full Body', when: /sled push/i, only: [], also: ['Quads', 'Glutes', 'Calves'] },
  { muscle: 'Full Body', when: /sled drag/i, only: [], also: ['Quads', 'Glutes', 'Hamstrings'] },
  { muscle: 'Full Body', when: /tire flip/i, only: [], also: ['Quads', 'Glutes', 'Back', 'Chest'] },
  { muscle: 'Full Body', when: /burpee/i, only: [], also: ['Chest', 'Quads'] },
  { muscle: 'Full Body', when: /jump/i, only: [], also: ['Quads', 'Glutes', 'Calves'] },
  { muscle: 'Full Body', when: /complex/i, only: [], also: ['Quads', 'Glutes', 'Back', 'Shoulders'] },
];

/**
 * Every muscle one set of this exercise counts toward, and by how much.
 *
 * Returns [] for cardio, and for anything that trains nothing countable.
 * @returns {{muscle: string, kind: 'direct'|'indirect', weight: number}[]}
 */
export function volumeContributions(exercise) {
  if (!exercise || !exercise.muscle) return [];
  if (NO_VOLUME.has(exercise.muscle)) return [];

  const name = String(exercise.name || '');
  const rule = RULES.find((r) => r.muscle === exercise.muscle && r.when.test(name));

  // No rule: the library's own muscle, direct, and nothing else. Undercounts on
  // purpose — see the header.
  const direct = rule && rule.only !== undefined
    ? rule.only
    : [exercise.muscle];
  const indirect = rule ? (rule.also || []) : [];

  const out = [];
  const seen = new Set();
  for (const m of direct) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push({ muscle: m, kind: 'direct', weight: DIRECT });
  }
  for (const m of indirect) {
    // A muscle already counted as direct is never also counted as indirect —
    // otherwise a single set of an exercise could total 1.5 sets for one muscle.
    if (seen.has(m)) continue;
    seen.add(m);
    out.push({ muscle: m, kind: 'indirect', weight: INDIRECT });
  }
  return out;
}

/**
 * Fractional weekly sets per muscle for a whole programme.
 *
 * @param {Array} workouts   [{ exercises: [{ exerciseId, sets }] }]
 * @param {Map}   exMap      exerciseId -> exercise
 * @param {number} weeks     how many weeks the workout list spans (a system of
 *                           6 workouts is one week; Bumstead's 8-day cycle is
 *                           8/7 of one, which is why this is a parameter and
 *                           not a count of workouts)
 * @returns {Map<string, number>} muscle -> fractional sets per week
 */
export function weeklyVolume(workouts, exMap, weeks = 1) {
  const out = new Map();
  const span = weeks > 0 ? weeks : 1;

  for (const w of workouts || []) {
    for (const item of (w && w.exercises) || []) {
      // ⚠️ ONE set is one set, whatever is nested inside it. A drop set or a
      // myo-rep counts once (D23), and because `sets` is a plain count that is
      // already true here — but it is true by construction rather than by luck,
      // and anything that later reads minis[] must not change that.
      const sets = Number(item.sets) > 0 ? Number(item.sets) : 0;
      if (!sets) continue;
      const ex = exMap && exMap.get ? exMap.get(item.exerciseId) : null;
      if (!ex) continue;
      for (const c of volumeContributions(ex)) {
        out.set(c.muscle, (out.get(c.muscle) || 0) + sets * c.weight / span);
      }
    }
  }
  return out;
}

/**
 * How many sessions a week train each muscle.
 *
 * ⚠️ Not the same as the programme's days per week, and the difference is the
 * whole point. A six-day "bro split" trains chest on ONE of those six days, so
 * its frequency for chest is 1, not 6. Frequency only matters for strength
 * (docs/research.md §6.3), and it matters per muscle rather than per calendar.
 *
 * Counts a session if it contains any DIRECT work for the muscle. Indirect work
 * is real volume but it is not the muscle being trained that day, and counting
 * it would make every pressing day a "back day" because of the deadlift.
 */
export function weeklyFrequency(workouts, exMap, weeks = 1) {
  const out = new Map();
  const span = weeks > 0 ? weeks : 1;

  for (const w of workouts || []) {
    const hit = new Set();
    for (const item of (w && w.exercises) || []) {
      if (!(Number(item.sets) > 0)) continue;
      const ex = exMap && exMap.get ? exMap.get(item.exerciseId) : null;
      if (!ex) continue;
      for (const c of volumeContributions(ex)) {
        if (c.kind === 'direct') hit.add(c.muscle);
      }
    }
    for (const m of hit) out.set(m, (out.get(m) || 0) + 1 / span);
  }
  return out;
}

/**
 * Which efficiency tier a weekly volume sits in, for HYPERTROPHY.
 *
 * Straight from Table 3 of Pelland et al. (2025). These are not our bands and
 * they are not rounded — the description is what another increment costs you,
 * which is the give/get question docs/vision.md §1.3 actually asks.
 */
export const HYPERTROPHY_TIERS = [
  { max: 3.999, key: 'below', label: 'Below the minimum effective dose',
    detail: 'Less than 4 sets a week. Not enough to expect a detectable change.' },
  { max: 4.999, key: 'minimum', label: 'Minimum effective dose',
    detail: 'About 4 sets. Enough to produce a detectable change.' },
  { max: 10.999, key: 'higher', label: 'Higher efficiency',
    detail: 'The best value per set — around 6 more sets buys another detectable step.' },
  { max: 18.999, key: 'intermediate', label: 'Intermediate efficiency',
    detail: 'Around 8.5 more sets buys another detectable step.' },
  { max: 29.999, key: 'lower', label: 'Lower efficiency',
    detail: 'Around 10.75 more sets buys another detectable step.' },
  { max: 42.999, key: 'lowest', label: 'Lowest efficiency',
    detail: 'Around 12.5 more sets buys another detectable step.' },
  { max: Infinity, key: 'unclear', label: 'Beyond the evidence',
    detail: 'Past 43 sets a week there is not enough data — and it may produce less growth, not more.' },
];

export function hypertrophyTier(weeklySets) {
  const v = Number(weeklySets) || 0;
  return HYPERTROPHY_TIERS.find((t) => v <= t.max) || HYPERTROPHY_TIERS[HYPERTROPHY_TIERS.length - 1];
}

/** The same, for STRENGTH — Table 4. Note how much earlier it flattens. */
export const STRENGTH_TIERS = [
  { max: 0.999, key: 'below', label: 'Below the minimum effective dose',
    detail: 'Less than 1 set a week for this movement.' },
  { max: 1.999, key: 'minimum', label: 'Minimum effective dose',
    detail: 'About 1 set. Enough to produce a detectable strength gain.' },
  { max: 2.999, key: 'higher', label: 'Higher efficiency',
    detail: 'Around 0.75 more sets buys another detectable step.' },
  { max: 4.999, key: 'intermediate', label: 'Intermediate efficiency',
    detail: 'Around 2.25 more sets buys another detectable step.' },
  { max: Infinity, key: 'plateau', label: 'Past the plateau',
    detail: 'Beyond about 5 sets, more volume does not reliably add strength.' },
];

export function strengthTier(weeklySets) {
  const v = Number(weeklySets) || 0;
  return STRENGTH_TIERS.find((t) => v <= t.max) || STRENGTH_TIERS[STRENGTH_TIERS.length - 1];
}
