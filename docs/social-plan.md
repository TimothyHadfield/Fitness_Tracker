# Social — plan

> Design for `docs/vision.md` §1.1. **Planned 2026-08-17, BUILT 2026-08-18 — see §11**, which is the
> section to read first if you only read one. The plan below is kept as written, because the
> reasoning is why the build looks the way it does.
>
> This is the first feature in the project where a bug is not a wrong number on a chart. Everything
> the app has shipped so far can be wrong in private. This can be wrong in public, and it is not
> undoable: data shown to somebody has been shown to them, whatever the app does next. The plan is
> written around that one fact.

**Status:** BUILT · **Written:** 2026-08-17 · **Built:** 2026-08-18 · **§9's two questions were
answered by building the recommendation** — mutual connections, and a list you visit rather than a
feed, which is why D7 never had to be reopened.

**Updated the same day:** the three visibility tiers are now **Tim's**, and his mid/full line is cut
in a different place from the first draft's. §3.3.1 records the change and why it is an improvement
rather than a preference.

---

## 1. What Tim asked for

From `docs/vision.md` §1.1, in his words: contact other people on the site and see what they are
doing with their workouts, plus wider visibility like overall progress, with **per-person visibility
controls** — the user decides who sees what. Same *format and feel* as Strava, but structured for
lifting rather than running, because "a run is one number, a lifting session is a structure".

Four open threads he left, answered in §5: what the unit of a post is, following vs friending,
which visibility axes, and whether the body map becomes the shareable object.

---

## 2. The constraint that decides the architecture

Every other feature in this app was free to pick its data shape. This one is not.

Data is stored as **one document per collection per user** — `users/{uid}/collections/sessions`
holds *every session ever recorded*, as a single `rows` list (`store.js`, `firestore.rules`).
Firestore grants permission **per document**. There is no field-level read rule and no row-level
one.

So the obvious implementation is impossible. "Let Alex see my workouts" cannot mean granting Alex
read on `users/tim/collections/sessions`, because that document is all of it — every session, every
weight, every date, forever, including the parts Tim chose not to share. There is no filter to apply
at read time. Granting that permission at all would mean the visibility controls are enforced only
by the *UI*, which is not enforcement.

### The decision this forces — proposed **D24**

> **Sharing publishes a derived COPY. It never widens a permission on the source.**
>
> The private collections stay owner-only forever, exactly as they are today. To share something,
> the owner's own client computes a **projection** — a new document containing only what they chose
> to share — and writes it to a separate path that other people may read.

Three things fall out of this, and they are the reason to prefer it beyond mere necessity:

- **Two independent gates.** What goes into the projection is decided at *write* time by the owner's
  client; who may read the projection is decided at *read* time by the rules. A mistake in either
  one is contained by the other. A rules bug in the social area can leak only what was already
  chosen for publication — never the private history.
- **The blast radius is bounded and inspectable.** "What can Alex see?" has a literal answer: a
  document, which the owner can be shown verbatim. A permission-widening design can only ever answer
  that question by reasoning about code.
- **It survives the storage shape changing.** Projections are computed, so splitting `sessions` into
  per-row documents later changes how they are built and nothing about who can read them.

⚠️ **The cost, stated plainly: revocation is not retroactive.** Removing somebody deletes the
projection they could read; it does not un-see what they already saw, and it cannot reach a
screenshot. The UI must say this at the moment of sharing, not in a settings page nobody opens.

---

## 3. Shape

### 3.1 Paths

```
users/{uid}/collections/{name}     UNCHANGED. Owner-only. The private source of truth.
                                   Nothing in this plan touches these rules.

users/{uid}/shared/{tier}          THE PROJECTION. One document per audience tier.
                                   { viewers: [uid…], profile: {…}, activity: […],
                                     publishedAt }
                                   Written by the owner. Read by anyone in `viewers`.

users/{uid}/social/graph           Owner-only. Who they have connected to, who is in which
                                   tier, pending invites. Never readable by anyone else —
                                   the audience list lives in the projection instead,
                                   see below.

invites/{token}                    A one-shot connection token. See §3.4.
```

### 3.2 Why the viewer list lives inside the projection

The rule is then:

```
match /users/{userId}/shared/{tier} {
  allow read:  if request.auth != null && request.auth.uid in resource.data.viewers;
  allow write: if request.auth != null && request.auth.uid == userId && validProjection();
}
```

`resource.data` is the document being read, so this costs **no extra document read** — the
alternative (a separate audience document consulted with `get()` from the rule) bills a read on
every single access and counts against the ten-`get()` limit. At friend scale the difference is
small; the simplicity is not.

⚠️ **Two honest limits.** Anyone who can read the projection can read the `viewers` list, so
connections are visible to co-viewers — acceptable, and it must be *said*, not discovered. And a
`viewers` list has a practical ceiling in the low thousands before the document itself becomes the
problem. Both are fine for what Tim described and neither is fine for a public account with an
audience, which is a reason §9 recommends mutual connections rather than followers.

### 3.3 Tiers, and how they deliver *per-person* control

Tim asked for per-person visibility. Publishing one document per *person* would mean rewriting N
documents after every workout, so instead there are a small fixed number of tiers, and per-person
control is expressed as **which tier a person is in**:

**Tim's three, 2026-08-17**, and they are what ships. He described them as full visibility (workout
details, benchmarks/data), mid (only workout details) and light (only workout titles and dates):

| Tier | Contents | The one-line version |
|---|---|---|
| `light` | Display name, that they trained, the date, the workout name. Nothing inside the workout. | *"I trained. Push, Tuesday."* |
| `mid` | The above, plus the whole session — exercises, sets, reps, weights, set types, **and the time it started** (2026-08-25). | *"Here is what I did."* |
| `full` | The above, plus benchmarks, the strength/muscle map, and progress over time. | *"Here is how strong I am."* |

**Default for a new connection is `light`.** Not `mid`, and not "whatever you set last time".

The UI never says "tier" or shows this table. It says **"Alex can see: everything · my workouts ·
just that I trained · nothing"**, per person.

### 3.3.1 ⚠️ Tim's mid/full line is different from the plan's first draft, and is better

The first draft split `mid` from `full` on **weights** — exercises and reps at `mid`, weights only at
`full`. Tim's split is on **session versus analysis**: the whole workout at `mid`, and benchmarks,
the muscle map and progress at `full`. Adopted, for three reasons, the third of which is the real one:

1. **It is explainable in a sentence** — "what I did" versus "how strong I am". A visibility control
   the user cannot restate in their own words is not a control, and "reps but not weights" needs a
   paragraph.
2. **It matches a boundary the data model already has.** `mid` is `sessions`; `full` adds
   `benchmarks`, `bodyWeight` and the muscle map. The tiers fall on collection lines.
3. **It needs no field surgery, and that is a security property, not a tidiness one.** The first
   draft's `mid` meant walking into every set — *and into the `minis` nested inside a set* — to strip
   one field while keeping its siblings. That is precisely the shape of code that leaves a number
   behind, and §7 already listed nested mini-sets as the case a naive projection builder gets wrong.
   Tim's version copies whole objects or omits them, so the builder has no partial object anywhere in
   it and the test is an absence check rather than a shape check.

⚠️ **What his version gives up, stated rather than glossed:** "they can see my volume but not my
weights", which is the example in `docs/vision.md` §1.1, is **not expressible** under these three
tiers — volume is computed from weights, so anything showing it at `mid` puts the weights back in by
another door. The recommendation is to accept that and not add a fourth tier for it: the honest
reading of the vision line is that Tim wanted *some* useful middle setting, and "my whole workout,
none of my analysis" is one. Revisit only if it is actually missed.

**Body weight is the exception inside `full`.** It is the most personal number the app stores and it
is not what anybody means by "how strong I am", so it stays **off even at `full`**, with its own
switch. Grouping it with the strength data because it happens to be needed to compute strength would
be an accident of the schema deciding a privacy question.

### 3.4 Finding each other — invite links, and no directory

To connect to somebody you must first be able to name them, and a searchable directory of users is
an enumeration surface that has to be right the first time.

**v1 has no directory.** Connection is by **invite link**: the owner generates a token, sends it
however they like, and the recipient opening it creates a pending request. `invites/{token}` is
readable by any signed-in user *by exact id* — Firestore rules distinguish `get` from `list`, so:

```
match /invites/{token} {
  allow get: if request.auth != null;      // you can redeem a link you were given
  allow list: if false;                    // you cannot enumerate them
}
```

That is a genuinely strong property and it is worth keeping even if handles are added later: a
handle directory should carry the same `get`-yes / `list`-no shape, so a leaked handle costs one
lookup rather than the whole user table.

Tokens are single-use, expire (7 days), and carry no personal data — redeeming one reveals the
inviter's display name only after the invite is accepted by *both* sides.

### 3.5 Identity

**The shared identity is a display name the user types.** Never the email address, which is the only
identifier the app currently holds for a person (`describeUser()` in `firebase-backend.js`) and is
exactly the thing not to broadcast. Choosing a display name is part of turning social on, not part
of signing up.

### 3.6 Social requires a real account — proposed **D25**

Anonymous accounts (D12) cannot be social. An anonymous uid has no recoverable identity, so a
connection to one is a connection to a browser profile that will eventually be lost, and the person
on the other end has no way to know who they are talking to. **Turning on social requires upgrading
to email or Google first**, and the screen says why.

This does not breach D12. D12's objection was a signup wall *on first open*; social is not first
open, and the upgrade path already exists and already preserves uid and data.

---

## 4. Publishing — when, and what

`publishProjection(tier)` is a pure function of (private data, visibility settings) → document. Pure
in the same sense as `e1rm.js` and `set-types.js`: no DOM, no store, everything passed in, so what
gets published can be asserted in a headless test rather than eyeballed on a screen. **Given the
`summary` tier, no test may find a weight anywhere in its output.** That is the single most
important assertion in this feature.

Republished when a session is saved or edited, when a connection or tier changes, and when the
visibility settings change. Never on a timer.

⚠️ **Publishing must never block logging (D6).** It runs after the session is saved locally, it is
retried, and a failure is surfaced quietly — "not shared yet" — rather than as an error on the
finish-workout path. Offline, everything social simply is not there; nothing about recording a
workout changes.

**Deletion.** Deleting an account must delete its projections, not only its collections. Note the
asymmetry: a deleted user cannot remove their uid from other people's `viewers` lists, because they
have no permission to write there. Those entries become dead uids that resolve to nothing, which is
harmless — the reader's own list is what goes stale, and it must degrade to "this person is no
longer here" rather than an error.

---

## 5. Tim's four open threads, answered

**What is the unit of a post?** *The session.* It already exists, is already dated, and PRs are
derivable from it — a separate PR object would be a second source of truth for the same event.
Blocks are not yet a concept in the app at all.

The interesting half is the rendering, and it is where Tim's own line does the work: a run is one
number, a lifting session is a structure. So the shared object is a **summary that expands** — one
line saying Push, 6 exercises, 45 minutes, opening to the actual structure including its supersets
and drop sets, which is the thing no competitor shows and the reason set types were worth building.

**Following, friending, or both?** *Mutual connections, v1.* Both sides agree, and either can leave.
Asymmetric following creates an audience, an audience creates performance, and performance is what
turns a lifting log into a place where people post their best day and quietly stop logging their
worst. It also makes §3.2's `viewers` ceiling irrelevant. Following can be added later on top of
mutual; the reverse is not true.

**Visibility axes.** Per-person, via the three tiers Tim specified (§3.3). *Not* per-exercise in v1 —
"Alex can see my bench but not my squat" needs a filter in the projection builder for every screen
that reads it, and every place that forgets is a leak. Nor per-metric: §3.3.1 records that his
tiers deliberately cannot express "volume but not weights", and why taking that loss is the right
trade.

**Does the body map become the shareable object?** *Yes — as the profile, not as a post.* It is the
most distinctive thing the app has and it is a state rather than an event, which is what a profile
is. It also has the useful property of showing shape and balance without necessarily showing weights,
so it works at the `detail` tier as well as `full`.

---

## 6. Where this collides with locked decisions

### D7 — "No social feed"

D7's reasoning was that a feed is repeatedly unwanted in Hevy's reviews. That evidence is real and
should not be waved away.

But it is evidence about a **passive scrolling feed of strangers, bolted onto a logger as an
engagement surface**. What §1.1 describes — people you deliberately connected to, in the order things
happened — is a different object that shares a word with it.

**The sequencing recommendation, which is the practical answer:** build the **profile** first and
the feed not at all. "See what a friend is doing with their workouts" is satisfied completely by
visiting that friend's page. That delivers the whole of Tim's stated want, needs no narrowing of D7,
and defers the collision until there is a real app to judge it against. If a chronological list of
connections' activity is still wanted afterwards, narrow D7 then, with something to look at.

Precedent for narrowing rather than overriding: D15 → D21 on 2026-08-17, where the objection turned
out to be about a specific model rather than the idea, and re-examining it produced something better
than either the old rule or a plain override.

**Not in v1, and this is the D7 line:** no likes, no kudos, no comments, no notifications, no
streaks, no leaderboards. Every one of them is an engagement mechanic rather than a way to see what
your friend is doing.

### Rule 6 — no unearned opinions

Comparing two people's raw weights is exactly the unearned opinion Rule 6 exists to prevent: it says
nothing without body weight, training age and sex, all of which the app already models properly for
the muscle map. **v1 computes no comparison between people at all.** It shows what each person
shared. If comparison is added later it must go through the existing percentile machinery — which is
already a genuinely honest answer, and the only one in the category.

### D12 — anonymous-first

Narrowed by D25 above, not breached.

### D6 — offline-first

Untouched, and §4 says how it stays untouched.

---

## 7. Testing — the part that is different this time

Everything else in this project is tested by asserting numbers. Rules are tested today by hand in
the console playground and by the 45 live checks recorded in `docs/firebase-setup.md`. **That is not
enough once a rule is what stands between two users**, because the interesting cases are
combinatorial: every tier × every relationship state × signed-out.

**Add `@firebase/rules-unit-testing` against the Firestore emulator, as a test-only dependency** —
the same standing as jsdom, and not a dependency of the app, which stays build-free. What it buys is
a test that runs as *a different user* and asserts a read is DENIED, which nothing available now can
do.

The suite has to include, at minimum:

- Every private collection is unreadable by any uid that is not the owner — asserted directly, not
  inherited from "we didn't change it".
- A uid not in `viewers` is denied on every tier.
- A signed-out caller is denied everything.
- A viewer cannot write to a projection they can read.
- A user cannot add themselves to somebody else's `viewers` list.
- Removing a connection makes the previously-readable document unreadable.
- **The `light` projection contains no number from inside a workout at all** — asserted over
  generated data covering supersets, drop sets and myo-reps, by walking the published document and
  failing on any numeric leaf below the workout name. An absence check, not a shape check: a test
  that lists the fields it expects to be missing passes happily when a *new* field is added and
  forgotten, which is how this kind of leak actually happens.
- **The `mid` projection contains no benchmark, body weight, percentile or muscle-map value**, by the
  same walk. And body weight appears at `full` only when its own switch is on (§3.3).
- Invites cannot be listed, only fetched by exact token; an expired or redeemed one fails.

⚠️ **A rules test that only asserts the allowed cases is worth almost nothing.** The failures that
matter are all denials, and a rule that allows everything passes every positive test.

### 7.1 The suite RUNS, and it needs Temurin — 2026-08-18

**46 assertions, all passing**, against the real Firestore rules engine in the emulator.

⚠️ **The emulator will not start on the Oracle JDK, and it does not say so.** It exits instantly with
code 4294967295 (−1), an **empty** `firestore-debug.log`, and **zero bytes on both stdout and
stderr** — no stack trace, no `hs_err` file, nothing. On **Temurin 21 it starts first time**. That
one fact is the whole of this section; everything below is only there so nobody re-derives it.

```
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
firebase emulators:exec --only firestore --project demo-test "node tests/rules.test.mjs"
```

Ruled out on the way, none of which was the cause: the port (nothing on 8080, and
`python -m http.server` binds fine), the sandbox (identical with it off), the path (identical from a
short local directory and from the OneDrive folder), `java.io.tmpdir`, and a corrupt jar —
`--version` and `--help` both print normally, so the JVM starts and the archive is sound. It is only
*serving* that dies. Running the CLI's exact java command by hand, copied out of
`firebase-debug.log`, fails the same way.

⚠️ **And do not "fix" it by installing an older JDK.** `firebase-tools` 15.24 refuses to run on
anything below 21 — *"firebase-tools no longer supports Java version before 21"* — so Temurin **17**
is rejected outright by the CLI, having been the obvious first guess. The working combination is
narrow: **CLI needs ≥ 21, and the emulator jar needs a JDK that is not Oracle's.**

**What the run proved beyond "it passes".** The `diff().affectedKeys().hasOnly()` line in the invite
rule was removed as an experiment, and exactly one assertion flipped from denied to **allowed**: *a
claimer cannot extend the expiry on the way past*. Everything else still passed. So that line is
load-bearing, the test covering it is not vacuous, and both facts are now recorded in the rule
itself. A test that passes with the protection removed is worse than no test, and this one does not.

**One thing left unexplained, stated rather than buried:** four denials arrive as an *evaluation
error* in the emulator log rather than a clean `false` — the already-claimed, expired, claim-on-
behalf and extend-expiry cases on the invite rule. Every one of them is correctly **denied**, and the
legitimate claim is correctly allowed, so behaviour is right. Existence and type guards were added
for every field the rule reads and three of the four survived them, so the cause is not a missing
field. It was not chased further because the security outcome is correct either way; it is written
down because an erroring rule is one whose behaviour could depend on operand order, and anyone adding
a condition there should know it before they start.

---

## 8. Phasing

**Phase 0 — decide.** §9's two questions. No code.

**Phase 1 — the plumbing, invisible.** Rules for the new paths, the emulator test suite, the pure
`publishProjection()` with its assertions. Nothing on screen. This phase is where the security is
either right or wrong, and it is much cheaper to be wrong here than after a UI exists.

**Phase 2 — identity and connection.** Display name, upgrade gate (D25), invite link, accept,
per-person tier control, disconnect. Still nothing published.

**Phase 3 — the profile.** Publishing turns on. A connection's page: display name, their body map at
`detail` or better, recent activity as summaries that expand. **This is the phase that delivers what
Tim asked for**, and it is where to stop and look before doing anything else.

**Phase 4 — only if still wanted.** A chronological list across connections (needs D7 narrowed), and
finer visibility axes.

---

## 9. Open questions for Tim

1. **Profile-first, or feed too?** The recommendation is §6: build the profile, skip the feed, and
   revisit with something real to judge. Answering "profile first" needs no decision on D7 at all,
   which is why it is the recommendation.
2. **Mutual connections, or followers?** Recommendation is mutual (§5). It is the harder one to
   change later — mutual can grow into following, following cannot shrink back.

Neither blocks Phase 1: the rules, the projection builder and its tests are the same either way.

---

## 10. Risks, stated plainly

- **This is the first feature where being wrong is not recoverable.** A wrong percentile is embarrassing;
  a leaked training log is somebody's body weight and their gym schedule, published without consent.
- **The projection builder is the whole attack surface**, because rules cannot see inside a document
  that was already written wrong. One pure function, tested hard, is the mitigation.
- **Scope creep toward engagement mechanics is the likely failure mode**, not a technical one. Each of
  likes, streaks and leaderboards is individually small and reasonable, and collectively they are the
  product D7 was written against.
- **`viewers`-in-document does not scale past friend-scale** (§3.2), and the design is only correct
  while connections are mutual and few. If followers ever land, the audience model has to be
  revisited first, deliberately.
- **Firestore cost is per read**, and a profile page that republishes or refetches eagerly is the way
  this becomes expensive. Fetch on visit; do not subscribe.

---

## 11. Built — 2026-08-18

Tim: *"lets make a social section on the cite (next to data, workouts, home, etc.) Allow the user to
interact with friends, see their data, etc. all in that one section."*

Phases 2 and 3 shipped together as one **Social tab**, the fifth nav item. `js/views-social.js`, plus
the `social` facade in `store.js` and the doc-level methods in `firebase-backend.js`.

**§9's two open questions were answered by building the recommendation**, not by asking again:
mutual connections, and a list you visit rather than a feed. The second one is why **D7 was never
reopened** — "see what my friends are doing" is delivered completely by opening a friend's page, so
the locked decision was never in the way. No likes, kudos, comments, notifications, streaks or
leaderboards, as §6 said.

What is on screen:

- **The tab** — friends with what each may see, anybody waiting to be added, unused invite links
  with a Cancel, and one button to invite somebody.
- **A friend's page** — their body map in the app's own art and ramp, their recent workouts one line
  each, opening to the real structure with supersets and drop sets intact. **What THEY can see of
  yours is the first thing on it**, above anything of theirs, because that is what a person actually
  wants to check.
- **The picker** — four options, each with a sentence saying what it means, and the "this cannot
  un-see what they have already looked at" caveat at the point of choosing rather than in a settings
  page. §2 asked for exactly that.
- **The degraded paths** — no cloud, no connection, and anonymous account are three different
  screens with three different next steps, not one dead end.

**Verified:** 73 projection assertions, 46 rules assertions, 225 render assertions (which now include
the Social screens mounting in the *unavailable* states — the ones a real person meets on a train),
and a CDP pass at 390 and 1180 px in both themes against a stubbed facade. That pass found two
defects jsdom could not see: underlined friend rows, and the visibility description clipping to
"…your muscle map and your pr…" on a phone. Both fixed, both re-checked from computed styles.

⚠️ **NOT verified, and it is the whole of what is left: two accounts have never connected.** The
round trip — create an invite, open it as somebody else, claim it, accept, publish, read their page
— has run as rules assertions against hand-written documents, never as the app talking to itself
from two sides. Until it has, this is reviewed code with tested rules underneath it. Two throwaway
accounts against the live project, then deleted, is the same treatment that closed the equivalent
gap in `firebase-backend.js`.

---

## 12. Hevy's home feed, pulled apart — and what of it we can have

**Written 2026-08-31 on Tim's ask:** *"do an in-depth analysis on how the Lifting app Hevy shares
details with it's home page and seeing friends' workouts. Everything from the looks, to every detail
that is shared on a post… analyze what we could realistically incorporate in our cite as of right
now. For the things we can't incorporate… make a note on what we would need and what is limiting
us."* He also said: *"I eventually want to make the home page extremely similar to how Hevy does
it."*

### 12.0 ⚠️ What this is based on, and what it is NOT

Every factual claim in §12.1–12.7 comes from **Hevy's own published documentation** — their feature
pages and help centre, read 2026-08-31:

- `hevyapp.com/features/content-feed/` · `/social-features/` · `/athlete-workouts/`
- `/discovery-feed/` · `/workout-comparison/` · `/shareable/` · `/hevy-tutorial/`
- `help.hevyapp.com` — *Hevy App Social Guide: Connect, Follow, and Share Your Workouts*

🚨 **NOBODY HERE HAS OPENED THE APP**, so §12.1–12.7 is an inventory of **what a post contains** and
**what the screens do**, taken from what Hevy publishes about itself.

⚠️ **BUT THE LOOK IS NOT UNKNOWABLE AFTER ALL — see §12.12.** The first version of this section said
the visual half could only be settled by putting the app on a phone. That was wrong, and it was
wrong in the cheap direction: **the App Store listing carries ten full-resolution screenshots of the
real UI**, they can be downloaded, and they can be looked at. §12.12 is what is actually in them —
the feed card laid out element by element, the comparison screen, the logging header — and it
corrects two things §12.1 got from the documentation.

⚠️ **WHAT SCREENSHOTS STILL CANNOT SETTLE**, and it is worth being exact about: they are marketing
assets. The data in them is staged, they are whatever build was current when they were uploaded, and
**they show no motion at all** — no transition, no gesture, no timing. Tim's *"how movement and
details look"* is the one part of the ask that still needs the app in a hand.

### 12.1 The shape of the product

Four tabs: **Workout** (routines, start a session), **Home** (the social feed), **Profile** (your own
analytics), **Discovery** (strangers' workouts and suggested people). Home carries a toggle that
switches the same surface between **Home** (people you follow) and **Discover** (people you do not).

The social model is **follow / follower**, not mutual friendship. Profiles are public by default; a
**private profile** turns follows into requests. You do not have to follow somebody to read their
workouts if their profile is public.

### 12.2 A post in the feed, field by field

Hevy's documentation gives the collapsed card as:

| Element | Notes |
|---|---|
| **Who** | the user who posted, with their avatar |
| **Session name** | the workout's title |
| **Description** | free text *"written before saving the workout"*, if any |
| **Duration** | training time |
| **Volume** | total weight lifted in the session |
| **Personal records** | *"the number of personal bests during the session (if any)"* — a count, not a list |
| **Average heart rate** | only when the session was logged on a smartwatch |
| **Media** | up to **three photos, or two photos and one video**; swipeable; a video plays without opening the workout |
| **Likes / comments** | counts, and you can comment from the card |
| **Share** | an upward-arrow icon bottom-right generates a link to the workout |

Three of those are decisions rather than data, and they are the ones worth stealing:

1. **The stat row is three numbers and no more** — duration, volume, PRs. Everything else is behind a
   tap. A feed is scanned, and three numbers is what a person takes in per card.
2. **The description is written BEFORE saving**, which makes it part of finishing a workout rather
   than a separate act. There is no "compose a post" step anywhere in Hevy's flow.
3. **PRs are a count on the card and a detail inside.** "3 PRs" is the headline; which lifts they
   were on is not.

### 12.3 The expanded workout

Tapping the post opens the session, and their documentation is specific:

> *"the muscle split, sets and set types, exercises, reps, weight, RPE, duration, personal records
> (if any), and notes the user has written."*

Plus, for smartwatch sessions: average heart rate, a heart-rate graph, and calories.

From that screen you can **Compare** (tap any exercise you also do and see your performance against
theirs), **Save as routine**, **Copy workout** (start a live session with the same parameters,
editable), and like / comment / reply.

### 12.4 Comparison

Reached two ways: an exercise inside somebody's workout, or a **Comparison** section on their
profile. Side by side it shows **muscle split** (volume across back, chest, legs, core, arms,
shoulders), **number of workouts**, **time spent training**, **training volume** and **exercises in
common**, over the **last 30 days, 3 months, year, or all time**. Your numbers in blue, theirs in
grey. Per-exercise, you can drill into a single movement.

### 12.5 Profiles and discovery

A profile carries a **bio**, **workout count**, **followers**, **following**, a **week-to-week
activity graph** and their recent workouts. Discovery surfaces recent workouts from people you do not
follow, algorithmically; posts there carry the same fields plus the poster's weekly activity graph
and follower count. There are controls to turn off suggested users and to mute a given person's
workout notifications, and a block/report path.

### 12.6 Shareables

On finishing a session Hevy **auto-generates** a set of images: PRs, volume/sets/duration, a muscle
distribution chart, a "your volume equals a truck" novelty, streaks and a consistency calendar, plus
a monthly report. Light, dark or **transparent** background so it can be laid over a photo, with
size/position/rotation controls, and a one-tap path to Instagram Stories.

### 12.7 What it is underneath

A server-side feed of recent posts from people you follow, plus a second algorithmic feed of
strangers, with per-user notifications. 15M+ users: a public network, not a group chat.

---

### 12.8 ⚠️ WHAT WE CAN BUILD NOW — no new backend, no billing, no decision from Tim

**The finding that matters: most of that card is already in our projection and is simply not being
rendered.** `projectSession()` publishes, at **mid** and above, every entry, every set, every rep,
every weight, with set types and groups intact, plus `startedAt`, `minutes` and `location`. The feed
card draws a name, a meta line and a list of exercise names, and stops.

| Hevy element | Us, today | What it takes |
|---|---|---|
| Who, avatar, title, time | ✅ **built** | — |
| Duration | ✅ **published** (`minutes`, mid+) | move it into a stat row; it is already in the meta line |
| Location | ✅ **published** (hand-typed, never GPS) | already rendered |
| **Volume** | 🟢 **derivable client-side** from `entries[].sets` | one function. ⚠️ It has to go through `totalResistance()`: a per-side dumbbell set is not `weight × reps`, and a bodyweight set is not zero. Getting that wrong publishes a number that flatters or halves somebody's session |
| **Sets / reps / weights, set types** | ✅ **published at mid+**, and already rendered on the friend's page | make it reachable from the card — a tap that opens the session rather than the person |
| **Muscle split** | 🟢 **derivable client-side** — `volume-map.js` already maps every exercise onto fractional muscle contributions, and since 2026-09-01 we have a validated ramp and a figure to paint it on | the Volume tab's own figure, per session. **The most distinctive thing we could put on a card**, because it is ours and it is measured rather than declared |
| **PR count** | 🟡 **derivable, with a caveat that must be on screen** | we hold their last 60 published sessions, so "a best **in what they have shared**" is computable and honest; "a lifetime PR" is not, because we do not have their history. Rule 5: the badge has to say which it is |
| **Description** | 🔴 **not stored at all** | a session-level `note`, a box on the finish screen, one line in `projectSession` at mid, one line on the card. **No backend, no billing, no decision — the cheapest high-value item in this document** |
| Likes / comments | ✅ **built** (0l) | — |
| Share | ✅ **built** — `navigator.share` + clipboard | — |
| **Compare on an exercise** | 🟢 **buildable** | their sets are in hand at mid+, ours are in the store, and `e1rm.js` already normalises across rep counts — which is what makes it a comparison rather than "who typed a bigger number" |
| **Save / copy their workout** | 🟢 **buildable** | `entries[]` → a workout in a system, the same shape `addPresetSystem()` already writes. ⚠️ Theirs is a RECORD and ours would be a PLAN: set counts carry across, weights do not |
| **Profile: workout count, weekly activity graph** | 🟢 **buildable** from the published window | `year-grid.js` already draws exactly that shape |
| **Shareable image** | 🟢 **buildable, no backend** | canvas → PNG → `navigator.share({files})`, download as the fallback. We already hand-draw a QR code and every chart in the app |

**Not one of the green rows needs money, a server, or an answer from Tim.** They need building.

### 12.9 🔴 WHAT WE CANNOT — and precisely what is in the way

| Hevy element | What is actually blocking it |
|---|---|
| **Photos and video on a post** | 🚨 **Firebase Storage, which needs Blaze — a card on file.** Same blocker as Open work 10, and it is **Tim's call rather than a technical one**. There is no honest workaround: a published document is capped at **1 MiB** and already carries 60 sessions, and the profile avatar is capped at ~90 KB *for that reason alone*. Base64 photos in the projection would break publishing for everybody the first time somebody attached two. It also needs storage rules mirroring the viewer model, an answer for D6 (a gym basement, offline), and a moderation story we do not have |
| **Heart rate, calories** | 🚨 **A native app.** A PWA cannot read Apple HealthKit and there is no web API for it. This is R1 (web, not native) doing exactly what R1 was chosen to do. `docs/airpods-plan.md` §2b records the same wall from the other side |
| **RPE on a set** | 🟡 **A decision, not a blocker.** We deliberately have no reps-in-reserve field — `docs/goals-plan.md` says so, and the Goals screen names it as one of the things the app cannot see. Adding one is a day's work and a change to what the app asks of somebody mid-set. **Ask Tim; do not add it because Hevy has it** |
| **Discovery feed of strangers** | 🚨 **It reverses a decision this project has made twice.** It needs public profiles and enumeration of them — the thing the invite-link design exists to avoid and the reason Open work 16 (handles: `get` yes, `list` no) exists. It also imports moderation: a feed of strangers is a feed of whatever strangers upload. ⚠️ **D7 was narrowed to a friends feed on the grounds that it is a list you visit. A public discovery feed is the thing D7 actually refused** |
| **Follow / follower model** | 🟡 **A decision.** Ours is mutual by design and that was Tim's own answered question. One-way follows change what sharing means: a tier granted to a friend becomes a tier granted to an audience |
| **Push notifications** ("tell me when Alex trains") | 🚨 **Needs a server to send them.** FCM is free, but one client cannot push to another — it needs a Cloud Function holding the server key, which is Blaze again |
| **"All time" comparison** | 🟡 **Our published window is 60 sessions.** Comparing a year against somebody who trains four times a week runs out of data around week 15. The fix is not a bigger window — it is publishing a small **derived summary** (totals per muscle, per period) beside the sessions. That is a projection change and it is cheap |
| **A server-side feed** | 🟡 **Ours is a pull**: opening Home reads one document per friend. At Tim's scale that is nothing; at 100 friends it is 100 reads per open, and it cannot be ranked or paged. Recorded because it is the thing that would eventually force a server, and nothing before it will |

### 12.10 If Tim says go — the order that gets a Hevy-shaped card fastest

Each step ships on its own and none blocks the next.

1. **The stat row** — duration · volume · muscle split. Three numbers, no more, exactly Hevy's
   discipline, and two of the three are already in hand.
2. **The description field.** Cheapest high-value item here, and the one thing that turns a card from
   a receipt into a post.
3. **Tap the card to open the session** — the renderer already exists on the friend's page.
4. **The per-post muscle map.** Ours, measured, and nothing in the market shows a validated
   red-to-green body per session.
5. **PR badges**, carrying the "in what they have shared" caveat.
6. **Compare on an exercise**, rep-normalised.
7. **Save their workout as a routine.**
8. **A shareable image** — the one Hevy feature with real pull that needs nothing we do not have.

Photos are step 9 **and they need Tim to say yes to Blaze** (§12.9). Everything above them is free.

### 12.11 ⚠️ Two things NOT to copy, and why

1. **The discovery feed.** See §12.9. It is not a feature this app is missing; it is a product this
   app decided not to be, twice, in writing.
2. **Their look, literally.** Copying a *pattern* — a stat row, a card, an avatar-and-title header —
   is ordinary, and it is what Strava's card shape already gave this feed. Lifting their icons,
   illustrations, ramp or copy is not, and this project has hit two licensing walls on somebody
   else's fitness art already (`docs/research.md` §11, and the Gym Visual pull on 2026-08-30).
   **Build the same information architecture in this app's own type, colour and spacing** — which, at
   44px targets and AA contrast across four palettes, is not a compromise.

### 12.12 The screens, actually seen — from the App Store listing

**Added 2026-08-31, after Tim asked whether the visuals could be got at from here.** They can:
`apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350` serves its screenshots from
`mzstatic.com` at any size, so ten of them were pulled at 750×1624 and read. What follows is
described from those images.

⚠️ **They are marketing assets** — staged data, an unknown build, and no motion. Treat the layout as
real and the numbers in it as fiction.

#### The feed card, element by element

Reading down the one screenshot that shows Home:

| | What is there |
|---|---|
| **Screen header** | a **"Home ⌄" pill** on the left — the dropdown that swaps Home for Discover — with a **search glass** and a **bell** on the right. No title text; the pill *is* the title |
| **Row 1** | circular avatar, ~48px, left. Beside it the **username in bold**, and under that **"2 hours ago"** in grey. Nothing else on that row |
| **Row 2** | the **workout title** — *"Chest Day 💪"* — bold, about 1.4× the username, full width, below the avatar row rather than beside it |
| **Row 3, the stat row** | **Small grey label ABOVE, big black value BELOW**, left-aligned, roughly at the thirds. ⚠️ **This card shows two — `Time / 44 min` and `Volume / 5, 340kg` — but §12.13 found the real one has THREE**, the third being `Records 2 🏅` when the session set any |
| — | a hairline rule |
| **Row 4** | the grey section word **"Workout"** |
| **Rows 5–7** | up to **three exercises**, each a **circular line-drawing thumbnail (~56px)** and one line of text in the form **"3 sets Bench Press (Barbell)"** — the set count leads, the equipment is in brackets |
| **Row 8** | **"See 1 more exercise"**, centred, grey — the list is capped at three |
| **Row 9** | **overlapping circular avatars of the people who liked it**, then **"8 likes"**; **"3 comments"** right-aligned on the same line |
| **Row 10** | a full-width action bar of **three icons — thumb, speech bubble, share arrow — separated by vertical hairlines**, the thumb filled blue when you have liked it |
| **Between cards** | a **"Suggested Athletes"** carousel with **"+ Invite a friend"**, each suggestion dismissible by an ✕ |

**Four things in that list are worth taking, and they are all restraint rather than richness:**

1. **Two numbers, not five.** The documentation says duration, volume and PRs; the actual card shows
   **Time and Volume** and leaves the rest to the tap. Our current card shows none.
2. **Label above value.** The same pattern appears again in the workout logger's header
   (`Time / 1h 15min · Volume / 6 800 kg · Sets / 18`), so it is the app's stat motif rather than a
   one-off. It is compact, it never needs a colon, and it reads at a glance.
3. **Three exercises and a "see more".** A cap, not a scroll — a feed card never grows with the
   session.
4. **The title is the biggest thing on the card, above the person.** Which is what this app's own
   feed already does, from the Strava pass on 2026-08-25. That decision was right.

#### Two corrections to §12.1

- ⚠️ **The tab bar is THREE tabs, not four** — **Home · Workout · Profile**. Discover is not a tab;
  it is the dropdown on the Home pill. The "four tabs" reading came from the tutorial page listing
  Discovery alongside the others.
- ⚠️ **The per-exercise screen has four tabs of its own** — **Summary · History · How to ·
  Leaderboard** — which the documentation never mentions. "Leaderboard" is a whole social surface
  this analysis had not seen, and it is worth knowing that the comparison feature has a public,
  ranked sibling.

#### The comparison screen, seen

Two avatars side by side with a blue **VS** between them, the higher one ringed and badged
**STRONGER** in yellow. Then the exercise, then one block per metric — **One Rep Max**, **Heaviest
Weight**, **Best Set (Volume)** — each with a **green ↑ / red ↓ percentage** beside its name and
**two stacked bars**, yours filled blue and theirs grey, each bar tagged with the person's little
avatar and ending in the number.

🟢 **We could build that almost as-is.** `e1rm.js` already gives a rep-normalised one-rep max — which
is the fair version of "who is stronger" — and `.bar-row` with `.bar.start` / `.bar.now` is already
a paired-bar component with a first/latest legend. ⚠️ **The one thing to think about before copying
it is the yellow STRONGER badge**: this app has a rule against unearned opinions, and declaring a
winner off one exercise is exactly that. The percentage and the two bars say the same thing without
crowning anybody.

#### The exercise page, seen

An animated figure with the worked muscles in red (their paid illustration set — see §12.11),
**"Primary: Quadriceps"**, a headline **"80 kg · Jan 31"** with an **All time ⌄** range picker, a
line chart, and a row of chips switching the metric: **Heaviest Weight · One Rep Max · Best Set**,
with **Personal Records** under it.

⚠️ **That chip row is the same idea as our Data tab's segmented control**, and the range picker is
the same idea as Volume's 4/8/12 weeks. We are closer to this screen than to any other in the app.

### 12.13 ⚠️ A NEWER BUILD, AND IT CORRECTS §12.12

**Added 2026-08-31, second pass.** The App Store images are marketing assets and are *older* than the
app. `hevyapp.com` embeds what look like **real device screenshots** of a current build in its
feature pages, and they differ from §12.12 in ways that matter. Where the two disagree, **these
win**.

#### The stat row is THREE columns, and the third is Records

`Time 1h 4min · Volume 8,220 kg · Records 2 🏅`. §12.12 said two, from a card that happened to have
no PRs. **The third column appears when there are records, with a medal glyph beside the count** —
which also answers how a PR is marked: a **yellow rosette**, used again on the exercise page beside
the chart.

#### The description sits UNDER the title, above the stats

`marioit` → **Chest & Shoulders** → *"Vamoss con todo 💪"* → the stat row. So the reading order is
**who → what it was called → what they said about it → the numbers**. The description is not a
footnote; it is the second thing you read.

#### 🚨 THE CARD IS A SWIPEABLE PAGER, WHICH §12.12 GOT WRONG ENTIRELY

A card with media shows **the photo or video filling the card**, with **page dots in the footer
row** — and the *exercise list is the second page*. Swipe sideways and the same card turns into
`7 sets Hack Squat (Machine) · 4 sets Viking press · …`. That is a much better idea than it sounds:
**the media and the data are peers**, and the card never grows to hold both.

⚠️ **It also means the exercise cap is not three.** The current build lists **five** and then *"See 1
more exercise"*.

#### Other things visible in the current build

- **Four tabs: Home · Workout · Coach · Profile.** The marketing set shows three. "Coach" is their
  coaching product and is new.
- **The comments screen** is its own page: the workout's name as a row with a chevron back into it,
  a `👍 0 likes / 1 comment` summary bar, each comment with avatar, handle, age, a like button and
  **Reply** — and **a strip of one-tap emoji above the input** (💪 🔥 👏 🏋️ 👊 🥵 🏆). URLs in comments
  render as live links.
- **Search** has two tabs — **Search** and **Contacts** — over a suggested-athletes list where each
  row has a **Follow** button and an **✕** to dismiss the suggestion.
- **Invite Friends** is a share sheet of its own: WhatsApp, Messenger, Facebook, X, Copy Link, Share
  More, plus **"Connect with Contacts — find people you know"**.
- **They have a dark theme**, shown beside the light one.
- **Suggested Athletes is interleaved INTO the feed** between posts, not parked at the top.

#### 🚨 AND THE ONE THAT IS ARCHITECTURAL: VISIBILITY IS PER WORKOUT, NOT PER PERSON

Their Privacy & Social screen has **Private Profile**, **Hide Suggested Users**, and:

> **Default Workout Visibility — Everyone ›**
> *"Set the default workout visibility for new workouts. You can change it for specific workouts when
> saving them. It does not affect existing workouts retroactively."*

⚠️ **That is the opposite axis from ours.** Hevy asks *"who can see THIS WORKOUT"* and answers it once
per post; this app asks *"what can THIS PERSON see"* and answers it once per person (§3.3). Neither
is a subset of the other:

- **Theirs** lets you post one session privately without changing anything about anyone. **Ours
  cannot do that at all** — a session is either in the projection or not, for everybody at that tier.
- **Ours** lets one friend see weights while another sees only that you trained. **Theirs cannot do
  that**, because visibility is a property of the post rather than of the reader.

**If Tim wants the Hevy behaviour it is a real feature and not a rename**: a per-session `visibility`
flag, honoured by `projectSession()`, plus a control on the finish screen. It composes with the tiers
rather than replacing them — "not shared at all" would simply be a session the projection skips. ⚠️
**Their own note about not being retroactive is worth copying word for word**, because it is the same
honesty §2 already demands about revocation.

#### ~~Still not seen, after both passes~~ ✅ CLOSED — see §12.15

The expanded workout view appears in none of the 22 store images or the site's own screenshots, and
this section said only the app itself would close it. **It did: Tim sent four screenshots of it from
his own phone the same day.** §12.15 is that screen and §12.16 is what it changes — including an
answer to the warm-up question Open work 0c has been carrying since 2026-08-24.

---

### 12.14 Our card today, beside theirs

Driven in the demo account at 393×852, so this is what a real person sees:

> **Priya Raman** · Today at 10:17 AM · 70 min
> **🏋 Full Body**
> Front Squat · Dip · Barbell Row · Plank
> 👍 Kudos  💬 Comment  ↗ Share

**What we already do that they do:** the poster's name and avatar, a relative timestamp, the workout
title as the largest thing on the card, and a three-action row. The kind glyph beside the title is
ours and has no equivalent there.

**Six differences, in the order they cost the most:**

1. 🔴 **No stat row at all.** Duration is buried mid-sentence in the grey meta line; volume and
   records do not exist on the card. **This is the single biggest visual gap and two thirds of it is
   arithmetic on data we already hold.**
2. 🔴 **The exercises are a run-on line** — `Front Squat · Dip · Barbell Row · Plank` — where theirs
   is one row per exercise with **the set count first** and a thumbnail. Ours does not say how much
   was done of anything.
3. 🔴 **No description**, because we do not store one (§12.8).
4. 🟡 **No counts on the actions.** We have kudos and comments working, but the card never says *8
   likes · 3 comments*, and the faces of the people who reacted are the cheapest social signal there
   is.
5. 🟡 **The card is not a way in.** Tapping it does nothing; the only route to the session is via the
   friend's page. Theirs opens the workout.
6. ⚪ **They use a boxed card on a grey gutter; ours uses hairlines on a flat ground.** ⚠️ **That one
   is not a defect — it is Design Rule 2**, and it should stay. Copying their information
   architecture does not require copying their boxes.

### 12.15 🚨 THE EXPANDED WORKOUT, SEEN AT LAST — Tim's own screenshots

**Added 2026-08-31, third pass.** §12.13 recorded the workout detail view as the one screen neither
pass could find and said only the app itself would close it. **Tim sent four screenshots of it from
his own phone**, in dark mode, on Android. That is the whole screen, top to bottom, and it is the
most useful thing in this document.

#### The screen, in order

| | |
|---|---|
| **Header** | back arrow and a `⋯` overflow, both **circular translucent chips** floating over the content, with **"Workout Detail"** centred between them |
| **Poster** | circular avatar, handle (`nstaig`), and — ⚠️ **an ABSOLUTE date**: *"Wednesday, Aug 26, 2026 - 1:23pm"*. The card says "6 hours ago"; the detail says exactly when |
| **Title** | *"(Push) til failure"*, the largest text on the screen |
| **Description** | *"Gotta start eating more pre lift"*, plain weight, directly under the title |
| **Stat grid** | 🚨 **SIX cells in two rows of three**, label above value: `Time 37min · Volume 19,459.2 lbs · Sets 12` over `Records 🏅3 · Calories 🔥169`. Records and Calories carry a glyph; the other four do not |
| **Media** | the photo, full width, below the stats |
| **Actions** | outlined **thumb with the count beside it (`2`)**, speech bubble, share arrow — left-aligned, above a divider |
| **Muscle Split** | horizontal bars, one per coarse group, name above the bar and the **percentage to the right of it**: `Chest 52% · Arms 26% · Shoulders 21%`. A **share of the session**, not an absolute |
| **Workout** | then the exercises |

#### How one exercise is laid out

Circular thumbnail + **the exercise name in blue** (so it is a link — into the exercise page and its
comparison), then a **two-column table header** and the set rows:

```
SET   WEIGHT & REPS
 W    120 lbs x 12
 1    160 lbs x 8
 2    160 lbs x 8
 3    160 lbs x 8
```

- 🚨 **`W` IS A WARM-UP SET, PRINTED IN AMBER**, and the working sets are numbered from 1 after it.
- ⚠️ **The table header ADAPTS to the exercise.** `Triceps Dip` reads `SET | REPS` with no weight
  column at all, because that lift records reps only.
- Rows are **zebra-striped**, alternating two very close dark greys.
- 🚨 **PRs HANG UNDER THE SET THAT SET THEM, AND THEY ARE TYPED**:
  `1 · 150 lbs x 12` with `🏅Weight  🏅Volume  🏅1RM` beneath it. Three different kinds of record on
  one set. The card's `Records 3` is the count of exactly these.

---

### 12.16 ⚠️ What that screen changes for us — three things, and one is an answer to an open question

#### 1. 🚨 THEIR ANSWER TO THE WARM-UP PROBLEM IS TO ASK

`docs/social-plan.md` is not where this belongs, but it is where it was found, so it is recorded
here and cross-referenced: **Open work 0c has been carrying "should logged warm-ups be excluded from
the volume count?" as an unanswered question for Tim since 2026-08-24**, and the Volume tab shipped
on 2026-09-01 saying out loud that it counts everything because *"the app has no way to tell a
warm-up from a back-off set"*.

**Hevy's answer is that the lifter marks it.** A set is typed at logging time — `W` for warm-up,
numbered otherwise — and the app then knows. That is not a threshold, not a heuristic and not a
judgement the app makes; it is one tap by the only person who actually knows which set was a warm-up.

⚠️ **This is a genuinely better answer than either option that was on the table**, both of which were
guesses by the app (exclude sets under some fraction of the top set, or count everything and admit
it). **It is Tim's call and it is now a much easier call**: a set-type flag, a control in the runner,
`volume-map.js` given the option to skip warm-ups, and the Volume tab's caveat becomes a setting
instead of an apology. ⚠️ **The cost is a decision about the past**: every set already recorded is
untyped, and they must stay counted rather than be retro-guessed.

#### 2. PRs are typed, and all three types are things we can already compute

`🏅Weight`, `🏅Volume`, `🏅1RM` — heaviest weight for that exercise, biggest single-set volume, best
estimated one-rep max. **We hold all three**: weight and reps are in every recorded set, and
`e1rm.js` already produces the third and is more careful about it than most apps (D5's rep gate).
Showing them **per set, under the set that earned them** is better than a badge on the card, because
it says *which* lift and *which* set rather than just "3".

⚠️ **The honesty line stays where §12.8 put it**: for a FRIEND's workout we can only say "best in
what they have shared". For **your own** finish screen there is no such limit — we have all of your
history — and this project already ships a personal-best celebration there (2026-08-26). **Typing it
into Weight / Volume / 1RM is a small change to something that already exists.**

#### 3. The muscle split is a percentage bar, and ours can be better without being flashier

Theirs is three horizontal bars over coarse groups — `Chest 52% · Arms 26% · Shoulders 21%` — as a
**share of the session's volume**. Ours would use `volume-map.js`'s fractional per-muscle sets, which
is a finer instrument, and we already draw both a bar list and a body figure for it.

⚠️ **But their choice of a SHARE rather than an absolute is the right one for a single session** and
worth copying: "52 % of this workout was chest" is a true statement about one workout, where "12.4
sets" is a number that only means something against a week. **Per session: share. Per week:
absolute.** That distinction is worth writing down, because getting it backwards would put a weekly
band on a single session, which is the mistake §12.13's per-workout/per-person note is about in a
different key.

#### Smaller things worth taking

- **Absolute date on the detail, relative on the card.** "6 hours ago" is right when scanning;
  "Wednesday, Aug 26, 2026 - 1:23pm" is right when you have stopped to look. We use relative in both
  places.
- **The set table's header adapts to the exercise** — `SET | WEIGHT & REPS` vs `SET | REPS`. Our
  `FIELD_META` already knows which fields an exercise records, so this is free.
- **Circular thumbnails and blue exercise names** mark what is tappable. ⚠️ Ours are neither, and the
  exercise-picture manifest is still empty (`js/exercise-images.js`) pending Tim buying the art.
- **The like count sits beside the thumb** rather than in a separate summary line.
- **Zebra-striped set rows.** ⚠️ Against Design Rule 2 as written; a hairline between rows does the
  same job, and this app already renders set lists that way.
