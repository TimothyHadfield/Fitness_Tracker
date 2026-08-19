# Goals — plan

> `docs/vision.md` §1.6. Tim, 2026-08-18. **Nothing here is built.** He asked for the research first
> and for problems to be raised rather than smoothed over, so §3 is the important section.

**Status:** plan · **Written:** 2026-08-18 · **Blocked on:** one decision (§7) and the estimator

---

## 1. What Tim asked for

A **Goals** section offering 3–5 strength goals, each stating what it takes: workouts per week, time
per workout, protein per lb of body weight, hours of sleep. Goals run **three months** at a time.
Setting one then does three things:

1. **Workouts** finds a system that fits the goal.
2. **In a session**, weights or reps are raised automatically to keep you on pace.
3. **Goals** tells you whether you are **on track, ahead, or behind**, including when you have not
   been going or have been lifting less than suggested.

It is the most coherent idea on the vision — it joins the rating, the systems and progression into
one loop, and each piece already has a home in the app. Three of the four parts are well supported.
One is not, and it is the third.

---

## 2. What the research says

### 2.1 Protein 🟢

**Morton RW, et al. "A systematic review, meta-analysis and meta-regression of the effect of protein
supplementation on resistance training-induced gains in muscle mass and strength in healthy adults."
*British Journal of Sports Medicine*, 2018.** 49 trials, 1,863 participants.

- Benefit **plateaus at ~1.62 g/kg/day** — the breakpoint above which more protein did nothing
  detectable. **That is 0.73 g per lb.**
- The 95 % confidence interval runs to ~2.2 g/kg/day = **1.0 g per lb**.

⚠️ **So the folklore "a gram per pound" sits at the TOP of the confidence interval, not the middle.**
It is not wrong, it is the conservative end of a range whose best estimate is about three-quarters of
that. Stating **0.7–1.0 g/lb** is honest; stating "1 g/lb" as *the* number quietly presents an upper
bound as a target. This is exactly the kind of popular claim Tim warned is being challenged.

### 2.2 Sleep 🟡 — thinner than it looks

The mechanism is documented — inadequate sleep blunts muscle adaptation and disturbs baseline muscle
protein metabolism (Knowles et al., *J Sci Med Sport*, 2018) — but there is **no meta-analysis giving
a dose–response between hours slept and strength gained**, the way there is for volume or protein.

⚠️ **Consequence: a goal cannot honestly say "you need 8 hours to hit this."** It can say sleeping too
little will cost you, which is a different and weaker claim. Grading it 🟡 next to protein's 🟢 is not
pedantry — it decides how firmly the screen is allowed to word it.

### 2.3 The hard one: can a 12-week gain be predicted? 🔴 for individuals

This is the finding that decides the design.

- Individual changes over a **12-week** programme, in people of the same age doing the same
  training, range **0 % to 250 %** for strength and **−2 % to 59 %** for muscle size.
- **Early progression does not reliably predict later adaptation**, which the authors note
  "challenges the practicality of tailoring training programs based on short-term outcomes."

⚠️ **Population data cannot tell an individual what they will gain in three months.** A goals screen
that offers "+30 lb on your bench in 12 weeks" as an option is making a promise the literature
cannot support for any one person.

**But two findings rescue the idea**, and they point at a better design than the one asked for:

- **Non-responders are rare.** In one 16-week analysis, 82 % were robust or excellent responders and
  only 5 % were poor ones. Almost everyone who trains gets stronger — so a goal framed as *direction
  and effort* is safe even though a goal framed as *a number* is not.
- **Individual responsiveness is reproducible.** Repeat the protocol after detraining and the same
  person responds similarly. **So a person's own history is a good predictor even though population
  data is not.**

**That flips the design.** Goals should not be picked off a table of predicted gains. They should be
calibrated to the user's own measured rate of progress, and only fall back to population ranges
before there is any.

### 2.4 What is already in place

Genuinely good news, and it means most of this is buildable:

- **Volume, frequency and the efficiency tiers** — `docs/research.md` §6, already pulled.
- **The % optimal rating, per goal** — growth and strength are already scored *separately*, which is
  exactly what "find a system that fits my goal" needs. That part is close to free.
- **Seven strength levels**, already adjusted for body weight, sex and age
  (`js/strength-standards.js`).

---

## 3. The four problems

### 3.1 ⚠️ Serious: goal-driven load prescription inverts the causality

> *"when you're in a workout, it will automatically reasonably improve your weights or reps in order
> to be on progress to meet your goal"*

**Load should follow performance and recovery. If it follows a deadline, the app pushes hardest at
exactly the wrong moment.** Somebody who has missed two weeks and is behind schedule would be handed
*heavier* weights than someone on track — when the correct response to a lay-off is to come back
lighter. The same logic pushes harder on the week somebody slept badly, is ill, or is stressed. That
is how people get hurt, and it is the one failure mode in this feature that can do physical harm
rather than merely be wrong on a screen.

Every progression model that works — double progression, autoregulation, RIR/velocity-based — reads
**what you just did** and adjusts from there. None of them read a calendar.

**The fix, and it keeps everything Tim wants:** progression is computed from your last session, as it
should be. The goal never touches the weight. What the goal changes is **what the app tells you about
the gap** — "at this rate you will land around here by November" — which is information rather than
instruction, and is the honest version of the same feature.

Tim's own note in `docs/vision.md` §1.2 already anticipated the other half: *"Does it ever adjust
without asking, or always propose? Silent adjustment is the kind of thing that destroys trust if it
is wrong once."* So: **propose, never impose.** The app pre-fills a suggestion and the user can
change it, exactly as the session runner already pre-fills last time's numbers.

### 3.2 Protein and sleep are invisible, so they cannot enter the verdict

The app cannot see what you ate or how you slept, and is not going to (D1 cut diet tracking, and it
was right — the food-database problem is unwinnable).

⚠️ **So "you're behind" would blame your training for a protein or sleep deficit the app never saw.**
Two of the four levers a goal names as requirements are levers it cannot measure.

**The fix:** protein and sleep are stated as **conditions of the estimate**, never as inputs to the
on-track calculation, and the screen says so — "this assumes you are eating and sleeping enough; the
app cannot see either." That is honest, still useful, and costs nothing.

### 3.3 It collides with D1 — narrowly, and probably resolvably

**D1: "No diet/nutrition — cut. Point users at Cronometer."** A protein target is a nutrition
recommendation.

The distinction that likely resolves it: D1's reasoning was about **tracking** — the food database
cannot be replicated and free competitors are not crippled on it. *Recommending* one number with a
citation is not tracking, adds no database, and is one line on a screen. That is the same shape as
D15 → D21 and the same shape as the D7 discussion: the objection turns out to be about a specific
model rather than the idea.

**It still needs Tim's say-so**, because D1 is locked. Question 1 in §7.

### 3.4 "Behind" will fire on noise without the estimator

A working-set e1RM moves several percent day to day on sleep, food, and time of day alone. A verdict
computed off raw session numbers would tell people they are behind because they had a bad Tuesday.

`docs/strength-estimate-plan.md` exists precisely for this: a **windowed estimate with an uncertainty
band**, and hysteresis so a level does not flap. **"On track / ahead / behind" should be computed
against the band, not the point** — and where the band spans the target, the honest answer is "too
early to say", which is a fourth verdict and the most important one.

⚠️ **This is a hard gate.** Three of the four parts of this feature can be built now. That one cannot,
and it is the same estimator §1.2's second half has been waiting on.

---

## 4. What the goals themselves should be

Given §2.3, **not** a table of predicted pounds. Two framings that survive the evidence:

**A. Reach the next strength level.** The app already places every muscle on a seven-level scale
adjusted for body weight, sex and age. "Get your bench from Intermediate to Proficient" is a real,
individual, already-computed target, and the app already knows the weight that clears it
(`weightForPercentile`). It needs no new science at all.

**B. A rate, not a total.** "Add 2.5 % to your estimated max each month" — expressed as a range, and
recalibrated from the user's own trend once they have one (§2.3's reproducibility finding).

Both dodge the promise problem: neither claims what *will* happen, both state what *would* count as
hitting it.

Each goal then carries its requirements, in the app's own units:

| Requirement | Source | How firmly it can be stated |
|---|---|---|
| Sessions/week and sets per muscle | `docs/research.md` §6, the efficiency tiers | 🟢 firmly |
| Time per session | derived from the set count | 🟢 firmly |
| Protein 0.7–1.0 g/lb | Morton 2018 | 🟢 as a range, never "1 g/lb" flat |
| Sleep 7–9 h | general guidance | 🟡 as "too little will cost you", not a dose |

---

## 5. Matching a system to a goal

The cheapest and best-supported part. The rating already scores every system for **growth** and
**strength** separately, plus days, minutes and stimulus-per-hour. A goal states which of the two it
is about and how much time the user has; the app sorts by the matching score and shows the honest
trade — *"this one gets you 90 % as far in half the time."*

This works today and needs nothing new.

---

## 6. Phases

**Phase 0 — the estimator.** `docs/strength-estimate-plan.md` Phase 0. Nothing about the verdict is
trustworthy without it. Blocked on nothing and already the project's top open item.

**Phase 1 — goals as levels.** Pick a goal (§4A), store it with a start date and a three-month
horizon, show its requirements. No verdict yet, no progression changes.

**Phase 2 — matching.** Sort systems by the goal (§5).

**Phase 3 — the verdict.** On track / ahead / behind / too early to say, computed against the
estimator's band.

**Phase 4 — progression.** Autoregulated from the last session, proposed and never imposed (§3.1).
Deliberately last, because it is the only part that can hurt somebody.

---

## 7. Questions for Tim

1. **Narrow D1 to allow a protein *recommendation*?** No tracking, no food database — one cited range
   on the goal screen. Recommendation: yes, and record it as a new decision the way D21 narrowed D15.
2. **Goals as levels, or as a rate?** §4. Recommendation: **levels** first — the app already computes
   them, they are already adjusted for the individual, and they make no prediction at all.

Neither blocks Phase 0, which is the estimator either way.
