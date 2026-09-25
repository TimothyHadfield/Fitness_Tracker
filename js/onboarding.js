// The first-run questions → a program. docs/onboarding-plan.md part A.
//
// Tim, 2026-09-25: *"a guided system for users as soon as they log in that's
// question/multiple choice based so that the cite gives them the opportunity to
// automatically guide them into everything and will set the user up with
// everything they need. For now, this will just be giving them a workout they
// need."*
//
// Six screens, one question each, one tap each (focus is the one multi-select
// and has Next), then a short "Building your program" moment and the result.
// `openOnboarding({ onDone })` is the whole public surface for the screen; the
// Settings row ("Find me a program") and the first-run hook in app.js both call
// it. `onDone` runs once, after Start or Skip — the tour starts from there.
//
// ⚠️ SCREENS SLIDE SIDEWAYS HERE, which Rule 7 forbids for ROUTES and allows
// here: a route cannot know which way you went, a numbered sequence does. Next
// comes in from the right, Back from the left. Reduced motion makes it instant
// (the stylesheet's blanket), and the old screen is removed on a timer as well
// as on `animationend`, so a skipped animation can never strand it.

import { el, iconBtn, toast, refreshRoute } from './ui.js';
import { store, demo, auth } from './store.js';
import { buildProgram, matchingPresets } from './program-builder.js';
import { springTransform } from './spring.js';
import { motionAllowed } from './motion.js';
import { expandRepSpec } from './set-reps.js';

export const ONBOARDED_KEY = 'ftrack:v1:onboarded';

const SLIDE_MS = 240;  // = --t-slow
const BUILD_MS = 550;  // the "Building your program" moment; brief caps it at 600

const QUESTIONS = [
  { key: 'goal', q: 'What’s your main goal?', choices: [
    ['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['both', 'Both'], ['general', 'General fitness'],
  ] },
  { key: 'experience', q: 'How long have you been lifting?', choices: [
    ['new', 'New to lifting'], ['under1', 'Under 1 year'], ['1to3', '1–3 years'], ['3plus', '3+ years'],
  ] },
  { key: 'days', q: 'How many days a week can you train?', choices: [
    [2, '2 days'], [3, '3 days'], [4, '4 days'], [5, '5 days'], [6, '6 days'],
  ] },
  { key: 'minutes', q: 'How long is each workout?', choices: [
    [30, '30 min'], [45, '45 min'], [60, '60 min'], [75, '75+ min'],
  ] },
  { key: 'equipment', q: 'What equipment do you have?', choices: [
    ['gym', 'Full gym'], ['dumbbells', 'Dumbbells only'], ['barbell', 'Barbell + rack at home'], ['bodyweight', 'Bodyweight only'],
  ] },
  { key: 'focus', q: 'Anything to focus on?', sub: 'Pick up to two.', multi: true, max: 2, choices: [
    ['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'],
    ['legs', 'Legs'], ['glutes', 'Glutes'], ['core', 'Core'], ['none', 'None'],
  ] },
];

/* ------------------------------------------------------------------ *
 * The first-run gate
 * ------------------------------------------------------------------ */

const HOME_HASHES = ['', '#', '#/', '#/home'];

/**
 * Should a brand-new account see the questions now?
 *
 * 🚨 ONLY WHEN THE EMPTY ANSWER IS AUTHORITATIVE. "No sessions, no programs"
 * read from this device after the cloud FAILED is not a new account — it is
 * Tim on a new phone with no signal. So the store must be really connected
 * (`mode: 'cloud'`), or deliberately local-only (never the case in production).
 * That is also what keeps every test harness that boots on an empty store
 * free of the overlay: under node the Firebase SDK cannot load, the store falls
 * back with `degraded: true`, and this answers no.
 *
 * Never in the demo, never twice (this device's flag, or the account's
 * `onboardedAt` from another device), never over a deep link somebody followed
 * in (an invite, an add-friend code, sign in) — only on Home. Any read that
 * throws means no: the questions are never shown on a guess.
 *
 * `deps` exists for tests; the app calls it with nothing.
 */
export async function shouldOnboard(deps = {}) {
  const d = {
    demoActive: () => demo.active(),
    authState: () => auth.state(),
    getSettings: () => store.getSettings(),
    getSessions: () => store.getSessions(),
    getSystems: () => store.getSystems(),
    getWorkouts: () => store.getWorkouts(),
    hash: () => (typeof location !== 'undefined' ? location.hash : ''),
    ...deps,
  };
  const onHome = () => HOME_HASHES.includes(typeof d.hash === 'function' ? d.hash() : d.hash || '');
  try {
    if (d.demoActive()) return false;
    if (seenHere()) return false;
    if (!onHome()) return false;
    const st = await d.authState();
    const authoritative = Boolean(st) && (st.mode === 'cloud' || (st.mode === 'local' && !st.degraded));
    if (!authoritative) return false;
    const [settings, sessions, systems, workouts] = await Promise.all([
      d.getSettings(), d.getSessions(), d.getSystems(), d.getWorkouts(),
    ]);
    if (settings && settings.onboardedAt) return false;
    if ((sessions || []).length || (systems || []).length || (workouts || []).length) return false;
    // Checked again: the reads above take a moment on the cloud, and somebody
    // who has already tapped away from Home is not to be pulled back.
    return onHome() && !seenHere();
  } catch (_) {
    return false;
  }
}

function seenHere() {
  try { return Boolean(localStorage.getItem(ONBOARDED_KEY)); } catch (_) { return true; }
}

// Marked the moment it is SHOWN (not finished), so a reload halfway through
// never shows it again. The account copy stops a second device showing it.
function markSeen() {
  const now = new Date().toISOString();
  try { localStorage.setItem(ONBOARDED_KEY, now); } catch (_) { /* private mode */ }
  if (!demo.active()) store.saveSettings({ onboardedAt: now }).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * Saving
 * ------------------------------------------------------------------ */

/**
 * Write the program as the user's own and make it current. Through the store's
 * public methods only — the same three calls "New program" and a workout's
 * builder use. Reps go in as `{lo, hi}` per set (never `[lo, hi]` pairs inside
 * an array — Firestore refuses those; js/set-reps.js).
 */
export async function saveProgram(program) {
  const system = await store.saveSystem({
    name: program.name,
    notes: program.notes,
    daysPerWeek: program.daysPerWeek,
    minutes: program.minutes,
  });
  const idByKey = new Map();
  let order = 0;
  for (const w of program.workouts) {
    const row = await store.saveWorkout({
      name: w.name,
      systemId: system.id,
      order: order++,
      exercises: w.exercises.map((e) => {
        const reps = expandRepSpec(e.reps, e.sets);
        return { exerciseId: e.exerciseId, sets: e.sets, notes: '', ...(reps ? { reps } : {}) };
      }),
    });
    idByKey.set(w.key, row.id);
  }
  let saved = system;
  if (program.plan) {
    const slots = program.plan.slots.map((s) => (s === 'rest' ? 'rest' : idByKey.get(s) || null));
    saved = await store.saveSystem({ ...system, schedule: { kind: program.plan.kind, slots } });
  }
  await store.setCurrentSystem(system.id);
  return saved;
}

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

let openNow = null;

export function openOnboarding({ onDone } = {}) {
  if (openNow) return openNow;
  markSeen();

  const answers = { focus: [] };
  let step = 0;          // 0..5 questions, 6 = result
  let program = null;
  let finished = false;
  let saving = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    openNow = null;
    overlay.classList.add('is-leaving');
    setTimeout(() => overlay.remove(), 200);
    if (onDone) { try { onDone(); } catch (_) { /* the tour is optional */ } }
  };

  const back = iconBtn('left', 'Back', () => goBack(), 'icon-btn ob-back');
  const segments = QUESTIONS.map(() => el('span', { class: 'ob-seg' }));
  const progress = el('div', {
    class: 'ob-progress', role: 'progressbar',
    'aria-valuemin': '0', 'aria-valuemax': String(QUESTIONS.length), 'aria-label': 'Progress',
  }, segments);
  const skip = el('button', { class: 'btn small ghost ob-skip', text: 'Skip', onClick: () => finish() });
  const stage = el('div', { class: 'ob-stage' });
  const panel = el('div', { class: 'ob-panel' },
    el('div', { class: 'ob-head' }, back, progress, skip),
    stage,
  );
  const overlay = el('div', {
    class: 'ob-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Find your program',
  }, panel);

  const paintHead = () => {
    const done = Math.min(step, QUESTIONS.length);
    segments.forEach((s, i) => s.classList.toggle('is-done', i < done));
    progress.setAttribute('aria-valuenow', String(done));
    // Hidden, not removed, so the progress bar never shifts sideways.
    const noBack = step === 0 || step === 'building';
    back.disabled = noBack;
    back.style.visibility = noBack ? 'hidden' : '';
  };

  // Put `node` on stage. dir: 1 = forward (from the right), -1 = back, 0 = none.
  const show = (node, dir) => {
    const old = stage.querySelector('.ob-screen.is-current');
    node.classList.add('ob-screen', 'is-current');
    /* 🆕 MOTION 2 (2026-09-25, docs/motion2-plan.md package E): the two screens
     * are PUSHED on a spring (`sheet`), the new one in from the side you are
     * going, the old one out the other. A second tap mid-push retargets the
     * screen still moving, with the speed it has, rather than restarting it.
     * The CSS keyframes below stay as the path where springs do not run. */
    const sprung = Boolean(old && dir) && motionAllowed();
    if (old && dir && !sprung) node.classList.add(dir > 0 ? 'ob-in-fwd' : 'ob-in-back');
    stage.append(node);
    if (sprung) {
      const w = stage.clientWidth || 360;
      springTransform(node, { x: 0 }, 'sheet', { from: { x: dir * w } });
    }
    if (old) {
      old.classList.remove('is-current');
      old.setAttribute('aria-hidden', 'true');
      old.inert = true;
      if (dir && !sprung) old.classList.add(dir > 0 ? 'ob-out-fwd' : 'ob-out-back');
      const drop = () => old.remove();
      if (sprung) {
        old.classList.add('ob-leaving');
        springTransform(old, { x: -dir * (stage.clientWidth || 360) }, 'sheet').done.then(drop);
        setTimeout(drop, 700);
      } else if (dir) {
        old.addEventListener('animationend', drop, { once: true });
        setTimeout(drop, SLIDE_MS + 60);
      } else drop();
    }
    paintHead();
    const h = node.querySelector('.ob-q');
    if (h) { try { h.focus({ preventScroll: true }); } catch (_) { /* old engines */ } }
  };

  const questionScreen = (i) => {
    const Q = QUESTIONS[i];
    const screen = el('section', { class: 'ob-screen' });
    const heading = el('h2', { class: 'ob-q', tabindex: '-1', text: Q.q });
    if (!Q.multi) {
      const list = el('div', { class: 'ob-choices' }, Q.choices.map(([value, label]) =>
        el('button', {
          class: 'btn block lg ob-choice',
          'aria-pressed': answers[Q.key] === value ? 'true' : 'false',
          text: label,
          onClick: () => {
            if (!screen.classList.contains('is-current')) return;
            answers[Q.key] = value;
            go(i + 1, 1);
          },
        })));
      screen.append(heading, list);
      return screen;
    }

    // The multi-select: toggles, at most `max`, "None" clears the rest.
    const buttons = [];
    const repaint = () => {
      const picked = answers[Q.key];
      for (const b of buttons) {
        const v = b.dataset.value;
        const on = v === 'none' ? answers.focusNone === true : picked.includes(v);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.disabled = v !== 'none' && !on && picked.length >= Q.max;
      }
    };
    for (const [value, label] of Q.choices) {
      const b = el('button', {
        class: 'btn block lg ob-choice', text: label, dataset: { value },
        onClick: () => {
          const picked = answers[Q.key];
          if (value === 'none') {
            answers[Q.key] = [];
            answers.focusNone = !answers.focusNone;
          } else {
            answers.focusNone = false;
            answers[Q.key] = picked.includes(value)
              ? picked.filter((x) => x !== value)
              : picked.length < Q.max ? [...picked, value] : picked;
          }
          repaint();
        },
      });
      buttons.push(b);
    }
    repaint();
    screen.append(
      heading,
      el('p', { class: 'ob-sub', text: Q.sub }),
      el('div', { class: 'ob-choices ob-grid' }, buttons),
      el('div', { class: 'ob-foot' },
        el('button', {
          class: 'btn primary block lg', text: 'Next',
          onClick: () => { if (screen.classList.contains('is-current')) build(); },
        })),
    );
    return screen;
  };

  const buildingScreen = () => el('section', { class: 'ob-screen ob-building', 'aria-live': 'polite' },
    el('p', { class: 'ob-building-text', text: 'Building your program' }));

  const resultScreen = () => {
    const alts = matchingPresets(answers);
    const start = el('button', {
      class: 'btn primary block lg', text: 'Start with this',
      onClick: async () => {
        if (saving) return;
        saving = true;
        start.disabled = true;
        try {
          await saveProgram(program);
          finish();
          refreshRoute();
        } catch (err) {
          console.error(err);
          saving = false;
          start.disabled = false;
          toast('Could not save your program. Try again.');
        }
      },
    });
    return el('section', { class: 'ob-screen ob-result' },
      el('h2', { class: 'ob-q', tabindex: '-1', text: program.name }),
      el('ul', { class: 'ob-days' }, program.workouts.map((w) =>
        el('li', { class: 'ob-day' },
          el('span', { class: 'ob-day-name', text: w.name }),
          el('span', { class: 'ob-day-count', text: `${w.exercises.length} exercises` })))),
      el('div', { class: 'ob-foot' },
        start,
        alts.length
          ? el('p', { class: 'ob-alt' }, 'Or try ',
            alts.map((p, i) => [
              i ? ' or ' : null,
              el('a', { href: `#/explore/${p.id}`, text: p.name, onClick: () => finish() }),
            ]),
            '.')
          : null),
    );
  };

  function go(next, dir) {
    step = next;
    if (next < QUESTIONS.length) show(questionScreen(next), dir);
  }

  function goBack() {
    if (step === 'building' || step === 0) return;
    const to = step === QUESTIONS.length ? QUESTIONS.length - 1 : step - 1;
    go(to, -1);
  }

  function build() {
    step = 'building';
    show(buildingScreen(), 1);
    program = buildProgram({ ...answers, focus: answers.focus || [] });
    setTimeout(() => {
      if (finished) return;
      step = QUESTIONS.length;
      show(resultScreen(), 1);
    }, BUILD_MS);
  }

  document.body.append(overlay);
  show(questionScreen(0), 0);
  openNow = { close: finish };
  return openNow;
}
