// Firebase configuration.
//
// This file is a PLACEHOLDER. The app runs fine without it — it uses local storage
// until you fill this in. See docs/firebase-setup.md for how to get these values.
//
// Once filled in, set BACKEND = 'firebase' in js/store.js.

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const IS_CONFIGURED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
