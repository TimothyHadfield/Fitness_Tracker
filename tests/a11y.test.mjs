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

/* ---------- the colour palettes (Tim's pick of all three, 2026-08-26) ---------- */

// Each palette is bare :root plus its dark block, or bare :root plus the
// light block plus its light block — exactly how the cascade composes them.
// Every palette runs the SAME checks the default has always had. A palette
// that ships without appearing here is a palette nobody is watching.
{
  const paletteBlock = (name, light) => block(new RegExp(
    `:root\\[data-palette="${name}"\\]${light ? '\\[data-theme="light"\\]' : ''}\\s*\\{([\\s\\S]*?)\\n\\}`));

  const PALETTES = ['teal', 'indigo', 'ember'];
  const combos = [];
  for (const p of PALETTES) {
    const pd = paletteBlock(p, false);
    const pl = paletteBlock(p, true);
    ok(Object.keys(pd).length > 0 && Object.keys(pl).length > 0,
       `the ${p} palette defines both a dark and a light block`);
    // ⚠️ The dark-palette and plain-light selectors TIE on specificity, so any
    // token in one block and not the other resolves by source order — a bug
    // that only shows in one theme. Equal key sets make order irrelevant.
    const kd = Object.keys(pd).sort().join(); const kl = Object.keys(pl).sort().join();
    ok(kd === kl,
       `${p}: its dark and light blocks touch the SAME tokens, so cascade order can never decide a colour`);
    combos.push([`${p} dark`, { ...dark, ...pd }], [`${p} light`, { ...dark, ...lightOnly, ...pl }]);
  }

  for (const [name, pal] of combos) {
    // The text scale on every surface.
    for (const t of TEXT) {
      let worst = Infinity, worstOn = '';
      for (const s of SURFACES) {
        const r = contrast(pal[t], pal[s]);
        if (r < worst) { worst = r; worstOn = s; }
      }
      ok(worst >= AA, `${name}: --${t} clears AA on every surface — worst ${worst}:1 on --${worstOn}`);
    }
    // The hierarchy stays a scale.
    const [a, b, c] = TEXT.map((t) => contrast(pal[t], pal.ground));
    ok(a > b && b > c && a - b >= 1.2 && b - c >= 1.2,
       `${name}: the three text levels stay strictly ordered and visibly separated (${a} > ${b} > ${c})`);
    // The accent pairs that decide whether buttons and links are readable.
    ok(contrast(pal.accent, pal.ground) >= AA && contrast(pal.accent, pal.surface) >= AA,
       `${name}: --accent is legal as text on ground and surface (${contrast(pal.accent, pal.ground)}, ${contrast(pal.accent, pal.surface)})`);
    ok(contrast(pal['accent-ink'], pal.accent) >= AA,
       `${name}: --accent-ink reads on a filled accent button (${contrast(pal['accent-ink'], pal.accent)})`);
    ok(contrast(pal.good, pal.ground) >= AA && contrast(pal.danger, pal.ground) >= AA,
       `${name}: --good and --danger both read on the ground`);
  }

  // The dark/light weight parity, per palette — a caption must not read as an
  // aside in one theme and as body text in the other.
  for (const p of PALETTES) {
    const d = { ...dark, ...paletteBlock(p, false) };
    const l = { ...dark, ...lightOnly, ...paletteBlock(p, true) };
    for (const t of TEXT) {
      const dd = contrast(d[t], d.ground); const ll = contrast(l[t], l.ground);
      ok(Math.abs(dd - ll) <= 1.2,
         `${p}: --${t} reads at the same weight in both themes (${dd} dark vs ${ll} light)`);
    }
  }

  // The Start pill's scoped light fix, once per palette: small bold text on
  // that palette's own light --raised, the worst surface it sits on.
  const pill = {
    teal: '#0C6357', indigo: '#3A46B4', ember: '#7E550B',
  };
  for (const [p, hex] of Object.entries(pill)) {
    ok(new RegExp(`:root\\[data-theme="light"\\]\\[data-palette="${p}"\\] \\.row-start`).test(CSS),
       `${p}: the light Start pill has its own scoped colour, like the default's #8B5E0D`);
    const raised = paletteBlock(p, true).raised;
    ok(contrast(hex, raised) >= AA,
       `${p}: and it clears AA on that palette's own light --raised (${contrast(hex, raised)}:1 on ${raised})`);
  }
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

/* ⚠️ AND THE SAME TRICK ON THE SESSION'S ACTION PILLS (2026-08-31). Tim asked
   for Swap and Remove to "stand out just like the +add set button", which is a
   32px-tall pill — 12px short of the target the rest of this app is held to. A
   request about how loud a control LOOKS is not permission to shrink what a
   thumb has to hit, so they paint at 32 and hit at 44 the way the icon buttons
   have since the first audit. This is the assertion that notices if a later
   edit "simplifies" the pseudo-element away. */
ok(/\.pill-action::before[^{]*\{[\s\S]*?height:\s*44px/.test(CSS),
   'the session\'s Swap / Remove / Exercises pills paint at 32px and hit at 44px');
ok(/\.pill-action\s*\{[\s\S]*?border-radius:\s*999px[\s\S]*?background:\s*var\(--raised\)/.test(CSS),
   '⚠️ and they wear .add-set\'s own shape — raised pill, fully rounded — which is what '
   + '"stand out just like the +add set button" asked for');

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
