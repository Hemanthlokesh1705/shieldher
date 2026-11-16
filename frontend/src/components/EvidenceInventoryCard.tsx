import React, { useState } from "react";
import {
  Archive,
  Download,
  Info,
  KeyRound,
} from "lucide-react";
import { CaseItem, DownloadUrlResponse } from "../types/models";
import { getEvidenceDownloadUrl, deleteEvidence, deleteCase } from "../services/api";
import { ConfirmDialog } from "./ui/ConfirmDialog";

interface EvidenceInventoryCardProps {
  caseData: CaseItem;
  onRefreshCase: () => Promise<void>;
}

export const EvidenceInventoryCard: React.FC<EvidenceInventoryCardProps> = ({
  caseData,
  onRefreshCase,
}) => {
  const [downloadLinks, setDownloadLinks] = useState<Record<string, DownloadUrlResponse>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ type: "evidence" | "case"; id: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequestDownload = async (evidenceId: string) => {
    setLoadingEvidenceId(evidenceId);
    setMessage(null);
    try {
      const res = await getEvidenceDownloadUrl(caseData.id, evidenceId);
      setDownloadLinks((prev) => ({ ...prev, [evidenceId]: res }));
    } catch (err: any) {
      setMessage(`Download URL failed: ${err.message}`);
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteModal || deleteReason.trim().length < 5) return;
    setIsDeleting(true);
    setMessage(null);
    try {
      if (deleteModal.type === "evidence") {
        await deleteEvidence(caseData.id, deleteModal.id, deleteReason);
        setMessage("Evidence item deleted.");
      } else {
        await deleteCase(caseData.id, deleteReason);
        setMessage("Request and its associated evidence deleted.");
      }
      setDeleteModal(null);
      setDeleteReason("");
      await onRefreshCase();
    } catch (err: any) {
      setMessage(`Deletion error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--accent-surface)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
            <Archive size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              8. Evidence Inventory & Custody Vault
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)" }}>
              Authenticated cryptographic asset custody with HMAC download tokens
            </p>
          </div>
        </div>
        <span className="badge-clean badge-emerald">
          <span className="status-dot-emerald" /> AES-256-GCM Encrypted at Rest
        </span>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "1.5rem", backgroundColor: "var(--surface-secondary)", padding: "0.85rem 1.15rem", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
        <span><strong>Case ID:</strong> <code style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>{caseData.id}</code></span>
        <span><strong>Retention Policy:</strong> <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{caseData.retention_policy}</span></span>
        <span>
          <strong>Retention Expiration:</strong>{" "}
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {caseData.retention_expires_at
              ? new Date(caseData.retention_expires_at).toLocaleString()
              : "Indefinite / Not Scheduled"}
          </span>
        </span>
      </div>

      {message && (
        <div
          className="animate-fade-in"
          style={{
            backgroundColor: "var(--status-info-bg)",
            border: "1px solid var(--status-info-border)",
            color: "var(--status-info)",
            padding: "0.85rem 1.15rem",
            borderRadius: "10px",
            marginBottom: "1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          <Info size={16} aria-hidden="true" /> {message}
        </div>
      )}

      {/* Evidence items list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.75rem" }}>
        {caseData.evidence_items && caseData.evidence_items.length > 0 ? (
          caseData.evidence_items.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: "var(--surface-primary)",
                padding: "1.15rem 1.25rem",
                borderRadius: "12px",
                border: "1px solid var(--border-light)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: "0.925rem" }}>
                  {item.filename_sanitized} {item.is_deleted ? " [PURGED]" : ""}
                </span>
                <span style={{ fontSize: "0.775rem", color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  SHA-256: {item.original_sha256}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  {(item.file_size_bytes / 1024).toFixed(1)} KB — {item.mime_type} — Added: {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                {!item.is_deleted && (
                  <>
                    {downloadLinks[item.id] ? (
                      <a
                        href={downloadLinks[item.id].download_url}
                        download
                        className="btn-emerald btn-success"
                        style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", textDecoration: "none" }}
                      >
                        <Download size={15} aria-hidden="true" /> Download original (expires {new Date(downloadLinks[item.id].expires_at_utc).toLocaleTimeString()})
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestDownload(item.id)}
                        disabled={loadingEvidenceId === item.id}
                        className="btn-emerald btn-secondary"
                        style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                      >
                        {loadingEvidenceId === item.id ? "Signing..." : <><KeyRound size={15} aria-hidden="true" /> Issue signed download</>}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteModal({ type: "evidence", id: item.id })}
                      className="btn-danger"
                      style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                    >
                      Delete item
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>No evidence items recorded yet.</p>
        )}
      </div>

      {/* Case-Level Secure Deletion */}
      <div
        style={{
          borderTop: "1px solid var(--border-light)",
          paddingTop: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h4 style={{ fontSize: "0.925rem", fontWeight: 500, color: "var(--text-primary)" }}>Delete this request</h4>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
            This also removes the evidence and reports linked to this request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteModal({ type: "case", id: caseData.id })}
          className="btn-danger"
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.825rem" }}
        >
          Delete request
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(deleteModal)}
        title={
          deleteModal?.type === "case"
            ? "Delete this request?"
            : "Delete this evidence item?"
        }
        description={
          deleteModal?.type === "case"
            ? "This also removes the evidence and reports linked to this request."
            : "This removes the selected evidence item from this request."
        }
        confirmLabel="Delete"
        variant="destructive"
        busy={isDeleting}
        confirmDisabled={deleteReason.trim().length < 5}
        onCancel={() => {
          setDeleteModal(null);
          setDeleteReason("");
        }}
        onConfirm={handleExecuteDelete}
      >
        <label
          className="confirmation-dialog-reason-label"
          htmlFor="evidence-deletion-reason"
        >
          Reason for deletion
        </label>
        <textarea
          id="evidence-deletion-reason"
          rows={3}
          value={deleteReason}
          onChange={(event) => setDeleteReason(event.target.value)}
          placeholder="Enter at least 5 characters"
          className="confirmation-dialog-reason"
        />
        {deleteReason.trim().length > 0 && deleteReason.trim().length < 5 && (
          <p className="confirmation-dialog-hint">
            Please enter at least 5 characters.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
};
