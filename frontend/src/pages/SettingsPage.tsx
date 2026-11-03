import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import {
  User,
  KeyRound,
  Clock,
  Download,
  Trash2,
  CheckCircle2,
  Mail,
  Shield,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const { user, logout, resetPassword } = useAuth();
  const [retentionPolicy, setRetentionPolicy] = useState(
    "TEMPORARY_EXPLORATORY"
  );
  const [resetSuccess, setResetSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 5000);
    } catch {
      alert("Unable to send password reset email. Please try again.");
    }
  };

  const handleDownloadData = () => {
    const data = {
      account_id: user?.uid,
      email: user?.email,
      name: user?.displayName,
      export_timestamp: new Date().toISOString(),
      platform: "ShieldHer Private Support",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ShieldHer_Account_Data.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        "Are you sure you want to request deletion of your account and related records? This action cannot be undone."
      )
    ) {
      logout();
      window.location.href = "/login";
    }
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
          Manage your account credentials, security settings, and data retention
          guarantees.
        </p>
      </div>

      {resetSuccess && (
        <div className="p-4 rounded-xl bg-brand-sage/30 border border-brand-border text-ink text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand-rich flex-shrink-0" />
          <span className="font-medium">Password reset instructions have been dispatched to your email.</span>
        </div>
      )}

      {downloadSuccess && (
        <div className="p-4 rounded-xl bg-brand-sage/30 border border-brand-border text-ink text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand-rich flex-shrink-0" />
          <span className="font-medium">Your account record package has been downloaded.</span>
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
            <label className="block text-xs font-bold text-ink font-heading mb-1.5">
              Preferred Name / Pseudonym
            </label>
            <input
              type="text"
              className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-[#FAF8F5] border border-ink-border rounded-xl cursor-not-allowed select-all"
              value={user?.displayName || "Account Holder"}
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink font-heading mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-[#FAF8F5] border border-ink-border rounded-xl cursor-not-allowed select-all"
              value={user?.email || "user@example.com"}
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
          Need to change your password? We will send an encrypted one-time reset
          link to your verified email address.
        </p>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={handlePasswordReset}
        >
          <Mail className="w-3.5 h-3.5 text-ink-muted" />
          <span>Send Password Reset Email</span>
        </button>
      </div>

      {/* Privacy & Retention Settings */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-brand-forest" />
          <h3 className="text-base font-bold text-ink font-heading">
            Image Storage & Retention Policy
          </h3>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          When you check an image, it is evaluated on our isolated backend server
          instance. You choose how long the resulting forensic docket is
          retained:
        </p>

        <div className="max-w-md">
          <label className="block text-xs font-bold text-ink font-heading mb-1.5">
            Default Check Retention
          </label>
          <select
            className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
            value={retentionPolicy}
            onChange={(e) => setRetentionPolicy(e.target.value)}
          >
            <option value="TEMPORARY_EXPLORATORY">
              Temporary Check (Retained for 7 days, then automatically purged)
            </option>
            <option value="PRESERVED">
              Save for Legal Reporting (Retained for 365 days)
            </option>
          </select>
        </div>
      </div>

      {/* Data Export & Account Deletion */}
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
            <span>Download My Account Data</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-accent-coral hover:bg-accent-coralSoft transition-colors"
            onClick={handleDeleteAccount}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account Request</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
