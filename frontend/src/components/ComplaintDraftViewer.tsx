import React, { useState } from "react";
import { AlertTriangle, ClipboardCopy, Download, Scale } from "lucide-react";
import { ComplaintDraftResponse } from "../types/models";

interface ComplaintDraftViewerProps {
  draft: ComplaintDraftResponse;
  onConfirmReview: () => Promise<void>;
  isFinalizing: boolean;
}

export const ComplaintDraftViewer: React.FC<ComplaintDraftViewerProps> = ({
  draft,
  onConfirmReview,
  isFinalizing,
}) => {
  const [editedBody, setEditedBody] = useState(draft.markdown_body);
  const [hasAcknowledgedReview, setHasAcknowledgedReview] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedBody);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([editedBody], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ShieldHer_Complaint_Draft_${draft.case_id.slice(0, 8)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isFinal = draft.draft_status === "FINALIZED_FOR_EXPORT";

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--accent-surface)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
              <Scale size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
                7. Formal Legal Complaint Draft
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--status-review)", fontWeight: 500, display: "block", marginTop: "0.15rem" }}>
                Draft for user and legal review only
              </span>
            </div>
          </div>
        </div>
        <span className={`badge-clean ${isFinal ? "badge-emerald" : "badge-amber"}`}>
          <span className="status-dot-emerald" /> {draft.draft_status}
        </span>
      </div>

      {/* Mandatory Non-Transmission Safeguard Banner */}
      <div
        style={{
          backgroundColor: "var(--status-info-bg)",
          border: "1px solid var(--status-info-border)",
          borderRadius: "12px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <AlertTriangle size={19} aria-hidden="true" />
          <h4 style={{ color: "var(--status-info)", fontSize: "0.95rem", fontWeight: 600 }}>
            Legal safeguard: no automatic transmission
          </h4>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {draft.mandatory_human_review_notice}
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--text-primary)" }}>
          <span>
            <strong>Official filing portal:</strong>{" "}
            <a href={draft.filing_portal_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)", textDecoration: "underline", fontWeight: 600 }}>
              {draft.filing_portal_url}
            </a>
          </span>
          <span>
            <strong>Emergency helpline:</strong> <span style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{draft.emergency_helpline}</span>
          </span>
        </div>
      </div>

      {/* Statutory Citations Indexed */}
      {draft.statutory_provisions_cited && draft.statutory_provisions_cited.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--surface-secondary)",
            border: "1px solid var(--border-light)",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            marginBottom: "1.5rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem", color: "var(--accent-primary)" }}>Statutory citations included</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.6rem" }}>
            {draft.statutory_provisions_cited.map((citation, idx) => (
              <span
                key={idx}
                className="badge-clean badge-emerald"
                style={{ fontSize: "0.75rem" }}
              >
                {citation}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Editable Draft Viewer */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Inspect or customize draft wording prior to exporting:
          </span>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-emerald btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
            >
              {copyFeedback ? "Copied!" : <><ClipboardCopy size={15} aria-hidden="true" /> Copy to clipboard</>}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-emerald btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
            >
              <><Download size={15} aria-hidden="true" /> Download Markdown (.md)</>
            </button>
          </div>
        </div>

        <textarea
          rows={14}
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
          className="textarea-clean"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            backgroundColor: "var(--surface-primary)",
          }}
        />
      </div>

      {/* Review Acknowledgment Form */}
      <div
        style={{
          backgroundColor: "var(--accent-surface)",
          border: "1px solid var(--accent-border)",
          padding: "1.25rem",
          borderRadius: "12px",
          marginBottom: "1.5rem",
        }}
      >
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={hasAcknowledgedReview}
            onChange={(e) => setHasAcknowledgedReview(e.target.checked)}
            style={{ marginTop: "0.2rem", accentColor: "var(--accent-primary)", width: "17px", height: "17px", cursor: "pointer" }}
          />
          <span>
            <strong>Review confirmation:</strong> I have personally reviewed this complaint draft and verify that the factual statements reflect my personal knowledge. I understand that I must independently file this with authorities at <em>cybercrime.gov.in</em> or the local police station.
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={onConfirmReview}
        disabled={!hasAcknowledgedReview || isFinalizing}
        className="btn-emerald btn-success"
        style={{ width: "100%", padding: "0.85rem 1.5rem" }}
      >
        {isFinalizing ? "Recording your review..." : "Confirm review and finalize draft"}
      </button>
    </div>
  );
};
