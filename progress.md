# Fitness Tracker — Progress & Context

> **Fresh session: read this entire file before doing anything.** It is written to be the only thing
> you need. `docs/` holds the detail; `chat.md` is a human-readable log you only need in order to
> answer "what did we say about X".

**Last updated:** 2026-08-24 — **the app was used in a real gym session for the first time**, and it
found a live inversion. That pass is the top dated section; the nine below it are 2026-08-22, newest
first. Read the top three; the rest is why.

✅ **BOTH 2026-08-22 BLOCKERS CLOSED, 2026-08-24.** Tim: *"I'm not locked out, I think I just had the
wrong URL. I can see the year view now."* So **he is on a current build and the app is usable**, and
the old items 1 and 2 of this list are struck below rather than deleted, because what they warned
about is why the next report should still be checked against the live site first.

- ~~**Tim may still be locked out**~~ — he is not. He reports the cause as **the wrong URL**, not the
  app failing. ⚠️ **That neither confirms nor needs the "stuck on the auth handler" theory** the
  ninth pass wrote up. The fix that shipped stands on its own argument — `getRedirectResult()` was
  being called on every boot in a configuration where a redirect can never have been started — and
  **nobody has established what URL he actually had.** If Firebase's page ever fills his screen
  again, that is a new report, not a recurrence of a diagnosed one.
- ~~**He has never confirmed seeing any work from 2026-08-22**~~ — **he has now: the years view.**
  ⚠️ **What is NOT known is what got him there** — the resume update check from the sixth pass, or
  simply opening the right URL. So the sixth pass's fix is still **unconfirmed in the field**, and
  the standing rule survives its own trigger: **do not read "I can't see X" as X being broken** —
  check the live site first, which is what settled it in one command last time.

⚠️ **THREE THINGS A FRESH SESSION MUST KNOW BEFORE DOING ANYTHING:**

1. **THE PHONE IS THE LIVE THREAD, and design is now Tim's half of it.** He said on 2026-08-22:
   *"I'll work more on this design and areas that need improvement (especially home)."* So **do not
   redesign Home unasked** — but the UX review's finding about it is the sharpest open thing in the
   product and is item 1 in Open work.
2. `docs/improvement-plan.md` §0 records seven reviews briefed on 2026-08-19 that never ran. **SIX
   HAVE NOW RUN and every one found something real** — adversarial code review, cross-screen
   consistency, the first accessibility audit this project ever had, and, all on 2026-08-22, **edge
   cases / data integrity, the live social round trip, and human behaviour / UX.** Only the
   **competitive** review is left, and it inspects the market rather than the app.
   ⚠️ **Running a review is not closing it.** Eight fixes shipped that day; **two edge-case findings
   and the whole UX list are still open** (Open work 0b and 1).
3. **⚠️ IT HAS NOW BEEN TRAINED WITH, AND THAT IS A DIFFERENT KIND OF EVIDENCE FROM LOOKING AT IT.**
   Tim ran a real session with a friend on 2026-08-24 — *"for the most part it worked great"* — and
   the single defect it turned up was one **no test, no review and no screenshot had found in five
   months**: the assist machine's suggestion ran backwards. Six reviews and 2300 assertions had all
   passed over it. **Prefer a gym report to anything in this file.** The four asks it produced are
   the newest dated section; two shipped, two are Open work 0d and 0e.
   Before that, a real device had opened the app exactly twice, settling three things — the keyboard
   fix works, Google sign-in works in the installed PWA, and the app can get stuck on the auth
   handler. Everything else about touch is still a desktop engine driven at phone metrics, and
   **three "needs hardware" survey items remain reasoned rather than measured.** ⚠️ **Do not let a
   good device report promote the rest**: what a phone confirmed is in Verified and nothing beyond it.

**Status:** Live and working. **Tier 1 is complete.** Firebase is provisioned and verified end to
end. **Five nav tabs: Home, Workouts, RECORD, Data, Goals** — Record is the big middle button, and
Social and Calendar were folded into Home and Data on 2026-08-22.

The app works with **no network** (D6), records weights in **lbs or kg**, has a rest timer, lets a
workout be logged for another day, lets a past record be edited from the calendar, and can mark a
whole workout as a benchmark.

**Home opens on the next workout in your rotation**, not a generic "Start a workout" — it reads your
last session and offers the one after it in that programme, saying what it read.

**Sets have TYPES**: supersets, tri-sets and giant sets (walked round by round, with the rest timer
holding off until the end of a round), plus drop sets and myo-reps (mini-sets nested inside one set,
which stays one hard set). D23.

**Workouts live inside SYSTEMS**, and there is an **Explore** screen of **nine** ready-made systems.
Six are credited to real people. **Every system carries a BADGE of four numbers** — growth and
strength (banded to 5), plus **days a week and minutes a session** — on Explore, on the Workouts list
and on a system's own screen, including systems the user built themselves. The scores say how good a
programme is; the other two say what it costs, and a score without that is half a sentence.

**Social is built**: mutual friends by invite link, per-person visibility (everything / my workouts /
just that I trained / nothing), and a friend's page showing their body map and recent workouts.
⚠️ **Two accounts have never actually connected** — see NOT verified.

**The body map** is Tim's own illustration, split into a recolourable fill layer and an ink layer. It
rates every muscle from **every exercise that trains it**, each rating carrying a **confidence** that
desaturates the colour, and the **comparison group is the user's choice**. ⚠️ **Since 2026-08-19 a
rating is led by the most CREDIBLE evidence rather than the biggest number** — that inversion was the
worst defect this model has had, and §9 is the write-up.

**Neither chart mode is a dead end**: where there is not enough history to draw a line, they list
where every lift stands right now.

**GOALS is built** (2026-08-19). A goal is one muscle moving up a **strength level** over twelve
weeks — never a predicted number of pounds, because a 12-week gain cannot be predicted for an
individual. The screen states what the goal costs (sets, sessions, minutes, protein, effort, sleep),
what your logged training is *actually* delivering against it, **why progress stalls** with the two
measurable causes kept apart from the four invisible ones, and which programmes give that muscle the
volume the goal needs. ⚠️ **It gives no on-track verdict, and says so on screen** — that is gated on
the estimator.

**There is a DEMO ACCOUNT** (2026-08-19). Account → *View demo account* fills the app with a
generated year of training — two programmes, ~200 sessions, benchmarks, weekly weigh-ins and a goal
part-way through — so every screen can be judged without logging any of it. ⚠️ **It never touches
storage**: the store swaps to an in-memory backend, so nothing in there can reach localStorage or
Firestore. Edit anything; a reload starts it over; leaving restores the real account untouched. A
strip on every screen says so. **Social is hard-disabled in it** — `republish()` refuses — because
publishing invented workouts to real friends is the one way this could do harm.

---

## 2026-08-24, later — ⚠️ THE DUMBBELL ROW WAS FLATTERING EVERYONE BY 15 %

Tim: *"deploy everything you just mentioned and are ready to work on."* Three shipped in this pass.

### ⚠️ 1. The other half of the lat question, and it ran the OTHER way

The fatigue work established that Tim's lat pulldown was dragging his Back rating down. It left the
competing explanation untested: **is the dumbbell row's conversion generous?** It is.

`RATIOS.Back` had `Dumbbell Row` at **0.85**, a reasoned estimate. Derived properly, by the technique
the dip and pull-up entries in the same file already use — one population, both lifts, a 180 lb male,
divide — Strength Level publish the dumbbell row **per dumbbell**, which this app doubles:

```
                DB row x2   barbell row   ratio
  beginner          88          108        0.81
  novice           134          149        0.90
  intermediate     194          198        0.98
  advanced         264          255        1.04
  elite            342          315        1.09      median 0.98
```

⚠️ **A SMALLER RATIO MAKES THE ESTIMATE BIGGER**, because the estimate divides by it. At 0.85 instead
of 0.98 every dumbbell row in the app read about **15 % stronger than it should**. The barbell row
denominators are the same five numbers the pull-up derivation already uses, so the two are not
spliced from different populations.

**Tim's three back readings go from 229 / 115 / 136 to 199 / 115 / 136** — his rating stays 141 lb
and his **confidence rises 0.36 → 0.41**, because better-calibrated inputs agree better. That is the
shape of a correct fix: the same answer, more trust in it.

⚠️ **ONE ENTRY MOVED, AND ONLY ONE, DELIBERATELY.** `Dumbbell Bench Press` is wrong the same way and
was measured against the same source — **0.72 against a published 0.81** — and is NOT fixed, because
correcting it alone would leave `Incline Dumbbell Bench Press` (0.62) and `Decline` (0.76) relatively
more generous than the flat version, which is a new inconsistency. **The whole dumbbell family needs
re-deriving in one pass; that is now Open work 0h.** Raising the row alone was safe because it
preserves its own family's ordering — a chest-supported row still sits below it, as it must.

### ⚠️ 2. Restore from backup could take the app down, and asked nobody first

The edge-case review's finding (0b(d)), fixed. `importAll()` validated almost nothing:
`{sessions:[{id:'s1'}]}` stored fine and then `getSessions()` threw on `b.date.localeCompare`,
**taking out Home, Workouts, Calendar, Data, Muscles and Goals** through the router's catch. Settings
still rendered, so it was recoverable by deleting everything.

Three changes. **`inspectBackup()` checks every row before any row is written** — so a good
`workouts` followed by a bad `sessions` no longer half-restores. **It is a gatekeeper, not a schema:**
only the fields whose absence actually crashes a screen are required, because refusing somebody's own
data over a missing optional field is the worse failure.

**`{foo:1}` is now refused rather than toasting "Backup restored" having restored nothing** — a
restore that silently does nothing is worse than one that fails, because the user walks away
believing their training is back.

⚠️ **AND IT REPLACES EVERY COLLECTION, INCLUDING ONES THE FILE DOES NOT CARRY.** A backup is a
snapshot of a whole account, so "restore" means "put me back in that state". The old merge left
untouched collections behind, and that produced the fault this codebase already knows by name — *a
foreign key is only valid while the rest of that set still exists*: restoring a pre-systems backup
kept the CURRENT systems, so a restored workout could point at a system that was never in the file,
returned by `getWorkouts()`, rendered by no screen, and never adopted by `ensureSystems()` because
that only looks for workouts with **no** systemId rather than a dead one. Invisible forever.
Replacing wholesale cannot produce it: the pre-systems backup clears systems too, its workouts have
no systemId, and the migration adopts them on the next read.

**And it has a confirmation now**, which "Delete all data" two lines below it has had all along. The
sheet names what is in the file — *"It holds 4 workout records, 2 workouts…"* — because a
confirmation that cannot say what it is about to do is a speed bump, not a safeguard.

### ⚠️ 3. `docs/firebase-setup.md` had the ceiling wrong by 3×

It claimed ~300 bytes a session and about 3,000 workouts. Measured on 2026-08-22: **1,100 bytes a
session, and 3,000 sessions is 3.1× over the 1 MiB cap.** The real ceiling is **~950 sessions, about
four and a half years at four a week.** Corrected.

⚠️ **The "fails silently" half of that finding is already half-closed and the doc now says so
precisely.** A rejected cloud write surfaces on screen — `finish()` has wrapped `saveSession()` in a
try/catch since 2026-08-22 and the message stays above the button that failed, whichever backend
threw it. **What is still true is that nothing warns as the limit approaches.** The split to a
document per session is a migration over live training data and stays its own job.

---

## 2026-08-24 — ⚠️ THE APP WAS USED IN A GYM, AND IT FOUND A LIVE INVERSION

**The first time this app has been used for what it is for.** Tim trained with a friend, logged the
session on his phone, and came back with four improvements. *"For the most part it worked great."*

⚠️ **ONE OF THE FOUR WAS A BUG, AND ONLY USING IT COULD HAVE FOUND IT.** He did assisted pull-ups.
Two more good sessions and the app would have told him **"+5 lb and back to 6 reps"** on an assist
machine — proposing *more help*, making the set easier, and printing it as progress under an
upward-pointing arrow.

### How a guard that was written for exactly this failed to fire

`progression.js` has had this since the body-weight work landed:

```js
  const assisted = Boolean(res && res.assist);   // then: never propose a load step
```

and beside it a comment reading *"Nothing in the table is flagged `assist` today; this is here so
that the day one is, the suggestion degrades to a rep rather than silently inverting."* Both
sentences were true. `tests/goals.test.mjs` asserted both — that no exercise was flagged, and that
the guard was present — and both assertions were green.

⚠️ **`Assisted Pull-Up` was in the exercise library the whole time.** It had no entry in the
body-weight fraction table, so `totalResistance()` returned null, so `res.assist` could never be
read, so the flag could never be true — and the machine fell through to the **ordinary weighted
load rule**, where more weight is a harder set. Three layers each behaved correctly in isolation.

⚠️ **THE LESSON IS ABOUT THE GUARD, NOT THE MACHINE.** *A branch that no input the app accepts can
reach is not defensive code — it is a comment that reads like defensive code, and it stops people
looking.* It stopped two: whoever wrote it, and whoever wrote the test that pinned it. **If a
guard's own note says "nothing hits this today", that is the moment to check whether something
should.** The two source-regex assertions are gone; what replaces them drives the real function with
the real exercise and **plays it forward through forty obeyed sessions**, which is the rep-ceiling
lesson from 2026-08-22 arriving on the branch that did not exist when it was learned.
**Mutation-checked**: restoring the `+` flips exactly six assertions, including the play-forward.

### The design call, and the assumption it rests on

Tim's instruction: *"the assisted pull up should be treated the same as a regular pull up, but the
weight should be auto adjusted … body weight − assisted weight."* His arithmetic is right — 180 lb
at 70 lb of assistance is 110 lb — and `totalResistance()` had computed exactly that, for a branch
nothing could reach.

⚠️ **The objection that kept it out is still true and is now PRICED rather than waved away.** A
machine's stack says 70; nothing published says 70 lb comes off *you*, and the counterweight linkage
is not standardised across brands. It went in at **`q` 0.65 — the lowest number in the fraction
table, below the push-up's 0.70** — so an assisted set desaturates its own colour on the body map and
loses to a real pull-up wherever they meet. The reason it sits below the push-up is worth keeping: a
push-up's uncertainty is a *judgement between three published force-plate figures*, and this one has
**nothing published on either side of it**.

⚠️ **And the error is not constant — it scales with the help taken.** At 10 lb of assist a wrong
linkage is a rounding error; at 120 lb off a 180 lb lifter it moves two thirds of the load. A single
`q` cannot say that, because `contributionsFor()` is per exercise and per body weight and never sees
the set. **Recorded as a known limitation: the number is most trustworthy where it matters least.**

**What the admission actually took was two lines** — a table entry, and `bodyWeightFractionFor()`
reading `spec.assist` instead of hardcoding `false`. Everything else keys off that one flag, which is
why the muscle map, the charts, `setLoad()` and the progression rule all started working together.
**Adding an Assisted Dip is now a one-line job.** ⚠️ **The name regexes are kept** as the fallback for
an assisted exercise added *without* a fraction — that is what stops the next one being read as load.

**What progression does now:** the step is subtraction, clamped at zero — 3 lb of help minus a 5 lb
step is not a −2 lb setting, it is an unassisted pull-up — and at zero help twice at the top it
**refuses and names another exercise** (*"these are pull-ups; log them as Pull-Up, then a belt"*),
which is the same shape as the rep ceiling and the lay-off branch. Every sentence was swept too:
*"at 70 lbs"* is a lie on this machine, so it reads *"with 70 lbs of help"*.

### Set 2 fills itself the first time — and the first version of it invented training

Tim: *"once the user puts in their measurements for the first rep, put those same measurements in for
the next set."* An exercise **with** history already does this; the column of zeros only ever appears
on a lift never logged before, which is exactly where somebody is least sure what to type.

⚠️ **THE FIRST VERSION FILLED EVERY SET BELOW ON THE FIRST KEYSTROKE, AND TWO RENDER TESTS KILLED
IT.** `finish()` keeps any set with numbers in it — so logging one set and stopping would have
recorded three, inflating that lifter's volume, weekly sets and muscle map with **work they did not
do**. The convenience is worthless if it invents training. It now fills a set **when that set is
opened**, which is the same thing from the user's side and cannot credit anybody for a set they
never looked at. **Mutation-checked**: removing it flips exactly the two assertions written for it.

### Two more bugs, and both were found by looking at a screenshot

Neither was reachable by a test, which is now the third time on this project:

1. **The readout did arithmetic on nothing.** Every set opens at zero assistance, so the first thing
   anybody would have read was *"180 lbs on you — your 180 less 0 of help"*, in the one place the app
   is trying to make an unintuitive number clear. At zero the machine is not helping, so it says
   *"180 lbs on you — no help set, so this is a pull-up"*.
2. **The stepper label read "Weight of help".** The suffix slot sits directly after the field name and
   exists to say what KIND of weight the number is — *"total"*, *"per side"* — so a prepositional
   phrase does not fit it. It reads **"Weight · assistance"** now.

**Measured at 360 / 375 / 393 px**, with a body weight on record: the readout is **one line at every
width, no horizontal overflow**, and on a repeat session the suggestion reads *"less help — 65 lbs
and back to 8 reps"* over *"5 lbs comes off the stack — that takes you from 110 lbs to 115 lbs of your
own weight, a 4.5 % step inside the recommended 2–10 %."*

### ⚠️ A fifth thing came out of the same session — WITHIN-SESSION FATIGUE, now shipped

He also suspected the app was rating his back off the lat pulldown he did **third**, when he was too
worn out to load it. **He is right that something is wrong.** Measured: the fatigued third exercise
drops his Back rating **32 %** and *raises* his confidence.

⚠️ **The mechanism is the opposite of the obvious one. Fatigue does not just depress a reading — it
PROMOTES it**, because `evidenceWeight` rewards low reps and a spent lifter does few reps. His
pulldown out-ranked his best lift **by 0.005, purely on a rep count fatigue caused**. And no
re-weighting scheme is worth more than 5 lb, while doing the lift *fresh* is worth 60 — because a
fatigued set is **missing** information, not corrupted information.

**Tiers 1 and 2 shipped the same day** on Tim's *"deploy it now"*: every observation now carries the
prior work on that muscle from earlier in the session, a graded `fatigueFactor` discounts it, and the
panel says *"done after about 3 sets of back work that session — doing it earlier once would give it
a cleaner reading."* His session now reads **141 lb led by the dumbbell row, confidence 0.36**, and
the demo year moves **under 3.5 % on every muscle** with confidence falling only on the four trained
after compounds. ⚠️ **Read `docs/fatigue-plan.md` §1 before touching `rateMuscle()`, and note that
one rule in that plan was WRONG and its own test caught it** — "confidence must never rise on a
fatigued reading" is too strong, because a reading that lands between two disagreeing ones really
does tighten the picture. **The load multiplier is Tier 3 and should not be built at all.**

### ⚠️ Found while driving the browser: `#/muscles` IS NOT A ROUTE, and the a11y audit thinks it is

Verifying the fatigue work on a phone-sized viewport meant opening the muscle panel, and
`location.hash = '#/muscles'` **rendered Home**. There is no `muscles` case in `app.js`'s `resolve()`
— the map is a MODE on `#/graphs`, reached by the Data tab's Calendar · Graph · Bars · Muscles
switch — so the router falls through to its `default: return HomeView()`.

⚠️ **`tools/a11y-audit.mjs` lists `['#/muscles', 'Muscles']` in its ROUTES.** That means the audit
has been **measuring Home twice and reporting it as the muscle map**, and the body map's panel —
contrast on seven level colours, the tap targets on the figure — **has never actually been audited.**
Not fixed, not chased; recorded because a coverage claim that is false is worse than a gap that is
known. It is one line in the audit tool and one route in the router, and somebody should decide which
of the two is the bug.

### ⚠️ Two of his four asks are NOT built — see Open work 0d and 0e

**Swapping an exercise mid-workout** and **joint workouts** are both open, both have Tim's design
decision recorded, and the second is the bigger idea in the list. His friend's sign-in also failed
and **that is an unread bug report** — he asked to leave it for now.

---

## 2026-08-22, ninth pass — ⚠️ "missing initial state" ON THE IPHONE

**Tim, opening the app:** *"Unable to process request due to missing initial state. This may happen
if browser sessionStorage is inaccessible or accidentally cleared … 2) Using signInWithRedirect in a
storage-partitioned browser environment."*

That is Firebase's `auth/missing-initial-state`. ⚠️ **The wording is the SDK's own, and this app never
contains that string** — `requireRemote()` says "Not connected to your account right now" and the
router's error box prints `err.message`, so a raw SDK sentence reaching a user means either the SDK
threw into a view or **he is looking at Firebase's own auth-handler page rather than at this app.**

### What was wrong on our side, and it is now fixed

`init()` called **`getRedirectResult()` on every single boot** — and calling it is precisely what asks
for the "initial state" the error is about. On iOS Safari the sessionStorage that the redirect flow
keeps its state in is partitioned away from this origin, so the question cannot be answered.

⚠️ **And in this configuration the question should never have been asked at all.**
`redirectCanComplete()` is false here — the app is served from `timothyhadfield.github.io` and the
authDomain is `fitness-tracker-th.firebaseapp.com` — so **a redirect could never legitimately have
been started**, and there was never any result to collect. The boot path was asking a question its
own sign-in path already knew was meaningless.

It is now guarded on that same predicate. ⚠️ **The same predicate, not a browser check**: the day
this app moves to a domain where redirect works, both halves start working together, and a guard
that has to be remembered separately is a guard that gets forgotten. **Mutation-checked** —
removing it flips exactly the new assertion.

⚠️ **Asserted on the SOURCE, and the reason is worth recording.** `init()` cannot be unit-tested
without the live SDK, a network and a browser, so the test reads `firebase-backend.js` and requires
the guard to sit immediately above the call. Same shape as the `sw.js` precache check: a structural
assertion is worth more than none, and what must not quietly come back is the *unguarded* call.

### ⚠️ What this does NOT explain, and must not be claimed to

**A guard added today cannot fix a build already on his phone**, and the most likely reason he is
seeing Firebase's page at all is that his installed app is sitting on the auth handler URL from a
redirect an OLDER build started — the build where `prefersRedirect()` still returned true for an
installed iOS app. `start_url` is `./index.html#/home`, so a **cold** launch goes to the app; a
*resumed* one returns to whatever page was last open, which is the same mechanism as the stale-app
problem in the sixth pass.

**Told him plainly:** fully close the app and reopen (a cold start ignores the stuck page), and if
that fails, remove the home-screen icon and re-add it, which resets the app to `start_url`. ⚠️ **His
training is in his account, not in the icon** — he signs in with email, so the data is in Firestore
and re-adding cannot lose it. That would NOT be true of an anonymous account (D12), which is why the
answer says which case it depends on rather than "don't worry".

### ✅ Resolved 2026-08-24 — and the diagnosis above was never tested

Tim: *"I'm not locked out, I think I just had the wrong URL."* ⚠️ **So the stuck-auth-handler story
in this section is an unfalsified hypothesis, not a finding** — plausible, consistent with the
symptom, and never once checked against the URL his phone actually had. It is left standing because
it is the best available account of a real screenshot, but **it must not be cited as something this
project has established.** The code change stands separately: asking for redirect state that cannot
exist here was wrong on its own terms, before any of this.

---

## 2026-08-22, eighth pass — SIX TABS BECAME FIVE, and the middle one is Record

**Tim's design call**, and the app's own rules had been arguing for the central part of it since the
beginning: *"I want to narrow down the number of base bars at the bottom of the iphone screen to 5,
and have the middle one be slightly bigger than the others."*

```
   Home        Workouts        ( + )        Data        Goals
   + Friends                  RECORD      + Calendar
```

⚠️ **THE BIG MIDDLE BUTTON IS THE ONE PART THAT IS NOT A MATTER OF TASTE.** D4 says the logging loop
is the single thing this app beats a spreadsheet at — so recording training should be the largest,
most central, hardest-to-miss target on every screen. It was two ordinary buttons partway down Home.
Tim asked for a design improvement and it lands exactly on the app's stated priority.

**Record** is the old start picker with the benchmark action folded in and pinned at the bottom: the
workout list grouped by programme, *Record a benchmark* underneath. ⚠️ **`#/start` and `#/benchmark`
both still resolve** — "Choose another workout" has linked to one of them for months and a
bookmarked hash must not start 404ing because a tab bar was redesigned.

**Social → Home.** Both answer "what is going on", one for you and one for the people you train
with, and they are the two screens you open to *look* rather than to *do*. They share a **You /
Friends** switch. ⚠️ **The switch is two real LINKS across two routes**, not a state machine inside
one screen, so the back button, a bookmark and a shared invite link all keep working and neither
screen had to be nested in the other. ⚠️ **And the screen is now titled "Friends"** — `social.js` is
the code's word for the feature; a person has friends. Five user-facing strings were swept with it,
because *"Social is off in the demo"* under a tab labelled Friends is the "system" vs "programme"
fault the UX review found, and it is cheaper not to introduce it than to unpick it later.

**Calendar → Data.** Both are the past, one drawn as squares and one as lines; the calendar was
already the odd tab out, because every other tab answers a question and it displayed a record. The
Data switch is now **Calendar · Graph · Bars · Muscles**, and it is the calendar's header too, so the
two screens read as one tab. ⚠️ **"Bar Chart" lost a word on purpose**: the 2026-08-21 survey
measured the THREE-segment version clipping that exact label to "Bar Char" at 393px, and a fourth
segment takes another quarter of the row.

⚠️ **The four segments are not the same kind of thing, and the control hides that deliberately.**
Calendar is its own ROUTE, so a day stays deep-linkable and the years grid keeps its own state; the
three chart modes are in-page state on `#/graphs`. Making all four navigate would have invented four
URLs for a chart toggle; making all four in-page would have meant nesting a whole screen inside
another.

### Three defects, all found by looking at it rather than by a test

1. **The Record label was clipped by its own circle.** A 26px icon with 6px padding, a gap and a
   label came to 53px inside a 54px bar. Caught in a screenshot, then pinned by measuring the
   label's bottom against the bar's.
2. **⚠️ THE LABELS DID NOT SHARE A BASELINE, and that is what made the bigger tab look like a
   mistake rather than emphasis.** Every tab centred *its own* stack, which is identical while all
   five icons are the same size and falls apart the moment one is bigger — the taller middle tab
   centred lower and sat its word ~7px below the other four. They are bottom-aligned now, so the
   words line up and the icon grows upward. Measured at 360, 375 and 393: **all five label tops
   identical at every width.**
3. **⚠️ AN `<a>` IS NOT A `<button>`, and `.seg` was written for buttons.** The You / Friends switch
   first rendered as two underlined links floating in an oversized box, because an anchor is inline
   — `min-height` does nothing to it and the UA underlines it. Fixed on the class with a matched
   `line-height` rather than flex or grid, both of which would have centred the label and quietly
   killed the `text-overflow` backstop that exists *because this control has already clipped a label
   once*. ⚠️ **The same fault was live on `.btn`** and nobody had noticed: "Leave the demo" is an
   anchor and was underlined. Fixed on the class, so it covers the next one too. This is the third
   time this project has met anchor-styled-as-button — the social review found it in the friend rows.

**Measured at 360 / 375 / 393 px:** five tabs, no label clipped, no horizontal overflow, tab boxes
72–79 px wide by 54 tall (comfortably past the 44 px target), middle icon **30 px against 21**. Every
merged tab stays lit on the routes it now owns — `#/social` lights Home, `#/calendar` lights Data —
which is what stops a merge feeling like a dead end.

---

## 2026-08-22, seventh pass — the nav bar was slow because the app kept re-asking

**Tim:** *"sometimes when interacting with the website, it's pretty laggy, especially when I click on
the different bars at the bottom … even when I have good wifi and cell service. Is this just because
Firebase is free and not great, or something with my phone?"*

**Neither.** Measured before changing anything, in a real browser at 393×852 with **4× CPU
throttling** — building a screen is not the cost:

```
  tab         paint     backend reads
  Home          16 ms   0
  Workouts      15 ms   5   systems, workouts, customExercises, sessions
  Calendar      36 ms   2   sessions, benchmarks
  Data          42 ms   4   systems, workouts, sessions
  Goals         10 ms   7   settings, bodyWeight, benchmarks, sessions, customExercises, goals
  Social        15 ms   0
```

⚠️ **Every tab asked the backend for whole collections it had already been given**, and `sessions`
was re-fetched by four of the six. On Firestore each of those is a `getDoc` — **and a `getDoc` waits
for the SERVER even with offline persistence enabled.** Persistence is a fallback for being offline,
not a fast path. So a tab tap cost one network round trip per collection, some of them serialised:
roughly **400 ms on good wifi and over a second on cellular**, for data already sitting in the page.
**It was never Firebase being slow and never the phone. The app was asking the same questions again.**

### The fix: a read cache, and the line it may not cross

`store.js` now keeps each collection in memory. **After the change every tab does ZERO blocking
reads** — re-measured the same way, 10–42 ms and nothing on the wire.

⚠️ **THE CACHE SERVES READ-ONLY GETTERS AND NOTHING ELSE, and that is the whole safety argument.**
This store does read-modify-write everywhere: read a collection, change one row, write the whole
list back. Serving *those* reads from a cache means writing a stale list back over storage —
**anything changed on another device would be erased.** Mutations therefore still call
`backend.read` directly and are exactly as safe as before. `saveSettings` was the one exception,
reading through a getter before writing; it now reads fresh, and there is an assertion for it that
**flips the moment the hazard is reintroduced** (mutation-checked).

Three more things it does, each for a stated reason. **A write updates the cache after it succeeds**
— caching what we hoped to store would be a lie the rest of the session reads back as fact.
**Every getter hands out a copy of the list**, because callers sort and filter these rows and an
in-place sort would reorder what everybody else is about to be given. And **the cache is dropped on
every identity change**, wired into `onChange` rather than at each call site — the argument
`associateLabels()` already makes, that fixing today's transitions and not tomorrow's is how this
kind of bug survives its own fix.

⚠️ **Staleness is bounded and silent.** A cached read kicks off a background refresh at most every
30 seconds; nothing re-renders under a thumb, so the *next* navigation is correct rather than the
current screen rearranging itself. That is the same call `sw.js` makes about a new deploy, for the
same reason. A failed refresh is the absence of news, not an error (D6).

### Two things found on the way

- **⚠️ `ensureSystems()` re-read two collections on EVERY call, forever** — and it is called by both
  `getSystems()` and `getWorkouts()`, so the Workouts tab paid two network round trips to re-answer
  a migration question settled months ago. The check now reads through the cache; **the fix-up path
  still reads fresh**, because that half is a read-modify-write.
  ⚠️ **A latch was the first attempt and the tests rejected it inside a minute.** "No orphans, so
  never look again" is true of a running app and false of anything that can put old-shape rows back
  underneath it — a restored backup, a different account, a test seeding storage directly. The cache
  is the honest version of the same saving: it makes the check cheap without ever claiming the answer
  cannot change.
- **The cache has exactly one contract — the store is the only writer** — and three tests break it
  deliberately, writing straight to localStorage to imitate what an older build left behind. They now
  say so and clear the cache. A real app never needs that: rows predating the store are read on a
  cold start with the cache empty, and a second tab is the one case that can go briefly stale.

**Also warmed at boot.** After the first screen is painted, all eight collections are fetched in one
parallel batch, so the whole app costs **one round trip of latency instead of one per collection per
tab**. Never awaited, and silent on failure — the screen already works without it.

**Six new assertions**, plus a real-browser smoke test that walks every tab twice and fails on any
console error.

---

## 2026-08-22, sixth pass — ⚠️ THE INSTALLED APP NEVER ASKED WHETHER IT WAS OUT OF DATE

**Tim, hours after the years view shipped:** *"I can't see where the setting is within the calendar
section that displays every single day like how we talked about."*

**Nothing was wrong with the feature.** The live site was serving it — checked directly:
`js/year-grid.js` answers 200 with the right MIME type, `views-data.js` carries the switch, and a
clean browser profile pointed at the live URL shows **Months / Years** on the first load. His phone
was running an older copy of the app and had never been told there was a newer one.

⚠️ **THE UPDATE MACHINERY WAS FINE AND WAS NEVER CONSULTED.** Everything in the 2026-08-18 deploy
notice hangs off the service worker's `fetch` handler: it spots a change while *serving a request*,
which means on a real page load. **An installed home-screen app is resumed, not reloaded.** iOS
hands back the document that was already open, nothing is fetched, and the worker has no reason to
look. The app can sit weeks behind the live site while every part of the mechanism works exactly as
designed.

⚠️ **This is the second time a claim about "the app updates itself" has turned out to have a hole in
the case nobody drove**, and both were found by Tim reporting shipped work as missing. The first was
the stale load after a deploy (2026-08-18). This is the resumed app. **The pattern worth keeping: a
self-healing mechanism needs to be asked when it heals, not only whether it can.**

The page now posts `check-assets` on `visibilitychange` and on `online`; the worker revalidates the
shell against ETag/Last-Modified, throttled to five minutes, silent when offline (D6 — a failed
check on a gym's dead wifi is the absence of news, not an error), and reuses `isDifferent` and
`announceUpdate` rather than growing a second opinion about what "changed" means. It still only
OFFERS.

**Tested with no navigation at all**, which is the whole point — `tests/sw-update.test.mjs` deploys a
change to a page that is just sitting there, fires what a resume fires, and asserts the offer
appears. **Mutation-checked**: removing the listener flips exactly those two assertions.
⚠️ **The test needed a fresh worker generation to run at all**, because `announceUpdate` speaks once
per worker lifetime by design — a deploy changes a dozen files and the user needs one sentence.

⚠️ **NONE OF THIS REACHES THE COPY ALREADY ON TIM'S PHONE.** That build has no listener to fire. He
has to pick up the new version once, by hand, the way he always had to — after that this is the last
time it should ever be necessary.

**2026-08-24 — he has picked it up.** The years view is on his screen. ⚠️ **That does not verify this
fix.** He also reports having had the wrong URL, so opening the right one is a complete explanation
on its own, and nobody watched a resume produce the offer on a device. **This mechanism has been seen
working only in `tests/sw-update.test.mjs`** — the next deploy he notices without being told is the
first real evidence, and it is worth asking for once.

---

## 2026-08-22, fifth pass — the UX review, and four fixes off the back of two reviews

**All seven reviews have now been run or accounted for.** The human-behaviour / UX one ran last and
found the sharpest single thing on this list. Four fixes shipped: two from the edge-case review's
serious findings, one from UX, and one leak that made a safety claim false.

### ⚠️ 1. FIXED — progression ratcheted reps forever, on the two branches nobody played forward

`noIncrement` and `repsOnly` both returned `repsAtTop + 1` with nothing to stop them. Played forward
through the runner's own save path: **a 20 lb lateral raise, obeyed, reaches 20 × 37**; a 60 lb curl
reaches 60 × 34; push-ups reach 45. Past 20 there is no `REP_BAND` left, so it printed a range it was
already outside of — *"another rep, 37"* over *"range 15–20"* — and past `MAX_EVIDENCE_REPS` **D5
refuses the set as evidence, so the app's own advice walked the exercise out of its own muscle map.**

There is now a **rep ceiling at the top of the top band**, and reaching it is a **refusal rather than
a smaller step**: last time's numbers, the reason, and the ways on (microplates, an extra set, a
harder variation — or, for a bodyweight lift the app cannot load, *log a weigh-in and this gets the
full rule*). Same shape as the lay-off branch and as `noIncrement` itself. ⚠️ **The ceiling stops the
rep ladder, not progression** — a lift with an honest increment available still takes the weight at
20 reps, and there is an assertion for exactly that, because replacing a runaway with a dead end
would be the worse bug.

⚠️ **THE LESSON IS THE TEST, NOT THE BUG.** The 2026-08-20 fix came with a play-forward test — and it
walks the **bench**, which is the branch that had already broken. *A rule that reads its own output
needs a test that plays it forward on **every** branch.* The two branches with no terminal state had
never been walked once. Both are now, to forty sessions.

⚠️ **One thing the first version of this fix got wrong**, caught by its own test: it told a lifter
holding two 20 lb dumbbells to *log a weigh-in and get a belt*. The "could be loaded if we knew your
body weight" case is a **pull-up**, and the term that distinguishes them is that the entered weight
is zero. Advice that is true of another exercise is still wrong advice.

### ⚠️ 2. FIXED — a failed save at the end of a workout was completely silent

`finish()` awaited `store.saveSession()` unguarded, and this app has no `unhandledrejection` handler
anywhere. So a full localStorage meant the promise rejected, `clearDraft()` and `showFinished()`
never ran, and **the user tapped Finish, at the end of a workout, and nothing happened at all.** The
backend was already throwing the right words — *"Could not save. Your browser storage may be full."*
— and nobody was listening for them.

It now says so **on the screen, above the button that failed, and it stays there** — the same
argument as the sign-in screen: 2.4 seconds of toast on a phone is indistinguishable from nothing
happening, which is exactly how that one got reported. ⚠️ **The draft is deliberately NOT cleared on
failure**: it is the only remaining copy of the session, so clearing it before the save has landed
would turn a recoverable error into lost training. Tapping Finish again works. ⚠️ **And the
`scrollIntoView` inside the handler is guarded** — an exception thrown inside the handler for a
failed save puts the user straight back to a Finish button that does nothing.

### ⚠️ 3. FIXED — Goals told a user meeting their target that they were short

The UX review's best finding. Somebody doing **10.9 sets a week against a 7–10 target** read, in
bold at the top of *What you are actually doing*:

```
  Not enough sets on this muscle                     10.9
  10.9 sets a week, against the 7–10 this goal asks for.
```

The number beside it was **green** and the row's own class was already `is-ok` — **the code knew.**
Only the headline had not been told, because `reason` is a fixed string. Headlines get read and grey
sub-lines do not, so the one screen in this app that holds *measured evidence a user is doing the
work* said the opposite.

⚠️ **This is Rule 6 from the other side.** The rule forbids unearned opinions and this project is
careful never to congratulate anybody for a number that has not earned it — but **an unearned
NEGATIVE verdict is the same fault**, and it is the one that costs a user something. A row now
carries a status-aware `heading` alongside its `reason`, and the two screens pick: *What you are
actually doing* uses the heading, *Why progress stalls* keeps the cause name, because there a row
names a cause whether or not it is happening to you.

### ⚠️ 4. FIXED — the demo account was writing drafts to real localStorage

Every screen of the demo carries a strip saying *"nothing is saved"*, and §0.10 of this file said
*"nothing it does can reach localStorage"*. **Both were false.** `store.js` swaps its whole backend
in the demo, but the session runner's draft never went through the store — it went straight to
localStorage, so running a workout in the demo left invented sets on the real device, and they
survived leaving it. Now keyed to the demo flag's own storage. ⚠️ **The defect is the false claim,
not the stray key.** The leak was near-harmless; a safety sentence that is not true is not.

### The UX review's findings that are NOT fixed — the honest list

Ranked as it delivered them. **None of these is a bug; all are judgements with a stated trade-off**,
and two of them argue for moving caveats, which this project does not do casually.

1. **⚠️ NOTHING A USER CAN SEE ON HOME EVER GROWS.** A fresh account and an account with a year of
   training and 200 sessions render *the same layout with a longer list*. The only number in the
   header is "7 workouts saved", which counts the **plan**, not the training. The app is not short of
   rewarding readouts — a rising curve with **+90 · +54.5 %**, per-lift deltas, *"251 lbs, stronger
   than 62 %"*, a filled month — **and every one of them is behind the Data tab.** Nowhere does
   anything say you hit a personal best. Two suggested fixes: one line under Home's primary button
   drawn from what Data already computes, and a best-ever line on the finish screen. ⚠️ **The second
   is Rule 5-safe and worth noting**: "you typed a bigger number than you have ever typed before" is
   a comparison of two recorded sets, and the typo argument in `strength-estimate.js` is about
   admitting an observation into a *derived* estimate. **The years view shipped the same day is the
   same instinct — but it lands in Calendar, tab 3.** This finding is about Home.
2. **"Programme" becomes "systems" on the very next tap.** Home says *"Pick a programme"* and
   *"Nine ready-made programmes"*; Explore's title is *"Ready-made systems"*; the button is *"Add to
   my systems"*. **This is improvement-plan §1.1's fault reappearing one screen later** — and the
   word's only definition in the whole app sits in the Workouts empty state, which is precisely the
   screen the first-run fix now routes a new user past. The test written with that fix pins *"the
   word 'system' must not appear on the first screen"*; **screen two was never covered.**
3. **Explore ranks nine programmes by a number it explains nine cards later**, ~2000px down. The
   Golden Six, which the app's own subtitle calls a reasonable way to start, carries the lowest pair
   on the screen (35/55) beside a six-day programme at 55/80 — so a stranger comparing numbers picks
   the six-day one. And the flagship programme's detail screen opens with a red disclaimer before a
   single exercise appears.
4. **"Hard sets" is the unit the whole volume model rests on, is never defined, and is not what the
   app counts.** `weeklyVolume()` credits **every logged set** — there is no warm-up exclusion on the
   volume path — so somebody who logs warm-ups is measured against a target built on sets near
   failure and told "10.9 sets a week" when their hard-set count might be six. ⚠️ **This one is
   closest to a real defect** rather than a judgement: it is the number Goals measures the user by.
5. **The red "not backed up" dot is on from the first paint**, including on an empty account with
   nothing to lose and **inside the demo where nothing is real**, and its only explanation is a
   `title` attribute, which does nothing on a phone.
6. Smaller: the rest chip reads *"no target"* (a state, not an action); *Programmes that fit* lists
   Upper/Lower twice, correctly and confusingly; the muscle-map legend prints bare percentages with
   no word for what they are; a first-timer's stepper starts at 0 with 5 lb steps and the field does
   not look typeable.

**And what it said is already right, which is worth recording because it was looked for:** the
five-tap first run holds (re-walked cold); the missed-week sentence — *"It has been about 10 weeks
since you last did this one, so this is what you last did rather than a step up"* — is called the
best-judged sentence in the app; day 2 teaches double progression at the moment of use; **e1RM never
leaks into the UI**; the muscle panel carries a percentile, a next step and its evidence in four
lines with no jargon; and neither chart mode dead-ends.

---

## 2026-08-22, third pass — ⚠️ THE EDGE-CASE REVIEW RAN, AND IT FOUND A LOT

**Six of the seven reviews in `docs/improvement-plan.md` §0 have now run.** The edge-case / data
integrity one is the fifth, and like every one before it, it found something real. **Two fixes
shipped with it; the rest is written up below and the serious ones are now Open work items.**

### ⚠️ Fixed: a day number floored from LOCAL midnight collapses a day across DST

`js/optimal.js` and `js/store.js` both turned an ISO date into a day index with
`Math.floor(new Date(y, m-1, d) / 86400000)`. **That is a stable index only while the zone's UTC
offset stays on one side of zero.** Europe/London, Dublin, Lisbon and the Canaries are UTC+0 in
winter and UTC+1 in summer, so local midnight sits on one UTC day all winter and the previous one
all summer — and the index steps by **0 or 2** across each change.

```
  TZ=Europe/London
  dayNum('2026-03-30') - dayNum('2026-03-29')  →  0      two days, one number
  dayNum('2026-10-26') - dayNum('2026-10-25')  →  2      one day, two numbers
```

Measured consequences, both reproduced: `observedDaysPerWeek()` de-dupes on that number, so **two
logged sessions counted as one** and every "% optimal" rating for a user-built system read low,
caption included. And `trainingForMuscle()` over 28 consecutive training days reported **a 27-day
span and 14.52 sets a week instead of 28 and 14.00** — the numbers the Goals stalls screen is built
on. Fixed to `Date.UTC`, which has no offset to move, matching what `e1rm.js` and
`strength-estimate.js` already did correctly. ⚠️ **This is the THIRD form of the date trap this
project has met** — `new Date(iso)` reading as UTC, a UTC instant compared to a local day, and now a
local midnight floored into a day index. Tests spawn a child process under an explicit `TZ`, because
Node cannot restore the system zone once `process.env.TZ` is reassigned.

### ⚠️ Fixed: a workout planned with four drops read back as one

`plannedMinis()` read only `minis`, but `drops` was the legacy key on **both** shapes — an array of
mini-sets inside a recorded set, and this **count** on a workout exercise. `minisOf()` covers the
first; nothing covered the second. So a workout saved in that window restored as a different workout
from the one that was saved, and it looked exactly like the plan having always said one.

### ⚠️ NOT fixed, and now Open work — the serious ones

1. **⚠️ PROGRESSION RATCHETS REPS FOREVER ON TWO BRANCHES, and walks the lift out of the app's own
   ranking.** Played forward through the runner's real glue, not the module alone: a Lateral Raise
   at 20 lb, obeyed for 30 sessions, goes **20×10 → 20×37**, taking `noIncrement` every session from
   13 on. Barbell Curl 60×8 → **60×34**. `repRangeFor()` tops out at 15–20, so past 20 reps the
   branch that would raise the weight is **unreachable and there is no terminal state at all** — it
   prescribes 37 reps while printing "range 15–20". And past 15 reps `MAX_EVIDENCE_REPS` (D5) refuses
   the set as evidence, so **the app's own advice removes the exercise from its own muscle map**.
   ⚠️ **This is the 2026-08-20 lesson landing on a different branch.** The play-forward test written
   then walks the bench at 185 lb — the branch that had the original bug — and the two branches with
   no terminal state were never played forward. *A rule that reads its own output needs a test that
   plays it forward, on every branch, not on the one that broke.*
2. **⚠️ A STORAGE FAILURE WHILE FINISHING A WORKOUT IS COMPLETELY SILENT.** `finish()` in
   `views-session.js` awaits `saveSession()` unguarded, and there is no `unhandledrejection` handler
   anywhere in the app. `LocalBackend.write` throws a perfectly good message — "Could not save. Your
   browser storage may be full." — and **nobody ever sees it**: the promise rejects, nothing is
   stored, `clearDraft()` and `showFinished()` never run. Reproduced by making `setItem` throw.
   The user taps Finish, at the end of a workout, and nothing happens.
3. **⚠️ THE FIRESTORE CEILING IS ~950 SESSIONS, NOT 3,000.** Measured: 3,000 sessions is **3,298,891
   bytes**, 3.1× over the 1 MiB per-document cap, at ~1,100 bytes a session. Cloud writes begin
   failing at about **950 sessions — roughly four and a half years at four a week** — and by finding
   2 they fail *silently, mid-workout*. `docs/firebase-setup.md` has been claiming 3,000 since the
   beginning. Splitting `sessions` into a document per session is the fix the design already
   anticipates.
4. **Restore from backup half-imports, and one malformed row takes down every screen but Settings.**
   `importAll()` validates almost nothing: `{sessions:[{id:'s1'}]}` gets stored and then
   `getSessions()` throws on `b.date.localeCompare`, which takes out Home, Workouts, Calendar, Data,
   Muscles and Goals through the router's catch. **Settings still renders**, so "delete all data" is
   reachable — recoverable, not bricked. It also accepts `{foo:1}` and `{workouts:'oops'}` without
   complaint and then toasts "Backup restored" having restored nothing.
5. **Restore is a partial MERGE, and a workout with a dead `systemId` is invisible forever.**
   Restoring a pre-systems backup leaves current systems in place; a workout pointing at a system
   that no longer exists is returned by `getWorkouts()`, rendered by no system screen, and
   **`ensureSystems()` will not adopt it** because it only looks for workouts with *no* `systemId`,
   never a dead one. The user sees an empty Workouts screen with every workout still on disk.
   ⚠️ Same rule this project already learned from the other side: *a foreign key is only valid while
   the rest of that set still exists.*
6. **"Restore from backup" has no confirmation**, while "delete all data" two lines below it has a
   `confirmSheet`. Restoring is equally destructive.
7. **A ×10 typo rates a muscle Elite, end to end** — confirmed on screen, not merely in theory: one
   `10000 × 5` bench renders **"Chest: Elite, good confidence"**. §9 already records that the
   winsoriser cannot catch this and that the plausibility ceiling is unwired; this is the proof it
   reaches the user. The stepper has a floor and **no ceiling**, so 10,000 is typeable.
8. **Render cost at 3,000 sessions**: CalendarView builds **14,074 nodes in 461 ms** because
   `monthRange()` eagerly builds every month back to the earliest record; `muscleStrength()` takes
   **743 ms** in desktop Node. Not a crash — a stall, and unmeasured on a phone.

**Checked and CLEAN, which is worth as much as the findings:** no `NaN`, `undefined`, `Infinity` or
`[object Object]` painted anywhere across six screens driven with absurd values (10000×5, −50×0,
100×500, a goal with `targetWeight: 0` and `startPercentile: NaN`); export → clear → import → export
is byte-identical; `dropOrphanGroups()` is complete for every deletion reachable from the UI;
deletion cascades honour D22; all nine preset systems copy structurally identically; and **the bench
progression loop is healthy through the real save path** — 24 obedient sessions, range never leaves
8–12, 185×10 → 205×10, which is the `trainingRange()` fix holding up outside its own unit test.

---

## 2026-08-22, second pass — the calendar grows a YEARS view

**Tim asked for it with a reference image** (2026-08-22): *"another way to display the workout days
in Calendar so each day is a tiny box and is colored or not colored depending on if you worked out
that day. This will show years of data in one screen."*

Built. `#/calendar` now carries a **Months / Years** switch; Years draws one square per day, one row
per year, newest first, with a *"141 days trained"* count beside each. `js/year-grid.js` holds the
maths (pure, clock passed in, no DOM), `views-data.js` draws it. **Two years of the demo account
fit in the top half of a 375×667 screen with room to spare.**

### ⚠️ It is BINARY, and that is a measurement rather than a preference

The month view paints a workout in `--accent` and a benchmark-only day in `--good`. Those two
measure **ΔE 6.5 apart under protanopia in the light theme** (the `dataviz` validator, run before a
line of it was written), which the guidance permits *only* alongside a secondary encoding — a label,
a texture, a gap. **A 6px square has room for none of them.** So one square means one thing, "you
trained", and the Months view keeps the distinction. A distinction nobody can see is not a
distinction; it is two colours. This is also exactly what Tim asked for, and the two arguments
agreeing is the reason it needed no compromise.

### ⚠️ Tapping SELECTS. It does not navigate

A cell is **5.7px** on a 393px phone, because 53 week-columns have to fit across — that *is* the
feature. Six pixels is under every hit-target standard there is, so a tap that navigated would open
days people did not mean about as often as days they did. A tap fills a readout line that **holds
its row whether or not anything is selected** (Rule 3's corollary — revealing it on tap would shove
every grid below it downward at the moment somebody was pointing at one), and the readout is the
full-width control that opens the day. ⚠️ **WCAG 2.5.8 is satisfied by EQUIVALENCE, not by
exemption**: every day here is reachable at 40px in the Months view, one tap away on the same screen.

### ⚠️ Two bugs came out of building it, and NEITHER was visible to a test

1. **`1fr` is `minmax(auto, 1fr)`, so the month strip sized itself to its own labels.** Fifty-three
   columns each refusing to shrink below the width of "Jan" made the strip a third wider than the
   grid it labels — and **"Nov" sat over the 20th of August**. It looked completely plausible: a row
   of month names above a grid of squares, evenly spaced, simply lying. Found by asking the browser
   `document.elementFromPoint()` under each label and printing the date it landed on. `minmax(0,1fr)`
   fixes it. **A month label two columns out of true cannot be caught by eye at 6px**, which is why
   it was measured instead. The arithmetic half is now pinned in `tests/year-grid.test.mjs`.
   ⚠️ **The same bug was hiding a second one**: the grid itself was overflowing its pane, so the last
   ten weeks of every year were being clipped off the right-hand edge.
2. **⚠️ A VIEW DOES NOT OWN THE NODE IT RETURNED.** The mode switch first re-ran the view and swapped
   the new screen in — which silently threw away the demo account's *"nothing is saved"* strip,
   because `app.js` **prepends** that into the node the view hands back. Switching to Years inside
   the demo removed the one line on the page saying the data is invented. **Caught by looking at a
   screenshot, not by a test.** It now repaints its own contents in place and leaves the container
   alone. Pinned by a test that plants a `.demo-bar` and asserts it survives the round trip —
   ⚠️ **asserted against the DOCUMENT, not against the view's own reference**, because under the bug
   that reference goes stale and still holds the strip, so the obvious form of the test passes over
   the exact fault it was written for. **Mutation-checked**: reintroducing the node swap flips
   exactly that assertion.

**45 new assertions in `tests/year-grid.test.mjs`** — every day of the year drawn exactly once
across seven years including leap years and a Sunday opening, every square in the row its weekday
actually falls on, every month label on its own month, and the count naming **days** rather than
workouts, because one square is one day and a header reading "155 workouts" over 150 squares is a
number that does not describe the thing beside it.

---

## 2026-08-22 — ✅ A REAL IPHONE, AND BOTH OPEN QUESTIONS CLOSED

**The first time a real device has ever opened this app**, and it closed the two things nothing in
this repo could. Tim, from the app **installed on his home screen** (not a Safari tab — he has no
native build, so "the installed PWA" and "added to home screen" are the same thing here):

> *"next exercise is still reachable, as well as the exercise picker. Google sign-in actually works
> now."*

### ✅ The keyboard fix is VERIFIED

`--kb` was the largest structural change the phone work made and it shipped unproven, because
headless Chrome has no software keyboard and `100dvh` does not shrink for one — it was verified only
by driving the variable by hand. **A phone has now confirmed both cases the survey called out**: the
session runner's *Next exercise* stays reachable with the keyboard up, and so does the exercise
picker, which was the sharpest case in the survey (3 of 272 exercises visible before the fix).

⚠️ **One thing this does NOT settle.** The survey's reasoned item *"the picker's search box is
focused inside `setTimeout(…, 120)`, which breaks the user-gesture chain, so iOS will likely show a
caret and no keyboard"* is **still unmeasured**. The picker was judged with a keyboard up, but
nobody recorded whether it rose by itself or after a tap on the search box — and those are different
findings. It stays in "needs hardware" until somebody says which.

### ✅ Google sign-in WORKS in the installed PWA — and yesterday's write-up was wrong twice

The section below this one argues at length that this could not happen. **Two of its conclusions
were wrong, and the mechanism explains both.**

**What actually fixed it was `prefersRedirect()`.** It used to return `true` for an iOS home-screen
app, so the installed PWA went **straight to `signInWithRedirect`** — the one route a cross-origin
`authDomain` genuinely cannot finish. The third pass stopped it preferring a route that cannot
complete, which means the PWA now attempts the **popup** instead. The popup works. So the fix that
mattered was not one of the three "code faults met at the symptom"; it was the one filed as a
footnote to the third of them.

⚠️ **The false claim was "popups are blocked in an iOS home-screen app."** It is written in
`js/firebase-backend.js`, in `docs/firebase-setup.md` and in §9 of this file, and it is the premise
the old redirect preference was built on. **A device says otherwise.** Both files are corrected;
the reasoning is left in place with the correction beside it, because the wrong premise is why the
code did the wrong thing and deleting it hides that.

⚠️ **What has NOT changed, and must not be quietly relaxed:** `signInWithRedirect` still cannot
complete in this configuration, on any current browser. `redirectCanComplete()` is still correct,
*"Continue in this window instead"* must still stay hidden where it cannot finish, and the fallback
must still name **email**. The origins are still different. Nothing about the storage-partitioning
analysis was wrong — only the claim about what the PWA can do *instead*.

⚠️ **The Safari-tab path is now the untested one, and it is the surface the original bug came
from.** Tim's 2026-08-21 report — popup opens, closes a second later, nothing happens — was not
recorded as Safari or home-screen. It works in the installed app; whether an ordinary Safari tab
completes has not been checked since the fixes shipped. **Do not write "Google sign-in works on
iOS"** — write what was measured, which is the installed PWA.

**One open question for Tim is therefore MOOT** — the auth handler in the `timothyhadfield.github.io`
user-page repo. It was the only real fix for a redirect flow nobody needs any more. Not started, and
now not needed; the analysis stays in §10 in case the app ever moves domain.

---

## 2026-08-21, fifth pass — the body map: the figure stops moving

**Tim, from the phone:** *"When you tap a muscle the whole thing shrinks and moves upwards to make
room for more words at the bottom. This disconnects the body from the arms and just makes it harder
to see. I don't want to ever move the body (in direction or size), so to make room for the words,
just make way less words on the bottom."*

⚠️ **Rule 3's corollary already said this and the phone never obeyed it.** "Content must not shrink
because you asked it a question" was written for exactly this screen, and the DESKTOP honoured it —
a muscle opens in a side column so the figure keeps its size. On a phone the panel stacks
underneath, and `.body-wrap` was `flex: 1`: a flex item whose instruction is *give up whatever the
thing below you needs*. So the figure shrank and rose by however many words the panel had. **A rule
kept in one layout and broken in the other is not a rule**, and nothing was comparing them.

`.body-wrap` is now a **fixed 57 %** and `.body-foot` takes what is left and scrolls inside it.
Measured in a real engine, tapping Quads: **393×852 body `{x:14, y:176, w:365, h:348.3}` before and
byte-identical after; 375×667 `{x:14, y:176, w:347, h:242.8}` likewise.** ⚠️ **jsdom cannot check
this** — it has no layout, so `getBoundingClientRect` is all zeros. It needed a browser and it always
will.

### The panel: a paragraph down to 18 words

It carried a source sentence, a confidence block (label, band, percentage, bar, corroboration line),
up to three multi-line caveats, a restatement of the comparison group, and **a seven-row table of
per-level weight targets**. Now:

```
  Quads                                    Proficient
  320 lbs   stronger than 66%
  ▮▮▮▮▮▮░░░░░░░░░░░░░  47 lbs to Advanced
  High confidence · 170 sessions, 4 exercises
  from Back Squat 300×3, Jul 10
```

**Cut entirely:** the seven-row target table — six of its rows are weights for levels nobody is near,
and the seventh is what the to-next bar already says. The confidence **bar** — D19 paints confidence
as the muscle's own fade and the legend explains it, so a second bar drew the same quantity twice and
competed with the to-next bar beside it. "Newest N days ago" and the confidence percentage.

**Cut as a repetition, not as a claim:** the panel's restatement of the comparison group. ⚠️ **D15
still holds** — the UI must always say "of people who lift" — and it is still said, by the header,
which is `.pane-top` and therefore **fixed and on screen at every moment the panel is**. What went was
the second copy, not the claim.

⚠️ **KEPT, one line each: every caveat, the corroboration, and the source set.** This app's whole
credibility is that it does not overclaim. **Shortening a caveat is allowed; softening one is not** —
the fallback note, the high-rep note, the general-population note and the blocked-sets note all still
make exactly the claim they made, in a line instead of a paragraph. Sessions AND exercises stayed for
the same reason: "170 sessions" reads as well corroborated and "170 sessions, 4 exercises" is the
honest version of it.

**A word count is now a test.** Every other assertion on this panel checks something is PRESENT, and
the failure mode being guarded is things quietly accumulating until it is a wall again — which no
presence check can ever catch. A clean rating is capped at 40 words; it currently runs 18.

---

## 2026-08-21, fourth pass — the first run: 12 steps to 5

**Built on Tim's ask for a recommendation.** `docs/improvement-plan.md` §1.1 has carried this as the
cheapest high-value change available since 2026-08-19, and the restructure earlier the same day made
it most of the way there without meaning to.

**The defect:** an empty account's primary button read *"Create your first workout"* and landed on
`#/workouts`, whose two actions are *"New system"* and *"Explore ready-made systems"*. It **promised a
workout and delivered a system** — a concept that exists for the app's benefit (D22) rather than the
user's — and a stranger had to absorb it before logging a single set. D4 says the logging loop is the
one thing apps beat spreadsheets at.

**The fix is not to remove systems. It is to stop making anybody read about one.** Explore is the
primary action on a first run, so a real programme is one tap, and it teaches what a system is **by
example** — D8 exactly. Everything downstream already worked and this was the one broken link:
copying a programme in makes `suggestNext()` return `isStart`, so Home's very next paint reads
**"▶ Push 1 · First workout in Ultimate Push Pull Legs"** with no further decision asked of anybody.

**Measured, on a brand-new account at 393×852 with real mouse events:**

```
  tap 1  Pick a programme          → Explore
  tap 2  Ultimate Push Pull Legs   → the programme, with its warning and its notes
  tap 3  Add to my systems         → the copied system, its six workouts listed
  tap 4  Push 1                    → the workout: its exercises, its supersets
  tap 5  Start workout             → the runner, Barbell Bench Press, steppers live
```

**Five taps from a cold install to a loggable set**, against about a dozen before.

Two smaller things went with it. **"Record a benchmark" is absent from the first run** — it is the
most jargon-heavy action in the app and it asks somebody who has never trained to record a maximum;
it returns the moment there is anything at all. And **the "Recent activity" heading is gone from the
first run**, because a heading standing over an empty list is a heading over nothing.

⚠️ **The old test was green over this the whole time.** It asserted the screen said *"Create your
first workout"* — which is precisely the string that was wrong. It now pins the property instead of
the wording: the first action must be one tap from a real programme, **the word "system" must not
appear on the first screen at all**, and the tap is asserted by driving it rather than by reading a
label.

---

## 2026-08-21, third pass — ⚠️ GOOGLE SIGN-IN IS BROKEN ON THE IPHONE, and why

> ✅ **SUPERSEDED 2026-08-22 — IT WORKS NOW, in the installed PWA.** Read the section above for what
> was actually wrong with the reasoning here. Kept in full because the diagnosis was mostly right
> and its fixes are what shipped: **the storage-partitioning analysis still holds** and redirect
> still cannot complete. What was wrong was the premise that a popup is blocked inside an installed
> iOS app — so stopping the PWA preferring redirect quietly moved it onto a route that works.

**The first bug report from a real device.** Tim, 2026-08-21: *"when I try signing in with google, it
opens a popup for a second, and then quickly closes it and nothing happens."* This is the path §9 has
called the riskiest untested one in the project, and it was right.

### ⚠️ The root cause is the authDomain, and it is a CONFIGURATION fault, not a code one

The app is served from **`timothyhadfield.github.io`** and `firebase-config.js` points `authDomain`
at **`fitness-tracker-th.firebaseapp.com`**. Those are different origins, and Firebase's own guidance
([redirect-best-practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)) is
explicit about what that costs: the auth handler needs cross-origin access to storage, and
**Safari 16.1+, Firefox 109+ and Chrome M115+ all block it.** Safari 16.1 shipped in 2022, so this is
every iPhone in existence.

⚠️ **Nothing in this repo can fix that.** The five options Firebase give are all outside the code:
point `authDomain` at the app's own domain, proxy `/__/auth/`, self-host the handler files, use the
provider SDK directly, or stay on the popup. **This project is already on the popup**, which is their
recommended workaround, and it is failing anyway.

⚠️ **The awkward part of the real fix:** the handler must live at the DOMAIN ROOT — the app is a
GitHub *project* page at `/Fitness_Tracker/`, so `/__/auth/handler` belongs to the
`timothyhadfield.github.io` **user-page repo**, a different repository, and would then be shared by
every project on that domain. Also needs `.nojekyll`, or Pages drops anything starting with `_`.
**Not started, and not to be started without Tim saying so** — email sign-in works on iOS today and
is the only thing standing between him and a backed-up account.

### Three code faults met at that symptom, and all three are fixed

Only the first is about Google at all. The other two are why it presented as *nothing*.

1. **⚠️ A HUNG PROMISE LEFT A DEAD BUTTON.** `run()` awaits its function, and the popup's promise on
   iOS can simply never settle — the handler loses its storage, the window closes, and the SDK is
   holding a promise nobody will resolve. **No throw means no catch**, so the button sat on
   "Opening…" for ever with no toast, no fallback and no explanation. That is the literal
   "nothing happens". Fixed with a patience timer. **⚠️ It races the UI, NEVER the sign-in** — a real
   sign-in behind two-factor takes minutes, and aborting one because a timer expired would be a worse
   bug than this. The timer takes the button back and speaks; the auth promise is left running and
   the auth listener still picks it up if it lands. **Mutation-checked: removing the timer flips
   exactly those two assertions.**
2. **Every failure was a 2.4-second toast.** On a phone that is indistinguishable from nothing
   happening, which is precisely how it got reported. Failures on this screen are now a **persistent
   line that stays put** — and it prints the **Firebase error code**, because everything above is
   inference about a device nobody here can run and the code is the only fact available. Without it
   the next report is "nothing happens" again.
3. **⚠️ THE ESCAPE HATCH COULD NOT WORK.** *"Continue in this window instead"* is
   `signInWithRedirect` — the exact flow the cross-origin authDomain breaks. The one route this file
   called "the route that always works" was the one guaranteed to fail on his phone. There is now
   `redirectCanComplete(config)`, and the fallback is only offered where it can finish; where it
   cannot, the screen names **email**, which works. ⚠️ **And `prefersRedirect()` used to return true
   for an iOS home-screen app** — so the installed PWA was choosing between a route that *might* fail
   and one that *cannot*, and picking the second. It now only prefers redirect where redirect works.

⚠️ **Asserted on ORIGINS, never on a browser sniff.** The list of browsers that partition third-party
storage only grows; a sniff written today is wrong next year. The question the code asks is the one
that actually decides it — are the two origins the same?

~~⚠️ **NONE OF THIS MAKES GOOGLE SIGN-IN WORK ON THE IPHONE.**~~ ✅ **WRONG — it did, and item 3 is
why.** Written on the belief that the popup could not run in an installed iOS app either, so that
moving the PWA off redirect only bought an honest failure. **A device disagreed on 2026-08-22.**
The rest of the paragraph stood: it does also make failures diagnostic instead of silent, and that
is still worth having. ⚠️ **The lesson is the shape, not the outcome** — this was a confident
negative prediction about hardware nobody here can run, written in capitals, and the way it was
caught was somebody opening the app. Reason about a device all you like; label it as reasoning.

---

## 2026-08-21, second pass — the phone findings, FIXED

**Everything in the survey below is now done except what needs a device.** Tim asked whether the
fixes were known or needed his help; one was his call and he took it. **2114 → 2141 assertions, all
green**, plus the sw-update test.

### ⚠️ Tim's decision: reading is the screen, editing is behind the pencil

Offered three shapes for the system screen; he chose the one this file recommended, and it applies to
**workouts** as well as systems. So there are now two screens where there was one:

```
  #/system/<id>        the programme: its workouts, its notes, then how it rates
  #/system/<id>/edit   the form: name, notes, Save, Delete
  #/workout/<id>       what the workout is — and START it
  #/workout/<id>/edit  the builder
```

**Measured before and after, same phone, same demo account: the first workout inside a programme went
from 468px down a 445px pane to 38px down a 748px one.** The form and the pinned Save/Delete were
303px of permanent chrome; they are gone from the reading screen entirely.

⚠️ **The workout screen gained something it never had: a way to start the workout.** `#/workout/<id>`
was the builder, so the obvious path — Workouts → my programme → the day I am about to do — was the
one path that could not begin a session. Only Home's next-workout button and `#/start` could. *Start
workout* is now the pinned primary action there.

⚠️ **Delete came out of both pinned footers** and sits past the end of the scroll. A destructive
control permanently under the thumb of somebody rearranging exercises is a slip waiting to happen;
past the end of a list it is a journey.

⚠️ **And the first version of the workout screen rendered "Unknown exercise · undefined sets" six
times.** `blocksOf()` yields `{ item, index }` wrappers — the builder needs the index to write back
through — and mapping the wrapper straight into a row silently produces nothing. Every assertion
written for that screen passed over it; **a screenshot caught it**, and there is now a test that
reads what the rows actually say rather than that they exist.

### The keyboard: `--kb`, and one fix for every screen

`app.js` publishes `window.visualViewport`'s hidden height as `--kb`, and `#app` and `.sheet-backdrop`
subtract it. Verified by driving the value by hand at 393×852: the session runner's footer moves from
**789–852 to 453–516**, exactly clearing a 336px keyboard, with *Next exercise* reachable. The picker
sheet now ends at the keyboard's top edge with **Done visible**.

The picker's 16 filter chips also became **one horizontally-scrolling row** rather than four wrapped
ones — Rule 1 permits inner scrolling for a genuinely unbounded list, and wrapped, the filter was
taller than the thing it filters. **Exercises visible with the keyboard up: 3 → 7.**

~~⚠️ **NOT VERIFIED ON A DEVICE, and it cannot be from here.**~~ ✅ **VERIFIED ON A REAL IPHONE,
2026-08-22** — *Next exercise* reachable and the picker usable, in the installed home-screen app.
Headless Chrome has no software keyboard, so `--kb` was driven by hand and the confirmation had to
come from a phone. It came.

### The rest, each verified in the browser

- **⚠️ `#/settings` crashed in the demo account and does not now.** `auth.state()` tested
  `impl === LocalBackend` and MemoryBackend is a **third** backend, so it fell into the cloud branch
  and called a `currentUser()` it has never had. Fixed in `auth.state()` rather than by a fourth
  `demo.active()` guard at the call site — `AccountView` and `social.state()` already carry their
  own, which is exactly why nobody noticed this one. Returns `mode: 'demo'`, deliberately not
  `'local'`: a demo session is not saving to this device either, and Settings must not tell somebody
  their data is safe here when it is nowhere. **Mutation-checked — reverting reproduces the exact
  TypeError at the new assertion.**
- **The mode switch says three options again.** `.seg` had `min-width: 0`, so "Bar Chart" was
  squeezed to 62px, needed 65, and painted the overflow under its neighbour. Now content-sized with
  an ellipsis backstop, **a hairline between unselected segments**, and 44px tall — real pixels this
  time, because an `overflow: hidden` box clips a pseudo-element grown past its own height, which
  would have measured 36px while the rule claimed 44.
- **The calendar lands on the current month** — `offsetFromPaneTop: 0`, was 287px short. It was
  never bad arithmetic: the current month is the last section, so the scroll was **clamped**. It is
  given exactly the trailing room the shortfall needs.
- **Textareas grow to their content**, app-wide, from the same two mount points as
  `associateLabels()`. `field-sizing: content` is the CSS answer and Safari does not have it.
- **kg can be typed.** Weight moved to `inputmode="decimal"`; `numeric` is the iOS keypad with no
  decimal point, and kg shows one.
- **Both `:hover` rules are behind `@media (hover: hover)`.** The body-map one mattered: a fade left
  behind by a thumb is D19's encoding for *less sure*.
- **The demo bar owes the top safe-area inset**, since it is prepended above the only element that
  was paying it — and `.demo-bar + .topbar` stops it being paid twice.
- **The axis picks its precision from the gap between gridlines** — 279.9 · 248.1 · 216.3 became
  whole pounds, without a body-weight chart printing the same figure on two adjacent lines.
- **The rating prose has paragraph gaps**, and sits *below* the workout list rather than above it.
  Nothing is hidden or shortened: on a phone the caveats are load-bearing, and a disclosure is how a
  caveat stops being read.

### The last two layout items, also done

- **Explore's badge stopped sharing the row.** Below 700px it drops to its own line and the text
  takes the full width — **200px of usable text width became 338px of 393**, and the summaries went
  from five or six 28-character stubs to three real lines. The 2×2 grid was the right answer when
  the alternative was four cells beside a name; the honest reading is that no arrangement of four
  numbers leaves a sentence enough room on a 393px screen while sitting next to it. Freed of the
  name, four across finally fits.
- **Goals leads with the goal again.** The two paragraphs explaining the missing verdict sat third
  and filled a 375×667 screen, so a goal opened on an explanation of what the screen does NOT say
  and nothing it does say was reachable without scrolling. Moved down — **not hidden, not shortened,
  not folded into a disclosure** — to sit with the screen's other honest limit, the one about
  weights, which is where `progressionBlock`'s own note already argues these belong. *What this asks
  of you* now starts 325px into a 445px pane on the smallest phone. ⚠️ **Its closing sentence said
  "everything below is measured rather than judged" and now says "every number on this screen"** — a
  caveat that survives being moved but stops describing anything is worse than one never written.

### Still open from the survey

Only the **"needs hardware"** list below. Nothing measurable is left.

---

## 2026-08-21 — the first iPhone pass: what a phone-shaped look found

**Tim opened the phone work** ("I want to start making it really good for working with on the
iPhone… formatting, design and usability emphasized"). §10.2's deferral is therefore **over**. This
was a survey, not a build — nothing below is fixed yet. Driven over CDP at **393×852 and 375×667**
with `mobile: true` and touch emulation, on the demo account, against a scratch copy.

⚠️ **Still no real device.** Everything here was measured in a desktop engine at phone metrics. The
four items in "needs hardware" below are reasoned from documented iOS behaviour and are **not**
measured; they are marked as such and must stay marked until a phone says otherwise.

### Bugs, measured

1. **⚠️ SETTINGS CRASHES IN THE DEMO ACCOUNT** — `impl.currentUser is not a function`, every time,
   with or without a Firebase config, and **only** in the demo. `auth.state()` in `store.js` branches
   on `impl === LocalBackend`; **`MemoryBackend` is neither that nor a remote impl**, so it falls into
   the cloud branch and calls a method it does not have. `#/account`, `#/profile`, `#/social` and
   `#/goals` are all fine — Settings is the one screen that does not catch. The demo is the tool for
   judging every other screen, so this blocks the phone work itself. The shape is the same
   two-backend assumption `active()` already had to make explicit for the demo.
2. **"Bar Chart" is clipped in the Data mode switch** — `scrollWidth` 65 against `clientWidth` 62, at
   both widths and in both states. Worse than the clipping: the two unselected segments share one
   transparent background with **no divider**, so at 393px the control reads as *"Graph | Bar Chart
   Muscles"* — two options where there are three. On the Muscles tab the selected pill sits over it
   and it renders as **"Bar Char"**.
3. **The calendar cannot land on the current month, and the top third shows the previous one.**
   `CalendarView` sets `pane.scrollTop` to the right number — 4363 — and the browser **clamps it to
   4076**, because the current month is the LAST section in the scroller and there is not enough
   content below it to bring it to the top. 287px short, deterministic, on every visit, warm or cold.
   Not a coordinate-space bug: the arithmetic is correct and the scroller simply cannot honour it.
   The fix is trailing room (a `padding-bottom` of one pane height on the last month), not new maths.
4. **The system Notes textarea clips its own content** — `clientHeight` 66 against `scrollHeight` 90
   on the demo's own notes, with `rows="2"` and `resize: vertical`, which does nothing under touch.
   Text simply stops mid-sentence with no cue.
5. **A kg user cannot type a decimal weight.** `stepper()` sets `inputmode` to `decimal` only for
   distance, so weight gets `numeric` — the iOS digits-only keypad, **no decimal point** — while
   `units.js` gives kg one decimal and a 2.5 step. The ± buttons still work; the keyboard cannot
   express what the display shows.

### The structural one: the keyboard versus a locked layout

**Nothing in this app reads `window.visualViewport`** — the grep is clean across every file. `#app`
is `100dvh` with `html, body { overflow: hidden }`, and **the iOS keyboard does not shrink that**; it
overlays it. So every fixed `.pane-bottom` goes *under* the keyboard the moment a field is focused.
Measured on a 393×852 iPhone with a 336px keyboard, the visible area ends at **y = 516** — and the
session runner's bottom bar, the one carrying **Next exercise**, sits at **789–852**. The same is
true of every *Save changes* and every *Done*.

The sharpest case is the **exercise picker**: the sheet is 767px of an 852px viewport, its 16
muscle-group chips take **142px — four rows** — between the search box and the results, and with the
keyboard up **3 of 272 exercises are visible**. It auto-focuses that search box, so this is the
default state of the screen rather than an edge case.

### Design and formatting, in the order they cost the most

- **⚠️ Opening a programme puts you inside an edit form.** `#/system/<id>` is the system EDITOR: a
  name field and a notes box pinned above (184px) and **Save changes + Delete system** pinned below
  (119px), leaving a 445px pane — and **the first workout is 468px down it**, so the Push/Pull/Legs
  you came for is more than a full screenful below the fold, behind the rating and ~350 words of
  caveat prose. The workout screen repeats it exactly: **Add exercise is ~500px below the fold** and
  the last visible exercise row is sliced through the middle by the bottom bar. **A full-width
  *Delete* in the thumb zone of a screen you mostly came to read** is the other half of the problem.
- **The badge squeezes the words on Explore.** The 2×2 rating takes about 40% of each row, cutting
  every description to ~28 characters and 5–6 short lines. Rule 3 says the name and the sentence are
  the content.
- **Goals opens on two paragraphs of prose.** On a 375×667 SE, *"On track?"* and its two paragraphs
  fill the screen and the second is cut mid-word; no requirement, cost or number is reachable without
  scrolling. The honesty is right and its position is not.
- **The system rating renders as a wall** — roughly 350 grey words with no spacing between the
  paragraphs, so five separate claims read as one block.
- **The graph's y-axis carries one decimal** — 279.9, 248.1, 216.3. False precision on a barbell.
- **⚠️ Two `:hover` rules will stick after a tap on iOS**: `.body-region:hover { opacity: .82 }` and
  `.as-button:hover .row-title`. The first is the bad one — **a fade left behind on a tapped muscle
  is exactly this app's own encoding for "less sure"** (D19), so a touch artefact would be read as a
  confidence claim.
- **The demo bar takes no safe-area inset.** It is prepended above `.topbar`, and `.topbar` is the
  only thing in the stylesheet that pads `env(safe-area-inset-top)` — so in the demo, and under
  `apple-mobile-web-app-status-bar-style: black-translucent`, it runs beneath the Dynamic Island.
  Nothing anywhere uses `safe-area-inset-left/right`, which is the landscape version of the same.
- **Home spends a header row on "Fitness Tracker · 7 workouts saved"** — the app's own name, on the
  screen of somebody who is already in it.

### ⚠️ Needs hardware — reasoned, NOT measured

- `navigator.vibrate` is called on every stepper bump and **iOS Safari has no Vibration API**, so the
  one haptic in the app never fires on the device it was written for.
- The press-and-hold steppers set no `-webkit-touch-callout` and no `user-select`, so a 420ms hold is
  the same gesture iOS uses to raise a selection callout.
- The picker's search box is focused inside `setTimeout(…, 120)`, which **breaks the user-gesture
  chain**, so iOS will likely show a caret and no keyboard.
- The session runner's date is a native `<input type="date">` styled with a dashed underline; iOS
  draws its own control and that styling is unlikely to survive.

**What was already right and should not be touched:** `viewport-fit=cover` with the apple meta tags,
`-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, `overscroll-behavior: none`
(no pull-to-refresh), 16px on every control so iOS cannot zoom on focus, `--safe-b` on the navbar and
the sheets, and the 44px hit areas from the 2026-08-20 audit. The session runner itself reads well at
both widths — big steppers, the primary action under the thumb, the rest bar out of the way.

---

## 2026-08-20 — the review re-run, and the worst bug progression has had

**Three of the seven reviews in `docs/improvement-plan.md` §0 have now RUN** — the adversarial code
review, cross-screen consistency, and **the accessibility audit, which had never been run once in
this project's life.** Run serially by hand rather than as a seven-agent wave, because a seven-agent
wave is what the usage limit killed last time. All three found something real.

### ⚠️ 0. ACCESSIBILITY HAS NOW BEEN AUDITED, AND IT FAILED

This file has said in capitals for weeks that nothing here had ever been checked. It has been now:
`tools/a11y-audit.mjs` drives a real browser over **44 screen/width/theme combinations** — eleven
routes, 360 and 390 px, both themes, on the demo account — and measures **2272 rendered controls and
4764 text elements**, reading each one's contrast against *the colour actually painted behind it*.

**`--ink-faint` failed WCAG AA everywhere it was used, in both themes.** 3.94:1 dark and **3.05:1
light** against `--ground`, where AA wants 4.5:1 for text under 18.66px — and every one of its 75
uses is under 18.66px. That token carries `.field-help` and `.req-source`: **the caveats and the
citations**, which is to say the load-bearing honesty this entire app is built on. 28 distinct
class/theme pairs failed. **Now 0.**

⚠️ **This project had already caught it once, in one place, and fixed only that place.** There is a
comment in `css/app.css` beside `.chart .hover-date` that says --ink-faint measures 3.05:1 and fails
AA — written months ago, acted on for that one line, and the token left in 75 others. *Finding a bug
in a token and fixing the call site is how a bug survives a fix.*

⚠️ **Raising faint alone would have collapsed the hierarchy.** Light `--ink-soft` was only 5.46:1, so
an AA-passing faint landed half a step below it and the two were indistinguishable — **there was not
room in the light palette for three text levels above AA**, which is a palette finding, not a
rounding problem. Soft moved too. Both solved against `--rule-soft`, the worst surface either lands
on, and re-measured in the browser rather than reasoned.

**Two more, and each was invisible to the other kind of check:**

- **Every `<label>` in the app named nothing.** 19 of them, and **not one was associated with its
  control** — a `.field` puts them side by side, which is visually correct and programmatically
  silent, so a screen reader announced *"edit text, blank"* on every form in the app: email and
  password, birth year, workout name, system name, units. Fixed with `associateLabels()` in `ui.js`,
  run at the two places anything mounts — **not at the 19 call sites**, because that fixes today's 19
  and nothing about the 20th, and forgetting looks exactly like remembering.
- **The calendar's TODAY number** switched to `--accent` and measured 3.94:1 in light. It appears on
  **one cell in the month**, which is why no amount of reasoning would have found it. Moved to
  `--ink`; the cell's accent ring and weight-800 already said "today" without colour, which is Design
  Rule 5's general form.

**Touch targets: `.icon-btn`, `.avatar-btn`, `.chip` and `.btn.small` measured 31–36 px** — clearing
WCAG 2.2 AA (24 px) and missing Apple's 44. Grown to 44 with a pseudo-element so **the painted button
does not move**: no real device has ever seen this app, and resizing a header
control on hardware nobody has checked is a worse trade than a bigger hit area. ⚠️ **The first
attempt used `::after` and silently broke — `.avatar-btn.at-risk::after` is the "not backed up" dot
and wins on specificity, so the hit area vanished in exactly the state the audit had caught it in.**
Caught by re-measuring, not by trusting the fix. It is `::before` now.

**Two things are left and both are deliberate.** The inline text link "see the chart" is 71×16 —
WCAG 2.2 SC 2.5.8 **exempts a target inside a sentence**, so it conforms. And *Delete this weigh-in*
holds 36 px rather than 44, because its 44 px box would overlap the neighbouring row and giving a
**destructive** control a hit area extending over its neighbours is worse than the 36 px that already
passes AA.

⚠️ **What this audit did NOT do**, so nobody reads more into it than it earned: no keyboard path was
walked, no screen reader was run, nothing was tested at larger text, and no real device was touched.
Contrast, touch targets, accessible names and horizontal overflow are what it measured.

### ⚠️ 1. PROGRESSION DESTROYED THE REP RANGE IT HAD JUST TOLD YOU TO USE

**The rep band was inferred from ONE session, and the app's own advice changed that session.**
`REP_BANDS` share their boundaries — 8 is the top of 6–8 *and* the bottom of 8–12, and so are 12 and
15 — and `repRangeFor()` resolves a boundary **downwards** on purpose, so that somebody running 3×8
earns a load increase at 8 instead of being walked up to 12 first. That is right for reading a
session cold and wrong the moment the app produced the session:

```
  "+5 lbs and back to 8 reps"      ← said with range 8–12
  next session, 8 reps read cold   → range 6–8, and you are already at the top of it
  two sessions later               → +5 lbs again, and back to 6 reps
```

**A lifter who did exactly what they were told was migrated out of 8–12 into 6–8 and left there.**
Measured over twelve obedient sessions: 185 × 10 became **200 × 6**, taking a load increase every
second session instead of walking the range — roughly twice as often as double progression
prescribes, out of the one module in this app whose stated bias is to err small and the only one that
can hurt somebody. Three of the five bands collapse this way (8, 12 and 15 are all shared
boundaries); only 3–5 and 6–8 were safe.

**Nothing was going to catch this.** 197 assertions, every one of them mutation-checked or swept, and
every single one handed the module a history somebody else wrote. **Not one closed the loop** —
suggest, obey, feed it back, ask whether the app still agrees with itself. The general lesson is
bigger than progression: *a rule that reads its own output needs a test that plays it forward*, and
this project now has one.

Fixed with `trainingRange()`: the range is read across the recent history rather than from the last
session, so the app's own instruction cannot erase the range that produced it. ⚠️ **The asymmetry is
the safety argument, not a side effect.** `REP_BANDS` tops rise, so history can only ever widen the
range *upward* — and a higher range makes the top harder to reach and drops the reps less far when it
is reached. **This fix is structurally incapable of proposing a heavier weight than the old code
did**, only of withholding one, which is the same shape as the lay-off rule. Swept over every weight,
rep count and prior session; asserted directly. The stated cost: somebody genuinely moving from 12s
to triples is held in their old range for a few sessions while the 12s fall out of the window. That
is the cautious failure and it is the one to have.

Nine new assertions, **mutation-checked** — reverting to one-session reading flips exactly three and
leaves the rest passing.

### 2. The Goals programme matcher showed a strength percentage with no caveat

Every row of *Programmes that fit* prints `…% strength` and a count of weekly sets — **the identical
figures Explore and the system screen show** — and the screen carried neither caveat beside them. The
strength one (3×20 and 3×5 score the same) was simply **absent**. The fractional-sets one was there
but as a **hand-written paraphrase** of `INDIRECT_NOTE` that had already lost *"not a measured
fact"* — the exact drift `volume-map.js`'s own header says a caveat must not be able to do.

`INDIRECT_NOTE` is now the shared stem plus a **per-screen consequence clause**
(`INDIRECT_NOTE_RATING` / `INDIRECT_NOTE_SETS`), because "would drop these percentages a band" says
nothing beside a figure that is not a percentage — which is *why* somebody paraphrased it. Both are
imported statically, for the reason `views-workouts.js` already states: a caveat that can arrive late
is the one kind that must not exist. A test holds both variants to the same bar.

**Two §0 hypotheses were checked and are CLOSED, not findings:** the suspected fourth single-flight
bug — the contribution cache already carries body weight in its key — and the per-session clamp,
which lives inside `weeklyVolume()` so all three callers get it.

---

## 2026-08-19, second pass — five agents, and what came out of it

A directed multi-agent session. **Read this before the Open work list, because it moved.**

- **PULL-UPS, CHIN-UPS AND DIPS NOW RATE A MUSCLE.** Body weight is wired into rep normalisation.
  There is **no published percent-of-bodyweight figure for either, and none is needed** — in a free
  hang the hands carry all of it, which is statics, not a citation. Push-ups use a real measurement
  (75 %, two labs half a percent apart). What has no honest figure stays unrankable and the screen
  says which of the two kinds of "can't" applies.
- **GOALS PROGRESSION IS BUILT** (Phase 4). Double progression, the 2-for-2 rule, the smallest
  increment inside 2–10 %, and it says so when no honest increment exists. `js/progression.js` has
  **no clock and no import from `goals.js`**, so §3.1's refusal is structural rather than promised.
  Time enters through one day count and may only ever **suppress** a suggestion, never raise one.
- **THE ESTIMATOR'S PHASE 0 IS DONE** — `js/strength-estimate.js` plus a simulator. Bias +0.68 %,
  RMSE 4.63 %, and the three §9 residuals now have measured answers rather than opinions. One of
  them shipped (below); one is declared unfittable and stays open.
- **THE RATING SAYS WHAT IT CANNOT SEE.** A workout stores a set count, not a weight or a rep
  range, so 3×20 and 3×5 score identically for strength — on screen, in words, not in a tooltip.
- **`docs/research.md` §6.8 IS PULLED**, and it found that **ACSM published a new position stand on
  2026-03-05**, the first in seventeen years. This file had been calling the 2009 one current.

⚠️ **Three bugs were found by doing this, and none was found by a test:**

1. **The demo account could open EMPTY.** `MemoryBackend.seed()` set a boolean before its first
   `await`, so concurrent readers skipped the wait — and `muscleStrength()` is exactly that, four
   reads in one `Promise.all`. The map asked for a body weight on an account holding 53 weigh-ins,
   then corrected itself on the next render, which is why it survived every screenshot review.
   **Third time this project has met boolean-instead-of-promise** — see `ensureSystems()` in §4.
2. **Goals progression anchored its rep range on the WEAKEST set.** Reps fall across sets, so a
   lifter who had just pressed 190 for 6 was told the weight moves "once you hit 5". Found by
   driving a browser; 150 assertions and jsdom had all passed over it.
3. **A "log a weigh-in" message that could never be shown.** The muscle map refuses to render
   without a body weight, so that branch was dead UI. Removed there, kept on the graph where it
   can actually be reached.

---

## Open work — start here

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
     the same day** — the second pass's "last two layout items" section above has the measurements
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
   Full write-up in the third-pass section above; these are the ones nobody has done.

   - ~~**⚠️ (a) PROGRESSION RATCHETS REPS WITH NO TERMINAL STATE.**~~ ✅ **FIXED 2026-08-22** — a rep
     ceiling at the top of the top band, which **refuses** rather than stepping smaller, and both
     branches are now played forward to forty sessions. See the fifth-pass section.
   - ~~**⚠️ (b) A FAILED SAVE AT THE END OF A WORKOUT IS SILENT.**~~ ✅ **FIXED 2026-08-22** — it
     says so on the screen above the button that failed, keeps the draft (the only other copy), and
     the same tap works again once the problem clears.
   - **⚠️ (c) THE FIRESTORE CEILING IS ~950 SESSIONS** — ✅ **docs corrected 2026-08-24**, and the
     "fails silently" half turns out to be half-closed already: a rejected cloud write surfaces on
     screen, because `finish()` has caught `saveSession()` since 2026-08-22 whichever backend threw.
     ⚠️ **Still open: nothing warns as the limit approaches**, and the split to a document per
     session is a migration over live training data that stays its own job. Nobody is near it —
     Tim's account holds a few dozen sessions.
   - ~~**(d) Restore from backup validates almost nothing, MERGES rather than replaces, and has no
     confirmation**~~ ✅ **FIXED 2026-08-24.** Every row is checked before any row is written, so
     there is no half-restore; `{foo:1}` is refused rather than toasting success over nothing; every
     collection is replaced including the ones the file does not carry, which is what kills the dead
     `systemId`; and it has a confirmation that names what is in the file.

0h. **⚠️ THE DUMBBELL FAMILY'S RATIOS ARE REASONED, AND THE ONE THAT WAS CHECKED WAS WRONG BY 15 %.**
   `Dumbbell Row` was corrected 2026-08-24 from 0.85 to a published 0.98 (see the section above).
   ⚠️ **`Dumbbell Bench Press` is wrong the same way and was measured against the same source —
   0.72 against a published 0.81 — and is deliberately NOT fixed**, because moving it alone would
   leave `Incline Dumbbell Bench Press` (0.62) and `Decline` (0.76) relatively more generous than the
   flat version. **The family has to be re-derived in one pass**, by the technique the dip, pull-up
   and now dumbbell row entries use: one population, both lifts, a 180 lb male, divide.
   ⚠️ **And the finding generalises beyond dumbbells.** What was established is that a *reasoned*
   ratio in that table can be 15 % out in the flattering direction. Every entry with no derivation
   comment is now suspect, and the machine entries (`q` 0.35–0.50) have the same status. This is a
   bounded research job with a known method, and it moves real numbers on real body maps.

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
   - **"Hard sets" is never defined, and is not what the app counts.** `weeklyVolume()` credits every
     logged set with no warm-up exclusion, so somebody who logs warm-ups is measured against a target
     built on sets near failure. ⚠️ **This one is closest to a real defect** rather than a judgement:
     it is the number Goals measures the user by.
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
   fourth-pass section above.** What follows is the original finding, kept because the reasoning is
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
| **Everything at once** | **2324 assertions across eleven suites**, plus 12 in `sw-update`. Only `render` needs `npm i jsdom`; the rest need nothing. ⚠️ **Recounted 2026-08-24** by counting PASS/FAIL lines — several rows below had drifted from their real figures by more than that day's additions, so treat any number here as a recount rather than a running tally |
| **Year-grid tests** | `node tests/year-grid.test.mjs` — 45 assertions, **no dependencies**. The calendar's Years view: every day drawn exactly once, every square in its real weekday row, every month label over its own month |
| **Data tests** | `node tests/data-layer.test.mjs` — 1140 assertions, **no dependencies**. ⚠️ Since 2026-08-24 it carries the **within-session fatigue** section: Tim's real back session driven end to end, that the lift he did third no longer leads it, that the first exercise is never discounted, that the same three exercises **in a different order now rate differently** — which they did not before — and that a benchmark is never fatigued |
| **Body-weight tests** | `node tests/bodyweight.test.mjs` — 170 assertions, **no dependencies**. What fraction of your body weight each movement carries, that it is read from the DATE OF THE SET, and **which exercises are refused and why**. ⚠️ Since 2026-08-24 it also pins the **assist** branch — that 70 lbs of help at 180 lbs is 110 lbs of resistance, that more help than you weigh is refused rather than reported as a negative load, and that an assisted set is discounted **below a real pull-up muscle for muscle**. The exclusion list it guards lost one entry that day and the reason is written into the list itself |
| **Estimator tests** | `node tests/strength-estimate.test.mjs` — 72 assertions, **no dependencies**. Most assert MEASURED simulator outcomes, each with a vacuity guard. `node tools/strength-fit.mjs` re-derives every constant rather than trusting it |
| **Social tests** | `node tests/social.test.mjs` — 81 assertions, **no dependencies**. What a person SHARES. ⚠️ Since 2026-08-22 the invite block is fed **the shape the network really returns** — a Firestore Timestamp, not the tidy ISO string the old fixtures used. That gap is where the expired-invite bug lived |
| **Volume tests** | `node tests/volume-map.test.mjs` — 64 assertions, **no dependencies**. Direct/indirect mapping, the published efficiency tiers, and the per-session clamp |
| **Rating tests** | `node tests/optimal.test.mjs` — 76 assertions, **no dependencies**. The dose-response curves, and the three things the rating refuses to do |
| **Goals tests** | `node tests/goals.test.mjs` — 229 assertions, **no dependencies**. The requirements model, progression, and **the three things Goals refuses to do**: read the calendar to decide what it asks of you, emit a verdict, and let a clock make anything heavier. ⚠️ Since 2026-08-24 it also **plays an assist machine forward through forty obeyed sessions** and asserts it never once proposes more assistance. That section replaced two assertions that were green while the bug was live, because they read the SOURCE for a guard rather than driving the function with the exercise that reaches it |
| **Demo tests** | `node tests/demo.test.mjs` — 58 assertions, **no dependencies**. That the generated year is DETERMINISTIC (the same day is byte-identical, so "resets to the default" is literal), PLAUSIBLE against the app's own modules, and that **the backend serving it is single-flight** |
| **Accessibility tests** | `node tests/a11y.test.mjs` — 22 assertions, **no dependencies**. Pins the PALETTE: every text token against every surface it can be painted on, in both themes, plus the three-step hierarchy and the two fixes that are invisible when they break. ⚠️ **Not a substitute for the audit** — it caught a latent light-theme pair no screen currently paints, and the audit caught an accent-coloured number on one cell in the month. Neither could have found the other's |
| **The accessibility AUDIT** | `tools/a11y-audit.mjs` — drives Chrome over 44 screen/width/theme combinations and measures 2272 controls and 4764 text elements. ⚠️ **Its `#/muscles` route does not exist and silently renders Home** (found 2026-08-24), so it has been auditing Home twice and **the body map's panel has never been audited at all**. Fix the ROUTES entry to `#/graphs` plus a click on the Muscles segment, or give the router the route. Needs a scratch copy with the config blanked; the header has the commands. **The only thing that can measure contrast against the colour actually painted, or hit-test a touch target** |
| **Render tests** | `npm i jsdom` then `node tests/render.test.mjs` — 367 assertions, mounts every screen. ⚠️ Since 2026-08-24 it holds the two runner assertions that stopped a convenience becoming a lie: that opening set 2 for the first time arrives pre-filled from set 1, and that **a set nobody opened is still not saved** — the eager version of that fill recorded work the lifter had not done, and these tests are what caught it. ⚠️ Since 2026-08-21 it also pins the **view/edit split**: that opening a system is reading it, that a workout can be STARTED from its own screen, that Delete is not in either pinned footer, and that Settings renders inside the demo account. It also holds the one assertion in this project that is a **budget rather than a presence check** — a muscle panel is capped at 40 words, because every other assertion here checks something is THERE and no such check can catch words piling back up |
| **Deploy-notice test** | `node tests/sw-update.test.mjs` — 12 assertions, needs Chrome, **no other dependencies**. Copies the app to a temp dir, serves it, installs the worker, then EDITS A FILE and asserts the page offers a refresh. The one test that cannot be faked |
| **Rules tests** | `npm i --no-save @firebase/rules-unit-testing`, then **`JAVA_HOME` must point at Temurin 21** (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`), then `firebase emulators:exec --only firestore --project demo-test "node tests/rules.test.mjs"` — 46 assertions, who may READ your data. ⚠️ **On the Oracle JDK the emulator dies silently** — see §0.9 |
| **Rebuild the body art** | `python tools/build-body-art.py` — only if the source JPG or the seeds change. Needs `pip install pillow numpy scipy potracer` |
| **Look at it** | headless Chrome — §0.6. Use CDP + `Emulation.setDeviceMetricsOverride` for anything involving input |
| **Firebase** | project `fitness-tracker-th` · [console](https://console.firebase.google.com/project/fitness-tracker-th/overview) · `firebase deploy --only firestore:rules` |
| **Deploy** | commit + push to `main`; Pages rebuilds in ~40–50s |

It needs a server — ES modules do not load over `file://`.

---

## 0. Read this before your first tool call

1. **Git: this folder has its own nested repo.** The parent `Code Projects/` folder is a *separate*
   repo whose remote is `Estimator_Quiz`. **Always run git from inside `Fitness_Tracker/`**, or you
   will commit to the wrong repository.

2. **Don't `cd` outside the workspace in Bash.** Commands that leave the project directory trigger a
   scope check and prompt Tim. Use absolute paths from within the project. He has asked repeatedly
   not to be prompted.

3. **Keep `progress.md` and `chat.md` current without being asked, and push when done.** Tim's whole
   workflow is to reset the chat and say only *"catch up with progress.md"*. If this file is stale,
   the next session starts blind.

4. **The Firebase CLI is installed and already authenticated** as `timhadfield7@gmail.com`. You can
   create projects, deploy rules, and call the admin APIs directly. An access token can be minted
   from the CLI's stored refresh token — that is how Auth providers were configured. Don't assume
   console-only until you've checked.

5. **A browser really does render this app, and can be driven.** Chrome and Edge are both installed.
   Screenshotted and eyeballed across sessions: Home, Workouts, Calendar, Settings, Muscles, the line
   chart, the session runner, the edit-record screen and the account screen, at 360 / 390 / 880 /
   1180 / 1280 px in both themes. **Still unverified: any real device, iOS Safari, touch, and the
   installed PWA.** jsdom is the *structural* check; a screenshot is the *visual* one; CDP is the
   *behavioural* one. Be precise about which you mean — several real bugs this project has shipped
   were invisible to two of the three.

6. **How to actually look at the app.** `--window-size` does NOT change the layout viewport in this
   headless build — it crops the screenshot of a 512px layout, which reads exactly like an overflow
   bug and cost half an hour. Two ways round it:

   - **`<iframe>` of fixed width, screenshot the wrapper.** Works with a plain `--screenshot` run.
   - **Better: drive Chrome over CDP and call `Emulation.setDeviceMetricsOverride`.** That *does*
     change the layout viewport, so no iframe is needed — point it straight at the app. Node 24 has
     a global `WebSocket`, so a CDP driver needs no dependencies: launch with
     `--headless=new --remote-debugging-port=N --user-data-dir=<ABSOLUTE path>`, then
     `Page.enable` → `Emulation.setDeviceMetricsOverride` → `Page.navigate` → `Page.captureScreenshot`.
     Two traps: the debugger attaches to a stray `about:blank` target, so always `Page.navigate`
     explicitly rather than passing the URL on the command line; and a relative `--user-data-dir`
     makes Chrome fail to start at all.

   **Use CDP whenever the thing you are checking involves input.** `dispatchEvent()` from page
   script does not reproduce focus, so it cannot show you a focus ring — that is exactly how the
   white box in the body map survived a screenshot review. `Input.dispatchMouseEvent` does.
   Hit-test before clicking, too: the centre of a muscle's *bounding box* can miss the muscle
   (Chest's lands in the sternum gap). Sample the box with `document.elementFromPoint` instead.

   Also: copy the app to a scratch dir before changing `firebase-config.js`; never edit the real one.
   Blank it (`IS_CONFIGURED = false`) for ordinary layout work. To exercise the CLOUD path — the
   account screen, the offline fallback — write a config that is *shaped* like a real one but points
   at a project that does not exist, so the test can never create a user in `fitness-tracker-th`.

7. **Testing offline: kill the server, do NOT emulate it.** `Network.emulateNetworkConditions` is
   applied **per target**, and a service worker is its own target — so its fetches sail straight past
   the page's emulated offline state. The first version of the offline test passed while the app was
   quietly still loading over the network. Start a throwaway `python -m http.server` on its own port,
   let the worker install, then kill the server. Nothing can fake that. Always include a canary —
   request a URL that cannot be cached and assert it fails — or you are testing nothing.

8. **Chrome's `--user-data-dir` must be a SHORT absolute path.** The session scratchpad is ~180
   characters deep; Chrome appends hashed `Service Worker/CacheStorage` directories under it, blows
   past Windows MAX_PATH, and `caches.open()` fails with "Unexpected internal error". That presents
   exactly as a broken service worker and is nothing of the sort. `C:/Users/timha/AppData/Local/Temp/cdp-<pid>`
   works. A *relative* user-data-dir makes Chrome fail to start at all.

9. **The Firestore emulator dies SILENTLY on the Oracle JDK.** Exit code 4294967295 (−1), an empty
   `firestore-debug.log`, and zero bytes on stdout *and* stderr — no stack trace, no `hs_err` file.
   It presents as a broken install and is nothing of the sort: `java -jar <emulator> --version`
   prints fine, so the JVM and the archive are both sound, and only *serving* dies. **Temurin 21
   works first time.** Both JDKs are installed; point `JAVA_HOME` at
   `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot` before running the rules tests.

   ⚠️ Do not "fix" it with an older JDK: `firebase-tools` refuses to run below Java 21 outright, so
   Temurin **17** — the obvious first guess, and the one recommended for this emulator everywhere —
   is rejected by the CLI before the emulator is even reached. The working window is narrow: **the
   CLI needs ≥ 21 and the emulator jar needs a JDK that is not Oracle's.** Cost about half an hour;
   `docs/social-plan.md` §7.1 lists everything that was ruled out first.

10. **⚠️ Need a populated app to look at? Use the DEMO ACCOUNT — do not hand-seed one.** Every
    session before 2026-08-19 wrote its own throwaway systems and sessions in order to screenshot a
    screen, which is slow and produces data far too thin to exercise the charts, the muscle map or a
    goal. There is now a generated year behind one flag: set
    `sessionStorage['ftrack:v1:demo'] = '1'` and reload, and the store swaps to an in-memory backend
    holding two programmes, ~200 sessions, 20 benchmarks, 53 weigh-ins and a goal part-way through.
    **Nothing it does can reach localStorage or Firestore**, so it is also the safest thing to drive.
    ⚠️ **That sentence was FALSE for months and is true again as of 2026-08-22.** The store swaps its
    backend, but the session runner's draft never went through the store — it went straight to
    localStorage, so running a workout in the demo left invented sets on the real device and they
    survived leaving it. Found by the UX review. The draft now follows the demo flag into
    sessionStorage. **The lesson is about the claim, not the leak**: this file and a strip on every
    demo screen both said "nothing is saved", and the one write that bypassed the store was the one
    nobody thought to check. *An absolute safety claim needs a test, not a design argument.*
    `demo.enter()` / `demo.exit()` in `store.js` do it with a reload. Clear the flag when you are
    done, or your next screenshot is of somebody else's year — and note it is per-TAB, so a fresh
    Chrome profile starts outside it.

    It is also the fastest way to sanity-check a change to any derived number. Running the demo year
    through the real ranking pipeline is what exposed the credibility inversion in §9, which 1069
    assertions had missed for two months.

11. **⚠️ Never bulk-edit a file through PowerShell.** `Get-Content -Raw` in PS 5.1 decodes as ANSI,
    not UTF-8, so a read-modify-write with `Set-Content -Encoding utf8` **double-encodes every
    non-ASCII character in the file** — every em dash, arrow and ⚠️ in these docs. It is silent, it
    touches lines you never edited, and `git diff --stat` is how you notice: a four-line change
    showing 98 changed lines is this and nothing else. Cost about ten minutes on 2026-08-19; both
    files were restored with `git checkout --` and redone through the editor. Use the editing tools
    for file content and keep PowerShell for running things. (Appended at the end for the same
    reason item 10 was: renumbering breaks the §0.6 / §0.7 / §0.9 references used elsewhere.)

12. **⚠️ THE STORE CACHES ITS READS, AND ITS ONE CONTRACT IS THAT THE STORE IS THE ONLY WRITER.**
    Since 2026-08-22 `store.js` keeps each collection in memory, because every tab was re-fetching
    collections it already had and on Firestore each of those is a network round trip. Two things
    follow for anybody working on this:

    - **If you write to `localStorage` directly** — a test seeding old-shape rows, a script setting
      up a scenario — the store will not see it. Call the exported **`clearReadCache()`** and say why.
      Three tests in `data-layer.test.mjs` do exactly this and carry the note.
    - **Cached getters only.** Mutations read straight from the backend on purpose: this store does
      read-modify-write everywhere, and rewriting a whole collection from a stale copy erases
      whatever changed elsewhere. **If you add a mutation, read fresh.** `saveSettings` was the one
      that went through a getter and there is an assertion pinning it.

13. **⚠️ WHEN TIM SAYS SOMETHING IS MISSING OR BROKEN, CHECK THE LIVE SITE BEFORE READING CODE.**
    This has now happened twice in one day and both times the app was fine and his phone was serving
    a cached build — once for the years grid hours after it shipped, once as a Firebase auth page
    filling the screen. **One command settles it:**

    ```bash
    curl -s https://timothyhadfield.github.io/Fitness_Tracker/js/views-data.js | grep -c Years
    curl -s -o /dev/null -w '%{http_code}
' https://timothyhadfield.github.io/Fitness_Tracker/js/year-grid.js
    ```

    Then, if the file is deployed, drive a **clean browser profile at the live URL** (§0.6) — a fresh
    profile has no service worker, so it sees what the server is really serving. Only after that is
    it a code question. ⚠️ **An installed home-screen app resumes on its last page and can be many
    builds behind**; the app now checks for updates on resume, but a build that predates that fix
    cannot help itself.

---

## 1. Working agreement

Tim is the **manager**; Claude is the **builder**.

- Tim describes the vision. Claude designs and implements it.
- **Recommend and proceed — don't ask.** Tim, 2026-08-15: *"Just stick to what you recommend, it's
  going to be better than what I say 90% of the time."* Take that as licence to decide, **not** as
  licence to stop listening — he found the source-mixing bug, correctly diagnosed the level-flipping
  bug, and his percentile spacing held up under modelling. Say so when he is right.
- **Never ask Tim what to work on next.** Questions are only for clarification or a decision *inside
  a job he already gave you*. Between jobs: say what's done, say what you noticed, stop. A question
  box forces him to answer it instead of replying to what you said — and most of the time what you
  want to do next isn't what he wants done next. (Tim, 2026-08-16.)
- **Questions that ARE in scope go in the AskUserQuestion box, never in prose.** Tim often doesn't
  read a full reply.
- **Talk to Tim in plain short sentences. Never say "D5" or "D14" to him** — say the actual thing
  ("we don't mix benchmarks with workout sets"). The decision codes are for these docs only. No long
  progress reports, no headers and sections for an ordinary update. Two lines when the work is done,
  or "X broke because of Y — should we do A or B?" (Tim, 2026-08-16.)
- **Always commit and push when a piece of work is finished — don't ask.** Pages redeploys in ~40s,
  so pushing is how he sees anything. Update the docs in the same commit.
- **State what is unverified.** This project's whole credibility rests on not overclaiming.

### File upkeep

| File | Job |
|---|---|
| `progress.md` | State, decisions, rules, next steps. **The catch-up file.** |
| `chat.md` | Chronological human-readable log, appended after each substantive exchange |
| `docs/vision.md` | **Tim's running list of what he wants this to become.** A capture, not a schedule: nothing starts off it without him saying so. Five ideas. §1.4 and §1.5 are **BUILT**, §1.3 is built bar its "% optimal" number, §1.2 is **half built**, §1.1 is untouched. Entries are marked BUILT in place and never deleted — the superseded reasoning above them is the point of the file |
| `docs/spec.md` | Product + technical spec, data model |
| `docs/research.md` | **All research, by category**, evidence graded 🟢🟡🔴 with sources. Append — never start a new research file |
| `js/preset-systems.js` | Not a doc either, but read its header before adding a system: it records exactly what may and may not be shipped from someone else's programme, and why |
| `js/muscle-evidence.js` | Not a doc, but read it before touching ranking: the ratio tables, the fallback rules and the confidence model all live there with their reasoning |
| `js/optimal.js` | Not a doc. Read it before touching the rating: the dose-response curves are **fitted to published values, with the derivation in a comment on each constant**, and the header lists the three things the rating refuses to do — reward extra training days for growth, extrapolate past the evidence, or imply precision the source lacks |
| `js/volume-map.js` | Not a doc. **⚠️ Not the same table as `muscle-evidence.js`** — that one asks "how strong is this muscle", this one asks "how much work landed here". Direct 1.0, indirect 0.5 |
| `js/social.js` | Not a doc. **Read its header before touching anything social**: it explains why sharing publishes a copy rather than widening a permission, and why the builder is a whitelist — a delete-based one fails OPEN the day somebody adds a field. Wired to `views-social.js` since 2026-08-18, and ✅ **two real accounts connected over the live project on 2026-08-22** — invite, claim, accept, tier, publish, read, downgrade, disconnect, each one checked against what Firestore actually hands the other account. See item 1 for the two defects it turned up |
| `js/set-types.js` | Not a doc. Read its header before touching supersets or drop sets: it explains why they are **two different shapes** and why drops nest inside a set rather than sitting beside it (D23) |
| `docs/strength-map-plan.md` | Design + decisions for the Muscle Groups map. **§7 is where the fill/ink split is explained** |
| `js/demo.js` | Not a doc. The demo account's generated year. **Read its header before touching it**: it explains why the data never touches storage, why the flag is per-tab, and why nothing in it may use `Math.random()`. The switch itself is in `store.js` |
| `js/goals.js` | Not a doc. **Read its header before touching Goals**: it explains why a goal is a LEVEL and not a predicted number of pounds, why the target weight is FROZEN when the goal is set, and the two things the module refuses to do — read the deadline to decide what it asks of you, and emit a verdict |
| `docs/improvement-plan.md` | **The plan, written 2026-08-19 on Tim's ask.** ⚠️ **§0 is the part to read first** — it lists seven reviews that were scoped and briefed and then **all killed by a session usage limit before returning anything**. Sections marked ⚠️ NOT AUDITED are hypotheses, not findings. **Three of the seven have since run and four are left**, and the table in §0 carries each one's status. §1.1 — the first-run path promising "workout" and delivering "system" — was the one finding verified by hand, and it was **fixed 2026-08-21** |
| `docs/fatigue-plan.md` | **Within-session fatigue and the strength estimate**, written 2026-08-24 on Tim's ask after a real back session. **Plan only — nothing in it is built.** ⚠️ **§1 is the part to read**: fatigue does not merely depress a reading, it **promotes** it, because `evidenceWeight` rewards low reps and a spent lifter does few reps. His fatigued third exercise out-ranked his best lift by 0.005, entirely on a rep count. §3 is why no re-weighting scheme is worth more than 5 lb while doing the lift fresh is worth 60, and §4 is why the load multiplier he suggested is the one option that cannot be built honestly today |
| `docs/goals-plan.md` | **Goals** (`docs/vision.md` §1.6). **Phases 1–2 BUILT 2026-08-19 — §11 records what the build decided that the plan did not.** **§3 is still the section to read** — four problems, one serious: raising weights to hit a deadline would hand heavier weights to somebody who has missed two weeks, which is backwards and is the only thing in this project that could cause physical harm. §8 is the progression rule Phase 4 needs. §10 is what may and may not scale with ambition — and §11.4 records where the build departed from it |
| `docs/optimal-rating-plan.md` | **The "% optimal" rating** (`docs/vision.md` §1.3), planned 2026-08-18. **§2 is the part to read** — the evidence says frequency does *not* independently drive hypertrophy, so a rating must not reward training more days; and the models explain only ~a quarter of the variance, which is why the output is a band, never a point |
| `docs/social-plan.md` | **Plan only, written 2026-08-17 on Tim's ask.** Design for `docs/vision.md` §1.1. **§2 is the load-bearing part** — one document per collection means sharing cannot be a permission, so it publishes a derived copy instead (proposed D24). Proposes D25, recommends profile-before-feed so D7 need not be narrowed at all, and §7 is why rules now need the emulator. **§3.3 is Tim's own three visibility tiers**, and **§3.3.1 is why his mid/full cut beat the first draft's** — read it before moving that line |
| `docs/strength-estimate-plan.md` | Mostly plan. §10 (evidence from other exercises) **was built** on 2026-08-17 and that section records how its own ordering turned out to be wrong. §11's simulator is the top open item. Proposes D18 |
| `docs/firebase-setup.md` | Firebase state, and what is still unverified. **Corrected 2026-08-17** — it had claimed for a day that Google sign-in was not enabled, while this file carried a note saying that claim was wrong. The source is fixed; the note is gone |
| `docs/competitive-teardown.html` | Competitive research (published artifact) |

---

## 2. Vision & audience

A **lifting tracker**, web-based, genuinely better than a Google Sheet.

Tim's stated wants: log weight/reps/time for any exercise · track over time including body weight ·
lifting **programs** · enter data **mid-workout** · he cares a lot about **usability and formatting**
and about **scientific accuracy**.

**Minimum bar:** beats Google Sheets. **Stretch:** educate new lifters, ready-made programs.

### Audience (confirmed 2026-08-14)

- **Who:** Tim and friends to start, **open to anyone, potentially many people**
- **Level:** must serve **any level**
- **Goal:** **the user chooses** — hypertrophy, strength, or general fitness

A **product for other people**, not a personal tool. So: onboarding must work for a stranger,
progressive disclosure is core architecture, the dashboard reconfigures around the user's goal.

### Out of scope

**Diet / nutrition — cut** (D1). Point users at Cronometer's free tier.

---

## 3. Current state

| Area | State |
|---|---|
| **Workout systems** | A **system** is a programme — a named group of workouts (Push Pull Legs holding Push, Pull, Legs). The Workouts tab lists systems; open one to see and add its workouts. A workout belongs to exactly ONE system. Workouts saved before systems existed are migrated into **My Workouts** on first read. Deleting a system deletes its workouts but never recorded history |
| **Seeing a deploy** | ⚠️ `sw.js` is stale-while-revalidate, so **the load right after a deploy serves the OLD app** and the change appears on the one after. That is deliberate (a hand-maintained cache version can freeze someone forever; this self-heals) but it is indistinguishable from a broken feature — Tim hit it and reported a rating as missing when it had shipped. Since 2026-08-18 the worker compares ETag/Last-Modified on revalidation and the page shows **"A new version is ready · Refresh"**. It OFFERS, never reloads: reloading unasked is right almost always and catastrophic once, mid-set with numbers unsaved. ⚠️ **AND SINCE 2026-08-22 IT ASKS ON RESUME, which is the case that had been missing entirely.** Every check above hangs off the `fetch` handler, so an update was only ever spotted while the page was requesting assets — that is, on a real page load. **An installed home-screen app is RESUMED, not reloaded**: iOS hands back the document that was already there, nothing is fetched, and the worker is never consulted. So the app could sit weeks behind the live site with the update machinery working perfectly and never once asked. Tim reported it as a missing feature — the years view had been live for hours and his phone had simply never asked. `visibilitychange` and `online` now post `check-assets`, the worker revalidates the shell (throttled to five minutes, silent when offline), and the same offer appears. Proved by a test that finds a deploy **with no navigation at all**, mutation-checked |
| **The system badge** | **Four numbers beside every system, in a 2×2 grid** — on Explore, on the Workouts list and on a system's own screen. **Growth and strength**, separately and never blended, because a programme good for one is often not good for the other (the Golden Six is the clearest case: 35 % growth, 55 % strength); banded to 5, never a point, because the source models explain about a quarter of the variance. Plus, since 2026-08-19 on Tim's ask, **days a week and minutes a session** — the percentages say how *good* a programme is and nothing about what it *costs*, which is the first thing you want before opening it, and "80 % strength" reads very differently at three days a week than at six. A ready-made system states its own minutes; one you typed has them **estimated** from the set count at ~3 min a set, and the cell's `title` says which — "because the author said so" and "because we multiplied" are not the same claim. **Your own systems are rated too**, and the days-per-week the maths needs is MEASURED from your logged sessions rather than asked for; under two weeks of history it assumes one pass a week and says so. A system with no workouts shows no badge rather than a 0 %. The Explore row summary no longer repeats days/minutes now the badge carries them. `js/optimal.js` + `js/volume-map.js`, `docs/optimal-rating-plan.md` |
| **Ready-made systems** | Workouts → **Explore ready-made systems**. Browse, read the whole programme with its per-exercise notes, and copy it into your account. A COPY, not a link — once added it is yours to edit, and it can never change under you, **and it arrives in programme order** (workouts carry an `order`; ones you add yourself have none and land at the end). `js/preset-systems.js` holds **nine**: Jeff Nippard's *Ultimate Push Pull Legs (2023)*, *Dr. Mike's Floating Split*, *Chris Bumstead's 8-Day Split*, Arnold's *Golden Six*, *Mike Thurston's Six-Day Split*, *Volume Landmarks Hypertrophy* (follows Israetel's method — see below), plus three of the app's own (PPL, Upper/Lower, Full Body). Exercises are referenced BY NAME and a test asserts every one resolves. **Nippard's is complete as of 2026-08-19** — all six workouts, Push 1 / Pull 1 / Legs 1 / Push 2 / Pull 2 / Legs 2, in the order the videos were published |
| **⚠️ Half a programme reads exactly like a whole one** | The Nippard system shipped for two days as three workouts declaring **six days a week**, so the rating ran the same three twice and the rotation repeated a day that should have alternated. Nothing failed: the badge was plausible, every test passed, and the screen looked finished. **Tim caught it by reading the sentence** — "why would a push/pull/legs need six workouts?" Two lessons. A count a system *declares* and a count it can *fill* are different numbers and nothing was comparing them; there is now a test that does. And the one shipped as "Pull" was **the second pull, not the first** — the write-ups carry no episode number in their own text, so the order had to be recovered from the video dates. Anything transcribed from a series wants its episode number pinned down before its content is |
| **Three kinds of system, and the line between them** | **OURS** (`author: 'Fitness Tracker'`). **TRANSCRIBED** — `author` is the real person, `unofficial: true`, `sourceUrl` to the write-up; the workouts are genuinely theirs. **METHOD** — `author` stays `'Fitness Tracker'` and a `basedOn: {person, what, sourceUrl}` credits whose idea it is; the screen renders "Follows **X**'s … The workouts below are not theirs." **A person's name never goes in `author` unless they chose the exercises** — "By Dr. Mike Israetel" over a routine he has never seen is a lie no warning underneath can undo. Tests enforce all three, including that the string "By Dr. Mike Israetel" never renders. **Israetel has one of each, deliberately:** *Dr. Mike's Floating Split* is kind 2 — his real training, transcribed — and *Volume Landmarks Hypertrophy* is kind 3, a runnable programme built on the method he publishes for everyone else. Neither substitutes for the other and each says so on screen |
| **⚠️ "No honest source exists" was wrong once** | The Israetel method system was built on the conclusion that no transcribable programme of his existed. Tim said to search harder for reposts and summaries, and he was right: **Renaissance Periodization publish his own split on their own site, free**, and a second write-up agrees with it exercise for exercise. Before inventing a category to work around a missing source, search past the first four queries |
| **What's next** (home) | The big button on Home is **the next workout in your rotation**, not a generic "Start a workout" — `js/next-workout.js`, `docs/vision.md` §1.2 first half. It reads the most recent session, finds that workout in its system, and offers the one after it, **wrapping** at the end. The caption always says what it read ("Next in Push Pull Legs. You did Push 2 days ago"), and **Choose another workout** sits right underneath, so it never traps you. It is a LOOKUP, not advice — the order came from the user's own system, so this is Rule 6-safe in a way that "you should rest today" would not be. It never scolds and never refuses: train twice in a day and it says "You already did Push today — this is next when you are ready". Silent when it would have to guess: no history **and** more than one system means no suggestion at all. Skips past sessions whose workout has since been deleted (D22 keeps the history), rather than dead-ending. **The other half of §1.2 — suggesting the weights and reps — is NOT built and needs the estimator first** |
| **Set types** | **Supersets, tri-sets, giant sets, drop sets and myo-reps** — `js/set-types.js`, `docs/vision.md` §1.5, D23. **In the builder**: a chip on each exercise opens a sheet naming all three set types *and explaining what each one is* (D8 — "myo-reps" is jargon), with a mini-set count under whichever is picked; and a **link control sits in the GAP between two exercises** — "Superset with next" / "No rest — tap to separate" — because a superset is a statement about the space between them, not about either one. A joined block is bracketed by an accent hairline and named for its size. **In the runner**: a superset is walked round by round (A, B, rest, A, B) and the banner sits above the exercise name saying which round and whether to rest; the forward button reads "Straight into Overhead Cable Extension" or "Round 2 of 3". **The rest timer does not start mid-round**, nor after the top set of a drop set — those are the two places where the old "log a number → start resting" rule would have told you the opposite of what the set type means. A nested set's button IS the instruction — "Strip the weight — add a drop" or "Rest 10–15 seconds — add a mini-set" — not the name of a technique. **Drop sets and myo-reps are the same nesting shape**, differing only in what changes between mini-sets, and are stored under `minis` |
| Workout builder | Name, add exercises, reorder, planned set count, per-exercise notes, edit, delete. Lives inside a system — `#/workout/new/<systemId>` to create |
| Exercise library | **272 exercises**, searchable, filterable by muscle group (15 groups incl. Full Body and Cardio; **13 are real muscles**) |
| Custom exercises | User-created; choose tracked fields and how weight is counted |
| Session runner | Builds planned sets, pre-fills last time's numbers, ±steppers, next/back, finish → calendar. **Add set** is a small pill on the right of the "Sets" heading, not a full-width button under the list — under the list it was as loud as the sets and, once the list outgrew the pane, drawn on top of them. **Records for today by default, and the day is editable in the header** for the workout you forgot to log. Future dates refused. The header says NOT TODAY the whole way through rather than springing it on you at the end |
| Load type | Every weighted exercise labelled **PER SIDE** or **TOTAL** |
| Draft recovery | In-progress workout survives an app switch; expires end of day. Expiry is keyed to `startedOn`, **not** the session's date, so back-dating a workout doesn't discard its own draft |
| Benchmarks | Any date, any exercise → feeds Data + calendar. A **workout can be marked a benchmark**, and then every exercise it records files the best set of that exercise as a benchmark for the day (D17) |
| Calendar | ⚠️ **Not its own tab since 2026-08-22 — it is the first segment of DATA**, and its header IS the four-way Data switch, so the two read as one tab. `#/calendar` is still its route, so a day stays deep-linkable. **Two ways to read it, on a Months / Years switch below that.** **Months** is the original: continuous vertical month scroll, sticky headings, opens on the current month, active days filled and named. Open a day → **Edit** a record to change anything about it: its day, its name, its exercises, every set, and whether it counts as benchmarks. **Years** (2026-08-22, Tim's ask with a reference image) draws **one tiny square per day**, one row per year, newest first, with "141 days trained" beside each — years of training on a single screen, and two years fit in the top half of a 375×667 phone. ⚠️ **It is BINARY** — coloured or not — where Months distinguishes workouts from benchmarks, because those two tokens measure ΔE 6.5 apart under protanopia and a 5.7px square has no room for the label or texture that would make a second colour legal. ⚠️ **Tapping a square SELECTS it and does not navigate**: at 5.7px a tap that navigated would open the wrong day about as often as the right one, so it fills a readout line that holds its row whether or not anything is picked, and the readout is the full-width control that opens the day. WCAG 2.5.8 is met by **equivalence** — every day is reachable at 40px in Months, one tap away. `js/year-grid.js` |
| **Data** (nav) | **Four segments since 2026-08-22: Calendar · Graph · Bars · Muscles.** ⚠️ They are not the same kind of thing and the control hides that on purpose — **Calendar is its own ROUTE** (so a day stays deep-linkable and the years grid keeps its state) while the three chart modes are in-page state on `#/graphs`. ⚠️ **"Bar Chart" lost a word**: the 2026-08-21 survey measured the three-segment version clipping that exact label to "Bar Char" at 393px, and a fourth segment takes another quarter of the row. **Graph** (measured SVG line + hover crosshair), **Bars** (paired bars), **Muscles** (body map). **No mode is ever a dead end**: a chart needs the same lift on two different days, so where it cannot draw a line it lists **where every lift stands right now** — best set, estimated max, how long ago — instead of an empty state. No tab is disabled and no mode is force-switched away from. Charts show **one source at a time**, benchmarks by default — an exercise with only workout sets charts those, so graphs already work with no benchmarks at all. What is NOT built is the confidence-weighted estimator and the evidence setting Tim asked for; see `docs/strength-estimate-plan.md` |
| Body weight | Charts through the Graph picker, in a **You** optgroup after the exercises, so it takes no fourth tab and is never the default. Needs two weigh-ins. Direction is **not** judged good or bad |
| Rest timer | Counts **up** from the last set, started by logging a number rather than by a button. Optional target (60/90/120/180s) that only then says the rest is over. Read from a timestamp every tick, never accumulated — a backgrounded tab throttles timers, which is exactly when it matters. Survives an app switch in the draft |
| Units | **lbs or kg**, a display choice only. Everything is STORED in pounds, so switching back and forth is lossless — asserted to the 1e-9 |
| Rep normalisation | Y-axis is always weight; every point converted to equivalent load at one rep count (D11). Target defaults to the most-recorded count, adjustable with arrows. Markers mean measured |
| **Muscles** | **Tim's illustration**, front + back, 18 tappable muscle paths covering 13 groups. **Rated from EVERY exercise that trains the muscle**, not one named lift (2026-08-17) — hammer curls rate biceps, dumbbell rows rate back, seated calf raises rate calves. ⚠️ **Since 2026-08-19 the rating is led by the most CREDIBLE evidence rather than the largest number it produces** — at most three exercises, one seat each, ranked by how much each is worth believing. Before that it picked its top three by converted weight, so a 15-rep face pull outvoted an overhead press benchmark and rated an ordinary lifter Elite; §9 has the write-up and the residuals. Each rating carries a **confidence**, and the muscle's colour is desaturated in proportion: same level, less vivid. The panel says how many sessions AND how many different exercises fed it, because "40 sessions, all of one exercise" is a different claim from "40 sessions across four". See `js/muscle-evidence.js`. Split into a **fill layer** (vector, recolourable, the tap target) and an **ink layer** (greyscale luminance mask carrying every keyline, fibre striation and shadow) — so recolouring a muscle cannot touch its texture. Head, hands, feet and knees have ink but no fill, so they stay unpainted. ⚠️ **Picking a muscle never moves or resizes the body, in either layout** (2026-08-21). On a screen ≥ 860px the detail opens in a **side column beside the figures**; below that it stacks underneath, and the figure holds a fixed 57 % of the pane while the panel takes what is left and scrolls inside itself. Before that fix the phone's figure shrank and rose by however many words the panel happened to have. Each group filled by where it ranks among a comparison group **the user chooses** — "Compared to" in the header opens two presets (**Like me** / **Everyone**) over four axes: population (people who lift / everyone), sex (men / women / both), body weight (mine / any) and age (mine / any). The caption always states the group in words, and says "all adults" rather than "who lift" when the comparison includes people who do not; grey only when that lift has never been recorded. **Ranks from workout sets as well as benchmarks** — source named in the panel — with a hard rep gate: a set above 15 reps is not evidence of a maximum (D5). ⚠️ **Tap → five lines and no more** (2026-08-21, Tim: "we want it to be easy to understand, not a paragraph"): level, estimate + percentile, the bar to the next level, the confidence line, and the set the number came from. The seven-row table of per-level weight targets, the confidence bar and the confidence percentage were cut. **Every caveat survived, one line each** — shortening a caveat is allowed, softening one is not — and a **40-word cap is a test**, because every other assertion on this panel checks something is present and none of them can catch words piling back up. Selection is an accent outline following the muscle's own shape, and the browser's own focus ring is replaced — Chrome draws `outline:auto` around an SVG element's **bounding box**, which put a white rectangle around the selected muscle. |
| **Friends** (was Social) | ⚠️ **No longer its own tab — it is the Friends half of HOME** since 2026-08-22, reached by a You / Friends switch, and the screen is titled **Friends** rather than Social because that is what a person has. `#/social` is still its route. **Mutual friends, and a list you VISIT — there is no feed**, which is how it delivers "see what my friends are doing" without reopening D7. Connect by **invite link** (no user directory, so nothing can be enumerated); links work once and expire in 7 days, and the sender can cancel one before it is used. **You choose per person what they see** — Everything / My workouts / Just that I trained / Nothing — and the picker names and *explains* each, because "mid visibility" means nothing to somebody who has not read the plan (D8). A friend's page shows **their body map in the app's own art and colour ramp**, their recent workouts as one line each, opening to the real structure with supersets and drop sets intact. **What THEY can see of yours sits at the top of their page**, above anything of theirs — the thing you most want to check is what you are giving away. New connections start at the least visible setting, never the last one used. Requires a real account (D25 proposed): an anonymous uid is a browser profile that will be lost, so a connection to one is a connection to nobody |
| **Goals** (nav) | The far-right tab. A goal is **one muscle moving up a strength LEVEL over twelve weeks** — never "+30 lb on your bench", because individual change over 12 weeks runs 0–250 % and no app can promise a number. Pick a muscle, pick a level above it, and the screen states **what it costs** (hard sets a week on that muscle, sessions, minutes, protein, effort, sleep) with a citation on every line, **what your logged sessions are actually delivering** against it, **why progress stalls** — two causes measured, four admitted invisible — and **which programmes fit**, ranked on what they give THAT muscle rather than on their headline rating. ⚠️ **No on-track verdict, and the screen says why**: a day-to-day estimate swings several percent, so a verdict off raw numbers would call a bad Tuesday a failure. The target weight is **frozen** when the goal is set, because the weight behind a level moves with body weight, age and the comparison group. One goal at a time; old ones kept. `js/goals.js`, `docs/goals-plan.md` |
| **Bodyweight lifts rank** | **Pull-ups, chin-ups, dips and push-ups rate a muscle** (2026-08-19). Their resistance is a fraction of body weight plus whatever was added, and the fraction is per exercise. ⚠️ **The pull-up and the dip are 1.00 by STATICS, not by citation** — nothing but the hands is in contact, so the hands carry all of it, and the research confirmed no published %BM figure exists for either. A push-up is 0.75 from two independent force-plate studies half a percent apart (Suprak 2011, Mier 2014); the familiar 64 % and 66 % figures measure *different quantities* and mixing them would be worse than choosing one. ⚠️ **Body weight is read from the DATE OF THE SET**, never today's — otherwise losing twenty pounds would rewrite last year's pull-ups. What has no honest fraction stays refused, permanently and by name: an inverted row is 37–79 % depending on a bar height the app does not record. The panel distinguishes the two kinds of "can't", because "log a weigh-in" is actionable and "nobody has measured this" is not. `js/exercises.js` `BODY_WEIGHT_FRACTION`, `totalResistance()` in `js/e1rm.js` |
| **The map says what it is IGNORING** | A muscle no longer claims "nothing recorded" over work you did. Sets the rating had to discard are listed with the reason — three sets of inverted rows show as uncounted rather than vanishing. Rendered on rated muscles too, not just grey ones: a Back rating built on rows while silently dropping every chin-up is under-reporting its own evidence while looking complete |
| **Progression** (Goals Phase 4) | **Double progression, in the session runner** — hold the load and add reps; at the top of the range on **two consecutive sessions** take the smallest increment inside **2–10 %** and drop to the bottom of the range. Says so when **no honest increment exists** (5 lb on 30 lb is a 17 % jump), and distinguishes "past the band" from "inside the band but bigger than we allow for isolation work". ⚠️ **`js/progression.js` has NO CLOCK and imports nothing from `goals.js`** — §3.1's refusal is structural, not a promise. Time enters as one day count and **may only SUPPRESS a suggestion, never raise one**: after a long gap it offers last time's numbers and says why, prescribing no deload because nobody has measured one. Swept over 10,692 calls — a gap never yields a heavier suggestion than the same history without one. Weighted pull-ups get the full rule via total resistance (5 lb on a 25 lb belt is 2.4 % of ~205 lb, not 20 % of 25); reps-only movements get "one more rep". ⚠️ **The rep range is read across the recent history, NOT from the last session alone** — `trainingRange()`, fixed 2026-08-20. Read from one session, the app's own "back to 8 reps" came back next time as the top of 6–8, and an obedient lifter was moved out of 8–12 for good and given weight every second session. History may only ever widen the range *upward*, so the fix is structurally incapable of proposing a heavier weight than the old code did — the same asymmetry the lay-off rule has |
| **What the strength score cannot see** | ⚠️ **On screen, in words, not in a tooltip.** A planned workout stores a set count and no weight or rep range, so **3×20 and 3×5 get the same strength percentage** — and load is the single biggest thing there is for strength (SMD 0.60 vs 0.12 for growth). Stated on the system screen and under the Explore list, because `title` does nothing on a phone and a phone is where this app is read. The same treatment for the **0.5 indirect-set weight**: kept, because it is the best-supported method actually tested, but the screen now says it is a modelling choice and that counting indirect work lower would drop several percentages a band |
| Profile | Gender, birth year, **body weight as a dated series**. Names what is still missing rather than failing silently |
| Offline UX | When the cloud is unreachable the app says **why**: `navigator.onLine` for the obvious case, plus a cache-busted same-origin **probe** because onLine is true for a captive portal or a dead upstream. It names the last signed-in account so an offline session doesn't look logged out, retries in place rather than reloading, and reconnects by itself on the browser's `online` event. Raw errors live behind a collapsed disclosure, never in the headline |
| **Demo account** | Account → **View demo account**. A generated year — two programmes, ~200 sessions, 20 benchmarks, 53 weigh-ins, a goal 16 % of the way through — so every screen has something in it. ⚠️ **In-memory only.** `store.js` swaps its backend for a Map, so there is no tap sequence — editing, deleting, importing, "delete all data" — that can reach a real record. The flag is in **sessionStorage**, so the demo cannot follow you into a new tab or survive closing the browser; that is the safety decision, because "opens the app tomorrow and sees a year they did not do" would be far worse than the feature is worth. A reload reseeds from the same default. **Social is refused** at `republish()`, not just on the screen. `js/demo.js` |
| Accounts | Anonymous-first; email upgrade preserves uid *and* data; sign-in, password reset, change password, delete account, sign-out, local→cloud merge, automatic adoption of local data. Falls back to local storage if the cloud is unreachable |
| Google sign-in | **Exactly one popup, ever.** Recovering from "that account already exists" reuses the credential from the failed link (`signInWithCredential`) instead of opening a second window the browser would block. A cancelled sign-in never dead-ends: it says so, and offers **Continue in this window instead** — but ⚠️ **only where that redirect can actually finish**, which this configuration is not, so here it names **email** instead. ✅ **Works on a real iPhone in the installed home-screen app** (2026-08-22), which is the path this file spent months calling the riskiest untested one; the popup is what runs there, and the belief that an installed iOS app blocks popups was simply wrong |
| Profile button | True top-left — beside "Fitness Tracker" in the desktop sidebar, in the header on mobile, never both. Red dot when data is not backed up |
| Settings | Dark/light, **lbs/kg**, profile, account, export/restore backup, delete all |

**Stepper increments:** reps ±1 · weight **±5 lbs or ±2.5 kg** · time ±10 sec · distance ±0.1 mi.
Press-and-hold repeats.

### Verified

- ✅ **ON A REAL IPHONE, 2026-08-22 — the only two things in this list a device has ever confirmed.**
  In the app **installed to the home screen**: the **keyboard fix** holds (*Next exercise* reachable
  in the session runner with the keyboard up, and the exercise picker usable), and **Google sign-in
  completes**. ⚠️ **Read the scope narrowly.** This was one person, one phone, one surface, and two
  questions — it says nothing about touch targets, about a Safari tab, or about any of the three
  survey items still marked reasoned-not-measured. **Everything else in this list is still a
  desktop engine, jsdom, or an emulator**
- All **22 JS modules** pass syntax check; the whole import graph resolves under a stub DOM
- **The ranking model's five new regression assertions** (`tests/data-layer.test.mjs`) — the ones
  that were missing. ⚠️ **1051 assertions ran green over this bug for two months**, and the reason is
  worth knowing: every multi-observation test used three DIFFERENT exercise ids with estimates a
  couple of pounds apart, so neither half of the fault could show — not one exercise filling every
  slot, and not a flattering conversion outvoting a credible one. The new ones use the shapes real
  data produces: a low-quality high-rep observation beside a high-quality benchmark, and one exercise
  logged on more days than another. **Mutation-checked** — reverting the sort line flips exactly
  those five and nothing else
- **53 demo assertions** (`tests/demo.test.mjs`, no dependencies) — and the two that matter are
  **determinism** and **plausibility**. The same day must build a byte-identical year, with a
  companion check that a different day *does* move it so the first is not vacuous; that is what makes
  "resets to the default" literal rather than approximate. Plausibility is checked against the app's
  OWN modules rather than by eye — the bench estimate ranks somewhere with room above and below, the
  logged volume lands in a believable band, and the goal's starting figure equals what the muscle map
  said on the day it was set. That last one is a regression test: the first version built the goal
  from the bench press alone while the map rates Chest from every chest exercise, so the demo opened
  on a goal already reading "Target reached" with the map beside it disagreeing
- **The demo driven end to end in a real browser** — 2026-08-19. Real data seeded first, then the
  button clicked: the demo could not see it (`demoSeesRealSystem: false`), it was still on disk
  (`realStillOnDisk: true`), renaming a system inside the demo wrote nothing to localStorage
  (`wroteToDisk: false`), a reload restored the default, and leaving brought the real account back
  intact. Every tab screenshotted at 390 px plus the muscle map and the desktop layout
- **88 goals assertions** (`tests/goals.test.mjs`, no dependencies) — and the two that matter are
  **refusals**, the same shape as `optimal.test.mjs`'s three. ⚠️ **Nothing reads the calendar to
  decide what is asked of you**: two goals with identical numbers and start dates eleven weeks apart
  must produce byte-identical requirements, with a companion assertion that a bigger *jump* does move
  the band, so the first cannot pass vacuously. That test fails the moment anything scales a
  requirement by how far behind schedule somebody is — which is `docs/goals-plan.md` §3.1, the only
  thing in this app that could cause physical harm. ⚠️ **And no verdict**: `goalProgress()` for
  somebody four days from the end having added nothing carries no key matching
  `verdict|behind|ahead|status`. Also pinned: 0.73 g/lb converts to the published 1.62 g/kg and 1.0
  to 2.2; protein is the SAME at Steady and Committed, which is what proves it is a threshold rather
  than a dial; the sleep and effort text is byte-identical across every band; and the stall walk has
  a **vacuity guard** — the same walk over adequate training must read OK
- **1103 data-layer assertions** (`tests/data-layer.test.mjs`, no dependencies) — including both
  directions of the art↔standards invariant: every drawn muscle is rankable or declared unrankable,
  **and** every rankable muscle is actually drawn with real geometry. A regeneration that dropped a
  muscle group would otherwise fail silently on a screen nobody re-checks
- **⚠️ `COLLECTIONS` in `store.js` is now checked against `knownCollection()` in `firestore.rules`.**
  This file has warned in prose since the beginning that adding a collection to one and not the other
  has every cloud write DENIED while localStorage keeps working — perfect on the machine it was
  written on, silently lossy for anyone signed in. It was never a test until `goals` was added on
  2026-08-19. **Mutation-checked**: removing `'goals'` from the rules flips exactly that assertion
- **292 render assertions** (`tests/render.test.mjs`, jsdom) — every screen mounts, tapping a muscle
  opens its detail, the SVG line chart genuinely runs (gridlines, one marker per measured point,
  correct aria label), and **every ink mask reference resolves to a mask in the same SVG**. That last
  one matters: if the mask or its image goes missing the figure renders as flat silhouettes with no
  detail at all, which is the one failure that would not look like a bug in a screenshot
- **Screenshots, headless Chrome** — Home, Workouts, Calendar, Settings, Muscles and the line chart
  at 360 / 390 / 880 / 1180 / 1280 px in dark and light. Layout holds, nothing overflows, the legend
  wraps, and the Muscles side column holds its figure size whether or not a muscle is selected
- **Driven over CDP with real mouse events**, not synthetic ones — 2026-08-17: the session screen's
  Add set pill (hit-tested, 6 sets → 7), the Compared-to sheet (picking Women moved Chest
  Intermediate → Elite and the caption followed; the Everyone preset set all four axes), the systems
  list and one system, and Explore → a preset → Add, landing in the copied system with its notes
  intact. Confidence was checked from **computed styles**, not by eye: two muscles at one level and
  different confidences differ only in chroma, with identical lightness and hue.
  Later the same day: Explore → Thurston → **Add** → the copied system → its Conditioning workout
  (the first preset workout made of cardio rather than lifts), and the same for the 8-exercise
  Upper B. **This is what caught the alphabetical-order bug** — every test passed, every screenshot
  looked right, and the programme was still arriving shuffled
- **Home's "what's next" driven through all four of its states** at 390 and 1180 px — empty account,
  programme added with no history, one workout recorded two days ago, and the end of the rotation
  wrapping back to the first. The button and the caption moved together every time
- **Set types driven end to end with real mouse events** at 360 / 390 / 1180 px: link two exercises
  in the builder, tap an exercise into a drop set, save, run the workout, confirm **the rest timer
  stays at `--:--` mid-round and starts only after the last exercise of the round**, walk into round
  two, add a drop, then read the record back on the calendar day and through the edit form. Saving
  the edit form unchanged preserves groups, set types, set counts and drops exactly. **This pass is
  what caught the builder writing into a copy** — every control looked right on screen and none of
  them saved anything
- Every class referenced in JS has a matching CSS rule
- All assets serve 200 with correct MIME types from Pages
- **46 rating assertions** (`tests/optimal.test.mjs`, no dependencies) — the curves are checked
  against the PUBLISHED FIGURES, not just against their own slopes: a curve fitted to a slope can
  match it perfectly and still be the wrong curve, so the hypertrophy model must also reproduce the
  ~5-6 % at 12 sets and ~10.5 % at 42 that the paper plots, and the strength frequency model must hit
  12.72 % and 17.32 % exactly. The three refusals are asserted directly — **the same 12 sets spread
  over 3 days scores identically for growth and higher for strength**, 100 sets scores as 42, and 83
  and 87 both band to 85
- **49 volume-mapping assertions** (`tests/volume-map.test.mjs`, no dependencies) — the direct/
  indirect classifications the source paper states outright are pinned as tests, the conservative
  fallback is proved conservative, and the published efficiency tiers are asserted at their
  boundaries. **Two guards worth keeping**: a fabricated 60-sets-a-week programme must land in
  "beyond the evidence" rather than in a better tier (the "more is always better" failure this
  rating exists to avoid), and Bumstead's 8-day cycle must produce *lower* weekly volume than the
  same workouts counted as a week. Sanity-checked against all nine shipped systems — the 1960s
  Golden Six totals 29 fractional sets a week against Thurston's 147, and the programme built on
  volume landmarks reaches the minimum effective dose in 10 of 11 scored muscles
- **73 social assertions** (`tests/social.test.mjs`, no dependencies) — what a person SHARES. The
  load-bearing one is an **absence** check: the light projection is walked and required to contain no
  numeric leaf below the workout name, run against a session carrying a superset, a drop set and a
  myo-rep still stored under the legacy `drops` key. It has a **vacuity guard** — the identical walk
  over the identical sessions at mid must find numbers (it finds 18), so "none at light" is a result
  rather than a walk looking in the wrong place. Also asserted: an email address handed straight to
  the builder never reaches the output, body weight stays out even at full unless separately enabled,
  and a stored tier that is not recognised degrades to the *safest* value rather than the nearest
- **The Goals screens driven in a real browser over CDP** — 2026-08-19, at 360 / 390 / 1180 px in
  both themes, against a scratch copy with the config blanked. Seen: the empty state, both picker
  steps, a goal set with a **real mouse click** on a level, all four scroll positions of the goal
  screen, the stalls screen and the programme matcher. **Two defects came out of it and neither was
  visible to jsdom.** A multi-word `.tag` **split into two pills** — the background and both rounded
  ends are painted per line box, so "grows with the goal" rendered as a chip reading GROWS above a
  chip reading WITH THE GOAL, reading as two unrelated labels; fixed with `white-space: nowrap` on
  `.tag` app-wide and confirmed from `getClientRects()`, which is the only thing that tells you a
  chip occupies two line boxes. And a **phrase dropped into the numeric column** — "Within 1–2 reps
  of failure" in a column sized for "7–10" took 300 px and squeezed the label beside it into a
  five-word-tall stripe. Also confirmed here: the nav fit at 360 px with no label clipped — six tabs
  then, five since 2026-08-22
- **The Social screens driven in a real browser over CDP** — 2026-08-18, at 390 and 1180 px in both
  themes, against a scratch copy whose `social` facade is stubbed, so nothing touched the live
  project and no account was created. Seen: the friends list with all four visibility settings, the
  waiting-to-be-added row, an unused invite link with its Cancel, a friend's page with **their body
  map rendering in the app's own art**, and the visibility sheet with its four explained options.
  **Two real defects came out of it and neither was visible to jsdom**: friend rows were underlined
  (they are anchors, and the app's other lists are buttons), and the visibility description clipped
  to *"…your muscle map and your pr…"* on a phone — the one row on that screen where the detail is
  the point. Both fixed and re-checked from **computed styles**, not by eye
- ⚠️ **And the trap that nearly hid the fix:** the scratch copy ships the service worker, so the
  second screenshot run was served the FIRST run's CSS out of cache and showed the bug as still
  present. A screenshot of a stale cache looks exactly like a fix that did not work. Use a fresh
  `--user-data-dir` per run
- **46 rules assertions against the real rules engine** (`tests/rules.test.mjs`, Firestore emulator)
  — **the first tests in this project that run as somebody who is not you.** Everything else asserts
  a number; a permission can only be tested by attempting it as another user and being refused, which
  nothing here could do before. The suite leads with denials on purpose: *a rule that permits
  everything passes every positive test*. The load-bearing one is a regression test rather than a new
  feature — **a full-tier friend still cannot read the private sessions document** — because the one
  unacceptable outcome of adding social was that it widened the old paths. Also refused: a stranger
  adding themselves to a viewers list, a viewer listing which tiers exist, anyone listing another
  person's invites, and a claimer extending an invite's expiry on the way past.
  **Mutation-checked:** deleting the `diff().affectedKeys()` line flipped exactly one assertion from
  denied to allowed and left the rest passing, so that test is not vacuous and that rule line is
  provably load-bearing
- **Firebase, 45 checks against the live project.** `js/firebase-backend.js` itself was exercised —
  its gstatic imports redirected to a local SDK — not a lookalike: anonymous sign-in, read/write
  round-trip, `serverTimestamp()` satisfying the rules, anonymous→email linking preserving uid and
  data, sign-out, sign-back-in, password change, account deletion leaving no data, error mapping.
  Seven rule violations all refused. Test users and documents deleted.
  ⚠️ **This line used to end "the project holds zero users and zero documents", and that stopped
  being true the moment Tim signed in.** On 2026-08-22 it held **7 users and 19 documents**,
  including his two real accounts and their training. It was still being quoted as "zero" in a brief
  handed to an agent whose job involved deleting things — so **snapshot the real baseline and diff
  against it; never clean up to an absolute.** A true statement about a live project has a date on
  it or it is a trap.

### NOT verified

- **⚠️ ACCESSIBILITY IS PART-AUDITED as of 2026-08-20, and the part that ran FAILED.** Contrast,
  touch targets, accessible names and horizontal overflow have now been measured in a real browser
  across 44 screen/width/theme combinations — see the section above; `--ink-faint` failed AA
  everywhere it was used and every label in the app named nothing. Both fixed and re-measured.
  ⚠️ **Four things were NOT checked and remain completely unknown: no keyboard path has been walked,
  no screen reader has ever been run against this app, nothing has been tested at larger text, and
  the muscle map's irregular-SVG tap surface was not hit-tested.** The nav bar at 360 px was
  confirmed to fit and not overflow, which is a layout fact and not a touch one. **Do not let
  "contrast passes" stand in for "accessible"** — they are different claims, and this file's whole
  discipline is not confusing them.
- **⚠️ The 2026-08-19 code is PART-reviewed as of 2026-08-20.** `js/progression.js` — the one that
  matters, because it is the only part of this app that can cause physical harm — **has now been
  attacked, and it broke**: the rep range collapsed under the module's own advice (see the 2026-08-20
  section). Fixed, swept and mutation-checked. **`js/strength-estimate.js` and the body-weight work
  across four modules have still not been attacked by anybody trying to break them.** They pass every
  assertion in the suite and each was driven in a browser by its author, which is exactly what progression had
  too the day before it turned out to be wrong. **The count is not the point** — passing a suite its
  own author wrote is not the same as surviving somebody trying to break it.
- **Almost everything about a real device.** ⚠️ **A phone has now opened the app exactly once
  (2026-08-22) and settled exactly two things** — the keyboard fix and Google sign-in in the
  installed PWA, both moved to Verified. **Everything else on this line stands:** touch targets,
  `adoptLocalData()` against real local data, and how the app behaves in an ordinary **Safari tab**,
  which is now the *less* tested of the two surfaces. Headless Chrome covers desktop-engine layout
  only. Of the four survey items that are reasoned rather than measured, **three are still
  reasoned** — haptics (iOS has no Vibration API), the long-press callout, and the native date
  control — plus the open half of the fourth: whether the picker's `setTimeout` focus raises the
  keyboard **by itself**, which the device visit did not record either way.
- ~~**⚠️ THE KEYBOARD FIX IS SHIPPED AND UNPROVEN.**~~ ✅ **CLOSED 2026-08-22 — see Verified.**
  `--kb`, written from `window.visualViewport`, was the largest structural change the phone work
  made, and it was verified only by driving the variable by hand until a real iPhone confirmed both
  cases the survey named.
- **⚠️ NO TWO ACCOUNTS HAVE EVER CONNECTED.** Social is built and every screen has been driven in a
  browser — but against a **stubbed** `social` facade, so the actual round trip (create an invite,
  open it as somebody else, claim it, accept, publish, read the other person's page) has never run
  end to end against Firestore. The rules half of it is genuinely tested, with hand-written
  documents; the app half is reviewed code. This is the same shape of gap `firebase-backend.js`
  carried before the 45 live checks closed it, and it wants the same treatment: two throwaway
  accounts against the live project, then delete them.
- ~~**⚠️ GOOGLE SIGN-IN DOES NOT WORK ON IOS**~~ ✅ **IT WORKS — installed PWA, 2026-08-22.** Broken
  when reported on 2026-08-21 (popup opens, closes, nothing happens) and fixed by the third pass
  moving the installed PWA off `signInWithRedirect`, which a cross-origin `authDomain` genuinely
  cannot finish, onto the popup, which a device now says works. ⚠️ **Two narrower things are still
  NOT verified and are easy to over-read:** Google sign-in in an **ordinary Safari tab** since the
  fixes shipped — the surface the original report probably came from — and the **redirect** path,
  which remains unusable in this configuration on any current browser and is deliberately not
  offered where it cannot complete.

---

## 4. Architecture

**No build step, no dependencies in the app.** Plain ES modules. Serve the folder and it runs.
(jsdom is a *test-only* dependency and is not required for `data-layer.test.mjs`.)

```
Fitness_Tracker/
├── index.html · manifest.webmanifest · icon.svg
├── sw.js                       service worker — what makes D6 true. Precaches the
│                               shell; stale-while-revalidate, NOT cache-first
├── firestore.rules             THE thing protecting user data
├── firebase.json · .firebaserc  so `firebase deploy` needs no flags
├── progress.md  ← this file · chat.md · README.md
├── Human_Muscle_Groups.jpg     body-map source, Tim's own. GIT-IGNORED (*.jpg)
├── img/ink-front.webp          the body map's ink layer, ~100 KB each. GENERATED
│   └── ink-back.webp           the only binary assets in the app
├── tools/build-body-art.py     regenerates js/body-art.js + img/ink-*.webp from the
│                               JPG. Dev-only; needs pillow/numpy/scipy/potracer
├── tools/strength-sim.mjs      THE SIMULATOR. A virtual lifter with a KNOWN 1RM
│                               curve, logging realistically. Deterministic —
│                               mulberry32, never Math.random()
├── tools/strength-fit.mjs      re-runs every sweep the estimator's constants
│                               came from, so a later session can re-derive
│                               rather than trust
├── css/app.css                 ALL styling. Mobile-first; desktop in one media query
├── js/
│   ├── app.js                  hash router + boot
│   ├── store.js                data layer — async, backend-agnostic. Holds
│   │                           the READ CACHE: getters are served from
│   │                           memory, mutations always read fresh,
│   │                           because a read-modify-write from a stale
│   │                           copy erases whatever changed elsewhere
│   ├── e1rm.js                 rep normalisation — pure maths (D11)
│   ├── strength-standards.js   percentile ranking — pure maths (D15)
│   ├── preset-systems.js       ready-made systems to browse and copy. Shaped so a
│   │                           third-party one can slot in: author/sourceName/sourceUrl
│   ├── next-workout.js         where you are in your own rotation — pure, clock
│   │                           passed IN. vision §1.2 first half. Builds its own
│   │                           caption so the sentence cannot drift from the answer
│   ├── set-types.js            supersets/tri-sets (grouping) and drop sets
│   │                           (nesting) — pure. Owns the walk the runner
│   │                           follows and the one-drop-set-is-one-hard-set rule
│   ├── demo.js                 THE DEMO ACCOUNT'S YEAR — pure, deterministic,
│   │                           seeded. Never Math.random(), or "resets to the
│   │                           default" stops being true. The SWITCH lives in
│   │                           store.js; this file only builds the data
│   ├── strength-estimate.js    THE ESTIMATOR — pure, clock passed in. Phase 0:
│   │                           IMPORTED BY NOTHING IN THE APP on purpose.
│   │                           Its constants are FITTED to tools/strength-sim,
│   │                           not reasoned — and the ones that could not be
│   │                           fitted say so on the constant
│   ├── progression.js          DOUBLE PROGRESSION — pure, and deliberately
│   │                           NOT part of goals.js. No clock, no import from
│   │                           goals.js, so "a deadline may not make this ask
│   │                           for more" is structural. Time may only ever
│   │                           SUPPRESS a suggestion, never raise one
│   ├── goals.js                GOALS — pure. A goal is a LEVEL, never a predicted
│   │                           number of pounds. Refuses two things: reading the
│   │                           deadline to decide what it asks of you (that
│   │                           would push hardest on somebody coming back from
│   │                           a lay-off), and emitting an on-track verdict
│   │                           (gated on the estimator)
│   ├── social.js               VISIBILITY TIERS + the projection builder — pure.
│   │                           Wired to views-social.js since 2026-08-18, but
│   │                           ⚠️ NO TWO ACCOUNTS HAVE EVER CONNECTED — every
│   │                           screen was driven against a STUBBED facade.
│   │                           Sharing publishes a derived copy; it never
│   │                           widens a permission on the private data. Built
│   │                           by whitelist, never by deleting fields,
│   │                           because deletion fails OPEN
│   ├── muscle-evidence.js      WHICH exercises rate WHICH muscle, the ratios
│   │                           between them, and the confidence model — pure maths
│   ├── optimal.js              the "% OPTIMAL" RATING — dose-response curves
│   │                           fitted to published values, clamped at the top
│   │                           of the evidence, banded to 5. Pure maths
│   ├── volume-map.js           HOW MUCH WORK landed on each muscle — direct 1.0,
│   │                           indirect 0.5, plus the published efficiency
│   │                           tiers. ⚠️ NOT the same table as muscle-evidence:
│   │                           that asks "how strong", this asks "how much work"
│   ├── year-grid.js            THE CALENDAR'S YEARS VIEW — pure, clock passed
│   │                           in. A year as columns of weeks, Monday first,
│   │                           with the month-label columns. Binary on
│   │                           purpose: one square means "trained", because
│   │                           two hues are not separable at 6px
│   ├── units.js                lbs/kg — pure maths. EVERYTHING IS STORED IN POUNDS;
│   │                           converts only at the edges, so switching is lossless
│   ├── body-art.js             GENERATED traced muscle paths — do not hand-edit
│   ├── body-map.js             composes the fill paths + the ink masks
│   ├── exercises.js            270-exercise library + load-type rules
│   ├── ui.js                   el(), icons, sheets, toasts, steppers, screenShell, profileButton
│   ├── views-workouts.js       home, the RECORD tab (StartPickerView — the
│   │                           workout list plus the benchmark action),
│   │                           SYSTEMS list, one system, workout builder,
│   │                           Explore ready-made systems, exercise picker
│   ├── views-session.js        session runner, benchmark form
│   ├── views-data.js           calendar, day detail, Data screen, settings
│   ├── views-muscles.js        the Muscles pane
│   ├── views-social.js         the FRIENDS half of Home, a friend's page,
│   │                           accepting an
│   │                           invite. Reads ONLY published copies — it cannot
│   │                           reach anybody's private data even if it tries
│   ├── views-goals.js          the Goals tab, the two-step picker, why progress
│   │                           stalls, and programmes that fit the goal
│   ├── views-edit-session.js   editing a workout already recorded (calendar → day → pencil)
│   ├── views-profile.js        gender, birth year, body weight
│   ├── views-account.js        account, sign-in, upgrade-from-anonymous
│   ├── firebase-config.js      REAL KEYS — project fitness-tracker-th, live
│   └── firebase-backend.js     Firestore + auth adapter
├── tests/
│   ├── data-layer.test.mjs     1103 assertions, no dependencies
│   ├── bodyweight.test.mjs     153 assertions, no dependencies — the fractions,
│   │                           their sources, and what stays REFUSED
│   ├── strength-estimate.test.mjs  72 assertions — measured simulator outcomes
│   ├── social.test.mjs         73 assertions, no dependencies — what is SHARED
│   ├── goals.test.mjs          88 assertions, no dependencies — the requirements
│   │                           model, and the two REFUSALS
│   ├── demo.test.mjs           53 assertions, no dependencies — the demo year is
│   │                           deterministic, and plausible enough that the
│   │                           app's own analysis of it is not nonsense
│   ├── optimal.test.mjs        46 assertions, no dependencies — the curves
│   │                           reproduce the PUBLISHED figures, plus 3 refusals
│   ├── year-grid.test.mjs      45 assertions, no dependencies — every day of
│   │                           the year drawn exactly once (leap years, a
│   │                           Sunday opening), every square in the row its
│   │                           weekday really falls on, every month label on
│   │                           its own month
│   ├── volume-map.test.mjs     49 assertions, no dependencies — direct/indirect
│   ├── rules.test.mjs          46 assertions — who may READ it. Needs the
│   │                           Firestore emulator and Temurin 21 (§0.9). RUN and
│   │                           mutation-checked 2026-08-18
│   ├── sw-update.test.mjs      8 assertions — needs Chrome. Edits a file and
│   │                           asserts the page offers a refresh
│   └── render.test.mjs         292 jsdom assertions — mounts every screen
└── docs/  spec.md · research.md · vision.md · strength-map-plan.md · goals-plan.md
         strength-estimate-plan.md · optimal-rating-plan.md · social-plan.md
         firebase-setup.md · competitive-teardown.html
```

### Key patterns

- **Everything goes through `store.js`.** Async API, so the backend swaps without touching views.
  `BACKEND = 'auto'` — cloud when `firebase-config.js` has keys, local otherwise, **and local as a
  fallback if the cloud fails** (D13).
- **Hash router** in `app.js`. Routes in `FULLSCREEN` hide the nav and take the `no-nav` class
  (which owes the iPhone safe-area padding).
- **`screenShell({ title, sub, back, actions, top, scroll, bottom, profile })`** builds every screen.
  `title` accepts a string *or a DOM node*, letting a screen put its primary control in the header.
- **Charts are hand-rolled.** SVG line chart in `views-data.js`; bar chart in HTML/CSS; body map in
  `body-map.js`. No charting library.
- **`el(tag, props, ...children)`** is the DOM builder. `class`, `text`, `html`, `dataset` and `onX`
  are special-cased; falsy children skipped.
- **⚠️ Use `setChildren(node, ...)`, never `node.replaceChildren(...)`.** `replaceChildren`
  stringifies anything that is not a Node, so a `cond ? el(...) : null` child renders the literal
  text **"null"** on the page — which it had been doing under the exercise name on the session
  screen for every exercise without a note. `el()` guards this; the direct calls did not.
- **⚠️ `.pane-scroll` is a COLUMN FLEX container, so its children shrink.** A child that sets
  `min-height: 0` loses the `min-height: auto` protection and gets crushed *below its own content
  height* as soon as the pane overflows — the child's rows keep their size, spill out of the shrunken
  box, and whatever comes next is painted on top of them. This shipped: on a 360×640 phone with six
  sets, the session screen's "Add another set" button was drawn over set 4 and hid sets 5 and 6.
  Anything tall inside a pane wants `flex: none`, and `min-height: 0` belongs only on a child that
  also handles its own overflow.
- **⚠️ A BOOLEAN SET BEFORE AN `await` MARKS THE WORK DONE AT THE MOMENT IT STARTS.** This project
  has now met this three times and it presents differently each time, so learn the shape rather
  than the symptom. `MemoryBackend.seed()` did `this.seeded = true` and *then* awaited, so every
  concurrent caller skipped the wait and read rows that were not there — and `muscleStrength()` is
  exactly that caller, four reads in one `Promise.all`. **Entering the demo could show the muscle
  map asking for a body weight on an account holding 53 weigh-ins**, then correct itself on the
  next render, which is precisely why no screenshot review caught it. The fix is to hold the
  PROMISE and return it, not a flag — and to clear it on rejection, or one transient import failure
  latches the demo broken forever. `tests/demo.test.mjs` reproduces the race in the shape the app
  produces it; reverting the fix gives 0 sessions and a profile missing gender and body weight.
- **⚠️ A read-modify-write migration must be SINGLE-FLIGHT.** `ensureSystems()` reads two
  collections, decides, and writes both. Two callers running it at once each read "no systems", each
  created one, and the second write clobbered the first — leaving the list pointing at a row that no
  longer existed and every workout stamped with a dead id. It presented as an empty system list that
  said "Not found" the moment you tapped it. `WorkoutsView` asking for systems and workouts in one
  `Promise.all` is exactly that case, and is a perfectly reasonable thing for a view to do. There is
  a test that fails if the single-flight guard is removed.
- **⚠️ A "merge two things" operation must merge the whole of both, not the two items either side
  of the seam.** `toggleLink` stamped the new group id on the exercise on each side of the boundary
  only, so joining two adjacent supersets left the far end of the right-hand block on its old id —
  where it was then a group of one and got dissolved. Joining two supersets silently un-supersetted
  the last exercise. It now walks each side's run to its end first. Found in review, not by use.
- **⚠️ Anything that DROPS rows must ask what the survivors were pointing at.** Both save paths
  discard entries with no numbers in them, and the edit form can remove one outright — either leaves
  the other half of a superset still carrying `group`, and the day view brackets it alone and calls
  it a "Superset". `dropOrphanGroups()` runs on both save paths. The general form: a foreign key
  into a set of rows is only valid while the rest of that set still exists.
- **⚠️ A view that renders from a DERIVED list must still write to the original.** The workout
  builder draws from `blocksOf(draft.exercises)`, and `blocksOf` maps over the list — so the `item`
  inside a block is a **copy**. Every handler that closed over it (the set-type chip, the sets
  stepper, the notes box) wrote into a throwaway object and did nothing at all. jsdom did not catch
  it because the first tests read the screen, which re-rendered from the unchanged draft and looked
  right; **a real click in a browser is what found it**. The rule: a derived structure is for
  LAYOUT, and mutation goes back through the index into the source array. The builder tests now
  assert by reading the workout back from the store, and were checked to fail when the bug is
  reintroduced — a test that passes either way is worse than none.
- **⚠️ A UTC timestamp is not a local date, and a test that mixes them is green by time of day.**
  `startedAt` is a UTC instant (`new Date().toISOString()`); `todayISO()` is the LOCAL day. A render
  test compared `startedAt.slice(0, 10)` to `todayISO()` and so failed every evening after 18:00
  here — UTC had rolled into tomorrow while local had not — and passed again each morning. It was
  green when this session started and red an hour later with nothing touched in between. **The app
  is fine**: day logic runs off `startedOn`, which is local, and `startedAt` is never compared to a
  local date anywhere. The test now asserts what it actually meant — that `startedAt` is within
  minutes of real time and did *not* get dragged back to the back-dated day. Anything comparing a
  stored timestamp to a calendar day wants this same look. Also: parse `YYYY-MM-DD` as **local**
  midnight by splitting it, never `new Date(iso)`, which reads a bare date as UTC and lands a day
  early for everyone west of Greenwich (`daysBetween()` in `next-workout.js`).
- **Weights are STORED IN POUNDS, always** (`units.js`). kg is a display choice, converted at exactly
  two edges: what is shown and what is typed. `e1rm.js` and `strength-standards.js` are pounds
  throughout. Anything that stores a number the user typed must go through `units.fromDisplay()`.
- **Pure-maths modules are the pattern that works.** `e1rm.js`, `strength-standards.js` and
  `units.js` have no DOM or store dependency, so they are fully testable headlessly. They have
  caught real bugs that way, and `docs/strength-estimate-plan.md` follows the same shape.

### Data model

```
Exercise    id, name, muscle, equipment, fields[], loadType, isCustom
System      id, name, notes, createdAt, updatedAt
            ── a programme. Workouts belong to one, and only one.
Workout     id, name, systemId, isBenchmark, order?,
            exercises[{ exerciseId, sets, notes, group?, setType?, drops? }],
            createdAt, updatedAt
            ── `group`: adjacent exercises sharing one form a superset/tri-set.
               `setType: 'drop'` + `minis: n` plans n drops after every set.
               `setType: 'myo'` + `minis: n` plans n myo-rep match sets.
               ⚠️ normalizeWorkout() REBUILDS each exercise field by field, so
               any new field must be named there or it is lost on every read.
            ── `order` is the position it had in a ready-made programme. Absent
               on anything the user typed, because a list you wrote yourself has
               no meaningful order. getWorkouts() sorts ordered first, then by
               name — so a copied split keeps its shape and your own additions
               land at the end of it rather than in the middle.
Session     id, workoutId, workoutName, date, startedAt, finishedAt, isBenchmark,
            entries[{ exerciseId, exerciseName, group?, setType?,
                      sets[{ weight, reps, time, distance, minis?[…] }] }]
            ── ⚠️ `minis` live INSIDE a set, never as extra rows in `sets`.
               Drops for a drop set, match sets for a myo-rep. Read through
               minisOf(), which also reads the older `drops` key.
               That is what makes "a drop set is ONE hard set" true by
               construction: every count of sets.length keeps counting one,
               so no analysis path has to know drop sets exist (D23).
Benchmark   id, date, exerciseId, exerciseName, values{}, sourceSessionId?
            ── sourceSessionId set = DERIVED from a benchmark workout, and rebuilt
               from that session on every save. Absent = entered by hand, never touched.
BodyWeight  id, date, weight, createdAt          ← one row per weigh-in
Goal        id, muscle, liftName, targetLevel, targetLevelName, targetPercentile,
            targetWeight, startWeight, startPercentile, startLevel, startDate,
            endDate, ambition, gainPct, comparison, status, endedReason?
            ── ⚠️ targetWeight is FROZEN in pounds, never recomputed. A level is
               a PERCENTILE, and the weight behind it moves with body weight, age
               and the comparison group (D20) — so recomputing it would make a
               goal quietly harder because somebody gained four pounds. The
               comparison it was computed against is stored alongside it and the
               picker says so.
            ── One row has status 'active' at a time; store.setGoal() ends any
               other. Old goals are kept, never deleted.
Settings    id, units, theme, gender, birthYear  ← birth year, NEVER age
```

`normalizeWorkout()` in `store.js` migrates the old `exerciseIds[]` shape on read — keep it.
`store.ensureSystems()` does the same job for workouts saved before systems existed, and is
**single-flight on purpose** — see the key patterns below.

⚠️ **Adding a collection to `COLLECTIONS` also requires adding it to `knownCollection()` in
`firestore.rules` and redeploying**, or every cloud write to it is denied while localStorage keeps
working — invisible until someone signs in. **Since 2026-08-19 a test compares the two lists** and
fails if they disagree, so only the *redeploy* is still on you. `goals` is in both and is deployed.

⚠️ **Adding a `js/` module also requires adding it to the precache list in `sw.js`.** There is a test
that fails if you don't (`sw.js precache is missing: …`), which is how `js/social.js` was caught the
minute it was created — a module missing from the precache is a module the app cannot load offline,
and D6 says offline is non-negotiable.

**Social paths, added 2026-08-18 and read by nothing yet** — `users/{uid}/shared/{tier}` (the
published copy, carrying its own `viewers` list so the rule needs no second read),
`users/{uid}/social/graph` (owner-only, who is connected and what each may see) and
`users/{uid}/invites/{token}` (`get` yes, `list` no, which is what stops anyone enumerating them).

---

## 5. Design rules — binding

### Rule 1 — the window never scrolls, and screens shouldn't need to

`html, body { overflow: hidden }`; `#app` is a fixed `100dvh` flex container. Every screen is a fixed
header, an optional fixed `top`, one flexible `pane-scroll`, an optional fixed `bottom`.

**Scrolling is a last resort, not a layout tool.** Inner scrolling is acceptable only for genuinely
unbounded lists: the builder's exercise list, recent activity, search results, and the calendar.

`#app` is `column-reverse` on mobile so the nav sits at the bottom, and flips to `row` on desktop so
the same element becomes a left sidebar.

### Rule 2 — no boxes

Structure comes from hairline rules, spacing and type weight — never nested bordered cards. `.card`
survives as a semantic grouping but **draws nothing**.

The chart's hover readout is the test case: plain SVG text with a ground-coloured halo
(`paint-order: stroke`), not a boxed tooltip. Legible over gridlines, still no box.

### Rule 3 — content first, controls in the leftover

*"Start with the most important thing and put it as big as you can, then put the selectors in the
leftover space, not the opposite."*

The line chart is **measured, not fixed**: `fillChart()` reads the container's real pixel size and
draws at exactly that, with a `ResizeObserver`. Gridline and date-label density scale with size.

**Corollary — content must not shrink because you asked it a question.** Tapping a muscle used to
open the detail *below* the body map, which pushed the figures up and shrank them. On ≥ 860px the
panel is now a side column instead, so the body is the same size selected or not. Measured at 960px
the side layout gives a *larger* figure than stacking (395×433 vs 338×370): a column costs width
once, a stacked panel costs half the height.

### Rule 4 — never mix benchmarks with workout sets

A benchmark is a deliberate test taken fresh; a mid-workout set comes after everything else the
session did. Charting them as one line makes strength look like it swings wildly. **One source at a
time, benchmarks by default** (D14). The toggle appears only when an exercise has both.

Mixing also silently destroyed data — one point per day meant a day with both lost one reading.

### Rule 5 — a marker means measured

A circle means *you actually lifted this, at this rep count*. Estimates carry no marker. Bars mark
estimates with a diagonal hatch, not a fade — texture survives greyscale and colour-blindness.

General form: **never let an inference look like a measurement.** Anything derived must be visually
separable from anything recorded, by a cue that is not colour alone.

### Rule 6 — no unearned opinions

Change is coloured good or bad only where bigger is genuinely better. Time was already neutral (a
faster mile is better, a longer plank is better) and **body weight is neutral too** — gaining is the
goal for one user and losing it for the next, and nothing has ever asked which. `summaryStats()`
takes a `judged` flag for exactly this. The training goal that D10 will introduce is what would
eventually earn the app an opinion here.

### Colour — validate, never eyeball

**Before building any chart, load the `dataviz` skill and run its validator.**

*Series colours* (`--series-start` / `--series-now`), deliberately not the UI accent:

| Theme | Start | Now | CVD ΔE | Normal ΔE | Contrast |
|---|---|---|---|---|---|
| Dark | `#3D8FC0` | `#C08430` | 19.6 | 23.2 | 5.3 / 5.9 |
| Light | `#2C7CB0` | `#96660F` | 20.7 | 22.1 | 4.1 / 4.5 |

*Strength ramp* (`--lv-*`): strength level is **ordinal**, and it is now a **multi-hue** ramp —
seven steps sweeping ~250° of hue with **strictly monotone lightness**. Tim asked for bright, varied
colour (2026-08-15); monotone lightness is what keeps it a scale rather than a rainbow, and it is the
same construction viridis and plasma use. Generated in OKLCH at the gamut edge and validated in both
themes: monotone L, adjacent ΔL ≥ 0.06, light end clearing its surface — all pass. *Single hue*
fails by design, so the ramp was additionally stress-tested against the **categorical all-pairs**
checks the old one-hue ramp was never held to, and it beats it comfortably on normal vision
(worst ΔE 13.8 / 11.4 vs 8.0 / 6.9) while matching it under colour blindness. Both land in the CVD
floor band, which is legal only with secondary encoding — this screen always shows the legend and
names the level in text on tap. Dark is a *selected* ramp with the anchor flipped, not an inversion.
**Regenerate and re-validate; never hand-edit those hexes.** Bare `:root` is DARK in this stylesheet.

⚠️ The validator's *Single hue* check computes hue spread with a naive min/max that wraps: a ramp
crossing 0° can be reported as a 40° spread and PASS when it actually sweeps 250°. Don't read that
particular PASS as meaning anything.

### Load-type rules (`js/exercises.js`)

Dumbbell/kettlebell → per side; barbell/machine/plate → total. `FORCE_PER_SIDE` for two-stack cable
work, single-arm work and carries; `FORCE_TOTAL` for one implement in two hands and single-limb
*machines*. Displays as `50 lbs/side × 10`.

---

## 6. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| D1 | **No diet/nutrition.** Point at Cronometer. | Free nutrition apps aren't crippled — diet tracking is present-tense, so the history paywall doesn't bite. The food database can't be replicated. |
| D2 | **Lifting only.** | Focus. |
| D3 | **Weekly sets per muscle group is the headline metric.** | What hypertrophy responds to (~10–20 hard sets/muscle/week). Only Alpha Progression does it. **Not built — Tier 2, and blocked on the weighted muscle mapping.** |
| D4 | **Target = spreadsheet transparency + app ergonomics.** | Spreadsheets win on whole-block visibility, structural freedom, permanence. Apps only win the logging loop. Take both. |
| D5 | **e1RM must be rep-range honest.** Full confidence 2–10 reps, flag 11–15, don't normalise above 15. | Formulas degrade badly above ~10 reps. Built — and **enforced in ranking as `MAX_EVIDENCE_REPS = 15`** since 2026-08-16. It was not, and a 135×25 burnout set extrapolated to 258 lb, beat a real 205×5 top set and promoted a muscle a whole level. Benchmarks get no exemption. |
| D6 | **Offline-first logging is non-negotiable.** | Gyms are basements. **Built 2026-08-16** — `sw.js` precaches the whole shell. Until then this was a claim, not a feature: store.js falls back to localStorage when the *cloud* fails, but with no signal the app never BOOTED, so that fallback never ran. Verified by killing the origin server, not by emulating offline — see §0.7. |
| D7 | **No social feed.** | Repeatedly unwanted in Hevy reviews. |
| D8 | **Teach at the moment of use**, never a manual or onboarding carousel. | RP Hypertrophy has the best science and worst delivery. |
| D9 | **Progressive disclosure is core architecture.** | Audience is "any level". Can't be bolted on later. |
| D10 | **Training goal is a user setting that reconfigures the dashboard.** | One fixed dashboard would be wrong for most users. |
| D11 | **Marzagão (2026) weight-dependent e1RM**, not Epley/Brzycki.<br>`1RM = w × (1 + (r−1)^0.85 / k(w))`<br>`k(w) = max(4.58, −2.55 + 4.58·ln(w_kg))` | The reps↔%1RM curve genuinely differs by exercise (Nuzzo 2024: exercise type is the *only* meaningful moderator). Classical formulas use one fixed factor for every exercise in the library. **⚠️ Our k-floor is 4.58, NOT the paper's 0.5** — below k = B the published curve *decreases* in weight, so a heavier lift would score lower and the inverse stops being unique. Asserted monotone across 1–400 lb. See `docs/research.md` §1. |
| D12 | **Accounts are anonymous-first**; upgrading *links* the account so uid and data carry over. | A signup wall on first open is the biggest killer of retention, and D8/D9 say no wall on day one. Cost: un-upgraded data lives in one browser — the UI states that plainly. |
| D13 | **`BACKEND = 'auto'`, and a cloud failure falls back to local storage.** | Losing signal must never stop someone logging a set (D6). Settings says "Not connected" rather than pretending to sync. |
| D14 | **Graphs never mix benchmarks with workout sets.** One source at a time, benchmarks by default. | Reported by Tim: a workout set sat far off his benchmark trend. Two more problems fell out — the shown point flipped between sources as the rep target changed, and one-point-per-day silently discarded the loser. |
| D15 | **Strength ranking is against people who lift and log, never "everyone".** Levels are lifter-based; a general-population figure is an optional extra line, never a re-tiering. | Competition data puts the general population below its own 50th percentile; general-population data would make every user Elite. The seven-level scale compresses into ~70–98 % of all adults. **The UI must say "of people who lift".** |
| D16 | **Deadlift fills Glutes** on the muscle map. | It belongs to glutes, hamstrings and back at once. Hip-thrust standards are the thinnest of the three. Revisit with the weighted mapping. |
| D17 | **A benchmark workout's benchmarks are DERIVED from its session, not written alongside it.** Each carries `sourceSessionId` and the whole set is rebuilt on every save. | The alternative — write benchmarks once at finish — strands them the moment the record is edited. Move the workout to another day and its benchmarks stay on the old one; delete an exercise and its benchmark lives on; untick the flag and nothing undoes it. Rebuilding makes all four correct by construction instead of by remembering. Hand-entered benchmarks have no `sourceSessionId` and are never touched. |
| D19 | **A muscle is rated by every exercise that trains it, converted by a ratio, and every rating carries a confidence.** Direct exercises decide the rating; a compound stands in for a secondary muscle ONLY when that muscle has nothing direct. Confidence is shown by DESATURATING the level colour, never by dimming it. | Tim, 2026-08-17: a full week of training produced one reading, because one lift per muscle meant 11 exercises out of the whole library could move the map. Coverage costs accuracy — the ratios are estimates, worst for machines — so confidence is what pays for it. Brightness could not carry confidence because brightness already carries the LEVEL: the ramp is a strictly monotone lightness scale, so a dimmed Elite would read as a lower level. Saturation is free, and grey already means "no data", so faded reads as "less sure" on the same axis. Fallback-only for secondaries keeps grey meaningful — it still answers "what am I not training". |
| D20 | **The comparison group is a user setting: FOUR independent axes — population (lifters / everyone), sex, body weight, age — plus two presets, "Like me" and "Everyone".** Any mixed population is modelled as a real MIXTURE of distributions, never an invented combined median. | Tim, 2026-08-17. Axes rather than presets alone because "women, any body weight, my age" is a real question; presets on top because the two combinations most people want are the extremes and setting four things by hand to reach them is a chore. The caption naming the group is built by the same function that computes it, so the number and the population it refers to cannot drift apart. |
| D21 | **D15 is narrowed, not repealed: ranking against people who do not lift is now offered, and untrained adults are given their OWN overlapping distribution rather than being assumed weaker than every lifter.** Untrained median = 0.55 × the lifter median. | Tim asked for a lift/don't-lift axis. D15's real objection was never "don't offer it" — it was that general-population data makes every user Elite. That was true of the OLD model, which assumed every non-lifter sat below every lifter and so forced any lifter above the 68th percentile, squashing seven levels into three. With an overlapping untrained distribution the levels keep spreading: a beginner lifter reads Proficient, a median lifter Expert, an elite lifter Elite — asserted in the tests. **The 0.55 is the weakest number in the file** (nobody has measured what the median adult can bench) and both the sheet and the detail panel say so. |
| D22 | **A workout belongs to exactly ONE system.** | Sharing one workout between two programmes sounds useful and is not: editing it in one place would silently change the other, and "did my Push day change because I imported someone else's programme?" is a question this app should never raise. Deleting a system therefore deletes its workouts — but never the sessions already recorded from them, because history is a record of what happened and does not become untrue when the plan behind it is thrown away. |
| D23 | **Set types are TWO shapes, not one list.** A superset/tri-set/giant set is a `group` on adjacent exercises — a statement about the SPACE BETWEEN them. A drop set is `drops[]` nested INSIDE a recorded set. Rest fires at the end of a round, and after a drop rather than after the top set. | "Supersets, drop sets and tri-sets" sounds like three of a kind and is two of two, and building it as one list would have got both wrong. The nesting is the load-bearing half: `progress.md` §6 already locks "a drop set counts as ONE hard set", and storing drops inside the set makes that true **by construction** — every existing path counts `sets.length` and keeps counting one, so no analysis code has to know drop sets exist. Flattening drops into `sets` would have silently inflated every set count, every weekly volume figure and D3 when it lands. The rest rule is the other half: a timer that started between the two halves of a superset would be instructing the user to do the opposite of what a superset is. |

**D18 is deliberately absent.** It is a *proposal* in `docs/strength-estimate-plan.md` §7, not a
locked decision — it would narrow D14, and D14 is locked, so it needs Tim's say-so first. §10 has
the question. Nothing else is missing from this table.

**D26 is LOCKED as of 2026-08-19**, having been ratified by Tim on 2026-08-18 and built the next
day: *the app may RECOMMEND a protein range with its citation, but may not track food, hold a food
database, or ask what anybody ate.* It narrows **D1** the way D21 narrowed D15 — D1's reasoning was
about tracking, and none of it applies to one cited number on a goal screen. The Goals screen shows a
daily gram figure from body weight, cites Morton 2018, and labels it *"a bar, not a dial"* rather
than *"grows with the goal"*, because the same meta-analysis found more protein above the breakpoint
does nothing. Nothing anywhere asks what anybody ate.

**D24 and D25 are proposals too, in `docs/social-plan.md`**, and are not in the table for the same
reason — nothing is built, so nothing is decided. D24: *sharing publishes a derived copy and never
widens a permission on the source*, which is forced by the storage shape (one document holds every
row of a collection, and Firestore grants per document, so "let a friend see some of my workouts"
has no permission that expresses it). D25: *social requires upgrading off an anonymous account*,
which narrows D12 rather than breaching it. Both get locked if and when Phase 1 is built.

### Standing recommendations

- **R1 — Web app (PWA), not native.** Home-screen install, offline, zero distribution cost.
- ~~**R2 — Local-first, no accounts.**~~ Superseded 2026-08-15; local-first survives as the *fallback* (D13).
- **R3 — Ship Tier 1 before anything else.**

### Resolved without asking

- Drop sets / myo-reps count as **one** hard set — else volume totals inflate.
- Secondary-muscle weighting fixed at **0.5** with an advanced override.
- **Sets exist in the session runner** — an app that can't log 3×8 would be useless.
- **Bar chart requires 2+ benchmarks**; excluded ones surface as a visible count.

---

## 7. Research

**All research lives in `docs/research.md`**, graded 🟢🟡🔴 with sources. Sections: e1RM /
rep-normalisation · reps↔%1RM · proximity to failure · fatigue & rest · velocity-based training ·
**volume, frequency & the dose response** · competitive landscape · data-viz colour · unverified
claims · strength standards & percentiles · **progression & load increments**.

**§6 was rewritten from 🟡 to 🟢 on 2026-08-18** and is now the most load-bearing section in the file
— the "% optimal" rating is built on it. The four findings a fresh session should know without
reading it:

- **Frequency has no consistently identifiable independent effect on hypertrophy** (CrI contains
  zero), but it does matter for strength. So more training days is not itself better for growth.
- **Volume follows a square-root curve** with published efficiency tiers: 4 sets/muscle/week is the
  minimum effective dose, 5–10 is the best value per set, 43+ is off the end of the evidence.
- **An indirect set counts as 0.5** — the best-supported counting method, and the answer D3 was
  waiting for.
- **The models explain about a quarter of the variance**, which is why every rating is banded.

Added 2026-08-18: **§6.9 protein** (plateau at 0.73 g/lb; "1 g/lb" is the top of the CI),
**§6.10 sleep** (one night's deprivation cuts muscle protein synthesis 18 %, but no dose–response
from habitual hours exists), **§6.11 individual variability** (0–250 % spread over 12 weeks, yet
non-responders are rare and individual response is reproducible) and **§12 progression** (the ACSM
2-for-2 rule; a 5 lb jump only enters the recommended 2–10 % band at 50 lb and above).

Competitive teardown: `docs/competitive-teardown.html`. Analysed Strong, Hevy, Boostcamp, Liftosaur,
Alpha Progression, RP Hypertrophy, Fitbod.

**Five failures shared by all:** data goes in but insight doesn't come out; offline is an
afterthought; analysis is per-exercise not per-muscle; the jargon wall; you can't answer "is this
working?"

**The gap being built into:** four of five commercial apps monetise by restricting access to your own
accumulated data (Hevy caps free graph history at 3 months).

**Note:** Fitbod published the D11 formula from its own data. If they ship it in-product it stops
being a differentiator.

---

## 8. Roadmap

**Tier 1 — beat the spreadsheet.** **Done.**

**Tier 2 — programs and analysis**
- Program builder (desktop) → execution (mobile)
- Progression rules: linear + double progression first
- Weekly volume per muscle group vs target bands (D3) — **blocked on the weighted muscle mapping**
- Block summary + block-over-block comparison
- Stall detection (e1RM flat 3+ weeks → flag and explain)

**Tier 3 — teach and guide**
- A small set of well-explained starter programs, not thousands
- Just-in-time concept explanations wired to first use (D8)
- Post-session check-in feeding next week's volume
- Deload prompting; equipment-aware substitution

**Beyond the roadmap — `docs/vision.md`.** Tim's running list, and **all six ideas are started and
five are finished**. BUILT: **social** (§1.1), **ready-made systems and the "% optimal" rating**
(§1.3), the **"Compared to:" setting** (§1.4), **set types** (§1.5) and **goals** (§1.6, built
2026-08-19). HALF BUILT: **smart systems** (§1.2) — Home suggests *which workout*; the weights and
reps wait on the estimator, which is also the one hole left in §1.6.

**Three of the six collided with a locked decision, and every one was resolved rather than ignored:**
an "all people" comparison narrowed **D15** into **D21**; social was expected to collide with **D7**
and side-stepped it entirely by building a profile instead of a feed, so D7 stands untouched; and a
protein recommendation narrowed **D1** into **D26**. Note the pattern, because it has now happened
three times: **the objection turns out to be about a specific model rather than about the idea**, and
re-examining it produces something better than either the old rule or a plain override.
`docs/vision.md` records collisions; it does not quietly resolve them.

---

## 9. Known gaps — deliberate, not bugs

- ~~**Body weight is charted but not yet wired into rep normalisation.**~~ **CLOSED 2026-08-19.**
  Pull-ups, chin-ups, dips and push-ups now rank. What remains open is narrower and is stated on
  screen rather than hidden:
  - **Measured, but the app lacks the parameter.** An inverted row is 37–79 % of body weight
    depending on bar height; an incline push-up 41 % vs 55 % depending on hand height. The app
    records neither, so both stay refused. Adding the parameter is the fix, not adding a number.
  - **No published figure exists at all** for diamond and wide-grip push-ups, bench dips, handstand
    and pike push-ups, ring dips or muscle-ups. ⚠️ **The "handstand push-up ≈ 90–100 % of body
    weight" figure circulating online is misattributed** to a paper that studied push-ups. Do not
    use anything from that lineage.
  - ~~**Assisted machines.**~~ **ADMITTED 2026-08-24 on Tim's instruction**, and it is the one entry
    in the fraction table resting on an assumption rather than a source. The fraction is fine — a
    pull-up's 1.00 — and the objection was never about it: the counterweight linkage is not
    standardised and nothing published maps a stack setting to the load it removes. That is still
    true. ⚠️ **What changed is the cost of refusing.** Tim did 70 lb assisted pull-ups in a gym and
    his back rated nothing, which is the same grey-map complaint that admitted the pull-up in the
    first place. Priced at `q` 0.65 — the lowest in the table, below the push-up — rather than
    disclaimed. **And the error is not constant**: it scales with how much help is taken, so the
    number is most trustworthy where it matters least. A single `q` cannot express that.
  - **All lower-body and trunk bodyweight work**, for a different reason: their key lifts log
    *external* load carried by a body that is already there, so a bodyweight squat converts to an
    empty bar. Fixing that needs the key lift's own body-weight component modelled first.
  - ⚠️ **A stale weigh-in gets no penalty.** Somebody who logs pull-ups for two years after one
    weigh-in is scored at that old weight with full confidence. Carrying a weigh-in *backward* is
    priced at 0.70; carrying it forward is not priced at all, and that is the same class of problem
    this task set out to fix, arriving from the other side.
- ~~**The Muscles figure's look is not signed off.**~~ **Closed 2026-08-16.** All four gaps — heavy
  keylines, dense striations, unpainted head/hands/feet/knees, heroic proportions — came in with
  Tim's illustration and are satisfied by construction rather than by drawing code: the ink layer
  *is* the keylines and striations, and unpainted parts are simply parts with no fill. Nothing about
  the figure's look is authored in this repo any more, so there is no styling knob to keep in sync.

- ~~**Muscles uses benchmarks only.**~~ **Closed 2026-08-16** — it now ranks from workout sets too,
  best estimate wins, and the panel names the source. Not a breach of D14: that rule is about
  charting a TREND (two sources on one line, one point per day discarding the loser); a single best
  estimate has neither problem.
- ~~**A muscle is rated by exactly ONE key lift.**~~ **Closed 2026-08-17.** Tim trained every muscle
  for a week and the map recorded a single number, because he had done hammer curls rather than
  barbell curls, dumbbell rows rather than barbell rows, seated calf raises rather than standing.
  Every exercise that trains a muscle now rates it, converted to that muscle's standard by a ratio in
  `js/muscle-evidence.js`. **11 exercises could move the map; 164 of the 209 weighted ones can now.**
- **The conversion ratios are estimates, and some are shaky.** This is the price of the change above
  and it is not hidden: a confidence is computed per muscle and the colour desaturates with it.
  Dumbbell swaps of barbell lifts are solid; **machines are the weak case**, because gearing varies
  by brand and two "machine shoulder press" numbers may not describe the same resistance at all.
  Machine conversions carry a quality of 0.35–0.45 for exactly that reason.
- ~~**A muscle was rated by its most FLATTERING evidence rather than its most credible.**~~
  **FIXED 2026-08-19**, and it was the worst defect in the ranking model. `rateMuscle()` picked its
  top three observations by **estimate**, so the single biggest converted number set the rating no
  matter how little it was worth believing — while `evidenceWeight`, the number this module exists to
  compute, was used only to average the winners afterwards. Measured on a year of ordinary training:
  a 50 lb face pull for 15 reps (quality 0.25, weight **0.06**) beat an overhead press **benchmark**
  (quality 1.00, three reps, weight **~1.00**) and rated the lifter **Elite, 99th percentile** on
  shoulders, beside a Proficient chest. A sixteen-fold credibility inversion.

  ⚠️ **It was not a shoulders quirk — eight of eleven muscles had it**, and in every case the top
  three slots were filled by *the same exercise on three different days*. So the file's own claim
  that "averaging across DIFFERENT exercises cancels out error in any one ratio" had never once been
  true, and the `agreement` term — which exists to ask whether independent readings corroborate each
  other — was comparing an exercise against itself, finding perfect agreement, and pushing confidence
  UP precisely where there was no second opinion at all.

  Three changes, all of them restoring stated intent rather than inventing policy: **one seat per
  exercise** in the top three, **ranked by credibility rather than by size** (ties broken on the
  bigger estimate, so the upper-estimator character survives *within* a level of credibility), and
  **depth measured over all admissible evidence** rather than over the three that won. The results on
  the same year: Shoulders **Elite 99 % → Proficient 71 %** and now led by the actual overhead press;
  Hamstrings led by the Romanian deadlift instead of a leg curl; Calves by the calf raise they
  currently train instead of one dropped six months ago; every muscle inside a coherent 54–76 % band.
  **Mutation-checked** — reverting the sort flips exactly the five new assertions and nothing else.

- **The three residuals now have MEASURED answers** (`docs/strength-estimate-plan.md` §15), and only
  one of them shipped. This is the honest state:
  - ~~A low-credibility conversion still **nudges** the number.~~ **FIXED 2026-08-19.**
    `rateMuscle()` now winsorises into `[median/1.25, median×1.25]` before the weighted mean. The
    face pull's nudge goes **+3.9 % → +1.0 %**; across 200 simulated muscles against known truth
    **worst-case error halves, 19.8 % → 7.5 %**, and it improved RMSE *with no outlier present*,
    which is what makes it free rather than a trade. k is pinned from both sides — below ~0.21 it
    clips days a lifter genuinely had. ⚠️ **Two levels moved on the demo year** (Hamstrings and
    Triceps, each one band); both are boundary straddles at 64.9 vs 65.0 and 49.8 vs 50.0, and
    every clipped observation was high-rep isolation work converting to an implausible number.
  - **High-rep extrapolation is NOT fixed, and now has a reason rather than a plan.** Shrinkage
    **cannot be honestly fitted**: the extra spread at 15 reps comes out 0.01 / 0.07 / 0.12
    depending entirely on a per-lifter rep-curve variance nobody has measured. So the 180×12 seated
    calf raise still converts to 417 lb — but it now carries a **±21.3 % band spanning three
    levels**, and `displayLevel()` returns `certain: false`, so the UI is not permitted to say
    Elite. **Carrying the uncertainty is the answer; a guessed constant is not.**
  - **A typo and a PR are separable above ~25 %, and not below 15 %.** A plausibility ceiling
    quarantines (never deletes) an observation above what training could have delivered. At a
    0.09 % false-positive rate: ×10 caught 100 %, +40 % 99 %, +25 % 77 %, +15 % 19 %. One ×10 fat
    finger otherwise biases a year's reading by **343 %**, because every real set is then measured
    against the typo. ⚠️ **The winsoriser does not fix this** — a ×10 typo arrives with high
    credibility. Two different failures, two mechanisms.
  - ⚠️ **None of this is validated against a human.** The simulator's e1RM is correct *by
    construction*, and `docs/research.md` §1.3 says its absolute accuracy was never validated.
    "Within 4.6 %" is a statement about the model, not about a person. §11.2's backtest against
    held-out benchmarks is the only thing that changes that.
- **Core, Neck and Cardio can never be ranked** — no published standards exist; the UI says so.
  Core is drawn (abs + obliques) so the figure looks right, but it always renders as No data.
- **Percentile placement leans on the e1RM formula being *absolutely* accurate**, which
  `docs/research.md` §1.3 says was never validated — it was optimised for *internal consistency*.
  Harmless for rep normalisation, a stronger claim here. Mitigated by flagging levels derived from
  high-rep sets, and since 2026-08-16 by refusing sets above 15 reps as evidence at all
  (`MAX_EVIDENCE_REPS`, D5).
- **A cancelled Google sign-in must never be silent.** `auth/popup-closed-by-user` is raised both
  when a person closes the window AND when the SDK loses its handle on it (Cross-Origin-Opener-
  Policy), so it is not reliably a decision. Treating it as "do nothing" made the button look dead
  and left no route through — a regression shipped and reported within the hour. It now says what
  happened and reveals **Continue in this window instead**, a redirect-only path no popup blocker can
  touch. Related trap: `run()` in views-account.js hands the button back only when its function
  THROWS, on the assumption success navigates away — any new outcome that stays on the screen has to
  re-enable the button itself.
- **A Google popup is only ever opened ONCE.** Recovering from "that account already exists" used to
  open a second one, which the browser blocked because the gesture authorising the first was spent —
  reported by Tim as "your browser blocked the sign-in window" (2026-08-16). The recovery now reuses
  the credential from the failed link via `signInWithCredential`, which needs no window. Anything
  added to this flow must not open a window outside the original click.
- ~~**Google sign-in inside the installed PWA is the riskiest untested path.**~~ ✅ **TESTED
  2026-08-22, and it works** — it was the riskiest path and it is now the only one a device has
  confirmed. ⚠️ **The premise written here was false**: *"popups are blocked in an iOS home-screen
  app"* is what sent the PWA to `signInWithRedirect`, and redirect is the thing that actually cannot
  complete while the auth domain differs from the origin. A popup in an installed iOS app works.
  Kept rather than deleted because the wrong premise is why the code did the wrong thing for months.
  The custom-domain fallback is still the answer **if the redirect flow is ever needed again**.
- **Rep normalisation assumes near-failure effort.** Every rep-based formula does. Bias is systematic
  per user per exercise, so trend and ordering survive. There is no RIR/RPE field — deliberate (D9).
- ~~**No supersets, drop sets or tri-sets.**~~ **Closed 2026-08-17** — built, and D23 records the
  two-shapes model. **Myo-reps followed the same day** and cost almost nothing, exactly as the
  prediction said: same nesting shape, one label, one rest hint, one default count. **Dr. Mike's
  Floating Split now ships with its real structure** — 11 of its exercises are myo-reps — and its
  warning no longer has to say the structure was stripped out. **Chris Bumstead shipped the same
  day**, and he is the system this was built for: eight drop sets, a tri-set and a superset, none of
  which could have been expressed before. **Still missing: RIR and tempo**, both deliberate (D9).
- **⚠️ The stored key for mini-sets is `minis`, and `drops` is a legacy alias.** It shipped as
  `drops` during the few hours when drop sets were the only nesting type. Keeping that name would
  have meant every myo-rep set on disk claiming to be a list of drops — visible to anyone who
  exported a backup, and false. `minisOf()` reads both; nothing writes `drops` any more, and both
  save paths `delete` it.
- ~~**Weight display is hard-coded to lbs.**~~ **Closed 2026-08-16.** lbs/kg in Settings, stored
  canonically in pounds. Distance is still miles only.
- **The Nippard system is a TRANSCRIPTION, and the screen says so.** It comes from published
  write-ups of the FREE YouTube series (Fitness Volt, BarBend, MuscleChemistry), **not** from his
  paid 12-week ebook and not from him. Nobody involved watched the videos, so the sets and reps are
  as reported. `unofficial: true` is what puts the warning on screen, and a test asserts that
  anything credited to a real person carries a source URL, the flag, and a note saying it is not
  their own writing. **Do not add the paid ebook's contents** — pirated copies of it sit on studylib
  and scribd and rank on the first page of every search for these workouts.

  ~~Only one Push, one Pull and one Legs are here.~~ **Closed 2026-08-19 — all six, in episode
  order.** Two things came out of finishing it, and the second is the one worth remembering:

  - **⚠️ SOURCING IS NOT EVEN ACROSS THE SIX, and the system's notes say so on screen.** Push 2,
    Pull 2 and Legs 2 each have two independent write-ups that agree; Push 1, Pull 1 and Legs 1 rest
    on one apiece. One disagreement is recorded rather than smoothed over — Fitness Volt gives Legs 2
    four sets of *seated* calf raises, BarBend two seated and two standing. The totals match at four,
    so the more detailed source was followed, which is the same call Bumstead's tri-set got.
  - **⚠️ The workout shipped as "Pull" was the SECOND pull.** Its write-up says only "the most
    recent issue" and carries no episode number, so it read as the first. The order had to be
    recovered from the video dates — Jan, 13 Feb, 24 Feb, 3 Jun, 10 Jul, 7 Aug 2023. No test could
    have caught that; only reading the dates could.

  One modelling compromise, stated in the workout's own note rather than hidden: Pull 1's lat
  pulldown is written up as two sets to failure plus **one** drop, and `minis` plans a drop after
  every set — so the app plans one more than he does, and the note says to skip it.
  Sources: [push 1](https://fitnessvolt.com/jeff-nippard-push-workout/) ·
  [pull 1](https://fitnessvolt.com/jeff-nippard-back-and-biceps-workout/) ·
  [legs 1](https://fitnessvolt.com/jeff-nippard-leg-day-workout/) ·
  [push 2](https://fitnessvolt.com/jeff-nippard-science-based-push-day-workout/) and
  [its second source](https://barbend.com/news/7-exercises-jeff-nippard-chest-shoulders-triceps/) ·
  [pull 2](https://barbend.com/news/jeff-nippard-science-supported-back-and-biceps-workout/) and
  [its second source](https://fitnessvolt.com/jeff-nippard-back-and-biceps-workout-backed-by-science/) ·
  [legs 2](https://fitnessvolt.com/jeff-nippard-science-based-leg-workout/) and
  [its second source](https://www.musclechemistry.com/the-6-exercises-in-jeff-nippards-scientifically-perfect-lower-body-workout/)
- **Every creator system has a DIFFERENT limitation, and each states its own.** The default warning
  ("transcribed from the free videos") is true of Nippard and false of the rest, so `warning`
  overrides it per system and a test fails if anything that is not a video transcription falls
  through to the default. **Arnold's Golden Six**: sixty years of republication and the versions
  disagree — some swap the behind-the-neck press for an upright row, sit-up reps run from 20 to
  AMRAP — and nobody here has a primary source, which may not exist. **Thurston**: he rebuilds his
  own programme every four to six weeks, so a transcription is one block frozen rather than a
  programme he stands behind. **Volume Landmarks Hypertrophy**: the workouts are the app's own, said
  twice on screen.
- **Chris Bumstead's is an EIGHT-DAY cycle, not a week, and the warning leads with it** — three on,
  one off, twice through, so it drifts across the calendar on purpose and `daysPerWeek: 6` is an
  approximation the screen explains. Second thing it says: this is a four-time Mr. Olympia's volume
  and exercise selection, built for somebody whose job is recovering from it. Two source
  disagreements are recorded in the file: whether day one ends in a tri-set (Set For Set says yes,
  Generation Iron lists the three plainly — followed Set For Set, because a claim that something is
  grouped is harder to invent than to omit), and how much of **arm day** is tri-sets (shorter
  summaries say most of it; both detailed write-ups show straight exercises with drop sets — followed
  the detailed ones, and it is the part most likely to be wrong).
- **Dr. Mike's Floating Split is the most DISTORTED transcription in the file, and that is the first
  thing its warning says.** Nearly every set in it is a myo-rep or a giant set; the app records
  straight sets only, so what ships is his exercise choice with the set structure removed — "4
  myo-rep match sets" becomes 4 sets. Two further caveats on screen: it is a **cutting** split
  (training to hold muscle while dieting to 6 % body fat, not to add it), and several set counts were
  never reported by either source. Specialty equipment — transformer bar, cambered bar, CC squat
  machine — is mapped to the nearest thing in the library and noted per exercise. Sourcing is the
  *strongest* of any creator system here, though: RP's own site plus an independent write-up that
  agrees exercise for exercise. **This is the system that most wants `docs/vision.md` §1.5.**
- **Beware which Nippard workout you are reading.** He has published several similarly named push
  workouts. A Generation Iron write-up of an older PPL gives a completely different push day
  (dips, Egyptian lateral raises, cable kickbacks) from the 2023 series. Cross-check the date and the
  series before trusting any write-up.
- **Exercise→muscle is a single string**, not the primary/secondary weighted mapping. **This must
  change before D3** — and since 2026-08-18 there is a published answer for *what* to change it to.
  The best-supported counting method in the literature is **binary: direct 1.0, indirect 0.5**
  (Pelland et al. 2025, `docs/research.md` §6.4), which is *simpler* than the continuous weighting
  this line assumed for months. The 0.5 the project had already guessed "without asking" turns out to
  match it. Still work — every exercise needs the flag per muscle — but no longer a design question.

---

## 10. Next steps

*The short version is the **Open work** list at the top of this file. This section is the long one.*

0. **GOALS — BUILT 2026-08-19**, Phases 1 and 2 of `docs/goals-plan.md`. Pick a three-month strength
   goal, see what it costs, see what your logged training is actually doing against it, read why
   progress stalls, and find a programme that fits. **Two things are left.** The **verdict**
   (Phase 3) waits on the estimator — the screen states that outright rather than leaving a gap that
   reads as a broken feature. **Progression** (Phase 4) waits on nothing but is deliberately last,
   because it is the only part of this app that can hurt somebody; §8 of the plan already has the
   whole rule. **Read §11 of that plan before touching Goals** — it records three things the build
   decided that the plan did not: the target weight is **frozen** when a goal is set, the ambition
   bands are anchored on the dose-response's own predicted effect sizes, and **effort does NOT scale
   with ambition**, which departs from §10.4 because these are strength goals and strength is
   largely indifferent to reps in reserve.

1. **The simulator** — `docs/strength-estimate-plan.md` §11. ⚠️ **Phase 0 is DONE** (its numbers are
   in §15 of that plan, and `tools/strength-fit.mjs` re-derives every constant rather than trusting
   it); **Phases 1–3 are what is left**, and §16 sets their hard design constraint. The rest of this
   item is the reasoning that got there, kept because it is the lesson.
   The demo account handed it a concrete target on 2026-08-19, and
   **half of it turned out not to need the simulator at all**: `rateMuscle()` was selecting evidence
   by size rather than by credibility, which is a design fault and was fixed the same day (§9). What
   is left IS the simulator's: how far a high-rep isolation set may honestly be extrapolated, and
   whether the aggregate should be robust to an outlier rather than a plain weighted mean. §9 lists
   the three residuals. **Worth taking as a lesson before the next one** — the project's standing
   position was that none of this could be touched without the simulator, and a third of it was a
   sort order. `js/muscle-evidence.js` shipped a real confidence model whose
   constants were reasoned rather than fitted, and §9 lists two accuracy gaps that cannot honestly be
   closed by guessing at numbers. A simulator turns both into measurements.
2. ~~**Tim opens the app on a real phone.**~~ ⚠️ **REOPENED 2026-08-21 and PARTLY CLOSED 2026-08-22
   — he opened it.** Five passes ran on the 21st and everything measurable is done; on the 22nd a
   real iPhone confirmed **the keyboard fix** and **Google sign-in in the installed PWA**.
   **This item was worth every word of its warning:** the same device produced the project's only
   real-device *bug* report (Google sign-in) and its only real-device *refutation* (a popup is not
   blocked in an installed iOS app) — both the class of thing no amount of desktop-engine work could
   have found, in both directions. What is left needs the same phone and is small: three
   reasoned-not-measured items, whether the picker's focus raises the keyboard unprompted, touch
   targets, and a **Safari tab**, which is now the surface with less evidence behind it than the
   installed app.
3. **The graph still defaults to benchmarks when an exercise has both sources.** The opposite of what
   Tim asked for on 2026-08-16 ("default should be mostly workout measurements") and still the one
   part of that request unmet. Properly, it is Phase 3 of the estimate plan; cheaply, it is one line
   in `pickSource()` in `views-data.js`.
4. **The creator library — COMPLETE as far as sources allow.** Nine systems, six credited. The
   ceiling that used to bound it is gone — set types shipped, Bumstead and Israetel's real split
   went in behind them, and **the Nippard series was finished on 2026-08-19**: all six workouts,
   found in published write-ups exactly as Tim's instruction said to look for them, no video
   watched. Nothing here is waiting on content any more. §9 has the rules that apply to creator
   systems, and they are deliberately **not the same rule for each one**: every system states its own
   limitation, and a test fails if a non-video transcription falls through to the default warning.
5. **Wire body weight into rep normalisation** for bodyweight/assisted exercises. It is also what
   would let pull-ups and dips rate a muscle at all — `contributionsFor()` refuses them today.
6. **Social — BUILT, and never used by two real accounts.** Phases 1–3 all shipped on 2026-08-18:
   the tier model and projection builder, the rules, the Social screen (the Friends half of Home
   since 2026-08-22), invite links, a friend's page.
   **Both open questions were answered by building the recommendation** — mutual friends, and a list
   you visit rather than a feed — so D7 never had to be reopened. **What is NOT verified is the only
   thing that matters next: no two accounts have ever actually connected.** Every screen has been
   driven, but against a stubbed facade; the round trip — invite, claim, accept, publish, read —
   has run only as rules assertions with hand-written documents. That is the next social job, and it
   needs two real accounts. Phase 4 (a chronological feed, finer visibility axes) remains unstarted
   and still needs D7 narrowed first.
7. **The "% optimal" rating — BUILT 2026-08-18**, `docs/optimal-rating-plan.md`. Research, the
   direct/indirect mapping, the scoring model, the badge on Explore **and the rating on the user's
   own systems** all shipped the same day; **days a week and minutes a session joined the badge on
   2026-08-19**, so it now says what a programme costs as well as how good it is. What is left is
   `docs/research.md` §6.8 — the axes still to pull (load, rest, range of motion, per-session
   volume), each of which either enters the model or becomes a stated caveat.
8. **Tier 2 / D3 — the mapping it was blocked on now EXISTS.** `js/volume-map.js` already computes
   fractional weekly sets per muscle for any set of workouts (`weeklyVolume()`), which is the input
   D3's "weekly sets per muscle group vs target bands" needs. What is left for D3 is the screen and
   the target bands — and the bands are no longer a guess either, they are the published efficiency
   tiers in that module.

### Open questions for Tim

1. **Ratify D18?** `docs/strength-estimate-plan.md` §7 proposes narrowing D14 so that it governs raw
   per-set plotting only, leaving the strength estimator free to draw on all evidence weighted by
   confidence. D14 is locked, so this needs Tim's say-so before Phase 2 of that plan. The fallback if
   he says no: ship the estimator as a separate, clearly labelled chart mode.
   **Precedent worth citing when asking:** D15 was narrowed the same way on 2026-08-17 (see D21), and
   D1 was narrowed on 2026-08-18 (see D26) — each time the objection turned out to be about a
   specific model rather than about the idea.

2. ~~**⚠️ May the auth handler go in the `timothyhadfield.github.io` user-page repo?**~~ ✅ **MOOT —
   withdrawn 2026-08-22.** It was the only real fix for a redirect flow, and Google sign-in works in
   the installed PWA without one. **Nobody needs to touch that repo.** Keep the analysis (2026-08-21
   third pass) only against the day this app moves domain or needs redirect again.

**One question left, and no outstanding ask.** ⚠️ **The 2026-08-22 device visit closed both** — the
keyboard fix is verified and Google sign-in works. Everything else that was on this list has been
answered:

**Answered, so nobody re-asks:**

- ~~Social: profile-first or a feed?~~ **Profile-first, no feed** — built that way, D7 untouched.
- ~~Social: mutual or followers?~~ **Mutual.**
- ~~The "% optimal" rating: one number or two?~~ **Two** — growth and strength, rated separately.
- ~~What does 100 % mean?~~ **The most the evidence supports**, not the best system in the library.
- ~~May the app recommend protein?~~ **Yes** (D26) — recommend with a citation, never track.
- ~~Is "Next exercise" reachable on your phone with the keyboard up?~~ **YES** (2026-08-22), and the
  picker too. Asked three times; the answer closed the biggest unverified fix in the phone work.
- ~~Does Google sign-in work on the iPhone?~~ **YES, in the installed home-screen app** (2026-08-22).
  A Safari tab has not been retested since the fixes.
- ~~Goals as levels, or as a rate?~~ **LEVELS**, which was the recommendation, taken without asking
  under the working agreement and built on 2026-08-19. A level makes no prediction at all, which is
  the only framing the 0–250 % individual variation leaves standing. A rate could still be added
  beside it later if Tim wants one.

One to raise if the Muscles map gets used in anger: whether to expose **raw e1RM** as a chart mode
alongside normalised equivalent load. Lean is no — normalised load keeps numbers in units the user
recognises.

~~**Small, known, untouched:** the Data screen's mode switch wraps "Bar Chart" onto two lines.~~
**Fixed 2026-08-17.** The cause was the flex default `min-width: auto` letting a `.seg` be squeezed
below its own content and wrap; `white-space: nowrap` plus `min-width: 0` on `.seg`.
