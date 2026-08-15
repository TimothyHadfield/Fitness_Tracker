// Firebase configuration — project `fitness-tracker-th`, created 2026-08-15.
//
// These values are NOT secret. They identify the project, not the user, and are
// readable in the deployed JavaScript by anyone — that is true of every Firebase
// web app. What protects the data is Firebase Auth proving the uid, plus
// firestore.rules scoping each user to their own documents. Do not treat this
// file as a credential; see the security section of docs/firebase-setup.md.
//
// store.js runs BACKEND = 'auto', so the app is on the cloud whenever
// IS_CONFIGURED is true, and falls back to local storage if it can't connect.

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBhQBk5HzvcU-C5tblR7I6AxCLtSdgLy7M',
  authDomain: 'fitness-tracker-th.firebaseapp.com',
  projectId: 'fitness-tracker-th',
  storageBucket: 'fitness-tracker-th.firebasestorage.app',
  messagingSenderId: '877939637752',
  appId: '1:877939637752:web:d1c03f6048454c19412a0d',
};

export const IS_CONFIGURED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
