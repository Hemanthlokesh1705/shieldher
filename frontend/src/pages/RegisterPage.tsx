import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import QuickExitBar from "../components/common/QuickExitBar";
import {
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

type FirebaseError = { code?: string; message?: string };

function friendlyError(err: FirebaseError): string {
  switch (err.code) {
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 8 characters.";
    case "auth/network-request-failed":
      return "Network connection error. Please check your connection and try again.";
    default:
      return (
        err.message || "Registration could not be completed. Please try again."
      );
  }
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, register, loginWithGoogle } = useAuth();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VICTIM");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register(email, password, fullName, role);
      navigate(from, { replace: true });
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
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(friendlyError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between selection:bg-brand-sage selection:text-brand-forest">
      <QuickExitBar />

      <div className="flex-1 w-full flex flex-col lg:grid lg:grid-cols-12 min-h-0">
        {/* Left Column: Art-Directed Editorial & Trust Narrative */}
        <aside className="lg:col-span-5 bg-gradient-to-br from-[#F5F2EB] via-[#EFEBE2] to-[#E5DFD4] border-b lg:border-b-0 lg:border-r border-ink-border/70 p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-80 h-80 bg-brand-sage/30 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 w-72 h-72 bg-accent-gold/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"
            aria-hidden="true"
          />

          <div className="relative z-10">
            {/* Brand Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-forest text-surface-pearl flex items-center justify-center shadow-md shadow-brand-forest/20">
                <Shield className="w-5 h-5 text-accent-gold" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-ink font-heading block leading-none">
                  ShieldHer
                </span>
                <span className="text-[11px] font-medium tracking-wider text-ink-muted uppercase mt-0.5 block">
                  Confidential Verification
                </span>
              </div>
            </div>

            {/* Editorial Statement */}
            <div className="mt-10 lg:mt-16 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-pearl/80 border border-brand-sage/70 text-xs font-semibold text-brand-forest shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-accent-gold" />
                <span>Your Privacy, Preserved</span>
              </div>
              <h2 className="font-editorial text-3xl sm:text-4xl text-ink-primary font-normal leading-[1.2] tracking-tight">
                Secure shelter in moments of digital crisis.
              </h2>
              <p className="text-sm text-ink-secondary leading-relaxed max-w-md font-sans">
                Every account is isolated, pseudonymised, and protected by
                zero-knowledge cryptographic boundaries.
              </p>
            </div>

            {/* Three Trust Pillars */}
            <div className="mt-8 space-y-3.5 max-w-md">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-pearl/70 border border-ink-border/50 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-brand-sage/50 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-primary font-heading">
                    Encrypted Evidence Vault
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-normal">
                    Cryptographic hashing ensures evidence integrity without exposing
                    raw media to unauthorized third parties.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-pearl/70 border border-ink-border/50 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-brand-sage/50 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-primary font-heading">
                    Actionable Legal Packages
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-normal">
                    Automatic complaint generation for cybercrime portals (e.g., cybercrime.gov.in)
                    and major social platforms.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-pearl/70 border border-ink-border/50 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-brand-sage/50 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-primary font-heading">
                    Zero Identity Profiling
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-normal">
                    Use any preferred display name or pseudonym. No personal tracking or
                    telemetry of sensitive actions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 mt-8 border-t border-ink-border/50 flex items-center justify-between text-[11px] text-ink-muted">
            <span>Client-side sensitive media blur enabled</span>
            <span>GDPR & DPDP compliant</span>
          </div>
        </aside>

        {/* Right Column: High-End Registration Card */}
        <main className="lg:col-span-7 flex flex-col justify-center items-center px-4 py-10 sm:px-8 lg:px-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-7 sm:p-9 shadow-md shadow-ink-primary/5">
              <div className="mb-6">
                <span className="inline-block text-xs font-semibold text-brand-forest bg-brand-sage/40 border border-brand-border px-2.5 py-0.5 rounded-full mb-2.5 tracking-wide">
                  Confidential & Secure
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-ink font-heading tracking-tight">
                  Create your account
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                  Your account is private. You control what information you share
                  and when to prepare an official report.
                </p>
              </div>

              {error && (
                <div
                  className="mb-5 p-3.5 rounded-xl bg-accent-coralSoft border border-accent-coral/30 text-accent-coral text-xs leading-relaxed flex items-start gap-2.5"
                  role="alert"
                >
                  <span className="text-sm">⚠️</span>
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              {/* Google Sign Up */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full h-11 px-4 py-2 bg-surface-pearl hover:bg-canvas-subtle active:bg-canvas border border-ink-border hover:border-ink-borderStrong text-ink font-medium text-xs sm:text-sm rounded-xl flex items-center justify-center gap-3 transition-all shadow-2xs hover:shadow-xs disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-rich"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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
                  {googleLoading ? "Connecting..." : "Sign up with Google"}
                </span>
              </button>

              {/* Divider */}
              <div className="relative my-5 flex items-center justify-center">
                <div className="w-full border-t border-ink-border/60" />
                <span className="bg-surface-pearl px-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted absolute">
                  or register with email
                </span>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Your Name or Preferred Pseudonym
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe (or a pseudonym)"
                    autoComplete="name"
                    disabled={loading}
                    className="w-full h-10 px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    className="w-full h-10 px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Account type
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                    className="w-full h-10 px-3.5 py-2 text-xs sm:text-sm text-ink bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
                  >
                    <option value="VICTIM">
                      Private User (Confidential Support & Analysis)
                    </option>
                    <option value="ADVOCATE">
                      Legal / Victim Support Advocate
                    </option>
                    <option value="EXAMINER">
                      Authorized Forensic Examiner
                    </option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Password (min. 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      disabled={loading}
                      className="w-full h-10 pl-3.5 pr-10 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary transition-colors p-1"
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

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold text-ink-primary mb-1.5"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPass ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      disabled={loading}
                      className="w-full h-10 pl-3.5 pr-10 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary transition-colors p-1"
                      aria-label={
                        showConfirmPass
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showConfirmPass ? (
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
                  className="w-full h-11 mt-3 px-4 py-2 bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl font-medium text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-rich focus:ring-offset-2"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <>
                      <span>Create Encrypted Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-ink-border/60 text-center">
                <p className="text-xs text-ink-secondary">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-brand-forest hover:text-brand-rich transition-colors"
                  >
                    Sign in here →
                  </Link>
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-ink-muted leading-relaxed">
              By creating an account, your data is handled strictly under our zero-retention
              and victim-first privacy charter.
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
