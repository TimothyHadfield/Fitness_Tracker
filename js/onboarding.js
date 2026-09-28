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

//
// 🆕 OVERHAUL (2026-09-27, onboarding O-1…O-22). The flow now serves more than
// the one person who wants a program built:
//
//   Start ─┬─ Build me a program → 6 questions → About you → Building → Result
//          ├─ Pick a ready-made one → About you → #/explore
//          ├─ Use my own program   → About you → #/system/new
//          ├─ Just log workouts    → About you → #/record
//          └─ "I already have an account" → #/signin (closed, nothing saved)
//
// About you (gender, birth year, body weight + lbs/kg) is on every path and all
// of it is optional — without it every woman is ranked on male standards. One
// Skip ends the WHOLE intro: `onDone({ skipped: true })` tells app.js not to
// start the tour.

import { el, iconBtn, toast, refreshRoute, helpDot } from './ui.js';
import { store, demo, auth } from './store.js';
import { buildProgram, matchingPresets } from './program-builder.js';
import { springTransform, isSpringing } from './spring.js';
import { motionAllowed } from './motion.js';
import { expandRepSpec } from './set-reps.js';
import * as units from './units.js';

export const ONBOARDED_KEY = 'ftrack:v1:onboarded';

const SLIDE_MS = 240;  // = --t-slow
const BUILD_MS = 550;  // the "Building your program" moment; brief caps it at 600
const PICK_MS = 100;   // a tapped answer shows lit this long before its screen leaves

/** The first screen. `to` is where the path ends once About you is passed;
 *  'build' goes through the questions instead. Labels ≤ 4 words. */
export const PATHS = [
  ['build', 'Build me a program', null],
  ['preset', 'Pick a ready-made one', '#/explore'],
  ['own', 'Use my own program', '#/system/new'],
  ['log', 'Just log workouts', '#/record'],   // → "Empty workout" once wave 2 lands it
];

/* ⚠️ THE ? SAYS ONLY WHAT THE CODE DOES (checked 2026-09-27): store.js publishes
 * `profile.gender` and `profile.age` (never the birth year) to friends — and to
 * everyone on a public account — while body weight reaches a friend's copy only
 * through its own switch (`settings.shareBodyWeight`, off by default, and never
 * in the public copy; social.js buildProjection). */
export const ABOUT_WHY = 'Ranks your strength against people like you. Gender and age show on your profile. '
  + 'Body weight stays private unless you share it.';

/** Countries that weigh in pounds. Everyone else starts on kg (O-2). */
const LBS_REGIONS = ['US', 'LR', 'MM'];

/**
 * The unit a newcomer most likely reads, from a BCP-47 locale ("en-GB" → kg).
 * A locale with no region ("en") keeps today's default, pounds.
 */
export function defaultUnitsFor(locale) {
  const tag = String(locale || '');
  let region = null;
  try {
    if (typeof Intl !== 'undefined' && Intl.Locale) region = new Intl.Locale(tag).maximize().region || null;
  } catch (_) { region = null; }
  if (!region) {
    const m = /[-_]([A-Za-z]{2}|\d{3})(?:[-_]|$)/.exec(tag);
    region = m ? m[1].toUpperCase() : null;
  }
  // A bare language ("en") maximizes to its likeliest country, which for
  // English is the US — right, and the same answer as no region at all.
  if (!region) return 'lbs';
  return LBS_REGIONS.includes(region) ? 'lbs' : 'kg';
}

/**
 * Where the About-you lbs/kg toggle starts. An existing account keeps its own
 * unit, lbs by absence — never the phone's guess (MISC-FIX w4). A first run
 * guesses from the locale, unless the account already says kg (the store
 * answers 'lbs' for "no settings yet", so an lbs there proves nothing).
 */
export function startingUnits(accountUnits, firstRun, locale = localeNow()) {
  if (!firstRun) return accountUnits === 'kg' ? 'kg' : 'lbs';
  return accountUnits === 'kg' ? 'kg' : defaultUnitsFor(locale);
}

function localeNow() {
  try {
    const nav = typeof navigator !== 'undefined' && (navigator.languages && navigator.languages[0] || navigator.language);
    if (nav) return nav;
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch (_) { return ''; }
}

function ageFrom(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900) return null;
  const age = new Date().getFullYear() - y;
  return age >= 5 && age <= 120 ? age : null;
}

/** "A · rest · B · rest · C · rest · rest": a shared prefix ("Full Body ") is
 *  dropped so the week fits one line; names that differ are kept whole. */
export function planLine(program) {
  if (!program || !program.plan || !Array.isArray(program.plan.slots)) return '';
  const names = new Map(program.workouts.map((w) => [w.key, w.name]));
  const all = program.workouts.map((w) => w.name);
  let cut = 0;
  if (all.length > 1) {
    const first = all[0];
    while (cut < first.length && all.every((n) => n[cut] === first[cut])) cut++;
    cut = first.lastIndexOf(' ', cut) + 1;   // whole words only
    if (all.some((n) => !n.slice(cut))) cut = 0;
  }
  return program.plan.slots.map((s) => (s === 'rest' ? 'rest' : (names.get(s) || '').slice(cut) || '?')).join(' · ');
}

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
    // "+ pull-up bar" is honest about what the bodyweight program asks for (O-6).
    ['gym', 'Full gym'], ['dumbbells', 'Dumbbells only'], ['barbell', 'Barbell + rack at home'], ['bodyweight', 'Bodyweight + pull-up bar'],
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
  // Read BEFORE markSeen(): only the very first showing on this device is a
  // first run. Reopened from Settings ("Find me a program") it is not.
  const firstRun = !seenHere();
  markSeen();

  const answers = { focus: [] };
  const about = { gender: null, birthYear: '', weight: '', units: null };
  // 🔄 MISC-FIX w4: the lbs/kg toggle is written back ONLY once somebody taps
  // it. Before, an untouched toggle saved its locale guess, so an lbs account
  // on an en-GB phone turned kg just by passing through "Find me a program".
  let unitsTouched = false;
  let path = null;       // PATHS key once the start screen is answered
  // 'start' · 0..5 (the questions) · 'about' · 'building' · 'result'
  let step = 'start';
  let program = null;
  let finished = false;
  let saving = false;

  // The unit toggle starts on what the account already says (someone reopening
  // this from Settings must not have their unit flipped by a guess). An account
  // with no unit saved reads lbs by absence, so that is what it shows. Only a
  // first run guesses from the phone's locale (O-2) — app.js firstRunUnits has
  // already saved that guess when it is kg. Read once, before About you.
  store.getSettings().then((s) => { if (!about.units) about.units = startingUnits(s && s.units, firstRun); }).catch(() => {});
  store.getProfile().then((p) => {
    if (!p) return;
    if (about.gender == null && p.gender) about.gender = p.gender;
    if (!about.birthYear && p.birthYear) about.birthYear = String(p.birthYear);
  }).catch(() => {});

  /* `skipped` is true when the person chose to end the intro (Skip, Not now,
   * "I already have an account"): app.js then starts no tour (O-9). */
  const finish = ({ skipped = false } = {}) => {
    if (finished) return;
    finished = true;
    openNow = null;
    overlay.classList.add('is-leaving');
    setTimeout(() => overlay.remove(), 200);
    if (onDone) { try { onDone({ skipped, path }); } catch (_) { /* the tour is optional */ } }
  };

  const back = iconBtn('left', 'Back', () => goBack(), 'icon-btn ob-back');
  const progress = el('div', {
    class: 'ob-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-label': 'Progress',
  });
  let segments = [];
  const setSegments = (n) => {
    if (segments.length === n) return;
    segments = Array.from({ length: n }, () => el('span', { class: 'ob-seg' }));
    progress.replaceChildren(...segments);
    progress.setAttribute('aria-valuemax', String(n));
  };
  const skip = el('button', {
    class: 'btn small ghost ob-skip', text: 'Skip',
    onClick: () => {
      // The one choice already made still counts: a ready-made / own / log
      // path goes where it said. Nothing else is saved.
      const dest = path && step === 'about' ? (PATHS.find((p) => p[0] === path) || [])[2] : null;
      if (dest) location.hash = dest;
      finish({ skipped: true });
    },
  });
  const stage = el('div', { class: 'ob-stage' });
  const panel = el('div', { class: 'ob-panel' },
    el('div', { class: 'ob-head' }, back, progress, skip),
    stage,
  );
  const overlay = el('div', {
    class: 'ob-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Get started',
  }, panel);

  const paintHead = () => {
    // The bar counts the screens of the path chosen: 6 questions + About you,
    // or About you alone. Hidden (not removed) on the start screen, so nothing
    // in the head shifts sideways.
    setSegments(path === 'build' ? QUESTIONS.length + 1 : 1);
    const done = step === 'start' ? 0
      : typeof step === 'number' ? step
        : step === 'about' ? (path === 'build' ? QUESTIONS.length : 0)
          : segments.length;
    segments.forEach((s, i) => s.classList.toggle('is-done', i < done));
    progress.setAttribute('aria-valuenow', String(done));
    progress.style.visibility = step === 'start' ? 'hidden' : '';
    const noBack = step === 'start' || step === 'building';
    back.disabled = noBack;
    back.style.visibility = noBack ? 'hidden' : '';
    skip.textContent = step === 'result' ? 'Not now' : 'Skip';
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
        // 🔄 The safety net waits for the spring (review, 2026-09-25): a flat
        // 700ms could take the old screen away while it was still sliding on a
        // slow frame, leaving the new one to arrive over an empty stage.
        const net = () => { if (isSpringing(old)) setTimeout(net, 200); else drop(); };
        setTimeout(net, 700);
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
          onClick: (e) => {
            if (!screen.classList.contains('is-current') || screen.dataset.picked) return;
            answers[Q.key] = value;
            /* 🆕 THE TAP LANDS BEFORE THE SCREEN LEAVES (2026-09-25, motion
             * review): the answer lights for PICK_MS, then the push starts and
             * carries it out still lit. `picked` stops a second tap choosing
             * twice in that window; Skip in it wins (`finished`). */
            screen.dataset.picked = '1';
            for (const b of screen.querySelectorAll('.ob-choice')) {
              b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false');
            }
            setTimeout(() => { if (!finished && screen.classList.contains('is-current')) go(i + 1, 1); }, PICK_MS);
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
          onClick: () => { if (screen.classList.contains('is-current')) goAbout(1); },
        })),
    );
    return screen;
  };

  /* The first screen (O-3, O-4, O-22): the app mark, one question, four ways
   * in, and a way out for somebody who already has an account. */
  const startScreen = () => {
    const screen = el('section', { class: 'ob-screen ob-start' });
    const list = el('div', { class: 'ob-choices' }, PATHS.map(([key, label]) =>
      el('button', {
        class: 'btn block lg ob-choice',
        'aria-pressed': path === key ? 'true' : 'false',
        text: label,
        onClick: (e) => {
          if (!screen.classList.contains('is-current') || screen.dataset.picked) return;
          path = key;
          screen.dataset.picked = '1';
          for (const b of screen.querySelectorAll('.ob-choice')) {
            b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false');
          }
          setTimeout(() => {
            if (finished || !screen.classList.contains('is-current')) return;
            if (key === 'build') go(0, 1); else goAbout(1);
          }, PICK_MS);
        },
      })));
    screen.append(
      el('img', { class: 'ob-icon', src: 'icon.svg', alt: '', width: '48', height: '48' }),
      el('h2', { class: 'ob-q', tabindex: '-1', text: 'How do you want to start?' }),
      list,
      el('p', { class: 'ob-alt ob-signin' },
        // Closes without saving anything: a returning user on a new phone is
        // on a throwaway anonymous account until they sign in (O-4).
        el('a', { href: '#/signin', text: 'I already have an account', onClick: () => finish({ skipped: true }) })),
      /* 🆕 O-19 (2026-09-27): somebody arriving from Strong, Hevy or a
       * spreadsheet brings their sets in (views-import.js reads them). A link,
       * not a fifth path: the start screen stays four ways in, without scroll. */
      el('p', { class: 'ob-alt ob-history' },
        el('a', { href: '#/import', text: 'Bring my history', onClick: () => finish({ skipped: true }) })),
    );
    return screen;
  };

  /* About you (O-1, O-2). Every field optional; Next saves whatever is there. */
  const aboutScreen = () => {
    const screen = el('section', { class: 'ob-screen ob-about' });
    if (!about.units) about.units = startingUnits(null, firstRun);

    const genderChips = el('div', { class: 'chips' }, [['male', 'Male'], ['female', 'Female']].map(([value, label]) =>
      el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(about.gender === value), text: label,
        onClick: (e) => {
          about.gender = about.gender === value ? null : value;
          for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', 'false');
          if (about.gender) e.currentTarget.setAttribute('aria-pressed', 'true');
        },
      })));

    const year = el('input', {
      class: 'input', type: 'number', inputmode: 'numeric', placeholder: 'e.g. 1994',
      min: '1900', max: String(new Date().getFullYear()), value: about.birthYear || '',
      onInput: (e) => { about.birthYear = e.target.value; },
    });

    const weight = el('input', {
      class: 'input ob-weight', type: 'number', inputmode: 'decimal', step: '0.1',
      placeholder: about.units === 'kg' ? 'e.g. 82' : 'e.g. 180', value: about.weight || '',
      'aria-label': 'Body weight',
      onInput: (e) => { about.weight = e.target.value; },
    });
    const unitChips = el('div', { class: 'chips' }, [['lbs', 'lbs'], ['kg', 'kg']].map(([value, label]) =>
      el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(about.units === value), text: label,
        onClick: (e) => {
          about.units = value;
          unitsTouched = true;
          for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', String(c === e.currentTarget));
          weight.placeholder = value === 'kg' ? 'e.g. 82' : 'e.g. 180';
        },
      })));

    const next = el('button', {
      class: 'btn primary block lg', text: 'Next',
      onClick: () => { if (screen.classList.contains('is-current')) aboutDone(next); },
    });

    screen.append(
      el('div', { class: 'help-line ob-title' },
        el('h2', { class: 'ob-q', tabindex: '-1', text: 'About you' }),
        helpDot(ABOUT_WHY, { label: 'Why we ask' })),
      el('div', { class: 'field' }, el('label', { text: 'Gender' }), genderChips),
      el('div', { class: 'field' }, el('label', { text: 'Birth year' }), year),
      el('div', { class: 'field' }, el('label', { text: 'Body weight' }),
        el('div', { class: 'ob-weight-row' }, weight, unitChips)),
      el('div', { class: 'ob-foot' }, next),
    );
    return screen;
  };

  /* Everything About you gathered, through the public store methods only (the
   * settings queue orders them; store.js inSettingsQueue). Units are written
   * ONLY when the toggle was tapped (MISC-FIX w4): an untouched toggle shows
   * what the account already has, or a first run's guess that app.js
   * firstRunUnits has already saved. */
  async function saveAbout() {
    const u = about.units === 'kg' ? 'kg' : 'lbs';
    if (unitsTouched) units.setUnits(u);
    const intro = {
      path,
      ...(path === 'build' ? {
        goal: answers.goal, experience: answers.experience, days: answers.days,
        minutes: answers.minutes, equipment: answers.equipment, focus: answers.focus || [],
      } : {}),
      age: ageFrom(about.birthYear),
      at: new Date().toISOString(),
    };
    const jobs = [store.saveSettings(unitsTouched ? { units: u, intro } : { intro })];
    const profile = {};
    if (about.gender) profile.gender = about.gender;
    if (ageFrom(about.birthYear)) profile.birthYear = Number(about.birthYear);
    if (Object.keys(profile).length) jobs.push(store.saveProfile(profile));
    const w = Number(about.weight);
    // Typed in the unit the toggle shows, whatever the app is set to.
    if (w > 0) jobs.push(store.logBodyWeight(u === 'kg' ? w * units.LB_PER_KG : w));
    const out = await Promise.allSettled(jobs);
    for (const r of out) if (r.status === 'rejected') console.warn('About you not fully saved.', r.reason);
  }

  async function aboutDone(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    const saved = saveAbout();
    if (path === 'build') {
      saved.catch(() => {});
      build();
      return;
    }
    await saved.catch(() => {});
    const dest = (PATHS.find((p) => p[0] === path) || [])[2] || '#/home';
    location.hash = dest;
    finish({ skipped: false });
  }

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
          finish({ skipped: false });
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
      // Each day names its exercises (O-7): you agree to a program you can see.
      el('ul', { class: 'ob-days' }, program.workouts.map((w) =>
        el('li', { class: 'ob-day' },
          el('div', { class: 'ob-day-main' },
            el('span', { class: 'ob-day-name', text: w.name }),
            el('span', { class: 'ob-day-ex', text: w.exercises.map((e) => e.name).join(' · ') })),
          el('span', { class: 'ob-day-count', text: `${w.exercises.length} exercises` })))),
      program.plan ? el('p', { class: 'ob-plan', text: `Week: ${planLine(program)}` }) : null,
      el('div', { class: 'ob-foot' },
        start,
        alts.length
          ? el('p', { class: 'ob-alt' }, 'Or try ',
            alts.map((p, i) => [
              i ? ' or ' : null,
              el('a', { href: `#/explore/${p.id}`, text: p.name, onClick: () => finish({ skipped: false }) }),
            ]),
            '.')
          : null),
    );
  };

  function go(next, dir) {
    step = next;
    if (next === 'start') show(startScreen(), dir);
    else if (next < QUESTIONS.length) show(questionScreen(next), dir);
  }

  function goAbout(dir) {
    step = 'about';
    show(aboutScreen(), dir);
  }

  function goBack() {
    if (step === 'building' || step === 'start') return;
    if (step === 'result') return goAbout(-1);
    if (step === 'about') return path === 'build' ? go(QUESTIONS.length - 1, -1) : restart();
    if (step === 0) return restart();
    go(step - 1, -1);
  }

  // Back to the start screen: the path is chosen again there.
  function restart() {
    path = null;
    go('start', -1);
  }

  function build() {
    step = 'building';
    show(buildingScreen(), 1);
    // `age` lets the builder go easier on an older beginner (O-8, program-builder.js).
    const age = ageFrom(about.birthYear);
    program = buildProgram({ ...answers, focus: answers.focus || [], ...(age ? { age } : {}) });
    setTimeout(() => {
      if (finished) return;
      step = 'result';
      show(resultScreen(), 1);
    }, BUILD_MS);
  }

  /* ⚠️ THE ? BOX OPENS UNDER THIS OVERLAY without help: `.help-pop` sits at
   * z-index 70 and `.ob-overlay` at 80 (measured, WebKit 1366 — the box was
   * drawn but hidden). Lifted here until the stylesheet does it
   * (`.ob-overlay ~ .help-pop, .ob-overlay ~ .help-pop-x { z-index: 85 }`). */
  overlay.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('.help-dot')) return;
    requestAnimationFrame(() => {
      for (const p of document.querySelectorAll('.help-pop')) p.style.zIndex = '85';
    });
  }, true);   // capture: the dot stops its own click from bubbling

  document.body.append(overlay);
  show(startScreen(), 0);
  openNow = { close: () => finish({ skipped: true }) };
  return openNow;
}
