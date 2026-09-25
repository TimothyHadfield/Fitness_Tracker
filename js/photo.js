/* ==========================================================================
   photo.js — one picture per workout (2026-09-25).

   Tim: *"I also want you to start deploying the "take a picture" feature we
   talked about after a workout."* Asked the same day, he chose **free, no
   card** (a shrunk photo stored in Firestore, the way the profile photo is —
   no Cloud Storage, which needs the paid plan) and **visible to whoever can
   see the workout**. docs/onboarding-plan.md part C.

   WHAT LIVES WHERE
   - The session row carries `photo: { w, h }` — the SIZE, never the picture.
     It is what tells a card to hold a box of the right shape before a single
     byte of image has arrived, so nothing on the screen moves when it lands.
   - The picture itself is its OWN document, users/{uid}/photos/{sessionId}
     (`{ image, w, h, updatedAt }`), never inside the published projection:
     that document has a 1 MiB ceiling shared with sixty sessions, and one
     photo is up to a fifth of it.
   - Who may read it is firestore.rules — the same people who can read the
     published workout (a friend on the viewers list, or anybody signed in when
     the account is public). Local and demo accounts keep it on this device /
     in memory (store.js).

   This module is the part that can be asserted without a browser: the size
   arithmetic, the quality ladder and the validators. The DOM helpers at the
   bottom touch `document` only when called, so importing it in Node is safe.
   It imports nothing, so social.js (pure) and ui-free callers can use it.
   ========================================================================== */

/** Longest side of a stored photo, in pixels. */
export const PHOTO_MAX_SIDE = 1080;

/** The JPEG, decoded, may not be bigger than this. 150 KiB. */
export const PHOTO_MAX_BYTES = 150 * 1024;

/**
 * The stored string may not be longer than this — mirrored in firestore.rules
 * (`validPhoto`). 150 KiB of JPEG is 204,800 base64 characters plus the
 * 23-character `data:image/jpeg;base64,` prefix; the rest is headroom for
 * nothing. ⚠️ Change both or neither.
 */
export const MAX_PHOTO_CHARS = 210000;

/** Quality steps tried in order, best first. */
export const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42];

/** Below this long side the ladder gives up rather than store a postage stamp. */
export const MIN_SIDE = 480;

/** Each time every quality is too big, the picture shrinks by this. */
export const SHRINK_STEP = 0.8;

const PHOTO_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * The string if it is a picture this app will store or paint, else null.
 *
 * ⚠️ JPEG ONLY, and never a remote URL or an SVG — the same trust boundary
 * safeAvatar() draws in social.js: this string was written by another account
 * and is about to go into an `src`.
 */
export function safePhoto(value) {
  if (typeof value !== 'string' || value.length > MAX_PHOTO_CHARS) return null;
  return PHOTO_URL.test(value) ? value : null;
}

/** `{w, h}` as whole pixels inside the cap, or null. */
export function safePhotoSize(value) {
  if (!value || typeof value !== 'object') return null;
  const { w, h } = value;
  const good = (n) => Number.isInteger(n) && n >= 1 && n <= PHOTO_MAX_SIDE;
  return good(w) && good(h) ? { w, h } : null;
}

/** Scale (w, h) so the long side is at most `max`. Never enlarges. */
export function fitSize(w, h, max = PHOTO_MAX_SIDE) {
  if (!(w > 0 && h > 0)) return null;
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Decoded bytes behind a base64 data URL. */
export function dataUrlBytes(url) {
  if (typeof url !== 'string') return Infinity;
  const i = url.indexOf(',');
  const b64 = i >= 0 ? url.slice(i + 1) : url;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/**
 * The quality ladder, with the encoder handed in so it runs in Node.
 *
 * Tries every quality at 1080px first; only when even the lowest is too big
 * does the picture get smaller, and then the ladder starts again. A noisy
 * 12-megapixel phone photo lands on the first or second rung; this loop is
 * for the photo that does not.
 *
 * @param {(w:number, h:number, q:number) => (string|Promise<string>)} encode
 * @returns {Promise<{url, w, h, quality, bytes, tries}>}
 */
export async function compressToFit(encode, w, h, {
  maxBytes = PHOTO_MAX_BYTES, maxSide = PHOTO_MAX_SIDE,
} = {}) {
  let size = fitSize(w, h, maxSide);
  if (!size) throw new Error('That image could not be read.');
  let tries = 0;
  for (;;) {
    for (const q of QUALITY_STEPS) {
      const url = await encode(size.w, size.h, q);
      tries++;
      const bytes = dataUrlBytes(url);
      if (bytes <= maxBytes && safePhoto(url)) {
        return { url, w: size.w, h: size.h, quality: q, bytes, tries };
      }
    }
    const long = Math.max(size.w, size.h);
    const next = fitSize(size.w, size.h, Math.floor(long * SHRINK_STEP));
    if (!next || Math.max(next.w, next.h) < MIN_SIDE) {
      throw new Error('That photo could not be made small enough to save.');
    }
    size = next;
  }
}

/** How a card box is shaped: the photo's own ratio, kept between 4:5 and 1.91:1. */
export function boxRatio(size) {
  const s = safePhotoSize(size);
  if (!s) return 4 / 3;
  return Math.min(1.91, Math.max(0.8, s.w / s.h));
}

/**
 * 🆕 FROM ONE BOX TO ANOTHER — docs/motion2-plan.md package E, 2026-09-25.
 * Tim: *"Put professional level annimation and physics into this cite."*
 *
 * The transform that makes an element whose resting box is `box` appear on top
 * of `target` instead: `{ x, y, scale }` for a spring (js/spring.js
 * `springTransform`) with `transform-origin: 0 0` on the element. One uniform
 * scale, the target's width over the box's — a picture keeps its shape, and a
 * whole screen shrinking into a bar keeps its own.
 *
 * Spring FROM this to identity and a thing grows out of `target` (a photo
 * opening from its thumbnail, the runner coming back up out of its bar); spring
 * TO it and the thing goes into `target` (the runner minimising). Pure, so it is
 * tested without a browser. Boxes are `{ x|left, y|top, w|width }`.
 */
export function rectFlight(box, target) {
  const bx = box.x != null ? box.x : box.left;
  const by = box.y != null ? box.y : box.top;
  const bw = box.w != null ? box.w : box.width;
  const tx = target.x != null ? target.x : target.left;
  const ty = target.y != null ? target.y : target.top;
  const tw = target.w != null ? target.w : target.width;
  if (![bx, by, bw, tx, ty, tw].every(Number.isFinite) || bw <= 0) return { x: 0, y: 0, scale: 1 };
  return { x: tx - bx, y: ty - by, scale: Math.max(0.05, tw / bw) };
}

/* ------------------------------------------------------------------ *
 * Browser half
 * ------------------------------------------------------------------ */

/**
 * A picked File → `{ url, w, h, bytes, quality }`, ready to store.
 *
 * ⚠️ Decoded through an <img>, not createImageBitmap — the reason
 * views-account.js gives for the avatar: an <img> applies the EXIF rotation,
 * so a photo taken upright is stored upright.
 */
export function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = () => URL.revokeObjectURL(url);
    img.onerror = () => { done(); reject(new Error('That image could not be read.')); };
    img.onload = async () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) throw new Error('That image could not be read.');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('That image could not be read.');
        const encode = (cw, ch, q) => {
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, cw, ch);
          }
          return canvas.toDataURL('image/jpeg', q);
        };
        const out = await compressToFit(encode, w, h);
        // Free the big bitmap on iOS, which is stingy with canvas memory.
        canvas.width = 1; canvas.height = 1;
        done();
        resolve(out);
      } catch (err) { done(); reject(err); }
    };
    img.src = url;
  });
}

function h(tag, cls, ...kids) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k of kids) if (k != null) n.append(k);
  return n;
}

/* 🆕 THE FULL-SCREEN VIEWER lives in js/ui.js (Motion 2 · Surfaces,
 * 2026-09-25), which this module cannot import — it imports nothing, so pure
 * callers can use it. ui.js hands the viewer in here instead. */
let opener = null;
/** ui.js registers `openPhotoViewer({ src, from, alt })` through this. */
export function setPhotoOpener(fn) { opener = typeof fn === 'function' ? fn : null; }

/**
 * A loaded photo becomes a button that opens the viewer — but only where it is
 * not already inside a link or a button: a feed card's photo is part of the
 * card's link and still opens the workout (views-workouts.js attachCardPhoto).
 */
function makeOpenable(box, img, src, alt) {
  if (!opener || !box.isConnected || (box.closest && box.closest('a, button'))) return;
  box.classList.add('is-openable');
  box.setAttribute('role', 'button');
  box.setAttribute('aria-label', 'Open photo');
  box.tabIndex = 0;
  // `byKey`: only a keyboard opening gets focus handed back to the box on
  // close — after a tap that would paint a focus ring on the photo.
  const open = (byKey) => { if (opener) opener({ src, from: img, alt, byKey }); };
  box.addEventListener('click', () => open(false));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
  });
}

/* One shared observer for every photo box on the page. */
let observer = null;
const starters = new WeakMap();
function watch(node, start) {
  if (typeof IntersectionObserver !== 'function') {
    // No observer (old browser, jsdom): load now. Correct, just not lazy.
    Promise.resolve().then(start);
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);
        const fn = starters.get(e.target);
        starters.delete(e.target);
        if (fn) fn();
      }
    }, { rootMargin: '400px 0px' });
  }
  starters.set(node, start);
  observer.observe(node);
}

/**
 * The picture on a card or a detail screen: a box of the photo's own shape,
 * drawn at once, filled when it comes near the screen.
 *
 * ⚠️ THE BOX IS THERE BEFORE THE PICTURE, sized from `size` (the session's
 * `photo: {w, h}`), so the feed paints first and nothing below moves when the
 * image lands. `load` is called at most once, only when the box is within
 * 400px of the viewport — a card nobody scrolls to costs no read.
 *
 * @param {object} o
 *   size  {w, h} from the session row / projection (may be absent)
 *   load  () => Promise<string|null>  the data URL, or null if unreadable
 */
export function photoBox({ size, load, alt = 'Workout photo' }) {
  const box = h('div', 'card-photo');
  box.style.aspectRatio = String(boxRatio(size));
  const img = h('img', 'card-photo-img');
  img.alt = alt;
  img.decoding = 'async';
  box.append(img);
  let started = false;
  watch(box, () => {
    if (started) return;
    started = true;
    Promise.resolve()
      .then(load)
      .then((url) => {
        const safe = safePhoto(url);
        // ⚠️ A box for a photo that turned out unreadable (deleted, access
        // withdrawn) goes away rather than sitting there empty. It is the one
        // case where something moves, and only on a failure.
        if (!safe) { box.hidden = true; return; }
        img.onload = () => { box.classList.add('is-loaded'); makeOpenable(box, img, safe, alt); };
        img.src = safe;
      })
      .catch(() => { box.hidden = true; });
  });
  return box;
}

/**
 * The Photo control on the save and edit screens.
 *
 * Holds one picture: none → an "Add photo" button; one → the preview with
 * Replace and Remove. Nothing is written here — `onChange` hands the caller
 * `{url, w, h}` or null, and the caller writes on Save, like every other field
 * on those two screens.
 *
 * @param {object} o
 *   initial   {url, w, h} | null            what is stored now
 *   loadInitial () => Promise<{url,w,h}|null>  optional: fetch it after drawing
 *   onChange  (next | null) => void
 *   onError   (message) => void             e.g. toast
 */
export function photoField({ initial = null, loadInitial = null, onChange, onError = () => {} }) {
  let current = initial && safePhoto(initial.url) ? initial : null;
  let busy = false;
  // Once the person has touched the control, a late `loadInitial` answer must
  // not put back a photo they just removed or replaced.
  let touched = false;

  const input = h('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.hidden = true;
  input.setAttribute('aria-label', 'Choose a photo');
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    touched = true;
    busy = true;
    paint();
    try {
      const out = await shrinkPhoto(file);
      current = { url: out.url, w: out.w, h: out.h };
      onChange(current);
    } catch (err) {
      onError((err && err.message) || 'That image could not be read.');
    } finally {
      busy = false;
      paint();
    }
  });

  const wrap = h('div', 'field photo-field');
  const label = h('label', null, 'Photo');
  const body = h('div', 'photo-field-body');
  wrap.append(label, body, input);

  const btn = (text, cls, fn) => {
    const b = h('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };

  function paint() {
    body.replaceChildren();
    if (busy) {
      body.append(h('div', 'photo-field-busy field-help', 'Shrinking photo…'));
      return;
    }
    if (!current) {
      body.append(btn('Add photo', 'btn photo-add', () => input.click()));
      return;
    }
    const thumb = h('div', 'photo-thumb');
    const img = h('img');
    img.alt = 'Workout photo';
    img.src = current.url;
    thumb.append(img);
    body.append(thumb, h('div', 'photo-field-actions',
      btn('Replace', 'btn small', () => input.click()),
      btn('Remove', 'btn small ghost', () => {
        touched = true; current = null; onChange(null); paint();
      })));
  }
  paint();

  if (!current && typeof loadInitial === 'function') {
    Promise.resolve().then(loadInitial).then((got) => {
      if (got && safePhoto(got.url) && !touched && !current && !busy) { current = got; paint(); }
    }).catch(() => {});
  }
  return wrap;
}
