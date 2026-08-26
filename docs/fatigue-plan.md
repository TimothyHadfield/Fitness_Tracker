# Within-session fatigue and the strength estimate — plan

**Written 2026-08-24, on Tim's ask**, after he trained a back session in this order — assisted
pull-ups, dumbbell rows, lat pulldowns — and suspected the app was rating his back off the pulldown,
which he did third and could barely load.

> *"I might just have weaker lats than I thought, but I'm pretty sure because Lat Pulldowns have the
> best reliability with determining lat strength, it based my lat strength on my lat pulldown and
> didn't consider the other two workouts much … I want my program to incorporate muscle fatigue in
> its calculation of strength estimation."*

⚠️ **HE IS RIGHT THAT SOMETHING IS WRONG, AND RIGHT ABOUT WHICH LIFT LED.** He is wrong about the
reason, and the real reason is sharper, smaller and more fixable than the one he proposed.

---

## ✅ BUILT 2026-08-24 — Tiers 1 and 2. Tier 3 remains closed.

Tim: *"make a plan and test it out and once you feel good about it deploy it."* Shipped the same day.
**What follows is the plan as written; this section records what shipped and where the plan was
wrong.**

**In `js/store.js`:** `muscleStrength()` walks each session's entries in order and carries a running
per-muscle tally of prior work, counted with `volume-map.js`'s own weights (direct 1.0, indirect 0.5).
⚠️ **Counted AFTER each exercise's own sets**, never before — an exercise does not fatigue itself, and
charging it for its own volume would discount the first exercise of every session. Every observation
now carries `priorVolume` and `fatigueFactor`.

**In `js/muscle-evidence.js`:** `fatigueFactor()` and `FATIGUE_HALF_SETS = 5`, folded into
`evidenceWeight` and into the quality term of `confidenceOf()`. Plus the hint (item 5), which is the
part measured to be worth the most.

**Measured after shipping, on Tim's session:**

```
                        estimate   confidence   leader
  before                  145 lb      0.44      Lat Pulldown  (done third)
  after                   141 lb      0.36      Dumbbell Row
  same three, pulldown first          0.40      Lat Pulldown
```

**And on the demo account's year, which is the check that mattered:** every muscle moves **under
3.5 %** (largest: Forearms −3.4 %), while confidence falls exactly where it should — Biceps
0.83 → 0.69, Forearms 0.60 → 0.48, Shoulders 0.61 → 0.53, Triceps 0.66 → 0.55. Those four are the
muscles trained after compounds. **Eight of eleven muscles are still led by the same fresh lift.**
A safety rail, not a rewrite, exactly as §2 argued it had to be.

### ⚠️ ONE RULE IN THIS PLAN WAS WRONG, and the test caught it

§5 item 3 said **"confidence must not RISE because of a fatigued reading"**. It was written as an
absolute, asserted as an absolute, and **failed** — correctly.

A third reading that lands *between* two that disagree genuinely does tighten the picture. Tim's
three imply 115, 229 and 136 lb; the 136 sits in the middle, so the `agreement` term rises on its own
account and deserves to. **A fatigued reading is weaker evidence, not anti-evidence**, and a rule that
treats it as anti-evidence is wrong in the other direction.

What is asserted instead is the property that is actually provable: **the same reading taken tired
yields less confidence than taken fresh.** End to end the rise is now +0.01 against +0.04 before,
recorded as a measured fact rather than legislated away.

**Mutation-checked, both halves.** Removing the fatigue term from `evidenceWeight` flips five
assertions; counting prior volume *before* an exercise's own sets instead of after flips four.

**Still open:** §4's research question, and the §6 confound — **it is still not established that Tim
is stronger than 145 lb.**

---

---

## 0. What was measured, before anything was designed

His session, reconstructed through the real modules (`tools/`-style probe, body weight 180 lb,
3 sets each; assisted pull-up at 70 lb of assist × 8, dumbbell row 70 lb × 10, lat pulldown 90 lb × 8):

```
  exercise            key-lift estimate   quality   prior direct Back sets
  Assisted Pull-Up          115 lb          0.29            0
  Dumbbell Row              229 lb          0.60            3
  Lat Pulldown              136 lb          0.50            6

  Back rating with all three   145 lb   confidence 0.44   LED BY the lat pulldown
  Back rating without the third 212 lb   confidence 0.40
```

**Adding the fatigued third exercise moved his Back rating down 32 %, and moved his confidence UP.**

⚠️ **The confidence rise is the part that is indefensible on any reading.** Adding an observation you
have reason to distrust must never make the app more certain. It happens because `confidenceOf()`
scores `depth` over the count of admissible evidence and has no notion that some of it is worth less
for a reason `quality` does not capture.

---

## 1. ⚠️ THE ACTUAL MECHANISM — fatigue buys a CREDIBILITY BONUS

This is the finding, and it is not the one either of us expected.

`rateMuscle()` ranks observations by `evidenceWeight = quality × repFactor(reps) × recency × benchmark`
and lets the top-ranked one lead. `repFactor` rewards low reps, because a set near a true maximum is
better evidence of a maximum than a long set:

```
  reps      3     5     6     8    10    12    15
  factor  1.00  0.95  0.95  0.85  0.70  0.45  0.25
```

His two contenders:

```
  Lat Pulldown   quality 0.50 × repFactor(8)  = 0.425   <- leads
  Dumbbell Row   quality 0.60 × repFactor(10) = 0.420
```

**The pulldown leads by 0.005, entirely because he got 8 reps instead of 10 — and he got 8 because he
was cooked.** The app read "few reps" as "near his limit, therefore trustworthy".

⚠️ **SO FATIGUE DOES NOT JUST DEPRESS THE NUMBER; IT PROMOTES THE DEPRESSED NUMBER.** A fatigued set
and a heavy near-max set look identical to `evidenceWeight`: both are few reps. One is few reps
because the weight was heavy; the other is few reps because the muscle was already spent. **The app
has no way to tell them apart, and it currently resolves the ambiguity in the wrong direction.**

Note what this means for Tim's own theory. The app does **not** think a lat pulldown is the most
reliable read on his back — the row family outranks it (`Dumbbell Row` quality 0.60 vs
`Lat Pulldown` 0.50), because the key lift for this muscle is the Barbell Row. It also does not rate
"Lats" at all: **the muscle is `Back`, keyed on Barbell Row.** The pulldown led on a rep-count
coincidence, not on a judgement about pulldowns.

---

## 2. ⚠️ HOW BIG IS THIS? Smaller than it looks, and concentrated in exactly one case

Measured across the demo account's generated year — 52 weeks, two programmes, ~200 sessions:

```
  0 of 11 muscles are rated by a lift that was NOT that muscle's first of the day.
```

**On a well-ordered programme this problem does not arise**, because the heaviest compound goes
first and the heaviest compound is also the highest-quality evidence — order, load and credibility
all agree. Folding a graded fatigue term into credibility moves every muscle in that year by **under
2 %** and moves nine of eleven not at all.

⚠️ **That is not a reason to skip it. It is a reason to size it correctly.** What this is, is a
**safety rail for the sessions where order and credibility disagree** — a third exercise for a muscle,
a lifter who is fried, a rep count that flatters a bad set. Tim hit exactly that case on his first
real session. It should be built as a rail, and it must not be allowed to rewrite well-ordered
histories in the name of fixing badly-ordered ones.

---

## 3. ⚠️ THE THING THAT MUST BE SAID OUT LOUD: a fatigued set is MISSING information, not corrupted

Tim proposed two mechanisms — weight later exercises less, or multiply their load up — and asked
whether it is a combination or something else. The measurement answers it:

```
  TODAY (no fatigue term)                145 lb   conf 0.44   led by Lat Pulldown
  fatigue = 1/(1+prior/3)                139 lb   conf 0.34   led by Assisted Pull-Up
  fatigue = 1/(1+prior/5)                141 lb   conf 0.36   led by Dumbbell Row
  fatigue = 1/(1+prior/8)                143 lb   conf 0.38   led by Dumbbell Row
  drop every fatigued reading outright   115 lb   conf 0.40   led by Assisted Pull-Up

  the SAME pulldown done FIRST at 140 lb 205 lb   conf 0.44
```

**Every re-weighting scheme moves the number by less than 5 lb. Doing the lift fresh moves it by
60 lb.** Re-weighting changes *who leads* and *how confident the app is* — both correct, both worth
having — but it cannot recover a performance that was never observed.

⚠️ **You cannot re-weight your way to a number nobody recorded.** That single sentence reorders this
whole plan: the highest-value intervention is not a correction factor, it is **getting one fresh
observation**, and the app already knows enough to ask for one.

⚠️ **Note also that "drop every fatigued reading" is the WORST option measured** — 115 lb, below
today's answer. His only completely fresh lift was the assisted pull-up, which is his *lowest*-quality
evidence. A binary fresh/fatigued split throws away the dumbbell row, which is the best reading he
has. **Fatigue must be graded, not a flag.**

---

## 4. ⚠️ WHAT WE DO NOT KNOW, and must not pretend to

**A load multiplier — "your 90 lb fatigued pulldown is really 115 lb fresh" — needs an effect size,
and this project does not have one.** It would need to answer: how much is a maximum depressed, per
unit of prior volume on the same muscle, at this rest interval, for this training status? That is a
number with a source or it is invented.

Three reasons it is the wrong first move, in ascending order of importance:

1. The exercise-order literature reports **reps at a fixed load**, not 1RM decrement. Converting one
   to the other is a second inference stacked on the first — the "three estimates multiplied
   together" failure that `muscle-evidence.js` already names in its pull-up note.
2. The effect depends on prior volume, rest, proximity to failure and training status. The app
   records the first two and **deliberately has no RIR field**, so two of the four terms are missing.
3. ⚠️ **It is the only option on the table that makes a number BIGGER than what was observed.**
   Every other mechanism here can only withhold or discount. Rule 5 exists for this: the app does not
   invent numbers, and it especially does not invent flattering ones.

**What DOES exist and is already graded**: `docs/research.md` records the ACSM 2026 stand grading
exercise order at **88 % quality of evidence — the highest of anything in it** — that strength work
belongs at the start of a session. `progress.md` Open work item 3 notes this is the
highest-confidence finding the project has and is *barely used*, because the stand publishes a grade
and not an effect size, so a score penalty would have to be invented.

⚠️ **That is the same wall, and this plan hits it from the other side.** The finding is strong enough
to justify *ordering* and *discounting*; it is not strong enough to justify *arithmetic*.

⚠️ **GOING AND LOOKING FOR THE NUMBER IS PINNED — 2026-08-28.** `progress.md` items 3 and 4 are both
blocked on it, so "one sourced number unblocks two items" makes it look like the highest-leverage
research question in the project. It is not, and this section is why: the literature reports **reps
at a fixed load**, not 1RM decrement, so converting is a second inference on the first; two of the
four terms are not recorded; and it is **the only mechanism on the table that makes a number BIGGER
than what was observed**, which Rule 5 exists to forbid. **The realistic output of the search is a
written "no".**

That is still worth an hour one day — a written "no" closes two items that currently sit open
implying a maybe — but it **builds nothing**, and it should not be offered as the next thing to do.
See the PINNED table in `progress.md`.

---

## 5. The plan, in three tiers

### Tier 1 — free. No invented constant anywhere. **Build this first.**

1. **Record the fatigue context on every observation.** For each set, how many *direct* sets on that
   muscle were already logged earlier in the same session. `volume-map.js` already computes direct
   vs indirect; the runner already stores exercises in order. This is bookkeeping, not modelling, and
   nothing below is possible without it.

2. **⚠️ Remove the spurious credibility bonus — this is the actual bug (§1).** A set that is
   *low-rep* and *light relative to that exercise's own history* and *late in the session for that
   muscle* must not out-rank a fresh set on the strength of its rep count. The app has every term it
   needs: it knows what he normally pulls down. **A near-max set is heavy for that exercise; a
   fatigued set is light for it.** That distinction is free and is the one the rep count cannot make.

3. **Confidence must not RISE because of a fatigued reading.** `depth` currently counts every
   admissible observation equally. Measured on his session: 0.40 → 0.44 on adding the reading that
   made the estimate worse. Whatever else is agreed, this one is indefensible as it stands.

4. **Say it on the muscle panel.** *"Led by a lat pulldown you did third that day, after 6 sets of
   back work."* The panel already names its evidence and its blockers; this is one more line in a
   slot that exists. **Cheaper than modelling it and more honest than silently correcting it.**

5. **⚠️ TURN IT INTO AN ACTION — the highest-value item in this plan.** `raiseConfidenceHint()`
   already exists to say *"the single most useful thing to log next"*. It should say: **"you always do
   lat pulldowns last — do them first once and this reading gets much better."** Measured: that
   single change is worth **+60 lb** on his Back rating where every re-weighting scheme is worth under
   5. And because `rateMuscle()` keeps the **best-ever** estimate per exercise, one fresh session
   fixes it permanently and automatically.

   ⚠️ **This also closes a structural hole nobody has named.** Programme order is usually fixed, so an
   exercise that is *always* third is *always* understated — not for one session, but for as long as
   the programme runs. Best-ever-per-exercise does not save you if the exercise has never once been
   fresh.

### Tier 2 — a judged discount, labelled as one

6. **A graded fatigue factor in `evidenceWeight`**, of the shape `1 / (1 + priorSets / K)`.
   ⚠️ **`K` is a judgement, not a measurement**, and must be commented as such — the same standing as
   `CUSTOM_QUALITY`, `LAYOFF_DAYS` and the rep ladder, all of which are ours and all of which say so.
   Measured at K = 5 on his session: the leader moves from the pulldown to the dumbbell row and
   confidence falls 0.44 → 0.36, both correct. Measured across the demo year: every muscle moves
   under 2 %.

   ⚠️ **It is acceptable BECAUSE it cannot make anything heavier.** Same argument `progression.js`
   makes for `LAYOFF_DAYS`: a guessed threshold is tolerable where the worst case is withholding a
   claim, and intolerable where it could add weight. This one only ever discounts.

### Tier 3 — needs research. **Do not build.**

7. **A load multiplier.** Blocked on an effect size with a source. The research task belongs in
   `docs/research.md` beside the ACSM order finding, and should be scoped as: *is there a published
   decrement in maximal strength as a function of prior same-muscle volume, measured as load rather
   than as reps?* If the answer is no — which §4 suspects — then this tier is closed permanently and
   the plan is Tiers 1 and 2, which is a complete answer on its own.

---

## 6. ⚠️ The confound, stated plainly, because the plan does not resolve it

His three lifts imply **115, 229 and 136 lb** of barbell row. That is a two-fold spread, and **no
fatigue model fixes disagreement of that size.** The app's response — sit near the middle and report
Fair confidence — is defensible.

Two readings compete and the app cannot tell them apart:

- **The fatigue reading**, which is his: the pulldown is low because he was spent, so 145 understates
  him.
- **The conversion reading**: a 229 lb barbell row equivalent, from a lifter who needs 70 lb of help
  on a pull-up, is not internally consistent. `Dumbbell Row` is `per_side`, so his 70 lb dumbbell is
  doubled to 140 lb of total load before a 0.85 ratio is applied. That doubling is deliberate and
  reasoned (`store.js`: comparing the 80 against a barbell row "would make every dumbbell lifter look
  weak") — but whether a one-arm braced row halves cleanly onto a two-arm barbell row **has never
  been checked against anything**, and it is the other candidate explanation for "weaker lats than I
  thought".

⚠️ **DO NOT TELL TIM HE IS STRONGER THAN 145 LB.** Tier 1 makes the app stop promoting the worst
reading and stop being confident about it. It does not establish that the row is right. **The only
thing that settles this is one fresh lat pulldown**, which is item 5 and is why item 5 leads.

---

## 7. What each tier is worth, side by side

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Invented constants | **none** | one, labelled | one, unfounded |
| Effect on his Back rating | 0 lb directly, **+60 via item 5** | +/- 5 lb | unknown |
| Effect on a well-ordered year | none | under 2 % | unknown |
| Can it flatter anybody? | no | no | **yes** |
| Fixes the confidence rise | **yes** | yes | — |
| Fixes the credibility bonus (§1) | **yes** | partly | no |
