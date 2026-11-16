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
import {
  Scale,
  Lock,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCheck,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";

export default function ReviewerPage() {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("shieldher_token")
  );
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
  const [reviewMessageError, setReviewMessageError] = useState(false);

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
        setLoginError(
          "Access denied: Your account role is VICTIM. Reviewer Portal requires EXAMINER, ADVOCATE, or ADMIN role."
        );
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
    setReviewMessageError(false);
    try {
      const c = await getCase(caseId, token || undefined);
      setSelectedCase(c);
      setDecision(
        c.review_status !== "UNREVIEWED"
          ? c.review_status
          : "CONFIRMED_MANIPULATION"
      );
      setExaminerNotes(c.examiner_notes || "");

      const logs = await getCaseAuditLogs(caseId, token || undefined);
      setAuditLogs(logs);
    } catch (err: any) {
      setReviewMessage(`Failed to load case: ${err.message}`);
      setReviewMessageError(true);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !token) return;
    setIsSubmittingReview(true);
    setReviewMessage(null);
    setReviewMessageError(false);
    try {
      const updated = await submitCaseReview(
        selectedCase.id,
        decision,
        examinerNotes,
        humanOverride,
        token
      );
      setSelectedCase(updated);
      setReviewMessage(
        "Human forensic review and override recorded successfully in case audit log."
      );

      const logs = await getCaseAuditLogs(selectedCase.id, token);
      setAuditLogs(logs);
      const caseList = await listCases(token);
      setCases(caseList);
    } catch (err: any) {
      setReviewMessage(`Failed to record review: ${err.message}`);
      setReviewMessageError(true);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="reviewer-page min-h-screen bg-canvas flex flex-col selection:bg-surface-subtle selection:text-brand-forest">
      {/* Top Application Header */}
      <header className="min-h-16 px-4 sm:px-6 py-3 bg-surface-pearl border-b border-ink-border flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-forest text-surface-pearl flex items-center justify-center shadow-xs">
            <Scale className="w-5 h-5 text-ink-secondary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-primary font-heading tracking-tight leading-none">
              ShieldHer &mdash; Examiner & Reviewer Console
            </h1>
            <p className="text-[11px] text-ink-muted mt-1 font-sans">
              Authorized Forensic Case Adjudication & Oversight
            </p>
          </div>
        </div>

        <nav aria-label="Reviewer navigation" className="flex flex-wrap items-center gap-1 sm:gap-2">
          <Link
            to="/intake"
            className={cn(
              "min-h-10 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              location.pathname === "/intake"
                ? "bg-surface-subtle/50 text-brand-forest"
                : "text-ink-secondary hover:text-ink hover:bg-canvas-subtle"
            )}
          >
            Victim Intake
          </Link>
          <Link
            to="/"
            className="min-h-10 px-3 py-2 rounded-lg text-xs font-medium text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors"
          >
            Home
          </Link>
          <Link
            to="/reviewer"
            className={cn(
              "min-h-10 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              location.pathname === "/reviewer"
                ? "bg-surface-subtle/50 text-brand-forest"
                : "text-ink-secondary hover:text-ink hover:bg-canvas-subtle"
            )}
          >
            Reviewer Portal
          </Link>
          <Link
            to="/health"
            className={cn(
              "min-h-10 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              location.pathname === "/health"
                ? "bg-surface-subtle/50 text-brand-forest"
                : "text-ink-secondary hover:text-ink hover:bg-canvas-subtle"
            )}
          >
            System Health
          </Link>
          {userProfile && (
            <button
              onClick={handleLogout}
              className="inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-border bg-surface-pearl text-xs font-medium text-ink hover:bg-canvas-subtle transition-colors shadow-2xs sm:ml-2"
            >
              <LogOut className="w-3.5 h-3.5 text-ink-muted" />
              <span>Sign Out ({userProfile.role})</span>
            </button>
          )}
        </nav>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1">
        {!userProfile || userProfile.role === "VICTIM" ? (
          <div className="max-w-md mx-auto my-12 bg-surface-pearl rounded-2xl border border-ink-border/80 p-7 sm:p-9 shadow-md shadow-ink-primary/5">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-surface-subtle/40 text-brand-forest flex items-center justify-center border border-brand-border">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink font-heading">
                  Reviewer Authentication
                </h2>
                <span className="inline-block text-[10px] font-bold text-brand-forest uppercase tracking-wider bg-surface-subtle/40 px-2 py-0.5 rounded-full mt-0.5">
                  Authorized Personnel Only
                </span>
              </div>
            </div>

            <p className="text-xs text-ink-secondary mb-6 leading-relaxed font-sans">
              Access restricted to certified forensic examiners, legal
              advocates, and platform administrators.
            </p>

            {loginError && (
              <div
                className="mb-5 p-3.5 rounded-xl bg-surface-subtle border border-ink-border text-ink-primary text-xs leading-relaxed flex items-start gap-2.5"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="reviewer-email" className="block text-xs font-medium text-ink mb-1.5">
                  Examiner Email
                </label>
                <input
                  id="reviewer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="examiner@forensics.org"
                  className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-action focus:border-brand-rich transition-colors shadow-2xs"
                />
              </div>

              <div>
                <label htmlFor="reviewer-password" className="block text-xs font-medium text-ink mb-1.5">
                  Password
                </label>
                <input
                  id="reviewer-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-action focus:border-brand-rich transition-colors shadow-2xs"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-11 inline-flex items-center justify-center px-4 rounded-xl bg-action hover:bg-action-hover active:bg-action-hover text-action-ink text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 mt-2"
              >
                {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <span>
                  {isLoggingIn
                    ? "Authenticating…"
                    : "Sign In to Reviewer Portal"}
                </span>
              </button>
            </form>
          </div>
        ) : (
          /* Authorized Examiner Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Triage Case List */}
            <div className="lg:col-span-4 bg-surface-pearl rounded-2xl border border-ink-border/80 p-5 shadow-xs h-fit">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-ink font-heading">
                  Triage Case List
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-subtle/40 text-brand-forest">
                  {cases.length} Cases
                </span>
              </div>
              <p className="text-xs text-ink-muted mb-4 leading-relaxed font-sans">
                PII is redacted. Primary identifiers use pseudonymized case
                numbers and timestamps.
              </p>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {cases.map((c) => {
                  const isSelected = selectedCase?.id === c.id;
                  return (
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`Open case ${c.case_number}: ${c.title}`}
                      key={c.id}
                      onClick={() => handleSelectCase(c.id)}
                      className={cn(
                        "w-full p-3.5 rounded-xl border text-left transition-colors text-xs shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action",
                        isSelected
                          ? "bg-surface-subtle/20 border-brand-forest ring-1 ring-brand-forest"
                          : "bg-surface-pearl border-ink-border hover:bg-canvas-subtle hover:border-brand-rich/50"
                      )}
                    >
                      <span className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-ink">
                          {c.case_number}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            c.review_status === "CONFIRMED_MANIPULATION"
                              ? "bg-surface-subtle text-ink-secondary"
                              : c.review_status === "AUTHENTIC"
                              ? "bg-surface-subtle/50 text-brand-forest"
                              : "bg-canvas-sand text-ink-secondary"
                          }`}
                        >
                          {c.review_status}
                        </span>
                      </span>
                      <span className="block font-semibold text-ink truncate mb-1">
                        {c.title}
                      </span>
                      <span className="flex items-center justify-between text-[11px] text-ink-muted">
                        <span>Items: {c.evidence_count}</span>
                        <span>
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Case Inspection, Manifest, Adjudication */}
            <div className="lg:col-span-8 space-y-6">
              {selectedCase ? (
                <>
                  {/* Case Details Card */}
                  <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-7 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-ink font-mono">
                          {selectedCase.case_number}
                        </h2>
                        <span className="font-mono text-[11px] text-ink-muted">
                          UUID: {selectedCase.id}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-canvas-sand text-ink-secondary">
                        Policy: {selectedCase.retention_policy}
                      </span>
                    </div>

                    <p className="text-xs text-ink leading-relaxed">
                      <strong className="text-ink-secondary">
                        Incident Description:
                      </strong>{" "}
                      {selectedCase.incident_description ||
                        "No description provided."}
                    </p>

                    <div className="flex items-center gap-6 pt-3 border-t border-ink-border/60 text-xs text-ink-secondary">
                      <span>
                        Status:{" "}
                        <strong className="text-ink">
                          {selectedCase.status}
                        </strong>
                      </span>
                      <span>
                        Retention Expiry:{" "}
                        <strong className="text-ink">
                          {selectedCase.retention_expires_at
                            ? new Date(
                                selectedCase.retention_expires_at
                              ).toLocaleString()
                            : "None"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Evidence Manifest & Model Outputs */}
                  <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-7 shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-ink font-heading">
                      Evidence Manifest & Automated Model Outputs
                    </h3>

                    {selectedCase.evidence_items &&
                    selectedCase.evidence_items.length > 0 ? (
                      selectedCase.evidence_items.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl bg-surface-subtle border border-ink-border/80 space-y-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-brand-forest">
                              {item.filename_sanitized}
                            </span>
                            <span className="font-mono text-[11px] text-ink-muted">
                              SHA-256: {item.original_sha256.slice(0, 16)}…
                            </span>
                          </div>

                          {item.model_outputs &&
                          item.model_outputs.length > 0 ? (
                            <div className="space-y-2">
                              {item.model_outputs.map((mo) => (
                                <div
                                  key={mo.id}
                                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-pearl border border-ink-border/70 shadow-2xs"
                                >
                                  <div>
                                    <strong className="text-brand-forest">
                                      {mo.detector_name}:
                                    </strong>{" "}
                                    <span>
                                      {mo.predicted_label || "No Label"}
                                    </span>{" "}
                                    (Score:{" "}
                                    <span className="font-bold text-ink">
                                      {mo.raw_score?.toFixed(3) ?? "N/A"}
                                    </span>
                                    )
                                  </div>
                                  <span className="text-ink-muted text-[11px]">
                                    {mo.status} (
                                    {mo.execution_duration_ms?.toFixed(0)} ms)
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-ink-muted">
                              No model outputs attached to this evidence item.
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-ink-muted">
                        No evidence items recorded.
                      </p>
                    )}
                  </div>

                  {/* Examiner Adjudication & Override Controls */}
                  <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-7 shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-ink font-heading">
                      Examiner Adjudication & Override Controls
                    </h3>

                    {reviewMessage && (
                      <div
                        className={cn(
                          "p-3.5 rounded-xl text-xs flex items-center gap-2 font-medium",
                          reviewMessageError
                            ? "bg-surface-subtle border border-ink-border text-ink-primary"
                            : "bg-surface-subtle/30 border border-brand-border text-brand-forest"
                        )}
                        role={reviewMessageError ? "alert" : "status"}
                      >
                        {reviewMessageError ? (
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-brand-rich flex-shrink-0" />
                        )}
                        <span>{reviewMessage}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <div>
                        <label htmlFor="review-decision" className="block text-xs font-medium text-ink mb-1.5">
                          Review Decision
                        </label>
                        <select
                          id="review-decision"
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                          className="w-full h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-action focus:border-brand-rich transition-colors shadow-2xs"
                        >
                          <option value="CONFIRMED_MANIPULATION">
                            CONFIRMED_MANIPULATION — Strong forensic artifacts
                            detected
                          </option>
                          <option value="AUTHENTIC">
                            AUTHENTIC — Consistent camera sensor & frequency
                            baseline
                          </option>
                          <option value="INCONCLUSIVE">
                            INCONCLUSIVE — High compression / low resolution limits
                            determination
                          </option>
                          <option value="TAMPERING_EVIDENT">
                            TAMPERING_EVIDENT — Metadata / boundary anomalies
                            present
                          </option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="review-notes" className="block text-xs font-medium text-ink mb-1.5">
                          Examiner Notes & Technical Annotations
                        </label>
                        <textarea
                          id="review-notes"
                          rows={4}
                          required
                          value={examinerNotes}
                          onChange={(e) => setExaminerNotes(e.target.value)}
                          placeholder="Document observations regarding facial boundary discontinuity, ELA error differences, or FFT spectral symmetry..."
                          className="w-full p-3.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-action focus:border-brand-rich transition-colors shadow-2xs"
                        />
                      </div>

                      <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={humanOverride}
                          onChange={(e) => setHumanOverride(e.target.checked)}
                          className="mt-0.5 rounded text-brand-forest focus:ring-action"
                        />
                        <span className="leading-relaxed">
                          <strong>Human Override:</strong> Check this if your
                          expert finding departs from or modifies automated model
                          heuristics.
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={
                          isSubmittingReview || examinerNotes.trim().length < 3
                        }
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action hover:bg-action-hover active:bg-action-hover text-action-ink text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50"
                      >
                        {isSubmittingReview && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        <span>
                          {isSubmittingReview
                            ? "Recording…"
                            : "Save Examiner Adjudication"}
                        </span>
                      </button>
                    </form>
                  </div>

                  {/* Case Audit Trail */}
                  <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-7 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-brand-forest" />
                      <h3 className="text-base font-bold text-ink font-heading">
                        Immutable Case Audit Trail
                      </h3>
                    </div>

                    {auditLogs.length > 0 ? (
                      <div className="space-y-2">
                        {auditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3.5 rounded-xl bg-surface-subtle border border-ink-border text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <strong className="text-brand-forest">
                                {log.action}
                              </strong>
                              <span className="text-ink-muted text-[11px]">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            {log.details_json && (
                              <pre className="font-mono text-[11px] text-ink-secondary bg-surface-pearl p-2.5 rounded-lg border border-ink-border/50 overflow-x-auto shadow-2xs">
                                {JSON.stringify(log.details_json, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-ink-muted">
                        No audit log entries recorded yet.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-16 text-center rounded-2xl bg-surface-pearl border border-ink-border/80 shadow-xs">
                  <FileCheck className="w-10 h-10 text-ink-muted mx-auto mb-3" />
                  <p className="text-xs sm:text-sm text-ink-secondary font-medium">
                    Select a case from the triage list to inspect details and
                    record examiner review.
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
