# Firebase setup

**Project `fitness-tracker-th` is live.** Created, configured, and deployed on 2026-08-15 using the
Firebase CLI and the Google Cloud admin APIs.

Console: https://console.firebase.google.com/project/fitness-tracker-th/overview

---

## Done

| Step | State |
|---|---|
| Google Cloud + Firebase project `fitness-tracker-th` | ✅ created |
| Web app registered (`1:877939637752:web:d1c03f6048454c19412a0d`) | ✅ created |
| SDK config pasted into `js/firebase-config.js` | ✅ done |
| APIs enabled — firestore, identitytoolkit, firebaserules | ✅ enabled |
| Firestore database, **us-central1** | ✅ created |
| `firestore.rules` compiled and deployed | ✅ live |
| Rules verified enforcing against unauthenticated callers | ✅ 3/3 denied |
| `.firebaserc` so deploys don't need `--project` | ✅ added |

Redeploy rules after any edit with:

```
firebase deploy --only firestore:rules
```

---

## Authentication — live

Tim enabled Email/Password in the console on 2026-08-15 (the one step that cannot be automated —
the only public provisioning API, `identityPlatform:initializeAuth`, is the *paid* Identity Platform
upgrade and returns `BILLING_NOT_ENABLED` on Spark; the legacy config endpoints are retired). The
rest was then done over the Identity Toolkit admin API:

| Provider / setting | State |
|---|---|
| Email/Password | ✅ enabled (console) |
| Anonymous | ✅ enabled (API) |
| Authorised domains | ✅ `localhost`, `fitness-tracker-th.firebaseapp.com`, `fitness-tracker-th.web.app`, **`timothyhadfield.github.io`** |
| Google | ✅ enabled (console) — in use, and Tim has signed in with it |

### Google sign-in — done, and the trap it left behind

Enabling it was the one piece the API could not do: it needs an OAuth client ID and secret the
console auto-provisions but the API makes you supply. **It has been done**, and Tim uses it — he
reported a bug in it on 2026-08-16, which is how we know it is live.

⚠️ **This section said "not enabled" for a day after it was enabled**, and `progress.md` carried a
note pointing out that this file was wrong. A doc that is known-wrong with the correction filed
somewhere else is worse than one that is simply out of date, because it teaches the reader to
distrust the file rather than to fix it.

Two things learned from real use, both now in the code and in `progress.md` §9: **exactly one popup,
ever** — recovering from "that account already exists" reuses the credential from the failed link
rather than opening a second window the browser blocks — and **a cancelled sign-in must never be
silent**, because `auth/popup-closed-by-user` is also raised when the SDK loses its handle on the
window, so it is not reliably a decision.

---

## What happens the first time the cloud works

- **A visitor gets an anonymous account automatically.** No signup wall (D12).
- **Existing local data is carried up automatically.** On the first successful cloud connection, if
  the account is empty and the device is not, `adoptLocalData()` uploads it once and marks a flag so
  it never repeats. It only runs when every cloud collection is empty, so it cannot overwrite
  anything. Without this, everyone logging locally today would open the app to an empty account and
  reasonably conclude their history was destroyed.
- **Settings → Account** upgrades the anonymous account to email or Google. Upgrading *links* it, so
  the uid — and all the data — carries over.
- **Offline logging keeps working** via Firestore's local cache (D6).

---

## Security — what actually protects the data

**The API key in `js/firebase-config.js` is not a secret.** It identifies the project, not the user,
and is readable in the deployed JavaScript by anyone. That is true of every Firebase web app. Do not
waste effort hiding it and do not assume it protects anything.

Two things do the protecting:

1. **Firebase Auth** proves who the caller is, producing a verified `uid`.
2. **[`firestore.rules`](../firestore.rules)** decides what that uid may touch — read/write only
   `users/{their-own-uid}/**`, writes restricted to the five known collections, document shape
   enforced, row count capped so a bad client cannot balloon a document toward the 1 MB limit and
   lock someone out of their own history, deletes refused, everything else denied by default.

**Verified, not assumed.** With no auth token, all three of these were refused `403 Missing or
insufficient permissions`:

- reading another user's sessions
- listing the whole `users` tree
- writing into another user's account

Re-run that check any time the rules change — it is the only proof that matters. (Note: testing with
your own OAuth token proves nothing, because project owners bypass rules via IAM.)

### Worth doing later

- **App Check** (reCAPTCHA v3) to stop abuse from outside the real app. Not needed on day one.
- **Account deletion.** Not built. Users can sign out but cannot delete their account or cloud data.
  Fine for friends; needed before strangers.
- **Budget alert.** Spark has no billing attached, so there is no runaway-cost risk today. If Blaze
  is ever enabled, set an alert first.

---

## ~~Known risk — test this first~~ ✅ Tested 2026-08-22, and it works

**Google sign-in inside the installed PWA works**, confirmed on Tim's iPhone in the app added to his
home screen. It was broken when he first reported it on 2026-08-21 — popup opens, closes, nothing
happens — and the fix is recorded in `progress.md`'s 2026-08-21 third pass and 2026-08-22 sections.

⚠️ **What this page used to say, and why it was wrong, because the wrong half is load-bearing:**

> ~~Popups are blocked in an iOS home-screen app, so the code falls back to `signInWithRedirect`.~~

**They are not blocked** — the popup is what completes there. That false premise is exactly what
made `prefersRedirect()` send the installed PWA to `signInWithRedirect`, and **redirect is the
route that genuinely cannot finish**: it needs cross-origin access to storage while the auth domain
(`fitness-tracker-th.firebaseapp.com`) differs from the site origin (`timothyhadfield.github.io`),
which Safari 16.1+, Firefox 109+ and Chrome M115+ all block. So the second half of the old warning
stands and only the first half was wrong.

**Still true, and not to be relaxed:** redirect cannot complete in this configuration, so the app
offers *"Continue in this window instead"* only where `redirectCanComplete()` is true and names
email everywhere else. If the redirect flow is ever genuinely needed, the fix is a custom domain
with `authDomain` on a subdomain of it, or the auth handler served from the site's own root.

⚠️ **Not retested since the fix: an ordinary Safari tab** — probably the surface the original bug
report came from.

---

## Scale and cost

Each collection is a single Firestore document, capped at 1 MB. Workouts, benchmarks, and custom
exercises will never come close. `sessions` grows forever at roughly 300 bytes each — about 3,000
workouts before it matters. When it does, split `sessions` into one document per session; nothing
else in the design changes.

The free Spark plan covers 50,000 reads and 20,000 writes per day. Reading a whole collection as one
document means opening the app costs about five reads.

---

## Verified end to end

`js/firebase-backend.js` was run against the live project by redirecting its gstatic imports to a
locally installed SDK, so **the shipped module itself** was exercised, not a lookalike. 33 checks
across two suites, all passing:

**The client path**
- anonymous sign-in on first visit; reported as anonymous and NOT secured
- `read` / `write` round-trip through the module
- `setDoc` with `serverTimestamp()` **passes the rules** — the likeliest subtle failure, since the
  transform resolves server-side after the write is submitted
- `updatedAt` comes back as a real server timestamp
- `onUserChange` fires on upgrade and returns a working unsubscribe
- **`signUpEmail` LINKS the anonymous account — same uid, and data logged anonymously survives**
  (D12's core promise)
- `signOut` leaves a fresh working anonymous account with a different uid that sees no prior data
- `signInEmail` returns the original account with its data intact
- a wrong password maps to *"Wrong email or password."* — no raw `auth/` code reaches the UI
- `getRedirectResult` failing in an unsupported environment is caught, not fatal

**The rules** — every one of these was refused with `permission-denied`:
- reading another user's data · writing to another user's account
- writing to a collection name outside the known five
- a document carrying an unexpected field · `rows` that isn't a list
- an oversized write (5,001 rows) · deleting a document

Test accounts and their documents were deleted afterwards.

⚠️ **This used to read "the project holds zero users and zero documents", and it has been false ever
since Tim first signed in.** As of **2026-08-22 it holds 7 users and 19 documents**, including two
real accounts of his carrying real training data. That stale sentence was quoted into a brief for an
agent whose job involved deleting test accounts — **snapshot the live baseline and diff against it,
never clean up to an absolute zero.** A count of a live project is only true on the day it is
written, so write the date beside it.

### Still not verified

- **The Google REDIRECT path.** ⚠️ Not merely untested — **known unusable in this configuration**,
  because the auth domain differs from the origin. It is no longer offered where it cannot finish.
  ~~And Google sign-in inside the installed PWA.~~ ✅ **That one is tested and works** (2026-08-22).
- **`adoptLocalData()` against genuine local data.** It has never run for real.
- **An ordinary iOS SAFARI TAB.** A real iPhone has now used the app installed to the home screen —
  Google sign-in completes and the keyboard fix holds — but a Safari tab has not been retried since
  the 2026-08-21 fixes, and it is likely where the original bug report came from.
- **Touch, and everything else about a device.** Headless Chrome has rendered every screen at
  360–1280 px in both themes with real mouse events; that says nothing about a finger.
