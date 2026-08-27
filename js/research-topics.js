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
