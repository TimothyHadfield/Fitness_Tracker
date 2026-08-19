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
| Bodyweight / assisted | **Excluded.** Logged weight is added/assisted load, not total resistance — the paper excluded these outright |
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
- **Bodyweight and assisted exercises are excluded** (see §1.4). Assisted is the sharper case: the
  logged weight is *assistance*, so more weight means an easier lift and normalising would invert
  the chart entirely.
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
| 95 % | ~5 | | |
| 90 % | ~5 | | |
| 80 % | ~9 | ~9 | ~13 |
| 70 % | ~15 | ~14 | ~19 |
| 60 % | ~20+ | | |

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
  by the same group covers *per-session* volume. 🔴 **Not yet pulled.**

### 6.7 Proximity to failure 🟡 — see also §3

**Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC.** *Sports Medicine*
54(9), 2024. doi:10.1007/s40279-024-02069-2.

- **Hypertrophy increases as sets are taken closer to failure** — marginal slopes on estimated RIR
  were negative with intervals excluding the null.
- **Strength is largely indifferent to RIR** — intervals contained the null.
- Graded 🟡 not 🟢 by the authors' own framing: RIR was **estimated from study descriptions rather
  than measured**, overall fit quality was "modest", and the analysis is exploratory.

⚠️ **Consequence for this app: the variable that most modulates whether a set produces growth is
invisible to it.** There is no RIR field and that is deliberate (D9). Any volume-based rating is
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

### 6.10 Sleep 🟡 — thinner than expected

Mechanism documented (Knowles et al., *J Sci Med Sport*, 2018: inadequate sleep blunts adaptation and
disturbs baseline muscle protein metabolism), but **no dose–response meta-analysis between hours
slept and strength gained** exists of the kind §6 has for volume. So the app may say too little sleep
will cost you; it may not state an hours target as a requirement with the firmness it states volume.

### 6.11 Individual variability 🟢 — and it is the reason goals cannot promise numbers

- Over a **12-week** programme, in people of the same age doing the same training, individual change
  ranges **0–250 %** for strength and **−2 % to 59 %** for size.
- **Early progression does not reliably predict later adaptation** — authors note this "challenges
  the practicality of tailoring training programs based on short-term outcomes".
- **Non-responders are rare**: in one 16-week analysis 82 % were robust or excellent responders, 5 %
  poor.
- **Individual responsiveness is reproducible** across repeated protocols after detraining.

⚠️ **Together: population data cannot tell one person what they will gain in three months, but that
person's own history predicts them well.** Any goal or projection must be calibrated to the
individual's measured trend, and expressed as a range — never as a promised number from a table.

### 6.8 Still to pull 🔴

Load / rep range (Schoenfeld's repetition continuum, 2021 — referenced, still not read in full),
rest intervals, range of motion and lengthened partials, exercise selection and variation, and the
per-session volume paper from §6.6. Each either enters the rating model or becomes a stated caveat.

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

**Competitive**

- `docs/competitive-teardown.html` — full teardown of seven apps.

---

## 12. Progression — how much to add, and when 🟢

*Researched 2026-08-18 for `docs/goals-plan.md` §8. Driver: Tim — progression must be decoupled from
any goal, but it still needs a system, and "most of the time increasing the weight (even by a little)
is too much".*

### 12.1 The anchor

**American College of Sports Medicine. "Progression Models in Resistance Training for Healthy
Adults." *Med Sci Sports Exerc*, 2009.** The standing position stand, and it states the rule
directly:

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
