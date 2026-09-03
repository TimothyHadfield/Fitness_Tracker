# The strength maths, audited — findings and the plan to fix them

**Written 2026-09-13 (git date 2026-09-03), on Tim's ask.** Verbatim: *"I want you to do an in-depth
analysis on how we do the math on our ranking system and estimating 1RM's and also how we relate
them to another exercise and estimate strength that way … I want to minimize errors and maximize
accuracy as much as possible. Additionally, I want to start exploring fatigue … Don't do any building
with this whatsoever … Make a plan on how we can fix our current setup once you're done, and then
I'll look over it and deploy you later."*

🛑 **NOTHING IN THIS FILE IS BUILT. NOTHING IN IT IS AUTHORISED.** It is the analysis and the plan;
Tim reviews it and says which parts go. Every §N reference below means `docs/handbook.md` unless it
names another file.

**How it was done.** Seven read-only agents, each on one slice, each running the app's own modules
under `node` against fixtures and the demo year rather than reading code alone: (A) the e1RM curve
and its inverse; (B) the aggregation, percentile and confidence pipeline; (C) the ratio tables and
the conversion step, checked against 108 live Strength Level pages; (D) the fitted constants, the
simulator and the never-run backtest; (E) every screen that consumes an estimate; (F) fatigue, with
four literature pulls under it; (G) the outside literature on 1RM equations, standards, the untrained
multiplier and cross-lift ratios. Every finding below is tagged **RUN** (the number came out of the
repo's code), **SOURCE** (a published table says so, URL in the agent's report) or **REASONED** (read
from the code, not executed). The seven full reports (~150 KB, with every URL and every probe script)
are in this session's scratchpad and summarised in `docs/history.md` 2026-09-13; the durable
literature is appended to `docs/research.md` §16.

---

## 0. The one-paragraph version

The formula is implemented faithfully, the percentile arithmetic is right, the mixture model is a
true mixture, and the 45 ratios the 2026-08-28 sweep derived all reproduce. **What is wrong is around
the model, not in it.** Four screens score an assisted pull-up on the *help* number, so more help is
a personal best; the fifteen-rep rule is not enforced on the Data tab; about twenty-five ratio-table
entries the sweep never derived are off by more than ten percent, three of them by a factor of three
or more; a muscle's number can never go down once earned; the typo screen that exists was never
wired; "any body weight" silently means 180 lb; the runner tells you a weight you benchmarked two days
ago is above your max; and one σ for both sexes puts a woman at the Beginner mark near the bottom
quarter of a percent. On fatigue: the literature cannot give the *rating* a correction, but it gives
the *caption* exactly what it prints — reps at a fixed load fall by a known, proportional fraction
each set — so "maybe 8 to failure" can honestly become "maybe 8, then 6, then 4" with a constant that
can only move the number down. And the whole model still rests on a curve fitted for internal
consistency: a re-run of the simulator with the lab rep curve as truth moves the claimed ±4.6 % error
to ±8 %, which is why the backtest on Tim's own benchmarks is the first validation item.

---

## 1. What was checked and found sound

Recorded so nobody re-derives it.

- **`e1rm()` is the published formula to 0.00 % above the k floor**, strictly increasing in both
  arguments from 0.25 to 600 lb, both inverses round-trip to 1e-13, and the kg↔lb path is exact to the
  last bit. **RUN (A).**
- **The 4.58 k floor is right and is the app's own.** The paper's 0.5 is only a divide-by-zero guard
  and it never discusses monotonicity; the turning point is 4.74 kg as `e1rm.js` says, and no weight
  the paper had data for is affected. **SOURCE (G), RUN (A).**
- **Every number `research.md` §1.3 quotes from Marzagão is correct** — read against the full
  paper. **SOURCE (G).**
- **The percentile is a true mixture of lognormal CDFs**, `weightForPercentile` round-trips, the
  age coefficient guards hold, D21's untrained population keeps the levels spread, and fallback
  ratings carry their source's percentile in the right direction. **RUN (B).**
- **The 2026-08-26/28 ratio sweep is sound**: 45 of its derived entries were re-derived from today's
  Strength Level pages and every one reproduces to the rounding. The forward→back round trip on a
  single exercise is exact. **RUN + SOURCE (C).**
- **Fatigue tiers 1–2 do what `docs/fatigue-plan.md` says**: they discount weight, never value;
  half the demo year's observations are fatigued and the leaders barely move. **RUN (B).**
- **Core's special-casing is consistent** on every ranking path. **RUN (B).**
- **`tools/strength-fit.mjs` reproduces every number in `strength-estimate-plan.md` §5/§6/§15.**
  **RUN (D).**
- **Progression never lifts an estimate**; only the gated opening weight reads one. Every estimate on
  a screen has a non-colour Rule 5 cue — the runner captions are the thinnest. **REASONED (E).**
- **The 10- and 15-rep thresholds are where the validation literature would put them** (SEE ≈ 3–4 %
  at 5RM, ≈ 8–10 % at 10RM, divergence from 11 reps, blow-ups past 15). **SOURCE (G).**
- **No sex term belongs in the e1RM curve** — four validation studies find men-built equations
  equally accurate on women. **SOURCE (G).**

---

## 2. Defects — wrong on a screen today, ranked by how far they move a number

These need no decision from Tim beyond "fix them"; each is the code contradicting a rule the project
already holds.

### 2.1 Four paths score an assisted or body-weight lift on the box number — RUN (A, E, C)
`store.currentBests` (`store.js:3811-3823`), `store.pickBenchmarkSet` (`:708-709`),
`personal-bests.measure` (`personal-bests.js:160-161`, and `profile-records.bestOf` through it) and
the **benchmark form's captions** (`views-session.js:4252-4254`) never call `totalResistance()`;
the runner's captions (`:1937-1943`) and the rating pipeline do. Consequences, all run:
- Assisted Pull-Up 70 help × 8 then 80 help × 8 → *"Weight 80 up from 70"*, *"1RM estimated 110 from
  80 × 8, up from 98"*, Data prints *"~98 lbs max"* and picks the **most-assisted** set. More help is
  a bigger trophy. `progression.js:434-450` fixed exactly this inversion on 2026-08-24; the record
  paths never did. It also reaches a friend's workout screen.
- Pull-Up +25 × 5 → *"~34 lb max"*. A benchmark workout's derived benchmark row (D17) is the
  burnout or most-assisted set.
- Benchmark form: pull-up +25 shows *"10 % of max · maybe 15+"* where the runner shows *"80 % ·
  maybe 7"*; 150 lb of help reads 59 %, 70 lb reads 27 % — more help, higher percentage.
**Fix:** one load builder. `setLoad()` (`muscle-evidence.js:59-65`) exists; route every `e1rm()` call
through it with the body weight of the set's date. Add `bodyIncluded` to `estimateOneRM()`'s return
so the two screens that print `est.shown` can say "body weight included" (`views-me.js:463` already
has the phrase).

### 2.2 The fifteen-rep rule (D5) is not enforced on the Data tab — RUN (A, E)
`normalizedSeries` (`store.js:3224, :3235`), `currentBests` and `pickBenchmarkSet` accept any rep
count. 135 × 25 beside a real 205 × 5: the chart plots the burnout set at 189.7 lb over the real
set's 176.4; Data prints *"~258 lb max"*; three 25-rep sets set the modal chart target to 20, past the
app's own ceiling; a 120 × 20 pulldown reads *"~213 lb max"* while the runner calls 120 *"110 % of
your max"*. The graph's warning (`views-data.js:1360`) is about the *target* reps, never the source
set. **Fix:** `isRankableSet` in all four; the caption says what was dropped. Decision inside it:
drop `MAX_TARGET_REPS` from 20 to 15, or keep 20 with a louder flag.

### 2.3 About twenty-five ratio-table entries are wrong by more than ten percent — RUN + SOURCE (C)
Every miss is a "reasoned" or "carried" entry or a regex family covering two load conventions; the
derived entries are all fine. The worst, with the number a user sees today:

| exercise | code | Strength Level implies | effect today |
|---|---|---|---|
| **Machine Lateral Raise** — in `FORCE_PER_SIDE` (`exercises.js:452`) *and* on the dumbbell 0.53 | eff. 0.265 | 0.97 single stack (f 0.84) | 100 lb stack × 10 → **512 lb OHP, Shoulders Elite 99.9th** |
| **Hip Abduction / Adduction** 0.35 q 0.15 "reasoned" | 0.35 | 0.61 / 0.66 m; **0.79 / 0.74 f** | 140 lb woman 150 × 12 → **625 lb deadlift, Glutes Elite**; often her only glute evidence |
| **Cable Kickback (glute)** — per-side doubled *and* 0.18 | 0.18 | 0.63 doubled / 0.32 single | 60 × 12 → **991 lb deadlift** |
| **Triceps Kickback** 0.20 | 0.20 | 0.39 | 20 × 12 → Triceps 343 lb, **Elite 97th** (should be ~40th) |
| **Overhead Dumbbell Extension** — one bell, two hands, no `FORCE_TOTAL`, so doubled | 0.40 ×2 | 0.24 as a total | 50 × 10 → **358 lb CGBP, 98th** |
| **Machine Curl** "nothing published" | 1.00 | 1.23 | 100 × 10 → 95th Expert (should be ~80th) |
| **Seated Leg Curl** carrying lying's 0.53 | 0.53 | 0.66 | 150 × 10 → 93rd (should be ~70th); the commoner machine |
| **Straight-Arm Pulldown** swallowed by `/Pulldown/` | 0.95 | 0.61 | 100 × 10 → Back **17th, Beginner** (should be ~60th) — and still chains into Biceps/Traps/Forearms |
| Dumbbell Fly (generic `/Fly/`) | 0.30 | 0.48 | 30 × 12 → Chest 87th Advanced |
| Reverse Wrist Curl | 0.55 | 0.92 | 45 × 12 → Forearms 88th |
| Landmine Press (per-side) | 0.60 | 0.90 | 70 × 8 → Shoulders **99.6th** |
| Barbell Lunge (dumbbell-derived) | 0.45 | 0.62 | 135 × 8 → Quads 87th |
| Reverse Pec Deck (dumbbell-derived, stack total) | 0.56 | 1.07 | under-credits ~2× |
| Single-Leg Press | 1.30 | 0.95 | under-credits 37 % |
| Belt / Box / Zercher / Smith squat, Machine Row, Machine Shrug, Seal Row, Seated OHP, Wrist Curl, Reverse Curl, T-Bar, DB Upright Row, Goblet, Cable Shrug, Sumo Squat, Seated Leg Press | | 12–36 % off, both directions | full table in agent C's report §3 |

Also: comments at `muscle-evidence.js:471-476, :586, :769-771, :875-882, :896-897` say Strength
Level publishes no standard for machine row, horizontal leg press, machine curl, shrug variants and
the seated dip machine — every one now has a page (added 2020 onward). The sweep's rule "where no
standard exists the entry says so" is being defeated by the site adding pages.
**Fix:** correct the entries above; add Machine Lateral Raise and Overhead Dumbbell Extension to
`FORCE_TOTAL` (the way Goblet Squat and Pullover already are); split the `/Pulldown/`, `/Fly/`,
`/Lunge/`, `/Leg Curl/`, `/Lateral Raise/` families where the load convention differs; extend the
23-entry pin at `data-layer.test.mjs:2929-2962` to every derived entry; re-baseline the golden table
knowingly. ⚠️ **Do this after 2.9 (goal stamp)** or every goal on those muscles reads as progress.

### 2.4 Deadlift chains into Biceps, Traps and Forearms because `>=` meets 0.45 exactly — RUN (B, C)
`muscle-evidence.js:548` gives Deadlift→Back q 0.45 and the fallback filter at `:1299` is
`quality >= FALLBACK_MIN_QUALITY` (0.45). The pull-up comment at `:511` argues *its* 0.45 "lands just
under" the floor — it does only because the fraction q multiplies it to 0.4275. So a deadlift-only
lifter gets Biceps 75th, Traps 77th, Forearms 74th from 405 × 3 — a pull converted through a row
median into a curl. **Fix:** `>` at `:1299`, or Deadlift→Back 0.44. One line either way.

### 2.5 Tie-break is walk-order dependent — RUN (B)
Strict `>` at `muscle-evidence.js:1536` and `:1571` keeps the *first* of equal estimates. A
plateaued 225 × 5 lifter, rows walked ascending: confidence 0.507 Fair, leader dated a year ago;
walked descending: 0.861 High, leader today. `store.getSessions()` sorts descending, so the owner's
own map is masked; the demo generator, the golden test and a friend's published rows are not — two
answers for one history, and a Rule 5 caption naming a set that is not the freshest one. **Fix:** tie
on evidence weight then newest; re-baseline Core's golden row.

### 2.6 The Profile row prints a set that did not produce its number — RUN (E)
`profile-ranking.js:240, :258-283`: `oneRM` from `rec.estimatedMax`, `row.best` from `rec.best`, and
`views-me.js:454-459` prints `best` as the Rule 5 anchor. Fixture: *"265 lbs · Fair · Proficient"*
over *"215 lbs × 3"* — e1rm(215, 3) is 236; the 265 and the 0.45 confidence belong to a hidden
185 × 12. `sameSet: false` exists for exactly this and is ignored. **Fix:** anchor on `estimatedMax`'s
set when `sameSet` is false. Tiny.

### 2.7 Four consistency and wording faults — RUN/REASONED (E, A, D)
- **Core's caveat is dropped on publish**: `store.js:3411-3417` claims it travels; `buildStrengthShare`
  (`:3505-3525`) does not copy it and `ratingsFromShared` never sets it. A friend's Core reads as
  ranked without the §14 warning. Tiny.
- **The compare sheet prints pounds labelled "lb" to a kg user**: `compare.js:525, :602` hard-code
  the unit; `views-social.js:2072-2076` prints it raw. Tiny.
- **Rounding in pounds before converting to kg** at `views-session.js:4194`, `views-muscles.js:843`,
  `views-me.js:440`, `views-goals.js:366`, `views-data.js:1742/1790`: 210.59 lb → "95.7 kg" (true
  95.5); the goal's "unchanged to the nearest kilo" is really the nearest pound. Small, many sites.
- **`normalizeBlockedReason` promises a chart never offered**: `e1rm.js:319-321` says "log a weigh-in
  and this becomes chartable"; `store.chartableExercises:3719` calls `canNormalize(ex)` with one
  argument, which is `false` for every body-weight lift. Either wire the chart to the set-date body
  weight or change the sentence.
- **Three comments in `strength-estimate.js` contradict the tool that fitted them** (`:119`
  windowDays, `:126` halfLifeDays, `:132` topN — the sweeps favour 84/56/1 on flap rate; the shipped
  42/28/3 were chosen on bias–lag–coverage, which plan §5 says honestly and the comments do not);
  `e1rm.js:48` says "any unit" and is wrong; `stale: > 42` at `:577` hard-codes what `uStale` reads
  from `P.windowDays`. Comments only, 15 minutes.

### 2.8 Two `e1rm` conventions for a dumbbell — RUN (A, E), SOURCE (G)
A per-side lift has three "estimated 1RM"s on one day: Finish-PR / profile-records / Data use
`e1rm(50, 12)` = 82.7 per side; Profile uses `e1rm(100, 12) / 2` = 75.7; the benchmark form and
runner use the rating × ratio / 2 = 85.3. **The paper was fitted with dumbbells logged per hand**
(`research.md` §1.3 says so and says "pass the per-side number"), yet the rating pipeline doubles
*before* the curve (`muscle-evidence.js:36-40` → `e1rm(load)`), which is a different number because
k depends on the weight — 9 % on this set. `profile-ranking.js:184-199` argues for the total; the
research note argues for per hand. Neither is wrong on its own; **having both is.** The ratios were
derived from Strength Level's per-dumbbell tables doubled, which is a third convention (whatever
formula Strength Level uses). **Decision for Tim (§4.e), then one convention everywhere.**

### 2.9 Goals freeze a weight with no standards or ratio version — RUN (E)
`buildGoal` freezes pounds with no stamp of the ratios or medians it was computed from. A 4 % ratio
revision with no training reads *"gained 8.4 lb, 58 % of the way"*; a median revision detaches the
frozen weight from its level name. `movedSince` (`views-goals.js:524-632`) argues it avoids reporting
standards changes by using 1RMs — but a ratio change moves the 1RM. **This must ship before 2.3 or
any of §3's changes.** Stamp goals with a version; on mismatch, say so on the screen and offer to
re-freeze (the wording is Tim's).

---

## 3. Model behaviours that mislead — each needs a decision from Tim

These are not bugs against a rule; they are the model doing what it was built to do, and the
audit says what it was built to do is wrong or unlabelled. Every one can be built; each changes what
a user sees enough that Tim should say yes.

### 3.1 A muscle's number never falls — RUN (B)
`rateMuscle()` keeps the best-ever day per exercise; recency touches the *weight*, never the *value*.
Twenty weeks at 300 × 3 then twenty at 250 × 5 → 300, Advanced p82 (the unwired `estimateAt` says
250, Intermediate p63). The demo re-scored a year later gives identical estimates at merely Fair
confidence. The hint only fires when nothing new is logged for 42 days, so a lifter who keeps logging
lighter gets nothing. A second face of it: a stale best-ever representative can be out-ranked by a
fresh low-quality one — a 300-day-old 300 × 3 bench benchmark loses to a fresh machine press and
Chest reads 266, while the recent 260 × 5 is never a candidate. §9 does not list "the level never
decays". **Plan §5's window and 2 %/week fall limit exist in `strength-estimate.js` and have no
caller.** Options: (a) windowed representative 84→180→ever days in `rateMuscle` — moves nothing on
the demo, fixes the stale-representative half; (b) wire `estimateAt` per exercise so the map can go
down, with the fall limit and hysteresis. **The decision: may the map go down?**

### 3.2 The typo screen exists and is not wired — RUN (B)
One ×10 slip on a bench set → Chest 1,958 lb, p99.9, Elite, confidence 0.607 "Good"; the winsoriser
centres on the typo. A +25 % slip moves Chest a pound short of a level. `screenDaily()` was
measured (plan §15.3: ×10 caught 100 %, +40 % 99 %, +25 % 77 %, 0.09 % false positives) and never
called; §9's residual bullet reads as though it shipped. Quarantines, never deletes. **Wire it per
exercise before rating, and say on the panel what was set aside.** Cost is small; the decision is
that a real PR above the plausibility ceiling is held back until a second set confirms it.

### 3.3 "Any body weight" means 180 lb — RUN (B)
`withAssumptions` forces `weight: 'any'`, and `refBodyWeight` returns `REF_BW` for it; σ is
unchanged. The demo's 232 lb bench: at a true 150 lb, p68.6 Proficient → p54.1; at 250 lb, p27.9
Novice → p54.1. The caption says "every size"; the maths says "180 lb man / 140 lb woman". §9's
"widens the comparison rather than inventing a body weight" is false; `strength-standards.js:462`
says the same and is wrong. Options: (a) the caption says "as if 180 lb"; (b) integrate the
percentile over a lognormal body-weight prior — needs the per-weight tables of §6.3.

### 3.4 The runner caption reads the muscle rating, never the lift's own sets — RUN (E)
`views-session.js:1926` converts the muscle rating; the one-seat-per-exercise rule hands the seat to
the largest *estimate*, so with a 215 × 3 bench benchmark two days old the runner says at 185 *"88 % ·
maybe 4 to failure"* (they did 12), at 205 *"97 % · maybe 1"* (they did 5), and at 215 *"102 % · at or
above what we think your max is"* (they did 3). Profile shows the same lift as 265 lb Proficient;
Muscles, the benchmark form and the runner say 211 Novice. **The screen where the number is acted on
carries the lower, unlabelled figure.** `profile-ranking.js` already argues that a recorded lift
shows its own best set; the argument applies at least as strongly here. Options: (a) captions prefer
the lift's own best rankable set when one exists, and say "from your 215 × 3"; (b) `rateMuscle` gives
the seat to the most *credible* set of an exercise rather than the largest, which fixes the root and
moves ratings. A friend is rated two ways too: `ratingsFor(friend)` (`:1478-1485`) passes no
benchmarks and no weigh-ins; `friendEstimates` (`views-social.js:1942-1951`) includes both.

### 3.5 Women's spread is ~45 % wider than men's, and the left tail is wider everywhere — SOURCE (G)
Fitting σ to Strength Level's own anchors (`σ = ln(anchor/median)/z`): men's big three 0.26–0.34
(the app's 0.32 is fine); **women 0.33–0.55, mean ≈ 0.45**; OHP 0.29–0.38 (m) / 0.37–0.54 (f); and
σ at the 5th percentile exceeds σ at the 95th by 0.07 (men) to 0.17 (women) on every lift. With
σ = 0.32 a 140 lb woman at the Beginner bench mark — the 5th percentile by construction — reads
z = −2.81, the **0.25th percentile**. Core's §14.3 finding was the general case. Barbell Medicine's
competitor deciles show the same shape. Options, in order of size: (i) female σ ≈ 0.45 below the
median and ≈ 0.37 above; (ii) a two-piece lognormal (one σ each side of the median) reproduces every
anchor within a pound; (iii) per-lift σ, as Core already has. **Also**: the medians in `MUSCLE_LIFTS`
are Gravitus figures now 7–9 % below Strength Level 2026 on squat, deadlift and OHP, while the ratio
sweep divided by Strength Level's rows (curl 104 vs the app's 85, shrug 284 vs 225, calf 317 vs 240,
CGBP 208 vs 185) — so a median Strength Level lifter reads ~68th on Biceps, ~74th Traps, ~78th
Calves. **One population for both the ratios and the medians, or the "one population" method
does not cancel.**

### 3.6 Ratios are not sex-specific, and for pulls, body-weight lifts and machines the sexes differ by 20–40 % — SOURCE (C)
Female-140 ÷ male-180 ratios from the same pages: Face Pull 1.04 vs 0.75; Pull-Up 1.64 vs 1.28; Dips
1.66 vs 1.35; Hip Thrust 1.16 vs 0.96; deadlift family 1.10–1.21×; Hip Abduction 0.79 vs 0.61; and
the other way, Machine Shoulder Press 0.97 vs 1.23, Machine Chest Press / Pec Deck 0.75 vs 0.91,
Machine Crunch 0.89 vs 1.13 (the one the code already knows). Dumbbell-for-barbell swaps are
sex-neutral, which is why the sweep's sample hid this. Six strict pull-ups at 140 lb read Back 79th
Proficient today; at the female ratio, ~55th. Body-weight dependence is second-order (≤ 13 % over
140–220 lb). **Shape:** `[regex, {m, f}, q]` with a scalar meaning both; `contributionsFor` reads
`opts.sex` (it already takes `opts.bodyWeight`); `crossMuscleRatio` uses the matching medians
instead of averaging (4–7 % wrong for both sexes on bench/squat today). Cheap.

### 3.7 The rep caption under-predicts reps at every weight, badly at light loads — RUN (A), SOURCE (G)
Inverting Marzagão gives 6.5 reps at 80 % of a barbell bench where Nuzzo's 7,289-person table says
8.8; for a 13 kg curl it gives 3.7 where the lab says ~9–10; leg press −5 reps across 90–70 %. The
"about two reps" in `e1rm.js:100` holds only for a heavy bench at 80 %. Marzagão's k is 25–50 % below
the lab-implied k at every weight, and the most economical explanation is the paper's own: its
"near-failure" sets are an AMRAP flag *or* a within-workout rep drop (43 % of the sample), so logged
sets carry rep-dependent reps in reserve and the optimiser reads that as a small k. The consistency
argument ("an app disagreeing with itself") was made when the lab literature was thought the
smaller one; it is the larger one. Nuzzo also gives the between-person SD (2.5 reps at 80 %, 3.3 at
70 %; CV ≈ 23 %), which is what the caption should carry. Options: (a) caption from Nuzzo's
main/bench/leg-press means with the CV band; (b) a range whose lower end is the inversion and upper
end the Nuzzo mean; (c) keep as is and document. Women show +2–3 reps with 3× the SD — a wider band,
not a different curve.

### 3.8 The curve's light-load bias reaches the ratings — RUN (A), REASONED
20 lb curl × 10 → e1RM 37 lb (10 reps = 54 % of max); 315 squat × 10 → 76 %. The app sits +18 to
+22 % above Epley at 45 lb, within ±3 % at 185–315, 2–4 % below at 405. Below the 10.46 lb floor the
curve is flat at k = 4.58 with a slope kink and 10 reps = 41 % of max. Every ratio and every median is
in Strength Level's currency, which converts submitted reps with a fixed-factor formula, so a biceps
rated off a 20 lb curl carries a ~30–40 % relative premium over a chest rated off a 225 bench,
unpriced by any confidence term. The same mechanism is why the simulator (D) finds a +5 to +8 % bias
if the true rep curve is Nuzzo's. Mitigations that need no new curve: rank from ≤ 8-rep sets where
they exist; scale confidence by rep count (the percent-error SD roughly doubles from 5 to 10 to 20
reps); keep the 15-rep refusal. A deeper option — exercise-class curves where Nuzzo publishes one —
breaks the one-curve consistency and needs a library→class map.

### 3.9 Confidence is uncalibrated and nothing on a screen carries a band — RUN (B, D)
Traps and Forearms, rated only through a two-ratio chain at q 0.11, read "Good" because the fourth
root lifts 0.143 to 0.61; one fallback benchmark alone reads Low. `depth` saturates at ~6 sessions;
`fresh` reads the used set while the hint reads the newest. `displayLevel`/`certain`/the ±12 % band
have no caller; the map shows a point and a tint. Three demo muscles sit within 2.2 % of a level
boundary with no hysteresis (Forearms +0.34 %). Options: cap fallback-only ratings at Fair (trivial);
persist the last displayed level and apply the plan's hysteresis margin (needs a stored field); a
real band `u = uBase/√effN + uReps·repLoad + u_ratio(q)`, with `u_ratio` fittable from the per-level
drift each derived ratio already records (§6.4). Inverse-variance aggregation was tried on the demo
and moves only Triceps and Forearms — not worth doing before a variance model exists.

### 3.10 The untrained multiplier — SOURCE (G)
D21's "nobody has measured what the median adult can bench" is false: untrained cohorts have been
measured repeatedly (28.7 kg bench in 103 women; 44.6–71 kg in men). What is missing is a
representative sample. Against the app's lifter medians: untrained women's bench 0.60–0.68, men's
0.52–0.75 (sedentary 0.52, active non-lifters 0.70–0.75), the one free-weight untrained squat 0.91.
**0.55 is fair for men's pressing, ~0.62 fits women, 0.8–0.9 fits lower body.** A per-class
multiplier, and D21's sentence corrected.

### 3.11 The absolute-accuracy claim is conditional on the curve — RUN (D)
The simulator generates its ground truth with the same curve the estimator inverts, so "within
4.6 %, 95 % coverage" is a self-consistency statement. Re-running it with a pluggable rep curve:

| true curve | bias | RMSE | coverage | lag |
|---|---|---|---|---|
| Marzagão (as shipped) | +0.7 % | 4.6 % | 95.2 % | 12 d |
| Nuzzo bench (9 reps at 80 %) | **+7.9 %** | 9.1 % | 91.0 % | 2 d |
| Nuzzo general (8 at 80 %) | +5.0 % | 6.9 % | 94.6 % | 4 d |
| Epley | +2.1 % | 5.2 % | 96.4 % | 10 d |
| mirror-steep lifter | **−6.8 %** | 7.5 % | **81.9 %** | 84 d |

The ±12 % band is a Marzagão-conditional claim; unconditional it needs ±15–18 %. Also circular:
`PLAUSIBLE_GAIN.perDay` is literally the simulator's own phase slope; `repLoad`/`uReps` echo its
assumed log-linear spread; the winsor floor "pinned from both sides" moves 0.18–0.29 under the
simulator's unlabelled readiness and rep-curve guesses; the muscle-evidence constants (half-lives,
benchmark bonus, depth, agreement, fatigue K, bands, tint) have no tool at all — all JUDGED, most
labelled. **Nothing here is a bug; it is the reason §6.1 leads the validation work.**

---

## 4. The decisions, in one place

Each is a yes/no or a pick; the plan below assumes nothing about them.

- **a. May a muscle's number go down?** (§3.1) Window the representative only, or wire the fall limit.
- **b. Wire the typo quarantine?** (§3.2) A real PR above the ceiling waits for a second set.
- **c. "Any body weight":** say "as if 180 lb", or integrate over a body-weight prior. (§3.3)
- **d. Runner captions from the lift's own set** when it has one, or fix the seat rule. (§3.4)
- **e. One dumbbell convention:** per hand into the curve (the paper's fit) or the total (the
  profile's argument). (§2.8) Whichever, then everywhere.
- **f. Sex-specific σ and a two-piece distribution;** per-lift σ. (§3.5) And which population's
  medians — Strength Level 2026 or Gravitus — for both the medians and the ratios.
- **g. Sex-specific ratios.** (§3.6)
- **h. The rep caption's source:** Nuzzo with a band, a range, or unchanged. (§3.7) This is his
  wording from 2026-09-11.
- **i. Rank from ≤ 8-rep sets where they exist; confidence scaled by rep count.** (§3.8)
- **j. Cap fallback-only confidence at Fair; hysteresis; a band on the panel.** (§3.9)
- **k. Untrained multiplier by class.** (§3.10)
- **l. `MAX_TARGET_REPS` 20 → 15, or louder flag.** (§2.2)
- **m. Fatigue items §5.1–§5.4 — which of them.** And the D28 question, §5.5, stated and not
  recommended either way.
- **n. An export of his own data for the backtest** (§6.1), and whether an anonymised copy may be
  committed as a standing test.

---

## 5. Fatigue — what the literature allows, and the brainstorm

Full evidence tables with every URL: `docs/research.md` §16.2–§16.5 and agent F's report. The
grades are the project's (🟢 strong · 🟡 moderate · 🔴 weak or single study).

**The premise that holds.** `docs/fatigue-plan.md` §4 and P4 predicted the search would return a
"written no" for a load multiplier in the *rating*. It does: **no study measures 1RM after prior
same-muscle work in the same session** (agent F's lit B, 18 papers). Any %1RM figure is a conversion
of a rep decrement through a rep curve — a second inference — and it is the only mechanism that
makes a number bigger than what was observed. **Tier 3 stays closed.**

**The premise that fails.** The literature reports *exactly* what the runner's caption prints: reps
at a fixed load, per set, by rest interval. And Willardson & Burkett 2006 showed the decline is
**proportional** — the same fraction of set 1 at 50 % and at 80 % 1RM (p = 0.849) — which makes it a
multiplier on the existing `repPrediction()` with no rep→1RM conversion at all. The caption did not
exist when P4 was pinned.

**The numbers, ~75–80 % 1RM, bench, trained men** (🟢 that reps fall set on set and rest sets the
plateau, across ≥ 8 acute studies; 🟡 the constants; 🟡 proportionality, one direct test):

| rest | set 2 / set 1 | set 3 | set 4 |
|---|---|---|---|
| 1 min | 0.50–0.60 | 0.35–0.40 | 0.25–0.30 |
| 2 min | 0.70–0.75 | ≈ 0.55 | 0.40–0.50 |
| 3 min | 0.75–0.80 | ≈ 0.65 | 0.50–0.55 |
| 5 min | ≈ 0.90 | 0.80–0.85 | ≈ 0.75 |

Free squat declines less than bench (🟡); leg press does not share the advantage. **Stronger men
decline more at short rest and women decline far less** (Ratamess 2012, 🟡) — do not assume trained
fatigues less. ~2 min is a defensible default; casual users are probably on the 1–1.5 min curve; the
1- and 5-min curves differ 2× by set 3, so **rest is the largest unrecorded input** (the app stores
no per-set time or rest — only set index, exercise order, prior same-muscle sets, session start and
finish, and days between sessions).

**What bounds any caption.** Between-person SD of reps at 75–80 % is 2.5–2.9 (Nuzzo 2024, 🟢), so
the set-2 decrement (−2 reps on an 8) equals the caption's largest existing error and set 3 exceeds
it. Self-reported reps-in-reserve is accurate to ~1 rep only within ~2 reps of failure at ≥ 70 % and
≤ 12 reps (Halperin 2022 meta, 12 studies, 🟢); 3–5 reps off far from failure; practice does not
improve it (🔴); even an honest "0 left" hides ~2 reps (Armes 2020, 🟡). Training status does not
matter once proximity is controlled.

**Between sessions** (🟢): upper body recovers by 24–48 h, lower body 48–72 h; failure costs 24–48 h
more than 3-RIR at matched volume; rep capacity lags max force; supercompensation rests on one 🔴
study (+10 % reps at 72 h); the Banister fitness–fatigue model's fatigue term is **unidentifiable**
even on 755 elite observations and adds nothing to cross-validated prediction (Marchal 2025, 🟢 for
the criticism). Between-person recovery variance dominates (0 / 40 / 80 / 80 % of trained men
recovered at 24 / 48 / 72 / 96 h from one session). A freshness term is defensible only as a discount
or as words.

### 5.1 Set-index-aware caption — "maybe 8, then 6, then 4"
`reps_k = max(1, round(reps_1 × m[rest][k]))`, the 2-min column by default, the 1- or 3-min column
when the rest timer is on and set to 60 / 180 s. Multiplier ≤ 1, caption only, never feeds the
rating, nothing on the bar; a too-steep constant means the lifter beats the caption, a too-shallow
one means today. Wording keeps the fresh figure the rating came from: *"maybe 6 on this set (8
fresh)"*. Drops and myo-reps excluded (10-s rest is another regime). One 4×4 table, one line in
`renderCaptions()`, tests for monotone non-increasing in k and equality with today at k = 1.
**Evidence 🟢/🟡 · data present · cannot inflate · tiny.**

### 5.2 The lifter's own decrement, with the table as prior
Straight-set entries with ≥ 2 leading sets at one load give `reps[k]/reps[1]` per exercise. A
simulation with within-person ratio noise 0.13 and between-person SD 0.08: a raw own-mean beats the
population number from **n ≈ 3 sessions**; a shrinkage blend `w = n/(n+k)`, k ≈ 2.6, beats it from
n = 1 and is never worse. Clamp the ratio at 1.0 (a sandbagged set 1 must not raise set 2 above
fresh). It bundles rest habit, fibre type and honesty about failure in one scalar — fine for a
caption, never a rating constant. ~40 lines in the walk `strength-observations.js` already does.
**Measurement + 🟡 prior · data present · cannot inflate with the clamp · small.**

### 5.3 Inferring "not to failure" from a flat rep run — withhold only
At ≤ 2 min rest, set 2 / set 1 ≈ 0.70–0.75 for sets to failure; only 5-min bench or conditioned
athletes stay flat. So `8, 8, 8` at one load is evidence set 1 was not near failure and its e1RM is
an under-estimate. **Use (a)**: withhold the near-max credit `repFactor` gives that exercise — the
distinction the rep count cannot make, and D28's blind spot measured from data the app already has.
**Use (b)**, raising the e1RM, is Tier 3 in a new coat and forbidden. One-sided: flat ⇒ probably not
to failure (strong); falling ⇒ ambiguous (weak). A per-entry flag feeding `evidenceWeight` ≤ 1.
**🟡 premise, the app's own inference · small.**

### 5.4 Between-session freshness — words, or a discount
When the same muscle had ≥ N direct sets < 24 h ago (upper) / < 48 h (lower), a caption note
("trained yesterday — expect a few fewer") or a credibility discount ≤ 1. Never a bonus. Expected
trigger rate is low on the shipped programmes (72-h gaps), higher through indirect overlap. Because
between-person variance dominates, words beat arithmetic here. **🟢 time-course / 🔴 supercomp ·
small, rare.** The prior-volume discount already built (`FATIGUE_HALF_SETS = 5`) cannot be sourced
but can now be *bounded*: 3 prior sets → ~15–22 % fewer reps → an e1RM ~5–8 % low, and the app trusts
that reading at 0.625 — not absurd, not sourced. What the literature licenses is a sentence on the
muscle panel: *"readings taken after other back work typically come in 5–10 % low."*

### 5.5 One opt-in tap on the last set: "how many more could you have done?" — his call
| | for | against |
|---|---|---|
| accuracy | ~1 rep near failure, ≥ 70 %, ≤ 12 reps; the last set is where in-session accuracy is best | 3–5 reps off far from failure or on light sets; a declared "0" still hides ~2; practice does not help |
| value | 155 × 8 at 2 RIR treated as 10 → e1RM 203 → 215 (+6 %): the ±15–20 % D28 gap shrinks toward ±5 % on that set; calibrates §5.2 and §5.3 | the last set is the most fatigued reading, already discounted — the tap corrects the least useful set for the rating |
| direction | only a lifter who stopped short reports > 0 | **the only item that raises a number by design** — Rule 5 territory, on the lifter's word |
| cost | one tap, last set, opt-in, inside D28's one-handed objection | D28 is explicit ("not getting one"); anchoring; noise |
Stated, not recommended either way.

### 5.6 The measurement that comes first
Before any constant in §5.1 reaches a caption: a probe over Tim's own history (a backup export, like
`fatigue-plan.md` §0's), owner sessions only, entries with no drops/myo/superset, the longest leading
run of ≥ 3 sets at one load, `reps[k]/reps[1]`, median/IQR per exercise and pooled, laid against the
four rest columns. The nearest column is the finding — *"his history sits on the ~2-min curve"* — or
*"his reps are flat: he is not taking sets to failure"*, which would re-prioritise §5.3. Then the
same for order (same exercise fresh vs after ≥ 3 prior sets within 14 days) and freshness (set-1 reps
against days since the last same-muscle session).

---

## 6. Validation and the deeper fixes

### 6.1 The backtest — `tools/strength-backtest.mjs <export.json>` (design in agent D §3)
Hold out each benchmark; remove the row, every same-exercise set that day, the whole
`sourceSessionId` session (the leakage trap: D17 benchmarks also exist as session sets), and assert
no same-day set survives; predict causally from everything before it, per lift (`estimateAt`) and
per muscle (`buildObservations` → `rateMuscle`, truth converted by the same ratio); score signed
and absolute error, band coverage, and — the check `muscle-evidence` never had — **confidence band
against actual error**. Only 1-rep benchmarks are model-free truth; a 3-rep benchmark tests
Marzagão's self-consistency on a human, which is §3.11's experiment and still worth having. ~6–8
benchmarks detect a 5-point bias, ~25–30 give a ±2.5-point headline, per cell for breakdowns.
**Needs: Tim's `exportAll()`** (§4.n). The demo can dry-run the plumbing only — its benchmarks are
`1.22 × working weight × 3`, so its "errors" describe `demo.js`.

### 6.2 The simulator — honesty items (agent D §5)
Add the curve-mismatch sweep to `tools/strength-fit.mjs` and record the ±7–8 % error budget in plan
§11.0; widen `uBase` to ~0.13 or add `uCurve ≈ 0.05` until §6.1 runs; sweep and label the readiness
σ and RIR guesses; give simulated benchmarks a readiness draw; rewrite the `perDay` comment; add a
provenance test that recomputes each quoted figure. Half a day.

### 6.3 Re-derive the ratio table systematically (agent C §4.4)
Strength Level publishes, per exercise, male and female tables at 10-lb body-weight steps × five
levels with sample sizes and dates; ~105 of the library's ~200 weighted exercises have a page.
Transcribe 117 pages (105 targets + 12 keys) at three body weights per sex → `tools/sl-standards.json`
(~3,500 numbers, 10–12 h); a pure `tools/ratio-derive.mjs` applies **the app's own load convention**
(`loadTypeFor()`, so the D1/D3 convention mismatches are caught mechanically), takes the median of
five, and emits `{m, f, σ_m, σ_f, bwSlope, n, since}` plus a generated pin test for every entry. The
regex families split where the convention differs. ~2 days; the transcription can be done in slices
per muscle. ⚠️ A conscious licensing call: the project already transcribes SL's medians with
attribution; this doubles down on it.

### 6.4 σ per entry instead of q, then inverse-variance weighting (agent C §4.3)
`q` means "believe this much"; σ has a derivation: `σ_drift = (ln r₈₀ − ln r₂₀)/1.68` from the
five-level drift each derived entry already records, plus a sourcing term (0.05 for a 2017-era page
with > 100k results, 0.10 for a 2020-era page under 10k, 0.10 for machine gearing, 0.15 carried, 0.25
reasoned). Then `evidenceWeight = repFactor × recency × fatigue / (σ_ratio² + σ_bw² + σ_rep²)`, a
precision-weighted log-mean, confidence's quality term `exp(−σ_post)`, and `estimateOneRM` can print
a ± band honestly. `q = exp(−σ/0.25)` reproduces today's ordering as a bridge.

### 6.5 Personal ratios with the table as prior (agent C §4.1)
When a lifter has recorded both a muscle's key lift and exercise X (≤ 10 reps, 90-day window, best per
day), `e1RM_X / e1RM_key` is a direct observation of *their* ratio; shrink toward the table in log
space with σ_u ≈ 0.08 per paired day and σ_t from §6.4. Two or three paired days pull a machine ratio
most of the way to the user's own — the only thing that fixes machine gearing, which no published
table can. Pair only against a direct key-lift observation, never the rating (circularity). Rule 5
wording: *"converted at your own 0.71, from 3 days you did both"*. ~150 lines + tests.

---

## 7. The plan, in order

Each phase is shippable on its own and none assumes a later one. Estimates are working days for a
session with agents on disjoint files, tests and the two audits done in one integration pass, exactly
as 2026-09-06 and -12 ran.

**Phase 0 — guardrails, before any number moves (½ day).**
Goal version stamp (§2.9). Provenance test for the fitted constants; the three wrong comments;
`stale → P.windowDays` (§2.7, §6.2). Extend the ratio pin to every derived entry (§2.3). Nothing a
user sees changes.

**Phase 1 — the defects (1–2 days).**
One load builder for every `e1rm()` call and `bodyIncluded` on the estimate (§2.1). D5 on the Data
tab (§2.2, with §4.l). The ratio corrections and the `FORCE_TOTAL`/regex splits (§2.3), re-baselining
the golden table knowingly. Fallback `>` (§2.4). Tie-break (§2.5). Profile anchor (§2.6). Core caveat
on publish, compare-sheet units, round-in-display-unit, the weigh-in sentence (§2.7). One dumbbell
convention everywhere once §4.e is answered (§2.8). Mutation-check each; the render, data-layer and
a11y suites plus the audit.

**Phase 2 — the model decisions Tim says yes to (½ day each, independent).**
§3.1 window / fall limit · §3.2 typo quarantine · §3.3 "as if 180 lb" · §3.4 captions from the lift's
own set · §3.5 sex-specific two-piece σ and one population for medians and ratios · §3.6 sex-specific
ratios · §3.7 the rep caption's source and band · §3.8 ≤ 8-rep preference and rep-scaled confidence ·
§3.9 fallback cap, hysteresis · §3.10 untrained by class. §3.5–§3.6 share the standards data and go
together.

**Phase 3 — fatigue (1 day for §5.1–§5.4 together; §5.6 first, ½ day).**
The decrement measurement on Tim's history (§5.6), then the set-index caption (§5.1), the personal
decrement (§5.2), the flat-rep withhold (§5.3), freshness words (§5.4). §5.5 only if he says so.

**Phase 4 — validation and the deeper fixes (½ day + 2 days + 1 day).**
The backtest tool and the simulator honesty items (§6.1–§6.2), which need his export. The systematic
re-derivation (§6.3), which makes §2.3 and §3.6 complete rather than patched. σ per entry and the
band (§6.4), then personal ratios (§6.5).

**What is deliberately not in the plan.** A load multiplier in the rating (Tier 3 — the literature
says no, still). A Banister-style readiness model (unidentifiable). Exercise-class rep curves (breaks
the one-curve consistency; only if the backtest disagrees with Marzagão). A body-weight axis on the
ratios (second-order). An RIR field, unless Tim picks §5.5.

---

## 8. Things this review changes in the notes, and open uncertainties

- `research.md` §2's Nuzzo table: two independent reads of the paper's model tables give **9.75 reps
  at 80 %, 3.28 at 95 %, 19.6 at 60 %** (general) where §2 holds ~8 (changed *from* ~9 on 2026-09-04),
  ~2 and ~24. Bench 80 % = 8.8 ✓. ⚠️ Nothing in the app computes from those cells; **re-read the PMC
  tables before editing §2**, then fix them and note that the 2026-09-04 "correction" of the 80 % cell
  went the wrong way. §16.5 carries the full table with the SDs.
- §9 should gain "the level never decays", "the typo screen is built, not wired", "any body weight
  means 180 lb", and the light-load bias; `strength-standards.js:462` and D21's "nobody has measured"
  sentence are wrong; `research.md` §11's "±3 %" ExRx cross-check is a classification table, not a
  measurement (the real cross-check, Strength Level vs Gravitus, is ±5–8 %); §3's "±3–5 % for 1–6
  reps" is one SD at 5RM in trained men.
- **Unverified in this review**: which formula Strength Level uses to convert submitted reps (§3.8's
  ratings consequence assumes a fixed factor); whether the runner-caption change (§3.4) is a product
  call Tim wants; the Nuzzo cells above; readiness σ in the simulator has no within-person source in
  the repo. **Not opened**: a dozen paywalled primaries, each named in the agents' reports, none
  load-bearing.
