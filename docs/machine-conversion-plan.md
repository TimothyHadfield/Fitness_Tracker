# Machine conversion plan: convert each machine by how it's built

## Tim's words (verbatim)

2026-09-27: *"I don't think you understand. the 45lbs for the machine hip thrust matches to a lot more than 45lbs with a barbell bench press. This is because the machanical advantage with the lever and extending the weight further away from the pivot point makes it harder to move. From what you're saying, it seems like you just made it even more lopsided so the 45lbs machine hip thrust acts like even less weight than it is? I wouldn't be supprised if the equivilant weight was over 2-3x the actual weight used for the machine
Additionally I don't want you to do a single conversion like "machine weights are 60% of free weight counterparts" because thats just extreame and many machines have verious different conversions depending on the machanics of it. Really think about why something converts to a different weight and by a certain amount."*

2026-09-26: *"The one we used had a long extended rod which made the machanical advantage more for the weight (if it was on your hip, it would feel a lot lighter)."*

Reading taken: "barbell bench press" = the **barbell hip thrust** (done off a bench). If he meant the flat bench press, that's a different muscle and doesn't change anything below.

> ## 🛑 NOTHING IS BUILT. This is research and a proposal. No code is changed.

## 1. How the app converts today (checked in code)

`js/muscle-evidence.js` RATIOS: `ratio = exercise 1RM ÷ muscle's key-lift 1RM`. A set's key-lift estimate = e1RM(weight, reps) ÷ ratio. **A lower ratio makes each logged pound worth more.** Machine Hip Thrust is **0.60** (q 0.25). That implies each plate pound counts as **0.96/0.60 = 1.6 lb of barbell hip thrust**. The 2026-09-26 change (1.00 → 0.60) *raised* the credit, but only to ~1.6×, where Tim's machine is likely 2–3×. Tim's 45 × 10 reads about a **100 lb deadlift** now.

## 2. Hip thrust, worked from the physics

**Torque balance on a lever.** Pivot at one end, hip pad at distance `d_pad`, plate horn at `d_plate`. Force at the hips = `k × plates + A`, where **k = d_plate / d_pad** and `A` = the arm's own weight felt at the pad (the "starting resistance"). Both points sit on the same rigid arm, so the angle cancels out and k holds through the whole rep. (The barbell's force stays vertical while the pad's force stays perpendicular to the arm, but the difference is small near lockout.)

Barbell reference (Strength Level, [hip-thrust](https://strengthlevel.com/strength-standards/hip-thrust/lb), bar included): male 180 lb 129/218/**335**/478/639, female 140 lb 81/143/**227**/330/447. Deadlift 201/268/**348**/438/535 (m) and 93/139/**196**/264/338 (f). Hip thrust ÷ deadlift median = **0.96 m / 1.16 f** (the current barbell entry). So a machine's ratio = **0.96 / k** (m) and **1.16 / k** (f), with `A` added before reps.

| Design | Example | k (plates → hips) | A | Ratio m / f | Tim's 45×10 → deadlift-equiv. |
|---|---|---|---|---|---|
| Plates at/over the hips, no lever | Smith hip thrust; belt/carriage machines with horns beside the hip ([Nautilus Glute Drive](https://www.apirosport.se/wp-content/uploads/2020/03/Nautilus-Leverage-Glute-Drive-NPL1131-Product-Sheet_Final.pdf): horns on the carriage, **starting resistance 15 lb**) | ≈1.0 (reasoned from the product photo) | 15 lb (Glute Drive, published); Smith bar 5–45 lb (varies by make) | 0.96 / 1.16 **plus A** (no offset: ~0.90 m) | ~80–90 |
| Plate-loaded lever, pegs **past** the pad (Tim's "long extended rod") | many commercial and import lever thrusters | **1.5–3** (from where the pegs sit) | ~10–30 lb (not published; reasoned) | k=2 → **0.48/0.58**; k=2.5 → **0.38/0.46**; k=3 → **0.32/0.39** | k=2: **153** · k=2.5: **184** · k=3: **215** (A=20) |
| Lever with pegs **between** pivot and pad | some compact designs | 0.5–0.9 | small | 1.1–1.9 | 60–85 |
| Selectorized glute machine (pin on a stack) | [Booty Builder V8](https://bootybuilder.com/exercises/hip-thrust/barbell-vs-machine/), stack glute machines | cam/pulley, typically 0.5–1 (a 2:1 reduction halves it) | built into the stack | ~1.0–1.9 | 60–90 |

Arithmetic for Tim's set, k=2.5, A=20: (2.5×45 + 20) × (1 + 10/30) = 177 lb of barbell hip thrust → ÷ 0.96 = **184 lb deadlift**, against 100 today.

**Verdict on "2–3×": physically right for his type of machine.** If the pegs sit 2–3× as far from the pivot as the hip pad, each plate pound is 2–3 lb at the hips before the arm's own weight is added. And it's **wrong for other designs**: the same 45 lb on a Glute Drive or a Smith is about 1×, and on some stacks it's less. The spread across designs is about **6×**, which is exactly why one number can't work (Tim's second point). 0.60 sits in the middle of that spread and is right for almost nobody.

**Published "machine hip thrust standards" checked and rejected:** Strength Level has no page (the `machine-hip-thrust` and `hip-thrust-machine` URLs redirect; checked 2026-09-27). [Endura](https://endura.coach/hip-thrust-machine-strength-standards-calculator/) says 1.22×BW intermediate but gives no method. [AthletePath](https://www.athletepath.com/strength-standards/hip-thrust-machine/) says 675 lb intermediate at 180 lb and gives no source (not believable). Both pool every design together anyway.

## 3. Audit: every machine, cable, sled, lever and Smith entry with a ratio

"SL" = the ratio is a Strength Level median ([exercise-standards.js](../js/exercise-standards.js) rows). An SL median already reflects the *typical* machine people log, so brand spread shows up as a wide drift and a low q, not as a bias. **The count: ~34 sourced, ~33 reasoned or carried.**

| Entry | Logged | What makes it differ | Ratio | Source | Brand variance | Proposed |
|---|---|---|---|---|---|---|
| **Machine Hip Thrust** | plates on a lever/belt, or a stack | k from 0.5 to 3, plus the arm's weight | 0.60 | reasoned | **huge (~6×)** | **per-design k + A (§4)** |
| Smith Hip Thrust | plates only | counterbalanced bar, 5–45 lb | 1.00 | reasoned | bar weight | 0.96 + bar offset |
| **Smith Squat / Shrug / Bench / Incline / OHP / Row / Calf** | plates only (Tim, 2026-09-23) | **SL's Smith pages say "include the bar, normally 44 lb"** ([smith-machine-squat](https://strengthlevel.com/strength-standards/smith-machine-squat/lb)), the app says leave it out | 0.89 / 0.99 / 1.00 / 0.85 / 1.05 / 1.00 / 1.00 | squat and shrug SL, the rest reasoned (Smith bench has an SL row: 0.96, not 1.00) | 5–45 lb bar | **add an assumed bar offset** (Tim decides) |
| Leg Press (45° sled) | plates only | sin 45° ≈ 0.71 of plates plus sled, friction, the lifter's own legs | 1.73 / 1.94 | SL | 30–45° angles, sled 75–250 lb | fine on SL |
| Seated Leg Press | stack | cam or 1:1 stack | 1.32 / 1.47 | SL | moderate | fine |
| Hack Squat | plates only | sled angle; lever hacks exist | 1.15 | SL | large (sled vs lever) | fine; optional k later |
| **Pendulum Squat** | plates only | pure lever, horn position varies | 1.05 | **reasoned** | **large** | **k picker** |
| Belt Squat | machine weight | lever or direct belt | 1.40 / 1.50 | SL | lever vs direct | fine |
| Single-Leg Press | plates | sled | 0.95 / 0.97 | SL | as sled | fine |
| Leg Extension / Seated & Lying Leg Curl | stack | cam | 0.78 / 0.66–0.71 / 0.53 | SL | cam profiles | fine |
| Standing / Cable Leg Curl | stack | carried on the lying curl | 0.53 | carried | moderate | fine for now |
| Single-Leg Extension | stack | carried | 0.55 | reasoned | moderate | low priority |
| **Machine Glute Kickback** | stack/lever, **total (not doubled)** | lever pad; **borrows Cable Kickback's 0.63, which assumes a doubled per-side number** | 0.63 | carried | large | **own entry**: today a machine set gets about half the credit of the same load on a cable |
| Hip Abduction / Adduction | stack | lever pads | 0.61–0.79 | SL | moderate | fine |
| Cable Pull-Through, Kickback | stack | pulley | 0.49–0.63 | SL | pulley ratio | fine |
| Machine Chest Press / Incline Machine Press | stack or iso-lateral horns | lever/cam | 0.91 / 0.82 | SL / reasoned | large (drift 0.69–1.05) | fine / low |
| Pec Deck, Reverse Pec Deck | stack | lever arm | 0.90 / 1.07 | SL | moderate | fine |
| Cable Fly family, Press Around | stack per side | pulley | 0.40 | reasoned | 1:1 vs 2:1 pulleys | pulley picker later |
| Machine Dip | stack | lever | 1.14 | SL | moderate | fine |
| Machine Row / Hammer Strength Row | plates on iso-lateral horns | lever, "both sides together" | 1.18 / 1.20 | SL | large | fine |
| Chest-Supported Row | machine | lever | 0.95 | reasoned | large | low |
| Lat Pulldown / Straight-Arm / Seated Cable Row | stack | pulley (mostly 1:1) | 0.95 / 0.61 / 0.98 | SL | small–moderate | fine |
| Single-Arm Pulldown / Row, Machine & Cable Pullover | stack | carried | 0.84 / 0.45 | carried | moderate | low |
| Reverse Hyperextension | plates on a pendulum arm | lever | 0.55 | reasoned | large | k picker later |
| Machine Shoulder Press / Lateral Raise | stack or lever | cam/lever | 1.23 / 0.97 | SL | **widest drift** | fine |
| Cable Lateral / Front / Rear-Delt / Y-Raise, Cable Upright Row | stack | carried from the dumbbell or barbell | 0.53 / 0.54 / 0.56 / 0.54 / 0.94 | carried | pulley | low |
| Face Pull, Cable Curl, Pushdown, Overhead Cable Ext. | stack | pulley | SL | SL | pulley | fine |
| Cable Rope Hammer Curl | stack | an SL row exists (97/104 = **0.93**) but the ratio is carried at 1.01 | 1.01 | carried | pulley | switch to SL 0.93 |
| Machine Curl / Machine Preacher / Bayesian | stack | cam | 1.23 / 1.05 / 0.93 | SL / carried / carried | moderate | fine / low |
| Machine Triceps Ext., Cross-Body Cable Ext., Cable Kickback (tri) | stack | cam/pulley | 0.60 / 0.47 / 0.39 | reasoned / carried | moderate | low |
| Machine Shrug / Cable Shrug | plates/stack | lever/pulley | 1.16 / 0.81 | SL | moderate | fine |
| Seated Calf / Leg Press Calf | machine | lever / sled | 0.66 / 1.47 | SL | moderate | fine |
| Donkey Calf / Cable Reverse Curl | machine / stack | lever / pulley | 1.05 / 0.78 | reasoned | large / small | low |
| Machine Crunch | stack | cam | 1.13 / 0.89 | SL | moderate | fine |

## 4. Proposed design: follow the mechanics, not one factor

The principle: **a machine needs its own conversion only where its geometry is visible and varies a lot between machines of the same name** (plate-loaded levers and Smith bars). Stack machines whose gearing is hidden inside a cam stay on the SL median, because the user can't measure anything better and the population already covers the brand spread.

**Engine change (small, shared):** each machine entry can carry a leverage `k` and a starting offset `A`. The set is converted as `e1RM(k × logged + A, reps) ÷ ratio_of_the_free_lift`. For hip thrusts that's the sourced barbell 0.96 / 1.16. This makes the offset honest at light loads, where a bare ratio is worst. For Tim's set at k=2.5, A=20 it gives 184, against 170 with the ratio alone.

**Option A: split the library entry by design.** No new UI. For example: lever with plates past the pad (k 2.5, A 20, q 0.30), plates at the hips / belt (k 1, A 15, q 0.35), stack (k 0.8, q 0.25). This shrinks the 6× unknown to about ±30%. Cost: 3 names instead of 1. Existing logged sets need a decision (the default proposal is to keep "Machine Hip Thrust" as the lever design, since that's the one logged so far). *Names are Tim's call.*

**Option B: one-time "leverage" setting per machine exercise (recommended with A).** It appears only on lever-type entries: Machine Hip Thrust, Pendulum Squat, Machine Glute Kickback, Reverse Hyper, and later Hack Squat. Plain picker: *"Where do the plates sit, compared with the pad, measured from the pivot?"* → **same distance / 1.5× / 2× / 2.5× / 3× / not sure**. Plus an optional *"starting weight on the sticker"* field. "Not sure" falls back to the design default from Option A. To find it: look along the arm and count how many pad-to-pivot lengths out the peg is, or measure both with a phone tape. q rises only a step when set (0.25 → ~0.35), because ROM and stability still differ from the barbell and the reading is by eye. *Wording, placement and whether it exists are Tim's call.*

**Option C: personal calibration (parked).** Solve k from the user's own barbell hip thrust, if they log both within a few weeks. Calibrating against the *deadlift* would be circular: the machine would just repeat the deadlift's rating. Rarely available, so park it.

**Smith family (separate, cheap):** add an assumed effective bar offset (e.g. 20 lb) before the SL ratios, because SL lifters are told to include the bar and the app tells users not to. Or flip the Smith logging note to "include the bar". *Tim's call* (he chose plates-only on 2026-09-23).

**Quick fixes that need no decision:** Machine Glute Kickback gets its own entry and stops borrowing a doubled-per-side ratio. Cable Rope Hammer Curl moves to its SL 0.93. Smith Bench moves to its SL 0.96.

## 5. Questions only Tim can answer

1. **Your machine:** roughly how far out are the plate pegs, compared with the hip pad, from the pivot (same, 1.5×, 2×, 3×)? Is there a sticker with a brand, model or starting weight? A photo would settle it.
2. **Shape:** split entries (A), a one-time leverage picker (B), or both? And the names and wording.
3. **Smith:** keep "plates only" and have the app add an assumed bar weight, or switch the note to "include the bar"?
4. **Old sets:** should Machine Hip Thrust sets already logged be re-read as the lever design?

## 6. NOT verified

- No manufacturer publishes a hip-thrust lever ratio. k values are **reasoned from geometry**, not measured on any real machine, including Tim's.
- Glute Drive k≈1 is read off a product photo. The 15 lb starting resistance is published.
- Lever-arm starting weights (A ≈ 10–30 lb) are a typical range, not a source.
- Whether SL users actually add 44 lb on a counterbalanced Smith bar is unknown. The page *tells* them to.
- Force direction (vertical bar vs perpendicular pad) and ROM differences are treated as second-order and not quantified.
- Endura and AthletePath machine standards: methodology unknown, not used.
