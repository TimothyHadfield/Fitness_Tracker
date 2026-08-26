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

✅ **THE CEILING THIS SECTION IS ABOUT WAS REMOVED ON 2026-08-28 (Open work 0b(c) closed).**
`sessions` and `guestSessions` are now **one Firestore document per row**, at
`users/{uid}/sessions/{rowId}`, where the 1 MiB per-document cap applies to a single session
(~2,000 bytes) rather than to all of them together. Firestore does not cap the number of documents
in a collection, so there is no longer a session count at which saving stops working. Everything
below the migration note is kept because the *arithmetic* is still how `store.cloudUsage()` prices
the collections that are still whole.

⚠️ **THE MIGRATION RAN WHILE THE ACCOUNT WAS NEARLY EMPTY, ON PURPOSE.** The 80 % warning existed to
leave six months to do this — but the thing being migrated is somebody's training history, it gets
riskier the more of it there is, and 80 % means doing it to ~420 sessions under time pressure. At a
few dozen it is the same code against a twentieth of the data with no deadline. The runway was never
the hard part.

**How it is safe:** the migration writes every row into its own document, **re-reads the collection
to prove they landed**, and only then empties the old whole-list document — which is left completely
untouched if any row is missing, so a migration that cannot finish has changed nothing. The read path
keeps checking the old document forever, so anything a client that predates sharding writes there is
adopted on the next read rather than stranded. `tests/data-layer.test.mjs` drives all of it against
an in-memory Firestore double — the first time any network path in `js/firebase-backend.js` has been
executed rather than reviewed — and `tests/rules.test.mjs` proves the new paths are owner-only.

⚠️ **THE READ COST CHANGED.** A sharded read is one billed document read per row, not one per
collection. At 520 sessions that is 520 reads to fill the cache on a cold open, against a 50,000/day
free allowance — about 96 cold opens a day before it matters, with the read cache and its 30-second
revalidation on top. If it ever becomes the constraint the fix is incremental revalidation
(`where updatedAt > lastSeen`, plus a count to catch deletes), **not** a return to one big document.

---

### The ceiling as it stood, and why the number was wrong twice

Kept because `store.cloudUsage()` still applies exactly this accounting to the collections that
remain whole — benchmarks, weigh-ins, programmes, settings — and because it is the clearest record
of how a constant nobody can check goes stale.

Each remaining collection is a single Firestore document, capped at 1 MiB. Workouts, benchmarks, and
custom exercises will never come close.

⚠️ **`sessions` WAS THE ONE THAT RAN OUT, AND THIS SECTION WAS WRONG ABOUT WHEN TWICE, BOTH TIMES IN
THE OPTIMISTIC DIRECTION.**

| written | claim | why it was wrong |
|---|---|---|
| before 2026-08-24 | ~300 bytes a session, ~3,000 workouts | a guess nobody had serialised |
| 2026-08-24, first | ~1,100 bytes a session, **~950 sessions** | measured `JSON.stringify` length — but Firestore does not charge JSON length |
| 2026-08-24, second | **~2,000 bytes a session, ~520 sessions** | Firestore's own published accounting, computed by `store.cloudUsage()` |

**The real ceiling is about 520 sessions — roughly two and a half years at four workouts a week.**

⚠️ **WHY THE JSON MEASUREMENT WAS 1.66× OPTIMISTIC, because it is not a fudge factor.** Firestore
charges a flat **32 bytes for every map** and **8 for every number**, however short they look written
down. One recorded set — `{"weight":205,"reps":6}` — is **23 bytes of JSON and 60 to Firestore**. A
session carries ~17 of those plus a map per exercise, and `entries` is **88 % of the whole
collection**, so the map overhead *is* the document rather than a rounding error on it. The demo
year's sessions come to 1,216 JSON bytes each, which agrees with the review's ~1,100 — the two
measurements are of the same data, and only one of them is of the thing Firestore bills.

⚠️ **NEVER VERIFIED AGAINST A REAL REJECTION.** Confirming it means writing a megabyte to the live
project and watching it fail, which is not worth doing to a real account. It is the published
arithmetic applied honestly, and it errs high.

⚠️ **What happens at the ceiling.** The write is rejected by Firestore, so the *cloud copy* stops
updating. It is no longer silent at the point it matters: since 2026-08-22 a failed save at the end
of a workout says so on screen, above the button that failed, and keeps the draft.

✅ **AND SOMETHING WARNS AS IT APPROACHES, since 2026-08-24.** `store.cloudUsage()` sizes every one
of this account's collection documents by Firestore's own rules and reports the fullest; Settings
paints a warning above *Download backup* from **80 %**, naming the percentage *and* how many more
records fit — derived from **this account's** rows, not from any constant in this file. It is silent
below the threshold on purpose: an always-on warning is wallpaper by the time it comes true.

✅ **DONE 2026-08-28 — the fix this design always anticipated:** `sessions` split into one document
per session, and `guestSessions` with it. Nothing else in the design changed. See the top of this
section.

⚠️ **`cloudUsage()` NO LONGER PRICES THE SHARDED COLLECTIONS**, because they no longer live under
that cap and warning about an emptied document would be this section's own failure mode running in
the opposite direction. It still watches everything else, so if the judgement that only those two
grow without limit turns out to be wrong, the warning fires on whichever collection is actually
filling up — with that account's own numbers, as before.

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
