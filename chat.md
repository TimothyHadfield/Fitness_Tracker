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

### Auth switched on — and verified for real

Tim: *"I fixed the email thing."*

Over the Identity Toolkit admin API: **Anonymous enabled**, **Email/Password confirmed enabled**,
and **`timothyhadfield.github.io` appended to authorised domains** (appended, not replaced — wiping
the defaults would have broken localhost and the auth handler).

Then the part that actually matters: **the shipped module was tested against the live project.**
Rather than write a lookalike script, a small Node loader redirected `js/firebase-backend.js`'s
gstatic imports to a locally installed SDK, so the real code ran. 33 checks across two suites, all
passing.

Two results were worth the effort specifically:

- **`setDoc` with `serverTimestamp()` passes the rules.** This was the likeliest subtle failure —
  the timestamp transform resolves server-side after the write is submitted, so a rule asserting
  `updatedAt is timestamp` could plausibly have rejected every write in the app. It doesn't.
- **`signUpEmail` links the anonymous account: same uid, and data logged anonymously survives.**
  That is D12's entire promise, and it now has a test rather than a comment.

Seven rule violations were all refused with `permission-denied`: reading another user, writing to
another user, an unknown collection name, an unexpected field, a non-list `rows`, a 5,001-row
document, and a document delete.

The three test accounts and their two Firestore documents were deleted afterwards — the project
holds zero users and zero documents, so Tim starts clean.

**Left:** Google sign-in needs one console toggle, because enabling it requires an OAuth client ID
and secret the console auto-provisions but the API makes you supply. Email and anonymous work, so
nothing is blocked.

**The remaining risk is now entirely the interface.** The backend is verified; no browser has
rendered a single screen of this app.

### Profile button, and account management

Tim: *"now on the actual cite, make a profile icon in the upper left that the user can click on to
create an account and adjust details. This is how I'll know you're finished with the account setup."*

**The button.** `profileButton()` in `ui.js`, rendered by `screenShell` into the top-left of Home,
Workouts, Calendar and Graphs. It returns immediately with a neutral avatar and fills itself in once
the account state resolves, so no view has to await anything to render, and it re-paints on
`auth.onChange`. Signed in, it fills with the accent colour and shows the email's initial. Not
signed in, it carries a **red dot** — the only badge in the app, reserved for the one state where a
user can actually lose everything.

It shares the top-left slot with the back button and never both: two things competing for that
corner is how people tap the wrong one. `store.js` is imported lazily inside the function so `ui.js`
stays presentation-only and no import cycle is possible.

**"Adjust details"** meant the account screen needed more than create/sign-in/sign-out, so:

- **Change password** — takes the current password, re-authenticates, then updates. Only shown for
  accounts with a `password` provider; a Google account has nothing to adjust here.
- **Delete account** — closes the gap flagged two commits ago. Clears every collection *first*, then
  deletes the auth user; doing it the other way round would orphan the documents behind a uid that
  no longer exists and no rule could ever reach. Requires the password, warns that it is permanent
  and applies to every device, and leaves a working anonymous account behind so the app still runs.

Both are re-authenticating operations that Firebase rejects on a stale session, which is why they
take the current password rather than failing with something cryptic.

**Verified against the live project** — 12 more checks, all passing: a wrong current password is
rejected, the change works, **the old password stops working**, the new one signs into the same
account, data survives, deletion leaves a working anonymous account with a different uid, the
deleted account cannot sign in, and an admin read confirms **no data was left behind**. Test
accounts and documents cleaned up; the project holds zero users and zero documents.

45 checks now cover the Firebase stack. The interface is still the whole remaining risk — no browser
has rendered any of this, including the button itself.

### Profile button moved into the sidebar

Tim: *"the account icon should be in the upper left left, next to the fitness tracker on the side
bar."*

He was on desktop, where `#app` flips to a row and the navbar becomes a 200px left sidebar. The
button had been in the content header — which on mobile *is* the top-left, but on desktop sits to
the right of the sidebar. Not the upper-left he meant.

The sidebar's "Fitness Tracker" title was a `.navbar::before` pseudo-element, and a pseudo-element
cannot contain a real focusable button. So it became a proper `.nav-brand` element holding the
avatar and the name, rendered as the first child of the navbar.

One button on screen at a time: `.nav-brand` is hidden below 860px, and above it
`.topbar .avatar-btn` stands down. Mobile keeps the header button, since a bottom tab bar is the
wrong home for an app title and an account control.

**Fixed a leak the move exposed.** `navbar()` runs on every navigation, so each one built a profile
button that subscribed to `auth.onChange` and never unsubscribed — listeners accumulating for the
session, each pinning a detached node. The subscription now ends when its button leaves the
document, with a `wasMounted` guard so a change arriving between construction and insertion doesn't
cancel it early.

### Graphs stopped mixing benchmarks with workout sets

Tim: *"for the graph about benchmarks, only use data that is from the same source... I recorded 3
bench press benchmarks, but I also recorded a bench press measurement from a workout that was
drastically different than the benchmark trends... Also, what's weird is that it changes between
which measurement it uses depending on what number of sets you use."*

He found two things, and the second was a real bug.

**Mixing sources was wrong on its own.** A benchmark is a deliberate test taken fresh; a set logged
mid-workout comes after everything else the session had already done. Charting them as one line
makes strength look like it lurches. Every graph now shows **one source at a time**, benchmarks by
default, with a toggle that appears only when an exercise actually has both (D9 — no control for a
choice that doesn't exist). Logged as **D14** and design **Rule 4**.

**The flipping was the per-day selection rule.** `normalizedSeries` keeps one point per day, and
prefers a set genuinely performed at the target rep count over an estimate. On a day carrying both a
benchmark and a workout, changing the rep target changed which of the two qualified as "actual" —
so the point jumped between sources. Exactly what he described. The test suite now reproduces it on
mixed data and proves it is gone once filtered:

```
PASS  mixed sources: the point for a day flips with the rep target — the reported bug
PASS  benchmarks only: the source no longer changes with the rep target
```

**A third problem surfaced while testing, which he hadn't seen.** One point per day means that on a
day with both a benchmark and a workout, **one reading was silently discarded** — 2 benchmark days
plus 4 workout days collapsed to 5 points, not 6. Mixing wasn't just noisy, it was dropping data.
Also asserted.

Availability is tracked per source, so the picker never offers a source with nothing behind it, and
an exercise only appears at all if at least one source can draw a line by itself. Rep targets are
now keyed by exercise **and** source, since the two can have different habitual rep counts.

153 assertions.

### Hover crosshair on the line chart

Tim: *"if the user hovers their mouse over the graph, put a vertical line that appears by the nearest
point on the graph and then displays the weight at that point."*

Built. Moving the pointer over the chart snaps to the **nearest point by date**, drops a dashed
vertical line through it, highlights the point, and shows the value with its date underneath.

Three details worth recording:

- **No tooltip box.** The readout is plain SVG text with a ground-coloured halo via
  `paint-order: stroke`, so it stays legible over gridlines and the area fill without a panel. A
  boxed tooltip is the obvious solution and would have broken Rule 2.
- **Estimates stay identifiable.** The hover dot is hollow and dashed for an estimated point, and
  the readout appends `est`. Rule 5 applies on hover exactly as it does on the line — an inference
  must never read as a measurement.
- **Works on touch without breaking scroll.** `pointer*` events cover mouse, pen and touch in one
  path, nothing is prevented, and `touch-action: pan-y` lets a vertical drag scroll the screen while
  a horizontal drag scrubs the chart.

The readout flips its text anchor near the left and right edges so it never clips out of the plot.

### Strength map — planned, not built

Tim asked for a body diagram with each muscle group coloured by strength percentile against people
of the same gender and weight, grey where nothing is recorded, benchmarks only, with per-level weight
targets on click. He asked for a plan first, and for an opinion on his percentile bands and on
whether to include age.

Plan written to `docs/strength-map-plan.md`; the underlying research went into `docs/research.md`
§11. Headlines:

**Two hard blockers.** The app stores neither body weight nor gender, and every strength standard is
a ratio to body weight. Body-weight tracking was already the top Tier 1 gap; it is now a hard
prerequisite for this. So the map is two features away, not one.

**The reference population is the whole feature.** "Stronger than 80 % of people your weight" is
essentially false as usually written. Competition data puts the general population below its 50th
percentile; general-population data would make every user Elite. The honest comparison is *people who
lift and log*, and the UI has to say those words.

**Tim's bands hold up better than expected.** Modelling the distribution as log-normal (σ ≈ 0.32,
anchored to a 225 lb median bench at 180 lb bodyweight) shows his 25/50/70/80/90/95 steps are ~40 lb
apart each — genuinely even in the units that matter. Three objections: nine colours is more than a
sequential ramp can carry when the point is comparing regions at a glance; 99.5 is one in 200 and
costs a colour better spent low down; and above ~97 the data thins out so publishing those thresholds
implies precision that does not exist. Recommended seven levels, and pointed out that colour count is
the wrong lever for his actual goal — a permanent "39 lb to Proficient" readout gives a near goal to
everyone regardless of how wide the band is.

**Age: yes.** Optional birth year, McCulloch-style age grading on by default, with a visible toggle
between "my age group" and "everyone".

**The body has to be hand-authored SVG**, roughly 26 paths — the single largest piece of work in
the feature. It has to be shapes we control, because each muscle needs its own fill and its own tap
target.

**A caveat carried forward:** research §1.3 notes the e1RM formula was optimised for internal
consistency, *not* absolute accuracy. Rep normalisation only needed relative structure so that was
harmless; percentile placement needs absolute accuracy, which is a stronger claim than the formula
has been shown to support. Mitigation is to prefer ≤5-rep benchmarks and mark high-rep-derived
levels as low confidence rather than pretend.

### Decisions on the strength map, plus a rename

Tim answered the three open questions:

- **Rank against people who lift** — with an *optional* second readout showing the equivalent
  percentile among the general population.
- **Five levels**, the industry-standard scheme, **lifter-based only** — the general-population view
  shows a percentile, not a re-tiering.
- The map is a **third mode inside Data**, not a new nav item.

That split is the right one, and the numbers show why. There is no dataset of "what fraction of all
adults can bench 225" — nobody has measured it — but it can be approximated from participation. NHIS
2020 puts **31.9 % of US adults** doing muscle-strengthening activity 2+ days a week, so treating
non-trainers as sitting below trainers gives `general ≈ 0.681 + 0.319 × lifter`. Run the five levels
through that and the entire scale compresses into **70–98 % of the general population**. As a ranking
it would carry almost no information; as one contextual line it is genuinely nice to see. Exactly the
call Tim made.

Two caveats recorded for the UI: it assumes every non-trainer is weaker than every trainer, which is
false at the margins, so it overstates slightly and should be shown rounded — "roughly the top 16 % of
adults", never a decimal. And 31.9 % counts *any* muscle-strengthening activity, so the pool with a
trackable barbell lift is smaller still.

**Five levels has a consequence worth naming:** the gaps are wide (+70 lb Intermediate→Advanced,
+86 lb Advanced→Elite). Someone could train a year without the colour moving — the exact failure Tim
was trying to avoid by asking for more bands. So the within-level progress readout
(`55 lb to Advanced`) is now a hard requirement of the design, not a nice-to-have. That is what
supplies the near goal; the colour supplies the standing.

### Renames

Tim, mid-turn: *"Rename the graphs section to Data, the Over Time to Graph, Start vs Now to Bar
Chart, and then the new section with body to Muscle Groups."*

Applied. The nav item is **Data**, its modes are **Graph** and **Bar Chart**, and the planned third
mode is **Muscle Groups**. The route stays `#/graphs` internally — renaming the hash would churn the
router for nothing a user can see.

Watch: the segmented control lives in the header where a title would go. Three options is tighter
than two, and "Muscle Groups" is the longest label — it may need to shorten to "Muscles" or become
icons.

### Seven levels, and the profile that unblocks the map

Tim: *"add a level between the big gaps in categories"* and *"when setting up your profile, it should
now ask your gender, age, and weight."*

**Seven levels.** The five industry anchors (5/20/50/80/95) stay exactly where Strength Level and
Gravitus put them — so our tier names still agree with the two biggest strength calculators — and one
level is inserted into each of the two widest gaps: **Proficient** at 65 and **Expert** at 90.

| | worst step | spread |
|---|---|---|
| 5 levels | +86 lb | 47 lb |
| 7 levels | **+53 lb** | **24 lb** |

The spread halves. Seven fills plus grey is the ceiling for a sequential ramp, so the `dataviz`
validator has to confirm all seven stay separable under deuteranopia before the palette is fixed; if
any pair fails, the inserted levels are the ones to drop, not the anchors.

**Profile built** — `js/views-profile.js`, reached from Settings. Gender, birth year, body weight,
each with a one-line explanation of why it is being asked for (D8: no unexplained demands for
personal data in a fitness app).

Three decisions worth recording:

- **Birth year is stored, never age.** A stored age silently goes stale and quietly moves someone
  into the wrong comparison band. Asserted in the tests.
- **Body weight is a dated series, not a profile field.** It is needed as one current number for the
  standards, but storing only that would throw away the Tier 1 trend line and force a migration
  later. One row per weigh-in costs nothing now. A second weigh-in on the same day replaces the
  first rather than making the trend jagged.
- **The profile says what is missing**, and so does the Settings row — *"Add your gender and body
  weight to rank your muscle groups"*. A silently empty profile is exactly why the map would later
  look broken.

**A trap caught on the way.** Adding a sixth collection meant `firestore.rules` would have denied
every cloud write to it while localStorage worked fine — a bug that hides completely until someone
signs in. Rules updated, redeployed, and verified live: `bodyWeight` writes accepted, unknown
collections still refused. `COLLECTIONS` in `store.js` now carries a warning comment.

172 assertions, up from 153.

### Muscle Groups built

Tim confirmed deadlift → glutes and said to just go with recommendations. Built the whole map.

**Three new modules**, all pure logic except the view:

- `js/strength-standards.js` — levels, muscle→key-lift mapping, allometric body-weight scaling,
  McCulloch/Foster age grading, percentile lookup, per-level weight targets. No DOM, no store.
- `js/body-map.js` — hand-authored SVG body, front and back, ~30 regions. Deliberately stylised:
  regions have to be big enough to tap on a phone, and an anatomically faithful drawing would have
  slivers nobody can hit.
- `js/views-muscles.js` — the third Data mode.

**The palette was computed, not chosen.** Strength level is *ordinal* — swapping the levels changes
the meaning — so it takes a one-hue sequential ramp, not the reference image's categorical rainbow
(that rainbow encodes muscle *identity*, which position already gives us). Seven steps generated in
OKLCH at the app's accent hue and run through the dataviz validator in `--ordinal` mode. It failed
twice before passing: the light ramp's pale end sat at 1.23:1 against a near-white surface, and after
darkening it the adjacent ΔL came out at 0.059 against a 0.06 floor because high chroma was clipping
in gamut. Third attempt passes all four checks in both themes. Dark is a *selected* ramp with the
anchor flipped, not an inversion.

**Two real bugs caught by writing the tests:**

1. `Number(null)` is `0`, which is finite — so a user with no birth year was being graded as a
   **14-year-old** and shown inflated levels everywhere. Same trap as `clampReps` earlier; now
   type-guarded in both places.
2. The `--lv-*` custom properties were declared with bare `:root` holding the *light* ramp, inverting
   this stylesheet's convention (bare `:root` is dark). It worked only because `data-theme` is always
   set explicitly — the moment that stopped, dark mode would have rendered the light ramp.

**Honesty carried into the UI**, per D15: every caption says "of people who lift", the
general-population line is labelled a rough estimate, and a level derived from a set of more than 5
reps is flagged — percentile placement leans on the e1RM formula being *absolutely* accurate, which
`docs/research.md` §1.3 says was never validated.

236 assertions, up from 172, including every key lift resolving to a real exercise, every drawn
muscle being rankable or explicitly declared unrankable, and all seven tier weights round-tripping.

### The Muscles tab was already built — but unreachable

Tim: *"I think we're ready to add the entire muscle group tab."* It had shipped the turn before, so
either he had not seen it or it was not showing. It was not showing, and the reason was a real bug.

`GraphView` bailed out to a bare "Not enough data yet" empty state when there was nothing to chart —
**and that early return took the mode switch with it**, so Muscles was unreachable exactly when it
is most useful: it works off a single benchmark and explains what to record next. Anyone signed into
a fresh cloud account hit this. Each mode now renders its own empty state inside the normal shell,
and the two chart modes gained the guards the early return had been providing.

### Rendered for the first time

Nothing in this app had ever been rendered by anything. `tests/render.test.mjs` now mounts every
screen in jsdom and asserts real DOM structure — 29 assertions. jsdom is a **test-only** dependency;
the app still ships zero dependencies and no build step, and `data-layer.test.mjs` stays
dependency-free.

It found two bugs on the first run:

1. **The unreachable Muscles tab**, confirmed and now covered by a regression test that renders an
   empty account and asserts all three tabs are present.
2. **A boundary bug worth the whole exercise.** A 225 lb bench at 180 lb bodyweight is *exactly* the
   50th percentile, but the screen showed **Novice**. The normal CDF is a rational approximation, so
   it returned 49.999999947 and a strict `>=` dropped the user a whole level. Measuring the
   round-trip error at every threshold showed up to 6.6e-6 percentage points — the
   Abramowitz–Stegun CDF's known ~7.5e-8 probability error, expressed in percent. The epsilon is now
   sized from that measurement rather than guessed, and every threshold is asserted to grant its own
   level.

Also made the targets panel **ceil** rather than round: if it says 295 lb, lifting 295 has to
actually grant the level. Rounding 295.4 down would have displayed a target that does not clear its
own threshold — the same class of bug, one layer up.

245 data-layer assertions plus 29 render assertions.

---

## Session close — 2026-08-15

Prepared for a chat reset. `progress.md` was rewritten from scratch rather than patched again: it had
been edited incrementally about a dozen times across this session and had drifted badly.

**Errors found and fixed in the handoff docs:**

- **D11 recorded the wrong formula.** It said `k(w) = max(0.5, …)` — the *paper's* floor. Ours is
  `max(4.58, …)`, and the difference is not cosmetic: below k = B the published curve *decreases* in
  weight, so a heavier lift scores lower and the inverse stops being unique. A fresh session reading
  the old line would have reimplemented a broken formula.
- `firebase-config.js` was still described as an **empty placeholder and "the only blocker"** — it
  has real keys and the project is live.
- `firebase-backend.js` was still marked **UNTESTED** — it has 45 passing checks against the live
  project.
- Module count said 11; there are **15**. Architecture tree was missing `views-profile.js`,
  `views-muscles.js`, `.firebaserc`, and three of the five docs.
- Data model was missing `BodyWeight`, `gender` and `birthYear`.
- Next steps had a **duplicated item**, two items numbered 4, and claimed the Muscles map was
  unbuilt.
- `spec.md` listed `BodyWeightEntry` as a gap; it shipped today.
- Decision table had D11 wedged between D5 and D6, and D15 before D14.

**Added to the handoff:** D16 (deadlift → Glutes), the Firebase-CLI-is-authenticated note in §0 so a
fresh session doesn't assume console-only, the `COLLECTIONS`/`firestore.rules` trap, the ordinal
strength ramp under the colour rule, and the nuance that jsdom rendering is *not* browser
verification.

Also softened the "recommend and proceed" line: Tim said to just go with recommendations, but the
record shows he found the source-mixing bug and correctly diagnosed the level-flipping bug, so the
agreement now says take it as licence to decide, not licence to stop listening.

---

## Body-weight trend chart — 2026-08-15

Tim: *"catch up with progress.md"*. Items 1 and 2 in Next steps are his to do (open it on a phone,
flip the Google sign-in toggle), so the first thing actually buildable was item 3.

**It is not a fourth tab.** The mode switch is already three wide on a phone, and body weight asks
exactly the same question as every other trend — a number over time. So it rides in the *same*
picker as the exercises, in a **You** optgroup after them, reusing the measured line chart, the
summary stats and the hover crosshair whole. It only appears at two weigh-ins, the same bar every
exercise has to clear, and it sits **last** so the default chart on the Data screen is still a lift.

**Direction is deliberately not judged.** `summaryStats()` coloured any increase green and any
decrease red, which is right for weight lifted and wrong for weight carried — gaining is the goal for
one person and losing it for the next, and nothing has ever asked which. It now takes a `judged`
flag, body weight passes `false`, and this went into `progress.md` as **Rule 6 — no unearned
opinions**. It is the same instinct as Rule 5: don't let the app assert more than it knows.

Small pieces: `bodyWeightSeries()` in `store.js` so the view never touches the storage shape; an
`aria-label` override on the chart so a screen reader hears "Body weight over time" and not "Weight";
`.text-link` plus a "see the chart" link on the Profile screen, shown at exactly the moment the
second weigh-in makes the chart exist (D8 — teach at the point of use).

**The render test now actually draws the chart.** jsdom does no layout, so everything measures 0 and
`fillChart` — which correctly refuses to draw into a container it cannot measure — had been skipping
the entire SVG builder every run. Stubbing `clientWidth`/`clientHeight` means `lineChart()` executes
for the first time anywhere: gridlines, one marker per measured point, the label. That is a *size*,
not a layout, and it still proves nothing about how any of it looks.

250 data-layer assertions, 42 render assertions, both green. Tier 1 now has one item left: a rest
timer.

---

## Anatomical body map + a bright level ramp — 2026-08-15

Tim, on the Muscle Groups map: *"Everything right now is funky disconnected ovals and rectangles that
don't resemble muscles in any way… the human looks exactly like a human, and all the muscles look
exactly what they look like in real life. That is what I want."* Plus: *"the coloring is just
different shades of orange and yellow… I want a wide range of different colors that are bright."*

He was right about the shapes — the old map was literally `<ellipse>` and `<rect>`.

The figure was drawn from scratch to show the things that actually make a muscle chart read as
one: the pec fan, the deltoid cap, the lat V, the three heads of the quadriceps, the two heads of the
gastrocnemius.

**The thing that unlocked it: Chrome is installed on this machine.** Every previous session drew
blind. Rendering the SVG headless and *looking at it* turned this from guesswork into eleven
iterations, each one fixing something visible — a gingerbread-man silhouette, arms fused to the ribs,
limbs too thin to hold a muscle, muscles overhanging the leg they were meant to be inside.

**Two structural decisions came out of that loop:**

1. **Everything is drawn as the left half and mirrored by transform.** Symmetry is exact and free,
   and there is half as much geometry to get wrong. The silhouette is one half-contour: closed it
   fills the body, drawn open it is the outline with no seam down the middle — so the fill and the
   outline can never disagree.
2. **Muscles are cross-section tables, not path data.** `[y, xLeft, xRight]` rows, turned into a
   smooth closed curve by `belly()`. This was forced by measuring the render: hand-written bezier
   handles were pinching muscles to *half* the width they were meant to be, and it was invisible
   until the shapes were sampled numerically. A cross-section says exactly how wide a muscle is at a
   given height and can be checked against the silhouette it has to fit inside.

**Colour.** The old ramp was one hue, per the standing rule that an ordinal scale isn't a rainbow.
Tim wants range, and there is a way to have both: a multi-hue ramp with strictly monotone lightness —
blue → violet → magenta → red → orange → gold → green — which is exactly how viridis and plasma are
built. Generated in OKLCH at the gamut edge and validated. It fails the validator's *single hue*
check by design, so it was also stress-tested against the categorical all-pairs checks the old ramp
was never held to, and it wins on normal vision (worst ΔE 13.8 vs 8.0) while matching under colour
blindness.

One trap recorded in `progress.md` §5: that validator's single-hue check wraps its hue arithmetic, so
a ramp crossing 0° can report a 40° spread and PASS while actually sweeping 250°. That PASS means
nothing.

**A false alarm worth remembering.** The first real-app screenshot looked like the back figure and
the legend were cut off — textbook horizontal overflow. It wasn't: `--window-size` doesn't change the
layout viewport in this headless build, so it was cropping a 512px layout. Measuring said
`VW=512 SW=512`, no overflow anywhere. The fix for actually testing phone widths is an `<iframe>` of
fixed width; at a true 360 and 390 everything fits and the legend wraps.

Home, Workouts, Calendar, Settings and Muscles now all screenshotted in both themes. 250 data-layer
assertions, 44 render assertions, green.

---

## Muscle detail moves beside the figures — 2026-08-15

Tim: *"When you click on a muscle group, a new section with that muscle group appears below the
screen, and everything shrinks. Instead of anything shrinking, on a laptop, I want the muscle group
details to appear on the right or left side of the screen, in the open space to the side of the
human body."*

Right, and it's a Rule 3 violation of the kind the rule was written for — the figure is the content,
and it was getting smaller the moment you asked it a question. Fixed by making the Muscles pane a
row on wide screens: figures take the flexible space, the panel is a fixed-width column on the
right with a hairline rule down its left edge (no card, Rule 2). Because the column's width doesn't
depend on its contents, the body is now *pixel-identical* selected and unselected — confirmed by
screenshotting both.

The whole foot moves, legend included, not just the detail. That frees the vertical space the legend
was taking and is why the figures are noticeably bigger on a laptop now.

**Breakpoint.** First attempt gave it its own 1040px query on the assumption that a narrow desktop
couldn't spare 320px. Measuring said otherwise: at 960px the side layout yields a *larger* figure
than stacking (395×433 vs 338×370), because a column costs width once while a stacked panel costs
nearly half the height. They're about even at 860. So it shares the existing 860px desktop
breakpoint — one fewer concept — with `clamp(260px, 32%, 340px)` keeping it honest at the narrow end.

A `is-muscles` class on `.graph-host` carries which mode is on screen; CSS decides where it applies.
There's a test that it's set in Muscles mode and dropped on the way out, since a stale class would
lay the line chart out as a row. The first version of that test was in the wrong place — it asserted
the class was dropped after clicking Graph at a point in the fixture where Graph is still disabled,
so the click did nothing. Moved to where Graph actually has data.

Also checked Graph mode is untouched, and phone still stacks. 250 data-layer, 46 render, green.

---

## Session close — 2026-08-16

Three pieces shipped this session: the body-weight trend chart, the anatomical redraw of the body map
with a bright multi-hue level ramp, and moving the muscle detail into a side column on desktop. All
three are committed, pushed and documented above.

The one thing left open is the **look** of the Muscles figure. It is anatomically correct and it is a
real human now, but it still reads as a clinical diagram rather than the bold training-poster
illustration Tim is after. His brief, in his order of importance:

1. **Heavy black keylines** around every muscle group. This is the biggest single difference — it is
   what makes a figure read as graphic rather than medical.
2. **Dense fibre striations** inside each muscle, following the fibre direction.
3. **Head, hands, feet and knees left white and unpainted**, so the colour stops at the joints and
   the coloured masses pop against them.
4. **More heroic proportions** — wider shoulders, narrower waist, bigger arms.

He has now said twice, in different words, that **the shading and small texture details matter more
to him than getting the outline exactly right**. Worth taking literally: on this screen, texture is
the feature.

None of that is hard to execute. `belly()` takes cross-sections, so proportions are cheap to move;
keylines are a stroke change and striations are more `FIBRES` entries. What it needs is passes with
eyes on the result — use the screenshot loop in `progress.md` §0.6, because this is pure visual work
and there is no other way to check it.

State at close: 250 data-layer assertions, 46 render assertions, both green. Working tree clean.

---

## 2026-08-16 — Tim's own illustration replaces the hand-drawn figure

Tim opened with "catch up with progress.md", then supplied `Human_Muscle_Groups.jpg` and a brief that
was tighter than the previous one:

> "I created an image that I want to use for the human muscle groups section. The thing is, I want to
> follow it **exactly**, not just make a similar version of it. You'll have to know that you still
> need to separate each muscle group and be able to recolor them to any of the available colors
> independently of each other. Additionally I need you to keep the texture, details, and shading of
> every part of the body no matter the color or adjustment, as they are extremely important."

That is three constraints that pull against each other: exact fidelity, independent recolour, and
texture that survives any colour. Tracing the picture into flat vector shapes satisfies the first two
and destroys the third — a traced fill is a flat sticker.

### The approach: separate the ink from the colour

The drawing is flat colour with black keylines, fibre striations and shadows laid **over** it. So it
splits into two layers that recombine to the original:

- **Fill** — one traced vector path per muscle group per view. Colour and hit-testing only.
- **Ink** — one greyscale image per view, used as an SVG **luminance mask** over a rect of ink
  colour. Every keyline, every striation, all the shading.

Recolouring changes a fill. It *cannot* touch the texture, because the texture is not in the fill —
it is in the mask sitting on top of it. And head, hands, feet and knees simply have no fill under
them, so they stay unpainted, which was gap 3 of the old brief, solved by construction rather than by
remembering to leave them alone.

`tools/build-body-art.py` does the separation and is checked in, so the art is reproducible.

### Four things that had to be got right, none of them obvious

**Segmenting by colour doesn't work.** Pecs, deltoids and abs share one orange, and the back's traps
and lats share another, so hue clustering merged them into single blobs. The artwork separates them
with heavy black keylines — but cutting on absolute darkness fails too, because the violet muscles
are darker overall than an orange muscle's *striations*. What works is darkness **relative to the
local colour**: a keyline is dark compared to its own muscle. That cut the back's largest merged
component from 35,577 px to 15,290.

**Per-channel multiply breaks on recolour.** The obvious ink encoding is `original / base` per
channel, which reproduces the source exactly. It also renders **green striations over a blue muscle**
— where a base colour has a near-zero channel, the ratio in that channel is noise. The fix is a
*scalar*: how much the artwork darkens its own base. Applied to any fill it gives a darker version of
**that** fill. It gives up some chroma against the source (p50 error 11.5/255) and that is the right
trade, because the recolour is the feature and the exact reproduction is not.

**A fill may only grow under ink darker than itself.** Fills are grown a few px under the keylines so
no white hairline shows. Ink can darken but never lighten, so a grown pixel *brighter* than its base
clips to zero ink and renders as raw fill — which bridged the white channel between two ab blocks
with a bar of colour. Handing those pixels back fixed it.

**Every painted pixel must be owned by some muscle.** A leftover keeps its *original* colour through
the ink layer, so a recoloured figure sprouted stray orange and green fringes.

### Muscles the app has no group for

The drawing separates sternocleidomastoid, teres, infraspinatus, erectors, sartorius, adductors and
tibialis anterior. The app has 13 groups and none of those. Each joins the group it trains with, and
every choice is written down in the tool's `SEEDS` table rather than left implicit.

One real loss, stated plainly: the quadriceps is drawn as four heads in four hues. The app gives the
whole group one strength colour, so the hue difference between heads goes. Shading *inside* each head
survives. In the source that difference is decoration; in the app hue means strength level, and it
cannot mean both.

### Verified

275 data-layer assertions and 49 render assertions, both green. Screenshotted at 360/390/1180 in dark
and light, selected and unselected. Unranked muscles needed their own `--body-none`: `--lv-none` is
tuned to sit on the dark *page*, and on light *paper* it painted them near-black so they read as
holes punched in the body.

Also spotted while screenshotting, and confirmed pre-existing at `868fdb0` by shooting HEAD side by
side: the Data mode switch wraps "Bar Chart" onto two lines at every width. Left alone — unrelated.

### The one open thing, and it stopped the push

`docs/strength-map-plan.md` §7 already said — from an earlier session — that the reference image for
this feature was a watermarked Dreamstime stock illustration, **ID 142535635, © Vectorville**, and
ruled it out as copyright infringement. The file Tim supplied is the same composition, without the
watermark, with a blue bar across the bottom.

He said he created it, and that is specific enough a prior finding — about this exact picture — that
it went to him rather than getting quietly overridden. The source JPG is git-ignored, but
`img/ink-*.webp` and `js/body-art.js` are derived from it and are served from a public repo and a
live site, so it was worth the one question.

**Asked and answered: Tim confirmed the image is his own work.** Pushed. The resolution is recorded
in `docs/strength-map-plan.md` §7.0 so the old note in this file's history doesn't get re-raised
every session.

State at close: 275 data-layer assertions, 49 render assertions, both green. Working tree clean.

---

## 2026-08-16 (cont.) — the white box on selection

Tim: *"that is so good. The only improvement is to remove the white box that shows up when you select
a muscle group -- the outline of the exact muscle is fine."*

It was **Chrome's focus ring**. Chrome paints `outline: auto` around an SVG element's *bounding box*,
so focusing the Chest path drew a white rectangle spanning both pecs, sitting behind the accent
outline that was supposed to be the only selection cue.

Two things made it survive the earlier screenshot review:

1. The CSS only killed the ring on `:focus-visible`. Chrome painted it on plain `:focus` — measured:
   `focusVisible: false` and `outline: rgb(16,16,16) auto 5px` at the same moment.
2. **The screenshot harness dispatched a synthetic `MouseEvent`, which does not move focus.** So the
   ring never appeared in any screenshot taken, and the review passed on a figure that could not
   exhibit the bug.

Fixing (2) properly was the real work: a CDP driver that sends `Input.dispatchMouseEvent`, so the
click is a real one. Node 24 has a global `WebSocket`, so it needed no dependencies. Two useful
findings recorded in `progress.md` §0.6:

- **`Emulation.setDeviceMetricsOverride` DOES change the layout viewport**, unlike `--window-size`.
  The `<iframe>` wrapper trick that cost half an hour last session is no longer necessary.
- A muscle's **bounding-box centre can miss the muscle** — Chest's lands in the sternum gap between
  the pecs, so the first "click" hit the paper and selected nothing. Hit-test with
  `document.elementFromPoint` instead.

The fix removes the ring on `:focus` as well as `:focus-visible`, and replaces it rather than just
deleting it: keyboard focus now draws a dashed outline on the muscle's **own shape**, via the same
above-the-ink path trick the selection ring uses. Verified by sending real Tab keys — focus lands on
Biceps with `:focus-visible` true, a 2457-character ring path, and `outlineStyle: none`.

Deleting an accessible focus indicator to satisfy a visual note would have been the easy read of the
request; Tim asked for the box gone, not for keyboard users to lose their place.

State at close: 275 data-layer assertions, 49 render assertions, both green. Pushed.

---

## 2026-08-16 (cont.) — offline, and the session's date

Tim asked for my read on the biggest remaining improvements, then: *"Yes I think all of those
improvements are great. Start with the ones you need the most and move from there."* Plus one
specific ask — a workout should record for **today** by default, with the date editable for the
session you forgot to log.

### Offline was a claim, not a feature

D6 says offline-first logging is non-negotiable, "gyms are basements". There was **no service worker
at all**. `store.js` falls back to localStorage when the *cloud* is unreachable, but with no signal
the app never BOOTED, so that fallback never got to run. A basement got a blank page.

`sw.js` precaches the whole shell. Deliberately **stale-while-revalidate, not cache-first**: with no
build step, cache-first plus a hand-bumped VERSION has a nasty failure mode — edit `app.css`, forget
the bump, and every install is frozen on the old file forever with no way to tell. SWR's worst case
is one stale load and it self-heals. Cross-origin is left alone entirely, because Firestore streams
over long-polling and the SDK comes from gstatic.

A hand-written precache list rots, so `tests/data-layer.test.mjs` now walks `js/ css/ img/` and fails
if anything shipped is not listed. A file added and forgotten would otherwise be invisible until
someone opened the app in a basement — the exact case the file exists for, and the exact case nobody
tests.

**Two things went wrong while verifying, both worth keeping:**

1. **`Network.emulateNetworkConditions` is per-target, and a service worker is its own target.** Its
   fetches sail straight past the page's emulated offline state. My first offline test *passed* while
   the app was quietly still loading over the network. The canary caught it — request a URL that
   cannot be cached, assert it fails. Without that the test proved nothing. The real test kills the
   origin server.
2. **`caches.open()` failed with "Unexpected internal error"** for half an hour of debugging. Not the
   app: Chrome's `--user-data-dir` was the ~180-character session scratchpad, and Chrome appends
   hashed CacheStorage directories under it until it blows past Windows MAX_PATH. A short profile
   path fixes it. It presents *exactly* as a broken service worker.

Verified with the server killed: the app boots, renders, saves a workout, and the Muscles map draws
all 18 regions from the cached 100 KB image.

### The session's date

Defaults to today, editable in the header, future dates refused. It sits in the header rather than
behind the Finish button so a workout being logged for another day says so the whole way through
instead of springing it at the end — quiet when it is today, accent plus "NOT TODAY" when it is not.

The trap was the draft. Draft expiry compared `draft.date` to today, so moving the date back would
have made the session throw its own draft away the moment you switched apps. Split into two fields:
`date` is the day it is recorded FOR and is editable; `startedOn` is the day it was created and is
what decides whether a draft is still today's. Old drafts without `startedOn` fall back to `date`.

Tested end to end — back-date a session, leave, resume, finish, and it is filed under the chosen day
while `startedAt` still honestly records when it was actually typed in.

279 data-layer + 65 render assertions, green.

---

## 2026-08-16 (cont.) — Tier 1 finished: muscles from workouts, kg, rest timer

Working down the list Tim approved, in order of need.

### The muscle map reads workouts now, not just benchmarks

Ranking on benchmarks alone left the best screen in the app permanently grey for anyone who just logs
their workouts — which is most people, and the whole point of the app. It now takes the best e1RM
from either source.

**This is not a breach of D14.** That rule is about charting a *trend*: two sources on one line make
strength look like it swings wildly, and keeping one point per day silently threw the loser away.
Neither problem exists for a single best estimate, which is all this screen asks for. A mid-workout
set comes after everything else that session did, so it *understates* — it will rarely beat a fresh
benchmark, and when it does, that is real evidence the lifter has moved on since they last tested.
Taking the max is the conservative reading.

What must not happen is the source going unsaid (Rule 5 — an inference must not look like a
measurement), so the panel says "logged in a workout" or "benchmarked". Verified: six groups light up
from workout sessions with no benchmarks recorded at all.

### Pounds and kilograms

**Everything is stored in pounds, always.** Switching units is a display choice and must never rewrite
a recorded number — the round trip is asserted lossless to 1e-9. Conversion happens at exactly two
edges: what is shown, and what is typed. e1rm.js and strength-standards.js stay pounds throughout.

The delicate part is the stepper, which now works entirely in display units so a nudge is a clean
2.5 kg rather than whatever 5 lb converts to, and converts back on the way out. Getting that backwards
would quietly store kilogram numbers as pounds and corrupt every weight recorded after the switch, so
it has its own test: type 60 kg, assert 132.277 lb lands in the draft.

### Rest timer — the last Tier 1 item

Counts **up** from the last set rather than down from a target, because the count-up is true without
being configured. A target (60/90/120/180s) is optional on top, and only with one does the bar get to
say the rest is over — no unearned opinion.

Elapsed time is read from a **timestamp** every tick, never accumulated. Mobile throttles timers in a
backgrounded tab, so a counter adding a second per tick would silently run slow — which is exactly
what a rest timer is for, and exactly when the app is not in front of you.

One bug caught by its own test: resuming a draft called `startRest()`, which *reset* the clock.
Walking back into a workout wiped the rest you had already taken. Split into `startRest` and
`ensureTicking`.

### And a pre-existing bug found by looking at the screen

The literal word **"null"** was rendering under the exercise name for any exercise without a note.
`Element.replaceChildren()` stringifies anything that is not a Node, so a `cond ? el(...) : null`
child prints "null" on the page. `el()` has always guarded against that; the 28 direct
`replaceChildren` calls did not. Added `setChildren()` with the same guard and routed them all
through it. Confirmed pre-existing at HEAD — it had been shipping.

Worth noting how it was found: not by a test, and not by reading the code. By taking a screenshot of
the finished screen and looking at it. The test that now pins it was written afterwards.

302 data-layer + 89 render assertions, green. Tier 1 is complete.

---

## 2026-08-16 (cont.) — benchmark workouts, and editing a recorded workout

Tim: mark certain workouts as benchmarks so every exercise recorded in them counts as one; and let a
past workout be edited from the calendar, including its date.

### Benchmark workouts

A workout carries `isBenchmark`. The flag is copied onto the **session** when it starts, not read back
from the template later — re-flagging a workout months from now must not retroactively turn old
sessions into benchmarks.

The design decision worth writing down (now D17): **the benchmarks are derived from the session and
rebuilt on every save**, each tagged `sourceSessionId`. Writing them once at finish is the obvious
implementation and it strands them the moment anything is edited — move the workout to another day
and its benchmarks stay on the old one, delete an exercise and its benchmark lives on, untick the
flag and nothing undoes it. Rebuilding makes all four correct by construction. Hand-entered
benchmarks have no `sourceSessionId` and are never touched by any of it.

**Which set counts** needed a judgement call. A benchmark is one performance, so several sets have to
reduce to one, and it uses the same measure the app already ranks with — estimated 1RM — so the
benchmark agrees with the muscle map instead of being a second opinion. That means 185×8 beats 225×2,
which is right and is not what "best" looks like at a glance.

The honest limitation is time: longer is better for a plank, *faster* is better for a mile. A
distance-and-time exercise takes the furthest set and breaks ties on the fastest time, which gets a
fixed-distance run right. A time-only exercise assumes longer is better — right for a hold, wrong for
a sprint. Documented in the code and left for manual entry.

The day view shows a BENCHMARK badge on the workout card and does **not** list the derived benchmarks
again underneath — the sets are already there, and listing them twice made the day read as twice the
work.

### Editing a recorded workout

Calendar → day → pencil. Date, name, exercises, every set, add/remove sets, add/remove exercises, and
the benchmark flag. Nothing is written until Save.

Deliberately a plain form, **not** the session runner. The runner is built around a live workout: it
prefills from history, keeps a draft against an app switch, and expires that draft at midnight. None
of that is wanted when correcting last Tuesday, and bending it to do both would have put the draft
machinery one bug away from overwriting real history.

Two guards that came from thinking about how it would be misused: an "Add a set" someone thought
better of would otherwise save as a row of zeros, and emptying every set would otherwise save an
empty record. Both are refused, and the test asserts the real record survives the attempt.

One layout bug caught by screenshotting rather than testing: the set number and delete button beside
the steppers ate enough width that the steppers' `auto-fit, minmax(148px, 1fr)` grid collapsed to one
column and every set became most of a screen tall. Moved them to their own row above.

322 data-layer + 100 render assertions, green.

---

## 2026-08-16 (cont.) — the offline account screen

Tim reported being logged out after time away, with the account screen showing "Your account could not
be reached" plus `Failed to fetch dynamically imported module: https://www.gstatic.com/...`, and a
Try again that did nothing. Then: *"scratch that, I just wasn't connected to the internet."*

He was right, and the behaviour was correct — the local fallback (D13) doing exactly its job. But the
report is still evidence of a real defect: **the app's own author read its message and concluded it
was broken.** Three separate failures in one screen:

1. It printed a raw module-import URL as the message. A developer string, shown to a user.
2. It blamed the *account* for what was a *connection* problem.
3. It looked like being signed out, when nothing had signed him out — the app simply could not ask.

Fixed all three. The screen now names the cause, says "You're still signed in as <email>", keeps the
raw string behind a collapsed disclosure, retries in place instead of reloading, and reconnects by
itself on the browser's `online` event.

**The interesting part was detecting "offline" honestly.** The first attempt used `navigator.onLine`,
and the browser test immediately caught the flaw: it reported *online* with the server killed and the
network emulated off. That is not just a harness artifact — `onLine === true` merely means an
interface exists, so a captive portal or a dead upstream reports online while nothing loads, and
those are precisely the cases that send someone hunting for a bug. So there is now a real probe: a
cache-busted same-origin request the service worker cannot answer from cache, which means a success
really did come from the network. `onLine === false` is still trusted immediately (it is reliable in
that direction); the probe only refines the `true` case.

Verified the whole thing the §0.7 way — origin server killed, network emulated off — against a scratch
config shaped like a real Firebase config but pointing at a project that does not exist, so the live
`fitness-tracker-th` project could not be touched.

Two smaller things the screenshot caught that no test would have: a CSS-escaped `\25B8` disclosure
marker rendered as a missing-glyph box on Windows (now the browser's native triangle), and the
technical disclosure was conditioned on the offline flag when it should always be present and always
collapsed — the problem was never that the string existed, it was that it was the headline.

322 data-layer + 109 render assertions, green.

---

## 2026-08-16 (cont.) — "Your browser blocked the sign-in window"

Tim: *"sometimes when I sign in using google, it says Your browser blocked the sign-in window"*.

**The popup blocker was not the problem.** Traced the only route by which that message can reach the
UI at all — every genuine popup failure was already caught and retried as a redirect, so a real
blocked popup would never have shown it:

1. Anonymous user taps Continue with Google.
2. `linkWithPopup` throws `auth/credential-already-in-use`, because that Google account **already has
   its own account** from a previous sign-in.
3. That is not a popup failure, so the redirect fallback is skipped.
4. The `isAlreadyLinked` recovery called `signInWithPopup` — a **second popup**. The user gesture that
   authorised the first one is spent by then, so the browser refuses it.
5. That throw happens *inside* the catch block, so nothing handles it, and it surfaces as
   "your browser blocked the sign-in window" for an account that had simply been registered already.

"Sometimes" is the tell: it only happens with a Google account you have signed in with before.

The fix is the documented Firebase recovery — `GoogleAuthProvider.credentialFromError(err)` hands back
the credential from the *failed* link, and `signInWithCredential` uses it with no window at all.
Checked both exist in the pinned 10.12.2 SDK by grepping the actual file rather than trusting memory.

**Second bug found on the way:** `auth/popup-closed-by-user` was in the popup-failure list, so
deliberately closing the window bounced the user to Google's full-page redirect — the opposite of
what they had just asked for. Now `cancelled`, and nothing happens.

To make this testable at all, the flow was extracted into `googleSignInFlow({ auth, ... })` with the
SDK surface passed in, plus a pure `planAfterGoogleFailure()`. The flow now runs against a recording
stub, so "only ONE popup is ever opened" is asserted rather than hoped for.

And the test was checked for vacuity: the previous logic, run against the same stub, produces
`linkWithPopup → signInWithPopup` — two popups — and fails the new assertion. A test that cannot fail
on the bug it was written for is worth nothing.

Also corrected a stale doc claim: progress.md said Google sign-in was not enabled in the console.
Tim is plainly using it, so it has been enabled at some point.

348 data-layer + 109 render assertions, green. The **redirect** path and the installed PWA remain
unverified — I can drive a popup failure, not a real Google account.

---

## 2026-08-16 (cont.) — I broke Google sign-in, then fixed it

Tim: *"okay so what's the problem and why can't I sign in through google now?"*

**My regression, shipped an hour earlier.** In fixing the second-popup bug I moved
`auth/popup-closed-by-user` out of the popup-failure list and made it a no-op, reasoning that
bouncing someone to a full-page Google redirect right after they deliberately closed the window is
the opposite of what they asked for. That reasoning holds. The implementation did not:

- Firebase raises `auth/popup-closed-by-user` **both** when a person closes the window and when the
  SDK loses its handle on it (Cross-Origin-Opener-Policy). It is not reliably a decision.
- So on any environment producing it spuriously, sign-in went from "annoying but works via redirect"
  to "nothing happens at all".

Two dead ends, not one. The second only surfaced because the test asserted it:

1. **No message, no route through.** Now it says what happened and reveals **Continue in this window
   instead** — a redirect-only path (`signInGoogle({ forceRedirect: true })`) that no popup blocker
   can touch. Never automatic; always one tap.
2. **The button stayed disabled on "Opening…".** `run()` hands the button back only when its function
   THROWS, on the assumption that success navigates away. A cancelled sign-in does neither. Written
   down in progress.md, because any future outcome that stays on the screen hits the same trap.

`signInGoogle` now returns a tagged result — `{ status: 'signed-in' | 'redirecting' | 'cancelled' }`
— because collapsing "cancelled" and "the page is navigating to Google" into a bare `null` is what
let a cancelled sign-in look like nothing happening. Both Google buttons now come from one shared
`googleButton()` rather than two copies that drift.

Also filled a real gap: the previous stub tests covered five failure paths and **not one success
path**. Added both, and the plain popup sign-in now asserts `signInWithPopup → user`.

350 data-layer + 116 render assertions, green. Verified in a browser as well as in jsdom.

Lesson worth keeping: the change that caused this was made to fix a bug I had diagnosed correctly,
with tests that passed, and shipped without anyone signing in with Google once. `popup-closed-by-user`
is exactly the kind of code whose meaning cannot be read off its name.

---

## 2026-08-16 (cont.) — plan: strength from ordinary workouts

Tim asked for a big plan: graphs and the body map should work without benchmarks, defaulting to
ordinary workout sets, with a benchmarks-only option — and *"it's important that we make the system
mostly accurate and not all over the place, which is the worry with using normal workout
measurements."*

Written to `docs/strength-estimate-plan.md`. Nothing built.

**The insight the whole design turns on: the noise is one-sided.** A set can be easier than maximal —
submaximal effort, fatigue, a warm-up, a bad day — but it can never be *harder* than what the lifter
was capable of. So every observed e1RM is a lower bound on true strength, and that settles most of
the design at a stroke:

- averaging a day's sets is actively wrong — it is biased downward by however many warm-ups and
  back-offs the person's programme happens to contain, so two equally strong lifters would read
  differently purely from session structure
- the estimator belongs to the *maximum* family — an upper envelope
- a dip is weak evidence and a peak is strong evidence, so the estimate should rise readily and fall
  reluctantly

A naive "plot every set" chart swings wildly because it is showing the noise floor rather than the
signal. That is the thing Tim is worried about, and it is a consequence of the estimator, not of
workout data being unusable.

Of the nine sources of variance listed, only two are genuinely invisible (proximity to failure, and
day-to-day readiness). The rest — warm-ups, back-offs, rep count, set order, exercise order — are all
already in the data and simply have not been used. Warm-ups in particular are exactly detectable:
a set before the day's heaviest *and* lighter than it. That rule also does the right thing for
reverse-pyramid training without a special case.

Other pieces: per-set confidence (rep range × load-vs-recent-best × fatigue), corroboration as a
partial stand-in for the missing RIR field, confidence-weighted best-of-3 over a trailing window,
a rate limit on falling, an uncertainty band whose width is the honest output, and band-aware levels
with hysteresis so the body map stops flapping.

**D14 needed confronting rather than dodging.** It bans mixing benchmarks with workout sets. But all
three failures it was written for — wild swings, the point flipping with the rep target, one-per-day
discarding the loser — are structural to plotting *raw sets from two populations*, and none survive
an explicit confidence-weighted estimator. So the plan proposes D18, narrowing D14 to raw per-set
plotting. That is a locked decision, so it is now an open question for Tim rather than something I
quietly overrode.

Also proposed: a simulator with a known true 1RM curve, so the constants get fitted rather than
guessed — optimising for **flap rate**, which is the direct measurement of Tim's worry — and later a
backtest that hides his real benchmarks and predicts them from workout sets alone.

---

## 2026-08-16 (cont.) — "is the workouts incorporated in the data working now or not yet?"

Checked rather than answered from memory, on an account with zero benchmarks:

- **Body map** — Chest ranked *Intermediate, source=workout*. Works.
- **Graphs** — the exercise appears with `usableSources: ["workout"]` and charts 3 points. Works,
  and predates today; it was always the fallback when no benchmark existed.

So the basic thing is live. What is **not** built is the estimator from
`docs/strength-estimate-plan.md` — the confidence weighting, warm-up rejection, uncertainty band,
stable levels, and the setting.

One caveat that matters: when an exercise has **both** sources, the graph still defaults to
benchmarks. That is the opposite of what Tim asked for ("default should be mostly workout
measurements") and is the one part of his request that is genuinely unmet today.

### And the check turned up a live bug

Probing whether the "all over the place" worry was already real: a **135×25 burnout set promoted
Chest from Intermediate to Proficient**, beating a genuine 205×5. `muscleStrength()` called `e1rm()`
with no rep limit, and the formula extrapolates 135×25 to 258 lb.

D5 already says don't extrapolate above 15 reps, and `canNormalize` enforces it for charts — the
ranking path simply never applied it. A locked decision going unenforced, so it is enforced now:
`MAX_EVIDENCE_REPS = 15` in `e1rm.js`, applied in `muscleStrength()`. Benchmarks get no exemption —
a 25-rep test is no more evidence of a maximum than a 25-rep set is.

This is the cheapest possible instalment of the plan: no confidence model, no estimator, just the
rep gate that was already decided. It removes the single worst distortion for five lines of code.
Anyone whose level was inflated by a high-rep set will see it drop, which is correct.

355 data-layer + 116 render assertions, green.

---

## 2026-08-16 — end of session, prepared for a chat reset

Swept `progress.md` for staleness and contradiction rather than just appending to it. What was wrong:

- The **Status** block had two paragraphs run together from separate edits and read as nonsense.
- **Test counts** were stale in three places (275/49 in Verified, 245/29 in the file tree, against a
  real 355/116), and the module count said 16 when there are 18.
- The **Muscles** row still said "grey with no benchmark" — contradicting the same file's §9, which
  says it now ranks from workout sets too.
- The **Data** row said "benchmarks by default" without noting that an exercise with only workout
  sets already charts those, which is exactly the question Tim asked at the end of the session.
- `docs/firebase-setup.md` was described as holding "the one remaining console step". Google sign-in
  is enabled and in use, so that pointer was actively misleading.
- A §9 bullet had swallowed the following bullet (Core/Neck/Cardio) into its own last line.
- The file tree was missing `strength-estimate-plan.md` and listed `units.js` and
  `views-edit-session.js` in the wrong places.

Added to **Key patterns**, because both are traps a fresh session would otherwise walk into:
`setChildren()` rather than `replaceChildren()` (the literal-"null" bug), and weights being stored in
pounds always with conversion at exactly two edges.

Rewrote **§10 Next steps** so the first item is the one that is actually blocked on nothing — Phase 0
of the estimate plan — and recorded that the graph still defaults to benchmarks when both sources
exist, which is the one part of Tim's last request still unmet.

State at close: **355 data-layer + 116 render assertions green**, everything pushed and live,
Tier 1 complete, one decision (D18) waiting on Tim.

---

## 2026-08-16 — Tim's vision list gets a home

Tim wanted somewhere to put what he wants this to *become*, separate from what is scheduled — "I'll
add to them later", and explicitly **don't start any of these**. So `docs/vision.md`: a capture file,
not a plan, with a standing rule at the top that nothing graduates out of it without him saying so.

Four ideas recorded in his words:

1. **Social** — contact other people, see their workouts and overall progress, per-person visibility
   controls. Strava's format and feel, structured for lifting rather than runs.
2. **Smart systems** — automatic weight/rep adjustment for progressive overload instead of repeating
   an identical exercise, plus suggesting *which* workout to start based on history. (His sentence
   trailed off mid-thought on the second input to that suggestion; recorded as unfinished rather than
   guessed at.)
3. **Pre-designed systems ranked by how optimal they are, as a percentage** — 5×/week at 90 min might
   be the optimum; 3×/week at 45 min might be 90% of it, and the user decides what they are giving
   versus getting. Plus a few influencer/celebrity systems.
4. **"Compared to:" as a setting** on the muscle map — default stays people who lift at your weight,
   sex and age, but male / female / all / specific or all weights / specific or all ages all become
   choosable, with the colours and ranges moving accordingly.

The part worth doing properly was the collisions, and they are noted in the file rather than
resolved: **social contradicts D7** ("no social feed" — though D7 was aimed at a passive feed bolted
onto a logger, which is not this), and an **"all people" comparison contradicts D15**, which locks
ranking to people who lift precisely because general-population data makes every user Elite and
collapses the seven-level scale. The likely shape there — levels stay pinned to the lifting
population, the *percentile* moves with the comparison group — is written down as a design question,
not an answer.

Also flagged: the "% optimal" number would be the most scientifically load-bearing thing the app ever
shows, so it needs grounding in `docs/research.md` or it is a made-up number with a percent sign on
it. And three of the four ideas turn the app from a recorder into an adviser, which is exactly what
Rules 5 and 6 exist to police.

Linked from `progress.md` — the file-upkeep table and a new block under §8 Roadmap — so a fresh
session finds it. No code touched.

---

## 2026-08-17 — "Add another set" was painted over the sets

Tim: the add-set button at the bottom of a workout covers up some of the set details, specifically
the third. Make it a lot smaller and off to the side.

Reproduced it properly rather than eyeballing — Chrome over CDP at 360×640 with six sets. It was a
genuine overlap, not crowding: the button was drawn **on top of set 4**, hiding sets 5 and 6
completely.

Cause was one property. `.pane-scroll` is a column flex container, and `.set-list` carried
`min-height: 0`, which throws away the `min-height: auto` that normally stops a flex item shrinking
below its content. Once the content outgrew the pane, the list's *box* was crushed while its rows
kept their real height, so the rows spilled out of the box and the next sibling — the button — was
laid out over the top of them. At 390×844 with four sets nothing overflowed, so it looked fine, which
is why it survived every previous screenshot.

Two changes:

- `.set-list` is now `flex: none`. The list keeps its height and the pane scrolls, which is what
  should have happened all along.
- The button moved up onto the "Sets" heading as a small right-aligned pill reading **Add set**
  (32px tall, 83px wide, was a full-width 46px block). It no longer competes with the sets for
  attention, and being above the list it stays on screen when the pane scrolls back to the top after
  a set is added.

Verified with a real `Input.dispatchMouseEvent` click, not a synthetic event: hit test at the pill's
centre lands on `.add-set`, clicking takes 6 sets to 7 and makes the new one active. Re-shot at
360/390/1180 — no overlap at any of them. 355 data-layer + 116 render assertions green.

Worth remembering, and now in `progress.md`'s key patterns: anything tall inside a `.pane-scroll`
wants `flex: none`, and `min-height: 0` belongs only on a child that handles its own overflow.

---

## 2026-08-17 — the body map stops being picky

Tim's report: he trained every muscle in his body for a week and the map recorded **one** measurement,
the back squat. He had done hammer curls instead of barbell curls, dumbbell shrugs instead of barbell
shrugs, dumbbell rows instead of barbell rows, seated calf raises instead of standing, machine
shoulder press instead of overhead press. Every one of those is in the library, tagged to the right
muscle, and was thrown away — a muscle was ranked by exactly ONE named lift, so **11 of 265 exercises
could move the map**.

His proposal: many exercises feed a muscle, weighted, some trumping others, with recency counted, and
a **confidence** per muscle shown as colour brightness.

Three things I pushed back on or added before building, all three of which he took:

1. **Brightness cannot carry confidence, because brightness already carries the rating.** The seven
   levels are a strictly monotone lightness ramp — that is what makes them read as a scale rather than
   a rainbow — so a dimmed Elite would read as a lower level. Confidence is carried by **saturation**
   instead. Grey already means "no data", so faded reads as "less sure" on the same axis.
2. **"Trump" is strict, not just heavier.** Direct exercises decide a rating; a compound stands in for
   a secondary muscle only when that muscle has nothing direct at all. That keeps grey meaningful —
   it still answers "what am I not training".
3. **The honest cost.** Scoring a hammer curl means knowing what a good hammer curl is, and published
   standards exist for the 11 key lifts only. Everything else needed a ratio, and those ratios are
   estimates — solid for dumbbell swaps, **shaky for machines**, where gearing varies by brand.
   Coverage went up and per-observation accuracy went down. Confidence is what pays for that.

### Built

`js/muscle-evidence.js`, pure maths, no DOM or store — the pattern that keeps catching bugs here.
~90 ordered ratio rules across the 11 rankable muscles, each with a `quality` that is the *width of
the population spread in that conversion*, not how hard the exercise is. Per-side loads are doubled
to total before anything else, or every dumbbell lifter reads as feeble.

Cross-muscle conversions are **not** a second table: they fall out of the medians already in
`strength-standards.js`, so bench → triceps is 185/225 by construction and the two cannot drift apart.

Confidence is a geometric mean of four things — conversion quality, how much evidence there is,
whether the contributing exercises agree, and how fresh the newest one is. Geometric so no single term
can be quietly compensated for: a pile of stale evidence stays low-confidence however much of it there
is. Two different half-lives, deliberately: **weight** decays slowly (120 days), because a four-month
old heavy single is still the best evidence there is; **freshness** decays fast (60 days) and feeds
confidence only. Old evidence still sets the number, it just stops claiming to describe today.

### Two bugs the tests did not catch — reading the numbers did

- **A name collision.** The scoring code wrote `weight:` onto an observation that already had a
  `weight` — the pounds on the bar — so every displayed lift was silently replaced by its own
  confidence score. A 205 lb set rendered as `0.91`.
- **The cross-muscle conversion was inverted.** Dividing where it should multiply gave a dumbbell row
  a **429 lb wrist curl** and painted Forearms Elite off a single set. No test caught it because every
  test only asserted that a number existed. There are now tests that assert the *direction*: standing
  in for a weaker muscle must produce a smaller estimate.

Both were found by dumping a realistic training week and looking at the table, which is worth
remembering as a technique.

### A design flaw found by screenshotting the light theme

The first version faded with `color-mix`, which moves lightness as well as chroma. In the light theme
the ramp runs strongest = *darkest*, so fading a muscle **lightened** it — the exact confusion the
whole design was meant to avoid, just in the other theme. Fixed with relative colour syntax
(`oklch(from … l calc(c * var(--tint-n)) h)`), which scales chroma alone. Verified from computed
styles, not by eye: two muscles at the same level and different confidences now have **identical**
lightness and hue, differing only in chroma. Both declarations are kept, weakest support first, so an
older browser degrades to the solid fill it had before.

### Result

The same week that produced one reading now rates all eleven muscles, each naming the exercise it
came from, its confidence as a bar and a word, how many sessions counted, how old the newest is, and
what to do to firm it up — *"Only one session counts so far. A second would confirm it."*

**448 data-layer + 117 render assertions, green.** Screenshotted at 390 and 1180 in both themes.

**Known and stated, not hidden:** a seated calf raise at 180×12 still estimates a 417 lb standing calf
raise and reads Elite off one set. Two inflations stack — the e1RM formula extrapolating from 12 reps,
and the seated→standing conversion. The panel says Fair confidence, one session, and warns about the
12-rep set, but the *level* still says Elite. Fixing it properly needs per-exercise spread or high-rep
shrinkage, and neither should be guessed at without the simulator in
`docs/strength-estimate-plan.md` §11. Written into `progress.md` §9 rather than quietly tuned.

---

## 2026-08-17 — "Compared to:" — the user picks the comparison group

Straight from `docs/vision.md` §1.4, which Tim asked me to review and then build. I had enough detail
and said so, with one correction to my own earlier note: I had read his "all" as meaning *all people
including non-lifters*, which would have collided with the rule that ranking is always against people
who lift. Re-reading, "all" sits in a list with male and female — it is the **sex** axis. There was no
collision. The general-population readout was already a separate "vs. everyone" line.

### What it is

The caption on the Muscles screen — the line that already stated the comparison — became the button
that changes it. Tapping it opens a sheet with three independent axes:

- **Who** — people like me · men · women · everyone who lifts
- **Body weight** — mine · any
- **Age** — mine · any

Independent rather than a preset list, because "women, any body weight, my age" is a real question
and no preset list holds sixteen combinations without becoming a menu nobody reads. Saved to
settings, so it survives a reload and follows the account.

### The part that needed actual thought

**"Everyone who lifts" has no median.** The male and female distributions sit about 2.5σ apart, so
any single combined median would be a number describing nobody. It is modelled as a real **mixture**
instead: the percentile is the share-weighted sum of the two populations' percentiles. There is a
test asserting exactly that identity, so the implementation cannot quietly drift into a fudge.

The male share (55 %) **is an assumption** and is labelled as one in the code — US strength-training
participation is close to even, but barbell logging skews male. It affects only that one option.

A mixture has no closed-form inverse, so the targets panel solves it by bisection. That matters more
than it sounds: the levels and the targets are held together by a round trip — hitting the weight the
panel asks for must actually grant the level — and the tolerance for that was originally measured
against the closed form. So there is now a test that walks **all sixteen combinations** of the three
axes, and for every level checks that the target round-trips and grants the level. 80 halvings put
the bracket far below the closed form's own error.

Two other invariants worth having: targets must still *rise* with level under every comparison, and
every caption must name a population that **lifts**. The latter replaced a render test that had been
checking for the literal string "people who lift" — which was the right rule expressed as the wrong
assertion, since the caption is no longer one fixed string.

### Corrections that fell out

The screen still told people a muscle was "ranked by one named lift" in two empty states — untrue
since yesterday. Both now say any exercise that trains the muscle counts.

The detail panel's "Stronger than X % of people who lift at your weight and age" was hard-coded to
assume the default comparison. It now builds that sentence from the same function as the header, so
the number and the population it refers to cannot disagree.

### Verified

**641 data-layer + 118 render assertions, green.** Driven in a real browser with CDP clicks, not
synthetic events: opening the sheet, picking **Women**, and watching Chest go Intermediate → Elite
while the caption changed to "vs. women who lift" and the setting persisted to storage. Same again
for "Any body weight". The sheet stays open while the body recolours behind it, which turned out to
be a nice property rather than a designed one.

---

## 2026-08-17 — four axes and two presets, and D15 gets narrowed

Tim, on seeing the first cut: *"people like me should not be a category at all. I think there should
be 4 different categories: lift/don't lift, gender, age, and weight. and at the top of the settings
there should be a button that says 'like me' or 'everyone' that automatically sets each setting
accordingly."*

He is right about "people like me". It was doing two jobs at once — quietly meaning "your sex" while
reading like a whole preset — which is exactly why he had to ask what the difference was between it
and "everyone who lifts". Each axis now says one plain thing, and the preset job moved to where it
belongs, as two buttons at the top of the sheet.

`sex: 'own'` survives internally as the *unset* value so a user who has never opened the sheet still
gets their own sex, but it is never shown; the chip that lights up for it is their actual sex.

### The part that needed care: lift / don't lift

This is the axis the app has refused for its whole life. D15 says ranking is against people who lift,
never everyone, because general-population data makes every user Elite.

**The objection turned out to be about the model, not the idea.** The old general-population readout
assumed every non-lifter sits below every lifter — so any lifter at all landed above the 68th
percentile of adults and seven levels squashed into three. That is a property of that specific
approximation, not of the question Tim asked.

Giving untrained adults their **own overlapping distribution** fixes it. Median untrained = 0.55 × the
lifter median, same spread, mixed at the NHIS participation rate. Against everyone, the levels still
separate properly:

| Lifter | vs. people who lift | vs. everyone |
|---|---|---|
| 5th percentile | Beginner | Proficient |
| 50th percentile | Intermediate | Expert |
| 95th percentile | Elite | Elite |

A beginner reads as a beginner-ish rather than Elite, and the percentile spread across lifters is
32.6 points against the old model's 29-point ceiling. All three of those are now assertions in the
test file, written as the D15 objection itself so nobody has to remember the argument.

**The 0.55 is the weakest number in that file and is labelled as such** — nobody has measured what the
median adult can bench, because the median adult has never tried. The sheet says so, and the detail
panel adds a caveat whenever the comparison includes non-lifters. So D15 is narrowed rather than
repealed: the reference population is still stated in words every time, and "all adults" never reads
as "who lift".

The old "vs. everyone" chip is gone — it would have been a second control for the same thing, free to
contradict the sheet.

### Verified

**772 data-layer + 118 render assertions, green**, including the round trip (target → percentile →
level) across **all 32 combinations** of the four axes, and that targets still rise with level in
every one of them. Driven in the browser with real clicks: "Like me" lit by default, pressing
"Everyone" sets all four axes at once, the caption becomes "vs. all adults · any body weight · any
age", Chest moves Intermediate → Expert, and the choice persists.

---

## 2026-08-17 — the charts stop being dead ends

Tim, mid-session: *"I know the graph and bar charts don't mean much without multiple recordings of
benchmarks over time, but I still want to be able to see some sort of display that allows the user to
know their current measurements for each of their lifts in these sections."*

He is describing a real hole. Both chart modes need the same thing recorded on **two different days**
before they can draw anything, so someone who had just logged a full workout was told "Nothing to
chart yet" — while the app was holding every number they had entered. Worse, the tabs were
*disabled* in that state and the screen force-switched away from them, so it read as the app having
lost the data rather than as a chart waiting for a second point.

### Built

`currentBests()` in `store.js`, and a list that replaces the empty states in **both** modes:

- One row per exercise: best effort, its date, how long ago, how many days recorded.
- Ranked by **estimated max**, so 205×5 correctly beats 185×8 and a 135×12 burnout beats neither.
- Per-side lifts show what was typed, with `/side` — doubling belongs to the ranking model, not to a
  screen showing someone what they logged.
- Time-based work keeps its own best, and **fastest wins** for a time. No estimated max is invented
  for it.
- The estimate is labelled `~242 lbs max` with a footnote that it is an estimate, not a lift
  performed — Rule 5, an inference must not look like a measurement. A list rather than a chart for
  the same reason: there is no trend in one recording and drawing one would be inventing a shape.

A separate function from `chartableExercises(1)` on purpose: a chart wants points over time, this
wants the single best effort and how long ago it was. Different question, different function.

**Nothing is disabled any more, and no mode is force-switched away from** — both were only defensible
while those modes led nowhere.

### Also fixed

The mode switch had wrapped **"Bar Chart"** onto two lines at every width tested, desktop included —
carried in the docs as known-but-untouched since `868fdb0`. Cause was the flex default
`min-width: auto` letting a `.seg` be squeezed below its own content and wrap rather than overflow.
`white-space: nowrap` and `min-width: 0`. Confirmed on one line at 360 px.

### Verified

**784 data-layer + 125 render assertions, green.** The render tests now assert that neither chart
mode dead-ends, that both show real numbers, and that no tab is disabled. Screenshotted at 360 and
390 with a single day's workout: six lifts listed with per-side, a plank in time, and estimated maxes.

---

## 2026-08-17 — workouts become workout systems

Tim: *"I want to change workouts to workout systems, which means that you can have different systems
of workouts, each with their own set of workouts you can choose from. This also ties with my talk in
the vision about being able to view other popular people's workout system and use it for yourself.
Lets just start with doing the workout system creation."*

So: a **system** is a programme — a named group of workouts. "Push Pull Legs" holding a Push, a Pull
and a Legs day. The Workouts tab lists systems; opening one shows and adds its workouts.

### Decisions made without asking

**A workout belongs to exactly one system.** Sharing one between two programmes sounds useful and is
not — editing it in one place would silently change the other, and *"did my Push day change because I
imported someone else's programme?"* is a question this app should never raise.

**Deleting a system deletes its workouts, but never recorded history.** The confirmation names the
count. Sessions already logged are untouched: history is a record of what happened and does not
become untrue because the plan behind it was thrown away.

**The start picker groups rather than nests.** Making someone pick a system and then a workout adds a
tap to the one screen used mid-gym. Workouts are listed under system headings, and the headings
disappear when there is only one system, because a sole heading is decoration.

### The migration, and the bug in it

Tim has real workouts saved. `ensureSystems()` adopts any workout without a `systemId` into a
**My Workouts** system, creating it if needed, and is idempotent — after the first run there are no
orphans, so it writes nothing.

It shipped broken for about ten minutes. Read-modify-write across two collections is not atomic, and
`WorkoutsView` asks for systems and workouts in the same `Promise.all`. Both calls ran the migration,
both read "no systems", both created one, and the second write clobbered the first — leaving the list
pointing at a row that no longer existed and every workout stamped with a dead id. On screen: a system
that said **"No workouts yet"** and then **"Not found"** the moment you tapped it.

Fixed by making the migration single-flight, so concurrent callers share one run. There is a test
that fails if the guard is removed — verified by removing it.

That trap is now in `progress.md`'s key patterns, because the next read-modify-write migration will
have exactly the same shape.

### Also

`firestore.rules` gained `systems` in `knownCollection()` and **was deployed** — the documented trap
is that a collection added to `COLLECTIONS` and not to the rules has every cloud write denied while
localStorage keeps working, which is invisible until someone signs in.

### Verified

**806 data-layer + 134 render assertions, green.** Driven in a browser from a seeded pre-systems
account: the three old workouts appear under "My Workouts" with their names as the subtitle, opening
the system lists them, creating a second system lands inside it, and the start picker still reaches
every workout.

Next, per Tim: celebrity / popular systems you can view and take for yourself.

---

## 2026-08-17 — ready-made systems you can browse and take

Tim: an explore section in Workouts for pre-made systems, addable to your own account. First one to
be Jeff Nippard's *Ultimate Push Pull Legs Series (2023)* from YouTube.

### Built — the whole feature

**Workouts → Explore ready-made systems.** Browse a list, open one and read the entire programme —
every workout, every exercise, the planned sets and the per-exercise coaching notes — then tap to
copy it in.

A **copy**, not a link. Once added it is the user's: rename it, change the exercises, delete a day.
The alternative, keeping it linked to the original, means someone's training plan could change under
them when the app updates, which is exactly the surprise a plan must never spring. The system
remembers its `presetId` so the browse list can say **Added**, and adding it twice makes a second
separate copy rather than merging or refusing.

Exercises are referenced **by name**, not by id — ids are derived from name+muscle in `exercises.js`,
so hard-coding them would rot silently the first time a name changed. That trade only holds because a
test asserts every name in every preset resolves; without it the failure is a workout quietly missing
an exercise.

### Not built — the Nippard system, and why

Researched it properly before writing anything. Two blockers, and neither is effort:

1. **The full 12-week "Ultimate Push Pull Legs System" is a paid product** — a 110-page ebook sold on
   jeffnippard.com. Copying its prescriptions into a public app is redistributing what he sells.
2. **Nobody here can watch the videos.** The free YouTube series is six parts; the secondary
   write-ups are fragments (one names a close-grip incline bench and a set of diamond push-ups to
   failure, another describes an undulating set model) and they disagree. Anything shipped would be a
   guess published under a real person's name — the one thing this project has consistently refused
   to do.

So what shipped instead is **three systems the app can actually stand behind** — Push Pull Legs,
Upper/Lower, and a 3-day Full Body — built on what `docs/research.md` already supports: 10–20 hard
sets per muscle per week (§6), compounds first while fresh (§4), and last sets taken near failure
because every estimate the app makes assumes it (§3).

The structure is ready for the real thing: `author`, `sourceName` and `sourceUrl` exist on every
preset and the detail screen renders them, with a test asserting the attribution fields are present.
A licensed or properly sourced system needs no new code — it needs permission, or a first-party
written source Tim can point at.

### One thing corrected before it shipped

The detail screen said "64 sets a week". It is not a weekly figure — a 6-day PPL runs its three
workouts twice, so the total across the workouts overstates or understates every programme by a
different factor depending on how it repeats. Now reads "64 sets across 3 workouts", with a test that
the phrase "sets a week" never appears.

### Verified

**858 data-layer + 141 render assertions, green.** Driven in a browser with real clicks: Explore from
the Workouts screen, open Push Pull Legs, 20 exercises listed under Push/Pull/Legs, add it, land
inside the new system with all three workouts, and the browse list then shows **Added**. Checked
against the store afterwards that the copy carries 6/7/7 exercises with their notes intact.

---

## 2026-08-17 — the Nippard system, found and built

Tim asked whether the exercises had been written down anywhere by somebody else. They have. Searching
properly changed the answer, and it is worth recording what changed it.

### What was found

Three separate fitness publications wrote up the **free** YouTube videos, with exercises in order and
sets and reps:

| Day | Source | Complete? |
|---|---|---|
| Push | [Fitness Volt](https://fitnessvolt.com/jeff-nippard-push-workout/) | yes, 8 movements with sets/reps |
| Pull | [Fitness Volt, 27 Jul 2023](https://fitnessvolt.com/jeff-nippard-back-and-biceps-workout-backed-by-science/) | yes, 6 movements with sets/reps |
| Legs | [Fitness Volt, 23 Feb 2023](https://fitnessvolt.com/jeff-nippard-leg-day-workout/) | yes — and names itself "the third installment of the six-part push-pull-leg series" |

That last line is what made it usable: an explicit link between a write-up and the series Tim named.

### The trap that nearly got us

**Nippard has published several similarly named push workouts, and the write-ups disagree because
they are describing different videos.** Three "Jeff Nippard push day" articles gave three different
workouts:

- Fitness Volt (the 2023 series): bench, Larsen press, Arnold press, cable press-around, Y-raise…
- [BarBend, 3 Jun 2023](https://barbend.com/news/7-exercises-jeff-nippard-chest-shoulders-triceps/):
  close-grip incline bench, machine shoulder press, floor-reset skull crusher, diamond push-ups…
- [Generation Iron](https://generationiron.com/jeff-nippard-push-pull-legs/) (an older PPL): dips,
  Egyptian lateral raises, cable triceps kickbacks…

The earlier session read "the sources disagree" as "the sources are unreliable". The truer reading is
that they are reliable about **different videos**, and the job is to pin down which. That is now a
warning in `progress.md`.

### What was NOT used

The paid 12-week ebook on jeffnippard.com — including a copy of it sitting on a document-sharing
site. That is the thing he sells, and it stays out.

### Built

`preset-systems.js` gained the system, and the exercise library gained the five movements it needed:
**Larsen Press, Cable Press Around, Cross-Body Cable Y-Raise, Cross-Body Cable Triceps Extension,
Kroc Row** — 265 exercises to 270. The four cable/dumbbell ones are per-side, which matters: the
ranking model doubles per-side loads, and getting that wrong makes a lifter look weak.

The detail screen carries `unofficial: true`, which renders as a warning above the programme:
*not official, transcribed from published write-ups of the free videos, sets and reps as reported.*
The notes also state that the series runs to six workouts and this is one of each.

A test now asserts that **any** preset credited to a real person has a source URL, the unofficial
flag, and a note saying it is not that person's own writing. That is the difference between citing
someone and impersonating them, and it should not depend on whoever adds the next one remembering.

### Verified

**869 data-layer + 141 render assertions, green.** Driven in a browser: Explore → Ultimate Push Pull
Legs → 20 exercises across Push/Pull/Legs → added → lands in the new system with 8/6/6 exercises,
notes intact. Also fixed "1 sets" in the preset list.

---

## 2026-08-17 — end of session, prepared for a chat reset

Swept `progress.md` for staleness and contradiction rather than appending to it. It had taken a lot
of scripted edits in one day and several had gone wrong.

**What was actually wrong:**

- **The decisions table was out of numeric order** — D20, D22, D21, D19, then D16 — because each new
  decision had been inserted above a fixed anchor. Sorted.
- **A blanket "265 → 270" rewrite had corrupted three *historical* statements.** "11 of 265 exercises
  could move the map" became "11 of 270", which silently rewrote the past; the same happened in D19
  and in D11's note about classical formulas. All three now avoid the number entirely, and the live
  figure is stated properly: **164 of the 209 weighted exercises rate a muscle**, measured rather
  than guessed at.
- **"the 14 bodyweight/assisted exercises" was wrong** — there are 54. Also added the consequence
  that had never been written down: `contributionsFor()` refuses them too, so **a pull-up rates
  nothing at all**, which is a bigger gap than "body weight is not wired into normalisation" sounds.
- **The status paragraph had a day of work missing** — no mention of systems, Explore, the comparison
  setting or the chart fallback.
- **§10 Next steps was pre-session.** It still listed the graph-source default (still true, still
  unmet) but framed Phase 0 as the thing "blocked on nothing" without saying why it now matters more:
  a confidence model shipped with reasoned-not-fitted constants, and §9 has two accuracy gaps that
  cannot honestly be closed by guessing.
- **The file-upkeep table lied twice.** `docs/vision.md` said "nothing in it is being built" — two of
  its four ideas now are. `docs/strength-estimate-plan.md` said "Plan, not built" — its §10 was built
  today. Both corrected, and `js/preset-systems.js` added, because its header records what may and
  may not be shipped from someone else's programme.

**Added to §10 open questions:** whether Tim wants the "% optimal" system rating from
`docs/vision.md` §1.3. It is buildable now that ready-made systems exist, and it would be the most
scientifically load-bearing number the app has ever shown — so it needs `docs/research.md` §6
grounded first, which is still marked 🟡.

**State at close:** **869 data-layer + 141 render assertions green**, everything pushed and live,
Firestore rules deployed. Today added: the many-exercise muscle rating with confidence, the
comparison-group setting, the current-bests fallback on both chart modes, workout systems, and
ready-made systems including one transcribed from Jeff Nippard's free 2023 series.

The next thing worth doing is the **simulator** — it is what turns the two remaining accuracy gaps
from documented into measured. The biggest risk remains unchanged and is not a code problem: **nobody
has opened this app on a real phone.**

---

## 2026-08-17 (later) — Three more ready-made systems, and a third kind of attribution

**Tim:** *"I know I personally follow Mike Israetel so lets try to find a way to make a system for
him, and then lets also do the Arnold and Thurston one you recommend aswell. Also put a note in the
vision to eventually add supersets, drop sets, and tri-sets to the cite."*

This followed a list of celebrity systems worth adding, filtered by what can actually be shipped:
free published write-up, cited, flagged unofficial, nothing from a paid product.

**Shipped: three systems.** Explore now holds seven.

- **The Golden Six** — Arnold Schwarzenegger. One workout, three times a week, 20 sets. The oldest
  programme in the list and still a sound beginner routine. Its warning is different from Nippard's:
  the versions of this routine *disagree with each other* after sixty years of republication, and
  nobody here has a primary source. The behind-the-neck press is kept because it is in the original,
  with a note saying to press in front if your shoulders object.
- **Mike Thurston's Six-Day Split** — five lifting days plus a conditioning day, transcribed from
  Fitness Volt. Its own limitation, stated on screen: he rebuilds his programme every four to six
  weeks, so this is one block frozen rather than a programme he stands behind. First preset to carry
  **cardio** exercises; checked in a browser that they copy in with the right fields.
- **Volume Landmarks Hypertrophy** — and this one needed a new idea.

**The Israetel problem, and the third kind of system.** A straight transcription was not honestly
available. What he publishes *free* is a METHOD — volume landmarks, MEV → MRV — while the routine
written up as his own training is built almost end to end from supersets, tri-sets and myo-reps,
none of which this app can log. Transcribing that as a flat list would not be his workout; it would
be a list of the exercises in it.

So `js/preset-systems.js` now distinguishes **three** kinds of system, and the header says so:

| Kind | `author` | Renders as |
|---|---|---|
| Ours | `Fitness Tracker` | "By Fitness Tracker" |
| Transcribed | the real person | "By Jeff Nippard" + unofficial warning |
| **Method** | `Fitness Tracker` **+ `basedOn`** | "By Fitness Tracker" *and* "Follows **Dr. Mike Israetel**'s volume landmarks. The workouts below are not theirs." |

The rule that matters: **a person's name never goes in `author` unless they chose the exercises.**
"By Dr. Mike Israetel" over a routine he has never seen is a lie no warning underneath it can undo.
Tests enforce it — a `basedOn` system that names the person as author fails, and a render test
asserts the string "By Dr. Mike Israetel" never appears on the page.

**Two things fixed along the way, both found by looking rather than by reasoning:**

1. **The warning banner was quieter than the text it was warning about.** It reused
   `.chart-caption.warn` — 12px, `--ink-soft` — so the one line on the screen that must not be
   skimmed rendered fainter than the notes below it. New `.preset-warning`: hairline rule in
   `--danger` down the left, full-strength ink, no box (Rule 2). Also the default warning text said
   "transcribed from the free videos", which is true of Nippard and false of a routine from 1965 or
   of a method-based system — `warning` now overrides it per system, and a test fails if anything
   that is not a video transcription falls through to the default.
2. **Copied programmes arrived in ALPHABETICAL order.** Found by driving the real Add button:
   Thurston's week came out Arms, Back, Chest, Conditioning, Legs, Shoulders, and Upper A / Lower A /
   Upper B / Lower B came out with both Lowers first — reversing exactly what the notes tell you to
   alternate. `getWorkouts()` sorted by name. Workouts copied from a preset now carry an `order`;
   ordered ones sort first, unordered ones stay alphabetical after them, so a workout you add
   yourself lands at the end of somebody's split rather than in the middle of it. **This fixed
   Nippard too** — it had been listing Legs, Pull, Push since the day it shipped.

**Also:** `docs/vision.md` §1.5 — supersets, drop sets and tri-sets, as Tim asked. The note records
*why it came up now*: it is the thing blocking celebrity systems. Chris Bumstead's programme is
tri-sets and drop sets; Israetel's own training is supersets and myo-reps; Thurston's arm day is
paired in one published version. It also flags that four things are being lumped together and are
two different shapes — a superset groups *exercises*, a drop set is a structure *within one set* —
and that whatever gets built has to keep "a drop set counts as ONE hard set" true, which is already
decided in §6.

**State at close:** **937 data-layer + 153 render assertions green.** Screenshotted at 360 and
1180 px in both themes; the add flow driven with real mouse events through to the copied system and
into its workouts. Unverified as ever: a real phone.

---

## 2026-08-17 (later still) — Tim was right: Israetel's real split does exist

**Tim:** *"for the israetel system, could you do the same thing you did with nippard and just search
online for other people who have reposted or summarized the system for themselves and others?"*

**He was right and the earlier conclusion was wrong.** The method-based system was built on
"no transcribable programme of his exists", which was a conclusion reached after four searches.
Searching properly found one immediately: **Renaissance Periodization publish his own split on their
own site, free** — *Dr. Mike's Exact Training Split to Get to 6% Body Fat* — and **BoxLife Magazine**
wrote it up independently, agreeing exercise for exercise. That is *better* sourcing than the Nippard
transcription has, and it went in as `preset-israetel-floating-split`, **Dr. Mike's Floating Split**.

**What it is.** Six workouts — Pull 1, Legs 1, Push 1, Pull 2, Legs 2, Push 2 — run on no fixed days
at all. Train when recovered, rest when not; it came out at six days a week on average, sometimes
five, sometimes seven. Sessions ~90 minutes. That "floating" idea is the best thing in it: a
programme with no Tuesday cannot be derailed by missing a Tuesday.

**Three limitations, all on screen, and the warning leads with the worst one:**

1. **Nearly every set is a myo-rep or a giant set, and this app records straight sets only.** So what
   ships is his exercise choice with the set structure removed — "4 myo-rep match sets" renders as
   4 sets. This is the most distorted transcription in the file, and it is the single strongest
   argument for `docs/vision.md` §1.5.
2. **It is a CUTTING split.** Built to hold muscle while dieting to 6 % body fat, not to add it.
3. **Several set counts were never reported** by either source, and the specialty bars he uses
   (transformer bar, cambered bar, CC squat machine) are mapped to the nearest library equivalent
   and noted per exercise.

**Both Israetel systems are kept.** They answer different questions: the Floating Split is what he
really does; Volume Landmarks Hypertrophy is a runnable programme built on the method he publishes
for everyone else. Each summary now names the other so nobody has to guess which is which.

**The `basedOn` distinction survives the correction and was worth having anyway** — a system that
FOLLOWS someone's method is not a system BY them, and that is true regardless of whether a
transcription also exists. What did not survive is the *reasoning* recorded in the file header, which
now says plainly that "no honest source exists" was reached too early. The lesson is written into
`js/preset-systems.js` and `progress.md` §3: **search past the first four queries before inventing a
category to work around a missing source.**

**State at close:** **953 data-layer + 156 render assertions green.** Eight systems, five credited.
Driven over CDP: Explore → the Floating Split → Add → the copied system, which arrives in programme
order (Pull 1, Legs 1, Push 1, Pull 2, Legs 2, Push 2) and opens its workouts intact.

Sources: [RP Strength, Dr. Mike's exact training split](https://rpstrength.com/blogs/video-guides/dr-mikes-exact-training-split-to-get-to-6-body-fat) ·
[BoxLife Magazine](https://boxlifemagazine.com/six-percent-body-fat-training-split/)

---

## 2026-08-17 (later still) — Home knows where you are in your rotation

**Tim:** *"what do you think is the next easiest step in my vision now"* → then *"if you feel like
you have a good idea on what that project entails then you can begin now"*.

Recommended and built the **first half of `docs/vision.md` §1.2**: suggesting which workout to do
next. It was the easiest genuine win in the file because it needs no new science, no new data model
and no research grounding — sessions already store `workoutId` and a date, and workouts started
carrying an `order` earlier the same day, which is the only reason a rotation can be read at all.

**What it does.** Home's big button is the next workout in your rotation instead of a generic "Start
a workout". It finds your most recent session, locates that workout in its system, and offers the one
after it — wrapping at the end, because a rotation's last workout is followed by its first.

```
[ ▶ Pull ]
Next in Push Pull Legs. You did Push 2 days ago.
[ Choose another workout ]
[ Record a benchmark ]
```

**`js/next-workout.js`** — pure, no DOM, no store, and the date is passed IN rather than read from a
clock. Same pattern as `e1rm.js` and `strength-standards.js`, and this has more edge cases than
either.

**The four decisions worth remembering:**

1. **Rotation, not "whichever is stalest".** They agree whenever somebody follows their programme, so
   it only matters when they have not. Rotation wins because the order is what the author wrote —
   Push 1 and Push 2 are different sessions on purpose — and stale-first would chase anyone who
   misses a day into repeating the same catch-up forever.
2. **It never scolds and never refuses.** Train twice in a day and it says "You already did Push
   today — this is next when you are ready". Telling somebody they have trained too much is an
   opinion the app has not earned (Rule 6). Reading their own rotation back to them is not — the
   order came out of their own system.
3. **Silent rather than wrong.** No history *and* more than one system means no suggestion at all.
   Guessing which programme somebody meant to start is exactly the confident-and-wrong this project
   exists to avoid.
4. **A deleted workout does not kill it.** D22 keeps sessions when their workout is deleted, so the
   newest row can point at something gone. It walks past those instead of dead-ending — otherwise the
   suggestion would go permanently silent for anyone who has ever deleted a workout.

The caption is built by the same module that computes the answer, which is the trick D20 used for the
comparison-group caption and for the same reason: a sentence written elsewhere drifts from the thing
it describes and both halves still look fine on their own.

**Deliberately NOT built: the second half of §1.2** — suggesting the weights and reps. That needs the
strength estimator underneath it, and a number the app moved for a bad reason is precisely the failure
`docs/vision.md` warns about.

### A test that was green by time of day

While running the suite, `render.test.mjs` failed on an assertion nobody had touched — and it had
passed an hour earlier. Cause: `startedAt` is a **UTC instant** and `todayISO()` is a **local date**,
and the test compared them. It is 18:05 here (UTC−6), so UTC had already rolled into tomorrow. That
test had been failing every evening after 18:00 and passing again each morning.

**The app is fine** — day logic runs off `startedOn`, which is local, and `startedAt` is never
compared to a calendar day anywhere. The test now asserts what it actually meant: that `startedAt` is
within minutes of real time and did *not* get dragged back to the back-dated day. Written up in
`progress.md` §4, along with the related trap that `new Date('2026-08-17')` parses as UTC and lands a
day early west of Greenwich — `daysBetween()` splits the string instead.

A test that is green by time of day is worse than no test, and this one had been lying for a while.

**State at close:** **982 data-layer + 164 render assertions green.** Driven over CDP at 390 and
1180 px through all four states — empty account, programme added with nothing done, one workout two
days ago, and the end of the rotation wrapping back to the start. Button and caption moved together
every time.

---

## 2026-08-17 (later still) — Set types: supersets, tri-sets and drop sets

**Tim:** *"alright lets start with the set types. Make sure that the display is how we want it and
when the user is creating the workout, it's easy to make the set type different, and then when the
user is actually doing that workout, it's easy to know what to do based on what is on the screen and
it's similarly easy to record."*

`docs/vision.md` §1.5, built. **D23** records the model.

### The thing to understand first: it is two shapes, not three of a kind

"Supersets, drop sets and tri-sets" sounds like three of one thing and is two of two.

- **GROUPING.** A superset (2), tri-set (3) or giant set (4+) is a property of the SPACE BETWEEN
  exercises. Modelled as `group` on adjacent workout exercises.
- **NESTING.** A drop set is a property of a SINGLE SET — take it, strip the weight, keep going.
  Modelled as `drops[]` **inside** the recorded set.

The nesting is the load-bearing decision. `progress.md` §6 already locked "drop sets and myo-reps
count as ONE hard set — else volume totals inflate". Putting the drops inside the set makes that true
**by construction**: every existing path in the app counts `sets.length`, so it keeps counting one,
and nothing else has to learn that drop sets exist. Flattening drops into `sets` would have silently
inflated every set count, every weekly volume figure, and D3 when it lands.

### Building a workout

- A **chip on each exercise** cycles Straight sets → Drop set → 2 drops → 3 drops → back. One tap for
  the thing people actually want; a sheet would have been more explicit and three taps.
- The **link control sits in the gap between two exercises** — "Superset with next" / "No rest — tap
  to separate" — because that is what a superset is a statement about. On a row it would force the
  reader to work out which neighbour it meant. A joined block gets an accent hairline bracket and is
  named for its size. The gap *after* a block's last member renders outside the bracket, because it
  is the boundary out of the block.
- Deleting or moving an exercise out of a superset dissolves it if that leaves one member — a
  one-exercise superset is not a thing, and `normalizeGroups()` enforces it on every read and write.

### Doing the workout

- The runner walks a superset **round by round**: A, B, rest, A, B. All of A and then all of B is not
  a superset, it is two exercises in a row — that is the mistake this feature exists to stop.
- The **banner sits above the exercise name**, because "do not rest after this one" changes what you
  do with the next thirty seconds and the exercise name does not. It says the kind, the round, the
  members with the current one marked, and either "Go straight into the next one. No rest." or "Last
  one in the round — rest after this."
- The forward button reads **"Straight into Overhead Cable Extension"** mid-round and **"Round 2 of
  3"** at the end of one, instead of "Next exercise", which is true and useless.
- **The rest timer does not start mid-round**, and does not start after the top set of a drop set —
  it waits for a drop. Those are the two places the old "log a number → start resting" rule would
  have instructed the user to do the opposite of what the set type means.
- **"Add set" becomes "Add round"** inside a superset and adds a set to every member, because a set
  inside a block is a round.
- A drop set offers **"Strip the weight — add a drop"** — the instruction, not the jargon — and says
  "this counts as one hard set" on screen. Drops render indented under their set with a ↳ and are
  deliberately *not numbered*, because numbering them 2, 3, 4 would teach the opposite of the rule.

### Two bugs found by looking, not by reasoning

1. **The builder was writing into a copy.** It renders from `blocksOf(draft.exercises)`, and
   `blocksOf` maps over the list — so the `item` in a block is a copy. The set-type chip, the sets
   stepper and the notes box all closed over it and did nothing at all. jsdom missed it because the
   first tests read the screen, which re-rendered from the unchanged draft and looked correct. **A
   real mouse click in a browser is what found it.** The builder tests now assert by reading the
   workout back out of the store, and I reintroduced the bug to confirm they fail — a test that
   passes either way is worse than no test, which this project learned twice today.
2. **Drops could wrap onto the line above their set** in the calendar day view, because
   `.detail-sets` is a wrapping flex. Reading order was right and it still looked wrong. Each set and
   its drops is now one run that wraps as a unit.

Also: `normalizeWorkout()` rebuilds each exercise field by field, so `group`, `setType` and `drops`
had to be named there or they would have survived exactly until the workout was next read. Same for
the edit-record form, which rebuilds entries on save — it was silently going to flatten a superset
the first time somebody fixed a typo in one. Both have tests now.

**Presets:** Nippard's Push and Israetel's Push 1 both document supersets and now ship with them
intact rather than flattened.

**Still open:** **myo-reps** — the same nesting shape as a drop set, differing only in whether the
weight comes down, so a label and a rest hint rather than a model change. It matters because *Dr.
Mike's Floating Split* is myo-reps almost end to end and is still shipping with its structure
removed. **Chris Bumstead is now buildable and has not been built.**

**State at close:** **1012 data-layer + 194 render assertions green.** Driven over CDP at 360, 390
and 1180 px through the whole path — build the superset, tap a drop set, save, run it, watch the rest
timer stay put mid-round and start after it, add a drop, then read it back on the calendar and
through the edit form and save unchanged with everything preserved.

---

## 2026-08-17 (last) — Myo-reps, and Dr. Mike's split gets its structure back

**Tim:** *"alright go straight into myo-reps and then review"*

It cost what the previous note predicted: **the same nesting shape as a drop set**, differing only in
what changes between mini-sets — the weight comes down for a drop, the clock runs for ten seconds for
a myo-rep. One label, one rest hint, one default count (3, the low end of the usual 3–5).

**The payoff is Dr. Mike's Floating Split.** It shipped a few hours earlier with a warning saying its
set structure had been stripped out. **11 of its exercises are now marked as myo-reps**, and that
sentence has been deleted from the warning because it stopped being true. A warning that has stopped
being true is worse than no warning.

**Three things changed shape along the way:**

1. **The set-type chip became a sheet.** It was a one-tap cycle while there were two states. At three
   types plus a count it would have taken up to seven taps to get back where you started, so it opens
   a sheet with all three visible. That also bought room to say what each one *is* — "Take the set
   close to failure, rest 10–15 seconds, then squeeze out short mini-sets at the same weight" — which
   is what D8 asks for and what a chip label cannot do. "Myo-reps" is jargon.
2. **The stored key was renamed `drops` → `minis`.** It shipped as `drops` during the few hours when
   drop sets were the only nesting type. Keeping it would have meant every myo-rep set on disk
   claiming to be a list of drops — visible to anyone who exported a backup, and false. `minisOf()`
   reads both keys, nothing writes the old one, and both save paths delete it.
3. **The button is still the instruction, not the technique.** "Rest 10–15 seconds — add a mini-set",
   then "Another mini-set". Never "Add myo-rep", which assumes you already know.

**One bug, caught by the tests immediately:** `openSetTypeSheet` used `setChildren`, which was not in
this file's import list. The click threw and no sheet appeared. The render test asserting the sheet
opens is what said so.

**State at close:** **1023 data-layer + 210 render assertions green.** Driven in a browser: open the
sheet, pick myo-reps, see the count stepper, close, confirm the chip reads "Myo-reps · 3 mini-sets",
run the workout, confirm the instruction says rest rather than strip, add a mini-set, confirm it is
labelled a mini-set and not a drop, and that the whole thing still saves as one hard set.

### Review of the set-type work — six findings, all real, all fixed

Ran a review over both set-type commits. Every finding held up; none were false positives.

1. **`toggleLink` lost an exercise when joining two supersets.** It stamped the new id on the two
   exercises either side of the boundary only, so `[A0 B0 | C1 D1]` became `[A0 B0 C0 D1]` — and D,
   now a group of one, was dissolved. Tapping "Superset with next" between two supersets silently
   un-supersetted the last exercise. It now walks each side's run to its end before merging.
2. **Half a superset could save as a whole one.** `finish()` drops entries with no numbers in them,
   leaving the survivor still carrying `group`; the day view then bracketed one exercise and labelled
   it "Superset" — a false claim about what was actually done. New `dropOrphanGroups()`.
3. **Same on the edit path** — removing one half of a recorded superset left the other claiming it.
4. **"Add round" moved the editing target off the round you were on.** It set `active` to the newly
   added last set, so the next numbers typed landed in a different round from the one the banner
   said you were in — for that member only, desynchronising the block. Now only solo exercises
   follow the new set, which is right for them: adding a set there means you are about to do it.
5. **The progress bar could draw every dot as done.** `renderProgress` ran before `renderPane` did
   the index clamping, so deleting a set that shrank the walk left the bar wrong until the next
   redraw. `renderAll` clamps first now.
6. **A dead button in the superset banner.** The banner listed every member of the block, but a
   member planned for fewer sets has no step in the later rounds — its button computed `to = -1` and
   did nothing, with no feedback. Steps now carry `roundMembers` and the banner lists only those.

All six have tests, and I reverted the source fixes while keeping the tests to confirm they fail
without them — three assertions went red, exactly the ones that should. (The first attempt at that
check stashed the tests along with the fixes and reported a meaningless zero.)

**Worth noticing about the shape of these:** four of the six are the same class of bug — an operation
that changes the *membership* of a group without asking what the rest of the group was pointing at.
Joining, dropping empty entries, deleting an exercise, shrinking the walk. Grouping introduced a
reference between rows, and every reference needs someone to own what happens when the far end moves.

**State at close:** **1032 data-layer + 212 render assertions green.**

---

## 2026-08-17 (last) — Chris Bumstead, the system set types were built for

**Tim:** *"do the chris bumstead now."*

Shipped as `preset-bumstead-8day`, **Chris Bumstead's 8-Day Split**. Nine ready-made systems now,
six credited to real people.

**Sourcing is good by this file's standards:** two published write-ups — Generation Iron and Set For
Set — that agree exercise for exercise, on the same eight drop sets and the same superset.

**This is the one the feature was for.** Eight of its exercises are drop sets, day one closes on a
tri-set (single-leg press → sissy squat → seated calf raise) and day five on a superset (reverse pec
deck → pec deck). Yesterday it would have been a list of the exercises in his programme rather than
his programme, which is why it was on the "cannot ship" list in `docs/vision.md` §1.5.

**Three things stated on screen because they are true and unflattering:**

1. **It is an eight-day cycle, not a week.** Three on, one off, twice through. It drifts across the
   calendar on purpose — `daysPerWeek: 6` is an approximation and the warning explains it.
2. **It is a four-time Mr. Olympia's programme.** The volume, the machine selection and the sheer
   number of drop sets assume somebody whose job is recovering from them. The notes say to run it
   because you want to see how he trains, not because it is optimal for you.
3. **The sources disagree twice**, and both disagreements are recorded rather than smoothed over:
   whether day one ends in a tri-set (Set For Set says yes, Generation Iron lists the three plainly —
   followed Set For Set, on the reasoning that a claim something is *grouped* is harder to invent
   than to omit), and how much of **arm day** is tri-sets (shorter summaries say most of it; both
   detailed write-ups show straight exercises with drop sets — followed the detailed ones, and
   flagged it as the part most likely wrong).

**One thing I got wrong and the test caught:** I wrote "seven drop sets" in the notes and the code
comment. There are eight. The test asserted the count against the data rather than against my
sentence, which is the only reason the number in front of the user is right.

Checked in a browser: the detail screen, then adding it and walking into the tri-set — banner reads
"TRI-SET · Round 1 of 3" with all three members listed and the current one marked, "Last one in the
round — rest after this", and the forward button offering "Round 2 of 3".

**State at close:** **1051 data-layer + 215 render assertions green.**

**What is left in the vision**, for the next session: the **"% optimal" rating** (§1.3) is the big
one and needs `docs/research.md` §6 grounded in primary sources first; the second half of §1.2
(suggesting weights and reps) is blocked on the **strength estimator**, which is still the highest-
value open item in the whole project; social (§1.1) is the hardest thing in the file. Finishing the
**Nippard series** — three of six workouts — remains the other cheap piece of content work.

---

## 2026-08-17 (close) — Doc sweep for a chat reset

**Tim:** *"prepare md files for chat reset"*

Swept the docs rather than appending to them. Six features shipped today and the catch-up files had
drifted in the specific way they always do: each change was recorded where it happened, and the
*summary* claims at the top of each file were left describing yesterday.

**What was actually wrong:**

- **The status paragraph had two whole features missing** — no mention of set types or of Home
  suggesting your next workout. Someone reading only the top of `progress.md` would not have known
  either existed.
- **"Open work" item 3 said the next thing Tim named was finishing the Nippard series.** Six features
  later that was simply false. Rewritten to say what is actually true and more useful: the vision is
  nearly out of *ungated* work — "% optimal" needs research before code, the rest of §1.2 needs the
  estimator, social is the hardest thing in the file.
- **§10 item 4 said "seven systems, four credited" and asked for set types to be built.** All three
  claims were dead. It is nine and six, and set types shipped hours ago.
- **§8 said none of the vision was started.** Three of its five ideas are now built or half built.
- **The decisions table was out of numeric order again** — D23 sat above D22, because a new decision
  gets inserted above a fixed anchor. Exactly the fault the last sweep fixed. Sorted, and this time
  the gap at **D18** is explained in place: it is a *proposal*, not a lost decision.
- **`docs/vision.md` opened with "nothing in it is being built"**, which stopped being true today.
  Kept the rule it was protecting — nobody starts work off that file without Tim saying so — and
  added a state table at the top so the reader can see where all five ideas stand without reading
  three hundred lines.
- **`docs/firebase-setup.md` said Google sign-in was not enabled**, while `progress.md` carried a
  note saying that claim was wrong. **Fixed the source and deleted the note.** A doc that is
  known-wrong with the correction filed somewhere else is worse than one that is merely out of date:
  it teaches the reader to distrust the file instead of fixing it. Its "still not verified" list was
  also a version behind — it claimed no browser had ever rendered the app.

**Also added:** `js/set-types.js` to the file-upkeep table, next to `muscle-evidence.js` and
`preset-systems.js`, because it is the third file whose *header* holds reasoning a future session
needs before touching the code.

**State at reset:** live, everything pushed, **1051 data-layer + 215 render assertions green**. Nine
ready-made systems, six credited to real people. The biggest risk is unchanged and is not a code
problem: **nobody has opened this app on a real phone.**

The highest-value open item remains the **strength estimator and its simulator** — it is what would
turn the two accuracy gaps in §9 from documented into measured, and it sits underneath the half of
`docs/vision.md` §1.2 that is not built.

---

## 2026-08-17 — Phone testing deferred; a read-back of what is left on the vision

Tim, after a catch-up: **"I don't want to work on the iphone for a while, only once we're completely
done with the actual site."** Then: what else is on the vision besides the four items just listed?

**Phone testing is now DEFERRED, not dropped.** Recorded in `progress.md` in all three places it was
being raised — the open-work list at the top, §10 next steps, and §3 NOT verified. The wording
matters and was chosen carefully: the risk is *unchanged*, and iOS Safari, touch targets and the
installed PWA are still unverified and still say so. What changed is only that it is not the next
job and should stop being offered as one. A deferred risk that quietly turns into a closed one is
exactly the kind of drift this project's docs exist to prevent.

**What is actually left on `docs/vision.md`** — three things, and each is gated on something
different, which is the useful part:

1. **Social (§1.1)** — untouched. Hardest thing in the file, the only one that cannot be prototyped
   locally, and the only one that makes other people's data a privacy problem. Collides with **D7**,
   though D7 was about a passive scrolling feed bolted onto a logger rather than what §1.1 describes.
2. **The second half of smart systems (§1.2)** — suggesting the weights and reps. Gated on the
   strength estimator, which is the same thing item 1 of the open-work list is about. Also still
   carries Tim's unfinished note: *"and which one …"*, a second input to the workout suggestion he
   never finished saying. Not guessed at.
3. **The "% optimal" number (§1.3)** — the percentage that lets nine systems in a list be compared.
   Gated on **research, not code**: `docs/research.md` §6 is 🟡 with primary sources not yet pulled.

§1.4 and §1.5 are built. §3 "Not yet placed" is empty.

Told to him in plain terms with no decision codes, per the working agreement.

---

## 2026-08-17 — Social: a plan, and the storage shape that decides it

Tim: **"Lets do the social part now. Make a plan for it and push it."** So: `docs/social-plan.md`,
plan only, nothing built.

**The thing that turned out to decide the whole design** was not a product question. Data is stored
as **one document per collection per user** — `users/{uid}/collections/sessions` holds every session
ever recorded as a single `rows` list — and Firestore grants permission **per document**. There is
no field-level or row-level read rule. So the obvious implementation is impossible: "let Alex see my
workouts" cannot be a permission on that document, because the document is *all of it*, including
the parts deliberately not shared. Building it that way would leave the visibility controls enforced
by the UI, which is not enforcement.

Hence the proposed **D24 — sharing publishes a derived COPY, never widens a permission on the
source.** The private collections stay owner-only forever; the owner's own client computes a
projection holding only what was chosen and writes it somewhere readable. Worth more than mere
necessity, for three reasons that are in the plan: two independent gates (what goes in, who may
read), a blast radius that can be *shown* to the user verbatim rather than reasoned about, and
immunity to the storage shape changing later.

Also proposed: **D25 — social requires upgrading off an anonymous account.** Narrows D12 rather than
breaching it; D12's objection was a signup wall on first open, and this is not first open.

**Tim's four open threads in §1.1 are answered.** Unit of a post = the session, rendered as one line
that expands into its real structure — supersets and drop sets included, which is the payoff of last
week's work and the thing no competitor shows. Mutual connections, not followers, because following
cannot shrink back into mutual and an audience creates performance. Per-person visibility via a small
number of tiers, never per-exercise. And the body map **is** the shareable object, as the profile
rather than as a post — it is a state, not an event.

**On D7.** The recommendation is to side-step rather than narrow: build a connection's **profile
page** and no feed at all. "See what a friend is doing with their workouts" is satisfied completely
by visiting them, it needs no decision on D7, and it defers the collision until there is something
real to judge. Explicitly out either way: likes, kudos, comments, notifications, streaks,
leaderboards — each individually small and collectively the exact product D7 was written against.
Rule 6 also bars comparing two people's raw weights in v1; without body weight, sex and training age
it is an unearned opinion, and the app already has honest machinery for it if it is ever wanted.

**Two things the plan is deliberately blunt about.** Revocation is not retroactive — unsharing
deletes a document, it does not un-see what was already read, and that belongs on screen at the
moment of sharing. And rules testing has to change: today they are checked by hand in the console
playground, and every interesting case in social is a **denial**, which nothing currently available
can assert. That means `@firebase/rules-unit-testing` and the emulator as a test-only dependency —
the same standing as jsdom, not a dependency of the app, which stays build-free.

**Phasing puts all the security first and the UI last:** Phase 1 is rules, the pure
`publishProjection()` and the emulator suite, with nothing on screen. It is buildable now without
either open question being answered.

**Two questions for Tim**, both recorded in `progress.md` §10: profile-first or feed as well, and
mutual or followers. Neither blocks Phase 1.

---

## 2026-08-17 — Tim specifies the visibility tiers, and moves the middle line

Tim, on the social plan: *"For permissions on visibility, i was just thinking like 2-3 options like
'full visibility (workout details, benchmarks/data, etc)', 'mid visibility (only workout details)',
and 'light visibility (only workout titles/dates)'. does that change the plan at all or what?"*

Same three-tier shape the plan already had — but **the mid/full line is cut somewhere different, and
his place is better.** The draft split them on *weights* (exercises and reps at mid, weights at
full). His splits on *session versus analysis*: the whole workout at mid, and benchmarks, muscle map
and progress at full. Adopted.

Three reasons, recorded in `docs/social-plan.md` §3.3.1:

1. **It is explainable in a sentence** — "what I did" versus "how strong I am". "Reps but not
   weights" takes a paragraph, and a control the user cannot restate in their own words is not one.
2. **It falls on boundaries the data model already has** — mid is `sessions`, full adds `benchmarks`,
   `bodyWeight` and the muscle map. Tiers on collection lines.
3. **It needs no field surgery, which is a security property rather than a tidiness one.** The
   draft's mid meant reaching into every set — *and into the `minis` nested inside a set* — to strip
   one field and keep its siblings. §7 of the plan had already named nested mini-sets as the case a
   naive projection builder gets wrong, so the draft was proposing exactly the shape its own test
   list was worried about. His version copies whole objects or omits them, so there is no partial
   object anywhere in the builder and the test becomes an absence check.

**What his cut gives up, and it is written down rather than glossed:** "they can see my volume but
not my weights" — the example in `docs/vision.md` §1.1 — is now not expressible, because volume is
computed from weights and anything showing it puts them back by another door. Recommended taking the
loss rather than adding a fourth tier: the honest reading of that line is that he wanted a useful
middle setting, and "my whole workout, none of my analysis" is one.

**One thing added on top of his three: body weight stays off even at full**, behind its own switch.
It is the most personal number stored and it is not what anyone means by "how strong I am". Letting
it ride along with the strength data because the schema needs it to *compute* strength would be an
accident of storage deciding a privacy question.

Default for a new connection is **light**. The tests changed shape too — the light projection is now
asserted to contain no numeric leaf below the workout name at all, by walking the document, rather
than by listing fields expected to be absent. A list-what's-missing test passes happily when a new
field is added and forgotten, which is how this kind of leak actually happens.

---

## 2026-08-18 — Social Phase 1 built: the security, and none of the screens

Tim: **"alright if you're ready then begin."** So Phase 1 of `docs/social-plan.md` — the half that
decides whether this feature is safe, built before anything that can be looked at.

**Shipped:** `js/social.js` (visibility tiers + the projection builder, pure, imported by nothing),
the new paths in `firestore.rules`, **73 passing assertions** in `tests/social.test.mjs`, and
`tests/rules.test.mjs`.

**Three things in the build worth keeping.**

*The builder is a WHITELIST, and that is a security property.* It names every field that may be
published rather than copying a private row and deleting from it. Deletion fails OPEN — add a field
to a session next year and a delete-based builder publishes it. A whitelist fails closed: the new
field is simply absent until somebody names it. There is a test asserting internal session fields
(`workoutId`, `startedAt`, `isBenchmark`) never appear, and another that an email address handed
*straight into* the builder does not reach the output or survive as text.

*The leak test is an ABSENCE check with a vacuity guard.* The light projection is walked and required
to hold no numeric leaf below the workout name, run against a session carrying a superset, a drop set
and a myo-rep still stored under the legacy `drops` key. But "found no numbers" is also what a walk
looking in the wrong place reports — so the identical walk over the identical sessions at mid must
find numbers, and does: **18**. Without that guard the headline assertion proves nothing.

*Everything in the rules is a denial test.* A rule that permits everything passes every positive
test, so `tests/rules.test.mjs` leads with refusals, including the one that matters most — a
**full-tier friend still cannot read the private sessions document**. That block is a regression test
against the only unacceptable outcome of this feature, which is that adding social widened the old
paths. It also asserts a stranger cannot add themselves to a viewers list, that nobody can list
another person's invites (get yes, list no), and that a claimer cannot extend an invite's expiry on
the way past.

**⚠️ And the honest part: `tests/rules.test.mjs` has never run.** The Firestore emulator exits
instantly on this machine — code 4294967295, an **empty** debug log, and zero bytes on both stdout
and stderr. Ruled out, so nobody repeats it: not the port (python binds fine, nothing is on 8080),
not the sandbox (fails the same with it off), not the path (fails the same from a short local dir),
not the temp dir, and not a broken jar (`--version` and `--help` both print normally — it is only
*serving* that dies). Running the CLI's exact java command by hand, copied out of
`firebase-debug.log`, fails identically. Leading suspect is the JDK: Java 21.0.5 is the only one
installed, and Temurin 17 is the usual recommendation for this emulator. Installing a second JDK is
a machine change, so it is Tim's call.

So the status line is: **rules compile, rules are deployed, rules are untested.** `firebase deploy
--only firestore:rules` validates server-side and reported success, and the diff is purely additive
so the private-collection block is byte-for-byte unchanged — but neither of those says anything about
behaviour. Recorded in `progress.md` under NOT verified rather than anywhere softer. Nothing reads or
writes the new paths yet, so today's exposure is zero, and **Phase 2 does not start until the suite
runs.**

**Caught in passing:** the data-layer suite failed the moment `js/social.js` existed —
`sw.js precache is missing: js/social.js`. A module outside the precache is a module the app cannot
load offline, and D6 says offline is non-negotiable. Added, and the rule is now written into
`progress.md` beside the matching one about `COLLECTIONS` and `knownCollection()`.

---

## 2026-08-18 — The rules suite runs. It was the JDK vendor, not the version

Tim picked "install Java 17" from the three options. That turned out to be the right instinct and the
wrong number, and the way it failed is worth keeping.

**Temurin 17 installed fine and the CLI refused it outright:** *"firebase-tools no longer supports
Java version before 21."* So the emulator was never even reached. But that error is what identified
the real variable — if the CLI demands 21 and 21 was already installed, the problem was never the
*version*. It was the **vendor**. Installed **Temurin 21** alongside Oracle's, pointed `JAVA_HOME` at
it, and the emulator started first time.

**46 rules assertions, all passing** — the first tests in this project that run as somebody who is
not you. The one that matters most is a regression test rather than a new feature: **a full-tier
friend still cannot read the private sessions document.** The single unacceptable outcome of adding
social was that it quietly widened the old paths, and that assertion is what stands against it.

**The bisect was worth more than the fix it was meant to produce.** Chasing some cosmetic evaluation
errors, the `diff().affectedKeys().hasOnly()` line was pulled out of the invite rule to see what it
was doing. Exactly one assertion flipped from denied to **ALLOWED** — *a claimer cannot extend the
expiry on the way past* — and everything else still passed. So that line is provably load-bearing and
the test covering it is provably not vacuous. Both facts are now written into the rule itself, next
to the line, because the project's own standard is that a test which passes with the protection
removed is worse than none.

**Left unexplained and said so:** four denials come back as an *evaluation error* rather than a clean
`false`. All four are correctly denied and the legitimate claim is correctly allowed, so behaviour is
right. Existence and type guards were added for every field the rule reads and three of the four
survived that, so it is not a missing field. Recorded in `docs/social-plan.md` §7.1 rather than
quietly dropped, because an erroring rule is one whose behaviour could depend on operand order.

**The JDK trap is now `progress.md` §0.9**, since it cost about half an hour and presents as a broken
install: on the Oracle JDK the emulator exits with code −1, an empty debug log and **zero bytes on
both stdout and stderr**, while `--version` prints perfectly. The working window is narrow — the CLI
needs Java ≥ 21, the emulator jar needs a JDK that is not Oracle's.

Rules redeployed after the change. **Phase 1 is done: 73 projection assertions + 46 rules assertions,
green.** Phase 2 — display name, the upgrade gate, invite links, per-person tier control — is next,
and still publishes nothing.

---

## 2026-08-18 — The Social tab. Built, and looked at

Tim: *"well lets make a social section on the cite (next to data, workouts, home, etc.) Allow the
user to interact with friends, see their data, etc. all in that one section."*

Phases 2 and 3 of the plan, shipped together as a fifth nav tab.

**The two open questions were answered by building the recommendation rather than asking again** —
mutual friends, and a list you visit rather than a feed. The second is the one that mattered: **D7
never had to be reopened**, because "see what my friends are doing" is delivered completely by
opening a friend's page. No likes, kudos, comments, notifications, streaks or leaderboards.

**What is on screen.** The tab: friends with what each may see, anyone waiting to be added, unused
invite links with a Cancel, one button to invite. A friend's page: their body map in the app's own
art and ramp, their recent workouts one line each opening to the real structure with supersets and
drop sets intact. And **what THEY can see of yours sits at the top of their page**, above anything of
theirs — the thing a person actually wants to check is what they are giving away, not what they are
getting. The picker names all four settings and explains each in a sentence, with the "this cannot
un-see what they have already looked at" caveat right there at the moment of choosing, which is what
§2 of the plan asked for and what a settings page would have buried.

**Three different unavailable screens, not one dead end:** no cloud, no connection, and anonymous
account each say the different thing and each offer the different next step.

**The CDP pass earned its keep.** Every screen was driven at 390 and 1180 px in both themes against a
stubbed facade — no live project touched, no account created. It found two defects jsdom could not
see: friend rows were **underlined** (they are anchors; every other list in the app is buttons), and
the visibility description **clipped to "…your muscle map and your pr…"** on a phone, on the one row
of that screen where the detail is the whole point. The fix for the second was already in the
stylesheet — `.row-sub.wrap` exists precisely for "this is a sentence, not a name". Both re-checked
from **computed styles** rather than by eye.

**⚠️ And a trap worth the note it got in `progress.md`:** the scratch copy ships the service worker,
so the second screenshot run was served the FIRST run's CSS out of cache and showed the bug as still
present after it had been fixed. A screenshot of a stale cache is indistinguishable from a fix that
did not work. Fresh `--user-data-dir` per run.

**Also caught by the existing suite**, exactly as designed: `sw.js precache is missing:
js/views-social.js`. Same guard that caught `social.js` yesterday.

**Green:** 1051 data-layer, 73 social, 46 rules, 225 render (the render suite now covers the Social
screens in their *unavailable* states, which is the path a real person meets on a train and the one
nobody screenshots).

**⚠️ The honest gap, and it is the only thing left: NO TWO ACCOUNTS HAVE EVER CONNECTED.** Every
screen has been driven, but against a stub. The round trip — create an invite, open it as somebody
else, claim, accept, publish, read their page — has run as rules assertions against hand-written
documents, never as the app talking to itself from two sides. That is reviewed code sitting on
tested rules, which is exactly the shape `firebase-backend.js` was in before the 45 live checks
closed it, and it wants the same treatment: two throwaway accounts, then deleted.

---

## 2026-08-18 — The "% optimal" rating: research first, and the evidence backs Tim's warning

Tim: *"let's do the % optimal project now… Understand that this topic is still getting massive
research done on it and a lot of the popular content on the internet is being challenged by studies
and other research. Just because a workout has more time or excersizes doesn't necessarily mean it's
more optimal."*

He was right, and the literature says so more strongly than he put it.

**The central paper** is Pelland, Remmert, Robinson, Hinson & Zourdos, *The Resistance Training Dose
Response*, Sports Medicine, published 4 Dec 2025 — 67 studies, 2058 participants. It is close to
purpose-built for this feature: volume as a **continuous** variable with seven functional forms
compared by Bayes factor, **separate curves for hypertrophy and strength**, and — unusually — it
publishes **efficiency tiers**, which is exactly the give/get question §1.3 asks.

**Four findings that decide the design:**

1. **Frequency has no consistently identifiable independent effect on hypertrophy.** Slope 0.32 %
   [95 % CrI −0.14, 0.82] — the interval contains zero. For *strength* it matters a lot (3.27 %
   [2.74, 3.84]). So training 5 days rather than 3 is not itself better for growth; where the sets
   land is what matters. **A rating that scored days or hours as good would be contradicted by the
   best available evidence** — precisely the failure Tim named before any of this was read.
2. **Hypertrophy follows a square-root curve** — 0.24 % muscle size per set at 12.25 weekly sets —
   with published efficiency tiers: 4 sets is the minimum effective dose, 5–10 is the best value per
   set, and past ~19 you pay roughly 10 more sets per further detectable increment. No plateau was
   found, but few studies went past ~25 sets, and 43+ is flagged as "insufficient data, **or
   potentially less hypertrophy**".
3. **The best-supported way to count a set is `fractional`: an indirect set counts as 0.5.** Strong
   to very strong Bayes-factor support over both alternatives. **This discharges a blocker the
   project has carried since the beginning** — `progress.md` §9 has said for months that
   exercise→muscle must become a weighted mapping before D3. The evidence-backed answer is *binary*
   direct/indirect at 1.0/0.5, which is simpler than the continuous weighting that was assumed. And
   the 0.5 the project had already guessed "without asking" independently matches the best-supported
   method — good, but the authors are explicit that 0.5 "is still an assumption".
4. **The models explain about a quarter of the variance** (R²marginal 22.3 % hypertrophy, 26.1 %
   strength). This is the governing number for presentation: a model explaining a quarter of the
   variance **cannot honestly separate an 83 % from an 87 %**, so the output is a banded range, never
   a point.

**And the variable that matters most is invisible to the app.** Robinson et al. 2024 finds
hypertrophy improves as sets are taken closer to failure, while strength is largely indifferent to
RIR. This app has no RIR field, deliberately (D9). So any rating is conditional on "assuming sets are
taken close to failure" and has to say so on screen. A programme cannot make you train hard.

**The design that falls out** (`docs/optimal-rating-plan.md`): the output is never one number. It is
**result** (% of achievable stimulus, banded), **cost** (days per week, time per session) and
**efficiency** (result per hour) — and hypertrophy and strength are rated *separately*, because the
same programme genuinely differs between them and a blend would hide the trade the user is choosing.
100 % means "the most the evidence supports", not "the best programme in our library", because the
latter would make a user's rating move when we add a system.

`docs/research.md` §6 was 🟡 with a note saying "pull primary sources before building D3". It is now
🟢 with the numbers, the credible intervals and the authors' own limitations, and the old "10–20 hard
sets per muscle per week" band is marked as superseded — it is not a target, it is the middle of a
curve that keeps rising while getting steadily less efficient.

Two questions to Tim, neither blocking Phase 1: one number or two, and what 100 % should mean.

---

## 2026-08-18 — "% optimal" Phase 1: the mapping, and it unblocks D3 as a side effect

Tim ratified both design questions — **hypertrophy and strength rated separately**, and **100 % means
the most the evidence supports** rather than the best system in our library. Both were the
recommendation, so the plan stands as written.

**Built: `js/volume-map.js`** — every one of the 270 exercises mapped to the muscles a set of it
actually works, direct 1.0 / indirect 0.5, plus the published efficiency tiers. 49 assertions.

**This is not `muscle-evidence.js` and the header says so loudly.** They map the same exercises onto
the same muscles and answer different questions: that one asks *how strong is this muscle*, this one
asks *how much work landed here*. Conflating them would be an easy and expensive mistake.

**Three things worth keeping from building it:**

1. **The audit caught an error reading would not have.** A bare `/curl/` rule matched *wrist* curls
   and paid them biceps volume — the elbow does not move in a wrist curl. Found by running the
   mapping over all 270 exercises and printing what fell through, not by review. Both halves are now
   pinned as tests.
2. **Core is measured but excluded from the average**, for a specific reason rather than a squeamish
   one. Face-value set counting is *accurate* for calves — several shipped programmes genuinely score
   zero and that is a true statement about them. It is *systematically wrong* for core, which squats,
   deadlifts, carries and overhead pressing all train without a set ever being logged against it. The
   alternative was to credit compounds with invented indirect core work, which means making up a
   number the literature does not offer.
3. **Olympic and full-body lifts contribute indirect volume only, with no direct muscle.** They are
   limited by technique and power long before a muscle nears failure, and the dose–response evidence
   is built almost entirely on sets taken close to failure. Counting a clean as direct quad volume
   would inflate a CrossFit-shaped programme on evidence that does not cover it.

**Sanity check against the nine shipped systems** — Thurston 147 fractional sets/week, Dr. Mike 116,
Bumstead 99 (correctly scaled down for his 8-day cycle), the Golden Six 29. That ordering is
defensible on sight, and the programme literally designed on volume landmarks hits the minimum
effective dose in 10 of 11 scored muscles, which is about as close to a labelled example as this
gets. Nippard's 77 is understated and the docs say why — only three of his six workouts exist here.

**Two guards from §5 of the plan are now tests:** a fabricated 60-sets-a-week programme must land in
"beyond the evidence" rather than in a better tier, and Bumstead's 8-day cycle must produce *lower*
weekly volume than the same workouts counted as a week.

**And it discharges the D3 blocker as a side effect.** `progress.md` §9 has said since the beginning
that exercise→muscle must become a weighted mapping before weekly-volume-per-muscle could be built.
`weeklyVolume()` is that input, and the target bands D3 needs are no longer a guess either — they are
the published efficiency tiers.

⚠️ **Nothing here is a rating yet.** These are set counts, not a score. A raw total would be exactly
the "more is better" number this whole project exists to prevent. The score needs the dose–response
curves, the ceiling, and the banding — Phase 2.

---

## 2026-08-18 — The rating is on the Explore list

Tim: *"if you're ready, put the rating by the side of the system on the explore workout systems
list."* That needed Phase 2 first — there was no score yet, only set counts.

**Built:** `js/optimal.js` (the dose–response curves and the scoring), and a two-number badge on
every row of Workouts → Explore. 33 new assertions, 234 render assertions.

**The curves are fitted, not chosen.** The paper reports the best-fitting functional form and the
marginal slope at the mean of its data, which pins a one-parameter curve exactly — each constant
carries its derivation in a comment. They are then checked against the *plotted* values as well,
which is the part that matters: **a curve fitted to a slope can match that slope perfectly and still
be the wrong curve.** The hypertrophy model reproduces ~5.8 % at 12 sets and 10.9 % at 42 against
their Fig. 7; the strength frequency model hits 12.72 % and 17.32 % exactly.

**The three refusals are tests rather than intentions:** the same 12 sets spread over 3 days scores
*identically* for growth and higher for strength; 100 sets scores as 42; 83 and 87 both band to 85.

**A real bug the numbers caught.** A system's workout list is a **rotation, not a week**. The Golden
Six stores ONE workout trained three days a week, so counting the list once gave it a third of its
volume and a frequency of 1 instead of 3 — it scored 20 % where it should score 35 %. Push Pull Legs
has the same shape. Found by looking at the output table and thinking "that is too low", not by
review. Bumstead's eight-day cycle now overrides it explicitly with a new `cycleDays` field.

**And a test that was measuring nothing.** The "more is better" guard asserted a ratio "< 1.6",
failed at 1.81, and was comparing against a number picked out of the air. It now measures the clamp
against what the *unclamped* curve would have done — 1.80× versus 3.16×.

**What the library looks like rated** — and the last column is Tim's own example, computed:

- Full Body, 3 Days: **40 % growth, 16.9 growth per hour** — 150 minutes a week
- Dr. Mike's Floating Split: **50 % growth, 5.4 per hour** — 540 minutes a week

Three and a half times the time for a quarter more stimulus. That trade is only visible because
frequency is *not* rewarded, which is the finding Tim predicted before any of the research was read.

**The CDP pass caught one thing jsdom could not:** the rating took width off the metadata line and
clipped it to "Jeff Nippard · 6 days/week · ~75 min…". Days and minutes are the COST half of what
this screen is for — a rating shown without what it costs you is half a sentence — so that line now
wraps. Checked again at 360, 390 and 1180 px.

**On screen the number is not left to speak for itself**, because 55 % reads as a bad mark otherwise:
the list says what 100 % would mean (42 hard sets per muscle every week, which nobody recovers from),
that the ratings assume training close to failure, and that more days is not itself better.

⚠️ Still on ready-made systems only. It would be more useful on the user's own programme.

---

## 2026-08-18 — Rating the user's own systems

Tim: *"Is it possible to estimate the % optimal for workout systems that the user creates themselves,
or is that too much work?"*

Possible, and most of it was already done — the model never cared where a list of workouts came from.
**One thing was genuinely missing**: a ready-made system declares its days per week and a user-built
one does not, and that number is not optional. Three workouts done three days a week and the same
three done six are different programmes.

**The answer was to measure it rather than ask.** The app already has their sessions, so it counts
distinct training days for that system over the last 28 days and divides by the span since the first
session in it. Better than a declared number for the same reason a percentile beats a
self-assessment: it is what they *do*, and it updates when their life changes. Same principle as
`next-workout.js` — read the history, then say what you read.

**It refuses rather than guesses.** Under two weeks of history there is no rate worth computing, so
it assumes one pass per week and *says so*. The rating carries a `basis` of `measured` or `assumed`
and the caption is built by the function that computed the number, so the sentence cannot drift from
the answer.

Caught while building: two workouts logged on one day is one training DAY, not two; and dates compare
as local days rather than parsed, because `new Date('2026-08-18')` is UTC and lands a day early west
of Greenwich — a trap `progress.md` already records twice, now pinned by a test.

**On a seeded three-week Upper/Lower it read "Based on the 12 sessions you have logged in the last 3
weeks — about 4.0 days a week", rated it 40 % growth / 65 % strength, and named the gap: calves.**
That is the useful version of this feature. A rating on a shop window is interesting; a rating on
your own programme tells you what to fix.

Also fixed a scratch-harness bug worth remembering for next time: the CDP seeding script unwrapped
`Runtime.evaluate` one level short, so the page silently navigated to `#/system/undefined` and
screenshotted "That system no longer exists". A seeding step that fails quietly looks exactly like a
feature that does not work.

241 render assertions, 44 rating assertions, all suites green.

---

## 2026-08-18 — …and on the Workouts list itself

Tim: *"That's okay if you keep what you just made, but what I was wanting was that inside the workout
menu, where it has all your workout systems listed, it also shows the % optimal on the side, even if
the user made it themselves."*

Fair — I had put it on the system's own screen, not the list. Both now, same two numbers. A system
with no workouts gets no badge: an empty programme is unfinished rather than bad, and showing it 0 %
would be wrong and discouraging both.

The Workouts list rates every system in one pass over sessions rather than per row, the same way
Explore rates its presets once. The names line wraps for the same reason as Explore — "Push · Pull ·
Legs" is what tells you which programme a row is, and clipping it to make room for the rating would
trade the content for the ornament.

**A scratch-harness trap worth recording, because it cost a screenshot cycle and looked exactly like
a broken feature:** navigating to the SAME hash fires no `hashchange`, so the page never re-rendered
and the shot showed "No systems yet" after seeding three of them. The app's own `refresh()` already
knows this and bounces through `#/blank`; the harness now does the same. Second time this session a
silent harness failure has been indistinguishable from a real bug — the first was a stale service
worker serving old CSS.

---

## 2026-08-18 — Two things Tim caught: a stale deploy, and a real discrepancy

**1. "The percentage isn't in the main list."** It was — it had shipped and was live. His symptom was
the diagnosis: the rating showed on a system's own screen but not on the list, and **both live in the
same file**. So he was running the previous version of `views-workouts.js`, which had one and not the
other.

Cause: `sw.js` is stale-while-revalidate, so the load after a deploy serves the OLD app and the
change appears on the one after. That is the deliberate trade — a hand-maintained cache version can
freeze somebody on a stale build forever, this self-heals — but it is **indistinguishable from a
feature that does not work**, which is exactly how it presented.

Fixed rather than explained away. The worker now compares ETag (falling back to Last-Modified) when
it revalidates, and tells the page; the page shows **"A new version is ready · Refresh"**. Two
details that matter: it **offers, never reloads** — reloading unasked is right almost always and
catastrophic once, mid-set with numbers typed and unsaved — and the worker keeps a **flag** as well
as broadcasting, because the stylesheet and `app.js` are fetched from `<head>` long before the page
has a listener attached, so a pure broadcast would be shouted into an empty room.

`tests/sw-update.test.mjs` proves it end to end: copies the app to a temp dir, serves it over real
HTTP, installs the worker, **edits a file on disk**, and asserts the notice appears — and does *not*
appear on a normal load. 8 assertions. It never touches the repo, which matters when the method is
"modify a source file".

⚠️ And the harness bit back again, third time today: the first version stamped `Last-Modified` with
`new Date()` on every request, so every asset always looked changed, the notice fired on a normal
load, and it read as an app bug. It was a test bug. A real server sends the file's own mtime.

**2. "The percentages differ between Explore and my library."** This one was a real bug and a good
catch. The two screens rated the same programme by different rules: Explore used the programme's
declared **6 days a week**, but `addPresetSystem` never copied `daysPerWeek` across, so the library
fell back to assuming one pass a week. Push Pull Legs is three workouts trained six days — as a
three-day programme it scores far lower.

Copies now carry `daysPerWeek`, `cycleDays` and `minutes`, and the rating has **three bases in
priority order**: *measured* (what you actually do, always wins), *declared* (what the programme says
— right for a fresh copy, and it makes the two screens agree), *assumed* (one pass a week, only for
something typed from scratch). Systems copied before the fix are backfilled from their `presetId`, so
Tim's existing library is corrected rather than only new copies.

Verified by copying all nine presets through the real store and comparing both paths: **all nine
agree**. Tests pin it at both layers — the store carries the fields, and history beats a declaration.

---

## 2026-08-18 — Goals: the research, and the one part that should not be built as described

Tim described a Goals section: 3–5 strength goals, each stating workouts/week, time per workout,
protein per lb and hours of sleep; three-month horizons; the Workouts screen matching a system to the
goal; weights raised automatically in-session to stay on pace; and an on track / ahead / behind
verdict. He asked for real research and for problems to be raised rather than smoothed over.

**It is the most coherent idea in the vision file** — it joins the rating, the systems and
progression into one loop, and every piece has a home already. Three of the four parts are well
supported. Written up as `docs/goals-plan.md`; research appended to `docs/research.md` §6.9–6.11.

**What the research changed:**

- **Protein: 0.7–1.0 g/lb, not 1 g/lb.** Morton et al. 2018 (49 trials, 1,863 participants) puts the
  plateau at 1.62 g/kg = **0.73 g per lb**, with the CI reaching 1.0. So the folklore number is the
  *top of the confidence interval*, not the middle — exactly the sort of popular claim Tim warned
  about.
- **Sleep is thinner than expected.** The mechanism is documented but there is no dose–response
  meta-analysis between hours slept and strength gained. Graded 🟡 against protein's 🟢, which decides
  how firmly the screen may word it.
- **A 12-week gain cannot be predicted for an individual.** Same age, same programme: **0–250 %**
  spread in strength change. Early progression does not reliably predict later adaptation. So a goals
  table promising pounds is a promise the literature cannot support. **But** non-responders are rare
  (82 % robust or excellent responders in one 16-week analysis) and individual responsiveness is
  *reproducible* — so somebody's own history predicts them well even though population data does
  not. That argues for goals as **strength levels**, which the app already computes and already
  adjusts for body weight, sex and age.

**The serious problem — §3.1 of the plan.** *"it will automatically improve your weights in order to
be on progress to meet your goal"* inverts the causality. Load must follow performance and recovery,
not a calendar: somebody who has missed two weeks and is "behind" would be handed **heavier** weights
than somebody on track, when the right response to a lay-off is to come back lighter. Same for the
week they slept badly or were ill. It is the only failure mode in this project that could cause
physical harm rather than just be wrong on a screen.

The fix keeps the feature: progression stays autoregulated from the last session, and the goal
**informs rather than instructs** — "at this rate you land around here by November". Tim's own note
in §1.2 already anticipated the other half: *"silent adjustment is the kind of thing that destroys
trust if it is wrong once."*

**Two smaller ones.** Protein and sleep are invisible to the app, so they can be *conditions* of a
goal but never inputs to the verdict — otherwise a sleep deficit gets blamed on training. And
protein collides with **D1** (diet cut), narrowly: recommending a range is not tracking, which is the
same shape as D15 → D21, but D1 is locked so it needs his say-so.

**And the gate:** "behind" computed off raw session numbers would fire on noise, since a working-set
e1RM moves several percent day to day. It needs the estimator's uncertainty band — and a fourth
verdict, **"too early to say"**. Same estimator §1.2's second half has been waiting on.

---

## 2026-08-18 — Progression, decoupled: Tim's guess was the published rule

Tim agreed progression must have nothing to do with the goal, then asked what system it should
follow, and proposed: add a rep for 2–3 weeks, then add weight and drop the reps back down.

**That is the ACSM position stand almost word for word.** *Progression Models in Resistance Training
for Healthy Adults* (2009): raise the load **2–10 %** once the lifter can beat the target by **1–2
reps on two consecutive sessions** — the "2-for-2 rule". `docs/research.md` §12.

**And "increasing the weight is usually too much" turned out to be literally true, with a number on
it.** The smallest plate is often a bigger step than the evidence recommends: a 5 lb jump is 25 % at
20 lb, 12.5 % at 40 lb, and **only enters the 2–10 % band at 50 lb and above**. Below that — most
isolation work, most dumbbell work, every beginner's compounds — there is no honest load increment
available and **a rep is the only increment fine enough**. Adding a rep to 3×10 at 40 lb is ~3 % more
work; adding 5 lb is 12.5 %. The app should say so when no available jump fits, rather than silently
proposing a 17 % increase.

**He also corrected the plan, and he was right.** §2.3 had concluded from the 0–250 % spread that
goals should avoid numbers. But the same literature says non-responders are rare (5 % poor
responders) and individual response is *reproducible*. His framing — everyone can get stronger,
stalls have practical causes, a target to aim at is not a promise — is the fair reading, and the plan
now says so in §9.

**The best idea in the exchange was his:** a *why progress stalls* section on the goals screen. What
makes it work is the honest split — two causes the app can **measure** (volume under the minimum
effective dose; not training often enough) and four it **cannot** (effort/proximity to failure,
protein, sleep, life). Naming which is which also solves the earlier objection about invisible
factors: they get stated prominently instead of quietly excluded from a verdict.

**And the verdict bar is now explicitly asymmetric**, on his instruction: "behind" fires only when
the estimator's band contains no trajectory reaching the target. Telling somebody they are behind
when they are not is a much worse error than the reverse.

Still gated on the estimator. Everything in this feature is.

---

## 2026-08-18 — Scaling requirements to the goal: right idea, one wrong lever

Tim ratified the protein recommendation and asked for the requirements to scale with ambition —
upper limit of protein and sleep for the most ambitious goal, lower limit for a relaxed one, so the
user can see what they would be sacrificing.

**The intent is the best thing about the goals screen** — it turns a goal from a wish into a trade.
One part of the mechanism does not survive the evidence, and fixing it makes the point sharper.

**Protein is a threshold, not a dial.** Morton et al. found a *plateau* at 1.62 g/kg — intakes above
it produced no additional gains. So "more protein for a bigger goal" would imply exactly what that
meta-analysis disproved, and would be the same shape of error as the "1 g/lb" folklore the research
already corrected.

**But the gradient Tim wants is defensible for a different reason.** The 95 % CI on the *breakpoint*
runs to 2.2 g/kg (1.0 g/lb) — that is uncertainty about where the plateau sits, not a range of
increasingly good intakes. So aiming at 1.0 means clearing the threshold **even if it sits at the top
of the interval, and on the days you fall short**. The upper end buys **certainty and margin, not
extra growth**. Same gradient he asked for, resting on something true.

**Sleep cannot be scaled at all** — there is no dose–response between hours slept and strength
gained, so "8 hours for ambitious, 6 for relaxed" would be inventing a curve. It gets the same
sentence at every level.

**What honestly does scale is a longer list than protein and sleep:** sets per muscle per week
(strongly — a real dose–response with no plateau found), time per session, sessions per week for
strength, how close to failure the sets end, and consistency.

⚠️ **Which makes the trade sharper rather than vaguer.** The real sacrifice for an ambitious goal is
**time in the gym and how hard the sets are**, plus *reliably* clearing the protein bar. "Do you want
to train 5 hours a week to near-failure, or 3 hours comfortably?" is a question a user can actually
answer; "do you want to eat 1.0 or 0.7 g/lb?" was not.

**D26 proposed and ratified in conversation**: the app may RECOMMEND a protein range with its
citation; it may not track food, hold a database, or ask what anybody ate. Narrows D1 the way D21
narrowed D15 — D1's reasoning was about tracking, and none of it applies here.

---

## 2026-08-18 — Sleep, corrected; and a sweep for the chat reset

**Tim was right about sleep and I was too quick.** I had called the evidence thin after a single
search. He said he thought he had seen studies, and a second search found one I had missed:

**Lamon et al., *Physiological Reports*, 2021** — one night of total sleep deprivation cut
postprandial **muscle protein synthesis by 18 %**, with cortisol up and a sex-specific fall in
testosterone. N = 13, randomised crossover. Building on earlier work showing reduced MPS after five
nights of restriction.

So the app can now say something **measured and cited** instead of vague. `research.md` §6.10 is
rewritten and carries the correction openly, including that it was Tim's doubt that prompted it.

⚠️ **The design conclusion does not change**, and that is worth being clear about: total deprivation
is not 6 hours versus 8, and there is still no curve from habitual hours slept to strength gained. So
sleep still cannot be *scaled* by goal ambition — it gets the same sentence at every level. What
changed is that the sentence now has a number in it.

**Then a full sweep for the chat reset.** `progress.md`'s header was still dated 2026-08-17 and
described a project without Social, without the rating, and with an "Open work" list whose items 3
and 4 had since been finished. Rewritten:

- **A new "Open work — start here" section** at the top, ordered, and led by the one fact that
  matters most: **the strength estimator now gates four separate things** — vision §1.2's second
  half, the Goals verdict, and both accuracy gaps in §9.
- **§7 Research** now summarises the four findings from §6 that a fresh session needs without
  reading it, and lists what was added on 2026-08-18.
- **§8** records that the vision is nearly empty, and that **three** of its six ideas collided with a
  locked decision and every one was resolved rather than ignored (D15→D21, D7 side-stepped, D1→D26).
- **§10** gains Goals as item 0, and **Open questions** now separates the two still open from the
  five answered, so nobody re-asks them.
- The file-upkeep table gains `js/optimal.js` and `js/volume-map.js`, with the warning that the
  latter is **not** the same table as `muscle-evidence.js`.

All five suites green at the reset: **data-layer, optimal, volume-map, social, and 246 render
assertions.**

---

## 2026-08-19 — Goals, built

Tim: *"okay I'm ready for you to build the Goals section. Remember this is an entirely new section
displayed next to social, workouts, data, etc."*

**Phases 1 and 2 of `docs/goals-plan.md` shipped.** A sixth nav tab between Data and Social — Goals
is about your own training like everything to its left, and Social is the only tab about anybody
else, so the boundary in the bar matches the boundary in the app.

### What a goal is

**One muscle moving up a strength LEVEL over twelve weeks.** Not "+30 lb on your bench". Individual
change over a 12-week programme runs **0–250 %** for strength (research §6.11), so a predicted number
of pounds is a promise the literature cannot support for anybody. A level makes no prediction at all
— it says what would *count* as hitting the target, and the app already computes levels adjusted for
body weight, sex and age. That answers the second open question in `progress.md` (levels or a rate)
the way the plan recommended, taken without asking under the working agreement.

Two screens to pick: which muscle, then which level. That gives every combination without a
fabricated "3–5 goals" shortlist, and the second screen *is* that shortlist.

### What the screen says

- **What it costs** — hard sets a week on that muscle, sessions, minutes, protein, effort,
  consistency, sleep. Every row carries its source, and the two that are ours say so
  ("Our judgement", "Arithmetic, not a finding").
- **What your training is actually doing** — measured from logged sessions, not from the plan. A
  programme promising 12 sets a week and a history containing 4 give different answers, which is
  exactly the gap somebody asking "why am I not progressing" needs to see.
- **Why progress stalls** — Tim's own idea from 2026-08-18, and the best one in that exchange. Six
  reasons, **two the app can measure and four it admits it cannot**. The split is the whole value:
  nothing here will tell you your training is the problem when it might be your sleep.
- **Programmes that fit** — ranked on what each gives *that muscle*, not on its headline rating. A
  programme rated 85 % for strength is the wrong answer to "I want a stronger bench" if it gives the
  chest three sets a week. Your own systems are ranked alongside the ready-made ones.

### ⚠️ Two things it deliberately does not do, and says so

**No on-track verdict.** That is Phase 3 and it is gated on the estimator. A day-to-day strength
estimate swings several percent on sleep, food and time of day, so a verdict off raw numbers would
tell somebody they were behind because they had a bad Tuesday. The screen states that outright —
a silent gap where "on track" belongs reads as a broken feature, and a guess would be worse than
either. It also sets the expectation Tim asked for: when it arrives it will only say "behind" if
reaching the goal has genuinely become unlikely.

**Nothing reads the deadline to decide a weight.** §3.1 of the plan is the only failure mode in this
app that could cause physical harm — load following a calendar pushes hardest on somebody who has
just missed two weeks. There is a test that fails the moment anything scales a requirement by how far
behind schedule somebody is: two goals with identical numbers and start dates eleven weeks apart must
produce byte-identical requirements. Progression (Phase 4) stays decoupled and is deliberately last.

### Three things the build decided that the plan did not

- **The target weight is FROZEN.** A level is a percentile, and the weight behind it moves with body
  weight, age and the comparison group (D20). Recomputing it would make a goal quietly harder because
  somebody gained four pounds.
- **The ambition bands are anchored, not round numbers.** The dose-response models put a well-run
  programme's strength effect at ~17–20 % over ~10 weeks, so under 10 % is below what they predict at
  the minimum dose, 10–25 % straddles a good programme, and over 25 % is past the average response
  entirely. ⚠️ A consequence worth knowing: one level is a **12–31 %** jump, so from the exact median
  there is **no Steady goal on offer** — the app says Committed rather than inventing a gentler option
  that does not exist.
- **⚠️ Effort does NOT scale with ambition**, departing from §10.4 of the plan. That table is right
  for hypertrophy, but these are *strength* goals and the same paper found strength largely
  indifferent to reps in reserve. Scaling a requirement on evidence that says it does not move the
  outcome is the same error §10.1 caught with protein. So effort is stated once, at every band, with
  the split named on screen.

### Then Tim, mid-build

> *"Right now by each workout system it shows the % optimal for strength and muscle growth. I want it
> to also have 2 numbers that display the workouts per week, and the estimated duration per workout,
> so they get a good summary of the system before they analyze it."*

Done. The badge on Explore, on the Workouts list and on a system's own screen is now **four numbers
in a 2×2 grid** — growth, strength, days/wk, min. A row of four measures ~180 px and would leave the
programme's *name* with half the row on a phone, and Rule 3 says the name is the content.

A ready-made system states its own minutes; one you typed states nothing, so those are **estimated**
from the set count at ~3 min a set — and the cell's title says which, because "~70 min because the
author said so" and "~70 min because we multiplied" are not the same claim. The days and minutes were
also **removed from the Explore row summary**, where they used to be duplicated, which gives that line
its width back. Programme names now wrap rather than clipping to "Volume Landmarks Hypertr…".

### What the browser found that jsdom could not

Driven over CDP at 360 / 390 / 1180 px in both themes, with a real mouse click to set the goal.

- **A multi-word `.tag` split into two pills.** The background and both rounded ends are painted per
  line box, so "grows with the goal" rendered as a chip reading GROWS above a chip reading WITH THE
  GOAL — two unrelated labels. Fixed with `white-space: nowrap` on `.tag` app-wide, and confirmed
  from `getClientRects()`, which is the only thing that tells you a chip occupies two line boxes.
- **A phrase in the numeric column crushed the row.** "Within 1–2 reps of failure" in a column sized
  for "7–10" took 300 px and squeezed the label beside it into a five-word-tall stripe.

And one the unit tests found before any of that: `Number(null)` is `0`, which is finite — so "nothing
recorded for this muscle since the goal was set" would have shown an estimate of **zero** and reported
the whole starting weight as a loss.

### One thing closed on the way past

`progress.md` has warned in prose since the beginning that a collection added to `COLLECTIONS` and
not to `knownCollection()` has every cloud write **denied** while localStorage keeps working —
perfect on the machine it was written on, silently lossy for anyone signed in. Adding `goals` made
that worth closing rather than re-reading, so **there is now a test comparing the two lists**, and it
was mutation-checked: removing `'goals'` from the rules flips exactly that assertion. The rules were
deployed to `fitness-tracker-th`.

**All six suites green: data-layer (1051 + the new collections guard), goals (88), optimal, volume-map,
social, and 280 render assertions.**

---

## 2026-08-19 (later) — the demo account

Tim: *"it's hard for me to really test out the website because I don't personally have very much
information or actual data recorded and it's a lot of effort to do so … a button that says 'view
demo account' which has pre-recorded realistic data for maybe a full year … allow the user to adjust
any of this information however they want, but it doesn't save, and any time they login onto the
demo account it resets back to the default."*

Built. Account → **View demo account**, on every variant of that screen including the offline one,
which is the branch where somebody most wants something to look at.

### The safety model is the whole design

⚠️ **Demo data never touches storage.** While the demo is on, `store.js` swaps its backend for an
in-memory Map — so there is no tap sequence at all (edit a workout, delete a system, import a
backup, "delete all data") that can reach a real record. That is a stronger guarantee than writing
demo rows to a separate namespace and tidying up afterwards, because there is no tidying step left
to fail.

The flag lives in **sessionStorage**, per-tab. That is the safety decision rather than a convenience:
the demo cannot follow you into a new tab or survive closing the browser, so there is no state in
which somebody opens the app tomorrow, sees a year of training they did not do, and concludes their
own history is gone. That failure would be far worse than the feature is worth. A strip across every
screen says what you are looking at and carries the way out.

⚠️ **Social is hard-disabled, and guarded at the write rather than on the screen.** `republish()`
builds a friend-visible copy out of `store.getSessions()` — which under the demo is invented — and
writes it to the real Firestore for real friends. Every social mutator ends in a republish, so it
refuses there; `social.state()` reporting `reason: 'demo'` is the polite half.

### Proved, not asserted

Driven in a real browser with real data seeded first: the demo could not see it, it was still on
disk, renaming a system inside the demo wrote nothing to localStorage, a reload restored the
default, and leaving brought the real account back intact.

### The year took three passes to become a person

The generator is seeded — never `Math.random()` — so "resets to the default" is literal, and a test
asserts the same day builds a byte-identical year with a companion check that a different day does
move it.

Getting the *numbers* right was the actual work, and two versions were wrong in ways worth recording:

- **First pass: an Expert barbell curl next to a Novice bench.** One shared stall rate meant
  isolation work outgrew the compounds — a curl with a five-rep range and a 5 lb step climbs as often
  as a bench with a four-rep range, and 55 → 105 is a far bigger proportional jump than 135 → 185.
- **Second pass: a 295×8 squat after twelve months.** Removing the first pass's destructive deload
  (which had been modelling a deload as a permanent 10 % cut — not what a deload is) unmasked
  compound stall rates that were far too low.

The stall rates are now **calibrated rather than chosen**: derived from how many times each lift
actually appears in the year and where a real lifter would finish. Deloads log lighter without
touching the progression state, which gives the charts their dip and costs nothing.

Two more found the same way:

- **Benchmarks came out below the working sets they were meant to test.** A 3-rep test at 1.12× a
  5-rep working weight estimates *lower*, so the demo's benchmark line would have shown the lifter
  getting weaker every time they tested. Now 1.22×.
- **The goal opened reading "Target reached".** It was built from the best bench e1RM, but the app
  rates Chest from *every* exercise that trains it — and for this lifter the incline dumbbell press
  converts to a higher bench-equivalent than the bench does. So the goal started at 227 while the
  muscle map beside it said 288. It now runs the real ranking pipeline as of the day the goal was
  set, and a test pins the two together.

### ⚠️ And one finding that is about the APP, not the demo

An entirely ordinary demo lifter — 190×6 bench, 245 squat, 305 deadlift, 115 overhead press — reads
**Shoulders: Elite, 99th percentile**, sitting next to a Proficient chest.

It comes from a 55 lb face pull for 15 and a 20 lb lateral raise for 13. Both convert at ratio 0.30,
which is *not* unreasonable at working weights — 40 lb of lateral raise against a 115 lb press really
is about a third. The inflation is entirely in the reps: a 13-rep isolation set extrapolates to a 1RM
far harder than an 8-rep press, so it converts to 250–320 lb of "overhead press" against an actual
145. And `rateMuscle()` takes the best estimate, so the inflated one beats the real press every time.

This is `progress.md` §9's known gap with a concrete case attached, and it now points at two separable
questions: how far an isolation set may honestly be extrapolated, and whether taking the maximum is
right at all when a direct low-rep observation of the key lift exists. Both want the simulator.

**All seven suites green: data-layer, demo (53), goals (88), optimal, volume-map, social, and 292
render assertions.**

---

## 2026-08-19 (later still) — fixing what the demo found

Tim: *"do you wanna try going in depth to fix the bug the demo found?"*

The question worth settling first was **how much of it needed the estimator**. `progress.md` §9 has
said for weeks that this class of problem "should not be guessed at without the simulator". That
turned out to be true of part of it and completely untrue of the rest.

### What was actually wrong

`rateMuscle()` sorted its candidate observations by **`estimate`** — the converted number — and took
the top three. `evidenceWeight`, the value this module exists to compute, was used only to *average*
the winners afterwards. So the most flattering conversion set the rating regardless of what it was
worth believing.

Running the demo year through the real pipeline made the scale of it obvious:

```
Shoulders  295lb Elite  99%  1 distinct of 3
   <- Face Pull 50x15 w=0.06 | Face Pull 50x14 w=0.06 | Face Pull 50x14 w=0.06
```

A weight-0.06 face pull beating a weight-1.00 overhead press **benchmark**. A sixteen-fold
credibility inversion — and the file's own comment on the raise rule claimed they were admitted "at a
quality that stops them ever outvoting a press."

⚠️ **And "1 distinct of 3" was true of eight of the eleven muscles.** Every slot filled by the same
exercise on three different days. So the other claim in that file — "averaging across DIFFERENT
exercises is what cancels out error in any one ratio" — had never been true either. Worse, the
`agreement` term was therefore comparing an exercise against itself, finding perfect agreement, and
pushing confidence **up** exactly where there was no second opinion at all.

### Three changes, all restoring stated intent

- **One seat per exercise** in the top three. The representative is that exercise's best showing, so
  the upper-estimator character survives where it belongs.
- **Ranked by credibility, not by size.** Ties break on the bigger estimate, so a better showing
  still wins *within* a level of credibility rather than across it.
- **Depth measured over all admissible evidence**, not over the three that won — its own definition
  is "how much evidence is there", and computing it from the winners never measured that. Somebody
  who has squatted sixty times used to score the same as somebody who squatted three.

None of that needed a number fitted from data. It needed the selection rule to respect the
credibility the module was already computing.

### The result on the same year

| | before | after |
|---|---|---|
| Shoulders | **Elite, 99 %** off a face pull | **Proficient, 71 %** off the overhead press |
| Chest | 288 lb off an incline dumbbell press | 251 lb, led by the bench benchmark |
| Hamstrings | Advanced 88 % off a leg curl | Proficient 68 %, led by the Romanian deadlift |
| Calves | led by a lift dropped six months ago | led by the calf raise they currently train |

Every muscle now sits in a coherent 54–76 % band instead of Elite next to Novice. Verified from
**computed styles**, not by eye: every Proficient muscle paints the identical hue, with chroma
varying by confidence as designed.

### ⚠️ Why 1051 assertions missed it

Every multi-observation test in the suite used three *different* exercise ids with estimates a couple
of pounds apart. Neither half of the fault could show up in that shape. The five new tests use the
shapes real data produces — a low-quality high-rep observation beside a high-quality benchmark, and
one exercise logged on more days than another — and were **mutation-checked**: reverting the sort
line flips exactly those five and nothing else. The mutation run also printed the old answer for the
record: a 145 lb press rated **321**.

### What is still broken, and honestly is the simulator's

The high-rep extrapolation itself is untouched. Three residuals, recorded in §9:

- A low-credibility conversion still **nudges** the number — the face pull no longer sets the
  shoulder rating but still adds ~9 % to it, because the aggregate is a weighted mean and the outlier
  sits at twice the credible estimate. Bounding that means a robust estimator with a tuning
  parameter.
- Where a muscle's **only** evidence is high-rep isolation, the level is still that unshrunk
  conversion. §9's original example — a seated calf raise reading Elite off one set — stands.
- A **single mistyped number** still defines that exercise's contribution. So does a genuine PR, and
  telling them apart needs a model of plausible progression.

**The lesson worth keeping:** the standing position was that none of this could be touched without
the simulator, and a third of it was a sort order. Check which half of a problem is calibration and
which is design before deferring the whole thing.

**All seven suites green: data-layer (1069), demo, goals, optimal, volume-map, social, and 292 render
assertions.**

---

## 2026-08-19 (end of session) — doc sweep for a chat reset

Tim: *"prepare md files for chat reset."*

`progress.md` had gained four features in one session (Goals, the system-badge cost numbers, the
demo account, the ranking fix) and had drifted in the ways that file always drifts. Swept:

**Contradictions found and fixed** — the kind that would actively mislead a fresh session:

- The architecture tree said `tests/rules.test.mjs` was *"WRITTEN, NEVER RUN"* while §3 recorded 46
  passing assertions from it, mutation-checked, on 2026-08-18. The tree was a year behind the truth.
- **Two rows both titled "Ready-made systems"** in the §3 state table, one of which duplicated the
  rating description. Merged into one **system badge** row.
- A dangling *"Two numbers —"* fragment left by the four-number badge edit.
- The header still described the badge as two numbers, and still carried a separate paragraph about
  the cost numbers that repeated it.
- `docs/vision.md` §1.3 had no **BUILT** marker in its heading — the only idea in the file missing
  one — and still contained *"the % optimal number is still not built"*. Marked built, and the
  paragraph struck through in place rather than deleted, per that file's own rule.

**Counts corrected against a real run** rather than from memory: data-layer 1051 → **1069**, render
280 → **292**, optimal 33/44 → **46**. Every `docs/`, `js/` and `tests/` path the file names was
checked to exist — all 30 do.

**One addition worth calling out.** §0 gained a tenth item: *use the demo account, do not hand-seed*.
Every session before today wrote its own throwaway systems and sessions in order to screenshot a
screen, which is slow and produces data far too thin to exercise the charts, the map or a goal. One
sessionStorage flag now gets a full year that cannot touch real storage. It is appended at the END of
§0 on purpose — inserting it at position 7 renumbered the list and would have broken the §0.6, §0.7
and §0.9 cross-references used in four other places.

Also folded in: the estimator item now points at **three** residual gaps rather than two, and carries
the lesson from today — *check which half of a problem is calibration and which is design before
deferring the whole thing.*

**All seven suites green: data-layer (1069), demo (53), goals (88), optimal (46), volume-map (49),
social (73), and 292 render assertions.**

---

## 2026-08-19 — Tim reads one sentence and finds half a programme missing

Tim, catching up, stopped on the open-work line *"finish the Nippard series — three of six workouts
are transcribed"* and asked the obvious question nobody had asked: **why would a push/pull/legs need
six workouts?** Is it two systems blended, or one?

One system. His 2023 series is a **six-day** PPL — Push 1, Pull 1, Legs 1, Push 2, Pull 2, Legs 2 —
and the second of each pair is not a repeat. Different exercises, different rep emphasis. That is
the whole point of the A/B structure: each muscle twice a week without doing the identical session
twice. So shipping one of each pair was never "half the programme"; it was **a different programme**.

**And it was worse than under-shipped.** The system declared `daysPerWeek: 6` while holding three
workouts, so the rating ran the same three twice and the rotation repeated a day that should have
alternated. Nothing failed. The badge was plausible, all seven suites were green, and the screen
looked finished. Tim said to do it "the same as before with online sourcing rather than trying to
read the youtube video", which is exactly how the first three went in.

**The find that mattered.** Working out the episode order from the video dates showed that the
workout shipped as **"Pull" was the second pull, not the first**. Its Fitness Volt write-up (27 July
2023) says only "the most recent issue" and carries no episode number, so it read as episode two
when it was episode five. The real order is Jan / 13 Feb / 24 Feb / 3 Jun / 10 Jul / 7 Aug 2023.
No test could have caught that. Only reading the dates could.

**What went in:**

- **Pull 1** (13 Feb) — lat pulldown to failure with a drop, omni-grip chest-supported row,
  bottom-half pullover, omni-direction face pull, EZ curls, bottom-half preacher curls.
- **Push 2** (3 Jun) — close-grip incline bench run 8 / 5 / 15, machine shoulder press, floor-reset
  skull crushers, bent-over cable flyes, machine laterals at 20, plate front raises, diamond
  push-ups to failure. The best-sourced workout of the six: two write-ups agree set for set.
- **Legs 2** (7 Aug) — deadlift, stiff-legs, leg press, glute-ham raises, slow-eccentric leg
  extensions, calves, roman chair leg raises.

Two exercises were missing from the library and were added with their ranking ratios: **Close-Grip
Incline Bench Press** (0.88 for the grip × 0.85 for the incline ≈ 0.75, at a lower quality because
that product is reasoned rather than measured) and **Bent-Over Cable Fly** (per side, like every
other cable fly).

**Three things stated rather than smoothed over**, following what this file already does for
Bumstead and Israetel:

1. **Sourcing is uneven.** Push 2, Pull 2 and Legs 2 each have two independent write-ups that agree.
   Push 1, Pull 1 and Legs 1 rest on one apiece. The system's own notes say so on screen.
2. **One source disagreement.** Fitness Volt gives Legs 2 four sets of seated calf raises; BarBend
   two seated and two standing. Totals match at four, so the more detailed source won — the same
   call Bumstead's tri-set got.
3. **One modelling compromise.** Pull 1's lat pulldown is two sets to failure plus *one* drop, and
   `minis` plans a drop after every set. The app therefore plans one more than he does, and the
   workout's own note says to skip it.

The paid ebook stayed out, and it is worth recording *why that took active effort*: pirated copies
of "The Ultimate Push Pull Legs System" sit on studylib and scribd and rank on the **first page** of
almost every search for these workouts. The file header now names them so nobody treats one as a
source.

**Effect on the badge: none, and that is the interesting part.** It still reads 55 % growth / 80 %
strength. What moved is underneath — chest 10 → 14 sets a week, triceps 24 → 18.5 — because doubling
a triceps-heavy Push 1 had been overstating triceps and understating chest. A banded headline can
sit still while the thing it summarises is wrong.

**New tests, and one is deliberately not about the count.** Six workouts in published order, and
`workouts.length === daysPerWeek` so a system can no longer declare more days than it can fill. But
a count of six is trivially satisfiable by duplicating a day, so the load-bearing one asserts each
A/B pair **shares at most half its exercises** (all three share zero). Plus: the new bench actually
rates a muscle rather than being silently unrankable — **mutation-checked**, removing the ratio line
flips exactly that assertion — the cable fly is counted per side, and the drop set survives being
copied into an account.

Driven in a real browser over CDP at 360 / 390 / 1180 px in both themes, on a scratch copy with the
config blanked and the service worker deleted: all six workouts render, no `.tag` splits across two
line boxes, nothing overflows the viewport, and no "null" text. Explore's row reads 55 / 80 / 6 days
/ ~75 min.

**All suites green: data-layer (1090), demo (53), goals (88), optimal (46), volume-map (49),
social (73), render (292).**

⚠️ **One process note for the next session.** Two `progress.md`-style files were briefly corrupted
by editing them through PowerShell — `Get-Content -Raw` in PS 5.1 decodes as ANSI, so writing back
with `-Encoding utf8` double-encodes every em dash and arrow in the file. Both were restored from
git and redone with the editor. **Do not bulk-edit these docs through PowerShell.**

---

## 2026-08-19, later — Tim asks for a directed multi-agent pass

Tim: *"operate as a director or manager to explore improvements… create 3-7 subagents that
individually work on specific tasks. Communicate with them and make sure each agent knows what the
overall goals are… Come back to me once you don't know what else to work on anymore."*

Five agents, run in two waves, each owning a **disjoint set of files** so they could not clobber one
another. `progress.md`, `chat.md` and every commit were kept by the director. That file-ownership
discipline was the single decision that made it work; the one time two agents did brush against each
other (`js/e1rm.js` mid-edit) it cost the estimator agent a re-run against a pinned copy.

### What shipped

**Body weight into rep normalisation.** Pull-ups, chin-ups, dips and push-ups now rate a muscle. The
research came back with the finding that *no published percent-of-bodyweight figure exists for a
pull-up or a dip* — and the right answer was that none is needed, because in a free hang the hands
carry all of it. Statics, not a citation. Push-ups use 0.75 from two labs half a percent apart, and
the agent explicitly rejected the familiar 64 % figure because those studies measure different
quantities. What has no honest figure stays refused, by name, permanently.

**Goals progression** (Phase 4). Double progression, 2-for-2, smallest increment inside 2–10 %.
`js/progression.js` has no clock and no import from `goals.js`, so the "a deadline may not make this
ask for more" refusal is *structural*. Proven by mutation: doubling the step when a deadline is near
flips exactly the refusal test and nothing else.

**The estimator's Phase 0** — 771 lines of pure maths plus a simulator with a virtual lifter whose
true 1RM curve is known. Bias +0.68 %, RMSE 4.63 %, and measured answers to all three of §9's
residuals.

**`docs/research.md` §6.8 pulled**, all four axes, and it found ACSM had published a **new position
stand in March 2026** — the first in seventeen years — while this project was still citing the 2009
one as current.

**The rating now states what it cannot see**, in words, on screen: a workout stores a set count, not
a weight, so 3×20 and 3×5 score the same for strength. Put as visible text rather than a `title`,
because `title` does nothing on a phone.

### Three bugs, none found by a test

1. **The demo account could open empty.** `MemoryBackend.seed()` set a boolean before its first
   `await`. Third time this project has hit boolean-instead-of-promise.
2. **Progression anchored its rep range on the weakest set.** Reps fall across sets, so a lifter who
   had just pressed 190 for 6 was told the weight moves "once you hit 5". Found in a browser; 150
   assertions and jsdom had passed over it.
3. **A "log a weigh-in" message that could never render**, because the map refuses to draw without
   one. Dead UI, removed.

### Director's notes, for whoever runs this next

- **The briefs mattered more than the tasks.** Every agent was given the project's actual standard —
  never overclaim, state what is unverified — and every one of them came back with an honest
  "cannot be done" somewhere. The estimator agent reported that high-rep shrinkage *cannot be fitted*
  rather than fitting it badly; the body-weight agent refused to invent a fraction for assisted
  machines. That is the behaviour worth reproducing.
- **Two agents improved on their brief and said so.** I told the rating agent to clamp per-session
  volume at 24 rather than the literature's 11 because 11 rests on a preprint. It found the stronger
  reason: **at 11 the clamp becomes a frequency reward**, because a real programme crosses it — which
  would break the rating's oldest refusal. And the progression agent replaced my "pass no goal" brief
  with a module that structurally cannot receive one.
- **Correcting an agent mid-flight is worth doing.** Three steers went out and each changed the
  output: don't chase a pull-up citation, don't mix two anthropometric tables, and close the lay-off
  gap with a clock that may only ever *withhold*.
- ⚠️ **Never trust a screenshot without checking what the server is serving.** A whole verification
  pass came back clean against what turned out to be a **directory listing** — four stale
  `python -m http.server` processes from earlier in the day were squatting on ports. The symptoms of
  "no overflow, no split tags" and "nothing rendered at all" are identical. Assert something POSITIVE
  about the page before believing anything negative about it.
- ⚠️ **`location.hash = '#/data'` reports the new route without re-rendering** in this headless
  build, and the real Data route is `#/graphs` anyway. Click the actual nav element instead. A
  screenshot of the previous screen is indistinguishable from a feature that failed to ship.

**2075 assertions across nine suites, all green.**

---

## 2026-08-19, later still — a review wave that never came back

Tim: *"keep working. Make a large plan on what you want to do for improvements, and make sure you go
back and review all the stuff we've built and think of any problems or errors we might've made…
Think about human behavior and the design of the website as well as advantages or disadvantages with
our website. Compare it to other websites."*

Seven reviews were scoped and briefed — adversarial code review, human behaviour/UX, competitive
refresh, cross-screen consistency, accessibility, edge cases and data integrity, and the live social
round trip. All read-only, so they could run together safely.

**Every one of them was killed by a session usage limit before returning a finding**, along with the
sub-agents several had spawned. What arrived was fragments of their working notes, not results.

**Nothing from that wave was treated as a result**, and `docs/improvement-plan.md` says so at the
top and marks every unaudited section. That mattered more than usual here: the fragments *read* like
findings, and it would have been easy and wrong to write them up as though they were.

### The one thing recovered, and why it was worth checking

One fragment was specific enough to chase by hand: *"The Home CTA 'Create your first workout' lands
on 'No systems yet'."* Checked directly — and it was **half wrong**, which is the reason for
checking. The Workouts screen is not a dead end; "New system" and "Explore ready-made systems" sit
in its `top` region above the empty state.

The real defect is a **promise/destination mismatch**. The button says *workout* and the destination
talks about *systems* — a concept that exists for the app's benefit (D22: a workout belongs to
exactly one system) rather than for the newcomer's. Install to first logged number is about a dozen
steps, and D4 says the logging loop is the only thing apps beat spreadsheets at.

Recommended fix, in `docs/improvement-plan.md` §1.1: **make Explore the primary first-run action.**
One tap to a complete programme, and it teaches what a system is by example instead of by
explanation — D8 exactly. Not built; it is a UX change Tim should see before it ships.

### What is now written down

`docs/improvement-plan.md` — the plan, with the seven review briefs recorded verbatim so they can be
re-run without re-deriving them, a ranked list of where problems are most likely (a **fourth**
single-flight bug is the top suspicion; today's contribution-cache bug was that same shape), and the
order: verify what exists, fix the newcomer, finish what is half-built.

Two questions were put to Tim and are open: **ratify D18**, and **is "a reason to come back
tomorrow" a goal?** The app is deliberately free of streaks, badges and nudges, which is defensible
— but it means retention rests entirely on the analysis being worth returning to, and that should be
a decision rather than an accident.

### For whoever picks this up

- **Re-run the seven reviews first.** They are item 0 in the plan and item 0 in `progress.md`'s Open
  work. Accessibility in particular has never been audited once, and nothing written on 2026-08-19
  has been attacked by anyone trying to break it.
- ⚠️ **A usage limit kills subagents mid-flight and their notifications look like completions.**
  Read the `status` field, not the trailing text. A terminated agent's last line is whatever it
  happened to be thinking about, and it reads exactly like a conclusion.

---

## 2026-08-20 — "catch up with progress.md / try again"

Tim asked to retry the thing the usage limit killed: the seven-review re-run. **Run serially by
hand rather than as a seven-agent wave**, on the grounds that the wave is what died last time and
returned nothing at all. Two reviews completed, both found something real, both fixed.

### ⚠️ Progression destroyed the rep range it had just told you to use

The one bug in this app that could have handed somebody a weight they should not have been given.

`REP_BANDS` share their boundaries — 8 tops 6–8 *and* bottoms 8–12; so do 12 and 15 — and
`repRangeFor()` resolves a boundary **downwards on purpose**, so somebody running 3×8 earns a load
increase at 8 rather than being marched to 12 first. That is correct for reading a session cold and
wrong the instant the app itself produced the session:

```
  "+5 lbs and back to 8 reps"      ← said with range 8–12
  next session, 8 reps read cold   → range 6–8, already at the top
  two sessions later               → +5 lbs again, back to 6 reps
```

Driven as a closed loop — suggest, obey, feed it back — a lifter starting at **185 × 10 in 8–12
ended at 200 × 6**, taking weight every second session instead of walking the range. Roughly twice
the rate double progression prescribes, from the module whose header says it errs small on purpose.

**Not one of 197 assertions could have caught it, and the reason is worth more than the fix.** Every
test handed the module a history written by the test. **None played the module's own output back
into it.** A rule that consumes what it produced needs a test that closes the loop; there is one now,
and anything else in this codebase of that shape wants the same.

Fixed with `trainingRange()` — read the range across recent history, not from the last session.
⚠️ **The safety argument is structural, not a claim:** `REP_BANDS` tops rise, so history can only
widen the range *upward*, and a wider range makes the top harder to reach and drops the reps less far
when it is reached. The fix **cannot** propose a heavier weight than the old code did, only withhold
one — the same asymmetry the lay-off rule has, and swept over every weight, rep count and prior
session to prove it. Mutation-checked: reverting to one-session reading flips exactly three
assertions.

Stated cost, not hidden: somebody genuinely switching from 12s to triples is held in their old range
for a few sessions. That is the cautious failure, and it is the one to have.

### The Goals matcher showed a strength percentage with no caveat

Every row of *Programmes that fit* prints `…% strength` and a weekly set count — the same figures
Explore and the system screen show — and carried **neither** caveat. The strength one was absent
outright; the fractional-sets one was a hand-written paraphrase of `INDIRECT_NOTE` that had already
dropped *"not a measured fact"*, which is exactly the drift that file's header warns against.

`INDIRECT_NOTE` is now a shared stem plus a per-screen consequence clause — "would drop these
percentages a band" is meaningless beside a figure that is not a percentage, which is *why* somebody
paraphrased it rather than importing it. Both variants ship from the module beside the constant they
describe, both imported statically, both held to the same bar by a test.

### Checked and closed rather than found

- **The suspected fourth single-flight bug.** The contribution cache already carries body weight in
  its key.
- **The per-session clamp.** It lives inside `weeklyVolume()`, so the badge, the Goals requirements
  and the Goals matcher all get the clamped number.

### Still open — five of seven

UX / human behaviour, competitive, **accessibility** (never done once, and now the only review with
no evidence behind it at all), edge cases / data integrity, and **the live social round trip** —
still the single most valuable, because it is the only one that turns a large built feature from
reviewed code into verified behaviour.

---

## 2026-08-20, later — the accessibility audit, run for the first time

Third of the seven reviews. This file and `progress.md` have both said in capitals for weeks that
nothing here had ever been checked for accessibility. That is no longer true, and **what ran
failed.**

`tools/a11y-audit.mjs` drives a real browser over **44 screen/width/theme combinations** — eleven
routes, 360 and 390 px, both themes, on the demo account — and measures **2272 rendered controls and
4764 text elements**, taking each one's contrast against *the colour actually painted behind it*
rather than against the colour it was supposed to be on.

### `--ink-faint` failed AA everywhere it was used, in both themes

3.94:1 dark, **3.05:1 light**, against the 4.5:1 AA wants for text under 18.66px — and all 75 uses
of that token are under 18.66px. It carries `.field-help` and `.req-source`: **the caveats and the
citations.** The load-bearing honesty this whole app is built on was the least readable text on the
screen. 28 class/theme pairs failed; **now 0.**

⚠️ **This project had already found it once and fixed one line.** There is a comment beside
`.chart .hover-date` recording the 3.05:1 measurement — written months ago, acted on there, and the
token left in 75 other places. *Finding a bug in a token and fixing the call site is how a bug
survives its own fix.*

⚠️ And there was no room to fix it cleanly: light `--ink-soft` was only 5.46:1, so an AA-passing
faint landed half a step below it and the two were indistinguishable. **The light palette could not
hold three text levels above AA.** Both moved, solved against `--rule-soft` — the worst surface
either lands on — and re-measured in the browser.

### Every label in the app named nothing

19 `el('label')` calls, **not one associated with its control.** A `.field` puts them side by side,
which is visually right and programmatically silent, so a screen reader announced *"edit text,
blank"* on every form in the app — email, password, birth year, workout name, system name, units.

Fixed with a pass over the mounted tree at the two places anything mounts, **not at the 19 call
sites**. Wiring them by hand fixes today's 19 and nothing about the 20th, and the 20th gets written
by somebody who never read the comment — because forgetting looks exactly like remembering.

### The one that only a browser could find

The calendar's **today** number switches to `--accent` and measured 3.94:1 in light. It appears on
**one cell in the month**. No amount of reading the stylesheet would have surfaced it. Moved to
`--ink`; the accent ring and weight-800 already said "today" without colour.

### ⚠️ And the fix broke silently on the first attempt

Touch targets ran 31–36 px — clearing WCAG 2.2 AA (24 px) and missing Apple's 44 — so the hit areas
were grown with a pseudo-element, leaving the painted button where it is. **`::after` collided with
`.avatar-btn.at-risk::after`, the "not backed up" dot, which wins on specificity**, so the hit area
vanished in exactly the state the audit had caught it in. Nothing looked wrong. Re-measuring is what
found it. It is `::before` now. **Verify a fix with the instrument that found the bug.**

### Left alone, on purpose

The inline link "see the chart" is 71×16 and **WCAG 2.2 exempts a target inside a sentence**. And
*Delete this weigh-in* keeps 36 px rather than 44, because a 44 px box would reach over the
neighbouring row and a **destructive** control should not have a hit area extending past itself.

### ⚠️ What this did NOT check

No keyboard path walked, no screen reader run, nothing tested at larger text, and the muscle map's
irregular-SVG tap surface not hit-tested. Contrast, touch targets, accessible names and horizontal
overflow are what it measured, and that is all it may be said to have shown.

Two tests came out of it. `tests/a11y.test.mjs` (22 assertions, no dependencies) pins the palette at
the **token** level; the audit measures the **screen**. Each has now caught something the other could
not — the token test found a latent light-theme pair no screen currently paints, the audit found the
accent number on one cell in the month.

**Four reviews still open:** UX / human behaviour, competitive, edge cases / data integrity, and the
live social round trip — still the most valuable, because it is the only one that turns a large
built feature from reviewed code into verified behaviour.

---

## 2026-08-21 — "make it really good on the iPhone": the first phone-shaped look

Tim opened the phone work and asked for an in-depth look before he starts judging it himself, with
formatting, design and usability emphasised. The 2026-08-17 deferral is over.

A survey, not a build. Driven over CDP at **393×852 and 375×667**, `mobile: true`, touch emulation,
demo account, scratch copy with the config blanked and then pointed at a project that does not exist.
Nothing was fixed.

### The one that blocks the rest

**`#/settings` crashes in the demo account** — `impl.currentUser is not a function`. `auth.state()`
branches on `impl === LocalBackend`, and `MemoryBackend` is neither that nor a remote impl, so it
falls into the cloud branch and calls a method it has never had. Reproduced with the config blanked
and with it present; `#/account`, `#/profile`, `#/social` and `#/goals` are all fine. The demo is the
instrument for looking at every other screen, so a crash inside it is first in the queue.

### The structural one

**Nothing in the app reads `window.visualViewport`.** `#app` is `100dvh` under `overflow: hidden`,
and the iOS keyboard does not shrink that — it covers it. Measured on a 393×852 iPhone with a 336px
keyboard: the visible area ends at **y = 516**, and the session runner's **Next exercise** sits at
789–852. Every *Save changes* and every *Done* is in the same place. The picker is the sharpest case
— 16 filter chips take 142px, and with the keyboard up **3 of 272 exercises are visible**, in a sheet
that auto-focuses its own search box.

One fix, once, in the shell — not per screen.

### The design one

**View and edit are the same screen, and the edit form wins.** Opening a programme lands in the
system EDITOR: name field and notes pinned above (184px), *Save changes* and *Delete system* pinned
below (119px), a 445px pane between them — and **the first workout is 468px down it**. The workouts
you opened the programme to reach are more than a screenful below the fold, behind the rating and
~350 words of caveat. The workout screen repeats it: *Add exercise* ~500px down, last row sliced by
the bottom bar. And a full-width **Delete** sits in the thumb zone of a screen you came to read.

### Smaller, measured

- **"Bar Chart" is clipped** in the Data mode switch (65 vs 62), and with no divider between the two
  unselected segments it reads as *"Graph | Bar Chart Muscles"* — two options where there are three.
- **The calendar cannot land on the current month.** It asks for 4363 and the browser clamps to
  4076, because the current month is the last section and nothing sits below it to scroll against.
  287px short, every visit. The arithmetic is right; the scroller has no room. Trailing space fixes
  it, not new maths.
- The system **Notes textarea clips its own text** (66 vs 90) with no cue under touch.
- **A kg user cannot type a decimal.** Weight gets `inputmode="numeric"` — the digits-only iOS
  keypad — while kg display carries one decimal and steps by 2.5.
- **Two `:hover` rules stick after a tap on iOS.** `.body-region:hover { opacity: .82 }` is the bad
  one: a fade left on a tapped muscle is exactly this app's own encoding for *less sure*.
- The **demo bar takes no `safe-area-inset-top`** — it is prepended above the one element that pads.
- Explore's badge takes ~40% of each row and cuts every description to ~28 characters over 5–6 lines.
- Goals opens on two paragraphs of prose that fill a 667px screen before any number.
- The graph's y-axis carries one decimal — 279.9, 248.1. False precision on a barbell.

### Reasoned, not measured — and marked that way

`navigator.vibrate` (the app's only haptic) does nothing on iOS. No `-webkit-touch-callout` on the
press-and-hold steppers. The picker focuses its search inside a `setTimeout`, which breaks the
gesture chain and probably shows a caret with no keyboard. The runner's `<input type="date">` is
styled with a dashed underline iOS will not honour. **None of these were seen happening**, and a
desktop engine at phone metrics cannot show them.

### What was already right

`viewport-fit=cover` plus the apple meta tags, transparent tap highlight, `touch-action:
manipulation`, `overscroll-behavior: none`, 16px on every control so iOS cannot zoom on focus,
`--safe-b` on the navbar and sheets, and the 44px hit areas from yesterday's audit. The session
runner reads well at both widths.

---

## 2026-08-21, second pass — the phone fixes

Tim asked whether I knew what to do or needed help. Answer was: nine of eleven I could just do, one
needed a phone in his hand afterwards, and one was his call. He took the call.

### His decision: reading is the screen, editing is behind the pencil

Offered three shapes for the system screen and he picked the recommended one. It applies to workouts
as well, so two screens where there was one:

```
#/system/<id>        the programme — its workouts first, then notes, then how it rates
#/system/<id>/edit   name, notes, Save, Delete
#/workout/<id>       what the workout is, and START it
#/workout/<id>/edit  the builder
```

Measured either side of the change on the same phone and the same demo account: **the first workout
inside a programme moved from 468px down a 445px pane to 38px down a 748px one.**

The workout screen gained something it never had — **a way to start the workout**. `#/workout/<id>`
was the builder, so Workouts → my programme → today was the one obvious path that could not begin a
session. And **Delete came out of both pinned footers**; a destructive control under the thumb of
somebody rearranging exercises is a slip, past the end of a list it is a journey.

⚠️ **The first version of the new workout screen printed "Unknown exercise · undefined sets" six
times.** `blocksOf()` yields `{ item, index }` wrappers and I mapped the wrapper straight into a row.
Every assertion I had written for that screen passed over it — they checked that things were present,
not what they said. **A screenshot caught it.** There is now a test that reads the rows.

### The keyboard

`--kb` from `visualViewport`, subtracted by `#app` and the sheet backdrop. One fix, every screen.
Verified by driving the value by hand: the session footer moves 789–852 → **453–516**, exactly
clearing a 336px keyboard, *Next exercise* reachable. The picker sheet ends at the keyboard edge with
Done visible, and its 16 filter chips became one scrolling row instead of four wrapped ones —
**3 → 7 exercises visible with the keyboard up.**

⚠️ **Cannot be verified from here and is not claimed to be.** Headless Chrome has no software
keyboard. Tim has to open the runner on his phone and tap the weight.

### The rest

- Settings crashed in the demo because `auth.state()` knew of two backends and there are three.
  Fixed in `auth.state()`, not with a fourth `demo.active()` guard at the call site — `AccountView`
  and `social.state()` already carry their own, which is exactly why this one went unnoticed. Returns
  `mode: 'demo'`, not `'local'`: a demo session is not saving to this device either. Mutation-checked.
- The mode switch says three options again — content-sized segments, a hairline between the
  unselected pair, 44px tall. Painted 44 rather than the audit's pseudo-element trick, because an
  `overflow: hidden` box clips a pseudo-element grown past its own height and it would have measured
  36 while the rule claimed 44.
- The calendar lands on the current month. It was never bad arithmetic — the current month is the
  last section, so the scroll was **clamped**. It gets exactly the trailing room the shortfall needs.
- Textareas grow to their content, app-wide, from the same mount points as `associateLabels()`.
- kg can be typed — `inputmode="decimal"` on weight.
- Both `:hover` rules behind `@media (hover: hover)`.
- The demo bar pays the top safe-area inset, and the topbar stops paying it twice.
- Axis precision follows the gridline gap, so 279.9 became 280 without a body-weight chart printing
  the same number twice.
- The rating prose has paragraph gaps and sits below the workout list. Nothing hidden or shortened —
  on a phone those caveats are load-bearing, and a disclosure is how a caveat stops being read.

2141 assertions green, plus the service-worker test.

**Left:** the device confirmations, Explore's badge squeezing descriptions to ~28 characters, and
Goals opening on prose instead of a number.

### And the last two, same session

**Explore's badge dropped to its own line** below 700px. Usable text width 200px → **338px of 393**,
and the summaries went from five or six 28-character stubs to three real sentences. The 2×2 grid was
right when the alternative was four cells beside a name; there is just no arrangement of four numbers
that leaves a sentence room on a 393px screen while sitting next to it.

**Goals leads with the goal.** The two paragraphs about the missing verdict sat third and filled an
SE screen — a goal opening on an explanation of what the screen does *not* say. Moved down to sit
with the other honest limit, the one about weights. Not hidden, not shortened, no disclosure. *What
this asks of you* now starts 325px into a 445px pane on the smallest phone. Its closing line said
"everything below is measured rather than judged" and now says "every number on this screen" — a
caveat that survives a move but stops describing anything is worse than one never written.

---

## 2026-08-21, third pass — Google sign-in on the iPhone

Tim, from a real device: *"when I try signing in with google, it opens a popup for a second, and then
quickly closes it and nothing happens."* The first bug report this project has had from hardware, and
it landed on the exact path §9 has called the riskiest untested one.

### The root cause is not code

The app is served from `timothyhadfield.github.io`; `authDomain` is `fitness-tracker-th.firebaseapp.com`.
Different origins — and Firebase's own guidance says the auth handler needs cross-origin storage that
**Safari 16.1+, Firefox 109+ and Chrome M115+ all block**. Safari 16.1 is from 2022, so that is every
iPhone there is. All five of Firebase's remedies are outside this repo, and the project is already on
the one they recommend (popup).

The real fix is awkward and I have not started it: the auth handler has to live at the domain ROOT,
and the app is a GitHub *project* page, so `/__/auth/handler` belongs to the `timothyhadfield.github.io`
user-page repo — a different repository, shared with every other project on that domain, plus a
`.nojekyll`. Worth doing only if Tim wants Google specifically; **email sign-in works on iOS today**.

### Three code faults met at that symptom, and all three are fixed

Only the first is about Google.

1. **A hung promise left a dead button.** The popup's promise on iOS can simply never settle. No
   throw means no catch, so `run()` awaited for ever and the button sat on "Opening…" with no toast
   and no fallback. That is the literal "nothing happens". There is a patience timer now — and it
   **races the UI, never the sign-in**, because a real sign-in behind two-factor takes minutes and
   cancelling one on a timer would be worse than the bug. Mutation-checked.
2. **Every failure was a 2.4-second toast**, which on a phone is indistinguishable from nothing. It
   is a permanent line now, and it prints the Firebase error code — everything above is inference
   about a device I cannot run, and the code is the only fact available.
3. **The escape hatch could not work.** "Continue in this window instead" is `signInWithRedirect`,
   the exact flow the cross-origin authDomain breaks. The route this file called "the one that always
   works" was the one guaranteed to fail on his phone. It is offered only where it can finish now,
   and `prefersRedirect()` no longer sends an installed iOS app to it — that was choosing between a
   route that might fail and one that cannot, and picking the second.

Asserted on origins, never on a browser sniff: the list of browsers that partition third-party
storage only grows.

⚠️ **None of this makes Google sign-in work on the iPhone.** It makes it fail honestly and makes the
next report diagnostic. 2145 assertions green.

---

## 2026-08-21, fourth pass — the first run

Tim asked what to work on. Recommended the first-run path and took it: it is the one thing standing
between this app and anybody who is not him, it is squarely the phone thread he opened, and the
morning's restructure had already built most of what it needed.

**The defect:** an empty account said *"Create your first workout"* and landed on a screen whose
actions are *"New system"* and *"Explore ready-made systems"*. Promised a workout, delivered a
system — the app's own word for its own convenience — and a stranger had to learn it before logging
a set.

**The fix is not to remove systems, it is to stop making anybody read about one.** Explore leads on a
first run, so a programme is one tap and it teaches the idea by example rather than by explanation.
Everything downstream already worked: copy a programme in and `suggestNext()` returns `isStart`, so
Home's next paint says "▶ Push 1 · First workout in Ultimate Push Pull Legs".

Walked on a brand-new account at 393×852 with real mouse events:

```
1  Pick a programme          → Explore
2  Ultimate Push Pull Legs   → the programme
3  Add to my systems         → the copied system
4  Push 1                    → the workout
5  Start workout             → the runner, steppers live
```

**Five taps from cold install to a loggable set**, against about a dozen.

Also: "Record a benchmark" is gone from the first run — it asks somebody who has never trained to
record a maximum — and so is the "Recent activity" heading, which was standing over an empty list.

⚠️ **The old test was green over this the whole time**, because it asserted the screen said "Create
your first workout" — the exact string that was wrong. It pins the property now: one tap from a real
programme, the word "system" absent from the first screen, and the destination asserted by driving
the tap rather than reading a label.

---

## 2026-08-21, fifth pass — the body map stops moving

Tim, from the phone: tapping a muscle shrank the figure and pulled it upward to make room for the
words, disconnecting the arms from the body. "I don't want to ever move the body (in direction or
size), so to make room for the words, just make way less words on the bottom."

**Rule 3's corollary already said this, and the phone never obeyed it.** "Content must not shrink
because you asked it a question" was written for this exact screen. The desktop honoured it — a side
column, so the figure keeps its size. On a phone the panel stacks underneath and `.body-wrap` was
`flex: 1`, which is the instruction *give up whatever the thing below you needs*. A rule kept in one
layout and broken in the other is not a rule, and nothing was comparing the two.

Fixed 57 % for the figure; the panel takes what is left and scrolls inside it. Measured tapping
Quads: 393×852 `{x:14, y:176, w:365, h:348.3}` before and byte-identical after; same on the SE.
⚠️ jsdom cannot check this — no layout, so every rect is zero. It needed a browser.

### 18 words

Cut entirely: the seven-row per-level target table (six rows are levels nobody is near, the seventh
is what the to-next bar already says), the confidence bar (D19 already paints confidence as the
muscle's own fade — a second bar drew it twice and competed with the to-next bar), the confidence
percentage, and "newest N days ago".

Cut as a repetition rather than a claim: the panel's restatement of the comparison group. D15 still
holds and is still said — by the header, which is fixed and on screen whenever the panel is.

⚠️ Kept, one line each: every caveat, the corroboration and the source set. **Shortening a caveat is
allowed; softening one is not.** None of them lost a claim.

There is a word count in the tests now. Everything else asserts something is present; the failure
being guarded is accumulation, which no presence check catches. Cap 40, currently 18.

333 render assertions green.

---

## 2026-08-22 — end of session, prepared for a chat reset

Swept the docs for staleness and contradiction rather than appending to them. What was wrong:

- **Test counts were stale in five places** — 2141 total against a real **2156**, data-layer 1098
  against **1103**, render 316 against **333**. The two new `redirectCanComplete`/`prefersRedirect`
  assertions and the muscle-panel ones had never been counted back into the table.
- **The header and Open work contradicted each other on the reviews.** The header said three had run
  and four were outstanding; Open work still said two ran and five were outstanding, listing
  accessibility as unaudited — which the 2026-08-20 audit had already disproved in the same file.
- **§3's Muscles row described the panel that was deleted the day before** — "tap → level,
  percentile, progress bar, all seven per-level weight targets" — and claimed picking a muscle never
  resizes the body **only on desktop**, which was the exact defect Tim reported.
- **§10 item 2 still read "DEFERRED — Tim, 2026-08-17"** for the phone work Tim reopened, and told a
  fresh session it "should stop being offered as the next job". It is the live thread.
- **§10 item 1 called the simulator's Phase 0 the highest-value thing left.** Phase 0 is done.
- The Muscles row had two copies of the same sentence about credible evidence, from separate edits.
- `docs/strength-map-plan.md` Phase 4 still specified the per-level target table as work to do. It
  was built and then cut; the row now says so, so nobody rebuilds it from the plan.

**The README was the worst of it, and it is the public front door.** It said *"no accounts"* and
*"your data stays in your browser"* — both untrue since Firebase went in, and the second is a claim
about privacy, which is the kind you do not get to be casually wrong about. It also still described
Firestore as *"written and waiting"*, listed 265 exercises against a real 272, and did not mention
systems, the body map, Goals, Social, set types or the demo account — most of the app. Rewritten,
with a **Your data** section that says plainly what leaves the browser and when.

Promoted into §3 NOT verified, because it was only living in Open work: **the keyboard fix is
shipped and unproven.** It is the largest structural change the phone work made, no test in this
repo can see a software keyboard, and green tests must not be allowed to launder it.

Added a second **open question for Tim** — whether the auth handler may go in his user-page repo,
which is the only real fix for Google sign-in on the iPhone and the reason it has not been started.

State at close: **2156 assertions green across ten suites**, everything pushed and live. Two
questions waiting on Tim, and one ask that is not a question: **tap the weight in the session runner
on your phone and see whether "Next exercise" is still reachable.**

---

## 2026-08-22 — a real iPhone, and both open questions answered

Tim, catching a fresh session up, brought the two answers this project has been waiting on:

> *"next exercise is still reachable, as well as the exercise picker. Google sign-in actually works
> now."*

Asked which surface, since the claim depends on it. **The app installed to his home screen** — he
has no native build, so that is the installed PWA, which is the path the docs have called the
riskiest untested one in the project.

**Both closed, and one of them says this file was wrong.**

The **keyboard fix is verified**. `--kb` shipped unproven because headless Chrome has no software
keyboard and `100dvh` does not shrink for one, so it had only ever been checked by driving the
variable by hand. A phone confirmed both cases the survey named — the session runner's *Next
exercise* and the exercise picker, which was the sharpest case in the whole survey.

**Google sign-in works, and the 2026-08-21 write-up got two things wrong.** It said in capitals that
none of the three fixes would make it work. It did work, and the mechanism is the part that was
filed as a footnote: `prefersRedirect()` used to return true for an installed iOS app, so the PWA
went straight to `signInWithRedirect` — the one route a cross-origin `authDomain` genuinely cannot
finish. Taking that away left it on the **popup**, and the popup works there. The false premise
underneath it — *"popups are blocked in an iOS home-screen app"* — was written in three places and
is what made the code choose the broken route in the first place.

What did **not** change, and was corrected carefully rather than relaxed: the storage-partitioning
analysis still holds, `redirectCanComplete()` is still right, and *"Continue in this window
instead"* still must not be offered where it cannot finish.

Swept it through `progress.md`, `docs/firebase-setup.md`, `js/firebase-backend.js` and
`js/views-account.js`. The wrong reasoning is struck through and kept beside the correction rather
than deleted, because the wrong premise is why the code did the wrong thing for months.

One behaviour change fell out of it. After a failed Google sign-in the screen said *"Google sign-in
does not complete in this browser"* — a **prediction**, and now a demonstrably wrong one. It says
*"That did not complete"* instead. Telling somebody their browser cannot do the thing it just failed
at once is a worse error than telling them it failed.

Two things deliberately **not** promoted on the back of one good report. Whether the picker's
`setTimeout` focus raises the keyboard **by itself** is still unknown — the picker was judged with a
keyboard up, but nobody recorded whether it rose unprompted or after a tap, and those are different
findings. And an ordinary **Safari tab** has not been retried since the fixes, which is probably
where the original bug report came from.

**The auth-handler question is withdrawn.** It was the only real fix for a redirect flow nobody
needs any more, and it would have meant touching the `timothyhadfield.github.io` user-page repo.

State at close: **2156 assertions green** (data-layer and render re-run after the edits), everything
pushed. **No questions and no asks outstanding for Tim** for the first time in a while.

---

## 2026-08-22, second pass — the years view, and three reviews at once

Tim, with a screenshot of another app's workout-history grid: *"I want another way to display the
workout days in Calendar so each day is a tiny box and is colored or not colored depending on if you
worked out that day. This will show years of data in one screen."* Plus: *"if you're confident you
know what to improve then just start working on it, feel free to deploy as many sub-agents as you
need."*

### The years view

`#/calendar` now has a **Months / Years** switch. Years draws one square per day, one row per year,
newest first, with "141 days trained" beside each. Two years of the demo fit in the top half of a
375×667 phone.

It is **binary**, which is what he asked for and also what the numbers allow: the month view's
workout and benchmark colours are ΔE 6.5 apart under protanopia, which the data-viz guidance permits
only alongside a label or a texture, and a 5.7px square has room for neither. The two arguments
agreeing is why it needed no compromise.

Tapping a square **selects** rather than navigates. At 5.7px a tap that navigated would open the
wrong day about as often as the right one, so it fills a readout that holds its row whether or not
anything is picked, and the readout is the full-width control that opens the day. WCAG 2.5.8 is met
by equivalence — every day is still reachable at 40px in Months.

**Two bugs came out of building it and neither was visible to a test.** A bare `1fr` is
`minmax(auto,1fr)`, so the month strip sized itself to its own labels, came out a third wider than
the grid it labels, and put **"Nov" over the 20th of August** — found by asking the browser what
date sat under each label, because nothing about a row of month names over a grid of squares looks
wrong. It was hiding a second fault: the grid was overflowing its pane and clipping ten weeks off
every year. And the mode switch first rebuilt the screen and swapped the node in, which silently
threw away the demo account's "nothing is saved" strip, because `app.js` prepends that into the node
a view returns. **A view does not own the node it returned.**

### Three reviews at once, against this file's own advice

progress.md has said "serially, never an agent wave" since seven parallel reviews died to a usage
limit on 2026-08-19. Tim authorised a wave; three worked, each with a written brief and a list of
files it must not touch. The narrower lesson is now recorded: **seven is what failed, and file
conflicts are the thing to plan for.**

**Edge cases** found a day index floored from local midnight, which collapses a day across DST in any
zone sitting at UTC+0 in winter — two logged sessions counted as one, a 28-day window measured 27.
Fixed. It also found the progression rule ratcheting reps forever on two branches, and a completely
silent failure if a save fails at the end of a workout.

**The social round trip** finally ran against the live project — two accounts, two separate Chrome
profiles. It works, and tier enforcement holds on the wire rather than only in the UI. Expired
invites read as open, because `expiresAt` comes back as a Timestamp and `NaN <= now` is false; fixed.
Disconnect is one-sided while the sheet promises otherwise; reported rather than guessed at. It also
corrected this repo's own docs — the project does not hold zero users and zero documents, it holds
seven and nineteen, two of them Tim's real accounts, and that stale sentence had gone into a brief
for an agent that was deleting things.

**UX** found the best single thing on the list: Goals told a user doing 10.9 sets against a 7–10
target, in bold, **"Not enough sets on this muscle"** — number green beside it, row class already
`is-ok`. The code knew; only the headline had not been told. Rule 6 forbids unearned opinions, and an
unearned negative one is the same fault, on the one screen holding measured proof somebody was doing
the work.

### Fixed after the reviews

The rep ratchet (a ceiling that refuses rather than stepping smaller — and its first version told a
man holding two dumbbells to weigh himself and buy a belt, caught by its own test). The silent save
(said on screen, draft kept, tap again works). The Goals headline. And the demo account writing
drafts into real localStorage — near-harmless, except that a strip on every demo screen says
"nothing is saved", which makes it a false claim rather than a stray key.

State at close: **2252 assertions green across eleven suites**, everything pushed. Six of the seven
reviews have now run and every one found something real. The UX list is the open work, and it is
judgement rather than bugs — the headline item being that **nothing a user can see on Home ever
grows**.

---

## 2026-08-22, third pass — "I can't see where the setting is"

Tim, hours after the years view shipped: *"I can't see where the setting is within the calendar
section that displays every single day like how we talked about. did you get interupted?"*

Not interrupted — and nothing was wrong with the feature. Checked the live site directly rather than
guessing: `js/year-grid.js` answers 200 with the right MIME type, the deployed `views-data.js`
carries the switch, and a clean browser profile pointed at the live URL shows **Months / Years** on
the very first load. His phone was running an older copy and had never been told a newer one existed.

**The update machinery was working perfectly and was never being asked.** Every check hangs off the
service worker's `fetch` handler — it notices a deploy while *serving a request*, which means on a
real page load. An installed home-screen app is **resumed, not reloaded**: iOS hands back the
document that was already open, nothing is fetched, and the worker has no reason to look. The app
can sit weeks behind the live site with every part of the mechanism behaving as designed.

That is the second time a claim about the app updating itself has had a hole in the one case nobody
drove, and both were found by Tim reporting shipped work as missing — the first was the stale load
right after a deploy, back on 2026-08-18. The pattern worth keeping: **a self-healing mechanism needs
to be asked when it heals, not only whether it can.**

Fixed: the page now asks on `visibilitychange` and on `online`, the worker revalidates the shell
against ETag/Last-Modified, throttled to five minutes and silent when offline. It still only offers a
refresh — nothing reloads a page that might have unsaved numbers on it. Tested by deploying a change
to a page that is just sitting there and firing what a resume fires, with **no navigation at all**,
which is the whole point. Mutation-checked.

Told him plainly that none of this reaches the build already on his phone — that copy has no
listener to fire, so he has to pick the new version up once by hand. After that it should never be
necessary again.

---

## 2026-08-22, fourth pass — "it's pretty laggy when I click the bars at the bottom"

Tim asked whether the nav lag was Firebase's free tier or his phone. **Neither**, and the measurement
said so before anything was changed. At 4× CPU throttling in a real browser, building a screen costs
11–72 ms. What each tab actually did was ask the backend for whole collections it had already been
handed: **Workouts 5 reads, Goals 7**, and `sessions` re-fetched by four of the six tabs.

On Firestore every one of those is a `getDoc`, and a `getDoc` **waits for the server even with
offline persistence turned on** — persistence is a fallback for being offline, not a fast path. So a
tab tap cost a network round trip per collection, some serialised: about 400 ms on good wifi and over
a second on cellular, for data already in the page.

`store.js` now keeps each collection in memory. Every tab does **zero blocking reads** after the
first visit, re-measured the same way.

The interesting part was the line the cache may not cross. This store does read-modify-write
everywhere, so serving *those* reads from a cache would mean writing a stale list back over storage
and erasing anything changed on another device. Getters are cached; mutations still read straight
from the backend. `saveSettings` was the single exception and now reads fresh — with an assertion
that flips the moment the hazard is put back, which is what proves it is load-bearing rather than
decorative.

Two things surfaced on the way. `ensureSystems()` was re-reading two collections on *every* call to
re-answer a migration question settled months ago — and it runs on both `getSystems()` and
`getWorkouts()`, so the Workouts tab was paying two round trips for it. A latch was the obvious fix
and the tests rejected it inside a minute: "no orphans, so never look again" is true of a running app
and false of a restored backup, a different account, or a test seeding storage directly. Routing the
*check* through the cache while the *fix-up* still reads fresh is the honest version of the same
saving.

Also warmed all eight collections in one parallel batch after the first paint, so the whole app costs
one round trip of latency instead of one per collection per tab.

2257 assertions green, plus a browser smoke test that walks every tab twice and fails on any console
error.

---

## 2026-08-22, fifth pass — six tabs became five

Tim's design call: five tabs, the middle one bigger and labelled **Record**, Social folded into Home
on the left, Calendar folded into Data on the right, Goals unchanged.

Told him the shape is right, and that the middle button is the part the app's own rules had been
arguing for all along — **D4** says the logging loop is the one thing this beats a spreadsheet at, so
recording training should be the biggest, most central target on every screen. It was two ordinary
buttons partway down Home.

**Record** is the old start picker with the benchmark action folded in and pinned underneath.
`#/start` and `#/benchmark` both still resolve, because "Choose another workout" has linked to one of
them for months and a bookmarked hash must not start 404ing because a tab bar was redesigned.

**Social → Home** behind a You / Friends switch, built as two real links across two routes rather
than a state machine inside one screen — so the back button, a bookmark and a shared invite link all
keep working, and neither screen had to be nested in the other. The screen is titled **Friends** now:
`social.js` is the code's word for the feature, and a person has friends. Five user-facing strings
went with it, because "Social is off in the demo" under a tab labelled Friends is exactly the
"system" vs "programme" fault the UX review found last time.

**Calendar → Data**, so the Data switch is Calendar · Graph · Bars · Muscles. "Bar Chart" lost a word
on purpose: the survey measured the three-segment version clipping that exact label at 393px, and a
fourth segment takes another quarter of the row.

**Three defects, every one found by looking at a screenshot rather than by a test.** The Record label
was clipped by its own circle. The five labels did not share a baseline — every tab centred its own
stack, which is identical while all the icons are the same size and falls apart the moment one is
bigger, sitting the middle word 7px low and making the bigger tab read as a mistake instead of as
emphasis; bottom-aligning them fixed it and it is now measured at three widths. And the You / Friends
switch rendered as two underlined links in an oversized box, because `.seg` was written for buttons
and an anchor is inline. That last one turned out to be live on `.btn` as well, unnoticed — "Leave
the demo" was underlined. Third time this project has met anchor-styled-as-button.

Measured at 360 / 375 / 393: no clipping, no overflow, tabs 72–79 × 54, middle icon 30 against 21,
and every merged tab stays lit on the routes it now owns.

2261 assertions green. Tim said he will keep working on the design, Home especially.

---

## 2026-08-22, sixth pass — "missing initial state" on the iPhone

Tim opened the app and got Firebase's `auth/missing-initial-state` page: *"…2) Using
signInWithRedirect in a storage-partitioned browser environment."*

Checked rather than guessed where that text could come from. **This app never contains that string** —
`requireRemote()` says "Not connected to your account right now", and the router's error box prints
`err.message`. So a raw SDK sentence in front of a user means either the SDK threw into a view, or he
is looking at Firebase's own auth-handler page instead of at the app.

One thing was genuinely wrong on our side. `init()` called **`getRedirectResult()` on every boot**,
and calling it is exactly what asks for the "initial state" the error names. On iOS the sessionStorage
that the redirect flow keeps its state in is partitioned away from this origin, so the question cannot
be answered — and in this configuration it should never be asked, because `redirectCanComplete()` is
already false: the app is on github.io, the authDomain is not, so a redirect could never legitimately
have started and there was never a result to collect. The boot path was asking a question the sign-in
path already knew was meaningless. Guarded on that same predicate, so if the app ever moves to a
domain where redirect works, both halves start working together.

Asserted on the source, because `init()` cannot be unit-tested without the live SDK, a network and a
browser — the same shape as the sw.js precache check. Mutation-checked.

Said plainly what this does **not** fix: a guard added today cannot reach a build already on his
phone, and the likeliest reason he is seeing that page at all is his installed app resuming onto the
auth handler URL from a redirect an older build started. `start_url` is `./index.html#/home`, so a
cold launch goes to the app; a resumed one returns to whatever was last open. Told him to fully close
and reopen, and to re-add the home-screen icon if that fails — and that his training is safe because
he signs in with email, which would not have been true of an anonymous account.

---

## 2026-08-22, close of session — prepared for a chat reset

Tim asked for the md files to be prepared for a reset. Nine passes ran today, so the job was a
staleness sweep rather than a summary — the failure mode this file exists to prevent is a fresh
session reading something that stopped being true hours ago.

**Swept and corrected:** the assertion count in three places (2156 → **2263**, and the README still
said "Ten suites"); the README's calendar line, which predated the years grid; `views-social.js` and
the Social phase-6 note, both still calling Friends "the Social tab"; the architecture tree, which did
not know about the Record tab or that `store.js` now holds a read cache; and the §3 rows for Calendar
and Data, which still described Calendar as its own tab with a three-way switch.

**Rewrote the two things a fresh session actually acts on.** The header block now leads with the fact
that **Tim may still be locked out** — his installed app was sitting on Firebase's auth handler page
and nobody knows whether the recovery worked — and with the fact that **he has never confirmed seeing
any of today's work**, because his phone served a cached build all day and he reported the years grid
as missing hours after it shipped. Both are things a next session would otherwise waste an hour
rediscovering, and one of them changes how to read his next bug report.

**Open work was restructured** into 0a (is he unstuck and up to date — ask before writing code),
0 (the iPhone thread), 0b (the edge-case review's two remaining findings), 0c (the UX review's list,
with Home at the top and a note that Tim has claimed the design half himself). Reordered so the
numbering matches the reading order, which it did not.

**Two operational lessons appended to §0**, both earned today: the read cache's one contract — the
store is the only writer, so anything seeding storage directly must call `clearReadCache()` and
mutations must read fresh — and *check the live site before reading code*, with the one-line curl that
settled it twice.

Everything pushed. 2263 assertions green across eleven suites.

---

## 2026-08-24 — both blockers closed, by Tim in one sentence

Asked to catch up on `progress.md`, reported where things stood, and asked the one question the file
said to ask before writing any code: is he able to use the app, and is he on the current build.

**Tim:** *"I'm not locked out, I think I just had the wrong URL. I can see the year view now."*

That closes the two things that were blocking every open item — he is not stuck on Firebase's
"missing initial state" page, and he is on a build that has 2026-08-22's work in it.

**What was recorded, and what was deliberately not.** Two claims in the docs were about to be
promoted on the strength of this and neither survives a close reading:

- The **stuck-auth-handler diagnosis** in the ninth pass was never checked against the URL his phone
  actually had. It is a plausible account of a real screenshot and it stays, marked as an
  unfalsified hypothesis rather than a finding. The code fix it came with keeps its own argument —
  asking for redirect state in a configuration where a redirect cannot start was wrong regardless.
- The **resume update check** from the sixth pass is still unverified in the field. He had the wrong
  URL, so opening the right one explains the years view completely on its own; nobody watched a
  resume produce the update offer on a device. It has been seen working only in
  `tests/sw-update.test.mjs`. The first deploy he notices without being told is the real evidence.

The standing rule that came out of the 22nd survives its own trigger and is kept in Open work: **do
not read "I can't see X" as X being broken** — check the live site first.

`progress.md`'s header block is now three items rather than five, with the two closed ones struck
through in place instead of deleted, and Open work 0a is closed.

---

## 2026-08-24, second pass — the app went to a gym, and came back with a bug

Tim trained with a friend and logged the session on his phone. *"For the most part it worked great,
but I did find some areas of improvement."* Four asks. Two shipped the same day; two are design work
with his decisions recorded.

### The one that was a bug

He did assisted pull-ups at 70 lb, at a body weight of 180. Two more good sessions and the app would
have suggested **"+5 lb and back to 6 reps"** — more assistance, an easier set, printed as progress.

The guard against exactly this had been in `progression.js` for weeks, with a comment saying nothing
in the table was flagged assisted yet. True — and `Assisted Pull-Up` was in the library the whole
time, with no fraction entry, so the flag could never be set and the machine fell through to the
ordinary weighted rule. Two green assertions pinned the guard's existence by reading the source.

Recorded as a lesson because it generalises: **a branch no accepted input can reach is not defensive
code, it is a comment that reads like defensive code** — and it stopped both the person who wrote it
and the person who tested it from looking. Six reviews and 2300 assertions had passed over it. Only
using the app in a gym found it.

### The design call, and what it costs

Asked him how far the real number should go. His answer: treat an assisted pull-up as a pull-up with
the assistance subtracted. Said once, plainly, that this means accepting the machine's plate number
as pounds actually taken off him — nothing published maps a stack setting to load relief, and the
linkage is not standardised across brands — then built it under that assumption. The assumption is
priced as the lowest confidence in the fraction table (0.65, below the push-up's 0.70) rather than
written as a disclaimer, so an assisted set desaturates its own colour on the body map and loses to
a real pull-up as evidence. Noted as a known limitation that the error scales with how much help is
taken, and a single confidence number cannot express that.

Admitting it took two lines — a table entry and reading the flag instead of hardcoding false —
because everything else already keyed off that one flag. Adding an Assisted Dip is now a one-liner.

### The convenience that nearly invented training

His second ask was that the first set's numbers carry into the next. The first version filled every
set below on the first keystroke, and two render tests killed it: the app keeps any set with numbers
in it, so logging one set and stopping would have recorded three, inflating volume and the muscle map
with work he had not done. It now fills a set when that set is opened, which is the same thing from
his side and cannot credit anybody for a set they never looked at.

### Two more found by looking at a screenshot

Neither reachable by a test. Every set opens at zero assistance, so the readout's first state was
"your 180 less 0 of help" — arithmetic on nothing, in the one place the app is trying to make an
unintuitive number clear. And the stepper label read "Weight of help", because that slot exists to
say what kind of weight the number is ("total", "per side"). Now "no help set, so this is a pull-up"
and "Weight · assistance".

### The two that are not built

**Swapping an exercise mid-workout** — his call: today only, the saved plan unchanged. Told him where
the cost actually is: supersets, fetching history for an exercise the session did not start with, and
keeping the sets already recorded on the original.

**Joint workouts** — the biggest idea in the list, and built differently from how he described it.
He asked for one phone writing into both accounts; that needs a rule letting one account write into
another's private data, and sessions are one document, so a bad write replaces a whole history rather
than a row. He chose the version where the friend's half is sent and their own app saves it on
accept. Also flagged that switching names has to switch the whole suggestion — two people on the same
workout are not on the same weights — and offered logging a guest with no account, which is the case
he actually hit, because his friend could not sign in.

His friend's sign-in failure is recorded and not chased; he asked to investigate it himself first.
Noted that an ordinary Safari tab is still the one surface no working device has confirmed.

---

## 2026-08-24, third pass — fatigue, and a finding neither of us expected

Tim, from the same gym session: he did assisted pull-ups, then dumbbell rows, then lat pulldowns, and
suspected the app rated his back off the pulldown he was too worn out to load. He proposed weighting
later exercises less, or multiplying their load up, or some combination, and asked for a plan.

Measured his session through the real modules before designing anything. **He is right that
something is wrong and right about which lift led.** Adding the fatigued third exercise moves his
Back rating from 212 lb to 145 lb — down 32 % — and moves his confidence *up*, 0.40 to 0.44. Being
more certain because of a reading you have reason to distrust is indefensible on any view.

**The mechanism is the opposite of the obvious one.** Credibility is `quality × repFactor(reps) ×
recency`, and `repFactor` rewards low reps, because a near-max set is good evidence of a max. A spent
lifter also does few reps. His pulldown scored 0.50 × 0.85 = 0.425; his dumbbell row 0.60 × 0.70 =
0.420. **The fatigued lift led by 0.005, entirely because fatigue held him to 8 reps instead of 10.**
Fatigue does not merely depress a reading — it promotes it. Also corrected two things in his mental
model: the app rates `Back` (keyed on Barbell Row), not "Lats", and it does not consider a pulldown
the most reliable read on his back — the row family outranks it.

**Then every fix I proposed failed on his actual data, which was worth more than the plan.** Dropping
fatigued readings outright gives 115 lb — worse than today — because his only completely fresh lift
was the assisted pull-up, his weakest evidence. So fatigue has to be graded, not a flag. And every
re-weighting variant moves his rating by under 5 lb, while doing the same pulldown *first* moves it by
60. **A fatigued set is missing information, not corrupted information — you cannot re-weight your way
to a number nobody recorded.** That reordered the whole plan: the highest-value item is the app
telling him to do that lift first once, not any correction factor.

Checked the scale before recommending anything be built: across the demo year, **0 of 11 muscles** are
led by a lift that was not that muscle's first of the day, and a graded fatigue term moves all of them
under 2 %. A well-ordered programme never hits this. So it is a safety rail, not a rewrite.

Told him the load multiplier he suggested should not be built: it needs a published decrement in
maximal strength per unit of prior volume, the order literature reports reps at a fixed load rather
than 1RM, and it is the only option that can make a number *bigger* than what was observed. Same wall
as the ACSM order finding — graded 88 %, no effect size — hit from the other side.

And said plainly that the plan does not prove he is stronger than 145. His three lifts imply 115, 229
and 136 lb of barbell row, and the competing explanation is that doubling a one-arm dumbbell row onto
a two-arm barbell row is generous — which has never been checked against anything.

Plan in `docs/fatigue-plan.md`, three tiers, nothing built.

---

## 2026-08-24, fourth pass — the fatigue plan, built and deployed

Tim: *"make a plan and test it out and once you feel good about it deploy it now."* Tiers 1 and 2
shipped; Tier 3, the load multiplier, deliberately not built.

Every observation now carries how much work that muscle had already taken earlier in the same
session, counted with volume-map's own direct/indirect weights and tallied **after** each exercise's
own sets — an exercise does not fatigue itself, and charging it for its own volume would discount the
first exercise of every session. A graded factor discounts it, and the muscle panel says which lift
led and that doing it earlier would read better.

**Tim's session now reads 141 lb led by the dumbbell row at 0.36 confidence**, against 145 lb led by
the fatigued pulldown at 0.44. The check that mattered was the demo year: every muscle moves under
3.5 %, eight of eleven are still led by the same fresh lift, and confidence falls only on the four
muscles trained after compounds. A safety rail, not a rewrite, which is what the plan said it had to
be.

**One rule in my own plan was wrong and its test caught it.** I had written "confidence must not rise
because of a fatigued reading" as an absolute, asserted it, and it failed. A third reading landing
*between* two that disagree genuinely does tighten the picture — his three imply 115, 229 and 136, and
the 136 sits in the middle. A fatigued reading is weaker evidence, not anti-evidence. Replaced with
the property that is actually provable: the same reading taken tired yields less confidence than taken
fresh. The end-to-end rise is now +0.01 against +0.04, recorded as measured rather than legislated.

Both halves mutation-checked: removing the fatigue term flips five assertions, counting prior volume
before an exercise's own sets rather than after flips four.

**Found while driving the browser to look at it:** `#/muscles` is not a route and silently renders
Home — the map is a mode on `#/graphs`. `tools/a11y-audit.mjs` lists `#/muscles` in its ROUTES, so
the accessibility audit has been measuring Home twice and **the body map's panel has never been
audited**. Recorded, not chased.

Told Tim plainly that this does not establish he is stronger than 145 lb — his three lifts still
disagree two-fold, and the competing explanation, that doubling a one-arm dumbbell row onto a two-arm
barbell row is generous, is untouched.

---

## 2026-08-24, fifth pass — the batch

Tim: *"deploy everything you just mentioned and are ready to work on."* Three shipped in one pass;
the exercise swap follows separately.

**The dumbbell row was flattering everyone by 15 %,** and this is the other half of his lat question
— running the opposite way from the fatigue finding. The ratio was 0.85, a reasoned estimate. Derived
properly from published standards, the way the dip and pull-up entries in the same file already are,
it is 0.98. A smaller ratio makes the estimate bigger, so every dumbbell row in the app read about
15 % too strong. His three back readings go from 229/115/136 to 199/115/136: same 141 lb rating,
confidence up from 0.36 to 0.41, because better-calibrated inputs agree better.

Fixed exactly one entry on purpose. Dumbbell bench press is wrong the same way — 0.72 against a
published 0.81 — and moving it alone would leave incline and decline relatively more generous than
flat. The family needs one pass; filed as open work. The wider point is filed with it: a *reasoned*
ratio in that table has now been shown to be 15 % out in the flattering direction, so every entry
without a derivation is suspect.

**Restore from backup could take the app down and asked nobody first.** `{sessions:[{id:'s1'}]}`
stored fine and then killed every screen but Settings. Now every row is checked before any row is
written, so there is no half-restore; `{foo:1}` is refused rather than toasting "Backup restored"
over nothing; and it replaces every collection including the ones the file does not carry, which is
what kills the dangling `systemId` that used to hide a workout forever. It has a confirmation now,
which "Delete all data" two lines below it has had all along, and the sheet names what is in the file.

**The Firestore ceiling doc was wrong by 3×** — ~1,100 bytes a session, not 300, so ~950 sessions
rather than 3,000. Corrected. The "fails silently" half turned out to be half-closed already, because
`finish()` has caught save failures since the 22nd whichever backend threw; what is still open is
that nothing warns as the limit approaches.

---

## 2026-08-24, sixth pass — swapping an exercise mid-workout

The last of Tim's gym asks that was buildable. A quiet **Swap** button beside the exercise name opens
the picker; the saved workout is untouched, which was his call.

The half that mattered was the sets already done. If the machine was taken after two sets, two sets
were done — on the original exercise. So a swap with work logged splits: the original keeps exactly
what was really recorded, and the new exercise is inserted directly after it. A swap with nothing
logged replaces in place, because an empty entry is not a record of anything. Mutation-checked:
making it always replace flips the two assertions about the kept sets.

Inserted after rather than appended, and that stopped being cosmetic the same day — muscleStrength()
now reads entry order to score fatigue, so an exercise dropped at the end of the list would be scored
as though it came last. The kept half leaves a superset, because a group's rounds are walked by
membership and three exercises in a two-exercise round would desynchronise the walker mid-workout.

Two things the tests caught in my own test rather than the code: I asserted "Leg Press" was gone from
a header where the feature itself prints "Swapped in for Leg Press", and I finished a workout without
walking to the end, so nothing saved and four assertions failed on an empty list.

Measured at 360/375/393: the button is 71x44, clear of the library's longest exercise name, no
horizontal overflow.

---

## 2026-08-24, seventh pass — "hard sets", said rather than silently corrected

The last of the batch. "Hard set" is the unit the whole volume model rests on, it was never defined
anywhere in the app, and the app counts something slightly different from what the research counted:
the target is in hard sets, `weeklyVolume()` credits every logged set with no warm-up exclusion.

The requirement row now defines it — *a working set taken close to failure, roughly one to three reps
left, warm-ups excluded* — and every measured volume row admits the app counts every set you logged.

**Deliberately not corrected**, and the reason is the direction of the error. The available fix is a
load threshold: exclude sets below some fraction of the day's top set. That catches warm-ups and also
throws away genuine back-off work, which is often the hardest set of the session. Every other judged
constant in this project — LAYOFF_DAYS, FATIGUE_HALF_SETS, the rep ladder — is acceptable *because it
can only withhold*. This one errs both ways, so it is not a call to make quietly. Left as Tim's.

The caveat matters most on the OK branch and that is not obvious: on the short branches an inflated
count only softens bad news, but there the app is saying the work IS being done, so warm-up padding
would be an unearned positive verdict — the same fault the headline fix corrected from the other side
on the 22nd. Mutation-checked: emptying the caveat flips both assertions.

---

## 2026-08-24, eighth pass — the ratio sweep, a sheet that lied, two dead routes

**Three more ratios derived**, all reasoned too low and therefore flattering: dumbbell bench
0.72 → 0.81, dumbbell shoulder press 0.88 → 1.01, dumbbell curl 0.88 → 0.94. With the row from
earlier that is 15, 12, 15 and 7 per cent — **not a constant**, which is the finding that matters:
no blanket factor fixes that table, every remaining reasoned entry has to be derived on its own.
Four neighbours moved with their anchors and are labelled as still-reasoned; decline dumbbell bench
*had* to move or it would have claimed a decline is harder to load than a flat press. On the demo's
barbell-led year this is Chest −1.6 % and Shoulders −1.3 %; on a dumbbell-led history it is far
bigger, which is exactly who it was mis-rating.

**The disconnect sheet promised something false** — "and you will not see theirs" — when
`social.remove()` only edits your own graph. Corrected first and separately from building the real
mutual disconnect, because a half-built feature is a known gap and a screen stating the opposite of
what the code does is a lie the user acts on.

**`#/data` and `#/muscles` are not routes**, and the accessibility audit listed both, so it had been
measuring Home twice and the Data screen and body map had never been audited at all. Fixed the tool
to use `#/graphs` plus in-page mode steps, including one that selects a muscle so the panel exists.
Re-ran: 52 combinations, 16 never measured before. **Contrast is clean — zero text below 4.5:1.**
The real finding is the map's own targets: Traps 42x11, Glutes 39x16 at 360px, and the figure is the
only way to select a muscle, so the year grid's equivalence argument does not apply. Left for Tim,
because it lands on his illustration.

Recorded a warning with it: the tool's `hit44` flag fails 1616 of 2068 controls on already-audited
screens, so it is a tripwire for finding candidates and not a defect count.

---

## 2026-08-24, close of session — prepared for a chat reset

Tim asked for the md files to be prepared for a reset. Eight passes ran today, so this was a
staleness sweep rather than a summary — the failure mode this file exists to prevent is a fresh
session acting on something that stopped being true a few hours ago.

**Four stale claims found and corrected**, all of them things a fresh session reads early:
"Two accounts have never actually connected" in the status block and again in the architecture tree
(closed on the 22nd); "a phone has opened the app exactly once" (three times now, and trained with);
and the accessibility section's "44 screen/width/theme combinations", which was never true — two of
those eleven routes did not exist, so Home was measured three times and the Data screen and body map
never once. The historical section keeps its original numbers with a correction beside them, because
rewriting what a past run measured would hide the fault rather than record it.

**Open work got an INDEX rather than a renumbering.** The letters had drifted out of reading order
again as items were inserted, and the 2026-08-22 fix for that was to reorder — which cannot be
repeated now, because items elsewhere in the file and in `docs/` cite them by letter. A ten-row index
in priority order sits at the top instead, saying which are open, which closed today, and which two
questions are waiting on Tim rather than on the next session.

**The header block leads with what changed.** One gym session produced four defects that six
commissioned reviews and 2300 assertions had all missed, and every one was diagnosed wrongly on the
first guess — including by this file. That is now the third thing a fresh session reads, because it
is the most useful thing anybody could know before picking work up.

Architecture tree updated for the fatigue term, the exercise swap, the assist flag and the set fill.
Assertion counts recounted across progress.md and README. Everything pushed, 2369 green.

---

## 2026-08-24, ninth pass — "build whatever is solidly planned"

Tim, after the reset: *"catch up with progress.md"*, then *"if something is solidly planned and
ready to build, go ahead and build it."* Two items on the index were decided and genuinely
unblocked, and everything above them was not: 0e needs a plan doc before code, 0h needs published
standards derived per entry, 0c is Tim's design half, 0j needs a new rules path.

### The two touch targets from 0i

The comparison button on the muscle screen and the chart's exercise picker, which the audit had
measured at 332x38 and 156x36. Both to 44, both re-measured at 360 / 375 / 393 with no horizontal
overflow. The eight pixels came off the chart, which had 501. **The body map's own targets were left
alone** — those land on Tim's illustration, so 0i is now the illustration only.

### The cloud warning, and what building it turned up

0b(c) said "nothing warns as the limit approaches". Built: `store.cloudUsage()` sizes every one of
the account's collection documents and Settings warns above *Download backup* from 80 %, naming both
the percentage and how many more workouts fit.

**And the limit it was built to warn about turned out to be wrong by 1.66x** — three commits after
that same number was corrected. The morning's fix measured `JSON.stringify` length. Firestore does
not charge JSON length: it charges a flat 32 bytes per map and 8 per number, so one recorded set
`{weight:205,reps:6}` is 23 bytes of JSON and **60** to Firestore. A session is ~17 of those, and
`entries` is 88 % of the collection. **The real ceiling is ~520 sessions, not ~950** — two and a half
years at four a week rather than four and a half.

Checked before believing it: the demo year's sessions are 1,216 JSON bytes each against the review's
~1,100, so the two measurements agree on the data and only one of them is measuring the thing
Firestore bills. There is an assertion for that agreement.

`js/firebase-backend.js` was still carrying the *first* wrong figure — the morning's fix corrected
the doc and missed the source comment two files away. So the answer is not a third number written
down: both prose copies now point at the function that computes it from the account's own rows.

Two things the warning deliberately refuses to do. It says **nothing below 80 %**, because the UX
review's fifth finding is that an always-on warning is wallpaper by the time it comes true. And it
says **nothing at all unless the data really is in Firestore** — on this device the limit is
localStorage's and in the demo there is none, and a confident number about the wrong storage is the
fault this project keeps meeting. Both have assertions that flip if the guard goes.

Not verified against a real rejection, and the docs say so: confirming it means writing a megabyte
to the live project and watching it fail.

2406 green across eleven suites, four mutation checks, pushed.

---

## 2026-08-25 — a second gym session

Four reports. Three were real and shipped; the first was not a bug.

**"The joint workout system isn't working."** It does not exist. One grep across `js/` for
joint/partner/guest/recordFor returns nothing — joint workouts are Open work 0e, designed on
2026-08-24 and never built. Told him plainly rather than going hunting. The standing rule in
progress.md is "do not read 'X is broken' as X being broken, check first"; this is its mirror image,
a report that a feature is faulty where the honest answer is that there is no feature. He has now
asked for it twice, so it is the top item — and the half to build first is the **guest** case, a
name with no account kept in the recorder's own data, because it needs no rules change and it is the
case he keeps hitting (his friend could not sign in).

**Record looked like a list of things to read about.** A chevron means "go and look at that"
everywhere else in the app, and this row starts a session. The rows say **Start** now, with a play
glyph, and no chevron. The word rather than the bare triangle: a triangle could mean "expand", and
this is the tap whose cost of being misread is highest.

**The programme's name was the one thing not shown.** With one system it was not rendered at all;
with several it was an 11.5px grey caption, quieter than the workout names beneath it. That reverses
a call from 2026-08-22 ("a sole heading is decoration") and he is right — nobody arrives at Record
hunting for "Push", they arrive knowing which programme they are running. It is a 15px full-ink
heading now, always shown. Looking at it turned up that the pane's even gap put a second system's
name exactly halfway between two groups, so it was ambiguous which one it headed; more space above,
none below.

**Only the 21x21 numbered square selected a set.** Now the whole row does — 298x44 at 360px. Built
as a real button rather than a click handler on the div, because a div would satisfy the request and
quietly drop the set list out of the keyboard order, which is the fault the 2026-08-20 audit found
in nineteen labels. Delete is a sibling of that button rather than a child, so no stopPropagation is
needed and none can be forgotten later. Cost stated: four sets are 179px against 143, so a 4-set
exercise now makes the pane scroll where it just fit; the footer is pinned and all four sets stay on
screen.

2419 green, three mutation checks, pushed.

---

## 2026-08-25, later — his colour key, and the grey that was too grey

**The level palette is Tim's now.** He sent a screenshot of another app's key and asked for the exact
same colours in order plus one more. Sampled off the image they are Material Design 500s. Five of his
six level names are ours, so keeping each on its reference colour left exactly one hole — Proficient,
between green and blue — and the hue sweep has its only gap in the same place. Cyan.

Which cyan was measured rather than picked: Cyan 500 is the family-perfect tone and is the one a
full-colour reader cannot tell from Advanced (ΔE 12.6, FAIL). Cyan 300 #4DD0E1 passes at 17.6.

Told him what it costs rather than burying it: the ramp it replaces had strictly monotone lightness,
which is what made it read as a scale, and Material's tones do not — so the ordinal lightness cue is
gone, and the palette fails the CVD adjacency check on green↔orange. Three of the four failures are
inherited from his six; the added cyan makes nothing worse, which is why every other candidate was
rejected. The mitigation is the thing he asked for in the same message: the key's chips ARE the
"direct labels" the validator demands as the price of that failure.

One thing his reference gets wrong and this does not: it puts white text on all six chips, 2.16:1 on
its orange. Ink here is chosen per chip from the chip's own luminance — worst of seven is 4.95:1.

**The audit earned its keep again.** Converting to one palette across both themes broke `.lv-text-*`,
which painted the level word in the ramp colour: "Advanced" measured 2.83:1 on Goals in the light
theme, the only sub-4.5 node in 4,970. There is no assignment of these seven to text that clears AA
in both themes — they are fills. So the level word became a chip too, which also means a level looks
identical everywhere it appears.

**"More details", off by default.** Percentiles surfaced in exactly two places, both on the muscle
screen, and both are behind it now. It hides a readout, not a calculation, and the help text says so.

**The grey was passing AA and still too grey.** The numbers say why nobody caught it: the two most
common type sizes in the stylesheet are 12.5px and 11.5px, and 71 rules paint --ink-faint. Faint went
5.44 -> 8.52 dark and 5.24 -> 8.53 light; the worst cell in the table is now above what the best
faint cell managed before. The a11y test rejected the first attempt for letting the themes drift 1.9
apart. Re-audited: 52 combinations, zero below 4.5:1, zero overflow, median 9.19.

The colour DIRECTION — his "everything is black and white" point — is left open as Open work 0k,
because he asked for options rather than a decision.

2428 green, pushed.

---

## 2026-08-25, evening — Home became a feed

Big batch. Tim authorised subagents, so two ran: one researching Strava's feed anatomy (read-only),
one adding a start time to the social projection (scoped to js/social.js + its tests, so it could not
collide with the view work I was doing).

**Home is a Strava-style feed of friends' workouts** and nothing on it starts a workout any more —
that all moved to Record, on "so we don't double dip". "Choose another workout" died rather than
moved: on Record it would point at the list it is sitting on top of. This also answers, from the
other side, the UX review's sharpest open finding — "nothing a user can see on Home ever grows".

He asked for Strava AND for "no panels on any page" in the same message, and Strava's feed is
literally elevated cards with drop shadows. Took the anatomy and not the chrome: the order and
content of a card is copied exactly, separation stays hairline-and-space. If he wants the boxes it is
one background and one radius.

Chronological, deliberately — the research turned up that Strava switched to a personalised ranking,
got a petition, and now ships "Latest Activities" as a toggle.

Kudos and Comment cannot work: writing one means a path the other person's client can read, which is
the same wall joint workouts and mutual disconnect both hit. They are rendered and say so when
pressed, because a button that silently does nothing is a fault this project has shipped once and
fixed twice. Share is real.

**The demo has friends now.** social.state() refuses in the demo, which would have made the most
important new screen unjudgeable in the one account built for judging screens — including to the a11y
audit, which drives the demo. Reading invented friends is not the hazard; publishing is, and that
stays refused. One of the three shares at the lowest tier, with no entries and no startedAt, because
that is what the wire really returns — the expired-invite bug lived in exactly that gap once already.

**The projection agent found a hole I had not asked about**: assertTierClean() only checked numeric
leaves below a session, so a string field like a start time would have sailed through the guard
silently. It checks keys against an allow-list now and fails closed.

**Goals left the tab bar and Calendar took its slot.** Off the bar is not deleted — the route
resolves, Settings links to it, all three screens gained a back button, and the test checks all three
halves together, because a route with no way in is deleted in every sense that matters.

**Two regressions, both caught by machines.** The first-run onboarding lived on Home's empty state and
the feed destroyed it; a render test failed and the property moved to Record with the test. And the
new "Start" pill measured 4.08:1 in the light theme — the a11y audit found it, not me.

2474 green, 56 audit combinations, zero below 4.5:1.

---

## 2026-08-25, close of session — prepared for a chat reset

Tim asked for the md files to be prepared for a reset. The app was restructured three times today, so
this was a staleness sweep rather than a summary — the failure this file exists to prevent is a fresh
session acting on something that stopped being true a few hours ago, and today produced more of that
than any previous day.

**Twenty-one stale claims found and corrected in progress.md**, each replacement asserted to match
exactly once so a silent no-op was impossible. The dangerous ones were all in the block a fresh
session reads first:

- **"Do not redesign Home unasked."** That instruction had been point 1 of "three things a fresh
  session must know" since 2026-08-22, and Home was rebuilt as a feed today on Tim's own detailed
  instruction. A fresh session would have read a prohibition over the thing it had just been asked to
  do. What replaced it is more useful: he sends screenshots and specific instructions, and he has now
  twice reversed a call this file argued for and been right both times — because his argument was
  about how a screen is USED and this file's was about what the screen IS.
- **"Five nav tabs: Home, Workouts, RECORD, Data, Goals"** — it ends in Calendar now, and Goals is off
  the bar entirely.
- **"Home opens on the next workout in your rotation"** — that is Record's job; Home starts nothing.
- The Calendar row still said it was the first segment of Data; the Data row still listed four
  segments starting with Calendar; Goals was still "the far-right tab".
- The architecture tree's test counts had drifted badly — 1103/153/73/88 against real figures of
  1199/170/106/232 — and "22 JS modules" is 32.

Added a banner at the top saying outright that the nav, Home and the muscle colours all changed on
the 25th, and that any sentence below about the old shape is history rather than the app. That is
cheaper than trusting a reader to notice the contradiction.

Historical dated sections keep their original wording, per the convention set at the last reset:
rewriting what a past run measured would hide the fault rather than record it. The Calendar row was
the one place that needed a strike-through instead, because it is current-state and was left
self-contradictory by a half-edit.

README picked up the feed and the Record change; docs/social-plan.md's tier table now mentions the
start time the mid tier began publishing today.

Every claim in the new header was verified against the code rather than from memory — the nav array,
the Data segments, the default mode, the feed's existence, the Goals route and its link, and that
More details defaults off. 2474 green, pushed.

---

## 2026-08-26 — Tim confirms the full backlog; guest workouts ship

Tim asked for a fresh read of what deployed most needs improving. Plan presented: ratio table,
PRs on the finish screen, body-map tap targets, polish sweep — with joint workouts, kudos/comments,
location and colour options listed as out of scope ("new features, not improvements"). Tim's reply:
add them all — "I wanted them deployed in the last session, and I'm confident I want them" — and
start coding.

First piece built and deployed: THE GUEST HALF OF JOINT WORKOUTS (the case he hit twice in the
gym — his friend could not sign in). A people bar in the session runner: You / guest chips / "Add a
person". A guest is a name with no account; their sets save to a new `guestSessions` collection on
the recorder's own account. Switching chips switches the whole per-person state — entries, history,
progression suggestion, walk position, body weight — so two people on the same bar never share a
prescription. Day view shows "Recorded for others" with the full set-by-set body and delete.

The design calls worth remembering: a separate collection rather than a flag on sessions (a
forgotten filter would count a guest's training as the owner's and publish it to friends — a
collection nothing else reads cannot be mis-counted); finish() minting its save ids once on the
draft, because multi-row saves made the old "failed = nothing landed" retry unsafe; and the owner
saving nothing when they only coached.

Firestore rules updated and deployed (knownCollection carries guestSessions; the store↔rules
agreement test pins the pair). Backups carry guests; restore gatekeeps a dateless guest row.
data-layer 1199→1208, render 430→443, all eleven suites green. Pushed.

Still queued from the confirmed plan: kudos/comments rules path, location on feed cards, the ratio
table, PRs on finish, body-map targets, polish sweep, colour options.

Second piece the same day: KUDOS AND COMMENTS WORK (0l closed). New rules path — a reaction is one
create-only document at users/{owner}/reactions/{id}; a viewer of any published tier may write one,
`from` is proven to be the caller, no update path exists at all, sender and owner can delete. One
kudos per person by construction (deterministic doc id). The feed buttons show live counts, your
own kudos reads as a state, a comments sheet holds the thread, and a quiet "On your workouts" strip
above the feed shows what landed on yours — the receiving half, without which kudos would be
write-only. Demo refuses with a sentence. Rules tests 46→66 (run in the emulator as four different
callers), social tests 106→121, rules deployed, all suites green, pushed.

Third piece: LOCATION ON FEED CARDS (0m closed). The privacy decision: a hand-typed label, never
GPS — the owner chooses the granularity, so nothing more precise than what they wrote can leak.
A quiet pin chip beside the date in the runner, carried forward from the last session (one gym =
zero taps forever), editable on the edit-record screen, published at the "My workouts" tier and
above only — sixty times-and-places describe where a person reliably is, so the lowest tier stays
the minimum. Demo friends carry locations on some cards. A render test caught the carry-forward
reading the wrong same-day session (getSessions sorts on date alone; the startedAt tie-break fixed
it). Social tests 121→128, render 443→448, all green, pushed.

Fourth piece: THE RATIO SWEEP (0h substantially closed). 28 lifts pulled from Strength Level's
published 180 lb male standards, every remaining reasoned entry with a source derived the
established way. Mostly the errors flattered again — pec deck 0.55→0.90 was the worst (~60%
inflation), concentration curl 0.62→0.92, good morning 0.60→0.95, the deadlift family 13–30% — but
three ran the OTHER way (leg press, hip thrust, dumbbell shrug had been under-crediting) and hack
squat's guess turned out exactly right. The face pull split out of the raise family at 0.75, which
retires §9's 50-lb-face-pull-as-167-lb-press example the honest way. Where no standard exists the
table now says so by name. Demo-year effect: Back −8.7%, Triceps −9.7%, Shoulders confidence
0.53→0.79. 23 sourced ratios + 7 orderings pinned (data-layer 1208→1235). All suites green, pushed.

Fifth piece: PERSONAL BESTS ON THE FINISH SCREEN. The UX review's sharpest finding — nothing
anywhere celebrates anything — answered the Rule-5-safe way: the finish screen compares the number
just typed against the biggest number ever recorded for that lift (benchmarks included) and leads
with "Personal best: Overhead Press — 105 lbs, up from 100". Recorded vs recorded only, no
estimates; weight where the lift has one, reps where it does not, time and distance left alone
(Rule 6). First-ever lifts are not congratulated — a trophy for showing up would make the trophy
noise. Three render tests pin beaten / not beaten / nothing-to-beat. 452 render assertions green.

Sixth piece: BODY-MAP HIT HALOS (0i's cheap half). Every muscle path gets an invisible duplicate
with a fat transparent stroke — the tappable region grows ~10px in every direction and the
illustration doesn't change by a pixel. All halos render before all fills, so a halo can only win
where no real muscle is painted: enlargement never steals a tap from a neighbour. Verified over
CDP at 360px — probes 3/6/9px outside the Traps lobe hit its halo, a real click 5px off the art
selects Traps (the first probe used the bbox centre and "found" it broken; that centre is the
spine gap between the lobes, §0.6's exact trap). Also drove the demo feed, the location chip and
the people bar at 360 — no overflow anywhere, screenshots eyeballed. What's still under 44px is
the art itself, which stays Tim's call.

Seventh piece: THE POLISH SWEEP. Explore now explains its percentages in one line ABOVE the nine
cards (full caveats still below); the screen is titled "Ready-made programmes" and its first
sentence bridges the word swap — "a system is just a programme you own" — right where a stranger
lands from "Pick a programme"; and the red not-backed-up dot finally waits for there to be
something to lose: empty account, no dot; data plus no backup, dot; check fails, dot stays because
unknown is not safe. Render 457→462, all green, pushed.

Eighth piece: COLOUR OPTIONS BUILT, TIM'S PICK PENDING (0k). Three whole-app directions — teal,
indigo, ember — implemented as real token overrides, applied to the actual app and screenshotted
at 360px, contrast-measured (all clear AA with room), and published as a comparison page:
https://claude.ai/code/artifact/ca7bfddd-28e8-463b-a06a-9339931ba64d. Candidate CSS parked in
docs/colour-options/ with the fold-in checklist. The app's stylesheet is untouched until he says
"teal", "indigo", "ember", or "keep today".

Mid-session Tim also said to feel free to use as many sub-agents as I'd like — saved to memory as
standing permission.

End of day: seven of the eight authorised pieces shipped and deployed, the eighth waits on his
taste. 2,564 assertions across eleven suites, plus 66 rules assertions in the emulator, all green.

Tim's pick came back: ALL THREE. Built the same hour — Settings gained a "Colour" row (Gold ·
Teal · Indigo · Ember), each chip wearing its accent as a dot. Gold is bare :root (an untouched
account renders exactly as before); a palette is data-palette on <html>, applied instantly and
re-applied by boot. Each palette got a DESIGNED light theme, not an inversion — ember's gold had
to darken to clear AA on its warmer ground — and every token a palette touches is defined in both
its blocks, because the dark-palette and plain-light selectors tie on specificity and source order
must never decide a colour. The a11y suite now sweeps all four palettes in both themes (22→85
assertions); the two gold-assuming literals (.row-start, .cal-tag.b) were found and handled; the
demo carries the palette in like units and theme. Verified over CDP with real clicks: computed
--accent changes per pick, teal+light composes, gold clears, reload re-applies. Render 462→470,
2,635 assertions green, docs/colour-options deleted (superseded), artifact page marked decided.
Pushed.

---

## 2026-08-26, second wave — six items from Tim, then three more mid-build

All shipped except the AirPods work, which he said to plan and not deploy.

RECORD IS A CATEGORY CHOOSER (D2 narrowed to D27). Weightlifting first and biggest, leading to
the unchanged full recorder; Run/Walk/Swim/Cycle/Climb/Something-else each open a quick log that
saves a real session — calendar, feed, backups all see it, the muscle map and ratings never do.
Library gained Walking, Rock Climbing, Bouldering. docs/activities-plan.md holds the plan.

THE ROTATION BUG HE REPORTED: his self-built system has no order, so "next in rotation" was
alphabetical — after Legs came Pull, not Push. The rule is least-recently-done now (never-done
counts as longest-waiting; rotation order is the tie-break so ordered programmes lose nothing).
His exact Pull-Monday/Legs-Tuesday scenario is a pinned regression test.

DURATIONS: the hidden timer he asked for has existed all along (startedAt/finishedAt on every
session). Record rows now show ~N min — the median of that workout's own recordings, sets×3min
until any exist, rounded to 5. Feed cards say "· 45 min ·" at the my-workouts tier and above;
finishedAt itself is still never published, and overnight-draft garbage is guarded out.

ACCOUNT: profile photo (client-resized, worn by the top-left button, not shared to friends),
profile row + backup/restore + delete-all moved out of Settings onto the Account screen, and back
from Account goes Home. Settings keeps a pointer row.

THE "Friend"/"Autumn Dossey" BUG: accepting an invite happens before the other side accepts back,
so her name was unreadable at accept time and the placeholder stuck. healConnectionName() now
persists the published name whenever a screen can read it; unverified in the field until Tim's
phone opens Friends.

AIRPODS (docs/airpods-plan.md, NOT deployed): head-motion is native-only — impossible for a web
app, verified with sources. Stem presses ARE buildable via MediaSession with a silent looped
track; costs owning Now Playing (no Spotify at the same time), so opt-in only. Waiting on his go.

2,683 assertions across eleven suites, all green. Docs swept for a chat reset; the outstanding
verifications (CDP pass on the new screens, palette audit beyond Gold, two field checks) are
Open work item 14.

────────────────────────────────────────────────────────────────────────────
2026-08-27 — the cropper, two iPhone bugs, activities phase 2, the palette audit

Tim asked me to finish the items I'd said were fully specified, then sent two phone reports and
two research questions while I was building.

PROFILE PHOTO CROPPER — his ask: "sometimes the user's face isn't centered and large in the
middle... display the image with a circle in the middle showing what their profile icon is
actually going to look like, and let them move it and zoom it." Built: a "Position your photo"
sheet, square stage with the circle inscribed, drag to move, slider/pinch/wheel to zoom.
js/image-crop.js is a new pure module — the crop is a square in SOURCE pixels, so the same photo
crops the same way whatever phone it was done on. What the circle frames is literally what the
canvas cuts (both derive from one state, and there's an assertion that they agree). The invariant
that matters: the crop square can never leave the image, so an avatar can never save with a blank
wedge. Swept 1,925 combinations, zero escapes; mutation-checked both ways.

HIS IPHONE BUG 1 — the profile photo rendering huge in the top-left with no circle. Chrome at
390px would NOT reproduce it (34x34, circular), so I can't claim to have seen it. But there was a
real latent fault: .avatar-glyph had no size of its own, and its parent sizes itself to its
content, so the photo's width:100% was a cyclic percentage — and an engine is free to break that
cycle by using the image's intrinsic 256px. Blink picks 34, WebKit apparently picks 256. Fixed by
pinning everything to a definite box (position:absolute; inset:0). NEEDS TIM TO LOOK — I can't
verify a fix for a bug I can't reproduce.

FOUND WHILE LOOKING: a CSS comment was never closed (217 opens, 218 closes), and the parser was
swallowing the .seg + .seg::after rule with it. That's the hairline between unselected segments —
the thing that stops "Graph | Bar Chart Muscles" reading as two choices. It has never rendered.
Mutation-checked.

HIS IPHONE BUG 2 — "clicking friends in the home menu has a long delay and lag that's alarming."
Four causes, all fixed: the router awaits the view before swapping the DOM (so the old screen sat
under his thumb — Friends now paints immediately and fills in after); the invite list was fetched
TWICE per visit; a friend's three visibility tiers were probed one at a time, paying a round trip
per refusal, times every friend; and the cloud reads weren't cached at all — they are now, same
30-second discipline as everything else. Pinned by a test that hands the screen a network which
never answers.

ACTIVITIES PHASE 2 (items 1-4): activities got their own group instead of being filed under
Cardio, and it's unrankable and produces no volume — both asserted, because that's D27 failing
quietly if it's wrong. Pace shown on anything with a distance and a time, never coloured good or
bad. Feed cards now carry a dumbbell or a route glyph, and stopped printing "Running" under
"Running".

PALETTE AUDIT CLOSED: the full browser audit had only ever run on Gold. It now runs on all four —
240 combinations, 23,496 text nodes, zero below 4.5:1, zero overflow. Plus the queued screenshot
pass over the second wave: no horizontal overflow anywhere.

AIRPODS ANSWER — his question: would head motion work if it were an App Store app? Yes.
CMHeadphoneMotionManager is a real public API (AirPods Pro/Max/3rd gen/Beats Fit Pro, NOT AirPods
2). But a WKWebView wrapper doesn't get it — needs a native Swift bridge, $99/yr, and review,
where guideline 4.2 rejects repackaged websites. Head motion alone isn't worth a native app;
HealthKit might be.

INTEGRATIONS RESEARCH (docs/integrations-plan.md, nothing built) — his question about pulling from
Strava/Cronometer/Apple Fitness/MacroFactor. The finding that reorders it: the blocker is not
"website vs app", it's the missing SERVER. Strava's token exchange needs a client secret and has
no PKCE, and a native app is just as public a client. Also: Strava's 2026 agreement forbids
showing one user's Strava data to another user, which lands straight on the Home feed. Apple
Health has no web or server API at all — native only. Cronometer and MacroFactor have no public
API but both export files. So: FILE IMPORT works today as a website and needs nothing from
anybody; live sync needs Firebase Blaze turned on; importing food would narrow D1/D26 and is his
call.

2,738 assertions across eleven suites, all green.

RATIO SWEEP REMAINDER (same session): derived the raise family and the incline dumbbell press.
Lateral raise 0.30->0.53, front raise 0.30->0.54, rear delt fly 0.30->0.56, incline DB bench
0.70->0.80. The raises had been flattering by ~80 % — a 40 lb-per-hand lateral raise was
converting to a 267 lb overhead press. It reads 151 now. The three raise medians agree within
0.03, so the family shape was right and only the number was wrong. q does NOT rise on the raises
(they drift 2-4x across the levels, so there's no constant to find) but DOES rise on the incline
press (1.1x, flattest in the table). Also found a wrong note: Machine Triceps Extension claimed
Strength Level publish a standard for it — they don't, they publish a machine pushdown, which is a
different exercise. Labelled honestly now. Still open and small: decline DB bench, Seated/Arnold
offsets, spider curl.

────────────────────────────────────────────────────────────────────────────
2026-08-27, second pass — photo editing, file import, Blaze priced

Tim confirmed the profile picture is fixed on his phone (that was the last field check
outstanding), then asked for four things: edit an existing photo, build file import, price the
Firebase paid tier, and do items 3-4 from the next-steps list. AirPods and food import are on hold
at his instruction.

EDIT AN EXISTING PHOTO. The saved avatar is a 256px square with everything outside the circle
already thrown away, so editing THAT would only ever let you zoom further in. A re-editable source
is now kept at 768px — three times the output, which is exactly the cropper's max zoom, so
re-cropping never upscales. Edit reopens where you left it. Remove clears the face, the source and
the crop together.

Found by driving it: setPointerCapture was the first line of the pointerdown handler and it throws
when the pointer id isn't active — which threw before the pointer was recorded, so dragging did
nothing at all. Capture is an optimisation, tracking is the mechanism. Reordered.

FILE IMPORT — the Phase 1 from the research doc. #/import, off the Account screen. Drop in a CSV
from Strava, MacroFactor, Cronometer, Apple Health or your own spreadsheet. Activities become
sessions with no workoutId (same shape as the quick log, so the calendar and feed see them and the
muscle map never does); weigh-ins join the body-weight series.

Three things it refuses to guess, because all three would be wrong silently and forever:
- 03/04/2026 is 3 April or 4 March. The whole column is checked first (one date above the 12th
  settles it) and only a genuinely ambiguous column asks.
- A weight column with no unit in its name imports nothing. 75 kg read as 75 lb records somebody
  at a third of their weight.
- A distance column likewise — AND THIS ONE WAS A REAL BUG. It used to fall back to miles, and
  Strava exports kilometres, so a 5.02 km run came in as 5.02 miles. The weight hazard had been
  thought about; its identical twin had not.

Re-importing the same file is safe — every row gets a deterministic id from its own content, so an
overlapping monthly export upserts instead of doubling training. Verified in a browser: same file
twice, still three sessions, "nothing new to bring in".

FIREBASE BLAZE, PRICED. Effectively free: the allowance is 2 million function calls a month and
ten users on Strava sync would be about 1,500. Plus $300 credit for new accounts. The real cost is
that it needs a card on file and there is no hard spending cap — only budget alerts. That's the
reason to leave it off until live sync is actually wanted, not the money.

2,799 assertions, all eleven suites green.
