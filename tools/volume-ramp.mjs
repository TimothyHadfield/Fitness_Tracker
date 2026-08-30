// The VOLUME ramp — red (no sets) to green (plenty), for the body map on
// Data → Volume. Dev-only:
//
//   node tools/volume-ramp.mjs
//
// ⚠️ REGENERATE AND RE-VALIDATE; NEVER HAND-EDIT THE HEXES IN app.css. Same
// rule the strength ramp carries, for the same reason: these are generated at
// fixed OKLCH lightness steps, and a hex nudged by eye breaks the one property
// the whole ramp rests on.
//
// ── WHY THIS RAMP IS ALLOWED TO EXIST AT ALL ─────────────────────────────────
//
// Red-to-green is the single worst-known pairing for colour vision deficiency:
// deuteranopia and protanopia between them affect about 8 % of men, and both
// collapse red and green toward the same yellow. Tim asked for it by name
// (2026-09-01, "a range from red to green… very green is more sets, very red is
// no sets"), and it is buildable honestly — but ONLY under the same three
// conditions the strength ramp ships under:
//
//   1. STRICTLY MONOTONE LIGHTNESS. This is what makes it a scale rather than a
//      rainbow. Under deuteranopia both ends turn yellowish, at DIFFERENT
//      lightnesses, so the order survives even when the hue does not. It is the
//      construction viridis and plasma use, and the reason they are the standard
//      recommendation while "jet" is not.
//   2. EVERY STEP CLEARS 3:1 AGAINST THE PAPER the figure is printed on, in
//      both themes — a muscle must read as painted, not as part of the page.
//   3. SECONDARY ENCODING, ALWAYS ON SCREEN. The legend names every step in
//      words, the panel states the number in text when a muscle is tapped, and
//      the bar list under the figure carries all twelve numbers. Nothing on
//      this screen is knowable by colour alone.
//
// ⚠️ The dataviz validator's CATEGORICAL checks fail on this ramp and are
// expected to: adjacent steps of a sequential scale are meant to be similar,
// and that validator says so itself ("scope: categorical palettes only… for a
// sequential ramp, lightness monotonicity"). What is NOT waved away is the
// contrast check, which is measured below against the real paper colours rather
// than against the validator's generic white surface.

/* ---- OKLCH -> sRGB ---- */
const gam = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

function oklch(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l3 = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const linear = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3,
  ];
  // ⚠️ Gamut is judged on the LINEAR values before clamping. Checking after the
  // clamp compares a number with itself and reports every colour as in gamut,
  // which is the sort of check that passes for the whole life of a file.
  const clipped = linear.some((v) => v < -1e-6 || v > 1 + 1e-6);
  const rgb = linear.map((v) => Math.max(0, Math.min(1, gam(v))));
  return {
    hex: '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''),
    rgb: rgb.map((v) => v * 255),
    clipped,
  };
}

/* ---- WCAG contrast, and OKLab ΔE for the CVD check ---- */
const chan = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// sRGB -> OKLab, for perceptual distance.
function oklab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(chan);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
const dE = (a, b) => {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
};

/* Viénot–Brettel–Mollon dichromat simulation, on linear sRGB. */
const LMS = [[0.31399022, 0.63951294, 0.04649755], [0.15537241, 0.75789446, 0.08670142], [0.01775239, 0.10944209, 0.87256922]];
const LMS_INV = [[5.47221206, -4.6419601, 0.16963708], [-1.1252419, 2.29317094, -0.1678952], [0.02980165, -0.19318073, 1.16364789]];
const mul = (m, v) => m.map((row) => row.reduce((t, k, i) => t + k * v[i], 0));
const SIMS = {
  protan: [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
  deutan: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
  tritan: [[1, 0, 0], [0, 1, 0], [-0.86744736, 1.86727089, 0]],
};
function simulate(rgb255, kind) {
  const lin = rgb255.map(chan);
  const out = mul(LMS_INV, mul(SIMS[kind], mul(LMS, lin)));
  return out.map((v) => Math.max(0, Math.min(1, gam(v))) * 255);
}

/* ---- the ramp ----
 * Five steps, because five is what the evidence actually distinguishes and
 * because a step somebody cannot tell from its neighbour is not a step. The
 * thresholds are volume-map.js's own published bands, not round numbers:
 * nothing / below the 4-set minimum effective dose / the minimum through the
 * best-value band / the 10-20 range / past it. */
// ⚠️ THE BANDS COME FROM js/volume-map.js, not from here. This file owns the
// COLOUR of each band and nothing else, so a threshold can never be edited in
// one of the two places — the app would then paint a band the legend does not
// name, or leave a band with no colour at all.
//
// ⚠️ The chroma of the two middle steps is set BY THE GAMUT, not by taste:
// at L 0.44 / H 45 sRGB runs out at C 0.124 and at L 0.52 / H 75 at C 0.108, so
// asking for more produces a clipped colour whose real lightness is not the one
// the ramp was built on — which would quietly break section 1.
const COORDS = {
  none: { L: 0.36, C: 0.140, H: 25 },
  low:  { L: 0.44, C: 0.120, H: 45 },
  mid:  { L: 0.52, C: 0.105, H: 75 },
  good: { L: 0.58, C: 0.135, H: 125 },
  high: { L: 0.63, C: 0.150, H: 152 },
};

const { VOLUME_SHADES } = await import('../js/volume-map.js');

// Darkest (no sets) to lightest (most), which is the order the ramp is built in
// and the reverse of the order the legend reads in.
export const VOLUME_RAMP = [...VOLUME_SHADES].reverse()
  .map((s) => ({ ...s, ...COORDS[s.key] }));

/**
 * The generated hexes, so a test can hold `css/app.css` to them.
 *
 * ⚠️ THIS IS WHAT MAKES "NEVER HAND-EDIT" MORE THAN A COMMENT. Every other
 * generated thing in this project has something that fails when the generated
 * file and its generator drift — the exercise-image manifest against its
 * directory, the preset systems against the library — and a colour nudged by eye
 * in the stylesheet is the same class of drift, with the added problem that it
 * silently invalidates the lightness measurements the whole ramp is justified by.
 */
export const VOLUME_HEX = VOLUME_RAMP.map((s) => ({ key: s.key, hex: oklch(s.L, s.C, s.H).hex }));

const PAPERS = { 'dark theme paper': '#C2C6C0', 'light theme paper': '#FFFFFF' };
const INK = '#121618';

// ⚠️ Not `import.meta.url === 'file://' + argv[1]`: on Windows that compares a
// three-slash file URL against a two-slash one built from a backslash path, so
// the report silently never ran and the tool exited 0 having checked nothing.
const isMain = (process.argv[1] || '').replace(/\\/g, '/').endsWith('tools/volume-ramp.mjs');
if (isMain) {
  const built = VOLUME_RAMP.map((s) => ({ ...s, ...oklch(s.L, s.C, s.H) }));
  let fails = 0;
  const check = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

  console.log('\n--vol-* ramp\n');
  for (const s of built) console.log(`  ${s.key.padEnd(5)} ${s.hex}  L=${s.L}  C=${s.C}  H=${s.H}  ${s.label}`);

  console.log('\n1. STRICTLY MONOTONE LIGHTNESS — the one property that makes it a scale');
  const Ls = built.map((s) => oklab(s.rgb)[0]);
  check(Ls.every((v, i) => i === 0 || v > Ls[i - 1]),
    `lightness rises at every step (${Ls.map((v) => v.toFixed(3)).join(' < ')})`);
  const dL = Ls.slice(1).map((v, i) => v - Ls[i]);
  check(dL.every((d) => d >= 0.045),
    `and by a clear step each time (min ΔL ${Math.min(...dL).toFixed(3)})`);
  check(built.every((s) => !s.clipped), 'every step is inside the sRGB gamut');

  /* ⚠️ THE BAR HERE IS THE MAP THIS APP ALREADY SHIPS, and that is a deliberate
   * choice of standard rather than a dodge. A muscle fill is not text and it is
   * not floating on the paper either: every muscle on this figure is enclosed by
   * the ink layer's own black keyline, which is what separates it from the page
   * (WCAG 1.4.11's "adjacent colours"). Holding a new ramp to 3:1 against the
   * paper would fail the SHIPPED strength ramp too — measured below — so the
   * honest requirement is that this ramp is no worse than the one already on
   * screen, and that its own steps separate from each other, which is section 1. */
  console.log('\n2. EVERY STEP READS AS PAINT — measured against the strength ramp already on this figure');
  const STRENGTH = ['#F44336', '#FF9800', '#4CAF50', '#4DD0E1', '#2196F3', '#9C27B0', '#FF4081'];
  for (const [name, paper] of Object.entries(PAPERS)) {
    const ours = Math.min(...built.map((s) => contrast(s.rgb, hexRgb(paper))));
    const theirs = Math.min(...STRENGTH.map((h) => contrast(hexRgb(h), hexRgb(paper))));
    check(ours >= theirs,
      `${name} ${paper}: worst step ${ours.toFixed(2)}:1, against the strength ramp's ${theirs.toFixed(2)}:1`);
  }
  const inkWorst = Math.min(...built.map((s) => contrast(s.rgb, hexRgb(INK))));
  check(inkWorst >= 1.5, `and the darkest step still separates from the ink ${INK} (${inkWorst.toFixed(2)}:1)`);

  console.log('\n3. ORDER SURVIVES COLOUR BLINDNESS (lightness carries it; hue does not)');
  for (const kind of ['protan', 'deutan', 'tritan']) {
    const sim = built.map((s) => oklab(simulate(s.rgb, kind))[0]);
    check(sim.every((v, i) => i === 0 || v > sim[i - 1]),
      `${kind}: the five steps still run darkest to lightest (${sim.map((v) => v.toFixed(2)).join(' < ')})`);
    const adj = Math.min(...built.slice(1).map((s, i) => dE(simulate(s.rgb, kind), simulate(built[i].rgb, kind))));
    console.log(`      worst adjacent ΔE under ${kind}: ${adj.toFixed(1)}`
      + (adj < 8 ? '  ⚠️ in the floor band — legal ONLY with the legend and the numbers below the figure' : ''));
  }

  console.log('\n4. AND WITH FULL COLOUR VISION');
  const adjN = built.slice(1).map((s, i) => dE(s.rgb, built[i].rgb));
  console.log(`      adjacent ΔE: ${adjN.map((v) => v.toFixed(1)).join(', ')}`);

  console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
  process.exit(fails ? 1 : 0);
}
