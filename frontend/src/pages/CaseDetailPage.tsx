import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getCase, getComplaintDraft, deleteCase } from "../services/api";
import { CaseItem, ComplaintDraftResponse } from "../types/models";
import {
  Copy,
  Check,
  Trash2,
  ArrowLeft,
  Sparkles,
  Cpu,
  Loader2,
  FileImage,
} from "lucide-react";

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [complaintDraft, setComplaintDraft] =
    useState<ComplaintDraftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadRequest() {
      if (!caseId) return;
      setLoading(true);
      setError(null);
      try {
        const c = await getCase(caseId);
        if (isMounted) setCaseItem(c);

        try {
          const draft = await getComplaintDraft(caseId);
          if (isMounted) setComplaintDraft(draft);
        } catch (_) {}
      } catch {
        if (isMounted) {
          setError(
            "Unable to load this request. It may have been deleted or the reference link is invalid."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRequest();
    return () => {
      isMounted = false;
    };
  }, [caseId]);

  const handleDelete = async () => {
    if (!caseId) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this request and its records? This cannot be undone."
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      await deleteCase(caseId, "User requested removal");
      navigate("/cases");
    } catch {
      alert("Unable to delete request at this time. Please try again.");
      setDeleting(false);
    }
  };

  const handleCopyDraft = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-ink-muted">
        <Loader2 className="w-6 h-6 animate-spin text-brand-forest mx-auto mb-2.5" />
        <span>Loading request docket…</span>
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-8 shadow-xs space-y-4">
        <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink text-xs">
          <span>{error || "Request docket not found."}</span>
        </div>
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to My Requests</span>
        </Link>
      </div>
    );
  }

  const draftText = complaintDraft?.draft_text || complaintDraft?.markdown_body;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-10"
    >
      {/* Header Panel */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-canvas-sand text-ink-primary font-medium border border-ink-border/60">
              {caseItem.case_number}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                caseItem.status === "CLOSED"
                  ? "bg-canvas-sand text-ink-secondary"
                  : "bg-brand-sage/50 text-brand-forest border border-brand-border"
              }`}
            >
              {caseItem.status === "CLOSED" ? "Closed" : "Active"}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
            {caseItem.title || "Image Assessment Request"}
          </h2>
          <p className="text-xs text-ink-secondary mt-1">
            Created on {new Date(caseItem.created_at).toLocaleDateString()} &bull;
            Retention Policy: {caseItem.retention_policy}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/cases"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Requests</span>
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-accent-coral hover:bg-accent-coralSoft transition-colors"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleting ? "Deleting…" : "Delete Request"}</span>
          </button>
        </div>
      </div>

      {/* Assessment Summary Section */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-ink font-heading">
            Assessment Summary
          </h3>
          <p className="text-xs text-ink-secondary mt-0.5 font-sans">
            Automated checks evaluated facial contours and synthesis pattern
            indicators on the uploaded evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 shadow-2xs">
            <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
              <Sparkles className="w-4 h-4 text-brand-forest" />
              <span>Face Manipulation Check</span>
            </div>
            <div className="text-base font-bold text-ink font-heading">
              {caseItem.review_status === "CONFIRMED_MANIPULATION"
                ? "Possible manipulation flagged"
                : "Evaluated"}
            </div>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
              Examined edge blending and lighting consistency around facial
              features.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 shadow-2xs">
            <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
              <Cpu className="w-4 h-4 text-brand-forest" />
              <span>AI Generation Check</span>
            </div>
            <div className="text-base font-bold text-ink font-heading">
              Diffusion fingerprint check
            </div>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
              Examined whole-frame frequency noise for AI generator traces.
            </p>
          </div>
        </div>
      </div>

      {/* Preserved Evidence Section */}
      {caseItem.evidence_items && caseItem.evidence_items.length > 0 && (
        <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-ink-border/60">
            <h3 className="text-base font-bold text-ink font-heading">
              Preserved Evidence Record
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] border-b border-ink-border text-ink-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 sm:px-6">File Name</th>
                  <th className="py-3 px-4 sm:px-6">Size</th>
                  <th className="py-3 px-4 sm:px-6">Cryptographic SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border/50">
                {caseItem.evidence_items.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <FileImage className="w-3.5 h-3.5 text-brand-forest flex-shrink-0" />
                        <span className="font-semibold">{ev.filename_sanitized}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-ink-secondary">
                      {(ev.file_size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] text-ink break-all">
                      {ev.original_sha256}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complaint Draft Section */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink font-heading">
            Prepared Complaint Draft
          </h3>
          {draftText && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
              onClick={() => handleCopyDraft(draftText)}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-brand-rich" />
                  <span className="text-brand-forest">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-ink-muted" />
                  <span>Copy Draft</span>
                </>
              )}
            </button>
          )}
        </div>

        {draftText ? (
          <div className="p-5 sm:p-6 rounded-2xl bg-[#F8F6F1] border border-ink-border font-mono text-xs text-ink leading-relaxed whitespace-pre-wrap select-all shadow-inner">
            {draftText}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-[#FAF8F5] border border-ink-border">
            <p className="text-xs text-ink-secondary mb-3 font-medium">
              No complaint draft has been formatted for this request yet.
            </p>
            <Link
              to="/verification/report"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-forest text-surface-pearl text-xs font-semibold hover:bg-brand-rich transition-colors shadow-xs"
            >
              <span>Prepare a Report</span>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
