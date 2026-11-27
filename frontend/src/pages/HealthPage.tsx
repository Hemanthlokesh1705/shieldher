import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import { fetchHealth } from "../services/api";
import { HealthResponse } from "../types/health";

function StatusBadge({
  children,
  healthy = true,
  pending = false,
}: {
  children: string;
  healthy?: boolean;
  pending?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
        pending
          ? "border-ink-border bg-canvas-subtle text-ink-secondary"
          : healthy
          ? "border-status-successBorder bg-status-successBg text-status-success"
          : "border-status-warningBorder bg-status-warningBg text-status-warning"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while checking system health."
      );
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const isHealthy = health?.status === "ok";
  const formatStatus = (status: string) =>
    status.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-ink-border bg-surface-pearl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-3 text-ink no-underline">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-subtle text-brand-forest">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-medium">ShieldHer</span>
              <span className="block text-xs text-ink-muted">System status</span>
            </span>
          </a>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-secondary" aria-label="System pages">
            <a href="/intake">Image check</a>
            <a href="/reviewer">Reviewer portal</a>
            <a href="/health" aria-current="page" className="font-medium text-brand-forest">System health</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-5 px-5 py-8 sm:px-8 sm:py-10">
        <section className="rounded-2xl border border-ink-border bg-surface-pearl p-6 sm:p-8">
          <div className="mb-3 flex items-center gap-2 text-sm text-ink-secondary">
            <Activity size={17} aria-hidden="true" />
            <span>Service diagnostics</span>
          </div>
          <h1 className="text-2xl font-medium text-ink">System health</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            A current view of the website and its connected services.
          </p>
        </section>

        <section className="rounded-2xl border border-ink-border bg-surface-pearl p-6 sm:p-8" aria-labelledby="frontend-status-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="frontend-status-title" className="text-lg font-medium text-ink">Frontend</h2>
            <StatusBadge>Online</StatusBadge>
          </div>
          <dl className="mt-4 divide-y divide-ink-border text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-secondary">Status</dt>
              <dd className="font-medium text-ink">Active</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-secondary">Environment</dt>
              <dd className="font-medium text-ink">{import.meta.env.MODE || "development"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-ink-border bg-surface-pearl p-6 sm:p-8" aria-labelledby="backend-status-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="backend-status-title" className="text-lg font-medium text-ink">Connected services</h2>
            {loading ? (
              <StatusBadge pending>Checking</StatusBadge>
            ) : (
              <StatusBadge healthy={isHealthy}>
                {isHealthy ? "All healthy" : "Needs attention"}
              </StatusBadge>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-error" role="alert">
              <strong>Connection issue:</strong> {error}
            </div>
          )}

          {health && (
            <>
              <dl className="mt-4 divide-y divide-ink-border text-sm">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-ink-secondary">API status</dt>
                  <dd className="font-medium text-ink">{formatStatus(health.status)}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-ink-secondary">Version</dt>
                  <dd className="font-medium text-ink">{health.version}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-ink-secondary">Environment</dt>
                  <dd className="font-medium text-ink">{health.environment}</dd>
                </div>
              </dl>

              <h3 className="mb-3 mt-6 text-base font-medium text-ink">Dependencies</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(health.checks).map(([name, check]) => (
                  <article key={name} className="rounded-xl border border-ink-border bg-canvas-subtle p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-medium text-ink">{name}</h4>
                      <StatusBadge healthy={check.status === "ok"}>
                        {formatStatus(check.status)}
                      </StatusBadge>
                    </div>
                    {check.latency_ms !== null && check.latency_ms !== undefined && (
                      <p className="mt-2 text-sm text-ink-secondary">
                        Response time: {check.latency_ms} ms
                      </p>
                    )}
                    {check.detail && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{check.detail}</p>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink-border pt-5">
            {lastChecked ? (
              <p className="text-sm text-ink-muted">Last checked at {lastChecked}</p>
            ) : <span />}
            <button
              onClick={checkHealth}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover disabled:cursor-wait disabled:opacity-60"
              type="button"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {loading ? "Checking…" : "Check again"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
