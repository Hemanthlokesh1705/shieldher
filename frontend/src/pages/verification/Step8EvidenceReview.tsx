import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { Shield, Copy, Check, ArrowRight, ArrowLeft, FileImage } from "lucide-react";
import { SensitiveImage } from "../../components/ui/SensitiveImage";

export default function Step8EvidenceReview() {
  const navigate = useNavigate();
  const { activeCase, uploadData, selectedFile, filePreviewUrl, consent } =
    useVerification();

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const caseNumber = activeCase?.case_number || activeCase?.id.slice(0, 8);
  const sha256 = uploadData?.sha256 || uploadData?.sha256_hash || null;
  const fileName = selectedFile?.name || "Not available";
  const fileSize = selectedFile
    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
    : "Not available";

  const handleCopyHash = async () => {
    if (!sha256) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Could not copy the digest. You can select and copy it manually.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          8. Evidence Inventory & Digital Receipt
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
          Review your preserved evidence summary and cryptographic verification
          receipt.
        </p>
      </div>

      {/* Case Identity Box */}
      <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block font-heading">
            Request Reference
          </span>
          <div className="text-base sm:text-lg font-bold text-ink font-mono mt-0.5">
            {caseNumber || "Not available"}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted block mb-1 font-heading">
            Retention Mode
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-sage/50 text-brand-forest border border-brand-border">
            {consent.retentionPolicy === "PRESERVED"
              ? "Saved for reporting (365 days)"
              : "Temporary check (7 days)"}
          </span>
        </div>
      </div>

      {/* Evidence Item Card */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-ink font-heading">
          Preserved Evidence Asset
        </h4>

        <div className="p-5 sm:p-6 rounded-2xl bg-surface-pearl border border-ink-border/80 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-start gap-5">
            {filePreviewUrl && (
              <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border border-ink-border shadow-2xs">
                <SensitiveImage
                  src={filePreviewUrl}
                  alt="Preserved evidence preview"
                  aspectRatio="aspect-square"
                />
              </div>
            )}

            <div className="flex-1 min-w-[220px] space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-brand-forest flex-shrink-0" />
                <strong className="text-sm text-ink font-bold font-heading">{fileName}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3 text-ink-secondary">
                <div>
                  <span className="text-ink-muted block text-[11px]">Format:</span>
                  <span className="font-semibold text-ink">
                    {selectedFile?.type || "Not available"}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[11px]">Size:</span>
                  <span className="font-semibold text-ink">{fileSize}</span>
                </div>
              </div>

              <div>
                <span className="text-ink-muted block mb-1 text-[11px] font-medium">
                  Cryptographic SHA-256 Digest:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] px-2.5 py-1.5 rounded-lg bg-canvas-sand text-ink break-all select-all flex-1 font-medium">
                    {sha256 || "Not available"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    disabled={!sha256}
                    className="min-h-10 min-w-10 p-2 rounded-lg border border-ink-border bg-surface-pearl hover:bg-canvas-subtle transition-colors flex-shrink-0 shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Copy SHA-256 digest"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-brand-rich" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-ink-muted" />
                    )}
                  </button>
                </div>
                {copyError && (
                  <p className="mt-1 text-[11px] text-status-error" role="alert">
                    {copyError}
                  </p>
                )}
                {copied && (
                  <p className="mt-1 text-[11px] text-brand-forest" role="status">
                    Digest copied.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Digest explanation */}
      <div className="p-4 sm:p-5 rounded-2xl bg-brand-sage/20 border border-brand-border flex items-start gap-3.5 text-xs text-ink-secondary leading-relaxed">
        <div className="w-8 h-8 rounded-xl bg-brand-sage/60 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-border">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <strong className="text-ink font-semibold">
            About this digest:
          </strong>{" "}
          A SHA-256 digest is a fingerprint of the file. Matching digests
          indicate matching file contents; the digest alone does not establish
          where or when the file was obtained. Keep the original file and note
          how you received it.
        </div>
      </div>

      {/* Navigation Action Buttons */}
      <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={() => navigate("/verification/incident-details")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incident Info</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow"
          onClick={() => navigate("/verification/report")}
        >
          <span>Continue to Complaint Preparation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
