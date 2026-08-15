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

## ⚠️ The one step left — Tim, ~30 seconds

**Firebase Authentication has to be switched on from the console.** This cannot be automated. The
only public API method for provisioning it — `identityPlatform:initializeAuth` — is the *paid*
Identity Platform upgrade and returns `BILLING_NOT_ENABLED` on the free Spark plan. Free Firebase
Auth provisioning is console-internal. The legacy config endpoints are retired (they 404).

1. Open **[Authentication](https://console.firebase.google.com/project/fitness-tracker-th/authentication)**
   → **Get started**.
2. Choose **Email/Password** and enable it. Save.

That's it — that click provisions Auth. Then tell me and I'll turn on Anonymous and add the
GitHub Pages domain over the API, or do them yourself:

3. **Sign-in method → Anonymous → Enable.** *(Required — the app signs users in anonymously on
   first visit so they can log immediately.)*
4. **Sign-in method → Google → Enable**, pick a support email. *(This is the one that needs an OAuth
   client the API can't create for me.)*
5. **Settings → Authorised domains → Add domain → `timothyhadfield.github.io`.**
   **Without this, sign-in works on localhost and fails on the live site** with
   `auth/unauthorized-domain`.

### Until then

The app still works. `BACKEND` is `'auto'`, so it tries the cloud, fails to sign in, and **falls
back to local storage** (D13). Settings reports "Not connected" rather than pretending things are
syncing. Nothing is lost, and no redeploy is needed once auth is on — it starts working on the next
page load.

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

## Known risk — test this first

**Google sign-in inside the installed PWA.** Popups are blocked in an iOS home-screen app, so the
code falls back to `signInWithRedirect` — which itself depends on third-party cookies while the auth
domain (`fitness-tracker-th.firebaseapp.com`) differs from the site origin
(`timothyhadfield.github.io`), and Chrome and Safari are both restricting those. **Add the app to
your home screen and try Google sign-in there before trusting it.** If it fails, the fallbacks in
order are: use email/password inside the PWA, or move the app to a custom domain and set
`authDomain` to a subdomain of it so the cookies are first-party.

---

## Scale and cost

Each collection is a single Firestore document, capped at 1 MB. Workouts, benchmarks, and custom
exercises will never come close. `sessions` grows forever at roughly 300 bytes each — about 3,000
workouts before it matters. When it does, split `sessions` into one document per session; nothing
else in the design changes.

The free Spark plan covers 50,000 reads and 20,000 writes per day. Reading a whole collection as one
document means opening the app costs about five reads.

---

## What is still NOT verified

The Firebase **client** paths in `js/firebase-backend.js` have never run against a live project —
there was no Auth to run them against. Sign-up, sign-in, linking, redirect handling, and the
automatic local-data adoption are all reviewed code, not tested code. The *server* side (project,
database, rules) is verified. Expect to find something wrong on the first real sign-in; the
local-storage fallback means it cannot lose data while it gets sorted.
