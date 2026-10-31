import { useEffect, useState, useCallback } from "react";
import { fetchHealth } from "../services/api";
import { HealthResponse } from "../types/health";

export default function HealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while checking health");
      }
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const currentPath = typeof window !== "undefined" ? window.location?.pathname : "";

  return (
    <div className="health-page" style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {/* Top Application Header */}
      <header className="app-header">
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0.85rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1.5px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#059669" }}>
                🩺
              </div>
              <div>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#064e3b" }}>
                  ShieldHer
                </h1>
                <p style={{ fontSize: "0.725rem", color: "var(--color-text-muted)" }}>
                  Privacy-First Forensics & NCII Victim Support
                </p>
              </div>
            </div>
          </div>

          <nav style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <a
              href="/intake"
              className={`nav-pill ${currentPath === "/intake" ? "active" : ""}`}
            >
              Victim Intake
            </a>
            <a href="/" className="nav-pill">Home</a>
            <a
              href="/reviewer"
              className={`nav-pill ${currentPath === "/reviewer" ? "active" : ""}`}
            >
              Reviewer Portal
            </a>
            <a
              href="/health"
              className={`nav-pill ${currentPath === "/health" || !currentPath ? "active" : ""}`}
            >
              System Health
            </a>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: "920px", width: "100%", margin: "2rem auto", padding: "0 1.5rem", flex: 1 }}>
        <div className="app-card animate-fade-in" style={{ padding: "1.75rem 2rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
            <span className="badge-clean badge-emerald">Diagnostics</span>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>ShieldHer System Diagnostics</span>
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#064e3b", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
            System Health Check
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Monitor frontend runtime and backend microservices connectivity (PostgreSQL & Redis).
          </p>
        </div>

        {/* Frontend status */}
        <section className="app-card animate-fade-in" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>Frontend Client</h2>
            <span className="badge-clean badge-emerald" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span className="status-dot-emerald" /> ONLINE
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Status:</span>
            <strong style={{ color: "#059669" }}>Active (React + Vite)</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Environment:</span>
            <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{import.meta.env.MODE || "development"}</span>
          </div>
        </section>

        {/* Backend status */}
        <section className="app-card animate-fade-in" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>Backend Services</h2>
            {loading ? (
              <span className="badge-clean badge-neutral">
                <span className="status-dot-emerald" style={{ backgroundColor: "#3b82f6" }} /> CHECKING...
              </span>
            ) : health?.status === "ok" ? (
              <span className="badge-clean badge-emerald" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span className="status-dot-emerald" /> ALL HEALTHY
              </span>
            ) : (
              <span className="badge-clean badge-rose">
                DEGRADED
              </span>
            )}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                backgroundColor: "var(--color-error-bg)",
                border: "1.5px solid #fecaca",
                color: "var(--color-error)",
                padding: "0.85rem 1.1rem",
                borderRadius: "10px",
                marginBottom: "1.25rem",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              <strong>Connection Error:</strong> {error}
            </div>
          )}

          {health && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--color-text-muted)" }}>API Status:</span>
                <strong style={{ color: health.status === "ok" ? "#059669" : "#dc2626" }}>
                  {health.status.toUpperCase()}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Version:</span>
                <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{health.version}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Environment:</span>
                <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{health.environment}</span>
              </div>

              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#065f46", marginTop: "1.25rem", marginBottom: "0.85rem" }}>
                Dependencies
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                {Object.entries(health.checks).map(([name, check]) => (
                  <div
                    key={name}
                    className="metric-tile-clean"
                    style={{ padding: "1rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{name}</strong>
                      <span
                        className="status-dot-emerald"
                        style={{ backgroundColor: check.status === "ok" ? "#059669" : "#dc2626" }}
                      />
                    </div>
                    <div style={{ fontSize: "0.775rem", color: "var(--color-text-muted)", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span>Status: <strong style={{ color: check.status === "ok" ? "#059669" : "#dc2626" }}>{check.status}</strong></span>
                      {check.latency_ms !== null && check.latency_ms !== undefined && (
                        <span>Latency: {check.latency_ms} ms</span>
                      )}
                      {check.detail && (
                        <span style={{ color: "var(--color-text-subtle)", marginTop: "0.2rem" }}>Detail: {check.detail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
            {lastChecked && (
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Last checked at: {lastChecked}</span>
            )}
            <button
              onClick={checkHealth}
              disabled={loading}
              className="btn-emerald"
              style={{ padding: "0.6rem 1.25rem", fontSize: "0.825rem" }}
              type="button"
            >
              {loading ? (
                <>
                  <span className="status-dot-emerald" /> Checking...
                </>
              ) : (
                "Recheck Health"
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
