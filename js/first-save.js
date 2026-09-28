// "Keep your training" — the one account nudge, after the FIRST saved workout.
// Overhaul O-13, 2026-09-27.
//
// WHY THEN AND NOT ON DAY ONE: D12 forbids a sign-up wall before someone has
// logged anything. But an anonymous account lives in one browser, and iOS Safari
// (a tab, not the home-screen app) can clear a site's storage after about a week
// without a visit — taking that account with it. The first saved workout is the
// moment there is something to lose, so this is when it is said, once.
//
// The runner calls `maybeFirstSaveNudge()` after a save (wave 2). It decides
// everything itself and never throws: a nudge that fails must not touch a save.
//
//   shown once per browser (`ftrack:v1:saved-nudge`), never in the demo,
//   only to an anonymous cloud account, only when this is its first workout.

import { el, openSheet, toast, icon } from './ui.js';
import { store, demo, auth } from './store.js';

export const NUDGE_KEY = 'ftrack:v1:saved-nudge';

export const NUDGE = {
  title: 'Keep your training',
  google: 'Continue with Google',
  email: 'Use email',
  later: 'Later',
  ios: 'Add to Home Screen: tap Share, then Add to Home Screen.',
};

/**
 * iOS Safari in an ordinary tab (not the installed home-screen app) — the one
 * place storage is evicted and the one place "Add to Home Screen" is the fix.
 * iPadOS reports itself as a Mac, so a Mac with a touch screen counts too.
 */
export function isIosSafariTab(nav = globalThis.navigator, win = globalThis) {
  try {
    const ua = String((nav && nav.userAgent) || '');
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1);
    if (!ios) return false;
    // Chrome, Firefox and Edge on iOS cannot add to the home screen the same way.
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return false;
    const standalone = nav.standalone === true
      || Boolean(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches);
    return !standalone;
  } catch (_) { return false; }
}

/**
 * Should the nudge show now? Pure given its deps, so it is tested in Node.
 * Marks the flag when the answer can never become yes (a real account, or a
 * second workout already), so it is not asked again on every save.
 */
export async function shouldNudge(deps = {}) {
  const d = {
    storage: globalThis.localStorage,
    demoActive: () => demo.active(),
    authState: () => auth.state(),
    getSessions: () => store.getSessions(),
    ...deps,
  };
  const mark = () => { try { d.storage.setItem(NUDGE_KEY, new Date().toISOString()); } catch (_) { /* private mode */ } };
  try {
    if (d.storage.getItem(NUDGE_KEY)) return false;
    if (d.demoActive()) return false;
    const st = await d.authState();
    // Not connected (offline, local-only): no account can be made right now.
    // Asked again after the next save — which is then not the first, so never.
    if (!st || st.mode !== 'cloud' || !st.user) return false;
    if (!st.user.isAnonymous) { mark(); return false; }
    const sessions = await d.getSessions();
    if ((sessions || []).length > 1) { mark(); return false; }
    return (sessions || []).length === 1;
  } catch (_) {
    return false;
  }
}

/** After a saved workout. Resolves true when the sheet was shown. */
export async function maybeFirstSaveNudge(deps = {}) {
  if (typeof document === 'undefined') return false;
  if (!(await shouldNudge(deps))) return false;
  try { (deps.storage || globalThis.localStorage).setItem(NUDGE_KEY, new Date().toISOString()); } catch (_) { /* private mode */ }
  openNudge({ ios: deps.ios != null ? deps.ios : isIosSafariTab() });
  return true;
}

/** The sheet itself. Exported for screenshots and tests. */
export function openNudge({ ios = false } = {}) {
  let sheet = null;
  const googleBtn = el('button', {
    class: 'btn primary block', text: NUDGE.google,
    onClick: async () => {
      googleBtn.disabled = true;
      googleBtn.textContent = 'Opening…';
      try {
        const res = await auth.signInGoogle();
        if (res && res.status === 'signed-in') {
          toast(res.created ? 'Account secured' : 'Signed in');
          sheet.close();
          return;
        }
        if (res && res.status === 'redirecting') return;
        // Cancelled: the Account screen has the full set of ways through.
        sheet.close();
        location.hash = '#/account';
      } catch (_) {
        sheet.close();
        location.hash = '#/account';
      }
    },
  });
  const body = el('div', { class: 'first-save' },
    el('div', { class: 'first-save-actions' },
      googleBtn,
      el('button', {
        class: 'btn block', text: NUDGE.email,
        onClick: () => { sheet.close(); location.hash = '#/account'; },
      }),
      el('button', { class: 'btn ghost block', text: NUDGE.later, onClick: () => sheet.close() }),
    ),
    ios
      ? el('p', { class: 'first-save-ios field-help' }, icon('share', 16), ' ', NUDGE.ios)
      : null,
  );
  sheet = openSheet({ title: NUDGE.title, body });
  return sheet;
}
