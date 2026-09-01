// Muscle Groups — the body map.
//
// Third mode of the Data screen. Colours each muscle by where its key lift sits
// among people who lift, grey where nothing is benchmarked.
//
// The one thing this screen must never do is imply the comparison is against
// everyone. "Stronger than 80 % of people" is false; the caption says
// "of people who lift" everywhere, and the general-population figure is a
// separate, clearly-labelled line.

import { store, social, muscleStrength, weeklyVolumeByMuscle } from './store.js';
// `weightForPercentile` and `MUSCLE_LIFTS` left with the seven-row target table
// on 2026-08-21 — nothing on this screen asks what a level is worth in pounds
// any more, only what the next one costs, and `m.toNext` carries that.
import {
  LEVELS, UNRANKABLE, keyLiftFor,
  COMPARE_OPTIONS, normalizeCompare, comparisonLabel, comparePreset, matchesPreset,
} from './strength-standards.js';
import { bodySvg, setSelected } from './body-map.js';
import { setChildren, el, emptyState, trimNum, fmtDateShort, icon, openSheet } from './ui.js';
import * as units from './units.js';

const go = (hash) => { location.hash = hash; };

let selected = null;

/* ------------------------------------------------------------------ *
 * TRAINED, BUT NOT RANKABLE — the third state this map needs
 * ------------------------------------------------------------------ *
 *
 * 🚨 GREY MEANT TWO OPPOSITE THINGS AND THE LEGEND ONLY ADMITTED ONE. Core and
 * Neck have no published strength standards, so they were painted with exactly
 * the fill somebody gets when they have never trained a muscle — and the only
 * grey entry in the key reads "No data". Somebody who trains abs three times a
 * week saw the colour of somebody who has never done a sit-up.
 *
 * ⚠️ IT WAS NOT A CAUTIOUS CHOICE, IT WAS A FALSE ONE. The screen already
 * printed the truth in words a few lines below the figure — "Core and Neck
 * can't be ranked, there are no published strength standards for them" — so the
 * app was saying the right thing in text and the wrong thing in colour, on one
 * screen, at the same time. Reported by Tim on 2026-09-01 and again on -09-03;
 * fixed 2026-09-04.
 *
 * 🚨 IT IS A HATCH, NOT A NEW COLOUR, and that is deliberate: this figure's
 * ramp is already legal only because the level key gives it a second encoding,
 * and a ninth flat colour would be one more thing to tell apart by hue alone. A
 * hatch survives greyscale and every form of colour blindness, and it reads as
 * "marked, but not on the scale" rather than as a rank between two levels.
 *
 * ⚠️ THE WINDOW IS A YEAR, AND THE PANEL SAYS SO. The question this answers is
 * the one grey was getting wrong — "does this app know I train my abs" — and
 * that is a question about training rather than about the last four weeks. The
 * Volume screen's 28-day rate is a different claim and stays where it is.
 *
 * ⚠️ THIS DOES NOT RANK ANYTHING, and must never start to. It says the work was
 * recorded and that no standard exists to place it against. If Core becomes
 * rankable later, this state does not disappear — Neck keeps it permanently,
 * and so does anybody whose ab work is planks and leg raises.
 */
const TRAINED_WINDOW_DAYS = 365;

/** Muscles with no standards that nonetheless have recorded work behind them. */
async function trainedButUnrankable(rows = null) {
  const out = new Map();
  // Cardio and Activity are library shelves rather than muscles — they are not
  // on the figure at all, so marking them would mark nothing.
  const wanted = UNRANKABLE.filter((u) => u !== 'Cardio' && u !== 'Activity');

  const vol = await weeklyVolumeByMuscle(TRAINED_WINDOW_DAYS, null, rows);
  if (!vol) return out;

  for (const m of vol.muscles) {
    if (!wanted.includes(m.muscle) || !m.totalSets) continue;
    out.set(m.muscle, {
      sets: m.totalSets,
      days: m.daysTrained,
      windowDays: TRAINED_WINDOW_DAYS,
      // Named, for the same reason the rated panel names the set it came from:
      // "we counted 14 sets" is a claim somebody should be able to check.
      contributors: m.contributors,
    });
  }
  return out;
}

export async function muscleGroupsPane(host, top) {
  const [{ profile, muscles, blocked, ready }, settings, trained] = await Promise.all([
    muscleStrength(), store.getSettings(), trainedButUnrankable(),
  ]);
  // ⚠️ OFF BY DEFAULT — Tim, 2026-08-25: *"showing the percentile is a little
  // harsh for some people."* The level is the answer; the percentile is the
  // working behind it, and the working is what stings. See SettingsView.
  const more = settings.moreDetails === true;
  // Changing the comparison group changes the percentile, the level, the
  // targets and the colours, so the whole pane is rebuilt rather than repainted.
  const reload = () => muscleGroupsPane(host, top);

  if (!ready) {
    setChildren(top);
    setChildren(host, emptyState(
      'Tell us about you first',
      `Ranking a muscle group needs your ${profile.missing.join(' and ')} — every strength `
      + 'standard is a ratio to body weight, and they differ between men and women.',
      el('a', { class: 'btn primary', href: '#/profile', text: 'Open profile' }),
    ));
    return;
  }

  if (!muscles.size) {
    setChildren(top);
    setChildren(host, emptyState(
      'Nothing to rank yet',
      'Any exercise that trains a muscle rates it — a hammer curl rates biceps just as a barbell '
      + 'curl does. Log a workout or record a benchmark and the map lights up.',
      el('a', { class: 'btn primary', href: '#/benchmark', text: 'Record a benchmark' }),
    ));
    return;
  }

  /* ---- top row: what the comparison is against ---- */

  // The whole row is the control. Tim asked to be able to choose the comparison
  // group; making the existing caption the button means the thing that STATES
  // the comparison is also the thing that CHANGES it, so there is nothing extra
  // on a screen whose rule is that the content comes first.
  const label = comparisonLabel(profile);

  setChildren(top,
    el('div', { class: 'control-row' },
      el('button', {
        class: 'basis basis-btn', 'aria-haspopup': 'dialog',
        onClick: () => openCompareSheet(profile, reload),
      },
        el('span', { class: 'basis-main' },
          label.main,
          icon('down', 15),
        ),
        el('span', { class: 'basis-sub', text: label.sub }),
      ),
      // The old "vs. everyone" toggle is gone: comparing against people who do
      // not lift is now one of the four axes in the sheet, so having it in two
      // places would let them contradict each other.
      /* 🚨 COMPARE — Tim, 2026-09-03: *"whenever you're on a muscle group display
       * of someone… make a compare button somewhere that allows that user to
       * display another person's body side by side."* It is on THIS map as well
       * as on a friend's, because "someone" includes yourself: the obvious thing
       * to want from your own body map is somebody else's beside it. */
      el('button', {
        class: 'btn small', text: 'Compare',
        onClick: () => pickSomebodyToCompare(),
      }),
    ),
  );

  /* ---- the body ---- */

  const levelMap = new Map();
  for (const [muscle, m] of muscles) {
    levelMap.set(muscle, {
      levelKey: m.level ? m.level.key : 'below',
      label: m.level ? m.level.name : 'Below Beginner',
      // How much of the level's colour survives. The rating is the hue; how
      // sure we are is how vivid it is. Grey already means "never trained", so
      // fading toward grey reads as one scale rather than a second code to
      // learn — and it never reaches grey, because "unsure" and "no data" are
      // completely different messages.
      tint: m.tint,
      confidence: m.band ? m.band.name : null,
    });
  }

  // The third state, painted after the rated ones so it can never overwrite a
  // real level: a muscle that is both rankable and unrankable is a contradiction
  // the map should not try to draw, and `MUSCLE_LIFTS` and `UNRANKABLE` are
  // disjoint by construction anyway.
  for (const [muscle, t] of trained) {
    if (levelMap.has(muscle)) continue;
    levelMap.set(muscle, { unrankable: true, label: 'trained, can\'t be ranked', sets: t.sets });
  }

  // The figure is built ONCE. Rebuilding it on every tap would re-attach the
  // two ink mask images and flash the drawing; only the panel below changes.
  const body = bodySvg(levelMap, selected, (muscle) => {
    selected = selected === muscle ? null : muscle;
    setSelected(body, selected);
    renderPanel();
  });
  const foot = el('div', { class: 'body-foot' });

  function renderPanel() {
    setChildren(foot,
      legend(more, trained.size > 0),
      selected
        ? detail(muscles.get(selected), selected, profile,
                 blocked ? blocked.get(selected) : null, more, trained.get(selected))
        : summary(muscles, trained),
    );
  }

  function render() {
    setChildren(host, el('div', { class: 'body-wrap' }, body), foot);
    renderPanel();
  }

  render();
}

/**
 * Who to put beside you — friends, because they are who this app knows about.
 *
 * ⚠️ IT OPENS A SHEET RATHER THAN NAVIGATING, and the difference matters on a
 * screen with no obvious second person: a "Compare" button that jumped straight
 * to a chooser screen would take somebody off their own map to answer a question
 * they might not want to answer. The sheet is dismissible over the top of it.
 *
 * ⚠️ THE HONEST REFUSALS ARE HERE TOO. No friends, no cloud, the demo account —
 * each one gets the sentence that says which, because "nobody to compare with"
 * over an empty list would read as the feature being broken.
 */
async function pickSomebodyToCompare() {
  let state;
  try { state = await social.state(); } catch (_) { state = { available: false, reason: 'offline' }; }

  const body = el('div', { class: 'pick-list' });
  if (!state.available || !state.connections.length) {
    setChildren(body,
      el('p', { class: 'note', text: state.available
        ? 'Nobody to compare with yet. Add a friend and their body map appears here.'
        : 'Comparing needs a friend, and friends need an account you are signed in to.' }),
      el('a', { class: 'btn primary block', href: '#/social', text: 'Friends' }),
    );
  } else {
    setChildren(body, ...state.connections.map((c) => el('a', {
      class: 'pick-row', href: `#/compare/${encodeURIComponent(c.uid)}`,
    },
      el('div', { style: 'flex:1;min-width:0' },
        el('div', { class: 'pick-title', text: c.name || 'Friend' }),
        el('div', { class: 'pick-sub', text: 'Their body beside yours' }),
      ),
    )));
  }
  openSheet({ title: 'Compare with', body });
}

/* ------------------------------------------------------------------ *
 * Legend — always on screen, so level is never colour-alone
 * ------------------------------------------------------------------ */

/**
 * The key: one chip per level, the level's name inside it, shaded in its colour.
 *
 * ⚠️ Tim, 2026-08-25, after using it in a gym: *"the key is too small and not
 * clear enough… mini round boxes right below the picture of the human with the
 * name of the ranking inside and the box shaded in the color that it is."* It
 * was a 10px swatch, an 11px grey name and a 10px percentage, three to a line.
 *
 * ⚠️ AND THE CHIPS ARE LOAD-BEARING, NOT DECORATIVE. The palette they draw from
 * (2026-08-25, his reference image) fails the CVD adjacency check on
 * green↔orange, and the validator's own rule is that such a failure is
 * survivable only with direct labels. These are the direct labels. Anything
 * that shrinks them back toward swatches takes that argument away with it.
 *
 * ⚠️ NO PERCENTAGES UNLESS "MORE DETAILS" IS ON. His words: *"showing the
 * percentile is a little harsh for some people."* The level is the answer; the
 * percentile behind it is the working.
 */
export function legend(moreDetails, anyTrainedUnrankable = false) {
  return el('div', { class: 'lv-key-wrap' },
    el('div', { class: 'lv-key' },
      ...LEVELS.map((l) =>
        el('span', { class: 'lv-chip lv-' + l.key },
          l.name,
          moreDetails ? el('span', { class: 'lv-pct', text: `${l.percentile}%` }) : null,
        )),
    ),
    // "No data" and the fade are not levels, so they stay notes rather than
    // becoming two more chips somebody could try to rank themselves against.
    el('div', { class: 'lv-notes' },
      el('span', { class: 'lv-key-item' },
        el('i', { class: 'lv-sw lv-none' }),
        el('span', { class: 'lv-name', text: 'No data' }),
      ),
      /* ⚠️ ONLY SHOWN WHEN SOMETHING ON THE FIGURE IS ACTUALLY HATCHED. A key
         entry for a mark that is nowhere on screen is a puzzle rather than a
         key — it invites somebody to go looking for a state they are not in.
         Same reasoning as "No data", which is always shown because a body with
         nothing recorded is the state everybody starts in. */
      anyTrainedUnrankable
        ? el('span', { class: 'lv-key-item' },
            el('i', { class: 'lv-sw lv-unranked' }),
            el('span', { class: 'lv-name', text: 'Trained · can\'t be ranked' }),
          )
        : null,
      // Without this the fade is an unexplained visual, and an unexplained
      // visual reads as a rendering bug rather than as information.
      el('span', { class: 'lv-key-item lv-key-note' },
        el('i', { class: 'lv-sw lv-faded' }),
        el('span', { class: 'lv-name', text: 'Faded = less sure' }),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * "Compared to:" — who the ranking is measured against
 * ------------------------------------------------------------------ */

// FOUR independent axes, and two presets on top of them (Tim, 2026-08-17).
//
// The axes are separate rather than a preset list because they genuinely are
// independent — "women, any body weight, my age" is a real question, and no
// preset list holds every combination without becoming a menu nobody reads. The
// presets exist because the two combinations people actually want are the two
// extremes, and setting four things by hand to reach either of them is a chore.
//
// The rule this must never break: every option changes the STATED comparison in
// the header at the same moment it changes the colours, so the number and the
// population it refers to can never drift apart. That rule got stricter here,
// not looser — ranking against people who do not lift is now genuinely on
// offer, so the caption has to carry the difference every single time.
const COMPARE_AXES = [
  { key: 'pool', title: 'Population',
    help: 'Most adults do not lift at all, so including them raises every level. '
      + 'What an untrained adult can lift has never been properly measured — that option is a rough estimate.' },
  { key: 'sex', title: 'Sex',
    help: 'Men and women are held to different standards, so this changes every level.' },
  { key: 'weight', title: 'Body weight',
    help: 'Standards scale with body weight. Ignoring it compares you against people of every size.' },
  { key: 'age', title: 'Age',
    help: 'Strength peaks around 23–40. Ignoring age drops the correction that keeps an older lifter from reading as permanently weak.' },
];

const PRESETS = [
  { key: 'like-me', name: 'Like me', hint: 'Lifters of my sex, weight and age' },
  { key: 'everyone', name: 'Everyone', hint: 'All adults, any sex, weight or age' },
];

/**
 * @param {object}   profile   whose body the map is about
 * @param {Function} onChange  re-rank and repaint
 * @param {Function} [save]    ⚠️ how the choice is REMEMBERED, and it is a
 *   parameter since 2026-09-03 because there are two answers. On your own map it
 *   writes `settings.compare`, as it always has. On somebody ELSE's it must not:
 *   a viewer flipping to "women" to look at a friend's map is asking a question
 *   about that screen, not changing the standard their own body is ranked
 *   against, and silently rewriting their setting from another person's page is
 *   the kind of thing nobody would ever find.
 */
export function openCompareSheet(profile, onChange, save) {
  let current = normalizeCompare(profile.compare);
  const body = el('div', { class: 'compare-sheet' });
  const persist = save || ((next) => store.saveSettings({ compare: { ...next } }));

  const apply = async (next) => {
    current = normalizeCompare(next);
    await persist(current);
    draw();
    // Re-rank rather than repaint: the percentile, the level, the targets and
    // the colours all move together.
    onChange(current);
  };

  function draw() {
    // `profile.compare` is the value this sheet was opened with; the presets and
    // the pressed states must reflect the LIVE choice, so a throwaway profile
    // carrying `current` is what gets asked.
    const live = { ...profile, compare: current };

    setChildren(body,
      // The presets, first, because they are what most people want and the four
      // axes below are the escape hatch rather than the main event.
      el('div', { class: 'compare-axis' },
        el('div', { class: 'compare-opts' },
          ...PRESETS.map((p) =>
            el('button', {
              class: 'btn preset',
              'aria-pressed': String(matchesPreset(current, p.key === 'everyone' ? 'everyone' : 'like-me', profile)),
              onClick: () => apply(comparePreset(p.key === 'everyone' ? 'everyone' : 'like-me', profile)),
            },
              el('span', { class: 'preset-name', text: p.name }),
              el('span', { class: 'preset-hint', text: p.hint }),
            ))),
      ),

      ...COMPARE_AXES.map((axis) =>
        el('div', { class: 'compare-axis' },
          el('div', { class: 'section-label', text: axis.title }),
          el('div', { class: 'compare-opts' },
            ...COMPARE_OPTIONS[axis.key].filter((o) => !o.hidden).map((opt) =>
              el('button', {
                // .chip[aria-pressed="true"] already carries the selected look,
                // so the state lives in the attribute the screen reader reads
                // rather than in a second class that could disagree with it.
                class: 'chip',
                'aria-pressed': String(isChosen(axis.key, opt.key, current, profile)),
                text: opt.name,
                onClick: () => apply({ ...current, [axis.key]: opt.key }),
              }))),
          el('div', { class: 'field-help', text: axis.help }),
        )),

      el('div', { class: 'field-help' },
        'Now comparing you against ',
        el('b', { text: comparisonLabel(live).main.replace(/^vs\. /, '') }),
        ` — ${comparisonLabel(live).sub}.`),
    );
  }
  draw();

  openSheet({ title: 'Compared to', body });
}

// `sex: 'own'` is the stored default and is never shown, so the chip that lights
// up for it is the user's actual sex. Without this, someone who has never opened
// the sheet would see nothing selected under Sex and read it as broken.
function isChosen(axis, key, current, profile) {
  if (axis !== 'sex') return current[axis] === key;
  const resolved = current.sex === 'own'
    ? (profile && profile.gender === 'female' ? 'female' : 'male')
    : current.sex;
  return resolved === key;
}


/* ------------------------------------------------------------------ *
 * Confidence
 * ------------------------------------------------------------------ */

/**
 * Confidence, in one line.
 *
 * ⚠️ THE BAR IS GONE AND THE WORD IS NOT. It used to be a labelled row, a
 * percentage, a progress bar and a corroboration sentence — four elements for a
 * quantity the figure above is ALREADY showing, because D19 paints confidence as
 * the fade on the muscle itself and the legend says "Faded = less sure". Drawing
 * it a second time as a bar taught nothing the colour had not, and it sat next
 * to the to-next bar, where two bars measuring different things is worse than
 * one bar and a word.
 *
 * Sessions AND exercises stay, because they answer different questions and
 * dropping the second would let the first mislead: "40 sessions" reads as well
 * corroborated, and "40 sessions, all of one exercise" is the same fact told
 * honestly. It is the shortest form of that, not the absence of it.
 */
function confidenceLine(m) {
  const sessions = m.contributorCount === 1 ? '1 session' : `${m.contributorCount} sessions`;
  const sources = m.exerciseCount > 1
    ? `${sessions}, ${m.exerciseCount} exercises`
    : sessions;
  return `${m.band.name} confidence · ${sources}`;
}

function summary(muscles, trained = new Map()) {
  const ranked = [...muscles.values()].filter((m) => m.level);
  // Cardio and Activity are library shelves, not muscles — listing them as
  // "not ranked" beside Core and Neck would imply the map is missing them.
  const unranked = UNRANKABLE.filter((u) => u !== 'Cardio' && u !== 'Activity');
  const strongest = ranked.slice().sort((a, b) => b.percentile - a.percentile)[0];
  const weakest = ranked.slice().sort((a, b) => a.percentile - b.percentile)[0];

  return el('div', { class: 'card' },
    el('div', { class: 'field-help', text: 'Tap a muscle for its numbers.' }),
    strongest && weakest && strongest !== weakest
      ? el('div', { class: 'field-help' },
          `Strongest: ${strongest.muscle} (${strongest.level.name}). `
          + `Furthest behind: ${weakest.muscle} (${weakest.level.name}).`)
      : null,
    /* ⚠️ THIS SENTENCE WAS ALREADY TRUE AND THE COLOUR BESIDE IT WAS NOT. It
       now names which of them you have actually trained, because "can't be
       ranked" and "nothing recorded" were the two things the old grey ran
       together, and saying so in the same breath is what stops the hatch
       reading as a worse level. */
    el('div', { class: 'field-help', text:
      `${unranked.join(' and ')} can't be ranked — there are no published strength standards for them.`
      + (trained.size
        ? ` Your ${[...trained.keys()].join(' and ')} work is still recorded and counted; `
          + 'tap for what it found.'
        : '') }),
  );
}

/* ------------------------------------------------------------------ *
 * Detail for one muscle
 * ------------------------------------------------------------------ */

// `blocked` is work the user really did that the rating could not use. It is
// rendered in BOTH branches on purpose: a grey muscle needs it to stop the panel
// saying "nothing recorded" about thirty sets of pull-ups, and a rated muscle
// needs it because a rating built on rows while ignoring every chin-up is
// under-reporting its own evidence while looking complete.
//
// ⚠️ ONLY THE UNMEASURED CASE CAN REACH THIS SCREEN, and that is why there is no
// "log a weigh-in" button here even though rankBlockedReason() can produce that
// message. The map requires a body weight before it renders anything at all —
// `profile.missing` includes it, and muscleStrength() returns ready:false — so
// by the time a panel exists, a weigh-in exists and every bodyweight exercise
// with a published fraction is already counting. What is left is the permanent
// kind: an inverted row whose fraction spans 37–79 % with a bar height the app
// does not record, or a handstand push-up nobody has ever put on a force plate.
// Offering a button for those would be a promise the app cannot keep.
//
// The actionable wording is not wasted — it reaches the user on the GRAPH, in
// normalizeBlockedReason(), which has no profile gate in front of it.
function blockedNote(blocked) {
  if (!blocked || !blocked.exercises.length) return null;
  const names = blocked.exercises.map((e) => e.name);
  const listed = names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  const sets = blocked.sets;
  // One line, same claim. It has to keep naming the exercises: the whole point
  // is that a muscle must not read as "nothing recorded" over work somebody
  // actually did, and "3 sets not counted" without saying which is no better.
  return el('div', { class: 'muscle-warn', text:
    `${sets} set${sets === 1 ? '' : 's'} of ${listed} not counted — ${blocked.exercises[0].reason}.` });
}

/**
 * What a muscle with no standards HAS got: sets, days, and the exercises.
 *
 * ⚠️ EVERY NUMBER HERE IS A COUNT OF THINGS THAT HAPPENED, and that is the whole
 * design. A count needs no published median, no body weight, no age and no
 * comparison group, so nothing in this block can be wrong in the way a
 * percentile can — which is what makes it safe to show for a muscle the app has
 * just admitted it cannot rank.
 *
 * ⚠️ THE WINDOW IS STATED. "14 sets" without "in the last year" is a number
 * whose meaning depends on how long you have been logging.
 */
function trainedNote(trained) {
  if (!trained || !trained.sets) return null;
  const { sets, days, windowDays, contributors } = trained;
  const months = Math.round(windowDays / 30);
  const names = (contributors || []).slice(0, 3).map((c) => c.name);
  const rest = (contributors || []).length - names.length;

  /* ⚠️ NO BUTTON TO THE VOLUME SCREEN, THOUGH THAT IS WHERE THIS WORK IS
     CHARTED. The Data screen's five segments are in-page state on `#/graphs`,
     so there is no hash that opens Volume — a link would land the user back on
     the Muscles tab they are already looking at, which is a dead end wearing a
     button. Naming the screen in words is the honest version until the segment
     is addressable. */
  return el('div', { class: 'muscle-logged' },
    el('div', { text:
      `${sets} set${sets === 1 ? '' : 's'} recorded in the last ${months} months, `
      + `across ${days} session${days === 1 ? '' : 's'}, and every one counts toward your weekly `
      + 'volume — there is just no published standard to place it against.' }),
    names.length
      ? el('div', { text: `From ${names.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}.` })
      : null,
  );
}

/**
 * ⚠️ EXPORTED SINCE 2026-09-03, and it is the same function on both screens.
 *
 * A friend's muscle panel could have been written beside this one — and then
 * there would be two places that must agree forever about what "estimated" means,
 * which caveat is allowed to be shortened, and whether an inference may sit next
 * to a measurement without being labelled. `js/shared-map.js` translates their
 * published map into the shape this already takes, so there is one panel.
 *
 * `blocked` is always null for somebody else: the sets a rating had to discard
 * are worked out from a private library walk that is not published. The panel
 * simply omits that line rather than inventing one.
 */
export function musclePanel(m, muscle, profile, blocked, moreDetails, trained) {
  return detail(m, muscle, profile, blocked, moreDetails, trained);
}

function detail(m, muscle, profile, blocked, moreDetails, trained) {
  if (!m) {
    const lift = keyLiftFor(muscle);
    const note = blockedNote(blocked);
    return el('div', { class: 'card' },
      el('div', { class: 'section-label', text: muscle }),
      el('div', { class: 'field-help' },
        lift
          ? (note
            ? 'Nothing here can be ranked yet, but that is not the same as nothing recorded.'
            : `Nothing recorded for this muscle yet. Any exercise that trains it counts — `
              + `${lift.name} is the standard it is measured against, but it is not the only thing `
              + 'that rates it.')
          : 'This muscle has no published strength standards, so it can\'t be ranked.'),
      /* 🚨 THE HALF THE PANEL WAS MISSING. Tapping Core used to say only that it
         cannot be ranked, which is a statement about the world rather than about
         you — and it is what made grey feel like the app had not noticed. What
         it HAS got is a set count and the exercises behind it: no level, no
         percentile, no comparison to anybody, which is exactly why none of it
         needs a standard to be true. */
      trainedNote(trained),
      note,
      lift
        ? el('a', { class: 'btn primary block', href: '#/benchmark', text: `Benchmark ${lift.name}` })
        : null,
    );
  }

  const pct = Math.round(m.percentile);

  /* ⚠️ WHAT THIS PANEL NO LONGER SHOWS, and why — Tim, 2026-08-21: "make way
     less words on the bottom… if there's anything you think isn't that
     important to show, then don't show it."

     GONE — the seven-row table of per-level weight targets. It was the largest
     thing here by a distance, and six of its seven rows are weights for levels
     somebody is nowhere near. The one row that is actionable is the next one,
     and the to-next bar already carries it with its own progress.

     GONE — the restatement of the comparison group. It read "Stronger than 71%
     of men who lift — at my body weight, around 30", which is the same sentence
     the header states. ⚠️ That header is `.pane-top`, which is FIXED and
     therefore on screen at every moment this panel is, so D15's rule that the
     UI must say "of people who lift" is still kept — by the line that is always
     visible rather than by two lines that agreed with each other.

     GONE — "newest N days ago", the confidence percentage, and the confidence
     bar. See confidenceLine().

     KEPT, because the app's credibility is the reason it exists: where the
     number came from (Rule 5), how well corroborated it is, and every caveat.
     They are one line each now. **Shortening a caveat is allowed; softening one
     is not** — none of them lost a claim, only words. */

  return el('div', { class: 'card muscle-detail' },
    el('div', { class: 'muscle-head' },
      el('span', { class: 'muscle-name', text: muscle }),
      el('span', { class: 'muscle-level lv-text-' + (m.level ? m.level.key : 'below'),
        text: m.level ? m.level.name : 'Below Beginner' }),
    ),

    // The two things somebody taps a muscle to find out, on one line and big
    // enough to read at arm's length.
    //
    // ⚠️ "stronger than 71 %" IS BEHIND "More details" SINCE 2026-08-25, and it
    // is the reason the setting exists — Tim: *"showing the percentile is a
    // little harsh for some people."* The level name is still right above this
    // line in `.muscle-head`, so nothing is hidden about WHERE somebody stands;
    // what goes is the ranking of them against other people, stated as a number.
    //
    // ⚠️ D15 IS NOT WEAKENED BY THIS. Its rule is that the app must never imply
    // the comparison is against everyone — carried by the `.pane-top` header,
    // which is fixed and therefore on screen whenever this panel is. Removing a
    // number does not remove the sentence that qualifies it.
    el('div', { class: 'muscle-stat' },
      el('span', { class: 'muscle-est mono', text: units.withUnit(Math.round(m.estimate)) }),
      moreDetails
        ? el('span', { class: 'muscle-pct', text: `stronger than ${pct}%` })
        : null,
    ),

    /* ⚠️ WHAT THE BIG NUMBER IS. Tim, 2026-08-31: *"I have no idea what that
     * weight means. Is it for a specific exercise, or the one it's basing its
     * decision off of?"* — and the honest answer is neither of those: it is an
     * estimated one-rep max on the muscle's KEY LIFT, which every contributing
     * exercise was converted into. It is the whole basis of the screen and it
     * has never been named on it.
     *
     * ⚠️ IT SAYS "ESTIMATED" IN THE SAME BREATH AS THE LIFT, which is Rule 5
     * rather than padding: the line directly under it names a real recorded set,
     * and without the word "estimated" here the two would read as the same kind
     * of fact. The 220×3 was measured; the 239 was worked out from it.
     *
     * `m.lift` is `keyLiftFor(muscle)` and is never null on this branch — a
     * muscle with no key lift has no published standards, so it cannot be rated
     * and cannot reach here. Guarded anyway, because "estimated 1-rep max in
     * undefined" is the kind of sentence that ships. */
    el('div', { class: 'muscle-est-note', text: m.lift && m.lift.name
      ? `Estimated 1-rep max in ${m.lift.name}`
      : 'Estimated 1-rep max' }),

    // The near goal, and the only target worth a row of its own.
    m.next
      ? el('div', { class: 'to-next' },
          el('div', { class: 'to-next-bar' },
            el('div', { class: 'to-next-fill', style: `width:${(m.progress * 100).toFixed(1)}%` })),
          el('div', { class: 'to-next-label' },
            `${units.withUnit(Math.ceil(m.toNext))} to ${m.next.name}`),
        )
      : el('div', { class: 'muscle-meta', text: 'Top level reached.' }),

    el('div', { class: 'muscle-meta', text: confidenceLine(m) }),

    /* Rule 5: never let an inference look like a measurement. These name the
     * sets the estimate was converted FROM, which is what lets somebody tell
     * "195 lb bench" from "195 lb inferred off a dumbbell press".
     *
     * ⚠️ ALL THREE SINCE 2026-08-31, NOT JUST THE LEADER. Tim: *"you mentioned
     * how the muscle group estimate is based off your top three recordings based
     * on credibility, but when you click on a muscle it only shows one
     * recording. Could you instead show all 3?"* The panel had been naming
     * `m.best` — which is `contributors[0]` — and saying nothing about the other
     * two, so a number built from three exercises looked like a number built
     * from one. Showing the working is the whole reason this line exists; a
     * third of the working is not the working.
     *
     * ⚠️ IN CREDIBILITY ORDER, WHICH IS THE ORDER THEY ARE WEIGHTED IN, and the
     * first one leads for a reason the reader can now see: `rateMuscle` sorts on
     * `evidenceWeight`, not on which set was heaviest. "and" rather than a
     * bullet, so the three read as one sentence about one number. */
    el('div', { class: 'muscle-sources' },
      (m.contributors && m.contributors.length ? m.contributors : [m.best]).map((c, i) =>
        el('div', { class: 'muscle-meta', text:
          `${i === 0 ? 'from' : 'and'} ${c.exerciseName} ${units.fmtWeight(c.weight)}`
          + (c.loadType === 'per_side' ? '/side' : '')
          + `×${c.reps}, ${fmtDateShort(c.date)}` })),
    ),

    m.basis === 'fallback'
      ? el('div', { class: 'muscle-warn', text:
          'Inferred from the big lifts that also work it — a rough placing.' })
      : null,

    !m.confident
      ? el('div', { class: 'muscle-warn', text:
          `From a ${m.best.reps}-rep set. Benchmark heavier for a firmer placing.` })
      : null,

    // Softer evidence than a ranking against lifters, and it must never be
    // quoted without saying so.
    profile && normalizeCompare(profile.compare).pool === 'everyone'
      ? el('div', { class: 'muscle-warn', text:
          'Compared against adults in general, most of whom do not lift — a rough placing.' })
      : null,

    m.hint ? el('div', { class: 'muscle-meta', text: m.hint }) : null,

    blockedNote(blocked),
  );
}
