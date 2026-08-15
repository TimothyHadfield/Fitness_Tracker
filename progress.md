# Fitness Tracker — Progress & Context

> **If you are a fresh Claude session: read this whole file first.** It is the single source of
> truth for where this project stands. Then skim `docs/spec.md` for the product detail.
> `chat.md` is a human-readable conversation log — you do not need it to work, only to answer
> "what did we say about X."

**Last updated:** 2026-08-14
**Status:** v1 built, deployed, and live. Firebase not connected (needs Tim's credentials).

**Live app:** https://timothyhadfield.github.io/Fitness_Tracker/
**Repo:** https://github.com/TimothyHadfield/Fitness_Tracker (public, Pages from `main` root)

**To run locally:** `python -m http.server 8765` from the project root, then open
`http://127.0.0.1:8765`. It needs a server — ES modules do not load over `file://`.

**Deploying:** commit and push to `main`. Pages rebuilds automatically, live in ~40 seconds.

---

## 1. Working agreement

Tim is the **manager**; Claude is the **builder**.

- Tim describes the vision. Claude designs and implements it.
- Claude is expected to make recommendations, not present menus of options.
- **If Claude has a good recommendation, Claude does not ask — it recommends and proceeds**,
  stating the assumption plainly.
- Claude asks questions *only* when it genuinely cannot infer the vision and the different
  readings would lead to materially different work.
- **Questions go in the interactive question box (AskUserQuestion tool), never in prose.**
  Tim often doesn't read a full reply, so questions written in the text get missed. This does not
  mean ask more — it means the few genuinely open questions get routed where he'll see them.
- Keep key conclusions short and near the top of replies, for the same reason.
- Claude maintains `progress.md` and `chat.md` continuously, without being reminded.

### File upkeep protocol

| File | Job | When to update |
|---|---|---|
| `progress.md` | State, decisions, next steps. The catch-up file. | After any decision, milestone, or scope change |
| `chat.md` | Chronological human-readable summary of the conversation | After each substantive exchange |
| `docs/spec.md` | The evolving product + technical spec | When a feature or model decision is made |
| `docs/competitive-teardown.html` | Competitive research (formatted, published) | Only if research is revisited |

---

## 2. The vision

A **lifting tracker** — web-based — that is genuinely better than a Google Sheet.

Tim's stated wants, verbatim in substance:

- Log weight, reps, time, and other metrics for any exercise
- Track things over time, including body weight
- Set up lifting **"programs"** that make it easy to measure how you're doing
- Enter data **while mid-workout** (this is the critical UX moment)
- Cares a lot about **usability and formatting**
- Cares a lot about **scientific accuracy**

**Minimum bar:** a place to track lifting data that beats Google Sheets.
**Stretch goals:** educate new lifters; provide ready-made workouts/programs.

### Audience (confirmed 2026-08-14)

- **Who:** Tim and friends to start, **open to anyone, potentially many people eventually.**
- **Experience level:** must serve **any level** — beginner through advanced.
- **Training goal:** **the user chooses** — hypertrophy, strength, or general fitness.

This is a **product for other people**, not a personal tool. Three consequences that ripple through
everything below: onboarding has to work for a stranger, progressive disclosure becomes core
architecture rather than a nicety, and the dashboard has to reconfigure itself around the user's
stated goal.

### Explicitly out of scope

**Diet / nutrition tracking — cut, decided 2026-08-14.** Reasoning below in Decisions.

---

## 3. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| D1 | **No diet/nutrition feature.** Point users to Cronometer (free tier) instead. | Free nutrition apps are not meaningfully crippled — diet tracking is present-tense, so the "history paywall" that ruins free lifting apps doesn't bite. The food database is also the one asset that genuinely can't be replicated. |
| D2 | **Lifting only.** | Focus. See D1. |
| D3 | **Weekly sets per muscle group is the headline metric**, not per-exercise charts. | This is what hypertrophy actually responds to (~10–20 hard sets/muscle/week). Only Alpha Progression ($79.99/yr) does it. Biggest single differentiator available. |
| D4 | **Target = spreadsheet transparency + app ergonomics.** | Spreadsheets survive because of whole-block visibility, structural freedom, visible formulas, and permanence. Apps win only on the logging loop. Take both. |
| D5 | **e1RM must be rep-range honest.** Epley for 2–5 reps, Brzycki for 6–10, visually de-emphasize anything derived from >10 reps. | Formulas are ±2–10% inside 2–10 reps and degrade badly above. Nobody else shows this. Directly serves Tim's "scientific knowledge" priority. |
| D6 | **Offline-first logging is non-negotiable.** | Gyms are basements. Hevy is reported to require a connection to log — a real, cited failure. |
| D7 | **No social feed.** | Repeatedly cited as unwanted in Hevy reviews. |
| D8 | **Teach at the moment of use**, never via a manual or onboarding carousel. | RP Hypertrophy has the best science and the worst delivery — jargon wall on day one. Inverting this is how one interface serves beginners and advanced lifters at once. |
| D9 | **Progressive disclosure is core architecture, not a Tier 3 feature.** Every advanced control (RIR, tempo, set types, volume landmarks) is hidden by default and revealed on demand or as the user demonstrates readiness. | Audience is "any level." A beginner and an advanced lifter must both feel the app was built for them, from the same interface. This is the hardest requirement in the project and it can't be bolted on later. |
| D10 | **Training goal is a user setting that reconfigures the primary dashboard.** Hypertrophy → weekly volume per muscle is the headline. Strength → e1RM progression is the headline. General fitness → broader mix incl. time/distance work. | Users choose their goal, so a single fixed dashboard would be wrong for most of them. D3 still holds as the *default*, since hypertrophy is the most common goal. |

### Recommendations made and proceeding on (not blocking)

- **R1 — Build as a web app (PWA), not native iOS.** Tim is iOS-only personally, but every other
  project in this portfolio is an HTML site, the project already contains `fitness_tracker.html`,
  and a PWA installs to the iOS home screen, works offline, and costs nothing to distribute.
- **R2 — Local-first storage** (IndexedDB) with full export for v1. No backend, no accounts *yet*.
  This still fully serves "me and friends" — each person's browser holds their own data, and sharing
  the app is just sharing a URL. Accounts and cloud sync solve **cross-device use and backup**, not
  multi-user, so they are a real roadmap item (Tier 2/3) rather than a v1 requirement. Schema carries
  UUIDs and timestamps from day one so that layer drops in without a migration.
- **R3 — Ship Tier 1 before anything else** (see build order below). It alone clears the stated bar.

---

## 4. Research findings (summary)

Full teardown: `docs/competitive-teardown.html` —
also published at https://claude.ai/code/artifact/e3a7adce-c1cf-4284-8eff-762db7da6bbd

**Apps analyzed:** Strong, Hevy, Boostcamp, Liftosaur, Alpha Progression, RP Hypertrophy, Fitbod.

**What each does best:**
- **Strong** — the logging loop. Pre-filled sets, auto-starting rest timer. The interaction gold standard.
- **Hevy** — polish, feel, free unlimited logging, real web app.
- **Boostcamp** — solves "what program do I run" for free. 11,000+ programs. Desktop builder → mobile execution.
- **Liftosaur** — progression as code (Liftoscript). No ceiling on program logic.
- **Alpha Progression** — weekly volume per muscle vs evidence-based targets. The right metric.
- **RP Hypertrophy** — true autoregulation via post-session subjective feedback.
- **Fitbod** — zero-decision onboarding; equipment-aware substitution.

**Five failures shared by all:**
1. Data goes in, insight doesn't come out
2. Offline is an afterthought
3. Analysis is per-exercise, not per-muscle
4. The jargon wall
5. You can't answer "is this working?"

**Free tier reality check:** Hevy caps free at 4 routines / 7 custom exercises / **3 months of graph
history**. Four of five commercial apps monetize by restricting access to your own accumulated data.
That is the gap being built into.

### Unverified claims (flagged, do not treat as settled)

- Hevy requiring an internet connection to log — from review aggregators, not the vendor.
- Whether Liftosaur's cloud sync/backup is a paid feature — sources conflict; App Store listing ambiguous.

---

## 5. Build order

**Tier 1 — Beat the spreadsheet** *(clears the stated minimum bar)*
- Exercise library + custom exercises, each mapped to primary/secondary muscles
- Fast offline set logging: last-session pre-fill, auto-starting rest timer, <10s one-handed
- Body weight tracking with a trend line (not raw daily points)
- Per-exercise history + rep-range-honest e1RM chart
- Full data export

**Tier 2 — Programs and analysis**
- Program builder (desktop) → execution (mobile)
- Progression rules: linear + double progression first
- Weekly volume per muscle group vs target bands
- Block summary + block-over-block comparison
- Stall detection (e1RM flat 3+ weeks → flag and explain)

**Tier 3 — Teach and guide**
- Small set of well-explained starter programs (not a library of thousands)
- Just-in-time concept explanations wired to first use
- Post-session check-in feeding next week's volume, in plain language
- Deload prompting from accumulated fatigue / performance decrement
- Equipment-aware exercise substitution

---

## 6. Current state

**v1 is built and passing tests.** Scope for this build was deliberately narrowed by Tim
(2026-08-14): *"work on the overall format of the site, ignore all of the smart features."*
No pre-built programs, no hypertrophy targets, no autoregulation — those stay in Tier 2/3.

### What works

| Area | State |
|---|---|
| Custom workout builder | Name it, add exercises, reorder, **set planned set count per exercise**, **per-exercise notes**, edit, delete |
| Exercise library | **265 exercises**, searchable, filterable by 15 muscle groups |
| Custom exercises | User-created; choose tracked fields and how weight is counted |
| Session runner | Builds the planned number of sets, prefills last time's numbers, ±steppers, next/back arrows, finish → calendar |
| Load type | Every weighted exercise is labelled **PER SIDE** or **TOTAL** |
| Draft recovery | In-progress workout survives an app switch; expires at end of day |
| Benchmarks | Any date (default today), any exercise, saves to graph + calendar |
| Calendar | **Continuous vertical scroll through months** (no arrows); active days are colour-filled and **named** — workout title, or the word "Benchmark" |
| Graphs | Two modes: **Over time** (SVG line, all sources) and **Start vs now** (paired bars, **benchmarks only**) |
| Settings | Dark/light, export backup, restore backup, delete all |

### Stepper increments (as specified)
Reps ±1 · Weight ±5 lbs · Time ±10 sec · Distance ±0.1 mi. Press-and-hold repeats.

### Layout + visual rules (rounds 2–3, 2026-08-14)

**Rule 1 — the window never scrolls, and screens should not need to either.**
`html, body { overflow: hidden }` and `#app` is a fixed `100dvh` flex container. Every screen is
built by `screenShell({ top, scroll, bottom })`:

- `.topbar` — fixed
- `.pane-top` — fixed region under the header (name fields, primary actions, selectors)
- `.pane-scroll` — the flexible middle; it *only* gains a scrollbar when content genuinely
  overflows
- `.pane-bottom` — fixed footer (save/delete, submit)

Tim's instruction (round 3): **scrolling is a last resort, not a layout tool.** Prefer shrinking
and tightening until a screen fits. Inner scrolling is acceptable only for genuinely unbounded
lists — the exercise list in the builder, recent activity, search results.

Measured against an ~850px viewport, the session screen (the densest) comes to roughly 640px with
three sets, so it fits without scrolling.

**Rule 2 — no boxes.** Structure comes from hairline rules, spacing and type weight, never
nested bordered cards. `.card` is kept as a semantic grouping but draws nothing. `.list` uses
negative inline margins so hairlines run full-bleed while text stays on the gutter. Every removed
border was ~2px of height and one more thing between the reader and the number.

**Density decisions that bought the most space:**

- Steppers are a `repeat(auto-fit, minmax(148px, 1fr))` grid, so **weight and reps sit side by
  side** instead of stacked — roughly 140px saved on every session screen
- Cards → hairlines throughout (calendar, day detail, graph, set list, rows)
- Summary stats are a 4-across hairline grid, not four boxes
- Dropped the redundant "per side / total" line from the session head — the stepper's own label
  carries it
- Dropped the calendar hint line; folded into the legend

`#app` uses `flex-direction: column-reverse` on mobile so the nav (first DOM child) sits at the
bottom, and flips to `row` on desktop so the same element becomes a left sidebar.

**When adding a screen:** anything that must always be visible goes in `top` or `bottom`, and the
default assumption is that `scroll` will not scroll.

### Rule 3 — content first, controls in the leftover (round 5)

Tim's instruction: *"start with the most important thing and put it as big as you can, and then put
the selectors or whatever other things in the leftover space, not the opposite."*

Budget the screen for the content, then fit controls into what remains — never the reverse.
Applied so far:

- **The line chart is measured, not fixed.** `fillChart()` reads the container's real pixel size
  and draws the SVG at exactly that, via a `ResizeObserver` that also handles rotation. Gridline
  count and date-label density scale with the size. On a ~850px viewport the plot gets ~500px,
  against ~350px capped before.
- **`screenShell({ title })` accepts a DOM node**, so a screen can put its primary control in the
  header instead of a heading that repeats the nav label. Graphs puts the Over-time/Start-vs-now
  switch there; Calendar puts its legend there.
- Graph controls collapsed from three stacked rows to one `.control-row`.
- Bars use `clamp(13px, 2.4dvh, 24px)` so they thicken with the viewport instead of leaving dead
  space, and rows flex to share the height.

**The calendar is the deliberate exception** (round 4): months run as one continuous vertical
scroll with sticky per-month headings, opening scrolled to the current month. The range is at
least 12 months, extended back to the earliest recorded day.

### Chart colours (`css/app.css`, `--series-start` / `--series-now`)

The bar chart's two series are **not** the UI accent. They were validated against the data-viz
six checks in both themes before use:

| Theme | Start | Now | CVD ΔE | Normal ΔE | Contrast |
|---|---|---|---|---|---|
| Dark | `#3D8FC0` | `#C08430` | 19.6 | 23.2 | 5.3 / 5.9 |
| Light | `#2C7CB0` | `#96660F` | 20.7 | 22.1 | 4.1 / 4.5 |

Thresholds: OKLCH L in [0.48, 0.67] dark / [0.43, 0.77] light, chroma ≥ 0.10, CVD ΔE ≥ 8,
normal-vision ΔE ≥ 15, contrast ≥ 3:1. **Re-validate if these are ever changed** — do not
eyeball them. Bars also carry direct value labels and text tags, so identity is never
colour-alone.

### Load-type rules (`js/exercises.js`)

`loadTypeFor(name, equipment, fields)` returns `'per_side'`, `'total'`, or `null` (no weight
tracked). Derived from equipment, with two explicit override sets for cases equipment gets wrong:

- Dumbbell / kettlebell → per side; barbell / machine / plate → total
- `FORCE_PER_SIDE` — cable flys and crossovers (two stacks), single-arm work, carries
- `FORCE_TOTAL` — one implement held in two hands (goblet squat, KB swing, DB pullover),
  single-limb *machines* (single-leg press)

Recorded sets display as `50 lbs/side × 10` when per side. Tested: all 265 weighted exercises
have a load type, and the tricky cases are asserted individually.

### Verified
- All 9 JS modules pass syntax check
- **50 data-layer assertions pass** — run with `node tests/data-layer.test.mjs`. Covers load-type
  derivation, planned set counts, legacy-workout migration, prefill, set-count building from short
  history, line-series building, best-set-per-day collapsing, the ≥2-points graph rule, the
  benchmark-only comparison (including an explicit assertion that session data does **not** leak
  into it), same-day benchmark collapsing, month-range math, calendar indexing, and export/import
- Every class referenced in JS has a matching CSS rule
- All assets serve 200 over HTTP

### NOT yet verified
- **No browser run.** I cannot open a browser here, so the visual layout and touch
  interactions have not been seen working. Tim needs to click through it once.
- **Firebase adapter is written but never executed** — see `docs/firebase-setup.md`.

**Repo contents:**
```
Fitness_Tracker/
├── index.html                  ← entry point
├── manifest.webmanifest        ← PWA, installs to iPhone home screen
├── icon.svg
├── progress.md                 ← this file
├── chat.md                     ← conversation log
├── fitness_tracker.html        ← empty 0-byte leftover, safe to delete
├── css/
│   └── app.css                 ← all styling; mobile-first, desktop in one media query
├── js/
│   ├── app.js                  ← hash router + boot
│   ├── store.js                ← data layer, backend-agnostic async API
│   ├── exercises.js            ← 265-exercise library
│   ├── ui.js                   ← el(), icons, sheets, toasts, stepper, formatters
│   ├── views-workouts.js       ← home, workout list, builder, exercise picker
│   ├── views-session.js        ← session runner, benchmark form
│   ├── views-data.js           ← calendar, day detail, graphs, settings
│   ├── firebase-config.js      ← EMPTY placeholder for keys
│   └── firebase-backend.js     ← complete Firestore adapter, UNTESTED
└── docs/
    ├── spec.md
    ├── firebase-setup.md       ← what Tim must do in the Firebase console
    └── competitive-teardown.html
```

### Architecture notes for future sessions

- **No build step, no dependencies.** Plain ES modules. Serve the folder, it runs.
- **Everything goes through `store.js`.** Its API is async so the Firebase swap touches no
  view code — only the `BACKEND` constant at the top of that file.
- **Hash router** in `app.js`. Routes listed in `FULLSCREEN` hide the bottom nav.
- **The chart is hand-rolled SVG** in `views-data.js` — no charting library.

---

## 7. Next steps

1. **Tim clicks through the app on his iPhone** and reports what feels wrong. Nothing else should
   be built until the core loop has been used in a real gym at least once.
2. **Decide the GitHub repo** — the folder currently sits inside a repo pointed at
   `Estimator_Quiz`, which is wrong for this project. See §9.
3. **Firebase**, once Tim creates the project and pastes the config (`docs/firebase-setup.md`).
4. Then Tier 2: programs, progression rules, volume-per-muscle, block comparison.

### Known gaps (deliberate, not bugs)

- Sets are a flat list — no RIR, tempo, or set types yet, though `docs/spec.md` specifies them
  and the schema has room. Adding them is additive.
- No supersets.
- Weight is hard-coded to lbs in display. The unit setting exists in the store but is not wired
  to the UI yet.
- No rest timer. It's in the spec (P1) and belongs in the session runner, but Tim's described
  flow didn't call for it, so it was left out.
- On a very small phone in a 6-row month, the calendar card may still scroll inside
  `.pane-scroll`. That is the intended degradation — the inner box scrolls, never the page.

## 9. GitHub — done

`gh` is authenticated as **TimothyHadfield**.

**Resolved 2026-08-14.** The `Code Projects/` folder is itself a git repo whose remote points at
`Estimator_Quiz`, so committing there would have pushed this project into the wrong repository.
Tim chose a separate repo, so `Fitness_Tracker/` now has **its own nested git repo** with its own
remote. The parent repo simply sees the folder as untracked; the two do not interfere.

- Repo: https://github.com/TimothyHadfield/Fitness_Tracker (public)
- Pages: serving from `main` at root → https://timothyhadfield.github.io/Fitness_Tracker/
- Verified: all assets return 200 with correct MIME types (`application/javascript` on the
  modules, which is what ES module loading requires)

**Always run git commands from inside `Fitness_Tracker/`**, never from `Code Projects/`, or you
will be operating on the Estimator_Quiz repo instead.

---

## 8. Open questions for Tim

*(All previously open questions answered 2026-08-14 — see Audience under §2. None outstanding.)*

**Note for future sessions:** ask questions through the interactive question box, never in prose.
Only ask what genuinely can't be inferred — if a good recommendation exists, proceed on it.

### Resolved by Claude, not asked (leanings acted on)

- **Drop sets / myo-reps count as one hard set**, with the extensions logged but not double-counted
  toward weekly volume. Counting each extension would inflate volume totals and break the P2 target
  bands, which are defined in terms of hard sets.
- **Secondary-muscle weighting is fixed at 0.5** with an advanced override available. Making it
  configurable by default is exactly the jargon wall D8 exists to prevent.
