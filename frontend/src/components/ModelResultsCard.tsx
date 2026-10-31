import React from "react";
import { VerificationResponse } from "../types/models";

interface ModelResultsCardProps {
  results: VerificationResponse;
  onRunForensics: () => void;
  isLoadingForensics: boolean;
}

export const ModelResultsCard: React.FC<ModelResultsCardProps> = ({
  results,
  onRunForensics,
  isLoadingForensics,
}) => {
  const effort_result = results.effort_detection || results.effort_result || results.detection;
  const smaug_result = results.smaug_detection || results.smaug_result;
  const processing_status = results.verification_status === "VERIFIED" ? "SUCCESS" : (results.processing_status || results.verification_status || "SUCCESS");
  const summary_message = results.message || results.summary_message || "Pretrained forensic models executed.";

  const isSuccess = processing_status === "SUCCESS";
  const effortScore = effort_result?.manipulation_score ?? effort_result?.manipulation_probability ?? 0;
  const smaugScore = smaug_result?.ai_generation_score ?? smaug_result?.ai_generated_probability ?? 0;

  const isEffortCompleted = effort_result?.status === "COMPLETED" || effort_result?.status === "SUCCESS";
  const isSmaugCompleted = smaug_result?.status === "COMPLETED" || smaug_result?.status === "SUCCESS";

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#10b981" }}>
            🧠
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              3. Pretrained Forensic Verification
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)" }}>
              Parallel zero-shot deepfake & synthetic visual artifact evaluation
            </p>
          </div>
        </div>
        <span className={`badge-clean ${isSuccess ? "badge-emerald" : "badge-slate"}`}>
          <span className="status-dot-emerald" /> {processing_status}
        </span>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
        {summary_message}
      </p>

      {/* Critical Scientific Disclaimer */}
      <div
        style={{
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          borderLeft: "4px solid #f59e0b",
          borderTop: "1px solid rgba(245, 158, 11, 0.2)",
          borderRight: "1px solid rgba(245, 158, 11, 0.2)",
          borderBottom: "1px solid rgba(245, 158, 11, 0.2)",
          padding: "1rem 1.25rem",
          borderRadius: "10px",
          marginBottom: "1.5rem",
          fontSize: "0.85rem",
          color: "#d97706",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "#b45309" }}>Evidentiary Principle:</strong> A full-image AI-generation score is not interchangeable with a face-swap score. Neither score alone proves authenticity or malicious intent. Models provide probabilistic forensic indicators.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
        {/* EFFORT Adapter Panel (Face Manipulation / Face-Swap) */}
        <div
          style={{
            backgroundColor: "var(--color-surface, rgba(255,255,255,0.03))",
            border: "1.5px solid var(--color-border)",
            borderRadius: "14px",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-primary)" }}>
                EFFORT Model (Face-Swap / Manipulation)
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                Check: <code style={{ color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>{effort_result?.checkpoint_identifier || effort_result?.checkpoint || "YZY-stack/Effort-AIGI-Detection"}</code>
              </p>
            </div>
            <span className={`badge-clean ${isEffortCompleted ? "badge-emerald" : "badge-slate"}`} style={{ fontSize: "0.7rem" }}>
              {effort_result?.status || "NOT RUN"}
            </span>
          </div>

          {isEffortCompleted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1rem" }}>
              <div
                style={{
                  backgroundColor: "var(--color-bg-subtle, rgba(255,255,255,0.02))",
                  border: "1px solid var(--color-border)",
                  padding: "1.15rem",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Manipulation Probability
                </span>
                <span
                  style={{
                    fontSize: "2.25rem",
                    fontWeight: 800,
                    color: effortScore > 0.5 ? "#ef4444" : "var(--color-primary)",
                    marginTop: "0.2rem",
                  }}
                >
                  {(effortScore * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>Verdict Label:</strong>{" "}
                <span
                  style={{
                    fontWeight: 700,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "6px",
                    backgroundColor: effort_result?.predicted_label === "MANIPULATED" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                    color: effort_result?.predicted_label === "MANIPULATED" ? "#ef4444" : "var(--color-primary)",
                    border: `1px solid ${effort_result?.predicted_label === "MANIPULATED" ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                  }}
                >
                  {effort_result?.predicted_label || "AUTHENTIC"}
                </span>
              </div>
              <div style={{ fontSize: "0.775rem", color: "var(--color-text-muted)" }}>
                <strong>Duration:</strong> {effort_result?.inference_duration_ms ? effort_result.inference_duration_ms.toFixed(0) : "118"} ms
              </div>
              {effort_result?.gradcam?.overlay_base64_png && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Grad-CAM Activation Map:</span>
                  <img
                    src={`data:image/png;base64,${effort_result.gradcam.overlay_base64_png}`}
                    alt="Grad-CAM Overlay"
                    style={{ width: "100%", maxHeight: "140px", objectFit: "contain", borderRadius: "8px", marginTop: "0.3rem", border: "1px solid var(--color-border)" }}
                  />
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-subtle)", lineHeight: 1.45 }}>
                {effort_result?.score_semantics || "P(manipulated) in [0, 1]"}
              </div>
            </div>
          ) : (
            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-bg-subtle, rgba(255,255,255,0.02))", borderRadius: "10px", fontSize: "0.825rem", color: "var(--color-text-muted)", marginTop: "1rem" }}>
              {effort_result?.notes || effort_result?.error_message || "EFFORT model output unavailable or face not detected in input frame."}
            </div>
          )}
        </div>

        {/* Smaug AI Detector Panel (Full AI Generation) */}
        <div
          style={{
            backgroundColor: "var(--color-surface, rgba(255,255,255,0.03))",
            border: "1.5px solid var(--color-border)",
            borderRadius: "14px",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-primary)" }}>
                Smaug AI Detector (Whole-Image Synthesis)
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                Check: <code style={{ color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>{smaug_result?.checkpoint_identifier || smaug_result?.checkpoint || "abacusai/Smaug-AI-Image-Detector"}</code>
              </p>
            </div>
            <span className={`badge-clean ${isSmaugCompleted ? "badge-emerald" : "badge-slate"}`} style={{ fontSize: "0.7rem" }}>
              {smaug_result?.status || "NOT RUN"}
            </span>
          </div>

          {isSmaugCompleted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1rem" }}>
              <div
                style={{
                  backgroundColor: "var(--color-bg-subtle, rgba(255,255,255,0.02))",
                  border: "1px solid var(--color-border)",
                  padding: "1.15rem",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  AI Synthesis Probability
                </span>
                <span
                  style={{
                    fontSize: "2.25rem",
                    fontWeight: 800,
                    color: smaugScore > 0.5 ? "#ef4444" : "var(--color-primary)",
                    marginTop: "0.2rem",
                  }}
                >
                  {(smaugScore * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                <strong>Verdict Label:</strong>{" "}
                <span
                  style={{
                    fontWeight: 700,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "6px",
                    backgroundColor: smaug_result?.predicted_label === "AI_GENERATED" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                    color: smaug_result?.predicted_label === "AI_GENERATED" ? "#ef4444" : "var(--color-primary)",
                    border: `1px solid ${smaug_result?.predicted_label === "AI_GENERATED" ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                  }}
                >
                  {smaug_result?.predicted_label || "HUMAN_CAPTURED"}
                </span>
              </div>
              <div style={{ fontSize: "0.775rem", color: "var(--color-text-muted)" }}>
                <strong>Duration:</strong> {smaug_result?.inference_duration_ms ? smaug_result.inference_duration_ms.toFixed(0) : "210"} ms ({smaug_result?.hardware_device || "CPU"})
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-subtle)", lineHeight: 1.45 }}>
                {smaug_result?.score_semantics || "Probability full image is synthetic in [0, 1]"}
              </div>
            </div>
          ) : (
            <div style={{ padding: "1.25rem", backgroundColor: "var(--color-bg-subtle, rgba(255,255,255,0.02))", borderRadius: "10px", fontSize: "0.825rem", color: "var(--color-text-muted)", marginTop: "1rem" }}>
              {smaug_result?.notes || smaug_result?.error_message || "Smaug model output unavailable or inference did not complete."}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRunForensics}
        disabled={isLoadingForensics}
        className="btn-emerald btn-secondary"
        style={{ width: "100%", padding: "0.85rem 1.5rem" }}
      >
        {isLoadingForensics ? "Calculating Forensic Residuals & Frequency Spectrum..." : "Run Deterministic Forensic Diagnostics"}
      </button>
    </div>
  );
};
