// Firebase configuration.
//
// PLACEHOLDER. The app runs fine without it — everything stays in local storage
// until these are filled in. See docs/firebase-setup.md for where to get them.
//
// Filling these in is the ONLY step needed: store.js runs BACKEND = 'auto', so
// it switches to the cloud as soon as IS_CONFIGURED goes true.
//
// These values are NOT secret. They identify the project, not the user, and are
// readable in the deployed JavaScript by anyone. What protects the data is
// Firebase Auth plus firestore.rules — see the security section of the setup
// doc before assuming this file needs hiding.

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const IS_CONFIGURED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
