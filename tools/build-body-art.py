#!/usr/bin/env python3
"""Turn the muscle-group illustration into the app's body map.

    python tools/build-body-art.py

Reads  Human_Muscle_Groups.jpg  (git-ignored working file, not shipped)
Writes js/body-art.js           generated — do not hand-edit
       img/ink-front.webp
       img/ink-back.webp

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

import json
import os
import sys

import numpy as np
import potrace
from PIL import Image
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


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC} — it is git-ignored; restore the working file to rebuild")
    os.makedirs(os.path.join(ROOT, "img"), exist_ok=True)
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

        ink_path = os.path.join(ROOT, "img", f"ink-{view}.webp")
        Image.fromarray((alpha * 255).round().astype(np.uint8), "L").save(
            ink_path, quality=QUALITY, method=6)
        kb = os.path.getsize(ink_path) / 1024
        print(f"    {len(paths)} muscles, {sum(len(d) for d in paths.values())/1024:.1f} KB "
              f"of path data, ink {kb:.0f} KB")
        views[view] = dict(paths=paths, body=silhouette)

    w, h = FIGURE
    js = [
        "// GENERATED by tools/build-body-art.py — do not hand-edit.",
        "//",
        "// One traced path per muscle group per view, plus the body silhouette.",
        "// These carry colour and hit-testing only; every keyline, striation and",
        "// shadow lives in the ink masks at img/ink-*.webp. See the tool for why.",
        "",
        f"export const FIGURE = {{ w: {w}, h: {h}, gap: {GAP} }};",
        "",
        "export const ART = {",
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
    out = os.path.join(ROOT, "js", "body-art.js")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(js))
    print(f"\nwrote {out} ({os.path.getsize(out)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
