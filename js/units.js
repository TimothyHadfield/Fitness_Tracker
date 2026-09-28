// Pounds and kilograms.
//
// EVERYTHING IS STORED IN POUNDS. Always. Switching units is a display choice
// and must never rewrite a single recorded number — a user who flips to kg and
// back has to get the same history they started with, to the pound. e1rm.js and
// strength-standards.js are also pounds throughout, so conversion happens only
// at the two edges: what is shown, and what is typed.
//
// The current unit is cached here rather than read from the store, because the
// stepper and the set formatter are synchronous and are called while rendering.
// app.js seeds it at boot and Settings updates it on change. The weight
// preferences (step, bar, plates) are cached the same way — see setWeightPrefs.

export const LB_PER_KG = 2.2046226218;

let current = 'lbs';

export function setUnits(u) {
  current = u === 'kg' ? 'kg' : 'lbs';
  return current;
}

export function units() {
  return current;
}

/** Pounds -> whatever the user reads. */
export function toDisplay(lb) {
  const n = Number(lb);
  if (!Number.isFinite(n)) return 0;
  return current === 'kg' ? n / LB_PER_KG : n;
}

/** Whatever the user typed -> pounds, which is what gets stored. */
export function fromDisplay(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return current === 'kg' ? n * LB_PER_KG : n;
}

/* ------------------------------------------------------------------ *
 * Weight preferences — steps, bar and plates (2026-09-27, settings ST-4/ST-5)
 * ------------------------------------------------------------------ */

/* The choices the Settings sheet offers, in each unit. Everything a user can
 * pick comes from these lists, and `setWeightPrefs()` refuses anything else,
 * so a hand-edited or corrupt settings doc can only ever fall back to today.
 *   steps   the stepper's +/- (and the warm-up rounding)
 *   bars    the empty bar: 45/20 standard, 35/15 women's, 15/10 technique
 *   plates  every plate a gym is likely to own, heaviest first */
export const WEIGHT_STEP_OPTIONS = Object.freeze({
  lbs: Object.freeze([2.5, 5]),
  kg: Object.freeze([1, 1.25, 2.5]),
});
export const BAR_OPTIONS = Object.freeze({
  lbs: Object.freeze([45, 35, 15]),
  kg: Object.freeze([20, 15, 10]),
});
export const PLATE_OPTIONS = Object.freeze({
  lbs: Object.freeze([55, 45, 35, 25, 10, 5, 2.5, 1.25]),
  kg: Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25, 0.5]),
});

/* What a user who never opened the sheet has — exactly today's behaviour.
 * 5 lb is the smallest change worth making on a barbell; 2.5 kg is its
 * counterpart, being the smallest pair of plates most gyms own. The plate sets
 * are plates.js's LB_INVENTORY / KG_INVENTORY (see the canonicity note there
 * for why there is no 35). */
export const DEFAULT_WEIGHT_STEP = Object.freeze({ lbs: 5, kg: 2.5 });
export const DEFAULT_PLATES = Object.freeze({
  lbs: Object.freeze({ bar: 45, have: Object.freeze([45, 25, 10, 5, 2.5]) }),
  kg: Object.freeze({ bar: 20, have: Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25]) }),
});

// Seeded like `current`: app.js at boot and after every settings save.
let prefs = { step: { ...DEFAULT_WEIGHT_STEP }, plates: DEFAULT_PLATES };

const unitKey = (u) => (u === 'kg' ? 'kg' : 'lbs');

/**
 * Take the user's weight preferences out of a settings doc. Reads
 * `settings.weightStep` {lbs, kg} and `settings.plates` {lbs:{bar,have}, kg:{…}};
 * anything missing or not on the option lists means today's default for that
 * part only. Returns what it kept.
 */
export function setWeightPrefs(settings) {
  const s = settings || {};
  const step = {};
  const plates = {};
  for (const u of ['lbs', 'kg']) {
    const want = Number(s.weightStep && s.weightStep[u]);
    step[u] = WEIGHT_STEP_OPTIONS[u].includes(want) ? want : DEFAULT_WEIGHT_STEP[u];

    const p = s.plates && s.plates[u];
    const bar = Number(p && p.bar);
    const have = p && Array.isArray(p.have)
      ? PLATE_OPTIONS[u].filter((opt) => p.have.some((h) => Number(h) === opt))
      : null;
    plates[u] = Object.freeze({
      bar: BAR_OPTIONS[u].includes(bar) ? bar : DEFAULT_PLATES[u].bar,
      have: Object.freeze(have || [...DEFAULT_PLATES[u].have]),
    });
  }
  prefs = { step, plates: Object.freeze(plates) };
  return { weightStep: { ...step }, plates: prefs.plates };
}

/** The step for a unit — the caller names it, so this never depends on `current`. */
export function weightStepFor(unit) {
  return prefs.step[unitKey(unit)];
}

/** The user's bar and plates for a unit: { bar, have } in that unit, heaviest first. */
export function platePrefs(unit) {
  return prefs.plates[unitKey(unit)];
}

/** The stepper's step in the current unit — the user's choice, 5 lb / 2.5 kg by default. */
export function weightStep() {
  return weightStepFor(current);
}

/**
 * A weight for display, in the user's unit, without the unit on the end.
 * Kilograms keep one decimal: they are stored as pounds, so a round 60 kg is
 * 132.277 lb underneath and would otherwise come back as 60.000000000001.
 */
export function fmtWeight(lb) {
  const v = toDisplay(lb);
  const rounded = current === 'kg' ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return String(rounded);
}

/** A weight for display WITH its unit — the normal case. */
export function withUnit(lb) {
  return `${fmtWeight(lb)} ${current}`;
}

/**
 * An ESTIMATE for display: rounded to a whole number IN THE DISPLAY UNIT, then the unit.
 *
 * Added 2026-09-13 (docs/strength-accuracy-plan.md §2.7). Five screens used to do
 * `withUnit(Math.round(lb))` — round in pounds, then convert — so 210.59 lb printed as "95.7 kg"
 * where the true figure is 95.5, and the Goals screen's "unchanged to the nearest kilo" was
 * really the nearest pound. An estimate has no decimals to keep; round it where it is read.
 */
export function fmtRounded(lb) {
  return String(Math.round(toDisplay(lb)));
}
export function withUnitRounded(lb) {
  return `${fmtRounded(lb)} ${current}`;
}
