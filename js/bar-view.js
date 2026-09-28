// The Auto-guide's big bar (2026-09-27).
//
// Tim: *"For the Auto-guide, show a much larger and more detailed display of
// the bar with weights on it on both sides rather than the tiny display on the
// main screen. also annimate the plates moving on and off the bar as you
// change the weight."*
//
// The geometry is js/plates.js `barLayout()` (pure, tested); this file draws it
// as one SVG and moves the plates. `barView()` → { node, update(load) }, where
// `load` is plateLoad()'s answer, or null for a lift with no plates (hidden).
//
// ⚠️ THE ONE PLACE ON THE LOGGING PATH THAT MOVES, AND WHY (Rule 7). Tim asked
// for it by name, and it passes Rule 7's own test: a plate sliding on from the
// sleeve end says exactly what just happened to the bar. It never delays a
// number — the weight in the box changes first, instantly, as everywhere else —
// and it is quick: the `snap` spring (critically damped, no bounce, 90 % of the
// way in ~160 ms, at rest by ~300 ms). A plate that comes off while another
// goes on in the same slot leaves first; the new one waits 70 ms so the two
// never read as one. prefers-reduced-motion: spring.js lands every spring at
// once, so the plates simply swap.
//
// ⚠️ PLATES ARE KEYED BY SIDE + SLOT + DENOMINATION (`plateDiff`), so a plate
// that stays where it is keeps its element and does not re-animate; a plate
// that only shifts (a crowded sleeve thinning) slides to its new place.
//
// ⚠️ ONE FIXED BOX. The viewBox never changes, so the drawing is the same
// height at every weight and nothing under it moves when plates do.

import { barLayout, plateDiff } from './plates.js';
import { spring, reducedMotion } from './spring.js';

const NS = 'http://www.w3.org/2000/svg';
// A moved clip reappears once the plates are ~90 % of the way to their slots.
const CLIP_BACK_ON_MS = 160;
let uid = 0;

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  return n;
}

function rect(p, cls, extra = {}) {
  return svgEl('rect', { class: cls, x: p.x, y: p.y, width: p.w, height: p.h, ...extra });
}

/** The shading every instance shares: metal sheen, plate face, knurl.
 * `${id}-metal` (lit top, shadowed underneath), `${id}-face` (a plate seen
 * edge-on), `${id}-edge` (left-right shading), `${id}-knurl`.
 * 🆕 EXPORTED (overhaul design V-10) so the runner's small plate drawing
 * (`plateDrawingSvg` below) wears the same steel as this big bar: two
 * bars, one look. Appended to `svg` when one is given; returns the <defs>. */
export function metalDefs(svg, id) {
  const d = svgEl('defs');
  const metal = svgEl('linearGradient', { id: `${id}-metal`, x1: 0, y1: 0, x2: 0, y2: 1 });
  [[0, '#fff', 0.45], [0.45, '#fff', 0.05], [0.55, '#000', 0.05], [1, '#000', 0.35]].forEach(([o, c, a]) =>
    metal.appendChild(svgEl('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })));
  // A plate seen edge-on: a lit rim at the top, the face darkening towards
  // the bottom rim — enough that a stack reads as round discs, not bars.
  const face = svgEl('linearGradient', { id: `${id}-face`, x1: 0, y1: 0, x2: 0, y2: 1 });
  [[0, '#fff', 0.34], [0.07, '#fff', 0.1], [0.5, '#fff', 0], [0.93, '#000', 0.14], [1, '#000', 0.34]].forEach(([o, c, a]) =>
    face.appendChild(svgEl('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })));
  const edge = svgEl('linearGradient', { id: `${id}-edge`, x1: 0, y1: 0, x2: 1, y2: 0 });
  [[0, '#000', 0.22], [0.3, '#fff', 0.12], [0.7, '#fff', 0], [1, '#000', 0.26]].forEach(([o, c, a]) =>
    edge.appendChild(svgEl('stop', { offset: o, 'stop-color': c, 'stop-opacity': a })));
  const knurl = svgEl('pattern', { id: `${id}-knurl`, width: 3, height: 3, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  knurl.appendChild(svgEl('rect', { class: 'bv-knurl-line', x: 0, y: 0, width: 1, height: 3 }));
  d.append(metal, face, edge, knurl);
  if (svg) svg.appendChild(d);
  return d;
}

/* The runner's SMALL plate drawing: plateDrawing()'s rectangles as an SVG
 * (2026-09-26; moved here from ui.js on 2026-09-27 — plates.js stays pure, no
 * DOM). The geometry and the colour NAMES are plates.js's; the hues are the
 * stylesheet's ("Plate drawing"), so a theme can outline them. Hidden from
 * screen readers — the hint around it carries the sentence as its label.
 * 🛑 No motion: it is rebuilt on every tap of ± (Rule 7). Each plate's number
 * is drawn too (a `label` part is the box its figures fill; the baseline is
 * that box's bottom edge), and plate corners are rounded so each reads as a disc.
 * 🆕 METAL (overhaul design V-10): this file's steel, so the two bars look
 * alike. Every metal part gets a `pd-sheen` overlay (lit top, shadowed
 * underneath; a machine's frame: its edges) and every plate a `pd-face` +
 * `pd-edge` overlay. The overlays are translucent white/black — the IPF colours
 * underneath are unchanged, and so is every `pd-plate` rect the tests and CSS
 * read. */
export function plateDrawingSvg(d) {
  const id = `pd${++uid}`;
  const svg = svgEl('svg', {
    class: `plate-draw is-${d.kind}`, width: d.width, height: d.height,
    viewBox: `0 0 ${d.width} ${d.height}`, 'aria-hidden': 'true', focusable: 'false',
  });
  metalDefs(svg, id);
  const RX = { plate: null, cap: 1.5, clip: 1, collar: 1 };
  for (const p of d.parts) {
    if (p.part === 'label') {
      const cx = p.x + p.w / 2;
      const t = svgEl('text', { class: `pd-label is-${p.tone}`, 'text-anchor': 'middle', x: cx });
      if (p.place === 'along') {
        // Written bottom-to-top up the plate, centred on it.
        const cy = p.y + p.h / 2;
        t.setAttribute('y', String(Math.round((cy + p.w / 2) * 100) / 100));
        t.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      } else {
        t.setAttribute('y', String(Math.round((p.y + p.h) * 100) / 100));
      }
      t.textContent = p.text;
      svg.appendChild(t);
      continue;
    }
    const rx = p.part === 'plate' ? Math.min(3, p.w / 3) : (RX[p.part] ?? 0.75);
    if (p.part === 'plate') {
      svg.append(
        rect(p, `pd-plate pd-${p.colour}`, { rx }),
        rect(p, 'pd-face', { rx, fill: `url(#${id}-face)` }),
        rect(p, 'pd-edge', { rx, fill: `url(#${id}-edge)` }));
    } else {
      svg.append(
        rect(p, `pd-${p.part}`, { rx }),
        rect(p, 'pd-sheen', { rx, fill: `url(#${id}-${p.part === 'frame' ? 'edge' : 'metal'})` }));
    }
  }
  return svg;
}

export function barView() {
  const id = `bv${++uid}`;
  const node = document.createElement('div');
  node.className = 'guide-bar';
  node.hidden = true;
  const svg = svgEl('svg', { class: 'bar-draw', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
  metalDefs(svg, id);
  const metalG = svgEl('g', { class: 'bv-metal' });
  const platesG = svgEl('g', { class: 'bv-plates' });
  const clipsG = svgEl('g', { class: 'bv-clips' });
  svg.append(metalG, platesG, clipsG);
  node.appendChild(svg);

  let kind = null;
  /** key → { g, rect, shade, edge, text, x: spring, op: spring, leaving, layout } */
  const plates = new Map();
  const clips = new Map();

  const place = (rec) => {
    rec.g.setAttribute('transform', `translate(${rec.xNow.toFixed(2)} 0)`);
    if (rec.opNow >= 0.999) rec.g.removeAttribute('opacity');
    else rec.g.setAttribute('opacity', Math.max(0, rec.opNow).toFixed(3));
  };

  function drawMetal(L) {
    metalG.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    svg.setAttribute('class', `bar-draw is-${L.kind}`);
    for (const p of L.parts) {
      const rx = p.part === 'cap' ? 2 : p.part === 'collar' ? 1.5 : p.part === 'frame' ? 2 : p.part === 'sleeve' ? 1 : 0.5;
      if (p.part === 'knurl') { metalG.appendChild(rect(p, 'bv-knurl', { fill: `url(#${id}-knurl)` })); continue; }
      metalG.appendChild(rect(p, `bv-${p.part}`, { rx }));
      // The metal's sheen: lit on top, shadowed underneath (frame: its edges).
      metalG.appendChild(rect(p, 'bv-sheen', { rx, fill: `url(#${id}-${p.part === 'frame' ? 'edge' : 'metal'})` }));
    }
  }

  /** Geometry inside a plate's group is LOCAL: the group's translate is its x. */
  function paintPlate(rec, p) {
    const rx = Math.min(4, p.w / 3);
    for (const r of [rec.rect, rec.shade, rec.edge]) {
      r.setAttribute('x', 0); r.setAttribute('y', p.y);
      r.setAttribute('width', p.w); r.setAttribute('height', p.h);
      r.setAttribute('rx', rx);
    }
    rec.rect.setAttribute('class', `bv-plate-body pd-${p.colour}`);
    const l = p.label;
    rec.text.textContent = l ? l.text : '';
    rec.text.setAttribute('class', `bv-label is-${l ? l.tone : 'ink'}`);
    rec.text.removeAttribute('transform');
    if (l) {
      const cx = Math.round((l.x - p.x + l.w / 2) * 100) / 100;
      if (l.place === 'along') {
        const cyl = l.y + l.h / 2;
        rec.text.setAttribute('x', cx);
        rec.text.setAttribute('y', Math.round((cyl + l.w / 2) * 100) / 100);
        rec.text.setAttribute('transform', `rotate(-90 ${cx} ${cyl})`);
      } else {
        rec.text.setAttribute('x', cx);
        rec.text.setAttribute('y', Math.round((l.y + l.h) * 100) / 100);
      }
    }
    rec.layout = p;
  }

  function makePlate(p, fromX, fromOp) {
    const g = svgEl('g', { class: 'bv-plate', 'data-key': p.key });
    const rec = {
      g, xNow: fromX, opNow: fromOp, leaving: false, layout: p,
      rect: svgEl('rect'), shade: svgEl('rect', { class: 'bv-plate-face', fill: `url(#${id}-face)` }),
      edge: svgEl('rect', { class: 'bv-plate-edge', fill: `url(#${id}-edge)` }), text: svgEl('text', { 'text-anchor': 'middle' }),
    };
    g.append(rec.rect, rec.shade, rec.edge, rec.text);
    paintPlate(rec, p);
    place(rec);
    rec.x = spring({ from: fromX, to: fromX, preset: 'snap', precision: 0.2, onUpdate: (v) => { rec.xNow = v; place(rec); } });
    rec.op = spring({
      from: fromOp, to: fromOp, preset: 'snap', precision: 0.01,
      onUpdate: (v) => { rec.opNow = v; place(rec); },
      onRest: () => { if (rec.leaving) drop(rec); },
    });
    return rec;
  }

  function drop(rec) {
    if (!rec.leaving) return;
    rec.x.stop(); rec.op.stop();
    rec.g.remove();
    if (plates.get(rec.layout.key) === rec) plates.delete(rec.layout.key);
  }

  /** Aim a spring; a delay holds the plate where it is first (reduced motion: none). */
  function aim(rec, x, op, delay = 0) {
    const go = () => { rec.x.set(x); rec.op.set(op); };
    clearTimeout(rec.wait);
    if (delay > 0 && !reducedMotion()) rec.wait = setTimeout(go, delay);
    else go();
  }

  function clearAll() {
    for (const rec of plates.values()) { clearTimeout(rec.wait); rec.x.stop(); rec.op.stop(); }
    plates.clear();
    platesG.replaceChildren();
    for (const c of clips.values()) { clearTimeout(c.wait); c.op.stop(); }
    clips.clear();
    clipsG.replaceChildren();
  }

  function update(load) {
    const L = load ? barLayout(load) : null;
    if (!L) {
      node.hidden = true;
      kind = null;
      clearAll();
      return;
    }
    node.hidden = false;
    if (L.label) {
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', L.label);
      node.setAttribute('title', L.label);
    } else {
      node.removeAttribute('role');
      node.removeAttribute('aria-label');
      node.removeAttribute('title');
    }
    node.classList.toggle('is-empty', !L.label);
    // A different kind of drawing (a bar after a machine) is a new picture, not a change to this one.
    const fresh = L.kind !== kind;
    if (fresh) { clearAll(); drawMetal(L); kind = L.kind; }

    const live = [...plates.values()].filter((r) => !r.leaving).map((r) => r.layout.key);
    const diff = plateDiff(live, L.plates.map((p) => p.key));
    const sidesLosing = new Set();
    for (const k of diff.remove) {
      const rec = plates.get(k);
      rec.leaving = true;
      rec.g.classList.add('is-leaving');
      sidesLosing.add(rec.layout.side);
      aim(rec, rec.layout.offX, 0);
    }
    for (const p of L.plates) {
      let rec = plates.get(p.key);
      if (rec) {
        // Kept — or caught on its way off and brought back.
        rec.leaving = false;
        rec.g.classList.remove('is-leaving');
        paintPlate(rec, p);
        aim(rec, p.x, 1);
        continue;
      }
      if (fresh) {
        rec = makePlate(p, p.x, 1);
      } else {
        rec = makePlate(p, p.offX, 0);
        aim(rec, p.x, 1, sidesLosing.has(p.side) ? 70 : 0);
      }
      plates.set(p.key, rec);
      // Heaviest nearest the collar first in the DOM, so an arriving plate
      // passes OVER the ones it slides past rather than under them.
      platesG.appendChild(rec.g);
    }

    // The clips sit outside the outermost plate. A clip does not slide through
    // plates: when its place changes it comes OFF (gone at once) and goes back
    // ON at the new place once the plates have arrived — the order a lifter
    // does it in. Reduced motion: it is simply there.
    const want = new Map(L.clips.map((c) => [c.key, c]));
    for (const [k, c] of clips) {
      if (!want.has(k)) { clearTimeout(c.wait); c.op.stop(); c.el.remove(); clips.delete(k); }
    }
    for (const c of L.clips) {
      let rec = clips.get(c.key);
      const isNew = !rec;
      if (isNew) {
        const el = svgEl('g', { class: 'bv-clip' });
        el.append(rect({ ...c, x: 0 }, 'bv-clip-body', { rx: 1.5 }), rect({ ...c, x: 0 }, 'bv-sheen', { rx: 1.5, fill: `url(#${id}-metal)` }));
        rec = { el, x: null };
        rec.op = spring({
          from: 1, to: 1, preset: 'snap', precision: 0.01,
          onUpdate: (v) => { if (v >= 0.999) el.removeAttribute('opacity'); else el.setAttribute('opacity', Math.max(0, v).toFixed(3)); },
        });
        clips.set(c.key, rec);
        clipsG.appendChild(el);
      }
      if (rec.x !== null && Math.abs(rec.x - c.x) < 0.25) continue;
      rec.el.setAttribute('transform', `translate(${c.x} 0)`);
      const moved = !isNew || !fresh;
      rec.x = c.x;
      clearTimeout(rec.wait);
      if (moved && !reducedMotion()) {
        rec.op.stop();
        rec.el.setAttribute('opacity', '0');
        rec.wait = setTimeout(() => { rec.op = spring({
          from: 0, to: 1, preset: 'snap', precision: 0.01,
          onUpdate: (v) => { if (v >= 0.999) rec.el.removeAttribute('opacity'); else rec.el.setAttribute('opacity', Math.max(0, v).toFixed(3)); },
        }); }, CLIP_BACK_ON_MS);
      }
    }
  }

  return { node, update };
}
