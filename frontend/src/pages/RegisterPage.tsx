import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import {
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Mail,
  User,
  ChevronDown,
  Check,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/**
 * Hero photo: lives at  frontend/public/loginhero.jpeg
 * (change the file name here if yours is different)
 */
const HERO_IMAGE = "/loginhero.jpeg";

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
    case "auth/unauthorized-domain":
      return "This site is not authorized for Firebase sign-in. Add this hostname to Firebase Console under Authentication → Settings → Authorized domains, then reload.";
    default:
      return (
        err.message || "Registration could not be completed. Please try again."
      );
  }
}

const ROLE_HINTS: Record<string, string> = {
  VICTIM: "A private space to process images and prepare your own records.",
  ADVOCATE: "For professionals who support people through reporting.",
  EXAMINER: "For authorized staff who review forensic results.",
  ADMIN: "Platform administration access.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const baseInput =
  "w-full h-11 text-sm text-ink placeholder:text-ink-subtle bg-white border rounded-[10px] focus:outline-none focus:ring-4 transition-all disabled:bg-canvas-subtle disabled:cursor-not-allowed";
const okBorder =
  "border-brand-border hover:border-brand-rich/60 focus:ring-brand-rich/15 focus:border-brand-rich";
const badBorder =
  "border-status-error/60 focus:ring-status-error/15 focus:border-status-error";

function inputClass(invalid = false) {
  return `${baseInput} pl-10 pr-3 ${invalid ? badBorder : okBorder}`;
}

const iconClass =
  "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted";
const eyeToggleClass =
  "absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-brand-forest hover:bg-canvas-subtle rounded-md transition-colors p-1";
const labelRowClass = "flex items-baseline justify-between gap-2 mb-1.5 min-w-0";
const labelClass = "block text-[13px] font-medium text-ink truncate";
const statusClass = "text-[11px] font-medium whitespace-nowrap";
const helperClass =
  "mt-1.5 text-[11px] leading-snug text-ink-muted [@media(max-height:800px)]:!hidden";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, register } = useAuth();

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
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // If already authenticated, redirect
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  /* ───── live feedback (visual only; submit validation below) ───── */
  const requirements = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    {
      ok: /[A-Z]/.test(password) && /\d/.test(password),
      label: "Include an uppercase letter and a number",
    },
  ];

  const emailInvalid = emailTouched && email.length > 0 && !EMAIL_RE.test(email);
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const confirmMismatch =
    confirmPassword.length > 0 &&
    confirmPassword !== password &&
    (confirmTouched || confirmPassword.length >= password.length);

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

    if (!agreed) {
      setError(
        "Please agree to the Terms of Service and Privacy Policy to continue."
      );
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

  return (
    <div className="auth-shell min-h-screen bg-canvas flex flex-col lg:grid lg:grid-cols-12 selection:bg-brand-sage selection:text-brand-forest">
      {/* ───────── Left: photo brand panel ───────── */}
      <aside className="relative isolate overflow-hidden bg-[#090D16] text-white lg:col-span-5 lg:self-start lg:sticky lg:top-0 lg:h-screen">
        {/* Photo (top 62% on desktop, full banner on mobile) */}
        <div
          className="absolute inset-x-0 top-0 h-full lg:h-[62%] -z-20"
          aria-hidden="true"
        >
          <img
            src={HERO_IMAGE}
            alt=""
            className="w-full h-full object-cover object-[50%_45%]"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Mobile overlay */}
        <div
          className="absolute inset-0 -z-10 lg:hidden bg-gradient-to-b from-[#090D16]/65 via-[#111827]/60 to-[#090D16]/90"
          aria-hidden="true"
        />
        {/* Desktop overlay: fade photo into solid panel */}
        <div
          className="absolute inset-0 -z-10 hidden lg:block"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to bottom, rgba(9,13,22,0.75) 0%, rgba(17,24,39,0.25) 18%, rgba(17,24,39,0.15) 38%, rgba(9,13,22,0.92) 58%, #090D16 66%)",
          }}
        />
        {/* Brand tint */}
        <div
          className="absolute inset-0 -z-10 bg-[#2563EB]/20 mix-blend-multiply"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between gap-6 px-6 py-8 sm:px-12 sm:py-10 lg:gap-4 lg:px-10 lg:py-9 xl:px-14 xl:py-11">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-lg shadow-black/20">
              <Shield className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white font-heading block leading-none">
                ShieldHer
              </span>
              <span className="text-[11px] font-medium tracking-[0.14em] text-white/65 uppercase mt-1 block">
                Confidential Verification
              </span>
            </div>
          </div>

          {/* Bottom copy block */}
          <div className="space-y-4 lg:space-y-5">
            <div className="space-y-3 lg:space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-semibold text-[#BFDBFE]">
                <Sparkles className="w-3.5 h-3.5 text-accent-gold" />
                <span>Your Privacy, Preserved</span>
              </div>
              <h2 className="font-editorial font-normal text-white tracking-tight leading-[1.12] text-[clamp(1.75rem,2.6vw,2.75rem)] max-w-xl [text-wrap:balance]">
                Secure shelter in moments of digital crisis.
              </h2>
              <div className="[@media(max-height:720px)]:!hidden">
                <p className="hidden sm:block text-sm text-white/75 leading-relaxed max-w-md font-sans">
                  Every account is isolated, pseudonymised, and protected by
                  zero-knowledge cryptographic boundaries.
                </p>
              </div>
            </div>

            {/* Trust pillars (desktop only; shrink on short screens) */}
            <div className="[@media(max-height:680px)]:!hidden">
              <div className="hidden lg:block space-y-3.5 max-w-md">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 text-[#93C5FD] flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="self-center">
                    <h4 className="text-[13px] font-semibold text-white font-heading">
                      Encrypted Evidence Vault
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-normal [@media(max-height:860px)]:!hidden">
                      Cryptographic hashing ensures evidence integrity without
                      exposing raw media to unauthorized third parties.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 text-[#93C5FD] flex items-center justify-center flex-shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="self-center">
                    <h4 className="text-[13px] font-semibold text-white font-heading">
                      Actionable Legal Packages
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-normal [@media(max-height:860px)]:!hidden">
                      Automatic complaint generation for cybercrime portals
                      (e.g., cybercrime.gov.in) and major social platforms.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 text-[#93C5FD] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="self-center">
                    <h4 className="text-[13px] font-semibold text-white font-heading">
                      Zero Identity Profiling
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5 leading-normal [@media(max-height:860px)]:!hidden">
                      Use any preferred display name or pseudonym. No personal
                      tracking or telemetry of sensitive actions.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="hidden lg:flex pt-4 border-t border-white/10 items-center justify-between text-[11px] text-white/50">
              <span>Client-side sensitive media blur enabled</span>
              <span>GDPR &amp; DPDP compliant</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ───────── Right: registration card (matches reference design) ───────── */}
      <main className="flex-1 lg:col-span-7 flex items-center justify-center px-4 py-5 sm:px-8 sm:py-6 lg:px-10 xl:px-14 lg:min-h-screen bg-surface-subtle">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md sm:max-w-xl"
        >
          <div className="bg-white rounded-2xl border border-brand-border/60 p-6 sm:p-8 shadow-[0_1px_2px_rgba(20,91,83,0.04),0_12px_32px_-12px_rgba(20,91,83,0.14)]">
            {/* Header */}
            <div className="mb-5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-forest mb-3">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-brand-forest"
                  aria-hidden="true"
                />
                Confidential &amp; Secure
              </p>
              <h1 className="text-[1.7rem] sm:text-3xl font-bold text-ink font-heading tracking-tight">
                Create your account
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary [@media(max-height:800px)]:!hidden">
                You&apos;re in control. You choose what information you share
                and when. Your account is private to you.
              </p>
            </div>

            {error && (
              <div
                className="mb-4 p-3 rounded-xl bg-accent-coralSoft border border-accent-coral/30 text-status-error text-xs leading-relaxed flex items-start gap-2.5"
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

            {/* Form: 1 column on phones (as in reference), 2 columns on larger screens to fit one screen */}
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-3.5"
            >
              {/* Name */}
              <div className="min-w-0">
                <div className={labelRowClass}>
                  <label htmlFor="fullName" className={labelClass}>
                    Your name or preferred pseudonym
                  </label>
                </div>
                <div className="relative">
                  <User className={iconClass} aria-hidden="true" />
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe (or a pseudonym)"
                    autoComplete="name"
                    disabled={loading}
                    className={inputClass()}
                  />
                </div>
                <p className={helperClass}>
                  You may use any name. Your identity is not verified here.
                </p>
              </div>

              {/* Email */}
              <div className="min-w-0">
                <div className={labelRowClass}>
                  <label htmlFor="email" className={labelClass}>
                    Email address
                  </label>
                  {emailInvalid && (
                    <span
                      id="email-hint"
                      className={`${statusClass} text-status-error`}
                    >
                      Invalid email format
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className={iconClass} aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    aria-invalid={emailInvalid}
                    aria-describedby={emailInvalid ? "email-hint" : undefined}
                    className={inputClass(emailInvalid)}
                  />
                </div>
              </div>

              {/* Account type (full width) */}
              <div className="sm:col-span-2 min-w-0">
                <div className={labelRowClass}>
                  <label htmlFor="role" className={labelClass}>
                    Account type
                  </label>
                </div>
                <div className="relative">
                  <Lock className={iconClass} aria-hidden="true" />
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                    className={`${baseInput} ${okBorder} appearance-none pl-10 pr-10 cursor-pointer`}
                  >
                    <option value="VICTIM">
                      Private User (Confidential Support &amp; Analysis)
                    </option>
                    <option value="ADVOCATE">
                      Legal / Victim Support Advocate
                    </option>
                    <option value="EXAMINER">
                      Authorized Forensic Examiner
                    </option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted"
                    aria-hidden="true"
                  />
                </div>
                <p className={helperClass}>{ROLE_HINTS[role]}</p>
              </div>

              {/* Password */}
              <div className="min-w-0">
                <div className={labelRowClass}>
                  <label htmlFor="password" className={labelClass}>
                    Password (min. 8 characters)
                  </label>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                    className={eyeToggleClass}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    disabled={loading}
                    className={inputClass()}
                  />
                </div>
                <ul className="mt-2 space-y-1">
                  {requirements.map((r) => (
                    <li
                      key={r.label}
                      className={`flex items-center gap-2 text-[11px] transition-colors ${
                        r.ok ? "text-status-success font-medium" : "text-ink-muted"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          r.ok
                            ? "bg-status-success text-white"
                            : "border border-ink-border"
                        }`}
                        aria-hidden="true"
                      >
                        {r.ok && <Check className="w-2 h-2" strokeWidth={4} />}
                      </span>
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Confirm password */}
              <div className="min-w-0">
                <div className={labelRowClass}>
                  <label htmlFor="confirmPassword" className={labelClass}>
                    Confirm password
                  </label>
                  {passwordsMatch && (
                    <span
                      className={`${statusClass} text-status-success inline-flex items-center gap-0.5`}
                    >
                      <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
                      Passwords match
                    </span>
                  )}
                  {confirmMismatch && (
                    <span className={`${statusClass} text-status-error`}>
                      Doesn&apos;t match yet
                    </span>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    tabIndex={-1}
                    className={eyeToggleClass}
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
                  <input
                    id="confirmPassword"
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={confirmMismatch}
                    className={inputClass(confirmMismatch)}
                  />
                </div>
              </div>

              {/* Terms */}
              <div className="sm:col-span-2 flex items-start gap-2.5">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-brand-border accent-brand-forest cursor-pointer"
                />
                <label
                  htmlFor="terms"
                  className="text-[12px] leading-snug text-ink-secondary cursor-pointer"
                >
                  I agree to the{" "}
                  <span className="font-semibold text-ink">Terms of Service</span>{" "}
                  and{" "}
                  <span className="font-semibold text-ink">Privacy Policy</span>.
                  I understand my data is handled with care.
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="sm:col-span-2 group w-full h-11 px-4 py-2 bg-brand-forest hover:bg-brand-hover active:bg-brand-hover text-white font-semibold text-sm rounded-[10px] transition-all shadow-[0_1px_2px_rgba(15,70,64,0.25),0_8px_18px_-8px_rgba(20,91,83,0.55)] hover:-translate-y-px active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-rich/30"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <>
                    <span>Create secure account</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-brand-border/60 text-center">
              <p className="text-[13px] text-ink-secondary">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-ink hover:text-brand-forest hover:underline underline-offset-2 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-muted leading-relaxed [@media(max-height:820px)]:!hidden">
            <Lock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span>
              Your information is kept private. You are always in control of
              what you share.
            </span>
          </p>
        </motion.div>
      </main>
    </div>
  );
}