# Onboarding questions, first-run tour, workout photos — plan (2026-09-25)

**Status: BUILT and live 2026-09-25** (rules deployed). Built details and choices Tim hasn't seen:
chat.md 2026-09-25. As built: gate = brand-new CLOUD account on Home only (never demo/offline/local
test harness), flag set on open; tour has 8 stops, rows "Take the tour"/"Find me a program" sit on the
Account screen (Settings screen lives in views-data.js); photos at `users/{uid}/photos/{sessionId}`
{image,w,h,updatedAt} ≤210,000 chars, workout rows carry only `photo:{w,h}`.

## Tim's words
> "I want to work on putting a guided system for users as soon as they log in that's question/multiple
> choice based so that the cite gives them the opportunity to automatically guide them into everything
> and will set the user up with everything they need. For now, this will just be giving them a workout
> they need. Look up some questions that other cites use for inspiration."
>
> "Additionally when a user first joins, the cite will give them a tour (which they can skip), but will
> automatically show them every part of the cite and how to use it. It will be like buttons popping up
> pointing to different parts of the cite and if they click "next" it will automatically bring them to
> the next part of the tour. Make sure the annimations and everythign are clean for the tour."
>
> "I also want you to start deploying the "take a picture" feature we talked about after a workout."

Photos, asked 2026-09-25: **free, no card** (shrunk photo in Firestore, like the profile photo) and
**visible to whoever can see the workout**. This lifts the 2026-09-10 photo pause.

## A. Questions → a program (builder A)
Research (Boostcamp, Hevy, JEFIT, Alpha Progression, MacroFactor, Fitbod): short flows ask 4–6
questions; the six that drive a plan are goal, experience, days/week, session length, equipment,
focus muscles. One question per screen, back button, skip, a short "building" moment at the end.

Six screens, one tap each (the last optional):
1. **Goal** — Build muscle · Get stronger · Both · General fitness
2. **Experience** — New to lifting · Under 1 year · 1–3 years · 3+ years
3. **Days a week** — 2 · 3 · 4 · 5 · 6
4. **Time per workout** — 30 · 45 · 60 · 75+ min
5. **Equipment** — Full gym · Dumbbells only · Barbell + rack at home · Bodyweight only
6. **Focus** (optional, up to 2) — Chest · Back · Shoulders · Arms · Legs · Glutes · Core · None

Result: a program **built from the answers** (split from days: 2 = full body A/B, 3 = full body A/B/C,
4 = upper/lower, 5 = upper/lower + push/pull/legs, 6 = push/pull/legs ×2), exercises only from the app's
exercise list filtered by equipment, sets per exercise scaled by time and experience, reps by goal
(muscle 8–12, strength 3–6 on the main lifts then 6–10, both = mixed), +1 set for focus muscles. It is
saved as the user's own program and made current. The result screen shows the program and names 1–2
matching ready-made programs from Explore as alternatives.

When: a **brand-new account** (no sessions, no programs, not shown before) on first open. Never in
demo mode, never for existing users. Can be re-run from Settings ("Find me a program").

## B. Tour (builder B)
After the questions finish or are skipped (first run only), a skippable tour: a dimmed backdrop with a
spotlight cut around the target, a small callout bubble with ≤15 words, **Back · Next** and **Skip**.
Next moves the spotlight (and changes tab/route when the next stop is elsewhere), with smooth motion:
spotlight glides, bubble fades/slides ~200 ms, nothing jumps; reduced-motion = instant. Stops: Home
feed, Workouts, Record, the runner basics, Data (muscle map), Profile, account icon, Settings. Replay
from Settings ("Take the tour").

## C. Photo after a workout (builder C)
On the save screen (and Edit): **Add photo** → camera or library (`<input type=file accept=image/*>`).
The image is shrunk in the browser to ≤1080 px long side, JPEG, quality stepped down until ≤150 KB,
stored in its own Firestore doc (not the published doc — its 1 MiB limit is shared by 60 sessions),
readable by exactly whoever can read that workout. One photo per workout; remove/replace. Shown on
the feed card, your own Profile cards and the workout detail. Firestore rules updated, tested in the
emulator, deployed. Demo mode: works locally, nothing uploaded.

## Ownership (all in the main checkout — worktrees break under OneDrive)
- A: new `js/onboarding.js`, new `js/program-builder.js`, `js/app.js` (first-run hook), own CSS
  section, `tests/onboarding.test.mjs`. Exports `openOnboarding({ onDone })`.
- B: new `js/tour.js`, `js/views-account.js` (Settings rows for both), own CSS section,
  `tests/tour.test.mjs`. Exports `startTour()`.
- C: `js/views-session.js`, `js/views-edit-session.js`, `js/views-workouts.js`, `js/views-me.js`,
  `js/social.js`, `js/store.js`, `firestore.rules`, `tests/rules.test.mjs`, new
  `js/photo.js`, own CSS section, `tests/photos.test.mjs`.

## NOT verified yet
- A real brand-new cloud account through questions → tour (demo/--eval only; kept off live Firebase).
- A real iPhone camera photo (HEIC) through the file input; rules on live checked only by deploy.
- Reduced motion on the questions screen (CSS only). "Clear all data" leaves photos; local photos
  don't move to the cloud at sign-up; a reload on the save screen forgets the picked photo.
