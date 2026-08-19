// Service worker — the thing that makes D6 true.
//
// "Offline-first logging is non-negotiable. Gyms are basements." Without this
// file that was a claim, not a feature: store.js falls back to localStorage
// when the cloud is unreachable, but with no signal the app never BOOTS, so
// that fallback never gets a chance to run. A basement got a blank page.
//
// STRATEGY — deliberately not plain cache-first.
//
//   navigations      network first, cached shell as the fallback
//   same-origin GET  stale-while-revalidate
//   everything else  untouched
//
// Cache-first plus a hand-maintained VERSION is the obvious build, and it has
// a nasty failure mode with no build step: edit app.css, forget to bump the
// version, and every existing install is frozen on the old file forever with
// no way to tell. Stale-while-revalidate cannot do that — the worst case is
// one load of stale assets, and it self-heals on the next.
//
// CROSS-ORIGIN REQUESTS ARE NOT TOUCHED. Firestore streams over long-polling
// and websockets to googleapis.com, and the Firebase SDK is imported from
// gstatic. Intercepting either would be a way to break sync for no benefit;
// when they fail offline, store.js already falls back to this device (D13).

const VERSION = 'v1';
const CACHE = `fitness-tracker-${VERSION}`;

// Everything the app needs to boot with no network. Kept in agreement with the
// repo by a test — see "the precache list covers every shipped asset" in
// tests/data-layer.test.mjs, which fails if a file is added and not listed.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/app.css',
  './img/ink-front.webp',
  './img/ink-back.webp',
  './js/app.js',
  './js/body-art.js',
  './js/body-map.js',
  './js/e1rm.js',
  './js/exercises.js',
  './js/firebase-backend.js',
  './js/firebase-config.js',
  './js/store.js',
  './js/strength-standards.js',
  './js/strength-estimate.js',
  './js/muscle-evidence.js',
  './js/preset-systems.js',
  './js/next-workout.js',
  './js/set-types.js',
  './js/optimal.js',
  './js/social.js',
  './js/goals.js',
  './js/progression.js',
  './js/demo.js',
  './js/volume-map.js',
  './js/views-social.js',
  './js/views-goals.js',
  './js/units.js',
  './js/ui.js',
  './js/views-account.js',
  './js/views-data.js',
  './js/views-edit-session.js',
  './js/views-muscles.js',
  './js/views-profile.js',
  './js/views-session.js',
  './js/views-workouts.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Individually, not addAll: addAll is atomic, so one 404 throws away the
    // whole precache and the install fails silently for every other file.
    await Promise.all(SHELL.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        console.warn('[sw] could not precache', url, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('fitness-tracker-') && n !== CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  // Escape hatch. If a future version of this file ever ships broken, the page
  // can tell it to stand down rather than the install being stuck forever.
  if (e.data === 'unregister') {
    self.registration.unregister().then(() => caches.delete(CACHE));
  }
  // The page asking on boot, because the update may have been spotted before
  // it was listening. See the note on `sawUpdate`.
  if (e.data === 'has-update' && sawUpdate && e.source) {
    e.source.postMessage('assets-updated');
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firestore, gstatic

  // The app is a hash router, so every navigation is the same document. Prefer
  // the network so a deploy lands promptly, and fall back to the shell — that
  // fallback is the whole point of the file.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html'))
          || (await cache.match('./'))
          || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const spawn = fetch(req).then((res) => {
      // Only store real, complete responses. An opaque or partial one cached
      // here would be served back as a corrupt asset later.
      if (res && res.ok && res.type === 'basic') {
        // ⚠️ The cost of stale-while-revalidate, and it is not theoretical.
        // This load is being served the OLD file while the new one downloads
        // behind it, so a change that shipped minutes ago is invisible until
        // the next load. Tim hit exactly this: a rating showed on one screen
        // and not another, because both live in the same file and he had the
        // previous version of it. That reads as a broken feature and is not.
        //
        // So: notice when the file that just arrived differs from the one we
        // served, and tell the page. The page decides what to do about it —
        // a service worker must never reload somebody mid-set.
        if (hit && isDifferent(hit, res)) announceUpdate();
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);

    if (hit) return hit;                    // instant, and works with no signal
    const fresh = await spawn;
    return fresh || Response.error();
  })());
});

/**
 * Has this asset actually changed?
 *
 * ETag first — GitHub Pages sends a strong one and it is exact. Last-Modified
 * is the fallback. If neither header is present we say NO rather than yes: a
 * false positive here nags the user on every single load, which is worse than
 * missing an update they will pick up on the next visit anyway.
 */
function isDifferent(cached, fresh) {
  const tag = (r) => r.headers.get('etag');
  const mod = (r) => r.headers.get('last-modified');
  if (tag(cached) && tag(fresh)) return tag(cached) !== tag(fresh);
  if (mod(cached) && mod(fresh)) return mod(cached) !== mod(fresh);
  return false;
}

// ⚠️ A FLAG, not just a broadcast, and that distinction is the whole thing
// working or not.
//
// The stylesheet and app.js are fetched from <head>, long before app.js has
// booted and attached its listener — so a broadcast at that moment is shouted
// into an empty room and the user never hears about the update that triggered
// it. The lazily-imported view modules are the opposite: they load well after
// boot, so a broadcast reaches them fine.
//
// Both paths are needed. The flag survives the race; the broadcast catches the
// later ones without the page having to poll.
let sawUpdate = false;
async function announceUpdate() {
  if (sawUpdate) return;      // a deploy changes a dozen files; say it once
  sawUpdate = true;
  const windows = await self.clients.matchAll({ type: 'window' });
  for (const c of windows) c.postMessage('assets-updated');
}
