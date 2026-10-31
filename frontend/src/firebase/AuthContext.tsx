/**
 * Authentication Context — provides unified authentication state (Firebase Auth
 * with seamless backend JWT token synchronization).
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./config";
import { getCurrentUser, loginUser, loginWithFirebase, registerUser } from "../services/api";

export interface UserSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  photoURL?: string | null;
}

interface AuthContextValue {
  user: UserSession | null;
  loading: boolean;
  isFirebaseMode: boolean;
  register: (
    email: string,
    password: string,
    displayName?: string,
    role?: string
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync session with backend and localStorage
  const syncWithBackend = async (
    email: string,
    password?: string,
    displayName?: string,
    role: string = "VICTIM",
    idToken?: string
  ) => {
    try {
      if (password) {
        // Try registering in backend (ignore if already registered)
        try {
          await registerUser(email, password, displayName || email.split("@")[0], role);
        } catch (_) {
          // User might already exist in backend DB
        }
        // Login to get backend JWT
        await loginUser(email, password);
      } else {
        await loginWithFirebase(idToken, email, displayName, role);
      }
    } catch (err) {
      console.warn("Backend auth token sync notice:", err);
    }
  };

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: localStorage.getItem("shieldher_role") || "VICTIM",
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return unsub;
    } else {
      // Local backend token mode
      const token = localStorage.getItem("shieldher_token");
      if (token) {
        getCurrentUser(token)
          .then((profile) => {
            setUser({
              uid: profile.id,
              email: profile.email,
              displayName: profile.full_name,
              role: profile.role,
            });
          })
          .catch(() => {
            localStorage.removeItem("shieldher_token");
            localStorage.removeItem("shieldher_role");
            localStorage.removeItem("shieldher_user_id");
            setUser(null);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, []);

  const register = async (
    email: string,
    password: string,
    displayName?: string,
    role: string = "VICTIM"
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName?.trim() || cleanEmail.split("@")[0];

    if (isFirebaseConfigured && auth) {
      // 1. Firebase user creation
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      // 2. Synchronize with backend database & issue JWT
      await syncWithBackend(cleanEmail, password, cleanName, role);

      setUser({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cleanName,
        role,
      });
    } else {
      // Local backend user creation
      await registerUser(cleanEmail, password, cleanName, role);
      const tokenRes = await loginUser(cleanEmail, password);
      setUser({
        uid: tokenRes.user_id,
        email: tokenRes.email,
        displayName: cleanName,
        role: tokenRes.role,
      });
    }
  };

  const login = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    if (isFirebaseConfigured && auth) {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      // Synchronize backend token
      await syncWithBackend(cleanEmail, password, cred.user.displayName || undefined);
      setUser({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName,
        photoURL: cred.user.photoURL,
        role: localStorage.getItem("shieldher_role") || "VICTIM",
      });
    } else {
      const tokenRes = await loginUser(cleanEmail, password);
      setUser({
        uid: tokenRes.user_id,
        email: tokenRes.email,
        displayName: cleanEmail.split("@")[0],
        role: tokenRes.role,
      });
    }
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error(
        "Google Sign-In requires Firebase configuration. Add your Firebase credentials in frontend/.env to enable Google SSO."
      );
    }
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    const result = await signInWithPopup(auth, provider);
    const fbUser = result.user;

    // Provision or sync backend user with a secure session
    if (fbUser.email) {
      const idToken = await fbUser.getIdToken().catch(() => undefined);
      await syncWithBackend(
        fbUser.email,
        undefined,
        fbUser.displayName || undefined,
        "VICTIM",
        idToken
      );
    }

    setUser({
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      role: "VICTIM",
    });
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (isFirebaseConfigured && auth) {
      await sendPasswordResetEmail(auth, cleanEmail);
    } else {
      // In local mode, inform the user
      throw new Error(
        "Password reset email service is enabled when Firebase is configured. Please contact your administrator."
      );
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Firebase signout error:", err);
      }
    }
    localStorage.removeItem("shieldher_token");
    localStorage.removeItem("shieldher_role");
    localStorage.removeItem("shieldher_user_id");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirebaseMode: isFirebaseConfigured,
        register,
        login,
        loginWithGoogle,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Return safe fallback context so tests and isolated renders don't throw
    return {
      user: null,
      loading: false,
      isFirebaseMode: false,
      register: async () => {},
      login: async () => {},
      loginWithGoogle: async () => {},
      resetPassword: async () => {},
      logout: async () => {},
    };
  }
  return ctx;
}
