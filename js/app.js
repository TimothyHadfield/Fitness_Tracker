// Router + boot.

import { store, demo, warmReadCache, social } from './store.js';
import {
  el, icon, iconBtn, clear, profileButton, associateLabels, autoGrowTextareas, wireSegmented,
} from './ui.js';
import {
  HomeView, RecordChooserView, StartPickerView, WorkoutsView, SystemRouteView,
  WorkoutRouteView, ExploreView, ExploreDetailView,
} from './views-workouts.js';
import { SessionView, BenchmarkView, ActivityLogView } from './views-session.js';
import { CalendarView, DayView, GraphView, SettingsView } from './views-data.js';
import { AccountView, SignInView } from './views-account.js';
import { ImportView } from './views-import.js';
import { ProfileView } from './views-profile.js';
import { EditSessionView } from './views-edit-session.js';
import { SocialView, FriendView, InviteView, FindView, AddView } from './views-social.js';
import { GoalsView, GoalRouteView } from './views-goals.js';
import { setUnits } from './units.js';

/**
 * FIVE TABS, AND THE MIDDLE ONE IS THE POINT.
 *
 * Tim, 2026-08-22, cutting six down to five: *"I want to narrow down the number
 * of base bars at the bottom … and have the middle one be slightly bigger than
 * the others. This will improve readability and design."*
 *
 * ⚠️ The big middle button is not decoration, and it is the one part of this
 * that the app's own rules already argued for. **D4 says the logging loop is
 * the single thing apps beat spreadsheets at** — so the act of recording
 * training should be the largest, most central, hardest-to-miss target on
 * every screen. It was previously two buttons down a list on Home.
 *
 * Where the other two went, and why each merge is defensible rather than
 * merely tidy:
 *
 *   SOCIAL → HOME. Both answer "what is going on", one for you and one for the
 *   people you train with, and they are the two screens you open to look rather
 *   than to do. They share a You / Friends switch. ⚠️ It also happens to fix
 *   something the UX review found: Home shows nothing that changes as you use
 *   the app, and a friend's training is the one thing on it that is never the
 *   same twice.
 *
 *   CALENDAR → DATA. Both are the past: one as squares, one as lines. The
 *   calendar was already the odd tab out — every other tab answers a question,
 *   and it displayed a record.
 *
 * `match` is which route names light this tab up. A merged tab owns more than
 * one route, and the alternative — a tab that goes dark when you are plainly
 * still inside it — is how a merge starts feeling like a dead end.
 */
const NAV = [
  { hash: '#/home',     label: 'Home',     icon: 'home',     match: ['home', 'social', 'friend', 'invite', 'find', 'add'] },
  { hash: '#/workouts', label: 'Workouts', icon: 'dumbbell', match: ['workouts', 'system', 'workout', 'explore'] },
  // ⚠️ The hash is #/record and the view is the old start picker with the
  // benchmark action folded in. Both #/start and #/benchmark still resolve, so
  // nothing that linked to them — including a bookmarked deep link — breaks.
  { hash: '#/record',   label: 'Record',   icon: 'plus',     match: ['record', 'start', 'benchmark', 'session', 'activity'], primary: true },
  // Route stays #/graphs; only the label changed. Renaming the hash would
  // break nothing visible and churn the router for no user-facing gain.
  // ⚠️ CALENDAR LEFT DATA AND TOOK GOALS' SLOT — Tim, 2026-08-25: *"I want to
  // remove the Goals section and replace it with the Calendar details. This
  // means moving all the stuff in the data section that has to do with Calendar
  // out and creating its own section."*
  //
  // This reverses the 2026-08-22 merge, which folded Calendar into Data on the
  // argument that both are the past, one drawn as squares and one as lines.
  // That argument was about what the two screens ARE; his is about how often he
  // opens them, and he is the one using it in a gym. Frequency wins.
  { hash: '#/graphs',   label: 'Data',     icon: 'chart',    match: ['graphs'] },
  { hash: '#/calendar', label: 'Calendar', icon: 'calendar', match: ['calendar', 'day', 'edit'] },
];

// ⚠️ GOALS IS OFF THE TAB BAR, NOT DELETED, and the distinction matters. The
// feature is built, tested (232 assertions) and reachable: `#/goals` still
// resolves, Settings links to it, and every hash anybody bookmarked still
// works. This is the same call the eighth pass of 2026-08-22 made about
// `#/start` and `#/benchmark` — a tab bar being redesigned must not 404 a URL.
//
// ⚠️ A ROUTE WITH NO WAY IN IS DELETED IN EVERY SENSE THAT MATTERS, which is why
// the Settings link went in at the same time as this line came out.

// Routes that take over the whole screen (no bottom nav).
// `friend` and `invite` are here but `social` is NOT: Social is a tab, and the
// two screens you reach FROM it are not. `goal` and `goals` are the same pair.
// ⚠️ `record` is NOT here — it is a tab now, and a tab that hides the bar it
// lives in cannot be tapped twice. `start` stays: it is the old deep link and
// still opens the picker as a pushed screen with a back button.
// ⚠️ `goals` joined this list on 2026-08-25 when it stopped being a tab. A
// screen with no tab of its own is reached FROM somewhere, so it needs a back
// button, which is what being fullscreen gives it — the same shape as `start`.
const FULLSCREEN = ['session', 'workout', 'system', 'explore', 'benchmark', 'settings', 'day', 'edit', 'start', 'account', 'signin', 'profile', 'friend', 'invite', 'find', 'add', 'goal', 'goals', 'import'];

function parse(hash) {
  const clean = (hash || '').replace(/^#\/?/, '');
  const [name, ...rest] = clean.split('/');
  return { name: name || 'home', param: rest.join('/') };
}

function navbar(active) {
  return el('nav', { class: 'navbar' },
    // Desktop only. The sidebar is the true top-left of the window, so the
    // account button belongs here beside the app name rather than in the
    // content header. Hidden on mobile, where the navbar is a bottom tab bar
    // and the topbar carries the profile button instead.
    el('div', { class: 'nav-brand' },
      profileButton(),
      el('span', { class: 'nav-brand-name', text: 'Fitness Tracker' }),
    ),
    NAV.map((n) =>
      el('a', {
        href: n.hash,
        class: n.primary ? 'nav-primary' : null,
        // A merged tab owns several routes; it stays lit for all of them.
        'aria-current': n.match.includes(active) ? 'page' : null,
      }, icon(n.icon), el('span', { text: n.label }))),
  );
}

async function resolve(route) {
  switch (route.name) {
    case 'home':      return HomeView();
    // The Record tab is the CATEGORY CHOOSER since 2026-08-26 — weightlifting
    // plus the activities. The full lifting recorder lives behind it at
    // #/start, which is also the old deep link, still working.
    case 'record':    return RecordChooserView();
    case 'start':     return StartPickerView({ tab: false });
    // #/activity/<exercise name> prefills; bare #/activity opens the picker.
    case 'activity':  return ActivityLogView(route.param);
    case 'workouts':  return WorkoutsView();
    // #/system/<id> reads it, #/system/<id>/edit and #/system/new are the form.
    case 'system':    return SystemRouteView(route.param);
    // #/explore lists them, #/explore/<id> is one of them.
    case 'explore':   return route.param ? ExploreDetailView(route.param) : ExploreView();
    // #/workout/<id> reads it and starts it; /edit and new/<systemId> build it.
    case 'workout':   return WorkoutRouteView(route.param);
    case 'session':   return SessionView(route.param);
    case 'benchmark': return BenchmarkView();
    case 'calendar':  return CalendarView();
    case 'day':       return DayView(route.param);
    case 'edit':      return EditSessionView(route.param);
    case 'graphs':    return GraphView();
    case 'settings':  return SettingsView();
    case 'account':   return AccountView();
    case 'import':    return ImportView();
    case 'signin':    return SignInView();
    case 'profile':   return ProfileView();
    case 'social':    return SocialView();
    case 'goals':     return GoalsView();
    // #/goal/new, #/goal/new/<muscle>, #/goal/stalls, #/goal/systems — the
    // whole tail is passed through and dispatched there, the same way `invite`
    // keeps its two-part parameter together.
    case 'goal':      return GoalRouteView(route.param);
    case 'friend':    return FriendView(route.param);
    // #/invite/<ownerUid>/<token> — the whole param is passed through, because
    // parse() joins the rest back together and the token is the second half.
    case 'invite':    return InviteView(route.param);
    // Finding somebody: by name, or by landing on their code (2026-08-29).
    case 'find':      return FindView();
    case 'add':       return AddView(decodeURIComponent(route.param || ''));
    default:          return HomeView();
  }
}

/**
 * "You are in the demo account."
 *
 * A strip above the header on every screen, not a toast and not a one-time
 * dialog. Two things have to be true at every moment of a demo session and
 * neither survives being said once: this is not your data, and nothing you
 * change here is being kept. It also carries the way out, because a sandbox
 * with no visible exit is its own kind of trap.
 */
function demoBar() {
  return el('div', { class: 'demo-bar', role: 'status' },
    el('span', { class: 'demo-bar-dot' }),
    el('span', { class: 'demo-bar-text' },
      el('b', { text: 'Demo account.' }),
      ' Made-up data — change anything you like, nothing is saved.',
    ),
    el('button', {
      class: 'btn small', text: 'Leave',
      onClick: () => demo.exit(),
    }),
  );
}

let rendering = false;

async function render() {
  if (rendering) return;
  rendering = true;

  const app = document.getElementById('app');
  const route = parse(location.hash);

  if (route.name === 'blank') { rendering = false; return; } // used to force a refresh

  try {
    const screen = await resolve(route);
    clear(app);
    if (FULLSCREEN.includes(route.name)) {
      // No bottom nav on these, so the screen itself owes the safe-area padding.
      screen.classList.add('no-nav');
    } else {
      app.append(navbar(route.name));
    }
    // ⚠️ Prepended to EVERY screen, here rather than in screenShell, so that no
    // route can be reached without it — including the fullscreen ones and the
    // error screen below. Somebody looking at a year of invented training must
    // never be in any doubt about whose year it is; that mistake would be far
    // worse than the feature is worth.
    if (demo.active()) screen.prepend(demoBar());
    app.append(screen);
    // ⚠️ Every screen, here rather than in screenShell, for the same reason the
    // demo bar is: no route may be reached without it. See associateLabels()
    // and autoGrowTextareas().
    associateLabels(screen);
    autoGrowTextareas(screen);
    // ⚠️ AND THE SLIDING PILL, for the same reason again — five segmented
    // controls are built in four different view files, and one hook here beats
    // four of them remembering. The control works without it (app.css keeps the
    // painted fallback); this only upgrades the change from a repaint to a
    // movement. Must run AFTER the screen is in the document, because it
    // measures the selected segment.
    wireSegmented(screen);
  } catch (err) {
    console.error(err);
    clear(app);
    app.append(el('div', { class: 'screen no-nav' },
      demo.active() ? demoBar() : null,
      el('div', { class: 'pane-scroll' },
        el('div', { class: 'empty' },
          el('div', { class: 'empty-title', text: 'Something went wrong' }),
          el('p', { text: err.message || 'That screen could not be opened.' }),
          el('a', { class: 'btn primary', href: '#/home', text: 'Back to home' }),
        ),
      ),
    ));
  }

  rendering = false;
}

window.addEventListener('hashchange', render);

/**
 * ⚠️ THE SOFTWARE KEYBOARD, WHICH THIS LAYOUT OTHERWISE CANNOT SEE.
 *
 * Every screen in this app is a fixed header, one scrolling middle and a fixed
 * footer inside a box locked to the viewport height (Design Rule 1) — and the
 * footer is where the primary action of every screen lives. On iOS the keyboard
 * does not shrink the viewport; it is painted ON TOP of it, and `100dvh`,
 * `innerHeight` and every media query carry on reporting the full screen. So
 * the footer stays exactly where it was, underneath the keyboard.
 *
 * Measured 2026-08-21 at 393×852 with a 336px keyboard: the usable area ends at
 * y=516 and the session runner's "Next exercise" sits at 789–852. The same is
 * true of every "Save changes", every "Done", and the exercise picker — where
 * the sheet raises its own keyboard and then hides its own results behind it.
 *
 * `window.visualViewport` is the only API that reports any of this. What it
 * gives is published as `--kb` and the CSS subtracts it, so the app occupies
 * the part of the screen that is actually visible. On a desktop the value
 * stays 0 and every rule using it is a no-op.
 *
 * ⚠️ NOT VERIFIED ON A DEVICE. Headless Chrome has no software keyboard, so
 * nothing here can prove itself — the mechanism is documented behaviour, and
 * the confirmation has to come from an iPhone. Keep saying so until it does.
 */
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;

  const apply = () => {
    // offsetTop matters as well as height: iOS may also shift the visual
    // viewport down to reveal the focused field, and the part of the layout
    // viewport that is hidden is everything below the visible slice.
    const hidden = window.innerHeight - vv.height - vv.offsetTop;
    // A few pixels of disagreement are normal while browser chrome animates,
    // and reacting to those would make the whole app twitch during a scroll.
    // A keyboard is never small.
    const kb = hidden > 60 ? Math.round(hidden) : 0;
    document.documentElement.style.setProperty('--kb', kb + 'px');
  };

  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  apply();

  // Once the pane has shrunk, whatever was focused can be outside it — the
  // field is above the keyboard but below the new bottom edge. The pane is the
  // nearest scrollable ancestor, so this scrolls that and never the window,
  // which cannot scroll anyway.
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('input, select, textarea')) return;
    setTimeout(() => {
      if (el.isConnected) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
  });
}

(async function boot() {
  trackKeyboard();
  const settings = await store.getSettings();
  document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : 'dark');
  // The colour palette (Tim's pick of all three options, 2026-08-26). The
  // attribute is only SET for a non-default choice: the default palette is
  // bare :root, and an unrecognised stored value degrades to it — the same
  // fail-safe shape social's tier normalisation uses.
  if (['teal', 'indigo', 'ember'].includes(settings.palette)) {
    document.documentElement.setAttribute('data-palette', settings.palette);
  } else {
    document.documentElement.removeAttribute('data-palette');
  }
  // Seeded once, here, because the stepper and the set formatter are synchronous
  // and are called mid-render — they cannot await the store for the unit.
  setUnits(settings.units);
  if (!location.hash) location.hash = '#/home';
  await render();
  registerServiceWorker();
  // ⚠️ AFTER the first screen is on the page, and never awaited. Every tab
  // needs some of the same collections, and left to the screens those reads
  // happen a few at a time, per visit — the Goals tab alone asked for seven,
  // and on Firestore each one is a network round trip. Fetching them once in
  // parallel here means the whole app costs one round trip of latency instead
  // of one per collection per tab. Nothing waits for it and it cannot fail
  // loudly: this screen already works without it.
  warmReadCache();
  // ⚠️ Repair stale published copies — the "Autumn's muscle map froze at the
  // moment she connected" bug. Reads a few documents, writes only when what
  // is published is older than what is recorded. Never awaited, cannot fail
  // loudly; see social.healStalePublish().
  social.healStalePublish().catch(() => {});
})();

// Registered AFTER the first render, and never awaited. D6 says a gym with no
// signal must not stop anyone logging a set, and a service worker that fails to
// register — file missing, http://, private mode — must not stop the app either.
// The registration is a nice-to-have for the NEXT visit; this one already works.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Relative, so it keeps working under the /Fitness_Tracker/ path on Pages.
  navigator.serviceWorker.register('./sw.js')
    .catch((err) => console.warn('Service worker did not register.', err));

  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data === 'assets-updated') offerRefresh();
  });

  /**
   * ⚠️ ASK AGAIN WHENEVER THE APP COMES BACK TO THE FOREGROUND.
   *
   * The worker only notices a deploy while it is serving fetches, which means
   * on a real page load. **An installed home-screen app is resumed, not
   * reloaded** — iOS hands back the document that was already there, nothing is
   * requested, and the update machinery is never consulted at all. So the app
   * could sit weeks behind the live site while working exactly as designed.
   *
   * Tim reported this on 2026-08-22 as a missing feature: the years view had
   * been live for hours, the server was serving it, and his phone had simply
   * never asked. The check is throttled inside the worker, and it still only
   * OFFERS — nothing here reloads a page that might have unsaved numbers on it.
   */
  const askForUpdates = () => {
    if (document.visibilityState !== 'visible') return;
    const sw = navigator.serviceWorker.controller;
    if (sw) sw.postMessage('check-assets');
    // Also re-fetch sw.js itself, which is the only way a CHANGED WORKER is
    // ever picked up — the message above only revalidates the shell it caches.
    navigator.serviceWorker.getRegistration()
      .then((reg) => reg && reg.update())
      .catch(() => {});
  };

  document.addEventListener('visibilitychange', askForUpdates);
  // A phone that has just found signal again is the other moment worth asking.
  window.addEventListener('online', askForUpdates);
}

/**
 * "A new version is ready."
 *
 * The service worker serves the cached file and fetches the new one behind it,
 * so the load that follows a deploy shows the OLD app. That is the deliberate
 * trade in sw.js — it self-heals and cannot freeze anyone on a stale build the
 * way a hand-maintained cache version can — but the user is left looking at a
 * change that shipped and did not appear. Tim hit exactly that.
 *
 * ⚠️ It OFFERS rather than reloads. Reloading by itself would be correct almost
 * always and catastrophic once: mid-set, with numbers typed and not yet saved.
 * Nothing here touches the page until it is tapped.
 */
let refreshOffered = false;
function offerRefresh() {
  if (refreshOffered) return;
  refreshOffered = true;

  const bar = el('div', { class: 'update-bar', role: 'status' },
    el('span', { text: 'A new version is ready.' }),
    el('button', {
      class: 'btn small primary', text: 'Refresh',
      onClick: () => location.reload(),
    }),
    iconBtn('x', 'Dismiss', () => bar.remove()),
  );
  document.body.append(bar);
}
