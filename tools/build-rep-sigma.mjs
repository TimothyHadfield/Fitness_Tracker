/* ------------------------------------------------------------------ *
 * HOW UNCERTAIN IS A REP COUNT? — generates js/rep-sigma.js.
 *
 *   node tools/build-rep-sigma.mjs        # print
 *   node tools/build-rep-sigma.mjs --write
 *
 * 🚨 WHY THIS TOOL EXISTS. `repFactor()` in muscle-evidence.js was a hand-typed
 * ladder — 1.00 / 0.95 / 0.85 / 0.70 / 0.45 / 0.25 — and Tim asked the obvious
 * question nobody had: where does the 0.45 come from? The answer was nowhere.
 * No tool fitted it, `docs/research.md` does not contain it, and its own comment
 * cites the research only for the SHAPE ("accuracy degrades above ~10 reps").
 * The numbers were a judgement written as data, and they were deciding which of
 * a lifter's sets got to speak for a muscle.
 *
 * ⚠️ THE SHAPE WAS RIGHT AND THE STEPS WERE NOT. A 12-rep set really is a worse
 * predictor of a maximum than a 3-rep one — Reynolds (2006, n=70) found a 5RM
 * predicted best at R² 0.993 with accuracy "degraded substantially at higher rep
 * ranges", and Mayhew (2008, n=103) found the equations more accurate below ten
 * (`docs/research.md` §1.2). What the literature does not say is that eleven
 * reps is worth 36 % less than ten, which is what the ladder asserted: its steps
 * were cliffs, and one extra rep could cost a set a third of its weight.
 *
 * ------------------------------------------------------------------
 * WHAT IS MEASURED HERE, AND WHY IT IS HONEST
 *
 * The seven classical formulas in `docs/research.md` §1.2 are all of the form
 * `1RM = w × f(r)`. They agree closely at low reps and diverge at high ones —
 * and **that divergence is a measurement of how uncertain rep extrapolation is**,
 * made by seven independent authors rather than by this session.
 *
 * 🔒 IT IS THE SAME TECHNIQUE `tools/build-ratio-sigma.mjs` ALREADY USES for
 * conversion ratios, where σ comes from how far a published ratio drifts between
 * the novice and advanced rows. One idea, applied to the second input that had
 * been carrying a guess.
 *
 * ⚠️ EACH FORMULA IS NORMALISED BY ITS OWN f(1) FIRST, and that is not cosmetic.
 * A one-rep set needs no conversion at all, so the uncertainty of converting it
 * must be zero; the formulas' raw disagreement at r = 1 (Epley alone is 3.3 %
 * high there) is an artefact of how they were fitted, not doubt about a single.
 * Normalising isolates the quantity actually wanted: how much do they disagree
 * about the r → 1 EXTRAPOLATION.
 *
 * 🛑 WHAT THIS σ IS NOT. It is not the total error of an estimate, and it does
 * not know whether a set was taken to failure — the largest single source of
 * error in the whole model, which D28 says the app may not ask about. It is one
 * term, combined in quadrature with the ratio and body-weight terms inside
 * `sigmaFor()`. That combination is the point: where a conversion is already
 * doubtful, the rep count barely matters; where the lift IS the key lift and the
 * ratio is exact, the rep count is most of what is left.
 * ------------------------------------------------------------------ */

import { writeFileSync } from 'node:fs';

/* The seven classical formulas, verbatim from docs/research.md §1.2. Each
 * returns the multiplier f(r) such that 1RM = w × f(r). */
const FORMULAS = {
  'Epley (1985)': (r) => 1 + r / 30,
  'Brzycki (1993)': (r) => 1 / (1.0278 - 0.0278 * r),
  'Lombardi (1989)': (r) => Math.pow(r, 0.10),
  'Lander (1985)': (r) => 1 / (1.013 - 0.0267123 * r),
  "O'Connor (1989)": (r) => 1 + 0.025 * r,
  'Mayhew (1992)': (r) => 100 / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  'Wathen (1994)': (r) => 100 / (48.8 + 53.8 * Math.exp(-0.075 * r)),
};

/* ~~D5's ceiling. Above this a set is not evidence of a maximum at all.~~ — the
 * table stopped at 15 because nothing could ever ask it about 16, so the two
 * numbers were the same number by accident rather than by argument.
 *
 * 🚨 25 SINCE 2026-09-23, AND THE TABLE NOW RUNS PAST D5 ON PURPOSE. The muscle
 * map has its own ceiling — `MAX_MAP_REPS` in js/e1rm.js — because its blend is
 * inverse-variance: a reading enters at 1/σ², so a long set is PRICED rather
 * than trusted, and the price is the number this file measures. D5's 15 stays
 * exactly where it is everywhere a set becomes a single printed maximum (the
 * charts, the personal bests, progression, the comparison screen, `setE1rm()`),
 * because there 1/σ² has nowhere to go — one number is shown and it is either
 * believed or it is not.
 *
 * ⚠️ EXTENDING THE TABLE IS NOT THE SAME ACT AS RAISING A GATE, and the
 * distinction is the whole argument. This file does not decide what is
 * admissible; it measures how badly the seven classical formulas disagree at a
 * rep count, and they disagree at 20 reps whether or not anything asks. Stopping
 * the table at 15 did not make 20-rep extrapolation safer — it made the app
 * unable to say how unsafe it was, and `repSigma()` answered a 20-rep set with
 * the 15-rep σ, which UNDERSTATES the doubt by a factor of two.
 *
 * 🛑 30 IS NOT AVAILABLE AND THAT IS WHY THE MAP'S CEILING IS 25. At 30 reps
 * σ_rep is 61 %, past `SIGMA_MAX` (0.50) in muscle-evidence.js, so the clamp
 * eats it: every set from 30 upward would price identically and the pricing
 * would stop being a measurement. 25 is the last rep count whose σ the blend can
 * still represent. */
const MAX_REPS = 25;

function sigmaAt(reps) {
  const names = Object.keys(FORMULAS);
  const v = names.map((n) => FORMULAS[n](reps) / FORMULAS[n](1));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  // Sample standard deviation — seven authors are a sample of the ways this
  // conversion has been attempted, not the population of them.
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { mean, sd, relative: sd / mean };
}

const rows = [];
for (let r = 1; r <= MAX_REPS; r++) {
  const { mean, relative } = sigmaAt(r);
  rows.push({ reps: r, mean, sigma: relative });
}

const body = `/* GENERATED BY tools/build-rep-sigma.mjs — DO NOT HAND-EDIT.
 *
 * How uncertain the rep→1RM conversion is, per rep count, measured as the
 * disagreement between the seven classical formulas in docs/research.md §1.2
 * after normalising each by its own one-rep value.
 *
 * 🚨 THIS REPLACED A HAND-TYPED LADDER. \`repFactor()\` used to assert
 * 1.00 / 0.95 / 0.85 / 0.70 / 0.45 / 0.25 with no source for any of it, and one
 * extra rep could cost a set a third of its weight at the step boundaries. Tim
 * asked where 0.45 came from; nothing anywhere answered.
 *
 * ⚠️ A ONE-REP SET HAS σ = 0 because nothing is converted. The rise is smooth
 * and monotone, which the ladder was not.
 *
 * 🚨 THE TABLE RUNS TO 25 AND D5'S GATE IS STILL 15 — 2026-09-23. Those are two
 * different questions and this file only answers the second one: how far apart
 * are the seven formulas at r reps. The muscle map reads rows 16–25 because its
 * blend is inverse-variance and can PRICE a long set (\`MAX_MAP_REPS\`,
 * js/e1rm.js); everything that prints one number off one set still stops at 15.
 *
 * Regenerate: node tools/build-rep-sigma.mjs --write
 */

/** Relative σ of the rep→1RM conversion, indexed by rep count (1-based). */
export const REP_SIGMA = new Map([
${rows.map((r) => `  [${r.reps}, ${r.sigma.toFixed(5)}],`).join('\n')}
]);

/**
 * The conversion uncertainty for a set of \`reps\` reps, as a fraction.
 *
 * ⚠️ ~~Above D5's ceiling the set is not evidence of a maximum and the caller
 * should already have refused it~~ — that stopped being the whole truth on
 * 2026-09-23. It is still true of every caller that turns one set into one
 * printed maximum, and it is NOT true of the muscle map, which admits up to
 * \`MAX_MAP_REPS\` (25) and pays for the extra reps out of 1/σ². The table now
 * covers exactly that range, so those callers get a measured σ rather than the
 * 15-rep σ standing in for a 20-rep set — which understated the doubt twofold.
 *
 * Past 25 this still returns the last row rather than extrapolating a table that
 * stops. Nothing should ask: 25 is the map's ceiling and 15 is everyone else's.
 * The clamp is the honest answer to a question with no measurement behind it,
 * and at 30 reps σ is 61 % — past \`SIGMA_MAX\`, where the blend can no longer
 * tell one long set from another anyway.
 */
export function repSigma(reps) {
  const r = Math.round(Number(reps));
  if (!Number.isFinite(r) || r < 1) return REP_SIGMA.get(${MAX_REPS});
  return REP_SIGMA.get(Math.min(r, ${MAX_REPS}));
}
`;

if (process.argv.includes('--write')) {
  writeFileSync(new URL('../js/rep-sigma.js', import.meta.url), body);
  console.log('wrote js/rep-sigma.js');
} else {
  console.log('reps   mean f(r)   sigma');
  for (const r of rows) {
    console.log(String(r.reps).padStart(4), r.mean.toFixed(4).padStart(11),
      (100 * r.sigma).toFixed(2).padStart(7) + '%');
  }
  console.log('\n(--write to generate js/rep-sigma.js)');
}
