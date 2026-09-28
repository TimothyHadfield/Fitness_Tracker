# Fitness Tracker — progress (handoff for Claude)

## START HERE
_Last updated 2026-09-27 late: **OVERHAUL in progress** (Tim: analyse estimates, interaction, design,
intro, words, scenarios; "Deploy many many sub-agents… Don't stop working"). Plan + contracts + owners:
`docs/overhaul-plan.md`. Wave 1 live 69cd88d, wave 2 live 88353d8/bc07d2c/1eb1545; wave 3 running
(two-device merge, sitewide word cap, deploy-notice test, code review, visual QA). Earlier: 2026-09-25 night, checkpoint (motion pass 2 DONE and live through 7cc8d43 —
`docs/motion2-plan.md`; addition ideas waiting on Tim in `docs/additions-ideas.md`; previous version of
this file: `docs/archive/progress-2026-09-25.md`). Before that 2026-09-24 (whole-app review: 39 bugs fixed; Tim delegated the 42 picks to Claude —
40 built and live through 81fada0, 2 skipped; picks page
https://claude.ai/artifact/HiHY1QBrwm3dVQkK9DHy73, see chat.md 2026-09-24 second half). Older note: the
headings are a SESSION sequence, not the calendar (the previous session is labelled 2026-09-27 and the
system clock now reads 2026-09-22). Read `chat.md` bottom-up when the dates disagree; git is the
tie-breaker. For Claude only; Tim doesn't read this.
**Catch-up authorizes nothing**: only "Authorized next steps" below is approved work._
1. Read this file (short on purpose — the full pre-2026-09-27 version, every essay and dated summary,
   is `docs/archive/progress-2026-09-27.md`; grep it, don't read it whole).
2. Read `docs/direction.md` — Tim's interview; **it overrules the handbook** where they disagree.
3. Read `docs/handbook.md` (how to work: §0 traps, §1 agreement, §4 file map, §5 design rules, §6
   locked decisions D1–D33, §9 known gaps) and `docs/state.md` (what every screen does today).
   **Every `§N` means the handbook, except `§3`, which is `docs/state.md`.**
Dated write-ups: `docs/history.md` (newest first, ~800 KB — grep the date, read that range).
Chat log: `chat.md` (from 2026-09-15; older in `docs/chat-archive.md`).

## Goal right now
A real product for strangers, headed for the Apple App Store "in the next few months", free, as big
as the biggest lifting apps. Tim drives the design screen by screen; right now that means fixing what
he hits in real training and building what he names (lately Home/notifications and comparison).

## Status

**Live and working** (details per screen in `docs/state.md`): logging runner with set types,
Finished/Edit per set, warm-up sets, how-to-count notes, a live typo warning, per-person joint workouts, rep prescriptions and % targets · programmes (current system,
presets from Explore with update tracking, weekly/cycle plan boxes, restore for an empty copy) ·
Data (muscle map with 13 ranked groups incl. Calves/Neck/Core, Volume, Graph, Bars, Research) ·
Profile (`#/me`: best lifts, body, goal, calendar, workouts as feed cards) · friends feed with
kudos/comments, tappable "On your workouts" strip · friend profiles and the compare-bodies screen,
now also against **50 famous lifters** (221 lifts; Seid, Eubank, Togi added 2026-09-22) · Goals · accounts (anonymous-first, Google, delete) · offline
PWA with deploy notice · a temporary note-to-the-developer inbox (`#/notes`, take it out when the
first users stop being new).

**Waiting on Tim** — numbered as the code comments cite them; never renumber:

| # | What | Needs from Tim |
|---|---|---|
| 1 | ✅ closed 2026-09-23 (28a0b94) — the quarantine stays; the runner now WARNS live: weight ≥ 1.5× the estimated max shows "N× your estimated max — typo?" in red under the weight (`TYPO_WARN_RATIO`, views-session.js) | — |
| 2 | ✅ closed 2026-09-23 (40da5bc) — `fadedPast()` in rateMuscle: each exercise's pooled value is floored by its own replay a0 days ago × 0.98^(a0/7) (estimateAt's fall limit). Demo: worst one-day layoff drop 3.7 % → 1.7 % (Shoulders; blend-weight shifts, not per-exercise), ≤0.3 % elsewhere; golden Hamstrings +0.4 %, Quads +0.1 %. No hysteresis | — |
| 3 | ✅ closed 2026-09-23 — wired: own rated panel shows "Trained today — a reading today usually comes in a little low." (never on a friend's) | — |
| 4 | ✅ closed 2026-09-23 — the unreachable 15-rep caption and its ? are deleted | — |
| 5 | ✅ closed 2026-09-23 — Goals % is derived from the start/target on screen (`gainPct` only a fallback); the ambition name stays frozen, so "Steady +11%" can read | — |
| 6 | An ordinary lifter flaps MORE than one on a level boundary (0.75 vs 0.19), contrary to the comment | an answer, not a fix |
| 7 | ✅ closed 2026-09-23 — a plan set carries `fromPlan`; `setIsRecorded()` (session-draft.js) counts it untouched, so save, save-screen count and discard warnings agree. Opening another workout over an untouched plan draft now asks first | — |
| 8 | Benchmark workouts in a separate programme no longer appear on Record; the switcher has no "look without switching" | his word |
| 9 | ✅ closed 2026-09-23 (6ad7b6c) — `atLeastOf()` → `rating.atLeast` → store → panel note "Estimated 1-rep max in X · at least N lbs". Best recent (≤84 d) listed set × e^(−2·readingSigma); hidden unless it rounds below the estimate. Estimate itself unchanged | — |
| 10 | ✅ closed 2026-09-23 (f29164f) — every exercise pools its top 3 days (`poolExercise()`), weight capped at one reading per exercise (shared ratio error), days below seat/(1+winsorK) excluded. Demo moves ≤ +4.1 % (Back); Calves −0.8 %. Confidence still reads the 3 listed rows; listed shares can sum < 100 % | — |
| 11 | ✅ closed 2026-09-23 (a `whose: 'their'` panel offers no benchmark button) | — |
| 12 | ✅ closed (neck ranks) | — |
| 13 | ✅ closed 2026-09-23 (9710d9c, merged 5b86069; opening weight 347244e) — level-matched conversion via `js/exercise-standards.js` + `fromKeyLift()`/`toKeyLift()`; demo moves ≤ 3.2 % (Shoulders −3.1). Pull-ups/chin-ups/dips stay fixed-ratio | — |
| 35 | **Autumn's glutes** (measured 2026-09-23, synthetic 140 lb woman): (a) `rateMuscle` drops fallbacks whenever ANY direct reading exists ("Tim's call", muscle-evidence.js ~2581), so one hip-abduction set shuts out RDL/deadlift-derived glute readings; (b) lunges, split squats, leg press, goblet squat are Quads q 0.35–0.40, under `FALLBACK_MIN_QUALITY` 0.45, so they NEVER reach glutes; (c) abduction 150×12 → 262 lb deadlift → 80th pct (SL's own abduction table agrees she is ~Advanced at abduction; the population/ROM is the problem, not the arithmetic) | ✅ closed 2026-09-23 — Tim chose **"Leave it"** over blending leg work or taming abduction. Don't re-raise |
| 36 | ✅ closed 2026-09-23 (5d4ae4c) — the padlock is gone; a **Finished / Edit** button per set (row turns `--good-dim`, +/- disappear, Edit reopens). Nothing finishes on its own. Finishing the open set opens the next unfinished one (my call, flagged). Draft flag `done` (old `locked` read the same), dropped at save | — |
| 15 | ✅ closed 2026-09-23 — Tim: untouched last-time numbers COUNT (the existing behaviour, now pinned by a test) | — |
| 0c | ✅ closed 2026-09-23 (250e7f0) — "+ Warm-up" beside Add set; rows marked a dashed **W** above set 1, no Finished, no captions; stored in `entry.warmups` (never `sets`), carried by edit-session and swaps. Solo lifts with a weight only (not supersets). History/day view doesn't show them yet | — |
| — | Per-workout visibility (social-plan §13 decision B) · ratify D18 (open question 1) | his decisions |
| 32 | ✅ closed 2026-09-23 (0dc9003) — `loggingNoteFor()` in exercises.js puts ≤4 words in the runner's meta line (Reps per leg/arm, Plates only no sled/bar, No machine weight, Include the bar, Both sides together, Added weight only, Weight = help, Time per side; 89 lifts). Tim chose Smith = plates only, alternating = per arm, sleds = plates only. Pull-up/dip suffix now "added"; assist says "assistance" without a weigh-in | — |
| 25 | Demo has no hatched muscle any more (Neck ranks), so "trained but unrankable" is unreachable in the audit account — fixing re-rolls the seeded year | his call |
| 3a | Activities Phase 2 item 6: which activities his circle logs | ask Tim |
| 0i | Body-map touch targets under 44 px land on his illustration | his call |
| 8 | Estimator Phases 1–3 (the Goals verdict waits on it); §6.1 hard constraint, §14 question | his answers |

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

**Flagged to Tim, unchanged:** ~~Months/Years pill repaints~~ (slides since a1855bb); `pointercancel` on the exercises drag commits
the slot; the demo reads eleven Novice + one Intermediate; a lifter whose only work is long sets sees
"Nothing to rank yet" and no figure; a neck panel runs 70 words against the 40-word cap; `.body-wrap`
letterboxes the two figures differently on a phone.

**Expect these reports — all deliberate:** a friend's gender/age/friends appear only after THEIR app
republishes (`healStalePublish()`); his pre-2026-09-20 Nippard copy has no percentages (unstamped
snapshot); the calendar does not draw the current month when the last recording is older than it; a
famous lifter's arms/shoulders are converted from bench, not measured; a partner gets no pull-up
caption (their bodyweight isn't on this phone).

**Fixed 2026-09-23 (Autumn's feedback, 889e005):** the runner's subtitle is a **workout clock — tap
to pause/resume** (`pausedAt`/`pausedMs` on the draft, `activeSeconds()` in session-draft.js, the
mini bar reads the same); the save screen's **Duration is an editable minutes box**, and save writes
`finishedAt = startedAt + that`. Picking anyone in the Compare sheet now closes it.
**Fixed 2026-09-23:** `ensureSystems()` adopts orphans into the first system WITHOUT a `presetId`
(or a new "My Workouts"), never into a programme copied from Explore.

## Authorized next steps
- **2026-09-27 overhaul — authorized in full, Claude decides every aspect** (Tim, verbatim: "Make your
  own executive decisions on every single aspect so that it really fits well… Deploy many many
  sub-agents… Don't stop working for any reason… You have permission for every single aspect").
  Waves, owners and decisions: `docs/overhaul-plan.md`. Remaining after wave 3: act on the review and
  visual-QA findings, then report to Tim with the list of choices he hasn't seen.
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
- Still standing from 2026-09-23: *"stop asking about accuracy check and friend's sign in problem"*
  (Open work 30, 0f) and *"leave the famous lifters comparison for now"* (34) — never raise.

## Standing instructions (Tim's words)
- **Message length** (2026-09-27): *"Never give me messages that long. Always 2-3 paragraphs max
  unless I ask for more information. Make every word you give me intentional."* A hard cap.
- **Always commit and push finished work without asking** (memory, and §1).
- **Catch-up is read-only** (2026-09-11): *"When I tell you to catch up with progress.md, you should
  not start working on anything until I tell you. It's okay to tell me what you think next steps are,
  but don't start working until I tell you to."* An authorisation from an earlier session never
  carries into this one.
- **Between jobs, say what is done and stop** — don't propose what to build. If he asks "what's
  next?", give a real ranked answer, excluding P1–P4 and the items he said he'd raise.
- **`Fitness_Research/` is not yours** (2026-09-18): *"I have a seperate research agent that is
  working inside that folder and is staying inside it. I don't want you to overlap with anything it's
  doing, so make sure you don't go in it. Just ignore what it's doing inside there."* Never read, edit,
  tidy or report on it; its changes in `git status` are normal, not loose ends. **A second parallel
  agent has worked on the app itself** (2026-09-20) — a file or suite you don't recognise isn't stale
  or yours; check `git log` first. The untracked `Claude Data/` is another agent's: stay out.
- **Never touch visuals unprompted** (2026-09-04, his strongest rule): the app *"looks very
  AI-generated and not very professional"*, and *"I don't want you to automatically go fixing things
  yourself, I think it needs a human perspective."* He points, you execute. Don't shorten copy
  globally; for wordiness he names a screen (Rule 9 governs; Research's teaching content is carved
  out: *"we should allow it to describe that section sufficiently"*).
- **No "not verified on a phone" warnings** (2026-09-04): *"Don't record the 'not verified on iphone'
  warnings at all. I'm constantly testing almost every part of the cite so when something has a
  problem, I'll come to you."* Shipped is working unless he says otherwise. (A *predicted number* is a
  different claim and still unverified — see below.)
- **Don't ask about other people's opinions**: *"I don't want you to ask me about other's
  oppinions."*
- **Recommend only when asked.** One exception he granted: if a decision now would be expensive to
  undo once moderation exists, say so at the time.
- **Don't bring him other apps' features** (2026-09-26): *"okay forget the improvements from other
  apps. I want to build it myself."* The review is reference, not a queue.
- **Sub-agents are wanted** (asked three times): *"Deploy many sub-agents to get it done if you
  need"*, *"Remember to delploy sub-agents."* Rules below under Traps.
- **Moderation/safety**: *"I'm not concerned about saftey whatsoever as of right now"*; reporting and
  blocking are wanted eventually — *"just put it in the notes."* No plan, no build.
- **Discovery feed**: the old refusal is lifted — *"It has to go eventually."* Nothing built, no plan
  asked for; finding strangers can't ship before blocking/reporting.
- **A rename is coming and he will bring it.** Don't push; keep "Fitness Tracker" cheap to change.
- **App icon = "Rise · Black Ember"** (Tim picked it 2026-09-25 from 10 Rise variants; plate-sun
  eclipse on black). Files: `icon.svg` (tab), `apple-touch-icon.png`, `icon-192/512.png` (full-bleed,
  from `docs/logos/rise-v4-square.svg`). *"I still like the dusk mirror one, so just save it for now"*
  → `docs/logos/rise-v2-*.svg`. Name ideas + what he thought of them: `docs/name-ideas.md` (not
  decided — don't rename until he says).
- **Accessibility work is deferred** (2026-09-17): *"Let's not work on the accessibility for a
  while."* Don't offer it again; he'll raise it.
- **Photos are ON** (2026-09-25, lifting the 09-10 pause): *"start deploying the 'take a picture'
  feature … after a workout"* — free, no card (Firestore, not Storage), same audience as the workout.
- **Onboarding questions + first-run tour** (2026-09-25): BUILT and live, `docs/onboarding-plan.md`.
- **Look and motion polish** (2026-09-25): *"really work on design and annimation improvements …
  shading, reflection graphics, shining … eye-catching logos, good coloring"*. Depth + motion BUILT and
  live (`docs/polish-plan.md`, `js/motion.js`, `--t-celebrate` 640ms for wins only). **App icon reopened
  by that ask**: round 1 of 6 logos rejected (*"None of these feel quite right… ignore the name…
  just go off the image"*); round 2 (marks only) → he liked "Rise" → 10 variants → picked Black
  Ember, INSTALLED (see icon line below). Picks page https://claude.ai/artifact/5dQgjHSQr8A1H6kTbZ8Lvw.
- **He took these himself** — don't start or offer: checking the estimator against a real attempt
  (Open work 19: *"I'll do 4 myself sometime this week, but I'll come to you about it"*); asking about
  public/private on first sign-in (*"I'll work on #2 along with some other things later"*).
- **Wanted, not authorised** (2026-09-04): handles instead of the enumerable directory (16), the
  estimator check (19), a two-account round trip, warm-up typing (0c) — *"All of these are things I
  want to work on, but I'll let you know about them."*
- **Don't surface the pinned items P1–P4** as "the next thing to do" (2026-08-28): *"do everything
  you think is an actually good change, then pin the rest for later (don't bring them up as the 'next
  thing to do' later though)."*
- **Home is the hub** (2026-09-08): *"Any details that don't go in any of the other main sections
  (data, workouts, etc) go into the home page … It's going to be the hub of all basic interaction."*
  A placement rule, not a request to fill it. **Data = what training MEANS, Profile = what you DID,
  Account = logistics** (direction.md §4b).

## Traps / rules that bite
- **All 22 environment traps are the handbook's §0 numbered list** — read it before the first tool
  call. The ones hit most recently:
- **Headless runs MUST pass `serviceWorkers: 'block'`** (2026-09-27): Playwright's route-abort does
  not cover requests the service worker makes, and one review run opened live Firestore channels from
  an empty profile (both failed CORS; a stray anonymous user may exist in fitness-tracker-th —
  harmless, not Tim's; never delete without Tim).
- **List collections merge, they don't overwrite** (dc931dc, `createListIO` in firebase-backend.js):
  a write sends arrayRemove/arrayUnion of only what changed vs this device's last read. Settings and
  Restore (`{replace:true}`) are still plain replaces. Emulator tests: `sync-merge.test.mjs` and
  `rules.test.mjs` (`firebase emulators:exec --only firestore "node tests/<f>"`); exclude both plus
  `sw-update` (needs Chrome) from the plain suite.
- **Firestore refuses an array inside an array, and BOTH test backends accept one** (§0.22). One bad
  field loses a whole collection document. → the data-layer suite walks every collection for nested
  arrays; never "tidy" `reps` back from `{lo, hi}` to `[lo, hi]`.
- **Wesley Hadfield is a REAL account, not a test one** (Tim's late brother, added 2026-09-27 at Tim's
  request: login timhadfield7+wesley@gmail.com, uid eJfV6emvgbSQx7O9VVrVSK5VkhG3, two "Trainer
  benchmark" sessions 2026-03-17 / 2026-08-20, weigh-ins 230/215/190). Never delete, "clean up" or
  write to it without Tim; its app never opens again, so Tim was pre-added to its connections.
- **Settings writes go through ONE queue (`inSettingsQueue`, store.js, 5df2aaa)** — overlapping
  read-modify-writes lost Wesley's gender live. Never write settings around it. Still open: same
  pattern in bodyWeight/goals/systems, and two tabs/devices can race (needs a Firestore transaction).
- **Group workouts are auto-added by the RECIPIENT's app** (`social.autoApplyHandoffs()`, run from
  app.js on start/sign-in/resume ≤1/min and before Home/Friends list offers); setting
  `askBeforeGroupWorkouts` (off by default) keeps Add/No; non-friends' offers wait; saved id `s-<offer id>`.
- **Landmine press / T-bar row / landmine row / landmine squat bar handling is doubtful** (5df2aaa
  notes): SL's landmine beginner (41 lb) is lighter than the bar; not checked for the others.
- **A local reproduction cannot clear a cloud path.** Latency and write validation differ; so does
  every race latency opens. → never tell Tim his data is fine off a `LocalBackend` run.
- **`npm i --no-save` REPLACES what is installed.** → one command: `npm i --no-save jsdom jsqr
  @firebase/rules-unit-testing`. A suite with 0 PASS and 0 FAIL was skipped, not passed (§0.18).
- **Stage by name; never `git add -A` / `git commit -a`; never `stash`/`reset`/`checkout`/`pull
  --rebase`** — another agent writes into this checkout and HEAD moves (§0.20). Verify each commit
  with `git show --name-only --format="" <sha> | grep -c Fitness_Research` → must print 0.
- **Never edit markdown or JS through a script** (PowerShell, Python, `sed -i`): encoding damage and
  CRLF→LF, which also skews the byte budgets (§0.11). Use Edit/Write. A byte-exact `cp` or raw-buffer
  split is fine.
- **When Tim reports something broken, check the LIVE site first** (§0.13): hash the deployed file
  against HEAD; a home-screen app resumes on an old build.
- **The rules emulator dies silently on the Oracle JDK** → `JAVA_HOME` = Temurin 21 (§0.9).
- **`render`'s "the exercise line chart draws an SVG" + "gridlines" failed once in four runs
  (2026-09-23)** — a settle-timing flake; rerun before believing it.
- **`tests/sw-update.test.mjs` is flaky on this machine**; don't report it as reliably passing or
  weaken it. It and `rules` are not in the 25-suite total.
- **`git worktree add` fails under OneDrive** ("Could not reset index file") → work in the main
  checkout, one change per commit; builder agents can't get worktrees here.
- **Git Bash rewrites a bare `"#/route"` argument into a Windows path** (`#C:/Program Files/Git/...`)
  → pass `"index.html#/route"`. **A no-demo screenshot signs in anonymously to the LIVE project**
  unless gstatic/googleapis are blocked in the browser (happened 2026-09-24).
- **Parallel builders in one checkout work** when each owns named files; the manager runs the suite
  and commits per builder. Wave files that overlap go in a second wave.
- **Screenshots of logged-in screens use the demo, not an account:** set sessionStorage
  `ftrack:v1:demo`='1' before load (playwright webkit from `~/.claude/tools/node_modules`), serve with
  `python -m http.server`; in the runner retry-click Push until `.set-list` exists (it loads late).
- **Golden table** (data-layer, `GOLDEN`): any rating-maths change re-baselines it in its OWN commit
  with a per-muscle before→after comment; `GOLDEN_DUMP=1` prints paste-ready rows to stderr.
- **A test double more permissive than the real thing turns a guarantee into an assumption** — ask
  what the real one refuses and assert that against the data.
- **Doc byte budgets are a test** (data-layer): progress 160 KB, handbook 220 KB, state 160 KB,
  chat 220 KB. **The handbook is at ~219 KB — collapse before adding.** Never raise a number.
- **A research wave shares ONE web-search budget (200) across the whole session, and it runs out**
  (2026-09-21: six agents, four of them starved mid-job). Order the groups by what matters most, and
  expect the last ones to fall back to fetching known sites directly. **YouTube blocked caption
  downloads for hours** that same session, which is why Togi, Alex Eubank, Noel Deyzel, Whitney
  Simmons and Krissy Cela are still unsourced (Open work 34) — their numbers are only spoken aloud.
  **A weekly usage limit killed one agent outright**; its people simply kept their old data.
  **2026-09-22: five parallel transcript-pullers got this IP blocked in ~50 minutes** — run ONE
  paced agent. `js/public-figures.js` regenerates byte-exactly with
  `JSON.stringify(arr,null,2).replace(/^(\s*)"(\w+)":/gm,'$1$2:')` — verify the baseline matches first.
- **Sub-agent rules:** disjoint named file sets (nobody near `css/app.css` or `tests/` unless it's
  theirs; one agent owns `tests/`); agents never commit or run tree-changing git; name the session
  date and a scratch path of their own in every brief; "proposed tests" ≠ run tests; after any agent
  dies, diff its header against its body (a half-written agent leaves a header that lies); read every
  report's "what I decided NOT to do".
- **When a function's OUTPUT shape changes, grep every caller of that function** — not its sibling.
  (2026-09-27: changing `normalizeReps` broke the runner through `expandRepSpec`.)
- **A test that pins the tokens does not pin the motion** — the a11y duration check reads the three
  `--t*` tokens, not hard-coded `@keyframes` (Rule 7's 250 ms).
- **GitHub Pages publishes everything tracked** → `.gitignore` refuses `*.tmp` and root `.png`; Hevy
  screenshots never go in the repo (social-plan §12.12).

## Decisions
- **Locked decisions D1–D33 live in `docs/handbook.md` §6** and design Rules 1–9 in §5. Recent,
  not yet D-numbered:
- 2026-09-27 · Auto-guide draws the whole bar, both sides (`js/bar-view.js`, only in the guide; the
  runner keeps its small one-side hint); plates slide on/off with the `snap` spring. Back sits left of
  Next, greyed on the first step; it walks a history stack, else `prevStep()` in guide order (b67b8c2).
- 2026-09-27 · a notification links to `#/me/workouts/<sessionId>`, not `#/day/<date>` (a day can hold
  two sessions) and not a new screen (views-social.js refuses an owner-side twin).
- 2026-09-27 · your workouts and a friend's feed share one card (`js/workout-card.js`); `alwaysOpen`
  is the only difference.
- 2026-09-27 · adding a preset still does NOT make it current; the screen says so instead.
- 2026-09-27 · rep prescriptions are STORED as `{lo, hi}` per set; read in any of three shapes.
- 2026-09-27 · swap keeps only `locked || touched` sets; Open work 15's save question untouched.
- 2026-09-27 · famous lifters are rated by `buildStrengthShare()` like anyone, each muscle as of its
  freshest lift (`figureStrength()`); meet singles are benchmarks, gym sets sessions.
- 2026-09-21 · famous lifters are rated from their PEAK window (Tim: "the lifts they were doing when
  they were in the peak of their fitness"), each lift with its own weigh-in (`lift.bodyweightLb`) and
  a `peak` label. Each lift's `note` says why it's in.
- 2026-09-21 (same day, after Tim: *"Jeff Nippard is strongest right now"*) · peak means STRONGEST IN
  ABSOLUTE TERMS, not strongest for bodyweight — a filmed gym PR counts (`reported: true`) and a
  stated bodyweight from the period is enough. **47 people, 213 lifts**, one sourced set per muscle
  group wherever it exists (the estimator converts within a muscle, so one is enough).
- 2026-09-21 · a test must not pin a real person's researched numbers (render's famous-summary
  assertion reads `figureSummary()`); re-research would break it every time.

## NOT verified
_Tim's rule bans device warnings ("not verified on a phone"). This list is only for claims no screen
can check._
- **2026-09-27 overhaul:** the blur itself (headless WebKit on Windows doesn't paint backdrop-filter;
  computed styles checked) · wake lock, share sheet, `persist()` on a real iPhone · the live cloud
  stranded-write merge · the first-save nudge in real anonymous cloud mode · a real Strong/Hevy export
  (fixtures from published headers; Strong 6 warm-up marker "W" assumed) · thousands-row imports
  against real Firestore/phone storage · `--chrome-b` tracking a footer that grows mid-set (jsdom
  wiring only) · `tests/sw-update.test.mjs` failed 3 checks even at a9a92c7 (pre-overhaul) — wave 3
  SWUPDATE is on it.
- **2026-09-26:** Autumn's cause (no gender / no weigh-in in her Body details) is REASONED — her data
  was never read. Hip thrust machine ratio 0.60 is reasoned (lever brands vary). Warm-up set COUNT
  rule is judgement, not from a paper. Plate drawing in kg only checked in a stepper panel.
- **2026-09-27 Tim chose "Every muscle"**: fallbacks blend beside direct work everywhere (6787ff2;
  the 2026-08-17 rule is reversed), then `sigmaFor()` fixed so a key-lift base is never trusted less
  than a converted one (Tim's synthetic glutes 278.3).
- **2026-09-27 later, live:** (a) Tim: *"I don't want it to be our job to fix anything"* → an assumed
  map IS published now with `assumed` + a reader line (reverses 2026-09-06); legacy docs show saved
  levels (b48c924). Autumn must open the new build once; building her map on the viewer's phone was
  NOT done (two rankings could disagree) — offered. (b) Machines by mechanics
  (`docs/machine-conversion-plan.md`, `js/machine-mechanics.js`): Tim chose split entries + a
  "Leverage" picker, 2.5× default, Smith bar added in conversion, old hip thrust sets re-read as lever.
  Names "Machine Hip Thrust (Plates at Hips)/(Weight Stack)", "Leverage", "Same as a bar" = his to
  check. Picker surviving a reload NOT verified (demo saves nothing). Pendulum squat, reverse hyper,
  Smith bench ratio still reasoned/left.
- **No predicted number has ever been checked against a real attempt** (Open work 19 — Tim's). Don't
  describe any estimate as accurate.
- **Review wave 2 (81fada0):** the checker's "N more" is only test-checked (demo has no checker
  lines); sheet slide checked by computed style only; reduced motion and light theme not shot.
- The 2026-09-27 race fixes (`writeGeneration` in `store.js`; `ensureSystems()` re-read) are reasoned,
  not asserted — the window is zero on `LocalBackend` and seconds on Firestore.
- ~~"Delete account" never ran against real Firestore~~ — **ran 2026-09-23**: `tools/live-check.mjs`
  S4 deletes a throwaway account through `FirebaseBackend.deleteAccount()` on the live project
  (45/45: all 10 collections + shared docs gone, the purge's own re-read clean, a second account's
  session untouched). Not run: an email/password account's re-auth path, or a Google-linked one.
  A crashed first run's docs under `users/nTwoaNKNBoYweqmYvamBo0ediSA3` were deleted by path (the
  guard refuses `--recursive`); two orphaned ANONYMOUS auth users may remain (no data; harmless).
- File import has never parsed a real export from any service.
- No preset has been version-bumped for real; the stamped update path has only run in tests.
- The live read pattern (Open work 26) was measured on 3–4 sessions, not a training history.
- Smooth fade (2026-09-23): measured only on the demo year + a synthetic layoff. Reasoned, untested
  on real data: after a break of more than 84 days the old number slides 2 %/week instead of dropping
  at the first lighter session (same as `estimateAt()`); no hysteresis, so level-boundary flapping is
  unmeasured under it.
- Motion pass 2 real-iPhone feel (springs at 120 Hz, edge swipe vs Safari's, pull-to-refresh, pinch,
  theme reveal) and Profile's ~330 ms first build at 4× throttle — list in `docs/motion2-plan.md`.
- "At least X" uses 2σ of `readingSigma()` (~98 % one-sided) — never checked against real attempts.

## Rejected / parked
- **Parked 2026-09-23 at Tim's word — DO NOT ASK ABOUT THESE AGAIN:** ~~famous-lifter retry (was Open
  work 34; Deyzel, Swoll, Cela, Cummings, Simmons unsourced; leads in docs/history.md 2026-09-22)~~
  *"leave the famous lifters comparison for now"* · ~~strength-accuracy backtest on his export (was
  30)~~ · ~~his friend's sign-in failure (was 0f)~~ — *"stop asking about accuracy check and friend's
  sign in problem."*
- **Pinned P1–P4** (don't offer): P1 activity PRs (crosses D27) · P2 Strava feed exclusion · ~~P3
  competitive review~~ ran 2026-09-26, set aside · P4 effort-size research (likely a written "no").
- **Parked at Tim's word:** 10 live Strava sync (needs Blaze + card) · 12 AirPods controls ("Wait") ·
  13 importing food ("Wait"; collides with D1/D26).
- ~~Features from other apps~~ · 2026-09-26 · "I want to build it myself"; MEV/MRV volume targets have
  no literature behind them; showing uncertainty on a strength number is the one position no
  competitor holds.
- ~~Owner-side twin of the friend session screen~~ · two screens describing one workout must agree forever.
- ~~Making a copied programme current on add~~ · 2026-09-27 · copying to look is not switching.
- ~~A bar-height / hand-height field~~ · 2026-09-06 · the diagnosis was wrong (research.md §15).
- ~~Fatigue Tier 3 load multiplier~~ · the only mechanism that makes a number bigger than observed.
- ~~A reps-in-reserve field~~ · D28; D33's assumption about a COACH's prescription is not it.
- ~~Rest-timer improvements~~ · declined by Tim; rest timer is off by default.
- ~~Reorganising the big files~~ · assessed, answer no (handbook §4 "Why the big files stay big").
- ~~Volume in pounds~~ · Tim chose a set count ("Replace Volume for # of sets").
- ~~Famous lifters with no published weight × reps~~ (Sam Sulek, David Laid, Noel Deyzel, Jeff Seid,
  Christian Guzman, Whitney Simmons, Stephanie Buttermore, Krissy Cela, Sydney Cummings) · 2026-09-27 ·
  never guess a real person's numbers. ~~Tia-Clair Toomey~~ · Olympic lifts rate no muscle here.
  ~~Equipped records~~ (Coan's gear totals, Coleman's 800 squat, Eddie Hall) · different lifts.

## Map
- `index.html`, `sw.js` (precache — a test fails if a `js/` file is missing from it), `firestore.rules`
  (must list every collection in `store.js` COLLECTIONS; deploy with the client).
- `js/store.js` · the only data layer (read cache, backends, ratings, `buildStrengthShare`).
- `js/firebase-backend.js` · Firestore adapter; `sessions`/`guestSessions` sharded, `workouts` one doc.
- `js/views-*.js` · screens; `js/views-session.js` is the runner, `views-social.js` the friends/compare.
- `js/muscle-evidence.js` · ratios, confidence, the blend (read before touching ranking).
- `js/set-reps.js` · rep prescriptions — stored `{lo, hi}` (§0.22). `js/set-targets.js` · % of max.
- `js/workout-card.js` · the shared feed/profile card. `js/public-figures.js` · 47 famous lifters,
  GENERATED from research — correct a number only against its cited source. Each person is one PEAK
  window (`peak`), each lift its own weigh-in (`bodyweightLb`) and a `note` saying why it is in;
  regenerate by merging per-group research JSON, never by hand-editing 213 entries.
- `tools/live-check.mjs` · the only thing that writes to the LIVE project (`--yes-write-to-live`, §0.16).
- `docs/handbook.md` · how to work · `docs/state.md` · what the app does · `docs/direction.md` · what
  Tim wants (overrules) · `docs/history.md` · dated log · `docs/archive/` · old progress snapshots ·
  `docs/chat-archive.md` · chat before 2026-09-15 · `docs/*-plan.md` · feature plans · `docs/research.md`.
- **Tests:** `node tests/<name>.test.mjs` for each of 25 no-Chrome suites (needs `npm i --no-save jsdom
  jsqr`); `rules` needs the emulator + Temurin 21; `sw-update` needs Chrome (fails the same on HEAD
  here). **Last run 2026-09-25 checkpoint: 50 files, 48 run, 7,563 PASS, 0 FAIL, all exit 0.** Check
  EXIT CODES too — a crashed suite prints no FAIL. All at once (PowerShell):
  `$global:tp=0;$global:tf=0; Get-ChildItem tests/*.test.mjs | ? { $_.Name -notin 'rules.test.mjs','sw-update.test.mjs' } | % { $o = node $_.FullName 2>&1 | Out-String; $p=([regex]::Matches($o,'(?m)^\s*PASS')).Count; $f=([regex]::Matches($o,'(?m)^\s*FAIL')).Count; $global:tp+=$p; $global:tf+=$f; if($f -or $LASTEXITCODE){ "$($_.Name): $f FAIL exit $LASTEXITCODE" } }; "TOTAL PASS $tp FAIL $tf"`
- **Live:** https://timothyhadfield.github.io/Fitness_Tracker/ · GitHub Pages from `main` (deploy =
  push; ~45 s) · Firebase project `fitness-tracker-th` · run locally `python -m http.server 8765`
  (ES modules don't load over `file://`).
