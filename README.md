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
  big +/− buttons sized for one thumb. **272 exercises** built in across 15 muscle groups, plus your
  own when yours isn't listed. Supersets, tri-sets, giant sets, drop sets and myo-reps, with a rest
  timer that knows the difference.
- **Home opens on the next workout in your rotation** — it reads your last session, offers the one
  after it, and says what it read.
- **Body map** — every muscle rated from *every* exercise that trains it, coloured by where you rank
  among a comparison group **you choose**, and faded in proportion to how much evidence there
  actually is. Tap one for the number, the level, and the set it came from.
- **Goals** — one muscle, one strength level, twelve weeks. It states what that costs and what your
  logged training is delivering against it.
- **Calendar and graphs** — every workout and benchmark on the day you did it, month by month or as
  **one square per day so whole years fit on a single screen**; trends for anything you've recorded
  twice, from workout sets as well as one-off records.
- **Friends** — mutual only, invite by link, and **you choose per person** how much they see:
  everything, just your workouts, just that you trained, or nothing.
- **A demo account** — Account → *View demo account* fills every screen with a generated year of
  training so you can judge the app without logging any of it. It never touches storage, and a
  reload starts it over.

## Your data

**Signed out, it never leaves your browser.** Signed in, it syncs to Firestore so you can open it on
another device — see [docs/firebase-setup.md](docs/firebase-setup.md). Either way, **Settings →
Download backup** gives you the whole lot as a file, and deleting your account deletes the data with
it.

Friends only ever see what you chose to share with that person.

## Run it locally

It needs a server — ES modules don't load over `file://`.

```bash
python -m http.server 8765
# then open http://127.0.0.1:8765
```

## Tests

```bash
node tests/data-layer.test.mjs     # 1193 assertions, no dependencies
npm i jsdom && node tests/render.test.mjs
```

Eleven suites, 2474 assertions. Only `render` needs anything installed. `progress.md` lists the rest,
including what each one is actually for — and, more usefully, what is **not** verified.

## Project layout

```
index.html              entry point
css/app.css             all styling — mobile-first, desktop in one media query
js/app.js               hash router
js/store.js             data layer (backend-agnostic async API)
js/firebase-backend.js  Firestore + auth adapter
js/exercises.js         the exercise library
js/preset-systems.js    the nine ready-made programmes
js/ui.js                DOM builder, icons, sheets, steppers, formatters
js/views-*.js           screens
js/body-*.js            the body illustration and its muscle map
docs/                   spec, research, plans, Firebase setup
progress.md             project state, decisions, and what is not verified
chat.md                 the human-readable log
```

`store.js` exposes an async API, so switching backends touches no screen code.
