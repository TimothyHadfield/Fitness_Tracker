// Somebody else's muscle map, turned back into the shape our own panel renders.
//
// 🚨 WHY THIS FILE EXISTS. Tim, 2026-09-03: *"I also want a friend to be able to
// see another user's body, their graphs, volume, etc. as well as click on any
// muscle group like that own user can on themselves and pull details from it."*
//
// A friend's body map has been on their page since 2026-08-18 and it was a
// PICTURE: `bodySvg(levels, null, () => {})` — coloured, and inert, because the
// projection carried a level and a percentile and nothing else. A panel needs
// more than that. It names the estimated one-rep max, what the next level costs,
// how well corroborated the reading is, and the recorded sets it came from.
//
// ⚠️ THE ARITHMETIC IS NOT REDONE HERE, AND THAT IS THE WHOLE POINT. Everything
// on this screen was computed by the owner's own device, by the same functions
// that drew it on their screen, and published (js/social.js, projectStrength).
// This module is a TRANSLATION — published shape in, `muscleStrength()` shape
// out — so the friend's panel and your own panel are the same code reading the
// same fields, and cannot drift into disagreeing about what a number means.
//
// ⚠️ WHAT IT DELIBERATELY CANNOT DO: recompute a percentile. That needs the
// person's body weight, which the public document does not carry and never will
// (Tim's call the same day). Instead the owner published one row per comparison
// group the sheet can produce, and this reads the row that was asked for. A
// group with no row is a group this reader cannot have — see `missing`.
//
// Pure: no DOM, no store, no clock. Assertable headlessly, like every other
// module in this app that decides what a number means.

import {
  LEVELS, levelFor, nextLevelAfter, levelProgress, compareKey, keyLiftFor,
} from './strength-standards.js';
import { tintFor, confidenceBand } from './muscle-evidence.js';

/** The sex the owner's own "like me" resolves to, from their published default. */
export function ownSexOf(strength) {
  const key = strength && typeof strength.defaultCompare === 'string'
    ? strength.defaultCompare : '';
  const sex = key.split('|')[1];
  return sex === 'female' ? 'female' : 'male';
}

/**
 * One published map, read under one comparison group.
 *
 * @param {object} strength  the `strength` block of a published document
 * @param {object} compare   the four axes the viewer has chosen
 * @returns {{ muscles: Map, missing: boolean }}
 *
 * `missing` is true when the asked-for group is not in the published grid —
 * which happens for a document published before this existed, or by an account
 * that has since narrowed what it shares. ⚠️ IT IS A STATED OUTCOME RATHER THAN
 * A SILENT FALLBACK TO THEIR DEFAULT: a body painted against a different
 * comparison group than the one named above it is the exact fault the "Compared
 * to" control was built to prevent on our own screen (views-muscles.js), and it
 * would be worse here, where the reader cannot check it against anything.
 */
export function ratingsFromShared(strength, compare) {
  const out = new Map();
  const s = strength && typeof strength === 'object' ? strength : {};
  const muscles = Array.isArray(s.muscles) ? s.muscles : [];
  const grid = s.grid && typeof s.grid === 'object' ? s.grid : {};

  const key = compareKey(compare, ownSexOf(s));
  const row = grid[key];
  if (!row) return { muscles: out, missing: muscles.length > 0 };

  for (const m of muscles) {
    const pair = row[m.muscle];
    if (!Array.isArray(pair) || !Number.isFinite(pair[0])) continue;
    const percentile = pair[0];
    const toNext = Number.isFinite(pair[1]) ? pair[1] : null;
    const level = levelFor(percentile);
    const next = nextLevelAfter(level);
    const contributors = Array.isArray(m.contributors) ? m.contributors : [];
    const top = contributors[0] || null;

    out.set(m.muscle, {
      muscle: m.muscle,
      // A name, not the library object — the published document carries the key
      // lift's NAME, and the panel only ever prints `lift.name`. Looked up where
      // it can be, so a reader's own library stays the source of truth for it.
      lift: keyLiftFor(m.muscle) || (m.lift ? { name: m.lift } : null),
      estimate: m.estimate,
      confidence: m.confidence,
      // ⚠️ REBUILT FROM THE NUMBER, NOT READ FROM THE STRING. The document
      // carries the band's name for readers that only want to print it; the
      // panel wants the object, and deriving it here means one definition of
      // where the boundaries are rather than two that can disagree.
      band: Number.isFinite(m.confidence) ? confidenceBand(m.confidence) : null,
      tint: Number.isFinite(m.confidence) ? tintFor(m.confidence) : 1,
      basis: m.basis,
      contributors,
      contributorCount: m.contributorCount,
      exerciseCount: m.exerciseCount,
      hint: m.hint || null,
      confident: m.confident === true,
      best: top
        ? {
          weight: top.weight, reps: top.reps, date: top.date,
          source: top.source, exerciseName: top.exerciseName, loadType: top.loadType,
        }
        : null,
      percentile,
      level,
      next,
      toNext,
      progress: levelProgress(percentile, level),
    });
  }

  return { muscles: out, missing: false };
}

/** What `bodySvg()` needs: muscle → { levelKey, label, tint, confidence }. */
export function levelMapFrom(ratings) {
  const levels = new Map();
  for (const [muscle, m] of ratings) {
    levels.set(muscle, {
      levelKey: m.level ? m.level.key : 'below',
      label: m.level ? m.level.name : 'Below Beginner',
      tint: m.tint,
      confidence: m.band ? m.band.name : null,
    });
  }
  return levels;
}

/** Every level name, for anything that needs to resolve one. */
export const LEVEL_BY_NAME = new Map(LEVELS.map((l) => [l.name, l]));
