# Fitness Tracker — chat log (for Claude)

_One entry per session, newest at the bottom, capped at 60 KB. The current state is in `progress.md`;
full session write-ups are in `docs/history.md` (search by date)._

⚠️ **THIS FILE STARTS AT 2026-09-24.** **2026-09-19 to 2026-09-23** is in
`docs/archive/chat-full-2026-10-17.md` (a full copy of this file as it stood on 2026-10-17, lines
15–594; the shell guard blocks byte-splitting .md, so the whole file was copied). **2026-09-15 to
2026-09-18** is in `docs/archive/chat-2026-09-15-to-18.md`. Everything from **2026-08-14 to
2026-09-14** is in `docs/chat-archive.md`, oldest first. Entries from 2026-09-27 use the short form:
Asked · Decided · Built · Verified how · Open.

---

## 2026-09-24 · Whole-app review (Opus 5.5)
- **Asked:** *"review the cite and look for improvements (either new features or fixing problems)
  throughout the whole thing"* — usability, clarity, calculation, design, colours, animation, titles.
- **Built:** 7 read-only reviewers (record, workouts, data, maths, profile/goals, social, design/first
  run) → ~80 findings. 39 no-decision bugs fixed by 5 builders in the main checkout (f218774,
  a391eda, 94f4c62, 1c25467, 163306f). 42 Tim-decides items published as a picks page:
  https://claude.ai/artifact/HiHY1QBrwm3dVQkK9DHy73 (db: `picks/<id>` {choice do|talk|skip, note};
  `status/<id>` {live} is mine). Read his picks with ArtifactData list `picks`.
- **Verified how:** every new test seen failing first (review-runnerA, review-maths, review-screens,
  review-social, review-workouts); full no-Chrome suite 6,635 PASS / 0 FAIL before each push; golden
  table byte-identical (GOLDEN_DUMP diff); WebKit shots at 393/1440 in the session scratchpad.
- **Open:** Tim's picks · builder choices flagged to him (wording of 6 privacy lines, "Marked warm-ups
  left out", "Started Aug 6 · ended", no-weigh-in assist text, Keep my version as ghost button, shell
  paints before settings, `ftrack:v1:look` localStorage) · drafts >12 h still cleared · optimal.js
  days/week still wobbles ~7 % by weekday · set-reps.js has a stale targetsApply comment · a design
  reviewer's first two no-demo runs signed in anonymously to LIVE (≤2 empty anon users).

## 2026-09-24 (second half) · Claude decides the 42 picks, 40 built
- **Asked:** *"for all fo the 42 items you're leaving me to decide, you just choose what to do based
  on what you know and recommend"*.
- **Decided:** do 40; skip c-icons (his rule: corner profile icon opens Account) and c-levelcolours
  (the level palette is his). Written to the picks page as choice + note.
- **Built:** wave 1 a7f1bf3 (5 builders: Record, Workouts, Home/Friends incl. owner-reply rule
  DEPLOYED, Data, Profile/Goals/Account); f-sex a791c9a (estimateOneRM honours opts.sex; owner-only
  in runner/benchmark/Compare; no golden moved); wave 2 81fada0 (css look pass: 5 sizes/3 weights,
  sentence-case labels, no mono figures, 68ch, sheets slide up; words: "Body details", "gender",
  "program"; checker capped at 2 + "N more"). Picks page `status/<id>` = live for all 40.
- **Verified how:** full no-Chrome suite 6,843 PASS / 0 FAIL before the wave-2 push; rules suite 226
  pass; new tests seen failing first (estimate 3/5, lint cap 5/6); WebKit shots of every tab at
  393/1440 in scratchpad/look/after.
- **Open (see also 2026-09-25 below):** "N more" never seen on screen (demo program has no checker lines); sheet slide not seen
  mid-motion, reduced motion and light theme not checked; preset notes still say "programme" (a
  content-hash test guards them).

## 2026-09-25 · New-user questions, first-run tour, workout photos
- **Asked:** a question-based guide at first login that *"will set the user up with everything they
  need. For now, this will just be giving them a workout"*; a skippable tour with pop-ups and Next,
  *"annimations … clean"*; *"start deploying the 'take a picture' feature … after a workout"*.
- **Decided (Tim, question box):** photos free, no card (Firestore, not Storage); same audience as
  the workout. Photo pause lifted in direction.md/progress.md.
- **Built:** `js/program-builder.js` + `js/onboarding.js` (6 questions → own program, made current;
  first run on a new cloud account only); `js/tour.js` (8 stops, gliding spotlight; Account screen rows
  "Take the tour", "Find me a program"); `js/photo.js` + photo docs `users/{uid}/photos/{sessionId}`,
  rules DEPLOYED. Plan and as-built notes: `docs/onboarding-plan.md`.
- **Verified how:** full no-Chrome suite 7,010 PASS / 0 FAIL; rules emulator 260/0; generator checked
  over all 12,800 answer combos; WebKit shots at 393/1440 in scratchpad/shots and photo-shots.
- **Choices Tim hasn't seen:** all question/tour/photo wording; "Or try X or Y" only for Full gym;
  flags set on open not finish; tour rows on Account not Settings; 240 ms glide (handbook 250 ms cap);
  photo below exercises above Kudos, box 4:5–1.91:1 capped at 72 % of the screen.
- **Open:** see `docs/onboarding-plan.md` NOT verified.

## 2026-09-25 (second pass) · Shading, shine, motion, logos
- **Asked:** *"really work on design and annimation improvements throughout the cite? … shading,
  reflection graphics, shining, smooth and creative annimation, new and eye-catching logos, good
  coloring"*.
- **Built:** depth pass (CSS "Polish · depth and colour") and motion (`js/motion.js` + CSS "Motion",
  handbook Rule 7 gains a celebration tier ≤700 ms, 640 used). Filled buttons shrink and press darker,
  not brighter (manager's call between the two builders). Logos: 6 concepts on a picks page; Tim
  rejected all (note on the page: go off the image, ignore the name) → round 2, marks only.
- **Verified how:** full no-Chrome suite 7,074 PASS / 0 FAIL; WebKit demo frames at 393/1440 in
  scratchpad/polish (before/after/motion).
- **Choices Tim hasn't seen:** shadows tinted per palette; pressed filled buttons darker with a
  shaded top edge; Record ring 3px 14% + sheen; selection glow; celebration 640 ms, once per device;
  rows stagger 30 ms; row press .98.
- **Open:** `docs/polish-plan.md` NOT verified.
- **Logo, later the same day:** round 2 (6 marks, no name) → *"rise is good. Could you maybe make 10
  different variants"* → picked **Black Ember** (installed: icon.svg, apple-touch-icon.png, icon-192/512
  PNG in manifest + sw precache); Dusk Mirror saved in `docs/logos/`. Asked whether "Rise" is a crowded
  app name — answered from a web search (many small "Rise" fitness apps + the big RISE sleep app).
  Verified: suite 7,074/0; icon links 200 and served in WebKit 393px. Home-screen look on a real
  iPhone NOT checked.
- **Names:** brainstorm → shortlist in `docs/name-ideas.md` (a348e29); nothing decided.

## 2026-09-25 (night) · Motion pass 2: physics, fixes, layouts (Tim asleep, full permission)
- **Asked:** *"Put professional level annimation and physics into this cite. Really analyze all the
  design layouts … Think about the potential for any additions … Impress me. When you're done make
  sure that everything still looks good on every single page"* + *"keep working for a long time …
  don't ask me any questions … If you think you're done, you're probably not"*.
- **Built** (plan + choices: `docs/motion2-plan.md`): `js/spring.js` physics + Rule 7 physics tier;
  all pass-1 problems fixed (503e15d); data screens + moments (e12f3ae); navigation — push/back slide,
  tab crossfade, Record card, edge swipe, sliding tab line, `js/gestures.js` (901c3b6); surfaces —
  pill drag, sheet drag-dismiss, toasts, photo viewer (a1855bb); 3 review rounds of fixes (a1855bb,
  240cada, da0d5c2, f5aef8b) incl. laptop hover states, persistent sidebar, two-pane Volume/Goals/
  Profile/friend workout, muscle-rating memo in store.js (Profile open 633→117 ms at 4× CPU).
  Additions: goal bar on Profile + tappable strongest/weakest (8e04944); the rest listed for Tim in
  `docs/additions-ideas.md`.
- **Verified how:** suite 7,563 PASS / 0 FAIL (exit codes checked); final sign-off review swept 65
  states × 7 setups (393 WebKit dark/light/reduced, 1440 + 1024 dark/light), ~830 shots, looked at
  via contact sheets: no overflow/console errors; its one defect (reduced-motion tab line) fixed.
- **Open:** real-iPhone feel (NOT verified list in the plan); Profile first open still ~330 ms at 4×
  (render cost); `docs/additions-ideas.md` awaits Tim.

## 2026-09-26 · After a joint legs workout: warm-ups, glutes, Autumn's compare, plate drawing
- **Asked:** auto warm-up sets from research that follow set 1's weight live; why glutes rate only
  from one machine hip thrust (45 lb on a long lever) when RDL/SLDL/squats/lunges were done; why
  Autumn's compare says "Nothing to compare yet"; a coloured drawing of one bar side instead of
  "bar + 10, 10 each side".
- **Built (4 builders, one checkout):** 389bd52 compare — a friend's shared map needs gender + a
  weigh-in (own map draws on an assumption, so she saw hers); saving gender/age now republishes, boot
  heal republishes a map-less copy, the sentence names what's missing (never age). 14e0ae1
  `plateDrawing()` in plates.js, IPF colours, sentence kept as aria-label. ab0505c glutes keep
  fallbacks in the blend (Glutes only), lunges/leg press reach glutes, hinge variants rate glutes
  directly, hip thrust machine 1.00→0.60 q 0.25; golden Glutes −0.8 %. a37bd57 `js/warmup.js` + W rows
  auto-filled, user edits win.
- **Verified how:** full no-Chrome suite 7,687 PASS / 0 FAIL, exit codes checked; new suites
  compare-publish (9/15 failed first), glutes (15/28 failed first), plates-visual, warmup; WebKit
  393/1280 shots in session scratchpad (plates/, warmup/).
- **Open:** see progress.md NOT verified 2026-09-26 (blend-everywhere offer, Smith hip thrust, own-map
  "age" sentence). Set 1 sits partly below the fold on a phone with 3 warm-ups showing.

## 2026-09-27 · Every-muscle blend, friend maps never blank, machines by mechanics
- **Asked/decided:** "Every muscle" (blend fallbacks everywhere, 6787ff2) + sigmaFor fix (bfdb881);
  Tim corrected Claude's backwards explanation of the hip thrust ratio and refused one blanket machine
  number → research plan (2fba1a8) → his answers: both, not sure (2.5×), add Smith bar, re-read old
  sets → built. Autumn: *"fix the code on your end"* → assumed maps publish with a caveat (b48c924).
- **Verified how:** full no-Chrome suite 7,756 PASS / 0 FAIL after the machine build; WebKit 393px
  shots of the Leverage picker and the assumed-friend Compare line (scratch copies).
- **Open:** see progress.md "2026-09-27 later".

## 2026-09-27 (evening) · Machine rework, warm-up history, clearer plates, group hand-over, Auto-guide
- **Asked:** rework the other guessed machines; warm-ups in history/day view; plates bigger with a
  number on each and a clear bar end; align weight/reps numbers; cut "(from your other lifts)";
  group Finished → next person; an "auto-guide" one-set-at-a-time view with Next + Edit.
- **Built:** 5 builders (one checkout; shared css/views-session staged by building index blobs so
  each commit held only its own block). Auto-guide builder was cut off by Tim's interrupt after
  wiring; manager finished it (fixed a hidden empty `.steppers` that broke render's one-controls
  check), shot it, pushed. A README commit from another session was merged in (no overlap).
- **Verified how:** full no-Chrome suite 0 FAIL (8,104 incl. ok-style suites) before the Auto-guide
  commit; WebKit 393×659 + 1366 shots of Auto-guide (warm-ups → sets, Edit back), no page scroll.
- **Open:** see progress.md Authorized "2026-09-27 evening" choices list.

## 2026-09-27 (night) · Big animated bar + Back in Auto-guide; Wesley's account
- **Asked:** a much larger two-sided bar in the Auto-guide with plates animating on/off; a Back
  button; and (Tim's late brother) create Wesley Hadfield as a user with two trainer benchmarks and
  friend him to Tim.
- **Built:** b67b8c2 (`js/bar-view.js`, `prevStep()`, Back left of Next). Wesley created LIVE through
  the app's own modules in headless WebKit (scripts in session scratchpad/wesley): email
  timhadfield7+wesley@gmail.com (plain address is Tim's own login), male, weigh-ins 230 (2025-02-20,
  from "lost 40 in 1.5 years") / 215 / 190, sessions with Deadlift, Leg Press, Barbell Bench, Lat
  Pulldown, Triceps Pushdown, Barbell Curl, Running 1.5 mi. Directory has no "timhadfield7": Tim is
  "Timothy Hadfield" (only Hadfield match) → request sent, Tim pre-added on Wesley's side.
- **Verified how:** bar-view 61/0, guide-mode 70/0, render 1733/0 (builder: full suite 0 FAIL); live
  read-back as Wesley: 2 sessions, 14 benchmarks, 3 weigh-ins, published copy viewers = Tim, gender
  male after a second save (first was lost — progress.md Traps).
- **Open:** Tim accepts the request; picks to confirm (pushdown vs other triceps, barbell curl vs
  dumbbell, leg press counted as plates only).
- **Then:** *"the % of 1RM and estimated number of reps should also be shown in the auto-guide"* →
  bcbbf54: runner caption content is one `captionParts()` (views-session.js) used by the pane and the
  guide (`ctx.captions` / `ctx.captionData`, replacing `estimatedMax`/`typoRatio`). guide-mode 76/0
  (the 4 new checks failed on HEAD first); full no-Chrome suite 8,015 PASS / 0 FAIL, exit codes 0;
  WebKit 393×659 + 1366 demo shots: both lines show, no page scroll, Next on screen.
- **Then:** *"analyze the auto-guide system and really think if we're missing anything"* → 2 read-only
  reviewers (bugs; parity) → 3defd9d fixed 11 bugs + 9 omissions (warm-ups per exercise via `prepare`
  hook, `setIsRecorded` on Next, box font by length, ramp frozen once a working set is done — BOTH
  views, wrap-around to anyone's unfinished work, drop/myo steps, rest only on first finish, 400 ms
  double-tap guard, `lastStep()`, bar hidden on typo, shared line builders). Tim's picks (question
  box): Swap+Skip, carry changed weight, "Next: <exercise>", + Set; plus *"show the weights and reps of
  the past and future sets … upper left"* → e66346b (`skipped` flag, `setIsRecorded` refuses it;
  carry also moves untouched plan/last-time sets — flagged). Suite 8,114 PASS / 0 FAIL; new checks
  failed on HEAD first (45); shots in session scratchpad guide-fix/ and guide-new/.
- **Then:** *"Do 1 and 5 now"* (settings race; Meadows row/landmine over-credit) + *"change the group
  workouts so it automatically applies to the friend's workout system … make a setting (that is off
  by default)"* → 5df2aaa. Settings queue (settings-race 5 failed first); Meadows row = half bar per
  hand then doubled, ratio 0.98 (70×10: 378→271 lb); landmine press unchanged (premise wrong: no bar
  was added). Auto-added group workouts + "Ask before adding group workouts" switch (handoff-auto 18
  failed first). No rules change. Suite 8,161 / 0, exit codes 0.

## 2026-09-27 late — the overhaul (analysis → 3 build waves)
- **Asked:** Tim's in-depth analysis of estimates, interaction, design (glass, fonts, colours,
  textures), the intro, wordy sections (shorten or move behind ?), missing scenarios, preferences into
  Settings with the smoothest default; *"Make your own executive decisions on every single aspect…
  Deploy many many sub-agents… Don't stop working for any reason."*
- **Decided:** all in `docs/overhaul-plan.md` (decisions, shared contracts, owners, must-not-change).
- **Built:** 9 analysts → wave 1 (15 builders: estimate caps, Harbo age, 28-day cycle, deload, typo
  guard, Settings regrouped, auto theme, weight steps/plates, keep screen on, intro 4 paths + About you
  + 5-stop tour + first-save nudge, friendly errors/undo toast, lazy views + skeleton, word cuts) 69cd88d
  → wave 2 (runner: equipment today, lighter week, update workout, empty workout, sit out; editor
  keeps 5+; Look 3 glass/Barlow/grain/ember, Settings+Goals fit, 44px taps; chrome observer; metal
  plates; lifting-history CSV import Strong/Hevy/generic + "Bring my history"; shared-map caps)
  88353d8, bc07d2c, 1eb1545 → wave 3 running (two-device merge, word-cap test, sw-update, review, QA).
- **Verified how:** full no-Chrome suite 9,185 PASS / 0 FAIL at 1eb1545; rules test under the emulator
  all pass; WebKit 393×659 + 1366×820 demo on 15 routes: no page/side overflow, no console errors.
- **Open:** wave 3 results; report to Tim with the choices he hasn't seen (Barlow font, glass 80/78 %,
  grain + ember glow, sidebar mark, Settings layout, new labels incl. "Bring my history", "Lighter
  week", "Equipment today", "Empty workout", "Update <Workout>", "Sit out").

## 2026-09-27 late (cont.) — overhaul waves 3–5, DONE
- **Built:** wave 3: two-device list merge (dc931dc), word-cap test + ~20 cuts (3413389), deploy
  notice fixed (b021f76), Auto theme follows phone live (c277558), import skips logged days + unit
  question + Sets column (7a486b9). Wave 4 (6c513fd): offline edits/settings/deletes reach the cloud,
  undo safety, equipment/warm-up plate snap, sticky exercise name, estimate fixes (singles rule, break
  rule, Reached = 2 days at target), laptop two-column lists. Wave 5 (0668e46): light buttons, toast,
  ? pop-ups 95 %, laptop alignment, Settings fits with mini strip, tap targets, glass name band.
- **Decided (not seen by Tim):** Barlow titles; glass 80/78 %; grain + ember glow; sidebar mark;
  Settings layout 13px/32px chips; labels "Bring my history", "Lighter week", "Equipment today",
  "Empty workout", "Update <Workout>", "Sit out"; two-column laptop lists; sticky name on a glass band;
  "End this goal" a button; import collisions skipped by default; 7-day break rule; warm-ups snap to
  plates; white light-theme controls; `.set-del` 44px hit area REVERTED (must-not-change).
- **Verified how:** no-Chrome suite 9325 PASS / 0 FAIL; rules 274/0 and sync-merge 14/0 under the
  emulator; WebKit smoke 30 routes at 393×659 + 1366×820, no overflow/errors; screenshots looked at.
- **Open:** NOT verified list in progress.md (real iPhone, real exports, SDK versions).
- 2026-09-28: Tim asked for an overview by category (given in chat: estimates, using the app, look,
  intro, words, Settings, new features, behind the scenes), then "prepare md files for chat reset".
  Nothing new authorized; waiting on his reaction to the unseen choices above.

## 2026-09-28 · Brother's "Not signed in" screens
- **Asked:** Tim's brother (iPhone) got "Something went wrong · Not signed in." on Record/Account and
  "Could not load your profile" on Profile; Tim: check and fix.
- **Cause (reasoned, then reproduced):** start-up signs in anonymously, but when Firebase drops the
  user later (saved account deleted / token refused) the listener left `user` null for the visit.
- **Built (9511103):** `createUserKeeper()` in firebase-backend.js — any no-user moment takes ONE
  fresh guest account (shared promise); `init()` waits on it; signOut/deleteAccount use it.
  `tests/auth-keeper.test.mjs` fails on the old code, passes now.
- **Verified how:** no-Chrome suite 9336 PASS / 0 FAIL (+ plates-visual 186); live WebKit iPhone:
  forced `signOut()` via the SDK on `#/record`, uid changed, `#/me` loaded normally, no errors.
- **Open:** if the brother had a real account, he must sign in again from Account (the drop is
  Firebase's). Test runs left ~3 stray anonymous users in fitness-tracker-th (harmless).

## 2026-09-28 (cont.) · "Investigate how people log in and anticipate other problems"
- **Did:** 3 read-only reviewers (auth layer, sign-in screens, iPhone/Safari environment), then fixed
  the clear bugs: 14c5c1a + 49fb4da (list in the 14c5c1a message). Biggest: sign-in warning now
  counts a guest's CLOUD rows; "You were signed out" card + pre-filled email when Firebase drops a
  real account; Google delete re-confirms BEFORE the purge; no dead-end redirect; 15 s start-up stall
  limit; cache epoch on account switch; "Continue in this window" button was ALWAYS visible (.btn
  beat [hidden]) — hidden now.
- **Verified how:** suite 9532/0 (auth-keeper test extended; render mock fixed to real
  `offline:true` shape); live WebKit 393px `#/account` with a seeded droppedAccount shows the card,
  1366px `#/signin` clean, no overflow/errors.
- **Left for Tim (his calls):** Safari's 7-day storage wipe loses guest data → nudge to secure the
  account after the first workout?; "Add to Home Screen" hint implies data comes along (it doesn't —
  separate storage); merge guest workouts on sign-in (D: never on sign-in, 2026-09-08); email
  verification / typo check; reset toast wording + spam hint; sign-out doesn't clear the workout draft
  (shared phones); moving hosting so Google redirect works; App Store needs native Google + Apple
  sign-in. Not checked: Google delete popup after awaits on iOS (if blocked, nothing is deleted).
- **Then:** Tim asked whether to move off GitHub Pages (Firebase Hosting would fix Google redirect).
  Claude: not now — popup already works in the home-screen app, a new origin strands every guest's
  data + installs + links; do it once with the rename if ever. Tim: *"okay don't do it."*
  Suggested cheap check for him: Continue with Google in a plain Safari tab. Then checkpoint.

## 2026-10-17 · Project-lead batch (portfolio manager, batch 1)
- **Asked (Tim via manager):** *"any fixes or improvements you feel confident about go ahead and do,
  pretty much always. You don't have to ask me."* Goals: fix open sweep bugs; make sure phones get new
  builds without a hard refresh; commit `Fitness_Research/weightlifting.md` if it belongs; cut the
  Waiting table to ≤5 decisions.
- **Built:** 9 fixes + the update gap, one commit, test `tests/lead-1017.test.mjs` (26 checks, all
  failing on d25fab3 first). List in progress.md "Lead batch 2026-10-17". The update mechanism
  already existed (network-first page, update bar, check on resume); the gap was a MIXED BUILD after
  Refresh (lazy screens never fetched stayed old). Fixed in sw.js + app.js.
- **Decided:** `Fitness_Research/weightlifting.md` NOT read or committed — Tim's standing rule
  (2026-09-18) says that folder is his research agent's; never read, edit or report on it.
  Working copy was CRLF (system autocrlf) → shell.test crashed; repo-local autocrlf=false + LF.
- **Verified how:** full plain suite (see progress Map line); WebKit demo, local server, Firebase
  hosts blocked, SW blocked: `#/goal/systems` and `#/account` at 393×659 and 1440×900, no errors or
  overflow; live curl of sw.js after push.
- **Open:** 5 decisions in progress.md Waiting table.

## 2026-10-17 · Data-safety fixes (builder, manager brief)
- **Asked:** 7 audit findings: overlapping saves deleting a cloud workout; Save hanging offline;
  Clear all/Restore leaving the friends copy + photos; lazy-import failure after a deploy; comment id
  spoofing in rules; sign-out leaving the shard cache; `#/day/garbage`.
- **Built:** list in progress.md Status "Data safety 2026-10-17". data-layer tests now name deletes.
- **Verified how:** old code: shard race lost a session 3/10, list 1/10, store saveSession 1/10;
  clearAll 0 publishes. New: datasafety 30/30, ui 11/11, sync-merge 14/14 (emulator), data-layer 3018/0, full plain suite 0 FAIL,
  rules emulator 306 PASS, then rules deployed. WebKit 393px + 1280px demo shots of the save line.
- **Open (Tim's call):** wording "Saved on this phone — will upload." and "That day does not exist /
  The link may be broken." Not done (brief): comment purge on delete-account, cloud-fallback banner.

## 2026-10-17 · Calculation audit fixes (builder, manager brief)
- **Asked:** 5 audit findings: rep caption contradicting max/plan; observedDaysPerWeek fencepost;
  trainingForMuscle counting empty entries; Graph skipping drop/myo minis; Profile "usual" ceil and 0.
- **Built:** progress.md Status "Calculation audit 2026-10-17". Tests estimate/prog-overhaul/
  review-runnerA re-pinned to the new rules (old Nuzzo mean, span 16 → 16.33, column guard).
- **Verified how:** calc-1017 25/30 FAIL on 151b08b, 30/30 after; full plain suite 94 suites 9,666/0
  after rebase on 3ffe3c3. WebKit demo (SW + Google hosts blocked) Upper B at 393×659 and 1440×900:
  50/side after 55/side × 12 reads "maybe 12–15" (was "15+"), visible without scrolling, no overflow.
- **Open (Tim's call):** the caption change partly reverses his 09-13 "Nuzzo with a band" pick;
  "usual 0" now shows; 9-in-19-days reads 3.11/wk (fencepost rule), not exactly 3.0.

## 2026-10-17 · Visual bug fixes (builder fix-visuals, from the manager's audit)
- **Asked:** Tim: *"extreamly in-depth analysis … visuals that don't work … work on improving."* 7
  listed visual bugs; not his calls (goal wording, feed layout, tiny text, colour ramp…) left alone.
- **Built:** css/app.css + `withDot` in views-social.js (list in progress.md "Visual bug fixes").
- **Decided (Tim hasn't seen):** a friend's calendar now sits at the top of the right column beside
  their face (was 14px lower); laptop Bars shows ~14 rows and scrolls inside instead of 20 cramped;
  under 380px the Colour chips wrap to two lines.
- **Verified how:** headless WebKit probe (demo, SW + Firebase blocked), original CSS vs new at
  393×659 and 1280×800, dark + light; 360×640 spot check; full plain suite after rebase (0 FAIL).

## 2026-10-17 · Runner audit fixes (builder fix-runner, from the manager's in-depth audit)
- **Asked (Tim via manager):** *"an extreamly in-depth analysis … features that you think are
  annoying … movement that is poor … work on improving."* Rule: content never moves when you tap.
- **Built (`tests/runner-1017.test.mjs`, 21 checks, 15 failing on 151b08b first):** ± hold-repeat
  stops on a window-level lift/cancel/blur or a detached button (was 205 → 315 on its own) · set 1's
  steppers stay put when suggested warm-ups are added/removed above (`refreshWarmRows` anchor) ·
  number boxes are `type=text` and select the old number on tap (1800 over 180 gave 1180080); a typed
  weight > 5000 lb is refused silently; "62,5" reads as 62.5; laptop ↑/↓ still step · Today's
  exercises: tapping a name goes there and closes · person chips get their full 44px (strip clipped
  it to 40; `overflow-y:hidden` + 7px padding given back by margin) · Auto-guide holds two caption
  lines so warm-up → set 1 doesn't drop the steppers 23px.
- **Verified how:** headless WebKit 393×659, demo, SW blocked: + stepped 180→250→150, + button y
  spread 194px → 0; guide steps y spread 23 → 0; chip hit 40 → 44 with content y unchanged (174);
  no overflow, no console errors at 393 and 1280.
- **Open / not fixed:** WebKit still scrolls the pane 10–26px when the number box takes focus
  (native focus-scroll, pre-existing); a typed weight that removes warm-ups while the pane is near
  the top can't be fully compensated (nothing to scroll back).

## 2026-10-17 · Motion/speed audit fixes (builder fix-motion, from the manager's audit)
- **Asked (Tim via manager):** *"… movement that is poor … work on improving."* Rule: content never
  moves when you tap; visible motion, not teleportation. Not done (Tim's calls): minify step, runner
  row jump on Finished, stiffer nav springs.
- **Built:** progress.md Status "Motion/speed audit 2026-10-17" (sw race, idle warm-up, memo, frame-
  batched reads, Profile switch hold + Months glide, Data row height, update bar spring, :active,
  16px date box).
- **Decided (Tim hasn't seen):** Months still lands on this month (his 09-12 ask) but slides there
  (~200 ms) instead of keeping the switch put; Data → Graph's two-line controls row on a phone still
  moves content 40px (only the other tabs are level now); pressed looks copy chip/icon-button styles.
- **Verified how (Chrome iPhone size, demo, Firebase blocked):** first Profile tap 1x gap 683 → 117
  ms, 4x 4,744 → 1,032 ms; slow nav 8.6 → 2.6 s; Profile Years switch y 119 → 116 (WebKit + Chrome),
  laptop 399 → 399; Data content top 180/165/220/136 → 180/180/220/180; update bar above the runner
  footer at 393 and 1280, no overflow or console errors. Suites 96 / 9,704 PASS / 0 FAIL, sw-update
  13/0. Live at b4d3c81.
- **Open:** iOS zoom on the date box only provable on a phone.

## 2026-10-17 · Manager close-out of the in-depth audit
- **Asked:** Tim: *"extreamly in-depth analysis on fitniss tracker … Keep working until you don't
  think you know what to improve or work on anymore."*
- **Did:** 5 read-only analysts (calc, logic/data, runner, visuals, motion) → 5 builders, all merged
  and live (3ffe3c3, 5fd5a3c, b878399, 6d9b689, b4d3c81/fd8e47e). Everything left is Tim's call
  (looks, wording, layout) — collected in progress.md Waiting.
- **Verified how:** full plain suite on main fd8e47e, 0 FAIL (rules/sync-merge/sw-update excluded);
  live-check confirmed each build on Pages.
- **Open:** OneDrive-locked `.git/worktrees/fitness-*` leftovers for the weekly sweep.
