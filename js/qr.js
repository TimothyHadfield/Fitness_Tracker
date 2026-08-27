/**
 * QR ENCODER — a payload string in, a matrix of dark/light modules out.
 *
 * Byte mode, versions 1–6, error correction M with an L fallback. Written here
 * rather than pulled in because the app ships with no build step and no runtime
 * dependencies, and a QR library is a lot of surface to take on for one screen.
 *
 * Pure: no DOM, no clock, no randomness, no storage. It returns a boolean grid
 * and the caller decides whether that becomes a canvas, an SVG or a table of
 * <div>s. That is the whole reason the drawing is somewhere else — a matrix can
 * be asserted on in Node, and a canvas cannot.
 *
 * ── THE TWO DECISIONS SOMEBODY WILL OTHERWISE RE-LITIGATE ────────────────────
 *
 * ⚠️ BYTE MODE ONLY, DELIBERATELY. Alphanumeric mode packs 11 bits per two
 * characters instead of 16 and is very tempting — but its 45-character alphabet
 * is uppercase only and does not contain `#`, `/` or `-`. Every payload this app
 * makes is a URL with a hash route in it, so alphanumeric mode is not merely
 * suboptimal here, it is unusable. Numeric and kanji are the same story. There
 * is nothing to gain by adding modes that no payload can ever take.
 *
 * ⚠️ NO VERSION-INFORMATION BLOCK, AND THAT IS NOT AN OMISSION. The 18-bit
 * version block (ISO/IEC 18004 §8.10) exists only from version 7 upwards; a
 * symbol at version 6 or below must NOT carry one, and a scanner infers the
 * version from the symbol's size. This encoder caps at version 6, so the block
 * is correctly absent. Do not "fix" this by adding one — that would corrupt
 * every symbol here. If versions 7+ are ever needed, the block has to be added
 * at the same time as the larger versions, never before.
 *
 * Everything else follows ISO/IEC 18004; tables are cited on the constants.
 */

/* ────────────────────────── spec tables, versions 1–6 ────────────────────── */

// Total codewords (data + error correction) per version. ISO/IEC 18004 Table 1,
// indexed [version - 1].
const TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172];

// Alignment pattern centre coordinates per version. ISO/IEC 18004 Annex E,
// Table E.1. Versions 2–6 list two coordinates, giving four candidate centres,
// three of which collide with the finders and are skipped — so these versions
// end up with exactly one alignment pattern. Version 1 has none.
const ALIGNMENT_COORDS = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

/**
 * Error-correction block structure, ISO/IEC 18004 Table 13–16, indexed
 * [version - 1]. Each entry is:
 *   [ ecCodewordsPerBlock, group1Blocks, group1DataCodewords,
 *                          group2Blocks, group2DataCodewords ]
 * Group 2 blocks, where present, hold exactly one data codeword more than group
 * 1 — that is how the spec absorbs a data length that does not divide evenly.
 */
const EC_BLOCKS = {
  L: [[7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0],
      [20, 1, 80, 0, 0], [26, 1, 108, 0, 0], [18, 2, 68, 0, 0]],
  M: [[10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0],
      [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0]],
  Q: [[13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0],
      [26, 2, 24, 0, 0], [18, 2, 15, 2, 16], [24, 4, 19, 0, 0]],
  H: [[17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0],
      [16, 4, 9, 0, 0], [22, 2, 11, 2, 12], [28, 4, 15, 0, 0]],
};

const MAX_VERSION = 6;

// Byte mode indicator, ISO/IEC 18004 Table 2.
const MODE_BYTE = 0b0100;

// Character count indicator width for byte mode at versions 1–9. ISO/IEC 18004
// Table 3. It widens to 16 bits at version 10, which this encoder never reaches
// — one more thing that would have to change alongside the version cap.
const COUNT_BITS = 8;

// Pad codewords, alternated after the terminator. ISO/IEC 18004 §8.4.9.
const PAD_A = 0xEC;
const PAD_B = 0x11;

// Error-correction level indicator bits for the format information. ISO/IEC
// 18004 Table 12. ⚠️ These are NOT in L < M < Q < H order — M is 0b00 and L is
// 0b01 — which looks like a typo every single time somebody reads it. It is not.
const ECC_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

// BCH(15,5) generator for the format information, and the mask XORed over the
// result. ISO/IEC 18004 §8.9. The mask exists so that an all-zero format value
// is not an all-zero (and therefore ambiguous) bit pattern.
const FORMAT_GENERATOR = 0x537;
const FORMAT_MASK = 0x5412;

/* ─────────────────────────────── GF(256) ─────────────────────────────────── */

// Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1, ISO/IEC 18004 §8.5.2. Log and
// antilog tables are built once at module load: Reed-Solomon does thousands of
// field multiplications per symbol and a table lookup is the whole reason it is
// fast enough to run on every render.
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  // The top half repeats the bottom so that a log sum up to 508 can be indexed
  // without a modulo in the multiply hot path.
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/**
 * The Reed-Solomon generator polynomial of the given degree, coefficients
 * highest-power-first with the leading 1 implied away by the construction:
 * (x - a^0)(x - a^1) … (x - a^(degree-1)). ISO/IEC 18004 §8.5.2.
 */
function generatorPoly(degree) {
  let poly = [1];
  for (let d = 0; d < degree; d++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i];
      next[i + 1] ^= gfMul(poly[i], GF_EXP[d]);
    }
    poly = next;
  }
  return poly;
}

/**
 * The error-correction codewords for one block: the remainder of the data
 * polynomial divided by the generator polynomial, in GF(256).
 *
 * ⚠️ The remainder is ALWAYS `ecLength` codewords long, leading zeros included.
 * A polynomial-division implementation that trims its result — which is the
 * natural thing to write — produces a short block for perfectly ordinary input,
 * and the symbol then fails to decode for reasons that look nothing like the
 * cause. The test file pins a vector whose remainder genuinely starts with a
 * zero for exactly this reason.
 */
export function eccCodewords(data, ecLength) {
  const gen = generatorPoly(ecLength);
  const rem = new Uint8Array(data.length + ecLength);
  rem.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const factor = rem[i];
    if (factor === 0) continue;             // nothing to subtract this step
    for (let j = 0; j < gen.length; j++) {
      rem[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return Array.from(rem.slice(data.length));
}

/* ─────────────────────────── payload → codewords ─────────────────────────── */

/**
 * UTF-8 bytes for the payload. ISO-8859-1 is what the byte-mode default ECI
 * nominally means, but every scanner in practice reads UTF-8 for bytes above
 * 0x7F, and the payloads here are ASCII URLs where the two agree exactly.
 * Hand-rolled rather than using TextEncoder so this module needs nothing at all
 * from its host — it runs identically in a browser, in Node and in a worker.
 */
function utf8Bytes(text) {
  const out = [];
  for (const ch of String(text)) {
    let cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
    else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
  }
  return out;
}

/** How many data codewords a version/level combination carries in total. */
function dataCapacity(version, ecc) {
  const [, g1, d1, g2, d2] = EC_BLOCKS[ecc][version - 1];
  return g1 * d1 + g2 * d2;
}

/**
 * The bit stream: mode indicator, character count, the bytes, a terminator, and
 * the pad alternation. ISO/IEC 18004 §8.4.9.
 */
function buildBitStream(bytes, capacityCodewords) {
  const bits = [];
  const push = (value, width) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(MODE_BYTE, 4);
  push(bytes.length, COUNT_BITS);
  for (const b of bytes) push(b, 8);

  // Terminator: up to four zero bits, but only as many as still fit. A symbol
  // filled exactly to capacity gets no terminator at all, which is legal.
  const capacityBits = capacityCodewords * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);

  // Round up to a whole codeword.
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  // Fill the remainder with the alternating pad pair, starting at 0xEC.
  for (let i = 0; codewords.length < capacityCodewords; i++) {
    codewords.push(i % 2 === 0 ? PAD_A : PAD_B);
  }
  return codewords;
}

/**
 * Split the data into blocks, compute each block's ECC, then interleave.
 * ISO/IEC 18004 §8.6.
 *
 * ⚠️ INTERLEAVING IS THE POINT OF THE BLOCKS. Codeword k of every block goes out
 * before codeword k+1 of any of them, so a scratch or a thumb covering part of
 * the symbol damages a few codewords in each block rather than destroying one
 * block outright — and a block can only be repaired up to its own limit. Writing
 * the blocks end to end produces a symbol that encodes and decodes fine when
 * pristine and fails far too early when it is not, which is close to the worst
 * possible bug to have.
 */
function interleave(codewords, version, ecc) {
  const [ecLen, g1, d1, g2, d2] = EC_BLOCKS[ecc][version - 1];

  const blocks = [];
  let at = 0;
  for (let i = 0; i < g1 + g2; i++) {
    const size = i < g1 ? d1 : d2;
    const data = codewords.slice(at, at + size);
    at += size;
    blocks.push({ data, ec: eccCodewords(data, ecLen) });
  }

  const out = [];
  // Group 2 blocks are exactly one codeword longer, so the final data round
  // simply skips the shorter blocks.
  const maxData = Math.max(d1, g2 ? d2 : 0);
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }
  return out;
}

/* ─────────────────────────── function patterns ───────────────────────────── */

const sizeOf = (version) => version * 4 + 17;

/**
 * A blank symbol carrying every function pattern, plus a parallel `reserved`
 * grid marking which modules data may never be written into. Reserved covers
 * the finders and their separators, both timing patterns, every alignment
 * pattern, the two format-information strips and the dark module.
 */
function functionPatterns(version) {
  const size = sizeOf(version);
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (r, c, dark) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  // Finder patterns and their separators. The separator is the one-module light
  // border, so the loop runs from -1 to 7 and paints outside the 7×7 finder.
  for (const [fr, fc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(fr + r, fc + c, inner && (ring || core));
      }
    }
  }

  // Timing patterns: row 6 and column 6, alternating dark from the even index.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment patterns, skipping the three centres that would land on a finder.
  const coords = ALIGNMENT_COORDS[version - 1];
  for (const r of coords) {
    for (const c of coords) {
      const onFinder = (r === 6 && c === 6)
        || (r === 6 && c === coords[coords.length - 1])
        || (r === coords[coords.length - 1] && c === 6);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, edge !== 1);   // dark ring, light ring, dark centre
        }
      }
    }
  }

  // Format information strips — reserved now, written after masking.
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) set(8, i, false);
    if (!reserved[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) set(8, size - 1 - i, false);
    if (!reserved[size - 1 - i][8]) set(size - 1 - i, 8, false);
  }

  // The dark module. Always dark, always at (4·version + 9, 8). ISO/IEC 18004
  // §8.9 — it is not part of the format information, it just lives next to it.
  set(size - 8, 8, true);

  return { size, modules, reserved };
}

/* ────────────────────────────── data placement ───────────────────────────── */

/**
 * Zig-zag the codeword bits into the symbol: two-module-wide columns walked
 * from the bottom-right corner, upwards then downwards alternately, right module
 * before left, skipping anything reserved. ISO/IEC 18004 §8.7.
 *
 * ⚠️ Column 6 is skipped entirely because the vertical timing pattern occupies
 * it — without that skip every column to its left is shifted by one and the
 * symbol is scrambled from that point on.
 *
 * Any module left over after the bits run out stays light: those are the
 * "remainder bits" (7 of them for versions 2–6, none for version 1), which carry
 * nothing and are specified as zero.
 */
function placeData(grid, codewords) {
  const { size, modules, reserved } = grid;
  let bit = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    if (bit >= totalBits) return false;
    const value = (codewords[bit >> 3] >> (7 - (bit & 7))) & 1;
    bit++;
    return value === 1;
  };

  let up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = up ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (reserved[r][c]) continue;
        modules[r][c] = nextBit();
      }
    }
    up = !up;
  }
}

/* ──────────────────────────────── masking ────────────────────────────────── */

/**
 * The eight data mask conditions, ISO/IEC 18004 Table 10. A true result means
 * the module at (row, col) is inverted.
 */
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * PENALTY RULE 1 — runs of five or more same-coloured modules in a row or
 * column. ISO/IEC 18004 Table 11: 3 points for the first five, one more for each
 * module beyond. Long uniform runs are what a scanner's edge detection has the
 * least to grip on.
 */
function penaltyRule1(m, size) {
  let score = 0;
  const scan = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
    }
  };
  scan((r, c) => m[r][c]);
  scan((c, r) => m[r][c]);
  return score;
}

/** PENALTY RULE 2 — every 2×2 block of one colour costs 3. Table 11. */
function penaltyRule2(m, size) {
  let score = 0;
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) score += 3;
    }
  }
  return score;
}

/**
 * PENALTY RULE 3 — 40 points for each occurrence of 1:1:3:1:1 bounded by four
 * light modules, in either orientation, in any row or column. Table 11.
 *
 * ⚠️ THIS IS THE RULE THAT MATTERS MOST, AND IT IS WHY THE MASK IS CHOSEN PER
 * PAYLOAD RATHER THAN PICKED ONCE. 1011101 is the finder pattern's own module
 * ratio. If a mask happens to reproduce it inside the data area, a scanner
 * locating the symbol sees FOUR OR MORE candidate finders and mis-locates the
 * symbol — the failure happens during location, before a single data bit is
 * read, so all the error correction in the symbol is irrelevant to it.
 *
 * And the data bits change with every payload, so a mask that is clean for one
 * token can manufacture a false finder in the next. There is no "good mask for
 * this app"; there is only a good mask for this string. Hard-coding one would
 * work in testing and fail on some user's URL months later, which is precisely
 * the kind of bug this rule was written into the spec to prevent.
 */
function penaltyRule3(m, size) {
  let score = 0;
  const check = (get) => {
    for (let a = 0; a < size; a++) {
      for (let b = 0; b + 10 < size; b++) {
        const w = [];
        for (let k = 0; k < 11; k++) w.push(get(a, b + k) ? 1 : 0);
        const s = w.join('');
        if (s === '10111010000' || s === '00001011101') score += 40;
      }
    }
  };
  check((r, c) => m[r][c]);
  check((c, r) => m[r][c]);
  return score;
}

/**
 * PENALTY RULE 4 — how far the proportion of dark modules strays from 50%.
 * Table 11: 10 points for each 5% step away. A symbol that is mostly one colour
 * gives a scanner's binarisation threshold nothing to separate.
 */
function penaltyRule4(m, size) {
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const percent = (dark * 100) / (size * size);
  return Math.floor(Math.abs(percent - 50) / 5) * 10;
}

function penalty(m, size) {
  return penaltyRule1(m, size) + penaltyRule2(m, size)
       + penaltyRule3(m, size) + penaltyRule4(m, size);
}

/* ──────────────────────── format information (BCH 15,5) ──────────────────── */

/**
 * The 15-bit format information: 5 bits of level-and-mask, 10 BCH check bits,
 * the whole thing XORed with 0x5412. ISO/IEC 18004 §8.9.
 *
 * It is written twice, in two different places, because the format bits are the
 * one thing a scanner cannot recover with error correction — it has to read them
 * to know which error correction to apply. Losing the top-left copy to damage
 * must still leave a readable symbol.
 */
export function formatInfo(ecc, mask) {
  const value = (ECC_BITS[ecc] << 3) | mask;
  // Polynomial long division over GF(2) by the BCH generator. The generator's
  // top bit is bit 10, so shifting it left by (i - 10) clears exactly bit i —
  // after the loop only the 10 remainder bits below bit 10 survive.
  let rem = value << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= FORMAT_GENERATOR << (i - 10);
  }
  return (((value << 10) | rem) ^ FORMAT_MASK) & 0x7FFF;
}

/**
 * Both placements of the format bits, indexed from the least significant bit.
 * The two copies run in opposite directions around their corners, which is why
 * this cannot be written as one loop over a rectangle.
 */
function placeFormat(modules, size, bitsValue) {
  const bitAt = (i) => ((bitsValue >> i) & 1) === 1;

  for (let i = 0; i < 15; i++) {
    const dark = bitAt(i);

    // Copy 1 — up the left of the top-left finder, then along the top.
    if (i < 6) modules[i][8] = dark;
    else if (i === 6) modules[7][8] = dark;
    else if (i === 7) modules[8][8] = dark;
    else if (i === 8) modules[8][7] = dark;
    else modules[8][14 - i] = dark;

    // Copy 2 — in from the top-right corner, then up from the bottom-left.
    if (i < 8) modules[8][size - 1 - i] = dark;
    else modules[size - 7 + (i - 8)][8] = dark;
  }
}

/* ──────────────────────────────── the encoder ────────────────────────────── */

/**
 * Encode `text` as a QR symbol.
 *
 * Returns `{ size, modules }` where `modules[y][x] === true` is a dark module
 * and `size` is the module count per side EXCLUDING the quiet zone. The quiet
 * zone is the caller's job: it is four modules of background, and whether that
 * is padding, a margin or a border depends entirely on what the symbol is being
 * drawn into.
 *
 * `opts.ecc` — 'L' | 'M' | 'Q' | 'H', default 'M'. At M, a payload that will not
 * fit at any version up to 6 is retried at L before giving up, because a symbol
 * that scans with less redundancy beats no symbol at all. A level pinned to Q or
 * H is taken as a requirement and is never quietly downgraded.
 *
 * Throws if the text does not fit. It never truncates: half a URL is a working
 * QR code pointing somewhere wrong, which is worse than an error.
 */
export function encodeQR(text, opts = {}) {
  const requested = opts.ecc || 'M';
  if (!EC_BLOCKS[requested]) {
    throw new Error(`encodeQR: unknown error-correction level "${requested}" (want L, M, Q or H)`);
  }

  const bytes = utf8Bytes(text);
  if (bytes.length === 0) throw new Error('encodeQR: nothing to encode');

  const levels = requested === 'M' ? ['M', 'L'] : [requested];
  const neededBits = 4 + COUNT_BITS + bytes.length * 8;

  let ecc = null;
  let version = 0;
  outer:
  for (const level of levels) {
    for (let v = 1; v <= MAX_VERSION; v++) {
      if (neededBits <= dataCapacity(v, level) * 8) { ecc = level; version = v; break outer; }
    }
  }
  if (!ecc) {
    const max = Math.floor((dataCapacity(MAX_VERSION, levels[levels.length - 1]) * 8 - 4 - COUNT_BITS) / 8);
    throw new Error(
      `encodeQR: ${bytes.length} bytes will not fit in a version-${MAX_VERSION} symbol `
      + `at level ${levels[levels.length - 1]} (maximum ${max} bytes). Shorten the payload.`);
  }

  const capacity = dataCapacity(version, ecc);
  const codewords = interleave(buildBitStream(bytes, capacity), version, ecc);

  const base = functionPatterns(version);
  placeData(base, codewords);
  const { size, modules: placed, reserved } = base;

  // Score all eight masks and keep the cheapest. See penaltyRule3 for why this
  // is computed per payload rather than decided once.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const modules = placed.map((row) => row.slice());
    const condition = MASKS[mask];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && condition(r, c)) modules[r][c] = !modules[r][c];
      }
    }
    placeFormat(modules, size, formatInfo(ecc, mask));

    const score = penalty(modules, size);
    if (!best || score < best.score) best = { score, mask, modules };
  }

  return { size, modules: best.modules, version, ecc, mask: best.mask };
}
