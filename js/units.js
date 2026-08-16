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
// app.js seeds it at boot and Settings updates it on change.

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

// 5 lb is the smallest change worth making on a barbell; 2.5 kg is its
// counterpart, being the smallest pair of plates most gyms own.
export function weightStep() {
  return current === 'kg' ? 2.5 : 5;
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
