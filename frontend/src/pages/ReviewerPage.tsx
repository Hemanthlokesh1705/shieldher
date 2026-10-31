import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuditLogItem, CaseItem, UserProfile } from "../types/models";
import {
  getCase,
  getCaseAuditLogs,
  getCurrentUser,
  listCases,
  loginUser,
  submitCaseReview,
} from "../services/api";

export default function ReviewerPage() {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("shieldher_token"));
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Examiner action state
  const [decision, setDecision] = useState("CONFIRMED_MANIPULATION");
  const [examinerNotes, setExaminerNotes] = useState("");
  const [humanOverride, setHumanOverride] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadProfileAndCases(token);
    }
  }, [token]);

  const loadProfileAndCases = async (authToken: string) => {
    try {
      const profile = await getCurrentUser(authToken);
      if (!profile) return;
      setUserProfile(profile);

      if (profile.role === "VICTIM") {
        setLoginError("Access denied: Your account role is VICTIM. Reviewer Portal requires EXAMINER, ADVOCATE, or ADMIN role.");
        return;
      }

      const caseList = await listCases(authToken);
      setCases(caseList || []);
    } catch (err: any) {
      setLoginError(err.message || "Failed to load reviewer session");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const authData = await loginUser(email, password);
      setToken(authData.access_token);
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("shieldher_token");
    localStorage.removeItem("shieldher_role");
    localStorage.removeItem("shieldher_user_id");
    setToken(null);
    setUserProfile(null);
    setCases([]);
    setSelectedCase(null);
  };

  const handleSelectCase = async (caseId: string) => {
    setReviewMessage(null);
    try {
      const c = await getCase(caseId, token || undefined);
      setSelectedCase(c);
      setDecision(c.review_status !== "UNREVIEWED" ? c.review_status : "CONFIRMED_MANIPULATION");
      setExaminerNotes(c.examiner_notes || "");

      // Load immutable audit trail
      const logs = await getCaseAuditLogs(caseId, token || undefined);
      setAuditLogs(logs);
    } catch (err: any) {
      setReviewMessage(`Failed to load case: ${err.message}`);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !token) return;
    setIsSubmittingReview(true);
    setReviewMessage(null);
    try {
      const updated = await submitCaseReview(
        selectedCase.id,
        decision,
        examinerNotes,
        humanOverride,
        token
      );
      setSelectedCase(updated);
      setReviewMessage("Human forensic review and override recorded successfully in case audit log.");

      // Refresh list and audit logs
      const logs = await getCaseAuditLogs(selectedCase.id, token);
      setAuditLogs(logs);
      const caseList = await listCases(token);
      setCases(caseList);
    } catch (err: any) {
      setReviewMessage(`Failed to record review: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="reviewer-page" style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {/* Top Application Header */}
      <header className="app-header">
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0.85rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1.5px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#059669" }}>
                🔬
              </div>
              <div>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#064e3b" }}>
                  ShieldHer — Examiner & Reviewer Console
                </h1>
                <p style={{ fontSize: "0.725rem", color: "var(--color-text-muted)" }}>
                  Authorized Forensic Case Adjudication & Oversight
                </p>
              </div>
            </div>
          </div>

          <nav style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <Link
              to="/intake"
              className={`nav-pill ${location.pathname === "/intake" ? "active" : ""}`}
            >
              Victim Intake
            </Link>
            <Link to="/" className="nav-pill">Home</Link>
            <Link
              to="/reviewer"
              className={`nav-pill ${location.pathname === "/reviewer" ? "active" : ""}`}
            >
              Reviewer Portal
            </Link>
            <Link
              to="/health"
              className={`nav-pill ${location.pathname === "/health" ? "active" : ""}`}
            >
              System Health
            </Link>
            {userProfile && (
              <button
                onClick={handleLogout}
                className="btn-emerald btn-secondary"
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.775rem", marginLeft: "0.5rem" }}
              >
                Sign Out ({userProfile.role})
              </button>
            )}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: "1240px", width: "100%", margin: "2rem auto", padding: "0 1.5rem", flex: 1 }}>
        {/* Role Gate Check / Login Form */}
        {!userProfile || userProfile.role === "VICTIM" ? (
          <div
            className="app-card animate-fade-in"
            style={{
              maxWidth: "460px",
              margin: "4rem auto",
              padding: "2.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#059669" }}>
                🔐
              </div>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text)" }}>
                  Reviewer Authentication
                </h2>
                <span className="badge-clean badge-emerald" style={{ fontSize: "0.65rem", padding: "0.1rem 0.45rem" }}>
                  Authorized Personnel Only
                </span>
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Access restricted to certified forensic examiners, legal advocates, and administrators.
            </p>

            {loginError && (
              <div
                className="animate-fade-in"
                style={{
                  backgroundColor: "var(--color-error-bg)",
                  color: "var(--color-error)",
                  border: "1px solid #fecaca",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  marginBottom: "1.25rem",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontWeight: 500,
                }}
              >
                <span>⚠️</span> <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", color: "var(--color-text-secondary)", marginBottom: "0.35rem", fontWeight: 600 }}>
                  Examiner Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="examiner@forensics.org"
                  className="input-clean"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.825rem", color: "var(--color-text-secondary)", marginBottom: "0.35rem", fontWeight: 600 }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input-clean"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="btn-emerald"
                style={{ width: "100%", padding: "0.85rem 1.5rem", marginTop: "0.5rem" }}
              >
                {isLoggingIn ? "Authenticating..." : "Sign In to Reviewer Portal"}
              </button>
            </form>
          </div>
        ) : (
          /* Authorized Reviewer Workspace */
          <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "1.5rem" }} className="animate-fade-in">
            {/* Left Column: Minimal Sensitive Data Case List */}
            <div className="app-card" style={{ padding: "1.5rem", height: "fit-content" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text)" }}>Triage Case List</h3>
                <span className="badge-clean badge-emerald">
                  {cases.length} Cases
                </span>
              </div>
              <p style={{ fontSize: "0.775rem", color: "var(--color-text-muted)", marginBottom: "1.25rem", lineHeight: 1.45 }}>
                PII is redacted. Primary identifiers use pseudonymized case numbers and timestamps.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "70vh", overflowY: "auto", paddingRight: "0.25rem" }}>
                {cases.map((c) => {
                  const isSelected = selectedCase?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`reviewer-case-item ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectCase(c.id)}
                      style={{
                        padding: "0.85rem 1rem",
                        backgroundColor: isSelected ? "#ecfdf5" : "#ffffff",
                        border: `1.5px solid ${isSelected ? "#059669" : "#e2e8f0"}`,
                        borderRadius: "10px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 2px 8px rgba(5, 150, 105, 0.15)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.875rem", color: isSelected ? "#064e3b" : "#0f172a" }}>
                          {c.case_number}
                        </span>
                        <span className={`badge-clean ${statusBadgeClass(c.review_status)}`} style={{ fontSize: "0.68rem" }}>
                          {c.review_status}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.825rem", color: "var(--color-text-secondary)", marginBottom: "0.4rem", fontWeight: 500 }}>
                        {c.title}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                        <span>Items: {c.evidence_count}</span>
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Case Inspection, Model Reports & Review Controls */}
            <div>
              {selectedCase ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
                  {/* Case Header Card */}
                  <div className="app-card" style={{ padding: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--color-text)" }}>{selectedCase.case_number}</h2>
                        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>UUID: {selectedCase.id}</span>
                      </div>
                      <span className="badge-clean badge-emerald">
                        Policy: {selectedCase.retention_policy}
                      </span>
                    </div>

                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.5rem", lineHeight: 1.55 }}>
                      <strong style={{ color: "var(--color-text)" }}>Incident Description:</strong> {selectedCase.incident_description || "No description provided."}
                    </p>

                    <div style={{ display: "flex", gap: "1.75rem", marginTop: "1rem", fontSize: "0.8rem", color: "var(--color-text-muted)", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                      <span>Status: <strong style={{ color: "var(--color-text)" }}>{selectedCase.status}</strong></span>
                      <span>
                        Retention Expiry:{" "}
                        <strong style={{ color: "var(--color-text)" }}>
                          {selectedCase.retention_expires_at
                            ? new Date(selectedCase.retention_expires_at).toLocaleString()
                            : "None"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Evidence Items & Model Outputs */}
                  <div className="app-card" style={{ padding: "1.5rem" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text)", marginBottom: "1rem" }}>
                      Evidence Manifest & Automated Model Outputs
                    </h3>

                    {selectedCase.evidence_items && selectedCase.evidence_items.length > 0 ? (
                      selectedCase.evidence_items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            backgroundColor: "#f8fafc",
                            padding: "1.15rem 1.25rem",
                            borderRadius: "12px",
                            marginBottom: "1rem",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.925rem", color: "#065f46" }}>
                              {item.filename_sanitized}
                            </span>
                            <span style={{ fontSize: "0.775rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                              SHA-256: {item.original_sha256.slice(0, 16)}...
                            </span>
                          </div>

                          {item.model_outputs && item.model_outputs.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
                              {item.model_outputs.map((mo) => (
                                <div
                                  key={mo.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "0.8rem",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    padding: "0.65rem 0.85rem",
                                    borderRadius: "8px",
                                  }}
                                >
                                  <span>
                                    <strong style={{ color: "#065f46" }}>{mo.detector_name}:</strong> {mo.predicted_label || "No Label"} (Score: <span style={{ color: "#059669", fontWeight: 700 }}>{mo.raw_score?.toFixed(3) ?? "N/A"}</span>)
                                  </span>
                                  <span style={{ color: "var(--color-text-muted)" }}>
                                    {mo.status} ({mo.execution_duration_ms?.toFixed(0)} ms)
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>No model outputs attached to this evidence item.</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>No evidence items recorded.</p>
                    )}
                  </div>

                  {/* Human Annotations & Override Controls Form */}
                  <div className="app-card" style={{ padding: "1.5rem" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text)", marginBottom: "1rem" }}>
                      Examiner Adjudication & Override Controls
                    </h3>

                    {reviewMessage && (
                      <div
                        className="animate-fade-in"
                        style={{
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #a7f3d0",
                          color: "#065f46",
                          padding: "0.85rem 1rem",
                          borderRadius: "10px",
                          marginBottom: "1.25rem",
                          fontSize: "0.85rem",
                          fontWeight: 500,
                        }}
                      >
                        ℹ️ {reviewMessage}
                      </div>
                    )}

                    <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.4rem", fontWeight: 600 }}>
                          Review Decision
                        </label>
                        <select
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                          className="select-clean"
                        >
                          <option value="CONFIRMED_MANIPULATION">CONFIRMED_MANIPULATION — Strong forensic artifacts detected</option>
                          <option value="AUTHENTIC">AUTHENTIC — Consistent camera sensor & frequency baseline</option>
                          <option value="INCONCLUSIVE">INCONCLUSIVE — High compression / low resolution limits determination</option>
                          <option value="TAMPERING_EVIDENT">TAMPERING_EVIDENT — Metadata / boundary anomalies present</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.4rem", fontWeight: 600 }}>
                          Examiner Notes & Technical Annotations
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={examinerNotes}
                          onChange={(e) => setExaminerNotes(e.target.value)}
                          placeholder="Document observations regarding facial boundary discontinuity, ELA error differences, or FFT spectral symmetry..."
                          className="textarea-clean"
                        />
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem", color: "var(--color-text)", cursor: "pointer", lineHeight: 1.45 }}>
                        <input
                          type="checkbox"
                          checked={humanOverride}
                          onChange={(e) => setHumanOverride(e.target.checked)}
                          style={{ accentColor: "#059669", width: "17px", height: "17px", cursor: "pointer" }}
                        />
                        <span>
                          <strong>Human Override:</strong> Check this if your expert finding departs from or modifies automated model heuristics.
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmittingReview || examinerNotes.trim().length < 3}
                        className="btn-emerald btn-success"
                        style={{ padding: "0.85rem 1.5rem" }}
                      >
                        {isSubmittingReview ? "Recording..." : "Save Examiner Adjudication"}
                      </button>
                    </form>
                  </div>

                  {/* Audit Trail Card */}
                  <div className="app-card" style={{ padding: "1.5rem" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text)", marginBottom: "1rem" }}>
                      Immutable Case Audit Trail
                    </h3>

                    {auditLogs.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {auditLogs.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              padding: "0.85rem 1rem",
                              borderRadius: "10px",
                              fontSize: "0.8rem",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                              <strong style={{ color: "#065f46" }}>{log.action}</strong>
                              <span style={{ color: "var(--color-text-muted)" }}>{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                            {log.details_json && (
                              <pre style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>
                                {JSON.stringify(log.details_json, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>No audit log entries recorded yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="app-card"
                  style={{
                    padding: "4rem 2rem",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "2.5rem" }}>📂</span>
                  <p style={{ fontSize: "0.95rem" }}>
                    Select a case from the triage list to inspect details and record examiner review.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "CONFIRMED_MANIPULATION":
      return "badge-red";
    case "AUTHENTIC":
      return "badge-emerald";
    case "TAMPERING_EVIDENT":
      return "badge-amber";
    default:
      return "badge-slate";
  }
}
