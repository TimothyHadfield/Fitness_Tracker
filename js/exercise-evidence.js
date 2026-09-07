// What the research actually supports about individual EXERCISES.
//
// The data layer for two things: a workout-template lint ("this day trains back
// with rows and pulldowns and has no direct biceps work"), and an in-app
// explanation of why an exercise is worth its slot. Neither of those is written
// here. This file is the claims and the citations, nothing else.
//
// Pure: no DOM, no store, no network, no clock. Same reason as e1rm.js,
// muscle-evidence.js and research-topics.js — it is fully testable headlessly,
// which is the pattern that has caught real bugs in this project. A lint that
// can only be exercised by clicking through a template is a lint nobody checks.
//
// ── THE ONE FACT THAT SHAPES THIS WHOLE FILE ────────────────────────────────
//
// `Fitness_Research/` holds 781 notes drawn from five sources and roughly
// 10,000 papers. Its arbiter file, WHAT-TO-BELIEVE.md, does the counting:
// across all of it, **about sixteen claims about exercise choice are backed by
// measured muscle growth.** Everything else — every tier list, every "targets
// the upper pecs", the entire back and lat hierarchy, every side delt, rear
// delt and forearm ranking — rests on surface EMG, moment-arm modelling, or
// bare anatomy.
//
// So the app has 319 exercises and this file has 23 entries. That is not a gap
// to be filled later. **Most exercises should have no entry, because nobody has
// measured them**, and `evidenceFor()` returning null is the honest answer and
// the common one. The library's own governing rule applies here without
// exception: under-inclusion beats a wrong or overstated claim.
//
// The distinction is made machine-readable rather than hidden, in `tier`:
//
//   'measured' — a training study measured muscle size (MRI, ultrasound, CSA)
//                after weeks of training. The only tier that settles anything.
//   'emg'      — surface electromyography during a single session. Electrical
//                excitation, not growth. The library's own teardown is decisive:
//                the triceps long head shows HIGH EMG on the bench press and
//                barely grows from it, which is exactly the inference EMG gets
//                used to make.
//   'anatomy'  — joint geometry and moment arms. A physics calculation, not a
//                measurement of anything in a training human.
//
// ⚠️ A CLAIM MAY NEVER SAY MORE THAN ITS TIER SUPPORTS. If the tier is 'emg' or
// 'anatomy' the sentence must not say a muscle grows more, and the two anatomy
// entries below name what was and was not tested inside the claim itself.
//
// ── THE RULES THIS FILE IS WRITTEN UNDER ────────────────────────────────────
//
// These mirror `js/research-topics.js`. Read its header first; the arguments
// are the same and were paid for in the same incidents.
//
// 1. ⚠️ EVERY CLAIM NAMES A SOURCE, and every source is defined ONCE in
//    SOURCES. A citation written inline is a citation that drifts — the Goals
//    screen learned that when a hand-written paraphrase of INDIRECT_NOTE
//    quietly lost the words "not a measured fact" (docs/research.md §6.17).
//
// 2. ⚠️ CONFIDENCE IS A FIELD, NOT A TONE. Same three words as research-topics,
//    and deliberately the same bar:
//      `strong`  two or more independent syntheses agree.
//      `good`    one solid meta-analysis, or one well-run trial.
//      `limited` intervals cross zero, the corpus is small, or it is a preprint.
//    Nothing goes in below `limited`.
//
//    ⚠️ AND NOTE WHAT THAT COSTS, because it is the finding: exercise selection
//    has almost no synthesis literature at all. Exactly ONE entry here reaches
//    `strong` — that free weights and machines grow muscle equally when sets go
//    near failure, which has a meta-analysis behind it as well as two trials.
//    Every other entry is capped at `good` no matter how many trials agree,
//    because trials are not syntheses. Keeping the same bar as the other file
//    is worth more than making this one look better stocked.
//
// 3. ⚠️ A NULL RESULT IS A FINDING AND IS WRITTEN AS ONE. "Push-ups matched the
//    bench press" is a real entry and gets the same treatment as a win. So does
//    the cable-versus-dumbbell lateral raise null, which is the cleanest
//    demonstration in the library that resistance-profile reasoning — the logic
//    driving most published tier lists — does not predict growth. It was a
//    prediction, it was tested, and it failed.
//
// 4. ⚠️ WHERE THE LIBRARY FLAGS A STUDY AS DISPUTED, IT IS LEFT OUT. See
//    "What was deliberately not written" below. The rule is not "pick the
//    reading you like and stay quiet".
//
// 5. ⚠️ NO PRESCRIPTIONS FOR A PERSON. This is what studies measured, not what
//    anyone should do on Tuesday. Same D9 line research-topics.js draws.
//
// ⚠️ THE LONG FORM OF ALL OF THIS IS `Fitness_Research/`, and specifically
// WHAT-TO-BELIEVE.md, which is the arbiter: where the five sources disagree it
// says which is right and how confident that deserves to be. **Its verdicts
// beat any single source**, and where a source's own summary is more generous
// than the arbiter, the arbiter won. Nothing may be added here that is not
// there first.
//
// ── WHAT WAS DELIBERATELY NOT WRITTEN ───────────────────────────────────────
//
// Recording the omissions, because a reader six months from now will otherwise
// assume these were missed rather than refused.
//
//   · **Bench angle / incline versus flat.** Chaves 2020 is the only outcome
//     trial and the arbiter calls it "the weakest entry" of the sixteen: three
//     sources read it three incompatible ways, and House of Hypertrophy
//     dismantles it on method — pec thickness rising 54–62% across eight
//     training sessions, and only 30 of 47 completers appearing in the
//     hypertrophy data with no explanation. Verdict: "Chaves cannot carry the
//     claim." So there is no incline entry. Incline work may well be worth
//     doing; the usual reason given for it is not evidence.
//   · **The entire back and lat hierarchy.** The library's most thorough
//     treatment of it states twice, unprompted, that it contains zero direct
//     measurements of lat growth. Rows versus pulldowns has never been tested.
//     `back-squat--quads` and `dumbbell-row--back` appear below only because a
//     trial measured something else while they were being trained.
//   · **Side delts, rear delt ordering, forearms, traps.** No hypertrophy trial
//     exists for any of them. The one rear delt entry below is EMG and says so.
//   · **Squat depth.** The two trials disagree about which tissue benefits —
//     Bloomquist found deep better for the quads, Kubo found the depth
//     advantage was adductor and glute with the quadriceps statistically
//     indistinguishable (4.9% vs 4.6%). A depth claim would have to pick one.
//   · **Exercise variety and rotation.** Real growth data (a randomised
//     80-exercise selector versus a fixed list came back null), but it is a
//     programming claim about a whole block, not a fact about an exercise id.
//     Out of scope for this schema rather than out of evidence.
//   · **Anything sourced to Barbalho** (retracted for implausible data) **or to
//     Gentil 2015** (House of Hypertrophy used it at face value in 2022, then
//     by 2024 flagged that paper's author for involvement in multiple studies
//     with statistical anomalies and discounted it — both readings cannot
//     stand, so neither is used).
//   · **Shoulders in MUSCLE_COVERAGE.** The case that pressing cannot cover the
//     side delt is moment-arm modelling, and the one prediction that method
//     produced and got tested — cables beating dumbbells — failed. A lint
//     firing on it would be firing on leverage arithmetic.
//
// A muscle with no MUSCLE_COVERAGE entry means nothing has been measured, not
// that nobody looked. Back, Shoulders, Traps, Forearms and Core are all in that
// position and `coverageFor()` returns null for each.

/**
 * Every source, defined once.
 *
 * ⚠️ `title`, `journal` and `doi` are OPTIONAL, AND A MISSING ONE IS DELIBERATE
 * RATHER THAN LAZY. `Fitness_Research/` is written from video notes and article
 * notes; it records authors, years, sample sizes and results, and for most
 * studies it does not record a journal or a DOI. Supplying one from memory is
 * precisely the drift rule 1 exists to prevent, and a wrong citation is worse
 * than an incomplete one — the same argument research-topics.js makes about a
 * wrong URL. So the fields appear only where the library or the paper itself
 * makes them certain.
 *
 * `label` and `n` are therefore the two fields a renderer can always rely on.
 * `n` says what the study actually covered, because "two independent trials,
 * 64 people" and "10 untrained men" are different claims that read identically
 * once they are both called "research". Where the library flags a problem with
 * a citation — an unverifiable link, a preprint, a disputed year — `n` says so.
 */
export const SOURCES = {
  maeo2023: {
    label: 'Maeo et al. (2023), overhead versus pushdown triceps extensions',
    authors: 'Maeo et al.',
    year: 2023,
    title: 'Triceps brachii hypertrophy is substantially greater after elbow extension training '
      + 'performed in the overhead versus neutral arm position',
    journal: 'European Journal of Sport Science',
    n: '21 adults, within-subject (one arm each), 12 weeks, MRI muscle volume, range of motion '
      + 'matched at 0–90°, arm order alternated each session',
  },
  maeo2021: {
    label: 'Maeo et al. (2021), seated versus lying leg curls',
    authors: 'Maeo et al.',
    year: 2021,
    title: 'Greater hamstrings muscle hypertrophy but similar damage protection after training at '
      + 'long versus short muscle lengths',
    journal: 'Medicine & Science in Sports & Exercise',
    n: '12 weeks, MRI muscle volume, with the short head of biceps femoris — which does not cross '
      + 'the hip — as an internal control',
  },
  brandao2020: {
    label: 'Brandão et al. (2020), bench press versus skull crushers, MRI by triceps head',
    authors: 'Brandão et al.',
    year: 2020,
    title: 'Varying the order of combinations of single- and multi-joint exercises differentially '
      + 'affects resistance training adaptations',
    n: '43 untrained men, four groups, 10 weeks at 80% 1RM to failure, MRI cross-sectional area '
      + 'measured head by head. About 10–11 subjects per cell, and the two combined-exercise groups '
      + 'did double the total sets, so only bench-only versus skull-crusher-only is volume-matched',
  },
  wakahara2013: {
    label: 'Wakahara et al. (2013), regional triceps growth after pressing',
    authors: 'Wakahara et al.',
    year: 2013,
    title: 'Nonuniform muscle hypertrophy: its relation to muscle activation in training session',
    n: '12 weeks of neutral-grip dumbbell bench pressing; long head thickness did not increase',
  },
  burke2024: {
    label: 'Burke et al. (2024), leg press versus leg extension and straight- versus bent-leg calf raises',
    authors: 'Burke et al.',
    year: 2024,
    n: '28 trained subjects, within-subject (one leg each), all sets to failure at 8–12 reps. Three '
      + 'measurement regions for the quads but only one per calf muscle, so the calf half is thinner data',
  },
  kinoshita2023: {
    label: 'Kinoshita et al. (2023), straight- versus bent-leg calf raises',
    authors: 'Kinoshita et al.',
    year: 2023,
    n: 'untrained subjects, within-subject; the second of two independent designs reaching the same '
      + 'gastrocnemius result',
  },
  vanvossel2024: {
    label: 'Van Vossel et al. (2024), what leg curls do to the calves',
    authors: 'Van Vossel et al.',
    year: 2024,
    n: 'small non-significant lateral gastrocnemius growth, virtually none medial',
  },
  fonseca2014: {
    label: 'Fonseca et al. (2014), squat-only versus varied quadriceps training',
    authors: 'Fonseca et al.',
    year: 2014,
    n: '49 untrained men, 12 weeks, 2×/week, five groups. ⚠️ The library\'s own citation for this '
      + 'study is a dead link and its details could not be checked — it is kept because Kubo 2019 '
      + 'and Burke 2024 reach the same conclusion from verifiable sources',
  },
  kubo2019: {
    label: 'Kubo et al. (2019), squat depth and lower-limb muscle volume',
    authors: 'Kubo et al.',
    year: 2019,
    title: 'Effects of squat training with different depths on lower limb muscle volumes',
    journal: 'European Journal of Applied Physiology',
    n: '17 untrained men, 10 weeks, 90° versus 140° knee flexion. Neither depth grew the rectus '
      + 'femoris and neither grew the hamstrings',
  },
  bloomquist2013: {
    label: 'Bloomquist et al. (2013), deep versus shallow squatting',
    authors: 'Bloomquist et al.',
    year: 2013,
    title: 'Effect of range of motion in heavy load squatting on muscle and tendon adaptations',
    journal: 'European Journal of Applied Physiology',
    n: '12 weeks, MRI, 0–120° against 0–60°. Hamstring changes were minimal in some regions and '
      + 'negative in others at both depths',
  },
  mannarino2021: {
    label: 'Mannarino et al. (2021), dumbbell row versus dumbbell curl',
    authors: 'Mannarino et al.',
    year: 2021,
    n: '10 untrained men, within-subject (one arm each), 4–6 sets of 8–12 to failure twice weekly '
      + 'for 8 weeks, both arms supinated. A second experiment by the same team in 9 men — with '
      + 'overlapping participants, confirmed with the authors — points the same way. ⚠️ One note in '
      + 'the library dates this 2018 from auto-captions; 2021 is the date in the resolved reference lists',
  },
  conley1997: {
    label: 'Conley et al. (1997), neck training versus compound-only training',
    authors: 'Conley et al.',
    year: 1997,
    title: 'Specificity of resistance training responses in neck muscle size and strength',
    n: '22 men, 12 weeks on a four-day programme of squats, Romanian deadlifts, mid-thigh pulls, '
      + 'rows and shrugs, with one group adding nine weekly sets of neck extensions',
  },
  schwanbeck2020: {
    label: 'Schwanbeck et al. (2020), free weights versus machines',
    authors: 'Schwanbeck et al.',
    year: 2020,
    title: 'Effects of training with free weights versus machines on muscle mass, strength, free '
      + 'testosterone, and free cortisol levels',
    n: '36 people averaging about 2 years of training, 8 weeks, programmes matched movement for '
      + 'movement, every set to failure. Ultrasound, two muscles — a null in an underpowered trial '
      + 'on its own',
  },
  hernandezbelmonte2023: {
    label: 'Hernández-Belmonte et al. (2023), barbell versus machine training in trained men',
    authors: 'Hernández-Belmonte et al.',
    year: 2023,
    n: '36 trained men, 8 weeks, 3 sets per exercise 3×/week stopped at 20% velocity loss. Similar '
      + 'quadriceps growth at two measurement sites plus pec major and rectus abdominis. This is the '
      + 'trial that makes the equipment verdict safe',
  },
  haugen2023: {
    label: 'Haugen et al. (2023), free weights versus machines, pooled',
    authors: 'Haugen et al.',
    year: 2023,
    n: 'systematic review and meta-analysis; the only synthesis anywhere in this domain',
  },
  plotkin2023: {
    label: 'Plotkin et al. (2023), back squat versus hip thrust for glute growth',
    authors: 'Plotkin et al.',
    year: 2023,
    title: 'Hip thrust and back squat training elicit similar gluteus muscle hypertrophy and '
      + 'transfer similarly to the deadlift',
    n: '34 untrained individuals, 2×/week, 8–12 reps to volitional failure, squatters going as deep '
      + 'as comfortable. Gluteus maximus measured at upper, middle and lower regions. ⚠️ It was a '
      + 'bioRxiv preprint when one source cited it without saying so',
  },
  kikuchi2017: {
    label: 'Kikuchi & Nakazato (2017), push-ups versus the bench press',
    authors: 'Kikuchi & Nakazato',
    year: 2017,
    title: 'Low-load bench press and push-up induce similar muscle hypertrophy and strength gain',
    journal: 'Journal of Exercise Science and Fitness',
    n: '18 men with at least a year of training, split 9/9, 3 sets to failure twice weekly for 8 '
      + 'weeks. The bench group worked at 40% of 1RM; the push-up group did kneeling push-ups. About '
      + '3 mm of thickness at pecs and triceps in both',
  },
  kotarsky2018: {
    label: 'Kotarsky et al. (2018), progressive push-ups versus the bench press',
    authors: 'Kotarsky et al.',
    year: 2018,
    n: '23 novices, only 4 weeks; neither group reached significance, with raw percentages favouring '
      + 'push-ups. A replication in direction only',
  },
  nunes2020: {
    label: 'Nunes et al. (2020), cable versus barbell preacher curls',
    authors: 'Nunes et al.',
    year: 2020,
    n: '10 weeks, two opposite torque-emphasis profiles, elbow flexor thickness measured at one '
      + 'region. The cable version was stronger only when tested at long muscle lengths',
  },
  larsen2025: {
    label: 'Larsen et al. (2025), cable versus dumbbell lateral raises',
    authors: 'Larsen et al.',
    year: 2025,
    n: '24 trained lifters averaging 7.1 years, within-subject (one arm each), 5 sets to failure at '
      + '12–16 reps twice weekly for 8 weeks, range matched at 0–90°, cuffs used to remove grip '
      + 'fatigue. ⚠️ Total growth in both conditions was small and not far off measurement error',
  },
  botton2013: {
    label: 'Botton et al. (2013), posterior deltoid activation across exercises',
    authors: 'Botton et al.',
    year: 2013,
    n: 'surface EMG, single session — excitation, not growth',
  },
  campos2020: {
    label: 'Campos et al. (2020), posterior deltoid activation across exercises',
    authors: 'Campos et al.',
    year: 2020,
    n: 'surface EMG, single session — excitation, not growth',
  },
};

/**
 * What the evidence says about one exercise, keyed by the id in exercises.js
 * (`slugify(name) + '--' + slugify(muscle)`).
 *
 * ⚠️ IDS ARE NOT GUESSABLE AND MUST NOT BE GUESSED. "Cable Kickback" exists
 * twice in the library, under Triceps and under Glutes, so a name does not
 * identify an exercise. Every key here is asserted against BUILT_IN_EXERCISES
 * in tests/exercise-evidence.test.mjs, and so is every `betterThan` id.
 *
 * `betterThan` is used ONLY where one trial measured growth in both exercises
 * and one won on the whole muscle. It is deliberately absent from the entries
 * where the result was regional — the leg press and the leg extension grew
 * different quadriceps heads, and the bench press and the skull crusher grew
 * different triceps heads, and calling either one "better" would be the exact
 * overstatement this file exists to avoid. Those splits live in the claim text.
 */
export const EXERCISE_EVIDENCE = {
  /* ---------- Chest ---------- */

  'barbell-bench-press--chest': {
    tier: 'measured',
    claim: 'Grows the pectorals well, and grows the lateral and medial heads of the triceps while '
      + 'leaving the long head behind — measured by MRI head by head.',
    sources: ['brandao2020', 'wakahara2013'],
    confidence: 'good',
  },

  'push-up--chest': {
    tier: 'measured',
    claim: 'Matched a bench press loaded to 40% of 1RM for pec and triceps thickness in men with a '
      + 'year of training, when both were taken to failure.',
    sources: ['kikuchi2017', 'kotarsky2018'],
    confidence: 'good',
  },

  'machine-chest-press--chest': {
    tier: 'measured',
    claim: 'Grew the chest comparably to barbell pressing; machines and free weights produce similar '
      + 'hypertrophy when sets are taken close to failure, though strength transfers back to whichever '
      + 'mode was trained.',
    sources: ['hernandezbelmonte2023', 'schwanbeck2020', 'haugen2023'],
    confidence: 'strong',
  },

  /* ---------- Back ---------- */

  // ⚠️ The only back entry in the file, and the claim is about the ARMS. No
  // study has measured lat, trap or rhomboid growth from any back exercise.

  'dumbbell-row--back': {
    tier: 'measured',
    claim: 'Grew the elbow flexors about 5% against about 11% for a dumbbell curl trained the same '
      + 'way, so rowing is a real arm stimulus but not a maximal one.',
    sources: ['mannarino2021'],
    confidence: 'good',
  },

  /* ---------- Shoulders ---------- */

  'lateral-raise--shoulders': {
    tier: 'measured',
    claim: 'Grew the side delts the same amount as a cable lateral raise in trained lifters, '
      + 'contradicting the resistance-profile reasoning that predicted the cable would win.',
    sources: ['larsen2025'],
    confidence: 'good',
  },

  'cable-lateral-raise--shoulders': {
    tier: 'measured',
    claim: 'Grew the side delts the same amount as a dumbbell lateral raise in trained lifters, with '
      + 'total growth in both conditions close to measurement error.',
    sources: ['larsen2025'],
    confidence: 'good',
  },

  'reverse-pec-deck--shoulders': {
    tier: 'emg',
    claim: 'Produced the highest posterior deltoid excitation of the exercises tested in two studies '
      + '— an acute electrical measurement, and no trial has ever measured rear delt growth from any '
      + 'exercise.',
    sources: ['botton2013', 'campos2020'],
    confidence: 'limited',
  },

  /* ---------- Biceps ---------- */

  'dumbbell-curl--biceps': {
    tier: 'measured',
    claim: 'Grew the elbow flexors about 11% against about 5% for a dumbbell row trained the same '
      + 'way, in a within-subject trial where both arms used a supinated grip.',
    sources: ['mannarino2021'],
    confidence: 'good',
    betterThan: ['dumbbell-row--back'],
  },

  'preacher-curl--biceps': {
    tier: 'measured',
    claim: 'Grew the biceps the same amount as a cable preacher curl, despite the two loading '
      + 'opposite ends of the range.',
    sources: ['nunes2020'],
    confidence: 'good',
  },

  /* ---------- Triceps ---------- */

  'overhead-cable-extension--triceps': {
    tier: 'measured',
    claim: 'Grew the whole triceps about 1.4 times and the long head about 1.5 times as much as a '
      + 'cable pushdown over 12 weeks, with range of motion matched and the pushdown carrying the '
      + 'heavier load throughout.',
    sources: ['maeo2023'],
    confidence: 'good',
    betterThan: ['triceps-pushdown--triceps'],
  },

  'triceps-pushdown--triceps': {
    tier: 'measured',
    claim: 'Grew the triceps, but less than an overhead cable extension did at a matched range of '
      + 'motion — 1.4 times whole-muscle and 1.5 times long-head, both favouring overhead.',
    sources: ['maeo2023'],
    confidence: 'good',
  },

  'skull-crusher--triceps': {
    tier: 'measured',
    claim: 'Grew the triceps long head significantly more than the bench press did, while the bench '
      + 'press grew the lateral head more, in a trial that measured each head by MRI.',
    sources: ['brandao2020'],
    confidence: 'good',
  },

  // ⚠️ THE TWO ANATOMY ENTRIES. Both say what geometry says and then say what
  // was not tested, because the tier does not license a growth claim and a
  // reader who takes one from these sentences has been misled by this file.

  'rope-overhead-extension--triceps': {
    tier: 'anatomy',
    claim: 'Puts the triceps long head — the only head crossing the shoulder — at a long length, the '
      + 'position that out-grew a pushdown in the one trial to test it, though that trial used a '
      + 'straight bar rather than a rope.',
    sources: ['maeo2023', 'brandao2020'],
    confidence: 'limited',
  },

  'overhead-dumbbell-extension--triceps': {
    tier: 'anatomy',
    claim: 'Puts the triceps long head at a long length by flexing the shoulder, the position that '
      + 'out-grew a pushdown on a cable; the free-weight version has never been compared for growth.',
    sources: ['maeo2023', 'brandao2020'],
    confidence: 'limited',
  },

  /* ---------- Quads ---------- */

  'back-squat--quads': {
    tier: 'measured',
    claim: 'Grew the vastus heads but not the rectus femoris: squat-only groups showed no significant '
      + 'rectus femoris growth, and squatting deeper did not fix it.',
    sources: ['fonseca2014', 'kubo2019'],
    confidence: 'good',
  },

  'leg-extension--quads': {
    tier: 'measured',
    claim: 'Grew the rectus femoris more than a leg press did in trained lifters, one leg on each, '
      + 'while the leg press grew the vastus lateralis more — the two are not substitutes.',
    sources: ['burke2024'],
    confidence: 'good',
  },

  'leg-press--quads': {
    tier: 'measured',
    claim: 'Grew the vastus lateralis more than a leg extension did in trained lifters, one leg on '
      + 'each, while the leg extension grew the rectus femoris more.',
    sources: ['burke2024'],
    confidence: 'good',
  },

  /* ---------- Hamstrings ---------- */

  'seated-leg-curl--hamstrings': {
    tier: 'measured',
    claim: 'Grew the hamstrings about 50% more than a lying leg curl over 12 weeks, with the short '
      + 'head of biceps femoris — which does not cross the hip — growing equally as an internal control.',
    sources: ['maeo2021'],
    confidence: 'good',
    betterThan: ['lying-leg-curl--hamstrings'],
  },

  'lying-leg-curl--hamstrings': {
    tier: 'measured',
    claim: 'Grew the hamstrings, but markedly less than a seated leg curl, because a straight hip '
      + 'leaves the hamstrings shorter throughout.',
    sources: ['maeo2021'],
    confidence: 'good',
  },

  /* ---------- Glutes ---------- */

  'hip-thrust--glutes': {
    tier: 'measured',
    claim: 'Produced the same gluteus maximus growth as the back squat at the upper, middle and lower '
      + 'regions, and neither exercise grew the hamstrings at all.',
    sources: ['plotkin2023'],
    confidence: 'good',
  },

  /* ---------- Calves ---------- */

  'standing-calf-raise--calves': {
    tier: 'measured',
    claim: 'Grew the gastrocnemius clearly more than a bent-leg calf raise in two independent trials, '
      + 'because a bent knee shortens a muscle that crosses it.',
    sources: ['burke2024', 'kinoshita2023'],
    confidence: 'good',
    betterThan: ['seated-calf-raise--calves'],
  },

  'seated-calf-raise--calves': {
    tier: 'measured',
    claim: 'Grew the gastrocnemius less than a straight-leg calf raise, though the soleus mildly '
      + 'favoured this bent-leg version in the same trials.',
    sources: ['burke2024', 'kinoshita2023'],
    confidence: 'good',
  },

  /* ---------- Neck ---------- */

  'neck-extension--neck': {
    tier: 'measured',
    claim: 'Nine weekly sets raised neck cross-sectional area 13% in 12 weeks, while a group doing '
      + 'the same squats, pulls, rows and shrugs without them showed no change at all.',
    sources: ['conley1997'],
    confidence: 'good',
  },
};

/**
 * Whether a muscle group needs work of its own, or whether the compounds around
 * it are enough. This is what the template lint reads: "this day trains back
 * with rows and pulldowns and has no direct biceps work."
 *
 * ⚠️ `needsDirectWork: false` IS A FINDING AND IS RECORDED AS ONE. Two entries
 * here say the compound is enough, and they matter as much as the six that say
 * it is not — a lint that only ever knows how to complain is a lint people turn
 * off. The glute entry exists because the head-to-head trial found the squat
 * matched the hip thrust at every gluteus maximus region, which is a null, and
 * a null is a result.
 *
 * ⚠️ A MISSING MUSCLE MEANS NOTHING HAS BEEN MEASURED. Back, Shoulders, Traps,
 * Forearms and Core have no entry because no trial has measured whether their
 * compounds are sufficient — not because the question was skipped. Keys must be
 * members of MUSCLE_GROUPS in exercises.js, which the test asserts.
 *
 * There is no `tier` field on this shape, so a claim here has to carry its own
 * evidence type in words. Every one below does.
 */
export const MUSCLE_COVERAGE = {
  Biceps: {
    needsDirectWork: true,
    claim: 'Rowing is a real elbow flexor stimulus but not a maximal one — a curl grew the arm about '
      + '11% against about 5% for a row trained the same way, in the same person.',
    sources: ['mannarino2021'],
    confidence: 'good',
  },

  Triceps: {
    needsDirectWork: true,
    claim: 'Pressing grows the lateral and medial heads and barely touches the long head, which is '
      + 'the only head crossing the shoulder; adding an overhead or skull-crusher position is what '
      + 'grew it in the trials that measured each head separately.',
    sources: ['brandao2020', 'wakahara2013', 'maeo2023'],
    confidence: 'good',
  },

  Quads: {
    needsDirectWork: true,
    claim: 'Squatting alone did not significantly grow the rectus femoris at either depth tested, and '
      + 'an isolated knee extension grew it more than a leg press did in trained lifters.',
    sources: ['fonseca2014', 'kubo2019', 'burke2024'],
    confidence: 'good',
  },

  Hamstrings: {
    needsDirectWork: true,
    claim: 'Neither squats at either depth nor hip thrusts produced measurable hamstring growth, '
      + 'because the muscle shortens at the knee while it lengthens at the hip and its overall length '
      + 'barely changes.',
    sources: ['kubo2019', 'bloomquist2013', 'plotkin2023'],
    confidence: 'good',
  },

  Calves: {
    needsDirectWork: true,
    claim: 'No compound lift has been shown to grow the calves; the nearest test found leg curls '
      + 'produced small non-significant lateral gastrocnemius growth and virtually none medially.',
    sources: ['vanvossel2024'],
    confidence: 'limited',
  },

  Neck: {
    needsDirectWork: true,
    claim: 'A group squatting, pulling, rowing and shrugging for 12 weeks showed no change in neck '
      + 'cross-sectional area at all, while adding nine weekly sets of neck extensions gained 13%.',
    sources: ['conley1997'],
    confidence: 'good',
  },

  Glutes: {
    needsDirectWork: false,
    claim: 'The back squat grew the gluteus maximus as much as the hip thrust did at the upper, '
      + 'middle and lower regions, though gluteus medius and minimus barely moved in either group '
      + 'because neither exercise abducts the hip.',
    sources: ['plotkin2023'],
    confidence: 'good',
  },

  Chest: {
    needsDirectWork: false,
    claim: 'A horizontal press is itself the direct work and grew the pecs in every trial that '
      + 'measured it, but no study has compared pressing alone against pressing plus flies at matched '
      + 'volume, so "enough" here is untested rather than demonstrated.',
    sources: ['kikuchi2017', 'hernandezbelmonte2023'],
    confidence: 'limited',
  },
};

/* ------------------------------------------------------------------ *
 * Lookups
 *
 * ⚠️ BOTH GUARD WITH hasOwnProperty. A plain `EXERCISE_EVIDENCE[id]` returns a
 * live function for 'constructor', 'toString' and 'valueOf', and an id arrives
 * here from a saved template, which is user data. The lint would then be handed
 * something with no `.tier` and no `.claim` and would have to defend itself.
 * Null is the answer for every key that was not written above.
 * ------------------------------------------------------------------ */

const has = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * @param {string} exerciseId  an id from exercises.js
 * @returns the evidence entry, or null when nothing has been measured — which
 *          is the answer for the overwhelming majority of the library.
 */
export function evidenceFor(exerciseId) {
  return has(EXERCISE_EVIDENCE, exerciseId) ? EXERCISE_EVIDENCE[exerciseId] : null;
}

/**
 * @param {string} muscleGroup  a member of MUSCLE_GROUPS in exercises.js
 * @returns the coverage entry, or null when no trial has tested whether that
 *          muscle's compounds are sufficient.
 */
export function coverageFor(muscleGroup) {
  return has(MUSCLE_COVERAGE, muscleGroup) ? MUSCLE_COVERAGE[muscleGroup] : null;
}
