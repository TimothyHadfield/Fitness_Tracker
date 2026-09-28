// Auto-guide: the runner showing ONE step at a time (2026-09-27).
//
// Tim: *"I'm also thinking we could make a "auto-guide" button you could press
// which would just show you the single set you should be on and you can change
// the weight and reps, and then just a single button at the bottom that says
// "next ____ (either set or exercise)" and then it will take you to your next
// step. If you are in a group workout, it will automatically do the next set on
// the next person, like I described. It will also take you through warmup sets.
// If you want to change anything, there will be an edit button in the top
// corner and it will take you to the main view, and you can switch between
// views."*
//
// The ORDER is js/guide-steps.js (pure, tested). This file is the screen and
// the handful of hooks it needs from the runner, which owns the draft:
//
//   attachGuide({
//     getState,        () => the live draft object
//     exMap,           exercise id → exercise
//     save,            () => saveDraft(state)
//     switchTo(name),  the runner's own park/unpark of a person
//     syncWalk(i),     the runner's own "everybody moves" for a new exercise
//     renderRunner(),  repaint the normal view (keepScroll, so the open set shows)
//     renderProgress(),optional — repaint the thin workout progress bar
//     finish(),        the runner's Finish → save screen
//     startRest(),     optional — the runner's rest timer (off unless enabled)
//     hide: [nodes],   the normal view's parts to hide while guiding
//     captions,        optional (entry, ex, target, onWarm) => null | { typo, weight, reps }
//                      — the runner's captionParts(): "% of max" / "maybe N to failure"
//     captionData,     optional () => Promise that resolves when the captions' data is in
//     prepare(entry),  optional — the runner's suggested warm-ups for an exercise
//                      about to be opened (syncAutoWarmups), so they are walked
//     lines(entry, i), optional — the pane's own lines: { note, last, targets,
//                      repPlan, opening } nodes and `stretch` words
//     assist(ex, w),   optional — the pane's assisted-lift readout, or null
//     exerciseLabel,   optional — ui.js's name-that-opens-the-picture
//     rememberView(v), optional — 'guide' | 'list' after the toggle is tapped, so
//                      the next new workout opens in it (settings.runnerView)
//   }) → { node, toggle, enter(), exit(), active(), refresh(), placeRest(bar) }
//
// ⚠️ THE DRAFT IS THE ONLY STATE. The step on screen is always written into the
// runner's own fields (`forName`, `index`, `entry.active` / `activeWarm` /
// `activeDrop`) before it is drawn, so Edit shows the same set open, a reload
// resumes on it, and nothing typed can live anywhere but the draft. The view
// itself is `state.view === 'guide'` — a string, dropped with the draft at save.
//
// ⚠️ NO MOTION BETWEEN STEPS. This is the logging path (Rule 7): the button's
// press answers back, and the next step is simply there. The ONE exception is
// the big bar (js/bar-view.js, Tim asked for it): its plates slide on and off
// as the weight changes, including between steps; every word and number is
// already in place before they move.
//
// 🆕 BACK (2026-09-27). Tim: *"Also there's no back button for the auto-guide
// like there should be."* Back goes to the step you were on just before
// (design rule "back goes where you just were"): the screen keeps a TRAIL of
// the steps it showed; with none (just entered, or a reload) it asks
// guide-steps.js `prevStep()`. Going back un-finishes nothing — the numbers
// stay — and Next from there retraces the steps you backed out of (the
// `ahead` list), then carries on as usual. Both lists live only on this
// screen; the draft is still the only state (the step shown is written into
// the runner's own fields by apply(), as always).
//
// 🔄 2026-09-27 REVIEW ("could you analyze the auto-guide system and really
// think if we're missing anything there?"). The guide now shows what the pane
// shows about the exercise — the coach's note, the plan's sentence, "Last
// time", the assisted-lift reading, the picture behind the name — by asking the
// runner for the SAME nodes (never a second wording), walks drops and
// mini-sets one step each, refuses a number the app only guessed (the runner's
// Finished rule), and ignores a second tap on Next that lands in the same
// breath as the first.

//
// 🆕 SWAP, SKIP, + SET, THE CARRY, NAMES ON NEXT, THE SET LIST (2026-09-27).
// Tim's answers in the question box: "Add Swap and Skip" ("Two small buttons
// on the step. Skip leaves the set unrecorded and moves on."), "Carry the
// change", "Name the exercise", "Yes, small + Set button" ("Appears on the
// last set of an exercise."). And: *"Could you also show the weights and reps
// of the past and future sets in this same exercise in the upper left cornour
// small in the auto-guide view, so you have a perspective on the weights and
// whatnot?"* Swap and + Set are the runner's own code (`swap`, `addSet`
// hooks); Skip is guide-steps.js `skipStep()`; the carry is `carryWeight()`,
// shared with the runner's steppers. The set list is one strip across the top
// of the guide — the sets on the left, the three small buttons on the right —
// in the flow, so nothing is ever drawn over the step.
//
//     swap(entryIndex, then) — the runner's Swap sheet; `then` after it landed
//     addSet(entryIndex)     — the runner's Add set (a round in a superset)

import { el, icon, setChildren, toast, stepper, fmtSet } from './ui.js';
import { LOAD_LABEL, loggingNoteFor, bodyWeightFractionFor, plateLoadFor } from './exercises.js';
import { stepsFor, minisOf } from './set-types.js';
import { plateLoad, inventoryFor } from './plates.js';
import * as units from './units.js';
import { barView } from './bar-view.js';
import {
  startStep, nextStep, prevStep, lastStep, peekNext, markDone, stepWords, nextLabel, targetOf,
  walkIndexFor, blockItems, itemDone, sameStep, ensureDrop, skipStep, carryWeight,
} from './guide-steps.js';

/** A second Next inside this many ms of the last is the same tap (a double tap
 * would otherwise finish two sets). Long enough for a bounce, far shorter than
 * anybody takes to read the next step. */
export const NEXT_GUARD_MS = 400;

/** Does this step end a turn (a solo set, the last drop, or the last member of a round)? */
function endsTurn(entries, step) {
  const it = blockItems(entries, step.entryIndex).find((x) => sameStep(x, step));
  return Boolean(it && it.turnEnd);
}

const isDoneSet = (s) => Boolean(s && (s.done || s.locked));

/**
 * How big the number in a box can be and still fit it (2026-09-27 review:
 * "1000" showed as "100" at 38px). By character count, sizes measured in
 * WebKit at 393px (the box is 77px wide there): up to 3 characters at the
 * guide's 38px, 4 at 28px, 5 ("187.5") at 24px, 6 and more ("1102.5") at 20px.
 * The time field keeps the stepper's own `is-long`.
 */
const FITS = ['fit-md', 'fit-sm', 'fit-xs'];
export function boxFit(value) {
  const n = String(value == null ? '' : value).length;
  return n >= 6 ? 'fit-xs' : n === 5 ? 'fit-sm' : n === 4 ? 'fit-md' : '';
}
function fitBox(box) {
  if (!box) return;
  const c = boxFit(box.value);
  for (const k of FITS) box.classList.toggle(k, c === k);
  // A narrower phone (the box is 60px at 360) still clips; step down a pixel
  // at a time until the number fits. Only where there is layout to measure.
  box.style.fontSize = '';
  if (!(box.clientWidth > 0) || typeof getComputedStyle !== 'function') return;
  let f = parseFloat(getComputedStyle(box).fontSize) || 0;
  while (box.scrollWidth > box.clientWidth && f > 14) {
    f -= 1;
    box.style.fontSize = `${f}px`;
  }
}

/**
 * The first time you ever do an exercise, opening set 2 fills it from the set
 * above with a number in it — the runner's `fillOnOpen()` (Tim, 2026-08-24),
 * applied when the GUIDE opens a set, since the runner's copy is a closure of
 * its pane. Same three conditions: no history, an empty (or app-worked-out)
 * set, a real set above to copy. Never a Finished set (Back onto one).
 */
export function fillFromAbove(entry, i) {
  if (!entry || entry.hadHistory || i <= 0 || i >= (entry.sets || []).length) return false;
  const fields = entry.fields || [];
  const s = entry.sets[i];
  if (isDoneSet(s)) return false;
  if (!s.prefilled && fields.some((f) => Number(s[f]) > 0)) return false;
  if (Array.isArray(s.minis) && s.minis.length) return false;
  for (let j = i - 1; j >= 0; j--) {
    const src = entry.sets[j];
    if (!src.prefilled && fields.some((f) => Number(src[f]) > 0)) {
      const picked = {};
      for (const f of fields) picked[f] = typeof src[f] === 'number' ? src[f] : 0;
      entry.sets[i] = { ...s, ...picked };
      delete entry.sets[i].prefilled;
      return true;
    }
  }
  return false;
}

export function attachGuide(ctx) {
  const S = () => ctx.getState();
  let cur = null;

  const where = el('div', { class: 'guide-where' });
  // The name — the button that opens its picture, where there is one.
  const exName = el('div', { class: 'guide-name' });
  // Everything the pane says about the exercise, in one slot that scrolls on
  // its own when a step has more lines than the screen has room for: the
  // steppers and Next never leave the screen.
  const exNote = el('div', { class: 'guide-note' });
  // `.steppers` only while the guide is showing: the runner keeps exactly one
  // set of controls on screen, and a hidden empty copy would be a second.
  const steps = el('div', { class: 'guide-steppers' });
  const assistLine = el('div', { class: 'assist-readout guide-assist', hidden: true });
  // The whole bar, big (Tim, 2026-09-27) — kept across steps so plates move.
  const bar = barView();
  const body = el('div', { class: 'guide-body' }, where, exName, exNote, bar.node, steps, assistLine);
  const nextBtn = el('button', { class: 'btn primary lg guide-next', type: 'button', onClick: () => advance() });
  // Always in the footer, disabled when there is nothing before: it never
  // appears or vanishes, so Next never changes width under a thumb.
  const backBtn = el('button', {
    class: 'btn lg guide-back', type: 'button', 'aria-label': 'Back to the step before', onClick: () => back(),
  }, icon('left'), 'Back');
  const foot = el('div', { class: 'session-footer guide-footer' }, backBtn, nextBtn);
  let trail = [];   // the steps shown before this one, oldest first
  let ahead = [];   // the steps backed out of, nearest last
  let lastNext = -Infinity;   // when Next last moved the guide on
  let restNode = null;        // the runner's rest bar, if it is on
  // The strip across the top: this exercise's sets (left), and Swap / Skip /
  // + Set (right). + Set keeps its slot when it is not offered (`is-idle`,
  // visibility only), so nothing beside it moves when it comes and goes.
  const setsList = el('div', { class: 'guide-sets', role: 'list', 'aria-label': 'Sets of this exercise' });
  const pill = (cls, label, aria, onClick, glyph) => el('button', {
    class: `swap-btn pill-action guide-act ${cls}`, type: 'button', 'aria-label': aria, onClick,
  }, glyph ? icon(glyph, 15) : null, label);
  const addBtn = pill('guide-addset', 'Set', 'Add one more set', () => addOne(), 'plus');
  const swapBtn = pill('guide-swap', 'Swap', 'Swap this exercise — machine taken', () => swapNow(), 'swap');
  const skipBtn = pill('guide-skip', 'Skip', 'Skip this set — leave it unrecorded', () => advance({ skip: true }));
  const top = el('div', { class: 'guide-top' }, setsList, el('div', { class: 'guide-acts' }, addBtn, swapBtn, skipBtn));
  const node = el('div', { class: 'guide', hidden: true }, top, el('div', { class: 'guide-scroll' }, body), foot);

  const toggle = el('button', {
    class: 'btn small topbar-btn guide-toggle', type: 'button',
    onClick: () => {
      if (active()) exit(); else enter();
      // 🆕 2026-09-27 (overhaul ST-15): the next workout opens in this view.
      if (typeof ctx.rememberView === 'function') ctx.rememberView(active() ? 'guide' : 'list');
    },
  });

  function active() { return S().view === 'guide'; }

  /** A number still in a box is committed first (iOS keeps focus on the tapped button). */
  function commitTyping(scope) {
    const t = typeof document !== 'undefined' ? document.activeElement : null;
    if (t && t.tagName === 'INPUT' && (!scope || scope.contains(t))) t.blur();
  }

  /**
   * Point the runner's own fields at `step`, switching person if needed.
   * `forward` (every move but Back): an exercise about to be opened gets its
   * suggested warm-ups first (the runner's rule, `ctx.prepare`), and a working
   * set with warm-ups still to do opens on the first of them instead.
   */
  function apply(step, { forward = true } = {}) {
    const state = S();
    const before = cur;
    if ((step.name == null ? null : step.name) !== (state.forName == null ? null : state.forName)) {
      ctx.switchTo(step.name);
    }
    const st = S();
    const e = st.entries[step.entryIndex];
    if (e && forward && ctx.prepare) ctx.prepare(e);
    if (e && forward && step.kind === 'set' && e.group == null && !(e.sets || []).some(isDoneSet)) {
      const w = (Array.isArray(e.warmups) ? e.warmups : []).findIndex((x) => !x.done && !x.skipped);
      if (w >= 0) step = { name: step.name, entryIndex: step.entryIndex, kind: 'warm', index: w };
    }
    const i = walkIndexFor(st.entries, step);
    if (i >= 0) {
      st.index = i;
      // A new exercise moves everybody, as the runner's Next exercise does.
      const beforeEx = before && before.exerciseId;
      if (ctx.syncWalk && e && beforeEx !== e.exerciseId) ctx.syncWalk(i);
    }
    if (e) {
      if (step.kind === 'warm') {
        e.activeWarm = step.index;
        e.activeDrop = null;
      } else {
        if (step.kind === 'set') fillFromAbove(e, step.index);
        e.active = step.index;
        e.activeWarm = null;
        // A drop is the runner's own `minis` row, made the way its "Strip the
        // weight" button makes one if it is not there yet.
        e.activeDrop = step.kind === 'drop' && ensureDrop(e, step.index, step.mini) ? step.mini : null;
      }
      e.editing = true;
    }
    cur = { ...step, exerciseId: e ? e.exerciseId : null };
    ctx.save();
    if (ctx.renderProgress) ctx.renderProgress();
  }

  function paint() {
    const state = S();
    if (!cur) {
      setChildren(where, '');
      setChildren(exName, el('h2', { class: 'guide-ex', text: 'Nothing left to do' }));
      setChildren(exNote);
      exNote.hidden = true;
      setChildren(steps);
      assistLine.hidden = true;
      bar.update(null);
      setLabel(null);
      setBack();
      paintTop();
      return;
    }
    const entry = state.entries[cur.entryIndex];
    const ex = ctx.exMap.get(entry.exerciseId);
    const words = stepWords(state, cur);
    const onWarm = cur.kind === 'warm';
    setChildren(where,
      words.who ? el('b', { class: 'guide-who', text: words.who }) : null,
      words.who ? el('span', { class: 'guide-dot', text: '·' }) : null,
      el('span', { class: onWarm ? 'guide-set is-warm' : 'guide-set', text: words.set }));
    setChildren(exName, ctx.exerciseLabel
      ? ctx.exerciseLabel({ exercise: ex, name: words.exerciseName, tag: 'h2', className: 'guide-ex' })
      : el('h2', { class: 'guide-ex', text: words.exerciseName }));

    // The pane's lines, as the pane builds them. The general warm-up goes on
    // the first warm-up only — it is what you do before it.
    const how = ex ? loggingNoteFor(ex) : null;
    const lines = ctx.lines ? ctx.lines(entry, cur.entryIndex) : {};
    // 🆕 2026-09-27 (wave 4 visual QA): on the LATER warm-ups the line is
    // still there, invisible, so the bar and steppers do not jump ~15px when
    // Skip or Finish moves on (Tim: "nothing moves when you tap").
    const stretch = onWarm && lines.stretch
      ? el('div', cur.index === 0
        ? { class: 'session-ex-meta warm-general', text: lines.stretch }
        : { class: 'session-ex-meta warm-general', text: ' ', 'aria-hidden': 'true' })
      : null;
    const noteNodes = [
      how ? el('div', { class: 'guide-how', text: how }) : null,
      lines.note, stretch, lines.targets, lines.repPlan, lines.last, lines.opening,
    ].filter(Boolean);
    setChildren(exNote, ...noteNodes);
    exNote.hidden = !noteNodes.length;
    exNote.scrollTop = 0;

    const target = targetOf(state, cur);
    const ownerSet = onWarm ? null : entry.sets[cur.index];
    const assistSpec = ex ? bodyWeightFractionFor(ex) : null;
    const typoAt = (lbs) => {
      const c = ctx.captions ? ctx.captions(entry, ex, { ...target, weight: lbs }, onWarm) : null;
      return Boolean(c && c.typo);
    };
    // The big bar, from the same rule the stepper's small drawing used
    // (plateLoadFor: which lifts have plates, bar or peg) — null hides it.
    // Hidden too while the number is one the typo warning questions: the
    // runner hides its plate hint then, and a wall of plates is no answer.
    const loading = ex && (entry.fields || []).includes('weight') ? plateLoadFor(ex) : null;
    const drawBar = (lbs) => bar.update(loading && !typoAt(lbs)
      ? plateLoad(lbs, { inventory: inventoryFor(units.units()), bar: loading.bar, points: loading.points })
      : null);
    drawBar(Number(target.weight) || 0);
    const paintAssist = (w) => {
      const words2 = ctx.assist ? ctx.assist(ex, w) : null;
      setChildren(assistLine, words2);
      assistLine.hidden = !words2;
    };
    paintAssist(Number(target.weight) || 0);
    // The runner's own two captions — "% of your estimated max" and "maybe 8
    // to failure" (2026-09-27, Tim: "the % of 1RM and estimated number of reps
    // should also be shown in the auto-guide"). Same function as the pane's,
    // so the two views never disagree about one set; a weight change moves both.
    const caps = {};
    const fitted = [];   // the number boxes sized to their number (not time)
    const paintCaps = () => {
      const c = ctx.captions ? ctx.captions(entry, ex, target, onWarm) : null;
      for (const f of ['weight', 'reps']) if (caps[f]) setChildren(caps[f], c ? c[f] : '');
    };
    const nodes = (entry.fields || []).map((f) => {
      const cap = (f === 'weight' || f === 'reps') && ctx.captions && ctx.captions(entry, ex, target, onWarm)
        ? el('div', { class: 'step-est' }) : null;
      if (cap) caps[f] = cap;
      let box = null;
      const s = stepper({
        field: f,
        value: target[f],
        exercise: ex,
        // The big bar above is the drawing here; a second, small one would repeat it.
        plates: false,
        suffix: f === 'weight' && entry.loadType
          ? (assistSpec && assistSpec.assist ? 'assistance' : assistSpec ? 'added' : LOAD_LABEL[entry.loadType])
          : null,
        onChange: (v) => {
          target[f] = v;
          delete target.prefilled;
          // Typing into a step Skip passed over makes it real again.
          delete target.skipped;
          if (onWarm) delete target.auto;
          else {
            // A drop's number makes its SET real, as in the runner.
            delete ownerSet.prefilled;
            delete ownerSet.skipped;
            ownerSet.touched = true;
          }
          // "Carry the change" — the runner's rule (`carryWeight`).
          if (f === 'weight' && cur.kind === 'set') carryWeight(entry, cur.index);
          ctx.save();
          paintSets();
          paintCaps();
          if (f === 'weight') { drawBar(v); paintAssist(v); }
          if (f !== 'time') fitBox(box);
          setBack();
        },
      });
      if (cap) s.node.insertBefore(cap, s.node.querySelector('.stepper-controls'));
      box = s.node.querySelector('.step-value');
      if (f !== 'time' && box) {
        fitted.push(box);
        box.addEventListener('input', () => fitBox(box));
      }
      // The bar follows the number while it is being typed, not only when the
      // box is left (the stepper commits on blur, as it always has).
      if (f === 'weight' && loading && box) {
        box.addEventListener('input', () => {
          const typed = parseFloat(box.value);
          if (Number.isFinite(typed) && typed >= 0) drawBar(units.fromDisplay(typed));
        });
      }
      return s.node;
    });
    setChildren(steps, ...nodes);
    // Measured once they are on the page (the step-down needs a width).
    for (const b of fitted) fitBox(b);
    paintCaps();
    // The person's ratings and own sets load lazily; paint again when they
    // land, if this step is still the one on screen.
    if (ctx.captionData && (caps.weight || caps.reps)) {
      const shown = cur;
      ctx.captionData().then(() => {
        const live = caps.weight || caps.reps;
        if (cur === shown && live && live.isConnected) {
          paintCaps();
          drawBar(Number(target.weight) || 0);
        }
      }).catch(() => {});
    }
    setLabel(nextLabel(state, cur, aheadStep() || peekNext(state, cur)));
    setBack();
    paintTop();
  }

  /**
   * The corner list: every set of the exercise on screen, for the person on
   * screen — the runner's own rows in miniature (W for a warm-up, ↳ for a
   * drop, `fmtSet()` for the numbers, so units, "/side" and time read the
   * same). Done ✓, the current one marked, the rest quieter; a skipped one is
   * struck through. Repainted on every change, so a carry shows at once.
   */
  function paintSets() {
    const entry = cur ? S().entries[cur.entryIndex] : null;
    if (!entry) { setChildren(setsList); setsList.hidden = true; return; }
    setsList.hidden = false;
    const fields = entry.fields || [];
    const row = (num, set, mods, done) => el('div', { class: `gs-row${mods}`, role: 'listitem' },
      el('span', { class: 'gs-num', text: num }),
      el('span', { class: 'gs-vals', text: fmtSet(set, fields, entry.loadType) }),
      done ? el('span', { class: 'gs-tick', text: '✓' }) : null);
    const mods = (isNow, done, skipped) => (isNow ? ' is-now' : '') + (done ? ' is-done' : '') + (skipped ? ' is-skip' : '');
    const rows = [];
    // Warm-ups only where the runner lists them (solo lifts, never a superset).
    if (entry.group == null) {
      (Array.isArray(entry.warmups) ? entry.warmups : []).forEach((w, k) => {
        rows.push(row('W', w, ' is-warm' + mods(cur.kind === 'warm' && cur.index === k, w.done, w.skipped), Boolean(w.done)));
      });
    }
    (entry.sets || []).forEach((s, i) => {
      const done = isDoneSet(s);
      rows.push(row(String(i + 1), s, mods(cur.kind === 'set' && cur.index === i, done, s.skipped && !done), done));
      minisOf(s).forEach((m, j) => {
        const here = cur.kind === 'drop' && cur.index === i && cur.mini === j;
        rows.push(row('↳', m, ' is-drop' + mods(here, done, m.skipped), false));
      });
    });
    setChildren(setsList, ...rows);
    // Keep the current row in view when the list scrolls inside itself: two
    // rows above it where there are, and whole rows only (never half a line).
    const at = rows.findIndex((r) => r.classList.contains('is-now'));
    if (at >= 0 && setsList.scrollHeight > setsList.clientHeight) {
      const h = rows[0].offsetHeight || 16;
      const fits = Math.max(1, Math.round(setsList.clientHeight / h));
      const first = Math.max(0, Math.min(at - 2, rows.length - fits));
      setsList.scrollTop = rows[first].offsetTop;
    }
  }

  /** The strip: the list, and which of Swap / Skip / + Set apply here. */
  function paintTop() {
    paintSets();
    const entry = cur ? S().entries[cur.entryIndex] : null;
    const idle = (b, off) => {
      b.classList.toggle('is-idle', off);
      b.disabled = off;
      b.setAttribute('aria-hidden', off ? 'true' : 'false');
    };
    idle(swapBtn, !entry || !ctx.swap);
    idle(skipBtn, !entry);
    // + Set: on the last working set only (the last round in a superset) —
    // never on a warm-up or a drop.
    const group = entry && entry.group != null;
    const mine = group ? blockItems(S().entries, cur.entryIndex).find((x) => x.entryIndex === cur.entryIndex) : null;
    const rounds = mine ? mine.rounds : 0;
    const last = Boolean(entry && cur.kind === 'set' && ctx.addSet)
      && (group ? cur.index === rounds - 1 : cur.index === (entry.sets || []).length - 1);
    setChildren(addBtn, icon('plus', 15), group ? 'Round' : 'Set');
    addBtn.setAttribute('aria-label', group ? 'Add one more round' : 'Add one more set');
    idle(addBtn, !last);
  }

  /** + Set: the runner's own Add set; the next Next goes to it. */
  function addOne() {
    if (!cur || !ctx.addSet) return;
    commitTyping(node);
    ctx.addSet(cur.entryIndex);
    ctx.save();
    if (ctx.renderProgress) ctx.renderProgress();
    paint();
  }

  /** Swap: the runner's own sheet; afterwards, the new exercise's first unfinished step. */
  function swapNow() {
    if (!cur || !ctx.swap) return;
    commitTyping(node);
    ctx.swap(cur.entryIndex, () => { if (active()) refresh(); });
  }

  /** The step Next would retrace to after a Back, if it is still there. */
  function aheadStep() {
    while (ahead.length && !targetOf(S(), ahead[ahead.length - 1])) ahead.pop();
    return ahead.length ? ahead[ahead.length - 1] : null;
  }

  /** Where Back would go: the trail, else guide order — and from "Nothing
   * left to do", the last step anybody finished. */
  function backTarget() {
    for (let i = trail.length - 1; i >= 0; i--) if (targetOf(S(), trail[i])) return { step: trail[i], at: i };
    const p = cur ? prevStep(S(), cur) : lastStep(S());
    return p ? { step: p, at: -1 } : null;
  }

  function setBack() {
    const can = Boolean(backTarget());
    backBtn.disabled = !can;
    backBtn.setAttribute('aria-disabled', can ? 'false' : 'true');
  }

  function back() {
    commitTyping(node);
    const to = backTarget();
    if (!to) return;
    trail = to.at >= 0 ? trail.slice(0, to.at) : [];
    if (cur) ahead.push(cur);
    apply(to.step, { forward: false });
    paint();
  }

  function setLabel(label) {
    const finishing = label === 'Finish workout' || label === null;
    nextBtn.className = 'btn lg guide-next ' + (finishing ? 'good' : 'primary');
    // The words in their own span, so a long exercise name ellipsises on one
    // line ("Next: Chest-Supported Dumbbell R…") and the arrow stays.
    setChildren(nextBtn, finishing ? icon('check') : null,
      el('span', { class: 'guide-next-label', text: label || 'Finish workout' }), finishing ? null : icon('right'));
    nextBtn.title = label || 'Finish workout';
  }

  /**
   * Next — or, with `skip`, Skip: the step is left unrecorded (`skipStep`)
   * instead of finished, no number is needed, and no rest starts; everything
   * after that is exactly Next's (the trail, the retrace, the order).
   */
  function advance({ skip = false } = {}) {
    // One tap, one step: a second Next in the same breath is ignored.
    if (Date.now() - lastNext < NEXT_GUARD_MS) return;
    commitTyping(node);
    const state = S();
    if (!cur) { if (!skip) ctx.finish(); return; }
    // Rest starts the FIRST time a step is finished — not again when Back →
    // Next walks over it.
    const firstTime = !skip && !itemDone(state.entries, cur);
    if (skip ? !skipStep(state, cur) : !markDone(state, cur)) {
      if (!skip) toast('Put in a number first');
      return;
    }
    lastNext = Date.now();
    const done = cur;
    // After a Back, Next retraces the steps backed out of before walking on.
    const retrace = aheadStep();
    if (retrace) ahead.pop();
    const next = retrace || nextStep(state, done);
    if (next) trail.push(done);
    // Rest after a turn — never mid-superset, never between a set and its
    // drops, never after a warm-up.
    if (ctx.startRest && firstTime && done.kind !== 'warm' && endsTurn(state.entries, done)) ctx.startRest();
    ctx.save();
    if (!next) { paint(); ctx.finish(); return; }
    apply(next);
    paint();
  }

  /** While guiding, the rest bar sits above Back / Next; in the normal view,
   * back in its own place, right after this screen. */
  function seatRest(on) {
    if (!restNode) return;
    if (on) node.insertBefore(restNode, foot);
    else if (node.parentNode) node.parentNode.insertBefore(restNode, node.nextSibling);
  }

  function placeRest(restBar) {
    restNode = restBar || null;
    seatRest(active());
  }

  function show(on) {
    node.hidden = !on;
    steps.classList.toggle('steppers', on);
    if (!on) setChildren(steps);
    for (const n of ctx.hide || []) if (n) n.hidden = on;
    seatRest(on);
    toggle.textContent = on ? 'Edit' : 'Auto-guide';
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.setAttribute('aria-label', on ? 'Edit — back to the full workout' : 'Auto-guide — one set at a time');
  }

  function enter() {
    commitTyping();
    const state = S();
    state.view = 'guide';
    const step = startStep(state);
    cur = null;
    trail = []; ahead = [];
    if (step) apply(step); else ctx.save();
    show(true);
    paint();
  }

  function exit() {
    commitTyping(node);
    const state = S();
    delete state.view;
    ctx.save();
    show(false);
    ctx.renderRunner();
  }

  /** Repaint from the draft (a reload, or the runner changed something). */
  function refresh() {
    if (!active()) { show(false); return; }
    const state = S();
    const step = startStep(state);
    cur = null;
    trail = []; ahead = [];
    if (step) apply(step);
    show(true);
    paint();
  }

  // Open in whichever view the draft was left in.
  refresh();
  return { node, toggle, enter, exit, active, refresh, placeRest, get step() { return cur; } };
}

/** Exported for tests: the walk the runner uses, so a test can read `index`. */
export const walkOf = (entries) => stepsFor(entries.map((e) => ({ sets: (e.sets || []).length, group: e.group })));
