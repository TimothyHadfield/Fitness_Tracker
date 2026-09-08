# Ranking the calves and the neck — the assessment

**Written 2026-09-21, on Tim's instruction:** *"I want you to work on different ways we might be able
to rank the claves. Look at how we decided to rank the abs and see if that might also be a good
system. The neck also doesn't have any rating system right now so I think a similar Idea should
happen with that. **Don't build anything with the rating the calves and neck yet, but just plan on an
idea right now.**"*

🛑 **NOTHING IS BUILT. NOT ONE LINE.** This is the assessment, the options and a ranked
recommendation. Every decision in it is Tim's.

⚠️ **REFERENCES ARE BY FUNCTION NAME WHERE THE FILE IS UNDER ACTIVE EDIT** (`store.js`,
`views-muscles.js`, `muscle-evidence.js`, `social.js`, `shared-map.js`, `app.css`). Two line numbers
in the first draft of this document had already moved by the time it was checked — handbook §0.20.

---

## 0. The two answers, before the reasoning

🚨 **THESE ARE NOT ONE PROBLEM, AND TREATING THEM AS ONE IS THE FIRST MISTAKE AVAILABLE.**

| | Calves | Neck |
|---|---|---|
| **Has a key lift?** | ✅ Yes — Standing Calf Raise, `js/strength-standards.js:213` | ❌ No |
| **Has published standards?** | ✅ Yes, both sexes, five anchors each | 🚨 **YES — and the project has been saying otherwise.** See §2 |
| **In `UNRANKABLE`?** | No | Yes |
| **Has a conversion table?** | ✅ Yes — 8 of 10 library calf exercises convert | ❌ No |
| **So what is wrong?** | **Nothing about the standards. The evidence gate throws the sets away, and says nothing.** | **The female table is unusable and the male table is wider than the widest row we already call a red flag.** |
| **Shape of the fix** | A screen that owns up, then a decision about D5 | Core's shape (§14) — one measured source, priced — **but it cannot ship as a sexed pair, and every row in `MUSCLE_LIFTS` is one** |

**The framing this plan was handed was:** calves = a D5 problem, neck = an abs-shaped problem.
**Both survived contact, and both were incomplete.** D5 is *one of three* things that can blank a
calf, and which one it is is checkable on screen. And the neck's problem is not that nothing is
published — it is that what *is* published fails in a way §14's Core pull did not.

---

## 1. Calves — the real question

### 1.1 🚨 It is not the standards and it is not the ratio table. Both are fine, and here is the check

The claim in `js/strength-standards.js` is real. `Calves` carries Strength Level's machine calf raise
page — **110 / 198 / 317 / 463 / 629** (180 lb male) and **50 / 108 / 193 / 303 / 430** (140 lb
female), `untrained: 'lower'`, a fitted two-piece spread of 0.601 / 0.433 and 0.755 / 0.511. It is
not in `UNRANKABLE`.

`RATIOS.Calves` in `js/muscle-evidence.js` has eight entries, and the whole calf family was
walked through `contributionsFor()` to check rather than assumed:

| Exercise | Converts? | Ratio · quality |
|---|---|---|
| Standing Calf Raise | ✅ | 1.00 · 1.00 — the key lift |
| Seated Calf Raise | ✅ | 0.66 m / 0.75 f · 0.65 |
| Leg Press Calf Raise | ✅ | 1.47 · 0.35 |
| Smith Machine Calf Raise | ✅ | 1.00 · 0.45 |
| Barbell Calf Raise | ✅ | 0.95 · 0.35 |
| Donkey Calf Raise | ✅ | 1.05 · 0.35 |
| Dumbbell / Seated Dumbbell Calf Raise | ✅ | 0.52 · 0.35 |
| **Single-Leg Calf Raise** | ❌ | body-weight fraction never measured |
| **Tibialis Raise** | ❌ | same, and it records no weight at all |

**And the demo year rates Calves at high confidence today** — the `GOLDEN` table in
`tests/data-layer.test.mjs` pins `['Calves', 332, 225.2087, 0.8807, 84, 2]`. Confidence 0.88 is
the second-highest of the twelve. **The machinery works.** Whatever is wrong with a real account's
calves is not the standards, the ratios or the key lift.

### 1.2 🚨 WHAT IT IS — proved, not asserted

`js/strength-observations.js`, line 107, inside `record()`:

```js
    if (!isRankableSet(reps)) return;
```

**It returns before the blocked bookkeeping twenty lines below it.** So a set above 15 reps is
dropped from the evidence *and* never recorded in `blocked`, which is the map's whole mechanism for
saying what it threw away.

Run against the real modules, forty weeks of three sets a week, changing nothing but the rep count:

```
Standing Calf Raise 120x12    obs= 120   rating=178.5 lb conf 0.861   blocked=nothing reported
Standing Calf Raise 120x15    obs= 120   rating=191.8 lb conf 0.854   blocked=nothing reported
Standing Calf Raise 120x16    obs=   0   rating=NONE                  blocked=nothing reported
Standing Calf Raise 120x20    obs=   0   rating=NONE                  blocked=nothing reported
Seated Calf Raise   180x20    obs=   0   rating=NONE                  blocked=nothing reported
Leg Press Calf Raise 300x25   obs=   0   rating=NONE                  blocked=nothing reported
```

**One rep is the difference between "Novice, high confidence" and a hatch, and the app says nothing
about it on the muscle screen.** That is the finding.

⚠️ **AND THE HATCH MAKES IT WORSE RATHER THAN BETTER.** `trainedButUnrankable()` in
`js/views-muscles.js` asks *"has work, has no rating"* — deliberately, and correctly, since
2026-09-04. Volume still counts the 20-rep sets, so a calf with no admissible evidence is **hatched
and labelled `'trained, can\'t be ranked'`** — the identical mark and the identical words the Neck
wears, where the reason really is that the world has no standard. The one screen that separates them
is `summary()` on the same file, which says *"Neck can't be ranked — there is no published strength
standard for it"* in one sentence and *"Your Calves work is recorded and counted toward volume, but
nothing in it could be placed against other people"* in the next. **Neither sentence contains the
word "reps."**

🚨 **THE APP ALREADY KNOWS HOW TO SAY THIS AND SAYS IT ON TWO OTHER SCREENS.** Two paths in
`js/store.js` — the exercise chart and the personal-bests walk — both count `dropped` and
`droppedMaxReps`; `js/views-data.js` prints *"N sets over 15 reps…"*; `js/compare.js` prints *"N sets
above 15 reps are left out of the strength rows. This app does not read a maximum off a burnout set,
for either of you."* **The muscle map is the one path that drops silently, and it is the path Tim
looked at.**

### 1.3 ⚠️ D5 is one of THREE things that can blank a calf, and the framing did not have the other two

A real account can have a hatched Calves for any of:

1. **Every set is above 15 reps** — D5. Silent. §1.2.
2. **The only calf work is Single-Leg Calf Raise or Tibialis Raise** — both body-weight, both
   refused because nobody has measured the fraction. **This one IS reported**: `rankBlockedReason()`
   returns *"how much of your body weight this one carries has never been measured"*, it lands in
   `blocked`, and `blockedNote()` prints it. So the panel already distinguishes this case.
3. **Both.**

🔒 **WHICH MEANS THE DIAGNOSIS IS AVAILABLE ON SCREEN AND SHOULD BE READ BEFORE ANYTHING IS BUILT.**
If Tim's Calves panel says *"N sets of Single-Leg Calf Raise not counted — how much of your body
weight this one carries has never been measured"*, then D5 is **not** his problem and every option
in §1.5 is the wrong build. If the panel says nothing at all under a hatched calf, it is D5, because
those are the only two doors. **Ask him to tap the muscle, or read his account.** This costs one
message and is worth more than any option below.

### 1.4 🚨 The binding reason and the solvable one — state them in that order (§0.17)

Handbook §0.17: *"A rule guarded by its weakest reason gets overturned by whoever solves that
reason. State the binding reason first, and put the solvable one second or not at all."* That rule
exists because §9 said an incline push-up was refused for lack of a hand-height field — a solvable
problem — when the binding reason was a mismatch of measurement bases, and a session went and built
the field.

**So, for calves, in the right order:**

🛑 **THE BINDING REASON is that a 20-rep calf raise is not evidence of a maximum, and admitting one
makes the number BIGGER than anything observed.** Marzagão on a 120 lb set: 15 reps reads 192 lb, 20
reads 213, 25 reads 233. That is the direction `docs/fatigue-plan.md` §4 refuses in writing —
*"the only option on the table that makes a number BIGGER than what was observed… Rule 5 exists for
this: the app does not invent numbers, and it especially does not invent flattering ones."* It is
also literally the 135 × 25 → 258 lb bug D5 was written to end.

⚠️ **The solvable reason, second: nothing tells the user.** That is a screen, and it is free.

**Do not let the second one carry the first.** A plan that fixes only the message will be read as
"calves is done" and a plan that fixes only the gate will ship the burnout bug back.

### 1.5 The options, each with its cost and its error direction

Ordered as I would take them.

---

#### 🥇 A. SAY WHY — carry the rep gate into `blocked`, like every other screen already does

**What.** Move `js/strength-observations.js:107` so a set refused for reps is *counted* before it is
dropped: a new `blocked` reason per muscle, *"N sets of Standing Calf Raise were above 15 reps —
this app does not read a maximum off a burnout set"*, with `fixable: false` but a plain sentence
saying that one heavier set in the 6–12 range would rate the muscle. The hatch label gains a second
form — *"trained, no set we can read a max from"* — distinct from Neck's *"trained, can't be
ranked"*.

**Error direction.** ✅ **None. It changes no number.** Not one estimate, not one percentile, not one
confidence. It is a sentence.

**Cost.** One counter in `strength-observations.js`, one branch in `blockedNote()`, one label in
`views-muscles.js`, one legend line. **No re-baseline** — the golden table cannot move, because
nothing enters `byMuscle` that did not before. **No demo re-roll.** No new library exercises.

**Against `docs/direction.md` §3.1.** This is the *"have a way to be upfront about it"* half,
delivered exactly. It is also the only option that is unambiguously right whichever of §1.3's three
causes is Tim's — a Single-Leg-Calf-Raise account already gets its sentence, and this gives the
20-rep account the matching one.

⚠️ **What it does NOT do: it does not rate anybody's calves.** If Tim's answer is *"I don't care why,
give me a number"*, this is necessary and not sufficient, and B is the next question.

---

#### 🥈 B. PRICE THE HIGH-REP SET RATHER THAN REFUSING IT — raise D5's ceiling and let σ_rep pay for it

**What.** Raise `MAX_EVIDENCE_REPS` from 15 to somewhere in 20–25, and extend `js/rep-sigma.js` to
match by re-running `tools/build-rep-sigma.mjs` with a higher `MAX_REPS`.

🚨 **THIS IS NOT A LOOSENING DRESSED AS A REFINEMENT, AND THE ARGUMENT HAS TO BE MADE OUT LOUD.**
D5's ceiling was 15 because the formulas are not trusted past it. Since 2026-09-20 the project has a
*measured* number for exactly that distrust — σ_rep, the disagreement between the seven classical
formulas of `docs/research.md` §1.2, each normalised by its own f(1). Extending the tool gives:

| reps | σ_rep | spread between the seven formulas (max ÷ min) |
|---|---|---|
| 10 | 4.2 % | 1.11× |
| 12 | 5.9 % | 1.16× |
| **15 — today's ceiling** | **9.6 %** | **1.26×** |
| 18 | 14.6 % | 1.42× |
| 20 | 18.8 % | 1.57× |
| 25 | 34.1 % | 2.18× |
| 30 | 61.3 % | 3.67× — past `SIGMA_MAX`, the clamp eats it |

And the blend already reads 1/σ², so the discount arrives with no new constant. On the key lift:

| reps | σ total | blend weight | share of a 15-rep set |
|---|---|---|---|
| 12 | 0.078 | 166 | 194 % |
| 15 | 0.108 | 86 | 100 % |
| 20 | 0.194 | 27 | **31 %** |
| 25 | 0.345 | 8 | **10 %** |

⚠️ **AND ON CALVES SPECIFICALLY THE FLATTERY IS SMALL, WHICH IS THE ONE GENUINELY GOOD ARGUMENT FOR
THIS OPTION.** The calf standard is the second-widest in the whole table (σ_below 0.601 against the
bench's 0.324; only the wrist curl is wider). A wide standard is insensitive to the estimate. A 180 lb
man doing 120 lb calf raises:

| reps read | e1RM | percentile |
|---|---|---|
| 15 (today's ceiling) | 192 lb | p20.2 |
| 20 | 213 lb | p25.4 |
| 25 | 233 lb | p30.6 |

**Five percentile points for a five-rep extension, inside one level.** The same move on the bench
press (185 lb, p82.7 → p90.4) crosses **two** level boundaries. The calf is where D5 costs the most
and the relaxation buys the least distortion.

🚨 **ERROR DIRECTION: UP, AND ONLY UP. THIS IS THE MOVE `docs/fatigue-plan.md` §4 REFUSES IN
WRITING.** It cannot make anybody read weaker. Every account it touches reads stronger than it does
today, by 3–8 percentile points on the wide standards and more on the narrow ones. **That is the
whole cost and it must be Tim's call, not a session's.**

⚠️ **AND THE FLATTERY IS BIGGEST IN THE MIDDLE, WHICH IS WHERE MOST PEOPLE ARE.** A 140 lb woman's
seated calf raise at 90 lb: 15 reps → p52.1, 20 reps → **p60.6**. Fourteen points, Intermediate to
Proficient, because near the median the log-normal is steepest. "Small on calves" is true of a weak
lifter and half-true of an average one.

**Cost, and it is much larger than it looks.** Counted rather than estimated: `isRankableSet()` has
**ten call sites in seven modules** — `compare.js`, `e1rm.js` (inside `modalReps`),
`muscle-evidence.js`, `set-e1rm.js`, `store.js` (×3), `strength-estimate.js` (×2),
`strength-observations.js` — and **five more modules read `MAX_EVIDENCE_REPS` in live code**:
`compare.js`, `exercise-estimate.js`, `progression.js`, `strength-estimate.js`, `views-data.js`.
(`demo.js` calls the gate too, and `personal-bests.js` only mentions it in comments — its
enforcement comes through `setE1rm()`.) **None of them takes a muscle.** So raising the number raises it for the bench press, the
personal-bests table, the Data tab chart, the comparison screen, the progression advice and the demo
generator at the same time.

- 🚨 **`MAX_TARGET_REPS` is declared as the same number on purpose** (`js/e1rm.js:388`) — *"a target
  the curve cannot be trusted at is not a target worth offering"* — so the Data tab's rep target
  would follow it up to 20 or 25 unless that link is deliberately cut, which was itself a
  2026-09-13 fix for a real bug.
- 🚨 **`modalReps()` would let burnout sets vote again.** The 2026-09-13 note is explicit: three
  25-rep sets used to elect the chart's target.
- **Golden table: re-baselines, upward, on several muscles.** The demo's Seated Calf Raise is
  `reps: [12, 16]` and its Lateral Raise, Leg Extension, Neck Curl and Face Pull all top out at 16,
  so sets currently refused would be admitted. **Every affected muscle moves up.**
- **Demo re-roll: not required** (no exercise is added), but the pins move and **re-baselining a
  regression pin is Tim's call, not a side effect** (`progress.md` Open work 25).

**Verdict.** Buildable, arguable, and it is the one move this project has refused in writing.
**Offer it; do not take it without Tim saying the words.**

---

#### 🥉 C. A MUSCLE-SPECIFIC REP CEILING — 15 everywhere, 20 or 25 on Calves

**What.** `isRankableSet(reps, muscle)`, with a per-muscle override beside `untrained` in
`MUSCLE_LIFTS`. The argument for it is real: calf work genuinely IS trained at 15–25 reps —
`preset-systems.js` alone prescribes *"15–20 reps"* twice and *"12–20 reps"* once, from published
programmes — and the soleus is a slow-twitch muscle where high-rep work is the norm rather than a
burnout.

**Error direction.** Up, same as B, but confined to one muscle.

🛑 **AND THE COST IS WHY IT RANKS BELOW B DESPITE BEING BETTER-AIMED.** The gate is a function of
`reps` and nothing else, at the **ten call sites in seven modules** counted in B, several of which have no
muscle in scope at all: `personalBests()` scores an *exercise*, `compare.js` scores an exercise
against a friend's, `views-data.js` charts an exercise. Threading a muscle through all of them to
express "the calf is different" is a larger change than the whole of §2, and the first place it
breaks is the one where two muscles disagree — a Leg Press Calf Raise contributes only to Calves, but
`setE1rm()` is called once per set and returns one number.

⚠️ **AND IT NEEDS AN ARGUMENT IT DOES NOT HAVE.** "The calf is trained higher" is a fact about
training culture, not about the rep→1RM curve. σ_rep says the formulas disagree 1.57× at 20 reps on
*every* lift; nothing published says they disagree less on a calf raise. **A muscle-specific ceiling
would be a judged constant in the one place the project has just finished replacing judged constants
with measured ones** (the σ_rep work, 2026-09-20). It would be D5 with an exception nobody measured.

**Verdict.** The right instinct, the wrong mechanism. If the calf deserves special treatment it
should come out of a measurement, and B's σ_rep is that measurement applied uniformly.

---

#### D. TIME UNDER TENSION — 🛑 refused, and the reason is §15's

**What was considered.** Read a 20-rep calf raise as a duration and rank it against a published
endurance norm rather than as a maximum.

🚨 **REFUSED, AND IT IS THE §15 FAULT EXACTLY.** `docs/research.md` §15 records a session that nearly
merged Ebben's *peak dynamic* push-up force with Suprak's *static hold* because the numbers looked
compatible. **A time-under-tension reading and a 1RM percentile are different quantities and the map
has one colour scale.** A calf coloured from an endurance number sitting beside a chest coloured from
a maximum is two meanings in one drawing — the fault the 2026-09-03 abs assessment rejected Tim's
second idea for, and the fault Rule 5 exists to name.

**Also: the app has no duration on a weighted set.** `js/exercises.js` gives every calf raise
`fields: ['weight','reps']`. Adding a tempo field would be a data-model change to serve a number that
cannot be put on the scale it is being computed for. **Nothing here is worth building.**

---

#### E. A SEPARATE HIGH-REP STANDARD — 🔴 nothing to build it from

**What was considered.** Rank a 20-rep set against a published 20-rep population rather than
converting it to a 1RM at all.

**Checked, and this is the honest "no":** Strength Level publishes 1RM tables. It does not publish a
20RM table for the calf raise or for anything else, and no aggregator found does. **Deriving one by
running our own e1RM curve backwards from the 1RM table is not a second source — it is the same
source with the same extrapolation, wearing a new name.** That is precisely §14.2's objection to
Fitness Volt: *"the measured source wins; Fitness Volt's is a model of it."*

🔴 **Recorded as checked-and-rejected rather than left as an open lead.**

---

## 2. Neck — the abs-shaped question

### 2.1 🚨 THE PREMISE THIS PROJECT HAS BEEN WORKING FROM IS FALSE

Four places in this repo state that no published neck standards exist:

- `js/strength-standards.js:262` — *"Neck has no usable published standards — nobody publishes neck
  norms — so it stays unranked permanently"*
- `js/strength-standards.js:273` — *"Neck is still here and there is no route out for it"*
- `summary()` in `js/views-muscles.js` — *"there is no published strength standard for it"*
- `progress.md`, the Open work table — *"Core and Neck are permanently unrankable (no published
  standards exist)"*

**Strength Level publishes two neck pages.** They are not linked from the browse index, which is why
they read as absent. Both fetched and read directly on 2026-09-21, and the numbers below were pulled
twice from the live pages rather than taken on a report's word (handbook §0.19):

**Neck Curl** — https://strengthlevel.com/strength-standards/neck-curl/lb
2,726 qualifying results from 91,634 community lifts, 14 Aug 2020 – 5 Mar 2026. **2,671 male, 55 female.**

| | p5 | p20 | **p50** | p80 | p95 |
|---|---|---|---|---|---|
| 180 lb male | 5 | 26 | **65** | 123 | 194 |
| 140 lb female | 2 | 17 | **47** | 91 | 147 |

**Neck Extension** — https://strengthlevel.com/strength-standards/neck-extension/lb
1,159 qualifying results from 63,467 lifts, 15 Aug 2020 – 4 Mar 2026. **1,143 male, 16 female.**

| | p5 | p20 | **p50** | p80 | p95 |
|---|---|---|---|---|---|
| 180 lb male | 6 | 28 | **69** | 127 | 199 |
| 140 lb female | 7 | 17 | **33** | 53 | 78 |

Same publisher, same tier definitions (5/20/50/80/95), same page shape as the twelve rows already in
`MUSCLE_LIFTS`. **The library already has the exercises**: Neck Curl, Neck Extension and Neck Harness
Extension, all `fields: ['weight','reps']`.

🚨 **THIS IS §14.6's WARNING ARRIVING FOR REAL.** That section recorded the plank and sit-up norms as
**UNCHECKED rather than rejected**, precisely because *"no honest source exists"* had been wrong once
before. **It was wrong again here, and it had been written into the code as a permanent fact.**
⚠️ **Whatever else Tim decides, those four sentences are false and should be corrected** — that is a
one-line-each change and it does not depend on any option below.

### 2.2 🛑 AND THE PAGES STILL CANNOT SHIP AS THEY STAND. Three reasons, binding one first

**(i) 🚨 THE FEMALE TABLE IS BACKWARDS, AND EVERY ROW IN `MUSCLE_LIFTS` IS A SEXED PAIR.**

The published female neck-curl table falls with body weight, in every column:

| female BW | 90 | 140 | 180 | 260 |
|---|---|---|---|---|
| Beginner | 4 | 2 | 2 | 1 |
| **Intermediate** | **53** | **47** | **43** | **39** |
| Elite | 158 | 147 | 141 | 133 |

**A heavier woman is asked for less.** That is not a finding about necks, it is an n=55 fit. And the
app would fight it: `medianForPopulation()` scales by `bodyWeight^0.67`, so from the 140 lb row it
computes **71 lb** at 260 lb where the source publishes **39 lb** — an 82 % disagreement, in the
opposite direction, on the same page the median came from. Neck extension is worse: **n = 16.**

🛑 **There is no "male only" shape available.** `keyLift()` takes `(lift, male, female)`; `populations()`
resolves a sex on every path; `withAssumptions()` assumes male when the profile is blank *because a
percentile cannot be computed without picking one*. A Neck row with a fabricated or omitted female
side would rank women against nothing, silently, on a map whose sex handling was rebuilt in
September precisely so that *"both people are being compared to the same people"* could not happen
again (D31, and `comparePreset('each')`).

**(ii) ⚠️ THE SPREAD IS WIDER THAN THE ROW THE FILE ALREADY CALLS A RED FLAG.** Fitting the two-piece
σ to the published anchors, the same way every other row is fitted:

| lift | σ below | σ above | Elite ÷ Beginner |
|---|---|---|---|
| bench press (male) | 0.324 | 0.268 | 2.7× |
| cable crunch — Core, the 🟡 precedent | 0.548 | 0.409 | 5.0× |
| **wrist curl — "⚠️ THE WRIST CURL'S SPREAD IS ENORMOUS"** | **0.957** | **0.593** | **14.5×** |
| **neck curl (male)** | **1.324** | **0.711** | **38.8×** |
| **neck extension (male)** | **1.278** | **0.684** | **33.2×** |

`js/strength-standards.js:167` already flags the wrist curl as *"a page where the light end is
dominated by people logging an empty-handed movement or a single plate."* **The neck curl is 38 %
wider than that**, and its male Beginner at 110 lb body weight is **0 lb**. The two-piece fit cannot
even reproduce its own anchors: someone sitting exactly on the published Beginner mark reads
**p2.6**, against p4.0 for Core and p4.5 for the bench — the same class of failure that forced Core
to get its own σ in the first place, and worse.

**What that means on a screen:** the percentile barely responds to the weight. A 180 lb man goes
p40.6 at 25 lb × 12 and p53.0 at 40 lb × 12 — **sixty percent more weight for twelve percentile
points** — while the bottom quarter of the scale is occupied by people who logged nothing.

**(iii) ⚠️ THE TWO PAGES DISAGREE WITH THE PHYSIOLOGY AND WITH EACH OTHER.** Male flexion 65 vs
extension 69 — a ratio of 1.06, where every dynamometry dataset puts extension at **1.3–1.6×**
flexion. The female pages run the *other* way (47 vs 33, ratio 0.70). The most likely reading is that
lifters are logging one plate-on-the-head movement under both names. **This is not fatal on its own
— it is a reason to pick one page rather than both, and a reason the grade is 🟡 not 🟢.**

### 2.3 What the academic literature has, and why it must not be mixed in

⚠️ **THE §15 LESSON, AND IT BINDS HERE HARDER THAN ANYWHERE.** §15 records a near-miss where a
dynamic peak force and a static hold were about to be merged because the numbers looked compatible.
The neck literature is that trap laid three deep.

| Source | What it measures | n / population | Median + spread? | Grade |
|---|---|---|---|---|
| **Catenaccio 2017**, *PM&R*, PMC5545075 | **Peak isometric force, newtons**, microFET2 fixed frame, 4 directions | 157 healthy adults 18–35 (84 M / 73 F), USA | ✅ **Full 5th–95th percentile table by sex and direction** | 🟢 for its own quantity |
| **Liston 2024**, *JOSPT*, PMID 38284387 | Peak isometric force, **newtons** | 136 elite professional male rugby | mean ± SD (ext 429 ± 104 N, flex 275 ± 65 N) | 🟡 elite athletes |
| Garcés 2002, *MSSE*, PMID 11880811 | Peak **torque, Nm**, computerised dynamometer | ~95, four age decades, 12 M + 12 F per cell, Spain | mean ± SD | 🟡 n = 12 per cell |
| Salo/Ylinen 2006, *JOSPT* | Isometric force **N** / rotation **Nm** | 220 healthy **women** 20–59, Finland | mean ± SD, no percentiles | 🟡 women only |
| Chavarro-Nieto 2022, PMC9031103 | Load cell + head harness, **kgf** | 23 semi-pro rugby, NZ | reliability study | 🟡 |
| Vasavada 2001, *Spine* | **Moment, Nm** about C7 | 11 men, 5 women | mean ± SD | 🔴 |
| VALD Norms (ForceFrame) | Percentiles by demographic | large, **not public** | — | 🔴 inaccessible |
| Fitness Volt neck curl | lb "1RM" | **self-declared modelled**, ratio-derived from OpenPowerlifting | — | 🔴 |
| Iron Neck "military standards" | % of body weight | cites an "Army Neck Strength Baseline Study" with **no DOI, no link** | — | 🔴 branded content |

🚨 **THE TEMPTING COINCIDENCE, NAMED SO NOBODY CHASES IT.** Catenaccio's male median extension is
228 N ≈ **51 lbf**; the rugby load-cell figure is 32 kg ≈ **70 lb**; Strength Level's male median neck
extension at 180 lb is **69 lb**. Two of those are within a pound of each other. **They are three
different quantities**: a maximal voluntary isometric push against a pad at one moment arm, a
harness pull at another, and an estimated one-rep maximum with a plate on the forehead at a third.
Merging them would need a moment arm for the pad, a moment arm for the plate, and the assumption
that an isometric peak equals a concentric 1RM — **three unmeasured assumptions stacked**, which is
the *"three estimates multiplied together"* failure `muscle-evidence.js` already names.

⚠️ **Catenaccio is genuinely good data and is worth recording as a 🟢 for what it is.** It is the
best independent reference in the field and it has a real percentile table. **It belongs in
`docs/research.md` on its own scale, cited, and never inside `MUSCLE_LIFTS`.**

### 2.4 The options for the neck

---

#### 🥇 F. CORRECT THE FOUR FALSE SENTENCES, AND RECORD THE PULL — build no rating

**What.** A `docs/research.md` §17 with the tables above, graded **🟡 male / 🔴 female**, and the four
code and doc comments changed from *"nobody publishes neck norms"* / *"there is no route out for it"*
to what is actually true: **a measured page exists for men; the female sample is 55 and 16 and its
body-weight slope runs backwards; the row is not shippable as a sexed pair today.** The summary card
keeps saying Neck cannot be ranked, because it cannot — with a reason that is true.

**Error direction.** ✅ None. No number moves.

**Cost.** A research section and four sentences. **No re-baseline, no demo re-roll, no new exercise.**

**Why first.** A false *permanent* claim in four places is how §0.17 faults are born: the next
session reads *"there is no route out for it"* and stops looking. Whatever Tim decides about a
rating, this is owed.

---

#### 🥈 G. THE FULL CORE TREATMENT, MALE PAGE ONLY, WITH A HARD STOP FOR WOMEN

**What.** `MUSCLE_LIFTS.Neck = keyLift('Neck Curl', [5,26,65,123,194], …)` with `standardQuality`
**below Core's 0.6** — Core has one measured source and no agreeing second; the neck has one measured
source, no agreeing second, an internal contradiction between its two pages, and a σ 2.4× the
bench's — plus a `caveat` in the same shape as Core's, and `RATIOS.Neck` giving Neck Extension and
Neck Harness Extension a ratio off the extension page.

🛑 **AND THE FEMALE HALF IS THE WHOLE PROBLEM.** Three ways out, none of them free:

- **Publish the female table as-is.** 🛑 No. It says a heavier woman should lift less, and the app's
  own allometric scaling contradicts it by 82 % at the top of the range. Shipping it would be a
  number with a source and no meaning.
- **Use the male shape and scale it.** 🛑 That is a modelled ratio — exactly what §14.2 rejected
  Fitness Volt for. **It would be the first invented median in `MUSCLE_LIFTS`.**
- **Rate men and hatch women.** ⚠️ Honest, buildable, and **a sexed capability difference on the one
  screen two people compare on**. `MUSCLE_LIFTS` has no shape for it: `sigmaFor()`, `medianFor()`,
  `percentileFor()` and `buildStrengthShare()`'s 24-combination grid all assume both sexes resolve.
  This is a real architectural change, not a table row, and it means Autumn's map has a hatch where
  Tim's has a colour. **That is Tim's call and he should be asked in those words.**

**Error direction.** For men: an estimate on a standard so wide it is nearly uninformative, and
therefore **flat rather than flattering** — it will read close to Intermediate for almost everybody,
which is its own kind of dishonesty. For women: nothing, or something invented.

**Cost.** A research pull, a `MUSCLE_LIFTS` row, a `RATIOS` block, a sexed-availability mechanism
that does not exist, **and a demo re-roll** — the demo's Neck Curl is the fixture that makes Neck
hatch (`js/demo.js:186`, Open work 25), so Neck becoming rankable moves that fixture's whole point
and re-baselines the golden table. **Adding or changing a demo exercise re-rolls the seeded year and
that is Tim's call, not a side effect.**

---

#### 🥉 H. THE HONEST HALF, WITH NO PERCENTILE — the 2026-09-03 option (c)

**What.** The third part of the abs assessment, which was proposed and never built: on the Neck
panel, *"your heaviest recorded neck work is up 20 % since June."* True, useful, needs no standards,
cannot be mistaken for a percentile because it is not one. No colour, no level, no comparison to
other people.

**Error direction.** ✅ None. It is the user's own recorded numbers.

**Cost.** Small. It also generalises to every hatched muscle for free — including a Calves hatched by
D5, and a Core trained only with planks.

⚠️ **It does not answer "how do I compare", and Tim asked about ranking.** Offered as the thing that
is safe to build while the ranking question is open, not as the answer to it.

---

## 3. What each option costs, side by side

| | Re-baselines golden? | Moves other muscles? | New library exercises? | Demo re-roll? | New judged constant? | Error direction |
|---|---|---|---|---|---|---|
| **A** say why (calves) | ❌ no | ❌ no | ❌ no | ❌ no | ❌ no | **none** |
| **B** raise D5 + extend σ_rep | ✅ **yes, upward** | ✅ **yes — every muscle with 16+ rep sets** | ❌ no | ❌ no (pins move) | ❌ no — σ_rep is measured | **UP only** 🚨 |
| **C** muscle-specific ceiling | ✅ yes, Calves only | ❌ no | ❌ no | ❌ no | ✅ **yes** | UP, one muscle 🚨 |
| **D** time under tension | — | — | — | — | ✅ yes | 🛑 refused (§15) |
| **E** high-rep standard | — | — | — | — | — | 🔴 no source |
| **F** correct the record (neck) | ❌ no | ❌ no | ❌ no | ❌ no | ❌ no | **none** |
| **G** neck rating, male only | ✅ yes | ❌ no | ❌ no (all three exist) | ✅ **yes** | ⚠️ `standardQuality` is judged, as Core's is | flat, not flattering |
| **H** progress, no percentile | ❌ no | ❌ no | ❌ no | ❌ no | ❌ no | **none** |

---

## 4. 🎯 The recommendation, ranked

**If one thing is built, build A.**

1. 🥇 **A — carry the rep gate into `blocked` and split the hatch label.** It is the only option that
   is correct under every one of §1.3's three diagnoses, it changes no number, it costs nothing to
   revert, and it is `docs/direction.md` §3.1's *"have a way to be upfront about it"* delivered
   literally. **It is also the fix for the thing Tim actually saw**: a calf that looked identical to
   a neck for a completely different reason.
2. 🥈 **F — correct the four false "no neck standards exist" sentences and record the pull.** Free,
   owed, and it stops the next session inheriting a wrong permanent fact. Independent of everything
   else here.
3. 🥉 **H — "your heaviest neck work is up N % since June" on every hatched muscle.** Small, safe,
   generalises, and it is the one part of the 2026-09-03 abs assessment that was recommended and
   never built.
4. **B — raise D5 to 20 with σ_rep extended to match.** 🚨 **Offer, do not take.** The argument is
   genuinely good — σ_rep is measured, the discount is automatic, and on calves it moves a
   percentile by five points where the standard is second-widest in the table. **But it makes every
   affected number bigger than what was observed, which is the one move this project has refused in
   writing** (`docs/fatigue-plan.md` §4), and it reaches eight modules that have nothing to do with
   calves. **Tim has to say the words.**
5. **G — the male-only neck rating.** Buildable and I would not build it yet. Not because the source
   is thin (Core's was thin and shipped) but because **it cannot be a sexed pair, and every row in
   that table is one.** Ask him the question in §2.4 first: *rate men, hatch women — yes or no?*
6. **C, D, E — no.** C needs an exception nobody measured; D mixes quantities the map cannot hold; E
   has no source.

**The one I would build: A.** It is the honest reading of what he saw, it is finished in an
afternoon, and it makes the next question — B or nothing — a question he can answer with the screen
in front of him rather than in the abstract.

---

## 5. What I could not answer

- 🚨 **Which of §1.3's three causes is Tim's own calf.** I have no access to his account and
  `Claude Data/` is Claude Code usage telemetry, not training data. **This is one message and it
  should be asked before A is built**, because if his panel already names Single-Leg Calf Raise then
  D5 was never his problem and half of §1 is answering a question he did not ask.
- **Whether Strength Level's neck pages are one movement or several pooled.** The flexion ≈ extension
  result and the 0 lb male Beginner both point at pooling, but the page does not disclose its
  qualification criteria beyond *"implausible data, duplicates, automated submission patterns"* and
  the dataset is proprietary (§11, *"not scrapeable"*). **A 38.8× Elite-to-Beginner span is evidence
  of something and I cannot say what.**
- **Whether the real calf percentile is right at all.** The calf standard's σ_below of 0.601 is the
  second-widest in the file and nothing cross-checks it — §11's two-independent-methods argument was
  never run on an isolation lift. A rated calf may be flat for the same reason the neck would be.
  **Out of scope here and worth its own pass.**
- **Whether the plank / 60-second sit-up norms of §14.6 would also cover the neck.** Not searched.
  Still an open lead, still not a rejected one.
- **Nothing was validated against a human.** No prediction in this document has been checked against
  a real attempt, and `docs/direction.md` §3.3 is explicit that a screen Tim has looked at is
  verified and a predicted number is not.
