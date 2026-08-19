# Goals — plan

> `docs/vision.md` §1.6. Tim, 2026-08-18. **Nothing here is built.** He asked for the research first
> and for problems to be raised rather than smoothed over, so §3 is the important section.

**Status:** **PHASES 1, 2 AND 4 BUILT 2026-08-19.** §11 records what Phases 1–2 decided that this
plan did not (the frozen target weight, the ambition calibration, and effort NOT scaling, which
departs from §10.4). **§12 does the same for Phase 4 — progression** — and it is the section to read
before touching a weight suggestion. Phase 3 (the verdict) is still the only thing left, and is still
gated on the estimator.
· **Written:** 2026-08-18

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

**Phase 1 — goals as levels. BUILT 2026-08-19.** Pick a goal (§4A), store it with a start date and a
three-month horizon, show its requirements. No verdict yet, no progression changes.

**Phase 2 — matching. BUILT 2026-08-19.** Sort systems by the goal (§5) — on the goal MUSCLE's weekly
sets rather than on the headline rating; §11.5.

**Phase 3 — the verdict.** On track / ahead / behind / too early to say, computed against the
estimator's band.

**Phase 4 — progression. BUILT 2026-08-19.** Double progression from the last two sessions, proposed
and never imposed (§3.1). It was deliberately last, because it is the only part that can hurt
somebody. **§12** records what the build decided.

---

## 7. Questions for Tim

1. ~~**Narrow D1 to allow a protein *recommendation*?**~~ **ANSWERED** — yes, ratified by Tim
   2026-08-18 and recorded as **D26** (§10.5). Locked by the build on 2026-08-19.
2. ~~**Goals as levels, or as a rate?**~~ **ANSWERED by building it: LEVELS**, which was the
   recommendation. Taken without asking under the working agreement — the app already computes them,
   they are already adjusted for the individual, and they make no prediction at all, which is the
   only framing §2.3 leaves standing. A rate remains buildable later beside them if Tim wants it.

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

---

## 11. Built — 2026-08-19

**Phases 1 and 2 are shipped.** Phase 3 (the verdict) and Phase 4 (progression) are not, and both
absences are stated on screen rather than left as gaps.

| File | What it is |
|---|---|
| `js/goals.js` | The model — pure maths, no DOM, no store, clock passed in. Ambition bands, the requirements, candidate goals, the frozen goal, progress, the stall reasons, the programme ranking |
| `js/views-goals.js` | The tab and its three sub-screens |
| `tests/goals.test.mjs` | **88 assertions, no dependencies** |
| `js/store.js` | A `goals` collection, plus `trainingForMuscle()` — the measured half of §9.1 |
| `firestore.rules` | `goals` added to `knownCollection()` and **deployed** |

### 11.1 The shape

**One active goal at a time.** Every requirement on the screen is stated for *the* goal; two at once
and "how many sets do I need" has two answers, which is the ambiguity this screen exists to remove.
Old goals are kept rather than deleted — whether a target was hit is the most useful thing a person
has when setting the next one.

Two screens to pick: **which muscle**, then **which level**. That gives every combination without a
fabricated shortlist of "3–5 goals", and the second screen *is* that shortlist.

### 11.2 ⚠️ The target weight is FROZEN, and this was not in the plan

A level is a percentile. The weight behind it moves with body weight, with age, and with the
comparison group the user picked (D20). Recomputing it would mean a goal getting quietly harder
because somebody gained four pounds, or easier because they switched the comparison to "everyone".
The weight, the level name and the comparison it was computed against are all stored at the moment
the goal is set, and the picker says so.

### 11.3 ⚠️ Ambition is DERIVED from the goal, and the bands are anchored

A separate "how hard do you want to try" dial beside a target saying "reach Proficient" is two
controls for one decision and they can disagree. Ambition is the size of the jump: the required
increase in estimated max.

The boundaries — 10 % and 25 % — are ours, but not arbitrary. The meta-regressions in `research.md`
§6 put the strength effect of a well-dosed programme at roughly **17–20 % over interventions
averaging 10.4 weeks**, and `js/optimal.js` already reproduces both curves. So under 10 % is below
what those models predict even at the minimum dose; 10–25 % straddles a well-run programme; over
25 % is past the average response in that literature entirely. That calibrates how much the app
*asks of you* and predicts nothing about the reader — §2.3's 0–250 % is exactly why.

⚠️ **A consequence worth knowing before anyone reports it as a bug:** one level is a **12–31 %** jump
in estimated max, so from the exact median there is **no Steady goal on offer at all** — even the
next level up is Committed. The app says so rather than inventing a gentler option that does not
exist. Somebody two percentiles short of the next level does get a Steady one.

### 11.4 ⚠️ Effort does not scale — a deliberate departure from §10.4

§10.4 lists effort as scaling with ambition, and for **hypertrophy** it is right: sets closer to
failure build more muscle. But these goals are **strength levels**, and the same paper found strength
**largely indifferent to reps in reserve** (`research.md` §6.7). Scaling a requirement by ambition on
evidence saying it does not move the outcome would be the same error §10.1 caught with protein.

So effort is stated **once**, at every band, with the split named on screen: near-failure sets clearly
build more muscle, and the strength evidence is largely indifferent to how close you go. Sleep is
likewise identical at every band (§10.3), and protein moves between two values for the reason in
§10.2 — margin, not more growth — and is labelled *"a bar, not a dial"* rather than *"grows with the
goal"*.

### 11.5 Matching (§5) ranks on the goal muscle, not the headline

The rating's two percentages are averages over eleven muscles. A programme rated 85 % for strength is
the wrong answer to "I want a stronger bench" if it gives the chest three sets a week. `rankSystems()`
sorts on the goal muscle's fractional weekly sets against the requirement band, breaking ties on the
overall strength score, and labels each row *fits / more than the goal asks / under / below the
minimum effective dose*. The user's own systems are ranked alongside the ready-made ones — somebody
already following a programme should find out whether it delivers, not be handed a shopping list.

### 11.6 What the tests pin

Two of them are **refusals**, and they are the same shape as the three in `tests/optimal.test.mjs`:

- **Nothing reads the calendar to decide what is asked.** Two goals with identical numbers and start
  dates eleven weeks apart must produce byte-identical requirements, with a companion assertion that
  a bigger *jump* does move the band — so the first one cannot pass vacuously. This fails the moment
  anything starts scaling a requirement by how far behind schedule somebody is, which is §3.1.
- **No verdict.** `goalProgress()` for somebody four days from the end having added nothing must
  carry no key matching `verdict|behind|ahead|status`, and the render suite strips the paragraph that
  explains the missing verdict and asserts the words appear nowhere else on the screen.

Plus: the set bands sit inside published efficiency tiers, protein is the same at Steady and
Committed (proving it is not a dial), 0.73 g/lb converts to the published 1.62 g/kg and 1.0 to 2.2,
sleep and effort text is byte-identical across bands, the stall walk has a **vacuity guard** (the
same walk over adequate training must read OK), and a programme inside the band beats one rated 35
points higher overall.

### 11.7 Two defects the browser found and jsdom could not

Driven over CDP at 360 / 390 / 1180 px in both themes, per `progress.md` §0.6.

- **A multi-word `.tag` split into two pills.** The background and both rounded ends are painted per
  line box, so "grows with the goal" rendered as a chip reading GROWS above a chip reading WITH THE
  GOAL — two unrelated labels. `white-space: nowrap` on `.tag`, app-wide. Confirmed from
  `getClientRects()`, which is the only thing that tells you a chip occupies two line boxes.
- **A phrase in the numeric column crushed the row.** "Within 1–2 reps of failure" in a column sized
  for "7–10" took 300 px and squeezed the label beside it into a five-word-tall stripe. Requirements
  now carry `phrase: true`, and those render under the label instead.

And one bug the unit tests found: `Number(null)` is `0`, which is finite — so "nothing recorded for
this muscle since the goal was set" would have shown an estimate of **zero** and reported the whole
starting weight as a loss.

---

## 12. Progression — BUILT 2026-08-19 (Phase 4)

§8 is the rule and it was followed. This section is what the build had to decide that §8 did not, and
it is the section to read before touching a weight suggestion.

| File | What it is |
|---|---|
| `js/progression.js` | **The whole rule** — pure, no DOM, no store, **no clock of its own**. Rep ladder, the 2-for-2 gate, the smallest honest increment, the lay-off suppression, and the sentence explaining each |
| `js/views-session.js` | The runner pre-fills the suggestion and says why, in one line, on the exercise |
| `js/views-goals.js` | One block on the goal screen saying the goal does **not** set your weights |
| `tests/goals.test.mjs` | 108 more assertions, taking it to **196** |
| `sw.js` | `js/progression.js` precached (a module missing from the list is a module that cannot load offline, and there is a test) |

### 12.1 ⚠️ It is its own module, and that is the safety argument

§3.1 says nothing may raise a weight because a deadline is close. The strongest way to say that is
not a comment — it is a module that **imports nothing from Goals, is handed no goal and no date, and
has no clock of its own**. There is nothing for a deadline to be measured against even if somebody
tried.

Putting it in `js/goals.js` would have put the rule one variable away from the thing it must never
read. Two tests hold the line: one feeds `goal`, `today`, `daysLeft`, `behindBy` and a `progress`
object straight into the options bag and requires the output to be **byte-identical** to the call
with none of them; the other reads the module's own import list and asserts it names neither
`goals.js` nor `store.js`. **Mutation-checked** — adding four lines that double the step when
`daysLeft < 14` flips exactly the first of those and nothing else.

### 12.2 ⚠️ The rep RANGE is inferred, because the app has no field for it

A workout stores a set **count**, not a rep range, so §8.2's "the prescribed range" does not exist
anywhere in the data. It is inferred from what the lifter is actually doing, off a ladder of ordinary
training ranges — **3–5, 6–8, 8–12, 12–15, 15–20** — with the first band whose top reaches your rep
count winning, so a count sitting on a boundary is at the **top** of the lower band. That is what
lets somebody running 3×8 earn a load increase at 8 instead of being walked to 12 first.

**The ladder is ours and is labelled as ours.** What is published is the 2-for-2 rule, the 2–10 %
band, and the position stand's 8–12 RM for novices / 1–12 RM beyond that — the ladder sits inside
those and invents no dose–response. Nothing under 3 reps gets its own band, deliberately: a band
ending at 1 would mean a load increase dropping somebody to a single.

### 12.3 ⚠️ The range comes from the BEST set and the gate from the WEAKEST — and getting that wrong was only visible in a browser

Reps almost always fall across the sets of a working weight. **190 × 6, 6, 4, 3 is an ordinary bench
session, not a failed one.** The first build read one number — the minimum — for both jobs, and the
demo account showed what that does: it told a lifter who had just pressed 190 for 6 that *"the weight
moves once you have hit 5"*, a target they had beaten twice in that same session, and a load increase
would then have dropped them to 3 reps.

So the two numbers do different jobs. `bestAtTop` says **which range this lift is being trained in**,
because that is what somebody can do fresh. `repsAtTop` — the minimum — **gates the load increase**,
because double progression asks every set to reach the top before the weight moves. Pinned as a
regression test with the real numbers from that session.

Every test passed over that defect, and jsdom would have too: the sentence was well-formed and the
markup was correct. Only reading it against real training showed it was wrong.

### 12.4 "Size it by the lift" narrows the CEILING, it never raises the step

§8.2 rule 2 says take the smallest increment inside 2–10 %; rule 3 says size it by the lift. Read as
"compounds take a bigger step" those fight, and the bigger-step reading is dangerous — at 225 lb the
largest increment inside the band is **20 lb**, which is not a step anybody should be handed.

So the lift narrows the **ceiling** and the app always takes the **smallest** increment that clears
the 2 % floor. A compound may go to 10 %; everything else is capped at **5 %**, half the band. That
makes rule 3 bite in the direction that is safe to be wrong in: at 60 lb the same 5 lb plate is a
step for a bench press and **no honest step at all** for a pushdown, which produces §8.2 rule 4's
message instead.

"Compound" is *both* halves of the position stand's own wording — "muscle group size **and**
involvement": a large muscle group (`Chest, Back, Quads, Hamstrings, Glutes, Full Body`) **and** more
than one muscle worked, taken from `volume-map.js`'s published direct/indirect table rather than a
new judgement list. A pec deck is a big muscle worked alone and is sized as isolation. **An exercise
the app has never seen falls through to the smaller step**, never the larger.

A swept assertion covers the whole envelope rather than examples: every lift from 10 to 500 lb, three
exercises, four histories — the heaviest jump proposed anywhere is **10.0 %**, nothing raises a weight
without two consecutive sessions at the top, and nothing lowers a rep target while the load is held.

### 12.5 Two refusals that must not share a sentence

At 30 lb the smallest jump is 16.7 % and is simply past the band. At 60 lb on an isolation lift it is
8.3 % — **inside** the published 2–10 %, refused only by §12.4's narrowing. A single message saying
"2–10 % is the recommended step" would contradict itself on screen in the second case, so there are
two, and a test asserts each says the right thing.

### 12.6 Propose, never impose — and what that looks like

The suggestion is laid over the numbers the runner already pre-fills, **only on the sets at the
working weight** (a lighter set is a warm-up and flattening a ramp somebody built on purpose would be
its own bug), and while the load is held **reps are never lowered** — a set that already beat the
suggestion keeps its own number. The screen says `Suggested: …` with the reason in one line
underneath, and carries **"Use last time's numbers instead"**, a one-tap toggle that edits the list
in place so a set added mid-session is not lost by using it.

⚠️ **It has to stay about three lines, and that was measured rather than judged.** The block sits
between the exercise name and the steppers, so on a 360 px phone the worst case — a superset banner,
a per-exercise note *and* a suggestion, which the demo's Push day happens to have — pushed the
steppers to the very bottom of the pane and put every set below the fold. The sentences were
shortened and the type tightened until the steppers fit; `getBoundingClientRect()` on the sets is
what says so, and a screenshot alone would not have.

### 12.7 What is on the Goals screen, and why anything is

Progression is decoupled from the goal, so the temptation is to say nothing about it on the goal
screen. That would be worse than saying it: somebody who sets a goal and then sees the runner
pre-fill a heavier weight has every reason to assume the two are connected. One block —
*"And the weights themselves"* — states the rule, states that **the goal never touches it and why a
calendar-driven one would be backwards**, and states that it only proposes. The sentences live in
`js/progression.js` beside the rule they describe, so they cannot drift from it.

### 12.8 ⚠️ A clock may SUPPRESS a suggestion. It may never create or increase one.

The first build shipped with a stated gap: two consecutive sessions meant two consecutive sessions of
that exercise however far apart, so after a month off the rule could propose a step up from where you
left off. **That is §3.1's failure arriving from the other side.** §3.1's objection was never that
clocks are forbidden — it was that **time must not make the app ask for more** — and handing somebody
a heavier weight than they have touched in a month does exactly that, whether the trigger is a
deadline or a gap.

The reason it was left open was that closing it appeared to need a clock and an invented deload
number. **It needs neither, if the clock is only ever allowed to withhold.** So:

- `suggestProgression()` takes one temporal fact, `daysSinceLast`, a plain day count **measured by
  the caller**. There is still no clock in the module, no date arithmetic and nothing for a deadline
  to be compared against — the structural test that asserts so still passes.
- Past the threshold it returns **last time's numbers** and one sentence saying why. That is the
  app's behaviour before progression existed. It prescribes **no reduction**, because nobody has
  measured one.
- The check runs **before every other branch**, so no path exists on which a gap reaches the load
  rule at all.

**The asymmetry is asserted as a property, not as cases**, which is what makes it hold whatever
threshold is chosen: across 10 692 calls — every lift from 10 to 500 lb, three exercises, four
histories, nine gap lengths — a gap never produces a suggestion heavier than the same history with no
gap, and never conjures one where there was none. It changes 4 752 of them, so the property is a
result rather than an unread argument. **Mutation-checked:** making a long gap triple the step
instead of withholding it flips nine assertions.

⚠️ **`LAYOFF_DAYS = 21` is ours and the constant says so.** `research.md` §12.4 records that the
position stand "says nothing about what to do after a missed block", and no other source here offers
a threshold. Three weeks rather than two because a fortnight between two sessions of one lift is
inside plenty of people's normal cadence, and a threshold that fires on ordinary training would
withhold the feature from the people using it correctly. **The cost of being wrong either way is one
session at last time's numbers** — which is what makes a guessed threshold acceptable here and would
not make a guessed deload percentage acceptable.

On screen the lay-off note is deliberately quieter than a suggestion — grey rather than accent — and
carries **no "use last time's numbers instead" toggle**, because nothing was proposed and there is
nothing to undo.

### 12.9 Bodyweight movements — and the band is a percentage of what you ACTUALLY lift

Reps-only work was originally declined: the rule was stated in load *and* reps, so a push-up got
nothing. **That is no longer defensible and has been closed**, because body-weight work landed in
`js/e1rm.js` and `js/exercises.js` while this was being built and pull-ups, chin-ups and dips now
rate a muscle through the real pipeline.

- **A movement with no weight field gets "one more rep than last time"** — the same double
  progression with the load lever removed, and the only progression a push-up has.
- **⚠️ A movement where the lifter IS the load gets the ordinary rule, measured against the real
  resistance.** `totalResistance()` in `e1rm.js` is imported, never copied — one body-weight table,
  sourced line by line, not two that drift. Without it, 5 lb on a 25 lb dip belt reads as a **20 %**
  jump and is refused; against ~205 lb of real resistance it is **2.4 %** and is exactly the step the
  position stand describes. Twelve strict pull-ups twice over now earns a belt rather than a
  fourteenth rep, and the sentence names the 205 lb so the percentage can be checked.
- **Barbell, dumbbell and machine work is untouched.** `totalResistance()` returns null for
  everything with no body-weight fraction, and a test asserts the suggestion is byte-identical with
  and without a body weight for three such lifts.
- **No body weight recorded → it degrades to "one more rep"** rather than guessing one.
- ⚠️ **An assist machine runs the other way** — the number entered is help, so adding to it makes the
  set easier, and a load rule there would propose a regression that reads like progress. Nothing in
  the shipped table is flagged `assist` today (asserted, not assumed), and the guard is in place so
  that the day one is, the suggestion degrades to a rep instead of silently inverting.

### 12.10 Still not done

- **The verdict (Phase 3)** is unchanged and still gated on the estimator.
- **Nothing proposes a reduction, ever.** A lay-off withholds; it does not deload. That is a real
  limitation and it is the same one the source has.
- **The gap is measured per exercise, not per muscle or per programme.** Somebody who swapped barbell
  rows for dumbbell rows for six weeks reads as away from barbell rows, because that is what the
  history says.
