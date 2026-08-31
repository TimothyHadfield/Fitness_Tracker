# Improvement plan — 2026-08-19

> Tim asked for a large plan, a review of everything built for problems, and thinking about human
> behaviour, design, and how this compares to other apps.
>
> ⚠️ **THIS PLAN IS PARTLY UNBACKED, AND THE GAPS ARE MARKED.** A seven-agent review wave was
> launched to produce the evidence for it and **every agent was killed by a session usage limit
> before returning anything**. Nothing in this file comes from that wave. What is here comes from
> the codebase, from `progress.md`, from what was built and verified today, and from **one finding
> re-verified by hand**. Sections marked ⚠️ NOT AUDITED are hypotheses about where problems are
> likely to be, not findings. **Re-run the review before trusting them.**

---

## 0. The re-run list — do this first

Seven reviews were scoped and briefed; none completed. They are worth re-running as written, and
their briefs are recorded here so nobody has to re-derive them.

| Review | What it was to find | Status |
|---|---|---|
| **Adversarial code review** | Bugs in code written 2026-08-19 — much of it written fast by parallel agents. Top target `js/progression.js`, because it is the only part of this app that can cause physical harm | ✅ **RAN 2026-08-20 — progression only. FOUND A REAL BUG**, below. `strength-estimate.js` and the body-weight work still not attacked |
| **Human behaviour / UX** | The app judged as a product for strangers. Jargon leaks, first-run path, what brings anyone back | ✅ **RAN 2026-08-22 — CORRECTED HERE 2026-09-02; this cell said "Not run" for ten days after it had.** It found the sharpest single thing on the list: **Goals told a user who was meeting their target that they were short**. See `progress.md`, 2026-08-22 fifth pass, and its "findings that are NOT fixed" list — that list is judgement rather than bugs and is where the unfinished work sits. Item 1 on it, *nothing a user can see on Home ever grows*, is still open |
| **Competitive** | Whether the differentiation still holds in Aug 2026; what rivals do better; what users complain about now | ⚠️ **PINNED 2026-08-28 — not run, and deliberately not queued** (see below) |
| **Cross-screen consistency** | Two screens disagreeing about the same fact | ✅ **RAN 2026-08-20 — found one**, below. Two §3 hypotheses checked and CLOSED |
| **Accessibility / mobile reality** | Touch targets, contrast, keyboard, screen readers, text scaling. **Never audited once** | ✅ **RAN 2026-08-20 — contrast, touch targets and accessible names. FAILED ON ALL THREE**, below. Keyboard, screen readers and text scaling still NOT checked |
| **Edge cases / data integrity** | Deletion, timezones, scale, absurd values, backup restore, a suspected FOURTH single-flight bug | ✅ **RAN 2026-08-22 — found a DST day-index bug (fixed) and eight more**, four of them serious and still open: progression ratcheting reps with no terminal state, a silent save failure at the end of a workout, a ~950-session Firestore ceiling against a documented 3,000, and an unvalidated backup restore. See `progress.md`, 2026-08-22 third pass. The suspected fourth single-flight bug was checked earlier and is CLOSED |
| **Social round trip, live** | Two throwaway accounts actually connecting against the live project | ✅ **RAN 2026-08-22 — the whole trip, and it FOUND TWO DEFECTS**, below. Accounts and documents deleted; project verified back to its exact pre-run state |

~~**The single most valuable of the four still open is the social round trip**~~ — **it has now run**,
and it did what it was scoped to do: it converted the largest built feature in the project from
"reviewed code" to "verified", and it found two things no amount of reading had. **Edge cases ran
the same day.** ~~**Two still open**: human behaviour / UX, and competitive.~~
⚠️ **CORRECTED 2026-09-02 — ONE is still open, not two.** The human-behaviour / UX review **ran on
2026-08-22**, last of the seven, and found the Goals target bug. **SIX of the seven have run and
every one found something real.** The only one outstanding is the **competitive** review, and it is
PINNED — see immediately below.

⚠️ **THE COMPETITIVE REVIEW IS PINNED — 2026-08-28. Do not offer it as the next thing to do.** It is
the odd one out of the seven and always was: **the six that ran inspected the APP and found
defects** — a progression that destroyed its own rep range, a percentage printed with no caveat, the
first accessibility failure, a DST day-index bug, a Goals screen telling somebody meeting their
target that they were short. **This one inspects the MARKET and produces opinions.**
`docs/competitive-teardown.html` already covers part of that ground.

⚠️ **The specific hazard is its output, not its cost.** The most likely deliverable is a list of
things other apps do — which is precisely the input that would push this app toward inventing
numbers, the one thing it is good at refusing (Rule 5, D14, the "no on-track verdict" line on
Goals). And Tim drives the design directly now: he has reversed this file's judgement three times
and been right every time, because his argument was about how a screen is used. **A market survey
does not improve on that.** Run it if he asks for it by name. See the PINNED table in
`progress.md`.

⚠️ **ON RUNNING THESE AS AGENTS — the old warning here was too broad.** The 2026-08-19 attempt
launched seven at once and a usage limit killed every one before a single finding came back, and
this section has said "serially, never a wave" ever since. **Tim authorised a wave again on
2026-08-22 and a small one worked**: three at once, each with a written brief and an explicit list
of files it must not touch, and each returned real findings. So the lesson is narrower than it was
written — **seven is what failed, and FILE CONFLICTS are the thing to plan for.** Two agents did
edit `progress.md` concurrently and their edits coexisted only because they were writing different
sections. A review that returns nothing is still worth exactly nothing.

### What the three that ran actually found

1. **⚠️ Progression destroyed the rep range it had just prescribed.** The band was inferred from ONE
   session; `REP_BANDS` share their boundaries and `repRangeFor()` resolves a boundary downwards on
   purpose — so "+5 lb and back to 8 reps", said with range 8–12, came back next session as 8 reps
   read cold, which is the **top of 6–8**. An obedient lifter went 185 × 10 → **200 × 6** in twelve
   sessions, taking load roughly twice as often as double progression allows. Three of the five bands
   collapse this way. Fixed with `trainingRange()`, which reads the range across recent history and
   can only ever widen it *upward* — so the fix cannot propose a heavier weight than the old code
   did, only withhold one.

   ⚠️ **The lesson is bigger than the bug.** 197 assertions, mutation-checked and swept, and every
   one handed the module a history somebody else wrote. **None closed the loop.** *A rule that reads
   its own output needs a test that plays it forward* — suggest, obey, feed it back, ask whether the
   app still agrees with itself. That test exists now. Anything else in this codebase that consumes
   what it produced wants the same treatment.

2. **The Goals programme matcher printed a strength percentage with no caveat**, and its
   fractional-sets note was a hand-written paraphrase of `INDIRECT_NOTE` that had already lost "not a
   measured fact". `INDIRECT_NOTE` is now a shared stem plus a per-screen consequence clause, both
   imported statically. **This was §3 hypothesis 2 and it was right.**

3. **⚠️ Accessibility failed on every axis that was measured**, and §3 hypothesis 5 was right.
   `--ink-faint` — the token carrying `.field-help` and `.req-source`, the caveats and the citations
   — measured **3.94:1 dark and 3.05:1 light** against 4.5:1 AA, across 28 class/theme pairs and all
   75 of its uses. **Every `<label>` in the app named nothing**: 19 of them, none associated, so a
   screen reader said "edit text, blank" on every form. The calendar's today number failed at 3.94:1
   in light, on one cell in the month. Touch targets ran 31–36 px.

   ⚠️ **The project had already caught the contrast bug once and fixed one call site.** A comment
   beside `.chart .hover-date` records the 3.05:1 measurement and the token stayed in 75 other
   places. *Finding a bug in a token and fixing the call site is how a bug survives its own fix.*

   ⚠️ **And the fix broke silently on the first attempt** — an `::after` hit area collided with
   `.avatar-btn.at-risk::after`, the backup dot, which wins on specificity. Nothing looked wrong.
   Re-measuring is what found it. **Verify a fix with the instrument that found the bug**, not by
   reading the change back.

4. **⚠️ The social round trip ran, and the security half held everywhere it was pushed.** Two email
   accounts in two separate Chrome profiles — the trap this brief warned about, and the uids were
   compared before anything was shared. Everything below was checked against **what Firestore
   actually handed the other account**, not against what the screen said:

   - At *just that I trained*, the published document holds three workout names and three dates and
     **no number anywhere**. The whitelist builder and the absence guard do what they claim.
   - The other account's private `sessions`, `benchmarks`, `bodyWeight`, `settings` and
     `social/graph` are all `permission-denied`, and so is **listing** `shared/` or `invites/`.
   - The sharpest test available with two accounts: a `shared/mid` document was made to **exist**,
     holding every weight and rep, with the viewer deliberately left out of its `viewers` list.
     Firestore refused it. So the list-inside-the-document design is genuinely enforced, not
     enforced-by-absence.
   - Moving somebody down a tier, and disconnecting them, each cut access to a document that was
     **still there** — revocation is real, not just a UI state.
   - Body weight stayed absent from `full` until it was separately opted into, appeared when it was,
     and genuinely vanished from the document when it was turned off again (whole-document write,
     not a merge).

   **⚠️ Two defects, and both needed the browser to find:**

   - **Every expired invite read as `open`.** `expiresAt` is written as a Date, so the SDK reads it
     back as a **Timestamp object**. `Date.parse()` on one is NaN, and `NaN <= now` is false — so
     the comparison that decides expiry always said "not expired". A link three weeks stale showed
     the "Connect" screen, and the only thing that stopped the claim was `firestore.rules`, arriving
     as a raw "Missing or insufficient permissions". Fixed in `js/social.js`; six new assertions in
     `tests/social.test.mjs` fail without it. **The old tests missed it because their fixture had no
     `expiresAt` at all** — they only ever exercised the fallback the app never takes. *A pure
     module has to be handed the shape the network really returns, not a tidier one.* This is the
     same lesson as the progression bug above, one layer down.
   - **⚠️ Disconnect is one-sided, and the confirm sheet says the opposite. NOT FIXED.**
     `social.remove()` edits only the leaver's graph, so the other person's published copy still
     lists them in `viewers` — **the leaver can still read their data after pressing Disconnect**,
     while the sheet promises "you will not see theirs". The other side is never told, and the
     leaver loses the screen that would let them notice. A real mutual disconnect needs a document
     the other client can read, which is a new rules path and a design decision, not a small fix.

**Closed, not findings:** the suspected fourth single-flight bug (§3.1) — the contribution cache
already carries body weight in its key — and the per-session clamp, which lives inside
`weeklyVolume()` so all three callers get it.

---

## 1. Confirmed problems

### 1.1 ⚠️ The first-run path makes a stranger learn a concept before they can log anything

> ✅ **FIXED 2026-08-21 — kept here because the reasoning is why the fix took the shape it did.**
> Option 1 below is what shipped: **Explore leads an empty account**, and install → first logged set
> is **five taps, measured**, against about a dozen before. §4 Tier B item 3 already records this;
> this heading did not, and read as a live confirmed problem for eleven days. ⚠️ **The jargon sweep
> that follows it (Tier B item 4) has NOT been done.**

**Verified by hand, 2026-08-19.** On an empty account, Home's primary button reads **"Create your
first workout"** and navigates to `#/workouts` — a screen titled *Workouts* whose two actions are
**"New system"** and **"Explore ready-made systems"**, over an empty state explaining what a system
is.

The screen is not a dead end. The problem is a **promise/destination mismatch**: the button says
*workout* and the destination talks about *systems*. A person who has never used this app now has to
absorb a concept they did not ask for — and one that exists for the app's benefit (D22: a workout
belongs to exactly one system) rather than for theirs.

The shortest honest path from install to a logged set is roughly: Home → Workouts → New system →
name it → save → add a workout → name it → exercise picker → add exercises → save → back → Start a
workout → pick it → run. That is a long way to the first number, and **the logging loop is the only
thing apps beat spreadsheets at** (D4). Every competitor gets you logging faster.

**The fix is not to remove systems.** It is to stop making the newcomer meet them first. Options,
best first:

1. **Make Explore the primary first-run action, not the secondary one.** A ready-made system is one
   tap to a complete programme, and it teaches what a system is by example instead of by
   explanation — which is D8 exactly. On an empty account the big button should be *"Start from a
   ready-made programme"*, with building your own underneath.
2. **Let "Create your first workout" actually create a workout**, putting it in a default system
   ("My Workouts" already exists as a migration target) and mentioning systems only once there is a
   second one to organise.
3. Keep the current path for anyone who taps *New system* deliberately.

**This is the highest-value UX change available and it is cheap.**

### 1.2 Known gaps carried forward from `progress.md` §9

These are already recorded, already honest, and still open. Listed so the plan is complete:

- **A stale weigh-in gets no penalty.** Carrying a weigh-in backward is priced at 0.70; carrying it
  forward is not priced at all, so somebody logging pull-ups for two years after one weigh-in is
  scored at that old weight with full confidence. Same class of problem the body-weight work fixed,
  arriving from the other side.
- **High-rep extrapolation cannot be honestly shrunk** — measured and declared unfittable
  (`docs/strength-estimate-plan.md` §15.2). The band carries the uncertainty instead.
- **Core, Neck and Cardio can never be ranked** — no published standards. The UI says so.
- **The estimator is validated against a model, not a human.** §11.2's backtest is the only thing
  that changes that.

---

## 2. Where this app genuinely stands — and where the claim is thin

⚠️ **NOT AUDITED.** The competitive review did not run. This is the standing position from
`docs/competitive-teardown.html` plus what has been built since, and it **needs checking before it
is repeated to anyone**, because the teardown predates most of this app.

⚠️ **2026-09-02: THIS IS NOW THE ONLY ⚠️ NOT AUDITED SECTION LEFT, AND IT CANNOT BE CLOSED THE WAY
THE HEADER SAYS.** The file's opening banner tells a reader to re-run the review before trusting a
NOT AUDITED section; **the competitive review is PINNED and must not be offered as the next thing to
do** (§0, and the PINNED table in `progress.md`). So this section stays unbacked deliberately.
**Treat it as a position, not a finding, and do not repeat it to anyone as fact** — that instruction
is the whole of what to do here unless Tim asks for the review by name.

### Real advantages, in rough order of durability

1. **It says when it does not know.** Confidence on every muscle rating, bands rather than points,
   a strength score that states on screen what it cannot see, and refusals written into the modules
   themselves. No competitor does this, and it is hard to retrofit because it requires being willing
   to look less capable.
2. **Per-muscle rather than per-exercise analysis**, from *every* exercise that trains a muscle.
3. **Offline is real** (D6), verified by killing the origin server rather than emulating.
4. **Your history is never paywalled.** Four of five rivals monetise by restricting access to data
   you produced.
5. **Sources are cited and graded** 🟢🟡🔴, and corrected when wrong — the sleep evidence and the
   2009→2026 position stand both got fixed rather than left.

### Real disadvantages

1. **No native app, no watch, no exercise demo videos, no plate calculator, no community.**
2. **One developer**, and no mobile testing has ever happened on a real device.
3. **Nothing yet creates a reason to come back tomorrow** beyond conscientiousness. ⚠️ This is the
   one I would most want the UX review to test, because it is the difference between an app someone
   admires and an app someone uses.
4. ~~**The first-run path is slow** (§1.1).~~ ✅ **FIXED 2026-08-21** — five taps from install to a
   logged set, measured. See §1.1.

---

## 3. ⚠️ Where problems are most likely — hypotheses, not findings

Ranked by where I would look first, given what this codebase has already been bitten by.

1. **A fourth single-flight bug.** Three found so far — `ensureSystems()` twice and
   `MemoryBackend.seed()` today. Look at every read-modify-write, every flag set before an `await`,
   and **every cache whose key omits an input**. Today's contribution cache was keyed on exercise id
   while body weight had just become an input to it; that class of bug is live in this codebase.
2. **Cross-screen disagreement about weekly sets per muscle.** A per-session clamp of 24 landed in
   `weeklyVolume()` today. Every caller should get the clamped number — the badge, the Goals
   requirements, and the Goals programme matcher. Also: the Goals screens do **not** carry the new
   indirect-set caveat or the strength caveat that Explore and the system screen now carry, which is
   a stated inconsistency rather than a numeric one.
3. **`js/progression.js` under odd input** — mixed reps across sets, one set, unit switching, an
   exercise whose history is entirely bodyweight. It is new, safety-critical, and its rep-range
   inference is the app's own invention rather than a published rule.
4. **Deletion and dangling references.** Two bugs of this shape already fixed. The untested case is
   a custom exercise deleted under a year of history.
5. ~~**Accessibility.** Never audited.~~ ✅ **AUDITED 2026-08-20 AND IT FAILED — this hypothesis was
   right.** `--ink-faint`, the token carrying `.field-help`, missed AA in both themes across all 75
   of its uses; every `<label>` in the app named nothing; touch targets ran 31–36 px. All fixed and
   re-measured — see `progress.md`, 2026-08-20 §0. ⚠️ **Two of the three things named here were NOT
   checked and are still unknown**: the muscle map's irregular SVG tap targets were never hit-tested,
   and no keyboard path, screen reader or larger-text setting has ever been tried. (The nav bar was
   six tabs when this was written and is **five** since 2026-08-22; it was confirmed to fit at
   360 px both times.)

---

## 4. The plan, in order

**Tier A — verify what exists.** Nothing new should be built before these.

1. Re-run the reviews in §0. ~~**Three have run** (adversarial, cross-screen, accessibility) and all
   three found something real; **four are left** — UX, competitive, edge cases, and the social round
   trip. Start with the social round trip.~~ ⚠️ **Serially, not as a parallel wave** — the wave is what
   the usage limit killed on 2026-08-19, and doing them by hand cost less and actually returned
   findings.
   ⚠️ **CORRECTED 2026-09-02: SIX have run, not three, and ONE is left.** Edge cases, the social
   round trip and human behaviour / UX all ran on **2026-08-22**, and all three found something real.
   The only outstanding review is **competitive**, which is **PINNED** — do not offer it as the next
   thing to do (§0). ⚠️ **The "serially, not as a wave" instruction was itself narrowed on
   2026-08-22** — §0 records that a wave of three, each with a written brief and an explicit list of
   files it must not touch, worked. Seven at once is what failed; **file conflicts are the thing to
   plan for.**
2. Act on whatever they find.

**Tier B — the newcomer.**

3. ~~Fix the first-run path (§1.1).~~ **DONE 2026-08-21** — Explore leads an empty account, and
   install → first logged set is **five taps, measured**, against about a dozen before.
4. Sweep for jargon reaching a screen without explanation. D8 says teach at the moment of use; that
   rule needs auditing rather than assuming.

**Tier C — finish what is half-built.**

5. **The estimator, Phases 1–3.** ⚠️ Read **§6.1** of the estimate plan first: the band fits inside
   one level only **8.5 %** of the time, so Phase 2 must be *designed for the hedged reading*. This is
   what the Goals verdict waits on.
   ⚠️ **CORRECTED 2026-09-02: this line said §16, and it was wrong.** The 8.5 % measurement is in
   `docs/strength-estimate-plan.md` **§6.1 ("Levels stop flapping")**, in the MEASURED block under
   it. §16 exists — it is *"What Phase 0 did NOT establish"* — which is what made the miscitation
   expensive: it sends a reader to a real section that does not contain the number, so it reads as a
   missing paragraph rather than an obvious typo. §6.1's finding is also restated in that plan's
   §12 phase table and in §14's open questions.
6. ~~**The weekly-sets-per-muscle screen** (D3). The mapping and the target bands both exist and are
   unused. This is the clearest "insight comes out" feature still unbuilt, and it is what the
   teardown says every rival fails at.~~ ✅ **BUILT 2026-09-01 — Data → Volume**, the fifth segment on
   that tab. Computed from **recorded sessions**, every muscle. ⚠️ **One departure worth keeping**:
   it reads against the **published efficiency tiers** — what another set buys — rather than against
   the "target bands" this line assumed, because the app does not get to tell somebody they are doing
   too little or too much (Rule 6). D3 in `progress.md` carries the same note.
7. **A report of what you actually did**, which is where the two findings the rating cannot use
   belong: the share of logged sets at 8 reps or fewer (load matters enormously for strength), and
   exercise order (88 % QoE, the highest-confidence finding this project has). Both are measurements
   of recorded history rather than models of a plan.

**Tier D — reach.**

8. Real-device testing, when Tim decides. Deferred deliberately; not to be raised.
9. ~~Social phase 4, which still needs D7 narrowed first.~~ ✅ **BUILT 2026-09-02** — the Hevy-shaped
   home feed, all eight steps of `docs/social-plan.md` §13, summarised in its §14. ⚠️ **D7 was never
   actually reopened**: `docs/social-plan.md` §11 records that "see what my friends are doing" was
   delivered by a friend's page, so the locked decision was not in the way; §12.9 states the sharper
   version — **a friends feed is a list you visit, and the public DISCOVERY feed is the thing D7
   refused.** 🛑 **Do not build the discovery feed** (§12.11, `progress.md` Open work 18). What is
   left of social is photos (step 9, needs Blaze), two decisions Tim owes (warm-up typing,
   per-workout visibility), and 🚨 **the fact that none of the 2026-09-02 work has been used by two
   real accounts or seen a phone.**

---

## 5. Open questions for Tim

1. **Ratify D18?** ~~Still the only genuinely open question in `progress.md`.~~ Phase 0 of the
   estimator is now done, so the fallback — ship it as a separate labelled chart mode — is concrete
   rather than hypothetical.
   ⚠️ **CORRECTED 2026-09-02: it is no longer the only one.** `progress.md`'s "five things a fresh
   session most needs to know" now lists **three** decisions that are Tim's and must not be made by
   implementing them: **(a) should a warm-up be typed by the lifter?** — the highest-value item on
   that list, since every recorded set counts everywhere until he says otherwise; **(b) per-workout
   visibility as well as per-person?** (`docs/social-plan.md` §13, decision B); and **(c) ratify
   D18**, unanswered since 2026-08-16. ⏸️ **Volume in pounds is a fourth thing he has already
   answered — with a refusal** (*"Replace Volume for # of sets"*), and it should not be re-offered.
2. **Is "a reason to come back tomorrow" a goal?** The app is deliberately free of streaks, badges
   and nudges, and that is defensible — but it means retention rests entirely on the analysis being
   worth returning to. Worth an explicit decision rather than an accident.
