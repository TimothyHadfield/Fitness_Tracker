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
 */
export function bodySvg(levels, selected, onPick) {
  const { w, h, gap } = FIGURE;
  const id = ++seq;

  // role=group, not role=img: an img is presentational and its subtree is
  // dropped, which would hide every one of the muscle buttons below it.
  const svg = mk('svg', {
    viewBox: `0 0 ${w * 2 + gap} ${h + CAPTION_H}`,
    class: 'body-map',
    role: 'group',
    'aria-label': 'Muscle groups coloured by strength level',
  });
  const defs = mk('defs', {});
  svg.append(defs);

  for (const { view, dx, label } of [
    { view: 'front', dx: 0, label: 'Front' },
    { view: 'back', dx: w + gap, label: 'Back' },
  ]) {
    const g = mk('g', { transform: `translate(${dx} 0)` });
    const art = ART[view];

    // The paper the figure is printed on. Without it a muscle with no data
    // would be a hole in the page rather than part of a body.
    g.append(mk('path', { d: art.body }, 'body-paper'));

    for (const [muscle, d] of Object.entries(art.muscles)) {
      const info = levels.get(muscle);
      const node = mk('path', { d }, [
        'body-region',
        info ? `lv-${info.levelKey}` : 'lv-none',
      ].join(' '));
      node.dataset.muscle = muscle;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label',
        `${muscle} — ${info ? info.label : 'no benchmark recorded'}`);
      // A <title> gives a native tooltip on desktop for free, and screen
      // readers announce it.
      const t = mk('title', {});
      t.textContent = `${muscle}: ${info ? info.label : 'no data'}`;
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
