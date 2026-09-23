# Fitness Tracker — progress (handoff for Claude)

## START HERE
_Last updated 2026-09-21/22 — **the newest work in these files, despite the earlier number**: the
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

**Live and working** (details per screen in `docs/state.md`): logging runner with set types, set
lock, per-person joint workouts, rep prescriptions and % targets · programmes (current system,
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
| 1 | Typo quarantine is muscle-wide: a genuine first heavy test on a lightly-worked muscle is held one session (kept at 1.99×, set aside at 2.01×) | a decision — the error runs both ways |
| 2 | Fall limit: the 84-day window shipped; wiring `estimateAt()` would smooth it but moves every rating | a decision + re-baseline |
| 3 | The muscle panel's freshness note has NEVER rendered — `freshnessLine()` has no caller | his word (new sentence on a screen) |
| 4 | Data tab's "Estimates above 15 reps are unreliable." is unreachable (`MAX_TARGET_REPS = 15`) | his word: delete or lower |
| 5 | Goals prints `+N %` from the frozen `gainPct`, can disagree with a re-frozen target | his word |
| 6 | An ordinary lifter flaps MORE than one on a level boundary (0.75 vs 0.19), contrary to the comment | an answer, not a fix |
| 7 | A set with a prescribed weight is `prefilled`, so accepting weight AND reps untouched drops it at save | his word: leave, warn, or count "moved on from" |
| 8 | Benchmark workouts in a separate programme no longer appear on Record; the switcher has no "look without switching" | his word |
| 9 | Should a high-rep set count as a floor ("at LEAST 131")? Reverses the fatigue-plan §4 refusal | his word — only as a separate "at least X" reading |
| 10 | The rating rests on ONE set per exercise, top three; blending every set at its own precision is the biggest accuracy lever | his go-ahead (re-baseline) |
| 11 | ✅ closed except one half: a friend's panel offers *"Benchmark Standing Calf Raise"* — the reader's own screen — on their body | open bug, small |
| 12 | ✅ closed (neck ranks) | — |
| 13 | Conversion ratios are level-blind (machine press ÷ OHP runs 0.89→1.44 by level; the app uses 1.23). Percentile matching from `tools/strength-level-data.mjs` fixes it | his go-ahead (second re-baseline, never in the same commit as 10) |
| 15 | **Open work 15** — history-prefilled sets carry no `prefilled` flag, so an untouched exercise with history saves last time's numbers as done. Swap no longer relies on it (2026-09-27), SAVE still does | his decision |
| 0c | Should warm-ups be typed by the lifter (Hevy's `W`)? Every recorded set counts until then | his decision |
| — | Per-workout visibility (social-plan §13 decision B) · ratify D18 (open question 1) | his decisions |
| 32 | The app never states its logging conventions where you log (machine weight excluded; a lunge rep = one step per leg) | his word (screen text) |
| 25 | Demo has no hatched muscle any more (Neck ranks), so "trained but unrankable" is unreachable in the audit account — fixing re-rolls the seeded year | his call |
| 34 | 2026-09-22 rerun (Tim: "continue with that project"): **added Jeff Seid (3 lifts), Alex Eubank (2), Togi (1, real name Shane Stoffer), Meg Gallagher +2 back sets**. Still unsourced: **Noel Deyzel, Joey Swoll, Krissy Cela, Sydney Cummings** (no weight × reps anywhere), **Whitney Simmons** (2 shoulder sets but no sourced bodyweight). Accessory pass found nothing for Cohen, Connor, Buettner, Lawrence, Gasparyan, Thompson. YouTube IP-blocked captions ~50 min into a 5-agent wave; agents fell back to local Whisper on downloaded audio. Retry leads (video IDs) are in each agent's `notFound` — copied to `docs/history.md` 2026-09-22 | a rerun with ONE agent, paced, when YouTube unblocks |
| 3a | Activities Phase 2 item 6: which activities his circle logs | ask Tim |
| 0i | Body-map touch targets under 44 px land on his illustration | his call |
| 0f | His friend's sign-in failure | Tim is investigating it himself |
| 8 | Estimator Phases 1–3 (the Goals verdict waits on it); §6.1 hard constraint, §14 question | his answers |
| 30 | Strength-accuracy §6.1 backtest needs **Tim's own export**; §6.5 personal ratios not started | his export |

**Flagged to Tim, unchanged:** fill-on-open meets the set lock (a copied set 2 locks when you go back);
the Profile Months/Years pill repaints instead of sliding; `pointercancel` on the exercises drag commits
the slot; the demo reads eleven Novice + one Intermediate; a lifter whose only work is long sets sees
"Nothing to rank yet" and no figure; a neck panel runs 70 words against the 40-word cap; `.body-wrap`
letterboxes the two figures differently on a phone.

**Expect these reports — all deliberate:** a friend's gender/age/friends appear only after THEIR app
republishes (`healStalePublish()`); his pre-2026-09-20 Nippard copy has no percentages (unstamped
snapshot); the calendar does not draw the current month when the last recording is older than it; a
famous lifter's arms/shoulders are converted from bench, not measured; a partner gets no pull-up
caption (their bodyweight isn't on this phone).

**Found, not fixed:** `ensureSystems()` stamps a `systemId`-less legacy workout onto
`systemsRows[0]`, which can be a programme just copied from Explore (it mutates data; nobody asked).

## Authorized next steps
- None open. Everything Tim asked for through 2026-09-27 is built and pushed. Between jobs: report
  and stop.

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
- **The app icon is closed** (2026-08-30). Don't reopen.
- **Accessibility work is deferred** (2026-09-17): *"Let's not work on the accessibility for a
  while."* Don't offer it again; he'll raise it.
- **Photos are paused** (2026-09-10): *"lets keep a pause on the photos for now. I don't think it's
  necessary yet."* Don't raise it.
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
- **Firestore refuses an array inside an array, and BOTH test backends accept one** (§0.22). One bad
  field loses a whole collection document. → the data-layer suite walks every collection for nested
  arrays; never "tidy" `reps` back from `{lo, hi}` to `[lo, hi]`.
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
- **`tests/sw-update.test.mjs` is flaky on this machine**; don't report it as reliably passing or
  weaken it. It and `rules` are not in the 23-suite total.
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
- **No predicted number has ever been checked against a real attempt** (Open work 19 — Tim's). Don't
  describe any estimate as accurate.
- The 2026-09-27 race fixes (`writeGeneration` in `store.js`; `ensureSystems()` re-read) are reasoned,
  not asserted — the window is zero on `LocalBackend` and seconds on Firestore.
- "Delete account" (`createAccountPurge()`) has never run against real Firestore — the last large
  network path in that state; it deletes accounts, so not a spare-half-hour job.
- File import has never parsed a real export from any service.
- No preset has been version-bumped for real; the stamped update path has only run in tests.
- The live read pattern (Open work 26) was measured on 3–4 sessions, not a training history.

## Rejected / parked
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
- **Tests:** `node tests/<name>.test.mjs` for each of 23 no-Chrome suites (needs `npm i --no-save jsdom
  jsqr`); `rules` needs the emulator + Temurin 21; `sw-update` needs Chrome — 25 files in all. **Last
  run 2026-09-21 (this session): 23 suites, 6,372 assertions, 0 failures** (earlier notes said "24"
  suites; that was wrong). All of them at once, printing only failures (PowerShell):
  `Get-ChildItem tests/*.test.mjs | ? { $_.Name -notin 'rules.test.mjs','sw-update.test.mjs' } | % { $o
  = node $_.FullName 2>&1 | Out-String; $f=([regex]::Matches($o,'(?m)^\s*FAIL')).Count; if($f){
  "$($_.Name): $f FAIL" } }`
- **Live:** https://timothyhadfield.github.io/Fitness_Tracker/ · GitHub Pages from `main` (deploy =
  push; ~45 s) · Firebase project `fitness-tracker-th` · run locally `python -m http.server 8765`
  (ES modules don't load over `file://`).
