# Look and motion polish — plan (2026-09-25)

**Status: V and M BUILT and live 2026-09-25; L round 1 rejected by Tim ("None of these feel quite
right… ignore the name… just go off the image"), round 2 (marks only) in progress.**
As built: `js/motion.js` decides when (first paint of a visit only); CSS sections "Polish · depth and
colour" and "Motion" at the end of app.css; `--t-celebrate` 640ms; press = shrink (.97 buttons, .98
rows) + brighten, except filled buttons, which press darker instead of brighter (clash settled by the manager).

## Tim's words
> "could you really work on design and annimation improvements throughout the cite? Some cites have
> really good shading, reflection graphics, shining, smooth and creative annimation, new and
> eye-catching logos, good coloring, etc."

## Limits kept (his earlier rules)
- Layout, wording and the level colour palette stay as they are; his muscle-map drawings are untouched.
- Handbook Rule 7: everyday motion stays ≤250 ms and says what happened; nothing on the logging path
  except a press answering back; `prefers-reduced-motion` turns it all off. **New, from this ask:**
  a *celebration* tier (`--t-celebrate`, ≤700 ms) for real wins only — a personal best, a workout
  saved, a goal reached — pinned by name in the a11y test.
- The app icon was closed (2026-08-30) and a rename is coming: logos are **concepts for Tim to pick**,
  not swapped in.
- Content never moves or resizes on tap (transform/opacity only); phone performance first (no heavy
  blur on scrolling content).

## V — depth, light and colour (css)
Elevation tokens (3 levels) built from a soft shadow + a 1px top highlight ("reflection") instead of
borders; surfaces get a faint top-to-bottom tint; primary buttons get a subtle gradient and a gloss
line; the Record hub gets a warm glow ring; the tab bar/sidebar becomes lightly translucent where it
sits over content; accent refined into a 2-stop gradient used sparingly; charts get a soft area fill.
Dark theme first, light theme checked too.

## M — motion (js + css)
Screen arrival rise (existing) polished; list rows stagger in on first paint (≤240 ms total, once per
screen); numbers count up when a stat first appears; progress bars and rings fill; buttons press with
scale 0.97 + highlight; tab icon gives a small pop when selected; a **shine sweep** across the card/
row that just became a personal best, the save confirmation and a reached goal; kudos pop (exists)
matched to the new style.

## L — logo concepts
4–6 original mark + wordmark concepts as SVG (app-icon size and header size), each working on dark
and light and at 32 px. Published as a page for Tim to choose; nothing in the app changes.

## NOT verified
- Real iPhone not checked (WebKit headless only, 393px + 1440px, demo mode).
- Chart area fade: WebKit ignores the CSS mask on SVG shapes, so the phone still shows the flat fill;
  a real fix needs a `<linearGradient>` in views-data.js.
- Profile tab pop not seen in samples (Profile blocks ~500 ms while filling). Data sub-tabs redraw
  in place, so no count-up/fill there. Light theme only spot-checked.
- Each win celebrates once per device; "new best lift" = best set dated today, main lifts only.
