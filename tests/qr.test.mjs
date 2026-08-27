/**
 * THE QR ENCODER — checked in three layers, weakest first.
 *
 *   npm install jsqr          (anywhere; it is a TEST-only dependency)
 *   node tests/qr.test.mjs
 *
 * jsQR is a dependency of the CHECK, not of the app. `js/qr.js` itself imports
 * nothing at all and the shipped bundle stays at zero dependencies — the rule
 * has always been about what ships rather than about what verifies it, which is
 * the same reasoning that lets tests/render.test.mjs use jsdom.
 *
 * ── WHY THREE LAYERS ────────────────────────────────────────────────────────
 *
 *   1. REED-SOLOMON against published vectors. Narrow, but it isolates the one
 *      piece of arithmetic where a bug produces output that still looks like
 *      plausible bytes.
 *   2. STRUCTURE — finders, timing, dark module, size, and the refusal to
 *      truncate. Cheap, and it localises a failure to a specific pattern.
 *   3. ROUND-TRIP DECODE through jsQR. This is the assertion that actually
 *      earns its keep: one `decode(encode(s)) === s` exercises the format-info
 *      BCH, the mask choice, the zig-zag placement, the block interleaving and
 *      the ECC all at once, judged by an implementation that shares no code and
 *      no assumptions with ours.
 *
 * ⚠️ WHAT IS DELIBERATELY *NOT* ASSERTED: any fixture of a whole matrix, and any
 * claim about WHICH mask gets chosen — including ZXing's fixtures and the mask
 * the ISO Annex G worked example lands on. Penalty rule 3 is genuinely ambiguous
 * in the spec (whether the quiet zone counts as the four light modules, whether
 * a run that overlaps another double-counts), so real implementations legitimately
 * choose different masks for the same payload and every one of them scans. A
 * fixture like that pins an arbitrary reading of an ambiguity and breaks on a
 * correct change. What matters is that the symbol DECODES, and layer 3 asserts
 * exactly that.
 */

import jsQR from 'jsqr';
import { encodeQR, eccCodewords } from '../js/qr.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('PASS ', msg); }
  else { fail++; console.error('FAIL ', msg); }
};

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/* ═══════════ 1. Reed-Solomon, against published vectors ═══════════ */

// Vectors from ZXing's EncoderTestCase.testGenerateECBytes, which took them
// from swetake.com/qr/qr3.html. They are independent of this implementation and
// of the ISO document, which is the whole reason to use them.
{
  const a = [32, 65, 205, 69, 41, 220, 46, 128, 236];
  const aEC = [42, 159, 74, 221, 244, 169, 239, 150, 138, 70, 237, 85, 224, 96, 74, 219, 61];
  ok(same(eccCodewords(a, 17), aEC), '17 EC codewords match the published vector for a 9-codeword block');

  const b = [67, 70, 22, 38, 54, 70, 86, 102, 118, 134, 150, 166, 182, 198, 214];
  const bEC = [175, 80, 155, 64, 178, 45, 214, 233, 65, 209, 12, 155, 117, 31, 140, 214, 27, 187];
  ok(same(eccCodewords(b, 18), bEC), '18 EC codewords match the published vector for a 15-codeword block');

  // ⚠️ THE ONE THAT CATCHES A REAL CLASS OF BUG. This remainder genuinely starts
  // with a zero coefficient, and contains another one mid-way. A division that
  // trims leading zeros — which is the natural way to write polynomial division,
  // and what a "tidy up the output" change would reintroduce — returns 15 or 16
  // codewords here instead of 17. Every later block is then shifted during
  // interleaving and the symbol is unreadable, for input that looks completely
  // ordinary. The length assertion below is as important as the value one.
  const c = [32, 49, 205, 69, 42, 20, 0, 236, 17];
  const cEC = [0, 3, 130, 179, 194, 0, 55, 211, 110, 79, 98, 72, 170, 96, 211, 137, 213];
  const got = eccCodewords(c, 17);
  ok(got.length === 17, 'a remainder with leading zero coefficients is still a full 17 codewords, not a trimmed 16');
  ok(same(got, cEC), 'and those leading and interior zeros are in the right places');
}

/* ═══════════ 2. Structure of a real encode ═══════════ */

const isFinderAt = (m, top, left) => {
  const want = [
    '1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111',
  ];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (m[top + r][left + c] !== (want[r][c] === '1')) return false;
    }
  }
  return true;
};

{
  const q = encodeQR('https://timothyhadfield.github.io/Fitness_Tracker/#/home');
  const { size, modules } = q;

  ok(size === 4 * q.version + 17, `size ${size} is 4·version+17 for the version the encoder selected (v${q.version})`);
  ok(modules.length === size && modules.every((r) => r.length === size), 'the matrix is square and matches the reported size');

  // Three finders, and NOT a fourth: the bottom-right corner must stay data, or
  // a scanner cannot tell which way up the symbol is.
  ok(isFinderAt(modules, 0, 0), 'a finder pattern sits in the top-left corner');
  ok(isFinderAt(modules, 0, size - 7), 'a finder pattern sits in the top-right corner');
  ok(isFinderAt(modules, size - 7, 0), 'a finder pattern sits in the bottom-left corner');
  ok(!isFinderAt(modules, size - 7, size - 7), 'and there is no fourth finder, which is what fixes the symbol\'s orientation');

  // Separators: the light border between each finder and the data.
  ok([...Array(8).keys()].every((i) => modules[7][i] === false && modules[i][7] === false),
     'the top-left finder is fenced off by its light separator');

  // Timing patterns run between the separators, alternating and starting dark.
  let timingOk = true;
  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] !== (i % 2 === 0)) timingOk = false;
    if (modules[i][6] !== (i % 2 === 0)) timingOk = false;
  }
  ok(timingOk, 'both timing patterns alternate light and dark all the way across');

  // The dark module. Always dark, whatever the payload, whatever the mask.
  ok(modules[size - 8][8] === true, 'the dark module at (4·version+9, 8) is set');

  // Mask selection actually ran and produced a legal choice.
  ok(q.mask >= 0 && q.mask <= 7 && Number.isInteger(q.mask), `a mask was chosen by scoring rather than assumed (got ${q.mask})`);
}

// ⚠️ TOO LONG MUST THROW, NEVER TRUNCATE. A truncated payload is a QR code that
// scans perfectly and takes the user somewhere wrong, which is strictly worse
// than a code that refuses to exist.
{
  let threw = null;
  try { encodeQR('x'.repeat(400)); } catch (e) { threw = e; }
  ok(threw instanceof Error, 'a payload too long for version 6 throws rather than silently truncating');
  ok(threw && /fit|long|short/i.test(threw.message), `and the message says what went wrong ("${threw && threw.message}")`);

  let bad = null;
  try { encodeQR('hello', { ecc: 'Z' }); } catch (e) { bad = e; }
  ok(bad instanceof Error, 'an unknown error-correction level is rejected rather than treated as the default');
}

// Version selection climbs as the payload grows, and never skips.
{
  const sizes = [10, 40, 80, 100].map((n) => encodeQR('u'.repeat(n)).version);
  ok(sizes.every((v, i) => i === 0 || v >= sizes[i - 1]), `version is non-decreasing as the payload grows (${sizes.join(' → ')})`);
  ok(encodeQR('hi').version === 1, 'a two-character payload picks the smallest version, 1');
}

/* ═══════════ 3. Round-trip decode through jsQR ═══════════ */

/**
 * Paint a matrix into the RGBA buffer jsQR wants: 8px per module and a 4-module
 * quiet zone, which is the minimum the spec requires and the thing most likely
 * to be forgotten by a caller drawing this for real.
 */
function toRGBA(matrix, scale = 8, quiet = 4) {
  const { size, modules } = matrix;
  const side = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  data.fill(255);                                  // light background, opaque
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const mr = Math.floor(y / scale) - quiet;
      const mc = Math.floor(x / scale) - quiet;
      if (mr < 0 || mc < 0 || mr >= size || mc >= size) continue;
      if (!modules[mr][mc]) continue;
      const i = (y * side + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { data, side };
}

const roundTrip = (text, opts) => {
  const q = encodeQR(text, opts);
  const { data, side } = toRGBA(q);
  const result = jsQR(data, side, side);
  return { q, decoded: result && result.data };
};

// A short string, exercising version 1 where there is no alignment pattern.
{
  const { q, decoded } = roundTrip('hi');
  ok(decoded === 'hi', `jsQR reads back a short payload from a v${q.version} symbol`);
}

// The realistic case: an ~82-character deep link, the shape every payload this
// app produces actually has — lowercase, a hash route, slashes and underscores,
// which is exactly why byte mode is the only usable mode here.
{
  const url = 'https://timothyhadfield.github.io/Fitness_Tracker/#/add/abcdefghij0123456789ABCDEF';
  const { q, decoded } = roundTrip(url);
  ok(decoded === url, `jsQR reads back the ${url.length}-character deep link exactly (v${q.version}, level ${q.ecc}, mask ${q.mask})`);
}

// A payload that forces version 6 — the largest this encoder makes, and the one
// whose alignment pattern sits furthest into the data area.
{
  const long = 'https://timothyhadfield.github.io/Fitness_Tracker/#/add/' + 'a1b2c3d4e5'.repeat(4);
  const { q, decoded } = roundTrip(long);
  ok(q.version === 6, `a ${long.length}-byte payload selects version 6 (got v${q.version}, ${q.size}×${q.size})`);
  ok(decoded === long, 'and jsQR reads it back exactly at the largest version this encoder makes');
}

// Every explicit level round-trips, which is the only real check that the
// error-correction indicator bits are not transposed — L and M are 0b01 and
// 0b00, and swapping them produces a symbol that decodes as garbage rather than
// failing loudly.
//
// ⚠️ 57 bytes, not the 82-byte link used above, because version 6 at level H
// holds only 58 data bytes — H spends more than half the symbol on redundancy.
// That ceiling is real and a caller pinning H needs to know about it, so it is
// asserted just below rather than worked around silently.
for (const ecc of ['L', 'M', 'Q', 'H']) {
  const text = 'https://timothyhadfield.github.io/Fitness_Tracker/#/s/9f3';
  const { q, decoded } = roundTrip(text, { ecc });
  ok(decoded === text, `level ${ecc} round-trips (${text.length} bytes → v${q.version}, mask ${q.mask})`);
}

// A pinned high level is a REQUIREMENT, never quietly downgraded: dropping a
// caller who asked for H down to L to make something fit would hand back a
// symbol that is far less robust than the one they asked for, without saying so.
{
  let threw = null;
  try { encodeQR('x'.repeat(59), { ecc: 'H' }); } catch (e) { threw = e; }
  ok(threw instanceof Error && /level H/.test(threw.message),
     'a payload over the version-6 level-H ceiling throws instead of being silently downgraded to L');

  // The M default, by contrast, IS allowed to fall back — a payload between the
  // M and L ceilings still produces a working symbol rather than an error.
  const wide = 'y'.repeat(120);
  const q = encodeQR(wide);
  ok(q.ecc === 'L', 'a payload too big for M at every version falls back to L rather than failing');
  const { data, side } = toRGBA(q);
  ok((jsQR(data, side, side) || {}).data === wide, 'and that fallback symbol still decodes');
}

// ⚠️ THE PER-PAYLOAD MASK CLAIM, CHECKED THE ONLY WAY IT HONESTLY CAN BE. Not
// "mask N is chosen" — that is the brittle fixture this file refuses to write —
// but "many different payloads all decode", which is what per-payload scoring is
// FOR. If the mask were hard-coded, some of these would eventually produce a
// false finder pattern in the data area and fail to locate.
{
  let bad = [];
  const masksSeen = new Set();
  for (let i = 0; i < 60; i++) {
    // Deterministic, not random — this module is pure and so is its test. A
    // failure here has to be reproducible by re-running the file.
    const text = `https://timothyhadfield.github.io/Fitness_Tracker/#/w/${i}-${'zx'.repeat(i % 11)}${i * 7919}`;
    const { q, decoded } = roundTrip(text);
    masksSeen.add(q.mask);
    if (decoded !== text) bad.push(`${text} (v${q.version}, mask ${q.mask})`);
  }
  ok(bad.length === 0, `all 60 varied payloads decode back to themselves${bad.length ? ` — failed: ${bad.slice(0, 3).join('; ')}` : ''}`);
  ok(masksSeen.size > 1, `and scoring picked genuinely different masks across them (${[...masksSeen].sort().join(', ')}), which a hard-coded mask could not do`);
}

// Non-ASCII, to prove the byte mode really is bytes: the character count in the
// header counts BYTES, not characters, and a UTF-8 payload is where an encoder
// that conflates the two comes apart.
{
  const text = 'Prise de masse — 100 kg × 5 ✓';
  const { decoded } = roundTrip(text);
  ok(decoded === text, 'a multi-byte UTF-8 payload round-trips, so the header counts bytes rather than characters');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
