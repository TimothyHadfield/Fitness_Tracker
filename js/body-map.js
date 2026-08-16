// The body diagram.
//
// Hand-authored rather than traced: every muscle needs its own fill and its own
// tap target, so the figure has to be built from shapes we control. They are
// drawn to be what the muscles actually look like — the pec fan, the deltoid
// cap, the lat V, the three heads of the quadriceps, the two heads of the
// gastrocnemius.
//
// EVERYTHING IS DRAWN AS THE FIGURE'S LEFT HALF and emitted a second time
// through a mirror transform, so symmetry is exact and free and there is half as
// much path data to get wrong.
//
// MUSCLES ARE NOT WRITTEN AS PATH DATA. A muscle is a list of cross-sections —
// `[y, xLeft, xRight]` down the body — and `belly()` turns that into a smooth
// closed curve. Bezier control points are not reliably authorable by hand at
// this scale: an earlier pass produced muscles half the width they were meant
// to be, because the handles pinched the outline, and it took measuring the
// rendered result to notice. A cross-section says exactly how wide the muscle
// is at a given height and can be checked directly against the silhouette it
// has to fit inside.
//
// LANDMARKS — the figure is built from these. x is the LEFT edge; the centre
// line is x = 100. Roughly eight heads tall, shoulder span a little under three
// head-widths, which is what reads as an adult male rather than a mannequin.
//
//     y   4  crown                    y 112  armpit        x 69
//     y  60  chin          x 94       y 140  chest side    x 69
//     y  74  neck base     x 93       y 180  waist         x 75
//     y  88  shoulder      x 64       y 212  hip           x 66
//     y 112  deltoid       x 48       y 233  crotch        x 100
//     y 165  elbow    x 47 / 63       y 246  thigh    x 58 / 97
//     y 244  wrist    x 41 / 57       y 320  knee     x 67 / 88
//     y 290  hand     x 41 / 57       y 370  calf     x 63 / 93
//                                     y 434  foot
//
// Coordinate space is 200 × 460 per figure; the two views sit side by side in
// one SVG so they scale together.

const NS = 'http://www.w3.org/2000/svg';

// x -> 200 - x. Applied to a copy of every shape.
const MIRROR = 'translate(200 0) scale(-1 1)';

/* ------------------------------------------------------------------ *
 * Silhouette
 *
 * Crown → skull → jaw → neck → trapezius slope → deltoid → down the OUTSIDE of
 * the arm → around the hand → back up the INSIDE of the arm → armpit → ribs →
 * waist → hip → down the outside of the leg → around the foot → up the inside
 * → crotch.
 *
 * The arm touches the torso at the armpit and swings clear of it by the waist.
 * That gap is what stops the figure reading as a gingerbread man, and it is the
 * whole reason the arm is traced in full rather than merged into the torso.
 *
 * Closed (Z) this walks straight back up the centre line and fills the body;
 * drawn open it is the outline, with no seam down the middle. Same string, two
 * jobs — the fill and the outline can never disagree.
 * ------------------------------------------------------------------ */

const HALF_BODY =
  'M100 4 '
  + 'C88 4 82 12 81 26 C80 36 81 44 83 50 C86 56 90 59 94 60 '     // skull + jaw
  + 'L93 74 '                                                      // neck
  + 'C85 77 73 81 64 88 '                                          // trapezius slope
  + 'C55 93 48 102 48 114 '                                        // deltoid
  + 'C47 132 47 152 47 170 '                                       // upper arm
  + 'C44 188 42 204 41 218 C40 232 41 242 42 252 '                 // forearm → wrist
  + 'C40 264 39 280 41 290 C44 298 54 299 57 291 '                 // hand
  + 'C58 281 57 266 56 254 L57 244 '                               // back up the palm
  + 'C57 228 58 212 59 198 C60 184 62 174 63 166 '                 // inside forearm
  + 'C64 148 65 128 66 112 C67 106 69 104 69 108 '                 // inside upper arm → armpit
  + 'C69 122 68 136 69 150 C71 164 74 172 75 180 '                 // ribs → waist
  + 'C74 192 72 200 69 207 '                                       // hip
  + 'C63 217 58 230 58 245 C59 262 60 277 62 292 '                 // thigh
  + 'C64 303 66 311 67 319 '                                       // knee
  + 'C64 330 62 345 62 361 C63 378 69 397 74 414 '                 // calf → ankle
  + 'C74 420 73 424 73 428 '                                       // ankle
  + 'C77 434 91 434 93 428 C93 421 92 418 91 414 '                 // foot
  + 'C94 397 93 378 93 361 C93 345 90 330 88 319 '                 // inside calf
  + 'C89 303 91 288 93 273 C94 258 97 243 100 233';                // inside thigh → crotch

// Face. Minimal on purpose — two eyes and a mouth read as a person; anything
// more turns a diagram into a character.
const FACE = [
  { d: 'M86 34 C88 32 91 32 93 34', mirror: true },
  { d: 'M95 48 C98 50 102 50 105 48' },
];

/* ------------------------------------------------------------------ *
 * belly() — cross-sections to a smooth closed outline
 *
 * Down the left edge, across the bottom, up the right edge, closed. The curve
 * is Catmull-Rom converted to cubic beziers, which passes exactly THROUGH every
 * point given rather than being pulled near it by handles. That is the whole
 * point of this function: the numbers in the tables below mean what they say.
 * ------------------------------------------------------------------ */

function belly(sections) {
  const ring = [
    ...sections.map(([y, l]) => [l, y]),
    ...[...sections].reverse().map(([y, , r]) => [r, y]),
  ];
  const n = ring.length;
  const at = (i) => ring[(i % n + n) % n];
  let d = `M${ring[0][0].toFixed(1)} ${ring[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}`
       + ` ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

/* ------------------------------------------------------------------ *
 * Muscles. Every one is the left side; each gets a mirrored twin.
 * Each row is [y, xLeft, xRight], top to bottom.
 * ------------------------------------------------------------------ */

const REGIONS = [
  /* ============================ FRONT ============================ */

  // Deltoid: a cap over the joint that comes to a point partway down the arm.
  // That point is what makes a shoulder read as a shoulder rather than a ball.
  { muscle: 'Shoulders', view: 'front', s: [
    [87, 64, 70], [96, 54, 69], [108, 49, 68], [120, 49, 66],
    [130, 52, 63], [138, 57, 61]] },

  // Pectoralis major: wide at the sternum, fanning to a narrow insertion under
  // the deltoid. The lower border is a curve; a straight line reads as a box.
  { muscle: 'Chest', view: 'front', s: [
    [84, 74, 99], [95, 70, 99], [108, 69, 99], [122, 70, 99],
    [133, 75, 99], [141, 84, 99]] },

  // Upper trapezius — the band from the neck out to the point of the shoulder.
  { muscle: 'Traps', view: 'front', s: [
    [63, 90, 97], [70, 79, 95], [78, 70, 90], [86, 65, 82], [92, 64, 74]] },

  // Biceps — the belly sits high on the arm and tapers into the elbow.
  { muscle: 'Biceps', view: 'front', s: [
    [128, 55, 65], [142, 48, 64], [158, 47, 63], [174, 46, 62],
    [190, 47, 60], [202, 51, 58]] },

  { muscle: 'Forearms', view: 'front', s: [
    [180, 51, 60], [194, 44, 59], [208, 42, 58], [222, 41, 57],
    [234, 42, 56], [244, 45, 54]] },

  // Rectus abdominis. One region; the tendinous intersections are drawn on top
  // as lines, so the whole sheet stays a single tap target.
  { muscle: 'Core', view: 'front', s: [
    [145, 86, 99], [160, 84, 99], [180, 83, 99], [200, 84, 99],
    [214, 86, 99], [227, 91, 99]] },
  // External oblique, tucking under the ribs and into the hip.
  { muscle: 'Core', view: 'front', s: [
    [149, 80, 86], [163, 77, 86], [180, 76, 86], [196, 77, 86], [210, 81, 87]] },

  // Quadriceps, three visible heads: vastus lateralis sweeping down the outside,
  // rectus femoris on the centre line, and vastus medialis — the teardrop just
  // above the inside of the knee, the head people actually name.
  { muscle: 'Quads', view: 'front', s: [
    [244, 72, 80], [258, 64, 80], [274, 61, 79], [290, 62, 78],
    [304, 64, 76], [318, 67, 73]] },
  { muscle: 'Quads', view: 'front', s: [
    [242, 79, 88], [256, 77, 91], [272, 76, 91], [288, 77, 90],
    [304, 78, 87], [318, 80, 85]] },
  { muscle: 'Quads', view: 'front', s: [
    [288, 82, 88], [298, 80, 90], [310, 80, 89], [322, 82, 87]] },

  // Tibialis anterior down the shin, with the gastrocnemius belly showing behind
  // it — the pair is what gives a lower leg its shape from the front.
  { muscle: 'Calves', view: 'front', s: [
    [336, 81, 89], [352, 79, 91], [370, 79, 91], [388, 80, 90], [404, 83, 88]] },
  { muscle: 'Calves', view: 'front', s: [
    [334, 71, 80], [348, 66, 80], [364, 64, 79], [380, 66, 78], [394, 70, 76]] },

  /* ============================= BACK ============================= */

  // Latissimus dorsi: wide under the armpit, sweeping down and IN to a narrow
  // insertion at the lower back. That taper IS the V-shape.
  { muscle: 'Back', view: 'back', s: [
    [103, 73, 91], [119, 68, 95], [139, 67, 97], [158, 69, 96],
    [176, 75, 93], [192, 82, 89]] },
  // Erector spinae — the two columns either side of the lower spine.
  { muscle: 'Back', view: 'back', s: [
    [182, 91, 99], [196, 89, 99], [212, 89, 99], [228, 92, 99]] },

  // Trapezius: neck, out to both shoulders, then tapering to a point mid-back.
  // Half of the diamond, mirrored into the whole.
  { muscle: 'Traps', view: 'back', s: [
    [64, 90, 99], [76, 74, 99], [90, 65, 99], [104, 74, 99],
    [126, 86, 99], [150, 93, 99], [172, 97, 99]] },


  { muscle: 'Shoulders', view: 'back', s: [
    [87, 63, 70], [96, 53, 69], [108, 48, 68], [120, 48, 66],
    [130, 51, 63], [138, 56, 61]] },

  // Triceps — the long head runs higher up the arm than the biceps does.
  { muscle: 'Triceps', view: 'back', s: [
    [126, 54, 65], [141, 47, 64], [157, 46, 63], [173, 45, 61],
    [189, 46, 60], [202, 50, 57]] },

  { muscle: 'Forearms', view: 'back', s: [
    [180, 50, 59], [194, 43, 58], [208, 41, 57], [222, 40, 56],
    [234, 41, 55], [244, 44, 53]] },

  // Gluteus maximus: a rounded mass meeting its twin at the midline. This is the
  // shape that most obviously fails if you draw it as a rectangle.
  { muscle: 'Glutes', view: 'back', s: [
    [204, 70, 99], [217, 64, 99], [232, 62, 99], [247, 64, 99],
    [259, 70, 97], [268, 79, 93]] },

  // Hamstrings: biceps femoris outside, semitendinosus inside, separating as
  // they run down to the back of the knee.
  { muscle: 'Hamstrings', view: 'back', s: [
    [280, 71, 80], [294, 66, 80], [310, 65, 79], [326, 65, 78],
    [342, 67, 76], [354, 70, 74]] },
  { muscle: 'Hamstrings', view: 'back', s: [
    [278, 80, 89], [294, 79, 90], [310, 79, 89], [326, 79, 88],
    [342, 81, 86], [354, 83, 85]] },

  // Gastrocnemius, two heads — the inner head hangs visibly lower than the outer
  // one, the detail that makes a calf read as a calf.
  { muscle: 'Calves', view: 'back', s: [
    [334, 71, 80], [348, 66, 80], [364, 64, 79], [382, 66, 78], [396, 70, 76]] },
  { muscle: 'Calves', view: 'back', s: [
    [332, 80, 88], [348, 80, 91], [366, 80, 92], [386, 81, 91],
    [402, 83, 89], [412, 85, 88]] },
];

// Fibre direction, drawn over the fills. Purely decorative, never interactive —
// it is what stops a filled shape reading as a flat sticker.
const FIBRES = [
  { view: 'front', d: 'M97 90 C89 94 82 101 78 111' },
  { view: 'front', d: 'M98 105 C91 109 85 115 81 124' },
  { view: 'front', d: 'M98 120 C92 124 87 129 84 135' },
  { view: 'front', d: 'M56 100 C52 112 51 126 53 140' },
  { view: 'front', d: 'M62 97 C59 110 58 126 60 138' },
  { view: 'front', d: 'M53 150 C50 162 50 180 53 194' },
  { view: 'front', d: 'M48 198 C46 210 45 226 46 238' },
  { view: 'front', d: 'M70 260 C66 278 66 298 70 314' },
  { view: 'front', d: 'M84 256 C87 276 87 296 85 314' },
  { view: 'back', d: 'M93 74 C83 80 73 86 67 92' },
  { view: 'back', d: 'M98 96 C90 100 82 105 75 108' },
  { view: 'back', d: 'M98 128 C92 135 86 143 82 153' },
  { view: 'back', d: 'M95 152 C89 158 84 166 80 175' },
  { view: 'back', d: 'M58 116 C54 130 53 148 56 162' },
  { view: 'back', d: 'M52 152 C49 164 49 182 52 196' },
  { view: 'back', d: 'M47 200 C45 212 44 228 45 240' },
  { view: 'back', d: 'M74 224 C68 234 65 248 67 260' },
  { view: 'back', d: 'M70 292 C66 306 66 328 70 346' },
  { view: 'back', d: 'M85 290 C88 306 88 328 85 348' },
];

// The rectus abdominis divisions — the six-pack. Lines rather than separate
// regions, so the whole abdominal sheet stays one tap target.
const ABS_LINES = [
  'M100 147 L100 226',
  'M88 165 C93 167 107 167 112 165',
  'M87 186 C93 188 107 188 113 186',
  'M89 206 C94 208 106 208 111 206',
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
    viewBox: '0 0 420 460',
    class: 'body-map',
    role: 'img',
    'aria-label': 'Muscle groups coloured by strength level',
  });

  const views = [
    { view: 'front', dx: 0, label: 'Front' },
    { view: 'back', dx: 220, label: 'Back' },
  ];

  for (const { view, dx, label } of views) {
    const g = mk('g', { transform: `translate(${dx} 0)` });

    // Emit a shape as authored and again mirrored.
    const both = (make) => { g.append(make(false)); g.append(make(true)); };
    const pathOf = (d, cls) => (mirrored) =>
      mk('path', mirrored ? { d, transform: MIRROR } : { d }, cls);

    // Filled body first, so every muscle sits on skin rather than on the page.
    both(pathOf(HALF_BODY + ' Z', 'body-skin'));

    for (const r of REGIONS.filter((x) => x.view === view)) {
      const info = levels.get(r.muscle);
      const cls = ['body-region'];
      cls.push(info ? `lv-${info.levelKey}` : 'lv-none');
      if (selected === r.muscle) cls.push('is-selected');
      const d = belly(r.s);

      both((mirrored) => {
        const attrs = { d };
        if (mirrored) attrs.transform = MIRROR;
        const node = mk('path', attrs, cls.join(' '));
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
        return node;
      });
    }

    for (const f of FIBRES.filter((x) => x.view === view)) both(pathOf(f.d, 'body-fibre'));
    if (view === 'front') for (const d of ABS_LINES) g.append(mk('path', { d }, 'body-fibre'));

    // The outline goes on top of the fills so every muscle is contained by the
    // silhouette rather than bleeding over its edge.
    both(pathOf(HALF_BODY, 'body-edge'));
    if (view === 'front') {
      for (const f of FACE) {
        g.append(mk('path', { d: f.d }, 'body-edge'));
        if (f.mirror) g.append(mk('path', { d: f.d, transform: MIRROR }, 'body-edge'));
      }
    }

    const cap = mk('text', { x: 100, y: 452, 'text-anchor': 'middle' }, 'body-caption');
    cap.textContent = label;
    g.append(cap);
    svg.append(g);
  }

  return svg;
}
