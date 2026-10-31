import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CaseItem,
  ComplaintDraftResponse,
  ForensicsResponse,
  ReverseSearchResponse,
  UploadResponse,
  VerificationResponse,
} from "../types/models";
import {
  analyzeForensics,
  createCase,
  generateComplaintDraft,
  runReverseSearch,
  uploadCaseEvidence,
  uploadImage,
  verifyImage,
  getCase,
} from "../services/api";
import { EvidenceUploadCard } from "../components/EvidenceUploadCard";
import { QualityGatewayCard } from "../components/QualityGatewayCard";
import { ModelResultsCard } from "../components/ModelResultsCard";
import { ForensicsViewerCard } from "../components/ForensicsViewerCard";
import { ReverseSearchCard } from "../components/ReverseSearchCard";
import { ElicitationCard } from "../components/ElicitationCard";
import { ComplaintDraftViewer } from "../components/ComplaintDraftViewer";
import { EvidenceInventoryCard } from "../components/EvidenceInventoryCard";
import { useAuth } from "../firebase/AuthContext";

const STEPS = [
  { id: 1, label: "Intake" },
  { id: 2, label: "Quality" },
  { id: 3, label: "Detect" },
  { id: 4, label: "Forensics" },
  { id: 5, label: "Search" },
  { id: 6, label: "Legal" },
];

export default function ReportingPage() {
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    document.documentElement.classList.remove("theme-dark");
    document.documentElement.classList.add("theme-light");
    localStorage.setItem("shieldher_theme", "light");
  }, []);

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [activeCase, setActiveCase] = useState<CaseItem | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationResponse | null>(null);
  const [forensicsData, setForensicsData] = useState<ForensicsResponse | null>(null);
  const [reverseSearchData, setReverseSearchData] = useState<ReverseSearchResponse | null>(null);
  const [complaintDraft, setComplaintDraft] = useState<ComplaintDraftResponse | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isForensicsLoading, setIsForensicsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFinalizingDraft, setIsFinalizingDraft] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const safeScrollTo = (id: string) => {
    try {
      const el = document.getElementById(id);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } catch (_) {}
  };

  const handleQuickExit = () => window.location.replace("https://www.google.com");

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setPageError(null);
    setCurrentFile(file);
    try {
      const uploadResp = await uploadImage(file);
      setUploadData(uploadResp);
      try {
        const newCase = await createCase(
          `Case - ${file.name.slice(0, 20)}`,
          "Exploratory case created for forensic intake.",
          "TEMPORARY_EXPLORATORY"
        );
        setActiveCase(newCase);
        await uploadCaseEvidence(newCase.id, file);
        const refreshed = await getCase(newCase.id);
        setActiveCase(refreshed);
      } catch (err: any) {
        console.warn("Case persistence init notice:", err.message);
      }
      setTimeout(() => {
        safeScrollTo("quality-section");
      }, 100);
    } catch (err: any) {
      setPageError(err.message || "Failed to process image upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async () => {
    if (!currentFile) return;
    setIsVerifying(true);
    setPageError(null);
    try {
      const res = await verifyImage(currentFile, activeCase?.id);
      setVerificationData(res);
      setTimeout(() => {
        safeScrollTo("models-section");
      }, 100);
    } catch (err: any) {
      setPageError(err.message || "Model verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForensics = async () => {
    if (!currentFile) return;
    setIsForensicsLoading(true);
    setPageError(null);
    try {
      const res = await analyzeForensics(currentFile);
      setForensicsData(res);
      setTimeout(() => {
        safeScrollTo("forensics-section");
      }, 100);
    } catch (err: any) {
      setPageError(err.message || "Forensic analysis failed");
    } finally {
      setIsForensicsLoading(false);
    }
  };

  const handleRunFullPipeline = async (fileOverride?: File) => {
    const fileToUse = fileOverride || currentFile;
    if (!fileToUse) {
      safeScrollTo("intake-section");
      return;
    }

    setPageError(null);
    let caseObj = activeCase;

    try {
      let upData = uploadData;
      if (!upData) {
        setIsUploading(true);
        upData = await uploadImage(fileToUse);
        setUploadData(upData);
        setCurrentFile(fileToUse);

        try {
          caseObj = await createCase(
            `Case - ${fileToUse.name.slice(0, 20)}`,
            "Exploratory case created for forensic intake.",
            "TEMPORARY_EXPLORATORY"
          );
          setActiveCase(caseObj);
          await uploadCaseEvidence(caseObj.id, fileToUse);
          const refreshed = await getCase(caseObj.id);
          setActiveCase(refreshed);
          caseObj = refreshed;
        } catch (cErr: any) {
          console.warn("Case init notice:", cErr.message);
        }
        setIsUploading(false);
      }

      if (!verificationData) {
        setIsVerifying(true);
        const verifyResp = await verifyImage(fileToUse, caseObj?.id);
        setVerificationData(verifyResp);
        setIsVerifying(false);
      }

      if (!forensicsData) {
        setIsForensicsLoading(true);
        const forensicsResp = await analyzeForensics(fileToUse);
        setForensicsData(forensicsResp);
        setIsForensicsLoading(false);
      }

      safeScrollTo("models-section");
    } catch (err: any) {
      setPageError(err.message || "Forensic pipeline encountered an error");
    } finally {
      setIsUploading(false);
      setIsVerifying(false);
      setIsForensicsLoading(false);
    }
  };

  const handleTriggerReverseSearch = async (consent: boolean) => {
    if (!activeCase || !activeCase.evidence_items[0]) {
      setPageError("No active evidence item available for reverse search.");
      return;
    }
    setIsSearching(true);
    setPageError(null);
    try {
      const evidenceId = activeCase.evidence_items[0].id;
      const res = await runReverseSearch(activeCase.id, evidenceId, consent);
      setReverseSearchData(res);
      setTimeout(() => {
        safeScrollTo("search-section");
      }, 100);
    } catch (err: any) {
      setPageError(err.message || "Reverse search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleElicitationCompleted = async () => {
    if (!activeCase) return;
    try {
      const draft = await generateComplaintDraft(activeCase.id, false);
      setComplaintDraft(draft);
      setTimeout(() => {
        safeScrollTo("draft-section");
      }, 100);
    } catch (err: any) {
      setPageError(err.message || "Failed to generate initial complaint draft");
    }
  };

  const handleConfirmReview = async () => {
    if (!activeCase) return;
    setIsFinalizingDraft(true);
    try {
      const finalized = await generateComplaintDraft(activeCase.id, true);
      setComplaintDraft(finalized);
    } catch (err: any) {
      setPageError(err.message || "Failed to finalize complaint draft");
    } finally {
      setIsFinalizingDraft(false);
    }
  };

  const handleRefreshCase = async () => {
    if (activeCase) {
      try {
        const c = await getCase(activeCase.id);
        setActiveCase(c);
      } catch (_) {
        setActiveCase(null);
      }
    }
  };

  const activeStage = complaintDraft ? 6
    : reverseSearchData ? 5
    : forensicsData ? 4
    : verificationData ? 3
    : uploadData ? 2
    : 1;

  const hasWorkflow = !!uploadData;

  return (
    <div className="intake-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", transition: "background-color 0.25s ease, color 0.25s ease" }}>
      {/* ── NAVBAR ── */}
      <header className="site-header">
        <div className="nav-inner">
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div className="nav-logo-icon">🛡️</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="nav-logo-text" aria-label="ShieldHer">ShieldHer</span>
                <span className="nav-logo-badge">v1.2</span>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="nav-links">
            <Link to="/intake" className={`nav-link ${location.pathname === "/intake" ? "active" : ""}`}>
              Victim Intake
            </Link>
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/reviewer" className={`nav-link ${location.pathname === "/reviewer" ? "active" : ""}`}>
              Reviewer Portal
            </Link>
            <Link to="/health" className={`nav-link ${location.pathname === "/health" ? "active" : ""}`}>
              System Health
            </Link>
          </nav>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--color-primary)",
                    background: "var(--color-primary-bg)",
                    border: "1px solid var(--color-primary-border)",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "99px",
                  }}
                  title={user.email || undefined}
                >
                  👤 {user.displayName || user.email?.split("@")[0] || "User"}
                </span>
                <button
                  onClick={() => logout()}
                  className="nav-link"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                  type="button"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Link
                  to="/login"
                  className="nav-link"
                  style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", borderRadius: "99px" }}
                >
                  Register
                </Link>
              </div>
            )}
            <button onClick={handleQuickExit} className="nav-exit-btn">
              ✕ Quick Exit
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="intake-overview">
        <div className="intake-overview-inner">
          <div className="intake-welcome">
            <div className="intake-kicker"><span /> YOUR PRIVATE WORKSPACE</div>
            <h1>{activeCase ? "Your case, in one place." : "Let’s take this one step at a time."}</h1>
            <p>Preserve an image, review its analysis, and decide what you’d like to do next. You can pause whenever you need.</p>
            <div className="intake-actions">
              <button className="intake-main-action" onClick={() => handleRunFullPipeline()} disabled={isUploading || isVerifying || isForensicsLoading}>
                {isUploading || isVerifying || isForensicsLoading ? <><span className="intake-button-spinner" /> Working on your analysis…</> : <>{uploadData ? "Continue your review" : "Add an image to begin"}<span aria-hidden="true">→</span></>}
              </button>
              <button className="intake-secondary-action" onClick={() => safeScrollTo("workflow-progress")}>See your steps <span aria-hidden="true">↓</span></button>
            </div>
            <div className="intake-reassurance"><span>✳</span> Your choices stay yours. Nothing is sent as a report automatically.</div>
          </div>
          <div className="intake-overview-art" aria-hidden="true">
            <div className="intake-art-orbit intake-art-orbit-a" /><div className="intake-art-orbit intake-art-orbit-b" />
            <div className="intake-art-card"><div className="intake-art-sun" /><div className="intake-art-landscape"><i /><i /><i /></div><div className="intake-art-label"><span>SHIELDHER</span><strong>A steady place<br />to start.</strong><small>Take it at your pace</small></div></div>
            <div className="intake-status-note"><span className="intake-status-icon">{uploadData ? "✓" : "✳"}</span><div><strong>{uploadData ? "Evidence added" : "Ready when you are"}</strong><small>{uploadData ? "Your review can continue" : "No rush. Start with one image."}</small></div></div>
          </div>
          <div className="intake-overview-index"><span>{String(activeStage).padStart(2,"0")}</span> / 06 &nbsp; YOUR PROGRESS</div>
        </div>
      </section>

      {/* ── WORKFLOW BODY ── */}
      <div className="page-body" style={{ flex: 1 }}>
        <div className="content-wrap">
          {/* Step pipeline */}
          <div id="workflow-progress" style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.85rem" }}>
              Forensic Pipeline
            </div>
            <div className="step-pipeline">
              {STEPS.map((step, i) => (
                <div key={step.id} className="step-item">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      className={`step-circle ${
                        activeStage === step.id
                          ? "active"
                          : activeStage > step.id
                          ? "done"
                          : ""
                      }`}
                    >
                      {activeStage > step.id ? "✓" : step.id}
                    </div>
                    <div className="step-label" style={{ color: activeStage >= step.id ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                      {step.label}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`step-connector ${activeStage > step.id ? "done" : ""}`}
                      style={{ marginBottom: "1rem" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error banner */}
          {pageError && (
            <div className="alert alert-error animate-fade-in">
              <span>⚠️</span>
              <span>{pageError}</span>
            </div>
          )}

          {/* Step 1: Evidence Upload */}
          <div id="intake-section">
            <EvidenceUploadCard onUpload={handleUpload} isLoading={isUploading} />
          </div>

          {/* Step 2: Quality Gateway */}
          {uploadData && (
            <div id="quality-section">
              <QualityGatewayCard
                uploadData={uploadData}
                onProceedToVerification={handleVerify}
                isVerifying={isVerifying}
              />
            </div>
          )}

          {/* Step 3: Model Results */}
          {verificationData && (
            <div id="models-section">
              <ModelResultsCard
                results={verificationData}
                onRunForensics={handleForensics}
                isLoadingForensics={isForensicsLoading}
              />
            </div>
          )}

          {/* Step 4: Forensics */}
          {forensicsData && (
            <div id="forensics-section">
              <ForensicsViewerCard forensics={forensicsData} />
            </div>
          )}

          {/* Step 5: Reverse Search */}
          {activeCase && (activeCase.evidence_items?.length ?? 0) > 0 && activeCase.evidence_items[0] && (
            <div id="search-section">
              <ReverseSearchCard
                caseId={activeCase.id}
                evidenceId={activeCase.evidence_items[0].id}
                onTriggerSearch={handleTriggerReverseSearch}
                isSearching={isSearching}
                searchResult={reverseSearchData}
              />
            </div>
          )}

          {/* Step 6: Elicitation + Draft */}
          <div id="draft-section">
            {activeCase && (
              <ElicitationCard caseId={activeCase.id} onCompleted={handleElicitationCompleted} />
            )}
            {complaintDraft && (
              <ComplaintDraftViewer
                draft={complaintDraft}
                onConfirmReview={handleConfirmReview}
                isFinalizing={isFinalizingDraft}
              />
            )}
          </div>

          {/* Evidence Vault */}
          {activeCase && (
            <div id="inventory-section">
              <EvidenceInventoryCard caseData={activeCase} onRefreshCase={handleRefreshCase} />
            </div>
          )}

          {/* Helpline callout (always visible) */}
          {!hasWorkflow && (
            <div
              style={{
                marginTop: "2rem",
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                border: "1px solid #86efac",
                borderRadius: "var(--radius-lg)",
                padding: "1.75rem 2rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "2rem",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-primary)", marginBottom: "0.35rem" }}>
                  Need Help Now?
                </div>
                <div style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: "0.5rem" }}>
                  Emergency Helplines — India
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 2 }}>
                  <strong>Cybercrime Helpline</strong>: <a href="tel:1930" style={{ color: "var(--color-primary)", fontWeight: 700 }}>1930</a>
                  &nbsp;·&nbsp;
                  <strong>Women in Distress</strong>: <a href="tel:1091" style={{ color: "var(--color-primary)", fontWeight: 700 }}>1091</a>
                  &nbsp;·&nbsp;
                  <strong>National Emergency</strong>: <a href="tel:112" style={{ color: "var(--color-primary)", fontWeight: 700 }}>112</a>
                  <br />
                  <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "underline" }}>
                    cybercrime.gov.in ↗
                  </a>
                </div>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", maxWidth: "320px", lineHeight: 1.7 }}>
                All analysis runs locally. Images are AES-256 encrypted. No data is sent to external servers without your explicit consent. No complaint is filed automatically.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div className="nav-logo-icon">🛡️</div>
                <span style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.02em" }} aria-hidden="true">ShieldHer&nbsp;Initiative</span>
              </div>
              <p className="footer-brand-desc">
                A privacy-first forensic platform for NCII victims. Providing mathematically verifiable evidence analysis, secure takedown notice support, and trauma-informed legal complaint drafts under Indian law.
              </p>
            </div>
            <div>
              <div className="footer-heading">Emergency</div>
              <a href="tel:1930" className="footer-link">🚨 Cybercrime Helpline — 1930</a>
              <a href="tel:1091" className="footer-link">🚺 Women in Distress — 1091</a>
              <a href="tel:112" className="footer-link">🆘 National Emergency — 112</a>
              <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="footer-link">
                cybercrime.gov.in ↗
              </a>
            </div>
            <div>
              <div className="footer-heading">Compliance</div>
              <span className="footer-link" style={{ cursor: "default" }}>ISO/IEC 27037 Evidence</span>
              <span className="footer-link" style={{ cursor: "default" }}>IT Act 2000 §66E, §67A</span>
              <span className="footer-link" style={{ cursor: "default" }}>BNS 2023 §77, §78</span>
              <span className="footer-link" style={{ cursor: "default" }}>AES-256-GCM Vault</span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} ShieldHer Project. Open evidentiary standards for victim justice.</span>
            <span style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span className="status-dot-emerald" style={{ width: 6, height: 6 }} />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
