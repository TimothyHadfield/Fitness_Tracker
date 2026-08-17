# Vision — Tim's running list

> **This file is a capture, not a plan, and nothing in it is being built.** It exists so ideas have
> somewhere to live between having them and deciding on them. Tim adds to it whenever something
> occurs to him; nobody should start work off this file without him saying so.
>
> A roadmap lives in `progress.md` §8. An idea graduates from here to there only when Tim says it
> does. Until then, an entry here is a want, not a commitment — the wording is his, and where
> something conflicts with a locked decision the conflict is *noted*, never quietly resolved.

**Started:** 2026-08-16 · **Last added to:** 2026-08-16

---

## How to use this file

- **Tim:** just write. Rough is fine. Half a thought is fine. Add to the bottom of §1 or start a new
  numbered idea — don't worry about where it fits.
- **Claude:** never delete an entry. When one gets built, mark it **BUILT** with a date and leave the
  original text alone. When one is dropped, mark it **DROPPED** and say why. Keep the *Where this
  collides* notes honest and current — that is the part that earns this file its keep, because
  several of these ideas contradict decisions already locked in `progress.md` §6.

---

## 1. The ideas

### 1.1 Social — Strava, but built for lifting

Let a user contact other people on the site and see what they are doing with their workouts, plus
wider visibility like overall progress. **Per-person visibility controls** — the user decides who
sees what.

Same *format and feel* as Strava, but structured for actual weightlifting rather than runs. The point
is that Strava's shape works and nobody has done it properly for lifting: a run is one number, a
lifting session is a structure.

Open threads to think about later:

- What is the unit of a "post"? A session? A PR? A block? A muscle-map snapshot?
- Following vs friending vs both.
- Visibility axes: per-person, per-metric (they can see my volume but not my weights?), per-exercise.
- Does the body map become the shareable object? It is the most distinctive thing the app has.

**Where this collides:** **D7 says "No social feed"** — reasoning was that a feed is repeatedly
unwanted in Hevy's reviews. That was about a *passive scrolling feed bolted onto a logger*, which is
not what is described here, but D7 is locked and would need explicitly revisiting. Also: social is
the first feature that makes other people's data a hard privacy problem, so `firestore.rules` and
D12's anonymous-first model both get materially harder. Worth knowing before, not during.

### 1.2 Smart systems — the app adjusts the workout

Have the site automatically adjust things for a workout — weight and rep adjustments that support and
optimise **progressive overload**, rather than the user repeating an identical exercise forever.

When the user starts a workout, the system should also **suggest which workout to do**, based on
which workouts they have done previously. *(Tim's note trailed off mid-sentence here — "and which
one …" — so there is a second input to that suggestion still to be captured. Ask before assuming.)*

Open threads:

- Suggesting a *workout* (which day of the split) is a different problem from suggesting *numbers*
  within it. Probably two features that look like one.
- What does it do on week one, with no history?
- Does it ever adjust without asking, or always propose? Silent adjustment is the kind of thing that
  destroys trust if it is wrong once.

**Where this connects:** this is Tier 2's *progression rules* (linear + double progression) grown up,
and it wants the strength estimator from `docs/strength-estimate-plan.md` underneath it — an
adjustment engine is only as good as its read on current capability. Also touches **D10** (training
goal reconfigures the app) and **D8** (teach at the moment of use: it should say *why* it moved the
weight).

### 1.3 Pre-designed workout systems, ranked by how optimal they are

Ship pre-designed programs built for specific goals — high-intensity hypertrophy, time-optimal, and
so on — and rank each one on **how "optimal" the system is as a whole, shown as a percentage**.

The example Tim gave, which is the whole idea in one line: the most optimal system might be **5×/week
at ~90 min**; another might be **90% as optimal at 3×/week and ~45 min**. The user then assesses
**what they are giving and what they are getting**.

Also: a few **influencer or celebrity systems** the user can pick.

Open threads:

- Optimal *for what*? The percentage only means something against a stated goal, so it is probably a
  percentage per goal, not one number. Ties directly to D10.
- What is the denominator — the theoretical best, or the best program in the library?
- This is the single most *scientifically* load-bearing number the app would ever show. It needs real
  grounding in `docs/research.md` (volume/frequency literature) or it is a made-up number with a
  percent sign on it, which is worse than no number.
- Celebrity systems have an obvious tension with that: they are a draw, and many are not optimal. The
  honest version might be that showing a celebrity system's *low* percentage is the feature.

**Browsing and adding BUILT 2026-08-17; third-party content is not.** Workouts → Explore ready-made
systems lists them, shows the whole programme with its per-exercise notes, and copies one into the
account on a tap. Three of the app's own ship with it.

**The celebrity part is blocked, and not on effort.** Tim asked for Jeff Nippard's *Ultimate Push
Pull Legs* first. The full 12-week system is a paid product on his site, and the free YouTube series
cannot be watched from here — secondary write-ups are partial and contradict each other. Shipping a
guess under a real person's name is the one thing this project has consistently refused to do. The
data model already carries `author`, `sourceName` and `sourceUrl`, and the screen shows them, so a
licensed or properly sourced system needs no new code. What it needs is permission, or a first-party
written source.

**Groundwork laid 2026-08-17.** Workouts now live inside **systems** — a system is a named programme
holding several workouts — which is the container a shipped or celebrity programme would arrive as.
Tim asked to build system creation first and do the celebrity systems afterwards. What exists is
creation, naming, notes and deletion; what does not exist is any notion of a system that came from
somewhere else (an author, a source, a rating, a way to copy one into your own account), or the
"% optimal" number, which is still the part that needs real grounding.

**Where this connects:** Tier 3's "small set of well-explained starter programs". The ranking is the
part that is genuinely new versus every competitor.

### 1.4 Body comparing — "Compared to:" is a user setting — **BUILT 2026-08-17**

Right now the muscle map compares the user to people who lift and are similar to them. The user
should be able to choose what they are compared against, in a **"Compared to:" setting**.

- **Default stays:** people who lift, similar weight, gender, age.
- **Choosable:** male · female · all · a specific weight · all weights · a specific age · all ages.
- The **colours and ranges of the muscle groups change accordingly.**

**BUILT 2026-08-17, as described, then restructured the same day on Tim's note that "people like me"
should not be a category at all.** The header on the Muscles screen is the control: it states the
comparison group and opens a sheet with two presets — **Like me** and **Everyone** — sitting over four
independent axes: population (people who lift / everyone), sex (men / women / both), body weight
(mine / any) and age (mine / any). Saved to settings so it survives a reload. Levels, percentiles,
targets and colours all move together.

Two things worth knowing about how it was built. "Everyone who lifts" is a genuine **mixture** of the
male and female distributions, not a made-up combined median — the split it assumes (55 % male) is an
assumption, is marked as one in the code, and affects nothing else. And a mixture has no closed-form
inverse, so the targets panel solves it by bisection; there is a test that every level's target,
under every one of the sixteen combinations, actually grants that level when hit.

**The D15 worry below turned out not to apply** — "all" sits alongside male/female, so it is the sex
axis, not the population axis. The general-population readout is still the separate "vs. everyone"
line it always was. The original note is kept:

**Earlier, partly unblocked:** The related complaint — that the map was far too picky about which
exercises counted — is fixed: every exercise that trains a muscle now rates it, with a confidence
that fades the colour. That work built the machinery a "Compared to:" setting would sit on top of,
but the setting itself is NOT built and the comparison group is still fixed.

**Where this collides:** **D15** locks ranking to *people who lift*, never "everyone", because
general-population data makes essentially every user Elite and the seven-level scale collapses. An
"all" option is exactly that case. It is not necessarily wrong to offer — it is a comparison the user
explicitly asked for and understands — but it cannot be silent: the screen has to say what the
comparison group is, and the levels have to stop meaning what they meant. Probably: keep the seven
levels pinned to the lifting population always, and let the *comparison* change the percentile shown
against it. That is a design question, not a settled answer.

Also worth knowing: the underlying standards data is thinner for some slices than others (see
`docs/research.md` §strength standards). Some combinations of the choices above will have no real
data behind them, and the app's whole credibility rests on saying so rather than interpolating
quietly.

---

## 2. Themes running underneath these

Not Tim's words — an observation, so it can be argued with:

1. **Three of the four turn the app from a recorder into an adviser.** Smart systems, ranked
   programs, and comparison groups all make the app assert something. Everything the app currently
   asserts is either measured or derived from published standards, and §5 Rule 5 and Rule 6 exist to
   keep inference visually and editorially separate from measurement. That principle has to survive
   the transition, or the app becomes the thing it was built against.
2. **Social changes the data model's threat surface**, and it is the only one of the four that cannot
   be prototyped locally.
3. **The strength estimator sits under at least two of them.** Which is another argument for Phase 0
   of `docs/strength-estimate-plan.md` being the right next thing regardless.

---

## 3. Not yet placed

Space for anything that doesn't have a home yet. Add freely.

*(empty)*
