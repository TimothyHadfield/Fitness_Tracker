#!/usr/bin/env python3
"""Turn the muscle-group illustrations into the app's body maps.

    python tools/build-body-art.py                 both figures
    python tools/build-body-art.py --only female   one of them

Reads  Human_Muscle_Groups.jpg        the MALE sheet, both views on one image
       Female_Muscle_Groups_Front.png the FEMALE figure, one image per view
       Female_Muscle_Groups_Back.png
       (all three are git-ignored working files, and none is shipped)

Writes js/body-art.js         generated — do not hand-edit
       js/body-art-female.js
       img/ink-front.webp · img/ink-back.webp
       img/ink-front-female.webp · img/ink-back-female.webp

TWO FIGURES, TWO FRONT-ENDS, ONE BACK-END
-----------------------------------------
Tim drew a female figure on 2026-09-07 and the app picks between them on the
profile's sex. The two sources could hardly be less alike — the male sheet is
a COLOUR-FIELD drawing on white paper, where each muscle is its own saturated
hue; the female is a MONOCHROME line drawing, white keylines on black, where
every muscle is the same dark grey and only the lines between them say where
one ends.

So `segment_male()` and `segment_female()` are genuinely different readings of
a picture, and each says so in its own comment. Everything after that point —
`smooth_fills()`, the piece-count guard, `trace()`, `emit()` — is SHARED and
must stay shared: it is where the outline quality lives, and a second copy of
it would be a second place for the crenellation bug to come back.

WHY THIS EXISTS
---------------
The drawing is one flat image. The app needs each muscle group to take its own
colour, independently, while every keyline, fibre striation and shadow survives
whatever colour it is given.

So the artwork is split into two layers:

  FILL  one traced vector path per muscle group per view. Carries colour and
        nothing else, and is the tap target. Its mask is low-passed before
        tracing (see smooth_fills) — a threshold on a JPEG wobbles by a pixel
        or two along every edge, and potrace follows that faithfully into a
        crenellated outline.
  INK   one greyscale image per view, used as an SVG luminance mask over a
        rectangle of ink colour. Carries every black keyline, every striation
        and all the shading, and is never recoloured.

Compositing them reproduces the drawing. Changing a fill recolours exactly one
muscle and leaves the ink untouched.

Ink is a SCALAR — how much the artwork darkens its own base colour at that
pixel. Applied to any fill it yields a darker version of THAT fill, so a
striation stays a striation whatever the muscle's colour. Storing a per-channel
multiply instead reproduced the source more exactly but broke on recolour:
where a base colour has a near-zero channel the ratio there is noise, and the
striations came out green over a blue muscle.

Head, hands, feet and knees carry ink but no fill, so they stay unpainted —
which is what makes the coloured masses read.

REGENERATING
------------
Needs pillow, numpy, scipy and potracer (dev-only; the app itself still has no
dependencies). Seed points below are anchored to the 506x1527 crop of each
figure and the script asserts that crop, so a different source image will fail
loudly rather than silently mis-assign muscles.
"""

import os
import sys

import numpy as np
import potrace
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Human_Muscle_Groups.jpg")
FIGURE = (506, 1527)          # each figure's crop; the seeds assume it

REL = 0.65      # darkness relative to the local muscle colour that reads as a keyline
MINAREA = 150   # ignore specks below this when checking coverage
GROW = 5        # px a fill may spread under a keyline
BASE_Q = 80     # luminance percentile of a muscle that counts as unshaded
FLOOR = 0.06
TURD = 24       # drop traced specks below this area
OPTTOL = 0.35
SMOOTH = 2.0    # px of boundary wobble to iron out of a fill before tracing
GAP = 40        # px between the two figures in the emitted viewBox
QUALITY = 90    # webp quality for the ink layer

LUM = np.array([0.2126, 0.7152, 0.0722])
CROSS = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])

# Seed points, one per drawn sub-muscle, in figure coordinates. A point rather
# than a component id because an id is an accident of labelling order.
#
# The drawing separates muscles the app has no group for. Where that happens the
# piece joins the group it trains with:
#   sternocleidomastoid, scalenes            -> Neck
#   infraspinatus, teres, erector spinae     -> Back
#   sartorius, adductors (front of thigh)    -> Quads
#   adductor magnus (back of thigh)          -> Hamstrings
#   gluteus medius / TFL at the hip          -> Glutes
#   tibialis anterior, peroneals             -> Calves
SEEDS = {
    "front": {
        "Neck":      [(223, 205), (284, 201), (202, 223), (303, 223), (215, 245), (291, 246)],
        "Traps":     [(344, 221), (162, 220)],
        "Shoulders": [(88, 288), (418, 289)],
        "Chest":     [(187, 321), (319, 322), (342, 381)],
        "Biceps":    [(81, 406), (425, 409), (38, 461), (467, 464), (69, 502)],
        "Forearms":  [(467, 544), (39, 547), (79, 549), (426, 548),
                      (26, 624), (478, 627), (59, 623), (446, 623)],
        "Core":      [(212, 409), (292, 408), (216, 460), (290, 461),
                      (221, 510), (284, 510), (221, 570), (284, 570),
                      (336, 413), (169, 412), (146, 411), (359, 411),
                      (358, 429), (147, 429), (172, 447), (333, 447),
                      (169, 477), (335, 479), (333, 508), (173, 510),
                      (171, 539), (334, 539), (159, 581), (346, 581)],
        "Glutes":    [(140, 665), (365, 665)],
        "Quads":     [(154, 629), (351, 629), (174, 698), (332, 694),
                      (348, 816), (155, 808), (232, 762), (272, 771),
                      (379, 923), (126, 924), (236, 815), (316, 934), (188, 942)],
        "Calves":    [(114, 1110), (392, 1119), (179, 1136), (326, 1136),
                      (342, 1216), (348, 1245), (157, 1246)],
    },
    "back": {
        "Traps":      [(302, 207), (201, 208), (215, 319), (290, 320)],
        "Shoulders":  [(89, 291), (415, 291)],
        "Back":       [(162, 299), (343, 299), (130, 328), (376, 330),
                       (148, 356), (357, 356), (172, 361), (332, 361),
                       (201, 475), (303, 476), (371, 379), (134, 378)],
        "Triceps":    [(77, 385), (428, 385), (382, 399)],
        "Forearms":   [(23, 546), (482, 547), (36, 593), (469, 594),
                       (72, 579), (432, 577)],
        "Glutes":     [(330, 634), (172, 635), (201, 721), (305, 726), (246, 703)],
        "Hamstrings": [(229, 794), (277, 798), (321, 979), (196, 797),
                       (170, 802), (358, 869), (146, 874), (286, 845),
                       (292, 939), (212, 933)],
        "Calves":     [(374, 1094), (133, 1083), (193, 1041), (170, 1147),
                       (325, 1066), (335, 1150), (106, 1168), (199, 1115),
                       (306, 1114), (401, 1146)],
    },
}


# ── THE FEMALE FIGURE ────────────────────────────────────────────────────────
#
# One PNG per view rather than one sheet, at two different resolutions, so each
# is cropped to its own silhouette and scaled into a shared box. Both views are
# scaled to the SAME height, which is also the male figure's height, so a woman
# and a man are drawn the same size — this is a diagram, not a comparison of two
# people's stature. The box is wider (582 against 506) because the drawing holds
# its hands further out; every screen sizes its container from BODY_ASPECT, so a
# wider figure gets a wider box rather than a smaller figure.

SRC_F = {
    "front": os.path.join(ROOT, "Female_Muscle_Groups_Front.png"),
    "back": os.path.join(ROOT, "Female_Muscle_Groups_Back.png"),
}
FIGURE_F = (582, 1527)
GAP_F = 46          # GAP scaled by the width, so the pair reads the same

LINE_MIN = 0.06     # the faintest anti-aliased linework that still walls a flood
KEY = 0.38          # at or above this is drawn line; below it is muscle interior
INK_FLOOR = 0.05    # source luminance that carries no ink at all
INK_WHITE = 0.85    # source luminance that carries solid ink
SEAL = np.ones((3, 3), bool)

# 🚨 SEGMENTS FORCED INTO THE KEYLINE MASK BEFORE COMPONENTS ARE LABELLED.
# The male sheet needs none of these: it stops PAINTING at the ankle, so the
# foot is simply unpainted and falls out on its own. The female drawing fills
# the whole body with one tone and relies on lines to divide it — and it draws
# no line where the shin meets the foot on the front view, so the two are one
# region. Measured: the component narrows to 15px at y≈1340 and opens back out
# into the foot, which is an anatomical waist rather than a missing line, so
# there is nothing to lower a threshold onto. Hand-placed, and the coverage
# check below is what says they still land where they are meant to.
CUTS_F = {
    "front": [(138, 1341, 218, 1341), (366, 1341, 446, 1341)],
    "back": [],
}

# Seed points, one per drawn sub-muscle, in figure coordinates — the same idea
# and the same groupings as SEEDS above, re-derived for this drawing because
# nothing about the two figures' proportions is shared.
SEEDS_F = {
    "front": {
        "Neck":      [(280, 219), (254, 249), (330, 248), (264, 271), (321, 273)],
        "Traps":     [(213, 263), (375, 264)],
        "Shoulders": [(141, 312), (445, 312), (164, 359), (422, 360)],
        "Chest":     [(240, 384), (344, 383), (201, 286)],
        "Biceps":    [(126, 437), (459, 438), (118, 555), (468, 556)],
        "Forearms":  [(67, 589), (517, 588), (90, 636), (486, 618),
                      (41, 689), (541, 681)],
        "Core":      [(271, 474), (314, 474), (266, 528), (319, 528),
                      (265, 584), (320, 585), (266, 641), (319, 647),
                      (200, 470), (381, 473), (222, 498), (362, 497),
                      (222, 549), (363, 547), (209, 621), (376, 620),
                      (307, 434), (283, 426), (236, 463), (383, 498),
                      (292, 491)],
        "Glutes":    [(159, 697), (424, 699), (180, 647), (408, 641)],
        "Quads":     [(174, 800), (410, 805), (230, 938), (354, 945),
                      (166, 967), (416, 966), (232, 728), (354, 724),
                      (260, 802), (325, 800), (190, 1026), (393, 1026)],
        "Calves":    [(155, 1199), (427, 1192), (219, 1184), (365, 1189),
                      (192, 1106), (390, 1105), (200, 1303), (383, 1304),
                      (156, 1311), (376, 1268), (207, 1268), (427, 1310)],
    },
    "back": {
        "Traps":      [(231, 270), (350, 270)],
        "Shoulders":  [(139, 321), (443, 322)],
        "Back":       [(235, 484), (357, 463), (209, 389), (371, 390),
                       (207, 339), (374, 339), (217, 592), (366, 584),
                       (193, 630), (390, 630), (292, 638), (425, 374),
                       (200, 415), (381, 415)],
        "Triceps":    [(118, 441), (463, 440), (124, 522), (462, 536)],
        "Forearms":   [(54, 673), (526, 670), (65, 583), (515, 581),
                       (109, 613), (474, 617), (107, 582), (475, 583)],
        "Glutes":     [(225, 699), (349, 749)],
        "Hamstrings": [(218, 909), (364, 898), (152, 901), (428, 900),
                       (195, 1061), (388, 1055), (137, 806), (444, 806),
                       (197, 826), (381, 826), (212, 1043), (370, 1030)],
        "Calves":     [(145, 1176), (436, 1175), (206, 1193), (377, 1233),
                       (163, 1078), (418, 1076), (156, 1338), (426, 1324),
                       (386, 1303), (195, 1303), (169, 1276), (429, 1418),
                       (149, 1422)],
    },
}

# 🚨 EVERY REGION THE DRAWING SEPARATES BUT THE APP DOES NOT PAINT, NAMED.
# The male figure gets this for free — head, hands and feet are simply not
# coloured in, so they are not "painted" and never become a component. Here
# they are the same dark grey as a muscle, so a component with no seed could
# mean "the head" or it could mean "a muscle nobody assigned". Listing them is
# what keeps the coverage check below meaningful: after this, an unclaimed
# component is always a mistake.
IGNORE_F = {
    "front": [(292, 50),                                    # head
              (32, 801), (550, 800), (49, 897), (45, 908),  # hands
              (548, 879), (541, 903),
              (161, 1463), (421, 1464), (196, 1348),        # feet, below the cut
              (161, 1348), (387, 1348), (421, 1348)],
    "back": [(290, 80),                                     # head
             (31, 807), (552, 806), (37, 855),              # hands
             (174, 1493), (405, 1493)],                     # feet
}


def female_source(view):
    """Crop to the silhouette and scale into the shared figure box."""
    w, h = FIGURE_F
    g = np.asarray(Image.open(SRC_F[view]).convert("L")).astype(np.float32) / 255.0
    ys, xs = np.nonzero(female_body(g))
    box = (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1))
    bw, bh = box[2] - box[0], box[3] - box[1]
    tw = int(round(bw * h / bh))
    if tw > w:
        sys.exit(f"{view}: scaled to {tw}px wide, wider than the {w}px box. "
                 f"Widen FIGURE_F rather than squashing the drawing.")
    im = Image.fromarray((g * 255).astype(np.uint8)).crop(box).resize((tw, h), Image.LANCZOS)
    canvas = Image.new("L", (w, h), 0)
    canvas.paste(im, ((w - tw) // 2, 0))
    lum = np.asarray(canvas).astype(np.float32) / 255.0
    # Recomputed in the normalised space rather than resampled: a resized
    # boolean has to be re-thresholded anyway, and doing it here keeps the mask
    # and the luminance it was read from exactly in step.
    return lum, female_body(lum), (bw, bh)


def female_body(g):
    """Everything the page background cannot reach.

    ⚠️ THE BARRIER IS CLOSED FIRST, AND THAT IS NOT TIDINESS. The back figure's
    foot outline fades to about 0.08 in a couple of places, and a flood walks
    through a gap that narrow and fills both feet. It does not present as a leak
    — the ink layer is zeroed outside the body, so it presents as a figure with
    no feet, and the fills stop at the ankle looking deliberate. Closing the
    linework by one pixel before flooding seals it; the tool then checks that a
    point inside each foot really did end up inside the body.
    """
    h, w = g.shape
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = ~ndi.binary_closing(g >= LINE_MIN, SEAL)
    pad[0, :] = pad[-1, :] = pad[:, 0] = pad[:, -1] = True
    lab, _ = ndi.label(pad)
    body = ~(lab == lab[0, 0])[1:-1, 1:-1]
    bl, _n = ndi.label(body)
    sizes = np.bincount(bl.ravel())
    sizes[0] = 0
    return ndi.binary_fill_holes(bl == sizes.argmax())


def female_keylines(view, lum):
    k = lum >= KEY
    if CUTS_F[view]:
        im = Image.new("L", (lum.shape[1], lum.shape[0]), 0)
        d = ImageDraw.Draw(im)
        for seg in CUTS_F[view]:
            d.line(seg, fill=255, width=3)
        k = k | (np.asarray(im) > 0)
    return k


def segment_female(view, lum, body):
    """Read a monochrome line drawing: the muscles are the gaps between lines.

    The male reading asks which saturated colour a pixel is. There is no colour
    here and every muscle is the same grey, so the question becomes topological
    — a muscle is a region of the body that the white keylines enclose.
    """
    key = female_keylines(view, lum)
    interior = ndi.binary_opening(body & ~key, np.ones((3, 3)))
    lab, n = ndi.label(interior, CROSS)

    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    real = {i for i in range(1, n + 1) if sizes[i] >= MINAREA}

    names = sorted(SEEDS_F[view])
    idx = {nm: i + 1 for i, nm in enumerate(names)}
    seg = np.zeros(lab.shape, np.int16)
    claimed, problems = set(), []
    for nm, pts in list(SEEDS_F[view].items()) + [("(unpainted)", IGNORE_F[view])]:
        for (x, y) in pts:
            cid = int(lab[y, x])
            if cid == 0:
                problems.append(f"seed {nm} ({x},{y}) landed on a keyline, not a region")
                continue
            if cid in claimed:
                problems.append(f"seed {nm} ({x},{y}) hits component {cid}, already taken")
            claimed.add(cid)
            if nm != "(unpainted)":
                seg[lab == cid] = idx[nm]
    for cid in sorted(real - claimed):
        ys, xs = np.nonzero(lab == cid)
        problems.append(f"component {cid} ({sizes[cid]}px, centre "
                        f"{int(xs.mean())},{int(ys.mean())}) has no seed")
    if problems:
        sys.exit(f"{view} (female): segmentation does not cover the drawing\n  "
                 + "\n  ".join(problems))

    # A fill may spread under the keyline that bounds it, never past it into a
    # region somebody else owns or into one deliberately left unpainted.
    unpainted = np.zeros(lab.shape, bool)
    for (x, y) in IGNORE_F[view]:
        unpainted |= lab == int(lab[y, x])
    zone = ndi.binary_dilation(seg > 0, np.ones((3, 3)), iterations=GROW) & body & ~unpainted
    dist, (iy, ix) = ndi.distance_transform_edt(seg == 0, return_indices=True)
    grow = (seg == 0) & zone & (dist <= GROW)
    seg[grow] = seg[iy[grow], ix[grow]]

    for nm in names:
        m = ndi.binary_closing(seg == idx[nm], np.ones((3, 3)))
        seg[m & (seg == 0) & ~unpainted] = idx[nm]

    return seg, names, idx


def female_ink(lum, body):
    """The drawing is white line on black; the app paints dark ink on colour.

    So the mapping is a straight inversion of tone: the brighter the source, the
    more ink. A keyline comes out solid, a fibre striation comes out faint, and
    a muscle's flat interior comes out as nothing at all, which is what lets the
    fill underneath be the muscle's colour. Nothing is solved for here the way
    `ink_layer()` has to solve for the male sheet's own base colours — this
    drawing has exactly one base and it is black.
    """
    alpha = np.clip((lum - INK_FLOOR) / (INK_WHITE - INK_FLOOR), 0.0, 1.0)
    alpha[~body] = 0.0
    return alpha


def crop_figures():
    """Drop the banner, then split the sheet into the two figures."""
    a = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
    blue = (a[..., 2] > 120) & (a[..., 2] - a[..., 0] > 40) & (a[..., 1] < a[..., 2])
    rows = np.where(blue.mean(axis=1) > 0.5)[0]
    art = a[: rows.min()] if len(rows) else a

    ink = (255 - art.min(axis=2)) > 18
    cols = np.where(ink.sum(axis=0) > 2)[0]
    w = art.shape[1]
    band = np.arange(w)
    empty = band[(ink.sum(axis=0) <= 2) & (band > w * 0.30) & (band < w * 0.70)]
    split = int((empty.min() + empty.max()) / 2)

    out = {}
    for name, x0, x1 in (("front", cols.min(), split), ("back", split, cols.max() + 1)):
        sub = ink[:, x0:x1]
        rr = np.where(sub.sum(axis=1) > 2)[0]
        cc = np.where(sub.sum(axis=0) > 2)[0]
        box = (int(x0 + cc.min()), int(rr.min()), int(x0 + cc.max() + 1), int(rr.max() + 1))
        piece = art[box[1]:box[3], box[0]:box[2]]
        got = (piece.shape[1], piece.shape[0])
        if got != FIGURE:
            sys.exit(f"{name}: cropped to {got}, expected {FIGURE}. The seed points "
                     f"are anchored to {FIGURE}; re-derive them for this source.")
        out[name] = piece / 255.0
    return out


def prep(a):
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    painted = ndi.binary_closing((sat > 0.28) & (mx > 0.22), np.ones((3, 3)))
    loc = ndi.maximum_filter(mx * painted, size=21)
    rel = np.where(loc > 0.05, mx / np.maximum(loc, 1e-3), 1.0)
    return mx, sat, painted, rel


def body_mask(val, sat):
    """Everything that is not page background: flood the outside and invert."""
    near_white = (val > 0.86) & (sat < 0.18)
    h, w = near_white.shape
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = near_white
    pad[0, :] = pad[-1, :] = pad[:, 0] = pad[:, -1] = True
    lab, _ = ndi.label(pad)
    return ~(lab == lab[0, 0])[1:-1, 1:-1]


def segment(view, a):
    val, sat, painted, rel = prep(a)
    allowed = ndi.binary_opening(painted & (rel >= REL), np.ones((3, 3)))
    lab, n = ndi.label(allowed, CROSS)

    sizes = np.bincount(lab.ravel(), minlength=n + 1)
    real = {i for i in range(1, n + 1) if sizes[i] >= MINAREA}

    names = sorted(SEEDS[view])
    idx = {nm: i + 1 for i, nm in enumerate(names)}
    seg = np.zeros(lab.shape, np.int16)
    claimed, problems = set(), []
    for nm, pts in SEEDS[view].items():
        for (x, y) in pts:
            cid = int(lab[y, x])
            if cid == 0:
                problems.append(f"seed {nm} ({x},{y}) landed on a keyline, not a muscle")
                continue
            if cid in claimed:
                problems.append(f"seed {nm} ({x},{y}) hits component {cid}, already taken")
            claimed.add(cid)
            seg[lab == cid] = idx[nm]
    for cid in sorted(real - claimed):
        ys, xs = np.nonzero(lab == cid)
        problems.append(f"component {cid} ({sizes[cid]}px, centre "
                        f"{int(xs.mean())},{int(ys.mean())}) has no seed")
    if problems:
        sys.exit(f"{view}: segmentation does not cover the drawing\n  "
                 + "\n  ".join(problems))

    body = body_mask(val, sat)
    # A fill may spread into paint it already owns or into a keyline, never
    # across pale grey shading — that is how it used to leak into the crotch
    # and into the gaps between the abs.
    inkish = painted | (val < 0.70)
    zone = ndi.binary_dilation(seg > 0, np.ones((3, 3)), iterations=GROW) & body & inkish
    dist, (iy, ix) = ndi.distance_transform_edt(seg == 0, return_indices=True)
    grow = (seg == 0) & zone & (dist <= GROW)
    seg[grow] = seg[iy[grow], ix[grow]]

    # Close pinholes the striations punch near an edge. Deliberately NOT
    # fill_holes: several muscles ring an unpainted gap and it would be eaten.
    for nm in names:
        m = ndi.binary_closing(seg == idx[nm], np.ones((3, 3)))
        seg[m & (seg == 0)] = idx[nm]

    # Every painted pixel must be owned. One that is not keeps its ORIGINAL
    # colour through the ink layer and shows as a stray fringe once recoloured.
    orphan = painted & (seg == 0)
    if orphan.any():
        _, (jy, jx) = ndi.distance_transform_edt(seg == 0, return_indices=True)
        seg[orphan] = seg[jy[orphan], jx[orphan]]

    return seg, lab, body, names, idx


def ink_layer(a, seg, lab, body):
    """Solve for the scalar darkening the artwork applies to its own base."""
    lum = a @ LUM
    base = np.ones_like(a)
    for i in [i for i in np.unique(lab) if i > 0]:
        m = lab == i
        sel = m & (lum >= np.percentile(lum[m], BASE_Q))
        base[m] = np.median(a[sel], axis=0)
    known = lab > 0
    _, (iy, ix) = ndi.distance_transform_edt(~known, return_indices=True)
    out = (seg > 0) & ~known
    base[out] = base[iy[out], ix[out]]

    base_l = np.maximum(base @ LUM, FLOOR)
    # Ink darkens but cannot lighten, so a grown pixel brighter than its own
    # base would clip to zero ink and render as raw fill. That is what bridged
    # the white channel between two ab blocks with a bar of colour.
    seg = seg.copy()
    seg[(seg > 0) & ~known & (lum > base_l)] = 0

    base_l[seg == 0] = 1.0                      # paper: head, hands, feet, knees
    alpha = np.clip(1.0 - lum / base_l, 0.0, 1.0)
    alpha[~body] = 0.0
    return alpha, seg, base


def smooth_fills(seg, ids):
    """Low-pass every fill's boundary before it is traced.

    ⚠️ THE TRACE WAS NEVER THE PROBLEM — THE MASK WAS. `segment()` decides where
    a muscle ends by thresholding a JPEG, and along an edge that threshold
    wobbles by a pixel or two from one row to the next: compression ringing
    against the keyline, and the drawing's own fibre striations biting into the
    edge wherever one runs out to it. potrace then follows that faithfully, so
    the selection ring came out crenellated — a visible staircase down the lats
    and the hamstrings, scallops along the glutes, a stray blob at the groin.
    Chest escaped only because its striations run parallel to its outline and
    never cross it, which is why it was the one muscle that looked right.

    So the fix is upstream of potrace: convolve each fill's indicator with a
    Gaussian and take the half level. Wobble shorter than SMOOTH averages away;
    anything larger keeps its shape, because a low-pass filter removes an
    amplitude, not a feature.

    🚨 PER CONNECTED COMPONENT, AND THAT IS THE WHOLE DESIGN OF THIS FUNCTION.
    Blurring a muscle's two halves together SUMS them across the gap between,
    and at sigma as low as 1.1 that fused the left and right glutes into one
    blob — exactly the anatomy this must not lose. Competing components take the
    MAX instead: a component's own blurred indicator is below the half level
    everywhere outside itself, so no amount of blur carries one across a gap.
    Measured — the glutes stay two pieces out to sigma 16, where the union blur
    has them as one at 1.1. The V between the two hamstring heads, the channels
    between the ab blocks and the sternum gap all ride on this.

    The winner-takes-all across every id also keeps the result a PARTITION.
    Smoothing each muscle on its own would let two neighbours both claim a
    boundary pixel — one would paint over the other — or both give it up and
    leave a sliver of bare paper between them.
    """
    best = np.zeros(seg.shape, np.float32)
    who = np.zeros(seg.shape, np.int16)
    for i in ids:
        # Open first, same as the trace used to: it drops single-pixel specks
        # and hairline bridges, and a bridge left in would be smoothed into a
        # real one — that is how two ab blocks merged on the first attempt.
        m = ndi.binary_opening(seg == i, np.ones((3, 3)))
        if not m.any():
            continue
        lab, n = ndi.label(m)
        for k in range(1, n + 1):
            f = ndi.gaussian_filter((lab == k).astype(np.float32), SMOOTH)
            take = f > best
            who[take] = i
            best[take] = f[take]
    who[best <= 0.5] = 0
    return who


def pieces(m):
    """How many separate lumps of this mask the trace would actually emit."""
    lb, n = ndi.label(m)
    return int((np.bincount(lb.ravel(), minlength=n + 1)[1:] >= TURD).sum())


def fmt(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def trace(mask):
    # potrace.Bitmap inverts whatever it is handed, and thresholds anything that
    # is not bool at 127 — so pass the complement, as bool.
    path = potrace.Bitmap(~mask.astype(bool)).trace(
        turdsize=TURD, turnpolicy=potrace.POTRACE_TURNPOLICY_MAJORITY,
        alphamax=1.0, opticurve=True, opttolerance=OPTTOL)
    out = []
    for curve in path:
        out.append(f"M{fmt(curve.start_point.x)} {fmt(curve.start_point.y)}")
        for seg in curve:
            e = seg.end_point
            if seg.is_corner:
                out.append(f"L{fmt(seg.c.x)} {fmt(seg.c.y)}L{fmt(e.x)} {fmt(e.y)}")
            else:
                out.append(f"C{fmt(seg.c1.x)} {fmt(seg.c1.y)} "
                           f"{fmt(seg.c2.x)} {fmt(seg.c2.y)} {fmt(e.x)} {fmt(e.y)}")
        out.append("Z")
    return "".join(out)


def finish_view(view, seg, names, idx, alpha, body, ink_path, ink_size=None):
    """Smooth, guard, trace and write the ink. SHARED BY BOTH FIGURES.

    Everything above this point is a reading of one particular drawing.
    Everything from here down is what makes an outline good, and it is the same
    work whichever figure asked for it.
    """
    # Smoothed for the TRACE only. `seg` itself is left alone, so the ink
    # layer above is still solved against the pixels the drawing actually
    # has and the reconstruction error is unchanged.
    fills = smooth_fills(seg, [idx[nm] for nm in names])

    # 🚨 THE GUARD ON SMOOTH. A muscle drawn in two pieces has to stay in
    # two pieces: the left and right glutes, the two hamstring heads, the
    # ab blocks.
    #
    # ⚠️ IT IS NOT GUARDING AGAINST FUSION — smooth_fills cannot fuse two
    # pieces at any sigma, which was checked out to 16 while the union blur
    # it replaced fuses the glutes at 1.1. What it catches is the opposite
    # end: a piece pinched IN TWO at its waist, or eroded below the trace's
    # own floor and silently dropped. Measured: SMOOTH 4.0 splits a back
    # forearm into three, and 6.0 shrinks one of the three away again — so
    # the count is not even monotonic in sigma and is worth asserting.
    #
    # Counted at TURD, because that is the trace's own floor — smaller
    # pieces never reach the SVG either way, and counting them made this
    # fire on two sub-24px specks beside the chest that nothing has ever
    # drawn.
    for nm in names:
        was = pieces(ndi.binary_opening(seg == idx[nm], np.ones((3, 3))))
        now = pieces(fills == idx[nm])
        if was != now:
            sys.exit(f"{view}: smoothing changed {nm} from {was} pieces to {now}. "
                     f"SMOOTH={SMOOTH} is reshaping the drawing rather than "
                     f"tidying it — lower it rather than accepting this.")

    paths = {}
    for nm in names:
        m = fills == idx[nm]
        if m.sum() >= 200:
            paths[nm] = trace(m)
    # NOT smoothed, and deliberately. The silhouette is the paper the whole
    # figure is printed on: it is never stroked, it sits behind the ink, and
    # nothing about it reads as bumpy. Smoothing it is safe enough — at
    # SMOOTH it stays one piece and loses 72px of 386,000 — but it buys
    # nothing visible, and the fills are the only thing Tim was looking at.
    silhouette = trace(ndi.binary_closing(body, np.ones((5, 5))))

    img = Image.fromarray((alpha * 255).round().astype(np.uint8), "L")
    # The SVG scales this to the figure box whatever its pixel size, so a view
    # whose source was smaller than the box is written at its own scale rather
    # than upsampled into a bigger file carrying no more detail.
    if ink_size and ink_size != img.size:
        img = img.resize(ink_size, Image.LANCZOS)
    img.save(ink_path, quality=QUALITY, method=6)
    kb = os.path.getsize(ink_path) / 1024
    print(f"    {len(paths)} muscles, {sum(len(d) for d in paths.values())/1024:.1f} KB "
          f"of path data, ink {img.size[0]}x{img.size[1]} {kb:.0f} KB")
    return dict(paths=paths, body=silhouette)


def emit(out_name, const, figure, gap, views, ink_glob):
    w, h = figure
    js = [
        "// GENERATED by tools/build-body-art.py — do not hand-edit.",
        "//",
        "// One traced path per muscle group per view, plus the body silhouette.",
        "// These carry colour and hit-testing only; every keyline, striation and",
        f"// shadow lives in the ink masks at {ink_glob}. See the tool for why.",
        "",
        f"export const FIGURE = {{ w: {w}, h: {h}, gap: {gap} }};",
        "",
        f"export const {const} = {{",
    ]
    for view in ("front", "back"):
        js.append(f"  {view}: {{")
        js.append(f"    body: '{views[view]['body']}',")
        js.append("    muscles: {")
        for nm, d in sorted(views[view]["paths"].items()):
            js.append(f"      '{nm}': '{d}',")
        js.append("    },")
        js.append("  },")
    js.append("};")
    js.append("")
    out = os.path.join(ROOT, "js", out_name)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(js))
    print(f"\nwrote {out} ({os.path.getsize(out)/1024:.1f} KB)")
    return {v: set(views[v]["paths"]) for v in views}


def build_male():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC} — it is git-ignored; restore the working file to rebuild")
    figures = crop_figures()

    views = {}
    for view in ("front", "back"):
        a = figures[view]
        seg, lab, body, names, idx = segment(view, a)
        alpha, seg, base = ink_layer(a, seg, lab, body)

        # Fidelity: rebuild the drawing from its own base colours.
        flat = np.where(body[..., None], base, 1.0)
        flat[seg == 0] = 1.0
        err = np.abs(flat * (1 - alpha[..., None]) - a).max(axis=2) * 255
        paper = body & (seg == 0)
        print(f"\n{view}: reconstruction error vs the source")
        print(f"    muscle  p50 {np.percentile(err[seg > 0], 50):5.1f}  "
              f"p90 {np.percentile(err[seg > 0], 90):5.1f}  "
              f"p99 {np.percentile(err[seg > 0], 99):5.1f} / 255")
        print(f"    paper   p50 {np.percentile(err[paper], 50):5.1f}  "
              f"p90 {np.percentile(err[paper], 90):5.1f}  "
              f"p99 {np.percentile(err[paper], 99):5.1f} / 255")

        views[view] = finish_view(
            view, seg, names, idx, alpha, body,
            os.path.join(ROOT, "img", f"ink-{view}.webp"))

    return emit("body-art.js", "ART", FIGURE, GAP, views, "img/ink-*.webp")


def build_female():
    for p in SRC_F.values():
        if not os.path.exists(p):
            sys.exit(f"missing {p} — it is git-ignored; restore the working file to rebuild")

    views = {}
    for view in ("front", "back"):
        lum, body, src = female_source(view)
        print(f"\n{view} (female): source body {src[0]}x{src[1]}, "
              f"scaled to {FIGURE_F[0]}x{FIGURE_F[1]}")

        # 🚨 THE CHECK THAT CATCHES A LEAKED SILHOUETTE. Every ignored region is
        # a place the drawing encloses and the app leaves unpainted; if the
        # background flooded into one, its seed is outside the body and the
        # figure would render with a hole where a foot or a hand should be.
        for (x, y) in IGNORE_F[view]:
            if not body[y, x]:
                sys.exit(f"{view} (female): ({x},{y}) is outside the silhouette. "
                         f"The background flooded through a gap in the outline — "
                         f"see female_body(), and do not paper over it by moving "
                         f"the seed.")

        seg, names, idx = segment_female(view, lum, body)
        alpha = female_ink(lum, body)
        # Write the ink at the source's own scale rather than at the box's. The
        # back drawing is 1067px tall against the box's 1527, and upsampling it
        # would cost 40 % of a precached file to carry detail it does not have.
        ink_h = min(src[1], FIGURE_F[1])
        views[view] = finish_view(
            view, seg, names, idx, alpha, body,
            os.path.join(ROOT, "img", f"ink-{view}-female.webp"),
            ink_size=(int(round(FIGURE_F[0] * ink_h / FIGURE_F[1])), ink_h))

    return emit("body-art-female.js", "ART", FIGURE_F, GAP_F, views,
                "img/ink-*-female.webp")


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        i = args.index("--only")
        only = args[i + 1] if i + 1 < len(args) else None
    for arg in args:
        if arg.startswith("--only="):
            only = arg.split("=", 1)[1]
    if only not in (None, "male", "female"):
        sys.exit("--only takes male or female")
    os.makedirs(os.path.join(ROOT, "img"), exist_ok=True)

    male = build_male() if only in (None, "male") else None
    female = build_female() if only in (None, "female") else None

    # 🚨 THE TWO FIGURES MUST DRAW THE SAME GROUPS IN THE SAME VIEWS. The app
    # reads MAPPED_MUSCLES from one of them and asserts against the standards
    # table, so a group present on one figure and missing from the other would
    # rank on one person's map and show as "nothing recorded" on another's.
    if male and female:
        for view in ("front", "back"):
            if male[view] != female[view]:
                miss = sorted(male[view] ^ female[view])
                sys.exit(f"{view}: the two figures draw different groups — {miss}")
        print("\nboth figures draw the same groups in the same views")


if __name__ == "__main__":
    main()
