# Firebase setup

**Status: not connected.** The app currently stores everything in the browser's local storage
and works fully offline. This document is what to do when you want cloud sync.

## Why this isn't done yet

Creating a Firebase project requires signing into a Google account in a browser and clicking
through the Firebase console. That is something only you can do — I can write every line of
code around it, but I can't create the project or generate the API keys.

Everything on the code side is already written and waiting:

| File | State |
|---|---|
| `js/store.js` | Async API, backend-agnostic. Flip one constant to switch. |
| `js/firebase-backend.js` | Complete Firestore adapter. **Written but never run.** |
| `js/firebase-config.js` | Empty placeholder for your keys. |

## What you do (about 5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
   Turn off Google Analytics — it isn't needed.
2. In the project, click the **Web** icon (`</>`) to register a web app. Name it anything.
3. Firebase shows you a `firebaseConfig` object. Copy it.
4. In **Build → Authentication → Sign-in method**, enable **Anonymous**.
   (Enable **Email/Password** too if you want real accounts later.)
5. In **Build → Firestore Database**, create a database. Start in **production mode**.
6. In **Firestore → Rules**, paste the rules below and publish.

Then paste the config into `js/firebase-config.js` and tell me — I'll flip the backend over
and test it.

## Firestore security rules

These lock each user to their own data. Without them, anyone could read everyone's workouts.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## What happens when it's switched on

- Each user gets an **anonymous account automatically** on first visit — no signup wall before
  they can log a workout. It can be upgraded to a real email account later without losing data.
- **Offline persistence is enabled**, so logging still works with no signal and syncs when the
  connection returns. This is non-negotiable per decision D6 — gyms are basements.
- Data lives at `users/{uid}/collections/{name}` as one document per collection, which mirrors
  the local backend's read-all/write-all API exactly.

## The one thing to watch

Each collection is a single Firestore document, and Firestore caps documents at 1 MB. Workouts,
benchmarks, and custom exercises will never come close. `sessions` is the one that grows forever —
roughly 300 bytes per session, so about 3,000 workouts before it becomes a concern. That's years
away, but when it matters the fix is splitting `sessions` into one document per session.

## Free tier

Firebase's free Spark plan covers 50,000 document reads and 20,000 writes per day. Because this
design reads a whole collection as one document, a user opening the app costs about 5 reads.
That supports a lot of users before costing anything.
