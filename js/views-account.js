// Account screen.
//
// Model: anonymous first, upgrade later. Someone can log a whole workout before
// ever seeing this screen. What they get here is the ability to make that data
// survive losing the phone.
//
// The one thing this screen must never do is imply data is safe when it isn't.
// An anonymous account lives in one browser and nothing recovers it — clearing
// site data destroys it permanently. That is stated plainly rather than buried.

import { store, auth, probeOffline, demo } from './store.js';
import { el, screenShell, toast, confirmSheet, emptyState, openSheet } from './ui.js';

const go = (hash) => { location.hash = hash; };

/* ------------------------------------------------------------------ *
 * The demo account
 *
 * Tim, 2026-08-19: he cannot judge screens he has no data for, and recording a
 * year of training by hand to find out is not a reasonable ask.
 *
 * It sits on the Account screen and on EVERY variant of it — signed in,
 * anonymous, offline, and cloud-not-configured. Looking around is not a thing
 * you should have to have an account to do, and the offline branch is the one
 * where somebody most wants something to look at.
 * ------------------------------------------------------------------ */

function demoCard() {
  if (!demo.available()) return null;

  return el('div', { class: 'card' },
    el('div', { class: 'section-label', text: 'Just looking around' }),
    el('div', { class: 'field-help' },
      'The demo account is a made-up year of training — two programmes, a few hundred sessions, '
      + 'benchmarks, body weight and a goal in progress. Every screen fills in, so you can see what '
      + 'the app looks like in use without logging any of it yourself.'),
    // Said before they tap it, not after. The two facts somebody needs in
    // advance are that their own data is safe and that theirs is not what they
    // will be looking at.
    el('div', { class: 'field-help' },
      'Change anything you like in there — it only lives in this tab, nothing is saved, and it '
      + 'starts fresh every time. Your own data is untouched and waiting when you come back.'),
    el('button', {
      class: 'btn primary block', text: 'View demo account',
      onClick: () => demo.enter(),
    }),
  );
}

/** What the Account screen becomes while the demo is on. */
function demoScreen() {
  return screenShell({
    title: 'Account',
    back: () => go('#/settings'),
    scroll: [
      el('div', { class: 'card' },
        el('div', { class: 'section-label', text: 'You are in the demo account' }),
        el('div', { class: 'field-help' },
          'None of this is real. It is a generated year of training so that every screen has '
          + 'something in it — the systems, the calendar, the graphs, the muscle map and the goal '
          + 'are all built from it.'),
        el('div', { class: 'field-help' },
          'Nothing here is saved anywhere. Edit a workout, delete a system, log a session — it '
          + 'lives in this tab and nowhere else, and reloading the page starts it over from the '
          + 'same beginning.'),
        // Named rather than left to be discovered. Somebody who taps Social and
        // finds it refused should already know why.
        el('div', { class: 'field-help' },
          'Social is switched off while you are in here, because publishing invented workouts to '
          + 'real friends would be worse than not being able to try it.'),
      ),
      el('button', {
        class: 'btn primary block', text: 'Leave the demo',
        onClick: () => demo.exit(),
      }),
      el('div', { class: 'field-help', style: 'text-align:center' },
        'Your own account and everything in it is exactly where you left it.'),
    ],
  });
}

function refresh() {
  const h = location.hash;
  location.hash = '#/blank';
  setTimeout(() => { location.hash = h; }, 0);
}

// Firebase reports its own errors; anything else gets a generic line.
async function run(button, label, fn) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    await fn();
  } catch (err) {
    const { authErrorMessage } = await import('./firebase-backend.js');
    toast(authErrorMessage(err));
    button.disabled = false;
    button.textContent = original;
    return false;
  }
  return true;
}

export async function AccountView() {
  // Before anything asks the account a question. In the demo there is no
  // account to ask about, and every control on the normal screen — upload,
  // sign out, delete — would be either meaningless or alarming.
  if (demo.active()) return demoScreen();

  const state = await auth.state();

  if (!auth.configured()) {
    return screenShell({
      title: 'Account',
      back: () => go('#/settings'),
      scroll: [
        emptyState(
          'Accounts are not switched on yet',
          'This app stores everything in this browser. Cloud accounts need a Firebase project — see docs/firebase-setup.md. Until then, use Download backup in Settings to keep a copy.',
          el('a', { class: 'btn primary', href: '#/settings', text: 'Back to settings' }),
        ),
        demoCard(),
      ],
    });
  }

  if (state.mode === 'local') return offlineScreen(state);

  const user = state.user || {};
  return user.isAnonymous ? anonymousScreen() : signedInScreen(user);
}

/* ------------------------------------------------------------------ *
 * Configured, but the cloud is not reachable
 *
 * The version of this screen that led with "your account could not be reached"
 * and then printed a raw module-import URL sent Tim looking for a bug in the
 * app when his wi-fi was off. Three things it now gets right: it names the
 * likely cause, it does not imply the account itself is broken or gone, and
 * the technical string is available but is not the headline.
 * ------------------------------------------------------------------ */

function offlineScreen(state) {
  // Framed as a CONNECTION problem in both branches. The failure that lands
  // anyone here is an SDK that would not load, which is essentially always
  // connectivity — leading with "your account" sent Tim looking for a bug in
  // the app when his wi-fi was off.
  const OFFLINE = {
    heading: 'You’re offline',
    body: 'This device has no internet connection, so the app can’t reach your account right '
      + 'now. Keep logging — everything is saved here and uploads by itself when you’re '
      + 'back online.',
  };
  const UNREACHABLE = {
    heading: 'Can’t connect',
    body: 'The app can’t reach the network at the moment. This is a connection problem rather '
      + 'than anything wrong with your account. Keep logging — everything is saved on this '
      + 'device and uploads once the connection returns.',
  };

  const headingEl = el('div', { class: 'section-label' });
  const status = el('div', { class: 'field-help' });
  const paint = (copy) => { headingEl.textContent = copy.heading; status.textContent = copy.body; };
  paint(state.offline ? OFFLINE : UNREACHABLE);

  // navigator.onLine says "true" for a captive portal or a dead upstream, so
  // confirm by actually asking the network and correct the wording if it
  // disagrees. Rendered first and refined after, rather than blocking on it.
  if (!state.offline) {
    probeOffline().then((reallyOffline) => {
      if (reallyOffline && headingEl.isConnected) paint(OFFLINE);
    }).catch(() => {});
  }

  const retryBtn = el('button', { class: 'btn primary block', text: 'Try again' });

  async function attempt(auto) {
    retryBtn.disabled = true;
    retryBtn.textContent = 'Checking…';
    const next = await auth.retry();
    if (next.mode === 'cloud') { refresh(); return; }
    retryBtn.disabled = false;
    retryBtn.textContent = 'Try again';
    // Saying "still offline" is the point: the old button reloaded the page and
    // showed the identical error, which read as the button doing nothing.
    if (!auto) {
      const reallyOffline = next.offline || await probeOffline();
      status.textContent = reallyOffline
        ? 'Still offline. Check your wi-fi or mobile data, then try again.'
        : 'Still can’t connect. It may be a moment before it comes back.';
    }
  }
  retryBtn.addEventListener('click', () => attempt(false));

  // Coming back online is the common ending, so take it without being asked.
  const onOnline = () => attempt(true);
  window.addEventListener('online', onOnline);
  setTimeout(() => {
    if (!retryBtn.isConnected) window.removeEventListener('online', onOnline);
  }, 0);

  return screenShell({
    title: 'Account',
    back: () => go('#/settings'),
    scroll: [
      el('div', { class: 'card' },
        headingEl,

        // You have NOT been signed out — the app simply cannot ask who you are.
        // Saying so is the difference between "my account is gone" and "I'm on
        // a bad connection".
        state.lastAccount && state.lastAccount.email
          ? el('div', { class: 'field-help' },
              'You’re still signed in as ',
              el('b', { text: state.lastAccount.email }),
              '. You haven’t been signed out — the app just can’t check right now.')
          : null,

        status,

        el('div', { class: 'field-help' },
          'Your workouts are safe either way. Settings → Download backup keeps a copy on this device.'),

        retryBtn,
        el('a', { class: 'btn block', href: '#/settings', text: 'Back to settings' }),

        // Kept, because it is what makes a real fault diagnosable — just not as
        // the first thing a user reads. Always available, never expanded: the
        // problem was never that this string existed, it was that it was the
        // headline.
        state.error
          ? el('details', { class: 'tech-detail' },
              el('summary', { text: 'Technical detail' }),
              el('div', { class: 'field-help mono', text: state.error }))
          : null,
      ),

      // Offered here too, and this is the branch where it is most wanted: no
      // connection, nothing to sign into, and nothing to look at either.
      demoCard(),
    ],
  });
}

/* ------------------------------------------------------------------ *
 * The Google button
 *
 * Shared by both screens because the failure handling is the fiddly part and
 * having two copies of it is how they drift.
 *
 * A cancelled popup must never look like a dead button. Firebase raises
 * auth/popup-closed-by-user both when a person closes the window AND when the
 * SDK loses its handle on it (Cross-Origin-Opener-Policy), so "cancelled" is
 * not reliably a decision — but auto-redirecting on it would yank someone to
 * Google the instant they backed out on purpose. So: say what happened, and
 * offer the redirect as one tap rather than taking it for them.
 * ------------------------------------------------------------------ */

function googleButton({ label, className, onDone }) {
  const btn = el('button', { class: className, text: label });
  const escape = el('button', {
    class: 'btn block', hidden: true,
    text: 'Continue in this window instead',
    onClick: async () => {
      // Redirect only — no popup to block. This is the route that always works.
      await run(escape, 'Redirecting…', () => auth.signInGoogle({ forceRedirect: true }));
    },
  });

  btn.addEventListener('click', async () => {
    let cancelled = false;
    const ok = await run(btn, 'Opening…', async () => {
      const res = await auth.signInGoogle();
      if (res && res.status === 'cancelled') {
        cancelled = true;
        toast('Sign-in window closed before finishing');
        escape.hidden = false;
        return;
      }
      if (res && res.status === 'signed-in') toast('Account secured');
    });

    if (cancelled) {
      // run() hands the button back only when fn THROWS, on the assumption that
      // success navigates away. A cancelled sign-in does neither, so without
      // this the button sits on "Opening…" for good — which is the dead button
      // all over again, one layer up.
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    // 'redirecting' navigates away, so nothing after this runs in that case.
    if (ok) onDone();
  });

  return { btn, escape };
}

/* ------------------------------------------------------------------ *
 * Anonymous — the upgrade path
 * ------------------------------------------------------------------ */

function anonymousScreen() {
  const email = el('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'At least 6 characters' });

  const google = googleButton({
    label: 'Continue with Google',
    className: 'btn primary block',
    onDone: refresh,
  });
  const googleBtn = google.btn;

  const createBtn = el('button', {
    class: 'btn block',
    text: 'Create account',
    onClick: async () => {
      const e = email.value.trim(), p = password.value;
      if (!e || !p) { toast('Enter an email and a password'); return; }
      const ok = await run(createBtn, 'Creating…', async () => {
        await auth.signUpEmail(e, p);
        toast('Account secured');
      });
      if (ok) refresh();
    },
  });

  return screenShell({
    title: 'Account',
    back: () => go('#/settings'),
    scroll: [
      el('div', { class: 'card' },
        el('div', { class: 'section-label', text: 'Your data is not backed up' }),
        el('div', { class: 'field-help' },
          'Everything you have logged lives only in this browser. If you clear your browsing data, '
          + 'switch phones, or lose this device, it is gone and cannot be recovered.'),
        el('div', { class: 'field-help' },
          'Adding an email or Google account keeps everything you have already logged — it is '
          + 'attached to the account, not replaced by it.'),
      ),

      googleBtn,
      google.escape,

      el('div', { class: 'or-rule' }, el('span', { text: 'or' })),

      el('div', { class: 'card' },
        el('div', { class: 'field' }, el('label', { text: 'Email' }), email),
        el('div', { class: 'field' }, el('label', { text: 'Password' }), password),
        createBtn,
      ),

      el('div', { class: 'field-help', style: 'text-align:center' },
        'Already have an account? '),
      el('button', {
        class: 'btn ghost block',
        text: 'Sign in instead',
        onClick: () => go('#/signin'),
      }),

      el('div', { class: 'or-rule' }, el('span', { text: 'or' })),
      demoCard(),
    ],
  });
}

/* ------------------------------------------------------------------ *
 * Signed in
 * ------------------------------------------------------------------ */

async function signedInScreen(user) {
  const local = await auth.localRowCounts();
  const localTotal = Object.values(local).reduce((n, v) => n + v, 0);
  // Only an email/password account has a password to change. A Google account
  // has nothing here to adjust — its details live in the Google account.
  const hasPassword = (user.providers || []).includes('password');

  const deleteBtn = el('button', {
    class: 'btn danger block',
    text: 'Delete account',
    onClick: () => {
      // Requires the password because it is irreversible, and because Firebase
      // refuses the operation on a stale session anyway.
      const pw = hasPassword
        ? el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password' })
        : null;

      let handle = null;
      const confirmBtn = el('button', {
        class: 'btn danger block',
        text: 'Delete everything permanently',
        onClick: async () => {
          if (hasPassword && !pw.value) { toast('Enter your password'); return; }
          const ok = await run(confirmBtn, 'Deleting…', async () => {
            await auth.deleteAccount(pw ? pw.value : null);
            toast('Account deleted');
          });
          if (ok) { if (handle) handle.close(); go('#/home'); }
        },
      });

      handle = openSheet({
        title: 'Delete your account?',
        body: el('div', { class: 'card' },
          el('p', { class: 'field-help' },
            'This erases every workout, record, benchmark and custom exercise from your account, '
            + 'permanently, on every device. It cannot be undone. Download a backup first if there '
            + 'is any chance you want this data later.'),
          pw ? el('div', { class: 'field' }, el('label', { text: 'Confirm your password' }), pw) : null,
        ),
        footer: confirmBtn,
      });
    },
  });

  const uploadBtn = localTotal
    ? el('button', {
        class: 'btn primary block',
        text: `Upload ${localTotal} item${localTotal === 1 ? '' : 's'} from this device`,
        onClick: async () => {
          const ok = await run(uploadBtn, 'Uploading…', async () => {
            const report = await auth.uploadLocalData();
            const added = Object.values(report).reduce((n, v) => n + v, 0);
            toast(added ? `${added} added to your account` : 'Already up to date');
          });
          if (ok) refresh();
        },
      })
    : null;

  const signOutBtn = el('button', {
    class: 'btn ghost block',
    text: 'Sign out',
    onClick: () => confirmSheet({
      title: 'Sign out?',
      message: 'Your data stays in your account. This device will start a fresh empty session until you sign back in.',
      confirmLabel: 'Sign out',
      danger: false,
      onConfirm: async () => {
        const ok = await run(signOutBtn, 'Signing out…', async () => {
          await auth.signOut();
          toast('Signed out');
        });
        if (ok) go('#/home');
      },
    }),
  });

  return screenShell({
    title: 'Account',
    back: () => go('#/settings'),
    scroll: [
      el('div', { class: 'card' },
        el('div', { class: 'section-label', text: 'Signed in' }),
        el('div', { class: 'row-title', text: user.email || 'Google account' }),
        el('div', { class: 'field-help' },
          'Your workouts sync to this account and are available on any device you sign in on. '
          + 'Logging still works with no signal — it uploads when you reconnect.'),
      ),

      localTotal
        ? el('div', { class: 'card' },
            el('div', { class: 'section-label', text: 'Left on this device' }),
            el('div', { class: 'field-help' },
              'Some data was logged on this device before you signed in. Uploading merges it into '
              + 'your account and never overwrites anything already there.'),
            uploadBtn,
          )
        : null,

      demoCard(),

      el('div', { class: 'section-label', text: 'Account' }),
      hasPassword ? passwordCard() : null,
      signOutBtn,
      deleteBtn,
    ],
  });
}

/* ---- change password (email accounts only) ---- */

function passwordCard() {
  const current = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Current password' });
  const next = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'New password, 6+ characters' });

  const saveBtn = el('button', {
    class: 'btn block',
    text: 'Change password',
    onClick: async () => {
      if (!current.value || !next.value) { toast('Fill in both passwords'); return; }
      if (next.value.length < 6) { toast('Use at least 6 characters'); return; }
      const ok = await run(saveBtn, 'Saving…', async () => {
        await auth.changePassword(current.value, next.value);
        toast('Password changed');
      });
      if (ok) { current.value = ''; next.value = ''; saveBtn.disabled = false; saveBtn.textContent = 'Change password'; }
    },
  });

  return el('div', { class: 'card' },
    el('div', { class: 'field' }, el('label', { text: 'Current password' }), current),
    el('div', { class: 'field' }, el('label', { text: 'New password' }), next),
    saveBtn,
  );
}

/* ------------------------------------------------------------------ *
 * Sign in to an existing account
 * ------------------------------------------------------------------ */

export async function SignInView() {
  if (!auth.configured()) return AccountView();

  const state = await auth.state();
  const wasAnonymous = state.mode === 'cloud' && state.user && state.user.isAnonymous;
  const hasLocal = Object.values(await auth.localRowCounts()).reduce((n, v) => n + v, 0);

  const email = el('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Password' });

  const signInBtn = el('button', {
    class: 'btn primary block',
    text: 'Sign in',
    onClick: async () => {
      const e = email.value.trim(), p = password.value;
      if (!e || !p) { toast('Enter your email and password'); return; }
      const ok = await run(signInBtn, 'Signing in…', async () => {
        await auth.signInEmail(e, p);
        toast('Signed in');
      });
      if (ok) go('#/account');
    },
  });

  const google = googleButton({
    label: 'Continue with Google',
    className: 'btn block',
    onDone: () => go('#/account'),
  });
  const googleBtn = google.btn;

  const resetBtn = el('button', {
    class: 'btn ghost block',
    text: 'Send a password reset email',
    onClick: async () => {
      const e = email.value.trim();
      if (!e) { toast('Enter your email first'); return; }
      await run(resetBtn, 'Sending…', async () => {
        await auth.sendPasswordReset(e);
        toast('Reset email sent');
      });
      resetBtn.disabled = false;
      resetBtn.textContent = 'Send a password reset email';
    },
  });

  return screenShell({
    title: 'Sign in',
    back: () => go('#/account'),
    scroll: [
      // Signing in to a DIFFERENT account switches uid, so anything logged
      // anonymously on this device stops being reachable. Say it before, not after.
      wasAnonymous && hasLocal
        ? el('div', { class: 'card' },
            el('div', { class: 'section-label', text: 'Before you sign in' }),
            el('div', { class: 'field-help' },
              `This device has ${hasLocal} item${hasLocal === 1 ? '' : 's'} logged without an account. `
              + 'Signing in to an existing account will show that account\'s data instead. To keep '
              + 'what is on this device, go back and create an account from it rather than signing in.'),
          )
        : null,

      el('div', { class: 'card' },
        el('div', { class: 'field' }, el('label', { text: 'Email' }), email),
        el('div', { class: 'field' }, el('label', { text: 'Password' }), password),
        signInBtn,
      ),

      el('div', { class: 'or-rule' }, el('span', { text: 'or' })),
      googleBtn,
      google.escape,
      resetBtn,
    ],
  });
}
