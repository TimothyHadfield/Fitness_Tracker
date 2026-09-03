# Fitness Tracker — Progress & Context

> 🟢 **FRESH SESSION: READ THIS FILE, `docs/handbook.md` AND `docs/state.md` — ALL THREE, BEFORE
> DOING ANYTHING.** This one is **what is true now and what is left**. The handbook is **how to work
> here** — the environment traps, the working agreement, the architecture, the binding design rules
> and the locked decisions. `docs/state.md` is **what the app currently does**, screen by screen.
> ~350 KB together, and none of it is optional.
>
> 🚨 **EVERY `§N` REFERENCE IN THIS PROJECT MEANS `docs/handbook.md` — EXCEPT `§3`, WHICH IS
> `docs/state.md`.** `§4` the architecture, `§6` the locked decisions, `§9` the known gaps, `§0.10`
> the demo account; **`§3` is what the app currently does** and it moved out on 2026-09-08 when the
> handbook reached 215 KB of its 220 KB budget. **The numbers have never changed — only the files
> they live in.**
>
> **`docs/history.md` is the dated log** — every session's full write-up, newest first. You do not
> read it; the recent ones are summarised below and you go there for the detail, searching by date.
> ⚠️ **It is larger than one read** (525 KB): grep it for the date, then read that range.
>
> `chat.md` is the human-readable log and answers "what did we say about X"; it starts at
> **2026-08-29**, with everything from 2026-08-14 to 08-26 in `docs/chat-archive.md`.
>
> 🚨 **AND READ `docs/direction.md` — it is short, it is newer than the handbook, and it OVERRULES
> it.** On 2026-09-04 Tim was interviewed about what this project is for, and **four standing rules
> were reversed by his answers**: the blanket honesty refusals, the discovery-feed ban, the
> "not verified on a phone" warnings, and how visuals may be touched. **The handbook still contains
> the old versions in places** — direction.md quotes both, so you can tell which is which.

**Last updated:** 2026-09-12 (the same session as -11) — the split finished, the benchmark's
captions on every set, **the set lock, the finger-following drag, Years-first calendars, ranked best
lifts, Record covering the tab bar**, and **a standing instruction about what "catch up" means.**

🛑 **"CATCH UP WITH PROGRESS.MD" MEANS READ AND REPORT. IT IS NOT A GO-AHEAD FOR ANYTHING.** Tim,
2026-09-11, having caught a session already building: *"When I tell you to catch up with progress.md,
you should not start working on anything until I tell you. It's okay to tell me what you think next
steps are, but don't start working until I tell you to."* 🚨 **An authorisation recorded in an
earlier session is not an instruction to resume it in this one** — including anything on the Open
work list, however green the light looks in these notes. Read all four files, say in a few plain
lines what changed and what is open, **then stop.**

✅ **NOTHING IS HALF-BUILT AND NOTHING IS AUTHORISED.** Open work 29 closed on 2026-09-11; every
other item on the list is either Tim's, pinned, or parked.

## What changed on 2026-09-12, in one line each

⚠️ **THE SAME CHAT SESSION AS 2026-09-11** — Tim rapid-fired five asks while the captions pass was
still under test, then *"you should be deploying many sub-agents"*; three ran at once and stamped
their work -12, so that is the date the code carries. Full write-up: `docs/history.md`, 2026-09-12.

1. 🔄 **THE CALENDAR OPENS ON YEARS ON EVERY DOOR, AND A TAP ON MONTHS LANDS ON THE CURRENT MONTH** —
   Profile included. `calMode` and `friendCalMode` both default to Years; `land: false` now means
   "not on arrival" (a `painted` flag), so the Profile pane is moved by a tap and never by a paint.
   ⚠️ Months remembered from the Calendar screen still paints Profile un-landed. 🚩 **Visual, left
   for Tim**: the Profile tab's Months/Years pill is never `wireSegmented`, so it repaints instead
   of sliding — one line in `calendarSection`.
2. 🆕 **A SET LOCKS WHEN YOU MOVE ON FROM IT** — a padlock on the right that swings shut (`--t`,
   `--ease-both`, one-shot on the rebuilt row) and unlocks-and-opens on a tap. 🚨 **Only a RECORDED
   set** (`setIsRecorded` is the one rule); a drop locks with its set; per person, never broadcast;
   `locked` on the draft, dropped at save. 🚩 **Flagged for Tim, not changed**: fill-on-open copies set
   1 into set 2, a filled set is recorded, so going back to set 1 locks the copy — visible now where
   it was silent. Previous onto a locked set finds nothing open, deliberately.
3. 🔄 **THE EXERCISES SHEET DRAG FOLLOWS THE FINGER** — `translateY` of exactly the pointer's travel,
   no transition on the dragged row (the transition WAS the lag), neighbours slide by a row height,
   DOM untouched until release, then the same commit and a FLIP. **▲▼ removed** on his instruction;
   the grip takes the arrow keys and says so, so a keyboard loses nothing.
4. 🔄 **YOUR BEST LIFTS IS RANKED** — the core eight (Squat, Bench, Deadlift, OHP, Row, RDL, Curl,
   Close-Grip; Cable Crunch excluded on purpose) as estimated 1RMs coloured by the `lv-text-*` ramp
   with the band AND the level name in words, ordered by level, then **Other lifts** behind a real
   `<details>`. 🚨 **A recorded lift shows ITS OWN best set through the curve, not the muscle
   rating** — the rating is a blend a leg press could lead, and rating-converted numbers would put
   every exercise of one muscle on one percentile. A never-done core lift is converted and says so; a
   stand-in-only one shows no number and says why (no `allowFallback`). ⚠️ Per-side is
   `e1rm(total)`, not doubled after — the agent's own draft had it backwards and its probe caught
   it. `js/profile-ranking.js`, new, in the precache.
5. 🚨 **RECORD COVERS THE TAB BAR** — `record` is in `FULLSCREEN`; the down arrow is the way off. 🚨
   **And two faults under it**: `clear(app)` took the bar with the old screen, so `parkScreen()`
   now parks **everything in `#app`** (the bar rides in the ghost); and the ghost's 240ms timer
   started **before the store read**, so on a 220ms read it left mid-rise — measured, ghost gone at
   t=264 with the panel at y=404. **Released on the rising screen's own `animationend` now**
   (`releaseGhost()`), a falling ghost on its own; a 4× backstop timer still always runs. Re-probed
   in-page on rAF: ghost with bar for the whole rise, panel 844px from y=844 to 0.
6. 🔒 **THREE AGENTS AT ONCE ON DISJOINT FILES HELD — with one lesson.** The live suite was red for
   everybody while anybody was mid-flight (a half-built lock crashed `render.test.mjs`); one agent
   built an **isolated copy with the others' files at HEAD** to get its green run, and that is now
   the standing instruction. One agent owns `tests/`; the others write blocks to the scratchpad and
   the integrator places them — 58 assertions went in verbatim and passed first time.
7. ✅ **1,330 render, 2,021 data-layer, 131 a11y**, every no-Chrome suite green, `sw-update` 12/12 this
   run (still flaky by record). **Audit 272 routes / 23,327 text nodes / 0 / 0 / 0.** ⚠️ **The node
   count fell from 34,027 and was attributed before it was accepted**: Years-default calendars
   (−5,416, −5,336) and Record's five labels (−44).

## What changed on 2026-09-11, in one line each

**What Tim asked for:** *"catch up with progress.md"* — and then, mid-session, the standing
instruction above, followed by *"You can continue working this time, but next time be better."*

1. 🚩 **THE PROFILE/DATA SPLIT IS FINISHED — Open work 29 closed.** **Step 2: your body** (sex, age,
   current weight) on `#/me`, ⚠️ **a DISPLAY move** — the row opens `#/profile`, which stays the form,
   because `#/me` never writes. **Step 4: Goals moved off Settings**, 🚨 **the old row deleted rather
   than left as a second door**, which is what makes it a move; `#/goals` still resolves. **Step 5:
   the Account cleanup** — the facts readout came off its row (the Profile tab prints them now) and a
   "Profile" heading over one row went, because that word has meant a TAB since 2026-09-08.
2. 🛑 **NO VERDICT FOLLOWED GOALS ONTO THE TAB.** `goals.js` refuses to say whether somebody is on
   track and `goals.test.mjs` pins that refusal in the module; **a summary row is exactly where a
   refusal gets undone by one cheerful word**, so an assertion reads the whole screen for verdict
   words.
3. 🚨 **THE PROFILE TAB HAD NEVER BEEN AUDITED.** `tools/a11y-audit.mjs` already had a row called
   *Profile* — and it is `#/profile`, the FORM — so `#/me` was absent from the route list, the name
   was taken and the gap was invisible. **The 2026-08-24 `#/data` fault in its mildest form: a route
   absent from the list looks exactly like a route that passed.** ✅ **272 routes, 34,027 text nodes,
   zero below 4.5:1, zero overflow, zero unnamed controls** at all four widths.
4. ⚠️ **AND THE FIRST SUMMARY OF THAT RUN WAS WRONG IN THE REASSURING DIRECTION** — a script reading
   the wrong JSON keys reported *0 text nodes, 256 contrast failures*. 🔒 **The node-count rule caught
   a broken READER as well as it catches a stale server.**
5. ✅ **1,246 render assertions** (was 1,224) and **1,990 data-layer** (was 1,986), every runnable
   suite green. 🔒 **Mutation-checked both ways** — disabling the two new sections flips exactly
   eleven assertions, restoring the Settings row flips exactly one. ⚠️ **The first mutation run THREW
   and hid ten of its own failures**; the lookups are null-safe now, because *a mutation check is only
   evidence if the suite survives it far enough to say what else broke.*
6. 🆕 **STEPS 1 AND 3 GAINED THE RENDER COVERAGE THEY SHIPPED WITHOUT** — `bestLifts()` had a golden
   data-layer table and the SECTION had nothing. The list is asserted to lead by **days trained** with
   a heavier one-day lift second (Rule 6) and to print the measured set over a labelled estimate
   (Rule 5), on a fixture built so both orderings disagree.
7. 🔒 **AND THE ONE THAT GUARDS THE WHOLE SPLIT: `#/me` HOLDS NO FIELD AT ALL** — no `input`, no
   `textarea`, no `select`, anywhere on it. `direction.md` §4a's line between the two profile screens,
   asserted rather than remembered.
8. 🆕 **THE BENCHMARK'S TWO CAPTIONS ARE ON EVERY SET OF A WORKOUT** (second pass, his ask): *"_% of
   your estimated max"* over the weight, *"maybe __ to failure"* over the reps, same slot, same two
   functions, repainted in place on every nudge. 🛑 **A READ, not a LOAD — no `allowFallback`**: the
   benchmark form is that option's one named caller, and here the default refusal stands. 🚨 **PER
   PERSON** — `ratingsFor(name)` builds ratings from each person's OWN sessions, or a guest would see
   the owner's max under their name (0e). 🔒 The guest assertion is the load-bearing one and a
   mutation flips exactly it. The load is `totalResistance()` on an assisted lift, doubled per side;
   blank at zero; no slot on a timed exercise. **1,255 render.**

## What changed on 2026-09-10, in one line each

⚠️ **ONE SECTION FOR THE WHOLE DAY, as the maintenance note below now requires.** The full write-up
is `docs/history.md`, 2026-09-10.

**What Tim asked for, in order:** the two Open work items (*"you can do whatever work you think you
should do for those two things"*) → a joint workout he had just recorded → the Record animation → the
runner animation → sideways drag in Data, then *"across the cite"* → a friend's calendar → **the
Profile/Data question**, answered as advice and then approved for building.

1. 🚨 **"DELETE EVERYTHING PERMANENTLY" LEFT MOST OF THE ACCOUNT IN FIRESTORE — Open work 27 closed.**
   The list was **five of ten collections**; `sessions` was named and still failed (a sharded write of
   `[]` is a mass delete and the guard refuses one); and `write()` cannot address `shared/*` at all —
   so **a public account that deleted itself left its published training readable by anybody signed
   in, for ever.** ✅ `createAccountPurge()`, `shared` first, **verifies by re-reading before
   `deleteUser()` runs** and keeps the account if anything survived. 🚨 The collection list is handed
   down from `store.js`, never copied. **1,986 data-layer, 218 rules (was 159).**
2. 🚨 **THE RECORD PANEL ROSE BEHIND ITS OWN GHOST** — Tim reported it. `z-index: 50` on a ghost over
   an `#app` that creates no stacking context. **The asymmetry was the diagnosis**: falling wants the
   top, rising wants the bottom, and one number for both hid it. Ghost 40 / falling 50 / rising 45.
3. 🆕 **THE RUNNER GETS THE SAME MOVEMENT**, his ask. The ▾ falls; the live bar's arrow rises.
   ⚠️ **The up half is asked for by the DOOR, not inferred from the route** — three doors reach the
   runner and only one is a panel returning over what you were reading.
4. 🚨 **A JOINT WORKOUT WAS TWO WORKOUTS**, found by recording one. Next/add/remove/swap/reorder now
   reach everybody; **"Just for ___" is the opt-out**. 🔒 **The sets never follow** — each person's
   copy is rebuilt from their own history, never broadcast. **1,224 render assertions.**
5. ✂️ **NOBODY WROTE `overflow-x: auto` — THE BROWSER DID.** `overflow-y` alone makes the other axis
   `auto`, so every pane had been draggable sideways since it was written. Fixed app-wide; the
   Research table kept its own scroller (`min-width: 0` is what made it work). **Root cause is
   `.help-dot::after`** — a 44px halo on a 26px dot, overhanging by 9px.
6. ⚠️ **THE AUDIT NOW SWEEPS FOUR WIDTHS** (360/390/880/1280) and immediately found an **AA failure
   only the desktop layout paints**: the active sidebar nav label at **3.96:1**. 🚨 **The same pair
   was "fixed" on 2026-09-06 for the one element the phone-width audit could see** — reading the
   stylesheet found **four more**. All scoped to gold-in-light; teal/indigo/ember already pass.
7. 🆕 **A FRIEND'S CALENDAR HAS MONTHS AND YEARS**, and asking for it uncovered that **every cell of
   every friend's calendar said "Workout"** — a published session names its title `name`, a local one
   `workoutName`. The aria-label read *"February 10: undefined"*. 🚨 **The Years count says "days
   published", not "days trained"** — over a 60-session window the old label was a count of
   publishing wearing the name of training.
8. 🆕 **THE PROFILE/DATA SPLIT IS UNDER WAY — Tim approved the plan.** *"The main profile section is
   looking really empty right now and the settings profile section is really crowded."* 🚨 **Two
   complaints, one problem**: Profile was empty because its content lived in Data, and Data was
   overfull — six segments that physically did not fit. **Data = what it MEANS, Profile = what you
   DID.** ✅ **Step 1: Calendar → Profile** (Data back to five segments; its fourth move, all four
   his). ✅ **Step 3: `js/profile-records.js`** — *"what are my best lifts, ever?"*, a question the
   app could not answer. **Measured best leads, estimate follows labelled** (Rule 5); ordered by days
   trained, not pounds, because there is no honest ranking of a 405 deadlift against a 40 lateral
   raise (Rule 6). 🚩 **Steps 2, 4 and 5 are NOT done** — see Open work 29.

## 2026-09-09 — COLLAPSED TO A POINTER, 2026-09-12

⚠️ **The routine maintenance** — this file reached **159 KB of its 160 KB budget** and the rule is
the one in the byte-budget block below. Three passes, each with its own dated section in
`docs/history.md` (2026-09-09, first through third). **What Tim asked for, in order:** a friend's
profile is *"a mess"* on a laptop and their map is compared *"against people like YOU, not people
like THEM"* → the "Compared to" menu *"really doesn't need any words at all"* → Record should *"feel
more like a button that actually activates something"* → *"just combine the 2 and call them
'friends'"*, and *"if the wordiness fix isn't complete yet, then keep working on it."*

- **A friend's page got a laptop layout** (`.map-split` inside the pane; the host never takes
  `is-muscles`) and **their map is read against people like THEM** — `comparePreset('each')`,
  resolved per document, with `ownSexOf()` feeding the caption too, and the caption repainted on
  every change. 🔒 Durable half: the **Friends** row in `docs/state.md`. ⚠️ The lesson worth
  keeping: it survived because every fixture was male — the fixture is now female while the reader
  is male, because with one body the right and wrong answers are the same string for half the
  population.
- **The "Compared to" sheet is wordless** (Rule 9; the preset hints deleted, the untrained-adult
  caveat shortened never softened, read back by opening its dot) and **the pronouns follow the
  body** (*Like them · Their body weight · Their age*; *Own …* on the two-body screen). 🔒
  `docs/state.md`, Muscles row.
- **Record rises from the bottom** with a `down` slot in `screenShell` (🛑 not a back arrow — it
  lands on Home, Tim's instruction). `parkScreen()` in `ui.js` is the mechanism, and the two faults
  only a browser could show (screens legible through each other; a moved node restarting its
  animations) are in Rule 7 and the CSS. 🔄 **Superseded on 2026-09-10 and -12** — the stacking fix,
  the bar riding in the ghost, and the ghost released on `animationend`: see the Record row.
- **Open work 28 closed the cheap way** — one count called Friends, two routes still resolving, the
  public-account sentence ON the screen. Its row below stays.
- **The wordiness measured then cut**: transcribed systems' restated warnings (~240 words), the
  Goals weights block (182 → 30), one paragraph off Research (its teaching content carved out by
  name). 🚨 A test caught the Golden Six's warning had never carried its own disclaimer; it does now,
  and the assertions read the text a reader meets with a **sub-five-word** shared-run cap. 🛑 The
  Goals safety claim and the lay-off refusal moved word for word.
- ⚠️ **The audit swept phone widths only** — fixed the next day (four widths).

## 2026-09-08 — COLLAPSED TO A POINTER, 2026-09-11

⚠️ **The routine maintenance, not a loss** — this file reached **155 KB of its 160 KB budget** and the
rule below is that the write-up lives in `docs/history.md` while only the summary lives here, so the
oldest summaries go once the day is no longer what a fresh session orients on. Three passes, each with
its own dated section in the history. **What Tim asked for, in order:** the profile menu is *"really
wordy and complex"* (with a Hevy screenshot) → asked what was next, picked the read pattern and more
wordiness → **restructured the layout**, opening with *"deploy many sub-agents"*.

- **The nav was restructured**: the fifth tab became **Profile (`#/me`)** and Calendar went back into
  Data — where the sixth segment did not fit, measured at **58.86px past the right edge** at 360px,
  which is why `.segmented` scrolls. 🔒 Durable half: the **Profile**, **Data** and **Calendar** rows
  in `docs/state.md`. ⚠️ **Calendar's fourth move followed on 2026-09-10** and it is on Profile now.
- **"Left on this device" went and the upload became automatic** — `absorbThisDevice()`, on the paths
  that **CREATE** an account and never on sign-in. 🔒 Durable half: `docs/state.md`, "Creating an
  account absorbs this device", and §4's `store.js` block.
- 💷 **Open work 26 closed — opening the app stopped re-downloading a training history.** ~20× at
  every scale. 🚨 **The first version used a millisecond cursor with `>=` and a test caught it**;
  that whole story is Open work 26's row below, which stays.
- **The wordiness went to six screens**, every refusal left on the screen. 🔒 Durable half: Design
  Rule 9 in the handbook and the 2026-09-07 measurement block below.
- ⚠️ **An agent ran `git stash` mid-flight** and briefly reverted three other writers' files. 🔒 The
  standing instruction it produced — **no agent may run any git command that changes the working
  tree** — is in the standing instructions and stays there.
- **1,090 render assertions, 1,911 data-layer** on the day.

## 2026-09-07 — COLLAPSED TO A POINTER, 2026-09-10

⚠️ **Same routine maintenance as the two blocks below.** Four passes; each has its own dated section
in `docs/history.md`. **What Tim asked for, in order:** leave a workout and come back to it → the
screen after a workout finishes, plus *"how would that change storage"* about photos → a bin on the
bar → the app's wordiness → the bumpy muscle outlines.

- **Leaving a workout open.** The draft had always survived; **there was no way back**, and the app
  looked exactly as though it had thrown the workout away. The ✕ became a **▾**, a bar above the nav
  advertises the open workout on every screen, and **starting a second workout no longer deletes the
  first**. 🔒 `docs/state.md`, "Leaving a workout open".
- **Finish opens a save screen rather than saving.** 🔒 `docs/state.md`, "The save screen".
- 🆕 **Design Rule 9 came out of that day — the "?" holds WHY, never WHAT.** 🔒 `docs/handbook.md` §5.
- **The muscle outlines were bumpy because the MASK was, not the trace.** `smooth_fills()` low-passes
  each fill per connected component before tracing. 🔒 `docs/handbook.md` §4, `tools/build-body-art.py`.
- **Photos were costed.** 🔒 Now superseded by the fuller block in **START HERE**, where Tim paused
  them on 2026-09-10.

🚨 **THE ONE THING THAT STAYS HERE, because `docs/direction.md` §4.1 points at it by name — THE
WORDINESS MEASUREMENT, 2026-09-07:** **18,631 user-facing words, 304 sentences over 15 words, 63
blocks of 40+.** Ranked worst first by file: `research-topics.js` 54 · `preset-systems.js` 37 ·
`views-goals.js` 30 · `views-data.js` 28 · `views-social.js` 24 · `views-account.js` 19.
⚠️ **The top two are not the app's voice** — transcribed coaching notes, and teaching content that
already has word budgets. 🚨 **The finding: the copy is not padded, it is MIS-PLACED** — almost every
offender is the app explaining itself, and the standing rule that every caveat is stated on screen
never said WHERE. **`views-account.js` is done** (2026-09-08); the rest is what *"if the wordiness
fix isn't complete yet, then keep working on it"* authorises, and **he points at screens.**

## 💷 WHAT IT COSTS TO RUN — the numbers a fresh session should not re-derive

**`docs/running-costs.html`** is the full analysis, in the repo so it can be reopened; it is also an
artifact. `docs/history.md`, 2026-09-06 fifth pass, is how it was built.

- **$110/year, total, today** — Apple's $99 plus a domain. **GitHub Pages is $0 and structurally
  CANNOT bill** (it degrades and emails). **Basic Firebase Auth is $0 with no ceiling.**
- **Firestore is free to ~94 users**, and below ~1,000 users the fixed cost IS the whole bill.
- 🚨 **THE FINDING, AND IT IS ABOUT THIS CODE RATHER THAN GOOGLE'S PRICES: COST SCALES WITH A USER'S
  HISTORY, NOT THEIR TRAINING.** `readShard()` does `getDocs()` on the whole sessions collection
  **every cold open**, so a three-year user costs 3× a one-year user for the same exercise, and it
  never levels off. **Reads are 81 % of the bill at 10 k users.** Reading only what changed is worth
  **~20× at every scale** — free to ~1,894 users instead of ~94. ⚠️ **Offline persistence is already
  on and does not help**: a plain `getDoc` is billed even when the data is on the device, which the
  2026-08-22 nav note said without following it through to the cost. 🛑 **RECORDED, NOT QUEUED —
  nobody asked for it.**
- 🛑 **NO HARD SPENDING CAP EXISTS FOR FIRESTORE.** Google shipped spend caps 2026-07-28 and
  **Firestore and Auth are not eligible**. Alerts lag **up to days**; the only true stop deletes the
  billing account and the project with it.
- 🚨 **NEVER OPT INTO IDENTITY PLATFORM** — basic Auth is unlimited and free, and the upgrade bills
  **anonymous** users as monthly actives. **D12 makes this app anonymous-first**, so every abandoned
  browser profile would be a line item.
- ⚠️ **Region is a silent 2× fixed at database creation** — which one `fitness-tracker-th` uses was
  **not checked**, and it cannot be changed afterwards.
- ⚠️ **Ads are a worse fit than they look** — Apple 2.5.18 forbids behavioural ads on health data.
  **No ad revenue figure was modelled**: every available RPM number is vendor marketing.
- ⚠️ **PRICES WERE CONFIRMED 2026-09-01 AND WILL DRIFT. The measurements will not** — they are
  properties of this code. Re-confirm every price before re-quoting one.

### 🔒 Three lessons from today that are about METHOD, not about this app

- 🔒 **A RULE GUARDED BY ITS WEAKEST REASON GETS OVERTURNED BY WHOEVER SOLVES THAT REASON.** §9 and
  `exercises.js` both gave "the app does not record the height" as why two exercises are unrankable —
  **a problem the app can obviously solve** — when the binding reason was an unfixable mismatch of
  measurement bases. A session read it and set out to build the field. **State the binding reason
  first.** Corrected in three places, including the test that exists to stop somebody filling them in.
- ⚠️ **A MUTATION CHECK CAN LIE IN THE REASSURING DIRECTION.** One of mine passed because the
  mutation landed on a hex **in a comment** rather than in the rule it was testing. **A passing
  mutation check is evidence only once you know the mutation hit the code** — see §0.14.
- ⚠️ **A GREEN BROWSER AUDIT WITH A ZERO TEXT-NODE COUNT IS NOT A PASS.** The first run measured 404
  pages end to end — a stale server on the port — and reported zero contrast failures and zero
  overflow across all 128 routes. **Check the node count before reading anything else.**

## 2026-09-05 and 2026-09-06 — COLLAPSED TO POINTERS, 2026-09-10

⚠️ **The same routine maintenance as the block below.** Full dated sections in `docs/history.md`;
every standing consequence lives somewhere that is not a dated summary.

- **2026-09-05 — screens showing other people.** *"Relative to each"* (two bodies ranked against
  their own populations, now the default on the compare screen); **a friend's data IS the Data
  screen**, `GraphView()` with a subject, so their tabs cannot drift from yours; and "what they can
  see of yours" left a friend's page because it had become an account-wide setting sitting in a
  per-person position. 🔒 Durable half: the **Friends** and **Muscles** rows in `docs/state.md`.
- **2026-09-06 — every blank and refusal, then building the worth-building ones.** The muscle map
  **ranks without a profile** (a missing weigh-in widens the comparison rather than inventing a body
  weight; an assumed map is never published to a friend); **Goals kept its gate on purpose**, because
  a goal FREEZES its target weight; Volume states a rate at any window; custom exercises can set a
  level again **if the person names the closest library exercise**; the weight chart was **entirely
  in pounds for a kg user**; and a three-hop weight could reach the runner's field. 🛑 **The
  bar-height work was NOT built and §9's own diagnosis was why** — `docs/research.md` §15.
  🔒 Durable half: `docs/state.md`, `docs/handbook.md` §9, and the running-costs section below, which
  is that day's other half and **stays here**.

## ⚠️ 2026-09-04 — WHY THE NOTES ARE IN FIVE FILES NOW, AND THE RULE THAT KEEPS THEM THAT WAY

🚨 **THIS FILE HAD REACHED 626 KB AND COULD NO LONGER BE OPENED IN ONE READ.** The instruction at
the top of it said *"read this entire file before doing anything"*, and the tool a session uses to
do that refuses anything over 256 KB — **so the one instruction the whole workflow rests on had been
quietly impossible for some time, and nothing said so.** `chat.md` had crossed the same line at
424 KB. **The dated log was 52 % of this file and is pure history**, which is the cut that was made:

| File | What it is | Read it |
|---|---|---|
| **`progress.md`** (147 KB) | state, standing instructions, **Open work** | every session, top to bottom |
| **`docs/handbook.md`** (150 KB) | §0–§10 **except §3** — traps, agreement, architecture, rules, decisions | every session, with this one |
| **`docs/state.md`** (72 KB) | **§3 — what the app currently does**, screen by screen. Left the handbook 2026-09-08 | every session, with this one |
| **`docs/history.md`** (525 KB) | every dated session section, newest first | never whole — search it by date |
| **`chat.md`** (128 KB) | the human-readable log, **2026-08-29 onward** | only to answer "what did we say about X" |
| **`docs/chat-archive.md`** (341 KB) | the same log, **2026-08-14 to -26** | rarely; new entries never go here |

🚨 **THE RULE THAT STOPS THIS COMING BACK: A SESSION'S FULL WRITE-UP GOES AT THE TOP OF
`docs/history.md`, AND ONLY ITS ONE-LINE SUMMARY COMES HERE.** That is the whole mechanism, and it
is restated in §0.3. This file then grows by about two kilobytes a session instead of forty.

🚨 **AND THE RULE IS A TEST, NOT A GOOD INTENTION** — `tests/data-layer.test.mjs`, in the same block
that checks the `sw.js` precache list, because it is the same shape of fault: **a hand-maintained
fact about the repo that looks perfect from inside the session that broke it.** Every file a session
is *told to read whole* has a byte budget, and the budgets sit **well under the 256 KB limit so the
test fails while there is still room to act**, naming the fix rather than the number:

| | budget | now (2026-09-09, after the reset prep) |
|---|---|---|
| `progress.md` | 160 KB | **147 KB** ⚠️ **the tightest of the four, and it took a collapse to stay there.** It reached 154 KB before this session's prep and came back by folding **two** days — 2026-09-08's three passes and -09's three — into one section each. **That is the maintenance, and it is now the routine rather than the exception**: a day of passes is one section, and the write-ups live in `docs/history.md` |
| `docs/handbook.md` | 220 KB | **150 KB** ✅ |
| `docs/state.md` | 160 KB | **72 KB** ✅ |
| `chat.md` | 220 KB | **128 KB** ✅ |

✅ **`chat.md` WAS SPLIT ON 2026-09-08 AND THE ANSWER WAS SIMPLER THAN THE PREVIOUS NOTE THOUGHT.**
It had reached 216 KB of 220. The block here used to say the fix was "blocked" because
`docs/chat-archive.md` is marked *Closed* — **that reading was wrong.** "Closed" means **new session
entries** never go there; the budget test's own failure message names that file as the destination
for chat.md's older half, and doing it is the prescribed maintenance rather than a decision. 08-21 to
08-26 moved; `chat.md` now starts at 2026-08-29.

🔒 **RAW BYTES, VERIFIED LINE BY LINE — the method, not a detail.** All 2,598 non-blank lines of the
original were searched for in the two successors and every one was found. §0.11's failures were all
decode/re-encode round trips; a split that never decodes cannot damage an em dash.

✅ **AND THE HANDBOOK WAS SPLIT THE SAME DAY, FOR THE SAME REASON.** It stood at 215 KB of 220, and
**§3 alone was 68 KB — a third of the file**. Its failure message names that fix exactly: *"a section
has outgrown the handbook — split the offender into its own docs/ file and leave a pointer."* §3 is
`docs/state.md` now, with a budget of its own and a pointer where it was.

🚨 **§3 IS STILL CALLED §3 AND IS STILL READ EVERY SESSION.** Every `§3` citation in the project
resolves to `docs/state.md`; the section number never changed, only the file. ⚠️ **The danger of this
split is not a broken reference, it is a habit** — a file that stops being read because it stopped
being part of another one. It is named in the fresh-session instruction at the top of this file, in
the handbook's own header, and in §1's upkeep table, for that reason. 🛑 **The fix is never to raise
a number.**

🛑 **WHEN ONE TRIPS, THE FIX IS NEVER TO RAISE THE NUMBER** — the failure message says what to move
and where. ⚠️ **The two archives have NO budget on purpose**, and the test says so in a comment, so
that nobody "fixes" them to match: they are grep-then-read files and are allowed to be any size.
There is also an assertion that **§0.3 still states the rule**, because the files could stay split
while the habit that split them quietly lapsed. **Mutation-checked** — dropping progress.md's budget
to 80 KB fails exactly that one assertion, with the instruction in the message.

⚠️ **NOTHING WAS REWRITTEN IN THE MOVE, AND THAT WAS CHECKED RATHER THAN ASSERTED.** The split was
done on raw bytes, and every line of both originals was then searched for in its successors: the
only ones that did not turn up are the twenty-nine pointers deliberately rewritten (a "section
below" that is now a file name) and two `---` separators made redundant at a file boundary.

⚠️ **`docs/history.md` AND `docs/chat-archive.md` ARE STILL LARGER THAN ONE READ, DELIBERATELY.**
Splitting them further would mean guessing which month somebody wants. They are grep-then-read
files: search for the date, then read that range. **Only the files you are told to read whole are
small enough to read whole**, which is the property that was missing.

### Three files left the repository, and one of them had no business being public

🚨 **THIS SITE IS SERVED BY GITHUB PAGES, SO ANYTHING TRACKED HERE IS PUBLISHED.** Three files were
committed by accident and had been sitting in it: **`probe-body.tmp`** (empty, from a CDP probe on
2026-08-27) and **`record.png` + `sets.png`** (~200 KB of working screenshots of the app's own
Record and session screens, from 2026-08-25). Nothing referenced any of them — not `index.html`, not
`sw.js`'s precache, not a test. **They are deleted, and `.gitignore` now refuses `*.tmp` and any
`.png` at the repo root**, with the reason written above each rule so the next person does not
delete the rule instead of the file. ⚠️ **The screenshots were of THIS app, not of Hevy** — that was
checked before deleting, because the standing instruction about not committing somebody else's UI
would have made them a different kind of problem. An empty `docs/icon-options/` directory, left over
from the closed icon work, went with them.

### 🛑 WHAT WAS LOOKED AT AND DELIBERATELY LEFT ALONE — do not re-open these without a reason

Tim asked whether the code organisation could be improved too. **It was assessed and the answer was
no**, and the reasoning is here so the question does not get re-derived every time somebody notices
a 4,000-line file:

- **`js/store.js` (3,970 lines) STAYS ONE FILE.** Its last ~1,040 lines are a clean seam — the
  derived-data layer, `seriesForExercise()` through `activityByDate()` — and they use only five
  things from the head. **But `social.publish()` calls `buildStrengthShare()`, which lives in that
  tail**, so extracting it makes `store.js` and the new module import each other. That works in ES
  modules through hoisting, and "works through hoisting" is not a thing to introduce into the most
  load-bearing file in an app with **no build step** to catch a mistake. ⚠️ **And the line count
  overstates it: 1,522 of those lines are comment**, which is this project's own style and the
  reason its rules survive a chat reset. The same goes for `views-session.js` (41 % comment) and
  `muscle-evidence.js` (67 %).
- **`tests/render.test.mjs` (5,611 lines) AND `tests/data-layer.test.mjs` STAY ONE FILE EACH.** Both
  are flat scripts over **one jsdom and one progressively-seeded store**, so a block halfway down
  runs against everything the blocks above it wrote. Splitting them would silently change what each
  assertion is asserting against — **the count would still say 911 and it would be measuring
  something else**, which is precisely the failure mode this project keeps writing down.
- **`css/app.css` (4,263 lines) STAYS ONE FILE.** There is no build step, so splitting means either
  extra render-blocking `<link>`s or `@import`, which serialises the fetches. A single stylesheet is
  the right answer for this app and the MOTION section already owns the one thing that must not be
  scattered (Rule 7).
- **No dead modules.** Every file in `js/` is imported by something — checked against `sw.js`, the
  views and the tests. Nothing to delete.

## 🚨 2026-09-04 — TIM WAS INTERVIEWED ABOUT WHAT THIS PROJECT IS FOR, AND FOUR RULES FLIPPED

**`docs/direction.md` is the full record and it is required reading.** The summary, because these
change what you are allowed to do:

1. 🔄 **"Something is always better than nothing."** The blanket refusals are recalibrated — *"It's
   about getting the BEST numbers we can… have a way to be upfront about it but something is always
   better than nothing."* **Labelling survives; blank states do not.** ⚠️ **He does not want a
   sweep** — he will point at blanks himself. He did ask for **a list of where they are**.
2. 🔄 **The discovery feed is no longer refused** — *"It has to go eventually."* The twice-written
   🛑 was decided when this was for two people. **Nothing is built and no plan was asked for.**
3. 🔄 **Stop recording "not verified on a phone" warnings entirely** — *"I'm constantly testing
   almost every part of the cite so when something has a problem, I'll come to you."* **Shipped is
   working unless Tim says otherwise.** ⚠️ Still true of a *predicted number*, which no amount of
   looking at a screen can check.
4. 🛑 **Never touch visuals unprompted.** The app *"looks very AI-generated"* and fixing that
   *"needs a human perspective"*. **Wait for him, screen by screen.**

**And the frame:** it is a **real product for strangers**, going to the **App Store in the next few
months**, aiming *"as big as the biggest lifting apps or even bigger"*, free with at most enough
donation or ad revenue to cover its own costs. Scope order is **weightlifting → other exercise →
diet → others**. A **rename is coming** and he will bring it. He works on it **most days**, with no
deadline. 🛑 **He reads none of these notes — they are for you.**

## What changed on 2026-09-04, in one line each

1. **The docs were split into five files** so they can be read at all — see the section above.
2. **The direction interview** — `docs/direction.md`, and the four rules it reversed.
3. 🆕 **CORE IS A RANKED MUSCLE.** Key lift **Cable Crunch**, median 151/106 measured from Strength
   Level's 12,596 results, **its own log-spread (σ 0.48, not the global 0.32)** and its own
   **reliability penalty** so identical evidence reads *fair* on Core where it reads *high* on Chest.
   `UNRANKABLE` is down to Neck, Cardio, Activity. 🚨 **It rates about a QUARTER of how people train
   abs** — 22 of 30 core exercises record no load, and they keep the hatch. `docs/research.md` §14 is
   the pull and it is graded 🟡, the only 🟡 in the standards table, because the cross-check
   disagrees by 17 % where every other lift agrees within 3 %.
4. 🆕 **A NOTE TO THE DEVELOPER.** Users can send Tim an idea or a problem from the Account screen; his account reads them at `#/notes`. 🚨 **Enforced by `firestore.rules` against a hard-coded uid, not by hiding a screen** — the author cannot even read their own note back, and nobody can edit one. **Deliberately temporary**: it should come out when the first users stop being new. Rules deployed; proved with a real account on the live project and cleaned up after.
5. 🆕 **THE DEMO TRAINS ABS AND A NECK** — Cable Crunch so Core RANKS, Neck Curl so Neck HATCHES, which is the only way both of 2026-09-04's states are visible in the one account this project uses to look at every screen. Open work 25 closed. ⚠️ **It re-rolled the seeded year**; the golden table was re-baselined after checking every number was still plausible.
6. 🆕 **`research.md` §2's transcription error is fixed** — 95 % is ~2 reps, not ~5, and a second cell was wrong too. Both were SHIFTS from neighbouring cells, which is why it looked sound. Open work 20 closed.
7. 🆕 **THE ABS COLOUR IS FIXED.** A muscle with no published standards but recorded work is now
   **hatched**, with its own key entry, and tapping it says what HAS been logged. It used to wear the
   same grey as a muscle nobody had ever trained, while the same screen printed *"Core and Neck can't
   be ranked"* two lines below — **the app was right in words and wrong in colour at the same time**.
   Full write-up in `docs/history.md`. ⚠️ **The demo cannot show this state and a fix for that was
   deliberately reverted** — see Open work 25.

# 🟢 START HERE: NOTHING IS HALF-BUILT

**Everything is pushed and every runnable suite was green on 2026-09-12** — including **1,330 render
assertions**, **2,021 data-layer** and **131 a11y**. ⚠️ **The 218 rules assertions were last run on
2026-09-10**; that suite needs the emulator (§0.9) and was not re-run since, because nothing this
session touched `firestore.rules`.

🚩 **THREE THINGS FLAGGED FOR TIM ON 2026-09-12, NONE CHANGED**: fill-on-open meets the set lock (a
copied set 2 locks when you go back to set 1 — visible now, was silent); the Profile tab's Months/
Years pill is the one segmented control that repaints instead of sliding (`wireSegmented` never
reaches it — one line, visual, his); `pointercancel` on the exercises drag commits the slot under
the finger rather than abandoning.

✅ **THE PROFILE/DATA SPLIT IS DONE — all five steps, Open work 29 closed 2026-09-11.** Read that
entry before touching Profile, Data, Account or Settings: it carries the line the whole thing rests
on, which is `direction.md` §4b's.

🛑 **AND READ THE "CATCH UP" RULE AT THE TOP OF THIS FILE BEFORE PICKING ANYTHING UP.** A session
that opens with *"catch up with progress.md"* reads and reports; it does not start.

⚠️ **THERE ARE TWENTY SUITE FILES, NOT SEVENTEEN, AND NINETEEN OF THEM RUN HERE UNAIDED** — recounted
2026-09-09 by running every one. `tests/rules.test.mjs` is the twentieth and needs
`npm i --no-save @firebase/rules-unit-testing` plus the emulator (§0.9), so it is not in that green.
🛑 **Do not report "all twenty green" off a run that skipped it.**

✅ **2026-09-09 WAS THREE PASSES AND THE ONE-LINERS ARE ABOVE.** In order: a friend's page got a real
laptop layout and **their muscle map is now read against people like THEM rather than like the
reader**; **Record rises from the bottom** with a **down arrow** that pushes it back onto Home (🛑 it
is `down`, not `back` — it lands on Home whatever you came from, which is what he asked for); and the
Profile tab's two social counts became **one, called Friends**, alongside more of the wordiness.

⏸️ **HE TOOK ONE ITEM FOR HIMSELF THE SAME DAY AND IT IS NOT YOURS**: checking the estimator against a
real attempt (Open work 19). *"I'll do 4 myself sometime this week, but I'll come to you about it."*
🛑 **Do not start it and do not offer it again.**

✅ ~~**THE BROWSER AUDIT HAS NEVER MEASURED A DESKTOP WIDTH**~~ **FIXED 2026-09-10** — it sweeps
**360 / 390 / 880 / 1280** with `mobile` set per width. 🔒 The phone rows are provably unchanged
(6,071 + 6,136 = **12,207**, byte-identical to the 2026-09-08 figure). 🚨 **The first desktop sweep
immediately found an AA failure** — the active sidebar nav label at 3.96:1 — which is the same
`--accent`-on-`--accent-dim` pair "fixed" on 2026-09-06 **for the one element a phone-width audit
could see.** Reading the stylesheet for the pair found four more. **The lesson is the scope of the
original fix: "every element that paints this today" means "every element the tool I ran can
reach".** ⚠️ **`tools/a11y-audit.mjs` still does not cover a friend's page** — their uid is
generated, so there is no static hash for the route list.

⚠️ **`tests/sw-update.test.mjs` REMAINS FLAKY ON THIS MACHINE.** Recorded 2026-09-07, and on
2026-09-08 it failed once and passed three times across the day — always on *"the service worker
takes control on the second load"*. **The control was measured rather than assumed** back then (three
runs against a stashed, committed baseline failed 4 / 4 / 1). 🛑 **Do not report it as reliably
passing, and do not "fix" it by weakening it.** ⚠️ **One new thing to check first if it ever goes
consistently red: `js/views-me.js` joined `sw.js`'s precache on 2026-09-08**, and a precache entry
that cannot be fetched fails an install.

🛑 **BETWEEN JOBS, SAY WHAT IS DONE AND STOP — DO NOT PROPOSE WHAT TO BUILD NEXT** (§1, and Tim has
asked for that twice). ⚠️ **He does ask "what's next?" directly, and then a real ranked answer is
wanted** — that is a question, not an opening. The pinned items (P1–P4) and the four he said he would
raise himself stay out of the answer either way.

⚠️ **DO NOT WRITE "not verified on a phone" ANYWHERE** — `docs/direction.md` §3.3, and it is the rule
this file has broken most often. Shipped is working unless Tim says otherwise.

**Four things sit unbuilt on purpose, and none is a loose end:**

- ✅ ~~**The read-pattern change**~~ **BUILT 2026-09-08** — Tim picked it when asked what was next.
  Open work 26.
- 🛑 **Asking about public/private on first sign-in** — offered in the same ranked answer and **he
  took it himself**: *"I'll work on #2 along with some other things later."* Do not build it.
- 🛑 **The abs ranking** — his, and open. Below.
- 🛑 **The rest of the wordiness** — the mechanism, the rule (Design Rule 9) and the test pattern all
  exist. Volume and Goals went on 2026-09-07; **the whole of `#/account` and `#/profile` went on
  2026-09-08 because he pointed at them**, which is `views-account.js` (ranked 19) done. The ranked
  list is in the 2026-09-07 summary above.
  ⚠️ **He asked for the analysis first and it is delivered; he points at screens from here.** 🛑 **And
  Research's teaching content is carved out by name** — `docs/direction.md` §4.1.
- 🛑 **Photos — PAUSED BY TIM, 2026-09-10, after a second round of costing.** *"lets keep a pause on
  the photos for now. I don't think it's necessary yet."* 🛑 **Do not raise it again; he will.**
  Costed 2026-09-07 (~$100/yr at 1,000 users, ~$2,500/yr at 10,000) and re-examined today at the
  scale he actually has. What that round established, so nobody re-derives it:
  - **Per user it is 10–25¢ a year** — but the figure **RISES with scale**, uniquely in this app,
    because the bill is people LOOKING and more users means more eyes per photo.
  - 🔒 **STORAGE NOW NEEDS BLAZE AS A PLAN GATE, NOT A QUOTA — confirmed live 2026-09-10.** Since
    **3 February 2026** Google aligned Cloud Storage for Firebase with standard Cloud Storage rules:
    creating *or keeping* a bucket needs a linked billing account whatever the usage, and a Spark
    project's Storage calls return **402/403**. 🚨 **THE FIREBASE PRICING PAGE STILL ADVERTISES SPARK
    ALLOWANCES FOR STORAGE, so reading that page alone gives the WRONG answer** — this is written
    down because the next session to check will land on the same page.
  - ✅ **At his real scale the bill would be zero.** The free allowances still apply on Blaze; at 10
    users it is ~416 MB stored against 5 GB and ~10 MB/day of egress against 1 GB/day.
  - **Where paying actually starts, on a modern `firebasestorage.app` bucket: ~145 users**, and it is
    **download OPERATIONS** (50K/month) that bind first, not bandwidth (~1,480 users). ⚠️ **Storage
    is measured in USER-YEARS** — 5 GB ≈ 120 user-years, cumulative, and arrives without a single new
    user. ⚠️ **The ~20-viewers-per-photo assumption is unmeasured** and thumbnails plus cache headers
    could multiply the 145 several times.
  - 💷 **WITHOUT photos the app is free to ~1,894 users** (after the 2026-09-08 read-pattern fix).
    **Photos are what would move that ceiling to ~145.**

## ⏸️ THE OPEN THREAD THAT IS TIM'S: HOW TO RANK ABS — he asked, it was answered, HE HAS NOT PICKED

Tim, 2026-09-03: *"I want to finally design a way to rank ab muscles on the muscle group strength
display. I have a few ideas, but I want you to see if there are any problems or whatever with
them… Let me know if you have any other ideas on this topic."*

**The assessment he asked for is `docs/history.md`, "2026-09-03 — HOW TO RANK ABS"**. It was
delivered; he then sent an unrelated instruction about privacy defaults and never came back to it, so
**the choice is still his and nothing is built.** ⚠️ **Do not start building any of it.** If he
raises it, the three options and their costs are written out; if he does not, leave it alone.

⚠️ **THIS UN-DEFERS THE OLD "skip the abs" NOTE**, which is kept below because it is still exactly
true and is the thing option (a) fixes. He deferred it on 2026-09-01 and re-opened it himself on
2026-09-03.

## 🚨 THE ONE THING TO KNOW ABOUT THE LIVE STATE

⚠️ **THIS WAS TRUE ON 2026-09-03 AND NOBODY HAS CHECKED SINCE — it resolves itself the moment she
opens the app once, so treat it as "may already be fixed" rather than as current fact.**

**Autumn's account had not opened the app as of 2026-09-03, so it was still on the OLD sharing
model** — `shared/full`, published 2026-08-31. Tim's is migrated. **This is normal and handled**:
each account migrates its own documents on its own device, and a reader falls back to the tier
documents (`social.friend()` probes `friends` → `public` → `full`/`mid`/`light`). Her map, her cards
and her workouts all read fine through that path; what it cannot do is the tappable panel or a
comparison, and both screens say so by name.

**It resolves itself the moment she opens the app once.** ⚠️ **If a future session sees "their app
has not updated" anywhere, that is this, and it is not a bug.** The fallback is marked for deletion
once nobody is left on an old build.

## 2026-09-02 and 2026-09-03 — COLLAPSED TO POINTERS, 2026-09-10

⚠️ **THIS IS THE ROUTINE MAINTENANCE, NOT A LOSS.** This file reached **153 KB of its 160 KB budget**
and the rule is the one in the byte-budget block below: **the write-up lives in `docs/history.md` and
only the summary lives here** — so the oldest summaries go once their day is no longer what a fresh
session needs to orient on. Both days have their full dated sections in the history, and **every
standing consequence of them is recorded somewhere that is not a dated summary**, which is the test
for whether a day may be collapsed:

- **2026-09-03 — the visibility rewrite.** Three tiers became **private or public, public by
  default**; a friend's muscle map became tappable; their volume and graphs; the two-body compare
  screen; and the legacy-read fallback for an unmigrated friend. 🔒 **The durable half is `D29` in
  `docs/handbook.md` §6** and the "Who can see you" row in `docs/state.md`; the unbuilt follow-up
  (*ask on first sign-in*) is in **START HERE**, above.
- **2026-09-02 — the Hevy-shaped feed, Rule 8 and the estimator.** The home feed, a friend's workout
  on its own screen, comparison, copy-as-routine, the shareable picture; **back means the screen you
  were just on** (`Rule 8`); and an estimated 1RM for every exercise. 🔒 **The durable half is Rule 8
  in the handbook** and the Friends and Data rows in `docs/state.md`.

**Search `docs/history.md` for the date for either of them.**

## The five things a fresh session most needs to know

1. ⏸️ **THREE DECISIONS ARE TIM'S, AND MUST NOT BE MADE BY IMPLEMENTING THEM.**
   **(a) Should a warm-up be typed by the lifter?** — still the highest-value item on the list. Every
   recorded set counts everywhere until he says otherwise, and the screens say so
   (`docs/social-plan.md` §12.16, Open work 0c). **(b) Per-WORKOUT visibility?** — ⚠️ **the "as well
   as per-person" half of that question died on 2026-09-03**; per-person is gone, so a per-workout
   flag is now the only granularity left to ask for (`docs/social-plan.md` §13 decision B, §15).
   **(c) Ratify D18?** — Open question 1, unanswered since 2026-08-16.
2. ⏸️ **VOLUME IN POUNDS IS NOT BUILT.** Tim asked for a set count instead — *"Replace Volume for # of
   sets"* — and `js/session-stats.js`'s header records why that is also the more honest column.
3. 🔄 ~~**NOTHING HAS BEEN ON A PHONE**~~ **DROPPED BY TIM ON 2026-09-04 AND MUST NOT COME BACK.**
   *"Don't record the 'not verified on iphone' warnings at all. I'm constantly testing almost every
   part of the cite so when something has a problem, I'll come to you."* 🔒 **Shipped is working
   unless he says otherwise.** ⚠️ **It was device verification he waived, not arithmetic** — item 4
   below is a different claim and still stands, because a wrong prediction looks exactly like a
   right one however long you stare at the screen. `docs/direction.md` §3.3.
4. 🚨 **NO HUMAN HAS CHECKED A SINGLE PREDICTED NUMBER AGAINST AN ACTUAL ATTEMPT.** The estimator
   rests on a curve whose absolute accuracy was never validated (`docs/research.md` §1.3) and on
   ratios describing a population rather than a person. Everything it prints ships with a confidence
   and a source list for that reason. **Do not describe any of it as accurate.** Open work 19.
5. ⚠️ **THE HEVY SCREENSHOTS ARE DELIBERATELY NOT IN THE REPOSITORY** — it is public and they are
   somebody else's UI. `docs/social-plan.md` §12.12, §12.13 and §12.15 are written in enough detail
   to build from **because they are the record**. Do not look for image files; do not commit any.

## Standing instructions that survive a reset

- 🛑 **"CATCH UP WITH PROGRESS.MD" IS AN INSTRUCTION TO READ, NOT TO BUILD — Tim, 2026-09-11.**
  *"When I tell you to catch up with progress.md, you should not start working on anything until I
  tell you. It's okay to tell me what you think next steps are, but don't start working until I tell
  you to."* 🚨 **An authorisation recorded in an earlier session is not an instruction to resume it
  in this one**, however green the light looks in these notes — that is exactly how this rule got
  broken. Read the four files, report in a few plain lines, **stop**. Naming what looks next is
  welcome; picking it up is not.
- 🛑 **NEVER TOUCH VISUALS UNPROMPTED — 2026-09-04, and it is the strongest instruction on this
  list.** The app *"looks very AI-generated and not very professional"*, and *"I don't want you to
  automatically go fixing things yourself, I think it needs a human perspective."* **Wait for him,
  screen by screen.** He points, you execute. The same applies to the app's **wording**, which he
  called wordy and then deferred: 🛑 **do not shorten copy globally.**
- 🛑 **DO NOT ASK HIM ABOUT OTHER PEOPLE'S OPINIONS** — *"I don't want you to ask me about other's
  oppinions."* Autumn is not a design input to be polled.
- 🛑 **RECOMMEND ONLY WHEN ASKED**, and then give a real ranked answer. The one exception he granted:
  if a decision being made now would be **expensive to undo once moderation exists**, say so at the
  time. Nothing else gets raised unprompted.
- 🛑 **THE APP ICON IS CLOSED AND MUST NOT BE REOPENED** (2026-08-30, fourth pass).
- 🔄 ~~**DO NOT BUILD THE DISCOVERY FEED**~~ **THE REFUSAL IS LIFTED — Tim, 2026-09-04: "It has to go
  eventually."** It was decided twice in writing, and both times the premise was an app for two
  people. 🛑 **Nothing is built and no plan was asked for** — but do not quote `social-plan.md`
  §12.11 at him as settled law. `docs/direction.md` §3.2.
- 🛑 **MODERATION AND SAFETY: NOTED, NO PLAN, NO WORK.** *"I'm not concerned about saftey whatsoever
  as of right now."* Reporting and blocking are wanted eventually — *"just put it in the notes."*
- 🛑 **A RENAME IS COMING AND HE WILL BRING IT.** "Fitness Tracker" is a placeholder. **Do not push
  him on it**; just keep the string cheap to change.
- 🟢 **SUB-AGENTS ARE WANTED, AND HE HAS ASKED TWICE** — *"Deploy many sub-agents to get it done if
  you need"*, then *"Remember to delploy sub-agents."* 🚨 **THE THING THAT MAKES IT WORK IS DISJOINT
  FILE SETS.** On 2026-09-06 four agents wrote at once with a named list of files each may edit and a
  named list it may not, and **nobody was allowed near `css/app.css` or `tests/`** — the two places
  four writers collide *silently*. Tests, integration and both audits were done afterwards in one
  pass. ⚠️ **Agents must not commit**, and they must be told to run the suites and report verbatim.
  🚨 **AND SINCE 2026-09-08 "DO NOT COMMIT" IS NOT ENOUGH — AN AGENT MAY NOT RUN ANY GIT COMMAND THAT
  CHANGES THE WORKING TREE.** One ran `git stash` to get a clean test baseline and briefly reverted
  three other writers' files; `git stash pop` then refused, because two of them had written again in
  the meantime. Nothing was lost — it recovered everything and reported the incident unprompted — but
  *"do not commit"* turned out to be one instance of the rule rather than the rule. **No `stash`, no
  `reset`, no `checkout`, no `restore`.** ⚠️ **It also confirmed the arrangement works**: three
  agents ran at once on 2026-09-08 on one named file each and none of them collided.
  ⚠️ **The 2026-08-22 note about wave size was about REVIEW agents**; four writing at once is a
  different thing and it held.
  🆕 **AND TWO MORE RULES FROM 2026-09-12, when three wrote at once again**: (1) 🚨 **the live suite
  is red for everybody while anybody is mid-flight** — a half-built feature in one agent's file
  crashed `render.test.mjs` for the others — so **an agent that needs a green run builds it in an
  isolated scratch copy with the other agents' files at HEAD**, and the brief says so; (2) **one
  agent owns `tests/`**; the others write complete `ok(...)` blocks and the rewrites of any existing
  assertion their change breaks to a scratchpad file, and the integrator places them afterwards —
  58 assertions went in verbatim that way and passed first time. ⚠️ Give each agent Tim's words
  verbatim, the files it may and may not touch by name, and the rule that CSS belongs to at most one
  of them.
- ⚠️ **AGENTS FLAG THEIR OWN NEAR-MISSES, AND THOSE ARE WORTH READING CLOSELY.** On 2026-09-06 one
  reported that it had nearly put two meanings in one field and asked for a second opinion — it was
  right, and the fix went in. Another found a real bug on the logging path it had been told not to
  touch, and reported rather than fixed it. **Read the "what I decided NOT to do" section of every
  agent report.**
- 🛑 **DO NOT SURFACE THE PINNED ITEMS (P1–P4)** as "the next thing to do" — Tim's standing
  instruction, 2026-08-28. Build them if he names them; otherwise leave them alone.
- 🛑 **NOR THE FOUR OPEN-WORK ITEMS HE WAS SHOWN ON 2026-09-04** — handles, checking the estimator,
  the two-account round trip, warm-up typing. *"All of these are things I want to work on, but I'll
  let you know about them."* **Wanted, none authorised.**
- 🆕 **The abs question is OPEN again — Tim re-opened it himself on 2026-09-03**, and on 2026-09-04
  said *"I'll talk to you about it after questioning. don't do anything now."* ~~deferred~~
- ⚠️ **NEVER BULK-EDIT A MARKDOWN FILE THROUGH A SCRIPT.** §0.11 says it about PowerShell; on
  2026-09-02 the same mistake was made in **Python** — `open(path, 'w')` truncated this file to zero
  bytes and then died on an emoji surrogate before writing a byte back. Recovered with
  `git checkout --`, which is the only reason it cost a minute. **Use the editing tools for file
  content and keep scripts for running things.** ⚠️ **AND THE RULE HELD ITS GROUND AGAIN ON
  2026-09-03**: a scripted two-string replacement in this file worked fine, twice — which is exactly
  how the habit comes back. The tools are not slower for one edit; they are only slower for the
  ten-edit sweep that is the one you should not be doing.
- ⚠️ **A `.js` FILE EDITED BY SCRIPT REWRITES ITS LINE ENDINGS.** The same day, a Python edit to
  `views-workouts.js` converted the whole file from CRLF to LF. Harmless here — git normalises, and
  the diff stayed at ten lines — but it is noise in a review and it is avoidable.

---

**The most recent session is the 2026-09-03 pair at the top of `docs/history.md`** — the visibility
rewrite, the friend's tappable map and the compare screen, the public default, the legacy-read
fallback, and the abs assessment. The four 2026-09-02 sections under them are the one before it (the
Hevy-shaped feed, Rule 8, the estimator), and the 2026-09-01 sections under those are the one before
that. **The file is newest-first throughout.**

🆕 **THE ABS QUESTION IS NO LONGER DEFERRED — TIM RE-OPENED IT HIMSELF ON 2026-09-03** and asked for
the problems with two approaches of his own. The assessment is in `docs/history.md`; **the decision
is his and nothing is built.** The paragraph below is the 2026-09-01 finding, kept here rather than
archived because it is still exactly true and is the thing part (a) of that assessment fixes:

~~⏸️ **THE ABS QUESTION IS DEFERRED BY TIM, 2026-09-01: *"skip the abs"*.**~~ It is not closed and not
withdrawn — he was offered it as the standing loose end and chose other work. The finding: **the panel is honest
and the COLOUR is not** — Core and Neck are permanently unrankable (no published standards exist),
and the panel says exactly that when you tap them, but the body map paints them **grey**, and the
only grey entry in the legend is **"No data."** So somebody who trains abs three times a week sees
the same colour as somebody who has never done a sit-up. **His core work is counted, and as of
2026-09-01 it is on a screen of its own** — Data → Volume shows its weekly sets with every other
muscle, which is a partial answer to the same complaint from the other side. The two fixes offered
and unanswered: give unrankable muscles their own mark and legend entry, and/or have the panel say
what HAS been logged.

⏸️ **TIM ASKED FOR NO PHONE VERIFICATION ON 2026-09-01 — *"skip any verification (I'll tell you if
it's not working)"* — AND THAT IS STILL WHERE THINGS STAND.** It is about HIS phone rather than about
the machines: the tests, the audit and the browser measurements all ran as usual, on that session and
on 2026-09-02. It means the field-check list (Open work 1) has not moved in two sessions and must
never be reported as if it had.

⚠️ **THE DATES IN THIS FILE ARE SESSIONS, NOT CALENDAR DAYS.** Every commit from `e1a7afd` onward
carries a git date of **2026-08-26** or **-27**, including everything headed -28 and -29. Headings
keep the sequence a reader navigates by; never compute an interval from them.

---

## Open work — start here

### ⚠️ THE INDEX. Read this first; the lettered sections below are in the order they were WRITTEN

**Rebuilt 2026-08-28.** More than half is closed work, and **everything left that needs nothing from
Tim has been deliberately PINNED rather than queued** — see the pinned table and read its rule
before suggesting anything from it.

**Nothing is blocking. Tim can use the app and is on a current build (0a, closed).**

⚠️ **EVERY REFERENCE BELOW TO A DATED SECTION MEANS `docs/history.md`** — "the 2026-08-28 section",
"that day's fourth-pass section", "the fifth-pass section". They were all in this file until
2026-09-04 and the wording was left alone rather than swept, because rewriting a dozen pointers by
hand is how a wrong one gets introduced. **One rule, applied everywhere: a date means the history.**

⚠️ **OPEN WORK FIRST, THEN WHAT CLOSED.** The letters are historical ids and cannot be renumbered —
things elsewhere in this file and in `docs/` cite them ("Open work 0b and 1"), and moving one would
break a reference somebody follows. **This table is the reading order instead**, and as of
2026-08-27 more than half of it is closed, so the closed rows are collected at the bottom rather
than left at the top where they were written.

### Open, in the order worth picking up

| | What | State |
|---|---|---|
| **26** | ✅ ~~the read pattern — the running cost of this app~~ **BUILT 2026-09-08, on Tim's pick** | `where('updatedAt', '>', cursor)` plus an aggregation **count to catch deletes**, so a cold open pays for what CHANGED rather than for a whole training history. **~20× at every scale** — free servers to ~1,894 users instead of ~94. 🚨 **The first version used a MILLISECOND cursor with `>=` and was worse than useless for the accounts with the most data**: Firestore stamps a batch with one instant, so a restore or a 1,200-row adoption pinned the cursor and re-read everything every sync. A test caught it. 🔒 **Every uncertain path falls back to the full read.** ⚠️ **What is NOT done**: this has never run against real Firestore — the aggregation query, the `>` on a real server timestamp and the rules' `list` on an aggregation are all reviewed rather than executed, exactly like the rest of this file's network paths. `docs/running-costs.html`, `docs/history.md` 2026-09-08 second pass |
| **28** | ✅ ~~"followers / following" is Instagram's vocabulary for a graph this app does not have~~ **DECIDED AND DONE 2026-09-09 — THE WORDS CHANGED, NOT THE MODEL** | Tim, asked which way and given both costs: *"just combine the 2 and call them 'friends' instead. We might change it to following/folowers later."* **One count, called Friends.** ⚠️ **He kept the other door open, and the thing that keeps it cheap is that there is no migration** — nothing was built or deleted here; `connections` is the same list it always was and this is two labels over it. 🔒 **`#/me/followers` and `#/me/following` still resolve**, onto the one list, which is titled Friends however you arrive — asserted, because a screen still headed "Followers" would be the rename half-done. ✂️ **The "?" went with the second number** (it existed to explain why two figures were equal); 🚨 **the public-account caveat did NOT** — *"Your account is public, so people can see your training without being friends"* is on the screen, only where it is true, because without it the number reads as an audience. `docs/history.md` 2026-09-09 third pass ~~ Tim asked for those three counts by name and they shipped, honestly: connections here are **mutual**, so the two numbers are always equal, and the "?" beside them says so. ⚠️ **On a PUBLIC account the number is also a floor rather than an audience** — anybody signed in can read you without connecting, and none of them are in the graph; the ? says that too. 🚩 **The open question is which way to resolve it**: change the words to match the model (Friends / Connections — cheap, and it is what the rest of the app already calls them), or change the model to match the words — **a real follow model, with new rules, a migration, an asymmetric graph and a moderation surface attached**, which is a feature nobody has asked for. 🛑 **Do not pick one on his behalf.** `docs/history.md` 2026-09-08 third pass, §C |
| **29** | ✅ ~~**THE PROFILE/DATA SPLIT**~~ **FINISHED 2026-09-11 — all five steps** | 🟢 Authorised 2026-09-10 (*"I like all of that. Start working on it now."*), steps 1 and 3 that day, **2, 4 and 5 on 2026-09-11**. ✅ **Step 2** — sex, age and current weight on `#/me`, ⚠️ a DISPLAY move: the row opens `#/profile`, which stays the form. ✅ **Step 4** — Goals off Settings, 🚨 the old row **deleted rather than left as a second door**, `#/goals` still resolving, and 🛑 **no verdict followed it onto the tab**. ✅ **Step 5** — the facts readout came off the Account row (Profile prints them now) and a "Profile" heading over one row went, that word having meant a TAB since 2026-09-08. 🚨 **Building it found that `#/me` had never been in the accessibility audit's route list** — the row called *Profile* is `#/profile`, the form. Fixed and swept. 🔒 **`#/me` holds no field at all, asserted** — `direction.md` §4a's line between the two profile screens. `docs/history.md` 2026-09-11 ~~ The plan he approved, in his order: **1 Calendar → Profile**, **2 body facts (gender, birth year, body weight) → Profile**, **3 personal bests → Profile**, **4 Goals: Settings → Profile**, **5 Account cleanup — whatever is left after 2 and 4.** 🚨 **The rule the whole thing rests on: Data answers what your training MEANS, Profile answers what you DID.** That is what fixed the segment overflow and the empty Profile in one cut. ⚠️ **Step 2 is a DISPLAY move, not a form move** — `#/me` never writes, and `#/profile` stays the form; Profile shows sex, age and current weight and links to it. ⚠️ **Every moved route must keep resolving** (`#/calendar`, `#/day`, `#/edit`, `#/profile`, `#/goals`) — asserted, and `#/calendar` has survived four moves without breaking a link. 🛑 **Nothing goes on Home** — `direction.md` §4a is a placement rule, not a request |
| **27** | ✅ ~~**"DELETE ACCOUNT" LEAVES THE SESSIONS IN FIRESTORE**~~ **FIXED 2026-09-10** | The finding was bigger than the entry: **five of ten collections were never named** (bodyWeight, systems, goals, people, guestSessions), `sessions` was named and still failed on the mass-delete guard, and **`write()` cannot address `shared/*` at all** — so a public account that deleted itself left its published training readable by anybody signed in, permanently, because after `deleteUser()` every rule is `isOwner` and the owner is gone. ✅ `createAccountPurge()` in `js/firebase-backend.js` walks every subcollection, `shared` and `reactions` first (the revocation order), empties the ten whole-list documents that rules forbid deleting, then **RE-READS and refuses to delete the auth user if anything survived**. 🚨 **`wholesale` was deliberately not the fix** — the guard exists so nobody sprinkles it, and the flows allowed to use it snapshot to the cloud first, which for an account about to stop existing is one more unreachable billable document. Proved on the emulator (218 assertions) and against the double. ⚠️ **Still never run against real Firestore.** ~~ |
| **27-old** | 🚨 **the original entry, kept for the reasoning** | ⚠️ **Found while reading that code for the read-pattern work, not by using the app, and it is Tim's call rather than a quiet fix.** `FirebaseBackend.deleteAccount()` clears five collections with `this.write(name, [])` and **passes no `wholesale` flag**, so for `sessions` the mass-delete guard (2026-08-28, *"make it extremely difficult to erase data from people's accounts"*) refuses the write outright. The throw is caught and logged, `deleteUser()` then runs, and **every session document stays at `users/{uid}/sessions/*` for an account that can never sign in again** — unreachable under the rules, but present, billable, and not what somebody pressing *Delete everything permanently* was promised. ⚠️ **`guestSessions` is not even in the list.** 🛑 **The fix is one word (`{ wholesale: true }`) plus that collection, and it is deliberately not made here**: the guard exists precisely so nobody sprinkles that flag around, and the two flows already allowed to use it snapshot to the cloud first — which is meaningless for an account being deleted, so the right shape needs a decision rather than a keystroke |
| **25b** | 🆕 **the demo has no TIME-based strength set** | ⚠️ Left over from 25. The generator writes every set as `{weight, reps}`, so there is no plank, L-sit or dead hang anywhere in the demo year — a shape the app supports and the demo cannot show. Small; nobody has asked |
| **25** | ✅ ~~the demo cannot show a trained-but-unrankable muscle~~ **FIXED 2026-09-04** | Cable Crunch (Core ranks) and Neck Curl (Neck hatches) — one of each, because the two states cannot sit on one muscle now Core is rankable. Tim authorised the re-baseline it forced. ⚠️ **Still open, and smaller**: the generator writes every set as `{weight, reps}`, so the demo has no TIME-based strength set anywhere — no plank, no L-sit, no dead hang. ~~ ⚠️ **A REVERTED FIX, not an oversight, and the reasoning is why it is listed.** The generated year holds exactly one ab exercise (a Plank, in a Full Body workout the demo never runs), so the demo's Core is permanently "nothing recorded" and **the hatch shipped 2026-09-04 is unreachable there** — it cannot be screenshotted, audited or shown to anybody. Adding a Cable Crunch to Lower A fixes it and **re-rolls the whole seeded year**: every later `random()` draw shifts, which moves the goal-progress assertions and invalidates the golden observation table in `data-layer.test.mjs` that exists to catch regressions in `buildObservations()`. 🛑 **Re-baselining a regression pin is Tim's call, not a side effect of a colour fix** — so it was backed out. ⚠️ **A Plank cannot be the answer**: the demo's set builder only ever writes `{weight, reps}`, so it would be a fixture in a shape the app never produces — the `sets: []` fault again. **Two ways out: accept the re-roll, or give the generator a time-only path** |
| **23** | ✅ ~~a note to the developer~~ **BUILT 2026-09-04** | Form on Account, inbox at `#/notes`, `js/feedback.js` + a `feedback/{noteId}` collection. 🚨 **The developer is a hard-coded uid in `firestore.rules`** and the screen protects nothing; the author cannot read their own note back and nobody can edit one. Rules deployed and proved on the live project. 🛑 **TEMPORARY — take it out when the first users stop being new**, or it becomes a support inbox nobody is staffing. ~~ 🟢 **AUTHORISED, and he said to build it once questioning finished.** *"adding a temporary section to the app that allows the user to write a note or idea straight to the developer (me) would be nice to have. Then, make my account (timhadfield7@gmail.com) a developer account where I can read all these notes or ideas straight on the app."* ⚠️ **DELIBERATELY TEMPORARY** — it exists to catch fresh opinions while the first users are new, not forever. 🚨 **The developer role has to be enforced by `firestore.rules`, not by hiding a screen**: these are other people's words about their own training, and "only Tim can read them" has to be true on the wire. ⚠️ **It is also the first user-submitted free text this app has ever stored**, which is the moderation surface he parked the same day — worth one sentence to him if a decision here would be expensive to undo, and nothing more (that is the single exception he granted to staying quiet) |
| **24** | ✅ ~~the list of every blank and refusal~~ **DELIVERED AND THEN BUILT, 2026-09-06** | The list went to Tim (eight places the app held data and said nothing, nine permanent refusals, twenty honest first-run blanks) and he answered: *"make a plan for each one and start building. Don't ask me questions, just go with whatever you recommend."* ✅ **All eight of the first group shipped that day** — see the 2026-09-06 summary at the top of this file. 🛑 **Two were deliberately NOT built and the reasons are the point**: the Goals profile gate (a goal FREEZES its target weight, so an assumption made once outlives every screen that would relabel it), and the bar-height parameter (`docs/research.md` §15 — the diagnosis in §9 was wrong, and the fix it named would not have worked). ⚠️ **The nine permanent refusals stand**, one of them now with a knee push-up beside it. ~~ 🟢 **AUTHORISED.** *"if you want to give me a list of the places this does already happen, it could help me with this. Do this after we're done questioning."* Every screen where the app currently shows a blank, an empty state, or a permanent refusal instead of a best-effort number — with, for each, what it could honestly say instead and how it would be labelled. ⚠️ **It is a LIST, not a sweep**: *"I think I'll notice the places that show blanks and I'll manually tell you to fix them if I want."* 🛑 **Change nothing off the back of it without him picking** |
| **21** | 🔄 ~~the abs ranking~~ **BUILT 2026-09-04** | ✅ Tim picked his own first idea and it shipped: Core has a key lift (Cable Crunch), a measured median, its own spread and its own reliability penalty. `docs/history.md` 2026-09-04 second pass; `docs/research.md` §14. ⚠️ **What is NOT done, and he has not been asked for it**: it rates about a quarter of how people train abs, and §14.6 records the obvious next lead — published norms for the **plank hold** and the **60-second sit-up** — as **unchecked**, not as rejected. 🛑 Do not start it. ~~ ⏸️ He re-opened it himself and asked for the problems with two approaches. The assessment is `docs/history.md`, "2026-09-03 — HOW TO RANK ABS"; the short version: **his first idea (weighted core work through the normal machinery) is buildable if the numbers are pulled properly, and answers about a third of it**; **his second (seed from their other muscles, then track improvement) puts two different meanings in one colour and invents a correlation nobody has measured**; and **the cheapest fix needs no new data at all** — give trained-but-unrankable muscles their own mark and legend entry, and have the panel say what HAS been logged. **Nothing is built and nothing should be until he picks** |
| **17** | ~~the Hevy-shaped home feed~~ | ✅ **BUILT 2026-09-02 — all eight steps of `docs/social-plan.md` §13**, which now carries a ✅ block under each one and a §14 summary. What is left of it is two things Tim owes a decision on (**warm-up typing**, still item 2 below; **per-workout visibility**, §13's decision B) and **step 9, photos, which needs Blaze** and is item 10. ⚠️ **The Records column is deliberately absent from the card** — sixty published sessions are not a lifetime, and that caveat does not fit beside somebody's name; the bests are on the workout screen instead. ⚠️ **Nothing here has been used by two real accounts** — that is item 1, and it grew a longer list today |
| **18** | 🔄 ~~do not build the discovery feed~~ **THE REFUSAL WAS LIFTED 2026-09-04** | Tim, asked directly whether a ban decided when this was an app for two people still held once it is on the App Store: **"It has to go eventually."** 🛑 **Nothing is built and he did not ask for a plan.** What the old entry got right is the COST, and that part is unchanged: it needs public profiles and a way to enumerate them, and it imports a moderation story this project still does not have — which he also parked the same day (*"just put it in the notes"*). So the sequence is fixed even though the decision flipped: **finding strangers cannot ship before blocking and reporting do.** `docs/social-plan.md` §12.11 holds the reasoning and is now history rather than law; `docs/direction.md` §3.2 |
| **1** | 🔄 ~~the field checks — needs Tim's phone~~ **CLOSED BY TIM, 2026-09-04** | 🛑 **DO NOT RE-OPEN THIS AND DO NOT WRITE ITS WARNINGS AGAIN.** *"Don't record the 'not verified on iphone' warnings at all. I'm constantly testing almost every part of the cite so when something has a problem, I'll come to you."* **Shipped is working unless he says otherwise** (`docs/direction.md` §3.3). ⚠️ **One thing it contained is NOT covered by that and lives on as item 19**: no *predicted number* has been checked against a real attempt, and no amount of using the app can check one. ⚠️ **The two-account round trip also survives, but as something he WANTS rather than as a gap** — he named it among four items he intends to work on and will raise himself. Everything below this line is the record of what the item used to say, kept because it lists precisely what was proved by machine rather than by a person. ~~🆕 2026-09-03 PUT THE BIGGEST SINGLE ITEM ON THIS LIST: NOBODY HAS SEEN A PUBLIC ACCOUNT FROM THE OUTSIDE.~~ Every account is public by default now, and the only way to know what a stranger actually gets is a second real account opening the first one's page — the rules are proved on the emulator and the screens are proved in the demo, and **neither of those is a stranger**. Also unfielded from that day: the tappable friend map, the two-body compare screen, a friend's volume and graph screens, and the **legacy fallback**, which is proved against a fixture shaped like Autumn's live document but has never actually been the thing a real second phone rendered. 🆕 **2026-09-02 ADDED A LOT TO THIS LIST AND NONE OF IT HAS BEEN ON A PHONE**: the new feed card, a friend's workout screen, the comparison sheet, copying a friend's workout into your own plan, and — the one most likely to behave differently on a real device — **sharing a picture**, which goes through `navigator.share({files})` and has only ever been driven in headless Chrome, where it falls through to the download path. ⚠️ **THE BIGGEST ONE IS STILL A TEN-MINUTE JOB WITH AUTUMN**: search her by name, send a request, have her accept it, and record a workout for her so it lands in her account. **Everything social built on 2026-08-29 is proved against the rules engine and has never been done by two people.** Also standing: the **friend-name heal**, a real **kudos/comment** round trip, and — needing only his eyes — **the blue box round the profile picture on a laptop** (a real bug was found and fixed in that exact place, but a *blue* one was never reproduced). ⚠️ **And file import has never parsed an actual export** from any service. ⚠️ **Added 2026-08-30: nobody has read the Research topics on a phone** — the facts are checked and measured, the reading experience is not. 🚨 **AND THE OTHER TWO PASSES OF 2026-09-02 ARE ON THIS LIST TOO, one of them at the top of it: `goBack()` changed EVERY back arrow in the app and has never met the iOS edge-swipe gesture** — which is the one input the design was chosen to survive, and which exists on no machine here. A router-level change to 48 controls verified only in desktop Chrome is the highest-risk unfielded thing of the day. Also unread on a phone: the benchmark screen's estimate and its two captions |
| **2** | **0c — the UX list** | ⚠️ **OPEN, and it is judgement rather than bugs.** Its headline item closed on 2026-08-25 (Home is a feed, which is nothing but growth) and the "hard sets" half was answered on 2026-08-24 by *saying* what is counted. **What is left is one question for Tim**: should logged warm-ups be excluded from the volume count? His call, because the obvious fix would also throw away genuine back-off work. 🆕 **2026-08-31 — THERE IS NOW A THIRD OPTION AND IT IS BETTER THAN BOTH**: Hevy's screens show a set is **typed at logging time** (`W` in amber for a warm-up, working sets numbered from 1), so the app never has to guess. That turns this from "which wrong answer do we pick" into a small feature — a set-type flag, a control in the runner, and the Volume tab's apology becomes a setting. ⚠️ **Every set already recorded is untyped and must stay counted rather than be retro-guessed.** `docs/social-plan.md` §12.16 |
| **3** | **activities, Phase 2 — item 6** | Items 1–4 shipped 2026-08-27. **Item 6 says to ASK TIM** which activities his circle actually logs — climbing grades are the least standardised thing in the list. `docs/activities-plan.md` §3. ⚠️ **Item 5, activity PRs, is PINNED (P1)**, not open |
| **5** | **0i — the body map's touch targets** | ⚠️ **MOSTLY CLOSED.** Invisible hit halos grow every muscle ~10 px in all directions without touching the art (Traps 44×15 → ~64×35 effective, CDP-verified). What remains under 44 px lands on **Tim's illustration**, so it stays his call |
| **6** | **0f — Tim's friend could not sign in** | ⚠️ Unread bug report; he asked to investigate it himself. **May not be new** — a plain Safari tab is still the one surface no working device has confirmed |
| **8** | **item 2 — the estimator, Phases 1–3** | The Goals *verdict* waits on it. ⚠️ **It has questions for Tim** — **§6.1** sets the hard constraint (the band fits inside one level only 8.5 % of the time; ⚠️ **this file cited §16 for that for weeks, and §16 is a different section** — corrected 2026-09-02), and §14 asks whether the estimator may draw on all evidence at once (narrowing D14). 🆕 **2026-09-02 moved two pieces of this without touching the plan's phases**: `buildObservations()` is out of `store.js` and into `js/strength-observations.js`, so a friend's training goes through the same walk as yours; and `muscleRatings()` is that same rating WITHOUT the profile gate, which is what lets an account with no weigh-in have an estimate at all. ⚠️ **The plan's claim that Phase 1 is blocked on data the store does not carry is WRONG** — see the 2026-08-28 section, item 5. `setIndex` and `exerciseIndex` are array positions in data already on disk, derivable at any time. Phase 1 is small; what gates the feature is Phase 2, and Phase 2 needs him |
| **15** | **the usability findings — waiting on Tim's pick** | ⚠️ Four standing findings from the 2026-08-28 usability drive, reported to him and not yet chosen from: **no wake lock** (the biggest hands-free lever), **prefill counts as recorded at Finish**, the **Record chooser's extra tap**, and the Run log's **"28" = 28 seconds** parse. See that day's second-pass section. ⚠️ **The prefill one is HALF fixed as of 2026-08-29 and the halves matter**: a never-done exercise is now guarded (`prefilled`, refused by the save path), an exercise WITH history is untouched — walk past it and last time's numbers record as though you did them. Left alone deliberately: it is a behaviour change on every workout and his to pick. ⚠️ **The rest-timer items in the same list are DECLINED, not waiting** — do not resurface them |
| **19** | ⏸️ **the estimator has never been checked against a person — 🛑 TIM TOOK THIS ONE HIMSELF, 2026-09-09** | *"I'll do 4 myself sometime this week, but I'll come to you about it."* **Do not start it, and do not offer it again** — he has it, and he will bring it back. It stays on this list because it is still true and still the cheapest honesty win, not because it is available. ⚠️ **Not a bug — a standing hole that got much bigger on 2026-09-02.** The app now prints an estimated 1RM for virtually every exercise, a percentage of it, and a predicted rep count, and **not one of those numbers has ever been compared with an actual attempt.** `docs/strength-estimate-plan.md` §11.2 — the backtest against Tim's own held-out benchmarks — is the only thing that would change that, and it has never been run. **It needs nothing from anybody: the data is already on disk.** The cheapest honesty win left in the project |
| **20** | ✅ ~~`docs/research.md` §2's transcription error~~ **FIXED 2026-09-04** | Re-read against PMC10933212. **The 95 % figure is ~2, not ~5**, and a second cell was wrong too — the general 80 % column held the bench-press value. 🚨 **Both were shifts rather than invented numbers**, which is why the table stayed plausible for weeks; §2 now records that shape so the next wrong table gets checked for it first. ⚠️ The numbers are read off FIGURES rather than prose, so the 95 % row is graded 🟡 and the rest 🟢. ✅ Nothing in the app moved: the one citation of §2 is `exercise-estimate.js`, which quotes the BENCH cell, and that cell was always right. ~~ ⚠️ It gives **~5 reps at both 95 % and 90 % of a max**, which cannot both be true — found 2026-09-02 while building the rep prediction, and flagged in place. Nothing has ever been shipped off that row. Fixing it means re-reading PMC10933212 (Nuzzo et al. 2024). Small, and it is a wrong claim sitting in the file the whole app cites |
| **22** | 🔄 ~~nobody has seen a PUBLIC account from the outside~~ **CLOSED WITH ITEM 1, 2026-09-04** | 🛑 Same instruction: do not write this warning again. It remains true that a stranger's view has only ever been simulated, and Tim's answer is that he tests continuously and will report what is broken. ~~⚠️ Part of item 1, listed separately because it is the one thing today's change cannot be checked without: a second real account.~~ The rules are proved on the emulator (159 assertions) and the screens are proved in the demo, and **neither of those is a stranger opening somebody's page.** Also unproved: the tier migration, which needs an account that published under the old model — every account Tim has does, so this is one sign-in away |
| **16** | **the HANDLE version of finding people** | 🚨 **Specified, ready, and a DECISION rather than a discovery.** ⚠️ **2026-09-03 raised the stakes**: a public account is read by anybody signed in, so the directory is now how a stranger FINDS one — though nothing about what the directory holds changed (a uid and a chosen name). Name search shipped 2026-08-29 on Tim's explicit call at fewer than five users, and it required granting Firestore `list` on a directory — which is enumeration of every row and cannot be narrowed by a rule. The replacement: `handles/{handle}` → uid, **`get` yes and `list` no**, exact lookup of a handle you chose, nothing enumerable. `docs/social-plan.md` §3.4 already blesses that shape. ⚠️ **The rules test's one deliberate `allow` — "any signed-in account can list the whole directory" — is the line that flips to a denial the day this lands**, and the `directory` block should be deleted with it |

### ⚠️ PINNED — real work, deliberately NOT queued. Do not offer these as "the next thing to do"

**Tim's instruction, 2026-08-28**, after being given this list and asked which items were genuinely
worth doing: *"do everything you think is an actually good change, then pin the rest for later
(don't bring them up as the 'next thing to do' later though)."*

⚠️ **THIS IS A STANDING INSTRUCTION AND IT SURVIVES A CHAT RESET.** These are not blocked, not
forgotten and not bad ideas — each was assessed and judged **not worth doing yet**, with the
reasoning recorded here so it does not have to be re-derived. **A fresh session must not surface
them as a suggestion, a recommendation, or a "while I'm in here".** Build them if Tim asks for them
by name. Otherwise leave them alone.

| | What | Why it is pinned rather than queued |
|---|---|---|
| **P1** | **activity PRs** (activities Phase 2, item 5) | ⚠️ **It crosses a line the project drew on purpose.** D27 says activities are recorded first-class and **modelled not at all**, and "fastest 5k-ish" is modelling — the distance-bucketing decision *is* a judgement about what counts as comparable, and getting it wrong celebrates a PR that is not one. Nobody has asked for it, and Strava does it properly for the people who care. The fair counterargument is that lifts get a PR screen and runs do not, which reads as inconsistent. Not enough |
| **P2** | **the Strava feed exclusion** | Correctly sequenced *inside* item 10, not ahead of it. Building a restriction for a feature that may never exist is dead code enforcing the terms of a service the app does not talk to. ⚠️ **Ready is not the same as worth it** |
| **P3** | **the competitive review** | The odd one of the seven briefed on 2026-08-19: the six that ran inspected the **app** and found defects; this one inspects the **market** and produces opinions. `docs/competitive-teardown.html` already covers some of that ground. ⚠️ **Its likely output is a list of things other apps do — the exact input that would push this app toward inventing numbers, the one thing it is good at refusing.** Tim drives the design now and has been right every time |
| **P4** | **the effect-size research** (items 3 and 4) | Cheap, and it **closes** rather than builds. `docs/fatigue-plan.md` §4 already argues the literature reports reps-at-fixed-load rather than 1RM decrement, and that using it would break Rule 5 — it is the only mechanism on the table that makes a number BIGGER than what was observed. The realistic output is a written "no". Worth an hour **only** to stop items 3 and 4 sitting open implying a maybe |

### Parked at Tim's instruction — do not start these

| | What | State |
|---|---|---|
| **10** | **live sync from other apps** | File import (Phase 1) shipped 2026-08-27. **Phase 2 is live Strava sync**, and it needs a server — a Cloud Function to hold the client secret. ⚠️ **Blaze is free in practice** (~1,500 invocations a month against a 2M allowance) **but needs a card and has no hard spending cap**, so it is **Tim's call and nothing starts without it.** Build P2 first if he says go. `docs/integrations-plan.md` |
| **12** | **AirPods stem-press controls** | ⚠️ **"Wait" — Tim, 2026-08-27.** Buildable via MediaSession; costs Now Playing (no simultaneous Spotify), so opt-in only. `docs/airpods-plan.md` §4 is the build order if he says go, starting with a half-day device spike. **Head motion needs a native app** (§2b) |
| **13** | **importing food** | ⚠️ **"Wait" — Tim, 2026-08-27.** It collides with D1/D26 and needs a **narrowing decision from him**, not a quiet fix. The honest version is probably a daily protein total to answer the Goals screen's own protein line, and never a food or a meal |

### Closed — kept for the reasoning, not as work

| | What | Closed |
|---|---|---|
| **0b(c)** | **the cloud ceiling** | ✅ **2026-08-28.** One document per session and per guest session at `users/{uid}/sessions/{rowId}`. **There is no longer a session count at which saving stops working.** Migrate → **re-read to verify** → only then empty the old document; an aborted migration changes nothing. Rules 92 → 108, deployed. ⚠️ **The read cost changed** — one billed read per row, ~520 on a cold open at the old ceiling against 50,000/day |
| **0h** | **the ratio table** | ✅ **2026-08-28.** Decline dumbbell bench 0.86 → **0.76**, seated dumbbell press 0.98 → **1.08**, Arnold 0.90 → **0.77**; spider curl closed as **not derivable** and labelled. ⚠️ **The finding: the worst entries were the ones somebody had REASONED about**, and two inverted the ordering the argument was trying to protect |
| **0e** | **joint workouts** | ✅ **2026-08-27, and FULLY JOINED UP 2026-08-29.** Guest half 2026-08-26; friend-accept half 2026-08-27 — `handoffs/`, one create-only doc per offer, the recipient taps Add and **their own client** writes it to **their own account** under unchanged owner-only rules. ⚠️ **Until 2026-08-29 the two halves never touched**: sending was a thing you went to the CALENDAR to do, after the fact, one record at a time. Now you pick a **friend** at the start of the workout and **Finish sends it**. Their suggestion is read from what they already share with you, never merged with what you recorded for them |
| **0j** | **mutual disconnect** | ✅ **2026-08-27.** A tombstone at `disconnects/{leaverUid}` — ⚠️ **the id IS the caller's uid**, so you may only ever leave for yourself. ⚠️ **Eventual, not instant**, and the sheet says so |
| **0k** | **the colour direction** | ✅ **2026-08-27.** Tim picked all three; Gold/Teal/Indigo/Ember in Settings, each with a designed light theme. The last caveat is gone — the full browser audit has run on all four (240 combinations, zero failures) |
| **0l** | **kudos and comments** | ✅ **2026-08-26.** Create-only reaction docs under the owner, viewer-of-any-tier may write, no update path. ⚠️ **The pattern it established is what made 0e and 0j cheap** — both reused it |
| **0m** | **location on feed cards** | ✅ **2026-08-26.** A hand-typed label, never GPS, published at mid+. Nothing more precise than what the owner typed can exist to leak |
| **0a** | **both 2026-08-22 blockers** | ✅ **2026-08-24.** Not locked out, on a current build |
| **0d** | **swap an exercise mid-workout** | ✅ **2026-08-24.** Splits rather than replacing when sets are already logged |
| **0g** | **within-session fatigue** | ✅ **2026-08-24**, Tiers 1 and 2. ⚠️ **Tier 3 should not be built** |
| **0b(d)** | **restore from backup** | ✅ **2026-08-24.** Every row checked before any row is written |
| **14** | **the verification pass** | ✅ **2026-08-27.** The CDP round ran and the audit covered all four palettes. What remains needs Tim's phone and is item 1 above |

⚠️ **THE LETTERED SECTIONS BELOW ARE THE REASONING, NOT THE STATUS.** They are in the order they
were written, they include items the table above marks closed, and several of them argue for work
that has since been done differently. **The table is the truth about what is open; the sections are
why.**

⚠️ **READ `docs/improvement-plan.md` §0 BEFORE PICKING ANYTHING UP.** Tim asked (2026-08-19) for a
plan plus a review of everything built. Seven reviews were scoped, briefed and then all killed by a
session usage limit before returning a single finding. Their briefs are recorded verbatim in that
file so they can be re-run as written, and **re-running the rest is still item 0.**

**SIX have now run and every one found something real** — the adversarial code review (progression
destroyed its own rep range), cross-screen consistency (the Goals matcher printed a strength
percentage with no caveat), the **accessibility audit**, the first this project ever had, which
failed, and on 2026-08-22 **edge cases / data integrity** (the DST day-index bug and eight more),
**the live social round trip** (it works; two defects), and **human behaviour / UX** (Goals told a
user meeting their target that they were short). The first three are in the 2026-08-20 section and
the rest have their own on 2026-08-22. **Only the competitive review is outstanding.**

⚠️ **The UX review's list is where the unfinished work is**, and it is judgement rather than bugs —
so it wants Tim's eye more than the others did. Item 1 on it is the sharpest unaddressed thing in
the product: **nothing a user can see on Home ever grows.**

⚠️ **On running them as agents.** The 2026-08-19 attempt launched seven at once and a usage limit
killed all seven before one finding came back; this file has said "serially, never a wave" ever
since. **Tim authorised a wave again on 2026-08-22 and a small one worked** — three at once, each
given a written brief and a list of files it must not touch, returned real findings. The lesson is
narrower than the old warning: **seven is what failed, and the file conflicts are what to plan
for**, not the parallelism itself.

**The estimator no longer gates everything — Phase 0 is done and Goals progression shipped without
it.** What it still gates is the Goals *verdict* and the weight/rep half of `docs/vision.md` §1.2.

0a. ~~**⚠️ FIRST, BEFORE ANY CODE: IS TIM ACTUALLY ABLE TO USE THE APP, AND IS HE ON THE CURRENT
   BUILD?**~~ ✅ **BOTH ANSWERED YES, 2026-08-24.** Tim: *"I'm not locked out, I think I just had the
   wrong URL. I can see the year view now."* **The list below is unblocked.**

   - **Not locked out**, and he puts it down to the wrong URL rather than to the app. ⚠️ **The
     "installed app stuck on the auth handler" diagnosis is therefore neither confirmed nor
     refuted** — it was never checked against what he actually had open. The ninth pass's fix keeps
     its own justification, which never depended on this report: `getRedirectResult()` was being
     called on every boot in a configuration where a redirect can never legitimately have started.
   - **He is on a current build** — the years view is on his screen, which is the same feature he
     reported missing on the 22nd. ⚠️ **What moved him onto it is unknown**: the resume update check
     (sixth pass) has still never been seen to fire in the field, only in `tests/sw-update.test.mjs`.
     Do not upgrade it to verified on the strength of this.

   ⚠️ **The rule those two items existed to teach outlives them: do not read "X is broken" as X
   being broken.** Check the live site first — `curl` the deployed file, or drive a clean browser
   profile at the live URL. That is what settled the years-view report in one command.

0. **⚠️ THE IPHONE WORK IS OPEN — Tim, 2026-08-21.** The 2026-08-17 deferral is over and this is the
   live thread. **Five passes ran on the 21st and four more on the 22nd** — nine dated sections
   above. Everything measurable from the survey is done (eleven measured defects, the view/edit
   split, the first run from twelve steps to five, the body map holding still), and on the 22nd:
   **the years grid, the five-tab nav with Record in the middle, the nav-speed fix, the resume
   update check, the rep ceiling, the silent-save fix, the Goals headline and the demo draft leak.**
   What is left, in order:

   - ~~**⚠️ THE KEYBOARD FIX NEEDS A PHONE.**~~ ✅ **CLOSED 2026-08-22 — it works.** *Next exercise*
     is reachable with the keyboard up and the picker is usable, confirmed on Tim's iPhone in the
     installed home-screen app.
   - ~~**⚠️ GOOGLE SIGN-IN DOES NOT WORK ON THE IPHONE.**~~ ✅ **CLOSED 2026-08-22 — it works in the
     installed PWA**, and the auth-handler job in the user-page repo is **moot**. The third pass
     fixed it by accident: stopping the PWA preferring `signInWithRedirect` (which cannot complete
     cross-origin) moved it onto the popup, and the popup works. See the 2026-08-22 section for the
     two claims that turned out to be wrong. ⚠️ **A Safari tab has still not been retested** since
     the fixes shipped, and that is probably where the original report came from.
   - The **reasoned-not-measured** items in the survey — **three still open**, one now half open.
     Still untouched: haptics (iOS has no Vibration API at all, so the stepper's `navigator.vibrate`
     never fires), the long-press callout, and the native date control. ⚠️ **Half open: whether the
     picker's `setTimeout` focus raises the keyboard BY ITSELF.** The picker was judged with a
     keyboard up on 2026-08-22, but nobody recorded whether it rose unprompted or after a tap, and
     those are different findings. All need the same device.
   - **⚠️ AN ORDINARY SAFARI TAB IS NOW THE LESS-TESTED SURFACE.** Everything a device has confirmed
     was in the app installed to the home screen. A Safari tab has not been retried since the
     2026-08-21 auth fixes, and it is probably where the original Google sign-in report came from.
   - ~~Two layout items nobody has done: Explore's badge, and Goals opening on prose.~~ **BOTH DONE
     the same day** — the second pass's "last two layout items" section (`docs/history.md`,
     2026-08-21 second pass) has the measurements
     (Explore's badge drops to its own line below 700px, giving the summary 338px of 393 instead of
     200; Goals' two honesty paragraphs moved down beside the screen's other stated limit). This
     bullet survived the second pass as a stale copy and is kept struck through rather than deleted,
     because a line saying "nobody has done this" over work that shipped is exactly the failure this
     file exists to prevent.

0d. ~~**⚠️ SWAP AN EXERCISE MID-WORKOUT**~~ ✅ **BUILT AND DEPLOYED 2026-08-24.** A quiet **Swap**
   button beside the exercise name opens the picker; 71 × 44 px, measured clear of the library's
   longest name at 360 px. **TODAY ONLY — the saved workout is untouched**, which was Tim's call and
   is what the runner already does with `isBenchmark`, `group` and `setType`.

   ⚠️ **IT SPLITS RATHER THAN REPLACING WHEN WORK HAS BEEN LOGGED**, and that is the half that
   mattered. If the machine was taken after two sets, two sets were done — **on the original
   exercise**. So a swap with sets recorded keeps the original, trimmed to what was really done, and
   inserts the new exercise directly after it. A swap with nothing logged replaces in place, because
   an empty entry is not a record of anything. **Mutation-checked**: making it always replace flips
   the two assertions about the kept sets.

   ⚠️ **INSERTED AFTER, NOT APPENDED, and that stopped being cosmetic today** — `muscleStrength()`
   now reads entry order to score within-session fatigue (0g), so an exercise dropped at the end of
   the list would be scored as though it came after everything.

   ⚠️ **The kept half LEAVES a superset.** A group's rounds are walked by membership, so letting
   both halves stay in would put three exercises in a two-exercise round and desynchronise the walker
   mid-workout. The half you are still doing keeps the group.

   History is re-read for the swapped-in exercise, so it arrives with its own suggestion rather than
   a column of zeros — cheap, because `getSessions()` is served from the read cache.
   `openExercisePicker` grew a `closeOnPick` option: adding exercises is repeated, swapping one is not.

0e. **⚠️ JOINT WORKOUTS — Tim, 2026-08-24. The biggest idea in his list.** *"one person can record
   both measurements for both people on one phone and account and then the data is saved to each
   users specific account … 2+ names at the top that the user could click on to switch between which
   user they are recording the data to."* Restricted to people who are already friends.

   **His decision, asked and answered: THE OTHER PERSON ACCEPTS IT.** Not a direct write into their
   account. ⚠️ **This is the load-bearing choice and the reason it was worth asking.** A direct write
   needs a Firestore rule letting account A write into account B's private collections, and
   `sessions` is **one document per collection** (D-shape recorded in §4) — so a single bad write
   does not corrupt one row, it **replaces someone's entire training history**. `docs/social-plan.md`
   §2 already argues this from the other side: sharing publishes a derived copy rather than widening
   a permission, precisely so that nobody's client can reach into anybody else's data.

   **The shape that follows:** the recorder's phone runs the session with two or more names on it,
   then publishes each friend's half to something they own and their client reads — the same
   `invites/`-style path that already exists — and **their** app writes it into **their** account on
   accept. Rules stay "only you write your own data". They also get to see what was logged in their
   name before it lands, which a direct write never offers.

   ⚠️ **SWITCHING NAMES HAS TO SWITCH THE WHOLE SUGGESTION, not just the destination.** Two people
   doing the same workout are not on the same weights: each name carries its own history, its own
   `trainingRange()`, its own next step. A version that only changed where the number was saved would
   hand both lifters the same prescription, which is the one thing this app's progression rule is
   built never to do.

   **Worth building alongside it:** logging for a **guest** — a name with no account — kept in the
   recorder's own data and handed over later if that person joins. That is the case Tim actually hit,
   because his friend could not sign in at all.

0g. ~~**⚠️ WITHIN-SESSION FATIGUE DISTORTS THE MUSCLE RATING**~~ ✅ **TIERS 1 AND 2 BUILT AND
   DEPLOYED 2026-08-24**, same day as the finding, on Tim's *"deploy it now"*. The finding and the
   measurements are below and still worth reading; `docs/fatigue-plan.md` opens with what shipped.
   ⚠️ **Tier 3 — the load multiplier — is deliberately NOT built and should stay that way**, and the
   §6 confound is unresolved: **it is still not established that Tim is stronger than 145 lb.**

   Full write-up in `docs/fatigue-plan.md`; §1 is the finding and §5 is the plan.

   Tim did assisted pull-ups, then dumbbell rows, then lat pulldowns, and suspected the app was
   rating his back off the exercise he was too tired to load. **He is right that something is wrong
   and right about which lift led. The mechanism is not the one he proposed.**

   **Measured on his session:** adding the fatigued third exercise moved Back from **212 lb to 145 lb
   — down 32 % — and moved confidence UP, 0.40 to 0.44.**

   ⚠️ **FATIGUE DOES NOT ONLY DEPRESS A READING, IT PROMOTES IT.** `evidenceWeight` multiplies by
   `repFactor(reps)`, which rewards low reps because a near-max set is better evidence of a maximum.
   A spent lifter also does few reps. His pulldown scored `0.50 × repFactor(8) = 0.425` and his
   dumbbell row `0.60 × repFactor(10) = 0.420` — **the fatigued lift led by 0.005, entirely because
   fatigue held him to 8 reps instead of 10.** The app cannot tell "few reps because it was heavy"
   from "few reps because I was cooked", and resolves it the wrong way.

   ⚠️ **AND NO RE-WEIGHTING SCHEME IS WORTH MUCH.** Every variant measured moves his rating by under
   5 lb; doing the same pulldown *first* moves it by **60**. A fatigued set is **missing** information,
   not corrupted information, and you cannot re-weight your way to a number nobody recorded. So the
   highest-value item is not a correction factor — it is `raiseConfidenceHint()` telling him to do
   that lift first once, after which best-ever-per-exercise keeps it permanently.
   ⚠️ **Programme order is usually fixed**, so an exercise that is always third is always understated,
   for as long as the programme runs — not for one session.

   ⚠️ **Scale, so it is not overbuilt:** across the demo account's year, **0 of 11 muscles** are led
   by a lift that was not that muscle's first of the day, and a graded fatigue term moves every one of
   them by under 2 %. A well-ordered programme never hits this. **Build it as a safety rail for the
   sessions where order and credibility disagree, not as a rewrite of the rating.**

   ⚠️ **The load multiplier Tim suggested is Tier 3 and should not be built.** It needs a published
   decrement in maximal strength per unit of prior same-muscle volume; the order literature reports
   *reps at a fixed load*, not 1RM, and it is **the only option on the table that can make a number
   bigger than what was observed**. Same wall as Open work item 3 — the ACSM order finding is graded
   88 % but publishes no effect size — hit from the other side.

   ⚠️ **And the confound is unresolved:** his three lifts imply 115, 229 and 136 lb of barbell row.
   **Do not tell him he is stronger than 145.** The other candidate explanation is that doubling a
   one-arm dumbbell row onto a two-arm barbell row is generous, which has never been checked.

0f. **⚠️ HIS FRIEND'S SIGN-IN FAILED, AND NOBODY KNOWS HOW.** 2026-08-24: *"The login either wasn't
   working for my friends phone or we messed something up."* Tim asked to leave it — *"I need to
   investigate it further"* — so this is recorded rather than chased. ⚠️ **It may not be new:** an
   ordinary Safari tab is the one surface no working device has ever confirmed (item 0), and it is
   probably where Tim's own 2026-08-21 report came from. **Do not close that item on the strength of
   the installed PWA working.**

0b. **⚠️ THE EDGE-CASE REVIEW'S UNFIXED FINDINGS — 2026-08-22, and two of them can lose work.**
   Full write-up in `docs/history.md`, 2026-08-22 third pass; these are the ones nobody has done.

   - ~~**⚠️ (a) PROGRESSION RATCHETS REPS WITH NO TERMINAL STATE.**~~ ✅ **FIXED 2026-08-22** — a rep
     ceiling at the top of the top band, which **refuses** rather than stepping smaller, and both
     branches are now played forward to forty sessions. See the fifth-pass section.
   - ~~**⚠️ (b) A FAILED SAVE AT THE END OF A WORKOUT IS SILENT.**~~ ✅ **FIXED 2026-08-22** — it
     says so on the screen above the button that failed, keeps the draft (the only other copy), and
     the same tap works again once the problem clears.
   - **⚠️ (c) THE FIRESTORE CEILING IS ~520 SESSIONS, NOT ~950** — ⚠️ **corrected TWICE on
     2026-08-24, both times optimistically.** The morning's fix replaced a guess (~300 bytes a
     session) with a `JSON.stringify` measurement (~1,100, ceiling ~950); the evening's found that
     **Firestore charges 1.66× the JSON** — a flat 32 bytes per map and 8 per number — so it is
     ~2,000 bytes a session and about **520 sessions, two and a half years at four a week**. One
     recorded set is 23 bytes of JSON and 60 to Firestore, and `entries` is 88 % of the collection.
     ✅ **Something warns now**: `store.cloudUsage()` sizes every collection document by Firestore's
     own published rules and Settings paints a warning above *Download backup* from **80 %**,
     silent below it and silent on any backend that is not Firestore.
     ✅ The "fails silently" half was already half-closed: a rejected cloud write surfaces on screen,
     because `finish()` has caught `saveSession()` since 2026-08-22 whichever backend threw.
     ✅ **DONE 2026-08-28 — the split to a document per session**, and to a document per guest
     session with it. ⚠️ **The argument for deferring it was the thing that turned out to be
     backwards**: this said "nobody is near it, the 80 % threshold leaves about six months to do
     the migration calmly", which is true about the runway and wrong about the risk. A migration
     over a training history gets more dangerous the more history there is, so the calm moment was
     at a few dozen sessions rather than at four hundred. See the 2026-08-28 section.
     ⚠️ **Never verified against a real rejection**, and must not be described as if it were —
     which is now moot for sessions and still true of every collection still under the cap.
   - ~~**(d) Restore from backup validates almost nothing, MERGES rather than replaces, and has no
     confirmation**~~ ✅ **FIXED 2026-08-24.** Every row is checked before any row is written, so
     there is no half-restore; `{foo:1}` is refused rather than toasting success over nothing; every
     collection is replaced including the ones the file does not carry, which is what kills the dead
     `systemId`; and it has a confirmation that names what is in the file.

0h. ~~**⚠️ THE RATIO TABLE'S REASONED ENTRIES RUN TOO LOW, WHICH FLATTERS.**~~ ✅ **CLOSED
   2026-08-28.** The sweep ran to the end; the last four names are in that day's section, and
   spider curl is closed as **not derivable** rather than left open. ⚠️ **The reasoning below is
   history and one line of it turned out to be wrong** — "decline sits above flat" is true of a
   barbell and false of dumbbells. Kept for the method, not the conclusions.

   **⚠️ Four anchors corrected 2026-08-24; the rest of the table is still unchecked** *(as it stood
   then)*. Done: `Dumbbell Row` 0.85 → 0.98,
   `Dumbbell Bench Press` 0.72 → 0.81, `Dumbbell Shoulder Press` 0.88 → 1.01, `Dumbbell Curl`
   0.88 → 0.94, each derived from published standards at a 180 lb male. Four neighbours were carried
   across their corrected anchor and are **still reasoned, not measured**: Incline and Decline
   Dumbbell Bench, Seated Dumbbell Shoulder Press, Arnold Press.

   ⚠️ **THE ERRORS WERE 7, 12, 15 AND 15 % — NOT A CONSTANT.** No blanket factor fixes this table.
   Every remaining reasoned entry has to be derived on its own, by the technique now used four times:
   one population, both lifts, a 180 lb male, divide, take the median.

   **Still unchecked, in rough order of how much they move a rating:** the rest of the dumbbell
   biceps family (Hammer, Incline, Concentration, Preacher, Zottman, Spider, Cross-Body); every
   MACHINE entry (`q` 0.35–0.50 — Leg Press 2.00, Hack Squat 1.15, Machine Row 1.00, Pec Deck 0.55,
   Machine Hip Thrust 1.20); the cable entries; and the deadlift family's 1.40–1.85 against Back.
   ⚠️ **Machines are the harder half and may not be derivable at all** — a leg press ratio depends on
   the machine's leverage, which is why those `q` values are already low. If a source cannot be
   found, the honest outcome is to say so in the table rather than leave the guess unlabelled.

0i. **⚠️ THE BODY MAP'S TOUCH TARGETS — NOW THE ILLUSTRATION ONLY.** Measured for the first time
   2026-08-24; see that day's fourth-pass section. At 360px the smallest muscles are **Traps 42×11,
   Glutes 39×16, Shoulders 62×18, Neck 24×17**, and **the figure is the only way to select a
   muscle**, so the year grid's equivalence argument is not available. ⚠️ **This lands on Tim's
   illustration, so it is his call** — the cheap options are a larger invisible hit area per path,
   or a list beside the figure.

   ~~Also just under 44: the comparison button (332×38) and the chart's exercise `select`
   (156×36).~~ ✅ **BOTH AT 44 px, 2026-08-24**, measured before and after at 360 / 375 / 393 with no
   horizontal overflow at any width. The 8 px came off the chart, which had 501 and now has 493 —
   a control being reliably hittable is worth more than eight pixels of line.

0j. **⚠️ MUTUAL DISCONNECT IS STILL NOT BUILT.** The sheet was corrected on 2026-08-24 to stop
   promising it (see that day's fourth-pass section), which is not the same as fixing it. `social.remove()`
   edits only your own graph, so after disconnecting you can still read their training until they
   disconnect too. A real mutual disconnect needs something their client can read — a new rules
   path, not a small fix. `docs/social-plan.md` §2 is the section to read first.

0c. **⚠️ THE UX REVIEW'S LIST — judgement rather than bugs, and Tim has claimed the design half.**
   Written up in the fifth pass above. He said he would work on the design himself, *"especially
   home"*, so **the design decisions here are his** — but the findings are measured and the reasoning
   is recorded, and item 1 is the sharpest unaddressed thing in the product:

   - **⚠️ NOTHING A USER CAN SEE ON HOME EVER GROWS.** A fresh account and an account with a year of
     training and 200 sessions render the same layout with a longer list. Every rewarding readout in
     the app — a rising curve with **+90 · +54.5 %**, per-lift deltas, *"stronger than 62 %"*, a
     filled month — is behind the Data tab, and **nothing anywhere says you hit a personal best.**
     Two suggested fixes and their trade-offs are in the fifth pass; the finish-screen one is
     Rule 5-safe because "you typed a bigger number than you ever have" compares two *recorded*
     sets. ⚠️ **The Friends half of Home now gives it one thing that is never the same twice**, which
     is a start and not an answer.
   - ~~**"Hard sets" is never defined, and is not what the app counts.**~~ ✅ **SAID, NOT SILENTLY
     CORRECTED, 2026-08-24.** The requirement row now defines a hard set — *a working set taken close
     to failure, roughly one to three reps left, warm-ups excluded* — and every measured volume row
     admits the app counts **every set you logged, warm-ups included.**
     ⚠️ **The correction was deliberately NOT applied, and the reason is the direction of its error.**
     Excluding sets below some fraction of the day's top set would catch warm-ups and would also throw
     away genuine back-off work, which is often the hardest set of the session — **a judged threshold
     whose error runs BOTH ways**, unlike `LAYOFF_DAYS`, `FATIGUE_HALF_SETS` or the rep ladder, all of
     which can only withhold. That is not a call this file may quietly make. ⚠️ **The caveat matters
     most on the OK branch**: on the short branches an inflated count only softens bad news, but there
     the app is saying the work IS being done, and warm-up padding would be an unearned positive
     verdict — Rule 6, the same fault the headline fix corrected from the other side.
     **Still open, and it is Tim's call**: should logged warm-ups be excluded from the volume count?
     🆕 **2026-08-31: a third option, and it is better than both of the above** — let the LIFTER type
     the set, the way Hevy does (a warm-up is marked `W` and working sets are numbered from 1). The
     app then never guesses, and the error runs in neither direction. See docs/social-plan.md §12.16.
   - **"Programme" becomes "system" on the next tap** — improvement-plan §1.1's fault one screen
     later, and the word's only definition sits on the screen the first-run fix now routes past.
   - Explore ranks nine programmes by a number it explains nine cards later; the red "not backed up"
     dot is on from the first paint including in the demo; and the smaller items listed in the pass.

1. ~~**Social: get two accounts to connect. THIS IS THE BIGGEST UNVERIFIED THING IN THE PROJECT.**~~
   ✅ **RAN 2026-08-22 AGAINST THE LIVE PROJECT — it works, and it found two defects.** Two
   throwaway email accounts in two SEPARATE Chrome profiles (different uids, confirmed before
   anything was shared), driven over CDP with real mouse events. Invite → open as somebody else →
   claim → accept → set a tier → publish → read, all the way through, then both accounts and all
   eleven of their documents deleted and the project checked back to the exact 7-user / 19-document
   state it started in. **⚠️ The brief said the project held zero users and zero documents. It did
   not** — it holds Tim's two real accounts and their training data. Anything that "cleans up to
   zero" would destroy them. Snapshot the baseline first and diff against it.

   **Enforcement was checked ON THE WIRE, not in the UI.** At *just that I trained* the published
   document contains three names and three dates and no number anywhere. Reading the private
   `collections/sessions`, `benchmarks`, `bodyWeight`, `settings` and `social/graph` of the other
   account is refused, and so is LISTING `shared/` or `invites/`. The sharpest test: a `shared/mid`
   document was made to exist, holding every weight and rep, with the viewer left out of its
   `viewers` list — Firestore refused it. Moving somebody down a tier and disconnecting them both
   cut access to a document that still existed.

   **Two defects, both found by driving it:**
   - **Every expired invite read as `open`.** `expiresAt` is stored as a Date, so the SDK returns a
     **Timestamp object**; `Date.parse()` on one is NaN and `NaN <= now` is false. A link three
     weeks stale offered "Connect", and only the rules stopped the claim — surfacing as a raw
     "Missing or insufficient permissions". "That link has expired" could never be shown. **Fixed**
     in `js/social.js` (`instantMillis`), with six assertions in `tests/social.test.mjs` that fail
     without it. The old tests missed it because their fixture had no `expiresAt` at all, so they
     only ever exercised the fallback path the app never takes. *A pure module has to be handed the
     shape the network really returns.*
   - **⚠️ Disconnect is one-sided, and the confirm sheet says otherwise. NOT FIXED — design call.**
     `social.remove()` edits only MY graph, so their published copy still lists me in `viewers` and
     **I can still read their data after pressing Disconnect** — while the sheet promises "you will
     not see theirs" (`js/views-social.js` ~484). They are never told I left, and I lose the screen
     that would let me notice. A real mutual disconnect needs something their client can read, which
     is a new rules path, not a small fix.

   Original note kept: the brief is in `docs/improvement-plan.md` §0, including the trap — use two
   SEPARATE browser profiles, not two tabs, or you will "prove" a round trip that never crossed
   accounts.

1b. ~~**⚠️ THE FIRST-RUN PATH PROMISES ONE THING AND DELIVERS ANOTHER.**~~ **BUILT 2026-08-21 —
   five taps from a cold install to a loggable set, measured, against about a dozen. See the
   `docs/history.md`, 2026-08-21 fourth pass.** What follows is the original finding, kept because the reasoning is
   what chose the fix. Verified by hand 2026-08-19.
   On an empty account Home's primary button reads **"Create your first workout"** and lands on
   `#/workouts`, a screen whose actions are **"New system"** and **"Explore ready-made systems"**.
   Not a dead end — but a stranger must absorb *systems*, a concept that exists for the app's
   benefit (D22) rather than theirs, before logging a single set. Install → first logged number is
   about a dozen steps, and **the logging loop is the one thing apps beat spreadsheets at** (D4).
   The fix is not to remove systems: make **Explore the primary first-run action**, so a ready-made
   programme is one tap and teaches what a system is by example rather than by explanation — which
   is D8 exactly. `docs/improvement-plan.md` §1.1 has the options. **Cheapest high-value change
   available.**

2. **The estimator, Phases 1–3** (`docs/strength-estimate-plan.md` §12). Phase 0 is **done** and its
   numbers are in §15. What is left is wiring it to a screen, and **§16 sets the hard design
   constraint: the uncertainty band fits inside a single strength level only 8.5 % of the time.**
   Levels are 13–16 % apart and the band is ±12 %, so that is structural, not a tuning problem. A
   body map that waited for certainty before colouring would be grey nine times in ten. **Phase 2
   must be designed for the hedged reading**, not treat it as an edge case. This is what the Goals
   verdict waits on.

3. **⚠️ Exercise ORDER is the highest-confidence finding this project has, and it is barely used.**
   ACSM 2026 grades it at **88 % quality of evidence, the highest of anything in the stand**:
   strength work belongs at the start of a session. The app knows the order of every workout and
   every session. It currently ships a note in the builder and nothing more — deliberately, because
   the stand publishes a *grade* and not an effect size, so a score penalty would have to be
   invented. If it ever earns a number, its home is a report of what was **recorded**, not a rating
   of what was planned.
   ⚠️ **2026-08-24: this finding now has a second customer, and the same wall.** Item 0g needs
   exercise order for the opposite purpose — not to score a programme, but to stop a fatigued reading
   leading the muscle rating — and hits the identical problem: the grade justifies *ordering* and
   *discounting*, never *arithmetic*. `docs/fatigue-plan.md` §4. **A sourced effect size would unblock
   both at once**, which makes that one research question worth more than either item alone.

4. **Wire the load finding into a report of what you actually did.** Load is the single biggest
   thing for strength (SMD 0.60) and a *planned* workout stores no reps — but a **recorded** set has
   weight and reps, so "what share of your logged sets were at 8 reps or fewer" is a measurement
   rather than a model. That is the honest way to close the gap the strength caveat now admits to.

5. ~~**Finish the Nippard series**~~ **DONE 2026-08-19.** All six workouts. It turned up that **the
   one shipped as "Pull" was the SECOND pull** — three days of a six-day programme, mislabelled.

6. ~~**`docs/research.md` §6.8**~~ **DONE 2026-08-19.** All four axes pulled. Two entered the model
   (a per-session clamp, and `MINUTES_PER_SET` finally has a source), two became stated caveats.

7. ~~**Goals Phase 4 — progression.**~~ **BUILT 2026-08-19**, `js/progression.js`.

8. ~~**Tim opens the app on a real phone.**~~ ~~**DEFERRED by Tim, 2026-08-17.**~~ **REOPENED by
   Tim, 2026-08-21** — see item 0. The phone is now the thing being worked on. A real device still
   has not been touched, so everything in the 2026-08-21 pass is desktop-engine measurement at phone
   metrics and says nothing about touch, iOS Safari or the installed PWA.

**`docs/vision.md` is empty of unstarted work.** Five of its six ideas are BUILT (§1.1 social, §1.3
ready-made systems + the rating, §1.4 the comparison setting, §1.5 set types, §1.6 goals). §1.2 is
half built and §1.6's verdict is the one hole in it — both wait on the same estimator.

| | |
|---|---|
| **Live app** | https://timothyhadfield.github.io/Fitness_Tracker/ |
| **Repo** | https://github.com/TimothyHadfield/Fitness_Tracker (public, Pages from `main` root) |
| **Run locally** | `python -m http.server 8765` from the project root → `http://127.0.0.1:8765` |
| **Everything at once** | 🆕 **4,576 across the EIGHTEEN that need no Chrome, re-counted 2026-09-11 by running every one** — `sw-update` (12, needs Chrome) and `rules` (218, needs the emulator) are the other two of the twenty. The two that moved that day are **data-layer 1,990** and **render 1,246**; every other per-suite figure below is unchanged. 🚨 **4,380 assertions across NINETEEN suites, recounted 2026-09-09 by running every one** — plus **159 in `rules`**, which needs the emulator and is the twentieth file. ⚠️ **"SEVENTEEN suites" WAS WRONG FOR WEEKS AND THE MISSING TWO ARE THE INTERESTING PART**: `core-rating` (41) and `feedback` (26) shipped on 2026-09-04, were never added to this row, and so were absent from every total quoted since — a hand-maintained list of files, which is the same shape of fault as the `sw.js` precache and the doc budgets, both of which are tests. **This row is not one yet.** The count: data-layer 1921, render 1123, goals 235, bodyweight 184, social 162, a11y 107, share-image 91, optimal 76, strength-estimate 72, volume-map 64, demo 58, compare 53, year-grid 45, routine 42, core-rating 41, estimate 35, qr 33, feedback 26, sw-update 12. **Counted as lines matching `^PASS`, which is what `render`'s own tally agrees with exactly (1105 = 1105).** *(The comparable 2026-09-06 figure, on the same seventeen, was 4,193.)* ⚠️ **`social` went DOWN (181 → 162) and that is not a loss of coverage** — the tier model it tested no longer exists, and one absence check over three tiers replaced a walk over every leaf of a light projection. ⚠️ **Four suites are new on 2026-09-02** — `compare`, `routine`, `share-image` and `estimate` — and the per-suite rows below are the recount too. ⚠️ **Test-only npm deps, none of which ship**: `render` needs `jsdom`, `qr` needs `jsqr`, `rules` needs `@firebase/rules-unit-testing`. ⚠️ **`npm i --no-save` REPLACES what is there** — install them in one command (`npm i --no-save jsdom jsqr @firebase/rules-unit-testing`) or the previous one vanishes and its suite fails with MODULE_NOT_FOUND. Everything else needs nothing. ⚠️ Treat any number here as a recount rather than a running tally |
| **Year-grid tests** | `node tests/year-grid.test.mjs` — 45 assertions, **no dependencies**. The calendar's Years view: every day drawn exactly once, every square in its real weekday row, every month label over its own month |
| **Data tests** | `node tests/data-layer.test.mjs` — **1,990 assertions** (2026-09-11), **no dependencies**. 🆕 **Since 2026-09-08 the Google flow's `created` flag**, which decides whether creating an account absorbs this device's local rows: linking an anonymous session counts, and 🚨 `signInWithCredential` after `credential-already-in-use` does NOT — that branch is reached precisely because the account already exists. **Mutation-checked in both directions.** ⚠️ Since 2026-08-30 it also holds the **EXERCISE-PICTURE manifest**: that it matches `img/exercises/` on disk (a forgotten `tools/build-exercise-images.mjs` fails here, because the drift is otherwise silent — a filename typed wrong shows no picture, and no picture is this feature's normal state), that every picture is in the sw precache (**D6**), and 🚨 that a picture given to one "Cable Kickback" is not given to the other. ⚠️ Since 2026-08-30 it also holds the **MOVEMENT FAMILIES** — that all 271 members resolve to exactly one exercise (the `preset-systems` by-name lesson on a second table), that no exercise is in two families, that a leg press offers four kinds of EQUIPMENT rather than five barbell squats, and 🚨 that Hip Adduction, Neck Curl and Tibialis Raise have **no family on purpose** because each is the opposite movement to its lookalike. And **the Research tab's content**: that every claim on that screen cites a source that is actually defined, that every topic states its own limit, and the **WORD BUDGETS** — 45 words an answer, 48 a bullet, 260 a topic. That last group is the point of this section: every other assertion anybody would write about educational text checks it is PRESENT, and none of them can catch prose piling back up. It also pins the three sentences whose popular version is the OPPOSITE of the finding (stretching not preventing injury, "not to failure" not meaning stop early, no best time of day). ⚠️ Since 2026-08-27 it also holds the **profile-photo crop maths** (the crop square never leaves the image — 1,925 combinations, zero escapes) and the **file-import parser**: the date order, the weight unit and the distance unit are each REFUSED rather than guessed, and a re-import upserts instead of doubling. ⚠️ Since 2026-08-24 it also carries **how full the cloud is**: Firestore's published per-type charges, that a number costs 8 bytes against 3 as JSON so a size check built on `JSON.stringify` would fire too late, that the demo year agrees with the review's ~1,100 JSON bytes a session (so the 1.66× is Firestore's accounting and not an unusual fixture), and **that `cloudUsage()` says nothing at all unless the data really is in Firestore**. ⚠️ Since 2026-08-24 it carries the **within-session fatigue** section: Tim's real back session driven end to end, that the lift he did third no longer leads it, that the first exercise is never discounted, that the same three exercises **in a different order now rate differently** — which they did not before — and that a benchmark is never fatigued |
| **Body-weight tests** | `node tests/bodyweight.test.mjs` — 175 assertions, **no dependencies**. What fraction of your body weight each movement carries, that it is read from the DATE OF THE SET, and **which exercises are refused and why**. ⚠️ Since 2026-08-24 it also pins the **assist** branch — that 70 lbs of help at 180 lbs is 110 lbs of resistance, that more help than you weigh is refused rather than reported as a negative load, and that an assisted set is discounted **below a real pull-up muscle for muscle**. The exclusion list it guards lost one entry that day and the reason is written into the list itself |
| **Estimator tests** | `node tests/strength-estimate.test.mjs` — 72 assertions, **no dependencies**. Most assert MEASURED simulator outcomes, each with a vacuity guard. `node tools/strength-fit.mjs` re-derives every constant rather than trusting it |
| **Social tests** | `node tests/social.test.mjs` — 181 assertions, **no dependencies**. What a person SHARES. ⚠️ Since 2026-08-29 it also pins the **name matching** (prefix of the whole name OR of any word, never a substring inside one — "nn" finding "Anna" is how a list of strangers starts looking like a list of matches) and the graph's **`pending`** list, including that somebody already CONNECTED is never also pending. ⚠️ Since 2026-08-22 the invite block is fed **the shape the network really returns** — a Firestore Timestamp, not the tidy ISO string the old fixtures used. That gap is where the expired-invite bug lived |
| **Volume tests** | `node tests/volume-map.test.mjs` — 64 assertions, **no dependencies**. Direct/indirect mapping, the published efficiency tiers, and the per-session clamp |
| **Comparison tests** | `node tests/compare.test.mjs` — 53 assertions, **no dependencies**. Two people on one lift. ⚠️ **The load-bearing one is the WINDOW**, and its fixture is built so the answer differs unwindowed — with a widened control beside it, because a fixture that gives the same answer either way proves nothing. Also pins that no output field ever names an overall winner (Rule 6), and since 2026-09-02 that a converted estimate fills the e1RM row and **never** the heaviest-set-recorded row |
| **Estimate tests** | `node tests/estimate.test.mjs` — 29 assertions, **no dependencies**. The per-exercise 1RM and the rep prediction. 🚨 **The load-bearing one is the ROUND TRIP** — `repsForWeight(e1rm(w, r), w)` must return `r` at every weight and rep count, which a wrong exponent or a wrong k both fail and almost nothing else would catch. Also pins the refusals: a custom exercise, a bodyweight lift with no weigh-in, a muscle with no rating, and a rating that is itself a compound standing in |
| **Routine tests** | `node tests/routine.test.mjs` — 42 assertions, **no dependencies**. Copying a friend's workout into one of yours. 🚨 Weights never survive — theirs is a record and ours is a plan — and an exercise missing from your library is dropped AND reported, never silently |
| **Share-image tests** | `node tests/share-image.test.mjs` — 91 assertions, **no dependencies**. The pure half of the shareable picture: every block inside the canvas, a long title truncating rather than overflowing, a missing field dropping its block rather than leaving a hole, and ⚠️ **a bound on the WASTED space** — the two bugs that shipped were both about space inside the bounds, which every original assertion was blind to |
| **Rating tests** | `node tests/optimal.test.mjs` — 76 assertions, **no dependencies**. The dose-response curves, and the three things the rating refuses to do |
| **Goals tests** | `node tests/goals.test.mjs` — 232 assertions, **no dependencies**. The requirements model, progression, and **the three things Goals refuses to do**: read the calendar to decide what it asks of you, emit a verdict, and let a clock make anything heavier. ⚠️ Since 2026-08-24 it also **plays an assist machine forward through forty obeyed sessions** and asserts it never once proposes more assistance. That section replaced two assertions that were green while the bug was live, because they read the SOURCE for a guard rather than driving the function with the exercise that reaches it |
| **Demo tests** | `node tests/demo.test.mjs` — 58 assertions, **no dependencies**. That the generated year is DETERMINISTIC (the same day is byte-identical, so "resets to the default" is literal), PLAUSIBLE against the app's own modules, and that **the backend serving it is single-flight** |
| **Accessibility tests** | `node tests/a11y.test.mjs` — 102 assertions, **no dependencies**. Pins **all four PALETTES**: every text token against every surface it can be painted on, in both themes, plus the three-step hierarchy and the two fixes that are invisible when they break. ⚠️ **Not a substitute for the audit** — it caught a latent light-theme pair no screen currently paints, and the audit caught an accent-coloured number on one cell in the month. Neither could have found the other's |
| **The accessibility AUDIT** | 🚨 **`#/me` WAS NOT IN ITS ROUTE LIST UNTIL 2026-09-11, AND THE REASON IT WENT UNNOTICED IS THE LESSON**: the list already had a row called **Profile** and that row is `#/profile`, the gender/birth-year FORM — so the Profile TAB, live since 2026-09-08, had never had a pixel measured while the list looked complete. **The 2026-08-24 `#/data` fault in its mildest form: a route absent from the list looks exactly like a route that passed.** ✅ Added with `#/me/workouts`; latest sweep **272 routes, 34,027 text nodes, zero below 4.5:1, zero overflow, zero unnamed controls** at 360 / 390 / 880 / 1280. ⚠️ **And the first SUMMARY of that run was wrong in the reassuring direction** — a script reading the wrong JSON keys reported *0 text nodes, 256 contrast failures*; the node-count rule below catches a broken reader as well as a stale server. `tools/a11y-audit.mjs` — drives Chrome over **100** screen/width/theme combinations as of 2026-09-02 (**11,365** text nodes, zero below 4.5:1, zero overflow, zero unnamed controls), and since 2026-08-27 takes a `PALETTE` env var (gold/teal/indigo/ember) so all four can be swept. 🆕 **Three routes joined on 2026-09-02 and two of them are firsts**: a friend's workout and the comparison sheet over it are **the first screens behind `#/friend` this audit has ever measured** — a friend's uid is generated, so there was no hash to put in the list until the feed card's own link existed to click; and `#/benchmark` now runs **with an exercise picked and a weight typed**, because everything added to that screen only exists after that. *(Earlier figure, kept for the shape of the growth: gold over 76 × **7,566** nodes on 2026-08-30: zero below 4.5:1, zero overflow, zero unnamed controls; ⚠️ **the SWAP SHEET joined on 2026-08-30 and it is the first SHEET this audit has ever measured** — a sheet only exists after an interaction, so the exercise picker and the visibility sheet have never been in it either; the last all-four sweep was 240 combinations and 23,496 nodes on 2026-08-27). 🚨 **TWO THINGS THE TOOL ITSELF HAD WRONG, both fixed 2026-08-30 and both found by measuring the Research topics.** (1) **A closed `<details>` still reports a box for its contents in this Chrome** — it hides them with content-visibility, not `display:none` — so the collapsed pane and the opened one measured an identical 328 text nodes. Never a false pass (those colours do get painted on open) but a **false coverage claim**, and the research TABLE had been counted that way since 2026-08-28. (2) **`summary` matched nothing in the control selector** — natively focusable, no `tabindex` — so **every disclosure control in the app had been unmeasured for touch target and accessible name since the first one shipped**; the topic summaries measure 49–78 px by 332/362. ⚠️ **THE SESSION RUNNER JOINED IT ON 2026-08-29 and had never been measured before that** — the one screen the app exists for, skipped because a session needs a workout id and the route list only held static hashes. It is reached by driving Record → Weightlifting → the next workout, and **the step asserts it landed** (`.set-list` must exist): the first version matched `/^Start/` against the chooser's rows, whose text begins with the workout NAME, and silently filed four route-instances of the picker under the runner's name. A failed step is now **printed rather than swallowed**, for the same reason. Set through the ATTRIBUTE, because the demo backend reseeds on every reload. ⚠️ **Until 2026-08-24 two of its routes (`#/data`, `#/muscles`) did not exist and silently rendered Home**, so Home was measured three times and the Data screen and body map never once. Fixed: the real route is `#/graphs` and a route row can now carry a step to run after navigating, which is how the four in-page data modes and a selected muscle are reached. Needs a scratch copy with the config blanked; the header has the commands. ⚠️ **Its `hit44` flag is a TRIPWIRE, NOT A VERDICT** — it fails 1616 of 2068 controls on long-audited screens, because anything under 44px in either dimension fails by construction. **The only thing that can measure contrast against the colour actually painted, or hit-test a touch target** |
| **Render tests** | `npm i --no-save jsdom` then `node tests/render.test.mjs` — **1,246 assertions** (2026-09-11), mounts every screen. 🆕 **Since 2026-09-11 it holds THE PROFILE TAB'S FOUR SECTIONS** — the body row (what is there leads, what is missing is named, and it is a DOOR to `#/profile`), the goal row (**and no verdict word anywhere on the screen**), the best-lifts list (**days trained leads, the heavier one-day lift second**, measured over labelled estimate) and the calendar — plus 🔒 **that `#/me` holds no `input`, `textarea` or `select` at all**, which is the property the whole Data/Profile split rests on. 🆕 **Since 2026-09-09 it also holds THE RECORD PULL-UP** (the corner is a `down` arrow labelled Close, it lands on Home, and 🔒 **no parked screen is ever built in jsdom** — one would double every selector in the suite), **the PROFILE COUNTS** (two figures, one called Friends, no "?" on a private account, the public-account sentence ON the screen, and all three of `#/me/friends|followers|following` landing on a list titled Friends), and **the two wordiness splits** — the Goals safety claim asserted on the pane while the 2–10 % band and the lay-off refusal are read back out of the popover, and the Research tab's other-numbers paragraph likewise. 🆕 **A FRIEND'S MAP READ AGAINST THEM**, and the fixture is the assertion: **she is female while the reader is male**, because every earlier fixture published a male `defaultCompare` and so could not tell the right answer from the wrong one. It pins the caption (*women who lift*, and not *men* anywhere in it), that asking for men MOVES her level (the vacuity guard), that the caption follows the change — it used to be built once and never repainted — and the three pronouns: *Like them*, *Their body weight*, *Their age*, with *Own body weight* on the two-body screen. 🔒 **Plus the sheet's cut**: no `.preset-hint` anywhere, four axis dots, and the untrained-adult caveat read back **out of an opened popover** rather than off the pane. ⚠️ **And the STRUCTURE the laptop layout rests on** — the figure and the panel are siblings in one `.map-split`, and the shared-map host does NOT take `is-muscles`; jsdom has no layout, so this pins the shape and the browser measures the pixels. 🆕 **Since 2026-09-08 it holds THE SIMPLIFIED PROFILE MENU**: that a signed-in account is never shown a "Left on this device" card and no `/^Upload /` button (asserted on the SCREEN, because the card is what Tim objected to), and 🔒 **six caveat assertions that now CLICK the ? and read the popover back** — the demo card's two, the demo screen's "starts it over" plus a new one for Social being off, and the note's "goes straight to the person building it". ⚠️ **One could NOT be converted and was replaced honestly** — "the help text says what Edit is for" read a sentence that was deleted rather than moved, so it now asserts that the caption still names who can see the photo and that the sentence beside the Edit button is gone, not hidden. 🆕 **Since 2026-09-07 it holds LEAVING A WORKOUT OPEN**: that the runner's corner control keeps the session rather than ending it, that the bar names the workout and the exercise the WALK points at (asserted at step 3 of a superset, where `entries[index]` would read nothing), that yesterday's draft is not a live one, that the bin asks only when sets are recorded — and 🚨 **that starting a second workout no longer deletes the first**, which it did silently until that day. 🆕 **The SAVE SCREEN too**: 🚨 that **Finish saves nothing**, that the draft survives every path off it, and that a failed save says so **on the screen the user is looking at**. 🆕 **And the "?"** — a real button with an accessible name, Escape and outside-tap close it, one open at a time. 🔒 **The six assertions that guard the Volume and Goals caveats now OPEN the ? and read the words back**, which is stricter than the presence checks they replaced. 🚨 **Since 2026-08-30 its first picture assertion is about ABSENCE**: with no art bought, NOTHING renders a thumbnail and no name becomes a button — the screen is what it was before the feature existed. That is the only thing making it safe to ship ahead of the art, and it is mutation-checked. It then injects one picture and drives the rest: the name opens a full-screen viewer, the ✕ and Escape both close it, and a thumbnail inside a row is never itself a button. ⚠️ **Since 2026-08-30 it pins the SWAP SHORTLIST and REMOVING A PERSON**: five alternatives rather than 275, spanning three or more kinds of equipment, tapping one swaps straight to it (asserted by CLICKING, the only version that catches an inert row), the full picker still one tap under it — and 🚨 that the lead does NOT promise "different equipment" for a deadlift, whose family is barbell-only. For people: exactly ONE remove control, on the ACTIVE person, **asserted with two guests on the bar because with one it passes however the code is written**. ⚠️ **Since 2026-08-30 it pins that the Research topics arrive COLLAPSED** — eleven of them open at once is the wall that content exists not to be — that each is a real `<details>`/`<summary>` rather than a hand-rolled control that would drop off the accessibility tree, and that opening one reveals an answer, a stated limit and a live link. Mutation-checked: making them open by default flips exactly the collapsed assertion. ⚠️ **Since 2026-08-29 it holds the two SAFETY assertions for the first-time prefill**: tapping Finish having touched nothing records NOTHING, asserted separately for the derived weight because that is the number that would otherwise be most convincing. Both mutation-checked. It also pins that a request is an ASK rather than a connection, that a QR is hard-coded black-on-white, and that the finish screen's back button actually goes somewhere — **asserted by CLICKING it, which is the only version that would have caught the five inert back buttons it did catch.** ⚠️ **Since 2026-08-29 it pins WHERE THE STEPPERS ARE**: exactly one `.steppers` on the screen, inside `.set-list`, directly under the open row — and opening set 3 MOVES it there. Plus the one that would otherwise have shipped as a bug: a nudge must update the row **in place**, asserted by holding the row NODE across the change, because a rebuild would destroy the input being typed into. Both mutation-checked, each flipping only itself. ⚠️ Since 2026-08-27 it pins three things a browser could not: that the **Friends screen renders while the network is still hanging** (it is handed a read that never resolves — re-adding the `await` fails it), that **a workout offered by a friend writes NOTHING into your training until you tap Add**, and that the disconnect sheet says both that they are told and that it is eventual. ⚠️ Since 2026-08-25 it pins the three things Tim's second gym session changed: that **clicking the weight and reps of a set opens that set** (the numbered square was the only live part), that every Record row **says Start and wears no chevron**, and that the programme's name is on Record **even when there is only one system**. ⚠️ Since 2026-08-24 it also drives `cloudFullWarning()` directly — the only way that wording gets read, because no test can stand up a Firestore backend and `cloudUsage()` correctly returns null on every backend one can. It pins that an account with room is told **nothing**, and that the "full" branch keys off room for one more row rather than the fraction reaching 1. ⚠️ Since 2026-08-24 it holds the two runner assertions that stopped a convenience becoming a lie: that opening set 2 for the first time arrives pre-filled from set 1, and that **a set nobody opened is still not saved** — the eager version of that fill recorded work the lifter had not done, and these tests are what caught it. ⚠️ Since 2026-08-21 it also pins the **view/edit split**: that opening a system is reading it, that a workout can be STARTED from its own screen, that Delete is not in either pinned footer, and that Settings renders inside the demo account. It also holds the one assertion in this project that is a **budget rather than a presence check** — a muscle panel is capped at 40 words, because every other assertion here checks something is THERE and no such check can catch words piling back up |
| **Deploy-notice test** | `node tests/sw-update.test.mjs` — 12 assertions, needs Chrome, **no other dependencies**. Copies the app to a temp dir, serves it, installs the worker, then EDITS A FILE and asserts the page offers a refresh. The one test that cannot be faked |
| **QR tests** | `node tests/qr.test.mjs` — 33 assertions. Needs `npm i --no-save jsqr` for the strongest layer: the encoder's output is rendered to pixels and **decoded by an independent implementation**, which validates format-info, masking, placement, interleaving and ECC in one assertion. Also carries ZXing's published Reed-Solomon vectors. ⚠️ **It does NOT assert which mask a payload gets** — ZXing, Nayuki and the ISO text disagree on penalty-rule-3 details, so a correct implementation can legitimately pick a different one |
| **Rules tests** | `npm i --no-save @firebase/rules-unit-testing`, then **`JAVA_HOME` must point at Temurin 21** (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`), then `firebase emulators:exec --only firestore --project demo-test "node tests/rules.test.mjs"` — 159 assertions, who may READ your data — and since 2026-08-27 who may OFFER you a workout and who may announce a disconnection, and since 2026-08-29 who may ASK to connect. 🚨 **One assertion in here is deliberately an `allow` that records a cost rather than a guarantee** — "any signed-in account can list the whole directory" — because a suite that pinned only the good news would describe a feature this app does not have. **It is the line that flips to a denial when the handle version lands.** ⚠️ **On the Oracle JDK the emulator dies silently** — see §0.9 |
| **Rebuild the picture manifest** | `node tools/build-exercise-images.mjs` — after dropping files into `img/exercises/` named `<exerciseId>.<ext>`. Rewrites the manifest in `js/exercise-images.js` AND the precache block in `sw.js`. ⚠️ It REFUSES a badly-named file rather than skipping it: a picture that never appears looks exactly like one that was never bought. `img/exercises/README.md` has the naming and the licensing |
| **Rebuild the body art** | `python tools/build-body-art.py` — only if the source JPG or the seeds change. Needs `pip install pillow numpy scipy potracer` |
| **Look at it** | headless Chrome — §0.6. Use CDP + `Emulation.setDeviceMetricsOverride` for anything involving input |
| **Firebase** | project `fitness-tracker-th` · [console](https://console.firebase.google.com/project/fitness-tracker-th/overview) · `firebase deploy --only firestore:rules` |
| **Deploy** | commit + push to `main`; Pages rebuilds in ~40–50s |

It needs a server — ES modules do not load over `file://`.

