# Firebase setup — accounts and cloud storage

**Status: code complete, waiting on you.** Everything on the code side is written. What is left
needs a Google login in a browser, which only you can do. Budget about 10 minutes.

Until you finish this, the app keeps working exactly as it does now — everything in local storage,
fully offline. `BACKEND` is set to `'auto'`, so the moment real keys land in
`js/firebase-config.js` the app switches itself over. Nothing else has to change.

---

## What you do

### 1. Create the project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Create a project**.
2. Name it whatever. **Turn Google Analytics off** — it isn't used and it adds consent obligations.

### 2. Register the web app

3. On the project overview, click the **Web** icon (`</>`). Give it a nickname. Do **not** tick
   Firebase Hosting — the app is on GitHub Pages.
4. Firebase shows a `firebaseConfig` object. Keep that tab open, you'll paste it in step 8.

### 3. Turn on sign-in methods

**Build → Authentication → Get started → Sign-in method.** Enable all three:

| Method | Why |
|---|---|
| **Anonymous** | New visitors start logging instantly, no signup wall (D8/D9) |
| **Email/Password** | The account type that works for everyone |
| **Google** | One tap, no password to forget |

For Google it will ask for a **project support email** — pick your own address.

### 4. ⚠️ Add the authorised domains — this is the step everyone forgets

Still in **Authentication → Settings → Authorised domains**, add:

```
timothyhadfield.github.io
```

`localhost` is already there. **Without this, sign-in fails on the live site with
`auth/unauthorized-domain` and works perfectly on your laptop** — which is exactly the kind of bug
that wastes an afternoon.

### 5. Create the database

**Build → Firestore Database → Create database.** Pick the region closest to you. Start in
**production mode** — locked down, which is what the rules in step 6 then open up deliberately.

### 6. Publish the security rules

The rules live in this repo at [`firestore.rules`](../firestore.rules), so they are reviewable and
version-controlled rather than existing only inside a console text box.

Either paste that file's contents into **Firestore → Rules** and hit Publish, or from the project
root:

```
npm install -g firebase-tools
firebase login
firebase use --add          # pick the project you just made
firebase deploy --only firestore:rules
```

### 7. Check the rules actually work

In **Firestore → Rules → Playground**, try a read of
`/users/SOMEONE_ELSE/collections/sessions` while authenticated as a different uid. It must be
**denied**. If it isn't, stop and re-paste the rules.

### 8. Paste the config

Open `js/firebase-config.js` and fill in the six values from step 4. Commit and push. Pages
redeploys in about 40 seconds and the app is on the cloud.

---

## What changes for users once it's on

- **First visit creates an anonymous account automatically.** No signup wall — someone can log a
  full workout before ever seeing an account screen.
- **Settings → Account** is where they secure it. Adding email or Google **links** the anonymous
  account, so the uid never changes and nothing already logged is lost.
- **Offline logging keeps working.** Firestore's local cache is enabled, so sets logged in a
  basement gym sync when the signal returns (D6).
- **If Firebase is unreachable, the app falls back to local storage** rather than failing. Settings
  says "Not connected" and stops claiming anything is synced.

---

## Security — what actually protects the data

**The API key in `js/firebase-config.js` is not a secret.** It identifies the project, nothing more.
Anyone can read it out of the deployed JavaScript, and that is by design — every Firebase web app
works this way. Do not waste effort hiding it and do not assume it protects anything.

Two things actually protect the data:

1. **Firebase Auth** proves who the caller is, producing a verified `uid`.
2. **[`firestore.rules`](../firestore.rules)** decides what that `uid` may touch. It allows a user
   to read and write only `users/{their-own-uid}/**`, restricts writes to the five known
   collections, enforces the document shape, and caps rows so a bad client cannot balloon a
   document toward the 1 MB limit and lock someone out of their own history. Everything else is
   denied by default, including document deletion.

### Worth doing later

- **App Check** (console → App Check, reCAPTCHA v3 provider) stops people hammering your project
  from outside the real app. Not needed on day one; worth it if usage grows.
- **Email enumeration protection** is on by default in newer projects — leave it on.
- **Account deletion.** Not built. If real users ever arrive, they can ask for their data to be
  deleted and there is currently no self-serve way to do it.

---

## Two known risks — test these first

**1. Google sign-in inside the installed PWA.** Browsers block popups in an iOS home-screen app, so
the code detects standalone mode and uses a redirect instead. But `signInWithRedirect` depends on
third-party cookies when the auth domain (`your-project.firebaseapp.com`) differs from the site
origin, and Chrome and Safari are both restricting those. **Add the app to your home screen and try
Google sign-in there before trusting it.** If it fails, the fallbacks in order are: use
email/password in the PWA, or put the app on a custom domain and set `authDomain` to a subdomain of
it so the cookies are first-party.

**2. Signing in to an existing account on a device that already has anonymous data.** The uid
changes, so the anonymous data stops being reachable. The sign-in screen warns about this before
it happens, and **Account → Upload from this device** merges local data into the signed-in account
by id, keeping whichever copy is newer. It never overwrites newer cloud data and running it twice
does nothing. That logic is unit-tested; the network path around it is not.

---

## The one thing to watch as it grows

Each collection is a single Firestore document, capped at 1 MB. Workouts, benchmarks, and custom
exercises will never come close. `sessions` grows forever at roughly 300 bytes each — about 3,000
workouts before it matters. That is years away. When it does matter, the fix is splitting
`sessions` into one document per session; nothing else in the design has to change.

## Cost

The free Spark plan covers 50,000 document reads and 20,000 writes per day. Because this design
reads a whole collection as one document, opening the app costs about five reads. That supports a
lot of people before it costs anything.

---

## What is NOT verified

Every network path in `js/firebase-backend.js` is **reviewed code, not tested code** — no Firebase
project has existed to run it against. The pure helpers around it (error mapping, user description,
the merge logic) are covered by the test suite. Expect to find at least one thing wrong on first
connection; that is normal, and the fallback to local storage means it cannot lose data while you
sort it out.
