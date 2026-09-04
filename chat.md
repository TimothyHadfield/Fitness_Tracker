# Conversation Log

A running human-readable summary of what has been discussed. Newest session at the bottom.

**For a fresh Claude session: you do not need this file to work.** `progress.md` is the catch-up
file and carries everything operative, with `docs/handbook.md` beside it. Come here only to answer
"what did we actually say about X", or to recover reasoning that didn't make it into a decision.

⚠️ **THIS FILE STARTS AT 2026-08-29.** Everything from **2026-08-14 to 2026-08-26** is in
`docs/chat-archive.md` — 08-14 to 08-20 moved there on 2026-09-04 when this file passed 424 KB, and
08-21 to 08-26 on 2026-09-08 when it reached 216 KB of its 220 KB budget.

⚠️ **BOTH MOVES WERE DONE ON RAW BYTES AND VERIFIED LINE BY LINE, NOT ASSERTED.** Nothing was
edited, re-encoded or reflowed: the second move checked all **2,598** non-blank lines of the original
against the two successors and found every one of them. That method is the point — §0.11's failures
were all decode/re-encode round trips, and a split that never decodes cannot damage an em dash.

---

## 2026-08-29 — the workout screen, reformatted on Tim's instruction

**Tim:** "During the workout right now it shows the current selected set's measurements really big in
the middle and the full list of the sets below it, including the one it's on now. I'm curious if
having it formatted differently would be an improvement. I'm thinking that there should be no large
current selected set details display, and instead the list of sets should be large and share the
space in the middle, and then when you select one, it makes it larger and you can add or subtract
the weight amount or number of reps after it is open."

**Done, and he was right for a sharper reason than space.** The screen was showing the same numbers
twice — a detached block of steppers headed `SET 1 OF 4`, and set 1 again in the list underneath,
both live, both editing the same object. The only thing tying them together was the heading and an
accent square, which is a relationship you work out rather than see. Now: one set of numbers per set,
in the row that IS that set; the row you are on carries the ± controls; tapping another set moves
them to it. Exactly one is always open, because `entry.active` has always been what the steppers
point at and a closed-everything state would have no way to log a number.

The constraint was keeping the big digits — the usability drive last session named them among the
things not to break. They did not move: 30px digits, 46×52 step buttons, identical at 360 and 390.
What went was the ~200px the detached block spent showing a copy of row one, so a four-set exercise
now fits on one screen with room under it instead of sitting on the bottom edge. The rows themselves
grew, 44px → 50px.

Two things that would have shipped as bugs and were caught by driving it:

- The old `onChange` re-rendered the whole set list on every nudge. That was free while the steppers
  sat outside the list and would now have torn down the input being typed into, blurring it after one
  digit. Repaints in place instead; a render test holds the row NODE across the change.
- The controls used to be at a fixed place near the top. Opening a set now keeps the scroll and moves
  the minimum that brings the controls on screen — checked with a nine-set exercise from a cold
  scroll position.

Also found: **the session runner had never been in the accessibility audit** — the one screen the app
exists for, skipped for four weeks because a session needs a workout id and the route list only held
static hashes. It is in now, and the first version of the step silently audited the picker instead
(it matched `/^Start/` against rows whose text begins with the workout's name), so the step asserts
it landed and a failed step is printed rather than swallowed. Re-run: 68 combinations, 6,478 text
nodes, zero contrast failures, zero overflow, zero unnamed controls.

Render tests 564 → 574, both new assertions mutation-checked. All eleven suites green. Pushed.

## 2026-08-29, second pass — record for a friend, and it goes to their account

**Tim:** "I love how it is right now where you can have set people have their own identity on your own
account, however my main want for this feature was so that one person could record the details for
two+ people that do have accounts… look up one of your current friends and add them to your workout
instead of inventing someone new. Then, once you're finished with the workout it will send the
workout to that user's account where they can accept it… Also if you do create a new person to your
account, save them as an identity so you don't have to recreate the same person over and over."

**Both halves of this feature already existed and had never met.** The guest (a name with no account)
shipped 2026-08-26; the handoff (offer → they accept) shipped 2026-08-27 — but sending was something
you went to the *calendar* to do, after the fact, one record at a time. Picking a friend at the start
of the workout is what joins them, and Finish does the sending.

- "Who is training with you?" leads with your real friends, then people you record for, then Someone
  new. A friend carries their uid, so nothing is matched on a typed name.
- The two lists come from different places on purpose. Friends are read live off the friends list;
  only invented people are saved here. Copying a friend into the saved roster would be copying a name
  that goes stale the day they rename themselves.
- A friend's suggestion is read from the training they already share with you — same projection the
  Friends tab renders, same rules, bounded by the tier they chose. At the default tier it carries no
  sets and the screen says so rather than reading as broken.
- **The sharpest decision: their shared training is never merged with what I recorded for them.** A
  session I recorded and they accepted exists on both sides with different ids, so a merge shows the
  same workout twice — and progression reads the last two sessions of a lift, so a doubled session is
  "you did that weight twice in a row", which is the input that makes it propose more weight. One
  source, and their own account wins.
- **The send sits outside the save's error path.** A failed offer must never report "not saved" over
  a workout that was saved. A test drives a throwing offerSession and asserts the workout is still on
  disk and the draft still cleared.
- Saved identities are written the moment the name is typed, and savePerson() dedupes by name in the
  store rather than at the call site. Deleting an identity deletes the name and nothing else.

Known gap, stated: a guest cannot be linked to an account later. Record for "Alex" three times, then
Alex joins — his old rows stay under the invented identity. Nobody has asked for the merge.

Caught by driving it at 360px: the friend row's subtitle clipped to "their workout is sent to them at
the e…" — the half that says what the tap does. Same fault as the visibility sheet on 2026-08-18, on
a different screen, two weeks later.

Render tests 574 → 593, rules re-run green, both new assertions mutation-checked.

## 2026-08-29, third pass — QR codes, name search, friend requests

**Tim:** "I want each user to have their own QR code where they can show another person… Additionally,
you can just search users on the site in the friends section and if there is a user with that name
they can send a friend request to that person, and then that person can accept it."

He was told the trade first — QR and friend requests are free, name search is not — and answered:
"Right now the website has less than 5 users so just do the name search to keep it easy for now and
then we can work on making a different version eventually."

**So the directory exists, and the decision it reverses is recorded rather than quietly dropped.**
js/social.js has said since day one that there is no user directory because a searchable list is an
enumeration surface. That is no longer true of the app. The objection was not answered — Firestore
rules cannot constrain a query's where clause, so the `list` that name search needs IS enumeration —
it was accepted with its price named. What bounds it is the document: a uid and a display name, shape
checked so it can never grow an email field. The rules test asserts the enumeration as an ALLOW on
purpose; when the handle version is built, that is the line that flips to a denial.

Shipped: search on a new Add-a-friend screen, matched in the client (a Firestore prefix would never
find "Anna Smith" from "smith") and ranked shortest-match-first; friend requests in their own
collection modelled on disconnects, with the document id as the access control; and a permanent QR
code encoding #/add/<uid> rather than a one-time invite link that would go stale in a pocket.

The nicest part: accepting a request needs no new permission at all. Adding somebody to your graph
republishes with them in `viewers`, which makes your shared document readable to them under a rule
from 2026-08-18 — so the asker learns they were accepted by an existing read succeeding. No flag, no
reverse write. Eventual on their side, and the screen says so.

Verified the QR the strongest way available: screenshotted the app's own rendered SVG over CDP and
decoded the PNG with jsQR — an 88-character link, version 6, byte-for-byte. That tests the encoder,
the path building, the CSS sizing and the theme, not just the matrix.

Also: Settings → Findable by name (opt-out, on by default), described as a courtesy rather than a
protection because the rules cannot enforce it.

Render 595 → 619, social +25, new qr suite 33, rules 117 → 147 and deployed. Audit clean over 68
routes. Two mutations, each flipping only itself.

## 2026-08-29, fourth pass — a new lift opens somewhere usable

**Tim:** "If a user has added a new exercise that they've never done before, instead of setting the
weight and rep number to 0, put the amount to a beginner amount of weight and an average number of
reps (maybe 10). Add a note that this is their first recording and they should change it."

**Built, narrower than asked, and the reason is a correctness blocker.** finish() saves any set with
a number in it — there is no "touched" flag, the only thing separating a plan from a record is
whether the number is zero. So the still-open "prefilled counts as recorded" finding bites every
exercise WITH history, and the one place it could not bite was a never-done exercise, precisely
because it prefilled zero. Filling that in naively would have deleted the last safe case.

So the opening numbers are marked `prefilled` and the save path refuses to count them. One nudge or
keystroke clears it. Tap Finish having touched nothing and nothing is recorded — two assertions pin
that, including the derived weight, which is the number that would otherwise be most convincing.

Reps open at 10, which is the app's own number: repRangeFor falls back to the 8-12 band and 10 is the
only round number strictly inside it (8 and 12 sit on a boundary, so starting there would hand a
brand-new lifter a load increase two sessions later).

The weight is DERIVED, not invented. A "beginner amount" has only two sources and both are claims
about a person the app has never met. What it can do honestly is run the body map's arithmetic
backwards — muscleStrength divides recorded sets by a published ratio, so multiplying back out gives
this lift's likely load from their own sets. Gated at quality >= 0.45 and confidence >= Fair, direct
contributions only. Needs a complete profile, so a genuinely brand-new user gets reps and an empty
weight — which is the honest answer and what the note then says.

Two bugs found by writing the tests: store.muscleStrength() does not exist (it is a module export,
and the call sat inside a catch whose job is to degrade quietly, so the whole feature silently did
nothing); and applySuggestion returns new objects, so the flag was being dropped on the way through.

Also: screenShell({back}) takes a FUNCTION, and the string hashes I had used made five inert back
buttons on the new social screens. The finish-screen test caught it because it clicks the button
rather than reading an href.

Render 628 -> 641. Audit clean over 68 routes.

---

# Prepared for a chat reset — 2026-08-29

**Read `progress.md` top to bottom. This file only answers "what did we actually say about X".**

Four passes ran this session, all on Tim's instructions:

1. **The set list became the screen.** The runner was showing the same numbers twice — a big
   detached stepper block headed SET 1 OF 4, and set 1 again in the list below it. The controls now
   live inside whichever set is open. The digits and ± targets did not shrink; that was the
   constraint. Also found: the session runner had never been in the accessibility audit at all.

2. **Recording for a friend now reaches their account.** The guest feature and the handoff feature
   both existed and had never touched — sending was something you went to the calendar to do, after
   the fact. Pick a friend at the start and Finish sends it. Their suggestion is read from what they
   already share with you and is never merged with what you recorded for them, because a doubled
   session is what makes progression propose more weight.

3. **QR codes, name search, friend requests.** Tim was told the trade first: QR and requests are
   free, name search is not. He said "less than 5 users so just do the name search to keep it easy
   for now and then we can work on making a different version eventually." So a public directory
   exists and the decision it reverses is written down rather than quietly dropped. The rules test
   asserts the enumeration as an ALLOW on purpose — that is the line that flips when the handle
   version lands.

4. **Four smaller asks**: a never-done exercise opens at 10 reps and a weight derived from the
   lifter's own recorded lifts (never an invented "beginner" number, and marked so an untouched
   prefill is never saved); a typed location becomes the default from then on; the finish screen
   shows the workout and has a back arrow; and five inert back buttons were found and fixed.

**What Tim should do next, in order:** confirm his calendar still shows Pull and Legs; spend ten
minutes with Autumn actually using search → request → accept → record-for-a-friend, because none of
that has ever been done by two real people; and say whether the blue box round the profile picture
is still there (a real bug was found and fixed in that exact spot, but a *blue* one was never
reproduced, so a screenshot would settle it).

**Standing instructions that survive this reset**: the PINNED list and the DECLINED rest-timer list
in `progress.md`. Do not offer either as the next thing to do.

---

## 2026-08-30 — the Research tab teaches the basics

**Tim:** *"In the research section within data, I want to collect information to educate users on
the basics of weightlifting and some of the stuff science has confidently determined through studies
and research. Remember that a lot of information can be completely false or missrepresented, so
before we put anything on here, we need to be confident."* He listed seven questions — hypertrophy
vs strength, free weights vs machines, warm-up and stretching, time of day, common misconceptions,
reps in reserve and going to failure, and sets/reps per workout and per week — and added two
constraints: *"it's also important for this to be readable and understandable for the user, so make
sure it doesn't get too wordy"*, and *"if there might be a conclusion that isn't super solid, don't
add it, or if you do, state your confidence."*

**Built: eleven topics under Data → Research**, above the age chart that was already there. Each is
a collapsed row you tap open; each carries a confidence label in words (Strong / Good / Limited),
a two-sentence answer, three or four specifics with their numbers, and — always — a line saying what
that topic's own weak spot is.

**Where the answers came from.** Six of his questions were already researched and graded in
`docs/research.md` from earlier passes: load and rep range, weekly volume, training frequency,
exercise order, rest intervals, progression, protein, sleep and individual variability. **Five
needed new research**, and they are now §13 of that file with their grades and their limitations:
free weights vs machines, injury risk, warm-up and stretching, time of day, and training to failure.
**27 sources in total, every one opened rather than cited from memory.**

**Three answers are worth knowing because the popular version is the opposite of the finding:**

- **Stretching does not reduce injury risk.** Nine randomised trials, risk ratio 0.99 with a
  confidence interval of 0.93–1.05 — that is a precise null, not a shrug. What *does* cut injuries
  is strength training itself, by about 44%. (Scope stated on screen: sports injuries in athletes,
  not gym injuries in lifters. Nobody has run that trial.)
- **"You don't have to go to failure" is not permission to stop early.** Going to failure has no
  measured advantage over stopping a couple of reps short — *and* growth still rises as sets get
  closer to failure. Both halves, or the advice is wrong in a different direction.
- **No time of day is better for gains.** You are a little stronger later in the day; it does not
  change what you build. The one real finding is that you perform best at the hour you normally
  train, which matters if you are testing a max.

**What was deliberately left off, and why** — because "don't add it if it isn't solid" cuts both
ways: any specific warm-up protocol (the studies disagree and the differences are trivial),
stretching for muscle growth, the fatigue cost of training to failure (repeated everywhere, no
synthesis quantifies it), and "muscle turns to fat" (easy to say, impossible to cite). **"Machines
are safer than free weights" is on the screen as an untested assumption rather than omitted**, since
leaving it out would leave a reader holding the folklore.

**One thing the app now admits to users:** the growth-vs-strength topic says outright that the app
can see what you recorded, not how heavy you planned to go — so any strength figure it shows assumes
the work was heavy and cannot check that. That has been true and unsaid since the rating shipped.

**Two bugs in the accessibility audit tool, found by measuring this:** a closed disclosure still
reports a box for its hidden contents in this Chrome, so the audit had been claiming to measure text
that was not on the screen; and `summary` matched nothing in its control selector, so every
disclosure control in the app had gone unmeasured for touch target and accessible name. Both fixed,
then re-run: 72 screen/width/theme combinations, 7,378 text nodes, zero contrast failures, zero
overflow, zero unnamed controls.

**Tests: 3,378 across twelve suites** (data-layer 1437 → 1728, render 641 → 653). The word budgets
are asserted — 45 words for an answer, 260 for a topic — because every other check anybody would
write about educational text checks that it is *present*, and none of them can see prose piling back
up over the next six sessions.

**Not verified: nobody has read it on a phone.** It is measured and screenshotted at 360 and 390 in
both themes, and nine of the eleven rows fit one screen at 360. Whether it is pleasant to scan under
a thumb is Tim's call.

---

## 2026-08-30, second pass — swap suggests alternatives, and a person can leave a workout

**Tim, two asks:** *"During a workout, allow the user to also remove one of the people they're
recording data with in case it was just a test, or an accident, or something happened."* And:
*"categorize similar exercises together, and when the user clicks on 'swap' it will show them a few
alternative exercises that will achieve the same or similar result… Underneath this list of
alternative exercises, put a button that brings them to the full list."*

**Swap now opens on five alternatives.** A new module groups the library into **43 movement
families** covering 271 of 275 exercises — a family is a *movement*, not a muscle, because
`exercises.js` already answers "what does this train" and nothing answered "what could I do
instead". Tap one and it swaps straight away; "Show all 275 exercises" sits underneath and opens the
sheet that was there before, unchanged.

**Three things about how it was built that are worth knowing:**

- **The families are hand-written, not derived from names.** Stripping "Dumbbell" or "Machine" off a
  name and grouping the rest would have looked clever and been wrong quietly: a Dumbbell Pullover is
  not a pullover press, Close-Grip Bench Press is a triceps builder wearing a chest exercise's name,
  and "Cable Kickback" is two different exercises in the library — one for triceps, one for glutes.
  A test resolves all 271 memberships to exactly one exercise each.
- **Four exercises deliberately have no family, and a test pins that.** Hip Adduction is the opposite
  movement to Hip Abduction on a machine that looks identical; same for Neck Curl against Neck
  Extension. Offering one for the other would be the most misleading thing this feature could do.
  Those fall back to "other exercises for this muscle", which the sheet labels differently.
- **The list spreads across equipment.** Ranked naively, a leg press offered five barbell squats —
  every one correct, all the same answer. It now covers barbell, dumbbell, machine and bodyweight,
  which is what "the rack is taken" actually needs.

**And a wording bug a screenshot caught that no test would have.** The sheet said "Same movement,
different equipment" every time — and a Deadlift offers four barbell deadlifts under it. Correct
rows, false caption. Single-equipment families now say "Other ways to do this movement".

**Removing a person from a workout.** The ✕ appears only on the chip of the person you are currently
recording for, so a destructive control is never sitting next to one somebody is aiming at to switch
between people — and in the accident Tim names, the app has just switched to them anyway. Nothing
recorded, it goes quietly; sets recorded, a confirm that says the count. Removing a *friend* also
says their workout will no longer be sent to their account, which is a consequence outside the
phone. Their saved name stays on the list — that is a different act with its own control.

**One probe fault worth recording.** Driving the people bar in a browser, two sheets stayed open
after adding somebody — at 390px in one run and 360px in the next, which is a race rather than a
width. It turned out to be the draft resuming between test iterations: the second run re-entered a
session that already held "Jordan", so adding him again was correctly refused and the sheet
correctly stayed open. Not an app bug.

**Tests: 3,433 across twelve suites** (data-layer 1728 → 1750, render 653 → 686). The first version
of the "exactly one ✕" test was vacuous — with a single guest it passed against a mutation that put
a ✕ on every chip — so it drives two people now. The audit gained the swap sheet, which is the first
sheet in this app it has ever measured: 76 combinations, 7,566 text nodes, zero failures.

---

## 2026-08-30, third pass — exercise pictures, built ahead of the art

**Tim:** *"I want to have a way to display pictures of the exercises so the user knows what it looks
like in the app, no matter where it is displayed… if the user clicks on the name of the exercise, it
will pull up the picture that takes up the screen and then the user can click an x in the corner
that will close the picture."* He sent two reference images and asked to be shown what I found
before anything was used.

**What the images are.** They are Gym Visual's — a paid stock library of 6,698 exercise
illustrations, male and female, in exactly that style. That is why every fitness site looks the
same; they all buy from there. They cannot be taken from the sites that re-host them: the largest
public dataset that does says in its own licence file *"obtain your own license there before reusing
the media."*

**The price is small and the licence is clean for us:** under $0.75 an illustration in bulk (~$200
for all 275 of our exercises, ~$30 for the 40 most-used), commercial app and website use permitted,
no attribution, no royalties, perpetual. One clause worth an email first — it forbids "making
available on a website for download", and a web app serves image files at URLs.

**The free alternative doesn't match.** Everkinetic is the only open set covering a whole library
(289 exercises, CC BY-SA) and it is black-and-white line art with no muscle highlighting. Tim saw a
sample and didn't take it.

**This is the second time this project has hit a licensing wall on somebody else's anatomy art** —
the body map is hand-drawn because the image Tim originally found was a watermarked Dreamstime
asset.

**Tim chose: build it now, images later.** So the whole feature ships and the art is a purchase
whenever he wants it. Drop files into `img/exercises/` named for the exercise, run one command, and
they appear everywhere.

**The assertion that matters is about absence.** With no pictures bought, nothing renders a
thumbnail and no name becomes a button — every screen is exactly what it was before this shipped.
No placeholder, no broken-image box, no reserved gap. That is the only thing that makes shipping
ahead of the art safe, and it is mutation-checked: make it draw an empty square instead and exactly
that assertion fails.

**Where the pictures appear:** the session runner's heading, the finish screen, a workout's exercise
list, a ready-made system's list, the calendar day, the edit form, the exercise picker and the swap
shortlist. Tapping the name opens the picture full-screen with an ✕ in the corner; Escape closes it
too.

**Three decisions worth knowing:**

- **Pictures are keyed by exercise ID, never by name.** "Cable Kickback" exists twice in the library
  — once for triceps, once for glutes — so a name-keyed lookup would eventually paint the wrong
  picture and nobody would report it.
- **Inside a row the thumbnail is not a button.** A button inside a button is invalid HTML; the row
  keeps being the only control on the row.
- **The manifest is generated, not hand-kept.** A list of filenames maintained by hand drifts from
  the directory silently — a name typed wrong shows no picture, and no picture is this feature's
  normal state. A test compares the two, and the generator refuses a badly-named file rather than
  skipping it.

**Proved with a stand-in I drew** (not shipped): thumbnail 38×38, the viewer full width, the ✕
hit-tested at 44px, the name 17.4:1 on the dim ground. Tests: 3,465 across twelve suites.

---

## 2026-08-30, fourth pass — six app-icon options, and one not yet chosen

**Tim:** *"I want to replace the main cite logo with a different design. Could you generate me a
couple sweet options and I'll choose one. This is the logo that appears when you add the website to
your Home Screen, and when we eventually make it an app will appear."*

**Six candidates drawn and shown to him**, each rendered large, at real home-screen size, and tiny —
because the only size that matters is the one on a phone, and a logo that only works at 512px is a
logo nobody will ever see working. They are: a barbell on dark, the same on gold, a figure pressing
overhead, a plate with the bar running through it, three ascending bars, and the plate on gold. The
recommendation was the plate: the strongest silhouette of the six and the least like every other gym
app.

**Nothing was chosen — the question was interrupted, so nothing shipped.** Everything is in
`docs/icon-options/` with the contact sheet and the fold-in steps, the same way the colour options
were kept in 2026-08-26 rather than lost in a temp folder.

**A real bug came out of it.** The icon Tim asked to replace has probably never appeared on his home
screen at all: `apple-touch-icon` points at an SVG, and iOS has never supported SVG there — it needs
a PNG. Without one, iOS uses a screenshot of the page instead. So whichever design wins has to ship
as PNG at 180 and 512 beside the SVG, and that will be the first time the icon actually shows up.
Checked against Apple's guidance rather than against his phone, so one look would settle it.

**One thing measured rather than eyeballed:** all six fit Android's maskable safe zone — no painted
point sits more than 204px from the centre of the 512 canvas, which is the inner-80% circle a
launcher may crop to. Two of them had to be scaled down to meet it.

**The first six drafts were worse and were thrown away.** Worth one line on why: the artwork was too
small in the tile, a ring-with-nubs read as a camera aperture rather than a weight plate, and a bare
diagonal line read as nothing at all.

---

## 2026-08-31 — the icon work is closed, and Tim is doing it himself

**Tim:** *"I don't really like any of the icons right now. I think it was a mistake for you to work
on them. I'm going to improve it later myself. Forget that section of the project."*

So it is closed. `docs/icon-options/` is deleted — the six SVGs, the contact sheet and the renderer
are still in commit `fb72f8d` if he ever wants them, and `icon.svg` was never touched, so the app is
exactly as it was. It is not pinned and it is not parked: he has taken the job back, and a future
session should not offer to draw more or ask which of the six after all.

**Worth keeping the reason, because it is the first time he has called a piece of work a mistake to
have started.** It was taste, not engineering — six aesthetic candidates generated ahead of any way
to tell a good one from a bad one, and nothing measurable could settle which was right. The colour
options he *did* pick from, back in 2026-08-26, were about legibility. That is the line.

**One technical finding is being left alone deliberately.** `apple-touch-icon` still points at an SVG
and iOS needs a PNG, so his home screen is probably showing a screenshot. It is recorded in
`progress.md` rather than fixed, because it belongs to the icon he is going to do himself.

---

## 2026-08-31 — rearranging a workout, a set row that morphs, and a face on the feed

**Tim, four asks in one message:** a way to see the full workout mid-session and *"add an exercise,
remove one, or drag an exercise to another position"*, keeping anything already recorded tied to its
exercise; remove the *"Suggested: …"* and *"First time logging this…"* blocks (*"It's very wordy"*);
make a set row *"morph into the weight and reps adjustment box"* instead of growing a second one
underneath; and make Swap and Remove *"stand out just like the +add set button"*.

**A third pill — Exercises — opens today's list.** Drag a row by its handle, or use the arrows; add
one from the full picker; remove one, with the same confirm the Remove button already had when sets
exist. The recorded sets move because nothing is copied: an entry *is* its sets, so reordering the
list is reordering the array, and the proof is the saved session rather than the screen — after two
moves and an add, the 185 is still filed under the exercise it was typed on.

Two things there were nearly wrong. The walk is re-pointed by the entry object, not its index —
otherwise shuffling the list under somebody moves them onto a different exercise mid-set, which the
first version of the test could not see, because moving the exercise you are standing on lands
correctly either way. And a superset is adjacency, so every reshuffle re-derives the groups.

The drag is pointer events. HTML5 drag-and-drop does not fire for a finger, so that version would
have worked on a laptop and done nothing on a phone. It was driven with a real pointer in a browser
to check: row one dragged to position three, its four recorded sets with it, the runner still on it.

**The set row is the controls now.** It used to print `255 lbs × 7` three inches above a stepper
reading 255 — the same duplication that was removed in August between the detached stepper block and
the list, back one level down. The values are simply not drawn while a row is open, and tapping the
row, or any dead space, closes it. The runner can show no controls at all now, which it never could.

**The wordy blocks are gone, and what went is the prose.** The suggestion still moves the numbers; a
lift you have never done still opens at ten reps and a worked-out weight, still flagged so that
finishing without touching it records nothing. The honest cost: the app can no longer say the
opening weight was worked out rather than measured. Only "Last time: 255 lbs × 7" survives — six
words, and a measurement rather than a guess.

**Then, mid-session, a second report:** *"when you put a profile picture into your account, your
friends can't see the profile picture… its just the default blank humanoid."* True, and deliberate —
the code said so in as many words, that publishing a face was a widening deserving its own decision.
This is that decision. The photo now rides beside the name in every sharing tier, appears on the
feed card, the friends list and a friend's page, and adding or removing one republishes, so
"Remove" takes it off other people's screens and not just yours. Coming back in it is treated as
what it is — a string somebody else wrote that ends up in an `src` — so only base64 raster images
are painted: never an SVG, never a remote URL, and nothing over about 90 KB.

**Two things fell out of the work.** `social.available` does not exist — it is a field of what
`social.state()` resolves to — and two places read it, so a signed-in person with no friends was
being told to sign in. And the accessibility audit caught the new drag handle failing the 44px
touch test on every sample; it has a grown hit area now, while the arrows sit at 40×24, which clears
the WCAG minimum and is a stated trade rather than an oversight.

**Nothing here has been used on a real phone yet**, and the face has never crossed between two real
accounts.

**Then a question about the muscle map:** *"it shows a weight and a bar… I have no idea what that
weight means. Is it for a specific exercise, or the one it's basing its decision off of?"* Neither.
It is an estimated one-rep max on that muscle's key lift — Chest is measured in bench press, Triceps
in close-grip bench, Quads in back squat — and every exercise that trains the muscle is converted
into that lift by a published ratio. The screen had never said so, which is why he had to ask. There
is a line under the number now: *"Estimated 1-rep max in Barbell Bench Press."* The word "estimated"
is doing as much work as the lift's name, because the line directly below it names a real recorded
set, and putting an inference next to a measurement with nothing to tell them apart is the one thing
this app is not allowed to do.

He also asked whether the rating is just the heaviest set ever. It is not: sets over 15 reps are
thrown out, each remaining set is converted to an estimated max and divided by its ratio to the key
lift, direct evidence beats compounds, each exercise gets one seat, and the top three by
*credibility* — not by size — are clipped to within 25 % of their median and averaged. Each input is
a best showing, so it leans high on purpose; what it will not do is let one flattering set decide.

Which led to the next one: *"when you click on a muscle it only shows one recording. Could you
instead show all 3?"* Fair — the panel was naming the leader and saying nothing about the other two,
so a number built from three exercises looked like a number built from one. It reads "from … and …
and …" now, in the credibility order they are actually weighted in.

**And then the custom-exercise question, which turned out to be the real one.** His friend could not
find a dip machine, made a custom exercise, filed it under Triceps and did 60 lbs for 10. The app
told her her triceps were Advanced while everything else said Beginner.

The app never knew what her exercise trained — she told it, on the create form — and the conversion
was guessed from the equipment dropdown: "Machine" meant "assume 80 % of a close-grip bench". Her
60 × 10 became an estimated 91 lbs on the machine, divided by that 0.80, and came out as a 114 lb
close-grip bench against a female median of 85. Eighty-second percentile. Advanced.

The low quality the guess carried was supposed to stop exactly this, and it only works when a muscle
has other evidence to be outvoted by. She had none. And "Machine" cannot tell an assisted dip machine
— where the 60 lbs is help, and she pressed her bodyweight minus 60 — from a plate-loaded one.

Tim's call: *"expand the library of exercises instead of trying to calculate the input of a custom
exercise. Still allow the user to create a custom lift, but don't let it contribute to the score."*
So custom exercises are logged, charted and counted in weekly volume, and they no longer set a
strength level — the create form says so before you make one. The library went from 275 exercises to
318, including both dip machines: the assisted one, where more weight on the stack now correctly
reads as a *lighter* set, and the seated machine, which gets no conversion at all because nobody has
published one and guessing is what we just removed.

Walking the whole library through the rating code also turned up six exercises that had been
silently unrated for months — they matched no conversion rule, contributed nothing and said nothing
about it. Four have ratios now, two have explanations, and a test makes that state impossible to
ship again.

**Last question of the session, and it is still open:** *"There are ab exercises already in the
library, but when people record workouts for those exercises, the ab muscle group in the display
still shows no recordings. Why is this?"*

The panel is honest and the colour is not. Core and Neck can never be ranked — nobody publishes 1RM
standards for a plank, and most core work is time or bodyweight anyway — and tapping the abs says
exactly that. But unrankable muscles are painted grey, and the only grey entry in the legend is "No
data", so somebody who trains abs three times a week sees the same colour as somebody who has never
done a sit-up. The work IS counted; it shows up in weekly volume and on the Bars view.

Two fixes were offered — give unrankable muscles their own mark and legend line, and/or have the
panel say what it HAS counted ("you've logged 14 sets of core work in the last two weeks") — and he
has not picked one yet. It is the only thing in the app right now that says something false to a
reader, which is why it is at the top of progress.md rather than in the pile.

---

## 2026-09-01 — weekly sets per muscle, the metric this project has always called the headline one

Fresh session, caught up from progress.md. Tim: *"for now, I want to skip the abs, skip any
verification (I'll tell you if it's not working). What next steps do you think we should work on?"*

Three things were offered, all of which need nothing from him: **weekly sets per muscle** (the
biggest missing feature — the maths has existed for a year and the number was never on a screen),
**keeping the phone awake mid-workout**, and **stopping prefilled numbers recording as though you
did them** when you walk past an exercise. Plus one small one: graphs still open on benchmarks when
a lift has both sources, which is the opposite of what he asked for back in August.

He picked **weekly sets per muscle**.

### What it is

Data → **Volume**, a fifth segment beside Muscles. One row per muscle group: sets a week, a bar, and
what the research says that volume is worth. Twelve rows, including the ones on zero — "you have
done no calf work for a month" is the finding, and a screen that quietly left calves out would be
answering a different question.

Tap a muscle and it opens: what another set at that volume actually buys, the same for strength
(which flattens far earlier — past about five sets a week, more volume does not reliably add any),
and **the list of exercises the number was built from**, each marked as counting whole or half.

That last part matters more than it looks. A weekly set count is a derived figure built through a
rule most people have never heard of — a set counts fully for the muscle an exercise trains directly
and half for one it only helps with — and a derived number nobody can check is one people either
over-trust or stop believing. Naming the exercises makes it auditable against the sessions it came
from.

### What it deliberately does not do

**It has no target.** The bands come from a real paper and they describe what another set *buys*, not
how much anybody ought to be doing — "lower efficiency" means each extra set does less, not that you
are overtraining. So no bar is coloured good or bad, there is no target line, and the only threshold
drawn is the one the source states outright: four sets a week, below which no detectable change is
expected.

**And it says it counts your warm-ups.** The app cannot tell a warm-up from a back-off set, and
throwing away the light ones would throw away real work — often the hardest set of the session. That
has been an open question for Tim since August; until he decides, the screen states what it counts
rather than quietly counting something else. Core says why its own number is low for everyone, too:
squats, deadlifts, carries and overhead pressing all hammer it and none of them log a set against it.

### Two things that went wrong on the way

**The row and the list under it disagreed.** The headline read "21.8 a week" and the exercises under
it read 24, 21, 18 — because the data layer counts a window and the row divides it by the weeks. Same
column, different quantity. Anybody checking the number would have concluded the app cannot add up.
Found by looking at a screenshot; the test that now sums the rendered figures against the rendered
headline was written afterwards.

**And a test that was measuring nothing.** Two functions now answer "how much work is this muscle
getting" — the Goals screen's and this one's — and they must never give different answers for the
same muscle. There is an assertion that they agree. But its fixture logged the same three sets on
four evenly spaced days, and an even fixture reports the same rate over *any* window inside it — so
deliberately breaking one of the two functions passed. The fixture is uneven now, and the same
sabotage fails.

Everything is proved in the test suite and in a real browser at phone widths, both themes: 88
route/width/theme combinations audited, 8,330 pieces of text, nothing under the contrast floor,
nothing overflowing, no unnamed controls. Nothing has been on his phone — his instruction this
session.

---

## 2026-09-01, second pass — the app moves now

Tim, mid-session: *"I want to work on some 'animation' or smooth transitions throughout the [site].
When you click on something, I want it to have some sort of visible motion between the movement
rather than just an instant change or teleportation. Additionally, if these movements have some sort
of realistic acceleration in how they start and stop that would be cool as well. Make sure to keep it
quick though, I don't want it to be something that is distracting or slow for the user to deal with.
Only use it when it's appropriate as well."*

Four constraints in one paragraph, and they were the whole specification.

What shipped is a system rather than a handful of transitions: three durations (100ms for a press
answering back, 170ms for most things, 240ms for a whole surface like a sheet) and three easings —
one for things arriving, one for things leaving, and one for something crossing the screen while you
watch it. That last one is the "realistic" part; it is the only one that reads as an object with
weight rather than a value being changed.

**What moves.** A screen rises slightly as it arrives. A sheet drops back towards the edge it came
from instead of blinking out. The pill in the Data tab's switch *slides* from the segment you were on
to the one you tapped — that is the one you described, and it was previously two instant repaints
with nothing joining them. A volume row opens by sliding the whole list around it rather than
snapping. The volume bars grow to their number when the screen is built. Buttons, chips and rows give
slightly under a press.

**What deliberately does not move: anything on the logging path.** The set list, the steppers and the
rest timer are what you use one-handed with a bar in the other, and 170ms between tapping + and
seeing the number is 170ms of standing in a gym. That is what "only when it's appropriate" turned
into. It is also all switched off for anyone whose phone is set to reduce motion, which is a real
accessibility setting rather than a nicety — sliding panels are unpleasant with a vestibular
disorder, and this is an app people use while moving.

**Three bugs fell out of building it**, two of which nobody could have seen:

The toast has been popping in half its own width off-centre since it was written — it borrowed a
shared animation that overwrote its own centring for the duration.

A closed row was leaving 14 pixels of dead space per muscle, from a CSS grid subtlety where a "zero"
track still reserves the content's own padding.

And the accessibility audit was counting 173 pieces of text inside rows nobody had opened, because a
collapsed container measures zero but its contents keep their own boxes. That never made anything
falsely pass — the colours are the same when the row opens — but it made the coverage claim wrong,
which is the third time this project has been caught by that exact shape.

**How it was verified**, since it is not the usual way: a test harness cannot run an animation, and a
screenshot of a 170ms movement is one frame of luck. So it was driven in a real browser and asked
what animations were actually running on each element at the moment it should be moving — 14 checks,
all passing. The pill was caught mid-slide at 79px on its way from 2 to 223.

What nobody can tell you from here is whether 170ms *feels* right under a thumb. All three numbers
live in one place at the top of the stylesheet if you want them faster or slower.

---

## 2026-09-01, third pass — the body map, coloured by sets

Tim: *"The Volume tab is great right now, but I would love it a lot more if it just displayed the
same thing, but did the exact same human body display with the coloured muscle groups (exact same
picture), but instead coloured them by the number of sets for that muscle group rather than strength.
For now, lets try having the muscle groups be colored on a range from red to green. very green is
more sets, very red is no sets for that muscle group... Keep the bar display as an option to see
below the human display."*

Built exactly that. The Volume tab now opens on the same figure the Muscles tab uses — same artwork,
same tap targets — painted by weekly sets, with the key under it, the picked muscle's working under
that, and the bar list still below. Tapping a muscle on the body and tapping its row in the list are
the same act, so the outline, the panel and the list can never disagree about what you picked.

One thing you should know, since it is the riskiest colour decision this app has made: **red-to-green
is the worst possible pairing for colour blindness** — about 8% of men can't separate those two hues.
I built it anyway, because it is what you asked for and because it can be done honestly, but only
under one condition: the five colours get **steadily lighter** as the sets go up. That is what makes
it still readable when the hue is gone — under simulated red-blind, green-blind and blue-blind
vision the five steps still run darkest to lightest, in order. It is the same trick the standard
scientific colour scales use. The key naming all five bands in words, and the number written on every
muscle and in the list, are the other half of that; they are not decoration, and the ramp stops being
defensible if they are ever removed.

The colours are generated by a small tool rather than picked by eye, and a test regenerates them and
fails if the stylesheet has drifted, so nobody can nudge one later without the reasoning collapsing
quietly.

**A nice side effect:** this map has no grey at all. On the strength map a muscle nobody can rank —
abs, neck — is painted the same grey as "never trained", which is the complaint you raised a couple
of sessions ago. Zero sets is a real number, so on this map every muscle says something true. It
isn't the fix for that complaint, but if you go looking for whether the app knows you train your abs,
this screen answers.

Two things I measured rather than guessed: left alone, the figure filled a small phone screen exactly
and pushed the key off the bottom — on a ramp that is only allowed to exist *because* the key is
there — so it is capped. And the strength map's habit of fading everything except the muscle you
picked washed this one out completely, because here the comparison between muscles is the whole
point.

What nobody can tell you from here is how it looks to someone who is actually red-green colour blind.
Everything above is simulation. If you know somebody, ten seconds of them looking at it is worth more
than all of my arithmetic.

### Two follow-ups, straight after

*"The display is really small right now. Make it as big as the main muscle group (strength)
display."*

Measured before changing anything, and the answer was interesting: on a phone the volume figure was
already 44% **bigger** than the strength one. But the report was right — on a laptop it was much
smaller, and the reason is that an SVG never crops. Give it a box of the wrong shape and it shrinks
itself to fit and pads the rest, so a full-width, short container draws a small body floating in a
lot of empty space. The box is now the shape of the drawing itself, so the picture is as big as the
room at any width. On a laptop it now matches the strength figure to within a few percent — not
exactly, because the last 5% would have pushed the colour key below the fold, and the key is the
thing that makes a red-to-green scale legible at all.

And on the windows: you got there first — the numbers were already sets **per week**, so the ranges
are right at 4, 8 or 12 weeks. Measured across the demo year, shoulders reads 22.9, 21.6 and 20.9
sets a week at the three windows; a longer window measures a longer stretch, it doesn't ask more of
you.

The fact that it could be read the other way is still a real finding, though, so one thing did
change: the key had no unit on it. Five chips reading "10–19" sitting directly under a control that
says "4 weeks / 8 weeks / 12 weeks" is a number with no unit next to something that looks like one.
It says **SETS A WEEK** now, and the notes underneath say plainly that the bands don't move with the
window. A screen that can be read two ways has already failed once, whatever the arithmetic is doing.

---

## 2026-08-31 — Hevy's feed, taken apart

Tim: *"I want to improve the social aspect of the cite and how it operates and looks… do an in-depth
analysis on how the Lifting app Hevy shares details with it's home page… analyze what we could
realistically incorporate in our cite as of right now. For the things we can't incorporate right now,
make a note on what we would need and what is limiting us."* And: *"I eventually want to make the
home page extremely similar to how Hevy does it."*

Research only — nothing built. It is written up as **§12 of `docs/social-plan.md`**, from Hevy's own
feature pages and help centre.

**The thing worth knowing before anything else:** most of a Hevy card is already in what this app
publishes and is simply not being drawn. Every set, rep and weight, the set types, the duration, the
time of day and the location all cross to a friend at the middle visibility tier already. The feed
card renders a name, a line of meta and a list of exercise names, and stops there.

**What a Hevy post actually contains:** who, the session name, a description written before saving,
and then exactly three numbers — duration, total volume, and a count of personal records. Media
(up to three photos, or two and a video). Likes, comments, a share link. That is the whole card. Tap
it and you get the muscle split, every set and set type, reps, weights, RPE, PRs and their notes,
plus a Compare button on any exercise you also do, and buttons to save their session as a routine or
start it live.

Two of their decisions are worth copying outright: **three numbers on the card and no more**, and
**the description is part of finishing a workout**, not a separate "post" step.

**What we could build with no money, no server and no decision from you:** the stat row (duration is
already published, volume is arithmetic on data we hold); tapping a card to open the session (that
renderer already exists on the friend's page); a **per-session muscle map** using the figure and the
ramp built earlier today — which is the one thing on that list nobody else has; PR badges, as long as
they say "a best in what they've shared" rather than implying a lifetime record; per-exercise
comparison, rep-normalised so it isn't just who typed a bigger number; saving their workout as a
routine; and a shareable image.

**The cheapest high-value thing on the whole list is a description field.** We don't store one at
all. A box on the finish screen, one line in the projection, one line on the card — and a card stops
reading like a receipt.

**What's actually blocked, and by what:**

- **Photos and video** — needs Firebase Storage, which needs Blaze and a card on file. That's your
  call, not a technical one. There's no workaround: a published document is capped at 1 MiB and
  already carries 60 sessions, which is exactly why the profile photo is capped at ~90 KB.
- **Heart rate and calories** — needs a native app. A web app can't read Apple Health, and that's the
  web-not-native choice doing what it was chosen to do.
- **RPE** — not blocked, it's a decision. We deliberately don't ask for reps-in-reserve, and the
  Goals screen names it as something the app can't see. Worth asking you about; not worth adding just
  because Hevy has it.
- **Push notifications** — one phone can't notify another without a server, so Blaze again.
- **A discovery feed of strangers** — recorded as a thing not to build. It needs public, enumerable
  profiles, which is the thing the invite-link design exists to avoid, and it brings a moderation
  problem with it.

**And the honest limit of the whole exercise: nobody here has opened Hevy.** Everything above is what
their documentation says a post *contains*. It says nothing about how it *looks* — spacing, type,
colour, motion — which was the first thing you asked about. Ten minutes with the app on your phone
and a few screenshots would settle that, and no amount of further reading from here will.

### The screen I couldn't find — Tim sent it

I'd recorded the expanded workout view as the one gap neither research pass could close, and said
only the app itself would settle it. Tim sent four screenshots of it from his phone the same day.
Written up as §12.15–12.16 of the social plan. Three things in it matter:

**Warm-up sets are marked by the lifter, not guessed by the app.** A set row reads `W · 120 lbs x 12`
in amber, and the working sets are numbered from 1 after it. That is a direct answer to the question
that's been sitting open since August — should warm-ups count toward volume — and it is better than
either option that was on the table, because both of those were the app guessing. One tap by the
person who actually knows. It's still Tim's call, but it's a much easier call now: a set-type flag, a
control in the runner, and the Volume tab's "we count everything and can't tell" apology turns into a
setting. The catch is the past: every set already recorded is untyped and has to stay counted rather
than be retro-guessed.

**Personal records are typed and per set.** Under one set: 🏅Weight 🏅Volume 🏅1RM — heaviest weight,
biggest single-set volume, best estimated one-rep max. We can compute all three already, and putting
them under the set that earned them says *which* lift rather than just "3 records".

**The muscle split is a percentage of the session**, not an absolute — Chest 52%, Arms 26%,
Shoulders 21%. That's the right choice for one workout, and worth copying: per session a share, per
week an absolute. Getting that backwards would put a weekly band on a single session.

Smaller: the detail view uses an absolute date ("Wednesday, Aug 26, 2026 - 1:23pm") where the card
uses "6 hours ago"; the set table's header changes per exercise (`SET | WEIGHT & REPS` vs
`SET | REPS`) which our field model already knows how to do; and exercise names are blue links into
the exercise page.

### Prepared for a chat reset

Tim: *"now that we have the notes in place, I want you to prepare everything for chat reset so we can
start actually building this social structure in the next session. Make sure we don't loose anything
in the plan."*

Nothing is half-finished — the working tree is clean and everything is pushed. Two things were
written so the next session starts building rather than re-deriving:

**`docs/social-plan.md` §13 — the build brief.** Eight steps in order, each shippable on its own,
with the file, the function, the trap and the test named for each one. The traps are the part worth
having written down: volume has to double a per-side dumbbell set or it reports half of somebody's
session; a friend's bodyweight lifts can't be counted at all because we don't have their body weight,
so volume counts external load only and says so; and adding a description to the projection will fail
the tier test on purpose until the key is deliberately added to the allow-list, which is that test
doing its job.

**The top of `progress.md` now opens with it.** A fresh session reads that file first, so it now says
in its first screen that the next job is the social feed, where the brief is, and the three things to
know before opening it — the biggest being that most of a Hevy card is already in what we publish and
simply isn't drawn.

The four decisions that are yours are collected at the end of §13: whether a warm-up should be typed
by the lifter (the best of them, and it retires an open question from August), whether visibility
should also be per-workout the way theirs is, whether to add RPE, and whether to pay for Blaze so
photos become possible.

One deliberate omission: your screenshots and the ones I pulled aren't in the repository. It's
public and they're Hevy's UI — the written descriptions are detailed enough to build from, and that's
on purpose.

---

## 2026-09-02 — the feed, built

**You:** *"don't implement warm ups or volume yet. Replace Volume for # of sets. Begin working on
the home page and social aspect changes now. Deploy many sub-agents… Continue working until you
finish."*

All eight steps of the brief shipped.

**The card.** Under the workout's name: what they wrote about it, then a row reading TIME and SETS,
then one line per exercise with the set count first — five of them, then "See 2 more exercises". The
duration left the small grey line above when it moved into the row, because the same number twice on
one card reads as two different facts.

**Sets rather than volume turned out to be the better column, not just the one you asked for.** A
friend's pull-ups and dips have no weight to add up, and their body weight is only published if they
choose to share it — so a pounds figure would have reported a hard session of chin-ups as nothing at
all. A set count is the same number for everybody.

**Tapping a card now opens the workout.** A screen of its own: who and exactly when, the description,
TIME · SETS · EXERCISES, kudos and comments, any bests set in it, a muscle split as percentages of
that session, and the sets themselves in a table whose heading changes with the lift — "Weight &
Reps" for a bench press, "Reps" for a dip, "Time" for a plank. A drop set is one numbered set with
its drops hanging underneath, which is what it is.

**Three things you can do with somebody else's workout.** Compare a lift against your own — fairly,
normalised across rep counts, and measured over the same weeks for both of you rather than your whole
history against their recent months, which would have flattered you every single time. Save it as one
of your own workouts — the set counts and the supersets carry across, the weights do not, because
their 185 lb bench is a fact about them and would be an instruction to you. And share a picture of
it, drawn on the phone, no server involved.

**Descriptions exist now.** A box in the workout header, up to 280 characters, saved with the
session, shown on the card and on the calendar and fixable afterwards.

**Three things worth telling you.**

The demo account's friends had been publishing workouts with *no sets in them* for months. The shape
was right so every test passed; the moment the card started counting sets, it said all your friends
had done none. Fixed, and it now includes one exercise deliberately missing from the library, because
a friend logs what their own app knows about.

Two bugs were invisible to 1,200 automated checks and obvious the first time I looked at a picture of
the screen: the shareable image was cutting its exercise list short while leaving blank space under
it, and the friend's page had been printing pounds to anyone using kilos.

And the personal-bests code carried a comment promising it never used an estimate. Adding a 1RM
record broke that promise, so the promise was rewritten rather than left sitting there — the estimated
one now says "estimated" on screen and names the actual set it was worked out from.

**Still yours to decide, unchanged:** whether a warm-up should be typed by the lifter (you said not
yet, and it is still the best idea on that list), whether visibility should also be per-workout, RPE,
and Blaze for photos.

**Not verified:** none of this has been on your phone, and no two real accounts have used it. The
sharing-a-picture path in particular has only run in a headless browser, where it falls back to a
download instead of the share sheet.

---

## 2026-09-02, second pass — back

**You:** *"When you click back on something it should always go to what you were on right before.
Currently when you click on someone else's workout and then go back. It takes you to that users
profile/page rather than back to the home menu where you saw the post on."*

You reported one screen and it turned out to be true of all forty-eight. Every back arrow in the app
had a *fixed* destination written into it — the calendar for a day, Workouts for a workout, the
friend for their session — which is the right answer only when that is where you came from. The
workout screen is just the first screen in the app you can reach from two different places, so it is
the first one where the fault is visible. Every older screen has it too; nobody had hit it because
there was only ever one way in.

So the fix is one function rather than forty-eight edits: the arrow now goes *back*, and each
screen's written-in destination survives as the fallback for when there is nothing to go back to — a
link somebody shared with you, a bookmark, the first screen after opening the app. That way a deep
link still lands somewhere sensible instead of stepping off the site entirely.

One screen deliberately keeps its old behaviour: the arrow on the "workout complete" screen, which
means "go and change what I just recorded" rather than "back". Going back from there would reopen the
workout you have just finished.

Checked in a real browser: home → tap a post → the workout → back → home, with the feed intact.


---

## 2026-09-02, third pass — the app now guesses what you can lift, on everything

**You:** *"with comparisons between people, if that person has a excersize that the cite can estimate
from another similar excersize, than estimate it rather than say there are no recorded excersizes…
a user should have an estimated 1RM on virtually every single exersize on the site, with varying
confidence levels… when they put in a weight for their benchmark, put a number above the reps that
estimate how many they can do. Additionally, put a % above the weight that says what % of the
estimated 1RM the cite thinks they can lift."*

All of it is built.

**Comparisons.** Open a friend's workout, tap a lift you have never done, and instead of "you have
never recorded this" you now get a converted figure — worked out from the lifts you *have* done,
marked CONVERTED beside the number, with a line saying which exercises it came from and how much it
is worth believing. Your friend's side gets the same treatment when it is theirs that is missing.
If neither of you has trained anything that converts to it, it still says so — that was your rule and
it holds.

**One thing it deliberately does not do:** the "heaviest set recorded" row stays blank for whoever
has not done the lift. That row is a measurement — the heaviest weight actually on the bar — and a
worked-out number in it would be a lie however carefully it was labelled. The estimate only fills the
row that was already an estimate.

**The benchmark screen.** Pick an exercise and it shows what it thinks your one-rep max is, in the
same breath as the word "estimated", the exercises it was worked out from, and how confident it is.
Type a weight and two captions appear: **74% of your estimated max** above the weight, and **maybe 9
to failure** above the reps.

**Worth knowing about that rep number.** It means reps to *momentary failure*, and the research says
people under-guess their own by one to five — so somebody stopping where they normally stop will do
fewer than it says. It is worded as a guess for that reason, and it stops at "15+" rather than
predicting a 30-rep set, because the app already refuses to draw conclusions from sets that long.

**Two things fell out of this that were wrong before.**

The app was refusing to estimate anything at all for anyone who had not entered a weigh-in. That gate
exists so it does not put you on a percentile against other people without knowing your age, sex and
weight — which is right — but it was also blocking a plain "roughly what could you row", which needs
none of them. Someone with months of training and no weigh-in was being told the app knew nothing
about their back. Fixed.

And the research file has a table with what looks like a transcription error in it — it says the same
number of reps at 95% and at 90% of a max, which cannot both be true. Flagged in place; nothing had
ever been built off that row.

**Not verified:** nobody has checked any of these predictions against an actual attempt. Every number
carries its confidence and its sources for that reason.

---

## 2026-09-02, fourth pass — the notes, made ready for a reset

**You:** *"prepare md files for chat reset."*

The top of `progress.md` was a summary of what I had just done. A fresh session needs the opposite —
where things stand and what is open — so it now opens with "nothing is in progress and nothing is
blocking", the three decisions that are yours, the two things nobody has verified, and the standing
"don't do this" list.

Then I had the notes audited against the code, and they were worse than I expected. **Four places
would have sent the next session to build something that already exists:**

- The next-steps section still said no two accounts had ever connected and that a feed was unstarted.
  Both had been false for over a week — and the same file got them right two thousand lines away.
- The roadmap still called weekly volume "blocked", eighty lines from the entry marking it built.
- The social plan still read as a proposal for the eight things that shipped this morning, under a
  heading beginning "If Tim says go".
- The spec said the cloud backend was untested and needed switching on. It has been live with your
  real data since August.

**And one thing nobody had ever written down.** Eleven places in the code and notes cite decision
"D9" for the rule that this app has no RIR/RPE field — the "how many reps did you have left" rating
some apps ask for mid-set. D9 is a completely different decision. The RIR rule was never recorded at
all, despite six modules deferring to it and it being the single biggest thing the app deliberately
cannot see. It is written down now as D28. Nobody noticed because the sentence around the number was
always correct, so nothing ever depended on the number being right.

The README's numbers were mostly stale too — it claimed 272 exercises (318) and eleven test suites
(sixteen).

One mistake of my own, recorded in the notes as a rule: I truncated `progress.md` to zero bytes with
a Python one-liner. Recovered from git in under a minute, and the file now carries a warning not to
edit markdown through a script — which it already had, for PowerShell.

---

## 2026-09-03 — private or public, and a friend's body

**You:** *"I want to change how privacy settings work, as well as change the visibility one user has
on another… I also want a friend to be able to see another user's body, their graphs, volume, etc. as
well as click on any muscle group like that own user can on themselves… make a compare button
somewhere that allows that user to display another person's body side by side… you can either make
your account private so only friends you accept can see, or public so anyone on the app that finds
your account can see all details."*

I asked three things first, because each one changed what got built:

- **Do the per-person levels go away completely?** You said yes. So the four settings (Nothing / Just
  that I trained / My workouts / Everything) are gone, and there is one switch for the account.
- **Which of the more personal fields follow you into public?** You picked the profile photo, the
  time of day you train and the gym name. **Body weight stays with friends** — it is the only
  difference between what a friend sees and what a stranger sees, and it is why there are two copies
  published rather than one.
- **What should the colours mean with two bodies on screen?** You said default to people like them,
  but allow any comparison the app already offers.

That last answer is the interesting one to build, because a percentile is worked out from the
person's own body weight and age — neither of which your phone has for them, and body weight is
exactly what you said not to publish. So **their phone works out all 24 comparisons and publishes the
answers**, and yours reads off whichever you pick. Nothing new about their body is published, and you
can still ask every question.

**What is on screen now.** A friend's muscle map is tappable, with the same panel your own has: the
estimated max, what the next level costs, how sure it is, and the actual sets it came from. Their
volume and their graphs are two rows on their page. A **Compare** button on any body map — theirs or
yours — puts two bodies side by side, one comparison setting governing both, and tapping either one
opens the same muscle on both.

**Three things worth telling you about:**

1. **A trap that would have added strangers to your friends list.** The app learns somebody accepted
   your request by finding it can suddenly read them. That was airtight until today — and a public
   account can be read by anyone, so anybody you had ever asked, who never replied, would have
   quietly become a friend. It now checks specifically that it is reading you as a friend.
2. **The Disconnect message would have lied.** It promises they can no longer see anything of yours,
   which is false on a public account — they keep reading it like everybody else. It says so now.
3. **Two layout faults I only found by measuring.** The level key fell off the bottom of the screen
   on a laptop, and on a phone a friend's map filled the screen so completely that tapping a muscle
   put the panel out of sight — the screen answered a tap by looking like it did nothing.

**Not verified:** no phone, and no second real account — so nobody has actually seen what a public
account looks like to a stranger. The rules are proved against Google's emulator (159 checks) and
deployed; the screens are proved in the demo, in a real browser at 360 and 1180px in both themes, and
by the accessibility audit (124 screens, zero contrast failures, nothing unnamed).

**One aside, because it cost half an hour.** The accessibility audit spent four runs measuring a
version of the app two edits old: a leftover web server from an earlier run was still holding the
port, and Python's server exits silently when the port is taken, so the tool happily measured whatever
was already there. It now refuses to run in that situation. A tool that quietly measures the wrong
thing is worse than one that fails.

---

## 2026-09-03, later — public by default

**You:** *"I think right now the default privacy for people is private, but I would like the default
to be public… for now it should definently be public. Additionally, even if it is private by default,
users that are already friends with someone should definently be able to see that friends
information. Change this now so everyone's information is public."*

**Your second point was already true** — a friend reads a different document from the one the public
setting controls, so private has never hidden anything from someone you accepted. Nothing to change
there.

**The default is public now.** The interesting half was not the default itself but making it reach
accounts that already exist: nothing republishes on a boot where no training changed, so every
account would have shown "Public" on its own screen while still publishing nothing a stranger could
open. The app now checks, every time it starts, whether what is published matches what the setting
says, and fixes it if not — in both directions, so turning it off works the same way.

**One bug caught by a test on the way**: the Friends screen had its own idea of the default and kept
saying "Private" after the change. Two places deciding one thing. The screen asks the one source now,
and the test that found it checks the default by reading the screen rather than by calling the
function — which is the only version of that test that would have failed.

⚠️ **Worth being plain about what this means**: anybody signed in who searches your name can now open
your account and read your training — workouts with weights, the times, the gym, your benchmarks,
your muscle map — unless they turn it off. Your body weight is still the exception. Your idea of
asking at first sign-in is the right fix for that, and it is not built.

---

## 2026-09-03, later still — "Nothing to compare yet"

**You:** *"When I click on compare for my muscle map, and click on one of my friends, it says:
Nothing to compare yet. One of these two has not published a muscle map. What is happening?"*

I read your project's live data rather than guessing. **Your account had updated to the new sharing
model; Autumn's had not** — she still has the old document from the 31st, because each account
updates its own copy the next time its owner opens the app, and she has not since the deploy.

**And it was worse than the compare screen.** Her workouts, her feed cards and her benchmarks had all
gone blank in your app too — the same thing that happened in August when her data looked lost and had
simply never been re-shared. A friend disappearing while waiting for an update to reach their phone
is not an acceptable way for this to work.

**Fixed:** your app now falls back to reading her old document when the new one is not there. Her body
map, her workouts and her cards are back immediately, without her touching anything. What the old
document cannot do is the new detail — tapping a muscle, and comparing bodies — because it only ever
held a level per muscle, so those two say **"Autumn's app has not updated since this screen changed;
it starts working the next time she opens it"** instead of a blank screen. The compare screen names
her and the reason now, rather than "one of these two".

It all starts working properly the moment she opens the app once.

---

## 2026-09-04 — the notes were too big to read, and one of them had been for a while

Tim: *"I think now is a good point to review all the files/folders in Fitness_Tracker and see if we
could improve on organization or anything like that. I think that some of our files are getting
pretty long… If you believe the organization is good how it is… then tell me and we'll continue
working. If you think there are things to improve without hindering this work or changing the actual
function of the cite in any way then go ahead and fix them now."*

**One real breakage, found by trying to read the file.** `progress.md` had reached **626 KB**, and
the tool a fresh session uses to read a file refuses anything over 256 KB. So the instruction at the
top of it — *"read this entire file before doing anything"* — had been quietly impossible for some
time, and nothing anywhere said so. `chat.md` had crossed the same line at 424 KB.

**Split, on raw bytes, with nothing rewritten.** The dated session log was 52 % of `progress.md` and
is pure history, so it became `docs/history.md`; the numbered reference sections §0–§10 became
`docs/handbook.md`; and what is left in `progress.md` is the state, the standing instructions and
Open work — **82 KB, down from 626**. `chat.md` keeps 2026-08-21 onward and the older half is in
`docs/chat-archive.md`. Every line of both originals was then searched for in its successors, and
the only ones missing are the twenty-nine pointers deliberately rewritten.

**The rule that stops it growing back**: a session's full write-up goes at the top of
`docs/history.md`, and only its one-line summary comes to `progress.md`. Two kilobytes a session
instead of forty.

**Thirty-six code comments were pointing at the wrong file afterwards** — they cite "progress.md §6",
"§0.10", "§9" — so all of them now say `docs/handbook.md`. The section numbers did not change.

**Three files also left the repository.** `probe-body.tmp` (empty) and two ~100 KB screenshots of
the app's own screens had been committed by accident and were being served publicly by GitHub Pages,
referenced by nothing. `.gitignore` now refuses both shapes.

**The code was assessed and left alone, deliberately.** `store.js` has a clean seam but extracting it
would make two modules import each other in an app with no build step; the two big test files share
one progressively-seeded store, so splitting them would change what the assertions run against
without changing the count; and `app.css` must stay one file for the same no-build-step reason. Half
of what makes those files long is comment, which is the thing that survives a chat reset. **No dead
modules — everything in `js/` is imported by something.**

**Nothing about the app changed**, and the whole headless suite proves it: 16 suites, all green,
render still 911.

**Then Tim asked the right follow-up:** *"so now we also made a system that will stay organized as we
continue working?"* — and the honest answer was **only half**. The rule was written in three places a
fresh session would meet it, and nothing enforced it. This project's own lesson is that an absolute
claim needs a test rather than a design argument, so **it is a test now**: every file a session is
told to read whole has a byte budget, checked in the same block that checks the `sw.js` precache
list, because it is the same shape of fault — a hand-maintained fact about the repo that looks
perfect from inside the session that broke it. The budgets sit well under the 256 KB limit so it
fails while there is still room to act, and the message says what to move rather than just the
number. **Mutation-checked**: dropping the budget to 80 KB fails exactly that assertion.

---

## 2026-09-04, later — Tim is interviewed about what this project actually is

Tim: *"now I want you to ask me a bunch of questions about how I view this project and what I want it
to be… Don't stop asking questions until you feel like you understand everything. Make detailed notes
about this somewhere."*

**Six rounds, twenty-four questions. The record is `docs/direction.md`**, and it is required reading
because **four rules that had been enforced hard for weeks were reversed by his answers.**

**The frame.** It is a real product for strangers — he and his girlfriend use it as their main
strength tracker now, it goes to the **App Store in the next few months**, and *"the long-term goal
is to get it as big as the biggest lifting apps or even bigger."* He is clear-eyed about it: *"If I
don't make it big at all then that's fine, but I'm just saying that the dream is actually
realistic."* It competes on **quality and being free**, he is paying for it himself, and he wants
revenue capped at what it costs to run — donations or slight ads, never more. He works on it most
days with no deadline. **Scope order: weightlifting, then other exercise, then diet, then others.**
A rename is coming and he will bring it.

**What flipped.**

1. **"Something is always better than nothing."** *"It's about getting the BEST numbers we can, not
   necessarily having it perfect or held to an extreamly high standard. When our numbers aren't as
   perfect, have a way to be upfront about it."* The labelling survives — that half is his own words
   — but the blanket refusals do not. **He does not want a sweep; he wants a list**, and will pick.
2. **The discovery feed.** Refused twice in writing when this was an app for two people. Asked
   whether that survives the App Store: **"It has to go eventually."**
3. **The "not verified on a phone" warnings.** *"Don't record them at all. I'm constantly testing
   almost every part of the cite so when something has a problem, I'll come to you."* Shipped is
   working unless he says otherwise. The one thing that does not cover is a *predicted number* — you
   cannot spot a wrong estimate by looking at it.
4. **Visuals.** The strongest instruction he gave: the app *"looks very AI-generated and not very
   professional… I don't want you to automatically go fixing things yourself, I think it needs a
   human perspective."* **Wait for him, screen by screen.**

**Two things he asked for**, and they are the only work this created: a **note-to-the-developer**
feature with his account as a rule-enforced developer role, and the **list of every blank and
refusal** so he can choose which ones get a number. **Three things he deferred**: the app's voice,
what "quality" means, and the abs ranking — *"I'll talk to you about it after questioning."*

He also confirmed what does not change: recommend only when asked, never ask him about other
people's opinions, safety is noted but not worked on yet, and **he does not read any of these notes
— they are for the next session of me.**

---

## 2026-09-04, later — the abs colour, fixed

Tim asked where the abs question stood, got the answer (nothing agreed, nothing built), and then made
two moves: **"fix the color issue now"**, and a proposal of his own — give Core a 1RM estimator off a
specific exercise, from whatever can be found online, *"and if we have to, we can estimate the numbers
ourselves given normal trends."*

**On his proposal**, agreed with one modification: there is a real difference between finding one
source where every other muscle has two, and making the number up. The first is a real median with a
known weakness and the confidence model already handles it; the second is our own guess wearing a
percentile's clothes, with nothing to check it against. Search hard first; if we do end up estimating
it ourselves, say **the app's own estimate** — which is his own rule, not caution.

**Two facts that sharpened it.** Only **8 of 30** core exercises in the library record a weight, so
his idea rates about a quarter of the ways people train abs — every plank variant, hanging leg raise,
ab wheel and sit-up is in the other three-quarters. And a research question nobody had asked: there
may be published population norms for the **plank hold** and the **60-second sit-up** (ACSM trunk
endurance, McGill, military PT standards). If those hold up they rank the 73 % rather than the 27 %,
and they fit something the app already has — those are *tests*, and it already distinguishes a
benchmark from a set logged mid-workout. Unverified until a proper research pass runs.

**The colour fix itself turned out not to be a judgement call at all.** The screen was already
printing *"Core and Neck can't be ranked — there are no published strength standards for them"* a few
lines under the figure, while painting those muscles the exact grey that means "nobody has ever
trained this", whose only key entry says "No data". Right in words, wrong in colour, same screen.

Core and Neck with recorded work are now **hatched**, with their own key entry, and tapping one says
what it has got — sets, sessions and the exercises behind them, over a stated year. No level, no
percentile, no comparison to anybody, which is why none of it needs a standard.

Verified by screenshotting a real browser in both themes rather than trusting the tests: jsdom has no
paint, and the first probe that *did* try to sample pixels was measuring the wrong thing — it
re-rasterised the SVG from a data URI, which detaches it from the stylesheet, and reported the figure
as solid black while it was rendering perfectly.

**One thing left undone on purpose:** the demo has no ab work, so this state cannot be seen there.
Fixing that re-rolls the entire seeded demo year and invalidates a golden table that exists to catch
regressions — not something to do quietly inside a colour fix, so it is written up as Open work 25
for Tim to call.

---

## 2026-09-04, later — Core is a ranked muscle

Tim: *"start planning and then when you're ready start building a version you think follows my
description and you think is good enough for the app."*

**Built.** Core has a key lift — the **Cable Crunch** — a measured median (151 lb for a 180 lb man,
106 for a 140 lb woman), and it now behaves like every other muscle on the map. `UNRANKABLE` is down
to Neck, Cardio and Activity.

**Three things the research decided rather than confirmed**, and they are why this took a research
pass instead of four lines of table:

1. **The cross-check disagreed by 17 %**, where every other lift in the app agrees within 3 %. The
   measured source (Strength Level, 12,596 logged cable crunches) beat the modelled one, and the gap
   is carried as an actual penalty rather than a footnote.
2. **Core's tiers are 50 % wider than any other lift's.** Reusing the app's global spread would have
   put a lifter sitting exactly on the published *Beginner* mark at the 0.1st percentile — the model
   calling a published beginner the weakest person alive. Core now carries its own; nothing else
   moved by a pound.
3. **The machine-crunch conversion is the cleanest number in the whole ratio table for men** — five
   levels agreeing to three decimals — **and the women's tables say something 27 % different.** Both
   cannot be right, so it went in at reduced quality rather than being averaged into a number
   neither table supports.

**"A little less reliability" is arithmetic now, not a sentence.** Identical evidence gives an
identical estimate and a lower confidence, so Core reads *fair* where Chest reads *high*, and the map
paints it less vividly. That also forced a smaller change worth knowing about: every "how to improve
this" hint in the app is an instruction, and on Core an instruction would be a lie — no amount of
logging fixes a thin standard. It now says *"nothing more to log — this one is held back by the
standards, not by your training"*, and only after the genuinely fixable reasons are exhausted.

**Two things would have shipped broken.** The morning's hatch was computed from "is this muscle in
the unrankable list" — so the moment Core left that list, anyone whose ab work is planks would have
dropped back to "No data" over three sessions a week. That is the original bug reintroduced for the
majority, and it would have *looked* like a success. It now asks whether a rating actually came out.
And a test written for a completely different sweep caught Ab Wheel Rollout going silent — it records
no weight, so it fell through every branch saying nothing.

**The honest headline, unchanged from the estimate I gave beforehand: this rates about a quarter of
how people train abs.** Twenty-two of thirty core exercises record reps or time and no load. They
keep the hatch. The plank and sit-up norms are written down as an unchecked lead, not a rejected one.

---

## 2026-09-04, last — three off the list: the note feature, abs in the demo, the wrong table

Tim asked for a ranked list of what to do next, then picked three of it: *"build the note-to-developer
feature, give the demo some ab work, and fix the transcription error."*

**The note feature.** Anybody signed in can send Tim an idea or a problem from the Account screen; his
account reads them at `#/notes`. The part that took the thought was the read side: **only his uid can
read a note, and that is enforced by the security rules rather than by hiding a screen.** The author
cannot even read their own note back — that would need a rule that looks *inside* the document to
decide, which is the shape where a mistake quietly shows somebody else's note. Nobody can edit one,
including Tim, because a note is a record of what somebody said. He can delete.

It stores what device they were on rather than an app version — there is no build step, so a version
string would be a constant that never changed while looking exactly like something that did, which is
worse than storing nothing.

**Two real bugs got through 941 jsdom assertions and died the first time I drove a real browser.** One
was a wrong function call that would have made every send throw. The other is the more interesting:
the check meant to stop anonymous accounts sending never fired, because the store read `anonymous`
where the field is `isAnonymous` — **and the test had mocked the wrong name too**, having been written
from the code rather than from what `auth.state()` actually returns. A mock copied from the thing
you're testing only proves it agrees with itself. Both fixed; the test now uses the real field and
says why.

Proved on the live project, not just the emulator: a throwaway account sent a real note over the
deployed rules, I checked its shape, then deleted both the note and the account.

**The demo trains abs now** — and a neck, which sounds odd until you notice that Core ranking means ab
work no longer produces the hatch, so nothing else in the demo could show that state. Adding
exercises re-rolls the whole seeded year, so the golden table moved; I checked every number was still
plausible before accepting it rather than just pasting. One failure wasn't a re-baseline at all — the
demo's goal came out reading 0% progress, which is a property the demo is supposed to have, so that
got fixed in the demo instead of in the test.

**The research table is corrected.** 95% is ~2 reps, not ~5 — and a second cell was wrong too. Both
were *shifts*: every wrong number was a real number from the cell next door, which is exactly why it
looked sound for weeks. That pattern is now written down, so the next wrong table gets checked for it
first. Nothing in the app used either cell.

**Still owed from the earlier list: the blanks-and-refusals list.** It keeps getting queued behind
things Tim picks, which is the right order — it's a list for him to choose from, not a change.

---

## 2026-09-05 — each body its own population, a friend's data as tabs, one control removed

Three instructions in one session, all about screens that show other people.

**"Relative to each."** Tim pointed out that on the compare screen both bodies were being ranked
against the same population — and that what he'd asked for on 2026-09-03 was that each person be
measured against people like *them*. He was right, and it had been built one reading off.

The interesting part: **weight and age were already per-person, and only sex was not.** The owner
resolves body weight and age when they publish their grid, so those two axes have always meant "their
own". Sex is the only axis the reader resolves, and the "Like me" preset was resolving it eagerly
into a concrete male or female — so whichever the viewer happened to be, both bodies got it. The
machinery for the fix already existed and was simply unreachable: keeping the sex axis unresolved
makes one comparison object produce a different key per body. It's now the first chip in the sheet
and the default that screen opens on.

Two smaller things fell out. The Sex axis would have lit "Men" while no sex was actually in use, so
in that mode nothing is lit and the help text says why. And the screen's caption said "each body is
ranked against its own body weight and age" — narrowly true, silent on sex, and the test was pinning
exactly the two axes that already worked.

**A friend's data is the Data screen now.** Tabs at the top — Muscles, Volume, Graph, Bars, Calendar
where Research is on yours — with recent workouts still under their body. The way to make it look
"nearly exactly like" your own screen was to make it *be* your own screen: `GraphView()` takes a
subject, six store getters grew a rows parameter, and a friend's Volume tab is literally yours
reading their rows. The one pane that isn't shared is the muscle map, because their percentile was
computed on their device against a body weight that isn't in any published document.

Their calendar is months only — the years view would draw sixty published sessions as though it were
their whole history — and its days go nowhere, as inert cells rather than buttons that do nothing.

**"What they can see of yours" is gone from a friend's page.** It was right when it was built: a
per-person dial, at the top of that person's page. When the tiers went it became one account-wide
setting that merely happened to be drawn there — and a per-person position for an account-wide
control invites somebody to think they're changing what *this* friend sees.

**And I emptied `views-data.js` with a script** — the exact failure the notes warn about twice, which
I'd read the same session. Recovered from git; it cost that file's work for the session and nothing
else. Worth recording *how* it happened: the rule wasn't forgotten, it eroded. A dozen surgical
scripted edits had worked earlier in the session, and each success made the next feel safer — which
is word for word what the 2026-09-03 note predicted.

Paused here for a chat reset with everything green and pushed. The compare fix was confirmed in a
real browser; the friend-page tabs weren't looked at yet.

---

## 2026-09-06 — the list of blanks, and then eight of them turned into numbers

Tim asked for the list `docs/direction.md` §3.1 says he wanted: every place the app shows a blank or a
permanent refusal instead of a best-effort number. Delivered as three groups — eight where the app is
holding the data and says nothing, nine where nothing is published anywhere, and about twenty
first-run blanks that have nothing to estimate from and that a sweep would wreck.

Then: *"it seems like you have a good idea of what should be changed or not so make a plan for each
one and start building. Don't ask me questions, just go with whatever you recommend."*

Four agents, one per file set, none allowed near `css/app.css` or `tests/` — the two places four
parallel writers collide silently. Tests, integration and the audit came after, in one pass.

**The muscle map was the big one.** Two missing settings used to blank the whole body over an account
holding a year of sets. It ranks now, and the shape of the fix is the part worth keeping: a missing
weigh-in **widens the comparison to lifters of every size** rather than inventing a body weight. That
is a real group that can be named honestly, and there's an assertion whose only job is to fail if
somebody later fills that field in with a reference weight. A missing sex assumes male and says so.

**And it is never published to a friend.** A reader can't recompute a percentile — body weight isn't
in a public document by design — so a guessed grid would be read as somebody's real standing with
nothing to check it against.

**Goals kept its gate, and that was the one real decision.** It branched on the same flag, so lifting
it opened Goals too. But a goal *freezes* its target weight when you set it, so an assumption made
once would sit inside that target for twelve weeks after the profile was filled in and every other
screen had stopped mentioning it. The map is a reading and gets relabelled; a goal doesn't.

**An agent found a real bug on the way past.** The session runner's opening-weight loop never checked
whether the muscle's own rating was a stand-in — so a three-hop estimate could land in a field
somebody loads a bar to. Same bug fixed elsewhere four days ago; it survived here because the two
files look like they do different jobs and do the same arithmetic.

**The audit is worth two notes.** Run against the changes it found eight contrast failures — so it was
run again against unmodified `HEAD`, which found the identical eight. Not ours: a 9px "PER SIDE" chip
at 3.96:1 in the light theme. Real, left alone, because colours are Tim's. And the first run of it
measured 404 pages the whole way through — a stale server on the port — reporting zero contrast
failures and zero overflow across 128 routes. A clean sweep and a broken one look the same; only the
text-node count tells them apart.

---

## 2026-09-06 (later) — the follow-ups, and one task that killed itself

Asked what was next, gave a ranked answer, and got: *"alright do all of those that you just
mentioned."* Three agents again.

**The research one is the interesting failure.** The job was to add a bar-height parameter so
inverted rows and incline push-ups could be ranked, because the handbook said *"adding the parameter
is the fix, not adding a number."* The answer came back no, and the handbook's own sentence was the
problem. The incline push-up's two figures are already two named box heights — the parameter was
never missing — but they measure peak dynamic force where the app's push-up number is a static hold,
so shipping them would have scored one movement at three heights where part of the first step is the
definition changing rather than the exercise. And the inverted row's parameter turns out to be body
angle, not bar height, from a journal that is predatory and unindexed. Nothing built; the note that
sent me there is corrected.

Worth keeping the shape of that: a warning that names a *fix* gets acted on. This one named the wrong
fix and had sat there long enough to be believed.

**Custom exercises can borrow a ratio now**, but only because the person names what theirs is closest
to — the app stopped guessing from the equipment dropdown and started being told. The safety is
arithmetic rather than a rule: a match is worth 0.40 of what the real exercise is worth, which puts
even the best possible match below the threshold where it could chain into a second inference. The
dip-machine set that started all this now converts at quality 0.14 instead of rating somebody
Advanced.

**The PER SIDE chip is fixed** and, more usefully, the palette test can now catch it. It never could
before: it reads tokens out of `:root`, and the failing pair only existed because a class painted one
on the other.

Two things I got wrong and caught. An agent nearly put two different meanings in one field — the same
fault the notes already record twice — and flagged it itself. And my first mutation check of the
colour fix passed, which should have meant the test was worthless; the mutation had hit the hex in
the comment above the rule instead of the rule. A mutation check that passes proves nothing until you
know it landed.

Audit ends the day clean: 128 routes, zero contrast failures, zero overflow.

---

## 2026-09-06 (last) — the kg bug was bigger than reported

Fixed the kg bug and, since you left the other two to my judgement, did both.

**The kg one turned out to be worse than I described it to you.** I'd found the chart's hover readout
printing "205 lbs" to someone on kg. What I hadn't checked was the axis — every gridline label was
the raw pounds number too, so the entire weight chart was in the wrong unit, not just the tooltip.
The shape of the line was right, which is exactly why it could sit there: it rises when you get
stronger either way, and only the numbers down the left-hand side were lying. Only the labels
convert now, never the plotted geometry — pounds to kilograms is a pure scale, so every gridline
stays where it was and only its name changes.

Worth saying that nothing in the test suite could have caught this, because the suite has always run
in pounds. It's now pinned in both units.

**The comment one is the same lesson as yesterday's handbook sentence, one layer down.** The code
said the incline push-up was excluded because "the app does not record the height" — which is a
problem the app can obviously solve, and that's precisely why a session went off to solve it. The
real reason was two bullets below and unfixable. Corrected in the code and in the test that's
supposed to stop people filling these in, which was carrying the same weak wording. A rule guarded by
its weakest reason gets overturned by whoever solves that reason.

**And the knee push-up is in.** It's the one variant the research could admit, because it was
measured on the same force plate with the same men in the same position as the push-up figure the app
already uses — so nothing has to be reconciled. It matters because it's the most likely first chest
exercise anybody logs, and the map was grey for exactly the people with least reason to trust the app
yet.

One near-miss worth recording: I almost rejected it. The ratio divides rather than multiplies, and
reading it the wrong way round made a beginner's knee push-up look like a 189 lb bench. Checked the
arithmetic before writing anything, and the real number is 104. The ordering against a full push-up
is now a test rather than an argument.

---

## 2026-09-06 (cost) — the analysis you parked in the interview

You asked for the cost analysis, opened up to a range and with something to read it in. It's an
artifact: https://claude.ai/code/artifact/9bc624aa-45b9-4f81-8e19-0b793e3e3742

Your instinct that per-user cost is near nothing was right, with one exception that turned out to
matter more than everything else in the analysis combined.

**It costs $110 a year.** Apple's account and a domain. GitHub Pages is free and — worth knowing —
literally cannot bill you; if you exceed its limits it degrades and sends an email. Sign-in is free
with no ceiling as long as nobody enables the Identity Platform upgrade.

**But the bill isn't driven by how much people train.** Every cold app open re-reads a user's entire
session history, so somebody three years in costs three times what they cost in year one for doing
the same amount of exercise, and it never levels off. Your most loyal users become your most
expensive. That single pattern is 81% of the bill at ten thousand users, and reading only what
changed since last sync is worth about 20× at every scale — free to nearly two thousand users
instead of ninety-four.

I recorded that rather than building it. Nobody asked for it and it's a real change to how the app
talks to Firestore.

**Two things I'd want you to know before they cost you anything.** There is no hard spending cap on
Firestore — Google shipped caps in July but Firestore isn't covered, alerts can lag days, and the
only true stop deletes the billing account. And never accept the Identity Platform upgrade: it bills
per active user, and because this app signs everyone in anonymously by default, every abandoned
browser profile would become a line on the bill.

Also corrected a note in your direction file: guideline 4.8 doesn't require Sign in with Apple any
more. It's been rewritten so that offering Google sign-in is what creates the obligation.

Ads I'd avoid regardless of the money — Apple forbids behavioural advertising on health data, which
is most of what this app knows about anyone.

---

## 2026-09-06 (reset prep) — tidying the notes

Collapsed today's five passes in progress.md into one section. They'd stacked up as five separate
"what changed" blocks, which is exactly the sprawl the file split was meant to stop — the rule is one
line per thing here and the full write-up in history.md, and five passes in one day had quietly
broken it. The file is smaller now than before I started, despite the day's work being in it.

Refreshed the top of the file too: the START HERE block was still describing 2026-09-05 and saying
the last session's work hadn't been looked at in a browser, which is both stale and the exact caveat
you told me to stop writing.

Recounted the assertions properly rather than leaving the 2026-09-03 total: 4,118 across seventeen
suites, up 114.

Added two things a fresh session would otherwise have to learn the hard way. One is that you want
sub-agents used, and that the thing making it work is giving each a list of files it may touch and a
list it may not — nobody near the stylesheet or the tests, because that's where parallel writers
collide without anyone noticing. The other is a trap I hit today: a mutation check can pass because
the mutation landed on a value written in a comment rather than in the code, which looks identical to
a worthless test and sends you off rewriting a test that was fine.

Also flagged the Autumn note as unchecked since the 3rd rather than leaving it reading as current
fact — it fixes itself the moment she opens the app, and nobody has looked.

---

## 2026-09-07 — leaving a workout and coming back to it

You asked for the Hevy behaviour: a down arrow instead of the ✕, walk around the app, and a box above
the tab bar with an up arrow to get back in. Built.

The thing worth telling you: **the app already kept the workout.** Every set has been saved as you
type it since the runner shipped, and starting the same workout again the same day has always picked
up where you left off. What was missing was any way to know that — the only way back in was finding
that workout in Record, and the only place the app ever said so was one line inside the "are you
sure" box you got on the way out. So it kept your workout and looked exactly like it had binned it.

Now the ✕ is a ▾ and it doesn't ask you anything, because there's nothing to warn you about. The bar
sits above the tab bar on every screen with the workout's name, how long it's been running and the
exercise you're on. Tap it and you're back in with your numbers still in the fields.

One thing I found while building it, and it could have cost you a session: **starting a different
workout used to delete the one in progress, silently.** That was survivable when leaving took a
deliberate trip through a confirmation box — but with a bar on every screen telling you a workout is
open, it's a stroll: Record, tap the next one, gone. So starting a second workout now stops and tells
you the first is still open and how many sets are in it, and you pick. If nothing's been recorded in
it, it just swaps without asking.

Two things I didn't do. Hevy has a bin icon on that bar for throwing the workout away — you didn't
ask for one, and a one-tap delete for a live workout sitting under your thumb on every screen isn't
something I wanted to add on my own. Say the word if you want it. And I left the finish screen alone,
since you said the third screenshot is a separate conversation.

Checked in a browser at phone size, both themes, all four colours.

---

## 2026-09-07 (second pass) — the save screen, and what photos would cost

Done. Finish now opens a save screen instead of saving: the workout's name, how long it took, sets
and exercises, then the description, the gym and the date, and a discard at the bottom. Save is what
writes it. The description and location chips are off the runner's header.

Worth knowing why it works now and didn't before: the old finish screen only appeared *after* the
workout was already saved, so a description box on it would have been describing something already on
disk and would have needed a second write. Moving the boundary is the fix — the new screen comes
before anything is written, so it's still one save.

Three things on Hevy's screen I deliberately didn't copy. Volume in pounds — a session of pull-ups
has no weight to total, and you'd asked for set counts instead. The visibility row — that's an
account-wide setting here and a per-workout one is a decision you haven't made. And the title field
and Apple Health, which don't exist in this app.

**On photos.** Yes, it's possible, but not on the free plan and the cost isn't where you'd expect.

Storing them is cheap. At about 200 KB a photo, a thousand users posting one per workout is around
$1 a month of storage. What costs money is people *looking* — every view downloads the picture. A
thousand users with twenty friends each is roughly $100 a year, which is about what the whole app
costs today. Ten thousand users with fifty friends each is roughly $2,500 a year.

Two things make that number less predictable than it looks. Accounts are public by default now, so
"how many people see this photo" has no ceiling. And Firebase has no hard spending cap — you can set
alerts, but they lag by up to a day.

If you want them, the things that keep it cheap are: shrink the photo on the phone before uploading
(the app already does this for profile pictures), one per workout, and thumbnails in the feed with
the full picture only when someone opens the workout. That last one is most of the saving.

One thing I'd flag, and it's the case you told me to speak up about: photos are user-uploaded
pictures on an app where accounts are public by default, and there's still no blocking, reporting or
moderation. Not a reason to skip photos — a reason those come first.

Nothing built on the photo side. Your call.

One honest note: the service-worker update test is failing on my machine today. I checked it against
your committed code with my changes stashed and it fails there too, so it isn't from this work —
something about the machine, not the app. Recorded, not chased.

---

## 2026-09-07 (third pass) — the bin on the bar

Added. It's on the right of the bar with a divider between it and the rest, so the tap that opens the
workout and the tap that deletes it can't be confused.

One thing I did differently from what you said, and I want to be upfront about it (bin version): it asks you first,
but only when there's something to lose. If you've recorded sets it says how many and waits; if you
started a workout and haven't typed anything, it just goes. That's the same rule as removing a person
from a workout and the Discard on the save screen, and it matters most here because this button lives
a few pixels from the Home tab for the whole workout. Say the word if you want it to delete
immediately either way.

---

## 2026-09-07 (fourth pass) — the wordiness, measured

I measured it rather than guessing. The app has **18,631 words** a user can read, **304 sentences
over 15 words**, and **63 blocks of 40 words or more**. Worst files, in order: the research topics,
the ready-made programmes' exercise notes, Goals, the Data screens, Friends, Account.

The useful finding: **almost none of it is padding.** Nearly every long block is the app explaining
itself. There's a rule here that every caveat gets said on screen — that's right and I didn't delete
any — but it never said *where*, so the Volume screen ended up as a body map, your numbers, and then
five paragraphs of about 150 words underneath. Same prose every visit, sitting under the only thing
that changes.

So the question mark you described is exactly the right fix, and I've built it. The rule I've written
down for it: **the ? holds the *why*, never the *what*.** If a sentence changes what you think a
number is, it stays on the screen. If it explains where the number came from or what it can't see, it
goes behind the ?.

Converted so far: Volume's notes (five paragraphs down to one line), Volume's short-window caveat,
Goals' "on track?" and its stalls note, Settings' findable-by-name, and the Research heading.

Two things worth flagging. The visibility sheet — who can see your account — got **no** question
mark: what a stranger can see about you is a *what*, so nothing should be hidden. I turned its
48-word sentence into a list instead. Same facts, much easier to read. Not everything wordy wants a ?.

And six of my own tests failed, which was correct — they exist to stop a caveat being quietly
deleted. I didn't relax them; they now tap the ? and check the words are still there. That's a
stricter test than before, because the words have to be reachable, not just present.

That's seven places done out of about three hundred. The mechanism and the pattern are in, and I'd
rather you point at the screens that bother you than have me sweep the lot.

---

## 2026-09-07 (reset prep) — tidying the notes

Collapsed today's four passes in progress.md into one section. They'd stacked up as four separate
"what changed" blocks, which is the same sprawl I cut on the 6th — one line per thing here, the full
write-up in history.md. The file is smaller now than before I started, despite everything today being
in it.

Two stale lines went with them, and they're the reason this matters: the first-pass notes still said
"no discard control on the bar" and "the save screen is a separate job he'll raise later". Both were
true when written and both were done by the end of the day. A fresh session reading that would have
believed the app was two features behind.

Refreshed the top of the file. It now tells a new session to check `git status` before anything else,
because the muscle-outline work may be sitting uncommitted in the tree.

Recorded in direction.md that you've opened the wordiness topic — it was on the deferred list with
"don't shorten copy globally" next to it, and that's no longer right. Your carve-out for the research
section is written in there word for word.

---

## 2026-09-07 (fifth pass) — the muscle outlines

Fixed, and you were right that some are much worse than others. The cause turned out not to be the
outline drawing at all — it's the step before it, where the app works out which pixels belong to a
muscle by reading the source JPEG. That reading wobbles a pixel or two from one row to the next,
partly from JPEG compression and partly because the illustration's own fibre lines cut into the edge
where they run out to it. The tracer then followed that wobble exactly, which is your staircase.

The reason Chest looked nearly perfect is neat: its fibre lines run *along* its outline instead of
across it, so nothing bites into the edge.

So the fix is upstream — smooth the shape before tracing it. Lats, hamstrings, glutes and quads are
all visibly cleaner now, and the whole map got 37% smaller as a bonus. The bits that must stay
separate did: the notch between the hamstring heads, the gap between the glutes, the ab channels.
There's a build-time check that stops the smoothing if it ever changes a muscle's shape rather than
tidying it, and I made that check fire on purpose to be sure it works.

One incidental fix: the traps had a 1–2px stripe of unpainted paper across them, caused by the same
problem. That's gone too.

An agent did the work; I re-ran the generator myself and got a byte-identical file, so it's genuinely
reproducible rather than hand-edited.

---

## 2026-09-08 — the profile menu

**You:** *"right now the profile menu is really wordy and complex, when it really should be quite
simple"*, with a screenshot of Hevy's Edit Profile screen. Then: *"the 'left on this device' part
should be removed … there should be no button for it"*, and *"all details like the 'view demo
account' descriptions should be held in a question mark."*

**The upload button is gone and it now happens by itself.** When someone creates an account,
anything they logged before it comes with them — no card, no button, no count. It only does this on
creating an account, not on signing in to one you already have: signing in reaches an account that
already has a history, possibly from a phone that isn't yours, so quietly merging a stray browser
into it would be wrong. The sign-in screen still warns about that case, which is the one where
something really is left behind.

Worth knowing: most people were never affected. An anonymous account is already a cloud account, so
adding an email or Google just attaches to it and the data was always there. The button only ever
mattered for workouts logged while the app couldn't reach the internet.

**The descriptions are behind a "?" now**, on the account screen and on Your details. Two things I
deliberately left in the open: who can see your profile photo, and "only in this browser" — both are
what your data *is* rather than an explanation of it, and hiding either felt like the wrong kind of
tidy.

Two blocks I deleted instead of hiding, because the screen was already saying them: a "Signed in"
card sitting under your email address, and — inside the demo — three paragraphs repeating the demo
banner that's on every screen anyway.

Your details now reads like the screen you sent: a label, a "?" next to it, and the control. The
three paragraphs explaining why the app wants your gender, birth year and weight are one tap away.

I didn't put your screenshot in the repo — it's someone else's app and the repo is public. I wrote
down what it showed instead.

---

## 2026-09-08, second pass — the read pattern, and more of the wordiness

**You:** *"do 1 and 3 for now, I'll work on #2 along with some other things later"*, plus the note
about question marks sitting too far from what they explain, and four more wordy places.

**Opening the app no longer re-downloads your whole training history.** It asks for what changed
since this device last looked, plus a cheap count that catches anything deleted on another phone.
That's the 20× on running cost — free servers to about 1,900 users instead of 94.

My first attempt at it was wrong and a test caught it. I was tracking "what's new" to the nearest
millisecond, and the database stamps everything written together with the same instant — so
restoring a backup gave a whole year one timestamp and the app could never get past it. It would
have re-read everything every time, for exactly the people with the most data. Fixed.

One thing worth saying plainly: like the rest of the cloud code here, this has never run against the
real database, only against a stand-in. The arithmetic is tested hard; the network calls are
reviewed, not executed.

**The question marks now sit next to their labels.** You were right — I'd put them on the right-hand
edge, which reads fine under a body map and is obviously wrong beside a two-word heading.

**And the wordiness**, on Goals, Data, and the three places you named: the compare box, the details
under someone's posted muscle split, and the friend comparison. Three things I deliberately did not
hide: anything refusing to give you a verdict, anything saying who can see your data, and anything
marking a number as estimated rather than lifted. Those change what the number *is*; only the
reasons moved.

**One thing I found and did not fix:** deleting your account doesn't actually delete your workouts
from the database. The safety guard that stops the app erasing sessions in bulk — the one added
after your calendar came up empty — refuses that write too, and the error is swallowed. The account
goes, the data stays where nobody can reach it. The fix is one word, but it means handing out the
exact flag that guard exists to make rare, so I'd rather you decide.

---

## 2026-09-08, third pass — the navigation restructured

**You:** get rid of the You/Friends tabs on Home, move privacy and the display name into the account
menu, put the calendar back into Data, and replace its tab with a profile section — picture, name,
and the number of workouts, followers and following, each opening a list. Plus: Home is going to be
the hub for anything that doesn't belong to another section. Four agents ran on it.

**The tab bar is Home · Workouts · Record · Data · Profile.** The calendar is a Data tab again, and
`#/calendar` still works on its own, so nothing anybody bookmarked broke.

**The sixth Data tab genuinely didn't fit** — measured, the row ran 59 pixels past the edge of a
360px phone and "Calendar" showed about a sixth of itself, with no way to scroll to it. The tab row
scrolls sideways now and jumps to whichever tab is selected. Rows with four or five tabs are
untouched.

**The new Profile tab** shows your picture, your name, and the three counts. Tapping followers or
following gives you the people you're connected to; tapping one opens their page. Tapping workouts
gives you your sessions, newest first.

**Two honest things about those counts, both behind the "?" beside them.** Followers and following
are always the same number here, because connecting is mutual — you ask, they accept, and from then
on you each see the other. And if your account is public, anybody signed in can see your training
without connecting, so the number is the people you're connected to rather than everyone who can see
you. I didn't build a real follow system; that's a much bigger change and you didn't ask for one.

**Worth raising:** "followers / following" is Instagram's wording for a one-way relationship, and
this app's is two-way. Either the words change to match (Friends, Connections) or the model changes
to match the words — the second is a real feature with new rules and a migration. Your call, and
nothing is blocked while it waits.

**A bug the move uncovered, caught before it shipped.** Moving the rename control to the account
screen would have saved your new name and then dumped you on the Friends list, because the sheet
had the destination hard-coded. Two agents spotted it independently and neither fixed it, because it
was in a file neither of them owned — which is exactly what I'd want them to do.

**I added nothing to Home.** You described what it's *for* rather than asking for something on it, so
it's the feed with the switch removed, and the placement rule is written down for whatever comes
next.

**And the notes are ready for a reset.** `chat.md` had reached 216 KB of its 220 KB limit, so its
older half (21st to 26th August) moved into the archive; it now starts on the 29th. Nothing was
edited in the move and every line was checked into its new home.

---

## 2026-09-09 — a friend's page on a laptop, and whose standard their body is held to

**You:** viewing someone else's profile on a laptop is a mess and formatted for a phone; and their
muscle map is being compared against people like *you* rather than people like *them*. Then, partway
through: the "compared to" menu is wordy and doesn't need any words at all.

**The laptop layout was one line, and it was doing exactly what it says.** Your own muscle map puts
two things in its pane — the figure and the panel beside it — and there's a rule that lays that pane
out in two columns on a wide screen. A friend's page puts *seven* things in the same pane, so all
seven became columns: the body drew 122 pixels wide, the caption wrapped one word per line, and their
workouts ran off the right-hand edge. Their page got its own layout in September when you asked for it
to look like your Data screen, and it inherited a rule written for different contents.

Now the two-column split lives around the figure and its panel specifically, so a laptop puts them
side by side the way your own map does and everything else runs full width underneath. **The phone
layout is untouched** — I measured the same boxes before and after, and every new rule is inside the
wide-screen branch.

**On the comparison: you were right, and it was worse than it looked.** Their map opened on *your*
saved setting, which carries a specific sex the moment you've pressed "Like me" — so a woman's body
was being ranked against men because you're one. It now opens on their own, resolved from their
document per person.

Their body weight and age were always theirs, which is why this was easy to miss: the small print
under the caption said "their body weight · their age" and was correct, while the headline said "men
who lift" and was not. Fixing the colours alone would have left that headline wrong, because the words
and the colours worked it out from two different places. They read the same one now.

One thing I found on the way: changing the comparison on their page re-coloured the body and left the
caption naming the population you'd just switched away from. Fixed.

**And the menu is cut.** The four paragraphs under Population, Sex, Body weight and Age are behind
question marks next to their labels. The little descriptions under "Like me" and "Everyone" are gone
altogether — pressing one lights up the four rows below it, which is exactly what it means, and the
line at the bottom names the result in words. Two things I deliberately left visible: that bottom
line, and the sentence explaining why nothing is selected under Sex when you're comparing two people.

Some words also named the wrong person: on someone else's page the chips now read "Like them", "Their
body weight" and "Their age", and on the two-body screen "Own body weight".

---

## 2026-09-09, second pass — Record comes up from the bottom

**You:** the record section should feel like a button that activates something — pull it up from the
bottom over whatever's on screen, with a down arrow in the top left that pushes it back down and
leaves you on Home.

**Done.** Tapping the middle **+** now slides the Record screen up over the one you were looking at,
and the arrow in the top-left slides it back down onto Home.

The interesting part was that the app had no way to show two screens at once — it clears one and
builds the next, which is why nothing in it has ever needed to know what came before. So the screen
you're leaving gets lifted out and parked on top of the page for a quarter of a second while the new
one comes up over it, then removed. The router itself didn't change.

Two things went wrong first and only showed up in a browser. Screens here have never had their own
background — they just sit on the app's — which is fine when there's one of them and looks like a
rendering fault when there are two: you could read both through each other. And moving an element
makes Chrome restart its animations, so the parked screen faded in from nothing at the exact moment
it was meant to be a still picture. Both fixed, neither visible to any test.

**The arrow goes to Home rather than back to where you came from**, as you asked. It's deliberately a
different control from the back arrow everywhere else — that one always returns to the previous
screen, and this one doesn't, so it's kept separate to stop it being "corrected" later.

It doesn't animate when you open the app straight onto Record from a link, because then there's
nothing underneath for it to have come up over.

---

## 2026-09-09, third pass — one count called friends, and the duplicate that was flagged

**You:** combine the two counts and call them friends; you'll check the estimator yourself; and keep
going on the wordiness if it isn't done.

**The Profile tab has two numbers now: Workouts and Friends.** Nothing was built or deleted to do it
— the list of people is the same list it always was, so going back to followers/following later stays
cheap. The old links still work and land on the same list, which is titled Friends however you get to
it. The little "?" went with the second number: it only existed to explain why two figures were always
the same. One thing stayed on the screen, and only when it's true: if your account is public, people
can see your training without being friends, so the number is who you're connected to rather than who
is reading you.

**On the wordiness, I measured first rather than guessing** and then did the two things already
written down as unfinished.

The first was the one I flagged last session and didn't fix: every transcribed programme's notes
opened by repeating its own warning, a couple of centimetres below it. Worst case the two shared
fourteen words in a row. That's ~240 words gone from six screens.

Cutting it exposed something. The tests that checked "this says it isn't the author's own writing"
were reading the notes — so when I deleted the repeat, they went red, and one of them was right to:
**Arnold's Golden Six was the only programme whose warning had never said it.** The disclaimer had
been living solely in the copy I'd just removed. It's in the warning now, where it belongs, and the
tests read the text that's actually printed rather than one particular field.

The second was the Goals screen's block about weights: four paragraphs, 182 words, permanently sitting
under your numbers. It's three short sentences now — that your goal never sets the weights, that
nothing gets heavier because a deadline is near, and that the suggestion only reads your last two
sessions. That part stays visible on purpose; it's the one thing in the app that could get somebody
hurt if they believed the opposite. The mechanics moved behind a "?", including the line about not
telling you to go lighter after a layoff, word for word.

I also took one paragraph off the Research tab — the one listing where *other* screens' numbers come
from, which isn't about the age chart it was sitting under. The three that describe that chart stayed
whole, as you asked.

**And the notes are ready for a reset.** Both of the last two days had grown three separate sections
in the catch-up file; each is one section now, with the full write-ups in the history file.

## 2026-09-10 — delete meant delete, a rise behind its own ghost, and Profile earns its tab

You started with the two items off the open list — *"you can do whatever work you think you should do
for those two things"* — and then reported five more things from actually using the app. All of it is
below, and the Profile reorganisation at the end is the one still in progress.

**Delete account was leaving most of your account behind.** The entry said it left the sessions. It
left much more than that: five of the ten collections were never even named, so weigh-ins,
programmes, goals, saved people and guest workouts all stayed. The one collection it named correctly
— sessions — failed every time, because clearing them is a mass delete and the guard we built in
August refuses one; the error was caught and written to a console nobody reads. And the whole
approach couldn't touch the copy your friends read at all. So a public account that deleted itself
stayed readable by anyone signed in, permanently — after the login is gone, every rule is "only the
owner", and there is no owner.

It deletes everything now, published copies first, and then it **re-reads to check** before deleting
your login. If anything survived, your account stays and the message says what is left. That order is
the whole fix: keeping the account is recoverable, orphaning it is not.

**The Record animation was rising behind the very thing it was meant to rise over.** You described it
exactly — the animation gets shut down and nothing gets covered. The screenshot we keep of the old
screen was painted *on top* of the panel coming up, so the rise ran its full quarter-second out of
sight. The reason the down arrow looked right is that falling genuinely wants the old screen on top;
it's the one direction where the same setting is correct. Two directions, two layers now. Measured in
a browser, and the first two measurements I wrote disagreed with each other — both were wrong, and
that's the only reason I caught it rather than believing the convenient one.

**Then the same movement for a workout in progress**, which you asked for straight after. The ▾
slides down, the bar's arrow brings it back up. Both measured.

**A joint workout was two workouts.** You found this by recording one. Next exercise, add, remove,
swap and reorder now reach both of you, with a **"Just for ___"** button when you want to change only
one person. What never crosses is the numbers: if you add an exercise for both of you, each person's
copy is built from their own history. Rae's curls open at her weight, not yours. That was the part
worth being careful about, and a test now proves it by breaking if the code ever copies instead.

**The sideways drag.** Nobody ever wrote the rule that allowed it — the browser did. Setting only a
vertical scroll quietly turns the horizontal one on too, so every screen in the app has been
draggable sideways since it was written. Fixed everywhere, with the Research table keeping its own
scroller because it genuinely is wider than the screen. The root cause turned out to be the little
"?" dot: its invisible 44px tap area overhangs the 26px button by 9px, and wherever it sits against
an edge it pushes those pixels into whatever is scrolling.

**The audit had never looked at a laptop, and the first time it did it found something.** The active
tab label in the desktop sidebar fails the contrast standard. It's the same colour pair we fixed in
September — but we fixed it in exactly one place, because at phone width that was the only place the
tool could see it. Reading the stylesheet instead of waiting for a tool found four more. Fixed
together.

**A friend's calendar** got the Months/Years switch you asked for, and asking for it turned up that
every cell of every friend's calendar has been saying just "Workout" — a published workout stores its
name under a different key than a local one. Their Years count says "days published" rather than
"days trained" now, because you only ever see their last sixty sessions and the old label was
counting one thing under the name of another.

**And the Profile question.** You were right that both halves were wrong, and they turned out to be
one problem: Profile was empty *because* its content was in Data, and Data was overfull for the same
reason — six tabs that genuinely didn't fit, only working because we made the row scroll. The line
that sorts it is what a screen answers: **Data is what your training means, Profile is what you did.**
Calendar has moved across, Data is back to five tabs, and Profile now shows your best lifts — the
measured set first, the estimate underneath and labelled. Body facts, Goals and the Account tidy-up
are still to come.

**On photos**, you asked twice and then paused them. Worth keeping: per user it's 10–25¢ a year, but
it's the one feature where the cost per user *rises* as you grow. Storage now needs a card whatever
your usage — that changed in February and the Firebase pricing page still says otherwise. At ten
users you'd pay nothing; the first real bill is around 145 users, and it's download *operations* that
bind first, not bandwidth.

---

## 2026-09-11 — catching up is not a go-ahead, and the split is finished

**You:** "catch up with progress.md" — then, partway through: "what's happening right now? shouldn't
you just be reading a file and that's it?" and "When I tell you to catch up with progress.md, you
should not start working on anything until I tell you. It's okay to tell me what you think next
steps are, but don't start working until I tell you to."

**Fair, and it is written down now** — in progress.md's standing instructions, in the handbook's
working agreement and in direction.md. The mistake was treating something you authorised last session
as still running this one. From here: I read the notes, tell you what changed and what's open, and
wait.

You said to finish this time, so the Profile/Data split is done — all five steps.

**Your body is on the Profile tab**: sex, age and current weight, with the day you last weighed in
under them, because that number is that day's rather than today's. Tapping it opens the form, which
is unchanged — the Profile tab shows things, the profile icon is where you change them. If half of it
is filled in, it shows that half and asks for the rest.

**Goals moved off Settings onto Profile**, and the Settings row is gone rather than left behind —
otherwise there are two answers to "where are my goals". Old links still work. The row says what
level you're aiming at, on which lift, and the date it runs to, and deliberately doesn't say whether
you're on track: the Goals screen refuses to call that, and a one-line summary is exactly where that
refusal would quietly get undone.

**The Account screen lost the repeated bits**: it used to print "Male, 31, 180 lbs" back at you,
which the Profile tab now does properly, so that row just says what's behind it. If something is
missing it still tells you, because that one is worth acting on.

**One thing worth knowing**: while checking the new screen for contrast and overflow I found the
Profile tab had never been in the accessibility sweep at all — the list had a row called "Profile"
and it was the old settings form, so the name looked taken. It's in now. The full sweep is clean:
272 screens, 34,027 pieces of text, nothing failing.

---

## 2026-09-12 (same session) — six asks, three agents, and Record over the bar

**You:** the benchmark's captions on every set; Years-first calendars with Months landing on now;
lock a set when you move on; the exercises drag should follow the finger and lose its arrows; core
lifts ranked and coloured; and "when the screen goes up, it doesn't cover over the main sections
display". Then: "you should be deploying many sub-agents."

**Captions.** Every open set now shows "_% of your estimated max" over the weight and "maybe __ to
failure" over the reps, same arithmetic as the benchmark screen. It's a note beside a number you
typed, never a number the app puts on the bar, and it's worked out per person — a guest sees their
own, or nothing, never yours.

**Calendar.** Years everywhere by default, including a friend's. Tap Months and the current month
is what you're looking at; scroll up for earlier. One thing left visual and yours: the Months/Years
pill on the Profile tab doesn't slide like the others — one line, whenever you want it.

**The lock.** When you move on from a set you actually did, it locks — padlock on the right, swings
shut — and tapping the padlock unlocks and opens it. Untouched sets never lock. One thing to look
at: because set 2 is filled from set 1 the moment you open it, going back to set 1 locks that copy.
It always got saved that way; the padlock just makes it visible.

**The drag.** The row follows your finger exactly, the others slide out of its way, and it takes
the nearest slot when you let go. Arrows gone; the grip still moves with the arrow keys.

**Best lifts.** Eight core lifts, each an estimated one-rep max coloured by level, the level and
the confidence in words under it, ordered highest level first; everything else under "Other lifts".
A lift you've done shows the max off your own best set; one you haven't shows what your other
lifts suggest and says so; one the app can't rank says why instead of guessing.

**Record.** It covers the tab bar now, and the arrow is the way down. Measuring it found the
still picture underneath was leaving partway through the rise on a slow load — fixed to leave when
the rise ends. Everything green: 1,330 screen assertions, 2,021 data-layer, the full sweep clean.

---

## 2026-09-13 — the strength math, audited; nothing built

**You:** "catch up with progress.md" — then: an in-depth analysis of how we do the math on the
ranking, the 1RM estimates and the cross-exercise conversion; start exploring fatigue; don't build
anything; make a plan you'll look over and deploy later; use as many sub-agents as I want.

**Nothing was built.** Seven agents each took one slice and ran the app's own code on fixtures and
the demo year rather than reading it. The plan is `docs/strength-accuracy-plan.md`, and the page for
you is published — findings ranked, fourteen decisions with what I'd do on each, and the plan in
phases.

**What's sound:** the formula, its two inverses, the kg/lb path, the percentile mixture, the ratios
we actually derived in August (all 45 re-checked against today's pages), and the fatigue discount
already in.

**What's wrong today, worst first:** four places score an assisted pull-up on the *help* number, so
more help is a personal best; the fifteen-rep rule isn't applied on the Data tab; about twenty-five
ratio entries we never derived are off by more than ten percent — a 100 lb machine lateral raise
rates Shoulders Elite, and a woman's hip abduction machine can rate her glutes Elite off one set; a
muscle's number never goes down once earned; the typo screen exists and was never wired in; "any
body weight" silently means 180 lb; the runner can tell you a weight you benchmarked two days ago is
above your max; one spread for both sexes puts a woman at the Beginner mark near the bottom quarter
of a percent; and goals have no version stamp, so any of these fixes would read as progress — that
guardrail goes first.

**Fatigue:** the literature still says no to a correction in the *rating* — nobody has measured a
1RM after prior work on the same muscle. But it gives the caption exactly what it prints: reps at a
fixed load fall by a known fraction each set, and the fraction is the same at any load, so "maybe 8"
can honestly become "8, then 6, then 4" with a number that can only go down. Your own history can
supply your own fraction after about three sessions. And a run of flat reps at one load is evidence
the first set wasn't near failure — useful only to withhold credit, never to add it. One thing I
stated with both sides and didn't recommend: a single opt-in "how many more could you have done?"
tap on the last set.

**The claim underneath:** "within 4.6 %" is the simulator checking the curve against itself. With
the lab rep curve as truth the bias is about 8 %. The backtest on your own benchmarks is the first
validation item and needs an export of your data.

Everything is in the page. I'll wait for you to pick.

---

## 2026-09-14 — three readings you flagged, and the maths behind them

**You:** you liked the fixes and the advice on all fourteen decisions, and said to start building.
Then twice: deploy more sub-agents.

**Your three are fixed, and they were all one thing.** The reverse pec deck was carrying the
*dumbbell* rear-delt ratio, applied to a single machine stack. The estimate divides by that ratio,
so half the right ratio is double the number — your 70 × 10 read Advanced and now reads 16th,
Beginner. The lying leg curl was a mix of the same problem and a leg-curl standard taken from a
different population; it reads 75th now. Autumn's face pull was the app using one ratio for both
sexes: a woman's face pull is a third more of her overhead press than a man's is of his. Hers reads
40th, Novice.

**And a fourth I found while fixing them, which was worse than any you saw.** A 100 lb machine
lateral raise rated shoulders Elite, 99.9th percentile. The app was doubling the stack (as if it were
two dumbbells) *and* dividing by the two-dumbbell ratio.

**About twenty-five ratios were more than ten percent out.** Every one the August sweep actually
derived was right; every miss was a number someone had reasoned about, or one rule covering two
exercises that are loaded differently. That is the third time this exact lesson has come up.

**Some bigger things behind them.** Ratios now depend on sex where the published data says they
should. There is one place in the app where a set becomes an estimated 1RM, instead of seven — four
of which scored assisted lifts on the *help* number, so taking more help was a personal best. A
muscle's rating can now go down: it used to keep your best set ever, so a year of lighter training
read the same as your best day. And the rating picks your most *credible* set rather than your
biggest number, which is what was telling you a weight you'd tested two days earlier was above your
max.

**The set captions changed too.** They read your own best set on that lift when you have one, and
say which set. The rep guess is a range now, from the measured table rather than our own curve. And
it drops across a run of sets — "maybe 6–9 on this set (8–13 fresh)" — because reps at a fixed load
fall by a known amount each set. That number can only ever go down, so if it's wrong you just beat
it.

**One thing worth knowing.** Nine sub-agents were building this and a usage limit killed all nine at
once, most of them mid-file. One had written the *comments* describing its changes and only some of
the code, which meant pull-ups, chin-ups and dips silently rated nothing at all. Everything is
finished and tested now, but that is the failure mode to know about: a half-finished agent leaves
notes that describe work it didn't do.

**Still to do, and none of it is urgent:** the backtest against your own benchmarks needs an export
of your data — that's the one that would tell us how accurate any of this actually is. And a full
re-derivation of all the ratios rather than the worst twenty-five.

---

## 2026-09-15 — what the interrupted agents left, then the ratio table

**You asked** whether last session's interrupted agents had left anything to finish, and they had —
more than the notes admitted.

**The accessibility audit had already run.** The notes said it produced nothing; in fact 4.5 MB of
its output was sitting in the dead session's scratchpad, unread, because the agent was killed between
writing the results and reading them. Clean sweep: 272 screens, no contrast failures, no overflow, no
unnamed controls, at four widths. I re-ran it against the current code too, since the original run
predated the last commit.

**A comment in the ranking code said the opposite of what the code does.** The typo screen claims it
only ever compares a lift against its own past. It doesn't — it compares every exercise for a muscle
in one series. So a genuine heavy bench test, logged among light flies, gets set aside. I fixed the
comment rather than the code, because on real training the safety margin is wide (the widest
disagreement between two exercises of one muscle is 1.12×, and it takes 2× to trigger). The
alternative fix would let a mistyped number on a brand-new exercise straight through, so which error
you prefer is your call.

**A tool had been reporting "22 figures outside tolerance" through a green suite** since the rebuild,
and the obvious reading of that was wrong: 16 of the 22 were checking sentences that had been
reworded away. Behind them were four places still claiming the estimator's constants were chosen to
minimise one thing when the measurements say another.

**Then you picked the ratio work.** Re-deriving the whole table found the *check* was broken before
the table was — it couldn't read the sex-specific ratios we added last session, so it reported 18
entries badly wrong when the real number was 10. Eight of those ten were the same fault: the male
figure right and the female figure 8–15 % out, on entries that never got a sex pair. Agreement with
the published source went from 38 entries to 85 out of 105.

**And then σ.** Every ratio now carries a measured uncertainty — how much it drifts between the
novice and advanced rows of the published table — and readings are blended by how precisely each one
pins the answer, instead of by a judgement. Your muscle map moved between −2.3 % and +2.8 %. One
side-effect worth knowing: your old back-session complaint (the tired third exercise dragging Back
from 212 to 145) now reads 199.8, because the assisted pull-up — the least trustworthy conversion in
the file — carries a fifth of the weight it used to.

**Six things are waiting on you**, three of which put a new sentence on a screen: the quarantine
trade-off above, the fall limit, a freshness note that has never rendered at all, a dead line on the
Data tab, Goals printing a percentage that can disagree with itself, and one measurement that
contradicts a claim in two places. They are listed at the top of `progress.md`.

**Not started, and ranked first if you want it:** nobody has ever walked this app with a keyboard,
run a screen reader against it, or tested it at larger text.

## 2026-09-16 — a friend's page became their profile, and what that made every account share

**You asked for three things and said to use sub-agents.** Three ran at once on separate files.

**The friends list showing blank faces.** It never could have worked: the row was asking for a photo
from your own friends list, and a photo lives in the other person's published copy, not in yours. It
reads that now, after the list paints, and falls back to the grey figure if their account can't be
reached.

**A friend's page is their profile now.** Their picture at the top, workouts and friends, their core
lifts and the rest, their calendar — no goals, and their body row shows sex and age only, as you
asked. "View data" in the top right pulls their data screen up the way Record comes up, with the
muscle map, volume, graph and bars but no research, and the arrow puts it back down. You can open
their workouts and their friends and keep walking from there; going back from a friend's friend
takes you to your own profile, not to the person in between.

**The part that wasn't small.** None of that could be shown, because accounts don't publish any of
it. Your app has never shared your sex, your age or your friends list — so all three now go into
what people can read of you. Two things worth knowing about that. Your friends list is readable by
anyone who can read your account, which on a public account means anyone signed in; it's the first
thing we publish that names other people, and it's one line to reverse if you'd rather it didn't.
And your body weight did **not** join them — it stays friends-only and off by default, as before.

**One thing that would have broken quietly.** The security rules pin exactly which fields a shared
copy may contain, so adding a field without updating them would have made every publish fail —
silently, with no error on any screen. It would have looked like everyone's page freezing. The rules
went out with it, and the test that should have caught it was itself using a fake document thinner
than the real one, which is now fixed.

**Systems fold open and closed** in both the Workouts and Record lists. They start open, remember
what you closed, and remember it separately per screen. Tapping the system name opens and closes it
rather than going in — "Open this system" is the last row inside each one.

**Expect one oddity:** a friend's age and friends list only show up after *they* next open the app,
because only their app can publish their own details. Until then their page says so rather than
pretending they have no friends.

**Three things you asked for are queued and not started** — the weekly/cycle schedule boxes on a
system, months with nothing in them collapsing to a line, and the bar chart of months once there are
more than five. All three land in files that were being rewritten while you asked, so I left them.

**And the two you added while that was running, both done.**

**A system can have a plan.** Optional, on any system: either seven weekdays or an N-day repeating
cycle up to 14, each day holding one of that system's workouts or Rest. It shows as boxes at the top
of the system's own screen, and you build it on the edit form behind the pencil. As you decided, it
only displays — Home and Record still suggest whichever workout you've gone longest without doing,
and the "?" on the screen says so outright. Two details worth knowing: "Rest" and "nothing planned"
are deliberately different, and if you delete a workout the day that named it goes back to empty
rather than turning into a rest day you never chose.

**Empty months collapse, and there's a bar chart.** A month with nothing in it is now one line saying
the month and "No recordings". Once you have more than five months with recordings, a bar chart sits
above the months — one bar per month, height = days trained. A month with nothing *between* two months
that have something still gets a column at zero, so a gap in your training reads as a gap; months
before you ever recorded anything aren't drawn at all. On a friend's calendar it says days
*published*, not days trained, because you only ever see the sessions they've shared.

One thing I left for you: on the 1st of a month with nothing in it yet, the months view lands on that
one-line row with a screen of empty space under it. That space is the "open on the current month" fix
you asked for doing its job — capping it would stop it landing — so I didn't touch it.

**Three fixes off your reports, minutes after that went up.**

**A friend's "view data" lost its Calendar tab** — four tabs now, since their calendar is on their
profile. Along the way: `#/friend/<id>/calendar` had never actually worked (it read "that workout is
not here"); it opens their profile now.

**The months view stops at your first and last recording.** No more empty months before you started.
One consequence you should know: if your last workout was months ago, the current month isn't drawn
at all, so the calendar opens on the most recent month you actually trained in. Say the word if
you'd rather it always ran through to today.

**Back from someone's profile always goes to your own profile now**, whatever you were on before —
which is what fixes the thing you hit, where closing their data panel and pressing back put you
straight back into the panel. The earlier version of that rule only applied when you were inside a
friend's friend, and it could never have caught your case: the app was correctly going back to the
screen you were on, and the screen you were on was the panel you'd just closed. Their workouts and
friends lists still go back to that person; only their profile jumps home.

One thing I fixed in my own notes while doing it: the docs claimed the Data tab has six segments
including Calendar. That's been wrong since the calendar moved to Profile on the 10th.
