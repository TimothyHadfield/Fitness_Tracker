// Router + boot.

import { store, demo, warmReadCache, social, todayISO } from './store.js';
import { liveSessionBar } from './live-session.js';
import {
  el, icon, iconBtn, clear, profileButton, associateLabels, autoGrowTextareas, wireSegmented,
  markRoute, parkScreen,
} from './ui.js';
import {
  HomeView, RecordChooserView, StartPickerView, WorkoutsView, SystemRouteView,
  WorkoutRouteView, ExploreView, ExploreDetailView,
} from './views-workouts.js';
import { SessionView, BenchmarkView, ActivityLogView } from './views-session.js';
import { CalendarView, DayView, GraphView, SettingsView } from './views-data.js';
import { AccountView, SignInView, NotesView } from './views-account.js';
import { ImportView } from './views-import.js';
import { ProfileView } from './views-profile.js';
import { EditSessionView } from './views-edit-session.js';
import {
  SocialView, FriendView, FriendSessionView, InviteView, FindView, AddView,
  CompareBodiesView,
} from './views-social.js';
import { GoalsView, GoalRouteView } from './views-goals.js';
import { MeRouteView } from './views-me.js';
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
/* 🔄 2026-09-08 — THE FIFTH TAB IS PROFILE, AND CALENDAR WENT BACK INTO DATA.
 *
 * Tim: *"I think we should move the calendar section back to being a tab in the
 * data section, and replace it with a profile section … this section will only
 * show the user's profile picture and their username, as well as the number of
 * workouts, followers, and following at the top."* Plus: *"I want to get rid of
 * the 'You' and 'Friends' tab in the home page."*
 *
 * ⚠️ CALENDAR HAS NOW MOVED THREE TIMES AND EVERY MOVE WAS HIS. Into Data on
 * 2026-08-22 (both are the past), out to its own tab on 2026-08-25 (he opens it
 * often), back into Data today. The 2026-08-25 note said *"that argument was
 * about what the two screens ARE; his is about how often he opens them"* — and
 * what changed today is not the calendar, it is that a Profile section now wants
 * the slot more. `#/calendar` still resolves throughout, which is the rule a tab
 * bar redesign may not break.
 *
 * 🚨 AND HOME LOST ITS SWITCH RATHER THAN LOSING A SCREEN. The You / Friends
 * tabs are gone; Home is the feed, and the Friends list is reached from Profile,
 * where the followers and following counts already point at it. What moved OUT
 * of Friends is the pair of controls that were never about other people at all —
 * your display name and who can see your account — and they are on the Account
 * screen now, with the rest of the logistics. */
const NAV = [
  { hash: '#/home',     label: 'Home',     icon: 'home',     match: ['home'] },
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
  // ⚠️ Calendar's routes light DATA up now, because that is where the calendar
  // lives again. A tab that goes dark while you are plainly still inside it is
  // how a merge starts feeling like a dead end — the same reason Home used to
  // own `social` and `friend`.
  { hash: '#/graphs',   label: 'Data',     icon: 'chart',    match: ['graphs', 'calendar', 'day', 'edit'] },
  // ⚠️ `#/me`, not `#/profile`. `#/profile` is the gender/birth-year/body-weight
  // form and has been for months; it is reached from Account and every link to
  // it still works. Two different screens called Profile is the "system" vs
  // "programme" fault the UX review found, so the ROUTE names are kept distinct
  // even though this tab is the one a person calls their profile.
  { hash: '#/me',       label: 'Profile',  icon: 'person',
    match: ['me', 'social', 'friend', 'invite', 'find', 'add', 'compare'] },
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
// ⚠️ `friend` and `invite` are here but `social` and `me` are NOT, and the line
// moved on 2026-09-08 without moving: it used to read "Social is a tab, and the
// two screens you reach FROM it are not." Social is no longer a tab — PROFILE
// is, and Social is one tap inside it — but it stays out of this list for the
// same practical reason it always was: it is a LIST you browse, and keeping the
// bar means you can leave it for another tab without going back first. The
// screens you reach from a list are the ones that take the screen over.
// `me` is the tab itself; `#/me/friends` and `#/me/workouts` share its route
// name, so they keep the bar too and carry their own back arrow. (`#/me/followers`
// and `#/me/following` are the same list under their old names — 2026-09-09.)
// `goal` and `goals` are the same pair.
// ⚠️ `record` is NOT here — it is a tab now, and a tab that hides the bar it
// lives in cannot be tapped twice. `start` stays: it is the old deep link and
// still opens the picker as a pushed screen with a back button.
// ⚠️ `goals` joined this list on 2026-08-25 when it stopped being a tab. A
// screen with no tab of its own is reached FROM somewhere, so it needs a back
// button, which is what being fullscreen gives it — the same shape as `start`.
const FULLSCREEN = ['session', 'workout', 'system', 'explore', 'benchmark', 'settings', 'day', 'edit', 'start', 'account', 'signin', 'profile', 'friend', 'invite', 'find', 'add', 'goal', 'goals', 'import', 'compare', 'notes'];

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
    // The developer's inbox. Reachable by anybody who types it and empty for
    // everybody but Tim, because firestore.rules refuses the read rather than
    // the router refusing the route (2026-09-04).
    case 'notes':     return NotesView();
    case 'import':    return ImportView();
    case 'signin':    return SignInView();
    case 'profile':   return ProfileView();
    /* ⚠️ `me` IS THE PROFILE TAB AND `profile` IS THE DETAILS FORM. Both keep
     * their own name because both are linked from elsewhere and neither may
     * 404 — see the NAV comment. One route owns the whole section so that
     * #/me/friends and #/me/workouts are sub-screens rather than entries in
     * this table — as are the two names #/me/friends used to have. */
    case 'me':        return MeRouteView(route.param);
    case 'social':    return SocialView();
    case 'goals':     return GoalsView();
    // #/goal/new, #/goal/new/<muscle>, #/goal/stalls, #/goal/systems — the
    // whole tail is passed through and dispatched there, the same way `invite`
    // keeps its two-part parameter together.
    case 'goal':      return GoalRouteView(route.param);
    /* #/friend/<uid> is their page; #/friend/<uid>/<sessionId> is one workout.
     *
     * ⚠️ IT HANGS OFF THE FRIEND ROUTE RATHER THAN BEING A ROUTE OF ITS OWN, and
     * that is worth a line: a session belongs to a person, the nav bar's Home
     * tab already stays lit for `friend`, and FULLSCREEN already lists it — so a
     * second name would have needed both of those updated in lockstep with
     * nothing to catch it if they were not. Same shape as `invite`, which keeps
     * its two-part parameter together for the same reason. */
    case 'friend': {
      const [fuid, sid] = (route.param || '').split('/');
      /* ⚠️ TWO RESERVED SECOND SEGMENTS SINCE 2026-09-03 — `volume` and `graph`,
       * a friend's own version of the Data tab's screens (Tim: *"I also want a
       * friend to be able to see another user's body, their graphs, volume,
       * etc."*). They sit under `friend` for the same reason a session does, and
       * they are checked BEFORE the session branch because a session id is
       * opaque: a workout that happened to be called `volume` is not possible
       * (ids are generated), but reading the check in the other order would make
       * that a question somebody has to answer. */
      /* 🔄 THESE WERE SCREENS OF THEIR OWN AND ARE TABS NOW — 2026-09-05. They
       * still RESOLVE, and open the friend's page on that tab, because the
       * routes were live and this project has not broken a deep link yet
       * (`#/calendar` kept its own through two redesigns). ⚠️ `graph` maps to
       * the tab key `trend`, which is what the Data screen has always called
       * that mode internally. */
      if (sid === 'volume') return FriendView(decodeURIComponent(fuid), 'volume');
      if (sid === 'graph') return FriendView(decodeURIComponent(fuid), 'trend');
      return sid
        ? FriendSessionView(decodeURIComponent(fuid), decodeURIComponent(sid))
        : FriendView(route.param);
    }
    /* Two bodies, side by side — #/compare/<uid> against yourself, or
     * #/compare/<uid>/<uid> for two other people. Tim, 2026-09-03. */
    case 'compare':   return CompareBodiesView(route.param || '');
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
/* ⚠️ WHICH HASH THE LAST RENDER DREW, and it is not the same question as
 * `markRoute()`'s history position. That one answers "where does back go"; this
 * one answers "is this an arrival or a repaint", which is what decides whether
 * the Record panel plays its rise. A re-render in place must not replay it. */
let prevHash = '';

async function render() {
  if (rendering) return;
  rendering = true;

  const app = document.getElementById('app');
  const route = parse(location.hash);

  /* ⚠️ NOTHING IN THIS APP NAVIGATES TO `#/blank` ANY MORE (2026-09-02) — the
   * nine places that used it to force a re-render call `refreshRoute()`, which
   * re-renders in place instead of pushing two history entries. The guard stays
   * because a bookmark or an open tab from before today can still be sitting on
   * one, and rendering nothing is better than falling through to Home. */
  if (route.name === 'blank') { rendering = false; return; }

  // Where this screen sits in the visit, so the back arrow can go BACK rather
  // than to a hard-coded parent. See markRoute() in ui.js.
  markRoute();

  /* 🚨 RECORD RISES OVER WHAT YOU WERE LOOKING AT — 2026-09-09, Tim: *"I want the
   * screen to pull up the record section from the bottom (which covers over the
   * main section display)."*
   *
   * ⚠️ THE OUTGOING SCREEN IS PARKED **BEFORE** `resolve()` IS AWAITED, and the
   * order is the whole trick. `resolve()` reads the store, which may take a
   * frame or fifty; clearing after it and animating the new screen alone would
   * mean the panel rose over an empty ground, and on a slow read the old screen
   * would sit there frozen and then vanish under a panel that had not started
   * moving. Parked first, it is a still picture of where you were for exactly as
   * long as the rise takes, and it is on `document.body`, so `clear(app)` below
   * is untouched and still clears everything it owns.
   *
   * ⚠️ ONLY ON THE WAY IN. Re-rendering Record while already on it — a
   * `refreshRoute()`, a demo toggle — must not replay the animation, or the
   * screen appears to bounce for no reason anybody made happen.
   *
   * 🛑 AND NOTHING AT ALL WITHOUT A BROWSER: `parkScreen()` returns null under
   * reduced motion and in jsdom, so this is dead weight in every test and the
   * router behaves exactly as it did. */
  /* ⚠️ AND NOT ON A COLD OPEN. Landing on `#/record` from a bookmark or a
   * refresh has nothing behind it, and a panel rising over an empty ground
   * claims a screen was covered that never existed — Rule 7's last line, that a
   * movement must not assert something the app does not know. The presence of an
   * outgoing screen IS the question, so it is the condition. */
  const leaving = document.querySelector('#app > .screen');
  const rising = route.name === 'record' && parse(prevHash).name !== 'record' && Boolean(leaving);
  prevHash = location.hash;
  if (rising) parkScreen(leaving);

  try {
    const screen = await resolve(route);
    clear(app);
    if (rising) screen.classList.add('rises');
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
    /* ⚠️ A WORKOUT IN PROGRESS FOLLOWS YOU ROUND THE APP (2026-09-07).
     *
     * Appended INSIDE the screen, as its last child, rather than as a sibling of
     * the navbar — and that is the one decision in this feature worth reading
     * twice. `#app` is `column-reverse` on a phone and `row` on a desktop, so a
     * sibling would be above the nav on one and a third column on the other. The
     * last child of `.screen` is the bottom of the content area in both, which
     * is exactly where Tim asked for it on the phone and the only sane place for
     * it beside a sidebar.
     *
     * The class is what lets the stylesheet stop `.pane-bottom` paying the
     * safe-area inset twice — with a bar under it, the screen is no longer the
     * thing against the bottom of the display. */
    const mini = liveSessionBar({ route: route.name, today: todayISO() });
    if (mini) { screen.classList.add('has-mini'); screen.append(mini); }
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
