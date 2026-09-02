# Fitness Tracker — Session history

> **The dated log, newest first. Nothing here was edited** — every section is byte for byte what it
> was when it was written. It was moved out of `progress.md` on 2026-09-04 for one reason: that file
> had reached **626 KB and could no longer be opened in one read**, which quietly broke the single
> instruction the whole workflow rests on (*"read this entire file before doing anything"*).
>
> **You do not read this file top to bottom.** `progress.md` carries the recent sessions in one line
> each; come here for the full write-up of one of them, and search for its date.
>
> ⚠️ **THE DATES ARE SESSIONS, NOT CALENDAR DAYS.** Every commit from `e1a7afd` onward carries a git
> date of **2026-08-26** or **-27**, including everything headed -28 and -29. The headings keep the
> sequence a reader navigates by; never compute an interval from them.
>
> **A new session appends its section at the TOP of this file** and one line to `progress.md`. That
> split is the thing that stops progress.md growing back.

---

## 2026-09-08 (second pass) — 💷 THE READ PATTERN, AND THE "?" MOVED TO WHERE IT POINTS

Tim asked *"what do you think is next?"* — a direct question, so a ranked answer was owed. He took
**1 and 3** of the three offered: the read pattern, and more of the wordiness. (**2 was asking about
public/private on first sign-in**, which he is doing himself *"along with some other things later."*)
Then, on the pass before this one: *"some of the question marks were located far away or on the
opposite side of the screen as the thing they were refering to … the question mark should be right
next to the just looking around text, not on the right side. this way it's easy to know where to get
information."*

### A. 💷 OPENING THE APP NO LONGER RE-DOWNLOADS A TRAINING HISTORY

**The finding is from 2026-09-06 and it was recorded rather than queued** (`docs/running-costs.html`,
Open work 26): `readShard()` did `getDocs()` over the whole sessions collection on **every cold
open**, so the bill scaled with how LONG somebody had trained rather than how much. A three-year user
cost 3× a one-year user for the same exercise, and it never levelled off. **Reads were 81 % of the
bill at 10 k users.** Measured worth of fixing it: **~20× at every scale** — free servers to ~1,894
users instead of ~94.

⚠️ **AND OFFLINE PERSISTENCE NEVER HELPED**, which is the part that makes this counter-intuitive: it
is already switched on, and Firestore bills a one-shot query by the documents it returns whether or
not they are sitting on the device. **Only asking for fewer documents changes the number.**

**The mechanism, and it needs both halves:**

1. **`where('updatedAt', '>', cursor)`** returns only what changed since this device last looked; the
   rest comes out of a snapshot in `localStorage`.
2. 🚨 **A COUNT CATCHES THE DELETES**, because a `where >` query is structurally blind to them — a
   deleted document does not come back changed, it does not come back at all. `getCountFromServer` is
   billed at **one read per 1,000 documents**, so it is affordable on every single sync.

**What fires on a delete** is that the merged set is one row bigger than the server says the
collection is. ⚠️ **The subtle case is delete-one-add-one**, where the raw document count is
completely unmoved — the merge still holds the deleted row, so the sizes disagree anyway and it falls
back to the full read.

🚨 **THE FIRST VERSION OF THIS WAS WRONG AND A TEST CAUGHT IT DEAD.** The cursor was a **millisecond**
compared with `>=`. Firestore stamps every document in a batch with one instant, so a
restore-from-backup — or the adoption of a 1,200-session legacy history — gives a whole collection a
single timestamp. The query then matched all 1,200 on every sync, and because re-reading them could
not produce a *newer* maximum, **the cursor was pinned there for ever.** The cheap path silently
became the expensive path *for exactly the accounts with the most data in them*, which is the failure
the whole feature exists to prevent. Fixed by storing the real `{seconds, nanoseconds}` and comparing
with `>`. ⚠️ **`tsAfter()` compares the pair rather than `seconds * 1e9 + nanos`** — that arithmetic
is ~1.7e18 today against a `MAX_SAFE_INTEGER` of 9e15, so the obvious version silently discards the
nanoseconds the function exists to keep.

🔒 **EVERY UNCERTAIN PATH ENDS IN THE FULL READ, which is exactly the old behaviour** — no snapshot,
a snapshot from the millisecond version, a count that will not come back, an SDK without
`getCountFromServer`, storage denied, a snapshot whose `rows` is not an array. That last one is a
shape check rather than trust: it is parsed out of a store any script on the origin can write to, and
it is handed to the diff that decides what to **delete**.

⚠️ **A LOCAL WRITE REFRESHES THE SNAPSHOT AND DELIBERATELY DOES NOT MOVE THE CURSOR.** We never learn
what `serverTimestamp()` resolved to on our own documents, so the next sync re-reads them — a handful
of billed reads, once, against inventing a timestamp and skipping somebody's change.

🚨 **AND A MUTATION CHECK CORRECTED A COMMENT RATHER THAN THE CODE — §0.14's other half.** The header
claimed the count was compared against *cached + genuinely-new* "not `rows.length`", and that the
distinction was what caught delete-plus-add. Swapping one for the other changed **nothing**: the
merge is the union of exactly those two sets, so they are the same number. The check is right and the
stated mechanism was invented. Both are rewritten to say the real reason. **A false mechanism in a
comment is how the next person simplifies the true one away.**

- 🆕 **`firestore.rules` gained a comment, not a rule.** `allow read` already covers `list`, so the
  query and the count need nothing — but the line now says that narrowing it to `get` would break
  every read of a sharded collection, not merely the count.
- 🆕 **Deleting an account clears its snapshots**, which are keyed by uid and would otherwise sit in
  `localStorage` describing an account that no longer exists.
- ✅ **1,911 data-layer assertions** (was 1,874). The Firestore double grew queries, aggregation
  counts and a **moving server clock that shares one instant across a batch** — the property that
  caught the millisecond cursor. Its `where()` models **only `>`**, deliberately: a double that
  quietly accepted either operator would let the original bug back in unnoticed.

### B. THE "?" SITS AGAINST ITS LABEL NOW

The first version right-aligned every dot, because `.help-line > .section-label { flex: 1 }` was
written for a caption above a body map. Tim is right that it is wrong for a two-word heading — the
dot ended up 300px from the words it answers for. A `.section-label` or `<label>` in a `.help-line`
no longer stretches; a `.field-help` or `.note` still does, because there the dot follows a sentence
that already fills the row.

⚠️ **`flex: 0 1 auto`, NOT `flex: none`.** A long label — *"Your data — only in this browser"* — has
to keep the right to shrink on a 360px screen, or it is pushed off the side, which is the one thing
the browser audit exists to catch. `.by-label`, added an hour earlier as a scoped exception, is
deleted: it was the general case all along.

---

## 2026-09-08 — THE PROFILE MENU, SIMPLIFIED, AND A BUTTON THAT SHOULD NEVER HAVE EXISTED

Tim, with a screenshot of Hevy's **Edit Profile** screen: *"right now the profile menu is really
wordy and complex, when it really should be quite simple."* Then two specific instructions:

> *"First, the 'left on this device' part should be removed. When a user creates an account if they
> already have items uploaded to an empty page that they're using then that information should
> automatically upload to their account. there should be no button for it."*
>
> *"all details like the 'view demo account' descriptions should be held in a question mark that
> pops up when you click on it to learn more, don't display it on the main screen."*

**This is him pointing, which `docs/direction.md` §4.1 says is how the wordiness work proceeds.**
It is the second screen to get Design Rule 9 after Volume and Goals, and the first where a whole
screen rather than one block was the subject.

⚠️ **THE HEVY SCREENSHOT IS NOT IN THE REPOSITORY AND MUST NOT BE** — same standing rule as
`docs/social-plan.md` §12.12. What it showed, written down instead: an avatar over a *Change
Picture* link, then two section labels (**Public profile data** — Name, Bio, Link; **Private data**
— Sex, Birthday) and **nothing else**. Label-and-value rows, no prose anywhere, and 🚨 **a single
"?" beside "Private data"** — the exact control this app shipped on 2026-09-07, arrived at
independently, which is a useful thing to know about Rule 9.

### A. 🚨 "LEFT ON THIS DEVICE" WAS THE APP ASKING THE USER TO DO ITS FILING

`signedInScreen()` counted the rows still in this browser's localStorage and offered
*"Upload 12 items from this device"*. **It was correct and it should never have been a person's
job.** Removed, and the work moved to `absorbThisDevice()` in `store.js`.

🚨 **THE CONDITION IS "CREATED", NEVER "SIGNED IN", AND THAT IS THE WHOLE SAFETY ARGUMENT.**
Somebody making an account is turning the session they have been using into a permanent one, so this
device's rows are theirs by definition. Somebody signing IN is reaching an account that already has
a history, **on a device that may not be theirs at all** — merging a stray browser into it is the
opposite of what they asked for, and `SignInView` has warned about exactly that since it was
written. So `signUpEmail` always absorbs (both of its branches create), and `signInGoogle` absorbs
only when the backend says `created`.

⚠️ **THAT WORD IS NEW AND IT HAD TO BE**, because the three Google branches are indistinguishable
from outside — all of them return `{ user }`:

| branch | what really happened | `created` |
|---|---|---|
| `linkWithPopup` on an anonymous session | the account came into existence | **true** |
| `signInWithPopup`, `getAdditionalUserInfo().isNewUser` | ditto | **true** |
| `signInWithCredential` after `credential-already-in-use` | **that account already existed** | **false** |

The third is the one that matters and the one that looks most like the others: it is reached
*precisely because* the Google account is already registered, and `googleSignInFlow`'s own comment
has said "the anonymous data is what gets left behind" since it was written. **Mutation-checked in
both directions** — flipping the link branch to `false` fails exactly the "linking counts as
creating" assertion; flipping the credential branch to `true` fails exactly the "and it is NOT a
creation" one. Nothing else moved either time.

⚠️ **`getAdditionalUserInfo` is called through `typeof … === 'function'`**, because
`googleSignInFlow` is driven in tests by a fake holding only the two functions it actually calls —
and the safe answer when the SDK will not say is **false**, since guessing wrong merges a stray
browser into somebody's real account.

⚠️ **MOST PEOPLE NEVER COME NEAR ANY OF THIS.** An anonymous account is already a *cloud* account
(D12), so linking preserves the uid and the data comes with it for free. What this covers is rows
written by `LocalBackend` — logged while the cloud was unreachable, or before it was configured.
`adoptLocalData()` already carried those up, but **only on a first connection into a completely
empty account**, so an account that had ever held one row kept the button forever. That is the gap.

⚠️ **MERGE, NEVER REPLACE, AND FAILURE IS SWALLOWED.** `mergeRows` keys by id and keeps whichever
copy is newer, so this can only ever add; running it twice changes nothing. And the account exists
by the time it runs, so throwing would report a successful sign-up as a failure while the local rows
are still safely on the device either way. `auth.uploadLocalData()` is deleted with the button;
`localRowCounts()` survives with **one caller and a different job** — the sign-in screen, where the
rows are about to be left behind and somebody should be told.

### B. THE PROSE: SEVEN BLOCKS BEHIND A "?", TWO DELIBERATELY LEFT IN THE OPEN

Rule 9 is *the ? holds WHY, never WHAT*. Applied to `#/account` and `#/profile`:

**Moved behind a ?** — the demo card's two paragraphs (Tim named this one), the demo *screen*'s
three, the "your data syncs / lives only here" explanation, the import blurb, the note-to-developer
framing, the anonymous screen's "adding an account keeps what you logged", the sign-in screen's
"create an account instead", and Profile's three `WHY` lines.

🛑 **LEFT ON THE SCREEN, AND THESE ARE THE INTERESTING ONES:**

- **Who can see your photo.** *"Shown on your account button, and to the friends you are connected
  to."* Visibility is **WHAT**, and Rule 9's own text records the visibility sheet being left alone
  for the same reason. What went is *"Edit to move or resize the circle"* — and it went to **nothing
  rather than into a popover**, because there is a button labelled Edit eight pixels above it.
- **"Your data — only in this browser."** This module's header says the one thing this screen must
  never do is imply data is safe when it is not. That is not a caveat about a number, it is the
  difference between data that survives losing the phone and data that does not, so it is now the
  **section heading itself** and the advice about what to do went behind the dot.

**Two whole cards were deleted rather than hidden**, which is worth separating from the moves:

- **"Signed in"** — a label and two sentences directly under the avatar card that already prints the
  email. Its content is now the "Your data" ?, so one place says what happens to your data instead
  of two.
- **The demo screen's card** repeated the demo bar `app.js` prepends to *every* screen (*"Demo
  account. Made-up data — change anything you like, nothing is saved"*). It was the third statement
  of one sentence on one screen.

### C. 🔒 SIX ASSERTIONS OPENED THE ? RATHER THAN BEING RELAXED

The same discipline as 2026-09-07: a test guarding a caveat has to find the control, click it and
read the words back, which is **stronger** than the presence check it replaces — the words must be
*reachable*, not merely somewhere in the pane. Converted: the demo card's two, the demo screen's
"starts it over" (plus a new one for "Social is switched off"), and the note's "goes straight to the
person building it".

🆕 **And two new ones for what Tim actually asked for**: no *"Left on this device"* text on a
signed-in account, and no button matching `/^Upload /`. **Asserted on the SCREEN rather than on the
store, because what he objected to was the card.**

⚠️ **One old assertion could not be converted and was replaced honestly.** `and the help text says
what Edit is for` read the sentence that was deleted rather than moved, so pretending it lives in a
popover would have been a lie. It is now two assertions: that the caption still says who can see the
photo, and that the sentence explaining the button beside it is **gone, not hidden**.

### D. ONE CSS RULE, AND THE REASON IT IS SCOPED

`.help-line > .section-label { flex: 1 }` pushes the dot to the right edge, which is right above a
body map or a paragraph — the ? explains the block and the block is the width of the screen. It is
**wrong beside a two-word field label**, where it strands the dot 300px from the word it answers
for. Profile stacks both shapes, and a `<label>` never stretched, so the screen had a dot beside
"GENDER", a dot beside "BIRTH YEAR" and a third at the far edge of "BODY WEIGHT". `.help-line
.by-label` makes the odd one behave like the other two. 🛑 **Deliberately NOT applied app-wide** —
Volume and Goals are the shape the original rule was written for, and Tim did not point at them.

### E. Measured

- ✅ **1,053 render assertions** (was 1,046), **all seventeen suites green** — including
  `tests/sw-update.test.mjs`, which passed this run. ⚠️ **That is one run of a test `progress.md`
  records as flaky on this machine; it is not evidence the flakiness is fixed.**
- ✅ **Browser audit over `#/profile`, 360 and 390 px, both themes: 44 text nodes, zero below 4.5:1,
  zero horizontal overflow, zero unnamed controls.** ⚠️ **The node count was checked first** — the
  2026-09-06 trap. All three new dots come back named, at 26×26 inside the 44px halo.
- ⚠️ **`#/account` cannot be audited in its signed-in form** and never could: the audit runs in the
  demo account, and the demo intercepts that route. What the browser saw is the not-configured
  branch, screenshotted at 393×852 in both themes; the other three variants are jsdom only.
- 🔒 **§0.11 held.** Every edit went through the editing tools, including both mutations and both
  reverts. `git diff --stat` is proportionate to the change in all six files.

---

## 2026-09-07 (fifth pass) — THE MUSCLE OUTLINES: IT WAS THE MASK, NOT THE TRACE

Tim, with five screenshots: *"the lines that outline and define where a muscle is are very bumpy and
don't perfectly outline where the muscle truely is … Some muscle groups are 95% good with tiny
errors, while some others are pretty bad. Is there any way you can make it smoother?"* Lats worst,
then Glutes and Hamstrings; **Chest was near-perfect and was the standard to reach.**

**Run by a sub-agent** on Tim's *"deploy another agent"*, against a named file list, and then
**verified here rather than taken on trust** — see §D.

### A. 🚨 THE CAUSE: `segment()` THRESHOLDS A JPEG, AND THE THRESHOLD WOBBLES

The trace was never the problem. `segment()` decides a muscle's edge with `painted & (rel >= 0.65)`
over a **JPEG**, and that threshold moves one to three pixels row to row — compression ringing
against the black keyline, plus the illustration's **own fibre striations** biting into the edge
wherever one runs out to it. potrace then followed it faithfully.

**The evidence is the masks, dumped before potrace ever runs**: `mask-front-Chest` is a pair of clean
ovals; `mask-back-Back` has a literal staircase down the lower-left of each lat. 🚨 **So Chest was
never better-drawn — its striations run PARALLEL to its outline and never cross it.** That is the
whole explanation for the one muscle that looked right, and it is why no amount of potrace tuning was
going to fix the others.

⚠️ **Two plausible causes were ruled out by measurement rather than argument.** `turdsize` was
already 24 and **no muscle had a stray island** (0 sub-200px components anywhere). `alphamax` was a
real but *secondary* factor: on its own it moved wobble 0.398 → 0.331; the mask fix alone got 0.306,
and adding alphamax on top changed nothing measurable (0.305) or visible. **It was therefore left
alone**, which keeps the diff to one idea.

### B. The fix — `smooth_fills()`, and the one design decision in it

Convolve each fill's indicator with a Gaussian (`SMOOTH = 2.0`) and take the half level. Wobble
shorter than SMOOTH averages away; anything larger keeps its shape, because a low-pass removes an
*amplitude*, not a feature.

🚨 **PER CONNECTED COMPONENT, AND THAT IS THE WHOLE THING.** Blurring a muscle's two halves together
**sums** them across the gap — at sigma 1.1 that fused the left and right glutes into one blob, which
is exactly the anatomy this was forbidden to lose. Taking the **max** across components never can:
measured, the glutes stay two pieces out to sigma 16. The hamstring knee notch, the ab channels and
the sternum gap all ride on this. Winner-takes-all across ids also keeps the result a **partition**,
so neighbours cannot overlap or leave a sliver of bare paper between them.

⚠️ **`seg` ITSELF IS UNTOUCHED, so the ink layer is unchanged** — `img/ink-front.webp` and
`ink-back.webp` regenerate **byte-identical**, and the reconstruction error is identical to the digit.
The fills are smoothed for the trace only.

🔒 **AND THERE IS A GUARD**: each muscle's piece count must be unchanged, counted at `TURD` (the
trace's own floor), or the build exits. ⚠️ **It is not guarding against fusion** — that is
structurally impossible above — **it catches the opposite end**: a piece pinched in two at its waist,
or eroded away entirely.

### C. Measured

| | before | after |
|---|---|---|
| path points, 18 muscles | 1838 | **1160** (−37 %) |
| `js/body-art.js` | 72.8 KB | **52.3 KB** |
| curvature reversals per 100px | 5.90 | **3.68** |
| mean wobble (px from own low-pass) | 0.398 | **0.317** |

Per muscle: Hamstrings 0.516→0.311 · Calves 0.511→0.368 · Quads 0.449→0.320 · Back 0.379→0.271 ·
Glutes 0.409→0.321 · Chest 0.389→0.286. **Whole-render pixel diff: 6,288 of 10,045,970 (0.06 %)**,
every cluster on a boundary.

⚠️ **ONE WENT UP AND IT IS A FIX, NOT A REGRESSION.** back/Traps 0.311→0.318: it used to emit a
single closed curve because a 2,900px region was joined to the outside by a hairline slot, which
potrace traced as a deep inlet. Smoothing closed the slot, the region is now a proper hole, **and a
1–2px stripe of bare paper across the traps is gone.** The hole's boundary is what raised the number.

### D. ⚠️ VERIFIED HERE, NOT TAKEN ON TRUST

- **`git status` shows only `tools/build-body-art.py` and `js/body-art.js`** — the ink webps really
  are unchanged, and nothing was committed by the agent.
- **The tool was re-run from this session and `js/body-art.js` came back byte-identical** (hashed).
  So the file is genuinely generated output and the build is deterministic — the property the demo
  account depends on, applied to the art.
- 🔒 **THE GUARD WAS MADE TO FIRE.** `SMOOTH` set to 4.0 → *"back: smoothing changed Forearms from 2
  pieces to 3. SMOOTH=4.0 is reshaping the drawing rather than tidying it — lower it rather than
  accepting this."* Restored to 2.0 and regenerated back to the identical hash. **A safety rail that
  has never been seen to fire is not a safety rail.**
- **All sixteen runnable suites green** including the art↔standards invariant (every drawn muscle
  rankable or declared unrankable, every rankable muscle drawn with real geometry) — 1,046 render,
  1,870 data-layer, 107 a11y.
- **The before/after screenshots were looked at**, not just the numbers: the lat staircase is gone,
  the hamstring outer edges are smooth **and the knee notch survives**, the traps slot is closed.

### E. Two near-misses the agent reported, and both are worth keeping

🚨 **IT NEARLY SHIPPED THE GLUTE FUSION.** The first smoother blurred each muscle's mask as a whole
and silently merged the left and right glutes at sigma 1.1 — the exact regression the brief named.
**Caught only because it was counting components rather than eyeballing.**

⚠️ **AND IT MEASURED AGAINST THE WRONG `seg` FOR MOST OF THE INVESTIGATION.** `main()` does
`alpha, seg, base = ink_layer(a, seg, lab, body)` — it **rebinds** `seg`, so the traced mask has never
been the raw segmentation. A scratch harness had cached the pre-ink copy, so early "topology
unchanged" results described a different mask from the one the tool traces. **The new guard is what
caught it**, by firing on the real pipeline while the cache said nothing was wrong. Every number
above was re-derived from the real generated file afterwards. **This is the §0.14 lesson in another
costume: a check that passes is only evidence once you know what it ran against.**

---

## 2026-09-07 (fourth pass) — THE WORDINESS, MEASURED, AND THE "?"

Tim opened the topic `docs/direction.md` §4 had parked (*"the app's voice and wordiness … he would
talk about it later"*): *"analyze everywhere in the cite where it has sentences longer than maybe
10-15 words and really think about if every single word in that sentence is important … With
paragraphs, if it's explaining something, I think it's best to have a little question mark somewhere
near the thing that it's explaining … when you touch it it opens a mini box."*

🛑 **THE STANDING "DO NOT SHORTEN COPY GLOBALLY" IS THEREFORE LIFTED — BY HIM, ON THIS TOPIC.** It is
not a licence to sweep: he asked for the analysis first, and the analysis is the deliverable this
section exists to record.

### A. 🚨 THE MEASUREMENT, BECAUSE NOBODY HAD EVER TAKEN ONE

A scanner over `js/*.js` that strips comments (this codebase is more comment than code and none of it
is user-facing), pulls the string literals that are prose, **joins the ones built by `+`
concatenation** — most long copy here is written that way, and measuring the halves separately
reports every paragraph as a set of short lines — and ranks by longest sentence.

| | |
|---|---|
| User-facing words in the app | **18,631** |
| Sentences over 15 words | **304** |
| Blocks of 40+ words | **63** |
| Longest single sentence | **46 words** (`views-import.js`, the weight-unit refusal) |

**Where they are, worst first:** `research-topics.js` 54 · `preset-systems.js` 37 · `views-goals.js`
30 · `views-data.js` 28 · `views-social.js` 24 · `views-account.js` 19 · `progression.js` 16 ·
`goals.js` 16 · `views-workouts.js` 13 · `compare.js` 12 · `views-session.js` 11.

⚠️ **THE TOP TWO ARE A DIFFERENT KIND OF THING AND MOST OF THE LIST IS NOT THE APP'S VOICE.**
`preset-systems.js` is per-exercise coaching notes transcribed from other people's programmes —
shortening those edits somebody else's writing. `research-topics.js` is teaching content that already
has word budgets asserted in `tests/data-layer.test.mjs` (45 words an answer, 48 a bullet, 260 a
topic). 🆕 **Tim said so himself, mid-session**: *"the research section is extreamly wordy and while
I do think we need to make the descriptions in that section more clear, we should allow it to
describe that section sufficiently."* So Research's framing was shortened and its topics were not
touched.

### B. 🚨 THE FINDING: THE PROBLEM IS NOT LENGTH, IT IS THAT CAVEATS AND NUMBERS HAVE EQUAL BILLING

Reading the worst offenders back, almost none of them are padded. They are *explanations* — and this
app has a standing rule that every caveat is stated on screen, which is right and is why nothing here
deletes one. What the rule never said is **where**. So the Volume screen ended as a body map, the
reader's own numbers, and then **five stacked paragraphs of ~150 words** explaining them — prose that
is identical on every visit sitting under numbers that are the only thing that changes.

**The ? is the answer to that, and the rule it introduces is one line:**

> 🔒 **THE ? MAY HOLD *WHY*, NEVER *WHAT*.** If a sentence changes what the reader thinks the number
> IS, it stays on the screen. If it explains where the number came from, what it cannot see, or why
> it is drawn that way, it goes behind the ?.

`helpDot()` in `js/ui.js`: a 26px dot in a 44px target, opening a popover positioned against it and
clamped to the screen. **A popover rather than a sheet, deliberately** — a sheet covers the thing
being explained, which is the context somebody tapping "?" is trying to keep. Escape closes it, a tap
anywhere closes it, opening a second closes the first, focus returns to the dot.

### C. What was converted, and what it cost

| Screen | Before | After |
|---|---|---|
| **Data → Volume**, the notes | 5 paragraphs, ~150 words | one 18-word line + ? |
| **Data → Volume**, short window | 56 words | 12 words + ? |
| **Goals**, the on-track refusal | 3 sentences, 45 words | 8 words + ? |
| **Goals**, why stalls are invisible | 2 paragraphs, 79 words | 22 words + ? |
| **Settings**, findable by name | 51 words | 14 words + ? |
| **Research**, the section blurb | 48 words | 10 words + ? |
| **Friends**, who can see you | a 48-word sentence | **a list** — see below |

🚨 **THE VISIBILITY SHEET GOT NO ? AND THAT IS THE INTERESTING ONE.** What a stranger can see about
you is WHAT, not WHY, and a reader deciding whether to be public must see the whole answer without
asking for it. What changed there is the **shape**: seven things buried in one sentence became seven
list items. Same facts, none hidden, far less to read — the *"formatting it in a way that is improved
and less intimidating"* half of the ask rather than the shorter half. **Not every wordy thing wants
a ?**, and this is the example that proves it.

### D. ⚠️ THE TESTS THAT GUARD THE CAVEATS ALL FAILED, AND THEY WERE RIGHT TO

Six assertions exist precisely to stop a caveat being deleted — warm-ups counted, "not a measured
fact", "no target line", Core understated, no verdict, "bad Tuesday". Moving the words behind a ?
broke every one.

🔒 **THEY WERE NOT RELAXED. THEY NOW OPEN THE ?.** That is a *stronger* check than the one it
replaced: it used to be enough for the words to exist somewhere in the pane, and now they have to be
reachable by the control a reader would actually use. **A ? that stopped opening would fail here,
where before it could not.** The facts that stayed on the screen are asserted unopened, first,
because the split between the two is the whole design.

### E. What was checked

- **1,046 render assertions** (was 1,033), sixteen suites green. Eleven of the new ones pin the
  control itself: it is a real `<button>` with an accessible name (a bare "?" reads as nothing to a
  screen reader), Escape closes it, an outside tap closes it, a second ? closes the first, and
  tapping the same one twice closes rather than reopens.
- **Driven at 393×852**: the box opens **above** the dot when there is no room below, its arrow
  points back at it, and it stays on screen.
- ⚠️ **The dot was measured at 4.52:1 in the light gold palette** — a pass with nothing spare, on a
  13px glyph that is a control's entire label. Moved from `--ink-faint` to `--ink-soft`.
- ⚠️ **The Volume box measures 525px tall** on an 852px phone — fine, and one paragraph from not
  being. It is now capped at 62dvh and scrolls inside itself.

### F. What is left, and it is most of it

**Seven places converted out of ~63 paragraphs and ~300 long sentences.** The mechanism, the rule and
the test pattern exist; the rest is a screen at a time and Tim should point. The ranked list in §A is
the queue. 🛑 **Do not sweep it** — he asked for the analysis first, and the two files at the top of
the list are the two that should not be swept at all.

---

## 2026-09-07 (third pass) — THE BIN ON THE BAR

Tim, having read the flag raised when the bar shipped: *"right now the workout pull down is perfect.
Just add a trash can on the right side of the box that delets the workout if the user clicks on it."*

**Built.** 52 × 56 px on the right of the bar, behind its own hairline, `aria-label` naming the
workout.

⚠️ **IT ASKS FIRST WHEN THERE IS SOMETHING TO LOSE, AND ONLY THEN — and that is the rule the app
already had rather than a hedge on the instruction.** Removing a person from a workout confirms when
sets are recorded for them and goes quietly when none are; the save screen's Discard does the same.
A one-tap delete here would have been **the only unconfirmed destructive control in the app**, and
the one that sits a few pixels from the Home tab for the length of a workout. **With nothing recorded
it simply goes** — that half is asserted too, because a bin that always asked would pass every
assertion about the confirm and be worse to use.

🚨 **THE BIN IS A SIBLING OF THE LINK, NEVER INSIDE IT.** The bar was one `<a>`; a `<button>` inside
an `<a>` is invalid HTML that browsers recover from differently, and the one thing that must never be
ambiguous on this control is whether a tap opens the workout or deletes it. It is now a `<div>`
holding an `<a class="session-mini-open">` and the button, with an assertion pinning that
relationship. **Measured: 52 × 56, not inside the link, and the link keeps 341 px of the 393.**

### ⚠️ AND THE RECORDED-SET RULE FINALLY HAS ONE HOME

`setIsRecorded` — *was this set really performed, or is it a number the app filled in* — was a
closure inside `SessionView`, which was right while the runner was the only thing that had to answer
it. **Four callers now do**: the save screen (how much is about to be written), the conflict screen
(how much starting another workout would destroy), this bin (how much a tap would delete), and the
save path's own filter. It lives in `js/session-draft.js` with `hasNumbers` and a
`draftRecordedSets(draft)` that walks guests too. **Three copies of "was this set performed" is the
shape of thing this project deletes functions over** — the same argument that killed
`benchmarkComparison()` on 2026-09-06.

**Checked:** 1,033 render assertions (was 1,025), sixteen suites green. Mutation-checked — forcing
the bin to skip the confirm flips exactly the three assertions about it. Driven at 393×852; contrast
on the bar re-measured in both themes and all four palettes, unchanged at worst 9.25:1. ⚠️ **A 4px
right padding left the elapsed time reading as though it touched the bin's hairline**; it is 12px.
🚨 **`tests/sw-update.test.mjs` is still the flaky one from the second pass** and was not re-run
against this change — it is unrelated and pre-existing, and the control for it is recorded there.

---

## 2026-09-07 (second pass) — THE SAVE SCREEN, AND WHAT A PHOTO WOULD COST

Tim, with Hevy's save screen: *"Instead of putting the description and location at the top of the
cite During a workout, put all that information as an option after the workout is finished, and then
the user can post the workout."* And a question beside it: *"I also want to come back to adding a
picture to the cite. Is that a possibility? How would that change storage with our free system if
every user posted a pic for every workout?"*

### A. What shipped

**Finish no longer saves.** It opens a save screen — the workout's name, **Duration · Sets ·
Exercises**, a description box, a gym box, the day, and a discard — and the **Save workout** button
there is what writes. The description and location chips are gone from the runner's header.

🚨 **THE ORDER IS THE WHOLE CHANGE, AND IT IS WHAT MAKES THE FEATURE POSSIBLE.** The old note in
`views-session.js` argued the description had to live in the runner *because the finish screen
renders after `store.saveSession()` has already landed* — a box there would be describing a row that
was already on disk and would need a second write to attach itself. That reasoning was correct and
the fix was to move the boundary rather than the box: the save screen renders **before** anything is
written, so the fields describe a draft, and Finish is still one write.

⚠️ **The draft is untouched the whole time**, so the safety story is exactly what it was — asserted
directly, because "when does this app write to disk" is not a thing to change on a promise.

⚠️ **AND `saveError` MOVED WITH THE BUTTON.** It lived in the runner's DOM, which was right while
Finish was tapped from the runner and would have re-created the 2026-08-22 bug from here: a save that
failed would have written its explanation into a screen nobody was looking at, and Save would have
appeared to do nothing. There is now an assertion that the message lands **on the save screen**.

**Three deliberate departures from Hevy's screen, each for a reason this project already had:**

- **Sets and Exercises where Hevy has Volume in pounds.** `js/session-stats.js` already argues it for
  the feed card — a session of pull-ups has no external load to total — and Tim asked for a set count
  instead of volume in so many words.
- **No Visibility row.** Visibility is a property of the ACCOUNT (D29) and a per-workout flag is an
  open question Tim owes a decision on; putting the row here would decide it by building it.
- **No workout-title field and no Apple Health row.** Neither exists in this app.

⚠️ **The day is editable in BOTH places, which is normally this project's definition of a bug.** The
objection to two controls is drift and there is none — both read and write `state.date`, both
re-render from it, and they are never on screen together. The header one earns its place by saying
NOT TODAY the whole way through a back-dated workout rather than at the end of it; this one earns its
place by making the screen a true summary of what is about to be written.

**Discard** is the first "throw a workout away" control on the normal path. It is below everything
and **not** in `.pane-bottom`, because that is where the thumb already is on every other screen, and
it confirms with the count it is about to delete.

### B. 💷 CAN WE ADD PHOTOS, AND WHAT WOULD THEY COST

**Yes, but not on the free plan, and the binding number is not storage — it is EGRESS.**

⚠️ **Everything below is arithmetic on stated assumptions.** The per-photo size is a property of what
the app would choose to upload; the prices are Google's and were last confirmed **2026-09-01**.
🛑 **Re-confirm before re-quoting any of them.**

**1. It needs Blaze.** Cloud Storage for Firebase requires a billing account — `docs/social-plan.md`
§13 step 9 already said photos were the one step blocked on it, and Open work 10 says the same about
Cloud Functions. **This is the same decision Tim has already parked twice**, and it is his.

**2. Firestore is not a way round it.** The app already stores an image in Firestore — the 256px
avatar, ~4 KB in the settings document. A workout photo is 30–50× that; a Firestore document is
capped at **1 MiB**, base64 adds ~33 %, and `readShard()` re-reads collections on every cold open, so
photos in Firestore would multiply the one cost the 2026-09-06 analysis identified as 81 % of the
bill. **Not a shortcut — a much worse version of the existing problem.**

**3. The numbers, at ~200 KB a photo** (1080px longest edge, quality ~0.75 — the app already
client-resizes avatars, so the machinery exists):

| | storage | what actually bills |
|---|---|---|
| One user, one photo per workout, 4/week | **41 MB a year**, forever | — |
| 1,000 users | 41 GB/yr → **~$1/month and rising** | see below |
| 10,000 users | 416 GB/yr → **~$11/month and rising** | see below |

🚨 **STORAGE IS THE CHEAP HALF. THE BILL IS PEOPLE LOOKING.** Egress is ~$0.12/GB, and a photo is
downloaded once per person who sees it. With long cache headers (photos never change, so this is
free to do):

- **1,000 users, ~20 friends each**: 1,000 × 208 photos × 20 viewers × 200 KB ≈ **832 GB/yr ≈
  $100/yr** — about what the whole app costs today.
- **10,000 users, ~50 friends each**: ≈ **20 TB/yr ≈ $2,500/yr.**

🚨 **AND THE AUDIENCE IS NOT BOUNDED BY THE FRIEND LIST, BECAUSE OF D29.** Accounts are **public by
default** — anybody signed in can read them — so "how many people see this photo" has no ceiling in
the model above. One post that circulates is the case where this stops being predictable, and
⚠️ **the 2026-09-06 analysis found there is no hard spending cap for Firebase**: alerts lag up to
days and the only true stop deletes the project.

**4. What would keep it cheap, if he wants it:** resize hard on the client (the crop machinery in
`js/image-crop.js` already does this for avatars), one photo per workout, long `Cache-Control`, and
thumbnails on the feed with the full image only on the workout screen — that last one alone is most
of the saving, because the feed is where the views are.

✅ **THE ONE THING RAISED UNPROMPTED, AND IT IS THE EXCEPTION TIM GRANTED** (`docs/direction.md`
§3.4 — say so when a decision now would be expensive to undo once moderation exists): **photos are
user-uploaded content on an app whose accounts are public by default, and this project has no
reporting, no blocking and no moderation.** Text notes are already that, but a picture is the version
that gets an app removed from the App Store. **Not an argument against photos — an argument that
blocking and reporting land first.** Nothing was built either way.

### C. What was checked

- **1,025 render assertions** (was 1,004), sixteen suites green.
- 🚨 **`tests/sw-update.test.mjs` IS FLAKY ON THIS MACHINE RIGHT NOW, AND IT IS NOT THIS CHANGE.**
  It failed 5 of 6 runs, the root failure always *"the service worker takes control on the second
  load"* with everything downstream falling with it. ⚠️ **The control was run**: `git stash`, three
  runs on the committed baseline, **4 / 4 / 1 failures** — so it fails identically without any of
  today's work. It passed cleanly twice earlier in the same session, no stray Chrome or python
  process was holding a port, and nothing in this change touches `sw.js` beyond the two module names
  added in the first pass. **Recorded rather than chased**; do not read a green suite list today as
  including it. *"It was probably already there"* is the sentence this project bans, which is why the
  control was measured rather than assumed.
- **Mutation-checked**: pointing Finish back at `finish()` takes the save-failure assertions down
  with it, and inverting the count assertion proves it is measuring a real before/after.
- **Driven in headless Chrome at 393×852**: walk a demo workout to the end, Finish, read the summary
  (Duration · Sets · Exercises), type a description and a gym, Save, land on the finish screen with
  the draft cleared. Nothing overflows.
- ⚠️ **The duration read "0 min" for a sub-minute session** in that run and now reads seconds. A
  number saying nothing happened, on the screen summarising what did, is the kind of small wrongness
  that makes a reader distrust the figures beside it.

---

## 2026-09-07 — PUT A WORKOUT DOWN AND PICK IT BACK UP

Tim, with three Hevy screenshots: *"I want the user to be able to 'leave' a workout and interact with
the rest of the cite and then come back to the workout at any time … instead of having the X in the
upper left cornour, it has a down arrow … while you move around the cite, if a workout is currently
running, it will appear as a box right above the main bars (home, data, record, etc) with an up
arrow, and if you click on the up arrow it brings you back inside the workout."*

⚠️ **The third screenshot is Hevy's SAVE screen and is not part of this** — he said so himself and
said he would come back to it. Nothing on that screen was touched. 🛑 **And the screenshots stay out
of the repository** (§9, and `docs/social-plan.md` §12.12): this repo is public and they are somebody
else's UI.

### A. 🚨 THE DRAFT ALREADY SURVIVED LEAVING. WHAT DID NOT EXIST WAS THE WAY BACK

This is the thing worth carrying out of the session. Every set has gone to `ftrack:v1:draftSession`
since the runner shipped, and starting the same workout again on the same day has always resumed it
— **the feature Tim asked for was, in the data, already built.** What was missing was any way to
believe it:

- the only door back in was that workout's own row in the Record picker,
- the only statement that the door existed was one sentence inside the confirm sheet you got on the
  way out — *"Your progress is saved as a draft"* — which is a thing you read once, while leaving,
  in a dialog with a Cancel button on it.

**So the app kept the workout and looked exactly as though it had thrown it away.** A capability
nobody can see is not a capability, and the fix was almost entirely a matter of saying so.

### B. What shipped

1. **The ✕ is a ▾, and it asks nothing.** The confirm sheet is gone — a question with a Cancel button
   is the app saying this might cost you something, and nothing is at stake. It goes back through
   history rather than to `#/home` (Rule 8): you reach the runner from the picker, from a workout's
   own screen or from a deep link, and the arrow means the screen you were on.
2. **A bar above the nav, on every screen, for as long as the workout is open** — `js/live-session.js`.
   The workout's name, the elapsed time, the exercise you are on, and an up arrow that is the mirror
   of the ▾ that put it there.
3. **`js/session-draft.js`** — `saveDraft`/`loadDraft`/`clearDraft` and the same-day rule, moved out
   of `views-session.js` unchanged. The bar has to answer "is one open?" on every screen and cannot
   import the runner: the runner is the screen the bar exists to get back to, and pulling it in for a
   two-line pill would drag the exercise picker along behind it.

⚠️ **THE BAR IS IN THE LAYOUT, NOT FLOATING OVER IT**, and this is the one structural decision.
`.update-bar` is `position: fixed` and can be — it is transient. This one is up for the length of a
workout, and fixed would put it permanently on top of `.pane-bottom`, which is where "Save changes"
and "Finish" live on every screen that has one. It is appended as **the last child of `.screen`**,
which is the bottom of the content area on the phone's `column-reverse` layout *and* beside the
desktop sidebar — a sibling of the navbar would have been above the nav on one and a third column on
the other. **Measured at 393×852: the bar occupies 741–798 and the navbar's top edge is 798**, and on
a fullscreen route it sits at 795–852 against a 852 viewport. On every route the scrolling pane ends
exactly where the bar begins, so nothing is ever underneath it.

### C. 🚨 AND IT UNCOVERED A WAY TO LOSE A WORKOUT, WHICH IS NOW SHUT

`SessionView` opened with `if (rawDraft && !existingDraft) clearDraft()` — **starting any other
workout deleted the one in progress, silently, with no screen mentioning it.**

⚠️ **That was defensible right up until this session and is not any more, and the reason is the
feature itself.** Reaching it used to take a deliberate departure through a sheet and then a
deliberate start of something else. With a bar on every screen advertising that a workout is open,
**it is a stroll**: Record, tap the next workout, twelve sets gone. A feature that makes a hazard
easy to reach owns that hazard.

So a second workout now meets a screen that **names the open one, says how many sets are in it, and
offers both real answers** — *Back to Push* as the primary, and a quiet *Discard it and start Pull*
which then confirms. ⚠️ **The destructive one is deliberately NOT in `.pane-bottom`**: that is where
the thumb already is on every other screen in the app, and a Discard sitting in that muscle memory is
how somebody deletes the workout they meant to go back to. ⚠️ **A draft with nothing recorded in it
is still replaced without a question** — there is nothing to lose, and a question about nothing is
how people learn to tap through questions.

⚠️ **The set count it quotes is the SAVE PATH's definition of recorded**, prefill and all, so it is
honest about what would actually be lost — which on a workout with history is every planned set
carrying last time's numbers. That is Open work 15's half-fixed prefill behaviour showing through,
not a new claim, and it is still Tim's call.

### D. What was checked

- **1,004 render assertions** (was 982), all seventeen suites green.
- **Mutation-checked, three ways, and one of mine was passing for the wrong reason.**
  - Reading `entries[index]` instead of walking `stepsFor` flips exactly the superset assertion —
    the fixture is a two-member superset at **step 3**, where the answer is entry 0 and `entries[2]`
    does not exist. At step 2 both readings agree, which is why that case alone would have proved
    nothing.
  - Making the bar skip the same-day rule flips exactly the "yesterday's draft" assertion. Removing
    the rule from `liveDraft` itself takes an *older* block of the suite down with it, which is a
    fair reading of how load-bearing it is.
  - Restoring the silent wipe flips four. ⚠️ **And it caught a weak assertion of mine**: *"nothing
    was thrown away while the question was asked"* read `Boolean(loadDraft())`, and the wipe writes a
    fresh draft for the workout you just opened — so something is always on disk. It now asserts the
    draft is still **Push A's**. §0.14 is about mutations landing on comments; this is the same
    family — *a mutation that fails to flip an assertion is telling you about the assertion.*
- **Driven in headless Chrome at 393×852**, in the demo account: start Push, type 135×8, tap ▾, land
  on Home with the bar up, walk to Data / Calendar / Workouts / Settings / Account / Profile with it
  in place on every one, tap it, and arrive back inside the runner with **135 and 8 still in the
  fields** and the bar correctly absent.
- **Contrast measured on the bar itself, in both themes and all four palettes — worst 9.25:1**, and
  the tap target is the whole 393×57 pill. ⚠️ **The standing audit cannot reach this control**: it
  only exists while a draft does, and the audit never starts a workout. That is why the numbers were
  taken here rather than left to the next sweep.

### E. ⚠️ AND I BROKE §0.11 AGAIN — THE FOURTH TIME IN THIS PROJECT

A mutation check was applied to `js/live-session.js` with `Get-Content -Raw` piped through
`Set-Content -Encoding utf8`, which is **exactly** what §0.11 forbids: PS 5.1 decodes as ANSI, so
every em dash and ⚠️ in the file was double-encoded — `E2 80 94` became `C3 A2 E2 82 AC E2 80 9D`.
Caught by inspecting the bytes, and the file was rewritten through the editor.

🚨 **The interesting part is not that it happened, it is what it happened FOR.** Every previous
instance was a bulk edit of prose. This one was a **one-line, deliberately temporary code change I
intended to revert in ninety seconds** — the exact case that feels too small to open an editor for.
⚠️ **A mutation check is the most dangerous place in this workflow to reach for a script**, because
the edit is designed to be thrown away, so nobody diffs it afterwards; a revert that "puts the line
back" restores the line and leaves the encoding damage in every other line of the file. The rule
already said "keep scripts for running things". **It needs no exception for temporary edits, and the
temptation is strongest exactly there.**

### F. Left alone on purpose

- 🛑 **No discard control on the bar.** Hevy has a trash icon on it; Tim described the arrow and did
  not ask for one, and a one-tap delete for a live workout sitting under the thumb on every screen is
  not something to add unasked. The discard that exists is on the conflict screen, beside a count of
  what it would destroy. **Raised with him, not built.**
- 🛑 **The Record picker does not say "Resume" on the open workout's row.** The bar is on that screen
  too, saying the same thing more loudly. Not asked for.
- 🛑 **Two workouts open at once.** That is a second draft key and a second thing to explain, and
  nobody asked for it. The app says "one at a time" on the conflict screen rather than implying it.

---

## 2026-09-06 (fifth pass) — 🚨 THE COST ANALYSIS, AND THE READ PATTERN IS THE WHOLE BILL

Tim asked for the cost analysis `docs/direction.md` §2 had parked behind *"only if he asks"*, with two
conditions: *"open it up to a range of possibilities and make a display for me to read it all in."*
Delivered as an artifact:
**https://claude.ai/code/artifact/9bc624aa-45b9-4f81-8e19-0b793e3e3742**

⚠️ **Prices were confirmed live on 2026-09-01 and will drift. The MEASUREMENTS below are the durable
half** — they are properties of this code, not of Google's price list.

### A. 🚨 THE FINDING: COST SCALES WITH A USER'S HISTORY, NOT THEIR TRAINING

**Measured with the app's own `firestoreDocBytes()` over the demo year, not estimated:**

| | measured |
|---|---|
| One session document | **2,072 bytes** |
| A year of training (209 sessions) | **440 KiB** |
| Saving a workout | **1 document write** (`shardDiff` — writes are never the problem) |
| **One cold app open** | **10 reads + EVERY session document + 2 per friend** |
| First visit per device, from Pages | 920 KiB gzipped, then cached forever |

🚨 **`readShard()` does `getDocs()` on the whole sessions collection every cold start.** So somebody
three years in costs three times what they cost in year one **for doing the same amount of
exercise**, and it never levels off. A committed five-year user is 91,000 reads a month on their own.
**The most loyal users become the most expensive.**

⚠️ **Offline persistence IS already enabled** (`persistentLocalCache`) and does not help: a plain
`getDoc`/`getDocs` goes to the server anyway and is billed per document returned. The 2026-08-22 note
about nav lag already said this out loud — *"a `getDoc` waits for the SERVER even with offline
persistence enabled"* — and its cost consequence was simply never followed through.

**What it is worth, on a blended population (55 % casual/new, 30 % two years, 15 % committed/four
years):**

| read pattern | free tier lasts to | 10 k users | 1 M users |
|---|---|---|---|
| **today** — whole history | **~94 users** | $132/mo | $13,497/mo |
| windowed to 16 weeks | ~544 users | $20/mo | $2,302/mo |
| **only what changed since last sync** | **~1,894 users** | **$4.65/mo** | **$643/mo** |

**~20× at every scale, from one change.** Reads are **81 %** of the bill at 10 k users and bandwidth
another 18 % — and both have the same root cause, because re-reading a history is what generates the
reads *and* sends the bytes. 🛑 **Recorded as a finding, NOT queued** — nobody asked for it.

### B. The rest of the money, which is nearly all zero

- **$110/year, total, today**: Apple $99 + a .com at $11.08 (Porkbun, flat renewal). **GitHub Pages
  is $0 and cannot bill** — it degrades and emails; it has no metered overage at all. **Basic
  Firebase Auth is $0 with no ceiling** for email, Google, Apple and anonymous.
- ⚠️ **Below ~1,000 users the fixed cost IS the bill.** The servers round to nothing and the Apple
  account is the entire expense.
- ✅ **The ceiling Tim set is now a number**: revenue must not exceed **$110/yr** today, or about
  **$1,700/yr** even at ten thousand users on the current code.

### C. 🛑 Four traps, all confirmed from source

1. **THERE IS NO HARD SPENDING CAP ON FIRESTORE.** Google shipped native spend caps on 2026-07-28 —
   and **Firestore, Auth and Identity Platform are not eligible services**. Budget alerts are alerts
   only and can lag **up to a few days**. The only real stop is a Pub/Sub script that deletes the
   billing account, which takes the whole project down and *"resources might be irretrievably
   deleted."*
2. **Region is a silent 2× and cannot be changed after the database is created.** Multi-region is
   exactly twice single-region on every operation. ⚠️ **Which one `fitness-tracker-th` is on was not
   checked** — worth knowing before it matters.
3. 🚨 **NEVER OPT INTO IDENTITY PLATFORM, and this app is unusually exposed.** Basic Auth is
   unlimited and free; the upgrade bills per monthly active user (free to 50 k, then $0.0055) — and
   **anonymous accounts count as billable actives unless auto-cleanup is on.** D12 makes this app
   anonymous-FIRST, so every abandoned browser profile would be a line item.
4. **Ads are a worse fit than they look.** Apple 2.5.18 forbids behavioural advertising on health
   data, which is most of what this app knows; 3.2.2(iii) refuses apps built predominantly around
   ads; and GitHub's own AUP is hostile to ads while **explicitly permitting donation buttons.**

### D. A correction to `docs/direction.md`

**Guideline 4.8 no longer names Sign in with Apple.** It is now "Login Services", a capability spec —
and **the obligation is triggered by offering Google sign-in at all**. Anonymous accounts and the
app's own email accounts trigger nothing. Corrected in place. Also recorded there: a free app with no
IAP pays **no commission at any revenue level**, and the uncosted requirement is a **Mac**.

### E. ⚠️ What was deliberately NOT put in the model

**No ad revenue figure.** Google publishes no vertical RPM benchmarks and every number available is
ad-mediation vendor marketing. Four prices could not be read off a source page — Firestore's regional
and European **storage** rates, and Apple's **GBP** fee among them — and are flagged in the artifact
rather than filled in from memory. **None of them change a conclusion**; the regional storage one
would only make the cheaper column cheaper.

---

## 2026-09-06 (fourth pass) — THE KG BUG, A COMMENT THAT WAS LOAD-BEARING, AND ONE NEW EXERCISE

Tim: *"fix the kg bug. I'm not really sure what needs fixing with the comments and knee push up, but
whatever you think should be done, do it."*

### A. 🚨 THE WHOLE WEIGHT CHART WAS IN POUNDS FOR A KG USER, NOT JUST THE READOUT

Reported as the hover readout printing `205 lbs`. **It was bigger than that.** Two separate places,
and the second was the one that mattered:

- `fmtField()` in `js/ui.js` read `FIELD_META.weight.unit`, a hard-coded `'lbs'`, and printed the
  stored pounds figure raw.
- 🚨 **The chart's Y AXIS did the same thing with no unit at all** — every gridline label was the
  pounds number. So a reader on kg saw their bench charted as 205 while the set list, the muscle
  panel and the record screen all said 93.

⚠️ **THE SHAPE OF THE CHART WAS RIGHT, WHICH IS WHY NOBODY WOULD NOTICE.** The line rises when you
get stronger either way; only the words down the left-hand side were wrong. **A number in the wrong
unit is not a smaller error than a wrong number — it is a wrong number with a plausible alibi.**

**Fixed at the display edge in both places.** ⚠️ **Only the labels convert, never the geometry**, and
that is exact rather than a shortcut: pounds→kilograms is a pure scale with no offset, so every
gridline stays on the pixel it was already on and only its name changes. The decimal-place
derivation moved to the *converted* gap — in kg the same span is 2.2× smaller, so a step that earned
whole numbers in pounds can need a decimal, and the old derivation would have printed two adjacent
gridlines with the same number on them.

✅ **A workaround was DELETED rather than left standing**: `views-data.js` had been bypassing
`fmtField` for weight, with a comment explaining that FIELD_META hard-codes lbs. Fixing the source
makes the branch a fossil that says the bug is still there.

⚠️ **Mutation-checked, and it is the kind of bug nothing else here could catch**: the number was
right, the chart was right, the app was internally consistent with its own storage, and **this suite
has always run in pounds.** Only a reader on kg would ever have seen it.

### B. A COMMENT THAT WAS DOING REAL WORK, AND WAS DOING IT WRONG

`js/exercises.js` gave the Incline Push-Up's exclusion as *"the app does not record the height, and
41 vs 55 is not a rounding difference."* 🚨 **That states a problem the app can SOLVE** — two library
exercises, one per box height, and the objection is gone. **A session read it and set out to build
exactly that.**

The binding reason was two bullets further down, under the decline: Ebben's figures are **peak
dynamic ground-reaction forces**, a different basis from the static 75 % this file uses. Corrected,
along with the Inverted Row entry, whose stated reason ("the app records no bar height") describes a
field **that would not help if it existed** — the varied parameter is body angle — and whose source
turns out to be a predatory unindexed journal.

🚨 **THE RULE, WORTH MORE THAN THE TWO ENTRIES: A RULE GUARDED BY ITS WEAKEST REASON GETS OVERTURNED
BY WHOEVER SOLVES THAT REASON.** State the binding one first. The same correction went into
`tests/bodyweight.test.mjs`'s `MUST_STAY_UNRANKABLE`, which had been carrying the weak wording too —
so the test that exists to stop somebody filling these in was itself pointing at the wrong obstacle.

### C. 🆕 THE KNEE PUSH-UP — one exercise, and the only variant that could be admitted

`{ fraction: 0.62, q: 0.70, basis: 'measured' }`, ratio 1.35 at quality 0.30.

- **It is admitted for the reason the rest of the family is refused: no mixing.** Suprak 2011
  measured it **on the same plate, with the same 28 men, in the same static down position** as the
  push-up's 0.75 — so the two are directly comparable, and a knee push-up sits below a full one
  because it is genuinely lighter rather than because two labs disagreed.
- **`q` is the push-up's own 0.70, unchanged.** The uncertainty priced there is the judgement about
  *which published quantity belongs in a strength estimate*, and it is the same judgement — not a
  second guess stacked on the first.
- ⚠️ **The RATIO is carried, not calibrated, so its quality drops to 0.30.** There are no published
  knee push-up standards to fit against. §0h's lesson is exactly this: **the worst entries in that
  table were the ones somebody had reasoned about.**
- 🚨 **THE ORDERING WAS DRIVEN, NOT REASONED.** At 180 lb it estimates **104 / 117 / 133 lb** of bench
  at 6 / 10 / 15 reps against a full push-up's **124 / 140 / 158** — strictly below at every rep
  count the app will accept as evidence. **Mutation-checked** by inverting the ratio, which flips it
  at all four. Getting this backwards would rate a beginner above somebody stronger, which is the
  class of inversion §9 records as the worst defect this ranking model has ever had.
- **Why it is worth an exercise at all**: it is the most likely FIRST chest movement anybody logs,
  and the map was grey for exactly the people with least reason to trust the app yet.

⚠️ **THE RATIO'S DIRECTION WAS NEARLY GOT BACKWARDS.** `estimate = raw / ratio`, so a *larger* ratio
gives a *smaller* bench equivalent. Reading it the other way made a 6-rep knee push-up look like a
189 lb bench and nearly killed the whole idea as obviously unsafe. **Checked against the arithmetic
before anything was written.**

---

## 2026-09-06 (third pass) — THE FOLLOW-UPS, AND A RESEARCH ANSWER THAT KILLED ITS OWN TASK

Tim, asked what was next and given a ranked answer: *"alright do all of those that you just
mentioned."* Three agents on disjoint file sets again; tests, integration and both audits mine.

### A. 🚨 THE RESEARCH SAID NO, AND THE HANDBOOK'S OWN DIAGNOSIS WAS THE THING THAT WAS WRONG

§9 had said, of the inverted row and the incline push-up: *"measured, but the app lacks the
parameter… **adding the parameter is the fix, not adding a number**."* **That sentence sent this
session off to design a hand-height field.** `docs/research.md` §15 is the pull, graded 🔴:

- **The incline push-up's 41 % / 55 % ARE two named, pickable box heights** (Ebben 2011, 12in and
  24in). **So the parameter was never the obstacle.** 🚨 **They measure the wrong quantity**: the same
  table gives a regular push-up as **0.64**, the exact figure `js/exercises.js` already rejects,
  because Ebben measures *peak dynamic ground-reaction force* and this app's 0.75 is Suprak/Mier's
  *static down position*. Shipping them would score one movement 0.75 / 0.55 / 0.41 where part of the
  first step is **the definition changing rather than the exercise**.
- **The inverted row's parameter is BODY ANGLE, not bar height.** Nobody has measured one at a bar
  height. Melrose & Dawes give four angle anchors — unusable (nobody self-reports their angle from
  under a bar; 45° vs 60° is fifteen points) — and ⚠️ **the journal is SciTechnol/OMICS: predatory,
  unindexed, no PMID.** The 37–79 % this handbook has quoted for weeks traces to it.
- **Bench dip: nothing at any position**, now recorded as checked rather than assumed.

🛑 **Nothing was built and §9 was corrected instead.** ⚠️ **One lead, deliberately not acted on:**
Suprak 2011 measured a **knee push-up on the same plate, same 28 subjects, same static down position
— 61.80 %.** Right quantity, source already cited, no new parameter. It needs a new library exercise
rather than a table row, and nobody asked for it. §15.7.

**The lesson is about the shape of the note, not the exercises.** A `⚠️` bullet that names a *fix*
gets acted on; this one had named the wrong fix and sat there long enough to be believed. **A stated
diagnosis is a claim and ages like one.**

### B. Custom exercises can borrow a ratio — because the person NAMES it

2026-08-31 took the strength level off custom exercises after a made-up "Dip Machine" rated a
beginner Advanced off a ratio guessed from the equipment dropdown. **That is not reversed.** What
changed is that the app stopped *inferring* and started being *told*: an optional `standInId` points
at a real library exercise.

🚨 **THE SAFETY IS ARITHMETIC RATHER THAN A THRESHOLD**, which is what makes it hold under later
edits:

- **The match decides the MUSCLE.** She filed her dip machine under Triceps; matched to a chest
  press, the evidence lands on **Chest**. The dropdown that produced the original bug now decides
  nothing.
- **`STAND_IN_QUALITY = 0.40`** multiplies the target's own `q`, so a stand-in is worth strictly less
  than the exercise it points at **at every ratio and rep count** — it can never out-rank its own
  target, and no future ratio edit can make it.
- 🚨 **1.00 × 0.40 = 0.40, below `FALLBACK_MIN_QUALITY` (0.45).** The best possible match still
  cannot chain onward into a cross-muscle inference **even if that filter were deleted**. The guard
  is a number, not a branch somebody can reorder.
- **One hop, structurally** — the target comes from `BUILT_IN_EXERCISES`, which never carries a
  `standInId`, so there is no second hop to take. A custom matched to a custom yields `[]`, and a
  non-resolving id stores `null` rather than a dead reference.
- **Bodyweight and assisted targets are refused** — not caution, correctness: their ratios convert a
  resistance derived from a weigh-in, while a custom exercise's logged number is read as plain load.
  Borrowing an assisted pull-up's ratio would apply a body-weight conversion to a bare stack number
  on a machine where *more* on the stack is a *lighter* set. That is the 2026-08-31 incident rebuilt
  out of two individually-fine halves.
- Replayed on her own numbers: 60 × 10 now converts at **quality 0.14**, against the ratio-1.00 guess
  that rated her Advanced.

⚠️ **AND ONE THING THE AGENT FLAGGED FOR A SECOND OPINION, WHICH WAS RIGHT TO FLAG.** It first put
the matched exercise's name in `via` — a field that already means *"the muscle a fallback came
through"* — safe only because the two can never coexist, so you read it against `kind`. 🚨 **That is
the shape of a bug this project has written down twice**: `firestore.rules` keeps `invites` and
`requests` apart because *"two meanings in one collection is how a read rule ends up wrong"*, and
D9/D28 were cited interchangeably for weeks. **`exercise-estimate.js` already reads `via` bare inside
its fallback branch.** Split into its own `standInName`; neither field needs a guard now.

### C. The three that had shipped without a test, and one dead function

- **Bars' one-source-per-row (D14), Goals' "what has moved", and the runner's blank-field line** are
  now pinned. All three had been verified in throwaway scripts the agents then deleted, which is
  exactly the proof this project does not count. The Goals one carries a **no-verdict guard** that
  strips `.goal-verdict` and requires the words to be gone — it would catch the movement line quietly
  growing into the judgement the estimator has not earned.
- **`benchmarkComparison()` deleted.** Bars stopped reading it that morning and nothing else ever
  did. 🚨 **The reason it went rather than sat there: its middle forty lines were a SECOND COPY of
  `normalizedSeries()`'s per-day reduction**, down to the tie-break where a set performed at the
  target rep count beats an estimate on the same day. Two copies of one rule in one file is drift
  waiting to happen. **Its assertions were re-pointed at the surviving copy rather than deleted** —
  the rule was what mattered, not the caller.

### D. ✅ The contrast failure is fixed, and the token test now catches it

`.load-badge.per-side` at **3.96:1** → `#82570B` at **5.02:1**, scoped
`:root[data-theme="light"]:not([data-palette])`. ⚠️ **The scoping is the whole job**: teal, indigo
and ember already cleared AA (4.56–5.02), and the obvious selector would have **broken three
palettes to fix one**.

🚨 **`tests/a11y.test.mjs` could not have caught this and now can.** It walks tokens out of `:root`
blocks, and `--accent` on `--accent-dim` is a pair no `:root` rule declares — it exists only because
a CLASS puts one on the other. It now asserts that pair in every palette.

⚠️ **AND MY FIRST MUTATION CHECK OF IT PASSED, WHICH WOULD HAVE MEANT A VACUOUS TEST.** The mutation
replaced the first `#82570B` in the file — **the one in the comment above the rule**, not the
declaration. The test was fine; the check was lying, in the reassuring direction. **A mutation check
that passes is only evidence if you know the mutation landed on the code.**

✅ **Final audit: 128 routes, 11,912 text nodes, ZERO below 4.5:1, zero overflow** — 8 fixed, 0
introduced, against the `git archive HEAD` control taken this morning.

---

## 2026-09-06 (second pass) — 🚨 EIGHT BLANKS BECAME NUMBERS, AND ONE GATE WAS KEPT ON PURPOSE

Tim, having been given the list below: *"it seems like you have a good idea of what should be changed
or not so make a plan for each one and start building. Don't ask me questions, just go with whatever
you recommend. Deploy many sub-agents to get it done if you need."*

**Four agents on disjoint file sets**, none allowed to touch `css/app.css` or `tests/` — the two
places four parallel writers would have collided, and the two places where a collision is silent.
Integration, every new assertion, both mutation checks and the browser audit were done afterwards in
one pass. ⚠️ **The file partition is the whole reason this worked**; the 2026-08-22 note about wave
size was about *review* agents, and this is the first time this project has had four agents WRITING
at once.

### A. 🚨 THE MUSCLE MAP RANKS WITHOUT A PROFILE — and invents no body weight

`muscleStrength()` returned `ready: false` on a missing sex or a missing weigh-in, and every screen
downstream drew *"Tell us about you first"* over an account that could be holding a year of sets.
**Two settings, and the map refused the whole body.**

`withAssumptions()` in `js/strength-standards.js` is the substitution, and the shape of it is the
point:

- 🚨 **A MISSING WEIGH-IN IS NOT A GUESSED WEIGHT.** It forces the comparison's weight axis to
  `'any'` — which `refBodyWeight()` already treats as the reference median with no allometric
  scaling, i.e. **lifters of every size**. That is a real group that can be named truthfully on
  screen. The obvious alternative was to drop in `REF_BW` and stand the user beside a made-up 180 lb
  man, which would have looked identical and been a fabrication. **There is an assertion whose only
  job is to fail if somebody later "helpfully" fills that field in.**
- **A missing sex assumes male, and says so** — every median in `MUSCLE_LIFTS` is a male/female pair
  and `MALE_SHARE` (0.55) already records that lifters skew male, so it is the modal answer rather
  than a value judgement. It is stated, never silent.
- The screen carries it: *"Assumed male — your sex is not on your profile. Compared against lifters
  of every size — no weigh-in on record."* with the profile one tap away.

🚨 **AND IT IS NEVER PUBLISHED.** `buildStrengthShare()` now refuses on `mine.missing.length`.
`js/shared-map.js` cannot recompute a percentile — body weight is deliberately not in a public
document — so a friend would receive 24 rows built on a guessed sex **with no way to check any of
them and nowhere for the caveat to travel to.** **Mutation-checked**: removing that clause flips
exactly one assertion. It also protects the compare screen for free, which reaches the same publisher
through `mySharedMap()`.

### B. 🛑 GOALS KEPT THE GATE, AND THAT WAS THE ONE REAL DECISION OF THE DAY

`GoalsView` branched on the same `ready` flag, so lifting it opened Goals too. **That is a trap, and
the fix was to stop asking the map's question.** A goal **freezes** `targetWeight` in pounds when it
is set and never recomputes it (D20) — precisely so gaining four pounds cannot make a goal quietly
harder. Set a goal against an assumed sex and **that assumption is frozen into the target for twelve
weeks**, long after the profile has been filled in and every other screen has stopped mentioning it.
The map is a reading and gets relabelled; a goal does not.

`context()` now returns `hasProfile: !profile.missing.length` and all three gates read it.
**Mutation-checked**: forcing `hasProfile: true` flips three assertions.

### C. The other six

| | Was | Now |
|---|---|---|
| Goals verdict | a paragraph explaining there would be no verdict, and nothing else | **what has moved** since the goal was set, with the ±12 % yardstick in the same breath and still no verdict word. ⚠️ Built from the two estimated **1RMs**, not the frozen percentiles — a percentile moves with the comparison group, so subtracting those would report a change in the STANDARDS as a change in the lifter |
| Goals, under two weeks | *"Not enough logged training yet to measure this"* | totals, with the span and the session count named, and why it is not yet a rate |
| Volume, under a fortnight | raw totals under a heading that said "a week" | a **rate**, span named. 🚨 **This also fixed a latent bug**: the body map was painting `totalSets` against `volumeShade()`, whose bands are *weekly* doses — a 9-day beginner with 21 sets wore the colour of someone training hard. The `perWeek` flag was **deleted** rather than pinned true, because a boolean threaded through five call sites is five chances to print a total under a rate's heading |
| Bars | blank until the same lift was benchmarked twice | falls back to workout sets through the Graph's own `pickSource()`, **one source per row**, each row saying which (Rule 4 / D14 — a row whose start is a benchmark and whose now is a workout set is the mixing that makes strength look like it swings) |
| One recording | *"Only one data point"* | the value, its date and its estimated max, marked `~`. **No line** — one point has no trend, and drawing one would be Rule 5 exactly |
| Benchmark estimate | refused when the muscle was itself rated by a stand-in | **opt-in for that one read-only screen**, flagged `viaFallback`, confidence multiplied down a third time, **band capped at Fair**, both hops named on screen. 🛑 **The default did not move**, so the runner and compare keep the refusal |
| Runner's blank weight | a blank field and no explanation | *"No opening weight — nothing you have recorded points to this lift closely enough."* 🛑 **The field is still not filled** — a number here gets walked up to a bar |

### D. 🚨 AND AN AGENT FOUND A REAL BUG ON THE LOGGING PATH

The runner's own `derivedWeights` loop checked `rating.estimate` and `rating.confidence` and **never
`rating.kind`** — so a fallback rating times a direct ratio could put a **three-hop weight into a
field somebody loads a bar to.** That is the identical bug fixed in `exercise-estimate.js` on
2026-09-02; it survived four days here because **the two files look like they do different jobs and
do the same arithmetic.** Of the two places to have missed it, this was the worse one: that one puts
a number on a screen somebody reads.

Closed. ⚠️ **It can only ever withhold a suggestion, never raise one** — the same asymmetry the
lay-off rule and `trainingRange()` rest on. Found by an agent reading the two modules side by side,
which is the second time an agent reading a module against its own header has produced the best bug
report of the day.

### E. What was checked, and what it cost

- **All seventeen suites green**, 967 render assertions (up 11), plus new sections in
  `data-layer.test.mjs` and `estimate.test.mjs`.
- **Two mutation checks**, both listed above.
- 🆕 **THE BROWSER AUDIT WAS RUN TWICE, AND THE SECOND RUN IS THE POINT.** 128 routes, **11,912 text
  nodes, zero overflow.** Eight contrast failures — and rather than assume they were pre-existing,
  the same audit was run against a scratch copy built from `git archive HEAD`: **identical eight,
  0 introduced today.** ⚠️ **They are real and they are not ours**: `.load-badge.per-side` — the 9px
  "PER SIDE" chip in `js/ui.js:897` — measures **3.96:1 in the light theme** on the runner's swap and
  exercises sheets. 🛑 **Not fixed: it is a colour, and colours are Tim's.** It also means the
  handbook's "zero below 4.5:1" line is stale.
- ⚠️ **A TRAP WORTH RECORDING: THE FIRST AUDIT RUN MEASURED 404 PAGES.** A stale `python -m
  http.server` was already bound to port 8791, so the tool's own "nothing is serving" guard passed
  while every route returned *"Error code: 404"* — 128 routes, 0 text nodes, **zero contrast failures
  and zero overflow, which reads exactly like a clean sweep.** Every interactive step "failed" with a
  sensible-looking message about the demo, which is what gave it away. **A green audit with a zero
  node count is not a pass**, and the node count is the only thing that says so.

---

## 2026-09-06 — EVERY BLANK AND EVERY REFUSAL, LISTED FOR TIM

Open work 24, closed. Tim, 2026-09-04: *"if you want to give me a list of the places this does
already happen, it could help me with this. Do this after we're done questioning."* — the deliverable
`docs/direction.md` §3.1 created, alongside the note-to-the-developer feature that shipped on the 4th.

🛑 **NOTHING WAS CHANGED, AND NOTHING MAY BE.** *"I think I'll notice the places that show blanks and
I'll manually tell you to fix them if I want."* This is a list he picks from. **The whole list was
delivered in the terminal**, because he does not read these files; this section is the record so a
later session can act on whichever item he names without re-deriving it.

**Method:** every `emptyState()` call site in `js/` (26 of them), plus every refusal that returns
`null` rather than a number — `estimateOneRM()`, `rankBlockedReason()`, `normalizeBlockedReason()`,
`observedDaysPerWeek()`, the runner's two gates, and the two screens that state a refusal in prose
(the Goals verdict, the Volume rate).

### A. The app holds the data and says nothing — the eight worth changing

| | Where | Now | What it could say |
|---|---|---|---|
| 1 | `views-muscles.js:117`, and the same gate at `views-goals.js:52` | The **whole map** is replaced by "Tell us about you first" when sex, body weight or age is missing — over an account that may hold a year of sets | Paint it from a **stated default population**, with the assumption in the header and the Open profile button kept. 🚨 **The biggest single item on this list**: it is not one number, it is every screen behind the profile gate |
| 2 | `views-goals.js:299` | **No on-track / behind / ahead verdict at all**, explained on screen | A trend **with its width stated**. ⚠️ The refusal's reasoning is still correct — a raw day-to-day estimate swings several percent — so this is a band, never a word |
| 3 | `views-data.js:2198` | Volume **refuses a per-week rate** under a fortnight, showing raw totals | The rate **with the window named** |
| 4 | `goals.js:546`, `goals.js:588` | "Not enough logged training yet to measure this" under two weeks | The partial figure, said to be partial |
| 5 | `views-session.js:3118` | Benchmark screen: "No estimate for this one yet — nothing you have recorded converts to it". Fires when `rating.kind === 'fallback'` — the muscle is itself only rated by a stand-in | A number **is** reachable. ⚠️ **It is three estimates multiplied**, which `exercise-estimate.js`'s own header calls the machine for confidently wrong numbers. If he picks it, it ships as a named chain with the widest band, or not at all |
| 6 | `views-session.js:222`, `:226` | The runner leaves the weight field **blank with no explanation** for a never-done lift below ratio quality 0.45 or confidence 0.35 | ⚠️ **Say WHY at minimum.** A number here is walked up to a bar — the gate itself is right and `exercise-estimate.js` §"an estimate you read is not an estimate you lift" is the argument for keeping it |
| 7 | `views-data.js:1212` | **Bars** is blank until the same exercise is benchmarked twice | Graph already falls back to `bestsPane()` — every lift, best effort, how long ago. Bars has no equivalent |
| 8 | `views-data.js:966`, `:903` | "Only one data point" | The point and its estimated max. ⚠️ **Not a line** — Rule 5, a trend drawn through one point is an inference wearing a measurement's clothes |

### B. Permanent refusals — no published data exists. Two of them have a real fix

- **`js/exercises.js` — the inverted row and the incline push-up.** 37–79 % of body weight depending
  on bar height; 41 % vs 55 % on hand height. 🆕 **The fix is to ASK for the parameter**, not to pick
  a number — §9 of the handbook has said so for weeks and it is the only one of these that is a
  feature rather than a literature gap.
- **`muscle-evidence.js:84` — a custom exercise never sets a strength level** (2026-08-31, after a
  made-up "Dip Machine" rated a beginner's triceps Advanced). Counted for volume, named on the panel.
  🆕 **Could let the creator pick the closest library exercise and borrow its ratio, labelled.**
- Diamond and wide-grip push-ups, bench dips, handstand and pike push-ups, ring dips, muscle-ups —
  no published fraction at all. ⚠️ The circulating "handstand push-up ≈ 90–100 % BW" figure is
  misattributed to a paper about push-ups; do not use anything from that lineage.
- Bodyweight squats and all lower-body/trunk bodyweight work — the key lift logs *external* load, so
  a bodyweight squat converts to an empty bar.
- Band work (`muscle-evidence.js:117`) — resistance depends on how far it is stretched.
- **Neck** — hatched since 2026-09-04, never rankable. The panel says what HAS been logged, which is
  the 2026-09-04 answer to this same complaint arriving about Core.
- `views-data.js:2246` — the research age chart draws **8 of 11 muscles**; no published per-group age
  curve exists for Chest, Back or Traps.
- `shared-map.js` — a friend's percentile in a comparison group they did not publish. **Stated, never
  a silent fallback to their default.**
- `compare.js:571` — a bodyweight lift has **no load row** in a comparison, because a friend's body
  weight is not in the public copy. Same reason `session-stats.js` counts sets rather than pounds on
  a feed card.

### C. Honest blanks — nothing exists yet to estimate from

About fifteen first-run empty states (no sessions, no weigh-ins, no friends, no goal, an empty
calendar day, an empty feed, a system with no workouts) and five failure states (offline feed,
friends list failed, lookup failed, demo sharing off, anonymous account, expired invite). ⚠️ **These
are the ones a sweep would wreck**: "something is better than nothing" has nothing to work from when
the account is empty, and inventing an encouraging number for a new user is the one place this app
would be lying to somebody with no way to check.

---

## 2026-09-05 — 🚨 EACH BODY ITS OWN POPULATION, A FRIEND'S DATA AS TABS, AND ONE CONTROL REMOVED

Three instructions from Tim in one session, all on screens about other people.

### A. 🚨 "RELATIVE TO EACH" — the compare screen was ranking two people against one population

Tim: *"when I said the default was comparing against people similar to the users, I was meaning that
each account would compare themselves against people like them. For example, if there is a young
woman, the girl's muscle group is compared to other young women, but if that is being compared to an
older man, then the man is being compared to other older men. Right now both people are being
compared to the same people."*

**He asked for a third preset; what he had actually asked for on 2026-09-03 was the DEFAULT, and it
was built one reading off.** Both are now true: `Relative to each` is the first chip in the sheet and
is what the compare screen opens on.

- 🚨 **WEIGHT AND AGE WERE ALREADY PER-PERSON. ONLY SEX WAS NOT** — which is why this was easy to
  miss and why the screen's own caption did not catch it. `weight: 'own'` and `age: 'own'` are
  resolved by the OWNER when they publish their 24-row grid ("at my body weight, my age"), so those
  two axes have always meant each person's own. **Sex is the only axis the READER resolves**, and
  `comparePreset('like-me')` was resolving it eagerly into a concrete `male`/`female`.
- ⚠️ **THE MECHANISM ALREADY EXISTED AND WAS UNREACHABLE.** `compareKey(compare, ownSex)` resolves
  `sex: 'own'` against whichever document it is applied to, and `ownSexOf()` reads that from the
  published `defaultCompare`. `own` was in the options table marked `hidden` — the stored value for
  somebody who has never opened the sheet, never a choice. The fix is one preset that keeps it
  unresolved; **one comparison object, two different keys, one per body.**
- ⚠️ **`matchesPreset` HAD TO KEEP MATCHING 'own' FOR "Like me"**, or a brand-new user's own map
  would show no preset selected. So `each` matches on the LITERAL `own` and the sheet resolves the
  tie by testing it first — `pressedPreset()`, which exists only because both answers are correct on
  a screen with one body.
- 🚨 **THE SEX AXIS WOULD HAVE LIT "Men" WHILE NO SEX WAS IN USE.** `isChosen()` resolves `own`
  against the viewer's gender, and the compare screen passes no gender — so the fallback is `male`.
  A chip claiming a choice nobody made is worse than no chip lit: in that one mode the axis shows
  nothing selected and the help text under it says why.
- ⚠️ **AND THE CAPTION WAS NARROWLY TRUE AND MISLEADING BY OMISSION.** It said "each body is ranked
  against people of its own body weight and age" — both true — and was silent on sex, which read as
  completeness. **The render test pinned exactly the two axes that already worked.** It now names all
  three and changes when the mode does.

### B. A FRIEND'S DATA IS THE DATA SCREEN NOW

Tim: *"they're displayed at the bottom of the body view, rather than as tabs at the top. I want it to
look nearly exactly like how a user views their own data section, but with the 'research' tab
replaced with that user's 'calendar' data. And then keep the 'recent workouts' display below that
user's body view as it is now."*

🚨 **THE LITERAL WAY TO GET "nearly exactly like" IS FOR IT TO BE THE SAME FUNCTION.** `GraphView()`
now takes a subject: `{ rows, subject, tab, back, musclesPane, musclesExtra }`. A friend's Volume tab
is not a copy of yours, it **is** yours, reading their rows — so it cannot drift by a pixel or a word.
**Six store getters grew a `rows` parameter** for it (`activityByDate`, `currentBests`,
`benchmarkComparison`, `chartableExercises`, `bodyWeightSeries`, `seriesForExercise`), the same move
`muscleRatings(rows)` and `weeklyVolumeByMuscle(rows)` already made.

- ⚠️ **THE MUSCLES PANE IS HANDED IN, NOT COMPUTED.** A friend's percentile was worked out on THEIR
  device against their body weight and age, neither of which is in a published document — so
  `GraphView` cannot recompute it and the friend page passes `friendBody()`, which reads the grid.
  **This is the one pane that is genuinely not shared, and the reason is the design rather than
  effort.**
- 🚨 **`graphMode` IS MODULE STATE AND A FRIEND'S PAGE MUST NOT WRITE IT.** Browsing somebody else
  would otherwise change which tab your own Data screen opens on — and picking their **Calendar**
  would leave it holding a key that does not exist in `DATA_TABS`, so your next visit would silently
  fall through to the trend chart. One control, two memories (`setMode`).
- ⚠️ **CALENDAR IS MONTHS ONLY, AND THE YEARS VIEW IS DELIBERATELY ABSENT.** Years exists to fit a
  whole history on one screen; a friend publishes sixty sessions, so the squares would thin out and
  stop partway up the page — **a picture of what they SHARE, drawn as though it were a picture of
  what they have DONE.**
- 🚨 **AND ITS DAYS GO NOWHERE, AS INERT CELLS RATHER THAN NO-OP BUTTONS.** `#/day/<iso>` is MY
  training for that date; linking there would open the right day for the wrong person and look like
  it had worked. A button that does nothing takes focus and is announced as a control.
- ⚠️ **THE OLD ROUTES SURVIVE.** `#/friend/<uid>/volume` and `/graph` open the page on that tab.
  **`FriendVolumeView` and `FriendGraphView` are deleted** — 113 lines no route reached. The screens
  went; the addresses did not, which is the treatment `#/calendar` got through two redesigns.
- 🚨 **THE DEMO'S FRIEND PAGE IS A SEPARATE IMPLEMENTATION AND WOULD HAVE KEPT THE OLD LAYOUT.**
  `friendScreen()` is a near-duplicate kept because the demo has no relationship to show. Leaving it
  on rows would have meant **the demo showed a screen the app no longer has** — and the demo is where
  every screen gets looked at, measured and audited. The `sets: []` fault in a different costume.

### C. 🔄 "What they can see of yours" is gone from a friend's page

Tim: *"since we talked about how that single option is only changeable in the profile section for now
and all friends can see everything, please remove this choice from the user display."*

⚠️ **IT WAS RIGHT WHEN IT WAS BUILT AND WRONG BY THE TIME IT WAS REMOVED, AND THE DIFFERENCE IS
2026-09-03.** It was a PER-PERSON dial — four visibility levels, set on that screen, for that one
friend — and putting it at the top of their page was the whole point. When the tiers went it became
one ACCOUNT setting that merely happened to be drawn there, and **a per-person position for an
account-wide control reads as though it were still per person**: somebody could reasonably have
believed they were changing what THIS friend sees. Nothing was lost — it is still on the Friends
screen and in Settings, where an account-wide choice belongs.

### D. ⚠️ I EMPTIED `views-data.js` WITH A SCRIPT, AND §0.11 SAYS EXACTLY WHY

A Python read-modify-write truncated the file to zero bytes and then died on an emoji surrogate
before writing a byte back — **the identical failure recorded on 2026-09-02**, which this file
already warns about twice, and which I had read the same session. Recovered with `git checkout --`,
which cost the session's `views-data.js` work and no more.

🚨 **THE MECHANISM OF THE RELAPSE IS THE PART WORTH KEEPING.** The rule was not forgotten; it was
eroded. Scripted edits worked perfectly a dozen times earlier in the session — surgical two-string
replacements, each one fine — and every success made the next one feel safer. **That is precisely
what the 2026-09-03 note predicted in writing** ("a scripted two-string replacement in this file
worked fine, twice — which is exactly how the habit comes back"). The edits after the recovery were
done with the editing tools, and a later `sed`-style line-range deletion still left a stray `}` that
`node --check` did not catch and the test suite did.

**Tests: render 947 → 956, 4,112 headless, all green.** ⚠️ **Not looked at in a browser** — the
session was paused here for a chat reset.

---

## 2026-09-04, third pass — A NOTE TO THE DEVELOPER, ABS IN THE DEMO, AND A CORRECTED TABLE

Tim, having been given a ranked list: *"build the note-to-developer feature, give the demo some ab
work, and fix the transcription error."* All three.

### A. 🚨 A NOTE TO THE DEVELOPER — the first prose one person writes for another

`feedback/{noteId}`, the **second top-level collection** in the app and the first that is not
world-readable. A form on the Account screen, an inbox at `#/notes`, and `js/feedback.js` holding the
shape and the developer's uid.

- 🚨 **THE READ SIDE IS ONE uid, HARD-CODED IN `firestore.rules`, AND THE SCREEN PROTECTS NOTHING.**
  `feedback.list()` returns `[]` for anybody else because the *database* refuses, not because the
  view checked. ⚠️ **A uid rather than an email**: `request.auth.token.email` is only as good as the
  provider that filled it in and a Google primary address can be changed; a uid is issued once.
  ⚠️ **And not a flag in a document** — "developer: true" in a settings document is a permission its
  own holder can grant themselves.
- 🚨 **THE AUTHOR CANNOT READ THEIR OWN NOTE BACK, AND THAT IS THE DESIGN RATHER THAN AN OVERSIGHT.**
  It would be harmless and slightly friendly, and it would mean a `get` rule conditioned on a field
  *inside* the document — the shape where a mistake is invisible and a forged `uid` reads somebody
  else's note. Create-only has no such shape. The screen confirms the send instead, and says there is
  no reply here so anyone wanting one should leave contact details in the note.
- 🛑 **NOBODY CAN EDIT ONE, INCLUDING TIM.** A note is a record of what somebody said, not of what
  they wish they had said. He can delete.
- ⚠️ **IT STORES THE DEVICE, NOT AN APP VERSION.** The obvious field is a version — and this app has
  no build step, so any version string would be a constant that never changed *while looking exactly
  like something that did*. That is worse than nothing: it would answer "were they on the old build?"
  with a confident wrong yes. The user-agent is the thing that is actually knowable and it happens to
  answer the first real question about a bug report.
- ⚠️ **THE INBOX RENDERS `text`, NEVER `html`.** This is the only free text in the app written by one
  person for another to read, so that is load-bearing rather than habitual, and a render test pins it
  with an `<img onerror>` payload.
- ⚠️ **DELIBERATELY TEMPORARY.** It exists to catch what a new user thinks before they get used to
  the app. 🛑 **When the first users stop being new it should come out**, or it becomes a support
  inbox nobody is staffing.

🚨 **TWO REAL BUGS SURVIVED 941 JSDOM ASSERTIONS AND DIED IN ONE BROWSER RUN.**

1. **`backend()` is not a function** — the store's accessor is `await active()`. Every send would have
   thrown. Invisible to jsdom because no test reached the cloud branch.
2. 🚨 **THE ANONYMOUS GUARD NEVER FIRED, AND THE TEST MATCHED THE BUG.** The store read
   `a.user.anonymous`; the field is **`isAnonymous`**, as `social.state()` twenty lines below gets
   right. So an anonymous account — a browser profile that will be lost, with nobody to reply to —
   was offered the form. **The render test had mocked `anonymous: true`, copying the shape from the
   code under test rather than from `auth.state()`**, so it asserted the guard worked against a mock
   built to satisfy it. ⚠️ **A mock is a claim about what the real thing produces; a mock copied from
   the consumer proves only that the consumer agrees with itself.** The test now uses the real field
   name and carries that note.

**Proved on the live project, not only the emulator**: a throwaway account created through the app's
own sign-up sent a real note over the deployed rules (five fields, newlines intact, device captured),
and both the note and the account were deleted afterwards — the collection is empty again.
**Rules: 159 → 175 assertions**, including that the author cannot read, nobody can list, and nobody
can edit. **Deployed.**

### B. The demo trains abs — and a neck

Open work 25, and Tim authorised the re-baseline it needs.

- **Cable Crunch → Core RANKS** (it is Core's key lift), **Neck Curl → Neck HATCHES.** ⚠️ **One of
  each on purpose, because the two states cannot coexist on one muscle**: now that Core is rankable,
  ab work colours it, and the hatch built the same morning would have had nothing in the demo to
  appear on. Neck is the only muscle that can still produce it.
- ⚠️ **ADDING AN EXERCISE RE-ROLLS THE WHOLE SEEDED YEAR.** Every number in the golden observation
  table moved. 🚨 **A re-baseline is not a pass**: each was checked for plausibility before being
  pasted in — every muscle within 11 % (worst Triceps +10.1 %, Quads −8.2 %), and the demo lifter
  still reads as one coherent person, everything Novice to Proficient.
- 🚨 **ONE FAILURE WAS NOT A RE-BASELINE AND WAS FIXED IN THE DEMO INSTEAD.** The re-rolled year left
  the goal reading **+0 lb, 0 % of the way** — the demo is *supposed* to open on a goal part-way
  through, and the test was reporting a lost property rather than being too strict. `GOAL_WEEKS_AGO`
  5 → 7 restores it: +14 lb, 33 %, five weeks left. That constant exists to place the goal in the
  year, so moving it is what it is for.
- ⚠️ **AND THE DEMO STILL HAS NO TIME-BASED STRENGTH SET ANYWHERE** — no plank, no L-sit, no dead
  hang — because the generator writes every set as `{weight, reps}`. Recorded in `demo.js`; a plank
  there would be a fixture in a shape the app never produces, which is the `sets: []` fault again.

⚠️ **AND THE CROSS-PATH TEST EARNED ITS KEEP.** `data-layer`'s "the store and the module reach the
same answer" assertion failed the moment Core started being rated in the demo — because it called
`rateMuscle()` without the muscle while the store passes it, so the two disagreed on exactly one
muscle. That is the join it exists to protect, catching a change made two files away. `demo.js` now
names 'Chest' at its own call for the same reason, though Chest's standard needs no discount today.

### C. `docs/research.md` §2's transcription error — fixed

Re-read against PMC10933212. **The 95 % figure is ~2, not ~5**, and a *second* cell was wrong: the
general 80 % column held the bench-press value.

🚨 **BOTH WERE SHIFTS RATHER THAN INVENTED NUMBERS** — every wrong cell held a real number from a
neighbouring one — **which is exactly why the table stayed plausible enough to sit there for weeks.**
§2 now records that shape, so the next wrong table in this project gets checked for a shift first.
⚠️ **The figures come from Figures 2–4 rather than prose**, so the 95 % row is graded 🟡 and the rest
🟢; the paper's running text only quotes the historical table it replaces. ✅ **Nothing in the app
moved** — the one citation of §2 is `exercise-estimate.js`, which quotes the bench cell, and that
cell was always right.

**Tests: a new `tests/feedback.test.mjs` (26), render 926 → 941, rules 159 → 175. 4,109 headless.**
**Audit: the Account and the new Notes screen, 64 text nodes, zero below 4.5:1, zero unnamed, zero
overflow.**

---

## 2026-09-04, second pass — 🚨 CORE IS A RANKED MUSCLE NOW

Tim: *"start planning and then when you're ready start building a version you think follows my
description and you think is good enough for the app."* His description, from an hour earlier: *"set
a good 1RM estimator for the ab muscle group for a specific exercise and base it off of whatever
information we can find online… This makes the ab muscle group nearly identical to any other muscle
group and how it operates but with a little less reliability."*

**Built. `Core` has a key lift, its own spread, its own reliability penalty and its own caveat, and
`UNRANKABLE` is down to Neck, Cardio and Activity.** The research pull is `docs/research.md` §14 —
🟡, the only 🟡 in the standards table, and the grade is the point.

### A. What the research actually said, including the part that argued against the plan

**Cable Crunch is measured**, which is why it is the key lift: Strength Level, 12,596 qualifying
results out of 211,507 logged lifts. At 180 lb male 58/98/**151**/216/288; at 140 lb female
36/65/**106**/157/214.

- 🚨 **THE CROSS-CHECK DISAGREES BY 17 %, WHERE §11 ACCEPTS ~3 %.** Fitness Volt says 178/123. It is
  also **not independent** — its own page says the tables are *"modeled… ratio-derived from base
  lifts anchored to the OpenPowerlifting dataset"*, so for a cable crunch it is somebody's chosen
  ratio, not a record of anyone doing cable crunches. The measured source wins and the gap is
  **carried as a number** (`standardQuality: 0.6`) rather than mentioned in a comment.
- 🚨 **THE SPREAD IS 50 % WIDER THAN EVERY OTHER LIFT, AND REUSING THE GLOBAL σ WOULD HAVE BEEN
  WRONG IN A WAY NOBODY WOULD HAVE SEEN.** Core's anchors fit σ ≈ 0.48 (asymmetric, 0.39–0.58);
  the bench fits ≈ 0.30, which is why 0.32 has worked everywhere. Under 0.32 a lifter sitting
  **exactly on the published Beginner mark** reads **p0.1 instead of p5** — the model calling a
  published beginner the weakest lifter alive. `MUSCLE_LIFTS` grew an optional per-muscle `sigma`;
  Core is the only muscle that sets one. ⚠️ **This is the revisit the file predicted**: its own
  comment said one σ for every lift was a simplification *"worth revisiting once real data exists."*
- ⚠️ **THE MACHINE-CRUNCH RATIO IS THE CLEANEST IN THE TABLE AND STILL ONLY QUALITY 0.55.** Men:
  1.121/1.122/1.126/1.125/1.128 across five levels — flatter than anything the 2026-08-26 sweep
  produced. Women: 0.833/0.877/0.887/0.892/0.897, internally just as flat and **27 % away**. Both
  cannot be the population ratio; `RATIOS` has no sex dimension, so the larger male sample is used
  and the disagreement is priced in rather than averaged into a number neither table supports.

### B. "A little less reliability", as arithmetic rather than a sentence

- **`standardQuality` multiplies the rating's confidence**, so identical evidence gives an identical
  ESTIMATE and a lower CONFIDENCE — 0.428 against Chest's 0.713. 🚨 **The two doubts are different
  and conflating them would have been the bug**: "you logged one set six weeks ago" is fixable by
  logging more, "no second source agrees where the middle is" is not.
- 🚨 **SO THE HINT HAD TO LEARN TO ASK FOR NOTHING.** Every other line `raiseConfidenceHint()` can
  return is an instruction. On Core, once the fixable reasons are exhausted, an instruction would be
  a small lie repeated on every visit — it now says *"nothing more to log — this one is held back by
  the standards, not by your training."* ⚠️ **Checked last, not first**, so a genuinely stale or
  single-source reading still gets the advice somebody can act on.
- **The caveat travels with the number, on both the local rating and the published projection**, so
  it cannot be lost by being read on a friend's phone.

### C. Two things that would have shipped broken, and how each was caught

1. 🚨 **THE HATCH WOULD HAVE REGRESSED FOR MOST PEOPLE — caught in planning, not by a test.** The
   morning's "trained, can't be ranked" mark was computed from the `UNRANKABLE` list. The moment
   Core left that list, a lifter whose ab work is planks and hanging leg raises would have dropped
   back to `lv-none`, "No data", over three sessions a week — **the original bug, reintroduced for
   the majority**, since only 8 of 30 core exercises record a weight. It would have looked like a
   success, because Core colours beautifully for the minority who do cable crunches. The mark now
   asks **"did a rating come out"** rather than "could one ever", which is narrower, more honest,
   and generalises: a Back whose only sets were 20-rep inverted rows has always been painted
   "No data" too.
2. ⚠️ **AB WHEEL ROLLOUT WENT SILENT, AND A TEST WRITTEN FOR A DIFFERENT SWEEP CAUGHT IT.**
   `data-layer`'s "no library exercise is silent" walk failed the moment Core became rankable: the
   rollout records no weight, has no measured body-weight fraction, and fell out of
   `rankBlockedReason()` saying nothing. **Making Core rankable did not create that hole, it
   revealed one** — the exercise had been sitting under an unrated muscle where nothing ever asked.
   It now names the real obstacle (a lever the app cannot see), rather than the generic "nobody has
   published a conversion", which would invite somebody to go looking for one.

### D. What it still refuses, and the headline nobody should lose

Six of the eight weighted core exercises are still refused, each for its own reason — **Decline
Sit-Up** because the load is a plate *plus* an unmeasured fraction of the torso (the inverted-row
problem exactly); **Russian Twist / Cable Woodchop / Landmine Twist** because rotation is not spinal
flexion; **Pallof Press** because anti-rotation is a different quantity; **Suitcase Carry** because
it is timed. Each is a test, so "finishing the table" later requires arguing with a named reason.

⚠️ **AND THE HONEST HEADLINE: THIS RATES ABOUT A QUARTER OF HOW PEOPLE TRAIN ABS.** Twenty-two of
thirty core exercises record reps or time and no load — every plank, hanging leg raise, ab wheel,
sit-up and V-up. They get the hatch, which is a true statement rather than a hole. 🆕 **The obvious
next lead is recorded and explicitly NOT checked**: published norms for the plank hold and the
60-second sit-up (§14.6).

**Verified in a real browser at 390×844 in both themes**, seeded through the app's own store because
the demo has no ab work (Open work 25): Core reads *Intermediate, fair confidence* — "fair" where
Chest on comparable evidence reads "high", which is the penalty visible in the UI.

⚠️ **AND THE CAVEAT WAS MOVED BECAUSE OF WHAT THAT SHOWED.** It was last, with the other caveats,
which is where a caveat about a *reading* belongs — and at 390×844 it fell **below the fold**, with
"182 lbs · Estimated 1-rep max in Cable Crunch" on screen and the sentence saying that figure is
rougher than every other number on the map not. It now sits directly under the estimate it
qualifies. Rule 5 says a caveat travels with its number, and one you have to scroll for is not
travelling with anything.

**Tests: a new `tests/core-rating.test.mjs` (41), render 922 → 926, data-layer's two Core assertions
rewritten to pin the new truth rather than deleted.** Mutation-checked: removing Core's `sigma` fails
4 assertions, removing `standardQuality` fails 5. **Audit: 16 route/width/theme/palette combinations,
728 text nodes, zero below 4.5:1, zero unnamed, zero overflow.**

---

## 2026-09-04 — 🚨 GREY MEANT TWO OPPOSITE THINGS: THE ABS COLOUR, FIXED

Tim: *"okay fix the color issue now."* — after asking where the abs question stood, and proposing his
own next step (a 1RM estimator for Core off a specific exercise, *"and if we have to, we can estimate
the numbers ourselves"*). **That second half is his decision and nothing was built for it.**

### What was actually wrong, and it was not a judgement call

Core and Neck are in `UNRANKABLE` (`js/strength-standards.js`) because no published strength
standards exist for them. They were painted `lv-none` — **the same fill as a muscle nobody has ever
trained** — and the only grey in the key reads **"No data."**

🚨 **THE SCREEN WAS ALREADY CONTRADICTING ITSELF IN PLAIN SIGHT.** A few lines under the figure it
printed *"Core and Neck can't be ranked — there are no published strength standards for them."* So
the app said the true thing in words and a false thing in colour, **on one screen, at the same
time**. That reframes the two-session-old complaint: this was not the app being cautious, it was the
app being wrong, and it needed no decision from Tim about standards to fix.

### The third state

- **`lv-unranked`, a HATCH rather than a ninth colour.** The level ramp is legal only because the key
  gives it a second encoding (2026-09-03 D), and another flat hue would be one more thing to tell
  apart by eye alone. A hatch survives greyscale and every form of colour blindness, and it reads as
  *marked but not on the scale* rather than as a rank between two levels.
- **An SVG `<pattern>` with a PER-FIGURE id**, `hatch-${seq}` — the compare screen puts two figures
  in one document, and a shared def id silently resolves to the first one's pattern. The same class
  of bug the ink masks already carry a per-figure id for.
- 🚨 **THE STRIPES ARE CLASSED AND THE STYLESHEET FILLS THEM.** The first version used
  `fill="var(--unranked-bg)"` as a presentation attribute, which is **not a place `var()` can be
  relied on** — it is mapped to a CSS declaration, but substitution inside one is not supported the
  way it is in a rule, so it is exactly the kind of thing that renders in one engine and paints black
  in another. Classes also keep the colours where the other four palettes across two themes already
  live.
- **The key gains an entry only when something on the figure is wearing the mark.** A key entry for a
  state nobody is in is a puzzle rather than a key.
- **Tapping it now says what HAS been logged** — set count, sessions, and the exercises behind it,
  over a **365-day window that is named in the sentence**. ⚠️ **Every number in that block is a count
  of things that happened**, so none of it needs a median, a body weight, an age or a comparison
  group; that is precisely what makes it safe under a muscle the app has just said it cannot rank.
- ⚠️ **NO BUTTON THROUGH TO THE VOLUME SCREEN**, though that is where the work is charted: the Data
  screen's five segments are in-page state on `#/graphs`, so there is no hash that opens Volume and
  the link would land the user back on the tab they are already reading. Named in words instead.

### Two things worth keeping

- 🚨 **THE DEMO CANNOT SHOW THIS STATE, AND THE FIX FOR THAT WAS REVERTED ON PURPOSE.** The generated
  year contains exactly one ab exercise — a Plank, in a Full Body workout the demo never runs — so
  the demo's Core is permanently "nothing recorded" and the hatch is unreachable there. Adding a
  Cable Crunch to Lower A works, and **re-rolls the entire seeded year**: every subsequent `random()`
  draw shifts, which moved the goal-progress assertions and invalidated the golden observation table
  in `data-layer.test.mjs` that exists to catch regressions in `buildObservations()`. **Re-baselining
  a regression pin is not a side effect of a colour fix**, so it was backed out and left for Tim.
  ⚠️ **The demo also has no time-only path in its set builder** — every set it writes is
  `{weight, reps}` — so a Plank there would be a fixture in a shape the app never produces, which is
  the `sets: []` fault again.
- ⚠️ **THE PROBE THAT SAID IT WAS BROKEN WAS MEASURING THE WRONG THING.** The first paint check
  serialised the `<svg>` to a data URI and sampled that, which **detaches it from the document's
  stylesheet** — every classed rect fell back to black and it reported "1 distinct colour" for a
  figure rendering perfectly. The lesson is 2026-09-03 E's, arriving through a different door: a
  clipped `Page.captureScreenshot` of the real pixels settled it in one attempt.

**Verified:** hatch paints in both themes in real Chrome at 390px (screenshotted and looked at);
computed fill resolves to `url(#hatch-2)`; both stripe tokens resolve per theme. **Audit: 16
route/width/theme/palette combinations over the muscle screens, 728 text nodes, zero below 4.5:1,
zero unnamed controls, zero overflow.** ⚠️ **The new key row did not render during it** — the demo
cannot produce the state — but its text uses the same `.lv-name` class as the "No data" row beside
it, which passes.

**Tests: render 911 → 922.** Mutation-checked: disabling `trainedButUnrankable()` fails **10 of the
11** new assertions. The pair worth keeping together is *"core with nothing logged is grey"* and
*"core with logged work is hatched"* — hatching Core unconditionally would be the same bug pointing
the other way, and only the pair pins the actual fix.

---

## 2026-09-03 — 🚨 PRIVATE OR PUBLIC, A FRIEND'S BODY, AND TWO OF THEM SIDE BY SIDE

Tim: *"I want to change how privacy settings work, as well as change the visibility one user has on
another. We already made it so that a user can see any friends workouts and whatnot, however I also
want a friend to be able to see another user's body, their graphs, volume, etc. as well as click on
any muscle group like that own user can on themselves and pull details from it. Additionally,
whenever you're on a muscle group display of someone… make a compare button somewhere that allows
that user to display another person's body side by side to the current displayed body. For the
privacy settings, you can either make your account private so only friends you accept can see, or
public so anyone on the app that finds your account can see all details."*

**Three questions were put to him before anything was built, and his answers are the specification:**

| | Asked | Answered |
|---|---|---|
| 1 | Do the per-person levels go away completely? | **Yes — account-level only.** |
| 2 | Which personal fields follow the account into public? | **The photo, the time of day, the gym name.** Not body weight. |
| 3 | What do the colours mean with two bodies on screen? | *"make the default comparison vs people like them, but allow them to use any comparison combination that is already available"* |

### A00. 🚨 A FRIEND WHO HAS NOT MIGRATED YET — reported by Tim within minutes

Tim: *"When I click on compare for my muscle map, and click on one of my friends, it says: Nothing to
compare yet. One of these two has not published a muscle map. What is happening?"*

**Diagnosed against the live project rather than guessed at** (§0.4 — mint a token from the CLI's
refresh token and read Firestore directly), and the answer was in two documents:

- **Tim's account had migrated** — `shared/friends` and `shared/public`, each with the 24-row grid.
- **Autumn's had not.** She still had `shared/full`, published 2026-08-31, with the OLD array-shaped
  `strength`. Her client has not run since the deploy.

🚨 **THE CAUSE IS THE SHAPE OF THE MIGRATION AND IT WAS FORESEEABLE. Each account migrates its own
documents, on its own device, because nobody's client may write into anybody else's account** — D24,
and the whole of `firestore.rules`. So the instant one person updates, every friend who has not yet
opened the app becomes invisible to them.

🚨 **AND IT WAS NEVER A COMPARE-SCREEN BUG.** Her feed cards, her workouts, her benchmarks and her map
all vanished from his app at once — **which is the 2026-08-28 incident in a different costume**, the
one where Autumn's published data looked lost and had merely never been re-shared. That section is
two thousand lines below this one and its lesson did not get applied to a migration.

**The fix: a reader falls back to the tier documents it can still read.** `social.friend()` probes
`friends` → `public` → `full`/`mid`/`light`, in that order, and tags the result `legacy`.

- ⚠️ **SECOND, NEVER FIRST.** A migrated account must never be read through its old copy — it is
  stale by definition and may list viewers it no longer has. The legacy reads only happen when both
  new documents are absent, and a refusal is not billed, so a migrated friend costs nothing.
- ⚠️ **WHAT COMES BACK IS HONESTLY LESS, AND EVERY SCREEN SAYS SO.** The old projection carried a
  level per muscle and deliberately nothing behind it, so the body is still painted — it is still
  true, and it is the most recognisable thing this app has — while **tapping does nothing and the
  comparison control is absent**, because the old percentiles were computed under whatever group
  their owner had set and the document does not record which. **Fabricating a key for them would put
  a number under a label nobody checked.**
- ⚠️ **THE COMPARE SCREEN NAMES THE PERSON AND THE REASON NOW.** "One of these two has not published
  a muscle map" names neither and cannot be acted on — it is the sentence Tim actually hit.
- ⚠️ **A LEGACY DOCUMENT ALSO COUNTS AS PROOF OF AN ACCEPTED REQUEST**, and safely: every tier
  document was gated on its own `viewers` list and there was no public tier to read without being on
  one. Excluding them would strand a request accepted just before the change.
- **Verified against the live data**: her `full` document lists Tim in `viewers`, holds 5 sessions and
  9 rated muscles, and the deployed rules already allow the read (the `get` rule is on
  `shared/{audience}` and never named the tiers). **The fallback resolves for him without anybody
  touching her phone.**
- 🛑 **DELETE THIS PATH when nobody is left on an old build.** It is a read path only — nothing writes
  a tier document ever again, and the rules refuse to create one.

### A0. 🚨 THE DEFAULT IS PUBLIC — the same day, an hour later

Tim, having read the above: *"I think right now the default privacy for people is private, but I
would like the default to be public. Maybe later when we make users login for the first time we can
have them choose directly, but for now it should definently be public… Change this now so everyone's
information is public."*

**Done, in two halves, and the second half is the one that matters.**

- ⚠️ **`normalizeVisibility()` NOW REVERSES THE RULE THE WHOLE FILE IS BUILT ON.** Everywhere else in
  `js/social.js` an unrecognised or missing value degrades to the NARROWEST reading — an unknown tier
  was never "at least light". Here, absent means the WIDEST. **That is a product decision and it is
  written down as one**, in the function's own header, so the next reader does not "fix" it back on
  the strength of the paragraph above it. Only the exact string `private` turns it off.
- 🚨 **FLIPPING A DEFAULT DOES NOT REACH ACCOUNTS THAT ALREADY EXIST, and that was the real work.**
  Nothing publishes on a boot where no training changed, so every existing account would have gone on
  serving exactly the documents it had — reading as "Public" on its own Friends screen while
  publishing nothing a stranger could open. **A screen and a database disagreeing about who can see
  somebody's training is the worst version of this bug there is.** `healStalePublish()` now compares
  what IS published against what the setting says and republishes on a mismatch, in both directions.
  ⚠️ **A comparison rather than a migration flag**, deliberately: a flag fires once and is spent,
  while this also repairs a half-failed publish and a setting changed on another device, and costs
  nothing when the answer is yes (those documents were already read for the staleness check).
- ⚠️ **AND THE SCREEN HAD ITS OWN FALLBACK, WHICH IS HOW THIS ALMOST SHIPPED WRONG.**
  `visibilityRow()` was written as `LABEL[visibility] || LABEL[PRIVATE]`; after the flip it said
  "Private" for an account with no stored choice while the publisher treated it as public. **Two
  definitions of one default.** It normalises through `social.js` now, and the test that caught it
  asserts the default **through the screen** rather than through the function — a different claim,
  and the only one that would have failed.
- ✅ **His second point needed no change: friends already see everything either way.** A friend reads
  the `friends` document, which is gated on the viewers list and not on the public flag. The private
  setting has never hidden anything from an accepted friend.

### A. The tiers are gone

`light` / `mid` / `full` — "just that I trained" / "my workouts" / "everything" — were Tim's own cut
on 2026-08-17 and the subject of the longest argument in `docs/social-plan.md`. **They are replaced
by one account setting and two documents:** `shared/friends` (read by the uids in its own `viewers`
list) and `shared/public` (read by anybody **signed in**, when `isPublic` is true, and written only
while the account is public).

- 🚨 **BODY WEIGHT IS THE ONLY FIELD THE TWO DOCUMENTS DISAGREE ABOUT**, which is the whole reason
  there are two: one document cannot be two things to two readers. It keeps its own opt-in switch
  and reaches accepted friends only.
- ⚠️ **AND THE LIMIT OF THAT IS STATED RATHER THAN OVERSOLD.** With the published sets and a
  percentile in hand, an approximate body weight is derivable — the standards are ratios to it and
  this project publishes its own formulas. What "not public" buys is no exact number and no history
  of one. **Say "not published", never "cannot be known".**
- 🚨 **REACTING DID NOT FOLLOW THE ACCOUNT INTO PUBLIC.** Kudos, comments and handoffs are
  friends-only in the rules. Reading is a grant; writing into somebody's subtree is a moderation
  surface, and this project has no moderation story (`docs/social-plan.md` §12.11 refuses the
  discovery feed on the same grounds). A stranger reads a public account and leaves nothing on it —
  and does not see its comment threads, which are people who know each other talking.
- 🚨 **ONE TRAP WOULD HAVE PUT STRANGERS ON PEOPLE'S FRIENDS LISTS.** `processAcceptedRequests()`
  treats "I can read them" as proof they accepted my request — airtight while every document was
  gated on `viewers`, and false the moment a public document answers everybody. Somebody I asked, who
  never replied, whose account happens to be public, would have been silently promoted to a friend on
  the next visit to that screen. It now requires the **friends** document specifically. Found by
  asking what each existing read MEANS under the new model rather than by a test.
- ⚠️ **THE DISCONNECT SHEET WOULD HAVE LIED AGAIN.** It promises they "will no longer be able to see
  anything of yours" — false on a public account, where disconnecting takes somebody out of the
  friends document and leaves the public one. It now says which of the two happened. **This is the
  second time that sheet has had to be corrected for promising a link was cut when it was not**
  (2026-08-24 was the first).
- **Migration:** the three tier documents are deleted on the first publish after the change, and the
  boot heal republishes any account whose last publish predates it — otherwise its friends would see
  nothing at all, because nothing looks for `light`/`mid`/`full` any more. The rules refuse to
  re-create them.
- **Rules: 159 assertions, all passing on the emulator, and deployed.** The new ones are the ones
  worth reading: a stranger reads a public account and cannot write to it, cannot list the audiences,
  cannot read its friends document, cannot react and cannot hand it a workout; and **body weight in a
  public document is refused on the wire** as well as in the builder.

### B. A friend's muscle map is tappable, and it answers any comparison question

**The panel is the same function on both screens** — `musclePanel()`, exported from
`views-muscles.js`, fed by the new `js/shared-map.js`. A second panel would have been two places that
must agree forever about which caveats may be shortened.

🚨 **THE GRID IS THE PART WORTH UNDERSTANDING.** A percentile is a ratio to the person's own body
weight and age, and neither is in the public document. So **the owner computes all 24 comparison
groups on their own device and publishes the answers**, keyed `pool|sex|weight|age`; the reader picks
a group and reads it off. That is what makes Tim's *"any comparison combination that is already
available"* possible without publishing one new fact about their body. Measured at ~9 KB.

- ⚠️ **THE ESTIMATE IS PUBLISHED NOW, AND IT WAS DELIBERATELY WITHHELD BEFORE.** The old projection
  said so in as many words — *"Level and percentile only… data nobody needs is data that only has
  downside"* — which was right while a friend's map was a picture and stopped being right the moment
  it grew a panel. **The three recorded sets behind it are published with it**, because Rule 5 has to
  travel with the number.
- ⚠️ **THE COMPARISON CHOICE IS PER-SCREEN AND IS NOT SAVED.** Flipping to "everyone" on a friend's
  map is a question about that screen; writing it into `settings.compare` would silently re-rank your
  own map from somebody else's page.
- ⚠️ **THE LABEL SAYS "their body weight", NOT A NUMBER.** `comparisonLabel()` took a `whose`
  parameter for exactly this — "your body weight" over a friend's figure names the wrong person as
  the basis of what is on screen. The age line differs between the two screens on purpose: on yours,
  no recorded age means no age grading was applied and "any age" is literally true; on theirs, their
  client DID apply their age and this device simply does not know it.

### C. Their volume, their graphs, and two bodies side by side

**Volume and graphs are the same functions that draw yours**, handed their rows —
`weeklyVolumeByMuscle(days, today, rows)` and `normalizedSeries(id, reps, source, rows)` grew that
parameter, the way `muscleRatings(rows)` did on 2026-09-02. Neither costs a read: their sessions and
benchmarks are already in the document their page reads.

- ⚠️ **THEIR WINDOW IS NOT THEIR HISTORY AND THE SCREEN SAYS SO.** They publish sixty sessions, so a
  long window can reach further back than what they share. Silence would let the screen claim to be
  the same measurement as the one on their own phone.
- 🚨 **TAPPING EITHER BODY SELECTS THE SAME MUSCLE ON BOTH.** Two independent selections is the state
  where somebody reads one person's chest against the other's back and never notices.
- ⚠️ **WHAT THE COLOURS MEAN IS ON THE SCREEN**: each body is ranked against people of ITS OWN body
  weight and age, so two people can read the same level at very different weights. "Advanced vs
  Advanced" would otherwise read as "the same lift"; the estimate under a tapped muscle is the number
  that answers who lifts more.

### D. Two layout faults, both found by MEASURING and neither visible to a test

1. **The level key fell below the fold on a laptop** — the figures drew 405×599 and put it at 852
   against a fold at 820. This ramp is legal *only* with the secondary encoding that key provides, so
   the key wins: capped, 255×377 on a laptop and 161×238 at 360px, visible at both.
2. **A friend's own map answered a tap by appearing to do nothing** — uncapped, it drew 640px of body
   on a 360×780 phone and put the panel below the fold. Same cap, same reason.
   ⚠️ **And the first fix for both was wrong in a way worth recording**: `--body-ar / 2` reads as
   "each column is half the width" and confuses the COLUMN with the PICTURE — one figure is already
   both bodies inside one viewBox. Halved, the laptop drew a 34×16 chest where the phone drew 43×20:
   a bigger screen showing a smaller body.

### E. 🚨 THE AUDIT SPENT FOUR RUNS MEASURING A BUILD TWO EDITS OLD

`python -m http.server` on a port that is already taken **exits immediately and silently**, so a
server left running by an earlier run kept answering — and `tools/a11y-audit.mjs` drove a browser
against it, reporting a full set of plausible numbers for a screen the source had not rendered for an
hour. Every hypothesis chased first (a stale scratch copy, an old Chrome on the debugging port, a
`cp` that wrote `js/js`) was wrong, and each was checkable in a way that made the real cause look
ruled out.

**It now refuses to run when the port is already serving**, names the command that identifies the
process, and tears down the service worker before measuring anything. It also grew an `ONLY=` filter,
because a full run is 124 routes and re-running all of it to look at one screen is long enough that
the temptation is to stop checking. *A measurement tool that silently measures the wrong thing is
worse than one that does not run: a failed run gets re-run, and a wrong one gets believed and written
into this file.*

### F. The demo has friends with bodies now

A friend's page used to say "Sharing is off in the demo" — right while it listed workouts, wrong the
moment it carried a tappable map, and it meant none of today's work could be looked at, measured or
audited anywhere. The demo's friends now carry an invented `gender`, `bodyWeight` and `age`, and
**their map goes through the same publisher yours does** (`buildStrengthShare`), so the fixture cannot
be a tidier shape than the wire — which is precisely how `sets: []` survived for months. Priya is
deliberately much lighter than Marcus, because the compare screen's own caption claims two people can
read the same level at very different body weights and a fixture where everybody weighs the same
could never show it.

**Tests: render 875 → 904, social rewritten around the two audiences, rules 159.**
**Audit: 124 route/width/theme combinations, 10,938 text nodes, zero below 4.5:1, zero horizontal
overflow, zero unnamed controls.**

⚠️ **NOT VERIFIED: no phone, and no two real accounts.** In particular **nobody has seen what a
public account looks like to a stranger** — that needs a second real account, and so does proving the
tier migration on an account that published under the old model. Open work 1.

⚠️ **ONE THING DOES NOT MEET 44px**: a muscle on the compare screen (Traps, 45×12 at 360px) — the
same class as Open work 0i, on Tim's illustration at half width. WCAG 2.5.8 is met by **equivalence**,
the year grid's argument: every muscle is reachable at full size one tap away, and every one carries
its level and confidence in its accessible name.

---

## 2026-09-03 — ⏸️ HOW TO RANK ABS: the two ideas assessed, and a third

Tim, immediately after the visibility work: *"I want to finally design a way to rank ab muscles on
the muscle group strength display. I have a few ideas, but I want you to see if there are any
problems or whatever with them… Let me know if you have any other ideas on this topic."*

**NOTHING IS BUILT. This is the assessment he asked for, and the decision is his.**

**The state of play.** Core is in `UNRANKABLE` (`js/strength-standards.js`) beside Neck, because
`MUSCLE_LIFTS` has no entry for it: *"Core's best exercises are time-based or bodyweight."* It paints
**grey**, and the only grey in the legend is **"No data"** — so somebody who trains abs three times a
week sees the colour of somebody who has never done a sit-up. That is the complaint, and it is worth
separating from "we cannot rank abs", because they are not the same problem.

### His first idea — estimate the numbers, or pull weaker data from somewhere

**Better than it sounds, and it does not fix as much as it looks like it does.**

- ✅ **The machinery needs nothing new.** The library already holds WEIGHTED core work — Cable
  Crunch, Machine Crunch, Decline Sit-Up, Russian Twist all record weight and reps. A cable crunch
  1RM is an ordinary weighted lift, so it can go through the identical path every other muscle uses:
  ratio → key lift → published median → log-normal percentile.
- 🚨 **BUT IT WOULD BE THE ONLY ENTRY IN THE TABLE WITH NO SECOND SOURCE.** `docs/research.md` §11 is
  explicit that the strength of the current medians is that two independent methods agree within
  ~3 % — ExRx-style body-weight ratios against Gravitus/Strength Level measured medians, lift by
  lift. For a cable crunch there is one source family (logging apps) and no independent cross-check,
  and the load is far more equipment-dependent than a barbell: stack weight through a pulley, with
  the leverage set by rope length, knee position and how much of the movement is hip flexion.
- ⚠️ **AND IT ONLY RANKS PEOPLE WHO DO WEIGHTED AB WORK.** Somebody whose core training is planks,
  hanging leg raises and ab wheel — which is most people — is exactly as grey afterwards.
- **Verdict: buildable, honestly, IF it is pulled properly** (a research pass into
  `docs/research.md` with a grade, per this project's own rule that nothing ships above the evidence)
  **and if it lands with the confidence model doing visible work** — the map already desaturates a
  thin rating and the panel already says "a rough placing". It would answer maybe a third of the
  complaint.

### His second idea — seed abs near the average of their other muscles, then track improvement

**This is the one with real problems, and they are not fixable by calibrating longer.**

1. 🚨 **IT PUTS TWO DIFFERENT MEANINGS IN ONE COLOUR.** Every other muscle's colour answers *"where
   do I stand among people like me"*. Core's would answer *"how much have I improved since the app
   started watching"*, seeded from unrelated muscles. Tapping Chest and Core would give two numbers
   that look identical and are not the same kind of fact. This is the fault the Volume map was
   careful to avoid on 2026-09-01 (the same drawing carrying two meanings) and it is Rule 5's whole
   subject.
2. 🚨 **THE SEED IS NOT A MEASUREMENT OF THE ABS AT ALL.** "Your other muscles average Intermediate,
   so your abs start at Novice" assumes ab strength tracks average trained strength. **Nobody has
   measured that correlation**, and this app's credibility rests on not inventing exactly this kind
   of number.
3. ⚠️ **IT BREAKS ON THE SCREEN BUILT TODAY.** Tim already spotted that the comparison settings leave
   it behind; side by side it is worse — Core would be the one muscle where two people's colours are
   not comparable to each other either, on a screen whose entire point is that they are.
4. ⚠️ **THE FROZEN SEED DRIFTS.** Get stronger everywhere and the seed you were given would have been
   higher — but it is frozen, so your abs read as improving. Recompute it and your abs level moves
   when you bench more.
5. The 2–4 calibration sessions are the least of it.

### The third option, and it is the one I would take

**Three parts, in the order they pay off:**

- **(a) FIX THE COLOUR, WHICH NEEDS NO NEW DATA AT ALL.** Give unrankable-but-trained muscles their
  own mark — a hatch, which survives greyscale and colour blindness — and their own legend entry
  ("Trained · can't be ranked"), and have the panel say **what HAS been logged**: sets this month,
  longest plank, heaviest cable crunch. This answers the actual complaint — *does this app know I
  train my abs* — without inventing a percentile. It was offered on 2026-09-01 and never taken up.
- **(b) THEN HIS FIRST IDEA, PROPERLY SOURCED**, for the people who do weighted core work: a real
  rating, one source, stated as such, desaturated by the existing confidence model.
- **(c) AND THE HONEST HALF OF HIS SECOND IDEA, WITHOUT THE INVENTED SEED.** What he is reaching for
  with "rank off their own improvement" is *progress on abs*, and that does not need a level at all:
  **"your hardest recorded core work is up 20 % since June"** on the panel is true, useful, needs no
  standards, and cannot be mistaken for a percentile because it is not one. No colour, no level, no
  comparison to other people — which is exactly why it is safe.

⚠️ **WHAT THIS DOES NOT DO IS RANK A PLANK AGAINST OTHER PEOPLE.** No published norms exist for it,
and none of the three parts above pretends otherwise.

---

*⚠️ The four 2026-09-02 sections below are ordered by importance rather than by clock, and each
heading says which pass it is: the feed summary first because it is the bulk of the day, then the
third pass (the estimator), then the second (back), then the feed's full write-up.*

## 2026-09-02, FIRST pass in four lines — THE HEVY-SHAPED FEED, ALL EIGHT STEPS

🆕 **A. THE FEED CARD IS A HEVY CARD NOW.** Under the title: their **description**, then a stat row
reading **TIME · SETS**, then **one row per exercise with the set count first** (five, then "See N
more"). 🚨 **SETS, NOT VOLUME — Tim's call, and it is also the only one of the two that can be
computed honestly for somebody else's session**: a friend's bodyweight work has no external load to
total and their body weight is not ours to have, so a pounds figure would have read a session of
pull-ups as nothing. ⚠️ **Duration LEFT the grey meta line** when it moved into the row — the same
number twice on one card reads as two facts, and a test pins that it is gone.

🆕 **B. TAPPING A CARD OPENS THE WORKOUT — a whole screen, at `#/friend/<uid>/<sessionId>`.** Poster,
absolute date, title, description, **TIME · SETS · EXERCISES**, kudos/comment/share, **bests set in
it**, a **muscle split as percentages of the session**, and **set tables whose header adapts to the
exercise** — `SET | WEIGHT & REPS` for a bench press, `SET | REPS` for a dip, `SET | TIME` for a
plank. 🚨 **A drop set is one numbered set with its minis hanging under it**, not three.

🆕 **C. THREE THINGS YOU CAN DO WITH SOMEBODY ELSE'S WORKOUT.** **Compare** an exercise against your
own (rep-normalised, windowed, and refusing to name a winner); **save it as your own workout** (set
counts carry, weights cannot); **share a picture of it** (canvas → PNG → the share sheet, no
backend). Each is a pure module with its own test file.

🆕 **D. A SESSION DESCRIPTION EXISTS AT LAST** — `note`, typed in the runner, capped at 280,
published at mid and above, shown on the card, the workout screen, the calendar and editable after.

🚨 **THE THREE FINDINGS.** ⚠️ **The demo fixture was thinner than the wire and every test passed
anyway** — friends' entries carried `sets: []` for months, the right shape and the wrong content,
and nothing noticed until the card started counting sets and said every friend had done none.
⚠️ **Two bugs were invisible to 1,200 assertions and obvious in one screenshot** — the share card
capping its list with empty space below it, and the friend page printing raw pounds to a kilogram
user. ⚠️ **A stated invariant was broken and the comment was rewritten rather than left standing**:
`personalBests()` claimed to be "Rule 5-safe by construction, no estimate anywhere in it", and the
1RM record is an estimate. It is now labelled in words and names the set it was estimated from.

**Audit: 96 route/width/theme combinations, 9,914 text nodes, zero below 4.5:1, zero horizontal
overflow, zero unnamed controls** — including **the first two routes behind `#/friend` this project
has ever audited**, which could not exist before today because a friend's uid is generated and there
was no hash to put in the list. The feed card's own link is the way in.

**Tests: render 802 → 855, plus three new suites** (`routine`, `share-image`, `compare`) and new
blocks in `data-layer` and `social`.

⚠️ **NOT VERIFIED: nothing here has been on Tim's phone, and no two real accounts have used it.**
Proved in jsdom, in the data layer, in a real browser at 360 and 393px in both themes, and by the
audit. The round trip between two people remains Open work item 1.

---

## 2026-09-02, THIRD pass — 🚨 EVERY EXERCISE HAS AN ESTIMATED 1RM, AND THE BENCHMARK SCREEN PREDICTS

Tim: *"if that person has an exercise that the site can estimate from another similar exercise, than
estimate it rather than say there are no recorded excersizes… I don't have any barbell rows recorded
and my friend does. However, I have dumbell rows, lat pulldowns, assisted pull ups… If the user has
no exercises recorded on a certain muscle group at all, then you can say that you can't compare.
Because of this system, a user should have an estimated 1RM on virtually every single exersize on the
site, with varying confidence levels."*

**Built, all of it.** `js/exercise-estimate.js` converts a muscle rating into any named lift;
comparisons use it where a side has never done the exercise; and the benchmark screen now shows the
predicted 1RM, what percentage of it the typed weight is, and roughly how many reps it allows.

🚨 **IT IS NOT A NEW MODEL AND THAT IS THE WHOLE REASON IT WAS SAFE TO BUILD.** The body map already
converts every recorded set INTO a muscle's key lift by dividing by a published ratio; this
multiplies back out. The session runner has done exactly this since 2026-08-26 to suggest an opening
weight for a lift you have never performed — the arithmetic shipped weeks ago and nobody had noticed
it was also the answer to this. What is new is the packaging: a confidence, the sources, and the
inverse rep prediction.

- ⚠️ **D14 DID NOT NEED REOPENING AND D18 IS STILL TIM'S.** This mixes benchmarks with workout sets
  because `rateMuscle()` does — and that was ruled not a breach on 2026-08-16 on grounds that apply
  here word for word: **D14 is about charting a TREND**, two sources on one line with one point per
  day discarding the loser, **and a single best estimate has neither problem**. D18 is a different
  question (the estimator's chart mode) and remains unanswered.
- 🚨 **AN ESTIMATE YOU READ IS NOT AN ESTIMATE YOU LIFT**, and the two now have different rules. The
  runner's opening-weight suggestion keeps its hard gates — ratio quality ≥ 0.45, confidence ≥ 0.35 —
  because it puts a number in a field somebody then walks up to a bar and attempts. The new module
  has no quality gate at all, because it answers a question a person asked while looking at a screen,
  and a wide answer with its width stated beats silence. Every result carries its confidence band and
  names the exercises it came from.
- 🚨 **A REAL DEFECT FELL OUT OF THIS: NO WEIGH-IN MEANT NO ESTIMATE FOR ANYTHING.** `muscleStrength()`
  refuses everything until sex, age and body weight are all on record — correct for a PERCENTILE,
  which is a claim about where you stand among other people, and wrong for a number of pounds
  converted from your own sets. Somebody with four months of training and no weigh-in was told the
  app had no idea what they could row. `muscleRatings()` is the same walk without the profile gate;
  body weight still matters where the LOAD depends on it, which is a refusal about a pull-up rather
  than about the account.
- ⚠️ **THE REP PREDICTION IS THE NUMBER MOST LIKELY TO BE WRONG AND IT IS WORDED THAT WAY.** It
  answers "reps to momentary failure", and `docs/research.md` §3 measured that people under-predict
  their own reps to failure by one to five — so somebody stopping where they normally stop will do
  fewer than it says. There is no reps-in-reserve field and never will be (D9), so the gap is
  invisible to the app and has to be stated instead: the caption reads *"maybe 9 to failure"*, never
  a target.
- ⚠️ **IT STOPS AT 15 AND SAYS "15+".** Above `MAX_EVIDENCE_REPS` this app refuses to infer a maximum
  FROM a set (D5); predicting a 30-rep set with the same curve would be that refusal held in one hand
  and ignored in the other. It is also the ceiling `progression.js` already enforces after it walked
  a 20 lb lateral raise to 37 reps — two screens, one refusal.
- 🚨 **TWO GRADED SOURCES IN THIS REPO DISAGREE AND THE PICK IS RECORDED.** `research.md` §2 (Nuzzo
  2024, 🟢) says ~9 reps at 80 % of a bench max; the Marzagão inverse the app now uses says ~7. The
  app uses Marzagão for **consistency**, not accuracy: every e1RM here comes from that curve, so
  predicting reps with a different one would mean a lifter who did the predicted reps produced an
  e1RM contradicting the estimate that suggested them. Both the module and §2 now say so.
- ⚠️ **AND §2'S TABLE HAS A TRANSCRIPTION ERROR** — it gives ~5 reps at both 95 % and 90 % 1RM, which
  cannot both be true. Flagged in place; nothing has ever been shipped off that row.
- ⚠️ **THE ESTIMATE FILLS EXACTLY ONE ROW OF A COMPARISON.** "Best estimated 1RM" is already an
  inference, so a converted number is at home in it. **"Heaviest set recorded" stays blank** for a
  side with no sets, however much the app thinks it knows — that row is a measurement, and a
  converted number in it would be a lie however well labelled. Rule 5 applied one row at a time.
- ⚠️ **BOTH SIDES ARE ESTIMATED OR NEITHER IS.** Estimating only mine would put my converted figure
  against their measured one every time I happen to be the one missing the lift — a bias with a
  direction, which is the same fault the comparison window exists to prevent. `muscleRatings()` now
  takes rows, so a friend's published training goes through the identical arithmetic.
- ⚠️ **`buildObservations()` WAS EXTRACTED OUT OF `store.js` TO MAKE THAT POSSIBLE** — the walk that
  turns sessions and benchmarks into per-muscle evidence, now `js/strength-observations.js`, with
  `today` handed in rather than read from a clock. **Proved identical byte for byte** over the demo
  year before and after, and there is a golden table in `tests/data-layer.test.mjs` pinning eleven
  muscles at a fixed date so it stays that way.

**Tests: render 863 → 875, compare +9, a new `tests/estimate.test.mjs` (27), data-layer +10.** The
load-bearing one is the round trip: `repsForWeight(e1rm(w, r), w)` must return `r` at every weight
and rep count, which a wrong exponent or a wrong k both fail and almost nothing else would catch.

**Audit: 100 route/width/theme combinations, 11,365 text nodes, zero below 4.5:1, zero horizontal
overflow, zero unnamed controls.** The benchmark screen joined the list **with an exercise picked and
a weight typed**, because everything added today only exists after that — the empty form is what the
audit had been reading for months.

⚠️ **NOT VERIFIED: no human has checked any of these numbers against a real attempt.** The whole
chain rests on a curve whose absolute accuracy was never validated (`research.md` §1.3) and on ratios
whose spread is a population's rather than a person's. That is why every figure ships with a
confidence and a source list rather than alone.

---

## 2026-09-02, SECOND pass — BACK MEANS THE SCREEN YOU WERE JUST ON (Design Rule 8)

Tim, on the feed shipped an hour earlier: *"When you click back on something it should always go to
what you were on right before. Currently when you click on someone else's workout and then go back,
it takes you to that user's profile/page rather than back to the home menu where you saw the post
on."*

🚨 **HE REPORTED ONE SCREEN AND IT WAS TRUE OF ALL FORTY-EIGHT.** Every `screenShell({ back })` in
this app hard-codes a parent, and a parent is the right answer only when you arrived from the parent.
The new workout screen simply made it obvious: it is the first screen in the app you routinely reach
from two different places, so it is the first one where a fixed destination is visibly wrong. **Every
older screen has the same fault and nobody had hit it** — a day reached from the calendar goes back
to the calendar, which is right, and there was no other way in.

**The whole fix is one function, not 48 edits.** `goBack(fallback)` in `js/ui.js`: go back through
history, and use the screen's own destination only when there is nothing behind this one. Design
Rule 8 in §5 has the reasoning; three things are worth having here.

- ⚠️ **THE POSITION IS STAMPED ON THE HISTORY ENTRY, NOT COUNTED.** The obvious build is a depth
  counter incremented on navigation — and it cannot work: a forward navigation and the browser's own
  back button both arrive as one `hashchange` with nothing to tell them apart, so the counter drifts
  the first time somebody uses the OS back gesture, and drifts silently. `history.state` travels WITH
  the entry, so an entry that has been visited already knows its own index however it was reached.
- 🚨 **`#/blank` HAD TO GO, AND IT WAS NOT OPTIONAL.** Nine places forced a re-render by setting the
  hash to `#/blank` and then back — two history entries, the first of which the router deliberately
  renders nothing for. The moment back meant "the previous entry", the arrow would have landed on a
  screen that does not exist and appeared to do nothing. `refreshRoute()` re-renders in place instead,
  which is what all nine of them were describing anyway. The router still guards `blank` for tabs
  open from before today.
- ⚠️ **ONE SCREEN OPTS OUT AND IT IS THE FINISH SCREEN** (`backExact: true`). Its arrow means "go and
  edit what you just recorded" — Tim's own ask on 2026-08-29 — and history would be actively wrong
  there, because that screen is drawn by replacing `#app` WITHOUT changing the hash, so the entry
  behind it is the session runner whose draft has just been cleared. Stepping back onto it would
  reopen a workout that no longer exists.
- ⚠️ **A BUG THE TESTS HID FROM THEMSELVES, worth remembering.** `tests/render.test.mjs` assigns
  jsdom's `window`, `document` and `location` onto `globalThis` and never assigned `history` — so the
  first version of this read `history.state` and threw a ReferenceError **inside a click handler**,
  which jsdom reports to its virtual console and swallows. The button silently did nothing and the
  only symptom was one unrelated-looking assertion failing with no stack anywhere near the cause.
  Fixed in both places on purpose: `ui.js` goes through `window.history` (the guard keeps the app
  working), and the harness now assigns it (which keeps the test honest).

**Verified in a real browser, not only in jsdom:** Home → tap a card → the workout screen → back →
**Home**, with all 21 cards still there. Eight new assertions in `tests/render.test.mjs` pin the
mechanism — the fallback on a cold start, the real back on a second screen, the `backExact` opt-out,
and that `refreshRoute()` moves nothing.

~~⚠️ **A KNOWN ASYMMETRY, LEFT DELIBERATELY:** in the demo account a card's *body* opens a real
workout screen while its *name* still leads to "Sharing is off in the demo".~~ ✅ **CLOSED
2026-09-03.** The demo's friends have pages now, with bodies computed by the real publisher — it had
to happen, because a friend's map became tappable and none of it could be looked at, measured or
audited anywhere else. What the demo still refuses is the parts that act on a real account:
no visibility row, no disconnect, no add.

---

## 2026-09-02, FIRST pass in full — the feed, the details worth carrying, and the traps

*The full step-by-step record is `docs/social-plan.md` §13, with a ✅ block under every step. This is
what belongs here rather than there.*

**Five new pure modules, each with its own tests**, because the rule in this project is that
arithmetic lives outside a view: `js/session-stats.js` (a session's own set counts),
`js/personal-bests.js` (extracted out of `views-session.js` and typed), `js/routine-from-session.js`,
`js/compare.js`, `js/share-image.js`. **One new screen**, `FriendSessionView` in `js/views-social.js`.

- 🚨 **`recordedSetCount()` MOVED OUT OF `store.js` RATHER THAN BEING COPIED.** The Volume tab, the
  feed card and the workout screen must never disagree about whether a set was done — and typing
  warm-ups is precisely the change that would make two copies drift apart. One definition, three
  callers. That is the same argument the 2026-09-01 window helper made, applied one level down.
- ⚠️ **THE NEW ROUTE HANGS OFF `friend` AND IS NOT A ROUTE OF ITS OWN.** `FULLSCREEN` and the Home
  tab's `match` list in `app.js` already name `friend`; a new name would have needed both updated in
  lockstep with **nothing to catch it if they were not** — `resolve()` falls through to `HomeView()`,
  which is how `#/data` was audited as Home for two days. `#/friend/<uid>/<sessionId>`.
- ⚠️ **THERE IS NO PER-SESSION READ AND THERE CANNOT BE ONE.** A friend publishes one document per
  tier holding up to sixty sessions and Firestore grants per document, so this screen reads the same
  document their page reads and finds the session by id. It costs what opening their page costs and
  is served from the same 30-second read cache. **A workout that has scrolled off that window is a
  normal outcome**, and the screen names both reasons it happens.
- 🚨 **A FRIEND'S "BEST" IS NOT A PERSONAL RECORD AND THE SCREEN SAYS SO.** Sixty published sessions
  are not a life. That is Rule 5's general form arriving from the direction of *scope* rather than of
  inference, and it is why the Records column is on the workout screen and **not on the card** —
  the count is honest only next to the sentence that qualifies it, and that sentence does not fit
  beside somebody's name.
- 🚨 **THE COMPARISON IS WINDOWED, AND A FOOTNOTE WOULD NOT HAVE DONE.** Their history is sixty
  sessions and mine is my whole life; comparing the two flatters me every time, in the same
  direction, so it does not average out. `compare.js` cuts both sides to the overlap and names it.
  ⚠️ **Its test is paired with a control** — the same fixture run twice, once with my old PR outside
  their window and once inside, asserting the two runs disagree — because a window test whose answer
  is the same either way proves nothing.
- ⚠️ **`entryLine()` ON THE FRIEND PAGE WAS PRINTING RAW POUNDS.** The projection publishes canonical
  pounds and that line printed `s.weight` straight out, so a friend's 100 kg squat read as "100" to a
  lifter whose whole app is in kilos. It goes through `fmtSet` now. Nobody had reported it; it was
  found by rendering the screen beside a new one that did it correctly.
- ⚠️ **`fmtSet` WRITES REPS AS "× 12"** because everywhere else they follow a weight. In a table with
  its own REPS column the multiplication sign is left over from a number that is not there, so the
  workout screen strips it **locally** — `fmtSet` is right for its six other callers.
- ⚠️ **THE DEMO FIXTURE IS PART OF THE PRODUCT.** `buildDemoFeed()` now publishes real sets, real
  library ids, descriptions on about a third of sessions, and **one exercise deliberately absent from
  the library** (`Reverse Nordic Curl`) — because a friend logs what *their* app knows about, and the
  workout screen has to render an exercise it cannot look up without dropping it, mislabelling it, or
  breaking the muscle split. There was no fixture for that case until today.
- ⚠️ **`feedActions()` IS EXPORTED NOW** so the workout screen carries the same kudos/comment/share
  row. A second implementation would have been two places that must agree about a missing anchor, a
  demo that must refuse, and an optimistic update.
- ⚠️ **THE ACCESSIBILITY AUDIT GREW TWO ROUTES AND THEY ARE REACHED BY CLICKING**, not by hash — a
  friend's uid is generated, so `#/friend/<uid>` never could be in that list. Both steps **throw if
  they did not land**, per that file's own rule.

**Six agents ran in parallel and every one returned working, tested code.** The lesson from
2026-08-19 held: the failure then was seven agents launched at once into the same files. This time
each had a written brief, an explicit list of files it owned, and an explicit list it must not touch
— and the only collision all session was four of them appending to the same precache list in `sw.js`,
which is a failed edit rather than a corruption.

---

## THE PREVIOUS SESSION (2026-09-01)

🆕 **A. WEEKLY SETS PER MUSCLE IS ON A SCREEN — D3, THE METRIC THIS FILE HAS CALLED THE HEADLINE ONE
SINCE DAY ONE.** Data → **Volume**: every muscle, sets a week, from what was RECORDED. 🚨 **Two
functions now answer "how much work is this muscle getting" and a test asserts they agree** — the
Goals screen's and this one's — because two screens quoting different weekly counts for somebody's
chest would be worse than either screen existing. ⚠️ **The tiers are NOT targets and the screen says
so outright**; the only threshold drawn is the 4-sets-a-week minimum the source states. 🚨 **Tap a
muscle and it names the exercises behind the number, in the SAME UNIT — which the first version got
wrong.**

🆕 **D. HEVY'S FEED IS PULLED APART IN `docs/social-plan.md` §12 — RESEARCH, NOTHING BUILT.** Tim
wants the home page *"extremely similar to how Hevy does it"*. 🚨 **The finding: most of a Hevy card
is already in our projection and simply is not rendered** — sets, reps, weights, duration and
location all publish at mid, volume and muscle split are derivable client-side, and the description
is the only field we do not store at all. **Eight steps, each shippable alone, none needing money.** ⚠️ **§12.13 corrects §12.12 from a NEWER build found on their own site** — the stat row is three columns (Time · Volume · Records 🏅), the description sits under the title, and **the card is a swipeable pager: media on page one, the exercise list on page two**. 🚨 **And their visibility is PER WORKOUT where ours is per person** — a real feature difference, not a rename. §12.14 is our card beside theirs, driven in the demo: six differences, the biggest being that we show no stat row at all. 🆕 **AND TIM SENT THE ONE SCREEN NO AMOUNT OF SEARCHING FOUND** — the expanded workout, §12.15: a six-cell stat grid, a muscle split as PERCENTAGES of the session, and set rows where **a warm-up is typed `W` by the lifter** and **PRs hang under the set that earned them, typed Weight / Volume / 1RM**. 🚨 **That warm-up marking is a better answer to Open work 0c than either option that was on the table**, because it is the only one where the app does not guess.
⚠️ **Photos need Blaze (Tim's call) and heart rate needs a native app**; the discovery feed is
recorded as the thing D7 actually refused. ⚠️ **Nobody here has opened the app** — the analysis is
from their published docs and says nothing about how it looks.

🆕 **C. THE VOLUME TAB IS THE BODY MAP NOW, PAINTED RED-TO-GREEN BY SETS.** Tim's ask, same figure as
the Muscles tab, bars kept below it. 🚨 **Red-to-green is the worst pairing there is for colour
blindness and it is legal here only because the ramp has strictly monotone lightness** — the order
survives protanopia, deuteranopia and tritanopia in simulation — **and because the legend, the
labels, the panel and the bar list all state the number in words.** ⚠️ **This map has no grey**: zero
sets is a number, so every muscle says something true.

🆕 **B. THE APP MOVES NOW, AND IT IS A SYSTEM RATHER THAN A PILE OF TRANSITIONS.** Tim: *"when you
click on something, I want it to have some sort of visible motion between the movement rather than
just an instant change or teleportation… realistic acceleration in how they start and stop… keep it
quick… only use it when it's appropriate."* Four durations, three easings, **Design Rule 7**, and a
blanket `prefers-reduced-motion` switch. 🚨 **NOTHING ON THE LOGGING PATH ANIMATES except a press
answering back** — that is what "appropriate" means in a gym app. ⚠️ **Verified in a real browser
through `getAnimations()`, not by screenshot**: jsdom cannot run a transition, and a 170ms movement
is one frame of luck in a picture.

---

## 2026-09-01 — DATA → VOLUME: WEEKLY SETS PER MUSCLE

Offered three things worth doing and asked which; Tim picked **weekly sets per muscle**.

**D3 has called this the headline metric since the first day of the project** — hypertrophy responds
to hard sets per muscle per week — and the app has been able to compute it for a year.
`weeklyVolume()` rates every programme in the library with it. What it had never done is **show you
your own**: the number existed for **one goal muscle** on a screen most people never open. Data →
**Volume** is that number for all twelve, counted from recorded sessions rather than from a plan.

- 🚨 **ONE WINDOW HELPER, TWO CALLERS, AND THE LOAD-BEARING TEST IS THAT THEY AGREE.**
  `trainingForMuscle()` (Goals) and the new `weeklyVolumeByMuscle()` (this screen) must return the
  same sets-a-week for the same muscle on the same day. The window, the day index, the two-week floor
  and the "a set with no numbers was never done" filter are now defined **once** — the second caller
  copying them is exactly how the Goals screen's hand-written paraphrase of `INDIRECT_NOTE` quietly
  lost the words *"not a measured fact"*.
- ⚠️ **AND THE FIRST VERSION OF THAT TEST WAS VACUOUS.** The fixture logged 3, 3, 3, 3 sets on four
  evenly spaced days, which reports the **same** rate over any window inside it — so a mutation
  giving one of the two functions a different window passed unnoticed. The fixture is 4, 4, 2, 2 now,
  and the mutation fails. **An even fixture cannot test a rate.**
- ⚠️ **THE TIERS ARE NOT TARGETS, AND THE SCREEN HAS TO KEEP SAYING SO.** They are Pelland et al.'s
  published efficiency bands and they describe **what another set buys** — "lower efficiency" means
  each extra set does less, not that you are doing too much. So nothing is coloured good or bad, one
  colour draws every bar, there is **no target line**, and the only threshold marked is the one the
  source states outright: **4 sets a week**, below which no detectable change is expected. Rule 6 —
  "more is better up to a point and worse after it" is not a finding this evidence supports.
- 🚨 **TAP A MUSCLE AND IT NAMES THE EXERCISES BEHIND THE NUMBER — AND THE FIRST VERSION DID NOT ADD
  UP.** The row read **21.8 a week** over a list reading **24, 21, 18**: the store counts a window and
  the row divides by it, so the detail was quoting a different quantity in the same column. A
  fractional weekly set count is derived through a rule most people have never heard of, and **a
  derived number nobody can check is one people either over-trust or stop believing** — so the parts
  now add up to the whole on screen, in the same unit, and a test sums the rendered figures against
  the rendered headline. Caught by a screenshot, not by a test; the test came after.
- ⚠️ **THE PER-SESSION CEILING IS SPREAD ACROSS THE EXERCISES THAT CAUSED IT.** `weeklyVolume()`
  clamps a single session at 24 sets on one muscle (the top of the measured range); the contributors
  are scaled by the same factor, or a screen naming four exercises adding to 30 above a total reading
  24 would be unauditable. Below the ceiling — everywhere real training lives — the factor is exactly
  1 and nothing is touched.
- ⚠️ **UNDER A FORTNIGHT IT REFUSES TO STATE A RATE**, and this is where it deliberately parts company
  with the Goals version. `trainingForMuscle()` returns **null** below a two-week span because it
  feeds a sentence. A screen can do better than an empty state: it shows the **totals so far**,
  labelled as totals, and says a weekly figure measured over a few days is noise.
- **Every muscle is listed, including the ones on zero.** "No calf work for a month" is the finding;
  omitting calves would answer a different question quietly. Mutation-checked.
- ⚠️ **IT COUNTS EVERY SET YOU LOGGED, WARM-UPS INCLUDED, AND SAYS SO ON THE SCREEN.** That is Open
  work 0c and it is still **Tim's call** — excluding light sets would also throw away back-off work,
  which is often the hardest set of the session. Until he decides, the screen states what it counts
  rather than quietly counting something else. Same treatment for Core, which is understated for
  everyone because squats, deadlifts, carries and overhead work all train it and none log a set
  against it.
- ⚠️ **THE FIFTH SEGMENT WAS MEASURED BEFORE IT SHIPPED, because this project's own note twice said
  to.** Driven at 360px in both themes: the row is **293px**, the five labels render
  **63 + 60 + 51 + 39 + 68 = 281px**, `scrollWidth === clientWidth` throughout, and **the four that
  were already there came out the same width they were with four segments** — nothing was squeezed.
  ⚠️ **That leaves 12px: a SIXTH does not fit**, and the next one costs a label.

**Audit: 88 route/width/theme combinations, 8,330 text nodes, zero below 4.5:1, zero horizontal
overflow, zero unnamed controls.** Volume is two new audit routes — the list, and one muscle
**opened**, because the contributors and the tier sentences are not in the DOM until somebody taps a
row (the same reason the Research topics and the muscle panel have their own).

**Tests: render 751 → 777, data-layer +6 assertions.** Five mutations, each flipping only its own:
contributors unscaled by the clamp → the "parts add up" assertion; listing only trained muscles →
the twelve-rows and zero-muscle ones; a divergent window in `trainingForMuscle` → the agreement one;
contributors left in window units → the on-screen sum; dropping the warm-up admission → that one.

⚠️ **NOT VERIFIED: nothing here has been on Tim's phone**, at his instruction this session. It is
proved in jsdom, in the data layer against fixed dates, and as painted pixels at 360 and 393px in
both themes.

---

## 2026-09-01, third pass — THE BODY MAP, COLOURED BY SETS

Tim: *"I would love it a lot more if it just displayed the same thing, but did the exact same human
body display with the coloured muscle groups (exact same picture), but instead coloured them by the
number of sets for that muscle group rather than strength. For now, lets try having the muscle groups
be colored on a range from red to green. very green is more sets, very red is no sets… Keep the bar
display as an option to see below the human display."*

**Built exactly that.** The Volume tab opens on the same figure the Muscles tab uses — same art, same
tap targets, same halos — painted from weekly sets instead of strength, with the five-band legend
under it, the picked muscle's working under that, and the bar list still below.

🚨 **THE RAMP IS RED-TO-GREEN, WHICH IS THE WORST-KNOWN PAIRING FOR COLOUR BLINDNESS, AND IT SHIPPED
ANYWAY — HERE IS THE ENTIRE JUSTIFICATION.** Roughly 8 % of men cannot separate those hues.
`tools/volume-ramp.mjs` generates the five steps and measures three things, and the ramp is legal
only while all three hold:

1. **STRICTLY MONOTONE LIGHTNESS.** OKLCH L **0.36 → 0.63**, ΔL ≥ 0.05 a step, and the order still
   runs darkest-to-lightest **under simulated protanopia, deuteranopia and tritanopia**. That is what
   makes it a scale rather than a rainbow, and it is the construction viridis uses. **Under
   deuteranopia the hue is gone and the order is still there.**
2. **It reads as paint on both papers** — worst step **1.89:1** on the dark theme's `#C2C6C0` and
   **3.28:1** on white, against the **shipped strength ramp's 1.06 and 1.84**. ⚠️ **The bar is the map
   already on screen**, deliberately: a muscle fill is enclosed by the ink layer's own black keyline,
   and holding a new ramp to a standard the existing one fails would be theatre.
3. **Adjacent ΔE under deuteranopia is 4.7 — inside the floor band, survivable ONLY with secondary
   encoding.** So the encoding is load-bearing rather than decorative: **the legend names all five
   bands in words, every muscle's accessible label and tooltip states its number, the panel states it
   again on tap, and the bar list carries all twelve.** Remove any of those and this ramp stops being
   defensible.

- ⚠️ **THE BANDS LIVE IN `js/volume-map.js` AND THE COLOURS IN `css/app.css`, AND NEITHER FILE OWNS
  BOTH.** The tool imports `VOLUME_SHADES` and attaches an OKLCH coordinate to each key, so a
  threshold cannot be moved in one place and leave a colour for a band that no longer exists.
  **`tests/a11y.test.mjs` regenerates the five hexes and requires the stylesheet to still be showing
  exactly those** — which is what makes "never hand-edit" more than a comment.
- 🚨 **THIS MAP HAS NO GREY, AND THAT IS THE PART WORTH NOTICING.** The strength map paints an
  unrankable muscle the same grey as "no data" — the abs complaint at the top of this file. **Zero
  sets is a number**, so every muscle here is painted and says something true. It is not the fix that
  was offered for that complaint, and it does not close it, but somebody asking "does this app know I
  train my abs" now has a screen that answers yes.
- ⚠️ **THE SAME DRAWING NOW CARRIES TWO MEANINGS, so everything that STATES what a colour means is
  per-screen.** `bodySvg()` took its accessible label — *"coloured by strength level"* — as a
  constant; on this screen that sentence would have told a screen-reader user the opposite of what is
  on it. It is a parameter now, and a test asserts this figure says **sets** and never **strength**.
- 🚨 **ONE SELECTION, THREE PLACES.** Tapping a muscle on the body, and tapping its row, are the same
  act — the figure's outline, the panel and the row all read one variable. **Mutation-checked**:
  letting the figure keep its own selection (which is what `views-muscles.js` does, where there is no
  list to stay in step with) flips exactly the two assertions about them agreeing.
- ⚠️ **THE ROW STOPPED EXPANDING, and that reverses something built this morning.** With the working
  in the panel above, a row that also opened its own copy would be the same block on screen twice —
  **the fault Tim named on the set row** (*"it doesn't have 2 places for the same thing"*) arriving on
  a different screen. The row selects; the working has one home.
- ⚠️ **Two things measured rather than eyeballed.** Left to its own aspect ratio the figure filled a
  360×720 phone **exactly**, so the screen arrived as a red-and-green body with no key in sight — on
  a ramp that is only allowed to ship *because* the key is there. It is capped at 44dvh. And the
  strength map's **38 % dimming of everything unselected** washes this one out to pale greys with a
  coloured hole in it, because here the comparison BETWEEN muscles is the point; it is 72 % on this
  figure.

**Audit: 88 combinations, 8,374 text nodes, zero below 4.5:1, zero overflow, zero unnamed controls.**
**Tests: render 785 → 802, a11y 97 → 105.** Two mutations, each flipping only its own.

### Two follow-ups the same session, and one of them was a misreading worth keeping

Tim: *"The display is really small right now. Make it as big as the main muscle group (strength)
display."*

⚠️ **AND ON A PHONE IT WAS ALREADY 44 % BIGGER THAN THAT ONE** — measured at 393px, chest 89×42
against the Muscles tab's 62×29. **The report was still right, and measuring is what found where.**
An SVG with a viewBox never crops: given a box of the wrong shape it SHRINKS and pads the rest. The
container was full-width and short, which is fine on a phone and is a small body floating in a lot of
nothing on a laptop — where the Muscles tab, laid out as a side column, draws its chest at 120×56
against this one's 90×43. **The box carries the drawing's own aspect ratio now** (`BODY_ASPECT`, out
of `body-map.js`), so it is exactly the picture's shape at every width — width-limited on a phone,
height-limited on a desktop, padded on neither.
- ⚠️ **THE LAPTOP CAP IS 71dvh RATHER THAN THE 76 THAT WOULD MATCH EXACTLY, and the difference was
  bought on purpose**: at 76dvh the chest matches at 122×57 and **the legend lands 12px below the
  fold**. This ramp is defensible only while its key is on screen, so the key won. 110×52 — 92 % of
  the Muscles tab — with the legend at 829 against a fold at 860.

Tim, on the window chips: *"The ranges for what's 'good' or not should be dependent on the time range
that you're selecting… 10 sets is really good for 1 week, but bad for 12 weeks."* Then, before
anything was built: *"Stop. I realize now It's meaning sets per week, so I don't think it needs
changing at all."*

🚨 **HE IS RIGHT THAT IT NEEDS NO CHANGE, AND THE FACT THAT IT COULD BE READ THE OTHER WAY IS THE
FINDING.** Every number on the screen is a RATE, so the bands are the same at every window — measured
across the demo year: Shoulders reads **22.9 / 21.6 / 20.9** sets a week at 4, 8 and 12 weeks.
Picking a longer window measures a longer stretch; it does not ask more of you. **Scaling 4, 10 and
20 by the window would compare somebody against a target the literature never states** — those are
weekly doses.
- ⚠️ **WHAT WAS ACTUALLY WRONG WAS THE KEY, which had no unit on it.** Five chips reading "10–19"
  directly under a control offering **4 weeks / 8 weeks / 12 weeks** is a number with no unit beside
  a control that looks like one. The legend says **SETS A WEEK** now, and the notes say outright that
  the bands do not move with the window. **A screen that can be read two ways has already failed
  once, whatever the arithmetic underneath it is doing.**

⚠️ **NOT VERIFIED: not on a phone, and — the one that matters for this pass — no colour-blind person
has looked at it.** Everything above is simulation. If Tim knows somebody with a red-green
deficiency, ten seconds of them looking at the figure is worth more than the whole of section 3.

---

## 2026-09-01, second pass — THE APP MOVES

Tim: *"I want to work on some 'animation' or smooth transitions throughout the [site]. When you click
on something, I want it to have some sort of visible motion between the movement rather than just an
instant change or teleportation. Additionally, if these movements have some sort of realistic
acceleration in how they start and stop that would be cool as well. Make sure to keep it quick
though, I don't want it to be something that is distracting or slow for the user to deal with. Only
use it when it's appropriate as well."*

**Four constraints in one paragraph, and they are the specification.** Motion, easing at both ends,
quick, and selective. What shipped is a system rather than a scattering of transitions:
**`--t-fast: 100ms` / `--t: 170ms` / `--t-slow: 240ms`** and three easings — decelerate for things
arriving, accelerate for things leaving, both ends for a thing moving from A to B while you watch it.
**That third one is the "realistic" one**; it is the only one that reads as an object with weight.

🚨 **DESIGN RULE 7 IS THE DURABLE VERSION OF THIS AND IT IS IN §5.** Motion states a relationship —
where something came from, where it went, what pushed what — and anything that does not answer "what
just happened" is decoration and does not ship.

**What moves, and why each one earns it:**

- **A screen arrives** with a 6px rise and a fade. ⚠️ **NOT a horizontal slide, and the reason is
  honesty rather than taste**: a sideways push claims a stack — *you went forward, back is that way*
  — and this router cannot know which way you went, because `#/home` is reached by tapping Home, by a
  back gesture and by a redirect after saving. A movement that says something false about where you
  are is worse than no movement.
- **A sheet leaves.** Arriving was animated already; **leaving never was, anywhere in the app**,
  because a removed node is simply gone and CSS gets no say. 🚨 **THE CLASS IS RENAMED ON THE WAY
  OUT** — `.sheet` becomes `.sheet-x` — so a closing panel **stops matching `.sheet` the instant it
  is asked to close** and nothing can find, focus or assert against a surface on its way off. The
  layout rules carry both names and only the animation differs.
- 🚨 **AND THAT RENAME IS NOT ENOUGH ON ITS OWN, WHICH COST AN HOUR AND IS THE FINDING OF THE PASS.**
  It hides the container, not what is inside it: a dismissed sheet's **rows still match
  `.search-results .row`** for as long as it is painted, and the swap test duly picked an exercise out
  of a sheet that had already been closed, leaving the picker underneath it open. In a browser
  `pointer-events: none` makes that unreachable to a finger; **in a test harness there are no fingers,
  only selectors.** So `leave()` removes the node outright wherever nothing can animate — under
  `prefers-reduced-motion`, and in jsdom, which has no `Element.animate`. The tests measure exactly
  what they measured before, and the app animates.
- 🚨 **THE SEGMENTED PILL SLIDES, AND IT IS THE ONE TIM DESCRIBED.** Tapping "Bars" painted a pill
  under your finger and unpainted the one you left — two instant changes with nothing joining them.
  One pill travels now. ⚠️ **It is driven by a `MutationObserver` on `aria-selected`, not by the click
  handlers**, because five of these controls are built in four files and one rebuilds its own buttons;
  watching the attribute that already means "chosen" costs those files nothing. ⚠️ **And the painted
  pill is still in the stylesheet as the floor** — `.has-ind` is added by the JS and is the only thing
  that switches it off, so the control can never end up with no visible selection and never with two.
- **A volume row opens by animating `grid-template-rows`**, which is the only honest way to make the
  rows below it *slide* rather than jump. ⚠️ **This forced a better structure**: every detail is now
  built collapsed rather than created on tap, because a node inserted already-open has nothing to
  transition from.
- **The volume bars grow to their number** when the screen is built or its window changes — the number
  really did just change, and the growth is what says by how much. Not on a row tap, where nothing
  moved.
- **A press answers back** in 100ms on rows, chips and segments: the background fades instead of
  blinking and the box gives slightly.

⚠️ **AND THE PART THAT IS ABOUT RESTRAINT: NOTHING ON THE LOGGING PATH ANIMATES.** The set list, the
steppers and the rest timer are used one-handed with a bar in the other, and 170ms between tapping +
and seeing the number is 170ms of standing there. That is what *"only when it's appropriate"* means
in an app for a gym, and it is the one place this pass spent no time at all.

⚠️ **`prefers-reduced-motion` IS A BLANKET AND IT IS NOW TESTED.** Sliding panels are genuinely
unpleasant with a vestibular disorder, and this is an app somebody may be using while already moving.
`tests/a11y.test.mjs` pins that the block exists, that it kills **both** animations and transitions
with `!important`, and that it covers `*` — the browser audit can never catch its removal, because it
never sets the media query. The same block also asserts **no duration exceeds 250ms**, which is
"keep it quick" turned into a number that fails.

**Three bugs came out of building it, and two were invisible:**

- ⚠️ **THE TOAST HAS BEEN POPPING IN OFF-CENTRE SINCE IT WAS WRITTEN.** It is centred with
  `translateX(-50%)` and borrowed a shared `rise` keyframe whose `from` sets `transform:
  translateY(18px)` — which drops the centring for the length of the animation. It has its own
  keyframes now, carrying both parts.
- ⚠️ **`minmax(0, 0fr)`, NOT A BARE `0fr`.** A bare `0fr` track is `minmax(auto, 0fr)`, so its
  automatic minimum is the item's min-content height: the closed row measured **14px** in Chrome —
  exactly the detail's own padding — which would have left twelve slivers of dead space down the
  list. `overflow: hidden` and `min-height: 0` on the item do not help.
- 🚨 **THE AUDIT WAS COUNTING TEXT NOBODY COULD SEE, FOR THE THIRD TIME.** A collapsed row's wrapper
  measures 0, but its contents keep their own boxes — clipping is not layout — so 173 text nodes
  inside twelve unopened rows were being counted as measured (8,330 → 9,634 and back). Never a false
  PASS; always a false **coverage** claim, which is the `#/data` fault and the closed-`<details>`
  fault arriving a third time. `tools/a11y-audit.mjs` now excludes them and **the general rule is
  written beside it for whoever adds the next collapsible.**

⚠️ **HOW THIS WAS VERIFIED, BECAUSE IT IS NOT THE USUAL WAY.** jsdom cannot run a transition and has
no `Element.animate`, and a screenshot of a 170ms movement is one frame of luck. So the motion is
proved in a real browser over CDP through **`getAnimations()`** — which reports what the engine is
actually running on an element: 14 checks, all passing. The pill was watched interpolating
**2px → 79px → 223px**; the closed row measures **0px** and opens to **233px** with a running
`grid-template-rows` transition; a closed sheet is a `.sheet-x` playing `sheet-out`, is **not** a
`.sheet`, has `pointer-events: none`, and is gone afterwards.

**Audit: 88 combinations, 8,330 text nodes, zero below 4.5:1, zero overflow, zero unnamed controls**
— the same node count as before the pass, which is what the coverage fix was for. **Tests: render
777 → 785, a11y 87 → 97.**

⚠️ **NOT VERIFIED: none of this has been felt on a phone.** Whether 170ms is the right amount of
politeness for a thumb is Tim's call, and headless Chrome cannot answer it. **The numbers are in one
place if he wants them changed** — `--t-fast` / `--t` / `--t-slow` at the top of `css/app.css`.

---

## 2026-08-31 IN EIGHT LINES

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
part-way through — so every screen can be judged without logging any of it. 🆕 **Since 2026-09-03 it
also has three FRIENDS with pages of their own**, two of them carrying an invented sex, body weight
and age so their muscle maps can be computed by the same publisher a real account uses — without
them, none of the friend screens could be looked at, measured or audited anywhere. ⚠️ **It never touches
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
~~Both bounce through `#/blank` now.~~ ⚠️ **`#/blank` was deleted on 2026-09-02** — bouncing through
it pushed two history entries, which broke the back arrow the day back started meaning "the previous
screen" (Rule 8). Both call `refreshRoute()` instead, which re-renders in place. Struck rather than
rewritten because this is a dated section and the reasoning below it is still why they re-render.

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

