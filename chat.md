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
