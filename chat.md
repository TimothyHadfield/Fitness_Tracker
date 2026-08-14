# Conversation Log

A running human-readable summary of what has been discussed. Newest session at the bottom.
For project state and decisions, see `progress.md` — this file is for "what did we actually say
about X."

---

## Session 1 — 2026-08-14

### Opening ask

Tim proposed a fitness tracker app: log weight/reps/time for any exercise, track things over time
including body weight, set up lifting "programs" to measure performance, and enter data mid-workout.
Also floated a diet tracking section, but suspected it might be too complicated and that better
sources exist.

First request: **search for existing free versions before building anything**, to see whether the
project is even necessary.

### Competitive search — free lifting trackers

Found and reported, with a caveat that many "best free tracker" listicles are marketing content
published by rival apps:

- **wger** — open source (AGPL), web-based, does workouts + body weight + nutrition. Closest to
  the original full spec.
- **FitNotes** — completely free, no ads, no IAP. Android only.
- **Liftosaur** — free + open source, iOS/Android/web, programs written in a scripting language.
- **openGym** — self-hosted, Docker.
- **Boostcamp** — free tier with 130+ coach programs.
- **Hevy** — most recommended, but free tier caps history at 3 months.
- Diet: **Cronometer** and **FatSecret** for free nutrition tracking.

**Recommendation given:** the lifting side is well-served by wger and Liftosaur; the real gaps are
Hevy's history cap and the fact that none of it is yours. Skip building diet.

### Follow-up — direct links, iOS only

Tim asked for links that go straight to the actual app rather than a GitHub repo, and noted he is
**iOS only**. FitNotes was dropped (Android only). Provided direct web-app and App Store links for
Liftosaur, wger, Boostcamp, Hevy, openGym, Cronometer, FatSecret.

### Monetization analysis

Tim asked how each app makes money and how that restricts the free experience. Findings:

- **wger** — no monetization at all. Volunteer/community built. Nothing restricted.
- **Liftosaur** — $4.99/mo, $39.99/yr, $99.99 lifetime. Cloud sync possibly premium (unconfirmed).
- **Boostcamp** — free includes all 11,000+ programs. Pro ($59.99/yr) adds exclusive content only.
- **Hevy** — free capped at 4 routines, 7 custom exercises, 3 months of graphs. ~$3–5/mo.
- **Cronometer** — free is ad-supported, 7-day report window. Gold $59.99/yr.
- **FatSecret** — free is fully functional, ad-supported. Premium $59.99/yr.

**Key insight surfaced:** four of five commercial apps monetize by restricting access to *your own
accumulated data* — history, sync, or long-range charts. It's the smartest possible paywall for a
tracker because the value grows the longer you use it. That directly answers "is building this
necessary": daily logging is commoditized and free; long-term retrospective analysis never is.

### Decision — build lifting, skip diet

Tim decided to build the workout tracker and asked whether anything is genuinely good and free for
diet. Answer: yes — **Cronometer** (best free nutrition data, 84 nutrients, USDA-sourced),
**FatSecret** (least restricted), **OpenNutriTracker** (100% free, open source, on iOS).
Avoid MyFitnessPal (barcode scanning paywalled since 2022, $79.99/yr). MacroFactor has no free tier.

Explained *why* diet is different: nutrition tracking is present-tense — you care about today's
remaining protein, not what you ate 14 months ago — so a history cap clips something you'd rarely
use. In lifting, the same cap destroys the entire point. **Diet formally cut from scope.**

### Deep competitive teardown

Tim asked for an analysis of the best lifting apps — what they do best, what they could improve, and
how to use those ideas. Stated priorities: **usability, formatting, and scientific knowledge**.
Minimum bar: **better than Google Sheets**. Stretch: educating new lifters and providing workouts.

Produced a formatted teardown document covering Strong, Hevy, Boostcamp, Liftosaur,
Alpha Progression, RP Hypertrophy, and Fitbod. Main conclusions:

- **Weekly sets per muscle group** should be the headline metric — nearly every app charts
  individual lifts instead, and muscle-group volume is what hypertrophy responds to.
- **The Google Sheets bar is the right one and harder than it sounds.** Spreadsheets survive on
  whole-block visibility, structural freedom, visible formulas, and permanence. They only lose on
  the mid-workout logging moment.
- **e1RM should be rep-range honest** — Epley for 2–5 reps, Brzycki for 6–10, de-emphasize anything
  above 10 reps. Everyone else plots all of it as equally trustworthy.
- **Invert RP's jargon problem** — teach concepts at the moment of first use, inline.

Published as an artifact, then saved into the project at `docs/competitive-teardown.html`.

### Project scaffolding

Tim asked for `progress.md` (the catch-up file for when context runs out — the plan is to say only
"Catch up in progress.md" in a fresh chat), `chat.md` (this file), and any other organizational files
that help.

He also set the **working agreement**: he acts as manager and describes the vision; Claude builds it
and gives recommendations rather than option menus. Claude should ask questions only when it can't
infer the vision — and if it has a good recommendation, go with it instead of asking.

Created `progress.md`, `chat.md`, and `docs/spec.md`.

Tim added a second behavior rule: **questions must go in the interactive question box, not in the
response text** — he often doesn't read a full reply, so questions written in prose get missed.
Recorded in the working agreement in `progress.md`.

### Audience confirmed — this is a product, not a personal tool

Asked three questions via the question box. Answers:

- **Who for:** Tim and friends to start, but open to anyone and potentially many people eventually.
- **Experience level:** open to any level.
- **Training goal:** people can choose.

All three point the same way — it's being built for other people, at any level, with any goal.
Three new consequences recorded as decisions:

- **D9** — progressive disclosure is now *core architecture*, not a Tier 3 nicety. Advanced controls
  (RIR, tempo, set types) hidden by default, revealed on demand. Hardest requirement in the project.
- **D10** — training goal is a user setting that reconfigures the dashboard: hypertrophy shows weekly
  volume as the headline, strength shows e1RM, general fitness shows a broader mix.
- **R2 revised** — local-first is still right for v1, because it already serves "me and friends"
  (each browser holds its own data). Accounts and sync solve *cross-device and backup*, not
  multi-user, so they became a real roadmap item rather than a maybe.

Also resolved two modelling questions without asking, per the working agreement: drop sets and
myo-reps count as **one** hard set, and secondary-muscle weighting is **fixed at 0.5** with an
advanced override.

### v1 built

Tim narrowed the scope: *"work on the overall format of the site. Ignore all of the 'smart'
features."* He specified the whole flow in detail:

- **Workouts** — user creates any number of named workouts (Legs, Push, Pull, Cardio…), each
  holding any number of exercises picked from a large searchable list, with custom exercises
  as a fallback.
- **Recording** — press "start a workout", choose which one, then each exercise appears one at a
  time pre-filled with whatever was entered last time for that exercise in that workout. Adjust
  with +/− arrows (reps ±1, weight ±5 lbs, time ±10 sec). Right arrow advances, left arrow goes
  back. Finishing records it to the calendar automatically.
- **Benchmarks** — pick date (default today), exercise, and numbers; saves to graph and calendar.
- **Calendar** — starts empty, fills as things are recorded; tap a day to see everything done.
- **Graphs** — pick any exercise with 2+ records, plot value against date, with a summary showing
  start vs now and the percentage change.
- **Format** — designed for iPhone first, adapted for laptop.

He also said a backend would be needed (Firebase or similar) and that GitHub is available.

Built it as a dependency-free PWA: 9 JS modules, one stylesheet, 265-exercise library. Verified
with 23 headless data-layer assertions and a syntax check on every module. Two honest gaps
reported: **no browser run happened** (visual layout unverified), and the **Firebase adapter is
written but never executed**, because creating a Firebase project needs a Google login only Tim
has — `docs/firebase-setup.md` covers the five-minute console walkthrough.

Also surfaced a repo problem: the `Code Projects` folder is itself a git repo whose remote is
`Estimator_Quiz`, so committing here would push the fitness tracker into the wrong repository.
Flagged for Tim to decide rather than acting on it.

### Shipped

Tim chose a new public repo with GitHub Pages, and to delete the leftover empty
`fitness_tracker.html`. Both done. The project now has its own nested git repo (separate from the
`Estimator_Quiz` repo that owns the parent folder), and the app is live at
**https://timothyhadfield.github.io/Fitness_Tracker/** — all assets verified serving with correct
MIME types.

**State at end of session:** v1 built, deployed, and live. Still awaiting a real browser/phone run
by Tim, and Firebase credentials before cloud sync can be switched on.
