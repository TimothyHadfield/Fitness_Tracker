# Fitness Tracker — Progress & Context

> 🟢 **FRESH SESSION: READ THIS FILE, `docs/handbook.md` AND `docs/state.md` — ALL THREE, BEFORE
> DOING ANYTHING.** This one is **what is true now and what is left**. The handbook is **how to work
> here** — the environment traps, the working agreement, the architecture, the binding design rules
> and the locked decisions. `docs/state.md` is **what the app currently does**, screen by screen.
> **522 KB together as of 2026-09-26** (157 + 216 + 149), and none of it is optional. ⚠️ Each file
> has a byte budget with a test behind it — see §0.3. 🚩 **The handbook is the tight one now** (215 of
> 220 KB, ~4.5 KB free).
> 🔄 ~~**THIS FILE LIVES AT ITS CEILING**~~ **AND IT DID FOR SIX SESSIONS, UNTIL 2026-09-22.**
> 2026-09-21 opened it with **one byte free** and tripped the budget test **five times** while writing
> one day's summary. ~~🆕 **There are 7 KB free now, on purpose**~~ 🆕 **AND THREE BUILD SESSIONS
> SPENT IT: ABOUT 2 KB FREE AS OF 2026-09-25**, and **2026-09-26 collapsed first (the 💷 block and
> the 09-25 summary) and left ~2.6 KB**. 🔒 **The lesson is the ORDER — collapse before you
> write, not after** — and 2026-09-25 is the worked example: it collapsed **four** dated blocks
> (09-21, -22, -23 and the 09-16-to-20 group) and still only got back to 2 KB.
> 🚨 **AND ONE OF THOSE BLOCKS HAD GONE FALSE, WHICH IS THE REAL ARGUMENT FOR COLLAPSING.** The
> *"WHERE 2026-09-21 STOPPED"* note said the estimate was still a truncated reading of the set — true
> when written, removed by the 09-25 fix, and left sitting at the top of the file telling a fresh
> session something untrue. **A "what to expect" block outlives the thing it describes.**
> ⚠️ **NEXT CANDIDATE, and it needs no new prose**: the sub-agent entry under Standing instructions
> has grown six dated layers and is METHOD, so it belongs in the handbook — ⚠️ **measure it first**,
> since the handbook has ~4.5 KB free. ~~The 💷 running-costs block~~ was collapsed 2026-09-26.
> 🛑 **The fix is never to raise the number**: the failure message names what to move and where.
> ⚠️ **The best collapses put a durable rule where it is actually looked for** — three have gone into
> `docs/handbook.md` rather than being deleted, most recently §0.21.
>
> 🚨 **EVERY `§N` REFERENCE IN THIS PROJECT MEANS `docs/handbook.md` — EXCEPT `§3`, WHICH IS
> `docs/state.md`.** `§4` the architecture, `§6` the locked decisions, `§9` the known gaps, `§0.10`
> the demo account; **`§3` is what the app currently does** and it moved out on 2026-09-08 when the
> handbook reached 215 KB of its 220 KB budget. **The numbers have never changed — only the files
> they live in.**
>
> **`docs/history.md` is the dated log** — every session's full write-up, newest first. You do not
> read it; the recent ones are summarised below and you go there for the detail, searching by date.
> ⚠️ **It is larger than one read** (756 KB): grep it for the date, then read that range.
>
> `chat.md` is the human-readable log and answers "what did we say about X"; it starts at
> **2026-08-29**, with everything from 2026-08-14 to 08-26 in `docs/chat-archive.md`.
>
> 🚨 **AND READ `docs/direction.md` — it is short, it is newer than the handbook, and it OVERRULES
> it.** On 2026-09-04 Tim was interviewed about what this project is for, and **four standing rules
> were reversed by his answers**: the blanket honesty refusals, the discovery-feed ban, the
> "not verified on a phone" warnings, and how visuals may be touched. **The handbook still contains
> the old versions in places** — direction.md quotes both, so you can tell which is which.

**Last updated:** 2026-09-26 — **THE COMPETITIVE REVIEW (P3) RAN, AND TIM SET IT ASIDE.** He asked what
other apps have that his does not; about twenty research agents covered ten apps and ~350 verbatim
reviews. 🛑 **NOTHING WAS BUILT, and no code changed.** Then: *"okay forget the improvements from other
apps. I want to build it myself."* — now a standing instruction. 🔒 **Two findings outlive it**:
**nobody in the category shows uncertainty on a strength number** (Juggernaut, partly, on readiness
only) — this app's design is the opening; and **MEV/MRV volume landmarks have no footprint in the
peer-reviewed literature**, so volume targets built on them are a 🛑. **Details: `docs/history.md`
2026-09-26.**

**2026-09-25** — **A SET WAS LOSING ITS SEAT TO A TRUNCATED COPY OF ITSELF.** ✅ **Fixed and pushed.**
`dominate()` now **drops** a dominated set instead of rewriting it — the rewrite beat the real set it
was made from (55×9 read 66.2 alone, 56.6 with a 55×5 after it), and it laundered a stale PR's date.
Golden re-baselined, ten up and three down, **every observation count unchanged**. 🔒 Durable halves:
`docs/state.md`'s Muscles row, Rule 5's corollary in `docs/handbook.md` §5, and **Open work 13** —
his other half, the level-blind conversion ratio, investigated and deliberately not built. The laptop
panel from 2026-09-24 was fixed the same day. **Details: `docs/history.md` 2026-09-25.**

**2026-09-24** — **THE DETAIL PANEL GETS ITS FIVE COLUMNS ON A LAPTOP.** Tim: *"the
muslce groups section allows for a little more space. Could you make the details on the right side a
little wider so that you don't need to click 'more details' … Keep the version the same on the phone
to conserve space."* ✅ **Done and pushed.** At **≥1024px** the panel widens and the two derived
columns default to showing, header and all; the button stays as *Fewer details*. 🛑 **The phone is
byte-for-byte unchanged, and so is everything between 860 and 1023.**
⚠️ **COLLAPSED 2026-09-25** (§0.3) — the durable halves are the Muscles row in `docs/state.md` and
the note on Rule 3's corollary in `docs/handbook.md` §5, which is where the reasoning belongs: the
first version widened at 860 and **the measurement is the only reason it did not ship**, because it
crushed the figure to 298px against a 320px panel. 🔒 **`sourceColumns` is `false | true | null`**
(`null` = the layout decides, an explicit tap still wins) and **the breakpoint lives in two files
with `tests/a11y.test.mjs` failing if they drift.** 🚩 **It also found a test passing for the wrong
reason** — a block restored `false` rather than *unset*, so later blocks tested an explicit "no"
while believing they tested the default; `resetPanelViewState()` is the fix, test-only.
**Details: `docs/history.md` 2026-09-24.**

**2026-09-23** — **CALVES AND NECK RANK LIKE EVERY OTHER MUSCLE.** Tim: *"make calves
and neck join the muscle group rankings just like all the other muscles. Just do it no matter what.
I know the research isn't great, but do whatever you can to make it work with what you have."*
✅ **Done and pushed. Rows 11 and 12 of the table below are CLOSED.**
⚠️ **COLLAPSED 2026-09-25** (§0.3) — **the durable halves are `docs/state.md`'s Muscles row and
`docs/research.md` §17**, which is the neck pull. What a fresh session must not re-derive:
🔒 **THE MAP HAS ITS OWN REP CEILING, `MAX_MAP_REPS` (25), AND IT IS A SECOND CEILING RATHER THAN A
RAISED ONE** — `MAX_EVIDENCE_REPS` is still 15 everywhere a single number is printed, because the map
blends at 1/σ² and can PRICE a long set while a screen has nothing to pay with. 🛑 **25 not 30**: at
30 σ passes `SIGMA_MAX` and every long set would price identically.
🛑 **THE NECK'S WOMEN'S ROW IS DERIVED — male × 0.606 — AND SAYS SO ON EVERY RATING**, because the
published women's table is 55 people and asks a heavier woman for less. **Only the RATIO crosses**
between a dynamometer and a plate; the absolute newtons never may (§15's near-miss).
🚩 **The neck reading is FLAT and he accepted that knowingly** — Elite is 38.8× Beginner.
🚨 **AND A LESSON ABOUT BRIEFS: THE ONE I WROTE HAD THE EXTENSION RATIO UPSIDE DOWN** (0.94 for 1.06,
a 12.8 % flattery). The agent refused the number, derived it from the file's own convention and
reported the disagreement — which is what the "read the what-I-decided-NOT-to-do section" rule buys.
**Details: `docs/history.md` 2026-09-23.**

**2026-09-22 — COLLAPSED 2026-09-23** (§0.3). **The muscle map got a female figure**, picked on the
profile's sex. 🔒 **The durable halves are in `docs/state.md`'s Muscles row and the handbook's
`js/body-art.js` and `tools/build-body-art.py` rows**: the figure belongs to **whose body is drawn,
not the reader**, their sex comes from the published MAP (`ownSexOf`) rather than `profile.gender`,
and the two sources are read completely differently while everything after the reading is shared —
so the male art must regenerate **byte-identical**. 🛑 **The female source PNGs are git-ignored
working files at the repo root; the art cannot be rebuilt without them.** Full write-up:
`docs/history.md` 2026-09-22.

**2026-09-21 (second pass)** — **the "from:" block is a TABLE, and two investigations
that are his to decide.** He opened a list: *"I'm going to just give you a list of things I want you
to fix with the cite and you can deploy sub-agents to work on each one."* 🟢 **SIX AGENTS, DISJOINT
FILES, ONE INTEGRATOR** — and 🔒 **the thing that made it work was writing the CONTRACT (exact class
names, exact field names) before any agent started**, so four writers on four files could not drift.
`tests/` was the integrator's alone; every agent proposed `ok(...)` blocks to its own scratch dir.
⚠️ **Two agents shared a scratch ROOT and one overwrote the other's probe** — "your own scratch
directory" was not specific enough; name the path in the brief.

⚠️ **THE REST COLLAPSED 2026-09-24** (§0.3). **The "from:" block became a five-column table** —
three compact, two behind a button, one colour each. 🔒 **The durable halves live in
`docs/state.md`'s Muscles row**: the button is NOT `settings.moreDetails`, the fifth column is headed
**Influence** rather than Confidence because the panel already has a confidence line, and both new
numbers are **published** so a friend's panel matches the owner's. 🚨 **The finding worth not
re-deriving**: contributions of 130/140/155 blend to **133.9**, not 138, because the shares are
67/29/4 % — the answer sits near the LOWEST reading, and without the column that reads as a bug.
🛑 **Still not built**: `robustAggregate()` winsorises, so the columns stop multiplying out where a
contribution sits outside ±25 % of the median (152.7 by hand vs 150.8 shown) — he said two extra
numbers only. **Full write-up: `docs/history.md` 2026-09-21 second pass.**

✅ ~~**TWO INVESTIGATIONS, NEITHER BUILT, BOTH HIS TO DECIDE**~~ **BOTH BUILT ON 2026-09-23** — the
calves rep gate and the neck standards. Rows 11 and 12 below carry what shipped.

**2026-09-21 (first pass)** — ✅ ~~**the muscle panel was naming a set nobody had done**~~
**SUPERSEDED 2026-09-25 AND COLLAPSED WITH IT.** That day patched the SCREEN (`performedReps` /
`performedDate`) while leaving the fabrication in the model; 2026-09-25 removed the fabrication and
those fields with it. 🔒 **The durable half is Rule 5's corollary in `docs/handbook.md` §5**, which
now carries both halves — including the general form the second pass taught: **a display fix on top
of a model that invents data leaves the invention running.** Full account: `docs/history.md`
2026-09-21 and 2026-09-25.

## 2026-09-18 to 2026-09-20 — COLLAPSED TO FOUR LINES, 2026-09-22 (§0.3)

⚠️ **Full write-ups: `docs/history.md` under each date; every durable half is in the handbook,
`docs/state.md`, a D-number or an Open work row.** What stays here is only what a fresh session must
not re-derive:

- 🔄 **Heavier AND longer supersedes** (`dominate()`), enforced at **both** places making the same
  comparison, and 🔄 **the rep ladder had no source** — `js/rep-sigma.js` measures σ from the
  disagreement between research §1.2's seven formulas, so a 12-rep set carries **86 %** of an 8-rep
  set on a machine and **57 %** on the key lift where the hand-typed ladder said 53 % everywhere.
  🚩 He argued a high-rep set is evidence of a MINIMUM and it was deliberately **not** built — row 9.
- 🆕 **D33 — a planned set can carry a REP PRESCRIPTION**, read as carrying 1–2 reps in reserve.
  🛑 **Not the RIR field D28 refuses**: D28 refuses to ASK a lifter; this is one assumption about
  what a COACH meant, and it can only take weight off the bar. Plus **% of your own max** and **the
  plates under the weight** (Open work 33, 34).
- 🆕 **THE CURRENT SYSTEM** (`settings.currentSystemId`) — the Workouts tab is one programme's own
  screen and Record shows only its workouts, both drawn by one `systemBody()`. 🚨 **It DERIVES when
  nothing has been chosen and never writes what it derived** (D8/D9). Open work 35.
- 🆕 **Open work 36 — a copied programme can be told its original moved on.** 🚨 `exercise.origin` is
  the only thing separating "the original changed" from "you changed it", and **every copy made
  before 2026-09-20 is unstamped, Tim's included.**

## 2026-09-16 and 2026-09-17 — COLLAPSED TO ONE POINTER, 2026-09-20

⚠️ **The routine maintenance** (§0.3). Full write-ups: `docs/history.md` under each date.

- **2026-09-17 — the network paths were run against the real project.** **39 checks, 0 failures**
  against `fitness-tracker-th` and the **deployed** rules, as throwaway accounts deleted afterwards.
  💷 **An unchanged sync bills ZERO document reads.** 🔒 Durable half: **§0.16** and the 💷 block
  below. 🚩 **Still worth knowing**: `shardDiff()` compares `JSON.stringify(row)` and Firestore
  returns map keys in its own order — **not a bug**, but a path that REBUILDS rows pays a write each.
- **2026-09-16 — five asks, five sub-agents.** Faces on the friends list; **a friend's page became
  their PROFILE**; **a system can carry a weekly or cycle plan**; **an empty month is one line**.
  🔒 Durable half: **D32** in the handbook §6, and `docs/state.md`'s friend-profile row.
- 🔄 ~~**a system folds open and closed**~~ **DELETED 2026-09-19** by the current system. Struck
  rather than removed: a line saying a feature exists over code that was deleted is the exact
  failure this file is for.

🛑 **"CATCH UP WITH PROGRESS.MD" MEANS READ AND REPORT — IT AUTHORISES NOTHING.** Read all four
files, say in a few plain lines what changed and what is open, **then stop.** 🚨 **An authorisation
recorded in an earlier session is not an instruction to resume it in this one**, however green the
light looks here. **Tim's words and the incident behind it are under Standing instructions**, which
is where this rule lives — this is the pointer, not a second copy.

✅ **NOTHING IS HALF-BUILT AND NOTHING IS AUTHORISED.** Everything below is committed and pushed and
the working tree is clean **outside `Fitness_Research/`** and an untracked **`Claude Data/`** that is not
this chat's (there at the 2026-09-26 open, untouched) — 🛑 **another agent's folder; stay out, and
never `git add -A`** (first entry under **Standing instructions**).
**All TWENTY-THREE no-Chrome suites are green — 6,318 assertions** (recounted 2026-09-25 by running
every one), `data-layer` **2,913**, `render` **1,638**. ⚠️ **FOUR of those suites are a PARALLEL
AGENT'S, not this chat's** — `exercise-evidence`, `template-lint`, `figure-note` and now
`research-pane`, and most of the jump from 5,731 is theirs. See the "Everything at once" row.

🚨 **AND READ THIS BEFORE TRUSTING THE RESEARCH ROWS: THE PARALLEL AGENT REBUILT DATA → RESEARCH ON
2026-09-22 AND UPDATED NONE OF THESE FILES.** Commit `462e8a8`, *"the research tab gets facets, hooks
and eight more topics"* — **nineteen topics in five sections** with tag facets and per-topic hooks,
where every note here described **eleven flat topics**. ✅ **`docs/research-plan.md` is their write-up
and is the thing to read.** The counts in `docs/state.md` and `docs/handbook.md` were corrected to say
so; **nothing else about that feature has been checked**, and 🚩 **several comments in
`js/views-data.js` and `js/views-social.js` still say "eleven topics"**. 🛑 **It was flagged rather
than documented on purpose** — it is not this chat's work, and a row written from the outside is a
guess at what somebody else meant (§0.19). ⚠️ **The general form, and it is the one to carry:
`git log` since your last session is part of catching up. HEAD moves while you are not here** (§0.20).
✅ **`rules` is 221**, run on the emulator on 2026-09-16 (§0.9) and **deployed** — and since
2026-09-17 the deployed copy is verified from the outside as well, by `tools/live-check.mjs` (§0.16);
`firestore.rules` has not changed since. `sw-update` needs Chrome and remains flaky (§ below).
Open work 29 closed on 2026-09-11; **30's plan was approved and its Phases 0–3 are BUILT**
(2026-09-14); **31 finished on 2026-09-16 and its two "never run against real Firestore" caveats
closed on 2026-09-17**, along with 26's; **33 and 34 are 2026-09-18 and are finished; 35 is
2026-09-19 and is finished; 36 is 2026-09-20 and is finished.** Every other item is either Tim's,
pinned, or parked.

🆕 **WHERE 2026-09-25 STOPPED.** Two asks in one message, both built whole and pushed. **Nothing is
half-done and nothing is authorised.** ⚠️ **THE 09-21, -22 AND -23 "WHERE IT STOPPED" BLOCKS WERE
COLLAPSED INTO THIS ONE**, and 🚨 **the 09-21 one had gone FALSE**: it said the estimate was still the
truncated reading of the set, which is exactly what 09-25 removed. **A "what to expect" block outlives
the thing it describes and then misleads** — collapse them forward, do not stack them.

🚩 **WHAT TO EXPECT A REPORT ABOUT, and every one was stated to him at the time.**
- **Every rating in the app went UP a few percent on 2026-09-25** (calves +14 %, neck +25 %) and
  **Glutes, Quads and Back went DOWN** (−6.2 / −3.4 / −2.7 %). The falls are a fabrication stopping,
  not a loss: an old heavy set used to wear a recent set's date and read as fresh.
- **The neck reads near Intermediate for almost everybody** — the page's Elite is 38.8× its Beginner.
  Priced into `standardQuality` 0.4, and the cost he accepted knowingly.
- **His converted numbers are still low at the light end** — that is Open work **13**, the
  level-blind ratio, diagnosed with his own data and deliberately not built.
- **The female figure** fills the whole shin where the male's colours cover only the bellies, and its
  hands sit further from the body — that is the art, not the pipeline.

🚩 **AND THREE THINGS FOUND ON THE WAY THAT ARE NOT BUILT.**
- **The demo has no hatched muscle left** (its Neck Curl was the one, and Neck ranks now), so
  "trained but unrankable" is unreachable in the account used to audit every screen. Fixing it needs
  a new demo exercise, which re-rolls the seeded year — Open work 25, his call.
- **With nothing else rated at all**, a lifter whose only work is long sets sees *"Nothing to rank
  yet"* and no figure — the hatch needs one rated muscle beside it to exist on. Pre-existing.
- **A neck panel is 70 words against the 40-word cap**, 29 of them the caveat. Core already does this
  and the cap's fixture is a clean rating, so it is not a regression — but a third caveat-carrying
  muscle would make "capped at 40" true of the test and false of the product.
⚠️ **The Muscles tab letterboxes the two figures slightly differently** — `.body-wrap` is a fixed
57 % of the pane on the phone and does not use `bodyAspect()`. Pre-existing; he has not pointed at it.

🆕 **WHERE 2026-09-16 TO -20 STOPPED — COLLAPSED AGAIN 2026-09-25** (§0.3). All finished; **rows 7, 8,
9 and 10 carry everything still undecided** and none is authorised. 🔒 **The one method lesson worth
keeping, because it cost three wrong implementations**: the rating code has **two places that make
the same weight-blind comparison** (`betterSameDay` per exercise-day, `seatCredit` at the seat), and
**a rule enforced at one of them is not enforced** — every failure was caught by a COLUMN in the
golden table or by the render suite, never by reading the code. 🛑 **Not authorised**: the
accessibility work (a deferral by name — ⚠️ **do not offer it again**) and pointing the audit at a
friend's screens. 🚩 **Expect a report about**: his copy of Nippard's PPL having no percentages (a
preset copy is a snapshot and his predates the stamps — the app says so and offers no button); a
friend's gender/age/friends appearing only after **their** app republishes; and the calendar not
drawing the current month when the last recording is older than it. **All three deliberate.**

## 2026-09-10 to 2026-09-15 — COLLAPSED TO ONE POINTER, 2026-09-19

⚠️ **The routine maintenance** (§0.3), and it ran again on 2026-09-20. Full write-ups:
`docs/history.md` under each date.

- **2026-09-15 — the interrupted agents' leftovers, then the ratio table.** An accessibility audit
  had run and nobody had read it; `strength-fit` printed "22 figures outside tolerance" through a
  green suite and **the guard its header named did not exist** (§0.15). Then the table re-derived and
  σ per entry with a precision-weighted blend: inside 5 % went **38 → 85 of 105**, every muscle moved
  −2.3 % to +2.8 %, **every confidence unchanged**.
- **2026-09-14 — the strength-accuracy build**, on *"Start building the improvements now."* ~25 ratio
  corrections and a sex axis (**D31**), one 1RM convention (**D30**), a rating that can FALL, and the
  typo quarantine wired. **Tim's three reported readings all had one cause.** 🔒 **NINE AGENTS WERE
  KILLED MID-FLIGHT AND THE LESSON IS STANDING: A HALF-WRITTEN AGENT LEAVES A HEADER THAT LIES** —
  the rules are in the sub-agent entry below. 🚩 **Still Tim's**: the demo reads eleven Novice and one
  Intermediate; widening it means re-rolling the seeded year (Open work 25).

- **2026-09-13 — 🛑 NOTHING WAS BUILT**, seven read-only agents on *"Make a plan"*; the deliverable is
  `docs/strength-accuracy-plan.md`. 🔒 **The finding that outlived it**: the ±4.6 % accuracy claim is
  conditional on the curve, and the backtest that would settle it needs **Tim's export**.
- **2026-09-11 and -12 — the Profile/Data split finished (Open work 29)**, years-first calendars, the
  set lock, the finger-following drag and ranked best lifts. 🚨 **The Profile tab had never been
  audited** — the route list had a row called *Profile* and it was `#/profile`, the form. **A route
  absent from the list looks exactly like a route that passed.**
- **2026-09-10 — Open work 27 closed.** Record rose behind its own ghost; **nobody wrote
  `overflow-x: auto` — the browser did**. 🔒 Durable halves: `docs/state.md`, `direction.md` §4b.

## 2026-09-07 to 2026-09-09 — COLLAPSED TO ONE POINTER, 2026-09-16

⚠️ Ten passes across three days; write-ups in `docs/history.md`. **Leaving a workout open**, **Finish
opening a save screen**, **Design Rule 9**, **Profile became the fifth tab**, **Open work 26 closed**,
a friend's map **read against people like THEM**, **Record rises from the bottom**, **28 closed**.
🔒 **The two lessons that outlived the days**: the female-map bug survived because *every fixture was
male*, and **an agent ran `git stash` mid-flight** (the rule is in the sub-agent entry below).

🚨 **THE ONE THING THAT STAYS HERE, because `docs/direction.md` §4.1 points at it by name — THE
WORDINESS MEASUREMENT, 2026-09-07:** **18,631 user-facing words, 304 sentences over 15 words, 63
blocks of 40+.** Worst first: `research-topics.js` 54 · `preset-systems.js` 37 · `views-goals.js`
30 · `views-data.js` 28 · `views-social.js` 24 · `views-account.js` 19 (done, 2026-09-08).
⚠️ **The top two are not the app's voice.** 🚨 **The finding: the copy is not padded, it is
MIS-PLACED** — almost every offender is the app explaining itself, and the rule that every caveat is
stated on screen never said WHERE. **He points at screens.**

## 💷 WHAT IT COSTS TO RUN — COLLAPSED TO A POINTER, 2026-09-26 (§0.3)

**`docs/running-costs.html` is the full analysis and always held this table in full**;
`docs/history.md` 2026-09-06 is how it was built. ⚠️ **Prices were confirmed 2026-09-01 and drift —
re-confirm one before re-quoting it; the measurements are properties of this code and do not.** The
headline: **$110/year today**, **Firestore free to ~1,894 users** since the read-pattern fix (Open work
26; ~94 before it), and **an unchanged sync bills zero document reads** (measured 2026-09-17). What a
fresh session must not re-derive or do:

- 🛑 **NO HARD SPENDING CAP EXISTS FOR FIRESTORE** — Google's 2026-07-28 caps exclude Firestore and
  Auth, alerts lag up to days, and the only true stop deletes the project.
- 🚨 **NEVER OPT INTO IDENTITY PLATFORM** — it bills **anonymous** users as monthly actives, and D12
  makes this app anonymous-first.
- ⚠️ **Region is a silent 2× fixed at creation** and `fitness-tracker-th`'s was never checked.
  ⚠️ **Ads**: Apple 2.5.18 forbids behavioural ads on health data; no revenue figure was modelled.

🔒 **Three lessons from that day are about METHOD and MOVED TO THE HANDBOOK** (2026-09-17): **§0.14**
(a mutation check can lie in the reassuring direction), **§0.17** (a rule guarded by its weakest
reason gets overturned by whoever solves that reason) and **§0.18** (a green browser audit with a
zero text-node count is not a pass).

## 2026-09-05 and 2026-09-06 — COLLAPSED FURTHER, 2026-09-19

⚠️ Full dated sections in `docs/history.md`; every standing consequence lives somewhere that is not a
dated summary — `docs/state.md`'s Friends and Muscles rows, `docs/handbook.md` §9, and the
running-costs section below, which is 2026-09-06's other half and **stays here**.

- **2026-09-05 — screens showing other people**: *"Relative to each"*, a friend's data IS the Data
  screen (`GraphView()` with a subject), and "what they can see of yours" left a friend's page.
- **2026-09-06 — every blank and refusal, then building the worth-building ones.** The muscle map
  **ranks without a profile**; **Goals kept its gate on purpose**, because a goal FREEZES its target
  weight; custom exercises can set a level again **if the person names the closest library exercise**.
  🛑 **The bar-height work was NOT built and §9's own diagnosis was why** — `docs/research.md` §15.

## ⚠️ 2026-09-04 — WHY THE NOTES ARE IN FIVE FILES — COLLAPSED FURTHER, 2026-09-19

⚠️ **The rule this day produced is `docs/handbook.md` §0.3, where a test enforces it, and the header
of this file states it too — so the paragraph that used to restate it here was the third copy.** Full
account: `docs/history.md`, 2026-09-04. The short version: this file had reached **626 KB** and could
no longer be opened in one read, so *"read this entire file before doing anything"* had been quietly
impossible for some time and nothing said so. **A session's full write-up goes at the top of
`docs/history.md` and only its summary comes here.**

🚨 **AND ONE SAFETY FACT THAT IS NOT ABOUT DOCUMENTS: THIS SITE IS SERVED BY GITHUB PAGES, SO
ANYTHING TRACKED HERE IS PUBLISHED.** Three files were committed by accident (a `.tmp` and two ~200 KB
working screenshots of the app's own screens); `.gitignore` now refuses `*.tmp` and any `.png` at the
repo root, with the reason above each rule so nobody deletes the rule instead of the file.
⚠️ **They were screenshots of THIS app, checked before deleting** — somebody else's UI would have
been a different kind of problem (`docs/social-plan.md` §12.12).

### 🛑 WHAT WAS LOOKED AT AND DELIBERATELY LEFT ALONE — MOVED TO `docs/handbook.md` §4, 2026-09-19

⚠️ Tim asked whether the code organisation could be improved; **it was assessed and the answer was
no.** The four reasons are under **"Why the big files stay big"** in the handbook's §4, where
somebody noticing a 4,000-line file will actually be looking.

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

## What changed on 2026-09-04 — COLLAPSED TO A POINTER, 2026-09-17

⚠️ Full write-ups: `docs/history.md`, 2026-09-04 and its two further passes. **The interview above is
that day's other half and stays.** The docs were split into five files, and `docs/direction.md` was
written. 🔒 **CORE BECAME A RANKED MUSCLE** — key lift Cable Crunch, leaving `UNRANKABLE` as Neck,
Cardio, Activity. ⚠️ **It rates about a quarter of how people train abs**, and `docs/research.md` §14
is 🟡 — the only 🟡 in the standards table — because its cross-check disagrees by 17 %; a
trained-but-unrankable muscle is hatched, with its own key entry. 🔒 **A note to the developer**
shipped (Open work 23), the **demo gained abs and a neck** (25), and **§2's transcription error was
fixed** (20).

# 🟢 START HERE: NOTHING IS HALF-BUILT

**Everything is committed and pushed, the working tree is clean, and every runnable suite was green
at the end of 2026-09-25** (23 suites, 6,318 assertions). ⚠️ **`firestore.rules` has not changed since
2026-09-16**, so the two paragraphs below are still the last word on it — nothing since has touched
what is published or who may read it. ✅ **The rules suite was run on 2026-09-16 — 221 assertions, 0 failures**
(emulator, §0.9), because `firestore.rules` changed with D32 and **the rules were deployed with the
client rather than after it.** 🚨 **That order is not a preference**: `validProjection()` pins the
document with `hasOnly`, so a client publishing a field the rules do not name has every publish
denied in silence.

✅ **AND ON 2026-09-17 THE DEPLOYED COPY WAS CHECKED FROM THE OUTSIDE**, which is a different question
from what the emulator answers. `tools/live-check.mjs` (§0.16) published both documents against the
live project and had four negative controls refused on the wire, so the deploy provably landed.
💷 **It also measured the read pattern: an unchanged sync bills ZERO document reads.**

## 🛑 THE ELEVEN THINGS WAITING ON TIM — 11 and 12 CLOSED 2026-09-23, 13 added 2026-09-25

**What is waiting is his, not yours** — read the standing rule at the top of this file before picking
any of it up, and note that **five of them put words on a screen**, which is the category he has
reserved for himself. ⚠️ **The count in this heading has been wrong before** (it said EIGHT for weeks
while the table grew), so it is stated as a count of OPEN rows and the closed ones keep their numbers
— **11 and 12 are struck through in place, not deleted**, because the reasoning under them is why the
built version looks the way it does.

| | what | what it needs |
|---|---|---|
| 1 | **The typo quarantine's cross-exercise trade.** A genuine first heavy test on a muscle whose other work is much lighter is held for one session (measured: kept at 1.99×, set aside at 2.01×). Screening each exercise against its own past fixes that and lets a ×10 slip on a BRAND-NEW exercise through, because a first reading has no past to fail against | **a decision** — the error runs both ways, which this project does not decide alone |
| 2 | **The fall limit.** Plan §3.1 offered a window **or** a smoothed series; the window shipped. Wiring `estimateAt()` replays each exercise as a series: every rating moves, the golden table re-baselines, hysteresis must come with it | **a decision** — a design change plus a re-baseline |
| 3 | 🚩 **The muscle panel's freshness note has NEVER rendered** — `freshnessLine()` has no caller; `detail()` is handed a seventh argument and takes six. `recentDirectWork()` and its 24/48 h split ARE asserted, so only the wire is missing | **one line, and his word** — it puts a new sentence on a screen |
| 4 | 🚩 **The Data tab's "Estimates above 15 reps are unreliable."** needs a rep target of 16, which `MAX_TARGET_REPS = 15` made unreachable the day it was written | **his word** — delete the branch, or lower the threshold |
| 5 | 🚩 **Goals prints `+N %` from the frozen `gainPct`**, which can now disagree with a re-frozen target on the same screen ("Steady +2 %" over a 220 → 244 lb goal). Pinned as current behaviour so a change is deliberate | **his word** — two defensible answers |
| 6 | 🚩 **An ordinary lifter flaps MORE than one on a level boundary** — the suite prints 0.75 against 0.19, the opposite of what the comment and the plan both claim, and nothing in `provenance()` measures the ordinary number | **an answer, not a fix** — recorded on the constant |
| 7 | 🆕 **A SET WITH A PRESCRIBED WEIGHT IS `prefilled`, so accepting the weight AND the reps untouched drops it at save** (2026-09-18). Deliberate — the number is the app's, not last time's, and `finish()` refusing it is what stands between a prescription and a workout nobody did. ⚠️ But a target is *meant* to be obeyed, so it is far easier to hit than the derived opening weight this rule was written for. It does not touch the untargeted path, so **item 15 is still open and still separate** | **his word** — leave it, warn on the screen, or count "moved on from" as done |
| 8 | 🆕 **BENCHMARK WORKOUTS KEPT IN A SEPARATE PROGRAMME NO LONGER APPEAR ON RECORD** (2026-09-19). The weightlifting picker is scoped to the current system, so a "Testing" programme has to be switched to before its days are reachable. ⚠️ **`#/benchmark` is not a substitute** — it records one lift's best, not a workout. 🚩 **The second half of the same trade**: tapping a row in the switcher makes that programme current immediately and writes it to `settings`, so it syncs; **there is no "look without switching"**. Both follow from what he asked for, and both are cheap to undo | **his word** — leave it, surface benchmark workouts from every programme on Record, or give the switcher a read-only peek |
| 9 | 🆕 **SHOULD A HIGH-REP SET COUNT AS A FLOOR?** (2026-09-20, his idea.) He argued a 12-rep set is right-skewed evidence — *"it should have high confidence that it's at LEAST 131"* — because you cannot do fewer reps than you did, so the true max sits above the estimate. 🚨 **He is mechanically right, and it is the ONE thing built today that was deliberately not built.** Correcting a RECORDED set upward for assumed reserve is the move `docs/fatigue-plan.md` §4 refused in writing as *the only mechanism that can make a number bigger than what was observed*. ⚠️ **Note the asymmetry with D33**, shipped the same day: assuming reserve on a PRESCRIPTION takes weight off the bar; assuming it on a recorded set makes him stronger on paper. Same assumption, opposite safety direction. ⚠️ **And the light-load bias points the other way** — at his 85 lb the curve already reads ~10 % above Epley, so 131 is not a floor | **his word, and it reverses a refusal** — leave it, or add a separate *"at least X"* reading beside the estimate rather than moving the estimate |
| 11 | ✅ ~~**THE 15-REP GATE THROWS SETS AWAY SILENTLY, ON EVERY MUSCLE**~~ **FIXED 2026-09-23, AND HE WENT FURTHER THAN THE NOTE** — the map reads to 25 reps now and prices what it admits, so a high-rep calf RANKS rather than merely explaining itself; above 25 the refusal leaves a note and the hatch says which refusal it was. 🚩 **ONE HALF OF THIS ROW IS STILL OPEN AND IT IS THE BUTTON**: a friend's panel still offers *"Benchmark Standing Calf Raise"* — the reader's own benchmark screen — on somebody else's body. Untouched, because it is a different bug that happened to be found beside this one. The original report, for the record: `strength-observations.js`'s D5 check returns **before** the blocked-work bookkeeping, so a set above 15 reps leaves no observation **and no record that anything was refused** — the panel then sees "no rating, nothing blocked" and prints the sentence written for Neck, on a muscle that has a published standard. 🚨 **Boundary is exactly 15**: 200 lb × 15 rates, × 16 does not. ⚠️ **Not a calves bug — all twelve rankable muscles**, and lateral raises at 15–20 are the commonest way anyone trains shoulders. There is a **second silent route** (a weighted lift logged at zero weight) and a **live bug beside it**: a friend's panel offers *"Benchmark Standing Calf Raise"*, the reader's own benchmark screen, on somebody else's body. ✅ **The fix is small and changes no number**: make the refusal leave a note, which fires a sentence the app already has. 🛑 ~~**Not built — he asked what was happening, not for a fix**~~ **BUILT 2026-09-23 on his instruction** | 🚩 **the friend-panel benchmark button is what is left** |
| 12 | ✅ ~~**NECK: THE APP ASSERTS SOMETHING FALSE, AND THE FIX IS NOT THE OBVIOUS ONE**~~ **BUILT 2026-09-23, AND HE ANSWERED THE SEXED-AVAILABILITY QUESTION BY REFUSING IT** — *"just do it no matter what"*, so Neck ranks for both sexes with the women's anchors derived from a measured ratio and labelled as derived on every rating, rather than women getting a hatch where men get a colour. 🚩 **The flatness this row warned about is real, measured and shipped**: p2.6 at the Beginner anchor, twelve percentile points for sixty percent more weight. The original assessment, for the record: Four places say no published neck norms exist and never will; **Strength Level publishes neck curl and neck extension**, unlinked from its index. 🛑 **Not shippable as found**: the female sample is 55 and 16 people, the female table **falls** with bodyweight in every column, and Elite ÷ Beginner is 38.8× against the bench's 2.7×. Every standards entry is a men's-and-women's pair, so shipping means inventing the women's half or giving women a hatch where men get a colour. ✅ **What is free and worth doing: correct the four false sentences and file the research**, so the next session does not inherit a wrong permanent fact. ⚠️ **And `direction.md` §3.1 changed this question** — under "something is always better than nothing" a labelled rough rating is allowed where it was once refused. `docs/calf-neck-ranking-plan.md`, and `docs/research.md` §17 is the pull that shipped | ✅ **answered and built** |
| 10 | 🆕 **ONE SET PER EXERCISE, TOP THREE — the rating still rests on three sets** (2026-09-20). His whole Back number comes from three of the dozens he has logged; everything else only moves the confidence label. 🚨 **This is the biggest remaining accuracy lever in the app** and it is what σ_rep and dominance were both working around. Blending every set at its own precision is the real fix, and inverse-variance weighting is already the machinery for it. 🛑 **NOT STARTED**, and it moves every rating in the app | **his go-ahead** — it is a re-baseline of the golden table and a change to what every number means |
| 13 | 🆕 **THE CONVERSION RATIOS ARE LEVEL-BLIND, AND IT IS THE BIGGEST REMAINING ERROR IN A PRINTED NUMBER** (2026-09-25, out of his machine shoulder press report). A ratio is ONE median applied to everybody, and the published ratio drifts hard with strength: machine shoulder press over overhead press runs **0.89 beginner · 1.08 novice · 1.23 intermediate · 1.35 advanced · 1.44 elite**. The app uses 1.23 for all of them. 🚨 **THE SELF-CONTRADICTION IS THE PROOF, ON HIS OWN DATA**: his 55 × 9 is an 81 lb machine max, which is **above** Strength Level's beginner machine mark (67) — and the 66 lb overhead press it converts to is **below** their beginner overhead press mark (75). Same lifter, same source, opposite verdicts. At the beginner-end ratio it reads **91**. ✅ **THE DATA IS ALREADY IN THE REPO AND NEEDS NO NEW RESEARCH** — `tools/strength-level-data.mjs` holds full five-anchor tables for **115 exercises, both sexes**. ✅ **The shape is PERCENTILE MATCHING**: place the reading on its own exercise's distribution, read the key lift's weight at the same percentile. No iteration, and it largely removes the drift `js/ratio-sigma.js` currently carries as uncertainty. 🛑 **NOT BUILT, deliberately**: it is a second re-baseline of every number in the app, and two in one commit means neither can be attributed — which is the whole reason the golden table carries its moves by name. `docs/history.md` 2026-09-25 | **his go-ahead** — a re-baseline, and it changes what every converted number means |

⚠️ **AND THE ONE THING THAT MOVED USER-VISIBLE NUMBERS ON 2026-09-15**: the ratio pass and the
precision blend moved every muscle on the map by **−2.3 % to +2.8 %**, with every confidence
unchanged. 🛑 **If Tim reports a rating that looks different, that is this** — the golden table
carries the attribution above its rows.

🚨 **AND THE ONE THING TO EXPECT AFTER 2026-09-16: A FRIEND'S NEW DETAILS ARRIVE LATE, AND THAT IS
NOT A BUG.** Their gender, age and friends list are in **their** published document, which only
**their** app can write — so those parts of their profile fill in the next time they open the app,
not when Tim opens theirs. Until then the screen says their app has not published it yet rather than
claiming they have no friends. `healStalePublish()` is what makes it happen on their next open.

🛑 **THE ACCESSIBILITY WORK IS DEFERRED BY TIM, 2026-09-17: *"Let's not work on the accessibility for
a while."*** It had been ranked and offered twice — no keyboard path walked, no screen reader run,
nothing tested at larger text, all three still recorded as unknown in `docs/state.md` — and it is
still the biggest untested surface left before the App Store. **It is now unpicked by name rather
than merely unstarted. Do not offer it again; he will raise it.**

⏸️ **The other item he did not pick, from the same answer, and it is small**: `tools/a11y-audit.mjs`
still cannot reach any screen behind `#/friend/<uid>` because a real uid is generated — **but the
demo account's is deterministic**, which is the opening nobody has taken. Not refused, just unpicked.

## ✅ THE 2026-09-14 HANDOVER IS CLOSED — COLLAPSED TO A POINTER, 2026-09-18

⚠️ Full write-up `docs/history.md` 2026-09-15; **nothing in it was still open**, and its two live
flags are rows 3 and 4 of **THE TWELVE THINGS WAITING ON TIM** above (it said EIGHT until 2026-09-22;
the table has grown four times since and the sentence never followed). 🔒 **The one thing that outlived
it, because it is about method:** the accessibility audit recorded as *"produced nothing"* had
**produced everything and read nothing** — the agent was killed between writing 4.5 MB of JSON and
opening it. **An agent killed after its work lands still leaves the work; look in its scratchpad
before believing the handover.** It sits with the other agent rules under **Standing instructions**.

🚩 **FOUR THINGS FLAGGED FOR TIM AND STILL UNCHANGED** — three from 2026-09-12: fill-on-open meets
the set lock (a copied set 2 locks when you go back to set 1 — visible now, was silent); the Profile
tab's Months/Years pill is the one segmented control that repaints instead of sliding
(`wireSegmented` never reaches it — one line, visual, his); `pointercancel` on the exercises drag
commits the slot under the finger rather than abandoning. **And one from 2026-09-14**: the demo
account now reads eleven Novice and one Intermediate, which is correct arithmetic and a narrower
demo than it was.

✅ **THE PROFILE/DATA SPLIT IS DONE — all five steps, Open work 29 closed 2026-09-11.** Read that
entry before touching Profile, Data, Account or Settings: it carries the line the whole thing rests
on, which is `direction.md` §4b's.

⚠️ **THERE ARE TWENTY SUITE FILES, NOT SEVENTEEN, AND NINETEEN OF THEM RUN HERE UNAIDED** — recounted
2026-09-09 by running every one. `tests/rules.test.mjs` is the twentieth and needs
`npm i --no-save @firebase/rules-unit-testing` plus the emulator (§0.9), so it is not in that green.
🛑 **Do not report "all twenty green" off a run that skipped it.**

✅ **2026-09-09's THREE PASSES ARE SUMMARISED ABOVE** and written up in `docs/history.md`. 🛑 The one
detail worth not re-deriving: Record's corner control is `down`, **not `back`** — it lands on Home
whatever you came from, which is what he asked for.

⏸️ **HE TOOK ONE ITEM FOR HIMSELF THE SAME DAY AND IT IS NOT YOURS**: checking the estimator against a
real attempt (Open work 19). *"I'll do 4 myself sometime this week, but I'll come to you about it."*
🛑 **Do not start it and do not offer it again.**

✅ ~~**THE BROWSER AUDIT HAS NEVER MEASURED A DESKTOP WIDTH**~~ **FIXED 2026-09-10** — it sweeps
**360 / 390 / 880 / 1280**. 🚨 **The first desktop sweep immediately found an AA failure**, the same
`--accent`-on-`--accent-dim` pair "fixed" on 2026-09-06 **for the one element a phone-width audit
could see**; reading the stylesheet found four more. **The lesson is the scope of the original fix:
"every element that paints this today" means "every element the tool I ran can reach".**
⚠️ **`tools/a11y-audit.mjs` still does not cover a friend's page** — their uid is generated, so there
is no static hash for the route list.

⚠️ **`tests/sw-update.test.mjs` REMAINS FLAKY ON THIS MACHINE** — always on *"the service worker
takes control on the second load"*. **The control was measured rather than assumed** (three runs
against a committed baseline failed 4 / 4 / 1). 🛑 **Do not report it as reliably
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
  ⚠️ **COLLAPSED 2026-09-21** (§0.3); the full costing is `docs/history.md` 2026-09-07 and -10, and
  `docs/running-costs.html`. The four facts worth not re-deriving:
  - 💷 **Without photos the app is free to ~1,894 users; photos move that ceiling to ~145** — and it
    is **download OPERATIONS** that bind first, not bandwidth. Per user it is 10–25¢ a year, and
    uniquely in this app **the figure RISES with scale**, because the bill is people LOOKING.
  - 🔒 **STORAGE NEEDS BLAZE AS A PLAN GATE, NOT A QUOTA — confirmed live 2026-09-10.** Since
    3 February 2026 keeping a bucket at all needs a linked billing account, and Spark Storage calls
    return **402/403**. 🚨 **The Firebase pricing page still advertises Spark allowances for
    Storage, so reading that page alone gives the WRONG answer** — the next session to check will
    land on the same page.
  - ✅ **At his real scale the bill would be zero**, and ⚠️ **storage is measured in USER-YEARS**
    (5 GB ≈ 120 of them, cumulative, arriving without a single new user).
  - ⚠️ **The ~20-viewers-per-photo assumption is unmeasured.**

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

🚨 **"THEIR APP HAS NOT UPDATED YET" IS NOT A BUG, AND IT HAS NOW BEEN TRUE FOR TWO DIFFERENT
REASONS.** Every account publishes its own documents **on its own device**, so anything that changes
what gets published is invisible on somebody else's page until **they** next open the app:

- the 2026-09-03 tier migration — a reader falls back through `friends` → `public` →
  `full`/`mid`/`light` (`social.friend()`), which paints their map and their cards but cannot offer
  the tappable panel or a comparison, and both screens say so by name. ⚠️ Stale since 2026-09-03 and
  self-resolving; the fallback is marked for deletion once nobody is left on an old build;
- **D32's three new fields** since 2026-09-16 — `healStalePublish()` is what fixes it on their next
  open, and until then the screen says their app has not published it rather than claiming they have
  no friends (**absent is not empty**).

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

- 🛑 **`Fitness_Research/` IS NOT YOURS. STAY OUT OF IT — Tim, 2026-09-18.** *"I have a seperate
  research agent that is working inside that folder and is staying inside it. I don't want you to
  overlap with anything it's doing, so make sure you don't go in it. Just ignore what it's doing
  inside there."* **Do not read it, edit it, review it, tidy it or report on it.** It has its own
  agent, that agent stays inside the folder, and the two of you never touch.
  🚨 **THE PRACTICAL CONSEQUENCE, AND IT IS THE ONE THAT WILL BITE: NEVER `git add -A`, `git add .`
  OR `git commit -a`.** Stage your own files **by name**, every time. That folder is being written
  while you work — five of its files changed mid-session on 2026-09-18 — so a sweep commits somebody
  else's half-finished research under your message, and `git checkout`/`stash`/`reset` on a dirty
  tree would destroy it outright (the 2026-09-08 stash incident, with a second writer who is not
  even in this chat).
  ⚠️ **AND ITS MODIFIED FILES ARE NOT A DIRTY TREE THAT NEEDS CLEANING.** `git status` will routinely
  show changes there that are nothing to do with you. **That is the normal state**, it is not
  half-built work, and "the working tree is clean" in these notes has always meant *outside* that
  folder. Do not offer to commit them, do not ask about them, do not count them as loose ends.
  🆕 **AND IT COMMITS AND PUSHES FROM THIS SAME CHECKOUT, SO YOUR `HEAD` MOVES WHILE YOU WORK —
  2026-09-19, when six of its commits landed between two of mine.** It is not on a branch and not in
  a worktree. So `git log -1` is not necessarily yours, a push can report a base you never saw, and a
  diff "since the session started" can hold somebody else's work. **Staging by name is enough**;
  verify with `git show --name-only --format="" <sha> | grep -c Fitness_Research` — it must print 0.
  Full note: `docs/handbook.md` §0.20.
  🆕 **AND ON 2026-09-20 A SECOND PARALLEL AGENT WORKED ON THE APP ITSELF, NOT THE RESEARCH** — Tim
  said so at the time (*"another agent is working right now on a separate task… if you do [collide],
  report back to me"*). It shipped `js/exercise-evidence.js`, `js/template-lint.js` and three test
  suites, and it edited `sw.js` and `css/app.css` — **files this chat was also editing**. There was
  no conflict, because both sides staged by name. 🚨 **THE PRACTICAL RULE: a file, module or suite
  you do not recognise is not necessarily stale, wrong, or yours to change.** Check `git log` for it
  before assuming, and stage by name so you cannot carry somebody else's half-finished work.
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
- 🛑 **DON'T BRING HIM FEATURES FROM OTHER APPS — Tim, 2026-09-26.** He asked for the competitive
  review (P3), read it, and closed it: *"okay forget the improvements from other apps. I want to build
  it myself."* The findings are in `docs/history.md` 2026-09-26 — **reference, not a queue**. ⚠️ Two
  constrain what gets built whoever proposes it: volume targets on MEV/MRV have no literature behind
  them, and uncertainty on a strength number is the one position no competitor holds.
  `docs/direction.md` §4.
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
  🆕 **AND THE RULE FROM 2026-09-14, WHICH IS THE MOST IMPORTANT ONE ON THIS LIST IF AN AGENT EVER
  DIES: A HALF-WRITTEN AGENT LEAVES A HEADER THAT LIES.** Nine agents were killed by a session usage
  limit within minutes of each other, most of them mid-file. They left 3,071 uncommitted insertions
  that **looked finished**. `muscle-evidence.js` had a header describing eleven changes and the body
  of two: `resolveRatio()` was documented in the header and **never written**, and because `add()`
  guards on `ratio > 0` — which the new `{m, f}` object fails — **every pull-up, chin-up and dip in
  the library silently rated nothing at all, with no error anywhere.**
  🚨 **These agents write the reasoning FIRST and the code second**, which is right for a reader and
  the worst possible order for an interrupted one. **After any agent failure, diff the header against
  the body before trusting either.** ⚠️ **And the suite's own catch was buried**: `bodyweight.test.mjs`
  failed with exactly the right sentence, among nineteen other failures that were all expected
  re-baselines — **a red suite full of intended failures is where an unintended one hides**, so read
  every line of it rather than the count.
  ⚠️ **Recovery is usually worth more than reverting.** Of the nine, roughly a third was finished and
  correct, a third was half-built, and a third never started; sorting them took one pass and saved
  the finished two-thirds.
  🆕 **AND TWO MORE RULES FROM 2026-09-12, when three wrote at once again**: (1) 🚨 **the live suite
  is red for everybody while anybody is mid-flight** — a half-built feature in one agent's file
  crashed `render.test.mjs` for the others — so **an agent that needs a green run builds it in an
  isolated scratch copy with the other agents' files at HEAD**, and the brief says so; (2) **one
  agent owns `tests/`**; the others write complete `ok(...)` blocks and the rewrites of any existing
  assertion their change breaks to a scratchpad file, and the integrator places them afterwards —
  58 assertions went in verbatim that way and passed first time. ⚠️ Give each agent Tim's words
  verbatim, the files it may and may not touch by name, and the rule that CSS belongs to at most one
  of them.
  🆕 **AND THREE MORE FROM 2026-09-16, when three ran at once on three different asks.** (1) 🚨 **NAME
  THE SESSION'S DATE IN THE BRIEF — AN AGENT CANNOT KNOW IT.** All three stamped their comments with
  a date and all three picked a different one (two took the system clock, one the previous session's
  neighbour); the dates in these notes are a **sequence**, not a calendar, so 47 stamps across 11
  files pointed at the wrong section of `docs/history.md`. Normalising them meant checking each file
  at HEAD first, because several legitimately mention those dates already. (2) ⚠️ **Give each agent
  its OWN scratch directory** — one twice wiped another's run directory mid-check, recovered, and
  reported it unprompted. (3) ⚠️ **"Proposed tests" is not "verified tests".** The big agent's
  handover carried the rewrites that made the suite green and left its new honesty guards unrun,
  several asserting exact sentences nothing had checked against the code. **Ask for one patch that
  has actually been run**, and say that an assertion which does not match the code gets fixed or
  dropped — never the code bent to suit a test written after the fact.
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
- 🆕 **AND A FIFTH TIME ON 2026-09-21, ON `progress.md` ITSELF, WITH A NEW CONSEQUENCE.** A single
  `sed -i` two-string swap to update a suite count — the exact "it is only one edit" case §0.11
  warns is how the habit returns. The text came out right and **the whole file went CRLF → LF**,
  1,201 bytes smaller on disk. 🚨 **THE NEW HALF IS WHAT THAT DOES TO THE BYTE BUDGET**: the test
  measures the file on disk, so it reported **1,272 bytes free where a fresh checkout has 71** —
  the one number this file's whole maintenance routine is steered by, reading nearly 1.2 KB
  optimistic. ⚠️ **`git checkout --` did NOT put the endings back** (the index already held the
  normalised content), and the commit is unaffected either way because git normalises the blob —
  which is precisely why nothing downstream would ever have flagged it. **Use the editing tools.**
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
| **36** | ✅ ~~**UPDATING AN ADDED PROGRAMME FROM ITS ORIGINAL**~~ **BUILT 2026-09-20** | 🛑 **THE LIVE LINK IS STILL REFUSED** and its three reasons have not moved: you could not edit a linked programme; recorded sessions reference a `workoutId`, so a renamed preset workout would strand history (D22); and it would rewrite a prescribed WEIGHT under you unannounced. ✅ **What shipped is the other answer** — `js/preset-updates.js` (pure) decides, `store.applyPresetUpdate()` writes, and a hairline notice on `systemBody()` (so both doors) opens a sheet listing every change in words with **Will be added · You changed this, left alone · Yours to do**, and one button that appears only when something is safe. 🚨 **THREE STAMPS**: `system.presetVersion`, `workout.presetKey` (all 36 preset workouts gained a `key`, because a NAME cannot survive a rename) and `exercise.origin` — the last is what tells "the original changed" apart from "you changed it", and **it had to be named in `normalizeWorkout()`** or it is dropped on every read. 🛑 **THREE REFUSALS**: never deletes, never overwrites an edit, appends rather than inserts (entry order is scored — 0g). ✅ **A content hash per preset is pinned in `data-layer`**, so changing a preset without bumping its `version` fails by name. ⚠️ **Every copy made before 2026-09-20 is unstamped** — content comparison only, every row `manual`, nothing applied, and the sheet says the differences may be their own. ⏸️ **NOT done, and none of it blocking**: a changed exercise NOTE is reported but reads as noise next to a prescription, nobody has driven this in Chrome, and no preset has yet been changed for real — the first genuine bump is the first time the stamped path runs outside a test. `docs/history.md` 2026-09-20 |
| **35** | 🆕 **THE CURRENT SYSTEM — BUILT 2026-09-19** | ✅ Tim: *"make the user pick a 'current system' and then the main display inside the worout are the detials inside that system … inside the weightlifting category in record, it will show you just the workouts inside your current system, not the details of the other ones."* `settings.currentSystemId`, `store.currentSystem()` / `setCurrentSystem()`, a switcher sheet, and both screens rebuilt around one programme. 🚨 **THE POINTER IS DERIVED WHEN IT HAS NOT BEEN CHOSEN** — every account on disk has none, and demanding a pick would be a wall in front of their own programme (D8/D9, and the 2026-08-21 first-run work in reverse); it reads the system of the most recent recorded session, then the first with workouts, then the first. ⚠️ **Deriving never WRITES** — a guess saved on read is indistinguishable from a decision a week later. 🔒 **`systemBody()` draws `#/workouts` and `#/system/<id>` both**, the third time this project has extracted one body of code for two doors. 🔄 **It DELETED the folding systems of 2026-09-16** (`systemGroup()`, both memories, four CSS rules) and **`rateOwnSystems()`** — a badge per programme in the switcher would have made a gym-screen sheet wait on four reads (D4). 🛑 **Adding or creating a programme does not make it current**; `#/system/<id>` has a button. ⏸️ **NOT done, and small**: the switcher shows no rating per programme, so comparing two means going to Explore. `docs/history.md` 2026-09-19 §C |
| **32** | 🚩 **THE APP NEVER STATES ITS LOGGING CONVENTIONS ON THE SCREEN WHERE YOU LOG** | ⏸️ **Tim's, and it came out of the two questions he asked on 2026-09-18** — *"Is weight of machine accounted for?"* and *"Walking lunges: 1 rep = 1 step or 2 steps?"* **Both were answered and neither is an arithmetic bug**: the machine answer is "no, and keep it that way" (the ratio for a Leg Press Calf Raise, 1.47×, came from Strength Level rows where nobody adds the sled — adding 118 lb would read stronger against a population that did not), and the lunge answer is "one step, counted per leg", which is already what `preset-systems.js` writes and what the `/Lunge/` ratio was derived from. ⚠️ **What neither has is a place on screen.** `LOAD_HELP` says what a WEIGHT means; nothing anywhere says what a REP means on a unilateral lift, or what a machine number includes. 🛑 **NOT AUTHORISED — it puts words on screens, which is the category he has reserved**, and Rule 9 governs where they would go. `docs/history.md` 2026-09-18 §A and §B |
| **34** | 🆕 **THE PLATE BREAKDOWN UNDER THE WEIGHT — BUILT 2026-09-18** | ✅ Tim: *"remove the 'steps of ___' label under the weight and replace it with a label that says '45, 45, 25'… Make this label automatically adjust for the most optimal specific plates."* `js/plates.js` (pure) + `plateLoadFor()` in `exercises.js` + one optional `exercise` option on `stepper()`. 275 lb reads **"bar + 45, 45, 25 each side"** and re-solves on every tap of ±; a sled says the plates and no bar; **a T-bar says "on one end"** because it has one sleeve. 🚨 **THE BRIEF'S JUSTIFICATION FOR GREEDY WAS FALSE AND THE AGENT MEASURED IT** — exhaustive DP found 20 weights where greedy is not minimal with a 35 lb plate in the set (60 a side is 45+10+5 against 35+25), so **the shipped pound inventory has no 35s**; the kg set needs its 15 or it breaks the same way. The test re-runs the DP with the 35 case as its negative control. 🛑 **A weight no plates make shows NOTHING** and the old steps hint returns — a near-miss list makes the same visual claim as a right one under a 40px number. ⏸️ **NOT done, and small**: no specialty-bar weights (EZ, trap, safety squat, Smith are all unmarked and vary by make), no calf machines or belt squats (sold as stacks as often as plate-loaded), no Hammer Strength iso-lateral (the app cannot know which arm's number was typed). `docs/history.md` 2026-09-18 §D |
| **33** | 🆕 **A PLANNED SET AS A PERCENTAGE OF A MAX — BUILT 2026-09-18** | ✅ Tim: *"you say how much the suggested weight should be relative to that user's max for each set, and then when that user starts a workout that suggested weight is automatically put into the weight."* `js/set-targets.js` (pure), `targets` named in `normalizeWorkout()`, a `% of max` chip in the builder and the weights in the fields before anybody types. 🚨 **THE PERCENTAGE IS OF THEIR OWN BEST RECORDED SET ON THAT LIFT** (`ownBestSet()`, which already existed and already had the recent-beats-old and low-reps-beat-high rules) — **never the muscle map's cross-muscle estimate**, which is gated four ways precisely because its number gets walked up to a bar. A lift with nothing recorded gets no weight and a sentence. 🛑 **Body-weight and assisted lifts are refused outright**: their max is body-inclusive and the field is not (D30's mistake). ⚠️ **It overrides the progression suggestion**, and the note names the set it came from — *"Plan: 70/80/90 % of your 205 × 5"* — because a weight that disagrees with last time for a reason you cannot see reads as broken. 🛑 **100 % is a ceiling and it is a refusal**: the max is an estimate no human has checked against an attempt (item 19), and 105 % of a number that may be 10 % high is the one thing here that could hurt somebody. 🚩 **WAITING ON TIM**: every targeted set is `prefilled`, so accepting the weight AND the reps untouched drops it at save — stricter than the untargeted path, deliberately, and **item 15's question is now much easier to hit**. `docs/history.md` 2026-09-18 §C |
| **31** | 🆕 **THE FRIEND PROFILE, AND WHAT IT MADE EVERY ACCOUNT PUBLISH — BUILT 2026-09-16** | ✅ **Two more asks arrived mid-session and were built the same day**: a system's **optional weekly or cycle plan** (`js/schedule.js` — display only, on Tim's own answer; Rest and "nothing planned" are deliberately different words, and deleting a workout empties its day rather than resting it), and the calendar's **collapsed empty months plus a bar chart of days per month** over five months of history (Months only; **published**, not *trained*, on a friend's). 🔄 **AND THREE CORRECTIONS HE REPORTED WITHIN MINUTES OF THE PUSH, all built the same session**: a friend's data panel **lost its Calendar tab** (their calendar is on their profile now — four tabs, and `#/friend/<uid>/calendar`, which was never reserved and used to read *"that workout is not here"*, lands on their profile); **Months now runs from the first recording to the last**, so ten empty months no longer sit before anybody's first workout; and **the back arrow on a friend's profile always lands on `#/me`**, whatever route arrived — the narrow depth-based version shipped hours earlier could not cover *"go into a user's view data section, then close … then go back"*, because history correctly handed back the panel he had just dismissed. 🔒 **The depth mechanism was DELETED the same day it was written** rather than left standing. 🟢 Three asks in one message, three agents on disjoint files. ✅ **Built**: the avatar fix on `#/me/friends`; a friend's page as a **profile** (`js/profile-shape.js`, one module and two subjects) with **Workouts shared · Friends**, their body, their best lifts and their calendar; **"View data"** pulling their Data screen up on Record's own rise with **no Research**; their Workouts and Friends lists openable and walkable friend-to-friend; **`backExact` to `#/me` from depth ≥ 2**, Tim's explicit override of Rule 8, with the depth STAMPED on the history entry; and **systems that fold** on both lists. 🚨 **D32 is the part that is not a screen** — `profile.gender`, `profile.age` and `connections` in both shared documents, the first field naming OTHER PEOPLE, with `firestore.rules` shipped alongside because `hasOnly` would otherwise have denied **every publish in silence** (rules 218 → 221, mutation-checked). ⏸️ **NOT done, and none of it blocking**: the accessibility audit still cannot reach any screen behind `#/friend/<uid>` (their uid is generated — ⚠️ **but the demo's is deterministic, which is an opening nobody has taken**), and a friend's new details only appear after **their** app republishes. ✅ ~~the three published fields have never been written to real Firestore~~ **WRITTEN AND READ BACK 2026-09-17** — both documents accepted by the deployed rules with gender, age and `connections`; an unnamed key, a public document carrying body weight, an over-cap list and a legacy audience id all refused on the wire; a document with **no** `connections` key still accepted, which every pre-D32 account depends on; and a second account proved the read side, including losing access when dropped from `viewers`. `docs/history.md` 2026-09-16 and 2026-09-17 |
| **30** | 🔄 **THE STRENGTH-ACCURACY PLAN — PHASES 0–3 BUILT 2026-09-14**; §6 is what is left | 🟢 Approved in full (*"I like all your fixes as well as all of your advice for the decisions you want me to make. Start building the improvements now."*) — all fourteen decisions as recommended. ✅ **Built**: the nine defects (§2), the model decisions (§3), the fatigue items §5.1–§5.4. 🛑 **§5.5 (the reps-in-reserve tap) was NOT built** — it was stated with both sides and not recommended, and he did not name it. ✅ **§6.3 AND §6.4 DONE 2026-09-15** — all 105 comparable entries re-derived against Strength Level with the check made sex-aware first (**inside 5 % went 38 → 85**, pairs 51 → 62, three refused because their published page is a different implement), then **σ per entry** (`js/ratio-sigma.js`, generated) and an **inverse-variance blend**. 🛑 **What §6.4 proposed and did NOT ship**: confidence's quality term as `exp(−σ_post)`, and the ± band on `estimateOneRM`. ⏸️ **NOT DONE, and none of it is blocking**: the **backtest tool** (§6.1) needs **Tim's own export**, which is decision (n) and has not been given — it is the only thing that turns "consistent" into "accurate"; **personal ratios learned from a lifter's own paired lifts** (§6.5). 🛑 **AND THE FALL LIMIT IS A DECISION, NOT A LEFTOVER** — this row called it "half of decision (a)" until 2026-09-15 and plan §3.1 offered a window **or** a smoothed series; the window shipped. Wiring `estimateAt()` replays each exercise as a series, moves every rating, re-baselines the golden table and needs hysteresis with it. `docs/history.md` 2026-09-14 and -15 |
| **26** | ✅ ~~the read pattern — the running cost of this app~~ **BUILT 2026-09-08, on Tim's pick** | `where('updatedAt', '>', cursor)` plus an aggregation **count to catch deletes**, so a cold open pays for what CHANGED rather than for a whole training history. **~20× at every scale** — free servers to ~1,894 users instead of ~94. 🚨 **The first version used a MILLISECOND cursor with `>=` and was worse than useless for the accounts with the most data**: Firestore stamps a batch with one instant, so a restore or a 1,200-row adoption pinned the cursor and re-read everything every sync. A test caught it. 🔒 **Every uncertain path falls back to the full read.** ✅ ~~**What is NOT done**: this has never run against real Firestore~~ **RUN 2026-09-17, and it does what it claims.** `tools/live-check.mjs` (§0.16) measured it on the wire: the cursor is a real server timestamp kept to the nanosecond, **an unchanged sync bills ZERO document reads**, a changed sync bills 2 of 4, the aggregation query is accepted by the deployed rules and needs no composite index, and **a delete this device never saw is caught by the count** — including delete-one-add-one, where the raw count is unmoved. ⚠️ **Scale is still unproved**: it ran on three or four sessions, not on a training history. `docs/running-costs.html`, `docs/history.md` 2026-09-08 second pass and 2026-09-17 |
| **28** | ✅ ~~"followers / following" is Instagram's vocabulary for a graph this app does not have~~ **DECIDED AND DONE 2026-09-09 — THE WORDS CHANGED, NOT THE MODEL** | Tim, asked which way and given both costs: *"just combine the 2 and call them 'friends' instead. We might change it to following/folowers later."* **One count, called Friends.** ⚠️ **He kept the other door open, and the thing that keeps it cheap is that there is no migration** — nothing was built or deleted here; `connections` is the same list it always was and this is two labels over it. 🔒 **`#/me/followers` and `#/me/following` still resolve**, onto the one list, which is titled Friends however you arrive — asserted, because a screen still headed "Followers" would be the rename half-done. ✂️ **The "?" went with the second number** (it existed to explain why two figures were equal); 🚨 **the public-account caveat did NOT** — *"Your account is public, so people can see your training without being friends"* is on the screen, only where it is true, because without it the number reads as an audience. `docs/history.md` 2026-09-09 third pass. ⚠️ **The struck-through half was deleted 2026-09-20** — it posed a question this row's own decision answered |
| **29** | ✅ ~~**THE PROFILE/DATA SPLIT**~~ **FINISHED 2026-09-11 — all five steps** | 🟢 Authorised 2026-09-10 (*"I like all of that. Start working on it now."*), steps 1 and 3 that day, **2, 4 and 5 on 2026-09-11**. ✅ **Step 2** — sex, age and current weight on `#/me`, ⚠️ a DISPLAY move: the row opens `#/profile`, which stays the form. ✅ **Step 4** — Goals off Settings, 🚨 the old row **deleted rather than left as a second door**, `#/goals` still resolving, and 🛑 **no verdict followed it onto the tab**. ✅ **Step 5** — the facts readout came off the Account row (Profile prints them now) and a "Profile" heading over one row went, that word having meant a TAB since 2026-09-08. 🚨 **Building it found that `#/me` had never been in the accessibility audit's route list** — the row called *Profile* is `#/profile`, the form. Fixed and swept. 🔒 **`#/me` holds no field at all, asserted** — `direction.md` §4a's line between the two profile screens. `docs/history.md` 2026-09-11 ~~ The plan he approved, in his order: **1 Calendar → Profile**, **2 body facts (gender, birth year, body weight) → Profile**, **3 personal bests → Profile**, **4 Goals: Settings → Profile**, **5 Account cleanup — whatever is left after 2 and 4.** 🚨 **The rule the whole thing rests on: Data answers what your training MEANS, Profile answers what you DID.** That is what fixed the segment overflow and the empty Profile in one cut. ⚠️ **Step 2 is a DISPLAY move, not a form move** — `#/me` never writes, and `#/profile` stays the form; Profile shows sex, age and current weight and links to it. ⚠️ **Every moved route must keep resolving** (`#/calendar`, `#/day`, `#/edit`, `#/profile`, `#/goals`) — asserted, and `#/calendar` has survived four moves without breaking a link. 🛑 **Nothing goes on Home** — `direction.md` §4a is a placement rule, not a request |
| **27** | ✅ ~~**"DELETE ACCOUNT" LEAVES THE SESSIONS IN FIRESTORE**~~ **FIXED 2026-09-10** | The finding was bigger than the entry: **five of ten collections were never named** (bodyWeight, systems, goals, people, guestSessions), `sessions` was named and still failed on the mass-delete guard, and **`write()` cannot address `shared/*` at all** — so a public account that deleted itself left its published training readable by anybody signed in, permanently, because after `deleteUser()` every rule is `isOwner` and the owner is gone. ✅ `createAccountPurge()` in `js/firebase-backend.js` walks every subcollection, `shared` and `reactions` first (the revocation order), empties the ten whole-list documents that rules forbid deleting, then **RE-READS and refuses to delete the auth user if anything survived**. 🚨 **`wholesale` was deliberately not the fix** — the guard exists so nobody sprinkles it, and the flows allowed to use it snapshot to the cloud first, which for an account about to stop existing is one more unreachable billable document. Proved on the emulator (218 assertions) and against the double. ⚠️ **Still never run against real Firestore — and since 2026-09-17 it is the LAST network path of any size in that state.** `tools/live-check.mjs` (§0.16) is the shape it would be proved in, on a throwaway account; 🛑 **it deletes accounts, so it is not something to bolt onto a spare half hour, and nobody has asked.** ~~ |
| **27-old** | 🗑️ **DELETED 2026-09-20** (§0.3) | It restated row 27's own reasoning at length while 27 was already closed and carried all of it. 🔒 **The one line worth keeping**: the mass-delete guard is why `{ wholesale: true }` was NOT the fix — it exists so nobody sprinkles that flag, and the flows allowed to use it snapshot to the cloud first, which is meaningless for an account being deleted |
| **25b** | 🆕 **the demo has no TIME-based strength set** | ⚠️ Left over from 25. The generator writes every set as `{weight, reps}`, so there is no plank, L-sit or dead hang anywhere in the demo year — a shape the app supports and the demo cannot show. Small; nobody has asked |
| **25** | ✅ ~~the demo cannot show a trained-but-unrankable muscle~~ **FIXED 2026-09-04** | Cable Crunch (Core ranks) and Neck Curl (Neck hatches) — one of each, because the two states cannot sit on one muscle now Core is rankable. Tim authorised the re-baseline it forced. ⚠️ **Still open, and smaller**: the generator writes every set as `{weight, reps}`, so the demo has no TIME-based strength set anywhere — no plank, no L-sit, no dead hang. ~~ 🔒 **The reasoning that outlived it**: adding an exercise to the demo **re-rolls the whole seeded year** — every later `random()` draw shifts, moving the goal assertions and the golden table — and **re-baselining a regression pin is Tim's call, not a side effect of a colour fix** |
| **23** | ✅ ~~a note to the developer~~ **BUILT 2026-09-04** | Form on Account, inbox at `#/notes`, `js/feedback.js` + a `feedback/{noteId}` collection. 🚨 **The developer is a hard-coded uid in `firestore.rules`** and the screen protects nothing; the author cannot read their own note back and nobody can edit one. Rules deployed and proved on the live project. 🛑 **TEMPORARY — take it out when the first users stop being new**, or it becomes a support inbox nobody is staffing. ~~ 🟢 **AUTHORISED, and he said to build it once questioning finished.** *"adding a temporary section to the app that allows the user to write a note or idea straight to the developer (me) would be nice to have. Then, make my account (timhadfield7@gmail.com) a developer account where I can read all these notes or ideas straight on the app."* ⚠️ **DELIBERATELY TEMPORARY** — it exists to catch fresh opinions while the first users are new, not forever. 🚨 **The developer role has to be enforced by `firestore.rules`, not by hiding a screen**: these are other people's words about their own training, and "only Tim can read them" has to be true on the wire. ⚠️ **It is also the first user-submitted free text this app has ever stored**, which is the moderation surface he parked the same day — worth one sentence to him if a decision here would be expensive to undo, and nothing more (that is the single exception he granted to staying quiet) |
| **24** | ✅ ~~the list of every blank and refusal~~ **DELIVERED AND THEN BUILT, 2026-09-06** | The list went to Tim (eight places the app held data and said nothing, nine permanent refusals, twenty honest first-run blanks) and he answered: *"make a plan for each one and start building. Don't ask me questions, just go with whatever you recommend."* ✅ **All eight of the first group shipped that day** — see the 2026-09-06 summary at the top of this file. 🛑 **Two were deliberately NOT built and the reasons are the point**: the Goals profile gate (a goal FREEZES its target weight, so an assumption made once outlives every screen that would relabel it), and the bar-height parameter (`docs/research.md` §15 — the diagnosis in §9 was wrong, and the fix it named would not have worked). ⚠️ **The nine permanent refusals stand**, one of them now with a knee push-up beside it. ~~ ⚠️ **It was a LIST, not a sweep**: *"I think I'll notice the places that show blanks and I'll manually tell you to fix them if I want."* 🛑 **Change nothing off the back of it without him picking** |
| **21** | 🔄 ~~the abs ranking~~ **BUILT 2026-09-04** | ✅ Tim picked his own first idea and it shipped: Core has a key lift (Cable Crunch), a measured median, its own spread and its own reliability penalty. `docs/history.md` 2026-09-04 second pass; `docs/research.md` §14. ⚠️ **What is NOT done, and he has not been asked for it**: it rates about a quarter of how people train abs, and §14.6 records the obvious next lead — published norms for the **plank hold** and the **60-second sit-up** — as **unchecked**, not as rejected. 🛑 Do not start it. ~~ ⏸️ The assessment he asked for is `docs/history.md`, "2026-09-03 — HOW TO RANK ABS" |
| **17** | ~~the Hevy-shaped home feed~~ | ✅ **BUILT 2026-09-02 — all eight steps of `docs/social-plan.md` §13**, which now carries a ✅ block under each one and a §14 summary. What is left of it is two things Tim owes a decision on (**warm-up typing**, still item 2 below; **per-workout visibility**, §13's decision B) and **step 9, photos, which needs Blaze** and is item 10. ⚠️ **The Records column is deliberately absent from the card** — sixty published sessions are not a lifetime, and that caveat does not fit beside somebody's name; the bests are on the workout screen instead. ⚠️ **Nothing here has been used by two real accounts** — that is item 1, and it grew a longer list today |
| **18** | 🔄 ~~do not build the discovery feed~~ **THE REFUSAL WAS LIFTED 2026-09-04** | Tim, asked directly whether a ban decided when this was an app for two people still held once it is on the App Store: **"It has to go eventually."** 🛑 **Nothing is built and he did not ask for a plan.** What the old entry got right is the COST: it needs public profiles and a way to enumerate them, and it imports a moderation story this project does not have. **The sequence is fixed even though the decision flipped: finding strangers cannot ship before blocking and reporting do.** `docs/direction.md` §3.2 |
| **1** | 🔄 ~~the field checks — needs Tim's phone~~ **CLOSED BY TIM, 2026-09-04** | 🛑 **DO NOT RE-OPEN THIS AND DO NOT WRITE ITS WARNINGS AGAIN.** *"Don't record the 'not verified on iphone' warnings at all. I'm constantly testing almost every part of the cite so when something has a problem, I'll come to you."* **Shipped is working unless he says otherwise** (`docs/direction.md` §3.3). ⚠️ **One thing it contained is NOT covered by that and lives on as item 19**: no *predicted number* has been checked against a real attempt, and no amount of using the app can check one. ⚠️ **The two-account round trip also survives, but as something he WANTS rather than as a gap** — he named it among four items he intends to work on and will raise himself. Everything below this line is the record of what the item used to say, kept because it lists precisely what was proved by machine rather than by a person. ~~🆕 2026-09-03 PUT THE BIGGEST SINGLE ITEM ON THIS LIST: NOBODY HAS SEEN A PUBLIC ACCOUNT FROM THE OUTSIDE.~~ Every account is public by default now, and the only way to know what a stranger actually gets is a second real account opening the first one's page — the rules are proved on the emulator and the screens are proved in the demo, and **neither of those is a stranger**. Also unfielded from that day: the tappable friend map, the two-body compare screen, a friend's volume and graph screens, and the **legacy fallback**, which is proved against a fixture shaped like Autumn's live document but has never actually been the thing a real second phone rendered. 🆕 **2026-09-02 ADDED A LOT TO THIS LIST AND NONE OF IT HAS BEEN ON A PHONE**: the new feed card, a friend's workout screen, the comparison sheet, copying a friend's workout into your own plan, and — the one most likely to behave differently on a real device — **sharing a picture**, which goes through `navigator.share({files})` and has only ever been driven in headless Chrome, where it falls through to the download path. ⚠️ **THE BIGGEST ONE IS STILL A TEN-MINUTE JOB WITH AUTUMN**: search her by name, send a request, have her accept it, and record a workout for her so it lands in her account. **Everything social built on 2026-08-29 is proved against the rules engine and has never been done by two people.** Also standing: the **friend-name heal**, a real **kudos/comment** round trip, and — needing only his eyes — **the blue box round the profile picture on a laptop** (a real bug was found and fixed in that exact place, but a *blue* one was never reproduced). ⚠️ **And file import has never parsed an actual export** from any service. ⚠️ **Added 2026-08-30: nobody has read the Research topics on a phone** — the facts are checked and measured, the reading experience is not. 🚨 **AND THE OTHER TWO PASSES OF 2026-09-02 ARE ON THIS LIST TOO, one of them at the top of it: `goBack()` changed EVERY back arrow in the app and has never met the iOS edge-swipe gesture** — which is the one input the design was chosen to survive, and which exists on no machine here. A router-level change to 48 controls verified only in desktop Chrome is the highest-risk unfielded thing of the day. Also unread on a phone: the benchmark screen's estimate and its two captions |
| **2** | **0c — the UX list** | ⚠️ **OPEN, and it is judgement rather than bugs.** Its headline item closed on 2026-08-25 (Home is a feed, which is nothing but growth) and the "hard sets" half was answered on 2026-08-24 by *saying* what is counted. **What is left is one question for Tim**: should logged warm-ups be excluded from the volume count? His call, because the obvious fix would also throw away genuine back-off work. 🆕 **2026-08-31 — THERE IS NOW A THIRD OPTION AND IT IS BETTER THAN BOTH**: Hevy's screens show a set is **typed at logging time** (`W` in amber for a warm-up, working sets numbered from 1), so the app never has to guess. That turns this from "which wrong answer do we pick" into a small feature — a set-type flag, a control in the runner, and the Volume tab's apology becomes a setting. ⚠️ **Every set already recorded is untyped and must stay counted rather than be retro-guessed.** `docs/social-plan.md` §12.16 |
| **3** | **activities, Phase 2 — item 6** | Items 1–4 shipped 2026-08-27. **Item 6 says to ASK TIM** which activities his circle actually logs — climbing grades are the least standardised thing in the list. `docs/activities-plan.md` §3. ⚠️ **Item 5, activity PRs, is PINNED (P1)**, not open |
| **5** | **0i — the body map's touch targets** | ⚠️ **MOSTLY CLOSED.** Invisible hit halos grow every muscle ~10 px in all directions without touching the art (Traps 44×15 → ~64×35 effective, CDP-verified). What remains under 44 px lands on **Tim's illustration**, so it stays his call |
| **6** | **0f — Tim's friend could not sign in** | ⚠️ Unread bug report; he asked to investigate it himself. **May not be new** — a plain Safari tab is still the one surface no working device has confirmed |
| **8** | **item 2 — the estimator, Phases 1–3** | The Goals *verdict* waits on it. ⚠️ **It has questions for Tim** — **§6.1** sets the hard constraint (the band fits inside one level only 8.5 % of the time; ⚠️ **this file cited §16 for that for weeks, and §16 is a different section** — corrected 2026-09-02), and §14 asks whether the estimator may draw on all evidence at once (narrowing D14). 🆕 **2026-09-02 moved two pieces of this without touching the plan's phases**: `buildObservations()` is out of `store.js` and into `js/strength-observations.js`, so a friend's training goes through the same walk as yours; and `muscleRatings()` is that same rating WITHOUT the profile gate, which is what lets an account with no weigh-in have an estimate at all. ⚠️ **The plan's claim that Phase 1 is blocked on data the store does not carry is WRONG** — see the 2026-08-28 section, item 5. `setIndex` and `exerciseIndex` are array positions in data already on disk, derivable at any time. Phase 1 is small; what gates the feature is Phase 2, and Phase 2 needs him |
| **15** | **the usability findings — waiting on Tim's pick** | ⚠️ Four standing findings from the 2026-08-28 usability drive, reported to him and not yet chosen from: **no wake lock** (the biggest hands-free lever), **prefill counts as recorded at Finish**, the **Record chooser's extra tap**, and the Run log's **"28" = 28 seconds** parse. See that day's second-pass section. ⚠️ **The prefill one is HALF fixed as of 2026-08-29 and the halves matter**: a never-done exercise is now guarded (`prefilled`, refused by the save path), an exercise WITH history is untouched — walk past it and last time's numbers record as though you did them. Left alone deliberately: it is a behaviour change on every workout and his to pick. ⚠️ **The rest-timer items in the same list are DECLINED, not waiting** — do not resurface them |
| **19** | ⏸️ **the estimator has never been checked against a person — 🛑 TIM TOOK THIS ONE HIMSELF, 2026-09-09** | *"I'll do 4 myself sometime this week, but I'll come to you about it."* **Do not start it, and do not offer it again** — he has it, and he will bring it back. It stays on this list because it is still true and still the cheapest honesty win, not because it is available. ⚠️ **Not a bug — a standing hole that got much bigger on 2026-09-02.** The app now prints an estimated 1RM for virtually every exercise, a percentage of it, and a predicted rep count, and **not one of those numbers has ever been compared with an actual attempt.** `docs/strength-estimate-plan.md` §11.2 — the backtest against Tim's own held-out benchmarks — is the only thing that would change that, and it has never been run. **It needs nothing from anybody: the data is already on disk.** The cheapest honesty win left in the project |
| **20** | ✅ ~~`docs/research.md` §2's transcription error~~ **FIXED 2026-09-04** | Re-read against PMC10933212. **The 95 % figure is ~2, not ~5**, and a second cell was wrong too — the general 80 % column held the bench-press value. 🚨 **Both were shifts rather than invented numbers**, which is why the table stayed plausible for weeks; §2 now records that shape so the next wrong table gets checked for it first. ⚠️ The numbers are read off FIGURES rather than prose, so the 95 % row is graded 🟡 and the rest 🟢. ✅ Nothing in the app moved: the one citation of §2 is `exercise-estimate.js`, which quotes the BENCH cell, and that cell was always right. ~~ |
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
| **P3** | ✅ ~~**the competitive review**~~ **RAN 2026-09-26, on Tim's ask by name** | 🔒 **The prediction below held**: it produced a list of other apps' features and Tim set it aside — *"forget the improvements from other apps. I want to build it myself."* `docs/history.md` 2026-09-26. ~~ The odd one of the seven briefed on 2026-08-19: the six that ran inspected the **app** and found defects; this one inspects the **market** and produces opinions. `docs/competitive-teardown.html` already covers some of that ground. ⚠️ **Its likely output is a list of things other apps do — the exact input that would push this app toward inventing numbers, the one thing it is good at refusing.** Tim drives the design now and has been right every time |
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
the rest have their own on 2026-08-22. **All seven have now run — the competitive review last, on 2026-09-26** (P3).

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

0a. ~~**IS TIM ABLE TO USE THE APP?**~~ ✅ **YES, 2026-08-24.** ⚠️ **The resume update check has never
   been seen to fire in the field**, only in `tests/sw-update.test.mjs`. 🔒 **The rule this taught is
   §0.13: do not read "X is broken" as X being broken** — check the live site first. It settled the
   years-view report, 2026-09-19's *"the % feature didn't deploy"*, and on 2026-09-20 it correctly
   ruled a stale cache OUT, which is the other half of its value.

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
     the same day** — `docs/history.md`, 2026-08-21 second pass, has the measurements. This
     bullet survived the second pass as a stale copy and is kept struck through rather than deleted,
     because a line saying "nobody has done this" over work that shipped is exactly the failure this
     file exists to prevent.

0d. ~~**⚠️ SWAP AN EXERCISE MID-WORKOUT**~~ ✅ **BUILT AND DEPLOYED 2026-08-24.** A quiet **Swap**
   button beside the exercise name opens the picker, 71 × 44 px. **TODAY ONLY — the saved workout is
   untouched**, Tim's call, and what the runner already does with `isBenchmark` and `group`.

   ⚠️ **COLLAPSED 2026-09-18** (§0.3, the byte budget). `docs/state.md`'s runner row and
   `docs/handbook.md` §4's key patterns carry the mechanics. The three rules worth not re-deriving:
   **a swap with sets already logged SPLITS rather than replaces** (the machine was taken after two
   sets, so two sets were done on the original), it is **inserted after, never appended** (entry
   order scores within-session fatigue — 0g), and **the half you are still doing keeps the group**,
   or a two-exercise superset becomes a three-exercise round and the walker desynchronises
   mid-workout. Mutation-checked: always-replace flips the two assertions about the kept sets.

0e. **⚠️ JOINT WORKOUTS — Tim, 2026-08-24.** *"one person can record both measurements for both
   people on one phone … 2+ names at the top that the user could click on to switch between which
   user they are recording the data to."* Restricted to people who are already friends.

   **His decision, asked and answered: THE OTHER PERSON ACCEPTS IT** — not a direct write into their
   account. ⚠️ **The load-bearing choice**: a direct write needs a rule letting account A write into
   account B's private collections, and `sessions` is **one document per collection**, so a single
   bad write does not corrupt one row — it **replaces someone's entire training history**.

   ⚠️ **THE REST OF THIS SECTION WAS COLLAPSED 2026-09-20** (§0.3) — it is BUILT, and
   `docs/state.md`'s runner row carries the mechanics. The two rules worth not re-deriving:
   **switching names switches the whole SUGGESTION, not just the destination** (each person has their
   own history and their own next step, and handing both lifters one prescription is the thing
   progression is built never to do), and **logging for a GUEST** — a name with no account, kept in
   the recorder's data and handed over later — which is the case Tim actually hit.

0g. ~~**⚠️ WITHIN-SESSION FATIGUE DISTORTS THE MUSCLE RATING**~~ ✅ **TIERS 1 AND 2 BUILT AND
   DEPLOYED 2026-08-24**, same day as the finding, on Tim's *"deploy it now"*. The finding and the
   measurements are below and still worth reading; `docs/fatigue-plan.md` opens with what shipped.
   ⚠️ **Tier 3 — the load multiplier — is deliberately NOT built and should stay that way**, and the
   §6 confound is unresolved: **it is still not established that Tim is stronger than 145 lb.**

   ⚠️ **THE FINDING AND ITS MEASUREMENTS WERE COLLAPSED TO THIS POINTER ON 2026-09-18** (§0.3, the
   byte budget). **`docs/fatigue-plan.md` is the write-up and always was** — §1 the finding, §5 the
   plan, §4 why Tier 3 cannot be built honestly — and this section said so from the day it was
   written. What is kept here is only what a fresh session must not re-derive:

   - 🔒 **FATIGUE DOES NOT ONLY DEPRESS A READING, IT PROMOTES IT** — `evidenceWeight` rewards low
     reps, and a spent lifter also does few reps. Tim's fatigued pulldown out-ranked his best row
     **by 0.005**, entirely on a rep count.
   - 🔒 **NO RE-WEIGHTING SCHEME IS WORTH MUCH**: every variant moved his rating by under 5 lb where
     doing the lift **first** moved it by 60. A fatigued set is **missing** information, and you
     cannot re-weight your way to a number nobody recorded.
   - 🛑 **Tier 3, the load multiplier, must not be built** — it is the only option on the table that
     can make a number BIGGER than what was observed, and the literature reports reps at a fixed
     load rather than 1RM.
   - ⚠️ **The §6 confound is unresolved: DO NOT TELL HIM HE IS STRONGER THAN 145 lb.** His three
     lifts imply 115, 229 and 136; the other candidate explanation — that doubling a one-arm dumbbell
     row onto a two-arm barbell row is generous — has never been checked.

0f. **⚠️ HIS FRIEND'S SIGN-IN FAILED, AND NOBODY KNOWS HOW.** Tim asked to leave it (*"I need to
   investigate it further"*), so it is recorded rather than chased. ⚠️ **It may not be new:** an
   ordinary Safari tab is the one surface no working device has confirmed. **Do not close that item
   on the strength of the installed PWA working.**

0b. **⚠️ THE EDGE-CASE REVIEW'S UNFIXED FINDINGS — 2026-08-22.**
   Full write-up in `docs/history.md`, 2026-08-22 third pass; these are the ones nobody has done.

   - ~~**⚠️ (a) PROGRESSION RATCHETS REPS WITH NO TERMINAL STATE.**~~ ✅ **FIXED 2026-08-22** — a rep
     ceiling at the top of the top band, which **refuses** rather than stepping smaller, and both
     branches are now played forward to forty sessions. See the fifth-pass section.
   - ~~**⚠️ (b) A FAILED SAVE AT THE END OF A WORKOUT IS SILENT.**~~ ✅ **FIXED 2026-08-22** — it
     says so on the screen above the button that failed, keeps the draft (the only other copy), and
     the same tap works again once the problem clears.
   - **⚠️ (c) THE FIRESTORE CEILING IS ~520 SESSIONS, NOT ~950** — ⚠️ **corrected TWICE on
     2026-08-24, both times optimistically**, because **Firestore charges 1.66× the JSON** (a flat
     32 bytes per map, 8 per number). ~2,000 bytes a session, **two and a half years at four a
     week**; `entries` is 88 % of the collection.
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

   ⚠️ **The whole table was re-derived against Strength Level on 2026-09-15** (Open work 30), so
   those figures are superseded and only the method is worth reading: **the errors were 7, 12, 15 and
   15 % — not a constant**, so no blanket factor fixes it. Each entry is derived on its own — one
   population, both lifts, a 180 lb male, divide, take the median.

   ⚠️ **MACHINES ARE THE HARDER HALF AND MAY NOT BE DERIVABLE AT ALL** — a leg press ratio depends
   on the machine's leverage, which is why those `q` values are already low (0.35–0.50). If a source
   cannot be found, say so in the table rather than leave the guess unlabelled.

0i. **⚠️ THE BODY MAP'S TOUCH TARGETS — NOW THE ILLUSTRATION ONLY.** Measured for the first time
   2026-08-24; see that day's fourth-pass section. At 360px the smallest muscles are **Traps 42×11,
   Glutes 39×16, Shoulders 62×18, Neck 24×17**, and **the figure is the only way to select a
   muscle**, so the year grid's equivalence argument is not available. ⚠️ **This lands on Tim's
   illustration, so it is his call** — the cheap options are a larger invisible hit area per path,
   or a list beside the figure.

   ~~Also just under 44: the comparison button and the chart's exercise `select`.~~ ✅ **BOTH AT
   44 px, 2026-08-24** — a control being reliably hittable is worth more than eight pixels of line.

0j. ~~**MUTUAL DISCONNECT IS STILL NOT BUILT**~~ ✅ **BUILT 2026-08-27.** A tombstone at
   `disconnects/{leaverUid}` — **the id IS the caller's uid** — and eventual, not instant.

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
   ✅ **RAN 2026-08-22 AGAINST THE LIVE PROJECT — it works, and it found two defects.**
   ⚠️ **COLLAPSED 2026-09-21** (§0.3); full account in `docs/history.md` 2026-08-22, and both
   defects are closed (the expired-invite one fixed the same day, disconnect by 0j on -27). Four
   things worth not re-deriving:
   - 🛑 **The project holds Tim's two real accounts**, not zero users. Anything that "cleans up to
     zero" destroys them. **Snapshot the baseline first and diff against it.**
   - ⚠️ **Use two SEPARATE browser profiles, not two tabs**, or you prove a round trip that never
     crossed accounts (`docs/improvement-plan.md` §0).
   - 🔒 **Enforcement was checked ON THE WIRE, not in the UI** — the sharpest test made a shared
     document exist holding every weight and rep with the viewer out of its `viewers` list, and
     Firestore refused it.
   - 🔒 **The lesson that outlived it**: `expiresAt` comes back from the SDK as a **Timestamp
     object**, so `Date.parse()` is NaN and every expired invite read as open. The old tests missed
     it because their fixture had no `expiresAt` at all. *A pure module has to be handed the shape
     the network really returns.*

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
| **Everything at once** | 🆕 **6,318 across the TWENTY-THREE that need no Chrome, re-counted 2026-09-25 by running every one.** Per suite: data-layer 2,913 · render 1,638 · goals 278 · social 217 · bodyweight 187 · a11y 157 · template-lint 96 · share-image 91 · optimal 76 · strength-estimate 74 · volume-map 64 · compare 63 · research-pane 59 · demo 58 · rep-decrement 57 · core-rating 47 · year-grid 45 · routine 42 · estimate 37 · qr 33 · exercise-evidence 33 · figure-note 27 · feedback 26. ⚠️ **`research-pane` (59) is a suite this chat has never opened** — the parallel agent's, like `exercise-evidence`, `template-lint` and `figure-note`. `sw-update` (needs Chrome) and `rules` (needs the emulator) are the other two of the **twenty-four** files. 🚨 **THREE OF THESE SUITES ARE NOT THIS CHAT'S** — `exercise-evidence`, `template-lint` and `figure-note` (156 assertions between them) arrived from a **parallel agent working in this same checkout** on 2026-09-20, along with `js/exercise-evidence.js` and `js/template-lint.js`. **Do not assume a suite you do not recognise is stale or yours to change**; see §0.20 and the standing instruction about that agent. **Counted as lines matching `^PASS`**, which is what `render`'s own tally agrees with exactly. *(Earlier recounts, for the shape of the growth: 5,680 on 2026-09-20 · 4,822 on -14 · 4,699 on -12 · 4,380 on -09 · 4,193 on 2026-09-06.)* 🚨 **THE WARNING THIS ROW EXISTS TO CARRY, from 2026-09-09: "SEVENTEEN SUITES" WAS WRONG FOR WEEKS.** `core-rating` and `feedback` shipped on 2026-09-04, were never added here, and so were absent from every total quoted after — a hand-maintained list of files, the same fault as the `sw.js` precache and the doc budgets, both of which are tests. **This row still is not one.** ⚠️ **Test-only npm deps, none of which ship**: `render` needs `jsdom`, `qr` needs `jsqr`, `rules` needs `@firebase/rules-unit-testing`. ⚠️ **`npm i --no-save` REPLACES what is there** — install them in one command (`npm i --no-save jsdom jsqr @firebase/rules-unit-testing`) or the previous one vanishes and its suite fails with MODULE_NOT_FOUND. Everything else needs nothing. ⚠️ Treat any number here as a recount rather than a running tally |
| **Year-grid tests** | `node tests/year-grid.test.mjs` — 45 assertions, **no dependencies**. The calendar's Years view: every day drawn exactly once, every square in its real weekday row, every month label over its own month |
| 🆕 **Fatigue tests** | `node tests/rep-decrement.test.mjs` — **57 assertions** (2026-09-14), **no dependencies**. The per-set rep decrement that reaches the runner's caption. 🚨 **The two load-bearing ones are the invariants, and both are mutation-checked with the mutation printed in the source first**: every multiplier is ≤ 1 (so a wrong constant can only make the caption easier to beat), and a lifter whose reps RISE across a run is **clamped** rather than handed a bigger number. Also: a weight change ends a run, a prefilled set is not a set, drops/supersets/benchmarks contribute nothing (`group != null`, because a truthy test let the first superset of every workout through), 90 s ties to the SHORTER rest column, and the caption never prints "maybe 0". ⚠️ **What it does NOT cover is the wiring** — no mounted screen asserts the multiplier actually reaches the caption; see START HERE |
| **Data tests** | `node tests/data-layer.test.mjs` — **2,861 assertions** (2026-09-22), **no dependencies**. 🆕 **Since 2026-09-22 it pins THE TWO BODY FIGURES against each other** — the same groups on the same views, a traced path and a silhouette for each, both boxes 1527 tall, and `bodyAspect()` reporting the wider one for female with an unknown sex falling back to male. 🆕 **Since 2026-09-15 it holds σ AND THE PRECISION BLEND** — the key lift carrying no conversion uncertainty, a flat published ratio beating a drifting one, gearing surviving a flat drift, the q bridge for an entry with no page, and the load-bearing one: **the same two disagreeing numbers land at 204.5 or 294.6 depending on which conversion is better established**, where the old blend gave 225.0 both ways. Plus **the quarantine's cross-exercise behaviour** from both sides of its 2.0× boundary (kept at 1.99, set aside at 2.01) with two guards on the demo year — nothing set aside on a real year, and the cross-exercise spread under 1.5× so a future ratio correction cannot start withholding real sets silently — and 🚨 **the sexed path pinned beside the golden table**, because `store.js` passes a sex and the table never did. 🆕 **Since 2026-09-14 it holds THE FOUR SEAT RULES AND THE QUARANTINE**: a 3-rep benchmark beats a 12-rep back-off set on the same day (which is what told Tim a tested 215 was "above his max"), a set at ≤ 8 reps is preferred but not required, the 84-day window lets a rating FALL while a lay-off keeps its record, the same history walked in either order gives an identical rating (it read Fair one way and High the other), and the typo screen holds back a ×10 slip **by name** while leaving a personal best and the good sets logged beside it alone. Plus the ratio pins **per sex** on both sides of every pair, and six **split-ordering** checks (a specific rule must not fall below its family — the machine lateral raise inside `/Lateral Raise/` was a 3.7× inflation). ⚠️ **The GOLDEN table was re-baselined on 2026-09-14 with every move attributed by name** — eleven of twelve muscles down, Traps up 14 % because the deadlift stopped standing in for it. 🆕 **Since 2026-09-12 it holds the RANKED BEST LIFTS** (`js/profile-ranking.js`) on a discriminating fixture — a 343 lb squat below a 139 lb curl, a never-done core lift converted, a stand-in-only one with no number, the heaviest "other" lift last because unranked; flipping the comparator fails exactly the three ordering assertions. 🆕 **Since 2026-09-08 the Google flow's `created` flag**, which decides whether creating an account absorbs this device's local rows: linking an anonymous session counts, and 🚨 `signInWithCredential` after `credential-already-in-use` does NOT — that branch is reached precisely because the account already exists. **Mutation-checked in both directions.** **⚠️ THE AUGUST HALF IS COMPRESSED HERE, 2026-09-15**, the same cut the render row took and for the same reason. Still asserted, detail in `docs/history.md` 2026-08-24 to -30: the **exercise-picture manifest** against the folder and the sw precache, the **movement families** (271 members each resolving to exactly one exercise, four family-less on purpose), the **Research tab's content and WORD BUDGETS** (45 an answer, 260 a topic — the only thing that can catch prose piling back up, since every other assertion checks a thing is PRESENT), the **crop maths** (1,925 combinations, zero escapes), the **file-import refusals** (date order, weight unit, distance unit each refused rather than guessed), **how full the cloud is**, and the **within-session fatigue** section built on Tim's real back session. ⚠️ **That last one changed shape on 2026-09-15** — see the σ note at the top of this row |
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
| **Accessibility tests** | `node tests/a11y.test.mjs` — **131 assertions** (2026-09-12), **no dependencies**. 🆕 Since 2026-09-12 it pins the CSS half of the set lock and the drag: the dragged row has NO transition, the passed rows do, the padlock's keyframes run on `--t`/`--ease-both`, an idle padlock is `visibility: hidden` never `display: none`, and it carries the 44px halo. Pins **all four PALETTES**: every text token against every surface it can be painted on, in both themes, plus the three-step hierarchy and the two fixes that are invisible when they break. ⚠️ **Not a substitute for the audit** — it caught a latent light-theme pair no screen currently paints, and the audit caught an accent-coloured number on one cell in the month. Neither could have found the other's |
| **The accessibility AUDIT** | 🚨 **`#/me` WAS NOT IN ITS ROUTE LIST UNTIL 2026-09-11, AND THE REASON IT WENT UNNOTICED IS THE LESSON**: the list already had a row called **Profile** and that row is `#/profile`, the gender/birth-year FORM — so the Profile TAB, live since 2026-09-08, had never had a pixel measured while the list looked complete. **The 2026-08-24 `#/data` fault in its mildest form: a route absent from the list looks exactly like a route that passed.** ✅ Added with `#/me/workouts`; latest sweep **272 routes, 34,027 text nodes, zero below 4.5:1, zero overflow, zero unnamed controls** at 360 / 390 / 880 / 1280. ⚠️ **And the first SUMMARY of that run was wrong in the reassuring direction** — a script reading the wrong JSON keys reported *0 text nodes, 256 contrast failures*; the node-count rule below catches a broken reader as well as a stale server. `tools/a11y-audit.mjs` — drives Chrome over **100** screen/width/theme combinations as of 2026-09-02 (**11,365** text nodes, zero below 4.5:1, zero overflow, zero unnamed controls), and since 2026-08-27 takes a `PALETTE` env var (gold/teal/indigo/ember) so all four can be swept. 🆕 **Three routes joined on 2026-09-02 and two of them are firsts**: a friend's workout and the comparison sheet over it are **the first screens behind `#/friend` this audit has ever measured** — a friend's uid is generated, so there was no hash to put in the list until the feed card's own link existed to click; and `#/benchmark` now runs **with an exercise picked and a weight typed**, because everything added to that screen only exists after that. *(Earlier figure, kept for the shape of the growth: gold over 76 × **7,566** nodes on 2026-08-30: zero below 4.5:1, zero overflow, zero unnamed controls; ⚠️ **the SWAP SHEET joined on 2026-08-30 and it is the first SHEET this audit has ever measured** — a sheet only exists after an interaction, so the exercise picker and the visibility sheet have never been in it either; the last all-four sweep was 240 combinations and 23,496 nodes on 2026-08-27). 🚨 **TWO THINGS THE TOOL ITSELF HAD WRONG, both fixed 2026-08-30 and both found by measuring the Research topics.** (1) **A closed `<details>` still reports a box for its contents in this Chrome** — it hides them with content-visibility, not `display:none` — so the collapsed pane and the opened one measured an identical 328 text nodes. Never a false pass (those colours do get painted on open) but a **false coverage claim**, and the research TABLE had been counted that way since 2026-08-28. (2) **`summary` matched nothing in the control selector** — natively focusable, no `tabindex` — so **every disclosure control in the app had been unmeasured for touch target and accessible name since the first one shipped**; the topic summaries measure 49–78 px by 332/362. ⚠️ **THE SESSION RUNNER JOINED IT ON 2026-08-29 and had never been measured before that** — the one screen the app exists for, skipped because a session needs a workout id and the route list only held static hashes. It is reached by driving Record → Weightlifting → the next workout, and **the step asserts it landed** (`.set-list` must exist): the first version matched `/^Start/` against the chooser's rows, whose text begins with the workout NAME, and silently filed four route-instances of the picker under the runner's name. A failed step is now **printed rather than swallowed**, for the same reason. Set through the ATTRIBUTE, because the demo backend reseeds on every reload. ⚠️ **Until 2026-08-24 two of its routes (`#/data`, `#/muscles`) did not exist and silently rendered Home**, so Home was measured three times and the Data screen and body map never once. Fixed: the real route is `#/graphs` and a route row can now carry a step to run after navigating, which is how the four in-page data modes and a selected muscle are reached. Needs a scratch copy with the config blanked; the header has the commands. ⚠️ **Its `hit44` flag is a TRIPWIRE, NOT A VERDICT** — it fails 1616 of 2068 controls on long-audited screens, because anything under 44px in either dimension fails by construction. **The only thing that can measure contrast against the colour actually painted, or hit-test a touch target** |
| **Render tests** | `npm i --no-save jsdom` then `node tests/render.test.mjs` — **1,620 assertions** (2026-09-22). **Mounts every screen.** ⚠️ **COMPRESSED TO ITS METHOD, 2026-09-22** — this row had grown to 8 KB listing what the suite covers, which is a thing the suite itself says better and nobody re-reads here. **What it covers is in `docs/history.md` under each date; what is worth carrying is HOW.** 🔒 **§0.21 in the handbook is the four ways of writing an assertion** (assert an absence, give the fixture the case that can fail, assert by CLICKING, hold the node across a repaint) plus the one BUDGET assertion — the muscle panel's 40-word cap, the only check in this project that can catch prose piling back up. 🔒 **Three more shapes this suite is built on**: **no parked screen is ever built in jsdom** (one would double every selector in the file); **jsdom has no layout**, so it pins STRUCTURE (the figure and its panel are siblings in one `.map-split`) and the browser measures the pixels; and a caveat moved behind a "?" is asserted by **clicking the dot and reading the popover back**, which is stricter than the presence check it replaced. ⚠️ **The fixture IS the assertion** — a friend's map is pinned with a fixture where **she is female and the reader is male**, because every earlier one published a male `defaultCompare` and so could not tell the right answer from the wrong one; 2026-09-22 added the same shape for the female FIGURE, where the vacuity guard is always the other sex measured in the same breath. ⚠️ **41 mutations across five agents on 2026-09-16, each proved to have landed** — the one that survived did so because the assertion matched the mutation's own marker comment, §0.14 in a new costume |
| **Deploy-notice test** | `node tests/sw-update.test.mjs` — 12 assertions, needs Chrome, **no other dependencies**. Copies the app to a temp dir, serves it, installs the worker, then EDITS A FILE and asserts the page offers a refresh. The one test that cannot be faked |
| **QR tests** | `node tests/qr.test.mjs` — 33 assertions. Needs `npm i --no-save jsqr` for the strongest layer: the encoder's output is rendered to pixels and **decoded by an independent implementation**, which validates format-info, masking, placement, interleaving and ECC in one assertion. Also carries ZXing's published Reed-Solomon vectors. ⚠️ **It does NOT assert which mask a payload gets** — ZXing, Nayuki and the ISO text disagree on penalty-rule-3 details, so a correct implementation can legitimately pick a different one |
| **Rules tests** | `npm i --no-save @firebase/rules-unit-testing`, then **`JAVA_HOME` must point at Temurin 21** (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`), then `firebase emulators:exec --only firestore --project demo-test "node tests/rules.test.mjs"` — **221 assertions** (2026-09-16), who may READ your data — and since 2026-08-27 who may OFFER you a workout and who may announce a disconnection, and since 2026-08-29 who may ASK to connect. 🚨 **One assertion in here is deliberately an `allow` that records a cost rather than a guarantee** — "any signed-in account can list the whole directory" — because a suite that pinned only the good news would describe a feature this app does not have. **It is the line that flips to a denial when the handle version lands.** ⚠️ **On the Oracle JDK the emulator dies silently** — see §0.9 |
| **Rebuild the picture manifest** | `node tools/build-exercise-images.mjs` — after dropping files into `img/exercises/` named `<exerciseId>.<ext>`. Rewrites the manifest in `js/exercise-images.js` AND the precache block in `sw.js`. ⚠️ It REFUSES a badly-named file rather than skipping it: a picture that never appears looks exactly like one that was never bought. `img/exercises/README.md` has the naming and the licensing |
| **Rebuild the body art** | `python tools/build-body-art.py` — only if a source image or the seeds change. `--only male\|female` for one figure. Needs `pip install pillow numpy scipy potracer`. 🆕 **TWO FIGURES SINCE 2026-09-22**: the male sheet `Human_Muscle_Groups.jpg` and the female pair `Female_Muscle_Groups_Front.png` / `_Back.png`, all three git-ignored at the repo root — **the art cannot be rebuilt without them.** 🔒 **The male output must come back BYTE-IDENTICAL** after any change to the shared half (smoothing, the piece guard, the trace); hash it, because that is the only thing that makes "I did not touch the male figure" a measurement |
| **Look at it** | headless Chrome — §0.6. Use CDP + `Emulation.setDeviceMetricsOverride` for anything involving input |
| **Firebase** | project `fitness-tracker-th` · [console](https://console.firebase.google.com/project/fitness-tracker-th/overview) · `firebase deploy --only firestore:rules` |
| **Deploy** | commit + push to `main`; Pages rebuilds in ~40–50s |

It needs a server — ES modules do not load over `file://`.

