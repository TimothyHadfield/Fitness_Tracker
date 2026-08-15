// The body diagram.
//
// Hand-authored rather than traced from a reference: the image Tim shared is a
// watermarked Dreamstime stock illustration (ID 142535635, © Vectorville) and
// using it would be both infringement and someone else's visual identity.
//
// Deliberately a simplified, stylised figure — recognisable and, more
// importantly, made of regions big enough to tap accurately on a phone. An
// anatomically faithful drawing would have slivers nobody can hit.
//
// Coordinate space is 120 × 300 per figure; the two views sit side by side in
// one SVG so they scale together.

const NS = 'http://www.w3.org/2000/svg';

// Outline pieces carry no muscle and are never coloured — they exist so the
// figure reads as a body rather than a scatter of blobs.
const OUTLINE = [
  // front
  { view: 'front', shape: 'circle', attrs: { cx: 60, cy: 24, r: 15 } },
  { view: 'front', shape: 'rect', attrs: { x: 53, y: 36, width: 14, height: 10 } },
  { view: 'front', shape: 'path', attrs: { d: 'M35 236 Q34 262 33 282 L47 282 Q47 260 47 236 Z' } },
  { view: 'front', shape: 'path', attrs: { d: 'M85 236 Q86 262 87 282 L73 282 Q73 260 73 236 Z' } },
  { view: 'front', shape: 'path', attrs: { d: 'M12 168 Q10 186 9 200 L21 200 Q22 184 23 168 Z' } },
  { view: 'front', shape: 'path', attrs: { d: 'M108 168 Q110 186 111 200 L99 200 Q98 184 97 168 Z' } },
  // back
  { view: 'back', shape: 'circle', attrs: { cx: 60, cy: 24, r: 15 } },
  { view: 'back', shape: 'rect', attrs: { x: 53, y: 36, width: 14, height: 10 } },
  { view: 'back', shape: 'path', attrs: { d: 'M35 236 Q34 262 33 282 L47 282 Q47 260 47 236 Z' } },
  { view: 'back', shape: 'path', attrs: { d: 'M85 236 Q86 262 87 282 L73 282 Q73 260 73 236 Z' } },
  { view: 'back', shape: 'path', attrs: { d: 'M12 168 Q10 186 9 200 L21 200 Q22 184 23 168 Z' } },
  { view: 'back', shape: 'path', attrs: { d: 'M108 168 Q110 186 111 200 L99 200 Q98 184 97 168 Z' } },
];

// Every region names its muscle group. Left/right pairs share one group, so
// tapping either highlights both — they are one muscle in the data.
const REGIONS = [
  /* ---------- front ---------- */
  { muscle: 'Traps', view: 'front', shape: 'path',
    attrs: { d: 'M44 46 L53 44 L53 52 Q46 54 38 60 Z' } },
  { muscle: 'Traps', view: 'front', shape: 'path',
    attrs: { d: 'M76 46 L67 44 L67 52 Q74 54 82 60 Z' } },

  { muscle: 'Shoulders', view: 'front', shape: 'ellipse',
    attrs: { cx: 29, cy: 70, rx: 13, ry: 13 } },
  { muscle: 'Shoulders', view: 'front', shape: 'ellipse',
    attrs: { cx: 91, cy: 70, rx: 13, ry: 13 } },

  { muscle: 'Chest', view: 'front', shape: 'path',
    attrs: { d: 'M40 60 Q52 56 58 60 L58 92 Q46 94 39 84 Z' } },
  { muscle: 'Chest', view: 'front', shape: 'path',
    attrs: { d: 'M80 60 Q68 56 62 60 L62 92 Q74 94 81 84 Z' } },

  { muscle: 'Biceps', view: 'front', shape: 'ellipse',
    attrs: { cx: 22, cy: 104, rx: 10, ry: 22 } },
  { muscle: 'Biceps', view: 'front', shape: 'ellipse',
    attrs: { cx: 98, cy: 104, rx: 10, ry: 22 } },

  { muscle: 'Forearms', view: 'front', shape: 'ellipse',
    attrs: { cx: 17, cy: 145, rx: 8, ry: 22 } },
  { muscle: 'Forearms', view: 'front', shape: 'ellipse',
    attrs: { cx: 103, cy: 145, rx: 8, ry: 22 } },

  { muscle: 'Core', view: 'front', shape: 'path',
    attrs: { d: 'M45 94 L75 94 L73 140 Q60 146 47 140 Z' } },

  { muscle: 'Quads', view: 'front', shape: 'path',
    attrs: { d: 'M44 152 Q56 150 57 158 L55 232 L38 232 Q38 186 44 152 Z' } },
  { muscle: 'Quads', view: 'front', shape: 'path',
    attrs: { d: 'M76 152 Q64 150 63 158 L65 232 L82 232 Q82 186 76 152 Z' } },

  { muscle: 'Calves', view: 'front', shape: 'ellipse',
    attrs: { cx: 44, cy: 254, rx: 9, ry: 24 } },
  { muscle: 'Calves', view: 'front', shape: 'ellipse',
    attrs: { cx: 76, cy: 254, rx: 9, ry: 24 } },

  /* ---------- back ---------- */
  { muscle: 'Traps', view: 'back', shape: 'path',
    attrs: { d: 'M60 44 L40 58 Q52 68 60 96 Q68 68 80 58 Z' } },

  { muscle: 'Shoulders', view: 'back', shape: 'ellipse',
    attrs: { cx: 29, cy: 70, rx: 13, ry: 13 } },
  { muscle: 'Shoulders', view: 'back', shape: 'ellipse',
    attrs: { cx: 91, cy: 70, rx: 13, ry: 13 } },

  { muscle: 'Back', view: 'back', shape: 'path',
    attrs: { d: 'M40 62 Q34 96 42 136 L58 132 L58 66 Z' } },
  { muscle: 'Back', view: 'back', shape: 'path',
    attrs: { d: 'M80 62 Q86 96 78 136 L62 132 L62 66 Z' } },

  { muscle: 'Triceps', view: 'back', shape: 'ellipse',
    attrs: { cx: 22, cy: 104, rx: 10, ry: 22 } },
  { muscle: 'Triceps', view: 'back', shape: 'ellipse',
    attrs: { cx: 98, cy: 104, rx: 10, ry: 22 } },

  { muscle: 'Forearms', view: 'back', shape: 'ellipse',
    attrs: { cx: 17, cy: 145, rx: 8, ry: 22 } },
  { muscle: 'Forearms', view: 'back', shape: 'ellipse',
    attrs: { cx: 103, cy: 145, rx: 8, ry: 22 } },

  { muscle: 'Glutes', view: 'back', shape: 'path',
    attrs: { d: 'M44 140 Q60 136 76 140 Q80 164 60 168 Q40 164 44 140 Z' } },

  { muscle: 'Hamstrings', view: 'back', shape: 'path',
    attrs: { d: 'M42 170 L57 170 L55 232 L38 232 Q38 198 42 170 Z' } },
  { muscle: 'Hamstrings', view: 'back', shape: 'path',
    attrs: { d: 'M78 170 L63 170 L65 232 L82 232 Q82 198 78 170 Z' } },

  { muscle: 'Calves', view: 'back', shape: 'ellipse',
    attrs: { cx: 44, cy: 254, rx: 10, ry: 26 } },
  { muscle: 'Calves', view: 'back', shape: 'ellipse',
    attrs: { cx: 76, cy: 254, rx: 10, ry: 26 } },
];

export const MAPPED_MUSCLES = [...new Set(REGIONS.map((r) => r.muscle))];

function mk(shape, attrs, cls) {
  const n = document.createElementNS(NS, shape);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (cls) n.setAttribute('class', cls);
  return n;
}

/**
 * Draw both views.
 * @param {Map<string,{levelKey,label}>} levels  muscle -> level, absent = grey
 * @param {string|null} selected                 highlighted muscle
 * @param {(muscle:string)=>void} onPick
 */
export function bodySvg(levels, selected, onPick) {
  const svg = mk('svg', {
    viewBox: '0 0 260 300',
    class: 'body-map',
    role: 'img',
    'aria-label': 'Muscle groups coloured by strength level',
  });

  const views = [
    { view: 'front', dx: 0, label: 'Front' },
    { view: 'back', dx: 140, label: 'Back' },
  ];

  for (const { view, dx, label } of views) {
    const g = mk('g', { transform: `translate(${dx} 0)` });

    for (const o of OUTLINE.filter((x) => x.view === view)) {
      g.append(mk(o.shape, o.attrs, 'body-outline'));
    }

    for (const r of REGIONS.filter((x) => x.view === view)) {
      const info = levels.get(r.muscle);
      const cls = ['body-region'];
      cls.push(info ? `lv-${info.levelKey}` : 'lv-none');
      if (selected === r.muscle) cls.push('is-selected');

      const node = mk(r.shape, r.attrs, cls.join(' '));
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label',
        `${r.muscle} — ${info ? info.label : 'no benchmark recorded'}`);
      // A <title> gives a native tooltip on desktop for free, and screen
      // readers announce it.
      const t = mk('title', {});
      t.textContent = `${r.muscle}: ${info ? info.label : 'no data'}`;
      node.append(t);

      node.addEventListener('click', () => onPick(r.muscle));
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.muscle); }
      });
      g.append(node);
    }

    const cap = mk('text', { x: 60, y: 297, 'text-anchor': 'middle' }, 'body-caption');
    cap.textContent = label;
    g.append(cap);
    svg.append(g);
  }

  return svg;
}
