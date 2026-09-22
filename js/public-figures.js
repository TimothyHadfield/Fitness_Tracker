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
    bodyweightLb: 161.2,
    bodyweightEstimated: false,
    peak: "March 2014 – May 2015, CPU raw 74 kg class",
    blurb: "Canadian science-based training YouTuber; former drug-tested CPU raw powerlifter (2nd, 74 kg, 2014 Canadian Nationals).",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 501.6,
        reps: 1,
        date: "2014-03-31",
        bodyweightLb: 161.2,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jeffnippard",
        note: "227.5 kg, CPU Canadian Championship (St. Catharines), Raw, weigh-in 73.1 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 352.7,
        reps: 1,
        date: "2015-05-23",
        bodyweightLb: 162.3,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jeffnippard",
        note: "160 kg, CPU Nova Scotia Provincial Championship, Raw, weigh-in 73.6 kg (he also benched 160 kg on 2015-07-13 at 70.3 kg)"
      },
      {
        exercise: "Deadlift",
        weightLb: 518.1,
        reps: 1,
        date: "2014-03-31",
        bodyweightLb: 161.2,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jeffnippard",
        note: "235 kg, CPU Canadian Championship, Raw, weigh-in 73.1 kg"
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
    peak: "Aug 2010 – Dec 2013, 240–269 lb (ETSU PhD / early RP years)",
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
        note: "Own video 'Squat: 255kg (562lbs) 2 Reps': low bar, 'Bodyweight 269'. Date is the upload date"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 365,
        reps: 8,
        date: "2011-01-18",
        bodyweightLb: 254,
        reported: true,
        source: "https://www.youtube.com/watch?v=7gHwEiy46LA",
        note: "Own video 'Bench Press 365 lbs for 8 Reps': 'Slight arch, no retraction. Bodyweight 254 in the AM.' Thumbnail checked: flat bench"
      },
      {
        exercise: "Incline Barbell Bench Press",
        weightLb: 335,
        reps: 10,
        date: "2013-10-11",
        bodyweightLb: 245,
        reported: true,
        source: "https://www.youtube.com/watch?v=bKWX5ivOvNo",
        note: "Own video: '335lbs for 10 paused reps in the Incline Bench Press with a medium/narrow grip. Bodyweight in video is 245lbs.'"
      },
      {
        exercise: "Overhead Press",
        weightLb: 275,
        reps: 8,
        date: "2013-12-18",
        bodyweightLb: 241,
        reported: true,
        source: "https://www.youtube.com/watch?v=pT4Ebx2ra1A",
        note: "Own video 'Should[er] Press 275lbs for 8 Reps', 'Done at a bodyweight of 241lbs.' Thumbnail caption reads 'Standing Press: 275lbs 8 Reps'. (He also did 275x7 at 269 lb on 2011-03-31, video WJUdo9SUIcw)"
      },
      {
        exercise: "Deadlift",
        weightLb: 551.2,
        reps: 5,
        date: "2011-01-24",
        bodyweightLb: 258,
        reported: true,
        source: "https://www.youtube.com/watch?v=GGIdWBWPTKg",
        note: "Own video 'Deficit Deadlift 250kg for 5 Reps (550lbs)': 'Pull from 2 inch platform. Bodyweight 258 in the AM.' A deficit pull is harder than a floor pull, so this underrates him a little"
      },
      {
        exercise: "Barbell Row",
        weightLb: 350,
        reps: 8,
        date: "2013-10-11",
        bodyweightLb: 246,
        reported: true,
        source: "https://www.youtube.com/watch?v=HkEo5Thds10",
        note: "Own video: 'Strict Barbell Bent Row, 350lbs for 8 reps. Done at a bodyweight of 246.'"
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
        weightLb: 185,
        reps: 10,
        date: "2010-08-10",
        bodyweightLb: 256,
        reported: true,
        source: "https://www.youtube.com/watch?v=UStO2o0Q0sg",
        note: "Own video: 'JM style skull crusher, done at bodyweight of 256'"
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
    peak: "Sep 2010 – Jan 2011, raw 90 kg class",
    blurb: "Canadian IFBB pro bodybuilder, coach and very popular fitness YouTuber; long career as a competitive powerlifter.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 562.2,
        reps: 1,
        date: "2010-09-03",
        bodyweightLb: 198.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/gregdoucette",
        note: "255 kg, WPC Raw World Championships (Idaho Falls), Equipment Raw, weigh-in 90 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 523.6,
        reps: 1,
        date: "2011-01-22",
        bodyweightLb: 196.9,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/gregdoucette",
        note: "237.5 kg, Raw Unity IV (Tampa), Raw, weigh-in 89.3 kg (228.5 kg at the 2010 Raw Worlds)"
      },
      {
        exercise: "Deadlift",
        weightLb: 677.9,
        reps: 1,
        date: "2010-09-03",
        bodyweightLb: 198.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/gregdoucette",
        note: "307.5 kg, WPC Raw World Championships, Raw, weigh-in 90 kg (4th attempt 332.5 missed)"
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
    peak: "Spring 2023, USAPL raw 90 kg",
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
        note: "160 kg, USAPL Virginia Shamrock Showdown"
      },
      {
        exercise: "Deadlift",
        weightLb: 529.1,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 198,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/willtennyson",
        note: "240 kg, USAPL Virginia Shamrock Showdown"
      },
      {
        exercise: "Overhead Press",
        weightLb: 245,
        reps: 1,
        date: "2023-07-01",
        bodyweightLb: 198,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.aol.com/bodybuilder-got-ass-kicked-worlds-133000340.html",
        note: "Men's Health (via AOL, 2023-06-04): 'starts out at 185 pounds, then 225, which is his current strict press PR, before setting a new best with 245 pounds'. From his video with Mitchell Hooper (after his April 2023 WSM win), so the real date is ~May 2023. Bodyweight not stated; meet weight used"
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
        note: "205 kg, USPA PWRBLD Winter War (King of Prussia), Raw, weigh-in 82 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 336.2,
        reps: 1,
        date: "2022-12-10",
        bodyweightLb: 180.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jessewest",
        note: "152.5 kg meet bench (155 missed), USPA PWRBLD Winter War"
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
        note: "Own post '405 bench press pr!' with video, linking his YouTube 'FIRST TIME BENCHING 405! *MASSIVE PR*' (youtu.be/3OQtdedVxjI). Gym lift, not meet-judged (his meet bench 17 months later was 336). Bodyweight not stated; used his Dec 2022 weigh-in"
      },
      {
        exercise: "Deadlift",
        weightLb: 490.5,
        reps: 1,
        date: "2022-12-10",
        bodyweightLb: 180.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jessewest",
        note: "222.5 kg, USPA PWRBLD Winter War"
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
    peak: "April – May 2018, ~242 lb (USPA raw 110 kg)",
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
        note: "242.5 kg, USPA Old Skool Iron Classic (Vacaville), Raw, weigh-in 109.65 kg"
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
        note: "Own video 'Squat: 500 lbs x 5 reps', three weeks before the meet; bodyweight taken from the meet weigh-in"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 341.7,
        reps: 1,
        date: "2018-05-19",
        bodyweightLb: 241.7,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/alanthrall",
        note: "155 kg, USPA Old Skool Iron Classic"
      },
      {
        exercise: "Deadlift",
        weightLb: 584.2,
        reps: 1,
        date: "2018-05-19",
        bodyweightLb: 241.7,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/alanthrall",
        note: "265 kg, USPA Old Skool Iron Classic"
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
        note: "Own video '600 lbs. Deadlift' ('Alan Thrall deadlifts 600 lbs / 272.5 kg'), five weeks before the meet; bodyweight taken from the meet weigh-in"
      }
    ]
  },
  {
    id: "chris-bumstead",
    name: "Chris Bumstead",
    sex: "m",
    group: "creator",
    bodyweightLb: 255,
    bodyweightEstimated: true,
    peak: "2021 – 2024 offseasons and preps (his Olympia title run); heaviest documented strength in 2021–22 at ~255–259 lb",
    blurb: "Six-time Mr. Olympia Classic Physique champion (2019-2024) and one of the largest bodybuilding YouTubers.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 675,
        reps: 3,
        date: "2021-07-01",
        bodyweightLb: 255,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/bodybuilder-chris-bumstead-675-pound-deadlift-triple/",
        note: "Instagram PR triple ~15 weeks before the Oct 2021 Olympia: 'One more on the PR. 7 plates (675lbs) for 3 reps'. Straps, no belt. Offseason bodyweight not stated"
      },
      {
        exercise: "Back Squat",
        weightLb: 585,
        reps: 6,
        date: "2022-04-06",
        bodyweightLb: 255,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/chris-bumstead-massive-squat-training/",
        note: "Instagram training clip, six plates a side for 6 (also covered by Generation Iron). Bodyweight not stated; he weighed 259 in July 2022"
      },
      {
        exercise: "Seated Dumbbell Shoulder Press",
        weightLb: 140,
        reps: 8,
        date: "2022-07-20",
        bodyweightLb: 259,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-140-pound-dumbbell-press-for-8-reps/",
        note: "140 lb dumbbells (each) for 8, a PR, 'seated and on a slight incline'. '259 pounds the morning he filmed the video'"
      },
      {
        exercise: "Hack Squat",
        weightLb: 540,
        reps: 6,
        date: "2023-06-16",
        bodyweightLb: 250,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-workout-2023-olympia-offseason/",
        note: "Early 2023 offseason video 'This Leg Day Really Sucked'. Bodyweight not stated"
      },
      {
        exercise: "Leg Press",
        weightLb: 810,
        reps: 10,
        date: "2023-06-16",
        bodyweightLb: 250,
        bodyweightEstimated: true,
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-workout-2023-olympia-offseason/",
        note: "Same session as the hack squat"
      },
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 150,
        reps: 11,
        date: "2024-08-20",
        bodyweightLb: 240,
        bodyweightEstimated: true,
        reported: true,
        source: "https://barbend.com/news/chris-bumstead-150-pound-incline-dumbbell-bench-press/",
        note: "150 lb dumbbells (each) for 11, about 2 months before the 2024 Olympia, mid-prep. Bodyweight not stated"
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
    peak: "No clear single peak: best sourced sets are 2015 (deadlift) and March 2025 (bench), ~250–260 lb",
    blurb: "American fitness YouTuber and gym owner (Zoo Culture), known for strength challenges.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 405,
        reps: 2,
        date: "2025-03-12",
        bodyweightLb: 260,
        reported: true,
        source: "https://fitnessvolt.com/bradley-martyn-and-andrew-tate-bench-press-challenge/",
        note: "Bench challenge with Andrew Tate; the same session had 315x11 and 225x8. Article states 260 lb"
      },
      {
        exercise: "Deadlift",
        weightLb: 545,
        reps: 10,
        date: "2015-11-09",
        bodyweightLb: 250,
        bodyweightEstimated: true,
        reported: true,
        source: "https://www.youtube.com/watch?v=fT5L8sKGljE",
        note: "Own video '545 for 10 deadlift | Bradley Martyn' (upload date). Bodyweight not stated; 250 is the middle of his usual 240–260 lb range"
      }
    ]
  },
  {
    id: "john-haack",
    name: "John Haack",
    sex: "m",
    group: "athlete",
    bodyweightLb: 206,
    bodyweightEstimated: false,
    peak: "2022-09 to 2024-04, 90-100 kg classes (meets at 93-96 kg)",
    blurb: "American raw powerlifter, one of the strongest pound-for-pound lifters of the 2020s in the 90-100 kg classes.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 804.7,
        reps: 1,
        date: "2024-04-06",
        bodyweightLb: 206,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/johnhaack",
        note: "365 kg, WRPF The Ghost Clash 3, raw, BW 93.45 kg"
      },
      {
        exercise: "Deadlift",
        weightLb: 939.2,
        reps: 1,
        date: "2024-04-06",
        bodyweightLb: 206,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/johnhaack",
        note: "426 kg, WRPF The Ghost Clash 3, raw, BW 93.45 kg; lifetime best meet deadlift"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 600.8,
        reps: 1,
        date: "2022-09-24",
        bodyweightLb: 210.8,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/johnhaack",
        note: "272.5 kg, USPA Pro Raw Championships, raw, BW 95.6 kg; lifetime best meet bench"
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
    peak: "2018-03 to 2019-03, IPF/USAPL +120 kg classic (BW ~187-190 kg)",
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
    bodyweightLb: 162.3,
    bodyweightEstimated: false,
    peak: "2021-06 to 2022-04, 74 kg classic (BW ~73.6 kg)",
    blurb: "American IPF 74 kg classic world champion and powerlifting coach.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 668,
        reps: 1,
        date: "2021-06-14",
        bodyweightLb: 162.3,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/tayloratwood",
        note: "303 kg, USAPL Raw Nationals, raw, BW 73.63 kg"
      },
      {
        exercise: "Deadlift",
        weightLb: 750.7,
        reps: 1,
        date: "2021-06-14",
        bodyweightLb: 162.3,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/tayloratwood",
        note: "340.5 kg, same meet"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 446.4,
        reps: 1,
        date: "2022-04-01",
        bodyweightLb: 162.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/tayloratwood",
        note: "202.5 kg, AMP Classic Open Nationals, raw, BW 73.72 kg; best bench at 74 kg"
      }
    ]
  },
  {
    id: "jesus-olivares",
    name: "Jesus Olivares",
    sex: "m",
    group: "athlete",
    bodyweightLb: 392.9,
    bodyweightEstimated: false,
    peak: "2023-03, IPF +120 kg classic (SBD Sheffield, BW 178.2 kg)",
    blurb: "American IPF super-heavyweight classic powerlifter and multiple-time world champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 1036.2,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 392.9,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jesusolivares",
        note: "470 kg, IPF SBD Sheffield Powerlifting Championships, raw, BW 178.2 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 600.8,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 392.9,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jesusolivares",
        note: "272.5 kg, same meet (also matched at Sheffield 2025); lifetime best meet bench"
      },
      {
        exercise: "Deadlift",
        weightLb: 903.9,
        reps: 1,
        date: "2023-03-25",
        bodyweightLb: 392.9,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/jesusolivares",
        note: "410 kg, same meet"
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
    peak: "2018-05 to 2020-03, raw powerlifting at ~123-129 kg",
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
        note: "394.63 kg (870 lb), XPC Arnold Pro Raw, BW 128.64 kg"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 645,
        reps: 1,
        date: "2020-03-07",
        bodyweightLb: 283.6,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/larrywilliams1",
        note: "292.57 kg (645 lb), same meet; lifetime best meet bench"
      },
      {
        exercise: "Deadlift",
        weightLb: 881.8,
        reps: 1,
        date: "2018-05-12",
        bodyweightLb: 276.5,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/larrywilliams1",
        note: "400 kg, USPA Kern US Open, raw, BW 125.4 kg"
      },
      {
        exercise: "Overhead Press",
        weightLb: 440,
        reps: 1,
        date: "2018-09-02",
        bodyweightLb: 276.5,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/27636/the-mountain-440lbs-overhead/",
        note: "Standing barbell press in the gym (Instagram video embedded in the article), 'matching Thor's overhead PR'; the article says he leans back a lot. Date = article date (lift was late Aug 2018). BW estimated from his May 2018 weigh-in; he was in bodybuilding prep."
      },
      {
        exercise: "Overhead Press",
        weightLb: 315,
        reps: 6,
        date: "2018-07-01",
        bodyweightLb: 276.5,
        bodyweightEstimated: true,
        reported: true,
        source: "https://generationiron.com/this-powerbuilder-shows-insane-strength-does-315-lbs-overhead-press-for-multiple-reps/",
        note: "His own Instagram caption quoted: '315x6 overhead press... Full ROM... training to fight the mountain august 27th' (2018; exact day unknown). BW estimated from May 2018 weigh-in."
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
    peak: "2019-11 to 2021-02, raw bench at ~201-203 kg",
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
    peak: "2018, the year he won World's Strongest Man, Arnold and Europe's Strongest Man (BW ~180-198 kg)",
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
        note: "440 kg, WRPF-Iceland Thor's Powerlifting Challenge, knee wraps (allowed), BW 197.5 kg. Checked in the CSV: S 440 / B 250 / D 410."
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 551.2,
        reps: 1,
        date: "2018-12-15",
        bodyweightLb: 435.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/hafthorjuliusbjornsson",
        note: "250 kg, same meet"
      },
      {
        exercise: "Deadlift",
        weightLb: 903.9,
        reps: 1,
        date: "2018-12-15",
        bodyweightLb: 435.4,
        reported: false,
        source: "https://www.openpowerlifting.org/api/liftercsv/hafthorjuliusbjornsson",
        note: "410 kg, same meet"
      },
      {
        exercise: "Overhead Press",
        weightLb: 440,
        reps: 1,
        date: "2018-09-02",
        bodyweightLb: 400,
        bodyweightEstimated: true,
        reported: true,
        source: "https://fitnessvolt.com/27636/the-mountain-440lbs-overhead/",
        note: "Standing barbell press from his Instagram video (instagram.com/p/BmwTkPfHpef), belt and wrist wraps, some hip drive but not a push press according to the article. Date = article date (Aug/Sep 2018). BW is the article's 'around 400 lbs'."
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
    peak: "1991, 100 kg (220 lb) class - 1991 USPF Senior Nationals, 2,405 lb total",
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
    peak: "2000-2003, Mr. Olympia years (training DVDs 'The Unbelievable' 2000 and 'The Cost of Redemption' 2003)",
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
        note: "'The Unbelievable' (2000) footage; machine hack squat, plate weight only."
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
        note: "'The Unbelievable' (2000); BarBend gives '~570 x 9' too."
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
        note: "'The Cost of Redemption' (2003), wide grip. Bodyweight estimated: 2003 Olympia stage weight was ~287-292 lb, filmed in prep."
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
        note: "'The Cost of Redemption' (2003), narrow stance. BarBend and thebarbell say 8 reps; fitnessvolt says 10, took the lower."
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
        exercise: "Dumbbell Curl",
        weightLb: 75,
        reps: 8,
        date: "2000-07-01",
        bodyweightLb: 275,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-ronnie-coleman/",
        note: "Standing alternate dumbbell curls, 75 lb each, 'on video'. Year NOT stated by the source."
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
    peak: "1968-1970, heavyweight (~240 lb): 1968 German Powerlifting Championships and c.1970 Gold's Gym training",
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
    peak: "1974 (Mr. Olympia under-200 class, 181 lb) for the deadlift; squat and bench kept from the 1968 German championship",
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
        exercise: "Back Squat",
        weightLb: 507.1,
        reps: 1,
        date: "1968-07-01",
        bodyweightLb: 160,
        bodyweightEstimated: true,
        reported: true,
        source: "https://thebarbell.com/how-strong-was-franco-columbu/",
        note: "KEPT FROM CURRENT DATA, before his peak: 1968 German Championships, middleweight, 230 kg, 'bodyweight ~160 lbs'. No sourced 1970s squat."
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
        note: "KEPT FROM CURRENT DATA, before his peak: 1968 German Championships, 185 kg. No sourced 1970s bench."
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
  }
];
