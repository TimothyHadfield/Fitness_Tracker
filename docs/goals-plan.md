# Goals — plan

> `docs/vision.md` §1.6. Tim, 2026-08-18. **Nothing here is built.** He asked for the research first
> and for problems to be raised rather than smoothed over, so §3 is the important section.

**Status:** plan · **Written:** 2026-08-18 · **Blocked on:** one decision (§7) and the estimator

**Revised the same day** after Tim's reply — see **§8** (progression, decoupled from the goal, with
the ACSM rule and the numbers behind "adding weight is usually too much") and **§9** (goals revised:
he was right that §2.3 was over-cautious, and the *why progress stalls* section is the best idea in
the exchange).

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

---

## 8. Progression — Tim's answer, and the research behind it (2026-08-18)

Tim, after §3.1: *"You're right about the progressive overload part. The amount that the weight or
reps increase should have nothing to do with your goal. However, it should still have a system…
Most of the time increasing the weight (even by a little) is too much, so a good system could be
increase the reps by 1 for 2-3 weeks, and then increase the weight while going back down in reps."*

**That is double progression, and it is the standing ACSM recommendation almost word for word.**
`docs/research.md` §12. The position stand says: raise the load **2–10 %** when the lifter can do
**1–2 reps over the target on two consecutive sessions** — earn the reps, then take the weight.

### 8.1 ⚠️ Why "adding weight is usually too much" is literally true

The smallest plate is often a **bigger** step than the evidence recommends:

| Working weight | A 5 lb jump is | Inside the 2–10 % band? |
|---|---|---|
| 20 lb | 25.0 % | no — two and a half times the ceiling |
| 40 lb | 12.5 % | no |
| 50 lb | 10.0 % | just |
| 100 lb | 5.0 % | comfortably |
| 225 lb | 2.2 % | bottom of the band |

**A 5 lb jump only enters the recommended band at 50 lb and above.** Below that — most isolation
work, most dumbbell work, every beginner's compounds — there is no honest load increment available,
and **a rep is the only increment fine enough**. Adding one rep to 3×10 at 40 lb is about 3 % more
work; adding 5 lb is 12.5 %.

### 8.2 The rule the app will follow

1. Hold the load and **add reps** up the prescribed range.
2. When the top of the range is hit on **two consecutive sessions**, suggest the **smallest load
   increment that lands inside 2–10 %**, and drop reps to the bottom of the range.
3. Size it by the lift — compounds toward the top of the band, isolation toward the bottom.
4. **When no available increment fits** (30 lb with 5 lb plates), say so and suggest another rep, an
   extra set, or microplates. That is more useful than silently proposing a 17 % jump.
5. **Propose, never impose.** It pre-fills, exactly as the runner already pre-fills last time's
   numbers, and the user can overrule it.

**Nothing in that rule reads the goal, the date, or how far behind anybody is** — which was §3.1's
whole objection, and Tim's own conclusion.

---

## 9. Goals, revised — Tim, 2026-08-18

He pushed back on §2.3's framing, and he is right:

> *"I understand that sometimes people struggle to see results no matter the program and these
> results vary, however I believe strongly that everyone is able to get stronger and if someone isn't
> seeing results there are practical reasons to why this is happening, which we can talk about in the
> goals setting as well. I do want the user to set an achievable goal … that they can use to drive
> their decisions, but it's okay if they struggle to hit this goal. This doesn't mean the site is
> promising them gains."*

**The evidence backs him, and §2.3 was over-cautious in its conclusion.** The 0–250 % spread is real,
but the same literature says **non-responders are rare** — 82 % robust or excellent responders,
5 % poor — and that **individual responsiveness is reproducible**. "Almost everyone gets stronger,
and variation is mostly explained by practical factors" is a fair reading of it. The distinction Tim
draws is the right one: **a target to aim at is not a promise**, and the app was never going to be
the thing that made it one.

### 9.1 So the goals screen gains a section: *why progress stalls*

This is the best idea in the exchange, because every item on the list is something the app has
already researched or can already see:

| Reason | What the app knows | Source |
|---|---|---|
| Volume below the minimum effective dose | **Measured** — it already names muscles under 4 sets/week | `research.md` §6.2 |
| Not training often enough | **Measured** — sessions per week, from history | §6.3 |
| Not training close enough to failure | **Invisible** — no RIR field (D9) | §6.7 |
| Protein below ~0.7 g/lb | **Invisible** | §6.9 |
| Too little sleep | **Invisible** | §6.10 |
| Effort, stress, illness, life | **Invisible** | — |

⚠️ **The honest split is the whole value of the section.** For the first two the app can say "this is
you, and here is the number". For the rest it can only say "these matter and I cannot see them" —
which is exactly what Tim asked for, and it also answers §3.2: the invisible factors get **named
prominently on the goals screen** rather than quietly excluded from a verdict.

### 9.2 The verdict bar is set high

Tim: *"Telling the user they're behind should only happen if it's extremely unlikely they'll be able
to reach their goal."*

Adopted, and it is stricter than a naive reading of the band. **"Behind" fires only when the
estimator's uncertainty band no longer contains any trajectory reaching the target** — not merely
when the point estimate is short. Everything else is **"too early to say"** or **"on track"**.

That asymmetry is deliberate: telling somebody they are behind when they are not is a far worse error
than the reverse. It costs a user who was doing fine; the opposite costs a warning that arrives late.

**This is the hard gate.** It cannot be built on raw session numbers — a working-set e1RM moves
several percent day to day on sleep and timing alone — so it waits on
`docs/strength-estimate-plan.md`. Same estimator as everything else.

---

## 10. Scaling the requirements to the goal — 2026-08-18

Tim ratified the protein recommendation, and asked for the requirements to scale with ambition:

> *"For a more ambitious goal with the most gains, it will need the upper limit (most optimal) for
> protein intake, and sleep, but for a more relaxed goal with moderate gains, they might do alright
> with the lower limit … This lets the user know what they should be willing to sacrifice."*

**The intent is right and it is the best thing about the goals screen** — it turns a goal from a wish
into a trade. But one part of the mechanism does not survive the evidence, and correcting it makes
the point stronger rather than weaker.

### 10.1 ⚠️ Protein is a THRESHOLD, not a dial

Morton et al. found a **plateau at 1.62 g/kg/day** — *"intakes above this did not produce additional
gains."* So protein is not a lever you push further for more growth. It is a bar you clear.

Framing it as "ambitious → 1.0 g/lb, relaxed → 0.7 g/lb" would imply more protein buys more muscle,
which is precisely what that meta-analysis found **not** to be true above the breakpoint. It would be
the same shape of error as the "1 g/lb" folklore the research already corrected.

### 10.2 But the gradient Tim wants IS defensible — for a different reason

The **95 % CI on the breakpoint runs to ~2.2 g/kg (1.0 g/lb)**. That interval is uncertainty about
*where the plateau sits*, not a range of increasingly good intakes. Read correctly, it says: the
threshold is probably 0.73 g/lb, **but it could be as high as 1.0**.

**That is a real reason to aim higher for an ambitious goal, and it is honest:**

- Aim at **0.73** and you are at the best estimate of the threshold — but if the true breakpoint is
  higher, or you miss by 20 % on a bad day, you drop under it.
- Aim at **1.0** and you clear the threshold *even if it sits at the top of the interval*, and you
  still clear it on the days you fall short.

**So the upper end buys certainty and margin, not extra gains.** An ambitious goal wants that
certainty; a relaxed one can live with the best estimate. Same gradient Tim asked for, resting on
something true.

### 10.3 Sleep cannot be scaled — but the sentence got better

⚠️ **Corrected 2026-08-18.** §2.2 called the sleep evidence thin. Tim doubted that and was right: a
second search found **Lamon et al. 2021** — one night of total sleep deprivation cut postprandial
**muscle protein synthesis by 18 %**, with cortisol up and testosterone down. `research.md` §6.10.

So the app can now say something **measured and cited** rather than vague: losing a night's sleep
cuts the rate at which you build muscle by about a fifth.

**The scaling conclusion is unchanged, though.** That is an experiment on *total deprivation*, not a
curve from habitual hours to gains — nothing of the kind exists. So "8 hours for the ambitious goal,
6 for the relaxed one" would still be inventing a curve. Sleep gets the **same sentence at every goal
level**; what changed is that the sentence now carries a number.

### 10.4 What honestly DOES scale with ambition

This is the useful list, and it is longer than protein and sleep:

| Lever | Scales with the goal? | Why |
|---|---|---|
| **Sets per muscle per week** | **Yes, strongly** | A real dose–response with no plateau found (§2.4, `research.md` §6.2) |
| **Time per session** | **Yes** | Follows from the sets |
| **Sessions per week** | **Yes, for strength** | Frequency has a genuine effect on strength (§6.3) — though *not* on growth |
| **Effort — how close to failure** | **Yes** | Hypertrophy improves as sets end nearer failure (§6.7) |
| **Consistency** | **Yes** | An ambitious target tolerates fewer missed weeks |
| Protein | **Threshold, with margin** | §10.2 — the upper end buys certainty, not extra growth |
| Sleep | **No** | §10.3 — no dose–response exists |

⚠️ **This makes the trade Tim described sharper, not vaguer.** The honest sacrifice for an ambitious
goal is mostly **time in the gym and how hard the sets are**, plus **reliably** clearing the protein
bar — not eating progressively more protein. "Do you want to train 5 hours a week to near-failure, or
3 hours comfortably?" is a real question a user can answer. "Do you want to eat 1.0 or 0.7 g/lb?" was
not.

### 10.5 D1, narrowed — ratified by Tim 2026-08-18

> **D26 (proposed):** the app may **recommend** a protein range with its citation. It may not track
> food, hold a food database, or ask what anybody ate.

Tim: *"a protein recommendation is good. It doesn't tell the user to track it on the app or
anything."* Same narrowing shape as D15 → D21: D1's reasoning was about *tracking* — an unwinnable
food-database problem against uncrippled free competitors — and none of that applies to one cited
range on a goal screen. Locks when built, like D24 and D25.
