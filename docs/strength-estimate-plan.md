# Estimating strength from ordinary workouts

**Status:** plan, nothing built. Written 2026-08-16.

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

## 11. How we will know it works

Tuning the constants in §3 by eye would be guessing with extra steps. Two checks, both buildable:

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

### 11.2 Backtest against Tim's own data

Once there are enough benchmarks: hide them, estimate from workout sets alone, and compare the
prediction to the held-out benchmark. That is a real measurement of "does this work on a human",
not a simulation. It also gives an honest headline number — *"typically within X % of a tested max"* —
which is exactly the sort of claim this project should be willing to state and defend.

---

## 12. Phasing

| Phase | What | Risk |
|---|---|---|
| **0** | `strength-estimate.js` — pure maths, plus the simulator and its tests. No UI, nothing user-visible. | None. Nothing ships |
| **1** | Extend `weightRepObservations` to carry set index and exercise index (needed for §3.1 and §3.2) | Low, additive |
| **2** | Wire the estimator into the **body map** — band-aware levels, hysteresis, source named | Medium — changes what a colour means |
| **3** | The **setting**, and the estimate line + band on the graph | Medium |
| **4** | Cross-exercise evidence, if the backtest justifies it | High — may be dropped |

Phase 0 is worth doing regardless: it is inert, it is where all the risk actually lives, and the
simulator tells us whether the rest is worth building before any of it is user-visible.

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
