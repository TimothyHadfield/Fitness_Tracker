# Fitness Tracker — notes for Claude

A lifting tracker PWA: pick or build a program, log sets on a phone mid-workout, and see strength,
volume and muscle maps. Free; heading for the App Store one day. Tim directs and never reads code.

- Live: https://timothyhadfield.github.io/Fitness_Tracker/ (GitHub Pages, deploys on push to `main`)
- Cloud: Firebase project `fitness-tracker-th` (Auth + Firestore; rules in `firestore.rules`)
- No build step, no package.json: plain ES modules served as files.

## Read first
1. `progress.md` (START HERE, Standing instructions, Traps, Rejected). It is the source of truth.
2. `docs/direction.md` (Tim's interview; overrules the handbook), then `docs/handbook.md` §0 traps
   and `docs/state.md` (what every screen does). `chat.md` is the session log.

## File map
- `index.html` shell, `sw.js` service worker (network-first navigations, offline shell),
  `manifest.webmanifest`, icons at the root, `css/app.css` all styles.
- `js/app.js` hash router (`render()` on `hashchange`), `js/ui.js` shared UI helpers
  (`el`, sheets, `refreshRoute`), `js/store.js` data layer, `js/firebase-backend.js` cloud I/O,
  `js/views-*.js` one file per area (session runner, workouts, data, goals, social, account...).
- Strength maths: `strength-estimate.js`, `strength-standards.js`, `e1rm.js`, `units.js`.
- `tests/*.test.mjs` (jsdom), `tools/` one-off build and probe scripts, `docs/` plans and history.

## Run and test
- Serve locally: `python -m http.server 8130` in the repo, open `http://localhost:8130/`.
- Demo mode (made-up data, never writes to the cloud): set sessionStorage `ftrack:v1:demo` = `1`
  before load, or Account → View demo account.
- Test deps: `npm i --no-save jsdom jsqr @firebase/rules-unit-testing` (one command; a second
  `npm i --no-save` replaces the first).
- Each suite: `node tests/<name>.test.mjs`, prints PASS/FAIL lines. A suite with 0 PASS and 0 FAIL
  was skipped, not passed. Plain run excludes `rules`, `sync-merge` (Firestore emulator) and
  `sw-update` (needs Chrome, flaky here).
- Doc byte budgets are a test (data-layer): never raise a number; trim instead.

## Standing instructions (from progress.md, Tim's words there)
- **Never touch visuals unprompted.** He points, you execute. No global copy shortening.
- **Accessibility work is deferred**: "Let's not work on the accessibility for a while."
- **`Fitness_Research/` is not yours**: never read, edit or report on it. The untracked
  `Claude Data/` belongs to another agent too.
- Catch-up is read-only. Between jobs say what's done and stop. Replies 2-3 paragraphs max.
- Commit and push finished work without asking.

## Traps
- Headless browser runs MUST use `serviceWorkers: 'block'` and abort gstatic/googleapis/firebase
  hosts, or a screenshot signs in anonymously to the live project. Use demo mode instead.
- Never write to live Firestore data, and never touch real accounts. Don't change
  `firestore.rules` without Tim.
- Stage by name only; never `git add -A`, `stash`, `reset` or `checkout`. Check each commit with
  `git show --name-only --format="" <sha> | grep -c Fitness_Research` (must print 0).
- Never edit .md or JS through a script (encoding and CRLF damage). Use Edit/Write.
- Worktrees: git's system config has `core.autocrlf=true`; a CRLF checkout breaks `shell.test`.
  Create worktrees outside OneDrive with `git -c core.autocrlf=false worktree add ...`.
- Git Bash rewrites a bare `"#/route"` argument into a Windows path; pass `"index.html#/route"`.
- `.btn` beats `[hidden]`: a toggled button needs a `[hidden]` rule.
- Changing a function's output shape: grep every caller, not just its siblings.
