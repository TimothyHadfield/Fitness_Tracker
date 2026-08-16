// Router + boot.

import { store } from './store.js';
import { el, icon, clear, profileButton } from './ui.js';
import { HomeView, StartPickerView, WorkoutsView, WorkoutBuilderView } from './views-workouts.js';
import { SessionView, BenchmarkView } from './views-session.js';
import { CalendarView, DayView, GraphView, SettingsView } from './views-data.js';
import { AccountView, SignInView } from './views-account.js';
import { ProfileView } from './views-profile.js';

const NAV = [
  { hash: '#/home',     label: 'Home',     icon: 'home' },
  { hash: '#/workouts', label: 'Workouts', icon: 'dumbbell' },
  { hash: '#/calendar', label: 'Calendar', icon: 'calendar' },
  // Route stays #/graphs; only the label changed. Renaming the hash would
  // break nothing visible and churn the router for no user-facing gain.
  { hash: '#/graphs',   label: 'Data',     icon: 'chart' },
];

// Routes that take over the whole screen (no bottom nav).
const FULLSCREEN = ['session', 'workout', 'benchmark', 'settings', 'day', 'start', 'account', 'signin', 'profile'];

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
    case 'workout':   return WorkoutBuilderView(route.param);
    case 'session':   return SessionView(route.param);
    case 'benchmark': return BenchmarkView();
    case 'calendar':  return CalendarView();
    case 'day':       return DayView(route.param);
    case 'graphs':    return GraphView();
    case 'settings':  return SettingsView();
    case 'account':   return AccountView();
    case 'signin':    return SignInView();
    case 'profile':   return ProfileView();
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
}
