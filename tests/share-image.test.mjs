/**
 * THE SHAREABLE IMAGE — the half of it that can be checked.
 *
 *   node tests/share-image.test.mjs        (no jsdom, no dependencies)
 *
 * `drawShareCard()` needs a canvas and is not tested here. `shareCardLayout()`
 * needs nothing at all, which is the entire reason js/share-image.js is split
 * down the middle — every decision worth pinning was deliberately put on this
 * side of the line.
 *
 * ── WHAT IS WORTH ASSERTING, GIVEN THAT NOBODY CAN SEE THE PICTURE ─────────
 *
 * Not "the title is 104px". The four failures that matter are the ones that
 * would ship looking almost fine:
 *
 *   1. TEXT OFF THE EDGE. A picture is posted before anybody reads it, and a
 *      name running past the margin is only visible once it is already in
 *      somebody's chat. Every block's box is checked against the canvas.
 *   2. "undefined" IN THE PICTURE. A session with no note and no location is
 *      an ordinary session, and the one thing its card must not do is print
 *      the word `undefined` or leave a gap where the reader looks for
 *      something that was never there.
 *   3. A LIST THAT RUNS OFF THE BOTTOM. Fifteen exercises is a normal leg day
 *      and the card has room for eight, so the remainder has to be COUNTED
 *      rather than silently dropped — "+7 more" is honest, a list that just
 *      stops is not.
 *   4. AN EMPTY SESSION CRASHING. Somebody opens the recorder, logs nothing,
 *      and taps share. That has to produce a card, not an exception.
 */

import {
  shareCardLayout, blockBox, maxChars, estimateWidth, fitLine, wrapLines, FALLBACK_THEME,
} from '../js/share-image.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const MARGIN = 84;
const texts = (layout, kind) => layout.blocks.filter((b) => b.kind === kind).map((b) => b.text);
const has = (layout, kind) => layout.blocks.some((b) => b.kind === kind);

const SESSION = {
  title: 'Push',
  who: 'Autumn',
  date: '2026-08-26',
  minutes: 65,
  sets: 24,
  note: 'felt strong',
  location: 'Ironworks Gym',
  exercises: [
    { name: 'Barbell Bench Press', sets: 4 },
    { name: 'Overhead Press', sets: 3 },
    { name: 'Incline Dumbbell Press', sets: 3 },
    { name: 'Cable Crossover', sets: 4 },
  ],
};

/* ═══════════ 1. nothing escapes the canvas ═══════════ */

/** Every block, boxed and compared against the margins it was told to keep. */
function inBounds(layout) {
  return layout.blocks.every((b) => {
    const box = blockBox(b);
    return box.left >= MARGIN - 0.5
        && box.right <= layout.width - MARGIN + 0.5
        && box.top >= MARGIN - 0.5
        && box.bottom <= layout.height - MARGIN + 0.5;
  });
}

/** The first block that broke out, so a failure names itself. */
function escapee(layout) {
  const b = layout.blocks.find((x) => {
    const box = blockBox(x);
    return box.left < MARGIN - 0.5 || box.right > layout.width - MARGIN + 0.5
        || box.top < MARGIN - 0.5 || box.bottom > layout.height - MARGIN + 0.5;
  });
  if (!b) return '';
  const box = blockBox(b);
  return ` — ${b.kind} "${b.text || ''}" at [${box.left.toFixed(0)}, ${box.top.toFixed(0)}] to `
       + `[${box.right.toFixed(0)}, ${box.bottom.toFixed(0)}]`;
}

{
  const l = shareCardLayout(SESSION);
  ok(l.width === 1080 && l.height >= 1080 && l.height <= 1350,
     `the card is ${l.width}×${l.height} — as tall as its contents, between a square and 4:5`);
  ok(inBounds(l), 'an ordinary session keeps every block inside the margins' + escapee(l));
  ok(l.background === FALLBACK_THEME.ground,
     'and paints a ground rather than leaving the PNG transparent — this image lands on '
     + 'somebody else\'s feed, where "no background" means whatever colour that app is');
  ok(l.font === FALLBACK_THEME.sans,
     'the font is the app\'s own --sans stack, never a file it would have to fetch (D6)');
}

// The square variant, where everything below the stats has 270px less to work
// with. If the list did not shrink with it, this is where it would show.
{
  const l = shareCardLayout(SESSION, { height: 1080 });
  ok(l.height === 1080, 'a square card is 1080×1080');
  ok(inBounds(l), 'and still keeps every block inside the margins' + escapee(l));
}

// The worst case for the right-hand column: the set count is anchored to the
// right margin and grows LEFTWARDS, so an off-by-one there escapes the canvas
// in the direction the eye is least likely to catch.
{
  const l = shareCardLayout({
    ...SESSION,
    exercises: [{ name: 'Single-Arm Cable Lateral Raise (Behind The Back)', sets: 12 }],
  });
  const sets = l.blocks.find((b) => b.kind === 'exercise-sets');
  ok(sets && blockBox(sets).right <= l.width - MARGIN + 0.5,
     'a right-aligned set count stops at the margin rather than growing off the edge');
  ok(inBounds(l), 'and the long exercise name beside it does not reach it' + escapee(l));
}

/* ═══════════ 2. long text truncates rather than overflowing ═══════════ */

{
  const long = 'Upper Body Push Strength And Accessory Volume Day';
  const l = shareCardLayout({ ...SESSION, title: long });
  const [title] = texts(l, 'title');
  ok(title.length < long.length && title.endsWith('…'),
     `a title too long for the card is cut with an ellipsis (${JSON.stringify(title)})`);
  ok(inBounds(l), 'and the cut one fits, which is the point of cutting it' + escapee(l));
}

{
  // The step-down before the cut: "Upper Body Strength" does not fit at 104px
  // but does at 80, and losing its last word would have been the worse trade.
  const l = shareCardLayout({ ...SESSION, title: 'Upper Body Strength' });
  const title = l.blocks.find((b) => b.kind === 'title');
  ok(title.text === 'Upper Body Strength',
     'a slightly-long title steps DOWN one size rather than losing a word');
  ok(title.size < 96 && title.size >= 76,
     `and it steps down exactly once, to ${title.size}px — below that the workout name stops `
     + 'being the loudest thing on the card, which is its only job');
}

{
  const l = shareCardLayout({ ...SESSION, title: 'A'.repeat(400) });
  ok(inBounds(l), 'a 400-character title is still inside the margins' + escapee(l));
  ok(texts(l, 'title')[0].endsWith('…'), 'and says so with an ellipsis');
}

{
  const l = shareCardLayout({
    ...SESSION,
    note: 'Felt strong today, best I have moved in weeks, everything came up easily and the last '
        + 'set of benching went far better than the first two which is not usually how it goes.',
  });
  const lines = texts(l, 'note');
  ok(lines.length === 2, `a long note wraps to two lines, not more (${lines.length})`);
  ok(lines[1].endsWith('…'), 'and the second line ends in an ellipsis rather than just stopping');
  ok(inBounds(l), 'a wrapped note stays inside the margins' + escapee(l));
}

{
  // A word no line can hold. Hard-broken rather than left to overhang, because
  // an ellipsis on its own would tell the reader nothing at all.
  const l = shareCardLayout({ ...SESSION, note: 'Supercalifragilisticexpialidociouslylongwordthing' });
  ok(inBounds(l), 'an unbreakable word is broken rather than allowed to overhang' + escapee(l));
}

{
  ok(maxChars(40, 400) === 18, `the character cap is arithmetic, not a guess per call (${maxChars(40, 400)})`);
  ok(Math.abs(estimateWidth('12345', 40) - 110) < 1e-9,
     'and the width it caps against is the same estimate everywhere — 0.55em a character');
  ok(fitLine('abc', 40, 4000) === 'abc', 'a string that fits is left completely alone');
  ok(wrapLines('one two three', 40, 4000, 2).length === 1, 'and a short note stays on one line');
}

/* ═══════════ 3. a missing field leaves nothing behind ═══════════ */

{
  const l = shareCardLayout({ title: 'Legs', who: 'Tim', date: '2026-08-26', sets: 18, exercises: [] });
  const all = texts(l, 'note').concat(texts(l, 'meta'), texts(l, 'stat-label'), texts(l, 'title'));
  ok(!all.some((t) => /undefined|null|NaN/.test(t)),
     '🚨 a session with no note, no location and no duration never prints "undefined"');
  ok(!has(l, 'note'), 'a missing note drops its block entirely rather than drawing an empty line');
  ok(texts(l, 'stat-value').length === 1 && texts(l, 'stat-label')[0] === 'sets',
     'an untimed session shows sets alone rather than an empty minutes column');
  ok(texts(l, 'meta')[0] === 'August 26, 2026',
     'the date survives on its own when there is no location beside it');
  ok(inBounds(l), 'and the whole sparse card still fits' + escapee(l));
}

{
  // The gap test with teeth: dropping a block must pull everything under it UP,
  // not leave a hole where a reader looks for something that was never there.
  const withNote = shareCardLayout(SESSION);
  const without = shareCardLayout({ ...SESSION, note: '' });
  // Measured from the title rather than from the top of the canvas: the card is
  // centred in whatever height it ends up with, so an absolute `y` moves for
  // reasons that have nothing to do with the note.
  const drop = (l) => l.blocks.find((b) => b.kind === 'exercise').y
                    - l.blocks.find((b) => b.kind === 'title').y;
  ok(drop(without) < drop(withNote),
     'dropping the note closes the gap rather than leaving one — the exercises move up under '
     + `the title (${drop(withNote).toFixed(0)}px → ${drop(without).toFixed(0)}px)`);
}

{
  const l = shareCardLayout({ ...SESSION, who: '   ', location: '  ', note: '   ' });
  ok(!has(l, 'who') && !has(l, 'note'), 'whitespace is treated as absent, not as content');
  ok(texts(l, 'meta')[0] === 'August 26, 2026', 'and a blank location does not leave a dangling " · "');
}

{
  const l = shareCardLayout({ ...SESSION, date: 'not-a-date', location: '' });
  ok(!has(l, 'meta'), 'an unparseable date with nothing beside it drops the meta line rather than guessing');
  ok(inBounds(l), 'and the card closes up behind it' + escapee(l));
}

{
  const l = shareCardLayout({ ...SESSION, minutes: 0 });
  ok(texts(l, 'stat-value').length === 1,
     'a zero-minute session drops the column — "0 minutes" is a claim about a session nobody timed');
}

/* ═══════════ 4. a long session caps and counts the remainder ═══════════ */

{
  const fifteen = Array.from({ length: 15 }, (_, i) => ({ name: `Exercise ${i + 1}`, sets: 3 }));
  const l = shareCardLayout({ ...SESSION, exercises: fifteen });
  const shown = texts(l, 'exercise');
  ok(shown.length > 0 && shown.length <= 8,
     `fifteen exercises are capped at ${shown.length}, not shrunk below legibility`);
  ok(texts(l, 'more')[0] === `+${15 - shown.length} more`,
     `and the remainder is counted out loud: ${texts(l, 'more')[0]}`);
  ok(shown[0] === 'Exercise 1', 'the ones kept are the ones done first, in order');
  ok(inBounds(l), '🚨 nothing in a fifteen-exercise session runs off the bottom' + escapee(l));
}

{
  // The square card has less room, so it must cap harder AND say so. A layout
  // that kept eight rows here would be drawing over its own wordmark.
  const fifteen = Array.from({ length: 15 }, (_, i) => ({ name: `Exercise ${i + 1}`, sets: 3 }));
  const tall = shareCardLayout({ ...SESSION, exercises: fifteen });
  const square = shareCardLayout({ ...SESSION, exercises: fifteen }, { height: 1080 });
  ok(texts(square, 'exercise').length < texts(tall, 'exercise').length,
     'a square card shows fewer exercises than a portrait one — the cap is the room left, '
     + 'not a number somebody typed');
  ok(texts(square, 'more')[0] === `+${15 - texts(square, 'exercise').length} more`,
     'and its "+N more" counts what IT dropped, not what the tall one did');
  ok(inBounds(square), 'and the square card still clears its own wordmark' + escapee(square));
}

{
  const l = shareCardLayout({ ...SESSION, exercises: [{ name: 'Deadlift', sets: 5 }] });
  ok(!has(l, 'more'), 'a session that fits gets no "+0 more" line');
  ok(texts(l, 'exercise-sets')[0] === '5 sets', 'each row carries its own set count');
}

{
  const l = shareCardLayout({ ...SESSION, exercises: [{ name: 'Deadlift', sets: 1 }] });
  ok(texts(l, 'exercise-sets')[0] === '1 set',
     'one set is singular here too — the image must not read differently from the card it came from');
}

{
  const l = shareCardLayout({
    ...SESSION,
    exercises: [{ name: 'Plank', sets: 0 }, { name: '  ', sets: 4 }, null, { name: 'Curl', sets: 2 }],
  });
  ok(texts(l, 'exercise').length === 2 && texts(l, 'exercise')[1] === 'Curl',
     'an exercise with no name is not a row, and neither is a hole in the array');
  ok(texts(l, 'exercise-sets').length === 1,
     'an exercise nobody logged a set against prints no count rather than "0 sets"');
}

/* ═══════════ 5. the empty session, which still has to be a picture ═══════════ */

{
  const l = shareCardLayout({});
  ok(l.width === 1080 && l.height === 1080 && l.blocks.length > 0,
     'a session with no fields at all still lays out a card, and it is the square floor rather '
     + 'than a letterbox — 1080 is as short as this picture is ever allowed to be');
  ok(texts(l, 'title')[0] === 'Workout',
     'an unnamed session is titled rather than left with a blank where the biggest type goes');
  ok(texts(l, 'stat-value')[0] === '0' && texts(l, 'stat-label')[0] === 'sets',
     'and it says 0 sets, which is true — inventing one would be worse than an empty card');
  ok(!has(l, 'exercise') && !has(l, 'more'), 'no exercises means no rows and no overflow line');
  ok(has(l, 'brand'), 'the wordmark is still there, so the picture says where it came from');
  ok(inBounds(l), 'and the empty card is inside its own margins' + escapee(l));
}

ok(shareCardLayout(null).blocks.length > 0, 'null instead of a session is a card, not a crash');
ok(shareCardLayout(undefined, null).blocks.length > 0, 'and so is nothing at all');

/* ═══════════ 6. structure, the way Rule 2 asks for it ═══════════ */

{
  const l = shareCardLayout(SESSION);
  const rules = l.blocks.filter((b) => b.kind === 'rule');
  ok(rules.length === 2,
     `structure is two hairlines, spacing and weight — no borders, no panels (${rules.length} rules)`);
  ok(rules.every((r) => r.x === MARGIN && r.width === 1080 - MARGIN * 2),
     'and both run the full measure rather than boxing anything in');
  const accented = l.blocks.filter((b) => b.color === FALLBACK_THEME.accent);
  ok(accented.length === 2 && accented.every((b) => b.kind === 'stat-value'),
     'the accent is spent once, on the two honest figures — one colour used once is the '
     + 'cheapest hierarchy there is, and cheaper than the box Rule 2 forbids');
}

{
  // ⚠️ The rule this project would most regret breaking. No weight, anywhere.
  const l = shareCardLayout({ ...SESSION, weight: 315, volume: 41250 });
  const printed = l.blocks.map((b) => b.text || '').join(' ');
  ok(!/315|41250|lb|kg/i.test(printed),
     '🚨 no weight and no volume reaches the image — the numbers are somebody\'s, the picture '
     + 'is not, and a friend\'s volume could not have been computed honestly anyway');
}

{
  const custom = { ...FALLBACK_THEME, ground: '#F3F4F1', ink: '#171A1C', accent: '#96660F' };
  const l = shareCardLayout(SESSION, { theme: custom });
  ok(l.background === '#F3F4F1' && l.blocks.some((b) => b.color === '#96660F'),
     'the palette is passed in, so the image matches whichever of the six themes is on screen');
}

{
  const l = shareCardLayout(SESSION, { dateText: 'Wednesday, 26 August' });
  ok(texts(l, 'meta')[0].startsWith('Wednesday, 26 August'),
     'a caller that wants the device\'s own date formatting can hand one in');
}

/* ═══════════ 7. the space INSIDE the bounds, which is what actually broke ═══════════ */

/*
 * ⚠️ REGRESSIONS FROM THE FIRST REAL RENDER, 2026-08-31. Every assertion above
 * this point is about staying inside the canvas, and both defects stayed inside
 * it perfectly. They were about WASTING the room in there: a square card that
 * printed "+2 more" over two rows of blank space, and a portrait card with a
 * third of the picture empty under the last row.
 *
 * The lesson worth keeping is that "nothing overflowed" is only half of a
 * layout being right. These check the other half.
 */

// The real session from the demo account that found both of them.
const QUADS = {
  title: 'Quads', who: 'Marcus Webb', date: '2026-08-31', minutes: 50, sets: 15,
  note: 'Short on time so I cut the accessories.', location: 'Ironworks Gym',
  exercises: [
    { name: 'Back Squat', sets: 3 },
    { name: 'Leg Press', sets: 4 },
    { name: 'Reverse Nordic Curl', sets: 4 },
    { name: 'Standing Calf Raise', sets: 4 },
  ],
};

// The heights a caller is expected to ask for, plus the default.
const HEIGHTS = [undefined, 1080, 1200, 1350];

{
  const l = shareCardLayout(QUADS, { height: 1080 });
  ok(texts(l, 'exercise').length === 4,
     `🚨 four short rows fit on a square card and all four are drawn (${texts(l, 'exercise').length})`);
  ok(!has(l, 'more'),
     '🚨 and NOTHING was hidden, so no "+N more" — an overflow line printed over blank space is '
     + 'the card lying about running out of room');
  ok(inBounds(l), 'and they are inside the margins, which was never the problem' + escapee(l));
}

{
  // The same measurement in the other direction, and the reason to fix both at
  // once: the room a "+N more" is allowed to cost is the room the footer is
  // NOT already reserving.
  const l = shareCardLayout(QUADS);
  ok(l.naturalHeight <= 1080,
     `a four-exercise session comes to ${l.naturalHeight}px of content, so its card is square `
     + 'rather than a portrait with the bottom third empty');
  ok(l.height === Math.min(1350, Math.max(1080, l.naturalHeight)),
     'and the default height IS the natural height, clamped between the square and the 4:5');
}

/**
 * THE BOUND ON WASTED SPACE, and why it is this number.
 *
 * The gap between the last thing the session says and the wordmark under it is
 * a constant — the layout places the wordmark relative to the content, not to
 * the bottom of the canvas. So the bound is simply "no more air under the last
 * line than the margin around the whole card": 84px. Past that the whitespace
 * stops reading as a footer and starts reading as a render that gave up, which
 * is exactly what a fixed-bottom wordmark produced at 1350.
 */
const MAX_FOOTER_AIR = 84;

for (const height of HEIGHTS) {
  for (const [name, data] of [['a full session', SESSION], ['a short one', QUADS],
                              ['an empty one', {}],
                              ['a long one', { ...SESSION, exercises: Array.from({ length: 15 },
                                (_, i) => ({ name: `Exercise ${i + 1}`, sets: 3 })) }]]) {
    const l = shareCardLayout(data, height ? { height } : undefined);
    const brand = l.blocks.find((b) => b.kind === 'brand');
    const rest = l.blocks.filter((b) => b.kind !== 'brand');
    const last = rest.reduce((low, b) => Math.max(low, blockBox(b).bottom), 0);
    const air = brand.y - last;
    const label = `${name} at ${height || 'the default height'}`;
    ok(air >= 0 && air <= MAX_FOOTER_AIR,
       `${label}: ${air.toFixed(0)}px of air under the last line, inside the ${MAX_FOOTER_AIR}px `
       + 'the card gives its own margins');
  }
}

for (const height of [1080, 1200, 1350]) {
  // A forced height taller than the content leaves slack, and the whole point
  // is that the slack is SHARED. A card whose top margin is 84px and whose
  // bottom margin is 300px is a card that fell over.
  const l = shareCardLayout(QUADS, { height });
  const topAir = Math.min(...l.blocks.map((b) => blockBox(b).top));
  const botAir = height - Math.max(...l.blocks.map((b) => blockBox(b).bottom));
  ok(Math.abs(topAir - botAir) <= 1,
     `at a forced ${height} the leftover is split, not dumped at the end `
     + `(${topAir.toFixed(0)}px above, ${botAir.toFixed(0)}px below)`);
  ok(topAir >= 84 - 0.5, `and the ${height} card never eats into its own top margin`);
}

{
  // The ceiling still bites, and it is still a ceiling rather than a guess at
  // the room: 20 exercises on the tallest card is capped and counted.
  const twenty = Array.from({ length: 20 }, (_, i) => ({ name: `Exercise ${i + 1}`, sets: 3 }));
  const l = shareCardLayout({ ...SESSION, exercises: twenty }, { height: 1350 });
  const rows = texts(l, 'exercise').length;
  ok(rows <= 8, `the hard ceiling on list length survives the refit (${rows} rows)`);
  ok(texts(l, 'more')[0] === `+${20 - rows} more`, `and counts the rest: ${texts(l, 'more')[0]}`);
  ok(inBounds(l), 'and twenty exercises still fit inside a 1350 card' + escapee(l));
}

{
  // A height too small for the content is the one case where the list still has
  // to give way. It must cap AND say so, rather than draw over the wordmark.
  const l = shareCardLayout(QUADS, { height: 900 });
  ok(texts(l, 'exercise').length < 4 && has(l, 'more'),
     'a canvas too short for the session does cap the list, and says how many it dropped');
  ok(l.blocks.every((b) => blockBox(b).bottom <= 900 - 84 + 0.5),
     'and nothing, including the wordmark, is pushed off the bottom of it');
}

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
