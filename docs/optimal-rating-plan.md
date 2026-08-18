# The "% optimal" rating — plan

> `docs/vision.md` §1.3. Tim, 2026-08-18: *"This is going to take a lot of researching to understand
> how hypertrophy works and muscle building. Understand that this topic is still getting massive
> research done on it and a lot of the popular content on the internet is being challenged by studies
> and other research. Just because a workout has more time or exercises doesn't necessarily mean it's
> more optimal."*
>
> He is right on every count, and the third sentence is the design constraint, not a caveat.

**Status:** plan · **Written:** 2026-08-18 · **Phase 0 (research) started the same day**

---

## 1. The number, and why it is the most dangerous thing this app would show

Every other number in this app is either measured (a weight you lifted) or derived from published
standards with the derivation stated (a percentile). A "% optimal" is neither. It is a **prediction
about your future body** rendered as a two-digit number with a percent sign, which is the most
confident-looking format a piece of information can have.

`docs/vision.md` §1.3 already said it: *"This is the single most load-bearing number the app would
ever show. It needs real grounding … or it is a made-up number with a percent sign on it, which is
worse than no number."*

So the bar is: **every component of the number traces to a published dose–response model, and the
screen says how sure it is.** If a component cannot be grounded, it does not enter the number — it
becomes a stated caveat instead.

---

## 2. What the evidence actually says

Full extraction with grades in `docs/research.md` §6. The short version, because it decides the whole
design.

### 2.1 The central paper

**Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. "The Resistance Training Dose Response:
Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and
Strength Gains." *Sports Medicine*, accepted 14 Oct 2025, published online 4 Dec 2025.
doi:10.1007/s40279-025-02344-w.** 67 studies, 2058 participants (79.1 % male, mean age 25.16 ± 5.22).

This paper is close to purpose-built for what Tim is asking for, for three reasons:

1. **It models volume as a continuous variable and reports the functional form**, rather than
   comparing arbitrary buckets.
2. **It publishes efficiency tiers** (its Tables 3 and 4) — the actual "what does another set buy
   you" question, which is exactly the give/get trade Tim described.
3. **It gives separate curves for hypertrophy and for strength**, which is what makes a per-goal
   rating possible from one source rather than two incompatible ones.

### 2.2 Hypertrophy

- Best-fit model: **square root**. Marginal slope **0.24 % muscle size per set** at the mean volume
  of 12.25 sets [95 % CrI 0.15, 0.33], 100 % posterior probability the slope exceeds zero.
- **Efficiency tiers** (fractional weekly sets *per muscle*), their Table 3:

  | Tier | Sets | What another increment costs |
  |---|---|---|
  | Minimum effective dose | 4 | enough to produce detectable hypertrophy at all |
  | Higher efficiency | 5–10 | ~6 more sets per further detectable increment |
  | Intermediate efficiency | 11–18 | ~8.5 more |
  | Lower efficiency | 19–29 | ~10.75 more |
  | Lowest efficiency | 30–42 | ~12.5 more |
  | Unclear | 43+ | insufficient data, *or potentially less hypertrophy* |

- **No plateau was found** up to the volumes studied — but "caution is warranted as few studies have
  explored ~25+ 'fractional' weekly sets."

### 2.3 Frequency — the finding that vindicates Tim's instinct

- **Hypertrophy: frequency has no consistently identifiable independent effect.** Slope 0.32 %
  [95 % CrI **−0.14**, 0.82] — the interval contains zero. The authors: *"any independent effect of
  additional frequency is small and is not consistently identifiable across modeling methods."*
- **Strength: frequency does matter.** Slope 3.27 % [95 % CrI 2.74, 3.84], 100 % probability > 0.
  Going from 1 to 2 sessions/week: 12.72 % → 17.32 %. Accelerating diminishing returns after that.

**So for muscle growth, training 5 days a week is not inherently better than 3.** What matters is
where the sets land. A rating that scored days-per-week or hours-per-week as good would be
contradicted by the best available evidence — which is precisely the failure mode Tim named.

### 2.4 How to count a set — and this also settles an open question elsewhere

The paper compared three counting methods and the winner was decisive:

- `direct` — only the primary force generator counts.
- `total` — any involvement counts as a full set.
- **`fractional` — an indirect (synergist) set counts as 0.5.** ← best supported

Bayes factors: for hypertrophy volume, fractional over total 2×log(BF) = 9.48, over direct = 10.29;
for strength volume, 18.21 and 45.96. "Strong" to "very strong" on the Kass–Raftery scale.

⚠️ **This answers a question the project has had open since the beginning.** `progress.md` §9 says
*"Exercise→muscle is a single string, not the primary/secondary weighted mapping. This must change
before D3."* The evidence-backed answer is a **binary direct/indirect flag with weights 1.0 and 0.5**
— simpler than the continuous weighting that was assumed, and now citable. Note it is *not* the same
table as `muscle-evidence.js`, which answers "how strong is this muscle"; this one answers "how much
work landed here".

⚠️ And the authors' own warning, which must be carried onto the screen: assigning 0.5 *"is still an
assumption"* and the method *"should be regarded as a heuristic to improve the accuracy of
dose–response modeling, rather than a definitive standard for practical application."*

### 2.5 Effort — the variable that matters and the app cannot see

**Robinson ZP, Pelland JC, Remmert JF, Refalo MC, Jukic I, Steele J, Zourdos MC. "Exploring the
Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain,
and Muscle Hypertrophy." *Sports Medicine* 54(9), 2024. doi:10.1007/s40279-024-02069-2.**

- **Hypertrophy improves as sets are taken closer to failure** — negative slopes on RIR, intervals
  excluding zero.
- **Strength is largely indifferent to RIR** — intervals contained the null.
- Caveats the authors state plainly: RIR was *estimated* from study descriptions rather than
  measured, fit quality was "modest", and the analysis is exploratory.

**The app has no RIR field, deliberately (D9).** So the single variable that most decides whether a
set counts for growth is invisible to any rating this app can compute. That is not a reason to
abandon the rating — it is a reason the rating must be stated as *conditional*: "assuming sets are
taken close to failure". A programme cannot make you train hard.

### 2.6 How much of the outcome any of this explains

**R²marginal = 22.3 % for hypertrophy volume; 26.1 % for strength.** The fixed effects explain roughly
a *quarter* of the variance between training groups. Most of the rest is between-study and individual
variation.

This is the single most important number in this document. **It is the reason the output must be a
band and not a point.** A model explaining a quarter of the variance cannot honestly distinguish an
83 % from an 87 %.

---

## 3. What the app can and cannot see

Worth writing down before designing anything, because it bounds what is computable.

| Available today | Not available |
|---|---|
| Exercises in each workout | Reps — **the workout model stores `sets` but no planned reps** |
| Planned set count per exercise | Load / %1RM |
| Which muscles each exercise trains | Proximity to failure / RIR (D9, deliberate) |
| Workouts per system → sessions per week | Rest intervals, tempo, range of motion |
| Set types (a drop set is ONE set, D23) | Whether the person actually does it |

**The lucky part:** the one input the app can measure — *sets per muscle per week* — is the input
with the best dose–response evidence behind it. The rating is computable precisely because the
literature converged on the same variable the app already stores.

**The honest part:** everything in the right-hand column is either a stated assumption or a caveat on
screen. Adherence in particular dwarfs programme design and no app can see it.

---

## 4. The model

### 4.1 Per muscle, per week

```
fractionalSets(muscle) = Σ over exercises training that muscle:
                           plannedSets × (1.0 if direct, 0.5 if indirect)
```
Drop sets and myo-reps contribute **one** set (D23, and it is already true by construction).

### 4.2 Predicted response

Hypertrophy uses the square-root form the paper found best-fitting; strength uses the reciprocal
form. Both are anchored so the curve reproduces the published marginal slope at the published mean
volume, and both are **clamped at the top of the evidence range** rather than extrapolated.

⚠️ **Above 42 fractional sets the curve does not keep rising** — the paper's own tier table calls
43+ "insufficient data, or potentially less hypertrophy". Extrapolating past the data is how a model
starts recommending 60 sets a week, which is the "more is better" failure this rating exists to
avoid.

### 4.3 Aggregating across muscles

Averaging predicted response across the trainable muscle groups, so a programme that hammers chest
and skips legs cannot score well by being excellent at one thing. **Coverage is reported separately
and in words** ("trains 11 of 13 muscle groups") rather than folded silently into the number.

### 4.4 What 100 % means — the denominator

**Not "the best programme in the library"** — that would make every existing rating change whenever a
new system is added, which is unacceptable for a number a user might have chosen a programme on.

**100 % = the most growth stimulus the evidence supports**, i.e. every trainable muscle sitting at
the top of the evidence-supported range. It is deliberately not achievable in a sane weekly schedule,
which is the point: it makes the cost visible.

### 4.5 The output is three things, never one

This is the part that answers Tim's actual question — *what am I giving and what am I getting*:

- **Result** — % of the achievable stimulus, **in bands of 5**, with a range not a point.
- **Cost** — days per week, and estimated time per session.
- **Efficiency** — result per hour trained. **This is the number nobody else shows**, and by the
  evidence above it is where a 3-day programme can beat a 6-day one outright.

### 4.6 Per goal

Hypertrophy and strength get **separate ratings from the same source**, because the same programme
genuinely scores differently: strength plateaus after ~4–5 sets per movement and rewards frequency;
hypertrophy keeps rewarding volume and ignores frequency. A single blended number would hide exactly
the trade a user is choosing between. "General fitness" gets **no number** — there is no dose–response
literature to ground one, and inventing one would breach the bar in §1.

---

## 5. How this could be wrong, and how we would know

- **Sanity checks against the library.** The nine shipped systems have known characters — Bumstead's
  is a Mr. Olympia's volume, the Golden Six is a 3-day beginner programme. If the rating does not put
  those in a defensible order, the model is wrong, not the programmes.
- **The "more is always better" test.** Feed it a fabricated 60-sets-per-muscle programme. If that
  scores highest, the clamp in §4.2 is not working and the rating has become the thing it was built
  to avoid.
- **The time-efficiency test.** A well-built 3×45 min programme must be able to beat a padded
  6×90 min one on efficiency. If it cannot, §2.3 has not actually been implemented.
- **Sensitivity.** Vary the 0.5 indirect weight between 0.3 and 0.7 and see whether the ordering of
  the nine systems changes. If it does, the ordering is an artefact of an assumption the authors
  themselves flagged, and the bands must widen until it does not.

---

## 6. Phases

**Phase 0 — research.** Started 2026-08-18. Volume, frequency, counting method and proximity to
failure are extracted and graded. **Still to pull:** load/rep-range, rest intervals, range of motion
and lengthened partials, exercise selection and variation, and the parallel Pelland-group paper on
*per-session* volume. Each either enters the model or becomes a stated caveat.

**Phase 1 — the direct/indirect mapping.** Every exercise in the library flagged per muscle as direct
or indirect. This is §2.4, it is the biggest single piece of work, and **it is worth doing on its own
merits: it is the mapping D3 has been blocked on.**

**Phase 2 — the pure model.** `js/optimal.js`, in the shape that works here (`e1rm.js`,
`set-types.js`, `social.js`): no DOM, no store, everything passed in, so the curves can be asserted
headlessly against the published numbers.

**Phase 3 — validation.** §5, before anything renders.

**Phase 4 — the screen.** On a ready-made system first. Then on the user's own systems, which is
where it is actually useful — a rating on a shop window is interesting, a rating on *your* programme
is actionable.

---

## 7. Questions for Tim

1. **Two numbers or one?** Recommendation: hypertrophy and strength rated separately, because the
   same programme genuinely differs between them and a blend hides the trade.
2. **What should 100 % mean?** Recommendation: §4.4 — the most the evidence supports, so cost is
   visible, rather than "best in our library", which would make ratings move when we add a system.

Neither blocks Phase 1, which is the same mapping either way.
