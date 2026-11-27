import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  ShieldCheck,
} from "lucide-react";

interface EvidenceUploadCardProps {
  onUpload: (file: File, localConsent: boolean) => Promise<void>;
  isLoading: boolean;
}

export const EvidenceUploadCard: React.FC<EvidenceUploadCardProps> = ({ onUpload, isLoading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localConsent, setLocalConsent] = useState(true);
  const [forensicConsent, setForensicConsent] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Unsupported format. Please select JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > maxSizeBytes) {
      setErrorMessage("File exceeds 20MB size limit. Please upload a smaller file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    if (!localConsent || !forensicConsent) {
      setErrorMessage("Please review and acknowledge both privacy consent items before processing.");
      return;
    }
    await onUpload(selectedFile, localConsent);
  };

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--accent-surface)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              1. Secure Evidence Intake
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              Upload an image to ShieldHer for quality checks. Optional online search is a separate step and requires your consent.
            </p>
          </div>
        </div>
        <span className="badge-clean badge-emerald">
          <span className="status-dot-emerald" /> Step 1 of 8
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: "1.25rem" }}>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: dragActive
              ? "2px solid var(--accent-primary)"
              : "2px dashed var(--accent-border)",
            borderRadius: "14px",
            padding: "2.75rem 1.5rem",
            textAlign: "center",
            backgroundColor: dragActive
              ? "var(--accent-surface)"
              : "var(--surface-primary)",
            cursor: "pointer",
            marginBottom: "1.25rem",
            boxShadow: dragActive ? "var(--shadow-xs)" : "none",
            transition: "all 0.2s ease",
          }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                validateAndSetFile(e.target.files[0]);
              }
            }}
          />
          <div style={{ width: "54px", height: "54px", borderRadius: "50%", backgroundColor: "var(--accent-surface)", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
            <FileUp size={23} aria-hidden="true" />
          </div>
          {selectedFile ? (
            <div className="animate-fade-in">
              <span className="badge-clean badge-emerald" style={{ marginBottom: "0.5rem" }}>
                <CheckCircle2 size={14} aria-hidden="true" /> File attached
              </span>
              <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.05rem", marginTop: "0.35rem" }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                {(selectedFile.size / 1024).toFixed(1)} KB — {selectedFile.type}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: "var(--color-text)", fontWeight: 700, fontSize: "1rem" }}>
                Drag & drop evidence image here, or click to browse
              </p>
              <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                Supports JPEG, PNG, WebP (Max 20MB)
              </p>
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: "var(--color-error-bg)",
              color: "var(--color-error)",
              border: "1px solid var(--status-error-border)",
              padding: "0.85rem 1rem",
              borderRadius: "10px",
              marginBottom: "1.25rem",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 500,
            }}
          >
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Consent and Privacy Controls */}
        <div
          style={{
            backgroundColor: "var(--surface-secondary)",
            border: "1px solid var(--border-light)",
            padding: "1.25rem",
            borderRadius: "12px",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--accent-primary)" }} />
            <h4 style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
              Privacy & Consent Protocol
            </h4>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              marginBottom: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={localConsent}
              onChange={(e) => setLocalConsent(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-primary)", cursor: "pointer", width: "17px", height: "17px" }}
            />
            <span>
              <strong style={{ color: "var(--color-text)" }}>Image processing:</strong> I consent to uploading this image to ShieldHer for analysis. Optional online search requires separate consent.
            </span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={forensicConsent}
              onChange={(e) => setForensicConsent(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-primary)", cursor: "pointer", width: "17px", height: "17px" }}
            />
            <span>
              <strong style={{ color: "var(--color-text)" }}>Forensic Support Notice:</strong> I understand ShieldHer provides technical and evidentiary documentation for legal review and does not replace official police investigation.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={!selectedFile || isLoading}
          className="btn-emerald"
          style={{ width: "100%", padding: "0.85rem 1.5rem" }}
        >
          {isLoading ? "Assessing Quality Gateway..." : "Evaluate Evidence Quality Gateway"}
        </button>
      </form>
    </div>
  );
};
