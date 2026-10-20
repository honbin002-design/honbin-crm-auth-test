// This is a PUBLIC Firebase browser config template, not a server key.
// Owner must paste the existing Firebase Web API key into apiKey on GitHub.
// Do not add service-account keys, passwords, OAuth secrets, or customer data.
export const firebaseConfig = Object.freeze({
  apiKey: "PASTE_EXISTING_FIREBASE_WEB_API_KEY_HERE",
  authDomain: "honbin-crm-notes-spark.firebaseapp.com",
  projectId: "honbin-crm-notes-spark",
  storageBucket: "honbin-crm-notes-spark.firebasestorage.app",
  messagingSenderId: "692331475098",
  appId: "1:692331475098:web:4c13d24c1f1d54f6922f23"
});
// Safety gate: no real Firestore notes until rules and tests are approved.
export const firestoreReadyForRealData = false;
