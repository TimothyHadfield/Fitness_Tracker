/* ==========================================================================
   public-figures.js — famous lifters, as recorded lifts.

   2026-09-27, Tim: *"be able to compare muscles with popular influencers or
   professionals current or past when you hit the compare button … Our 1RM
   estimation should be pretty good for these … compare can be against a
   friend or an influencer."*

   Pure data. No DOM, no store, no clock. Each person is a sex, a bodyweight
   and a handful of LIFTS they are on record as doing — and nothing else. Their
   muscle map is NOT stored here: it is computed by the same `muscleRatings()`
   that rates the reader, from these sets, so a famous lifter's Chest is read
   by exactly the arithmetic that reads yours. A number typed in here as
   "Arnold's chest level" would be a second model with nobody checking it.

   🚨 WHAT QUALIFIES A LIFT, and every rule is a reason one was left out:
     - SOURCED. A meet database entry (OpenPowerlifting, which also gives the
       weigh-in on the day), the person's own video or post, or a reputable
       article quoting one. Fan edits and "he can probably do X" are not.
     - RAW. Belts and knee wraps yes; bench shirts, squat suits and multi-ply
       gear no. A suited squat is a different lift wearing the same name, and
       rating it against unequipped norms would flatter by hundreds of pounds.
       Ed Coan's famous records and Ronnie Coleman's 800 squat are out for this.
     - A SET THE ESTIMATOR READS WELL. Almost all are singles; nothing over 12
       reps.
     - A BODYWEIGHT AT THE TIME. The app cannot place a lift without one.
       `bodyweightEstimated: true` means it is a stated or inferred figure
       rather than a weigh-in, and the screen says so.

   ⚠️ `reported: true` MARKS A LIFT WITH NO PRIMARY RECORD — the 1960s numbers
   for Arnold and Franco (secondary articles citing old German magazines),
   Coleman's gym videos, Bumstead's machine sets. Kept because they are the
   best public record of people users will ask about; labelled because a
   number presented as more certain than it is breaks Rule 5.

   ⚠️ THEIR MAP IS THEM AT THE TIME, not today. Every lift carries a date
   (the year is what the sources give; the month is a placeholder), and the
   screen says the comparison is against the lifts on record.

   🛑 WHAT IS DELIBERATELY MISSING: most people here are on record for the big
   three and little else, so their maps light up chest, legs and back and
   leave arms and shoulders unrated. Filling those from how they LOOK would be
   the app inventing a number about a real person. People who never publish a
   weight and a rep count (Sam Sulek, David Laid, Whitney Simmons, Krissy Cela
   and others) are not here for the same reason — the research that built
   this file refused to guess, and so does this file.

   Built 2026-09-27 from three research passes; the per-lift `source` is the
   citation. Re-researched 2026-09-21 for each person's PEAK (Tim: "the lifts
   they were doing when they were in the peak of their fitness"): one window,
   named in `peak`, chosen by strength for bodyweight rather than the heaviest
   number ever, with each lift's own weigh-in and a `note` saying why it's in. ⚠️ A real person's numbers: correct one only against a source.
   ========================================================================== */

import { BUILT_IN_EXERCISES } from './exercises.js';

/* A famous lifter's link token. ⚠️ A COLON, because `#/compare/<a>/<b>` splits
 * on `/` and a Firebase uid never contains one — so `famous:jeff-nippard` can
 * sit in either slot of the existing compare route and never be mistaken for a
 * person with an account. */
export const FIGURE_PREFIX = 'famous:';

export const FIGURE_GROUPS = [
  ['creator', 'Fitness creators'],
  ['athlete', 'Strength athletes'],
  ['legend', 'Legends'],
];

export function isFigureToken(token) {
  return typeof token === 'string' && token.startsWith(FIGURE_PREFIX);
}

export function figureById(id) {
  return PUBLIC_FIGURES.find((p) => p.id === id) || null;
}

/** "2014–2015 · 161 lb" — the one line a list row carries. */
export function figureSummary(fig) {
  const years = [...new Set(fig.lifts.map((l) => l.date.slice(0, 4)))].sort();
  const span = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0];
  return `${span} · ${Math.round(fig.bodyweightLb)} lb${fig.bodyweightEstimated ? ' (est.)' : ''}`;
}

/**
 * One famous lifter, as the rows `buildStrengthShare()` rates anybody from.
 *
 * ⚠️ A MEET SINGLE IS A BENCHMARK, A GYM SET IS A SESSION. A lift taken on a
 * platform is a deliberate test taken fresh, which is what a benchmark IS in
 * this app (Rule 4); a set in a training video is training. One session per
 * lift, never one session holding all of them — entries later in a session
 * are discounted for fatigue, and these were never done in one sitting.
 *
 * ⚠️ `today` IS THEIR MOST RECENT LIFT (see store.muscleRatings), and one
 * weigh-in per lift date so no set is priced against a carried-forward weight.
 * A lift's own `bodyweightLb` (its meet weigh-in) wins over the person's
 * typical one — a peak drawn from two meets can be two different weights.
 */
export function figureRows(fig) {
  const byName = new Map(BUILT_IN_EXERCISES.map((e) => [e.name, e]));
  const sessions = [];
  const benchmarks = [];
  const bodyWeights = [];
  fig.lifts.forEach((l, i) => {
    const ex = byName.get(l.exercise);
    if (!ex) return;
    const set = { weight: l.weightLb, reps: l.reps };
    if (!l.reported && l.reps <= 3) {
      benchmarks.push({ id: `${fig.id}-b${i}`, exerciseId: ex.id, exerciseName: ex.name,
        date: l.date, values: set });
    } else {
      sessions.push({ id: `${fig.id}-s${i}`, date: l.date, workoutName: ex.name,
        entries: [{ exerciseId: ex.id, exerciseName: ex.name, sets: [set] }] });
    }
    bodyWeights.push({ date: l.date, weight: l.bodyweightLb || fig.bodyweightLb });
  });
  const today = fig.lifts.map((l) => l.date).sort().pop();
  return {
    rows: { sessions, benchmarks, bodyWeights, today },
    profile: { gender: fig.sex === 'f' ? 'female' : 'male', bodyWeight: fig.bodyweightLb, compare: {} },
  };
}

/**
 * One famous lifter's published-map object — what the compare screen draws.
 *
 * 🚨 EACH MUSCLE AS OF THE DAY ITS EVIDENCE WAS FRESHEST, and the reason is
 * measured rather than argued. Rated once as of their most recent lift, a
 * person whose record spans years washes out: Greg Doucette's lifts are from
 * 2010, 2013 and 2017, and his back and legs came out at 1–6 % confidence —
 * drawn nearly colourless — purely for being older than his bench, which is
 * the recency weighting doing its job on the wrong question. The comparison is
 * "them at the time of their lifts", so they are rated once per lift date,
 * each time with only the lifts up to that date, and each muscle is taken from
 * the rating where its confidence was highest — which is the date its freshest
 * evidence was set. The dates on screen stay the real ones.
 *
 * ⚠️ `build` IS `buildStrengthShare`, handed in, so this module stays pure and
 * the data-layer suite can run it without a DOM.
 */
export async function figureStrength(fig, build) {
  const { rows, profile } = figureRows(fig);
  const dates = [...new Set(fig.lifts.map((l) => l.date))].sort();
  const upTo = (d) => ({
    sessions: rows.sessions.filter((s) => s.date <= d),
    benchmarks: rows.benchmarks.filter((b) => b.date <= d),
    bodyWeights: rows.bodyWeights.filter((w) => w.date <= d),
    today: d,
  });
  const maps = (await Promise.all(dates.map((d) => build(upTo(d), profile).catch(() => null))))
    .filter((m) => m && m.muscles && m.muscles.length);
  if (!maps.length) return null;

  const best = new Map();
  for (const map of maps) {
    for (const m of map.muscles) {
      const cur = best.get(m.muscle);
      if (!cur || (m.confidence || 0) > (cur.m.confidence || 0)) best.set(m.muscle, { m, map });
    }
  }
  const base = maps[maps.length - 1];
  const grid = {};
  for (const key of Object.keys(base.grid || {})) {
    grid[key] = {};
    for (const [muscle, { map }] of best) {
      const cell = map.grid && map.grid[key] && map.grid[key][muscle];
      if (cell !== undefined) grid[key][muscle] = cell;
    }
  }
  return { ...base, muscles: [...best.values()].map((b) => b.m), grid };
}

export const PUBLIC_FIGURES = [
  {
    id: "jeff-nippard",
    name: "Jeff Nippard",
    sex: "m",
    group: "creator",
    bodyweightLb: 180,
    bodyweightEstimated: false,
    peak: "Nov 2021 – Jun 2025 (~165–180 lb)",
    blurb: "Canadian science-based training YouTuber; former drug-tested CPU raw powerlifter (2nd, 74 kg, 2014 Canadian Nationals).",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 480,
        reps: 1,
        date: "2021-11-09",
        bodyweightLb: 180,
        reported: true,
        source: "https://www.youtube.com/watch?v=LrDJXIQ_-eg",
        note: "Own video 'How Strong Should You Be?' (transcript 2:52): 'as of right now I have about a 480 pound or 218 kilo squat ... at 180 pounds or 81 kilos bodyweight'. His stated current max, not a filmed single"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 380,
        reps: 1,
        date: "2021-11-09",
        bodyweightLb: 180,
        reported: true,
        source: "https://www.youtube.com/watch?v=LrDJXIQ_-eg",
        note: "Same statement: 'a 380 pound or 172 kilo bench'. Matches his earlier Facebook '380 lbs ALL TIME PR' video"
      },
      {
        exercise: "Deadlift",
        weightLb: 530,
        reps: 1,
        date: "2021-11-09",
        bodyweightLb: 180,
        reported: true,
        source: "https://www.youtube.com/watch?v=LrDJXIQ_-eg",
        note: "Same statement: 'a 530 pound or 240 kilo deadlift at 180 pounds'"
      },
      {
        exercise: "Back Squat",
        weightLb: 430,
        reps: 2,
        date: "2023-04-11",
        bodyweightLb: 180,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=1pB-lkdoEnI",
        note: "'Training Legs with Dr. Layne Norton' (transcript 7:49): missed a planned 455 double, 'dropped the weight back 25 pounds and go for 430 pounds for a double', completed. Bodyweight not stated; used his 180 lb from 2021 (he said he was 'maintaining my weight at around 180 lbs' in his May 2025 video)"
      },
      {
        exercise: "Stiff-Leg Deadlift",
        weightLb: 225,
        reps: 8,
        date: "2023-08-07",
        bodyweightLb: 180,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=8zWDuWKdBZU",
        note: "'The Perfect Leg Day' (transcript 1:45): 'two sets of eight reps on the stiff-legged deadlift ... I'll usually drop from something in the range of 405 pounds on my top set down to 225 pounds for the stiff leg pulls'. His usual working weight, not a max. Bodyweight not stated (~180)"
      },
      {
        exercise: "Glute-Ham Raise",
        weightLb: 10,
        reps: 8,
        date: "2023-04-11",
        bodyweightLb: 180,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=1pB-lkdoEnI",
        note: "ADDED weight: 'for my second set I added a 10 pound plate to my chest and did eight reps at about an RPE of nine' (third set with 12.5 lb had no rep count, so not used)"
      },
      {
        exercise: "Arnold Press",
        weightLb: 60,
        reps: 8,
        date: "2023-01-02",
        bodyweightLb: 180,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=c3pbe3qzatQ",
        note: "'The Ultimate Push Workout (2023)', standing dumbbell Arnold press: 'I've worked my way up to 60 pound dumbbells for sets of eight to ten'. 60 lb per dumbbell; 8 reps used (low end)"
      },
      {
        exercise: "Pull-Up",
        weightLb: 45,
        reps: 10,
        date: "2025-06-02",
        bodyweightLb: 165,
        reported: true,
        source: "https://www.youtube.com/watch?v=XUhA--3Iz2c",
        note: "ADDED weight 45 lb. Short 'Science Lifter Vs World's Strongest Pro' (vs Larry Wheels): 'I weighed in at 165 lb' on camera, then 'with a 45 lb plate strapped around my waist ... Okay, 10.' No straps"
      }
    ]
  },
  {
    id: "mike-israetel",
    name: "Mike Israetel",
    sex: "m",
    group: "creator",
    bodyweightLb: 250,
    bodyweightEstimated: false,
    peak: "Aug 2010 – Dec 2013, 231–269 lb (ETSU PhD / early RP years)",
    blurb: "Co-founder of Renaissance Periodization and host of the RP Strength YouTube channel; competed as a raw powerlifter in the 2000s.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 500,
        reps: 10,
        date: "2013-10-09",
        bodyweightLb: 247.2,
        reported: true,
        source: "https://www.youtube.com/watch?v=IaaVWifm25o",
        note: "Own video '500x10 Squat': high bar, belt only, 'Bodyweight is 247.2 this AM'"
      },
      {
        exercise: "Back Squat",
        weightLb: 562.2,
        reps: 2,
        date: "2011-04-01",
        bodyweightLb: 269,
        reported: true,
        source: "https://www.youtube.com/watch?v=gtZBJUEcCJE",
        note: "Own video 'Squat: 255kg (562lbs) 2 Reps': low bar, 'Bodyweight 269'. Upload date"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 365,
        reps: 8,
        date: "2011-01-18",
        bodyweightLb: 254,
        reported: true,
        source: "https://www.youtube.com/watch?v=7gHwEiy46LA",
        note: "Own video 'Bench Press 365 lbs for 8 Reps': 'Bodyweight 254 in the AM.'"
      },
      {
        exercise: "Incline Barbell Bench Press",
        weightLb: 335,
        reps: 10,
        date: "2013-10-11",
        bodyweightLb: 245,
        reported: true,
        source: "https://www.youtube.com/watch?v=bKWX5ivOvNo",
        note: "Own video: '335lbs for 10 paused reps in the Incline Bench Press ... Bodyweight in video is 245lbs.'"
      },
      {
        exercise: "Overhead Press",
        weightLb: 275,
        reps: 8,
        date: "2013-12-18",
        bodyweightLb: 241,
        reported: true,
        source: "https://www.youtube.com/watch?v=pT4Ebx2ra1A",
        note: "Own video 'Should[er] Press 275lbs for 8 Reps', 'Done at a bodyweight of 241lbs.' Standing"
      },
      {
        exercise: "Deficit Deadlift",
        weightLb: 551.2,
        reps: 5,
        date: "2011-01-24",
        bodyweightLb: 258,
        reported: true,
        source: "https://www.youtube.com/watch?v=GGIdWBWPTKg",
        note: "Own video 'Deficit Deadlift 250kg for 5 Reps (550lbs)': 'Pull from 2 inch platform. Bodyweight 258 in the AM.' (Was listed as 'Deadlift' before; the app has Deficit Deadlift)"
      },
      {
        exercise: "Barbell Row",
        weightLb: 350,
        reps: 8,
        date: "2013-10-11",
        bodyweightLb: 245,
        reported: true,
        source: "https://www.youtube.com/watch?v=HkEo5Thds10",
        note: "Own video: 'Strict Barbell Bent Row, 350lbs for 8 reps. Done at a bodyweight of 246.'"
      },
      {
        exercise: "Yates Row",
        weightLb: 300,
        reps: 10,
        date: "2013-07-11",
        bodyweightLb: 245,
        reported: true,
        source: "https://www.youtube.com/watch?v=o_m6HN_Wijk",
        note: "Own video 'Underhand EZ Row 300lbs for 10 Reps': 'Bodyweight 245'. Underhand row with an EZ bar; Yates Row is the closest app name"
      },
      {
        exercise: "Pull-Up",
        weightLb: 25,
        reps: 9,
        date: "2010-08-18",
        bodyweightLb: 265,
        reported: true,
        source: "https://www.youtube.com/watch?v=llFwGiT6QLE",
        note: "ADDED weight 25 lb: '9 pullups with 25lbs hanging at bodyweight of 265'"
      },
      {
        exercise: "Skull Crusher",
        weightLb: 195,
        reps: 12,
        date: "2012-04-04",
        bodyweightLb: 231,
        reported: true,
        source: "https://www.youtube.com/watch?v=5CaorvWCNkM",
        note: "Own video 'Skull Crusher 195 x 12 Reps': 'J.M. Style skull crusher, 195lbs ... Bodyweight is 231 in this video.' Replaces the weaker 185x10 (2010)"
      }
    ]
  },
  {
    id: "greg-doucette",
    name: "Greg Doucette",
    sex: "m",
    group: "creator",
    bodyweightLb: 198.4,
    bodyweightEstimated: false,
    peak: "Sep 2010 – Feb 2013, raw 90 kg class (~197–209 lb)",
    blurb: "Canadian IFBB pro bodybuilder, coach and very popular fitness YouTuber; long career as a competitive powerlifter.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 573.2,
        reps: 1,
        date: "2013-02-24",
        bodyweightLb: 197.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/gregdoucette",
        note: "260 kg, RUPC Raw Unity VI (Tampa), Raw, weigh-in 89.7 kg (his own video X9awbuSvH1U '573 RAW Squat RAW UNITY 6 at 198 lbs')"
      },
      {
        exercise: "Back Squat",
        weightLb: 600,
        reps: 1,
        date: "2010-12-08",
        bodyweightLb: 205,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=ydPgP9aKppo",
        note: "Own video 'my first ever 600 Raw Squat Dec 8 2010', description 'a tough new 1 rep max'. Gym lift. Bodyweight not stated; between his 198 lb Sep 2010 weigh-in and '209 lbs' in his Oct 27 2010 video (okp7e3HVT2Y)"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 523.6,
        reps: 1,
        date: "2011-01-22",
        bodyweightLb: 196.9,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/gregdoucette",
        note: "237.5 kg, RUPC Raw Unity IV, Raw, weigh-in 89.3 kg (own video wzcQv4sL3Eo 'Raw bench press 524 lbs 2nd attempt at raw unity 4')"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 450,
        reps: 6,
        date: "2010-12-20",
        bodyweightLb: 205,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=dInSioKyuTU",
        note: "Own video 'Raged a PR bench press 450 for 6 paused Dec 20 2010'. Raw (his slingshot sets are labelled as such and not used). Bodyweight estimated as above"
      },
      {
        exercise: "Deadlift",
        weightLb: 677.9,
        reps: 1,
        date: "2010-09-03",
        bodyweightLb: 198.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/gregdoucette",
        note: "307.5 kg, WPC Raw World Championships, Raw, weigh-in 90 kg"
      },
      {
        exercise: "Deadlift",
        weightLb: 686,
        reps: 6,
        date: "2010-12-07",
        bodyweightLb: 205,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=Y_mPWkJFZAs",
        note: "Own video '686 for 6 deadlift', description 'This beats my personal best by 5 reps.' Gym lift; bodyweight estimated as above"
      },
      {
        exercise: "Deadlift",
        weightLb: 708,
        reps: 2,
        date: "2010-12-11",
        bodyweightLb: 205,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=Q35XJLcy6bM",
        note: "Own video '708 for 2 deads Dec 11 2010'. Gym lift; bodyweight estimated as above"
      }
    ]
  },
  {
    id: "will-tennyson",
    name: "Will Tennyson",
    sex: "m",
    group: "creator",
    bodyweightLb: 198,
    bodyweightEstimated: false,
    peak: "Mar – Dec 2023, ~198 lb",
    blurb: "Canadian fitness YouTuber known for challenge videos; entered a drug-tested USAPL powerlifting meet in 2023.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 496,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 198,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/willtennyson",
        note: "225 kg, USAPL Virginia Shamrock Showdown, Raw, weigh-in 89.8 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 352.7,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 198,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/willtennyson",
        note: "160 kg, same meet"
      },
      {
        exercise: "Deadlift",
        weightLb: 529.1,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 198,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/willtennyson",
        note: "240 kg, same meet"
      },
      {
        exercise: "Overhead Press",
        weightLb: 245,
        reps: 1,
        date: "2023-05-15",
        bodyweightLb: 198,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.aol.com/bodybuilder-got-ass-kicked-worlds-133000340.html",
        note: "Men's Health via AOL (2023-06-04): '225, which is his current strict press PR, before setting a new best with 245 pounds', in his video with Mitchell Hooper after the April 2023 WSM. Exact date unknown (~May 2023). Bodyweight not stated; meet weight used"
      },
      {
        exercise: "Barbell Curl",
        weightLb: 125,
        reps: 1,
        date: "2023-12-14",
        bodyweightLb: 198,
        bodyweightEstimated: true,
        reported: true,
        source: "https://generationiron.com/ct-fletcher-will-tennyson-arms/",
        note: "Generation Iron (2023-12-14): 'he has to do a 125 lb strict curl under Fletcher's guidance ... throwing 150 lbs on the strict curl bar. Will could not complete the curl.' Strict curl (back against a post). Date is the article date; video date not given. Bodyweight not stated; meet weight used"
      }
    ]
  },
  {
    id: "jesse-james-west",
    name: "Jesse James West",
    sex: "m",
    group: "creator",
    bodyweightLb: 180.8,
    bodyweightEstimated: false,
    peak: "July 2021 – Dec 2022, ~181 lb",
    blurb: "American fitness YouTuber and natural bodybuilder; filmed his first powerlifting meet in December 2022.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 451.9,
        reps: 1,
        date: "2022-12-10",
        bodyweightLb: 180.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jessewest",
        note: "205 kg, USPA PWRBLD Winter War, Raw, weigh-in 82 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 405,
        reps: 1,
        date: "2021-07-04",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://x.com/jessejameswestt/status/1411807702985154560",
        note: "Own post '405 bench press pr!' with video, linking his YouTube 'FIRST TIME BENCHING 405! *MASSIVE PR*' (3OQtdedVxjI). Gym lift. Bodyweight not stated; Dec 2022 weigh-in used"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 336.2,
        reps: 1,
        date: "2022-12-10",
        bodyweightLb: 180.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jessewest",
        note: "152.5 kg meet bench (155 missed)"
      },
      {
        exercise: "Deadlift",
        weightLb: 490.5,
        reps: 1,
        date: "2022-12-10",
        bodyweightLb: 180.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jessewest",
        note: "222.5 kg, same meet"
      }
    ]
  },
  {
    id: "alan-thrall",
    name: "Alan Thrall",
    sex: "m",
    group: "creator",
    bodyweightLb: 241.7,
    bodyweightEstimated: false,
    peak: "April – Nov 2018, ~242 lb (USPA raw 110 kg)",
    blurb: "Strength coach and YouTuber (Untamed Strength); raw powerlifter and strongman competitor.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 534.6,
        reps: 1,
        date: "2018-05-19",
        bodyweightLb: 241.7,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/alanthrall",
        note: "242.5 kg, USPA Old Skool Iron Classic, Raw, weigh-in 109.65 kg"
      },
      {
        exercise: "Back Squat",
        weightLb: 500,
        reps: 5,
        date: "2018-04-30",
        bodyweightLb: 241.7,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=9mlKbck08AE",
        note: "Own video 'Squat: 500 lbs x 5 reps'; bodyweight from the meet three weeks later"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 341.7,
        reps: 1,
        date: "2018-05-19",
        bodyweightLb: 241.7,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/alanthrall",
        note: "155 kg, same meet"
      },
      {
        exercise: "Deadlift",
        weightLb: 584.2,
        reps: 1,
        date: "2018-05-19",
        bodyweightLb: 241.7,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/alanthrall",
        note: "265 kg, same meet"
      },
      {
        exercise: "Deadlift",
        weightLb: 600,
        reps: 1,
        date: "2018-04-10",
        bodyweightLb: 241.7,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=f4Uu634kp1M",
        note: "Own video '600 lbs. Deadlift'; bodyweight from the meet"
      }
    ]
  },
  {
    id: "chris-bumstead",
    name: "Chris Bumstead",
    sex: "m",
    group: "creator",
    bodyweightLb: 259,
    bodyweightEstimated: false,
    peak: "2021 – 2024 (Olympia title run); heaviest documented strength 2021–22 at ~237–259 lb",
    blurb: "Six-time Mr. Olympia Classic Physique champion (2019-2024) and one of the largest bodybuilding YouTubers.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 675,
        reps: 3,
        date: "2021-07-06",
        bodyweightLb: 237,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/bodybuilder-chris-bumstead-675-pound-deadlift-triple/",
        note: "'7 plates (675lbs) for 3 reps', straps, no belt; also his YouTube '7 PLATE DEADLIFT PR' (d-3acluxiQw, 2021-07-06). Bodyweight not stated; nearest stated is 237 lb (Jan 2022, 'Current weight is 237lbs', fitnessvolt.com/chris-bumstead-physique-post-covid)"
      },
      {
        exercise: "Back Squat",
        weightLb: 585,
        reps: 6,
        date: "2022-04-06",
        bodyweightLb: 237,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/chris-bumstead-massive-squat-training/",
        note: "Six plates a side for 6. Bodyweight not stated; nearest stated 237 lb (Jan 2022)"
      },
      {
        exercise: "Hack Squat",
        weightLb: 810,
        reps: 9,
        date: "2022-10-05",
        bodyweightLb: 259,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-day-2022-mr-olympia/",
        note: "'nine reps with nine 45-pound plates on each side' (plates only, machine sled not counted). Replaces the 540x6 (2023). Bodyweight not stated; nearest stated 259 lb (Jul 2022)"
      },
      {
        exercise: "Romanian Deadlift",
        weightLb: 225,
        reps: 12,
        date: "2022-10-05",
        bodyweightLb: 259,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-day-2022-mr-olympia/",
        note: "'two plates per side for sets of 12' after single-leg press ('relatively light'). Bodyweight as above"
      },
      {
        exercise: "Leg Press",
        weightLb: 810,
        reps: 10,
        date: "2023-06-16",
        bodyweightLb: 259,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-workout-2023-olympia-offseason/",
        note: "Early 2023 offseason leg day. Bodyweight not stated; nearest stated 259 lb (Jul 2022)"
      },
      {
        exercise: "Seated Dumbbell Shoulder Press",
        weightLb: 140,
        reps: 8,
        date: "2022-07-20",
        bodyweightLb: 259,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-140-pound-dumbbell-press-for-8-reps/",
        note: "140 lb dumbbells (each) for 8, a PR; '259 pounds the morning he filmed the video'"
      },
      {
        exercise: "Lateral Raise",
        weightLb: 40,
        reps: 12,
        date: "2023-10-26",
        bodyweightLb: 259,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-shoulder-workout-2023-mr-olympia/",
        note: "'45-pound dumbbells for his first set. He dropped down by five pounds on each of his next two sets, completing 12 reps on each one' -> 40 lb x 12 (first set's reps not stated). Two weeks out from the 2023 Olympia; bodyweight not stated, nearest stated 259 lb (Jul 2022) — he was lighter in prep"
      },
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 150,
        reps: 11,
        date: "2024-08-20",
        bodyweightLb: 259,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/chris-bumstead-150-pound-incline-dumbbell-bench-press/",
        note: "150 lb dumbbells (each) for 11, ~2 months before the 2024 Olympia. Bodyweight not stated; nearest stated 259 lb (Jul 2022) — he was lighter in prep"
      },
      {
        exercise: "Preacher Curl",
        weightLb: 50,
        reps: 8,
        date: "2022-04-29",
        bodyweightLb: 237,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/bodybuilder-chris-bumstead-2022-arms-workout/",
        note: "EZ-bar preacher curl 3x8 with '25-pound plates on both ends'. weightLb counts the plates only; the EZ bar's weight isn't stated, so the real load is ~15–25 lb higher (underrates him)"
      }
    ]
  },
  {
    id: "bradley-martyn",
    name: "Bradley Martyn",
    sex: "m",
    group: "creator",
    bodyweightLb: 260,
    bodyweightEstimated: false,
    peak: "2015 – 2017, ~260 lb (bench is from 2025, his only chest record)",
    blurb: "American fitness YouTuber and gym owner (Zoo Culture), known for strength challenges.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 545,
        reps: 10,
        date: "2015-11-09",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=fT5L8sKGljE",
        note: "Own video '545 for 10 deadlift | Bradley Martyn'. Bodyweight not stated; nearest stated is 260 lb (his June 2015 video 'Standing high jump | at 260lbs', rc9A617yAZ4)"
      },
      {
        exercise: "Barbell Shrug",
        weightLb: 855,
        reps: 3,
        date: "2015-08-10",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=KRneoUQCMd4",
        note: "Own video 'UPPER BODY FULL ROUTINE | 855 LB SHRUG FOR 3 REPS' (number from title only; setup — rack/straps — not described). Bodyweight as above"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 405,
        reps: 2,
        date: "2025-03-12",
        bodyweightLb: 260,
        reported: true,
        source: "https://fitnessvolt.com/bradley-martyn-and-andrew-tate-bench-press-challenge/",
        note: "OUTSIDE the window, kept as his only chest record. Bench challenge with Andrew Tate (also 315x11); article states 260 lb"
      }
    ]
  },
  {
    id: "john-haack",
    name: "John Haack",
    sex: "m",
    group: "athlete",
    bodyweightLb: 218.5,
    bodyweightEstimated: false,
    peak: "2024–2026",
    blurb: "American raw powerlifter, one of the strongest pound-for-pound lifters of the 2020s in the 90-100 kg classes.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 837.8,
        reps: 1,
        date: "2026-08-08",
        bodyweightLb: 218.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/johnhaack",
        note: "380 kg, PLU American Pro Invitational, raw, BW 99.1 kg; his heaviest meet squat."
      },
      {
        exercise: "Deadlift",
        weightLb: 939.2,
        reps: 1,
        date: "2024-04-06",
        bodyweightLb: 206,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/johnhaack",
        note: "426 kg, WRPF The Ghost Clash 3, raw, BW 93.45 kg; lifetime best meet deadlift."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 584.2,
        reps: 1,
        date: "2026-08-08",
        bodyweightLb: 218.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/johnhaack",
        note: "265 kg, PLU American Pro Invitational, raw, BW 99.1 kg; best bench inside the window (also 265 on 2026-03-14)."
      }
    ]
  },
  {
    id: "ray-williams",
    name: "Ray Williams",
    sex: "m",
    group: "athlete",
    bodyweightLb: 419.8,
    bodyweightEstimated: false,
    peak: "2017–2019",
    blurb: "American super-heavyweight raw powerlifter; squatted 490 kg raw in competition in 2019.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 1080.3,
        reps: 1,
        date: "2019-03-02",
        bodyweightLb: 419.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/raywilliams1",
        note: "490 kg, USAPL Arnold SBD Pro American, raw (knee sleeves), BW 190.4 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 545.6,
        reps: 1,
        date: "2019-03-02",
        bodyweightLb: 419.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/raywilliams1",
        note: "247.5 kg, same meet; lifetime best meet bench"
      },
      {
        exercise: "Deadlift",
        weightLb: 878.5,
        reps: 1,
        date: "2018-06-06",
        bodyweightLb: 417.1,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/raywilliams1",
        note: "398.5 kg, IPF World Classic Powerlifting Championships, raw, BW 189.2 kg; lifetime best meet deadlift"
      }
    ]
  },
  {
    id: "taylor-atwood",
    name: "Taylor Atwood",
    sex: "m",
    group: "athlete",
    bodyweightLb: 181.8,
    bodyweightEstimated: false,
    peak: "2024–2025",
    blurb: "American IPF 74 kg classic world champion and powerlifting coach.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 700,
        reps: 1,
        date: "2025-04-03",
        bodyweightLb: 181.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/tayloratwood",
        note: "317.5 kg, AMP Classic Open Nationals, raw, BW 82.48 kg."
      },
      {
        exercise: "Deadlift",
        weightLb: 755.1,
        reps: 1,
        date: "2025-04-03",
        bodyweightLb: 181.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/tayloratwood",
        note: "342.5 kg, same meet (also 342.5 at AMP Scary Strong 3, 2024-10-27)."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 481.7,
        reps: 1,
        date: "2025-07-27",
        bodyweightLb: 182.2,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/tayloratwood",
        note: "218.5 kg, NAPF Pan-American Powerlifting Championships, raw, BW 82.65 kg."
      }
    ]
  },
  {
    id: "jesus-olivares",
    name: "Jesus Olivares",
    sex: "m",
    group: "athlete",
    bodyweightLb: 402.1,
    bodyweightEstimated: false,
    peak: "2025–2026",
    blurb: "American IPF super-heavyweight classic powerlifter and multiple-time world champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 1054.9,
        reps: 1,
        date: "2025-11-22",
        bodyweightLb: 402.1,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jesusolivares",
        note: "478.5 kg, AMP SBD Austin, raw, BW 182.4 kg; heaviest meet squat."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 600.8,
        reps: 1,
        date: "2025-01-26",
        bodyweightLb: 394.3,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jesusolivares",
        note: "272.5 kg, IPF Sheffield Powerlifting Championships, raw, BW 178.84 kg; ties his lifetime best (first done at Sheffield 2023)."
      },
      {
        exercise: "Deadlift",
        weightLb: 920.4,
        reps: 1,
        date: "2026-03-05",
        bodyweightLb: 400.6,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jesusolivares",
        note: "417.5 kg, AMP Open Nationals, raw, BW 181.72 kg; heaviest meet deadlift."
      }
    ]
  },
  {
    id: "larry-wheels",
    name: "Larry Wheels",
    sex: "m",
    group: "athlete",
    bodyweightLb: 283.6,
    bodyweightEstimated: false,
    peak: "2020–2022",
    blurb: "American powerlifter and strength influencer (real name Larry Williams), known for elite raw totals and heavy pressing.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 870,
        reps: 1,
        date: "2020-03-07",
        bodyweightLb: 283.6,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/larrywilliams1",
        note: "394.63 kg (870 lb), XPC Arnold Pro Raw, BW 128.64 kg. Still his best straight-weight squat (the 2021 '950' squat was with chains)."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 661.4,
        reps: 1,
        date: "2022-04-03",
        bodyweightLb: 308.6,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/larry-wheels-300-kilogram-paused-bench-press-pr/",
        note: "300 kg paused bench in the gym (held ~2 s on the chest), wrist wraps and elbow sleeves, three spotters. 7.5 kg over his 292.5 kg meet record. BW is the '140 kg' in BarBend's headline."
      },
      {
        exercise: "Deadlift",
        weightLb: 930,
        reps: 2,
        date: "2022-05-30",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/larry-wheels-deadlifts-930-pounds-3-reps/",
        note: "421.8 kg conventional, belt and straps. Billed as a triple, but the article says he hitched the third rep (rested the bar on his thighs), so only 2 clean reps counted. BW 275 lb stated in the article."
      },
      {
        exercise: "Barbell Row",
        weightLb: 573.2,
        reps: 5,
        date: "2021-04-15",
        bodyweightLb: 283.6,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/larry-wheels-rows-6-plates-pr/",
        note: "260 kg (6 plates a side) for 5, a PR, training with Omar Tareq. Date = article date. No BW stated; used his March 2020 meet weigh-in."
      },
      {
        exercise: "Leg Press",
        weightLb: 1000,
        reps: 8,
        date: "2022-11-07",
        bodyweightLb: 251.3,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/larry-wheels-ronnie-coleman-leg-press-strength/",
        note: "Plate-loaded leg press, 1,000 lb x 8, leg session with Ronnie Coleman (he later did 1,180 lb for an unstated number of reps). Date = article date. BW is the 114 kg he stated a month later (fitnessvolt.com/larry-wheels-downsized-114-kg/)."
      },
      {
        exercise: "Barbell Curl",
        weightLb: 231,
        reps: 1,
        date: "2020-10-03",
        bodyweightLb: 283.6,
        bodyweightEstimated: true,
        reported: true,
        source: "https://generationiron.com/larry-wheels-strict-curl-231/",
        note: "105 kg strict curl PR (strict-curl style, back against a support). Date = article date. No BW stated; used his March 2020 meet weigh-in."
      },
      {
        exercise: "Hammer Curl",
        weightLb: 140,
        reps: 10,
        date: "2020-07-21",
        bodyweightLb: 283.6,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/larry-wheels-training-dumbbell-hammer-curls/",
        note: "140 lb dumbbells (each) for 10, training with Andrew Jacked. Date = article date. No BW stated; used his March 2020 meet weigh-in."
      },
      {
        exercise: "Seated Dumbbell Shoulder Press",
        weightLb: 200,
        reps: 4,
        date: "2024-01-16",
        bodyweightLb: 284,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/larry-wheels-dumbbell-shoulder-press-pr/",
        note: "OUTSIDE the window (only sourced shoulder lift I could open near it): 200 lb dumbbells EACH for 4, seated, PR, helpers handed the bells up (generationiron.com/larry-wheels-db-shoulder-press-pr/ also says 4 reps). BW is the 284 lb he weighed on 2023-11-04 (breakingmuscle.com/larry-wheels-gained-53-pounds-after-2023-amateur-olympia/)."
      }
    ]
  },
  {
    id: "julius-maddox",
    name: "Julius Maddox",
    sex: "m",
    group: "athlete",
    bodyweightLb: 447.5,
    bodyweightEstimated: false,
    peak: "2019–2021",
    blurb: "American bench press specialist; benched 355 kg raw in competition in 2021.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 782.6,
        reps: 1,
        date: "2021-02-20",
        bodyweightLb: 447.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/juliusmaddox",
        note: "355 kg, WRPF Hybrid Showdown III, raw, BW 203 kg; all-time raw bench record"
      },
      {
        exercise: "Incline Barbell Bench Press",
        weightLb: 600,
        reps: 3,
        date: "2019-12-31",
        bodyweightLb: 444.9,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/julius-maddox-600lb/",
        note: "His own Instagram post quoted: 'INCLINE (272kg) 600lbs X 3'. Gym lift, raw. Date = article date (Dec 2019). BW estimated from his 2019-11-16 meet weigh-in (201.8 kg)."
      },
      {
        exercise: "Seated Barbell Overhead Press",
        weightLb: 573.2,
        reps: 1,
        date: "2024-03-18",
        bodyweightLb: 428.1,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/julius-maddox-260-kilogram-seated-raw-shoulder-press/",
        note: "Quote: 'On March 18, 2024, Maddox published a video of himself on his Instagram page performing what he called a \"seated press\" with 260 kilograms (573 pounds) in a squat rack during a recent training session.' The back pad was set at a high incline and he wore wrist wraps (both raw-legal). OUTSIDE the 2019-2021 window, taken only because it's his sole Shoulders record. Bodyweight is his nearest weigh-in, 194.2 kg on 2025-07-12 per OpenPowerlifting. Fitness Volt confirms the lift: https://fitnessvolt.com/julius-maddox-impresses-ronnie-coleman-573lb-seated-press/"
      }
    ]
  },
  {
    id: "hafthor-bjornsson",
    name: "Hafþór Júlíus Björnsson",
    sex: "m",
    group: "athlete",
    bodyweightLb: 435.4,
    bodyweightEstimated: false,
    peak: "2018–2020",
    blurb: "Icelandic strongman, 2018 World's Strongest Man, who has also competed in full powerlifting meets.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 970,
        reps: 1,
        date: "2018-12-15",
        bodyweightLb: 435.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/hafthorjuliusbjornsson",
        note: "Thor's Powerlifting Challenge (WRPF-Iceland), raw with wraps. OpenPowerlifting CSV: Squat -420, 440, -460; bodyweight 197.5 kg."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 551.2,
        reps: 1,
        date: "2018-12-15",
        bodyweightLb: 435.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/hafthorjuliusbjornsson",
        note: "Same meet. Bench 235, 245, 250 kg."
      },
      {
        exercise: "Deadlift",
        weightLb: 1046.1,
        reps: 1,
        date: "2019-03-01",
        bodyweightLb: 435.4,
        bodyweightEstimated: true,
        reported: false,
        source: "https://www.youtube.com/watch?v=RacP3CN0Wkc",
        note: "2019 Arnold Strongman Classic, Rogue elephant bar (a longer bar than standard), 474.5 kg. Official Arnold Sports Festival video titled 'Hafthor Björnsson World Record ROGUE Elephant Bar Deadlift 1,046 pounds', uploaded 2019-03-01. Raw with straps, no suit, per Wikipedia's feats list ('elephant bar, raw with standard straps'). Bodyweight carried over from the Dec 2018 meet."
      },
      {
        exercise: "Overhead Press",
        weightLb: 440,
        reps: 1,
        date: "2018-08-29",
        bodyweightLb: 400,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/27636/the-mountain-440lbs-overhead/",
        note: "About 200 kg. The article says he used 'a slight trick that overhead pressers tend to do' (hip drive), so not perfectly strict. It gives his bodyweight as about 400 lb."
      }
    ]
  },
  {
    id: "ed-coan",
    name: "Ed Coan",
    sex: "m",
    group: "legend",
    bodyweightLb: 222,
    bodyweightEstimated: true,
    peak: "c.1984–1991 (220 lb class)",
    blurb: "American powerlifter often called the greatest of all time; his famous records (e.g. the 901 lb deadlift) were set in single-ply gear and are excluded here.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 545.6,
        reps: 1,
        date: "1991-07-26",
        bodyweightLb: 220.5,
        bodyweightEstimated: true,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/edcoan",
        note: "1991 USPF Senior Nationals, 247.5 kg. OpenPowerlifting files the whole meet as Single-ply (he wore a squat/deadlift suit), but Marty Gallagher, who coached him, states this bench was done without a bench shirt: https://www.ironcompany.com/blog/marty-gallagher-raw-resistance-training-greatness-of-ed-coan . Bodyweight is the 100 kg class limit OPL lists, not a recorded weigh-in."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 550,
        reps: 2,
        date: "1991-07-01",
        bodyweightLb: 225,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.ironcompany.com/blog/the-bench-press-wisdom-of-ed-coan",
        note: "Gallagher: 'He bench-pressed 550 for a touch-and-go shirtless double ... done when Ed weighed 225 or less.' Training lift, exact year not stated."
      },
      {
        exercise: "Behind-the-Neck Press",
        weightLb: 400,
        reps: 1,
        date: "1991-07-01",
        bodyweightLb: 225,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.ironcompany.com/blog/powerlifting-training-mentors-ed-coan-part-4",
        note: "Gallagher: 'Coan made 400 x 1 and 350 x 5 in the PBN weighing around 225.' Training lift, exact year not stated."
      },
      {
        exercise: "Behind-the-Neck Press",
        weightLb: 350,
        reps: 5,
        date: "1991-07-01",
        bodyweightLb: 225,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.ironcompany.com/blog/powerlifting-training-mentors-ed-coan-part-4",
        note: "Same passage as the 400 x 1. Exact year not stated."
      },
      {
        exercise: "Back Squat",
        weightLb: 760.6,
        reps: 1,
        date: "2003-11-15",
        bodyweightLb: 242.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/edcoan",
        note: "KEPT FROM CURRENT DATA, outside the peak window: 2003 USPF Texas Cup, Raw+Wraps, age 40, 345 kg. Every prime-era squat was in a squat suit; no raw prime squat could be sourced."
      },
      {
        exercise: "Deadlift",
        weightLb: 705.5,
        reps: 1,
        date: "2003-11-15",
        bodyweightLb: 242.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/edcoan",
        note: "KEPT FROM CURRENT DATA, outside the peak window: 2003 USPF Texas Cup, raw, age 40, 320 kg. Prime deadlifts (901 etc.) were in a suit."
      },
      {
        exercise: "Barbell Row",
        weightLb: 551,
        reps: 3,
        date: "2001-02-16",
        bodyweightLb: 235,
        bodyweightEstimated: true,
        reported: true,
        source: "https://archive.t-nation.com/training/atlas-speaks/",
        note: "Coan's own words (T-Nation 'Atlas Speaks', 2001-02-16): 'Once in a while, while getting ready for a meet, I'll stand on the block, do bent over rows and go up to 551 for three, no belt.' It's a deficit row (standing on a block). OUTSIDE the c.1984-1991 window, taken only because it's his sole Back record with a rep count. Bodyweight from the same interview: 'Anywhere from 230 to 240 pounds.'"
      }
    ]
  },
  {
    id: "ronnie-coleman",
    name: "Ronnie Coleman",
    sex: "m",
    group: "legend",
    bodyweightLb: 290,
    bodyweightEstimated: true,
    peak: "2000–2003",
    blurb: "Eight-time Mr. Olympia (1998-2005) who also competed in raw deadlift meets in the early 1990s.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 800,
        reps: 2,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/how-strong-was-ronnie-coleman/",
        note: "'The Unbelievable' (2000), ~5.5 weeks before the Olympia, with straps and gloves, no suit (fitnessvolt: 'tank top and boots'). Bodyweight estimated: no stated figure; 2000 was weeks out from a ~260-290 lb stage weight."
      },
      {
        exercise: "Deadlift",
        weightLb: 755,
        reps: 4,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/ronnie-coleman-strength/",
        note: "'Ronnie Coleman: The Unbelievable' (2000)."
      },
      {
        exercise: "Front Squat",
        weightLb: 585,
        reps: 4,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "'The Unbelievable' (2000) footage."
      },
      {
        exercise: "Hack Squat",
        weightLb: 780,
        reps: 8,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "'The Unbelievable' (2000) footage; machine hack squat, includes an estimated 60 lb for the sled (thebarbell)."
      },
      {
        exercise: "Dumbbell Bench Press",
        weightLb: 200,
        reps: 12,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "200 lb EACH dumbbell, two sets of 12 full reps, 'The Unbelievable' (2000)."
      },
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 200,
        reps: 5,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "200 lb EACH dumbbell, 'The Unbelievable' (2000)."
      },
      {
        exercise: "Barbell Row",
        weightLb: 495,
        reps: 8,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "'The Unbelievable' (2000) footage."
      },
      {
        exercise: "T-Bar Row",
        weightLb: 570,
        reps: 9,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/ronnie-coleman-strength/",
        note: "'The Unbelievable' (2000); BarBend gives '~570 x 9' too. 540 lb in plates plus an estimated 30 lb for the bar."
      },
      {
        exercise: "Seated Barbell Overhead Press",
        weightLb: 315,
        reps: 11,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "Seated, leaning back, 11 reps plus one forced rep (forced rep not counted). Attributed to 'The Unbelievable' (2000) by other write-ups; thebarbell only says 'on video'."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 495,
        reps: 5,
        date: "2003-07-01",
        bodyweightLb: 300,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/how-strong-was-ronnie-coleman/",
        note: "'The Cost of Redemption' (2003), wide grip. Bodyweight estimated: 2003 Olympia stage weight was ~287-292 lb, filmed in prep. Source: he may have had a little help on rep 5."
      },
      {
        exercise: "Leg Press",
        weightLb: 2325,
        reps: 8,
        date: "2003-07-01",
        bodyweightLb: 300,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "'The Cost of Redemption' (2003), narrow stance. BarBend and thebarbell say 8 reps; fitnessvolt says 10, took the lower. ~75 lb of the load is an estimated sled weight."
      },
      {
        exercise: "Seated Dumbbell Shoulder Press",
        weightLb: 160,
        reps: 7,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "160 lb EACH dumbbell, 'on video'. Year NOT stated by the source; dated 2000 because his filmed training DVDs are from 2000/2003."
      },
      {
        exercise: "Alternating Dumbbell Curl",
        weightLb: 75,
        reps: 8,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "Standing alternate dumbbell curls, 75 lb each, 'on video'. Year NOT stated by the source. Renamed from Dumbbell Curl: the source says \"standing alternate dumbbell curls\"."
      },
      {
        exercise: "Barbell Shrug",
        weightLb: 735,
        reps: 10,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "Behind-the-back shrugs, '10 short, quick reps', 'on video'. Year NOT stated."
      },
      {
        exercise: "Dumbbell Pullover",
        weightLb: 160,
        reps: 10,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "Greg Merritt, 'more Ronnie Coleman best exercises (all on video)': 'dumbbell pullovers: 160 lbs. x 10'. One dumbbell. Year not tied to one DVD; dated with the 2000 footage."
      }
    ]
  },
  {
    id: "arnold-schwarzenegger",
    name: "Arnold Schwarzenegger",
    sex: "m",
    group: "legend",
    bodyweightLb: 240,
    bodyweightEstimated: true,
    peak: "1968–1970",
    blurb: "Seven-time Mr. Olympia who won the 1968 German powerlifting championship (heavyweight) at age 20.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 474,
        reps: 1,
        date: "1968-05-05",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.castironstrength.com/arnolds-powerlifting-history/",
        note: "1968 German Powerlifting Championships, Munich, 5 May 1968, 215 kg. Raw (no suits existed). Reported via Kraftsport Revue / Albert Busek. No weigh-in figure found; ~235-240 lb is his usual stated weight then."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 440.9,
        reps: 1,
        date: "1968-05-05",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.castironstrength.com/arnolds-powerlifting-history/",
        note: "1968 German Powerlifting Championships, 200 kg."
      },
      {
        exercise: "Deadlift",
        weightLb: 683.4,
        reps: 1,
        date: "1968-05-05",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.castironstrength.com/arnolds-powerlifting-history/",
        note: "1968 German Powerlifting Championships, 310 kg (German record)."
      },
      {
        exercise: "Back Squat",
        weightLb: 465,
        reps: 6,
        date: "1970-07-01",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-arnold/",
        note: "Gold's Gym workout with Dave Draper per Muscle Builder magazine, 'circa 1970': '465 for 6-8 reps' - took 6."
      },
      {
        exercise: "Barbell Row",
        weightLb: 315,
        reps: 10,
        date: "1970-07-01",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-arnold/",
        note: "Same Muscle Builder workout, c.1970: '315 lbs. for 10 reps'."
      },
      {
        exercise: "Overhead Press",
        weightLb: 264.6,
        reps: 1,
        date: "1965-07-01",
        bodyweightLb: 210,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-arnold/",
        note: "OUTSIDE the peak window, kept because it's his only sourced overhead lift: 1965 Austrian Olympic lifting championships, age 18, 120 kg Olympic press. Castironstrength says 'best lifts reported, not confirmed as competition results'. Date corrected from 1967 to 1965. Bodyweight is a rough guess (no source), he was lighter than in 1968."
      },
      {
        exercise: "Incline Barbell Bench Press",
        weightLb: 365,
        reps: 6,
        date: "1970-07-01",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://archive.org/download/arnold-schwarzenegger-the-new-encyclopedia-of-modern-bodybuilding/Arnold%20Schwarzenegger%20-%20The%20New%20Encyclopedia%20Of%20Modern%20Bodybuilding_djvu.txt",
        note: "Arnold, New Encyclopedia of Modern Bodybuilding: 'Incline Presses using 365 pounds for 6 to 8 reps' on his heavy chest day. Took 6 (low end). No year given; dated to his c.1970 Gold's Gym period."
      },
      {
        exercise: "Dumbbell Fly",
        weightLb: 100,
        reps: 8,
        date: "1970-07-01",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-arnold/",
        note: "100 lb dumbbells EACH, 'eight reps of flat bench flyes', Muscle Builder coverage of a Gold's Gym workout with Dave Draper, circa 1970."
      }
    ]
  },
  {
    id: "franco-columbu",
    name: "Franco Columbu",
    sex: "m",
    group: "legend",
    bodyweightLb: 181,
    bodyweightEstimated: false,
    peak: "1973–1974",
    blurb: "Two-time Mr. Olympia (1976, 1981) from Sardinia and a competitive powerlifter.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 645,
        reps: 5,
        date: "1974-10-12",
        bodyweightLb: 181,
        reported: true,
        source: "https://thebarbell.com/1974-mr-olympia/",
        note: "Exhibition at the 1974 Mr. Olympia evening show, Madison Square Garden, 12 Oct 1974, 'weighing 181 pounds'. Replaces the 1968 595 lb single."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 407.9,
        reps: 1,
        date: "1968-07-01",
        bodyweightLb: 160,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-franco-columbu/",
        note: "OUTSIDE the 1973-74 window, kept as his only Chest record: 1968 German Championships, 185 kg, bodyweight ~160 lb."
      },
      {
        exercise: "Back Squat",
        weightLb: 585,
        reps: 4,
        date: "1973-07-01",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://ditillo2.blogspot.com/2020/09/franco-columbu-deadlift-training-1973.html",
        note: "Franco's own article 'Deadlift Training (1973)': heavy Monday squats '200x8, 300x8, 420x8, 500x6, 585x4', 'I go all the way down'. Replaces the 1968 507 lb single. BW is his 1974 Olympia weight."
      },
      {
        exercise: "Barbell Row",
        weightLb: 225,
        reps: 10,
        date: "1973-07-01",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://ditillo2.blogspot.com/2020/09/franco-columbu-deadlift-training-1973.html",
        note: "Same article: 'Using a wide, snatch grip, I perform 4 sets of 10 with 225.' A working set, not a max."
      },
      {
        exercise: "Stiff-Leg Deadlift",
        weightLb: 315,
        reps: 8,
        date: "1973-07-01",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://ditillo2.blogspot.com/2020/09/franco-columbu-deadlift-training-1973.html",
        note: "Same article: 'Stiff Legged Deadlift, standing on block: 315x8x3 sets.'"
      },
      {
        exercise: "Good Morning",
        weightLb: 315,
        reps: 8,
        date: "1973-07-01",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://ditillo2.blogspot.com/2020/09/franco-columbu-deadlift-training-1973.html",
        note: "Same article: 'Good Morning: 315x8x3 sets.'"
      },
      {
        exercise: "Leg Press",
        weightLb: 700,
        reps: 6,
        date: "1973-07-01",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://ditillo2.blogspot.com/2020/09/franco-columbu-deadlift-training-1973.html",
        note: "Same article: 'Leg Press: 500x10, 600x10, 700x6x2 sets.' Sled weight unknown, not included."
      },
      {
        exercise: "Upright Row",
        weightLb: 200,
        reps: 8,
        date: "1974-07-01",
        bodyweightLb: 181,
        bodyweightEstimated: true,
        reported: true,
        source: "https://ditillo2.blogspot.com/2014/03/trapezius-development-franco-columbu.html",
        note: "Franco's own 'Trapezius Development (1974)': close-grip high upright rows '120x8, 140x8, 160x8, 180x8, and 200x8'."
      }
    ]
  },
  {
    id: "stefi-cohen",
    name: "Stefi Cohen",
    sex: "f",
    group: "athlete",
    bodyweightLb: 119.9,
    bodyweightEstimated: false,
    peak: "2019 (WRPF Kern US Open, 56 kg class)",
    blurb: "Venezuelan-American powerlifter, physical therapist and YouTuber; held 25 world records and was the first woman to deadlift over 4x bodyweight.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 507.1,
        reps: 1,
        date: "2019-04-27",
        bodyweightLb: 119.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/stefaniecohen",
        note: "WRPF Kern US Open, 'Wraps' division (knee wraps, no suit)"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 242.5,
        reps: 1,
        date: "2019-04-27",
        bodyweightLb: 119.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/stefaniecohen",
        note: "WRPF Kern US Open, raw bench"
      },
      {
        exercise: "Deadlift",
        weightLb: 529.1,
        reps: 1,
        date: "2019-04-27",
        bodyweightLb: 119.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/stefaniecohen",
        note: "WRPF Kern US Open; her 240 kg / 529 lb world-record pull at ~119 lb"
      }
    ]
  },
  {
    id: "heather-connor",
    name: "Heather Connor",
    sex: "f",
    group: "athlete",
    bodyweightLb: 103.2,
    bodyweightEstimated: false,
    peak: "2025–2026, 47 kg class",
    blurb: "American IPF powerlifter in the 47 kg class; multiple-time world classic champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 330.7,
        reps: 1,
        date: "2026-01-31",
        bodyweightLb: 103,
        reported: false,
        source: "https://www.openpowerlifting.org/u/heatherconnor",
        note: "IPF Sheffield 2026, raw"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 170.9,
        reps: 1,
        date: "2026-01-31",
        bodyweightLb: 103,
        reported: false,
        source: "https://www.openpowerlifting.org/u/heatherconnor",
        note: "IPF Sheffield 2026, raw"
      },
      {
        exercise: "Deadlift",
        weightLb: 468.5,
        reps: 1,
        date: "2025-06-08",
        bodyweightLb: 103.3,
        reported: false,
        source: "https://www.openpowerlifting.org/u/heatherconnor",
        note: "IPF World Classic 2025, raw"
      }
    ]
  },
  {
    id: "jessica-buettner",
    name: "Jessica Buettner",
    sex: "f",
    group: "athlete",
    bodyweightLb: 166,
    bodyweightEstimated: false,
    peak: "2022 (May–June), 76 kg class",
    blurb: "Canadian IPF powerlifter; world classic champion in the 76 kg class, known for a 261.5 kg deadlift.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 481.7,
        reps: 1,
        date: "2022-06-06",
        bodyweightLb: 165.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessicabuettner",
        note: "IPF World Classic 2022, raw"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 237,
        reps: 1,
        date: "2022-05-09",
        bodyweightLb: 166.2,
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessicabuettner",
        note: "CPU Nationals 2022, raw (one month before Worlds)"
      },
      {
        exercise: "Deadlift",
        weightLb: 576.5,
        reps: 1,
        date: "2022-06-06",
        bodyweightLb: 165.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessicabuettner",
        note: "IPF World Classic 2022, raw"
      }
    ]
  },
  {
    id: "amanda-lawrence",
    name: "Amanda Lawrence",
    sex: "f",
    group: "athlete",
    bodyweightLb: 184.5,
    bodyweightEstimated: false,
    peak: "2025–Jan 2026, 84 kg class",
    blurb: "American IPF powerlifter in the 84 kg class; multiple-time world classic champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 552.3,
        reps: 1,
        date: "2026-01-31",
        bodyweightLb: 185,
        reported: false,
        source: "https://www.openpowerlifting.org/u/amandalawrence1",
        note: "IPF Sheffield 2026, raw"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 303.1,
        reps: 1,
        date: "2025-04-03",
        bodyweightLb: 184.6,
        reported: false,
        source: "https://www.openpowerlifting.org/u/amandalawrence1",
        note: "AMP Classic Open Nationals 2025, raw"
      },
      {
        exercise: "Deadlift",
        weightLb: 593,
        reps: 1,
        date: "2025-01-26",
        bodyweightLb: 184.4,
        reported: false,
        source: "https://www.openpowerlifting.org/u/amandalawrence1",
        note: "IPF Sheffield 2025, raw"
      }
    ]
  },
  {
    id: "marianna-gasparyan",
    name: "Marianna Gasparyan",
    sex: "f",
    group: "athlete",
    bodyweightLb: 123.5,
    bodyweightEstimated: false,
    peak: "2019 (WRPF Kern US Open, 56 kg class)",
    blurb: "Russian-Armenian powerlifter known for an unusually strong squat and bench at around 56-60 kg.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 573.2,
        reps: 1,
        date: "2019-04-27",
        bodyweightLb: 123.5,
        reported: false,
        source: "https://www.openpowerlifting.org/u/mariannagasparyan",
        note: "WRPF Kern US Open, 'Wraps' division (knee wraps, no suit); her no-wraps best is 230 kg (USPA The Tribute 2019-08-03, 57.7 kg)"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 292.1,
        reps: 1,
        date: "2019-04-27",
        bodyweightLb: 123.5,
        reported: false,
        source: "https://www.openpowerlifting.org/u/mariannagasparyan",
        note: "WRPF Kern US Open, raw bench"
      },
      {
        exercise: "Deadlift",
        weightLb: 485,
        reps: 1,
        date: "2019-04-27",
        bodyweightLb: 123.5,
        reported: false,
        source: "https://www.openpowerlifting.org/u/mariannagasparyan",
        note: "WRPF Kern US Open, raw"
      }
    ]
  },
  {
    id: "jen-thompson",
    name: "Jen Thompson",
    sex: "f",
    group: "athlete",
    bodyweightLb: 136.7,
    bodyweightEstimated: false,
    peak: "2018, 63 kg class (age 44–45)",
    blurb: "American powerlifter and one of the best female bench pressers ever; still competing as a master.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 341.7,
        reps: 1,
        date: "2018-03-03",
        bodyweightLb: 134.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/jenniferthompson1",
        note: "NAPF Arnold Grand Prix 2018, raw"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 319.7,
        reps: 1,
        date: "2018-09-15",
        bodyweightLb: 138.7,
        reported: false,
        source: "https://www.openpowerlifting.org/u/jenniferthompson1",
        note: "USAPL Bench Press Nationals 2018, raw"
      },
      {
        exercise: "Deadlift",
        weightLb: 457.5,
        reps: 1,
        date: "2018-10-11",
        bodyweightLb: 137.3,
        reported: false,
        source: "https://www.openpowerlifting.org/u/jenniferthompson1",
        note: "USAPL Raw Nationals 2018, raw"
      }
    ]
  },
  {
    id: "meg-gallagher",
    name: "Meg Gallagher (Meg Squats)",
    sex: "f",
    group: "creator",
    bodyweightLb: 136.9,
    bodyweightEstimated: false,
    peak: "2017–2018, 63 kg class",
    blurb: "Fitness YouTuber and coach behind Meg Squats / Strong Strong Friends; competed at USAPL Raw Nationals 2014-2018.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 308.6,
        reps: 1,
        date: "2018-10-11",
        bodyweightLb: 136.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/megangallagher",
        note: "USAPL Raw Nationals 2018, raw"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 170.9,
        reps: 1,
        date: "2018-10-11",
        bodyweightLb: 136.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/megangallagher",
        note: "USAPL Raw Nationals 2018, raw"
      },
      {
        exercise: "Deadlift",
        weightLb: 407.9,
        reps: 1,
        date: "2018-10-11",
        bodyweightLb: 136.9,
        reported: false,
        source: "https://www.openpowerlifting.org/u/megangallagher",
        note: "USAPL Raw Nationals 2018, raw"
      }
    ]
  },
  {
    id: "sam-sulek",
    name: "Sam Sulek",
    sex: "m",
    group: "creator",
    bodyweightLb: 237.2,
    bodyweightEstimated: true,
    peak: "2025–2026",
    blurb: "American bodybuilder and YouTuber famous for daily training vlogs; IFBB Classic Physique pro since 2025.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 545,
        reps: 7,
        date: "2026-09-20",
        bodyweightLb: 237.2,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=sw3LEOjOs1w",
        note: "Video 'The Bulk Rebirth Day 18 - 545 lb Squat 237.2 lbs'. He says '545 on squat at 237.2 lb' and that the set was 'one rep shorter than I would want' after saying he wants 'eight reps minimum', so 7 reps is read from the transcript, not counted on screen. Bodyweight is his stated morning scale weight in the title."
      },
      {
        exercise: "Incline Barbell Bench Press",
        weightLb: 365,
        reps: 9,
        date: "2026-05-15",
        bodyweightLb: 239,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=BswtelWCVjA",
        note: "Video '4 Plate Incline Inbound - Bulk Day 18': 'Three plates and a 25 for what? Nine. ... he didn't even help on that last one' (45 + 2x(3x45+25) = 365). Bodyweight: his stated starting weight 239 lb on Bulk Day 1 (2026-04-27, youtube vBPU_jGKW_o)."
      }
    ]
  },
  {
    id: "david-laid",
    name: "David Laid",
    sex: "m",
    group: "creator",
    bodyweightLb: 210,
    bodyweightEstimated: true,
    peak: "2017–2018",
    blurb: "American fitness YouTuber and Gymshark athlete known for his teenage natural transformation and powerbuilding.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 390,
        reps: 1,
        date: "2018-01-05",
        bodyweightLb: 210,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=347NLFcNFXY",
        note: "Own video '390lb Bench Press & 455lb Squat | Important Updates' (uploaded 2018-01-05). Single-rep PR per the title. Bodyweight from his 2018-01-01 Instagram caption: 'body weight is closing in at 210lbs'."
      },
      {
        exercise: "Back Squat",
        weightLb: 455,
        reps: 1,
        date: "2018-01-01",
        bodyweightLb: 210,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.instagram.com/davidlaid/p/Bdbo_cXlJ-9/",
        note: "Instagram caption 2018-01-01: '455lb Squat and 375lb Bench PR ... body weight is closing in at 210lbs'. Same 455 squat is in the title of his 2018-01-05 video."
      },
      {
        exercise: "Deadlift",
        weightLb: 675,
        reps: 1,
        date: "2018-01-30",
        bodyweightLb: 210,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=c6a-WDbEHPU",
        note: "Own video 'YEEZY GIVEAWAY!!! | 675lb Deadlift | DUP Explained' (2018-01-30). Gymshark's profile confirms 'a 306kg deadlift' at 19 (https://www.gymshark.com/blog/article/david-laid-workout)."
      }
    ]
  },
  {
    id: "mike-ohearn",
    name: "Mike O'Hearn",
    sex: "m",
    group: "creator",
    bodyweightLb: 250,
    bodyweightEstimated: true,
    peak: "2022–2024",
    blurb: "American bodybuilder, former powerlifter and American Gladiators 'Titan', known for 'power bodybuilding' content into his fifties.",
    lifts: [
      {
        exercise: "Close-Grip Bench Press",
        weightLb: 385,
        reps: 10,
        date: "2022-04-07",
        bodyweightLb: 250,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/mike-ohearn-train-arms-close-grip-bench/",
        note: "Fitness Volt writeup of his YouTube arm workout with Heath Evans (uploaded 2022-04-07 per BarBend): '385lb for Whopping 10 Reps'. Bodyweight: Generation Iron lists 245-255 lb (https://generationiron.com/mike-ohearn-workout/), midpoint used."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 315,
        reps: 6,
        date: "2024-03-19",
        bodyweightLb: 250,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.essentiallysports.com/bodybuilding-news-bros-so-strong-still-bodybuilding-community-left-jaw-dropped-over-fifty-five-yo-mike-ohearns-three-hundred-fifteen-lbs-bench-press/",
        note: "Age 55, his wife Mona Muresan spotting and counting 6 reps."
      },
      {
        exercise: "Back Squat",
        weightLb: 635,
        reps: 2,
        date: "2017-01-13",
        bodyweightLb: 250,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=ge2nGm3XM8c",
        note: "OUTSIDE the peak window - kept because it is his only Quads record. Title 'Mike o hearn - squat (2 reps of 635lbs)(20 reps of 500lbs)' on a re-upload channel (FITNESS MODELS); date is that upload date, the lift is probably older. Belt use unknown."
      }
    ]
  },
  {
    id: "chris-heria",
    name: "Chris Heria",
    sex: "m",
    group: "creator",
    bodyweightLb: 169,
    bodyweightEstimated: true,
    peak: "2023–2024",
    blurb: "Miami-based calisthenics YouTuber and founder of THENX.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 285,
        reps: 1,
        date: "2024-07-20",
        bodyweightLb: 169,
        bodyweightEstimated: true,
        reported: true,
        source: "https://boxlifemagazine.com/larry-wheels-calisthenics-strength-secret/",
        note: "Max test filmed by Larry Wheels ('Chris Heria tests his max squat, dead and bench!', youtube 62FRBKNEEn8, uploaded 2024-07-20). Article: 285 lb bench at 169 lb bodyweight. Date is the video upload date."
      },
      {
        exercise: "Deadlift",
        weightLb: 410,
        reps: 1,
        date: "2024-07-20",
        bodyweightLb: 169,
        bodyweightEstimated: true,
        reported: true,
        source: "https://boxlifemagazine.com/larry-wheels-calisthenics-strength-secret/",
        note: "Same session: 'locked out 410 pounds'."
      }
    ]
  },
  {
    id: "christian-guzman",
    name: "Christian Guzman",
    sex: "m",
    group: "creator",
    bodyweightLb: 170,
    bodyweightEstimated: true,
    peak: "2014–2016",
    blurb: "Houston fitness YouTuber and founder of Alphalete Athletics and Alphaland gym.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 585,
        reps: 1,
        date: "2016-03-18",
        bodyweightLb: 170,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=Uf2WL0-_DNU",
        note: "Own video '585 Pound RAW Squat | Summer Shredding Episode 03'. Reps not in the title, counted as a single (the lowest it can be). Bodyweight: no 2016 figure found - nearest stated is 'under 170 LBS' (Dec 2013); he was likely heavier by 2016."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 315,
        reps: 3,
        date: "2014-03-05",
        bodyweightLb: 170,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=D2xffxhUqCk",
        note: "Own video '315X3 Bench Press'. Bodyweight from his 2013-12-28 video '315 LB Bench Press Under 170 LBS Bodyweight' (youtube vf0E7DkwZoI)."
      },
      {
        exercise: "Dumbbell Bench Press",
        weightLb: 120,
        reps: 9,
        date: "2014-02-23",
        bodyweightLb: 170,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=3Jot2EHcbhA",
        note: "Own video '120X9 Dumbbell Press and Raw Footage'. Title does not say flat or incline; logged as flat."
      }
    ]
  },
  {
    id: "michael-gaiera",
    name: "Michael Gaiera (Tren Twin)",
    sex: "m",
    group: "creator",
    bodyweightLb: 197.1,
    bodyweightEstimated: false,
    peak: "2023–2026",
    blurb: "One half of the Tren Twins, the Michigan-born identical-twin powerbuilding YouTubers.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 661.4,
        reps: 1,
        date: "2023-02-04",
        bodyweightLb: 197.1,
        reported: false,
        source: "https://www.openpowerlifting.org/u/michaelgaiera",
        note: "WRPF Michigan Open, Raw division (knee wraps allowed in WRPF raw), 90 kg class, weigh-in 89.4 kg. Squat 3rd attempt 300 kg good. He bombed the deadlift (DQ), but the squat is a judged good lift."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 501.6,
        reps: 1,
        date: "2023-02-04",
        bodyweightLb: 197.1,
        reported: false,
        source: "https://www.openpowerlifting.org/u/michaelgaiera",
        note: "Same meet: bench 227.5 kg made on 3rd attempt."
      }
    ]
  },
  {
    id: "christian-gaiera",
    name: "Christian Gaiera (Tren Twin)",
    sex: "m",
    group: "creator",
    bodyweightLb: 214.3,
    bodyweightEstimated: false,
    peak: "2023–2026",
    blurb: "One half of the Tren Twins, the Michigan-born identical-twin powerbuilding YouTubers.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 650.4,
        reps: 1,
        date: "2023-02-04",
        bodyweightLb: 214.3,
        reported: false,
        source: "https://www.openpowerlifting.org/u/christiangaiera",
        note: "WRPF Michigan Open, Raw (knee wraps allowed), 100 kg class, weigh-in 97.2 kg. Squat 295 kg made on 3rd attempt."
      },
      {
        exercise: "Deadlift",
        weightLb: 622.8,
        reps: 1,
        date: "2023-02-04",
        bodyweightLb: 214.3,
        reported: false,
        source: "https://www.openpowerlifting.org/u/christiangaiera",
        note: "Same meet: deadlift 282.5 kg made (295 kg missed). He bombed the bench (DQ), but this pull is a judged good lift."
      }
    ]
  },
  {
    id: "nick-walker",
    name: "Nick Walker",
    sex: "m",
    group: "creator",
    bodyweightLb: 277,
    bodyweightEstimated: true,
    peak: "2022–2024",
    blurb: "IFBB Pro Open bodybuilder nicknamed 'The Mutant', 2021 Arnold Classic champion and a top Mr. Olympia contender with a large YouTube following.",
    lifts: [
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 200,
        reps: 10,
        date: "2022-08-09",
        bodyweightLb: 277,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/nick-walker-200lb-incline-dumbbell-press-10-reps/",
        note: "200 lb dumbbells (each) for 10, Instagram caption '200db press for 10 reps'. Beats his 185x10 (Apr 2022) and 180x11 flat (Nov 2022). Bodyweight: 277 lb stated Nov 2022 (BarBend), not on the day"
      },
      {
        exercise: "Seated Dumbbell Shoulder Press",
        weightLb: 165,
        reps: 9,
        date: "2022-04-17",
        bodyweightLb: 277,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/nick-walker-165lbs-dumbbell-shoulder-press/",
        note: "Caption says '165 pound shoulder press for 10 reps', but the spotter helped on the 10th rep, so 9 unassisted reps are logged. 165 lb dumbbells each, seated"
      },
      {
        exercise: "Deadlift",
        weightLb: 495,
        reps: 6,
        date: "2024-08-09",
        bodyweightLb: 285,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/nick-walker-deadlifts-495-pound-2024-mr-olympia-prep/",
        note: "Two sets of 6 with 495, weeks before the 2024 Olympia. Equipment not stated. Bodyweight not stated; nearest stated figure is 285 lb (Aug 2023)"
      },
      {
        exercise: "Romanian Deadlift",
        weightLb: 435,
        reps: 7,
        date: "2024-11-14",
        bodyweightLb: 285,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/nick-walker-5-day-training-split/",
        note: "Free-weight barbell RDL, sets of 7, 6, 6 at 435 lb (best set logged). Date is the article/video date. Bodyweight not stated; nearest stated 285 lb (Aug 2023)"
      },
      {
        exercise: "Leg Press",
        weightLb: 630,
        reps: 10,
        date: "2023-08-24",
        bodyweightLb: 285,
        reported: true,
        source: "https://barbend.com/news/nick-walker-quad-sweep-training/",
        note: "Seven 45 lb plates per side = 630 lb of plates (sled not included), worked in a 10–15 rep range with a pause at the bottom; 10 reps logged as the conservative end. Article states he weighed 285 lb at this point of 2023 Olympia prep"
      }
    ]
  },
  {
    id: "derek-lunsford",
    name: "Derek Lunsford",
    sex: "m",
    group: "creator",
    bodyweightLb: 240,
    bodyweightEstimated: true,
    peak: "2023–2024",
    blurb: "Mr. Olympia (2023 and 2025) and 2021 212 Olympia champion, the first man to win Olympia titles in two divisions; posts his training on YouTube.",
    lifts: [
      {
        exercise: "Hack Squat",
        weightLb: 900,
        reps: 12,
        date: "2024-05-30",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://generationiron.com/derek-lunsford-hack-squat-heavy-leg-day/",
        note: "PR in a 2024 offseason video (also Fitness Volt: https://fitnessvolt.com/derek-lunsford-leg-workout-pr-2024-off-season/). 900 lb as he reported it (up from 800x12 the year before); whether the sled is included isn't stated. Knee sleeves and belt. Bodyweight: Wikipedia offseason weight 240 lb"
      },
      {
        exercise: "Rack Pull",
        weightLb: 405,
        reps: 10,
        date: "2024-07-11",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/derek-lunsford-2024-olympia-prep-back-training/",
        note: "Top set of rack pulls, 405 x 10, in a 2024 Olympia prep back video. Pin height not stated"
      },
      {
        exercise: "Lateral Raise",
        weightLb: 72.8,
        reps: 12,
        date: "2023-08-21",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/derek-lunsford-shoulder-workout-2023-mr-olympia/",
        note: "Standing dumbbell lateral raise, 33 kg dumbbells (each) for 12, 11 weeks out from the 2023 Olympia"
      },
      {
        exercise: "Smith Machine Bench Press",
        weightLb: 275.6,
        reps: 9,
        date: "2023-09-21",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/derek-lunsford-chest-abs-workout-2023-mr-olympia/",
        note: "Smith machine bench 125 kg for 9, six weeks out from the 2023 Olympia (which he won). Bar weight counting on the Smith machine is as reported"
      }
    ]
  },
  {
    id: "jay-cutler",
    name: "Jay Cutler",
    sex: "m",
    group: "legend",
    bodyweightLb: 300,
    bodyweightEstimated: true,
    peak: "late 1990s–2000s (years not stated in the source)",
    blurb: "Four-time Mr. Olympia (2006, 2007, 2009, 2010) who now runs a popular YouTube channel.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 550,
        reps: 2,
        date: "2000-07-01",
        bodyweightLb: 300,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/how-strong-was-jay-cutler/",
        note: "'He got up to 550 pounds for two reps before deciding that the potential risks far outweighed the benefits' (BarBend, citing a 2019 Muscular Development piece). Year not stated, so the date is a placeholder in his early pro era. Bodyweight: Wikipedia offseason 290–310 lb"
      },
      {
        exercise: "Deadlift",
        weightLb: 585,
        reps: 3,
        date: "2000-07-01",
        bodyweightLb: 300,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/how-strong-was-jay-cutler/",
        note: "585 x 3 from the floor, same source. Year not stated (placeholder date)"
      },
      {
        exercise: "Rack Pull",
        weightLb: 675,
        reps: 3,
        date: "2000-07-01",
        bodyweightLb: 300,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/how-strong-was-jay-cutler/",
        note: "675 for 3–6 reps as a rack pull; 3 logged (low end). Year not stated (placeholder date)"
      },
      {
        exercise: "Behind-the-Neck Press",
        weightLb: 405,
        reps: 2,
        date: "2000-07-01",
        bodyweightLb: 300,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/how-strong-was-jay-cutler/",
        note: "He said he could do 'a few good reps' with 405 behind the neck; logged as 2 reps, the most conservative reading of 'a few'. Year not stated (placeholder date)"
      }
    ]
  },
  {
    id: "dorian-yates",
    name: "Dorian Yates",
    sex: "m",
    group: "legend",
    bodyweightLb: 260,
    bodyweightEstimated: true,
    peak: "1992–1997",
    blurb: "Six-time consecutive Mr. Olympia (1992–1997) known for brief, very heavy 'Blood and Guts' training.",
    lifts: [
      {
        exercise: "Barbell Row",
        weightLb: 405,
        reps: 6,
        date: "1993-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-dorian-yates/",
        note: "'405 for six reps' (The Barbell, citing Blood and Guts / A Warrior's Story). BarBend says he repped 405 until his 1994 biceps tear, so dated before 1994. Bodyweight: Wikipedia contest weight 255–265 lb; offseason weight not stated"
      },
      {
        exercise: "Dumbbell Row",
        weightLb: 215,
        reps: 12,
        date: "1994-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/how-strong-was-dorian-yates/",
        note: "'worked up to 215-pound dumbbell rows for 12 reps' (BarBend, citing A Portrait of Dorian Yates). Year not stated; placed in his Olympia years"
      },
      {
        exercise: "Incline Barbell Bench Press",
        weightLb: 425,
        reps: 4,
        date: "1996-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/dorian-yates-workout/",
        note: "'425-pound incline presses for 4 reps' (The Barbell; ~4 clean + 2 forced in Blood and Guts, 1996). BarBend says 425 x 8; the conservative 4 clean reps are logged"
      },
      {
        exercise: "Leg Press",
        weightLb: 1265,
        reps: 11,
        date: "1996-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-dorian-yates/",
        note: "45-degree leg press 1,265 lb x 11 (Blood and Guts video, 1996)"
      },
      {
        exercise: "Hack Squat",
        weightLb: 660,
        reps: 8,
        date: "1996-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/how-strong-was-dorian-yates/",
        note: "'hit 660 pounds for eight to 10 reps' after pre-exhausting; 8 logged. Year not stated; Olympia era"
      },
      {
        exercise: "Rack Pull",
        weightLb: 455,
        reps: 6,
        date: "1996-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-dorian-yates/",
        note: "Partial-range deadlifts '455 x 6 with straps' (Blood and Guts era). Logged as Rack Pull because the pulls were elevated/partial"
      },
      {
        exercise: "Standing Calf Raise",
        weightLb: 1300,
        reps: 10,
        date: "1996-07-01",
        bodyweightLb: 260,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-dorian-yates/",
        note: "'up to 1300 pounds for 10-12 slow reps' on the standing calf machine; 10 logged"
      }
    ]
  },
  {
    id: "tom-platz",
    name: "Tom Platz",
    sex: "m",
    group: "legend",
    bodyweightLb: 230,
    bodyweightEstimated: true,
    peak: "c. 1978–1982 for training lifts; 1992 for his squat max",
    blurb: "1978 Mr. Universe bodybuilder nicknamed 'The Quadfather', famous for squatting 525 lb for 23 reps in the 1992 Great American Squat-Off.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 765,
        reps: 1,
        date: "1992-07-01",
        bodyweightLb: 230,
        bodyweightEstimated: true,
        reported: false,
        source: "https://barbend.com/how-strong-was-tom-platz/",
        note: "1RM at the 1992 Great American Squat-Off (FIBO, Essen), 'past his prime at the time' (Hatfield made 855). Also in Wikipedia. Only record for Quads with 1–12 reps, so it's outside the main window. Exact date not known. Bodyweight: Wikipedia contest weight 225–235 lb"
      },
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 175,
        reps: 6,
        date: "1980-07-01",
        bodyweightLb: 230,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/how-strong-was-tom-platz/",
        note: "'He incline-pressed 175-pound dumbbells at one point for six reps'. Year not stated (placeholder date in his competitive era)"
      },
      {
        exercise: "Deadlift",
        weightLb: 600,
        reps: 4,
        date: "1980-07-01",
        bodyweightLb: 230,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/how-strong-was-tom-platz/",
        note: "'he could pull 600 pounds for up to four reps'. Year not stated (placeholder date)"
      }
    ]
  },
  {
    id: "eddie-hall",
    name: "Eddie Hall",
    sex: "m",
    group: "athlete",
    bodyweightLb: 434.3,
    bodyweightEstimated: true,
    peak: "2015–2017",
    blurb: "2017 World's Strongest Man and the first person to deadlift 500 kg (in a suit); now a YouTuber.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 1025.1,
        reps: 1,
        date: "2016-03-04",
        bodyweightLb: 434.3,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Eddie_Hall",
        note: "465 kg Rogue Elephant bar deadlift 'with figure 8 straps, without suit', 2016 Arnold Strongman Classic (Mar 4–6; exact day not confirmed), a world record at the time. The 500 kg (2016) was in a multi-ply suit, so it's excluded. Bodyweight: Giants Live gives his peak 197 kg in 2016"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 617.3,
        reps: 1,
        date: "2015-07-01",
        bodyweightLb: 434.3,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Eddie_Hall",
        note: "280 kg 'raw with elbow sleeves, touch and go', 2015 Eisenhart Challenge (held in July; exact day not known). Bodyweight: nearest stated figure, 197 kg (2016)"
      },
      {
        exercise: "Push Press",
        weightLb: 476.2,
        reps: 1,
        date: "2017-04-01",
        bodyweightLb: 434.3,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/2017_Europe%27s_Strongest_Man",
        note: "216 kg max axle press (world record) at 2017 Europe's Strongest Man, Leeds. Strongman axle allows leg drive, so it's logged as Push Press, not strict Overhead Press"
      },
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 220.5,
        reps: 7,
        date: "2016-07-01",
        bodyweightLb: 434.3,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.givemesport.com/88027547-eddie-hall-lifting-100kg-in-each-arm-is-absolutely-mental-to-watch/",
        note: "100 kg dumbbells (each) for 7 on a high incline at Strength Asylum gym (YouTube title 'EDDIE HALL 100kg DUMBBELL PRESS 7 Reps Strength Asylum Gym'). The article is a 2022 repost; the filming year isn't confirmed on any page opened (Strength Asylum era, placed in 2016)"
      },
      {
        exercise: "Back Squat",
        weightLb: 892.9,
        reps: 1,
        date: "2016-07-01",
        bodyweightLb: 434.3,
        bodyweightEstimated: true,
        reported: true,
        source: "https://en.wikipedia.org/wiki/Eddie_Hall",
        note: "Training PR 405 kg 'raw, beltless' (Wikipedia; Giants Live also lists squat 405 kg). Year not stated; placed in his peak window"
      }
    ]
  },
  {
    id: "brian-shaw",
    name: "Brian Shaw",
    sex: "m",
    group: "athlete",
    bodyweightLb: 430,
    bodyweightEstimated: true,
    peak: "2015–2019",
    blurb: "Four-time World's Strongest Man (2011, 2013, 2015, 2016), now retired from competition and running a big strength YouTube channel.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 1020.7,
        reps: 1,
        date: "2016-03-04",
        bodyweightLb: 430,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Brian_Shaw_(strongman)",
        note: "463 kg Rogue Elephant bar deadlift with straps, 2016 Arnold Strongman Classic (repeated 2019); raw, no suit. Exact day in the Mar 4–6 event not confirmed. Bodyweight: Giants Live lists 195 kg (430 lb)"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 530,
        reps: 2,
        date: "2017-07-01",
        bodyweightLb: 430,
        bodyweightEstimated: true,
        reported: true,
        source: "https://en.wikipedia.org/wiki/Brian_Shaw_(strongman)",
        note: "Training PR 530 lb (240.4 kg) x 2 (Giants Live also lists bench 240 kg). Year not stated; placeholder in the peak window"
      },
      {
        exercise: "Safety Bar Squat",
        weightLb: 903,
        reps: 3,
        date: "2017-07-01",
        bodyweightLb: 430,
        bodyweightEstimated: true,
        reported: true,
        source: "https://en.wikipedia.org/wiki/Brian_Shaw_(strongman)",
        note: "Training PR safety bar squat 'bottom-up' 409.6 kg x 3. Bottom-up start makes it harder than a normal safety bar squat. Year not stated"
      },
      {
        exercise: "Back Squat",
        weightLb: 903.9,
        reps: 1,
        date: "2017-07-01",
        bodyweightLb: 430,
        bodyweightEstimated: true,
        reported: true,
        source: "https://giants-live.com/athlete/brian-shaw/",
        note: "Training squat 410 kg (also Wikipedia). Year and gear not stated"
      },
      {
        exercise: "Push Press",
        weightLb: 440.9,
        reps: 2,
        date: "2014-03-01",
        bodyweightLb: 430,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Brian_Shaw_(strongman)",
        note: "Log lift 200 kg x 2, 2014 Arnold Strongman Classic. Outside the window but it's his only dated shoulder record (the 211 kg training log has no date). Log allows leg drive, hence Push Press"
      }
    ]
  },
  {
    id: "mitchell-hooper",
    name: "Mitchell Hooper",
    sex: "m",
    group: "athlete",
    bodyweightLb: 330,
    bodyweightEstimated: true,
    peak: "2023–2025",
    blurb: "Canadian strongman, 2023 World's Strongest Man and 2024 Strongest Man on Earth, with a large YouTube channel.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 991,
        reps: 1,
        date: "2025-02-28",
        bodyweightLb: 330,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Mitchell_Hooper",
        note: "Elephant bar deadlift 449.5 kg '(raw, straps)', 2025 Arnold Strongman Classic, first day (https://en.wikipedia.org/wiki/2025_Arnold_Strongman_Classic lists it as 450 kg). Bodyweight: Wikipedia gives 320–340 lb, not stated for the day"
      },
      {
        exercise: "Back Squat",
        weightLb: 864.7,
        reps: 1,
        date: "2024-07-01",
        bodyweightLb: 330,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/mitchell-hooper-392-2-kg-squat-pr/",
        note: "Training PR 392.2 kg, July 2024 (exact day not given), belt and knee wraps (wraps allowed under our raw rule)"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 463,
        reps: 3,
        date: "2023-07-12",
        bodyweightLb: 330,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/mitchell-hooper-bench-press-463-pounds-3-rep-pr/",
        note: "210 kg x 3 PR in prep for the 2023 Shaw Classic"
      },
      {
        exercise: "Push Press",
        weightLb: 480.6,
        reps: 1,
        date: "2024-07-01",
        bodyweightLb: 330,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Mitchell_Hooper",
        note: "Axle press world record 218 kg at 2024 Giants Live Strongman Classic (exact date not on the page opened). Leg drive allowed, hence Push Press"
      }
    ]
  },
  {
    id: "martins-licis",
    name: "Martins Licis",
    sex: "m",
    group: "athlete",
    bodyweightLb: 331,
    bodyweightEstimated: true,
    peak: "2018–2019",
    blurb: "Latvian-American strongman, 2019 World's Strongest Man, known for his YouTube training and old-time strongman lifts.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 806,
        reps: 7,
        date: "2018-07-01",
        bodyweightLb: 331,
        bodyweightEstimated: true,
        reported: true,
        source: "http://barbend.weebly.com/blog/watch-martins-licis-squat-705lb-for-6-as-he-trains-for-worlds-strongest-man",
        note: "7-rep set of 806 lb in training around April 2018 (mirror of a BarBend article whose original URL now 404s: https://barbend.com/martins-licis-worlds-strongest-man-training/). Equipment not stated. Bodyweight: Wikipedia gives 331–367 lb; low end used, not stated for the day"
      },
      {
        exercise: "Back Squat",
        weightLb: 705,
        reps: 6,
        date: "2018-07-01",
        bodyweightLb: 331,
        bodyweightEstimated: true,
        reported: true,
        source: "http://barbend.weebly.com/blog/watch-martins-licis-squat-705lb-for-6-as-he-trains-for-worlds-strongest-man",
        note: "705 x 6 filmed just before the 2018 Arnold Australia (March/April 2018; exact date not given). Same article: 565 x 10 with no belt or sleeves"
      },
      {
        exercise: "Push Press",
        weightLb: 440.9,
        reps: 1,
        date: "2018-05-06",
        bodyweightLb: 331,
        bodyweightEstimated: true,
        reported: false,
        source: "https://en.wikipedia.org/wiki/Martins_Licis",
        note: "Axle press 200 kg at 2018 World's Strongest Man (finals, Manila, Apr 28–May 6; exact day not confirmed). Leg drive allowed, hence Push Press. Equal to his 2022 Arnold log of 200 kg"
      }
    ]
  },
  {
    id: "tia-clair-toomey",
    name: "Tia-Clair Toomey",
    sex: "f",
    group: "athlete",
    bodyweightLb: 127.9,
    bodyweightEstimated: true,
    peak: "2020–2021",
    blurb: "Australian CrossFit athlete, six-time Fittest Woman on Earth (2017–2022) and 2016 Olympic weightlifter.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 335,
        reps: 1,
        date: "2020-10-23",
        bodyweightLb: 127.9,
        bodyweightEstimated: true,
        reported: false,
        source: "https://www.boxrox.com/canadian-jeffrey-adler-destroys-a-1244-lb-total-in-event-3-at-the-2020-crossfit-games-final/",
        note: "2020 CrossFit Games final, Event 3 CrossFit Total (335/140/415 = 890 lb). She matched 335 lb again in the 2025 Games 1RM Back Squat event (c3po.crossfit.com games/2025 leaderboard, event 5). Bodyweight 58 kg is the self-listed weight in her CrossFit Games entrant data (2020, 2021, 2025 leaderboards), not a weigh-in."
      },
      {
        exercise: "Overhead Press",
        weightLb: 140,
        reps: 1,
        date: "2020-10-23",
        bodyweightLb: 127.9,
        bodyweightEstimated: true,
        reported: false,
        source: "https://www.boxrox.com/canadian-jeffrey-adler-destroys-a-1244-lb-total-in-event-3-at-the-2020-crossfit-games-final/",
        note: "Strict (shoulder) press 1RM inside the 2020 Games CrossFit Total."
      },
      {
        exercise: "Deadlift",
        weightLb: 415,
        reps: 1,
        date: "2020-10-23",
        bodyweightLb: 127.9,
        bodyweightEstimated: true,
        reported: false,
        source: "https://www.boxrox.com/canadian-jeffrey-adler-destroys-a-1244-lb-total-in-event-3-at-the-2020-crossfit-games-final/",
        note: "Deadlift 1RM inside the 2020 Games CrossFit Total. Beats her 390 lb at the 2016 Games Ranch Deadlift Ladder and the 178 kg on her self-reported Games profile."
      },
      {
        exercise: "Front Squat",
        weightLb: 282,
        reps: 4,
        date: "2021-04-10",
        bodyweightLb: 127.9,
        bodyweightEstimated: true,
        reported: false,
        source: "https://c3po.crossfit.com/api/competitions/v2/competitions/quarterfinalsindividual/2021/leaderboards?division=2&sort=0&page=1",
        note: "2021 CrossFit Games Individual Quarterfinals Test 4 = 4-rep-max front squat (confirmed by the Games workout description and BarBend); her official score 282 lbs. Quarterfinals ran 8–12 Apr 2021, exact day not listed. Her true 1RM front squat was 313 lb at the 2020 Games (Stage 1 Event 2 '1RM Front Squat', games/2020 leaderboard); 282x4 estimates slightly higher, so it is kept as her best front squat."
      }
    ]
  },
  {
    id: "lauren-fisher",
    name: "Lauren Fisher",
    sex: "f",
    group: "athlete",
    bodyweightLb: 135,
    bodyweightEstimated: true,
    peak: "2016–2021",
    blurb: "American seven-time CrossFit Games competitor and junior national weightlifting champion who founded the Grown Strong fitness brand.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 300,
        reps: 1,
        date: "2021-07-01",
        bodyweightLb: 135,
        bodyweightEstimated: true,
        reported: true,
        source: "https://games.crossfit.com/athlete/19117",
        note: "Self-reported 'Back Squat 1RM' on her official CrossFit Games profile; the profile gives no date, so mid-2021 (her last individual season) is used. Bodyweight 135 lb is her self-listed weight in the 2021 Quarterfinals entrant data (she listed 140 lb in 2016–2018)."
      },
      {
        exercise: "Deadlift",
        weightLb: 380,
        reps: 1,
        date: "2021-07-01",
        bodyweightLb: 135,
        bodyweightEstimated: true,
        reported: true,
        source: "https://games.crossfit.com/athlete/19117",
        note: "Self-reported 'Deadlift 1RM' on her Games profile, undated. Her best verified competition deadlift is 370 lb at the 2016 Games Ranch Deadlift Ladder (games/2016 leaderboard, event 2)."
      },
      {
        exercise: "Front Squat",
        weightLb: 252,
        reps: 4,
        date: "2021-04-10",
        bodyweightLb: 135,
        bodyweightEstimated: true,
        reported: false,
        source: "https://c3po.crossfit.com/api/competitions/v2/competitions/quarterfinalsindividual/2021/leaderboards?division=2&sort=0&page=2",
        note: "2021 Individual Quarterfinals Test 4 (4-rep-max front squat), official score 252 lbs; she titled her own vlog '2021 Crossfit Games Quarterfinals 4RM FRONT SQUAT' (youtube.com/watch?v=TQ6-nPoz4RA, uploaded 2021-04-15). Exact day within 8–12 Apr not listed."
      },
      {
        exercise: "Overhead Press",
        weightLb: 115,
        reps: 1,
        date: "2021-02-06",
        bodyweightLb: 135,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/lauren-fisher-profile/",
        note: "Only Shoulders record found: 'Press: 115 lb' in Fitness Volt's profile (published 2021-02-06). It sits in a list (squat 290, deadlift 325) that looks copied from an older version of her Games profile, so it is probably from before the peak window; date is the article date, the lift itself is undated. Kept only because it is the sole Shoulders number."
      }
    ]
  },
  {
    id: "brooke-ence",
    name: "Brooke Ence",
    sex: "f",
    group: "athlete",
    bodyweightLb: 150,
    bodyweightEstimated: true,
    peak: "2015–2018",
    blurb: "American former CrossFit Games athlete, actress in Wonder Woman and fitness YouTuber.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 320,
        reps: 1,
        date: "2021-03-08",
        bodyweightLb: 150,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/brooke-ence-profile/",
        note: "Fitness Volt profile (published 2021-03-08) lists 'Back squat: 320 lbs / 145 kg' as a personal record; the lift itself is undated (almost certainly from her 2015–2018 competitive years), the date is the article's. Her official Games profile shows no benchmark lifts. Bodyweight 150 lb is her self-listed weight in the 2015 Games entrant data; she told Muscle & Health (2021) her competition weight was 152–155 lb."
      },
      {
        exercise: "Deadlift",
        weightLb: 365,
        reps: 1,
        date: "2021-03-08",
        bodyweightLb: 150,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/brooke-ence-profile/",
        note: "Same Fitness Volt profile: 'Deadlift: 365 lbs / 165 kg'. Undated; date is the article's."
      }
    ]
  },
  {
    id: "joan-macdonald",
    name: "Joan MacDonald",
    sex: "f",
    group: "creator",
    bodyweightLb: 130,
    bodyweightEstimated: true,
    peak: "2021–2023",
    blurb: "Canadian fitness influencer (@trainwithjoan) who started lifting at 70 and grew to nearly 2 million Instagram followers.",
    lifts: [
      {
        exercise: "Hip Thrust",
        weightLb: 275,
        reps: 1,
        date: "2021-01-01",
        bodyweightLb: 130,
        bodyweightEstimated: true,
        reported: true,
        source: "https://impactmagazine.ca/features/athletes-with-impact/theres-something-about-joan/",
        note: "IMPACT Magazine Jan–Feb 2021 issue: hip thrusts 275 lb, age 75. Reps not stated; recorded as a single. The later Zoomer profile (2023-12-04) says 245 lb and her viral 2018 video was 200 lb. Bodyweight: no number is stated for this period; articles say she started at 198 lb and has lost about 68 lb (People 2022, BoxLife 2026), so ~130 lb is derived, not stated."
      },
      {
        exercise: "Deadlift",
        weightLb: 175,
        reps: 1,
        date: "2023-12-04",
        bodyweightLb: 130,
        bodyweightEstimated: true,
        reported: true,
        source: "https://zoomer.com/health/2023/12/04/flex-meet-fitfluencer-joan-macdonald-the-poster-girl-for-late-in-life-transformation",
        note: "Zoomer: 'bench pressing 90 pounds, box squatting 125 pounds, deadlifting 175 pounds and hip thrusting 245 pounds'; the AOL headline says she 'can max out a 175-pound deadlift'. Also 175 lb in IMPACT (2021). Reps not given; recorded as a single."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 90,
        reps: 1,
        date: "2023-12-04",
        bodyweightLb: 130,
        bodyweightEstimated: true,
        reported: true,
        source: "https://zoomer.com/health/2023/12/04/flex-meet-fitfluencer-joan-macdonald-the-poster-girl-for-late-in-life-transformation",
        note: "Stated as a lift she does, reps not given; recorded as a single."
      },
      {
        exercise: "Box Squat",
        weightLb: 125,
        reps: 1,
        date: "2023-12-04",
        bodyweightLb: 130,
        bodyweightEstimated: true,
        reported: true,
        source: "https://zoomer.com/health/2023/12/04/flex-meet-fitfluencer-joan-macdonald-the-poster-girl-for-late-in-life-transformation",
        note: "Stated box squat 125 lb, reps not given; recorded as a single."
      }
    ]
  },
  {
    id: "stephanie-buttermore",
    name: "Stephanie Buttermore",
    sex: "f",
    group: "creator",
    bodyweightLb: 147,
    bodyweightEstimated: true,
    peak: "2018–2020",
    blurb: "Fitness YouTuber and PhD cancer researcher best known for her 'All In' weight-gain series.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 185,
        reps: 6,
        date: "2020-02-15",
        bodyweightLb: 147,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=eouFi46IpN0&t=350s",
        note: "Her own video 'All In Update: I Had To Get Surgery...' (uploaded 2020-02-15), transcript: 'I was getting up to 185 pounds for six on the squat for six reps and then getting up to 205 pounds on my deadlift for five reps' (before surgery). Bodyweight is NOT stated in this period: she weighed 117 lb in a Dec 2018 DEXA video and said she was 'thirty pounds up from my starting weight' in Aug 2019, so ~147 lb is derived; treat it as rough."
      },
      {
        exercise: "Deadlift",
        weightLb: 205,
        reps: 5,
        date: "2020-02-15",
        bodyweightLb: 147,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=eouFi46IpN0&t=350s",
        note: "Same video: '205 pounds on my deadlift for five reps'."
      },
      {
        exercise: "Stiff-Leg Deadlift",
        weightLb: 135,
        reps: 4,
        date: "2018-08-07",
        bodyweightLb: 125,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=i7CD5uTDlUg&t=370s",
        note: "Her video 'How I'm Building Lean Legs' (2018-08-07): 'barbell stiff leg deadlift ... my working weight of 135 pounds ... four working sets of only four reps'. Bodyweight: she said 'I'm 5'4\" and 125 lb' in a video uploaded 2018-04-01 (ak1V51zX6YE)."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 85,
        reps: 4,
        date: "2017-02-09",
        bodyweightLb: 122,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=8NJZw8cJhBE&t=145s",
        note: "Only Chest record, from before the peak window: 'Showing Off My Lab | Bench Pressing with Jeff' (2017-02-09): 'my bench is ... 85 lb for four'; she then did working sets of 85 lb x 3. Bodyweight: nearest stated is 122 lb on camera (2017-10-31 video FcgNSj7ZIV8)."
      },
      {
        exercise: "Lateral Raise",
        weightLb: 15,
        reps: 10,
        date: "2017-02-09",
        bodyweightLb: 122,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=8NJZw8cJhBE&t=322s",
        note: "Only Shoulders record, before the peak window: 'lateral raises ... 10 to 12 reps starting with a 10 or 12 lb dumbbell and finish off with 15 lbs while taking that set to failure' — recorded at the low end, 10 reps."
      }
    ]
  }
];
