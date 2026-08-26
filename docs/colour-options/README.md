# Colour options (Open work 0k) — waiting on Tim's pick

Three whole-app dark-theme directions, built 2026-08-26 as real token overrides, screenshotted
from the real app at 360px and published for Tim to choose from:

**https://claude.ai/code/artifact/ca7bfddd-28e8-463b-a06a-9339931ba64d**

- `teal.css` — cool sea-green accent, faintly tinted field. Accent on ground 8.3:1.
- `indigo.css` — night-sky field, periwinkle accent, echoes the level key's blue–purple end. 8.1:1.
- `ember.css` — keeps the gold, warms the whole neutral field around it. 7.7:1.

These files are CANDIDATES, not shipped code — the app's stylesheet is untouched. When Tim picks
one (or a mix), the job is: fold the chosen tokens into css/app.css for BOTH themes (these are
dark only), re-check the level palette against the new ground, run the a11y suite and the full
audit, and delete this folder.

If he still finds the big primary buttons too loud afterwards, quieter button styling is a
separate small job that works under any of these.
