import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Landmark, ShieldCheck } from "lucide-react";
import { listCases } from "../services/api";
import { CaseItem } from "../types/models";

export default function ReportsPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCases();
      setCases(data || []);
    } catch {
      setError("We couldn’t load your reports. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const formatStatus = (status?: string) =>
    (status || "Not reviewed")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-2xl border border-ink-border bg-surface-pearl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-2xl font-medium text-ink">Reports</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
              Review image-check findings and any complaint drafts you chose to prepare.
            </p>
          </div>
          <Link
            to="/verification/consent"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover"
          >
            Start an image check
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Report guidance">
        <article className="rounded-xl border border-ink-border bg-surface-pearl p-5">
          <Landmark size={18} className="mb-3 text-ink-secondary" aria-hidden="true" />
          <h2 className="text-base font-medium text-ink">Complaint drafts</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            Drafts are for your review. Check the details and local requirements before sharing them.
          </p>
        </article>
        <article className="rounded-xl border border-ink-border bg-surface-pearl p-5">
          <FileText size={18} className="mb-3 text-ink-secondary" aria-hidden="true" />
          <h2 className="text-base font-medium text-ink">Evidence records</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            Open a request to review the available evidence details and file identifiers.
          </p>
        </article>
        <article className="rounded-xl border border-ink-border bg-surface-pearl p-5">
          <ShieldCheck size={18} className="mb-3 text-ink-secondary" aria-hidden="true" />
          <h2 className="text-base font-medium text-ink">Your decision</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            Analysis results are signals to consider, not a final determination.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-ink-border bg-surface-pearl p-6 sm:p-8">
        <h2 className="mb-5 text-lg font-medium text-ink">Your requests</h2>

        {error && (
          <p className="mb-4 rounded-lg border border-status-errorBorder bg-status-errorBg p-4 text-sm text-status-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="py-12 text-center text-sm text-ink-muted" aria-live="polite">
            Loading your reports…
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-lg border border-ink-border px-4 py-2 text-sm font-medium text-ink hover:bg-canvas-subtle"
            >
              Try again
            </button>
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-xl border border-ink-border bg-canvas-subtle px-6 py-10 text-center">
            <FileText size={20} className="mx-auto mb-3 text-ink-muted" aria-hidden="true" />
            <h3 className="text-base font-medium text-ink">No reports yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
              When you complete an image check, its available findings and drafts will appear here.
            </p>
            <Link
              to="/verification/consent"
              className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-action-hover"
            >
              Start an image check
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Request</th>
                  <th>Review status</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="code-pill">{c.case_number || c.id.slice(0, 8)}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{c.title || "Image check"}</td>
                    <td>
                      <span className="badge badge-teal">
                        {formatStatus(c.review_status)}
                      </span>
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={`/cases/${c.id}`} className="btn btn-outline btn-sm">
                        View request
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
