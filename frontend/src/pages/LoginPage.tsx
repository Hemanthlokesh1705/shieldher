import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import QuickExitBar from "../components/common/QuickExitBar";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  CheckCircle2,
  FileCheck2,
  ArrowRight,
} from "lucide-react";

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

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between selection:bg-brand-sage selection:text-brand-forest">
      {/* Top Safe Exit Navigation */}
      <QuickExitBar />

      {/* Main Split Screen Container */}
      <div className="flex-1 w-full flex flex-col lg:grid lg:grid-cols-12 min-h-0">
        {/* Left Column: Art-Directed Editorial & Trust Narrative */}
        <aside className="lg:col-span-5 bg-gradient-to-br from-[#F5F2EB] via-[#EFEBE2] to-[#E5DFD4] border-b lg:border-b-0 lg:border-r border-ink-border/70 p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Grain & Light Reflection */}
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
                  Digital Media Forensics
                </span>
              </div>
            </div>

            {/* Editorial Statement */}
            <div className="mt-10 lg:mt-16 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-pearl/80 border border-brand-sage/70 text-xs font-semibold text-brand-forest shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-accent-gold" />
                <span>Trauma-Informed NCII Protection</span>
              </div>
              <h2 className="font-editorial text-3xl sm:text-4xl text-ink-primary font-normal leading-[1.2] tracking-tight">
                Digital dignity is a fundamental right.
              </h2>
              <p className="text-sm text-ink-secondary leading-relaxed max-w-md font-sans">
                A confidential sanctuary to verify manipulated media, preserve
                chain-of-custody forensic reports, and draft formal complaints on
                your own terms.
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
                    Zero-Knowledge Processing
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-normal">
                    Images are processed in ephemeral memory buffers with no
                    public training or persistent exposure.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-pearl/70 border border-ink-border/50 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-brand-sage/50 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-primary font-heading">
                    Standardized Forensic Diagnostics
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-normal">
                    Frequency-domain DCT, ELA noise-residuals, and AI deepfake
                    classifiers ready for legal documentation.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-pearl/70 border border-ink-border/50 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-brand-sage/50 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-primary font-heading">
                    Always in Your Control
                  </h4>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-normal">
                    Instant emergency escape key (Esc), automatic sensitive-image
                    blurring, and full account purge anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Note */}
          <div className="relative z-10 pt-8 mt-8 border-t border-ink-border/50 flex items-center justify-between text-[11px] text-ink-muted">
            <span>Aligned with NIST SP 800-86 standards</span>
            <span>256-bit TLS encrypted</span>
          </div>
        </aside>

        {/* Right Column: High-End Authentication Card */}
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
                  Private Support Space
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-ink font-heading tracking-tight">
                  Welcome back
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                  Sign in to your private support space to check suspicious images,
                  understand the results and manage your requests.
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

              {/* Google Sign In */}
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
                  {googleLoading ? "Connecting..." : "Continue with Google"}
                </span>
              </button>

              {/* Divider */}
              <div className="relative my-5 flex items-center justify-center">
                <div className="w-full border-t border-ink-border/60" />
                <span className="bg-surface-pearl px-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted absolute">
                  or sign in with email
                </span>
              </div>

              {/* Email + Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password"
                      className="block text-xs font-semibold text-ink-primary"
                    >
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-brand-forest hover:text-brand-rich font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      className="w-full h-11 pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
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

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full h-11 mt-2 px-4 py-2 bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl font-medium text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-rich focus:ring-offset-2"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Discrete Safety Notice & Link */}
              <div className="mt-6 pt-5 border-t border-ink-border/60 text-center">
                <p className="text-xs text-ink-secondary">
                  Need a secure account?{" "}
                  <Link
                    to="/register"
                    className="font-semibold text-brand-forest hover:text-brand-rich inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Create one →</span>
                  </Link>
                </p>
              </div>
            </div>

            {/* Bottom Safety Disclaimer */}
            <p className="mt-4 text-center text-[11px] text-ink-muted leading-relaxed">
              Your safety is paramount. All interactions are protected under end-to-end encryption.
              Press <kbd className="px-1.5 py-0.5 rounded bg-canvas-sand text-ink-primary text-[10px] font-mono">Esc</kbd> anytime for quick exit.
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
