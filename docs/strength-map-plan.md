# Strength map — plan

*Drafted 2026-08-15 in response to Tim's spec: a human body with each muscle group coloured by how
strong it is relative to people of the same gender and weight; grey where nothing is recorded;
benchmarks only for now; click a muscle to see the weight needed for each level on a named lift.*

**Built 2026-08-15.** `js/strength-standards.js`, `js/body-map.js`, `js/views-muscles.js`. This
document is now the record of why it works the way it does. Phase 5 (incorporating workout lifts,
weighted secondary muscles) is still outstanding.

**Decided by Tim, 2026-08-15:**
- Levels are ranked against **people who lift and log**, with an **optional second readout** showing
  the equivalent percentile among the general population (§2.1).
- **Seven levels** — the five industry-standard anchors, plus one inserted into each of the two
  widest gaps. Lifter-based; the general-population view shows a percentile, not a re-tiering (§3).
- The map lives as a **third mode inside Data**, called **Muscle Groups**, beside **Graph** and
  **Bar Chart** (§7.1).

---

## 1. Read this first — two hard blockers

The feature cannot compute a single number without these, and neither exists today.

| Blocker | State | Why it blocks |
|---|---|---|
| **Body weight** | No table, no UI. Already the biggest Tier 1 gap. | Every strength standard is a ratio to body weight. Without it there is nothing to compare against. |
| **Gender** (and age, if used) | Not collected anywhere. | Standards differ by roughly 20–30 % between men and women at the same body weight. |

So the real order is: **body-weight tracking → a small profile (gender, birth year, optional) → strength
map.** Body-weight tracking was already next on the Tier 1 list, so this is not a detour — but it does
mean the map is two features away, not one.

---

## 2. The honesty problem, and it is the big one

"Stronger than 80 % of people your weight" is almost certainly **false** as usually written, and the
difference matters.

There are three possible reference populations, and they give wildly different answers:

| Population | Where the data comes from | Problem |
|---|---|---|
| **Everyone** | Doesn't really exist for barbell lifts | Most adults have never done a squat. A 315 lb squat is ~99.9th percentile of humans. Every user would be "Elite", which is worthless. |
| **People who lift and log** | Strength Level (153 M lifts, 13 M lifters), Gravitus (10 M workouts, 300 k lifters) | Self-reported, self-selected — but this is the group a user actually wants to be compared to. |
| **Competitors** | Barbell Medicine's 809,986 drug-tested competition entries, OpenPowerlifting | Barbell Medicine states plainly that the general population sits **well below the 50th percentile** of this set. Using it makes everyone look weak. |

**Recommendation: compare against people who lift and log, and say so in the interface.** The label
should read *"stronger than 80 % of people who lift"*, never *"of people"*. It is the difference
between a number that is true and a number that flatters — and D8 says teach at the moment of use,
which means the caption carries the meaning.

This also sets expectations correctly: a beginner is *supposed* to start near the bottom of a scale
made of people who already train.

### 2.1 The general-population readout

Tim asked for a second, optional view: what percentile that same lift would be **among everyone**,
not just people who lift.

There is no dataset of "what fraction of all adults can bench 225" — nobody has measured it. But it
can be approximated from participation. NHIS 2020 found **31.9 % of US adults do muscle-strengthening
activity on 2+ days a week**. Treating non-trainers as sitting below trainers:

```
general_percentile ≈ (1 − 0.319) + 0.319 × lifter_percentile
```

| Level | Lifter %ile | ≈ all adults |
|---|---|---|
| Beginner | 5 | 70 % |
| Novice | 20 | 74 % |
| Intermediate | 50 | 84 % |
| Advanced | 80 | 94 % |
| Elite | 95 | 98 % |

**This is exactly why the levels stay lifter-based.** The whole five-level range compresses into
70–98 % of the general population — as a scale it carries almost no information, and every user would
sit in the top third. As a single contextual line it is genuinely nice to see.

Two caveats that must reach the UI:

- It assumes every non-trainer is weaker than every trainer, which is false at the margins — plenty
  of untrained people are naturally strong. So it **overstates** slightly. Show it rounded
  ("roughly the top 16 % of adults"), never as a decimal.
- The 31.9 % figure counts *any* muscle-strengthening activity, including bands and bodyweight work,
  so the pool of people with a trackable barbell lift is smaller still.

---

## 3. Tim's percentile bands — the analysis

Proposed: **25 · 50 · 70 · 80 · 90 · 95 · 99 · 99.5**

To judge these, model the distribution. Strength is roughly log-normal; anchoring to a 180 lb male
bench press with a median of 225 lb (Gravitus's figure for that body weight) and σ ≈ 0.32 in log
space gives:

| Percentile | Bench (lb) | Step from previous |
|---|---|---|
| 25 | 181 | — |
| 50 | 225 | +44 |
| 70 | 266 | +41 |
| 80 | 294 | +28 |
| 90 | 339 | +45 |
| 95 | 381 | +42 |
| 99 | 474 | **+93** |
| 99.5 | 513 | +39 |

**The instinct is good.** Steps of roughly 40 lb are a real, reachable goal, and the bands are far more
evenly spaced *in weight* than they look in percentile terms. Three problems though:

1. **Nine colours is too many to read off a body map.** The reference image uses ~12 hues to encode
   *which muscle* something is — identity, not magnitude. Here the colour encodes a *scale*, which
   means a sequential ramp, and people can reliably distinguish about 5–7 steps on a ramp. The whole
   point is glancing at a body and seeing which regions lag; if 80th and 90th look nearly identical
   that comparison fails. This is the strongest objection.
2. **99.5 is aspiration theatre.** One in 200 people who lift. Nobody in the intended audience is
   using it as a next goal, and it costs a colour that would be better spent lower down.
3. **The tail is not trustworthy.** Above roughly the 97th percentile the data thins out and the
   model diverges from reality — the 474 lb figure above is already shakier than the ones below it.
   Publishing a 99.5th-percentile threshold implies a precision the underlying data does not have.

Also: the scheme has no band below the 25th, which is where a genuine beginner will sit for months —
exactly the person who most needs a near goal. Strength Level puts Beginner at the 5th and Novice at
the 20th for that reason.

### Decided: 7 levels

The five industry anchors stay exactly where Strength Level and Gravitus put them, so our tier names
still agree with the two biggest strength calculators on the internet. Two levels are inserted into
the widest gaps — nothing existing moves.

| Level | Lifter percentile | 180 lb male bench | Step |
|---|---|---|---|
| *(no data)* | — | grey | |
| Beginner | 5 | 133 | — |
| Novice | 20 | 172 | +39 |
| Intermediate | 50 | 225 | +53 |
| **Proficient** | **65** | **255** | **+30** |
| Advanced | 80 | 295 | +40 |
| **Expert** | **90** | **339** | **+45** |
| Elite | 95 | 381 | +42 |

Inserted levels in bold. The effect on spacing:

| | worst step | spread |
|---|---|---|
| 5 levels | +86 lb | 47 lb |
| 7 levels | +53 lb | **24 lb** |

The spread halves and the worst gap drops from +86 to +53 lb. No level now costs a year of training
to clear.

**Seven fills plus grey is the ceiling.** People reliably distinguish about 5–7 steps on a sequential
ramp, so this sits right at the limit — the `dataviz` validator has to confirm all seven stay
separable, including under deuteranopia, before the palette is committed. If any pair fails, the
inserted levels are the ones to drop, not the anchors.

### The progress readout is still required

Even at +30 to +53 lb a step, somebody mid-band needs to know how far they are from the next one:

> **Chest — Intermediate** · 240 lb
> `██████░░░░░░░░` **15 lb to Proficient**

The colour gives standing; the number gives the near goal.

## 4. Age — yes, collect it, and make the basis visible

Strength peaks between roughly 23 and 40 and declines after. Powerlifting has ready-made age grading:
the **McCulloch coefficients** for masters (1.00 at 40, 1.130 at 50, 1.381 at 60) and **Foster** for
teens and juniors.

Without age, a 55-year-old is measured against a population dominated by 25-to-35-year-olds and will
read as permanently weaker than they are — demotivating and, in the sense that matters, wrong.

**Recommendation:** collect birth year, optional. Age-grade by default, with a visible toggle:

- *"vs. people who lift, your age and weight"* ← default
- *"vs. everyone who lifts, your weight"*

Two numbers, clearly labelled, is more honest than silently picking one. Age also stays optional —
an unfilled birth year just means the second mode.

---

## 5. Muscle groups and their benchmark lifts

The library has 13 real muscle groups (plus Cardio, which is not one). Each needs a **designated key
lift** with published standards. Coverage is honestly uneven:

| Muscle group | Key lift | Backup lifts | Standards quality |
|---|---|---|---|
| Chest | Barbell Bench Press | Incline Bench, DB Bench | 🟢 excellent |
| Back | Barbell Row | Lat Pulldown, Pull-Up | 🟢 good |
| Quads | Back Squat | Front Squat, Leg Press | 🟢 excellent |
| Hamstrings | Romanian Deadlift | Leg Curl | 🟡 fair |
| Glutes | Hip Thrust | Deadlift | 🟡 fair |
| Shoulders | Overhead Press | Seated DB Press | 🟢 good |
| Biceps | Barbell Curl | DB Curl | 🟡 fair |
| Triceps | Close-Grip Bench | Skull Crusher, Dip | 🟡 fair |
| Traps | Barbell Shrug | — | 🔴 thin |
| Forearms | Farmer Carry / Wrist Curl | — | 🔴 thin |
| Calves | Standing Calf Raise | — | 🔴 thin |
| Core | Weighted Plank / Cable Crunch | — | 🔴 very thin — time-based, no weight standards |
| Neck | — | — | 🔴 none. Leave permanently grey. |

**Consequences to accept up front:**

- **Deadlift is the awkward one.** It is the best-documented lift in existence and belongs to no
  single muscle group — it is glutes, hamstrings and back at once. Proposal: let it fill **Glutes**
  as primary, since hip thrust standards are thin, and revisit when the weighted primary/secondary
  muscle map (needed for D3) exists.
- **One lift lights one muscle.** A bench press will not colour Triceps even though it trains them.
  Cleaner and more honest than guessing at contributions, and it matches Tim's "grey if no
  recordings" rule. The weighted mapping is a later, larger change.
- **Core, calves, forearms and neck will be grey for most people forever.** Worth saying in the UI
  rather than letting it look like a bug.

---

## 6. How a muscle's level is computed

```
benchmark (weight × reps)
   → e1RM                      [D11, js/e1rm.js]
   → ratio to body weight
   → percentile lookup          [gender, age band]
   → level + colour
```

Where a group has several benchmarked lifts, take the **highest percentile**, not the average — a
muscle is as strong as the best evidence for it, and averaging punishes people for having logged a
lift they neglect.

### ⚠️ A caveat that must not be skipped

`docs/research.md` §1.3 says the e1RM formula was optimised for **internal consistency, not absolute
accuracy** — it was never validated against measured 1RMs. Rep normalisation only needs relative
structure, so that limitation was harmless there. **Percentile placement needs absolute accuracy**,
which is a genuinely stronger claim than anything the formula has been shown to support.

Mitigations:

- Prefer benchmarks at **≤5 reps** for placement; the formulas are most accurate there.
- Where only high-rep benchmarks exist, mark the muscle's level as **low confidence** (hatched fill,
  same texture language as the estimated bars) rather than pretending.
- Prompt for a heavy benchmark on the key lift when a group has only high-rep data.

---

## 7.1 Placement and naming — decided

The nav item is **Data** (was Graphs), and its three modes are **Graph**, **Bar Chart** and
**Muscle Groups**. Renamed in the app on 2026-08-15; the route stays `#/graphs` internally.

Consequence to watch: the segmented control holds the modes and lives in the header where the screen
title would be. Three options is tighter than two — "Muscle Groups" is also the longest label — so
the switch may need to shorten to "Muscles", become icons, or move out of the header.

## 7. Drawing the body

### 7.0 SUPERSEDED 2026-08-16 — the artwork is Tim's own

Tim supplied `Human_Muscle_Groups.jpg` on 2026-08-16 and asked that the app follow it **exactly**
rather than approximate it. That is what now ships (7.2).

**Licensing: raised and resolved 2026-08-16.** The earlier note here — that the *reference* image for
this feature was a watermarked Dreamstime stock illustration, ID 142535635, © Vectorville — was put
to Tim directly, because the supplied file is the same composition without the watermark and the
derived assets are published. **He confirmed the image is his own work.** Recorded because the
earlier finding is still in this file's history and would otherwise be re-raised every session.

The source JPG stays git-ignored (`*.jpg`) as a working file; `img/ink-*.webp` and `js/body-art.js`
are the shipped derivatives.

### 7.1 The original plan (not taken)

Hand-author an inline SVG, front and back, one `<path>` per muscle region. Roughly 26 paths. This
was built and shipped on 2026-08-15, then replaced — it was anatomically correct but read as a
clinical diagram, and Tim wanted a training poster.

### 7.2 What ships now — fill and ink, separated

The artwork is one flat image, and the app needs each muscle to take its own colour while every
keyline, striation and shadow survives whatever colour it is given. So `tools/build-body-art.py`
splits it into two layers:

| Layer | What it is | Where |
|---|---|---|
| **Fill** | one traced vector path per muscle group per view. Colour and hit-testing only | `js/body-art.js` |
| **Ink** | one greyscale image per view, used as an SVG **luminance mask** over a rect of ink colour. Every keyline, striation and shadow | `img/ink-*.webp` |

Compositing them reproduces the drawing. Changing a fill recolours exactly one muscle and cannot
touch the texture, because the texture is not in the fill — it is in the mask on top of it.

**Ink is a scalar**, not a per-channel multiply: how much the artwork darkens *its own base colour*
at that pixel. Applied to any fill it yields a darker version of **that** fill. A per-channel
multiply reproduced the source more exactly but broke on recolour — where a base colour has a
near-zero channel the ratio there is noise, and the striations came out **green over a blue muscle**.

Consequences worth knowing:

- **Head, hands, feet and knees carry ink but no fill**, so they stay unpainted. That is what makes
  the coloured masses read, and it is Tim's own §9 requirement, satisfied by construction.
- **The quadriceps is drawn as four heads in four hues.** The app gives the whole group one strength
  colour, so each head is normalised against its own base. Shading *inside* each head is preserved;
  the hue difference *between* heads is dropped. In the source that difference is decoration — in
  the app hue means strength level, and it cannot mean both.
- **Muscles the app has no group for** join the group they train with, recorded in the tool's
  `SEEDS` table: sternocleidomastoid → Neck, teres/infraspinatus/erectors → Back, sartorius and the
  front adductors → Quads, adductor magnus → Hamstrings, glute medius/TFL → Glutes, tibialis
  anterior and peroneals → Calves.
- **The figure is a poster in both themes** — dark ink on light paper. The shading assumes shadows
  are darker than the paper, so inverting for dark mode would turn every striation into a highlight.
  Dark mode gets a dimmer sheet (`--body-paper`), not a dark one.
- `--body-none` exists because `--lv-none` is tuned to sit on the dark *page*; on light *paper* it
  painted the unranked muscles near-black and they read as holes punched in the body.

Reconstruction error against the source, measured by the tool on every build: unpainted areas are
**exact**; muscle interiors are exact at the median (p50 0/255) with p99 ≈ 62/255, which is the
chroma the scalar encoding deliberately gives up.

### 7.3 Swapping the artwork out

`js/body-map.js` consumes `ART` and `FIGURE` from `js/body-art.js` and nothing else about the
artwork. Any replacement that produces the same two exports drops straight in; the muscle names are
asserted against `MUSCLE_LIFTS` in `tests/data-layer.test.mjs`, so a substitute cannot quietly lose
a group. The previous hand-authored figure is recoverable from git at `53f1b0b`.

---

## 8. Colour

A **sequential ramp**, not the reference image's categorical rainbow — the value being encoded is
ordered, so the colour must be too. The rainbow in that image encodes muscle identity, which we get
from position instead.

Constraints, per the project's existing rule: **load the `dataviz` skill and run its validator before
committing to a palette.** Requirements are stricter than usual here:

- 7 steps distinguishable from each other, including under deuteranopia and protanopia
- readable against `--ground` in both themes
- grey for no-data must sit clearly *outside* the ramp, not read as a low level
- never colour-alone: tapping a muscle names its level, and the key is always on screen

---

## 9. Build order

| Phase | Work |
|---|---|
| 0 | **Body-weight tracking** (Tier 1 anyway) + profile: gender, birth year |
| 1 | Standards table + `js/strength-standards.js` — percentile lookup, pure and unit-testable |
| 2 | Muscle → key-lift mapping, level computation from benchmarks |
| 3 | The SVG body, both views, per-muscle fills |
| 4 | Tap a muscle → highlight, per-level weight targets for its key lift, "X lb to next level" |
| 5 | Later: incorporate workout lifts (Tim's own note), weighted secondary-muscle contributions |

Phases 1 and 2 are pure logic and fully testable headlessly — same approach as `e1rm.js`, which
caught a real bug that way.

---

## 10. Where the numbers come from

Building the table by scraping Strength Level is off the table — it is their proprietary dataset.

- **[ExRx.net](https://exrx.net/WorkoutTools/StrengthStandards)** — the classic published
  bodyweight-multiple standards, untrained through elite, covering many lifts. Conservative at the
  upper tiers.
- **[Barbell Medicine](https://www.barbellmedicine.com/blog/strength-standards/)** — decile tables
  from 809,986 drug-tested competition entries, split by sex, ages 18–35. Best for the top end.
- **[OpenPowerlifting](https://www.openpowerlifting.org/)** — openly licensed competition results;
  percentiles can be computed directly rather than trusted second-hand.
- **[Gravitus](https://gravitus.com/strength-standards/)** and
  **[Strength Level](https://strengthlevel.com/)** — useful as cross-checks on the middle of the
  distribution, which is where competition data is worst.

Sanity check that these agree: at 180 lb male, ExRx-style ratios (bench 1.25×, squat 1.5×, deadlift
1.75×, press 0.7×, row 1.1×) give 225 / 275 / 315 / 126 / 198 — against Gravitus's measured medians
of 225 / 275 / 320 / 130 / 205. Close enough to trust the middle of the table.

---

## 11. Open questions for Tim

Answered 2026-08-15: reference population, level count, and placement — see the decisions at the top.

Still open:

1. **Deadlift's muscle group** (§5) — it is the best-documented lift in existence and belongs to
   glutes, hamstrings and back at once. Proposal is to let it fill **Glutes**, since hip-thrust
   standards are thin, and revisit when the weighted primary/secondary muscle map exists.
2. **Whether the general-population readout is per-muscle or one figure for the whole body.**
   Per-muscle is more informative; one figure is less clutter on an already busy screen.
