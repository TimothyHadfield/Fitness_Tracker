# Fitness Tracker

A lifting tracker built to be better than a spreadsheet: build your own workouts, log them
one-handed while you're mid-set, and watch the numbers move over time.

**No dependencies, no build step, no accounts.** Plain ES modules and one stylesheet. Your data
stays in your browser and you can export it whenever you want.

## Use it

Open the [live app](https://timothyhadfield.github.io/Fitness_Tracker/). On iPhone, tap Share →
**Add to Home Screen** for a real app icon and no browser chrome.

## What it does

- **Build workouts** — name them whatever you call them (Push, Legs, Upper), fill them with any
  exercises you like, reorder freely
- **265 exercises** built in, searchable and filterable by muscle group — plus custom exercises
  when yours isn't listed
- **Log while you lift** — each exercise comes pre-filled with what you did last time, adjusted
  with big +/− buttons sized for one thumb. Reps ±1, weight ±5 lbs, time ±10 sec.
- **Benchmarks** — one-off records for any date, past or present
- **Calendar** — every workout and benchmark lands on the day you did it; tap any day for the full
  breakdown
- **Graphs** — pick any exercise you've recorded twice and see the trend, with the change from
  first record to latest in both absolute and percentage terms

## Run it locally

It needs a server — ES modules don't load over `file://`.

```bash
python -m http.server 8765
# then open http://127.0.0.1:8765
```

## Project layout

```
index.html              entry point
css/app.css             all styling — mobile-first, desktop in one media query
js/app.js               hash router
js/store.js             data layer (backend-agnostic async API)
js/exercises.js         the exercise library
js/ui.js                DOM builder, icons, sheets, steppers, formatters
js/views-*.js           screens
docs/                   product spec, competitive research, Firebase setup
progress.md             project state and decisions
```

## Storage

Currently browser local storage. A Firestore adapter is written and waiting in
`js/firebase-backend.js` — see [docs/firebase-setup.md](docs/firebase-setup.md). Because
`store.js` exposes an async API, switching backends touches no screen code.
