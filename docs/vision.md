# Vision — Tim's running list

> **This file is a capture, not a plan, and nothing in it is being built.** It exists so ideas have
> somewhere to live between having them and deciding on them. Tim adds to it whenever something
> occurs to him; nobody should start work off this file without him saying so.
>
> A roadmap lives in `progress.md` §8. An idea graduates from here to there only when Tim says it
> does. Until then, an entry here is a want, not a commitment — the wording is his, and where
> something conflicts with a locked decision the conflict is *noted*, never quietly resolved.

**Started:** 2026-08-16 · **Last added to:** 2026-08-17

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

### 1.2 Smart systems — the app adjusts the workout — **HALF BUILT 2026-08-17**

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

**The FIRST half is BUILT — 2026-08-17.** Home's big button is now the next workout in your rotation
rather than a generic "Start a workout": it reads your most recent session, finds that workout in its
system, and offers the one after it, wrapping at the end. The caption says what it read ("Next in
Push Pull Legs. You did Push 2 days ago") and **Choose another workout** sits underneath, so nothing
is ever forced. `js/next-workout.js` — pure, with the date passed in.

Three decisions inside it worth keeping:

- **Rotation, not "whichever is stalest".** The two agree whenever somebody follows their programme,
  so the choice only matters when they have not. Rotation wins because the order is what the author
  actually wrote — Push 1 and Push 2 are different sessions on purpose — and a stale-first rule would
  chase anyone who misses a day into repeating the same catch-up forever. This only became possible
  the same day, when copied workouts started carrying an `order`; before that they came back
  alphabetically and there was no rotation to read.
- **It never scolds and never refuses.** Train twice in a day and it says "You already did Push
  today — this is next when you are ready". Telling somebody they have trained too much would be an
  opinion the app has not earned (Rule 6). Reading their own rotation back to them is not.
- **Silent rather than wrong.** No history *and* more than one system means no suggestion at all,
  because guessing which programme somebody meant to start is exactly the confident-and-wrong this
  project is built against.

**The second half — suggesting the WEIGHTS AND REPS — is deliberately untouched.** It needs the
strength estimator underneath it, and a number the app moved for a bad reason is the failure this
whole file warns about. Tim's trailing "and which one …" note below is also still uncaptured.

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

**First creator system shipped 2026-08-17:** Jeff Nippard's *Ultimate Push Pull Legs (2023)*,
transcribed from published write-ups of his **free** YouTube series and flagged on screen as
unofficial, with a link to the playlist. Not from his paid ebook. One rotation of a six-part series.

**Four more shipped later on 2026-08-17**, on Tim's ask — Arnold's *Golden Six*, *Mike Thurston's
Six-Day Split*, *Volume Landmarks Hypertrophy* and *Dr. Mike's Floating Split*. **Eight systems now**,
five credited to real people.

Two of those are Israetel, deliberately, and the reason is worth keeping. The first attempt shipped
only *Volume Landmarks Hypertrophy* — a programme built on his published method, credited via a new
`basedOn` field so his name could never appear as its author — on the conclusion that no
transcribable programme of his existed. **Tim said to search harder for reposts and summaries, and
he was right:** Renaissance Periodization publish his actual split on their own site, free, and an
independent write-up agrees with it exercise for exercise. That is now *Dr. Mike's Floating Split*.
Both are kept: one is what he really does (a cutting split, mostly myo-reps, only partly
representable here), the other is a runnable programme built on what he teaches. The distinction
that came out of the first attempt survives and is worth more than the mistake cost — **a system
that FOLLOWS someone's method is not a system BY them.**

The **"% optimal" number is still not built**, and it is now the obviously missing piece: eight
programmes sitting in a list with no way to compare them is exactly the state this idea was written
to fix. It would also be the honest way to show what a cutting split is and is not for.

**Superseded note, kept for the reasoning:** Tim asked for Jeff Nippard's *Ultimate Push
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

### 1.5 Set types — supersets, drop sets, tri-sets — **BUILT 2026-08-17**

Tim, 2026-08-17: eventually add **supersets, drop sets and tri-sets** to the site.

Right now a workout is a flat list of exercises and a set is a flat list of numbers. There is no way
to say "these two are done back to back with no rest", or "strip the weight and keep going", or
"three exercises in a row". `progress.md` §9 has recorded "No supersets" as a known gap since the
beginning; this is Tim asking for it to stop being one.

**Why it came up now:** it is the thing blocking celebrity systems, which is not obvious until you
try. Three of the names worth shipping cannot be represented honestly without it —

- **Chris Bumstead's** programme is built on tri-sets and drop sets. Written as a flat list it is not
  his workout, it is a list of the exercises in it.
- **Dr. Mike Israetel's own training** is myo-reps and giant sets almost end to end. It IS shipped —
  *Dr. Mike's Floating Split*, transcribed from RP's own free write-up — but with the set structure
  stripped out, which its warning leads with. It is the clearest case in the app of a programme that
  is *present but not faithful*, and set types are the only thing that would fix it.
- **Mike Thurston's** arm day pairs every exercise (1A/1B, 2A/2B) in at least one published version.
  The version shipped is a different, unpaired block of his.

Open threads:

- Four things are being lumped together and they are not the same shape. A **superset** and a
  **tri-set** are a grouping of *exercises*; a **drop set** and a **myo-rep** are a structure
  *within one set*. Probably two features.
- What does a drop set count as for volume? The app already resolved the adjacent question — "drop
  sets / myo-reps count as **one** hard set" is in `progress.md` §6, decided so volume totals don't
  inflate. Building the feature has to keep that true, which means the data model must be able to
  say "this is one set with three drops", not "three sets".
- What does the **rest timer** do inside a superset? It counts up from the last logged number today
  (§3), and the whole point of a superset is that there is no rest between the pair. It should
  probably start only after the last exercise in the group.
- The session runner walks exercises one at a time. A group has to be walkable as a unit without
  turning the screen into a nested list — which is a **Rule 1** problem (the window never scrolls).
- What happens to grouping when the user edits a recorded session, or when a preset carrying groups
  is copied and then edited?

**BUILT 2026-08-17**, and the open thread above about "four things of two shapes" turned out to be
the whole design. It is now **D23**:

- A **superset / tri-set / giant set** is a `group` on adjacent exercises — a statement about the
  SPACE BETWEEN them. In the builder the control therefore sits in the *gap*, not on either row.
- A **drop set** is `drops[]` nested INSIDE a recorded set. This is the load-bearing half: it makes
  "a drop set counts as ONE hard set" true **by construction**, because every existing count of
  `sets.length` keeps counting one and no analysis code has to know drop sets exist. Flattening them
  into `sets` would have inflated every volume figure in the app.
- The **rest timer** answer to the open thread above: rest fires at the end of a ROUND, and after a
  *drop* rather than after the top set. A timer that started between the two halves of a superset
  would be telling the user to do the opposite of what a superset is.

The session runner walks a superset round by round — A, B, rest, A, B — because all of A and then
all of B is not a superset, it is two exercises in a row. Nippard's Push and Israetel's Push 1 now
ship with their documented supersets intact instead of flattened.

**Myo-reps followed the same day**, and cost almost exactly what the note above predicted: the same
nesting shape, one label, one rest hint, one default count (3, the low end of his usual 3–5). The
set-type control became a **sheet** at that point — three types plus a count is past what a cycling
chip can carry, and the sheet also has room to say what a myo-rep *is*, which D8 asks for and a chip
label cannot.

**The payoff is *Dr. Mike's Floating Split*.** It shipped hours earlier with a warning saying its
structure had been stripped out; 11 of its exercises are now marked as myo-reps and that sentence
has been deleted from the warning because it stopped being true. **Chris Bumstead is now buildable
and has not been built.** RIR and tempo remain deliberately absent (D9).

**Where this connects:** ranked pre-designed systems (§1.3) — several of the best-known programmes
could not even be *entered* before this, so the celebrity library had a ceiling. Nothing here
collided with a locked decision.

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
