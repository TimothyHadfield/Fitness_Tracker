# Fitness Tracker — Progress & Context

> **Fresh session: read this entire file before doing anything.** It is written to be the only thing
> you need. `docs/` holds the detail; `chat.md` is a human-readable log you only need in order to
> answer "what did we say about X".

**Last updated:** 2026-08-31, prepared for a chat reset. **This session is the 2026-08-31 section
directly below — eight pieces of work, A to H.** The four 2026-08-30 sections under it were the
previous session. ⚠️ **THE APP ICON IS CLOSED AND MUST NOT BE REOPENED** (2026-08-30, fourth pass).

⏸️ **ONE THING IS OFFERED AND NOT BUILT, AND IT IS THE ONLY LOOSE END.** Tim: *"There are ab
exercises already in the library, but when people record workouts for those exercises, the ab muscle
group in the display still shows no recordings. Why is this?"* **The panel is honest and the COLOUR
is not** — Core and Neck are permanently unrankable (no published standards exist), and the panel
says exactly that when you tap them, but the body map paints them **grey**, and the only grey entry
in the legend is **"No data."** So somebody who trains abs three times a week sees the same colour as
somebody who has never done a sit-up. His abs work IS counted — weekly volume and the Bars view both
have it. **Two fixes were offered and he has not answered**: give unrankable muscles their own mark
and legend entry, and/or have the panel say what HAS been logged ("no published standards, so it
can't be ranked — you have logged 14 sets of core work in the last two weeks"). **Ask; do not
assume.**

⚠️ **THE DATES IN THIS FILE ARE SESSIONS, NOT CALENDAR DAYS.** Every commit from `e1a7afd` onward
carries a git date of **2026-08-26** or **-27**, including everything headed -28 and -29. Headings
keep the sequence a reader navigates by; never compute an interval from them.

---

## THIS SESSION (2026-08-31) IN EIGHT LINES

🆕 **A. THE WHOLE WORKOUT IS ONE TAP AWAY, AND IT CAN BE REARRANGED.** A third pill — **Exercises** —
beside Swap and Remove opens today's list: **drag a row to reorder, add one, remove one.** 🚨 **The
recorded sets move because nothing is copied** — an entry IS its sets, so a reorder is a reorder of
the array, and a test drives two moves and an add and then reads the SAVED session to prove the 185
is still under the exercise it was typed on. ⚠️ **The walk is re-pointed by entry OBJECT, never by
index**, or shuffling the list under somebody moves them to a different exercise mid-set.

🆕 **B. A SET ROW MORPHS INTO ITS OWN CONTROLS.** Tim: *"it doesn't have 2 places for the same
thing."* The steppers were a SIBLING of the row, so `255 lbs × 7` sat three inches above a stepper
reading 255. 🚨 **The value text is simply not rendered while a row is open** — that is the
assertion, and it fails the moment anybody puts it back. Tapping the open row, or any dead space,
closes it: **the runner can now show no controls at all**, which it never could.

🆕 **C. THE TWO WORDY BLOCKS ARE GONE.** *"Suggested: …"*, the first-time note and the
derived-weight note all came off. 🚨 **WHAT WENT IS THE PROSE, NOT THE ARITHMETIC** — the suggestion
is still applied and a never-done lift still opens at 10 reps and a derived weight, still
`prefilled` so `finish()` refuses to record it. ⚠️ **With nothing on screen saying the number was
worked out, that flag is the only thing keeping this honest** (see the risk noted below).

🆕 **D. SWAP AND REMOVE STAND OUT, WHICH REVERSES A DECISION THIS FILE ARGUED FOR.** They were quiet
on a D4 argument; Tim could not find them in a gym. `.add-set`'s pill shape, **32px of paint and
44px of hit**, and they moved off the name's line because three pills beside a heading left ~110px
for a long exercise name.

🆕 **E. FRIENDS SEE YOUR FACE NOW.** Tim reported the profile photo never reaching them — true, and
deliberate until now (`views-account.js` said so in as many words). It rides beside the name in
**every tier**, because `profile` is identity and the tiers cut training. 🚨 **`safeAvatar()` is a
trust boundary in both directions**: base64 raster only, never an SVG, never a remote URL, capped at
~90 KB. Adding or removing a photo **republishes**, or "Remove" would be a lie about somebody's face.

🆕 **F. THE MUSCLE MAP'S BIG NUMBER SAYS WHAT IT IS.** Tim asked what the weight meant, and the
honest answer was that the screen never said: it is an **estimated 1-rep max on that muscle's key
lift**, which every exercise is converted into. One line under it now says so, naming the lift. 🚨
**"Estimated" is half of it** — the line below names a real recorded set, and an inference next to a
measurement with nothing to tell them apart is what Rule 5 exists to stop.

🆕 **G. THE MUSCLE PANEL NAMES ALL THREE CONTRIBUTORS**, not just the leader — a number built from
three exercises was looking like a number built from one.

🚨 **H. A CUSTOM EXERCISE NO LONGER SETS A STRENGTH LEVEL, AND THE LIBRARY IS 275 → 318.** A custom
"Dip Machine" at 60×10 rated a beginner's triceps **Advanced**, off a ratio guessed from the
equipment dropdown. The guess is gone; customs are still logged, charted and counted in volume.
**Both dip machines are in the library now**, the assisted one with the flag that makes more stack a
*lighter* set. ⚠️ **Six library exercises were silently unrated** and a test now forbids that state.

---

## 2026-08-31 — REARRANGE THE WORKOUT, MORPH THE SET ROW, AND PUBLISH THE FACE

### A. Today's exercises: reorder, add, remove

Tim: *"you can remove a exercise or swap an exercise, but you can't add an exercise or rearrange
exercises for a different order… put a view full workout button somewhere… and you can add an
exercise, remove one, or drag an exercise to another position… If any information has already been
recorded for any of the exercises, keep the information tied to that exercise, but also allow it to
be moved."*

- 🚨 **THE RECORDED SETS MOVE BECAUSE NOTHING IS COPIED, and that is the whole design.** An entry IS
  its sets — `state.entries[i].sets` is the only place a number lives until `finish()` writes it — so
  reordering is a reorder of the array itself and the data cannot come apart from its exercise. The
  shape that would let them drift is a separate order array indexed into the entries. **Proved
  against the SAVED SESSION** after two reorders, an add and a cancelled delete, not against the
  screen.
- ⚠️ **THE WALK IS RE-POINTED BY OBJECT IDENTITY, NEVER BY INDEX.** `state.index` walks STEPS, and
  the entry it pointed at has just moved. **Mutation-checked, and the first version of the test did
  not catch it**: moving the exercise you are standing on lands correctly either way, because the
  slot it arrives in is the slot you would have guessed. The test now moves an exercise BEHIND you,
  which shifts your position with nothing on your row changing — index-based re-pointing follows the
  wrong exercise and the assertion fails alone.
- ⚠️ **A REORDER CAN BREAK A SUPERSET, because a superset is adjacency.** Every reshuffle re-derives
  every `group` through `normalizeGroups`, or two members carrying one id with something between
  them would claim a block nobody performed.
- **An added exercise goes on the END**, which is the opposite of the swap's rule and for the same
  reason: `muscleStrength()` reads entry order as how much work a muscle had already taken, and an
  add really did happen after everything. It arrives with `group: null`, so it can never silently
  make a two-exercise block into a three-exercise one. A duplicate is refused — one exercise id
  twice in a session is the shape that produced the 2026-08-28 duplicate-read bug.
- ⚠️ **THE DRAG IS POINTER EVENTS AND THE ARROWS ARE NOT A CONSOLATION PRIZE.** HTML5 drag-and-drop
  does not exist on a touch screen, so that version would have worked on Tim's laptop and done
  nothing on the phone this app is for. And a drag cannot be performed by a keyboard at all, so ▲▼
  is the only version some people get — it is also what the tests drive, because jsdom reports every
  rectangle as zero. 🚨 **The drag itself was verified with a REAL POINTER over CDP**: row 1 dragged
  to position 3, its 4 recorded sets with it, the runner still on it and now reading *Exercise 3 of
  5*.
- ⚠️ **THE DOM IS THE DRAFT AND THE STATE IS ONLY TOUCHED ON RELEASE**, so a drag that is abandoned
  — the app backgrounded, the pointer cancelled — cannot leave half a reorder in the session.

### B. The set row morphs

Tim: *"when you click on a set, it ADDs a big box underneath it… I would rather make the set itself
change so that it morphs into the weight and reps adjustment box, and then when you click off it it
goes back to being normal. this way it doesn't have 2 places for the same thing."*

- 🚨 **THE VALUE TEXT IS NOT RENDERED ON AN OPEN ROW AT ALL.** That is the load-bearing assertion
  rather than the layout: `255 lbs × 7` above a stepper reading 255 and one reading 7 is the same
  fact twice, both live — the exact duplication the 2026-08-28 restructure removed between the
  detached stepper block and the list, arriving back one level down. Mutation-checked.
- ⚠️ **THE RUNNER CAN NOW SHOW NO CONTROLS AT ALL, which it never could.** The old note in this file
  said a collapsed-to-nothing state would be "a state with no way to log a number"; the way back is
  the row itself, and `entry.active` is not cleared, so reopening lands on the same set.
- ⚠️ **"CLICK OFF IT" IS A PANE LISTENER THAT EXEMPTS EVERY CONTROL.** It runs after the button that
  was actually pressed, on the same event — without the exemption **Add set** opened the new set and
  this closed it again. Mutation-checked; nothing but a screenshot would have shown it otherwise.
- **Old drafts need no migration**: `editing !== false` means open, which is the state this screen
  has always arrived in.

### C. The wordy blocks came off

Tim: *"Remove the 'Suggested: …' description at the top of the workout, as well as the 'First time
logging this…', '10 reps…' feature right now. It's very wordy and I think we can improve it later."*

Three blocks went: the progression's headline-and-why with its *"use last time's numbers instead"*
toggle, the derived-weight note and the first-time note.

- 🚨 **WHAT WAS REMOVED IS THE EXPLANATION, NOT THE ARITHMETIC.** The suggestion is still computed
  and still laid over the numbers; a never-done exercise still opens at 10 reps and a derived
  weight, still flagged `prefilled` so `finish()` refuses to record a set nobody touched.
- ⚠️ **AND HERE IS THE COST, STATED PLAINLY: the app can no longer SAY the opening weight was worked
  out rather than measured.** That sentence was Rule 5 doing its job. What is left is the guarantee
  underneath it — the flag — which is why the tests that pin it were kept and strengthened rather
  than deleted with the prose. **If Tim wants the weight to stop being derived as well, that is one
  line in `startingSet()`.**
- ⚠️ **"Last time: 255 lbs × 7" STAYS.** Six words, a measurement rather than an inference, and the
  only thing left on the screen that says where the numbers in front of you came from.
- **The undo toggle went with the note.** Nothing else offered a way back to last time's numbers;
  every stepper still overrides them.

### D. Swap and Remove are loud now

Tim: *"Make the swap and remove boxes in a workout stand out just like the +add set button."*

⚠️ **THIS REVERSES AN ARGUMENT THIS FILE MADE.** They were deliberately quiet — transparent,
`--ink-soft`, beside the name — on the D4 reasoning that swapping is occasional and must not compete
with the steppers. His answer is that a control you cannot find is worse than one you can, and he is
the one using this in a gym.

⚠️ **32px OF PAINT, 44px OF HIT**, via the `::before` the icon buttons have used since the first
audit. Matching `.add-set` is a request about how loud they look, not permission to ship a 32px
target on the screen most used one-handed. **And they left the name's line** — three pills beside a
heading leaves about 110px for "Chest-Supported Dumbbell Row" at 360px.

### E. 🚨 A friend's profile photo — a decision, not a bug fix

Tim: *"when you put a profile picture into your account, your friends can't see the profile
picture… its just the default blank humanoid, not the picture that they actually added."*

⚠️ **HE IS RIGHT, AND IT WAS DELIBERATE.** `views-account.js` said so in as many words:
*"Local-only for now: the avatar is NOT published into the social projection… publishing a face is a
widening that gets its own decision, not a side effect of this feature."* **This is that decision,
made by the person whose face it is.**

- **It rides beside the name at EVERY tier**, because `profile` is IDENTITY and the tiers cut
  TRAINING. Somebody on *"just that I trained"* already sees the name you chose. **Nothing about who
  may read the document changed** — that is the viewers list and firestore.rules, untouched, and
  `validProjection()` already allowed a `profile` key so the rules needed no edit.
- 🚨 **`safeAvatar()` IS A TRUST BOUNDARY IN BOTH DIRECTIONS and one function decides both.** Going
  out it is one of this app's few big strings against a 1 MiB document ceiling shared with 60
  activity entries; coming in it is a string another account wrote that this app puts in an `src`.
  **Base64 raster only — never `image/svg+xml`** (a document that can carry script) **and never a
  remote URL** (which would tell somebody else's server who looked at their face and from where).
  Capped at 120,000 characters ≈ 90 KB; over that the projection carries no avatar rather than a
  document that silently stops publishing.
- ⚠️ **THE CAP IS NOT THEORETICAL** — the probe proved it by accident: a 200 KB repo asset was
  refused and the glyph drew instead, which is exactly the intended behaviour.
- **Adding or removing a photo republishes.** Without it the change would reach friends only when
  something else did — the fault that froze Autumn's published muscle map at a pre-training
  snapshot. 🚨 **"Remove" that leaves your face on somebody else's feed is a worse version of it**,
  so the removal path republishes too and a test pins it.
- ⚠️ **AND THE SENTENCE ON THE ACCOUNT SCREEN CHANGED WITH THE BEHAVIOUR.** It read *"Only on this
  account — friends do not see it"*, which was true and is now false. A stale reassurance about who
  can see somebody's face is the worst wrong text this app could carry.
- **Three places paint it**: the feed card, the friends list and the friend's own page. The list
  fills in **after** the rows paint — their photo costs a read per friend and that is the screen Tim
  once reported as *"a long delay and lag to it that's alarming"*.

### F. The muscle map's big number now says what it is

Tim: *"it shows a weight and a bar and '____ for _____'. Problem is, I have no idea what that weight
means. Is it for a specific exercise, or the one it's basing its decision off of?"*

**Neither — and that it took a question to find out is the finding.** The number is an **estimated
one-rep max on that muscle's KEY LIFT** (Chest → Barbell Bench Press, Triceps → Close-Grip Bench
Press, and so on through `MUSCLE_LIFTS`), which every contributing exercise is converted into by a
published ratio. **That is the whole basis of the screen and it had never been named on it.** One
line under the weight now says so: *"Estimated 1-rep max in Barbell Bench Press."*

- ⚠️ **THE WORD "ESTIMATED" IS HALF THE POINT, and the test asserts both halves.** The line directly
  beneath it names a REAL recorded set — *"from Barbell Bench Press 220×3, Jul 17"* — and naming the
  lift without saying the number is inferred would put a measurement and an inference in consecutive
  lines with nothing to tell them apart. Rule 5.
- **Measured rather than assumed to fit**: the longest key-lift name there is renders **332×17 at
  360px**, one line, no overflow, and the caption measures **8.5:1** in both themes. The panel's
  40-word cap still holds at **31 words**.
- ⚠️ **The estimate appears in exactly one place**, which is why this is one edit: the Bars view
  shows per-exercise `~max` (already labelled an estimate) and a friend's published map carries
  levels and percentiles, never the weight.

**And the answer to the second half of his question, recorded because nothing on the screen says it
either**: the rating is **not** the heaviest set ever. Sets over 15 reps are refused; each admissible
set becomes an e1RM, divided by its ratio to the key lift; direct evidence beats compounds; one value
per exercise per day, then one per exercise; each scored by ratio quality × reps × recency (120-day
half-life) × within-session fatigue × 1.25 for a benchmark; **the top three by CREDIBILITY rather
than by size**; winsorised to ±25 % of their weighted median and averaged. Each input is a best
showing, so it is an upper-envelope estimator — but the answer is a blend of three, deliberately hard
for one flattering number to move.

### G. All three contributors are named on the muscle panel

Tim: *"you mentioned how the muscle group estimate is based off your top three recordings based on
credibility, but when you click on a muscle it only shows one recording. Could you instead show all
3?"* It showed `contributors[0]` and nothing else, so a number built from three exercises looked like
a number built from one. It now reads *"from … and … and …"* in the credibility order they are
weighted in. ⚠️ **The test drives THREE DIFFERENT exercises on three days**, because `rateMuscle()`
gives each exercise one seat — three sessions of one lift would have produced one line and passed for
the wrong reason.

### H. 🚨 A CUSTOM EXERCISE NO LONGER SETS A STRENGTH LEVEL, and the library grew by 43

Tim's friend went looking for a dip machine, could not find one, made a **custom exercise**, filed it
under Triceps and logged **60 lbs × 10**. The app rated her **triceps Advanced, Low confidence**,
beside a column of Beginners. He asked how a custom exercise could possibly know what it trains.

**It did not know. She told it** — the create form's muscle dropdown — and the conversion was
**guessed from the equipment dropdown**: Barbell 0.90, Machine 0.80, Cable 0.65, Dumbbell 0.70,
Kettlebell 0.60, at a fixed quality of 0.20. Her numbers, run through the real code:

```
60 × 10       →  e1RM 90.9 lbs on that machine
90.9 ÷ 0.80   →  113.6 lbs of "close-grip bench press"      ← the guess
113.6 vs the female median of 85  →  82nd percentile  →  ADVANCED
```

- 🚨 **THE LOW QUALITY ONLY PROTECTS A MUSCLE THAT HAS OTHER EVIDENCE.** 0.20 stops a custom
  outvoting a known lift; she had no other triceps lift, so it was the only voice in the room and led
  outright. That is the hole in the original reasoning, and it is not fixable by lowering the number.
- ⚠️ **AND "MACHINE" IS NOT A MEASUREMENT.** No dropdown can tell an *assisted* dip machine — where
  the 60 lbs is HELP, and she pressed her body weight minus 60 — from a plate-loaded one.
- ⚠️ **THE SAME ARGUMENT `bodyWeightFractionFor()` HAS ALWAYS MADE.** That function refuses to guess
  a body-weight fraction for a custom exercise from its equipment, *"which is exactly what this table
  refuses to do"* — while this file guessed a strength ratio from the same dropdown. Only one of
  those two positions could be right.

Tim: *"expand the library of exercises instead of trying to calculate the input of a custom exercise.
Still allow the user to create a custom lift, but don't let it contribute to the score."*

- **A custom exercise is still first-class everywhere else** — logged, charted, counted in weekly
  volume and on the volume map. What it cannot do is set a level, and the creator sheet says so
  BEFORE it is created rather than leaving it to be discovered on the muscle map.
- 🚨 **THE REFUSAL IS THE FIRST LINE OF `buildContributions()`**, not a branch on the muscle rule —
  otherwise a custom exercise named "Barbell Bench Press" still matched the key-lift path, which
  awards **ratio 1.00 at quality 1.00**, the strongest evidence this app holds. Asserted.

**And the library went 275 → 318.** Every addition either converts to its muscle's key lift or says
why it cannot; the rule for this pass was **carry an anchor where a genuine near-relative exists,
and leave it unrated where the leverage is unknowable** — because a labelled guess on a machine is
the same mistake one level up.

- 🚨 **THE TWO DIP MACHINES ARE NOT THE SAME THING, and that is the headline.** **Assisted Dip** (and
  **Assisted Chin-Up**) joined `BODY_WEIGHT_FRACTION` with `assist: true`, so more on the stack is a
  **lighter** set — proved by a test that walks 20 lbs to 100 and asserts the resistance falls. The
  file's own comment said adding one was *"a one-line job"*, and it was. **Machine Dip** — the
  seated stack — gets **no ratio at all**: its leverage is unpublished and varies by brand.
- 🚨 **SIX LIBRARY EXERCISES WERE SILENTLY UNRATED**, found by walking all 275 through
  `contributionsFor()` rather than by anybody noticing: Larsen Press, Cable Press Around, Kroc Row,
  Cross-Body Cable Triceps Extension, Wrist Roller and Banded Hip Abduction matched no rule,
  contributed nothing, and said nothing. Four have ratios now and two have explanations, and **a
  test asserts no rankable library exercise can ever again do neither.**
- ⚠️ **THE ORDERING TRAPS THIS PASS CAUGHT.** *Seated Leg Press* would have fallen into the 45°
  sled's 1.73 and been over-rated by ~57 %; *Machine Fly* would have taken the generic `/Fly/`
  0.30 instead of the pec deck's 0.90; *Incline Dumbbell Shrug* would have taken the standing
  dumbbell shrug's 0.70. Each has its own rule ABOVE the family's, and each ordering is asserted.
- ⚠️ **Two Full Body additions broke the volume map and its own test caught them within a minute** —
  anything on that shelf matching no rule falls back to "Full Body", which is not a muscle.

### Two smaller things found on the way

- 🚨 **`social.available` DOES NOT EXIST, and two places read it.** It is a field of what
  `social.state()` RESOLVES TO, not a property of the module — so it was `undefined` for everybody.
  In the runner's people sheet that meant **a signed-in person with no friends yet was told to sign
  in**; it now reads `net.available`, which is the answer already in hand two lines above. The new
  republish call had the same guard written into it and would have silently never run. **Found by
  writing the expression a second time and checking it.**
- ⚠️ **The exercises sheet's first drag handle failed the audit's 44px hit test on all 20 samples**
  (30×40 of paint, nothing around it). It has the `::before` now and hits 44 everywhere. **The
  arrows are 40×24 and do NOT reach 44 — a stated trade**: two stacked targets cannot both be 44px
  tall in one 56px row that also carries a handle, a name and a delete. 24px is the WCAG 2.2 AA
  minimum in both directions, the drag is the comfortable path, and the arrows are what a keyboard
  and a screen reader get, where a thumb box is not the measure that matters.

**Audit: 80 route/width/theme combinations, 7,814 text nodes, zero below 4.5:1, zero horizontal
overflow, zero unnamed controls.** The exercises sheet is a new audit route — a sheet is only ever on
screen after an interaction, and it asserts it landed.

**Tests: 3,523 across twelve suites** — render 705 → **751**, social 162 → **172**, a11y 85 → **87**.
Five mutations, each flipping only its own assertions: re-point by index → the "still on the Zercher
squat" assertion alone; render the values on an open row → the two morph assertions; drop the
click-off control exemption → the Add-set one; skip the republish on Remove → that one.

⚠️ **NOT VERIFIED: none of this has been touched on a real phone.** The drag is proved with a
synthetic pointer in headless Chrome, which is not a finger on glass — **whether a row follows your
thumb pleasantly is Tim's call**, and so is whether the set row morphing feels right mid-set. 🚨 **And
the face has never crossed between two real accounts**: it is proved in the projection builder, in
jsdom and as painted pixels, which is a different claim from "Autumn opened the app and saw Tim".

---

## 2026-08-30 IN FOUR LINES, newest first

🛑 **A. THE APP ICON IS OFF THE PROJECT. DO NOT OFFER IT, DO NOT DRAW MORE.** Tim, 2026-08-31: *"I
don't really like any of the icons right now. I think it was a mistake for you to work on them. I'm
going to improve it later myself. Forget that section of the project."* The six candidates and
`docs/icon-options/` are **deleted** (recoverable at commit `fb72f8d` if he ever asks). `icon.svg`
was never touched and stays as it is. **The artwork is his to do.**

🆕 **B. EXERCISE PICTURES ARE BUILT AND THE ART IS A PURCHASE HE HAS NOT MADE.** A thumbnail beside
every exercise name, tap for full screen. 🚨 **The load-bearing assertion is about ABSENCE** — with
nothing bought, no thumbnail renders and no name becomes a button, so every screen is what it was.
The style he wants is Gym Visual's, a paid library; `img/exercises/README.md` is the how-to.

🆕 **C. SWAP OPENS ON FIVE ALTERNATIVES, AND A PERSON CAN LEAVE A WORKOUT.** 43 hand-written
movement families over 271 of 275 exercises, spread across equipment, with the full picker one tap
under. 🚨 **Four exercises have NO family on purpose** — adduction is the *opposite* of abduction on
a machine that looks the same. And the ✕ that removes somebody exists **only on the person you are
already recording for**, so it is never next to a chip you are aiming at to switch.

🆕 **D. DATA → RESEARCH TEACHES THE BASICS.** Eleven topics, each with a confidence label in words
and its own stated weak spot, 27 sources. ⚠️ **Three answers are pinned as text assertions because
the popular version is the opposite of the finding** — stretching does not reduce injury risk,
"not to failure" is not permission to stop early, and no time of day is better.

---

## 2026-08-30, fourth pass — 🛑 THE APP ICON, CLOSED BY TIM ON 2026-08-31

He asked for icon options on 2026-08-30 (*"replace the main cite logo… generate me a couple sweet
options and I'll choose one"*). Six were drawn. **He did not want any of them**, and closed the whole
thing the next session: *"I don't really like any of the icons right now. I think it was a mistake
for you to work on them. I'm going to improve it later myself. Forget that section of the project."*

🛑 **SO IT IS OFF THE PROJECT. Do not draw more, do not offer it as work, do not ask which of the six
after all.** `docs/icon-options/` is **deleted** — the six SVGs, the contact sheet and the renderer
are in commit `fb72f8d` if he ever changes his mind, and nothing else needs to know they existed.
**`icon.svg` was never touched and stays exactly as it is.** The artwork is his.

⚠️ **THE LESSON, WHICH IS THE ONLY REASON THIS SECTION STILL EXISTS**: this was the one piece of work
this project has done that Tim called a mistake to have started. It was **taste**, not engineering —
six aesthetic candidates generated ahead of any way to tell a good one from a bad one, and no test,
measurement or argument could settle it because the answer lives in his eye. **When the deliverable
is a matter of taste, the design work is his and the build work is yours.** Contrast the colour
options of 2026-08-26, which he did pick from — the difference is that those were about legibility,
which is measurable.

⚠️ **ONE TECHNICAL FINDING SURVIVED THE CLOSURE AND IS DELIBERATELY NOT BEING ACTED ON.**
`index.html` points `apple-touch-icon` at `icon.svg`, and iOS has never supported SVG there — it
requires a PNG, and falls back to a screenshot of the page without one. **Recorded, not fixed**: it
belongs to the icon he is going to do himself, so it is his to land with the artwork rather than a
loose end to raise. Checked against Apple's guidance and Lighthouse's own audit, never against his
phone. **If he ever hands over new artwork, ship it as PNG at 180 and 512 beside the SVG, and check
Android's maskable safe zone — `manifest.webmanifest` declares `"purpose": "any maskable"` on a
single file, so no painted point may sit more than 204px from the centre of the 512 canvas.**

---

## 2026-08-30, third pass — 🚨 EXERCISE PICTURES ARE BUILT AND THE ART IS A PURCHASE TIM HAS NOT MADE

Tim: *"I want to have a way to display pictures of the exercises so the user knows what it looks like
in the app, no matter where it is displayed… if the user clicks on the name of the exercise, it will
pull up the picture that takes up the screen."* He sent two reference images and asked to be shown
what I found before anything was used.

🚨 **THE ART IS GYM VISUAL'S, AND IT IS A PAID STOCK LIBRARY.** That style — grey anatomical figure,
worked muscles in red, two frames — is theirs; 6,698 illustrations, male and female. It is why every
fitness site looks the same. **It cannot be lifted from the sites that re-host it**: the largest
public dataset that does says in its own licence file *"obtain your own license there before reusing
the media."* Bulk price is under **$0.75 an illustration** (~$240 for all 318 of ours, ~$30 for the
40 most-used) and the licence permits commercial app and website use with no attribution and no
royalties. ⚠️ **One clause to settle by email before buying**: it forbids *"making available on a
website for download"*, and a PWA serves image files at URLs. Aimed at wallpaper sites, but theirs
to say.

⚠️ **THE ONLY OPEN SET THAT COVERS A WHOLE LIBRARY IS EVERKINETIC** (CC BY-SA, 289 exercises, two
frames each) and **it is black-and-white line art with no muscle highlighting** — a different thing,
and it would need a credit line. Shown to Tim; he did not take it.

🚨 **THIS IS THE SECOND LICENSING WALL THIS PROJECT HAS HIT ON SOMEBODY ELSE'S ANATOMY ART.**
`docs/research.md` §11 records the first — a watermarked Dreamstime asset that could not be used,
which is why the body map is hand-authored. **Check the licence before building around an image.**

**Tim's call: build it, images later.** So the feature ships and the art is a purchase whenever he
wants it.

- 🚨 **NO PICTURE IS AN ORDINARY STATE, NOT A MISSING FILE — and that is the load-bearing
  assertion.** `exerciseLabel()` with nothing to show returns the plain name it would have rendered
  anyway: **no placeholder, no broken-image box, no reserved gap.** A screen with no pictures is
  byte-for-byte what it was before this shipped, which is the only thing that makes shipping ahead of
  the art safe. **Mutation-checked**: render an empty square instead and exactly that assertion fails.
- **Where they appear**: the session runner's heading, the finish screen, a workout's exercise list,
  a ready-made system's list, the calendar day, the edit form, the exercise picker and the swap
  shortlist.
- ⚠️ **THE NAME IS THE BUTTON WHERE IT CAN BE, AND THE THUMBNAIL IS NEVER ONE INSIDE A ROW.** A
  button inside a button is invalid HTML and needs a `stopPropagation` that holds until somebody adds
  the next control — `.set-del` and the people bar's ✕ both learned that. So `exerciseLabel()` takes
  `inControl`, and a row keeps being the only control on the row.
- ⚠️ **KEYED BY EXERCISE ID, NEVER BY NAME.** `Cable Kickback` exists twice in the library (Triceps
  and Glutes) and the id is the only thing that separates them — a name-keyed manifest would
  eventually paint a triceps picture over a glute exercise and nobody would report it. Asserted.
- ⚠️ **A GENERATED MANIFEST, NOT A HAND-KEPT LIST.** `tools/build-exercise-images.mjs` scans
  `img/exercises/` and rewrites both `js/exercise-images.js` and **the sw precache block** — because
  **D6**: a picture the worker was never told about is a picture missing in a gym basement. A test
  compares the manifest against the directory, so a forgotten rebuild fails loudly. ⚠️ **The tool
  REFUSES a badly-named file rather than skipping it**, because a picture that never appears looks
  exactly like a picture that was never bought.
- **The picture sits on white in both themes, hard-coded** — these illustrations carry their own
  ground, and on a dark surface an inherited background is a glaring rectangle with a ragged edge.
  Same call the QR code made on 2026-08-29.
- ⚠️ **The thumbnail is `contain`, not `cover`** — a square crop of a two-frame illustration takes the
  gap between the frames and throws away the outer half of each figure.

⚠️ **PROVED WITH A STAND-IN I DREW, which is not shipped.** The scratch copy got a hand-made SVG for
22 exercises: runner thumb **38×38**, the name really is a button, the viewer opens **342px wide**
(full width — the first version sized to the artwork's own pixels and rendered a 600px illustration
346px wide in the middle of a black screen), the ✕ is 36 painted and **hit-tested at 44**, and the
name reads **17.4:1** on the dim ground. Rows without a picture are visibly unchanged in the
screenshots. ⚠️ **The audit does NOT cover this path** — there is no art to audit; the shipped
no-art state is the 76-combination run below.

**Tests: data-layer 1750 → 1763, render 686 → 705. 3,465 across twelve suites.**

---

## 2026-08-30, second pass — SWAP OFFERS ALTERNATIVES, AND A PERSON CAN LEAVE A WORKOUT

Two asks from Tim.

🆕 **A. SWAP OPENS ON FIVE ALTERNATIVES, NOT ON 275 EXERCISES.** *"when the user clicks on 'swap' it
will show them a few alternative exercises that will achieve the same or similar result… Underneath
this list… a button that brings them to the full list."* Built exactly that. `js/exercise-families.js`
is a new pure module: **43 movement families over 271 of the 275 exercises**, hand-written.

- ⚠️ **NOT DERIVED FROM THE NAME.** Stripping "Dumbbell"/"Incline"/"Machine" off a name and grouping
  the remainder would look clever and be wrong quietly — "Dumbbell Pullover" is not a pullover press,
  **"Cable Kickback" is two different exercises** (Triceps and Glutes, same name), and "Close-Grip
  Bench Press" is a triceps builder wearing a chest exercise's name. Every membership is a judgement,
  and **a test asserts each of the 271 resolves to exactly ONE exercise** — the `preset-systems.js`
  lesson applied to a second by-name table.
- 🚨 **FOUR EXERCISES HAVE NO FAMILY ON PURPOSE, AND A TEST PINS THAT.** Hip Adduction is the
  **opposite movement** to Hip Abduction on a machine that looks identical; same for Neck Curl against
  Neck Extension and Tibialis Raise against the calf raises. **Offering one for the other would be the
  most misleading row this feature could produce.** They fall back to "same muscle group", which the
  sheet labels differently and honestly.
- ⚠️ **ONE PER EQUIPMENT TYPE BEFORE ANY SECOND ONE.** Ranked on score alone a leg press offered
  *"Back Squat, Front Squat, High-Bar Squat, Low-Bar Squat, Box Squat"* — five barbell squats, all
  correct, all the same answer — while the hack squat and goblet squat sat below the cut. It now
  spans four kinds of equipment, which is Tim's own framing as the specification.
- 🚨 **AND THE LEAD ONLY PROMISES WHAT THE LIST DELIVERS — caught by a screenshot, not by a test.**
  It read *"Same movement, different equipment"* unconditionally, and a **Deadlift offers four barbell
  deadlifts** under it: every row right, the sentence above them false. Single-equipment families
  now say *"Other ways to do this movement"*. A caption that overclaims where it can teaches a reader
  to stop believing it where it matters.
- **The full picker is DEMOTED, never replaced** — *"Show all 275 exercises"* sits under the list and
  opens the sheet that was there before, unchanged. A shortlist you cannot escape is worse than none.

🆕 **B. A PERSON CAN BE TAKEN BACK OUT OF A WORKOUT.** *"in case it was just a test, or an accident,
or something happened."*

- ⚠️ **THE ✕ EXISTS ONLY ON THE PERSON YOU ARE ALREADY RECORDING FOR**, and that is the safety design
  rather than a layout economy: a destructive control is never adjacent to a chip somebody is aiming
  at to **switch**. Reaching it costs the tap you would take anyway — and in the accident Tim leads
  with, the app has just switched to them, so it is already there.
- **Nothing recorded → it goes quietly. Sets recorded → a confirm that says the count**, which is
  `removeExercise`'s shape. ⚠️ **A friend's confirm says the other half**: their session was going to
  be offered to their own account at Finish and now will not — a consequence outside this phone, so
  it does not get to be implied.
- ⚠️ **The saved identity is NOT deleted**, and the sheet says so. Removing somebody from today is not
  deleting them from your list; that has its own control. Same argument D22 makes about systems.
- 🚨 **Nothing was ever on disk**: a guest's sets live in the draft until `finish()` writes them, so
  this deletes a plan rather than a record. A test finishes the workout afterwards and asserts **no
  guest row is written for either removed person**.

⚠️ **A PROBE FAULT WORTH RECORDING, because it looked exactly like an app bug.** Driving the people
bar over CDP, two sheets stayed open after adding somebody — at 390px in one run and at 360px in the
next, which is the signature of a race and not of a width. **It was the DRAFT resuming between
iterations**: the second run re-entered a session that already held "Jordan", so adding him again was
correctly refused and the sheet correctly stayed open to be fixed. Clearing the draft per iteration
made both widths identical. **Probe honestly** — §0.6 keeps being right.

**Audit: `summary` and the swap SHEET both joined** — a sheet is only ever on screen after an
interaction, so no sheet in this app had ever been measured. **76 combinations, 7,566 text nodes,
zero below 4.5:1, zero overflow, zero unnamed controls.** ⚠️ **`.person-del` is NOT in that number** —
it needs a guest on the bar, which the audit's demo session has none of. It was measured by hand over
CDP (28×30, labelled, one per bar), and its colours are the accent pair `tests/a11y.test.mjs` already
sweeps across all four palettes.

**Tests: data-layer 1728 → 1750, render 653 → 686. 3,433 across twelve suites.** Three mutations,
each flipping only its own: put the ✕ on every chip → the four "one control, on the active person"
assertions fail; skip the confirm when sets exist → that one fails; make the lead unconditional →
the two deadlift assertions fail. ⚠️ **The first version of the "exactly one ✕" test was VACUOUS** —
with a single guest it passed against a mutation that put a ✕ on every chip. It drives two people now.

---

## 2026-08-30 — DATA → RESEARCH TEACHES THE BASICS NOW

Tim: *"I want to collect information to educate users on the basics of weightlifting and some of the
stuff science has confidently determined… a lot of information can be completely false or
missrepresented, so before we put anything on here, we need to be confident… if there might be a
conclusion that isn't super solid, don't add it, or if you do, state your confidence."* He listed
seven questions; all seven are answered, plus four more.

🆕 **ELEVEN TOPICS UNDER THE RESEARCH TAB, EACH CARRYING ITS OWN CONFIDENCE AND ITS OWN WEAK SPOT.**
`js/research-topics.js` is the content (pure, testable, sourced); `views-data.js` only draws it.
**27 sources, every one opened during the pull, each defined exactly once** — a citation written
inline is a citation that drifts, which is how the Goals screen once lost the words *"not a measured
fact"*.

⚠️ **SIX OF HIS QUESTIONS WERE ALREADY ANSWERED IN `docs/research.md`** and needed no new sources.
**Five needed a real pull** and are now §13 of that file: free weights vs machines, injury risk,
warm-up and stretching, time of day, and training to failure (plus the misconception sources).

🚨 **THE THREE CLAIMS MOST LIKELY TO BE FLIPPED BY A WELL-MEANING EDIT ARE PINNED AS TEXT
ASSERTIONS**, because in each case the popular version is the OPPOSITE of the finding:

- **Stretching does not reduce injury risk** — RR 0.99 [0.93, 1.05] over 9 RCTs. That is a precise
  null, not an "unclear". ⚠️ **Strength training itself cuts injuries ~44 %**, which is the sentence
  worth having. Scope stated: sports injuries in athletes, never gym injuries in lifters.
- ⚠️ **"You don't need to go to failure" is NOT permission to stop early.** Failure vs non-failure is
  0.12 [−0.13, 0.37] — nothing — *and* Robinson 2024 still finds growth rises as sets get closer to
  failure. **Both halves or the advice is wrong in a different direction.**
- **No time of day is better** — and the one real finding is that you perform best at the hour you
  usually train, which matters for testing a max, not for growing.

⚠️ **WHAT WAS DELIBERATELY LEFT OFF, and §13.6 says why**: any specific warm-up protocol (the
literature disagrees and the effects are trivial), stretching-for-hypertrophy, the fatigue cost of
failure training (repeated everywhere, no synthesis quantifies it), and *"machines are safer"* —
🚨 **which is on screen as an UNTESTED assumption rather than omitted**, because omitting it leaves
the reader holding the folklore.

⚠️ **AND THE APP'S OWN BLIND SPOT IS ON THE SCREEN**: the growth-vs-strength topic says outright
that the app can see what you recorded, not how heavy you planned to go — §6.13.3, which has been
true and unsaid to users since it was written.

### Two things the audit tool was getting wrong, found while measuring this

- 🚨 **A CLOSED `<details>` STILL REPORTS A BOX FOR ITS CONTENTS in this Chrome.** The collapsed
  Research pane and the opened one both measured **328 text nodes** — the audit has been claiming to
  measure text that was not on the screen, and the research TABLE has been counted that way since
  2026-08-28. ⚠️ **Never a false pass** (the colours are the ones painted on open) **but a false
  coverage claim**, which is the `#/data` fault of 2026-08-24 in miniature. Fixed in `visible()`.
- ⚠️ **`summary` matched nothing in the audit's control selector.** It is natively focusable and
  carries no `tabindex`, so **every disclosure control in the app has been unmeasured for touch
  target and accessible name since the first one shipped.** Added; the topic summaries measure
  **49–78 px tall by 332/362 wide**, comfortably past 44.

**Re-run after both fixes: 72 route/width/theme combinations, 7,378 text nodes, zero below 4.5:1,
zero horizontal overflow, zero unnamed controls.** A new audit route opens every topic and
**asserts it landed**, so the content is measured rather than the headings.

**Tests: data-layer 1437 → 1728, render 641 → 653. 3,378 across twelve suites.** Both new
load-bearing assertions mutation-checked, each flipping only itself: make the topics open by default
→ the "arrives collapsed" assertion fails alone; drop a point's sources → "point 4 cites something"
fails alone. ⚠️ **The word budgets are the point of the data-layer half** — every other assertion
anybody would write here checks that something is PRESENT, and none of them can see prose piling
back up. Same argument as the muscle panel's 40-word cap.

⚠️ **NOT VERIFIED: nobody has read this on a real phone.** It is measured in headless Chrome at 360
and 390 in both themes and screenshotted; whether eleven collapsed rows read well under a thumb is
Tim's call.

---

## 2026-08-29, newest first

🚨 **A. A USER DIRECTORY EXISTS NOW, AND IT REVERSES A DECISION THIS PROJECT MADE ON PURPOSE.**
Tim asked for QR codes, name search and friend requests. He was told the trade first — QR and
requests are free, **name search is not** — and answered: *"Right now the website has less than 5
users so just do the name search to keep it easy for now and then we can work on making a different
version eventually."*

⚠️ **THE OBJECTION WAS ACCEPTED, NOT ANSWERED.** Firestore rules cannot constrain a query's `where`
clause, so the `list` permission name search needs **grants paginated enumeration of every row**.
There is no version of free-text name search that does not. What bounds it: the directory document
holds a uid and a chosen display name and is **shape-checked in the rules so it can never grow an
email field**, and **the rules test asserts the enumeration as an `allow`** — a suite that pinned
only the good news would describe a feature this app does not have. ⚠️ **The narrowed replacement,
for when "eventually" arrives, is a HANDLE at get-yes / list-no** (`docs/social-plan.md` §3.4
already blesses that shape); **that `allow` is the line that flips to a denial the day it lands.**

**QR codes and friend requests cost nothing and are pure gain.** 🚨 **Accepting a request needs no
new permission at all** — it republishes with the asker in `viewers`, which makes the shared
document readable to them under a rule from 2026-08-18, so they learn by an existing read
succeeding. Eventual on their side, and the screen says so. The QR encodes `#/add/<uid>`, permanent,
never a one-time invite link that would go stale in a pocket.

🆕 **B. RECORDING FOR A FRIEND SENDS IT TO THEIR ACCOUNT.** Tim: the guest feature's *"main want…
was so that one person could record the details for two+ people that do have accounts."* The picker
leads with your real friends; picking one carries their **uid**; **Finish offers their half to their
account** for them to accept. Their suggestion is read from **the training they already share with
you** and 🚨 **never merged with what you recorded for them** — a doubled session is exactly what
makes progression propose MORE WEIGHT, which is the one thing in this app that can hurt somebody.
🚨 **The send sits OUTSIDE the save's error path**: reporting "not saved" over a workout that was
saved is the worse of the two lies. Invented people are **saved identities** now, deduped by name in
the store.

🆕 **C. THE SET LIST IS THE SCREEN, AND THE STEPPERS LIVE INSIDE THE OPEN SET.** The runner was
showing the same numbers twice — a detached block of big steppers headed `SET 1 OF 4`, and set 1
again in the list under it. ⚠️ **The digits and ± targets did NOT shrink** (30px / 46×52, measured) —
that was the constraint, because the usability drive named them among the things not to break.
⚠️ **And the session runner had never been in the accessibility audit at all**; it is now, and the
first version of that step silently audited the workout picker instead — the `#/data` fault of
2026-08-24 arriving through a different door.

🆕 **D. FOUR SMALLER ASKS, and two of them carry an argument** (see the fourth-pass section):

- ⚠️ **A NEVER-DONE EXERCISE OPENS SOMEWHERE USABLE — and this is NARROWER than what Tim asked
  for.** He wanted "a beginner amount of weight". 🚨 **`finish()` saves any set with a number in it,
  and a never-done exercise prefilling ZERO was the only case the open "prefilled counts as
  recorded" defect could not reach.** So the opening numbers are marked `prefilled` and the save
  path refuses to count them; one keystroke clears it. **Reps open at 10** (the app's own default
  band). **The weight is DERIVED from their own recorded lifts**, never invented — and where it
  cannot be derived honestly the field stays empty and the note says so.
- **A location you type is the DEFAULT from then on**, not a copy of the last session — the old rule
  copied whatever the last workout had, *including nothing*.
- **The finish screen shows the workout** instead of a button leading to it, has **one** action, and
  **a back arrow into the edit form** for an accidental tap.
- ⚠️ **`screenShell({ back })` TAKES A FUNCTION** — `el()` silently ignores a non-function `onX`, so
  five back buttons rendered and did nothing. Caught by a test that CLICKS rather than reading an
  href.

---

⚠️ **STANDING INSTRUCTIONS THAT SURVIVE THIS RESET — read before suggesting any work.**

**PINNED (do not offer as "the next thing to do")**: activity PRs, the Strava feed exclusion, the
competitive review, the effect-size research. The **PINNED** table in Open work carries the
reasoning for each. Tim, 2026-08-28: *"do everything you think is an actually good change, then pin
the rest for later (don't bring them up as the 'next thing to do' later though)."*

**DECLINED outright (do not resurface at all)**: every improvement to the **rest timer**, which is
**OFF by default** behind Settings → Rest timer. Tim: *"it just doesn't help… it's a sub-feature."*
**And the APP ICON / logo artwork**, closed 2026-08-31 — *"I'm going to improve it later myself.
Forget that section of the project."* 🛑 **Not a pin, not a park: he has taken the job back.**

🔁 **A RECURRING JOB HE ASKED FOR, 2026-08-31 — FOLD CUSTOM EXERCISES INTO THE LIBRARY.** *"Then,
periodically we could look into the custom exercises and add them to the library."* Custom exercises
no longer set a strength level, so every one somebody makes is a **gap in the library with a name
attached** — the best list of what is missing that this project will ever get. ⚠️ **The data is on
each account** (`customExercises`) and there is no way to read somebody else's, so this runs by
ASKING Tim what he and his circle have created, not by querying anything. The recipe is in the
2026-08-31 section: add the row, give it a ratio **only** where a real near-relative exists, put it
in a movement family, and let the tests catch the rest.

**PARKED at his instruction**: AirPods controls, importing food, live Strava sync (needs Blaze).

---

## STILL REQUIRED READING FROM 2026-08-28

🚨 **THE EMERGENCY.** Tim: *"something you did erased the workout sessions I recorded."* The sharding
migration's "emptied = migrated" flag blanked the legacy sessions document; his phone — on the old
cached build, which reads ONLY that document — showed an empty calendar. **His two sessions (Pull
08-24, Legs 08-25) were never gone from the server and are restored.** PITR is off, so a stale-cache
loss cannot be DISproved: ⚠️ **if Tim ever says more sessions existed, believe him and start at his
phone's localStorage.** The redesign: the shard path **cannot address the legacy document at all**
(it is a frozen backup floor now), mass deletes are **refused** without a declared wholesale flag,
pre-wipe snapshots **abort the wipe if they fail**, and every account keeps a **7-day rolling cloud
backup**. *A flag that destroys information is not a flag.*

⚠️ **AUTUMN'S "LOST" DATA WAS A FROZEN PROJECTION.** Her account was never touched — her published
muscle map was an EMPTY PRE-TRAINING SNAPSHOT, because **nothing ever republished after recording a
workout**. Publish follows the data now, and a **boot heal** republishes stale projections — hers
fixes itself the next time she opens the app, and until she does Tim still sees the empty map:
**expected, not a recurrence.** ⚠️ **PITR (7-day server history, the strongest guarantee) needs the
Blaze card — if Tim ever says yes to Blaze, enable PITR first.**

**The rest of 2026-08-28, in one line each:** ✅ **0b(c) closed** (one document per session; no
ceiling at ~520 sessions) · ✅ **0h closed** (the last ratios derived — and the worst entries were
the ones somebody had REASONED about) · a live **duplicate-exercise read bug** fixed · the
**usability drive** (four findings still waiting on Tim's pick) · **Data → Research** shipped
(Harbo 2012; Chest/Back/Traps named as unmeasured rather than invented) · **Remove-an-exercise**
beside Swap.

**And 2026-08-27:** the profile-photo cropper (✅ confirmed fixed on his phone) · the Friends tab's
lag (three serialised round trips before a pixel moved) · a **CSS comment that was never closed**,
eating a rule that had never rendered · **file import** (`#/import`) · **0e** and **0j** closed ·
Blaze priced (effectively free; the cost is a card on file and no hard cap).

**Tests: 3,553 across TWELVE suites**, recounted 2026-08-31 — data-layer **1783**, render **756**,
goals 232, bodyweight **175**, social 172, a11y 87, optimal 76, strength-estimate 72, volume-map 64,
demo 58, year-grid 45, qr 33 — plus **147 rules assertions in the emulator** and 12 in
`sw-update`. ⚠️ Treat any number here as a recount rather than a running tally.
Sub-agents are pre-authorised (saved to memory).

⚠️ **KNOWN FLAKE, NOTED RATHER THAN HIDDEN**: `tests/sw-update.test.mjs` drives real headless
Chrome with fixed sleep windows and can miss them when the whole suite loads the machine (2 fails
in 6 under load, 0 in 10 idle). Pre-existing; its windows deserve a condition-poll someday.

⚠️ **THE OTHER FLAKE THIS PROJECT HAD WAS THE TEST'S FAULT, and the lesson is the point** —
`render` checked that a guest's numbers stayed out of the owner's session by grepping the whole
serialised session for the substring `95`, which a millisecond timestamp or a base-36 id hits often
enough to be seen. **Fixed 2026-08-28.** *A test that fails at random teaches people to re-run it,
which is the habit that hides a real failure.*

⚠️ **STILL UNVERIFIED IN THE FIELD**: ⚠️ **FIRST — Tim confirming his calendar shows Pull + Legs
again after the restore** (if it does not on a fresh open, that is an emergency report). Then:
Autumn opening the app on a current build (her frozen projection heals itself and her muscle map
appears to Tim — until then he still sees the empty one, which is EXPECTED), the friend-name heal,
and a real kudos/comment round trip with her account.

⚠️ **AND EVERYTHING SOCIAL BUILT SINCE 2026-08-27 HAS NEVER RUN BETWEEN TWO REAL ACCOUNTS.** That
now covers a lot: the handoff and disconnect paths, **name search, friend requests, and recording a
workout for a friend** (2026-08-29), and — added 2026-08-31 — **the profile photo reaching a
friend's feed and their friends list.** All of it is
proved against the real rules engine and in jsdom, which is a different claim from "two people did
it". ⚠️ **The QR code is the exception and is better verified than the rest**: the app's own rendered
SVG was screenshotted and decoded from pixels by an independent decoder. **What no test can settle
is a real phone camera pointed at a real screen.**

⚠️ **File import has never parsed an actual export** from any of those services either — the column
names come from published documentation, which is precisely why every step is a preview the user
confirms.

⚠️ **AND NOTHING FROM 2026-08-31 HAS BEEN TOUCHED ON A REAL PHONE.** Specifically:
- **The drag** is proved with a synthetic pointer in headless Chrome — a row was dragged two places
  and its recorded sets went with it — which is not a finger on glass. Whether a row follows a thumb
  pleasantly is Tim's call, and so is whether the set row morphing feels right mid-set.
- **The set row can now be closed to nothing**, which the runner has never been able to do. If that
  reads as "the controls disappeared" rather than "the row went back to normal", it is a report.
- **The 43 new exercises** are asserted against the rating code, not against a person using them. The
  ratios carried from near-relatives (every "carried, not measured" comment in `muscle-evidence.js`)
  are the weakest part of that work and are labelled as such.
- 🚨 **The two new ASSISTED entries invert the sign of a logged number.** Assisted Dip and Assisted
  Chin-Up mean more weight on the stack is a LIGHTER set. The arithmetic is tested; what nobody has
  done is log one at the gym and check the number on the screen matches the machine.

⚠️ **AND THE RESEARCH TOPICS (2026-08-30) HAVE NEVER BEEN READ ON A PHONE.** They are measured in
headless Chrome at 360 and 390 in both themes, screenshotted and eyeballed — eleven collapsed rows,
nine of which fit one screen at 360px. Whether that list is pleasant to scan under a thumb, and
whether the answers are the right length for somebody standing in a gym, is a judgement only Tim can
make. **The facts are checked; the reading experience is not.**

⚠️ **AND ONE FIX IS UNCONFIRMED BECAUSE IT WAS NEVER REPRODUCED.** Tim, on a laptop, 2026-08-29:
*"the profile picture in the upper left-hand corner has a blue box around the circle… This isn't an
error on the iPhone."* A real latent bug was found in exactly that place — the global
`:focus-visible` rule was setting `border-radius: 3px` on the ELEMENT, squaring off the round avatar
and every pill-shaped chip with it, and it cannot happen on iOS because a tap does not raise
`:focus-visible`. **That is fixed.** ⚠️ **But the ring it draws is the accent colour, not blue**, and
headless Chrome never showed a blue one — so the diagnosis is the best account of a real symptom
rather than something measured. **If it is still there, it is a new report and wants a screenshot.**

**Prefer a report from Tim's phone to anything in this file.**

**2026-08-26 was the biggest build day this project has had — NINE dated sections**, every one on
Tim's explicit instruction:

- **Guest workouts** (0e's guest half), **kudos + comments** on a new tested rules path (0l),
  **location** as a typed label (0m), **the ratio sweep** — 28 lifts derived from published
  standards, **personal bests on the finish screen**, **body-map hit halos** (0i's cheap half), the
  **polish sweep**, and **four colour palettes as a Settings choice** (0k — Tim picked all three).
- Then a second wave: **Record is a CATEGORY CHOOSER and the app records non-lifting activities**
  (runs, swims, climbs — D2 narrowed to **D27**: recorded first-class, modelled not at all);
  **the rotation suggestion is least-recently-done now** (it was reading alphabetical order on
  self-built systems — Tim caught it with Pull/Legs/Push); **workout durations**; **the Account
  screen owns the person**; **the "Friend"-instead-of-name bug self-heals**; and
  **`docs/airpods-plan.md`** (research only, nothing deployed).

The day before (2026-08-25) the app was restructured, and most of what a
2026-08-24 reader knew about its shape is now wrong. Three batches landed after the second gym
session, all on Tim's instructions:

1. Record says **Start** and names the programme; a whole set row selects itself.
2. The level palette is **Tim's own** (Material, from a screenshot he sent), the muscle key is
   **chips**, percentiles are behind a **More details** setting, and the grey text got much darker.
3. **Home is a Strava-style FEED of friends' workouts.** Everything that starts a workout moved to
   Record. **Goals left the tab bar; Calendar took its slot.** Data opens on Muscles.

⚠️ **THE NAV, HOME AND THE MUSCLE COLOURS ALL CHANGED ON 2026-08-25.** Any sentence below
about "five tabs ending in Goals", "Home opens on the next workout" or the old OKLCH level ramp is
history, not the app. Read the top of this file, then the **Open work index**.

⚠️ **NOTHING IS BLOCKING.** Tim can use the app, he is on a current build, and the tests are green.

**What waits on TIM rather than on you** — and item 0 is the only urgent one:

0a. 🛑 **THE APP ICON IS NOT ON THIS LIST ANY MORE.** Tim closed it on 2026-08-31 — *"a mistake for
   you to work on them… I'm going to improve it later myself."* The candidates are deleted and
   `icon.svg` is untouched. **Do not raise it.**
0b. ⏸️ **BUY EXERCISE PICTURES, OR DON'T.** The feature shipped on 2026-08-30 and the art is a
   purchase — Gym Visual, ~$0.75 an illustration in bulk. `img/exercises/README.md` is the how-to
   and the licensing. **Nothing is broken while he decides**: with no pictures the app looks exactly
   as it did before.
0c. ⏸️ **THE GREY ABS — TWO FIXES OFFERED, NEITHER PICKED (2026-08-31).** He asked why a muscle group
   he trains shows "no recordings". The panel says the right thing on tap; the COLOUR does not, and
   the legend's only grey entry is "No data". Offered: (i) unrankable muscles get their own mark and
   legend line, (ii) the panel names the volume it HAS counted. The details are in the header of this
   file. ⚠️ **This is the only thing in the app right now that says something false to a reader**,
   which is why it sits above the older items rather than at the bottom.
0d. 🔁 **WHICH CUSTOM EXERCISES HAVE HE AND HIS CIRCLE MADE?** His own instruction, 2026-08-31, and
   it can only be answered by asking him — nothing here can read another account's customs. Every
   answer is a library gap with a name on it.
0. 🚨 **CONFIRM THE RESTORE**: does his calendar show Pull (08-24) and Legs (08-25) on a fresh
   open? **And does he believe more sessions than those two ever existed in the cloud?** If yes to
   the second, recovery starts at his phone's localStorage (Account → upload from this device).
1. **The four usability findings** await his pick (2026-08-28 second-pass section): wake lock,
   prefill-counts-as-recorded at Finish, the Record chooser tap, the "28"-parses-as-seconds nit.
   Recommended order if he just says "go": wake lock, then Finish honesty.
   ⚠️ **The prefill one is now HALF fixed and the halves are worth keeping apart.** A never-done
   exercise is safe as of 2026-08-29 — its opening numbers are marked `prefilled` and the save path
   refuses to count them. **An exercise WITH history is exactly as it was**: walk past it and last
   time's numbers are recorded as though you did them. That was left alone deliberately — it is a
   behaviour change on every workout and it is his to pick, not a side effect of a smaller job.
1b. ⚠️ **THE BLUE BOX ROUND THE PROFILE PICTURE — does it still happen?** A real bug was found and
   fixed in that exact place (see "unverified" above), but a *blue* one was never reproduced, so
   this needs his eyes. A screenshot settles it.
1c. **Does he want the HANDLE version of search?** Name search shipped on his explicit call with
   fewer than five users. The narrowed design — exact lookup of a handle, nothing enumerable — is
   specified and ready; it is a decision rather than a discovery. See section A.
2. Whether logged **warm-ups** should be excluded from the volume count (0c). His call because the
   obvious fix would also throw away genuine back-off sets.
3. His friend's **failed sign-in** (0f) — he asked to investigate it himself.
4. **Blaze — a card on file, effectively $0** — now buys something concrete: ⚠️ **enabling PITR
   (7-day server-side history) is the first thing to do with it**, then live Strava sync stays
   possible later.
5. **AirPods stem-press controls** — ⚠️ parked at his instruction ("wait", 2026-08-27).
6. **Importing food** — ⚠️ parked at his instruction; needs a narrowing decision, not a quiet fix.
7. **Which activities his circle actually logs** — `docs/activities-plan.md` §3 item 6 says to ask
   rather than guess.
8. ⚠️ **The social features built on 2026-08-29 want two real accounts** — search somebody, send a
   request, accept it, and record a workout for a friend so it lands in their account. Every one is
   proved against the rules engine and none has been done by two people. **This is the single most
   valuable thing he could do next**, and it is ten minutes with Autumn.

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

1. **THE PHONE IS THE LIVE THREAD, AND TIM IS NOW DRIVING THE DESIGN DIRECTLY.** ⚠️ **The
   2026-08-22 note here said "do not redesign Home unasked". That is dead** — he asked, in detail,
   with a reference app, and Home was rebuilt as a feed on 2026-08-25. What replaced the old note is
   sharper: **he sends screenshots and specific instructions, and he is right about his own app.**
   Twice now he has reversed a call this file argued for (a sole heading is "decoration"; Calendar
   belongs inside Data) and been correct both times, because his argument was about **how the screen
   is used** and this file's was about what the screen *is*. **Frequency and use beat taxonomy.**
   ⚠️ **The look is his too, and he has now exercised it**: he picked all four colour
   palettes on 2026-08-26 (0k closed), and the level colours are his own screenshot.
2. `docs/improvement-plan.md` §0 records seven reviews briefed on 2026-08-19 that never ran. **SIX
   HAVE NOW RUN and every one found something real** — adversarial code review, cross-screen
   consistency, the first accessibility audit this project ever had, and, all on 2026-08-22, **edge
   cases / data integrity, the live social round trip, and human behaviour / UX.** Only the
   **competitive** review is left, and it inspects the market rather than the app.
   ⚠️ **Running a review is not closing it.** Most of the edge-case list closed on 2026-08-24; **the
   UX list is still the open one** (Open work 0c).
3. **⚠️ IT HAS NOW BEEN TRAINED WITH, AND THAT IS A DIFFERENT KIND OF EVIDENCE FROM LOOKING AT IT.**
   Tim ran a real session with a friend on 2026-08-24 — *"for the most part it worked great"* — and
   it turned up **four defects no test, no review and no screenshot had found in five months.** Six
   reviews and 2300 assertions had passed over every one of them:
   the assist machine's suggestion ran **backwards**; a fatigued third exercise **led** a muscle
   rating and *raised* its confidence; the dumbbell row **flattered every lifter by 15 %**; and
   restoring a backup could **take down every screen but Settings**.
   ⚠️ **PREFER A GYM REPORT TO ANYTHING IN THIS FILE.** One session produced more real findings than
   six commissioned reviews. What made them findable was somebody *using* it, and what made them
   fixable was measuring before designing — every one of those four was diagnosed wrongly on the
   first guess, including by this file.
   Before that, a real device had opened the app exactly twice, settling three things — the keyboard
   fix works, Google sign-in works in the installed PWA, and the app can get stuck on the auth
   handler. Everything else about touch is still a desktop engine driven at phone metrics, and
   **three "needs hardware" survey items remain reasoned rather than measured.** ⚠️ **Do not let a
   good device report promote the rest**: what a phone confirmed is in Verified and nothing beyond it.

**Status:** Live and working. **Tier 1 is complete.** Firebase is provisioned and verified end to
end. **Five nav tabs: Home, Workouts, RECORD, Data, Calendar** — Record is the big middle button.
⚠️ **Changed 2026-08-25**: Calendar came back out of Data as its own tab, and **Goals left
the bar** — it is not deleted, `#/goals` still resolves and Settings links to it. Social is still
the Friends half of Home.

The app works with **no network** (D6), records weights in **lbs or kg**, has a rest timer, lets a
workout be logged for another day, lets a past record be edited from the calendar, and can mark a
whole workout as a benchmark.

**HOME IS A FEED** (2026-08-25) — a Strava-style list of what the people you train with have been
doing: their name, the date and time, the workout's title, the exercises, then kudos / comment /
share. ⚠️ **Nothing on Home starts a workout any more.** That moved to **Record**, which
opens on **the next workout in your rotation** — it reads your last session and offers the one
after it in that programme, saying what it read. ⚠️ **Kudos and comment do not work yet**
and say so when pressed (0l); **there is no location anywhere** (0m).

⚠️ **THE FRIENDS TAB NO LONGER WAITS ON THE NETWORK TO PAINT** (2026-08-27, Tim's iPhone report). It
returns its shell immediately and fills in after, the cloud graph and invite reads are cached like
every other read, the invite list is fetched once rather than twice, and a friend's three tiers are
probed in parallel rather than one refusal at a time. See that day's section.

**Sets have TYPES**: supersets, tri-sets and giant sets (walked round by round, with the rest timer
holding off until the end of a round), plus drop sets and myo-reps (mini-sets nested inside one set,
which stays one hard set). D23.

**A workout can change its mind mid-session** (2026-08-24): **Swap** an exercise for another one, for
today only. If sets are already logged it splits — what you did stays under the exercise you did it
on — and the saved workout is never touched.

**Workouts live inside SYSTEMS**, and there is an **Explore** screen of **nine** ready-made systems.
Six are credited to real people. **Every system carries a BADGE of four numbers** — growth and
strength (banded to 5), plus **days a week and minutes a session** — on Explore, on the Workouts list
and on a system's own screen, including systems the user built themselves. The scores say how good a
programme is; the other two say what it costs, and a score without that is half a sentence.

**Social is built**: mutual friends by invite link, per-person visibility (everything / my workouts /
just that I trained / nothing), a friend's page showing their body map and recent workouts, and
**since 2026-08-25 the Home feed**. ⚠️ **A session's START TIME is published at the middle
tier and above** — never at the lowest, which is the default everybody starts on, because a
widening must be an act by the owner rather than a side effect of a deploy.
✅ **Two real accounts connected over the live project on 2026-08-22** — invite, claim, accept, tier,
publish, read, downgrade, disconnect, each checked against what Firestore actually hands the other
account. ✅ **Disconnect is MUTUAL since 2026-08-27** (0j closed) — the leaver drops a note and the
other client acts on it. ⚠️ **Eventual, not instant**, and the sheet says so.

**The body map** is Tim's own illustration, split into a recolourable fill layer and an ink layer. It
rates every muscle from **every exercise that trains it**, each rating carrying a **confidence** that
desaturates the colour, and the **comparison group is the user's choice**. ⚠️ **Since 2026-08-19 a
rating is led by the most CREDIBLE evidence rather than the biggest number** — that inversion was the
worst defect this model has had, and §9 is the write-up.
⚠️ **Two more corrections landed on 2026-08-24, both found by Tim training with it.** A reading is
now discounted for **work already done on that muscle earlier in the same session** — fatigue used to
*promote* a bad reading, because a rep count cannot tell a heavy set from a tired one. And four
**per-side dumbbell ratios were 7–15 % too generous**; the errors are not a constant, so the rest of
that table was still suspect (Open work 0h). ✅ **0h CLOSED 2026-08-28** — the sweep
finished, and the last three corrections were entries somebody had **reasoned about** rather than
left unchecked. Two of them inverted an ordering. See that day's section.

⚠️ **THE LEVEL COLOURS ARE TIM'S OWN SINCE 2026-08-25** — Material red / orange / green / cyan
/ blue / purple / pink, sampled from a screenshot he sent, with the cyan the one step this app had to
add and the only candidate that made nothing worse. **The key is CHIPS** with each level's name
inside it, and those chips are load-bearing: the palette fails the colour-blindness adjacency check
that the ramp it replaced passed, and direct labels are the stated price of that. **The old ramp's
monotone lightness is gone**, so colour alone no longer orders the levels. Full write-up in the CSS.

**Percentiles are hidden by default** — a **More details** setting in Settings turns them back on.
The levels are still computed from them; only the readout is hidden.

**Neither chart mode is a dead end**: where there is not enough history to draw a line, they list
where every lift stands right now.

⚠️ **GOALS IS OFF THE TAB BAR since 2026-08-25 and is NOT deleted** — `#/goals` resolves,
Settings links to it, and all three of its screens have a back button. Built 2026-08-19. A goal is
one muscle moving up a **strength level** over twelve
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
strip on every screen says so. **PUBLISHING is hard-disabled in it** — `republish()` refuses —
because pushing invented workouts at real friends is the one way this could do harm.
⚠️ **But the demo HAS friends since 2026-08-25**, and that distinction is the point:
reading an invented feed is not the hazard, publishing is. Without them the Home feed would have been
unjudgeable in the one account built for judging screens — including to the accessibility audit,
which drives the demo.

---

## 2026-08-29, fourth pass — A NEW LIFT OPENS SOMEWHERE USABLE, AND THE FINISH SCREEN GREW A WAY BACK

Four small asks from Tim in one run, written up together because they landed together.

### 0. The two that are simply better, with the reasoning kept

**A LOCATION YOU TYPE IS THE DEFAULT FROM THEN ON.** Tim: *"If the user ever sets a location for that
workout, have that be the default and auto-filled in location for every workout they fill in after
that."* ⚠️ **The old rule read the most recent session and copied whatever it had, INCLUDING
NOTHING** — so one workout logged without a label (a back-dated session, a quick activity, a day in
a hurry) silently reset the default to blank and the next three had to be typed again. **A default
that any single omission erases is not a default.** It is a setting now, written the moment the gym
is typed rather than at Finish, because somebody who types their gym and then abandons the session
has still told the app where they train. **Removing it leaves THIS workout without a location and
keeps the default** — blank is "not this one", never "forget where I train", and the sheet says so.
⚠️ **This deliberately reverses the 2026-08-26 note** that said "clearing it is a choice, and an
older label resurrecting itself would overrule it": that reasoning was about the last SESSION being
the source of truth, and the source of truth is now a setting.

**THE FINISH SCREEN SHOWS THE WORKOUT AND HAS A WAY BACK OFF IT.** Tim: *"keep the back button in
case they wanted to quickly change something or accidentally clicked on the finish workout button"*,
and *"instead of having 2 buttons: 'view workout' and 'back to home', just display this workout and
then keep the back to home."* "View this workout" led to a screen describing what the screen you
were on had already summarised in one line, and left two primary-looking actions where there is one
thing to do next. ⚠️ **The back arrow goes to the EDIT FORM, not into the runner**: the session is
already saved by the time that screen exists — that is the order `finish()` writes in — so "undo the
finish" would mean deleting a stored session on the one screen somebody just tapped by accident.
The edit form changes every part of what was recorded and is already built and tested. **Only shown
when there is an owner session to edit**; a coach who ran the whole thing for somebody else has none.

### 1. ⚠️ A NEVER-DONE EXERCISE — AND WHY THIS IS NARROWER THAN WHAT HE ASKED FOR

Tim: *"If a user has added a new exercise that they've never done before, instead of setting the
weight and rep number to 0, put the amount to a beginner amount of weight and an average number of
reps (maybe 10). Add a note that this is their first recording and they should change it."*

🚨 **THE BLOCKER THAT SHAPED IT: `finish()` SAVES ANY SET WITH A NUMBER IN IT.** There is no
"touched" flag anywhere in this app — the only thing separating a plan from a record is *whether the
number is zero*. So the 2026-08-28 finding **"prefilled counts as recorded"** — which is still open
— bites every exercise **with** history, and the one place it could not bite was a never-done
exercise, **precisely because it prefilled zero.** Filling that in naively would have deleted the
last safe case.

⚠️ **SO THE OPENING NUMBERS ARE MARKED `prefilled`, AND `setIsRecorded` REFUSES TO COUNT THEM.**
One nudge or keystroke clears the flag and the set is theirs. **Tap Finish having touched nothing and
nothing is recorded**, which two assertions pin — including the derived weight, the number that
would otherwise be the most convincing. ⚠️ **The flag is set ONLY on these opening numbers**: the
history-based prefill behaves exactly as it did, because resolving a finding Tim has not picked from
is not this task's business.

**Reps open at 10, and 10 is the app's own number rather than a guess.** `repRangeFor()` falls back
to the 8–12 band the position stand names for novices, and **10 is the only round number strictly
inside it** — 8 and 12 each sit ON a band boundary, which `repRangeFor` resolves downwards, so
starting at either would put a brand-new lifter at the top of a range and hand them a load increase
two obedient sessions later.

⚠️ **THE WEIGHT IS DERIVED, NOT INVENTED — AND WHERE IT CANNOT BE DERIVED IT IS LEFT ALONE.** A
"beginner amount" has only two possible sources and both are claims about a person the app has never
met: an invented constant, or the 5th percentile of **people who lift and log**, which needs a body
weight a new user has not given and rests on the number `strength-standards.js` itself calls the
weakest in the file. What the app *can* do honestly is run the body map's own arithmetic backwards —
`muscleStrength()` divides every recorded set by a published ratio, so multiplying back out gives
this lift's likely load from **their own sets**. Gated at the two thresholds that already mean "not
good enough to speak" here: ratio quality ≥ 0.45 (which correctly excludes most machines) and
confidence ≥ the Fair band, direct contributions only.

⚠️ **AND IT NEEDS A COMPLETE PROFILE**, because `muscleStrength()` returns `ready: false` without
gender, birth year and a body weight — the same reason the body map is grey for that account. **So a
genuinely brand-new user gets reps and an empty weight field**, which is the honest answer and what
the note then says.

⚠️ **THE NOTE DOES NOT WEAR THE GREEN CHECK.** `.prefill-note`'s check is `--good` and sits beside
"Last time: 135 lbs", which is a **measurement**. A worked-out weight is an inference, and Rule 5's
general form is that the two must be separable by a cue that is not colour alone — so the derived
case borrows `.suggest-note`, the app's existing "this is a proposal" treatment, and says the number
was worked out rather than measured.

⚠️ **`fillOnOpen` HAD TO LEARN THE SAME RULE.** It refuses to fill a set that "already has numbers",
and a first-ever exercise now opens at 10 reps — so set 2 stopped inheriting the weight just typed
into set 1. A set still marked `prefilled` counts as empty there, because empty has always meant
"nobody has put anything here".

### 2. Two bugs found by writing the tests, not by review

- ⚠️ **`store.muscleStrength()` DOES NOT EXIST** — it is a module-level export, not a method. The
  call was inside a `try` whose whole job is to degrade quietly, so **the derivation silently did
  nothing and the screen looked exactly like the honest no-history case.** A catch-all that hides a
  typo is a catch-all that hides a feature.
- ⚠️ **`applySuggestion` RETURNS NEW OBJECTS**, so a flag set on `lastSets` was dropped on the way
  through — and a missing flag is the difference between a starting point and a workout nobody did
  written to disk. Caught because the test read 11 reps rather than 10.

### 3. `screenShell({ back })` TAKES A FUNCTION, AND FIVE BACK BUTTONS DID NOTHING

Found by the finish-screen test. `back` is handed straight to `iconBtn` as its onClick, and `el()`
silently ignores a non-function `onX` — so the string hashes used on the new Add-a-friend and
Add-by-code screens rendered back buttons that were completely inert. ⚠️ **The assertion CLICKS the
button rather than reading an href**, which is the only version that would have caught it.

**Tests: render 628 → 641.** Two mutations, both flipping the safety assertions: removing the
`prefilled` guard from `setIsRecorded`, and letting the save path filter on `hasNumbers` again.

---

## 2026-08-29, third pass — 🚨 A USER DIRECTORY EXISTS NOW, AND IT REVERSES A LOCKED DECISION

Tim: *"I want each user to have their own QR code where they can show another person and it will
automatically share that user's profile where that person can add them as a friend. Additionally,
you can just search users on the site in the friends section and if there is a user with that name
they can send a friend request to that person, and then that person can accept it."*

He was told the trade before it was built — QR and friend requests are free, name search is not —
and answered: *"Right now the website has less than 5 users so just do the name search to keep it
easy for now and then we can work on making a different version eventually."*

### 🚨 THE PART A FRESH SESSION MUST NOT MISREAD

`js/social.js` has said since the day it was written: *"There is no user directory in v1 and this is
why. A searchable list of accounts is an enumeration surface that has to be right the first time; an
invite link is a capability you hand to one person."* **That sentence is no longer true of the app.**
It is left standing in the file on purpose — it is the reasoning somebody needs to get the property
back.

⚠️ **THE OBJECTION WAS NOT ANSWERED. IT WAS ACCEPTED, WITH ITS PRICE NAMED.** Firestore rules cannot
constrain a query's `where` clause — `request.query` exposes only limit, offset and orderBy — so the
`list` permission that name search requires **grants paginated enumeration of every row**. There is
no version of free-text name search that does not. What bounds the damage is the document: a uid and
a display name the person chose to publish, **shape-checked in the rules so it cannot grow the one
field it must never hold**, and a rules test asserts that an email is refused.

⚠️ **THE RULES TEST FOR THIS IS WRITTEN AS AN `allow`, DELIBERATELY** — "any signed-in account can
list the whole directory" is asserted as true, because a suite that only pinned the good news would
describe a feature this app does not have. **When the handle version is built, that line is the one
that flips to a denial.**

⚠️ **THE NARROWED VERSION, for when "eventually" arrives**: `handles/{handle}` → uid, `get` yes and
`list` **no** — exact lookup of a handle you chose, nothing enumerable, a leaked handle costing one
lookup. `docs/social-plan.md` §3.4 already blesses that shape. Delete the `directory` block the day
it lands.

### What shipped

- **Search by name**, on a new **Add a friend** screen (`#/find`). ⚠️ **Matched in the CLIENT, not in
  the query**: a Firestore prefix only matches the start of the whole string, so "smith" would never
  find "Anna Smith" — and since `list` already hands over every row, matching here costs nothing
  extra in exposure and is strictly better at finding the right person. Prefix of the whole name or
  of any word; **never a substring inside a word**, because "nn" finding "Anna" is how a list of
  strangers starts looking like a list of matches. Ranked shortest-whole-name-prefix first.
- ⚠️ **Somebody already connected is SHOWN AND FLAGGED, not filtered out.** "You are already friends"
  and "no such person" are different answers and dropping them silently is the worse one.
- **Friend requests** at `users/{uid}/requests/{fromUid}` — modelled on `disconnects`, deliberately
  **not** put inside `invites`, which allows `get` to anyone signed in because a link must be
  readable to be redeemed. An invite is a capability I ISSUED; a request is something asked OF me,
  and two meanings in one collection is how a read rule ends up wrong. **The document id IS the
  caller's uid**, so you may ask in your own name and nobody else's, and asking twice writes the same
  document.
- 🚨 **ACCEPTING NEEDS NO NEW PERMISSION AT ALL, and it is the nicest thing in this pass.** Accepting
  adds them to my graph and republishes, which puts them in `viewers` and makes my shared document
  readable to them **under the rule that has existed since 2026-08-18**. So the asker learns they
  were accepted by an **existing read succeeding**. No "accepted" flag, no reverse tombstone, no
  write into anybody's account. ⚠️ **Eventual on their side**, like mutual disconnect, and the
  Friends screen says so when it happens.
- ⚠️ **`graph.pending` is what makes that safe**: only people **I** asked are ever probed, so nothing
  anybody writes anywhere can add themselves to my friends list.
- **A QR code, permanent** — `js/qr.js`, a dependency-free byte-mode encoder, versions 1–6, all 8
  masks scored. ⚠️ **It encodes `#/add/<uid>`, NOT an invite link**: an invite is a one-time
  capability that expires in 7 days, so a QR of one goes stale in a pocket. Tim asked for *"their
  own"* code — singular, permanent. Scanning is the other person's **camera app**; there is no
  scanner to build.
- ⚠️ **The code is BLACK ON WHITE in both themes, hard-coded, never a token.** An inverted code is
  legal and recent iPhones decode one; plenty of Android scanners do not, and a code that fails on
  somebody else's phone fails at the one moment it exists for. A render assertion pins the two fills.
- **Settings → Findable by name**, opt-out, defaults on. ⚠️ **Described as a courtesy, not a
  protection, because the rules cannot enforce it** — a client can always write its own row. Calling
  it a privacy control would be the same class of overclaim the disconnect sheet shipped with.

### Verified

- ✅ **THE RENDERED QR DECODES FROM ACTUAL PIXELS.** The app's own SVG was screenshotted over CDP at
  240 px and the PNG handed to `jsQR`: an 88-character profile link, version 6, decoded byte-for-byte.
  That tests the whole chain — encoder, path building, CSS sizing, theme — not just the matrix.
- **33 QR assertions**, including ZXing's published Reed-Solomon vectors and a round-trip decode of
  60 varied payloads. ⚠️ **The suite does NOT assert which mask any payload gets**: ZXing, Nayuki and
  the ISO text disagree on penalty-rule-3 details, so a correct implementation can legitimately pick
  a different mask. Scoring produced 6 different masks across those payloads, which a hard-coded mask
  could not.
- **Rules 117 → 147 assertions**, run and deployed.

**Tests: render 595 → 619, social +25, qr +33.** Two mutations, each flipping only itself: a
theme-coloured QR flips the black-on-white assertion; treating "asked" as connected flips the
row-state assertion.

---

## 2026-08-29, second pass — ⚠️ RECORD FOR A FRIEND, AND IT GOES TO THEIR ACCOUNT

Tim: *"I love how it is right now where you can have set people have their own identity on your own
account, however my main want for this feature was so that one person could record the details for
two+ people that do have accounts… look up one of your current friends and add them to your workout
instead of inventing someone new. Then, once you're finished with the workout it will send the
workout to that user's account where they can accept it… Also if you do create a new person to your
account, save them as an identity so you don't have to recreate the same person over and over."*

**Both halves of 0e finally meet.** The guest half (a name with no account, 2026-08-26) and the
handoff half (offer → they accept, 2026-08-27) existed but never touched: the handoff was a thing you
went to the **calendar** to do, one record at a time, after the fact. Now picking a friend at the
start of the workout is what wires them together, and Finish does the sending.

- **The picker leads with FRIENDS.** "Who is training with you?" lists your real connections first,
  then people you record for, then *Someone new*. Picking a friend carries their **uid**, so nothing
  is ever matched on a typed name.
- ⚠️ **THE TWO LISTS COME FROM DIFFERENT PLACES ON PURPOSE.** Friends are read live off the friends
  list every time; only invented people are saved to this account. Copying a friend into the saved
  roster would be copying a **name that goes stale the day they rename themselves** — and their uid
  already identifies them better than any label.
- ⚠️ **A FRIEND'S SUGGESTION COMES FROM THEIR OWN TRAINING** — read from the projection they already
  publish to you, under rules that did not change, bounded by the tier **they** chose. At the default
  tier ("just that I trained") it carries no sets and the screen **says so** rather than reading as
  broken. Confirmed in a browser: Autumn's 115 × 8 prefills with her own progression reasoning.
- 🚨 **AND IT IS NEVER MERGED WITH WHAT I RECORDED FOR THEM.** A session I recorded and they accepted
  exists on both sides with **different ids** (accept mints a fresh one), so a merge shows the same
  workout twice — and progression reads the last two sessions of a lift, so a doubled session is
  *"you did that weight twice in a row"*, which is the input that makes it **propose more weight**.
  That is the one thing in this app that can cause physical harm. **One source, and their own
  account wins.**
- ⚠️ **SENDING HAPPENS AFTER THE SAVE AND MAY NEVER BLOCK IT.** The offer is a network write to
  somebody else's account and no signal in a gym basement is the normal case, not the exception. The
  guest row is on disk before it runs, so it sits **outside** the try that reports "not saved":
  telling somebody their workout was lost when it was not is the worse of the two lies. A failure
  names the way out in the same line, and the offer id is deterministic so the manual re-send is one
  offer rather than two. **A render test drives a throwing `offerSession` and asserts the workout is
  still saved and the draft still cleared.**
- **Saved identities**: typing a name saves it **at the moment it is typed**, not at Finish, so an
  abandoned session still costs the typing only once. `savePerson()` is **idempotent by name** — the
  dedupe is in the store, not at the call site, because the failure it prevents is quiet (two "Alex"
  rows each holding half his training). ⚠️ **Deleting an identity deletes the NAME and nothing else**
  — every session recorded for them stays, the same argument D22 makes about deleting a system.
- **A friend's chip is marked** with a glyph (not a colour — the chip's colour already carries which
  person is active). Their sets are going somewhere a guest's are not, and that is worth knowing
  before you finish rather than on the summary screen.
- The calendar's *"Send this to …"* **no longer asks who** when the row already carries a uid — it
  was offering the chance to send somebody's training to the wrong person.

**New collection `people`** (id, name, createdAt, lastUsedAt), added to `COLLECTIONS`,
`knownCollection()` and deployed. Guest rows gained `personId` and `forUid`.

⚠️ **KNOWN GAP, stated rather than hidden: a guest cannot be LINKED to an account later.** Record for
"Alex" three times, then Alex joins and you connect — his old rows stay under the invented identity
and his new ones go to his account. Nobody has asked for the merge; it needs a UI and a decision
about what happens to sessions he never accepted.

⚠️ **Caught by driving it at 360px**: the friend row's subtitle clipped to *"their workout is sent to
them at the e…"* — the half that says what the tap does. `.row-sub` is nowrap-with-an-ellipsis;
`.wrap` plus shorter copy fixes it. **Exactly the fault found on the visibility sheet on 2026-08-18**
(*"…your muscle map and your pr…"*), on a different screen, two weeks later.

**Tests: render 574 → 593**, rules re-run green. Both new load-bearing assertions mutation-checked,
each flipping only itself: move the offer inside the save's try → the three failed-send assertions
fail alone; ignore the friend's shared training → the two prefill assertions fail alone.

---

## 2026-08-29 — ⚠️ THE SET LIST IS THE SCREEN NOW, AND THE STEPPERS LIVE INSIDE THE OPEN SET

Tim: *"During the workout right now it shows the current selected set's measurements really big in the
middle and the full list of the sets below it, including the one it's on now… there should be no
large current selected set details display, and instead the list of sets should be large and share
the space in the middle, and then when you select one, it makes it larger and you can add or subtract
the weight amount or number of reps after it is open."*

**He is right, and the reason is sharper than "it takes up room": the screen was showing the same
numbers twice.** A detached block of big steppers headed `SET 1 OF 4`, and then set 1 AGAIN in a 14px
list underneath it — both live, both editing the same object, and the only thing linking them was the
heading and an accent square. That is a relationship you work out, not one you see. There is one set
of numbers per set now, in the row that IS that set, and the row you are on carries the controls.

- ⚠️ **THE DIGITS AND THE ± TARGETS DID NOT SHRINK — measured, not assumed.** The 2026-08-28
  usability drive named "the runner's huge stepper digits" among the things not to break chasing
  anything else. The same `.steppers` grid moves into the open row untouched: **30px digits, 46×52
  step buttons, identical at 360 and 390.** What was saved is the ~200px the detached block and its
  heading spent showing a copy of row one. **A 4-set exercise now fits on one screen with room under
  it; before, set 4 sat on the bottom edge.**
- **The rows grew** — 44px → **50px**, 14px → 15.5px — because the list is the content of this screen
  now rather than an index of it.
- ⚠️ **EXACTLY ONE SET IS ALWAYS OPEN, and tapping the open row does not close it.** `entry.active`
  has always been what the steppers point at, so a collapsed-to-nothing state would be a state with
  no way to log a number.
- ⚠️ **A NUDGE UPDATES THE ROW IN PLACE — this is the one that would have shipped as a bug.** The old
  `onChange` re-rendered the whole list, which was free while the steppers sat outside it and would
  now **tear down the input somebody is typing into, blurring it after one digit.** `syncSetValues()`
  repaints the text and leaves the nodes alone. Driven in a browser: after a `+` press the focus is
  still on the stepper and the row reads the new number. A render assertion holds the row NODE across
  the change, and **mutation-checked** — putting `renderSets()` back flips exactly it.
- ⚠️ **AND THE SCROLL IS KEPT.** The controls used to be at a fixed place near the top; they now sit
  wherever their set does. Opening a set restores the scroll position and then moves the **minimum**
  that brings the controls fully on screen. Driven with a **9-set** exercise from a cold scroll
  position: the last set's controls land fully visible.
- **A drop set finally reads like what it is** — set 1, its drop indented under it, the drop's own
  controls under that. The old layout could not show that at all, because the drop's controls were
  detached at the top. ⚠️ **The drop's PANEL is not indented, and that was tried first:** it pushed
  the steppers 22px off every other grid and wrapped the "counts as one hard set" line an extra time
  at 360px, for a relationship the `SET 1 · DROP 1` label already states in words. **Inside a
  superset the set number is the round**, so the list now literally shows the rounds.
- **`SET 3 OF 4` is gone from a plain set.** The row directly above the controls is that set, with its
  number in an accent square — a caption repeating it was a second answer to a question the layout had
  already answered. **Kept for a drop**, where the row shows `↳` and nothing else says which drop it is.

### ⚠️ AND THE SESSION RUNNER HAD NEVER BEEN IN THE ACCESSIBILITY AUDIT

Found while looking for somewhere to measure this. **The one screen the app exists for** — every
stepper, every set row, the rest bar, the Next/Finish pair — had no static route (a session needs a
workout id), and the audit's route list simply never reached it. It is in now, reached the way a
person reaches it: Record → Weightlifting → the next workout.

⚠️ **The first version of that step silently audited the WRONG SCREEN** — it matched `/^Start/`
against the chooser's rows, whose text begins with the workout's name, so four route-instances were
filed under "Session runner" while sitting on the picker. **That is the `#/data` fault of 2026-08-24
arriving through a different door**, and it is why the step now **asserts it landed** (`.set-list`
must exist) and why a failed step is **printed instead of swallowed**. A step that cannot prove it
arrived is a coverage claim nobody checked.

**Re-run: 68 route/width/theme combinations, 6,478 text nodes — zero below 4.5:1, zero horizontal
overflow, zero unnamed controls.** In the runner: `.set-pick` 298×50 at 360px and 328×50 at 390px,
`.step-btn` 46×52. Everything this change touched got bigger. ⚠️ **`.set-del` is still 21×21** —
unchanged by this work, and deliberately the one control on the row that should not be easy to hit.

**Tests: render 564 → 574.** Both new load-bearing assertions mutation-checked, each flipping only
itself: pin the editor to set 1 → "opening set 3 moves the controls" fails alone; restore
`renderSets()` in `onChange` → the in-place pair fails alone.

---

## 2026-08-28, seventh pass — REMOVE AN EXERCISE, BESIDE SWAP

Tim: *"add a button by the swap button that allows the user to delete this exercise entirely. Note
this works exactly the same as the swap button where it doesn't adjust the workout for future
systems, just that day's recording."*

**Remove** sits beside Swap in the runner: same quietness, same contract — the saved workout is
never touched. Where it deliberately does NOT mirror Swap, and why:

- ⚠️ **RECORDED SETS CONFIRM FIRST, WITH THE COUNT SAID OUT LOUD.** A swap KEEPS recorded sets
  (they were performed, so they split into the record); a removal DELETES them — that is what
  removing means — so one tap must not be able to do it. An untouched exercise goes quietly:
  pre-filled numbers are a plan, not a record.
- ⚠️ **A GROUP LEFT WITH ONE MEMBER STOPS BEING A GROUP.** `stepsFor()` builds blocks by adjacency
  and `groupLabel(1)` would happily print "Superset" over a lone exercise — telling somebody to go
  "straight into" nothing. The survivor keeps its sets and loses only the banner.
- **The last remaining exercise is refused** — an empty session has no screen to stand on; the ✕
  up top is the way out.
- Landing after a removal finds the STEP for the entry that took the slot — `state.index` walks
  steps, not entries, the same lesson the swap's split path already taught.

14 render assertions: the quiet removal, the orphaned-superset dissolve, the confirm and its
count, the refusal, the saved workout keeping all three exercises, the draft carrying the
removals. Driven and screenshotted at 360px — the name wraps and both buttons sit clean.

---

## 2026-08-28, sixth pass — ⚠️ AUTUMN'S "LOST" DATA WAS A FROZEN PROJECTION, AND PUBLISH FOLLOWS THE DATA NOW

Tim: *"my friend Autumn also recorded some stuff… I used to be able to see her muscle map and now I
can't… Make sure all data from any user can never be lost."*

**Read-only against the live project first, before touching anything: ⚠️ AUTUMN'S DATA IS FULLY
INTACT AND WAS NEVER TOUCHED.** Her account was never migrated (zero shard docs; her legacy
sessions doc still holds her session), her workouts/system/weigh-in/settings are all present, the
mutual full-tier connection stands, and her projection still lists Tim as a viewer.

⚠️ **WHAT HE COULD NOT SEE WAS NEVER DATA — her published `strength` array is EMPTY**, because her
projection was published at 21:25 on 08-25, **three hours before she recorded her session**, and
nothing ever republished it. **The bug: `republish()` was wired to every SOCIAL mutation and to
nothing that records training** — `social.publish()` even shipped commented *"after logging a
workout, say"*, and nothing called it. Every user's shared copy (feed cards AND muscle map) froze
at their last social action, forever.

- **`schedulePublish()`** — debounced 2.5 s, fire-and-forget, inert off the cloud — wired into
  saveSession, deleteSession, both benchmark writes, both body-weight writes, and importRows.
  ⚠️ **Guest sessions deliberately unwired**, and a test pins that: a guest's training is never
  published as the owner's.
- **`social.healStalePublish()`** on boot: republishes when what the account has **published** is
  older than what it has **recorded** (`needsRepublish()` in social.js, pure, tested — the Autumn
  timeline is its first assertion). ⚠️ **This is what fixes her frozen map — the next time she
  opens the app, with no action from her.** Until then Tim still sees the empty map; that is
  expected, not a recurrence.

**"Never lost, for ANY user", done server-side the same day**: an immutable `snap-*` backup of
every collection of **all five accounts**, written with the owner credential into each account's
own `users/{uid}/backups` subtree (Tim 8 docs incl. shard sessions, Autumn 5, the other three
covered). The client-side guards and rolling backups apply to each account as its device picks up
the current build.

⚠️ **PITR — the strongest guarantee there is (7-day server-side history) — REQUIRES BILLING.** The
enable call was made and refused with "requires billing". It is the Blaze decision Tim already
owns, at effectively zero cost for a database this size. **If he ever says yes to Blaze, enabling
PITR is the first thing to do with it.**

---

## 2026-08-28, fifth pass — THE RESEARCH TAB (Data · Research)

Tim: *"I'm really curious about where some of our information is coming from and how the site does
its calculations, as well as displaying just useful research… a graph with the x axis as age, y
axis % of maximum average strength for that muscle group… one line per muscle group… adjust the x
axis so that it only displays data from people it has solid evidence from."*

⚠️ **THE FINDING THAT SHAPED IT: Strength Level's by-age tables are ONE shared age model.** Bench,
deadlift and wrist curl, normalised to their peaks, agree within rounding at every age
(85.4 / 85.3 / 85.6 % at 15). Eleven lines from that source would be one line wearing eleven names —
so the chart draws from **Harbo, Brincks & Andersen 2012** (Eur J Appl Physiol 112:267–275,
DOI 10.1007/s00421-011-1975-3): 93 men and 85 women, 15–83, every major muscle group measured on
the same dynamometer. **Table 5's measured means by age band**, plotted at each band's mean age —
which bounds the x axis at **24–74 (men) / 25–73 (women)**, Tim's "solid evidence" clip falling
straight out of the data rather than being a judgement.

- ⚠️ **EIGHT LINES, NOT ELEVEN, AND THE SCREEN SAYS WHY** — no study measures pressing, rowing or
  shrugging across ages in a general population, so **Chest, Back and Traps are named as missing
  rather than invented.** `js/research-data.js` carries the data and the whole sourcing argument.
- The dashed reference line is the app's own grading curve (McCulloch/Foster — one curve for every
  lift), drawn against what the measured groups actually did. The prose block under the chart also
  answers the "where do the numbers come from" half: Strength Level standards and ratios, Marzagão
  2026 e1RM, powerlifting age grading, ratings from the user's own recorded sets.
- Built per the dataviz method: eight categorical hues **machine-validated** against all four dark
  surfaces and white (three hues under 3:1 on white → the labelled legend chips and the table view
  are the required relief, not niceties); fixed slot order; tap a band for a readout, tap a muscle
  to follow one line; series follow the profile's sex; isokinetic torque named as what it is.
- Driven and screenshotted at 390 and 360 in both themes — the four-segment row does not clip.
  Research added to the a11y audit's routes and `research-data.js` to the SW precache.

**Tests: data-layer 1443, render 550** — normalisation, ranges, the refused groups, and the
Shoulders-peak-in-the-30s shape that one shared curve cannot produce.

---

## 2026-08-28, fourth pass — 🚨 THE EMERGENCY: THE MIGRATION'S FLAG ERASED TIM'S CALENDAR

Tim: *"Emergency. I think something you did erased the workout sessions I recorded to my account.
My calendar is empty and my muscle group says nothing to rank yet. This can never happen. You need
to make it extremely difficult to erase data from people's accounts and even if you do, there's
some backup saved or something like that."*

### What actually happened, established by reading the live Firestore before touching anything

The sharding migration ran on his account (`0WQLOA…`) at 19:16:09 on the git-day: it moved the
sessions the legacy document held into per-session documents, **verified every one landed, and then
emptied the legacy document — its "migrated" flag.** His phone was still on the **previous build**
via the service-worker cache, and old builds read ONLY that document. Empty document → empty
calendar → *"nothing to rank yet."*

⚠️ **THE SESSIONS WERE NEVER GONE FROM THE SERVER.** Both recorded sessions — Pull 2026-08-24
(6 exercises) and Legs 2026-08-25 (4) — sat safe in the shard documents the whole time. They were
**restored into the legacy document via the Firestore REST API** (the CLI's own owner credential,
reads first, one write, verified by read-back), so old and new builds both see them again.

⚠️ **WHAT CANNOT BE RULED OUT, stated rather than hidden**: PITR is disabled on the project
(1-hour retention, elapsed), so there is no server-side history of the emptied document. The
migration provably moved everything the legacy read HANDED it — but a stale offline-cache read
could have handed it less than the server held, and verification cannot see what it was never
shown. Everything else on the account (6 workouts, 2 systems, goals, settings, the weigh-in) is
intact, and the account's whole write pattern is consistent with exactly two sessions ever having
been in the cloud. ⚠️ **If Tim believes more than Pull + Legs were recorded to his account, that is
a fact only he has, and it changes where to look next: his phone's localStorage may hold pre-cloud
rows (Account → upload from this device reads them).**

### The design that replaced it — Tim's instruction is the specification

1. ⚠️ **ADOPTION, NOT MIGRATION — the shard path can no longer address the legacy document at
   all.** No ref exists in the factory; it cannot write, empty, or "tidy" it, and the test double's
   strongest assertion is that NO setDoc is ever issued. Legacy rows are adopted into the shard
   (idempotent upserts), reads merge both sources (shard wins), and the legacy document stays
   forever as a **frozen backup floor** that old builds still read and write. This also closes the
   stale-cache hole — a partial read now adopts less, instead of destroying the difference.
2. ⚠️ **GUARDS.** A sharded write that would delete more than **2 rows** in one write is refused
   outright — nothing committed — unless the caller declares `wholesale`. The store refuses any
   non-wholesale write of `[]` over a collection the cache knows holds ≥ 5 rows. The legitimate
   emptiers (Clear all, Restore, deleteSystem, benchmark rebuilds) each declare themselves with
   the reason at the call site.
3. ⚠️ **BACKUPS IN THE USER'S OWN ACCOUNT** (`users/{uid}/backups/*`, owner-only): a **7-day
   rolling ring** (`rolling-{weekday}-{collection}`, refreshed at most every 20 h, prunes itself
   by overwrite) plus **immutable `snap-*` snapshots taken BEFORE Clear all and Restore run** —
   and ⚠️ **a failed snapshot ABORTS the wipe.** Rolling writes are never awaited on a save path.
   The rules deny update on `snap-*` even to the owner: a pre-wipe snapshot the wipe could
   overwrite protects nothing. **Rules tests 108 → 117, deployed.**

⚠️ **THE LESSON, for the next clever flag:** the migration's verification was sound about what it
saw; the *flag* was the fault, twice — it blinded every old client, and it turned "what I read" into
"all there is". **A flag that destroys information is not a flag.**

---

## 2026-08-28, second pass — ⚠️ THE USABILITY DRIVE, AND THE REST TIMER IS OFF BY DEFAULT

Tim asked for a usability analysis of the app — *"focusing on usability and looking for potential
design errors. Remember this app should be as hands-free as possible and is meant to be used on the
iPhone so it's quick."* The whole gym loop was driven in headless Chrome at 390×844 on the demo
account — Record → Weightlifting → Start → all nine steps → Finish — with screenshots and geometry
at every stage, plus the Run quick-log. First time anybody has walked the runner end to end in a
browser rather than reading it.

### What shipped from it — the rest timer is a setting now, OFF by default

Tim, on reading the findings (three of seven were about the rest bar): *"I don't love the rest
timer personally. When I'm working out it just doesn't help and it's easy for me to feel it out
myself. Leave it as a default turned off setting that the user can turn on. Let's not work on
improving it at all right now because it's a sub-feature."*

- **Off is the absence of the bar**, not a disabled bar — nothing renders, nothing ticks, and
  logging a set writes no `restStartedAt` into the draft. **On restores exactly what shipped**,
  cycling target chip and all.
- The gate is inside `startRest()` itself, so the superset / drop-set holdoff rules stay untouched
  for whoever turns it on — and the tests that prove those rules now switch it on first.
- **Settings → "Rest timer"**, Off/On chips, next to More details. Existing accounts flip to off
  too, because the setting defaults by absence — deliberate: the person who asked is the heaviest
  user, and the way back is one tap.

⚠️ **THE REST-TIMER IMPROVEMENT LIST IS DECLINED, NOT DEFERRED.** The findings below marked *(rest —
declined)* were put to Tim and he said no to all of them — "it's a sub-feature". **Do not pick them
up, suggest them, or fold them into other work.** Same standing as the PINNED table.

### The findings, ranked against "hands-free and quick"

1. ⚠️ **NO WAKE LOCK ANYWHERE.** The screen sleeps in 30–60 s, so every set starts with wake +
   Face ID. `navigator.wakeLock.request('screen')` held while a draft is active (re-acquired on
   `visibilitychange`) is one change and is the single biggest hands-free lever in the app.
   iOS ≥ 16.4. **Reported, not built — waiting on Tim's pick.**
2. ⚠️ **PREFILLED COUNTS AS RECORDED, so Finish saves sets you never did.** Proven end to end: a
   20-set demo workout "completed" with one nudge and nine Next taps, every set saved at last
   time's numbers — into volume, ratings, the feed and progression. Cutting a real session short
   at exercise 4 of 6 walks through 5 and 6 to reach Finish and saves them in full, silently. The
   hands-free-respecting fix is one line at Finish when whole exercises were never touched, not
   per-set confirmation. **For an app whose brand is refusing to invent numbers, this invents
   entire sets. Reported, not built.**
3. *(rest — declined)* The happy path had no "done" gesture, so matching the suggestion exactly
   never started the timer.
4. *(rest — declined)* The rest clock was the smallest important number on the screen (20 px
   against the steppers' ~44 px).
5. *(rest — declined)* "No target" default meant the done-signal never fired out of the box.
6. **Record's chooser layer taxes every gym day** — Record → Weightlifting → Start is three taps
   where two would do, and the chooser's own caption already knows the answer ("Next in your
   rotation: Legs"). Putting "Start Legs" directly on Record keeps the activity list below it and
   gives the daily path its tap back. **Reported, not built.**
7. **Small, real**: a bare "28" typed into the Run log's Time field parses as 28 *seconds* — the
   likeliest way a runner enters minutes records a world-record 5k without comment. And the
   "no target" chip reads as a status, not a control. **Reported, not built.**

**What the drive confirmed is GOOD and should not be broken chasing any of this**: the runner's
huge stepper digits, last-time + suggestion with its reasoning shown, whole-row set selection,
Next/Finish in the thumb zone, and drafts that survive backgrounding with the clock derived from a
timestamp rather than accumulated.

**Tests: render 535 → 537.** The driver script is throwaway (scratchpad), built on the a11y
audit's CDP plumbing; the a11y audit itself remains the tool of record for contrast and targets.

---

## 2026-08-28 — ⚠️ THE CLOUD CEILING IS GONE (0b(c)), 0h CLOSES, AND A BUG NOBODY WAS LOOKING FOR

Tim asked which open items needed no instruction from him, was told six, asked which of those were
*actually* good, and then said to do the good ones and pin the rest. **Three were judged genuinely
good and all three shipped.** One of the six was withdrawn on inspection — see item 5 — and three
were pinned.

⚠️ **A NOTE ON THE DATES IN THIS FILE, since it is the kind of thing this file cares about.** Every
commit from `e1a7afd` to this one carries the git date **2026-08-26**, including everything labelled
2026-08-25, 2026-08-26 and 2026-08-27 above. **The day headings are SESSIONS, not calendar days**,
and they have run ahead of the clock for a while. This heading keeps the sequence because that is
what a reader navigates by, but do not treat any date above as a real one.

### 1. ⚠️ 0b(c) IS CLOSED — one document per session, migrated while the account is nearly empty

Every collection lived in **one** Firestore document capped at 1 MiB. At the measured ~2,000 bytes a
session that is a ceiling near **520 sessions — two and a half years at four a week**, after which
saving a workout fails. `sessions` and `guestSessions` now live at `users/{uid}/sessions/{rowId}`,
one document per row, where the cap applies to a single session and **Firestore does not cap the
collection above it**.

⚠️ **THE 80 % WARNING SAID THERE WAS TIME, AND THAT WAS THE ARGUMENT FOR GOING NOW RATHER THAN
LATER.** The threshold was chosen to leave six months — but the thing being migrated is somebody's
training history, it gets riskier the more of it there is, and 80 % means doing it to ~420 sessions
under time pressure. At a few dozen it is the same code against a twentieth of the data with no
deadline. **The runway was never the hard part.**

**What makes it safe**, in the order it happens:

- Write every row into its own document, **re-read the collection to prove they landed**, and only
  then empty the old whole-list document. ⚠️ **A row that did not arrive aborts before the old copy
  is touched** — a migration that cannot finish has changed nothing, and the next read retries.
- ⚠️ **THE EMPTIED LEGACY DOCUMENT IS THE MIGRATION FLAG.** A `migratedAt` field would have meant
  widening `validPayload()`, the rule guarding every collection in the app, to record something the
  emptiness already says.
- The read path **checks that document forever**, so anything a client predating this writes there
  is adopted on the next read instead of stranded. ⚠️ **The shard wins a collision**, and the price
  is named: an edit made on an old client can be dropped. Letting legacy win would let a stale
  cached copy silently revert a newer edit. Both are bad; only one is invisible.
- A write with a cold memo **reads first**, or restoring a backup would merge instead of replace.

⚠️ **THE NETWORK CODE IN `firebase-backend.js` HAS BEEN EXECUTED FOR THE FIRST TIME.** That file has
opened since it was written by admitting its network paths were reviewed and never run — tolerable
for a save that might not happen, **not** tolerable for the one function in this app that deletes
documents holding training data. `createShardIO()` takes its Firestore surface and uid as arguments,
so the tests drive migrate → verify → empty → diff → delete, an aborted migration, a cold write, an
old client's orphaned rows, two accounts never sharing a memo, and 1,200 rows in three batches.
⚠️ **It is a double, not Firestore**, and proves the order and the arithmetic — which is the half
that loses data when it is wrong.

**Rules**: `users/{uid}/sessions/{id}` and `guestSessions`, owner-only, shape-checked. ⚠️ **`delete`
is allowed where it is denied for the whole-list documents** — the one genuine permission this adds,
because removing a session is a document delete now rather than a shorter list. **Rules tests 92 →
108**, and the new ones exist to prove **sharding did not become sharing**: one document per row is
exactly the shape that made reactions and handoffs safe to expose, so it is exactly the shape
somebody could talk themselves into exposing here. **Deployed.**

`cloudUsage()` no longer prices the sharded collections — it would go on warning about a document
that has been emptied, which is that function's own failure mode running backwards. **It still
watches everything else**, so if the judgement that only those two grow without limit is wrong, the
warning fires on whichever collection is actually filling up.

### 2. ⚠️ 0h IS CLOSED — and the reasoned entries turned out to be the worst ones

The last four names. Three derived by the technique the sweep has used throughout:

| | was | now | from |
|---|---|---|---|
| Decline dumbbell bench | 0.86 | **0.76** | (36,57,84,117,153)×2 / bench 127…339 |
| Seated dumbbell press | 0.98 | **1.08** | (40,56,76,98,122)×2 / OHP 75…226 |
| Arnold press | 0.90 | **0.77** | (23,37,54,75,98)×2 / OHP 75…226 |

**Spider curl is closed as NOT DERIVABLE** rather than left open: SL's table is for the barbell
version and this library's lift is a dumbbell one. Labelled, with a note not to re-open it without a
new source.

⚠️ **THE FINDING IS NOT THE SIZES, IT IS WHERE THE ERRORS WERE.** Every earlier finding in this
sweep was a guess nobody had checked. **These three were all ARGUED FOR in comments, and two
inverted the very ordering the argument was trying to protect:**

- **Decline** was raised above flat on *"a decline genuinely moves more load"*. True of a barbell —
  Decline Barbell is 1.03 against a flat 1.00, and that still holds — and **false of dumbbells**,
  because what caps a heavy decline dumbbell press is getting the bells into position. The
  measurement lands on **0.76, the number that was there before somebody reasoned it upward.**
- **Seated shoulder press** sat *below* standing, which says a back support makes you weaker.

⚠️ **AND A TEST WAS DEFENDING THE ARGUMENT.** `data-layer` asserted *"decline still allows MORE than
flat"* — pinning a mechanism rather than a measurement, and it would have failed any correct
re-derivation. **A confident mechanism in a comment reads exactly like evidence. Where an entry
carries an argument and no numbers, check the argument first.**

Both re-derived control entries reproduced their existing anchors exactly (0.809 vs 0.81, 1.014 vs
1.01), which is what validates the source rather than the conclusion.

### 3. ⚠️ A BUG NOBODY WAS LOOKING FOR — the same exercise twice in one session

Found while reading the code for something else, and **it is the kind this project keeps producing:
quiet, reachable, and invisible to 2,800 assertions.**

Four readers did `entries.find(e => e.exerciseId === id)` and stopped at the first hit. The workout
**editor** refuses a duplicate exercise, which is why that looked safe — but the **runner** does not,
because the exercise swap splits:

> swap Leg Press → Hack Squat with two sets logged, then swap back when the machine frees up
> → `[Leg Press (2 sets), Hack Squat (n), Leg Press (rest)]`

which is an ordinary thing to do in a busy gym and exactly the improvisation Swap was built for.
**The second entry was invisible**, and it read the wrong half: the chart's best set for the day,
the modal rep count and the pre-fill for next time all took the **first** entry, which after a
swap-back is the sets you gave up on.

Fixed in `weightRepObservations`, `seriesForExercise`, `lastSetsFor` and `progression.scanSessions`
— the last two now take the **last** entry that logged sets, because *"what did you do last time"*
means the one you finished. ⚠️ **`muscleStrength()` was never affected**, because it already walks
every entry in order for the fatigue discount, and there is now a test pinning that.

### 4. A test that failed about once in ten runs, for no reason

`render.test.mjs` proved a guest's numbers stayed out of the owner's session by grepping the whole
serialised session for the substring `95`. A millisecond timestamp or a base-36 id contains "95"
often enough to be seen. Asserted on the recorded sets instead. ⚠️ **A test that fails at random
teaches people to re-run it, which is the habit that hides a real failure.**

### 5. ⚠️ ONE OF THE SIX WAS WITHDRAWN, AND THE REASON MATTERS MORE THAN THE ITEM

The estimator's Phase 1 groundwork was recommended to Tim as **the most urgent of the six**, on the
argument that `setIndex`/`exerciseIndex` are data you cannot retrofit — every session recorded
before they exist is lost to the estimator forever.

**That was wrong.** `docs/strength-estimate-plan.md` says *"nothing in `store.js` carries them"*,
which is true of the **observation objects** and not of the **stored data**: `entries` is stored in
performed order and `sets` within an entry likewise, so both indices are array positions and are
derivable at any time from sessions already on disk. Nothing is lost by waiting, the item is inert
plumbing nothing consumes until Phase 2, and **Phase 2 has open questions for Tim.** So it was not
built. ⚠️ **The recommendation was made on a misread of a plan document rather than of the code.**

---

## 2026-08-27, third pass — ⚠️ JOINT WORKOUTS CLOSE, AND DISCONNECT IS MUTUAL AT LAST (0e, 0j)

Items 3 and 4 off Tim's list. Both needed a new Firestore rules path, and both got the one the
kudos work established on 2026-08-26 — which is exactly why they were cheap this time.

### 1. ⚠️ 0e IS CLOSED — a session recorded for a friend can now be handed to them

The guest half shipped 2026-08-26 (a name with no account, kept on the recorder's phone). This is
the other half, and **Tim's own decision is the whole shape: the other person ACCEPTS it.**

⚠️ **WHY THERE WAS NEVER AN ALTERNATIVE.** A direct write needs permission on
`users/{them}/collections/sessions` — and that ONE DOCUMENT holds every session they have ever
recorded. There is no narrower grant, because Firestore grants per document. So a "just write it
into their account" version of this feature is a version where a bug in my client can replace your
training history.

**What shipped**: `users/{recipient}/handoffs/{id}` — one create-only document per offer,
shape-checked at the wire, in a subtree nothing else reads. The recipient sees **"Recorded for
you"** on Friends with the sender's name and the exercises, and **Add** or **No**.

- ⚠️ **ACCEPTING IS THE RECIPIENT'S OWN CLIENT WRITING TO ITS OWN ACCOUNT**, under the owner-only
  rules that have not changed by a character. Nothing about this feature widens the private data.
- ⚠️ **A fresh id on accept, not the sender's.** The sender's id belongs to a row in THEIR
  `guestSessions`, and reusing it would tie two people's records together by a key neither
  controls — deleting one would look like it should affect the other. **An offer is a message,
  not a shared object.**
- **The offer is deleted only after the session is safely saved**, and the session is republished
  so their friends see it like any other. The other order loses somebody's training if the save
  fails.
- **Sending asks WHO from the real friends list** rather than matching the guest's name. A guest
  name is free text typed mid-workout ("Alex", "alex", "my brother"), and name-matching would
  eventually put somebody's training in the wrong account.
- **Deterministic id per guest session**, so offering twice is one offer. A duplicated offer
  accepted twice is a duplicated workout.

### 2. ⚠️ 0j IS CLOSED — disconnect is mutual, and the sheet finally describes what happens

`social.remove()` edited only the leaver's own graph, so the other person's published copy still
listed them in `viewers` and **they could go on reading that person's training after pressing
Disconnect.** The sheet was corrected on 2026-08-24 to stop promising otherwise, which was not the
same as fixing it.

⚠️ **A TOMBSTONE, NOT AN EDIT, AND THAT IS THE DESIGN.** The obvious fix is for the leaver to
remove themselves from the other person's `viewers` list — which means write permission on
`users/{them}/shared/{tier}`, the document holding everything all their friends can see. One bad
write there destroys the lot. So the leaver drops a note at
`users/{them}/disconnects/{leaverUid}` and **the owner's client acts on it**, republishing without
them.

⚠️ **THE DOCUMENT ID IS THE CALLER'S OWN UID, and that is the entire access control**: you may
announce your own departure and nobody else's. Without it, anybody connected could evict anybody
else from somebody's friends list — a far worse power than the one this path exists to grant. It
also makes it idempotent: pressing Disconnect twice writes the same document.

⚠️ **AND IT IS EVENTUAL, WHICH THE SHEET NOW SAYS.** Nothing happens on their side until their app
next opens. *"They are told, so their app will drop you too the next time they open it. Until then
their training may still be readable by this account."* Claiming "cut in both directions,
instantly" would be the same class of lie as the sentence this sheet originally shipped with, just
a smaller one. **Anything stronger needs a server, which this app does not have.**

**Processed on the Friends screen**, not on a timer — that is where somebody would notice the
result, and a background job that republishes is a background job that can surprise you.
**Somebody leaving is said out loud** (*"2 people disconnected from you…"*), because a name
vanishing off a list with no explanation reads as the app losing data. And the note is deleted only
**after** the republish succeeds, or a failed republish would lose the instruction and leave the
leaver in the viewers list with nothing left to say so.

⚠️ **Telling them is BEST-EFFORT and must never block the disconnect.** If the note cannot be
written — they deleted their account, no signal — disconnecting still works, and **the toast says
which of the two happened** rather than reporting success over a promise that went unkept.

### 3. Tested as somebody who is not you — `tests/rules.test.mjs` 66 → 92

The only tests in this project that can prove a permission. The denials are the point:

- a stranger cannot offer a workout to somebody who has not published to them;
- `from` is proven, so an offer cannot be forged in another person's name;
- an invented field, a non-map session, a session carrying a key the app never writes, and a
  41-exercise payload are all refused **at the wire**;
- **there is no update path at all** — not for the sender, not for the recipient;
- ⚠️ **even the SENDER cannot list the recipient's offers**, which would show them what everybody
  else had sent;
- **Alex cannot announce Sam's departure** — the id/caller check — and the `from` field must match
  too, so neither half can be forged alone.

⚠️ **ONE THING RECORDED RATHER THAN FIXED.** The emulator logs *evaluation errors* on several of
these denials even after every field is existence-checked, and **so does the reactions block that
shipped on 2026-08-26** (L233/L243). The remaining source is the `get()` inside `viewerOfAnyTier()`
on documents that do not exist, not a missing guard. Every denial is still a denial — that is what
the tests assert and what matters — but the rules file now says so, because the obvious next move
is to keep adding guards until the log goes quiet and it never will.

⚠️ **A stranger CAN leave a disconnect note, and that is priced rather than overlooked.** Refusing
it would mean checking the graph, which is owner-only, so the check would have to be a billed
`get()` on every write to prevent a message that grants nothing and carries no information. The
owner's client only ever removes somebody already in its graph, so the note is a no-op. **Cheaper
to allow a no-op than to pay a read on every write to forbid one.**

**Rules deployed.** Tests: rules 66 → 92, render 520 → 534. **2,813 across eleven suites, all
green**, plus 92 in the emulator and 12 in sw-update.

---

## 2026-08-27, second pass — ⚠️ FILE IMPORT IS BUILT, AND THE PHOTO CAN BE REPOSITIONED

Tim, after reading the integrations research: *"Profile picture is fixed on phone. Make a feature
where you can edit the profile picture though (resize, move the center circle). Do the file import
feature. How much would the firebase paid tier cost? Do 3-4 as well. Wait for the AirPods/food
feature."*

✅ **THE PROFILE-PHOTO FIX IS CONFIRMED ON HIS PHONE.** The cyclic-percentage diagnosis was
reasoned rather than observed — headless Chrome never reproduced the bug — and his device has now
settled it. That closes the last field check from the first pass.

### 1. Editing a photo already saved

⚠️ **EDITING THE STORED AVATAR WOULD HAVE BEEN EDITING A RUIN.** The saved `avatar` is a 256px
square that has already thrown everything outside the circle away: you could zoom further in and
never back out, and it would soften every time it was touched. So a **re-editable source** is kept
at **768px** — three times the output, which is exactly `image-crop`'s maximum zoom, so even the
tightest re-crop does no upscaling. Stored as `settings.avatarSource`, with `settings.avatarCrop`
holding `{zoom, cx, cy}`.

- **Edit reopens where it was left**, not in the middle of the photo. Somebody nudging a face two
  pixels should not have to find it again first.
- **All three are written in one `saveSettings`**, so a crop can never end up pointing at a
  different photo than the source it was cut from. A restored crop is also **clamped against the
  real image** before it is used, so a stale number degrades to a sane default rather than a
  broken editor.
- **Remove clears all three.** Leaving the source behind would let a later Edit reopen a photo the
  account no longer has.
- **A photo saved before this shipped has no source**, and Edit falls back to the avatar itself —
  still useful for recentring within the square, just unable to zoom back out.
- Cost, measured: **9 KB** for the source on a synthetic image against ~4–6 KB for the avatar. The
  768px cap and 0.78 quality are what bound it, not that one measurement; a real photograph will
  be some tens of KB.

⚠️ **A REAL BUG CAME OUT OF DRIVING IT.** `setPointerCapture` was the FIRST statement in the
`pointerdown` handler — and it throws `NotFoundError` whenever the id is not an active pointer, so
it threw **before the pointer was ever recorded**, `pointermove` found nothing, and the photo would
not move at all. Capture only buys events that stray outside the stage mid-drag; **tracking is the
mechanism**. Reordered, and the capture is now allowed to fail. After the fix a 15px drag moves the
crop centre by exactly the predicted 12.7 source pixels.

### 2. ⚠️ FILE IMPORT — Phase 1 of `docs/integrations-plan.md`, and it needed nothing from anybody

`js/import-file.js` (pure) + `js/views-import.js` + `#/import`, reached from the Account screen.
Reading a file the user exported needs no OAuth, no client secret, no server, no Blaze plan and no
partner approval, and it breaks nobody's terms — which is why it went first.

**An imported activity is EXACTLY what the quick log writes**: one entry, one set, **no
`workoutId`**. So the calendar, the feed, backups and the cloud ceiling all see it through
machinery that already existed, and the muscle map, ratings, volume and progression never see it
at all. **D27 unchanged and unweakened — this adds a door, not a model.** Weigh-ins join the body
weight series, in pounds like everything else.

⚠️ **THREE THINGS ARE REFUSED RATHER THAN GUESSED, and all three would have been wrong silently
and permanently:**

1. **The date order.** `03/04/2026` is 3 April to most of the world and 4 March in the US, and
   nothing in the cell says which. The **whole column is checked first** — one date with a number
   above 12 settles it for every row — and only a column with no evidence in it asks the user. A
   guess would put every imported session on the wrong day forever and nothing on screen would
   ever look wrong.
2. **The weight unit.** A column that does not name its unit imports **nothing** and asks. 75 kg
   read as 75 lb records somebody at a third of their real weight and re-rates every pull-up they
   have ever logged.
3. **The distance unit** — ⚠️ **and this one was a REAL BUG, caught by driving a Strava-shaped
   file through the screen rather than by reading the code.** A bare `Distance` header used to
   fall back to miles, and **Strava exports kilometres**: a 5.02 km run came in as a 5.02 mile run,
   61 % long. The weight hazard had been thought about and priced; the identical distance hazard
   had not. *That is how a class of bug survives being "handled" — one instance gets the
   reasoning and its twin gets a default.*

⚠️ **RE-IMPORTING THE SAME EXPORT IS SAFE, and that is the feature rather than a nicety.** Somebody
exporting monthly will hand over overlapping files forever. Every row carries a **deterministic id
derived from its own content** (`importId()`, double FNV-1a), so the second import is an upsert of
the same rows. `store.importRows()` writes the whole batch in **one** read-modify-write — a loop
over `saveSession()` would have been 200 full reads and writes of a near-megabyte document with
200 chances to be interrupted half-way. **Weigh-ins merge by DAY**, because this store has always
kept one per day and an import must not be the thing that breaks that rule.

**The confirmation says what will actually happen** — counted against what is already stored, so
"Import 3 records" is three, not the file's row count. It names what will be skipped and why, and
flags rows that fall on a day already holding something with the same name rather than dropping
them, because whether that is a duplicate is the user's call.

✅ **Driven end to end in a real browser at 390px** with a Strava-shaped CSV (named-month dates,
quoted names containing commas, elapsed *and* moving time): columns detected correctly, **moving
time preferred over elapsed**, 5.02 km → 3.12 mi once the unit was answered, the empty rest-day row
skipped, three sessions written with no `workoutId`, **the same file dropped again reports
"nothing new to bring in" and leaves three sessions**, and an ambiguous-date file asks. No
horizontal overflow.

⚠️ **NOTHING HERE HAS EVER SEEN A REAL EXPORT FILE.** The column names come from published
documentation, not from a file this project has parsed. That is exactly why nothing guesses: every
importer detects by name, hands back what it found, and the screen makes the user confirm a
preview before a row is written. **A tolerant reader plus a confirmation is honest; a hard-coded
schema calling itself "the Strava importer" would not be.**

⚠️ **Also caught by driving it**: `location.hash = '#/import'` while already on `#/import` fires no
event, so **"Choose a different file" was a dead button**, as was the one after a finished import.
Both bounce through `#/blank` now.

### 3. Firebase Blaze, priced

Tim asked. **It would be free in practice, and the real cost is the card on file rather than the
bill.** Blaze's monthly no-cost allowance is **2M Cloud Function invocations, 400K GB-seconds,
200K CPU-seconds and 5 GB egress**, plus Firestore's 50K reads / 20K writes / 20K deletes a day and
1 GiB stored. A Strava token exchange runs once per connection plus a refresh every few hours per
active user: **ten users is on the order of 1,500 invocations a month against a 2,000,000
allowance.** New accounts also get $300 of credit.

⚠️ **What Blaze actually costs is a payment method and the absence of a hard cap.** Google offers
budget *alerts*, not a spending limit; the documented way to truly stop spend is a function that
disables billing when a budget is hit, which is a workaround rather than a switch. That is the
honest reason to leave it off until live sync is genuinely wanted — not the money.

**Tests: data-layer 1291 → 1348, render 511 → 520. 2,799 across eleven suites, all green.**

---

## 2026-08-27 — ⚠️ THE PHOTO CROPPER, TWO IPHONE BUGS, ACTIVITIES PHASE 2, AND THE PALETTE AUDIT

Tim asked for the fully-specified items to be finished, then sent two live phone reports and two
research questions mid-build. Everything below shipped except the research, which is plan-only.

### 1. ⚠️ THE PROFILE PHOTO IS POSITIONED BY THE USER NOW

*"Sometimes the user's face isn't centered and large in the middle… display the image the user
imported with a circle in the middle showing what their profile icon is actually going to look
like. The user can move this to any part of the image and also zoom it in or out."* Built exactly
that: a **"Position your photo" sheet** — a square stage with an inscribed circle, the outside
dimmed, drag to move, a slider plus pinch and wheel to zoom, then Cancel / Use photo.

⚠️ **THE CIRCLE IS NOT A PREVIEW OF THE RESULT, IT IS THE SAME RECTANGLE DRAWN TWICE.**
`js/image-crop.js` is a new **pure module** — the crop is a square of side `s` centred at
`(cx, cy)` in SOURCE pixels, and both `layout()` (which places the `<img>`) and `cropRect()` (which
cuts the canvas) derive from that one state. An assertion checks they describe the same rectangle
at three zooms; if they ever disagree, the thing Tim complained about comes straight back in a new
form.

⚠️ **THE ONE INVARIANT: THE CROP SQUARE NEVER LEAVES THE IMAGE**, so no avatar can be saved with a
blank wedge in it — which the round display would render as a broken picture rather than as a
choice. Swept over **1,925 combinations** of size, zoom and centre, including centres far outside
the image: zero escapes. **Mutation-checked properly**: it survives removing either guard alone —
they are deliberate defence in depth — and fails 1,843 of 1,925 with both gone, so it is a
property and not a vacuous pass. Verified in a real browser too: at every zoom the image still
covers all four sides of the circle.

**Everything else is unchanged**: still resized to 256px JPEG (~4 KB measured), still
`settings.avatar`, still local-only and NOT published to friends. The old blind centre-crop is
gone. ⚠️ **An `<img>` is used rather than `createImageBitmap`, deliberately** — browsers apply EXIF
orientation to an `<img>` and not to a bitmap, so a sideways phone photo would otherwise preview
upright and save on its side.

### 2. ⚠️ "IT TAKES UP THE MAJORITY OF THE UPPER LEFT OF THE SCREEN" — a cyclic percentage

Tim, on his iPhone: the profile photo rendered enormous and uncropped, with no circle. **Chrome at
390px does not reproduce it** — measured 34×34 and circular — so this is a WebKit-only
disagreement and the diagnosis is reasoned rather than observed. But there was a real latent fault
to find: `.avatar-glyph` had **no dimensions of its own**, and `.avatar-btn` is
`place-items: center`, which sizes its item to its CONTENT. The content is the photo, whose own
`width: 100%` then resolves against a parent being sized from it — **a cyclic percentage, which an
engine may legally break by falling back to the image's intrinsic size: 256px.** Blink picks 34,
and "extremely large" is exactly what picking 256 looks like.

Fixed by making the containing block definite: the glyph and both avatar images are now
`position: absolute; inset: 0` against a fixed-size parent, which no engine can resolve any other
way. ⚠️ **UNVERIFIED ON HIS PHONE** — headless Chrome never showed the bug, so it cannot show the
fix either. This one needs Tim to look.

### 3. ⚠️ A CSS COMMENT WAS NEVER CLOSED, AND IT WAS EATING A RULE

Found while reading the stylesheet for the above. `css/app.css` had **217 comment opens against
218 closes**: one block closed early and its second paragraph ran on as raw CSS, ending in a stray
close. The parser consumed all of it as a selector — and swallowed the **`.seg + .seg::after`
rule** with it. So the hairline between unselected segments, measured and argued for on
2026-08-21 (without it "Graph | Bar Chart Muscles" reads as two choices, the second called "Bar
Chart Muscles"), **has never rendered.** Confirmed in the browser and **mutation-checked**: with
the stray close restored, `content` computes to `none`.

### 4. ⚠️ THE FRIENDS TAB'S LAG — three round trips before a single pixel moved

*"Whenever I click on friends in the home menu, it has a long delay and lag to it that's
alarming."* Diagnosed by reading the path rather than guessing. Four faults, all fixed:

- **The router `await`s the view before it swaps the DOM**, so everything `SocialView` awaited was
  time with the PREVIOUS screen under his thumb. It now returns the shell immediately and fills in
  after — the shape `fillFeed()` and `profileButton()` already used. ⚠️ **Pinned by a render test
  that hands it a network which NEVER ANSWERS**; if somebody re-adds the `await`, the screen never
  arrives and the test fails. Mutation-checked.
- **`social.invites()` was called TWICE** — once for the claimed half, once for the unclaimed half
  of the same collection, awaited one after the other. One read now, partitioned.
- **`social.friend()` probed the three tiers SERIALLY**, paying a full round trip for each refusal
  above the viewer's own — three of them for somebody on the lowest tier, which is the default
  everybody starts on, multiplied by every friend in the feed. Now one parallel batch.
  ⚠️ **Precedence is unchanged**: `PROBE_ORDER` is applied to the answers instead of to the order
  of asking, and a refusal is `null` rather than a rejection, so it cannot blank a real friend.
- **The graph and invite reads are cached** with the same 30-second silent-revalidate discipline
  the collection cache has used since 2026-08-22, and the same contract: **read-only paths only.**
  Every mutation calls `readGraphFresh()` and drops the cache after writing. Cloud reads were the
  last thing in the app still paying the network on every visit. ⚠️ Clearing is wired **inside
  `clearReadCache()`** rather than at each call site, so an identity change cannot show one account
  the previous account's friends.

### 5. Activities Phase 2, items 1–4 (`docs/activities-plan.md` §3)

- **An `Activity` group**, split out of Cardio — "Rock Climbing · Cardio" read as though the app
  thought a climb was a treadmill. The line is where you do it: a treadmill is training, a hike is
  a thing you went and did. ⚠️ **Added to `UNRANKABLE` and `NO_VOLUME` in the same commit**, so it
  inherits every refusal Cardio had. Asserted through the real `weeklyVolume()`: six sets of
  swimming and climbing produce **zero** volume on every muscle — **with a vacuity guard that
  caught the first version of that test being meaningless**, because the signature was wrong and
  it totalled zero for the bench press too.
- **Pace, shown and never judged** — minutes per mile on any set carrying both distance and time,
  in the same ink as the numbers it came from (Rule 6: a recovery run is not a worse run). Silent
  when either number is missing or the result is implausible, so no calendar ever reads
  "Infinity /mi".
- **Rep normalisation can never reach an activity** — it already could not (`canNormalize()`
  demands both weight and reps), so this is a by-construction guarantee, now pinned so that
  relaxing that condition for some unrelated reason cannot give a mile a one-rep max.
- **The feed card names the kind** — a dumbbell for a lifting session, a route glyph for an
  activity, recovered on the client by name because the projection carries no group. It also
  stopped printing **"Running" directly under "Running"**, which is what an activity card did.

### 5b. ⚠️ THE RAISE FAMILY WAS FLATTERING BY 80 % — 0h's remainder, mostly closed

Four more entries derived by the established technique (SL per-dumbbell figures at a 180 lb male,
doubled, over the muscle's key lift, median of the five levels):

```
                     was    now    SL per-dumbbell figures      drift    q
  Lateral Raise      0.30   0.53   12/22/37/55/76               2.1x    0.25 (held)
  Front Raise        0.30   0.54   10/22/38/60/86               2.9x    0.25 (held)
  Rear Delt Fly      0.30   0.56    8/20/39/64/94               3.9x    0.22 (down)
  Incline DB Bench   0.70   0.80   49/66/88/113/139             1.1x    0.72 (UP)
```

⚠️ **THIS IS THE FACE PULL AGAIN, AND BIGGER.** A 40 lb-per-hand lateral raise was converting to a
**267 lb overhead press** — comfortably elite, off a movement most people do for high reps at the
end of a session. It now converts to 151. Rear delt fly 200 → 107 lb. Incline dumbbell press
229 → 200 lb.

⚠️ **THE THREE RAISE MEDIANS AGREE TO WITHIN 0.03**, which says the one-number-for-the-family shape
was right all along and only the value was wrong. They are split into three lines anyway, because
they are three measurements now rather than one guess.

⚠️ **AND THE DRIFT RULE SHOWED BOTH ITS FACES IN ONE PASS.** The raises sweep 2–4× across the five
levels — a beginner's raise is a fifth of their press, an elite's is five sixths — so **there is no
population constant to find and `q` does not rise despite the sourcing**; the median is the best
single answer available and is still a bad one, which is exactly what a low `q` is for. The incline
dumbbell press is the opposite, and the flattest ratio in the whole table (**1.1×**), so it is the
one entry whose **`q` goes UP**, 0.55 → 0.72.

⚠️ **One note in the file was WRONG and is corrected.** `Machine Triceps Extension` carried
*"SL publish a machine extension standard a later pass can use"*. **They do not** — they publish a
machine tricep *pushdown*, which is a different movement and already has its own entry. It is now
labelled "reasoned, no published standard" like Machine Row and the shrugs, so nobody spends
another pass hunting for it. **Still genuinely open in 0h**: decline dumbbell bench, the
Seated/Arnold shoulder offsets carried across their anchor, and spider curl (SL's is a barbell and
the library's is a dumbbell — nothing honest to divide).

### 6. ⚠️ THE FULL BROWSER AUDIT HAS NOW RUN ON ALL FOUR PALETTES

The standing known limit since 2026-08-26 — *"the full audit has only ever run on Gold"* — is
closed. `tools/a11y-audit.mjs` takes a `PALETTE` env var now (set through the attribute, for the
same reason the theme is: the demo backend reseeds on every reload, so a palette written through
settings is thrown away by the next navigate). **The activity log joined the route list too**, a
whole screen that shipped unaudited.

```
              combos  text nodes  below 4.5:1  overflow  median
  gold          60       5,874         0          0       9.41
  teal          60       5,874         0          0       9.41
  indigo        60       5,874         0          0       9.41
  ember         60       5,874         0          0       9.24
```

**240 route/width/theme/palette combinations, 23,496 text nodes, zero failures.**

### 7. Screenshots — the queued visual pass

Driven over CDP at 390px: the Record chooser, the activity log, the Account screen, the Home feed,
Friends, and Data · Muscles — **no horizontal overflow on any of them** — plus the crop editor
opened with a real 900×1600 `File` through a real `DataTransfer`, dragged (60px, 1:1 with the
finger), zoomed (+210px, still covering all four sides), saved (256×256, 4 KB, decodes), and the
result measured on the account button at 34×34 with a 50% radius. Eyeballed.

⚠️ **One probe was wrong twice before it was right**, which is worth keeping: it first reported
"no photo input on the Account screen" (it was in the demo, whose Account screen is a different
screen entirely) and then reported the drag as doing nothing (it measured after a zoom that had
rescaled everything). Neither was a bug in the app. **Probe honestly** — §0.6 already says this
about bounding-box centres, and it keeps being true.

### 8. Two research answers, nothing built

- **`docs/airpods-plan.md` §2b — would head motion work as an App Store app? YES.**
  `CMHeadphoneMotionManager` is a real public API on AirPods Pro / Max / 3rd gen / Beats Fit Pro
  (⚠️ not AirPods 2nd gen). ⚠️ **But a WKWebView wrapper does not get it** — it needs a native
  Swift bridge, a $99/year account, and review, where **guideline 4.2 rejects repackaged
  websites**. Head motion alone is not a good enough reason to build a native app; HealthKit might
  be.
- **`docs/integrations-plan.md` — new.** Pulling data from Strava, Cronometer, Apple Fitness,
  MacroFactor and the wearables. ⚠️ **The blocker is not "website vs app", it is the missing
  server**: Strava's token exchange needs a client secret and supports neither PKCE nor the
  implicit flow, and a native app is just as public a client. ⚠️ **And Strava's 2026 agreement
  forbids showing one user's Strava data to another user — so an imported run may not appear in a
  friend's feed.** The recommendation is **file import first**, which needs no secret, no server,
  no Blaze plan and no partner approval, and works today as a website. ⚠️ **Importing food
  collides with D1/D26** and must go to Tim as a narrowing rather than be resolved quietly.

**Tests: data-layer 1250 → 1291, render 497 → 511.** All eleven suites green.

---

## 2026-08-26, ninth pass — ⚠️ THE SECOND WAVE: ACTIVITIES, DURATION, THE ROTATION FIX, THE
## ACCOUNT SCREEN, AND TWO PLAN DOCS

Tim sent six items, then three more mid-build. Everything except the AirPods work (plan-only on
his instruction) shipped.

### 1. ⚠️ RECORD IS A CATEGORY CHOOSER, AND THE APP RECORDS NON-LIFTING ACTIVITIES (D27)

*"Make the site more applicable to non-weight-lifting fitness activities such as running,
climbing, swimming…"* **D2 ("Lifting only") narrows to D27** — the D15→D21 pattern again:
**activities are RECORDED first-class and MODELLED not at all.** The Record tab now opens on a
chooser — Weightlifting first and biggest, carrying the next-in-rotation name, leading to the
unchanged full recorder at `#/start` — then Run / Walk-or-hike / Swim / Cycle / Climb / Something
else, each opening a quick log (date, activity, time/distance) that saves a REAL session. So the
calendar, the feed, backups and the cloud ceiling all see an activity through machinery that
already existed, and the muscle map and ratings never see it at all (no `workoutId`, Cardio group
= unrankable — both asserted). Library gained Walking, Rock Climbing, Bouldering.
`docs/activities-plan.md` holds D27's reasoning and Phase 2 (pace shown-not-judged, an Activity
group label, activity PRs — needing design first).

### 2. ⚠️ THE ROTATION SUGGESTION WAS READING AN ORDER NOBODY WROTE — now least-recently-done

Tim, with a counter-example: *"Monday I did Pull, Tuesday Legs… my next workout is Push"* — the
app said Pull. **The bug: a self-built system has no `order`, so its "rotation" was
alphabetical** — Legs → Pull → Push — and next-after-Legs was Monday's Pull. The rule is now
**the workout you have not done for the longest** (never-done = longest of all), with rotation
position as the tie-break — so an ordered programme cycled correctly loses nothing (the two rules
coincide under obedience), and out-of-order training gets the answer a person gives instantly.
The caption says what was read: *"It's been longest since this one — 5 days ago."* Tim's exact
scenario is a pinned regression test.

### 3. ⚠️ WORKOUT DURATION — the timer he asked for already existed

*"Start a hidden timer… record it… display this in the friend's feed… contribute to the time
estimation (round to the nearest ~5 min)."* **`startedAt`/`finishedAt` have been on every session
all along**, so every past session is already a measurement. Built the read side: each Record row
shows **`~45 min`** — the MEDIAN of that workout's own recorded durations (one interrupted
session cannot drag it), sets × 3 min before any exist (the badge's published figure), rounded to
5. **Feed cards show minutes at MID and above** — *"Today at 6:32 PM · 45 min · Ironworks Gym"*.
⚠️ The old "finishedAt is never published" note NARROWS rather than falls: minutes rounded to
five at the tier that already carries the start time reveals "about 45 minutes", never the exact
instant the gym was left — and `finishedAt` itself is still never published, asserted at every
tier. Sanity guards both sides: a draft left open overnight, or a back-dated quick log, publishes
and averages NOTHING (5 min ≤ duration ≤ 6 h).

### 4. The Account screen owns the person now, and has a face

- **Profile photo**: square-cropped and resized client-side to 256px JPEG (~20 KB — the settings
  document shares the 1 MiB ceiling), stored as `settings.avatar`, shown on the Account screen
  and as the top-left account button itself. ⚠️ **Local-only: NOT published into the social
  projection** — publishing a face is a widening that gets its own decision.
- **Everything account-ish moved out of Settings** (Tim's ask): the profile row, backup/restore,
  the cloud warning and Delete-all now live on the Account screen in every account state
  (signed-in, anonymous, offline, unconfigured). Settings keeps appearance/colour/units/details/
  Goals plus one pointer row so nobody who always found them there is stranded.
- **Back from Account goes Home**, not Settings — all five states. Settings has its own button.

### 5. ⚠️ "Friend" vs "Autumn Dossey" — the accept-flow placeholder, now self-healing

The bug: accepting somebody's invite happens BEFORE they accept you back, so their published
profile is unreadable at that moment and the graph stores the placeholder `'Friend'` — and
nothing ever went back to fix it. Her page showed the real name because it reads the published
doc. **`social.healConnectionName()`**: whenever a screen holds both a placeholder row and a
readable published name (friends list, friend page), it persists the published name into the
graph — a real stored name is never overwritten. The feed's comment-author names also prefer
published names now. ⚠️ **Unverified in the field**: needs Tim's account to confirm Autumn heals
on his next Friends visit — jsdom cannot drive the cloud path.

### 6. AirPods — researched, planned, NOT deployed (his instruction)

`docs/airpods-plan.md`, from live web research: **head-motion control is impossible for a web app**
(CMHeadphoneMotionManager is native-only, no web exposure, no standards work); **stem presses ARE
buildable** via MediaSession — the page plays a silent looped track, owns Now Playing, and
single/double/triple press become rest-timer/next-set/back, with the lock screen as a free status
display. The priced costs: occupies Now Playing (no simultaneous Spotify — must be opt-in,
off by default), the ~30 s paused-while-locked session kill, battery. §4 is the build order if he
says go; §3 is the dead-end table so nobody re-litigates Web Bluetooth on iOS.

**Tests: data-layer 1235 → 1250, render 470 → 497, social 128 → 134.** All suites green.
⚠️ **Not yet screenshotted**: the chooser, activity log and account restructure are jsdom-tested;
a CDP visual pass is queued with the next batch.

---

## 2026-08-26, eighth pass — ⚠️ TIM PICKED ALL THREE: COLOUR IS A SETTING NOW (0k closed)

*"I like all three color themes (teal, indigo, and ember), so lets allow the user to choose which
'Theme' in settings."* Built and deployed the same day:

**Settings → Colour: Gold · Teal · Indigo · Ember**, each chip carrying its accent as a dot so the
choice is visible before it is made. Applied instantly like the theme toggle, stored as
`settings.palette`, and **an unrecognised stored value degrades to Gold** — the same fail-safe
shape as social's tier normalisation, asserted.

⚠️ **THE DEFAULT SETS NO ATTRIBUTE, and that is the design**: Gold is bare `:root`, so an account
that never touches the setting renders byte-identically to before, scoped fixes included. A
palette is `data-palette` on `<html>`, set by boot and by the picker.

⚠️ **EVERY PALETTE HAS A DESIGNED LIGHT THEME, not an inversion** — the dark candidates from the
options page plus new light counterparts (teal #0E7264 on #EFF4F2, indigo #4451C8 on #F0F1F7,
ember's gold darkened to #8A5D0C because #96660F measures 4.39 on the warmer ground — below AA).
⚠️ **Every token a palette touches appears in BOTH its blocks**, because the dark-palette and
plain-light selectors tie on specificity and a token in one block but not the other would resolve
by source order — a bug visible in only one theme. There is an assertion that the key sets match.

⚠️ **`tests/a11y.test.mjs` SWEEPS ALL FOUR PALETTES IN BOTH THEMES — 22 → 85 assertions**: the
text scale on every surface, the hierarchy order and separation, dark/light weight parity, the
accent pairs, plus the Start pill's scoped light fix once per palette against that palette's own
`--raised`. The body-poster tokens are deliberately untouched — the figure is a printed poster and
does not tint with the room.

✅ **Driven in a real browser over CDP**: each pick changes the computed `--accent` instantly and
persists; Teal + Light resolves the combined block (#0E7264 / #EFF4F2); Gold clears the attribute;
a reload re-applies the stored choice. Teal-light Settings screenshotted and eyeballed. **The demo
carries the palette in** like units and theme — a demo that flips somebody's colours reads as the
app breaking. `docs/colour-options/` is deleted — the palettes live in `css/app.css` now; the
options page (artifact) stays as the record, marked decided.

⚠️ **Known limit, stated**: the full browser AUDIT (56 combos) has only ever run on the default
palette. The token-level suite covers all four everywhere, and the two scoped literals that could
clash were found and fixed (`.row-start`, `.cal-tag.b`) — but nothing has measured every painted
pixel under teal/indigo/ember. Worth one audit pass if a palette-specific glitch is ever reported.

Render 462 → 470. All suites green.

---

## 2026-08-26, seventh pass — ⚠️ THE COLOUR OPTIONS WERE BUILT AND PUBLISHED FOR TIM'S PICK (0k)

Tim asked for options, not a decision, and now has them: **three whole-app dark-theme directions,
implemented as real token overrides, applied to the real app and screenshotted at 360px** — no
mock-ups — published at
**https://claude.ai/code/artifact/ca7bfddd-28e8-463b-a06a-9339931ba64d**:

1. **Teal** — cool sea-green accent, the whole field takes a faint tint (accent on ground 8.3:1).
2. **Indigo** — night-sky field, periwinkle accent, echoes the level key's blue–purple end (8.1:1).
3. **Ember** — keeps the gold, warms the entire neutral field around it (7.7:1).

Every option cleared AA on the four deciding pairs before it made the page (measured in the CDP
run, printed on each card). The candidate CSS lives in `docs/colour-options/` with a README
naming the fold-in job for whichever he picks: both themes, level-key recheck against the new
ground, full audit, then delete the folder. **The app's stylesheet is untouched until he says a
word — "teal", "indigo", "ember", or "keep today".**

⚠️ **Also this session: Tim pre-authorised sub-agents** — *"feel free to add as many sub-agents
as you'd like."* The 2026-08-19 seven-agent failure still teaches "plan for file conflicts", but
parallelism itself no longer needs asking. Saved to memory.

---

## 2026-08-26, sixth pass — THE POLISH SWEEP (the UX review's leftovers)

1. **Explore explains its numbers ABOVE the nine cards** — one compact line before the list (what
   the badge means, that nothing reaches 100 %, that days/minutes are the cost); the full caveats
   stay below. The finding was *"Explore ranks nine programmes by a number it explains nine cards
   later."*
2. **The programme/system word swap is bridged where it happens.** The screen is titled
   "Ready-made programmes" now (a stranger arrives from "Pick a programme"), and its first line
   says *"copied into your systems — a system is just a programme you own."* One sentence, at the
   moment of use (D8), instead of a definition living on a screen the first-run path routes past.
3. **The red "not backed up" dot waits for something to be at risk.** It was on from the first
   paint of an empty account — a permanent warning is wallpaper within a week. The dot now means
   BOTH halves: data exists AND it is not backed up. When the check itself fails the warning
   stays, because unknown is not safe. Render tests pin all three (dot with data, no dot empty,
   explainer before list). Render 457 → 462.

---

## 2026-08-26, fifth pass — PERSONAL BESTS ON FINISH, AND THE BODY MAP GROWS INVISIBLE HANDS

### 1. The finish screen celebrates a recorded number beating every recorded number

UX review item 1's last half — *"nothing anywhere says you hit a personal best"* — closed the
Rule-5-safe way: `personalBests()` compares the number just typed against the biggest number ever
recorded for that lift, **benchmarks included, estimates excluded** — no e1RM, no model, recorded
vs recorded only. The finish screen leads with *"Personal best: Overhead Press — 105 lbs, up from
100"* in the app's do-not-skim hairline shape, pointed at good news for once.

⚠️ **Only where there was something to beat.** A first-ever lift is trivially a maximum, and
celebrating it would teach that the trophy is noise. Weight where the lift has one; reps only
where it does not; time and distance left alone (Rule 6 — the app has no opinion on which
direction of a mile is better). ⚠️ **On a retry after a mid-save failure the session excludes
itself from its own history**, or it would beat itself. Three render tests pin beaten / not beaten
/ nothing-to-beat.

### 2. ⚠️ THE BODY MAP'S TAP TARGETS — grown without touching Tim's art (0i, the cheap half)

Every muscle path now has an **invisible hit halo**: the same path with a fat transparent stroke
and `pointer-events: all`, so the tappable region is the muscle plus ~10 screen px in every
direction — and nothing is painted. **Tim's illustration is unchanged by a single pixel.**

⚠️ **ALL HALOS RENDER BEFORE ALL FILLS, and that ordering is the design**: SVG hit-testing takes
the topmost element, so a halo only ever wins where no real muscle is painted — enlargement can
never steal a tap from a neighbouring muscle's actual body. Asserted structurally in render tests.

✅ **MEASURED IN A REAL BROWSER OVER CDP at 360px**: probes 3, 6 and 9 px outside the painted
Traps lobe all land on its halo, and a real mouse click 5 px off the art **selects Traps** — the
panel opens. Traps' effective target grows from 44×15 to roughly 64×35. ⚠️ **Probe honestly**: the
first probe used the bbox centre and "found" the halo broken — the centre of Traps' bounding box
is the spine gap between its two lobes, the exact trap §0.6 documents for Chest.

⚠️ **Not everything reaches 44 px**, and anything more lands on the illustration itself, which
stays Tim's call. 0i's remainder is now genuinely the art only.

**Also driven in the same CDP pass at 360px**: the demo feed (28 cards, 13 carrying locations, no
overflow), the runner header with the location chip (a long gym name ellipsises at 93 px, header
never overflows), the location sheet round-trip, and the people bar. Screenshots eyeballed.

---

## 2026-08-26, fourth pass — ⚠️ THE RATIO SWEEP (0h substantially closed)

**28 lifts fetched from Strength Level's published 180 lb male standards in one day**, every
remaining reasoned entry with a published standard derived by the established technique — one
population, both lifts, divide, take the median of the five levels. The findings:

⚠️ **THE ERRORS STILL RAN MOSTLY ONE WAY — TOO LOW, WHICH FLATTERS.** The worst: **Pec Deck
0.55 → 0.90** (inflating every pec-deck user's chest ~60 %), **Concentration Curl 0.62 → 0.92**,
**Good Morning 0.60 → 0.95**, **Sumo Deadlift 1.52 → 1.97**, **Upright Row 0.70 → 0.94**, the whole
deadlift-as-back family 13–30 % flattering, Preacher Curl 0.82 → 0.96, Leg Extension 0.60 → 0.78,
Pushdown 0.55 → 0.61, Lat Pulldown 0.90 → 0.95.

⚠️ **BUT NOT ALL — THREE RAN THE OTHER WAY**, and a sweep that assumed the direction would have
"fixed" them backwards: **Leg Press 2.00 → 1.73**, **Hip Thrust 1.15 → 0.96** and **Dumbbell Shrug
0.95 → 0.70** had been *under*-crediting those lifters. And one was **exactly right already**: Hack
Squat's reasoned 1.15 came out at a sourced median of… 1.15.

⚠️ **THE FACE PULL IS SPLIT OUT OF THE RAISE FAMILY AT 0.75** (was 0.30). §9's poster child — a
50 lb face pull converting to 167 lb of press — now converts to 67, which is the sane answer the
winsoriser and the credibility sort had been imposing from outside.

⚠️ **`q` MOVED BY DRIFT, NOT BY SOURCING.** Where the five per-level ratios are nearly flat
(Seated Cable Row 0.98–0.99, Seated Calf 0.65–0.67, Rack Pull 2.07–2.11, Lat Pulldown) the ratio
really is a population constant and q ROSE. Where they drift hugely (machines, cables, Zottman
0.45–1.00) q stayed low or dropped despite the sourced median — a fixed ratio still compresses
everybody toward the middle.

⚠️ **WHERE NO STANDARD EXISTS THE TABLE NOW SAYS SO**: Machine Row, Machine/Dumbbell Preacher,
Machine Hip Thrust, Glute Bridge (SL publish reps, not 1RM), Cable/Machine/Trap-Bar Shrug —
labelled "reasoned, no published standard" or carried across a corrected anchor with the label.
**Cable Fly stays reasoned for an unusual reason**: SL publish standards but never say whether the
number is one stack or both, and the two readings differ 2× — a source that cannot answer the
per-side question is not a source for a per-side lift.

**Measured effect on the demo year** (old table → new): Back 229 → 209 lb (−8.7 %), Triceps
186 → 168 (−9.7 %), Traps 262 → 234, Shoulders 150 → 143 with confidence **0.53 → 0.79** — the
face-pull disagreement gone — Hamstrings conf 0.81 → 0.90, Chest/Glutes/Biceps unchanged.
Confidences mostly rose while estimates fell: better-calibrated inputs agree better, the same
signature as the dumbbell-row fix.

**23 sourced ratios and 7 orderings are pinned as assertions** (data-layer 1208 → 1235) — a revert
of any entry flips its line. **Still reasoned and known**: lateral raises, machine triceps
extension, the incline/decline dumbbell benches, Arnold/seated shoulder presses, spider curl (SL's
is barbell, the library's is dumbbell — nothing honest to divide). 0h shrinks to that remainder.

---

## 2026-08-26, third pass — ⚠️ LOCATION ON FEED CARDS (0m closed)

The feed card's meta line was written ready — `[when, a.location]` — and now the term exists.

⚠️ **THE PRIVACY DECISION 0m ASKED FOR: A HAND-TYPED LABEL, NEVER GPS.** The owner types "Gold's
Gym" (or nothing) in the session header and chooses their own granularity, so nothing more precise
than what they wrote can ever exist to leak. No geolocation API, no reverse-geocoding third party
being handed coordinates to render a string the owner could just have typed.

⚠️ **PUBLISHED AT MID AND ABOVE, a stronger version of `startedAt`'s argument**: sixty start times
describe a schedule; sixty start times with a place describe where a person reliably is and when.
Light stays the minimum. Missing is missing — no key rather than null or '', one case for every
reader, asserted in both the builder and the save paths.

**In the runner**: a quiet pin chip beside the date, dashed-underline voice matching it, capped at
15ch with ellipsis so a long gym name cannot push the date off a 360px header. **The label carries
forward from the most recent session** — one gym costs zero taps forever — and a session saved
without one deliberately carries "no location" forward, because clearing it is a choice an older
label must not overrule. ⚠️ **That needed the startedAt tie-break**: `getSessions()` sorts on the
date alone, so two sessions today come back in storage order — a render test caught the
carry-forward reading the wrong same-day row. **Editable after the fact** on the edit-record
screen, where clearing it deletes the key.

The demo's two mid-tier friends carry locations on some sessions (not all — the live shape is
optional and forgotten). Tests: social 121 → 128 (the tier gate, trimming, the cap, absent-never-
empty), render 443 → 448 (the chip, the carry-forward, the save, the cleared-key case).

**Not screenshotted at phone widths yet** — the header chip is reasoned safe (flex-wrap plus a
15ch cap), and a CDP pass over the new feed and runner chrome is queued with the colour work.

---

## 2026-08-26, second pass — ⚠️ KUDOS AND COMMENTS ARE REAL (0l closed)

The feed's two apologising buttons now work. **The wall this needed through was the app's oldest
one** — nobody's client writes into anybody else's data — and the resolution is a narrow exception
rather than a retreat:

⚠️ **A REACTION IS ONE CREATE-ONLY DOCUMENT AT `users/{owner}/reactions/{id}`.** What made a
foreign write unacceptable everywhere else is that one document holds a whole collection, so a
single bad write replaces a training history. A reaction is one document per reaction, in a subtree
nothing else reads, shape-checked by the rules, **with NO update path at all** — editing is
delete-and-repost, a kudos toggle is create/delete of a deterministic id. The worst possible write
is one spurious kudos, and the owner can delete it.

- **Who may react: a viewer of ANY published tier** — seeing the card is what qualifies you, and a
  light-tier viewer sees the card. `from` is proven equal to the caller's uid by the rules, so a
  reaction cannot be forged. Kudos must carry no words, comments must carry some, 500-char cap
  enforced at the wire as well as in the client.
- **One kudos per person BY CONSTRUCTION**: the doc id is `k_{sessionId}_{uid}`, so giving it
  twice overwrites and taking it back deletes a known id. The projection already published a
  session `id` at every tier, which is the anchor; cards shared before ids existed say so when
  pressed rather than silently failing.
- **The receiving half exists too**: a quiet "On your workouts" strip above the feed — who gave
  kudos and the last couple of comments, one line per session, capped at three. Without it a kudos
  would be write-only and pointless for the person it exists to encourage.
- **Comments sheet**: thread per card, oldest first, delete on your own; author names resolve
  through YOUR graph first, then the sender's published name — a friend-of-a-friend's comment
  renders with a name, not as broken.
- **The demo refuses with a sentence** — publishing invented reactions at real people is the same
  hazard as publishing invented workouts. Reading stays fine.

⚠️ **TESTED AS SOMEBODY WHO IS NOT YOU, because that is the only way a permission can be tested.**
`tests/rules.test.mjs` 46 → **66**: a stranger denied, a signed-out caller denied, a forged `from`
denied, an invented field/kind denied, the wordless comment and the wordy kudos denied, both update
paths denied, cross-viewer delete denied; the happy paths allowed. **A trap found on the way:** the
first run reused projections an earlier revocation test had emptied, so three "happy path" tests
were actually re-testing revocation — the block re-seeds its own state. `tests/social.test.mjs`
106 → **121** pins the pure half (deterministic ids, comment hygiene, hostile-input grouping).
**Rules deployed.**

**Known limitations, stated:** reactions to sessions that scroll out of the 60-session published
window stop rendering but their documents remain (small, slow accumulation — a later tidy);
owner-side moderation has rules support but no UI yet; there is no notification — the strip is a
readout you see when you open Home.

---

## 2026-08-26 — ⚠️ GUEST WORKOUTS ARE BUILT — the half of 0e Tim kept hitting

Tim reaffirmed the whole remaining backlog in one message — *"I wanted them deployed in the last
session, and I'm confident I want them"* — so joint workouts, kudos/comments, location and the
colour options are all authorised work now, alongside the improvement plan (ratios, PRs on finish,
body-map targets, polish). **This is the first piece: the GUEST half of joint workouts.**

### What shipped

**A people bar in the session runner** — chips above the progress dots: **You**, one per guest, and
**"+ Add a person"** (which keeps its words while solo, so the feature is findable the day a friend
turns up). Adding somebody opens a sheet that says the load-bearing sentence — *no account needed;
their sets are kept on your account, under their name, and never mix with your training* — and
switches straight to recording for them.

⚠️ **SWITCHING NAMES SWITCHES THE WHOLE SUGGESTION**, which 0e's design note called the
load-bearing requirement. Each person carries their own entries, own history, own progression
suggestion, own walk position and own body weight (null for a guest — the assist readout stays
silent and progression degrades to rep-only for bodyweight moves, correct by construction). A
guest's second session arrives pre-filled from their own first, via the same `historyFor()`
precedence the owner gets. The exercise swap reads the active person's history too.

⚠️ **A SEPARATE COLLECTION (`guestSessions`), NOT A FLAG ON `sessions`, and that is the safety
argument.** Everything that reads sessions — the muscle map, charts, volume, the published social
projection, progression — would need a filter it could forget, and one forgotten filter counts a
guest's squat as the owner's and publishes it to the owner's friends. A collection nothing else
reads cannot be mis-counted by code that has never heard of it. Tested from both sides, because a
one-way check passes if both reads point at the same rows. **Rules updated and deployed** —
`knownCollection()` carries it, the store↔rules agreement test pins the pair.

⚠️ **FINISH IS IDEMPOTENT NOW, AND HAD TO BECOME SO.** One save used to mean "failed = nothing
landed", so a bare retry was safe. It is now up to N saves (owner + each guest), and a failure
between them meant Finish gets tapped again over rows that already landed — with no id, each would
insert a second time. Ids are minted ONCE, on the draft, before any save, so the retry is an upsert
of the same rows. There is an assertion that re-saving with the same id updates rather than
duplicates.

**The owner saves only when they recorded something** — a coach who ran the whole session for a
guest and lifted nothing gets no empty session on their calendar; the finish screen says
*"nothing recorded for you"* plus one line per guest. Guests get no benchmarks and are never
published. **The day view grew a "Recorded for others" section** — guest name in the title,
*"Their session, kept on your account"* under it, full set-by-set body via the same renderer as the
owner's records, delete only (the confirm says it is the only copy). No edit: a guest record is a
favour held for somebody, not training to maintain.

**Backups carry guests** (exportAll iterates COLLECTIONS), restore gatekeeps a dateless guest row
the same way sessions are gatekept (the getter sorts on date, so one would crash every read).

**Tests: data-layer 1199 → 1208, render 430 → 443.** All eleven suites green. The old-shape draft
(no `others`/`guestNames`) is normalised on resume, so a draft written before this deploy survives
it.

### What is deliberately NOT in it

- **The friend-accept half of 0e** — publishing a session to a real friend's account for them to
  accept. Next on the list is the kudos/comment rules path, which is the same wall.
- **Handover when a guest joins** — the data is stored cleanly under a name to enable it later.
- **A guest day on the calendar grid** — a day where ONLY a guest trained does not colour the
  owner's calendar, because it is not the owner's training. The record is on the day view.

---

## 2026-08-25, evening — HOME IS A FEED, GOALS LEFT THE TAB BAR, CALENDAR CAME BACK

A large batch off Tim's third message of the day. Everything below shipped.

### 1. HOME IS A STRAVA-STYLE FEED, AND NOTHING ON IT STARTS A WORKOUT

*"I got inspiration off of Strava, and I want it to be extremely similar to that... whenever any of
your friends record a workout then it shows up at the top of your feed, with their name, the date and
time, and location at the top of their box, then the title of their workout, and a list of the
exercises they did. Then at the bottom it will have a thumbs up emoji on the left, a comment button
in the middle, and a share button on the right."*

⚠️ **ALL THE WORKOUT-STARTING MOVED TO RECORD** - *"so we don't double dip."* The suggestion and
"choose another workout" are gone from Home. **"Choose another workout" died rather than moved**: on
Home it pointed at Record, and on Record it would point at the list it is sitting on top of.

⚠️ **THIS ANSWERS THE UX REVIEW'S SHARPEST FINDING FROM THE OTHER SIDE.** *"Nothing a user can
see on Home ever grows"* has been item 1 of Open work 0c since 2026-08-22. A feed is nothing but
growth.

⚠️ **STRAVA'S ANATOMY, NOT STRAVA'S CHROME.** He asked for Strava *and* for *"no panels on any
page"* in the same message, and Strava's feed is literally elevated cards with drop shadows. Both are
kept: the **order and content** of a card is copied exactly - avatar, name, date/time, title, what
they did, three actions - while separation stays this app's hairline-and-space (Rule 2). **If he
wants the boxes it is a background and a radius on `.feed-card` and nothing else moves.**

⚠️ **CHRONOLOGICAL, DELIBERATELY.** Researched first: Strava switched its default to a
personalised ranking, got a sustained backlash and a petition, and now ships "Latest Activities" as a
toggle. Newest first, nothing ranked, nothing hidden. There is an assertion on the ordering.

⚠️ **TWO OF THE THREE BUTTONS CANNOT WORK, AND THEY SAY SO WHEN PRESSED.** A kudos or a comment
has to be written where the *other* person can read it, and this app's whole model is that nobody's
client may write into anybody else's data - **the same wall joint workouts hit**. They need a new
rules path (Open work 0l). ⚠️ **Rendered anyway, and honest about it**: a button that silently
does nothing is the fault this project has already shipped once and fixed twice. **Share is real** -
`navigator.share` needs no backend.

⚠️ **NO LOCATION ANYWHERE, and the card says nothing rather than something vague.** Tim flagged
it himself. There is no geolocation in the app, nothing in the projection to carry it, and a privacy
decision to take first. Open work 0m.

### 2. THE DEMO HAS FRIENDS NOW, AND THAT IS WHY THE FEED CAN BE JUDGED AT ALL

`social.state()` refuses in the demo - correctly, because `republish()` must never push invented
training at real people. **That refusal would have made the most important new screen in the app
unjudgeable in the one account built for judging screens**, including to the accessibility audit,
which drives the demo.

⚠️ **READING INVENTED FRIENDS IS NOT THE HAZARD; PUBLISHING IS, and publishing stays refused.**
`buildDemoFeed()` returns a deterministic fortnight from three invented people and touches no
network, no storage and nobody's account.

⚠️ **ONE OF THE THREE SHARES AT THE LOWEST TIER, on purpose** - no `entries` key and no
`startedAt`, because that is what the real projection does. A card for that person is the one most
likely to be built wrong and never noticed, and it has to read as complete rather than as a failed
load. **This project has been bitten by a tidier-than-the-wire fixture exactly once before** - the
expired-invite bug lived in that gap.

### 3. `startedAt` IS PUBLISHED NOW - AT MID AND ABOVE ONLY

The feed needed a time and the projection had none. Added at **MID**, not LIGHT, and the argument is
the load-bearing part: **LIGHT is `DEFAULT_TIER`**, so adding a field there widens what every
existing connection sees, retroactively across the whole 60-session window, on the next publish, with
nobody asked anything. **A widening must be an act by the owner, not a consequence of a deploy.** And
a time of day is a different kind of fact from a date - sixty of them describe a schedule.

⚠️ **IT FOUND A HOLE IN `assertTierClean()` ON THE WAY.** That guard only checked for *numeric*
leaves below a session at LIGHT - **a start time is a string and would have sailed straight
through**, so the safety net was silent for the exact field being added. It now checks the KEY
against an allow-list and fails closed, so any field invented later is a leak at LIGHT until somebody
names it.

`finishedAt` is deliberately NOT published: start plus finish hands over how long somebody was out of
the house. The key is **absent** rather than null when there is no time - one case for the view, not
three. **Mutation-checked twice**; publishing null flips 8 assertions.

### 4. GOALS LEFT THE TAB BAR AND CALENDAR TOOK ITS SLOT

*"I want to remove the Goals section and replace it with the Calendar details."*

⚠️ **OFF THE BAR IS NOT DELETED, and all three halves are asserted together.** `#/goals` still
resolves, Settings links to it, and all three Goals screens gained a back button. **A route with no
way in is deleted in every sense that matters to a user** - that is the half a "we kept the route"
claim usually forgets, so the test checks the nav array, the router case and the link in one block.

This **reverses the 2026-08-22 merge** that folded Calendar into Data. That argument was about what
the two screens *are* - both the past, one squares and one lines. His is about how often he opens
them, and he is the one using it in a gym. **Frequency wins over taxonomy.**

**It also took the Data switch's one oddity with it.** Calendar was the only entry in that control
that navigated rather than setting in-page state, which is why the function needed a special case and
an `onChartMode` fallback. Both gone.

### 5. Muscles is the Data tab's first and default mode

*"In the Data section, the muscle group should be the first tab and the default tab."* It is also the
mode that works with the least history - one benchmark colours the map, where a line chart needs two
points before it can draw anything.

⚠️ **The audit's route list needed a new step because of it.** `#/graphs` now opens on Muscles,
so the Graph row has to click its way there - without that the audit would have measured the muscle
map three times and the line chart never, which is **the exact fault found on 2026-08-24**.

### 6. The calendar's day cells are the workout name now

*"Make the items for that day fill up that day's box entirely, besides the number, and have the name
of the workout be as large as possible."*

```
                    before      after
  cell               50x52      50x66
  the name's box    ~44x20      44x46
  type size            8px     12.09px
```

The name fills everything the number does not, wraps to two lines rather than clipping, and the
`+2` count is the one thing that does *not* take an equal share - it is a count, not a workout.

### 7. TWO REGRESSIONS, BOTH CAUGHT BY MACHINES RATHER THAN BY EYE

1. **The first-run path lived on Home and the feed destroyed it.** An empty account's "Pick a
   programme" - the 2026-08-21 work that took install-to-first-logged-set from about a dozen taps to
   five - was Home's empty state. A render test failed on it. **The property now belongs to Record**
   and the test moved with it. ⚠️ **A brand-new user's Home is legitimately an empty feed**, and
   the onboarding is one tab-tap away behind the biggest button in the app.
2. **The new "Start" pill measured 4.08:1 in the light theme** - below AA - and the a11y audit found
   it, not a person. Same weakness the palette notes already record: `--accent` has the least
   headroom of any light-theme token. Fixed with a darkened same-hue gold **scoped to that pill**,
   because `--accent` is also a fill under `--accent-ink` in a dozen places and moving the token
   would break twelve pairs to fix one.

**Re-audited: 56 route/width/theme combinations, 5,782 text nodes, zero below 4.5:1, zero horizontal
overflow, median ratio 9.41.**

---

## 2026-08-25, later — ⚠️ TIM'S OWN COLOUR KEY, AND THE GREY THAT WAS TOO GREY

Three things off his second gym session's follow-up. A fourth — the whole-app colour direction — he
asked to see options for rather than have decided, and that is still open.

### ⚠️ 1. THE LEVEL PALETTE IS HIS NOW, AND IT COSTS SOMETHING REAL

He sent a screenshot of another app's key and asked for *"the exact same colors that this image uses
in order, but add one more"*. Sampled off the image, they are **Material Design**:

```
  Beginner  red    #F44336      Advanced  blue   #2196F3
  Novice    orange #FF9800      Expert    purple #9C27B0
  Interm.   green  #4CAF50      Elite     pink   #FF4081
  Proficient       #4DD0E1   ← the added one, Material Cyan 300
```

⚠️ **WHERE THE SEVENTH GOES WAS NOT A FREE CHOICE.** Five of his six level names are ours, so keeping
each on its reference colour leaves exactly one hole — **Proficient, between green and blue** — and
the hue sweep has exactly one gap, in the same place.

⚠️ **WHICH CYAN WAS MEASURED, NOT PICKED.** Six candidates through the dataviz validator; the
deciding number is the normal-vision adjacency floor:

```
  Cyan 500  #00BCD4   blue↔cyan  ΔE 12.6  FAIL   ← the family-perfect tone, and the one
                                                    a full-colour reader cannot tell from Advanced
  Teal 500  #009688   green↔teal ΔE 12.5  FAIL
  Cyan 300  #4DD0E1   blue↔cyan  ΔE 17.6  PASS   ← chosen
```

⚠️ **WHAT IT COSTS, STATED RATHER THAN BURIED.** The ramp it replaces was built in OKLCH with
**strictly monotone lightness**, which is what made it read as a scale rather than a rainbow.
Material's tones do not, so **the ordinal lightness cue is gone** — Novice is now lighter than Elite.
Measured on the seven: lightness band FAIL, CVD adjacency FAIL (green↔orange ΔE 3.6 protan),
normal-vision floor PASS, purple 2.76:1 against the dark surface.

⚠️ **THREE OF THOSE FOUR ARE INHERITED FROM HIS SIX, NOT CAUSED BY THE SEVENTH** — every rejected
candidate above made something worse; this one makes nothing worse.

⚠️ **AND THE MITIGATION IS THE OTHER THING HE ASKED FOR.** The validator's rule is that a CVD failure
is survivable *"ONLY with secondary encoding: direct labels"*. The new key **is** those labels, which
is why the render test asserts the level NAME inside each chip rather than just counting them.

⚠️ **ONE THING THE REFERENCE IMAGE GETS WRONG AND THIS DOES NOT.** It puts white text on all six —
2.16:1 on its orange, and 1.84:1 on the cyan had we copied it. The ink here is chosen per chip from
the chip's own luminance: **worst of the seven is 4.95:1**, most far above.

⚠️ **AND THE TWO THEMES NOW AGREE.** The old ramp ran its hues in *opposite* order in light mode, so
Beginner was blue in dark and green in light — the same level, two colours, and a screenshot shared
between two users could disagree with itself.

### ⚠️ 2. THE KEY IS CHIPS — and the audit caught what that broke

*"The key is too small and not clear enough… mini round boxes right below the picture of the human
with the name of the ranking inside and the box shaded in the color that it is."* Built: seven chips,
26 px tall, name inside, measured 46–98 px wide with no horizontal overflow at 390 px in both themes.
It replaced a 10 px swatch, an 11 px grey name and a 10 px percentage, three to a line.

⚠️ **A LEVEL COLOUR IS A FILL COLOUR, NOT A TEXT COLOUR, AND THE AUDIT IS WHAT ESTABLISHED THAT.**
`.lv-text-*` painted the level word in the ramp colour, which the old per-theme ramp was built to
support. Under the Material palette the audit measured **"Advanced" at 2.83:1** on Goals in the light
theme — the only sub-4.5 node in **4,970 measured**. On a light ground the blue is 2.83, the cyan 1.6,
the pink 3.0; on a dark ground the purple is 2.89. **There is no assignment of these seven to text
that clears AA in both themes.** So the level word wears the colour as a *background* and picks its
own ink, which also makes a level look identical everywhere it appears.

### ⚠️ 3. "MORE DETAILS", OFF BY DEFAULT

*"Showing the percentile is a little harsh for some people… the default is that it's turned off and
just shows your ranking, and not any percentiles anywhere."* Built as a Settings toggle.

⚠️ **IT HIDES A READOUT, NOT A CALCULATION, and the help text says so.** Every level still comes from
the same percentile it always did. Percentiles surfaced in exactly two places, both on the muscle
screen — the key and the panel's *"stronger than 71 %"* — and both are now behind it.

⚠️ **D15 IS NOT WEAKENED.** Its rule is that the app must never imply the comparison is against
everyone, and that is carried by the `.pane-top` header, which is fixed and on screen whenever the
panel is. Removing a number does not remove the sentence that qualifies it.

**Both directions are asserted**, because a one-way test passes just as well against a hard-coded
`false`.

### ⚠️ 4. THE GREY WAS PASSING AA AND STILL TOO GREY

*"The pure white text is fine to read, the grey text is really challenging to spot and read."* He is
right, and the numbers say why it was not caught: **the two most common type sizes in the whole
stylesheet are 12.5 px and 11.5 px**, and **71 rules paint `--ink-faint`** — the app's default body
text was two steps below its headings with almost nothing in between.

```
                  dark            light
  faint   5.44  ->  8.52    5.24  ->  8.53
  soft    7.15  -> 11.33    7.20  -> 11.32
```

⚠️ **THIS IS THE FIRST CHANGE TO THESE TOKENS NOT MADE TO REACH AA.** The 2026-08-20 raise was a
failure being fixed; this one is a pass that was not enough. **The worst cell in the table is now
7.12, above what the *best* faint cell managed before.** `.field-help` — the caveats and citations
this whole app rests on — went 12.5 → 13.5 px.

⚠️ **`tests/a11y.test.mjs` REJECTED THE FIRST ATTEMPT** at these values for letting the two themes
drift 1.9 apart; they are now within 0.01 at each step. **Re-audited: 52 combinations, 4,970 text
nodes, zero below 4.5:1, zero horizontal overflow, median ratio 9.19.**

### Still open — the colour direction he asked to see options for

*"The entire cite is just really colorless. Besides a few buttons that are massive and orange (which
is just too much sometimes), everything is black and white. Maybe brainstorm a few options."* The
legibility half is done; **the palette direction is a taste call and is his to make.** Open work 0k.

---

## 2026-08-25 — a second gym session, and ⚠️ JOINT WORKOUTS WERE NEVER BUILT

**Tim trained again and came back with four things.** Three shipped. The first is not a bug report.

### ⚠️ 1. "It doesn't seem like the joint workout system is working" — IT DOES NOT EXIST

`grep -ri "joint\|partner\|guest\|recordFor" js/` returns **nothing**. Joint workouts are **Open work
0e**, raised on 2026-08-24, designed but never built — the index has said "needs a plan doc before
code" since. **Nothing is broken; the feature is absent.**

⚠️ **THIS IS THE STANDING RULE MEETING ITS OWN MIRROR IMAGE.** The file has said since 2026-08-22
*"do not read 'X is broken' as X being broken — check first"*, and that has always been about
reports of regressions. This is the other direction: a report that a feature is faulty, where the
honest answer is that there is no feature. **Checking first answers both, and it is one grep.**

**He has now asked for it twice, and the second time from the gym.** That makes it the top item, and
the thing to build next. ⚠️ **The half worth building FIRST is the guest case** — 0e's own note
already says so: *"logging for a guest — a name with no account — kept in the recorder's own data…
that is the case Tim actually hit, because his friend could not sign in at all."* It needs no
Firestore rules change and no accept flow, and it is the case he keeps hitting.

### ⚠️ 2. RECORD LOOKED LIKE A LIST OF THINGS TO READ ABOUT

*"It's not clear that by clicking on any of the workouts that you'll actually start a workout, it's
easy to assume that you'd just look into details about it or something."*

⚠️ **A chevron means exactly one thing everywhere else in this app: go and look at that.** Every
other `.row` in the product navigates to a detail screen. This row **begins a session** — the single
most consequential tap in the app (D4) — and it was wearing the same clothes as a link to a settings
page. The rows now carry a **"Start ▶" pill**, 61.5 × 24 px, and no chevron.

⚠️ **The word, not just the triangle.** A play glyph alone could as easily mean "expand", and this is
the screen where the cost of a misread is highest — starting a session you did not mean to start,
mid-gym.

### ⚠️ 3. THE PROGRAMME'S NAME WAS THE ONE THING NOT SHOWN

*"Make the title of the workout system more clear because that's the first thing that the user will
try to find."*

⚠️ **This reverses a call made on 2026-08-22 — "a sole heading is decoration" — and he is right.**
With one system the name was **not rendered at all**; with several it was `.section-label sub`, an
11.5 px grey caption, which made **the thing being searched for the least prominent text in its own
group** — quieter than the 15.5 px workout names beneath it. It is a 15 px full-ink heading now, and
it is always shown.

⚠️ **He is describing how the screen is USED, which is what settled it.** Nobody arrives at Record
hunting for "Push"; they arrive knowing which programme they are running, find it, and take the day
off it. Under that reading a sole heading is not decoration — it is the label on the thing you came
for.

**One thing found by looking at it**: with two systems the pane's even `gap` put the second name
exactly halfway between the last workout of the previous group and the first of its own, so it was
ambiguous which group it headed. Extra space above, none below — a heading belongs to what follows it.

### ⚠️ 4. ONLY THE LITTLE NUMBERED SQUARE SELECTED A SET

*"If the user is doing multiple sets, then clicking on the other sets is often confusing because you
have to click on the 1, 2, 3, etc on the side."*

**Measured, before and after, at 360 / 375 / 393 px:**

```
                       before      after
  the live target      21 x 21     298 x 44      (at 360px)
  set row height       35 px       45 px
```

⚠️ **The dead part was the part being read.** The weight and reps are what a lifter looks at and what
a thumb goes to, and they were inert text on a row the full width of the screen.

⚠️ **A REAL BUTTON, NOT A CLICK HANDLER ON THE DIV.** A `<div onClick>` satisfies the request and
silently drops the whole set list out of the keyboard order and off the accessibility tree — the
exact class of fault the 2026-08-20 audit found in nineteen unassociated labels. `.set-pick` carries
the row's whole accessible name, so there is now **one named control per set** instead of a number
labelled *"Edit set 3"* that never said what set 3 held.

⚠️ **Delete is its SIBLING, not its child.** Nesting would be invalid HTML and would need a
`stopPropagation` to keep a delete from also selecting — a guard that works until somebody adds the
next control. Two siblings cannot have that bug.

**The cost, stated:** four sets now come to 179 px against 143, so a 4-set exercise makes the pane
scroll where it previously just fit at 360 px. The footer is pinned, so nothing actionable moved, and
all four sets are still on screen. **Mutation-checked**: moving the values back outside the button
flips exactly the two assertions written for it; a chevron on Record flips two; dropping the sole
heading flips one.

---

## 2026-08-24, last pass — ⚠️ THE CLOUD CEILING WAS WRONG AGAIN, THE OTHER WAY THIS TIME

Tim: *"if something is solidly planned and ready to build, go ahead and build it."* Two items were
decided and unblocked — the two touch targets Open work 0i calls "ordinary and cheap", and 0b(c)'s
*"nothing warns as the limit approaches"*. Both shipped. **The second one found that the number it
was built to warn about is itself wrong by 1.66×.**

### ⚠️ 1. THE ~950-SESSION CEILING IS REALLY ~520, AND THE MISTAKE IS THREE COMMITS OLD

`docs/firebase-setup.md` was corrected on the morning of the 24th: not ~300 bytes a session and
3,000 workouts, but ~1,100 and about 950. **That correction measured `JSON.stringify` length, and
Firestore does not charge JSON length.**

```
                                        JSON    Firestore
  one recorded set {weight:205,reps:6}     23           60      2.6x
  one session (demo year, 17 sets)      1,216        2,015      1.66x
  ceiling                             862 sess     520 sess
```

⚠️ **THE 1.66× IS A MECHANISM, NOT A FUDGE FACTOR.** Firestore charges a flat **32 bytes for every
map** and **8 for every number**, however short they look written down. A session is ~17 set maps
plus a map per exercise, and `entries` is **88 % of the whole collection** — so the map overhead
*is* the document rather than a rounding error on it.

⚠️ **The demo year is NOT unusually fat, and that had to be checked before the finding stood.** Its
sessions come to **1,216 JSON bytes each against the review's ~1,100** — the two measurements agree
on the same data. Only one of them is measuring the thing Firestore bills. There is an assertion for
that agreement, so the cross-check cannot quietly stop being a cross-check.

⚠️ **THE REAL LESSON IS ABOUT CONSTANTS COPIED INTO PROSE.** This number has now gone stale twice,
both times optimistically, and on the second occasion `js/firebase-backend.js` was still carrying
the *first* wrong figure — the morning's fix had corrected the doc and missed the source comment two
files away. So the fix is not a third number: **`store.cloudUsage()` computes it from the account's
own rows**, and both prose copies now point at it instead of restating it.

⚠️ **NEVER VERIFIED AGAINST A REAL REJECTION, and must not be described as if it were.** Confirming
it means writing a megabyte to the live project and watching it fail. It is the published
arithmetic — Firestore → Usage and limits → Storage size — applied honestly, and it errs high.

### 2. The warning itself, and the two things it refuses to do

Settings' *Your data* card paints a warning above **Download backup** from **80 %**, naming the
percentage *and* how many more records fit.

⚠️ **IT SAYS NOTHING BELOW THE THRESHOLD, and that is the design rather than an omission.** The UX
review's fifth finding is that the red "not backed up" dot is on from the first paint, including on
an empty account with nothing to lose — **a permanent warning is wallpaper within a week and stops
being read at the moment it becomes true.** On Tim's few dozen sessions this is silent for about the
next two years.

⚠️ **AND IT SAYS NOTHING UNLESS THE DATA REALLY IS IN FIRESTORE.** On this device the limit is
localStorage's, a different size and a different failure; in the demo there is no limit because
there is no storage. `cloudUsage()` returns `null` on both, with the assertion that flips if that
guard goes. A confident number about the wrong storage is the fault this file keeps meeting.

⚠️ **The "full" branch keys off room for ONE MORE ROW, not on the fraction reaching 1.** A stored
document can never be over the cap — the write that put it there would have been refused — so a
`fraction >= 1` test describes a state nothing can reach. What is reachable is sitting at 99 % with
every new save bouncing, which is the state somebody is actually in when they come looking.

**Also: the runway per row is this account's, not the docs' ~1,100.** Somebody logging twelve
exercises a session has bigger rows than somebody logging four, and the number of workouts they are
told they have left should be theirs. The last population average this project trusted was out by 3×.

**Measured at 360 / 375 / 393 px in both themes:** one block, 332–365 px wide, **no horizontal
overflow at any width**, body text **16.25:1** dark and **15.84:1** light, the `--danger` heading
**5.16:1** and **5.47:1** — all past 4.5:1. It borrows `.preset-warning`'s shape (a danger hairline,
full-strength ink, no fill and no box — Rule 2), which is this app's third use of that shape and its
established way of saying *do not skim this*.

**Mutation-checked, four ways**: charging a number its JSON length flips 5 assertions; letting
`cloudUsage()` answer on the local backend flips the safety one; painting below the threshold flips
2; keying "full" off `fraction >= 1` flips 3.

### 3. The two touch targets from 0i — the ones that are not Tim's illustration

Both measured before and after, at 360 / 375 / 393 px:

```
                              before      after
  comparison button (Muscles)  332x38     332x44
  chart exercise select        156x36     156x44
```

**The 8 px comes off the chart**, which had 501 and now has 493. The control being reliably hittable
is worth more than eight pixels of line. **No horizontal overflow at any width.**

⚠️ **THE BODY MAP'S OWN TARGETS ARE UNTOUCHED AND STILL OPEN** — Traps 42×11 at 360 px, and the
figure is the only way to select a muscle. That lands on Tim's illustration, so it stays his call.
0i is now *the illustration only*.

---

## 2026-08-24, fourth pass — the ratio sweep, a sheet that lied, and two dead routes

### ⚠️ 1. THREE MORE RATIOS, AND THE ERROR IS NOT A CONSTANT

The dumbbell row correction earlier in the day established a class of error. Three more per-side
dumbbell anchors, derived the same way — Strength Level per dumbbell, doubled, over the key lift's
own five numbers at a 180 lb male:

```
                            app    published   inflation
  Dumbbell Bench Press      0.72      0.81        12 %
  Dumbbell Shoulder Press   0.88      1.01        15 %
  Dumbbell Curl             0.88      0.94         7 %
  Dumbbell Row (earlier)    0.85      0.98        15 %
```

⚠️ **ALL FOUR TOO LOW, WHICH FLATTERS** — the estimate divides by the ratio. ⚠️ **And 7, 12, 15,
15 % is NOT a constant offset, which is the finding that matters most: no blanket correction would
have fixed this table, and every remaining reasoned entry has to be derived on its own.**

⚠️ **A ratio above 1.00 is not a mistake.** Two dumbbells outweigh the bar most people can press
overhead, so 1.01 is right and dividing by it brings the number back down.

**Four neighbours moved with their anchors and are NOT measurements** — the old reasoned offsets
carried across a corrected anchor, labelled as such in the file. **Decline dumbbell bench had to
move**: at 0.76 it would have sat below the corrected flat press, claiming a decline is harder to
load than a flat one. Hammer Curl was left alone because 0.98 against a corrected 0.94 still orders
correctly, and scaling it would have stacked a guess on a guess.

**Measured effect**: on the demo account's barbell-led year, Chest −1.6 %, Shoulders −1.3 %, nothing
else moves. **On a dumbbell-led history it is much larger** — Tim's row reading fell 13 %. Which is
exactly the population it was mis-rating.

### ⚠️ 2. The disconnect sheet promised something false

*"...and you will not see theirs."* `social.remove()` edits only MY graph, so their published copy
still lists me in its `viewers` and **I can go on reading their training after pressing it.** Found
by the live social round trip on 2026-08-22 and left standing for two days, because the real fix is
a mutual disconnect needing a rules path their client can read.

⚠️ **The sentence is corrected first and separately, on purpose.** A half-built feature is a known
gap; a screen stating the opposite of what the code does is a lie the user acts on. It now says the
disconnect cuts your side only. `confirmSheet` gained `white-space: pre-line` so the warning can be
two paragraphs — nothing else uses a newline.

### ⚠️ 3. `#/data` AND `#/muscles` ARE NOT ROUTES, and the audit had been auditing Home twice

Found while driving the muscle panel for the fatigue work. `resolve()` has no case for either and
falls through to `default: return HomeView()`. `tools/a11y-audit.mjs` listed **both**, so **the Data
screen and the body map had never been audited at all** — not their contrast, not their targets.

Fixed in the tool: the real route is `#/graphs` and the four data views are in-page modes, so a
route row can now carry a step to run after navigating. Four rows cover Graph, Bars, Muscles, and
**Muscles with a muscle selected** — the panel does not exist until one is tapped, so auditing the
map without that measures the figure and none of the words beside it.

**Re-run: 52 route/width/theme combinations, 16 of them never measured before.**

✅ **CONTRAST IS CLEAN.** Zero text nodes below 4.5:1 across all sixteen. The palette work holds on
the screens nobody had checked.

⚠️ **The body map's own targets are small**, and this is a real finding on Tim's illustration: at
360px the smallest muscles are **Traps 42×11, Glutes 39×16, Shoulders 62×18, Neck 24×17**, and
**the figure is the only way to select a muscle** — there is no list beside it, so the year grid's
equivalence argument (every 6px day also reachable at 40px in Months) is *not* available here.
⚠️ **Not fixed: it lands on the illustration, which is Tim's half.** Also just under: the comparison
button (332×38) and the chart's exercise `select` (156×36).

⚠️ **DO NOT READ THE TOOL'S `hit44` COUNT AS A DEFECT COUNT.** It hit-tests the corners of a 44px box
centred on the control, so anything narrower than 44px in either dimension fails by construction —
**1616 of 2068 controls on the previously audited screens fail it too.** It is a tripwire for
finding candidates, not an acceptance test, and reporting it as "41 failures" would be a number that
sounds like a verdict and is not one.

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

⚠️ **CORRECTION, 2026-08-24: two of those eleven routes were not routes.** `#/data` and `#/muscles`
have no case in `resolve()` and silently rendered Home, so this run measured Home three times and
**never once measured the Data screen or the body map.** Everything below still stands — it is about
the palette, which is global — but the coverage figure in this section was never what it claimed.
Fixed in the tool and re-run; see the FOURTH pass of 2026-08-24 (the ratio sweep).

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

### ⚠️ THE INDEX. Read this first; the lettered sections below are in the order they were WRITTEN

**Rebuilt 2026-08-28.** More than half is closed work, and **everything left that needs nothing from
Tim has been deliberately PINNED rather than queued** — see the pinned table and read its rule
before suggesting anything from it.

**Nothing is blocking. Tim can use the app and is on a current build (0a, closed).**

⚠️ **OPEN WORK FIRST, THEN WHAT CLOSED.** The letters are historical ids and cannot be renumbered —
things elsewhere in this file and in `docs/` cite them ("Open work 0b and 1"), and moving one would
break a reference somebody follows. **This table is the reading order instead**, and as of
2026-08-27 more than half of it is closed, so the closed rows are collected at the bottom rather
than left at the top where they were written.

### Open, in the order worth picking up

| | What | State |
|---|---|---|
| **1** | **the field checks — needs Tim's phone, not yours** | ⚠️ **THE BIGGEST ONE IS NOW A TEN-MINUTE JOB WITH AUTUMN**: search her by name, send a request, have her accept it, and record a workout for her so it lands in her account. **Everything social built on 2026-08-29 is proved against the rules engine and has never been done by two people.** Also standing: the **friend-name heal**, a real **kudos/comment** round trip, and — needing only his eyes — **the blue box round the profile picture on a laptop** (a real bug was found and fixed in that exact place, but a *blue* one was never reproduced). ⚠️ **And file import has never parsed an actual export** from any service. ⚠️ **Added 2026-08-30: nobody has read the Research topics on a phone** — the facts are checked and measured, the reading experience is not |
| **2** | **0c — the UX list** | ⚠️ **OPEN, and it is judgement rather than bugs.** Its headline item closed on 2026-08-25 (Home is a feed, which is nothing but growth) and the "hard sets" half was answered on 2026-08-24 by *saying* what is counted. **What is left is one question for Tim**: should logged warm-ups be excluded from the volume count? His call, because the obvious fix would also throw away genuine back-off work |
| **3** | **activities, Phase 2 — item 6** | Items 1–4 shipped 2026-08-27. **Item 6 says to ASK TIM** which activities his circle actually logs — climbing grades are the least standardised thing in the list. `docs/activities-plan.md` §3. ⚠️ **Item 5, activity PRs, is PINNED (P1)**, not open |
| **5** | **0i — the body map's touch targets** | ⚠️ **MOSTLY CLOSED.** Invisible hit halos grow every muscle ~10 px in all directions without touching the art (Traps 44×15 → ~64×35 effective, CDP-verified). What remains under 44 px lands on **Tim's illustration**, so it stays his call |
| **6** | **0f — Tim's friend could not sign in** | ⚠️ Unread bug report; he asked to investigate it himself. **May not be new** — a plain Safari tab is still the one surface no working device has confirmed |
| **8** | **item 2 — the estimator, Phases 1–3** | The Goals *verdict* waits on it. ⚠️ **It has questions for Tim** — §16 sets the hard constraint (the band fits inside one level only 8.5 % of the time), and §14 asks whether the estimator may draw on all evidence at once (narrowing D14). ⚠️ **The plan's claim that Phase 1 is blocked on data the store does not carry is WRONG** — see the 2026-08-28 section, item 5. `setIndex` and `exerciseIndex` are array positions in data already on disk, derivable at any time. Phase 1 is small; what gates the feature is Phase 2, and Phase 2 needs him |
| **15** | **the usability findings — waiting on Tim's pick** | ⚠️ Four standing findings from the 2026-08-28 usability drive, reported to him and not yet chosen from: **no wake lock** (the biggest hands-free lever), **prefill counts as recorded at Finish**, the **Record chooser's extra tap**, and the Run log's **"28" = 28 seconds** parse. See that day's second-pass section. ⚠️ **The prefill one is HALF fixed as of 2026-08-29 and the halves matter**: a never-done exercise is now guarded (`prefilled`, refused by the save path), an exercise WITH history is untouched — walk past it and last time's numbers record as though you did them. Left alone deliberately: it is a behaviour change on every workout and his to pick. ⚠️ **The rest-timer items in the same list are DECLINED, not waiting** — do not resurface them |
| **16** | **the HANDLE version of finding people** | 🚨 **Specified, ready, and a DECISION rather than a discovery.** Name search shipped 2026-08-29 on Tim's explicit call at fewer than five users, and it required granting Firestore `list` on a directory — which is enumeration of every row and cannot be narrowed by a rule. The replacement: `handles/{handle}` → uid, **`get` yes and `list` no**, exact lookup of a handle you chose, nothing enumerable. `docs/social-plan.md` §3.4 already blesses that shape. ⚠️ **The rules test's one deliberate `allow` — "any signed-in account can list the whole directory" — is the line that flips to a denial the day this lands**, and the `directory` block should be deleted with it |

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
| **Everything at once** | **3,465 assertions across TWELVE suites** (recounted 2026-08-30: data-layer 1763, render 705, goals 232, bodyweight 170, social 162, a11y 85, optimal 76, strength-estimate 72, volume-map 64, demo 58, year-grid 45, qr 33), plus 12 in `sw-update` and **147 in `rules`** (emulator). ⚠️ **Test-only npm deps, none of which ship**: `render` needs `jsdom`, `qr` needs `jsqr`, `rules` needs `@firebase/rules-unit-testing`. ⚠️ **`npm i --no-save` REPLACES what is there** — install them in one command (`npm i --no-save jsdom jsqr @firebase/rules-unit-testing`) or the previous one vanishes and its suite fails with MODULE_NOT_FOUND. Everything else needs nothing. ⚠️ Treat any number here as a recount rather than a running tally |
| **Year-grid tests** | `node tests/year-grid.test.mjs` — 45 assertions, **no dependencies**. The calendar's Years view: every day drawn exactly once, every square in its real weekday row, every month label over its own month |
| **Data tests** | `node tests/data-layer.test.mjs` — 1763 assertions, **no dependencies**. ⚠️ Since 2026-08-30 it also holds the **EXERCISE-PICTURE manifest**: that it matches `img/exercises/` on disk (a forgotten `tools/build-exercise-images.mjs` fails here, because the drift is otherwise silent — a filename typed wrong shows no picture, and no picture is this feature's normal state), that every picture is in the sw precache (**D6**), and 🚨 that a picture given to one "Cable Kickback" is not given to the other. ⚠️ Since 2026-08-30 it also holds the **MOVEMENT FAMILIES** — that all 271 members resolve to exactly one exercise (the `preset-systems` by-name lesson on a second table), that no exercise is in two families, that a leg press offers four kinds of EQUIPMENT rather than five barbell squats, and 🚨 that Hip Adduction, Neck Curl and Tibialis Raise have **no family on purpose** because each is the opposite movement to its lookalike. And **the Research tab's content**: that every claim on that screen cites a source that is actually defined, that every topic states its own limit, and the **WORD BUDGETS** — 45 words an answer, 48 a bullet, 260 a topic. That last group is the point of this section: every other assertion anybody would write about educational text checks it is PRESENT, and none of them can catch prose piling back up. It also pins the three sentences whose popular version is the OPPOSITE of the finding (stretching not preventing injury, "not to failure" not meaning stop early, no best time of day). ⚠️ Since 2026-08-27 it also holds the **profile-photo crop maths** (the crop square never leaves the image — 1,925 combinations, zero escapes) and the **file-import parser**: the date order, the weight unit and the distance unit are each REFUSED rather than guessed, and a re-import upserts instead of doubling. ⚠️ Since 2026-08-24 it also carries **how full the cloud is**: Firestore's published per-type charges, that a number costs 8 bytes against 3 as JSON so a size check built on `JSON.stringify` would fire too late, that the demo year agrees with the review's ~1,100 JSON bytes a session (so the 1.66× is Firestore's accounting and not an unusual fixture), and **that `cloudUsage()` says nothing at all unless the data really is in Firestore**. ⚠️ Since 2026-08-24 it carries the **within-session fatigue** section: Tim's real back session driven end to end, that the lift he did third no longer leads it, that the first exercise is never discounted, that the same three exercises **in a different order now rate differently** — which they did not before — and that a benchmark is never fatigued |
| **Body-weight tests** | `node tests/bodyweight.test.mjs` — 170 assertions, **no dependencies**. What fraction of your body weight each movement carries, that it is read from the DATE OF THE SET, and **which exercises are refused and why**. ⚠️ Since 2026-08-24 it also pins the **assist** branch — that 70 lbs of help at 180 lbs is 110 lbs of resistance, that more help than you weigh is refused rather than reported as a negative load, and that an assisted set is discounted **below a real pull-up muscle for muscle**. The exclusion list it guards lost one entry that day and the reason is written into the list itself |
| **Estimator tests** | `node tests/strength-estimate.test.mjs` — 72 assertions, **no dependencies**. Most assert MEASURED simulator outcomes, each with a vacuity guard. `node tools/strength-fit.mjs` re-derives every constant rather than trusting it |
| **Social tests** | `node tests/social.test.mjs` — 162 assertions, **no dependencies**. What a person SHARES. ⚠️ Since 2026-08-29 it also pins the **name matching** (prefix of the whole name OR of any word, never a substring inside one — "nn" finding "Anna" is how a list of strangers starts looking like a list of matches) and the graph's **`pending`** list, including that somebody already CONNECTED is never also pending. ⚠️ Since 2026-08-22 the invite block is fed **the shape the network really returns** — a Firestore Timestamp, not the tidy ISO string the old fixtures used. That gap is where the expired-invite bug lived |
| **Volume tests** | `node tests/volume-map.test.mjs` — 64 assertions, **no dependencies**. Direct/indirect mapping, the published efficiency tiers, and the per-session clamp |
| **Rating tests** | `node tests/optimal.test.mjs` — 76 assertions, **no dependencies**. The dose-response curves, and the three things the rating refuses to do |
| **Goals tests** | `node tests/goals.test.mjs` — 232 assertions, **no dependencies**. The requirements model, progression, and **the three things Goals refuses to do**: read the calendar to decide what it asks of you, emit a verdict, and let a clock make anything heavier. ⚠️ Since 2026-08-24 it also **plays an assist machine forward through forty obeyed sessions** and asserts it never once proposes more assistance. That section replaced two assertions that were green while the bug was live, because they read the SOURCE for a guard rather than driving the function with the exercise that reaches it |
| **Demo tests** | `node tests/demo.test.mjs` — 58 assertions, **no dependencies**. That the generated year is DETERMINISTIC (the same day is byte-identical, so "resets to the default" is literal), PLAUSIBLE against the app's own modules, and that **the backend serving it is single-flight** |
| **Accessibility tests** | `node tests/a11y.test.mjs` — 85 assertions, **no dependencies**. Pins **all four PALETTES**: every text token against every surface it can be painted on, in both themes, plus the three-step hierarchy and the two fixes that are invisible when they break. ⚠️ **Not a substitute for the audit** — it caught a latent light-theme pair no screen currently paints, and the audit caught an accent-coloured number on one cell in the month. Neither could have found the other's |
| **The accessibility AUDIT** | `tools/a11y-audit.mjs` — drives Chrome over **76** screen/width/theme combinations, and since 2026-08-27 takes a `PALETTE` env var (gold/teal/indigo/ember) so all four can be swept (gold re-run 2026-08-30 over 76 × **7,566** nodes: zero below 4.5:1, zero overflow, zero unnamed controls; ⚠️ **the SWAP SHEET joined on 2026-08-30 and it is the first SHEET this audit has ever measured** — a sheet only exists after an interaction, so the exercise picker and the visibility sheet have never been in it either; the last all-four sweep was 240 combinations and 23,496 nodes on 2026-08-27). 🚨 **TWO THINGS THE TOOL ITSELF HAD WRONG, both fixed 2026-08-30 and both found by measuring the Research topics.** (1) **A closed `<details>` still reports a box for its contents in this Chrome** — it hides them with content-visibility, not `display:none` — so the collapsed pane and the opened one measured an identical 328 text nodes. Never a false pass (those colours do get painted on open) but a **false coverage claim**, and the research TABLE had been counted that way since 2026-08-28. (2) **`summary` matched nothing in the control selector** — natively focusable, no `tabindex` — so **every disclosure control in the app had been unmeasured for touch target and accessible name since the first one shipped**; the topic summaries measure 49–78 px by 332/362. ⚠️ **THE SESSION RUNNER JOINED IT ON 2026-08-29 and had never been measured before that** — the one screen the app exists for, skipped because a session needs a workout id and the route list only held static hashes. It is reached by driving Record → Weightlifting → the next workout, and **the step asserts it landed** (`.set-list` must exist): the first version matched `/^Start/` against the chooser's rows, whose text begins with the workout NAME, and silently filed four route-instances of the picker under the runner's name. A failed step is now **printed rather than swallowed**, for the same reason. Set through the ATTRIBUTE, because the demo backend reseeds on every reload. ⚠️ **Until 2026-08-24 two of its routes (`#/data`, `#/muscles`) did not exist and silently rendered Home**, so Home was measured three times and the Data screen and body map never once. Fixed: the real route is `#/graphs` and a route row can now carry a step to run after navigating, which is how the four in-page data modes and a selected muscle are reached. Needs a scratch copy with the config blanked; the header has the commands. ⚠️ **Its `hit44` flag is a TRIPWIRE, NOT A VERDICT** — it fails 1616 of 2068 controls on long-audited screens, because anything under 44px in either dimension fails by construction. **The only thing that can measure contrast against the colour actually painted, or hit-test a touch target** |
| **Render tests** | `npm i --no-save jsdom` then `node tests/render.test.mjs` — 705 assertions, mounts every screen. 🚨 **Since 2026-08-30 its first picture assertion is about ABSENCE**: with no art bought, NOTHING renders a thumbnail and no name becomes a button — the screen is what it was before the feature existed. That is the only thing making it safe to ship ahead of the art, and it is mutation-checked. It then injects one picture and drives the rest: the name opens a full-screen viewer, the ✕ and Escape both close it, and a thumbnail inside a row is never itself a button. ⚠️ **Since 2026-08-30 it pins the SWAP SHORTLIST and REMOVING A PERSON**: five alternatives rather than 275, spanning three or more kinds of equipment, tapping one swaps straight to it (asserted by CLICKING, the only version that catches an inert row), the full picker still one tap under it — and 🚨 that the lead does NOT promise "different equipment" for a deadlift, whose family is barbell-only. For people: exactly ONE remove control, on the ACTIVE person, **asserted with two guests on the bar because with one it passes however the code is written**. ⚠️ **Since 2026-08-30 it pins that the Research topics arrive COLLAPSED** — eleven of them open at once is the wall that content exists not to be — that each is a real `<details>`/`<summary>` rather than a hand-rolled control that would drop off the accessibility tree, and that opening one reveals an answer, a stated limit and a live link. Mutation-checked: making them open by default flips exactly the collapsed assertion. ⚠️ **Since 2026-08-29 it holds the two SAFETY assertions for the first-time prefill**: tapping Finish having touched nothing records NOTHING, asserted separately for the derived weight because that is the number that would otherwise be most convincing. Both mutation-checked. It also pins that a request is an ASK rather than a connection, that a QR is hard-coded black-on-white, and that the finish screen's back button actually goes somewhere — **asserted by CLICKING it, which is the only version that would have caught the five inert back buttons it did catch.** ⚠️ **Since 2026-08-29 it pins WHERE THE STEPPERS ARE**: exactly one `.steppers` on the screen, inside `.set-list`, directly under the open row — and opening set 3 MOVES it there. Plus the one that would otherwise have shipped as a bug: a nudge must update the row **in place**, asserted by holding the row NODE across the change, because a rebuild would destroy the input being typed into. Both mutation-checked, each flipping only itself. ⚠️ Since 2026-08-27 it pins three things a browser could not: that the **Friends screen renders while the network is still hanging** (it is handed a read that never resolves — re-adding the `await` fails it), that **a workout offered by a friend writes NOTHING into your training until you tap Add**, and that the disconnect sheet says both that they are told and that it is eventual. ⚠️ Since 2026-08-25 it pins the three things Tim's second gym session changed: that **clicking the weight and reps of a set opens that set** (the numbered square was the only live part), that every Record row **says Start and wears no chevron**, and that the programme's name is on Record **even when there is only one system**. ⚠️ Since 2026-08-24 it also drives `cloudFullWarning()` directly — the only way that wording gets read, because no test can stand up a Firestore backend and `cloudUsage()` correctly returns null on every backend one can. It pins that an account with room is told **nothing**, and that the "full" branch keys off room for one more row rather than the fraction reaching 1. ⚠️ Since 2026-08-24 it holds the two runner assertions that stopped a convenience becoming a lie: that opening set 2 for the first time arrives pre-filled from set 1, and that **a set nobody opened is still not saved** — the eager version of that fill recorded work the lifter had not done, and these tests are what caught it. ⚠️ Since 2026-08-21 it also pins the **view/edit split**: that opening a system is reading it, that a workout can be STARTED from its own screen, that Delete is not in either pinned footer, and that Settings renders inside the demo account. It also holds the one assertion in this project that is a **budget rather than a presence check** — a muscle panel is capped at 40 words, because every other assertion here checks something is THERE and no such check can catch words piling back up |
| **Deploy-notice test** | `node tests/sw-update.test.mjs` — 12 assertions, needs Chrome, **no other dependencies**. Copies the app to a temp dir, serves it, installs the worker, then EDITS A FILE and asserts the page offers a refresh. The one test that cannot be faked |
| **QR tests** | `node tests/qr.test.mjs` — 33 assertions. Needs `npm i --no-save jsqr` for the strongest layer: the encoder's output is rendered to pixels and **decoded by an independent implementation**, which validates format-info, masking, placement, interleaving and ECC in one assertion. Also carries ZXing's published Reed-Solomon vectors. ⚠️ **It does NOT assert which mask a payload gets** — ZXing, Nayuki and the ISO text disagree on penalty-rule-3 details, so a correct implementation can legitimately pick a different one |
| **Rules tests** | `npm i --no-save @firebase/rules-unit-testing`, then **`JAVA_HOME` must point at Temurin 21** (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`), then `firebase emulators:exec --only firestore --project demo-test "node tests/rules.test.mjs"` — 147 assertions, who may READ your data — and since 2026-08-27 who may OFFER you a workout and who may announce a disconnection, and since 2026-08-29 who may ASK to connect. 🚨 **One assertion in here is deliberately an `allow` that records a cost rather than a guarantee** — "any signed-in account can list the whole directory" — because a suite that pinned only the good news would describe a feature this app does not have. **It is the line that flips to a denial when the handle version lands.** ⚠️ **On the Oracle JDK the emulator dies silently** — see §0.9 |
| **Rebuild the picture manifest** | `node tools/build-exercise-images.mjs` — after dropping files into `img/exercises/` named `<exerciseId>.<ext>`. Rewrites the manifest in `js/exercise-images.js` AND the precache block in `sw.js`. ⚠️ It REFUSES a badly-named file rather than skipping it: a picture that never appears looks exactly like one that was never bought. `img/exercises/README.md` has the naming and the licensing |
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
    - ⚠️ **SINCE 2026-08-27 THE SAME CACHE COVERS THE CLOUD SOCIAL READS** — the graph and the
      invite list — with the same contract and the same 30-second silent revalidate. Mutations call
      **`readGraphFresh()`** and **`socialWrote()`**; only `state()` and `invites()` are served from
      memory. Clearing is wired **inside `clearReadCache()`**, so an identity change drops both.

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
| `docs/research.md` | **All research, by category**, evidence graded 🟢🟡🔴 with sources. Append — never start a new research file. ⚠️ **§13 is the one that is on a user's screen**, so a wrong grade there is a wrong claim in the product |
| `js/exercise-images.js` | Not a doc. **The exercise-picture manifest — GENERATED, never hand-edited.** Read its header before touching pictures: it records why the art is absent (Gym Visual is a paid library), why the manifest is keyed by id rather than name, and why a manifest exists at all (D6 — the service worker can only precache a file it is told about). `img/exercises/README.md` is the how-to |
| `js/exercise-families.js` | Not a doc. **The swap sheet's alternatives — read its header before adding a member.** A family is a MOVEMENT, not a muscle; one family per exercise, asserted; and ⚠️ **four exercises are deliberately family-less because their lookalike is the opposite movement**. Members are named strings, so a test resolves every one to exactly one exercise |
| `js/research-topics.js` | Not a doc. **The Research tab's eleven topics — read its header before adding one.** Every claim names a source, every source is defined ONCE, every topic states its own limit, and nothing goes on that screen below "limited evidence". ⚠️ **Anything added here must be added to `docs/research.md` first**, with its grade and its limitations |
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
| `js/import-file.js` | Not a doc. **Read its header before touching the importer**: it records that NOTHING here has ever seen a real export file, which is why every column is detected by name and confirmed by the user rather than hard-coded as "the Strava importer". ⚠️ Three things it REFUSES to guess — the date order, the weight unit and the distance unit — because each would be wrong silently and permanently. The distance one was a real shipped bug, caught by driving it |
| `js/image-crop.js` | Not a doc. The profile-photo crop, in SOURCE pixels so the result does not depend on the phone it was cropped on. One invariant: the crop square never leaves the image, or an avatar saves with a blank wedge in it |
| `docs/activities-plan.md` | **Non-lifting activities**, written 2026-08-26. §1 is D27 (recorded, never modelled — the D2 narrowing); Phase 1 (the Record chooser + quick log) is BUILT, and §3's **items 1–4 shipped 2026-08-27** (the Activity group, pace, the normalisation guarantee, the feed glyph). ⚠️ **Item 5 needs design** (activity PRs need distance-bucketing) and **item 6 says to ASK TIM** which activities his circle logs; §4 is what is deliberately not planned (no GPS routes, no fitness modelling) |
| `docs/integrations-plan.md` | **Pulling data from other fitness/diet apps — RESEARCH ONLY, written 2026-08-27 on Tim's ask.** ⚠️ **§2 is the part to read**: the blocker is not "website vs App Store app", it is that OAuth's token exchange needs a client secret and a static site cannot keep one — and a native app is just as public a client. §3.1 records that **Strava's 2026 agreement forbids showing one user's Strava data to another user**, which lands directly on the Home feed. §5 recommends file import first, which needs nothing from anybody |
| `docs/airpods-plan.md` | **AirPods remote control — PLAN ONLY, nothing deployed, on Tim's instruction.** §1: head-motion is impossible for a web app, stem presses are buildable via MediaSession. §2 the design + priced costs (occupies Now Playing → opt-in only); §3 the dead-end table; §4 the build order if he says go, starting with an on-device spike |
| `docs/icon-options/` | 🛑 **DELETED 2026-08-31, and it is not coming back on your initiative.** Tim rejected all six candidates and took the icon back: *"a mistake for you to work on them… I'm going to improve it later myself."* Recoverable at commit `fb72f8d`. `icon.svg` is untouched |
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
| **Record** (nav) | ⚠️ **A CATEGORY CHOOSER since 2026-08-26** — Weightlifting (first, biggest, carries the next-in-rotation name, leads to the full recorder at `#/start`) plus Run / Walk-or-hike / Swim / Cycle / Climb / Something else, each a quick activity log saving a real session (D27: recorded, never modelled). The lifting picker’s rows each show **`~N min`** — the median of that workout’s own recorded durations, sets × 3 min before any exist, rounded to 5. ⚠️ **The suggestion is LEAST-RECENTLY-DONE since 2026-08-26** (`js/next-workout.js`) — the old next-in-list rule read alphabetical order on self-built systems and told Tim to repeat Monday’s Pull; never-done counts as longest-waiting, rotation order survives as the tie-break, and the caption says what was read. Still a LOOKUP, never advice; silent when it would have to guess; skips sessions whose workout was deleted **and** activity sessions (no workoutId). **§1.2’s other half — suggesting weights and reps — still waits on the estimator** |
| **Set types** | **Supersets, tri-sets, giant sets, drop sets and myo-reps** — `js/set-types.js`, `docs/vision.md` §1.5, D23. **In the builder**: a chip on each exercise opens a sheet naming all three set types *and explaining what each one is* (D8 — "myo-reps" is jargon), with a mini-set count under whichever is picked; and a **link control sits in the GAP between two exercises** — "Superset with next" / "No rest — tap to separate" — because a superset is a statement about the space between them, not about either one. A joined block is bracketed by an accent hairline and named for its size. **In the runner**: a superset is walked round by round (A, B, rest, A, B) and the banner sits above the exercise name saying which round and whether to rest; the forward button reads "Straight into Overhead Cable Extension" or "Round 2 of 3". **The rest timer does not start mid-round**, nor after the top set of a drop set — those are the two places where the old "log a number → start resting" rule would have told you the opposite of what the set type means. A nested set's button IS the instruction — "Strip the weight — add a drop" or "Rest 10–15 seconds — add a mini-set" — not the name of a technique. **Drop sets and myo-reps are the same nesting shape**, differing only in what changes between mini-sets, and are stored under `minis` |
| Workout builder | Name, add exercises, reorder, planned set count, per-exercise notes, edit, delete. Lives inside a system — `#/workout/new/<systemId>` to create |
| Exercise library | **318 exercises** (275 until 2026-08-31), searchable, filterable by muscle group (16 groups incl. Full Body, Cardio and Activity; **13 are real muscles**). ⚠️ **A new row needs three things or it is inert**: the tuple here, a ratio rule in `muscle-evidence.js`, and a movement family in `exercise-families.js`. Tests assert all three |
| Custom exercises | User-created; choose tracked fields and how weight is counted. 🚨 **THEY DO NOT SET A STRENGTH LEVEL since 2026-08-31** — the conversion used to be guessed from the equipment dropdown, and one 60×10 set on a made-up "Dip Machine" rated a beginner's triceps Advanced. They are still logged, charted and counted in weekly volume, the create form says so before you make one, and the muscle panel says so if you go looking. **Tim's plan is to fold the good ones into the library periodically** |
| Session runner | Builds planned sets, pre-fills last time's numbers, ±steppers, next/back, finish → calendar. ⚠️ **RECORDS FOR OTHER PEOPLE since 2026-08-29 in two different ways, and the difference is on screen**: pick a **friend** and their half is offered to **their own account** at Finish (their suggestion read from the training they share with you); pick or type a **saved person** and their sets stay here, under their name, never mixed into your own. ⚠️ **Anybody can be taken back OUT since 2026-08-30** (Tim: *"in case it was just a test, or an accident"*) — a ✕ that exists **only on the person you are already recording for**, so a destructive control is never next to a chip you are aiming at to switch. Quiet with nothing recorded, a confirm naming the count if there is; a friend's confirm says their workout will no longer reach their account; the saved identity is never deleted. ⚠️ **Swap opens on FIVE ALTERNATIVES since 2026-08-30** (`js/exercise-families.js`), with the full 318-exercise picker one tap underneath. ⚠️ **THE SET LIST IS THE SCREEN SINCE 2026-08-29** (Tim's instruction): there is no detached block of steppers any more — **the ± controls sit inside whichever set is open**, exactly one is always open, and tapping another set moves the controls to it. The digits and targets are unchanged (30px, 46×52); what went was the ~200px spent showing a copy of row one. A nudge repaints the row **in place**, because rebuilding the list would now destroy the input under the user's finger. **Add set** is a small pill on the right of the "Sets" heading, not a full-width button under the list — under the list it was as loud as the sets and, once the list outgrew the pane, drawn on top of them. **Records for today by default, and the day is editable in the header** for the workout you forgot to log. Future dates refused. The header says NOT TODAY the whole way through rather than springing it on you at the end |
| Load type | Every weighted exercise labelled **PER SIDE** or **TOTAL** |
| Draft recovery | In-progress workout survives an app switch; expires end of day. Expiry is keyed to `startedOn`, **not** the session's date, so back-dating a workout doesn't discard its own draft |
| Benchmarks | Any date, any exercise → feeds Data + calendar. A **workout can be marked a benchmark**, and then every exercise it records files the best set of that exercise as a benchmark for the day (D17) |
| Calendar | ⚠️ **ITS OWN TAB AGAIN SINCE 2026-08-25**, reversing the 2026-08-22 merge on Tim's instruction — that argument was about what the two screens *are*, his is about how often he opens them. Its header is its own title, not the Data switch. **Month cells are filled by the workout's name** beside the day number, 8px → 12px, wrapping to two lines rather than clipping. ~~Not its own tab since 2026-08-22 — it is the first segment of DATA, and its header IS the four-way Data switch.~~ `#/calendar` has been its route throughout, so a day stays deep-linkable and nothing anybody bookmarked broke in either direction. **Two ways to read it, on a Months / Years switch below that.** **Months** is the original: continuous vertical month scroll, sticky headings, opens on the current month, active days filled and named. Open a day → **Edit** a record to change anything about it: its day, its name, its exercises, every set, and whether it counts as benchmarks. **Years** (2026-08-22, Tim's ask with a reference image) draws **one tiny square per day**, one row per year, newest first, with "141 days trained" beside each — years of training on a single screen, and two years fit in the top half of a 375×667 phone. ⚠️ **It is BINARY** — coloured or not — where Months distinguishes workouts from benchmarks, because those two tokens measure ΔE 6.5 apart under protanopia and a 5.7px square has no room for the label or texture that would make a second colour legal. ⚠️ **Tapping a square SELECTS it and does not navigate**: at 5.7px a tap that navigated would open the wrong day about as often as the right one, so it fills a readout line that holds its row whether or not anything is picked, and the readout is the full-width control that opens the day. WCAG 2.5.8 is met by **equivalence** — every day is reachable at 40px in Months, one tap away. `js/year-grid.js` |
| **Data** (nav) | **FOUR segments — Muscles · Graph · Bars · Research** (Research joined 2026-08-28), and it **opens on Muscles** — Tim's call, and it is also the mode that works with the least history, since one benchmark colours the map where a line chart needs two points. ⚠️ **Calendar left this control** and is its own tab again, which took the switch's one oddity with it: it was the only entry that navigated rather than setting in-page state. All four are now the same kind of thing — in-page state on `#/graphs`. ⚠️ **"Bar Chart" lost a word**: the 2026-08-21 survey measured the three-segment version clipping that exact label to "Bar Char" at 393px, and the fourth segment took another quarter of the row. **Graph** (measured SVG line + hover crosshair), **Bars** (paired bars), **Muscles** (body map), **Research** — which since 2026-08-30 opens on **eleven collapsed topics teaching the basics**, each carrying a confidence label in words and its own stated weak spot, over the age chart that shipped with the tab. `js/research-topics.js` holds the content and the rules it was written under; `docs/research.md` §13 holds the pull. **No chart mode is ever a dead end**: a chart needs the same lift on two different days, so where it cannot draw a line it lists **where every lift stands right now** — best set, estimated max, how long ago — instead of an empty state. No tab is disabled and no mode is force-switched away from. Charts show **one source at a time**, benchmarks by default — an exercise with only workout sets charts those, so graphs already work with no benchmarks at all. What is NOT built is the confidence-weighted estimator and the evidence setting Tim asked for; see `docs/strength-estimate-plan.md` |
| Body weight | Charts through the Graph picker, in a **You** optgroup after the exercises, so it takes no fourth tab and is never the default. Needs two weigh-ins. Direction is **not** judged good or bad |
| Rest timer | Counts **up** from the last set, started by logging a number rather than by a button. Optional target (60/90/120/180s) that only then says the rest is over. Read from a timestamp every tick, never accumulated — a backgrounded tab throttles timers, which is exactly when it matters. Survives an app switch in the draft |
| Units | **lbs or kg**, a display choice only. Everything is STORED in pounds, so switching back and forth is lossless — asserted to the 1e-9 |
| Rep normalisation | Y-axis is always weight; every point converted to equivalent load at one rep count (D11). Target defaults to the most-recorded count, adjustable with arrows. Markers mean measured |
| **Muscles** | **Tim's illustration**, front + back, 18 tappable muscle paths covering 13 groups. **Rated from EVERY exercise that trains the muscle**, not one named lift (2026-08-17) — hammer curls rate biceps, dumbbell rows rate back, seated calf raises rate calves. ⚠️ **Since 2026-08-19 the rating is led by the most CREDIBLE evidence rather than the largest number it produces** — at most three exercises, one seat each, ranked by how much each is worth believing. Before that it picked its top three by converted weight, so a 15-rep face pull outvoted an overhead press benchmark and rated an ordinary lifter Elite; §9 has the write-up and the residuals. Each rating carries a **confidence**, and the muscle's colour is desaturated in proportion: same level, less vivid. The panel says how many sessions AND how many different exercises fed it, because "40 sessions, all of one exercise" is a different claim from "40 sessions across four". See `js/muscle-evidence.js`. Split into a **fill layer** (vector, recolourable, the tap target) and an **ink layer** (greyscale luminance mask carrying every keyline, fibre striation and shadow) — so recolouring a muscle cannot touch its texture. Head, hands, feet and knees have ink but no fill, so they stay unpainted. ⚠️ **Picking a muscle never moves or resizes the body, in either layout** (2026-08-21). On a screen ≥ 860px the detail opens in a **side column beside the figures**; below that it stacks underneath, and the figure holds a fixed 57 % of the pane while the panel takes what is left and scrolls inside itself. Before that fix the phone's figure shrank and rose by however many words the panel happened to have. Each group filled by where it ranks among a comparison group **the user chooses** — "Compared to" in the header opens two presets (**Like me** / **Everyone**) over four axes: population (people who lift / everyone), sex (men / women / both), body weight (mine / any) and age (mine / any). The caption always states the group in words, and says "all adults" rather than "who lift" when the comparison includes people who do not; grey only when that lift has never been recorded. **Ranks from workout sets as well as benchmarks** — source named in the panel — with a hard rep gate: a set above 15 reps is not evidence of a maximum (D5). ⚠️ **Tap → five lines and no more** (2026-08-21, Tim: "we want it to be easy to understand, not a paragraph"): level, estimate + percentile, the bar to the next level, the confidence line, and the set the number came from. The seven-row table of per-level weight targets, the confidence bar and the confidence percentage were cut. **Every caveat survived, one line each** — shortening a caveat is allowed, softening one is not — and a **40-word cap is a test**, because every other assertion on this panel checks something is present and none of them can catch words piling back up. Selection is an accent outline following the muscle's own shape, and the browser's own focus ring is replaced — Chrome draws `outline:auto` around an SVG element's **bounding box**, which put a white rectangle around the selected muscle. |
| **Friends** (was Social) | 🚨 **THREE WAYS IN SINCE 2026-08-29, and one of them reversed a locked decision.** *Add a friend* (`#/find`) offers **search by name**, **your own permanent QR code** (`#/add/<uid>`, scanned by their camera app — nothing to install) and the original **invite link**. Somebody found by search or code gets a **friend request** they accept; ⚠️ **accepting needs no new permission** — it republishes with them in `viewers`, so the asker learns by an existing read succeeding, eventually, and the screen says when it happens. ⚠️ **The name search needs Firestore `list` on a public `directory` collection, which IS enumeration and cannot be narrowed by a rule** — Tim's explicit call at fewer than five users; the handle replacement is Open work 16. **Settings → Findable by name** takes your row out, and is described as a courtesy rather than a protection because the rules cannot enforce it. ⚠️ **No longer its own tab — it is the Friends half of HOME** since 2026-08-22, and since 2026-08-25 the **You** half is a feed of those same friends' workouts rather than a place to start one. reached by a You / Friends switch, and the screen is titled **Friends** rather than Social because that is what a person has. `#/social` is still its route. **Mutual friends, and a list you VISIT — there is no feed**, which is how it delivers "see what my friends are doing" without reopening D7. Connect by **invite link** (no user directory, so nothing can be enumerated); links work once and expire in 7 days, and the sender can cancel one before it is used. **You choose per person what they see** — Everything / My workouts / Just that I trained / Nothing — and the picker names and *explains* each, because "mid visibility" means nothing to somebody who has not read the plan (D8). A friend's page shows **their body map in the app's own art and colour ramp**, their recent workouts as one line each, opening to the real structure with supersets and drop sets intact. **What THEY can see of yours sits at the top of their page**, above anything of theirs — the thing you most want to check is what you are giving away. New connections start at the least visible setting, never the last one used. Requires a real account (D25 proposed): an anonymous uid is a browser profile that will be lost, so a connection to one is a connection to nobody |
| **Goals** (no longer a nav tab) | ⚠️ **Off the bar since 2026-08-25, reached from Settings**; the route and all its deep links still resolve. A goal is **one muscle moving up a strength LEVEL over twelve weeks** — never "+30 lb on your bench", because individual change over 12 weeks runs 0–250 % and no app can promise a number. Pick a muscle, pick a level above it, and the screen states **what it costs** (hard sets a week on that muscle, sessions, minutes, protein, effort, sleep) with a citation on every line, **what your logged sessions are actually delivering** against it, **why progress stalls** — two causes measured, four admitted invisible — and **which programmes fit**, ranked on what they give THAT muscle rather than on their headline rating. ⚠️ **No on-track verdict, and the screen says why**: a day-to-day estimate swings several percent, so a verdict off raw numbers would call a bad Tuesday a failure. The target weight is **frozen** when the goal is set, because the weight behind a level moves with body weight, age and the comparison group. One goal at a time; old ones kept. `js/goals.js`, `docs/goals-plan.md` |
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
| Settings | Dark/light, **Colour** (Gold/Teal/Indigo/Ember since 2026-08-26, all four fully audited 2026-08-27), **lbs/kg**, More details, **Rest timer** (off by default), **Findable by name** (on by default — 2026-08-29, and it is a courtesy rather than a protection: the rules cannot enforce it), Goals link. ⚠️ **Profile, backup/restore and delete-all MOVED to the Account screen 2026-08-26** (Tim's ask); one pointer row remains |
| Account | ⚠️ **The person, since 2026-08-26**: profile photo — ⚠️ **POSITIONED AND RE-EDITABLE since 2026-08-27** (Edit reopens the cropper where it was left, on a 768px source kept for exactly that), a square stage with the circle inscribed in it, drag to move and a slider/pinch/wheel to zoom, and what the circle frames is literally what gets cut (`js/image-crop.js`); client-resized to a 256px JPEG (~4 KB measured), `settings.avatar`, worn by the top-left button, NOT published to friends, profile row, backup/restore + cloud warning, delete-all, sign in/out — in every account state. **Back goes Home**, not Settings |

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
- All **32 JS modules** pass syntax check; the whole import graph resolves under a stub DOM
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

- **⚠️ THE TWO NEWEST FEATURES HAVE NEVER MET REAL DATA, and both are the kind that look fine
  until they do.** **File import** has never parsed an actual export from Strava, MacroFactor,
  Cronometer or Apple Health — every column name in `js/import-file.js` comes from published
  documentation rather than from a file this project has opened. That is exactly why the screen
  detects columns by name, shows a preview and makes the user confirm before writing anything, and
  why the date order, the weight unit and the distance unit are refused rather than guessed. ⚠️
  **One of those three was a real shipped bug caught only by driving it** — distance defaulted to
  miles and Strava exports kilometres — so treat the other guesses in that file as equally
  untested. **The handoff and disconnect paths** are proved against the real rules engine and in
  jsdom; **they have never run between two real accounts.**
- **⚠️ AND THE PROFILE-PHOTO FIX WAS REASONED, NOT OBSERVED** — headless Chrome never reproduced
  the bug Tim reported, so the diagnosis (a cyclic percentage resolved differently by WebKit) is the
  best account of a real symptom rather than something this project measured. ✅ **His phone
  confirms the fix works**, which is not the same as confirming the cause.

- **⚠️ ACCESSIBILITY IS PART-AUDITED as of 2026-08-20, and the part that ran FAILED.** Contrast,
  touch targets, accessible names and horizontal overflow have now been measured in a real browser
  across 44 screen/width/theme combinations — see the section above; `--ink-faint` failed AA
  everywhere it was used and every label in the app named nothing. Both fixed and re-measured.
  ⚠️ **AND THE 44 COMBINATIONS WERE NOT WHAT THEY LOOKED LIKE.** Two of the tool's routes —
  `#/data` and `#/muscles` — **are not routes at all** and silently rendered Home, so until
  2026-08-24 the Data screen and the body map had **never been audited** and Home was measured three
  times. Fixed in the tool, re-run over **52** combinations: **contrast is clean on all sixteen
  newly covered ones**, and the map's own targets were hit-tested for the first time — Traps 42×11
  at 360 px, with no larger equivalent, which is Open work 0i.
  ✅ **Re-run again 2026-08-27 over 60 combinations × all four palettes — 240 in total, 23,496
  text nodes, zero below 4.5:1, zero horizontal overflow.** The activity log joined the route list
  then too; it had shipped unaudited.
  ⚠️ **Three things are still completely unknown: no keyboard path has been walked, no screen reader
  has ever been run against this app, and nothing has been tested at larger text.** **Do not let
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
- **Almost everything about a real device.** ⚠️ **A phone has now opened the app three times and,
  on 2026-08-24, been TRAINED with for a whole session.** What that settled is the keyboard fix,
  Google sign-in in the installed PWA, and — far more valuable — four defects no review had found
  (see the top of this file). **What it did NOT settle is everything on this line:** touch targets,
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
- ~~**⚠️ NO TWO ACCOUNTS HAVE EVER CONNECTED.**~~ ✅ **CLOSED 2026-08-22.** Two throwaway accounts in
  two separate Chrome profiles ran the whole round trip against the live project — invite, claim,
  accept, tier, publish, read, downgrade, disconnect — with enforcement checked **on the wire**
  rather than in the UI, then both accounts and all eleven of their documents deleted. Two defects
  came out of it: expired invites read as open (**fixed**), and disconnect is one-sided while the
  sheet said otherwise (**sheet corrected 2026-08-24; the feature is still one-sided — Open work
  0j**). ⚠️ **The brief claimed the project held zero users. It does not** — it holds Tim's two real
  accounts. Snapshot the baseline before touching it.
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
│   │                           copy erases whatever changed elsewhere.
│   │                           Also HOW FULL THE CLOUD IS — cloudUsage()
│   │                           sizes each collection document by
│   │                           Firestore's published rules (32 bytes a
│   │                           map, 8 a number, NOT JSON length) and
│   │                           returns null on any backend that is not
│   │                           Firestore. Settings warns from 80 %
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
│   ├── qr.js                   A QR CODE, drawn in the app — pure. Byte mode,
│   │                           versions 1-6, all 8 masks SCORED (a hard-coded
│   │                           mask can create a false finder pattern, and the
│   │                           data bits change with every payload). Encodes
│   │                           #/add/<uid>, which is permanent, never a
│   │                           one-time invite link that goes stale in a pocket
│   ├── social.js               VISIBILITY TIERS + the projection builder — pure.
│   │                           🚨 ALSO THE USER DIRECTORY since 2026-08-29, and
│   │                           its header says why that reverses the "nothing
│   │                           can be enumerated" decision rather than narrowing
│   │                           it. Read it before touching search.
│   │                           Wired to views-social.js since 2026-08-18, and
│   │                           ✅ two real accounts ran the whole round trip
│   │                           against the live project on 2026-08-22.
│   │                           ✅ Disconnect is MUTUAL since 2026-08-27 —
│   │                           a tombstone the other client acts on.
│   │                           Sharing publishes a derived copy; it never
│   │                           widens a permission on the private data. Built
│   │                           by whitelist, never by deleting fields,
│   │                           because deletion fails OPEN
│   ├── muscle-evidence.js      WHICH exercises rate WHICH muscle, the ratios
│   │                           between them, and the confidence model — pure maths.
│   │                           ⚠️ Since 2026-08-24 it also discounts a reading for
│   │                           WORK ALREADY DONE ON THAT MUSCLE THAT SESSION
│   │                           (`fatigueFactor`), because a rep count cannot tell a
│   │                           heavy set from a tired one. docs/fatigue-plan.md
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
│   ├── research-data.js        the age-vs-strength chart's data — pure. Harbo
│   │                           2012 Table 5, plus why it is NOT drawn from
│   │                           Strength Level (their by-age tables are one
│   │                           shared model wearing eleven names)
│   ├── exercise-images.js      THE PICTURE MANIFEST — pure, and GENERATED by
│   │                           tools/build-exercise-images.mjs. 🚨 EMPTY: the
│   │                           art Tim wants is a paid stock library and
│   │                           buying it is his call, so the feature ships
│   │                           ahead of it and "no picture" is an ordinary
│   │                           state everywhere downstream. Keyed by exercise
│   │                           ID because two exercises share a NAME
│   ├── exercise-families.js    WHICH EXERCISES CAN STAND IN FOR EACH OTHER
│   │                           — pure. 43 movement PATTERNS (not muscles) over
│   │                           314 of 318 exercises, hand-written because a
│   │                           name-derived version is wrong quietly. ⚠️ Four
│   │                           exercises have NO family on purpose: adduction
│   │                           is the OPPOSITE of abduction on a machine that
│   │                           looks the same. Read the header before adding
│   │                           a member; a test resolves every one
│   ├── research-topics.js      THE BASICS, TAUGHT — pure. Eleven topics, 27
│   │                           sources each defined ONCE, a confidence level
│   │                           per topic and a stated limit on every one.
│   │                           ⚠️ Read the header before adding a claim: this
│   │                           is the one file whose CONTENT is the feature,
│   │                           and its word budgets are asserted in
│   │                           tests/data-layer.test.mjs. docs/research.md §13
│   ├── units.js                lbs/kg — pure maths. EVERYTHING IS STORED IN POUNDS;
│   │                           converts only at the edges, so switching is lossless
│   ├── body-art.js             GENERATED traced muscle paths — do not hand-edit
│   ├── body-map.js             composes the fill paths + the ink masks
│   ├── import-file.js          READING A FILE FROM ANOTHER APP — pure. CSV,
│   │                           column detection, and the three things it
│   │                           REFUSES to guess: the date order, the weight
│   │                           unit and the distance unit. Deterministic ids,
│   │                           so re-importing an overlapping export upserts
│   ├── views-import.js         the import screen (#/import) — read, plan,
│   │                           SAY what will happen, then write
│   ├── image-crop.js           POSITIONING A PHOTO IN A CIRCLE — pure maths, no
│   │                           DOM. The crop is a square in SOURCE pixels, so the
│   │                           result does not depend on the phone it was cropped
│   │                           on. One invariant: the square never leaves the
│   │                           image, or an avatar saves with a blank wedge
│   ├── exercises.js            318-exercise library + load-type rules, and the
│   │                           BODY-WEIGHT FRACTION table. ⚠️ `assist: true` on an
│   │                           entry INVERTS the sign of the logged weight
│   │                           everywhere — Assisted Pull-Up (2026-08-24) plus
│   │                           Assisted Dip and Assisted Chin-Up (2026-08-31).
│   │                           ⚠️ A NEW ROW NEEDS A RATIO in muscle-evidence.js
│   │                           and a FAMILY in exercise-families.js or it is
│   │                           inert; both are asserted
│   ├── ui.js                   el(), icons, sheets, toasts, steppers, screenShell, profileButton
│   ├── views-workouts.js       home, the RECORD tab (StartPickerView — the
│   │                           workout list plus the benchmark action),
│   │                           SYSTEMS list, one system, workout builder,
│   │                           Explore ready-made systems, exercise picker
│   ├── views-session.js        session runner, benchmark form. ⚠️ RECORDS FOR
│   │                           OTHER PEOPLE two ways since 2026-08-29 — a
│   │                           FRIEND (uid, their half OFFERED to their own
│   │                           account at Finish, suggestion read from what
│   │                           they share with you) or a SAVED PERSON (no
│   │                           account, sets kept here). ⚠️ The two histories
│   │                           are NEVER merged: a doubled session is what
│   │                           makes progression propose more weight.
│   │                           ⚠️ THE SET LIST IS THE SCREEN since 2026-08-29
│   │                           — the ± controls
│   │                           sit INSIDE whichever set is open, exactly one
│   │                           always is, and a nudge repaints the row IN PLACE
│   │                           because rebuilding the list would destroy the
│   │                           input being typed into. Swap an exercise
│   │                           mid-workout (splits if sets are logged), remove
│   │                           one for today, fills
│   │                           set 2 from set 1 the first time, and shows what
│   │                           an assist machine really leaves on you
│   ├── views-data.js           calendar (its OWN tab again since 2026-08-25),
│   │                           day detail, Data screen (opens on Muscles),
│   │                           settings incl. the More details toggle
│   ├── views-muscles.js        the Muscles pane
│   ├── views-social.js         the FRIENDS half of Home, a friend's page,
│   │                           accepting an
│   │                           invite. Reads ONLY published copies — it cannot
│   │                           reach anybody's private data even if it tries
│   ├── views-goals.js          Goals — no longer a tab, reached from Settings;
│   │                           the two-step picker, why progress
│   │                           stalls, and programmes that fit the goal
│   ├── views-edit-session.js   editing a workout already recorded (calendar → day → pencil)
│   ├── views-profile.js        gender, birth year, body weight
│   ├── views-account.js        account, sign-in, upgrade-from-anonymous
│   ├── firebase-config.js      REAL KEYS — project fitness-tracker-th, live
│   └── firebase-backend.js     Firestore + auth adapter
├── tests/
│   ├── data-layer.test.mjs     1763 assertions, no dependencies. Also holds the
│   │                           CROP maths, the FILE IMPORT parser and THE
│   │                           RESEARCH TAB'S CONTENT — every claim cites a
│   │                           defined source, every topic states its limit,
│   │                           and the word budgets (45 an answer, 260 a topic)
│   ├── bodyweight.test.mjs     170 assertions, no dependencies — the fractions,
│   │                           their sources, and what stays REFUSED
│   ├── strength-estimate.test.mjs  72 assertions — measured simulator outcomes
│   ├── social.test.mjs         162 assertions, no dependencies — what is SHARED,
│   │                           plus the NAME MATCHING and the graph's `pending`
│   ├── goals.test.mjs          232 assertions, no dependencies — the requirements
│   │                           model, and the two REFUSALS
│   ├── demo.test.mjs           58 assertions, no dependencies — the demo year is
│   │                           deterministic, and plausible enough that the
│   │                           app's own analysis of it is not nonsense
│   ├── optimal.test.mjs        76 assertions, no dependencies — the curves
│   │                           reproduce the PUBLISHED figures, plus 3 refusals
│   ├── year-grid.test.mjs      45 assertions, no dependencies — every day of
│   │                           the year drawn exactly once (leap years, a
│   │                           Sunday opening), every square in the row its
│   │                           weekday really falls on, every month label on
│   │                           its own month
│   ├── volume-map.test.mjs     64 assertions, no dependencies — direct/indirect
│   ├── a11y.test.mjs           85 assertions, no dependencies — the PALETTE, all
│   │                           four of them, in both themes
│   ├── qr.test.mjs             33 assertions — needs `npm i --no-save jsqr`.
│   │                           ZXing's published Reed-Solomon vectors, plus a
│   │                           ROUND-TRIP DECODE by an independent decoder.
│   │                           Deliberately does NOT assert which mask a
│   │                           payload gets: implementations legitimately
│   │                           disagree on penalty rule 3
│   ├── rules.test.mjs          147 assertions — who may READ it, who may OFFER
│   │                           you a workout, who may announce a disconnect,
│   │                           who may ASK to connect. 🚨 One is an `allow`
│   │                           recording a COST (the directory is enumerable)
│   │                           rather than a guarantee. Needs the
│   │                           Firestore emulator and Temurin 21 (§0.9)
│   ├── sw-update.test.mjs      12 assertions — needs Chrome. Edits a file and
│   │                           asserts the page offers a refresh
│   └── render.test.mjs         705 jsdom assertions — mounts every screen
└── docs/  spec.md · research.md · vision.md · strength-map-plan.md · goals-plan.md
         activities-plan.md · airpods-plan.md · integrations-plan.md · fatigue-plan.md
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
GuestSession  session-shaped, plus guestName, and since 2026-08-29
            personId?   ← a saved identity (no account)
            forUid?     ← a FRIEND's account. Their half is OFFERED to them at
                          Finish and is theirs only once they accept it.
            ── Read by id where there is one and by NAME only as a fallback,
               for rows written before those fields existed.

Session     id, workoutId, workoutName, date, startedAt, finishedAt, isBenchmark,
            location?,        ← typed label (0m), absent when none; never GPS
            ── an ACTIVITY session (2026-08-26) is this same shape with NO
               workoutId: one entry, one set of time/distance. That absence is
               what keeps it out of the rotation suggestion and progression.
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
⚠️ Adding a TOP-LEVEL collection (`directory`) also needs its own `match` block inside
`match /databases/{database}/documents` — a block written outside it compiles fine and matches
nothing, which presents as every read and write being refused. Cost twenty minutes on 2026-08-29.

Person      id, name, createdAt, lastUsedAt
            ── the roster you RECORD FOR (2026-08-29). ⚠️ INVENTED PEOPLE ONLY:
               a friend is never copied in here, because a saved copy of
               somebody's name goes stale the day they rename themselves and
               their uid identifies them better than any label. Friends come
               live off the friends list every time.
            ── ⚠️ Deleting one deletes the NAME and nothing else. Every session
               recorded for them stays — same argument D22 makes about systems.
            ── savePerson() is IDEMPOTENT BY NAME when given no id, so "Alex"
               twice is one identity. The dedupe is in the store rather than at
               the call site: two "Alex" rows each holding half his training is
               a quiet failure, and the next caller would not think to guard it.

Settings    id, units, theme, gender, birthYear,  ← birth year, NEVER age
            avatar, avatarSource, avatarCrop{zoom,cx,cy}
            ── the FACE everything paints (256px), the re-editable SOURCE it
               was cut from (768px), and where the circle was. Written together
               so a crop can never point at a different photo than its source.
               All three cleared by Remove.
```

`normalizeWorkout()` in `store.js` migrates the old `exerciseIds[]` shape on read — keep it.
`store.ensureSystems()` does the same job for workouts saved before systems existed, and is
**single-flight on purpose** — see the key patterns below.

⚠️ **Adding a collection to `COLLECTIONS` also requires adding it to `knownCollection()` in
`firestore.rules` and redeploying**, or every cloud write to it is denied while localStorage keeps
working — invisible until someone signs in. **Since 2026-08-19 a test compares the two lists** and
fails if they disagree, so only the *redeploy* is still on you. `goals` and `guestSessions` are in
both and are deployed.

⚠️ **Adding a `js/` module also requires adding it to the precache list in `sw.js`.** There is a test
that fails if you don't (`sw.js precache is missing: …`), which is how `js/social.js` was caught the
minute it was created — a module missing from the precache is a module the app cannot load offline,
and D6 says offline is non-negotiable.

**Social paths** — `users/{uid}/shared/{tier}` (the published copy, carrying its own `viewers` list
so the rule needs no second read), `users/{uid}/social/graph` (owner-only: `connections`, and since
2026-08-29 `pending` — who I have ASKED, which is what makes the accept probe safe because only
people I asked are ever probed), `users/{uid}/invites/{token}` (`get` yes, `list` no),
`users/{uid}/handoffs/{id}`, `users/{uid}/disconnects/{leaverUid}`, and — added 2026-08-29 —
`users/{uid}/requests/{fromUid}` (**owner-only read**, unlike invites: an invite is a capability I
issued, a request is something asked OF me, and two meanings in one collection is how a read rule
ends up wrong).

🚨 **AND ONE TOP-LEVEL COLLECTION OUTSIDE `users/` — `directory/{uid}`, added 2026-08-29.** It is the
**only** place in this app that grants `list`, it holds a uid and a chosen display name and nothing
else, and it is shape-checked so it can never grow an email field. **Read the block above it in
`firestore.rules` before touching it.** It is also the one piece of an account that lives outside
`users/{uid}`, so **deleting an account deletes this row first** — otherwise the name and uid of
somebody who no longer exists stay in a collection the whole signed-in world can list.

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

**D27 is LOCKED as of 2026-08-26**, by Tim's instruction to make the site fit running, climbing
and swimming: *activities are RECORDED first-class — calendar, feed, backups, cloud ceiling —
and MODELLED not at all: never the muscle map, the ratings, volume or progression.* It narrows
**D2** the way D21 narrowed D15: D2's real content was that the analysis is lifting-evidence-
based, and that stays fully true. `docs/activities-plan.md` §1.

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
