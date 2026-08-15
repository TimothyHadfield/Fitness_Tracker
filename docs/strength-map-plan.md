# Strength map — plan

*Drafted 2026-08-15 in response to Tim's spec: a human body with each muscle group coloured by how
strong it is relative to people of the same gender and weight; grey where nothing is recorded;
benchmarks only for now; click a muscle to see the weight needed for each level on a named lift.*

**Nothing here is built yet.** This is the design for review.

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

### Recommended: 7 levels

| Level | Percentile | 180 lb male bench |
|---|---|---|
| *(no data)* | — | grey |
| Untrained | below 5 | under 133 |
| Beginner | 5 | 133 |
| Novice | 20 | 172 |
| Intermediate | 50 | 225 |
| Proficient | 75 | 279 |
| Advanced | 90 | 339 |
| Elite | 97 | 411 |

Steps of +39, +53, +54, +60, +72 — each level slightly harder than the last, which is both true and
motivating. Seven fills plus grey is at the top of what a ramp can carry.

### The part that actually solves "everyone needs a nearby goal"

**Colour count is the wrong lever.** However many bands exist, always show the number:

> **Chest — Intermediate.** 240 lb. **39 lb to Proficient.**

with a progress bar inside the current level. That gives a near goal even to someone who just entered
a band, which no amount of extra colours can do. Decoupling the two means the ramp can stay readable
*and* the goal stays close.

If Tim still wants his eight, dropping only 99.5 gets it to seven and I would build that happily.

---

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

## 7. Drawing the body

**The reference image cannot be used** — it is a watermarked Dreamstime stock illustration
(ID 142535635, © Vectorville). Using it would be copyright infringement, and it carries someone
else's visual identity into the app.

Instead: **hand-author an inline SVG**, front and back, one `<path>` per muscle region with a
`data-muscle` attribute. Fill comes from a CSS custom property per level. This keeps the no-build,
no-dependency architecture, scales cleanly, themes properly, and makes each region a real click
target for the tap-to-inspect behaviour.

It is the largest single piece of work here — a simplified, stylised body, not an anatomy textbook.
Roughly 26 paths (13 groups × front/back where visible).

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

1. **Reference population** — confirm "people who lift and log" (§2). It is the honest choice and it
   is also the least flattering one, so it should be a deliberate decision.
2. **Seven levels or eight** (§3).
3. **Deadlift's muscle group** (§5) — glutes, or hold it back until the weighted mapping exists.
4. **Does the map replace the Graphs screen, or sit beside it?** A body map is a natural home
   screen; it is also a fifth nav item, and the nav is currently four.
