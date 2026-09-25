# Motion, physics and layout — pass 2 (2026-09-25)

**Status: BUILDING** (audits done 2026-09-25; waves below).

## Tim's words
> "I notice the rows slide up when a screen opens but that's it, and there are some problems with the
> cite due to these changes aswell. I want you to work really hard on this. Put professional level
> annimation and physics into this cite. Really analyze all the design layouts and everything. Think
> about the potential for any additions and where they could be. Impress me. When you're done make
> sure that everything still looks good on every single page and then let me know."

## Reading of the ask
- Fix every problem pass 1 (35c6a57) caused, first.
- Real physics (springs, velocity, interruptible gestures), not just fades — screen transitions,
  sheets, tabs, pills, charts, celebrations.
- Layout review of every screen at phone + laptop; build the pure-visual improvements; additions
  that are features or wording get built plainly and flagged to Tim.
- Finish with a full every-page check (393px WebKit + 1440px, dark + light).

## Limits kept
- Content never moves or resizes on tap; the set-logging path stays calm (a press answers back,
  nothing more); `prefers-reduced-motion` turns motion off; level palette and muscle-map drawings
  untouched; no libraries (vanilla, offline PWA).
- Rule 7 changes (spring tier) are recorded in the handbook with Tim's words above as the reason.

## Audit findings (measured, WebKit 393 + 1440, demo, 2026-09-25)
Problems from pass 1 (35c6a57):
1. Light theme: pressed `.row`/`.vol-row` turn near-white (`filter: brightness(1.12)`, app.css ~6495). BROKEN.
2. Pressed rows shrink 2% (scale .98) so text/chevrons/dividers move. Old press was .99, no filter.
3. `.btn:active` brightens instead of darkening in light (app.css ~6487).
4. Data sub-tabs (Bars, Graph, Volume, Muscles, Research) get NO arrival motion: `motion.js` keys
   arrival on `location.hash`, sub-tabs don't change it.
5. Button/chip top-lit gradients never render: `.btn`/`.chip` `background:` shorthand (app.css ~1086,
   ~1187) wipes the `:where(.btn)` gradient (~6350). Computed background-image = none.
6. Saved-workout shine: khaki smear in light, visible ~150 ms, pop 2.5px, clipping notch at 220 ms.
7. Count-up + stagger rerun on every return to Home (20 numbers, even off-screen); "50 min" counts,
   "1h 5min" doesn't in the same card.
8. Record halo reads as a beige smudge (light) / muddy ring (dark).
9. Dark: selected segmented pill uses `--ground` (darker than track) + drop shadow → looks sunken.
10. Laptop sidebar selected item: 1px gold outline + glow too strong in light; sidebar went cream.
11. Celebrating row overrides its stagger animation → skips fade-in, can jolt.
12. `.m-celebrate` forces overflow hidden → clips popovers/shadows while it plays.
13. Demo writes `ftrack:v1:celebrated` to real localStorage (demo must save nothing).
14. Older: light Finish button text contrast 3.39:1 (app.css ~1098); Compare sheet links underlined.
Also: **iOS Safari may not fire CSS `:active` without a touchstart listener** — the app has none, so
press feedback likely never shows on the iPhone (reasoned; add a passive no-op touchstart listener).
Why only the stagger is visible: it's the same 6px rise as the screen's own arrival, at the same
moment; count-ups finish inside the screen fade; the tab pop is 1–2px; celebrations are rare.

Layout (393/1440): Workouts desktop rating block detached from notes and ? dots; Graph markers
overlap on phone; Muscles desktop side panel empty until a tap; Calendar Years bottom half empty;
Profile phone stats block ~250px and best-lift rows wrap to 3 lines, desktop one long 940px column;
Goals desktop "What this asks of you" rows misaligned (x=228 vs 250) and wider than the column;
Settings ? dots ~7px from the edge; desktop runner steppers stretch ~1000px and progress dashes span
1440 while content is 940; Compare sheet links underlined. No horizontal overflow anywhere.

## Key technical fact
`markRoute()` (ui.js ~1478) already stamps `history.state.navIndex` on every entry, so the router
CAN know push / back / forward / tab. The Rule 7 line "a horizontal slide asserts a direction this
router cannot know" (written 09-01) is out of date since 09-02.

## Plan: packages (all in the main checkout, disjoint files; CSS in own end sections of app.css)
- **A · Physics core + pass-1 fixes** (first): new `js/spring.js` (springs k/c presets snap/glide/
  bounce/sheet, fixed-step integrator, interruptible `set(to, v)`, shared rAF, velocityTracker,
  rubberBand, reduced-motion = instant, hidden tab = jump to rest); `js/motion.js` (fixes 4, 7, 11,
  13; `staggerIn(nodes)`; per-pane arrival for sub-tabs); CSS fixes 1–3, 5, 6, 8–10, 12, 14 in the
  existing "Polish" / "Motion" sections; touchstart listener in the app boot; Rule 7 physics tier
  (90% of travel ≤250 ms, at rest ≤400 ms) in handbook + a11y test + new `tests/spring.test.mjs`.
- **F · Layout** (parallel with A): CSS-only fixes from the layout list, own "Motion 2 · Layout"
  section; markup tweaks only in files no one else owns this wave.
- **B · Navigation** (after A): `navDirection()`; push = slide from right with parallax + dim, back =
  reverse, tab = crossfade/scale; Record as a card sheet over the scaled-down previous screen
  (drag-down dismiss); edge-swipe back in the home-screen app (not on the runner); sliding tab-bar
  indicator (3px accent line). Files: app.js, new gestures.js, ui.js router block only.
- **D · Data** (after A, parallel with B): chart line draw-in, real `<linearGradient>` area fill,
  spring scrub dot, marker thinning, sub-tab slide in index direction, calendar month slide/swipe,
  year grid light-up, Settings switch spring + theme circular reveal (View Transitions), muscle
  selection pulse + panel spring. Files: views-data.js, views-muscles.js, year-grid.js.
- **E · Moments** (after A, parallel with B): finish screen (check draws, stats count, PR rows shine
  in sequence), runner minimize into the bar, kudos spring + odometer count, feed Show-more stagger,
  Home pull-to-refresh (native bounce), photo zoom from thumbnail (viewer in ui.js belongs to C —
  E passes `fromRect` only after C lands, else skip), skeletons for Home/Profile, tour spotlight
  springs, onboarding step push, goals bar fill. Runner: presses + check draw only.
- **C · Surfaces** (after B, shares ui.js): segmented pill spring + drag + the Profile Months/Years
  fix, sheets drag-to-dismiss with grab handle + spring entry, image viewer zoom/drag, toast spring
  + flick, stepper press.
- **Final** (manager + agents): full suite, every route at 393 WebKit + 1440, dark + light, reduced
  motion; mid-animation frames; fix what's found; repeat.

## Choices made for Tim (build plainly, flag in the report)
- Rule 7 gains a physics tier (his "professional level annimation and physics").
- Record opens as a card sheet; tab indicator = 3px accent line; pull-to-refresh spinner on Home.
- NOT built (his call): iOS haptic hack on set done, the runner's layout jump when a set finishes
  (logging path), two-column desktop Home, footnote wording cuts, rest timer.

## NOT verified
Filled in as it lands.
