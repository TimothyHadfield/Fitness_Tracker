# Research log

Everything researched for this project, by category. **Append here rather than starting new
research files** — one home for findings, so a fresh session can see what's already known and
what's still unverified.

Each finding carries its evidence base, so it's clear which claims are solid and which are thin.

| Category | Section |
|---|---|
| Rep-normalised comparison / e1RM | [§1](#1-rep-normalised-comparison--e1rm) |
| Reps ↔ %1RM relationship | [§2](#2-the-reps--1rm-relationship) |
| Proximity to failure / RIR | [§3](#3-proximity-to-failure-and-reps-in-reserve) |
| Fatigue, set order, rest intervals | [§4](#4-fatigue-set-order-and-rest-intervals) |
| Velocity-based training | [§5](#5-velocity-based-training) |
| Training volume & the rep continuum | [§6](#6-training-volume-and-the-repetition-continuum) |
| Competitive landscape | [§7](#7-competitive-landscape) |
| Data-viz colour validation | [§8](#8-data-viz-colour-validation) |
| Unverified / open | [§9](#9-unverified-claims-and-open-questions) |
| Strength standards & percentiles | [§11](#11-strength-standards-and-percentile-ranking) |
| Progression & load increments | [§12](#12-progression--how-much-to-add-and-when-) |
| **The basics, for the Research tab** | [§13](#13-the-basics-for-the-research-tab--) |
| Full source list | [§10](#10-sources) |

**Status legend** — 🟢 solid, multiple independent sources · 🟡 single good source · 🔴 thin or
contested.

---

## 1. Rep-normalised comparison / e1RM

*Researched 2026-08-15. Driver: Tim's question — a user benchmarks the same exercise at different
rep counts, so raw weight isn't comparable. Is there a reliable conversion, and is it the same for
every exercise?*

**Short answer.** Yes, and the conversion is *indirect*: convert every entry to an **estimated
one-rep max (e1RM)** — a rep-count-free common currency — then convert back down to whichever rep
count you want to display at. And no, the relationship is **not** the same for every exercise. That
last part is what almost every app gets wrong.

### 1.1 The mechanism

Never convert weight→weight directly. Two steps:

```
(weight, reps)  --formula-->  e1RM        strip out the rep count
e1RM            --invert -->  (weight at target reps)
```

Both directions use the same formula, so an entry already at the target rep count round-trips to
exactly itself. That property is what makes the chart honest.

### 1.2 The classical formulas 🟢

| Formula | Expression | Origin |
|---|---|---|
| Epley (1985) | `1RM = w × (1 + r/30)` | a poundage chart in a training manual — no study |
| Brzycki (1993) | `1RM = w / (1.0278 − 0.0278 r)` | practitioner article — no study |
| Lombardi (1989) | `1RM = w × r^0.10` | textbook |
| Lander (1985) | `1RM = w / (1.013 − 0.0267123 r)` | manual |
| O'Connor (1989) | `1RM = w × (1 + 0.025 r)` | textbook |
| Mayhew (1992) | `%1RM = 52.2 + 41.9 e^(−0.055 r)` | 435 college students, **bench press only** |
| Wathen (1994) | `%1RM = 48.8 + 53.8 e^(−0.075 r)` | textbook chapter |

Shared properties, all of them problems for a 265-exercise library:

- Derived from **young trained males doing the bench press**, then applied to hundreds of exercises.
- Every one uses a **fixed** rep→1RM conversion factor regardless of exercise or load.
- Accuracy degrades badly **above ~10 reps**.
- LeSuer et al. (1997), n = 67 across bench/squat/deadlift: all seven significantly **underestimated
  the deadlift** 1RM — early evidence that one factor can't generalise.
- Reynolds et al. (2006), n = 70: the **5RM** test predicted best (R² = 0.993 bench, 0.974 leg
  press); accuracy degraded substantially at higher rep ranges. Adding anthropometric variables
  didn't help.
- Mayhew et al. (2008), n = 103 women: equations more accurate below 10 reps; training status
  affected accuracy in an exercise- and equation-dependent direction.
- Correlations with true 1RM are uniformly high (r > 0.90), which **hides** meaningful absolute
  error. Don't be reassured by correlation here.

Validation-literature consensus: Brzycki and Epley are the most accurate classical options inside
**2–10 reps**, Brzycki slightly more conservative; Lombardi overestimates at higher reps. This is
the basis of **D5** in `progress.md`.

### 1.3 The formula this app should use 🟡

**Marzagão (2026)**, *A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure
Sets Across 388 Exercises* (pre-print, arXiv:2603.17495; author affiliated with Fitbod).

```
1RM = w × (1 + (r − 1)^0.85 / k(w))
k(w) = max(0.5, −2.55 + 4.58 × ln(w))          w in KILOGRAMS
```

Generalises Epley two ways: the rep term is sub-linear (`^0.85`), and — the important part — the
conversion factor **k varies logarithmically with the weight lifted** instead of being fixed.

Weight acts as a *proxy for exercise type*. Light exercises tend to be small-muscle isolation work
where each extra rep is a larger fraction of remaining capacity; heavy exercises are large compound
lifts with a flatter curve. That's exactly the moderation Nuzzo et al. identified (§2), and this is
the first formula to encode it.

| Weight | Example | k(w) |
|---|---|---|
| 10 kg | DB lateral raise | 8.0 |
| 15 kg | DB bicep curl | 9.9 |
| 25 kg | DB bench press | 12.2 |
| 55 kg | Lat pulldown | 15.8 |
| 70 kg | Barbell bench press | 16.9 |
| 80 kg | Back squat | 17.5 |
| 150 kg | Heavy deadlift | 20.4 |

For comparison the classical fixed values are Epley 30, Brzycki 36, Wathen ≈29, Mayhew ≈29 — all
far above the empirical range at every weight, so they all **understate** what each extra rep
implies, worst for light exercises.

**Evidence**

- **303,494 near-failure sets, 14,966 users, 388 exercises, 16 muscle groups.** For scale, Nuzzo et
  al.'s meta-analysis — the largest prior work — covered 7,289 individuals.
- Optimised on an **internal-consistency** criterion: different (weight, rep) pairs from the same
  person / exercise / 14-day window should imply the same 1RM. Measured as mean within-tuple
  `SD(log(1RM))`.
- **17–22 % lower inconsistency** than all four classical benchmarks — Brzycki +17.6 %, Epley
  +17.4 %, Wathen +17.0 %, Mayhew +21.9 %.
- Positive for **all 183 exercises** with ≥50 tuples. No exceptions.
- Positive for **every equipment category**: barbell +12.3 %, machine +16.0 %, cable +18.9 %,
  dumbbell +22.1 %.
- Larger for isolation (+21.9 %) than compound (+16.3 %); correlation between exercise mean weight
  and improvement r = −0.61.
- **5-fold user-level** cross-validation (whole users held out — the stringent form): test
  improvement +17.6 % vs full-sample +17.6 %. Effectively zero overfitting.
- Ablation: weight-dependent k accounts for **91 %** of the gain, the `^0.85` exponent 9 %.
- Stable across 7/14/28-day windows and across 2-set vs ≥3-set tuples.

**Limits, stated plainly**

- **Internal consistency ≠ absolute accuracy.** A formula overestimating everyone by 10 % would
  still score well. The claim is that it captures the *relative structure* better — which is
  precisely what a progress chart needs, and is not a claim about your true max.
- Never validated against directly measured 1RMs. That study doesn't exist yet.
- Sample 80 % male, concentrated 25–39 — though far more diverse than any classical formula's
  sample. Brzycki and Epley published no sample at all.
- Weight is a *proxy* for exercise type, not a measurement of it. A 25 kg dumbbell bench press and
  a 25 kg concentration curl get the same k despite plausibly different true curves.
- α = 0.85 fixed, not jointly optimised. Lower α scored better on the metric, but the author treats
  that as possible metric-gaming rather than a better model — lower α compresses the rep term,
  mechanically reducing variance without necessarily modelling anything better.
- Pre-print, single author, author works at Fitbod (whose data it is).

**Logging convention — matters for us.** The Fitbod data logs **weight per hand** for dumbbells and
**total bar weight** for barbells. Coefficients were fitted against that convention, so the `w` fed
to `k(w)` must follow it. That maps directly onto our existing `loadType` field: pass the
**per-side** number for `per_side` exercises, the **total** for `total`. No new data needed.

### 1.4 Applicability across the library

| Case | Handling |
|---|---|
| Weighted, 2–10 reps | Full confidence — the formula's home ground |
| Weighted, 1 rep | `r = 1` → returns `w` exactly. Correct by construction |
| Weighted, 11–15 reps | Usable, flag as lower confidence (D5) |
| Weighted, >15 reps | Don't normalise across it — endurance and pain tolerance dominate |
| Bodyweight / assisted | Logged weight is added/assisted load, not total resistance — the paper excluded these outright. **This app now converts instead**, but only where a published body-weight fraction exists and a weigh-in is on record; everything else stays excluded. See §1.4 |
| Time / distance only | Not applicable — no load-rep tradeoff exists |
| Weight-only (no reps field) | Nothing to normalise |

### 1.5 Worked example — Tim's case

Entries `25×10, 45×4, 35×10, 60×1, 45×10` (lbs). Modal rep count = **10** (three entries).

| Logged | e1RM (Marzagão) | e1RM (Epley) | e1RM (Brzycki) | Normalised @10 |
|---|---|---|---|---|
| 25 × 10 | 43.9 | 33.3 | 33.3 | **25.0** actual |
| 45 × 4 | 55.2 | 51.0 | 49.1 | **33.3** est |
| 35 × 10 | 57.4 | 46.7 | 46.7 | **35.0** actual |
| 60 × 1 | 60.0 | 62.0 | 60.0 | **36.9** est |
| 45 × 10 | 70.9 | 60.0 | 60.0 | **45.0** actual |

Series becomes `25 → 33.3 → 35 → 36.9 → 45`. Tim's hand estimate was `25 → 30 → 35 → 40 → 45`; the
model agrees on ordering and monotonic rise, differing 3–4 lbs on the two estimated points.

Absolute e1RMs run well above classical ones at this weight (43.9 vs 33.3 for 25×10) — expected,
since k(11 kg) ≈ 8.6 against Epley's 30. **Irrelevant to the chart**, which only shows normalised
load, but it means e1RM shouldn't be surfaced as "your one-rep max" without care.

### 1.6 Implementation notes — BUILT 2026-08-15

Lives in `js/e1rm.js` (pure maths, no DOM) with the series work in `js/store.js` and the chart in
`js/views-data.js`.

- **The k floor was moved from 0.5 to 4.58, and this matters.** The published curve is
  *decreasing* in weight below k = B — a heavier lift would score a lower 1RM, which is nonsense and
  makes the inverse ambiguous. The turning point is exactly where k = B (w ≈ 4.74 kg / 10.5 lbs),
  since dk/dw = B/w gives d(e1RM)/dw = 1 + C(k − B)/k². Holding k constant below that keeps the
  curve strictly increasing everywhere, so inversion always has one answer. The paper's own 0.5
  floor only avoids division by zero; it does not protect monotonicity. Asserted in the test suite
  across 1–400 lbs.
- **Inversion is a numeric solve.** `k` depends on `w`, so "weight at target reps" has no closed
  form. Bisection over `(0, e1RM]`, 60 iterations, run per data point. Cheap.
- **Modal rep count** is computed over *all* observations (every set, every benchmark) — never over
  the plotted series, which depends on the target and would make the chart circular and unable to
  settle. Ties go to the most recently used count.
- **Per-day pick**: if any set that day was actually done at the target rep count, that set wins
  (heaviest of them) and the point is marked measured. Otherwise the highest-e1RM set wins and the
  point is an estimate. A real measurement always beats a stronger inference, so the chart never
  replaces a fact with a guess.
- **Marker = measured.** Estimated points carry no marker and are held by the line alone. Bars use
  a diagonal hatch rather than a fade, so the cue survives greyscale and colour-blindness and the
  validated series colours stay untouched.
- Call the output **"equivalent load"**, not "your max".
- ~~**Bodyweight and assisted exercises are excluded**~~ (see §1.4) — **both now admitted, bodyweight
  on 2026-08-19 and assisted on 2026-08-24**, and only for the exercises with a published body-weight
  fraction and a user with a weigh-in. The original reasoning stands and is why it took two goes: the
  logged weight is *assistance*, so more weight means an easier lift and normalising the raw number
  would invert the chart entirely. What changed is that the missing term is computable —
  `fraction × body weight − assistance` — so the chart never sees the raw number at all.
  ⚠️ **The assist admission carries an assumption the bodyweight one does not**: that a machine's
  stack number is pounds actually taken off the lifter. Nothing published maps one to the other, the
  linkage is not standardised across brands, and it is priced as the lowest `q` in the fraction table
  (0.65, below the push-up's 0.70) rather than disclaimed. `js/exercises.js` carries the full note.
- Real bug caught while testing: `Number(null)` is `0`, so a null rep count clamped up to 1 and a
  missing default target silently became "1 rep" instead of falling back. `clampReps` now type-guards.

---

## 2. The reps ↔ %1RM relationship

**Exercise type is the only moderator that meaningfully matters.** 🟢

Nuzzo, Pinto, Nosaka & Steele (2024) — meta-regression of **952 reps-to-failure tests from 7,289
individuals across 269 studies**, the largest analysis to date — tested sex, age, training status
and exercise type. Only **exercise type** moderated the relationship. Sex, age and training status
did not clearly moderate it at all.

| %1RM | Mean reps (general) | Bench press | Leg press |
|---|---|---|---|
| 95 % | ~5 ⚠️ | | |
| 90 % | ~5 | | |
| 80 % | ~9 | ~9 | ~13 |
| 70 % | ~15 | ~14 | ~19 |
| 60 % | ~20+ | | |

⚠️ **THE 95 % AND 90 % ROWS BOTH SAY ~5 AND THEY CANNOT BOTH BE RIGHT** — flagged 2026-09-02 while
building the rep prediction. A heavier relative load must allow fewer reps, so one of those two
figures is a transcription slip in this file rather than a finding. **Nothing has been shipped off
the 95 % row and nothing should be until somebody re-reads PMC10933212.** The rest of the table is
consistent and is what the comparison below is drawn against.

⚠️ **AND THIS TABLE IS NOT WHAT THE APP COMPUTES.** `repsForWeight()` in `js/e1rm.js` inverts the
**Marzagão** curve (§1.3, graded 🟡), and the two disagree: at 80 % of a bench-press-weight max it
gives about **7** reps where this table says **~9**. Marzagão is used anyway, and the reason is
consistency rather than a belief that it is more accurate — every e1RM in this app comes from that
curve, so predicting reps from a different one would mean a lifter who performed the predicted reps
produced an e1RM contradicting the estimate that suggested them. **An app disagreeing with itself is
worse than an app agreeing with the smaller of two literatures.** The argument is written out beside
the function; if this table is ever preferred, that comment is what has to change with it.

Same relative load, ~40 % more reps on the leg press. The authors published **separate loading
tables** for bench press and leg press because the curves differ that much; everything else uses the
general model. The relationship was best described by **natural cubic splines**, not the linear or
simple exponential forms classical equations assume.

Supporting:

- **Shimano et al. (2006)** — trained and untrained men at 60/80/90 % 1RM on back squat, bench
  press, arm curl. Significantly more reps on the squat at 60 %. Muscle mass engaged modulates rep
  capacity at a given relative intensity. Training status had minimal impact.
- **Richens & Cleather (2014)** — 8 competitive weightlifters vs 8 endurance runners on leg press.
  Runners did **39.9 reps at 70 %** vs weightlifters' **17.9**; 19.8 vs 11.8 at 80 %; converging at
  90 %. Training *background* — separate from training *status* — can fundamentally alter the curve.

**Between-individual variability** widens at lighter loads: SD 4.36 reps at 60 % vs 2.51 at 80 %.
Practical consequence — estimates from heavy, low-rep sets are inherently tighter.

**Coverage gap:** despite the meta-analysis, bench press accounted for 42 % of included tests and
leg press 14 %. Rows, overhead presses, deadlift variations and isolation movements have **no**
validated exercise-specific equations.

---

## 3. Proximity to failure and reps in reserve

Every rep-based 1RM formula assumes the set went to or near momentary failure. Recreational lifters
routinely violate this. 🟢

- **Steele et al. (2017)**, n = 141: experienced trainees underpredict reps-to-failure by ~1–2,
  less experienced by ~4–5. Even when people believe they're at failure they typically have reps in
  reserve.
- **Refalo et al. (2024)**, n = 24 resistance-trained, bench press at 75 % 1RM: *intraset* RIR
  prediction was accurate (mean error 0.65 ± 0.78 reps), with no effect of sex, experience or
  relative strength. So mid-set judgement is better than whole-set prediction.
- **Zourdos et al. (2016)** introduced the RIR-based RPE scale (RPE 10 = 0 RIR); strong inverse
  correlation with movement velocity for experienced (r = −0.88) and novice (r = −0.77) lifters.

**Consequence:** applying a formula to a submaximal set **underestimates** true 1RM. Estimates are
quoted as accurate to ±3–5 % only for near-failure sets of 1–6 reps.

**Why this mostly doesn't sink the §1 feature.** We compare a user against *themselves* on the *same
exercise*. Systematic bias shifts the whole series by roughly a constant factor — it moves the
level, not the shape. Trend, ordering and percentage change all survive. What it does mean:
inconsistent *effort* between benchmarks is real noise the formula cannot see, so the app should
nudge users to take benchmark sets close to failure.

---

## 4. Fatigue, set order and rest intervals

🟡 Relevant to a future rest timer, and to whether we ever estimate from mid-workout sets.

- **Willardson (2006)** review: 3–5 min rest is needed to maintain intensity for strength goals;
  1–2 min produces meaningful rep-performance decline.
- **Senna et al. (2011)**, n = 15 trained males, multi-joint and single-joint exercises: significant
  rep decline from the **second** set with 1 min rest, and from the **third** set with 3–5 min rest.
  Perceived exertion rose across sets under all conditions.
- **No existing 1RM equation accounts for set order or accumulated within-session fatigue.** The
  Marzagão study sidesteps it by keeping only the *first* near-failure set per exercise per workout.

**Design implication:** if we ever estimate e1RM from ordinary working sets rather than dedicated
benchmarks, prefer the **first** hard set of that exercise in the session. A third set at 90 s rest
carries different information from a first set at full recovery.

---

## 5. Velocity-based training

🟡 Not actionable without hardware, but the principle transfers.

- **González-Badillo & Sánchez-Medina (2010)**, n = 120: mean propulsive velocity closely tracks
  %1RM in the bench press (R² = 0.98), and the relationship **held stable after a 9.3 % increase in
  1RM** over six weeks. Velocity tracks relative intensity regardless of absolute strength change.
- **Greig et al. (2023)**, systematic review + IPD meta-analysis, 434 participants across 20
  studies: individualised load–velocity profiles give a pooled SEE of ~9.8 % of 1RM. Authors still
  recommend direct 1RM testing when precision is required.

**Transferable principle:** *individualised* models consistently beat generic equations. A long-term
direction for this app is fitting a per-user, per-exercise rep–load curve from their own history
rather than applying a population formula — the Marzagão structure would serve as the prior.

---

## 6. Training volume, frequency and the dose response

Underpins **D3** (weekly sets per muscle group), **D5**, and the **"% optimal" rating**
(`docs/optimal-rating-plan.md`). **Primary sources pulled 2026-08-18** — the note that used to sit
here saying "do that before building D3" is discharged.

### 6.1 The central paper 🟢

**Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. "The Resistance Training Dose Response:
Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and
Strength Gains." *Sports Medicine*, accepted 14 Oct 2025, published online 4 Dec 2025.**
doi:10.1007/s40279-025-02344-w · 67 studies · 2058 participants (79.1 % male, mean age 25.16 ± 5.22)
· interventions averaged 10.42 ± 4.48 weeks.

Volume treated as a **continuous** variable with seven candidate functional forms compared by Bayes
factor, rather than the arbitrary buckets ("10–20 vs 20+") that earlier work compared.

### 6.2 Hypertrophy vs volume 🟢

- Best fit: **square root**. Marginal slope **0.24 % muscle size per set** at the mean volume of
  12.25 fractional sets [95 % CrI 0.15, 0.33]; 100 % posterior probability the slope exceeds zero.
- Comparable to Schoenfeld et al.'s earlier estimate of 0.38 % per set.
- Smallest detectable effect size (SDES) = **2.05 %** for hypertrophy, 3.96 % for strength.
- **Efficiency tiers, their Table 3** — fractional weekly sets *per muscle*:

  | Tier | Sets | Additional sets per further detectable increment |
  |---|---|---|
  | Minimum effective dose | 4 | — (the point where the effect first exceeds the SDES) |
  | Higher efficiency | 5–10 | ~6 |
  | Intermediate efficiency | 11–18 | ~8.5 |
  | Lower efficiency | 19–29 | ~10.75 |
  | Lowest efficiency | 30–42 | ~12.5 |
  | Unclear | 43+ | insufficient data, **or potentially less hypertrophy** |

- **No plateau was identified** within the studied range, but the authors caution that few studies
  explored beyond ~25 fractional weekly sets. The best-fit square-root model is "still compatible
  with multiple functional forms (e.g., functional plateau, inverted-U)".

⚠️ **This supersedes the "10–20 hard sets per muscle per week" band this section used to carry.**
That band was 🟡 and widely repeated; the continuous model shows it is not a target so much as the
middle of a curve that keeps rising while getting steadily less efficient. Where the old band said
"do 10–20", the evidence says "4 gets you a detectable result, 5–10 is the best value per set, and
past ~19 you are paying about 10 sets for each further increment".

### 6.3 Frequency 🟢 — and it contradicts the popular position

- **Hypertrophy: no consistently identifiable independent effect of frequency.** Reciprocal model,
  slope 0.32 % [95 % CrI **−0.14**, 0.82] — the interval **contains zero**. Authors: *"any
  independent effect of additional frequency is small and is not consistently identifiable across
  modeling methods."* Aligns with Schoenfeld et al. 2019 in volume-equated studies (ES = 0.07
  [95 % CI −0.08, 0.21]).
- **Strength: frequency does matter.** Slope 3.27 % [95 % CrI 2.74, 3.84], 100 % probability > 0.
  Frequency 1 → 2: ES 12.72 % [10.57, 15.05] → 17.32 % [14.34, 20.56]. Accelerating diminishing
  returns beyond that. Higher frequency plausibly acts through *practice* of the tested movement.

**Practical reading: for muscle growth, more training days is not itself better — where the sets land
is what matters. For strength, more days genuinely is better, with fast diminishing returns.**

### 6.4 How to count a set 🟢 — this settles the D3 blocker

Three counting methods compared. **`fractional` — indirect (synergist) sets count as 0.5 — was best
supported**, by "strong" to "very strong" evidence on the Kass–Raftery scale:

| Comparison | 2×log(BF), hypertrophy volume | strength volume |
|---|---|---|
| fractional over `total` | 9.48 | 18.21 |
| fractional over `direct` | 10.29 | 45.96 |

*Direct* = the measured muscle is the primary force generator in the exercise. *Indirect* = the
muscle is meaningfully trained but is a synergist.

⚠️ **The old note here said "secondary-muscle weighting fixed at 0.5 with an advanced override",
recorded in `progress.md` as *resolved without asking*. It was a guess, and the best-supported
method in the literature independently landed on the same number.** That is a good outcome and it
should not be over-read: the authors state plainly that 0.5 *"is still an assumption"* and that the
method *"should be regarded as a heuristic to improve the accuracy of dose–response modeling, rather
than a definitive standard for practical application across all contexts."* Keep the override.

**The blocker is discharged.** `js/exercises.js` maps each exercise to a single `muscle` string; what
D3 needs is a **binary direct/indirect flag per (exercise, muscle) pair** weighted 1.0 / 0.5 — which
is *simpler* than the continuous weighting previously assumed, and now has a citation. Note this is
a different table from `js/muscle-evidence.js`: that one asks "how strong is this muscle", this one
asks "how much work landed here".

### 6.5 What any of this explains 🟢

**R²marginal = 22.3 %** (hypertrophy volume) and **26.1 %** (strength volume); R²conditional 73.3 %
and 74.8 %. The programming variables explain roughly a **quarter** of the variance between training
groups.

⚠️ **This is the number that governs how any derived rating may be presented.** A model explaining a
quarter of the variance cannot honestly separate an 83 % from an 87 %, which is why
`docs/optimal-rating-plan.md` outputs banded ranges rather than points.

### 6.6 Stated limitations, carried forward rather than buried

- Cohorts are young (25.16 ± 5.22 years), predominantly male (79.1 %), and over-70s were excluded.
- Interventions averaged **10.42 weeks** — this is short-run evidence being used to reason about
  programmes people follow for years.
- The authors **did not model** "indirect negative consequences (e.g., non-sustainability, injury,
  psychological burnout)". Any rating that scores more volume as better without a ceiling is using
  the model outside what it measured.
- Moderator analyses are explicitly "hypothesis generating" only.
- Volume was quantified per week, which the authors note is an arbitrary time base; a parallel paper
  by the same group covers *per-session* volume. ~~🔴 **Not yet pulled.**~~ **Pulled 2026-08-19 —
  §6.12.**

### 6.7 Proximity to failure 🟡 — see also §3

**Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC.** *Sports Medicine*
54(9), 2024. doi:10.1007/s40279-024-02069-2.

- **Hypertrophy increases as sets are taken closer to failure** — marginal slopes on estimated RIR
  were negative with intervals excluding the null.
- **Strength is largely indifferent to RIR** — intervals contained the null.
- Graded 🟡 not 🟢 by the authors' own framing: RIR was **estimated from study descriptions rather
  than measured**, overall fit quality was "modest", and the analysis is exploratory.

⚠️ **Consequence for this app: the variable that most modulates whether a set produces growth is
invisible to it.** There is no RIR field and that is deliberate (D28). Any volume-based rating is
therefore conditional on "assuming sets are taken close to failure", and must say so.

### 6.9 Protein 🟢 — pulled 2026-08-18 for `docs/goals-plan.md`

**Morton RW, et al.** *A systematic review, meta-analysis and meta-regression of the effect of
protein supplementation on resistance training-induced gains in muscle mass and strength in healthy
adults.* British Journal of Sports Medicine, 2018. 49 trials, 1,863 participants.

- Benefit **plateaus at ~1.62 g/kg/day** — the breakpoint past which more protein did nothing
  detectable. **= 0.73 g per lb.**
- 95 % CI to ~2.2 g/kg/day **= 1.0 g per lb**.

⚠️ **The folklore "1 gram per pound" is the TOP of the confidence interval, not the middle.** Not
wrong, but presenting it as *the* target quietly turns an upper bound into a goal. The honest
statement is **0.7–1.0 g/lb**.

⚠️ Collides with **D1** (diet cut). The distinction is tracking versus recommending — see
`docs/goals-plan.md` §3.3. D1 is locked, so this needs Tim.

### 6.10 Sleep 🟡 — quantified mechanism, no dose–response

⚠️ **Corrected 2026-08-18.** An earlier pass here said the evidence was merely "documented" and
thinner than expected. **Tim doubted that, and he was right to** — a second search found a quantified
experimental result that the first missed. The correction matters because it changes what the app is
allowed to say.

**Lamon S, et al. "The effect of acute sleep deprivation on skeletal muscle protein synthesis and the
hormonal environment." *Physiological Reports*, 2021.** N = 13 (7 male, 6 female), randomised
crossover, one night of total sleep deprivation vs normal sleep.

- **Postprandial muscle protein synthesis fell 18 %** after a single night without sleep.
- Accompanied by an acute rise in plasma **cortisol** and a **sex-specific fall in testosterone**.
- Builds on earlier work finding reduced MPS after **five nights of sleep restriction**.

Also: Knowles et al., *J Sci Med Sport*, 2018 — inadequate sleep blunts adaptation and disturbs
baseline muscle protein metabolism.

**So the app CAN say something concrete and cited**: losing a night's sleep measurably cuts the rate
at which muscle is built, by about a fifth, along with a hormonal shift in the wrong direction.

⚠️ **What still does not exist is a DOSE–RESPONSE between habitual hours slept and strength or size
gained over a training programme** — nothing of the kind §6.2 has for volume. Total deprivation is
not 6 hours versus 8. So:

- ✅ "Short sleep measurably blunts muscle building — 18 % in one night of deprivation."
- ❌ "You need 8 hours to hit this goal" / "7 hours for the relaxed goal, 9 for the ambitious one."

The design consequence in `docs/goals-plan.md` §10.3 is unchanged — sleep cannot be *scaled* by goal
ambition — but the sentence the app shows is now a measured number rather than a vague warning.

### 6.11 Individual variability 🟢 — and it is the reason goals cannot promise numbers

- Over a **12-week** programme, in people of the same age doing the same training, individual change
  ranges **0–250 %** for strength and **−2 % to 59 %** for size.
- **Early progression does not reliably predict later adaptation** — authors note this "challenges
  the practicality of tailoring training programs based on short-term outcomes".
- **Non-responders are rare**: in one 16-week analysis 82 % were robust or excellent responders, 5 %
  poor.
- ~~**Individual responsiveness is reproducible** across repeated protocols after detraining.~~
  **Refined 2026-08-19 — see §6.18.3.** Response magnitude *is* reproducible (r ≈ 0.67–0.76 across
  two identical 10-week blocks); *non*-response is not — nobody was a non-responder twice on more
  than one measure. The two halves of that sentence want keeping apart.

⚠️ **This section shipped on 2026-08-18 with no citations at all**, which by this file's own rule is
a defect. Sources are in **§6.18.3** and the numbers survived the check.

⚠️ **Together: population data cannot tell one person what they will gain in three months, but that
person's own history predicts them well.** Any goal or projection must be calibrated to the
individual's measured trend, and expressed as a range — never as a promised number from a table.

### 6.8 Still to pull 🔴

~~Load / rep range (Schoenfeld's repetition continuum, 2021 — referenced, still not read in full),
rest intervals, range of motion and lengthened partials, exercise selection and variation, and the
per-session volume paper from §6.6. Each either enters the rating model or becomes a stated caveat.~~

**PULLED 2026-08-19.** Four of the five are below: **per-session volume §6.12**, **load / rep range
§6.13**, **rest intervals §6.14**, **range of motion §6.15**. **Exercise selection and variation is
still not pulled** 🔴 — but §6.16 turned up an adjacent finding with better evidence than any of the
four (exercise *order*), so that is where the next pull should start.

Three of the four end as **stated caveats rather than model terms**, and that is the honest result
rather than a failure to find something: the app stores no load, no reps, no rest and no range of
motion on a *planned* workout, so three of these axes have nothing to attach to even if the evidence
had been strong. It mostly is not. The one that does touch the model is per-session volume, and it
touches it far less than expected — see §6.12.4.

### 6.12 Per-session volume 🟡 — the ceiling that isn't one

*Pulled 2026-08-19. Driver: the rating counts weekly sets with no per-session cap, so a programme
doing 12 sets of chest in one day scores the same as one spreading them over three. Does it deserve
to?*

**Remmert JF, Pelland JC, Robinson ZP, Hinson SR, Zourdos MC. "Is There Too Much of a Good Thing?
Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength." SportRxiv
preprint, posted 2 April 2025** (manuscript last modified March 2025).
https://sportrxiv.org/index.php/server/preprint/view/537 · supplements https://osf.io/dqka3/

This is the parallel project §6.6 flagged. Same laboratory, same 6,677-record search, the same **67
studies / 2,058 participants** (mean age 25.16 ± 5.22, interventions 10.42 ± 4.48 weeks) as Pelland
et al. — re-analysed with volume expressed **per session** instead of per week.

#### 6.12.1 What it found

Seven functional forms compared by BIC-approximated Bayes factor, as in the weekly paper.

| | Hypertrophy | Strength |
|---|---|---|
| Best-supported counting method | **`fractional`** (2×log BF 3.72 over `total`, 0.96 over `direct`) | **`direct`** (9.87 over `fractional`, 6.95 over `total`) |
| Best-fitting form | **linear-log** | **reciprocal** |
| Effects / studies / participants | 220 / 35 / 1,032 | 490 / 66 / 2,020 |
| Marginal slope at the mean | β = **0.393 %** [95 % CrI 0.202, 0.583] per set | β = **1.23 %** [0.941, 1.52] per set |
| P(slope > 0) | 100 % | 100 % |
| R²marginal / R²conditional | **16.1 %** / 73.8 % | **14.9 %** / 73.3 % |
| Point of undetectable outcome superiority (PUOS) | **~11 fractional sets/session** | **~2 direct sets/session** |
| Range of per-session volumes in the data | 5.95 ± 4.49 (**0–24**) fractional sets | 1.96 ± 2.22 (**0–10**) direct sets |

Their Table 1 converts the PUOS between counting methods, which is what makes it usable against a
model that counts fractionally:

| | Total sets | Direct sets | Fractional sets |
|---|---|---|---|
| Hypertrophy | 13.835 | 8.165 | **11**\* |
| Strength | 4.957 | **2**\* | 3.478 |

\* the value from the best-fit model for that outcome, unconverted.

#### 6.12.2 ⚠️ What a PUOS is NOT

The authors are unusually careful here and it matters more than the number does:

> "these PUOS values are not upper limits beyond which additional increases in outcomes are not
> observed; rather, beyond these per-session set volume values, no pairwise comparisons to other
> per-session set volume values showed a >50 % probability of the cumulative differences to exceed
> the SDES."

And, on the same page: *"it is paramount to understand that the PUOS values, while justifiable, were
determined **arbitrarily**."* And in the conclusions: *"there is insufficient data with very high
per-session set volumes. Therefore, it is unclear whether there is a point in which additional
per-session sets attenuate adaptations, or if even higher per-session set volumes could be
potentially beneficial."*

So the finding is **"past ~11 sets in one session the extra sets stop being distinguishable"**, not
"past ~11 they stop working". Above 11, *"hypertrophy outcomes continued to occur, again in a
decreasing manner"*. Anything this app builds on the number has to preserve that distinction, or it
will be claiming a ceiling the source explicitly refuses to claim.

#### 6.12.3 ⚠️ It does not reconcile cleanly with the weekly model the rating already uses

The authors raise this against themselves. Pelland et al. put the *weekly* PUOS at **~31 fractional
sets** for hypertrophy and ~3 for strength. 11 sets/session × 3 sessions = 33 ≈ 31, which "seems to
suggest a frequency of 3 weekly sessions with ~10 sets per-session" — except that Pelland et al. also
found the effect of frequency beyond 1 was unlikely to exceed the SDES, *"which seemingly contradicts
the findings of the present investigation"*. Their own reconciliation is that the two analyses use
different best-fit forms (square root weekly, logarithmic per-session) and that the per-session PUOS
times the *mean* frequency of 2.33 gives 25.6, ~5 sets short of 31.

They then state the load-bearing gap outright: **no study has isolated per-session volume and
frequency together.** *"In the absence of direct investigations, there are two competing
hypotheses"* — higher frequency helps only when per-session volume is low, or higher frequency is
needed *because* per-session volume gets too high — and *"the present investigation does not
conclusively support either hypothesis."*

**This is the reason a per-session term cannot simply be bolted on.** A model that sums a
per-session response across sessions *is* a model that rewards training more days for growth, which
is exactly the first thing `js/optimal.js` refuses to do, on the strength of §6.3. Modelled out
(below), the two give materially different answers, and nothing in the literature says which is
right.

#### 6.12.4 What it would change — computed against the nine shipped systems

Run through `rateProgramme` / `weeklyVolume` with the presets as they ship. **177 (workout, muscle)
pairs across all nine systems. Median 4.5 fractional sets in a session, p90 10.0, max 15.0. Seven
pairs — 4 % — exceed the PUOS of 11.**

| System | d/wk | Growth now | with a hard cap at 11/session | Biggest single session | Pairs over 11 |
|---|---|---|---|---|---|
| Ultimate Push Pull Legs | 6 | 55 % | 55 % | 12.0 (Push 1 / Triceps) | 1 of 29 |
| Dr. Mike's Floating Split | 6 | 50 % | 50 % | 9.0 (Push 2 / Triceps) | 0 of 28 |
| The Golden Six | 3 | 35 % | 35 % | 5.5 (Golden Six / Shoulders) | 0 of 8 |
| **Mike Thurston's Six-Day Split** | 6 | **55 %** | **50 %** | **15.0 (Chest / Chest)** | **5 of 23** |
| Chris Bumstead's 8-Day Split | 6 | 45 % | 45 % | 11.0 (Chest & Triceps / Chest) | 0 of 22 |
| Volume Landmarks Hypertrophy | 4 | 50 % | 50 % | 6.5 (Upper B / Shoulders) | 0 of 23 |
| Push Pull Legs | 6 | 65 % | 65 % | 12.5 (Pull / Biceps) | 1 of 13 |
| Upper / Lower | 4 | 50 % | 50 % | 10.0 (Lower / Quads) | 0 of 12 |
| Full Body, 3 Days | 3 | 40 % | 40 % | 6.0 (Full Body B / Back) | 0 of 19 |

**A hard cap at the PUOS changes exactly one banded rating out of nine**, and it changes it on the
strength of a number the authors call arbitrary. Strength ratings: unchanged for all nine.

The motivating worry, priced directly — 12 fractional sets on one muscle, split different ways:

| Split | Weekly square-root model (ships) | Capped at 11 | Per-session log-sum |
|---|---|---|---|
| 12 in one session | 5.82 % | 5.57 % | 7.00 |
| 6 + 6 | 5.82 % | 5.82 % | 10.62 |
| 4 + 4 + 4 | 5.82 % | 5.82 % | 13.18 |
| 2 × 6 sessions | 5.82 % | 5.82 % | 18.00 |

**A cap barely moves it** (12 → 11 is one set, ~4 % relative). **A per-session log-sum moves it
enormously** — and that column is a frequency reward in disguise: it says six sessions of 2 sets beat
one session of 12 by 157 %, which no volume-equated study supports and §6.3 specifically contradicts.
Re-ranking all nine under the log-sum model moves Thurston 3rd → 5th, Bumstead 7th → 9th and Golden
Six 9th → 8th. **That reordering is the model's assumption talking, not the evidence.**

#### 6.12.5 Recommendation

1. **Do NOT adopt a per-session response model.** It is a frequency reward wearing a per-session
   coat, and it breaks refusal #1 in `js/optimal.js`. Grade for that path: 🔴.
2. **DO clamp per-session credit at 24 fractional sets per muscle** — the top of the per-session
   *data range*, exactly parallel to the existing `VOLUME_CEILING = 42` clamp on weekly volume and
   justified the same way ("don't extrapolate past the data", not "sets stop working here"). One
   constant, one `Math.min` inside the per-workout loop.
   **Computed effect: none on the nine — all nine unchanged.** It bites only on a fabricated
   programme: 60 bench sets in a single weekly session currently scores **25 %** and would score
   **20 %**. That is the same class of guard as the existing 60-sets-a-week test in
   `tests/volume-map.test.mjs`, on the axis that guard does not cover.
3. **Do NOT cap at 11.** It would move Thurston 55 → 50 on a number its own authors call arbitrary,
   and the evidence says growth continues past 11 — just undetectably.
4. **DO say it in words.** The screen can honestly report *"this programme puts 15 sets on Chest in
   one session; past about 11 the research can no longer tell the extra ones apart"* — sourced,
   caveated, and actionable without pretending to price it. That sentence is worth more than the
   0–5 points any cap would move.

**Grade: 🟡.** Excellent methods, large corpus, but a **preprint that was still not peer-reviewed as
of August 2026** (16 months after posting), a self-described arbitrary threshold, R²marginal of
16.1 %, and an unresolved contradiction with the weekly paper the rating is already built on.

### 6.13 Load and rep range 🟢 — and the app cannot see either

*Pulled 2026-08-19. Question: does the rating need to care whether sets are heavy or light?*

#### 6.13.1 The evidence

**Lopez P, Radaelli R, Taaffe DR, et al. "Resistance Training Load Effects on Muscle Hypertrophy and
Strength Gain: Systematic Review and Network Meta-analysis." *Med Sci Sports Exerc* 2021;53(6):
1206–1216.** doi:10.1249/MSS.0000000000002585 · 28 studies, 747 healthy adults. **All included
studies took sets to volitional failure**, which is what makes the comparison fair.

Bands: **low** > 15 RM or < 60 % 1RM · **moderate** 9–15 RM or 60–79 % · **high** ≤ 8 RM or ≥ 80 %.

| Contrast | Hypertrophy SMD [95 % CI] | Strength SMD [95 % CI] |
|---|---|---|
| High vs low | 0.12 [−0.06, 0.29], *p* = 0.241 | **0.60 [0.38, 0.82]**, *p* < 0.001 |
| Moderate vs low | 0.20 [−0.04, 0.44], *p* = 0.113 | **0.34 [0.05, 0.62]**, *p* = 0.003 |
| High vs moderate | −0.09 [−0.33, 0.16], *p* = 0.469 | 0.26 [−0.02, 0.54], *p* = 0.068 |

**Corroborated independently by the 2026 ACSM position stand (§6.16):** strength was enhanced by
loads **≥ 80 % 1RM**, quality of evidence **79 % (high)** — one of its strongest recommendations —
while hypertrophy *"was not affected by"* load once volume was equated.

**So: for growth, load does not matter much if the set is hard. For strength, it matters a lot.**
That asymmetry is the whole finding, and it is 🟢 — two independent syntheses, one of them a position
stand built on 137 reviews.

Two lesser sources, both worth knowing and neither worth modelling:

- **Schoenfeld et al. (2021), *Sports* 9(2):32 — the "repetition continuum" paper this file has
  cited since §10 was written — is STILL NOT READ IN FULL.** mdpi.com returns 403 to this session's
  fetcher. It has now been listed as a source twice without anyone opening it. **Nothing in this file
  should rest on it**; Lopez 2021 and ACSM 2026 carry the claim instead. 🔴 as a citation until
  somebody reads it.
- **Varovic D, Larsen S, Grgic J (2026). "Heavy or Light: Is Muscle Fiber Growth Load-Specific?"
  SportRxiv preprint, 29 April 2026, doi:10.51224/SportRxiv.782** · 8 studies, 195 participants.
  A *tendency* toward type I hypertrophy at 20–30 % 1RM (standardised mean change −0.251 to −0.123)
  and type II at 60–90 % (0.095 to 0.223), with the authors noting *"95 % confidence and prediction
  intervals were wide and in some cases included zero"*. 🔴 — interesting, not usable.

#### 6.13.2 ⚠️ The structural problem, and it is bigger than the evidence

**A planned workout in this app stores no load and no reps.** `normalizeWorkout()` in `js/store.js`
rebuilds each exercise as `{ exerciseId, sets, notes, group?, setType?, minis? }` — a set *count* and
nothing else. Every ready-made system puts its rep prescription in **prose `notes`** ("bench 3–5,
Larsen press 10, Arnold press 8–10"). There is no field for a rating to read, and adding one would
mean asking every user to type a rep target for every exercise before their programme could be
scored, which D9 (progressive disclosure) rules out.

**So load cannot enter the programme rating, and this is not a close call.**

#### 6.13.3 Recommendation — a caveat, and one thing that is actually buildable

- **The growth percentage is safe as it stands.** Lopez 2021 says load does not move hypertrophy when
  sets are taken to failure, so the number the badge shows is not missing much. Add nothing.
- **⚠️ The STRENGTH percentage is not safe, and this is the loudest thing in this pass.** A programme
  of 3 × 20 and a programme of 3 × 5 currently receive **identical strength ratings**, and the
  evidence says the heavy one is better by SMD 0.60 [0.38, 0.82] — a larger effect than anything the
  rating does model. `js/optimal.js` already prints *"every score is conditional on sets being taken
  close to failure"*; it needs the second half: **the strength score also assumes the work is heavy
  (≥ 80 % 1RM, roughly ≤ 8 reps), and the app cannot check that.** Same sentence, same place, no
  model change.
- **What IS buildable, without a new field:** a *recorded* set stores `weight` and `reps`
  (`Session.entries[].sets[]`). So while a *plan* is silent about load, **history is not**. The Goals
  screen's "what your training is actually delivering" could report the share of logged sets done at
  ≤ 8 reps against a strength goal — a measurement of what happened, not a model of what will. That
  is the right home for this finding and it needs no estimator.

**Effect on the nine shipped systems: none computable, because none of them carry machine-readable
load.** That absence *is* the result.

### 6.14 Rest intervals 🟡 — the smallest effect of the four

*Pulled 2026-08-19. Question: does inter-set rest change the hypertrophy or strength return on a set?*

#### 6.14.1 The evidence

**Singer A, Wolf M, Generoso L, et al. "Give it a rest: a systematic review with Bayesian
meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy." *Front Sports
Act Living* 2024;6:1429789.** doi:10.3389/fspor.2024.1429789 · 9 RCTs, 19 measurements (thigh 10,
arm 6, whole body 3).

Binary split, **short ≤ 60 s vs longer > 60 s** (positive favours longer):

| Site | SMD [95 % CrI] |
|---|---|
| Arm | 0.13 [−0.27, 0.51] |
| Thigh | 0.17 [−0.13, 0.43] |
| Whole body | −0.08 [−0.45, 0.29] |

Four-category, effect vs control: short ≤ 60 s **0.47** · intermediate 61–119 s **0.65** · long
120–179 s **0.55** · very long ≥ 180 s **0.50**. Conclusion: *"a small hypertrophic benefit to
employing inter-set rest interval durations > 60 s"* but *"no appreciable differences in hypertrophy
when resting > 90 s between sets."* **Every credible interval crosses zero.**

**ACSM 2026 (§6.16), on strength:** *"strength was not affected … by short (< 1 min) versus long
(> 1 min) between-set rest intervals"* — two reviews, quality of evidence 63 %.

**Remmert et al. (§6.12), as a moderator:** rest length did **not** meaningfully moderate the
per-session volume dose–response — *"the uncertainty intervals of all corresponding contrasts
including zero"* — and they identified the PUOS *"with no meaningful effect of rest period length"*.
This contradicts Krieger's unpublished 2017 analysis, which found diminishing returns above 6–8
`total` sets/session **only when rest was ≥ 2 min**. Remmert's corpus is far larger (12 studies with
≥ 10 sets/session vs Krieger's 2), so the newer null is the better bet, but say that it is contested.

#### 6.14.2 ⚠️ What this contradicts in this file

**§4 of this file reads as though rest length matters more than it does.** §4 leads on Willardson
(2006) — *"3–5 min rest is needed to maintain intensity for strength goals"* — and Senna et al.
(2011). Both are **acute within-session rep-performance** findings and both are correct as stated.
But they sit under a heading a reader will take as advice, and the **chronic adaptation** evidence
says rest length barely moves the outcome either way. §4's own "design implication" (prefer the first
hard set of an exercise for e1RM) is untouched and still right. Nothing needs deleting; the
distinction needs saying.

#### 6.14.3 Recommendation — a caveat, plus one constant that gets a source

- **It cannot enter the model even if it wanted to.** Rest is a **global user setting**
  (`settings.restTarget`, one of 60/90/120/180 s, saved in `js/views-session.js`), not a property of
  a workout or a programme, and no ready-made system declares one. And the effect is trivial.
- **What it DOES license: `MINUTES_PER_SET = 3` in `js/optimal.js` stops being a bare assumption.**
  That constant's own comment currently says *"ARITHMETIC, NOT A FINDING. The rest-interval
  literature is on the 'still to pull' list (docs/research.md §6.8)"* — that pointer is now
  dischargeable. Pelland et al.'s corpus reports the actual rest people took in the studies:
  **1.80 ± 0.68 min for hypertrophy effects and 2.04 ± 0.79 min for strength effects** (their §3.3
  and Fig. 2), median 1.75 min. A working set of 30–45 s plus ~2 min of rest is **~2.5–2.7 min**.
  **3 min is at the top of that band but inside it**, so the constant survives — and it can now cite
  a distribution instead of a shrug.
- **Do not change it.** Moving 3 → 2.6 would shift `perHour` and the *estimated* minutes on
  user-typed systems by ~13 % while leaving every ready-made system's badge alone (they declare their
  own minutes), which is a change that makes two things that should agree disagree. Not worth it.

**Effect on the nine shipped systems: none.** All nine declare their own session length.

**Grade: 🟡.** Three sources agree the effect is small-to-null, but the hypertrophy meta-analysis is
9 RCTs of mostly untrained, younger participants over 5–10 weeks with *"no data on torso
musculature"*, and its authors say so.

### 6.15 Range of motion 🟡 — and lengthened partials

*Pulled 2026-08-19.*

#### 6.15.1 The evidence

**Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J (2023). "Partial Vs Full Range of
Motion Resistance Training: A Systematic Review and Meta-Analysis." *International Journal of
Strength and Conditioning* 3(1).** doi:10.47206/ijsc.v3i1.182

- Main model: **SMD 0.12 [95 % CI −0.02, 0.26] favouring full ROM** — trivial, interval touches zero.
- Sub-group, **partials at LONG muscle lengths vs full ROM: −0.28 [−0.81, 0.16]** — the sign flips
  toward the lengthened partial, and the interval is wide enough to mean nothing on its own.
- Strength adaptations were greater when the trained ROM **matched the tested ROM** — a specificity
  effect, not a ROM effect.
- Authors: *"using a full or long ROM may enhance results for most outcomes"*, and partial ROM
  *"might present an efficacious alternative for variation and personal preference, or where injury
  prevents full-ROM resistance training."*

**Wolf M, et al. "Lengthened partial repetitions elicit similar muscular adaptations as full range of
motion repetitions during resistance training in trained individuals." *PeerJ* 2025;13:e18904.**
doi:10.7717/peerj.18904 · within-participant, limbs randomised; **25 resistance-trained participants**
(19 men, 6 women, 4.9 ± 4.1 y experience), **8 weeks**, eight upper-body exercises, 2 sessions/week,
4 sets per exercise. Lengthened partials ≈ 50 % ROM from the fully lengthened position.

| Outcome | Difference [95 % CrI] | Bayes factor |
|---|---|---|
| Elbow flexor MT, 45 % | −0.23 mm [−1.4, 0.94] | 0.19 |
| Elbow flexor MT, 55 % | −0.08 mm [−1.1, 0.90] | 0.16 |
| Elbow extensor MT, 45 % | 0.40 mm [−1.1, 1.9] | 0.20 |
| Elbow extensor MT, 55 % | 0.82 mm [−0.44, 2.1] | 0.39 |
| 10RM lat pulldown, full ROM | −1.2 kg [−3.7, 1.3] | 0.30 |

**Every Bayes factor is 0.16–0.39 — moderate support for the NULL**, which is a stronger and rarer
result than a wide interval. Authors: *"Trainees seeking to maximize muscle size should likely
emphasize the stretched position, either by using a full ROM or LPs"*; adding the short-muscle-length
half of the range *"did not appear to enhance muscle hypertrophy"*.

**ACSM 2026 (§6.16)** lists **full range of motion as a STRENGTH enhancer** (quality of evidence
50 %, moderate) and does **not** list ROM among the things that enhanced hypertrophy.

**Read together: what matters is training the muscle at long lengths, not the distance the weight
travels.** Full ROM gets you there by default; a lengthened partial gets you there too; a shortened
partial does not.

#### 6.15.2 Recommendation — a caveat, and specifically *not* a field

- **Nothing enters the model.** ROM is a property of how a rep is performed. The app records nothing
  about it and **should not start asking**: a per-set ROM field is jargon (D8), it is one more thing
  to fill in mid-set (D28), and self-reported ROM is the kind of data that is wrong in a direction
  that flatters. This is the clearest "the evidence is real and the app must not model it" case of
  the four.
- **It licenses a teaching note at the point of use (D8)**, which the app has a shape for already:
  where an exercise's notes explain what it is for, they can honestly say *"train the stretch — full
  range, or if you shorten it, shorten the top rather than the bottom"*, cited to Wolf 2023 + Wolf
  2025 + ACSM 2026.
- **Do not repeat the popular version.** "Lengthened partials beat full ROM" is not what these say.
  The best current reading is **"similar, and both beat short-length work"**, and the 2025 trial's
  own limitations list runs to seven items including 8 weeks being possibly too short and a
  cross-education confound from the within-participant design.

**Effect on the nine shipped systems: none.** No system declares a range of motion and none should.

**Grade: 🟡.** One meta-analysis whose headline interval crosses zero, one well-designed but small
8-week trial, and a position stand that grades its own ROM recommendation at 50 %.

### 6.16 ⚠️ ACSM 2026 — the position stand this project did not know existed 🟢

*Found 2026-08-19 while searching for §6.13. It bears on every section of this file and it supersedes
one of them.*

**Currier BS, D'Souza AC, Fiatarone Singh MA, et al. "American College of Sports Medicine Position
Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in
Healthy Adults: An Overview of Reviews." *Med Sci Sports Exerc* 2026;58(4):851–872.**
doi:10.1249/MSS.0000000000003897 · published online 5 March 2026 · chaired by Stuart M. Phillips ·
**137 systematic reviews, > 30,000 participants** · **the first ACSM resistance-training position
stand in 17 years.** Read via the free PMC copy, PMC12965823; the publisher's own page is paywalled.

Recommendations, with the position stand's own quality-of-evidence scores:

| Outcome | What helped | QoE |
|---|---|---|
| **Strength** | loads **≥ 80 % 1RM** (dose–response) | 79 % high |
| | **2–3 sets** per session | 71 % high |
| | **≥ 2 sessions/week** | 69 % mod–high |
| | **full range of motion** | 50 % moderate |
| | trained at the **beginning of the session**, not the end | **88 % high** |
| **Hypertrophy** | **≥ 10 sets/week** (dose–response) | 50 % moderate |
| | **eccentric contractions / overload** | 75 % high |
| **Power** | loads **30–70 % 1RM**; volume ≤ 24 reps·sets; Olympic-style lifting | 75 % high |

And the negatives, which are as useful: hypertrophy was **not** affected by load when volume was
equated, and **not** affected by frequency (1 d/wk vs > 5 d/wk) when volume was equated. Strength was
not affected by rest-interval length. **Training to momentary failure, equipment type, time under
tension, blood flow restriction and periodisation did not consistently affect outcomes** — sufficient
effort *"can be accomplished by … 'near-failure' or a target of 2–3 repetitions in reserve"*.

#### 6.16.1 ⚠️ Four things this changes for this project

1. **§12.1 of this file is stale.** It calls ACSM 2009 *"the standing position stand"*. It is not, as
   of March 2026. See **§12.5** — the 2-for-2 rule is not repeated in the 2026 stand, though it is
   not contradicted either; the 2026 stand simply declines to prescribe a progression rule.
2. **The 2026 stand's headline hypertrophy volume figure is ≥ 10 sets/week, and this app's stated
   minimum effective dose is 4.** Both are right and they answer different questions — Pelland's 4 is
   *"where an effect first exceeds the smallest detectable effect size"*, ACSM's 10 is where the
   dose–response is worth chasing — but `js/optimal.js` reports muscles under **4** as "under" and
   says nothing about 10. Computed against the nine:

   | System | muscles under 4/wk | muscles under 10/wk | the ones under 10 |
   |---|---|---|---|
   | Ultimate Push Pull Legs | 0 of 11 | 3 of 11 | Traps, Glutes, Calves |
   | Dr. Mike's Floating Split | 2 | 4 | Traps, Hamstrings, Glutes, Calves |
   | The Golden Six | 3 | **7** | Chest, Back, Traps, Forearms, Hamstrings, Glutes, Calves |
   | Mike Thurston's Six-Day Split | 1 | 2 | Traps, Calves |
   | Chris Bumstead's 8-Day Split | 3 | 5 | Traps, Quads, Hamstrings, Glutes, Calves |
   | Volume Landmarks Hypertrophy | 1 | 4 | Traps, Forearms, Glutes, Calves |
   | Push Pull Legs | 0 | 1 | Calves |
   | Upper / Lower | 0 | 3 | Chest, Traps, Calves |
   | Full Body, 3 Days | 0 | **8** | Chest, Traps, Biceps, Forearms, Quads, Hamstrings, Glutes, Calves |

   **Calves are under 10 in all nine and Traps in eight of nine.** A programme can pass the app's
   "every muscle gets the minimum effective dose" line and still leave eight of eleven muscles below
   the figure a 2026 position stand puts in its abstract. That is worth a second tier in the wording,
   not a change to the score.
3. **Exercise ORDER is the highest-quality-of-evidence finding in the whole stand (88 %) and nothing
   in this app models or mentions it.** Strength work belongs at the start of a session. The app
   knows the order of exercises in every workout and every recorded session, so this is one of the
   few remaining findings it could actually act on. **It replaces "exercise selection and variation"
   as the top item on the still-to-pull list.**
4. **"Training to failure is not required" is now a position-stand-level statement**, with 2–3 RIR
   named as sufficient. §6.7 and `js/optimal.js` both currently phrase the caveat as *"conditional on
   sets being taken close to failure"* — which is still right, and is now better supported as a
   *floor* ("hard enough") rather than an *instruction* ("to failure"). Worth a wording pass wherever
   the app says "close to failure", because telling strangers to train to failure is advice this
   project should not be giving by implication.

**Grade: 🟢.** A position stand over 137 systematic reviews, with per-recommendation quality grades —
the strongest single source in this file. Its own limitation is inherited: an overview of reviews is
only as good as the reviews, and the stand grades several of its own recommendations at 50 %.

### 6.17 ⚠️ What this pass contradicts about what the app currently does

The single most valuable output of the four pulls, collected in one place.

#### 6.17.1 The 0.5 indirect weight is the largest untested assumption in the rating

`js/volume-map.js` sets `INDIRECT = 0.5`, on §6.4's authority. That is still the best-supported of
the three counting methods **that were tested**. But both papers ran an *exploratory continuous* fit
asking what weight would actually maximise model performance, and neither answer is 0.5:

- Remmert et al. (§6.12), https://osf.io/cuvsa — an indirect set is worth **~32 % of a direct set for
  hypertrophy** and **~16 %** for per-session strength. They say plainly: *"one might reasonably
  critique the present study quantifying all indirect sets as 50 % of a direct set."*
- Pelland et al. (§6.1), https://osf.io/rm4xy — **~39 %** for weekly strength volume.
- Pelland et al. also state the general form: *"the appropriate weighting of indirect sets likely
  depends on several factors, including the hypertrophy/strength outcome measured, the specific
  exercise trained, the repetition range employed, and the training status of the participants."*

**Computed effect of moving 0.5 → 0.32 on the nine — five of nine growth ratings drop a band:**

| System | Growth @ 0.5 | @ 0.32 | Strength @ 0.5 | @ 0.16 |
|---|---|---|---|---|
| Ultimate Push Pull Legs | 55 | 55 | 80 | 80 |
| Dr. Mike's Floating Split | 50 | **45** | 80 | **75** |
| The Golden Six | 35 | 35 | 55 | 55 |
| Mike Thurston's Six-Day Split | 55 | **50** | 65 | 65 |
| Chris Bumstead's 8-Day Split | 45 | **40** | 70 | **65** |
| Volume Landmarks Hypertrophy | 50 | **45** | 80 | **75** |
| Push Pull Legs | 65 | **60** | 80 | **75** |
| Upper / Lower | 50 | 50 | 75 | 75 |
| Full Body, 3 Days | 40 | 40 | 75 | **70** |

**That is a far bigger lever than anything in §6.12–§6.15**, and it is one constant. **Recommendation:
keep 0.5** — it is the best-supported of the methods actually compared, and switching to an
exploratory continuous fit reported in a supplement would be trading a tested heuristic for a guess.
**But state the sensitivity**, because "half a set" currently reads on screen as a fact and it is a
choice with a five-band swing behind it.

#### 6.17.2 The strength score assumes heavy work and cannot check

See §6.13.3. `js/optimal.js` states one conditional (sets near failure) and needs two.

#### 6.17.3 §4 reads as a rest-interval recommendation and is an acute-fatigue finding

See §6.14.2.

#### 6.17.4 §12.1 calls a 2009 document "the standing position stand"

See §6.16.1 and §12.5.

#### 6.17.5 §6.11 shipped with no citations

Fixed in §6.18.3. It is cited **on the live Goals screen**, which makes it the one that mattered.

### 6.18 Re-checks of §6.9, §6.10 and §6.11 — the three cited on the Goals screen

*Checked 2026-08-19, because a wrong citation on screen is worse than a missing one and this file has
had to correct itself about sleep once already.*

#### 6.18.1 Protein (§6.9) 🟢 → **corroborated independently. No change needed.**

**Tagawa R, Watanabe D, Ito K, et al. "Synergistic Effect of Increased Total Protein Intake and
Strength Training on Muscle Strength: A Dose-Response Meta-analysis of Randomized Controlled Trials."
*Sports Med Open* 2022;8:110.** · **82 RCTs, 3,940 participants** (59 studies / 2,440 participants
with resistance training).

- Muscle strength rose **0.72 % [95 % CI 0.40, 1.04] per 0.1 g/kg/day** of extra total protein,
  **up to 1.5 g/kg/day, and nothing thereafter.**
- **1.5 g/kg = 0.68 g per lb.** Morton's breakpoint was 1.62 g/kg = 0.73 g/lb.

**Different corpus, different outcome (strength not fat-free mass), different method (spline
regression not a two-line meta-regression) — and the breakpoint lands within 0.12 g/kg.** That is a
real replication and it upgrades §6.9 from "one good meta-analysis" to two independent ones agreeing.
The Goals screen's **0.73 g/lb is safe**, and if anything sits slightly *above* the newer estimate,
which is the right side to err on.

⚠️ **What is NOT settled** 🔴: several groups argue the plateau is an artefact of trial design and
that trained lifters gain above 1.6 g/kg. No meta-analysis supports that yet, and the app should not
move until one does. Tagawa's own limitations: English and Japanese only, PubMed and Ichushi-Web
only, high heterogeneity, and spline modelling that is *"data-oriented"* and *"doesn't account for
protein physiology"*.

#### 6.18.2 Sleep (§6.10) 🟡 → **unchanged, and still no dose–response. The screen's sentence stands.**

Searched again August 2026 specifically for a habitual-hours dose–response. There still is not one.
What exists since the last pass is mechanistic or unfinished:

- Sustained sleep restriction + resistance exercise, skeletal muscle transcriptomics in young
  females — *Physiological Genomics*, 2024 (doi:10.1152/physiolgenomics.00010.2024). Mechanism, not
  a training outcome.
- **NCT06223776**, "Effects of Sleep Restrictions on Maximal Strength, Muscle Power, and Strength
  Endurance in Resistance-trained Women" — **registered, not reported.** This is the study that would
  change §6.10. Worth re-checking rather than re-searching.
- Narrative and review material (e.g. *J Clin Med* 2025;14(21):7606) restates the mechanism without
  adding a dose.

**So the ✅/❌ pair in §6.10 is unchanged and still correct.** The app may say a night without sleep
cuts muscle protein synthesis ~18 %; it may not say "you need 8 hours for this goal".

#### 6.18.3 Individual variability (§6.11) 🟢 → **sources supplied, and one line refined**

The numbers were right. They had no citation, which by this file's own standard made them a defect.

- **Hubal MJ, Gordish-Dressman H, Thompson PD, et al. "Variability in muscle size and strength gain
  after unilateral resistance training." *Med Sci Sports Exerc* 2005;37(6):964–972.** **n = 585**
  (342 women, 243 men) across eight centres, **12 weeks** of progressive training of the
  **non-dominant** elbow flexors, dominant arm as the within-person control. Changes: **biceps CSA
  −2 % to +59 %**, **1RM 0 % to +250 %**, **MVC −32 % to +149 %**. That is where §6.11's "0–250 %"
  and "−2 % to 59 %" come from, and the unilateral design is why it is the canonical citation — the
  untrained arm controls for everything the trained arm was exposed to.
- **Räntilä A, et al. "Repeated Resistance Training Reveals the Reproducibility of Muscle Strength
  and Size Responses Within Individuals." *European Journal of Sport Science*, 2025.**
  doi:10.1002/ejsc.70095 · PMC12659766 · untrained adults (32 ± 5 y) completed **two identical
  10-week blocks separated by 10 weeks of detraining**.
  - Response magnitude reproduced between blocks: **vastus lateralis CSA r = 0.697, biceps brachii
    CSA r = 0.761, leg press 1RM r = 0.671** (all *p* ≤ 0.001); biceps curl 1RM only a trend
    (r = 0.393, *p* = 0.095).
  - ⚠️ **"Nonresponders were identified, but none were detected in both RT periods for more than one
    variable."**

⚠️ **The refinement that matters for Goals.** §6.11 said *"individual responsiveness is
reproducible"*. Half of that is now well supported and half is not: **how much you respond is
reproducible; being a non-responder is not.** Somebody who gains nothing in one block is not thereby
a person who gains nothing — they were a non-responder *on that measure, in that block*. The Goals
screen must never let a bad 12 weeks read as a verdict about the person, which is a second and
independent reason for the refusal `js/goals.js` already implements.

---

## 7. Competitive landscape

Full teardown: `docs/competitive-teardown.html`, also published at
https://claude.ai/code/artifact/e3a7adce-c1cf-4284-8eff-762db7da6bbd

Analysed: Strong, Hevy, Boostcamp, Liftosaur, Alpha Progression, RP Hypertrophy, Fitbod.

| App | What it's best at |
|---|---|
| Strong | The logging loop — the interaction gold standard |
| Hevy | Polish and feel, free unlimited logging, real web app |
| Boostcamp | Solves "what program do I run", free, 11,000+ programs |
| Liftosaur | Progression as code; no ceiling on program logic |
| Alpha Progression | Weekly volume per muscle vs evidence-based targets — the right metric |
| RP Hypertrophy | True autoregulation from post-session subjective feedback |
| Fitbod | Zero-decision onboarding; equipment-aware substitution |

**Five failures shared by all:** data goes in but insight doesn't come out; offline is an
afterthought; analysis is per-exercise not per-muscle; the jargon wall; you can't answer "is this
working?"

**The gap being built into:** four of five commercial apps monetise by restricting access to your
own accumulated data — Hevy caps free graph history at 3 months.

**Note (2026-08-15):** Fitbod published the §1 formula from its own user data. Worth watching
whether they ship weight-dependent e1RM in-product; if they do, this stops being a differentiator
and becomes table stakes.

---

## 8. Data-viz colour validation

Series colours are validated, never eyeballed. `--series-start` / `--series-now` in `css/app.css`,
deliberately not the UI accent.

| Theme | Start | Now | CVD ΔE | Normal ΔE | Contrast |
|---|---|---|---|---|---|
| Dark | `#3D8FC0` | `#C08430` | 19.6 | 23.2 | 5.3 / 5.9 |
| Light | `#2C7CB0` | `#96660F` | 20.7 | 22.1 | 4.1 / 4.5 |

Thresholds: OKLCH L in [0.48, 0.67] dark / [0.43, 0.77] light; chroma ≥ 0.10; CVD ΔE ≥ 8;
normal-vision ΔE ≥ 15; contrast ≥ 3:1.

**Before building any new chart, load the `dataviz` skill and run its validator.**

### Chart text contrast (checked 2026-08-15)

The hover readout's halo is `--ground`, so its effective contrast is just the text colour against
`--ground`:

| Token | Dark | Light | |
|---|---|---|---|
| `--ink` | 16.25:1 | 15.84:1 | AA — used for the value |
| `--ink-soft` | 7.15:1 | 5.46:1 | AA — used for the date |
| `--ink-faint` | 3.94:1 | **3.05:1** | fails AA at small sizes |

`--ink-faint` is fine for static captions and is used that way throughout the app, but it was
switched to `--ink-soft` for the hover date — a 10.5px label someone is actively reading a number
off deserves better than 3.05:1.
 Bars carry direct
value labels and text tags so identity is never colour-alone. A third series — needed if estimated
and measured points get distinct colours — must be re-validated as a set of three, not bolted on.

---

## 9. Unverified claims and open questions

Don't treat these as settled.

- 🔴 That **Hevy requires a connection to log**. Asserted in the teardown, never verified.
- 🔴 Whether **Liftosaur's cloud sync is paid**.
- 🔴 The **10–20 sets/muscle/week** band — repeated everywhere, primary sources not yet read here.
- 🟡 Whether the Marzagão formula's advantage survives **external validation against measured 1RMs**.
  No such study exists. If one appears, revisit §1.
- 🟡 Whether **weight-as-proxy** breaks down for our library specifically — e.g. a heavy machine
  calf raise gets a compound-lift `k` despite being isolation work with a very high rep capacity.
  Testable against our own data once benchmarks accumulate.
- Open: whether to expose raw **e1RM** as a chart mode alongside normalised equivalent load. Raw
  e1RM is simpler (no modal-rep bookkeeping, no re-baselining) but shows a number the user never
  lifted; normalised load stays in familiar units. Current lean: ship normalised, keep e1RM as a
  later toggle.

---

## 10. Sources

**Training volume, frequency and the dose response** (§6, pulled 2026-08-18)

- Pelland, Remmert, Robinson, Hinson & Zourdos (2025). *The Resistance Training Dose Response:
  Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and
  Strength Gains.* Sports Medicine. doi:10.1007/s40279-025-02344-w —
  https://link.springer.com/article/10.1007/s40279-025-02344-w · PubMed 41343037 ·
  data and supplements at https://osf.io/6z3xu
- Robinson, Pelland, Remmert, Refalo, Jukic, Steele & Zourdos (2024). *Exploring the Dose–Response
  Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle
  Hypertrophy: A Series of Meta-Regressions.* Sports Medicine 54(9).
  doi:10.1007/s40279-024-02069-2 — https://pubmed.ncbi.nlm.nih.gov/38970765/ ·
  preprint https://sportrxiv.org/index.php/server/preprint/view/295

**Rep-normalisation / 1RM prediction**

- Marzagão, T. (2026). *A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure
  Sets Across 388 Exercises.* arXiv:2603.17495 — https://arxiv.org/abs/2603.17495
- Nuzzo, Pinto, Nosaka & Steele (2024). *Maximal Number of Repetitions at Percentages of the One
  Repetition Maximum: A Meta-Regression and Moderator Analysis of Sex, Age, Training Status, and
  Exercise.* Sports Medicine 54(2), 303–321 — https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/
- LeSuer, McCormick, Mayhew, Wasserstein & Arnold (1997). *The accuracy of prediction equations for
  estimating 1-RM performance in the bench press, squat and deadlift.* JSCR 11(4), 211–213.
- Reynolds, Gordon & Robergs (2006). *Prediction of one repetition maximum strength from multiple
  repetition maximum testing and anthropometry.* JSCR 20(3), 584–592.
- Mayhew, Johnson, LaMonte, Lauber & Kemmler (2008). *Accuracy of prediction equations for
  determining one repetition maximum bench press in women before and after resistance training.*
  JSCR 22(5), 1570–1577.
- Mayhew, Ball, Arnold & Bowen (1992). *Relative muscular endurance performance as a predictor of
  bench press strength in college men and women.* J Appl Sport Sci Res 6(4), 200–206.
- Brzycki, M. (1993). *Strength testing — predicting a one-rep max from reps-to-fatigue.* JOPERD
  64(1), 88–90.
- Epley, B. (1985). *Poundage chart.* In *Boyd Epley Workout.* Lincoln, NE: Body Enterprises.
- Wathen, D. (1994). *Load assignment.* In Baechle (Ed.), *Essentials of Strength Training and
  Conditioning*, 435–439.
- Lander, J. (1985). *Maximum based on reps.* NSCA Journal 6(6), 60–61.
- Lombardi, V. P. (1989). *Beginning weight training: the safe and effective way.*
- O'Conner, Simmons & O'Shea (1989). *Weight training today.*
- Robergs & Landwehr — 1RM strength-prediction review —
  https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf

**Reps ↔ %1RM**

- Shimano et al. (2006). *Relationship between the number of repetitions and selected percentages of
  1RM in free weight exercises in trained and untrained men.* JSCR 20(4), 819–823.
- Richens & Cleather (2014). *The relationship between the number of repetitions performed at given
  intensities is different in endurance and strength trained athletes.* Biology of Sport 31(2),
  157–161.

**Proximity to failure**

- Steele et al. (2017). *Ability to predict repetitions to momentary failure is not perfectly
  accurate, though improves with resistance training experience.* PeerJ 5, e4105.
- Refalo et al. (2024). *Accuracy of intraset repetitions-in-reserve predictions during the bench
  press exercise in resistance-trained male and female subjects.* JSCR 38(3), e78–e85.
- Zourdos et al. (2016). *Novel resistance training-specific rating of perceived exertion scale
  measuring repetitions in reserve.* JSCR 30(1), 267–275.

**Fatigue and rest**

- Willardson, J. M. (2006). *A brief review: factors affecting the length of the rest interval
  between resistance exercise sets.* JSCR 20(4), 978–984.
- Senna et al. (2011). *The effect of rest interval length on multi and single-joint exercise
  performance and perceived exertion.* JSCR 25(11), 3157–3162.

**Velocity-based**

- González-Badillo & Sánchez-Medina (2010). *Movement velocity as a measure of loading intensity in
  resistance training.* Int J Sports Med 31(5), 347–352.
- Greig, Aspe, Hall, Comfort, Cooper & Swinton (2023). *The predictive validity of individualised
  load–velocity relationships for predicting 1RM: a systematic review and individual participant
  data meta-analysis.* Sports Medicine 53(9), 1693–1708.

**Volume / rep continuum**

- Schoenfeld et al. (2021). *Loading recommendations for muscle strength, hypertrophy, and local
  endurance: a re-examination of the repetition continuum.* Sports 9(2), 32 —
  https://www.mdpi.com/2075-4663/9/2/32
  ⚠️ **Listed here twice over and still never read in full** — mdpi.com refuses this project's
  fetcher. Nothing in this file rests on it; see §6.13.1.

**§6.8's four axes** (pulled 2026-08-19 — §6.12 to §6.16)

- Remmert, Pelland, Robinson, Hinson & Zourdos (2025). *Is There Too Much of a Good Thing?
  Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength.* SportRxiv
  preprint, 2 April 2025 — https://sportrxiv.org/index.php/server/preprint/view/537 ·
  supplements https://osf.io/dqka3/ · **not peer-reviewed as of August 2026**
- Currier, D'Souza, Fiatarone Singh, et al. (2026). *American College of Sports Medicine Position
  Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance
  in Healthy Adults: An Overview of Reviews.* Med Sci Sports Exerc 58(4), 851–872.
  doi:10.1249/MSS.0000000000003897 — https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/ ·
  PubMed 41843416
- Lopez, Radaelli, Taaffe, et al. (2021). *Resistance Training Load Effects on Muscle Hypertrophy and
  Strength Gain: Systematic Review and Network Meta-analysis.* Med Sci Sports Exerc 53(6), 1206–1216.
  doi:10.1249/MSS.0000000000002585 — https://pmc.ncbi.nlm.nih.gov/articles/PMC8126497/
- Varovic, Larsen & Grgic (2026). *Heavy or Light: Is Muscle Fiber Growth Load-Specific? A Systematic
  Review and Meta-Regression.* SportRxiv preprint, 29 April 2026. doi:10.51224/SportRxiv.782 —
  https://sportrxiv.org/index.php/server/preprint/view/782
- Singer, Wolf, Generoso, et al. (2024). *Give it a rest: a systematic review with Bayesian
  meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy.* Front
  Sports Act Living 6, 1429789. doi:10.3389/fspor.2024.1429789 —
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/
- Wolf, Androulakis-Korakakis, Fisher, Schoenfeld & Steele (2023). *Partial Vs Full Range of Motion
  Resistance Training: A Systematic Review and Meta-Analysis.* International Journal of Strength and
  Conditioning 3(1). doi:10.47206/ijsc.v3i1.182 — https://journal.iusca.org/index.php/Journal/article/view/182
- Wolf, et al. (2025). *Lengthened partial repetitions elicit similar muscular adaptations as full
  range of motion repetitions during resistance training in trained individuals.* PeerJ 13, e18904.
  doi:10.7717/peerj.18904 — https://pmc.ncbi.nlm.nih.gov/articles/PMC11829627/

**Protein, sleep and individual variability** (§6.9–§6.11, re-checked 2026-08-19 — §6.18)

- Morton, Murphy, McKellar, et al. (2018). *A systematic review, meta-analysis and meta-regression of
  the effect of protein supplementation on resistance training-induced gains in muscle mass and
  strength in healthy adults.* Br J Sports Med 52(6), 376–384 —
  https://pubmed.ncbi.nlm.nih.gov/28698222/
- Tagawa, Watanabe, Ito, et al. (2022). *Synergistic Effect of Increased Total Protein Intake and
  Strength Training on Muscle Strength: A Dose-Response Meta-analysis of Randomized Controlled
  Trials.* Sports Med Open 8, 110 — https://pmc.ncbi.nlm.nih.gov/articles/PMC9441410/
- Lamon, Morabito, Arentson-Lantz, et al. (2021). *The effect of acute sleep deprivation on skeletal
  muscle protein synthesis and the hormonal environment.* Physiological Reports 9(1), e14660.
- Knowles, Drinkwater, Urwin, Lamon & Aisbett (2018). *Inadequate sleep and muscle strength:
  implications for resistance training.* J Sci Med Sport 21(9), 959–968.
- Hubal, Gordish-Dressman, Thompson, et al. (2005). *Variability in muscle size and strength gain
  after unilateral resistance training.* Med Sci Sports Exerc 37(6), 964–972.
- Räntilä, et al. (2025). *Repeated Resistance Training Reveals the Reproducibility of Muscle
  Strength and Size Responses Within Individuals.* European Journal of Sport Science.
  doi:10.1002/ejsc.70095 — https://pmc.ncbi.nlm.nih.gov/articles/PMC12659766/ · PubMed 41307987

**Competitive**

- `docs/competitive-teardown.html` — full teardown of seven apps.

---

## 12. Progression — how much to add, and when 🟢

*Researched 2026-08-18 for `docs/goals-plan.md` §8. Driver: Tim — progression must be decoupled from
any goal, but it still needs a system, and "most of the time increasing the weight (even by a little)
is too much".*

### 12.1 The anchor

**American College of Sports Medicine. "Progression Models in Resistance Training for Healthy
Adults." *Med Sci Sports Exerc*, 2009.** ~~The standing position stand~~ **⚠️ superseded as "the
standing position stand" on 2026-03-05 — see §12.5 and §6.16.** Still the source of the rule, and it
states it directly:

> A **2–10 % increase in load** should be applied **when the individual can perform the current
> workload for one to two repetitions over the desired number on two consecutive training
> sessions** — the size of the increase chosen "on the basis of muscle group size and involvement".

That is the **"2-for-2 rule"**, and it is the formal version of exactly what Tim described: earn the
reps first, then take the weight up and let the reps fall back.

Also stated: novices train around **8–12 RM**; intermediate and advanced use a wider **1–12 RM**
range, periodised, with eventual emphasis on heavy loading.

### 12.2 ⚠️ The finding that matters most for this app

**2–10 % is often SMALLER than the smallest plate you own**, and that is why adding weight usually
feels like too much. Computed against the app's own ±5 lb / ±2.5 kg stepper:

| Working weight | +5 lb is | Within the 2–10 % band? |
|---|---|---|
| 20 lb | **25.0 %** | no — two and a half times the ceiling |
| 30 lb | **16.7 %** | no |
| 40 lb | **12.5 %** | no |
| 50 lb | 10.0 % | just |
| 100 lb | 5.0 % | comfortably |
| 225 lb | 2.2 % | at the bottom of the band |

**A 5 lb jump only falls inside the recommended band at 50 lb and above**, and only reaches the
middle of it at 100 lb. Below that — which is most isolation work, most dumbbell work, and every
beginner's compound lifts — the smallest jump available is a bigger step than the evidence
recommends.

**So Tim's instinct is right and now quantified: for light lifts, reps are the only increment fine
enough to progress with.** Adding a rep to a 3×10 at 40 lb is roughly a 3 % increase in work; adding
5 lb is 12.5 %.

### 12.3 What this licenses the app to do

- **Double progression**, which is the 2-for-2 rule applied: hold the weight, add reps up the range,
  then add the smallest available load and drop back to the bottom of the range.
- **Only suggest a load increase after two consecutive sessions at the top of the range**, not one.
  One good session is noise; the position stand says two.
- **Size the jump by the lift**, not by a fixed number: bigger muscle groups tolerate the top of the
  2–10 % band, isolation work the bottom.
- **Say when the jump is unavoidably too big.** At 30 lb there is no honest 2–10 % increment with
  5 lb plates; the answer is another rep, another set, or microplates — and saying that is more use
  than silently suggesting a 17 % jump.

### 12.4 Limits

- The 2–10 % band is a **practitioner consensus**, not a dose–response curve — there is no
  meta-regression here of the kind `docs/research.md` §6 has for volume. 🟡 on the exact numbers,
  🟢 on the shape (earn reps, then add load, in small steps).
- It says nothing about what to do after a **missed block**. Coming back from a lay-off wants a
  reduction, and how much is not covered by this source.
- All of it assumes sets are taken near failure (§6.7), which the app cannot see.

### 12.5 ⚠️ ACSM published a NEW position stand on 2026-03-05, and it does not repeat this rule

*Added 2026-08-19. See §6.16 for the full extraction.*

**Currier BS, D'Souza AC, Fiatarone Singh MA, et al. "American College of Sports Medicine Position
Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in
Healthy Adults: An Overview of Reviews." *Med Sci Sports Exerc* 2026;58(4):851–872.**
doi:10.1249/MSS.0000000000003897 · 137 systematic reviews, > 30,000 participants · **the first ACSM
resistance-training position stand since 2009.**

**What changes:** §12.1 called the 2009 document *"the standing position stand"*. As of 5 March 2026
it is not. That phrase is struck above.

**What does NOT change — and this is the important half.** The 2026 stand **neither restates nor
contradicts** the 2-for-2 rule or the 2–10 % load band. It does not prescribe a progression rule at
all. What it says about progression is broader and, for this app's audience, more interesting:

> progressive overload *"refers to the need to increase the stimulus … such as load, volume, training
> frequency, exercise selection, or duration"* — and *"progression is not necessary to achieve
> beneficial outcomes"*, being *"likely a requirement only for those seeking continued longer term
> progress."*

**So `docs/goals-plan.md` §8 stands, and Goals Phase 4 does not need rewriting.** The 2-for-2 rule
remains the only *specific*, quantified progression rule any position stand has published, and it is
still sourced to ACSM — it is simply no longer sourced to the *current* one. Two consequences for
what the app says out loud:

1. **Stop calling ACSM 2009 "current" or "the standing position stand" anywhere.** Cite it by year.
   The honest sentence is *"the last ACSM position stand to give a specific progression rule, 2009"*.
2. **The 2026 stand licenses a gentler framing that suits this app better.** Progression is for
   people chasing continued progress, not a duty. That fits `docs/goals-plan.md` §3.1 — the section
   about never raising a weight because a deadline is approaching — and it gives that refusal a
   position-stand citation it did not have.

---

## 11. Strength standards and percentile ranking

*Researched 2026-08-15 for the strength-map feature. Full design in `docs/strength-map-plan.md`.*

**The reference population is the whole ballgame.** 🟢 Three different populations are used by three
different sources, and they disagree enormously:

| Source | Population | Size |
|---|---|---|
| Strength Level | app users who log lifts | 153 M lifts, 13 M lifters (Apr 2026) |
| Gravitus | app users who log lifts | 10 M workouts, 300 k lifters |
| Barbell Medicine | drug-tested competition entries | 809,986 entries, 15 federations, 1968–2022 |
| ExRx | published bodyweight-multiple standards | methodology-based, conservative at upper tiers |

Barbell Medicine states outright that **the general adult population sits well below the 50th
percentile of competition data**. Strength Level and Gravitus both define tiers as fixed percentiles
of their own logging population: **Beginner 5th, Novice 20th, Intermediate 50th, Advanced 80th,
Elite 95th.** Those two agree with each other, which is reassuring for the middle of the range.

**Cross-check at 180 lb male** — ExRx-style ratios vs Gravitus measured medians:

| Lift | ExRx ratio → lb | Gravitus median |
|---|---|---|
| Bench press | 1.25× → 225 | 225 |
| Back squat | 1.50× → 275 | 275 |
| Deadlift | 1.75× → 315 | 320 |
| Overhead press | 0.70× → 126 | 130 |
| Barbell row | 1.10× → 198 | 205 |

Independent methods landing within ~3 % is good evidence the middle of the distribution is solid.
The tails are not — above roughly the 97th percentile the data thins and estimates diverge.

**Sex.** 🟢 Women's standards run roughly 20–30 % lower in absolute ratio terms at the same body
weight and training tier. Barbell Medicine's 90th percentile bench: 1.95× bodyweight male vs 1.35×
female.

**Age.** 🟢 Strength peaks ~23–40 and declines after. Powerlifting age-grades with the **McCulloch
coefficients** (1.00 at 40, 1.130 at 50, 1.381 at 60) and **Foster** coefficients for ages 14–23.
Trained populations decline substantially more slowly than untrained ones. Note this is *absolute
strength* — distinct from Nuzzo et al. (§2) finding age did not moderate the reps–%1RM relationship.

**Distribution shape.** 🟡 Roughly log-normal. Fitting σ ≈ 0.32 in log space to a 225 lb median
reproduces the published tier anchors closely, and is what the band-spacing analysis in the plan
document uses. Treat anything above the 97th percentile as unreliable.

**Licensing.** Strength Level's dataset is proprietary — not scrapeable. ExRx standards are published
and widely republished; OpenPowerlifting is openly licensed and allows computing percentiles
directly. The stock anatomy image Tim referenced is a watermarked Dreamstime asset
(ID 142535635, © Vectorville) and cannot be used — the body must be hand-authored SVG.

---

## 13. The basics, for the Research tab 🟢 / 🟡

*Pulled 2026-08-30. Driver: Tim — "collect information to educate users on the basics of
weightlifting and some of the stuff science has confidently determined through studies and
research… Remember that a lot of information can be completely false or missrepresented, so before
we put anything on here, we need to be confident."*

**Six of his questions were already answered in this file** and needed no new sources: hypertrophy
vs strength (§6.13 load, §6.3 frequency, §6.16 order), sets and reps (§6.1–§6.5, §6.12), reps in
reserve (§3, §6.7, §6.16), rest between sets (§6.14), range of motion (§6.15), progression (§12),
protein (§6.9, §6.18.1), sleep (§6.10, §6.18.2) and individual variability (§6.11, §6.18.3).
**Five needed a pull**, below.

⚠️ **WHAT SHIPPED IS `js/research-topics.js`**, and its header carries the rules it was written
under. The one worth repeating here: **every claim on that screen names a source, every source is
defined once, and every topic states its own limit.** A topic with nothing to admit is a topic
nobody checked.

### 13.1 Free weights vs machines 🟢 — no winner, and the difference is the TEST

**Haugen ME, Vårvik FT, Larsen S, Haugen AS, van den Tillaar R, Bjørnsen T. "Effect of free-weight
vs. machine-based strength training on maximal strength, hypertrophy and jump performance — a
systematic review and meta-analysis." *BMC Sports Sci Med Rehabil* 2023;15:103.**
doi:10.1186/s13102-023-00713-4 · 13 studies, 1,016 participants (789 men, 219 women), ≥ 6 weeks.

| Direct comparison | SMD [95 % CI] | *p* |
|---|---|---|
| Dynamic strength | 0.084 [−0.106, 0.273] | 0.387 |
| Isometric strength | −0.079 [−0.432, 0.273] | 0.660 |
| Countermovement jump | −0.209 [−0.597, 0.179] | 0.290 |
| **Hypertrophy** | **−0.055 [−0.397, 0.287]** | **0.751** |

**And the finding that is not a null:** tested on free weights, free-weight training wins
(−0.210 [−0.391, −0.029], *p* = 0.023); tested on machines, machine training trends the other way
(0.291 [−0.017, 0.600], *p* = 0.064). Authors: *"strength changes are specific to the training
modality, and the choice between free-weights and machines are down to individual preferences and
goals."*

**Corroborated by ACSM 2026 (§6.16):** strength was not affected by machines versus free-weight
training. Two independent syntheses → 🟢.

⚠️ **Limitation the authors state:** *"a lack of studies in this area, especially within the realm
of muscle hypertrophy"* — only 5 of the 13 measured size — plus inadequate adjustment for range of
motion, intensity, volume and frequency.

### 13.2 Injury risk in lifting 🟡 — low, and nobody has compared the two kinds of equipment

**Keogh JWL, Winwood PW. "The Epidemiology of Injuries Across the Weight-Training Sports."
*Sports Med* 2017;47(3):479–501.** doi:10.1007/s40279-016-0575-0 · 20 studies.

- **Bodybuilding has the lowest rates: 0.24–1 injury per 1,000 h** (0.12–0.7 per lifter per year) —
  the closest thing in the literature to an ordinary gym-goer. Strongman 4.5–6.1, Highland Games 7.5.
- Most-injured sites: **shoulder, lower back, knee, elbow, wrist/hand**. Strains, tendinitis, sprains.
- Authors: the weight-training sports *"appear to have relatively low rates of injury compared with
  common team sports."*

⚠️ **Graded 🟡 and it must not be quoted as 🟢.** Only **5 of 20** studies scored ≥ 75 % on risk of
bias, only 4 were prospective, and these are competitive athletes recalling injuries — not tracked
recreational lifters. The inciting-event percentages in that paper (fatigue, technical error) are
self-reported and the authors question their validity; **do not put them on screen.**

🚨 **AND THE THING THE SCREEN HAD TO SAY: nothing here compares injury rates between machines and
free weights.** "Machines are safer" is a reasonable guess with no study behind it, and the topic
says so rather than repeating it or silently omitting it.

### 13.3 Warm-up and stretching 🟢 on the null, 🟡 on the positive

Three sources, and the sharpest result is a null.

**Lauersen JB, Bertelsen DM, Andersen LB. "The effectiveness of exercise interventions to prevent
sports injuries: a systematic review and meta-analysis of randomised controlled trials." *Br J
Sports Med* 2014;48(11):871–877.** doi:10.1136/bjsports-2013-092538 · 25 trials, 26,610
participants, 3,464 injuries.

| Intervention | Acute injuries RR [95 % CI] | Overuse RR [95 % CI] |
|---|---|---|
| Strength training | **0.56 [0.35, 0.89]** | **0.62 [0.41, 0.93]** |
| Proprioception | 0.72 [0.52, 0.99] | 0.50 [0.26, 0.95] |
| **Stretching** | **0.99 [0.93, 1.05]** | 1.08 [0.88, 1.33] |
| Multi-exercise | 0.67 [0.55, 0.81] | 0.75 [0.62, 0.92] |

⚠️ **0.99 with a CI of [0.93, 1.05] is not "unclear", it is a precise null** — and it is the most
useful sentence on that topic, because "stretch so you don't get hurt" is the single most repeated
piece of gym advice there is. The same table says the training itself cuts injuries by ~44 %.
⚠️ **Scope: these are SPORTS injuries in athletes, not gym injuries in lifters.** Nobody has run
this trial on a gym population, and the topic says so.

**Warneke K, Lohmann LH. "Revisiting the stretch-induced force deficit: A systematic review with
multilevel meta-analysis of acute effects." *J Sport Health Sci* 2024;13(6):805–819.**
doi:10.1016/j.jshs.2024.05.002 · 83 studies, 2,012 participants, 400+ effect sizes.

- Overall static-stretch force deficit **−0.21 [−0.39, −0.02]**.
- **< 60 s per bout: −0.13 [−0.32, 0.07], *p* = 0.20 — no measurable cost.**
- **≥ 60 s per bout: −0.84 [−1.32, −0.37], *p* = 0.004 — a large one.**
- Athletic performance (jump, sprint, throw): **no impairment**, 0.13, *p* = 0.20.

⚠️ **This CORRECTS the folk version in both directions.** "Never stretch before lifting" is not what
this says — the deficit is a long-hold, isolated-strength-test effect. Authors: their results
*"do not support previous recommendations to exclude static stretching from warm-up routines."*

**Fradkin AJ, Zazryn TR, Smoliga JM. "Effects of warming-up on physical performance: a systematic
review with meta-analysis." *J Strength Cond Res* 2010;24(1):140–148.**
doi:10.1519/JSC.0b013e3181c643a0 · 32 studies (quality 6.5–9, mean 7.6 of 10).

- Performance improved in **79 %** of the criteria examined, worsened in **17 %**, unchanged in 3 %.
- ⚠️ **That is a VOTE COUNT, not a pooled effect size**, which is why this half is 🟡 and why the
  screen says "79 % of the measures taken" rather than "warming up makes you 79 % better".
- Stretching-only warm-ups were excluded by design, so it is about *active* warm-up.

⚠️ **"What should a warm-up look like" has no good answer and the topic says so.** Searched
2026-08-30: the specific-warm-up literature is small and disagrees (higher-load ramp-up sets beat
lower-load in some trials, no difference in others). **Nothing on that screen prescribes a
protocol** beyond "get warm, then ramp the exercise itself", which is the shared middle of all of
them. ⚠️ **And no evidence anywhere says a warm-up increases hypertrophy or strength gains** — Tim
asked exactly that question and the honest answer is that it is a performance-on-the-day effect.

### 13.4 Time of day 🟢 — no difference, with one real caveat

**Bruggisser F, Knaier R, Roth R, Wang W, Qian J, Scheer FAJL, et al. "Best Time of Day for Strength
and Endurance Training to Improve Health and Performance? A Systematic Review with Meta-analysis."
*Sports Med Open* 2023;9:34.** doi:10.1186/s40798-023-00577-5 · 26 articles (22 unique studies, 713
participants); 7 studies / 191 participants pooled.

- **Neither for nor against any time of day** for strength or health outcomes.
- **Congruent vs incongruent training/testing time**: strength SMD 0.22 [−0.15, 0.59] (n.s.);
  jump height 0.71 [0.00, 1.42] (significant). Authors: *"evidence for larger effects when there is
  congruency between training and testing times."*

**Grgic J, Lazinica B, Garofolini A, Schoenfeld BJ, Saner NJ, Mikulic P. "The effects of time of
day-specific resistance training on adaptations in skeletal muscle hypertrophy and muscle
strength." *Chronobiol Int* 2019;36(4):449–460.** doi:10.1080/07420528.2019.1567524 — strength is
higher in the evening at baseline; **morning training raises morning strength to evening levels**;
gains are similar between groups regardless of when strength is assessed. Only 5 studies measured
size.

⚠️ **Limitations, both stated on screen:** 191 people in the pooled analysis, **98 % male**, mostly
young, with evening chronotypes and older adults underrepresented; moderate-to-high risk of bias,
23 % using gold-standard measures.

### 13.5 Failure, and the misconception pulls 🟡–🟢

**Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. "Influence of Resistance Training
Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis."
*Sports Med* 2023;53(3):649–665.** doi:10.1007/s40279-022-01784-y · 15 studies.

- All set-failure definitions pooled: **ES 0.19 [0.00, 0.37]**, *p* = 0.045 — trivial.
- **Momentary muscular failure vs non-failure: 0.12 [−0.13, 0.37], *p* = 0.343.**
- Authors: *"there is no evidence to support that resistance training performed to momentary
  muscular failure is superior to non-failure resistance training for muscle hypertrophy."*

⚠️ **READ WITH §6.7, NOT INSTEAD OF IT.** Robinson et al. found hypertrophy *does* increase as sets
are taken closer to failure. The two are compatible and the app states both: **the last reps must be
hard, and the final one need not be impossible.** Dropping either half produces advice that is wrong
in a different direction, which is why the data-layer test pins the sentence.

**Steele J, Endres A, Fisher J, Gentil P, Giessing J. "Ability to predict repetitions to momentary
failure is not perfectly accurate, though improves with resistance training experience." *PeerJ*
2017;5:e4105.** doi:10.7717/peerj.4105 · 141 participants — people **under-predict** their reps to
failure, and less experienced lifters more so. Already in §3; linked from the screen now.

**Damas F, Libardi CA, Ugrinowitsch C. "The development of skeletal muscle hypertrophy through
resistance training: the role of muscle damage and muscle protein synthesis." *Eur J Appl Physiol*
2018;118(3):485–500.** doi:10.1007/s00421-017-3792-9 — *"RT protocols that do not promote
significant muscle damage still induce similar muscle hypertrophy and strength gains… muscle damage
is not the process that mediates or potentiates RT-induced hypertrophy."*
⚠️ **An invited review, not a meta-analysis — 🟡**, and the topic's caveat names it as the least
settled item in the misconceptions list.

**Ramírez-Campillo R, Andrade DC, Clemente FM, Afonso J, Pérez-Castilla A, Gentil P. "A proposed
model to test the hypothesis of exercise-induced localized fat reduction (spot reduction), including
a systematic review with meta-analysis." *Hum Mov* 2022;23(3):1–14.** doi:10.5114/hm.2022.110373 ·
13 studies, 1,158 participants, 37 comparisons. **Pooled ES −0.03 [−0.10, 0.05], p = 0.508**,
I² = 24.3 %, Egger's test p = 0.133. A tight, low-heterogeneity, unbiased null — the cleanest single
result in this whole pull. 🟢

**Roberts BM, Nuckols G, Krieger JW. "Sex Differences in Resistance Training: A Systematic Review
and Meta-Analysis." *J Strength Cond Res* 2020;34(5):1448–1460.**
doi:10.1519/JSC.0000000000003521 — hypertrophy **ES 0.07 ± 0.06, p = 0.31, I² = 0** (no
difference); **upper-body strength favoured females, ES −0.60 ± 0.16, p = 0.002** (I² = 72.1, so
heterogeneous). ⚠️ **Relative gains, not absolute** — the screen says "relative" for that reason.

**Schoenfeld BJ, Aragon AA, Krieger JW. "The effect of protein timing on muscle strength and
hypertrophy: a meta-analysis." *J Int Soc Sports Nutr* 2013;10:53.** doi:10.1186/1550-2783-10-53 —
23 studies; **20 of them did not match total daily protein between groups**, and total intake
explained essentially all of the apparent timing effect. 🟡, and the app states it as "no clear
separate effect once the daily total is adequate" rather than "timing does nothing".

⚠️ **D26 is not breached by the protein misconception.** It permits recommending a cited range and
forbids tracking food. Nothing on that screen asks what anybody ate.

### 13.6 What did NOT go on the screen, and why

Kept here so nobody re-pulls it hoping for a different answer.

- **"Machines are safer than free weights."** No study compares them. Stated as untested rather
  than omitted, because omitting it leaves the reader holding the folklore.
- **Any specific warm-up protocol.** §13.3 — the literature is small, disagrees, and the effects
  are trivial.
- **Stretching for hypertrophy** (the long-duration stretching literature). Small, largely one
  laboratory, contested, and on a screen like this it would read as an instruction. 🔴 for this use.
- **The fatigue cost of training to failure.** Plausible and widely repeated; this pull found no
  synthesis quantifying it. The screen says failure has **no measured benefit**, which is what is
  supported, and stops there.
- **"Muscle turns to fat."** Easy to say and impossible to cite, because nobody has run the study.
  Left out rather than asserted from first principles.
- **Type I / type II fibre-specific load responses** (Varovic 2026, §6.13.1) — still 🔴.
- **Injury-rate figures for powerlifting and weightlifting specifically.** In the Keogh review but
  not extracted here: bodybuilding is the relevant comparison for this app's users, and quoting a
  competitive powerlifter's rate at a gym-goer would be the same category error as §13.2's warning.

---

## 14. Ranking the abs — a key lift for Core 🟡

**Pulled 2026-09-04**, on Tim's instruction: *"set a good 1RM estimator for the ab muscle group for
a specific exercise and base it off of whatever information we can find online in order to compare it
to others… This makes the ab muscle group nearly identical to any other muscle group and how it
operates but with a little less reliability."*

🚨 **THE GRADE IS 🟡 AND IT IS THE ONLY 🟡 IN THE STANDARDS TABLE.** §11's whole argument for the
medians is that **two independent methods agree within ~3 %** lift by lift. Core has one measured
source and no agreeing second, and that is stated on screen rather than smoothed over. Read §11
first; this section is an exception to it, not an extension of it.

### 14.1 What was found

**Cable Crunch — Strength Level** (measured; 12,596 qualifying results out of 211,507 logged lifts,
3 Oct 2019 – 5 Mar 2026). 1RM in lb:

| Body weight | Beginner (p5) | Novice (p20) | Intermediate (p50) | Advanced (p80) | Elite (p95) |
|---|---|---|---|---|---|
| **180 lb male** | 58 | 98 | **151** | 216 | 288 |
| **140 lb female** | 36 | 65 | **106** | 157 | 214 |

**Machine Seated Crunch — Strength Level** (21,870 qualifying out of 233,517), same reference
weights: male 65 / 110 / 170 / 243 / 325, female 30 / 57 / 94 / 140 / 192.

### 14.2 The cross-check disagrees, and that is the finding

**Fitness Volt** gives 178 (male) and 123 (female) at the same body weights — **17 % and 16 % above**
Strength Level. That is five to six times the disagreement §11 accepts elsewhere.

⚠️ **AND IT IS NOT AN INDEPENDENT MEASUREMENT.** Fitness Volt describes its tables as *"modeled level
tables, ratio-derived from base lifts that are anchored to … the public OpenPowerlifting dataset"* —
so for a cable crunch it is a ratio somebody chose from a powerlifting anchor, not a record of anyone
actually doing cable crunches. **Strength Level's is the measurement; Fitness Volt's is a model of
it.** The measured figure is used, and the gap is carried as `standardQuality: 0.6`, which multiplies
into the rating's confidence so a Core reading with flawless evidence still lands below a bench
press reading with the same evidence.

### 14.3 🚨 The spread is much wider than every other lift, and reusing the global σ was wrong

Fitting σ to the five published anchors, in log space:

| From | Core (cable crunch) | Chest (bench press) |
|---|---|---|
| Elite / median | 0.393 | 0.263 |
| Advanced / median | 0.425 | 0.274 |
| median / Novice | 0.514 | 0.314 |
| median / Beginner | 0.582 | 0.334 |
| **used** | **0.48** | 0.32 (global) |

**Core's tiers are roughly 50 % wider, and asymmetric — the left tail is the wide end.** Ranking Core
with the global σ = 0.32 puts a lifter sitting **exactly on the published Beginner mark** at the
**0.1st percentile** instead of the 5th: the model would call a published beginner the weakest lifter
alive. So `MUSCLE_LIFTS` grew an optional per-muscle `sigma`, defaulting to the global value, and
Core is the only muscle that sets it. 🟡 — a single value fitted to one lift's five anchors, and the
asymmetry means no single σ fits all five.

⚠️ **This is the revisit `strength-standards.js` predicted.** Its own comment said one σ for every
lift was *"a simplification — isolation work is probably wider — and is worth revisiting once real
data exists."* Real data existed for exactly one muscle and it was wider, by half again.

### 14.4 The conversion between the two crunches, and why it is only quality 0.55

Per level, Machine Seated Crunch ÷ Cable Crunch:

- **Men:** 1.121 / 1.122 / 1.126 / 1.125 / 1.128 — **flatter than any entry the 2026-08-26 ratio
  sweep produced.** On the technique §11 established (one population, both lifts, a 180 lb male,
  divide, take the median) this is as good as a derivation gets.
- **Women:** 0.833 / 0.877 / 0.887 / 0.892 / 0.897 — internally just as flat, and **27 % away.**

🚨 **BOTH CANNOT BE THE POPULATION RATIO.** The likeliest explanation is that the two exercises draw
different logging populations at different sample sizes, and the female tables are the thinner of the
four. `RATIOS` has no sex dimension, so the larger male sample is used at a reduced quality rather
than the two being averaged into a number neither table supports.

### 14.5 What is still refused, and why each one is not an oversight

Eight of the library's thirty core exercises record a weight. Six of the eight are still refused:

| Exercise | Why not |
|---|---|
| **Decline Sit-Up** | The logged weight is a plate at the chest; the real resistance is that plate **plus a fraction of the torso**, and the fraction moves with the decline angle. Identical in kind to the inverted row (37–79 % of body weight depending on bar height), which §11 already refuses. |
| **Russian Twist**, **Cable Woodchop**, **Landmine Twist** | Rotation, not spinal flexion — a different movement, and the load is largely a lever-arm choice. No published table maps either onto a crunch. |
| **Pallof Press** | **Anti**-rotation. Resisting a stack is not the same quantity as moving one. |
| **Suitcase Carry** | Anti-lateral-flexion, and timed. There is no 1RM to compare. |

⚠️ **AND THE HONEST HEADLINE: THIS RATES ABOUT A QUARTER OF HOW PEOPLE TRAIN ABS.** Twenty-two of the
thirty core exercises record reps or time and no load at all — every plank variant, hanging leg
raise, ab wheel, sit-up and V-up. **Nothing in this section ranks any of them**, and the map marks
them "trained, can't be ranked" (2026-09-04) rather than pretending otherwise.

### 14.6 What was NOT pulled, and is the obvious next question

**Published population norms for the plank hold and the 60-second sit-up** — ACSM trunk-endurance and
curl-up tables, McGill's plank data, military PT standards. If those hold up they would rank the
other three-quarters, and they fit the app's existing shape because they are **tests**, and the app
already separates a benchmark from a set logged mid-workout. **This was not searched for on
2026-09-04 and nothing here rests on it.** Recorded so the next session knows it is an open lead
rather than a checked-and-rejected one.

### 14.7 Sources

- Strength Level, *Cable Crunch Standards for Men and Women (lb)* — https://strengthlevel.com/strength-standards/cable-crunch/lb
- Strength Level, *Machine Seated Crunch Standards for Men and Women (lb)* — https://strengthlevel.com/strength-standards/machine-seated-crunch/lb
- Fitness Volt, *Cable Crunch Standards by Bodyweight (lbs)* — https://fitnessvolt.com/strength-standards/cable-crunch/ (modelled, used only as the cross-check that disagreed)
