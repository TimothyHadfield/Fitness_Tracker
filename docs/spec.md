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
| Warmup sets excluded from volume | they are not hard sets and must not inflate the count |
| Unit system per user | kg / lb, stored canonically, displayed per preference |
| Sync-ready identity | stable UUIDs + timestamps so a sync layer can be added without migration |

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
  entries[]           { exerciseId, exerciseName, sets[] }

Set                   (flat — see gaps below)
  weight?, reps?, time?, distance?

Benchmark
  id, date, exerciseId, exerciseName, values{ weight?, reps?, time?, distance? }

Settings
  id, units, theme
```

`normalizeWorkout()` in `store.js` migrates the older `exerciseIds[]` shape to `exercises[]` on
read. Keep it — saved data in the wild still uses the old shape.

### Gaps between as-built and target

| Missing | Blocks | Difficulty |
|---|---|---|
| `BodyWeightEntry` table | Tier 1 body-weight tracking | Easy, additive |
| `rir` / `rpe` / `tempo` / `setType` on Set | Autoregulation, warmup exclusion | Easy, additive — nullable columns |
| Weighted primary/secondary muscle mapping | **D3 (weekly volume per muscle)** — the headline metric | Medium; changes `exercises.js` shape and needs a migration for custom exercises |
| `UserProfile` | D9 disclosure level, D10 goal-driven dashboard | Easy, additive |
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
  async API means swapping is a one-file change if volume ever demands it. Workout data is small
  text — roughly 300 bytes a session — so this is not urgent.)*
- **Local-first, no accounts.** A complete Firestore adapter sits in `js/firebase-backend.js`,
  activated by filling `js/firebase-config.js` and flipping `BACKEND` in `store.js`. Untested.
- **No framework.** DOM built with the `el()` helper in `ui.js`.
- **Charts hand-rolled** — SVG for the line chart, HTML/CSS for the bars.

---

## 4. Explicitly not building

| Cut | Reason |
|---|---|
| Diet / nutrition tracking | See `../progress.md` D1 — free alternatives are not meaningfully crippled |
| Social feed | Repeatedly cited as unwanted by Hevy users |
| AI-generated workouts | Fitbod's model actively undermines progressive overload — you can't beat last week on a lift you didn't do last week |
| A library of thousands of programs | Boostcamp owns this. A small set of well-explained programs serves beginners better |
