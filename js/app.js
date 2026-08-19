// Router + boot.

import { store } from './store.js';
import { el, icon, iconBtn, clear, profileButton } from './ui.js';
import {
  HomeView, StartPickerView, WorkoutsView, SystemView, WorkoutBuilderView,
  ExploreView, ExploreDetailView,
} from './views-workouts.js';
import { SessionView, BenchmarkView } from './views-session.js';
import { CalendarView, DayView, GraphView, SettingsView } from './views-data.js';
import { AccountView, SignInView } from './views-account.js';
import { ProfileView } from './views-profile.js';
import { EditSessionView } from './views-edit-session.js';
import { SocialView, FriendView, InviteView } from './views-social.js';
import { GoalsView, GoalRouteView } from './views-goals.js';
import { setUnits } from './units.js';

const NAV = [
  { hash: '#/home',     label: 'Home',     icon: 'home' },
  { hash: '#/workouts', label: 'Workouts', icon: 'dumbbell' },
  { hash: '#/calendar', label: 'Calendar', icon: 'calendar' },
  // Route stays #/graphs; only the label changed. Renaming the hash would
  // break nothing visible and churn the router for no user-facing gain.
  { hash: '#/graphs',   label: 'Data',     icon: 'chart' },
  // Goals sits between Data and Social on purpose: it is about your own
  // training, like everything to its left, and Social is the only tab that is
  // about anybody else. It goes here rather than at the end so the boundary in
  // the bar matches the boundary in the app.
  { hash: '#/goals',    label: 'Goals',    icon: 'target' },
  { hash: '#/social',   label: 'Social',   icon: 'people' },
];

// Routes that take over the whole screen (no bottom nav).
// `friend` and `invite` are here but `social` is NOT: Social is a tab, and the
// two screens you reach FROM it are not. `goal` and `goals` are the same pair.
const FULLSCREEN = ['session', 'workout', 'system', 'explore', 'benchmark', 'settings', 'day', 'edit', 'start', 'account', 'signin', 'profile', 'friend', 'invite', 'goal'];

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
        'aria-current': n.hash === '#/' + active ? 'page' : null,
      }, icon(n.icon), el('span', { text: n.label }))),
  );
}

async function resolve(route) {
  switch (route.name) {
    case 'home':      return HomeView();
    case 'start':     return StartPickerView();
    case 'workouts':  return WorkoutsView();
    case 'system':    return SystemView(route.param);
    // #/explore lists them, #/explore/<id> is one of them.
    case 'explore':   return route.param ? ExploreDetailView(route.param) : ExploreView();
    case 'workout':   return WorkoutBuilderView(route.param);
    case 'session':   return SessionView(route.param);
    case 'benchmark': return BenchmarkView();
    case 'calendar':  return CalendarView();
    case 'day':       return DayView(route.param);
    case 'edit':      return EditSessionView(route.param);
    case 'graphs':    return GraphView();
    case 'settings':  return SettingsView();
    case 'account':   return AccountView();
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
    default:          return HomeView();
  }
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
    app.append(screen);
  } catch (err) {
    console.error(err);
    clear(app);
    app.append(el('div', { class: 'screen no-nav' },
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

(async function boot() {
  const settings = await store.getSettings();
  document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : 'dark');
  // Seeded once, here, because the stepper and the set formatter are synchronous
  // and are called mid-render — they cannot await the store for the unit.
  setUnits(settings.units);
  if (!location.hash) location.hash = '#/home';
  await render();
  registerServiceWorker();
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
