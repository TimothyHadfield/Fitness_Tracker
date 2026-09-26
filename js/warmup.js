/**
 * SUGGESTED WARM-UP SETS — the ramp up to the first working set (2026-09-26).
 *
 * Tim: *"For heavy sets. make a suggested program for warming up to that set
 * automatically … Just do whatever supports the research, so If the weight is
 * light enough warmup sets aren't needed, then don't do them, or if you need
 * more warm up sets, then do that. If it's for an excersize that doesn't need
 * warmups, then don't put that."* His 225 x 4 squat example (bar x 10, 95 x 8,
 * 145 x 4, 175 x 2) is illustrative, not a table to copy.
 *
 * Pure. No DOM, no store, no clock, and no unit read from `units.js`: every
 * weight in and out is in the unit the caller names (the display unit), so the
 * rounding lands on plates and dumbbells that exist in THAT gym.
 *
 * ── WHAT THE EVIDENCE SAYS, AND WHICH PART OF IT IS JUDGEMENT ──────────────
 *
 *   • A general warm-up PLUS a specific one beats the specific one alone:
 *     Abad et al. 2011, J Strength Cond Res 25(8):2242-5 — leg-press 1RM rose
 *     when ~5 min of light cycling came before specific sets at ~50 % and ~70 %.
 *   • Specific sets are percentages of the TRAINING load, which is the number
 *     this app has (it does not know a 1RM): Ribeiro B et al. 2020, Int J
 *     Environ Res Public Health 17(18):6882 — 40 % and 80 % of the working load
 *     (6 reps each) best for bench; 80 % best for squat. So the ramp tops out at
 *     ~80 % of the working weight.
 *   • Heavier work needs more, climbing steps: the NSCA 1RM protocol (Haff &
 *     Triplett, Essentials of Strength Training and Conditioning, 4th ed., 2016)
 *     goes light x 5-10, then moderate x 3-5, then near-max x 2-3 — reps fall as
 *     the load rises so the warm-up primes without tiring. The top goes to ~85 %
 *     here when the working set is 3 reps or fewer.
 *   • Dynamic, not long static, stretching before lifting: Behm et al. 2016,
 *     Appl Physiol Nutr Metab 41(1):1-11 (static holds past ~60 s cost force;
 *     dynamic work does not).
 *   • The honest caveat: Ribeiro B et al. 2021, Motricidade 17(1):87-94 (a
 *     systematic review of 11 studies) found the general-then-specific benefit
 *     NOT consensual. So the general line is one short suggestion, not a
 *     routine, and nothing is suggested where the evidence is thinnest —
 *     small, light or single-joint lifts.
 *
 *   JUDGEMENT (not from a paper, stated as such): how many sets. The count rises
 *   with how far the working weight is above a light starting load (the empty
 *   bar, or a 20 lb / 10 kg dumbbell, or 45 lb / 20 kg on a machine):
 *     ratio ≤ 1.3 → 0 · < 2 → 1 · < 3 → 2 · < 4.5 → 3 · otherwise 4,
 *   one fewer when the working set is 12+ reps (a lighter relative load), capped
 *   at 4 on a bar and 3 elsewhere. 225 x 4 squat → 45x10, 90x8, 135x4, 180x3.
 *
 * ── WHO GETS NONE ─────────────────────────────────────────────────────────
 *
 *   Anything without both a weight and a rep count (cardio, holds, carries);
 *   bodyweight and assisted movements (the "weight" is added load or help, and
 *   the warm-up would be bodyweight reps); kettlebells, bands and plates (fixed
 *   implements, mostly ballistic); and single-joint lifts (`isCompoundLift()` in
 *   optimal.js — curls, raises, extensions, flyes, calf raises): the first
 *   working set of a small lift is its own warm-up. ⚠️ NOT modelled: skipping a
 *   compound whose muscles an earlier lift already warmed. That needs a guess
 *   about overlap, and an extra light set costs little.
 */

import { plateLoadFor, bodyWeightFractionFor } from './exercises.js';
import { isCompoundLift } from './optimal.js';

/** The most warm-up sets ever suggested (on a bar lift). */
export const WARMUP_MAX_SETS = 4;
const OTHER_MAX_SETS = 3;

const NO_WARMUP_EQUIPMENT = new Set(['Bodyweight', 'Kettlebell', 'Band', 'Plate', 'Other']);

/**
 * How this exercise warms up, or null for none.
 *   'bar'      a standard barbell: starts at the empty bar
 *   'dumbbell' per-hand bells in real dumbbell steps
 *   'load'     a machine, cable, sled or unweighed bar: starts at ~40 %
 */
export function warmupKind(exercise) {
  if (!exercise) return null;
  const fields = Array.isArray(exercise.fields) ? exercise.fields : [];
  if (!fields.includes('weight') || !fields.includes('reps')) return null;
  if (NO_WARMUP_EQUIPMENT.has(exercise.equipment)) return null;
  if (bodyWeightFractionFor(exercise)) return null;
  if (!isCompoundLift(exercise)) return null;
  if (exercise.equipment === 'Dumbbell') return 'dumbbell';
  const plates = plateLoadFor(exercise);
  if (plates && plates.bar) return 'bar';
  return 'load';
}

/** Step, smallest load and the light reference load, in the given unit. */
function gear(kind, unit) {
  const kg = unit === 'kg';
  if (kind === 'bar') return { step: kg ? 2.5 : 5, min: kg ? 20 : 45, ref: kg ? 20 : 45 };
  if (kind === 'dumbbell') return { step: kg ? 2 : 5, min: kg ? 2 : 5, ref: kg ? 10 : 20 };
  return { step: kg ? 2.5 : 5, min: kg ? 2.5 : 5, ref: kg ? 20 : 45 };
}

function setCount(ratio, reps, cap) {
  let n = ratio <= 1.3 ? 0 : ratio < 2 ? 1 : ratio < 3 ? 2 : ratio < 4.5 ? 3 : 4;
  if (reps >= 12) n -= 1;
  return Math.max(0, Math.min(cap, n));
}

/** Reps for warm-up number `i` at fraction `p` of the working weight. */
function repsAt(p, workReps, i, emptyBar) {
  // The empty bar is always 10 — it is too light to tire anyone. Otherwise 10
  // only for the first, lightest set; after that the reps fall (NSCA).
  if (emptyBar) return 10;
  const table = p < 0.35 && i === 0 ? 10 : p < 0.55 ? 8 : p < 0.72 ? 5 : 3;
  // The heavier half never asks for more reps than the working set itself,
  // but a mid-ramp set keeps at least 3 so it still rehearses the movement.
  if (p >= 0.55 && workReps > 0) return Math.min(table, Math.max(workReps, p < 0.72 ? 3 : 1));
  return table;
}

/**
 * The suggested ramp for one working set, lightest first.
 *
 * @param exercise  a library row (fields, equipment, name, loadType)
 * @param weight    the first working set's weight, in `unit` (per side for a dumbbell)
 * @param reps      its reps (0 when blank)
 * @param unit      'lbs' | 'kg'
 * @returns {{weight: number, reps: number}[]}  in `unit`; [] for none
 */
export function warmupRamp({ exercise, weight, reps, unit = 'lbs' } = {}) {
  const kind = warmupKind(exercise);
  const W = Number(weight);
  if (!kind || !(W > 0)) return [];
  const workReps = Number(reps) > 0 ? Math.round(Number(reps)) : 0;
  const g = gear(kind, unit);
  const n = setCount(W / g.ref, workReps, kind === 'bar' ? WARMUP_MAX_SETS : OTHER_MAX_SETS);
  if (!n) return [];

  const top = W * (workReps > 0 && workReps <= 3 ? 0.85 : 0.8);
  // A bar lift starts at the empty bar; everything else at 40 % (Ribeiro's
  // light set), or 50 % when there is only one.
  const lo = kind === 'bar' ? g.min : W * (n === 1 ? 0.5 : 0.4);
  const round = (x) => Math.round(Math.round(x / g.step) * g.step * 1000) / 1000;

  const out = [];
  for (let i = 0; i < n; i++) {
    const raw = n === 1 ? lo : lo + (top - lo) * (i / (n - 1));
    const w = Math.max(g.min, round(raw));
    // Never at or above the working weight, and strictly rising: rounding can
    // make two neighbours meet, and the second one is then dropped.
    if (w >= W) continue;
    if (out.length && w <= out[out.length - 1].weight) continue;
    out.push({ weight: w, reps: repsAt(w / W, workReps, out.length, kind === 'bar' && w === g.min) });
  }
  return out;
}

/* The one bodyweight rehearsal of the movement, by what it trains. */
function rehearsal(exercise) {
  const name = String(exercise.name || '');
  if (/deadlift|good morning|hip hinge|rdl|pull-through/i.test(name) || exercise.muscle === 'Hamstrings') return '10 hip hinges';
  switch (exercise.muscle) {
    case 'Quads': case 'Glutes': case 'Full Body': case 'Calves': return '10 air squats';
    case 'Chest': case 'Triceps': return '10 push-ups';
    default: return '10 arm circles';
  }
}

/**
 * The general warm-up line before the ramp — "Dynamic stretch · 10 air squats"
 * — or null for an exercise that gets no warm-up.
 */
export function generalWarmup(exercise) {
  if (!warmupKind(exercise)) return null;
  return `Dynamic stretch · ${rehearsal(exercise)}`;
}
