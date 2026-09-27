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
//     finish(),        the runner's Finish → save screen
//     startRest(),     optional — the runner's rest timer (off unless enabled)
//     hide: [nodes],   the normal view's parts to hide while guiding
//     estimatedMax,    optional (entry, ex) => total-load 1RM or 0 — for "typo?"
//     typoRatio,       optional — the runner's TYPO_WARN_RATIO
//   }) → { node, toggle, enter(), exit(), active() }
//
// ⚠️ THE DRAFT IS THE ONLY STATE. The step on screen is always written into the
// runner's own fields (`forName`, `index`, `entry.active` / `activeWarm`) before
// it is drawn, so Edit shows the same set open, a reload resumes on it, and
// nothing typed can live anywhere but the draft. The view itself is
// `state.view === 'guide'` — a string, dropped with the draft at save.
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

import { el, icon, setChildren, toast, stepper } from './ui.js';
import { LOAD_LABEL, loggingNoteFor, bodyWeightFractionFor, plateLoadFor } from './exercises.js';
import { stepsFor } from './set-types.js';
import { plateLoad, inventoryFor } from './plates.js';
import * as units from './units.js';
import { barView } from './bar-view.js';
import {
  startStep, nextStep, prevStep, peekNext, markDone, stepWords, nextLabel, targetOf, walkIndexFor, blockItems,
} from './guide-steps.js';

/** Does this step end a turn (a solo set, or the last member of a round)? */
function endsTurn(entries, step) {
  const it = blockItems(entries, step.entryIndex)
    .find((x) => x.entryIndex === step.entryIndex && x.kind === step.kind && x.index === step.index);
  return Boolean(it && it.turnEnd);
}

/**
 * The first time you ever do an exercise, opening set 2 fills it from the set
 * above with a number in it — the runner's `fillOnOpen()` (Tim, 2026-08-24),
 * applied when the GUIDE opens a set, since the runner's copy is a closure of
 * its pane. Same three conditions: no history, an empty (or app-worked-out)
 * set, a real set above to copy.
 */
export function fillFromAbove(entry, i) {
  if (!entry || entry.hadHistory || i <= 0 || i >= (entry.sets || []).length) return false;
  const fields = entry.fields || [];
  const s = entry.sets[i];
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
  const exName = el('h2', { class: 'guide-ex' });
  const exNote = el('div', { class: 'guide-note' });
  // `.steppers` only while the guide is showing: the runner keeps exactly one
  // set of controls on screen, and a hidden empty copy would be a second.
  const steps = el('div', { class: 'guide-steppers' });
  // The whole bar, big (Tim, 2026-09-27) — kept across steps so plates move.
  const bar = barView();
  const body = el('div', { class: 'guide-body' }, where, exName, exNote, bar.node, steps);
  const nextBtn = el('button', { class: 'btn primary lg guide-next', type: 'button', onClick: () => advance() });
  // Always in the footer, disabled when there is nothing before: it never
  // appears or vanishes, so Next never changes width under a thumb.
  const backBtn = el('button', {
    class: 'btn lg guide-back', type: 'button', 'aria-label': 'Back to the step before', onClick: () => back(),
  }, icon('left'), 'Back');
  const foot = el('div', { class: 'session-footer guide-footer' }, backBtn, nextBtn);
  let trail = [];   // the steps shown before this one, oldest first
  let ahead = [];   // the steps backed out of, nearest last
  const node = el('div', { class: 'guide', hidden: true }, el('div', { class: 'guide-scroll' }, body), foot);

  const toggle = el('button', {
    class: 'btn small topbar-btn guide-toggle', type: 'button',
    onClick: () => (active() ? exit() : enter()),
  });

  function active() { return S().view === 'guide'; }

  /** A number still in a box is committed first (iOS keeps focus on the tapped button). */
  function commitTyping(scope) {
    const t = typeof document !== 'undefined' ? document.activeElement : null;
    if (t && t.tagName === 'INPUT' && (!scope || scope.contains(t))) t.blur();
  }

  /** Point the runner's own fields at `step`, switching person if needed. */
  function apply(step) {
    const state = S();
    const before = cur;
    if ((step.name == null ? null : step.name) !== (state.forName == null ? null : state.forName)) {
      ctx.switchTo(step.name);
    }
    const st = S();
    const i = walkIndexFor(st.entries, step);
    if (i >= 0) {
      st.index = i;
      // A new exercise moves everybody, as the runner's Next exercise does.
      const beforeEx = before && before.exerciseId;
      const e0 = st.entries[step.entryIndex];
      if (ctx.syncWalk && e0 && beforeEx !== e0.exerciseId) ctx.syncWalk(i);
    }
    const e = st.entries[step.entryIndex];
    if (e) {
      if (step.kind === 'warm') {
        e.activeWarm = step.index;
      } else {
        fillFromAbove(e, step.index);
        e.active = step.index;
        e.activeWarm = null;
      }
      e.activeDrop = null;
      e.editing = true;
    }
    cur = { ...step, exerciseId: e ? e.exerciseId : null };
    ctx.save();
  }

  function paint() {
    const state = S();
    if (!cur) {
      setChildren(where, '');
      exName.textContent = 'Nothing left to do';
      exNote.textContent = '';
      setChildren(steps);
      bar.update(null);
      setLabel(null);
      setBack();
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
    exName.textContent = words.exerciseName;
    const note = ex ? loggingNoteFor(ex) : null;
    exNote.textContent = note || '';
    exNote.hidden = !note;

    const target = targetOf(state, cur);
    const assistSpec = ex ? bodyWeightFractionFor(ex) : null;
    // The big bar, from the same rule the stepper's small drawing used
    // (plateLoadFor: which lifts have plates, bar or peg) — null hides it.
    const loading = ex && (entry.fields || []).includes('weight') ? plateLoadFor(ex) : null;
    const drawBar = (lbs) => bar.update(loading
      ? plateLoad(lbs, { inventory: inventoryFor(units.units()), bar: loading.bar, points: loading.points })
      : null);
    drawBar(Number(target.weight) || 0);
    const nodes = (entry.fields || []).map((f) => {
      const cap = f === 'weight' && !onWarm && ctx.estimatedMax ? el('div', { class: 'step-est' }) : null;
      const paintCap = () => {
        if (!cap) return;
        const max = Number(ctx.estimatedMax(entry, ex)) || 0;
        const w = Number(target.weight) || 0;
        const load = entry.loadType === 'per_side' ? w * 2 : w;
        const typo = !assistSpec && max > 0 && load >= max * (ctx.typoRatio || 1.5);
        setChildren(cap, typo
          ? el('span', { class: 'typo-warn' }, el('b', { text: `${(load / max).toFixed(1)}×` }), ' your estimated max — typo?')
          : '');
      };
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
          if (onWarm) delete target.auto;
          else target.touched = true;
          ctx.save();
          paintCap();
          if (f === 'weight') drawBar(v);
          setBack();
        },
      });
      if (cap) {
        s.node.insertBefore(cap, s.node.querySelector('.stepper-controls'));
        paintCap();
      }
      // The bar follows the number while it is being typed, not only when the
      // box is left (the stepper commits on blur, as it always has).
      if (f === 'weight' && loading) {
        const box = s.node.querySelector('.step-value');
        if (box) box.addEventListener('input', () => {
          const typed = parseFloat(box.value);
          if (Number.isFinite(typed) && typed >= 0) drawBar(units.fromDisplay(typed));
        });
      }
      return s.node;
    });
    setChildren(steps, ...nodes);
    setLabel(nextLabel(state, cur, aheadStep() || peekNext(state, cur)));
    setBack();
  }

  /** The step Next would retrace to after a Back, if it is still there. */
  function aheadStep() {
    while (ahead.length && !targetOf(S(), ahead[ahead.length - 1])) ahead.pop();
    return ahead.length ? ahead[ahead.length - 1] : null;
  }

  /** Where Back would go: the trail, else guide order. */
  function backTarget() {
    if (!cur) return null;
    for (let i = trail.length - 1; i >= 0; i--) if (targetOf(S(), trail[i])) return { step: trail[i], at: i };
    const p = prevStep(S(), cur);
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
    ahead.push(cur);
    apply(to.step);
    paint();
  }

  function setLabel(label) {
    const finishing = label === 'Finish workout' || label === null;
    nextBtn.className = 'btn lg guide-next ' + (finishing ? 'good' : 'primary');
    setChildren(nextBtn, finishing ? icon('check') : null, label || 'Finish workout', finishing ? null : icon('right'));
  }

  function advance() {
    commitTyping(node);
    const state = S();
    if (!cur) { ctx.finish(); return; }
    if (!markDone(state, cur)) { toast('Put in a number first'); return; }
    const done = cur;
    // After a Back, Next retraces the steps backed out of before walking on.
    const retrace = aheadStep();
    if (retrace) ahead.pop();
    const next = retrace || nextStep(state, done);
    if (next) trail.push(done);
    // Rest after a set that ends a turn — never mid-superset, never a warm-up.
    if (ctx.startRest && done.kind === 'set' && endsTurn(state.entries, done)) ctx.startRest();
    ctx.save();
    if (!next) { paint(); ctx.finish(); return; }
    apply(next);
    paint();
  }

  function show(on) {
    node.hidden = !on;
    steps.classList.toggle('steppers', on);
    if (!on) setChildren(steps);
    for (const n of ctx.hide || []) if (n) n.hidden = on;
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
  return { node, toggle, enter, exit, active, refresh, get step() { return cur; } };
}

/** Exported for tests: the walk the runner uses, so a test can read `index`. */
export const walkOf = (entries) => stepsFor(entries.map((e) => ({ sets: (e.sets || []).length, group: e.group })));
