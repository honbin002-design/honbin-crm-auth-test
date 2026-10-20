// Permanent-delete page is independently fail-closed and cannot become live
// when notes-preview-config.mjs is enabled for ordinary synced note tests.
// Never change this without explicit owner authorization and complete V4D
// Firestore Emulator, two-account iPhone TEST and live rules readback.
export {firebaseConfig} from './firebase-web-config.mjs';
export const firestoreReadyForRealData = false;
