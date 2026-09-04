// PROFILE SHAPE — the sections a profile is made of, drawn once for two people.
//
// 🚨 WHY THIS FILE EXISTS. Tim, 2026-09-16: *"When you view a friend's profile,
// instead of going straight to the muscle map and data section, I want you to
// view their profile display, like how they see it for themselves, with their
// profile picture big at the top, the workouts and frineds, the core lifts and
// weights (with other lifts aswell) and their training history (calendar)."*
//
// "Like how they see it for themselves" is a literal instruction: the friend's
// page has to be the SAME sections as `#/me`, not a second set that looks like
// them. This project has relearned that rule three times in a month — one
// calendar with four doors (`ownCalendar`), one Data screen with two subjects
// (`GraphView`), one muscle panel for my map and theirs (`musclePanel` +
// `shared-map.js`) — and every one of those started as "it is only a small
// duplicate". So the SHAPE lives here and both screens call it.
//
// ⚠️ WHAT IS HERE AND WHAT IS NOT, because the line is what keeps this module
// worth having. Here: the layout of a section, the words that qualify a number,
// the Rule 5 discipline about which figure is a measurement and which is a
// model. NOT here: where any number comes from. `#/me` gets its rows from the
// store through `rankedLifts()`; a friend's come from the document they
// published. Those two are genuinely different questions with genuinely
// different honesty problems, and flattening them into one function with a
// `friend` flag is how a caveat that is true of one subject gets printed over
// the other. The rows arrive already built; this draws them.
//
// ⚠️ THE DIFFERENCES ARE PASSED IN, ONE OPTION EACH, and they are all Tim's:
// no goals on somebody else's page, no body WEIGHT on it either, "published"
// rather than "trained" wherever a count is bounded by what they share, and
// their pronouns rather than mine over their figures.
//
// Pure presentation: no store, no network, no clock. Everything it needs is an
// argument.

import { el, chevron, personFace, fmtDateShort } from './ui.js';
import * as units from './units.js';

/* ------------------------------------------------------------------ *
 * The head — a face and a name
 * ------------------------------------------------------------------ */

/**
 * @param {string|null} avatar   the published photo, or null
 * @param {string} name          what to print under it
 * @param {Node} [under]         one node below the name (a link, a line)
 * @param {boolean} [large]      🚨 a friend's page only. Tim asked for their
 *   picture *"big at the top"*, and on `#/me` the head shares its row with
 *   nothing else either — so this is the same block at a bigger radius rather
 *   than a second head. The glyph scales with it or a photoless account gets a
 *   small mark rattling around inside a large circle.
 * @param {boolean} [glyph]      🔄 **A FACE WITH NO PHOTO IS A PERSON GLYPH ON
 *   A PROFILE, AND WAS NOTHING BEFORE.** `friend-face` skipped the whole block
 *   for an account with no picture (2026-08-31), and that was right when their
 *   page was a list under a title bar carrying their name — a bare circle would
 *   have been an ornament on most accounts. A profile has a SLOT for the face:
 *   the stats sit beside it and the name sits in it, so leaving it out moves
 *   everything else up and the screen reads as though it failed to load. Passed
 *   rather than assumed so the old behaviour is still expressible.
 */
export function profileHead({ avatar, name, under = null, large = false, glyph = true }) {
  const size = large ? 56 : 44;
  const face = avatar || glyph
    ? el('span', { class: 'me-face' + (large ? ' is-lg' : '') }, personFace(avatar, size))
    : null;
  return el('div', { class: 'me-head' },
    face,
    el('div', { class: 'me-who' },
      el('div', { class: 'me-name', text: name }),
      under,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * The figures
 * ------------------------------------------------------------------ */

/** One tappable figure. The number is the point, so it is the big thing. */
export function statTile(label, value, href) {
  return el('a', { class: 'me-stat', href },
    el('span', { class: 'me-stat-n', text: String(value) }),
    el('span', { class: 'me-stat-l', text: label }),
  );
}

/**
 * The same tile with nothing behind it.
 *
 * 🚨 TWO DIFFERENT ABSENCES AND THEY MUST NOT LOOK ALIKE. `off: true` is "this
 * cannot be known" — off the cloud on my own page, or a friend whose app has
 * not published the field yet — and it prints a DASH, dimmed, with no link,
 * because 0 there would be a claim where the truth is an absence. `off: false`
 * with a real 0 is "they have none", which is a complete answer and gets full
 * ink; it simply does not link, because a list of nobody is a screen with
 * nothing on it.
 */
export function statTileFlat(label, value, { off = false } = {}) {
  return el('span', { class: 'me-stat' + (off ? ' is-off' : '') },
    el('span', { class: 'me-stat-n', text: off ? '—' : String(value) }),
    el('span', { class: 'me-stat-l', text: label }),
  );
}

export function statRow(...tiles) {
  return el('div', { class: 'me-stats' }, ...tiles.filter(Boolean));
}

/* ------------------------------------------------------------------ *
 * A body, as facts
 *
 * 🚨 IT IS A READOUT ON ONE PAGE AND A DOOR ON THE OTHER, and that is the whole
 * difference between the two callers. `#/me` links to `#/profile`, the form
 * that sets these — Profile never writes, so the row is the way to the screen
 * that does. There is no such screen for somebody else's body, so a friend's
 * version is a plain block: a control that cannot answer is worse than no
 * control, which is the same rule that made their calendar cells inert.
 *
 * 🚨 AND A FRIEND'S NEVER CARRIES BODY WEIGHT. Tim: *"Display the 'your body'
 * details, but leave out the weight (only show gendar and age)."* It IS
 * published to friends who opted in, and `FriendView` printed it as a note
 * until today — so this is a removal, not a gap. The caller simply does not put
 * it in `facts`; there is no flag here to get wrong, because a flag is a thing
 * somebody can pass the other way round by accident.
 * ------------------------------------------------------------------ */

/**
 * @param {string} label   'Your body' / "Autumn's body"
 * @param {string[]} facts already-formatted, already-ordered, already-filtered
 * @param {string} sub     the line under them — what is missing, or when
 * @param {string} [href]  where the row goes; omitted makes it a plain block
 * @param {string} [empty] title when `facts` is empty. Omitted with no facts
 *   returns null — an empty row about somebody's body says nothing at all.
 */
export function bodyBlock({ label, facts, sub, href, empty }) {
  if (!facts.length && !empty) return null;
  const title = facts.length ? facts.join(' · ') : empty;
  const inner = [
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: title }),
      sub ? el('div', { class: 'row-sub wrap', text: sub }) : null,
    ),
    href ? el('span', { class: 'row-chev' }, chevron()) : null,
  ];
  return el('div', { class: 'me-section' },
    el('div', { class: 'section-label', text: label }),
    el('div', { class: 'list' },
      href ? el('a', { class: 'row', href }, ...inner) : el('div', { class: 'row static' }, ...inner),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * Best lifts
 *
 * The section Tim asked for on 2026-09-12 for his own profile — *"display the
 * core lifts, and then have 'other lifts' in an expandable section below it …
 * just show the weight of an estimated 1RM for each of these, and show the
 * confidence below it"* — and asked for again on somebody else's page today.
 *
 * Three rules, all of them Rule 5 / Rule 6, and all of them enforced by this
 * function rather than by whoever builds the rows:
 *
 *   · EVERY figure is an estimate and the section says so ONCE, in the caption
 *     under the core list, rather than stamping "est." on eight rows. A row
 *     that rests on a recorded set prints THAT SET in its sub-line, so the
 *     model is never the only number on the row.
 *   · The COLOUR is the level ramp (`lv-text-<key>`), and the level's NAME is
 *     printed in words beside the confidence — the colour is never the only
 *     carrier. A row that cannot be ranked says "not ranked" in those words.
 *   · NO verdict word anywhere. Band names and level names only.
 *
 * ⚠️ `<details>`/`<summary>` for "Other lifts" — the disclosure the Research
 * topics use, keyboard- and screen-reader-native without a line of code.
 * ------------------------------------------------------------------ */

/**
 * Why a lift has no number, in the reader's words.
 *
 * 🚨 TWO MAPS BECAUSE THERE ARE TWO SUBJECTS AND THE SENTENCES ARE NOT THE
 * SAME SENTENCE. "Nothing recorded for this muscle yet" is an instruction on my
 * own page and a statement about somebody else on theirs — and half of a
 * friend's reasons do not exist for me at all, because they are about what
 * their app has published rather than about what either of us has trained.
 * Keys are shared with `js/profile-ranking.js`, which stays wordless.
 */
export const NO_NUMBER = {
  'no-evidence':   'Nothing recorded for this muscle yet',
  'stand-in-only': 'Only a stand-in rates this muscle — record the lift, or a close one',
  'no-conversion': 'No published way to convert this one',
  'no-standard':   'No standard to rank it against',
};

export const NO_NUMBER_THEIRS = {
  'no-evidence':   'Nothing they publish trains this muscle',
  'stand-in-only': 'Only a stand-in rates this muscle in what they publish',
  'no-conversion': 'No published way to convert this one',
  'no-standard':   'No standard to rank it against',
  // A friend's own two. Their app rates MUSCLES and publishes a grid of them;
  // a muscle missing from that grid is a muscle their device declined to rate,
  // and there is nothing on this device that could honestly stand in for it.
  'not-rated':     'They have not published a rating for this muscle',
  'not-in-group':  'Not in the comparison group they published',
  // A pull-up or a dip from somebody whose weigh-in is not in what they share.
  // 🚨 IT IS NAMED RATHER THAN GUESSED. The plate on the belt is not the load
  // the body lifted, and printing it would read as a twenty-five pound pull-up
  // max; converting their muscle rating back out on this device would be an
  // estimate of an estimate wearing a measurement's clothes.
  'not-priced':    'Their body weight is not in what they share, so this one cannot be priced',
  // The 2026-09-03 document, which carries a level and nothing behind it.
  legacy:          'Their app has not published the number behind this level yet',
};

/**
 * One lift.
 *
 * @param {object} l  a `rankedLifts()`-shaped row. The fields this reads are
 *   the contract between the two callers: `name`, `oneRM`, `shown`, `perSide`,
 *   `level`, `percentile`, `band`, `days`, `lastDate`, `best`, `source`,
 *   `from`, `why`, `bodyIncluded`, and optionally `sub` — a sub-line the caller
 *   has already written, for a row whose provenance this module cannot infer.
 * @param {object} [opts]
 * @param {object} [opts.noNumber]  which sentence map to read `why` from
 * @param {string} [opts.unranked]  what to print where the level name goes on a
 *   row that HAS a number and cannot be ranked. Defaults to "not ranked".
 */
export function liftRow(l, opts = {}) {
  const noNumber = opts.noNumber || NO_NUMBER;
  const unranked = opts.unranked || 'not ranked';
  // `level` null WITH a percentile is "below Beginner" — plain ink, no chip,
  // because inventing an eighth level is what `lv-text-below` refuses to do.
  const lvKey = l.level ? l.level.key : (l.percentile !== null ? 'below' : null);
  const lvName = l.level ? l.level.name : (l.percentile !== null ? 'Below Beginner' : null);

  return el('div', { class: 'row me-best' + (l.oneRM === null ? ' is-none' : '') },
    el('div', { class: 'row-main' },
      el('div', { class: 'row-title', text: l.name }),
      el('div', { class: 'row-sub wrap', text: subText(l) }),
    ),
    el('div', { class: 'me-best-nums' },
      l.oneRM === null
        // No number: say why, in the number's slot, so the row is not a hole.
        ? el('span', { class: 'me-best-none', text: noNumber[l.why] || 'No estimate' })
        : el('span', { class: 'me-best-top' + (lvKey ? ` lv-text-${lvKey}` : ''),
            text: units.withUnit(Math.round(l.shown)) + (l.perSide ? '/side' : '') }),
      // The confidence in words under the number — Tim's ask — with the
      // level's NAME beside it so the colour is never the only carrier.
      l.oneRM === null ? null
        : el('span', { class: 'me-best-est', text:
            (l.band ? `${l.band.name} confidence` : 'Estimated')
            + (lvName ? ` · ${lvName}` : ` · ${unranked}`) }),
    ),
  );
}

/* The sub-line: what the number rests on. A recorded row names the SET it was
 * modelled from — Rule 5's measured anchor on the row; a converted row names
 * what it was converted from and says the lift was never recorded.
 *
 * ⚠️ `l.sub` WINS WHEN IT IS THERE, and it is how a friend's published row gets
 * a truthful provenance line. Their document does not carry "days trained" per
 * lift, and printing "0 days" over a real rating would be a false statement
 * made by a default rather than by anybody's decision. */
function subText(l) {
  if (typeof l.sub === 'string') return l.sub;
  if (l.source === 'recorded' && l.best) {
    const set = l.best.kind === 'reps'
      ? `${l.best.reps} reps`
      : `${units.withUnit(l.best.weight)}${l.perSide ? '/side' : ''}${l.best.reps ? ` × ${l.best.reps}` : ''}`
        + (l.bodyIncluded ? ' added' : '');
    return `${set} · ${daysText(l)}`;
  }
  if (l.source === 'converted') {
    return `Estimated from ${l.from.join(', ')}` + (l.days ? ` · ${daysText(l)}` : ' · never recorded')
      + (l.bodyIncluded ? ' · body weight included' : '');
  }
  return l.days ? daysText(l) : 'Not trained yet';
}

export function daysText(l) {
  return `${l.days} ${l.days === 1 ? 'day' : 'days'}`
    + (l.lastDate ? ` · last ${fmtDateShort(l.lastDate)}` : '');
}

/**
 * The whole section: the core list, the caption, and "Other lifts" behind a
 * disclosure.
 *
 * @param {object} model
 * @param {Array}  model.core      always drawn, even where a row has no number
 * @param {Array}  model.other     everything else with a loaded best
 * @param {Array}  model.repsOnly  a true best with no honest pound figure
 * @param {string} model.caption   the ONE sentence: that every figure is an
 *   estimate, and which group the colours were computed against. Required —
 *   a ranked list with no statement of its population is the fault the
 *   comparison control exists to prevent.
 * @param {string} [model.label]   'Your best lifts' / 'Their best lifts'
 * @param {string} [model.note]    a second line under the caption, for
 *   something true of this subject and not the other (a friend's window).
 * @param {object} [opts]          passed through to `liftRow`
 */
export function bestLiftsBlock(model, opts = {}) {
  const core = model.core || [];
  const other = model.other || [];
  const repsOnly = model.repsOnly || [];
  const otherCount = other.length + repsOnly.length;

  return el('div', { class: 'me-bests' },
    el('div', { class: 'section-label', text: model.label || 'Best lifts' }),
    el('div', { class: 'list' }, ...core.map((l) => liftRow(l, opts))),

    el('div', { class: 'field-help', text: model.caption }),
    model.note ? el('div', { class: 'field-help', text: model.note }) : null,

    otherCount
      ? el('details', { class: 'me-other' },
          el('summary', { class: 'me-other-sum' },
            el('span', { class: 'me-other-title', text: 'Other lifts' }),
            el('span', { class: 'me-other-n', text: String(otherCount) }),
            el('span', { class: 'me-other-chev' }, chevron()),
          ),
          el('div', { class: 'list' },
            ...other.map((l) => liftRow(l, opts)),
            // Reps-only work — pull-ups with no weigh-in, push-ups — has a true
            // best and no honest pound figure. Listed plainly, uncoloured.
            ...repsOnly.map((l) => el('div', { class: 'row me-best' },
              el('div', { class: 'row-main' },
                el('div', { class: 'row-title', text: l.name }),
                el('div', { class: 'row-sub wrap', text:
                  typeof l.sub === 'string' ? l.sub : daysText(l) }),
              ),
              el('div', { class: 'me-best-nums' },
                el('span', { class: 'me-best-top', text: `${l.reps} reps` }),
                el('span', { class: 'me-best-est', text: 'measured, not ranked' }),
              ),
            )),
          ),
        )
      : null,
  );
}

/* ------------------------------------------------------------------ *
 * Training history
 *
 * ⚠️ THE CALENDAR IS HANDED IN, ALREADY BUILT, and that is deliberate: there is
 * exactly one `ownCalendar()` and it lives in `views-data.js` with the four
 * doors that use it. Importing it here would put a third module in that chain
 * for the sake of two lines, and this module is meant to have no dependencies
 * a screen could not satisfy on its own.
 * ------------------------------------------------------------------ */
export function calendarBlock(cal, label = 'Training history') {
  const host = el('div', { class: 'me-cal-host' });
  // Painted after the node exists, exactly as the other doors do it.
  queueMicrotask(() => cal.paint(host));
  return el('div', { class: 'me-cal' },
    el('div', { class: 'section-label', text: label }),
    cal.top,
    host,
  );
}
