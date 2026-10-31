/**
 * Firebase configuration & initialization.
 *
 * Reads VITE_FIREBASE_* from environment variables.
 * If credentials are not yet configured, gracefully exports isFirebaseConfigured = false
 * so the application falls back seamlessly to local backend authentication.
 */
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || "";
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "";

export const isFirebaseConfigured: boolean = Boolean(
  import.meta.env.MODE !== "test" &&
  apiKey &&
  projectId &&
  apiKey !== "YOUR_FIREBASE_API_KEY" &&
  projectId !== "YOUR_PROJECT_ID"
);

const firebaseConfig = {
  apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    console.warn("Firebase initialization failed, falling back to local auth:", err);
  }
}

export { app, auth };
export default app;
