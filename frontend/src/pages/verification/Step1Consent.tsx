import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { UserCheck, ScanFace, Cpu, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "../../lib/utils";

export default function Step1Consent() {
  const navigate = useNavigate();
  const { consent, setConsent } = useVerification();
  const [consentError, setConsentError] = React.useState<string | null>(null);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent.allowLocalAnalysis) {
      setConsentError("Please allow image analysis before continuing.");
      return;
    }
    setConsentError(null);
    navigate("/verification/upload");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs"
    >
      <div className="mb-7">
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          1. Privacy & Consent Preferences
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1.5 leading-relaxed font-sans max-w-2xl">
          Take a moment to review how your image is evaluated and choose your
          confidentiality preferences. You remain in complete control at every stage.
        </p>
      </div>

      <form onSubmit={handleContinue} className="space-y-7">
        {consentError && (
          <p
            className="rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-error"
            role="alert"
          >
            {consentError}
          </p>
        )}
        {/* Model Explanation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-surface-subtle border border-ink-border/70 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-subtle/40 text-brand-forest flex items-center justify-center mb-3.5 border border-brand-border">
                <UserCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-ink font-heading">
                Face Detection Check
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Detects if one or more human faces are present in the image so
                analysis focuses on relevant regions. No biometric identity
                database is created or consulted.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-brand-forest mt-4 pt-2.5 border-t border-ink-border/50 block">
              MediaPipe localized
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-surface-subtle border border-ink-border/70 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-subtle/40 text-brand-forest flex items-center justify-center mb-3.5 border border-brand-border">
                <ScanFace className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-ink font-heading">
                Face Manipulation Check
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Examines boundary edges and facial contours for signs of face
                swapping, splicing, or artificial warping using deep feature
                diagnostics.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-brand-forest mt-4 pt-2.5 border-t border-ink-border/50 block">
              EFFORT forensic model
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-surface-subtle border border-ink-border/70 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-surface-subtle/40 text-brand-forest flex items-center justify-center mb-3.5 border border-brand-border">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-ink font-heading">
                AI Generation Check
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Looks for subtle frequency traces that are typical of images
                synthesized by text-to-image or diffusion generators.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-brand-forest mt-4 pt-2.5 border-t border-ink-border/50 block">
              Smaug detector
            </span>
          </div>
        </div>

        {/* Retention Policy Selection */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-ink font-heading mb-2.5">
            How would you like this check handled?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={cn(
                "flex items-start gap-3.5 p-5 rounded-2xl border cursor-pointer transition-all shadow-2xs",
                consent.retentionPolicy === "TEMPORARY_EXPLORATORY"
                  ? "bg-surface-subtle/20 border-brand-forest ring-1 ring-brand-forest"
                  : "bg-surface-pearl border-ink-border/80 hover:border-ink-borderStrong"
              )}
            >
              <input
                type="radio"
                name="retention"
                className="mt-1 text-brand-forest focus:ring-action"
                checked={consent.retentionPolicy === "TEMPORARY_EXPLORATORY"}
                onChange={() =>
                  setConsent((prev) => ({
                    ...prev,
                    retentionPolicy: "TEMPORARY_EXPLORATORY",
                  }))
                }
              />
              <div className="text-xs">
                <strong className="block text-sm text-ink font-bold font-heading mb-1">
                  Temporary Check (up to 7 days)
                </strong>
                <p className="text-ink-secondary leading-relaxed">
                  The request is kept for up to 7 days. You can delete it sooner
                  from My Requests.
                </p>
              </div>
            </label>

            <label
              className={cn(
                "flex items-start gap-3.5 p-5 rounded-2xl border cursor-pointer transition-all shadow-2xs",
                consent.retentionPolicy === "PRESERVED"
                  ? "bg-surface-subtle/20 border-brand-forest ring-1 ring-brand-forest"
                  : "bg-surface-pearl border-ink-border/80 hover:border-ink-borderStrong"
              )}
            >
              <input
                type="radio"
                name="retention"
                className="mt-1 text-brand-forest focus:ring-action"
                checked={consent.retentionPolicy === "PRESERVED"}
                onChange={() =>
                  setConsent((prev) => ({
                    ...prev,
                    retentionPolicy: "PRESERVED",
                  }))
                }
              />
              <div className="text-xs">
                <strong className="block text-sm text-ink font-bold font-heading mb-1">
                  Keep for Reporting (up to 365 days)
                </strong>
                <p className="text-ink-secondary leading-relaxed">
                  Keep the request available for up to 365 days while you
                  prepare a report. A SHA-256 hash is generated for reference.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Clear Consents */}
        <div className="p-5 rounded-2xl bg-surface-subtle border border-ink-border/80 space-y-3.5 shadow-2xs">
          <div className="text-xs font-bold text-ink uppercase tracking-wider font-heading">
            Your Explicit Permission
          </div>

          <label className="flex items-start gap-3 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded text-brand-forest focus:ring-action"
              checked={consent.allowLocalAnalysis}
              onChange={(e) =>
                setConsent((prev) => ({
                  ...prev,
                  allowLocalAnalysis: e.target.checked,
                }))
              }
              required
            />
            <span className="leading-relaxed">
              <strong className="text-ink-primary font-semibold">Required:</strong> I authorize ShieldHer to process my
              uploaded image to evaluate face manipulation and AI generation.
            </span>
          </label>

          <label className="flex items-start gap-3 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded text-brand-forest focus:ring-action"
              checked={consent.allowReverseSearch}
              onChange={(e) =>
                setConsent((prev) => ({
                  ...prev,
                  allowReverseSearch: e.target.checked,
                }))
              }
            />
            <span className="leading-relaxed">
              <strong className="text-ink-primary font-semibold">Optional:</strong> Allow checking if this image has been
              published online on public web platforms (requires querying an
              external search gateway).
            </span>
          </label>
        </div>

        {/* Navigation Action Buttons */}
        <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action hover:bg-action-hover active:bg-action-hover text-action-ink text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
            disabled={!consent.allowLocalAnalysis}
          >
            <span>Continue to Image Upload</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}