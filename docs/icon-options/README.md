# App icon — six candidates, waiting on Tim's pick

Tim, 2026-08-30: *"I want to replace the main cite logo with a different design. Could you generate
me a couple sweet options and I'll choose one. This is the logo that appears when you add the
website to your Home Screen, and when we eventually make it an app will appear."*

⚠️ **NOTHING HERE IS SHIPPED.** `icon.svg` in the repo root is untouched. These six are candidates,
and the question that would have chosen one was interrupted before he answered — **so a fresh
session must ASK rather than assume.** Same shape as `docs/colour-options/` on 2026-08-26, which is
the precedent for keeping unpicked design work in the repo instead of losing it in a temp folder.

`contact-sheet.png` shows all six the way they were shown to him: large, at real home-screen size,
and tiny.

| | File | What it is | Read |
|---|---|---|---|
| **A** | `a-barbell-dark.svg` | barbell, gold on near-black | Instantly readable, completely unambiguous, and the shape most other gym apps already use |
| **B** | `b-barbell-gold.svg` | the same, inverted on gold | Stands out on a home screen full of dark icons |
| **C** | `c-lifter.svg` | a figure pressing overhead | The most characterful; survives to 32px better than expected |
| **D** | `d-plate.svg` | a plate with the bar through it | **The recommendation.** Strongest silhouette of the six and the least like everyone else |
| **E** | `e-bars.svg` | three ascending bars | Says "tracker" rather than "gym", which is closer to what the app does. Muddiest when small |
| **F** | `f-plate-gold.svg` | the plate, inverted on gold | |

## Two things that are settled, whichever he picks

🚨 **1. THE ICON HAS PROBABLY NEVER APPEARED ON HIS HOME SCREEN.** `index.html` points
`apple-touch-icon` at `icon.svg`, and **iOS has never supported SVG for a home-screen icon — it
requires PNG.** With no usable icon, iOS falls back to a screenshot of the page. So the thing Tim
asked to replace may never have been on screen, and whichever design wins must ship as **PNG at 180
and 512** beside the SVG. Verified against Apple's own guidance and Lighthouse's `apple-touch-icon`
audit, 2026-08-30; not verified on Tim's phone, which would settle it in one look.

⚠️ **2. ALL SIX FIT ANDROID'S MASKABLE SAFE ZONE**, measured rather than eyeballed: no painted point
sits more than **204px from the centre** of the 512 canvas, which is the inner-80% circle a launcher
may crop to. `manifest.webmanifest` declares `"purpose": "any maskable"` on one file, so that
constraint is real — C and E had to be inset by 24% and 15% to meet it, and the plate's bar was
pulled in 8px each side. **Check this again if the artwork is edited**; `render.mjs` re-renders the
sheet and the PNGs.

## Folding one in

1. Copy the chosen SVG to `icon.svg` in the repo root.
2. Export `icon-180.png` and `icon-512.png` from it (`render.mjs` already writes both).
3. `index.html`: point `apple-touch-icon` at the 180 PNG, keep the SVG for `rel="icon"`.
4. `manifest.webmanifest`: list the PNGs alongside the SVG.
5. Add the PNGs to the `sw.js` precache list — the test in `data-layer` fails if you forget.
6. Delete this folder.
