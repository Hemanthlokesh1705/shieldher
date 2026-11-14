import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
} from "lucide-react";
import AuthBrandPanel from "../components/AuthBrandPanel";

type FirebaseError = { code?: string; message?: string };

function friendlyError(err: FirebaseError): string {
  switch (err.code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please check your details and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many sign-in attempts. Please wait a few moments and try again.";
    case "auth/network-request-failed":
      return "Network connection issue. Please check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This site is not authorized for Firebase sign-in. Add this hostname to Firebase Console under Authentication → Settings → Authorized domains, then reload.";
    default:
      return err.message || "Sign in failed. Please verify your credentials.";
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, loginWithGoogle } = useAuth();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(friendlyError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputClass =
    "w-full h-12 pl-10 pr-3.5 text-sm text-ink placeholder:text-ink-muted bg-white border border-ink-border rounded-xl hover:border-ink-borderStrong focus:outline-none focus:ring-4 focus:ring-brand-rich/15 focus:border-brand-rich transition-all disabled:bg-canvas-subtle disabled:cursor-not-allowed";

  return (
    <div className="auth-shell min-h-screen bg-canvas flex flex-col lg:grid lg:grid-cols-12 selection:bg-brand-sage selection:text-brand-forest">
      <AuthBrandPanel
        title="Digital dignity is a fundamental right"
        description="A confidential place to review image-analysis signals, keep your records together, and decide what to do next."
      />

      {/* ───────── Right: authentication card ───────── */}
      <main className="flex-1 lg:col-span-7 flex items-center justify-center px-4 py-10 sm:px-8 lg:px-10 xl:px-16 lg:min-h-screen bg-surface-subtle">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl border border-ink-border/70 p-6 sm:p-9 shadow-[0_1px_2px_rgba(25,43,41,0.04),0_16px_40px_-12px_rgba(25,43,41,0.14)]">
            <div className="mb-6 sm:mb-7">
              <span className="inline-block text-xs font-semibold text-brand-forest bg-brand-sage/40 border border-brand-border px-2.5 py-0.5 rounded-full mb-3 tracking-wide">
                Private Support Space
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink font-heading tracking-tight">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
                Sign in to your private support space to check suspicious images,
                understand the results and manage your requests.
              </p>
            </div>

            {error && (
              <div
                className="mb-5 p-3.5 rounded-xl bg-accent-coralSoft border border-accent-coral/30 text-status-error text-xs leading-relaxed flex items-start gap-2.5"
                role="alert"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0 mt-px"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="flex-1 font-medium break-words">{error}</span>
              </div>
            )}

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full h-12 px-4 py-2 bg-white hover:bg-canvas-subtle active:bg-canvas border border-ink-border hover:border-ink-borderStrong text-ink font-medium text-sm rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_1px_2px_rgba(25,43,41,0.05)] hover:shadow-[0_2px_8px_-2px_rgba(25,43,41,0.12)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-rich/20"
            >
              <svg className="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>
                {googleLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </button>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full border-t border-ink-border/70" />
              <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted absolute whitespace-nowrap">
                or sign in with email
              </span>
            </div>

            {/* Email + Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[13px] font-semibold text-ink-primary mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[13px] font-semibold text-ink-primary"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-forest hover:text-brand-rich font-medium hover:underline underline-offset-2 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary hover:bg-canvas-subtle rounded-md transition-colors p-1.5"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="auth-submit-button group w-full h-12 mt-2 px-4 py-2 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-rich"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Create account link */}
            <div className="mt-6 sm:mt-7 pt-5 sm:pt-6 border-t border-ink-border/60 text-center">
              <p className="text-sm text-ink-secondary">
                Need a secure account?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-brand-forest hover:text-brand-rich inline-flex items-center gap-1 hover:underline underline-offset-2 transition-colors"
                >
                  <span>Create one →</span>
                </Link>
              </p>
            </div>
          </div>

          {/* Bottom Safety Disclaimer */}
          <p className="mt-5 text-center text-[11px] text-ink-muted leading-relaxed">
            Your safety is paramount. All interactions are protected under
            end-to-end encryption.
          </p>
        </motion.div>
      </main>
    </div>
  );
}