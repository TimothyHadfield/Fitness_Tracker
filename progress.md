# Fitness Tracker — Progress & Context

> **Fresh session: read this entire file before doing anything.** It is written to be the only
> thing you need. `docs/spec.md` has product/technical detail; `chat.md` is a human-readable
> conversation log you only need in order to answer "what did we say about X".

**Last updated:** 2026-08-15
**Status:** Working app, deployed and live. Five rounds of refinement done. Firebase written but
not connected. **Never yet seen running in a real browser.**

| | |
|---|---|
| **Live app** | https://timothyhadfield.github.io/Fitness_Tracker/ |
| **Repo** | https://github.com/TimothyHadfield/Fitness_Tracker (public, Pages from `main` root) |
| **Run locally** | `python -m http.server 8765` from the project root → `http://127.0.0.1:8765` |
| **Test** | `node tests/data-layer.test.mjs` — 50 assertions, all passing |
| **Deploy** | commit + push to `main`; Pages rebuilds in ~40s |

It needs a server — ES modules do not load over `file://`.

---

## 0. Read this before your first tool call

Five things that will bite you otherwise.

1. **Git: this folder has its own nested repo.** The parent `Code Projects/` folder is a *separate*
   repo whose remote is `Estimator_Quiz`. **Always run git from inside `Fitness_Tracker/`**, never
   from the parent, or you will commit to the wrong repository.

2. **Don't `cd` outside the workspace in Bash.** Tim's settings allow all Bash, but commands that
   leave the project directory trigger a separate scope check and prompt him. Use absolute paths
   from within the project instead. He has asked twice not to be prompted — respect it.

3. **A permissions fix is pending a restart.** `additionalDirectories` was added to
   `~/.claude/settings.json` on 2026-08-14 but settings only load at startup. If Tim is still
   getting prompts, he needs to restart Claude Code. Don't re-edit the settings.

4. **Keep `progress.md` and `chat.md` current without being asked.** Tim's whole workflow is to
   reset the chat and say only *"catch up with progress.md"*. If this file is stale, the next
   session starts blind.

5. **Nothing has been visually verified.** No browser has ever rendered this app. All confidence
   comes from syntax checks, headless data tests, and HTTP checks. Say so plainly rather than
   implying the UI is known-good.

---

## 1. Working agreement

Tim is the **manager**; Claude is the **builder**.

- Tim describes the vision. Claude designs and implements it.
- **Recommend and proceed — don't ask.** If a good recommendation exists, act on it and state the
  assumption plainly. Only ask when the vision genuinely can't be inferred *and* the readings would
  lead to materially different work.
- **Questions go in the AskUserQuestion box, never in prose.** Tim often doesn't read a full reply,
  so questions buried in text get missed.
- **Keep replies short with the conclusion first**, for the same reason.
- Maintain `progress.md` and `chat.md` continuously, unprompted.

### File upkeep

| File | Job | Update when |
|---|---|---|
| `progress.md` | State, decisions, rules, next steps. **The catch-up file.** | Any decision, milestone, or scope change |
| `chat.md` | Chronological human-readable log | After each substantive exchange |
| `docs/spec.md` | Product + technical spec, data model | A feature or model decision is made |
| `docs/firebase-setup.md` | What Tim must do in the Firebase console | Firebase work |
| `docs/competitive-teardown.html` | Competitive research (published artifact) | Only if research is revisited |

---

## 2. Vision & audience

A **lifting tracker**, web-based, that is genuinely better than a Google Sheet.

Tim's stated wants:
- Log weight, reps, time, and other metrics for any exercise
- Track things over time, including body weight
- Set up lifting **"programs"** that make it easy to measure how you're doing
- Enter data **while mid-workout** — the critical UX moment
- He cares a lot about **usability and formatting**, and about **scientific accuracy**

**Minimum bar:** beats Google Sheets. **Stretch:** educate new lifters, provide ready-made programs.

### Audience (confirmed 2026-08-14, via question box)

- **Who:** Tim and friends to start, **open to anyone, potentially many people eventually**
- **Level:** must serve **any level**, beginner through advanced
- **Goal:** **the user chooses** — hypertrophy, strength, or general fitness

This is a **product for other people**, not a personal tool. Consequences: onboarding must work for
a stranger, progressive disclosure is core architecture, and the dashboard reconfigures around the
user's goal.

### Out of scope

**Diet / nutrition tracking — cut** (D1 below). Point users at Cronometer's free tier.

---

## 3. Current state — what actually works

Scope was deliberately narrowed by Tim: *"work on the overall format of the site, ignore all of the
smart features."* No programs, volume targets, or autoregulation yet — those are Tier 2/3.

| Area | State |
|---|---|
| Workout builder | Name it, add exercises, reorder, **planned set count per exercise**, **per-exercise notes**, edit, delete |
| Exercise library | **265 exercises**, searchable, filterable by 15 muscle groups |
| Custom exercises | User-created; choose tracked fields and how weight is counted |
| Session runner | Builds the planned number of sets, pre-fills last time's numbers, ±steppers, next/back arrows, finish → calendar |
| Load type | Every weighted exercise labelled **PER SIDE** or **TOTAL** |
| Draft recovery | In-progress workout survives an app switch; expires at end of day |
| Benchmarks | Any date (default today), any exercise → graph + calendar |
| Calendar | Continuous vertical month scroll, sticky headings, opens on current month; active days colour-filled and **named** (workout title, or "Benchmark") |
| Graphs | Two modes — **Over time** (measured SVG line, all sources) and **Start vs now** (paired bars, **benchmarks only**) |
| Settings | Dark/light, export backup, restore backup, delete all |

**Stepper increments:** reps ±1 · weight ±5 lbs · time ±10 sec · distance ±0.1 mi. Press-and-hold repeats.

### Verified
- All 9 JS modules pass syntax check
- **50 data-layer assertions pass** (`node tests/data-layer.test.mjs`)
- Every class referenced in JS has a matching CSS rule
- All assets serve 200 with correct MIME types from Pages

### NOT verified
- **No browser has ever rendered this.** Layout, touch behaviour, and the measured-chart sizing are
  all unconfirmed.
- **Firebase adapter written but never executed.**

---

## 4. Architecture

**No build step, no dependencies.** Plain ES modules. Serve the folder and it runs.

```
Fitness_Tracker/
├── index.html                  entry point
├── manifest.webmanifest        PWA — installs to iPhone home screen
├── icon.svg
├── progress.md                 ← this file
├── chat.md                     conversation log
├── README.md
├── css/
│   └── app.css                 ALL styling. Mobile-first; desktop in one media query.
├── js/
│   ├── app.js                  hash router + boot
│   ├── store.js                data layer — async API, backend-agnostic
│   ├── exercises.js            265-exercise library + load-type rules
│   ├── ui.js                   el(), icons, sheets, toasts, steppers, formatters, screenShell
│   ├── views-workouts.js       home, workout list, builder, exercise picker
│   ├── views-session.js        session runner, benchmark form
│   ├── views-data.js           calendar, day detail, graphs, settings
│   ├── firebase-config.js      EMPTY placeholder for keys
│   └── firebase-backend.js     complete Firestore adapter — UNTESTED
├── tests/
│   └── data-layer.test.mjs     50 headless assertions, no DOM needed
└── docs/
    ├── spec.md
    ├── firebase-setup.md
    └── competitive-teardown.html
```

### Key patterns

- **Everything goes through `store.js`.** Its API is async so swapping to Firebase touches no view
  code — only the `BACKEND` constant at the top of that file.
- **Hash router** in `app.js`. Routes named in `FULLSCREEN` hide the bottom nav and get the
  `no-nav` class (which owes the iPhone safe-area padding).
- **`screenShell({ title, sub, back, actions, top, scroll, bottom })`** in `ui.js` builds every
  screen. `title` accepts a **string or a DOM node** — passing a node lets a screen put its primary
  control in the header instead of a redundant heading.
- **Charts are hand-rolled.** The line chart is SVG in `views-data.js`; the bar chart is HTML/CSS.
  No charting library.
- **`el(tag, props, ...children)`** is the DOM builder. `class`, `text`, `html`, `dataset`, and
  `onX` handlers are special-cased; falsy children are skipped.

### Data model (current shape)

```
Exercise    id, name, muscle, equipment, fields[], loadType, isCustom
Workout     id, name, exercises[{ exerciseId, sets, notes }], createdAt, updatedAt
Session     id, workoutId, workoutName, date, startedAt, finishedAt,
            entries[{ exerciseId, exerciseName, sets[{weight,reps,time,distance}] }]
Benchmark   id, date, exerciseId, exerciseName, values{}
Settings    id, units, theme
```

`normalizeWorkout()` in `store.js` migrates the old `exerciseIds[]` shape to `exercises[]` on read —
keep it. `fields[]` drives which steppers appear; `loadType` is `'per_side' | 'total' | null`.

---

## 5. Design rules — binding

These came from Tim directly over rounds 2–5. Violating them means redoing work.

### Rule 1 — the window never scrolls, and screens shouldn't need to

`html, body { overflow: hidden }`; `#app` is a fixed `100dvh` flex container. Every screen is
a fixed header, an optional fixed `top`, one flexible `pane-scroll`, and an optional fixed `bottom`.

**Scrolling is a last resort, not a layout tool.** Shrink and tighten until a screen fits. Inner
scrolling is only acceptable for genuinely unbounded lists: the builder's exercise list, recent
activity, search results, and the calendar (the deliberate exception — see below).

`#app` uses `flex-direction: column-reverse` on mobile so the nav (first DOM child) sits at the
bottom, and flips to `row` on desktop so the same element becomes a left sidebar.

### Rule 2 — no boxes

Structure comes from hairline rules, spacing, and type weight — never nested bordered cards.
`.card` survives as a semantic grouping but **draws nothing**. `.list` uses negative inline margins
so hairlines run full-bleed while text stays on the gutter.

### Rule 3 — content first, controls in the leftover

*"Start with the most important thing and put it as big as you can, then put the selectors in the
leftover space, not the opposite."*

Budget the screen for the content, then fit controls into what remains. Applied:

- **The line chart is measured, not fixed.** `fillChart()` reads the container's real pixel size and
  draws the SVG at exactly that, with a `ResizeObserver` for rotation/resize. Gridline count and
  date-label density scale with size. Plot gets ~500px on a ~850px viewport.
- Graph controls collapsed from three stacked rows to one `.control-row`.
- Mode switch and calendar legend live in the header, not in rows of their own.
- Bars use `clamp(13px, 2.4dvh, 24px)` so they thicken with the viewport.

### Density decisions worth preserving

- Steppers are a `repeat(auto-fit, minmax(148px, 1fr))` grid, so **weight and reps sit side by side**
  — ~140px saved on every session screen.
- Summary stats are a 4-across hairline grid.
- The calendar is the one place that scrolls by design: months run continuously with sticky
  headings, opening on the current month, spanning at least 12 months back.

### Chart colours — validate, never eyeball

`--series-start` / `--series-now` in `css/app.css`. Deliberately **not** the UI accent.

| Theme | Start | Now | CVD ΔE | Normal ΔE | Contrast |
|---|---|---|---|---|---|
| Dark | `#3D8FC0` | `#C08430` | 19.6 | 23.2 | 5.3 / 5.9 |
| Light | `#2C7CB0` | `#96660F` | 20.7 | 22.1 | 4.1 / 4.5 |

Thresholds: OKLCH L in [0.48, 0.67] dark / [0.43, 0.77] light, chroma ≥ 0.10, CVD ΔE ≥ 8,
normal-vision ΔE ≥ 15, contrast ≥ 3:1.

**Before building any new chart, load the `dataviz` skill and run its validator.** Bars also carry
direct value labels and text tags so identity is never colour-alone.

### Load-type rules (`js/exercises.js`)

`loadTypeFor(name, equipment, fields)` → `'per_side' | 'total' | null`.

- Dumbbell / kettlebell → per side; barbell / machine / plate → total
- `FORCE_PER_SIDE` — cable flys and crossovers (two stacks), single-arm work, carries
- `FORCE_TOTAL` — one implement in two hands (goblet squat, KB swing, DB pullover), single-limb
  *machines* (single-leg press)

Displays as `50 lbs/side × 10`. All 265 weighted exercises are asserted to have a load type.

---

## 6. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| D1 | **No diet/nutrition feature.** Point at Cronometer's free tier. | Free nutrition apps aren't meaningfully crippled — diet tracking is present-tense, so the history paywall that ruins free lifting apps doesn't bite. The food database also can't be replicated. |
| D2 | **Lifting only.** | Focus. |
| D3 | **Weekly sets per muscle group is the headline metric**, not per-exercise charts. | What hypertrophy responds to (~10–20 hard sets/muscle/week). Only Alpha Progression ($79.99/yr) does it. Biggest differentiator available. **Not built yet — Tier 2.** |
| D4 | **Target = spreadsheet transparency + app ergonomics.** | Spreadsheets survive on whole-block visibility, structural freedom, visible formulas, permanence. Apps only win the logging loop. Take both. |
| D5 | **e1RM must be rep-range honest.** Epley for 2–5 reps, Brzycki for 6–10, de-emphasize anything above 10. | Formulas are ±2–10% inside 2–10 reps and degrade badly above. Nobody else shows this. **Not built yet.** |
| D6 | **Offline-first logging is non-negotiable.** | Gyms are basements. |
| D7 | **No social feed.** | Repeatedly cited as unwanted in Hevy reviews. |
| D8 | **Teach at the moment of use**, never a manual or onboarding carousel. | RP Hypertrophy has the best science and worst delivery — jargon wall on day one. |
| D9 | **Progressive disclosure is core architecture**, not a late feature. Advanced controls hidden by default. | Audience is "any level". Can't be bolted on later. |
| D10 | **Training goal is a user setting that reconfigures the dashboard.** Hypertrophy → volume; strength → e1RM; general → mixed. | Users choose their goal, so one fixed dashboard would be wrong for most. D3 remains the default. |

### Standing recommendations (acted on, not blocking)

- **R1 — Web app (PWA), not native iOS.** Installs to the home screen, works offline, zero
  distribution cost, matches the rest of Tim's portfolio.
- **R2 — Local-first storage, no accounts yet.** This already serves "me and friends" — each browser
  holds its own data. Accounts/sync solve *cross-device and backup*, not multi-user. Schema carries
  UUIDs + timestamps so the layer drops in without migration.
- **R3 — Ship Tier 1 before anything else.**

### Resolved by Claude without asking

- **Drop sets / myo-reps count as one hard set**, extensions logged but not double-counted — else
  volume totals inflate and break the target bands.
- **Secondary-muscle weighting fixed at 0.5** with an advanced override — configurable-by-default
  is exactly the jargon wall D8 exists to prevent.
- **Sets exist in the session runner** even though Tim's described flow implied one entry per
  exercise. An app that can't log 3×8 would be useless.
- **Bar chart requires 2+ benchmarks** per exercise. One benchmark draws two identical bars, which
  says nothing. Excluded ones surface as a visible count.

---

## 7. Research summary

Full teardown: `docs/competitive-teardown.html`, also at
https://claude.ai/code/artifact/e3a7adce-c1cf-4284-8eff-762db7da6bbd

**Analyzed:** Strong, Hevy, Boostcamp, Liftosaur, Alpha Progression, RP Hypertrophy, Fitbod.

- **Strong** — the logging loop; the interaction gold standard
- **Hevy** — polish and feel, free unlimited logging, real web app
- **Boostcamp** — solves "what program do I run" for free, 11,000+ programs
- **Liftosaur** — progression as code; no ceiling on program logic
- **Alpha Progression** — weekly volume per muscle vs evidence-based targets; the right metric
- **RP Hypertrophy** — true autoregulation from post-session subjective feedback
- **Fitbod** — zero-decision onboarding; equipment-aware substitution

**Five failures shared by all:** data goes in but insight doesn't come out; offline is an
afterthought; analysis is per-exercise not per-muscle; the jargon wall; you can't answer "is this
working?"

**The gap being built into:** four of five commercial apps monetize by restricting access to your
own accumulated data (Hevy caps free at 3 months of graph history).

**Unverified claims — don't treat as settled:** that Hevy requires a connection to log; whether
Liftosaur's cloud sync is paid.

---

## 8. Roadmap

**Tier 1 — beat the spreadsheet** — mostly DONE. Remaining: body-weight tracking with a trend line,
rep-range-honest e1RM chart, rest timer.

**Tier 2 — programs and analysis**
- Program builder (desktop) → execution (mobile)
- Progression rules: linear + double progression first
- Weekly volume per muscle group vs target bands (D3)
- Block summary + block-over-block comparison
- Stall detection (e1RM flat 3+ weeks → flag and explain)

**Tier 3 — teach and guide**
- Small set of well-explained starter programs, not a library of thousands
- Just-in-time concept explanations wired to first use (D8)
- Post-session check-in feeding next week's volume, in plain language
- Deload prompting from accumulated fatigue
- Equipment-aware exercise substitution

---

## 9. Known gaps — deliberate, not bugs

- **No body-weight tracking UI yet.** It's in Tier 1 and the store has no table for it. This is the
  most visible Tier 1 hole.
- **No rest timer.** In the spec, but Tim's described flow didn't call for it.
- Sets are a flat list — no RIR, tempo, or set types. `docs/spec.md` specifies them and the schema
  has room; adding them is additive.
- No supersets.
- Weight display is hard-coded to lbs. The unit setting exists in the store but isn't wired to the UI.
- Exercise→muscle mapping is a single `muscle` string, not the primary/secondary weighted mapping
  `docs/spec.md` specifies. **This must change before D3 (volume per muscle) can be built.**

---

## 10. Next steps

1. **Tim clicks through the app on his phone** and reports what's wrong. Nothing else should be
   built until the core loop has survived one real gym session.
2. **Firebase**, once Tim creates the project and pastes config into `js/firebase-config.js`
   (`docs/firebase-setup.md` has the 5-minute console walkthrough). The adapter is written and
   waiting; flip `BACKEND` in `store.js` and test.
3. **Body-weight tracking** — the biggest Tier 1 gap.
4. Then Tier 2, starting with the exercise→muscle mapping change that D3 depends on.

### Open questions for Tim

None outstanding. All prior questions were answered on 2026-08-14 (see §2 Audience).
When something genuinely open arises, use the AskUserQuestion box, not prose.
