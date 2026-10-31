import React, { useState } from "react";
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
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#059669" }}>
              ⚖️
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
                7. Formal Legal Complaint Draft
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#b91c1c", fontWeight: 700, letterSpacing: "0.06em", display: "block", marginTop: "0.15rem" }}>
                DRAFT — FOR USER AND LEGAL REVIEW ONLY
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
          backgroundColor: "#fef2f2",
          border: "1.5px solid #fecaca",
          borderRadius: "12px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "1.25rem" }}>🛑</span>
          <h4 style={{ color: "#991b1b", fontSize: "0.95rem", fontWeight: 700 }}>
            STRICT LEGAL SAFEGUARD: NO AUTOMATIC TRANSMISSION
          </h4>
        </div>
        <p style={{ fontSize: "0.85rem", color: "#7f1d1d", lineHeight: 1.55 }}>
          {draft.mandatory_human_review_notice}
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "#991b1b" }}>
          <span>
            <strong>Official Filing Portal:</strong>{" "}
            <a href={draft.filing_portal_url} target="_blank" rel="noopener noreferrer" style={{ color: "#059669", textDecoration: "underline", fontWeight: 700 }}>
              {draft.filing_portal_url}
            </a>
          </span>
          <span>
            <strong>Emergency Helpline:</strong> <span style={{ fontWeight: 800, color: "#065f46" }}>{draft.emergency_helpline}</span>
          </span>
        </div>
      </div>

      {/* Statutory Citations Indexed */}
      {draft.statutory_provisions_cited && draft.statutory_provisions_cited.length > 0 && (
        <div
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            marginBottom: "1.5rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem", color: "#065f46" }}>Statutory Citations Incorporated:</strong>
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
              {copyFeedback ? "✓ Copied!" : "📋 Copy to Clipboard"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-emerald btn-secondary"
              style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
            >
              💾 Download Markdown (.md)
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
            backgroundColor: "#fcfdfc",
          }}
        />
      </div>

      {/* Review Acknowledgment Form */}
      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #a7f3d0",
          padding: "1.25rem",
          borderRadius: "12px",
          marginBottom: "1.5rem",
        }}
      >
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.875rem", color: "#064e3b", cursor: "pointer", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={hasAcknowledgedReview}
            onChange={(e) => setHasAcknowledgedReview(e.target.checked)}
            style={{ marginTop: "0.2rem", accentColor: "#059669", width: "17px", height: "17px", cursor: "pointer" }}
          />
          <span>
            <strong>Affirmative Review Confirmation:</strong> I have personally reviewed this complaint draft and verify that the factual statements reflect my personal knowledge. I understand that I must independently file this with authorities at <em>cybercrime.gov.in</em> or the local police station.
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
        {isFinalizing ? "Recording Review Confirmation..." : "Confirm Review & Finalize Draft for Export"}
      </button>
    </div>
  );
};
