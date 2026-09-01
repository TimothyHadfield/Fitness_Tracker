# Fitness Tracker — Progress & Context

> 🟢 **FRESH SESSION: READ THIS FILE AND `docs/handbook.md`, BOTH, BEFORE DOING ANYTHING.**
> This one is **what is true now and what is left**. The handbook is **how to work here** — the
> environment traps, the working agreement, the architecture, the binding design rules and the
> locked decisions. Two files, ~260 KB together, and neither is optional.
>
> 🚨 **EVERY `§N` REFERENCE IN THIS PROJECT MEANS `docs/handbook.md`** — `§4` the architecture, `§6`
> the locked decisions, `§9` the known gaps, `§0.10` the demo account. **The numbers did not change
> on 2026-09-04; only the file they live in did.**
>
> **`docs/history.md` is the dated log** — every session's full write-up, newest first. You do not
> read it; the recent ones are summarised below and you go there for the detail, searching by date.
> ⚠️ **It is larger than one read** (366 KB): grep it for the date, then read that range.
>
> `chat.md` is the human-readable log and answers "what did we say about X"; it starts at
> 2026-08-21, with everything before that in `docs/chat-archive.md`.

**Last updated:** 2026-09-04 — the docs were reorganised (this file, the handbook and the history);
nothing about the app changed. Before that, 2026-09-03: the tiers are gone (private/public), a
friend's body map is tappable, and two bodies can be compared side by side.

## ⚠️ 2026-09-04 — WHY THE NOTES ARE IN FIVE FILES NOW, AND THE RULE THAT KEEPS THEM THAT WAY

🚨 **THIS FILE HAD REACHED 626 KB AND COULD NO LONGER BE OPENED IN ONE READ.** The instruction at
the top of it said *"read this entire file before doing anything"*, and the tool a session uses to
do that refuses anything over 256 KB — **so the one instruction the whole workflow rests on had been
quietly impossible for some time, and nothing said so.** `chat.md` had crossed the same line at
424 KB. **The dated log was 52 % of this file and is pure history**, which is the cut that was made:

| File | What it is | Read it |
|---|---|---|
| **`progress.md`** (82 KB) | state, standing instructions, **Open work** | every session, top to bottom |
| **`docs/handbook.md`** (183 KB) | §0–§10 — traps, agreement, architecture, rules, decisions | every session, with this one |
| **`docs/history.md`** (366 KB) | every dated session section, newest first | never whole — search it by date |
| **`chat.md`** (172 KB) | the human-readable log, 2026-08-21 onward | only to answer "what did we say about X" |
| **`docs/chat-archive.md`** (242 KB) | the same log, 2026-08-14 to -20. **Closed** | rarely; new entries never go here |

🚨 **THE RULE THAT STOPS THIS COMING BACK: A SESSION'S FULL WRITE-UP GOES AT THE TOP OF
`docs/history.md`, AND ONLY ITS ONE-LINE SUMMARY COMES HERE.** That is the whole mechanism, and it
is restated in §0.3. This file then grows by about two kilobytes a session instead of forty.

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

# 🟢 START HERE: NOTHING IS HALF-BUILT, AND ONE THING IS WAITING ON TIM

**The working tree is clean, everything is pushed, the rules are deployed and the live site is
serving it.** No half-finished job to pick up. **Between jobs, say what is done and stop — do not
propose what to build next** (§1, and Tim has asked for that twice).

## ⏸️ THE ONE OPEN THREAD: HOW TO RANK ABS — Tim asked, it was answered, HE HAS NOT PICKED

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

**Autumn's account has not opened the app since 2026-09-03, so it is still on the OLD sharing
model** — `shared/full`, published 2026-08-31. Tim's is migrated. **This is normal and handled**:
each account migrates its own documents on its own device, and a reader falls back to the tier
documents (`social.friend()` probes `friends` → `public` → `full`/`mid`/`light`). Her map, her cards
and her workouts all read fine through that path; what it cannot do is the tappable panel or a
comparison, and both screens say so by name.

**It resolves itself the moment she opens the app once.** ⚠️ **If a future session sees "their app
has not updated" anywhere, that is this, and it is not a bug.** The fallback is marked for deletion
once nobody is left on an old build.

## What changed on 2026-09-03, in one line each

1. 🚨 **THE THREE VISIBILITY TIERS ARE GONE.** An account is **private** (accepted friends see
   everything) or **public** (anybody signed in who finds you sees everything too). Tim's call, and
   he was asked directly whether the per-person levels should go with them: yes. **Body weight is the
   one field that never goes public**, and it keeps its own opt-in switch for friends.
   🚨 **AND THE DEFAULT IS PUBLIC** — Tim, an hour after it shipped the other way round: *"I would
   like the default to be public… for now it should definently be public… Change this now so
   everyone's information is public."* An account that has never opened the sheet publishes to
   anybody signed in. ⚠️ **He named the way out himself and it is the right one: ask on first
   sign-in, so the answer is a choice rather than a default.** Not built.
2. 🚨 **A FRIEND'S MUSCLE MAP IS TAPPABLE, WITH THE SAME PANEL AS YOUR OWN** — the estimate, what the
   next level costs, the confidence and the recorded sets behind it. **And you can ask it any
   comparison question the sheet offers**, because their client publishes a percentile per group
   rather than one number.
3. 🆕 **THEIR VOLUME AND THEIR GRAPHS**, computed on your device from what they published, by the
   same functions that draw yours.
4. 🆕 **TWO BODIES SIDE BY SIDE** at `#/compare/<uid>`, reached from a Compare button on any muscle
   map — theirs or your own.
5. 🚨 **AND A FRIEND ON THE OLD MODEL IS STILL READABLE** — reported by Tim within minutes of the
   deploy, because Autumn's account had not migrated and she had vanished from every screen. The
   reader falls back to the tier documents. See `docs/history.md`, 2026-09-03 §A00; it is the
   2026-08-28 "her data is lost" incident arriving through a migration instead of through a publish.

## What changed on 2026-09-02, in one line each

Three passes, each with its own dated section in `docs/history.md`.

1. **The home feed became a Hevy-shaped feed** — all eight steps of `docs/social-plan.md` §13. Cards
   carry a description, a **Time · Sets** row and one line per exercise; tapping one opens **a
   friend's workout on its own screen** (`#/friend/<uid>/<sessionId>`) with a muscle split, typed
   bests and set tables, where you can compare a lift against your own, copy the workout into your
   own plan, or share a picture of it.
2. **Back means the screen you were just on** — **Design Rule 8**. Every back arrow used to go to a
   hard-coded PARENT; it now goes back through history and the parent is only the fallback.
3. **Every exercise has an estimated 1RM** — `js/exercise-estimate.js`. Comparisons use it where a
   side has never done the lift, and the benchmark screen shows the estimate, what share of it a
   typed weight is, and roughly how many reps it allows.

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
3. 🚨 **NOTHING FROM 2026-09-02 OR -03 HAS BEEN ON A PHONE, AND NO TWO REAL ACCOUNTS HAVE USED ANY
   OF IT.** It is proved in jsdom, in a real browser at 360 and 1180px in both themes, and by the
   accessibility audit — three different things, none of them a person. **Open work item 1.**
   ⚠️ **The visibility change makes that list heavier, not lighter**: the only way to see what a
   PUBLIC account looks like to a stranger is a second real account, and the only way to prove the
   migration worked is an account that published under the old tiers.
4. 🚨 **NO HUMAN HAS CHECKED A SINGLE PREDICTED NUMBER AGAINST AN ACTUAL ATTEMPT.** The estimator
   rests on a curve whose absolute accuracy was never validated (`docs/research.md` §1.3) and on
   ratios describing a population rather than a person. Everything it prints ships with a confidence
   and a source list for that reason. **Do not describe any of it as accurate.** Open work 19.
5. ⚠️ **THE HEVY SCREENSHOTS ARE DELIBERATELY NOT IN THE REPOSITORY** — it is public and they are
   somebody else's UI. `docs/social-plan.md` §12.12, §12.13 and §12.15 are written in enough detail
   to build from **because they are the record**. Do not look for image files; do not commit any.

## Standing instructions that survive a reset

- 🛑 **THE APP ICON IS CLOSED AND MUST NOT BE REOPENED** (2026-08-30, fourth pass).
- 🛑 **DO NOT BUILD THE DISCOVERY FEED.** `docs/social-plan.md` §12.11 — not a feature this app is
  missing, a product this app decided twice, in writing, not to be. Open work 18.
- 🛑 **DO NOT SURFACE THE PINNED ITEMS (P1–P4)** as "the next thing to do" — Tim's standing
  instruction, 2026-08-28. Build them if he names them; otherwise leave them alone.
- 🆕 **The abs question is OPEN again — Tim re-opened it himself on 2026-09-03.** ~~deferred~~
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
| **21** | 🆕 **the abs ranking — TIM'S DECISION, ASSESSED 2026-09-03** | ⏸️ He re-opened it himself and asked for the problems with two approaches. The assessment is `docs/history.md`, "2026-09-03 — HOW TO RANK ABS"; the short version: **his first idea (weighted core work through the normal machinery) is buildable if the numbers are pulled properly, and answers about a third of it**; **his second (seed from their other muscles, then track improvement) puts two different meanings in one colour and invents a correlation nobody has measured**; and **the cheapest fix needs no new data at all** — give trained-but-unrankable muscles their own mark and legend entry, and have the panel say what HAS been logged. **Nothing is built and nothing should be until he picks** |
| **17** | ~~the Hevy-shaped home feed~~ | ✅ **BUILT 2026-09-02 — all eight steps of `docs/social-plan.md` §13**, which now carries a ✅ block under each one and a §14 summary. What is left of it is two things Tim owes a decision on (**warm-up typing**, still item 2 below; **per-workout visibility**, §13's decision B) and **step 9, photos, which needs Blaze** and is item 10. ⚠️ **The Records column is deliberately absent from the card** — sixty published sessions are not a lifetime, and that caveat does not fit beside somebody's name; the bests are on the workout screen instead. ⚠️ **Nothing here has been used by two real accounts** — that is item 1, and it grew a longer list today |
| **18** | ⚠️ **do not build the discovery feed** | Not work — a standing refusal, and it is listed here because a feed of strangers is the obvious next thing somebody will think of now that the feed looks like Hevy's. `docs/social-plan.md` §12.11: **it is the thing D7 actually refused**, it needs public profiles and enumeration of them (the thing the invite-link design exists to avoid), and it imports a moderation story this project does not have |
| **1** | **the field checks — needs Tim's phone, not yours** | 🆕 **2026-09-03 PUT THE BIGGEST SINGLE ITEM ON THIS LIST: NOBODY HAS SEEN A PUBLIC ACCOUNT FROM THE OUTSIDE.** Every account is public by default now, and the only way to know what a stranger actually gets is a second real account opening the first one's page — the rules are proved on the emulator and the screens are proved in the demo, and **neither of those is a stranger**. Also unfielded from that day: the tappable friend map, the two-body compare screen, a friend's volume and graph screens, and the **legacy fallback**, which is proved against a fixture shaped like Autumn's live document but has never actually been the thing a real second phone rendered. 🆕 **2026-09-02 ADDED A LOT TO THIS LIST AND NONE OF IT HAS BEEN ON A PHONE**: the new feed card, a friend's workout screen, the comparison sheet, copying a friend's workout into your own plan, and — the one most likely to behave differently on a real device — **sharing a picture**, which goes through `navigator.share({files})` and has only ever been driven in headless Chrome, where it falls through to the download path. ⚠️ **THE BIGGEST ONE IS STILL A TEN-MINUTE JOB WITH AUTUMN**: search her by name, send a request, have her accept it, and record a workout for her so it lands in her account. **Everything social built on 2026-08-29 is proved against the rules engine and has never been done by two people.** Also standing: the **friend-name heal**, a real **kudos/comment** round trip, and — needing only his eyes — **the blue box round the profile picture on a laptop** (a real bug was found and fixed in that exact place, but a *blue* one was never reproduced). ⚠️ **And file import has never parsed an actual export** from any service. ⚠️ **Added 2026-08-30: nobody has read the Research topics on a phone** — the facts are checked and measured, the reading experience is not. 🚨 **AND THE OTHER TWO PASSES OF 2026-09-02 ARE ON THIS LIST TOO, one of them at the top of it: `goBack()` changed EVERY back arrow in the app and has never met the iOS edge-swipe gesture** — which is the one input the design was chosen to survive, and which exists on no machine here. A router-level change to 48 controls verified only in desktop Chrome is the highest-risk unfielded thing of the day. Also unread on a phone: the benchmark screen's estimate and its two captions |
| **2** | **0c — the UX list** | ⚠️ **OPEN, and it is judgement rather than bugs.** Its headline item closed on 2026-08-25 (Home is a feed, which is nothing but growth) and the "hard sets" half was answered on 2026-08-24 by *saying* what is counted. **What is left is one question for Tim**: should logged warm-ups be excluded from the volume count? His call, because the obvious fix would also throw away genuine back-off work. 🆕 **2026-08-31 — THERE IS NOW A THIRD OPTION AND IT IS BETTER THAN BOTH**: Hevy's screens show a set is **typed at logging time** (`W` in amber for a warm-up, working sets numbered from 1), so the app never has to guess. That turns this from "which wrong answer do we pick" into a small feature — a set-type flag, a control in the runner, and the Volume tab's apology becomes a setting. ⚠️ **Every set already recorded is untyped and must stay counted rather than be retro-guessed.** `docs/social-plan.md` §12.16 |
| **3** | **activities, Phase 2 — item 6** | Items 1–4 shipped 2026-08-27. **Item 6 says to ASK TIM** which activities his circle actually logs — climbing grades are the least standardised thing in the list. `docs/activities-plan.md` §3. ⚠️ **Item 5, activity PRs, is PINNED (P1)**, not open |
| **5** | **0i — the body map's touch targets** | ⚠️ **MOSTLY CLOSED.** Invisible hit halos grow every muscle ~10 px in all directions without touching the art (Traps 44×15 → ~64×35 effective, CDP-verified). What remains under 44 px lands on **Tim's illustration**, so it stays his call |
| **6** | **0f — Tim's friend could not sign in** | ⚠️ Unread bug report; he asked to investigate it himself. **May not be new** — a plain Safari tab is still the one surface no working device has confirmed |
| **8** | **item 2 — the estimator, Phases 1–3** | The Goals *verdict* waits on it. ⚠️ **It has questions for Tim** — **§6.1** sets the hard constraint (the band fits inside one level only 8.5 % of the time; ⚠️ **this file cited §16 for that for weeks, and §16 is a different section** — corrected 2026-09-02), and §14 asks whether the estimator may draw on all evidence at once (narrowing D14). 🆕 **2026-09-02 moved two pieces of this without touching the plan's phases**: `buildObservations()` is out of `store.js` and into `js/strength-observations.js`, so a friend's training goes through the same walk as yours; and `muscleRatings()` is that same rating WITHOUT the profile gate, which is what lets an account with no weigh-in have an estimate at all. ⚠️ **The plan's claim that Phase 1 is blocked on data the store does not carry is WRONG** — see the 2026-08-28 section, item 5. `setIndex` and `exerciseIndex` are array positions in data already on disk, derivable at any time. Phase 1 is small; what gates the feature is Phase 2, and Phase 2 needs him |
| **15** | **the usability findings — waiting on Tim's pick** | ⚠️ Four standing findings from the 2026-08-28 usability drive, reported to him and not yet chosen from: **no wake lock** (the biggest hands-free lever), **prefill counts as recorded at Finish**, the **Record chooser's extra tap**, and the Run log's **"28" = 28 seconds** parse. See that day's second-pass section. ⚠️ **The prefill one is HALF fixed as of 2026-08-29 and the halves matter**: a never-done exercise is now guarded (`prefilled`, refused by the save path), an exercise WITH history is untouched — walk past it and last time's numbers record as though you did them. Left alone deliberately: it is a behaviour change on every workout and his to pick. ⚠️ **The rest-timer items in the same list are DECLINED, not waiting** — do not resurface them |
| **19** | 🆕 **the estimator has never been checked against a person** | ⚠️ **Not a bug — a standing hole that got much bigger on 2026-09-02.** The app now prints an estimated 1RM for virtually every exercise, a percentage of it, and a predicted rep count, and **not one of those numbers has ever been compared with an actual attempt.** `docs/strength-estimate-plan.md` §11.2 — the backtest against Tim's own held-out benchmarks — is the only thing that would change that, and it has never been run. **It needs nothing from anybody: the data is already on disk.** The cheapest honesty win left in the project |
| **20** | 🆕 **`docs/research.md` §2's table has a transcription error** | ⚠️ It gives **~5 reps at both 95 % and 90 % of a max**, which cannot both be true — found 2026-09-02 while building the rep prediction, and flagged in place. Nothing has ever been shipped off that row. Fixing it means re-reading PMC10933212 (Nuzzo et al. 2024). Small, and it is a wrong claim sitting in the file the whole app cites |
| **22** | 🆕 **nobody has seen a PUBLIC account from the outside** | ⚠️ Part of item 1, listed separately because it is the one thing today's change cannot be checked without: a second real account. The rules are proved on the emulator (159 assertions) and the screens are proved in the demo, and **neither of those is a stranger opening somebody's page.** Also unproved: the tier migration, which needs an account that published under the old model — every account Tim has does, so this is one sign-in away |
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
| **Everything at once** | **4,004 assertions across SEVENTEEN suites** (recounted 2026-09-03 by running every one: data-layer 1847, render 911, goals 232, bodyweight 175, social 162, a11y 102, share-image 91, optimal 76, strength-estimate 72, volume-map 64, demo 58, compare 53, year-grid 45, routine 42, qr 33, estimate 29, sw-update 12), plus **159 in `rules`** (emulator, not in that total). ⚠️ **`social` went DOWN (181 → 162) and that is not a loss of coverage** — the tier model it tested no longer exists, and one absence check over three tiers replaced a walk over every leaf of a light projection. ⚠️ **Four suites are new on 2026-09-02** — `compare`, `routine`, `share-image` and `estimate` — and the per-suite rows below are the recount too. ⚠️ **Test-only npm deps, none of which ship**: `render` needs `jsdom`, `qr` needs `jsqr`, `rules` needs `@firebase/rules-unit-testing`. ⚠️ **`npm i --no-save` REPLACES what is there** — install them in one command (`npm i --no-save jsdom jsqr @firebase/rules-unit-testing`) or the previous one vanishes and its suite fails with MODULE_NOT_FOUND. Everything else needs nothing. ⚠️ Treat any number here as a recount rather than a running tally |
| **Year-grid tests** | `node tests/year-grid.test.mjs` — 45 assertions, **no dependencies**. The calendar's Years view: every day drawn exactly once, every square in its real weekday row, every month label over its own month |
| **Data tests** | `node tests/data-layer.test.mjs` — 1847 assertions, **no dependencies**. ⚠️ Since 2026-08-30 it also holds the **EXERCISE-PICTURE manifest**: that it matches `img/exercises/` on disk (a forgotten `tools/build-exercise-images.mjs` fails here, because the drift is otherwise silent — a filename typed wrong shows no picture, and no picture is this feature's normal state), that every picture is in the sw precache (**D6**), and 🚨 that a picture given to one "Cable Kickback" is not given to the other. ⚠️ Since 2026-08-30 it also holds the **MOVEMENT FAMILIES** — that all 271 members resolve to exactly one exercise (the `preset-systems` by-name lesson on a second table), that no exercise is in two families, that a leg press offers four kinds of EQUIPMENT rather than five barbell squats, and 🚨 that Hip Adduction, Neck Curl and Tibialis Raise have **no family on purpose** because each is the opposite movement to its lookalike. And **the Research tab's content**: that every claim on that screen cites a source that is actually defined, that every topic states its own limit, and the **WORD BUDGETS** — 45 words an answer, 48 a bullet, 260 a topic. That last group is the point of this section: every other assertion anybody would write about educational text checks it is PRESENT, and none of them can catch prose piling back up. It also pins the three sentences whose popular version is the OPPOSITE of the finding (stretching not preventing injury, "not to failure" not meaning stop early, no best time of day). ⚠️ Since 2026-08-27 it also holds the **profile-photo crop maths** (the crop square never leaves the image — 1,925 combinations, zero escapes) and the **file-import parser**: the date order, the weight unit and the distance unit are each REFUSED rather than guessed, and a re-import upserts instead of doubling. ⚠️ Since 2026-08-24 it also carries **how full the cloud is**: Firestore's published per-type charges, that a number costs 8 bytes against 3 as JSON so a size check built on `JSON.stringify` would fire too late, that the demo year agrees with the review's ~1,100 JSON bytes a session (so the 1.66× is Firestore's accounting and not an unusual fixture), and **that `cloudUsage()` says nothing at all unless the data really is in Firestore**. ⚠️ Since 2026-08-24 it carries the **within-session fatigue** section: Tim's real back session driven end to end, that the lift he did third no longer leads it, that the first exercise is never discounted, that the same three exercises **in a different order now rate differently** — which they did not before — and that a benchmark is never fatigued |
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
| **The accessibility AUDIT** | `tools/a11y-audit.mjs` — drives Chrome over **100** screen/width/theme combinations as of 2026-09-02 (**11,365** text nodes, zero below 4.5:1, zero overflow, zero unnamed controls), and since 2026-08-27 takes a `PALETTE` env var (gold/teal/indigo/ember) so all four can be swept. 🆕 **Three routes joined on 2026-09-02 and two of them are firsts**: a friend's workout and the comparison sheet over it are **the first screens behind `#/friend` this audit has ever measured** — a friend's uid is generated, so there was no hash to put in the list until the feed card's own link existed to click; and `#/benchmark` now runs **with an exercise picked and a weight typed**, because everything added to that screen only exists after that. *(Earlier figure, kept for the shape of the growth: gold over 76 × **7,566** nodes on 2026-08-30: zero below 4.5:1, zero overflow, zero unnamed controls; ⚠️ **the SWAP SHEET joined on 2026-08-30 and it is the first SHEET this audit has ever measured** — a sheet only exists after an interaction, so the exercise picker and the visibility sheet have never been in it either; the last all-four sweep was 240 combinations and 23,496 nodes on 2026-08-27). 🚨 **TWO THINGS THE TOOL ITSELF HAD WRONG, both fixed 2026-08-30 and both found by measuring the Research topics.** (1) **A closed `<details>` still reports a box for its contents in this Chrome** — it hides them with content-visibility, not `display:none` — so the collapsed pane and the opened one measured an identical 328 text nodes. Never a false pass (those colours do get painted on open) but a **false coverage claim**, and the research TABLE had been counted that way since 2026-08-28. (2) **`summary` matched nothing in the control selector** — natively focusable, no `tabindex` — so **every disclosure control in the app had been unmeasured for touch target and accessible name since the first one shipped**; the topic summaries measure 49–78 px by 332/362. ⚠️ **THE SESSION RUNNER JOINED IT ON 2026-08-29 and had never been measured before that** — the one screen the app exists for, skipped because a session needs a workout id and the route list only held static hashes. It is reached by driving Record → Weightlifting → the next workout, and **the step asserts it landed** (`.set-list` must exist): the first version matched `/^Start/` against the chooser's rows, whose text begins with the workout NAME, and silently filed four route-instances of the picker under the runner's name. A failed step is now **printed rather than swallowed**, for the same reason. Set through the ATTRIBUTE, because the demo backend reseeds on every reload. ⚠️ **Until 2026-08-24 two of its routes (`#/data`, `#/muscles`) did not exist and silently rendered Home**, so Home was measured three times and the Data screen and body map never once. Fixed: the real route is `#/graphs` and a route row can now carry a step to run after navigating, which is how the four in-page data modes and a selected muscle are reached. Needs a scratch copy with the config blanked; the header has the commands. ⚠️ **Its `hit44` flag is a TRIPWIRE, NOT A VERDICT** — it fails 1616 of 2068 controls on long-audited screens, because anything under 44px in either dimension fails by construction. **The only thing that can measure contrast against the colour actually painted, or hit-test a touch target** |
| **Render tests** | `npm i --no-save jsdom` then `node tests/render.test.mjs` — 875 assertions, mounts every screen. 🚨 **Since 2026-08-30 its first picture assertion is about ABSENCE**: with no art bought, NOTHING renders a thumbnail and no name becomes a button — the screen is what it was before the feature existed. That is the only thing making it safe to ship ahead of the art, and it is mutation-checked. It then injects one picture and drives the rest: the name opens a full-screen viewer, the ✕ and Escape both close it, and a thumbnail inside a row is never itself a button. ⚠️ **Since 2026-08-30 it pins the SWAP SHORTLIST and REMOVING A PERSON**: five alternatives rather than 275, spanning three or more kinds of equipment, tapping one swaps straight to it (asserted by CLICKING, the only version that catches an inert row), the full picker still one tap under it — and 🚨 that the lead does NOT promise "different equipment" for a deadlift, whose family is barbell-only. For people: exactly ONE remove control, on the ACTIVE person, **asserted with two guests on the bar because with one it passes however the code is written**. ⚠️ **Since 2026-08-30 it pins that the Research topics arrive COLLAPSED** — eleven of them open at once is the wall that content exists not to be — that each is a real `<details>`/`<summary>` rather than a hand-rolled control that would drop off the accessibility tree, and that opening one reveals an answer, a stated limit and a live link. Mutation-checked: making them open by default flips exactly the collapsed assertion. ⚠️ **Since 2026-08-29 it holds the two SAFETY assertions for the first-time prefill**: tapping Finish having touched nothing records NOTHING, asserted separately for the derived weight because that is the number that would otherwise be most convincing. Both mutation-checked. It also pins that a request is an ASK rather than a connection, that a QR is hard-coded black-on-white, and that the finish screen's back button actually goes somewhere — **asserted by CLICKING it, which is the only version that would have caught the five inert back buttons it did catch.** ⚠️ **Since 2026-08-29 it pins WHERE THE STEPPERS ARE**: exactly one `.steppers` on the screen, inside `.set-list`, directly under the open row — and opening set 3 MOVES it there. Plus the one that would otherwise have shipped as a bug: a nudge must update the row **in place**, asserted by holding the row NODE across the change, because a rebuild would destroy the input being typed into. Both mutation-checked, each flipping only itself. ⚠️ Since 2026-08-27 it pins three things a browser could not: that the **Friends screen renders while the network is still hanging** (it is handed a read that never resolves — re-adding the `await` fails it), that **a workout offered by a friend writes NOTHING into your training until you tap Add**, and that the disconnect sheet says both that they are told and that it is eventual. ⚠️ Since 2026-08-25 it pins the three things Tim's second gym session changed: that **clicking the weight and reps of a set opens that set** (the numbered square was the only live part), that every Record row **says Start and wears no chevron**, and that the programme's name is on Record **even when there is only one system**. ⚠️ Since 2026-08-24 it also drives `cloudFullWarning()` directly — the only way that wording gets read, because no test can stand up a Firestore backend and `cloudUsage()` correctly returns null on every backend one can. It pins that an account with room is told **nothing**, and that the "full" branch keys off room for one more row rather than the fraction reaching 1. ⚠️ Since 2026-08-24 it holds the two runner assertions that stopped a convenience becoming a lie: that opening set 2 for the first time arrives pre-filled from set 1, and that **a set nobody opened is still not saved** — the eager version of that fill recorded work the lifter had not done, and these tests are what caught it. ⚠️ Since 2026-08-21 it also pins the **view/edit split**: that opening a system is reading it, that a workout can be STARTED from its own screen, that Delete is not in either pinned footer, and that Settings renders inside the demo account. It also holds the one assertion in this project that is a **budget rather than a presence check** — a muscle panel is capped at 40 words, because every other assertion here checks something is THERE and no such check can catch words piling back up |
| **Deploy-notice test** | `node tests/sw-update.test.mjs` — 12 assertions, needs Chrome, **no other dependencies**. Copies the app to a temp dir, serves it, installs the worker, then EDITS A FILE and asserts the page offers a refresh. The one test that cannot be faked |
| **QR tests** | `node tests/qr.test.mjs` — 33 assertions. Needs `npm i --no-save jsqr` for the strongest layer: the encoder's output is rendered to pixels and **decoded by an independent implementation**, which validates format-info, masking, placement, interleaving and ECC in one assertion. Also carries ZXing's published Reed-Solomon vectors. ⚠️ **It does NOT assert which mask a payload gets** — ZXing, Nayuki and the ISO text disagree on penalty-rule-3 details, so a correct implementation can legitimately pick a different one |
| **Rules tests** | `npm i --no-save @firebase/rules-unit-testing`, then **`JAVA_HOME` must point at Temurin 21** (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`), then `firebase emulators:exec --only firestore --project demo-test "node tests/rules.test.mjs"` — 159 assertions, who may READ your data — and since 2026-08-27 who may OFFER you a workout and who may announce a disconnection, and since 2026-08-29 who may ASK to connect. 🚨 **One assertion in here is deliberately an `allow` that records a cost rather than a guarantee** — "any signed-in account can list the whole directory" — because a suite that pinned only the good news would describe a feature this app does not have. **It is the line that flips to a denial when the handle version lands.** ⚠️ **On the Oracle JDK the emulator dies silently** — see §0.9 |
| **Rebuild the picture manifest** | `node tools/build-exercise-images.mjs` — after dropping files into `img/exercises/` named `<exerciseId>.<ext>`. Rewrites the manifest in `js/exercise-images.js` AND the precache block in `sw.js`. ⚠️ It REFUSES a badly-named file rather than skipping it: a picture that never appears looks exactly like one that was never bought. `img/exercises/README.md` has the naming and the licensing |
| **Rebuild the body art** | `python tools/build-body-art.py` — only if the source JPG or the seeds change. Needs `pip install pillow numpy scipy potracer` |
| **Look at it** | headless Chrome — §0.6. Use CDP + `Emulation.setDeviceMetricsOverride` for anything involving input |
| **Firebase** | project `fitness-tracker-th` · [console](https://console.firebase.google.com/project/fitness-tracker-th/overview) · `firebase deploy --only firestore:rules` |
| **Deploy** | commit + push to `main`; Pages rebuilds in ~40–50s |

It needs a server — ES modules do not load over `file://`.

