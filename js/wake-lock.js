/* ------------------------------------------------------------------ *
 * Keep the screen on while a workout is running — 2026-09-27 (overhaul ST-8 / R-6).
 *
 * The phone dimming mid-set means unlocking it with chalky hands between every
 * set. While the runner (list or Auto-guide) is open on a live workout, ask the
 * browser for a screen wake lock. Settings → "Keep screen on"
 * (`settings.keepAwake`, on unless it is `false`) turns it off.
 *
 * ⚠️ The browser drops the lock by itself whenever the page is hidden (app
 * switch, lock button), so it is asked for again on `visibilitychange` while
 * still wanted. Where the API does not exist (older iOS, http) every call is a
 * silent no-op — nothing to show, nothing to break.
 * ------------------------------------------------------------------ */

let sentinel = null;
let wanted = false;
let asking = null;
let listening = false;

function supported() {
  return typeof navigator !== 'undefined' && navigator.wakeLock && typeof navigator.wakeLock.request === 'function';
}

async function acquire() {
  if (!wanted || sentinel || asking || !supported()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  asking = (async () => {
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!wanted) { try { await s.release(); } catch (_) {} return; }
      sentinel = s;
      try { s.addEventListener('release', () => { if (sentinel === s) sentinel = null; }); } catch (_) {}
    } catch (_) { /* refused (low battery, not visible) — fine */ }
  })();
  try { await asking; } finally { asking = null; }
}

function onVisible() {
  if (document.visibilityState === 'visible' && wanted) acquire();
}

/** Turn the screen wake lock on or off. Safe to call repeatedly. */
export function keepAwake(on) {
  wanted = !!on;
  if (!supported()) return;
  if (wanted) {
    if (!listening && typeof document !== 'undefined') { document.addEventListener('visibilitychange', onVisible); listening = true; }
    acquire();
  } else {
    if (listening) { document.removeEventListener('visibilitychange', onVisible); listening = false; }
    const s = sentinel; sentinel = null;
    if (s) { try { s.release(); } catch (_) {} }
  }
}

/** For tests: is the lock held right now. */
export function isAwake() { return !!sentinel; }
