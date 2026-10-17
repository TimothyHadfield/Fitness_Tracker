# progress.md blocks moved out on 2026-10-17 (evening checkpoint, file was 43 KB > 40 KB cap)

Verbatim from progress.md → Status and → Authorized next steps, as they stood after the five audit
builders merged (main fd8e47e).

## From Status

**Sweep 2026-10-16 (laptop-ops bug sweep, `tests/sweep-1016.test.mjs`):** 9 defects fixed (fractional
"13.33 days", stand-in select carry-over, custom exercise missing from the picker's map, deleted
legacy drops returning, docs/404 page cached as the offline shell, quick second tab tap dropped,
display-name save leaving #/add, offline 'online' listener never removed, equipment toast rule);
CLAUDE.md added. Then d25fab3 (Tim: "Fix all three"): rules `realUser()`, kudos id pinned, deleted
workouts stay deleted (`users/{uid}/adoptions/*` marker).

**Motion pass 2 (2026-09-25 night): done, live 7cc8d43.** Springs (`js/spring.js`), push/back slides,
edge swipe, tab line and pulls (`js/gestures.js`), sheet drag, photo viewer, chart draw-in, laptop
two-pane layouts, 2 additions (goal bar on Profile, tappable strongest/weakest). Choices Tim hasn't
seen + NOT verified: `docs/motion2-plan.md`; 8 more addition ideas await him in `docs/additions-ideas.md`.

**Whole-app review 2026-09-24: done.** Tim said *"you just choose what to do"* for all 42; Claude built
40 (a7f1bf3, a791c9a, 81fada0) and skipped c-icons and c-levelcolours — never re-raise those. New UI
words: the body form is **"Body details"**, the field is **"gender"**, and **"program"** (US) replaces
system/programme in UI text (code identifiers, routes and the hash-guarded preset notes are unchanged).
CSS now has 5 font-size tokens / 3 weights; use them, not new px values. Choices Tim hasn't seen are in
chat.md 2026-09-24 entries.

**Fixed 2026-09-23 (Autumn's feedback, 889e005):** the runner's subtitle is a **workout clock — tap
to pause/resume** (`pausedAt`/`pausedMs` on the draft, `activeSeconds()` in session-draft.js, the
mini bar reads the same); the save screen's **Duration is an editable minutes box**, and save writes
`finishedAt = startedAt + that`. Picking anyone in the Compare sheet now closes it.
**Fixed 2026-09-23:** `ensureSystems()` adopts orphans into the first system WITHOUT a `presetId`
(or a new "My Workouts"), never into a programme copied from Explore.

## From Authorized next steps

- **2026-09-28: nothing open.** Brother's sign-in bug ("Could you check it out and fix whatever
  problems you think might be happening?") and the log-in investigation are DONE and live (49fb4da).
  The sign-in items in the Waiting table (row "si") are NOT authorized.
- **2026-09-27 overhaul — authorized in full, Claude decides every aspect** (Tim, verbatim: "Make your
  own executive decisions on every single aspect so that it really fits well… Deploy many many
  sub-agents… Don't stop working for any reason… You have permission for every single aspect").
  Waves, owners and decisions: `docs/overhaul-plan.md`. **DONE and live through 0668e46** (5 waves);
  the choices he hasn't seen were reported to him. Nothing further authorized from it.
- **2026-09-27 evening: ALL DONE and live** — 16 machine ratios reworked (7 left with reasons), warm-ups
  in history/day/edit, labelled 48px plates + aligned numbers + wording cut, group Finished hands over
  to the next person, and **Auto-guide** (`js/guide-steps.js` order, `js/guide-mode.js` view; toggle
  "Auto-guide"/"Edit" in the runner top bar; `draft.view = 'guide'`). Choices Tim hasn't seen: guide
  labels "Next: <name>", warm-ups alternate people too, a pre-filled number counts on Next, no slide
  between steps, the "Dynamic stretch" line and %-of-max caption are not in the guide, drop sets need
  Edit. Meadows row / landmine press probably over-credited (bar added before one-arm doubling in
  strength-observations.js) — flagged, not fixed.
- **Nothing open.** 2026-09-26 (after his joint legs workout) all 4 DONE and live: compare reshare
  389bd52, plate drawing 14e0ae1, glutes ab0505c, auto warm-ups a37bd57 — see
  chat.md 2026-09-26. Item 35 was REOPENED at Tim's word and is now fixed for Glutes only.
- Every authorization through 2026-09-25 is DONE: motion pass 2 (2026-09-25 night,
  live 7cc8d43) and the 2026-09-23 set (Finished/Edit, warm-ups, logging notes, typo warning, smooth
  fade, "at least X", blend every set, level-aware ratios). Their verbatim quotes are in
  `docs/archive/progress-2026-09-25.md` → "Authorized next steps".
