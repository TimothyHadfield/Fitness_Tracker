# Fitness Tracker — Handbook (§0–§10)

> **The reference sections, exactly as they stood in `progress.md`.** Moved here on 2026-09-04
> because that file had reached 626 KB and could no longer be opened in one read. **The section
> numbers did not change — only the file they live in did.**
>
> 🚨 **EVERY `§N` CITATION IN THIS PROJECT MEANS THIS FILE.** Code comments, `docs/*.md` and
> `progress.md` cite sections by number — `§4` for the architecture, `§6` for the locked decisions,
> `§9` for the known gaps, `§0.10` for the demo account. Every one of them resolves here.
>
> 🟢 **READ THIS WITH `progress.md` AT THE START OF A SESSION — both, not one.** `progress.md` is
> what is TRUE NOW and what is LEFT. **This is how to work here**: the environment traps that have
> each cost real time (§0), the working agreement (§1), what the app currently does (§3), the
> architecture (§4), the binding design rules (§5), and the decisions that are locked (§6).
> ⚠️ **Skipping it is how a rule that was learned expensively gets re-learned expensively.**
>
> 🚨 **`docs/direction.md` IS NEWER THAN THIS FILE AND OVERRULES IT WHERE THEY DISAGREE.** On
> 2026-09-04 Tim answered a long interview about what this project is for, and **four rules written
> below were reversed by his answers**: the blanket honesty refusals, the ban on a discovery feed,
> the "not verified on a phone" warnings, and whether visuals may be touched unprompted. **This file
> was NOT rewritten to match** — the old reasoning is worth keeping and direction.md quotes both
> sides, so read it first and you will know which paragraphs here are history.
>
> ⚠️ **WHERE THE SECTIONS BELOW SAY "the section above" OR NAME A DATE, THEY MEAN
> `docs/history.md`.** These sections sat under the dated log for months and cite it constantly. The
> wording was left as written rather than swept, because rewriting dozens of pointers by hand is how
> a wrong one gets introduced. **One rule: a date means the history file.**

---

## 0. Read this before your first tool call

1. **Git: this folder has its own nested repo.** The parent `Code Projects/` folder is a *separate*
   repo whose remote is `Estimator_Quiz`. **Always run git from inside `Fitness_Tracker/`**, or you
   will commit to the wrong repository.

2. **Don't `cd` outside the workspace in Bash.** Commands that leave the project directory trigger a
   scope check and prompt Tim. Use absolute paths from within the project. He has asked repeatedly
   not to be prompted.

3. **Keep the four documents current without being asked, and push when done.** Tim's whole workflow
   is to reset the chat and say only *"catch up with progress.md"*. If they are stale, the next
   session starts blind.

   🚨 **AND SINCE 2026-09-04 THE WRITE-UP GOES IN A DIFFERENT FILE FROM THE SUMMARY. This is the
   rule that keeps progress.md readable, and there is no point in the split if it is not followed:**

   - **`docs/history.md`** ← the session's **full dated section**, appended **at the TOP**.
   - **`progress.md`** ← its **one-line summary**, plus anything that changed about the state, the
     standing instructions or **Open work**. Nothing long.
   - **`docs/handbook.md`** (this file) ← only when a RULE changed: a new trap in §0, an
     architectural move in §4, a design rule in §5, a decision locked in §6.
   - **`docs/direction.md`** ← only when **Tim says something about what the project IS** — who it
     is for, what it competes on, what he wants loosened, how he wants to be worked with. ⚠️ **A
     feature request is not direction**; that is `docs/vision.md` or Open work.
   - **`chat.md`** ← the human-readable exchange, as before.

   ⚠️ **progress.md reached 626 KB doing it the old way and stopped being openable in one read**,
   which broke the instruction at the top of it. Putting a full write-up back into it walks straight
   into that again.

   🚨 **THERE IS A TEST, AND IT IS IN THE `sw.js` PRECACHE BLOCK OF `tests/data-layer.test.mjs`
   BECAUSE IT IS THE SAME KIND OF FAULT.** Every file you are told to read whole has a byte budget
   — progress.md 160 KB, this file 220 KB, chat.md 220 KB — set **well under the 256 KB read limit
   so it fails while there is still room to act.** 🛑 **When one trips, the fix is never to raise the
   number**; the failure message names what to move and where. The archives (`docs/history.md`,
   `docs/chat-archive.md`) have no budget by design, and the test says so in a comment so nobody
   "fixes" them. One more assertion checks that **this item still states the rule** — otherwise the
   files stay split while the habit that split them lapses.

4. **The Firebase CLI is installed and already authenticated** as `timhadfield7@gmail.com`. You can
   create projects, deploy rules, and call the admin APIs directly. An access token can be minted
   from the CLI's stored refresh token — that is how Auth providers were configured. Don't assume
   console-only until you've checked.

5. **A browser really does render this app, and can be driven.** Chrome and Edge are both installed.
   Screenshotted and eyeballed across sessions: Home, Workouts, Calendar, Settings, Muscles, the line
   chart, the session runner, the edit-record screen and the account screen, at 360 / 390 / 880 /
   1180 / 1280 px in both themes. **Still unverified: any real device, iOS Safari, touch, and the
   installed PWA.** jsdom is the *structural* check; a screenshot is the *visual* one; CDP is the
   *behavioural* one. Be precise about which you mean — several real bugs this project has shipped
   were invisible to two of the three.

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

   Also: copy the app to a scratch dir before changing `firebase-config.js`; never edit the real one.
   Blank it (`IS_CONFIGURED = false`) for ordinary layout work. To exercise the CLOUD path — the
   account screen, the offline fallback — write a config that is *shaped* like a real one but points
   at a project that does not exist, so the test can never create a user in `fitness-tracker-th`.

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

9. **The Firestore emulator dies SILENTLY on the Oracle JDK.** Exit code 4294967295 (−1), an empty
   `firestore-debug.log`, and zero bytes on stdout *and* stderr — no stack trace, no `hs_err` file.
   It presents as a broken install and is nothing of the sort: `java -jar <emulator> --version`
   prints fine, so the JVM and the archive are both sound, and only *serving* dies. **Temurin 21
   works first time.** Both JDKs are installed; point `JAVA_HOME` at
   `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot` before running the rules tests.

   ⚠️ Do not "fix" it with an older JDK: `firebase-tools` refuses to run below Java 21 outright, so
   Temurin **17** — the obvious first guess, and the one recommended for this emulator everywhere —
   is rejected by the CLI before the emulator is even reached. The working window is narrow: **the
   CLI needs ≥ 21 and the emulator jar needs a JDK that is not Oracle's.** Cost about half an hour;
   `docs/social-plan.md` §7.1 lists everything that was ruled out first.

10. **⚠️ Need a populated app to look at? Use the DEMO ACCOUNT — do not hand-seed one.** Every
    session before 2026-08-19 wrote its own throwaway systems and sessions in order to screenshot a
    screen, which is slow and produces data far too thin to exercise the charts, the muscle map or a
    goal. There is now a generated year behind one flag: set
    `sessionStorage['ftrack:v1:demo'] = '1'` and reload, and the store swaps to an in-memory backend
    holding two programmes, ~200 sessions, 20 benchmarks, 53 weigh-ins and a goal part-way through.
    **Nothing it does can reach localStorage or Firestore**, so it is also the safest thing to drive.
    ⚠️ **That sentence was FALSE for months and is true again as of 2026-08-22.** The store swaps its
    backend, but the session runner's draft never went through the store — it went straight to
    localStorage, so running a workout in the demo left invented sets on the real device and they
    survived leaving it. Found by the UX review. The draft now follows the demo flag into
    sessionStorage. **The lesson is about the claim, not the leak**: this file and a strip on every
    demo screen both said "nothing is saved", and the one write that bypassed the store was the one
    nobody thought to check. *An absolute safety claim needs a test, not a design argument.*
    `demo.enter()` / `demo.exit()` in `store.js` do it with a reload. Clear the flag when you are
    done, or your next screenshot is of somebody else's year — and note it is per-TAB, so a fresh
    Chrome profile starts outside it.

    It is also the fastest way to sanity-check a change to any derived number. Running the demo year
    through the real ranking pipeline is what exposed the credibility inversion in §9, which 1069
    assertions had missed for two months.

11. **⚠️ Never bulk-edit a file through PowerShell.** `Get-Content -Raw` in PS 5.1 decodes as ANSI,
    not UTF-8, so a read-modify-write with `Set-Content -Encoding utf8` **double-encodes every
    non-ASCII character in the file** — every em dash, arrow and ⚠️ in these docs. It is silent, it
    touches lines you never edited, and `git diff --stat` is how you notice: a four-line change
    showing 98 changed lines is this and nothing else. Cost about ten minutes on 2026-08-19; both
    files were restored with `git checkout --` and redone through the editor. Use the editing tools
    for file content and keep PowerShell for running things. (Appended at the end for the same
    reason item 10 was: renumbering breaks the §0.6 / §0.7 / §0.9 references used elsewhere.)

    🚨 **AND ON 2026-09-07 IT HAPPENED FOR THE FOURTH TIME, ON A ONE-LINE MUTATION CHECK.** Every
    earlier instance was a bulk edit of prose, which is what the rule above describes and is why it
    kept being read as a rule about sweeps. This one was a **deliberately temporary code change,
    intended to be reverted ninety seconds later** — the exact case that feels far too small to open
    an editor for. `js/live-session.js` came back with every em dash and ⚠️ double-encoded.

    ⚠️ **A MUTATION CHECK IS THE MOST DANGEROUS PLACE IN THIS WORKFLOW TO REACH FOR A SCRIPT**, and
    the reason is structural rather than careless. The edit exists to be thrown away, so nobody
    diffs it afterwards; and the revert — which puts the mutated line back exactly as it was —
    **restores that one line and leaves the encoding damage in every other line of the file**. On a
    NEW file there is no `git diff` to notice it with either. The rule needs no exception for
    temporary edits, and the temptation is strongest exactly there. Read the bytes if in doubt:
    `[System.IO.File]::ReadAllBytes(path)` — an em dash is `E2 80 94`, and `C3 A2 E2 82 AC` is this
    bug.

12. **⚠️ THE STORE CACHES ITS READS, AND ITS ONE CONTRACT IS THAT THE STORE IS THE ONLY WRITER.**
    Since 2026-08-22 `store.js` keeps each collection in memory, because every tab was re-fetching
    collections it already had and on Firestore each of those is a network round trip. Two things
    follow for anybody working on this:

    - **If you write to `localStorage` directly** — a test seeding old-shape rows, a script setting
      up a scenario — the store will not see it. Call the exported **`clearReadCache()`** and say why.
      Three tests in `data-layer.test.mjs` do exactly this and carry the note.
    - **Cached getters only.** Mutations read straight from the backend on purpose: this store does
      read-modify-write everywhere, and rewriting a whole collection from a stale copy erases
      whatever changed elsewhere. **If you add a mutation, read fresh.** `saveSettings` was the one
      that went through a getter and there is an assertion pinning it.
    - ⚠️ **SINCE 2026-08-27 THE SAME CACHE COVERS THE CLOUD SOCIAL READS** — the graph and the
      invite list — with the same contract and the same 30-second silent revalidate. Mutations call
      **`readGraphFresh()`** and **`socialWrote()`**; only `state()` and `invites()` are served from
      memory. Clearing is wired **inside `clearReadCache()`**, so an identity change drops both.

13. **⚠️ WHEN TIM SAYS SOMETHING IS MISSING OR BROKEN, CHECK THE LIVE SITE BEFORE READING CODE.**
    This has now happened twice in one day and both times the app was fine and his phone was serving
    a cached build — once for the years grid hours after it shipped, once as a Firebase auth page
    filling the screen. **One command settles it:**

    ```bash
    curl -s https://timothyhadfield.github.io/Fitness_Tracker/js/views-data.js | grep -c Years
    curl -s -o /dev/null -w '%{http_code}
' https://timothyhadfield.github.io/Fitness_Tracker/js/year-grid.js
    ```

    Then, if the file is deployed, drive a **clean browser profile at the live URL** (§0.6) — a fresh
    profile has no service worker, so it sees what the server is really serving. Only after that is
    it a code question. ⚠️ **An installed home-screen app resumes on its last page and can be many
    builds behind**; the app now checks for updates on resume, but a build that predates that fix
    cannot help itself.

14. **🚨 A MUTATION CHECK THAT PASSES PROVES NOTHING UNTIL YOU KNOW THE MUTATION LANDED ON THE CODE.**
    This project mutation-checks constantly, and the check has exactly one failure mode: **it fails
    in the reassuring direction.** On 2026-09-06 a colour fix was verified by replacing its hex and
    re-running the suite. The suite stayed green, which should have meant the new assertion was
    vacuous and worthless. It was not — **the string replacement had hit the same hex written in the
    COMMENT above the rule**, and the rule itself was untouched. The test was fine; the evidence for
    it was fabricated.

    ⚠️ **The asymmetry is what makes this dangerous.** A mutation check that fails tells you
    something true immediately. A mutation check that passes looks exactly like a vacuous test, and
    the natural response — rewrite the assertion — is work spent on a problem that does not exist,
    while the real one (a check you cannot trust) survives.

    **So: make the mutation observable before you trust either outcome.** Print the mutated line, or
    assert the replacement count, or pick an anchor that cannot appear twice. Comments in this
    codebase quote the values they explain constantly, so a bare
    `s.replace('#82570B', …)` is a coin toss about which one it finds. The same trap applies to any
    constant a comment repeats — a ratio, a threshold, a byte count.

    🆕 **AND THE OTHER HALF, 2026-09-07: AN ASSERTION THAT SURVIVES A MUTATION IS TELLING YOU ABOUT
    THE ASSERTION.** Restoring the "starting another workout deletes the open one" bug flipped four
    tests and left a fifth green — *"nothing was thrown away while the question was being asked"*,
    which read `Boolean(loadDraft())`. The wipe writes a **fresh** draft for the workout you just
    opened, so something is always on disk and the check could never fail. It now asserts the draft
    is still the right workout's. ⚠️ **The reflex when a mutation leaves an assertion standing is to
    assume the mutation missed** (the trap above); the other possibility is that the assertion is
    weaker than its own sentence, and it is worth ruling in rather than out — **a mutation check
    tests the tests, and both of its failure modes are informative.**

---

## 1. Working agreement

Tim is the **manager**; Claude is the **builder**.

- Tim describes the vision. Claude designs and implements it.
- **Recommend and proceed — don't ask.** Tim, 2026-08-15: *"Just stick to what you recommend, it's
  going to be better than what I say 90% of the time."* Take that as licence to decide, **not** as
  licence to stop listening — he found the source-mixing bug, correctly diagnosed the level-flipping
  bug, and his percentile spacing held up under modelling. Say so when he is right.
- **Never ask Tim what to work on next.** Questions are only for clarification or a decision *inside
  a job he already gave you*. Between jobs: say what's done, say what you noticed, stop. A question
  box forces him to answer it instead of replying to what you said — and most of the time what you
  want to do next isn't what he wants done next. (Tim, 2026-08-16.)
- **Questions that ARE in scope go in the AskUserQuestion box, never in prose.** Tim often doesn't
  read a full reply.
- **Talk to Tim in plain short sentences. Never say "D5" or "D14" to him** — say the actual thing
  ("we don't mix benchmarks with workout sets"). The decision codes are for these docs only. No long
  progress reports, no headers and sections for an ordinary update. Two lines when the work is done,
  or "X broke because of Y — should we do A or B?" (Tim, 2026-08-16.)
- **Always commit and push when a piece of work is finished — don't ask.** Pages redeploys in ~40s,
  so pushing is how he sees anything. Update the docs in the same commit.
- **State what is unverified.** This project's whole credibility rests on not overclaiming.

### File upkeep

| File | Job |
|---|---|
| `progress.md` | **The catch-up file.** What is true now, the standing instructions, and **Open work** |
| `docs/direction.md` | 🚨 **What Tim wants this to BE** — the 2026-09-04 interview, and the four rules it reversed. **Newer than this file and overrules it** |
| `docs/handbook.md` | **This file — §0 to §10.** Every `§N` citation in the project resolves here |
| `docs/history.md` | **The dated log**, newest first. Searched by date, never read whole |
| `chat.md` | Chronological human-readable log, appended after each substantive exchange |
| `docs/vision.md` | **Tim's running list of what he wants this to become.** A capture, not a schedule: nothing starts off it without him saying so. ⚠️ **SIX ideas, and this row undercounted them and misreported four until 2026-09-02.** §1.1 (social), §1.3 (ready-made systems AND its "% optimal" number), §1.4, §1.5 and §1.6 are **BUILT**; **§1.2 is half built** — Home suggests which workout, and the weight/rep half waits on the estimator. ~~"§1.1 is untouched"~~ is the worst of it: §1.1 is the most-built idea in the file and the whole of 2026-09-02's first pass. §8 of this file already said "all six are started and five are finished", so the two contradicted each other. Entries are marked BUILT in place and never deleted — the superseded reasoning above them is the point of the file |
| `docs/spec.md` | Product + technical spec, data model |
| `docs/research.md` | **All research, by category**, evidence graded 🟢🟡🔴 with sources. Append — never start a new research file. ⚠️ **§13 is the one that is on a user's screen**, so a wrong grade there is a wrong claim in the product |
| `js/exercise-images.js` | Not a doc. **The exercise-picture manifest — GENERATED, never hand-edited.** Read its header before touching pictures: it records why the art is absent (Gym Visual is a paid library), why the manifest is keyed by id rather than name, and why a manifest exists at all (D6 — the service worker can only precache a file it is told about). `img/exercises/README.md` is the how-to |
| `js/exercise-families.js` | Not a doc. **The swap sheet's alternatives — read its header before adding a member.** A family is a MOVEMENT, not a muscle; one family per exercise, asserted; and ⚠️ **four exercises are deliberately family-less because their lookalike is the opposite movement**. Members are named strings, so a test resolves every one to exactly one exercise |
| `js/research-topics.js` | Not a doc. **The Research tab's eleven topics — read its header before adding one.** Every claim names a source, every source is defined ONCE, every topic states its own limit, and nothing goes on that screen below "limited evidence". ⚠️ **Anything added here must be added to `docs/research.md` first**, with its grade and its limitations |
| `js/preset-systems.js` | Not a doc either, but read its header before adding a system: it records exactly what may and may not be shipped from someone else's programme, and why |
| `js/muscle-evidence.js` | Not a doc, but read it before touching ranking: the ratio tables, the fallback rules and the confidence model all live there with their reasoning |
| `js/optimal.js` | Not a doc. Read it before touching the rating: the dose-response curves are **fitted to published values, with the derivation in a comment on each constant**, and the header lists the three things the rating refuses to do — reward extra training days for growth, extrapolate past the evidence, or imply precision the source lacks |
| `tools/volume-ramp.mjs` | Not a doc, and dev-only. **The red-to-green ramp the Volume body map is painted in — GENERATED, and `css/app.css`'s five `--vol-*` hexes are its output.** ⚠️ **Read its header before touching a colour**: red-to-green is the worst pairing there is for colour blindness and it is defensible only through strictly monotone lightness (which the tool proves under three CVD simulations) plus the legend, labels and list that state every number in words. `tests/a11y.test.mjs` regenerates the hexes and fails if the stylesheet has drifted from them |
| `js/volume-map.js` | Not a doc. **⚠️ Not the same table as `muscle-evidence.js`** — that one asks "how strong is this muscle", this one asks "how much work landed here". Direct 1.0, indirect 0.5. ⚠️ **Since 2026-09-01 it is also on a screen of its own** (Data → Volume, D3), so its efficiency tiers and its `INDIRECT_NOTE_*` sentences are read by users rather than only by the rating — and the per-screen consequence clause pattern applies: one shared statement of what the 0.5 IS, one sentence per screen saying what would change without it, **both shipped from beside the constant** |
| `js/social.js` | Not a doc. **Read its header before touching anything social**: it explains why sharing publishes a copy rather than widening a permission, and why the builder is a whitelist — a delete-based one fails OPEN the day somebody adds a field. 🚨 **THE TIERS ARE GONE AS OF 2026-09-03** — it is two audiences now, `friends` and `public`, and the one field they disagree about is body weight. Wired to `views-social.js` since 2026-08-18, and ✅ **two real accounts connected over the live project on 2026-08-22** — invite, claim, accept, tier, publish, read, downgrade, disconnect, each one checked against what Firestore actually hands the other account. See item 1 for the two defects it turned up |
| `js/set-types.js` | Not a doc. Read its header before touching supersets or drop sets: it explains why they are **two different shapes** and why drops nest inside a set rather than sitting beside it (D23) |
| `js/exercise-estimate.js` | Not a doc. **What could you lift on an exercise you have never done** — the body map's arithmetic run backwards. ⚠️ **Read its header before touching it**: it explains why this is not a new model, why D14 did not need reopening, and the line it draws — *an estimate you read is not an estimate you lift*, so it has no quality gate where the runner's opening-weight suggestion has two. Also holds the rep prediction, which is capped at 15 for the same reason D5 caps evidence |
| `js/strength-observations.js` | Not a doc. **The walk that turns sessions and benchmarks into per-muscle evidence**, extracted out of `store.js` on 2026-09-02 so a FRIEND's published training goes through the identical arithmetic. ⚠️ `today` is handed in, never read from a clock — that is what makes the golden table in `tests/data-layer.test.mjs` date-stable |
| `js/shared-map.js` | Not a doc. **Somebody else's muscle map, turned back into the shape our own panel renders** (2026-09-03). ⚠️ **Read its header before touching the compare screens**: it explains why the arithmetic is NOT redone on the reader's device, and the one thing it deliberately cannot do — recompute a percentile, which needs a body weight the public document does not carry. A comparison group with no published row is a stated outcome, never a silent fallback to their default |
| `js/session-draft.js` | Not a doc. **The workout in progress, on disk** — and `liveDraft()`, the one copy of "a draft only lives for the day it was started". ⚠️ **Read its header before moving anything back into the runner**: the bar on every screen and the runner have to answer "is one open?" identically, and the bar cannot import the runner |
| `js/live-session.js` | Not a doc. **The bar above the nav that says a workout is still open** (2026-09-07, Tim's ask, modelled on Hevy). ⚠️ **It is the last child of `.screen`, not a sibling of the navbar** — its header has the layout argument, and the short version is that `#app` is `column-reverse` on a phone and `row` on a desktop, so a sibling is above the nav on one and a third column on the other. 🚨 **The second line goes through `stepsFor`, never `entries[index]`** — a superset is one step per member per round |
| `js/session-stats.js` | Not a doc. **One session's own numbers, and the file to read before anyone adds a volume figure** — its header is the argument for why the feed card's middle column counts SETS: a friend's bodyweight work has no external load to total and their body weight publishes only at the top tier, so a pounds figure would read a session of pull-ups as nothing. ⚠️ **`recordedSetCount()` lives here and `store.js` imports it** — the Volume tab, the feed card and the workout screen must never disagree about whether a set was done |
| `js/personal-bests.js` | Not a doc. **Typed records — Weight · Volume · Reps · 1RM.** ⚠️ **Read the note about Rule 5 first**: this function used to be estimate-free by construction and the 1RM kind broke that, so the rule is now honoured by LABELLING — `estimated: true`, the word on screen, and the line naming the set the model was fed. ⚠️ Mini-sets count on **both** sides; per-side doubles **volume only** |
| `js/compare.js` | Not a doc. **You and a friend on one exercise, and it refuses to name a winner** (Rule 6) — `NO_VERDICT_HEADER` is its own sentence saying so, printed rather than paraphrased. ⚠️ **Read the windowing argument before touching it**: their sixty published sessions against your whole history flatters you every time in the same direction, so both sides are cut to the overlap |
| `js/routine-from-session.js` | Not a doc. **A friend's workout → one of yours.** Set counts and supersets carry; **weights cannot, by construction** — a workout template has no field to put one in, which is deliberate: their 185 lb bench would be a prescription to you |
| `js/share-image.js` | Not a doc. **The shareable picture** — a pure `shareCardLayout()` plus a thin painter, the same split `qr.js` uses so the half worth testing is testable. ⚠️ **No weights on it**, enforced in the module rather than trusted to the caller, because the image leaves the app. The card sizes itself to its contents (1080–1350) — do not pass a `height` |
| `docs/strength-map-plan.md` | Design + decisions for the Muscle Groups map. **§7 is where the fill/ink split is explained** |
| `js/demo.js` | Not a doc. The demo account's generated year. **Read its header before touching it**: it explains why the data never touches storage, why the flag is per-tab, and why nothing in it may use `Math.random()`. The switch itself is in `store.js` |
| `js/goals.js` | Not a doc. **Read its header before touching Goals**: it explains why a goal is a LEVEL and not a predicted number of pounds, why the target weight is FROZEN when the goal is set, and the two things the module refuses to do — read the deadline to decide what it asks of you, and emit a verdict |
| `docs/improvement-plan.md` | **The plan, written 2026-08-19 on Tim's ask.** ⚠️ **§0 is the part to read first** — it lists seven reviews that were scoped and briefed and then **all killed by a session usage limit before returning anything**. Sections marked ⚠️ NOT AUDITED are hypotheses, not findings. **Three of the seven have since run and four are left**, and the table in §0 carries each one's status. §1.1 — the first-run path promising "workout" and delivering "system" — was the one finding verified by hand, and it was **fixed 2026-08-21** |
| `docs/fatigue-plan.md` | **Within-session fatigue and the strength estimate**, written 2026-08-24 on Tim's ask after a real back session. **Plan only — nothing in it is built.** ⚠️ **§1 is the part to read**: fatigue does not merely depress a reading, it **promotes** it, because `evidenceWeight` rewards low reps and a spent lifter does few reps. His fatigued third exercise out-ranked his best lift by 0.005, entirely on a rep count. §3 is why no re-weighting scheme is worth more than 5 lb while doing the lift fresh is worth 60, and §4 is why the load multiplier he suggested is the one option that cannot be built honestly today |
| `docs/goals-plan.md` | **Goals** (`docs/vision.md` §1.6). **Phases 1–2 BUILT 2026-08-19 — §11 records what the build decided that the plan did not.** **§3 is still the section to read** — four problems, one serious: raising weights to hit a deadline would hand heavier weights to somebody who has missed two weeks, which is backwards and is the only thing in this project that could cause physical harm. §8 is the progression rule Phase 4 needs. §10 is what may and may not scale with ambition — and §11.4 records where the build departed from it |
| `docs/optimal-rating-plan.md` | **The "% optimal" rating** (`docs/vision.md` §1.3), planned 2026-08-18. **§2 is the part to read** — the evidence says frequency does *not* independently drive hypertrophy, so a rating must not reward training more days; and the models explain only ~a quarter of the variance, which is why the output is a band, never a point |
| `docs/social-plan.md` | ⚠️ **§12 IS THE NEW PART — the Hevy teardown, 2026-08-31**, and it is where the home-feed work is specified: every field on a Hevy post, the eight-step order to get a card shaped like one, and exactly what is blocked by Blaze, by a native app, or by a decision this project has already made. **Read §12.0 first** — it says what the analysis is based on (their published docs) and what it cannot tell anybody (how it LOOKS, which needs the app on a phone). **Plan only, written 2026-08-17 on Tim's ask.** Design for `docs/vision.md` §1.1. **§2 is the load-bearing part** — one document per collection means sharing cannot be a permission, so it publishes a derived copy instead (proposed D24). Proposes D25, recommends profile-before-feed so D7 need not be narrowed at all, and §7 is why rules now need the emulator. **§3.3 is Tim's own three visibility tiers**, and **§3.3.1 is why his mid/full cut beat the first draft's** — read it before moving that line |
| `docs/strength-estimate-plan.md` | Mostly plan. §10 (evidence from other exercises) **was built** on 2026-08-17 and that section records how its own ordering turned out to be wrong. ⚠️ **"§11's simulator is the top open item" was stale here for two weeks** — the simulator shipped 2026-08-19 (`tools/strength-sim.mjs`, `tools/strength-fit.mjs`). **The real top open item is §11.2, the backtest against Tim's own held-out benchmarks**, which has never been run and needs nothing from anybody. ⚠️ **§6.1, not §16**, is where the 8.5 % band finding lives. Proposes D18, still unratified |
| `docs/firebase-setup.md` | Firebase state, and what is still unverified. **Corrected 2026-08-17** — it had claimed for a day that Google sign-in was not enabled, while this file carried a note saying that claim was wrong. The source is fixed; the note is gone |
| `js/import-file.js` | Not a doc. **Read its header before touching the importer**: it records that NOTHING here has ever seen a real export file, which is why every column is detected by name and confirmed by the user rather than hard-coded as "the Strava importer". ⚠️ Three things it REFUSES to guess — the date order, the weight unit and the distance unit — because each would be wrong silently and permanently. The distance one was a real shipped bug, caught by driving it |
| `js/image-crop.js` | Not a doc. The profile-photo crop, in SOURCE pixels so the result does not depend on the phone it was cropped on. One invariant: the crop square never leaves the image, or an avatar saves with a blank wedge in it |
| `docs/activities-plan.md` | **Non-lifting activities**, written 2026-08-26. §1 is D27 (recorded, never modelled — the D2 narrowing); Phase 1 (the Record chooser + quick log) is BUILT, and §3's **items 1–4 shipped 2026-08-27** (the Activity group, pace, the normalisation guarantee, the feed glyph). ⚠️ **Item 5 needs design** (activity PRs need distance-bucketing) and **item 6 says to ASK TIM** which activities his circle logs; §4 is what is deliberately not planned (no GPS routes, no fitness modelling) |
| `docs/integrations-plan.md` | **Pulling data from other fitness/diet apps — RESEARCH ONLY, written 2026-08-27 on Tim's ask.** ⚠️ **§2 is the part to read**: the blocker is not "website vs App Store app", it is that OAuth's token exchange needs a client secret and a static site cannot keep one — and a native app is just as public a client. §3.1 records that **Strava's 2026 agreement forbids showing one user's Strava data to another user**, which lands directly on the Home feed. §5 recommends file import first, which needs nothing from anybody |
| `docs/airpods-plan.md` | **AirPods remote control — PLAN ONLY, nothing deployed, on Tim's instruction.** §1: head-motion is impossible for a web app, stem presses are buildable via MediaSession. §2 the design + priced costs (occupies Now Playing → opt-in only); §3 the dead-end table; §4 the build order if he says go, starting with an on-device spike |
| `docs/icon-options/` | 🛑 **DELETED 2026-08-31, and it is not coming back on your initiative.** Tim rejected all six candidates and took the icon back: *"a mistake for you to work on them… I'm going to improve it later myself."* Recoverable at commit `fb72f8d`. `icon.svg` is untouched |
| `docs/competitive-teardown.html` | Competitive research (published artifact) |
| `docs/running-costs.html` | **What it costs to run — the cost analysis, 2026-09-06**, kept in the repo at Tim's ask so he can reopen it. A standalone page: open it in a browser, do not add it to `sw.js`'s precache. ⚠️ **The PRICES were confirmed live on 2026-09-01 and will drift; the MEASUREMENTS are the durable half** because they are properties of this code. 🚨 **Its finding is the one to carry**: `readShard()` re-reads a user's whole session history on every cold open, so cost scales with how long somebody has trained rather than how much, and reads are 81 % of the bill at 10 k users |

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
| **Workout systems** | A **system** is a programme — a named group of workouts (Push Pull Legs holding Push, Pull, Legs). The Workouts tab lists systems; open one to see and add its workouts. A workout belongs to exactly ONE system. Workouts saved before systems existed are migrated into **My Workouts** on first read. Deleting a system deletes its workouts but never recorded history |
| **Seeing a deploy** | ⚠️ `sw.js` is stale-while-revalidate, so **the load right after a deploy serves the OLD app** and the change appears on the one after. That is deliberate (a hand-maintained cache version can freeze someone forever; this self-heals) but it is indistinguishable from a broken feature — Tim hit it and reported a rating as missing when it had shipped. Since 2026-08-18 the worker compares ETag/Last-Modified on revalidation and the page shows **"A new version is ready · Refresh"**. It OFFERS, never reloads: reloading unasked is right almost always and catastrophic once, mid-set with numbers unsaved. ⚠️ **AND SINCE 2026-08-22 IT ASKS ON RESUME, which is the case that had been missing entirely.** Every check above hangs off the `fetch` handler, so an update was only ever spotted while the page was requesting assets — that is, on a real page load. **An installed home-screen app is RESUMED, not reloaded**: iOS hands back the document that was already there, nothing is fetched, and the worker is never consulted. So the app could sit weeks behind the live site with the update machinery working perfectly and never once asked. Tim reported it as a missing feature — the years view had been live for hours and his phone had simply never asked. `visibilitychange` and `online` now post `check-assets`, the worker revalidates the shell (throttled to five minutes, silent when offline), and the same offer appears. Proved by a test that finds a deploy **with no navigation at all**, mutation-checked |
| **The system badge** | **Four numbers beside every system, in a 2×2 grid** — on Explore, on the Workouts list and on a system's own screen. **Growth and strength**, separately and never blended, because a programme good for one is often not good for the other (the Golden Six is the clearest case: 35 % growth, 55 % strength); banded to 5, never a point, because the source models explain about a quarter of the variance. Plus, since 2026-08-19 on Tim's ask, **days a week and minutes a session** — the percentages say how *good* a programme is and nothing about what it *costs*, which is the first thing you want before opening it, and "80 % strength" reads very differently at three days a week than at six. A ready-made system states its own minutes; one you typed has them **estimated** from the set count at ~3 min a set, and the cell's `title` says which — "because the author said so" and "because we multiplied" are not the same claim. **Your own systems are rated too**, and the days-per-week the maths needs is MEASURED from your logged sessions rather than asked for; under two weeks of history it assumes one pass a week and says so. A system with no workouts shows no badge rather than a 0 %. The Explore row summary no longer repeats days/minutes now the badge carries them. `js/optimal.js` + `js/volume-map.js`, `docs/optimal-rating-plan.md` |
| **Ready-made systems** | Workouts → **Explore ready-made systems**. Browse, read the whole programme with its per-exercise notes, and copy it into your account. A COPY, not a link — once added it is yours to edit, and it can never change under you, **and it arrives in programme order** (workouts carry an `order`; ones you add yourself have none and land at the end). `js/preset-systems.js` holds **nine**: Jeff Nippard's *Ultimate Push Pull Legs (2023)*, *Dr. Mike's Floating Split*, *Chris Bumstead's 8-Day Split*, Arnold's *Golden Six*, *Mike Thurston's Six-Day Split*, *Volume Landmarks Hypertrophy* (follows Israetel's method — see below), plus three of the app's own (PPL, Upper/Lower, Full Body). Exercises are referenced BY NAME and a test asserts every one resolves. **Nippard's is complete as of 2026-08-19** — all six workouts, Push 1 / Pull 1 / Legs 1 / Push 2 / Pull 2 / Legs 2, in the order the videos were published |
| **⚠️ Half a programme reads exactly like a whole one** | The Nippard system shipped for two days as three workouts declaring **six days a week**, so the rating ran the same three twice and the rotation repeated a day that should have alternated. Nothing failed: the badge was plausible, every test passed, and the screen looked finished. **Tim caught it by reading the sentence** — "why would a push/pull/legs need six workouts?" Two lessons. A count a system *declares* and a count it can *fill* are different numbers and nothing was comparing them; there is now a test that does. And the one shipped as "Pull" was **the second pull, not the first** — the write-ups carry no episode number in their own text, so the order had to be recovered from the video dates. Anything transcribed from a series wants its episode number pinned down before its content is |
| **Three kinds of system, and the line between them** | **OURS** (`author: 'Fitness Tracker'`). **TRANSCRIBED** — `author` is the real person, `unofficial: true`, `sourceUrl` to the write-up; the workouts are genuinely theirs. **METHOD** — `author` stays `'Fitness Tracker'` and a `basedOn: {person, what, sourceUrl}` credits whose idea it is; the screen renders "Follows **X**'s … The workouts below are not theirs." **A person's name never goes in `author` unless they chose the exercises** — "By Dr. Mike Israetel" over a routine he has never seen is a lie no warning underneath can undo. Tests enforce all three, including that the string "By Dr. Mike Israetel" never renders. **Israetel has one of each, deliberately:** *Dr. Mike's Floating Split* is kind 2 — his real training, transcribed — and *Volume Landmarks Hypertrophy* is kind 3, a runnable programme built on the method he publishes for everyone else. Neither substitutes for the other and each says so on screen |
| **⚠️ "No honest source exists" was wrong once** | The Israetel method system was built on the conclusion that no transcribable programme of his existed. Tim said to search harder for reposts and summaries, and he was right: **Renaissance Periodization publish his own split on their own site, free**, and a second write-up agrees with it exercise for exercise. Before inventing a category to work around a missing source, search past the first four queries |
| **Record** (nav) | ⚠️ **A CATEGORY CHOOSER since 2026-08-26** — Weightlifting (first, biggest, carries the next-in-rotation name, leads to the full recorder at `#/start`) plus Run / Walk-or-hike / Swim / Cycle / Climb / Something else, each a quick activity log saving a real session (D27: recorded, never modelled). The lifting picker’s rows each show **`~N min`** — the median of that workout’s own recorded durations, sets × 3 min before any exist, rounded to 5. ⚠️ **The suggestion is LEAST-RECENTLY-DONE since 2026-08-26** (`js/next-workout.js`) — the old next-in-list rule read alphabetical order on self-built systems and told Tim to repeat Monday’s Pull; never-done counts as longest-waiting, rotation order survives as the tie-break, and the caption says what was read. Still a LOOKUP, never advice; silent when it would have to guess; skips sessions whose workout was deleted **and** activity sessions (no workoutId). **§1.2’s other half — suggesting weights and reps — still waits on the estimator** |
| **Set types** | **Supersets, tri-sets, giant sets, drop sets and myo-reps** — `js/set-types.js`, `docs/vision.md` §1.5, D23. **In the builder**: a chip on each exercise opens a sheet naming all three set types *and explaining what each one is* (D8 — "myo-reps" is jargon), with a mini-set count under whichever is picked; and a **link control sits in the GAP between two exercises** — "Superset with next" / "No rest — tap to separate" — because a superset is a statement about the space between them, not about either one. A joined block is bracketed by an accent hairline and named for its size. **In the runner**: a superset is walked round by round (A, B, rest, A, B) and the banner sits above the exercise name saying which round and whether to rest; the forward button reads "Straight into Overhead Cable Extension" or "Round 2 of 3". **The rest timer does not start mid-round**, nor after the top set of a drop set — those are the two places where the old "log a number → start resting" rule would have told you the opposite of what the set type means. A nested set's button IS the instruction — "Strip the weight — add a drop" or "Rest 10–15 seconds — add a mini-set" — not the name of a technique. **Drop sets and myo-reps are the same nesting shape**, differing only in what changes between mini-sets, and are stored under `minis` |
| Workout builder | Name, add exercises, reorder, planned set count, per-exercise notes, edit, delete. Lives inside a system — `#/workout/new/<systemId>` to create |
| Exercise library | **319 exercises** (318 until 2026-09-06, 275 until 2026-08-31), searchable, filterable by muscle group (16 groups incl. Full Body, Cardio and Activity; **13 are real muscles**). ⚠️ **A new row needs three things or it is inert**: the tuple here, a ratio rule in `muscle-evidence.js`, and a movement family in `exercise-families.js`. Tests assert all three |
| Custom exercises | User-created; choose tracked fields and how weight is counted. 🚨 **THEY DO NOT SET A STRENGTH LEVEL since 2026-08-31** — the conversion used to be guessed from the equipment dropdown, and one 60×10 set on a made-up "Dip Machine" rated a beginner's triceps Advanced. They are still logged, charted and counted in weekly volume, the create form says so before you make one, and the muscle panel says so if you go looking. 🔄 **UNLESS THE PERSON NAMES WHAT IT IS CLOSEST TO — 2026-09-06.** An optional `standInId` on the create form points at a real library exercise and the sets convert through it. ⚠️ **That is not a reversal of 2026-08-31**: the app stopped INFERRING and started being TOLD, which is a different claim. Four things hold the line — the match decides the **muscle** (her dip machine was filed under Triceps and a chest press lands on Chest), the quality is knocked to **`STAND_IN_QUALITY` 0.40** of the target's so a stand-in can never out-rank what it points at, **1.00 × 0.40 = 0.40 sits below `FALLBACK_MIN_QUALITY` (0.45)** so a match can never chain onward into a cross-muscle inference even if that filter were deleted, and **bodyweight/assisted targets are refused** because their ratios convert a resistance derived from a weigh-in while a custom exercise's number is read as plain load. Labelled on the panel — *"rated as X because you matched them — your own match, not a published conversion."* **Tim's plan is still to fold the good ones into the library periodically** |
| **The save screen** | 🆕 **2026-09-07, Tim's ask, modelled on Hevy.** **Finish no longer saves** — it opens a screen carrying the workout's name, **Duration · Sets · Exercises**, a **description**, a **gym**, the **day**, and a **discard**; the *Save workout* button there is what writes. 🚨 **The order is the change**: the description used to live in the runner's header *because the finish screen renders after the save has landed*, and moving the boundary is what fixed that — these fields describe a **draft**, and Finish is still one write. ⚠️ **`saveError` moved with the button**, or a failed save would explain itself on a screen nobody is looking at (the 2026-08-22 bug). 🛑 **Three deliberate departures from Hevy's screen**: sets and exercises rather than **volume in pounds** (`session-stats.js`'s argument, and Tim asked for a set count); **no Visibility row**, because visibility is account-wide (D29) and a per-workout flag is a decision he owes; **no title field and no Apple Health row**. ⚠️ **The day is editable here AND in the runner's header on purpose** — one state, both re-render, never on screen together; the header one exists to say NOT TODAY the whole way through a back-dated workout |
| Session runner | Builds planned sets, pre-fills last time's numbers, ±steppers, next/back, finish → **the save screen** (2026-09-07) → calendar. ⚠️ **RECORDS FOR OTHER PEOPLE since 2026-08-29 in two different ways, and the difference is on screen**: pick a **friend** and their half is offered to **their own account** at Finish (their suggestion read from the training they share with you); pick or type a **saved person** and their sets stay here, under their name, never mixed into your own. ⚠️ **Anybody can be taken back OUT since 2026-08-30** (Tim: *"in case it was just a test, or an accident"*) — a ✕ that exists **only on the person you are already recording for**, so a destructive control is never next to a chip you are aiming at to switch. Quiet with nothing recorded, a confirm naming the count if there is; a friend's confirm says their workout will no longer reach their account; the saved identity is never deleted. ⚠️ **Swap opens on FIVE ALTERNATIVES since 2026-08-30** (`js/exercise-families.js`), with the full 319-exercise picker one tap underneath. ⚠️ **THE SET LIST IS THE SCREEN SINCE 2026-08-29** (Tim's instruction): there is no detached block of steppers any more — **the ± controls sit inside whichever set is open**, exactly one is always open, and tapping another set moves the controls to it. The digits and targets are unchanged (30px, 46×52); what went was the ~200px spent showing a copy of row one. A nudge repaints the row **in place**, because rebuilding the list would now destroy the input under the user's finger. **Add set** is a small pill on the right of the "Sets" heading, not a full-width button under the list — under the list it was as loud as the sets and, once the list outgrew the pane, drawn on top of them. **Records for today by default, and the day is editable in the header** for the workout you forgot to log. Future dates refused. The header says NOT TODAY the whole way through rather than springing it on you at the end |
| Load type | Every weighted exercise labelled **PER SIDE** or **TOTAL** |
| Draft recovery | In-progress workout survives an app switch; expires end of day. Expiry is keyed to `startedOn`, **not** the session's date, so back-dating a workout doesn't discard its own draft. 🆕 **AND IT IS VISIBLE SINCE 2026-09-07** — see the row below |
| **Leaving a workout open** | 🆕 **2026-09-07, Tim's ask, modelled on Hevy.** The runner's corner is a **▾** rather than an ✕ and **asks nothing**: it goes back through history (Rule 8) and the workout stays open. A **bar above the nav on every other screen** then carries the workout's name, the elapsed time, the exercise you are on and an up arrow back in — `js/live-session.js`. 🚨 **None of the persistence is new; the visibility is.** The draft has always survived and the same workout has always resumed the same day, but the only door was that workout's row in the Record picker and the only statement that it existed was one sentence in the sheet you got on the way out — so the app kept the workout and looked exactly as though it had not. 🚨 **AND STARTING A SECOND WORKOUT NO LONGER DELETES THE FIRST**: `SessionView` opened with `if (rawDraft && !existingDraft) clearDraft()`, which was defensible while leaving took a deliberate tap through a sheet and is not once a bar advertises the open workout on every screen. A second workout now meets a screen naming the open one and the sets in it. ⚠️ **One workout open at a time**, said on that screen rather than implied. 🛑 **No discard control on the bar** — Hevy has one; it was not asked for, and a one-tap delete for a live workout under the thumb on every screen is not added unasked |
| Benchmarks | Any date, any exercise → feeds Data + calendar. A **workout can be marked a benchmark**, and then every exercise it records files the best set of that exercise as a benchmark for the day (D17) |
| Calendar | ⚠️ **ITS OWN TAB AGAIN SINCE 2026-08-25**, reversing the 2026-08-22 merge on Tim's instruction — that argument was about what the two screens *are*, his is about how often he opens them. Its header is its own title, not the Data switch. **Month cells are filled by the workout's name** beside the day number, 8px → 12px, wrapping to two lines rather than clipping. ~~Not its own tab since 2026-08-22 — it is the first segment of DATA, and its header IS the four-way Data switch.~~ `#/calendar` has been its route throughout, so a day stays deep-linkable and nothing anybody bookmarked broke in either direction. **Two ways to read it, on a Months / Years switch below that.** **Months** is the original: continuous vertical month scroll, sticky headings, opens on the current month, active days filled and named. Open a day → **Edit** a record to change anything about it: its day, its name, its exercises, every set, and whether it counts as benchmarks. **Years** (2026-08-22, Tim's ask with a reference image) draws **one tiny square per day**, one row per year, newest first, with "141 days trained" beside each — years of training on a single screen, and two years fit in the top half of a 375×667 phone. ⚠️ **It is BINARY** — coloured or not — where Months distinguishes workouts from benchmarks, because those two tokens measure ΔE 6.5 apart under protanopia and a 5.7px square has no room for the label or texture that would make a second colour legal. ⚠️ **Tapping a square SELECTS it and does not navigate**: at 5.7px a tap that navigated would open the wrong day about as often as the right one, so it fills a readout line that holds its row whether or not anything is picked, and the readout is the full-width control that opens the day. WCAG 2.5.8 is met by **equivalence** — every day is reachable at 40px in Months, one tap away. `js/year-grid.js` |
| **Data** (nav) | **FIVE segments — Muscles · Volume · Graph · Bars · Research** (Volume joined 2026-09-01, Research 2026-08-28), and it **opens on Muscles** — Tim's call, and it is also the mode that works with the least history, since one benchmark colours the map where a line chart needs two points. ⚠️ **Calendar left this control** and is its own tab again, which took the switch's one oddity with it: it was the only entry that navigated rather than setting in-page state. All five are now the same kind of thing — in-page state on `#/graphs`. ⚠️ **"Bar Chart" lost a word**: the 2026-08-21 survey measured the three-segment version clipping that exact label to "Bar Char" at 393px. ⚠️ **The five-segment row was MEASURED at 360px before Volume shipped** — 293px of row, labels 63+60+51+39+68 = 281px, nothing clipped, the existing four unchanged in width, **12px left, so a sixth does not fit**. **Graph** (measured SVG line + hover crosshair), **Bars** (paired bars), **Muscles** (body map), **Volume** — 🚨 **D3's headline metric, weekly sets per muscle from what you RECORDED** (2026-09-01): **the SAME body map the Muscles tab draws, painted red-to-green by sets** (Tim's ask, same afternoon), a five-band legend under it, the picked muscle's working under that, and the bar list still below — every muscle listed including the ones on zero, sets a week against the published efficiency tiers, tap one on the body or in the list to see which exercises fed it and whether each counted whole or half. ⚠️ **The ramp is generated by `tools/volume-ramp.mjs` and a test holds the stylesheet to its hexes**; red-to-green survives colour blindness only through strictly monotone lightness plus the words in the legend and labels — read that tool's header before touching a colour. ⚠️ **No grey anywhere: zero sets is a number**, which is the one thing this map can do that the strength map cannot. **The tiers are not targets and it says so**; the only threshold drawn is 4 sets a week. ~~Under a fortnight of history it shows totals and refuses to state a rate.~~ 🔄 **IT STATES A RATE AT ANY WINDOW SINCE 2026-09-06** and names the span it measured over — and that removed a latent bug rather than adding risk: under a fortnight the body map was painting window TOTALS against `volumeShade()`, whose bands are *weekly* doses, so a nine-day beginner with 21 sets wore the colour of somebody training hard. ⚠️ **The `perWeek` flag was DELETED, not pinned true** — a boolean threaded through five call sites is five chances to print a total under a rate's heading. Warm-ups are counted and admitted (Open work 0c, still Tim's call). **Research** — which since 2026-08-30 opens on **eleven collapsed topics teaching the basics**, each carrying a confidence label in words and its own stated weak spot, over the age chart that shipped with the tab. `js/research-topics.js` holds the content and the rules it was written under; `docs/research.md` §13 holds the pull. **No chart mode is ever a dead end**: a chart needs the same lift on two different days, so where it cannot draw a line it lists **where every lift stands right now** — best set, estimated max, how long ago — instead of an empty state. No tab is disabled and no mode is force-switched away from. Charts show **one source at a time**, benchmarks by default — an exercise with only workout sets charts those, so graphs already work with no benchmarks at all. What is NOT built is the confidence-weighted estimator and the evidence setting Tim asked for; see `docs/strength-estimate-plan.md` |
| Body weight | Charts through the Graph picker, in a **You** optgroup after the exercises, so it takes no fourth tab and is never the default. Needs two weigh-ins. Direction is **not** judged good or bad |
| Rest timer | Counts **up** from the last set, started by logging a number rather than by a button. Optional target (60/90/120/180s) that only then says the rest is over. Read from a timestamp every tick, never accumulated — a backgrounded tab throttles timers, which is exactly when it matters. Survives an app switch in the draft |
| Units | **lbs or kg**, a display choice only. Everything is STORED in pounds, so switching back and forth is lossless — asserted to the 1e-9 |
| Rep normalisation | Y-axis is always weight; every point converted to equivalent load at one rep count (D11). Target defaults to the most-recorded count, adjustable with arrows. Markers mean measured |
| **Muscles** | **Tim's illustration**, front + back, 18 tappable muscle paths covering 13 groups. **Rated from EVERY exercise that trains the muscle**, not one named lift (2026-08-17) — hammer curls rate biceps, dumbbell rows rate back, seated calf raises rate calves. ⚠️ **Since 2026-08-19 the rating is led by the most CREDIBLE evidence rather than the largest number it produces** — at most three exercises, one seat each, ranked by how much each is worth believing. Before that it picked its top three by converted weight, so a 15-rep face pull outvoted an overhead press benchmark and rated an ordinary lifter Elite; §9 has the write-up and the residuals. Each rating carries a **confidence**, and the muscle's colour is desaturated in proportion: same level, less vivid. The panel says how many sessions AND how many different exercises fed it, because "40 sessions, all of one exercise" is a different claim from "40 sessions across four". See `js/muscle-evidence.js`. Split into a **fill layer** (vector, recolourable, the tap target) and an **ink layer** (greyscale luminance mask carrying every keyline, fibre striation and shadow) — so recolouring a muscle cannot touch its texture. Head, hands, feet and knees have ink but no fill, so they stay unpainted. ⚠️ **Picking a muscle never moves or resizes the body, in either layout** (2026-08-21). On a screen ≥ 860px the detail opens in a **side column beside the figures**; below that it stacks underneath, and the figure holds a fixed 57 % of the pane while the panel takes what is left and scrolls inside itself. Before that fix the phone's figure shrank and rose by however many words the panel happened to have. 🚨 **IT RANKS WITHOUT A PROFILE SINCE 2026-09-06**, where it used to replace the whole body with *"Tell us about you first"* over an account holding a year of sets. **No body weight is ever invented**: a missing weigh-in widens the comparison to **lifters of every size** (a real group, named on screen), and a missing sex assumes male — stated, never silent. 🚨 **An assumed map is NEVER published to a friend** (`buildStrengthShare()` refuses): `shared-map.js` cannot recompute a percentile, so a reader would get 24 rows with no way to check any of them. Each group filled by where it ranks among a comparison group **the user chooses** — "Compared to" in the header opens two presets (**Like me** / **Everyone**) over four axes: population (people who lift / everyone), sex (men / women / both), body weight (mine / any) and age (mine / any). The caption always states the group in words, and says "all adults" rather than "who lift" when the comparison includes people who do not; grey only when that lift has never been recorded. **Ranks from workout sets as well as benchmarks** — source named in the panel — with a hard rep gate: a set above 15 reps is not evidence of a maximum (D5). ⚠️ **Tap → five lines and no more** (2026-08-21, Tim: "we want it to be easy to understand, not a paragraph"): level, estimate + percentile, the bar to the next level, the confidence line, and the set the number came from. The seven-row table of per-level weight targets, the confidence bar and the confidence percentage were cut. **Every caveat survived, one line each** — shortening a caveat is allowed, softening one is not — and a **40-word cap is a test**, because every other assertion on this panel checks something is present and none of them can catch words piling back up. Selection is an accent outline following the muscle's own shape, and the browser's own focus ring is replaced — Chrome draws `outline:auto` around an SVG element's **bounding box**, which put a white rectangle around the selected muscle. |
| **Who can see you** | 🚨 **PRIVATE OR PUBLIC, ONE SETTING FOR THE WHOLE ACCOUNT (2026-09-03)**, replacing the four per-person levels, and 🚨 **PUBLIC IS THE DEFAULT** — Tim's call the same day, and an account that has never opened the sheet is public. **Private:** only friends you accept, and they see everything — workouts, benchmarks, muscle map, graphs, volume. **Public:** anybody **signed in** who finds you sees all of that too. ⚠️ **Body weight is never in the public copy** and keeps its own opt-in switch for friends; the photo, the time of day and the gym name DO go public, which is Tim's explicit answer to the question. ⚠️ **Reacting stayed friends-only** — a stranger reads a public account and leaves nothing on it, because writing into somebody's subtree is a moderation surface and this project has no moderation story. Set on the Friends screen and on any friend's page; `docs/social-plan.md` §15 |
| **Friends** (was Social) | 🚨 **THREE WAYS IN SINCE 2026-08-29, and one of them reversed a locked decision.** *Add a friend* (`#/find`) offers **search by name**, **your own permanent QR code** (`#/add/<uid>`, scanned by their camera app — nothing to install) and the original **invite link**. Somebody found by search or code gets a **friend request** they accept; ⚠️ **accepting needs no new permission** — it republishes with them in `viewers`, so the asker learns by an existing read succeeding, eventually, and the screen says when it happens. ⚠️ **The name search needs Firestore `list` on a public `directory` collection, which IS enumeration and cannot be narrowed by a rule** — Tim's explicit call at fewer than five users; the handle replacement is Open work 16. **Settings → Findable by name** takes your row out, and is described as a courtesy rather than a protection because the rules cannot enforce it. ⚠️ **No longer its own tab — it is the Friends half of HOME** since 2026-08-22, and since 2026-08-25 the **You** half is a feed of those same friends' workouts rather than a place to start one. reached by a You / Friends switch, and the screen is titled **Friends** rather than Social because that is what a person has. `#/social` is still its route. **Mutual friends.** ⚠️ ~~a list you VISIT — there is no feed~~ **CORRECTED 2026-09-02, and it had been wrong here since 2026-08-25**: the **You/Friends** switch on Home IS a feed of their sessions, and since 2026-09-02 it is a Hevy-shaped one — each card carries the description they wrote, a **Time · Sets** row and one line per exercise with its set count, and **tapping it opens their workout on its own screen** at `#/friend/<uid>/<sessionId>`: an absolute date, a muscle split as percentages of that session, typed bests, and set tables whose header adapts to the lift. From there you can **compare a lift against your own** (rep-normalised, windowed to what you both have, and refusing to name a winner), **save their workout as one of yours** (set counts carry, weights cannot) or **share a picture of it**. **D7 was never narrowed** — what it still refuses is the **discovery** feed of strangers (Open work 18). Connect by **invite link** (no user directory, so nothing can be enumerated); links work once and expire in 7 days, and the sender can cancel one before it is used. ⚠️ ~~**You choose per person what they see** — Everything / My workouts / Just that I trained / Nothing~~ **GONE 2026-09-03 (D29): visibility is one setting for the whole ACCOUNT** — see the "Who can see you" row above. Every accepted friend sees the same thing, and a new connection is not started at a "least visible setting" any more because there is no longer one to start at. A friend's page shows **their body map in the app's own art and colour ramp — tappable since 2026-09-03, with the same panel your own map has** — their volume, their graphs, and their recent workouts as one line each, opening to the real structure with supersets and drop sets intact. **What THEY can see of yours sits at the top of their page**, above anything of theirs — the thing you most want to check is what you are giving away, and it now leads to the account setting rather than to a dial on that one person. Requires a real account (D25 proposed): an anonymous uid is a browser profile that will be lost, so a connection to one is a connection to nobody |
| **Goals** (no longer a nav tab) | ⚠️ **Off the bar since 2026-08-25, reached from Settings**; the route and all its deep links still resolve. A goal is **one muscle moving up a strength LEVEL over twelve weeks** — never "+30 lb on your bench", because individual change over 12 weeks runs 0–250 % and no app can promise a number. Pick a muscle, pick a level above it, and the screen states **what it costs** (hard sets a week on that muscle, sessions, minutes, protein, effort, sleep) with a citation on every line, **what your logged sessions are actually delivering** against it, **why progress stalls** — two causes measured, four admitted invisible — and **which programmes fit**, ranked on what they give THAT muscle rather than on their headline rating. ⚠️ **No on-track verdict, and the screen says why**: a day-to-day estimate swings several percent, so a verdict off raw numbers would call a bad Tuesday a failure. 🆕 **BUT SINCE 2026-09-06 IT SAYS WHAT HAS MOVED** — the two estimated 1RMs subtracted, with the ±12 % yardstick in the same breath and still not one verdict word (Rule 6: report the measurement, withhold the opinion). ⚠️ **Built from 1RMs and NOT from the frozen percentiles**, which move with the comparison group — subtracting those would report a change in the STANDARDS as a change in the lifter. 🛑 **And this screen KEEPS the profile gate the muscle map gave up**, because a goal freezes its target weight (D20) and an assumption frozen in outlives every screen that would have relabelled it. The target weight is **frozen** when the goal is set, because the weight behind a level moves with body weight, age and the comparison group. One goal at a time; old ones kept. `js/goals.js`, `docs/goals-plan.md` |
| **Bodyweight lifts rank** | **Pull-ups, chin-ups, dips and push-ups rate a muscle** (2026-08-19). Their resistance is a fraction of body weight plus whatever was added, and the fraction is per exercise. ⚠️ **The pull-up and the dip are 1.00 by STATICS, not by citation** — nothing but the hands is in contact, so the hands carry all of it, and the research confirmed no published %BM figure exists for either. A push-up is 0.75 from two independent force-plate studies half a percent apart (Suprak 2011, Mier 2014); the familiar 64 % and 66 % figures measure *different quantities* and mixing them would be worse than choosing one. ⚠️ **Body weight is read from the DATE OF THE SET**, never today's — otherwise losing twenty pounds would rewrite last year's pull-ups. What has no honest fraction stays refused, permanently and by name: an inverted row is 37–79 % depending on a bar height the app does not record. The panel distinguishes the two kinds of "can't", because "log a weigh-in" is actionable and "nobody has measured this" is not. `js/exercises.js` `BODY_WEIGHT_FRACTION`, `totalResistance()` in `js/e1rm.js` |
| **The map says what it is IGNORING** | A muscle no longer claims "nothing recorded" over work you did. Sets the rating had to discard are listed with the reason — three sets of inverted rows show as uncounted rather than vanishing. Rendered on rated muscles too, not just grey ones: a Back rating built on rows while silently dropping every chin-up is under-reporting its own evidence while looking complete |
| **Progression** (Goals Phase 4) | **Double progression, in the session runner** — hold the load and add reps; at the top of the range on **two consecutive sessions** take the smallest increment inside **2–10 %** and drop to the bottom of the range. Says so when **no honest increment exists** (5 lb on 30 lb is a 17 % jump), and distinguishes "past the band" from "inside the band but bigger than we allow for isolation work". ⚠️ **`js/progression.js` has NO CLOCK and imports nothing from `goals.js`** — §3.1's refusal is structural, not a promise. Time enters as one day count and **may only SUPPRESS a suggestion, never raise one**: after a long gap it offers last time's numbers and says why, prescribing no deload because nobody has measured one. Swept over 10,692 calls — a gap never yields a heavier suggestion than the same history without one. Weighted pull-ups get the full rule via total resistance (5 lb on a 25 lb belt is 2.4 % of ~205 lb, not 20 % of 25); reps-only movements get "one more rep". ⚠️ **The rep range is read across the recent history, NOT from the last session alone** — `trainingRange()`, fixed 2026-08-20. Read from one session, the app's own "back to 8 reps" came back next time as the top of 6–8, and an obedient lifter was moved out of 8–12 for good and given weight every second session. History may only ever widen the range *upward*, so the fix is structurally incapable of proposing a heavier weight than the old code did — the same asymmetry the lay-off rule has |
| **What the strength score cannot see** | ⚠️ **On screen, in words, not in a tooltip.** A planned workout stores a set count and no weight or rep range, so **3×20 and 3×5 get the same strength percentage** — and load is the single biggest thing there is for strength (SMD 0.60 vs 0.12 for growth). Stated on the system screen and under the Explore list, because `title` does nothing on a phone and a phone is where this app is read. The same treatment for the **0.5 indirect-set weight**: kept, because it is the best-supported method actually tested, but the screen now says it is a modelling choice and that counting indirect work lower would drop several percentages a band |
| Profile | Gender, birth year, **body weight as a dated series**. Names what is still missing rather than failing silently |
| Offline UX | When the cloud is unreachable the app says **why**: `navigator.onLine` for the obvious case, plus a cache-busted same-origin **probe** because onLine is true for a captive portal or a dead upstream. It names the last signed-in account so an offline session doesn't look logged out, retries in place rather than reloading, and reconnects by itself on the browser's `online` event. Raw errors live behind a collapsed disclosure, never in the headline |
| **Demo account** | Account → **View demo account**. A generated year — two programmes, ~200 sessions, 20 benchmarks, 53 weigh-ins, a goal 16 % of the way through — so every screen has something in it. ⚠️ **In-memory only.** `store.js` swaps its backend for a Map, so there is no tap sequence — editing, deleting, importing, "delete all data" — that can reach a real record. The flag is in **sessionStorage**, so the demo cannot follow you into a new tab or survive closing the browser; that is the safety decision, because "opens the app tomorrow and sees a year they did not do" would be far worse than the feature is worth. A reload reseeds from the same default. **Social is refused** at `republish()`, not just on the screen. `js/demo.js` |
| Accounts | Anonymous-first; email upgrade preserves uid *and* data; sign-in, password reset, change password, delete account, sign-out, local→cloud merge, automatic adoption of local data. Falls back to local storage if the cloud is unreachable |
| Google sign-in | **Exactly one popup, ever.** Recovering from "that account already exists" reuses the credential from the failed link (`signInWithCredential`) instead of opening a second window the browser would block. A cancelled sign-in never dead-ends: it says so, and offers **Continue in this window instead** — but ⚠️ **only where that redirect can actually finish**, which this configuration is not, so here it names **email** instead. ✅ **Works on a real iPhone in the installed home-screen app** (2026-08-22), which is the path this file spent months calling the riskiest untested one; the popup is what runs there, and the belief that an installed iOS app blocks popups was simply wrong |
| Profile button | True top-left — beside "Fitness Tracker" in the desktop sidebar, in the header on mobile, never both. Red dot when data is not backed up |
| Settings | Dark/light, **Colour** (Gold/Teal/Indigo/Ember since 2026-08-26, all four fully audited 2026-08-27), **lbs/kg**, More details, **Rest timer** (off by default), **Findable by name** (on by default — 2026-08-29, and it is a courtesy rather than a protection: the rules cannot enforce it), Goals link. ⚠️ **Profile, backup/restore and delete-all MOVED to the Account screen 2026-08-26** (Tim's ask); one pointer row remains |
| Account | ⚠️ **The person, since 2026-08-26**: profile photo — ⚠️ **POSITIONED AND RE-EDITABLE since 2026-08-27** (Edit reopens the cropper where it was left, on a 768px source kept for exactly that), a square stage with the circle inscribed in it, drag to move and a slider/pinch/wheel to zoom, and what the circle frames is literally what gets cut (`js/image-crop.js`); client-resized to a 256px JPEG (~4 KB measured), `settings.avatar`, worn by the top-left button, NOT published to friends, profile row, backup/restore + cloud warning, delete-all, sign in/out — in every account state. **Back goes Home**, not Settings |

**Stepper increments:** reps ±1 · weight **±5 lbs or ±2.5 kg** · time ±10 sec · distance ±0.1 mi.
Press-and-hold repeats.

### Verified

- ✅ **ON A REAL IPHONE, 2026-08-22 — the only two things in this list a device has ever confirmed.**
  In the app **installed to the home screen**: the **keyboard fix** holds (*Next exercise* reachable
  in the session runner with the keyboard up, and the exercise picker usable), and **Google sign-in
  completes**. ⚠️ **Read the scope narrowly.** This was one person, one phone, one surface, and two
  questions — it says nothing about touch targets, about a Safari tab, or about any of the three
  survey items still marked reasoned-not-measured. **Everything else in this list is still a
  desktop engine, jsdom, or an emulator**
- All **32 JS modules** pass syntax check; the whole import graph resolves under a stub DOM
- **The ranking model's five new regression assertions** (`tests/data-layer.test.mjs`) — the ones
  that were missing. ⚠️ **1051 assertions ran green over this bug for two months**, and the reason is
  worth knowing: every multi-observation test used three DIFFERENT exercise ids with estimates a
  couple of pounds apart, so neither half of the fault could show — not one exercise filling every
  slot, and not a flattering conversion outvoting a credible one. The new ones use the shapes real
  data produces: a low-quality high-rep observation beside a high-quality benchmark, and one exercise
  logged on more days than another. **Mutation-checked** — reverting the sort line flips exactly
  those five and nothing else
- **53 demo assertions** (`tests/demo.test.mjs`, no dependencies) — and the two that matter are
  **determinism** and **plausibility**. The same day must build a byte-identical year, with a
  companion check that a different day *does* move it so the first is not vacuous; that is what makes
  "resets to the default" literal rather than approximate. Plausibility is checked against the app's
  OWN modules rather than by eye — the bench estimate ranks somewhere with room above and below, the
  logged volume lands in a believable band, and the goal's starting figure equals what the muscle map
  said on the day it was set. That last one is a regression test: the first version built the goal
  from the bench press alone while the map rates Chest from every chest exercise, so the demo opened
  on a goal already reading "Target reached" with the map beside it disagreeing
- **The demo driven end to end in a real browser** — 2026-08-19. Real data seeded first, then the
  button clicked: the demo could not see it (`demoSeesRealSystem: false`), it was still on disk
  (`realStillOnDisk: true`), renaming a system inside the demo wrote nothing to localStorage
  (`wroteToDisk: false`), a reload restored the default, and leaving brought the real account back
  intact. Every tab screenshotted at 390 px plus the muscle map and the desktop layout
- **88 goals assertions** (`tests/goals.test.mjs`, no dependencies) — and the two that matter are
  **refusals**, the same shape as `optimal.test.mjs`'s three. ⚠️ **Nothing reads the calendar to
  decide what is asked of you**: two goals with identical numbers and start dates eleven weeks apart
  must produce byte-identical requirements, with a companion assertion that a bigger *jump* does move
  the band, so the first cannot pass vacuously. That test fails the moment anything scales a
  requirement by how far behind schedule somebody is — which is `docs/goals-plan.md` §3.1, the only
  thing in this app that could cause physical harm. ⚠️ **And no verdict**: `goalProgress()` for
  somebody four days from the end having added nothing carries no key matching
  `verdict|behind|ahead|status`. Also pinned: 0.73 g/lb converts to the published 1.62 g/kg and 1.0
  to 2.2; protein is the SAME at Steady and Committed, which is what proves it is a threshold rather
  than a dial; the sleep and effort text is byte-identical across every band; and the stall walk has
  a **vacuity guard** — the same walk over adequate training must read OK
- **1,847 data-layer assertions** (`tests/data-layer.test.mjs`, no dependencies) — including both
  directions of the art↔standards invariant: every drawn muscle is rankable or declared unrankable,
  **and** every rankable muscle is actually drawn with real geometry. A regeneration that dropped a
  muscle group would otherwise fail silently on a screen nobody re-checks
- **⚠️ `COLLECTIONS` in `store.js` is now checked against `knownCollection()` in `firestore.rules`.**
  This file has warned in prose since the beginning that adding a collection to one and not the other
  has every cloud write DENIED while localStorage keeps working — perfect on the machine it was
  written on, silently lossy for anyone signed in. It was never a test until `goals` was added on
  2026-08-19. **Mutation-checked**: removing `'goals'` from the rules flips exactly that assertion
- **911 render assertions** (`tests/render.test.mjs`, jsdom) — every screen mounts, tapping a muscle
  opens its detail, the SVG line chart genuinely runs (gridlines, one marker per measured point,
  correct aria label), and **every ink mask reference resolves to a mask in the same SVG**. That last
  one matters: if the mask or its image goes missing the figure renders as flat silhouettes with no
  detail at all, which is the one failure that would not look like a bug in a screenshot
- **Screenshots, headless Chrome** — Home, Workouts, Calendar, Settings, Muscles and the line chart
  at 360 / 390 / 880 / 1180 / 1280 px in dark and light. Layout holds, nothing overflows, the legend
  wraps, and the Muscles side column holds its figure size whether or not a muscle is selected
- **Driven over CDP with real mouse events**, not synthetic ones — 2026-08-17: the session screen's
  Add set pill (hit-tested, 6 sets → 7), the Compared-to sheet (picking Women moved Chest
  Intermediate → Elite and the caption followed; the Everyone preset set all four axes), the systems
  list and one system, and Explore → a preset → Add, landing in the copied system with its notes
  intact. Confidence was checked from **computed styles**, not by eye: two muscles at one level and
  different confidences differ only in chroma, with identical lightness and hue.
  Later the same day: Explore → Thurston → **Add** → the copied system → its Conditioning workout
  (the first preset workout made of cardio rather than lifts), and the same for the 8-exercise
  Upper B. **This is what caught the alphabetical-order bug** — every test passed, every screenshot
  looked right, and the programme was still arriving shuffled
- **Home's "what's next" driven through all four of its states** at 390 and 1180 px — empty account,
  programme added with no history, one workout recorded two days ago, and the end of the rotation
  wrapping back to the first. The button and the caption moved together every time
- **Set types driven end to end with real mouse events** at 360 / 390 / 1180 px: link two exercises
  in the builder, tap an exercise into a drop set, save, run the workout, confirm **the rest timer
  stays at `--:--` mid-round and starts only after the last exercise of the round**, walk into round
  two, add a drop, then read the record back on the calendar day and through the edit form. Saving
  the edit form unchanged preserves groups, set types, set counts and drops exactly. **This pass is
  what caught the builder writing into a copy** — every control looked right on screen and none of
  them saved anything
- Every class referenced in JS has a matching CSS rule
- All assets serve 200 with correct MIME types from Pages
- **46 rating assertions** (`tests/optimal.test.mjs`, no dependencies) — the curves are checked
  against the PUBLISHED FIGURES, not just against their own slopes: a curve fitted to a slope can
  match it perfectly and still be the wrong curve, so the hypertrophy model must also reproduce the
  ~5-6 % at 12 sets and ~10.5 % at 42 that the paper plots, and the strength frequency model must hit
  12.72 % and 17.32 % exactly. The three refusals are asserted directly — **the same 12 sets spread
  over 3 days scores identically for growth and higher for strength**, 100 sets scores as 42, and 83
  and 87 both band to 85
- **49 volume-mapping assertions** (`tests/volume-map.test.mjs`, no dependencies) — the direct/
  indirect classifications the source paper states outright are pinned as tests, the conservative
  fallback is proved conservative, and the published efficiency tiers are asserted at their
  boundaries. **Two guards worth keeping**: a fabricated 60-sets-a-week programme must land in
  "beyond the evidence" rather than in a better tier (the "more is always better" failure this
  rating exists to avoid), and Bumstead's 8-day cycle must produce *lower* weekly volume than the
  same workouts counted as a week. Sanity-checked against all nine shipped systems — the 1960s
  Golden Six totals 29 fractional sets a week against Thurston's 147, and the programme built on
  volume landmarks reaches the minimum effective dose in 10 of 11 scored muscles
- **73 social assertions** (`tests/social.test.mjs`, no dependencies) — what a person SHARES. The
  load-bearing one is an **absence** check: the light projection is walked and required to contain no
  numeric leaf below the workout name, run against a session carrying a superset, a drop set and a
  myo-rep still stored under the legacy `drops` key. It has a **vacuity guard** — the identical walk
  over the identical sessions at mid must find numbers (it finds 18), so "none at light" is a result
  rather than a walk looking in the wrong place. Also asserted: an email address handed straight to
  the builder never reaches the output, body weight stays out even at full unless separately enabled,
  and a stored tier that is not recognised degrades to the *safest* value rather than the nearest
- **The Goals screens driven in a real browser over CDP** — 2026-08-19, at 360 / 390 / 1180 px in
  both themes, against a scratch copy with the config blanked. Seen: the empty state, both picker
  steps, a goal set with a **real mouse click** on a level, all four scroll positions of the goal
  screen, the stalls screen and the programme matcher. **Two defects came out of it and neither was
  visible to jsdom.** A multi-word `.tag` **split into two pills** — the background and both rounded
  ends are painted per line box, so "grows with the goal" rendered as a chip reading GROWS above a
  chip reading WITH THE GOAL, reading as two unrelated labels; fixed with `white-space: nowrap` on
  `.tag` app-wide and confirmed from `getClientRects()`, which is the only thing that tells you a
  chip occupies two line boxes. And a **phrase dropped into the numeric column** — "Within 1–2 reps
  of failure" in a column sized for "7–10" took 300 px and squeezed the label beside it into a
  five-word-tall stripe. Also confirmed here: the nav fit at 360 px with no label clipped — six tabs
  then, five since 2026-08-22
- **The Social screens driven in a real browser over CDP** — 2026-08-18, at 390 and 1180 px in both
  themes, against a scratch copy whose `social` facade is stubbed, so nothing touched the live
  project and no account was created. Seen: the friends list with all four visibility settings, the
  waiting-to-be-added row, an unused invite link with its Cancel, a friend's page with **their body
  map rendering in the app's own art**, and the visibility sheet with its four explained options.
  **Two real defects came out of it and neither was visible to jsdom**: friend rows were underlined
  (they are anchors, and the app's other lists are buttons), and the visibility description clipped
  to *"…your muscle map and your pr…"* on a phone — the one row on that screen where the detail is
  the point. Both fixed and re-checked from **computed styles**, not by eye
- ⚠️ **And the trap that nearly hid the fix:** the scratch copy ships the service worker, so the
  second screenshot run was served the FIRST run's CSS out of cache and showed the bug as still
  present. A screenshot of a stale cache looks exactly like a fix that did not work. Use a fresh
  `--user-data-dir` per run
- **46 rules assertions against the real rules engine** (`tests/rules.test.mjs`, Firestore emulator)
  — **the first tests in this project that run as somebody who is not you.** Everything else asserts
  a number; a permission can only be tested by attempting it as another user and being refused, which
  nothing here could do before. The suite leads with denials on purpose: *a rule that permits
  everything passes every positive test*. The load-bearing one is a regression test rather than a new
  feature — **a full-tier friend still cannot read the private sessions document** — because the one
  unacceptable outcome of adding social was that it widened the old paths. Also refused: a stranger
  adding themselves to a viewers list, a viewer listing which tiers exist, anyone listing another
  person's invites, and a claimer extending an invite's expiry on the way past.
  **Mutation-checked:** deleting the `diff().affectedKeys()` line flipped exactly one assertion from
  denied to allowed and left the rest passing, so that test is not vacuous and that rule line is
  provably load-bearing
- **Firebase, 45 checks against the live project.** `js/firebase-backend.js` itself was exercised —
  its gstatic imports redirected to a local SDK — not a lookalike: anonymous sign-in, read/write
  round-trip, `serverTimestamp()` satisfying the rules, anonymous→email linking preserving uid and
  data, sign-out, sign-back-in, password change, account deletion leaving no data, error mapping.
  Seven rule violations all refused. Test users and documents deleted.
  ⚠️ **This line used to end "the project holds zero users and zero documents", and that stopped
  being true the moment Tim signed in.** On 2026-08-22 it held **7 users and 19 documents**,
  including his two real accounts and their training. It was still being quoted as "zero" in a brief
  handed to an agent whose job involved deleting things — so **snapshot the real baseline and diff
  against it; never clean up to an absolute.** A true statement about a live project has a date on
  it or it is a trap.

### NOT verified

- **⚠️ THE TWO NEWEST FEATURES HAVE NEVER MET REAL DATA, and both are the kind that look fine
  until they do.** **File import** has never parsed an actual export from Strava, MacroFactor,
  Cronometer or Apple Health — every column name in `js/import-file.js` comes from published
  documentation rather than from a file this project has opened. That is exactly why the screen
  detects columns by name, shows a preview and makes the user confirm before writing anything, and
  why the date order, the weight unit and the distance unit are refused rather than guessed. ⚠️
  **One of those three was a real shipped bug caught only by driving it** — distance defaulted to
  miles and Strava exports kilometres — so treat the other guesses in that file as equally
  untested. **The handoff and disconnect paths** are proved against the real rules engine and in
  jsdom; **they have never run between two real accounts.**
- **⚠️ AND THE PROFILE-PHOTO FIX WAS REASONED, NOT OBSERVED** — headless Chrome never reproduced
  the bug Tim reported, so the diagnosis (a cyclic percentage resolved differently by WebKit) is the
  best account of a real symptom rather than something this project measured. ✅ **His phone
  confirms the fix works**, which is not the same as confirming the cause.

- **⚠️ ACCESSIBILITY IS PART-AUDITED as of 2026-08-20, and the part that ran FAILED.** Contrast,
  touch targets, accessible names and horizontal overflow have now been measured in a real browser
  across 44 screen/width/theme combinations — see the section above; `--ink-faint` failed AA
  everywhere it was used and every label in the app named nothing. Both fixed and re-measured.
  ⚠️ **AND THE 44 COMBINATIONS WERE NOT WHAT THEY LOOKED LIKE.** Two of the tool's routes —
  `#/data` and `#/muscles` — **are not routes at all** and silently rendered Home, so until
  2026-08-24 the Data screen and the body map had **never been audited** and Home was measured three
  times. Fixed in the tool, re-run over **52** combinations: **contrast is clean on all sixteen
  newly covered ones**, and the map's own targets were hit-tested for the first time — Traps 42×11
  at 360 px, with no larger equivalent, which is Open work 0i.
  ✅ **Re-run again 2026-08-27 over 60 combinations × all four palettes — 240 in total, 23,496
  text nodes, zero below 4.5:1, zero horizontal overflow.** The activity log joined the route list
  then too; it had shipped unaudited.
  ✅ **Re-run 2026-09-06 — 128 gold routes, 11,912 text nodes, zero below 4.5:1, zero overflow.**
  🚨 **That run started as EIGHT failures and they were real.** `.load-badge.per-side` — the 9px
  "PER SIDE" chip in `js/ui.js:897` — measured **3.96:1 in the LIGHT theme** on the session runner's
  swap and exercises sheets. Tim was told, asked for it fixed, and it is: a scoped
  `#82570B` at **5.02:1**.
  ⚠️ **IT WAS FIXED FOR THE DEFAULT PALETTE ONLY, AND THAT IS THE INTERESTING PART.** Gold is the
  palette with no `data-palette` attribute; teal, indigo and ember already cleared AA on that pair
  (4.56–5.02). The obvious selector — the shape `.row-start` uses — would have painted gold's hex
  over all four, **breaking three that passed in order to fix one.** The rule is therefore
  `:root[data-theme="light"]:not([data-palette]) .load-badge.per-side`.
  🚨 **AND `tests/a11y.test.mjs` COULD NOT HAVE CAUGHT IT, FOR A STRUCTURAL REASON WORTH KEEPING.**
  That suite walks tokens out of `:root` blocks, and `--accent` on `--accent-dim` is a pair no
  `:root` rule declares — it exists only because one CLASS puts one on the other. It now asserts this
  pair directly, in every palette, and **mutation-checking it reproduced the browser's own 3.96:1**,
  so the audit does not have to find it a second time.
  ⚠️ **The eight were NOT a regression from that day's work, and that was MEASURED rather than
  assumed** — the same audit was run against a scratch copy built from `git archive HEAD` and
  returned the identical eight. When an audit finds something after a change, run the control;
  *"it was probably already there"* is exactly the sentence this file exists to stop.
  🚨 **AND A TRAP THAT COST THE FIRST RUN OF THAT AUDIT: A STALE `python -m http.server` WAS ALREADY
  BOUND TO PORT 8791.** The tool's own "nothing is serving" guard passed — something *was* serving —
  and every one of the 128 routes measured an *"Error code: 404"* page: **zero contrast failures, zero
  overflow, and a clean-looking sweep.** What gave it away was that every interactive step failed with
  a plausible message about the demo. ⚠️ **A green audit with a ZERO TEXT-NODE COUNT is not a pass,
  and the node count is the only number that says so** — check it before reading anything else, and
  pass `PORT=` a fresh port if in doubt.
  ⚠️ **Three things are still completely unknown: no keyboard path has been walked, no screen reader
  has ever been run against this app, and nothing has been tested at larger text.** **Do not let
  "contrast passes" stand in for "accessible"** — they are different claims, and this file's whole
  discipline is not confusing them.
- **⚠️ The 2026-08-19 code is PART-reviewed as of 2026-08-20.** `js/progression.js` — the one that
  matters, because it is the only part of this app that can cause physical harm — **has now been
  attacked, and it broke**: the rep range collapsed under the module's own advice (see the 2026-08-20
  section). Fixed, swept and mutation-checked. **`js/strength-estimate.js` and the body-weight work
  across four modules have still not been attacked by anybody trying to break them.** They pass every
  assertion in the suite and each was driven in a browser by its author, which is exactly what progression had
  too the day before it turned out to be wrong. **The count is not the point** — passing a suite its
  own author wrote is not the same as surviving somebody trying to break it.
- **Almost everything about a real device.** ⚠️ **A phone has now opened the app three times and,
  on 2026-08-24, been TRAINED with for a whole session.** What that settled is the keyboard fix,
  Google sign-in in the installed PWA, and — far more valuable — four defects no review had found
  (see `docs/history.md`, 2026-08-24). **What it did NOT settle is everything on this line:** touch targets,
  `adoptLocalData()` against real local data, and how the app behaves in an ordinary **Safari tab**,
  which is now the *less* tested of the two surfaces. Headless Chrome covers desktop-engine layout
  only. Of the four survey items that are reasoned rather than measured, **three are still
  reasoned** — haptics (iOS has no Vibration API), the long-press callout, and the native date
  control — plus the open half of the fourth: whether the picker's `setTimeout` focus raises the
  keyboard **by itself**, which the device visit did not record either way.
- ~~**⚠️ THE KEYBOARD FIX IS SHIPPED AND UNPROVEN.**~~ ✅ **CLOSED 2026-08-22 — see Verified.**
  `--kb`, written from `window.visualViewport`, was the largest structural change the phone work
  made, and it was verified only by driving the variable by hand until a real iPhone confirmed both
  cases the survey named.
- ~~**⚠️ NO TWO ACCOUNTS HAVE EVER CONNECTED.**~~ ✅ **CLOSED 2026-08-22.** Two throwaway accounts in
  two separate Chrome profiles ran the whole round trip against the live project — invite, claim,
  accept, tier, publish, read, downgrade, disconnect — with enforcement checked **on the wire**
  rather than in the UI, then both accounts and all eleven of their documents deleted. Two defects
  came out of it: expired invites read as open (**fixed**), and disconnect is one-sided while the
  sheet said otherwise (**sheet corrected 2026-08-24; the feature is still one-sided — Open work
  0j**). ⚠️ **The brief claimed the project held zero users. It does not** — it holds Tim's two real
  accounts. Snapshot the baseline before touching it.
- ~~**⚠️ GOOGLE SIGN-IN DOES NOT WORK ON IOS**~~ ✅ **IT WORKS — installed PWA, 2026-08-22.** Broken
  when reported on 2026-08-21 (popup opens, closes, nothing happens) and fixed by the third pass
  moving the installed PWA off `signInWithRedirect`, which a cross-origin `authDomain` genuinely
  cannot finish, onto the popup, which a device now says works. ⚠️ **Two narrower things are still
  NOT verified and are easy to over-read:** Google sign-in in an **ordinary Safari tab** since the
  fixes shipped — the surface the original report probably came from — and the **redirect** path,
  which remains unusable in this configuration on any current browser and is deliberately not
  offered where it cannot complete.

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
├── progress.md                 state + Open work · chat.md · README.md
│   docs/handbook.md            ← THIS FILE, §0–§10; every §N in the project means here
│   docs/history.md             the dated session log, newest first
├── Human_Muscle_Groups.jpg     body-map source, Tim's own. GIT-IGNORED (*.jpg)
├── img/ink-front.webp          the body map's ink layer, ~100 KB each. GENERATED
│   └── ink-back.webp           the only binary assets in the app
├── tools/build-body-art.py     regenerates js/body-art.js + img/ink-*.webp from the
│                               JPG. Dev-only; needs pillow/numpy/scipy/potracer
├── tools/strength-sim.mjs      THE SIMULATOR. A virtual lifter with a KNOWN 1RM
│                               curve, logging realistically. Deterministic —
│                               mulberry32, never Math.random()
├── tools/strength-fit.mjs      re-runs every sweep the estimator's constants
│                               came from, so a later session can re-derive
│                               rather than trust
├── css/app.css                 ALL styling. Mobile-first; desktop in one media query.
│                               ⚠️ The MOTION section near the end owns every
│                               duration and easing in the app (Rule 7) — change
│                               --t-fast / --t / --t-slow there, never inline
├── js/
│   ├── app.js                  hash router + boot
│   ├── store.js                data layer — async, backend-agnostic. Holds
│   │                           the READ CACHE: getters are served from
│   │                           memory, mutations always read fresh,
│   │                           because a read-modify-write from a stale
│   │                           copy erases whatever changed elsewhere.
│   │                           Also HOW FULL THE CLOUD IS — cloudUsage()
│   │                           sizes each collection document by
│   │                           Firestore's published rules (32 bytes a
│   │                           map, 8 a number, NOT JSON length) and
│   │                           returns null on any backend that is not
│   │                           Firestore. Settings warns from 80 %.
│   │                           ⚠️ And WEEKLY SETS PER MUSCLE from recorded
│   │                           sessions — trainingForMuscle() for one
│   │                           muscle, weeklyVolumeByMuscle() for all of
│   │                           them, over ONE shared window helper because
│   │                           two screens quoting different counts for the
│   │                           same muscle is the failure to design against
│   ├── e1rm.js                 rep normalisation — pure maths (D11)
│   ├── strength-standards.js   percentile ranking — pure maths (D15)
│   ├── preset-systems.js       ready-made systems to browse and copy. Shaped so a
│   │                           third-party one can slot in: author/sourceName/sourceUrl
│   ├── next-workout.js         where you are in your own rotation — pure, clock
│   │                           passed IN. vision §1.2 first half. Builds its own
│   │                           caption so the sentence cannot drift from the answer
│   ├── set-types.js            supersets/tri-sets (grouping) and drop sets
│   │                           (nesting) — pure. Owns the walk the runner
│   │                           follows and the one-drop-set-is-one-hard-set rule
│   ├── demo.js                 THE DEMO ACCOUNT'S YEAR — pure, deterministic,
│   │                           seeded. Never Math.random(), or "resets to the
│   │                           default" stops being true. The SWITCH lives in
│   │                           store.js; this file only builds the data
│   ├── strength-estimate.js    THE ESTIMATOR — pure, clock passed in.
│   │                           ⚠️ THIS SAID "IMPORTED BY NOTHING IN THE APP
│   │                           on purpose" AND THAT STOPPED BEING TRUE:
│   │                           muscle-evidence.js imports robustAggregate()
│   │                           from it, and muscle-evidence is on the Muscles
│   │                           screen. Its WINDOWED, BANDED output is still
│   │                           wired to nothing, which is what that line was
│   │                           really about. Constants FITTED to
│   │                           tools/strength-sim, not reasoned — and the ones
│   │                           that could not be fitted say so on the constant
│   ├── strength-observations.js THE WALK that turns sessions and benchmarks
│   │                           into per-muscle evidence — pure, `today` passed
│   │                           in. Out of store.js on 2026-09-02 so a FRIEND's
│   │                           published training goes through the same rules
│   ├── exercise-estimate.js    ONE NAMED LIFT's estimated 1RM — the body map's
│   │                           arithmetic run backwards, plus the rep
│   │                           prediction. Read its header before touching it
│   ├── session-stats.js        ONE SESSION's own numbers. Owns recordedSetCount
│   ├── session-draft.js        THE WORKOUT IN PROGRESS, ON DISK — save/load/
│   │                           clear, and liveDraft(), the ONE copy of the
│   │                           same-day rule. Out of views-session.js on
│   │                           2026-09-07 because the bar below asks the same
│   │                           question from every screen and cannot import
│   │                           the runner
│   ├── live-session.js         "YOU HAVE A WORKOUT OPEN" — the bar above the
│   │                           nav. Reads the draft, names the exercise the
│   │                           WALK points at (stepsFor, never entries[index]),
│   │                           and is the way back in. ⚠️ In the LAYOUT, as the
│   │                           last child of .screen — fixed would sit on top
│   │                           of every screen's .pane-bottom for the length
│   │                           of a workout
│   ├── personal-bests.js       TYPED RECORDS — weight / volume / reps / 1RM
│   ├── compare.js              TWO PEOPLE ON ONE LIFT — and no verdict
│   ├── routine-from-session.js A FRIEND'S WORKOUT → one of yours. Sets carry,
│   │                           weights cannot
│   ├── share-image.js          THE SHAREABLE PICTURE — pure layout + a painter
│   ├── progression.js          DOUBLE PROGRESSION — pure, and deliberately
│   │                           NOT part of goals.js. No clock, no import from
│   │                           goals.js, so "a deadline may not make this ask
│   │                           for more" is structural. Time may only ever
│   │                           SUPPRESS a suggestion, never raise one
│   ├── goals.js                GOALS — pure. A goal is a LEVEL, never a predicted
│   │                           number of pounds. Refuses two things: reading the
│   │                           deadline to decide what it asks of you (that
│   │                           would push hardest on somebody coming back from
│   │                           a lay-off), and emitting an on-track verdict
│   │                           (gated on the estimator)
│   ├── qr.js                   A QR CODE, drawn in the app — pure. Byte mode,
│   │                           versions 1-6, all 8 masks SCORED (a hard-coded
│   │                           mask can create a false finder pattern, and the
│   │                           data bits change with every payload). Encodes
│   │                           #/add/<uid>, which is permanent, never a
│   │                           one-time invite link that goes stale in a pocket
│   ├── social.js               VISIBILITY TIERS + the projection builder — pure.
│   │                           🚨 ALSO THE USER DIRECTORY since 2026-08-29, and
│   │                           its header says why that reverses the "nothing
│   │                           can be enumerated" decision rather than narrowing
│   │                           it. Read it before touching search.
│   │                           Wired to views-social.js since 2026-08-18, and
│   │                           ✅ two real accounts ran the whole round trip
│   │                           against the live project on 2026-08-22.
│   │                           ✅ Disconnect is MUTUAL since 2026-08-27 —
│   │                           a tombstone the other client acts on.
│   │                           Sharing publishes a derived copy; it never
│   │                           widens a permission on the private data. Built
│   │                           by whitelist, never by deleting fields,
│   │                           because deletion fails OPEN
│   ├── muscle-evidence.js      WHICH exercises rate WHICH muscle, the ratios
│   │                           between them, and the confidence model — pure maths.
│   │                           ⚠️ Since 2026-08-24 it also discounts a reading for
│   │                           WORK ALREADY DONE ON THAT MUSCLE THAT SESSION
│   │                           (`fatigueFactor`), because a rep count cannot tell a
│   │                           heavy set from a tired one. docs/fatigue-plan.md
│   ├── optimal.js              the "% OPTIMAL" RATING — dose-response curves
│   │                           fitted to published values, clamped at the top
│   │                           of the evidence, banded to 5. Pure maths
│   ├── volume-map.js           HOW MUCH WORK landed on each muscle — direct 1.0,
│   │                           indirect 0.5, plus the published efficiency
│   │                           tiers. ⚠️ NOT the same table as muscle-evidence:
│   │                           that asks "how strong", this asks "how much work"
│   ├── year-grid.js            THE CALENDAR'S YEARS VIEW — pure, clock passed
│   │                           in. A year as columns of weeks, Monday first,
│   │                           with the month-label columns. Binary on
│   │                           purpose: one square means "trained", because
│   │                           two hues are not separable at 6px
│   ├── research-data.js        the age-vs-strength chart's data — pure. Harbo
│   │                           2012 Table 5, plus why it is NOT drawn from
│   │                           Strength Level (their by-age tables are one
│   │                           shared model wearing eleven names)
│   ├── exercise-images.js      THE PICTURE MANIFEST — pure, and GENERATED by
│   │                           tools/build-exercise-images.mjs. 🚨 EMPTY: the
│   │                           art Tim wants is a paid stock library and
│   │                           buying it is his call, so the feature ships
│   │                           ahead of it and "no picture" is an ordinary
│   │                           state everywhere downstream. Keyed by exercise
│   │                           ID because two exercises share a NAME
│   ├── exercise-families.js    WHICH EXERCISES CAN STAND IN FOR EACH OTHER
│   │                           — pure. 43 movement PATTERNS (not muscles) over
│   │                           315 of 319 exercises, hand-written because a
│   │                           name-derived version is wrong quietly. ⚠️ Four
│   │                           exercises have NO family on purpose: adduction
│   │                           is the OPPOSITE of abduction on a machine that
│   │                           looks the same. Read the header before adding
│   │                           a member; a test resolves every one
│   ├── research-topics.js      THE BASICS, TAUGHT — pure. Eleven topics, 27
│   │                           sources each defined ONCE, a confidence level
│   │                           per topic and a stated limit on every one.
│   │                           ⚠️ Read the header before adding a claim: this
│   │                           is the one file whose CONTENT is the feature,
│   │                           and its word budgets are asserted in
│   │                           tests/data-layer.test.mjs. docs/research.md §13
│   ├── units.js                lbs/kg — pure maths. EVERYTHING IS STORED IN POUNDS;
│   │                           converts only at the edges, so switching is lossless
│   ├── body-art.js             GENERATED traced muscle paths — do not hand-edit
│   ├── body-map.js             composes the fill paths + the ink masks
│   ├── import-file.js          READING A FILE FROM ANOTHER APP — pure. CSV,
│   │                           column detection, and the three things it
│   │                           REFUSES to guess: the date order, the weight
│   │                           unit and the distance unit. Deterministic ids,
│   │                           so re-importing an overlapping export upserts
│   ├── views-import.js         the import screen (#/import) — read, plan,
│   │                           SAY what will happen, then write
│   ├── image-crop.js           POSITIONING A PHOTO IN A CIRCLE — pure maths, no
│   │                           DOM. The crop is a square in SOURCE pixels, so the
│   │                           result does not depend on the phone it was cropped
│   │                           on. One invariant: the square never leaves the
│   │                           image, or an avatar saves with a blank wedge
│   ├── exercises.js            319-exercise library + load-type rules, and the
│   │                           BODY-WEIGHT FRACTION table. ⚠️ `assist: true` on an
│   │                           entry INVERTS the sign of the logged weight
│   │                           everywhere — Assisted Pull-Up (2026-08-24) plus
│   │                           Assisted Dip and Assisted Chin-Up (2026-08-31).
│   │                           ⚠️ A NEW ROW NEEDS A RATIO in muscle-evidence.js
│   │                           and a FAMILY in exercise-families.js or it is
│   │                           inert; both are asserted
│   ├── ui.js                   el(), icons, sheets, toasts, steppers, screenShell, profileButton
│   ├── views-workouts.js       home, the RECORD tab (StartPickerView — the
│   │                           workout list plus the benchmark action),
│   │                           SYSTEMS list, one system, workout builder,
│   │                           Explore ready-made systems, exercise picker
│   ├── views-session.js        session runner, benchmark form. ⚠️ THE DRAFT
│   │                           FUNCTIONS LEFT THIS FILE on 2026-09-07 —
│   │                           session-draft.js, unchanged. ⚠️ Its corner
│   │                           control is a ▾ that LEAVES THE WORKOUT OPEN
│   │                           and asks nothing; starting a DIFFERENT
│   │                           workout meets a screen rather than wiping
│   │                           this one. ⚠️ RECORDS FOR
│   │                           OTHER PEOPLE two ways since 2026-08-29 — a
│   │                           FRIEND (uid, their half OFFERED to their own
│   │                           account at Finish, suggestion read from what
│   │                           they share with you) or a SAVED PERSON (no
│   │                           account, sets kept here). ⚠️ The two histories
│   │                           are NEVER merged: a doubled session is what
│   │                           makes progression propose more weight.
│   │                           ⚠️ THE SET LIST IS THE SCREEN since 2026-08-29
│   │                           — the ± controls
│   │                           sit INSIDE whichever set is open, exactly one
│   │                           always is, and a nudge repaints the row IN PLACE
│   │                           because rebuilding the list would destroy the
│   │                           input being typed into. Swap an exercise
│   │                           mid-workout (splits if sets are logged), remove
│   │                           one for today, fills
│   │                           set 2 from set 1 the first time, and shows what
│   │                           an assist machine really leaves on you
│   ├── views-data.js           calendar (its OWN tab again since 2026-08-25),
│   │                           day detail, Data screen (opens on Muscles),
│   │                           settings incl. the More details toggle
│   ├── views-muscles.js        the Muscles pane
│   ├── views-social.js         the FRIENDS half of Home, a friend's page,
│   │                           accepting an invite — and since 2026-09-02
│   │                           FriendSessionView, ONE of their workouts on its
│   │                           own screen (#/friend/<uid>/<sessionId>): muscle
│   │                           split, typed bests, set tables, compare, copy as
│   │                           a routine, share a picture.
│   │                           Reads ONLY published copies — it cannot
│   │                           reach anybody's private data even if it tries
│   ├── views-goals.js          Goals — no longer a tab, reached from Settings;
│   │                           the two-step picker, why progress
│   │                           stalls, and programmes that fit the goal
│   ├── views-edit-session.js   editing a workout already recorded (calendar → day → pencil)
│   ├── views-profile.js        gender, birth year, body weight
│   ├── views-account.js        account, sign-in, upgrade-from-anonymous
│   ├── firebase-config.js      REAL KEYS — project fitness-tracker-th, live
│   └── firebase-backend.js     Firestore + auth adapter
├── tests/
│   ├── data-layer.test.mjs     1847 assertions, no dependencies. Also holds the
│   │                           CROP maths, the FILE IMPORT parser and THE
│   │                           RESEARCH TAB'S CONTENT — every claim cites a
│   │                           defined source, every topic states its limit,
│   │                           and the word budgets (45 an answer, 260 a topic)
│   ├── bodyweight.test.mjs     175 assertions, no dependencies — the fractions,
│   │                           their sources, and what stays REFUSED
│   ├── strength-estimate.test.mjs  72 assertions — measured simulator outcomes
│   ├── social.test.mjs         181 assertions, no dependencies — what is SHARED,
│   │                           plus the NAME MATCHING and the graph's `pending`
│   ├── goals.test.mjs          232 assertions, no dependencies — the requirements
│   │                           model, and the two REFUSALS
│   ├── demo.test.mjs           58 assertions, no dependencies — the demo year is
│   │                           deterministic, and plausible enough that the
│   │                           app's own analysis of it is not nonsense
│   ├── optimal.test.mjs        76 assertions, no dependencies — the curves
│   │                           reproduce the PUBLISHED figures, plus 3 refusals
│   ├── year-grid.test.mjs      45 assertions, no dependencies — every day of
│   │                           the year drawn exactly once (leap years, a
│   │                           Sunday opening), every square in the row its
│   │                           weekday really falls on, every month label on
│   │                           its own month
│   ├── volume-map.test.mjs     64 assertions, no dependencies — direct/indirect
│   ├── a11y.test.mjs           102 assertions, no dependencies — the PALETTE,
│   │                           all four of them, in both themes
│   ├── qr.test.mjs             33 assertions — needs `npm i --no-save jsqr`.
│   │                           ZXing's published Reed-Solomon vectors, plus a
│   │                           ROUND-TRIP DECODE by an independent decoder.
│   │                           Deliberately does NOT assert which mask a
│   │                           payload gets: implementations legitimately
│   │                           disagree on penalty rule 3
│   ├── rules.test.mjs          159 assertions — who may READ it, who may OFFER
│   │                           you a workout, who may announce a disconnect,
│   │                           who may ASK to connect. 🚨 One is an `allow`
│   │                           recording a COST (the directory is enumerable)
│   │                           rather than a guarantee. Needs the
│   │                           Firestore emulator and Temurin 21 (§0.9)
│   ├── sw-update.test.mjs      12 assertions — needs Chrome. Edits a file and
│   │                           asserts the page offers a refresh
│   ├── compare.test.mjs        53 assertions — two people on one lift. The
│   │                           WINDOW is the load-bearing one, and its fixture
│   │                           is built so the answer differs unwindowed
│   ├── estimate.test.mjs       29 assertions — the per-exercise 1RM and the rep
│   │                           prediction. The ROUND TRIP is the load-bearing
│   │                           one: reps → 1RM → reps must come back exact
│   ├── routine.test.mjs        42 assertions — copying a friend's workout.
│   │                           Weights never survive; a missing exercise is
│   │                           dropped AND reported
│   ├── share-image.test.mjs    91 assertions — the pure half of the shareable
│   │                           picture, including a bound on WASTED space,
│   │                           which is what both shipped bugs were made of
│   └── render.test.mjs         875 jsdom assertions — mounts every screen
└── docs/  spec.md · research.md · vision.md · strength-map-plan.md · goals-plan.md
         activities-plan.md · airpods-plan.md · integrations-plan.md · fatigue-plan.md
         strength-estimate-plan.md · optimal-rating-plan.md · social-plan.md
         firebase-setup.md · competitive-teardown.html
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
- **⚠️ Use `setChildren(node, ...)`, never `node.replaceChildren(...)`.** `replaceChildren`
  stringifies anything that is not a Node, so a `cond ? el(...) : null` child renders the literal
  text **"null"** on the page — which it had been doing under the exercise name on the session
  screen for every exercise without a note. `el()` guards this; the direct calls did not.
- **⚠️ `.pane-scroll` is a COLUMN FLEX container, so its children shrink.** A child that sets
  `min-height: 0` loses the `min-height: auto` protection and gets crushed *below its own content
  height* as soon as the pane overflows — the child's rows keep their size, spill out of the shrunken
  box, and whatever comes next is painted on top of them. This shipped: on a 360×640 phone with six
  sets, the session screen's "Add another set" button was drawn over set 4 and hid sets 5 and 6.
  Anything tall inside a pane wants `flex: none`, and `min-height: 0` belongs only on a child that
  also handles its own overflow.
- **⚠️ A BOOLEAN SET BEFORE AN `await` MARKS THE WORK DONE AT THE MOMENT IT STARTS.** This project
  has now met this three times and it presents differently each time, so learn the shape rather
  than the symptom. `MemoryBackend.seed()` did `this.seeded = true` and *then* awaited, so every
  concurrent caller skipped the wait and read rows that were not there — and `muscleStrength()` is
  exactly that caller, four reads in one `Promise.all`. **Entering the demo could show the muscle
  map asking for a body weight on an account holding 53 weigh-ins**, then correct itself on the
  next render, which is precisely why no screenshot review caught it. The fix is to hold the
  PROMISE and return it, not a flag — and to clear it on rejection, or one transient import failure
  latches the demo broken forever. `tests/demo.test.mjs` reproduces the race in the shape the app
  produces it; reverting the fix gives 0 sessions and a profile missing gender and body weight.
- **⚠️ A read-modify-write migration must be SINGLE-FLIGHT.** `ensureSystems()` reads two
  collections, decides, and writes both. Two callers running it at once each read "no systems", each
  created one, and the second write clobbered the first — leaving the list pointing at a row that no
  longer existed and every workout stamped with a dead id. It presented as an empty system list that
  said "Not found" the moment you tapped it. `WorkoutsView` asking for systems and workouts in one
  `Promise.all` is exactly that case, and is a perfectly reasonable thing for a view to do. There is
  a test that fails if the single-flight guard is removed.
- **⚠️ A "merge two things" operation must merge the whole of both, not the two items either side
  of the seam.** `toggleLink` stamped the new group id on the exercise on each side of the boundary
  only, so joining two adjacent supersets left the far end of the right-hand block on its old id —
  where it was then a group of one and got dissolved. Joining two supersets silently un-supersetted
  the last exercise. It now walks each side's run to its end first. Found in review, not by use.
- **⚠️ Anything that DROPS rows must ask what the survivors were pointing at.** Both save paths
  discard entries with no numbers in them, and the edit form can remove one outright — either leaves
  the other half of a superset still carrying `group`, and the day view brackets it alone and calls
  it a "Superset". `dropOrphanGroups()` runs on both save paths. The general form: a foreign key
  into a set of rows is only valid while the rest of that set still exists.
- **⚠️ A view that renders from a DERIVED list must still write to the original.** The workout
  builder draws from `blocksOf(draft.exercises)`, and `blocksOf` maps over the list — so the `item`
  inside a block is a **copy**. Every handler that closed over it (the set-type chip, the sets
  stepper, the notes box) wrote into a throwaway object and did nothing at all. jsdom did not catch
  it because the first tests read the screen, which re-rendered from the unchanged draft and looked
  right; **a real click in a browser is what found it**. The rule: a derived structure is for
  LAYOUT, and mutation goes back through the index into the source array. The builder tests now
  assert by reading the workout back from the store, and were checked to fail when the bug is
  reintroduced — a test that passes either way is worse than none.
- **⚠️ A UTC timestamp is not a local date, and a test that mixes them is green by time of day.**
  `startedAt` is a UTC instant (`new Date().toISOString()`); `todayISO()` is the LOCAL day. A render
  test compared `startedAt.slice(0, 10)` to `todayISO()` and so failed every evening after 18:00
  here — UTC had rolled into tomorrow while local had not — and passed again each morning. It was
  green when this session started and red an hour later with nothing touched in between. **The app
  is fine**: day logic runs off `startedOn`, which is local, and `startedAt` is never compared to a
  local date anywhere. The test now asserts what it actually meant — that `startedAt` is within
  minutes of real time and did *not* get dragged back to the back-dated day. Anything comparing a
  stored timestamp to a calendar day wants this same look. Also: parse `YYYY-MM-DD` as **local**
  midnight by splitting it, never `new Date(iso)`, which reads a bare date as UTC and lands a day
  early for everyone west of Greenwich (`daysBetween()` in `next-workout.js`).
- **Weights are STORED IN POUNDS, always** (`units.js`). kg is a display choice, converted at exactly
  two edges: what is shown and what is typed. `e1rm.js` and `strength-standards.js` are pounds
  throughout. Anything that stores a number the user typed must go through `units.fromDisplay()`.
- **Pure-maths modules are the pattern that works.** `e1rm.js`, `strength-standards.js` and
  `units.js` have no DOM or store dependency, so they are fully testable headlessly. They have
  caught real bugs that way, and `docs/strength-estimate-plan.md` follows the same shape.

### Data model

```
Exercise    id, name, muscle, equipment, fields[], loadType, isCustom
System      id, name, notes, createdAt, updatedAt
            ── a programme. Workouts belong to one, and only one.
Workout     id, name, systemId, isBenchmark, order?,
            exercises[{ exerciseId, sets, notes, group?, setType?, drops? }],
            createdAt, updatedAt
            ── `group`: adjacent exercises sharing one form a superset/tri-set.
               `setType: 'drop'` + `minis: n` plans n drops after every set.
               `setType: 'myo'` + `minis: n` plans n myo-rep match sets.
               ⚠️ normalizeWorkout() REBUILDS each exercise field by field, so
               any new field must be named there or it is lost on every read.
            ── `order` is the position it had in a ready-made programme. Absent
               on anything the user typed, because a list you wrote yourself has
               no meaningful order. getWorkouts() sorts ordered first, then by
               name — so a copied split keeps its shape and your own additions
               land at the end of it rather than in the middle.
GuestSession  session-shaped, plus guestName, and since 2026-08-29
            personId?   ← a saved identity (no account)
            forUid?     ← a FRIEND's account. Their half is OFFERED to them at
                          Finish and is theirs only once they accept it.
            ── Read by id where there is one and by NAME only as a fallback,
               for rows written before those fields existed.

Session     id, workoutId, workoutName, date, startedAt, finishedAt, isBenchmark,
            location?,        ← typed label (0m), absent when none; never GPS
            ── an ACTIVITY session (2026-08-26) is this same shape with NO
               workoutId: one entry, one set of time/distance. That absence is
               what keeps it out of the rotation suggestion and progression.
            entries[{ exerciseId, exerciseName, group?, setType?,
                      sets[{ weight, reps, time, distance, minis?[…] }] }]
            ── ⚠️ `minis` live INSIDE a set, never as extra rows in `sets`.
               Drops for a drop set, match sets for a myo-rep. Read through
               minisOf(), which also reads the older `drops` key.
               That is what makes "a drop set is ONE hard set" true by
               construction: every count of sets.length keeps counting one,
               so no analysis path has to know drop sets exist (D23).
Benchmark   id, date, exerciseId, exerciseName, values{}, sourceSessionId?
            ── sourceSessionId set = DERIVED from a benchmark workout, and rebuilt
               from that session on every save. Absent = entered by hand, never touched.
BodyWeight  id, date, weight, createdAt          ← one row per weigh-in
Goal        id, muscle, liftName, targetLevel, targetLevelName, targetPercentile,
            targetWeight, startWeight, startPercentile, startLevel, startDate,
            endDate, ambition, gainPct, comparison, status, endedReason?
            ── ⚠️ targetWeight is FROZEN in pounds, never recomputed. A level is
               a PERCENTILE, and the weight behind it moves with body weight, age
               and the comparison group (D20) — so recomputing it would make a
               goal quietly harder because somebody gained four pounds. The
               comparison it was computed against is stored alongside it and the
               picker says so.
            ── One row has status 'active' at a time; store.setGoal() ends any
               other. Old goals are kept, never deleted.
⚠️ Adding a TOP-LEVEL collection (`directory`) also needs its own `match` block inside
`match /databases/{database}/documents` — a block written outside it compiles fine and matches
nothing, which presents as every read and write being refused. Cost twenty minutes on 2026-08-29.

Person      id, name, createdAt, lastUsedAt
            ── the roster you RECORD FOR (2026-08-29). ⚠️ INVENTED PEOPLE ONLY:
               a friend is never copied in here, because a saved copy of
               somebody's name goes stale the day they rename themselves and
               their uid identifies them better than any label. Friends come
               live off the friends list every time.
            ── ⚠️ Deleting one deletes the NAME and nothing else. Every session
               recorded for them stays — same argument D22 makes about systems.
            ── savePerson() is IDEMPOTENT BY NAME when given no id, so "Alex"
               twice is one identity. The dedupe is in the store rather than at
               the call site: two "Alex" rows each holding half his training is
               a quiet failure, and the next caller would not think to guard it.

Settings    id, units, theme, gender, birthYear,  ← birth year, NEVER age
            avatar, avatarSource, avatarCrop{zoom,cx,cy}
            ── the FACE everything paints (256px), the re-editable SOURCE it
               was cut from (768px), and where the circle was. Written together
               so a crop can never point at a different photo than its source.
               All three cleared by Remove.
```

`normalizeWorkout()` in `store.js` migrates the old `exerciseIds[]` shape on read — keep it.
`store.ensureSystems()` does the same job for workouts saved before systems existed, and is
**single-flight on purpose** — see the key patterns below.

⚠️ **Adding a collection to `COLLECTIONS` also requires adding it to `knownCollection()` in
`firestore.rules` and redeploying**, or every cloud write to it is denied while localStorage keeps
working — invisible until someone signs in. **Since 2026-08-19 a test compares the two lists** and
fails if they disagree, so only the *redeploy* is still on you. `goals` and `guestSessions` are in
both and are deployed.

⚠️ **Adding a `js/` module also requires adding it to the precache list in `sw.js`.** There is a test
that fails if you don't (`sw.js precache is missing: …`), which is how `js/social.js` was caught the
minute it was created — a module missing from the precache is a module the app cannot load offline,
and D6 says offline is non-negotiable.

**Social paths** — `users/{uid}/shared/{audience}` ⚠️ **two documents since 2026-09-03, `friends` and
`public`, where there were three tiers**: the published copy, carrying its own `viewers` list so the
rule needs no second read, plus an `isPublic` flag the rule reads to grant any signed-in caller a
`get`. ⚠️ **The old `light`/`mid`/`full` ids are still READ as a fallback for a friend who has not
migrated, and can never be written again** — the rules refuse to create one.
`users/{uid}/social/graph` (owner-only: `connections`, and since
2026-08-29 `pending` — who I have ASKED, which is what makes the accept probe safe because only
people I asked are ever probed), `users/{uid}/invites/{token}` (`get` yes, `list` no),
`users/{uid}/handoffs/{id}`, `users/{uid}/disconnects/{leaverUid}`, and — added 2026-08-29 —
`users/{uid}/requests/{fromUid}` (**owner-only read**, unlike invites: an invite is a capability I
issued, a request is something asked OF me, and two meanings in one collection is how a read rule
ends up wrong).

🚨 **AND ONE TOP-LEVEL COLLECTION OUTSIDE `users/` — `directory/{uid}`, added 2026-08-29.** It is the
**only** place in this app that grants `list`, it holds a uid and a chosen display name and nothing
else, and it is shape-checked so it can never grow an email field. **Read the block above it in
`firestore.rules` before touching it.** It is also the one piece of an account that lives outside
`users/{uid}`, so **deleting an account deletes this row first** — otherwise the name and uid of
somebody who no longer exists stay in a collection the whole signed-in world can list.

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

### Rule 8 — back means the screen you were just on

*⚠️ Printed before Rule 7 rather than after it, because Rule 7 (motion) is long and ends the section.
There are **eight** rules; do not stop reading at the highest number you happen to reach first.*

Added 2026-09-02 on Tim's report: *"When you click back on something it should always go to what you
were on right before. Currently when you click on someone else's workout and then go back, it takes
you to that user's profile/page rather than back to the home menu where you saw the post on."*

⚠️ **HE REPORTED ONE SCREEN AND DESCRIBED ALL FORTY-EIGHT.** Every `screenShell({ back })` in this
app hard-coded a **parent** — the calendar for a day, Workouts for a workout, the friend for their
session — and a parent is the right answer only when you arrived from the parent. Reached from
anywhere else, the arrow moved you sideways and put what you were reading two taps away.

**The rule:** the arrow goes back through history. A screen's own `back` is the **fallback**, for the
case history cannot serve — a shared link, a bookmark, the first screen of a cold start — so a deep
link still lands somewhere sensible instead of stepping off the site.

- **The position is stamped on the history entry** (`markRoute()` in `ui.js`), not counted in a
  variable. ⚠️ A counter cannot tell a forward navigation from the browser's own back button — both
  arrive as one `hashchange` — so it drifts the first time somebody uses the OS gesture, silently.
- **`backExact: true` is the opt-out, and there is exactly one user of it**: the finish screen, whose
  arrow means *"go and edit what you just recorded"* rather than *back*. History would be actively
  wrong there — that screen is drawn by replacing `#app` without changing the hash, so the entry
  behind it is the session runner whose draft has just been cleared.
- ⚠️ **`#/blank` IS GONE.** Nine places forced a re-render by bouncing through it, which pushes two
  history entries — so under this rule the back arrow landed on a route that deliberately renders
  nothing. `refreshRoute()` re-renders in place and pushes nothing. The router still guards `blank`
  for tabs open from before.

### Rule 7 — motion states a relationship, or it does not ship

Added 2026-09-01 on Tim's ask for *"visible motion… rather than just an instant change or
teleportation"*, with three constraints attached to it: realistic acceleration, quick, and only where
appropriate. The rule those four collapse into:

**A thing that moves is telling you where it came from, where it went, or what pushed it.** The sheet
came from the bottom edge. The pill slid from the segment you were on. The row you opened pushed the
rest down. **If a movement does not answer "what just happened", it is decoration and it does not go
in** — which is also the whole of "only when appropriate".

- **Quick is a number, and it is tested.** `--t-fast: 100ms` (a press answering back), `--t: 170ms`
  (the default), `--t-slow: 240ms` (a whole surface). Nothing may exceed 250ms; `tests/a11y.test.mjs`
  fails if one does.
- **Accelerate and decelerate.** Linear is what reads as computery. `--ease-out` for arriving,
  `--ease-in` for leaving, `--ease-both` for a thing crossing the screen while you watch — the last
  is the one that looks like an object with weight.
- ⚠️ **NOTHING ON THE LOGGING PATH, except a press answering back.** The set list, the steppers and
  the rest timer are used one-handed with a bar in the other. 170ms between tapping + and seeing the
  number is 170ms of standing in a gym.
- **`transform` and `opacity` where there is a choice** — they cost no layout. The two deliberate
  exceptions are a bar's `width` when a screen is built and `grid-template-rows` on something opening,
  which is the only honest way to make the content below it slide rather than jump.
- ⚠️ **`prefers-reduced-motion` turns all of it off, as a blanket over `*`.** Not a courtesy: sliding
  panels are genuinely unpleasant with a vestibular disorder, and this app is used by people who are
  moving. The browser audit can never catch its removal, so a test pins it.
- ⚠️ **A movement must not claim something the app does not know.** A screen arrives with a rise
  rather than a sideways push, because a horizontal slide asserts a direction of travel this router
  cannot know.

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
| D3 | **Weekly sets per muscle group is the headline metric.** | What hypertrophy responds to (~10–20 hard sets/muscle/week). Only Alpha Progression does it. ✅ **BUILT 2026-09-01 — Data → Volume**, from recorded sessions, every muscle, against the published efficiency tiers rather than against invented target bands. The weighted mapping it was blocked on has existed in `js/volume-map.js` since 2026-08-18. ⚠️ **What is deliberately NOT built is a target**: the tiers say what another set buys, and the app does not get to tell somebody they are doing too little or too much (Rule 6). |
| D4 | **Target = spreadsheet transparency + app ergonomics.** | Spreadsheets win on whole-block visibility, structural freedom, permanence. Apps only win the logging loop. Take both. |
| D5 | **e1RM must be rep-range honest.** Full confidence 2–10 reps, flag 11–15, don't normalise above 15. | Formulas degrade badly above ~10 reps. Built — and **enforced in ranking as `MAX_EVIDENCE_REPS = 15`** since 2026-08-16. It was not, and a 135×25 burnout set extrapolated to 258 lb, beat a real 205×5 top set and promoted a muscle a whole level. Benchmarks get no exemption. |
| D6 | **Offline-first logging is non-negotiable.** | Gyms are basements. **Built 2026-08-16** — `sw.js` precaches the whole shell. Until then this was a claim, not a feature: store.js falls back to localStorage when the *cloud* fails, but with no signal the app never BOOTED, so that fallback never ran. Verified by killing the origin server, not by emulating offline — see §0.7. |
| D7 | **No social feed.** | Repeatedly unwanted in Hevy reviews. ⚠️ **NARROWED IN PRACTICE AND THE ROW HAD NOT SAID SO UNTIL 2026-09-02.** Home has been a feed of your own friends since 2026-08-25 and a Hevy-shaped one since 2026-09-02, and **D7 was never reopened to allow it** — the argument, in `docs/social-plan.md` §11 and §12.11, is that a list of people you chose to connect to is a list you VISIT, and what D7 actually refused is a **discovery feed of strangers**, which remains refused (Open work 18). A reader hitting this row first was being told the opposite of what the app does. |
| D8 | **Teach at the moment of use**, never a manual or onboarding carousel. | RP Hypertrophy has the best science and worst delivery. |
| D9 | **Progressive disclosure is core architecture.** | Audience is "any level". Can't be bolted on later. 🚨 **D9 IS THIS AND ONLY THIS. Eleven places in this repo cite "(D9)" for the refusal to add an RIR/RPE field, which is a completely different decision and was never in this table at all** — recorded as **D28** below, 2026-09-02. Two of the citations (`docs/spec.md`) do mean progressive disclosure and are correct. |
| D10 | **Training goal is a user setting that reconfigures the dashboard.** | One fixed dashboard would be wrong for most users. |
| D11 | **Marzagão (2026) weight-dependent e1RM**, not Epley/Brzycki.<br>`1RM = w × (1 + (r−1)^0.85 / k(w))`<br>`k(w) = max(4.58, −2.55 + 4.58·ln(w_kg))` | The reps↔%1RM curve genuinely differs by exercise (Nuzzo 2024: exercise type is the *only* meaningful moderator). Classical formulas use one fixed factor for every exercise in the library. **⚠️ Our k-floor is 4.58, NOT the paper's 0.5** — below k = B the published curve *decreases* in weight, so a heavier lift would score lower and the inverse stops being unique. Asserted monotone across 1–400 lb. See `docs/research.md` §1. |
| D12 | **Accounts are anonymous-first**; upgrading *links* the account so uid and data carry over. | A signup wall on first open is the biggest killer of retention, and D8/D9 say no wall on day one. Cost: un-upgraded data lives in one browser — the UI states that plainly. |
| D13 | **`BACKEND = 'auto'`, and a cloud failure falls back to local storage.** | Losing signal must never stop someone logging a set (D6). Settings says "Not connected" rather than pretending to sync. |
| D14 | **Graphs never mix benchmarks with workout sets.** One source at a time, benchmarks by default. | Reported by Tim: a workout set sat far off his benchmark trend. Two more problems fell out — the shown point flipped between sources as the rep target changed, and one-point-per-day silently discarded the loser. |
| D15 | **Strength ranking is against people who lift and log, never "everyone".** Levels are lifter-based; a general-population figure is an optional extra line, never a re-tiering. | Competition data puts the general population below its own 50th percentile; general-population data would make every user Elite. The seven-level scale compresses into ~70–98 % of all adults. **The UI must say "of people who lift".** |
| D16 | **Deadlift fills Glutes** on the muscle map. | It belongs to glutes, hamstrings and back at once. Hip-thrust standards are the thinnest of the three. Revisit with the weighted mapping. |
| D17 | **A benchmark workout's benchmarks are DERIVED from its session, not written alongside it.** Each carries `sourceSessionId` and the whole set is rebuilt on every save. | The alternative — write benchmarks once at finish — strands them the moment the record is edited. Move the workout to another day and its benchmarks stay on the old one; delete an exercise and its benchmark lives on; untick the flag and nothing undoes it. Rebuilding makes all four correct by construction instead of by remembering. Hand-entered benchmarks have no `sourceSessionId` and are never touched. |
| D19 | **A muscle is rated by every exercise that trains it, converted by a ratio, and every rating carries a confidence.** Direct exercises decide the rating; a compound stands in for a secondary muscle ONLY when that muscle has nothing direct. Confidence is shown by DESATURATING the level colour, never by dimming it. | Tim, 2026-08-17: a full week of training produced one reading, because one lift per muscle meant 11 exercises out of the whole library could move the map. Coverage costs accuracy — the ratios are estimates, worst for machines — so confidence is what pays for it. Brightness could not carry confidence because brightness already carries the LEVEL: the ramp is a strictly monotone lightness scale, so a dimmed Elite would read as a lower level. Saturation is free, and grey already means "no data", so faded reads as "less sure" on the same axis. Fallback-only for secondaries keeps grey meaningful — it still answers "what am I not training". |
| D20 | **The comparison group is a user setting: FOUR independent axes — population (lifters / everyone), sex, body weight, age — plus two presets, "Like me" and "Everyone".** Any mixed population is modelled as a real MIXTURE of distributions, never an invented combined median. | Tim, 2026-08-17. Axes rather than presets alone because "women, any body weight, my age" is a real question; presets on top because the two combinations most people want are the extremes and setting four things by hand to reach them is a chore. The caption naming the group is built by the same function that computes it, so the number and the population it refers to cannot drift apart. |
| D21 | **D15 is narrowed, not repealed: ranking against people who do not lift is now offered, and untrained adults are given their OWN overlapping distribution rather than being assumed weaker than every lifter.** Untrained median = 0.55 × the lifter median. | Tim asked for a lift/don't-lift axis. D15's real objection was never "don't offer it" — it was that general-population data makes every user Elite. That was true of the OLD model, which assumed every non-lifter sat below every lifter and so forced any lifter above the 68th percentile, squashing seven levels into three. With an overlapping untrained distribution the levels keep spreading: a beginner lifter reads Proficient, a median lifter Expert, an elite lifter Elite — asserted in the tests. **The 0.55 is the weakest number in the file** (nobody has measured what the median adult can bench) and both the sheet and the detail panel say so. |
| D22 | **A workout belongs to exactly ONE system.** | Sharing one workout between two programmes sounds useful and is not: editing it in one place would silently change the other, and "did my Push day change because I imported someone else's programme?" is a question this app should never raise. Deleting a system therefore deletes its workouts — but never the sessions already recorded from them, because history is a record of what happened and does not become untrue when the plan behind it is thrown away. |
| D23 | **Set types are TWO shapes, not one list.** A superset/tri-set/giant set is a `group` on adjacent exercises — a statement about the SPACE BETWEEN them. A drop set is `drops[]` nested INSIDE a recorded set. Rest fires at the end of a round, and after a drop rather than after the top set. | "Supersets, drop sets and tri-sets" sounds like three of a kind and is two of two, and building it as one list would have got both wrong. The nesting is the load-bearing half: `progress.md` §6 already locks "a drop set counts as ONE hard set", and storing drops inside the set makes that true **by construction** — every existing path counts `sets.length` and keeps counting one, so no analysis code has to know drop sets exist. Flattening drops into `sets` would have silently inflated every set count, every weekly volume figure and D3 when it lands. The rest rule is the other half: a timer that started between the two halves of a superset would be instructing the user to do the opposite of what a superset is. |

**D18 is deliberately absent.** It is a *proposal* in `docs/strength-estimate-plan.md` §7, not a
locked decision — it would narrow D14, and D14 is locked, so it needs Tim's say-so first. §10 has
the question. Nothing else is missing from this table.

**D26 is LOCKED as of 2026-08-19**, having been ratified by Tim on 2026-08-18 and built the next
day: *the app may RECOMMEND a protein range with its citation, but may not track food, hold a food
database, or ask what anybody ate.* It narrows **D1** the way D21 narrowed D15 — D1's reasoning was
about tracking, and none of it applies to one cited number on a goal screen. The Goals screen shows a
daily gram figure from body weight, cites Morton 2018, and labels it *"a bar, not a dial"* rather
than *"grows with the goal"*, because the same meta-analysis found more protein above the breakpoint
does nothing. Nothing anywhere asks what anybody ate.

**D27 is LOCKED as of 2026-08-26**, by Tim's instruction to make the site fit running, climbing
and swimming: *activities are RECORDED first-class — calendar, feed, backups, cloud ceiling —
and MODELLED not at all: never the muscle map, the ratings, volume or progression.* It narrows
**D2** the way D21 narrowed D15: D2's real content was that the analysis is lifting-evidence-
based, and that stays fully true. `docs/activities-plan.md` §1.

🚨 **D28 IS RECORDED ON 2026-09-02, AND RECORDING IT IS THE WHOLE POINT — the decision was made long
ago, honoured everywhere, and written down nowhere:** *the app has no reps-in-reserve or RPE field,
and is not getting one.* Every module that touches proximity to failure defers to it —
`js/e1rm.js`, `js/optimal.js`, `js/goals.js`, `js/strength-estimate.js`, `js/views-data.js`,
`js/views-session.js` — and `docs/research.md` §3 is the evidence behind it: rep-based formulas all
assume a set went to failure, lifters under-predict their own reps to failure by one to five, and
asking somebody to rate a set mid-workout is a real cost in the one place this app is used
one-handed. It is the largest single source of error the app deliberately cannot see: ±15–20 % on an
e1RM (`docs/strength-estimate-plan.md` §1).

⚠️ **AND IT WAS CITED AS "(D9)" IN ELEVEN PLACES, WHICH IS A DIFFERENT DECISION.** D9 is progressive
disclosure. Nobody noticed because the sentence around the citation was always correct — the number
was doing no work, so nothing depended on it being right, which is exactly how a wrong reference
survives for weeks. **Anything that says "no RIR field (D9)" means D28.** The citations in
`docs/spec.md` genuinely are about disclosure and are correct.

**D24 and D25 are proposals too, in `docs/social-plan.md`**, and are not in the table for the same
reason — nothing is built, so nothing is decided. D24: *sharing publishes a derived copy and never
widens a permission on the source*, which is forced by the storage shape (one document holds every
row of a collection, and Firestore grants per document, so "let a friend see some of my workouts"
has no permission that expresses it). D25: *social requires upgrading off an anonymous account*,
which narrows D12 rather than breaching it. Both get locked if and when Phase 1 is built.

🚨 **D29 IS RECORDED ON 2026-09-03, AND IT REPLACES A DESIGN RATHER THAN NARROWING ONE:** *visibility
is a property of the ACCOUNT, not of a relationship — private (accepted friends see everything) or
public (anybody signed in who finds you sees everything too), with body weight the single exception
that never leaves the friends document.* Tim's instruction, and he was asked directly whether the
four per-person tiers should go with it: yes.

- ⚠️ **IT DOES NOT TOUCH D24.** Sharing still publishes a derived copy and still never widens a
  permission on the source; what changed is how many copies there are and who may read each. The
  private collections are exactly as private as they were, and `tests/rules.test.mjs` asserts it from
  both directions — a friend and a public reader.
- ⚠️ **WHAT IT COSTS, STATED**: there is no way to keep one person at arm's length any more. The
  answer to "I do not want them seeing that" is to disconnect, or to not accept. Tim was given that
  trade in the question and took it.
- 🚨 **AND WHAT IT DELIBERATELY DID NOT WIDEN: writing.** Kudos, comments and handoffs are
  friends-only. Reading is a grant; writing into somebody's subtree is a moderation surface.

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
**volume, frequency & the dose response** · competitive landscape · data-viz colour · unverified
claims · strength standards & percentiles · **progression & load increments**.

**§6 was rewritten from 🟡 to 🟢 on 2026-08-18** and is now the most load-bearing section in the file
— the "% optimal" rating is built on it. The four findings a fresh session should know without
reading it:

- **Frequency has no consistently identifiable independent effect on hypertrophy** (CrI contains
  zero), but it does matter for strength. So more training days is not itself better for growth.
- **Volume follows a square-root curve** with published efficiency tiers: 4 sets/muscle/week is the
  minimum effective dose, 5–10 is the best value per set, 43+ is off the end of the evidence.
- **An indirect set counts as 0.5** — the best-supported counting method, and the answer D3 was
  waiting for.
- **The models explain about a quarter of the variance**, which is why every rating is banded.

Added 2026-08-18: **§6.9 protein** (plateau at 0.73 g/lb; "1 g/lb" is the top of the CI),
**§6.10 sleep** (one night's deprivation cuts muscle protein synthesis 18 %, but no dose–response
from habitual hours exists), **§6.11 individual variability** (0–250 % spread over 12 weeks, yet
non-responders are rare and individual response is reproducible) and **§12 progression** (the ACSM
2-for-2 rule; a 5 lb jump only enters the recommended 2–10 % band at 50 lb and above).

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
- ~~Weekly volume per muscle group vs target bands (D3) — **blocked on the weighted muscle mapping**~~
  ✅ **BUILT 2026-09-01 as Data → Volume**, and **without** the target bands: the published tiers say
  what another set BUYS, and drawing them as targets would have the app tell somebody they train too
  little or too much, which is Rule 6. It was never unblocked either — `volume-map.js` carries its
  own direct/indirect table rather than waiting for `exercises.js` to be reshaped. §10 item 8.
- Block summary + block-over-block comparison
- Stall detection (e1RM flat 3+ weeks → flag and explain)

**Tier 3 — teach and guide**
- A small set of well-explained starter programs, not thousands
- Just-in-time concept explanations wired to first use (D8)
- Post-session check-in feeding next week's volume
- Deload prompting; equipment-aware substitution

**Beyond the roadmap — `docs/vision.md`.** Tim's running list, and **all six ideas are started and
five are finished**. BUILT: **social** (§1.1), **ready-made systems and the "% optimal" rating**
(§1.3), the **"Compared to:" setting** (§1.4), **set types** (§1.5) and **goals** (§1.6, built
2026-08-19). HALF BUILT: **smart systems** (§1.2) — Home suggests *which workout*; the weights and
reps wait on the estimator, which is also the one hole left in §1.6.

**Three of the six collided with a locked decision, and every one was resolved rather than ignored:**
an "all people" comparison narrowed **D15** into **D21**; social was expected to collide with **D7**
and side-stepped it entirely by building a profile instead of a feed, so D7 stands untouched; and a
protein recommendation narrowed **D1** into **D26**. Note the pattern, because it has now happened
three times: **the objection turns out to be about a specific model rather than about the idea**, and
re-examining it produces something better than either the old rule or a plain override.
`docs/vision.md` records collisions; it does not quietly resolve them.

---

## 9. Known gaps — deliberate, not bugs

- ~~**Body weight is charted but not yet wired into rep normalisation.**~~ **CLOSED 2026-08-19.**
  Pull-ups, chin-ups, dips and push-ups now rank. What remains open is narrower and is stated on
  screen rather than hidden:
  - ~~**Measured, but the app lacks the parameter.**~~ 🚨 **THIS BULLET WAS WRONG IN ITS DIAGNOSIS
    AND IT WAS ACTED ON — CORRECTED 2026-09-06.** It said an inverted row is 37–79 % of body weight
    *depending on bar height*, an incline push-up 41 % vs 55 % *depending on hand height*, and that
    **"adding the parameter is the fix, not adding a number."** That sentence sent a session off to
    build a hand-height field. **It is the fix for neither exercise.** `docs/research.md` §15 is the
    full pull; the short version:
    - **The incline push-up's two figures ARE named, pickable positions** — Ebben 2011, hands on a
      12-inch box (0.55) and a 24-inch box (0.41). So the parameter was never the obstacle. 🚨 **The
      obstacle is that they are the WRONG MEASURED QUANTITY**: the same table gives a regular push-up
      as **0.64**, which is the exact figure `js/exercises.js` already rejects, because Ebben measures
      peak *dynamic* ground-reaction force and this app's 0.75 is Suprak/Mier's *static down
      position*. Shipping them would score one movement as 0.75 / 0.55 / 0.41, where part of the
      first step is **the definition changing rather than the exercise**. `exercises.js` already makes
      this argument for the decline push-up; it binds the incline too.
    - **The inverted row's parameter is BODY ANGLE, not bar height** — Melrose & Dawes (2015), four
      anchors at 30/45/60/75°. Nobody has ever measured one at a bar height. It is also unusable
      (nobody can self-report their angle from underneath a bar, and 45° vs 60° is fifteen points),
      and ⚠️ **the journal is SciTechnol/OMICS — predatory, unindexed, no PMID.** The 37–79 % in this
      handbook traced back to it.
    - **Bench dip: nothing published at any position**, now recorded as checked rather than assumed.
    🛑 **Do not build a hand-height or bar-height field.** What would change the answer is one
    afternoon of force-plate work in an indexed journal, and that is written down in §15.
    ⚠️ **One real lead came out of it and is NOT built**: Suprak 2011 measured a **knee push-up on
    the same plate, the same 28 subjects and the same static down position — 61.80 %.** Right
    quantity, source already cited, no mixing and no new parameter. It needs a new library exercise
    rather than a one-line entry, and nobody has asked for it. `docs/research.md` §15.7.
  - **No published figure exists at all** for diamond and wide-grip push-ups, bench dips, handstand
    and pike push-ups, ring dips or muscle-ups. ⚠️ **The "handstand push-up ≈ 90–100 % of body
    weight" figure circulating online is misattributed** to a paper that studied push-ups. Do not
    use anything from that lineage.
  - ~~**Assisted machines.**~~ **ADMITTED 2026-08-24 on Tim's instruction**, and it is the one entry
    in the fraction table resting on an assumption rather than a source. The fraction is fine — a
    pull-up's 1.00 — and the objection was never about it: the counterweight linkage is not
    standardised and nothing published maps a stack setting to the load it removes. That is still
    true. ⚠️ **What changed is the cost of refusing.** Tim did 70 lb assisted pull-ups in a gym and
    his back rated nothing, which is the same grey-map complaint that admitted the pull-up in the
    first place. Priced at `q` 0.65 — the lowest in the table, below the push-up — rather than
    disclaimed. **And the error is not constant**: it scales with how much help is taken, so the
    number is most trustworthy where it matters least. A single `q` cannot express that.
  - **All lower-body and trunk bodyweight work**, for a different reason: their key lifts log
    *external* load carried by a body that is already there, so a bodyweight squat converts to an
    empty bar. Fixing that needs the key lift's own body-weight component modelled first.
  - ⚠️ **A stale weigh-in gets no penalty.** Somebody who logs pull-ups for two years after one
    weigh-in is scored at that old weight with full confidence. Carrying a weigh-in *backward* is
    priced at 0.70; carrying it forward is not priced at all, and that is the same class of problem
    this task set out to fix, arriving from the other side.
- ~~**The Muscles figure's look is not signed off.**~~ **Closed 2026-08-16.** All four gaps — heavy
  keylines, dense striations, unpainted head/hands/feet/knees, heroic proportions — came in with
  Tim's illustration and are satisfied by construction rather than by drawing code: the ink layer
  *is* the keylines and striations, and unpainted parts are simply parts with no fill. Nothing about
  the figure's look is authored in this repo any more, so there is no styling knob to keep in sync.

- ~~**Muscles uses benchmarks only.**~~ **Closed 2026-08-16** — it now ranks from workout sets too,
  best estimate wins, and the panel names the source. Not a breach of D14: that rule is about
  charting a TREND (two sources on one line, one point per day discarding the loser); a single best
  estimate has neither problem.
- ~~**A muscle is rated by exactly ONE key lift.**~~ **Closed 2026-08-17.** Tim trained every muscle
  for a week and the map recorded a single number, because he had done hammer curls rather than
  barbell curls, dumbbell rows rather than barbell rows, seated calf raises rather than standing.
  Every exercise that trains a muscle now rates it, converted to that muscle's standard by a ratio in
  `js/muscle-evidence.js`. **11 exercises could move the map; 164 of the 209 weighted ones can now.**
- 🚨 **THE CONVERSION RATIOS NOW HAVE A MUCH BIGGER BLAST RADIUS THAN THIS ENTRY WAS WRITTEN FOR —
  2026-09-02.** Until then a shaky ratio only **desaturated a colour** on the body map. Since
  `js/exercise-estimate.js` shipped, the same ratios run **backwards** to print a figure in POUNDS
  for a lift the reader has never performed — on the benchmark screen, and on both sides of a
  comparison with a friend. A machine ratio at quality 0.35 can now be the sole input to a number
  somebody reads as *"what I could lift"*. What holds the line: the module refuses a fallback
  contribution AND a fallback rating, so the chain stays at two multiplications; every figure carries
  a confidence band and names the exercises it came from; and it produces a band NAME rather than a
  ± figure, because no constant for "error added by a ratio of quality q" has ever been fitted here.
  **Nothing about the ratios got worse. What they are used for got louder.**

- 🆕 **A DELIBERATE ACCURACY TRADE, MADE 2026-09-02: the rep prediction follows the app's own curve
  and not the better-graded one.** `repsForWeight()` inverts Marzagão (`docs/research.md` §1.3, 🟡)
  and says ~7 reps at 80 % of a bench max; §2's Nuzzo table (🟢, 952 tests over 7,289 people) says
  ~9. **Marzagão was chosen for internal consistency, not accuracy** — every e1RM in this app comes
  from that curve, so predicting reps from a different one would mean a lifter who performed the
  predicted reps produced an e1RM contradicting the estimate that suggested them. An app disagreeing
  with itself is worse than an app agreeing with the smaller of two literatures. ⚠️ **If §11.2's
  backtest ever runs and disagrees, this is the first thing to revisit.**

- **The conversion ratios are estimates, and some are shaky.** This is the price of the change above
  and it is not hidden: a confidence is computed per muscle and the colour desaturates with it.
  Dumbbell swaps of barbell lifts are solid; **machines are the weak case**, because gearing varies
  by brand and two "machine shoulder press" numbers may not describe the same resistance at all.
  Machine conversions carry a quality of 0.35–0.45 for exactly that reason.
- ~~**A muscle was rated by its most FLATTERING evidence rather than its most credible.**~~
  **FIXED 2026-08-19**, and it was the worst defect in the ranking model. `rateMuscle()` picked its
  top three observations by **estimate**, so the single biggest converted number set the rating no
  matter how little it was worth believing — while `evidenceWeight`, the number this module exists to
  compute, was used only to average the winners afterwards. Measured on a year of ordinary training:
  a 50 lb face pull for 15 reps (quality 0.25, weight **0.06**) beat an overhead press **benchmark**
  (quality 1.00, three reps, weight **~1.00**) and rated the lifter **Elite, 99th percentile** on
  shoulders, beside a Proficient chest. A sixteen-fold credibility inversion.

  ⚠️ **It was not a shoulders quirk — eight of eleven muscles had it**, and in every case the top
  three slots were filled by *the same exercise on three different days*. So the file's own claim
  that "averaging across DIFFERENT exercises cancels out error in any one ratio" had never once been
  true, and the `agreement` term — which exists to ask whether independent readings corroborate each
  other — was comparing an exercise against itself, finding perfect agreement, and pushing confidence
  UP precisely where there was no second opinion at all.

  Three changes, all of them restoring stated intent rather than inventing policy: **one seat per
  exercise** in the top three, **ranked by credibility rather than by size** (ties broken on the
  bigger estimate, so the upper-estimator character survives *within* a level of credibility), and
  **depth measured over all admissible evidence** rather than over the three that won. The results on
  the same year: Shoulders **Elite 99 % → Proficient 71 %** and now led by the actual overhead press;
  Hamstrings led by the Romanian deadlift instead of a leg curl; Calves by the calf raise they
  currently train instead of one dropped six months ago; every muscle inside a coherent 54–76 % band.
  **Mutation-checked** — reverting the sort flips exactly the five new assertions and nothing else.

- **The three residuals now have MEASURED answers** (`docs/strength-estimate-plan.md` §15), and only
  one of them shipped. This is the honest state:
  - ~~A low-credibility conversion still **nudges** the number.~~ **FIXED 2026-08-19.**
    `rateMuscle()` now winsorises into `[median/1.25, median×1.25]` before the weighted mean. The
    face pull's nudge goes **+3.9 % → +1.0 %**; across 200 simulated muscles against known truth
    **worst-case error halves, 19.8 % → 7.5 %**, and it improved RMSE *with no outlier present*,
    which is what makes it free rather than a trade. k is pinned from both sides — below ~0.21 it
    clips days a lifter genuinely had. ⚠️ **Two levels moved on the demo year** (Hamstrings and
    Triceps, each one band); both are boundary straddles at 64.9 vs 65.0 and 49.8 vs 50.0, and
    every clipped observation was high-rep isolation work converting to an implausible number.
  - **High-rep extrapolation is NOT fixed, and now has a reason rather than a plan.** Shrinkage
    **cannot be honestly fitted**: the extra spread at 15 reps comes out 0.01 / 0.07 / 0.12
    depending entirely on a per-lifter rep-curve variance nobody has measured. So the 180×12 seated
    calf raise still converts to 417 lb — but it now carries a **±21.3 % band spanning three
    levels**, and `displayLevel()` returns `certain: false`, so the UI is not permitted to say
    Elite. **Carrying the uncertainty is the answer; a guessed constant is not.**
  - **A typo and a PR are separable above ~25 %, and not below 15 %.** A plausibility ceiling
    quarantines (never deletes) an observation above what training could have delivered. At a
    0.09 % false-positive rate: ×10 caught 100 %, +40 % 99 %, +25 % 77 %, +15 % 19 %. One ×10 fat
    finger otherwise biases a year's reading by **343 %**, because every real set is then measured
    against the typo. ⚠️ **The winsoriser does not fix this** — a ×10 typo arrives with high
    credibility. Two different failures, two mechanisms.
  - ⚠️ **None of this is validated against a human.** The simulator's e1RM is correct *by
    construction*, and `docs/research.md` §1.3 says its absolute accuracy was never validated.
    "Within 4.6 %" is a statement about the model, not about a person. §11.2's backtest against
    held-out benchmarks is the only thing that changes that.
- ~~**Core, Neck and Cardio can never be ranked**~~ ⚠️ **STALE SINCE 2026-09-04 AND CORRECTED
  2026-09-06.** **Core RANKS** — key lift Cable Crunch, its own log-spread and its own reliability
  penalty — and a muscle that is trained but unrankable is **hatched** with its own legend entry
  rather than wearing the grey that means "no data". `UNRANKABLE` is down to **Neck, Cardio and
  Activity**, and only Neck is a muscle. The panel says what HAS been logged.
- **Percentile placement leans on the e1RM formula being *absolutely* accurate**, which
  `docs/research.md` §1.3 says was never validated — it was optimised for *internal consistency*.
  Harmless for rep normalisation, a stronger claim here. Mitigated by flagging levels derived from
  high-rep sets, and since 2026-08-16 by refusing sets above 15 reps as evidence at all
  (`MAX_EVIDENCE_REPS`, D5).
- **A cancelled Google sign-in must never be silent.** `auth/popup-closed-by-user` is raised both
  when a person closes the window AND when the SDK loses its handle on it (Cross-Origin-Opener-
  Policy), so it is not reliably a decision. Treating it as "do nothing" made the button look dead
  and left no route through — a regression shipped and reported within the hour. It now says what
  happened and reveals **Continue in this window instead**, a redirect-only path no popup blocker can
  touch. Related trap: `run()` in views-account.js hands the button back only when its function
  THROWS, on the assumption success navigates away — any new outcome that stays on the screen has to
  re-enable the button itself.
- **A Google popup is only ever opened ONCE.** Recovering from "that account already exists" used to
  open a second one, which the browser blocked because the gesture authorising the first was spent —
  reported by Tim as "your browser blocked the sign-in window" (2026-08-16). The recovery now reuses
  the credential from the failed link via `signInWithCredential`, which needs no window. Anything
  added to this flow must not open a window outside the original click.
- ~~**Google sign-in inside the installed PWA is the riskiest untested path.**~~ ✅ **TESTED
  2026-08-22, and it works** — it was the riskiest path and it is now the only one a device has
  confirmed. ⚠️ **The premise written here was false**: *"popups are blocked in an iOS home-screen
  app"* is what sent the PWA to `signInWithRedirect`, and redirect is the thing that actually cannot
  complete while the auth domain differs from the origin. A popup in an installed iOS app works.
  Kept rather than deleted because the wrong premise is why the code did the wrong thing for months.
  The custom-domain fallback is still the answer **if the redirect flow is ever needed again**.
- **Rep normalisation assumes near-failure effort.** Every rep-based formula does. Bias is systematic
  per user per exercise, so trend and ordering survive. There is no RIR/RPE field — deliberate (D9).
- ~~**No supersets, drop sets or tri-sets.**~~ **Closed 2026-08-17** — built, and D23 records the
  two-shapes model. **Myo-reps followed the same day** and cost almost nothing, exactly as the
  prediction said: same nesting shape, one label, one rest hint, one default count. **Dr. Mike's
  Floating Split now ships with its real structure** — 11 of its exercises are myo-reps — and its
  warning no longer has to say the structure was stripped out. **Chris Bumstead shipped the same
  day**, and he is the system this was built for: eight drop sets, a tri-set and a superset, none of
  which could have been expressed before. **Still missing: RIR and tempo**, both deliberate (D9).
- **⚠️ The stored key for mini-sets is `minis`, and `drops` is a legacy alias.** It shipped as
  `drops` during the few hours when drop sets were the only nesting type. Keeping that name would
  have meant every myo-rep set on disk claiming to be a list of drops — visible to anyone who
  exported a backup, and false. `minisOf()` reads both; nothing writes `drops` any more, and both
  save paths `delete` it.
- ~~**Weight display is hard-coded to lbs.**~~ **Closed 2026-08-16.** lbs/kg in Settings, stored
  canonically in pounds. Distance is still miles only.
- **The Nippard system is a TRANSCRIPTION, and the screen says so.** It comes from published
  write-ups of the FREE YouTube series (Fitness Volt, BarBend, MuscleChemistry), **not** from his
  paid 12-week ebook and not from him. Nobody involved watched the videos, so the sets and reps are
  as reported. `unofficial: true` is what puts the warning on screen, and a test asserts that
  anything credited to a real person carries a source URL, the flag, and a note saying it is not
  their own writing. **Do not add the paid ebook's contents** — pirated copies of it sit on studylib
  and scribd and rank on the first page of every search for these workouts.

  ~~Only one Push, one Pull and one Legs are here.~~ **Closed 2026-08-19 — all six, in episode
  order.** Two things came out of finishing it, and the second is the one worth remembering:

  - **⚠️ SOURCING IS NOT EVEN ACROSS THE SIX, and the system's notes say so on screen.** Push 2,
    Pull 2 and Legs 2 each have two independent write-ups that agree; Push 1, Pull 1 and Legs 1 rest
    on one apiece. One disagreement is recorded rather than smoothed over — Fitness Volt gives Legs 2
    four sets of *seated* calf raises, BarBend two seated and two standing. The totals match at four,
    so the more detailed source was followed, which is the same call Bumstead's tri-set got.
  - **⚠️ The workout shipped as "Pull" was the SECOND pull.** Its write-up says only "the most
    recent issue" and carries no episode number, so it read as the first. The order had to be
    recovered from the video dates — Jan, 13 Feb, 24 Feb, 3 Jun, 10 Jul, 7 Aug 2023. No test could
    have caught that; only reading the dates could.

  One modelling compromise, stated in the workout's own note rather than hidden: Pull 1's lat
  pulldown is written up as two sets to failure plus **one** drop, and `minis` plans a drop after
  every set — so the app plans one more than he does, and the note says to skip it.
  Sources: [push 1](https://fitnessvolt.com/jeff-nippard-push-workout/) ·
  [pull 1](https://fitnessvolt.com/jeff-nippard-back-and-biceps-workout/) ·
  [legs 1](https://fitnessvolt.com/jeff-nippard-leg-day-workout/) ·
  [push 2](https://fitnessvolt.com/jeff-nippard-science-based-push-day-workout/) and
  [its second source](https://barbend.com/news/7-exercises-jeff-nippard-chest-shoulders-triceps/) ·
  [pull 2](https://barbend.com/news/jeff-nippard-science-supported-back-and-biceps-workout/) and
  [its second source](https://fitnessvolt.com/jeff-nippard-back-and-biceps-workout-backed-by-science/) ·
  [legs 2](https://fitnessvolt.com/jeff-nippard-science-based-leg-workout/) and
  [its second source](https://www.musclechemistry.com/the-6-exercises-in-jeff-nippards-scientifically-perfect-lower-body-workout/)
- **Every creator system has a DIFFERENT limitation, and each states its own.** The default warning
  ("transcribed from the free videos") is true of Nippard and false of the rest, so `warning`
  overrides it per system and a test fails if anything that is not a video transcription falls
  through to the default. **Arnold's Golden Six**: sixty years of republication and the versions
  disagree — some swap the behind-the-neck press for an upright row, sit-up reps run from 20 to
  AMRAP — and nobody here has a primary source, which may not exist. **Thurston**: he rebuilds his
  own programme every four to six weeks, so a transcription is one block frozen rather than a
  programme he stands behind. **Volume Landmarks Hypertrophy**: the workouts are the app's own, said
  twice on screen.
- **Chris Bumstead's is an EIGHT-DAY cycle, not a week, and the warning leads with it** — three on,
  one off, twice through, so it drifts across the calendar on purpose and `daysPerWeek: 6` is an
  approximation the screen explains. Second thing it says: this is a four-time Mr. Olympia's volume
  and exercise selection, built for somebody whose job is recovering from it. Two source
  disagreements are recorded in the file: whether day one ends in a tri-set (Set For Set says yes,
  Generation Iron lists the three plainly — followed Set For Set, because a claim that something is
  grouped is harder to invent than to omit), and how much of **arm day** is tri-sets (shorter
  summaries say most of it; both detailed write-ups show straight exercises with drop sets — followed
  the detailed ones, and it is the part most likely to be wrong).
- **Dr. Mike's Floating Split is the most DISTORTED transcription in the file, and that is the first
  thing its warning says.** Nearly every set in it is a myo-rep or a giant set; the app records
  straight sets only, so what ships is his exercise choice with the set structure removed — "4
  myo-rep match sets" becomes 4 sets. Two further caveats on screen: it is a **cutting** split
  (training to hold muscle while dieting to 6 % body fat, not to add it), and several set counts were
  never reported by either source. Specialty equipment — transformer bar, cambered bar, CC squat
  machine — is mapped to the nearest thing in the library and noted per exercise. Sourcing is the
  *strongest* of any creator system here, though: RP's own site plus an independent write-up that
  agrees exercise for exercise. **This is the system that most wants `docs/vision.md` §1.5.**
- **Beware which Nippard workout you are reading.** He has published several similarly named push
  workouts. A Generation Iron write-up of an older PPL gives a completely different push day
  (dips, Egyptian lateral raises, cable kickbacks) from the 2023 series. Cross-check the date and the
  series before trusting any write-up.
- **Exercise→muscle is a single string**, not the primary/secondary weighted mapping. ~~**This must
  change before D3**~~ ⚠️ **D3 SHIPPED AROUND IT on 2026-09-01, and that is worth knowing before
  somebody takes this on as a blocker.** `js/volume-map.js` carries its own direct-1.0 / indirect-0.5
  table rather than waiting for `exercises.js` to be reshaped — which is exactly why the upkeep table
  has to warn that it is **not the same table** as `muscle-evidence.js`'s. The single string is still
  a limitation of `exercises.js` and still means two tables where one would do; it is no longer
  stopping anything. *(The same sentence is quoted at `docs/optimal-rating-plan.md` §…, which has not
  been corrected.)* And since 2026-08-18 there is a published answer for *what* to change it to.
  The best-supported counting method in the literature is **binary: direct 1.0, indirect 0.5**
  (Pelland et al. 2025, `docs/research.md` §6.4), which is *simpler* than the continuous weighting
  this line assumed for months. The 0.5 the project had already guessed "without asking" turns out to
  match it. Still work — every exercise needs the flag per muscle — but no longer a design question.

---

## 10. Next steps

*The short version is the **Open work** list in `progress.md`. This section is the long one.*

0. **GOALS — BUILT 2026-08-19**, Phases 1 and 2 of `docs/goals-plan.md`. Pick a three-month strength
   goal, see what it costs, see what your logged training is actually doing against it, read why
   progress stalls, and find a programme that fits. **Two things are left.** The **verdict**
   (Phase 3) waits on the estimator — the screen states that outright rather than leaving a gap that
   reads as a broken feature. **Progression** (Phase 4) waits on nothing but is deliberately last,
   because it is the only part of this app that can hurt somebody; §8 of the plan already has the
   whole rule. **Read §11 of that plan before touching Goals** — it records three things the build
   decided that the plan did not: the target weight is **frozen** when a goal is set, the ambition
   bands are anchored on the dose-response's own predicted effect sizes, and **effort does NOT scale
   with ambition**, which departs from §10.4 because these are strength goals and strength is
   largely indifferent to reps in reserve.

1. **The simulator** — `docs/strength-estimate-plan.md` §11. ⚠️ **Phase 0 is DONE** (its numbers are
   in §15 of that plan, and `tools/strength-fit.mjs` re-derives every constant rather than trusting
   it); **Phases 1–3 are what is left**, and **§6.1** sets their hard design constraint — ⚠️ **this
   said §16 until 2026-09-02 and §16 is a different section**, so anyone following the pointer landed
   on a list of caveats and had to scan the whole plan for the finding.
   🆕 **AND TWO PIECES OF IT MOVED ON 2026-09-02 WITHOUT TOUCHING THE PLAN'S PHASES.**
   `buildObservations()` is out of `store.js` and into `js/strength-observations.js` — `today` passed
   in, pinned by a golden table over the demo year — so a FRIEND's published training goes through
   the same walk as yours; and `muscleRatings()` is that same rating **without the profile gate**,
   which is what lets an account with no weigh-in have an estimate at all. Open work item 8 carries
   both. The rest of this item is the reasoning that got there, kept because it is the lesson.
   The demo account handed it a concrete target on 2026-08-19, and
   **half of it turned out not to need the simulator at all**: `rateMuscle()` was selecting evidence
   by size rather than by credibility, which is a design fault and was fixed the same day (§9). What
   is left IS the simulator's: how far a high-rep isolation set may honestly be extrapolated, and
   whether the aggregate should be robust to an outlier rather than a plain weighted mean. §9 lists
   the three residuals. **Worth taking as a lesson before the next one** — the project's standing
   position was that none of this could be touched without the simulator, and a third of it was a
   sort order. `js/muscle-evidence.js` shipped a real confidence model whose
   constants were reasoned rather than fitted, and §9 lists two accuracy gaps that cannot honestly be
   closed by guessing at numbers. A simulator turns both into measurements.
2. ~~**Tim opens the app on a real phone.**~~ ⚠️ **REOPENED 2026-08-21 and PARTLY CLOSED 2026-08-22
   — he opened it.** Five passes ran on the 21st and everything measurable is done; on the 22nd a
   real iPhone confirmed **the keyboard fix** and **Google sign-in in the installed PWA**.
   **This item was worth every word of its warning:** the same device produced the project's only
   real-device *bug* report (Google sign-in) and its only real-device *refutation* (a popup is not
   blocked in an installed iOS app) — both the class of thing no amount of desktop-engine work could
   have found, in both directions. What is left needs the same phone and is small: three
   reasoned-not-measured items, whether the picker's focus raises the keyboard unprompted, touch
   targets, and a **Safari tab**, which is now the surface with less evidence behind it than the
   installed app.
3. **The graph's default source is not what Tim asked for on 2026-08-16** ("default should be mostly
   workout measurements") and is still the one part of that request unmet. ⚠️ **THIS ITEM DESCRIBED
   THE CODE WRONG until 2026-09-02, and the description was the actionable half.** It said the graph
   "defaults to benchmarks" and that the fix is "one line in `pickSource()`". `pickSource()` in
   `js/views-data.js` actually picks **whichever source has more days**, using benchmarks only as the
   seed and the tie-break — so the stated behaviour is wrong for the common case and the promised
   one-line fix would land on code that does not read the way this said. **Re-read the function
   before quoting either.** Properly, it is Phase 3 of the estimate plan.
4. **The creator library — COMPLETE as far as sources allow.** Nine systems, six credited. The
   ceiling that used to bound it is gone — set types shipped, Bumstead and Israetel's real split
   went in behind them, and **the Nippard series was finished on 2026-08-19**: all six workouts,
   found in published write-ups exactly as Tim's instruction said to look for them, no video
   watched. Nothing here is waiting on content any more. §9 has the rules that apply to creator
   systems, and they are deliberately **not the same rule for each one**: every system states its own
   limitation, and a test fails if a non-video transcription falls through to the default warning.
5. **Wire body weight into rep normalisation** for bodyweight/assisted exercises. It is also what
   would let pull-ups and dips rate a muscle at all — `contributionsFor()` refuses them today.
6. ~~**Social — BUILT, and never used by two real accounts.**~~ 🚨 **THIS ITEM WAS THE MOST
   MISLEADING PARAGRAPH IN THE FILE AND IT IS REWRITTEN — 2026-09-02.** It said three things that had
   each been false for over a week, and it said them two thousand lines away from the Open work table
   that got them right. Kept as a worked example of the failure this file exists to prevent: **a
   section nobody revisits goes stale in place, and a fresh session reads it as current.**

   - ~~"no two accounts have ever actually connected"~~ — **they did, on 2026-08-22**, over the live
     project, in two browser profiles, and the run found two defects. Item 1 of Open work and §3 both
     said so while this said the opposite.
   - ~~"Phase 4 (a chronological feed) remains unstarted"~~ — **Home has been a feed since
     2026-08-25** and a Hevy-shaped one since 2026-09-02 (all eight steps of `docs/social-plan.md`
     §13).
   - ~~"still needs D7 narrowed first"~~ — **the feed shipped without D7 being touched.** What D7
     still refuses is the **discovery** feed of strangers, which is Open work 18 and is a standing
     refusal rather than pending work.

   ✅ **Where it actually stands.** Phases 1–3 shipped 2026-08-18 (~~tiers~~, the projection builder,
   the rules, invite links, a friend's page). The two-account round trip ran 2026-08-22. The
   Hevy-shaped feed, the per-session workout screen, comparison, copy-as-routine and the shareable
   image all shipped 2026-09-02. 🚨 **AND THE TIERS WERE REPLACED ON 2026-09-03 by one account
   setting — private or public, public by default (D29)** — with a friend's map made tappable, their
   volume and graphs added, and a two-body compare screen. **What is unverified is Tim's phone, and a
   live two-account run of everything built since 2026-08-29 — Open work item 1, and it has not moved
   in three sessions.**
7. **The "% optimal" rating — BUILT 2026-08-18**, `docs/optimal-rating-plan.md`. Research, the
   direct/indirect mapping, the scoring model, the badge on Explore **and the rating on the user's
   own systems** all shipped the same day; **days a week and minutes a session joined the badge on
   2026-08-19**, so it now says what a programme costs as well as how good it is. What is left is
   `docs/research.md` §6.8 — the axes still to pull (load, rest, range of motion, per-session
   volume), each of which either enters the model or becomes a stated caveat.
8. ~~**Tier 2 / D3 — the mapping it was blocked on now EXISTS.**~~ ✅ **BUILT 2026-09-01 — Data →
   Volume**, on Tim's pick from three offered. `js/volume-map.js` had computed fractional weekly sets
   per muscle since 2026-08-18; what shipped is `store.weeklyVolumeByMuscle()` over recorded sessions
   and the screen that draws it. ⚠️ **The "vs target bands" half of the old wording was dropped on
   purpose** — the published efficiency tiers describe what another set BUYS, and rendering them as
   targets would have made the app say somebody is training too little or too much, which is Rule 6
   and is not what the source says. See that day's section.

### Open questions for Tim

1. **Ratify D18?** `docs/strength-estimate-plan.md` §7 proposes narrowing D14 so that it governs raw
   per-set plotting only, leaving the strength estimator free to draw on all evidence weighted by
   confidence. D14 is locked, so this needs Tim's say-so before Phase 2 of that plan. The fallback if
   he says no: ship the estimator as a separate, clearly labelled chart mode.
   **Precedent worth citing when asking:** D15 was narrowed the same way on 2026-08-17 (see D21), and
   D1 was narrowed on 2026-08-18 (see D26) — each time the objection turned out to be about a
   specific model rather than about the idea.

2. ~~**⚠️ May the auth handler go in the `timothyhadfield.github.io` user-page repo?**~~ ✅ **MOOT —
   withdrawn 2026-08-22.** It was the only real fix for a redirect flow, and Google sign-in works in
   the installed PWA without one. **Nobody needs to touch that repo.** Keep the analysis (2026-08-21
   third pass) only against the day this app moves domain or needs redirect again.

**One question left, and no outstanding ask.** ⚠️ **The 2026-08-22 device visit closed both** — the
keyboard fix is verified and Google sign-in works. Everything else that was on this list has been
answered:

**Answered, so nobody re-asks:**

- ~~Social: profile-first or a feed?~~ **Profile-first, no feed** — built that way, D7 untouched.
- ~~Social: mutual or followers?~~ **Mutual.**
- ~~The "% optimal" rating: one number or two?~~ **Two** — growth and strength, rated separately.
- ~~What does 100 % mean?~~ **The most the evidence supports**, not the best system in the library.
- ~~May the app recommend protein?~~ **Yes** (D26) — recommend with a citation, never track.
- ~~Is "Next exercise" reachable on your phone with the keyboard up?~~ **YES** (2026-08-22), and the
  picker too. Asked three times; the answer closed the biggest unverified fix in the phone work.
- ~~Does Google sign-in work on the iPhone?~~ **YES, in the installed home-screen app** (2026-08-22).
  A Safari tab has not been retested since the fixes.
- ~~Goals as levels, or as a rate?~~ **LEVELS**, which was the recommendation, taken without asking
  under the working agreement and built on 2026-08-19. A level makes no prediction at all, which is
  the only framing the 0–250 % individual variation leaves standing. A rate could still be added
  beside it later if Tim wants one.

One to raise if the Muscles map gets used in anger: whether to expose **raw e1RM** as a chart mode
alongside normalised equivalent load. Lean is no — normalised load keeps numbers in units the user
recognises.

~~**Small, known, untouched:** the Data screen's mode switch wraps "Bar Chart" onto two lines.~~
**Fixed 2026-08-17.** The cause was the flex default `min-width: auto` letting a `.seg` be squeezed
below its own content and wrap; `white-space: nowrap` plus `min-width: 0` on `.seg`.
