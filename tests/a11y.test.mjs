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

  /* ---------- the PER SIDE chip's scoped light fix (2026-09-06) ----------
   *
   * 🚨 THE BROWSER AUDIT FOUND THIS ONE AND THIS FILE COULD NOT HAVE. The 9px
   * "PER SIDE" badge inherited `--accent` on `--accent-dim` and measured
   * **3.96:1 in gold light** — the only failing pair of 128 routes, on the
   * session runner's swap and exercises sheets. The token test missed it for a
   * structural reason worth keeping: it walks tokens out of `:root` blocks, and
   * `--accent` on `--accent-dim` is a pair no `:root` rule declares — it only
   * exists because one CLASS puts one on the other.
   *
   * ⚠️ AND THE FIX IS SCOPED TO THE DEFAULT PALETTE, WHICH IS THE TRAP. Gold is
   * the palette with no `data-palette` attribute, and the three named palettes
   * already clear AA on this pair (4.56–5.02). A rule written without
   * `:not([data-palette])` would paint gold's hex over teal, indigo and ember —
   * breaking three that passed in order to fix one. That is why this asserts the
   * SELECTOR as well as the number. */
  ok(/:root\[data-theme="light"\]:not\(\[data-palette\]\) \.load-badge\.per-side/.test(CSS),
     '⚠️ the PER SIDE chip has a light fix scoped to the DEFAULT palette only — an unscoped one '
     + 'would repaint three palettes that already pass');
  const perSide = (CSS.match(/:root\[data-theme="light"\]:not\(\[data-palette\]\) \.load-badge\.per-side\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  ok(Boolean(perSide) && contrast(perSide, lightOnly['accent-dim'] || light['accent-dim']) >= AA,
     `🚨 and it clears AA on the chip's own fill (${perSide} on --accent-dim = `
     + `${contrast(perSide, lightOnly['accent-dim'] || light['accent-dim'])}:1) — this is the `
     + 'assertion that stops the audit having to find it a second time');
  for (const p of PALETTES) {
    const pal = { ...dark, ...lightOnly, ...paletteBlock(p, true) };
    ok(contrast(pal.accent, pal['accent-dim']) >= AA,
       `${p}: and the un-overridden chip still reads on its own fill in light `
       + `(${contrast(pal.accent, pal['accent-dim'])}:1) — the vacuity guard, because the fix above `
       + 'only covers the default palette and the other three have to pass on their own');
  }

  /* ---------- EVERY OTHER ELEMENT PAINTING THE SAME PAIR (2026-09-10) ----------
   *
   * 🚨 THE PAIR IS A PROPERTY OF THE TWO TOKENS, NOT OF ONE CLASS, AND THAT IS
   * WHAT THE 2026-09-06 FIX GOT WRONG. It scoped itself to `.load-badge.per-side`
   * because at phone width that was the only element the audit could reach. The
   * desktop sweep added on 2026-09-10 found the nav label immediately, and
   * reading the stylesheet for the pair — rather than waiting for an instrument
   * to trip over it — found three more. "Every element that paints this today"
   * means "every element the tool I happened to run can see".
   *
   * ⚠️ NONE OF THE THREE IS LARGE TEXT under WCAG (`.bench-badge` is 9.5px/800;
   * the other two are small controls), so 4.5:1 is the bar for all of them. */
  for (const sel of ['\\.bench-badge', '\\.btn\\.primary\\.is-linked', '\\.set-type\\.is-on']) {
    const re = new RegExp(`:root\\[data-theme="light"\\]:not\\(\\[data-palette\\]\\) ${sel}`);
    ok(re.test(CSS),
       `⚠️ ${sel.replace(/\\\\/g, '')} carries the same default-palette-only light fix — it paints `
       + '--accent on --accent-dim exactly as the PER SIDE chip does');
  }
  /* 🔒 And the number, read out of the rule those three share, so the group
     cannot drift from the chip above it. Anchored on `.set-type.is-on` because
     it is the last selector in the list and therefore the one sitting against
     the declaration block. */
  const groupHex = (CSS.match(/:root\[data-theme="light"\]:not\(\[data-palette\]\) \.set-type\.is-on\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  ok(Boolean(groupHex) && contrast(groupHex, lightOnly['accent-dim'] || light['accent-dim']) >= AA,
     `🚨 and the group clears AA on the same fill (${groupHex} on --accent-dim = `
     + `${groupHex ? contrast(groupHex, lightOnly['accent-dim'] || light['accent-dim']) : 'no rule found'}:1)`);

  /* ---------- the DESKTOP SIDEBAR's active label (2026-09-02) ----------
   *
   * 🚨 THE SAME PAIR, THE SECOND ELEMENT, AND A DESKTOP-ONLY BROWSER SWEEP IS
   * WHAT FOUND IT. `@media (min-width: 860px)` puts `--accent-dim` behind the
   * active nav link, so its `--accent` label measures the same 3.96:1 in gold
   * light. On a phone that label sits on the plain navbar surface (4.99:1), so
   * every audit this project ran before 2026-09-02 — all of them phone-width —
   * structurally could not see it.
   *
   * ⚠️ This file could not have caught it either, for the reason the PER SIDE
   * block above gives: `--accent` on `--accent-dim` is a pair no `:root` rule
   * declares. It exists only because one class puts one token on the other, so
   * it has to be asserted by name, twice now.
   *
   * The assertion is on the SELECTOR as well as the number, again: an unscoped
   * light rule would repaint teal, indigo and ember, which pass already. */
  ok(/:root\[data-theme="light"\]:not\(\[data-palette\]\) \.navbar a\[aria-current="page"\]/.test(CSS),
     '⚠️ the desktop sidebar\'s ACTIVE nav label has a light fix scoped to the DEFAULT palette only '
     + '— it is --accent on --accent-dim there, the same failing pair as the PER SIDE chip');
  const navActive = (CSS.match(
    /:root\[data-theme="light"\]:not\(\[data-palette\]\) \.navbar a\[aria-current="page"\]\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/,
  ) || [])[1];
  ok(Boolean(navActive) && contrast(navActive, light['accent-dim']) >= AA,
     `🚨 and it clears AA on the pill behind it (${navActive} on --accent-dim = `
     + `${navActive ? contrast(navActive, light['accent-dim']) : 'n/a'}:1) — the desktop sweep `
     + 'measured the un-fixed pair at 3.96:1');
  // The vacuity guard: the thing being fixed really is broken without the fix.
  ok(contrast(light.accent, light['accent-dim']) < AA,
     `and the guard that keeps both of the above meaningful — bare --accent on --accent-dim in gold `
     + `light is ${contrast(light.accent, light['accent-dim'])}:1, which is why a scoped override is needed at all`);
  // 🚨 The pill is painted ONLY on desktop. If that ever moves to the phone
  // navbar, the label needs the fix at every width and this scoping is wrong.
  ok(/@media \(min-width: 860px\)[\s\S]*?\.navbar a\[aria-current="page"\] \{ background: var\(--accent-dim\); \}/.test(CSS),
     'and the --accent-dim pill behind that label is still desktop-only, which is what the '
     + 'measurement above assumed');
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

/* ================================================================== *
 * MOTION — 2026-09-01
 *
 * ⚠️ THE REDUCED-MOTION SWITCH IS AN ACCESSIBILITY GUARANTEE, NOT A NICETY, and
 * it is exactly the kind of blanket rule that survives being deleted for weeks
 * before anybody notices. Vestibular disorders make sliding panels genuinely
 * unpleasant, and this is an app somebody may be using while already moving.
 * The browser audit cannot catch its removal either — it never sets the media
 * query — so this is the only thing standing over it.
 * ================================================================== */
{
  const rm = CSS.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
  ok(Boolean(rm), 'the reduced-motion block is still there');
  ok(Boolean(rm) && /animation-duration:\s*\.?0*1?ms\s*!important/.test(rm[0])
    && /transition-duration:\s*\.?0*1?ms\s*!important/.test(rm[0]),
     '⚠️ and it kills BOTH animations and transitions, with !important — either one left alive '
     + 'is a screen that still moves for somebody who asked it not to');
  ok(Boolean(rm) && /\*,\s*\*::before,\s*\*::after/.test(rm[0]),
     'and it is a blanket over every element, so motion added later is covered without being remembered');

  // ⚠️ "Keep it quick" is a number, so it is checkable. Tim asked twice.
  const durations = [...CSS.matchAll(/--t(?:-fast|-slow)?:\s*(\d+)ms/g)].map((m) => Number(m[1]));
  ok(durations.length === 3, `three motion durations are defined (${durations.join(', ')}ms)`);
  ok(durations.every((d) => d <= 250),
     `⚠️ and none of them is over a quarter of a second (${Math.max(...durations)}ms) — "keep it quick, `
     + 'I don\'t want it to be distracting or slow"');

  /* 🚨 THE SLIDING PILL IS AN ENHANCEMENT AND THE PAINTED ONE IS THE FLOOR. The
     indicator is drawn by JS; if that never runs — an old engine, a thrown
     module, a test harness — this rule is the only thing telling anybody which
     segment they are on. Deleting it would leave the Data tab with no visible
     selection at all in exactly the situations nobody tests. */
  ok(/\.seg\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--ground\)/.test(CSS),
     '🚨 the segmented control still paints its own selected pill without JS');
  ok(/\.segmented\.has-ind\s+\.seg\[aria-selected="true"\]\s*\{[^}]*background:\s*none/.test(CSS),
     'and only stops when the sliding indicator has actually been wired, so there is never neither and never both');

  // A sheet on its way out is renamed rather than deleted, so the layout rules
  // have to answer to both names or it would collapse mid-exit.
  ok(/\.sheet,\s*\n\.sheet-x \{/.test(CSS) && /\.sheet-backdrop,\s*\n\.sheet-backdrop-x \{/.test(CSS),
     'a closing sheet still looks like a sheet — the layout rules carry both names');
}

/* ================================================================== *
 * THE VOLUME RAMP — red to green, 2026-09-01
 *
 * 🚨 THE RISKIEST COLOUR DECISION THIS APP HAS MADE. Tim asked for red-to-green
 * by name, and it is the worst-known pairing for colour vision deficiency —
 * roughly 8 % of men. It is defensible only because of what `tools/volume-ramp.mjs`
 * measures: strictly monotone lightness, holding under protanopia, deuteranopia
 * and tritanopia, so the ORDER survives even where the hue does not.
 *
 * ⚠️ A HEX NUDGED BY EYE IN THE STYLESHEET WOULD SILENTLY INVALIDATE ALL OF IT
 * — that is what this block is for. It regenerates the ramp from the same OKLCH
 * coordinates the tool validated and requires the stylesheet to still be showing
 * exactly those colours.
 * ================================================================== */
{
  const { VOLUME_HEX } = await import('../tools/volume-ramp.mjs');
  const { VOLUME_SHADES } = await import('../js/volume-map.js');

  ok(VOLUME_HEX.length === VOLUME_SHADES.length,
     `every band has a colour and every colour a band (${VOLUME_HEX.length})`);
  for (const { key, hex } of VOLUME_HEX) {
    ok(new RegExp(`--vol-${key}:\\s*${hex};`, 'i').test(CSS),
       `--vol-${key} is still the generated ${hex}`);
  }
  // And the map has a fill rule for each, or a band would paint as nothing.
  ok(VOLUME_HEX.every(({ key }) => new RegExp(`\\.body-region\\.lv-vol-${key}\\s*\\{`).test(CSS)),
     'and each one is wired to the body map');
}

/* ================================================================== *
 * NO SCROLLING SURFACE LEAVES AN AXIS TO THE BROWSER (2026-09-02)
 *
 * 🚨 THE BUG THIS PINS WAS NEVER WRITTEN DOWN BY ANYBODY. Tim: *"when the user
 * scrolls, it allows the user to drag the screen left and right which covers up
 * a lot of stuff and doesn't show anything new."* `.pane-scroll` set only
 * `overflow-y: auto` — and CSS says that when one axis is a non-`visible`
 * overflow value and the other is left `visible`, the `visible` one computes to
 * `auto`. So every pane in the app had been horizontally draggable since it was
 * written, and a browser drag confirmed it: 3px of bleed on Data → Volume,
 * Research, Goals, Settings and a friend's workout at 360 and 390px.
 *
 * ⚠️ AND `scrollWidth > clientWidth` CANNOT BE THE ASSERTION. A clipped box
 * still reports content wider than itself and is still scrollable from script;
 * what `hidden` removes is the USER's ability to drag it. That is a fact about
 * input, which only a browser can measure. What a stylesheet CAN be held to is
 * the property underneath it: **a rule that sets one overflow axis states the
 * other**, so the browser is never left to choose.
 *
 * 🔒 The four names below are the deliberate horizontal scrollers — content
 * genuinely wider than its box, reachable only by dragging. They are allowed to
 * set `overflow-x` alone. Adding a fifth name here is a claim that something is
 * really wider than the screen; adding one to silence this test is how the
 * sixth Data segment became unreachable on 2026-09-08.
 * ================================================================== */
{
  const H_SCROLLERS = ['.segmented', '.research-scroll', '.chips-scroll', '.people-bar'];

  // Comments stripped first: this sheet quotes `overflow-x: auto` in prose all
  // over the place, including in the block that explains this very bug.
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  /* ⚠️ PER SELECTOR, NOT PER RULE, and the difference matters. The browser
     resolves overflow from the whole cascade, so a sheet that declares
     `overflow-y` on a box in one rule and `overflow-x` on it in another is
     CORRECT — and a per-rule test would call it broken and push the fix into a
     shape nobody chose for a reason. Selector lists are split on commas so a
     grouped rule counts for each of its selectors.
     The one approximation: declarations are unioned across media queries. Only
     `.navbar` is written in two contexts and it states both axes in the same
     block, so nothing here relies on it. */
  const axes = new Map();
  let blocks = 0;
  for (const [, sels, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/overflow(-x|-y)?\s*:/.test(body)) continue;
    blocks++;
    for (const s of sels.split(',')) {
      const sel = s.trim().replace(/\s+/g, ' ');
      if (!sel || sel.startsWith('@') || /^(from|to|\d+%)$/.test(sel)) continue;
      const a = axes.get(sel) || { x: false, y: false, sel };
      if (/overflow-x\s*:/.test(body)) a.x = true;
      if (/overflow-y\s*:/.test(body)) a.y = true;
      if (/(^|[;{\s])overflow\s*:/.test(body)) { a.x = true; a.y = true; }
      axes.set(sel, a);
    }
  }

  ok(blocks >= 20 && axes.size >= 20,
     `the overflow rules parse out of css/app.css (${blocks} blocks, ${axes.size} selectors) — a `
     + 'parser that matched nothing would make every assertion below vacuous');

  const named = (list) => list.map((a) => a.sel).join(', ');

  const yOnly = [...axes.values()].filter((a) => a.y && !a.x);
  ok(yOnly.length === 0,
     '🚨 every selector that sets overflow-y also states overflow-x — otherwise the browser '
     + `computes the free axis to auto and the surface drags sideways${yOnly.length ? ': ' + named(yOnly) : ''}`);

  const xOnly = [...axes.values()].filter((a) => a.x && !a.y
    && !H_SCROLLERS.some((h) => a.sel.includes(h)));
  ok(xOnly.length === 0,
     'and the same in the other direction, everywhere but the four deliberate horizontal '
     + `scrollers — an unstated Y axis invents a vertical scroller just as readily${xOnly.length ? ': ' + named(xOnly) : ''}`);

  // ⚠️ THE VACUITY GUARD, and it is the point of the whole block: the four
  // scrollers must still BE scrollers. A sweep that "fixed" this test by
  // clipping them would put real data where no gesture can reach it.
  for (const h of H_SCROLLERS) {
    ok(new RegExp(`\\${h}[^{}]*\\{[^}]*overflow-x:\\s*auto`).test(bare),
       `${h} still keeps its own overflow-x: auto — it is wider than its box on purpose`);
  }
  // And the one whose scroller was inert until 2026-09-10, because a flex child
  // will not shrink below its content without this.
  ok(/\.research-scroll\s*\{[^}]*min-width:\s*0/.test(bare),
     '⚠️ and .research-scroll still carries min-width: 0, which is what makes its overflow-x '
     + 'do anything at all inside a column flex container');
}

/* ============ the set lock and the free-following drag — the CSS half (2026-09-12) ============
 *
 * The behaviour is in tests/render.test.mjs; this pins the stylesheet half that
 * jsdom cannot see. The lock's keyframes must run on the shared tokens (the
 * duration check above already caps them), the row under a finger must carry NO
 * transition — a transition between where the finger was and where it is now is
 * the lag Tim reported — and an idle padlock must keep its width so delete stays
 * in one column down the list. */
{
  ok(/\.reorder-row\s*\{[^}]*transition:\s*transform var\(--t\)/.test(CSS),
     '🔄 the reorder rows transition their transform, so the rows a drag passes slide out of its way');
  ok(/\.reorder-row\.is-dragging\s*\{\s*transition:\s*none/.test(CSS),
     '🚨 and the row under the finger has NO transition — a transition between where the finger was '
     + 'and where it is now is lag, which is the thing Tim reported');
  ok(!/\.reorder-row \.move-btns/.test(CSS), 'the runner\'s ▲▼ rules are gone with the buttons');
  ok(/\.move-btns\s*\{/.test(CSS), '⚠️ while the builder\'s .move-btns is untouched');
  ok(/@keyframes lock-shut/.test(CSS) && /@keyframes lock-open/.test(CSS),
     'the padlock has a closing and an opening keyframe');
  ok(/\.set-lock\.lock-shuts \.lock-shackle\s*\{\s*animation:\s*lock-shut var\(--t\) var\(--ease-both\)/.test(CSS),
     '⚠️ and it runs on the shared --t with --ease-both — an object with weight, under the 250ms cap the '
     + 'duration check above already pins');
  ok(/\.set-lock\.is-idle\s*\{[^}]*visibility:\s*hidden/.test(CSS) && !/\.set-lock\.is-idle\s*\{[^}]*display:\s*none/.test(CSS),
     '⚠️ an idle padlock is `visibility: hidden`, never `display: none` — the slot keeps its width so '
     + 'delete stays in one column down the list');
  ok(/\.set-lock::before\s*\{[^}]*width:\s*44px;\s*height:\s*44px/.test(CSS),
     'the padlock has the 44px hit halo the icon buttons carry');
}

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
