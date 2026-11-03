import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import QuickExitBar from "../components/common/QuickExitBar";
import { Shield, KeyRound, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to send reset instructions. Check the email provided."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between selection:bg-brand-sage selection:text-brand-forest">
      <QuickExitBar />

      <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8">
        {/* Brand Banner */}
        <div className="flex items-center gap-3 mb-8">
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

        {/* Auth Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md bg-surface-pearl rounded-2xl border border-ink-border/80 p-7 sm:p-9 shadow-md shadow-ink-primary/5"
        >
          <div className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mb-3.5 border border-brand-border">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink font-heading tracking-tight">
              Reset your password
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-ink-secondary leading-relaxed">
              Enter your email address and we will dispatch secure recovery
              instructions to reset your credentials.
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

          {submitted ? (
            <div className="p-5 rounded-xl bg-brand-sage/30 border border-brand-border text-ink space-y-3">
              <div className="flex items-center gap-2 text-brand-forest font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Reset instructions sent</span>
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed">
                If an encrypted account matches <strong>{email}</strong>, you will receive a single-use verification link shortly.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-forest hover:text-brand-rich transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-semibold text-ink-primary mb-1.5"
                  htmlFor="reset-email"
                >
                  Email address
                </label>
                <input
                  id="reset-email"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 px-4 py-2 bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl font-medium text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-rich focus:ring-offset-2"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending link...
                  </span>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-ink-muted leading-relaxed">
          Need immediate crisis assistance? Call <strong className="text-ink-primary">1930</strong> (National Cybercrime Reporting).
        </p>
      </div>
    </div>
  );
}
