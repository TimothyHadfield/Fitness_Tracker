# Product & Technical Spec

Living document. Detail lives here; state and decisions live in `../progress.md`.

---

## 1. Design principles

These are binding. Every feature gets checked against them.

### P1 — Ten seconds, one thumb, no connection

Hard budget for logging a set: **under 10 seconds, one-handed, fully offline.**

- Pre-fill last session's weight and reps so the common case is one tap to confirm
- Rest timer starts itself the moment a set is marked done — never a separate "start timer" tap
- Large tap targets, high contrast, readable under bad gym lighting

*Why it's a hard budget:* if logging takes 30 seconds, people either rush their entries or blow out
their rest periods. Both corrupt the data being collected. The interaction quality **is** the data
quality.

### P2 — Weekly sets per muscle is the headline

Muscle-group volume is the primary view. Per-exercise charts are secondary.

- Every exercise maps to primary and secondary muscles with a weighting
- A set of incline press counts fully to chest, partially to front delts and triceps
- Show the week's running total per muscle against a target band
- Reference range: **~10–20 hard sets per muscle per week** for hypertrophy, with wide individual
  variation — present it as a band, never as a prescription

### P3 — Show the math, and show its error bars

```
Epley     1RM = w × (1 + r / 30)      best at 2–5 reps
Brzycki   1RM = w × 36 / (37 − r)     best at 6–10 reps
```

Both land within ~2–10% of a tested max inside the 2–10 rep window and degrade badly above it.

**Therefore:** pick the formula by rep count, and *visually de-emphasize* any e1RM derived from a set
above 10 reps rather than plotting it as equally trustworthy. Also expose the formula being used —
spreadsheet transparency means the user can see and verify the math.

### P4 — Teach at the moment of use

The first time the app asks for RIR, it explains RIR — inline, one sentence, tap for more.
Never an onboarding carousel, never a help section nobody opens.

Every recommendation carries its "why" behind a disclosure:
> *"Suggesting 3 sets, not 4 — your chest volume is already at 18 sets this week."*

This is how one interface serves a new lifter and an advanced one simultaneously.

**Elevated to core architecture (D9).** The audience is explicitly "any level," so disclosure is not
a polish item — it's structural. Every advanced control (RIR, tempo, set types, volume landmarks) is
hidden by default and revealed on demand or as the user shows readiness. A beginner sees weight and
reps. An advanced lifter sees everything, without hunting through settings.

### P4b — The dashboard follows the user's goal (D10)

Users pick their goal, so the primary view reconfigures:

| Goal | Headline metric | Secondary |
|---|---|---|
| Hypertrophy *(default)* | Weekly sets per muscle group | e1RM per lift |
| Strength | e1RM progression per lift | Volume, as fatigue context |
| General fitness | Session consistency + mixed metrics | Time/distance work surfaces here |

### P5 — The block is the unit of analysis

Build around training blocks, not infinite scroll. At block end, produce a real summary: volume by
muscle, e1RM change per lift, sessions completed, where you stalled. Then allow block-vs-block
comparison.

This is the screen that answers *"is this working?"* — the question nothing on the market answers.

### P6 — Permanence

Full data export, always, no conditions. This is the promise no competitor makes and the entire
reason for building rather than installing.

---

## 2. Data model requirements

The set schema is the highest-risk decision in the project — everything else can be refactored
cheaply, this cannot.

**The failure mode to avoid:** every competitor hardcodes `weight × reps`. That single choice is why
serious lifters stay on spreadsheets — you cannot represent myo-reps, cluster sets, tempo work, or an
AMRAP finisher. Allowing for it now costs a few nullable columns; retrofitting it later is a painful
migration.

### Must support from day one

| Requirement | Note |
|---|---|
| Optional RIR / RPE per set | Drives autoregulation later (Tier 3) |
| Optional tempo | e.g. `3-1-1-0` |
| Set type flag | straight, warmup, drop, myo-rep, cluster, AMRAP, backoff |
| Non-weight metrics | time, distance, bodyweight-only, assisted (negative load) |
| Exercise → muscle mapping | primary + secondary, with weighting, for P2 |
| ⚠️ ~~Warmup sets excluded from volume~~ | 🚨 **THIS IS NOT A REQUIREMENT ANY MORE — IT IS AN OPEN DECISION TIM OWES, and it must not be built by whoever reads this row.** The original reasoning below still stands as reasoning. See the note under this table. |
| Unit system per user | kg / lb, stored canonically, displayed per preference |
| Sync-ready identity | stable UUIDs + timestamps so a sync layer can be added without migration |

🚨 **The warmup row, struck 2026-08-31 — read this before touching volume.** It was written as an
unmet requirement, and a fresh session reading only this file would go and implement it. It is
instead **⏸️ a live open decision that is Tim's to make** (`progress.md`, "three decisions are Tim's"
(a), and Open work 0c; the option that changed it is `docs/social-plan.md` §12.16).

- **Today every logged set counts, everywhere, and the screens say so out loud** — the Volume tab
  admits it counts warm-ups because the app has no way to tell a warm-up from a back-off set.
- The two options on the table were both **guesses by the app**, which is why neither was taken:
  exclude sets under some fraction of the top set (which also throws away genuine back-off work), or
  count everything and admit it.
- ⚠️ **There is now a third and better option: the lifter types the set**, the way Hevy does — `W`
  for a warm-up, working sets numbered. The app never guesses. That is a set-type flag, a control in
  the runner, an option in `volume-map.js`, and the Volume tab's apology becoming a setting.
- ⚠️ **Whatever is chosen, every set already recorded is untyped and must stay counted** rather than
  be retro-guessed.

🚨 **Do not close this by building it.** `progress.md` states it as a decision that "must not be made
by implementing" it, and it has been the highest-value item on that list since 2026-08-24.

### Schema AS BUILT (current, in `js/store.js` + `js/exercises.js`)

This is what the code actually does today. The target schema below it is where this needs to go.

```
Exercise
  id, name, isCustom
  muscle              ONE string — not yet the weighted primary/secondary mapping
  equipment           ONE string
  fields[]            which of weight | reps | time | distance are tracked
  loadType            'per_side' | 'total' | null   → how the weight is counted

Workout               (a template, not a performed session)
  id, name, createdAt, updatedAt
  exercises[]         { exerciseId, sets, notes }   ← planned set count + note per exercise

Session               (a performed workout)
  id, workoutId, workoutName, date, startedAt, finishedAt
  isBenchmark         always written, true when the session was a tested max
  location?           hand-typed place label, absent when blank — NEVER a coordinate
  note?               the session description, ≤280 chars, absent when blank
                      ⚠️ added 2026-09-02. NOT the same key as an entry's `notes`,
                      which is the per-exercise coaching note on a TEMPLATE
  acceptedFrom?       set when the row came from somebody else's guest session
  entries[]           { exerciseId, exerciseName, group?, setType?, sets[] }
                        group     the superset / tri-set / giant-set grouping —
                                  a statement about the space BETWEEN adjacent
                                  exercises (D23)
                        setType   'drop' | 'myo'  — absent for a straight set

Set
  weight?, reps?, time?, distance?
  minis[]?            the drops of a drop set, or a myo-rep's match sets, NESTED
                      inside the one set so `sets.length` keeps counting ONE hard
                      set (D23). The legacy key was `drops`; `minisOf()` still
                      reads it. Absent rather than `[]` when there are none

GuestSession          ← a person you logged FOR, in its own collection
  the same shape plus guestName / personId? / forUid?, and deliberately no
  `location` and no `note` — see the guest-row note in js/views-session.js

Benchmark
  id, date, exerciseId, exerciseName, values{ weight?, reps?, time?, distance? }

Settings
  id, units, theme, gender, birthYear      ← birth year, NEVER age (age goes stale)

BodyWeight                                 ← added 2026-08-15
  id, date, weight, createdAt              one row per weigh-in; same-day replaces
```

`normalizeWorkout()` in `store.js` migrates the older `exerciseIds[]` shape to `exercises[]` on
read. Keep it — saved data in the wild still uses the old shape.

⚠️ **Corrected 2026-08-31.** The Session and Set blocks above were stale: they had been carrying the
day-one shape and omitted `isBenchmark`, `location`, `note`, `acceptedFrom`, the entry-level `group`
and `setType`, and the set-level `minis[]` — all of which the code writes today. Checked against
`store.saveSession()`'s call site and `cleanedEntriesOf()` in `js/views-session.js`, and against
`projectSession()` in `js/social.js`, which publishes the same fields to a friend. **A schema block
that is short a field is worse than no schema block**, because the next reader takes it as the list.

⚠️ **And this block is short three whole collections, which are named here rather than sketched from
memory.** `COLLECTIONS` in `js/store.js` is the authority and reads:
`customExercises · workouts · sessions · benchmarks · settings · bodyWeight · systems · goals ·
guestSessions · people`. **`systems`, `goals` and `people` have never been written up here** — read
the store for their shape. ⚠️ **`sessions` and `guestSessions` are SHARDED** (one Firestore document
per row, `SHARDED_COLLECTIONS` in `js/firebase-backend.js`); every other collection is still one
document holding every row, which is the constraint the whole sharing model is built around.

### Gaps between as-built and target

| Missing | Blocks | Difficulty |
|---|---|---|
| ~~`BodyWeightEntry` table~~ | — | **Built 2026-08-15** as the `bodyWeight` collection |
| `rir` / `rpe` / `tempo` on Set — ~~`setType`~~ | Autoregulation, warmup exclusion | Easy, additive — nullable columns. ⚠️ **`setType` is PART BUILT (2026-08-17, D23)**: `drop` and `myo` are recorded, with the extensions nested as `minis[]` inside the one set. `warmup` is NOT a value it takes — that is the struck row above, and it is Tim's decision, not a gap |
| Weighted primary/secondary muscle mapping | **D3 (weekly volume per muscle)**, and better muscle-map coverage than one-lift-one-muscle | Medium; changes `exercises.js` shape and needs a migration for custom exercises |
| `UserProfile` — `goal`, `experience`, `disclosureLevel` | D9 disclosure level, D10 goal-driven dashboard | Easy, additive. **Partially done**: `gender` and `birthYear` now live on Settings for the strength map |
| `Program` / `Block` | Tier 2 | Not designed yet |

**The muscle-mapping change is the one with real cost.** Everything else is nullable columns.

### Target schema (where this is going)

```
Exercise
  primaryMuscles[]    { muscle, weight: 1.0 }
  secondaryMuscles[]  { muscle, weight: 0.5 }
  equipment[]         array, for substitution (Tier 3)

Set
  setType             straight | warmup | drop | myorep | cluster | amrap | backoff
  rir?, rpe?, tempo?
  countsAsHardSet     derived: false for warmup

BodyWeightEntry
  id, date, weight, notes?

Program / Block       (Tier 2 — sketch only, not designed yet)
```

**Resolved 2026-08-14:**

- **Secondary-muscle weighting is fixed at 0.5**, with an advanced override. Configurable-by-default
  is a jargon wall (P4).
- **Drop sets and myo-reps count as one hard set**, with extensions logged but not double-counted.
  Counting each extension would inflate volume and break the P2 target bands, which are defined in
  hard sets.

### User profile (added — audience is any level, any goal)

```
UserProfile
  id, createdAt
  goal              hypertrophy | strength | general    → drives dashboard (D10)
  units             kg | lb
  experience        beginner | intermediate | advanced  → drives disclosure level (D9)
  disclosureLevel   derived from experience, user-overridable
  unlockedConcepts[]  which just-in-time explanations have been shown
```

---

## 3. Tech stack — as built

- **Web app / PWA**, no build step, no dependencies. Plain ES modules; serve the folder and it runs.
- **`localStorage`** behind an async API in `store.js`. *(The original plan said IndexedDB; the
  async API means swapping is a one-file change if volume ever demands it.)*
  ⚠️ **~~roughly 300 bytes a session~~ — CORRECTED, TWICE, on 2026-08-24, and both corrections went
  the same way: the app's own guess was too small.** A real serialisation put a session at
  **~1,100 bytes of JSON**, and Firestore does not charge JSON length — on this app's own data the
  true cost is **1.66× that, so ~2,000 bytes as Firestore counts it.** The original claim was out by
  more than 3× at the point it mattered (it implied ~3,000 sessions inside a 1 MiB document; the
  honest figure was ~950 on JSON and ~520 as charged). ⚠️ **Do not re-state a per-session byte
  figure from memory** — `store.cloudUsage()` exists precisely because a constant nobody can check
  drifted twice, and it reports *this account's* measured rows. `sessions` and `guestSessions` are
  one document per row since the sharding migration and are not measured against the cap at all.
- **Local-first, and an account is optional.**
  🚨 **~~activated by filling `js/firebase-config.js` and flipping `BACKEND` in `store.js`. Untested.~~
  — WRONG SINCE 2026-08-15/22, corrected 2026-08-31. THE CLOUD IS LIVE. There is no setup left to
  do, and this row was sending a fresh session to redo finished work.** As built:
  - `js/firebase-config.js` holds the **real** project (`fitness-tracker-th`). Those values are not
    secrets — they identify the project, not the user; Auth plus `firestore.rules` are what protect
    the data.
  - `store.js` runs **`BACKEND = 'auto'`**, so the app is on Firestore whenever the config is present
    and falls back to local storage when it cannot connect. Nothing needs flipping.
  - It is **tested**: `tests/rules.test.mjs` is a Firestore-emulator suite that runs as somebody who
    is *not* you and asserts the denials as well as the allows — the only tests here that can. And
    **two real accounts connected over the live project on 2026-08-22** (invite, claim, accept, tier,
    publish, read, downgrade, disconnect).
  - ⚠️ **What is still unverified is the SOCIAL work built since**, not the adapter. `progress.md` is
    the authority on which parts two real accounts have and have not exercised.
- **No framework.** DOM built with the `el()` helper in `ui.js`.
- **Charts hand-rolled** — SVG for the line chart, HTML/CSS for the bars.

---

## 4. Explicitly not building

| Cut | Reason |
|---|---|
| Diet / nutrition tracking | See `../progress.md` D1 — free alternatives are not meaningfully crippled |
| ⚠️ ~~Social feed~~ → **the DISCOVERY feed of strangers** | **Narrowed 2026-08-31, and the refusal is real — it is just narrower than this row used to claim.** A **friends' feed** is BUILT: it is the Friends half of Home (since 2026-08-25, Hevy-shaped since 2026-09-02) and shows sessions published by people you are mutually connected to. What is still refused is **algorithmic discovery — a feed of people you do not know**: that is what D7 was actually written against, it needs public profiles and the ability to enumerate them (the exact thing the invite-link design exists to avoid), and it imports a moderation story this project does not have. ⚠️ **D7 itself was never narrowed** and still reads "No social feed" in `progress.md` §6; the standing refusal is Open work 18 there |
| AI-generated workouts | Fitbod's model actively undermines progressive overload — you can't beat last week on a lift you didn't do last week |
| A library of thousands of programs | Boostcamp owns this. A small set of well-explained programs serves beginners better |
