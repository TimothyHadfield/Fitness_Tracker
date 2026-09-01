// The body diagram.
//
// The figure is the muscle-group illustration, split into two layers by
// tools/build-body-art.py and reassembled here:
//
//   FILL  one vector path per muscle group per view (js/body-art.js). Carries
//         colour and nothing else, and is the tap target.
//   INK   one greyscale image per view (img/ink-*.webp), used as an SVG
//         luminance mask over a rectangle of ink colour. Carries every keyline,
//         every fibre striation and all the shading, and is never recoloured.
//
// Painting a muscle therefore changes one path's fill and leaves the drawing's
// texture untouched, because the texture is not in the fill — it is in the mask
// sitting on top of it. Head, hands, feet and knees have ink but no fill, so
// they stay unpainted and the coloured masses read.
//
// The previous version drew the body from hand-authored cross-sections. That is
// gone; anatomy now comes from the artwork, so there is nothing here to keep in
// agreement with it.
//
// SELECTION IS NOT A REBUILD. Re-running bodySvg() on every tap would re-attach
// two mask images and flash the figure, so the SVG is built once and selection
// is an attribute — see setSelected().

import { ART, FIGURE } from './body-art.js';

const NS = 'http://www.w3.org/2000/svg';

// Room under each figure for its caption.
const CAPTION_H = 30;

// Mask ids have to be unique per document: two body maps alive at once (one
// being replaced by another) would otherwise both point at the same id.
let seq = 0;

export const MAPPED_MUSCLES = [...new Set(
  Object.values(ART).flatMap((v) => Object.keys(v.muscles)),
)];

/**
 * The drawing's own width-to-height ratio, captions included.
 *
 * ⚠️ EXPORTED SO A LAYOUT CAN BE THE SHAPE OF THE PICTURE. An SVG with a viewBox
 * fits itself inside whatever box it is given, so a box of the wrong shape does
 * not crop the figure — it SHRINKS it and pads the rest. That is what happened
 * to Data → Volume on a wide screen: a full-width, short container drew a small
 * body floating in the middle of a lot of nothing, and it was reported as "the
 * display is really small" on the same day the same figure measured LARGER than
 * the Muscles tab's on a phone. A container carrying this ratio is always
 * exactly the picture's shape, so the picture is always as big as the space.
 */
export const BODY_ASPECT = (FIGURE.w * 2 + FIGURE.gap) / (FIGURE.h + CAPTION_H);

function mk(shape, attrs, cls) {
  const n = document.createElementNS(NS, shape);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (cls) n.setAttribute('class', cls);
  return n;
}

// jsdom does not implement :focus-visible and throws on the selector, so this
// has to be asked for rather than assumed.
function keyboardFocus(node) {
  try {
    return node.matches(':focus-visible');
  } catch {
    return false;
  }
}

function markFocus(view, d) {
  const ring = view.querySelector('.body-focus');
  if (ring) ring.setAttribute('d', d);
}

/**
 * Draw both views.
 * @param {Map<string,{levelKey,label}>} levels  muscle -> level, absent = grey
 * @param {string|null} selected                 highlighted muscle
 * @param {(muscle:string)=>void} onPick
 * @param {{label?: string}} [opts]  what the whole figure is coloured BY.
 *   ⚠️ It has to be said, because since 2026-09-01 there are two of these on two
 *   different screens carrying two different meanings for the same colours —
 *   strength on Muscles, weekly sets on Volume. A figure that announced itself
 *   as "coloured by strength level" on both would be telling a screen-reader
 *   user the opposite of what the second screen shows.
 */
export function bodySvg(levels, selected, onPick, opts = {}) {
  const { w, h, gap } = FIGURE;
  const id = ++seq;

  // role=group, not role=img: an img is presentational and its subtree is
  // dropped, which would hide every one of the muscle buttons below it.
  const svg = mk('svg', {
    viewBox: `0 0 ${w * 2 + gap} ${h + CAPTION_H}`,
    class: 'body-map',
    role: 'group',
    'aria-label': opts.label || 'Muscle groups coloured by strength level',
  });
  const defs = mk('defs', {});
  svg.append(defs);

  /* THE HATCH for "trained, can't be ranked" — Core and Neck.
   *
   * ⚠️ THE ID IS PER-FIGURE (`seq`), and that is not tidiness. The compare
   * screen puts TWO of these in one document, and a duplicated def id means the
   * second figure silently resolves `url(#…)` to the first one's pattern — the
   * same class of bug the ink masks already carry a per-figure id for.
   *
   * ⚠️ THE STRIPES ARE CLASSED AND THE STYLESHEET FILLS THEM — no `fill`
   * attribute here, and not because of taste. A presentation attribute is not a
   * place `var()` can be relied on: it is mapped to a CSS declaration, but
   * substitution inside one is not supported the way it is in a rule, so
   * `fill="var(--unranked-bg)"` is the kind of thing that renders in one engine
   * and paints black in another. Classes also keep this figure's colours where
   * every other colour on it already lives — four palettes across two themes,
   * which a literal here would go stale against the moment somebody switches
   * theme without a re-render (the same trap the `--tint` note records).
   *
   * `patternUnits=userSpaceOnUse` keeps the stripe pitch constant in viewBox
   * units, so the hatch does not scale with whichever muscle it fills — Core is
   * many times the area of Neck and a proportional hatch would read as two
   * different marks.
   */
  const hatchId = `hatch-${id}`;
  const hatch = mk('pattern', {
    id: hatchId, width: 6, height: 6,
    patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)',
  });
  hatch.append(mk('rect', { width: 6, height: 6 }, 'hatch-bg'));
  hatch.append(mk('rect', { width: 2.2, height: 6 }, 'hatch-ink'));
  defs.append(hatch);
  svg.style.setProperty('--hatch', `url(#${hatchId})`);

  for (const { view, dx, label } of [
    { view: 'front', dx: 0, label: 'Front' },
    { view: 'back', dx: w + gap, label: 'Back' },
  ]) {
    const g = mk('g', { transform: `translate(${dx} 0)` });
    const art = ART[view];

    // The paper the figure is printed on. Without it a muscle with no data
    // would be a hole in the page rather than part of a body.
    g.append(mk('path', { d: art.body }, 'body-paper'));

    /* ⚠️ INVISIBLE HIT HALOS, UNDER EVERY FILL (Open work 0i, without touching
     * Tim's illustration by a single pixel). At 360px the smallest muscles
     * measure 42×11 (Traps) and 24×17 (Neck), and the figure is the only way
     * to select a muscle. Each halo is the muscle's own path with a fat
     * transparent stroke and `pointer-events: all`, so the tappable region is
     * the muscle plus ~10 screen px in every direction — and NOTHING is
     * painted.
     *
     * ⚠️ ALL HALOS COME BEFORE ALL FILLS, and that ordering is the design:
     * SVG hit-testing takes the topmost element, so a halo can only ever win
     * where no real muscle is painted. A tap on a neighbouring muscle's
     * actual body still goes to that muscle; the halo only claims the dead
     * space around its own — enlargement without theft. aria-hidden and no
     * tabindex: these are duplicate geometry, not controls, and a screen
     * reader or keyboard already has the real paths.
     */
    for (const [muscle, d] of Object.entries(art.muscles)) {
      const halo = mk('path', { d, 'aria-hidden': 'true' }, 'body-halo');
      halo.dataset.haloFor = muscle;
      halo.addEventListener('click', () => onPick(muscle));
      g.append(halo);
    }

    for (const [muscle, d] of Object.entries(art.muscles)) {
      const info = levels.get(muscle);
      /* 🚨 THREE STATES, NOT TWO (2026-09-04). `unrankable` means the work was
       * recorded and no published standard exists to place it against — Core
       * and Neck. It used to fall through to `lv-none`, which is the fill for
       * "never trained", and the legend's only grey says "No data". A hatch
       * rather than a ninth colour: this ramp is legal only because the key
       * gives it a second encoding, and hatching survives greyscale and colour
       * blindness where another hue would not. */
      const node = mk('path', { d }, [
        'body-region',
        info ? (info.unrankable ? 'lv-unranked' : `lv-${info.levelKey}`) : 'lv-none',
      ].join(' '));
      node.dataset.muscle = muscle;
      // Confidence rides on the fill as a custom property, so the CSS keeps
      // owning the colours — including the two themes' separate ramps, which a
      // colour computed in JS would go stale against the moment the theme is
      // toggled without a re-render.
      // Set twice on purpose: color-mix() wants a percentage and calc() inside
      // oklch() wants a plain number, and neither accepts the other's syntax.
      if (info && typeof info.tint === 'number') {
        node.style.setProperty('--tint', `${(info.tint * 100).toFixed(1)}%`);
        node.style.setProperty('--tint-n', info.tint.toFixed(3));
      }
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      // Confidence is stated in words as well as painted, because the fade is
      // a colour cue and this screen's rule is that nothing is colour-alone.
      const conf = info && info.confidence ? `, ${info.confidence.toLowerCase()} confidence` : '';
      /* ⚠️ THE HATCH IS NOT ALLOWED TO BE THE ONLY WAY TO TELL. A screen reader
       * gets no fill at all, so the third state has to be in the name — and
       * "nothing recorded" over work somebody did is exactly the lie the
       * colour was telling. The set count rides along because it is the
       * evidence the label is asserting. */
      const said = info
        ? (info.unrankable
          ? `${info.label}${info.sets ? `, ${info.sets} sets recorded` : ''}`
          : info.label + conf)
        : 'nothing recorded';
      node.setAttribute('aria-label', `${muscle} — ${said}`);
      // A <title> gives a native tooltip on desktop for free, and screen
      // readers announce it.
      const t = mk('title', {});
      t.textContent = `${muscle}: ${info ? said : 'no data'}`;
      node.append(t);

      node.addEventListener('click', () => onPick(muscle));
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(muscle); }
      });
      // Only for keyboard focus. A mouse click focuses the path too, and
      // showing a second ring on top of the selection ring is noise.
      node.addEventListener('focus', () => markFocus(g, keyboardFocus(node) ? d : ''));
      node.addEventListener('blur', () => markFocus(g, ''));
      g.append(node);
    }

    // The ink, over every fill. A luminance mask: white in the image shows the
    // ink colour, black hides it, so the greyscale IS the ink density.
    const maskId = `bm-ink-${view}-${id}`;
    const mask = mk('mask', {
      id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h,
    });
    mask.append(mk('image', {
      href: `img/ink-${view}.webp`, x: 0, y: 0, width: w, height: h,
    }));
    defs.append(mask);
    g.append(mk('rect', {
      x: 0, y: 0, width: w, height: h, mask: `url(#${maskId})`,
    }, 'body-ink'));

    // Selection outline rides ABOVE the ink. Drawn under it, it would land
    // exactly beneath the muscle's own black keyline and never be seen.
    g.append(mk('path', { d: '' }, 'body-pick'));
    // Keyboard focus, same trick. This replaces the browser's own focus ring,
    // which Chrome draws as a rectangle around the SVG element's BOUNDING BOX
    // and which therefore put a white box around the selected muscle.
    g.append(mk('path', { d: '' }, 'body-focus'));

    const cap = mk('text', {
      x: w / 2, y: h + CAPTION_H - 10, 'text-anchor': 'middle',
    }, 'body-caption');
    cap.textContent = label;
    g.append(cap);
    svg.append(g);
  }

  setSelected(svg, selected);
  return svg;
}

/** Move the highlight without rebuilding the figure. */
export function setSelected(svg, muscle) {
  if (muscle) svg.dataset.selected = muscle;
  else delete svg.dataset.selected;

  for (const node of svg.querySelectorAll('.body-region')) {
    node.classList.toggle('is-selected', node.dataset.muscle === muscle);
  }
  // Each view carries its own outline path; a muscle drawn in only one view
  // leaves the other view's outline empty.
  for (const pick of svg.querySelectorAll('.body-pick')) {
    const on = [...pick.parentNode.querySelectorAll('.body-region')]
      .find((n) => n.dataset.muscle === muscle);
    pick.setAttribute('d', on ? on.getAttribute('d') : '');
  }
}
