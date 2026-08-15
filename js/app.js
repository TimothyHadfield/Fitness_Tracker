// Router + boot.

import { store } from './store.js';
import { el, icon, clear } from './ui.js';
import { HomeView, StartPickerView, WorkoutsView, WorkoutBuilderView } from './views-workouts.js';
import { SessionView, BenchmarkView } from './views-session.js';
import { CalendarView, DayView, GraphView, SettingsView } from './views-data.js';

const NAV = [
  { hash: '#/home',     label: 'Home',     icon: 'home' },
  { hash: '#/workouts', label: 'Workouts', icon: 'dumbbell' },
  { hash: '#/calendar', label: 'Calendar', icon: 'calendar' },
  { hash: '#/graphs',   label: 'Graphs',   icon: 'chart' },
];

// Routes that take over the whole screen (no bottom nav).
const FULLSCREEN = ['session', 'workout', 'benchmark', 'settings', 'day', 'start'];

function parse(hash) {
  const clean = (hash || '').replace(/^#\/?/, '');
  const [name, ...rest] = clean.split('/');
  return { name: name || 'home', param: rest.join('/') };
}

function navbar(active) {
  return el('nav', { class: 'navbar' },
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
})();
