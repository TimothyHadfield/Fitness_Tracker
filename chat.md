# Conversation Log

A running human-readable summary of what has been discussed. Newest session at the bottom.

**For a fresh Claude session: you do not need this file to work.** `progress.md` is the catch-up
file and carries everything operative. Come here only to answer "what did we actually say about X"
or to recover reasoning that didn't make it into a decision.

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

### Round 2 — four improvements

Tim asked for four changes:

1. **Sets and details in the workout builder** — each exercise in a workout now carries a planned
   set count (mini +/− stepper) and a free-text note. The session runner builds exactly that many
   sets, repeating the last recorded set where history runs short. Old workouts saved under the
   previous shape migrate automatically on read.
2. **No page scrolling, ever** — the window is now locked (`overflow: hidden`, `100dvh`). Each
   screen is a fixed header, an optional fixed region, exactly one scrolling region, and an
   optional fixed footer. Lists scroll inside their own box. The session set list got its own
   capped scroll so it can't push the steppers off-screen.
3. **Per-side vs total weight** — every weighted exercise is now labelled `PER SIDE` or `TOTAL`,
   derived from equipment with explicit overrides for the cases equipment gets wrong (cable
   crossovers are per side because they pull two stacks; a goblet squat is total because it's one
   bell in two hands). Recorded sets read `50 lbs/side × 10`. Custom exercises let the user pick.
4. **Named calendar days** — replaced the dots. A day with a workout is filled in accent and shows
   the workout's own title; a benchmark day is filled green and reads "Benchmark". Multiple
   workouts show the first two plus a "+N".

Test coverage grew from 23 to 45 assertions, including every tricky load-type case individually.

### Round 3 — flatten and compress

Tim revised his round-2 instruction: rather than letting inner boxes scroll, **resize pages so
scrolling isn't needed at all** unless content is genuinely about twice the screen. He also asked
to **remove the boxes entirely** and blend everything together for page efficiency.

Rewrote the stylesheet around two rules — nothing scrolls unless it truly must, and no bordered
cards. Structure now comes from hairline rules, spacing and type weight.

Biggest space wins:
- **Steppers became a two-column grid**, so weight and reps sit side by side instead of stacked —
  about 140px back on every session screen
- Every card border removed (calendar, day detail, graph, set list, rows, stats)
- Summary stats became a 4-across hairline grid
- Cut redundant copy: the "per side / total" line in the session head (the stepper label already
  says it) and the calendar hint line

Session screen now measures roughly 640px of an ~850px viewport with three sets, so it fits.
Verified that every class referenced in JS still has a CSS rule after the rewrite.

### Round 4 — scrolling calendar + benchmark bar chart

Tim asked for two changes, plus flagged that Claude Code kept asking permission for bash commands
despite his settings.

**Permissions.** His `~/.claude/settings.json` already allowed all Bash — the prompts fired because
some commands `cd`'d into directories *outside* the project (the bundled-skill temp folder), which
triggers its own scope check. Added `additionalDirectories` to his user settings and changed
approach to keep every command inside the workspace. Permission changes need a reload
(Shift+Tab to bypass mode, `/permissions`, or restart) — Claude can't grant itself permission
mid-session.

**Calendar → vertical scroll.** Replaced the prev/next arrows with one continuous scroll through
months, each with a sticky heading. Range covers at least 12 months, extended back to the earliest
recorded day, and opens scrolled to the current month.

**Benchmark bar chart.** Graphs now has two modes: *Over time* (the existing line chart, all
sources) and *Start vs now* (new). The bar chart shows every exercise benchmarked on two or more
days, with paired horizontal bars — first benchmark and latest — sorted by biggest mover. It reads
**benchmarks only**; workout logs are deliberately excluded, and there's an explicit test asserting
session data does not leak in. Exercises with a single benchmark are excluded with a visible count
explaining why.

Chart colours were validated rather than eyeballed: dark `#3D8FC0`/`#C08430` and light
`#2C7CB0`/`#96660F`, all six data-viz checks passing in both themes (CVD ΔE ~20 against a threshold
of 8). Bars also carry direct value labels and text tags so identity is never colour-alone.

Test suite moved into the repo at `tests/data-layer.test.mjs` and grew to 50 assertions.

### Round 5 — content first

Tim: the graph and calendar screens gave roughly a third of the page each to selectors and
"random details", squeezing the actual chart. His rule: **plan within the space you have — put the
most important thing in as big as it will go, then fit the controls into what's left, not the
other way round.**

- The line chart is now **measured rather than fixed-size**: `fillChart()` reads the container's
  real pixel dimensions and draws the SVG at exactly that, with a `ResizeObserver` handling
  rotation. Gridlines and date labels scale with the available size. The plot went from a ~350px
  cap to roughly 500px on a normal phone.
- `screenShell({ title })` now accepts a DOM node, so a screen can put its primary control in the
  header instead of a heading that just repeats the nav label. Graphs puts the mode switch there;
  Calendar puts its legend there — each reclaiming a full row.
- Graph controls collapsed from three stacked rows into one.
- Bars thicken with the viewport (`clamp(13px, 2.4dvh, 24px)`) and rows flex to share the height,
  so a short list fills the screen instead of clustering at the top.

### Handoff prepared

Tim announced a chat reset — the new session will be given only *"catch up with progress.md"*.
`progress.md` was rewritten from scratch as a standalone handoff: stale entries removed (the
deleted placeholder file, the already-resolved GitHub question), section order fixed, and a
new §0 added up front carrying the five things that bite a fresh session — the nested git repo,
not `cd`-ing outside the workspace, the pending permissions restart, the upkeep obligation, and
the fact that nothing has ever been seen in a browser.

`docs/spec.md` was corrected too: its data model still showed the original *draft* schema rather
than what was actually built. It now shows the as-built shape, an explicit gap table, and the
target shape — with a note that the weighted muscle mapping is the only change carrying real cost,
and that it blocks D3 (volume per muscle).

**State at end of session:** rounds 1–5 built, deployed, and live at
https://timothyhadfield.github.io/Fitness_Tracker/ — 50 tests passing, nothing visually verified,
Firebase written but not connected.

---

## Session — 2026-08-15 · comparing the same exercise across different rep counts

Tim: *"if someone benchmarks an exercise with a certain weight and reps, then does the same thing
again with a different number of reps, it's hard to know if there's been an improvement."* He asked
for the topic to be researched properly online, specifically whether a reliable weight↔reps
conversion exists and **whether it is the same for every exercise or changes per exercise**.

His target design: find the rep count the user recorded most often for that exercise, then estimate
every off-rep entry to what it would have been at that count, and chart the whole thing as one
consistent series.

### What the research found

**Yes, there's a reliable conversion — but it's indirect.** You never convert weight→weight. You
convert each entry to an **estimated 1RM** (a rep-count-free common currency), then invert back to
the target rep count. Entries already at the target round-trip to exactly themselves.

**No, it is not the same for every exercise — and that's the headline.** Nuzzo et al. (2024), a
meta-regression of 952 reps-to-failure tests from 7,289 people across 269 studies, tested sex, age,
training status and exercise type as moderators. **Only exercise type mattered.** Leg press gets
~13 reps at 80% 1RM where bench press gets ~9. The authors had to publish separate loading tables
for the two.

Every classical formula — Epley, Brzycki, Lombardi, Lander, O'Connor, Mayhew, Wathen — uses a single
fixed conversion factor for all exercises, and most were derived from young trained males doing the
bench press with no published sample at all (Epley's came from a poundage chart in a training
manual). Applying one of those across a 265-exercise library is structurally wrong.

**The formula adopted:** Marzagão (2026), a pre-print that fitted a weight-dependent generalisation
of Epley on 303,494 near-failure sets from 14,966 users across 388 exercises:

```
1RM = w × (1 + (r − 1)^0.85 / k(w))       k(w) = max(0.5, −2.55 + 4.58·ln(w_kg))
```

The conversion factor rises with load (k ≈ 8 for a 10 kg lateral raise, ≈ 20 for a 150 kg deadlift),
using weight as a proxy for exercise type. 17–22% more internally consistent than all four classical
benchmarks, positive for **all 183** exercises with enough data and every equipment category, with
near-zero overfitting under user-level cross-validation. Biggest gains on light isolation work —
which is most of our library.

Logged as **D11** in `progress.md`, superseding the old D5 Epley/Brzycki split.

### Caveats recorded rather than glossed

- The formula was optimised on *internal consistency*, not against measured 1RMs — it captures
  relative structure better, which is what a progress chart needs, but it is not a claim about
  anyone's true max. No external validation study exists.
- All rep-based formulas assume near-failure effort, and Steele et al. (2017) found people
  underpredict reps-to-failure by 1–5. **But** since we compare a user to themselves on the same
  exercise, that bias shifts the level of the series, not its shape — trend and ordering survive.
  Output should be labelled "equivalent load", never "your max".
- Bodyweight and assisted exercises are excluded outright: the logged weight is added/assisted load,
  not total resistance.
- Pre-print, single author, who works at Fitbod (whose data it is).

### Tim's example, run through the model

`25×10, 45×4, 35×10, 60×1, 45×10` → modal reps = 10 → series becomes
**25 → 33.3 → 35 → 36.9 → 45**. Tim's hand estimate was 25 → 30 → 35 → 40 → 45; the model agrees on
ordering and the monotonic rise, differing 3–4 lbs on the two estimated points.

### Research file

Mid-session Tim asked for the research to be written down **in all categories**, so a single
accumulating `docs/research.md` was created rather than a one-topic file: rep-normalisation/e1RM,
reps↔%1RM, proximity to failure, fatigue & rest intervals, velocity-based training, volume & the
rep continuum, competitive landscape, data-viz colour, plus an explicit unverified-claims list.
Every finding is graded 🟢/🟡/🔴 for evidence quality and the full source list is at the bottom.
`progress.md`'s file-upkeep table now points at it with an instruction to append rather than start
new research files.

**Nothing has been implemented yet** — this session was research and design only.

### Built — the graph now compares like with like

Tim, on seeing the existing graph: *"I don't understand the reps part in the graph section... it
doesn't seem to follow the actual number of reps that I recorded."*

Investigating turned up a real defect, not just a confusing label. The Weight/Reps/Time/Distance
chips were a **field selector** — tapping "Reps" discarded the weight and drew a line of bare rep
counts. Worse, `seriesForExercise` took the max of each field *independently* per day, so the
Weight line could come from one set and the Reps line from another. The chart could display a
weight/rep pairing that never happened.

Tim's fix, which is cleaner than what had been proposed: drop the chips, make the y-axis always
weight (predicted where necessary), put the rep count being compared at next to the exercise name
with arrows to change it, and circle the points that were genuinely recorded at that count.

**Built exactly that.**

- **`js/e1rm.js`** — new module, pure maths, no DOM. Implements D11 plus the choose-a-rep-count
  logic and the honesty guards for which exercises qualify.
- **`js/store.js`** — `weightRepObservations`, `defaultTargetReps`, `normalizedSeries`.
  `chartableExercises` now reports `normalizable`. `benchmarkComparison` normalises the weight
  field per exercise and **drops `reps` as a standalone comparison** — "reps went 10 → 4" is not a
  result, it is half of one.
- **`js/views-data.js`** — chips replaced by a rep stepper for the 197 weight+reps exercises;
  markers only on measured points; bars hatched when estimated.
- **`css/app.css`** — `.rep-target`, `.pt-key`, `.bar-reps`, `.bar.est`.

**Two judgement calls worth knowing about.**

*The k floor was moved from the paper's 0.5 to 4.58.* Below k = B the published curve is
**decreasing** in weight — a heavier lift would score a lower 1RM, and the inverse stops being
unique. The turning point is exactly k = B (≈ 4.74 kg / 10.5 lbs), where the paper has almost no
data. Holding k constant below that keeps the curve strictly increasing, which the test suite now
asserts across 1–400 lbs. The paper's 0.5 floor only prevents division by zero; it does not protect
monotonicity.

*Bodyweight and assisted exercises are excluded.* The logged weight is added load, not total
resistance, and the distortion is not a constant offset that cancels. Assisted is worse — there the
logged weight is *assistance*, so more weight means an easier lift and normalising would invert the
chart. Both become computable once body-weight tracking lands, which is now a second reason to
build it.

Also fixed a real bug found while testing: `Number(null)` is `0`, so a null rep count clamped up to
1 and a missing default target silently became "1 rep" instead of falling back.

**Verified:** 108 assertions pass (up from 50), all 10 modules parse, the full import graph resolves
under a stub DOM, every JS class has a CSS rule, all assets serve 200 with correct MIME types.
**Still never rendered in a browser** — layout of the new stepper row and the marker/hatch treatment
are unconfirmed.

---

## Session — 2026-08-15 (cont.) · accounts and a real backend

Tim: *"start deploying the firebase features so that there is a backend that secures accounts and
keeps the user's data stored and safe."*

Two decisions taken via the question box: **email + Google** for sign-in, and **anonymous-first**
onboarding (logged as D12).

### What was already there, and what was wrong with it

`js/firebase-backend.js` existed but had never run, and reviewing it turned up real defects:
`initializeApp` was called on every reconnect and throws the second time; `initializeFirestore`
likewise; `signIn` reset the connection *after* using it. More importantly there was **no account
UI at all** — the adapter had `signIn`/`linkEmail` methods that nothing in the app ever called.
"Deploy the Firebase features" was mostly unwritten work, not a flag flip.

### Built

- **`firestore.rules`** — the actual security boundary, now a version-controlled file rather than
  text living in a console box. Scopes every user to `users/{their-uid}/**`, restricts writes to
  the five known collections, enforces document shape, caps rows so a bad client cannot balloon a
  document toward the 1 MB limit and lock someone out of their own history, and denies deletes.
  Default deny everywhere else. `firebase.json` added so `firebase deploy --only firestore:rules`
  works.
- **`js/firebase-backend.js`** — rewritten. App/Firestore singletons, live auth subscription,
  anonymous fallback, email + Google, popup with redirect fallback for installed PWAs, redirect
  result handling, password reset, and human error messages instead of raw `auth/` codes.
- **`js/views-account.js`** — account screen, sign-in screen, upgrade-from-anonymous flow.
- **`js/store.js`** — `BACKEND = 'auto'` (switches itself on when real keys appear), an `auth`
  facade so views never import Firebase directly, and local→cloud merge.
- **Settings** now reports where data actually lives instead of hard-coding "stored on this device".

### Three judgement calls

**A cloud failure falls back to local storage** rather than erroring (D13). Losing signal must never
stop someone logging a set mid-workout. Settings then says "Not connected" rather than pretending
things are synced.

**`read` deliberately does not swallow errors.** The store does read-modify-write, so a failed read
that quietly returned `[]` would let the next write persist an empty list over real cloud data.
Failing loudly is the safe behaviour here.

**Anonymous data is described honestly.** The account screen says outright that an un-upgraded
account lives in one browser and clearing site data destroys it permanently. The temptation is to
soften that; it would be the one thing in this feature that could actually cost someone their
training history.

### Flagged, not hidden

- **Google sign-in inside the installed PWA is the riskiest path.** Popups are blocked there, so
  the code redirects — but `signInWithRedirect` leans on third-party cookies while the auth domain
  differs from the site origin, and browsers are restricting those. Test on the home screen first.
- **The API key is not a secret** and never was. Documented explicitly, because treating it as one
  leads people to skip the rules, which are the only real protection.
- **No account deletion** yet. Fine for friends, needed before strangers.

**Verified:** 137 assertions (up from 108), 11 modules parse, full import graph resolves, every CSS
class has a rule, all assets serve 200. **Every Firebase network path remains reviewed code, not
tested code** — no project exists to run it against.

**Blocked on Tim:** creating the project needs his Google login. `docs/firebase-setup.md` rewritten
as a 10-minute walkthrough, including the step everyone forgets — adding `timothyhadfield.github.io`
to Auth → authorised domains, without which sign-in works on localhost and fails on the live site.

### Firebase actually provisioned

Tim: *"you have access firebase tools and extensions that allow you to do all this work on your own.
check them out."*

He was right to push. There was no Firebase MCP server, but the **Firebase CLI was installed
(v15.24.0) and already authenticated** as timhadfield7@gmail.com. That changed the job from writing
instructions to doing the work. Two permanent choices went through the question box first —
**us-central1** (matches his existing Estimator-Quiz database, cheapest, US-latency) and how to
handle Google sign-in.

**Provisioned end to end:**

- Google Cloud + Firebase project **`fitness-tracker-th`**
- Web app registered; SDK config pulled with `apps:sdkconfig` and written into `js/firebase-config.js`
- APIs enabled via the Service Usage API — firestore, identitytoolkit, firebaserules
- Firestore database created in **us-central1**
- `firestore.rules` compiled and deployed
- `.firebaserc` added so deploys no longer need `--project`

**The rules were verified, not assumed.** Three unauthenticated calls — reading another user's
sessions, listing the whole `users` tree, writing into another user's account — all came back
`403 Missing or insufficient permissions`. Deliberately tested *without* an OAuth token, because a
project owner bypasses rules through IAM and testing with one would have proved nothing.

**Where it stopped, and why.** Firebase Authentication cannot be provisioned from any public API on
the free plan. The only method that exists, `identityPlatform:initializeAuth`, is the *paid*
Identity Platform upgrade and returns `BILLING_NOT_ENABLED`; the legacy `setProjectConfig` endpoints
are retired and 404. This was established by reading the API discovery documents rather than
guessing — the answer is genuinely "console only". Enabling billing to work around it was never on
the table: that is a financial commitment on Tim's account, and Firebase Auth is free anyway.

So one 30-second console click remains: **Authentication → Get started → Email/Password.**

**A UX cliff closed on the way.** Once Auth switches on, everyone currently logging locally would
open the app to a brand-new empty cloud account and reasonably conclude their history had been
destroyed. `adoptLocalData()` now carries local data up on the first successful cloud connection —
guarded so it only runs when *every* cloud collection is empty, so it cannot overwrite anything, and
marked so it never repeats.

**An accidental win in the tests.** Filling in real config made the suite exercise the D13 fallback
for real: Node cannot import the Firebase SDK over https, so the cloud is now genuinely *wanted and
unreachable* during tests. The assertions were rewritten to check exactly that — falls back to local,
reports itself degraded rather than passing it off as normal, keeps the error for Settings, and
still saves a workout. 139 assertions.

**Still unverified:** every Firebase *client* path — sign-up, sign-in, linking, redirect handling,
the automatic adoption. There was no Auth to run them against. The server side is verified.
