/* ==========================================================================
   share-image.js — one recorded session as a PNG somebody can post.

   Canvas → PNG → `navigator.share({ files })`, with a download when the share
   sheet is not there. No backend, no upload, no fetch: the image is made on
   the phone and handed to the phone's own share sheet (social-plan §12.6,
   §13 Step 8).

   ── THE SPLIT, AND WHY IT IS THE WHOLE POINT ──────────────────────────────

   `shareCardLayout()` is PURE — no canvas, no DOM, no clock, no measuring. It
   returns a plain description of what goes where. `drawShareCard()` is a thin
   walk over that description that paints it. This is the same division
   `js/qr.js` uses and for the same reason: a layout object can be asserted on
   in Node and a canvas cannot. Every judgement worth pinning — what gets
   dropped, what gets truncated, how many exercises fit — lives in the first
   half, where tests/share-image.test.mjs can reach it.

   ── ⚠️ NO WEIGHTS ON THIS IMAGE, AND THAT IS NOT AN OVERSIGHT ─────────────

   Sets and minutes, never volume, never a number in pounds. Two reasons, and
   the second is the one that decides it:

     - This picture LEAVES THE APP. It lands in a group chat or on a feed with
       no privacy tier around it, and somebody's working weights are theirs.
     - For a friend's session a volume figure would also be WRONG. It needs
       their body weight for a pull-up and a `loadType` lookup for a dumbbell,
       and neither travels with a shared workout — so a hard session of
       chin-ups would render as zero. js/session-stats.js makes exactly this
       call for the feed card and states it at length; this file inherits it.

   ── DESIGN RULE 2 ("no boxes"), AND WHY THE BACKGROUND IS NOT A BREACH ────

   The stylesheet's Rule 2 bans nested bordered cards INSIDE a screen, because
   a screen already has a ground to sit on and every extra border is 2px of
   height between the reader and the number. Here there is no screen. The PNG
   is a standalone object dropped onto somebody else's feed, and a transparent
   or edge-to-edge image would take its background from whatever app is
   showing it — white text on a white chat bubble. So this file paints ONE
   ground fill and keeps a real margin, and then obeys Rule 2 completely
   inside that: not a single border, panel or pill. Structure comes from two
   hairlines, spacing and type weight, exactly as it does on screen.

   ── FONTS ────────────────────────────────────────────────────────────────

   The app's own `--sans` stack, resolved off the live stylesheet, and NO
   external font file. D6 is offline-first; a gym basement cannot fetch a
   webfont, and a share button that only works on wifi is not a share button.

   Colours are read off `document.documentElement` at draw time so the image
   matches the theme the person is actually looking at — there are six of them
   and a hard-coded palette would be wrong for five. The hexes below are the
   fallback for when there is no document at all (a test, a worker).
   ========================================================================== */

import { setsLabel } from './session-stats.js';

/* ────────────────────────────── the canvas ──────────────────────────────── */

// 1080 wide is the size every phone share target expects.
//
// ⚠️ THE HEIGHT IS NOT A CONSTANT, AND THAT WAS THE BUG. It used to be a flat
// 1350, and the two failures that came out of a real render were the same
// measurement wrong in opposite directions: a short session left a third of
// the picture empty under the last row, and a caller asking for a square got
// "+2 more" printed over two rows of blank space. A picture that is taller
// than its contents is a picture that reads as a failed render.
//
// So the card is now as tall as what is in it, clamped between a square and
// the 4:5 portrait that chat apps and feeds crop least. `opts.height` still
// forces a size — and when it is bigger than the content, the leftover is
// SPLIT between top and bottom rather than dumped at the end.
const WIDTH = 1080;
const MIN_HEIGHT = 1080;
const MAX_HEIGHT = 1350;

// One margin, used on all four sides. Generous on purpose: this image gets
// shown at thumbnail size before anybody taps it, and a tight edge is the
// first thing that reads as cheap.
const MARGIN = 84;

/* ─────────────────────── measuring without a measurer ───────────────────── */

/**
 * ⚠️ THE CHARACTER-CAP RULE, WHICH IS THE ONE HONEST COMPROMISE HERE.
 *
 * The pure half must not measure text — `ctx.measureText` needs a canvas, and
 * a layout that needs a canvas cannot be tested. So width is ESTIMATED as
 * `characters × size × AVG_ADVANCE` and every string is capped to fit.
 *
 * 0.55em is a deliberately pessimistic average advance for the system sans at
 * mixed case: 'W' runs about 0.95em and 'i' about 0.24em, and ordinary English
 * averages nearer 0.50em, so this leaves roughly 10% of headroom for a wide
 * string like an all-caps gym name. Over-estimating truncates a little early;
 * under-estimating runs text off the edge of a picture somebody has already
 * posted. Early is the failure to prefer.
 *
 * The painted half then RE-CHECKS with real metrics (see `fitToCanvas`), so a
 * platform whose font is wider than this guess still cannot clip. The cap is
 * the guarantee the tests can see; the re-measure is the belt.
 */
const AVG_ADVANCE = 0.55;

// Ascent + descent for one line, as a multiple of font size. Used for the
// block's box, so `y` can mean the TOP of the text rather than its baseline —
// a top is something a test can add up, a baseline is not.
const LINE_BOX = 1.2;

/** How many characters of `size`px type fit across `maxWidth`. */
export function maxChars(size, maxWidth) {
  return Math.max(1, Math.floor(maxWidth / (size * AVG_ADVANCE)));
}

/** Estimated painted width of a string. Pure; see AVG_ADVANCE. */
export function estimateWidth(text, size) {
  return String(text).length * size * AVG_ADVANCE;
}

/** `text`, cut to `budget` characters with a real ellipsis if it overruns. */
function ellipsise(text, budget) {
  const s = String(text);
  if (s.length <= budget) return s;
  // The ellipsis costs a character, so the cut is one short of the budget.
  return s.slice(0, Math.max(0, budget - 1)).trimEnd() + '…';
}

/** One line of `text` that fits `maxWidth` at `size`, ellipsised if it must. */
export function fitLine(text, size, maxWidth) {
  return ellipsise(text, maxChars(size, maxWidth));
}

/**
 * Greedy word wrap by character budget. Breaks at the last space inside the
 * budget; a single word longer than a whole line is hard-broken rather than
 * allowed to overhang. Whatever will not fit in `maxLines` is folded into an
 * ellipsis on the last line, so the reader can see that there was more.
 */
export function wrapLines(text, size, maxWidth, maxLines) {
  const budget = maxChars(size, maxWidth);
  const lines = [];
  let rest = String(text).trim().replace(/\s+/g, ' ');
  while (rest && lines.length < maxLines) {
    if (rest.length <= budget) { lines.push(rest); rest = ''; break; }
    let cut = rest.lastIndexOf(' ', budget);
    if (cut <= 0) cut = budget;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest && lines.length) {
    lines[lines.length - 1] = ellipsise(`${lines[lines.length - 1]} ${rest}`, budget);
  }
  return lines;
}

/**
 * The rectangle a block covers, for bounds checking — in the painter, where it
 * decides how much room a string has, and in the tests, where it is how "no
 * block escapes the canvas" is asserted.
 */
export function blockBox(b) {
  if (b.kind === 'rule') {
    return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + 2 };
  }
  const w = estimateWidth(b.text, b.size);
  const left = b.align === 'right' ? b.x - w : b.x;
  return { left, top: b.y, right: left + w, bottom: b.y + b.size * LINE_BOX };
}

/* ──────────────────────────────── colours ───────────────────────────────── */

/**
 * The dark palette from css/app.css `:root`, used only when there is no
 * document to read the live theme off. Kept in the same order as the
 * stylesheet so the two are easy to diff by eye.
 */
export const FALLBACK_THEME = {
  ground: '#0F1214',
  ink: '#ECEFEE',
  inkSoft: '#C3CACE',
  inkFaint: '#A7B0B5',
  rule: '#242A2E',
  accent: '#D99A3E',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", '
      + 'system-ui, sans-serif',
};

/**
 * The tokens as they are RIGHT NOW on the live stylesheet. The app ships six
 * themes and lets people switch; baking one palette in would give five of them
 * an image that does not look like their app.
 *
 * ⚠️ Impure by design — it touches `document`, which is why it is here and not
 * inside `shareCardLayout()`. The layout takes the result as an argument.
 */
export function readTheme() {
  if (typeof document === 'undefined' || !document.documentElement) return { ...FALLBACK_THEME };
  const cs = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => {
    const v = cs.getPropertyValue(name);
    return (v && v.trim()) || fallback;
  };
  return {
    ground: tok('--ground', FALLBACK_THEME.ground),
    ink: tok('--ink', FALLBACK_THEME.ink),
    inkSoft: tok('--ink-soft', FALLBACK_THEME.inkSoft),
    inkFaint: tok('--ink-faint', FALLBACK_THEME.inkFaint),
    rule: tok('--rule', FALLBACK_THEME.rule),
    accent: tok('--accent', FALLBACK_THEME.accent),
    sans: tok('--sans', FALLBACK_THEME.sans),
  };
}

/* ──────────────────────────────── the date ──────────────────────────────── */

// ⚠️ NOT `toLocaleDateString`, unlike js/ui.js. Two reasons: this string is
// character-capped, and a cap can only be asserted if the string is the same
// in a test as it is on a phone; and the image travels to a reader whose
// locale is not the author's, where "8/26/26" is genuinely ambiguous. A
// caller that wants the device's own formatting passes `opts.dateText`.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

function fmtDate(iso) {
  if (typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/* ──────────────────────────────── the layout ────────────────────────────── */

// Type scale. Two sizes for the title: a long workout name steps down ONCE
// before it is allowed to truncate, because "Upper Body Strength" losing its
// last word is worse than the same words set slightly smaller. It does not
// step again — below this the name stops being the loudest thing on the card,
// which is the one job it has.
// ⚠️ TIGHTENED 2026-08-31, after the first real render. The old scale spent 646
// of a square card's 1080 pixels before the exercise list even started, which
// is what made four short rows "not fit" on a card with room to spare. Nothing
// here got small — the title is still by far the loudest thing on the card —
// but the air between things is now a gap rather than a gulf.
const TITLE_SIZES = [96, 76];
const SIZE_WHO = 38;
const SIZE_META = 36;
const SIZE_STAT = 80;
const SIZE_STAT_LABEL = 30;
const SIZE_NOTE = 38;
const SIZE_EXERCISE = 38;
const SIZE_EXERCISE_SETS = 34;
const SIZE_MORE = 34;
const SIZE_BRAND = 30;

// A hard ceiling on the list even when there is room. Twelve names at 38px is
// a wall of text nobody reads at thumbnail size; eight and a "+N more" says
// the same thing and stays a picture.
const MAX_EXERCISES = 8;

const NOTE_LINES = 2;

// Air between the last thing the session says and the wordmark under it.
// ⚠️ THIS IS THE WHOLE FOOTER RESERVE. It used to be this plus 40 more plus a
// row held back for a "+N more" that usually never came, and that surplus is
// exactly what got printed as an empty third of the picture.
const FOOTER_GAP = 40;

// Width kept clear on the right of every exercise row for its set count.
const SETS_COLUMN = 200;
const SETS_GAP = 24;

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * PURE. A session in, a description of the picture out.
 *
 *   shareCardLayout(data, opts)
 *     -> { width, height, naturalHeight, background, font, blocks }
 *
 * `data`  { title, who, date, minutes, sets, note, location, exercises[] }
 * `opts`  { height, theme, dateText }
 *
 * Every block is `{ kind, text, x, y, size, weight, color, align, maxWidth }`,
 * where `y` is the TOP of the line and `x` is the left edge (or, when
 * `align: 'right'`, the right edge). A `kind: 'rule'` block carries `width`
 * instead of text.
 *
 * ⚠️ A FIELD THAT IS MISSING PRODUCES NO BLOCK AND NO GAP. Not an empty
 * string, not "undefined", not a reserved space that reads as a mistake — the
 * cursor simply does not advance. A session with no note, no location and no
 * duration is a legitimate session and its card has to look deliberate.
 *
 * ⚠️ THE CARD IS AS TALL AS ITS CONTENTS. `height` is the canvas somebody gets;
 * `naturalHeight` is what the content actually came to, and with no `opts.height`
 * the first is the second clamped to [1080, 1350]. A caller that wants to pick
 * its own canvas can read `naturalHeight` off a throwaway layout first. When the
 * canvas ends up taller than the content — a forced height, or a session too
 * short to reach the square floor — the surplus is split evenly above and below,
 * so the card is centred rather than trailing a void under the last line.
 */
export function shareCardLayout(data, options) {
  const d = data && typeof data === 'object' ? data : {};
  const opts = options && typeof options === 'object' ? options : {};
  const theme = { ...FALLBACK_THEME, ...(opts.theme || {}) };
  const width = WIDTH;
  const inner = width - MARGIN * 2;

  // The height the content is allowed to grow INTO while it is being laid out.
  // A forced height is a real ceiling; otherwise the portrait limit is, and the
  // card settles wherever under it the content stops.
  const forced = finite(opts.height) && opts.height > 400 ? Math.round(opts.height) : null;
  const heightCap = forced || MAX_HEIGHT;

  const blocks = [];
  let y = MARGIN;
  const push = (b) => { blocks.push(b); return b; };
  // Advance past a line of `size` type, then leave `gap` after it.
  const advance = (size, gap) => { y += size * LINE_BOX + gap; };

  /* ---- who ---- */
  const who = clean(d.who);
  if (who) {
    push({
      kind: 'who', text: fitLine(who, SIZE_WHO, inner), x: MARGIN, y,
      size: SIZE_WHO, weight: 600, color: theme.inkSoft, align: 'left', maxWidth: inner,
    });
    advance(SIZE_WHO, 14);
  }

  /* ---- title ---- */
  // "Workout" rather than nothing: this is the largest thing on the card and
  // an empty slot there would look like a rendering failure, not like a
  // session somebody never named.
  const title = clean(d.title) || 'Workout';
  const titleSize = TITLE_SIZES.find((s) => title.length <= maxChars(s, inner))
    || TITLE_SIZES[TITLE_SIZES.length - 1];
  push({
    kind: 'title', text: fitLine(title, titleSize, inner), x: MARGIN, y,
    size: titleSize, weight: 700, color: theme.ink, align: 'left', maxWidth: inner,
  });
  advance(titleSize, 10);

  /* ---- date · location ---- */
  const dateText = clean(opts.dateText) || fmtDate(d.date);
  const meta = [dateText, clean(d.location)].filter(Boolean).join(' · ');
  if (meta) {
    push({
      kind: 'meta', text: fitLine(meta, SIZE_META, inner), x: MARGIN, y,
      size: SIZE_META, weight: 500, color: theme.inkFaint, align: 'left', maxWidth: inner,
    });
    advance(SIZE_META, 36);
  }

  /* ---- hairline, then the two honest figures ---- */
  push({ kind: 'rule', x: MARGIN, y, width: inner, color: theme.rule });
  y += 32;

  // Sets is always shown, including zero — a session that recorded nothing
  // says so. Minutes drops out entirely when it was never timed, and the
  // remaining column then takes the full width rather than sitting in a
  // half-empty grid.
  // The number and its word are split onto two lines here, but the SINGULAR is
  // still session-stats' to decide — "1 set" must not read differently on the
  // image than it does on the card it came from.
  const setCount = Math.max(0, Math.round(finite(d.sets) || 0));
  const stats = [{ value: String(setCount), label: setsLabel(setCount).split(' ')[1] }];
  const mins = finite(d.minutes);
  if (mins !== null && mins > 0) stats.push({ value: String(Math.round(mins)), label: 'minutes' });

  const colWidth = inner / stats.length;
  stats.forEach((s, i) => {
    const x = MARGIN + i * colWidth;
    push({
      kind: 'stat-value', text: fitLine(s.value, SIZE_STAT, colWidth), x, y,
      // The accent goes HERE and nowhere else on the card. These two numbers
      // are the entire claim the image makes, and one colour used once is the
      // cheapest hierarchy there is — cheaper than a box, which Rule 2 bans.
      size: SIZE_STAT, weight: 700, color: theme.accent, align: 'left', maxWidth: colWidth,
    });
    push({
      kind: 'stat-label', text: fitLine(s.label, SIZE_STAT_LABEL, colWidth),
      x, y: y + SIZE_STAT * LINE_BOX + 4,
      size: SIZE_STAT_LABEL, weight: 600, color: theme.inkFaint, align: 'left', maxWidth: colWidth,
    });
  });
  y += SIZE_STAT * LINE_BOX + 4 + SIZE_STAT_LABEL * LINE_BOX + 36;

  push({ kind: 'rule', x: MARGIN, y, width: inner, color: theme.rule });
  y += 32;

  /* ---- the note, if there is one ---- */
  const note = clean(d.note);
  if (note) {
    const lines = wrapLines(note, SIZE_NOTE, inner, NOTE_LINES);
    lines.forEach((text, i) => {
      push({
        kind: 'note', text, x: MARGIN, y: y + i * (SIZE_NOTE * 1.3),
        size: SIZE_NOTE, weight: 400, color: theme.inkSoft, align: 'left', maxWidth: inner,
      });
    });
    y += lines.length * (SIZE_NOTE * 1.3) + 30;
  }

  /* ---- the exercises, capped only when they genuinely will not fit ---- */
  const rowHeight = SIZE_EXERCISE * 1.5;
  const moreHeight = SIZE_MORE * LINE_BOX + 8;
  // Everything that has to sit under the last row: the gap, the wordmark, and
  // the bottom margin. Nothing else is reserved.
  const footerReserve = FOOTER_GAP + SIZE_BRAND * LINE_BOX + MARGIN;
  const listRoom = Math.max(0, heightCap - footerReserve - y);

  const all = Array.isArray(d.exercises) ? d.exercises.filter((e) => e && clean(e.name)) : [];
  // How many rows the card can hold at all, before any thought of an overflow
  // line. The ceiling stands: eight names is the most this stays a picture.
  const capacity = Math.max(0, Math.min(MAX_EXERCISES, Math.floor(listRoom / rowHeight)));

  let shown;
  let hidden;
  if (all.length <= capacity) {
    // ⚠️ THE WHOLE LIST FITS, SO NOTHING IS HELD BACK — this is the fix for the
    // square card that printed "+2 more" over two rows of blank space. Room for
    // a "+N more" is only found once there is an N, because a "+1 more" that
    // replaces the single row it hides costs the same height and says less.
    shown = all;
    hidden = 0;
  } else {
    // Something is genuinely being dropped, so the line announcing it has to be
    // paid for out of the same room the rows come from.
    const withMore = Math.max(0, Math.min(capacity, Math.floor((listRoom - moreHeight) / rowHeight)));
    shown = all.slice(0, withMore);
    hidden = all.length - shown.length;
  }

  const nameWidth = inner - SETS_COLUMN - SETS_GAP;
  shown.forEach((e, i) => {
    const rowY = y + i * rowHeight;
    push({
      kind: 'exercise', text: fitLine(clean(e.name), SIZE_EXERCISE, nameWidth),
      x: MARGIN, y: rowY,
      size: SIZE_EXERCISE, weight: 500, color: theme.ink, align: 'left', maxWidth: nameWidth,
    });
    const n = finite(e.sets);
    if (n !== null && n > 0) {
      push({
        kind: 'exercise-sets', text: fitLine(setsLabel(n), SIZE_EXERCISE_SETS, SETS_COLUMN),
        // Right-aligned to the margin: a ragged-left column of counts is the
        // hairline this card does not have to draw.
        x: width - MARGIN, y: rowY + (SIZE_EXERCISE - SIZE_EXERCISE_SETS) * 0.6,
        size: SIZE_EXERCISE_SETS, weight: 500, color: theme.inkFaint,
        align: 'right', maxWidth: SETS_COLUMN,
      });
    }
  });

  if (hidden > 0) {
    push({
      kind: 'more', text: `+${hidden} more`, x: MARGIN, y: y + shown.length * rowHeight + 8,
      size: SIZE_MORE, weight: 500, color: theme.inkFaint, align: 'left', maxWidth: inner,
    });
  }

  /* ---- the wordmark, directly under whatever the session said ---- */
  // ⚠️ IT FOLLOWS THE CONTENT; IT IS NOT PINNED TO THE BOTTOM OF THE CANVAS.
  // Pinning it was defect two: a short session put the wordmark 300px below the
  // last exercise and the picture read as a failed render. `blockBox` already
  // knows where everything ends, so ask it.
  const contentBottom = blocks.reduce((low, b) => Math.max(low, blockBox(b).bottom), MARGIN);
  // It is the only thing on the card that says where the picture came from,
  // and it is set faint on purpose: this is somebody's workout, not an advert.
  const brand = push({
    kind: 'brand', text: 'Fitness Tracker', x: MARGIN, y: contentBottom + FOOTER_GAP,
    size: SIZE_BRAND, weight: 600, color: theme.inkFaint, align: 'left', maxWidth: inner,
  });

  const naturalHeight = Math.round(blockBox(brand).bottom + MARGIN);
  const height = forced || Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, naturalHeight));

  // Whatever the canvas has over and above the content is SPLIT, not left at
  // the end. A forced size and the square floor both produce slack, and slack
  // in one lump under the last line is the thing that looks broken.
  const slack = Math.max(0, height - naturalHeight);
  if (slack > 0) {
    const shift = Math.round(slack / 2);
    for (const b of blocks) b.y += shift;
  }

  return { width, height, naturalHeight, background: theme.ground, font: theme.sans, blocks };
}

/* ──────────────────────────────── the paint ─────────────────────────────── */

/**
 * The second, untestable half: walk the blocks and draw them. Deliberately
 * contains no arithmetic anybody would want to assert on — if a decision shows
 * up in here, it is in the wrong file.
 */
export function drawShareCard(canvas, layout) {
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not draw the image.');

  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'top';

  for (const b of layout.blocks) {
    if (b.kind === 'rule') {
      ctx.fillStyle = b.color;
      // 2px, not 1: at 1080 wide this picture gets scaled DOWN by every viewer,
      // and a one-pixel hairline is the first thing resampling eats.
      ctx.fillRect(b.x, b.y, b.width, 2);
      continue;
    }
    ctx.font = `${b.weight} ${b.size}px ${layout.font}`;
    ctx.fillStyle = b.color;
    ctx.textAlign = b.align === 'right' ? 'right' : 'left';
    ctx.fillText(fitToCanvas(ctx, b.text, b.maxWidth), b.x, b.y);
  }
  return ctx;
}

/**
 * The second line of defence on clipping. The pure half capped this string by
 * character count against an ASSUMED advance; here the real font is loaded and
 * can be asked. If the platform's face is wider than the guess, characters come
 * off until it fits. Normally this does nothing at all.
 */
function fitToCanvas(ctx, text, maxWidth) {
  if (!maxWidth || ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/* ──────────────────────────────── the share ─────────────────────────────── */

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'workout';

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') { reject(new Error('This browser cannot save images.')); return; }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      // PNG is the one format every canvas implementation must support, so a
      // null here means the canvas itself failed, not the encoding.
      else reject(new Error('The image could not be created.'));
    }, 'image/png');
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on a turn of the loop rather than immediately: some browsers have
  // not started reading the blob by the time click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Build the picture and hand it to the share sheet.
 *
 *   await shareWorkoutImage(data, opts)
 *     -> { shared: true, filename }                  it went to the share sheet
 *     -> { shared: false, cancelled: true, filename } they tapped Cancel
 *     -> { shared: false, downloaded: true, filename } saved to their files
 *
 * Throws only when the image could not be MADE — no 2d context, no `toBlob`.
 * Those are worth a toast; nothing else here is.
 *
 * ⚠️ AN ABORT IS SOMEBODY CHANGING THEIR MIND, NOT A FAILURE. Cancelling the
 * share sheet throws `AbortError`, and reporting that as an error makes
 * tapping Cancel look like the app breaking. `shareActivity()` in
 * js/views-workouts.js swallows it for the same reason; this returns
 * `cancelled` so a caller can tell "done" from "never mind" and stay quiet
 * about both.
 *
 * ⚠️ THE FILE GOES ALONE — no `text`, no `url` beside it. `canShare({files})`
 * only answers for the files, and several real share targets reject a payload
 * that mixes a file with text, which turns a working share into a thrown
 * error. The image already says everything the sentence would have.
 */
export async function shareWorkoutImage(data, opts = {}) {
  const layout = shareCardLayout(data, { ...opts, theme: opts.theme || readTheme() });
  const canvas = document.createElement('canvas');
  drawShareCard(canvas, layout);
  const blob = await toBlob(canvas);

  const filename = opts.filename
    || `${slug(data && data.title)}-${slug(data && data.date)}.png`;

  const nav = typeof navigator === 'undefined' ? null : navigator;
  let file = null;
  if (nav && nav.share && typeof File === 'function') {
    try { file = new File([blob], filename, { type: 'image/png' }); } catch (_) { file = null; }
  }

  const shareable = Boolean(file && (!nav.canShare || nav.canShare({ files: [file] })));
  if (shareable) {
    try {
      await nav.share({ files: [file] });
      return { shared: true, filename };
    } catch (err) {
      if (err && err.name === 'AbortError') return { shared: false, cancelled: true, filename };
      // Any other throw is a share sheet that did not work. Falling through to
      // the download leaves somebody with the picture rather than with a toast.
    }
  }

  download(blob, filename);
  return { shared: false, downloaded: true, filename };
}
