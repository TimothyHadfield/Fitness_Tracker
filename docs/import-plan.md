# Lifting-history import (O-19) — plan, 2026-09-27

Tim: *"Think of all the different scenarios of how that system might being used, and how it might need an
addition to fit a specific scenario... Make your own executive decisions."* Scenario: somebody switching from
Strong, Hevy or a spreadsheet arrives with years of sets, and the strength map starts from zero.

**Where:** the existing Import screen (`#/import`, Account › Import from a file). One "Choose a CSV file"
button; a file with an exercise column and reps/weight is read as lifting history, anything else goes the old
activities/weigh-ins way. The intro start screen gets a small **"Bring my history"** link beside "I already
have an account" (a 5th button breaks the 4-paths test and the no-scroll start screen).

## Formats (headers looked up 2026-09-27, matched by normalised name)
| Source | Header (one row per set) | Notes |
|---|---|---|
| Strong (classic) | `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE` | Date `2020-12-30 18:51:52`; bare `Weight` = the app's unit → **asked** |
| Strong 6.x | `"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"` | **semicolons**, maybe decimal commas; unit in the header |
| Hevy | `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg\|weight_lbs,reps,distance_km\|distance_miles,duration_seconds,rpe` | `start_time` `10 Jun 2024, 08:15` or ISO; `set_type` normal/warmup/dropset/failure |
| Generic | `date, exercise, weight, reps` + optional `set`, `unit`, `workout`, `rpe` | a `unit` column per row (kg/lb) wins over the header |

Sources: Strong sample export (github AlexandrosKyriakakis/StrongAppAnalytics), Strong 6.2.4 header (openGym
issue #302), Hevy columns (griptapp.com, openweight.dev), help.strongapp.io export steps.

## Reading rules
- **One workout** = same date cell (with its time) + same workout name. Sets group per exercise in file order.
- **Set kinds:** Strong Set Order `W` / Hevy `warmup` → `entry.warmups` (never rated); `D` / `dropset` →
  a `minis` row on the set before it (D23); `F`/`failure`/numbers → a normal set. Strong's "Rest Timer" rows skip.
- **Dates:** ISO, `yyyy/mm/dd`, "10 Jun 2024", slash dates settled from the whole column, else asked (existing
  Day/Month question). **RPE is ignored** (D28: no effort field).
- **Units:** stored in pounds like everything else. kg/lb from the header (`Weight (kg)`, `weight_lbs`) or a
  `unit` column; a bare `Weight` is **asked** (Pounds / Kilograms), never guessed. Distance only when its
  unit is known. Decimal commas read right in semicolon files.
- **Sanity:** reps 1–200, weight 0–1500 lb; negative weight only on Assisted lifts (read as the assistance).

## Exercise names → app ids
No alias matching existed beyond the picker's search. New matcher in `js/lift-import.js`, against
`store.getExercises()` (library + the person's custom ones):
1. exact name; 2. a short alias table for the common Strong/Hevy names ("Squat (Barbell)" → Back Squat,
"Bicep Curl (Dumbbell)" → Dumbbell Curl …); 3. same word set: name + "(equipment)" against a library name, or
name + equipment; 4. the bare name when only one library exercise has it. Two hits = unmatched, never a guess.
**Unmatched names get a pick-list** (native select, default Skip). Skipped names are counted in the preview.

## Duplicates
Each workout's id is `importId('lift', [date, time, workout name])` — no file name, so re-importing the same
or an overlapping export upserts the same ids; the preview counts them as "already imported" and adds 0.

## Size and writes
- Refuse files over 20 MB; keep the newest **5000 workouts** (≈ 20 years at 5/week) and say so.
- Written with the existing `store.importRows('sessions', rows)`: one read, one merge, one write; the
  Firestore adapter batches 500 per commit. 5000 docs is under the free 20k writes/day. **No store change.**
- Sessions carry no `workoutId` (like the quick log) and `importedFrom`, so a future "undo import" can find them.
- **Demo:** the demo's MemoryBackend keeps it in memory only; nothing reaches localStorage or Firestore (tested).

## Preview (one screen)
`312 workouts, 14 exercises, 3 unmatched` · pick-lists for the unmatched · `Import 312 workouts`.
