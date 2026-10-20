// Standalone NOTES TEST ONLY: owner-approved Firestore allowlist confirmed by
// live owner-admin readback. NEVER change the auth-only default config gate.
// Auth-only smoke test config and page remain unchanged.
export {firebaseConfig} from './firebase-web-config.mjs';
// This is NOT production approval or an authorization override.
// Firestore server-side Rules enforce owner-approved Google identities.
export const firestoreReadyForRealData = true;
