# Fitness Tracker

A lifting tracker built to be better than a spreadsheet: pick or build a programme, log it
one-handed while you're mid-set, and see what your training is actually doing to your strength.

**No build step and no dependencies in the app** — plain ES modules and one stylesheet. Serve the
folder and it runs.

## Use it

Open the [live app](https://timothyhadfield.github.io/Fitness_Tracker/). On iPhone, tap Share →
**Add to Home Screen** for a real app icon and no browser chrome.

It works **fully offline**, and it works **without an account** — sign in only if you want your data
on more than one device.

## What it does

- **Start from a real programme** — nine ready-made ones, six credited to the people who published
  them, each carrying four numbers: how good it is for growth and for strength, and what it costs
  you in days a week and minutes a session. Or build your own.
- **Log while you lift** — every exercise pre-filled with what you did last time, adjusted with
  big +/− buttons sized for one thumb. **318 exercises** built in across 16 muscle groups, plus your
  own when yours isn't listed. Supersets, tri-sets, giant sets, drop sets and myo-reps, with a rest
  timer that knows the difference.
- **Record opens on the next workout in your rotation** — it reads your last session, offers the
  one after it, and says what it read. Every other workout is one tap below it.
- **Home is a feed** — what the people you train with have been doing: their name, when, the
  workout, the line they wrote about how it went, a **Time · Sets** row, and every exercise with
  its set count. **Tap a card to open their whole workout** — the muscle split as a share of that
  session, their bests typed by kind (Weight · Reps · Volume · 1RM), and set tables with the supersets
  and drop sets intact. From there you can **compare a lift against your own**, **save their workout
  as one of yours**, or **share a picture of it**. Kudos and comments, no streaks and no
  leaderboards.
- **Body map** — every muscle rated from *every* exercise that trains it, coloured by where you rank
  among a comparison group **you choose**, and faded in proportion to how much evidence there
  actually is. Tap one for the number, the level, and the set it came from. You get a **ranking**, not
  a percentile, unless you turn on *More details*.
- **Goals** — one muscle, one strength level, twelve weeks. It states what that costs and what your
  logged training is delivering against it.
- **Calendar and graphs** — every workout and benchmark on the day you did it, month by month or as
  **one square per day so whole years fit on a single screen**; trends for anything you've recorded
  twice, from workout sets as well as one-off records.
- **Friends** — mutual only. Find them by name, by your own QR code, or by an invite link.
- **One privacy setting for the whole account: private or public.** Private means only friends you
  accept, and they see everything. Public — **the default** — means anybody signed in who finds you
  sees it too. **Your body weight is the exception and never goes public**; it reaches accepted
  friends only, and only if you switch it on.
- **See a friend the way you see yourself** — their body map, tappable muscle by muscle with the same
  panel yours has, under **any comparison group you pick**; their weekly volume; their graphs. And a
  **Compare** button on any muscle map that puts two bodies side by side, one comparison governing
  both, tapping either opening the same muscle on both.
- **A demo account** — Account → *View demo account* fills every screen with a generated year of
  training so you can judge the app without logging any of it. It never touches storage, and a
  reload starts it over.

## Your data

**Signed out, it never leaves your browser.** Signed in, it syncs to Firestore so you can open it on
another device — see [docs/firebase-setup.md](docs/firebase-setup.md). Either way, **Settings →
Download backup** gives you the whole lot as a file, and deleting your account deletes the data with
it.

Anybody who can see your account reads a **published copy** of your training, never your own data —
so what is shared is decided when it is written, and the rules decide who may read it. Those are two
independent gates and neither is allowed to become the only one.

## Run it locally

It needs a server — ES modules don't load over `file://`.

```bash
python -m http.server 8765
# then open http://127.0.0.1:8765
```

## Tests

```bash
node tests/data-layer.test.mjs     # 1847 assertions, no dependencies

# ⚠️ ALL THE TEST-ONLY DEPS IN ONE COMMAND — `--no-save` REPLACES what is
# already installed, so installing them one at a time makes the previous
# suite fail with MODULE_NOT_FOUND.
npm i --no-save jsdom jsqr @firebase/rules-unit-testing
node tests/render.test.mjs
```

**Seventeen suites run headlessly: 4,004 assertions** (recounted 2026-09-03 by running every one).
Nothing installed here ships with the app.

- **Three suites need an npm package, not one:** `render` needs `jsdom`, `qr` needs `jsqr`, `rules`
  needs `@firebase/rules-unit-testing`. The other fourteen need nothing.
- **One more suite exists and is not in that 4,004**, because it does not run on `node` alone:
  `tests/rules.test.mjs` (**159 assertions** — the Firestore security rules, run under
  `firebase emulators:exec`, and the only tests here that run as somebody who is *not* you).
  `tests/sw-update.test.mjs` (12) IS in the count but needs real Chrome to mean anything.

`docs/handbook.md` §4 lists every suite and what each one is actually for; `progress.md` carries what
is **not** verified.

## Project layout

```
index.html              entry point
css/app.css             all styling — mobile-first, desktop in one media query
js/app.js               hash router
js/store.js             data layer (backend-agnostic async API)
js/firebase-backend.js  Firestore + auth adapter
js/exercises.js         the exercise library
js/preset-systems.js    the nine ready-made programmes
js/social.js            friends, private/public, and the published projection
js/shared-map.js        somebody else's muscle map, in the shape our panel renders
js/ui.js                DOM builder, icons, sheets, steppers, formatters
js/views-*.js           screens
js/body-*.js            the body illustration and its muscle map
tests/                  eighteen suites (17 headless + rules) — see Tests above; `node tests/<name>.test.mjs`
tools/                  offline generators and audits, run by hand, never shipped
                        (the body art, the volume colour ramp, the strength fit,
                        the accessibility audit) — read a tool's header before
                        changing anything it generates
docs/                   spec, vision, research, plans, Firebase setup — and the
                        three files below
firestore.rules         who may read whose data — tested by tests/rules.test.mjs

progress.md             project state and the open-work list — the catch-up file
docs/handbook.md        §0–§10: environment traps, working agreement, architecture,
                        design rules, locked decisions. Every "§N" in this project
                        means this file
docs/history.md         the dated session log, newest first — searched, not read
chat.md                 the human-readable log (2026-08-21 onward)
docs/chat-archive.md    the same log, 2026-08-14 to 2026-08-20
```

⚠️ **The four documents split on 2026-09-04**, when `progress.md` reached 626 KB and could no longer
be opened in one read. Nothing was rewritten — the dated log moved to `docs/history.md` and the
numbered sections to `docs/handbook.md`, byte for byte. **A session's full write-up now goes to the
top of `history.md` and only its one-line summary to `progress.md`**, which is what keeps that file
readable.

`store.js` exposes an async API, so switching backends touches no screen code.
