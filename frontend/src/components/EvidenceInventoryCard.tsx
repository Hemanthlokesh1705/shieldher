import React, { useState } from "react";
import { CaseItem, DownloadUrlResponse } from "../types/models";
import { getEvidenceDownloadUrl, deleteEvidence, deleteCase } from "../services/api";

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
        setMessage("Evidence item securely purged and shredded.");
      } else {
        await deleteCase(caseData.id, deleteReason);
        setMessage("Entire case and all associated evidence securely purged.");
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
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#059669" }}>
            🗄️
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

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "1.5rem", backgroundColor: "#f8fafc", padding: "0.85rem 1.15rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <span><strong>Case ID:</strong> <code style={{ color: "#065f46", fontFamily: "var(--font-mono)" }}>{caseData.id}</code></span>
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
            backgroundColor: "#f0fdf4",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "0.85rem 1.15rem",
            borderRadius: "10px",
            marginBottom: "1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          ℹ️ {message}
        </div>
      )}

      {/* Evidence items list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.75rem" }}>
        {caseData.evidence_items && caseData.evidence_items.length > 0 ? (
          caseData.evidence_items.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: "#ffffff",
                padding: "1.15rem 1.25rem",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: "0.925rem" }}>
                  {item.filename_sanitized} {item.is_deleted ? " [PURGED]" : ""}
                </span>
                <span style={{ fontSize: "0.775rem", color: "#065f46", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
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
                        ⬇️ Download Original (Expires {new Date(downloadLinks[item.id].expires_at_utc).toLocaleTimeString()})
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestDownload(item.id)}
                        disabled={loadingEvidenceId === item.id}
                        className="btn-emerald btn-secondary"
                        style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                      >
                        {loadingEvidenceId === item.id ? "Signing..." : "🔑 Issue Signed Download"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteModal({ type: "evidence", id: item.id })}
                      className="btn-danger"
                      style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                    >
                      Purge Item
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
          borderTop: "1px solid #e2e8f0",
          paddingTop: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h4 style={{ fontSize: "0.925rem", fontWeight: 700, color: "#b91c1c" }}>Cryptographic Case Shredding</h4>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
            Permanently destroys all encrypted original files, metadata, and derived reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteModal({ type: "case", id: caseData.id })}
          className="btn-danger"
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.825rem" }}
        >
          Purge Entire Case
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="app-card"
            style={{
              padding: "2rem",
              maxWidth: "520px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              marginBottom: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.3rem" }}>⚠️</span>
              <h3 style={{ color: "#b91c1c", fontSize: "1.2rem", fontWeight: 700 }}>
                Confirm Cryptographic Shredding
              </h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1rem", lineHeight: 1.55 }}>
              This operation executes multi-pass cryptographic overwrite and removes the decryption keys.
              Please provide a documented justification for this deletion request:
            </p>
            <textarea
              rows={3}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Victim explicit right-to-erasure request under personal privacy protocol."
              className="textarea-clean"
              style={{ marginBottom: "1.25rem" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.85rem" }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteReason("");
                }}
                className="btn-emerald btn-secondary"
                style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={deleteReason.trim().length < 5 || isDeleting}
                className="btn-danger"
                style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem" }}
              >
                {isDeleting ? "Shredding..." : "Confirm Secure Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
