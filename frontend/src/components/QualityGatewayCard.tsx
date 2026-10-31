import React from "react";
import { UploadResponse } from "../types/models";

interface QualityGatewayCardProps {
  uploadData: UploadResponse;
  onProceedToVerification: () => void;
  isVerifying: boolean;
}

export const QualityGatewayCard: React.FC<QualityGatewayCardProps> = ({
  uploadData,
  onProceedToVerification,
  isVerifying,
}) => {
  const status = uploadData.status || "PASS";
  const sha256Val = uploadData.sha256 || uploadData.sha256_hash || "";
  const metrics = uploadData.quality_metrics;
  const thresholds = uploadData.provisional_thresholds || uploadData.thresholds;

  const widthVal = uploadData.image_dimensions?.width ?? metrics?.width ?? 0;
  const heightVal = uploadData.image_dimensions?.height ?? metrics?.height ?? 0;
  const aspectVal = uploadData.image_dimensions?.aspect_ratio ?? metrics?.aspect_ratio ?? (widthVal && heightVal ? Number((widthVal / heightVal).toFixed(2)) : 1.33);
  const facesVal = uploadData.face_count ?? metrics?.faces_detected ?? uploadData.faces?.length ?? 0;
  const blurVal = metrics?.blur_score ?? metrics?.blur_laplacian_var ?? 0;
  const brightnessVal = metrics?.brightness ?? metrics?.brightness_mean ?? 0;
  const contrastVal = metrics?.contrast ?? metrics?.contrast_std ?? 0;

  const quality_notes = uploadData.quality_notes || (uploadData.reasons?.length ? uploadData.reasons.map(r => `Observed flag: ${r}`) : []);
  const remediation_steps = uploadData.remediation_steps || [];

  const isPass = status === "PASS";

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#10b981" }}>
            ⚡
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              2. Quality Gateway Results
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)" }}>
              Preliminary automated resolution, face geometry, and sharpness calibration
            </p>
          </div>
        </div>
        <span className={`badge-clean ${isPass ? "badge-emerald" : "badge-amber"}`}>
          <span className="status-dot-emerald" /> {status}
        </span>
      </div>

      <div
        style={{
          backgroundColor: "var(--color-bg-subtle, rgba(255,255,255,0.03))",
          border: "1px solid var(--color-border)",
          padding: "0.85rem 1.15rem",
          borderRadius: "10px",
          marginBottom: "1.5rem",
          fontSize: "0.825rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--color-text)" }}>SHA-256 Custody Hash:</span>{" "}
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)", fontWeight: 600, wordBreak: "break-all" }}>
          {sha256Val}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="metric-tile-clean">
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Dimensions
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text)" }}>
            {widthVal} × {heightVal} px
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-subtle)" }}>
            Aspect Ratio: {typeof aspectVal === "number" ? aspectVal.toFixed(2) : aspectVal}:1
          </span>
        </div>

        <div className="metric-tile-clean">
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Faces Detected
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: facesVal > 0 ? "var(--color-primary)" : "#d97706" }}>
            {facesVal} {facesVal === 0 ? "⚠️" : "👤"}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-subtle)" }}>
            MediaPipe BlazeFace
          </span>
        </div>

        <div className="metric-tile-clean">
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Sharpness (Laplacian Var)
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: blurVal >= (thresholds?.min_sharpness_laplacian ?? 100) ? "var(--color-primary)" : "#d97706" }}>
            {typeof blurVal === "number" ? blurVal.toFixed(1) : blurVal}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-subtle)" }}>
            Threshold: ≥ {thresholds?.min_sharpness_laplacian ?? 100}
          </span>
        </div>

        <div className="metric-tile-clean">
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Mean Brightness
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text)" }}>
            {typeof brightnessVal === "number" ? brightnessVal.toFixed(1) : brightnessVal} / 255
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-subtle)" }}>
            Range: {thresholds?.min_brightness ?? 40} – {thresholds?.max_brightness ?? 220}
          </span>
        </div>

        <div className="metric-tile-clean">
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Contrast (Std Dev)
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text)" }}>
            {typeof contrastVal === "number" ? contrastVal.toFixed(1) : contrastVal}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-subtle)" }}>
            Threshold: ≥ {thresholds?.min_contrast ?? 30}
          </span>
        </div>
      </div>

      {quality_notes && quality_notes.length > 0 && (
        <div
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "0.9rem 1.15rem",
            borderRadius: "10px",
            marginBottom: "1rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem", color: "#b45309" }}>Quality Observations:</strong>
          <ul style={{ fontSize: "0.825rem", color: "#78350f", marginLeft: "1.25rem", marginTop: "0.35rem", lineHeight: 1.5 }}>
            {quality_notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {remediation_steps && remediation_steps.length > 0 && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "0.9rem 1.15rem",
            borderRadius: "10px",
            marginBottom: "1rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem", color: "#b91c1c" }}>Recommended Remediation:</strong>
          <ul style={{ fontSize: "0.825rem", color: "#991b1b", marginLeft: "1.25rem", marginTop: "0.35rem", lineHeight: 1.5 }}>
            {remediation_steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ fontSize: "0.775rem", color: "var(--color-text-muted)", fontStyle: "italic", marginBottom: "1.5rem" }}>
        * Note: Quality criteria thresholds are provisional heuristics calibrated for preliminary evidentiary triage and do not constitute an assertion of image authenticity.
      </div>

      <button
        type="button"
        onClick={onProceedToVerification}
        disabled={isVerifying}
        className="btn-emerald"
        style={{ width: "100%", padding: "0.85rem 1.5rem" }}
      >
        {isVerifying ? "Executing Verification Models..." : "Run EFFORT & Smaug Verification Pipeline"}
      </button>
    </div>
  );
};
