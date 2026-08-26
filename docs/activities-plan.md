# Beyond the barbell — running, climbing, swimming, and anything else

**Written 2026-08-26, on Tim's instruction:** *"I want to make the site more applicable to
non-weight-lifting fitness activities such as running, climbing, swimming, or anything else a user
might do… when you open 'Record', it should show you maybe a few options to categorize different
types of workouts, and one of them is weightlifting, which leads you to the current page."*

**Phase 1 is BUILT and deployed the same day.** The rest of this file is the plan for what comes
after, and the reasoning that shaped Phase 1.

---

## 1. The decision this narrows — D2, "Lifting only"

D2 said *"Lifting only. Focus."* Tim's instruction reopens it, and the resolution follows the
pattern D15→D21 and D1→D26 set: **the objection was about a specific model, not the idea.**

D2's real content was that the app's *analysis* — the muscle map, the strength standards, the
progression rule, the programme ratings — is built on published lifting evidence and cannot
honestly extend to a swim. That stays fully true. What falls is only the assumption that a
session IS a lifting session.

**D27 (locked by this instruction): activities are RECORDED first-class and MODELLED not at
all.** An activity lands on the calendar, in the feed, in backups and against the cloud ceiling
exactly like a workout — and never touches the muscle map, the ratings, the volume model or
progression. The line is stated on the chooser and on the activity form, because a runner who
wonders why their map is grey deserves the answer before they ask.

## 2. Phase 1 — what shipped (2026-08-26)

- **Record is a category chooser.** Weightlifting first and biggest (it carries the
  next-in-rotation name and leads to the full recorder at `#/start`, unchanged); then Run /
  Walk-or-hike / Swim / Cycle / Climb / Something else.
- **The quick activity log** (`#/activity/<name>`, `ActivityLogView`): date (back-datable, never
  future), the activity (preset from the tile, or the full picker — custom exercises included,
  so "anything else a user might do" is literal), time and distance steppers. Saving writes a
  REAL session — one entry, one set — so every existing surface sees it with machinery that
  already exists: calendar day cells, the day view, the feed (a friend sees "Running" like any
  workout name, tier rules unchanged), export/restore, `cloudUsage()`.
- **Library additions**: Walking, Rock Climbing, Bouldering (time-only — nobody logs a distance
  up a wall), joining the existing Running / Swimming / Outdoor Cycling / Hiking / Rowing
  Machine / etc. All in the Cardio group, which has always been the "recorded, never rated"
  group.
- **What an activity session does NOT do, by construction**: no `workoutId`, so the rotation
  suggestion skips it (asserted); Cardio-group exercises have never been rankable, so the muscle
  map ignores it; progression never sees it (progression reads workout history through the
  runner, which activities do not use).

## 3. Phase 2 — worth building, in rough order

1. **An Activity muscle-group of its own.** "Rock Climbing · Cardio" reads wrong. A dedicated
   `Activity` group label (still unrankable) fixes the words without touching the model. One
   library sweep plus the group list.
2. **Pace, shown not judged.** Time ÷ distance is derivable from what is already stored. Show it
   on the day view and the activity's chart tooltip. Rule 6 applies: pace is displayed, never
   coloured good/bad — a recovery run is not a worse run.
3. **Activity history on Data.** The line chart already charts time and distance per exercise;
   check the axis labels and normalisation make sense for `dt` exercises (rep-normalisation must
   not touch them) and add a pace mode if cheap.
4. **The feed card names the activity kind** (a small glyph or word) so a run reads as a run at a
   glance. The projection already carries the name; this is presentation.
5. **Activity PRs on the finish path.** The quick log bypasses `personalBests()`. Longest run /
   fastest 5k-ish comparisons are recorded-vs-recorded and Rule-5-safe, but "fastest" needs
   distance-bucketing to be honest — design before building.
6. **Per-activity extras** (climbing grades, laps, elevation): each needs a field the model
   ignores, a `fields` extension, and a reason. Grades are the most asked-for by climbers and the
   least standardised (V-scale vs French). Do not guess; ask Tim which activities his circle logs.

## 4. What is deliberately NOT planned

- **Modelling activity fitness** (VO2max estimates, training load, recovery scores): no published
  model the app could carry honestly at this data density, and the app's credibility rule is to
  refuse rather than guess.
- **GPS routes / maps**: the location feature is a typed label by privacy design (0m); a route is
  the opposite decision and would need its own privacy argument from scratch.
- **Counting activities into weekly volume or goals**: volume is hypertrophy-evidence-based and
  set-denominated; a swim has no sets. D27.
