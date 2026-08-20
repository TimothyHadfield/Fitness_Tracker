// Headless accessibility regression tests. No dependencies.
//   node tests/a11y.test.mjs
//
// ⚠️ WHY THIS FILE EXISTS. Until 2026-08-20 this project had never been audited
// for accessibility, at all — progress.md said so in capitals for weeks. When it
// finally was, `--ink-faint` turned out to fail WCAG AA in both themes on all 28
// of the classes that use it, including `.field-help` and `.req-source`: the
// caveats and the citations, which is to say the load-bearing honesty this whole
// app is built on. The audit that found it drove a real browser over 44
// screen/width/theme combinations, which is the only way to measure the colour
// actually PAINTED behind an element.
//
// ⚠️ THIS FILE IS NOT THAT AUDIT AND CANNOT REPLACE IT. What it does is pin the
// palette, which is where that bug actually lived: it reads the tokens straight
// out of css/app.css and checks every text colour against every surface colour
// it could be painted on. A browser is still the only thing that knows which
// pairs really occur — but a token pair that fails here fails everywhere it is
// used, and that is exactly the class of regression a stylesheet edit causes.
//
// The one thing it must never become is a test that passes because it stopped
// looking. Every assertion below names the tokens it compared.

import { readFileSync } from 'node:fs';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const CSS = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

/* ---------- WCAG 2.1 relative luminance and contrast ---------- */

const chan = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

// Sanity: the formula itself, against the two ratios everybody knows.
ok(contrast('#000000', '#FFFFFF') === 21, 'black on white is 21:1 — the contrast maths is right');
ok(contrast('#777777', '#FFFFFF') >= 4.47 && contrast('#777777', '#FFFFFF') <= 4.5,
   'and mid grey on white is the ~4.48 that sits just under AA, so the scale is not inverted');

/* ---------- read the two palettes out of the stylesheet ---------- */

// Bare :root is DARK in this sheet; :root[data-theme="light"] overrides it.
const block = (re) => {
  const m = CSS.match(re);
  if (!m) return {};
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[k] = v.toUpperCase();
  return out;
};
const dark = block(/:root\s*\{([\s\S]*?)\n\}/);
const lightOnly = block(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
const light = { ...dark, ...lightOnly };

ok(dark.ground && dark.ink && dark['ink-soft'] && dark['ink-faint'],
   'the dark palette parses out of css/app.css');
ok(lightOnly.ground && lightOnly.ink && lightOnly['ink-soft'] && lightOnly['ink-faint'],
   'and the light theme overrides all four text/ground tokens rather than inheriting some');

/* ---------- the rule that was broken ---------- */

// ⚠️ EVERY TEXT TOKEN AGAINST EVERY SURFACE IT CAN LAND ON. --rule-soft is in
// this list and is the reason it is not shorter: a calendar cell paints on it,
// it is the darkest surface in the light theme and the lightest in the dark one,
// and it was the last thing still failing after the palette was fixed.
const SURFACES = ['ground', 'surface', 'raised', 'rule-soft'];
const TEXT = ['ink', 'ink-soft', 'ink-faint'];
const AA = 4.5;   // WCAG 1.4.3, text under 18.66px. Every use of these is under it.

for (const [name, pal] of [['dark', dark], ['light', light]]) {
  for (const t of TEXT) {
    let worst = Infinity, worstOn = '';
    for (const s of SURFACES) {
      const r = contrast(pal[t], pal[s]);
      if (r < worst) { worst = r; worstOn = s; }
    }
    ok(worst >= AA,
       `${name}: --${t} clears AA on every surface — worst is ${worst}:1 on --${worstOn} `
       + `(${pal[t]} on ${pal[worstOn]})`);
  }
}

/* ---------- and the hierarchy the fix had to preserve ---------- */

// ⚠️ VACUITY GUARD, and it is the assertion that stops somebody "fixing" a future
// failure by setting all three tokens to the same colour. Three levels that all
// pass AA but are indistinguishable would satisfy every check above.
for (const [name, pal] of [['dark', dark], ['light', light]]) {
  const [a, b, c] = TEXT.map((t) => contrast(pal[t], pal.ground));
  ok(a > b && b > c,
     `${name}: the three text levels are strictly ordered against --ground `
     + `(${a} > ${b} > ${c}) — a scale, not three names for one grey`);
  ok(b - c >= 1.2 && a - b >= 1.2,
     `${name}: and separated by at least 1.2 at each step, so the hierarchy is visible`);
}

// The two themes should not disagree about how quiet "quiet" is — a caption that
// reads as an aside in dark and as body text in light is the same bug the
// strength ramp's monotone-lightness rule exists to prevent.
for (const t of TEXT) {
  const d = contrast(dark[t], dark.ground);
  const l = contrast(light[t], light.ground);
  ok(Math.abs(d - l) <= 1.0,
     `--${t} reads at the same weight in both themes (${d} dark vs ${l} light)`);
}

/* ---------- the accent is not asked to carry text it cannot ---------- */

// ⚠️ The last AA failure the audit found was the calendar's TODAY number, which
// switched to --accent and measured 3.94:1 in the light theme. It was invisible
// to every other check because it appears on exactly one cell in the month.
// Nothing was lost by moving it to --ink: the cell already has an accent ring
// and the number is already weight 800, so "today" was never said by colour
// alone — which is Design Rule 5's general form.
ok(!/\.cal-cell\.today \.cal-day \{[^}]*color:\s*var\(--accent\)/.test(CSS),
   '⚠️ the calendar\'s today number does NOT take --accent as small text — it failed AA in the '
   + 'light theme, and the ring plus the weight already say "today" without colour');
ok(/\.cal-cell\.today \{[^}]*--accent/.test(CSS),
   'while the cell keeps its accent ring, so the cue itself is untouched');

/* ---------- hit areas are grown, not painted ---------- */

// ⚠️ ::before, and the comment in the stylesheet says why: .avatar-btn's ::after
// is the "not backed up" dot, .avatar-btn.at-risk::after wins on specificity,
// and an ::after hit area silently vanished in exactly the state the audit had
// caught it in. This assertion is here because that failure is invisible — the
// dot still renders and the button still works.
ok(/\.icon-btn::before[^{]*\{[\s\S]*?height:\s*44px/.test(CSS),
   'the icon button\'s touch area is grown to 44px with a pseudo-element');
ok(!/\.icon-btn::after,\s*\.avatar-btn::after/.test(CSS),
   '⚠️ and NOT with ::after, which .avatar-btn.at-risk already owns for the backup dot');
ok(/\.avatar-btn\.at-risk::after/.test(CSS), 'and that dot is still there');

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
