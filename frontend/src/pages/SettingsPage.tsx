import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthContext";
import {
  User,
  KeyRound,
  Clock,
  Download,
  CheckCircle2,
  Mail,
  Shield,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const { user, resetPassword } = useAuth();
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      setResetSuccess(true);
      setResetError(null);
      setTimeout(() => setResetSuccess(false), 5000);
    } catch {
      setResetError("We couldn’t send the password reset email. Please try again.");
    }
  };

  const handleDownloadData = () => {
    const data = {
      account_id: user?.uid,
      email: user?.email,
      name: user?.displayName,
      export_timestamp: new Date().toISOString(),
      platform: "ShieldHer",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ShieldHer_Account_Profile.json";
    link.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-10"
    >
      {/* Intro Panel */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs">
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-heading">
          Account & Privacy
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 font-sans">
          Review your account details, security options, and available data
          controls.
        </p>
      </div>

      {resetSuccess && (
        <div className="p-4 rounded-xl bg-brand-sage/30 border border-brand-border text-ink text-xs flex items-center gap-2" role="status">
          <CheckCircle2 className="w-4 h-4 text-brand-rich flex-shrink-0" />
          <span className="font-medium">Password reset instructions were sent to your email.</span>
        </div>
      )}

      {downloadSuccess && (
        <div className="p-4 rounded-xl bg-brand-sage/30 border border-brand-border text-ink text-xs flex items-center gap-2" role="status">
          <CheckCircle2 className="w-4 h-4 text-brand-rich flex-shrink-0" />
          <span className="font-medium">Your account profile data has been downloaded.</span>
        </div>
      )}
      {/* Account Profile Card */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <User className="w-4 h-4 text-brand-forest" />
          <h3 className="text-base font-bold text-ink font-heading">
            Account Profile
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="account-display-name" className="block text-xs font-medium text-ink font-heading mb-1.5">
              Preferred Name / Pseudonym
            </label>
            <input
              id="account-display-name"
              type="text"
              className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-[#FAF8F5] border border-ink-border rounded-xl cursor-not-allowed select-all"
              value={user?.displayName || ""}
              placeholder="Not provided"
              readOnly
            />
          </div>

          <div>
            <label htmlFor="account-email" className="block text-xs font-medium text-ink font-heading mb-1.5">
              Email Address
            </label>
            <input
              id="account-email"
              type="email"
              className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-[#FAF8F5] border border-ink-border rounded-xl cursor-not-allowed select-all"
              value={user?.email || ""}
              placeholder="Not available"
              readOnly
            />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-2">
          <span className="text-xs text-ink-muted">Account Tier:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-sage/40 text-brand-forest border border-brand-border">
            <Lock className="w-3 h-3 text-brand-forest" />
            <span>Private Support Account</span>
          </span>
        </div>
      </div>

      {/* Security & Password */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-brand-forest" />
          <h3 className="text-base font-bold text-ink font-heading">
            Password & Security
          </h3>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Need to change your password? We can email a password reset link to
          your account address.
        </p>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={handlePasswordReset}
        >
          <Mail className="w-3.5 h-3.5 text-ink-muted" />
          <span>Send Password Reset Email</span>
        </button>
        {resetError && (
          <p className="text-sm text-status-error" role="alert">
            {resetError}
          </p>
        )}
      </div>

      {/* Per-check Retention */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-brand-forest" />
          <h3 className="text-base font-bold text-ink font-heading">
            Image Storage & Retention
          </h3>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Choose a retention option separately for each image check before
          uploading. This page does not change the policy for existing requests.
        </p>
        <Link
          to="/verification/consent"
          className="inline-flex min-h-10 items-center rounded-lg border border-ink-border bg-surface-pearl px-4 py-2 text-sm font-medium text-ink hover:bg-canvas-subtle transition-colors"
        >
          Choose options for an image check
        </Link>
      </div>

      {/* Data Export & Erasure */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-brand-forest" />
          <h3 className="text-base font-bold text-ink font-heading">
            Data Rights & Erasure
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={handleDownloadData}
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
            <span>Download account profile data</span>
          </button>
        </div>
        <p className="max-w-2xl text-sm text-ink-secondary leading-relaxed">
          You can remove individual requests from their detail pages. Account
          deletion is not currently available in the app.
        </p>
      </div>
    </motion.div>
  );
}
