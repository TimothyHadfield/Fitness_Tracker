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
| `mid` | The above, plus the whole session — exercises, sets, reps, weights, set types. | *"Here is what I did."* |
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
