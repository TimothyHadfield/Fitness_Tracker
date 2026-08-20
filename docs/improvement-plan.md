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
| **Human behaviour / UX** | The app judged as a product for strangers. Jargon leaks, first-run path, what brings anyone back | Not run — one finding recovered by hand, §1.1 |
| **Competitive** | Whether the differentiation still holds in Aug 2026; what rivals do better; what users complain about now | Not run |
| **Cross-screen consistency** | Two screens disagreeing about the same fact | ✅ **RAN 2026-08-20 — found one**, below. Two §3 hypotheses checked and CLOSED |
| **Accessibility / mobile reality** | Touch targets, contrast, keyboard, screen readers, text scaling. **Never audited once** | Not run |
| **Edge cases / data integrity** | Deletion, timezones, scale, absurd values, backup restore, a suspected FOURTH single-flight bug | Not run — but the suspected fourth single-flight bug was checked and is CLOSED |
| **Social round trip, live** | Two throwaway accounts actually connecting against the live project | Not run |

**The single most valuable of the five still open is the social round trip**, because it is the only
item that converts a large built feature from "reviewed code" to "verified". The second is
accessibility, which has never been done once and is now the only review with *no* evidence behind
it at all.

⚠️ **RUN THEM SERIALLY, NOT AS AN AGENT WAVE.** The 2026-08-19 attempt launched seven at once and the
usage limit killed every one before a single finding came back. Two run by hand on 2026-08-20 cost a
fraction of that and returned two real defects. The lesson is not "agents are bad" — it is that seven
parallel deep reviews is more than a session can pay for, and a review that returns nothing is worth
exactly nothing.

### What the two that ran actually found

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

**Closed, not findings:** the suspected fourth single-flight bug (§3.1) — the contribution cache
already carries body weight in its key — and the per-session clamp, which lives inside
`weeklyVolume()` so all three callers get it.

---

## 1. Confirmed problems

### 1.1 ⚠️ The first-run path makes a stranger learn a concept before they can log anything

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
4. **The first-run path is slow** (§1.1).

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
5. **Accessibility.** Never audited. Six nav tabs at 360 px, irregular SVG tap targets on the muscle
   map, and a great deal of load-bearing explanation in `.field-help` grey.

---

## 4. The plan, in order

**Tier A — verify what exists.** Nothing new should be built before these.

1. Re-run the seven reviews in §0. Start with the social round trip and the adversarial review.
2. Act on whatever they find.

**Tier B — the newcomer.**

3. Fix the first-run path (§1.1). Cheapest high-value change available.
4. Sweep for jargon reaching a screen without explanation. D8 says teach at the moment of use; that
   rule needs auditing rather than assuming.

**Tier C — finish what is half-built.**

5. **The estimator, Phases 1–3.** ⚠️ Read §16 of the estimate plan first: the band fits inside one
   level only **8.5 %** of the time, so Phase 2 must be *designed for the hedged reading*. This is
   what the Goals verdict waits on.
6. **The weekly-sets-per-muscle screen** (D3). The mapping and the target bands both exist and are
   unused. This is the clearest "insight comes out" feature still unbuilt, and it is what the
   teardown says every rival fails at.
7. **A report of what you actually did**, which is where the two findings the rating cannot use
   belong: the share of logged sets at 8 reps or fewer (load matters enormously for strength), and
   exercise order (88 % QoE, the highest-confidence finding this project has). Both are measurements
   of recorded history rather than models of a plan.

**Tier D — reach.**

8. Real-device testing, when Tim decides. Deferred deliberately; not to be raised.
9. Social phase 4, which still needs D7 narrowed first.

---

## 5. Open questions for Tim

1. **Ratify D18?** Still the only genuinely open question in `progress.md`. Phase 0 of the estimator
   is now done, so the fallback — ship it as a separate labelled chart mode — is concrete rather
   than hypothetical.
2. **Is "a reason to come back tomorrow" a goal?** The app is deliberately free of streaks, badges
   and nudges, and that is defensible — but it means retention rests entirely on the analysis being
   worth returning to. Worth an explicit decision rather than an accident.
