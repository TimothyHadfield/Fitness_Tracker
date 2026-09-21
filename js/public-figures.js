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
   citation. ⚠️ A real person's numbers: correct one only against a source.
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
    bodyWeights.push({ date: l.date, weight: fig.bodyweightLb });
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
    blurb: "Canadian science-based training YouTuber; former drug-tested CPU raw powerlifter (2nd, 74 kg, 2014 Canadian Nationals).",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 501.6,
        reps: 1,
        date: "2014-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jeffnippard"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 352.7,
        reps: 1,
        date: "2015-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jeffnippard"
      },
      {
        exercise: "Deadlift",
        weightLb: 518.1,
        reps: 1,
        date: "2014-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jeffnippard"
      }
    ]
  },
  {
    id: "mike-israetel",
    name: "Mike Israetel",
    sex: "m",
    group: "creator",
    bodyweightLb: 218,
    bodyweightEstimated: false,
    blurb: "Co-founder of Renaissance Periodization and host of the RP Strength YouTube channel; competed as a raw powerlifter in the 2000s.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 470,
        reps: 1,
        date: "2008-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/mikeisraetel"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 345,
        reps: 1,
        date: "2008-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/mikeisraetel"
      },
      {
        exercise: "Deadlift",
        weightLb: 500,
        reps: 1,
        date: "2008-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/mikeisraetel"
      }
    ]
  },
  {
    id: "greg-doucette",
    name: "Greg Doucette",
    sex: "m",
    group: "creator",
    bodyweightLb: 197.8,
    bodyweightEstimated: false,
    blurb: "Canadian IFBB pro bodybuilder, coach and very popular fitness YouTuber; long career as a competitive powerlifter.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 529.1,
        reps: 1,
        date: "2017-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/gregdoucette"
      },
      {
        exercise: "Back Squat",
        weightLb: 573.2,
        reps: 1,
        date: "2013-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/gregdoucette"
      },
      {
        exercise: "Deadlift",
        weightLb: 677.9,
        reps: 1,
        date: "2010-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/gregdoucette"
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
    blurb: "Canadian fitness YouTuber known for challenge videos; entered a drug-tested USAPL powerlifting meet in 2023.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 496,
        reps: 1,
        date: "2023-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/m/usapl/VA-2023-06"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 352.7,
        reps: 1,
        date: "2023-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/m/usapl/VA-2023-06"
      },
      {
        exercise: "Deadlift",
        weightLb: 529.1,
        reps: 1,
        date: "2023-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/m/usapl/VA-2023-06"
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
    blurb: "American fitness YouTuber and natural bodybuilder; filmed his first powerlifting meet in December 2022.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 451.9,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessewest"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 336.2,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessewest"
      },
      {
        exercise: "Deadlift",
        weightLb: 490.5,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessewest"
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
    blurb: "Strength coach and YouTuber (Untamed Strength); raw powerlifter and strongman competitor.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 534.6,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/alanthrall"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 341.7,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/alanthrall"
      },
      {
        exercise: "Deadlift",
        weightLb: 584.2,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/alanthrall"
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
    blurb: "Six-time Mr. Olympia Classic Physique champion (2019-2024) and one of the largest bodybuilding YouTubers.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 675,
        reps: 3,
        date: "2021-07-01",
        reported: false,
        source: "https://barbend.com/news/bodybuilder-chris-bumstead-675-pound-deadlift-triple/"
      },
      {
        exercise: "Hack Squat",
        weightLb: 540,
        reps: 6,
        date: "2023-07-01",
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-workout-2023-olympia-offseason/"
      },
      {
        exercise: "Leg Press",
        weightLb: 810,
        reps: 10,
        date: "2023-07-01",
        reported: true,
        source: "https://breakingmuscle.com/chris-bumstead-leg-workout-2023-olympia-offseason/"
      },
      {
        exercise: "Incline Dumbbell Bench Press",
        weightLb: 150,
        reps: 11,
        date: "2024-07-01",
        reported: false,
        source: "https://barbend.com/news/chris-bumstead-150-pound-incline-dumbbell-bench-press/"
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
    blurb: "American fitness YouTuber and gym owner (Zoo Culture), known for strength challenges.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 405,
        reps: 2,
        date: "2025-07-01",
        reported: true,
        source: "https://fitnessvolt.com/bradley-martyn-and-andrew-tate-bench-press-challenge/"
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
    blurb: "American raw powerlifter, one of the strongest pound-for-pound lifters of the 2020s in the 90-100 kg classes.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 804.7,
        reps: 1,
        date: "2024-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/johnhaack"
      },
      {
        exercise: "Deadlift",
        weightLb: 939.2,
        reps: 1,
        date: "2024-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/johnhaack"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 600.8,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/johnhaack"
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
    blurb: "American super-heavyweight raw powerlifter; squatted 490 kg raw in competition in 2019.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 1080.3,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/raywilliams1"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 545.6,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/raywilliams1"
      },
      {
        exercise: "Deadlift",
        weightLb: 878.5,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/raywilliams1"
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
    blurb: "American IPF 74 kg classic world champion and powerlifting coach.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 668,
        reps: 1,
        date: "2021-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/tayloratwood"
      },
      {
        exercise: "Deadlift",
        weightLb: 750.7,
        reps: 1,
        date: "2021-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/tayloratwood"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 446.4,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/tayloratwood"
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
    blurb: "American IPF super-heavyweight classic powerlifter and multiple-time world champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 1036.2,
        reps: 1,
        date: "2023-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jesusolivares"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 600.8,
        reps: 1,
        date: "2023-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jesusolivares"
      },
      {
        exercise: "Deadlift",
        weightLb: 903.9,
        reps: 1,
        date: "2023-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jesusolivares"
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
    blurb: "American powerlifter and strength influencer (real name Larry Williams), known for elite raw totals and heavy pressing.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 870,
        reps: 1,
        date: "2020-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/larrywilliams1"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 645,
        reps: 1,
        date: "2020-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/larrywilliams1"
      },
      {
        exercise: "Deadlift",
        weightLb: 881.8,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/larrywilliams1"
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
    blurb: "American bench press specialist; benched 355 kg raw in competition in 2021.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 782.6,
        reps: 1,
        date: "2021-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/juliusmaddox"
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
    blurb: "Icelandic strongman, 2018 World's Strongest Man, who has also competed in full powerlifting meets.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 970,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/hafthorjuliusbjornsson"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 551.2,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/hafthorjuliusbjornsson"
      },
      {
        exercise: "Deadlift",
        weightLb: 903.9,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/hafthorjuliusbjornsson"
      }
    ]
  },
  {
    id: "ed-coan",
    name: "Ed Coan",
    sex: "m",
    group: "legend",
    bodyweightLb: 242.5,
    bodyweightEstimated: true,
    blurb: "American powerlifter often called the greatest of all time; his famous records (e.g. the 901 lb deadlift) were set in single-ply gear and are excluded here.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 760.6,
        reps: 1,
        date: "2003-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/edcoan"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 501.6,
        reps: 1,
        date: "2003-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/edcoan"
      },
      {
        exercise: "Deadlift",
        weightLb: 705.5,
        reps: 1,
        date: "2003-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/edcoan"
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
    blurb: "Eight-time Mr. Olympia (1998-2005) who also competed in raw deadlift meets in the early 1990s.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 727.5,
        reps: 1,
        date: "1994-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/ronniecoleman"
      },
      {
        exercise: "Deadlift",
        weightLb: 800,
        reps: 2,
        date: "2000-07-01",
        reported: true,
        source: "https://barbend.com/how-strong-was-ronnie-coleman/"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 495,
        reps: 5,
        date: "2003-07-01",
        reported: true,
        source: "https://barbend.com/how-strong-was-ronnie-coleman/"
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
    blurb: "Seven-time Mr. Olympia who won the 1968 German powerlifting championship (heavyweight) at age 20.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 474,
        reps: 1,
        date: "1968-07-01",
        reported: true,
        source: "https://www.castironstrength.com/arnolds-powerlifting-history/"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 440.9,
        reps: 1,
        date: "1968-07-01",
        reported: true,
        source: "https://www.castironstrength.com/arnolds-powerlifting-history/"
      },
      {
        exercise: "Deadlift",
        weightLb: 683.4,
        reps: 1,
        date: "1968-07-01",
        reported: true,
        source: "https://www.castironstrength.com/arnolds-powerlifting-history/"
      },
      {
        exercise: "Overhead Press",
        weightLb: 264.6,
        reps: 1,
        date: "1967-07-01",
        reported: true,
        source: "https://barbend.com/news/how-strong-was-arnold-schwarzenegger/"
      }
    ]
  },
  {
    id: "franco-columbu",
    name: "Franco Columbu",
    sex: "m",
    group: "legend",
    bodyweightLb: 165,
    bodyweightEstimated: true,
    blurb: "Two-time Mr. Olympia (1976, 1981) from Sardinia and a competitive powerlifter.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 507.1,
        reps: 1,
        date: "1968-07-01",
        reported: true,
        source: "https://thebarbell.com/how-strong-was-franco-columbu/"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 407.9,
        reps: 1,
        date: "1968-07-01",
        reported: true,
        source: "https://thebarbell.com/how-strong-was-franco-columbu/"
      },
      {
        exercise: "Deadlift",
        weightLb: 595.2,
        reps: 1,
        date: "1968-07-01",
        reported: true,
        source: "https://thebarbell.com/how-strong-was-franco-columbu/"
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
    blurb: "Venezuelan-American powerlifter, physical therapist and YouTuber; held 25 world records and was the first woman to deadlift over 4x bodyweight.",
    lifts: [
      {
        exercise: "Deadlift",
        weightLb: 529.1,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/stefaniecohen"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 242.5,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/stefaniecohen"
      },
      {
        exercise: "Back Squat",
        weightLb: 418.9,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/stefaniecohen"
      }
    ]
  },
  {
    id: "heather-connor",
    name: "Heather Connor",
    sex: "f",
    group: "athlete",
    bodyweightLb: 103.3,
    bodyweightEstimated: false,
    blurb: "American IPF powerlifter in the 47 kg class; multiple-time world classic champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 325.2,
        reps: 1,
        date: "2025-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/heatherconnor"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 165.3,
        reps: 1,
        date: "2025-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/heatherconnor"
      },
      {
        exercise: "Deadlift",
        weightLb: 468.5,
        reps: 1,
        date: "2025-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/heatherconnor"
      }
    ]
  },
  {
    id: "jessica-buettner",
    name: "Jessica Buettner",
    sex: "f",
    group: "athlete",
    bodyweightLb: 165.9,
    bodyweightEstimated: false,
    blurb: "Canadian IPF powerlifter; world classic champion in the 76 kg class, known for a 261.5 kg deadlift.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 481.7,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessicabuettner"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 231.5,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessicabuettner"
      },
      {
        exercise: "Deadlift",
        weightLb: 576.5,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jessicabuettner"
      }
    ]
  },
  {
    id: "amanda-lawrence",
    name: "Amanda Lawrence",
    sex: "f",
    group: "athlete",
    bodyweightLb: 183.2,
    bodyweightEstimated: false,
    blurb: "American IPF powerlifter in the 84 kg class; multiple-time world classic champion.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 545.6,
        reps: 1,
        date: "2024-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/amandalawrence1"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 297.6,
        reps: 1,
        date: "2024-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/amandalawrence1"
      },
      {
        exercise: "Deadlift",
        weightLb: 573.2,
        reps: 1,
        date: "2024-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/amandalawrence1"
      }
    ]
  },
  {
    id: "marianna-gasparyan",
    name: "Marianna Gasparyan",
    sex: "f",
    group: "athlete",
    bodyweightLb: 127.2,
    bodyweightEstimated: false,
    blurb: "Russian-Armenian powerlifter known for an unusually strong squat and bench at around 56-60 kg.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 507.1,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/mariannagasparyan"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 292.1,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/mariannagasparyan"
      },
      {
        exercise: "Deadlift",
        weightLb: 479.5,
        reps: 1,
        date: "2019-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/mariannagasparyan"
      }
    ]
  },
  {
    id: "jen-thompson",
    name: "Jen Thompson",
    sex: "f",
    group: "athlete",
    bodyweightLb: 148.9,
    bodyweightEstimated: false,
    blurb: "American powerlifter and one of the best female bench pressers ever; still competing as a master.",
    lifts: [
      {
        exercise: "Barbell Bench Press",
        weightLb: 327.4,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jenniferthompson1"
      },
      {
        exercise: "Back Squat",
        weightLb: 352.7,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jenniferthompson1"
      },
      {
        exercise: "Deadlift",
        weightLb: 446.4,
        reps: 1,
        date: "2022-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/jenniferthompson1"
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
    blurb: "Fitness YouTuber and coach behind Meg Squats / Strong Strong Friends; competed at USAPL Raw Nationals 2014-2018.",
    lifts: [
      {
        exercise: "Back Squat",
        weightLb: 308.6,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/megangallagher"
      },
      {
        exercise: "Barbell Bench Press",
        weightLb: 170.9,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/megangallagher"
      },
      {
        exercise: "Deadlift",
        weightLb: 407.9,
        reps: 1,
        date: "2018-07-01",
        reported: false,
        source: "https://www.openpowerlifting.org/u/megangallagher"
      }
    ]
  }
];
