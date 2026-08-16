# Fitness Tracker — Progress & Context

> **Fresh session: read this entire file before doing anything.** It is written to be the only thing
> you need. `docs/` holds the detail; `chat.md` is a human-readable log you only need in order to
> answer "what did we say about X".

**Last updated:** 2026-08-16

**Status:** Live and working. **Tier 1 is complete.** Firebase is provisioned and verified end to
end. The app now works with **no network** (D6, finally real), records weights in **lbs or kg**, and
the body map ranks from **workout sets as well as benchmarks**. The body map is now **Tim's own illustration**, split into a recolourable fill
layer and an ink layer that carries every keyline, striation and shadow — so the four look-and-feel
gaps that were §9 are closed by construction. Screenshotted at 360/390/1180 in both themes.

**Open work:** **Tier 1 is complete.** Next is Tier 2, whose first move is the weighted
exercise→muscle mapping that D3 depends on.

| | |
|---|---|
| **Live app** | https://timothyhadfield.github.io/Fitness_Tracker/ |
| **Repo** | https://github.com/TimothyHadfield/Fitness_Tracker (public, Pages from `main` root) |
| **Run locally** | `python -m http.server 8765` from the project root → `http://127.0.0.1:8765` |
| **Data tests** | `node tests/data-layer.test.mjs` — 322 assertions, **no dependencies** |
| **Render tests** | `npm i jsdom` then `node tests/render.test.mjs` — 100 assertions, mounts every screen |
| **Rebuild the body art** | `python tools/build-body-art.py` — only if the source JPG or the seeds change. Needs `pip install pillow numpy scipy potracer` |
| **Look at it** | headless Chrome — §0.6. Use CDP + `Emulation.setDeviceMetricsOverride` for anything involving input |
| **Firebase** | project `fitness-tracker-th` · [console](https://console.firebase.google.com/project/fitness-tracker-th/overview) · `firebase deploy --only firestore:rules` |
| **Deploy** | commit + push to `main`; Pages rebuilds in ~40–50s |

It needs a server — ES modules do not load over `file://`.

---

## 0. Read this before your first tool call

1. **Git: this folder has its own nested repo.** The parent `Code Projects/` folder is a *separate*
   repo whose remote is `Estimator_Quiz`. **Always run git from inside `Fitness_Tracker/`**, or you
   will commit to the wrong repository.

2. **Don't `cd` outside the workspace in Bash.** Commands that leave the project directory trigger a
   scope check and prompt Tim. Use absolute paths from within the project. He has asked repeatedly
   not to be prompted.

3. **Keep `progress.md` and `chat.md` current without being asked, and push when done.** Tim's whole
   workflow is to reset the chat and say only *"catch up with progress.md"*. If this file is stale,
   the next session starts blind.

4. **The Firebase CLI is installed and already authenticated** as `timhadfield7@gmail.com`. You can
   create projects, deploy rules, and call the admin APIs directly. An access token can be minted
   from the CLI's stored refresh token — that is how Auth providers were configured. Don't assume
   console-only until you've checked.

5. **A browser HAS now rendered this app — headless Chrome, 2026-08-15.** Chrome and Edge are both
   installed on this machine, which changes what can be verified. See §0.6 for the recipe. Home,
   Workouts, Calendar, Settings and Muscles were screenshotted and eyeballed at 360 / 390 / 512 px in
   both themes: nothing overflows, nothing scrolls that shouldn't, the legend wraps. **Still
   unverified:** any real device, iOS Safari, touch, the installed PWA, and every screen not listed
   above. jsdom remains the *structural* check; a screenshot is the *visual* one. Be precise about
   which you mean.

6. **How to actually look at the app.** `--window-size` does NOT change the layout viewport in this
   headless build — it crops the screenshot of a 512px layout, which reads exactly like an overflow
   bug and cost half an hour. Two ways round it:

   - **`<iframe>` of fixed width, screenshot the wrapper.** Works with a plain `--screenshot` run.
   - **Better: drive Chrome over CDP and call `Emulation.setDeviceMetricsOverride`.** That *does*
     change the layout viewport, so no iframe is needed — point it straight at the app. Node 24 has
     a global `WebSocket`, so a CDP driver needs no dependencies: launch with
     `--headless=new --remote-debugging-port=N --user-data-dir=<ABSOLUTE path>`, then
     `Page.enable` → `Emulation.setDeviceMetricsOverride` → `Page.navigate` → `Page.captureScreenshot`.
     Two traps: the debugger attaches to a stray `about:blank` target, so always `Page.navigate`
     explicitly rather than passing the URL on the command line; and a relative `--user-data-dir`
     makes Chrome fail to start at all.

   **Use CDP whenever the thing you are checking involves input.** `dispatchEvent()` from page
   script does not reproduce focus, so it cannot show you a focus ring — that is exactly how the
   white box in the body map survived a screenshot review. `Input.dispatchMouseEvent` does.
   Hit-test before clicking, too: the centre of a muscle's *bounding box* can miss the muscle
   (Chest's lands in the sternum gap). Sample the box with `document.elementFromPoint` instead.

   Also: the app's real `firebase-config.js` makes boot await a gstatic import that never resolves
   without network, leaving `#app` empty — copy the app to a scratch dir and blank the config there.
   Never blank the real one.

7. **Testing offline: kill the server, do NOT emulate it.** `Network.emulateNetworkConditions` is
   applied **per target**, and a service worker is its own target — so its fetches sail straight past
   the page's emulated offline state. The first version of the offline test passed while the app was
   quietly still loading over the network. Start a throwaway `python -m http.server` on its own port,
   let the worker install, then kill the server. Nothing can fake that. Always include a canary —
   request a URL that cannot be cached and assert it fails — or you are testing nothing.

8. **Chrome's `--user-data-dir` must be a SHORT absolute path.** The session scratchpad is ~180
   characters deep; Chrome appends hashed `Service Worker/CacheStorage` directories under it, blows
   past Windows MAX_PATH, and `caches.open()` fails with "Unexpected internal error". That presents
   exactly as a broken service worker and is nothing of the sort. `C:/Users/timha/AppData/Local/Temp/cdp-<pid>`
   works. A *relative* user-data-dir makes Chrome fail to start at all.

---

## 1. Working agreement

Tim is the **manager**; Claude is the **builder**.

- Tim describes the vision. Claude designs and implements it.
- **Recommend and proceed — don't ask.** Tim, 2026-08-15: *"Just stick to what you recommend, it's
  going to be better than what I say 90% of the time."* Take that as licence to decide, **not** as
  licence to stop listening — he found the source-mixing bug, correctly diagnosed the level-flipping
  bug, and his percentile spacing held up under modelling. Say so when he is right.
- **Questions go in the AskUserQuestion box, never in prose.** Tim often doesn't read a full reply.
- **Keep replies short, conclusion first.**
- **Always commit and push when a piece of work is finished — don't ask.** Pages redeploys in ~40s,
  so pushing is how he sees anything. Update the docs in the same commit.
- **State what is unverified.** This project's whole credibility rests on not overclaiming.

### File upkeep

| File | Job |
|---|---|
| `progress.md` | State, decisions, rules, next steps. **The catch-up file.** |
| `chat.md` | Chronological human-readable log, appended after each substantive exchange |
| `docs/spec.md` | Product + technical spec, data model |
| `docs/research.md` | **All research, by category**, evidence graded 🟢🟡🔴 with sources. Append — never start a new research file |
| `docs/strength-map-plan.md` | Design + decisions for the Muscle Groups map. **§7 is where the fill/ink split is explained** |
| `docs/firebase-setup.md` | Firebase state and the one remaining console step |
| `docs/competitive-teardown.html` | Competitive research (published artifact) |

---

## 2. Vision & audience

A **lifting tracker**, web-based, genuinely better than a Google Sheet.

Tim's stated wants: log weight/reps/time for any exercise · track over time including body weight ·
lifting **programs** · enter data **mid-workout** · he cares a lot about **usability and formatting**
and about **scientific accuracy**.

**Minimum bar:** beats Google Sheets. **Stretch:** educate new lifters, ready-made programs.

### Audience (confirmed 2026-08-14)

- **Who:** Tim and friends to start, **open to anyone, potentially many people**
- **Level:** must serve **any level**
- **Goal:** **the user chooses** — hypertrophy, strength, or general fitness

A **product for other people**, not a personal tool. So: onboarding must work for a stranger,
progressive disclosure is core architecture, the dashboard reconfigures around the user's goal.

### Out of scope

**Diet / nutrition — cut** (D1). Point users at Cronometer's free tier.

---

## 3. Current state

| Area | State |
|---|---|
| Workout builder | Name, add exercises, reorder, planned set count, per-exercise notes, edit, delete |
| Exercise library | **265 exercises**, searchable, filterable by muscle group (15 groups incl. Full Body and Cardio; **13 are real muscles**) |
| Custom exercises | User-created; choose tracked fields and how weight is counted |
| Session runner | Builds planned sets, pre-fills last time's numbers, ±steppers, next/back, finish → calendar. **Records for today by default, and the day is editable in the header** for the workout you forgot to log. Future dates refused. The header says NOT TODAY the whole way through rather than springing it on you at the end |
| Load type | Every weighted exercise labelled **PER SIDE** or **TOTAL** |
| Draft recovery | In-progress workout survives an app switch; expires end of day. Expiry is keyed to `startedOn`, **not** the session's date, so back-dating a workout doesn't discard its own draft |
| Benchmarks | Any date, any exercise → feeds Data + calendar. A **workout can be marked a benchmark**, and then every exercise it records files the best set of that exercise as a benchmark for the day (D17) |
| Calendar | Continuous vertical month scroll, sticky headings, opens on current month; active days filled and named. Open a day → **Edit** a record to change anything about it: its day, its name, its exercises, every set, and whether it counts as benchmarks |
| **Data** (nav) | Three modes: **Graph** (measured SVG line + hover crosshair), **Bar Chart** (paired bars), **Muscles** (body map). Charts show **one source at a time**, benchmarks by default |
| Body weight | Charts through the Graph picker, in a **You** optgroup after the exercises, so it takes no fourth tab and is never the default. Needs two weigh-ins. Direction is **not** judged good or bad |
| Rest timer | Counts **up** from the last set, started by logging a number rather than by a button. Optional target (60/90/120/180s) that only then says the rest is over. Read from a timestamp every tick, never accumulated — a backgrounded tab throttles timers, which is exactly when it matters. Survives an app switch in the draft |
| Units | **lbs or kg**, a display choice only. Everything is STORED in pounds, so switching back and forth is lossless — asserted to the 1e-9 |
| Rep normalisation | Y-axis is always weight; every point converted to equivalent load at one rep count (D11). Target defaults to the most-recorded count, adjustable with arrows. Markers mean measured |
| **Muscles** | **Tim's illustration**, front + back, 18 tappable muscle paths covering 13 groups. Split into a **fill layer** (vector, recolourable, the tap target) and an **ink layer** (greyscale luminance mask carrying every keyline, fibre striation and shadow) — so recolouring a muscle cannot touch its texture. Head, hands, feet and knees have ink but no fill, so they stay unpainted. On a screen ≥ 860px the detail opens in a **side column beside the figures**, so picking a muscle never resizes the body; below that it stacks underneath. Each group filled by where its key lift ranks among **people who lift** at your weight, sex and age; grey with no benchmark. Tap → level, percentile, progress bar, all seven per-level weight targets. Selection is an accent outline following the muscle's own shape, and the browser's own focus ring is replaced — Chrome draws `outline:auto` around an SVG element's **bounding box**, which put a white rectangle around the selected muscle. |
| Profile | Gender, birth year, **body weight as a dated series**. Names what is still missing rather than failing silently |
| Accounts | Anonymous-first; email upgrade preserves uid *and* data; sign-in, password reset, change password, delete account, sign-out, local→cloud merge, automatic adoption of local data. Falls back to local storage if the cloud is unreachable |
| Profile button | True top-left — beside "Fitness Tracker" in the desktop sidebar, in the header on mobile, never both. Red dot when data is not backed up |
| Settings | Dark/light, **lbs/kg**, profile, account, export/restore backup, delete all |

**Stepper increments:** reps ±1 · weight **±5 lbs or ±2.5 kg** · time ±10 sec · distance ±0.1 mi.
Press-and-hold repeats.

### Verified

- All **16 JS modules** pass syntax check; the whole import graph resolves under a stub DOM
- **275 data-layer assertions** (`tests/data-layer.test.mjs`, no dependencies) — including both
  directions of the art↔standards invariant: every drawn muscle is rankable or declared unrankable,
  **and** every rankable muscle is actually drawn with real geometry. A regeneration that dropped a
  muscle group would otherwise fail silently on a screen nobody re-checks
- **49 render assertions** (`tests/render.test.mjs`, jsdom) — every screen mounts, tapping a muscle
  opens its detail, the SVG line chart genuinely runs (gridlines, one marker per measured point,
  correct aria label), and **every ink mask reference resolves to a mask in the same SVG**. That last
  one matters: if the mask or its image goes missing the figure renders as flat silhouettes with no
  detail at all, which is the one failure that would not look like a bug in a screenshot
- **Screenshots, headless Chrome** — Home, Workouts, Calendar, Settings, Muscles and the line chart
  at 360 / 390 / 880 / 1180 / 1280 px in dark and light. Layout holds, nothing overflows, the legend
  wraps, and the Muscles side column holds its figure size whether or not a muscle is selected. The
  new body map was re-shot at 360/390/1180 in both themes, selected and unselected
- Every class referenced in JS has a matching CSS rule
- All assets serve 200 with correct MIME types from Pages
- **Firebase, 45 checks against the live project.** `js/firebase-backend.js` itself was exercised —
  its gstatic imports redirected to a local SDK — not a lookalike: anonymous sign-in, read/write
  round-trip, `serverTimestamp()` satisfying the rules, anonymous→email linking preserving uid and
  data, sign-out, sign-back-in, password change, account deletion leaving no data, error mapping.
  Seven rule violations all refused. Test users and documents deleted; the project holds **zero users
  and zero documents**.

### NOT verified

- **No real device, and no iOS Safari.** Touch targets, the installed PWA, the Google popup/redirect
  branch, `adoptLocalData()` against real local data. Headless Chrome covers desktop-engine layout
  only — it says nothing about how a phone actually behaves in the hand.
- **Google sign-in** — not enabled in the console, so untested.

---

## 4. Architecture

**No build step, no dependencies in the app.** Plain ES modules. Serve the folder and it runs.
(jsdom is a *test-only* dependency and is not required for `data-layer.test.mjs`.)

```
Fitness_Tracker/
├── index.html · manifest.webmanifest · icon.svg
├── sw.js                       service worker — what makes D6 true. Precaches the
│                               shell; stale-while-revalidate, NOT cache-first
├── firestore.rules             THE thing protecting user data
├── firebase.json · .firebaserc  so `firebase deploy` needs no flags
├── progress.md  ← this file · chat.md · README.md
├── Human_Muscle_Groups.jpg     body-map source, Tim's own. GIT-IGNORED (*.jpg)
├── img/ink-front.webp          the body map's ink layer, ~100 KB each. GENERATED
│   └── ink-back.webp           the only binary assets in the app
├── tools/build-body-art.py     regenerates js/body-art.js + img/ink-*.webp from the
│                               JPG. Dev-only; needs pillow/numpy/scipy/potracer
├── css/app.css                 ALL styling. Mobile-first; desktop in one media query
├── js/
│   ├── views-edit-session.js   editing a workout already recorded
│   ├── units.js                lbs/kg. EVERYTHING IS STORED IN POUNDS; this converts
│   │                           only at the edges, so switching units is lossless
│   ├── app.js                  hash router + boot
│   ├── store.js                data layer — async, backend-agnostic
│   ├── e1rm.js                 rep normalisation — pure maths (D11)
│   ├── strength-standards.js   percentile ranking — pure maths (D15)
│   ├── body-art.js             GENERATED traced muscle paths — do not hand-edit
│   ├── body-map.js             composes the fill paths + the ink masks
│   ├── exercises.js            265-exercise library + load-type rules
│   ├── ui.js                   el(), icons, sheets, toasts, steppers, screenShell, profileButton
│   ├── views-workouts.js       home, workout list, builder, exercise picker
│   ├── views-session.js        session runner, benchmark form
│   ├── views-data.js           calendar, day detail, Data screen, settings
│   ├── views-muscles.js        the Muscles pane
│   ├── views-profile.js        gender, birth year, body weight
│   ├── views-account.js        account, sign-in, upgrade-from-anonymous
│   ├── firebase-config.js      REAL KEYS — project fitness-tracker-th, live
│   └── firebase-backend.js     Firestore + auth adapter
├── tests/
│   ├── data-layer.test.mjs     245 assertions, no dependencies
│   └── render.test.mjs         29 jsdom assertions — mounts every screen
└── docs/  spec.md · research.md · strength-map-plan.md · firebase-setup.md · competitive-teardown.html
```

### Key patterns

- **Everything goes through `store.js`.** Async API, so the backend swaps without touching views.
  `BACKEND = 'auto'` — cloud when `firebase-config.js` has keys, local otherwise, **and local as a
  fallback if the cloud fails** (D13).
- **Hash router** in `app.js`. Routes in `FULLSCREEN` hide the nav and take the `no-nav` class
  (which owes the iPhone safe-area padding).
- **`screenShell({ title, sub, back, actions, top, scroll, bottom, profile })`** builds every screen.
  `title` accepts a string *or a DOM node*, letting a screen put its primary control in the header.
- **Charts are hand-rolled.** SVG line chart in `views-data.js`; bar chart in HTML/CSS; body map in
  `body-map.js`. No charting library.
- **`el(tag, props, ...children)`** is the DOM builder. `class`, `text`, `html`, `dataset` and `onX`
  are special-cased; falsy children skipped.
- **Pure-maths modules are the pattern that works.** `e1rm.js` and `strength-standards.js` have no
  DOM or store dependency, so they are fully testable headlessly. Both caught real bugs that way.

### Data model

```
Exercise    id, name, muscle, equipment, fields[], loadType, isCustom
Workout     id, name, isBenchmark, exercises[{ exerciseId, sets, notes }], createdAt, updatedAt
Session     id, workoutId, workoutName, date, startedAt, finishedAt, isBenchmark,
            entries[{ exerciseId, exerciseName, sets[{weight,reps,time,distance}] }]
Benchmark   id, date, exerciseId, exerciseName, values{}, sourceSessionId?
            ── sourceSessionId set = DERIVED from a benchmark workout, and rebuilt
               from that session on every save. Absent = entered by hand, never touched.
BodyWeight  id, date, weight, createdAt          ← one row per weigh-in
Settings    id, units, theme, gender, birthYear  ← birth year, NEVER age
```

`normalizeWorkout()` in `store.js` migrates the old `exerciseIds[]` shape on read — keep it.

⚠️ **Adding a collection to `COLLECTIONS` also requires adding it to `knownCollection()` in
`firestore.rules` and redeploying**, or every cloud write to it is denied while localStorage keeps
working — invisible until someone signs in.

---

## 5. Design rules — binding

### Rule 1 — the window never scrolls, and screens shouldn't need to

`html, body { overflow: hidden }`; `#app` is a fixed `100dvh` flex container. Every screen is a fixed
header, an optional fixed `top`, one flexible `pane-scroll`, an optional fixed `bottom`.

**Scrolling is a last resort, not a layout tool.** Inner scrolling is acceptable only for genuinely
unbounded lists: the builder's exercise list, recent activity, search results, and the calendar.

`#app` is `column-reverse` on mobile so the nav sits at the bottom, and flips to `row` on desktop so
the same element becomes a left sidebar.

### Rule 2 — no boxes

Structure comes from hairline rules, spacing and type weight — never nested bordered cards. `.card`
survives as a semantic grouping but **draws nothing**.

The chart's hover readout is the test case: plain SVG text with a ground-coloured halo
(`paint-order: stroke`), not a boxed tooltip. Legible over gridlines, still no box.

### Rule 3 — content first, controls in the leftover

*"Start with the most important thing and put it as big as you can, then put the selectors in the
leftover space, not the opposite."*

The line chart is **measured, not fixed**: `fillChart()` reads the container's real pixel size and
draws at exactly that, with a `ResizeObserver`. Gridline and date-label density scale with size.

**Corollary — content must not shrink because you asked it a question.** Tapping a muscle used to
open the detail *below* the body map, which pushed the figures up and shrank them. On ≥ 860px the
panel is now a side column instead, so the body is the same size selected or not. Measured at 960px
the side layout gives a *larger* figure than stacking (395×433 vs 338×370): a column costs width
once, a stacked panel costs half the height.

### Rule 4 — never mix benchmarks with workout sets

A benchmark is a deliberate test taken fresh; a mid-workout set comes after everything else the
session did. Charting them as one line makes strength look like it swings wildly. **One source at a
time, benchmarks by default** (D14). The toggle appears only when an exercise has both.

Mixing also silently destroyed data — one point per day meant a day with both lost one reading.

### Rule 5 — a marker means measured

A circle means *you actually lifted this, at this rep count*. Estimates carry no marker. Bars mark
estimates with a diagonal hatch, not a fade — texture survives greyscale and colour-blindness.

General form: **never let an inference look like a measurement.** Anything derived must be visually
separable from anything recorded, by a cue that is not colour alone.

### Rule 6 — no unearned opinions

Change is coloured good or bad only where bigger is genuinely better. Time was already neutral (a
faster mile is better, a longer plank is better) and **body weight is neutral too** — gaining is the
goal for one user and losing it for the next, and nothing has ever asked which. `summaryStats()`
takes a `judged` flag for exactly this. The training goal that D10 will introduce is what would
eventually earn the app an opinion here.

### Colour — validate, never eyeball

**Before building any chart, load the `dataviz` skill and run its validator.**

*Series colours* (`--series-start` / `--series-now`), deliberately not the UI accent:

| Theme | Start | Now | CVD ΔE | Normal ΔE | Contrast |
|---|---|---|---|---|---|
| Dark | `#3D8FC0` | `#C08430` | 19.6 | 23.2 | 5.3 / 5.9 |
| Light | `#2C7CB0` | `#96660F` | 20.7 | 22.1 | 4.1 / 4.5 |

*Strength ramp* (`--lv-*`): strength level is **ordinal**, and it is now a **multi-hue** ramp —
seven steps sweeping ~250° of hue with **strictly monotone lightness**. Tim asked for bright, varied
colour (2026-08-15); monotone lightness is what keeps it a scale rather than a rainbow, and it is the
same construction viridis and plasma use. Generated in OKLCH at the gamut edge and validated in both
themes: monotone L, adjacent ΔL ≥ 0.06, light end clearing its surface — all pass. *Single hue*
fails by design, so the ramp was additionally stress-tested against the **categorical all-pairs**
checks the old one-hue ramp was never held to, and it beats it comfortably on normal vision
(worst ΔE 13.8 / 11.4 vs 8.0 / 6.9) while matching it under colour blindness. Both land in the CVD
floor band, which is legal only with secondary encoding — this screen always shows the legend and
names the level in text on tap. Dark is a *selected* ramp with the anchor flipped, not an inversion.
**Regenerate and re-validate; never hand-edit those hexes.** Bare `:root` is DARK in this stylesheet.

⚠️ The validator's *Single hue* check computes hue spread with a naive min/max that wraps: a ramp
crossing 0° can be reported as a 40° spread and PASS when it actually sweeps 250°. Don't read that
particular PASS as meaning anything.

### Load-type rules (`js/exercises.js`)

Dumbbell/kettlebell → per side; barbell/machine/plate → total. `FORCE_PER_SIDE` for two-stack cable
work, single-arm work and carries; `FORCE_TOTAL` for one implement in two hands and single-limb
*machines*. Displays as `50 lbs/side × 10`.

---

## 6. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| D1 | **No diet/nutrition.** Point at Cronometer. | Free nutrition apps aren't crippled — diet tracking is present-tense, so the history paywall doesn't bite. The food database can't be replicated. |
| D2 | **Lifting only.** | Focus. |
| D3 | **Weekly sets per muscle group is the headline metric.** | What hypertrophy responds to (~10–20 hard sets/muscle/week). Only Alpha Progression does it. **Not built — Tier 2, and blocked on the weighted muscle mapping.** |
| D4 | **Target = spreadsheet transparency + app ergonomics.** | Spreadsheets win on whole-block visibility, structural freedom, permanence. Apps only win the logging loop. Take both. |
| D5 | **e1RM must be rep-range honest.** Full confidence 2–10 reps, flag 11–15, don't normalise above 15. | Formulas degrade badly above ~10 reps. Built. |
| D6 | **Offline-first logging is non-negotiable.** | Gyms are basements. **Built 2026-08-16** — `sw.js` precaches the whole shell. Until then this was a claim, not a feature: store.js falls back to localStorage when the *cloud* fails, but with no signal the app never BOOTED, so that fallback never ran. Verified by killing the origin server, not by emulating offline — see §0.7. |
| D7 | **No social feed.** | Repeatedly unwanted in Hevy reviews. |
| D8 | **Teach at the moment of use**, never a manual or onboarding carousel. | RP Hypertrophy has the best science and worst delivery. |
| D9 | **Progressive disclosure is core architecture.** | Audience is "any level". Can't be bolted on later. |
| D10 | **Training goal is a user setting that reconfigures the dashboard.** | One fixed dashboard would be wrong for most users. |
| D11 | **Marzagão (2026) weight-dependent e1RM**, not Epley/Brzycki.<br>`1RM = w × (1 + (r−1)^0.85 / k(w))`<br>`k(w) = max(4.58, −2.55 + 4.58·ln(w_kg))` | The reps↔%1RM curve genuinely differs by exercise (Nuzzo 2024: exercise type is the *only* meaningful moderator). Classical formulas use one fixed factor for all 265 exercises. **⚠️ Our k-floor is 4.58, NOT the paper's 0.5** — below k = B the published curve *decreases* in weight, so a heavier lift would score lower and the inverse stops being unique. Asserted monotone across 1–400 lb. See `docs/research.md` §1. |
| D12 | **Accounts are anonymous-first**; upgrading *links* the account so uid and data carry over. | A signup wall on first open is the biggest killer of retention, and D8/D9 say no wall on day one. Cost: un-upgraded data lives in one browser — the UI states that plainly. |
| D13 | **`BACKEND = 'auto'`, and a cloud failure falls back to local storage.** | Losing signal must never stop someone logging a set (D6). Settings says "Not connected" rather than pretending to sync. |
| D14 | **Graphs never mix benchmarks with workout sets.** One source at a time, benchmarks by default. | Reported by Tim: a workout set sat far off his benchmark trend. Two more problems fell out — the shown point flipped between sources as the rep target changed, and one-point-per-day silently discarded the loser. |
| D15 | **Strength ranking is against people who lift and log, never "everyone".** Levels are lifter-based; a general-population figure is an optional extra line, never a re-tiering. | Competition data puts the general population below its own 50th percentile; general-population data would make every user Elite. The seven-level scale compresses into ~70–98 % of all adults. **The UI must say "of people who lift".** |
| D17 | **A benchmark workout's benchmarks are DERIVED from its session, not written alongside it.** Each carries `sourceSessionId` and the whole set is rebuilt on every save. | The alternative — write benchmarks once at finish — strands them the moment the record is edited. Move the workout to another day and its benchmarks stay on the old one; delete an exercise and its benchmark lives on; untick the flag and nothing undoes it. Rebuilding makes all four correct by construction instead of by remembering. Hand-entered benchmarks have no `sourceSessionId` and are never touched. |
| D16 | **Deadlift fills Glutes** on the muscle map. | It belongs to glutes, hamstrings and back at once. Hip-thrust standards are the thinnest of the three. Revisit with the weighted mapping. |

### Standing recommendations

- **R1 — Web app (PWA), not native.** Home-screen install, offline, zero distribution cost.
- ~~**R2 — Local-first, no accounts.**~~ Superseded 2026-08-15; local-first survives as the *fallback* (D13).
- **R3 — Ship Tier 1 before anything else.**

### Resolved without asking

- Drop sets / myo-reps count as **one** hard set — else volume totals inflate.
- Secondary-muscle weighting fixed at **0.5** with an advanced override.
- **Sets exist in the session runner** — an app that can't log 3×8 would be useless.
- **Bar chart requires 2+ benchmarks**; excluded ones surface as a visible count.

---

## 7. Research

**All research lives in `docs/research.md`**, graded 🟢🟡🔴 with sources. Sections: e1RM /
rep-normalisation · reps↔%1RM · proximity to failure · fatigue & rest · velocity-based training ·
volume & the rep continuum · competitive landscape · data-viz colour · unverified claims ·
strength standards & percentiles.

Competitive teardown: `docs/competitive-teardown.html`. Analysed Strong, Hevy, Boostcamp, Liftosaur,
Alpha Progression, RP Hypertrophy, Fitbod.

**Five failures shared by all:** data goes in but insight doesn't come out; offline is an
afterthought; analysis is per-exercise not per-muscle; the jargon wall; you can't answer "is this
working?"

**The gap being built into:** four of five commercial apps monetise by restricting access to your own
accumulated data (Hevy caps free graph history at 3 months).

**Note:** Fitbod published the D11 formula from its own data. If they ship it in-product it stops
being a differentiator.

---

## 8. Roadmap

**Tier 1 — beat the spreadsheet.** **Done.**

**Tier 2 — programs and analysis**
- Program builder (desktop) → execution (mobile)
- Progression rules: linear + double progression first
- Weekly volume per muscle group vs target bands (D3) — **blocked on the weighted muscle mapping**
- Block summary + block-over-block comparison
- Stall detection (e1RM flat 3+ weeks → flag and explain)

**Tier 3 — teach and guide**
- A small set of well-explained starter programs, not thousands
- Just-in-time concept explanations wired to first use (D8)
- Post-session check-in feeding next week's volume
- Deload prompting; equipment-aware substitution

---

## 9. Known gaps — deliberate, not bugs

- **Body weight is charted but not yet wired into rep normalisation** for the 14 bodyweight/assisted
  exercises. Their logged weight is added or assisted load, not total resistance — which is now
  computable. `canNormalize()` in `e1rm.js` still refuses them.
- ~~**The Muscles figure's look is not signed off.**~~ **Closed 2026-08-16.** All four gaps — heavy
  keylines, dense striations, unpainted head/hands/feet/knees, heroic proportions — came in with
  Tim's illustration and are satisfied by construction rather than by drawing code: the ink layer
  *is* the keylines and striations, and unpainted parts are simply parts with no fill. Nothing about
  the figure's look is authored in this repo any more, so there is no styling knob to keep in sync.

- ~~**Muscles uses benchmarks only.**~~ **Closed 2026-08-16** — it now ranks from workout sets too,
  best estimate wins, and the panel names the source. Not a breach of D14: that rule is about
  charting a TREND (two sources on one line, one point per day discarding the loser); a single best
  estimate has neither problem. Still limited to each muscle's ONE key lift — someone who only
  dumbbell-benches still gets nothing for Chest, which needs cross-exercise equivalence to fix. **Core, Neck and Cardio can never be ranked** — no published standards exist; the UI says so.
  Core is drawn (abs + obliques) so the figure looks right, but it always renders as No data.
- **Percentile placement leans on the e1RM formula being *absolutely* accurate**, which
  `docs/research.md` §1.3 says was never validated — it was optimised for *internal consistency*.
  Harmless for rep normalisation, a stronger claim here. Mitigated by preferring ≤5-rep benchmarks
  and flagging levels derived from high-rep sets.
- **Google sign-in inside the installed PWA is the riskiest untested path.** Popups are blocked in an
  iOS home-screen app, so the code falls back to `signInWithRedirect`, which depends on third-party
  cookies while the auth domain differs from the origin. Fallbacks: email/password in the PWA, or a
  custom domain with `authDomain` on a subdomain of it.
- **Rep normalisation assumes near-failure effort.** Every rep-based formula does. Bias is systematic
  per user per exercise, so trend and ordering survive. There is no RIR/RPE field — deliberate (D9).
- **No supersets.** Sets are a flat list — no RIR, tempo, or set types.
- ~~**Weight display is hard-coded to lbs.**~~ **Closed 2026-08-16.** lbs/kg in Settings, stored
  canonically in pounds. Distance is still miles only.
- **Exercise→muscle is a single string**, not the primary/secondary weighted mapping. **This must
  change before D3.**

---

## 10. Next steps

1. **Tim opens the app on his phone.** Still the biggest remaining risk, but a smaller one than it
   was: the layout has now been seen at phone widths in Chrome (§0.5). What a screenshot cannot tell
   us is touch — tap target sizes on the body map, press-and-hold on the steppers, scroll feel — plus
   iOS Safari and the installed PWA.
2. **Google sign-in** — one console toggle: Authentication → Sign-in method → Google → Enable, pick a
   support email. It needs an OAuth client the API cannot create. Nothing is blocked on it; email and
   anonymous both work.
3. **Wire body weight into rep normalisation** for bodyweight/assisted exercises.
4. **Tier 2**, starting with the exercise→muscle mapping change that D3 depends on.

### Open questions for Tim

**None outstanding.**

One to raise if the Muscles map gets used in anger: whether to expose **raw e1RM** as a chart mode
alongside normalised equivalent load. Lean is no — normalised load keeps numbers in units the user
recognises.

Also noticed while screenshotting, unrelated and **pre-existing at `868fdb0`**: the Data screen's
mode switch wraps "Bar Chart" onto two lines at every width tested, desktop included. It doesn't
overflow, it just looks broken. Not touched — it is nothing to do with the body map.
