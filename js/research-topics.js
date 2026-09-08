// Research — the basics of lifting, and what the evidence actually supports.
//
// Tim, 2026-08-30: "collect information to educate users on the basics of
// weightlifting and some of the stuff science has confidently determined…
// Remember that a lot of information can be completely false or
// missrepresented, so before we put anything on here, we need to be confident…
// if there might be a conclusion that isn't super solid, don't add it, or if
// you do, state your confidence."
//
// Pure: no DOM, no store. Same reason as research-data.js and e1rm.js.
//
// ── THE RULES THIS FILE IS WRITTEN UNDER ─────────────────────────────────────
//
// 1. ⚠️ EVERY CLAIM NAMES A SOURCE, and every source is defined ONCE in
//    SOURCES below. A citation written inline is a citation that drifts — the
//    Goals screen already learned that when a hand-written paraphrase of
//    INDIRECT_NOTE quietly lost the words "not a measured fact"
//    (docs/research.md §6.17, 2026-08-20).
//
// 2. ⚠️ CONFIDENCE IS A FIELD, NOT A TONE. Three levels, and the word is on
//    screen beside every topic. `strong` means two or more independent
//    syntheses agree (or a position stand built on many). `good` means one
//    solid meta-analysis. `limited` means the intervals cross zero, the corpus
//    is small, or the source is a preprint. Nothing goes in below that.
//
// 3. ⚠️ A NULL RESULT IS A FINDING AND IS WRITTEN AS ONE. "Stretching does not
//    reduce injury risk (RR 0.99)" is more useful to a reader than any of the
//    hedged versions, and it is what the trial found.
//
// 4. ⚠️ WHERE THE APP CANNOT SEE SOMETHING, THE TOPIC SAYS SO. The strength
//    half of every rating in this app assumes the work is heavy and cannot
//    check (docs/research.md §6.13.3); a reader of the research tab is exactly
//    the person who should be told that.
//
// 5. ⚠️ NO EXERCISE PRESCRIPTIONS FOR A PERSON. This is what studies measured,
//    not what you should do on Tuesday. The app does not know the reader's
//    training age, health or history, and D9 keeps it out of the business of
//    asking.
//
// ⚠️ WORD BUDGETS ARE ASSERTED IN tests/data-layer.test.mjs, because Tim's
// other constraint was "it's also important for this to be readable and
// understandable for the user, so make sure it doesn't get too wordy" — and
// every other assertion anybody would write here checks that something is
// PRESENT, which cannot catch prose piling back up. Same argument as the muscle
// panel's 40-word cap (progress.md, 2026-08-21 fifth pass).
//
// ⚠️ THE LONG FORM OF ALL OF THIS IS `docs/research.md`. This file is the
// screen; that file is the working. Anything added here must be added there
// first, with its grade and its limitations.

/**
 * How much to believe a topic. The LABEL is what renders — colour must never
 * be the only cue (Design Rule 5), and "Strong evidence" in words survives
 * greyscale, colour blindness and a screenshot.
 */
export const CONFIDENCE = {
  strong: {
    label: 'Strong evidence',
    note: 'Several independent reviews agree, or a position stand built on many.',
  },
  good: {
    label: 'Good evidence',
    note: 'One solid meta-analysis. Likely to hold, not yet replicated everywhere.',
  },
  limited: {
    label: 'Limited evidence',
    note: 'Small studies, wide ranges, or results that have not settled. Read it as a lean.',
  },
};

export const CONFIDENCE_ORDER = ['strong', 'good', 'limited'];

/* ── SECTIONS, TAGS AND HOOKS — 2026-09-07, docs/research-plan.md ────────────
 *
 * ⚠️ WHY THIS IS FIVE SECTIONS AND A TAG LIST RATHER THAN A TREE. The first
 * answer to "how should this be organised" was a nine-section, ninety-leaf
 * hierarchy — Foundations, Training variables, Exercise selection, Technique,
 * Recovery, Nutrition, Reading the evidence, Disagreements, Myths, each three
 * deep. It is a good plan for what to WRITE and a bad screen to READ:
 *
 *   - three taps to reach one paragraph on a 360px phone;
 *   - it forces one axis when readers want two — "how do I train chest" and
 *     "how many sets" are both real entry points and a tree makes you pick;
 *   - a "disagreements" branch duplicates every topic it holds, so nothing has
 *     one home;
 *   - and it is ninety slots for eleven topics, which is mostly empty rooms.
 *
 * So the tree lives in the plan as the writing backlog, and the screen gets
 * FACETS instead: a topic has one `section` and any number of `tags`, and the
 * reader filters. "Chest" becomes a filter rather than a location, which is
 * what dissolves the muscle-vs-variable problem — both are one tap from the
 * same list.
 *
 * 🚨 A SECTION IS NOT SHOWN UNTIL IT HAS EIGHT TOPICS. A header over a list of
 * two is a label pretending to be structure. The threshold is in views-data.js
 * where the drawing happens.
 */
export const SECTIONS = {
  'how-it-works': 'How it works',
  'how-to-train': 'How to train',
  'what-to-do': 'What to do',
  'recovery-and-food': 'Recovery and food',
  'judging-evidence': 'Judging the evidence',
};
export const SECTION_ORDER = ['how-it-works', 'how-to-train', 'what-to-do',
  'recovery-and-food', 'judging-evidence'];

/**
 * The tag vocabulary, closed on purpose.
 *
 * ⚠️ Free-text tags drift into synonyms within a month — "rest", "rest times",
 * "rest periods" — and a filter built on them silently splits one topic into
 * three. A test rejects any tag not defined here, so widening the vocabulary is
 * a deliberate edit rather than a typo.
 */
export const TAGS = {
  volume: 'Volume',
  effort: 'Effort',
  load: 'Load and reps',
  frequency: 'Frequency',
  'range-of-motion': 'Range of motion',
  tempo: 'Tempo',
  rest: 'Rest',
  progression: 'Progression',
  periodisation: 'Periodisation',
  'exercise-choice': 'Exercise choice',
  recovery: 'Recovery',
  nutrition: 'Nutrition',
  method: 'Reading evidence',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
};

/**
 * Words a hook may not use when the evidence is `limited`.
 *
 * 🚨 THE RULE THE HOOK EXISTS UNDER: a hook may be as loud as it likes about
 * WHAT a finding is, and may never overstate HOW SURE anyone is. That is Design
 * Rule 9's shape applied to headlines, and it is not a style preference — the
 * research library this content is drawn from is substantially a catalogue of
 * what happens when fitness writing breaks it: position stands whose headline
 * is firmer than the review above it, a video titled "11 Studies" resting on
 * two, "one third faster growth" that is a relabelled effect size of 0.11.
 *
 * The supply of honest hooks is large because the findings are genuinely
 * surprising. Nothing here needs inflating to be worth reading.
 */
export const HOOK_BANNED_WHEN_LIMITED = ['proven', 'always', 'never', 'must', 'guaranteed'];

/**
 * Every source, defined once.
 *
 * `n` is what the study actually covered, and it is shown because "13 studies,
 * 1,016 people" and "one trial of 12 undergraduates" are different claims that
 * read identically once they are both called "research".
 *
 * ⚠️ A `url` is OPTIONAL and a missing one is deliberate rather than lazy: a
 * wrong link on screen is worse than no link (docs/research.md §6.18 opens on
 * exactly that argument). Every URL here was opened during the pull.
 */
export const SOURCES = {
  acsm2026: {
    label: 'ACSM position stand on resistance training (2026)',
    n: '137 reviews, over 30,000 people',
    url: 'https://doi.org/10.1249/MSS.0000000000003897',
  },
  acsm2009: {
    label: 'ACSM progression models in resistance training (2009)',
    n: 'practitioner consensus',
    url: 'https://doi.org/10.1249/MSS.0b013e3181915670',
  },
  pelland2025: {
    label: 'Pelland et al. (2025), weekly sets and training days',
    n: '67 studies, 2,058 people',
    url: 'https://doi.org/10.1007/s40279-025-02344-w',
  },
  remmert2025: {
    label: 'Remmert et al. (2025), sets in a single session',
    n: '67 studies — preprint, not yet peer reviewed',
    url: 'https://sportrxiv.org/index.php/server/preprint/view/537',
  },
  lopez2021: {
    label: 'Lopez et al. (2021), how heavy the load is',
    n: '28 studies, 747 people',
    url: 'https://doi.org/10.1249/MSS.0000000000002585',
  },
  robinson2024: {
    label: 'Robinson et al. (2024), how close to failure',
    n: 'meta-regressions; reps in reserve estimated, not measured',
    url: 'https://doi.org/10.1007/s40279-024-02069-2',
  },
  refalo2023: {
    label: 'Refalo et al. (2023), training to failure',
    n: '15 studies',
    url: 'https://doi.org/10.1007/s40279-022-01784-y',
  },
  steele2017: {
    label: 'Steele et al. (2017), guessing your reps left',
    n: '141 people',
    url: 'https://doi.org/10.7717/peerj.4105',
  },
  haugen2023: {
    label: 'Haugen et al. (2023), free weights vs machines',
    n: '13 studies, 1,016 people',
    url: 'https://doi.org/10.1186/s13102-023-00713-4',
  },
  keogh2017: {
    label: 'Keogh & Winwood (2017), injuries in the lifting sports',
    n: '20 studies, mostly recalled after the fact',
    url: 'https://doi.org/10.1007/s40279-016-0575-0',
  },
  fradkin2010: {
    label: 'Fradkin et al. (2010), warming up and performance',
    n: '32 studies',
    url: 'https://doi.org/10.1519/JSC.0b013e3181c643a0',
  },
  warneke2024: {
    label: 'Warneke & Lohmann (2024), stretching and force',
    n: '83 studies, 2,012 people',
    url: 'https://doi.org/10.1016/j.jshs.2024.05.002',
  },
  lauersen2014: {
    label: 'Lauersen et al. (2014), preventing sports injuries',
    n: '25 trials, 26,610 people',
    url: 'https://doi.org/10.1136/bjsports-2013-092538',
  },
  bruggisser2023: {
    label: 'Bruggisser et al. (2023), time of day',
    n: '26 articles; 191 people in the pooled part',
    url: 'https://doi.org/10.1186/s40798-023-00577-5',
  },
  grgic2019: {
    label: 'Grgic et al. (2019), morning vs evening training',
    n: 'systematic review and meta-analysis',
    url: 'https://doi.org/10.1080/07420528.2019.1567524',
  },
  singer2024: {
    label: 'Singer et al. (2024), rest between sets',
    n: '9 trials, mostly untrained, no chest or back data',
    url: 'https://doi.org/10.3389/fspor.2024.1429789',
  },
  damas2018: {
    label: 'Damas et al. (2018), muscle damage and growth',
    n: 'invited review, not a meta-analysis',
    url: 'https://doi.org/10.1007/s00421-017-3792-9',
  },
  ramirez2022: {
    label: 'Ramírez-Campillo et al. (2022), training one area for fat loss',
    n: '13 studies, 1,158 people',
    url: 'https://doi.org/10.5114/hm.2022.110373',
  },
  roberts2020: {
    label: 'Roberts, Nuckols & Krieger (2020), men and women',
    n: '17 studies for strength, 10 for size',
    url: 'https://doi.org/10.1519/JSC.0000000000003521',
  },
  morton2018: {
    label: 'Morton et al. (2018), protein',
    n: '49 trials, 1,863 people',
    url: 'https://doi.org/10.1136/bjsports-2017-097608',
  },
  tagawa2022: {
    label: 'Tagawa et al. (2022), protein dose–response',
    n: '82 trials, 3,940 people',
    url: 'https://doi.org/10.1186/s40798-022-00508-w',
  },
  schoenfeld2013: {
    label: 'Schoenfeld, Aragon & Krieger (2013), protein timing',
    n: '23 studies — 20 of them fed the timed group more protein',
    url: 'https://doi.org/10.1186/1550-2783-10-53',
  },
  lamon2021: {
    label: 'Lamon et al. (2021), one night without sleep',
    n: '13 people, crossover trial',
    url: 'https://doi.org/10.14814/phy2.14660',
  },
  wolf2025: {
    label: 'Wolf et al. (2025), range of motion',
    n: '25 trained people, 8 weeks',
    url: 'https://doi.org/10.7717/peerj.18904',
  },
  hubal2005: {
    label: 'Hubal et al. (2005), how much people differ',
    n: '585 people, 12 weeks, one arm trained',
    url: 'https://doi.org/10.1249/01.mss.0000170469.90461.5f',
  },
  rantila2025: {
    label: 'Räntilä et al. (2025), does your response repeat?',
    n: 'the same 10-week block run twice',
    url: 'https://doi.org/10.1002/ejsc.70095',
  },
  nuzzo2024: {
    label: 'Nuzzo et al. (2024), reps you can do at a given load',
    n: '269 studies, 7,289 people',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/',
  },
  pedrosa2022: {
    label: 'Pedrosa et al. (2022), partials at long vs short muscle lengths',
    n: '45 untrained women, 12 weeks, knee extension',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33977835/',
  },
  bloomquist2013: {
    label: 'Bloomquist et al. (2013), squat depth',
    n: '17 men, 12 weeks, six regions of the thigh measured',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23604798/',
  },
  martinezcava2022: {
    label: 'Martínez-Cava et al. (2022), full vs partial bench press',
    n: '49 men, 10 weeks — strength measured, growth not',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31567719/',
  },
  lacerda2021: {
    label: 'Lacerda et al. (2021), two seconds a rep vs six',
    n: '10 untrained men, one leg each way, 14 weeks',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33665031/',
  },
  schoenfeld2015tempo: {
    label: 'Schoenfeld, Ogborn & Krieger (2015), how long a rep takes',
    n: 'meta-analysis; the 0.5–8 second parity rests on 4 to-failure studies',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25601394/',
  },
  chaves2020: {
    label: 'Chaves et al. (2020), a controlled rep speed vs your own',
    n: 'untrained men, 8 weeks, sets to failure at 70% of max',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32185108/',
  },
  schuenke2012: {
    label: 'Schuenke et al. (2012), super-slow vs normal lifting',
    n: '19 untrained women, 6 weeks',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22328004/',
  },
  moesgaard2022: {
    label: 'Moesgaard et al. (2022), periodisation',
    n: 'meta-analysis of volume-equated programmes, trained and untrained',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35044672/',
  },
  ogasawara2013: {
    label: 'Ogasawara et al. (2013), continuous vs periodic training',
    n: '14 previously untrained men, 24 weeks',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23053130/',
  },
  coleman2023: {
    label: 'Coleman et al., a week off mid-block',
    n: '39 trained people, 9 weeks — preprint, not yet peer reviewed',
    url: 'https://sportrxiv.org/index.php/server/preprint/view/302/',
  },
  hortobagyi1993: {
    label: 'Hortobágyi et al. (1993), two weeks off in strength athletes',
    n: '4 powerlifters and 8 college footballers',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8371654/',
  },
  wall2014: {
    label: 'Wall et al. (2014), muscle loss during disuse',
    n: 'healthy young men in a full leg cast; the 14-day arm',
    url: 'https://doi.org/10.1111/apha.12190',
  },
  mujika2001: {
    label: 'Mujika & Padilla (2001), what detraining does',
    n: 'review, not a meta-analysis',
    url: 'https://doi.org/10.1097/00005768-200108000-00009',
  },
  smith2003: {
    label: 'Smith et al. (2003), three years after stopping',
    n: 'older adults who trained two years, then stopped for three',
    url: 'https://doi.org/10.1139/h03-034',
  },
  bosquet2013: {
    label: 'Bosquet et al. (2013), stopping training',
    n: 'meta-analysis of training cessation',
    url: 'https://doi.org/10.1111/sms.12047',
  },
  gaffney2021: {
    label: 'Gaffney et al. (2021), 72 hours in a sling',
    n: 'grip strength fell about 22% with no muscle lost',
    url: 'https://doi.org/10.3389/fnhum.2021.640642',
  },
  bruusgaard2010: {
    label: 'Bruusgaard et al. (2010), nuclei kept after detraining',
    n: 'animal model — mice, not people',
    url: 'https://doi.org/10.1073/pnas.0913935107',
  },
  vigotsky2017: {
    label: 'Vigotsky et al. (2017), what surface EMG measures',
    n: 'methods review; the signal moves with joint angle at constant input',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29354060/',
  },
  vigotsky2022: {
    label: 'Vigotsky et al. (2022), EMG as a predictor of growth',
    n: 'review — acute EMG amplitude is not a validated predictor of hypertrophy',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35006527/',
  },
  brandao2020: {
    label: 'Brandão et al. (2020), what pressing grows in the triceps',
    n: '43 untrained men, 10 weeks, MRI head by head',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32149887/',
  },
  burke2024: {
    label: 'Burke et al. (2024), exercise choice and regional growth',
    n: '28 trained people, one leg per exercise',
    url: 'https://doi.org/10.1007/s42978-024-00299-4',
  },
  maeo2023: {
    label: 'Maeo et al. (2023), overhead vs neutral triceps extensions',
    n: '21 untrained people, 12 weeks, one arm each, range of motion matched',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35819335/',
  },
  maeo2021: {
    label: 'Maeo et al. (2021), seated vs lying leg curls',
    n: 'training at long vs short hamstring lengths, one leg each',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33009197/',
  },
  bazvalle2019: {
    label: 'Baz-Valle et al. (2019), changing exercises every session',
    n: '19 trained men, 8 weeks, an 80-exercise randomiser against a fixed list',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31881066/',
  },
  rindom2019: {
    label: 'Rindom et al. (2019), tension and growth signalling',
    n: 'rat muscle — signalling over hours, not size over months',
    url: 'https://doi.org/10.1111/apha.13336',
  },
  wackerhage2019: {
    label: 'Wackerhage et al. (2019), what starts hypertrophy',
    n: 'mechanism review, largely cell and animal work',
    url: 'https://doi.org/10.1152/japplphysiol.00685.2018',
  },
  hirono2022: {
    label: 'Hirono et al. (2022), swelling and later growth',
    n: 'the only direct test of the pump; correlation 0.4–0.6',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31904714/',
  },
  lixandrao2018: {
    label: 'Lixandrão et al. (2018), blood-flow restriction vs heavy loads',
    n: 'systematic review and meta-analysis',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29043659/',
  },
  damas2016: {
    label: 'Damas et al. (2016), protein synthesis and muscle damage',
    n: 'the signal tracked growth only after damage subsided',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27219125/',
  },
  pinto2025: {
    label: 'Pinto et al. (2025), one set against three',
    n: '15 untrained men, 12 weeks, one arm each',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40266636/',
  },
  kadlec2022: {
    label: 'Kadlec et al. (2022), errors in strength and conditioning meta-analyses',
    n: 'the 20 most-cited; most published before 2019, most not about growth',
    url: 'https://doi.org/10.1007/s40279-022-01766-0',
  },
  mortonAR2018: {
    label: 'Morton et al. (2018), androgen receptors and responders',
    n: '49 trained men, 12 weeks — associational, not causal',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30356739/',
  },
  mobley2018: {
    label: 'Mobley et al. (2018), markers across responder tiers',
    n: '67 untrained men, 12 weeks',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29621305/',
  },
  margaritelis2021: {
    label: 'Margaritelis et al. (2021), damage markers across 10 weeks',
    n: 'untrained men, eccentric-only knee extensions; damage measured, not growth',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33156414/',
  },
};

/**
 * The topics, in the order they are shown.
 *
 * `answer` is the whole thing in two sentences, for somebody who reads nothing
 * else. `points` are the specifics with their numbers. `caveat` is the limit —
 * one per topic, always present, because a topic with nothing to admit is
 * usually a topic that has not been checked.
 */
export const TOPICS = [
  {
    id: 'growth-vs-strength',
    question: 'Growing muscle vs getting stronger',
    lead: 'How should training change to maximise each?',
    confidence: 'strong',
    hook: 'The same sets build both — only the load and the practice differ.',
    section: 'how-it-works',
    tags: ['load', 'effort'],
    answer: 'They overlap far more than people think — the same sets build both. '
      + 'What changes is how heavy you lift and how much you practise the exact lift you want to be strong at.',
    points: [
      {
        text: 'Strength wants heavy. Sets at 80% of your max or more — roughly 8 reps or fewer — '
          + 'clearly beat light sets for strength, and it is one of the best-supported findings in the field.',
        sources: ['lopez2021', 'acsm2026'],
      },
      {
        text: 'Size barely cares. Heavy and light sets grow muscle about equally once the set is taken '
          + 'close to failure — the difference measured was small and its range included no difference at all.',
        sources: ['lopez2021', 'acsm2026'],
      },
      {
        text: 'Training days: more days a week genuinely helps strength. For size there is no separate '
          + 'effect once the weekly sets are equal — where the sets land matters, not how many days you spread them over.',
        sources: ['pelland2025', 'acsm2026'],
      },
      {
        text: 'Order matters for strength: the lift you want to get strong at belongs at the start of the '
          + 'session, not the end. That is the single best-graded recommendation in the 2026 ACSM stand.',
        sources: ['acsm2026'],
      },
    ],
    caveat: 'This app can see what you recorded, not how heavy you meant to go. '
      + 'Any strength figure it shows assumes the work was heavy, and it cannot check that.',
  },

  {
    id: 'sets-and-reps',
    question: 'Sets and reps — per workout and per week',
    lead: 'What is optimal? Does it matter?',
    confidence: 'strong',
    hook: 'Past about 19 sets a week, ten more buy one more gain.',
    section: 'how-to-train',
    tags: ['volume', 'load'],
    contested: {
      what: 'Whether more volume keeps paying off',
      verdict: 'No ceiling has been demonstrated, yet every source still recommends 10-20 sets.',
      confidence: 'good',
    },
    answer: 'Weekly sets per muscle is the number that matters most. About 4 hard sets a week is where an '
      + 'effect first shows up, 5–10 is the best return per set, and more keeps working with steadily worse value.',
    points: [
      {
        text: 'The curve never flattens inside the data — but past about 19 sets a week you are paying '
          + 'roughly ten extra sets for each further gain anybody could measure.',
        sources: ['pelland2025'],
      },
      {
        text: 'The 2026 ACSM stand puts its headline growth figure at 10 or more sets per muscle per week, '
          + 'and grades that evidence moderate rather than high.',
        sources: ['acsm2026'],
      },
      {
        text: 'In one session, 2–3 sets per exercise is enough for strength. For size, past about 11 sets '
          + 'on one muscle in a single session the research can no longer tell the extra sets apart.',
        sources: ['acsm2026', 'remmert2025'],
      },
      {
        text: 'Reps: anything from about 5 to 30 builds muscle if the set is hard. Rep count only becomes '
          + 'decisive when strength is the goal — and how many reps a load allows varies by exercise.',
        sources: ['lopez2021', 'nuzzo2024'],
      },
    ],
    caveat: 'All of this together explains about a quarter of why two training groups get different results. '
      + 'Treat the numbers as a sensible range, never a prescription.',
  },

  {
    id: 'failure-and-rir',
    question: 'Reps in reserve, and going to failure',
    lead: 'Should every set go to failure? How many reps should you leave?',
    confidence: 'good',
    hook: 'No study has found an advantage to grinding out the last rep.',
    section: 'how-to-train',
    tags: ['effort'],
    contested: {
      what: 'How close to failure a set has to be',
      verdict: 'Stopping 1-3 reps short matches failure at normal volumes.',
      confidence: 'strong',
    },
    answer: 'Hard, but not all the way. Stopping 1–3 reps short builds as much muscle as grinding to a '
      + 'complete stop, and no study has shown an advantage to going to failure.',
    points: [
      {
        text: 'Failure against stopping short, across 15 studies: a difference too small to call, with a '
          + 'range that includes none at all. The 2026 ACSM stand agrees and names 2–3 reps in reserve as enough.',
        sources: ['refalo2023', 'acsm2026'],
      },
      {
        text: 'The other half still holds: inside that range, sets taken closer to failure do grow more '
          + 'muscle. "Not to failure" is not permission to stop early — the last reps should be a real struggle.',
        sources: ['robinson2024'],
      },
      {
        text: 'For strength, how close you stop to failure barely matters. Load is what matters there, '
          + 'so a heavy set of 5 with 2 left in the tank is doing its job.',
        sources: ['robinson2024', 'lopez2021'],
      },
      {
        text: 'Most people have more left than they think: asked to predict their reps to failure, '
          + '141 lifters under-guessed, and less experienced ones were further out.',
        sources: ['steele2017'],
      },
    ],
    caveat: 'Reps in reserve in these studies were estimated from what the papers described rather than '
      + 'measured. Treat 2–3 in reserve as a target to aim at, not a number anybody read off a dial.',
  },

  {
    id: 'free-weights-vs-machines',
    question: 'Free weights vs machines',
    lead: 'Is one better? What are the risks?',
    confidence: 'strong',
    hook: 'Machines matched free weights for both size and strength.',
    section: 'what-to-do',
    tags: ['exercise-choice'],
    answer: 'Neither is better for size or strength. The one real difference is specificity — you get best '
      + 'at the thing you actually train on.',
    points: [
      {
        text: 'Across 13 studies and 1,016 people, no difference in muscle growth, dynamic strength, '
          + 'isometric strength or jump height. The 2026 ACSM stand reaches the same verdict.',
        sources: ['haugen2023', 'acsm2026'],
      },
      {
        text: 'Tested on free weights, free-weight training wins slightly. Tested on machines, machine '
          + 'training tends to win. That is the test being specific, not the muscle knowing the difference.',
        sources: ['haugen2023'],
      },
      {
        text: 'Injury: lifting has low injury rates next to team sports — bodybuilding-style training '
          + 'comes out around 0.24–1 injury per 1,000 hours. Shoulders, lower back and knees are the usual sites.',
        sources: ['keogh2017'],
      },
      {
        text: 'What nobody has shown is that machines are safer. It is a reasonable guess and an untested '
          + 'one; no study here compared injury rates between the two.',
        sources: ['keogh2017', 'haugen2023'],
      },
    ],
    caveat: 'Only 5 of those 13 studies measured muscle size at all, and the injury figures come from '
      + 'competitive lifters recalling past injuries rather than from tracked gym-goers.',
  },

  {
    id: 'warmup-and-stretching',
    question: 'Warming up and stretching',
    lead: 'Necessary? Does it improve gains, or just reduce risk? What should it look like?',
    confidence: 'good',
    hook: 'Stretching does not lower your injury risk — the training does.',
    section: 'recovery-and-food',
    tags: ['recovery'],
    answer: 'Warming up helps you perform on the day. Stretching is fine if you like it, but it is not what '
      + 'protects you from injury — the training itself is.',
    points: [
      {
        text: 'Across 32 studies, warming up improved 79% of the performance measures taken and worsened 17%. '
          + 'That is a count of results rather than a measured effect, so read it as a direction.',
        sources: ['fradkin2010'],
      },
      {
        text: 'Stretching does not reduce injury risk — 9 randomised trials, and the result is flatly no '
          + 'effect. Strength training does: it cut acute injuries by about 44% and overuse injuries by 38%.',
        sources: ['lauersen2014'],
      },
      {
        text: 'Static stretching before lifting: holds under 60 seconds cost you nothing measurable. '
          + 'Holds of a minute or more per muscle do measurably reduce maximum strength.',
        sources: ['warneke2024'],
      },
      {
        text: 'What it should look like: a few minutes to get warm, then the exercise itself for a few '
          + 'progressively heavier sets. Exactly how you ramp up matters less — the studies disagree and the differences are small.',
        sources: ['fradkin2010', 'warneke2024'],
      },
    ],
    caveat: 'None of it is about gains: no evidence says a warm-up builds more muscle. And the injury '
      + 'evidence comes from sports teams, not from gyms — nobody has run that trial on lifters.',
  },

  {
    id: 'time-of-day',
    question: 'Time of day',
    lead: 'Is there a best time to train?',
    confidence: 'good',
    hook: 'You are stronger in the evening, and it changes nothing you gain.',
    section: 'recovery-and-food',
    tags: ['recovery'],
    answer: 'No time of day builds more muscle or more strength. You are usually a little stronger later in '
      + 'the day, and that does not change what you gain.',
    points: [
      {
        text: 'A 2023 review of 26 studies found evidence neither for nor against any particular time of day '
          + 'for strength or size.',
        sources: ['bruggisser2023'],
      },
      {
        text: 'What it did find: you perform best at the time you normally train. If you are testing a max, '
          + 'test it at your usual training hour or you are measuring the clock as well as yourself.',
        sources: ['bruggisser2023', 'grgic2019'],
      },
      {
        text: 'Train morning and your morning strength catches up to your evening strength. Train evening '
          + 'and the usual daily difference stays. Either way the gains are the same size.',
        sources: ['grgic2019'],
      },
    ],
    caveat: 'The pooled part of that review was 191 people and 98% of them were men. Nobody has studied this '
      + 'properly in women, in older adults, or in people who are naturally night owls.',
  },

  {
    id: 'adding-weight',
    question: 'Adding weight over time',
    lead: 'When should the weight go up, and by how much?',
    confidence: 'good',
    hook: 'On a light lift the smallest plate in the gym is already too big.',
    section: 'how-to-train',
    tags: ['progression', 'load'],
    answer: 'Earn the reps first, then add the smallest jump you can. The recommended step is 2–10% — and on '
      + 'a light lift the smallest plate in the gym is already bigger than that.',
    points: [
      {
        text: 'The rule with a citation behind it: add 2–10% once you can beat your rep target by one or two '
          + 'on two sessions in a row. One good session is noise.',
        sources: ['acsm2009'],
      },
      {
        text: 'Five pounds is a 25% jump on a 20 lb lift and 2% on a 225 lb one. Below about 50 lb there is '
          + 'no honest weight increase available, and the increment is another rep.',
        sources: ['acsm2009'],
      },
      {
        text: 'The 2026 stand is gentler than the folklore: progression is what you need for continued '
          + 'long-term progress, not to get benefit at all. A week without a step up is not a failed week.',
        sources: ['acsm2026'],
      },
    ],
    caveat: 'The 2–10% band is practitioner consensus from 2009, not a measured dose–response. '
      + 'The shape is well supported; the exact numbers are not.',
  },

  {
    id: 'rest-between-sets',
    question: 'Rest between sets',
    lead: 'How long, and does it change what you build?',
    confidence: 'limited',
    hook: 'Every range in the analysis crosses zero.',
    section: 'how-to-train',
    tags: ['rest'],
    answer: 'Less than it feels like. Over 60 seconds looks slightly better than under for muscle growth, '
      + 'and past about 90 seconds nothing more is gained.',
    points: [
      {
        text: 'Every range in that analysis crosses zero — the effect is small enough that it may not exist.',
        sources: ['singer2024'],
      },
      {
        text: 'For strength, the 2026 ACSM stand found no effect of short versus long rest at all.',
        sources: ['acsm2026'],
      },
      {
        text: 'What rest reliably does change is how many reps you get on the next set, which is why heavy '
          + 'work tends to want more of it.',
        sources: ['singer2024'],
      },
    ],
    caveat: '9 trials, mostly untrained younger people over 5–10 weeks, with no data on chest or back at all. '
      + 'This is the weakest topic on this page.',
  },

  {
    id: 'around-the-training',
    question: 'The things around the training',
    lead: 'Protein, sleep, and how far to move the weight.',
    confidence: 'good',
    hook: 'Three things outside the sets have real evidence, and each has a limit.',
    section: 'recovery-and-food',
    tags: ['nutrition', 'recovery', 'range-of-motion'],
    answer: 'Three things outside the sets themselves have real evidence behind them, '
      + 'and each has a limit worth knowing.',
    points: [
      {
        text: 'Protein: the benefit plateaus around 0.7 g per pound of body weight a day, with the range '
          + 'reaching 1.0. "A gram per pound" is the top of that range, not the middle. Two separate analyses agree.',
        sources: ['morton2018', 'tagawa2022'],
      },
      {
        text: 'Sleep: a single night without it cut the rate muscle is built by 18%. What nobody has measured '
          + 'is what 6 hours against 8 does over a training block — so no app can honestly give you a target.',
        sources: ['lamon2021'],
      },
      {
        text: 'Range of motion: what matters is loading the muscle at long lengths. A full range gets you '
          + 'there; if you shorten a rep, shorten the top of it rather than the bottom.',
        sources: ['wolf2025'],
      },
    ],
    caveat: 'The sleep result is 13 people and one night of total deprivation, which is not a normal short '
      + 'night. The range-of-motion result is 25 trained people over 8 weeks.',
  },

  {
    id: 'misconceptions',
    question: 'Common misconceptions',
    lead: 'Things repeated everywhere that the evidence does not support.',
    confidence: 'good',
    hook: 'Soreness does not measure a workout, and there are seven more like it.',
    section: 'judging-evidence',
    tags: ['method'],
    answer: 'Each of these is popular, and each has been tested.',
    points: [
      {
        myth: 'Soreness tells you it was a good workout.',
        text: 'Damage is not the thing that drives growth, and training that causes little soreness builds '
          + 'just as much muscle. Soreness mostly tracks what is new, not what worked.',
        sources: ['damas2018'],
      },
      {
        myth: 'You can slim one area by training it.',
        text: 'Trained limb against untrained limb, 13 studies and 1,158 people: no localised fat loss. '
          + 'The pooled result sits on zero.',
        sources: ['ramirez2022'],
      },
      {
        myth: 'Light weight and high reps "tones".',
        text: 'There is no separate toning stimulus. Light and heavy sets grow muscle about equally when '
          + 'taken close to failure; what changes how you look is muscle gained and fat lost.',
        sources: ['lopez2021'],
      },
      {
        myth: 'Women should train differently from men.',
        text: 'Same programmes, same relative gains in size — and relative upper-body strength gains actually '
          + 'came out slightly larger in women.',
        sources: ['roberts2020'],
      },
      {
        myth: 'You have to keep changing things to confuse the muscle.',
        text: 'Periodised programmes are not consistently better than plain ones. Variety is allowed to be '
          + 'for your interest rather than for your muscles.',
        sources: ['acsm2026'],
      },
      {
        myth: 'Protein has to land within 30 minutes.',
        text: 'Once the daily total is adequate, timing has no clear separate effect. Nearly every study that '
          + 'appeared to show one had also fed the timed group more protein.',
        sources: ['schoenfeld2013', 'morton2018'],
      },
      {
        myth: 'Machines are not real training.',
        text: 'They build the same size and strength as free weights. You just get most good at whichever '
          + 'you train on.',
        sources: ['haugen2023'],
      },
    ],
    caveat: 'The soreness one rests on a review rather than a meta-analysis, so it is the least settled here. '
      + 'The rest are pooled results from many studies.',
  },

  {
    id: 'what-to-expect',
    question: 'What to expect from yourself',
    lead: 'How much of this is programming, and how much is you?',
    confidence: 'strong',
    hook: 'Your programme explains about a quarter of your result.',
    section: 'how-it-works',
    tags: ['method'],
    answer: 'Programming explains roughly a quarter of why two people training the same way get different '
      + 'results. The rest is individual, and it varies enormously.',
    points: [
      {
        text: 'Over 12 weeks of identical training, 585 people gained anywhere from 0% to 250% in strength '
          + 'and from −2% to +59% in muscle size.',
        sources: ['hubal2005'],
      },
      {
        text: 'Not responding is rare, and it is not a trait. When the same 10-week block was run twice, '
          + 'nobody came out a non-responder both times on more than one measure.',
        sources: ['rantila2025'],
      },
      {
        text: 'How much you respond does repeat between blocks — which is why your own logged history '
          + 'predicts you far better than any table of averages.',
        sources: ['rantila2025', 'pelland2025'],
      },
    ],
    caveat: 'This is why nothing here will tell you how many pounds you will add in three months. '
      + 'No app can, and one that does is guessing.',
  },
  {
    id: 'range-of-motion',
    question: 'Range of motion',
    lead: 'Does a full range beat a partial one?',
    hook: 'Half reps at the stretch matched full reps in trained lifters.',
    section: 'how-to-train',
    tags: ['range-of-motion'],
    confidence: 'good',
    contested: {
      what: 'Whether lengthened partials beat full range',
      verdict: 'Equal in trained lifters — the nulls are nulls, not reversals',
      confidence: 'good',
    },
    answer: 'Where in the range you load the muscle matters more than how much of '
      + 'it you use. Cutting the stretched half costs you growth; cutting the '
      + 'shortened half appears not to. Full range stays the sensible default.',
    points: [
      {
        text: 'Cut the stretched half and you pay for it. In one squat trial the '
          + 'shallow group grew only the top of the thigh and lost size at the '
          + 'bottom.',
        sources: ['bloomquist2013'],
      },
      {
        text: 'Cut the shortened half instead and trained lifters grew the same as on '
          + 'full reps — one side of the body against the other, every set to '
          + 'failure.',
        sources: ['wolf2025'],
      },
      {
        text: 'The people who pushed lengthened partials hardest walked it back in '
          + '2024. All three untrained studies favoured partials; all three trained '
          + 'ones came out level.',
        sources: ['pedrosa2022', 'wolf2025'],
      },
      {
        text: 'Bench press is the clean test: full-range training beat both partial '
          + 'groups on all three strength tests, including at the partial ranges '
          + 'those groups had trained.',
        sources: ['martinezcava2022'],
      },
    ],
    caveat: 'Both trained-lifter nulls measured only the middle of the muscle, '
      + 'which is where any difference is smallest, and nothing here ran longer '
      + 'than a few months.',
  },
  {
    id: 'tempo-and-tension',
    question: 'Tempo and time under tension',
    lead: 'How fast should you lift, and do the negatives need to be slow?',
    hook: 'Sets lasting 25 seconds grew as much as sets lasting 50.',
    section: 'how-to-train',
    tags: ['tempo'],
    confidence: 'good',
    answer: 'Anything from about half a second to eight seconds a rep builds the '
      + 'same muscle, so long as the set is taken close to failure. Time under '
      + 'tension is not the thing being measured.',
    points: [
      {
        text: 'With effort controlled the difference disappears: one leg at two '
          + 'seconds a rep, the other at six, both to failure, the same growth.',
        sources: ['lacerda2021'],
      },
      {
        myth: 'A set has to last 30 to 60 seconds.',
        text: 'Sets running 25 to 38 seconds grew the same. Light loads produce far '
          + 'longer sets without more growth, which is the argument against the '
          + 'rule.',
        sources: ['lacerda2021', 'lopez2021'],
      },
      {
        text: 'The studies that favoured slow reps fixed both load and rep count, so '
          + 'the slow group was necessarily closer to failure. They measured '
          + 'effort, not tempo.',
        sources: ['schoenfeld2015tempo'],
      },
      {
        text: 'Nor do the negatives need slowing: a deliberate four-second rep '
          + 'matched a self-selected one of about a second each way, over eight '
          + 'weeks of sets to failure.',
        sources: ['chaves2020'],
      },
      {
        text: 'The one speed with evidence against it is genuine super-slow — ten '
          + 'seconds up, four down — which lost to normal lifting on fibre size.',
        sources: ['schuenke2012'],
      },
    ],
    caveat: 'Nearly all of this was measured in untrained people over a few months, '
      + 'and the two sources behind the popular time-under-tension numbers cite '
      + 'nothing you can check.',
  },
  {
    id: 'periodisation-and-deloads',
    question: 'Periodisation and deloads',
    lead: 'Do blocks, waves and planned deloads do anything?',
    hook: 'No study has tested a deload — the break trials stopped training entirely.',
    section: 'how-to-train',
    tags: ['periodisation', 'progression'],
    confidence: 'good',
    answer: 'For size, a periodised programme is not better than one rep range and '
      + 'steady progression. For maximal strength it looks better, and the '
      + 'reason may simply be that it included heavier sets.',
    points: [
      {
        text: 'With volume equated, no size difference between periodised and '
          + 'non-periodised training in either trained or untrained people, and '
          + 'none between linear and undulating.',
        sources: ['moesgaard2022', 'acsm2026'],
      },
      {
        text: 'The strength result carries a confound: periodised groups usually '
          + 'spent more time at heavy low reps, which raises a one-rep max by '
          + 'itself. That trial has not been run.',
        sources: ['moesgaard2022'],
      },
      {
        text: 'Six weeks on and three weeks off, for six months, matched training '
          + 'straight through on chest size, triceps size and bench max — with a '
          + 'quarter less training done.',
        sources: ['ogasawara2013'],
      },
      {
        text: 'A week completely off mid-block cost nothing in lower-body size and a '
          + 'little in strength. The break group reported feeling lethargic '
          + 'afterwards rather than fresh.',
        sources: ['coleman2023'],
      },
      {
        text: 'Neither break study reduced volume — both stopped — so nobody has '
          + 'compared a deload against training through.',
        sources: ['ogasawara2013', 'coleman2023'],
      },
    ],
    caveat: 'Most periodisation studies ran twelve weeks or less, and several had '
      + 'the periodised group dropping to sets of four, which is not the best '
      + 'range for growth.',
  },
  {
    id: 'time-off-and-muscle-memory',
    question: 'Time off, and coming back',
    lead: 'What do you lose when you stop, and how fast does it return?',
    hook: 'Two weeks off cost trained athletes no measurable strength or whole-muscle size.',
    section: 'how-to-train',
    tags: ['periodisation'],
    confidence: 'good',
    answer: 'Less than you fear, and strength goes before size. Two weeks off '
      + 'usually sits inside measurement noise, and months off still leave you '
      + 'above where you started.',
    points: [
      {
        text: 'Two weeks off in powerlifters and college footballers produced no '
          + 'significant loss of strength or whole-muscle size, though fast-twitch '
          + 'fibre area had already shrunk.',
        sources: ['hortobagyi1993'],
      },
      {
        text: 'Two weeks in a full leg cast is the other thing entirely: 8.4% of '
          + 'cross-sectional area and 22.9% of strength. That is the figure people '
          + 'quote about a holiday.',
        sources: ['wall2014'],
      },
      {
        text: 'Over two to three months trained people lose roughly 7–12% and stay '
          + 'above untrained. Older adults who trained two years then stopped three '
          + 'were still 14% up on leg press.',
        sources: ['mujika2001', 'smith2003'],
      },
      {
        text: 'Order of loss: strength stamina first, then maximal strength; size is '
          + 'slow to go, and rate of force development is largely kept. A heavy '
          + 'first session back is mostly rust.',
        sources: ['bosquet2013', 'gaffney2021'],
      },
      {
        text: 'Muscle memory: nuclei gained in training survived detraining in mice, '
          + 'which is the mechanism everyone cites. In humans it has not been '
          + 'followed through a long layoff.',
        sources: ['bruusgaard2010'],
      },
    ],
    caveat: 'The structural half of muscle memory rests on an animal study, and the '
      + 'advice about how to train your way back is coaching judgement with no '
      + 'trial behind it.',
  },
  {
    id: 'picking-exercises',
    question: 'Choosing exercises',
    lead: 'What does it mean to say a lift "targets" a muscle?',
    hook: 'The triceps long head reads high on the bench press and barely grows.',
    section: 'what-to-do',
    tags: ['exercise-choice', 'range-of-motion'],
    confidence: 'good',
    answer: 'Ask what ends the set and where the muscle is loaded, not which '
      + 'exercise is best. Only one selection principle has measured growth '
      + 'behind it, and it is about muscles that cross two joints.',
    points: [
      {
        myth: '"It targets that muscle" usually means somebody read an EMG.',
        text: 'Surface EMG shifts with joint angle even at constant input, and has '
          + 'never been validated as a predictor of size. Scanned head by head, '
          + 'benching grows the lateral triceps and barely the long one.',
        sources: ['vigotsky2017', 'vigotsky2022', 'brandao2020'],
      },
      {
        text: 'The principle that survives: a two-joint muscle grows poorly when one '
          + 'of its actions fights the compound. 28 trained people, one leg '
          + 'pressing and one extending — rectus femoris favoured the extension, '
          + 'vastus lateralis the press.',
        sources: ['burke2024'],
      },
      {
        text: 'The same rule the other way — put the far joint where the muscle is '
          + 'long. Overhead triceps extensions beat pushdowns at matched range, one '
          + 'arm each, and seated leg curls beat lying ones.',
        sources: ['maeo2023', 'maeo2021'],
      },
      {
        text: 'Swapping exercises every session is not the lever. 19 trained men, an '
          + '80-exercise randomiser against a fixed list: quad growth '
          + 'indistinguishable, raw numbers favouring fixed. Motivation was what '
          + 'moved.',
        sources: ['bazvalle2019'],
      },
    ],
    caveat: 'Most of this is untrained people over 8–12 weeks. And the handful of '
      + 'claims above is close to everything in this field backed by measured '
      + 'growth — nearly every exercise ranking you meet online is built on '
      + 'activation readings or leverage maths instead.',
  },
  {
    id: 'how-muscle-grows',
    question: 'What makes a muscle grow',
    lead: 'Is it tension, damage, or the pump?',
    hook: 'The pump and the soreness both rise without the muscle following.',
    section: 'how-it-works',
    tags: ['effort', 'load'],
    confidence: 'good',
    contested: {
      what: 'Whether damage and metabolites contribute at all',
      verdict: 'Possibly, up to a low threshold every training style already crosses — '
        + 'which would look exactly like this, with chasing more of them doing '
        + 'nothing',
      confidence: 'limited',
    },
    answer: 'Mechanical tension is the best current answer and the worst measured '
      + 'part of it. What is settled is the negative: deliberately raising the '
      + 'pump, the burn or the damage does not produce more growth.',
    points: [
      {
        text: 'The case for tension is signalling, not size. Its cleanest study is a '
          + 'rat experiment, where growth signalling tracked the tension applied '
          + 'rather than the electrical input driving it. Nobody can measure '
          + 'tension inside a training human.',
        sources: ['rindom2019', 'wackerhage2019'],
      },
      {
        myth: 'The pump is the sign it is working.',
        text: 'The one direct test tied first-session swelling to six-week growth at '
          + 'a correlation of 0.4–0.6. Light loads under blood-flow restriction '
          + 'give an enormous pump and match heavy training rather than beating it.',
        sources: ['hirono2022', 'lixandrao2018'],
      },
      {
        myth: 'Damage is repaired bigger.',
        text: 'The protein-synthesis spike after a first session did not track '
          + 'eventual growth, and only started to once the soreness had faded. '
          + 'Training that causes little damage builds as much muscle.',
        sources: ['damas2016', 'damas2018'],
      },
    ],
    caveat: 'Hold "the pump and damage are not drivers" far more firmly than '
      + '"tension is the driver". The first is muscle size measured over '
      + 'months; the second is signalling measured over hours, some of it in '
      + 'animals.',
  },
  {
    id: 'reading-a-study',
    question: 'How to judge a study',
    lead: 'Someone has just sent you one. What do you ask of it?',
    hook: 'One small trial is a data point, not a verdict.',
    section: 'judging-evidence',
    tags: ['method'],
    confidence: 'good',
    answer: 'Ask how many people, whether they were trained, and what was actually '
      + 'measured. Two well-run studies disagreeing is normal — it is what '
      + 'small samples do, not a sign either one is broken.',
    points: [
      {
        myth: '"No significant difference" means there is no difference.',
        text: 'It means that study could not detect one. 15 untrained men trained one '
          + 'arm with a single set and the other with three for 12 weeks, and both '
          + 'pecs grew alike — still compatible with three sets being better.',
        sources: ['pinto2025'],
      },
      {
        text: 'Ask what the losing arm was doing. 20 of 23 protein-timing studies '
          + 'also fed the timed group more protein, so none of them separated the '
          + 'timing from the total.',
        sources: ['schoenfeld2013'],
      },
      {
        myth: 'A stand-in for growth is not growth.',
        text: 'Activation readings, protein synthesis over a day and strength gains '
          + 'have each been shown to come apart from measured size. If nobody '
          + 'scanned a muscle, nobody measured growth.',
        sources: ['vigotsky2022', 'damas2016'],
      },
      {
        text: 'Pooling corrects small samples; it does not guarantee correctness. A '
          + '2022 review of the 20 most-cited strength and conditioning '
          + 'meta-analyses found at least one statistical error in 85% of them.',
        sources: ['kadlec2022'],
      },
    ],
    caveat: 'These rules cut both ways and are easy to abuse — any result can be '
      + 'waved off by naming a limitation. A null is a finding to be weighed, '
      + 'not a licence to keep believing what you already did.',
  },
  {
    id: 'why-people-differ',
    question: 'Why two people get different results',
    lead: 'Same programme, different outcomes — how much of that is really individual?',
    hook: 'A limb that started smaller looks exactly like a low responder.',
    section: 'how-it-works',
    tags: ['method'],
    confidence: 'limited',
    contested: {
      what: 'Whether androgen receptor content explains high and low responders',
      verdict: 'Two comparable studies disagree, and nothing is known to raise it anyway',
      confidence: 'limited',
    },
    answer: 'Less of it is you than it looks. A study can show a spread of results; '
      + 'what it usually cannot show is that the spread belongs to the people '
      + 'rather than to the measurement.',
    points: [
      {
        text: 'The famous spreads come from single studies, and inside one study four '
          + 'things draw the same picture: someone who started with more room to '
          + 'grow, something outside the study hitting one side, measurement error '
          + 'landing unevenly, and chance.',
        sources: ['hubal2005', 'pinto2025'],
      },
      {
        text: 'The explanations keep coming up empty. Resting hormones do not '
          + 'separate high responders from low, and neither does testosterone '
          + 'measured inside the muscle itself.',
        sources: ['mortonAR2018', 'mobley2018'],
      },
      {
        text: 'One difference does move. Ten weeks of deliberately brutal eccentric '
          + 'work ended with almost no soreness and falling damage markers — though '
          + 'a handful of those subjects were still fatigued in week 10.',
        sources: ['margaritelis2021'],
      },
      {
        text: 'What separates a real difference from noise is running the same person '
          + 'through the same block twice, and that has rarely been done.',
        sources: ['rantila2025'],
      },
    ],
    caveat: 'Treating a claimed individual response as noise is a rule for reading '
      + 'studies, not a reason to ignore your own log — which is the one record '
      + 'built from the same person measured over and over.',
  },
];

/** Every source key a topic actually cites, deduped, in first-use order. */
export function citedSourceKeys(topics = TOPICS) {
  const seen = [];
  for (const t of topics) {
    for (const p of t.points) {
      for (const k of p.sources || []) if (!seen.includes(k)) seen.push(k);
    }
  }
  return seen;
}

/** The sources for one topic, deduped, resolved, in first-use order. */
export function topicSources(topic) {
  const keys = [];
  for (const p of topic.points) {
    for (const k of p.sources || []) if (!keys.includes(k)) keys.push(k);
  }
  return keys.map((k) => ({ key: k, ...SOURCES[k] }));
}

/**
 * Words in a topic's readable text — the answer, every point and the caveat.
 * The budget it is held to lives in the tests, not here, because a limit a
 * module enforces on itself is a limit that gets quietly raised.
 */
export function topicWordCount(topic) {
  const parts = [topic.answer, topic.caveat,
    ...topic.points.map((p) => `${p.myth || ''} ${p.text}`)];
  return parts.join(' ').trim().split(/\s+/).filter(Boolean).length;
}
