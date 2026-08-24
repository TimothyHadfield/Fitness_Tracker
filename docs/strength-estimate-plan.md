# Estimating strength from ordinary workouts

**Status:** ~~plan, nothing built~~ — **Phase 0 is BUILT, 2026-08-19.** Written 2026-08-16.

> **Phase 0 shipped nothing user-visible and that was the point.** `js/strength-estimate.js` is pure
> maths wired to no screen; `tools/strength-sim.mjs` is the simulator §11.1 asked for;
> `tools/strength-fit.mjs` re-runs every sweep the constants came from; `tests/strength-estimate.test.mjs`
> is 72 assertions, most of them on **measured simulator outcomes** rather than on the code running.
>
> **Headline measurements**, 24 virtual lifters over a known year each:
> **bias +0.68 %** · **RMSE 4.63 %** · **lag 12.1 days** to recognise a genuine gain ·
> **band coverage 95.2 %** at a mean band of **±12.2 %** · **flap rate 0.38 per lifter-year** for
> somebody sitting exactly on a level boundary, the worst case by construction.
>
> **§11 is rewritten with what it found. §12's table is marked. §15 is new** — what this says
> `js/muscle-evidence.js` should change, with the numbers behind it. **§16 is new** — what is still
> not verified, which is more than the numbers above suggest.
>
> Three constants **could not be honestly fitted** and say so in the module: `uReps`, `loadRefDays`
> and `corroborationBonus`. One turned out to be **measurably inert** and is labelled as such rather
> than quietly kept: `positionDecay`, exactly as §3.2 predicted.

**The ask (Tim):** graphs and the body map should work without benchmarks. Default to ordinary
workout sets, use benchmarks too if they exist, and let someone switch to benchmarks-only if they
have enough of them. *"It's important that we make the system mostly accurate and not all over the
place, which is the worry with using normal workout measurements."*

That worry is the whole design problem. This document is mostly about it.

---

## 1. Why this is hard

A benchmark is a deliberate test: fresh, near-maximal, chosen rep count. An ordinary working set is
none of those things. Nine separate things vary between two sets of the same exercise on two days,
and only one of them is "got stronger":

| # | Source of variance | Size | Can we see it? |
|---|---|---|---|
| 1 | **Proximity to failure** — 8 reps with 3 left is not 8 reps to failure | **Huge** (±15–20 % on e1RM) | No. No RIR field, deliberately (D9) |
| 2 | **Warm-up and ramp sets** logged alongside working sets | Huge | **Yes** — from load and order |
| 3 | **Back-off sets** after the top set | Large | **Yes** — same |
| 4 | **Rep count** — e1RM degrades badly above ~10 reps (D5, D11) | Large | **Yes** — we know the reps |
| 5 | **Within-session fatigue** — set 5 vs set 1 | Moderate | **Yes** — set index |
| 6 | **Exercise order** — bench after squats | Moderate | **Yes** — entry index |
| 7 | **Deliberate light/deload weeks** | Large | Partly — looks like a drop |
| 8 | **Plate granularity** | Small | Yes, ignorable |
| 9 | **Day-to-day readiness** (sleep, food, stress) | Moderate | No |

Only #1 and #9 are genuinely invisible, and both are *bounded and one-sided*. Everything else we
already have in the data and have simply not been using.

### The insight the whole design rests on

**The noise is one-sided.** A set can be easier than maximal — submaximal effort, fatigue, a warm-up,
a bad day. It can *never* be harder than what the lifter was actually capable of that day.

So every observed e1RM is a **lower bound** on true strength. That single fact settles most of the
design:

- **Averaging is wrong.** The mean of a day's sets is biased downward by every warm-up and back-off
  in it, and the bias varies with how someone happens to structure their session. Two lifters equally
  strong would read differently purely from programme style.
- **The maximum is the right family of estimator** — we want the *upper envelope* of the observations,
  not their centre.
- **A dip is weak evidence, a peak is strong evidence.** A light week means nothing; a heavy single
  means a lot. The estimator should rise readily and fall reluctantly.

This is the opposite of how you would treat symmetric measurement noise, and it is why a naive
"plot every set" chart looks like it swings wildly — it is showing the noise floor, not the signal.

---

## 2. What gets built

Three layers, each testable on its own.

```
observations ──► per-set confidence ──► per-day best ──► windowed estimate ──► level + band
   (raw)            (§3)                  (§4)              (§5)                 (§6)
```

A new **pure-maths module**, `js/strength-estimate.js`, with no DOM and no store dependency — the
same pattern as `e1rm.js` and `strength-standards.js`, which is the pattern that has caught real bugs
in this project because it is fully testable headlessly.

---

## 3. Per-set confidence

Each observation gets a confidence `c ∈ [0, 1]`: *how much does this set tell us about this person's
maximum?* Not "how accurate is the number" — how **informative** it is.

### 3.1 Gate first — what is not evidence at all

- **> 15 reps** → rejected outright. D5 already says we do not normalise above 15, and `canNormalize`
  already refuses it. The estimator inherits that rather than inventing a second rule.
- **Warm-up ramp sets** → rejected. Detection: *a set that comes before the day's heaviest set for
  that exercise **and** is lighter than it.* This is exact for normal ramping, and correctly does
  nothing for reverse-pyramid training (where the heaviest set is first, so nothing precedes it) —
  those later lighter sets are back-offs, which are down-weighted rather than rejected.
- **Zero/blank sets** → already filtered.

### 3.2 Then weight what remains

`c = f_reps × f_load × f_position`, then clamped to `[0.02, 1]`.

**`f_reps` — how far the formula is extrapolating.** The Marzagão curve is trustworthy at low reps
and degrades above ~10 (D11, research.md §1).

| Reps | 1–3 | 4–6 | 7–8 | 9–10 | 11–12 | 13–15 |
|---|---|---|---|---|---|---|
| `f_reps` | 1.00 | 0.95 | 0.85 | 0.70 | 0.45 | 0.25 |

**`f_load` — was this set anywhere near a real effort?** Compared against the lifter's own recent
best e1RM on that exercise, `ratio = e1rm(set) / best_recent`:

| ratio | ≥ 0.97 | 0.92–0.97 | 0.85–0.92 | < 0.85 |
|---|---|---|---|---|
| `f_load` | 1.00 | 0.75 | 0.40 | 0.10 |

A set at 80 % of what you did last week tells us almost nothing about your maximum — it is not
evidence you got weaker, it is just not evidence.

**`f_position` — fatigue.** Set index within the exercise and exercise index within the session:
`f_position = 0.97^(setIndex) × 0.97^(exerciseIndex)`. Deliberately gentle. This is the
**weakest-justified factor** in the model and the first one to drop if simulation says it does not
earn its place.

> ⚠️ **MEASURED 2026-08-19: IT DOES NOT EARN ITS PLACE.** Setting the decay to 1.00 — deleting the
> factor outright — moves RMSE by 0.00 pp, bias by 0.01 pp, lag by 0.3 days and the flap rate not at
> all. It is kept at 0.97 because the direction is certain and it costs nothing, and it is now
> **labelled inert in the module** so that nobody later assumes it is load-bearing. This paragraph
> stands as written: the prediction was right.

**Benchmarks** bypass `f_load` and `f_position` entirely and take `c = f_reps`. That is what a
benchmark *is*: a deliberate fresh test. It is also how benchmarks stay the gold standard without
needing a separate code path or a separate chart.

### 3.3 Corroboration

Three sets at 225×5 is much stronger evidence than one 225×5 followed by two at 185. So a day's
confidence rises with agreement:

`c_day = c_best × (1 + 0.15 × min(corroborating, 2))`, capped at 1

where *corroborating* counts other admissible sets within 3 % of the best set's e1RM. Repeated
performance is the closest thing we have to a substitute for the missing RIR field: you do not hit
your top load three times if the first one was maximal.

---

## 4. One value per day

Per exercise per day, take the **admissible set with the highest e1RM**, carry its `c_day`, and
record how many sets corroborated it.

Not the mean (§1). Not "the set at the target rep count" — that is what `normalizedSeries` does today
for display, and it is right for *showing a measurement* but wrong for *estimating a maximum*.

The day's value is `x = e1rm(best set)`, in pounds, always. Display conversion (kg, rep-normalised
equivalent load) happens later and never inside the estimator.

---

## 5. The windowed estimate

Given daily values `(t_i, x_i, c_i)`, estimate strength at time `T`.

**Window:** trailing 42 days. If that contains fewer than 3 daily values, widen to 84, then 180,
recording that we did — a wider window means a staler estimate and the band must say so.

**Estimator: confidence-weighted best-of-N.**

1. Take the window's daily values, weight each by `c_i × recency_i` where
   `recency_i = 0.5^(age_days / 28)` — a four-week half-life.
2. Sort by `x` descending; take the top `N = min(3, count)`.
3. Estimate = weighted mean of those `N`.

A plain maximum would let one mistyped 500 lb permanently define someone's strength. A plain mean
would be dragged down by every easy day. Best-of-3 is the standard robust upper estimator and it is
easy to explain to a user, which matters — anything in this app that cannot be explained in one
sentence should not ship.

> **MEASURED 2026-08-19.** Step 3 is no longer a plain weighted mean: the top `N` are **winsorised**
> into `[median/(1+k), median×(1+k)]` at `k = 0.25` first. See §15.1 for why and for the numbers.
>
> `N = 3` was confirmed against `N ∈ 1..5`. `N = 1` is the fastest (lag 7.2 days) and the most
> biased (+2.72 %), and under one +50 lb slip its RMSE is 11.45 % against 7.50 % at `N = 3`.
> `N = 5` reverses it: bias −0.54 % but lag 22.0 days and band coverage down to 91.7 %. `N = 3` is
> the only value with bias under 1 %, coverage on target and lag inside a fortnight.
>
> The **42-day window** and the **28-day half-life** were both swept. The window is a monotone
> bias-against-lag trade with no minimum in it — 21 days reads 0.63 % low and lags 17.4 days, 84 days
> reads 1.71 % high and lags 11.7 — and 42 is where bias is still under 1 % and lag within a day of
> its best. ⚠️ **The half-life barely matters at all**: across 14/21/28/42/56 days the whole range
> moves RMSE by 0.06 pp and the flap rate by one flap per lifter-year. The window and the best-of-N
> are doing the work it looks like it is doing.
>
> The **2 %/week fall limit** turned out to have a small numerical effect — across the deload the
> estimate reads 1.28 % below truth with it and 1.64 % without — and is kept for a structural reason
> instead: 0 %/week is a **ratchet**, reading 2.05 % high across the year and unable to report a
> genuine detraining loss at all.

**Rising vs falling.** Because dips are weak evidence, the estimate is allowed to rise immediately
but falls at a limited rate — no more than ~2 % per week of no confirming evidence. Strength genuinely
does decay, but not in the pattern of "took a light week". Without this, every deload reads as a
regression and the graph looks exactly as unstable as Tim is worried about.

**Staleness.** If nothing admissible has been logged for that exercise in 6 weeks, the estimate stops
being presented as current: it keeps its value but is labelled *as of <date>*. It is never silently
dropped, and never silently held forever either.

---

## 6. The uncertainty band — the part that solves the real problem

The estimate ships as a **range, not a number**:

```
band = estimate × (1 ± u),    u = u_base / sqrt(effective_n) + u_stale + u_reps
```

- `effective_n` = sum of the contributing confidences — one good benchmark counts more than four
  sloppy sets
- `u_stale` grows with the age of the newest contributing observation
- `u_reps` grows when the estimate leans on high-rep sets

This is what makes the system honest rather than merely stable. **When the evidence is thin the app
says so instead of guessing precisely**, which is the same principle already applied to
"of people who lift" (D15) and to marking estimates without a marker (Rule 5).

### 6.1 Levels stop flapping

The body map's visible symptom of instability would be a muscle changing colour week to week. Two
rules fix it:

1. **Band-aware levels.** A level is only asserted when the whole band sits inside it. When the band
   straddles a boundary the UI says *"Intermediate, close to Proficient"* rather than picking one.
2. **Hysteresis.** Once a level is displayed, it only changes when the new estimate clears the
   boundary by more than half the band width. Standard practice for any thresholded display, and
   the direct answer to "not all over the place".

> **MEASURED 2026-08-19, and both rules came out differently from the plan.**
>
> **⚠️ Band-aware levels are the NORMAL case, not the exception, and Phase 2 has to be designed for
> that.** With an honestly-sized band the whole band sits inside one level only **8.5 %** of the
> time. That is structural rather than a tuning failure: the seven-level scale puts 13–16 % between
> adjacent boundaries in the middle of its range and the band is ±12 %, so a band that fits inside a
> level is the exception by arithmetic. A body map that refuses to colour a muscle until it is
> certain would be grey nine times in ten. **The design consequence: a colour is a point estimate
> with its confidence already shown by desaturation (D19), and the DETAIL PANEL is where the range
> gets named.** Refusing to name a level at all is only right where the band spans three or more of
> them — which is exactly the single-high-rep-set case in §15.2.
>
> **Hysteresis is 0.25 of the band half-width, not 0.5**, and the reason is the cost nobody had
> measured: how long a REAL level change takes to appear.
>
> | hysteresis | flaps per lifter-year (on a boundary) | days to show a genuine level change |
> |---|---|---|
> | 0 | 3.67 | 15.0 |
> | **0.25** | **0.38** | **23.2** |
> | 0.5 | 0.00 | 32.5 |
>
> 0.38 flaps a year is one spurious colour change every three years for the worst case by
> construction; an ordinary lifter flaps zero times at any of these. Buying the last 0.38 costs nine
> more days of silence when something genuinely happened, and a goal in this app is twelve weeks
> long. The shipping rule adopted is **"under half a flap per lifter-year, then minimise lag"**.
>
> **The band's own constants.** `uBase = 0.10` is fitted to coverage — the ±u band contains the true
> 1RM 95.2 % of the time — not to how confident it looks. `uStalePerWeek = 0.004` past the window,
> measured by freezing an estimate on a lifter's last training day and walking it forward: mean
> absolute error runs 4.62 % at one week, 4.25 % at four (it *improves*, because the estimator's own
> low bias is briefly cancelled by real gains), 6.02 % at twelve. The late slope, 0.39 pp a week, is
> what the constant tracks, because staleness only matters in the tail.

---

## 7. What this means for D14

D14 says graphs never mix benchmarks with workout sets — one source at a time, benchmarks by
default. It exists because Tim reported a real bug: a workout set sat far off his benchmark trend,
the displayed point flipped between sources as the rep target changed, and one-point-per-day silently
discarded the loser.

**Every one of those three was a symptom of plotting raw sets from two populations on one line.**
The fix at the time — separate the sources — treated the symptom. This plan treats the cause:

| D14's problem | How the estimator removes it |
|---|---|
| Two sources swing wildly on one line | Nothing raw is plotted as the trend. The trend is an upper-envelope estimate; a benchmark is simply the highest-confidence observation feeding it |
| The shown point flipped as the rep target changed | The estimator works in e1RM, independent of the display rep target |
| One point per day discarded the loser | Aggregation is explicit and confidence-weighted, and corroborating sets *raise* confidence rather than being thrown away |

**Proposed D18** (needs Tim's ratification, because it narrows a locked decision):

> D14 governs **raw per-set plotting**, which remains one-source-at-a-time. It does **not** govern
> the strength estimate, which draws on all admissible evidence weighted by confidence, because the
> failures D14 was written to prevent are structural to raw plotting and absent from the estimator.

If Tim would rather not touch D14, the fallback is to ship the estimator as an additional, clearly
labelled chart mode and leave the existing per-source charts untouched. That is strictly more work
and a worse product, but it is safe.

---

## 8. Settings

Data screen → settings, per D9 (progressive disclosure — a default that works, an option for someone
who wants it):

| Option | Behaviour |
|---|---|
| **All evidence** *(default)* | Workout sets and benchmarks, confidence-weighted |
| **Benchmarks only** | Estimator runs on benchmarks alone. For someone who tests regularly and wants nothing else in the picture |

Stored as `settings.strengthEvidence = 'all' | 'benchmarks'`. Two options, not three: "top sets only"
is tempting but the confidence model already does that automatically and better, and an option whose
effect a user cannot predict is worse than no option.

When *All evidence* is on and benchmarks exist, the detail panel still names what the estimate leans
on most — the source is never hidden (Rule 5).

---

## 9. The graph

- **Estimate line + band.** The band is the point, not decoration.
- **Measured sets as markers**, opacity scaled by confidence. Rule 5 holds: a marker means measured,
  the line is an inference, and the two must not look alike. The band is what makes the line
  obviously an inference.
- **Benchmarks visually distinct** — they are the gold standard and someone should be able to see at
  a glance whether the line is resting on tests or on ordinary training.

The existing rep-normalised view stays exactly as it is. It answers a different question ("what have
I actually lifted at 5 reps") and it answers it well.

---

## 10. Evidence from other exercises — BUILT 2026-08-17, and the ordering here was wrong

> **This section was written as "later, and the weakest part of the plan". Reality reversed it.**
> Tim trained every muscle for a week and the body map recorded ONE number, because a muscle was
> ranked by a single named lift and he had done hammer curls rather than barbell curls. The stability
> problem this document is mostly about is real, but it is a problem you only get to HAVE once there
> is something on the screen. Flexibility turned out to be the blocker; stability was the refinement.
>
> Built in `js/muscle-evidence.js` (D19). It follows most of the discipline below — a substituted
> lift is named in the UI, carries a lower confidence, and a compound may only stand in for a
> secondary muscle that has NO direct evidence. It breaks one rule deliberately: substitutions do
> blend with direct evidence within a muscle, because "hammer curl" and "barbell curl" are both
> direct biceps work and picking one to ignore would throw away real information.
>
> What did NOT come with it is §11 — there is no simulator, and the constants in that module are
> reasoned rather than fitted. **That is now the top open item.**

### The original text, kept because its warning still stands


The body map still ranks each muscle by **one** key lift. Someone who only ever dumbbell-benches gets
a grey chest forever. The obvious extension is cross-exercise equivalence — estimate bench from
dumbbell bench via a ratio.

**Flagged as the weakest part of this plan, and deliberately last.** research.md §1 (Nuzzo 2024)
found exercise type is the *only* meaningful moderator of the reps↔%1RM relationship, which is
precisely the finding that makes fixed cross-exercise ratios shaky. Individual ratios vary widely
with leverages and training history.

If built, the rules are: a substituted lift may only ever **unlock a muscle that has no direct
evidence**, never override or blend with direct evidence; it carries a much wider band; and the UI
names the substitution outright. Otherwise this becomes a machine for confidently wrong numbers,
which is the one thing this project has consistently refused to be.

---

## 11. How we will know it works — §11.1 BUILT 2026-08-19

Tuning the constants in §3 by eye would be guessing with extra steps. Two checks, both buildable:

### 11.0 What the simulator actually measured

`tools/strength-sim.mjs` · `tools/strength-fit.mjs` · `tests/strength-estimate.test.mjs`.
Deterministic throughout — never `Math.random()`, for the same reason `js/demo.js` never uses it: a
fit you cannot reproduce is a fit you cannot check.

| | measured | note |
|---|---|---|
| **Bias** | **+0.68 %** | positive by design. An estimator reading unbiased off submaximal work would be inventing the reps left in reserve |
| **RMSE** | **4.63 %** | against a known truth. The naive "average every set in the last six weeks" reads **27.4 %** on the same logs |
| **Lag** | **12.1 days** | mean over +3 / +6 / +9 % thresholds, requiring the estimate to hold the level for a week |
| **Level lag** | **23.2 days** | days from a true level change to the display following it |
| **Band coverage** | **95.2 %** | at a mean band of ±12.2 % |
| **Flap rate** | **0.38 / lifter-year** | on lifters placed EXACTLY on a level boundary with a near-flat truth. **3.67 with hysteresis off**, which is the vacuity guard |
| **Deload** | **−1.28 %** | worst reading across the three-week deload and the fortnight after |

**⚠️ Two methodological findings that cost time and are worth not rediscovering.**

1. **Flap rate cannot be fitted on an ordinary ensemble.** Level bands are 15–25 % wide in pounds
   and an ordinary lifter spends most of a year in the middle of one, so a whole simulated year
   produces a handful of level changes and *every* candidate constant scores "about zero". The
   measurement only has power where the failure happens, so there is a second ensemble
   (`boundaryEnsemble()`) built by construction: base 1RM placed on a boundary, a year that moves
   ±2 %. Every level change such a lifter sees is a flap.
2. **Flap rate alone can be driven to zero by an estimator that never moves**, so it is never
   reported without **level lag** beside it. Any smoothing constant — half-life, best-of-N,
   hysteresis — buys stability by refusing to move, and the first version of the level-lag metric
   silently *dropped* the runs where the display never caught up, which made a heavy-handed
   hysteresis look free. Censored runs now count at their full length.

### 11.1 A simulator

Generate a virtual lifter with a **known** true 1RM curve — including a plateau, a deload, and a
build — then simulate realistic logs from it: warm-up ramps, top sets, back-offs, RIR varying 0–4,
occasional missed sessions, occasional 12–15 rep days. Run the estimator against the known truth.

Measures:

- **Bias** — does it systematically read high or low?
- **RMSE** — how far off is it?
- **Flap rate** — how often does the *displayed level* change while true strength did not? This is
  the direct measurement of Tim's worry, and the one to optimise for.
- **Lag** — how many sessions to recognise a genuine gain?

This is what the constants get fitted to. It is the same approach that produced the σ = 0.32 fit and
the k-floor monotonicity assertion, both of which caught real errors.

> **BUILT, and the one thing the plan did not anticipate is what the simulator can and cannot
> settle.** It has ground truth for everything the app can *see* — warm-ups, back-offs, reps in
> reserve, fatigue, missed sessions, readiness — because those are generated. It has **no** ground
> truth for two things it must assume:
>
> - **The e1RM formula is correct by construction inside it.** The same Marzagão curve generates the
>   weights and reads them back, so "typically within 4.6 %" is a statement about this model and not
>   about a human. `docs/research.md` §1.3 says the formula's absolute accuracy was never validated.
>   §11.2 is the only thing that could turn any of this into a claim about a person.
> - **`REP_CURVE_SIGMA` — how far one individual's own reps↔%1RM relationship departs from the
>   population's — is a guess.** Nuzzo 2024 says exercise type is the only meaningful moderator,
>   which says the spread is real and roughly how it is structured, but nobody has published its
>   width for a 272-exercise library. Everything scaling with it is reported as a **sensitivity**
>   and never as a fit. §15.2 is the case where that bites.

### 11.2 Backtest against Tim's own data

Once there are enough benchmarks: hide them, estimate from workout sets alone, and compare the
prediction to the held-out benchmark. That is a real measurement of "does this work on a human",
not a simulation. It also gives an honest headline number — *"typically within X % of a tested max"* —
which is exactly the sort of claim this project should be willing to state and defend.

---

## 12. Phasing

| Phase | What | Risk |
|---|---|---|
| ~~**0**~~ | ~~`strength-estimate.js` — pure maths, plus the simulator and its tests. No UI, nothing user-visible.~~ **DONE 2026-08-19.** `js/strength-estimate.js` · `tools/strength-sim.mjs` · `tools/strength-fit.mjs` · `tests/strength-estimate.test.mjs` (72 assertions, mutation-checked) | None. Nothing shipped |
| **1** | Extend `weightRepObservations` to carry set index and exercise index (needed for §3.1 and §3.2) | Low, additive. **⚠️ Bigger than it reads** — see below |
| **2** | Wire the estimator into the **body map** — band-aware levels, hysteresis, source named | Medium — changes what a colour means. **§6.1's measurement changes the design**: the band fits inside one level only 8.5 % of the time, so the hedged reading is the normal case |
| **3** | The **setting**, and the estimate line + band on the graph | Medium |
| **4** | Cross-exercise evidence, if the backtest justifies it | High — may be dropped |
| **5** *(new)* | **§11.2's backtest against real held-out benchmarks.** Now the highest-value item after Phase 1, because three of Phase 0's constants are conditional on assumptions only real data can settle | Low to run, high in what it might overturn |

Phase 0 is worth doing regardless: it is inert, it is where all the risk actually lives, and the
simulator tells us whether the rest is worth building before any of it is user-visible.

> **What Phase 0 changed about the phases after it.**
>
> **Phase 1 is the real blocker and it is not one line.** `js/strength-estimate.js` takes per-set
> `setIndex` and `exerciseIndex`, and nothing in `store.js` carries them today. Without them the
> warm-up gate cannot run — and the warm-up gate is not a refinement: the naive alternative reads
> **27.4 % RMSE against 4.63 %**. Everything measured here is conditional on Phase 1 landing
> properly.
>
> **Phase 2 gained a hard prerequisite.** The plausibility screen (§15.3) has to run *before* the
> estimate reaches a screen, and it needs a per-exercise standing estimate to screen against, which
> is a sequential walk rather than a per-day map. It is cheap but it is not optional: without it one
> ×10 fat finger biases a lifter's reading by 343 % for months.
>
> **Phase 5 is new.** §11.2 was written as a nice-to-have. It is now the thing that would replace
> three guessed constants with measurements, and it needs nothing but enough benchmarks.

---

## 13. Risks, stated plainly

- **e1RM absolute accuracy was never validated** (research.md §1.3 — it was optimised for internal
  consistency). Everything here inherits that. It is fine for *trend* and for *ranking a lifter
  against themselves*; it is a stronger claim when converted to a percentile against other people.
  The band helps but does not remove this.
- **`f_load` is self-referential.** Someone who never trains hard has a low recent best, so all their
  sets look like top efforts and confidence is overstated. Mitigation: the absolute rep gate still
  applies, and confidence is capped hard while the observation count is small.
- **RIR is invisible and always will be** under D9. The corroboration term (§3.3) is a partial
  substitute, not a fix.
- **A long deload will eventually age out of the window** and the estimate will fall. The staleness
  label (§5) makes that visible rather than silent, but it will still look like a drop to someone not
  reading the label.
- **This adds a second way to answer "how strong am I"** alongside the existing per-source charts.
  Two answers that disagree slightly is a real UX risk and needs watching.

---

## 14. Open questions for Tim

1. **D14** — ratify D18 (§7), or keep the estimator as a separate labelled mode?
2. **Does the band show as a number?** *"225 lb ±6 %"* is honest and might read as noise to someone
   who just wants a number. Alternative: show the band graphically and only give the number on tap.
3. **Should a level ever go down?** Hysteresis and the fall-rate limit make it rare, but a muscle
   dropping from Advanced to Proficient after a layoff is correct and will still feel bad.

> **Phase 0 sharpened two of these rather than answering them.**
>
> On **(2)**: the band is not a garnish. It is ±12.2 % on average and ±21 % off a single high-rep
> set, and §6.1's measurement says it sits inside one level only 8.5 % of the time — so hiding it
> behind a tap would hide the main thing the estimate has to say. That is an argument for showing it,
> and it is Tim's call whether as a number or as a shape.
>
> On **(3)**: measured, a level going down is genuinely rare. Across a year with a three-week deload
> in it, the estimate's worst reading is 1.28 % below the truth, and an ordinary lifter records zero
> spurious level changes. When a level does drop it will be because strength dropped. That does not
> make it feel better, which is a wording question rather than a modelling one.

---

## 15. The three residuals in `progress.md` §9 — answered with measurements

Written 2026-08-19. **Phase 0 changed nothing user-visible and nothing in `js/muscle-evidence.js`.**
These are recommendations with the numbers behind them, for whoever owns that file next.

### 15.1 Should the aggregate be robust to an outlier? — **YES, and it is free**

**The problem.** `rateMuscle()` averages the top three observations by a credibility-weighted mean,
so an outlier moves the answer by its weight share no matter how implausible it is. §9's example: a
15-rep face pull converting to roughly twice the credible reading still adds ~9 % to a shoulder
rating after losing the top seat.

**The fix.** Winsorise before the weighted mean: clip every contributing value into
`[median/(1+k), median×(1+k)]` around the credibility-weighted median, at **k = 0.25**. The outlier
keeps its direction and its vote; what it loses is the ability to drag the answer an unbounded
distance because it is large.

**Why winsorise rather than trim.** Trimming throws the observation away, and a genuine PR is
indistinguishable from a typo at the moment it arrives (§15.3). Clipping keeps it pushing the right
way while it waits to be corroborated. **Why not the median outright:** §1 — the estimator wants the
upper envelope, and a median of the top three is a step toward the centre.

**k = 0.25 is pinned from both sides.** *Floor:* the honest spread of one lift's daily bests around
their own window median runs to ×1.204 at the 99.99th percentile (n = 16,203), so anything below
k ≈ 0.21 clips days a lifter genuinely had. *Ceiling:* across 200 simulated muscles rated by three
exercises against a known truth, the worst error falls from **19.8 % to 7.5 %** at k = 0.25 and only
to 9.2 % at k = 0.35.

**It costs nothing.** With no outlier present, winsorising at 0.25 still *improved* RMSE
(4.59 % → 3.86 %). On the single-exercise ensemble it changes the answer not at all. On §9's
shoulders case the nudge goes **+3.9 % → +1.0 %**.

> **Recommendation for `js/muscle-evidence.js`:** replace the final weighted mean in `rateMuscle()`
> with `robustAggregate()` from `js/strength-estimate.js`. It is a two-line change, it is
> measurably free on clean data, and it bounds the residual. ⚠️ **Not applied by Phase 0** — that
> file is owned elsewhere this wave and Phase 0 ships nothing user-visible.

### 15.2 How far may a high-rep isolation set be extrapolated? — **NOT SHRUNK. BANDED, AND THE LEVEL REFUSED**

**The problem, reproduced exactly.** A seated calf raise at 180 × 12, converted at the 0.62 ratio,
estimates a **417 lb** standing calf raise. The Elite boundary sits at 406. It reads Elite off one
set.

**The obvious fix does not work, and knowing why is the result.** Shrinking the estimate toward a
population prior needs the spread of e1RM error at 12 reps, and the simulator says that number is
**entirely determined by an assumption nobody has measured** — the extra log-SD at 15 reps over 1 rep
comes out at 0.01, 0.07 or 0.12 for a per-lifter rep-curve spread of 0.05, 0.10 or 0.15. A shrinkage
constant fitted to that would be a guess wearing a measurement's clothes.

**What is honest instead.** Widen the band and refuse the level. Off that single 12-rep set the
module's band is **±21.3 %**, which spans **three levels** — the display is *"somewhere between
Advanced and Elite"*, and `displayLevel()` returns `certain: false` and `asserted: null` so the UI
cannot accidentally say Elite. A two-rep set off the same history carries ±11.8 %, so the width is
coming from the rep count rather than from having one observation.

**A measured aside worth keeping.** The e1RM of a *low*-rep set is more biased DOWNWARD by unknown
reps-in-reserve than a high-rep one (−7.4 % at 1 rep against −2.8 % at 15), while being far less
dispersed. The upper-envelope design handles the bias; the confidence weighting handles the
dispersion. They are genuinely two different problems and it is worth not conflating them.

> **Recommendation for `js/muscle-evidence.js`:** do **not** add a shrinkage constant. Carry a band
> alongside the estimate and let the panel and the map's own certainty language name a range where
> the band spans more than one level. The existing desaturation (D19) already carries confidence;
> what is missing is the *sentence*.

### 15.3 Can a mistyped number be told apart from a PR? — **SOMETIMES, AND THE LINE IS MEASURABLE**

**The rule.** An observation above what training could plausibly have delivered since the last
reading is **quarantined** — kept in the record, named, and released the moment anything agrees with
it, either a set the same day or another day inside three weeks reaching 90 % of it. Nothing is
deleted.

**The ceiling.** `prior × exp(min(0.45, 0.12 + 0.0019 × days))`. The intercept is not slack: a
genuine daily best sits at ×0.948 of the standing estimate at the median and ×1.124 at the 99.9th
percentile, because the estimate is an upper envelope of submaximal work. The rate is more generous
than the simulator's own fastest build (0.00134/day) on purpose — a real novice gains faster than any
curve in it.

**Measured, at a 0.09 % false-positive rate on genuine training days (n = 3,202):**

| slip | caught |
|---|---|
| ×10 (225 → 2250) | **100 %** |
| +40 % | 99 % |
| +25 % | 77 % |
| +15 % | 19 % |
| +10 % | 5 % |

**So a slip inside about 15 % is not separable and the app should stop trying.** There is nothing in
the data that differs between it and a good day. That is asserted as a test.

**What it is worth.** One ×10 fat finger in a year of logs biases the estimate by **343 %** — not
briefly, but for months, because `f_load` then measures every real set against the typo and collapses
their confidence (the self-referential risk §13 already flagged, now with a number on it). With the
screen: **0.61 %**. And it costs **byte-identically nothing** on clean logs — same bias, same RMSE.

⚠️ **The winsoriser does NOT fix this and it is important not to confuse the two.** A ×10 typo
arrives with *high* credibility, so clipping toward the median of the top three barely touches it
(343 % → 343 %). §15.1 bounds a low-credibility outlier; §15.3 catches a high-credibility impossible
one. Two different failures, two different mechanisms.

> **Recommendation for `js/muscle-evidence.js`:** none directly — the screen needs a sequential
> per-exercise walk that `rateMuscle()` does not do, so it belongs in whatever feeds it (Phase 1/2).
> But note that `rateMuscle()` picks "the best showing on this exercise" as an exercise's
> representative, which is precisely the path a typo takes to the top.

---

## 16. What Phase 0 did NOT establish

Stated plainly, because the numbers in §11.0 look more confident than the thing they describe.

- **No claim about a human has been validated.** Every figure is against a simulator whose e1RM
  formula is correct by construction. §11.2 is the only thing that can change that, and it has not
  been run.
- **`uReps` is a placeholder with a measurement attached, not a fit.** See §15.2.
- **`loadRefDays` and the corroboration constants were not fitted at all**, and the module says so.
  The simulator cannot separate `loadRefDays` from the window, and it decides how often back-off sets
  land within 3 % of a top set, so sweeping the corroboration bonus against it would mostly measure
  that choice.
- **The plausibility ceiling is calibrated for a TRAINED lifter.** A genuine novice gains faster than
  any curve in the simulator. Nothing gates a beginner's first three months today, and nothing should
  until it is measured.
- **Bodyweight and assisted exercises are invisible to the SIMULATOR**, which is now a narrower
  statement than when it was written: `e1rm.js` and `muscle-evidence.js` both convert them where a
  published fraction and a weigh-in exist (bodyweight 2026-08-19, assisted 2026-08-24). Nothing here
  changes that, and the estimator has never been fitted against a body-weight lift — so an assisted
  pull-up reaching the estimator would be scored by a curve fitted on barbell histories.
- **The simulator models one exercise per lifter** for the estimator, and a separate three-exercise
  construction for the muscle aggregate. A real lifter's Chest is rated from several exercises whose
  histories interleave, and that combined case has not been simulated end to end.
- **Nothing is wired to a screen**, so none of this has been seen by a browser, a person, or a phone.
