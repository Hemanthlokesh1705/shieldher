import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { generateComplaintDraft } from "../../services/api";
import {
  FileText,
  Copy,
  Check,
  Download,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function Step9Report() {
  const {
    activeCase,
    complaintDraft,
    setComplaintDraft,
    selectedFile,
    uploadData,
  } = useVerification();

  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOrCreateDraft() {
      if (complaintDraft || !activeCase) return;

      setGenerating(true);
      try {
        const res = await generateComplaintDraft(activeCase.id, true);
        if (isMounted) {
          setComplaintDraft(res);
        }
      } catch {
        if (isMounted) {
          setGenerationError(
            "We could not prepare a request-specific draft. A neutral template is available below."
          );
        }
      } finally {
        if (isMounted) setGenerating(false);
      }
    }

    loadOrCreateDraft();
    return () => {
      isMounted = false;
    };
  }, [activeCase, complaintDraft, setComplaintDraft]);

  const getFallbackDraft = () => {
    const caseNum = activeCase?.case_number || "[Add your request reference]";
    const sha = uploadData?.sha256 || uploadData?.sha256_hash;
    return `COMPLAINT STATEMENT — DRAFT

Reference: ${caseNum}
Date prepared: ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}

1. WHAT HAPPENED
[Describe what happened in your own words, including when you became aware of it.]

2. WHERE IT HAPPENED
[Add the website, platform, account name, or other details you know.]

3. INFORMATION I CAN PROVIDE
- Image file: ${selectedFile?.name || "[Add file name, if available]"}
- SHA-256 digest: ${sha || "[Add digest, if available]"}
- Relevant dates, messages, or account details: [Add details, if available]

4. SUPPORT REQUESTED
[Describe what help or follow-up you are requesting.]

Submitted by: [Add your name or preferred contact details]`;
  };

  const draftContent =
    complaintDraft?.draft_text ||
    complaintDraft?.markdown_body ||
    getFallbackDraft();

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(draftContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError("Could not copy the draft. You can select and copy its text manually.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([draftContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ShieldHer_Complaint_${activeCase?.case_number || "Draft"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
            9. Formal Complaint Draft
          </h3>
          <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
            Review and edit this starting point before sharing it with a platform
            or support service.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs disabled:cursor-wait disabled:opacity-50"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-brand-rich" />
                <span className="text-brand-forest">Copied to clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-ink-muted" />
                <span>Copy text</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs font-semibold transition-colors shadow-xs hover:shadow disabled:cursor-wait disabled:opacity-50"
            onClick={handleDownload}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt</span>
          </button>
        </div>
      </div>

      {/* Official Helplines & Reporting Portals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <a
          href="https://cybercrime.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 hover:border-brand-rich/50 transition-all group block shadow-2xs"
        >
          <div className="text-xs font-bold text-ink font-heading flex items-center justify-between">
            <span>Cybercrime Portal (India)</span>
            <ExternalLink className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-forest transition-colors" />
          </div>
          <p className="text-[11px] text-ink-secondary mt-1.5 leading-relaxed">
            Visit the government portal for current reporting options and guidance.
          </p>
        </a>

        <a
          href="https://stopncii.org"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 hover:border-brand-rich/50 transition-all group block shadow-2xs"
        >
          <div className="text-xs font-bold text-ink font-heading flex items-center justify-between">
            <span>StopNCII.org (Global)</span>
            <ExternalLink className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-forest transition-colors" />
          </div>
          <p className="text-[11px] text-ink-secondary mt-1.5 leading-relaxed">
            Creates a non-reversible hash on your device to prevent distribution
            across tech platforms.
          </p>
        </a>

        <a
          href="https://takeitdown.ncmec.org"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 hover:border-brand-rich/50 transition-all group block shadow-2xs"
        >
          <div className="text-xs font-bold text-ink font-heading flex items-center justify-between">
            <span>Take It Down (NCMEC)</span>
            <ExternalLink className="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-forest transition-colors" />
          </div>
          <p className="text-[11px] text-ink-secondary mt-1.5 leading-relaxed">
            Confidential assistance to remove intimate images taken before age 18.
          </p>
        </a>
      </div>

      {/* Complaint draft */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-heading">
          Complaint draft
        </h4>

        <div className="rounded-xl border border-ink-border bg-surface-secondary p-4 text-sm leading-relaxed text-ink-secondary">
          This is a starting point, not legal advice or a filed report. Check
          that every detail is accurate, remove anything you do not want to
          share, and consider asking a trusted support person to review it.
        </div>

        {generationError && (
          <p className="rounded-lg border border-status-warningBorder bg-status-warningBg px-4 py-3 text-sm text-status-warning" role="status">
            {generationError}
          </p>
        )}

        {copyError && (
          <p className="rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-error" role="alert">
            {copyError}
          </p>
        )}

        {generating ? (
          <div className="p-12 text-center rounded-2xl bg-[#FAF8F5] border border-ink-border/80">
            <Loader2 className="w-6 h-6 animate-spin text-brand-forest mx-auto mb-2.5" />
            <p className="text-xs text-ink-secondary font-medium">
              Preparing your draft…
            </p>
          </div>
        ) : (
          <div className="p-5 sm:p-6 rounded-2xl bg-[#F8F6F1] border border-ink-border/80 font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto select-all shadow-inner">
            {draftContent}
          </div>
        )}
      </div>

      {/* Navigation Action Buttons */}
      <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-ink-muted" />
          <span>View in My Requests</span>
        </Link>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Finish & Return to Home</span>
        </Link>
      </div>
    </motion.div>
  );
}
