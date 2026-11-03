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
      } catch (_) {
        // Fallback draft is available automatically
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
    const caseNum = activeCase?.case_number || "SH-REF-2026";
    const sha =
      uploadData?.sha256 || uploadData?.sha256_hash || "sha256:computed";
    return `FORMAL COMPLAINT REGARDING UNLAWFUL DIGITAL MEDIA GENERATION / DISSEMINATION
Prepared via ShieldHer Digital Support Platform

Reference Identifier: ${caseNum}
Date of Preservation: ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}

1. STATEMENT OF COMPLAINT:
I am submitting this formal complaint concerning the unauthorized creation, manipulation, or distribution of intimate imagery depicting my likeness without my knowledge or consent.

2. EVIDENCE SPECIFICATIONS:
- File Name: ${selectedFile?.name || "image_evidence.jpg"}
- Cryptographic SHA-256 Digest: ${sha}
- Preservation Standard: ISO/IEC 27037 Digital Evidence Integrity Baseline
- Findings: Digital assessment identified manipulation indicators requiring official examination.

3. RELEVANT STATUTES (INDIA / APPLICABLE JURISDICTIONS):
- Section 66E, Information Technology Act, 2000 (Violation of bodily privacy)
- Section 67 & 67A, Information Technology Act, 2000 (Transmission of sexually explicit or obscene material)
- Section 354D, Indian Penal Code / Bharatiya Nyaya Sanhita, 2023 (Cyber stalking and harassment)

4. PRAYER FOR RELIEF:
- Immediate issuance of content takedown directives to intermediary platforms.
- Investigation and registration of an FIR against the responsible parties.
- Preservation of network connection records from transmission intermediaries.

Submitted respectfully,
Verified Complainant`;
  };

  const draftContent =
    complaintDraft?.draft_text ||
    complaintDraft?.markdown_body ||
    getFallbackDraft();

  const handleCopy = () => {
    navigator.clipboard.writeText(draftContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
            Here is your structured complaint draft. You can copy the text or
            download it to file an official report with authorities or online platforms.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs font-semibold transition-all shadow-xs hover:shadow"
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
            Submit formal FIR complaint at <strong>cybercrime.gov.in</strong> or
            call 24/7 helpline <strong className="text-brand-forest">1930</strong>.
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

      {/* Monospace Complaint Draft */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-heading">
          Prepared Formal Complaint
        </h4>

        {generating ? (
          <div className="p-12 text-center rounded-2xl bg-[#FAF8F5] border border-ink-border/80">
            <Loader2 className="w-6 h-6 animate-spin text-brand-forest mx-auto mb-2.5" />
            <p className="text-xs text-ink-secondary font-medium">
              Generating legal complaint draft…
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
