# Overhaul plan (2026-09-27)

Tim's ask (verbatim): "could you do another in-depth analysis on how systems and estimates are calculated, how the cite has the user interacts with it, where nicer design features (glassy textures, different fonts or displays, colors, and textures can be implemented in across the cite, the intro setting that guides the user and how different user's might view it or what might be missing in it, and all the wordy sections in the cite and reducing how much it says or putting it inside a question mark. If I missed any categories, then add that to the list of things to deeply analyze. Think of all the different scenarios of how that system might be being used, and how it might need an addition to fit a specific scenario. If it just comes down to preference, maybe add it to the settings menu and make the default the most smooth and best. Make your own executive decisions on every single aspect so that it really fits well. Review what I've said previously about display and what to show, especially about words and descriptions. Deploy many many sub-agents ... Make your own executive decisions ... You have permission for every single aspect."

Status: **wave 1 building.** The analyst reports (read-only, with measurements) live in the session scratchpad `overhaul/`:
- estimates.md (E-, EA-, EB-)
- systems.md (S-01…S-15)
- interaction.md (I-)
- design.md
- onboarding.md (O-)
- words.md (W-)
- settings.md (S-1…S-17, shown here as ST-)
- robustness.md (R-)
- screens.md (S-1…S-17, shown here as SC-)

## Manager decisions where the analysts disagreed
- **Adding a preset does NOT make it current** (Tim, 2026-09-27). Systems S-14 is rejected.
- **Auto-guide:** remember the last runner view silently (`settings.runnerView`). No new switch.
- **Weight steps:** chips (lbs 2.5 · 5; kg 1 · 1.25 · 2.5) instead of a "Small plates" switch.
- **Empty workout:** one row, "Empty workout", on the Start picker. It saves a session with no `workoutId`, with no extra switch.
- **Text size (R-12):** parked. Tim deferred accessibility on 2026-09-17.
- **Tap areas (R-5/I-7):** ARE built, because they are invisible hit-slop on the logging path.
- **Onboarding "About you" (gender, birth year, weight, units):** built, optional, and skippable. Without it every woman is ranked on male standards. The wording is flagged to Tim.
- **Tour trimmed to 5 stops.** One Skip ends the whole intro.
- **Push notifications:** not built (needs a paid plan).
- **Two-device merge (R-14):** wave 3, only with emulator tests.
- **Age grading:** use the app's own cited Harbo data (E-4).
- **"Stand-ins capped at Fair":** built, as Tim approved on 2026-09-14. GOLDEN confidence moves, and that is expected.

## Shared contracts (agreed names, so parallel builders fit together)
- `ui.js`:
  - `toast(msg, { error, action: { label, run } })`. An error toast stays 6 s with role=alert. An action toast lasts 5 s.
  - `friendlyError(err)` returns a short plain sentence.
  - `emptyState(title, text, action, { help })`: the optional ? text.
  - `arrivedByLink()`.
- `units.js`:
  - `setWeightPrefs(settings)` is seeded at boot by app.js and after any settings save.
  - `weightStep()` reads the step. `plateInventory(unit)` reads the bar and plates (it lives in plates.js, imported from units).
- **Settings keys** (every one defaults by absence to today's behaviour; always write through `store.saveSettings`):

  | Key | Meaning |
  |---|---|
  | `weightStep: {lbs, kg}` | Weight steps |
  | `plates: {lbs:{bar,have:[]}, kg:{bar,have:[]}}` | Bar and plates owned |
  | `autoWarmups` | `!== false` means on |
  | `setHints` | `!== false` means on |
  | `keepAwake` | `!== false` means on |
  | `runnerView: 'guide'\|'list'` | Last runner view |
  | `theme: 'dark'\|'light'\|'auto'` | Theme |
  | `intro: {...}` | Onboarding answers |
  | `glass` | `!== false` means on; app.js sets `<html data-glass="off">` when off |
- **Session fields** (`normalizeSession`): `deload: true` and `gym` (exists). **Rep spec:** `{lo, hi, plus}`.
- **store.js:**
  - `store.updateWorkoutExercises(workoutId, exercises)` handles the "Update <Workout> with today's changes" action.
  - `firebase-backend.clearAllShardCaches()`.
- **New files:**
  - `js/wake-lock.js`, built by the runner builder.
  - `js/first-save.js`, built by the onboarding builder.

  The store builder adds both to the sw.js SHELL.
- **tour.js:** `hintOnce(key, selector, text)`.
- **CSS:** wave-1 builders do NOT edit css/app.css. They list the classes they need in their report, and the wave-2 CSS builder lands them.

## Wave 1: file owners (parallel, disjoint files)
| builder | owns (only these) | items |
|---|---|---|
| MAP | muscle-evidence.js, strength-standards.js, docs/research.md §16.9 line, tests/data-layer (GOLDEN + age asserts), tests/bodyweight | E-1, EB-4, E-7, E-2 (GOLDEN re-baseline), E-3b + sessionCount, E-9, E-4, W strings in muscle-evidence |
| PROG | progression.js, set-reps.js, set-targets.js, rep-decrement.js, optimal.js, schedule.js, goals.js, tests/goals + progression tests | EA-2, EA-4, EA-8, EA-9, EA-3 (progression half), `range` arg, EA-6, EA-7, EA-10, S-10, S-08b, S-09 skip, EA-12, W P2 strings in goals/progression |
| BESTS | personal-bests.js, compare.js, profile-records.js, profile-ranking.js, exercise-estimate.js, exercises.js, machine-mechanics.js | EA-3 quarantine, EB-6 (non-store), EB-9, EB-11, EB-3, EB-7, EB-8, W P8 compare strings |
| STORE | store.js, firebase-backend.js, sw.js | R-1, R-2 (clearAllShardCaches), R-9, R-8a memo, EB-5, EB-6 store parts, EB-13, normalizeSession deload/plus, updateWorkoutExercises, persist(), SHELL entries |
| RUNNER-1 | views-session.js, guide-mode.js, session-draft.js, wake-lock.js (new) | I-1, I-2, I-3, I-4, I-10, I-20, R-2 draft + line, R-4/I-5 undo, ST-6, ST-7, ST-8/R-6, ST-15, E-8, EA-5, EB-10, W P7 strings |
| SHELL | ui.js, app.js, gestures.js, index.html, manifest.webmanifest | R-7, I-5 toast action, words emptyState help, I-8a/b, R-10, R-18, ST-10/I-19 theme Auto, ST-9 first-run units, setWeightPrefs seed, O-9 app side, O-16, I-13 lazy imports + modulepreload, R-8c boot skeleton, R-3 persist, W P6 ui/app strings |
| WEIGHTS | units.js, plates.js, warmup.js, tests/plates-visual + a new tests/weight-prefs | ST-4, ST-5 (DP for custom inventories only) |
| DATA | views-data.js | ST-2a, ST-11 regroup (Look · Weights · Workout · Data · Help), ST-12, ST-14, ST-16, new rows (Weight steps, Plates sheet, Auto warm-ups, Set hints, Keep screen on, Theme Auto), the friends switches move out, O-12 Help rows, SC-4, SC-11, SC-12, W P1 |
| WORKOUTS | views-workouts.js, next-workout.js, workout-card.js | S-01, S-02, S-04, S-05c/d, S-11, I-9, I-6 (builder guard), I-14, I-17 Workouts, SC-7, SC-8, I-16 card, Empty workout row (S-03/O-18, runner side in wave 2), W P3 |
| PRESETS | preset-systems.js, program-builder.js, template-lint.js, tests/program-builder (new) | S-05a/b, S-15, O-5, O-6, O-8 |
| ME | views-me.js, profile-shape.js, views-profile.js, views-account.js | E-5, EB-2, EB-12 labels, SC-1, SC-5, SC-7 (paging), I-16 me, ST-1, ST-2b, ST-3, ST-13, O-12 (Account side), R-13, R-3 hint, R-1c copy, W P6 me/account |
| GOALS | views-goals.js | SC-2, I-11, W P2 view strings |
| SOCIAL | views-social.js, social.js, views-muscles.js | SC-3, SC-9, SC-10, O-15, E-3a, ST-14 (export sheet opener), W P4, W P5 |
| INTRO | onboarding.js, tour.js, first-save.js (new) | O-1, O-2, O-3, O-4, O-7, O-9, O-10, O-11 (hintOnce), O-13, O-17, O-22 |
| EDIT | views-edit-session.js, views-import.js, routine-from-session.js | I-6 edit guard, W P8 |

**Test files:** a builder edits only the tests its own change breaks. Before editing any test file, it claims it by writing `scratchpad/overhaul/claims/<file>.txt`. If another builder already holds the claim, it writes the needed change into its report instead.

## Wave 2
- **RUNNER-2** (views-session.js):
  - EA-1 prefill, using PROG's `range`.
  - S-06, S-07, S-08a, S-09 switch, S-13.
  - The Empty workout runner side.
  - The O-11 and O-13 hooks.
  - friendlyError call sites.
- **CSS** (css/app.css, plus index.html/sw.js for fonts): design.md, R-5/I-7 hit areas, R-11, and every class wave 1 asked for.
- **DATA-2:** the Data header back arrow (I-8).
- **IMPORT:** a lifting-history CSV import (O-19).
- **TESTS:** a sitewide word-cap test.

## Wave 3
- R-14: two-device merge, with emulator tests.

## Must not change
- The locked decisions: D5, D6, D11, D13, D14, D21, D22, D23, D28, D29, D30, D33.
- Untouched plan numbers count.
- The plan never drives the suggestion.
- The 2.0× quarantine.
- GOLDEN, except E-2's confidence.
- The rest timer stays as it is.
- Home rules: no workout starting, no own workouts.
- The friend back rule.
- `.set-del` stays deliberately small.
- Body-map targets are Tim's (0i).
- Research carve-out.
- preset text hash.
- Rule 7 motion ≤250 ms.
- Rule 9: the ? says WHY and is placed right beside its text.
- Settings writes go through the queue.
- Stay out of Fitness_Research/ and Claude Data/. Never write to live Firestore. Wesley's account is real.
