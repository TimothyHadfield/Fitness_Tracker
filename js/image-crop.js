// Positioning a photo inside a circle — pure maths, no DOM.
//
// Tim, 2026-08-26: "sometimes the user's face isn't centered and large in the
// middle... I want the site to display the image the user imported with a
// circle in the middle showing what their profile icon is actually going to
// look like. The user can move this to any part of the image and also zoom it
// in or out."
//
// ⚠️ THE WHOLE MODEL IS IN SOURCE PIXELS, NOT SCREEN PIXELS, and that is what
// makes the result independent of the size of the phone it was cropped on. The
// crop is a SQUARE of side `s` centred at (cx, cy) in the image's own
// coordinates. Zoom shrinks `s`; panning moves the centre. The screen is only
// ever a view onto that, computed by layout() at the end.
//
// ⚠️ THE ONE INVARIANT: the crop square is ALWAYS entirely inside the image.
// Clamping is not politeness, it is what stops somebody dragging their face to
// the edge and storing an avatar with a blank wedge in it — a state the round
// display would render as a broken image rather than as a choice. Every
// function that can move the square re-clamps, so no caller can forget.
//
// The output is a square; the editor masks it to a circle because every surface
// that shows an avatar rounds it. The corners are stored and simply never seen,
// which is what leaves a square display possible later without re-cropping.

/** The zoomed-OUT and zoomed-IN limits on the crop square, in source pixels. */
export function cropBounds(imageW, imageH) {
  const maxSide = Math.max(1, Math.min(imageW, imageH));
  // ⚠️ Four times in, but never below 64 source pixels, and never past the
  // image itself. The floor is what keeps a small image usable: a 200px avatar
  // photo would otherwise have a zoom range of nothing. The ceiling is the
  // short edge, because a crop wider than the image cannot be filled.
  const minSide = Math.min(maxSide, Math.max(64, maxSide / 4));
  return { minSide, maxSide };
}

/** Slider position (0 = right out, 1 = right in) → crop side in source px. */
export function sideForZoom(imageW, imageH, t) {
  const { minSide, maxSide } = cropBounds(imageW, imageH);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  return maxSide + clamped * (minSide - maxSide);
}

/** The inverse, so a stored crop can reopen on the slider position it had. */
export function zoomForSide(imageW, imageH, side) {
  const { minSide, maxSide } = cropBounds(imageW, imageH);
  if (maxSide === minSide) return 0;
  const t = (side - maxSide) / (minSide - maxSide);
  return Math.min(1, Math.max(0, t));
}

/** True when the image is too small to zoom at all — the slider says so. */
export function canZoom(imageW, imageH) {
  const { minSide, maxSide } = cropBounds(imageW, imageH);
  return maxSide - minSide > 0.5;
}

/** Hold the crop square inside the image. Every mover goes through this. */
export function clampCentre(imageW, imageH, side, cx, cy) {
  const half = side / 2;
  // A square as wide as the image has exactly one legal centre, and the two
  // bounds meet rather than crossing. max() before min() would invert it.
  const clamp1 = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  return {
    cx: clamp1(Number.isFinite(cx) ? cx : imageW / 2, half, imageW - half),
    cy: clamp1(Number.isFinite(cy) ? cy : imageH / 2, half, imageH - half),
  };
}

/** Where a freshly opened photo starts: dead centre, zoomed right out. */
export function initialCrop(imageW, imageH) {
  const side = sideForZoom(imageW, imageH, 0);
  const { cx, cy } = clampCentre(imageW, imageH, side, imageW / 2, imageH / 2);
  return { zoom: 0, cx, cy };
}

/**
 * The rect to hand `drawImage`. ⚠️ Rounded OUTWARD-SAFE: the rounding happens
 * before the final clamp, so a rounded rect can never end up a pixel past the
 * edge — which draws a transparent line down one side of the avatar and is
 * invisible until somebody looks at the corner of a round image.
 */
export function cropRect(imageW, imageH, zoom, cx, cy) {
  const side = sideForZoom(imageW, imageH, zoom);
  const c = clampCentre(imageW, imageH, side, cx, cy);
  const s = Math.max(1, Math.min(Math.floor(side), Math.min(imageW, imageH)));
  const x = Math.min(Math.max(0, Math.round(c.cx - s / 2)), imageW - s);
  const y = Math.min(Math.max(0, Math.round(c.cy - s / 2)), imageH - s);
  return { x, y, side: s };
}

/**
 * Dragging. ⚠️ THE SIGN IS THE BUG THAT LIVES HERE: dragging the picture to the
 * right shows more of its LEFT side, so the crop centre moves the other way.
 * `frame` is the stage's on-screen side, which is the only screen measurement
 * this module takes.
 */
export function panBy(imageW, imageH, zoom, cx, cy, dxScreen, dyScreen, frame) {
  const side = sideForZoom(imageW, imageH, zoom);
  const perScreenPx = frame > 0 ? side / frame : 0;
  return clampCentre(imageW, imageH, side,
    cx - dxScreen * perScreenPx,
    cy - dyScreen * perScreenPx);
}

/**
 * Zooming keeps the crop centre where it is, then re-clamps — so zooming out
 * near an edge slides the square back inside rather than refusing to move.
 */
export function zoomTo(imageW, imageH, nextZoom, cx, cy) {
  const side = sideForZoom(imageW, imageH, nextZoom);
  const t = Math.min(1, Math.max(0, Number.isFinite(nextZoom) ? nextZoom : 0));
  return { zoom: t, ...clampCentre(imageW, imageH, side, cx, cy) };
}

/**
 * Where to put the <img> so that the crop square lands exactly on the stage.
 * The editor is then literally a window onto the crop: what the circle covers
 * is what cropRect() will cut, with no second opinion about the geometry.
 */
export function layout(imageW, imageH, zoom, cx, cy, frame) {
  const side = sideForZoom(imageW, imageH, zoom);
  const c = clampCentre(imageW, imageH, side, cx, cy);
  const scale = side > 0 ? frame / side : 1;
  return {
    scale,
    width: imageW * scale,
    height: imageH * scale,
    left: frame / 2 - c.cx * scale,
    top: frame / 2 - c.cy * scale,
  };
}
