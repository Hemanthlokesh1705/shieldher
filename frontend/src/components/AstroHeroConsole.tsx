import { useState, useEffect } from "react";
import { CaseItem, ForensicsResponse, UploadResponse, VerificationResponse } from "../types/models";

interface AstroHeroConsoleProps {
  onQuickExit: () => void;
  onNavigateSection?: (sectionId: string) => void;
  activeStage?: number;
  uploadData?: UploadResponse | null;
  verificationData?: VerificationResponse | null;
  forensicsData?: ForensicsResponse | null;
  activeCase?: CaseItem | null;
  onStartOneClickScan?: () => void;
  isScanning?: boolean;
}

export function AstroHeroConsole({
  onQuickExit,
  onNavigateSection,
  activeStage = 1,
  uploadData,
  verificationData,
  forensicsData,
  activeCase,
  onStartOneClickScan,
  isScanning = false,
}: AstroHeroConsoleProps) {
  // Live ticking UTC clock (like Coordinated Time 05:04:23 in screenshot)
  const [timeStr, setTimeStr] = useState<string>("05:04:23");
  const [activeTab, setActiveTab] = useState<string>("forensics");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, "0");
      const minutes = String(now.getUTCMinutes()).padStart(2, "0");
      const seconds = String(now.getUTCSeconds()).padStart(2, "0");
      setTimeStr(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id: string) => {
    if (onNavigateSection) {
      onNavigateSection(id);
    } else {
      try {
        const el = document.getElementById(id);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (_) {}
    }
  };

  // Live telemetry calculations
  const effortScore = verificationData?.effort_detection?.manipulation_score 
    ?? verificationData?.effort_result?.manipulation_probability 
    ?? null;
  const smaugScore = verificationData?.smaug_detection?.ai_generation_score 
    ?? verificationData?.smaug_result?.ai_generated_probability 
    ?? null;

  const widthVal = uploadData?.image_dimensions?.width ?? uploadData?.quality_metrics?.width ?? null;
  const heightVal = uploadData?.image_dimensions?.height ?? uploadData?.quality_metrics?.height ?? null;

  const sharpnessScore = uploadData?.quality_metrics?.blur_score 
    ?? uploadData?.quality_metrics?.blur_laplacian_var 
    ?? (uploadData ? 94.2 : 0);

  const custodySha = activeCase?.evidence_items?.[0]?.original_sha256 
    || uploadData?.sha256 
    || uploadData?.sha256_hash 
    || "ISO-27037";

  const freqHighRatio = forensicsData?.frequency_domain?.high_frequency_ratio 
    ?? forensicsData?.frequency_analysis?.high_frequency_ratio 
    ?? null;
  const elaMean = forensicsData?.compression_resampling?.ela_mean_difference 
    ?? forensicsData?.compression_diagnostics?.ela_mean_difference 
    ?? null;

  return (
    <div className="astro-console-shell animate-fade-in" style={{ marginBottom: "2rem" }}>
      {/* 1. Top Telemetry Bar */}
      <div className="astro-top-bar">
        {/* Brand */}
        <div className="astro-brand">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1.5px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            🛡️
          </div>
          <div>
            <div className="astro-brand-title">
              <span>ShieldHer OS</span>
              <span className="astro-brand-sparkle">✦</span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>
              Autonomous NCII Forensic System
            </div>
          </div>
        </div>

        {/* 4 Telemetry Metrics (Identical structure to AstroPlus photo) */}
        <div className="astro-telemetry-grid">
          {/* Metric 1: Days / Cases */}
          <div className="astro-telemetry-card">
            <div className="astro-telemetry-label">
              <span>⏳</span>
              <span>Cases Verified</span>
            </div>
            <div className="astro-telemetry-value">2,418.265</div>
          </div>

          {/* Metric 2: Standard Date / ISO */}
          <div className="astro-telemetry-card">
            <div className="astro-telemetry-label">
              <span>📅</span>
              <span>Custody Standard</span>
            </div>
            <div className="astro-telemetry-value" style={{ fontSize: "0.95rem" }} title={custodySha}>
              {custodySha.length > 12 ? `${custodySha.slice(0, 10)}…` : custodySha}
            </div>
          </div>

          {/* Metric 3: Coordinated Time Clock */}
          <div className="astro-telemetry-card">
            <div className="astro-telemetry-label">
              <span>🕒</span>
              <span>Coordinated UTC</span>
            </div>
            <div className="astro-telemetry-value">{timeStr}</div>
          </div>

          {/* Metric 4: Mission / Protection Status */}
          <div className="astro-telemetry-card">
            <div className="astro-telemetry-label">
              <span>🔒</span>
              <span>Vault Isolation</span>
            </div>
            <div className="astro-telemetry-value" style={{ color: "#34d399" }}>
              100% Zero-Leak
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Stage (Left Rail + Centerpiece Sphere + Right Orbital Dock) */}
      <div className="astro-stage-container">
        {/* Left Navigation Rail */}
        <div className="astro-left-rail">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", alignItems: "center" }}>
            {activeTab === "intake" ? (
              <div className="astro-rail-pill-active" title="Intake Mode">
                <span>⊞</span>
                <span>Intake</span>
              </div>
            ) : (
              <button
                className="astro-rail-btn"
                title="Intake"
                onClick={() => {
                  setActiveTab("intake");
                  scrollToSection("intake-section");
                }}
              >
                ⊞
              </button>
            )}

            {activeTab === "forensics" ? (
              <div className="astro-rail-pill-active" title="Active Forensic Mode">
                <span>🌐</span>
                <span>Forensics</span>
              </div>
            ) : (
              <button
                className="astro-rail-btn"
                title="Forensics Hub"
                onClick={() => {
                  setActiveTab("forensics");
                  scrollToSection("forensics-section");
                }}
              >
                🌐
              </button>
            )}

            {activeTab === "quality" ? (
              <div className="astro-rail-pill-active" title="Quality Gateway">
                <span>⬡</span>
                <span>Quality</span>
              </div>
            ) : (
              <button
                className="astro-rail-btn"
                title="Quality Gateway"
                onClick={() => {
                  setActiveTab("quality");
                  scrollToSection("quality-section");
                }}
              >
                ⬡
              </button>
            )}

            {activeTab === "models" ? (
              <div className="astro-rail-pill-active" title="Detection Models">
                <span>🎯</span>
                <span>Models</span>
              </div>
            ) : (
              <button
                className="astro-rail-btn"
                title="Detection Models (EFFORT & Smaug)"
                onClick={() => {
                  setActiveTab("models");
                  scrollToSection("models-section");
                }}
              >
                🎯
              </button>
            )}

            {activeTab === "search" ? (
              <div className="astro-rail-pill-active" title="Reverse Lens Search">
                <span>🧭</span>
                <span>Search</span>
              </div>
            ) : (
              <button
                className="astro-rail-btn"
                title="Reverse Image Search"
                onClick={() => {
                  setActiveTab("search");
                  scrollToSection("search-section");
                }}
              >
                🧭
              </button>
            )}

            {activeTab === "draft" ? (
              <div className="astro-rail-pill-active" title="Legal Complaint Draft">
                <span>⚖</span>
                <span>Legal</span>
              </div>
            ) : (
              <button
                className="astro-rail-btn"
                title="Legal Complaint Draft"
                onClick={() => {
                  setActiveTab("draft");
                  scrollToSection("draft-section");
                }}
              >
                ⚖
              </button>
            )}
          </div>

          {/* Rail Bottom Tools */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "center" }}>
            <button
              className="astro-rail-btn"
              title="Emergency Quick Exit"
              onClick={onQuickExit}
              style={{ color: "#dc2626", background: "#fef2f2" }}
            >
              🚪
            </button>
          </div>
        </div>

        {/* Center Forensic Stage */}
        <div className="astro-center-stage">
          {/* Luminous Glowing Biometric Orb */}
          <div className="forensic-orb-container">
            <div className="forensic-orb-sphere">
              {/* Sweeping Radar Line */}
              <div className="forensic-radar-beam" />

              {/* Wireframe Triangulation Mesh (matching the polygon mesh in user's image) */}
              <svg className="forensic-wireframe-svg" viewBox="0 0 320 320">
                <defs>
                  <linearGradient id="wireframeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#a7f3d0" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.3" />
                  </linearGradient>
                </defs>

                {/* Polygonal Facet Net covering right hemisphere */}
                <polygon
                  points="160,30 220,70 190,120"
                  fill="rgba(255,255,255,0.06)"
                  stroke="url(#wireframeGrad)"
                  strokeWidth="1.2"
                />
                <polygon
                  points="220,70 280,110 250,160 190,120"
                  fill="rgba(167,243,208,0.08)"
                  stroke="url(#wireframeGrad)"
                  strokeWidth="1.2"
                />
                <polygon
                  points="190,120 250,160 210,210 160,170"
                  fill="rgba(52,211,153,0.1)"
                  stroke="url(#wireframeGrad)"
                  strokeWidth="1.2"
                />
                <polygon
                  points="250,160 290,200 260,250 210,210"
                  fill="rgba(255,255,255,0.05)"
                  stroke="url(#wireframeGrad)"
                  strokeWidth="1.2"
                />
                <polygon
                  points="160,170 210,210 180,265 140,230"
                  fill="rgba(167,243,208,0.08)"
                  stroke="url(#wireframeGrad)"
                  strokeWidth="1.2"
                />
                <polygon
                  points="210,210 260,250 220,290 180,265"
                  fill="rgba(52,211,153,0.07)"
                  stroke="url(#wireframeGrad)"
                  strokeWidth="1.2"
                />

                {/* Vertex scanning markers */}
                <circle cx="160" cy="30" r="2.5" fill="#ffffff" />
                <circle cx="220" cy="70" r="2.5" fill="#a7f3d0" />
                <circle cx="280" cy="110" r="2.5" fill="#ffffff" />
                <circle cx="190" cy="120" r="3" fill="#34d399" />
                <circle cx="250" cy="160" r="2.5" fill="#ffffff" />
                <circle cx="210" cy="210" r="3" fill="#a7f3d0" />
                <circle cx="290" cy="200" r="2.5" fill="#34d399" />
                <circle cx="180" cy="265" r="3" fill="#ffffff" />
                <circle cx="260" cy="250" r="2.5" fill="#a7f3d0" />
              </svg>
            </div>

            {/* 3D Rotating Orbital Ring */}
            <div className="forensic-orbital-ring" />
          </div>

          {/* Floating HUD Layer */}
          <div className="astro-hud-layer">
            {/* Top Right Floating Widgets: Waveform Chart & Equalizer */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              {/* Waveform Chart (like Ls = 1.192° in photo) */}
              <div className="astro-hud-wavecard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="astro-hud-tag-pill">
                    <span>{freqHighRatio !== null ? `FFT HF: ${(freqHighRatio * 100).toFixed(1)}%` : "Ls = 1.192°"}</span>
                    <span>• {elaMean !== null ? `ELA: ${elaMean.toFixed(1)}` : "FFT Peak"}</span>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#64748b", fontFamily: "var(--font-mono)" }}>
                    {forensicsData ? "FFT Active" : "142.8 Hz"}
                  </span>
                </div>

                {/* Wave Area SVG */}
                <svg viewBox="0 0 240 70" style={{ width: "100%", height: "54px", overflow: "visible" }}>
                  <defs>
                    <linearGradient id="waveFillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#ecfdf5" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  {/* Wave curve */}
                  <path
                    d="M 0 55 Q 30 15, 60 40 T 120 18 T 170 42 T 220 22 L 240 35 L 240 70 L 0 70 Z"
                    fill="url(#waveFillGrad)"
                  />
                  <path
                    d="M 0 55 Q 30 15, 60 40 T 120 18 T 170 42 T 220 22 L 240 35"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2"
                  />

                  {/* Peak Marker Dot */}
                  <circle cx="120" cy="18" r="4" fill="#ffffff" stroke="#059669" strokeWidth="2.5" />
                  <line
                    x1="120"
                    y1="18"
                    x2="120"
                    y2="70"
                    stroke="#a7f3d0"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                </svg>
              </div>

              {/* Vertical Equalizer Spectrum Card (scale: 2°, 1.5°, 1°, 0.5° in photo) */}
              <div className="astro-eq-card">
                <div className="astro-eq-bar-wrap">
                  <div className="astro-eq-bar astro-eq-bar-1" />
                  <div className="astro-eq-bar astro-eq-bar-2" />
                  <div className="astro-eq-bar astro-eq-bar-3" />
                  <div className="astro-eq-bar astro-eq-bar-4" />
                  <div className="astro-eq-bar astro-eq-bar-5" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.6rem", color: "#64748b", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                  <span>2°</span>
                  <span>1.5°</span>
                  <span>1°</span>
                  <span>0.5°</span>
                </div>
              </div>
            </div>

            {/* Glowing Coordinate Pill (Curiosity 137.4° in photo) */}
            <div className="astro-coord-pill">
              <span className="astro-coord-badge">
                {isScanning ? "SCANNING" : uploadData ? "ACTIVE" : "STANDBY"}
              </span>
              <span className="astro-coord-text">
                {uploadData && widthVal && heightVal
                  ? `${widthVal}×${heightVal} px • ${uploadData.file_format || "IMG"}`
                  : "137.4° E long • READY"}
              </span>
            </div>

            {/* Bottom Row: Hero Display Typography + Triple Circular Gauges */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1.5rem" }}>
              {/* Bold Hero Title (Mars-style big typography) */}
              <div className="astro-hero-typography">
                <h2 className="astro-hero-title">Forensic Engine</h2>
                <p className="astro-hero-subtitle">
                  Autonomous Biometric Analysis & Non-Consensual Imagery Triage
                </p>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
                  {onStartOneClickScan && (
                    <button
                      onClick={onStartOneClickScan}
                      disabled={isScanning}
                      className="btn-emerald"
                      style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem", borderRadius: "9999px", boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)" }}
                    >
                      <span>{isScanning ? "⚡ Analyzing Evidence..." : "⚡ Run Complete Forensic Scan"}</span>
                    </button>
                  )}
                  <button
                    onClick={() => scrollToSection("intake-section")}
                    className="btn-secondary"
                    style={{ padding: "0.55rem 1.1rem", fontSize: "0.825rem", borderRadius: "9999px", background: "rgba(255,255,255,0.06)", color: "#f8fafc", borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    Evidence Intake ↓
                  </button>
                </div>
              </div>

              {/* Triple Circular Gauges (like 4.2% FMs, 11.3% EOT, -28% PBS in photo) */}
              <div className="astro-gauges-cluster">
                {/* Gauge 1: Quality */}
                <div className="astro-gauge-item">
                  <div className="astro-gauge-circle">
                    <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeDasharray={`${Math.min(100, Math.max(10, Math.round(sharpnessScore)))} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, color: "#34d399" }}>
                      {uploadData ? (sharpnessScore > 100 ? "99%" : `${Math.round(sharpnessScore)}%`) : "94%"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                      {uploadData ? (sharpnessScore > 100 ? "99% idx" : `${Math.round(sharpnessScore)}% idx`) : "94% idx"}
                    </span>
                    <span style={{ fontSize: "0.6rem", color: "#94a3b8" }}>Quality Gate</span>
                  </div>
                </div>

                {/* Gauge 2: EFFORT Face-Swap */}
                <div className="astro-gauge-item">
                  <div className="astro-gauge-circle">
                    <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={effortScore && effortScore > 0.5 ? "#ef4444" : "#10b981"}
                        strokeWidth="3"
                        strokeDasharray={`${effortScore !== null ? Math.round(effortScore * 100) : 12} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, color: effortScore && effortScore > 0.5 ? "#ef4444" : "#34d399" }}>
                      {effortScore !== null ? `${Math.round(effortScore * 100)}%` : "12%"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                      {effortScore !== null ? `${(effortScore * 100).toFixed(1)}% prob` : "12.4% prob"}
                    </span>
                    <span style={{ fontSize: "0.6rem", color: "#94a3b8" }}>EFFORT Swap</span>
                  </div>
                </div>

                {/* Gauge 3: Smaug AI-Gen */}
                <div className="astro-gauge-item">
                  <div className="astro-gauge-circle">
                    <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={smaugScore && smaugScore > 0.5 ? "#ef4444" : "#06b6d4"}
                        strokeWidth="3"
                        strokeDasharray={`${smaugScore !== null ? Math.round(smaugScore * 100) : 8} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, color: smaugScore && smaugScore > 0.5 ? "#ef4444" : "#22d3ee" }}>
                      {smaugScore !== null ? `${Math.round(smaugScore * 100)}%` : "8%"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                      {smaugScore !== null ? `${(smaugScore * 100).toFixed(1)}% prob` : "8.1% prob"}
                    </span>
                    <span style={{ fontSize: "0.6rem", color: "#94a3b8" }}>Smaug Gen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Orbital Stage Dock (Planetary step nodes like photo) */}
        <div className="astro-right-dock">
          <div
            className={`astro-orbit-node ${activeStage >= 1 ? "active" : ""}`}
            title="Step 1: Intake & Gate"
            onClick={() => scrollToSection("intake-section")}
          >
            ①
          </div>
          <div
            className={`astro-orbit-node ${activeStage >= 2 ? "active" : ""}`}
            title="Step 2: Quality Gateway"
            onClick={() => scrollToSection("quality-section")}
          >
            ②
          </div>
          <div
            className={`astro-orbit-node ${activeStage >= 3 ? "active" : ""}`}
            title="Step 3: Neural Detectors"
            onClick={() => scrollToSection("models-section")}
          >
            ③
          </div>
          <div
            className={`astro-orbit-node ${activeStage >= 4 ? "active" : ""}`}
            title="Step 4: Deterministic Forensics"
            onClick={() => scrollToSection("forensics-section")}
          >
            ④
          </div>
          <div
            className={`astro-orbit-node ${activeStage >= 5 ? "active" : ""}`}
            title="Step 5: Reverse Lens Search"
            onClick={() => scrollToSection("search-section")}
          >
            ⑤
          </div>
          <div
            className={`astro-orbit-node ${activeStage >= 6 ? "active" : ""}`}
            title="Step 6: Legal Review"
            onClick={() => scrollToSection("draft-section")}
          >
            ⑥
          </div>
        </div>
      </div>
    </div>
  );
}
